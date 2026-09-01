// Signaler, bloquer — cote jeu.
//
// Le pendant de `worker/src/moderation.js`, ou vivent les regles. Ici on ne
// fait que les appeler, et retenir localement ce qui a deja ete signale : le
// serveur refuse le doublon, mais un bouton qui redevient cliquable apres coup
// donne l'impression que rien n'a ete envoye.
//
// LE SIGNALEMENT SE FAIT DANS LA FENETRE DE LECTURE, et pas apres. La voix est
// effacee du serveur des que le perdant referme son annonce ; le signalement
// copie le contenu au moment ou il part. Une seconde plus tard, il n'y aurait
// plus rien a montrer a qui doit le relire.

import { getSavedName, getDeviceId } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

/** Les motifs, dans le meme ordre que la liste fermee du serveur. */
export const MOTIFS = ['insulte', 'haine', 'sexuel', 'menace', 'autre'] as const;
export type Motif = typeof MOTIFS[number];

const CLE_SIGNALES = 'sprinter_signales';
const CLE_BLOQUES = 'sprinter_bloques';

function lire(cle: string): string[] {
  try { return JSON.parse(localStorage.getItem(cle) || '[]'); } catch { return []; }
}
function ecrire(cle: string, v: string[]) {
  try { localStorage.setItem(cle, JSON.stringify(v.slice(-200))); } catch { /* refuse */ }
}

/** Ce duel a-t-il deja ete signale depuis cet appareil ? */
export function dejaSignale(duel: string): boolean {
  return lire(CLE_SIGNALES).includes(duel);
}

/**
 * Signale le mot recu sur ce duel.
 *
 * On note le duel comme signale meme si le reseau a echoue : le joueur a fait
 * son geste, et lui redemander de le refaire sans savoir si le premier est
 * passe est le meilleur moyen d'en avoir deux. Le serveur deduplique de son
 * cote — c'est lui qui tranche, pas ce fichier.
 */
export async function signaler(duel: string, motif: Motif): Promise<boolean> {
  const vus = lire(CLE_SIGNALES);
  if (!vus.includes(duel)) ecrire(CLE_SIGNALES, [...vus, duel]);
  try {
    const r = await fetch(`${API_BASE}/moderation/signaler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        duel, motif,
        name: getSavedName() || '',
        device_id: getDeviceId(),
      }),
    });
    return r.ok;
  } catch { return false; }
}

/** Les noms bloques depuis cet appareil, tels qu'on les connait ici. */
export function bloquesLocaux(): string[] { return lire(CLE_BLOQUES); }

export function estBloque(nom: string): boolean {
  return lire(CLE_BLOQUES).includes(String(nom || '').trim().toLowerCase());
}

/**
 * Bloque quelqu'un.
 *
 * On l'inscrit ICI AUSSI, et pas seulement sur le serveur : le blocage doit se
 * voir dans la seconde, sans attendre le prochain chargement des resultats. Le
 * serveur, lui, est ce qui le rend vrai sur les autres appareils du joueur.
 */
export async function bloquer(nom: string): Promise<boolean> {
  const cle = String(nom || '').trim().toLowerCase();
  if (!cle) return false;
  const l = lire(CLE_BLOQUES);
  if (!l.includes(cle)) ecrire(CLE_BLOQUES, [...l, cle]);
  try {
    const r = await fetch(`${API_BASE}/moderation/bloquer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: getSavedName() || '', cible: cle }),
    });
    return r.ok;
  } catch { return false; }
}

export async function debloquer(nom: string): Promise<boolean> {
  const cle = String(nom || '').trim().toLowerCase();
  ecrire(CLE_BLOQUES, lire(CLE_BLOQUES).filter(n => n !== cle));
  try {
    const r = await fetch(`${API_BASE}/moderation/debloquer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: getSavedName() || '', cible: cle }),
    });
    return r.ok;
  } catch { return false; }
}
