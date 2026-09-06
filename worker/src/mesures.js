// Ce qu'on saura de l'Objectif du jour une fois qu'il tournera.
//
// SEPT CHIFFRES, ET UN SEUL DECIDE. Le KPI est « au moins trois courses par
// defi » : c'est lui qui dit si le systeme fait ce pour quoi il existe. Les six
// autres servent a comprendre pourquoi il ne le fait pas, le jour ou il ne le
// fera pas.
//
// TOUT SE LIT DANS DES TABLES QUI EXISTENT DEJA — `objectifs` porte les
// tentatives et les paliers, `notif_journal` les envois et les ouvertures,
// `races` les courses. Rien n'est instrumente en plus : un compteur qu'il faut
// penser a incrementer est un compteur qui finit par mentir.
//
// CE QU'ON NE PEUT PAS MESURER, ET IL FAUT LE DIRE. Le taux de reussite du
// PREMIER essai n'est pas connu : on garde le nombre de tentatives et le
// meilleur resultat, pas l'histoire de chacune. « A-t-il valide du premier
// coup » se deduit (une tentative et un palier atteint), « a-t-il rate la
// premiere puis reussi la troisieme » ne se deduit pas. Ajouter une ligne par
// tentative reglerait la question ; ce n'est pas fait, et les taux ci-dessous
// s'arretent la ou cette donnee manque.

import { ensureJournal } from './journal.js';

const jour = () => 86400000;

/**
 * Le chiffre qui compte : combien de courses par defi.
 *
 * Compte parmi les defis JOUES, pas parmi les defis crees : melanger les deux
 * donne une moyenne qui baisse quand on sert plus de monde, ce qui n'a aucun
 * sens.
 */
export async function coursesParDefi(db, depuis) {
  const r = await db.prepare(
    `SELECT COUNT(*) AS defis_joues,
            SUM(tentatives) AS courses,
            SUM(CASE WHEN tentatives >= 3 THEN 1 ELSE 0 END) AS au_moins_trois,
            SUM(CASE WHEN tentatives = 1 THEN 1 ELSE 0 END) AS une_seule
       FROM objectifs
      WHERE cree_le >= ? AND tentatives > 0`).bind(depuis).first();

  const joues = r?.defis_joues || 0;
  return {
    defis_joues: joues,
    courses: r?.courses || 0,
    moyenne: joues ? Math.round((r.courses / joues) * 100) / 100 : null,
    au_moins_trois: r?.au_moins_trois || 0,
    part_au_moins_trois: joues
      ? Math.round((r.au_moins_trois / joues) * 1000) / 10 : null,
    une_seule: r?.une_seule || 0,
  };
}

/** Combien de defis servis ont ete joues. */
export async function participation(db, depuis) {
  const r = await db.prepare(
    `SELECT COUNT(*) AS servis,
            SUM(CASE WHEN tentatives > 0 THEN 1 ELSE 0 END) AS joues
       FROM objectifs WHERE cree_le >= ?`).bind(depuis).first();
  const servis = r?.servis || 0;
  return {
    servis, joues: r?.joues || 0,
    taux: servis ? Math.round((r.joues / servis) * 1000) / 10 : null,
  };
}

/** Ce que les joueurs decrochent. */
export async function paliers(db, depuis) {
  const { results } = await db.prepare(
    `SELECT COALESCE(palier, 'rien') AS palier, COUNT(*) AS n
       FROM objectifs WHERE cree_le >= ? AND tentatives > 0
      GROUP BY COALESCE(palier, 'rien')`).bind(depuis).all();
  const total = (results || []).reduce((a, r) => a + r.n, 0);
  return (results || []).map(r => ({
    ...r, part: total ? Math.round((r.n / total) * 1000) / 10 : 0,
  }));
}

/**
 * Le taux de revanche : apres une course qui n'a pas suffi, y en a-t-il eu une
 * autre ?
 *
 * Approximation assumee. On ne garde pas le detail des tentatives : « a valide
 * du premier coup » se lit (une seule tentative et un palier d'argent ou
 * mieux), et tout le reste des defis joues a connu au moins un echec. Parmi
 * ceux-la, ceux qui comptent deux tentatives ou plus ont pris leur revanche.
 */
export async function revanche(db, depuis) {
  // COALESCE SUR LE PALIER, ET CE N'EST PAS UNE PRECAUTION.
  //
  // `palier` vaut NULL quand la course n'a rien decroche. Or en SQL,
  // `NULL IN ('argent','or')` ne vaut pas faux : il vaut NULL, que `AND`
  // propage, que `NOT` propage encore, et qu'un `CASE WHEN` compte comme zero.
  // Le joueur qui a couru une fois sans rien obtenir — exactement celui qui a
  // rate et n'a PAS pris sa revanche — disparaissait donc du denominateur, et
  // le taux montait tout seul. Mesure sur cinq defis de test : 100 % annonce
  // pour 67 % reels.
  const r = await db.prepare(
    `SELECT
       SUM(CASE WHEN NOT (tentatives = 1
                          AND COALESCE(palier, '') IN ('argent','or'))
                THEN 1 ELSE 0 END) AS apres_echec,
       SUM(CASE WHEN tentatives >= 2 THEN 1 ELSE 0 END) AS relances
       FROM objectifs WHERE cree_le >= ? AND tentatives > 0`).bind(depuis).first();
  const base = r?.apres_echec || 0;
  return {
    apres_echec: base, relances: r?.relances || 0,
    taux: base ? Math.round(((r.relances || 0) / base) * 1000) / 10 : null,
  };
}

/**
 * La retention : parmi ceux qui ont recu un objectif un jour donne, combien
 * ont couru le lendemain, et sept jours apres.
 *
 * Mesuree sur les COURSES et non sur les objectifs : revenir jouer est ce
 * qu'on veut, valider un defi n'en est qu'une facon.
 */
export async function retention(db, depuis) {
  const lignes = [];
  for (const n of [1, 7]) {
    // `date(jour, '+N days')`, et pas l'arithmetique julienne que j'avais
    // ecrite : `date()` sur un nombre l'interprete comme un jour julien, et
    // lui retrancher l'epoque Unix donnait une date qui ne correspondait a
    // rien. La requete ne plantait pas — elle rendait zero, tout le temps,
    // ce qui ressemble a « personne ne revient » et se lit comme un resultat.
    const r = await db.prepare(
      `WITH servis AS (
         SELECT DISTINCT name_key, jour FROM objectifs
          WHERE cree_le >= ? AND cree_le < ?
       )
       SELECT COUNT(*) AS cohorte,
              SUM(CASE WHEN EXISTS (
                    SELECT 1 FROM races r
                     WHERE r.name_key = s.name_key
                       AND date(r.created_at / 1000, 'unixepoch')
                           = date(s.jour, '+' || ? || ' days')
                  ) THEN 1 ELSE 0 END) AS revenus
         FROM servis s`
    ).bind(depuis, Date.now() - n * jour(), n).first();
    const c = r?.cohorte || 0;
    lignes.push({
      jour: `J${n}`, cohorte: c, revenus: r?.revenus || 0,
      taux: c ? Math.round(((r.revenus || 0) / c) * 1000) / 10 : null,
    });
  }
  return lignes;
}

/**
 * Les desabonnements.
 *
 * Deux formes, et elles ne disent pas la meme chose : couper les notifications
 * pour de bon, et demander a n'en recevoir qu'une par jour. La seconde est une
 * negociation, la premiere une porte qui se ferme — les confondre reviendrait
 * a lire un depart la ou il y a un compromis.
 */
export async function desabonnements(db, depuis) {
  await ensureJournal(db);
  const coupes = await db.prepare(
    `SELECT COUNT(*) AS n FROM notif_journal
      WHERE type = 'desabonnement' AND envoye_le >= ?`).bind(depuis).first();
  const ralentis = await db.prepare(
    `SELECT COUNT(*) AS n FROM notif_prefs
      WHERE rythme = 'un' AND maj_le >= ?`).bind(depuis).first();
  return { coupes: coupes?.n || 0, ralentis_par_choix: ralentis?.n || 0 };
}

/** Tout, d'un coup. */
export async function mesures(db, jours = 30) {
  await ensureJournal(db);
  const depuis = Date.now() - jours * jour();
  return {
    jours,
    kpi_courses_par_defi: await coursesParDefi(db, depuis),
    participation: await participation(db, depuis),
    paliers: await paliers(db, depuis),
    revanche: await revanche(db, depuis),
    retention: await retention(db, depuis),
    desabonnements: await desabonnements(db, depuis),
  };
}
