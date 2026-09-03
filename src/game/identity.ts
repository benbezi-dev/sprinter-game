// Identite du joueur, sans compte.
//
// Un nom appartient a qui le reserve en premier, et cette appartenance se
// prouve par un code court. C'est le strict necessaire pour relier ses
// appareils et empecher qu'on prenne son nom, sans tiers, sans e-mail et sans
// ecran de consentement.

import { getDeviceId, getSavedName } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const CODE_KEY = 'sprinter_recovery_code';

export function savedCode(): string {
  try { return localStorage.getItem(CODE_KEY) || ''; } catch { return ''; }
}
function keepCode(code: string) {
  try { localStorage.setItem(CODE_KEY, code); } catch { /* sans memoire */ }
}

export type ClaimResult =
  | { etat: 'reserve'; name: string; code: string; deja: boolean }
  | { etat: 'pris' }
  | { etat: 'reseau' };

/**
 * Reserve un nom. Rend le code si le nom est libre ou deja a nous ; signale
 * qu'il est pris sinon — il faudra alors le code de son proprietaire.
 */
export async function claimName(name: string): Promise<ClaimResult> {
  try {
    const res = await fetch(`${API_BASE}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name }),
    });
    if (!res.ok) return { etat: 'reseau' };
    const d = await res.json();
    if (d.ok) { keepCode(d.code); return { etat: 'reserve', name: d.name, code: d.code, deja: !!d.deja }; }
    if (d.pris) return { etat: 'pris' };
    return { etat: 'reseau' };
  } catch {
    return { etat: 'reseau' };
  }
}

export type LinkResult = 'lie' | 'mauvais_code' | 'inconnu' | 'reseau';

/** Relie cet appareil a un nom deja reserve, code a l'appui. */
export async function linkDevice(name: string, code: string): Promise<LinkResult> {
  try {
    const res = await fetch(`${API_BASE}/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name, code: code.trim().toUpperCase() }),
    });
    if (!res.ok) return 'reseau';
    const d = await res.json();
    if (d.ok) { keepCode(code.trim().toUpperCase()); return 'lie'; }
    if (d.mauvais_code) return 'mauvais_code';
    if (d.inconnu) return 'inconnu';
    return 'reseau';
  } catch {
    return 'reseau';
  }
}

/**
 * Lier son compte Instagram a son nom de joueur.
 *
 * Ce n'est pas une connexion : Instagram ne nous dit rien et ne verifie rien.
 * Le joueur declare son pseudo, et le serveur controle seulement qu'il a le
 * droit d'ecrire sous ce nom — sinon on pourrait accrocher le compte de
 * quelqu'un d'autre a son propre chrono.
 *
 * L'API qui permettait une vraie connexion Instagram pour un compte personnel
 * a ete retiree par Meta fin 2024 ; ce qui subsiste ne vaut que pour les
 * comptes professionnels et demande une revue d'application. D'ou ce choix.
 */
export async function lierInstagram(insta: string): Promise<
  { etat: 'ok'; insta: string | null } | { etat: 'invalide' | 'pas-a-toi' | 'sans-nom' | 'erreur' }
> {
  try {
    const res = await fetch(`${API_BASE}/profil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: getDeviceId(), name: getSavedName(), insta,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) return { etat: 'ok', insta: d.insta ?? null };
    if (res.status === 403) return { etat: 'pas-a-toi' };
    if (res.status === 409) return { etat: 'sans-nom' };
    return { etat: 'invalide' };
  } catch {
    return { etat: 'erreur' };
  }
}

/** Le pseudo actuellement lie a ce nom, s'il y en a un. */
export async function instagramDe(nom: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/profil?name=${encodeURIComponent(nom)}`);
    if (!res.ok) return null;
    return (await res.json()).insta || null;
  } catch {
    return null;
  }
}

/** Le lien vers un profil Instagram. */
export function lienInstagram(insta: string): string {
  return `https://instagram.com/${encodeURIComponent(insta)}`;
}

/* ---------------------------------------------------------------------------
   LA NATIONALITE
   ---------------------------------------------------------------------------
   Elle vit sur `/profil`, avec le pseudo Instagram, et non sous `/champ/` :
   cette porte-la est fermee en production (`championnatsOuverts` vaut
   `canal.test` cote worker), alors que l'ecran du nom tourne chez tous les
   joueurs. Un pays n'est pas une donnee de championnat — c'est ce qui permet a
   un joueur de dire d'ou il vient, des maintenant, pour des championnats qui
   viendront apres.

   Elle est OPTIONNELLE et le reste. Le serveur sait deja d'ou l'on se
   connecte — Cloudflare le voit a chaque course — mais ce qu'il voit est un
   lieu, pas une nationalite : quelqu'un qui joue depuis Bruxelles peut courir
   pour le Maroc. La detection ne sert donc qu'a proposer, jamais a decider,
   et un choix pose ici ne se fait plus jamais ecraser par elle.
--------------------------------------------------------------------------- */

export type Nation = { code: string; nom: string; continent: string | null };

/** Les pays que le jeu sait nommer. Chargés une fois, gardés. */
let nationsEnCache: Nation[] | null = null;
export async function nations(): Promise<Nation[]> {
  if (nationsEnCache) return nationsEnCache;
  try {
    const res = await fetch(`${API_BASE}/nations`);
    if (!res.ok) return [];
    nationsEnCache = (await res.json()).nations || [];
    return nationsEnCache!;
  } catch {
    return [];
  }
}

export type MonPays = {
  /** Le pays retenu, ou null si personne n'en a posé. */
  pays: string | null;
  /** 'choix' quand le joueur l'a dit, 'vu' quand ce n'est qu'une détection. */
  source: 'choix' | 'geo' | 'vu' | null;
  /** Vrai quand le pays a été choisi : il ne changera plus. */
  definitif: boolean;
};

/**
 * Le pays de ce nom, et d'où il vient.
 *
 * La `source` compte plus que le pays lui-même : elle dit à l'écran s'il doit
 * afficher un choix fait ou une simple suggestion. Les confondre reviendrait à
 * cocher une nationalité que personne n'a déclarée.
 */
export async function paysDe(nom: string): Promise<MonPays> {
  try {
    const res = await fetch(`${API_BASE}/profil?name=${encodeURIComponent(nom || '')}`);
    if (!res.ok) return { pays: null, source: null, definitif: false };
    const d = await res.json();
    return { pays: d.pays || null, source: d.source || null, definitif: d.source === 'choix' };
  } catch {
    return { pays: null, source: null, definitif: false };
  }
}

/**
 * Choisit la nationalité de ce nom. UNE FOIS.
 *
 * Le serveur refuse toute nationalité posée sur une nationalité déjà choisie.
 * Ce refus arrive en 409 — le MÊME code que « réserve d'abord ton nom », qui
 * existait avant : on tranche donc sur le message, pas sur le statut. Se fier
 * au seul 409 dirait au joueur de choisir un nom qu'il a déjà, ce qui est le
 * genre de message dont on ne se relève pas.
 */
export async function poserPays(pays: string): Promise<
  { etat: 'ok'; pays: string | null }
  | { etat: 'deja-choisi'; pays: string | null }
  | { etat: 'invalide' | 'pas-a-toi' | 'sans-nom' | 'erreur' }
> {
  try {
    const res = await fetch(`${API_BASE}/profil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: getDeviceId(), name: getSavedName(), pays,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) return { etat: 'ok', pays: d.pays ?? null };
    if (res.status === 403) return { etat: 'pas-a-toi' };
    if (res.status === 409) {
      const quoi = String(d.error || '');
      if (quoi.startsWith('nationalite')) return { etat: 'deja-choisi', pays: d.pays ?? null };
      return { etat: 'sans-nom' };
    }
    return { etat: 'invalide' };
  } catch {
    return { etat: 'erreur' };
  }
}
