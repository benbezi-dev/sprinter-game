// Classement des duels — distinct du TOP 500.
//
// Le TOP 500 recompense la vitesse pure ; celui-ci recompense l'engagement.
// Tous les duels comptent, lances comme releves, et le bareme depend du role :
// lancer un defi expose son chrono le premier, donc +1 / -2 ; le relever se
// paie +2 / -1. La somme reste nulle a chaque duel.

import { getDeviceId, getSavedName } from './leaderboard';
import { EST_TEST } from './canal';

/**
 * Portes des duels. A false, les trois entrees disparaissent — accueil, fin de
 * course, et l'annonce du resultat a celui qui a lance le defi — sans autre
 * changement : le code reste livre, seul l'acces bascule.
 */
// Ferme en production jusqu'a l'ouverture annoncee ; toujours ouvert sur le
// canal de test, qui existe pour essayer ce qui n'est pas encore sorti.
const OUVERT_EN_PRODUCTION = false;
export const DUELS_OUVERTS = EST_TEST || OUVERT_EN_PRODUCTION;

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const VU_KEY = 'sprinter_duels_vus';

export type DuelRow = {
  name: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  launched: number;
  received: number;
  last_delta: number;
  rank: number;
  /** Places gagnees depuis la derniere consultation. Positif = montee. */
  move?: number;
  /** Points gagnes depuis la derniere consultation. */
  gain?: number;
};

/** Issue d'un duel telle que le serveur la tranche, du point de vue de
 *  celui qui releve le defi : 'opponent', c'est lui ; 'challenger', l'autre. */
export type DuelIssue = {
  issue: 'opponent' | 'challenger' | 'draw';
  /** Role du joueur local dans ce duel. */
  role?: 'opponent' | 'challenger';
  /** Points attribues au joueur qui releve le defi. */
  points?: number;
  points_adverse?: number;
  /** Duel deja tranche a une tentative precedente : rien n'a bouge. */
  deja?: boolean;
};

/** Un bareme pour un role. */
export type DuelBareme = { victoire: number; defaite: number; nul: number };

export type DuelBoard = {
  bareme: { initie: DuelBareme; recu: DuelBareme };
  classement: DuelRow[];
  moi: DuelRow | null;
};

type Vu = Record<string, { rank: number; points: number }>;

function lireVu(): Vu {
  try { return JSON.parse(localStorage.getItem(VU_KEY) || '{}'); } catch { return {}; }
}
function ecrireVu(rows: DuelRow[]) {
  try {
    const v: Vu = {};
    for (const r of rows) v[r.name.trim().toLowerCase()] = { rank: r.rank, points: r.points };
    localStorage.setItem(VU_KEY, JSON.stringify(v));
  } catch { /* sans memoire : pas de fleches, le classement reste juste */ }
}

/**
 * Le mouvement se mesure depuis la derniere fois que CE joueur a regarde le
 * classement. Un rang fige cote serveur ne survivrait pas au duel suivant et
 * l'indicateur serait vide la plupart du temps ; ainsi il raconte toujours
 * quelque chose : « voila ce qui a change depuis ton dernier passage ».
 */
export async function fetchDuels(marquerVu = true): Promise<DuelBoard | null> {
  try {
    const nom = encodeURIComponent(getSavedName() || '');
    const res = await fetch(`${API_BASE}/duels?name=${nom}`);
    if (!res.ok) return null;
    const data: DuelBoard = await res.json();
    const vu = lireVu();
    for (const r of data.classement) {
      const avant = vu[r.name.trim().toLowerCase()];
      r.move = avant ? avant.rank - r.rank : 0;
      r.gain = avant ? r.points - avant.points : 0;
    }
    if (data.moi) {
      const a = vu[data.moi.name.trim().toLowerCase()];
      data.moi.move = a ? a.rank - data.moi.rank : 0;
      data.moi.gain = a ? data.moi.points - a.points : 0;
    }
    if (marquerVu) ecrireVu(data.classement);
    return data;
  } catch {
    return null;
  }
}

/**
 * Resultat d'un defi que J'AI lance, tel que je l'apprends en revenant.
 * `issue` est vue du serveur : 'challenger' veut dire que c'est moi, le
 * lanceur, qui l'emporte.
 */
export type MonDuel = {
  id: string;
  adversaire: string;
  issue: 'challenger' | 'opponent' | 'draw';
  points: number;
  mon_ms: number;
  son_ms: number;
  races: string[];
  at: number;
};

/**
 * Les resultats en attente d'etre annonces.
 *
 * Celui qui releve un defi voit son duel se trancher a l'arrivee. Celui qui
 * l'a lance, lui, avait deja range son telephone : sans ce guichet il verrait
 * seulement sa ligne bouger au classement, sans savoir qui lui a repondu ni
 * de combien.
 */
export async function fetchMesDuels(): Promise<MonDuel[]> {
  try {
    const q = `device_id=${encodeURIComponent(getDeviceId())}` +
              `&name=${encodeURIComponent(getSavedName() || '')}`;
    const res = await fetch(`${API_BASE}/duel/results?${q}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

/** Un resultat ne s'annonce qu'une fois. */
export async function marquerDuelsVus(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    await fetch(`${API_BASE}/duel/results/seen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: getDeviceId(),
        name: getSavedName() || '',
        ids,
      }),
    });
  } catch {
    // reseau muet : le resultat sera reannonce au prochain passage, ce qui
    // vaut mieux que de le perdre.
  }
}
