// LE TCHAT DU DUEL DES MARQUES (13/10/2026) — le premier tchat en texte libre.
//
// Il ne vit que dans l'ecran du duel (DuelMarques.tsx) : le tchat commun des
// deux camps, ou l'on peut designer quelqu'un ; les messages prives entre
// inscrits ; l'invitation d'un joueur du top 500. Un message prive, une
// designation, une invitation font vibrer le telephone vise. Les regles,
// le filtre et les cadences sont dans worker/src/tchat-marques.js.
//
// Lire comme ecrire demande un nom reserve sur cet appareil : on sert des
// messages prives, et un nom libre peut etre porte par n'importe qui. Un nom
// libre se reserve d'un geste (identity.ts, nomPourLeDirect).

import { getDeviceId, getSavedName } from './leaderboard';
import { nomPourLeDirect } from './identity';
import { cleOfficielle, oublierCleOfficielle, estAuteurOfficiel } from './tchat-officiel';
import type { Camp, Epreuve } from './marques';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

export type Message = {
  /** 'sprinter' : le compte SprinterGame, qui n'est d'aucun camp ; 'joueur' :
   *  un message ecrit apres le duel, quand il n'y a plus de camps. */
  id: number; quand: number; de: string; camp: Camp | 'sprinter' | 'joueur';
  /** Un message du compte SprinterGame : seul le serveur le pose. */
  officiel?: boolean;
  /** Celui qu'on designe (commun) ou a qui l'on ecrit (prive). */
  pour: string | null;
  prive: boolean; texte: string;
  a_moi: boolean; pour_moi: boolean;
  /** Les j'aime (17/10) : combien, et si j'en suis. */
  aimes?: number; aime?: boolean;
};
/** Le compteur de j'aime d'un message, rendu a chaque lecture. */
export type Aimes = { id: number; n: number; moi: boolean };
/** Une conversation privee lue (18/10) : la cle de l'autre, le dernier prive recu de lui qu'on a vu. */
export type Lu = { avec: string; id: number };
export type Participant = { name: string; camp: Camp | 'joueur'; epreuve: Epreuve | null };
export type Invitation = { de: string; camp: Camp | null; quand: number };
export type Invitable = { name: string; invite: boolean };

/** Ce que le serveur refuse, dit au joueur. */
export type Refus = 'nom' | 'imite' | 'camp' | 'filtre' | 'vite' | 'jour' | 'absent' | 'banni' | 'top' | 'cle' | 'reseau';
/** Le filtre dit pourquoi : 'lien', 'contact', 'grossier', 'long', 'vide'. */
export type RaisonFiltre = string;

function refusDe(status: number, d: any): Refus {
  if (status === 403 && d?.error === 'nom non reserve') return 'nom';
  if (status === 403 && d?.error === 'nom du jeu') return 'imite';
  if (status === 403) return 'banni';
  if (status === 409 && d?.error === 'aucun camp choisi') return 'camp';
  if (status === 422) return 'filtre';
  if (status === 429) return d?.error === 'trop vite' ? 'vite' : 'jour';
  if (status === 404 && d?.error === 'hors du top 500') return 'top';
  if (status === 404) return 'absent';
  return 'reseau';
}

/**
 * Un appel au tchat. Un nom libre qui revient en 403 est reserve une fois,
 * en silence, puis l'appel repart : c'est le geste que fait deja le direct.
 */
async function appel(chemin: string, corps?: Record<string, unknown>, query: Record<string, string> = {}, reessai = true): Promise<{ status: number; d: any }> {
  const name = getSavedName();
  if (!name) return { status: 403, d: { error: 'nom non reserve' } };
  const device_id = getDeviceId();
  let r: Response;
  try {
    r = corps
      ? await fetch(`${API_BASE}${chemin}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...corps, name, device_id }),
        })
      : await fetch(`${API_BASE}${chemin}?${new URLSearchParams({ ...query, name, device_id })}`);
  } catch { return { status: 0, d: null }; }
  const d = await r.json().catch(() => ({}));
  if (reessai && r.status === 403 && d?.error === 'nom non reserve' && (await nomPourLeDirect()) === 'ok') {
    return appel(chemin, corps, query, false);
  }
  return { status: r.status, d };
}

export type Lecture = {
  messages: Message[]; dernier: number;
  participants?: Participant[]; invitations?: Invitation[];
  /** Les j'aime des derniers messages, deja recus ou non. */
  aimes?: Aimes[];
  /** Ses conversations privees lues, rendues a chaque lecture. */
  lus?: Lu[];
};

/**
 * Lire la suite du tchat. `tout` : avec les inscrits et ses invitations.
 * `reserver` : faux pour la pastille du tableau, qui n'a pas a reserver un
 * nom dans le dos du joueur — seule l'ouverture du tchat le fait.
 */
export async function lireTchat(depuis: number, tout = false, reserver = true): Promise<Lecture | { refus: Refus }> {
  const { status, d } = await appel('/marques/tchat', undefined,
    { depuis: String(depuis || 0), ...(tout ? { avec: 'tout' } : {}) }, reserver);
  if (status !== 200) return { refus: refusDe(status, d) };
  return d as Lecture;
}

/** Ecrire. `pour` : designer (commun) ou ecrire a (prive). */
export async function ecrire(texte: string, pour: string | null, prive: boolean): Promise<{ message: Message } | { refus: Refus; raison?: RaisonFiltre }> {
  const { status, d } = await appel('/marques/tchat', { texte, ...(pour ? { pour } : {}), prive });
  if (status !== 200) return { refus: refusDe(status, d), raison: d?.raison };
  return { message: d.message };
}

/* ------------------------------------------------ le compte SprinterGame
   Ce telephone porte-t-il la cle ? (tchat-officiel.ts) */
export const aLaCleOfficielle = () => !!cleOfficielle() || estAuteurOfficiel(getSavedName() || '');

/** Ecrire au nom de SprinterGame, dans le tchat commun. */
export async function ecrireOfficiel(texte: string): Promise<{ message: Message } | { refus: Refus; raison?: RaisonFiltre }> {
  // La cle si ce telephone la porte ; sinon le compte de l'auteur, par son nom
  // reserve sur cet appareil.
  const cle = cleOfficielle();
  const name = getSavedName() || '';
  if (!cle && !estAuteurOfficiel(name)) return { refus: 'cle' };
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/marques/tchat/officiel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cle ? { 'X-Sprinter-Tchat': cle } : {}) },
      body: JSON.stringify({ texte, name, device_id: getDeviceId() }),
    });
  } catch { return { refus: 'reseau' }; }
  const d = await r.json().catch(() => ({}));
  if (r.status === 403) { if (cle) oublierCleOfficielle(); return { refus: cle ? 'cle' : 'nom' }; }
  if (r.status !== 200) return { refus: refusDe(r.status, d), raison: d?.raison };
  return { message: d.message };
}

export async function signalerMessage(id: number, motif: string): Promise<boolean> {
  const { status } = await appel('/marques/tchat/signaler', { id, motif });
  return status === 200;
}

/** Aimer un message, ou ne plus l'aimer. Rend le compteur a jour, ou null. */
export async function aimerMessage(id: number, aime: boolean): Promise<{ aimes: number; aime: boolean } | null> {
  const { status, d } = await appel('/marques/tchat/aimer', { id, aime });
  return status === 200 ? { aimes: d.aimes, aime: d.aime } : null;
}

/**
 * Marquer lue la conversation privee avec `avec`, jusqu'au message `jusqua`.
 * Rend ce que le serveur retient, ou null : le jeu garde alors sa marque
 * locale, et la redemandera a la prochaine ouverture.
 */
export async function marquerLu(avec: string, jusqua: number): Promise<Lu | null> {
  const { status, d } = await appel('/marques/tchat/lu', { avec, jusqua });
  return status === 200 ? { avec: d.avec, id: d.id } : null;
}

/** Le top 500 des trois epreuves, moins les inscrits. */
export async function lireInvitables(): Promise<Invitable[] | { refus: Refus }> {
  const { status, d } = await appel('/marques/invitables');
  if (status !== 200) return { refus: refusDe(status, d) };
  return d.joueurs as Invitable[];
}

export async function inviter(nom: string): Promise<true | { refus: Refus }> {
  const { status, d } = await appel('/marques/inviter', { cible: nom });
  return status === 200 ? true : { refus: refusDe(status, d) };
}

/* ------------------------------------------------ les non-lus, par appareil
   Le dernier message vu, pour la pastille du bouton TCHAT. Local : ce n'est
   qu'une pastille, et la perdre ne cache rien. */
const CLE_VU = 'sprinter_tchat_marques_vu';
export function dernierVu(): number {
  try { return Number(localStorage.getItem(CLE_VU) || 0) || 0; } catch { return 0; }
}
export function poserVu(id: number) {
  try { if (id > dernierVu()) localStorage.setItem(CLE_VU, String(id)); } catch { /* stockage refuse */ }
}
