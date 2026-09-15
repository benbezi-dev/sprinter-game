/* ---------------------------------------------------------------------------
   THROWER — le lancer du poids, tel que le reglement le pose
   ---------------------------------------------------------------------------
   Rien n'est invente ici. La masse de l'engin, le diametre du cercle, la
   hauteur du butoir et l'ouverture du secteur viennent des specifications de
   World Athletics. Le fichier ne contient QUE ces mesures et les records : le
   jeu du lancer — ce qui se paie quand on pousse trop fort, ce que coute un
   mauvais angle — vit dans `poids-jeu.js`. Melanger les deux, c'est ne plus
   pouvoir corriger l'un sans relire l'autre. C'est la meme separation qu'entre
   `haies.js` et `haies-jeu.js`, et pour la meme raison.

   POURQUOI LE POIDS EN PREMIER, ET PAS LE JAVELOT.
   Les quatre lancers demandent quatre gestes differents. Trois d'entre eux
   commencent par un deplacement — une volte pour le disque et le marteau, une
   course d'elan pour le javelot — qu'il faut simuler avant meme d'arriver au
   lancer. Le poids est le seul qui tienne dans un cercle de 2,13 m et dans un
   seul mouvement : on pousse, on lache. C'est la discipline par laquelle un jeu
   de lancers peut commencer sans mentir sur ce qu'il montre.
--------------------------------------------------------------------------- */

/**
 * La masse de l'engin, en kilogrammes.
 *
 * Elle ne sert pas au calcul de la portee — la balistique ne connait que la
 * vitesse, l'angle et la hauteur du lacher, et un poids de 4 kg lance a 14 m/s
 * va exactement aussi loin qu'un de 7,26 kg lance a 14 m/s. Elle sert a ETRE
 * ECRITE : un lanceur qui lit « 7,26 kg » sait de quoi on parle, et c'est ce
 * chiffre qui dit pourquoi les deux tableaux de records ne se comparent pas.
 */
export const MASSE = { hommes: 7.260, femmes: 4.000 };

/** Le cercle de lancer : 2,135 m de diametre, et il n'a jamais change. */
export const CERCLE = 2.135;

/**
 * Le butoir, en bois, a l'avant du cercle.
 *
 * 1,22 m de long, 10 cm de haut. Il ne sert pas a arreter le lanceur — on a le
 * droit de le toucher de l'interieur — il sert a marquer la limite : en
 * toucher le DESSUS, ou sortir du cercle par l'avant, c'est l'essai mordu.
 *
 * C'est de lui que part la mesure, et c'est pour ca qu'il est ici plutot que
 * dans le jeu : la portee se compte depuis son bord interieur, pas depuis le
 * centre du cercle ni depuis la main.
 */
export const BUTOIR = { longueur: 1.22, hauteur: 0.10 };

/** L'ouverture du secteur de chute. Hors, l'essai ne compte pas. */
export const SECTEUR_DEG = 34.92;

/** Six essais en finale, et c'est le meilleur qui compte. */
export const ESSAIS = 6;

/**
 * La hauteur du lacher, en metres.
 *
 * Ce n'est pas une mesure de reglement mais une mesure de lanceur : le poids
 * quitte la main a hauteur d'epaule bras tendu, soit environ 2,10 m pour un
 * homme de 1,95 m. Elle compte enormement — c'est elle qui fait qu'un lanceur
 * de poids n'a pas d'angle optimal a 45° comme un projectile parti du sol.
 */
export const HAUTEUR_LACHER = 2.10;

/**
 * De combien le poids part EN AVANT du butoir, en metres.
 *
 * Le lanceur finit bras tendu au-dessus de la planche : la main est deja
 * au-dela de la ligne quand l'engin s'en va. Le gain est reel et connu — de
 * l'ordre de 20 a 30 cm sur la mesure — et l'ignorer rendait toutes les
 * distances trop courtes d'autant.
 */
export const AVANCE_LACHER = 0.25;

/**
 * Les records du monde, ecrits le 14 septembre 2026.
 *
 * Ils servent de point d'ancrage a l'etape « Championnat du monde », et a rien
 * d'autre. Les garder ici avec leur date et leur auteur evite d'avoir un jour a
 * deviner sur quoi le plateau avait ete cale — et rend la verification
 * possible : ces deux lignes sont a relire avant toute communication publique
 * qui les citerait, elles n'ont pas ete revalidees depuis cette date.
 */
export const RECORDS = {
  hommes: { m: 23.56, qui: 'Ryan Crouser', an: 2023 },
  femmes: { m: 22.63, qui: 'Natalya Lisovskaya', an: 1987 },
};

/** L'acceleration de la pesanteur. Elle non plus n'est pas negociable. */
export const G = 9.81;
