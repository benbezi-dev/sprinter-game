// Les quatre jeux, et comment on passe de l'un a l'autre.
//
// Sprinter est au centre. Les trois autres l'entourent, chacun dans une
// direction, et l'on y va par un geste plutot que par un menu : vers le bas
// les haies, a droite les sauts, a gauche les lancers.
//
// Ce n'est pas une coquetterie. Un menu aurait mis les quatre jeux au meme
// rang, alors qu'ils ne le sont pas : Sprinter est celui qu'on ouvre, les
// autres sont ce qu'on trouve autour. La direction elle-meme porte du sens —
// on descend vers les haies parce que c'est le meme couloir avec des obstacles
// dedans, on va sur les cotes pour les concours, qui ne se courent pas.
//
// Une seule regle a tenir : le geste doit rendre le chemin evident dans les
// DEUX sens. On revient toujours par la direction opposee, sans quoi le joueur
// se retrouve quelque part sans savoir comment en sortir.

import { useSyncExternalStore } from 'react';

export type Monde = 'sprinter' | 'hurdlers' | 'jumper' | 'thrower';
export type Direction = 'bas' | 'droite' | 'gauche';

/** Ou se trouve chaque jeu par rapport a Sprinter. */
export const PLACE: Record<Exclude<Monde, 'sprinter'>, Direction> = {
  hurdlers: 'bas',
  jumper: 'droite',
  thrower: 'gauche',
};

/** Le jeu qui se trouve dans cette direction depuis Sprinter. */
export function mondeVers(d: Direction): Exclude<Monde, 'sprinter'> {
  return (Object.keys(PLACE) as Exclude<Monde, 'sprinter'>[])
    .find(m => PLACE[m] === d)!;
}

/** Par ou l'on revient a Sprinter depuis ce jeu. */
export const RETOUR: Record<Direction, Direction> = {
  bas: 'haut' as Direction, droite: 'gauche', gauche: 'droite',
};

export type Discipline = {
  cle: string;
  /** Clef de traduction du nom. */
  nom: string;
  /**
   * La discipline a-t-elle des cotes reglementaires a montrer ?
   *
   * On garde un drapeau, pas la chaine elle-meme. La calculer ici obligerait
   * ce fichier a lire le reglement des haies au chargement, et un appel au
   * chargement n'est pas elaguable : tout le reglement partait alors dans le
   * build public, ou aucun ecran ne peut l'afficher. C'est l'ecran — qui, lui,
   * ne vit que sur le canal de test — qui va le chercher.
   */
  cotes?: boolean;
  /**
   * L'epreuve est-elle jouable ?
   *
   * Une discipline annoncee et injouable vaut mieux qu'une discipline cachee :
   * elle dit ce que le jeu deviendra. Mais elle doit le dire, et non se laisser
   * appuyer pour ne rien faire.
   */
  jouable: boolean;
};

export type DescriptionMonde = {
  cle: Monde;
  nom: string;
  sous: string;
  /** Deux teintes : le fond du jeu, et son accent. */
  fond: string;
  accent: string;
  disciplines: Discipline[];
};

export const MONDES: Record<Monde, DescriptionMonde> = {
  sprinter: {
    cle: 'sprinter', nom: 'SPRINTER', sous: 'monde_sprinter_sous',
    fond: '#060913', accent: 'rgb(248,205,74)',
    disciplines: [
      { cle: '100', nom: 'disc_100', jouable: true },
      { cle: '200', nom: 'disc_200', jouable: true },
      { cle: '400', nom: 'disc_400', jouable: true },
    ],
  },
  hurdlers: {
    cle: 'hurdlers', nom: 'HURDLERS', sous: 'monde_hurdlers_sous',
    fond: '#0b1220', accent: 'rgb(96,165,250)',
    disciplines: [
      { cle: '100h', nom: 'disc_100h', jouable: false, cotes: true },
      { cle: '110h', nom: 'disc_110h', jouable: false, cotes: true },
      { cle: '400h', nom: 'disc_400h', jouable: false, cotes: true },
    ],
  },
  jumper: {
    cle: 'jumper', nom: 'JUMPER', sous: 'monde_jumper_sous',
    fond: '#0d1410', accent: 'rgb(52,211,153)',
    disciplines: [
      { cle: 'longueur', nom: 'disc_longueur', jouable: false },
      { cle: 'hauteur', nom: 'disc_hauteur', jouable: false },
      { cle: 'triple', nom: 'disc_triple', jouable: false },
      { cle: 'perche', nom: 'disc_perche', jouable: false },
    ],
  },
  thrower: {
    cle: 'thrower', nom: 'THROWER', sous: 'monde_thrower_sous',
    fond: '#160f0c', accent: 'rgb(251,146,60)',
    disciplines: [
      { cle: 'poids', nom: 'disc_poids', jouable: false },
      { cle: 'marteau', nom: 'disc_marteau', jouable: false },
      { cle: 'disque', nom: 'disc_disque', jouable: false },
      { cle: 'javelot', nom: 'disc_javelot', jouable: false },
    ],
  },
};

/**
 * Les quatre jeux sont ouverts.
 *
 * Ils ont vecu sur le canal de test, derriere `EST_TEST`, qui les sortait du
 * build public. Ils partent maintenant avec le reste. A false, tout ceci
 * ressort du build aussi surement qu'avant : c'est une constante, le bundler
 * la suit.
 */
export const MONDES_OUVERTS = true;

let courant: Monde = 'sprinter';
const abonnes = new Set<() => void>();

export function allerAu(m: Monde) {
  if (!MONDES_OUVERTS && m !== 'sprinter') return;
  courant = m;
  for (const f of abonnes) f();
}

export function mondeCourant() { return courant; }

export function useMonde(): Monde {
  return useSyncExternalStore(
    (l) => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    () => courant,
    () => courant,
  );
}
