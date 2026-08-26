const ALLOWED_RACES = new Set(['100', '200', '400']);
const MAX_NAME_LEN = 20;
const MIN_TIME_MS = 1000;       // en dessous, forcement invalide
const MAX_TIME_MS = 20 * 60000; // 20 minutes, plafond large
// Un defi porte les traces des courses de son auteur, pour que l'adversaire
// puisse l'affronter en fantome. On plafonne pour qu'un client ne puisse pas
// remplir la base : 6 epreuves, ~13 releves/s, largement de quoi tenir un
// 400 m par epreuve.
const MAX_RACES = 6;
const MAX_TRACE_PTS = 1200;
const TOP_N = 500;
// Cumul sentinelle : marque une ligne nee d'un one shot ou d'un defi, sans
// parcours complet derriere. Doit rester identique cote jeu (NO_RUN_MS).
const NO_RUN_MS = 1200000;

function cors(resp) {
  resp.headers.set('Access-Control-Allow-Origin', '*');
  resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  resp.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return resp;
}

function json(data, status = 200) {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function cleanName(raw) {
  const s = String(raw || '').trim().slice(0, MAX_NAME_LEN);
  return s.replace(/[<>]/g, '') || 'Anonyme';
}

function isValidDeviceId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(id);
}

// Identifiant de defi court et lisible a l'oral : pas de 0/O ni 1/I/L, pour
// qu'on puisse le dicter sans ambiguite.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function makeCode(n = 6) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < n; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s;
}

function validRaces(v) {
  return Array.isArray(v) && v.length > 0 && v.length <= MAX_RACES &&
    v.every(r => ALLOWED_RACES.has(r));
}

// Les traces sont des tableaux d'entiers (decimetres). On les valide et on
// les tronque plutot que de faire confiance au client.
function cleanTrace(t) {
  const arr = [];
  if (!Array.isArray(t)) return arr;
  for (let j = 0; j < t.length && j < MAX_TRACE_PTS; j++) {
    const n = Math.round(Number(t[j]));
    arr.push(Number.isFinite(n) ? Math.max(0, Math.min(60000, n)) : 0);
  }
  return arr;
}
function cleanTraces(v, nRaces) {
  if (!Array.isArray(v)) return null;
  const out = [];
  for (let i = 0; i < nRaces; i++) out.push(cleanTrace(v[i]));
  return out;
}

// Migration paresseuse : la table scores existe depuis longtemps, on lui
// ajoute les colonnes du fantome au premier passage. ALTER TABLE echoue si la
// colonne est deja la — c'est le cas nominal, on ignore.
let scoresReady = false;
async function ensureScoreGhost(db) {
  if (scoresReady) return;
  for (const sql of [
    `ALTER TABLE scores ADD COLUMN trace TEXT`,
    `ALTER TABLE scores ADD COLUMN trace_ms INTEGER`,
  ]) {
    try { await db.prepare(sql).run(); } catch (e) { /* colonne deja presente */ }
  }
  scoresReady = true;
}

// Le TOP 500 classe le meilleur chrono realise sur UNE course, pas le cumul
// du parcours : c'est le temps que l'on compare naturellement d'un joueur a
// l'autre. Le cumul reste renvoye, mais a titre indicatif.
// Les lignes a best_split_ms = 0 datent d'avant l'enregistrement du chrono
// par course : sans chrono, pas de classement — sinon elles trusteraient la
// premiere place avec un 0,00 s.
//
// `id` est le rowid : un identifiant opaque qui permet de defier une ligne du
// tableau sans jamais exposer le device_id de son proprietaire. `has_ghost`
// dit si la course est rejouable en fantome.
// Une entree par joueur, pas par appareil. Un meme joueur qui joue sur son
// telephone et son ordinateur creait autant de lignes : le tableau se
// remplissait de ses propres tentatives. On regroupe donc sur le nom et on ne
// garde que son meilleur chrono.
//
// GROUP BY avec MIN() : SQLite garantit que les colonnes nues proviennent de
// la ligne qui porte le minimum. L'identifiant renvoye est donc bien celui de
// la meilleure course — c'est elle qu'on defie, et son fantome qu'on affronte.
//
// `by` decide sur quoi porte le regroupement : le classement par course se
// resume au meilleur chrono d'une course, celui des parcours au meilleur
// cumul. Regrouper une fois pour les deux donnerait un cumul qui n'est pas le
// meilleur du joueur.
async function getLeaderboard(db, race, by = 'race') {
  const col = by === 'run' ? 'time_ms' : 'best_split_ms';
  const garde = by === 'run'
    ? `time_ms > 0 AND time_ms < ${NO_RUN_MS}`
    : `best_split_ms > 0`;
  const { results } = await db.prepare(
    `SELECT rowid AS id, name, time_ms, best_split_ms, updated_at,
            MIN(${col}) AS _min,
            (trace IS NOT NULL AND length(trace) > 2) AS has_ghost
       FROM scores
      WHERE race_key = ? AND ${garde}
      GROUP BY lower(trim(name))
      ORDER BY _min ASC LIMIT ${TOP_N}`
  ).bind(race).all();
  return (results || []).map(({ _min, ...r }) => ({ ...r, has_ghost: !!r.has_ghost }));
}

// Le rang se compte en joueurs devant soi, pas en lignes : sans cela, un
// joueur present sur trois appareils occuperait trois places et repousserait
// tout le monde vers le bas.
async function getRank(db, race, splitMs) {
  const row = await db.prepare(
    `SELECT COUNT(*) AS n FROM (
       SELECT MIN(best_split_ms) AS m FROM scores
        WHERE race_key = ? AND best_split_ms > 0
        GROUP BY lower(trim(name))
     ) WHERE m < ?`
  ).bind(race, splitMs).first();
  return (row?.n || 0) + 1;
}

// Une ligne par appareil et par jour : un meme visiteur qui revient dix fois
// dans la journee compte pour dix passages mais un seul visiteur. Rien de
// nominatif n'est stocke, seulement l'identifiant anonyme deja utilise par le
// classement.
let visitsReady = false;
async function ensureVisitTable(db) {
  if (visitsReady) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS visits (
    day TEXT NOT NULL,
    device_id TEXT NOT NULL,
    hits INTEGER NOT NULL DEFAULT 1,
    last_at INTEGER NOT NULL,
    PRIMARY KEY (day, device_id)
  )`).run();
  visitsReady = true;
}

// Un defi peut viser quelqu'un en particulier. La colonne est ajoutee apres
// coup sur une table qui existe deja, d'ou la migration paresseuse.
let targetReady = false;
async function ensureChallengeTarget(db) {
  if (targetReady) return;
  try { await db.prepare(`ALTER TABLE challenges ADD COLUMN target_device TEXT`).run(); }
  catch (e) { /* colonne deja presente */ }
  targetReady = true;
}

// Historique des courses. Indexe sur le nom autant que sur l'appareil : c'est
// ce qui permet a un joueur de retrouver ses courses en changeant de
// telephone. Le nom n'est pas authentifie — deux personnes qui choisissent le
// meme verraient donc un historique commun. Compromis assume : c'est deja
// l'identite publique du classement, et l'alternative serait un compte.
const HIST_PER_DEVICE = 300;
let racesReady = false;
async function ensureRaceTable(db) {
  if (racesReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS races (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      name_key TEXT NOT NULL,
      name TEXT NOT NULL,
      race_key TEXT NOT NULL,
      time_ms INTEGER NOT NULL,
      mode TEXT NOT NULL,
      level_idx INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS races_by_name ON races(name_key, race_key, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS races_by_device ON races(device_id, race_key, created_at)`),
  ]);
  racesReady = true;
}

// Un nom appartient a quelqu'un, et cet appartenance se prouve par un code
// court. C'est ce qui remplace un compte : pas de tiers, pas d'e-mail, pas
// d'ecran de consentement — juste de quoi relier ses appareils et empecher
// qu'on prenne son nom.
let joueursReady = false;
async function ensurePlayerTables(db) {
  if (joueursReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS players (
      name_key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS player_devices (
      name_key TEXT NOT NULL,
      device_id TEXT NOT NULL,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (name_key, device_id)
    )`),
  ]);
  joueursReady = true;
}

/** Cet appareil a-t-il le droit d'ecrire sous ce nom ? */
async function peutUtiliser(db, nameKey, deviceId) {
  if (!nameKey) return true;                       // anonyme : rien a proteger
  await ensurePlayerTables(db);
  const p = await db.prepare(`SELECT name_key FROM players WHERE name_key = ?`)
    .bind(nameKey).first();
  if (!p) return true;                             // nom encore libre
  const d = await db.prepare(
    `SELECT 1 AS ok FROM player_devices WHERE name_key = ? AND device_id = ?`
  ).bind(nameKey, deviceId).first();
  return !!d;
}

async function ensureChallengeTables(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      owner_device TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      races TEXT NOT NULL,
      level_idx INTEGER NOT NULL,
      total_ms INTEGER NOT NULL,
      splits TEXT NOT NULL,
      traces TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS challenge_attempts (
      id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      name TEXT NOT NULL,
      total_ms INTEGER NOT NULL,
      splits TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (id, device_id)
    )`),
  ]);
}

async function attemptsFor(db, id) {
  const { results } = await db.prepare(
    `SELECT name, total_ms, splits, created_at FROM challenge_attempts
      WHERE id = ? ORDER BY total_ms ASC LIMIT 50`
  ).bind(id).all();
  return (results || []).map(r => ({
    name: r.name, total_ms: r.total_ms, created_at: r.created_at,
    splits: JSON.parse(r.splits || '[]'),
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }

    // ------------------------------------------------------- classement
    if (url.pathname === '/leaderboard' && request.method === 'GET') {
      const race = url.searchParams.get('race');
      if (!ALLOWED_RACES.has(race)) return json({ error: 'race invalide' }, 400);
      // getLeaderboard lit la colonne trace : elle doit exister avant.
      await ensureScoreGhost(env.DB);
      const by = url.searchParams.get('by') === 'run' ? 'run' : 'race';
      const entries = await getLeaderboard(env.DB, race, by);
      return json({ race, by, entries });
    }

    if (url.pathname === '/submit' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

      const { device_id, race_key, name, time_ms, best_split_ms, trace } = body || {};
      if (!ALLOWED_RACES.has(race_key)) return json({ error: 'race invalide' }, 400);
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      const t = Math.round(Number(time_ms));
      if (!Number.isFinite(t) || t < MIN_TIME_MS || t > MAX_TIME_MS) {
        return json({ error: 'temps invalide' }, 400);
      }
      // le meilleur chrono individuel ne peut pas depasser le temps total
      let split = Math.round(Number(best_split_ms));
      if (!Number.isFinite(split) || split <= 0 || split > t) split = t;
      const cleanedName = cleanName(name);
      // Un nom reserve n'accepte que les appareils de son proprietaire :
      // sans cela la reservation ne protegerait rien.
      if (!await peutUtiliser(env.DB, cleanedName.trim().toLowerCase(), device_id)) {
        return json({ error: 'nom reserve', pris: true }, 403);
      }
      const now = Date.now();
      await ensureScoreGhost(env.DB);

      const existing = await env.DB.prepare(
        `SELECT time_ms, best_split_ms FROM scores WHERE device_id = ? AND race_key = ?`
      ).bind(device_id, race_key).first();

      // Le meilleur chrono individuel doit survivre indefiniment pour cet
      // appareil/course, meme si c'est un run avec un moins bon temps total
      // qui l'a produit : on ne le remplace jamais par une valeur pire.
      const bestSplit = existing ? Math.min(split, existing.best_split_ms || split) : split;

      if (!existing || t < existing.time_ms) {
        await env.DB.prepare(
          `INSERT INTO scores (device_id, race_key, name, time_ms, best_split_ms, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(device_id, race_key) DO UPDATE SET
             name = excluded.name, time_ms = excluded.time_ms,
             best_split_ms = excluded.best_split_ms, updated_at = excluded.updated_at`
        ).bind(device_id, race_key, cleanedName, t, bestSplit, now).run();
      } else {
        await env.DB.prepare(
          `UPDATE scores SET name = ?, best_split_ms = ? WHERE device_id = ? AND race_key = ?`
        ).bind(cleanedName, bestSplit, device_id, race_key).run();
      }

      // La trace n'accompagne que le meilleur chrono par course : c'est elle
      // qu'un adversaire affrontera en fantome depuis le tableau.
      if (split === bestSplit) {
        const tr = cleanTrace(trace);
        if (tr.length) {
          await env.DB.prepare(
            `UPDATE scores SET trace = ?, trace_ms = ? WHERE device_id = ? AND race_key = ?`
          ).bind(JSON.stringify(tr), bestSplit, device_id, race_key).run();
        }
      }

      const bestTime = existing && existing.time_ms < t ? existing.time_ms : t;
      // le rang se joue sur le meilleur chrono d'une course, pas sur le cumul
      const rank = await getRank(env.DB, race_key, bestSplit);
      const entries = await getLeaderboard(env.DB, race_key);
      return json({ race: race_key, rank, best_time_ms: bestTime,
                    best_split_ms: bestSplit, entries });
    }

    if (url.pathname === '/rank' && request.method === 'GET') {
      const race = url.searchParams.get('race');
      const deviceId = url.searchParams.get('device_id');
      if (!ALLOWED_RACES.has(race) || !isValidDeviceId(deviceId)) {
        return json({ error: 'parametres invalides' }, 400);
      }
      const row = await env.DB.prepare(
        `SELECT name, time_ms, best_split_ms FROM scores WHERE device_id = ? AND race_key = ?`
      ).bind(deviceId, race).first();
      // Sans chrono par course enregistre (ligne anterieure a la mesure), le
      // joueur n'a pas encore de place dans ce classement.
      if (!row || !(row.best_split_ms > 0)) return json({ found: false });
      const rank = await getRank(env.DB, race, row.best_split_ms);
      return json({ found: true, rank, name: row.name, time_ms: row.time_ms,
                    best_split_ms: row.best_split_ms });
    }

    // Fantome d'une ligne du classement, pour la defier depuis le TOP 500.
    // On passe par le rowid : le device_id de l'auteur n'est jamais expose.
    if (url.pathname === '/ghost' && request.method === 'GET') {
      const id = Math.round(Number(url.searchParams.get('id')));
      if (!Number.isFinite(id) || id <= 0) return json({ error: 'id invalide' }, 400);
      await ensureScoreGhost(env.DB);
      const row = await env.DB.prepare(
        `SELECT race_key, name, time_ms, best_split_ms, trace FROM scores WHERE rowid = ?`
      ).bind(id).first();
      if (!row || !row.trace) return json({ found: false });
      return json({
        found: true,
        race: row.race_key,
        name: row.name,
        split_ms: row.best_split_ms,
        total_ms: row.time_ms,
        trace: JSON.parse(row.trace),
      });
    }

    // ------------------------------------------------------------- identite
    // Reserver un nom. Si personne ne l'a pris, il est a nous et on recoit un
    // code ; s'il est deja a nous, on le recupere ; sinon il faut le code.
    if (url.pathname === '/claim' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      const propre = cleanName(name);
      const key = propre.trim().toLowerCase();
      if (!key || propre === 'Anonyme') return json({ error: 'nom invalide' }, 400);
      await ensurePlayerTables(env.DB);

      const existe = await env.DB.prepare(
        `SELECT name, code FROM players WHERE name_key = ?`).bind(key).first();

      if (existe) {
        const lie = await env.DB.prepare(
          `SELECT 1 AS ok FROM player_devices WHERE name_key = ? AND device_id = ?`
        ).bind(key, device_id).first();
        if (lie) return json({ ok: true, name: existe.name, code: existe.code, deja: true });
        return json({ ok: false, pris: true });     // il faudra fournir le code
      }

      const code = makeCode();
      await env.DB.prepare(
        `INSERT INTO players (name_key, name, code, created_at) VALUES (?, ?, ?, ?)`
      ).bind(key, propre, code, Date.now()).run();
      // Les appareils qui jouaient deja sous ce nom sont rattaches : sans
      // cela, reserver son propre nom couperait le joueur de son historique.
      await env.DB.prepare(
        `INSERT OR IGNORE INTO player_devices (name_key, device_id, added_at)
         SELECT DISTINCT ?, device_id, ? FROM scores WHERE lower(trim(name)) = ?`
      ).bind(key, Date.now(), key).run();
      await env.DB.prepare(
        `INSERT OR IGNORE INTO player_devices (name_key, device_id, added_at) VALUES (?, ?, ?)`
      ).bind(key, device_id, Date.now()).run();
      return json({ ok: true, name: propre, code });
    }

    // Relier cet appareil a un nom deja reserve, en prouvant qu'il est a nous.
    if (url.pathname === '/link' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name, code } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      const key = cleanName(name).trim().toLowerCase();
      const donne = String(code || '').trim().toUpperCase();
      if (!key || !donne) return json({ error: 'parametres invalides' }, 400);
      await ensurePlayerTables(env.DB);
      const p = await env.DB.prepare(
        `SELECT name, code FROM players WHERE name_key = ?`).bind(key).first();
      if (!p) return json({ ok: false, inconnu: true });
      if (p.code !== donne) return json({ ok: false, mauvais_code: true });
      await env.DB.prepare(
        `INSERT OR IGNORE INTO player_devices (name_key, device_id, added_at) VALUES (?, ?, ?)`
      ).bind(key, device_id, Date.now()).run();
      return json({ ok: true, name: p.name });
    }

    // ------------------------------------------------ historique personnel
    if (url.pathname === '/race' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name, race_key, time_ms, mode, level_idx } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      if (!ALLOWED_RACES.has(race_key)) return json({ error: 'race invalide' }, 400);
      const t = Math.round(Number(time_ms));
      if (!Number.isFinite(t) || t < MIN_TIME_MS || t > MAX_TIME_MS) {
        return json({ error: 'temps invalide' }, 400);
      }
      const cleaned = cleanName(name);
      const key = cleaned.trim().toLowerCase();
      if (!await peutUtiliser(env.DB, key, device_id)) {
        return json({ error: 'nom reserve', pris: true }, 403);
      }
      const lvl = Math.max(0, Math.min(5, Math.round(Number(level_idx)) || 0));
      const md = mode === 'oneshot' ? 'oneshot' : 'campaign';
      await ensureRaceTable(env.DB);
      await env.DB.prepare(
        `INSERT INTO races (device_id, name_key, name, race_key, time_ms, mode, level_idx, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(device_id, key, cleaned, race_key, t, md, lvl, Date.now()).run();
      // On borne ce qu'un appareil peut accumuler, sinon la table enfle sans
      // limite pour un historique que personne ne fera defiler jusqu'au bout.
      await env.DB.prepare(
        `DELETE FROM races WHERE device_id = ? AND id NOT IN (
           SELECT id FROM races WHERE device_id = ? ORDER BY created_at DESC LIMIT ?)`
      ).bind(device_id, device_id, HIST_PER_DEVICE).run();
      return json({ ok: true });
    }

    // Historique : celui du nom quand il est connu — c'est ce qui suit d'un
    // appareil a l'autre — sinon celui de cet appareil seul.
    if (url.pathname === '/races' && request.method === 'GET') {
      const deviceId = url.searchParams.get('device_id');
      const race = url.searchParams.get('race');
      const nameKey = (url.searchParams.get('name') || '').trim().toLowerCase();
      if (!isValidDeviceId(deviceId)) return json({ error: 'device_id invalide' }, 400);
      if (!ALLOWED_RACES.has(race)) return json({ error: 'race invalide' }, 400);
      await ensureRaceTable(env.DB);
      const q = nameKey
        ? env.DB.prepare(
            `SELECT race_key, time_ms, mode, level_idx, created_at FROM races
              WHERE race_key = ? AND (name_key = ? OR device_id = ?)
              ORDER BY created_at DESC LIMIT 300`
          ).bind(race, nameKey, deviceId)
        : env.DB.prepare(
            `SELECT race_key, time_ms, mode, level_idx, created_at FROM races
              WHERE race_key = ? AND device_id = ?
              ORDER BY created_at DESC LIMIT 300`
          ).bind(race, deviceId);
      const { results } = await q.all();
      return json({ courses: results || [] });
    }

    // -------------------------------------------------- visites et tableau
    if (url.pathname === '/visit' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      await ensureVisitTable(env.DB);
      const now = Date.now();
      const day = new Date(now).toISOString().slice(0, 10);
      await env.DB.prepare(
        `INSERT INTO visits (day, device_id, hits, last_at) VALUES (?, ?, 1, ?)
         ON CONFLICT(day, device_id) DO UPDATE SET hits = hits + 1, last_at = excluded.last_at`
      ).bind(day, device_id, now).run();
      return json({ ok: true });
    }

    // Tout ce que le tableau de bord affiche, en un seul aller-retour.
    if (url.pathname === '/stats' && request.method === 'GET') {
      await ensureVisitTable(env.DB);
      await ensureChallengeTables(env.DB);
      await ensureScoreGhost(env.DB);

      const v = await env.DB.prepare(
        `SELECT COALESCE(SUM(hits),0) AS hits,
                COUNT(DISTINCT device_id) AS visiteurs
           FROM visits`
      ).first();
      const { results: parJour } = await env.DB.prepare(
        `SELECT day, COUNT(*) AS visiteurs, SUM(hits) AS hits
           FROM visits GROUP BY day ORDER BY day DESC LIMIT 30`
      ).all();
      const s = await env.DB.prepare(
        `SELECT COUNT(*) AS lignes,
                COUNT(DISTINCT device_id) AS appareils,
                COUNT(DISTINCT lower(trim(name))) AS joueurs
           FROM scores`
      ).first();
      const c = await env.DB.prepare(
        `SELECT (SELECT COUNT(*) FROM challenges) AS defis,
                (SELECT COUNT(*) FROM challenge_attempts) AS tentatives`
      ).first();

      return json({
        visites: { total: v?.hits || 0, visiteurs: v?.visiteurs || 0, par_jour: parJour || [] },
        scores: s || {}, defis: c || {},
      });
    }

    // ------------------------------------------------------------- defis
    // Creation : l'auteur envoie sa course (chronos + traces) et recupere un
    // code court a transmettre. L'adversaire jouera exactement les memes
    // epreuves, contre le fantome de cette course.
    if (url.pathname === '/challenge' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name, races, level_idx, total_ms, splits, traces,
              target_score_id } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      if (!validRaces(races)) return json({ error: 'epreuves invalides' }, 400);
      const t = Math.round(Number(total_ms));
      if (!Number.isFinite(t) || t < MIN_TIME_MS || t > MAX_TIME_MS) {
        return json({ error: 'temps invalide' }, 400);
      }
      const lvl = Math.max(0, Math.min(5, Math.round(Number(level_idx)) || 0));
      const cleanedTraces = cleanTraces(traces, races.length);
      if (!cleanedTraces) return json({ error: 'traces invalides' }, 400);
      const cleanSplits = (Array.isArray(splits) ? splits : []).slice(0, races.length)
        .map(v => Math.max(0, Math.round(Number(v)) || 0));

      await ensureChallengeTables(env.DB);
      await ensureChallengeTarget(env.DB);

      // Defi adresse a quelqu'un : on le designe par la ligne de classement
      // qu'il occupe, jamais par son device_id — celui-ci ne sort pas d'ici.
      // On ne s'adresse pas non plus un defi a soi-meme.
      let target = null, targetName = '';
      const sid = Math.round(Number(target_score_id));
      if (Number.isFinite(sid) && sid > 0) {
        const row = await env.DB.prepare(
          `SELECT device_id, name FROM scores WHERE rowid = ?`
        ).bind(sid).first();
        if (row && row.device_id !== device_id) { target = row.device_id; targetName = row.name; }
      }

      const id = makeCode();
      await env.DB.prepare(
        `INSERT INTO challenges (id, created_at, owner_device, owner_name, races, level_idx, total_ms, splits, traces, target_device)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, Date.now(), device_id, cleanName(name), JSON.stringify(races),
             lvl, t, JSON.stringify(cleanSplits), JSON.stringify(cleanedTraces), target).run();
      return json({ id, target_name: targetName });
    }

    if (url.pathname === '/challenge' && request.method === 'GET') {
      const id = (url.searchParams.get('id') || '').toUpperCase();
      if (!/^[A-Z0-9]{4,10}$/.test(id)) return json({ error: 'code invalide' }, 400);
      await ensureChallengeTables(env.DB);
      const row = await env.DB.prepare(
        `SELECT id, owner_name, races, level_idx, total_ms, splits, traces, created_at
           FROM challenges WHERE id = ?`
      ).bind(id).first();
      if (!row) return json({ found: false });
      return json({
        found: true,
        id: row.id,
        owner_name: row.owner_name,
        races: JSON.parse(row.races),
        level_idx: row.level_idx,
        total_ms: row.total_ms,
        splits: JSON.parse(row.splits || '[]'),
        traces: JSON.parse(row.traces || '[]'),
        created_at: row.created_at,
        attempts: await attemptsFor(env.DB, id),
      });
    }

    // Boite de reception : les defis qui me sont adresses et que je n'ai pas
    // encore releves. Sans les traces, qui pesent lourd et ne servent qu'au
    // moment ou l'on accepte.
    if (url.pathname === '/inbox' && request.method === 'GET') {
      const deviceId = url.searchParams.get('device_id');
      if (!isValidDeviceId(deviceId)) return json({ error: 'device_id invalide' }, 400);
      await ensureChallengeTables(env.DB);
      await ensureChallengeTarget(env.DB);
      const { results } = await env.DB.prepare(
        `SELECT c.id, c.owner_name, c.races, c.level_idx, c.total_ms, c.splits, c.created_at
           FROM challenges c
          WHERE c.target_device = ?
            AND NOT EXISTS (SELECT 1 FROM challenge_attempts a
                             WHERE a.id = c.id AND a.device_id = ?)
          ORDER BY c.created_at DESC LIMIT 20`
      ).bind(deviceId, deviceId).all();
      return json({
        defis: (results || []).map(r => ({
          id: r.id, owner_name: r.owner_name, races: JSON.parse(r.races),
          level_idx: r.level_idx, total_ms: r.total_ms,
          splits: JSON.parse(r.splits || '[]'), created_at: r.created_at,
        })),
      });
    }

    // Tentative : on enregistre le chrono de l'adversaire et on renvoie le
    // classement du defi. On ne garde que la meilleure tentative par appareil.
    if (url.pathname === '/challenge/attempt' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { id, device_id, name, total_ms, splits } = body || {};
      const code = String(id || '').toUpperCase();
      if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      const t = Math.round(Number(total_ms));
      if (!Number.isFinite(t) || t < MIN_TIME_MS || t > MAX_TIME_MS) {
        return json({ error: 'temps invalide' }, 400);
      }
      await ensureChallengeTables(env.DB);
      const ch = await env.DB.prepare(
        `SELECT owner_name, total_ms FROM challenges WHERE id = ?`
      ).bind(code).first();
      if (!ch) return json({ found: false }, 404);

      const cleanSplits = (Array.isArray(splits) ? splits : [])
        .map(v => Math.max(0, Math.round(Number(v)) || 0));
      const prev = await env.DB.prepare(
        `SELECT total_ms FROM challenge_attempts WHERE id = ? AND device_id = ?`
      ).bind(code, device_id).first();
      if (!prev || t < prev.total_ms) {
        await env.DB.prepare(
          `INSERT INTO challenge_attempts (id, device_id, name, total_ms, splits, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id, device_id) DO UPDATE SET
             name = excluded.name, total_ms = excluded.total_ms,
             splits = excluded.splits, created_at = excluded.created_at`
        ).bind(code, device_id, cleanName(name), t, JSON.stringify(cleanSplits), Date.now()).run();
      }
      return json({
        id: code,
        owner_name: ch.owner_name,
        owner_total_ms: ch.total_ms,
        your_total_ms: prev && prev.total_ms < t ? prev.total_ms : t,
        attempts: await attemptsFor(env.DB, code),
      });
    }

    return json({ error: 'not found' }, 404);
  },
};
