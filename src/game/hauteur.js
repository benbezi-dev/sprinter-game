/* ---------------------------------------------------------------------------
   JUMPER — le saut en hauteur, tel que le reglement le pose
   ---------------------------------------------------------------------------
   Ce fichier ne contient QUE les cotes de World Athletics, le deroulement du
   concours et les records. Le jeu du saut — ce que coute un appel trop pres,
   un elan trop rapide, une cambrure trop tardive — vit dans `hauteur-jeu.js`,
   et la mise en piste dans `hauteur-course.js`. C'est la separation de
   `longueur.js` et `longueur-jeu.js`, pour la meme raison : on doit pouvoir
   corriger une regle sans relire le rendu.

   Les cotes sont celles des Regles techniques (TR 25, 26 et 27, Competition
   Rules C1.1 de World Athletics). Elles se retrouvent a l'ecran — l'aire
   d'elan, les montants, la barre, le tapis — et c'est pour cela qu'elles
   vivent ici : une barre dessinee trop courte serait un mensonge visible, a
   cote d'un athlete a la bonne taille.
--------------------------------------------------------------------------- */

/**
 * L'aire d'elan, en metres.
 *
 * Quinze metres au moins ; vingt aux grands championnats, et vingt-cinq la ou
 * le stade le permet. On y court en J : quelques foulees droites, face au
 * tapis, puis une courbe qui amene l'athlete de biais contre la barre. Le jeu
 * dessine la piste recommandee, et fait partir l'athlete a vingt-deux metres
 * de son appel en suivant ce J — ce que prennent les meilleurs, dix foulees.
 */
export const AIRE_ELAN = { minimum: 15, championnat: 20, recommandee: 25 };

/**
 * LES MONTANTS. Rigides, ecartes de 4,00 a 4,04 m, et depassant d'au moins
 * dix centimetres la plus haute barre qu'ils porteront. Entre eux et le tapis,
 * dix centimetres au moins : un tapis qui bouge ne doit pas faire tomber la
 * barre en poussant un montant.
 */
export const MONTANTS = { ecart: 4.02, ecartMin: 4.00, ecartMax: 4.04, depasse: 0.10, jeuTapis: 0.10 };

/**
 * LA BARRE. Fibre de verre ou equivalent, de section ronde : 3,98 a 4,02 m,
 * 29 a 31 mm de diametre, deux kilos au plus. Elle ne doit pas flechir de plus
 * de deux centimetres sous son propre poids.
 *
 * Elle repose sur deux TAQUETS plats et rectangulaires, de 40 x 60 mm, tournes
 * l'un vers l'autre : une barre effleuree peut y trembler et y rester — c'est
 * le moment le plus long d'un concours de hauteur.
 */
export const BARRE = { longueur: 4.00, diametre: 0.030, masse: 2.0, flecheMax: 0.02, fleche: 0.012 };
export const TAQUETS = { largeur: 0.04, longueur: 0.06 };

/**
 * LE TAPIS DE RECEPTION : six metres de large, quatre de profondeur derriere le
 * plan de la barre, soixante-dix centimetres de haut. C'est le minimum ; on
 * n'en voit pas d'autre dans un grand stade.
 */
export const TAPIS = { largeur: 6.0, profondeur: 4.0, hauteur: 0.70 };

/**
 * LA MESURE : du sol, a la verticale, jusqu'au point le plus bas du dessus de
 * la barre. En centimetres entiers. On mesure chaque nouvelle hauteur avant
 * que quiconque la tente.
 */
export function cm(metres) {
  return Math.round(metres * 100);
}

/** Une hauteur ecrite comme au tableau : « 2,24 ». */
export function lireHauteur(m, virgule = ',') {
  return (cm(m) / 100).toFixed(2).replace('.', virgule);
}

/**
 * LA MONTEE DE LA BARRE.
 *
 * Jamais moins de deux centimetres d'une hauteur a la suivante, et l'ecart ne
 * grandit jamais : 5, 5, 4, 3, 3, 2 est une progression, 3, 4 n'en est pas
 * une. Quand il ne reste qu'un athlete et qu'il a gagne, c'est lui qui choisit
 * — la regle ne lui impose alors plus rien, et c'est ainsi que se tentent les
 * records.
 */
export const MONTEE_MIN = 0.02;

/** La progression est-elle reglementaire ? */
export function progressionValide(hauteurs) {
  let pas = Infinity;
  for (let i = 1; i < hauteurs.length; i++) {
    const d = cm(hauteurs[i]) - cm(hauteurs[i - 1]);
    if (d < cm(MONTEE_MIN) || d > pas) return false;
    pas = d;
  }
  return true;
}

/**
 * LES ESSAIS. Trois echecs CONSECUTIFS eliminent, quelle que soit la hauteur a
 * laquelle ils tombent. On peut commencer a n'importe quelle hauteur annoncee,
 * et PASSER n'importe laquelle — meme apres un echec : les essais qui restent
 * se reportent a la suivante. Un athlete qui a manque une fois a 2,30 m et
 * passe n'a plus que deux essais a 2,33 m.
 */
export const ECHECS_ELIMINATOIRES = 3;

/**
 * LE TEMPS D'UN ESSAI, en secondes, a partir de l'appel de l'athlete. Il se
 * resserre sur ceux qui restent — un athlete seul en a trois minutes — et
 * s'allonge quand le meme athlete saute deux fois de suite.
 */
export const TEMPS = { plusDeTrois: 60, deuxOuTrois: 90, seul: 180, consecutifs: 120 };

/** Le temps accorde a un essai. */
export function tempsEssai(enLice, consecutif = false) {
  if (enLice <= 1) return TEMPS.seul;
  if (consecutif) return TEMPS.consecutifs;
  return enLice <= 3 ? TEMPS.deuxOuTrois : TEMPS.plusDeTrois;
}

/**
 * LES ECHECS (TR 27.2). Un essai est manque quand :
 *   - la barre ne tient pas sur ses taquets, du fait de l'athlete ;
 *   - l'athlete touche le sol ou le tapis au-dela du plan des montants avant
 *     d'avoir franchi la barre — sauf un pied qui touche le tapis sans lui
 *     donner d'avantage, ce que le juge apprecie ;
 *   - il touche la barre ou les montants en passant dessous sans sauter.
 * L'appel se prend sur un seul pied.
 */
export const ECHECS = ['barre', 'dessous', 'temps'];

/**
 * LES RECORDS DU MONDE, ecrits le 27 septembre 2026.
 *
 * Ils servent de point d'ancrage au plateau du championnat du monde et au
 * dernier bond de la barre, et a rien d'autre. Ils sont a relire avant toute
 * communication publique qui les citerait.
 */
export const RECORDS = {
  hommes: { m: 2.45, qui: 'Javier Sotomayor', an: 1993, lieu: 'Salamanque' },
  femmes: { m: 2.10, qui: 'Yaroslava Mahuchikh', an: 2024, lieu: 'Paris' },
};

/** L'acceleration de la pesanteur, sur Terre. */
export const G = 9.81;
