// LE DUEL DES EPREUVES — LES FANTOMES (11/11/2026). Les regles vivent dans
// worker/src/duel-epreuves.js ; ce module demande le fantome a battre, lance
// la course et envoie la trace. Le serveur choisit l'adversaire (a ta mesure)
// et dit le chrono a battre, deja alourdi des voix que tient le fantome.

import { getDeviceId, getSavedName } from './leaderboard';
import { SprinterApp } from './engine';
import { etirer } from './noel';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
export const EPREUVES_DUEL = ['60', '200s', '400s'];
// Le vote se ferme le 7/12 0 h Paris : apres, plus rien a envoyer.
const FIN = Date.UTC(2026, 11, 6, 23, 0);

export type FantomeEpreuve = { name: string; cible: string; epreuve: string; ms: number; a_battre_ms: number; facteur: number; voix: number; trace: number[] };

export async function fetchFantome(epreuve: string, cible?: string): Promise<FantomeEpreuve | null> {
  try {
    const nom = getSavedName();
    const r = await fetch(`${API_BASE}/duel-epreuves/fantome?epreuve=${encodeURIComponent(epreuve)}`
      + `${nom ? `&name=${encodeURIComponent(nom)}` : ''}${cible ? `&cible=${encodeURIComponent(cible)}` : ''}`);
    if (!r.ok) return null;
    const f = await r.json();
    return Array.isArray(f?.trace) && f.trace.length > 1 ? f : null;
  } catch { return null; }
}

/** Courir contre le fantome a battre (a ta mesure, ou `cible`). Faux si aucun n'a pu venir. */
export async function defier(epreuve: string, cible?: string): Promise<boolean> {
  const f = await fetchFantome(epreuve, cible);
  if (!f) return false;
  (SprinterApp as any).startOneShot([epreuve], {
    levelIdx: 4,
    ghosts: [etirer(f.trace, f.facteur)],
    ghostSplits: [f.a_battre_ms / 1000],
    ghostName: `${f.name.toUpperCase()} · ${f.voix}`,
    ghostTime: f.a_battre_ms / 1000,
    etiquette: 'fantome',
    duelEpreuves: { cible: f.cible },
  });
  return true;
}

export type VerdictEpreuves = { epreuve: string; ms: number; duel: null | { cible: string; cible_ms: number; gagne: boolean; notee: boolean; annulees: number } };
/** Le dernier verdict d'une attaque, pour la banderole au retour a l'accueil. */
export let dernierVerdict: VerdictEpreuves | null = null;
export function oublierVerdict() { dernierVerdict = null; }

/**
 * Une course de 60, 200 ou 400 m en salle vient de finir (engine.ts) : sa
 * trace part au serveur, qui en fait le fantome du joueur et juge l'attaque.
 * La voix, elle, part par /race comme avant. Jamais bloquant.
 */
export async function envoyerCourse(epreuve: string, tempsS: number, trace: number[], cible: string | null) {
  const name = getSavedName();
  if (!name || trace.length < 2 || Date.now() >= FIN) return;
  try {
    const r = await fetch(`${API_BASE}/duel-epreuves/course`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: getDeviceId(), name, race_key: epreuve, time_ms: Math.round(tempsS * 1000), trace,
        ...(cible ? { cible } : {}),
      }),
    });
    if (!r.ok) return;
    const d = await r.json().catch(() => null);
    if (d?.ok && d.duel) dernierVerdict = { epreuve, ms: d.ms, duel: d.duel };
  } catch { /* hors ligne : la voix compte, le fantome attendra */ }
}
