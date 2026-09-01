// Identite du joueur, sans compte.
//
// Un nom appartient a qui le reserve en premier, et cette appartenance se
// prouve par un code court. C'est le strict necessaire pour relier ses
// appareils et empecher qu'on prenne son nom, sans tiers, sans e-mail et sans
// ecran de consentement.

import { getDeviceId, getSavedName } from './leaderboard';
import { nettoyerInsta } from './insta';

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
 *
 * On accepte le pseudo sous la forme ou le joueur l'a sous la main : avec son
 * arobase, sans, ou en collant le lien du profil. Le nettoyage se fait ici
 * avant l'envoi — le serveur refait le meme, mais autant refuser tout de
 * suite ce qui n'ira pas plutot que d'attendre un aller-retour pour le dire.
 */
export async function lierInstagram(insta: string): Promise<
  { etat: 'ok'; insta: string | null } | { etat: 'invalide' | 'pas-a-toi' | 'sans-nom' | 'erreur' }
> {
  const propre = nettoyerInsta(insta);
  if (propre === null) return { etat: 'invalide' };
  try {
    const res = await fetch(`${API_BASE}/profil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: getDeviceId(), name: getSavedName(), insta: propre,
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

/**
 * Le lien vers un profil Instagram.
 *
 * On renettoie au passage : un pseudo enregistre avant que l'arobase soit
 * acceptee partout pourrait en avoir garde une, et « instagram.com/@moi »
 * n'ouvre aucun profil.
 */
export function lienInstagram(insta: string): string {
  const propre = nettoyerInsta(insta) || String(insta || '');
  return `https://instagram.com/${encodeURIComponent(propre)}`;
}
