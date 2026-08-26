// Identite du joueur, sans compte.
//
// Un nom appartient a qui le reserve en premier, et cette appartenance se
// prouve par un code court. C'est le strict necessaire pour relier ses
// appareils et empecher qu'on prenne son nom, sans tiers, sans e-mail et sans
// ecran de consentement.

import { getDeviceId } from './leaderboard';

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
