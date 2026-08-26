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
async function getLeaderboard(db, race) {
  const { results } = await db.prepare(
    `SELECT rowid AS id, name, time_ms, best_split_ms, updated_at,
            (trace IS NOT NULL AND length(trace) > 2) AS has_ghost
       FROM scores
      WHERE race_key = ? AND best_split_ms > 0
      ORDER BY best_split_ms ASC LIMIT ${TOP_N}`
  ).bind(race).all();
  return (results || []).map(r => ({ ...r, has_ghost: !!r.has_ghost }));
}

async function getRank(db, race, splitMs) {
  const row = await db.prepare(
    `SELECT COUNT(*) AS n FROM scores
      WHERE race_key = ? AND best_split_ms > 0 AND best_split_ms < ?`
  ).bind(race, splitMs).first();
  return (row?.n || 0) + 1;
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
      const entries = await getLeaderboard(env.DB, race);
      return json({ race, entries });
    }

    if (url.pathname === '/submit' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

      // split_only : le chrono d'une seule course, envoye des la ligne
      // franchie quand il bat le record du monde de la distance. Il n'y a pas
      // de parcours complet derriere — on ne touche donc jamais au cumul,
      // sans quoi un 100 m de dix secondes prendrait la tete du classement
      // des parcours entiers.
      const { device_id, race_key, name, time_ms, best_split_ms, trace } = body || {};
      const splitOnly = !!(body && body.split_only);
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
      const now = Date.now();
      await ensureScoreGhost(env.DB);

      const existing = await env.DB.prepare(
        `SELECT time_ms, best_split_ms FROM scores WHERE device_id = ? AND race_key = ?`
      ).bind(device_id, race_key).first();

      // Le meilleur chrono individuel doit survivre indefiniment pour cet
      // appareil/course, meme si c'est un run avec un moins bon temps total
      // qui l'a produit : on ne le remplace jamais par une valeur pire.
      const bestSplit = existing ? Math.min(split, existing.best_split_ms || split) : split;

      if (splitOnly) {
        // Cumul laisse tel quel : 0 pour une premiere ligne, ce qui l'exclut
        // du classement des parcours complets jusqu'a ce qu'un vrai parcours
        // soit boucle.
        await env.DB.prepare(
          `INSERT INTO scores (device_id, race_key, name, time_ms, best_split_ms, updated_at)
           VALUES (?, ?, ?, 0, ?, ?)
           ON CONFLICT(device_id, race_key) DO UPDATE SET
             name = excluded.name, best_split_ms = excluded.best_split_ms,
             updated_at = excluded.updated_at`
        ).bind(device_id, race_key, cleanedName, bestSplit, now).run();
      } else if (!existing || t < existing.time_ms) {
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

      const bestTime = splitOnly
        ? (existing ? existing.time_ms : 0)
        : (existing && existing.time_ms < t ? existing.time_ms : t);
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

    // ------------------------------------------------------------- defis
    // Creation : l'auteur envoie sa course (chronos + traces) et recupere un
    // code court a transmettre. L'adversaire jouera exactement les memes
    // epreuves, contre le fantome de cette course.
    if (url.pathname === '/challenge' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name, races, level_idx, total_ms, splits, traces } = body || {};
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
      const id = makeCode();
      await env.DB.prepare(
        `INSERT INTO challenges (id, created_at, owner_device, owner_name, races, level_idx, total_ms, splits, traces)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, Date.now(), device_id, cleanName(name), JSON.stringify(races),
             lvl, t, JSON.stringify(cleanSplits), JSON.stringify(cleanedTraces)).run();
      return json({ id });
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
