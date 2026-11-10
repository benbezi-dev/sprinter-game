/* ---------------------------------------------------------------------------
   NOEL 2026 — LA BATAILLE DE BOULES DE NEIGE ET L'ETOILE DU SAPIN
   (decide par l'auteur le 10/11/2026).

   Un battle royale de fantomes au 60 m (100 m a l'origine, passe au 60 m par l'auteur le 10/11). Le but : battre le plus de fantomes
   adverses possible. Kin et Barnabe courent 0,3 s plus vite que le troisieme
   (9,92 / 9,93 contre 10,22 au 100 m le 10/11 ; ecarts a remesurer au 60 m) : contre un fantome qui ne bouge pas,
   personne ne les battrait jamais. Toute la regle sert a ce que PERSONNE NE
   SOIT A L'ABRI.

   TON FANTOME, C'EST TA DERNIERE COURSE, pas ta meilleure. On ne s'assoit pas
   sur un chrono : chaque course remplace le fantome, bonne ou mauvaise.

   LES BOULES DE NEIGE. Chaque fantome battu en rapporte une (et un point). On
   la lance sur le fantome de QUI ON VEUT : chaque boule le ralentit de
   `NEIGE_PCT` pendant `NEIGE_DUREE_MS`, cumulable jusqu'a `NEIGE_MAX`. La
   communaute fait tomber les rois. La victime secoue la neige en recourant —
   mais son fantome devient alors cette course-la : c'est la fenetre de tir.
   Chacun entre avec `BOULES_DEPART` boules, pour agir des la premiere minute.

   L'ETOILE DU SAPIN. Il n'y en a qu'une. Celui qui la tient est la cible de
   tout le jeu : battre son fantome la lui prend. Elle PESE : `ETOILE_PCT_H`
   de plus par heure tenue, jusqu'a `ETOILE_MAX`, et recourir n'y change rien
   (seule la neige se secoue). Kin a 9,92 tombe donc forcement : vers 10,22
   apres six heures, a portee de la mediane apres seize — et bien avant si on
   l'enneige. Elle rapporte un point par `TENUE_POINT_MS` tenu, et `VOL_POINTS`
   a qui la vole.

   UN FANTOME NE RAPPORTE QU'UNE FOIS PAR VERSION : battre dix fois la meme
   course d'un debutant ne vaut qu'un point et une boule. Des qu'il recourt,
   son nouveau fantome redevient une proie.

   LA PREUVE EST LA TRACE, comme au duel des marques (verifierTrace, plancher).

   Les dates : ouvert en permanence sur le canal de test ; sur la production,
   seulement de `DEBUT_PROD` a `DEBUT_PROD + DUREE_MS`. Tant que `DEBUT_PROD`
   est nul, la production refuse tout. La meme date est posee cote jeu
   (vite.config.ts, LANCEMENT_NOEL) : les deux bougent ensemble.
--------------------------------------------------------------------------- */
import { verifierTrace } from './preuve.js';
import { MESSAGE_PLANCHER, sousLePlancher } from './plancher.js';

export const EVENEMENT = 'noel-2026';
export const EPREUVE = '60';

/** Une boule de neige : +0,5 % sur le chrono du fantome touche. */
export const NEIGE_PCT = 0.005;
/** Elle fond en vingt-quatre heures. */
export const NEIGE_DUREE_MS = 24 * 3600 * 1000;
/** Au plus vingt boules actives sur un meme fantome (+10 %). */
export const NEIGE_MAX = 20;
/** Les boules qu'on a en entrant. */
export const BOULES_DEPART = 3;
/** L'etoile pese : +0,5 % par heure tenue... */
export const ETOILE_PCT_H = 0.005;
/** ...jusqu'a +15 % (trente heures). */
export const ETOILE_MAX = 0.15;
/** Un point par quart d'heure d'etoile. */
export const TENUE_POINT_MS = 15 * 60 * 1000;
/** Ce que vaut un vol d'etoile. */
export const VOL_POINTS = 5;
/** Une sonnerie « on t'enneige » au plus par heure et par joueur. */
const SONNERIE_NEIGE_MS = 3600 * 1000;
/** Les dernieres lignes du fil rendues avec le tableau. */
const FIL_N = 30;

/** Ouverture publique, en ms UTC ; null = ferme en production. A fixer par
 *  l'auteur, en meme temps que LANCEMENT_NOEL dans vite.config.ts. */
export const DEBUT_PROD = Date.parse('2026-12-01T00:00:00+01:00'); // 1er dec, minuit a Paris
export const DUREE_MS = 25 * 24 * 3600 * 1000; // jusqu'au 25 dec a minuit (inclus)

/** L'evenement est-il ouvert sur ce canal, maintenant ? */
export function fenetre(canalTest, maintenant = Date.now()) {
  if (canalTest) return { ouvert: true, debut: null, fin: null };
  if (DEBUT_PROD == null) return { ouvert: false, debut: null, fin: null };
  const fin = DEBUT_PROD + DUREE_MS;
  return { ouvert: maintenant >= DEBUT_PROD && maintenant < fin, debut: DEBUT_PROD, fin };
}

/* ------------------------------------------------------------- le poids */

/** Le poids de l'etoile apres `tenueMs` : 0 a 0,15. */
export function poidsEtoile(tenueMs) {
  return Math.min(ETOILE_MAX, Math.max(0, tenueMs) / 3_600_000 * ETOILE_PCT_H);
}

/**
 * Le facteur qui s'applique au fantome : la neige ET l'etoile, multipliees.
 * Le jeu etire la trace de ce facteur ; le serveur juge contre ms × facteur.
 */
export function facteur({ neige = 0, etoileDepuis = null, maintenant = Date.now() }) {
  const n = Math.min(NEIGE_MAX, Math.max(0, neige));
  const e = etoileDepuis == null ? 0 : poidsEtoile(maintenant - etoileDepuis);
  return (1 + n * NEIGE_PCT) * (1 + e);
}

/* ------------------------------------------------------------- les tables */

const pret = new WeakSet();
export async function ensureNoelTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    // Un joueur : son fantome (la DERNIERE course), ses boules, son score.
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_joueurs (
      evenement TEXT NOT NULL,
      name_key TEXT NOT NULL,
      name TEXT NOT NULL,
      ms INTEGER NOT NULL,
      trace TEXT NOT NULL,
      version INTEGER NOT NULL,
      courses INTEGER NOT NULL DEFAULT 0,
      boules INTEGER NOT NULL DEFAULT 0,
      battus INTEGER NOT NULL DEFAULT 0,
      vols INTEGER NOT NULL DEFAULT 0,
      tenue_ms INTEGER NOT NULL DEFAULT 0,
      lances INTEGER NOT NULL DEFAULT 0,
      sonne_neige INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (evenement, name_key)
    )`),
    // Une boule lancee : sur qui, par qui, quand. Active vingt-quatre heures.
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_neige (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evenement TEXT NOT NULL,
      cible_key TEXT NOT NULL,
      lanceur_key TEXT NOT NULL,
      quand INTEGER NOT NULL
    )`),
    // Qui a deja battu quelle version de quel fantome.
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_battus (
      evenement TEXT NOT NULL,
      chasseur_key TEXT NOT NULL,
      cible_key TEXT NOT NULL,
      version INTEGER NOT NULL,
      PRIMARY KEY (evenement, chasseur_key, cible_key, version)
    )`),
    // L'etoile : une ligne par evenement, ou aucune tant que personne n'a couru.
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_etoile (
      evenement TEXT PRIMARY KEY,
      tenant_key TEXT NOT NULL,
      tenant_name TEXT NOT NULL,
      depuis INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_fil (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evenement TEXT NOT NULL,
      quand INTEGER NOT NULL,
      genre TEXT NOT NULL,
      a_name TEXT NOT NULL,
      b_name TEXT,
      n INTEGER,
      ms INTEGER
    )`),
  ]);
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_noel_neige ON noel_neige(evenement, cible_key, quand)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_noel_fil ON noel_fil(evenement, id)`).run();
  pret.add(db);
}

async function auFil(db, { genre, a, b = null, n = null, ms = null, maintenant = Date.now() }) {
  try {
    await db.prepare(
      `INSERT INTO noel_fil (evenement, quand, genre, a_name, b_name, n, ms) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(EVENEMENT, maintenant, genre, a, b, n, ms).run();
  } catch (e) { /* le fil se tait, la course compte quand meme */ }
}

const joueur = (db, key) => db.prepare(
  `SELECT * FROM noel_joueurs WHERE evenement = ? AND name_key = ?`
).bind(EVENEMENT, key).first();

const etoile = (db) => db.prepare(
  `SELECT tenant_key, tenant_name, depuis FROM noel_etoile WHERE evenement = ?`
).bind(EVENEMENT).first();

async function neigeSur(db, key, maintenant) {
  const r = await db.prepare(
    `SELECT COUNT(*) AS n FROM noel_neige WHERE evenement = ? AND cible_key = ? AND quand > ?`
  ).bind(EVENEMENT, key, maintenant - NEIGE_DUREE_MS).first();
  return Math.min(NEIGE_MAX, (r && r.n) || 0);
}

/** Le chrono a battre de ce fantome, maintenant : ms × neige × etoile. */
async function aBattre(db, j, maintenant) {
  const neige = await neigeSur(db, j.name_key, maintenant);
  const e = await etoile(db);
  const depuis = e && e.tenant_key === j.name_key ? e.depuis : null;
  const f = facteur({ neige, etoileDepuis: depuis, maintenant });
  return { ms: Math.round(j.ms * f), facteur: f, neige, etoile: depuis != null };
}

/* ------------------------------------------------------------- le fantome */

/** Le fantome d'un joueur, avec ce qui le ralentit maintenant. */
export async function fantome(db, { cibleKey, maintenant = Date.now() }) {
  await ensureNoelTables(db);
  const j = await joueur(db, cibleKey);
  if (!j) return { status: 404, corps: { error: 'pas de fantome' } };
  let trace = [];
  try { trace = JSON.parse(j.trace || '[]'); } catch (e) { trace = []; }
  if (!Array.isArray(trace) || trace.length < 2) return { status: 404, corps: { error: 'pas de fantome' } };
  const b = await aBattre(db, j, maintenant);
  return {
    status: 200,
    corps: { name: j.name, ms: j.ms, a_battre_ms: b.ms, facteur: b.facteur, neige: b.neige, etoile: b.etoile, version: j.version, trace },
  };
}

/* ------------------------------------------------------------- la course */

/**
 * Une course de Noel vient de finir. Elle devient le fantome du joueur (meme
 * plus lente : c'est la regle), secoue la neige qu'il portait, et si elle
 * visait un fantome, se juge contre lui TEL QU'IL ETAIT avant cette course.
 *
 * Battre la cible : un point et une boule, une fois par version de son
 * fantome. Si la cible tenait l'etoile, l'etoile change de main.
 */
export async function noterCourse(db, { nameKey, name, epreuve, timeMs, trace, cibleKey = null, deviceId = null, maintenant = Date.now() }) {
  if (epreuve !== EPREUVE) return { status: 200, corps: { ok: false, raison: 'autre epreuve' } };
  const griefs = verifierTrace(trace, timeMs, epreuve);
  if (griefs.length) return { status: 422, corps: { error: 'trace refusee', griefs } };
  if (sousLePlancher(epreuve, timeMs)) return { status: 400, corps: { error: MESSAGE_PLANCHER } };
  await ensureNoelTables(db);

  // 1. Le verdict d'abord, contre la cible telle qu'elle est AVANT tout le reste.
  let duel = null;
  if (cibleKey && cibleKey !== nameKey) {
    const c = await joueur(db, cibleKey);
    if (c) {
      const b = await aBattre(db, c, maintenant);
      duel = { cible: c.name, cible_ms: b.ms, gagne: timeMs < b.ms, nouveau: false, etoile: false, boule: false };
    }
  }

  // 2. La course devient le fantome. Une entree donne ses premieres boules.
  const avant = await joueur(db, nameKey);
  const neigeAvant = avant ? await neigeSur(db, nameKey, maintenant) : 0;
  await db.prepare(
    `INSERT INTO noel_joueurs (evenement, name_key, name, ms, trace, version, courses, boules)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(evenement, name_key) DO UPDATE SET
       name = excluded.name, ms = excluded.ms, trace = excluded.trace,
       version = excluded.version, courses = courses + 1`
  ).bind(EVENEMENT, nameKey, name, timeMs, JSON.stringify(trace), maintenant, BOULES_DEPART).run();
  if (!avant) await auFil(db, { genre: 'entree', a: name, ms: timeMs, maintenant });
  // Recourir secoue la neige. Les boules lancees sur l'ancien fantome sont perdues.
  if (neigeAvant) {
    await db.prepare(`DELETE FROM noel_neige WHERE evenement = ? AND cible_key = ?`).bind(EVENEMENT, nameKey).run();
    await auFil(db, { genre: 'secoue', a: name, n: neigeAvant, ms: timeMs, maintenant });
  }

  // 3. Personne n'a l'etoile : la premiere course l'allume.
  let e = await etoile(db);
  let etoileAllumee = false;
  if (!e) {
    const r = await db.prepare(
      `INSERT INTO noel_etoile (evenement, tenant_key, tenant_name, depuis) VALUES (?, ?, ?, ?)
       ON CONFLICT(evenement) DO NOTHING`
    ).bind(EVENEMENT, nameKey, name, maintenant).run();
    if (changes(r)) { etoileAllumee = true; await auFil(db, { genre: 'allume', a: name, maintenant }); }
    e = await etoile(db);
  }

  // 4. La cible battue.
  let volA = null;
  if (duel && duel.gagne) {
    const c = await joueur(db, cibleKey);
    const r = await db.prepare(
      `INSERT INTO noel_battus (evenement, chasseur_key, cible_key, version) VALUES (?, ?, ?, ?)
       ON CONFLICT DO NOTHING`
    ).bind(EVENEMENT, nameKey, cibleKey, c.version).run();
    if (changes(r)) {
      duel.nouveau = true; duel.boule = true;
      await db.prepare(
        `UPDATE noel_joueurs SET battus = battus + 1, boules = boules + 1 WHERE evenement = ? AND name_key = ?`
      ).bind(EVENEMENT, nameKey).run();
    }
    // L'etoile change de main — a condition que la cible la tienne ENCORE :
    // deux voleurs a la meme seconde, un seul l'emporte.
    if (e && e.tenant_key === cibleKey) {
      const v = await db.prepare(
        `UPDATE noel_etoile SET tenant_key = ?, tenant_name = ?, depuis = ? WHERE evenement = ? AND tenant_key = ?`
      ).bind(nameKey, name, maintenant, EVENEMENT, cibleKey).run();
      if (changes(v)) {
        duel.etoile = true;
        await db.batch([
          db.prepare(`UPDATE noel_joueurs SET tenue_ms = tenue_ms + ? WHERE evenement = ? AND name_key = ?`)
            .bind(maintenant - e.depuis, EVENEMENT, cibleKey),
          db.prepare(`UPDATE noel_joueurs SET vols = vols + 1 WHERE evenement = ? AND name_key = ?`)
            .bind(EVENEMENT, nameKey),
        ]);
        await auFil(db, { genre: 'vol', a: name, b: c.name, ms: timeMs, maintenant });
        volA = cibleKey;
      }
    }
    if (!duel.etoile && duel.nouveau) await auFil(db, { genre: 'battu', a: name, b: c.name, ms: timeMs, maintenant });
  }

  const moi = await joueur(db, nameKey);
  return {
    status: 200,
    corps: { ok: true, ms: timeMs, boules: moi.boules, secoue: neigeAvant, etoile_allumee: etoileAllumee, duel },
    // pour index.js : qui prevenir que son etoile vient de partir
    sonner: volA ? { genre: 'noel_etoile', pour: volA } : null,
  };
}

const changes = (r) => {
  const n = r && (r.meta ? r.meta.changes : r.changes);
  return n == null ? 1 : n;
};

/* ------------------------------------------------------------- la boule */

/**
 * Lancer `n` boules sur le fantome de `cibleKey`. Pas sur soi, pas sur un
 * joueur sans fantome, jamais plus que ce qu'on a, et la cible n'en porte
 * jamais plus que NEIGE_MAX : le surplus reste dans la poche du lanceur.
 */
export async function lancer(db, { nameKey, name, cibleKey, n = 1, maintenant = Date.now() }) {
  await ensureNoelTables(db);
  n = Math.floor(Number(n));
  if (!Number.isFinite(n) || n < 1) return { status: 400, corps: { error: 'nombre invalide' } };
  if (!cibleKey || cibleKey === nameKey) return { status: 400, corps: { error: 'pas sur toi' } };
  const moi = await joueur(db, nameKey);
  if (!moi) return { status: 409, corps: { error: 'cours d abord' } };
  const c = await joueur(db, cibleKey);
  if (!c) return { status: 404, corps: { error: 'pas de fantome' } };
  const deja = await neigeSur(db, cibleKey, maintenant);
  const place = NEIGE_MAX - deja;
  if (place <= 0) return { status: 409, corps: { error: 'deja couvert de neige', neige: deja } };
  n = Math.min(n, place, moi.boules);
  if (n < 1) return { status: 409, corps: { error: 'plus de boules', boules: moi.boules } };
  // Le stock d'abord, sous condition : deux lancers simultanes ne depensent
  // pas deux fois la meme boule.
  const r = await db.prepare(
    `UPDATE noel_joueurs SET boules = boules - ?, lances = lances + ?
     WHERE evenement = ? AND name_key = ? AND boules >= ?`
  ).bind(n, n, EVENEMENT, nameKey, n).run();
  if (!changes(r)) return { status: 409, corps: { error: 'plus de boules' } };
  const ins = [];
  for (let i = 0; i < n; i++) {
    ins.push(db.prepare(`INSERT INTO noel_neige (evenement, cible_key, lanceur_key, quand) VALUES (?, ?, ?, ?)`)
      .bind(EVENEMENT, cibleKey, nameKey, maintenant));
  }
  await db.batch(ins);
  await auFil(db, { genre: 'neige', a: name, b: c.name, n, maintenant });
  const b = await aBattre(db, c, maintenant);
  // Une sonnerie par heure au plus, pour ne pas faire fuir la cible.
  const s = await db.prepare(
    `UPDATE noel_joueurs SET sonne_neige = ? WHERE evenement = ? AND name_key = ? AND sonne_neige <= ?`
  ).bind(maintenant, EVENEMENT, cibleKey, maintenant - SONNERIE_NEIGE_MS).run();
  return {
    status: 200,
    corps: { ok: true, lancees: n, boules: moi.boules - n, cible: c.name, neige: b.neige, a_battre_ms: b.ms },
    sonner: changes(s) ? { genre: 'noel_neige', pour: cibleKey } : null,
  };
}

/* ------------------------------------------------------------- le tableau */

/** Les points : fantomes battus + etoile tenue (un par quart d'heure) + vols. */
export function points({ battus = 0, vols = 0, tenue_ms = 0 }) {
  return battus + vols * VOL_POINTS + Math.floor(tenue_ms / TENUE_POINT_MS);
}

/**
 * Tout ce que l'ecran montre : l'etoile et son chrono a battre, l'arene (tous
 * les fantomes, du plus dur au plus tendre a battre maintenant), le classement
 * aux points, le fil, et la ligne du joueur qui demande.
 */
export async function tableau(db, { nameKey = null, maintenant = Date.now() }) {
  await ensureNoelTables(db);
  const { results: js } = await db.prepare(
    `SELECT name_key, name, ms, version, courses, boules, battus, vols, tenue_ms, lances
       FROM noel_joueurs WHERE evenement = ?`
  ).bind(EVENEMENT).all();
  const { results: neiges } = await db.prepare(
    `SELECT cible_key, COUNT(*) AS n FROM noel_neige WHERE evenement = ? AND quand > ? GROUP BY cible_key`
  ).bind(EVENEMENT, maintenant - NEIGE_DUREE_MS).all();
  const neige = new Map(neiges.map(x => [x.cible_key, Math.min(NEIGE_MAX, x.n)]));
  const e = await etoile(db);
  let mesBattus = new Set();
  if (nameKey) {
    const { results } = await db.prepare(
      `SELECT cible_key, version FROM noel_battus WHERE evenement = ? AND chasseur_key = ?`
    ).bind(EVENEMENT, nameKey).all();
    mesBattus = new Set(results.map(r => r.cible_key + '|' + r.version));
  }

  const lignes = js.map(j => {
    const tient = !!e && e.tenant_key === j.name_key;
    const n = neige.get(j.name_key) || 0;
    const f = facteur({ neige: n, etoileDepuis: tient ? e.depuis : null, maintenant });
    const tenue = j.tenue_ms + (tient ? maintenant - e.depuis : 0);
    return {
      key: j.name_key, name: j.name, ms: j.ms, a_battre_ms: Math.round(j.ms * f), neige: n, etoile: tient,
      battus: j.battus, vols: j.vols, tenue_ms: tenue, points: points({ ...j, tenue_ms: tenue }),
      deja_battu: mesBattus.has(j.name_key + '|' + j.version),
    };
  });
  const arene = [...lignes].sort((a, b) => a.a_battre_ms - b.a_battre_ms);
  const classement = [...lignes].sort((a, b) => b.points - a.points || a.ms - b.ms);

  const { results: fil } = await db.prepare(
    `SELECT quand, genre, a_name, b_name, n, ms FROM noel_fil WHERE evenement = ? ORDER BY id DESC LIMIT ${FIL_N}`
  ).bind(EVENEMENT).all();

  let moi = null;
  if (nameKey) {
    const j = js.find(x => x.name_key === nameKey);
    const l = lignes.find(x => x.key === nameKey);
    if (j && l) {
      moi = { ...l, boules: j.boules, lances: j.lances, courses: j.courses,
              rang: classement.findIndex(x => x.key === nameKey) + 1 };
    }
  }

  let et = null;
  if (e) {
    const l = lignes.find(x => x.key === e.tenant_key);
    et = { name: e.tenant_name, key: e.tenant_key, depuis: e.depuis, tenue_ms: maintenant - e.depuis,
           poids: poidsEtoile(maintenant - e.depuis), ms: l ? l.ms : null,
           a_battre_ms: l ? l.a_battre_ms : null, neige: l ? l.neige : 0 };
  }

  return {
    evenement: EVENEMENT, epreuve: EPREUVE, maintenant,
    regles: { neige_pct: NEIGE_PCT, neige_duree_ms: NEIGE_DUREE_MS, neige_max: NEIGE_MAX,
              etoile_pct_h: ETOILE_PCT_H, etoile_max: ETOILE_MAX, tenue_point_ms: TENUE_POINT_MS,
              vol_points: VOL_POINTS, boules_depart: BOULES_DEPART },
    etoile: et, moi, arene, classement: classement.slice(0, 100),
    fil: fil.map(f => ({ quand: f.quand, genre: f.genre, a: f.a_name, b: f.b_name, n: f.n, ms: f.ms })),
  };
}
