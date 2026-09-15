/* ---------------------------------------------------------------------------
   THROWER — le jeu du poids
   ---------------------------------------------------------------------------
   Le reglement est dans `poids.js`. Ici vit ce qui se decide : la poussee,
   l'angle, et ce qu'on paie quand on veut trop.

   LE PROBLEME QUE CE FICHIER RESOUT.

   Sprinter tient sur un geste repete — gauche, droite, gauche — et la course
   dure dix secondes. Un lancer, c'est un geste UNIQUE, et il est fini avant
   d'avoir commence. Toute la difficulte est la : il faut qu'une seule pression
   porte assez de decision pour qu'on ait envie de recommencer six fois.

   La reponse tenue ici : DEUX decisions successives, et une troisieme qui est
   un risque. On regle la poussee, puis l'angle, et pousser plus fort que ce
   qu'on tient fait mordre. Ce sont exactement les trois choses qu'un lanceur
   arbitre dans le cercle, et ce sont les trois seules.
--------------------------------------------------------------------------- */

import { G, HAUTEUR_LACHER, AVANCE_LACHER } from './poids.js';

/**
 * LA PORTEE D'UN LANCER, en metres.
 *
 * C'est de la balistique, sans rien de plus : un projectile parti d'une hauteur
 * `h` a la vitesse `v` sous l'angle `a` retombe a
 *
 *     d = (v·cos a / g) · ( v·sin a + racine( v²·sin²a + 2·g·h ) )
 *
 * On y ajoute l'avance du lacher, parce que la mesure part du butoir et non de
 * la main.
 *
 * Aucune resistance de l'air. Ce n'est pas une simplification paresseuse :
 * pour une sphere de 7,26 kg et 12 cm lancee a 15 m/s, la trainee retire moins
 * de 2 cm sur 23 m. Elle est sous la precision de la mesure officielle, qui
 * s'arrete au centimetre.
 */
export function portee(v, angleDeg) {
  if (!(v > 0)) return 0;
  const a = angleDeg * Math.PI / 180;
  const s = Math.sin(a), c = Math.cos(a);
  const h = HAUTEUR_LACHER;
  return (v * c / G) * (v * s + Math.sqrt(v * v * s * s + 2 * G * h)) + AVANCE_LACHER;
}

/**
 * DE COMBIEN LA VITESSE TOMBE QUAND L'ANGLE MONTE, en m/s par degre.
 *
 * C'est la constante qui fait tout le jeu de l'angle, et c'est aussi la seule
 * qui ne se lise nulle part dans un reglement.
 *
 * Un projectile parti du sol part au mieux a 45°, et un poids parti de 2,10 m
 * de haut devrait partir vers 42°. Or aucun lanceur ne lache a 42° : les
 * mesures sur les finales internationales donnent 36 a 38°, et ceux qui montent
 * plus haut lancent moins loin. La raison est mecanique — pousser vers le haut,
 * c'est pousser contre son propre poids, et le bras ne rend pas la meme vitesse
 * selon la direction. Un modele qui l'ignore rend un jeu ou la bonne reponse
 * est 42°, c'est-a-dire un jeu qui apprend quelque chose de faux.
 *
 * On fait donc decroitre la vitesse avec l'angle, a partir de 30° pris comme
 * repere bas. Le coefficient a ete regle par la seule verification qui vaille :
 * chercher, pour chaque valeur, l'angle qui maximise la portee.
 *
 *     0,00  ->  optimum a 42,5°   (le projectile nu : faux)
 *     0,03  ->  optimum a 38,6°
 *     0,04  ->  optimum a 37,3°   <- retenu
 *     0,05  ->  optimum a 36,1°
 *     0,09  ->  optimum a 31,5°   (plus personne ne leve le bras)
 *
 * A 0,04, l'optimum tombe a 37,3° et la portee maximale de l'etape mondiale a
 * 23,57 m. Les deux nombres sont justes en meme temps, et c'est ce qui donne
 * confiance dans le reglage : on ne les a pas cherches separement.
 */
export const COUT_ANGLE = 0.04;

/** L'angle de reference d'ou part la decroissance. */
const ANGLE_REPERE = 30;

/** La vitesse reellement obtenue, une fois l'angle choisi. */
export function vitesseA(vBase, angleDeg) {
  return Math.max(0, vBase - COUT_ANGLE * (angleDeg - ANGLE_REPERE));
}

/**
 * Les bornes de l'aiguille de l'angle.
 *
 * Assez larges pour qu'un mauvais choix coute vraiment : a l'etape mondiale,
 * 12° rend 16,45 m et 37° en rend 23,57. Sept metres separent le bon geste du
 * mauvais, alors que la fenetre 32-42° ne se joue qu'a 37 cm. C'est voulu, et
 * c'est fidele : dans un cercle, l'angle se rate en grand ou se reussit en
 * gros, il ne se cisele pas.
 */
export const ANGLE_MIN = 12;
export const ANGLE_MAX = 62;

/**
 * OU COMMENCE LA ZONE ROUGE DE LA POUSSEE.
 *
 * Au-dela, l'essai est mordu. Le seuil est VISIBLE sur la jauge, et le
 * depassement est DETERMINISTE : s'arreter dans le rouge fait toujours mordre,
 * s'arreter dessous ne fait jamais mordre.
 *
 * Un tirage au sort aurait ete plus proche de la realite d'un lanceur — on ne
 * sait pas d'avance si on va sortir du cercle. Il aurait surtout ete injouable :
 * perdre un essai sur six par un hasard qu'on ne voit pas venir, c'est un jeu
 * qu'on accuse au lieu de le rejouer. Le rouge visible dit la meme chose
 * autrement : la meilleure poussee legale est juste dessous, la jauge va vite,
 * et s'arreter a un pour cent pres est exactement l'adresse qu'on demande.
 */
export const SEUIL_MORSURE = 0.92;

/**
 * Ce que rend la jauge de poussee, en part de la vitesse de l'etape.
 *
 * Une jauge a zero ne doit pas rendre zero : un lancer rate reste un lancer,
 * et un debutant qui pousse mal envoie tout de meme l'engin a deux tiers de sa
 * distance. 0,55 est le plancher, et il met un lancer completement manque a
 * 55 % de la vitesse — soit environ 40 % de la distance, la balistique etant
 * quadratique.
 */
export const POUSSEE_PLANCHER = 0.55;

/**
 * LA VITESSE DE LACHER DE CHAQUE ETAPE, en m/s.
 *
 * Ce sont les six memes etapes que Sprinter, dans le meme ordre, et elles se
 * lisent avec `levelName`. La valeur est celle qu'on obtient EN S'ARRETANT
 * PILE AU SEUIL — pas celle du haut de la jauge, qui n'est jamais atteignable
 * sans mordre.
 *
 * Les distances qui en decoulent, a l'angle optimal :
 *
 *     Competition scolaire   10,00 m/s -> 11,87 m
 *     Niveau regional        11,55 m/s -> 15,09 m
 *     Niveau national        12,95 m/s -> 18,40 m
 *     Championnat du monde   14,86 m/s -> 23,57 m   (record du monde : 23,56)
 *     0.Games                16,40 m/s -> 28,28 m
 *     Intergalactique        18,20 m/s -> 34,40 m
 *
 * L'etape mondiale a ete calee sur le record, et les autres etalees autour.
 * Les deux dernieres le depassent franchement : c'est la regle de la maison —
 * les quatre premieres etapes sont de l'athletisme, les deux dernieres n'en
 * sont plus, et elles l'annoncent par leur nom.
 */
export const VITESSE_ETAPE = [10.00, 11.55, 12.95, 14.86, 16.40, 18.20];

/** La vitesse de base, pour une etape et une poussee de 0 a 1. */
export function vitesseDe(etape, poussee) {
  const cible = VITESSE_ETAPE[Math.max(0, Math.min(VITESSE_ETAPE.length - 1, etape))];
  const plancher = cible * POUSSEE_PLANCHER;
  // La jauge au seuil rend exactement `cible`. Au-dela, la valeur n'a aucune
  // importance : l'essai est mordu et ne se mesure pas.
  const part = Math.max(0, Math.min(1, poussee)) / SEUIL_MORSURE;
  return plancher + part * (cible - plancher);
}

/**
 * UN ESSAI, du geste a la marque.
 *
 * Rend toujours le meme objet, mordu ou non — un essai mordu reste un essai, il
 * compte dans les six, et l'ecran doit pouvoir le montrer plutot que de faire
 * comme s'il n'avait pas eu lieu.
 */
export function essai({ etape, poussee, angle }) {
  const mordu = poussee > SEUIL_MORSURE;
  const vBase = vitesseDe(etape, poussee);
  const v = vitesseA(vBase, angle);
  return {
    mordu,
    poussee, angle,
    vitesse: mordu ? 0 : v,
    metres: mordu ? 0 : portee(v, angle),
  };
}

/**
 * La meilleure marque d'une serie, en metres. Zero tant que rien n'est valide.
 *
 * C'est la regle du concours : on garde le meilleur des six, et les cinq
 * autres ne servent qu'a l'avoir tente.
 */
export function meilleur(essais) {
  return (essais || []).reduce((m, e) => (e && !e.mordu && e.metres > m ? e.metres : m), 0);
}

/**
 * La marque, ecrite comme un juge l'ecrit : deux decimales, et jamais arrondie
 * vers le haut.
 *
 * Une distance de lancer se tronque au centimetre INFERIEUR — c'est dans le
 * reglement, et ce n'est pas un detail de presentation : 23,569 m s'affiche
 * 23,56 m, ce qui est precisement la difference entre egaler un record et le
 * battre.
 */
export function marque(metres) {
  if (!(metres > 0)) return null;
  return Math.floor(metres * 100) / 100;
}
