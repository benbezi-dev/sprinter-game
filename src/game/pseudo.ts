// Les pseudos interdits, cote jeu.
//
// Le filtre est LE MEME fichier que celui du serveur (worker/src/pseudo.js) :
// une seule liste a tenir, et le jeu dit non avant d'envoyer. Le serveur
// reste le seul juge — il connait le pays du joueur, le jeu non — et c'est sa
// reponse qui ferme la course : `USERNAME_CHANGE_REQUIRED`.
//
// Deux moments allument l'ecran bloquant (PseudoAChanger.tsx) :
//   - au lancement, si le nom garde sur l'appareil ne passe plus le filtre ;
//   - a n'importe quelle reponse du serveur qui porte ce code, quelle que
//     soit la route : `installerGardePseudo` ecoute `fetch` une fois pour
//     toutes, plutot que de compter sur quarante appelants pour y penser.

// @ts-ignore — module JS du worker, sans declaration de types
import { pseudoRecevable, PSEUDO_INTERDIT, PSEUDO_A_CHANGER } from '../../worker/src/pseudo.js';
import { getSavedName, getDeviceId, saveName } from './leaderboard';

export { PSEUDO_INTERDIT, PSEUDO_A_CHANGER };

const API_HOTE = 'sprinter-leaderboard.benbezi-sprinter.workers.dev';
const API_BASE = `https://${API_HOTE}`;
const CLE = 'sprinter_pseudo_a_changer';
const CLE_RAISON = 'sprinter_pseudo_raison';

/** L'ecran bloquant s'ouvre ou se ferme. */
export const PSEUDO_A_CHANGER_EVT = 'sprinter:pseudo-a-changer';

/** Ce pseudo passe-t-il le filtre ? (francais et anglais, sans pays.) */
export function pseudoValide(nom: string): boolean {
  return !!(pseudoRecevable(nom, null) as { ok: boolean }).ok;
}

/** Le nom refuse sur cet appareil, s'il y en a un. */
export function pseudoAChanger(): string {
  try { return localStorage.getItem(CLE) || ''; } catch { return ''; }
}

function poser(valeur: string) {
  try {
    if (valeur) localStorage.setItem(CLE, valeur);
    else localStorage.removeItem(CLE);
  } catch { /* sans memoire : la verification au lancement suffira */ }
  try { window.dispatchEvent(new Event(PSEUDO_A_CHANGER_EVT)); } catch { /* hors navigateur */ }
}

export type RaisonChangement = { raison: 'interdit' | 'libere'; ancien?: string | null };

/** Pourquoi le nom doit changer : interdit, ou repris pendant l'absence. */
export function raisonChangement(): RaisonChangement {
  try {
    const r = JSON.parse(localStorage.getItem(CLE_RAISON) || 'null');
    if (r && (r.raison === 'interdit' || r.raison === 'libere')) return r;
  } catch { /* illisible : la raison la plus courante */ }
  return { raison: 'interdit' };
}

/** Le serveur (ou le filtre local) dit que ce nom doit changer. */
export function signalerPseudoAChanger(nom = getSavedName(), raison: RaisonChangement = { raison: 'interdit' }) {
  const n = (nom || '').trim();
  if (!n) return;
  try { localStorage.setItem(CLE_RAISON, JSON.stringify(raison)); } catch { /* sans memoire */ }
  if (pseudoAChanger() === n) return;
  poser(n);
}

/** Le joueur porte un nom propre : l'ecran se ferme. */
export function oublierPseudoAChanger() {
  try { localStorage.removeItem(CLE_RAISON); } catch { /* sans memoire */ }
  if (pseudoAChanger()) poser('');
}

/** Au lancement : le nom garde ici passe-t-il encore ? */
export function verifierNomGarde() {
  const n = (getSavedName() || '').trim();
  if (!n) return;
  if (!pseudoValide(n)) signalerPseudoAChanger(n);
  else if (pseudoAChanger() && pseudoAChanger() !== n && raisonChangement().raison === 'interdit') {
    oublierPseudoAChanger();
  }
}

let installee = false;
/** Ecoute toutes les reponses du serveur du jeu, une fois pour toutes. */
export function installerGardePseudo() {
  if (installee || typeof window === 'undefined' || !window.fetch) return;
  installee = true;
  const origine = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const reponse = await origine(...args);
    if (reponse.status === 403) {
      const cible = typeof args[0] === 'string' ? args[0]
        : args[0] instanceof URL ? args[0].href : (args[0] as Request).url;
      if (cible.includes(API_HOTE)) {
        reponse.clone().json()
          .then((d: { code?: string }) => { if (d?.code === PSEUDO_A_CHANGER) signalerPseudoAChanger(); })
          .catch(() => { /* pas du JSON : pas notre refus */ });
      }
    }
    return reponse;
  };
}

/**
 * Change un pseudo interdit, tout de suite et en gardant la progression
 * (`/pseudo/forcer` renomme le joueur dans toutes les tables du serveur).
 */
export async function changerPseudoForce(nouveau: string): Promise<'ok' | 'interdit' | 'pris' | 'erreur'> {
  try {
    const res = await fetch(`${API_BASE}/pseudo/forcer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name: getSavedName() || '', nouveau }),
    });
    const d = await res.json().catch(() => ({} as any));
    if (res.ok && d?.ok && d.name) {
      saveName(d.name);
      oublierPseudoAChanger();
      return 'ok';
    }
    if (d?.code === PSEUDO_INTERDIT) return 'interdit';
    if (res.status === 409) return 'pris';
    return 'erreur';
  } catch {
    return 'erreur';
  }
}

/* ---------------------------------------------------- changer de pseudo */

export type EtatDemande = {
  statut: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  demande: string; cree_le: number; resolu_le: number | null;
};
export type EtatPseudo = {
  nom: string | null; a_changer: boolean; raison: 'interdit' | 'libere' | null;
  ancien: string | null; demande: EtatDemande | null;
};

/** La demande de changement vient de changer d'etat (panneau d'identite). */
export const DEMANDE_PSEUDO_EVT = 'sprinter:demande-pseudo';

/**
 * A l'ouverture : ce que le serveur sait du pseudo de cet appareil. Une
 * demande acceptee, ou un pseudo repris pendant l'absence, changent le nom
 * garde ici ; un nom a changer ouvre l'ecran bloquant.
 */
export async function lireEtatPseudo(): Promise<EtatPseudo | null> {
  const nom = (getSavedName() || '').trim();
  if (!nom) return null;
  try {
    const q = new URLSearchParams({ name: nom, device_id: getDeviceId() });
    const res = await fetch(`${API_BASE}/pseudo/etat?${q}`);
    if (!res.ok) return null;
    const e = await res.json() as EtatPseudo;
    if (e.nom && e.nom !== nom) saveName(e.nom);
    if (e.a_changer && e.raison) signalerPseudoAChanger(e.nom || nom, { raison: e.raison, ancien: e.ancien });
    else if (pseudoAChanger() && pseudoValide(e.nom || nom)) oublierPseudoAChanger();
    try { window.dispatchEvent(new CustomEvent(DEMANDE_PSEUDO_EVT, { detail: e.demande })); } catch { /* hors navigateur */ }
    return e;
  } catch {
    return null;
  }
}

export type ResultatDemande =
  | { etat: 'envoyee'; reprise: boolean }
  | { etat: 'interdit' | 'pris' | 'en_cours' | 'invalide' | 'meme' | 'erreur' };

/** Demande un nouveau pseudo. Rien ne change avant la validation. */
export async function demanderPseudo(demande: string): Promise<ResultatDemande> {
  try {
    const res = await fetch(`${API_BASE}/pseudo/demande`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name: getSavedName() || '', demande }),
    });
    const d = await res.json().catch(() => ({} as any));
    if (res.ok && d?.ok) return { etat: 'envoyee', reprise: !!d.reprise };
    switch (d?.code) {
      case PSEUDO_INTERDIT: return { etat: 'interdit' };
      case 'USERNAME_TAKEN': return { etat: 'pris' };
      case 'REQUEST_PENDING': return { etat: 'en_cours' };
      case 'INVALID_USERNAME': return { etat: 'invalide' };
      case 'SAME_USERNAME': return { etat: 'meme' };
      default: return { etat: 'erreur' };
    }
  } catch {
    return { etat: 'erreur' };
  }
}
