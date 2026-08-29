import { useEffect, useRef } from 'react';
import { SprinterApp } from '@/game/engine';

/**
 * Interroger le serveur pendant qu'on ne court pas.
 *
 * Les deux annonces du jeu — « on t'a defie » et « ton defi a ete releve » —
 * arrivent par sondage, faute de quoi que ce soit qui pousse. Elles suivaient
 * chacune leur propre minuterie de quarante-cinq secondes, et cela se voyait :
 * un resultat pouvait mettre plus d'une minute a s'afficher alors que le
 * joueur etait devant son ecran, precisement en train de l'attendre.
 *
 * Deux regles, et elles tiennent ici plutot que recopiees dans chaque annonce —
 * deux copies d'une regle de rythme, c'est la garantie qu'un jour l'une des
 * deux sera reglee sans l'autre.
 *
 * 1. On n'interroge pas quelqu'un qui court. Une nouvelle en plein 400 m est
 *    une nuisance, et la course a besoin de toutes ses images.
 * 2. On interroge au retour dans le jeu. C'est exactement le moment ou une
 *    nouvelle attend, et c'est le declencheur le plus utile — celui qui fait
 *    qu'on n'a plus a patienter devant un ecran muet.
 *
 * Il y avait une troisieme regle, et elle est retiree : ne pas interroger une
 * page en veille. Elle semblait evidente — le telephone dans la poche n'a rien
 * a demander — et elle etait dangereuse. Une page peut se declarer masquee tout
 * en tournant : c'est le cas dans certaines enveloppes applicatives, et je l'ai
 * vu de mes yeux pendant la mise au point. Le garde-fou aurait alors rendu les
 * annonces definitivement muettes chez ceux-la, en echange d'une requete
 * economisee toutes les dix secondes. Le systeme gele deja les minuteries d'une
 * application en arriere-plan ; il n'y avait presque rien a gagner, et le
 * silence complet a perdre.
 */

/** Etats ou l'on peut deranger le joueur sans lui gacher quoi que ce soit. */
const CALME = new Set(['title', 'result', 'winall', 'over']);

export const estAuCalme = () => CALME.has(SprinterApp.G.state);

export function useSondageAuRepos(interroger: () => void, periodeMs: number) {
  // La fonction change a chaque rendu ; la minuterie, non. On garde la
  // derniere version sous la main plutot que de remonter la minuterie a
  // chaque image, ce qui la remettrait sans cesse a zero.
  const fn = useRef(interroger);
  fn.current = interroger;

  useEffect(() => {
    let vivant = true;
    const battre = () => {
      if (!vivant || !estAuCalme()) return;
      fn.current();
    };
    battre();
    const id = setInterval(battre, periodeMs);
    document.addEventListener('visibilitychange', battre);
    window.addEventListener('focus', battre);
    return () => {
      vivant = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', battre);
      window.removeEventListener('focus', battre);
    };
  }, [periodeMs]);
}
