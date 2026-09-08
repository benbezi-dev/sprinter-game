// La liaison audio du duel, et sa duree de vie.
//
// C'est le meme probleme que celui de `salon-direct.ts`, et il faut le dire
// deux fois parce qu'il s'est pose deux fois.
//
// Le panneau du direct vit dans l'ecran-titre, et l'ecran-titre disparait des
// que le jeu entre sur la piste — c'est-a-dire pendant la presentation, avant
// meme le coup de pistolet. La liaison audio etait tenue par une `useRef` de
// ce panneau. Une ref ne survit pas au demontage : celle du panneau remonte
// apres la course est une AUTRE ref, vide.
//
// Tant que les anciens ecouteurs de la salle etaient encore en place, cela ne
// se voyait pas — ils tenaient l'ancienne ref par leur fermeture. Mais le
// panneau, en remontant, se rebranche sur la salle et remplace ces ecouteurs
// par les siens, qui pointent vers la ref vide. A partir de cet instant, la
// liaison audio existe toujours, elle emet et elle capte, et plus personne
// dans l'application n'a de quoi la designer. Le micro du vainqueur ne
// s'ouvrait pas ; « quitter » ne fermait rien ; la capture restait au systeme
// jusqu'a ce que la page meure.
//
// Une liaison audio ne vit pas le temps qu'un panneau est affiche. Elle vit du
// premier tour de presentation a la fin de la revanche ou du duel. Elle est
// donc gardee ici, hors de React, comme la salle.

import type { Voix } from './voix';

let courante: Voix | null = null;
let minuteur: any = null;

/**
 * Prend une liaison en charge. Celle qui etait la, s'il y en avait une, est
 * coupee — on ne tient pas deux conversations a la fois.
 */
export function poserVoix(v: Voix | null) {
  if (courante && courante !== v) {
    try { courante.arreter(); } catch { /* deja coupee */ }
  }
  courante = v;
}

export function voixCourante(): Voix | null { return courante; }

/**
 * Coupe la liaison et rend le micro. C'est le SEUL endroit qui ferme une
 * liaison du direct : un demontage de composant ne doit jamais le faire.
 */
export function couperVoix() {
  annulerFinVoix();
  if (!courante) return;
  try { courante.arreter(); } catch { /* deja coupee */ }
  courante = null;
}

/**
 * Programme la coupure pour dans `ms`.
 *
 * Le minuteur vit ici et non dans le panneau, pour la raison qui fait tout
 * l'objet de ce fichier : arme a la fin de la course, il doit encore etre la
 * dix minutes plus tard, alors que l'ecran aura ete monte et demonte
 * plusieurs fois entre-temps.
 */
export function programmerFinVoix(ms: number) {
  annulerFinVoix();
  minuteur = setTimeout(couperVoix, ms);
}

/** Une revanche s'annonce : la liaison ne doit pas se couper sous les pieds. */
export function annulerFinVoix() {
  clearTimeout(minuteur);
  minuteur = null;
}
