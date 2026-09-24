// LA TENSION DE LA PRESENTATION.
//
// Avant une course de championnat, les athletes passent un par un devant la
// camera. Presentes a plat, huit noms a la suite sont une liste ; mis en
// scene, ils sont un compte a rebours. Ce fichier tient la partie qui ne se
// dessine pas — le son, la secousse, le rythme — pour les deux presentations,
// celle du direct (PresentationDirect) et celle de la retransmission
// (RejeuChampionnat), qui doivent faire monter la meme tension.
//
// UN CRESCENDO, PAS UN EFFET. Tout ce qui suit monte avec le rang dans la
// sequence : le coeur bat de plus en plus vite, l'impact de chaque arrivee
// frappe de plus en plus fort, et le plan se resserre davantage. Le premier
// athlete est presente dans un stade qui s'installe ; le dernier, dans un
// stade qui retient son souffle.
//
//   la musique      passe en retrait le temps de la presentation — c'est le
//                   silence qui fait entendre le coeur ;
//   l'impact        un coup sourd a chaque athlete, et l'image qui tressaille ;
//   le coeur        « boum-boum », de 0,9 s entre deux battements au premier
//                   athlete a 0,45 s au dernier ;
//   le pouls        l'ecran le montre aussi : un voile qui bat avec lui (voir
//                   `usePouls`).
//
// LE COEUR EST CALE SUR L'HORLOGE AUDIO, PAS SUR CELLE DE L'ECRAN. Les deux
// presentations battent toutes les 80 a 100 ms : un battement pose a ce pas
// tomberait avec un dixieme de seconde de jeu, et un coeur irregulier ne fait
// pas peur, il fait mal fait. On programme donc d'un coup tous les battements
// du creneau (`sfx` sait les differer sur l'horloge audio), et on les annule
// si le creneau s'interrompt.

import { useSyncExternalStore } from 'react';

// Lu a l'usage, pas au chargement : ce module peut etre importe avant que le
// moteur ne soit pose sur `globalThis`.
const app = (): any => (globalThis as any).SprinterApp;

/** Le zoom avant sur l'athlete, au premier et au dernier (voir presenterCoureur). */
const POUSSE_PREMIER = 0.18, POUSSE_DERNIER = 0.3;
/** Secondes entre deux battements, au premier et au dernier athlete. */
const PERIODE_PREMIER = 0.9, PERIODE_DERNIER = 0.45;
/** L'ecart entre les deux coups d'un battement : « boum »… « boum ». */
const DOUBLE_COUP = 0.15;

/** Le reglage « reduire les animations » : ni secousse ni zoom, le son reste. */
export function sobre(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/* ------------------------------------------------------------ le pouls */

/** Chaque battement vu par l'ecran : un numero (pour la cle) et sa force. */
export type Pouls = { n: number; force: number };
let pouls: Pouls = { n: 0, force: 0 };
const abonnes = new Set<() => void>();
function battre(force: number) {
  pouls = { n: pouls.n + 1, force };
  for (const f of abonnes) f();
}

/** Le dernier battement, pour faire battre le voile de l'ecran avec le coeur. */
export function usePouls(): Pouls {
  return useSyncExternalStore(
    l => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    () => pouls, () => pouls,
  );
}

/* ---------------------------------------------------------- la sequence */

let sources: any[] = [];
let minuteurs: ReturnType<typeof setTimeout>[] = [];

function toutAnnuler() {
  for (const s of sources) { try { s?.stop(); } catch { /* deja fini */ } }
  for (const t of minuteurs) clearTimeout(t);
  sources = []; minuteurs = [];
}

/**
 * Programme les battements de `debut` a `fin` secondes, a la periode donnee.
 * Chaque battement est double — le second coup plus faible et un rien plus
 * aigu, comme un vrai coeur — et l'ecran recoit son pouls au premier coup.
 */
function coeur(debut: number, fin: number, periode: number, force: number) {
  const A = app()?.Audio_;
  for (let t = debut; t < fin; t += periode) {
    if (A) {
      sources.push(A.sfx('coeur', { gain: 0.45 + 0.3 * force, delay: t }));
      sources.push(A.sfx('coeur', { gain: 0.28 + 0.2 * force, rate: 1.12, delay: t + DOUBLE_COUP }));
    }
    minuteurs.push(setTimeout(() => battre(0.3 + 0.45 * force), t * 1000));
  }
}

/**
 * La presentation commence : la musique passe en retrait pour toute sa duree,
 * et remonte d'elle-meme a la fin — le decompte du starter la reprend.
 *
 * `avantMs` est l'attente avant le premier athlete (le generique de la
 * retransmission, le decompte du direct) : le coeur y bat deja, lentement.
 */
export function ouvrirLaPresentation(avantMs: number, dureeMs: number) {
  toutAnnuler();
  try { app()?.Audio_?.retrait?.(Math.max(0, (avantMs + dureeMs) / 1000)); } catch { /* sans le son */ }
  if (avantMs > 400) coeur(0.2, avantMs / 1000 - 0.3, 1.05, 0);
}

/**
 * Un athlete entre dans son creneau : l'impact, puis le coeur jusqu'au
 * suivant. Rend le reglage du plan a passer a `presenterCoureur`.
 *
 * `i` est son rang dans la sequence, `n` le nombre d'athletes, `parMs` la
 * duree d'un creneau.
 */
export function ouvrirLeCreneau(i: number, n: number, parMs: number): { pousse: number } {
  toutAnnuler();
  const avance = n > 1 ? Math.min(1, Math.max(0, i / (n - 1))) : 1;
  const calme = sobre();
  const A = app()?.Audio_;
  // L'IMPACT : le meme coup de coeur, joue plus grave et plus fort — un coup
  // de grosse caisse dans un stade qui s'est tu.
  try { A?.sfx('coeur', { gain: 0.85 + 0.15 * avance, rate: 0.6 }); } catch { /* sans le son */ }
  const G = app()?.G;
  if (G && !calme) G.shake = Math.max(G.shake || 0, 0.2 + 0.3 * avance);
  battre(0.55 + 0.45 * avance);
  // LE COEUR, jusqu'au creneau suivant — et pas au-dela : le dernier battement
  // ne doit pas tomber sur l'impact de l'athlete d'apres.
  const periode = PERIODE_PREMIER - (PERIODE_PREMIER - PERIODE_DERNIER) * avance;
  coeur(periode, parMs / 1000 - 0.2, periode, avance);
  return { pousse: calme ? 0 : POUSSE_PREMIER + (POUSSE_DERNIER - POUSSE_PREMIER) * avance };
}

/** La presentation s'acheve ou s'interrompt : plus un battement ne part. */
export function fermerLaPresentation() {
  toutAnnuler();
}
