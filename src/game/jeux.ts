// Sprinter et Hurdlers : deux jeux, une seule enveloppe.
//
// Hurdlers n'a pas d'ecrans a lui. Il reprend ceux de Sprinter tels quels —
// l'accueil, la carriere en six etapes, le one shot, les duels, le TOP 500, le
// direct, les stades, le public, le generique — et n'en change que ce qui fait
// qu'on sait dans quel jeu on est :
//
//   - ses trois epreuves, le 100 m haies, le 110 m haies et le 400 m haies ;
//   - sa couleur, le bleu de son monde a la place du jaune de Sprinter ;
//   - sa musique (sprinter-app.js, MUSIQUES_HAIES) ;
//   - pas de relais : il reste a Sprinter.
//
// Deux copies des ecrans auraient diverge au premier correctif, et c'est
// exactement ce que l'utilisateur ne veut pas : « les memes au niveau du menu
// et des duels ». D'ou un interrupteur, et un seul endroit pour le tenir.
//
// LE MOTEUR NE CONNAIT TOUJOURS PAS LES HAIES. Ce module pose les trois
// epreuves dans sa table des courses, et un crochet qu'il appelle a chaque
// course construite ; les haies s'y arment ou s'y rangent selon l'epreuve.

import { useSyncExternalStore } from 'react';
import { SprinterApp, SprinterCore, gameStore, primeTopNames } from './engine';
import { HAIES } from './haies.js';
import { armerHaies, rangerHaies } from './haies-course.js';
import type { RaceKey } from './leaderboard';
import { allerAu, mondeCourant, type Monde } from './mondes';
import { HAIES_OUVERTES } from './canal';

export type Jeu = 'sprinter' | 'hurdlers';

/** Les epreuves de chaque jeu, dans l'ordre ou l'accueil les propose. */
export const EPREUVES_DU_JEU: Record<Jeu, readonly RaceKey[]> = {
  sprinter: ['100', '200', '400'],
  hurdlers: ['100h', '110h', '400h'],
};

/** Toutes les epreuves individuelles, les deux jeux confondus. */
export const TOUTES_LES_EPREUVES: readonly RaceKey[] = [
  ...EPREUVES_DU_JEU.sprinter, ...EPREUVES_DU_JEU.hurdlers,
];

/**
 * Les epreuves qui disent a quel jeu on joue. Le relais (`4x100`) n'en est
 * pas : il vit dans Sprinter, mais sa cle n'a pas a y ramener qui que ce soit.
 */
const EPREUVES_CONNUES: ReadonlySet<string> = new Set([
  '100', '200', '400', '100h', '110h', '400h',
]);

/** L'epreuve se court-elle avec des haies ? */
export function estUneCourseDeHaies(cle: unknown): boolean {
  return typeof cle === 'string' && Object.prototype.hasOwnProperty.call(HAIES, cle);
}

/** Le jeu auquel appartient une epreuve. */
export function jeuDe(cle: unknown): Jeu {
  return estUneCourseDeHaies(cle) ? 'hurdlers' : 'sprinter';
}

/**
 * Le nom court d'une epreuve, pour un bouton ou un onglet : « 100 M » ou
 * « 110 M H ». Le H est celui des tableaux d'affichage, et il se lit dans
 * toutes les langues du jeu.
 */
export function nomCourt(cle: string): string {
  return estUneCourseDeHaies(cle) ? `${cle.slice(0, -1)} M H` : `${cle} M`;
}

/**
 * La meme chose au fil d'une phrase : « 100 m », « 110 m H ». Les epreuves
 * d'un enchainement se joignent par « + ».
 */
export function nomEnLigne(cle: string | readonly string[]): string {
  const l = Array.isArray(cle) ? cle : [cle as string];
  return l.map(k => (estUneCourseDeHaies(k) ? `${k.slice(0, -1)} m H` : `${k} m`)).join(' + ');
}

// --- les trois epreuves dans la table du moteur ------------------------------
//
// `RACES[raceKey]` se lit a une quinzaine d'endroits — libelle, record, plateau
// des adversaires. Y poser les haies une fois vaut mieux que d'apprendre a
// chacun de ces endroits qu'il existe une seconde table.
Object.assign(SprinterCore.RACES, HAIES);

const G = SprinterApp.G;
G.jeu = 'sprinter';

// A chaque course construite : des haies si l'epreuve en a, aucune sinon. Le
// rangement rend au coureur sa foulee de sprinteur ; sans lui, un 100 m couru
// apres un 110 m haies garderait des haies et une foulee de hurdleur.
//
// ET LE JEU SUIT L'EPREUVE. Une course de haies ne part pas que de l'accueil
// de Hurdlers : un lien de defi, un duel, une invitation en direct ou
// l'objectif du jour la lancent aussi, parfois depuis l'accueil de Sprinter.
// Plutot que d'apprendre le jeu a chacun de ces chemins, on le regle ici, la
// ou ils passent tous — sans reconstruire la course qu'on vient de poser.
G.apresConstruction = () => {
  const cle = G.race && G.race.key;
  if (estUneCourseDeHaies(cle)) armerHaies(cle);
  else rangerHaies();
  if (cle && cle in SprinterCore.RACES && EPREUVES_CONNUES.has(cle)) {
    const jeu = jeuDe(cle);
    if (jeu !== courant) {
      changerDeJeu(jeu, false);
      // Haies fermees, le monde Hurdlers est l'accueil « bientot » : y aller
      // le poserait par-dessus la course qu'un lien vient de lancer.
      if (HAIES_OUVERTES && jeuDuMonde(mondeCourant()) !== jeu) allerAu(jeu);
    }
  }
};

// --- le jeu courant ---------------------------------------------------------

let courant: Jeu = 'sprinter';
const abonnes = new Set<() => void>();

/**
 * La derniere epreuve choisie dans chaque jeu : revenir dans un jeu retrouve
 * la sienne, comme on l'avait laissee.
 */
const derniere: Record<Jeu, RaceKey> = { sprinter: '100', hurdlers: '110h' };

export function jeuCourant(): Jeu { return courant; }

/** Les epreuves du jeu courant. */
export function epreuvesDuJeu(jeu: Jeu = courant): readonly RaceKey[] {
  return EPREUVES_DU_JEU[jeu];
}

/**
 * Le jeu qu'on joue dans ce monde. Les concours n'en sont pas encore, et
 * Hurdlers ne l'est que la ou ses haies sont ouvertes (canal.ts).
 */
export function jeuDuMonde(m: Monde): Jeu {
  return m === 'hurdlers' && HAIES_OUVERTES ? 'hurdlers' : 'sprinter';
}

/**
 * Passer d'un jeu a l'autre.
 *
 * La couleur passe par le document (index.css, `data-jeu`), l'epreuve et la
 * piste par le moteur, la musique suit d'elle-meme a l'image suivante (voir
 * Audio_.duJeu). La course de l'accueil est reconstruite avec l'epreuve du
 * jeu : COMMENCER part sur des haies sans rien avoir a choisir.
 */
export function changerDeJeu(jeu: Jeu, construire = true) {
  if (jeu === courant) return;
  if (G.raceKey && jeuDe(G.raceKey) === courant) derniere[courant] = G.raceKey;
  courant = jeu;
  G.jeu = jeu;
  document.documentElement.dataset.jeu = jeu;
  // Appele pendant la construction d'une course (voir apresConstruction),
  // la course est deja la : on ne change que ce qui dit le jeu, et l'on retient
  // son epreuve pour le retour a l'accueil.
  if (!construire) {
    if (G.raceKey && jeuDe(G.raceKey) === jeu) derniere[jeu] = G.raceKey;
  } else {
    const cle = derniere[jeu];
    G.raceKey = cle;
    G.race = SprinterCore.RACES[cle];
    SprinterApp.buildLevel(0);
  }
  // Les Jeux mondiaux tirent leur plateau du TOP 500 de l'epreuve : ceux de
  // ce jeu-ci n'ont peut-etre pas encore ete demandes.
  primeTopNames(EPREUVES_DU_JEU[jeu]);
  for (const f of abonnes) f();
  gameStore.setState({});
}

export function useJeu(): Jeu {
  return useSyncExternalStore(
    (l) => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    () => courant,
    () => courant,
  );
}
