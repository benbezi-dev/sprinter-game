/* ---------------------------------------------------------------------------
   CHAMPIONNATS — tous les nombres au meme endroit
   ---------------------------------------------------------------------------
   Ces valeurs sont des leviers d'equilibrage, pas des constantes de nature.
   Elles bougeront apres les premiers cycles : duree du titre, delais entre
   echelons, seuil d'ouverture d'un pays. Les avoir ici plutot que disperses
   dans le code est ce qui rendra ces reglages possibles sans relire le moteur.
--------------------------------------------------------------------------- */

/** Le format d'une competition : combien on part, comment on se qualifie. */
export const FORMAT = {
  // 32 partants, quatre series de huit, deux demies de huit, une finale.
  partants: 32,
  phases: [
    {
      cle: 'series', nom: 'Séries',
      courses: 4, parCourse: 8,
      // Les deux premiers de chaque course passent, puis on repeche au chrono.
      directsParCourse: 2,
      repechages: 8,
    },
    {
      cle: 'demies', nom: 'Demi-finales',
      courses: 2, parCourse: 8,
      directsParCourse: 2,
      repechages: 4,
    },
    {
      cle: 'finale', nom: 'Finale',
      courses: 1, parCourse: 8,
      directsParCourse: 0,     // la finale ne qualifie pour rien
      repechages: 0,
      podium: 3,
    },
  ],
};

/** Les trois echelons, et ce qui remplit leur grille de depart. */
export const ECHELONS = {
  national: {
    cle: 'national', nom: 'Championnat national',
    // Un pays doit avoir au moins ce nombre de joueurs classes et actifs pour
    // tenir son propre championnat. En dessous, voir `replis`.
    minJoueurs: 32,
    // « Actif » veut dire : au moins un duel classe dans cette fenetre.
    fenetreActiviteJours: 60,
    titre: 'Champion de {zone}',
  },
  continental: {
    cle: 'continental', nom: 'Championnat continental',
    // Chaque champion national du continent est qualifie d'office ; on complete
    // jusqu'a 32 par les mieux classes du continent au classement des duels.
    qualifiesDOffice: 'champions_nationaux',
    complementPar: 'classement_continental',
    semainesApresPrecedent: 3,
    titre: 'Champion d’{zone}',
  },
  mondial: {
    cle: 'mondial', nom: 'Championnat du monde',
    qualifiesDOffice: 'champions_continentaux',
    complementPar: 'classement_mondial',
    semainesApresPrecedent: 4,
    titre: 'Champion du monde',
  },
};

/**
 * Ce qu'on exige d'un pool de qualification avant d'ouvrir une edition.
 *
 * Un continental a besoin de champions nationaux pour exister : ouvrir un
 * continental sans aucun champion sacre produirait une competition qui porte
 * le nom d'un continent et n'en represente rien. On demande donc un minimum de
 * qualifies d'office, faute de quoi l'edition attend le cycle suivant.
 */
export const MIN_DOFFICE = { continental: 2, mondial: 2 };

/**
 * Combien de temps un titre se porte.
 *
 * Trois mois : assez long pour que le titre vaille quelque chose et que son
 * porteur soit identifiable une vraie saison, assez court pour que les
 * pretendants aient une echeance reguliere et que le classement des duels
 * reste vivant entre deux sacres. Quatre championnats nationaux par an.
 */
export const TITRE_MOIS = 3;

/**
 * Ce qu'on fait d'un pays qui n'a pas assez de joueurs.
 *
 * 'attendre' est le repli par defaut : le pays ne tient pas de championnat ce
 * cycle-ci, et ses joueurs restent eligibles au repechage continental. C'est
 * moins brutal qu'une exclusion definitive et plus simple qu'un regroupement
 * regional, qui demanderait de decider quels pays vont ensemble.
 */
export const REPLI_PAYS_TROP_PETIT = 'attendre';

/**
 * Le calendrier d'un weekend, en minutes depuis minuit UTC.
 *
 * Tout est en UTC parce que « le meme weekend, partout » n'a de sens que sur
 * une horloge commune : c'est l'heure d'affichage qui se traduit chez le
 * joueur, pas l'heure de la course. Le samedi porte les series, le dimanche
 * les demies et la finale.
 *
 * Les espacements ne sont pas decoratifs : une heure et demie entre deux
 * series laisse le temps aux resumes, et surtout empeche de tout consommer
 * d'un coup. Les huit repeches ne sont reveles qu'apres la derniere serie —
 * c'est le seul moment de la competition ou le suspense est fabrique plutot
 * que couru.
 */
export const CALENDRIER = {
  jour1: [
    { cle: 'serie-1',      phase: 'series', course: 1, minute: 9 * 60 },
    { cle: 'serie-2',      phase: 'series', course: 2, minute: 10 * 60 + 30 },
    { cle: 'serie-3',      phase: 'series', course: 3, minute: 14 * 60 },
    { cle: 'serie-4',      phase: 'series', course: 4, minute: 15 * 60 + 30 },
    { cle: 'reveal-demies', phase: 'series', reveal: true, minute: 19 * 60 },
  ],
  jour2: [
    { cle: 'demie-1',      phase: 'demies', course: 1, minute: 10 * 60 + 30 },
    { cle: 'demie-2',      phase: 'demies', course: 2, minute: 13 * 60 + 30 },
    { cle: 'reveal-finale', phase: 'demies', reveal: true, minute: 14 * 60 + 30 },
    { cle: 'finale',       phase: 'finale', course: 1, minute: 19 * 60 },
    { cle: 'sacre',        phase: 'finale', ceremonie: true, minute: 19 * 60 + 20 },
  ],
};

/** Les moments qui meritent de sortir une notification. */
export const ANNONCES = new Set([
  'ouverture', 'serie-depart', 'qualification-directe', 'reveal-demies',
  'demie-depart', 'reveal-finale', 'finale-depart', 'sacre',
]);

/**
 * Departage de deux chronos rigoureusement egaux.
 *
 * Sur des millisemes l'egalite est rare mais pas impossible, et un classement
 * qui depend de l'ordre d'insertion en base serait arbitraire sans le dire.
 * On tranche donc explicitement, dans cet ordre :
 *   1. le meilleur chrono de la phase precedente (celui qui arrive de plus loin) ;
 *   2. le meilleur rang au classement des duels a la cloture ;
 *   3. la cle du joueur, pour que le resultat soit au moins reproductible.
 */
export const DEPARTAGE = ['chrono_precedent', 'rang_duel', 'cle'];
