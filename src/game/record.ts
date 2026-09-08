// Le record personnel, cote jeu.
//
// Le jeu connaissait deja son record, mais il ne le disait jamais. Il le
// gardait sous la main — `G.runs[epreuve]`, les dix meilleurs chronos de
// l'appareil — et l'accueil en affichait la liste sans dire que le premier
// etait un record. Le mot n'apparaissait nulle part : ni en course, ni a
// l'arrivee, ni sur le profil. Ce qu'on ne nomme pas ne se bat pas.
//
// DEUX SOURCES, ET LEUR ORDRE COMPTE. L'appareil repond tout de suite et hors
// ligne ; le serveur repond juste, parce qu'il porte les courses de TOUS les
// appareils du joueur. On affiche donc le local sans attendre, puis on corrige
// avec le distant quand il arrive. Un joueur qui a battu son record sur son
// telephone ne doit pas lire un record perime sur son ordinateur.
//
// CE MODULE NE CASSE JAMAIS LE JEU. Serveur muet, joueur sans nom, route pas
// encore deployee : on retombe sur l'appareil, et la course continue.

import { useEffect, useSyncExternalStore } from 'react';
import { getSavedName, type RaceKey } from './leaderboard';
import { SprinterApp } from './engine';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

export type Record = {
  epreuve: RaceKey;
  /** 'plus_bas' pour un chrono. Rendu par le serveur, jamais devine ici. */
  direction: string;
  ms: number | null;
  rang: number | null;
  courses: number;
  /** Le serveur a-t-il repondu ? Sinon c'est l'appareil qui parle. */
  distant: boolean;
};

/* ------------------------------------------------------------- l appareil */

/**
 * Le record garde sur cet appareil, en millisecondes.
 *
 * `G.runs` tient les dix meilleurs chronos par epreuve, tries croissant : le
 * record est le premier. Il est ecrit a chaque course terminee, sans reseau.
 */
export function recordLocal(epreuve: RaceKey): number | null {
  try {
    const runs = (SprinterApp.G.runs || {})[epreuve] || [];
    const t = runs[0];
    return Number.isFinite(t) && t > 0 ? Math.round(t * 1000) : null;
  } catch { return null; }
}

/* ---------------------------------------------------------------- le cache

   Un magasin minuscule, sur le modele de `boite.ts` : les ecrans s'y abonnent
   et ne redemandent rien au serveur chacun de leur cote. Trois ecrans montrent
   le record en meme temps — l'accueil, le HUD, l'arrivee — et trois requetes
   pour la meme valeur donneraient trois valeurs differentes le temps qu'elles
   reviennent. */

const cache = new Map<RaceKey, Record>();
const ecouteurs = new Set<() => void>();

function prevenir() {
  for (const f of [...ecouteurs]) { try { f(); } catch { /* un ecran parti */ } }
}

function poser(epreuve: RaceKey, r: Record) {
  const avant = cache.get(epreuve);
  if (avant && avant.ms === r.ms && avant.rang === r.rang && avant.distant === r.distant) return;
  cache.set(epreuve, r);
  prevenir();
}

/** Ce qu'on sait maintenant, sans rien demander a personne. */
export function recordConnu(epreuve: RaceKey): Record {
  const enCache = cache.get(epreuve);
  if (enCache) return enCache;
  return {
    epreuve, direction: 'plus_bas',
    ms: recordLocal(epreuve), rang: null, courses: 0, distant: false,
  };
}

/**
 * Va chercher le record au serveur, celui du JOUEUR et pas de l'appareil.
 *
 * Sans nom, il n'y a rien a demander : le serveur indexe par nom, et un joueur
 * anonyme n'a pas de record chez lui. On garde alors celui de l'appareil, qui
 * est le sien quand meme.
 */
export async function rafraichirRecord(epreuve: RaceKey): Promise<Record> {
  const local = recordLocal(epreuve);
  const nom = getSavedName();
  if (!nom) {
    const r = { epreuve, direction: 'plus_bas', ms: local, rang: null, courses: 0, distant: false };
    poser(epreuve, r);
    return r;
  }
  try {
    const rep = await fetch(
      `${API_BASE}/record?nom=${encodeURIComponent(nom)}&race=${epreuve}`);
    if (!rep.ok) throw new Error('indisponible');
    const d = await rep.json();
    // Le meilleur des deux, et pas le distant seul : une course tout juste
    // terminee est deja sur l'appareil et pas encore remontee.
    const distant = Number.isFinite(d?.record_ms) ? d.record_ms : null;
    const ms = distant === null ? local
      : local === null ? distant
      : Math.min(distant, local);
    const r: Record = {
      epreuve,
      direction: d?.direction || 'plus_bas',
      ms,
      rang: Number.isFinite(d?.rang) ? d.rang : null,
      courses: Number.isFinite(d?.courses) ? d.courses : 0,
      distant: true,
    };
    poser(epreuve, r);
    return r;
  } catch {
    const r = recordConnu(epreuve);
    const repli = { ...r, ms: r.ms ?? local };
    poser(epreuve, repli);
    return repli;
  }
}

/* Le record TEL QU'IL ETAIT avant la derniere course.
 *
 * Sans lui, l'ecran d'arrivee ne peut pas annoncer un record. Il s'affiche
 * apres que le moteur a range la course, donc apres que le record a bouge :
 * comparer le chrono au record dirait « egalite » a l'instant precis ou il
 * faudrait dire « nouveau record ». On garde donc l'etat d'avant, et c'est
 * contre celui-la qu'on compare. */
const avant = new Map<RaceKey, number | null>();

/** Le record d'avant la derniere course, ou celui d'aujourd'hui a defaut. */
export function recordAvant(epreuve: RaceKey): number | null {
  return avant.has(epreuve) ? (avant.get(epreuve) ?? null) : recordConnu(epreuve).ms;
}

/**
 * Une course vient de finir : le record de l'appareil a peut-etre bouge.
 *
 * Appelee par le moteur, avant meme que le serveur soit au courant. Sans elle,
 * l'ecran d'arrivee annoncerait « record 8,50 s » sous un chrono de 8,43 s
 * qu'il vient lui-meme d'afficher.
 */
export function noterCourse(epreuve: RaceKey) {
  const r = recordConnu(epreuve);
  avant.set(epreuve, r.ms);
  const local = recordLocal(epreuve);
  if (local !== null && (r.ms === null || local < r.ms)) {
    poser(epreuve, { ...r, ms: local });
  }
}

export function surRecord(f: () => void): () => void {
  ecouteurs.add(f);
  return () => { ecouteurs.delete(f); };
}

/* ---------------------------------------------------------------- lecture */

/** Le chrono tel que le jeu l'ecrit partout : deux decimales. */
export const s2 = (ms: number) => (ms / 1000).toFixed(2);

/**
 * L'ecart d'une course a un record, en millisecondes.
 *
 * Negatif quand la course est MEILLEURE — c'est le sens de lecture d'un
 * chrono, ou l'on gagne du temps. Null quand il n'y a pas de record a
 * comparer : la premiere course d'une epreuve n'a battu personne.
 */
export function ecartAuRecord(courseMs: number, recordMs: number | null): number | null {
  if (recordMs === null || !Number.isFinite(courseMs)) return null;
  return Math.round(courseMs - recordMs);
}

/** Cette course est-elle un nouveau record ? Strictement : egaler n'est pas
 *  battre, sinon chaque egalite ferait clignoter « NOUVEAU RECORD ». */
export function estUnRecord(courseMs: number, recordMs: number | null): boolean {
  if (!Number.isFinite(courseMs) || courseMs <= 0) return false;
  return recordMs === null || courseMs < recordMs;
}

/* ------------------------------------------------------------- le crochet */

/**
 * Le record d'une epreuve, tel qu'un ecran doit l'afficher.
 *
 * Rend tout de suite ce qu'on sait, va chercher le reste, et fait revenir
 * l'ecran quand la valeur change. Meme forme que `useGameStore` : le magasin
 * vit dans le module, React ne fait que s'y abonner.
 */
export function useRecord(epreuve: RaceKey): Record {
  const r = useSyncExternalStore(
    (l) => surRecord(l),
    () => {
      // useSyncExternalStore compare par identite : il faut que deux lectures
      // sans changement rendent le MEME objet, sinon React boucle.
      if (!cache.has(epreuve)) cache.set(epreuve, recordConnu(epreuve));
      return cache.get(epreuve) as Record;
    },
  );
  useEffect(() => { void rafraichirRecord(epreuve); }, [epreuve]);
  return r;
}
