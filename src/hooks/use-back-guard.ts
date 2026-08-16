import { useEffect } from 'react';
import { SprinterApp } from '@/game/engine';

// Etats ou l'on est "dans" une partie : un retour arriere involontaire y coute
// la course en cours. Les ecrans de resultat ont deja un bouton ACCUEIL, on
// n'y bloque donc rien.
const IN_PLAY = new Set(['cut', 'count', 'race']);

/**
 * Empeche le balayage horizontal de faire quitter la partie.
 *
 * Sur mobile, un balayage vers la gauche ou la droite est interprete comme un
 * retour arriere. Pendant une course les pouces sont sur les bords bas de
 * l'ecran, a l'endroit exact du geste : il partait tout seul, la page se
 * dechargeait et se rechargeait sur le menu, course perdue.
 *
 * `overscroll-behavior: none` suffit sur Chrome, mais pas sur iOS ou le
 * balayage depuis le bord est un geste systeme que la page ne peut pas
 * refuser. On garde donc une entree d'historique a nous : le retour arriere la
 * consomme au lieu de quitter, et si une course est en cours on la remet
 * aussitot. Hors course on laisse passer, pour ne pas retenir le joueur sur
 * la page contre son gre.
 */
export function useBackGuard() {
  useEffect(() => {
    let armed = true;
    const push = () => {
      try { history.pushState({ sprinter: true }, ''); } catch (e) { armed = false; }
    };
    push();

    const onPop = () => {
      if (!armed) return;
      if (IN_PLAY.has(SprinterApp.G.state)) push();
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}
