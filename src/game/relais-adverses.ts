// LES EQUIPES ADVERSES DU RELAIS (l'auteur, 14/11/2026 : « fais-en des vraies equipes »).
//
// Les couloirs voisins etaient remplis de coureurs de l'ordinateur qui couraient chacun un 400 m
// entier, seuls, a cote d'un relais. Ce sont desormais des EQUIPES : quatre relayeurs par couloir,
// un temoin, trois transmissions — courues par le meme pilote que nos fictifs
// (worker/src/relais-fictifs.js) et jugees par les memes regles (relais-course.js).
//
// SIMULEES D'AVANCE, A PARTIR D'UNE GRAINE. Toute la course de chaque equipe est calculee au coup de
// pistolet, puis rejouee a l'ecran. Deux raisons :
// - au salon, chaque telephone la calcule de son cote : la graine tiree du pistolet (le meme pour
//   tous) et du code donne la meme course partout, sans un message de plus ;
// - leurs chronos sont connus des le depart : la place a l'arrivee se donne aussitot, meme si l'on
//   finit avant elles.

import {
  CourseEquipe,
  // @ts-ignore — module JavaScript du worker, sans declaration de types.
} from '../../worker/src/relais-course.js';
// @ts-ignore — module JavaScript du worker, sans declaration de types.
import { Fictifs, tirerNoms } from '../../worker/src/relais-fictifs.js';

export const PAS_TRACE_MS = 50;
const DUREE_MAX_MS = 70000;

export type EquipeAdverse = {
  lane: number;
  membres: { id: string; nom: string; relais: number }[];
  /** Position de chaque relayeur (index 0..3), un echantillon tous les PAS_TRACE_MS. */
  traces: Float32Array[];
  /** Le porteur du temoin a chaque echantillon (1..4). */
  porteur: Uint8Array;
  /** Le chrono de l'equipe, en ms ; null si elle n'a pas fini (eliminee). */
  total: number | null;
};

/** Un generateur reproductible : la meme graine donne la meme suite partout. */
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une graine tiree d'une date et d'un texte (le pistolet et le code du salon). */
export function graine(departA: number, texte = ''): number {
  let h = Math.floor(departA) | 0;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Court a l'avance une equipe par couloir de `lanes`.
 *
 * Le pilote des fictifs tire au sort (vitesse de pointe, petit retard des tapes) avec Math.random :
 * on le remplace, le temps du calcul, par le generateur de la graine — c'est ce qui rend la course
 * identique sur tous les telephones.
 */
export function simulerEquipesAdverses(seed: number, lanes: number[]): EquipeAdverse[] {
  const hasard = mulberry32(seed || 1);
  const vrai = Math.random;
  const equipes: EquipeAdverse[] = [];
  try {
    Math.random = hasard;
    for (const lane of lanes) {
      const course = new CourseEquipe('IA' + lane, '');
      const noms = tirerNoms(4, []);
      const fictifs = new Fictifs(course, [1, 2, 3, 4], noms);
      // Des equipes de niveaux differents : certaines battent la notre, d'autres non.
      const force = 0.95 + hasard() * 0.075;
      for (const f of fictifs.liste) f.vmax *= force;
      fictifs.reinitialiser(1);
      const n = Math.ceil(DUREE_MAX_MS / PAS_TRACE_MS);
      const traces = [0, 1, 2, 3].map(() => new Float32Array(n));
      const porteur = new Uint8Array(n);
      let total: number | null = null, fin = false, k = 0;
      for (; k < n; k++) {
        if (!fin) {
          const encore = fictifs.pas(1 + k * PAS_TRACE_MS, 1, {
            fini: (t: number) => { total = t; },
          });
          if (!encore) fin = true;
        }
        for (let r = 0; r < 4; r++) traces[r][k] = course.coureur(r + 1).d;
        porteur[k] = course.porteur;
        if (fin && k > 0 && traces[3][k] === traces[3][k - 1] && total != null) {
          // arrives : on garde la derniere position jusqu'au bout de la trace
          for (let j = k + 1; j < n; j++) { for (let r = 0; r < 4; r++) traces[r][j] = traces[r][k]; porteur[j] = porteur[k]; }
          break;
        }
      }
      equipes.push({
        lane, traces, porteur, total,
        membres: [1, 2, 3, 4].map((r, i) => ({ id: `adv-${lane}-${r}`, nom: noms[i] || 'RELAIS', relais: r })),
      });
    }
  } finally {
    Math.random = vrai;
  }
  return equipes;
}

/** L'echantillon de l'instant `t` (ms de course), borne a la trace. */
export function indexDe(t: number, eq: EquipeAdverse): number {
  return Math.max(0, Math.min(eq.porteur.length - 1, Math.floor(t / PAS_TRACE_MS)));
}

/** Ou est le temoin d'une equipe a l'instant `t`. */
export function temoinDe(eq: EquipeAdverse, t: number): number {
  const k = indexDe(t, eq);
  return eq.traces[eq.porteur[k] - 1][k];
}
