/* ---------------------------------------------------------------------------
   ON VIENT DE TE DEPASSER (demande de l'auteur, 22/11/2026)
   ---------------------------------------------------------------------------
   « Envoie une notification aux joueurs les plus proches de ton niveau lorsque
   tu viens de battre leur record. Pareil lorsque tu passes devant quelqu'un
   dans le classement des duels et au top 500. »

   Deux nouvelles, et pas trois : le TOP 500 classe les records, y passer
   devant quelqu'un C'EST battre son record. La meme notification le dit.

   Les plus proches seulement : qui gagne cent places d'un coup ne doit pas
   faire sonner cent telephones. Et une fois par heure au plus pour celui qui
   recoit : deux joueurs au coude a coude se repassent devant toute la soiree.

   Le record battu NOMME celui qui passe, et dit la place ou l'on tombe
   (demande de l'auteur, 25/11/2026 : « Lubin a froisse ton record sur 60 m »).
   C'est une exception voulue a la regle de push.js : un pseudo s'affiche deja
   au Top 500, et c'est le nom qui donne envie de repondre. Toujours pas de
   chrono. Un pseudo interdit (pseudo.js) n'est jamais ecrit : on prend alors
   un message sans nom. Les duels gardent leur message anonyme.
--------------------------------------------------------------------------- */

import { notifierAppareil } from './push.js';
import { listeBloques } from './moderation.js';
import { ordreClassement } from './duels.js';
import { PLUS_BAS, directionDe, epreuve as fiche, epreuvesDeDiscipline } from './epreuves.js';
import { pseudoInterdit } from './pseudo.js';

export const PLUS_PROCHES = 3;
export const SONNERIE_MS = 60 * 60 * 1000;
const TOP = 500;

const pret = new WeakSet();
async function ensureTable(db) {
  if (pret.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS depassements_sonnes (
    name_key TEXT NOT NULL,
    genre TEXT NOT NULL,
    quand INTEGER NOT NULL,
    PRIMARY KEY (name_key, genre)
  )`).run();
  // Le dernier message recu, pour ne pas envoyer deux fois le meme de suite.
  try { await db.prepare(`ALTER TABLE depassements_sonnes ADD COLUMN dernier_message INTEGER`).run(); }
  catch { /* deja la */ }
  pret.add(db);
}

// Une insecable entre le nombre et son unite : « 400 » en fin de ligne, « m » au debut.
function nomEpreuve(cle, langue) {
  return epreuvesDeDiscipline(cle)
    .map(c => (langue === 'en' ? fiche(c).libelleEn : fiche(c).libelle))
    .join(' + ').replace(/(\d) m/g, '$1 m');
}

/* ------------------------------------------------ les messages du record

   Vingt messages, choisis au hasard, jamais le meme deux fois de suite pour
   un meme joueur. `nom` : le message ecrit le pseudo de celui qui passe.
   `top` : il parle du Top 500, donc seulement si la place y est. Les deux
   listes vont par paires : le message 7 anglais traduit le message 7 francais.
   {nom}, {epreuve} et {place} sont remplaces a l'envoi. Mordant, jamais
   insultant : beaucoup de joueurs sont jeunes, et un message blessant fait
   couper les notifications, pas revenir sur la piste. */
const M = (titre, corps, nom = true, top = false) => ({ titre, corps, nom, top });
export const MESSAGES_RECORD = {
  fr: [
    M('{nom} a froissé ton record', 'Sur {epreuve}, tu viens de te faire doubler. Tu tombes {place}e. Tu laisses passer ça ?'),
    M('{nom} vient de faire du sale', 'Ton record du {epreuve} n\'a pas tenu. Te voilà {place}e au Top 500.', true, true),
    M('{nom} t\'a doublé', 'Passé devant toi au {epreuve} sans même te regarder. {place}e maintenant.'),
    M('{nom} t\'a mis dans le vent', 'Ton chrono du {epreuve} vient de prendre un coup de vieux.'),
    M('{nom} t\'a pris ta place', 'Au {epreuve}, ta place est à {nom} maintenant. Tu recules en {place}e position.'),
    M('Ton record pleure', '{nom} l\'a écrasé au {epreuve}. Viens le consoler sur la piste.'),
    M('{nom} rigole encore', 'Tu viens de te faire doubler au {epreuve}. Tu comptes répondre quand ?'),
    M('Alerte : {nom}', 'Doublé sur {epreuve}. {place}e place. Ça pique, hein ?'),
    M('{nom} t\'envoie ses salutations', 'Depuis la place juste devant toi au {epreuve}.'),
    M('Tu t\'es fait déposer', '{nom} est passé devant toi au {epreuve} comme si tu marchais.'),
    M('{nom} a volé ton chrono', 'Au {epreuve}, ta place est prise. Va la reprendre.'),
    M('Ton record a duré moins longtemps que prévu', '{nom} l\'a battu au {epreuve}. {place}e place.'),
    M('{nom} : 1, toi : 0', 'Dépassé au {epreuve}. La revanche, c\'est maintenant.'),
    M('On t\'a vu reculer', '{nom} vient de te doubler au {epreuve}. Tu tombes {place}e.'),
    M('{nom} a fait le ménage', 'Ton record du {epreuve} est passé à la poubelle. {place}e désormais.'),
    M('Tu descends au classement', 'Le niveau monte et ça devient chaud. Tu es {place}e au {epreuve}.', false),
    M('Ça bouge sous tes pieds', 'Le Top 500 du {epreuve} accélère. Toi, tu recules en {place}e place.', false, true),
    M('Le {epreuve} ne t\'attend pas', 'Tu es tombé {place}e. Les autres s\'entraînent, eux.', false),
    M('Tu prends la poussière', 'Pendant ta pause, on t\'a doublé au {epreuve}. {place}e place.', false),
    M('Le chrono ne ment pas', 'Tu n\'es plus que {place}e au {epreuve}. Remets tes pointes.', false),
  ],
  en: [
    M('{nom} crumpled your record', 'You just got passed on the {epreuve}. You drop to #{place}. Letting that slide?'),
    M('{nom} just did you dirty', 'Your {epreuve} record didn\'t survive. You\'re #{place} in the Top 500 now.', true, true),
    M('{nom} just passed you', 'Went right by you on the {epreuve} without even looking. #{place} now.'),
    M('{nom} left you in the wind', 'Your {epreuve} time just got old.'),
    M('{nom} took your spot', 'Your {epreuve} spot belongs to {nom} now. You slide to #{place}.'),
    M('Your record is crying', '{nom} crushed it on the {epreuve}. Go comfort it on the track.'),
    M('{nom} is still laughing', 'You just got passed on the {epreuve}. When are you answering?'),
    M('Alert: {nom}', 'Passed on the {epreuve}. #{place}. That stings, right?'),
    M('{nom} says hi', 'From the spot just ahead of you on the {epreuve}.'),
    M('You got dusted', '{nom} passed you on the {epreuve} like you were walking.'),
    M('{nom} stole your time', 'Your {epreuve} spot is taken. Go get it back.'),
    M('Your record didn\'t last long', '{nom} beat it on the {epreuve}. #{place} now.'),
    M('{nom} 1, you 0', 'Passed on the {epreuve}. Revenge starts now.'),
    M('We saw you slip', '{nom} just passed you on the {epreuve}. You drop to #{place}.'),
    M('{nom} cleaned house', 'Your {epreuve} record just hit the trash. #{place} now.'),
    M('You\'re sliding down', 'The level is rising and it\'s getting hot. You\'re #{place} on the {epreuve}.', false),
    M('The ground is moving', 'The {epreuve} Top 500 is speeding up. You slip to #{place}.', false, true),
    M('The {epreuve} won\'t wait', 'You dropped to #{place}. Everyone else is training.', false),
    M('Gathering dust?', 'While you were away, someone passed you on the {epreuve}. #{place} now.', false),
    M('The clock doesn\'t lie', 'You\'re only #{place} on the {epreuve} now. Lace up.', false),
  ],
};

/** Le nom qui peut s'ecrire dans la notification, ou null. */
export function nomAffichableDansNotif(nom) {
  const n = String(nom || '').trim();
  if (!n || n.toLowerCase() === 'anonyme') return null;
  return pseudoInterdit(n, null, { toutes: true }) ? null : n;
}

/**
 * Le numero du message a envoyer : parmi ceux que la situation permet (un nom
 * ecrivable, une place dans le Top 500), sauf le dernier recu.
 */
export function choisirMessage({ nom, place, dernier = null, hasard = Math.random }) {
  const permis = MESSAGES_RECORD.fr
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => (!m.nom || nom) && (!m.top || place <= TOP))
    .map(({ i }) => i);
  const sansRepeter = permis.filter(i => i !== dernier);
  const parmi = sansRepeter.length ? sansRepeter : permis;
  return parmi[Math.min(parmi.length - 1, Math.floor(hasard() * parmi.length))];
}

export function texteRecordBattu(cle, { index, nom, place }, langue) {
  const liste = MESSAGES_RECORD[langue === 'en' ? 'en' : 'fr'];
  const m = liste[index] || liste[liste.length - 1];
  const e = nomEpreuve(cle, langue);
  const remplir = (t) => t.replaceAll('{nom}', nom || '').replaceAll('{epreuve}', e)
    .replaceAll('{place}', String(place));
  return [remplir(m.titre), remplir(m.corps)];
}

export function texteDepasseAuxDuels(cle, langue) {
  const e = nomEpreuve(cle, langue);
  return langue === 'en'
    ? ['You have been overtaken', `A runner just moved ahead of you in the ${e} duel ranking.`]
    : ['On te passe devant', `Un joueur vient de te dépasser au classement des duels du ${e}.`];
}

async function appareils(db, cle) {
  const { results } = await db.prepare(
    `SELECT device_id FROM player_devices WHERE name_key = ?`).bind(cle).all();
  return (results || []).map(r => r.device_id);
}

async function joignable(db, appareil) {
  for (const table of ['push_subscriptions', 'push_jetons']) {
    try {
      if (await db.prepare(`SELECT 1 AS ok FROM ${table} WHERE device_id = ? LIMIT 1`).bind(appareil).first()) return true;
    } catch { /* table absente : ce transport ne joint personne */ }
  }
  return false;
}

async function prevenir(env, db, { cible, auteur, genre, texte, saufAppareil, marque = null }) {
  if ((await listeBloques(db, cible)).includes(auteur)) return;
  // Le meme telephone sous deux noms ne s'annonce pas a lui-meme.
  const siens = new Set([saufAppareil, ...await appareils(db, auteur)]);
  const aPrevenir = [];
  for (const d of await appareils(db, cible)) {
    if (!siens.has(d) && await joignable(db, d)) aPrevenir.push(d);
  }
  if (!aPrevenir.length) return;

  await ensureTable(db);
  const t = Date.now();
  // Lue et posee d'un seul geste : deux depassements simultanes, une sonnerie.
  const r = await db.prepare(
    `INSERT INTO depassements_sonnes (name_key, genre, quand, dernier_message) VALUES (?, ?, ?, ?)
     ON CONFLICT(name_key, genre) DO UPDATE SET quand = excluded.quand,
       dernier_message = excluded.dernier_message
       WHERE depassements_sonnes.quand <= ?`
  ).bind(cible, genre, t, marque, t - SONNERIE_MS).run();
  if (!r.meta?.changes) return;

  await Promise.all(aPrevenir.map(d => notifierAppareil(db, d, genre, env, texte)));
}

/* ------------------------------------------------------------- les records */

/**
 * Les joueurs dont ce chrono vient de battre le record, les plus proches d'abord.
 *
 * S'appelle APRES l'ecriture, avec l'ancien record de la LIGNE : /race et
 * /submit l'ecrivent tous les deux, le second arrive n'a donc rien a annoncer.
 * Le nom est celui de la ligne, c'est lui qui vient de monter.
 */
export async function recordsBattus(db, { epreuve, deviceId, ancien, ms }) {
  if (!fiche(epreuve) || directionDe(epreuve) !== PLUS_BAS) return { auteur: null, battus: [] };
  const ligne = await db.prepare(
    `SELECT lower(trim(name)) AS cle FROM scores WHERE device_id = ? AND race_key = ?`
  ).bind(deviceId, epreuve).first();
  const auteur = ligne?.cle;
  if (!auteur || auteur === 'anonyme') return { auteur: null, battus: [] };

  // Son record d'avant, tous appareils confondus.
  const ailleurs = await db.prepare(
    `SELECT MIN(best_split_ms) AS m FROM scores
      WHERE race_key = ? AND lower(trim(name)) = ? AND device_id <> ? AND best_split_ms > 0`
  ).bind(epreuve, auteur, deviceId).first();
  const connus = [ancien, ailleurs?.m].filter(v => v > 0);
  const avant = connus.length ? Math.min(...connus) : Number.MAX_SAFE_INTEGER;
  if (ms >= avant) return { auteur, battus: [] };

  // `rang` se compte sans l'auteur : c'est la place qu'avait chacun avant lui.
  const { results } = await db.prepare(
    `WITH joueurs AS (
       SELECT lower(trim(name)) AS cle, MIN(best_split_ms) AS m FROM scores
        WHERE race_key = ? AND best_split_ms > 0
        GROUP BY lower(trim(name))
     ), classes AS (
       SELECT cle, m, RANK() OVER (ORDER BY m) AS rang FROM joueurs WHERE cle <> ?
     )
     SELECT cle, rang FROM classes
      WHERE m > ? AND m <= ? AND cle <> 'anonyme'
        AND cle IN (SELECT name_key FROM player_devices)
      ORDER BY m, cle LIMIT ?`
  ).bind(epreuve, auteur, ms, avant, PLUS_PROCHES).all();
  // Sa place apres : l'auteur est passe devant, il recule d'un cran.
  return { auteur, battus: (results || []).map(r => ({ cle: r.cle, place: r.rang + 1 })) };
}

/** Le pseudo tel qu'il s'ecrit (avec sa casse) : reserve, sinon celui du chrono. */
async function nomAffiche(db, cle, { deviceId, epreuve }) {
  try {
    const p = await db.prepare(`SELECT name FROM players WHERE name_key = ?`).bind(cle).first();
    if (p && p.name) return p.name;
  } catch { /* pas de table des noms reserves */ }
  const l = await db.prepare(`SELECT name FROM scores WHERE device_id = ? AND race_key = ?`)
    .bind(deviceId, epreuve).first();
  return l ? String(l.name).trim() : null;
}

export async function prevenirRecordsBattus(env, db, course) {
  try {
    const { auteur, battus } = await recordsBattus(db, course);
    if (!battus.length) return;
    const nom = nomAffichableDansNotif(await nomAffiche(db, auteur, course));
    await ensureTable(db);
    for (const { cle, place } of battus) {
      const avant = await db.prepare(
        `SELECT dernier_message AS d FROM depassements_sonnes WHERE name_key = ? AND genre = 'record_battu'`
      ).bind(cle).first();
      const index = choisirMessage({ nom, place, dernier: avant ? avant.d : null });
      await prevenir(env, db, {
        cible: cle, auteur, genre: 'record_battu', saufAppareil: course.deviceId, marque: index,
        texte: l => texteRecordBattu(course.epreuve, { index, nom, place }, l),
      });
    }
  } catch (e) {
    console.log('record battu KO', String(e && e.message || e));
  }
}

/* --------------------------------------------------------------- les duels */

/** Le classement d'une discipline, dans l'ordre affiche. A lire avant ET apres. */
export async function ordreDesDuels(db, discipline) {
  try {
    const { results } = await db.prepare(
      `SELECT name_key AS cle FROM duel_players
        WHERE epreuve = ? AND wins + losses + draws > 0 AND name_key <> 'anonyme'
        ORDER BY ${ordreClassement()}`
    ).bind(discipline).all();
    return (results || []).map(r => r.cle);
  } catch { return null; }   // le duel compte, meme si l'annonce n'a pas lieu
}

/**
 * Ceux que `auteur` vient de doubler, les plus proches derriere lui d'abord.
 * Un nouveau venu double tous ceux qu'il laisse derriere. `reserves` : les
 * autres n'ont pas de telephone connu, et ne prennent pas une des trois places.
 */
export function doublesAuxDuels(avant, apres, auteur, reserves) {
  const ici = apres.indexOf(auteur);
  if (ici < 0) return [];
  const la = avant.indexOf(auteur);
  const devant = new Set(la < 0 ? avant : avant.slice(0, la));
  const auTableau = new Set(avant.slice(0, TOP));
  return apres.slice(ici + 1)
    .filter(c => devant.has(c) && auTableau.has(c) && reserves.has(c))
    .slice(0, PLUS_PROCHES);
}

/** `gagnants` : on ne passe devant quelqu'un qu'en gagnant, un nul vaut zero LP. */
export async function prevenirDepassesAuxDuels(env, db, { discipline, avant, gagnants, saufAppareil }) {
  try {
    if (!avant || !gagnants.length) return;
    const apres = await ordreDesDuels(db, discipline);
    if (!apres) return;
    const { results } = await db.prepare(
      `SELECT DISTINCT name_key FROM player_devices
        WHERE name_key IN (SELECT name_key FROM duel_players WHERE epreuve = ?)`
    ).bind(discipline).all();
    const reserves = new Set((results || []).map(r => r.name_key));
    for (const auteur of new Set(gagnants)) {
      for (const cible of doublesAuxDuels(avant, apres, auteur, reserves)) {
        await prevenir(env, db, {
          cible, auteur, genre: 'duel_depasse', saufAppareil,
          texte: l => texteDepasseAuxDuels(discipline, l),
        });
      }
    }
  } catch (e) {
    console.log('depassement duel KO', String(e && e.message || e));
  }
}
