// LE DUEL DES MARQUES — Team adidas contre Team Nike (09/10/2026).
//
// Une semaine. Chaque joueur choisit son camp et son epreuve (100, 200 ou
// 400 m) une fois, puis la court comme d'habitude : chaque course terminee
// part au serveur avec sa trace, et le meilleur chrono de la semaine compte
// pour son camp. Sur chaque epreuve, les deux camps comptent le meme nombre
// de coureurs ; 32 places au plus ; la plus petite somme gagne.
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
export const EPREUVES = ['100', '200', '400'] as const;
export type Epreuve = typeof EPREUVES[number];

export type CampEpreuve = {
  inscrits: number;
  /** Ses coureurs, du plus rapide au plus lent ; les `places` premiers comptent. */
  coureurs: { name: string; ms: number }[];
  somme_ms: number;
};

export type TableauMarques = {
  taille: number;
  plafonds: Record<Epreuve, number>;
  places_total: number;
  epreuves: Record<Epreuve, { places: number; camps: Record<Camp, CampEpreuve> }>;
  totaux: Record<Camp, number>;
  inscrits: Record<Camp, number>;
  tete: Camp | null;
  moi: {
    camp: Camp; epreuve: Epreuve; best_ms: number | null; rang: number | null;
    selectionne: boolean; seuil_ms: number | null; attend_adversaire: boolean;
  } | null;
  debut: number | null;
  fin: number | null;
};

/** Les places de chaque epreuve, calculees comme le serveur (worker/src/
 *  marques.js, `places`) : le plus petit des deux effectifs, puis une place de
 *  moins a l'epreuve qui en a le plus — le 100 m d'abord a egalite — tant que
 *  le total depasse la taille d'equipe. */
function placesPour(eff: Record<Camp, Record<Epreuve, number>>, taille: number): Record<Epreuve, number> {
  const n = Object.fromEntries(EPREUVES.map(e => [e, Math.min(...CAMPS.map(c => eff[c][e]))])) as Record<Epreuve, number>;
  let total = EPREUVES.reduce((x, e) => x + n[e], 0);
  while (total > taille) {
    const e = EPREUVES.reduce((m, x) => (n[x] > n[m] ? x : m));
    n[e]--; total--;
  }
  return n;
}

/**
 * Une course de plus de ce camp sur cette epreuve y ouvrirait-elle une place ?
 * C'est le cas quand l'autre camp y a plus de coureurs ET que le plafond ne la
 * reprend pas aussitot. Rend le nombre de places qui s'ouvriraient ainsi l'une
 * apres l'autre (0 = il faut battre un chrono pour compter).
 */
export function manque(t: TableauMarques, camp: Camp, e: Epreuve): number {
  const eff = Object.fromEntries(CAMPS.map(c => [c,
    Object.fromEntries(EPREUVES.map(x => [x, t.epreuves[x].camps[c].coureurs.length]))])) as Record<Camp, Record<Epreuve, number>>;
  const avant = placesPour(eff, t.taille)[e];
  let ouvertes = 0;
  while (ouvertes < t.taille) {
    eff[camp][e]++;
    if (placesPour(eff, t.taille)[e] <= avant + ouvertes) break;
    ouvertes++;
  }
  return ouvertes;
}

/* ------------------------------------------------- le camp, garde ici aussi
   Le serveur fait foi ; la copie locale evite d'attendre le reseau pour
   savoir s'il faut envoyer une course. Elle est posee par le nom : changer de
   nom, c'est peut-etre changer de camp. (`v2` : la premiere version ne
   gardait que le camp, sans l'epreuve.) */
const CLE = 'sprinter_duel_marques_v2';
export type Inscription = { camp: Camp; epreuve: Epreuve };

function inscriptionLocale(nom: string): Inscription | null {
  try {
    const d = JSON.parse(localStorage.getItem(CLE) || '{}');
    const i = d[nom.trim().toLowerCase()];
    return i && (CAMPS as readonly string[]).includes(i.camp) && (EPREUVES as readonly string[]).includes(i.epreuve)
      ? i : null;
  } catch { return null; }
}
function poserInscriptionLocale(nom: string, i: Inscription) {
  try {
    const d = JSON.parse(localStorage.getItem(CLE) || '{}');
    d[nom.trim().toLowerCase()] = { camp: i.camp, epreuve: i.epreuve };
    localStorage.setItem(CLE, JSON.stringify(d));
  } catch { /* stockage refuse : le serveur garde l'inscription */ }
}
export function monInscription(): Inscription | null {
  const nom = getSavedName();
  return nom ? inscriptionLocale(nom) : null;
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
  if (nom && t.moi) poserInscriptionLocale(nom, t.moi);
  return t;
}

export type ChoixRefuse = 'nom' | 'nom-reserve' | 'deja' | 'reseau';

/** Choisir son camp et son epreuve, definitivement. */
export async function choisirCamp(camp: Camp, epreuve: Epreuve): Promise<Inscription | { refus: ChoixRefuse }> {
  const name = getSavedName();
  if (!name) return { refus: 'nom' };
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/marques/camp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name, camp, epreuve }),
    });
  } catch { return { refus: 'reseau' }; }
  const d = await r.json().catch(() => ({}));
  if (r.status === 403) return { refus: 'nom-reserve' };
  if (r.status === 409 && d.camp) {
    poserInscriptionLocale(name, { camp: d.camp, epreuve: d.epreuve });
    prevenir();
    return { refus: 'deja' };
  }
  if (r.status === 409) return { refus: 'nom' };
  if (!r.ok) return { refus: 'reseau' };
  poserInscriptionLocale(name, { camp, epreuve });
  prevenir();
  return { camp, epreuve };
}

/**
 * Une course vient de finir (engine.ts, onRaceRecorded). Elle part si c'est
 * l'epreuve choisie ; sinon rien — s'inscrire ne se fait pas dans le dos du
 * joueur. Jamais bloquant, jamais une erreur a l'ecran.
 */
export async function envoyerCourse(race: string, tempsS: number, trace: number[], contexte: string) {
  const name = getSavedName();
  const ins = name ? inscriptionLocale(name) : null;
  if (!ins || ins.epreuve !== race || !trace.length) return;
  try {
    const r = await fetch(`${API_BASE}/marques/course`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: getDeviceId(), name, race_key: race, time_ms: Math.round(tempsS * 1000), trace, contexte,
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
