// La graine d'un defi : la meme piste pour tout le monde.
//
// Le chrono a battre est taille sur chaque joueur — c'est le principe de
// l'Objectif du jour. Le TERRAIN, lui, doit etre commun : les adversaires,
// leurs temps, la phase de leur foulee. Sans cela, deux joueurs qui courent
// « le defi du midi » n'ont pas couru la meme course, et comparer leurs
// chronos ne compare rien.
//
// LA GRAINE NE VOYAGE PAS, ELLE SE RECALCULE. Le serveur la renvoie par
// commodite, mais le jeu sait la refaire a partir de trois choses publiques :
// le jour, le creneau, l'epreuve. Un nombre qu'on transmet est un nombre qu'un
// client peut changer ; un nombre qu'on recalcule des deux cotes se verifie.
//
// A TENIR D'ACCORD avec `hash32` et `graineDe` dans worker/src/objectif.js.
// Le harnais tools/objectif-test.mjs compare les deux implementations.

import { SprinterCore } from './engine';

/**
 * FNV-1a sur 32 bits.
 *
 * Choisi pour une seule raison : il tient en six lignes et rend le meme nombre
 * partout. `Math.imul` fait la multiplication 32 bits que JavaScript ne sait
 * pas faire autrement sans perdre les bits de poids fort.
 */
export function hash32(texte: string): number {
  let h = 0x811c9dc5;
  const s = String(texte);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** La graine d'un defi. Ne depend d'aucun joueur — c'est tout l'interet. */
export function graineDe(jour: string, creneau: string, epreuve: string): number {
  return hash32(`${jour}:${creneau}:${epreuve}`);
}

/**
 * Fixe le tirage du moteur pour la course qui vient.
 *
 * A APPELER AVANT `buildLevel`, jamais apres : c'est lui qui tire le plateau —
 * qui court a cote de toi, et en combien. Semer une fois le plateau construit
 * ne changerait plus que la phase des foulees, c'est-a-dire rien.
 */
export function semerDefi(graine: number): void {
  try { SprinterCore.semer(graine >>> 0); } catch { /* moteur pas encore la */ }
}

/**
 * Rend la main au hasard du systeme.
 *
 * A APPELER EN SORTANT DU DEFI, et c'est la moitie qui s'oublie : une graine
 * laissee en place ferait rejouer le meme plateau a toutes les courses
 * suivantes, y compris en carriere. Le jeu ne planterait pas — il deviendrait
 * lentement identique a lui-meme.
 */
export function rendreLeHasard(): void {
  try { SprinterCore.desemer(); } catch { /* rien a rendre */ }
}

/** Le tirage est-il seme en ce moment ? */
export function estSeme(): boolean {
  try { return !!SprinterCore.estSeme(); } catch { return false; }
}

/**
 * Court une fonction avec le tirage seme, et rend la main quoi qu'il arrive.
 *
 * La forme a preferer partout ou elle passe : elle rend impossible d'oublier
 * `rendreLeHasard`, y compris quand ce qu'on lui confie leve.
 */
export function avecGraine<T>(graine: number, f: () => T): T {
  semerDefi(graine);
  try { return f(); } finally { rendreLeHasard(); }
}
