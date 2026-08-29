import { useEffect, useRef } from 'react';
import type { Direction } from '@/game/mondes';

/**
 * Le geste qui fait passer d'un jeu a l'autre.
 *
 * Trois directions depuis l'accueil : vers le bas les haies, a droite les
 * sauts, a gauche les lancers. Le geste doit cohabiter avec le defilement de
 * l'ecran, et c'est tout le probleme — un accueil qui bascule de jeu des qu'on
 * fait glisser la page serait insupportable.
 *
 * Deux regles le rendent vivable :
 *
 * 1. L'HORIZONTAL DOIT ETRE FRANCHEMENT HORIZONTAL. On compare les deux axes :
 *    si le doigt a bouge autant en hauteur qu'en largeur, c'est qu'il lisait la
 *    page, et on ne bascule pas.
 * 2. LE BAS SE PREND AU BOUT DU ROULEAU. On ne quitte l'accueil vers les haies
 *    qu'en tirant ENCORE alors que la page est deja au bout. C'est le geste du
 *    « tirer pour rafraichir », a l'envers : il ne peut pas se declencher par
 *    accident au milieu d'une lecture, parce qu'au milieu il reste de la page a
 *    faire defiler.
 */

/** Combien de pixels pour que le geste compte. */
const SEUIL = 90;
/** Combien de fois plus horizontal que vertical pour valider un cote. */
const FRANCHISE = 1.7;
/** Marge de tolerance sur le bas du rouleau, en pixels. */
const BOUT = 4;

export function useGesteMondes(
  cible: React.RefObject<HTMLElement | null>,
  onGeste: (d: Direction) => void,
  actif = true,
) {
  // La fonction change a chaque rendu ; les ecouteurs, non. Sans cela on les
  // decroche et on les raccroche a chaque image, ce qui n'est pas faux mais
  // qui est du travail pour rien — et une occasion de perdre un geste en
  // cours pile au moment ou l'on rebranche.
  const fn = useRef(onGeste);
  fn.current = onGeste;

  useEffect(() => {
    const el = cible.current;
    if (!el || !actif) return;

    let x0 = 0, y0 = 0, suit = false, auBout = false;

    const debut = (e: PointerEvent) => {
      x0 = e.clientX; y0 = e.clientY; suit = true;
      // On note si l'on part du bas : c'est la condition du geste vers les
      // haies, et elle se juge au DEBUT du geste. La juger a la fin laisserait
      // passer un defilement rapide qui atteint le bout en route.
      auBout = el.scrollTop + el.clientHeight >= el.scrollHeight - BOUT;
    };

    const fin = (e: PointerEvent) => {
      if (!suit) return;
      suit = false;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      const ax = Math.abs(dx), ay = Math.abs(dy);

      if (ax > SEUIL && ax > ay * FRANCHISE) {
        // Le doigt va a gauche : le monde de droite entre. C'est le sens des
        // pages, pas celui du doigt — on pousse l'accueil pour decouvrir ce
        // qu'il y a a cote.
        fn.current(dx < 0 ? 'droite' : 'gauche');
        return;
      }
      // Doigt vers le haut, depuis le bas de la page : on tire pour voir
      // dessous.
      if (auBout && dy < -SEUIL && ay > ax * FRANCHISE) fn.current('bas');
    };

    el.addEventListener('pointerdown', debut);
    el.addEventListener('pointerup', fin);
    el.addEventListener('pointercancel', () => { suit = false; });
    return () => {
      el.removeEventListener('pointerdown', debut);
      el.removeEventListener('pointerup', fin);
    };
  }, [cible, actif]);
}
