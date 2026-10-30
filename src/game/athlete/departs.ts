// LES DEPARTS EN BLOCS SE FONT SUR LA VRAIE PISTE (l'auteur, 30/10 : « le jeu a deja un
// stade et des starts et meme un mode tuto »). La sequence « depart » du tutoriel
// (sprint-tuto.js) met le jeu au compte, ce qui demonte l'accueil et la carriere avec
// lui : l'ecran de la seance vit donc a la racine (App.tsx), comme le tutoriel, et ce
// drapeau dit a la racine de le monter.
import type { Athlete, Jour } from './regles';

let ouvert: { a: Athlete; jour: Jour } | null = null;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach(f => f());

export const departsOuverts = () => ouvert;
export function abonnerAuxDeparts(f: () => void) { abonnes.add(f); return () => { abonnes.delete(f); }; }
export function ouvrirLesDeparts(a: Athlete, jour: Jour) { ouvert = { a, jour }; prevenir(); }
export function fermerLesDeparts() { ouvert = null; prevenir(); }
