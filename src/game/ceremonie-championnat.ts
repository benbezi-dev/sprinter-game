// Le sacre, et pourquoi il ne vit pas dans le panneau qui le declenche.
//
// La ceremonie se joue SUR LA PISTE : le moteur montre les huit couloirs
// derriere l'ecran-titre, et le champion y leve les bras pendant que le podium
// monte par-dessus. Pour qu'on voie cette piste, l'ecran-titre doit disparaitre
// — et avec lui le panneau du championnat, donc le composant qui portait le
// podium.
//
// C'est exactement la situation de la presentation d'avant-course, et la
// reponse est la meme : la ceremonie vit hors de l'arbre des ecrans, ici, et le
// panneau ne fait plus que la declarer. Le podium a donc besoin de tout ce
// qu'il affiche — l'edition entiere — parce que sa source sera demontee avant
// qu'il ait fini.

import { useSyncExternalStore } from 'react';
import type { Edition } from './championnats';

export type CeremonieEnCours = {
  /** L'edition complete : le podium ne peut plus rien aller rechercher. */
  edition: Edition;
  onFini: () => void;
};

let courante: CeremonieEnCours | null = null;
const abonnes = new Set<() => void>();

export function lancerCeremonie(c: CeremonieEnCours | null) {
  courante = c;
  for (const f of abonnes) f();
}

export function useCeremonieChampionnat(): CeremonieEnCours | null {
  return useSyncExternalStore(
    (l) => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    () => courante,
    () => courante,
  );
}
