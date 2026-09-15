// Les annonces ecrites a la main a tous les joueurs.
//
// Le serveur n'en garde qu'une qui compte : la derniere du mois. Ce que le jeu
// retient, lui, c'est seulement la derniere qu'il a montree — d'ou une
// annonce qui ne revient pas une fois lue, sur cet appareil.

import { SprinterApp } from './engine';
import { surCourrier } from './boite';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const CLE_VUE = 'sprinter_annonce_vue';

// Toucher la notification quand le jeu est ferme le demarre, et le genre
// arrive alors avant que le panneau ne soit monte pour l'entendre. On le
// retient ici, a l'import, et le panneau le lit en se montant.
let ouvertureDemandee = false;
surCourrier(quoi => { if (quoi === 'annonce') ouvertureDemandee = true; });

/** Vrai une seule fois apres un toucher de notification. */
export function prendreDemandeOuverture(): boolean {
  const d = ouvertureDemandee;
  ouvertureDemandee = false;
  return d;
}

export interface Annonce { id: number; titre: string; texte: string; cree_le: number }

/** La derniere annonce, dans la langue du jeu. Null s'il n'y en a pas. */
export async function fetchAnnonce(): Promise<Annonce | null> {
  try {
    const langue = SprinterApp.N.getLang() === 'en' ? 'en' : 'fr';
    const res = await fetch(`${API_BASE}/annonce?langue=${langue}`);
    if (!res.ok) return null;
    const d = await res.json();
    return d && d.annonce && d.annonce.id ? d.annonce : null;
  } catch {
    return null;
  }
}

export function annonceVue(id: number): boolean {
  try { return Number(localStorage.getItem(CLE_VUE) || 0) >= id; }
  catch { return false; }
}

export function marquerAnnonceVue(id: number) {
  try { localStorage.setItem(CLE_VUE, String(id)); } catch { /* stockage ferme */ }
}
