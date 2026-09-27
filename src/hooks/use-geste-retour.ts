import { useEffect } from 'react';
import { SprinterApp } from '@/game/engine';
import { demanderRetour } from '@/game/retour';

/**
 * LE GLISSEMENT DEPUIS LE BORD GAUCHE FERME LE PANNEAU DU DESSUS.
 *
 * Le meme geste que le retour arriere d'iOS et d'Android, et c'est voulu : un
 * joueur ne devrait pas avoir a apprendre un geste de plus pour sortir d'un
 * tableau. La ou le systeme le prend a son compte — Safari, notamment — la
 * page ne voit rien de ce qui suit et c'est l'historique qui fait le travail
 * (voir game/retour.ts) ; ce hook sert partout ailleurs : application
 * installee, navigateur qui laisse passer, souris.
 *
 * Trois conditions, pour qu'il ne parte jamais tout seul :
 *
 * 1. PARTIR DU BORD. Un doigt pose au milieu d'un classement le fait defiler,
 *    il ne quitte rien. Seule la bande de gauche arme le geste, comme sur le
 *    systeme.
 * 2. ETRE FRANCHEMENT HORIZONTAL. Si le doigt a bouge autant en hauteur qu'en
 *    largeur, c'est qu'il lisait la page. Meme regle que le geste des mondes,
 *    et la meme raison.
 * 3. NE PAS COURIR. Pendant une course les pouces sont justement en bas des
 *    bords : la course passe avant tout, et rien ne se ferme.
 *
 * Le clic qui suit un geste valide est avale. Sans cela, relacher le doigt
 * apres avoir ferme un panneau activerait ce qui se trouve dessous — sur
 * l'accueil, c'est le bouton qui lance une course.
 */

/** Largeur de la bande de depart, en pixels. */
const BORD = 36;
/** Combien de pixels vers la droite pour que le geste compte. */
const SEUIL = 70;
/** Combien de fois plus horizontal que vertical. */
const FRANCHISE = 1.7;
/** Au-dela, ce n'est plus un geste mais un doigt qu'on a oublie. */
const DUREE_MAX = 1200;

const EN_COURSE = new Set(['cut', 'count', 'race']);

export function useGesteRetour() {
  useEffect(() => {
    let x0 = 0, y0 = 0, t0 = 0, suit = false;

    const debut = (e: PointerEvent) => {
      suit = e.clientX <= BORD && !EN_COURSE.has(SprinterApp.G.state);
      x0 = e.clientX; y0 = e.clientY; t0 = e.timeStamp;
    };

    const avale = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };

    const fin = (e: PointerEvent) => {
      if (!suit) return;
      suit = false;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (dx < SEUIL || ax <= ay * FRANCHISE) return;
      if (e.timeStamp - t0 > DUREE_MAX) return;
      if (!demanderRetour()) return;
      window.addEventListener('click', avale, { capture: true, once: true });
      // Un geste qui ne produit aucun clic laisserait l'ecouteur en place, et
      // c'est le clic SUIVANT — celui que le joueur voulait — qui serait
      // avale.
      setTimeout(() => window.removeEventListener('click', avale, true), 400);
    };

    const annule = () => { suit = false; };

    // En capture : un panneau qui arrete les evenements sur son propre calque
    // ne doit pas pouvoir retenir le geste.
    window.addEventListener('pointerdown', debut, true);
    window.addEventListener('pointerup', fin, true);
    window.addEventListener('pointercancel', annule, true);
    return () => {
      window.removeEventListener('pointerdown', debut, true);
      window.removeEventListener('pointerup', fin, true);
      window.removeEventListener('pointercancel', annule, true);
      window.removeEventListener('click', avale, true);
    };
  }, []);
}
