// LE FAUX DEPART D'UN DUEL, MIS DE COTE LE TEMPS DE LE RACHETER.
//
// DECISION DE L'AUTEUR DU 10 NOVEMBRE 2026 : un faux depart dans un duel se
// rachete par une pub ou des pieces, et la defaite ne part chez l'adversaire
// que si le joueur y renonce. Tant qu'il hesite, elle attend ici.
//
// GARDEE SUR L'APPAREIL, PAS EN MEMOIRE : fermer l'appli sur l'ecran du faux
// depart ne doit pas effacer la defaite. Elle part a la sortie de l'ecran
// (OneShotEndScreen) ou, a defaut, au prochain lancement (App.tsx).
//
// A DUEL FALSE START WAITS HERE WHILE THE PLAYER MAY BUY IT BACK; it is sent
// when they leave the screen, or at the next app launch.

import { submitAttempt } from './challenge';
import { NO_RUN_MS } from './leaderboard';

const CLE = 'sprinter_dsq_attente';

type Attente = { id: string; name?: string };

export function garderLeFauxDepart(a: Attente): void {
  try { localStorage.setItem(CLE, JSON.stringify(a)); } catch { /* stockage refuse : rien a garder */ }
}

export function oublierLeFauxDepart(): void {
  try { localStorage.removeItem(CLE); } catch { /* rien */ }
}

function lire(): Attente | null {
  try {
    const d = JSON.parse(localStorage.getItem(CLE) || 'null');
    return d && typeof d.id === 'string' ? d : null;
  } catch { return null; }
}

/** Envoie la defaite en attente, s'il y en a une. Garde-la si le reseau manque. */
export async function envoyerLeFauxDepartEnAttente(): Promise<void> {
  const a = lire();
  if (!a) return;
  try {
    await submitAttempt({ id: a.id, totalMs: NO_RUN_MS, splits: [], name: a.name, traces: [] });
    if (lire()?.id === a.id) oublierLeFauxDepart();
  } catch { /* hors ligne : on reessaiera au prochain lancement */ }
}
