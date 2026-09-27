import { useEffect, useState } from 'react';

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

/** L'element de la rangee s'il est dans la page, sinon `null`. */
export function useRangeePastilles(state: string): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // Relue apres le rendu : l'accueil et les pastilles montent dans le meme
    // passage, et la rangee n'existe dans le DOM qu'une fois celui-ci pose.
    const lire = () => setEl(document.getElementById(ID_PASTILLES));
    lire();
    const id = requestAnimationFrame(lire);
    return () => cancelAnimationFrame(id);
  }, [state]);
  return el && el.isConnected ? el : null;
}
