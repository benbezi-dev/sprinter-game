// LE CALENDRIER DE L'AVENT — « La Course de l'Etoile » (docs/NOEL_HISTOIRE.md).
//
// Vingt-quatre cases, une course par soir, au Village de l'Etoile (noel-3d.ts). Chaque
// case a son epreuve et son CHRONO A BATTRE ; gagner, c'est passer la ligne dans le
// temps. La case gagnee ouvre son chapitre, et la suivante des que sa date est venue.
//
// LES CHRONOS SONT MESURES, PAS ESTIMES, comme ceux d'Halloween (halloween-loi.js) : ils
// sont lus sur la courbe chrono/cadence du vrai moteur (tools/avent-test.mjs, automate
// parfaitement alterne — un vrai doigt fait moins bien). La case 1 demande environ 7,6
// appuis par seconde, la case 24 environ 11 : l'echelle monte d'un acte a l'autre, avec
// des respirations, et la Course de l'Etoile, le 24, est un 400 m.
//
// LE TEMPS : celui du serveur quand il repond (l'heure du tableau de Noel), sinon un
// cliquet (le principe d'halloween-calendrier.ts, sans l'importer : rien d'Halloween ne
// part en production) — un joueur qui avance sa montre n'ouvre pas une case de plus.
// SUR LE CANAL DE TEST, la date ne bloque rien (toutes les cases sont venues) : seul le
// verrou de la victoire joue. `?avent_jour=N` y rejoue la date du N decembre, 22 h.

import { SprinterApp } from './engine';
import { EST_TEST } from './canal';
import { NB_CASES, ouvertureDe, casesJouables, blocageDe, type Blocage } from './avent-calendrier';

export { NB_CASES, ouvertureDe, type Blocage };

/** Une case : son epreuve et son chrono a battre, en secondes. */
export type CaseAvent = { n: number; epreuve: '100' | '200' | '400'; imparti: number };

/**
 * L'ECHELLE, mesuree par tools/avent-test.mjs (cadence minimale de l'automate, appuis/s) :
 *   Acte I, la rencontre          1-6   : de 7,75 (100 m en 11"00) a 8,75
 *   Acte II, la legende           7-12  : de 8,25 (le 400 m de la case 9) a 9,25
 *   Acte III, l'epreuve           13-18 : de 9 a 10,25
 *   Acte IV, la nuit de l'Etoile  19-24 : de 10,5 a 11,25 ; la case 24, la Course de
 *                                         l'Etoile, est un 400 m a 11 appuis/s.
 * Les longues distances respirent un peu (le 400 m demande moins de cadence que le
 * 100 m voisin, mais trois fois plus longtemps).
 */
export const CASES: readonly CaseAvent[] = [
  { n: 1, epreuve: '100', imparti: 11.00 },
  { n: 2, epreuve: '100', imparti: 10.60 },
  { n: 3, epreuve: '200', imparti: 20.60 },
  { n: 4, epreuve: '100', imparti: 10.20 },
  { n: 5, epreuve: '200', imparti: 19.80 },
  { n: 6, epreuve: '100', imparti: 9.90 },
  { n: 7, epreuve: '200', imparti: 19.20 },
  { n: 8, epreuve: '100', imparti: 9.70 },
  { n: 9, epreuve: '400', imparti: 38.80 },
  { n: 10, epreuve: '100', imparti: 9.55 },
  { n: 11, epreuve: '200', imparti: 18.60 },
  { n: 12, epreuve: '100', imparti: 9.40 },
  { n: 13, epreuve: '200', imparti: 18.35 },
  { n: 14, epreuve: '100', imparti: 9.25 },
  { n: 15, epreuve: '400', imparti: 37.20 },
  { n: 16, epreuve: '200', imparti: 18.15 },
  { n: 17, epreuve: '100', imparti: 9.16 },
  { n: 18, epreuve: '400', imparti: 36.95 },
  { n: 19, epreuve: '100', imparti: 9.10 },
  { n: 20, epreuve: '200', imparti: 18.00 },
  { n: 21, epreuve: '100', imparti: 9.04 },
  { n: 22, epreuve: '200', imparti: 17.92 },
  { n: 23, epreuve: '100', imparti: 8.98 },
  { n: 24, epreuve: '400', imparti: 36.60 },
];

export function caseDe(n: number): CaseAvent {
  return CASES[Math.max(0, Math.min(CASES.length - 1, n - 1))];
}

/* ---------------------------------------------------------------- le carnet */

/** Ce que le joueur a fait, sur cet appareil. */
export type Carnet = {
  v: 1;
  /** Combien de cases gagnees d'affilee depuis la premiere. */
  gagnees: number;
  /** Le meilleur chrono de chaque case tentee, en secondes. */
  meilleurs: Record<number, number>;
  /** Combien de tentatives par case. */
  tentatives: Record<number, number>;
};
const CLE = 'sprinter_avent_v1';
const VIDE: Carnet = { v: 1, gagnees: 0, meilleurs: {}, tentatives: {} };

export function carnet(): Carnet {
  try {
    const c = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (c && c.v === 1 && Number.isInteger(c.gagnees)) {
      return { v: 1, gagnees: Math.max(0, Math.min(NB_CASES, c.gagnees)),
               meilleurs: c.meilleurs || {}, tentatives: c.tentatives || {} };
    }
  } catch { /* stockage refuse */ }
  return { ...VIDE, meilleurs: {}, tentatives: {} };
}
function ranger(c: Carnet) {
  try { localStorage.setItem(CLE, JSON.stringify(c)); } catch { /* stockage refuse : la partie vit en memoire */ }
}

/* ---------------------------------------------------------------- le temps */

const CLE_HORLOGE = 'sprinter_avent_horloge';
let ecartServeur: number | null = null;

/** Recale l'horloge sur celle du serveur (le tableau de Noel donne `maintenant`). */
export function recalerSurLeServeur(maintenantServeur: number) {
  if (!Number.isFinite(maintenantServeur)) return;
  ecartServeur = maintenantServeur - Date.now();
  try { if (maintenantServeur > Number(localStorage.getItem(CLE_HORLOGE) || 0)) localStorage.setItem(CLE_HORLOGE, String(maintenantServeur)); } catch { /* */ }
}

/**
 * L'instant retenu pour le calendrier. Le serveur fait foi quand il a repondu. Sans lui,
 * l'appareil ne peut pas depasser la fin du jour deja vu du serveur (le cliquet) : avancer
 * sa montre de trois jours n'ouvre rien ; le jour meme, la case de 22 h s'ouvre quand meme.
 */
export function maintenantAvent(): number {
  if (EST_TEST) {
    const j = Number(new URLSearchParams(location.search).get('avent_jour'));
    if (Number.isInteger(j) && j >= 0 && j <= NB_CASES && new URLSearchParams(location.search).has('avent_jour')) {
      return j === 0 ? ouvertureDe(1) - 3600_000 : ouvertureDe(j) + 60_000;
    }
    return ouvertureDe(NB_CASES) + 3600_000;
  }
  if (ecartServeur !== null) return Date.now() + ecartServeur;
  let vu = 0;
  try { vu = Number(localStorage.getItem(CLE_HORLOGE) || 0) || 0; } catch { /* */ }
  if (!vu) return Date.now();
  const d = new Date(vu);
  const finDuJour = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - 1;
  return Math.max(vu, Math.min(Date.now(), finDuJour));
}

export function jouables(): number { return casesJouables(carnet().gagnees, maintenantAvent()); }
export function blocage(n: number): Blocage { return blocageDe(n, carnet().gagnees, maintenantAvent()); }

/* ---------------------------------------------------------------- la course */

/** L'index du Village de l'Etoile, cherche par sa clef (il depend du canal). */
function niveauDuVillage(): number {
  const L = (SprinterApp as any).LEVELS as any[] | undefined;
  const i = L ? L.findIndex(l => l && l.cle === 'noel') : -1;
  return i >= 0 ? i : 4;
}

/** Lance la course de la case `n`. Rend faux si elle n'est pas jouable. */
export function courirLaCase(n: number): boolean {
  if (blocage(n) !== 'ouverte') return false;
  const c = caseDe(n);
  (SprinterApp as any).startOneShot([c.epreuve], { levelIdx: niveauDuVillage(), avent: { n }, etiquette: 'avent' });
  return true;
}

/** La case en cours, si la course partie est une course du calendrier. */
export function caseEnCours(): CaseAvent | null {
  const G = (SprinterApp as any).G;
  const a = G && G.mode === 'oneshot' && G.shotOpts && G.shotOpts.avent;
  return a && Number.isInteger(a.n) ? caseDe(a.n) : null;
}

/* ---------------------------------------------------------------- l'arrivee */

export type Resultat = {
  n: number; t: number; imparti: number; gagne: boolean;
  /** Premiere victoire sur cette case : le chapitre s'ouvre. */
  nouvelle: boolean;
  /** Record personnel sur la case. */
  record: boolean;
  /** Si perdue : quel soir perdu raconter (0..2). */
  perdu: number;
};
export let dernierResultat: Resultat | null = null;
const ecouteurs = new Set<(r: Resultat) => void>();
export function ecouterResultat(f: (r: Resultat) => void) { ecouteurs.add(f); return () => { ecouteurs.delete(f); }; }

/** Juge la course de la case `n` (appele par engine.ts, onRaceRecorded). */
export function arrivee(n: number, t: number) {
  const c = caseDe(n);
  const k = carnet();
  k.tentatives[n] = (k.tentatives[n] || 0) + 1;
  const ancien = k.meilleurs[n];
  const record = ancien === undefined || t < ancien;
  if (record) k.meilleurs[n] = Math.round(t * 100) / 100;
  const gagne = t <= c.imparti;
  const nouvelle = gagne && n === k.gagnees + 1;
  if (nouvelle) k.gagnees = n;
  ranger(k);
  dernierResultat = { n, t, imparti: c.imparti, gagne, nouvelle, record, perdu: (k.tentatives[n] - 1) % 3 };
  for (const f of [...ecouteurs]) { try { f(dernierResultat); } catch { /* */ } }
}

/** Une case gagnee ? */
export function gagnee(n: number): boolean { return n <= carnet().gagnees; }

/** Le chrono, a la francaise ou a l'anglaise : 10"60 / 10.60 s. */
export function chrono(s: number, fr = true): string {
  return fr ? s.toFixed(2).replace('.', '"') : `${s.toFixed(2)} s`;
}
