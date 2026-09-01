// Historique personnel des courses.
//
// Deux niveaux volontairement redondants. Le jeu ecrit d'abord sur l'appareil
// — c'est instantane, ca marche hors ligne, et une course terminee ne doit
// jamais dependre du reseau pour exister. Puis il l'envoie au serveur, qui
// l'indexe sur le nom du joueur : c'est ce qui permet de retrouver ses courses
// en changeant de telephone. A la lecture, le serveur fait foi quand il
// repond, l'appareil sert de repli.

import { getDeviceId, getSavedName, type RaceKey } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

export type Course = {
  race: RaceKey;
  seconds: number;
  mode: 'campaign' | 'oneshot';
  level: number;
  at: number;
};

/** Ce que le jeu range dans localStorage, en abrege. */
type Locale = { r: RaceKey; t: number; m: string; l: number; d: number };

export function localHistory(race: RaceKey): Course[] {
  const brut = ((globalThis as any).SprinterApp?.raceHistory?.() || []) as Locale[];
  return brut
    .filter(c => c.r === race)
    .map(c => ({
      race: c.r, seconds: c.t,
      mode: c.m === 'oneshot' ? 'oneshot' : 'campaign',
      level: c.l, at: c.d,
    }));
}

/** Envoi au serveur, sans bloquer : la course est deja gardee en local. */
export function pushRace(race: RaceKey, seconds: number, mode: string, level: number) {
  fetch(`${API_BASE}/race`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: getDeviceId(),
      name: getSavedName() || 'Anonyme',
      race_key: race,
      time_ms: Math.round(seconds * 1000),
      mode: mode === 'oneshot' ? 'oneshot' : 'campaign',
      level_idx: level,
    }),
    keepalive: true,
  }).catch(() => { /* hors ligne : l'exemplaire local suffit */ });
}

/**
 * Une reprise : le joueur vient de rappuyer sur RECOMMENCER. Fire-and-forget,
 * comme `pushRace` — le raccourci ne doit jamais attendre le reseau. Sert au
 * seul tableau de bord : savoir combien de fois une course est relancee, et si
 * le bouton sert.
 */
export function pushReprise() {
  fetch(`${API_BASE}/reprise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: getDeviceId() }),
    keepalive: true,
  }).catch(() => { /* hors ligne ou compteur pas deploye : sans consequence */ });
}

/**
 * Historique d'une epreuve. Le serveur fait foi — il porte les courses de tous
 * les appareils du joueur. S'il ne repond pas, on rend celui de l'appareil.
 */
export async function fetchHistory(race: RaceKey): Promise<{ courses: Course[]; distant: boolean }> {
  try {
    const nom = encodeURIComponent(getSavedName() || '');
    const res = await fetch(`${API_BASE}/races?device_id=${getDeviceId()}&race=${race}&name=${nom}`);
    if (!res.ok) throw new Error('indisponible');
    const data = await res.json();
    const courses: Course[] = (data.courses || []).map((c: any) => ({
      race: c.race_key, seconds: c.time_ms / 1000,
      mode: c.mode === 'oneshot' ? 'oneshot' : 'campaign',
      level: c.level_idx, at: c.created_at,
    }));
    return { courses, distant: true };
  } catch {
    return { courses: localHistory(race), distant: false };
  }
}
