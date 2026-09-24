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
import { EST_TEST } from './canal';
import type { Edition } from './championnats';

/**
 * L'OUVERTURE : LA FINALE DU PREMIER CHAMPIONNAT DE FRANCE.
 *
 * Dimanche 27 septembre 2026, 19:00 UTC — 21:00 a Paris, l'heure du depart de
 * la finale. Avant, le sacre se joue dans le panneau, comme il l'a toujours
 * fait ; a partir de la, sur la piste. C'est une date et non un interrupteur a
 * basculer : le sacre de 21:20 n'attend personne, et une ouverture qu'il
 * faudrait penser a publier le dimanche soir est une ouverture qui rate.
 *
 * La question se pose au moment du sacre, pas au chargement : un telephone
 * ouvert depuis l'apres-midi voit la ceremonie sur la piste comme les autres.
 *
 * Le canal de test l'a des maintenant, pour qu'on la regarde avant.
 */
export const OUVERTURE_CEREMONIE_PISTE = Date.UTC(2026, 8, 27, 19, 0);

export function ceremonieSurLaPiste(maintenant = Date.now()): boolean {
  return EST_TEST || maintenant >= OUVERTURE_CEREMONIE_PISTE;
}

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
