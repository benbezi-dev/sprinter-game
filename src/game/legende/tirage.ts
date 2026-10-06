// LE TIRAGE DES LIEUX — une fois par carriere Legende.
//
// Le national se court en Espagne, au Maroc ou au Nigeria ; le mondial a
// Paris, New York ou Londres. Le de roule au DEBUT de la carriere, pas a
// l'entree de l'etape : la carte doit pouvoir annoncer ou l'on va avant d'y
// aller, et une etape recommencee garde son lieu — sinon perdre a Barcelone
// enverrait courir a Abuja, et l'echec se lirait comme un voyage.
//
// `alea` est injectable pour le harnais ; le jeu passe Math.random.

import { ETAPES, type Lieu } from './etapes';

/** L'indice du lieu tire, etape par etape (0 quand l'etape n'a qu'un lieu). */
export type Tirage = number[];

export function tirer(alea: () => number = Math.random): Tirage {
  return ETAPES.map(e => (e.lieux.length > 1 ? Math.min(e.lieux.length - 1, Math.floor(alea() * e.lieux.length)) : 0));
}

export function lieuDe(tirage: Tirage, rang: number): Lieu {
  const e = ETAPES[Math.max(0, Math.min(ETAPES.length - 1, rang))];
  return e.lieux[Math.max(0, Math.min(e.lieux.length - 1, tirage[rang] | 0))];
}
