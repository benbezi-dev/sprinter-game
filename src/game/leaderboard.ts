// Classement mondial TOP 500 - all time. Backend : Cloudflare Worker + D1.
// Identification du joueur : identifiant anonyme genere sur l'appareil
// (aucune donnee personnelle collectee), garde dans localStorage aux
// cotes des scores locaux deja existants.

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const DEVICE_ID_KEY = 'sprinter_device_id';
const PLAYER_NAME_KEY = 'sprinter_player_name';

export type RaceKey = '100' | '200' | '400';

export type LeaderboardEntry = {
  name: string;
  time_ms: number;
  best_split_ms: number;
  updated_at: number;
};

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

export function getSavedName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // localStorage indisponible : le nom sera juste redemande la prochaine fois
  }
}

/**
 * Le TOP 500 classe le meilleur chrono realise sur UNE course, pas le cumul
 * du parcours. On refait le tri ici plutot que de dependre de l'ordre rendu
 * par le serveur : l'affichage reste juste meme si le Worker n'a pas encore
 * ete redeploye. Les lignes sans chrono par course (0) datent d'avant cette
 * mesure et n'ont pas de place dans ce classement.
 */
export function rankByRaceTime(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries
    .filter(e => e.best_split_ms > 0)
    .sort((a, b) => a.best_split_ms - b.best_split_ms);
}

/** Rang d'un chrono de course dans une liste deja filtree et triee. */
export function rankOf(entries: LeaderboardEntry[], splitMs: number): number {
  return entries.filter(e => e.best_split_ms < splitMs).length + 1;
}

export async function fetchLeaderboard(race: RaceKey): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_BASE}/leaderboard?race=${race}`);
  if (!res.ok) throw new Error('leaderboard fetch failed');
  const data = await res.json();
  return rankByRaceTime(data.entries || []);
}

/**
 * `rank` porte sur le meilleur chrono realise sur UNE course (best_split_ms),
 * pas sur le cumul du parcours : c'est ce que classe le TOP 500.
 */
export async function submitScore(race: RaceKey, name: string, timeMs: number, bestSplitMs: number): Promise<{
  rank: number;
  best_time_ms: number;
  best_split_ms: number;
  entries: LeaderboardEntry[];
}> {
  const res = await fetch(`${API_BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: getDeviceId(),
      race_key: race,
      name,
      time_ms: Math.round(timeMs),
      best_split_ms: Math.round(bestSplitMs),
    }),
  });
  if (!res.ok) throw new Error('score submit failed');
  return res.json();
}

export async function fetchMyRank(race: RaceKey): Promise<{
  found: boolean;
  rank?: number;
  name?: string;
  time_ms?: number;
  best_split_ms?: number;
}> {
  const res = await fetch(`${API_BASE}/rank?race=${race}&device_id=${getDeviceId()}`);
  if (!res.ok) throw new Error('rank fetch failed');
  return res.json();
}
