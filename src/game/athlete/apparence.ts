// LE CORPS DE L'ATHLETE, dessine par le moteur : en ville et en course.
//
// Un `look` du moteur (sprinter-core.js) construit depuis l'apparence choisie
// a la creation. En ville, une tenue civile — haut a sa couleur, pantalon, ni
// dossard ni bandes ; en course, son maillot a la meme couleur.

import { SprinterCore } from '../engine';
import { type Athlete, type Apparence, APPARENCE, COULEURS } from './regles';

const CHEVEUX: Record<string, [number, number, number]> = {
  noir: [28, 22, 22], brun: [56, 36, 24], chatain: [92, 62, 36],
  blond: [188, 154, 88], roux: [148, 74, 38], gris: [176, 176, 182],
};

export const apparenceDe = (a: Athlete): Apparence => a.apparence || APPARENCE;

export function lookDe(ap: Apparence, enVille: boolean) {
  const c = COULEURS[ap.couleur] || COULEURS[0];
  const base = { build: ap.corps, skin: ap.peau, hair: ap.coiffure, hairCol: CHEVEUX[ap.cheveux], h: ap.taille, jersey: c };
  return (SprinterCore as any).look(enVille
    ? { ...base, civil: true, manches: c, pantalon: [44, 46, 64], shoe: [240, 240, 244] }
    : { ...base, shorts: [30, 32, 48] });
}
