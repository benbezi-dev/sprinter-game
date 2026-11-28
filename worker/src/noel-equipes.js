/* ---------------------------------------------------------------------------
   NOEL 2026 — LES QUATRE EQUIPES (decide par l'auteur le 23/11/2026).
   Remplace la bataille chacun pour soi de noel.js (fermee en production).

   LES CHEFS. Les 8 premiers du classement du 60 m (photo prise a l'ouverture
   du vote) sont candidats ; chaque appareil vote pour un candidat ; les 4 plus
   votes sont chefs. Egalite a la frontiere de la 4e place : les ex-aequo se
   departagent au 200 m en salle (meilleur chrono du jour de departage ; qui ne
   court pas passe apres, puis le rang au 60 m).

   LES EQUIPES. Chaque chef ouvre la sienne. LE JOUEUR CHOISIT SON EQUIPE (son
   clan, cote jeu : src/game/noel-clans.ts) parmi les actives, et ce choix est
   DEFINITIF — l'auteur, 28/11 : « un choix definitif ». Un second choix est
   refuse (409). Sans choix (une version de l'appli d'avant le choix, ou une
   course courue avant d'avoir choisi), l'arrivant va dans l'equipe active la
   moins nombreuse, comme avant.

   LES POINTS, par manche (remis a zero a chaque manche — auteur, 23/11) :
   - le barème FFA (IA 40 … D7 2) du MEILLEUR 60 m du jour de chaque joueur,
     verse a son equipe ;
   - un duel contre le fantome d'un joueur d'une autre equipe : le battre
     rapporte DUEL_POINTS a ton equipe ; s'il te bat, son equipe gagne
     DEFENSE_POINTS — c'est ainsi que les absents participent. Une fois par
     paire et par jour.

   LA BATTLE ROYALE. A la fin des manches 1 et 2, l'equipe active la plus
   faible de la manche est eliminee ; ses joueurs sont repartis dans les
   equipes restantes, toujours vers la moins nombreuse. La manche 3 est la
   finale. Le championnat de France (19-20/12) est une pause : rien ne compte.

   RIEN N'EST PROGRAMME : chaque requete regle d'abord les etapes dont l'heure
   est passee (`regler`), une seule fois chacune (table noel_eq_etapes, ecrite
   dans le meme lot que ses effets).

   LES DATES. En production : ouvert TOUT SEUL a l'ouverture du vote, le
   7/12 a minuit (heure de Paris), jusqu'a la fermeture du palmares le 1/1
   (auteur, 28/11 : « ouvre-le automatiquement le jour du 7/12 comme prevu »).
   Avant, l'evenement est muet (404). Le jeu tient la meme date
   (src/game/canal.ts, NOEL_EQUIPES_OUVERT) : les deux bougent ensemble. Sur le
   canal de test, on vit le meme calendrier decale : POST /noel-equipes/horloge
   (admin) pose la date simulee.
--------------------------------------------------------------------------- */
import { verifierTrace } from './preuve.js';
import { MESSAGE_PLANCHER, sousLePlancher } from './plancher.js';

export const EVENEMENT = 'noel-equipes-2026';
const evenementDe = test => test ? `${EVENEMENT}-test` : EVENEMENT;

const P = s => Date.parse(s + '+01:00'); // heure de Paris, decembre = UTC+1
export const CALENDRIER = {
  vote: P('2026-12-07T00:00:00'),
  voteFin: P('2026-12-09T00:00:00'),
  departageFin: P('2026-12-10T00:00:00'),
  manches: [
    { n: 1, debut: P('2026-12-10T00:00:00'), fin: P('2026-12-15T21:00:00') },
    { n: 2, debut: P('2026-12-15T21:00:00'), fin: P('2026-12-22T21:00:00') },
    { n: 3, debut: P('2026-12-22T21:00:00'), fin: P('2026-12-25T21:00:00') },
  ],
  pause: { debut: P('2026-12-19T00:00:00'), fin: P('2026-12-21T00:00:00') },
  // Le palmares reste visible une semaine apres la finale.
  ferme: P('2027-01-01T00:00:00'),
};

export const CANDIDATS = 8;
export const CHEFS = 4;
export const DUEL_POINTS = 5;
export const DEFENSE_POINTS = 3;
const FIL_N = 30;

/* Toutes les epreuves en salle du jeu qui ont une ligne au barème hommes
   (auteur, 23/11 : « toutes les epreuves en salle seront jouables »). Le 60 m
   haies femmes n'en a pas : le jeu n'affiche deja aucun niveau pour lui.
   Copie des lignes de src/game/bareme-ffa-donnees.ts, celles que lit
   bareme-ffa.ts (60m, 200m, 400m, 60m Haies 1.06m, seniors) : le worker ne lit
   pas le TypeScript du jeu. tools/noel-equipes-test.mjs verifie l'egalite. */
export const BAREMES = {
  '60': [6.56, 6.66, 6.74, 6.84, 6.94, 7.14, 7.24, 7.34, 7.44, 7.54, 7.64, 7.74, 7.84, 7.94, 8.04, 8.14, 8.24, 8.34, 8.44, 8.54, 8.64, 8.84, 9.04],
  '200s': [20.44, 20.64, 20.94, 21.44, 21.84, 22.24, 22.54, 22.84, 23.14, 23.44, 23.74, 24.14, 24.54, 24.84, 25.14, 25.44, 25.74, 26.14, 26.54, 26.94, 27.44, 28.24, 29.04],
  '400s': [45.24, 45.84, 46.64, 47.64, 48.64, 49.64, 50.44, 51.44, 52.44, 53.44, 54.44, 55.44, 56.44, 57.44, 58.44, 59.44, 60.44, 61.44, 62.44, 63.44, 64.44, 65.44, 66.44],
  '60h': [7.57, 7.76, 7.94, 8.14, 8.34, 8.54, 8.74, 8.94, 9.14, 9.44, 9.64, 9.84, 9.94, 10.04, 10.14, 10.34, 10.54, 10.64, 10.74, 10.84, 10.94, 11.14, 11.34],
};
export const EPREUVES = Object.keys(BAREMES);
export const BAREME_60 = BAREMES['60'];
export const POINTS_FFA = [40, 35, 30, 28, 26, 24, 21, 20, 19, 18, 15, 14, 13, 12, 11, 10, 8, 7, 6, 5, 4, 3, 2];
const CODES_FFA = ['IA', 'IB', 'N1', 'N2', 'N3', 'N4', 'IR1', 'IR2', 'IR3', 'IR4', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];

/** Le niveau FFA d'un chrono (lu au centieme superieur, comme bareme-ffa.ts). */
export function niveau(epreuve, ms) {
  const b = BAREMES[epreuve];
  if (!b) return { code: null, points: 0 };
  const s = Math.ceil(ms / 10 - 1e-6) / 100;
  const i = b.findIndex(seuil => s <= seuil + 1e-9);
  return i < 0 ? { code: null, points: 0 } : { code: CODES_FFA[i], points: POINTS_FFA[i] };
}
export const niveau60 = ms => niveau('60', ms);

/* ------------------------------------------------------------- l'horloge */

/** Ou en est le calendrier a l'instant `t` (deja decale sur le canal de test). */
export function phaseA(t) {
  const C = CALENDRIER;
  if (t < C.vote) return { phase: 'avant', manche: null, pause: false };
  if (t < C.voteFin) return { phase: 'vote', manche: null, pause: false };
  if (t < C.departageFin) return { phase: 'departage', manche: null, pause: false };
  const m = C.manches.find(x => t >= x.debut && t < x.fin);
  if (m) return { phase: 'manche', manche: m.n, pause: t >= C.pause.debut && t < C.pause.fin };
  return { phase: 'fini', manche: null, pause: false };
}

/** Le jour de Paris (UTC+1 fixe : l'evenement tient en decembre). */
export const jourDe = t => new Date(t + 3600_000).toISOString().slice(0, 10);

/** Ouvert sur ce canal a l'instant `t` ? Le public, du vote (7/12) a la fermeture (1/1). */
export function ouvert(canalTest, t = Date.now()) {
  return canalTest || (t >= CALENDRIER.vote && t < CALENDRIER.ferme);
}

/* ------------------------------------------------------------- les tables */

const pret = new WeakSet();
export async function ensureTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_eq_etapes (
      evenement TEXT NOT NULL, etape TEXT NOT NULL, quand INTEGER NOT NULL, donnees TEXT,
      PRIMARY KEY (evenement, etape))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_eq_horloge (
      evenement TEXT PRIMARY KEY, decalage INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_eq_candidats (
      evenement TEXT NOT NULL, name_key TEXT NOT NULL, name TEXT NOT NULL, rang INTEGER NOT NULL, ms INTEGER NOT NULL,
      PRIMARY KEY (evenement, name_key))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_eq_votes (
      evenement TEXT NOT NULL, device_id TEXT NOT NULL, cible_key TEXT NOT NULL, quand INTEGER NOT NULL,
      PRIMARY KEY (evenement, device_id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_eq_departage (
      evenement TEXT NOT NULL, name_key TEXT NOT NULL, ms INTEGER NOT NULL, quand INTEGER NOT NULL,
      PRIMARY KEY (evenement, name_key))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_eq_equipes (
      evenement TEXT NOT NULL, n INTEGER NOT NULL, chef_key TEXT NOT NULL, chef_name TEXT NOT NULL,
      eliminee INTEGER, PRIMARY KEY (evenement, n))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_eq_membres (
      evenement TEXT NOT NULL, name_key TEXT NOT NULL, name TEXT NOT NULL, equipe INTEGER NOT NULL,
      arrivee INTEGER NOT NULL, PRIMARY KEY (evenement, name_key))`),
    // Le fantome d'un joueur dans chaque epreuve : sa DERNIERE course.
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_eq_fantomes (
      evenement TEXT NOT NULL, name_key TEXT NOT NULL, epreuve TEXT NOT NULL, ms INTEGER NOT NULL, trace TEXT NOT NULL, version INTEGER NOT NULL,
      PRIMARY KEY (evenement, name_key, epreuve))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_eq_jour (
      evenement TEXT NOT NULL, manche INTEGER NOT NULL, jour TEXT NOT NULL, name_key TEXT NOT NULL, epreuve TEXT NOT NULL, ffa INTEGER NOT NULL,
      PRIMARY KEY (evenement, manche, jour, name_key, epreuve))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_eq_duels (
      evenement TEXT NOT NULL, manche INTEGER NOT NULL, jour TEXT NOT NULL, chasseur_key TEXT NOT NULL, cible_key TEXT NOT NULL, epreuve TEXT NOT NULL,
      PRIMARY KEY (evenement, manche, jour, chasseur_key, cible_key, epreuve))`),
    // Le grand livre des points : chaque ligne est aussi une ligne du fil.
    db.prepare(`CREATE TABLE IF NOT EXISTS noel_eq_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT, evenement TEXT NOT NULL, manche INTEGER NOT NULL, equipe INTEGER NOT NULL,
      points INTEGER NOT NULL, genre TEXT NOT NULL, a_name TEXT, b_name TEXT, ms INTEGER, quand INTEGER NOT NULL, epreuve TEXT)`),
  ]);
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_noel_eq_points ON noel_eq_points(evenement, manche, equipe)`).run();
  pret.add(db);
}

/** L'instant du calendrier : vrai temps en production, decale sur le canal de test. */
export async function horloge(db, test, maintenant = Date.now()) {
  if (!test) return maintenant;
  const r = await db.prepare(`SELECT decalage FROM noel_eq_horloge WHERE evenement = ?`).bind(evenementDe(true)).first();
  return maintenant + ((r && r.decalage) || 0);
}

export async function poserHorloge(db, dateIso, maintenant = Date.now()) {
  await ensureTables(db);
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return { status: 400, corps: { error: 'date invalide' } };
  await db.prepare(`INSERT INTO noel_eq_horloge (evenement, decalage) VALUES (?, ?)
    ON CONFLICT(evenement) DO UPDATE SET decalage = excluded.decalage`).bind(evenementDe(true), t - maintenant).run();
  return { status: 200, corps: { ok: true, simule: t, ...phaseA(t) } };
}

/* ------------------------------------------------------------- les lectures */

const etape = (db, ev, e) => db.prepare(`SELECT donnees FROM noel_eq_etapes WHERE evenement = ? AND etape = ?`).bind(ev, e).first();
const equipes = async (db, ev) => (await db.prepare(`SELECT * FROM noel_eq_equipes WHERE evenement = ? ORDER BY n`).bind(ev).all()).results || [];
const membre = (db, ev, key) => db.prepare(`SELECT * FROM noel_eq_membres WHERE evenement = ? AND name_key = ?`).bind(ev, key).first();
const effectifs = async (db, ev) => {
  const { results } = await db.prepare(`SELECT equipe, COUNT(*) AS n FROM noel_eq_membres WHERE evenement = ? GROUP BY equipe`).bind(ev).all();
  return new Map((results || []).map(r => [r.equipe, r.n]));
};
async function scoresManche(db, ev, manche) {
  const { results } = await db.prepare(`SELECT equipe, SUM(points) AS s FROM noel_eq_points WHERE evenement = ? AND manche = ? GROUP BY equipe`).bind(ev, manche).all();
  return new Map((results || []).map(r => [r.equipe, r.s || 0]));
}

/** L'equipe active la moins nombreuse (a egalite, la plus petite). */
export function plusPetite(eqs, eff) {
  const actives = eqs.filter(e => e.eliminee == null);
  actives.sort((a, b) => (eff.get(a.n) || 0) - (eff.get(b.n) || 0) || a.n - b.n);
  return actives[0] || null;
}

/* ------------------------------------------------------------- regler */

/** Ecrit une etape et ses effets en un seul lot : si l'etape existe deja, rien ne passe. */
async function clore(db, ev, nom, t, donnees, effets) {
  try {
    await db.batch([
      db.prepare(`INSERT INTO noel_eq_etapes (evenement, etape, quand, donnees) VALUES (?, ?, ?, ?)`)
        .bind(ev, nom, t, donnees == null ? null : JSON.stringify(donnees)),
      ...effets,
    ]);
    return true;
  } catch (e) {
    if (String(e && e.message || e).includes('UNIQUE')) return false; // deja faite ailleurs
    throw e;
  }
}

/** Le decompte des voix : les chefs surs, et les ex-aequo a departager. */
export function compterChefs(candidats, voix) {
  const l = candidats.map(c => ({ key: c.name_key, name: c.name, rang: c.rang, voix: voix.get(c.name_key) || 0 }))
    .sort((a, b) => b.voix - a.voix || a.rang - b.rang);
  if (l.length <= CHEFS) return { surs: l, egalite: [], places: 0 };
  const seuil = l[CHEFS - 1].voix;
  const surs = l.filter(c => c.voix > seuil);
  const egalite = l.filter(c => c.voix === seuil);
  const places = CHEFS - surs.length;
  if (egalite.length === places) return { surs: [...surs, ...egalite], egalite: [], places: 0 };
  return { surs, egalite, places };
}

/**
 * Regle toutes les etapes dont l'heure est passee. `top60` rend le classement
 * du 60 m ([{ name, best_split_ms }], du meilleur au moins bon).
 */
export async function regler(db, { test, t, top60 }) {
  const ev = evenementDe(test);
  const C = CALENDRIER;

  // 1. La photo des candidats, a l'ouverture du vote.
  if (t >= C.vote && !(await etape(db, ev, 'candidats'))) {
    const top = (await top60()).filter(r => r && r.name && r.best_split_ms > 0).slice(0, CANDIDATS);
    await clore(db, ev, 'candidats', t, null, top.map((r, i) =>
      db.prepare(`INSERT OR IGNORE INTO noel_eq_candidats (evenement, name_key, name, rang, ms) VALUES (?, ?, ?, ?, ?)`)
        .bind(ev, r.name.trim().toLowerCase(), r.name, i + 1, r.best_split_ms)));
  }

  // 2. Le decompte, a la cloture du vote.
  if (t >= C.voteFin && !(await etape(db, ev, 'chefs'))) {
    const { results: cand } = await db.prepare(`SELECT * FROM noel_eq_candidats WHERE evenement = ?`).bind(ev).all();
    const { results: v } = await db.prepare(`SELECT cible_key, COUNT(*) AS n FROM noel_eq_votes WHERE evenement = ? GROUP BY cible_key`).bind(ev).all();
    const d = compterChefs(cand || [], new Map((v || []).map(x => [x.cible_key, x.n])));
    await clore(db, ev, 'chefs', t, d, []);
  }

  // 3. Les equipes, des que les chefs sont connus (au plus tard apres le departage).
  if (!(await etape(db, ev, 'equipes'))) {
    const c = await etape(db, ev, 'chefs');
    const d = c && JSON.parse(c.donnees);
    if (d && (d.egalite.length === 0 || t >= C.departageFin)) {
      let chefs = d.surs;
      if (d.egalite.length) {
        const { results } = await db.prepare(`SELECT name_key, ms FROM noel_eq_departage WHERE evenement = ?`).bind(ev).all();
        const ms = new Map((results || []).map(r => [r.name_key, r.ms]));
        const tries = [...d.egalite].sort((a, b) => (ms.get(a.key) ?? Infinity) - (ms.get(b.key) ?? Infinity) || a.rang - b.rang);
        chefs = [...d.surs, ...tries.slice(0, d.places)];
      }
      chefs = [...chefs].sort((a, b) => a.rang - b.rang);
      await clore(db, ev, 'equipes', t, { chefs: chefs.map(x => x.key) }, chefs.flatMap((ch, n) => [
        db.prepare(`INSERT OR IGNORE INTO noel_eq_equipes (evenement, n, chef_key, chef_name) VALUES (?, ?, ?, ?)`).bind(ev, n, ch.key, ch.name),
        db.prepare(`INSERT INTO noel_eq_membres (evenement, name_key, name, equipe, arrivee) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(evenement, name_key) DO UPDATE SET equipe = excluded.equipe`).bind(ev, ch.key, ch.name, n, t),
      ]));
    }
  }

  // 4. Les eliminations, a la fin des manches 1 et 2. 5. Le vainqueur, apres la finale.
  for (const m of C.manches) {
    if (t < m.fin) break;
    const nom = m.n < C.manches.length ? `elimination${m.n}` : 'vainqueur';
    if (await etape(db, ev, nom)) continue;
    const eqs = await equipes(db, ev);
    const actives = eqs.filter(e => e.eliminee == null);
    if (!actives.length) continue;
    const sc = await scoresManche(db, ev, m.n);
    const tri = [...actives].sort((a, b) => (sc.get(a.n) || 0) - (sc.get(b.n) || 0) || b.n - a.n);
    if (nom === 'vainqueur') {
      const v = tri[tri.length - 1];
      await clore(db, ev, nom, t, { equipe: v.n, chef: v.chef_name, points: sc.get(v.n) || 0 }, [
        db.prepare(`INSERT INTO noel_eq_points (evenement, manche, equipe, points, genre, a_name, quand) VALUES (?, ?, ?, 0, 'vainqueur', ?, ?)`)
          .bind(ev, m.n, v.n, v.chef_name, t),
      ]);
      continue;
    }
    if (actives.length < 2) continue;
    const perdante = tri[0];
    // Les joueurs de l'equipe eliminee, un par un vers la moins nombreuse.
    const { results: exil } = await db.prepare(`SELECT name_key FROM noel_eq_membres WHERE evenement = ? AND equipe = ? ORDER BY arrivee, name_key`).bind(ev, perdante.n).all();
    const eff = await effectifs(db, ev);
    const restantes = eqs.map(e => e.n === perdante.n ? { ...e, eliminee: m.n } : e);
    eff.delete(perdante.n);
    const effets = [
      db.prepare(`UPDATE noel_eq_equipes SET eliminee = ? WHERE evenement = ? AND n = ?`).bind(m.n, ev, perdante.n),
      db.prepare(`INSERT INTO noel_eq_points (evenement, manche, equipe, points, genre, a_name, quand) VALUES (?, ?, ?, 0, 'eliminee', ?, ?)`)
        .bind(ev, m.n, perdante.n, perdante.chef_name, t),
    ];
    for (const j of exil || []) {
      const dest = plusPetite(restantes, eff);
      eff.set(dest.n, (eff.get(dest.n) || 0) + 1);
      effets.push(db.prepare(`UPDATE noel_eq_membres SET equipe = ? WHERE evenement = ? AND name_key = ?`).bind(dest.n, ev, j.name_key));
    }
    await clore(db, ev, nom, t, { equipe: perdante.n, chef: perdante.chef_name, points: sc.get(perdante.n) || 0 }, effets);
  }
}

/* ------------------------------------------------------------- le vote */

export async function voter(db, { test, t, deviceId, cibleKey }) {
  const ev = evenementDe(test);
  if (phaseA(t).phase !== 'vote') return { status: 409, corps: { error: 'le vote est ferme' } };
  const c = await db.prepare(`SELECT name FROM noel_eq_candidats WHERE evenement = ? AND name_key = ?`).bind(ev, cibleKey || '').first();
  if (!c) return { status: 404, corps: { error: 'pas candidat' } };
  // Un appareil, une voix ; il peut changer d'avis jusqu'a la cloture.
  await db.prepare(`INSERT INTO noel_eq_votes (evenement, device_id, cible_key, quand) VALUES (?, ?, ?, ?)
    ON CONFLICT(evenement, device_id) DO UPDATE SET cible_key = excluded.cible_key, quand = excluded.quand`)
    .bind(ev, deviceId, cibleKey, t).run();
  return { status: 200, corps: { ok: true, vote: c.name } };
}

/* ------------------------------------------------------------- rejoindre */

async function rejoindre(db, ev, { nameKey, name, t, choix = null }) {
  const deja = await membre(db, ev, nameKey);
  if (deja) return deja;
  const eqs = await equipes(db, ev);
  // le choix du joueur, s'il en a fait un (et seulement vers une equipe encore active)
  const voulue = Number.isInteger(choix) ? eqs.find(e => e.n === choix && e.eliminee == null) : null;
  const dest = voulue || plusPetite(eqs, await effectifs(db, ev));
  if (!dest) return null;
  await db.prepare(`INSERT OR IGNORE INTO noel_eq_membres (evenement, name_key, name, equipe, arrivee) VALUES (?, ?, ?, ?, ?)`)
    .bind(ev, nameKey, name, dest.n, t).run();
  return membre(db, ev, nameKey);
}

/**
 * Entrer dans une equipe. `choix` : l'equipe voulue (0..3), DEFINITIF — un joueur deja
 * membre ne change pas (409 s'il en demande une autre). Une equipe eliminee ne se choisit
 * pas (409). Sans `choix` : la moins nombreuse.
 */
export async function entrer(db, { test, t, nameKey, name, choix = null }) {
  const ev = evenementDe(test);
  if (phaseA(t).phase !== 'manche') return { status: 409, corps: { error: 'les equipes ne sont pas ouvertes' } };
  const deja = await membre(db, ev, nameKey);
  if (deja) {
    if (Number.isInteger(choix) && choix !== deja.equipe) return { status: 409, corps: { error: 'ton choix est definitif', equipe: deja.equipe } };
    return { status: 200, corps: { ok: true, equipe: deja.equipe } };
  }
  if (Number.isInteger(choix)) {
    const e = (await equipes(db, ev)).find(x => x.n === choix);
    if (!e) return { status: 400, corps: { error: 'equipe inconnue' } };
    if (e.eliminee != null) return { status: 409, corps: { error: 'cette equipe est eliminee' } };
  }
  const m = await rejoindre(db, ev, { nameKey, name, t, choix });
  if (!m) return { status: 409, corps: { error: 'pas encore d equipes' } };
  return { status: 200, corps: { ok: true, equipe: m.equipe } };
}

/* ------------------------------------------------------------- la course */

/**
 * Une course de Noel vient de finir.
 * - 200s pendant le departage : le chrono d'un ex-aequo.
 * - une epreuve en salle pendant une manche : points FFA du meilleur du jour
 *   DANS CETTE EPREUVE, duel eventuel contre le fantome d'un joueur d'une autre
 *   equipe dans la meme epreuve, et la course devient ton fantome de l'epreuve.
 */
export async function noterCourse(db, { test, t, nameKey, name, epreuve, timeMs, trace, cibleKey = null }) {
  const ev = evenementDe(test);
  const ph = phaseA(t);
  if (!EPREUVES.includes(epreuve)) return { status: 200, corps: { ok: false, raison: 'autre epreuve' } };
  const griefs = verifierTrace(trace, timeMs, epreuve);
  if (griefs.length) return { status: 422, corps: { error: 'trace refusee', griefs } };
  if (sousLePlancher(epreuve, timeMs)) return { status: 400, corps: { error: MESSAGE_PLANCHER } };

  if (ph.phase === 'departage') {
    if (epreuve !== '200s') return { status: 409, corps: { error: 'pas de manche en cours' } };
    const c = await etape(db, ev, 'chefs');
    const d = c && JSON.parse(c.donnees);
    if (!d || !d.egalite.some(x => x.key === nameKey)) return { status: 403, corps: { error: 'tu n es pas a departager' } };
    await db.prepare(`INSERT INTO noel_eq_departage (evenement, name_key, ms, quand) VALUES (?, ?, ?, ?)
      ON CONFLICT(evenement, name_key) DO UPDATE SET ms = MIN(ms, excluded.ms), quand = excluded.quand`)
      .bind(ev, nameKey, timeMs, t).run();
    const r = await db.prepare(`SELECT ms FROM noel_eq_departage WHERE evenement = ? AND name_key = ?`).bind(ev, nameKey).first();
    return { status: 200, corps: { ok: true, departage: true, epreuve, ms: timeMs, meilleur: r.ms } };
  }

  if (ph.phase !== 'manche') return { status: 409, corps: { error: 'pas de manche en cours' } };
  if (ph.pause) return { status: 409, corps: { error: 'pause : championnat de France' } };
  const moi = await rejoindre(db, ev, { nameKey, name, t });
  if (!moi) return { status: 409, corps: { error: 'pas encore d equipes' } };
  const manche = ph.manche, jour = jourDe(t);
  const effets = [];
  const livre = (equipe, points, genre, a, b, ms) => effets.push(db.prepare(
    `INSERT INTO noel_eq_points (evenement, manche, equipe, points, genre, a_name, b_name, ms, quand, epreuve) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(ev, manche, equipe, points, genre, a, b, ms, t, epreuve));

  // 1. Le barème : seul le meilleur du jour dans l'epreuve compte, on verse l'ecart.
  const niv = niveau(epreuve, timeMs);
  const avant = await db.prepare(`SELECT ffa FROM noel_eq_jour WHERE evenement = ? AND manche = ? AND jour = ? AND name_key = ? AND epreuve = ?`)
    .bind(ev, manche, jour, nameKey, epreuve).first();
  const gain = Math.max(0, niv.points - ((avant && avant.ffa) || 0));
  if (gain > 0) {
    effets.push(db.prepare(`INSERT INTO noel_eq_jour (evenement, manche, jour, name_key, epreuve, ffa) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(evenement, manche, jour, name_key, epreuve) DO UPDATE SET ffa = excluded.ffa`).bind(ev, manche, jour, nameKey, epreuve, niv.points));
    livre(moi.equipe, gain, 'ffa', name, niv.code, timeMs);
  }

  // 2. Le duel, contre le fantome tel qu'il etait AVANT cette course.
  let duel = null;
  if (cibleKey && cibleKey !== nameKey) {
    const c = await membre(db, ev, cibleKey);
    const f = c && await db.prepare(`SELECT ms FROM noel_eq_fantomes WHERE evenement = ? AND name_key = ? AND epreuve = ?`).bind(ev, cibleKey, epreuve).first();
    if (c && f && c.equipe !== moi.equipe) {
      duel = { cible: c.name, cible_ms: f.ms, gagne: timeMs < f.ms, compte: false, points: 0 };
      const r = await db.prepare(`INSERT OR IGNORE INTO noel_eq_duels (evenement, manche, jour, chasseur_key, cible_key, epreuve) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(ev, manche, jour, nameKey, cibleKey, epreuve).run();
      if (changes(r)) {
        duel.compte = true;
        if (duel.gagne) { duel.points = DUEL_POINTS; livre(moi.equipe, DUEL_POINTS, 'duel', name, c.name, timeMs); }
        else { duel.points = -DEFENSE_POINTS; livre(c.equipe, DEFENSE_POINTS, 'defense', c.name, name, f.ms); }
      }
    }
  }

  // 3. La course devient ton fantome de l'epreuve (la derniere, pas la meilleure).
  effets.push(db.prepare(`INSERT INTO noel_eq_fantomes (evenement, name_key, epreuve, ms, trace, version) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(evenement, name_key, epreuve) DO UPDATE SET ms = excluded.ms, trace = excluded.trace, version = excluded.version`)
    .bind(ev, nameKey, epreuve, timeMs, JSON.stringify(trace), t));
  effets.push(db.prepare(`UPDATE noel_eq_membres SET name = ? WHERE evenement = ? AND name_key = ?`).bind(name, ev, nameKey));
  await db.batch(effets);
  return { status: 200, corps: { ok: true, epreuve, ms: timeMs, equipe: moi.equipe, niveau: niv.code, ffa: niv.points, gain, duel } };
}

const changes = (r) => {
  const n = r && (r.meta ? r.meta.changes : r.changes);
  return n == null ? 1 : n;
};

/* ------------------------------------------------------------- le fantome */

export async function fantome(db, { test, cibleKey, epreuve }) {
  const ev = evenementDe(test);
  const m = await membre(db, ev, cibleKey);
  const f = m && await db.prepare(`SELECT ms, trace FROM noel_eq_fantomes WHERE evenement = ? AND name_key = ? AND epreuve = ?`).bind(ev, cibleKey, epreuve).first();
  let trace = [];
  try { trace = JSON.parse((f && f.trace) || '[]'); } catch (e) { trace = []; }
  if (!f || !Array.isArray(trace) || trace.length < 2) return { status: 404, corps: { error: 'pas de fantome' } };
  return { status: 200, corps: { name: m.name, epreuve, ms: f.ms, equipe: m.equipe, trace } };
}

/* ------------------------------------------------------------- le tableau */

export async function tableau(db, { test, t, nameKey = null, deviceId = null }) {
  const ev = evenementDe(test);
  const ph = phaseA(t);
  const out = { evenement: ev, maintenant: t, ...ph, calendrier: CALENDRIER,
    regles: { candidats: CANDIDATS, chefs: CHEFS, duel: DUEL_POINTS, defense: DEFENSE_POINTS, epreuves: EPREUVES } };

  const { results: cand } = await db.prepare(`SELECT name_key, name, rang, ms FROM noel_eq_candidats WHERE evenement = ? ORDER BY rang`).bind(ev).all();
  const { results: v } = await db.prepare(`SELECT cible_key, COUNT(*) AS n FROM noel_eq_votes WHERE evenement = ? GROUP BY cible_key`).bind(ev).all();
  const voix = new Map((v || []).map(x => [x.cible_key, x.n]));
  out.candidats = (cand || []).map(c => ({ key: c.name_key, name: c.name, rang: c.rang, ms: c.ms, voix: voix.get(c.name_key) || 0 }));
  if (deviceId) {
    const mv = await db.prepare(`SELECT cible_key FROM noel_eq_votes WHERE evenement = ? AND device_id = ?`).bind(ev, deviceId).first();
    out.mon_vote = mv ? mv.cible_key : null;
  }
  const ch = await etape(db, ev, 'chefs');
  if (ch) {
    const d = JSON.parse(ch.donnees);
    const { results } = await db.prepare(`SELECT name_key, ms FROM noel_eq_departage WHERE evenement = ?`).bind(ev).all();
    const ms = new Map((results || []).map(r => [r.name_key, r.ms]));
    out.departage = { places: d.places, egalite: d.egalite.map(x => ({ ...x, ms: ms.get(x.key) ?? null })) };
  }

  const eqs = await equipes(db, ev);
  const { results: mbs } = await db.prepare(`SELECT name_key, name, equipe FROM noel_eq_membres WHERE evenement = ? ORDER BY arrivee`).bind(ev).all();
  const { results: fts } = await db.prepare(`SELECT name_key, epreuve, ms FROM noel_eq_fantomes WHERE evenement = ?`).bind(ev).all();
  const fantomes = new Map();
  for (const f of fts || []) { if (!fantomes.has(f.name_key)) fantomes.set(f.name_key, {}); fantomes.get(f.name_key)[f.epreuve] = f.ms; }
  const { results: sc } = await db.prepare(`SELECT manche, equipe, SUM(points) AS s FROM noel_eq_points WHERE evenement = ? GROUP BY manche, equipe`).bind(ev).all();
  const today = ph.manche ? new Set(((await db.prepare(`SELECT name_key FROM noel_eq_jour WHERE evenement = ? AND manche = ? AND jour = ?`)
    .bind(ev, ph.manche, jourDe(t)).all()).results || []).map(r => r.name_key)) : new Set();
  out.equipes = eqs.map(e => {
    const scores = {};
    for (const r of sc || []) if (r.equipe === e.n) scores[r.manche] = r.s || 0;
    const membres = (mbs || []).filter(m => m.equipe === e.n)
      .map(m => ({ key: m.name_key, name: m.name, fantomes: fantomes.get(m.name_key) || {}, chef: m.name_key === e.chef_key, a_couru: today.has(m.name_key) }));
    return { n: e.n, chef: e.chef_name, chef_key: e.chef_key, eliminee: e.eliminee, scores,
             score: ph.manche ? scores[ph.manche] || 0 : 0, effectif: membres.length, membres };
  });
  if (nameKey) {
    const m = (mbs || []).find(x => x.name_key === nameKey);
    out.moi = m ? { equipe: m.equipe, fantomes: fantomes.get(nameKey) || {}, a_couru: today.has(nameKey) } : null;
  }
  const { results: et } = await db.prepare(`SELECT etape, donnees FROM noel_eq_etapes WHERE evenement = ? AND (etape LIKE 'elimination%' OR etape = 'vainqueur')`).bind(ev).all();
  out.eliminations = (et || []).filter(r => r.etape !== 'vainqueur').map(r => JSON.parse(r.donnees));
  const vq = (et || []).find(r => r.etape === 'vainqueur');
  out.vainqueur = vq ? JSON.parse(vq.donnees) : null;
  const { results: fil } = await db.prepare(
    `SELECT manche, equipe, points, genre, a_name, b_name, ms, quand, epreuve FROM noel_eq_points WHERE evenement = ? ORDER BY id DESC LIMIT ${FIL_N}`
  ).bind(ev).all();
  out.fil = (fil || []).map(f => ({ manche: f.manche, equipe: f.equipe, points: f.points, genre: f.genre, a: f.a_name, b: f.b_name, ms: f.ms, quand: f.quand, epreuve: f.epreuve }));
  return out;
}
