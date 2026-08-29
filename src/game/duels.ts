// Classement des duels — distinct du TOP 500.
//
// Le TOP 500 recompense la vitesse pure ; celui-ci recompense l'engagement.
// Tous les duels comptent, lances comme releves.
//
// Deux couches, et le jeu n'en voit qu'une. Le serveur tient un nombre cache
// qui estime la force de chacun ; il ne sort jamais d'ici, et ce module n'a
// aucun moyen de le lire. Ce qui arrive est ce qui se montre : un etage, une
// division, et des points de ligue. Le bareme depend du role — relever un defi
// dont le chrono est deja pose rapporte plus que le lancer.

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

/** Les etages de l'echelle, du premier au dernier. */
export type Etage = 'departemental' | 'regional' | 'national' | 'elite' | 'legende';

export type Echelle = {
  etages: Etage[];
  divisions: number;
  legende: number;
  lp_par_palier: number;
};

export type DuelRow = {
  name: string;
  // Pas de MMR : le serveur ne le publie pas. Il estime la force et ordonne
  // les egalites parfaites, sans jamais s'afficher — voir duelBoard cote
  // worker. Ce qui suit est toute la couche visible.
  /** Le palier absolu, de 0 au sommet. Sert a comparer et a ordonner. */
  palier: number;
  etage: Etage;
  /** IV a I, et zero en Legende, qui n'a pas de division. */
  division: number;
  lp: number;
  wins: number;
  losses: number;
  draws: number;
  launched: number;
  received: number;
  last_delta: number;
  rank: number;
  /** Places gagnees depuis la derniere consultation. Positif = montee. */
  move?: number;
  /** Code du pays, tel que vu ou choisi. */
  pays?: string | null;
  /** La medaille la plus prestigieuse encore portee, s'il y en a une. */
  medaille?: {
    echelon: 'national' | 'continental' | 'mondial';
    zone: string; zoneNom: string; place: number;
  } | null;
};

/** Issue d'un duel telle que le serveur la tranche, du point de vue de
 *  celui qui releve le defi : 'opponent', c'est lui ; 'challenger', l'autre. */
export type DuelIssue = {
  issue: 'opponent' | 'challenger' | 'draw';
  /** Role du joueur local dans ce duel. */
  role?: 'opponent' | 'challenger';
  /** Points de ligue gagnes par celui qui releve le defi. */
  lp?: number;
  lp_adverse?: number;
  /** Le rang atteint apres ce duel, de chaque cote. */
  rang?: { palier: number; etage: Etage; division: number };
  rang_adverse?: { palier: number; etage: Etage; division: number };
  monte?: boolean;
  descend?: boolean;
  /** Duel deja tranche a une tentative precedente : rien n'a bouge. */
  deja?: boolean;
};

/** Un bareme pour un role. */
export type DuelBareme = { victoire: number; defaite: number; nul: number };

export type DuelBoard = {
  echelle: Echelle;
  bareme: { lanceur: DuelBareme; releveur: DuelBareme };
  classement: DuelRow[];
  moi: DuelRow | null;
};

// On ne retient que le rang : les points ne viennent plus du serveur.
type Vu = Record<string, { rank: number }>;

function lireVu(): Vu {
  try { return JSON.parse(localStorage.getItem(VU_KEY) || '{}'); } catch { return {}; }
}
function ecrireVu(rows: DuelRow[]) {
  try {
    const v: Vu = {};
    for (const r of rows) v[r.name.trim().toLowerCase()] = { rank: r.rank };
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
    }
    if (data.moi) {
      const a = vu[data.moi.name.trim().toLowerCase()];
      data.moi.move = a ? a.rank - data.moi.rank : 0;
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
  /** Ce que ce duel m'a rapporte, tel qu'inscrit au moment ou il s'est joue. */
  lp: number;
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
