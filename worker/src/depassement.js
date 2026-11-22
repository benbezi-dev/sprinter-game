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

   Ni le nom de celui qui passe, ni son chrono : la regle de push.js.
--------------------------------------------------------------------------- */

import { notifierAppareil } from './push.js';
import { listeBloques } from './moderation.js';
import { ordreClassement } from './duels.js';
import { PLUS_BAS, directionDe, epreuve as fiche, epreuvesDeDiscipline } from './epreuves.js';

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
  pret.add(db);
}

// Une insecable entre le nombre et son unite : « 400 » en fin de ligne, « m » au debut.
function nomEpreuve(cle, langue) {
  return epreuvesDeDiscipline(cle)
    .map(c => (langue === 'en' ? fiche(c).libelleEn : fiche(c).libelle))
    .join(' + ').replace(/(\d) m/g, '$1 m');
}

export function texteRecordBattu(cle, auTop, langue) {
  const e = nomEpreuve(cle, langue);
  if (langue === 'en') {
    return ['Your record was beaten',
      `A runner close to your level just beat your ${e} record${auTop ? ' and moved ahead of you in the Top 500' : ''}.`];
  }
  return ['Ton record est battu',
    `Un joueur de ton niveau vient de battre ton record du ${e}${auTop ? ' et te passe devant au Top 500' : ''}.`];
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

async function prevenir(env, db, { cible, auteur, genre, texte, saufAppareil }) {
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
    `INSERT INTO depassements_sonnes (name_key, genre, quand) VALUES (?, ?, ?)
     ON CONFLICT(name_key, genre) DO UPDATE SET quand = excluded.quand
       WHERE depassements_sonnes.quand <= ?`
  ).bind(cible, genre, t, t - SONNERIE_MS).run();
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
  return { auteur, battus: (results || []).map(r => ({ cle: r.cle, auTop: r.rang <= TOP })) };
}

export async function prevenirRecordsBattus(env, db, course) {
  try {
    const { auteur, battus } = await recordsBattus(db, course);
    for (const { cle, auTop } of battus) {
      await prevenir(env, db, {
        cible: cle, auteur, genre: 'record_battu', saufAppareil: course.deviceId,
        texte: l => texteRecordBattu(course.epreuve, auTop, l),
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
