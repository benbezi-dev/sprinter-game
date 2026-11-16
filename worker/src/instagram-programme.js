/* ---------------------------------------------------------------------------
   LES PUBLICATIONS PROGRAMMEES
   ---------------------------------------------------------------------------
   Demande du 16 novembre 2026 : que les publications puissent partir seules,
   mais seulement apres avoir ete relues. On garde donc le geste humain — la
   validation dans l'atelier, avec sa confirmation — et on ne deplace que le
   moment de l'envoi : au lieu de « maintenant », une heure choisie.

   La tache planifiee du Worker (toutes les 5 minutes, wrangler.toml) passe ici
   et envoie ce dont l'heure est venue. L'envoi part donc a l'heure dite, a
   cinq minutes pres, et sans que le Mac soit allume.

   CE QUI EST GARDE, ET JUSQU'A QUAND.
     - Une IMAGE (fil, story) est gardee ici, en base, jusqu'a son heure. Au
       moment d'envoyer, elle passe par le depot ordinaire d'instagram-envoi.js
       — une adresse d'une heure, effacee apres — exactement comme un envoi
       immediat. Le depot temporaire ne change pas de regle.
     - Une VIDEO (reel, story filmee) est confiee a Meta DES LA VALIDATION :
       l'atelier ouvre le conteneur et y charge la video, comme aujourd'hui.
       Seule la derniere marche — publier le conteneur — attend l'heure. Une
       video ne transite donc toujours par aucun stockage a nous. La rancon :
       Meta jette un conteneur non publie au bout de 24 h, d'ou AVANCE_VIDEO_MS.

   TROIS REGLES CONTRE LE DOUBLON. Une publication partie ne se retire qu'a la
   main, depuis l'application ; un doublon sur le compte du jeu se voit.
     1. On reserve une ligne avant de l'envoyer (attente -> en_cours, sous
        condition). Deux passages qui se chevauchent ne l'enverront pas deux
        fois.
     2. Aucun nouvel essai automatique apres un refus de Meta. L'echec s'affiche
        dans l'atelier, et c'est une personne qui choisit de relancer — apres
        avoir regarde le compte, puisque la derniere marche peut avoir reussi
        chez Meta et la reponse s'etre perdue.
     3. Une ligne restee « en_cours » (Worker interrompu en plein envoi) passe
        en echec, pas en attente : on ne sait pas si elle est partie.

   ET CONTRE LE CONTRESENS. Une story « ce soir, la finale » publiee le
   lendemain dit le contraire de ce qu'elle annonce. Au-dela de RETARD_MAX_MS
   (panne de Cloudflare, jeton expire puis repose), on n'envoie pas : on le
   dit, et l'atelier propose de relancer ou d'annuler.
--------------------------------------------------------------------------- */

/** Le plus loin qu'on programme une image. Au-dela, la carte aura vieilli. */
export const AVANCE_MAX_MS = 60 * 24 * 3600 * 1000;

/** Le plus loin qu'on programme une video : Meta garde un conteneur 24 h. */
export const AVANCE_VIDEO_MS = 23 * 3600 * 1000;

/** Au-dela de ce retard sur l'heure prevue, on n'envoie plus. */
export const RETARD_MAX_MS = 2 * 3600 * 1000;

/** Une ligne « en_cours » depuis plus longtemps a ete interrompue. */
const BLOQUE_MS = 15 * 60 * 1000;

/** Combien d'envois par passage. Un passage tient en quelques secondes par
    image ; mieux vaut finir au passage suivant que deborder celui-ci. */
const PAR_PASSAGE = 3;

/** Les lignes terminees s'effacent au bout de ce delai. */
const GARDER_MS = 30 * 24 * 3600 * 1000;

/** Memes bornes que le depot ordinaire : ce qui ne partirait pas maintenant
    ne partira pas plus tard. */
const MAX_OCTETS = 900 * 1024;
const MAX_APERCU = 60 * 1024;

export const FORMATS_PROGRAMMABLES = ['fil', 'story', 'reel', 'story-video'];
const VIDEO = new Set(['reel', 'story-video']);

const pret = new WeakSet();

export async function ensureProgrammeTables(db) {
  if (pret.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS reseaux_programmes (
      id TEXT PRIMARY KEY,
      format TEXT NOT NULL,
      -- L'heure d'envoi voulue, en millisecondes.
      quand INTEGER NOT NULL,
      -- attente | en_cours | publie | echec | annule
      etat TEXT NOT NULL DEFAULT 'attente',
      legende TEXT,
      -- Ce que l'atelier affiche dans la liste : la carte ou le moment, en clair.
      titre TEXT,
      -- Une vignette legere, pour reconnaitre la publication sans tout recharger.
      apercu TEXT,
      -- Image (fil, story) : le JPEG en base64, efface des qu'il a servi.
      jpeg TEXT,
      -- Video : le conteneur deja charge chez Meta.
      creation TEXT,
      -- L'origine du Worker au moment de la validation : la tache planifiee n'a
      -- pas de requete, donc pas d'adresse ou Meta viendra lire l'image.
      origine TEXT,
      -- Le moment de la file de moderation, a marquer publie s'il y en a un.
      moment INTEGER,
      erreur TEXT,
      publication TEXT,
      lien TEXT,
      cree_le INTEGER NOT NULL,
      maj_le INTEGER NOT NULL,
      envoye_le INTEGER
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS reseaux_programmes_echeance
                  ON reseaux_programmes(etat, quand)`),
  ]);
  pret.add(db);
}

function tirerId() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

const octets = b64 => Math.floor(String(b64 || '').length * 0.75);

/**
 * Range une publication validee. Rend { ok, id } ou { ok:false, erreur }.
 * `maintenant` se passe pour les essais ; il vaut Date.now() sinon.
 */
export async function programmer(db, demande, maintenant = Date.now()) {
  const { format, legende = '', image = null, creation = null, apercu = null,
          titre = '', moment = null, origine = '' } = demande || {};
  const quand = Number(demande && demande.quand);

  if (!FORMATS_PROGRAMMABLES.includes(format)) return { ok: false, erreur: `format inconnu : ${format}` };
  if (!Number.isFinite(quand)) return { ok: false, erreur: 'heure manquante' };
  // Une heure deja passee de peu (le temps de relire la confirmation) part au
  // passage suivant ; une heure franchement passee est une erreur de saisie.
  if (quand < maintenant - 10 * 60 * 1000) return { ok: false, erreur: 'cette heure est deja passee' };

  const video = VIDEO.has(format);
  if (video) {
    if (!/^\d+$/.test(String(creation || ''))) return { ok: false, erreur: 'conteneur video manquant' };
    if (quand > maintenant + AVANCE_VIDEO_MS) {
      return { ok: false, erreur: 'une video se programme 23 h a l avance au plus : Meta jette la video preparee au bout de 24 h' };
    }
  } else {
    if (!image) return { ok: false, erreur: 'image manquante' };
    if (octets(image) > MAX_OCTETS) return { ok: false, erreur: 'image trop lourde' };
    if (quand > maintenant + AVANCE_MAX_MS) return { ok: false, erreur: 'au plus 60 jours a l avance' };
    // https en production ; localhost seulement pour `wrangler dev` (Meta ne
    // viendrait de toute facon pas y lire l'image).
    if (!/^(https:\/\/[^/]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(String(origine || ''))) {
      return { ok: false, erreur: 'origine du Worker inconnue' };
    }
  }
  const vignette = apercu && octets(apercu) <= MAX_APERCU ? String(apercu) : null;

  await ensureProgrammeTables(db);
  const id = tirerId();
  await db.prepare(
    `INSERT INTO reseaux_programmes
       (id, format, quand, etat, legende, titre, apercu, jpeg, creation, origine, moment, cree_le, maj_le)
     VALUES (?, ?, ?, 'attente', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, format, Math.round(quand), String(legende || '').slice(0, 2200), String(titre || '').slice(0, 200),
    vignette, video ? null : String(image), video ? String(creation) : null,
    video ? null : String(origine), moment == null || moment === '' ? null : Number(moment),
    maintenant, maintenant,
  ).run();
  return { ok: true, id };
}

/** La liste pour l'atelier : a venir d'abord, puis le recent. Sans les JPEG. */
export async function listerProgrammes(db, { limite = 50 } = {}) {
  await ensureProgrammeTables(db);
  const n = Math.min(Math.max(Number(limite) || 50, 1), 200);
  const r = await db.prepare(
    `SELECT id, format, quand, etat, legende, titre, apercu, erreur, lien, cree_le, maj_le, envoye_le
       FROM reseaux_programmes
      ORDER BY CASE WHEN etat IN ('attente', 'en_cours') THEN 0 ELSE 1 END,
               CASE WHEN etat IN ('attente', 'en_cours') THEN quand ELSE -maj_le END
      LIMIT ?`
  ).bind(n).all();
  return r.results || [];
}

/** Annule ce qui n'est pas encore parti. Rend true si quelque chose a change. */
export async function annuler(db, id, maintenant = Date.now()) {
  await ensureProgrammeTables(db);
  const r = await db.prepare(
    `UPDATE reseaux_programmes SET etat = 'annule', jpeg = NULL, maj_le = ?
      WHERE id = ? AND etat IN ('attente', 'echec')`
  ).bind(maintenant, String(id || '')).run();
  return !!(r.meta && r.meta.changes);
}

/**
 * Remet un echec en attente, a l'heure donnee (ou tout de suite). C'est le
 * seul chemin vers un nouvel essai, et il passe par une personne.
 */
export async function relancer(db, id, quand = null, maintenant = Date.now()) {
  await ensureProgrammeTables(db);
  const l = await db.prepare(`SELECT format, cree_le, jpeg, creation FROM reseaux_programmes WHERE id = ? AND etat = 'echec'`)
    .bind(String(id || '')).first();
  if (!l) return { ok: false, erreur: 'rien a relancer' };
  const heure = quand == null ? maintenant : Number(quand);
  if (!Number.isFinite(heure)) return { ok: false, erreur: 'heure invalide' };
  if (VIDEO.has(l.format) && heure > Number(l.cree_le) + AVANCE_VIDEO_MS) {
    return { ok: false, erreur: 'la video preparee chez Meta a expire ou va expirer : refaire l envoi depuis la carte' };
  }
  if (!VIDEO.has(l.format) && !l.jpeg) return { ok: false, erreur: 'image perdue : refaire l envoi depuis la carte' };
  const r = await db.prepare(
    `UPDATE reseaux_programmes SET etat = 'attente', quand = ?, erreur = NULL, maj_le = ?
      WHERE id = ? AND etat = 'echec'`
  ).bind(Math.max(heure, maintenant), maintenant, String(id)).run();
  return r.meta && r.meta.changes ? { ok: true } : { ok: false, erreur: 'rien a relancer' };
}

async function echouer(db, id, erreur, maintenant) {
  await db.prepare(
    `UPDATE reseaux_programmes SET etat = 'echec', erreur = ?, maj_le = ? WHERE id = ?`
  ).bind(String(erreur).slice(0, 500), maintenant, id).run();
}

/**
 * Le passage de la tache planifiee. `outils` porte les appels a Meta et au
 * depot (instagram-envoi.js) : passes en parametre, ils se remplacent dans les
 * essais par des doublures, sans jamais parler a Meta.
 *
 * Rend un bilan { publiees, echecs, attente } — vide la plupart du temps.
 */
export async function publierLesProgrammes(db, outils, maintenant = Date.now()) {
  const bilan = { publiees: [], echecs: [], attente: [] };
  await ensureProgrammeTables(db);

  // 1. Les envois interrompus : on ne sait pas s'ils sont partis.
  const bloques = await db.prepare(
    `UPDATE reseaux_programmes
        SET etat = 'echec', maj_le = ?,
            erreur = 'envoi interrompu : verifier le compte Instagram avant de relancer, il a pu partir'
      WHERE etat = 'en_cours' AND maj_le < ?`
  ).bind(maintenant, maintenant - BLOQUE_MS).run();
  if (bloques.meta && bloques.meta.changes) bilan.echecs.push(`${bloques.meta.changes} interrompu(s)`);

  // 2. Trop tard pour avoir encore un sens.
  const tard = await db.prepare(
    `SELECT id, quand FROM reseaux_programmes WHERE etat = 'attente' AND quand < ?`
  ).bind(maintenant - RETARD_MAX_MS).all();
  for (const l of tard.results || []) {
    const h = Math.round((maintenant - Number(l.quand)) / 3600000);
    await echouer(db, l.id, `non envoyee : ${h} h de retard sur l heure prevue (Worker ou Instagram indisponible)`, maintenant);
    bilan.echecs.push(l.id);
  }

  // 3. Le menage des lignes terminees.
  try {
    await db.prepare(
      `DELETE FROM reseaux_programmes WHERE etat IN ('publie', 'annule', 'echec') AND maj_le < ?`
    ).bind(maintenant - GARDER_MS).run();
  } catch { /* le menage ne doit pas empecher l'envoi */ }

  // 4. Ce dont l'heure est venue.
  const dues = await db.prepare(
    `SELECT id FROM reseaux_programmes WHERE etat = 'attente' AND quand <= ?
      ORDER BY quand LIMIT ?`
  ).bind(maintenant, PAR_PASSAGE).all();
  if (!(dues.results || []).length) return bilan;

  if (!outils.pret()) {
    for (const l of dues.results) {
      await echouer(db, l.id, 'IG_JETON et IG_COMPTE ne sont pas poses sur le Worker', maintenant);
      bilan.echecs.push(l.id);
    }
    return bilan;
  }

  for (const { id } of dues.results) {
    // La reservation : seul le passage qui la gagne envoie.
    const prise = await db.prepare(
      `UPDATE reseaux_programmes SET etat = 'en_cours', maj_le = ? WHERE id = ? AND etat = 'attente'`
    ).bind(maintenant, id).run();
    if (!(prise.meta && prise.meta.changes)) continue;

    const l = await db.prepare(`SELECT * FROM reseaux_programmes WHERE id = ?`).bind(id).first();
    let r;
    try {
      if (VIDEO.has(l.format)) {
        const e = await outils.etatConteneur(l.creation);
        if (e.ok && e.etat === 'IN_PROGRESS') {
          // Meta transcode encore : on rend la ligne, le passage suivant verra.
          await db.prepare(`UPDATE reseaux_programmes SET etat = 'attente', maj_le = ? WHERE id = ?`)
            .bind(maintenant, id).run();
          bilan.attente.push(id);
          continue;
        }
        if (!e.ok) r = e;
        else if (e.etat !== 'FINISHED') {
          r = { ok: false, etape: 'preparation',
                erreur: `Meta ne publiera pas cette video (${e.etat}${e.detail ? ' : ' + e.detail : ''})` };
        } else {
          r = await outils.publierConteneur(l.creation);
        }
      } else {
        const depot = await outils.deposer(l.jpeg);
        try {
          r = await outils.publierImage({
            adresseImage: `${l.origine}/img/${depot}.jpg`, legende: l.legende || '', format: l.format,
          });
        } finally {
          await outils.oublier(depot);
        }
      }
    } catch (e) {
      r = { ok: false, etape: 'worker', erreur: String(e && e.message || e) };
    }

    if (r && r.ok) {
      await db.prepare(
        `UPDATE reseaux_programmes
            SET etat = 'publie', jpeg = NULL, publication = ?, lien = ?, envoye_le = ?, maj_le = ?, erreur = NULL
          WHERE id = ?`
      ).bind(String(r.publication || ''), r.lien || null, maintenant, maintenant, id).run();
      if (l.moment != null) {
        try { await outils.marquer(l.moment); } catch { /* le registre est un agrement */ }
      }
      bilan.publiees.push(id);
    } else {
      // La derniere marche est la seule ou Meta a pu publier malgre l'erreur.
      const doute = r && r.etape === 'publication'
        ? ' — verifier le compte avant de relancer : Meta a pu publier quand meme' : '';
      await echouer(db, id, `${(r && r.etape) || 'envoi'} : ${(r && r.erreur) || 'echec'}${doute}`, maintenant);
      bilan.echecs.push(id);
    }
  }
  return bilan;
}
