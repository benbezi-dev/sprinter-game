// La preuve d'une course, et ce qu'elle vaut.
//
// CE QUE CE MODULE FAIT, ET CE QU'IL NE FAIT PAS. Il ne rend pas la triche
// impossible : le jeu tourne dans le navigateur du joueur, et qui sait ouvrir
// les outils de developpement peut fabriquer une course entiere. Rendre cela
// impossible demanderait de rejouer la course sur le serveur, donc d'y porter
// le moteur — un autre projet.
//
// Il fait autre chose, qui manquait completement : il fait passer la triche du
// statut de « une ligne a poster » a celui de « une course a fabriquer ». Avant
// lui, `POST /objectif/tentative {nom, ms}` suffisait, sans le moindre
// identifiant d'appareil : n'importe qui pouvait valider l'objectif de
// n'importe quel joueur du classement, ou s'attribuer un 5,00 s. C'etait
// gratuit, anonyme et instantane.
//
// LA PREUVE EST LA TRACE. Le jeu echantillonne la distance du coureur toutes
// les quatre-vingts millisecondes, et s'en sert deja pour rejouer une course en
// fantome. Elle dit donc la FORME de la course, pas seulement son resultat, et
// une forme se verifie : elle avance sans reculer, elle atteint la ligne, elle
// l'atteint a l'instant qu'annonce le chrono, et elle ne franchit jamais une
// vitesse que la physique du jeu interdit.
//
// LES SEUILS VIENNENT D'UNE VRAIE COURSE, pas d'un raisonnement. Course jouee
// le 6 septembre 2026, 100 m en 13,858 s : 211 points de trace, ligne franchie
// au point 174 — soit 13,92 s, moins d'un pas d'ecart avec le chrono —, aucune
// decroissance, pointe a 13,75 m/s. Tout ce qui suit est cale la-dessus.

/** Le pas d'echantillonnage du jeu, en secondes. A TENIR D'ACCORD avec
 *  REC_STEP dans sprinter-app.js. */
export const PAS_S = 0.08;

/** La trace est en DECIMETRES : le jeu range `Math.round(distance * 10)`. */
const DM_PAR_M = 10;

/** Les distances, en metres. */
const DISTANCE = { '100': 100, '200': 200, '400': 400 };

/**
 * Le plafond de vitesse, en m/s.
 *
 * Genereux, et volontairement : la course mesuree pointe a 13,75 m/s sur un
 * seul intervalle alors que le moteur plafonne a 12,435 m/s. L'ecart vient de
 * l'arrondi au decimetre sur un pas de 80 ms — un decimetre de trop sur un
 * intervalle fait 1,25 m/s d'erreur apparente. Un seuil serre rejetterait donc
 * des courses honnetes. Celui-ci n'attrape que l'invraisemblable.
 */
const VITESSE_MAX_MS = 18;

/** Deux pas de tolerance entre la ligne et le chrono annonce. La course
 *  mesuree en demande un ; on en laisse deux, l'arrondi jouant des deux cotes. */
const TOLERANCE_PAS = 2;

/**
 * Cette trace soutient-elle ce chrono ?
 *
 * Rend la liste de ce qui cloche — vide quand tout va bien. Une liste plutot
 * qu'un booleen : quand une course est refusee, savoir POURQUOI est la seule
 * chose qui permette de distinguer un tricheur d'un bug de notre cote.
 *
 * @param {number[]} trace   Distances en decimetres, un point tous les PAS_S.
 * @param {number} tempsMs   Le chrono annonce.
 * @param {string} epreuve   '100', '200' ou '400'.
 */
export function verifierTrace(trace, tempsMs, epreuve) {
  const griefs = [];
  const metres = DISTANCE[String(epreuve)];
  if (!metres) return ['epreuve inconnue'];
  if (!Array.isArray(trace) || trace.length < 2) return ['trace absente'];

  const ligneDm = metres * DM_PAR_M;
  const pasMaxDm = VITESSE_MAX_MS * PAS_S * DM_PAR_M;

  let recule = 0, tropVite = 0;
  for (let i = 1; i < trace.length; i++) {
    const a = Number(trace[i - 1]), b = Number(trace[i]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return ['trace illisible'];
    const d = b - a;
    if (d < 0) recule++;
    if (d > pasMaxDm) tropVite++;
  }
  // Un coureur ne recule pas. C'est la verification la moins couteuse et celle
  // qu'une trace inventee a la main rate presque toujours.
  if (recule) griefs.push(`recule ${recule} fois`);
  if (tropVite) griefs.push(`depasse ${VITESSE_MAX_MS} m/s a ${tropVite} endroits`);

  const arrivee = trace.findIndex(d => Number(d) >= ligneDm);
  if (arrivee < 0) {
    griefs.push(`n'atteint jamais ${metres} m`);
    return griefs;
  }

  // Le chrono annonce doit tomber sur le point ou la trace franchit la ligne.
  // C'est le lien entre la forme et le resultat, et c'est lui qui empeche de
  // joindre une vraie trace a un faux chrono.
  const tTrace = arrivee * PAS_S;
  const ecart = Math.abs(tTrace - tempsMs / 1000);
  if (ecart > TOLERANCE_PAS * PAS_S) {
    griefs.push(`la ligne est franchie a ${tTrace.toFixed(2)} s, ` +
                `le chrono annonce ${(tempsMs / 1000).toFixed(2)} s`);
  }
  return griefs;
}

/* ----------------------------------------------------------- la vraisemblance

   Une course peut etre parfaitement formee et rester incroyable : celle d'un
   joueur qui tourne a 10,50 s depuis deux mois et rend soudain 8,20 s.

   ON NE REFUSE PAS POUR AUTANT, et c'est un choix. Un joueur progresse, un
   joueur s'entraine, un joueur prete son telephone a quelqu'un de meilleur.
   Refuser sur un soupcon, c'est reprendre son record a quelqu'un qui vient de
   le battre — la pire chose qu'on puisse faire au bon joueur pour attraper le
   mauvais. On note, et on regarde. */

/** Au-dela de cette amelioration d'un coup, on signale. */
export const BOND_SUSPECT = 0.12;

/**
 * Ce resultat est-il vraisemblable au vu du passe du joueur ?
 *
 * @param {number} tempsMs  Le chrono annonce.
 * @param {number} pbMs     Son record avant cette course.
 * @param {number} courses  Combien de courses il a a son historique.
 */
export function vraisemblance(tempsMs, pbMs, courses) {
  // Sans passe, il n'y a rien a comparer. Un premier chrono n'est jamais un
  // bond : il est le point de depart.
  if (!pbMs || !Number.isFinite(pbMs) || courses < 5) {
    return { suspect: false, bond: 0 };
  }
  const bond = (pbMs - tempsMs) / pbMs;
  return { suspect: bond > BOND_SUSPECT, bond };
}

/* ------------------------------------------------------ courses suspectes

   LE NOM DE CETTE TABLE A DEJA COUTE UNE PANNE. Elle s'appelait `signalements`,
   et une table de ce nom existe deja en production : celle de la moderation des
   duels — motif, verdict, mot, voix. `CREATE TABLE IF NOT EXISTS` n'a donc rien
   cree, l'index a echoue sur une colonne absente, et la route rendait 500.

   Pire : `signaler` avale ses erreurs par construction — une suspicion ne doit
   pas faire echouer l'enregistrement d'une course — si bien que PAS UN SEUL
   signalement n'a jamais ete ecrit, sans que rien le dise. Le catch reste, mais
   il laisse desormais une trace dans le journal.

   La table de moderation est vide aujourd'hui et aucune route ne la sert. Ce
   n'est pas une raison pour lui prendre son nom : un nom qui veut deja dire
   quelque chose est un piege qui se referme sur le suivant. */

const pretes = new WeakSet();

export async function ensureSuspectes(db) {
  if (pretes.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS courses_suspectes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_key TEXT NOT NULL,
    device_id TEXT,
    quoi TEXT NOT NULL,
    detail TEXT,
    temps_ms INTEGER,
    pb_ms INTEGER,
    cree_le INTEGER NOT NULL,
    revu_le INTEGER
  )`).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS courses_suspectes_par_joueur
       ON courses_suspectes (name_key, cree_le)`).run();
  pretes.add(db);
}

/**
 * Note quelque chose a regarder. N'interrompt jamais ce qui se passe.
 *
 * Un signalement qui ferait echouer l'enregistrement d'une course serait pire
 * que pas de signalement du tout : il transformerait une suspicion en perte de
 * donnees pour un joueur honnete.
 */
export async function signaler(db, { nameKey, deviceId, quoi, detail, tempsMs, pbMs }) {
  try {
    await ensureSuspectes(db);
    await db.prepare(
      `INSERT INTO courses_suspectes
         (name_key, device_id, quoi, detail, temps_ms, pb_ms, cree_le)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(nameKey, deviceId || null, quoi,
           detail ? String(detail).slice(0, 500) : null,
           tempsMs || null, pbMs || null, Date.now()).run();
  } catch (e) {
    // On continue — une suspicion ne fait pas echouer une course — mais on le
    // DIT. Ce catch a cache une collision de nom pendant toute une journee :
    // rien ne s'ecrivait, et rien ne s'en plaignait.
    console.log('suspecte KO', String((e && e.message) || e));
  }
}

/** Ce qu'il y a a regarder. Sous cle d'administration. */
export async function listerSuspectes(db, limite = 100) {
  await ensureSuspectes(db);
  const { results } = await db.prepare(
    `SELECT * FROM courses_suspectes WHERE revu_le IS NULL
      ORDER BY cree_le DESC LIMIT ?`
  ).bind(Math.min(limite, 500)).all();
  return results || [];
}
