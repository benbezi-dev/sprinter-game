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
  /** rowid opaque : sert a designer ce joueur sans exposer son appareil */
  id?: number;
  /** sa course est-elle rejouable en fantome ? */
  has_ghost?: boolean;
  /** pseudo Instagram declare par le joueur, non verifie */
  insta?: string | null;
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
  return oneEntryPerPlayer(entries.filter(e => e.best_split_ms > 0), 'race')
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
  return oneEntryPerPlayer(entries.filter(e => e.time_ms > 0 && e.time_ms < NO_RUN_MS), 'run')
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

/**
 * Le serveur ne rend qu'une entree par joueur, sur son meilleur chrono. Le
 * regroupement depend donc de la categorie demandee : le meilleur temps d'une
 * course et le meilleur cumul ne viennent pas forcement de la meme course.
 */
export async function fetchLeaderboardRaw(
  race: RaceKey, by: 'race' | 'run' = 'race'
): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_BASE}/leaderboard?race=${race}&by=${by}`);
  if (!res.ok) throw new Error('leaderboard fetch failed');
  const data = await res.json();
  return data.entries || [];
}

/**
 * Filet de securite : si le serveur n'a pas encore la version qui regroupe,
 * on ne laisse pas un joueur occuper plusieurs lignes. On garde sa meilleure.
 */
export function oneEntryPerPlayer(
  entries: LeaderboardEntry[], by: 'race' | 'run' = 'race'
): LeaderboardEntry[] {
  const valeur = (e: LeaderboardEntry) => (by === 'run' ? e.time_ms : e.best_split_ms);
  const garde = new Map<string, LeaderboardEntry>();
  for (const e of entries) {
    const k = String(e.name || '').trim().toLowerCase();
    const deja = garde.get(k);
    if (!deja || valeur(e) < valeur(deja)) garde.set(k, e);
  }
  return [...garde.values()];
}

export async function fetchLeaderboard(race: RaceKey): Promise<LeaderboardEntry[]> {
  return rankByRaceTime(await fetchLeaderboardRaw(race));
}

/**
 * Le serveur a refuse le nom : il est reserve a d'autres appareils que celui-ci.
 *
 * Ce refus n'est pas une panne, et c'est tout l'interet de le distinguer : il
 * ne passera jamais avec le temps. « echec de l'envoi, reessaie plus tard »
 * envoyait donc le joueur reappuyer indefiniment sur un bouton qui ne pouvait
 * pas marcher, sans jamais lui dire ce qui bloquait ni ce qu'il pouvait y
 * faire — alors que la reponse du serveur, elle, le disait (403, `pris`).
 *
 * Le cas se rencontre pour de bon sur le canal de test : le navigateur y
 * partage son identifiant d'appareil et son nom avec le vrai jeu — meme
 * origine, meme localStorage — mais la reservation du nom vit dans la base du
 * canal. Un nom reserve ici et pas la-bas refuse tous les chronos, course
 * apres course.
 */
export const NOM_PRIS = 'nom-pris';

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
  // Le nom reserve a quelqu'un d'autre se reconnait a son corps, pas a son
  // statut : 403 sert aussi ailleurs.
  if (res.status === 403) {
    const d = await res.json().catch(() => null);
    if (d && d.pris) throw new Error(NOM_PRIS);
  }
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

/**
 * Parmi les chronos d'un programme (one shot ou defi), ceux qui entrent au
 * TOP 500 de leur propre discipline. Chaque course est jugee chez elle : un
 * 100 m se compare a des 100 m, quel que soit le mode qui l'a produit.
 */
export type RaceOutcome = {
  race: RaceKey;
  ms: number;
  rank: number;
  /** Chrono deja detenu par ce joueur sur cette epreuve, s'il en a un. */
  ownMs: number | null;
  /** Sa place actuelle avec ce chrono. */
  ownRank: number | null;
  /** Le nouveau chrono ameliore-t-il son propre record ? */
  beatsOwn: boolean;
};

export async function qualifyingRaces(
  races: RaceKey[], splitsSec: (number | null)[]
): Promise<RaceOutcome[]> {
  const out: RaceOutcome[] = [];
  for (let i = 0; i < races.length; i++) {
    const s = splitsSec[i];
    if (s == null || s <= 0) continue;
    const ms = s * 1000;
    try {
      const [list, mine] = await Promise.all([
        fetchLeaderboardRaw(races[i]).then(rankByRaceTime),
        fetchMyRank(races[i]).catch(() => ({ found: false } as any)),
      ]);
      const rank = rankOf(list, ms);
      if (rank > TOP_N) continue;
      // Le serveur ne conserve qu'un chrono par appareil et par epreuve, et
      // garde le meilleur. Un temps plus lent que le sien ne changera donc
      // rien au tableau : autant le dire plutot que d'annoncer une place
      // qu'on n'occupera pas.
      const ownMs = mine.found && mine.best_split_ms ? mine.best_split_ms : null;
      const ownRank = mine.found && mine.rank ? mine.rank : null;
      out.push({ race: races[i], ms, rank, ownMs, ownRank, beatsOwn: ownMs === null || ms < ownMs });
    } catch {
      // classement injoignable : on n'annonce pas une place qu'on ignore
    }
  }
  return out;
}

/**
 * Les noms du haut du tableau d'une discipline, dedoublonnes. Un meme joueur
 * peut occuper plusieurs lignes du TOP 500 ; il ne doit sortir qu'une fois,
 * sans quoi il courrait contre lui-meme.
 */
export async function fetchTopNames(race: RaceKey, limit = 24): Promise<string[]> {
  const list = rankByRaceTime(await fetchLeaderboardRaw(race));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of list) {
    const k = String(e.name || '').trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(e.name);
    if (out.length >= limit) break;
  }
  return out;
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
