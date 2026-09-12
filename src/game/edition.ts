// L'edition speciale — une fenetre de dates, et rien d'autre.
//
// Quand une grande reunion d'athletisme se court pour de vrai, le jeu ouvre un
// stade a ses couleurs et le dit sur l'accueil. Ce module tient la SEULE chose
// qui distingue une edition d'un ajout ordinaire : les deux dates entre
// lesquelles on l'annonce.
//
// CE QUI EST DATE, ET CE QUI NE L'EST PAS. La banniere est datee ; le stade ne
// l'est pas. Un stade qui disparait le lundi matin, c'est un joueur qui revient
// le mardi et trouve que le jeu lui a repris quelque chose — et le chrono qu'il
// y a pose ne se rejouerait plus. On ouvre donc un lieu POUR TOUJOURS, et on
// n'annonce que pendant la semaine ou ca interesse quelqu'un.
//
// POURQUOI CE MODULE NE CONTIENT AUCUN NOM PROPRE. Le stade s'appelle « le
// Danube » : un fleuve, que personne ne possede. La competition reelle, elle,
// porte un nom depose, son stade aussi, et ses athletes ont un nom et une
// image qui leur appartiennent. Rien de tout cela n'entre dans le jeu — ni
// ici, ni dans le moteur, ni dans les traductions. La liste complete de ce
// qu'on s'interdit, et pourquoi, tient dans juridique/edition-danube.md.
//
// AUCUN RESEAU, AUCUN STOCKAGE. La fenetre est en dur et se lit sur l'horloge
// de l'appareil. Un joueur qui avance sa montre verra la banniere une semaine
// plus tot : il n'y a rien a y gagner — le stade, lui, est deja ouvert.

export type Edition = {
  /** Clef de l'edition, pour les ecrans et les mesures. */
  cle: string;
  /** Le stade qu'elle met en avant : `cle` d'une entree de STADES_HORS_SERIE. */
  stade: string;
  /** Debut et fin de l'annonce, en millisecondes depuis l'epoque (UTC). */
  debut: number;
  fin: number;
};

/**
 * L'edition du Danube.
 *
 * Les dates sont ecrites en UTC et commentees en heure de Paris, qui est
 * UTC+2 en septembre. Les ecrire en heure locale les ferait glisser d'une
 * heure selon le fuseau de l'appareil, ce qui n'a aucune importance pour une
 * banniere — mais un test qui verifie une frontiere, lui, veut un instant
 * exact, et ne peut pas dependre du fuseau de la machine qui le lance.
 */
export const EDITION_DANUBE: Edition = {
  cle: 'danube-2026-09',
  stade: 'danube',
  // samedi 12 septembre 2026, 00 h 00 a Paris
  debut: Date.UTC(2026, 8, 11, 22, 0, 0),
  // lundi 21 septembre 2026, 00 h 00 a Paris — soit les trois soirees de la
  // competition, puis la semaine qui suit, ou le sujet vit encore.
  fin: Date.UTC(2026, 8, 20, 22, 0, 0),
};

/** Toutes les editions connues du jeu, passees et a venir. */
export const EDITIONS: Edition[] = [EDITION_DANUBE];

/** L'edition qu'on annonce a cet instant, s'il y en a une. */
export function editionEnCours(maintenant: number = Date.now()): Edition | null {
  for (const e of EDITIONS) {
    if (maintenant >= e.debut && maintenant < e.fin) return e;
  }
  return null;
}

/** Cette edition est-elle en cours ? */
export function editionActive(e: Edition, maintenant: number = Date.now()): boolean {
  return maintenant >= e.debut && maintenant < e.fin;
}

/**
 * Combien de jours pleins reste-t-il a l'edition en cours ?
 *
 * Zero le dernier jour, et non `null` : un compteur qui affiche « 0 jour »
 * pendant les dernieres heures dit exactement ce qu'il faut dire. C'est
 * `editionEnCours` qui decide s'il y a quelque chose a montrer, pas ce
 * compteur.
 */
export function joursRestants(e: Edition, maintenant: number = Date.now()): number {
  return Math.max(0, Math.floor((e.fin - maintenant) / 86400000));
}
