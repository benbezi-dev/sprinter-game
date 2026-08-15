// Defi differe : un joueur court, puis envoie un code. L'autre joue les memes
// epreuves contre le fantome du premier, et le meilleur cumul gagne.
// Meme backend que le classement mondial (Cloudflare Worker + D1).

import { getDeviceId, getSavedName, type RaceKey } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

export type ChallengeAttempt = {
  name: string;
  total_ms: number;
  splits: number[];
  created_at: number;
};

export type Challenge = {
  id: string;
  owner_name: string;
  races: RaceKey[];
  level_idx: number;
  total_ms: number;
  splits: number[];
  /** une trace par epreuve, en decimetres, echantillonnee tous les REC_STEP */
  traces: number[][];
  created_at: number;
  attempts: ChallengeAttempt[];
};

/** Le code est saisi a la main : on tolere les minuscules et les espaces. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function createChallenge(input: {
  races: RaceKey[];
  levelIdx: number;
  totalMs: number;
  splits: number[];
  traces: number[][];
  name?: string;
}): Promise<string> {
  const res = await fetch(`${API_BASE}/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: getDeviceId(),
      name: input.name || getSavedName() || 'Anonyme',
      races: input.races,
      level_idx: input.levelIdx,
      total_ms: Math.round(input.totalMs),
      splits: input.splits.map(s => Math.round(s)),
      traces: input.traces,
    }),
  });
  if (!res.ok) throw new Error('challenge create failed');
  const data = await res.json();
  if (!data.id) throw new Error('challenge create failed');
  return data.id as string;
}

export async function fetchChallenge(code: string): Promise<Challenge | null> {
  const id = normalizeCode(code);
  if (!id) return null;
  const res = await fetch(`${API_BASE}/challenge?id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('challenge fetch failed');
  const data = await res.json();
  return data.found ? (data as Challenge) : null;
}

export async function submitAttempt(input: {
  id: string;
  totalMs: number;
  splits: number[];
  name?: string;
}): Promise<{
  owner_name: string;
  owner_total_ms: number;
  your_total_ms: number;
  attempts: ChallengeAttempt[];
}> {
  const res = await fetch(`${API_BASE}/challenge/attempt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: normalizeCode(input.id),
      device_id: getDeviceId(),
      name: input.name || getSavedName() || 'Anonyme',
      total_ms: Math.round(input.totalMs),
      splits: input.splits.map(s => Math.round(s)),
    }),
  });
  if (!res.ok) throw new Error('attempt submit failed');
  return res.json();
}

/** Lien partageable. On reste sur la page du jeu, le code passe en `?defi=`. */
export function challengeLink(id: string): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}?defi=${id}`;
}

/** Code present dans l'URL au chargement, s'il y en a un. */
export function codeFromUrl(): string {
  try {
    const p = new URLSearchParams(window.location.search).get('defi');
    return p ? normalizeCode(p) : '';
  } catch {
    return '';
  }
}

/** Retire le code de l'URL une fois pris en compte, sans recharger la page. */
export function clearUrlCode() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('defi');
    window.history.replaceState({}, '', url.toString());
  } catch {
    // pas d'History API : le code restera dans l'URL, sans consequence
  }
}
