// Les pieces, cote jeu.
//
// LE SOLDE VIT SUR LE SERVEUR (worker/src/pieces.js). Ce module le lit, le
// garde pour l'affichage, et achete les Continue de la carriere. Il ne
// credite jamais rien lui-meme : les gains tombent la ou le serveur juge
// l'exploit — un duel tranche, un objectif reussi, un titre remis.
//
// LE BAREME ET LES PRIX AUSSI. Ils arrivent avec le solde (GET /pieces) ; on
// ne les recopie pas ici, sinon le jeu annoncerait un prix que le serveur ne
// fait plus payer.
//
// SEUL UN NOM RESERVE A UN PORTE-MONNAIE. Un nom libre s'ecrit depuis
// n'importe quel appareil : des pieces posees dessus seraient a qui les
// reclame. Le serveur rend `reserve: false`, et le jeu ne montre rien.
//
// CE MODULE NE CASSE JAMAIS LE JEU. Serveur injoignable : pas de solde, pas
// de Continue propose, et la carriere se termine comme avant.

import { useSyncExternalStore } from 'react';
import { getDeviceId, getSavedName } from './leaderboard';
import { EST_TEST } from './canal';

/**
 * CANAL DE TEST SEULEMENT, pour commencer (decision du 6 octobre 2026). Le
 * worker refuse aussi /pieces hors canal de test (OUVERT_EN_PRODUCTION dans
 * worker/src/pieces.js) : les deux verrous s'ouvrent ensemble.
 */
export const PIECES_OUVERTES = EST_TEST;

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

export type EtatPieces = {
  reserve: boolean;
  solde: number;
  /** Prix des Continue d'une meme carriere, dans l'ordre. */
  couts: number[];
  bareme: Record<string, number>;
};

let etat: EtatPieces | null = null;
const abonnes = new Set<() => void>();
function publier(e: EtatPieces | null) {
  etat = e;
  abonnes.forEach(f => { try { f(); } catch { /* un abonne qui tombe ne retient pas les autres */ } });
}

/** Relit le solde. Rend null si le joueur n'a pas de nom ou si le serveur ne repond pas. */
export async function rafraichirPieces(): Promise<EtatPieces | null> {
  const nom = getSavedName().trim();
  if (!PIECES_OUVERTES || !nom) { publier(null); return null; }
  try {
    const r = await fetch(`${API_BASE}/pieces?nom=${encodeURIComponent(nom)}`);
    if (!r.ok) return etat;
    const d = await r.json();
    publier({
      reserve: !!d.reserve,
      solde: Number(d.solde) || 0,
      couts: Array.isArray(d.couts_continue) ? d.couts_continue.map(Number) : [],
      bareme: d.bareme || {},
    });
  } catch { /* hors ligne : on garde ce qu'on savait */ }
  return etat;
}

export function usePieces(): EtatPieces | null {
  return useSyncExternalStore(
    f => { abonnes.add(f); return () => { abonnes.delete(f); }; },
    () => etat,
    () => null,
  );
}

/** Le prix du prochain Continue de cette carriere, ou null s'il n'y en a plus. */
export function coutDuContinue(e: EtatPieces | null, dejaAchetes: number): number | null {
  if (!e || !e.reserve) return null;
  const c = e.couts[dejaAchetes];
  return typeof c === 'number' && c > 0 ? c : null;
}

export type AchatContinue =
  | { ok: true; solde: number; cout: number }
  | { ok: false; raison: 'solde' | 'epuise' | 'nom' | 'desaccord' | 'reseau'; solde?: number;
      /** En cas de desaccord : le nombre de Continue que le serveur compte. */
      essai?: number };

/**
 * Achete le Continue n° `essai` (0 pour le premier) de la carriere `parcours`.
 *
 * Rejouer la meme demande apres une coupure ne debite pas deux fois : le
 * serveur reconnait (parcours, essai) et rend ok sans rien prendre.
 */
export async function acheterContinue(parcours: string, essai: number): Promise<AchatContinue> {
  const nom = getSavedName().trim();
  if (!PIECES_OUVERTES) return { ok: false, raison: 'reseau' };
  if (!nom) return { ok: false, raison: 'nom' };
  let d: any;
  try {
    const r = await fetch(`${API_BASE}/pieces/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, device_id: getDeviceId(), parcours, essai }),
    });
    if (r.status === 403) return { ok: false, raison: 'nom' };
    if (!r.ok) return { ok: false, raison: 'reseau' };
    d = await r.json();
  } catch {
    return { ok: false, raison: 'reseau' };
  }
  if (etat && typeof d.solde === 'number') publier({ ...etat, solde: d.solde });
  if (d.ok) return { ok: true, solde: Number(d.solde) || 0, cout: Number(d.cout) || 0 };
  const raison = ['solde', 'epuise', 'desaccord'].includes(d.raison) ? d.raison : 'reseau';
  return { ok: false, raison, solde: d.solde,
           ...(typeof d.essai === 'number' ? { essai: d.essai } : {}) };
}
