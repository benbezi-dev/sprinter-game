// NOEL 2026 — LES QUATRE EQUIPES (23/11/2026). Les regles vivent dans
// worker/src/noel-equipes.js ; ce module ne fait que lire, voter, entrer,
// defier et envoyer. Le drapeau d'ouverture est NOEL_EQUIPES_OUVERT (canal.ts) : seul, le 7/12.

import { getDeviceId, getSavedName } from './leaderboard';
import { SprinterApp } from './engine';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

export type Candidat = { key: string; name: string; rang: number; ms: number; voix: number };
export type MembreEq = { key: string; name: string; fantomes: Record<string, number>; chef: boolean; a_couru: boolean };
export type EquipeNoel = {
  n: number; chef: string; chef_key: string; eliminee: number | null;
  scores: Record<string, number>; score: number; effectif: number; membres: MembreEq[];
};
export type FilEq = { manche: number; equipe: number; points: number; genre: 'ffa' | 'duel' | 'defense' | 'eliminee' | 'vainqueur'; a: string | null; b: string | null; ms: number | null; quand: number; epreuve: string | null };
export type TableauEq = {
  maintenant: number; phase: 'avant' | 'vote' | 'departage' | 'manche' | 'fini'; manche: number | null; pause: boolean;
  calendrier: { vote: number; voteFin: number; departageFin: number; manches: { n: number; debut: number; fin: number }[]; pause: { debut: number; fin: number } };
  regles: { candidats: number; chefs: number; duel: number; defense: number; epreuves: string[] };
  candidats: Candidat[]; mon_vote?: string | null;
  departage?: { places: number; egalite: (Candidat & { ms: number | null })[] };
  equipes: EquipeNoel[];
  moi?: { equipe: number; fantomes: Record<string, number>; a_couru: boolean } | null;
  eliminations: { equipe: number; chef: string; points: number }[];
  vainqueur: { equipe: number; chef: string; points: number } | null;
  fil: FilEq[];
};

/* ---------------------------------------------------- qui ecoute le tableau */
const ecouteurs = new Set<() => void>();
export function ecouterEq(f: () => void) { ecouteurs.add(f); return () => { ecouteurs.delete(f); }; }
function prevenir() { for (const f of [...ecouteurs]) { try { f(); } catch { /* */ } } }

export async function fetchTableau(): Promise<TableauEq> {
  const nom = (getSavedName() || '').trim();
  const q = new URLSearchParams({ device_id: getDeviceId() });
  if (nom) q.set('name', nom);
  const r = await fetch(`${API_BASE}/noel-equipes?${q}`);
  if (!r.ok) throw new Error(`noel-equipes ${r.status}`);
  return r.json();
}

async function poster(chemin: string, corps: Record<string, unknown>) {
  try {
    const r = await fetch(`${API_BASE}/noel-equipes/${chemin}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name: getSavedName(), ...corps }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) prevenir();
    return r.ok ? { ok: true as const, ...d } : { ok: false as const, error: String(d.error || 'reseau') };
  } catch { return { ok: false as const, error: 'reseau' }; }
}

export const voter = (cible: string) => poster('voter', { cible });
export const entrer = () => poster('entrer', {});

/** Les epreuves en salle du jeu de Noel, et leur nom a l'ecran. */
export const EPREUVES_NOEL = ['60', '200s', '400s', '60h'] as const;
export const NOM_EPREUVE: Record<string, { fr: string; en: string }> = {
  '60': { fr: '60 m', en: '60 m' }, '200s': { fr: '200 m', en: '200 m' },
  '400s': { fr: '400 m', en: '400 m' }, '60h': { fr: '60 m haies', en: '60 m hurdles' },
};

/** Courir sans cible : points du barème et nouveau fantome dans l'epreuve. */
export function courir(epreuve: string) {
  (SprinterApp as any).startOneShot([epreuve], { levelIdx: 4, noelEquipes: { cible: null } });
}

/** Le 200 m en salle du departage des chefs. */
export function courirDepartage() {
  (SprinterApp as any).startOneShot(['200s'], { levelIdx: 4, noelEquipes: { cible: null } });
}

/** Defier le fantome d'un joueur d'une autre equipe. Faux si le fantome n'est pas venu. */
export async function defier(nom: string, epreuve: string): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/noel-equipes/fantome?cible=${encodeURIComponent(nom)}&epreuve=${encodeURIComponent(epreuve)}`);
    if (!r.ok) return false;
    const f = await r.json();
    if (!Array.isArray(f.trace) || f.trace.length < 2) return false;
    (SprinterApp as any).startOneShot([epreuve], {
      levelIdx: 4, ghosts: [f.trace], ghostSplits: [f.ms / 1000], ghostName: f.name, ghostTime: f.ms / 1000,
      etiquette: 'fantome', noelEquipes: { cible: f.name },
    });
    return true;
  } catch { return false; }
}

/* ------------------------------------------------- le verdict d'une course */
export type VerdictEq = {
  ms: number; epreuve?: string; departage?: boolean; meilleur?: number;
  niveau?: string | null; ffa?: number; gain?: number;
  duel?: null | { cible: string; cible_ms: number; gagne: boolean; compte: boolean; points: number };
  error?: string;
};
/** Le dernier verdict, pour l'ecran qui se rouvre apres la course. */
export let dernierVerdict: VerdictEq | null = null;
export function oublierVerdict() { dernierVerdict = null; }

/** Une course de Noel vient de finir (engine.ts). Jamais bloquant. */
export async function envoyerCourse(race: string, tempsS: number, trace: number[], cible: string | null) {
  if (!getSavedName() || !trace.length) return;
  const ms = Math.round(tempsS * 1000);
  const d = await poster('course', { race_key: race, time_ms: ms, trace, ...(cible ? { cible } : {}) });
  dernierVerdict = d.ok ? (d as unknown as VerdictEq) : { ms, error: d.error };
  prevenir();
}

/** 10 240 ms → « 10,24 ». */
export const secondes = (ms: number, fr = true) => { const s = (ms / 1000).toFixed(2); return fr ? s.replace('.', ',') : s; };
