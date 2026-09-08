/* ---------------------------------------------------------------------------
   LA MODERATION — signaler, bloquer, trancher
   ---------------------------------------------------------------------------
   `mot.js` disait ce qui manquait : « le jour ou le jeu s'ouvrira a des
   inconnus, il faudra un signalement et de quoi le traiter. » C'est ce
   fichier. Il n'ouvre rien de nouveau au joueur — il donne de quoi refuser.

   Trois gestes, et ils ne se confondent pas :

   1. SIGNALER dit « ce mot ne devrait pas exister ». C'est une demande
      adressee a un humain, qui la lira plus tard. Rien ne disparait sur le
      coup : accepter qu'un seul clic efface la parole d'un autre, c'est
      offrir a n'importe qui le pouvoir de faire taire n'importe qui.
   2. BLOQUER dit « je ne veux plus rien recevoir de cette personne ». Effet
      immediat, sans avis de personne, reversible. C'est le geste qui protege
      vraiment, parce qu'il ne depend d'aucun delai de traitement.
   3. TRANCHER est le geste de l'administrateur, et de lui seul.

   UNE CONTRAINTE COMMANDE TOUT LE RESTE : la voix s'efface a la lecture
   (`/duel/results/seen`), et le texte, lui, survit. Un signalement depose
   apres coup ne trouverait donc plus rien a montrer. On COPIE donc le contenu
   dans le signalement au moment ou il est fait, et le bouton vit dans la
   fenetre de lecture, la ou le contenu est encore entier. C'est la seule
   entorse a la promesse d'effacement, et elle est etroite : on ne garde que
   ce qu'un joueur a explicitement designe comme abusif.

   Les cles sont des noms normalises (minuscules, sans espaces de bord), comme
   partout ailleurs dans ce worker — voir `opponent_key` et `challenger_key`.
--------------------------------------------------------------------------- */

/** Les motifs proposes. Une liste fermee : un champ libre serait lui-meme un
 *  contenu a moderer, et personne ne lit deux fois le meme probleme. */
export const MOTIFS = ['insulte', 'haine', 'sexuel', 'menace', 'autre'];

export function motifPropre(brut) {
  const m = String(brut || '').trim().toLowerCase();
  return MOTIFS.includes(m) ? m : 'autre';
}

/** Meme memoire par base que partout ailleurs : le worker en sert deux. */
const pret = new WeakSet();
export async function ensureModerationTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS signalements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      duel TEXT NOT NULL,
      auteur_cle TEXT NOT NULL,
      signale_par TEXT NOT NULL,
      motif TEXT NOT NULL,
      mot TEXT,
      voix TEXT,
      voix_type TEXT,
      cree_le INTEGER NOT NULL,
      tranche_le INTEGER,
      verdict TEXT
    )`),
    // Un signalement par duel et par personne : re-cliquer ne fabrique pas une
    // file de dix lignes identiques a lire une par une.
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS signalements_unique
                  ON signalements(duel, signale_par)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS signalements_attente
                  ON signalements(tranche_le, cree_le)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS bloques (
      bloqueur TEXT NOT NULL,
      bloque TEXT NOT NULL,
      cree_le INTEGER NOT NULL,
      PRIMARY KEY (bloqueur, bloque)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS bannis (
      cle TEXT PRIMARY KEY,
      raison TEXT,
      cree_le INTEGER NOT NULL
    )`),
  ]);
  pret.add(db);
}

/** Normalise une cle de joueur, comme le reste du worker. */
export function cleDe(nom) {
  return String(nom || '').trim().toLowerCase().slice(0, 40);
}

/**
 * Qui devait lire le mot de cette rencontre ?
 *
 * Le mot va toujours au perdant. 'opponent' veut dire que le releveur gagne,
 * donc le lanceur lit ; 'challenger' l'inverse. Un nul n'a pas de mot.
 */
function destinataire(r) {
  if (r.outcome === 'opponent') return { role: 'challenger', cle: cleDe(r.challenger_key) };
  if (r.outcome === 'challenger') return { role: 'opponent', cle: cleDe(r.opponent_key) };
  return null;
}

/**
 * Enregistre un signalement.
 *
 * Renvoie `{ erreur }` plutot que de lever : l'appelant est une route HTTP.
 *
 * On verifie que celui qui signale est bien CELUI A QUI LE MOT ETAIT DESTINE.
 * Sans cette condition, n'importe qui pourrait signaler le mot de n'importe
 * qui — y compris des mots qu'il n'a jamais recus, dont il aurait devine
 * l'identifiant — et remplir la file de bruit. Le destinataire est le seul a
 * avoir vu le contenu, et donc le seul a pouvoir dire qu'il derange.
 */
export async function signaler(db, { duel, deviceId, cle, motif }) {
  await ensureModerationTables(db);
  const id = String(duel || '').toUpperCase();
  if (!/^[A-Z0-9]{4,10}$/.test(id)) return { erreur: 'duel invalide' };

  const r = await db.prepare(
    `SELECT r.challenge_id, r.opponent_key, r.challenger_key, r.outcome,
            r.mot, r.voix, r.voix_type, c.owner_device
       FROM duel_results r
       JOIN challenges c ON c.id = r.challenge_id
      WHERE r.challenge_id = ?`).bind(id).first();
  if (!r) return { erreur: 'duel introuvable' };
  if (!r.mot && !r.voix) return { erreur: 'rien a signaler' };

  const dest = destinataire(r);
  if (!dest) return { erreur: 'rien a signaler' };

  // Deux facons d'etre le destinataire, les memes que partout : par le nom, ou
  // — cote lanceur seulement — par l'appareil qui a cree le defi.
  const moi = cleDe(cle);
  const parNom = moi && dest.cle && moi === dest.cle;
  const parAppareil = dest.role === 'challenger' &&
    deviceId && r.owner_device && String(deviceId) === String(r.owner_device);
  if (!parNom && !parAppareil) return { erreur: 'ce mot ne vous etait pas adresse' };

  const auteur = dest.role === 'challenger'
    ? cleDe(r.opponent_key) : cleDe(r.challenger_key);
  const signalePar = moi || ('appareil:' + String(deviceId).slice(0, 32));

  // La copie du contenu, et la raison d'etre de ce fichier : passe ce point,
  // la voix peut disparaitre a tout moment sans que le signalement en souffre.
  const dejaLa = await db.prepare(
    `SELECT id FROM signalements WHERE duel = ? AND signale_par = ?`
  ).bind(id, signalePar).first();
  if (dejaLa) return { ok: true, deja: true };

  await db.prepare(
    `INSERT INTO signalements
       (duel, auteur_cle, signale_par, motif, mot, voix, voix_type, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, auteur, signalePar, motifPropre(motif),
         r.mot || null, r.voix || null, r.voix_type || null, Date.now()).run();

  return { ok: true, auteur };
}

/**
 * Bloquer quelqu'un, ou le debloquer.
 *
 * Aucune verification d'existence : bloquer un nom qui n'a jamais joue est
 * sans effet et sans danger, alors que repondre « ce joueur n'existe pas »
 * transformerait ce bouton en annuaire.
 */
export async function bloquer(db, bloqueur, bloque) {
  await ensureModerationTables(db);
  const a = cleDe(bloqueur), b = cleDe(bloque);
  if (!a || !b || a === b) return { erreur: 'blocage impossible' };
  await db.prepare(
    `INSERT OR IGNORE INTO bloques (bloqueur, bloque, cree_le) VALUES (?, ?, ?)`
  ).bind(a, b, Date.now()).run();
  return { ok: true };
}

export async function debloquer(db, bloqueur, bloque) {
  await ensureModerationTables(db);
  const a = cleDe(bloqueur), b = cleDe(bloque);
  if (!a || !b) return { erreur: 'blocage impossible' };
  await db.prepare(
    `DELETE FROM bloques WHERE bloqueur = ? AND bloque = ?`).bind(a, b).run();
  return { ok: true };
}

/** Les cles que ce joueur a bloquees. Utilisee pour filtrer ce qu'on lui sert. */
export async function listeBloques(db, cle) {
  await ensureModerationTables(db);
  const a = cleDe(cle);
  if (!a) return [];
  const { results } = await db.prepare(
    `SELECT bloque FROM bloques WHERE bloqueur = ?`).bind(a).all();
  return (results || []).map(r => r.bloque);
}

/** Ce joueur est-il banni ? Un banni ne depose plus de mot. */
export async function estBanni(db, cle) {
  await ensureModerationTables(db);
  const a = cleDe(cle);
  if (!a) return false;
  const r = await db.prepare(`SELECT cle FROM bannis WHERE cle = ?`).bind(a).first();
  return !!r;
}

/**
 * Combien de signalements attendent ?
 *
 * Un compteur, et rien d'autre : c'est ce que le tableau de bord affiche avec
 * `TABLEAU_CLE`, une cle qui vit dans un navigateur ouvert depuis la page
 * publique du jeu. Le contenu des signalements — des mots ecrits par des gens,
 * a propos d'autres gens — demande `ADMIN_CLE`, qui ne s'y promene pas.
 */
export async function nombreEnAttente(db) {
  await ensureModerationTables(db);
  const r = await db.prepare(
    `SELECT COUNT(*) AS n FROM signalements WHERE tranche_le IS NULL`).first();
  return (r && r.n) || 0;
}

/** La file, en entier. Reservee a l'administrateur. */
export async function listeSignalements(db, { tout } = {}) {
  await ensureModerationTables(db);
  const { results } = await db.prepare(
    tout
      ? `SELECT * FROM signalements ORDER BY tranche_le IS NOT NULL, cree_le DESC LIMIT 200`
      : `SELECT * FROM signalements WHERE tranche_le IS NULL ORDER BY cree_le ASC LIMIT 200`
  ).all();
  return (results || []).map(r => ({
    id: r.id, duel: r.duel, auteur: r.auteur_cle, par: r.signale_par,
    motif: r.motif, mot: r.mot, voix: r.voix, voix_type: r.voix_type,
    cree_le: r.cree_le, tranche_le: r.tranche_le, verdict: r.verdict,
  }));
}

/**
 * Trancher un signalement.
 *
 * `retire` efface le mot de la rencontre : le destinataire ne le reverra pas.
 * `garde` classe sans suite. `bannir` va plus loin et ferme le depot de mots a
 * l'auteur — c'est une sanction sur la personne, pas sur un message, et elle
 * se decide donc separement du verdict.
 */
export async function trancher(db, { id, verdict, bannir, raison }) {
  await ensureModerationTables(db);
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return { erreur: 'signalement invalide' };
  const v = verdict === 'retire' ? 'retire' : 'garde';

  const s = await db.prepare(
    `SELECT id, duel, auteur_cle, tranche_le FROM signalements WHERE id = ?`
  ).bind(n).first();
  if (!s) return { erreur: 'signalement introuvable' };
  if (s.tranche_le) return { erreur: 'deja tranche', deja: true };

  if (v === 'retire') {
    await db.prepare(
      `UPDATE duel_results SET mot = NULL, voix = NULL, voix_type = NULL
        WHERE challenge_id = ?`).bind(s.duel).run();
  }
  if (bannir && s.auteur_cle) {
    await db.prepare(
      `INSERT OR IGNORE INTO bannis (cle, raison, cree_le) VALUES (?, ?, ?)`
    ).bind(s.auteur_cle, String(raison || '').slice(0, 200) || null, Date.now()).run();
  }

  await db.prepare(
    `UPDATE signalements SET tranche_le = ?, verdict = ? WHERE id = ?`
  ).bind(Date.now(), v, n).run();

  return { ok: true, verdict: v, banni: !!bannir };
}
