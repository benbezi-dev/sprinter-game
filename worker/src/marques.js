/* ---------------------------------------------------------------------------
   LE DUEL DES MARQUES — Team adidas contre Team Nike (decide le 09/10/2026).

   Six jours. Chaque joueur choisit son camp ET son epreuve (100, 200 ou
   400 m), une fois pour toutes, puis court cette epreuve comme d'habitude. Son
   meilleur chrono de la semaine compte pour son camp. Une personne = une
   place : on ne compte pas sur deux epreuves.

   LES DEUX EQUIPES ONT LE MEME NOMBRE DE COURSES SUR CHAQUE EPREUVE (regle de
   l'auteur, 09/10). Sur une epreuve, on compte autant de coureurs des deux
   cotes : le plus petit des deux effectifs, les meilleurs de chaque camp.
   Vingt adidas et quatorze Nike au 100 m : les quatorze meilleurs de chaque
   camp. La composition ne peut donc jamais avantager un camp — on compare des
   sommes faites des memes courses.

   AU PLUS 32 PLACES PAR EQUIPE. Si les trois epreuves en donnent davantage, on
   retire une place a l'epreuve qui en a le plus, une a la fois, jusqu'a 32 :
   les deux camps perdent la meme. A egalite, le 100 m cede d'abord : c'est lui
   qui attire le plus de joueurs, et l'auteur veut que le 200 et le 400 m
   pesent aussi (09/10).

   La plus petite somme gagne — le cumul, comme le classement des parcours.

   AUCUN CHRONO NE COMPTE PLUS QUE `PLAFOND_MS` de son epreuve : un 31 s de
   debutant au 100 m compte 15 s. Sans ce plafond, un coureur lent ferait
   perdre son camp (constat du 09/10 : un 31,70 s reel), et le premier reflexe
   serait de decourager les nouveaux.

   LA PREUVE EST LA TRACE. Un chrono qui ne la porte pas, ou qu'elle ne
   soutient pas (verifierTrace), n'entre pas : c'est un classement public entre
   deux camps, un seul faux chrono y fausse tout le monde.

   AUCUN LOGO, AUCUNE COULEUR DE MARQUE, ET LA MENTION DE NON-AFFILIATION A
   L'ECRAN : Sprinter n'est lie ni a adidas ni a Nike.

   LA BATAILLE (demandee par l'auteur le 13/10, duel deja ouvert) — pour que
   le duel vive comme un battle royale, mais toujours par equipe :

   - ON PEUT CHANGER D'EPREUVE. Le camp reste ; l'epreuve change, et tout ce
     qu'on avait fait sur l'ancienne disparait — chrono ET duels gagnes. On ne
     garde pas une place au 100 m en allant chasser au 400 m.
   - ON DEFIE UN FANTOME, adverse ou de son camp, sur son epreuve. Le fantome
     est la trace du meilleur chrono de l'autre ; le battre, c'est finir sous
     son meilleur chrono, trace a l'appui comme toute course du duel.
   - BATTRE UN FANTOME ADVERSE ELIMINE SON COUREUR. Entre deux adversaires,
     un seul « tient » le duel : le dernier qui a battu le fantome de l'autre.
     La victime se venge en battant le fantome de son bourreau, et le duel
     change de main. Chaque duel tenu retire `BONUS_KO_MS` de son epreuve au
     total de son camp (0,10 s par 100 m couru) : petit devant la somme, mais
     decisif quand les camps se tiennent. Un duel par paire, jamais deux : on
     ne gonfle pas son compte en battant dix fois le meme fantome.
   - Battre le fantome d'un coequipier ne rapporte rien au camp ; ca se voit
     dans le fil, et le chrono, lui, compte comme toute course.
   - LE FIL DE LA BATAILLE dit tout, dans l'ordre : qui entre, qui change
     d'epreuve, qui elimine qui, qui se venge.

   Les dates : ouvert en permanence sur le canal de test ; sur la production,
   seulement de `DEBUT_PROD` a `DEBUT_PROD + DUREE_MS`. Tant que `DEBUT_PROD`
   est nul, la production refuse tout. La meme date est posee cote jeu
   (vite.config.ts, LANCEMENT_DUEL_MARQUES) : les deux bougent ensemble.
--------------------------------------------------------------------------- */
import { verifierTrace } from './preuve.js';
import { MESSAGE_PLANCHER, sousLePlancher } from './plancher.js';

export const EVENEMENT = 'adidas-nike-2026';
export const CAMPS = ['adidas', 'nike'];
export const EPREUVES = ['100', '200', '400'];
export const TAILLE_EQUIPE = 32;
export const PLAFOND_MS = { '100': 15_000, '200': 30_000, '400': 70_000 };
/** Ce que vaut un duel tenu contre un adversaire, retire au total de son camp. */
export const BONUS_KO_MS = { '100': 100, '200': 200, '400': 400 };
/** Les dernieres lignes du fil rendues avec le tableau. */
const FIL_N = 24;
/** Ouverture publique, en ms UTC ; null = ferme en production.
 *  Provisoire (09/10) : dimanche 11 octobre 2026, 21 h 30 a Paris, pour six
 *  jours. La meme valeur est dans vite.config.ts (et la duree aussi). */
export const DEBUT_PROD = Date.UTC(2026, 9, 11, 19, 30, 0);
// Six jours (decide le 09/10) : fin samedi 17/10 21 h 30, le dimanche sert au
// resultat, et Halloween s'ouvre le lundi 19 a minuit.
export const DUREE_MS = 6 * 24 * 3600 * 1000;

/** Les contextes de course qui comptent : ceux ou l'epreuve est l'epreuve.
 *  La Legende, la nuit au cimetiere et les editions changent la piste ou les
 *  regles ; un rejeu n'est pas une course. */
const CONTEXTES_ADMIS = new Set([
  'carriere', 'solo', 'direct', 'championnat', 'defi_demie', 'echauffement',
  'defi', 'duel', 'fantome', 'objectif', 'vedette',
]);

/** Le duel est-il ouvert sur ce canal, maintenant ? */
export function fenetre(canalTest, maintenant = Date.now()) {
  if (canalTest) return { ouvert: true, debut: null, fin: null };
  if (DEBUT_PROD == null) return { ouvert: false, debut: null, fin: null };
  const fin = DEBUT_PROD + DUREE_MS;
  return { ouvert: maintenant >= DEBUT_PROD && maintenant < fin, debut: DEBUT_PROD, fin };
}

const pret = new WeakSet();
export async function ensureMarquesTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS marques_camps (
      evenement TEXT NOT NULL,
      name_key TEXT NOT NULL,
      camp TEXT NOT NULL,
      epreuve TEXT NOT NULL DEFAULT '100',
      device_id TEXT NOT NULL,
      choisi_le INTEGER NOT NULL,
      PRIMARY KEY (evenement, name_key)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS marques_chronos (
      evenement TEXT NOT NULL,
      name_key TEXT NOT NULL,
      name TEXT NOT NULL,
      camp TEXT NOT NULL,
      epreuve TEXT NOT NULL DEFAULT '100',
      best_ms INTEGER NOT NULL,
      trace TEXT,
      courses INTEGER NOT NULL DEFAULT 0,
      maj INTEGER NOT NULL,
      PRIMARY KEY (evenement, name_key)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS marques_duels (
      evenement TEXT NOT NULL,
      paire TEXT NOT NULL,
      epreuve TEXT NOT NULL,
      tenant_key TEXT NOT NULL,
      tenant_name TEXT NOT NULL,
      tenant_camp TEXT NOT NULL,
      vaincu_key TEXT NOT NULL,
      vaincu_name TEXT NOT NULL,
      tenant_ms INTEGER NOT NULL,
      maj INTEGER NOT NULL,
      PRIMARY KEY (evenement, paire)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS marques_fil (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evenement TEXT NOT NULL,
      quand INTEGER NOT NULL,
      genre TEXT NOT NULL,
      camp TEXT NOT NULL,
      a_name TEXT NOT NULL,
      b_name TEXT,
      epreuve TEXT,
      ms INTEGER
    )`),
  ]);
  // La premiere version (une seule epreuve) a cree ces tables sans `epreuve`
  // sur la base de test : la colonne s'ajoute, ses lignes valent le 100 m.
  for (const t of ['marques_camps', 'marques_chronos']) {
    try { await db.prepare(`ALTER TABLE ${t} ADD COLUMN epreuve TEXT NOT NULL DEFAULT '100'`).run(); }
    catch (e) { /* colonne deja presente */ }
  }
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_marques_chronos_epreuve
    ON marques_chronos(evenement, epreuve, camp, best_ms)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_marques_fil
    ON marques_fil(evenement, id)`).run();
  pret.add(db);
}

export async function inscriptionDe(db, nameKey) {
  if (!nameKey) return null;
  return await db.prepare(
    `SELECT camp, epreuve FROM marques_camps WHERE evenement = ? AND name_key = ?`
  ).bind(EVENEMENT, nameKey).first();
}

/** Une ligne de plus au fil de la bataille. Jamais bloquant. */
async function auFil(db, { genre, camp, a, b = null, epreuve = null, ms = null, maintenant = Date.now() }) {
  try {
    await db.prepare(
      `INSERT INTO marques_fil (evenement, quand, genre, camp, a_name, b_name, epreuve, ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(EVENEMENT, maintenant, genre, camp, a, b, epreuve, ms).run();
  } catch (e) { /* le fil se tait, la course compte quand meme */ }
}

/**
 * Choisir son camp et son epreuve. Definitif : un second choix, s'il differe,
 * est refuse (409) ; le meme choix repete rend simplement l'inscription.
 */
export async function choisirCamp(db, { nameKey, name = nameKey, deviceId, camp, epreuve, maintenant = Date.now() }) {
  if (!CAMPS.includes(camp)) return { status: 400, corps: { error: 'camp inconnu' } };
  if (!EPREUVES.includes(epreuve)) return { status: 400, corps: { error: 'epreuve inconnue' } };
  await ensureMarquesTables(db);
  const avant = await inscriptionDe(db, nameKey);
  await db.prepare(
    `INSERT INTO marques_camps (evenement, name_key, camp, epreuve, device_id, choisi_le)
     VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(evenement, name_key) DO NOTHING`
  ).bind(EVENEMENT, nameKey, camp, epreuve, deviceId, maintenant).run();
  const pose = await inscriptionDe(db, nameKey);
  if (!pose || pose.camp !== camp || pose.epreuve !== epreuve) {
    return { status: 409, corps: { error: 'camp deja choisi', camp: pose?.camp, epreuve: pose?.epreuve } };
  }
  if (!avant) await auFil(db, { genre: 'entree', camp, a: name, epreuve, maintenant });
  return { status: 200, corps: { ok: true, camp, epreuve } };
}

/**
 * Changer d'epreuve. Le camp ne change pas. Le chrono de l'ancienne epreuve
 * et les duels qu'on y tenait — ou qu'on y avait perdus — disparaissent :
 * c'est le prix du changement, et ce qui empeche de garder une place sur une
 * epreuve pendant qu'on se bat sur une autre.
 */
export async function changerEpreuve(db, { nameKey, name, epreuve, maintenant = Date.now() }) {
  if (!EPREUVES.includes(epreuve)) return { status: 400, corps: { error: 'epreuve inconnue' } };
  await ensureMarquesTables(db);
  const ins = await inscriptionDe(db, nameKey);
  if (!ins) return { status: 409, corps: { error: 'aucun camp choisi' } };
  if (ins.epreuve === epreuve) return { status: 200, corps: { ok: true, camp: ins.camp, epreuve, perdu_ms: null } };
  const ancien = await db.prepare(
    `SELECT best_ms FROM marques_chronos WHERE evenement = ? AND name_key = ?`
  ).bind(EVENEMENT, nameKey).first();
  await db.batch([
    db.prepare(`UPDATE marques_camps SET epreuve = ? WHERE evenement = ? AND name_key = ?`)
      .bind(epreuve, EVENEMENT, nameKey),
    db.prepare(`DELETE FROM marques_chronos WHERE evenement = ? AND name_key = ?`).bind(EVENEMENT, nameKey),
    db.prepare(`DELETE FROM marques_duels WHERE evenement = ? AND (tenant_key = ? OR vaincu_key = ?)`)
      .bind(EVENEMENT, nameKey, nameKey),
  ]);
  await auFil(db, { genre: 'change', camp: ins.camp, a: name, b: ins.epreuve, epreuve, maintenant });
  return { status: 200, corps: { ok: true, camp: ins.camp, epreuve, perdu_ms: ancien ? ancien.best_ms : null } };
}

/** Le fantome d'un coureur du duel : la trace de son meilleur chrono. */
export async function fantome(db, { cibleKey }) {
  await ensureMarquesTables(db);
  const r = await db.prepare(
    `SELECT name, camp, epreuve, best_ms, trace FROM marques_chronos WHERE evenement = ? AND name_key = ?`
  ).bind(EVENEMENT, cibleKey).first();
  if (!r) return { status: 404, corps: { error: 'pas de fantome' } };
  let trace = [];
  try { trace = JSON.parse(r.trace || '[]'); } catch (e) { trace = []; }
  if (!Array.isArray(trace) || trace.length < 2) return { status: 404, corps: { error: 'pas de fantome' } };
  return { status: 200, corps: { name: r.name, camp: r.camp, epreuve: r.epreuve, best_ms: r.best_ms, trace } };
}

/**
 * Le duel contre un fantome, juge apres que la course a ete notee. Gagner,
 * c'est finir sous le meilleur chrono de la cible tel que le serveur le
 * connait maintenant.
 */
async function jugerDuel(db, { nameKey, name, camp, epreuve, timeMs, cibleKey, maintenant }) {
  if (!cibleKey || cibleKey === nameKey) return null;
  const c = await db.prepare(
    `SELECT name, camp, epreuve, best_ms FROM marques_chronos WHERE evenement = ? AND name_key = ?`
  ).bind(EVENEMENT, cibleKey).first();
  if (!c || c.epreuve !== epreuve) return null;
  const gagne = timeMs < c.best_ms;
  const adverse = c.camp !== camp;
  const duel = { cible: c.name, cible_camp: c.camp, cible_ms: c.best_ms, gagne, adverse, ko: false, revanche: false };
  if (!gagne) return duel;
  if (!adverse) {
    await auFil(db, { genre: 'coequipier', camp, a: name, b: c.name, epreuve, ms: timeMs, maintenant });
    return duel;
  }
  const paire = [nameKey, cibleKey].sort().join('|');
  const avant = await db.prepare(
    `SELECT tenant_key FROM marques_duels WHERE evenement = ? AND paire = ?`
  ).bind(EVENEMENT, paire).first();
  if (avant && avant.tenant_key === nameKey) return duel;   // deja tenu : un duel par paire
  await db.prepare(
    `INSERT INTO marques_duels (evenement, paire, epreuve, tenant_key, tenant_name, tenant_camp,
                                vaincu_key, vaincu_name, tenant_ms, maj)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(evenement, paire) DO UPDATE SET
       epreuve = excluded.epreuve, tenant_key = excluded.tenant_key, tenant_name = excluded.tenant_name,
       tenant_camp = excluded.tenant_camp, vaincu_key = excluded.vaincu_key,
       vaincu_name = excluded.vaincu_name, tenant_ms = excluded.tenant_ms, maj = excluded.maj`
  ).bind(EVENEMENT, paire, epreuve, nameKey, name, camp, cibleKey, c.name, timeMs, maintenant).run();
  duel.ko = true;
  duel.revanche = !!avant;
  await auFil(db, { genre: avant ? 'revanche' : 'ko', camp, a: name, b: c.name, epreuve, ms: timeMs, maintenant });
  return duel;
}

/**
 * Une course terminee. Ne compte que sur l'epreuve choisie ; garde le meilleur
 * chrono de la semaine, s'il est prouve par sa trace.
 */
export async function noterCourse(db, { nameKey, name, epreuve, timeMs, trace, contexte, cibleKey = null, maintenant = Date.now() }) {
  if (contexte && !CONTEXTES_ADMIS.has(contexte)) {
    return { status: 200, corps: { ok: false, raison: 'mode hors duel' } };
  }
  await ensureMarquesTables(db);
  const ins = await inscriptionDe(db, nameKey);
  if (!ins) return { status: 409, corps: { error: 'aucun camp choisi' } };
  if (ins.epreuve !== epreuve) return { status: 200, corps: { ok: false, raison: 'autre epreuve', epreuve: ins.epreuve } };
  const griefs = verifierTrace(trace, timeMs, epreuve);
  if (griefs.length) return { status: 422, corps: { error: 'trace refusee', griefs } };
  // Apres la preuve : une trace qui ne tient pas debout garde sa reponse (422).
  // Sous le plancher du 100/200/400 m (plancher.js), un chrono que la physique
  // du jeu interdit ne devient pas le record d'un camp, trace fabriquee a sa
  // mesure ou non.
  if (sousLePlancher(epreuve, timeMs)) return { status: 400, corps: { error: MESSAGE_PLANCHER } };

  await db.prepare(
    `INSERT INTO marques_chronos (evenement, name_key, name, camp, epreuve, best_ms, trace, courses, maj)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(evenement, name_key) DO UPDATE SET
       courses = courses + 1,
       name = excluded.name,
       trace = CASE WHEN excluded.best_ms < best_ms THEN excluded.trace ELSE trace END,
       maj = CASE WHEN excluded.best_ms < best_ms THEN excluded.maj ELSE maj END,
       best_ms = MIN(best_ms, excluded.best_ms)`
  ).bind(EVENEMENT, nameKey, name, ins.camp, epreuve, timeMs, JSON.stringify(trace), maintenant).run();

  const r = await db.prepare(
    `SELECT best_ms FROM marques_chronos WHERE evenement = ? AND name_key = ?`
  ).bind(EVENEMENT, nameKey).first();
  const duel = await jugerDuel(db, { nameKey, name, camp: ins.camp, epreuve, timeMs, cibleKey, maintenant });
  return { status: 200, corps: { ok: true, camp: ins.camp, epreuve, best_ms: r ? r.best_ms : timeMs, record: !!r && r.best_ms === timeMs, duel } };
}

/**
 * Les places de chaque epreuve : le plus petit des deux effectifs, puis, si le
 * total depasse TAILLE_EQUIPE, une place de moins a l'epreuve qui en a le plus
 * (a egalite, la plus courte d'abord : le 100 m), jusqu'a tenir.
 */
export function places(effectifs) {
  const n = {};
  for (const e of EPREUVES) n[e] = Math.min(...CAMPS.map(c => effectifs[c][e]));
  let total = EPREUVES.reduce((s, e) => s + n[e], 0);
  while (total > TAILLE_EQUIPE) {
    const e = EPREUVES.reduce((m, x) => (n[x] > n[m] ? x : m));
    n[e]--; total--;
  }
  return n;
}

/**
 * Le tableau : pour chaque epreuve, les places comptees et, pour chaque camp,
 * ses coureurs dans l'ordre, la somme des comptes ; le total par camp ; et la
 * ligne du joueur qui demande.
 */
export async function tableau(db, { nameKey }) {
  await ensureMarquesTables(db);
  const { results } = await db.prepare(
    `SELECT name, name_key, camp, epreuve, best_ms FROM marques_chronos
     WHERE evenement = ? ORDER BY best_ms ASC, maj ASC`
  ).bind(EVENEMENT).all();
  const { results: insc } = await db.prepare(
    `SELECT camp, epreuve, COUNT(*) AS n FROM marques_camps WHERE evenement = ? GROUP BY camp, epreuve`
  ).bind(EVENEMENT).all();

  const listes = {}, effectifs = {}, inscrits = {};
  for (const c of CAMPS) {
    listes[c] = {}; effectifs[c] = {}; inscrits[c] = {};
    for (const e of EPREUVES) {
      listes[c][e] = results.filter(r => r.camp === c && r.epreuve === e);
      effectifs[c][e] = listes[c][e].length;
      inscrits[c][e] = 0;
    }
  }
  for (const r of insc) if (inscrits[r.camp] && r.epreuve in inscrits[r.camp]) inscrits[r.camp][r.epreuve] = r.n;

  const { results: duels } = await db.prepare(
    `SELECT epreuve, tenant_key, tenant_name, tenant_camp, vaincu_key, vaincu_name, maj
     FROM marques_duels WHERE evenement = ? ORDER BY maj DESC`
  ).bind(EVENEMENT).all();
  const { results: fil } = await db.prepare(
    `SELECT quand, genre, camp, a_name, b_name, epreuve, ms FROM marques_fil
     WHERE evenement = ? ORDER BY id DESC LIMIT ${FIL_N}`
  ).bind(EVENEMENT).all();
  // par coureur : combien de duels il tient, et qui le tient (le plus recent)
  const tient = new Map(), tenuPar = new Map();
  const ko = Object.fromEntries(CAMPS.map(c => [c, 0]));
  const bonus = Object.fromEntries(CAMPS.map(c => [c, 0]));
  for (const d of duels) {
    if (!(d.tenant_camp in ko)) continue;
    ko[d.tenant_camp]++;
    bonus[d.tenant_camp] += BONUS_KO_MS[d.epreuve] || 0;
    tient.set(d.tenant_key, (tient.get(d.tenant_key) || 0) + 1);
    if (!tenuPar.has(d.vaincu_key)) tenuPar.set(d.vaincu_key, d.tenant_name);
  }

  const n = places(effectifs);
  const epreuves = {};
  const totaux = Object.fromEntries(CAMPS.map(c => [c, 0]));
  for (const e of EPREUVES) {
    const parCamp = {};
    for (const c of CAMPS) {
      const compte = listes[c][e].slice(0, n[e]);
      const somme = compte.reduce((s, r) => s + Math.min(r.best_ms, PLAFOND_MS[e]), 0);
      totaux[c] += somme;
      parCamp[c] = {
        inscrits: inscrits[c][e],
        coureurs: listes[c][e].slice(0, TAILLE_EQUIPE).map(r => ({
          name: r.name, ms: r.best_ms,
          ko: tient.get(r.name_key) || 0,
          elimine_par: tenuPar.get(r.name_key) || null,
        })),
        somme_ms: somme,
      };
    }
    epreuves[e] = { places: n[e], camps: parCamp };
  }
  // les sommes des chronos, puis le total qui juge : la somme moins les duels tenus
  const sommes = { ...totaux };
  for (const c of CAMPS) totaux[c] = Math.max(0, sommes[c] - bonus[c]);

  let moi = null;
  if (nameKey) {
    const ins = await inscriptionDe(db, nameKey);
    if (ins) {
      const liste = listes[ins.camp][ins.epreuve];
      const rang = liste.findIndex(r => r.name_key === nameKey);
      const autre = CAMPS.find(c => c !== ins.camp);
      moi = {
        camp: ins.camp,
        epreuve: ins.epreuve,
        best_ms: rang >= 0 ? liste[rang].best_ms : null,
        rang: rang >= 0 ? rang + 1 : null,
        selectionne: rang >= 0 && rang < n[ins.epreuve],
        // pour entrer : battre le dernier compte de son camp...
        seuil_ms: n[ins.epreuve] > 0 ? liste[n[ins.epreuve] - 1].best_ms : null,
        // ...ou attendre qu'un adversaire de plus coure cette epreuve
        attend_adversaire: rang >= n[ins.epreuve] && effectifs[autre][ins.epreuve] <= rang,
        ko: tient.get(nameKey) || 0,
        elimine_par: duels.filter(d => d.vaincu_key === nameKey).map(d => d.tenant_name),
        tenus: duels.filter(d => d.tenant_key === nameKey).map(d => d.vaincu_name),
      };
    }
  }

  const [a, b] = CAMPS;
  const tete = totaux[a] === totaux[b] ? null : totaux[a] < totaux[b] ? a : b;
  return {
    evenement: EVENEMENT, epreuves_admises: EPREUVES, taille: TAILLE_EQUIPE, plafonds: PLAFOND_MS,
    places_total: EPREUVES.reduce((s, e) => s + n[e], 0),
    bonus_ko: BONUS_KO_MS,
    epreuves, totaux, sommes, bonus, ko, tete, moi,
    fil: fil.map(f => ({ quand: f.quand, genre: f.genre, camp: f.camp, a: f.a_name, b: f.b_name, epreuve: f.epreuve, ms: f.ms })),
    inscrits: Object.fromEntries(CAMPS.map(c => [c, EPREUVES.reduce((s, e) => s + inscrits[c][e], 0)])),
  };
}
