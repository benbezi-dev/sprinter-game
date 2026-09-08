// Le journal des notifications, et les regles qui decident d'en envoyer une.
//
// CE SOUS-SYSTEME ETAIT AVEUGLE. `push.js` avale toutes ses erreurs — c'est
// voulu, une sonnerie ne doit pas faire echouer l'ecriture qui vient d'avoir
// lieu — mais la consequence est qu'un joueur qui ne recoit rien ne laisse
// aucune trace nulle part. On ne savait meme pas si le message etait parti.
// Aucun taux d'ouverture, aucune raison de non-envoi, aucune facon de dire si
// un texte marche mieux qu'un autre.
//
// D'ou ce journal. Il n'envoie rien et ne decide rien tout seul : il note ce
// qui part, ce qui ne part pas et pourquoi, et il repond aux trois questions
// dont les regles ci-dessous ont besoin.
//
// LES REGLES, ET CE QU'ELLES PROTEGENT.
//
//   LE DECALAGE. Chaque joueur recoit a quelques minutes pres de son creneau,
//   et toujours les MEMES quelques minutes. Deux raisons : trois cents
//   telephones qui vibrent a la meme seconde, ca se voit ; et un rendez-vous
//   a 12:45:00 tous les jours a quelque chose de mecanique.
//
//   LES QUATRE HEURES. Jamais deux sonneries rapprochees, quel qu'en soit le
//   motif. C'est la regle qui protege du cumul : l'objectif du soir, un defi
//   recu, un duel tranche, un mot depose — chacun se justifie seul, les quatre
//   ensemble font desinstaller.
//
//   LE RYTHME. Quatre notifications d'affilee sans une seule ouverture, et on
//   passe a une par jour, le soir. Pas zero : celui qui n'ouvre pas cette
//   semaine ouvrira peut-etre la suivante. Une ouverture, et on revient a
//   deux. Le joueur peut aussi le choisir lui-meme, et son choix l'emporte.

/** Une notification par jour, ou deux. Le choix du joueur, ou celui qu'on
 *  fait pour lui quand il ne repond plus. */
export const RYTHMES = ['deux', 'un'];

/** Quatre heures entre deux sonneries, quel qu'en soit le motif. */
export const ECART_MIN_MS = 4 * 3600 * 1000;

/** Au-dela de tant de notifications sans une ouverture, on ralentit. */
export const SANS_OUVERTURE = 4;

/** Le decalage, en minutes, et son pas.
 *
 *  LE PAS N'EST PAS UN DETAIL. Le cron ne peut servir un joueur qu'aux
 *  instants ou il passe, et tous les fuseaux reels sont des multiples de
 *  quinze minutes : avec un cron au quart d'heure, la minute locale ne prend
 *  que quatre valeurs et le seul decalage possible est de quinze minutes. Un
 *  cron a cinq minutes rend le pas de cinq atteignable partout. C'est le prix
 *  de ce reglage : 288 passages a vide par jour au lieu de 96. */
export const DECALAGE_MAX_MIN = 10;
export const DECALAGE_PAS_MIN = 5;

const pretes = new WeakSet();

export async function ensureJournal(db) {
  if (pretes.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS notif_journal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_key TEXT NOT NULL,
      device_id TEXT,
      type TEXT NOT NULL,
      jour TEXT,
      creneau TEXT,
      contexte TEXT,
      variante INTEGER,
      statut TEXT NOT NULL,
      raison TEXT,
      envoye_le INTEGER NOT NULL,
      ouvert_le INTEGER
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS notif_prefs (
      name_key TEXT PRIMARY KEY,
      rythme TEXT NOT NULL,
      maj_le INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS notif_journal_joueur
                ON notif_journal (name_key, envoye_le)`),
  ]);
  pretes.add(db);
}

/**
 * Le decalage propre a un joueur, en minutes.
 *
 * Tire du nom seul, pas du jour : il doit etre stable dans le temps. Un
 * rendez-vous qui se deplace tous les jours n'est plus un rendez-vous, et le
 * joueur qui commence a l'attendre ne saurait plus quand.
 */
export function decalageDe(nameKey) {
  let h = 0x811c9dc5;
  const s = String(nameKey || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const pas = (2 * DECALAGE_MAX_MIN) / DECALAGE_PAS_MIN + 1;   // -10..+10 par 5
  return ((h >>> 0) % pas) * DECALAGE_PAS_MIN - DECALAGE_MAX_MIN;
}

/* ------------------------------------------------------------- ce qu'on note */

export async function noterEnvoi(db, e) {
  try {
    await ensureJournal(db);
    await db.prepare(
      `INSERT INTO notif_journal
         (name_key, device_id, type, jour, creneau, contexte, variante,
          statut, raison, envoye_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(e.nameKey, e.deviceId || null, e.type, e.jour || null,
           e.creneau || null, e.contexte || null, e.variante ?? null,
           e.statut || 'envoye', e.raison || null, Date.now()).run();
  } catch { /* un journal qui casse ne doit pas retenir une notification */ }
}

/** Une notification a ete touchee. Le joueur se designe par son nom. */
export async function noterOuverture(db, nameKey, type) {
  try {
    await ensureJournal(db);
    // La derniere sonnerie de ce genre qui n'a pas encore ete ouverte. On ne
    // marque pas tout l'historique : le taux d'ouverture se compte par
    // notification, et une ouverture n'en vaut qu'une.
    await db.prepare(
      `UPDATE notif_journal SET ouvert_le = ?
        WHERE id = (SELECT id FROM notif_journal
                     WHERE name_key = ? AND type = ? AND ouvert_le IS NULL
                       AND statut = 'envoye'
                     ORDER BY envoye_le DESC LIMIT 1)`
    ).bind(Date.now(), nameKey, type).run();
  } catch { /* sans consequence */ }
}

/* --------------------------------------------------------- ce qu'on demande */

/** Quand ce joueur a-t-il ete sonne pour la derniere fois ? */
export async function dernierEnvoi(db, nameKey) {
  try {
    await ensureJournal(db);
    const r = await db.prepare(
      `SELECT MAX(envoye_le) AS t FROM notif_journal
        WHERE name_key = ? AND statut = 'envoye'`).bind(nameKey).first();
    return r?.t || null;
  } catch { return null; }
}

/**
 * Le rythme de ce joueur : deux notifications par jour, ou une.
 *
 * Son choix d'abord. A defaut, celui qu'on fait pour lui : quatre sonneries
 * d'affilee sans une seule ouverture, et on ralentit.
 */
export async function rythmeDe(db, nameKey) {
  try {
    await ensureJournal(db);
    const p = await db.prepare(
      `SELECT rythme FROM notif_prefs WHERE name_key = ?`).bind(nameKey).first();
    if (p && RYTHMES.includes(p.rythme)) return { rythme: p.rythme, choisi: true };

    const { results } = await db.prepare(
      `SELECT ouvert_le FROM notif_journal
        WHERE name_key = ? AND statut = 'envoye'
        ORDER BY envoye_le DESC LIMIT ?`).bind(nameKey, SANS_OUVERTURE).all();
    const derniers = results || [];
    const muet = derniers.length >= SANS_OUVERTURE
      && derniers.every(l => !l.ouvert_le);
    return { rythme: muet ? 'un' : 'deux', choisi: false };
  } catch { return { rythme: 'deux', choisi: false }; }
}

/** Le joueur choisit lui-meme. */
export async function poserRythme(db, nameKey, rythme) {
  if (!RYTHMES.includes(rythme)) return false;
  await ensureJournal(db);
  await db.prepare(
    `INSERT INTO notif_prefs (name_key, rythme, maj_le) VALUES (?, ?, ?)
     ON CONFLICT(name_key) DO UPDATE SET rythme = excluded.rythme,
                                         maj_le = excluded.maj_le`
  ).bind(nameKey, rythme, Date.now()).run();
  return true;
}

/**
 * Faut-il sonner ce joueur maintenant, et sinon pourquoi ?
 *
 * Rend la raison plutot qu'un simple non : c'est elle qu'on journalise, et
 * c'est la seule chose qui permette de repondre a « pourquoi n'ai-je rien
 * recu » autrement qu'en haussant les epaules.
 */
export async function peutSonner(db, nameKey, creneau, maintenant) {
  const t = maintenant || Date.now();

  const { rythme, choisi } = await rythmeDe(db, nameKey);
  if (rythme === 'un' && creneau !== 'soir') {
    return { ok: false, raison: choisi ? 'rythme_choisi' : 'sans_ouverture' };
  }

  const dernier = await dernierEnvoi(db, nameKey);
  if (dernier && t - dernier < ECART_MIN_MS) {
    return { ok: false, raison: 'trop_rapproche' };
  }
  return { ok: true, rythme };
}

/* ------------------------------------------------------------- les chiffres */

/**
 * Le taux d'ouverture, par creneau et par variante de texte.
 *
 * C'est la mesure qui n'existait pas, et sans laquelle choisir un texte plutot
 * qu'un autre n'est qu'une opinion.
 */
export async function tauxOuverture(db, depuis) {
  await ensureJournal(db);
  const borne = depuis || (Date.now() - 30 * 86400000);
  const { results } = await db.prepare(
    `SELECT creneau, contexte, variante,
            COUNT(*) AS envoyees,
            SUM(CASE WHEN ouvert_le IS NOT NULL THEN 1 ELSE 0 END) AS ouvertes
       FROM notif_journal
      WHERE statut = 'envoye' AND type = 'objectif' AND envoye_le >= ?
      GROUP BY creneau, contexte, variante
      ORDER BY creneau, contexte, variante`).bind(borne).all();
  return (results || []).map(r => ({
    ...r,
    taux: r.envoyees ? Math.round((r.ouvertes / r.envoyees) * 1000) / 10 : 0,
  }));
}

/** Pourquoi les notifications ne sont pas parties. */
export async function raisonsDeNonEnvoi(db, depuis) {
  await ensureJournal(db);
  const borne = depuis || (Date.now() - 30 * 86400000);
  const { results } = await db.prepare(
    `SELECT raison, COUNT(*) AS n FROM notif_journal
      WHERE statut <> 'envoye' AND envoye_le >= ?
      GROUP BY raison ORDER BY n DESC`).bind(borne).all();
  return results || [];
}
