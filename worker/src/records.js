// Le record personnel : ou il vit, et pourquoi il derivait.
//
// LE CONSTAT. `scores.best_split_ms` porte le record d'un appareil sur une
// epreuve, et c'est lui que lit le classement — et l'Objectif du jour, pour
// calculer la cible. Il n'est ecrit que par `/submit`, c'est-a-dire quand le
// JEU decide d'envoyer un record : au retour d'un one shot qui ameliore, ou
// quand le tableau mondial tombe. La carriere, elle, n'envoie qu'a la fin de
// ses six etapes, et un joueur qui s'arrete avant n'envoie rien.
//
// `/race`, a cote, enregistre TOUTES les courses terminees, sans condition.
//
// Les deux ont donc diverge, et pas qu'un peu. Mesure sur la base de
// production le 6 septembre 2026 : 16 joueurs sur 85 au 100 m avaient dans
// leur historique une course plus rapide que leur record enregistre, avec un
// ecart allant jusqu'a 2,09 s — sur une course de huit secondes et demie.
// 5 sur 41 au 200 m, 6 sur 42 au 400 m.
//
// Ce que cela coute. Le classement les sous-estime, et surtout leur Objectif
// du jour est calibre sur un record faux : la notification leur annonce « ton
// record : 10,52 s » alors qu'ils ont couru 8,43 s la semaine derniere. Rien
// ne discredite plus vite un objectif personnel qu'un record qui n'est pas le
// sien.
//
// DEUX REPONSES, ET IL FAUT LES DEUX. `noterRecord` ferme la fuite a la
// source : toute course enregistree met le record a jour si elle le bat, si
// bien que la question ne se repose plus. `recalculerRecords` repare ce qui
// a deja derive, en relisant l'historique — et se rejoue sans rien casser,
// parce qu'il ne remplace jamais un record par une valeur moins bonne.

import { directionDe, estMeilleur, agregatSql, CLES } from './epreuves.js';

/**
 * Le total d'un parcours qui n'a pas eu lieu.
 *
 * Une ligne de `scores` porte deux choses : le total d'un parcours complet, et
 * le meilleur chrono d'une course isolee. On peut avoir le second sans le
 * premier — c'est le cas de toute course jouee hors carriere. Cette valeur
 * marque le total absent, et les classements par parcours l'excluent.
 *
 * A TENIR D'ACCORD avec NO_RUN_MS dans leaderboard.ts, cote jeu.
 */
export const SANS_PARCOURS_MS = 1200000;

/**
 * Ce nom est-il l'absence de nom ?
 *
 * `/race` enregistre sous « Anonyme » quand le joueur n'a pas choisi de nom,
 * et `cleanName` y ramene aussi toute chaine vide. Ce n'est pas un joueur,
 * c'est un trou — et il est enorme : sur la base de production, 301 appareils
 * du 100 m portent ce nom, pour 1 399 courses.
 *
 * CE QUE CELA VEUT DIRE POUR LE RECORD. Le classement regroupe par nom. Creer
 * une ligne de score pour ces appareils ferait entrer « Anonyme » au tableau
 * comme UN joueur, avec le meilleur temps des trois cents — mesure sur la
 * production : 8,13 s, soit la premiere place devant le record reel de 8,25 s.
 * Trois cents personnes fondues en une, en tete du classement, sous un nom qui
 * n'appartient a personne.
 *
 * Une course anonyme n'a donc pas de proprietaire, et pas de record. On ne
 * CREE rien pour elle. On met a jour, en revanche, la ligne d'un appareil qui
 * en a deja une : cette ligne-la porte un vrai nom, et la course a bien ete
 * courue sur cet appareil.
 *
 * Le seul mot a surveiller, et il est en francais meme dans la version
 * anglaise du jeu — verifie : le depot n'ecrit « Anonymous » nulle part.
 */
export function estAnonyme(nom) {
  const s = String(nom || '').trim().toLowerCase();
  return !s || s === 'anonyme';
}

/** Le record utile d'une ligne de `scores`, ou null.
 *
 *  Zero n'est pas un record : les lignes a zero datent d'avant l'enregistrement
 *  du chrono par course. Les confondre ferait qu'aucune course ne battrait
 *  jamais rien sur ces lignes-la — `8400 < 0` est faux. */
function recordDeLaLigne(ligne) {
  const v = ligne && Number(ligne.best_split_ms);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Une course vient d'etre enregistree : elle devient le record si elle le bat.
 *
 * Ne rend jamais d'erreur a l'appelant et ne defait rien : la course est deja
 * ecrite quand on arrive ici, et un record qui ne se met pas a jour est un
 * defaut d'affichage, pas une course perdue.
 *
 * @returns {{record: boolean, ancien: number|null, valeur: number}}
 */
export async function noterRecord(db, { deviceId, epreuve, nom, valeur }) {
  const direction = directionDe(epreuve);
  const v = Math.round(Number(valeur));
  if (!deviceId || !Number.isFinite(v) || v <= 0) {
    return { record: false, ancien: null, valeur: v };
  }

  const ligne = await db.prepare(
    `SELECT time_ms, best_split_ms FROM scores WHERE device_id = ? AND race_key = ?`
  ).bind(deviceId, epreuve).first();

  const ancien = recordDeLaLigne(ligne);
  if (!estMeilleur(direction, v, ancien)) return { record: false, ancien, valeur: v };

  if (!ligne) {
    // Sans nom, pas de record : voir `estAnonyme`. On ne fabrique pas une
    // ligne de classement pour quelqu'un qui n'a pas dit qui il etait.
    if (estAnonyme(nom)) return { record: false, ancien, valeur: v, anonyme: true };

    // Pas encore de ligne pour cet appareil : on en cree une qui ne porte que
    // le record. Le total reste marque absent — cette course n'etait pas un
    // parcours, et lui en inventer un le ferait entrer au classement des
    // parcours avec un chiffre qui n'a jamais ete couru.
    await db.prepare(
      `INSERT INTO scores (device_id, race_key, name, time_ms, best_split_ms, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id, race_key) DO UPDATE SET
         best_split_ms = excluded.best_split_ms, updated_at = excluded.updated_at`
    ).bind(deviceId, epreuve, nom, SANS_PARCOURS_MS, v, Date.now()).run();
  } else {
    await db.prepare(
      `UPDATE scores SET best_split_ms = ?, updated_at = ?
        WHERE device_id = ? AND race_key = ?`
    ).bind(v, Date.now(), deviceId, epreuve).run();
  }
  return { record: true, ancien, valeur: v };
}

/**
 * Le record d'un JOUEUR, tous ses appareils confondus.
 *
 * Par le nom, comme le classement et comme l'objectif : un joueur qui a un
 * telephone et un ordinateur a un record, pas deux. C'est la difference avec
 * `/rank`, qui repond pour un appareil.
 */
export async function recordDuJoueur(db, nameKey, epreuve) {
  const direction = directionDe(epreuve);
  const agg = agregatSql(direction);

  const r = await db.prepare(
    `SELECT ${agg}(best_split_ms) AS record, MAX(updated_at) AS maj
       FROM scores
      WHERE race_key = ? AND best_split_ms > 0 AND lower(trim(name)) = ?`
  ).bind(epreuve, nameKey).first();

  const record = recordDeLaLigne({ best_split_ms: r && r.record });
  if (record === null) {
    return { epreuve, direction, record_ms: null, rang: null, courses: 0, maj_le: null };
  }

  // Le rang se compte en joueurs devant soi, pas en lignes.
  const devant = await db.prepare(
    `SELECT COUNT(*) AS n FROM (
       SELECT ${agg}(best_split_ms) AS m FROM scores
        WHERE race_key = ? AND best_split_ms > 0
        GROUP BY lower(trim(name))
     ) WHERE ${direction === 'plus_haut' ? 'm > ?' : 'm < ?'}`
  ).bind(epreuve, record).first();

  const n = await db.prepare(
    `SELECT COUNT(*) AS n FROM races WHERE race_key = ? AND name_key = ?`
  ).bind(epreuve, nameKey).first();

  return {
    epreuve, direction,
    record_ms: record,
    rang: (devant?.n || 0) + 1,
    courses: n?.n || 0,
    maj_le: r?.maj || null,
  };
}

/**
 * Recalcule les records depuis l'historique des courses.
 *
 * IDEMPOTENT ET REJOUABLE, et pour une raison plus solide qu'une precaution :
 * il ne remplace jamais un record par une valeur moins bonne. Deux passages de
 * suite donnent donc le meme etat, et le second ne corrige rien — c'est ce que
 * le harnais verifie. Il n'y a rien a defaire non plus : la seule ecriture
 * possible est une amelioration, et une amelioration fausse voudrait dire que
 * l'historique porte une course qui n'a pas eu lieu.
 *
 * `races` est plafonne a 300 courses par appareil : les plus anciennes ont pu
 * disparaitre. C'est sans consequence ici — un record efface reste dans
 * `scores`, et on ne le degrade pas.
 *
 * `creer` DECIDE D'AUTRE CHOSE QU'UNE CORRECTION, et vaut false par defaut.
 * Un appareil qui a des courses sans ligne de score n'est pas au classement :
 * lui en creer une l'y fait ENTRER. C'est defendable — il a couru ces temps
 * sous son nom — mais ce n'est plus reparer, c'est changer un tableau public.
 * Mesure sur la production du 6 septembre 2026 : 27 joueurs nommes entreraient
 * au 100 m, le meilleur a 8,35 s, soit la deuxieme place. Cela se decide, et
 * pas dans le code : sans le drapeau, le recalcul se contente de corriger les
 * records de ceux qui sont deja la.
 */
export async function recalculerRecords(db, options = {}) {
  const epreuves = options.epreuves || CLES;
  const creer = options.creer === true;
  const bilan = { epreuves: {}, corriges: 0, crees: 0, anonymes: 0, absents: 0, vus: 0, creer };

  for (const cle of epreuves) {
    const direction = directionDe(cle);
    const agg = agregatSql(direction);
    const part = { vus: 0, corriges: 0, crees: 0, anonymes: 0, absents: 0, ecart_max_ms: 0 };

    // Un appareil, une epreuve, son meilleur resultat : c'est exactement la
    // maille de `scores`. Agreger dans la base plutot que de ramener 2 800
    // courses pour les regrouper de ce cote du fil.
    // Le nom retenu est le DERNIER qui ne soit pas « Anonyme ». Un `name` nu
    // dans un GROUP BY rendrait une ligne quelconque du groupe : sur un
    // appareil qui a couru sous son nom puis sans, on tirerait a pile ou face
    // entre « Zoe » et « Anonyme » — et le sort deciderait qui entre au
    // classement.
    const { results } = await db.prepare(
      `SELECT r.device_id,
              ${agg}(r.time_ms) AS meilleur,
              COUNT(*) AS n,
              (SELECT r2.name FROM races r2
                WHERE r2.device_id = r.device_id AND r2.race_key = r.race_key
                  AND lower(trim(r2.name)) <> 'anonyme'
                ORDER BY r2.created_at DESC LIMIT 1) AS nom
         FROM races r WHERE r.race_key = ? GROUP BY r.device_id`
    ).bind(cle).all();

    for (const r of results || []) {
      part.vus++;
      const ligne = await db.prepare(
        `SELECT best_split_ms FROM scores WHERE device_id = ? AND race_key = ?`
      ).bind(r.device_id, cle).first();

      const ancien = recordDeLaLigne(ligne);
      if (!estMeilleur(direction, r.meilleur, ancien)) continue;

      // Pas de ligne, et on n'a pas demande a en creer : on compte et on
      // passe. Le chiffre a son interet — il dit combien de joueurs le
      // classement ignore — sans que le lire les y fasse entrer.
      if (!ligne && !creer) {
        if (estAnonyme(r.nom)) part.anonymes++; else part.absents++;
        continue;
      }

      const ecart = ancien === null ? 0 : Math.abs(ancien - r.meilleur);
      if (ecart > part.ecart_max_ms) part.ecart_max_ms = ecart;

      const res = await noterRecord(db, {
        deviceId: r.device_id, epreuve: cle, nom: r.nom, valeur: r.meilleur,
      });
      if (res.anonyme) { part.anonymes++; continue; }
      if (!res.record) continue;
      if (ligne) part.corriges++; else part.crees++;
    }

    bilan.epreuves[cle] = part;
    bilan.vus += part.vus;
    bilan.corriges += part.corriges;
    bilan.crees += part.crees;
    bilan.anonymes += part.anonymes;
    bilan.absents += part.absents;
  }

  return bilan;
}
