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

/**
 * Seconde categorie : le cumul du parcours complet, celui de la carriere en
 * six etapes. Un cumul a 0 signifie qu'aucun parcours entier n'a ete boucle.
 */
/**
 * Un record sur une seule course peut tomber en pleine carriere, avant qu'un
 * parcours complet ait ete boucle. Il n'y a alors aucun cumul a declarer : on
 * envoie cette valeur, que le classement des parcours ignore. Le Worker ne
 * remplace le cumul que s'il est meilleur, donc un vrai parcours deja
 * enregistre survit intact a l'envoi d'un record de course.
 */
export const NO_RUN_MS = 1200000;

export function rankByRunTime(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries
    .filter(e => e.time_ms > 0 && e.time_ms < NO_RUN_MS)
    .sort((a, b) => a.time_ms - b.time_ms);
}

/** Rang d'un chrono de course dans une liste deja filtree et triee. */
export function rankOf(entries: LeaderboardEntry[], splitMs: number): number {
  return entries.filter(e => e.best_split_ms < splitMs).length + 1;
}

/** Nombre de places au classement : au-dela, on n'entre pas au tableau. */
export const TOP_N = 500;

/**
 * Le chrono entre-t-il au TOP 500 ? Tant que le tableau n'est pas plein,
 * n'importe quel chrono y a sa place.
 */
export function makesTop(entries: LeaderboardEntry[], splitMs: number): boolean {
  return rankOf(entries, splitMs) <= TOP_N;
}

/** Liste brute, non triee : les deux categories s'en deduisent. */
export async function fetchLeaderboardRaw(race: RaceKey): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_BASE}/leaderboard?race=${race}`);
  if (!res.ok) throw new Error('leaderboard fetch failed');
  const data = await res.json();
  return data.entries || [];
}

export async function fetchLeaderboard(race: RaceKey): Promise<LeaderboardEntry[]> {
  return rankByRaceTime(await fetchLeaderboardRaw(race));
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

/**
 * Enregistre un record realise sur une seule course, sans toucher au
 * classement des parcours complets.
 */
export async function submitRaceRecord(race: RaceKey, name: string, splitMs: number) {
  return submitScore(race, name, NO_RUN_MS, splitMs);
}

/** Meilleur chrono mondial sur une course, ou null si le tableau est vide. */
export async function fetchRaceBest(race: RaceKey): Promise<number | null> {
  const list = rankByRaceTime(await fetchLeaderboardRaw(race));
  return list.length ? list[0].best_split_ms : null;
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
