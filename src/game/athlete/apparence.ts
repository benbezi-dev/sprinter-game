// LE CORPS DE L'ATHLETE, dessine par le moteur : en ville et en course.
//
// Un `look` du moteur (sprinter-core.js) construit depuis l'apparence choisie
// a la creation. En ville, une tenue civile — haut a sa couleur, pantalon, ni
// dossard ni bandes ; en course, son maillot a la meme couleur.

import { SprinterCore } from '../engine';
import { type Athlete, type Apparence, APPARENCE, COULEURS } from './regles';
import { type Tenue, tenue, tenueDeVilleDe } from './garde-robe';

const CHEVEUX: Record<string, [number, number, number]> = {
  noir: [28, 22, 22], brun: [56, 36, 24], chatain: [92, 62, 36],
  blond: [188, 154, 88], roux: [148, 74, 38], gris: [176, 176, 182],
};

export const apparenceDe = (a: Athlete): Apparence => a.apparence || APPARENCE;

export function lookDe(ap: Apparence, enVille: boolean, porte: Tenue | null = null) {
  const c = COULEURS[ap.couleur] || COULEURS[0];
  const base = { build: ap.corps, skin: ap.peau, hair: ap.coiffure, hairCol: CHEVEUX[ap.cheveux], h: ap.taille, jersey: c };
  const look = (SprinterCore as any).look(enVille
    ? { ...base, civil: true, manches: c, pantalon: [44, 46, 64], shoe: [240, 240, 244] }
    : { ...base, shorts: [30, 32, 48] });
  // la tenue du moment (garde-robe.ts), que le corps 3D de la ville peint par zones
  if (porte) look.tenue = porte;
  return look;
}

/**
 * A quoi ressemblent les gens du jeu (gens.ts). Les parents ont la peau de
 * l'athlete — c'est sa famille ; les autres sont tires une fois pour toutes
 * sur leur nom, comme les coureurs de la piste. Tous en tenue de ville, sauf
 * ceux du club, en tenue d'entrainement.
 */
const cacheGens = new Map<string, any>();
export function lookDePersonne(a: Athlete, p: string): any {
  const ap = apparenceDe(a), cle = `${p}|${ap.peau}`;
  const deja = cacheGens.get(cle); if (deja) return deja;
  const C = SprinterCore as any;
  const base = C.lookFor('athlete-' + p, 'divers');
  const sport = p === 'coach' || p === 'partenaire' || p === 'rival';
  const famille = p === 'maman' || p === 'papa';
  const corps = p === 'maman' || p === 'amie' || p === 'partenaire' ? 'f' : p === 'coach' && a.club === 'horizon' ? 'f' : 'm';
  const look = C.look({
    ...base, build: corps,
    skin: famille ? ap.peau : base.skin,
    hair: famille ? (corps === 'f' ? 'bun' : 'crop') : base.hair,
    h: famille ? (corps === 'f' ? 1.66 : 1.8) : p === 'prof' || p === 'coach' ? 1.76 : base.h,
    ...(sport ? { jersey: p === 'rival' ? [200, 40, 40] : base.jersey } : { civil: true, manches: base.jersey, pantalon: p === 'prof' ? [70, 60, 50] : [50, 52, 70] }),
    lunettes: p === 'prof' ? [30, 30, 34] : base.lunettes,
  });
  // en ville, une tenue tiree sur son nom ; ceux du club en tenue d'entrainement, a leurs couleurs
  look.tenue = sport ? { ...tenue('debardeur-short')!, haut: look.jersey || [200, 40, 40] } : tenueDeVilleDe(p, corps);
  cacheGens.set(cle, look);
  return look;
}
