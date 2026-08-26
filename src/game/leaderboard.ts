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
export function rankByRunTime(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries
    .filter(e => e.time_ms > 0)
    .sort((a, b) => a.time_ms - b.time_ms);
}

/** Rang d'un chrono de course dans une liste deja filtree et triee. */
export function rankOf(entries: LeaderboardEntry[], splitMs: number): number {
  return entries.filter(e => e.best_split_ms < splitMs).length + 1;
}

/**
 * Le record du monde de la distance : la premiere ligne du TOP 500, celle
 * que l'on bat en fin de course. Aucune ligne classable = pas encore de
 * record, la distance est vierge.
 */
export function worldRecord(entries: LeaderboardEntry[]): LeaderboardEntry | null {
  return rankByRaceTime(entries)[0] || null;
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

/**
 * Toute lecture du classement passe par ici : un observateur y suffit donc a
 * tenir a jour la grille de depart des Jeux olympiques, sans que ce module
 * ait a connaitre le jeu. Un seul observateur, pose une fois au demarrage.
 */
type Watcher = (race: RaceKey, entries: LeaderboardEntry[]) => void;
let watcher: Watcher | null = null;
export function onLeaderboard(fn: Watcher | null) { watcher = fn; }

/** Liste brute, non triee : les deux categories s'en deduisent. */
export async function fetchLeaderboardRaw(race: RaceKey): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_BASE}/leaderboard?race=${race}`);
  if (!res.ok) throw new Error('leaderboard fetch failed');
  const data = await res.json();
  const entries: LeaderboardEntry[] = data.entries || [];
  if (watcher) { try { watcher(race, entries); } catch (e) { } }
  return entries;
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
 * Chrono d'une seule course, envoye des la ligne d'arrivee franchie quand il
 * bat le record du monde de la distance. Il n'y a pas de parcours complet
 * derriere : `split_only` dit au serveur de ne toucher qu'au meilleur chrono
 * par course et de laisser le cumul du parcours intact — sans quoi un 100 m
 * de dix secondes viendrait truster le classement des parcours complets.
 *
 * La trace de la course accompagne l'envoi : le record devient ainsi
 * affrontable en fantome depuis le tableau.
 */
export async function submitRaceTime(
  race: RaceKey, name: string, splitMs: number, trace?: number[] | null
): Promise<{
  rank: number;
  best_split_ms: number;
  entries: LeaderboardEntry[];
}> {
  const split = Math.round(splitMs);
  const res = await fetch(`${API_BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: getDeviceId(),
      race_key: race,
      name,
      time_ms: split,
      best_split_ms: split,
      split_only: true,
      trace: trace && trace.length ? trace : undefined,
    }),
  });
  if (!res.ok) throw new Error('race time submit failed');
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
