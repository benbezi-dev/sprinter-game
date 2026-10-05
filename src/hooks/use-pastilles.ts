import { useSyncExternalStore } from 'react';

/**
 * LA RANGEE DES PASTILLES DE L'ACCUEIL.
 *
 * Les pastilles « UN MESSAGE » et « UN DÉFI » etaient posees en `fixed`, a
 * 3,4 et 6,2 rem du haut, a droite. Sur un telephone etroit, c'est pile sur la
 * carte du titre : « UN MESSAGE » recouvrait le R de SPRINTER. L'accueil leur
 * tient donc une vraie place dans sa mise en page, sous l'en-tete ; elles s'y
 * posent par un portail. Ailleurs (resultat, fin de partie), la rangee
 * n'existe pas et elles gardent leur place fixe.
 */
export const ID_PASTILLES = 'pastilles-accueil';

/**
 * LA RANGEE SE DECLARE ELLE-MEME. Les pastilles la cherchaient dans la page
 * a chaque changement d'ecran, et verifiaient a chaque image qu'elle y etait
 * encore. Mais l'accueil peut disparaitre sans que l'ecran change — la
 * ceremonie d'un championnat le remplace, le monde de Jumper le cache — et
 * les pastilles ne se redessinent plus a chaque image (voir useGameStore) :
 * elles restaient accrochees a une rangee sortie de la page, invisibles.
 * L'accueil la pose donc par une ref (`poserLaRangee`), et la retire en
 * partant : les pastilles suivent, ou qu'on en soit.
 */
let rangee: HTMLElement | null = null;
const abonnes = new Set<() => void>();
export function poserLaRangee(el: HTMLElement | null) {
  if (el === rangee) return;
  rangee = el;
  for (const f of abonnes) f();
}
const abonner = (f: () => void) => { abonnes.add(f); return () => { abonnes.delete(f); }; };
const lire = () => rangee;

/** L'element de la rangee s'il est dans la page, sinon `null`. */
export function useRangeePastilles(_state?: string): HTMLElement | null {
  return useSyncExternalStore(abonner, lire, lire);
}
