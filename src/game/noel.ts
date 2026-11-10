// NOEL 2026 — LA BATAILLE DE BOULES DE NEIGE ET L'ETOILE DU SAPIN (10/11/2026).
//
// Un battle royale de fantomes au 60 m. Les regles vivent dans
// worker/src/noel.js ; ce module ne fait que demander, defier, lancer et
// envoyer. Le drapeau d'ouverture est NOEL_OUVERT (canal.ts).
//
// LE FANTOME RALENTI SE VOIT. Le serveur rend, pour chaque fantome, le facteur
// qui le ralentit (neige × poids de l'etoile). On etire la trace de ce facteur
// avant de la donner au moteur : un Kin couvert de neige court VRAIMENT plus
// lentement a l'ecran, et passe la ligne au chrono que le serveur jugera.

import { getDeviceId, getSavedName } from './leaderboard';
import { SprinterApp } from './engine';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
export const EPREUVE = '60';

export type LigneNoel = {
  key: string; name: string; ms: number; a_battre_ms: number; neige: number; etoile: boolean;
  battus: number; vols: number; tenue_ms: number; points: number; deja_battu: boolean;
};
export type MoiNoel = LigneNoel & { boules: number; lances: number; courses: number; rang: number };
export type EtoileNoel = {
  name: string; key: string; depuis: number; tenue_ms: number; poids: number;
  ms: number | null; a_battre_ms: number | null; neige: number;
};
export type FilNoel = { quand: number; genre: 'entree' | 'allume' | 'battu' | 'vol' | 'neige' | 'secoue'; a: string; b: string | null; n: number | null; ms: number | null };
export type TableauNoel = {
  maintenant: number;
  regles: { neige_pct: number; neige_duree_ms: number; neige_max: number; etoile_pct_h: number;
            etoile_max: number; tenue_point_ms: number; vol_points: number; boules_depart: number };
  etoile: EtoileNoel | null; moi: MoiNoel | null;
  arene: LigneNoel[]; classement: LigneNoel[]; fil: FilNoel[];
  debut: number | null; fin: number | null;
};

/* ---------------------------------------------------- qui ecoute le tableau */
const ecouteurs = new Set<() => void>();
export function ecouterNoel(f: () => void) { ecouteurs.add(f); return () => { ecouteurs.delete(f); }; }
function prevenir() { for (const f of [...ecouteurs]) { try { f(); } catch { /* */ } } }

export async function fetchTableau(): Promise<TableauNoel> {
  const nom = (getSavedName() || '').trim();
  const r = await fetch(`${API_BASE}/noel${nom ? `?name=${encodeURIComponent(nom)}` : ''}`);
  if (!r.ok) throw new Error(`noel ${r.status}`);
  return r.json();
}

export type FantomeNoel = { name: string; ms: number; a_battre_ms: number; facteur: number; neige: number; etoile: boolean; trace: number[] };

export async function fetchFantome(nom: string): Promise<FantomeNoel | null> {
  try {
    const r = await fetch(`${API_BASE}/noel/fantome?cible=${encodeURIComponent(nom)}`);
    if (!r.ok) return null;
    const f = await r.json();
    return Array.isArray(f.trace) && f.trace.length > 1 ? f : null;
  } catch { return null; }
}

/**
 * Etirer une trace dans le temps : le point i de la nouvelle est la position
 * qu'avait l'ancienne a l'instant i / facteur. Meme pas d'echantillon, donc
 * le moteur la lit sans rien savoir ; la ligne tombe `facteur` fois plus tard.
 */
export function etirer(trace: number[], facteur: number): number[] {
  if (!(facteur > 1) || trace.length < 2) return trace.slice();
  const n = Math.ceil((trace.length - 1) * facteur) + 1;
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / facteur, a = Math.floor(x), b = Math.min(trace.length - 1, a + 1), k = x - a;
    const pa = trace[Math.min(a, trace.length - 1)], pb = trace[b];
    out[i] = Math.round(pa + (pb - pa) * k);
  }
  return out;
}

/** Une neige courte, pour le nom affiche sur la piste : « Kin ❄7 ★ ». */
export function nomSurPiste(f: { name: string; neige: number; etoile: boolean }) {
  return `${f.name}${f.neige ? ` ❄${f.neige}` : ''}${f.etoile ? ' ★' : ''}`;
}

/**
 * Defier le fantome d'un joueur : sa trace etiree de ce qui le ralentit, son
 * chrono a battre, et la cible dans les options du depart — engine.ts la
 * relit a l'arrivee. Rend faux si le fantome n'a pas pu venir.
 */
export async function defier(nom: string): Promise<boolean> {
  const f = await fetchFantome(nom);
  if (!f) return false;
  (SprinterApp as any).startOneShot([EPREUVE], {
    levelIdx: 4,
    ghosts: [etirer(f.trace, f.facteur)],
    ghostSplits: [f.a_battre_ms / 1000],
    ghostName: nomSurPiste(f),
    ghostTime: f.a_battre_ms / 1000,
    etiquette: 'fantome',
    noel: { cible: f.name },
  });
  return true;
}

/** Courir sans cible : deposer (ou remplacer) son fantome, et secouer la neige. */
export function deposer() {
  (SprinterApp as any).startOneShot([EPREUVE], { levelIdx: 4, noel: { cible: null } });
}

/* ------------------------------------------------- le verdict d'une course */
export type VerdictNoel = {
  ms: number; boules: number; secoue: number; etoile_allumee: boolean;
  duel: null | { cible: string; cible_ms: number; gagne: boolean; nouveau: boolean; etoile: boolean; boule: boolean };
};
const ecouteursVerdict = new Set<(v: VerdictNoel) => void>();
export function ecouterVerdicts(f: (v: VerdictNoel) => void) { ecouteursVerdict.add(f); return () => { ecouteursVerdict.delete(f); }; }
/** Le dernier verdict, pour l'ecran qui se rouvre apres la course. */
export let dernierVerdict: VerdictNoel | null = null;
export function oublierVerdict() { dernierVerdict = null; }

/**
 * Une course de Noel vient de finir (engine.ts). Jamais bloquant, jamais une
 * erreur a l'ecran : hors ligne, la course compte pour le joueur, pas pour
 * l'arene.
 */
export async function envoyerCourse(tempsS: number, trace: number[], cible: string | null) {
  const name = getSavedName();
  if (!name || !trace.length) return;
  try {
    const r = await fetch(`${API_BASE}/noel/course`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: getDeviceId(), name, race_key: EPREUVE, time_ms: Math.round(tempsS * 1000), trace,
        ...(cible ? { cible } : {}),
      }),
    });
    if (!r.ok) return;
    const d = await r.json().catch(() => null);
    if (d && d.ok) {
      dernierVerdict = d;
      for (const f of [...ecouteursVerdict]) { try { f(d); } catch { /* */ } }
    }
    prevenir();
  } catch { /* hors ligne */ }
}

export type Lancer = { ok: true; lancees: number; boules: number; neige: number; a_battre_ms: number } | { ok: false; error: string };

export async function lancerBoules(cible: string, n: number): Promise<Lancer> {
  const name = getSavedName();
  if (!name) return { ok: false, error: 'nom' };
  try {
    const r = await fetch(`${API_BASE}/noel/lancer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name, cible, n }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) return { ok: false, error: d.error || 'reseau' };
    prevenir();
    return d;
  } catch { return { ok: false, error: 'reseau' }; }
}

/** 10 240 ms → « 10,24 ». */
export const secondes = (ms: number, fr = true) => { const s = (ms / 1000).toFixed(2); return fr ? s.replace('.', ',') : s; };
/** 3 h 12 min, 45 min, 2 j 4 h. */
export function duree(ms: number, fr = true) {
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), j = Math.floor(h / 24);
  if (j) return `${j} ${fr ? 'j' : 'd'} ${h % 24} h`;
  if (h) return `${h} h ${String(m % 60).padStart(2, '0')}`;
  return `${m} min`;
}
