/* ---------------------------------------------------------------------------
   CHANGER DE PSEUDO — et reprendre celui d'un joueur parti
   ---------------------------------------------------------------------------
   Deux chemins, qui finissent tous deux par `renommer` (renommer.js) : le
   joueur garde ses chronos, ses duels, ses medailles, tout.

   1. LA DEMANDE. Un joueur veut un autre pseudo. Libre, ou porte par un
      joueur parti depuis longtemps (voir `reglages`). On ne l'applique pas :
      on le RESERVE, et on ecrit a l'administration un courriel portant deux
      liens — confirmer, refuser. Calque sur la recuperation (identite.js) :
      c'est un humain qui tranche, le jeu transmet.

      Le jeton du lien est tire au hasard (32 octets, `crypto.getRandomValues`,
      le CSPRNG des Workers), et seule son empreinte SHA-256 est gardee : la
      base ne permet pas de fabriquer le lien. Usage unique, peremption
      stricte. Le lien OUVRE une page ; seul le bouton de la page (un POST)
      agit — un antivirus de messagerie qui suit les liens ne valide rien.

      Confirmer : le joueur parti devient « Player_xxxxxx », marque
      `must_change_username`, SANS rien perdre ; le demandeur prend le pseudo ;
      tout dans la meme transaction que la cloture de la demande.

   2. LE CHANGEMENT FORCE. Un joueur dont le pseudo est interdit (pseudo.js),
      ou dont le pseudo a ete repris pendant son absence, change tout de
      suite, sans attendre personne : on ne fait pas patienter quelqu'un a qui
      l'on interdit de jouer.

   Le joueur n'a pas d'adresse ici et n'en aura pas : il apprend la reponse
   par une notification, et en rouvrant le jeu (`etatPseudo`).
--------------------------------------------------------------------------- */

import { pseudoRecevable, PSEUDO_INTERDIT } from './pseudo.js';
import { instructionsRenommage } from './renommer.js';
import { estUnCode } from './identite.js';
import { imiteOfficiel } from './tchat-marques.js';
import { envoyerCourrielAdmin, quandEnLettres } from './courriel.js';

const JOUR = 86_400_000;
const MAX_NOM = 20;
/** Le prefixe des pseudos provisoires : personne ne le choisit. */
export const PREFIXE_PROVISOIRE = 'Player_';

/** Les reglages, tous surchargeables par des variables du worker. */
export function reglages(env = {}) {
  const n = (v, d) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? x : d;
  };
  return {
    inactifJours: n(env.PSEUDO_INACTIF_JOURS, 180),
    jamaisJoueJours: n(env.PSEUDO_JAMAIS_JOUE_JOURS, 30),
    demandeHeures: n(env.PSEUDO_DEMANDE_HEURES, 72),
    adminMail: env.ADMIN_APPROVAL_EMAIL || env.MAIL_DEST || 'contact@sprinter-game.com',
  };
}

const cleDe = (nom) => String(nom || '').trim().toLowerCase().slice(0, 40);

const pret = new WeakSet();
export async function ensurePseudoTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    // Le meme schema que `ensurePlayerTables` (index.js) : la table existe
    // presque toujours, mais une base neuve doit pouvoir recevoir l'ALTER.
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
    db.prepare(`CREATE TABLE IF NOT EXISTS pseudo_demandes (
      id TEXT PRIMARY KEY,
      demandeur_key TEXT NOT NULL,
      pseudo_actuel TEXT NOT NULL,
      demande_nom TEXT NOT NULL,
      demande_key TEXT NOT NULL,
      cible_key TEXT,
      cible_derniere INTEGER,
      appareil TEXT NOT NULL,
      statut TEXT NOT NULL,
      jeton_hash TEXT,
      expire_le INTEGER NOT NULL,
      cree_le INTEGER NOT NULL,
      resolu_le INTEGER,
      motif TEXT
    )`),
    // Une demande en cours par joueur, et un pseudo reserve par une seule
    // demande : la base tranche entre deux demandes simultanees.
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS pseudo_demandes_un_par_joueur
                  ON pseudo_demandes(demandeur_key) WHERE statut = 'PENDING'`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS pseudo_demandes_un_par_pseudo
                  ON pseudo_demandes(demande_key) WHERE statut IN ('PENDING', 'APPROVING')`),
    db.prepare(`CREATE INDEX IF NOT EXISTS pseudo_demandes_jeton ON pseudo_demandes(jeton_hash)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS pseudo_journal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quand INTEGER NOT NULL,
      action TEXT NOT NULL,
      ancien TEXT NOT NULL,
      nouveau TEXT NOT NULL,
      demande_id TEXT,
      detail TEXT
    )`),
  ]);
  for (const col of ['must_change_username INTEGER', 'ancien_nom TEXT']) {
    try { await db.prepare(`ALTER TABLE players ADD COLUMN ${col}`).run(); }
    catch { /* deja la */ }
  }
  pret.add(db);
}

/** Une demande en attente dont l'heure est passee n'attend plus rien. */
export async function expirer(db, maintenant = Date.now()) {
  await db.prepare(
    `UPDATE pseudo_demandes SET statut = 'EXPIRED', jeton_hash = NULL, resolu_le = ?
      WHERE statut = 'PENDING' AND expire_le <= ?`
  ).bind(maintenant, maintenant).run();
}

/* --------------------------------------------------------------- jetons */

function hex(octets) {
  return [...new Uint8Array(octets)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Un jeton : 32 octets du CSPRNG, en hexadecimal. */
export function tirerJeton() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return hex(b);
}

/** L'empreinte gardee en base : SHA-256 du jeton. */
export async function empreinte(jeton) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(jeton))));
}

function tirerId(n = 12) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return hex(b);
}

/* ------------------------------------------------------------- activite */

async function existe(db, table) {
  const r = await db.prepare(
    `SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`).bind(table).first();
  return !!r;
}

async function maxDe(db, table, sql, ...args) {
  if (!(await existe(db, table))) return 0;
  try {
    const r = await db.prepare(sql).bind(...args).first();
    return Number(r && r.m) || 0;
  } catch { return 0; }
}

/**
 * La derniere activite d'un nom. Le jeu n'a pas de « derniere connexion » :
 * on la reconstitue — reservation, courses, chronos, duels, et la derniere
 * ouverture du jeu sur un appareil relie a ce nom.
 */
export async function activite(db, key) {
  const p = await db.prepare(`SELECT created_at FROM players WHERE name_key = ?`).bind(key).first();
  const creeLe = Number(p && p.created_at) || 0;
  const [course, chrono, duel, visite] = await Promise.all([
    maxDe(db, 'races', `SELECT MAX(created_at) AS m FROM races WHERE name_key = ?`, key),
    maxDe(db, 'scores', `SELECT MAX(updated_at) AS m FROM scores WHERE lower(trim(name)) = ?`, key),
    maxDe(db, 'duel_results', `SELECT MAX(created_at) AS m FROM duel_results
                                 WHERE opponent_key = ? OR challenger_key = ?`, key, key),
    maxDe(db, 'visits', `SELECT MAX(v.last_at) AS m FROM visits v
                           JOIN player_devices d ON d.device_id = v.device_id
                          WHERE d.name_key = ?`, key),
  ]);
  const aJoue = course > 0 || chrono > 0 || duel > 0;
  return { creeLe, aJoue, derniere: Math.max(creeLe, course, chrono, duel, visite) };
}

/** Pourquoi ce nom ne peut pas etre repris, ou null s'il le peut. */
async function protection(db, key) {
  if (imiteOfficiel(key)) return 'officiel';
  if (await existe(db, 'bannis')) {
    if (await db.prepare(`SELECT 1 AS ok FROM bannis WHERE cle = ?`).bind(key).first()) return 'banni';
  }
  for (const t of ['champ_medailles', 'champ_titres']) {
    if (await existe(db, t)
        && await db.prepare(`SELECT 1 AS ok FROM ${t} WHERE name_key = ? LIMIT 1`).bind(key).first()) {
      return 'palmares';
    }
  }
  return null;
}

/** Le joueur qui porte ce nom est-il parti assez longtemps pour le perdre ? */
export async function estInactif(db, env, key, maintenant = Date.now()) {
  const R = reglages(env);
  const a = await activite(db, key);
  const calme = maintenant - a.derniere;
  const inactif = a.aJoue
    ? calme >= R.inactifJours * JOUR
    : (maintenant - a.creeLe >= R.jamaisJoueJours * JOUR && calme >= R.jamaisJoueJours * JOUR);
  return { inactif, derniere: a.derniere };
}

/* ------------------------------------------------------------ le nom */

/** Le format, puis le filtre. Rend un code d'erreur, ou null. */
export async function formatRefuse(db, nom, pays) {
  const n = String(nom || '').trim();
  if (n.length < 2 || n.length > MAX_NOM || /[<>]/.test(n)) return 'format';
  if (n.toLowerCase() === 'anonyme' || imiteOfficiel(n)) return 'format';
  if (n.toLowerCase().startsWith(PREFIXE_PROVISOIRE.toLowerCase())) return 'format';
  if (!pseudoRecevable(n, pays).ok) return PSEUDO_INTERDIT;
  if (await estUnCode(db, n)) return 'format';
  return null;
}

/**
 * Ou en est ce pseudo ? `{ etat: 'libre' }`, `{ etat: 'reclamable', cible,
 * derniere }`, ou `{ etat: 'pris' }` (porte, actif ou protege, ou reserve par
 * une demande en cours).
 */
export async function etatDuNom(db, env, nom, maintenant = Date.now()) {
  const key = cleDe(nom);
  await expirer(db, maintenant);
  const reserve = await db.prepare(
    `SELECT 1 AS ok FROM pseudo_demandes WHERE demande_key = ? AND statut IN ('PENDING', 'APPROVING')`
  ).bind(key).first();
  if (reserve) return { etat: 'pris', raison: 'reserve' };
  const p = await db.prepare(`SELECT name_key FROM players WHERE name_key = ?`).bind(key).first();
  if (!p) return { etat: 'libre' };
  const prot = await protection(db, key);
  if (prot) return { etat: 'pris', raison: prot };
  const { inactif, derniere } = await estInactif(db, env, key, maintenant);
  return inactif ? { etat: 'reclamable', cible: key, derniere } : { etat: 'pris', raison: 'actif' };
}

/** Ce nom est-il reserve par une demande en cours ? (pour `/claim`.) */
export async function nomReserveParDemande(db, nom, maintenant = Date.now()) {
  await ensurePseudoTables(db);
  await expirer(db, maintenant);
  return !!(await db.prepare(
    `SELECT 1 AS ok FROM pseudo_demandes WHERE demande_key = ? AND statut IN ('PENDING', 'APPROVING')`
  ).bind(cleDe(nom)).first());
}

async function appartient(db, key, deviceId) {
  return !!(await db.prepare(
    `SELECT 1 AS ok FROM player_devices WHERE name_key = ? AND device_id = ?`
  ).bind(key, String(deviceId || '')).first());
}

/* ------------------------------------------------------------ la demande */

/**
 * Depose une demande. Rend `{ ok, demande, jeton }` — le jeton ne sert qu'au
 * courriel, il ne repart jamais vers le jeu — ou `{ erreur, code, statut }`.
 */
export async function creerDemande(db, env, { nom, deviceId, demande, pays }, maintenant = Date.now()) {
  await ensurePseudoTables(db);
  const moi = cleDe(nom);
  const voulu = String(demande || '').trim();
  const p = moi && await db.prepare(`SELECT name FROM players WHERE name_key = ?`).bind(moi).first();
  if (!p) return { erreur: 'reserve d abord ton nom', statut: 409 };
  if (!(await appartient(db, moi, deviceId))) return { erreur: 'ce nom ne t appartient pas', statut: 403 };
  if (cleDe(voulu) === moi) return { erreur: 'c est deja ton pseudo', code: 'SAME_USERNAME', statut: 400 };

  const refus = await formatRefuse(db, voulu, pays);
  if (refus === PSEUDO_INTERDIT) return { erreur: 'pseudo interdit', code: PSEUDO_INTERDIT, statut: 400 };
  if (refus) return { erreur: 'pseudo invalide', code: 'INVALID_USERNAME', statut: 400 };

  await expirer(db, maintenant);
  const enCours = await db.prepare(
    `SELECT id FROM pseudo_demandes WHERE demandeur_key = ? AND statut = 'PENDING'`).bind(moi).first();
  if (enCours) return { erreur: 'une demande est deja en cours', code: 'REQUEST_PENDING', statut: 409 };

  const e = await etatDuNom(db, env, voulu, maintenant);
  if (e.etat === 'pris') return { erreur: 'pseudo pris', code: 'USERNAME_TAKEN', statut: 409 };

  const id = tirerId();
  const jeton = tirerJeton();
  const R = reglages(env);
  try {
    await db.prepare(
      `INSERT INTO pseudo_demandes (id, demandeur_key, pseudo_actuel, demande_nom, demande_key,
         cible_key, cible_derniere, appareil, statut, jeton_hash, expire_le, cree_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`
    ).bind(id, moi, p.name, voulu, cleDe(voulu), e.cible || null, e.derniere || null,
      String(deviceId), await empreinte(jeton), maintenant + R.demandeHeures * 3_600_000, maintenant).run();
  } catch {
    // L'un des deux index uniques a tranche entre deux demandes simultanees.
    return { erreur: 'pseudo pris ou demande deja en cours', code: 'USERNAME_TAKEN', statut: 409 };
  }
  return {
    ok: true, jeton,
    demande: { id, pseudo_actuel: p.name, demande: voulu, cible: e.cible || null,
      cible_derniere: e.derniere || null, expire_le: maintenant + R.demandeHeures * 3_600_000 },
  };
}

/** Le courriel a l'administration : de quoi trancher, et les deux liens. */
export function courrielDemande(env, d, lien) {
  const statut = d.cible
    ? `REPRIS sur un compte inactif (dernière activité : ${quandEnLettres(d.cible_derniere || 0)}).\n` +
      `Ce compte deviendra « ${PREFIXE_PROVISOIRE}… » et gardera toute sa progression.`
    : 'LIBRE : aucun joueur ne le porte.';
  return {
    a: reglages(env).adminMail,
    sujet: `Changement de pseudo — ${d.pseudo_actuel} → ${d.demande}`,
    texte: [
      `${d.pseudo_actuel} demande à s'appeler « ${d.demande} ».`,
      ``,
      `Pseudo actuel : ${d.pseudo_actuel}`,
      `Pseudo demandé : ${d.demande}`,
      `Statut : ${statut}`,
      ``,
      `Confirmer le changement : ${lien}&action=confirmer`,
      `Refuser la demande : ${lien}&action=refuser`,
      ``,
      `Chaque lien ouvre une page récapitulative : rien n'est appliqué tant`,
      `que vous n'avez pas appuyé sur le bouton de cette page.`,
      `Liens à usage unique, valables jusqu'au ${quandEnLettres(d.expire_le)}.`,
      ``,
      `Demande n° ${d.id}`,
    ].join('\n'),
  };
}

export async function alerterDemande(env, d, origine, jeton) {
  const lien = `${origine}/pseudo/admin?t=${encodeURIComponent(jeton)}`;
  return envoyerCourrielAdmin(env, courrielDemande(env, d, lien));
}

/** La demande que porte ce jeton, si elle attend encore. */
export async function demandeDuJeton(db, jeton, maintenant = Date.now()) {
  if (!/^[0-9a-f]{64}$/.test(String(jeton || ''))) return null;
  await ensurePseudoTables(db);
  await expirer(db, maintenant);
  const d = await db.prepare(
    `SELECT * FROM pseudo_demandes WHERE jeton_hash = ? AND statut = 'PENDING'`
  ).bind(await empreinte(jeton)).first();
  return d && d.expire_le > maintenant ? d : null;
}

/** Un pseudo provisoire libre : « Player_ » et six caracteres. */
async function nomProvisoire(db) {
  for (let i = 0; i < 20; i++) {
    const n = PREFIXE_PROVISOIRE + tirerId(3);
    if (!(await db.prepare(`SELECT 1 AS ok FROM players WHERE name_key = ?`).bind(cleDe(n)).first())) return n;
  }
  throw new Error('aucun pseudo provisoire libre');
}

const journal = (db, maintenant, action, ancien, nouveau, demandeId, detail) => db.prepare(
  `INSERT INTO pseudo_journal (quand, action, ancien, nouveau, demande_id, detail)
   VALUES (?, ?, ?, ?, ?, ?)`
).bind(maintenant, action, ancien, nouveau, demandeId || null, detail || null);

/**
 * Tranche la demande que porte ce jeton. `action` : 'confirmer' ou 'refuser'.
 * Rend `{ ok, statut, demande }` ou `{ erreur }`.
 */
export async function trancherDemande(db, env, jeton, action, maintenant = Date.now()) {
  const d = await demandeDuJeton(db, jeton, maintenant);
  if (!d) return { erreur: 'lien invalide, expire ou deja utilise' };

  if (action === 'refuser') {
    const r = await db.batch([
      db.prepare(`UPDATE pseudo_demandes SET statut = 'REJECTED', jeton_hash = NULL, resolu_le = ?
                   WHERE id = ? AND statut = 'PENDING'`).bind(maintenant, d.id),
      journal(db, maintenant, 'refus', d.pseudo_actuel, d.demande_nom, d.id),
    ]);
    if (!r[0].meta || r[0].meta.changes !== 1) return { erreur: 'lien deja utilise' };
    return { ok: true, statut: 'REJECTED', demande: d };
  }
  if (action !== 'confirmer') return { erreur: 'action inconnue' };

  // Le verrou : un seul des deux clics simultanes passe d'ici. Le jeton est
  // brule tout de suite ; tout ce qui suit le rend ou le consomme.
  const pris = await db.prepare(
    `UPDATE pseudo_demandes SET statut = 'APPROVING', jeton_hash = NULL
      WHERE id = ? AND statut = 'PENDING'`).bind(d.id).run();
  if (!pris.meta || pris.meta.changes !== 1) return { erreur: 'lien deja utilise' };

  const echec = async (motif) => {
    await db.prepare(`UPDATE pseudo_demandes SET statut = 'REJECTED', resolu_le = ?, motif = ?
                       WHERE id = ?`).bind(maintenant, motif, d.id).run();
    return { erreur: motif };
  };

  try {
    // Ce qui etait vrai au depot l'est-il encore ? Le demandeur porte-t-il
    // toujours son nom, le joueur parti l'est-il toujours, le pseudo est-il
    // toujours libre ?
    if (!(await db.prepare(`SELECT 1 AS ok FROM players WHERE name_key = ?`).bind(d.demandeur_key).first())) {
      return await echec('le demandeur ne porte plus ce nom');
    }
    const porteur = await db.prepare(`SELECT name_key FROM players WHERE name_key = ?`)
      .bind(d.demande_key).first();
    let provisoire = null;
    const ops = [];
    if (porteur) {
      if (!d.cible_key || porteur.name_key !== d.cible_key) return await echec('le pseudo a ete pris entre-temps');
      if (await protection(db, d.cible_key)) return await echec('le compte est desormais protege');
      if (!(await estInactif(db, env, d.cible_key, maintenant)).inactif) {
        return await echec('le joueur inactif est revenu');
      }
      const ancien = await db.prepare(`SELECT name FROM players WHERE name_key = ?`).bind(d.cible_key).first();
      provisoire = await nomProvisoire(db);
      ops.push(...await instructionsRenommage(db, d.cible_key, provisoire));
      ops.push(db.prepare(`UPDATE players SET must_change_username = 1, ancien_nom = ? WHERE name_key = ?`)
        .bind(ancien ? ancien.name : d.demande_nom, cleDe(provisoire)));
      ops.push(journal(db, maintenant, 'libere', ancien ? ancien.name : d.demande_nom, provisoire, d.id,
        'pseudo repris pour inactivite'));
    }
    ops.push(...await instructionsRenommage(db, d.demandeur_key, d.demande_nom));
    ops.push(db.prepare(`UPDATE players SET must_change_username = 0, ancien_nom = NULL WHERE name_key = ?`)
      .bind(d.demande_key));
    ops.push(db.prepare(`UPDATE pseudo_demandes SET statut = 'APPROVED', resolu_le = ? WHERE id = ?`)
      .bind(maintenant, d.id));
    ops.push(journal(db, maintenant, 'change', d.pseudo_actuel, d.demande_nom, d.id,
      provisoire ? `repris a ${d.cible_key}, devenu ${provisoire}` : 'pseudo libre'));
    await db.batch(ops);
    return { ok: true, statut: 'APPROVED', demande: d, provisoire };
  } catch (e) {
    // La transaction n'a rien ecrit : la demande redevient tranchable, avec un
    // jeton neuf qu'aucun courriel ne porte — elle expirera d'elle-meme.
    await db.prepare(`UPDATE pseudo_demandes SET statut = 'PENDING' WHERE id = ? AND statut = 'APPROVING'`)
      .bind(d.id).run();
    throw e;
  }
}

/* ---------------------------------------------------- le changement force */

/**
 * Change tout de suite le pseudo d'un joueur qui DOIT en changer : pseudo
 * interdit, ou repris pendant son absence (`must_change_username`). Rend
 * `{ ok, name, code }` ou `{ erreur, code, statut }`.
 */
export async function forcerChangement(db, env, { nom, deviceId, nouveau, pays }, maintenant = Date.now()) {
  await ensurePseudoTables(db);
  const moi = cleDe(nom);
  const voulu = String(nouveau || '').trim();
  if (!moi) return { erreur: 'nom invalide', statut: 400 };
  const p = await db.prepare(
    `SELECT name, code, must_change_username AS doit FROM players WHERE name_key = ?`).bind(moi).first();
  if (p && !(await appartient(db, moi, deviceId))) return { erreur: 'ce nom ne t appartient pas', statut: 403 };
  const interdit = !pseudoRecevable(nom, pays).ok;
  if (!interdit && !(p && p.doit)) return { erreur: 'rien a changer', code: 'NO_CHANGE_REQUIRED', statut: 400 };

  const refus = await formatRefuse(db, voulu, pays);
  if (refus === PSEUDO_INTERDIT) return { erreur: 'pseudo interdit', code: PSEUDO_INTERDIT, statut: 400 };
  if (refus) return { erreur: 'pseudo invalide', code: 'INVALID_USERNAME', statut: 400 };
  const e = await etatDuNom(db, env, voulu, maintenant);
  // Le changement force ne reprend pas le pseudo d'un autre : seulement un libre.
  if (e.etat !== 'libre' && cleDe(voulu) !== moi) return { erreur: 'pseudo pris', code: 'USERNAME_TAKEN', statut: 409 };

  if (!p) {
    // Un nom jamais reserve n'appartient a personne : d'autres appareils ont
    // pu courir dessous. On ne deplace donc que les courses et les chronos de
    // CET appareil, et on reserve le nouveau nom pour lui, comme `/claim`.
    const code = tirerId(4).toUpperCase();
    const ops = [
      db.prepare(`INSERT INTO players (name_key, name, code, created_at) VALUES (?, ?, ?, ?)`)
        .bind(cleDe(voulu), voulu, code, maintenant),
      db.prepare(`INSERT OR IGNORE INTO player_devices (name_key, device_id, added_at) VALUES (?, ?, ?)`)
        .bind(cleDe(voulu), String(deviceId), maintenant),
      journal(db, maintenant, 'force', String(nom).trim(), voulu, null, 'nom non reserve'),
    ];
    if (await existe(db, 'races')) {
      ops.push(db.prepare(`UPDATE races SET name_key = ?, name = ? WHERE name_key = ? AND device_id = ?`)
        .bind(cleDe(voulu), voulu, moi, String(deviceId)));
    }
    if (await existe(db, 'scores')) {
      ops.push(db.prepare(`UPDATE scores SET name = ? WHERE lower(trim(name)) = ? AND device_id = ?`)
        .bind(voulu, moi, String(deviceId)));
    }
    await db.batch(ops);
    return { ok: true, name: voulu, code };
  }

  const ops = await instructionsRenommage(db, moi, voulu);
  ops.push(db.prepare(`UPDATE players SET must_change_username = 0, ancien_nom = NULL WHERE name_key = ?`)
    .bind(cleDe(voulu)));
  ops.push(journal(db, maintenant, 'force', p.name, voulu, null, interdit ? 'pseudo interdit' : 'pseudo repris'));
  await db.batch(ops);
  return { ok: true, name: voulu, code: p.code };
}

/* ---------------------------------------------------- ce que le jeu lit */

/**
 * Ce que le jeu doit savoir de son pseudo, a l'ouverture : doit-il en
 * changer, et ou en est sa derniere demande. `nom` est celui que garde
 * l'appareil — il peut ne plus exister en base, si la demande a ete acceptee
 * (le jeu apprend alors son nouveau nom) ou si le pseudo a ete repris
 * pendant son absence (le jeu apprend son nom provisoire).
 */
export async function etatPseudo(db, { nom, deviceId, pays }, maintenant = Date.now()) {
  await ensurePseudoTables(db);
  await expirer(db, maintenant);
  const moi = cleDe(nom);
  const out = { nom: String(nom || '').trim() || null, a_changer: false, raison: null, ancien: null, demande: null };

  const derniere = moi && await db.prepare(
    `SELECT id, demande_nom, statut, cree_le, resolu_le, appareil FROM pseudo_demandes
      WHERE demandeur_key = ? ORDER BY cree_le DESC LIMIT 1`).bind(moi).first();
  if (derniere) {
    out.demande = { statut: derniere.statut === 'APPROVING' ? 'PENDING' : derniere.statut,
      demande: derniere.demande_nom, cree_le: derniere.cree_le, resolu_le: derniere.resolu_le };
    // Acceptee : l'appareil qui la portait (ou tout appareil relie au nouveau
    // nom) apprend son nouveau nom.
    if (derniere.statut === 'APPROVED') {
      const lie = await appartient(db, cleDe(derniere.demande_nom), deviceId);
      if (lie) out.nom = derniere.demande_nom;
    }
  }

  // Le pseudo repris : l'appareil est desormais relie a un nom provisoire.
  const repris = deviceId && await db.prepare(
    `SELECT p.name, p.ancien_nom FROM players p JOIN player_devices d ON d.name_key = p.name_key
      WHERE d.device_id = ? AND p.must_change_username = 1 AND p.ancien_nom IS NOT NULL
        AND lower(p.ancien_nom) = ?`).bind(String(deviceId), moi).first();
  if (repris) {
    out.nom = repris.name;
    out.a_changer = true;
    out.raison = 'libere';
    out.ancien = repris.ancien_nom;
    return out;
  }
  const actuel = out.nom && await db.prepare(
    `SELECT must_change_username AS doit FROM players WHERE name_key = ?`).bind(cleDe(out.nom)).first();
  if (actuel && actuel.doit) { out.a_changer = true; out.raison = 'libere'; }
  else if (out.nom && !pseudoRecevable(out.nom, pays).ok) { out.a_changer = true; out.raison = 'interdit'; }
  return out;
}

/* ------------------------------------------------- la page de l'admin */

const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(titre, corps) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${echapper(titre)}</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0f19;color:#e8ecf3;margin:0;padding:24px}
main{max-width:480px;margin:0 auto;background:#141a2a;border:1px solid #273049;border-radius:16px;padding:24px}
h1{font-size:18px;margin:0 0 16px}dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;margin:0 0 20px}
dt{color:#8b95ad}dd{margin:0;font-weight:600}form{display:flex;gap:10px}
button{flex:1;padding:12px;border-radius:10px;border:0;font-weight:700;font-size:14px;cursor:pointer}
.oui{background:#f5c518;color:#111}.non{background:#2a3350;color:#e8ecf3}p{line-height:1.45}</style>
</head><body><main>${corps}</main></body></html>`;
}

/** La page recapitulative du lien. Le GET ne fait que montrer. */
export function pageRecap(d, jeton, action) {
  const statut = d.cible_key
    ? `Repris sur un compte inactif (dernière activité : ${echapper(quandEnLettres(d.cible_derniere || 0))})`
    : 'Libre';
  const t = echapper(jeton);
  const boutons = action === 'refuser'
    ? `<button class="non" name="action" value="refuser">Refuser la demande</button>`
    : action === 'confirmer'
      ? `<button class="oui" name="action" value="confirmer">Confirmer le changement</button>`
      : `<button class="oui" name="action" value="confirmer">Confirmer</button>
         <button class="non" name="action" value="refuser">Refuser</button>`;
  return page('Changement de pseudo', `<h1>Changement de pseudo</h1><dl>
<dt>Pseudo actuel</dt><dd>${echapper(d.pseudo_actuel)}</dd>
<dt>Pseudo demandé</dt><dd>${echapper(d.demande_nom)}</dd>
<dt>Statut</dt><dd>${statut}</dd>
<dt>Expire le</dt><dd>${echapper(quandEnLettres(d.expire_le))}</dd></dl>
<form method="POST" action="/pseudo/admin"><input type="hidden" name="t" value="${t}">${boutons}</form>`);
}

export function pageMessage(titre, texte) {
  return page(titre, `<h1>${echapper(titre)}</h1><p>${echapper(texte)}</p>`);
}
