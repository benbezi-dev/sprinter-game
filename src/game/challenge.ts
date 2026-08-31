// Defi differe : un joueur court, puis envoie un code. L'autre joue les memes
// epreuves contre le fantome du premier, et le meilleur cumul gagne.
// Meme backend que le classement mondial (Cloudflare Worker + D1).

import type { DuelIssue } from './duels';
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

/** Un defi qui m'est adresse, tel que le renvoie la boite de reception. */
export type InboxChallenge = {
  id: string;
  owner_name: string;
  races: RaceKey[];
  level_idx: number;
  total_ms: number;
  splits: number[];
  created_at: number;
};

/**
 * Les defis qui me visent et que je n'ai pas encore releves. On designe un
 * adversaire par la ligne de classement qu'il occupe : son identifiant
 * d'appareil ne quitte jamais le serveur.
 */
export async function fetchInbox(): Promise<InboxChallenge[]> {
  try {
    const res = await fetch(`${API_BASE}/inbox?device_id=${getDeviceId()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.defis || [];
  } catch {
    return [];
  }
}

export async function createChallenge(input: {
  races: RaceKey[];
  levelIdx: number;
  totalMs: number;
  splits: number[];
  traces: number[][];
  name?: string;
  /** rowid de la ligne de classement visee, pour un defi adresse */
  targetScoreId?: number | null;
  /**
   * L'identifiant du duel qu'on venge, quand ce chrono est une revanche.
   *
   * Different d'un defi adresse par ligne de classement : ici la personne
   * peut ne meme pas figurer au TOP 500 de cette epreuve, on la retrouve par
   * le duel lui-meme, ou les deux appareils sont deja inscrits. Le serveur
   * verifie seul qu'on etait bien le perdant et qu'on a bien battu son
   * chrono — voir /challenge, cote worker.
   */
  revancheDe?: string | null;
}): Promise<{ id: string; cible: string }> {
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
      target_score_id: input.targetScoreId ?? null,
      revanche_de: input.revancheDe ?? null,
    }),
  });
  if (!res.ok) throw new Error('challenge create failed');
  const data = await res.json();
  if (!data.id) throw new Error('challenge create failed');
  /**
   * On rend aussi QUI a ete prevenu, et c'est le serveur qui le dit.
   *
   * Le jeu croyait le savoir : il visait quelqu'un, donc il annoncait « defi
   * envoye a Ana ». Mais la cible peut ne pas etre retrouvee — une ligne de
   * classement effacee, un serveur d'une version plus ancienne qui ignore le
   * champ — et l'ecran affirmait alors une chose fausse a la place d'un code a
   * transmettre soi-meme. Une chaine vide veut dire « personne n'a ete
   * prevenu », et l'ecran a de quoi le dire honnetement.
   */
  return { id: data.id as string, cible: String(data.target_name || '') };
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
  duel: DuelIssue | null;
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

/* ---------------------------------------------------------------- partage
   WhatsApp et SMS acceptent un lien d'envoi direct avec un texte prerempli.
   Snapchat et Instagram, eux, n'exposent aucune adresse publique permettant
   de prefixer un message : leurs kits de partage passent par l'application.
   Le seul chemin honnete vers ces deux-la est la feuille de partage du
   telephone (navigator.share), qui liste justement les applications
   installees — Snapchat et Instagram compris. */

/** Le message qu'on envoie a l'ami : chrono, code, lien. */
export function shareText(id: string, races: string[], totalMs: number, fr: boolean): string {
  const t = (totalMs / 1000).toFixed(2);
  const ep = races.map(r => r + ' m').join(' + ');
  return fr
    ? `Je te défie sur Sprinter : ${t} s sur ${ep}. Code ${id} — ${challengeLink(id)}`
    : `I challenge you on Sprinter: ${t} s on ${ep}. Code ${id} — ${challengeLink(id)}`;
}

/** WhatsApp accepte un texte prerempli, sans destinataire impose. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Le separateur du SMS differe : iOS veut `sms:&body=`, Android `sms:?body=`.
 * Se tromper ouvre l'application sans le message.
 */
export function smsUrl(text: string): string {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  return `sms:${ios ? '&' : '?'}body=${encodeURIComponent(text)}`;
}

/** La feuille de partage native est-elle disponible ? */
export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';
}

/** Ouvre la feuille de partage du telephone. Renvoie false si refusee. */
export async function nativeShare(text: string, id: string): Promise<boolean> {
  if (!canNativeShare()) return false;
  try {
    await (navigator as any).share({ title: 'Sprinter', text, url: challengeLink(id) });
    return true;
  } catch {
    // l'utilisateur a ferme la feuille, ou le partage a ete refuse
    return false;
  }
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
