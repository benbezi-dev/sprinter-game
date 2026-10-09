/* ---------------------------------------------------------------------------
   LE DUEL DES MARQUES — Team adidas contre Team Nike (decide le 09/10/2026).

   Une semaine. Chaque joueur choisit son camp, une fois pour toutes, puis
   court le 100 m comme d'habitude. Le meilleur chrono de la semaine de chacun
   compte pour son camp ; les 32 meilleurs de chaque camp forment l'equipe, et
   on peut deloger un selectionne jusqu'a la fin. L'equipe dont la SOMME des 32
   chronos est la plus petite gagne — le cumul, comme le classement des
   parcours.

   UNE CHAISE VIDE COUTE `CHAISE_VIDE_MS`. Sans elle, une equipe de trois
   coureurs aurait une somme plus petite qu'une equipe de trente-deux, et
   gagnerait parce qu'elle est vide.
   ET AUCUN CHRONO NE COUTE PLUS QU'UNE CHAISE VIDE : un 31 s de debutant
   compte 15 s dans la somme. Sans ce plafond, courir lentement ferait perdre
   son camp, et le premier reflexe serait de decourager les nouveaux
   (constat du 09/10 : un 31,70 s reel pesait plus qu'une place vide).

   LA PREUVE EST LA TRACE. Le TOP 500 accepte un chrono sans trace et le
   signale ; ici, un chrono qui ne la porte pas, ou qu'elle ne soutient pas
   (verifierTrace), n'entre pas. C'est un classement public entre deux camps :
   un seul faux chrono y fausse tout le monde.

   AUCUN LOGO, AUCUNE COULEUR DE MARQUE, ET LA MENTION DE NON-AFFILIATION A
   L'ECRAN : les deux noms ne sont que des noms d'equipe choisis par les
   joueurs. Sprinter n'est lie ni a adidas ni a Nike.

   Les dates : ouvert en permanence sur le canal de test ; sur la production,
   seulement de `DEBUT_PROD` a `DEBUT_PROD + DUREE_MS`. Tant que `DEBUT_PROD`
   est nul, la production refuse tout et ne montre rien. La meme date est
   posee cote jeu (vite.config.ts, LANCEMENT_DUEL_MARQUES) : les deux doivent
   bouger ensemble.
--------------------------------------------------------------------------- */
import { verifierTrace } from './preuve.js';

export const EVENEMENT = 'adidas-nike-2026';
export const CAMPS = ['adidas', 'nike'];
export const EPREUVE = '100';
export const TAILLE_EQUIPE = 32;
export const CHAISE_VIDE_MS = 15_000;
/** Ouverture publique, en ms UTC ; null = ferme en production. */
export const DEBUT_PROD = null;
export const DUREE_MS = 7 * 24 * 3600 * 1000;

/** Les contextes de course qui comptent : ceux ou le 100 m est le 100 m.
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
      device_id TEXT NOT NULL,
      choisi_le INTEGER NOT NULL,
      PRIMARY KEY (evenement, name_key)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS marques_chronos (
      evenement TEXT NOT NULL,
      name_key TEXT NOT NULL,
      name TEXT NOT NULL,
      camp TEXT NOT NULL,
      best_ms INTEGER NOT NULL,
      trace TEXT,
      courses INTEGER NOT NULL DEFAULT 0,
      maj INTEGER NOT NULL,
      PRIMARY KEY (evenement, name_key)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_marques_chronos_camp
      ON marques_chronos(evenement, camp, best_ms)`),
  ]);
  pret.add(db);
}

export async function campDe(db, nameKey) {
  if (!nameKey) return null;
  const r = await db.prepare(
    `SELECT camp FROM marques_camps WHERE evenement = ? AND name_key = ?`
  ).bind(EVENEMENT, nameKey).first();
  return r ? r.camp : null;
}

/**
 * Choisir son camp. Definitif : un second choix, s'il differe, est refuse
 * (409) ; le meme choix repete rend simplement le camp.
 */
export async function choisirCamp(db, { nameKey, deviceId, camp, maintenant = Date.now() }) {
  if (!CAMPS.includes(camp)) return { status: 400, corps: { error: 'camp inconnu' } };
  await ensureMarquesTables(db);
  await db.prepare(
    `INSERT INTO marques_camps (evenement, name_key, camp, device_id, choisi_le)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT(evenement, name_key) DO NOTHING`
  ).bind(EVENEMENT, nameKey, camp, deviceId, maintenant).run();
  const pose = await campDe(db, nameKey);
  if (pose !== camp) return { status: 409, corps: { error: 'camp deja choisi', camp: pose } };
  return { status: 200, corps: { ok: true, camp } };
}

/**
 * Une course de 100 m terminee. Garde le meilleur chrono de la semaine, s'il
 * est prouve par sa trace.
 */
export async function noterCourse(db, { nameKey, name, timeMs, trace, contexte, maintenant = Date.now() }) {
  if (contexte && !CONTEXTES_ADMIS.has(contexte)) {
    return { status: 200, corps: { ok: false, raison: 'mode hors duel' } };
  }
  await ensureMarquesTables(db);
  const camp = await campDe(db, nameKey);
  if (!camp) return { status: 409, corps: { error: 'aucun camp choisi' } };
  const griefs = verifierTrace(trace, timeMs, EPREUVE);
  if (griefs.length) return { status: 422, corps: { error: 'trace refusee', griefs } };

  await db.prepare(
    `INSERT INTO marques_chronos (evenement, name_key, name, camp, best_ms, trace, courses, maj)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(evenement, name_key) DO UPDATE SET
       courses = courses + 1,
       name = excluded.name,
       trace = CASE WHEN excluded.best_ms < best_ms THEN excluded.trace ELSE trace END,
       maj = CASE WHEN excluded.best_ms < best_ms THEN excluded.maj ELSE maj END,
       best_ms = MIN(best_ms, excluded.best_ms)`
  ).bind(EVENEMENT, nameKey, name, camp, timeMs, JSON.stringify(trace), maintenant).run();

  const r = await db.prepare(
    `SELECT best_ms FROM marques_chronos WHERE evenement = ? AND name_key = ?`
  ).bind(EVENEMENT, nameKey).first();
  return { status: 200, corps: { ok: true, camp, best_ms: r ? r.best_ms : timeMs, record: r && r.best_ms === timeMs } };
}

/**
 * Le tableau : pour chaque camp, l'equipe (les 32 meilleurs), la somme, les
 * chaises vides et le total qui decide ; et la ligne du joueur qui demande.
 */
export async function tableau(db, { nameKey }) {
  await ensureMarquesTables(db);
  const camps = {};
  for (const camp of CAMPS) {
    const { results } = await db.prepare(
      `SELECT name, name_key, best_ms FROM marques_chronos
       WHERE evenement = ? AND camp = ? ORDER BY best_ms ASC, maj ASC`
    ).bind(EVENEMENT, camp).all();
    const inscrits = await db.prepare(
      `SELECT COUNT(*) AS n FROM marques_camps WHERE evenement = ? AND camp = ?`
    ).bind(EVENEMENT, camp).first();
    const equipe = results.slice(0, TAILLE_EQUIPE).map(r => ({ name: r.name, ms: r.best_ms }));
    const somme = equipe.reduce((s, r) => s + Math.min(r.ms, CHAISE_VIDE_MS), 0);
    const vides = TAILLE_EQUIPE - equipe.length;
    camps[camp] = {
      inscrits: inscrits ? inscrits.n : 0,
      coureurs: results.length,
      equipe,
      somme_ms: somme,
      chaises_vides: vides,
      total_ms: somme + vides * CHAISE_VIDE_MS,
      // le chrono a battre pour entrer dans l'equipe, quand elle est pleine
      seuil_ms: equipe.length === TAILLE_EQUIPE ? equipe[TAILLE_EQUIPE - 1].ms : null,
      _cles: results.map(r => r.name_key),
    };
  }
  let moi = null;
  if (nameKey) {
    const camp = await campDe(db, nameKey);
    if (camp) {
      const rang = camps[camp]._cles.indexOf(nameKey);
      const ligne = rang >= 0
        ? await db.prepare(`SELECT best_ms, courses FROM marques_chronos WHERE evenement = ? AND name_key = ?`)
            .bind(EVENEMENT, nameKey).first()
        : null;
      moi = {
        camp,
        best_ms: ligne ? ligne.best_ms : null,
        courses: ligne ? ligne.courses : 0,
        rang: rang >= 0 ? rang + 1 : null,
        selectionne: rang >= 0 && rang < TAILLE_EQUIPE,
      };
    }
  }
  for (const c of CAMPS) delete camps[c]._cles;
  const [a, b] = CAMPS;
  const tete = camps[a].total_ms === camps[b].total_ms ? null
    : camps[a].total_ms < camps[b].total_ms ? a : b;
  return {
    evenement: EVENEMENT, epreuve: EPREUVE, taille: TAILLE_EQUIPE,
    chaise_vide_ms: CHAISE_VIDE_MS, camps, tete, moi,
  };
}
