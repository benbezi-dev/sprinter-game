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
  return (await fetchInboxEtat()).defis;
}

/**
 * La meme boite, en disant si le serveur a repondu.
 *
 * Une boite vide et une boite injoignable rendent la meme liste, et pour
 * l'affichage cela n'a aucune importance : dans les deux cas il n'y a rien a
 * montrer. Pour le journal des defis, la difference est tout : il en deduit
 * qu'un defi qui n'est plus la n'a pas ete releve, et une panne de reseau lui
 * ferait declarer manques tous les defis qui nous attendent.
 */
export async function fetchInboxEtat(): Promise<{ defis: InboxChallenge[]; ok: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/inbox?device_id=${getDeviceId()}`);
    if (!res.ok) return { defis: [], ok: false };
    const data = await res.json();
    return { defis: data.defis || [], ok: true };
  } catch {
    return { defis: [], ok: false };
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

/**
 * LE DEFI DE LA CAMERA — pose a l'arrivee, sans etre lance.
 *
 * Le carton de fin du film porte un code, et il ne peut le porter que si le
 * defi existe DEJA quand la camera s'arrete : avant, donc, que le joueur ait
 * decide d'envoyer quoi que ce soit. Celui-la existe et se court, mais il ne
 * vise personne, ne fait sonner aucun telephone et ne compte pas au tableau
 * des defis lances.
 *
 * CE N'EST PAS UN « DEFI OUVERT ». Ce nom designe deja, dans ce projet, un
 * defi sans cible qu'on publie avec son code sur Instagram ou TikTok pour
 * qu'un passant le releve (tools/carte-defi-ouvert.mjs). Celui-la est LANCE ;
 * celui de la camera ne l'est pas. Le meme mot pour les deux, et la premiere
 * lecture rapide se trompe de moitie.
 *
 * SA PROPRE ROUTE, ET NON UN DRAPEAU SUR LA CREATION. L'anti-abus du serveur
 * compte par route et par adresse : partager la route, c'est laisser la camera
 * puiser dans le quota du bouton « DEFIER UN AMI » — et le lui refuser un jour
 * de bonne forme. Separees, c'est la camera qui cede en premier, et un carton
 * sans code reste un carton.
 *
 * Le second geste est `lancerChallenge`, juste en dessous.
 */
export async function ouvrirChallengeCamera(input: {
  races: RaceKey[];
  levelIdx: number;
  totalMs: number;
  splits: number[];
  traces: number[][];
  name?: string;
}): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/challenge/camera`, {
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
  if (!res.ok) throw new Error('challenge open failed');
  const data = await res.json();
  if (!data.id) throw new Error('challenge open failed');
  return { id: String(data.id) };
}

/**
 * Lance le defi que la camera a pose : celui dont le code est sur la video.
 *
 * C'est la seconde moitie de `ouvrirChallengeCamera`, et elle porte tout ce
 * que la camera s'etait interdit — la cible, le compteur, la sonnette. Le serveur verifie que le defi nous appartient : le code circule
 * en clair dans une video, et le lire ne doit pas suffire a faire sonner le
 * telephone de quelqu'un.
 *
 * Idempotente : deux appuis sur le meme defi ne valent pas deux defis au
 * compteur ni deux sonneries chez l'autre.
 *
 * `cible` est le nom de qui a ete PREVENU, et une chaine vide veut dire
 * « personne » — meme convention que `createChallenge`, pour la meme raison :
 * l'ecran ne doit pas annoncer une remise qui n'a pas eu lieu.
 */
export async function lancerChallenge(input: {
  id: string;
  name?: string;
  targetScoreId?: number | null;
  /** L'identifiant du duel qu'on venge. Meme regle qu'a la creation. */
  revancheDe?: string | null;
}): Promise<{ id: string; cible: string }> {
  const res = await fetch(`${API_BASE}/challenge/lance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: normalizeCode(input.id),
      device_id: getDeviceId(),
      name: input.name || getSavedName() || 'Anonyme',
      target_score_id: input.targetScoreId ?? null,
      revanche_de: input.revancheDe ?? null,
    }),
  });
  if (!res.ok) throw new Error('challenge launch failed');
  const data = await res.json();
  if (!data.id) throw new Error('challenge launch failed');
  return { id: String(data.id), cible: String(data.target_name || '') };
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
  /**
   * Ma trace, une par epreuve — de quoi faire de cette course un fantome.
   *
   * Le defi gardait celle du lanceur et pas la mienne, si bien que le perdant
   * du duel n'avait personne a courir dans sa revanche. Facultative : un faux
   * depart n'a rien enregistre, et le duel se tranche sans elle.
   */
  traces?: number[][];
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
      traces: input.traces || [],
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
