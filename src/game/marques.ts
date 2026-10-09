// LE DUEL DES MARQUES — Team adidas contre Team Nike (09/10/2026).
//
// Une semaine. Chaque joueur choisit son camp une fois, puis court le 100 m
// comme d'habitude : chaque course terminee part au serveur avec sa trace, et
// le meilleur chrono de la semaine compte pour son camp. Les 32 plus rapides
// de chaque camp forment l'equipe ; la plus petite somme des 32 gagne. Une
// place vide compte une penalite (CHAISE_VIDE_MS cote serveur).
//
// Les regles vivent dans worker/src/marques.js ; ce module ne fait que
// demander, choisir et envoyer. Le drapeau d'ouverture est DUEL_MARQUES_OUVERT
// (canal.ts).
//
// Sprinter n'est lie ni a adidas ni a Nike : aucun logo, aucune couleur de
// marque, et la mention est a l'ecran.

import { getDeviceId, getSavedName } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

export const CAMPS = ['adidas', 'nike'] as const;
export type Camp = typeof CAMPS[number];
export const NOM_CAMP: Record<Camp, string> = { adidas: 'adidas', nike: 'Nike' };

export type CampTableau = {
  inscrits: number;
  coureurs: number;
  equipe: { name: string; ms: number }[];
  somme_ms: number;
  chaises_vides: number;
  total_ms: number;
  seuil_ms: number | null;
};

export type TableauMarques = {
  epreuve: string;
  taille: number;
  chaise_vide_ms: number;
  camps: Record<Camp, CampTableau>;
  tete: Camp | null;
  moi: { camp: Camp; best_ms: number | null; courses: number; rang: number | null; selectionne: boolean } | null;
  debut: number | null;
  fin: number | null;
};

/* ------------------------------------------------- le camp, garde ici aussi
   Le serveur fait foi ; la copie locale evite d'attendre le reseau pour
   savoir s'il faut envoyer une course. Elle est posee par le nom : changer de
   nom, c'est peut-etre changer de camp. */
const CLE = 'sprinter_duel_marques';

function campLocal(nom: string): Camp | null {
  try {
    const d = JSON.parse(localStorage.getItem(CLE) || '{}');
    const c = d[nom.trim().toLowerCase()];
    return (CAMPS as readonly string[]).includes(c) ? c : null;
  } catch { return null; }
}
function poserCampLocal(nom: string, camp: Camp) {
  try {
    const d = JSON.parse(localStorage.getItem(CLE) || '{}');
    d[nom.trim().toLowerCase()] = camp;
    localStorage.setItem(CLE, JSON.stringify(d));
  } catch { /* stockage refuse : le serveur garde le camp */ }
}
export function monCamp(): Camp | null {
  const nom = getSavedName();
  return nom ? campLocal(nom) : null;
}

/* ------------------------------------------------- qui ecoute un changement */
const ecouteurs = new Set<() => void>();
export function ecouterMarques(f: () => void) { ecouteurs.add(f); return () => { ecouteurs.delete(f); }; }
function prevenir() { for (const f of [...ecouteurs]) { try { f(); } catch { /* ecran parti */ } } }

export async function fetchMarques(): Promise<TableauMarques> {
  const nom = getSavedName();
  const r = await fetch(`${API_BASE}/marques${nom ? `?name=${encodeURIComponent(nom)}` : ''}`);
  if (!r.ok) throw new Error(`marques ${r.status}`);
  const t: TableauMarques = await r.json();
  // le serveur fait foi : un camp choisi sur un autre appareil arrive ici
  if (nom && t.moi) poserCampLocal(nom, t.moi.camp);
  return t;
}

export type ChoixRefuse = 'nom' | 'nom-reserve' | 'deja' | 'reseau';

/** Choisir son camp, definitivement. Rend le camp pose (celui du serveur si
 *  un autre avait deja ete choisi). */
export async function choisirCamp(camp: Camp): Promise<{ camp: Camp } | { refus: ChoixRefuse; camp?: Camp }> {
  const name = getSavedName();
  if (!name) return { refus: 'nom' };
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/marques/camp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name, camp }),
    });
  } catch { return { refus: 'reseau' }; }
  const d = await r.json().catch(() => ({}));
  if (r.status === 403) return { refus: 'nom-reserve' };
  if (r.status === 409 && d.camp) { poserCampLocal(name, d.camp); prevenir(); return { refus: 'deja', camp: d.camp }; }
  if (r.status === 409) return { refus: 'nom' };
  if (!r.ok) return { refus: 'reseau' };
  poserCampLocal(name, camp);
  prevenir();
  return { camp };
}

/**
 * Une course de 100 m vient de finir (engine.ts, onRaceRecorded). Elle part
 * si le joueur a un camp ; sinon rien — choisir son camp ne se fait pas dans
 * le dos du joueur. Jamais bloquant, jamais une erreur a l'ecran.
 */
export async function envoyerCourse(secondes: number, trace: number[], contexte: string) {
  const name = getSavedName();
  if (!name || !campLocal(name) || !trace.length) return;
  try {
    const r = await fetch(`${API_BASE}/marques/course`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: getDeviceId(), name, time_ms: Math.round(secondes * 1000), trace, contexte,
      }),
    });
    if (r.ok) prevenir();
  } catch { /* hors ligne : la course compte pour le joueur, pas pour le camp */ }
}

/** 10 240 ms → « 10,24 ». */
export const secondes = (ms: number) => (ms / 1000).toFixed(2).replace('.', ',');
/** Une somme de 32 chronos : « 5 min 40,24 s ». */
export function somme(ms: number, fr = true): string {
  const s = ms / 1000, m = Math.floor(s / 60), r = s - m * 60;
  const reste = r.toFixed(2).padStart(5, '0');
  return m ? `${m} min ${fr ? reste.replace('.', ',') : reste} s` : `${fr ? reste.replace('.', ',') : reste} s`;
}
