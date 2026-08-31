import {
  recalculerClassement, ETAGES, DIVISIONS, LEGENDE, LP_PAR_PALIER, LP, rangDe,
  ensureDuelTables, duelBoard, appliquerDuel, compterLance,
} from './duels.js';
import { poserMot, MAX_TEXTE } from './mot.js';
export { SalleDirecte } from './salle.js';
export { SalleRelais } from './salle-relais.js';
export { SalleConfrontation } from './salle-confrontation.js';
export { Boite } from './boite.js';
import { sonner } from './boite.js';
import {
  ensureChampTables, noterPays, choisirPays, paysEligibles, effectifPays,
  ouvrirNational, ouvrirEchelon, ouvrirCycle, calendrierCycle,
  titresDe, continentDe,
  etatEdition, editionDe, enregistrerCourse, cloturerPhase,
  medaillesDe, paysDe,
  fluxDirect, recapMondial, previsionSalon,
} from './championnats.js';
import {
  ensureRelayTables, creerEquipe, repondre, ordonner, mesEquipes,
  classementRelais, enregistrerRelais, equipe as equipeRelais,
  fantomesRelais, fantomeRelais,
} from './relais.js';

import {
  verifierAcces, creerAcces, revoquerAcces, rendreAcces, listerAcces, estAdmin,
  definirRole,
} from './acces.js';

/**
 * Portes du relais et des championnats.
 *
 * Elles ne sont plus des constantes : ces modes sont ouverts sur le canal de
 * test et fermes en production. Un seul deploiement sert les deux, et c'est le
 * code d'acces presente par l'appelant qui decide de quel cote il se trouve.
 *
 * Le jour ou l'on voudra les ouvrir a tout le monde, il suffira de renvoyer
 * true ici sans condition.
 */
const relaisOuvert = canal => canal.test;
const championnatsOuverts = canal => canal.test;
/**
 * Qui a le droit de piloter un championnat.
 *
 * Ouvrir une edition, ouvrir un cycle entier, clore une phase : ce sont des
 * actes de calendrier, irreversibles et visibles par tout le monde. Ils
 * n'etaient proteges que par le canal de test, c'est-a-dire par n'importe quel
 * code d'invitation — quelqu'un venu essayer une course pouvait sacrer un
 * champion de France depuis la console de son navigateur.
 *
 * L'administrateur passe toujours : il tient la cle, il n'a pas besoin d'un
 * role en plus.
 */
const estOrganisateur = (request, env, canal) =>
  estAdmin(request, env) || canal.role === 'organisateur';
/**
 * Le mot du vainqueur : reserve au canal de test.
 *
 * C'est la seule ecriture du jeu ou un joueur produit un contenu qu'un autre
 * lira, et personne ne la relit. Tant qu'elle n'a pas ete eprouvee entre gens
 * qui se connaissent, la porte reste fermee du cote du serveur — pas seulement
 * dans le jeu. Sans cela, une simple requete a la main suffirait a deposer un
 * message chez n'importe quel joueur de la vraie version.
 *
 * A rouvrir en meme temps que les duels de production, et pas avant.
 */
const motOuvert = canal => canal.test;

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
  // Nos deux en-tetes maison doivent figurer ici, sinon le navigateur bloque
  // la requete AVANT de l'envoyer : un en-tete qui n'est pas « simple »
  // declenche un pre-vol, et le pre-vol refuse ce qui n'est pas annonce.
  //
  // Sans cette ligne, tout le canal de test etait muet depuis un navigateur —
  // et le defaut se cachait bien, la porte d'entree et les WebSockets etant
  // les deux seuls chemins qui n'utilisent pas ces en-tetes.
  resp.headers.set('Access-Control-Allow-Headers',
                   'Content-Type, X-Sprinter-Test, X-Sprinter-Admin');
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
// Les tables sont creees a la demande, et on memorise qu'elles le sont pour
// ne pas repayer un CREATE IF NOT EXISTS a chaque requete. Cette memoire est
// tenue PAR BASE : le worker en sert deux — production et test — et un simple
// booleen mentait a la seconde, qui restait sans tables parce que la premiere
// avait deja eteint la migration.
const scoresReady = new WeakSet();
async function ensureScoreGhost(db) {
  if (scoresReady.has(db)) return;
  // La table des scores a longtemps ete creee a la main, au demarrage du
  // projet : le code ne savait que lui ajouter des colonnes. Cela tenait tant
  // qu'il n'y avait qu'une base — sur une base neuve, chaque route qui la
  // touche echouait sans rien dire, l'ALTER TABLE etant deja avale par le
  // try/catch. On la cree donc ici, comme toutes les autres.
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS scores (
      device_id TEXT NOT NULL,
      race_key TEXT NOT NULL,
      name TEXT NOT NULL,
      time_ms INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      best_split_ms INTEGER NOT NULL DEFAULT 0,
      trace TEXT,
      trace_ms INTEGER,
      PRIMARY KEY (device_id, race_key)
    )`).run();
  } catch (e) { /* deja la */ }
  for (const sql of [
    `ALTER TABLE scores ADD COLUMN trace TEXT`,
    `ALTER TABLE scores ADD COLUMN trace_ms INTEGER`,
  ]) {
    try { await db.prepare(sql).run(); } catch (e) { /* colonne deja presente */ }
  }
  scoresReady.add(db);
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
  // La colonne insta vient de la table des joueurs, et cette table peut ne pas
  // avoir encore recu sa migration. Sans cette ligne, le classement entier
  // repond 500 au premier deploiement — c'est deja arrive avec la colonne des
  // traces, on ne le refait pas.
  await ensurePlayerTables(db);
  const col = by === 'run' ? 'time_ms' : 'best_split_ms';
  const garde = by === 'run'
    ? `time_ms > 0 AND time_ms < ${NO_RUN_MS}`
    : `best_split_ms > 0`;
  const { results } = await db.prepare(
    `SELECT s.rowid AS id, s.name, s.time_ms, s.best_split_ms, s.updated_at,
            MIN(s.${col}) AS _min,
            (s.trace IS NOT NULL AND length(s.trace) > 2) AS has_ghost,
            p.insta AS insta
       FROM scores s
       LEFT JOIN players p ON p.name_key = lower(trim(s.name))
      WHERE s.race_key = ? AND ${garde.replace(/\b(time_ms|best_split_ms)\b/g, 's.$1')}
      GROUP BY lower(trim(s.name))
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
const visitsReady = new WeakSet();
async function ensureVisitTable(db) {
  if (visitsReady.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS visits (
    day TEXT NOT NULL,
    device_id TEXT NOT NULL,
    hits INTEGER NOT NULL DEFAULT 1,
    last_at INTEGER NOT NULL,
    PRIMARY KEY (day, device_id)
  )`).run();
  visitsReady.add(db);
}

// Un defi peut viser quelqu'un en particulier. La colonne est ajoutee apres
// coup sur une table qui existe deja, d'ou la migration paresseuse.
const targetReady = new WeakSet();
async function ensureChallengeTarget(db) {
  if (targetReady.has(db)) return;
  try { await db.prepare(`ALTER TABLE challenges ADD COLUMN target_device TEXT`).run(); }
  catch (e) { /* colonne deja presente */ }
  targetReady.add(db);
}

// Historique des courses. Indexe sur le nom autant que sur l'appareil : c'est
// ce qui permet a un joueur de retrouver ses courses en changeant de
// telephone. Le nom n'est pas authentifie — deux personnes qui choisissent le
// meme verraient donc un historique commun. Compromis assume : c'est deja
// l'identite publique du classement, et l'alternative serait un compte.
const HIST_PER_DEVICE = 300;
const racesReady = new WeakSet();
async function ensureRaceTable(db) {
  if (racesReady.has(db)) return;
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
  racesReady.add(db);
}

// Un nom appartient a quelqu'un, et cet appartenance se prouve par un code
// court. C'est ce qui remplace un compte : pas de tiers, pas d'e-mail, pas
// d'ecran de consentement — juste de quoi relier ses appareils et empecher
// qu'on prenne son nom.
const joueursReady = new WeakSet();
async function ensurePlayerTables(db) {
  if (joueursReady.has(db)) return;
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
  // Le pseudo Instagram arrive apres coup : la table existe deja chez ceux qui
  // ont reserve leur nom.
  try { await db.prepare(`ALTER TABLE players ADD COLUMN insta TEXT`).run(); }
  catch (e) { /* colonne deja presente */ }
  joueursReady.add(db);
}

/**
 * Un pseudo Instagram, nettoye.
 *
 * On accepte ce qu'Instagram accepte — lettres, chiffres, point, tiret bas,
 * trente caracteres — et on retire l'arobase que les gens collent par habitude
 * ainsi qu'une URL complete si elle a ete copiee depuis le navigateur.
 */
function cleanInsta(brut) {
  let s = String(brut || '').trim();
  if (!s) return '';
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  s = s.replace(/[/?#].*$/, '');
  s = s.replace(/^@+/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : null;   // null = saisie refusee
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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }

    // ------------------------------------------------------------- le canal
    //
    // Un seul worker sert deux mondes. Le code d'acces presente par l'appelant
    // decide duquel : sans code valide on est en production, avec on est sur le
    // canal de test, ou tout est ouvert.
    //
    // La verification se fait toujours contre la base de production, qui tient
    // la liste des acces — sans quoi on ne pourrait plus rien verifier apres
    // avoir bascule.
    const production = env.DB;
    const codeDonne = request.headers.get('X-Sprinter-Test')
      || url.searchParams.get('acces') || '';
    const acces = codeDonne && production
      ? await verifierAcces(production, codeDonne, ctx) : null;
    const canal = {
      test: !!acces, nom: acces ? acces.nom : null,
      role: acces ? acces.role : null,
    };

    // Les quatre-vingt-treize routes qui suivent parlent a `env.DB` sans avoir
    // a savoir sur quel canal elles tournent. On leur passe donc un env dont DB
    // pointe deja sur la bonne base : une seule ligne decide, plutot que
    // quatre-vingt-treize occasions d'en oublier une.
    if (canal.test && env.DB_TEST) env = { ...env, DB: env.DB_TEST };

    // ------------------------------------------------------ acces au test
    if (url.pathname.startsWith('/test/')) {
      const sous = url.pathname.slice('/test/'.length);

      // Le code est-il bon ? Le jeu s'en sert pour savoir s'il ouvre sa porte.
      if (sous === 'entrer' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const r = await verifierAcces(production, (body || {}).code, ctx);
        // Le role voyage avec la reponse : c'est ce qui decide si le jeu
        // affiche l'entree du salon des championnats, et il n'y a pas d'autre
        // moment ou le client pourrait l'apprendre.
        return r ? json({ ok: true, nom: r.nom, role: r.role || null })
                 : json({ error: 'code refuse' }, 403);
      }

      // Administration. Sans le secret ADMIN_CLE pose sur le worker, tout ici
      // repond 403 : ferme par defaut plutot qu'ouvert par oubli.
      if (sous.startsWith('admin/')) {
        if (!estAdmin(request, env)) return json({ error: 'refuse' }, 403);
        const quoi = sous.slice('admin/'.length);

        if (quoi === 'liste' && request.method === 'GET') {
          return json({ acces: await listerAcces(production) });
        }
        if (quoi === 'creer' && request.method === 'POST') {
          let body; try { body = await request.json(); } catch { body = {}; }
          // `code` est facultatif : sans lui le serveur en tire un, avec lui
          // on choisit le sien — plus facile a dicter a celui qui le recoit.
          const r = await creerAcces(production, (body || {}).nom, (body || {}).code);
          return r.erreur ? json({ error: r.erreur, ...r }, 400) : json(r);
        }
        if (quoi === 'revoquer' && request.method === 'POST') {
          let body; try { body = await request.json(); } catch { body = {}; }
          const r = await revoquerAcces(production, (body || {}).code);
          return r.erreur ? json({ error: r.erreur }, 400) : json(r);
        }
        if (quoi === 'rendre' && request.method === 'POST') {
          let body; try { body = await request.json(); } catch { body = {}; }
          const r = await rendreAcces(production, (body || {}).code);
          return r.erreur ? json({ error: r.erreur }, 400) : json(r);
        }
        // Le role d'organisateur, donne ou retire. `role: null` retire sans
        // toucher a l'acces lui-meme.
        if (quoi === 'role' && request.method === 'POST') {
          let body; try { body = await request.json(); } catch { body = {}; }
          const r = await definirRole(production, (body || {}).code, (body || {}).role);
          return r.erreur ? json({ error: r.erreur }, 400) : json(r);
        }
      }

      return json({ error: 'not found' }, 404);
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

    // Le pays d'un joueur, vu par Cloudflare sur la requete elle-meme. On le
    // note au passage plutot que de le demander : personne n'a envie de
    // remplir un formulaire pour courir un 100 metres. Le joueur peut le
    // corriger, et son choix ne se fait jamais ecraser.
    const paysVu = (request.cf && request.cf.country) || null;

    if (url.pathname === '/submit' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

      const { device_id, race_key, name, time_ms, best_split_ms, trace } = body || {};
      if (!ALLOWED_RACES.has(race_key)) return json({ error: 'race invalide' }, 400);
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      if (paysVu) await noterPays(env.DB, cleanName(name).trim().toLowerCase(), paysVu);
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

    // ------------------------------------------------------- championnats
    if (url.pathname.startsWith('/champ/')) {
      if (!championnatsOuverts(canal)) {
        return json({ error: 'championnats reserves au canal de test' }, 403);
      }
      const sous = url.pathname.slice('/champ/'.length);

      // Ou en est le monde : quels pays peuvent tenir leur championnat.
      if (sous === 'pays' && request.method === 'GET') {
        return json({ pays: await paysEligibles(env.DB) });
      }

      // Le joueur corrige son pays.
      if (sous === 'pays' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { device_id, name, pays } = body || {};
        if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
        const key = cleanName(name).trim().toLowerCase();
        if (!key || key === 'anonyme') return json({ error: 'nom invalide' }, 400);
        if (!(await peutUtiliser(env.DB, key, device_id))) {
          return json({ error: 'ce nom ne t appartient pas' }, 403);
        }
        const r = await choisirPays(env.DB, key, pays);
        return r.erreur ? json({ error: r.erreur }, 400) : json(r);
      }

      if (sous === 'titres' && request.method === 'GET') {
        const key = String(url.searchParams.get('name') || '').trim().toLowerCase();
        return json({ titres: key ? await titresDe(env.DB, key) : [] });
      }

      // Le salon des championnats : ce que donnerait chaque zone si on
      // l'ouvrait maintenant. Lecture seule, mais reservee aux organisateurs —
      // c'est leur tableau de bord, et il dit qui court ou.
      if (sous === 'salon' && request.method === 'GET') {
        if (!estOrganisateur(request, env, canal)) {
          return json({ error: 'reserve aux organisateurs' }, 403);
        }
        return json(await previsionSalon(env.DB));
      }

      // Ouvrir une edition. Reserve a l'exploitation : c'est un acte de
      // calendrier, pas une action de joueur. Sans `echelon`, on reste sur le
      // national, ce que faisaient les appels existants.
      if (sous === 'ouvrir' && request.method === 'POST') {
        if (!estOrganisateur(request, env, canal)) {
          return json({ error: 'reserve aux organisateurs' }, 403);
        }
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { pays, zone, echelon, debut } = body || {};
        const t = Number(debut);
        if (!Number.isFinite(t)) return json({ error: 'date de debut invalide' }, 400);
        const r = await ouvrirEchelon(env.DB, {
          echelon: echelon || 'national',
          zone: zone || pays || 'MONDE',
          debutSamedi: t,
        });
        return r.erreur ? json({ error: r.erreur, ...r }, 400) : json(r);
      }

      // Le meme weekend pour tout le monde : un seul appel ouvre tout un
      // echelon d'un coup, et dit qui a ete ecarte et pourquoi.
      if (sous === 'cycle' && request.method === 'POST') {
        if (!estOrganisateur(request, env, canal)) {
          return json({ error: 'reserve aux organisateurs' }, 403);
        }
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const t = Number(body && body.debut);
        if (!Number.isFinite(t)) return json({ error: 'date de debut invalide' }, 400);
        return json(await ouvrirCycle(env.DB, {
          debutSamedi: t, echelon: (body && body.echelon) || 'national',
        }));
      }

      // Les trois weekends d'un cycle, deduits du premier.
      if (sous === 'calendrier' && request.method === 'GET') {
        const t = Number(url.searchParams.get('debut'));
        if (!Number.isFinite(t)) return json({ error: 'date de debut invalide' }, 400);
        return json({ cycle: calendrierCycle(t) });
      }

      // La diffusion en direct. `depuis` est le dernier identifiant deja vu :
      // un ecran ouvert tout le weekend redemande la suite, jamais le passe.
      if (sous === 'direct' && request.method === 'GET') {
        const depuis = parseInt(url.searchParams.get('depuis') || '0', 10) || 0;
        const limite = Math.min(200, parseInt(url.searchParams.get('limite') || '50', 10) || 50);
        return json(await fluxDirect(env.DB, {
          zone: url.searchParams.get('zone'), depuis, limite,
        }));
      }

      // Le recapitulatif mondial : qui court, qui vient d'etre sacre.
      if (sous === 'monde' && request.method === 'GET') {
        return json(await recapMondial(env.DB, {
          echelon: url.searchParams.get('echelon') || null,
        }));
      }

      // Mon championnat, s'il y en a un. Le jeu n'a que le nom du joueur.
      if (sous === 'mien' && request.method === 'GET') {
        const key = String(url.searchParams.get('name') || '').trim().toLowerCase();
        const id = key ? await editionDe(env.DB, key) : null;
        return json({ edition: id });
      }

      // L'etat d'une edition : ou elle en est, qui court quoi.
      if (sous.startsWith('edition/') && request.method === 'GET') {
        const id = sous.slice('edition/'.length).toUpperCase();
        const e = await etatEdition(env.DB, id);
        if (!e) return json({ error: 'edition introuvable' }, 404);
        // Le drapeau de chacun : un championnat continental ou mondial n'a
        // aucun sens si l'on ne voit pas d'ou viennent les coureurs.
        const pays = await paysDe(env.DB, e.partants.map(p => p.name_key));
        for (const p of e.partants) p.pays = pays.get(p.name_key) || null;
        return json(e);
      }

      // Les chronos d'une course. On range, on ne tranche pas encore.
      if (sous === 'course' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { edition, phase, course, chronos } = body || {};
        const r = await enregistrerCourse(env.DB, {
          edition: String(edition || '').toUpperCase(), phase,
          course: parseInt(course, 10), chronos,
        });
        return r.erreur ? json({ error: r.erreur, ...r }, 400) : json(r);
      }

      // La cloture d'une phase : c'est elle qui qualifie et qui seme la suite.
      if (sous === 'cloturer' && request.method === 'POST') {
        if (!estOrganisateur(request, env, canal)) {
          return json({ error: 'reserve aux organisateurs' }, 403);
        }
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const r = await cloturerPhase(env.DB, String(body.edition || '').toUpperCase());
        return r.erreur ? json({ error: r.erreur, ...r }, 400) : json(r);
      }

      return json({ error: 'not found' }, 404);
    }

    // ------------------------------------------------------------- relais
    // Les equipes de relais. Le mode n'est pas encore ouvert : la porte se
    // ferme ici AUSSI, pas seulement dans le jeu. Sans cela, une simple
    // requete a la main permettrait de reserver des noms d'equipe avant
    // l'ouverture — et un nom appartient a une composition pour toujours.
    if (url.pathname.startsWith('/relay/')) {
      if (!relaisOuvert(canal)) {
        return json({ error: 'relais reserve au canal de test' }, 403);
      }
      const sous = url.pathname.slice('/relay/'.length);

      if (sous === 'team' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { name, creator, members } = body || {};
        const r = await creerEquipe(env.DB, {
          createur: creator,
          coequipiers: Array.isArray(members) ? members.slice(0, 8) : [],
          nom: name,
        });
        return r.erreur ? json({ error: r.erreur }, 400) : json(r);
      }

      if (sous === 'answer' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { id, name, accept } = body || {};
        const code = String(id || '').toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
        const r = await repondre(env.DB, { id: code, joueur: name, accepte: !!accept });
        return r.erreur ? json({ error: r.erreur }, 400) : json(r);
      }

      if (sous === 'order' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { id, order } = body || {};
        const code = String(id || '').toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
        const r = await ordonner(env.DB, { id: code, ordre: order });
        return r.erreur ? json({ error: r.erreur }, 400) : json(r);
      }

      if (sous === 'score' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
        const { id, race_key, legs, traces } = body || {};
        const code = String(id || '').toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
        const r = await enregistrerRelais(env.DB, { team_id: code, race_key, legs, traces });
        return r.erreur ? json({ error: r.erreur }, 400) : json(r);
      }

      if (sous === 'mine' && request.method === 'GET') {
        return json(await mesEquipes(env.DB, url.searchParams.get('name') || ''));
      }

      // Les courses affrontables en fantome : le haut du classement, et lui
      // seul. Une equipe hors du top garde son chrono mais n'est plus rejouee.
      if (sous === 'ghosts' && request.method === 'GET') {
        const race = url.searchParams.get('race') || '4x100';
        return json({ race, fantomes: await fantomesRelais(env.DB, race) });
      }

      if (sous.startsWith('ghost/') && request.method === 'GET') {
        const n = parseInt(sous.slice('ghost/'.length), 10);
        if (!Number.isInteger(n) || n <= 0) return json({ error: 'identifiant invalide' }, 400);
        const f = await fantomeRelais(env.DB, n);
        return f ? json({ fantome: f }) : json({ error: 'fantome introuvable' }, 404);
      }

      // La salle d'une equipe : quatre joueurs, une piste, un temoin. Comme
      // pour les duels, le Worker n'aiguille que — la course vit dans l'objet.
      if (sous.startsWith('room/')) {
        const reste = sous.slice('room/'.length);
        const [brut, tail] = reste.split('/');
        const code = (brut || '').toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
        if (!env.SALLES_RELAIS) return json({ error: 'relais indisponible' }, 503);
        const cible = new URL(request.url);
        cible.pathname = tail === 'etat' ? '/etat' : '/ws';
        cible.searchParams.set('team', code);
        if (canal.test) cible.searchParams.set('canal', 'test');
        const id = env.SALLES_RELAIS.idFromName((canal.test ? 'RT-' : 'R-') + code);
        const rep = await env.SALLES_RELAIS.get(id).fetch(new Request(cible, request));
        if (rep.status === 101) return rep;
        return cors(new Response(rep.body, { status: rep.status,
          headers: { 'Content-Type': 'application/json' } }));
      }

      // Ouvrir une confrontation : un code, comme une piste de duel.
      if (sous === 'confrontation' && request.method === 'POST') {
        return json({ id: makeCode() });
      }

      // La salle d'une confrontation. Le code de l'equipe voyage avec le
      // joueur : c'est lui qui dit dans quel couloir il court.
      if (sous.startsWith('conf/')) {
        const reste = sous.slice('conf/'.length);
        const [brut, tail] = reste.split('/');
        const code = (brut || '').toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
        if (!env.CONFRONTATIONS) return json({ error: 'confrontations indisponibles' }, 503);
        const cible = new URL(request.url);
        cible.pathname = tail === 'etat' ? '/etat' : '/ws';
        cible.searchParams.set('conf', code);
        if (canal.test) cible.searchParams.set('canal', 'test');
        const id = env.CONFRONTATIONS.idFromName((canal.test ? 'CT-' : 'C-') + code);
        const rep = await env.CONFRONTATIONS.get(id).fetch(new Request(cible, request));
        if (rep.status === 101) return rep;
        return cors(new Response(rep.body, { status: rep.status,
          headers: { 'Content-Type': 'application/json' } }));
      }

      if (sous === 'ranking' && request.method === 'GET') {
        const race = url.searchParams.get('race') || '4x100';
        return json({ race, classement: await classementRelais(env.DB, race) });
      }

      if (sous.startsWith('team/') && request.method === 'GET') {
        const code = sous.slice('team/'.length).toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
        await ensureRelayTables(env.DB);
        const e = await equipeRelais(env.DB, code);
        return e ? json({ equipe: e }) : json({ error: 'equipe introuvable' }, 404);
      }

      return json({ error: 'not found' }, 404);
    }

    // ------------------------------------------------------- la boite
    // La liaison permanente d'un joueur. Elle ne transporte que des coups de
    // sonnette ; le jeu va chercher le courrier par les routes ordinaires —
    // voir boite.js, qui explique pourquoi c'est fait ainsi.
    if (url.pathname.startsWith('/boite/')) {
      const appareil = url.pathname.slice('/boite/'.length);
      if (!isValidDeviceId(appareil)) return json({ error: 'appareil invalide' }, 400);
      if (!env.BOITES) return json({ error: 'boite indisponible' }, 503);
      // Comme pour les salles, la boite d'un joueur de test et celle d'un
      // joueur de production ne sont pas le meme objet.
      const id = env.BOITES.idFromName(canal.test ? 'T-' + appareil : appareil);
      const reponse = await env.BOITES.get(id).fetch(new Request(url, request));
      if (reponse.status === 101) return reponse;
      return cors(new Response(reponse.body, {
        status: reponse.status,
        headers: { 'Content-Type': 'application/json' },
      }));
    }

    // ------------------------------------------------ course en direct
    // Le Worker ne fait qu'aiguiller : toute la vie de la salle se passe dans
    // le Durable Object, seul endroit ou les deux joueurs se rejoignent
    // vraiment. On adresse l'objet par le code, en majuscules, pour que
    // « ab12cd » et « AB12CD » tombent au meme endroit.
    // Ouvrir une salle : on tire un code libre a l'oral, comme pour un defi.
    if (url.pathname === '/live/nouveau' && request.method === 'POST') {
      return json({ id: makeCode() });
    }

    if (url.pathname.startsWith('/live/')) {
      const reste = url.pathname.slice('/live/'.length);
      const [brut, sous] = reste.split('/');
      const code = (brut || '').toUpperCase();
      if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
      if (!env.SALLES) return json({ error: 'direct indisponible' }, 503);

      const cible = new URL(request.url);
      cible.pathname = sous === 'etat' ? '/etat' : '/ws';
      cible.searchParams.set('code', code);
      // Le canal voyage jusqu'a la salle : c'est elle qui ecrit le resultat du
      // duel, et elle doit l'ecrire dans la bonne base.
      if (canal.test) cible.searchParams.set('canal', 'test');

      // Deux salles portant le meme code, une de test et une de production, ne
      // doivent jamais etre le meme objet — sans quoi deux joueurs qui ne se
      // sont rien demande se retrouveraient sur la meme piste.
      const id = env.SALLES.idFromName(canal.test ? 'T-' + code : code);
      const reponse = await env.SALLES.get(id).fetch(new Request(cible, request));
      // Une reponse 101 porte une WebSocket : on la rend telle quelle, sans
      // toucher aux en-tetes, sinon la poignee de main echoue.
      if (reponse.status === 101) return reponse;
      return cors(new Response(reponse.body, {
        status: reponse.status,
        headers: { 'Content-Type': 'application/json' },
      }));
    }

    // -------------------------------------------------- classement des duels
    // Refaire tout le classement depuis l'historique des duels.
    //
    // Rejouable sans risque : chacun repart de son point de depart avant que
    // les rencontres soient rejouees dans l'ordre. C'est ce qui permet de
    // toucher au bareme, au facteur K ou aux seuils de division sans avoir a
    // se demander ce que devient l'existant — on le refait.
    //
    // Sous cle d'administration, et jamais autrement : la route reecrit le
    // classement de tout le monde.
    if (url.pathname === '/duels/recalculer' && request.method === 'POST') {
      if (!estAdmin(request, env)) return json({ error: 'refuse' }, 403);
      return json(await recalculerClassement(env.DB));
    }

    if (url.pathname === '/duels' && request.method === 'GET') {
      await ensureDuelTables(env.DB);
      const nom = (url.searchParams.get('name') || '').trim().toLowerCase();
      const board = await duelBoard(env.DB);

      // Le drapeau et la medaille se posent ici, pas dans duelBoard : le
      // classement des duels ne doit rien savoir des championnats, sans quoi
      // deux systemes qui n'ont aucune raison de se connaitre finiraient
      // enchevetres.
      //
      // Une seule medaille par joueur, la plus prestigieuse — un bronze
      // mondial passe devant un or national. Afficher les trois transformerait
      // le classement en tableau de decorations.
      const cles = board.map(r => r.name.trim().toLowerCase());
      const [pays, medailles] = await Promise.all([
        paysDe(env.DB, cles), medaillesDe(env.DB, cles),
      ]);
      for (const r of board) {
        const k = r.name.trim().toLowerCase();
        r.pays = pays.get(k) || null;
        const m = medailles.get(k);
        if (m) r.medaille = m;
      }

      const moi = nom ? board.find(r => r.name.trim().toLowerCase() === nom) || null : null;
      return json({
        // L'echelle voyage avec le classement : le jeu doit pouvoir dessiner
        // une progression — « il te reste tant avant la division suivante » —
        // sans avoir a recopier des seuils qui changeront.
        echelle: {
          etages: ETAGES, divisions: DIVISIONS,
          legende: LEGENDE, lp_par_palier: LP_PAR_PALIER,
        },
        bareme: { lanceur: LP.lanceur, releveur: LP.releveur },
        classement: board, moi,
      });
    }

    // Le mot du vainqueur, depose apres coup.
    //
    // C'est la seule ecriture du jeu ou un joueur produit du texte qu'un autre
    // lira. Les regles qui l'encadrent vivent dans mot.js et pas ici : elles
    // sont ce qui separe un chambrage entre amis d'une boite a insultes, et
    // elles doivent pouvoir etre relues d'un bloc.
    if (url.pathname === '/duel/mot' && request.method === 'POST') {
      if (!motOuvert(canal)) return json({ error: 'reserve au canal de test' }, 403);
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { id, name, texte, voix, voix_type } = body || {};
      const code = String(id || '').toUpperCase();
      if (!/^[A-Z0-9]{4,10}$/.test(code)) return json({ error: 'code invalide' }, 400);
      const cle = String(name || '').trim().toLowerCase();
      if (!cle) return json({ error: 'nom requis' }, 400);
      await ensureDuelTables(env.DB);
      const r = await poserMot(env.DB, {
        id: code, cle, texte, voix, voixType: voix_type,
      });

      // La sonnette chez le perdant : c'est lui qui recoit le mot, et lui seul.
      //
      // Son appareil n'est pas dans la rencontre — elle ne garde que des noms.
      // On le retrouve du cote ou il se trouve : celui qui a lance le defi est
      // inscrit sur le defi, celui qui l'a releve sur sa tentative.
      if (!r.erreur) ctx.waitUntil((async () => {
        try {
          const d = await env.DB.prepare(
            `SELECT r.outcome, c.owner_device FROM duel_results r
               JOIN challenges c ON c.id = r.challenge_id
              WHERE r.challenge_id = ?`).bind(code).first();
          if (!d || d.outcome === 'draw') return;
          if (d.outcome === 'opponent') {
            // Le releveur l'emporte : le perdant est celui qui a lance.
            await sonner(env, d.owner_device, 'mot', canal.test);
            return;
          }
          const rep = await env.DB.prepare(
            `SELECT device_id FROM challenge_attempts
              WHERE id = ? ORDER BY total_ms ASC LIMIT 1`).bind(code).first();
          if (rep) await sonner(env, rep.device_id, 'mot', canal.test);
        } catch (e) { /* le sondage reste derriere */ }
      })());
      return r.erreur ? json({ error: r.erreur, ...r }, r.deja ? 409 : 403) : json(r);
    }

    // Qui a perdu une rencontre, exprime dans les memes mots que le role.
    // Le mot du vainqueur ne part qu'a lui : c'est la seule verification qui
    // empeche un vainqueur de relire ce qu'il a ecrit, et surtout un tiers de
    // le lire par une requete bien tournee.
    const perdant = r => r.outcome === 'opponent' ? 'challenger'
                       : r.outcome === 'challenger' ? 'opponent' : null;

    // Resultats des defis que J'AI lances. Celui qui releve voit son duel se
    // trancher a l'arrivee ; celui qui a lance, lui, avait deja range son
    // telephone. Sans ce guichet il ne saurait jamais qu'on lui a repondu :
    // il verrait seulement sa ligne bouger au classement, sans savoir qui ni
    // de combien.
    //
    // On filtre sur l'appareil ET sur le nom : l'appareil suffit dans le cas
    // courant, le nom permet de retrouver ses resultats sur un second
    // telephone quand on a reserve son identite.
    if (url.pathname === '/duel/results' && request.method === 'GET') {
      const device_id = url.searchParams.get('device_id') || '';
      const nom = (url.searchParams.get('name') || '').trim().toLowerCase();
      if (!isValidDeviceId(device_id) && !nom) return json({ results: [] });
      await ensureDuelTables(env.DB);
      await ensureChallengeTables(env.DB);

      // Ce que j'apprends apres coup vient desormais des DEUX cotes.
      //
      // Cote lanceur, c'est le resultat lui-meme : j'ai pose mon chrono et je
      // suis parti, on m'a repondu sans moi.
      //
      // Cote releveur, c'est le mot du vainqueur : j'ai vu mon resultat a
      // l'arrivee, mais celui qui m'a battu n'etait pas la pour me le dire —
      // il l'a fait ensuite. On ne remonte donc ces lignes-la que s'il y a
      // vraiment quelque chose a lire ; un duel deja vu, sans un mot, n'a
      // aucune raison de revenir a l'ecran.
      //
      // Et le mot revient MEME SI le resultat a deja ete vu. C'est la
      // troisieme branche, et elle repare une perte silencieuse : le duel se
      // tranche a l'arrivee de celui qui releve, le mot du vainqueur n'est
      // depose qu'ensuite — le temps qu'il apprenne sa victoire et qu'il
      // parle. Le perdant qui avait referme son annonce entre les deux voyait
      // sa ligne marquee « vue », et la voix restait en base jusqu'a ce que
      // personne ne la reclame. On lit donc `mot_vu` la ou on lisait « vu »
      // tout court : le resultat s'annonce une fois, le mot aussi, et les deux
      // n'ont pas a arriver ensemble.
      const { results } = await env.DB.prepare(
        `SELECT r.challenge_id, r.opponent_name, r.opponent_key, r.outcome,
                r.challenger_ms, r.opponent_ms, r.created_at AS created_at,
                r.lp_challenger, r.lp_opponent, r.mot, r.voix, r.voix_type,
                c.races, c.owner_name,
                'challenger' AS role
           FROM duel_results r
           JOIN challenges c ON c.id = r.challenge_id
          WHERE r.seen_by_challenger = 0
            AND (c.owner_device = ? OR (? <> '' AND r.challenger_key = ?))
         UNION ALL
        SELECT r.challenge_id, r.opponent_name, r.opponent_key, r.outcome,
                r.challenger_ms, r.opponent_ms, r.created_at AS created_at,
                r.lp_challenger, r.lp_opponent, r.mot, r.voix, r.voix_type,
                c.races, c.owner_name,
                'challenger' AS role
           FROM duel_results r
           JOIN challenges c ON c.id = r.challenge_id
          WHERE r.seen_by_challenger = 1
            AND r.mot_vu = 0
            AND r.outcome = 'opponent'
            AND (r.mot IS NOT NULL OR r.voix IS NOT NULL)
            AND ? = 1
            AND (c.owner_device = ? OR (? <> '' AND r.challenger_key = ?))
         UNION ALL
        SELECT r.challenge_id, r.opponent_name, r.opponent_key, r.outcome,
                r.challenger_ms, r.opponent_ms, r.created_at AS created_at,
                r.lp_challenger, r.lp_opponent, r.mot, r.voix, r.voix_type,
                c.races, c.owner_name,
                'opponent' AS role
           FROM duel_results r
           JOIN challenges c ON c.id = r.challenge_id
          WHERE r.mot_vu = 0
            AND r.outcome = 'challenger'
            AND (r.mot IS NOT NULL OR r.voix IS NOT NULL)
            AND ? = 1
            AND (? <> '' AND r.opponent_key = ?)
          ORDER BY created_at ASC LIMIT 20`
      ).bind(device_id, nom, nom,
             motOuvert(canal) ? 1 : 0, device_id, nom, nom,
             motOuvert(canal) ? 1 : 0, nom, nom).all();

      return json({
        results: (results || []).map(r => ({
          id: r.challenge_id,
          // Qui je suis dans cette rencontre. Le meme ecran sert les deux
          // roles, et sans cela il ne saurait pas de quel cote lire l'issue.
          role: r.role,
          adversaire: r.role === 'challenger'
            ? (r.opponent_name || r.opponent_key)
            : (r.owner_name || ''),
          // 'challenger' : c'est celui qui a lance qui l'emporte.
          issue: r.outcome,
          lp: r.role === 'challenger' ? (r.lp_challenger ?? 0) : (r.lp_opponent ?? 0),
          mon_ms: r.role === 'challenger' ? r.challenger_ms : r.opponent_ms,
          son_ms: r.role === 'challenger' ? r.opponent_ms : r.challenger_ms,
          // Le mot ne part qu'a celui a qui il est destine : le perdant.
          mot: perdant(r) === r.role ? (r.mot || null) : null,
          voix: perdant(r) === r.role ? (r.voix || null) : null,
          voix_type: perdant(r) === r.role ? (r.voix_type || null) : null,
          races: JSON.parse(r.races || '[]'),
          at: r.created_at,
        })),
      });
    }

    // Accuser reception : un resultat ne s'annonce qu'une fois.
    if (url.pathname === '/duel/results/seen' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name, ids } = body || {};
      const nom = String(name || '').trim().toLowerCase();
      if (!Array.isArray(ids) || !ids.length) return json({ ok: true, n: 0 });
      await ensureDuelTables(env.DB);
      await ensureChallengeTables(env.DB);
      const propres = ids
        .map(v => String(v || '').toUpperCase())
        .filter(v => /^[A-Z0-9]{4,10}$/.test(v))
        .slice(0, 20);
      if (!propres.length) return json({ ok: true, n: 0 });
      const trous = propres.map(() => '?').join(',');
      // La condition de propriete est reprise telle quelle : sans elle,
      // n'importe qui pourrait faire taire les resultats d'un autre.
      const r = await env.DB.prepare(
        `UPDATE duel_results SET seen_by_challenger = 1
          WHERE challenge_id IN (${trous})
            AND seen_by_challenger = 0
            AND challenge_id IN (
              SELECT c.id FROM challenges c
               WHERE c.owner_device = ? OR (? <> '' AND lower(trim(c.owner_name)) = ?))`
      ).bind(...propres, String(device_id || ''), nom, nom).run();

      // Le meme geste, cote releveur : lui aussi ferme une fenetre, et c'est
      // la sienne qui portait le mot du vainqueur.
      const r2 = nom ? await env.DB.prepare(
        `UPDATE duel_results SET seen_by_opponent = 1
          WHERE challenge_id IN (${trous})
            AND seen_by_opponent = 0 AND opponent_key = ?`
      ).bind(...propres, nom).run() : null;

      // LE MOT EST LU, et c'est autre chose qu'avoir vu le resultat.
      //
      // Deux conditions, et la seconde a manque a un premier essai :
      //
      // - on ne marque que celui a qui le mot etait destine : le perdant. Le
      //   vainqueur qui referme SA fenetre n'a rien lu, il vient d'ecrire.
      // - et seulement s'il y avait quelque chose a lire. Sans ce garde-fou,
      //   le perdant qui referme son annonce AVANT que le vainqueur ait parle
      //   marquait le mot comme lu par avance : celui-ci arrivait ensuite dans
      //   une ligne deja soldee, et ne repartait plus jamais. C'est exactement
      //   la perte qu'on cherchait a corriger, reintroduite un cran plus loin.
      await env.DB.prepare(
        `UPDATE duel_results SET mot_vu = 1
          WHERE challenge_id IN (${trous}) AND mot_vu = 0
            AND outcome = 'opponent'
            AND (mot IS NOT NULL OR voix IS NOT NULL)
            AND challenge_id IN (
              SELECT c.id FROM challenges c
               WHERE c.owner_device = ? OR (? <> '' AND lower(trim(c.owner_name)) = ?))`
      ).bind(...propres, String(device_id || ''), nom, nom).run();
      if (nom) {
        await env.DB.prepare(
          `UPDATE duel_results SET mot_vu = 1
            WHERE challenge_id IN (${trous}) AND mot_vu = 0
              AND outcome = 'challenger'
              AND (mot IS NOT NULL OR voix IS NOT NULL)
              AND opponent_key = ?`
        ).bind(...propres, nom).run();
      }

      // LA VOIX S'EFFACE ICI, et nulle part ailleurs.
      //
      // C'est la promesse faite au joueur : ce qu'il a dit disparait quand
      // l'autre a fini de l'ecouter. On l'efface donc au moment ou la fenetre
      // se ferme, pas par une tache de menage qui passerait plus tard — une
      // promesse tenue « d'ici quelques heures » n'est pas la meme promesse.
      //
      // Sur `mot_vu`, et non plus sur « quelqu'un a vu quelque chose ». La
      // condition d'avant effacait la voix des que L'UN DES DEUX refermait sa
      // fenetre — vainqueur compris. Elle detruisait donc l'enregistrement
      // dans le cas le plus ordinaire qui soit : on gagne, on parle, on
      // referme son annonce, et la voix disparait avant que l'autre l'ait
      // entendue. Le perdant ne recevait plus que le texte.
      //
      // Le texte reste : il tient en cent quarante caracteres, il ne coute
      // rien, et le perdant peut vouloir le relire. C'est la voix qui pese et
      // qu'on s'est engage a ne pas garder.
      await env.DB.prepare(
        `UPDATE duel_results SET voix = NULL, voix_type = NULL
          WHERE challenge_id IN (${trous}) AND voix IS NOT NULL AND mot_vu = 1`
      ).bind(...propres).run();

      // On renvoie ce qui a vraiment bascule, pas ce qui a ete demande : une
      // demande portant sur les defis d'autrui ne change rien, et doit le dire.
      const n = ((r && r.meta && r.meta.changes) || 0) +
                ((r2 && r2.meta && r2.meta.changes) || 0);
      return json({ ok: true, n });
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

    // Lier son compte Instagram a son nom de joueur.
    //
    // Ce n'est PAS une connexion : Instagram ne nous dit rien, le joueur
    // declare son pseudo. La seule chose que l'on verifie, c'est que celui qui
    // le declare a bien le droit d'ecrire sous ce nom — sinon n'importe qui
    // pourrait accrocher le compte de quelqu'un d'autre a son propre chrono.
    if (url.pathname === '/profil' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
      const { device_id, name, insta } = body || {};
      if (!isValidDeviceId(device_id)) return json({ error: 'device_id invalide' }, 400);
      const key = cleanName(name).trim().toLowerCase();
      if (!key || key === 'anonyme') return json({ error: 'nom invalide' }, 400);

      const propre = cleanInsta(insta);
      if (propre === null) return json({ error: 'pseudo invalide' }, 400);

      await ensurePlayerTables(env.DB);
      if (!(await peutUtiliser(env.DB, key, device_id))) {
        return json({ error: 'ce nom ne t appartient pas' }, 403);
      }
      const p = await env.DB.prepare(
        `SELECT name_key FROM players WHERE name_key = ?`).bind(key).first();
      if (!p) return json({ error: 'reserve d abord ton nom' }, 409);

      await env.DB.prepare(`UPDATE players SET insta = ? WHERE name_key = ?`)
        .bind(propre || null, key).run();
      return json({ ok: true, insta: propre || null });
    }

    if (url.pathname === '/profil' && request.method === 'GET') {
      const key = String(url.searchParams.get('name') || '').trim().toLowerCase();
      if (!key) return json({ insta: null });
      await ensurePlayerTables(env.DB);
      const p = await env.DB.prepare(
        `SELECT insta FROM players WHERE name_key = ?`).bind(key).first();
      return json({ insta: (p && p.insta) || null });
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
              target_score_id, revanche_de } = body || {};
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

      /* ------------------------------------------------------- la revanche
         Un defi qui repart CHEZ CELUI QUI VIENT DE NOUS BATTRE, sans code a
         recopier. On ne passe pas par le TOP 500 comme ailleurs : la personne
         peut ne pas y figurer sur cette epreuve, et surtout on la connait
         deja — elle est l'autre partie d'une rencontre qui vient d'avoir
         lieu. On repart donc du duel lui-meme, ou les deux appareils sont
         inscrits.

         Deux conditions, et elles ne sont pas decoratives :

         1. SEUL LE PERDANT prend sa revanche. Sans cela, l'identifiant d'un
            duel — qui circule des deux cotes — suffirait a s'adresser a
            n'importe qui.
         2. IL FAUT AVOIR BATTU SON CHRONO. C'est la regle du jeu : on ne
            derange pas quelqu'un avec un temps moins bon que le sien. Le jeu
            la tient deja a l'ecran ; le serveur la tient aussi, parce qu'une
            regle qui ne vit que dans l'ecran n'est pas une regle. */
      const duelRef = String(revanche_de || '').toUpperCase();
      if (!target && /^[A-Z0-9]{4,10}$/.test(duelRef)) {
        await ensureDuelTables(env.DB);
        const d = await env.DB.prepare(
          `SELECT r.outcome, r.challenger_ms, r.opponent_ms, r.opponent_key, r.opponent_name,
                  c.owner_device, c.owner_name
             FROM duel_results r JOIN challenges c ON c.id = r.challenge_id
            WHERE r.challenge_id = ?`
        ).bind(duelRef).first();
        if (d && d.outcome !== 'draw') {
          // L'appareil de celui qui a releve : la rencontre ne garde que son
          // nom, sa tentative garde son appareil.
          const rep = await env.DB.prepare(
            `SELECT device_id, name FROM challenge_attempts
              WHERE id = ? ORDER BY total_ms ASC LIMIT 1`
          ).bind(duelRef).first();

          const moiCle = cleanName(name).trim().toLowerCase();
          const suisLanceur = d.owner_device === device_id ||
            (!!moiCle && String(d.owner_name || '').trim().toLowerCase() === moiCle);
          const suisReleveur = (!!rep && rep.device_id === device_id) ||
            (!!moiCle && String(d.opponent_key || '') === moiCle);
          const monRole = suisLanceur ? 'challenger' : suisReleveur ? 'opponent' : null;
          const perdant = d.outcome === 'opponent' ? 'challenger' : 'opponent';
          // Le chrono du vainqueur, celui qu'il fallait battre.
          const aBattre = d.outcome === 'opponent' ? d.opponent_ms : d.challenger_ms;

          if (monRole && monRole === perdant && t < aBattre) {
            const cible = suisLanceur ? (rep ? rep.device_id : null) : d.owner_device;
            const cibleNom = suisLanceur
              ? (d.opponent_name || (rep && rep.name) || '')
              : (d.owner_name || '');
            if (cible && cible !== device_id) { target = cible; targetName = cibleNom; }
          }
        }
      }

      const id = makeCode();
      await env.DB.prepare(
        `INSERT INTO challenges (id, created_at, owner_device, owner_name, races, level_idx, total_ms, splits, traces, target_device)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, Date.now(), device_id, cleanName(name), JSON.stringify(races),
             lvl, t, JSON.stringify(cleanSplits), JSON.stringify(cleanedTraces), target).run();
      // On enregistre le lanceur des maintenant, pour tenir son compteur de
      // defis envoyes ; il n'entrera au classement qu'une fois un duel joue.
      const lanceurKey = cleanName(name).trim().toLowerCase();
      if (lanceurKey) await compterLance(env.DB, lanceurKey, cleanName(name));
      // La sonnette chez celui qui est vise. Sans elle, il ne l'apprendrait
      // qu'au prochain sondage — vingt secondes plus tard, et seulement s'il
      // se trouve sur un ecran calme.
      if (target) ctx.waitUntil(sonner(env, target, 'defi', canal.test));
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
      await ensureDuelTables(env.DB);
      const ch = await env.DB.prepare(
        `SELECT owner_name, owner_device, total_ms FROM challenges WHERE id = ?`
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
      // --- resolution du duel ------------------------------------------
      // Le premier resultat fait foi : un defi ne se rejoue pas, et une
      // seconde tentative ne redistribue donc aucun point. Le bareme vit dans
      // duels.js, partage avec la course en direct.
      const duel = await appliquerDuel(env.DB, {
        id: code,
        challengerName: ch.owner_name,
        opponentName: cleanName(name),
        challengerMs: ch.total_ms,
        opponentMs: t,
      });
      if (duel && !duel.deja) duel.role = 'opponent';   // point de vue du repondant

      // Celui qui a lance le defi n'est pas la : c'est tout l'objet de sa
      // boite. Il l'apprend maintenant plutot qu'au sondage suivant.
      if (duel && !duel.deja && ch.owner_device) {
        ctx.waitUntil(sonner(env, ch.owner_device, 'duel', canal.test));
      }

      return json({
        id: code,
        owner_name: ch.owner_name,
        owner_total_ms: ch.total_ms,
        your_total_ms: prev && prev.total_ms < t ? prev.total_ms : t,
        attempts: await attemptsFor(env.DB, code),
        duel,
      });
    }

    return json({ error: 'not found' }, 404);
  },
};
