// Inviter quelqu'un a courir en direct, depuis le classement des duels.
//
// Le mode direct se rejoignait par un code : on ouvre une salle, on copie six
// lettres, on les fait parvenir par un autre canal. Cela suppose d'avoir deja
// la personne au telephone — ce qui est vrai des amis pour qui le mode a ete
// fait, et faux de tous les autres. Quelqu'un croise au classement des duels
// n'est joignable par aucun de ces moyens : on ne connait de lui qu'un
// pseudonyme.
//
// Ce module ouvre l'autre chemin. Le serveur fait la jonction entre un
// pseudonyme et un appareil, et cette jonction ne remonte jamais ici : on
// envoie des noms, on ne recoit jamais d'identifiant d'appareil. Etre au
// classement ne doit pas rendre joignable en dehors du jeu.

import { getDeviceId, getSavedName } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

export type InvitationRecue = {
  id: number;
  /** Le nom de celui qui invite, tel qu'il s'affiche. */
  de: string;
  /** Le code de la salle a rejoindre. */
  code: string;
  epreuve?: string | null;
  /** Ce qu'il reste a vivre. Une invitation en direct est perissable. */
  reste_ms: number;
};

/**
 * Invite des joueurs designes par leur nom au classement.
 *
 * Rend ceux qui ont ete joints et ceux qui sont injoignables — beaucoup de
 * joueurs figurent au classement sans avoir reserve leur nom, et ceux-la ne
 * sont joignables par personne. L'ecran doit pouvoir le dire plutot que de
 * laisser croire a un envoi qui n'a pas eu lieu.
 */
export async function inviterEnDirect(
  cibles: string[],
  code: string,
  epreuve?: string,
): Promise<{ invites: string[]; injoignables: string[] }> {
  try {
    const r = await fetch(`${API_BASE}/direct/inviter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: getDeviceId(), nom: getSavedName() || '',
        cibles, code, epreuve,
      }),
    });
    if (!r.ok) return { invites: [], injoignables: cibles };
    const d = await r.json();
    return { invites: d.invites || [], injoignables: d.injoignables || [] };
  } catch {
    // Le reseau a manque : rien n'est parti, et l'ecran doit le dire. Rendre
    // « tout invite » serait le pire des mensonges — on attendrait des gens
    // qui n'ont jamais rien recu.
    return { invites: [], injoignables: cibles };
  }
}

/** Les invitations qui m'attendent. Vide si rien, jamais une erreur. */
export async function mesInvitations(): Promise<InvitationRecue[]> {
  try {
    const r = await fetch(
      `${API_BASE}/direct/invitations?device_id=${encodeURIComponent(getDeviceId())}`);
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.invitations) ? d.invitations : [];
  } catch {
    return [];
  }
}

/**
 * J'ai tranche : cette invitation ne me sera plus proposee.
 *
 * A appeler qu'on accepte OU qu'on refuse. Le jeu sonde regulierement, et une
 * proposition qui reapparait sans fin est une proposition qu'on finit par
 * fermer sans la lire.
 */
export async function trancher(id: number): Promise<void> {
  try {
    await fetch(`${API_BASE}/direct/trancher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), id }),
    });
  } catch { /* elle expirera d'elle-meme dans dix minutes */ }
}
