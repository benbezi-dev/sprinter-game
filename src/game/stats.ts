// Tableau de bord : frequentation et participation.
//
// Deux sources, volontairement independantes. Les participants se deduisent du
// classement, qui existe deja : ce volet fonctionne sans rien deployer. Les
// visites, elles, demandent un compteur cote serveur — tant que le Worker
// n'est pas redeploye, /stats repond 404 et le tableau le dit au lieu
// d'inventer des chiffres.

import { getDeviceId, fetchLeaderboardRaw, rankByRaceTime, type RaceKey } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const RACES: RaceKey[] = ['100', '200', '400'];
const VISIT_KEY = 'sprinter_visit_ping';

type Jour = { day: string; n?: number; hits?: number; visiteurs?: number };

export type ServerStats = {
  visites: {
    total: number; visiteurs: number;
    par_jour: { day: string; visiteurs: number; hits: number }[];
    reviennent?: number;
  };
  scores: { lignes?: number; appareils?: number; joueurs?: number };
  defis: {
    defis?: number; tentatives?: number;
    adresses?: number; publics?: number; repondus?: number;
    par_jour?: Jour[]; tentatives_par_jour?: Jour[];
    delai_reponse_median_ms?: number | null;
  };
  // Blocs ajoutes par le Worker enrichi. Absents tant qu'il n'est pas deploye —
  // d'ou l'optionnalite : le tableau les masque plutot que de planter.
  parties?: {
    total: number; joueurs: number;
    par_mode: { campaign: number; oneshot: number };
    par_jour: (Jour & { joueurs?: number; campagne?: number; oneshot?: number })[];
    par_epreuve: { race_key: string; n: number }[];
    progression: { level_idx: number; n: number }[];
    actifs: { j1: number; j7: number; j30: number };
    heure_jour: { jour: number; heure: number; n: number }[];
    top_joueurs: { name: string; n: number; dernier: number }[];
    borne: number;
  } | null;
  reprises?: { total: number; appareils: number; par_jour: Jour[] };
  duels?: {
    joues: number;
    issues: { lanceur: number; releveur: number; nul: number };
    par_jour: Jour[];
    lances: number; releves: number; inscrits: number; joueurs_classes: number;
    paliers: { palier: number; n: number }[];
  } | null;
  joueurs?: {
    nommes: number; avec_insta: number;
    par_jour: Jour[]; multi_appareils: number;
  } | null;
  geo?: { pays: string; n: number }[] | null;
  relais?: { equipes: number; courses: number } | null;
  championnats?: { editions: number; titres: number } | null;
  releve_a?: number;
};

/* ------------------------------------------------- la cle du tableau de bord

   `/stats` ne repond plus a personne sans cle. Ce qui suit range celle de ce
   navigateur et la presente a chaque appel.

   La cle n'est pas verifiee a part : on la presente a `/stats`, et la reponse
   fait foi. Une route de verification separee serait une seconde porte a tenir
   d'accord avec la premiere, et un endroit de plus ou se tromper — alors que la
   seule question qui compte est « cette cle ouvre-t-elle le tableau ? », a
   laquelle le tableau lui-meme repond en s'affichant ou non.

   Ce n'est pas la cle d'administration : celle-la refait les classements. */

const CLE_TABLEAU = 'sprinter_cle_tableau';

export function cleTableau(): string {
  try { return localStorage.getItem(CLE_TABLEAU) || ''; } catch { return ''; }
}

export function poserCleTableau(cle: string) {
  try { localStorage.setItem(CLE_TABLEAU, cle.trim()); } catch { /* refuse */ }
}

export function oublierCleTableau() {
  try { localStorage.removeItem(CLE_TABLEAU); } catch { /* refuse */ }
}

/**
 * Ce que rend une tentative de lecture du tableau.
 *
 * Trois issues, et les distinguer est tout l'interet : sans cle valide le
 * serveur repond 404 — la route n'existe pas pour qui n'a pas la cle — et une
 * panne de reseau ne doit pas se lire « cle refusee », sans quoi on efface une
 * cle parfaitement bonne parce que le wifi a hoquete.
 */
export type LectureStats =
  | { etat: 'ok'; stats: ServerStats }
  | { etat: 'refuse' }
  | { etat: 'panne' };

/**
 * Signale un passage, une fois par session. On ne veut pas compter chaque
 * changement d'ecran : ce serait du bruit, pas de la frequentation.
 */
export function pingVisit() {
  try {
    if (sessionStorage.getItem(VISIT_KEY)) return;
    sessionStorage.setItem(VISIT_KEY, '1');
  } catch {
    // sessionStorage indisponible : on signale quand meme, une fois de trop
    // vaut mieux qu'un trou dans le comptage
  }
  fetch(`${API_BASE}/visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: getDeviceId() }),
    keepalive: true,
  }).catch(() => { /* compteur pas encore deploye : sans consequence */ });
}

/**
 * Lit le tableau de bord, avec la cle rangee dans ce navigateur.
 *
 * `cle` permet d'essayer une cle qu'on vient de saisir sans la ranger d'abord :
 * on ne garde que celle qui a ouvert.
 */
export async function lireServerStats(cle?: string): Promise<LectureStats> {
  const c = (cle ?? cleTableau()).trim();
  // Sans cle, inutile de deranger le serveur : la reponse est connue.
  if (!c) return { etat: 'refuse' };
  try {
    const res = await fetch(`${API_BASE}/stats`, { headers: { 'X-Sprinter-Tableau': c } });
    // 404 : la route se cache de qui n'a pas la cle. 401/403 : un Worker plus
    // ancien, ou une autre porte. Tout cela veut dire « pas pour toi ».
    if (res.status === 404 || res.status === 401 || res.status === 403) return { etat: 'refuse' };
    if (!res.ok) return { etat: 'panne' };
    return { etat: 'ok', stats: await res.json() };
  } catch {
    // Reseau coupe. Surtout ne pas conclure que la cle est mauvaise : on
    // effacerait une cle valide sur un simple hoquet de connexion.
    return { etat: 'panne' };
  }
}

export type RaceStats = {
  race: RaceKey;
  classes: number;
  meilleur: number | null;
  meilleurNom: string;
  actifs7j: number;
};

export type BoardStats = {
  parEpreuve: RaceStats[];
  joueurs: string[];        // noms distincts, toutes epreuves confondues
  lignes: number;
  actifs24h: number;
  actifs7j: number;
  actifs30j: number;
};

/** Participation, deduite du classement. Aucun deploiement necessaire. */
export async function fetchBoardStats(): Promise<BoardStats> {
  const jour = 86400000;
  const now = Date.now();
  const noms = new Set<string>();
  const parEpreuve: RaceStats[] = [];
  let lignes = 0, a24 = 0, a7 = 0, a30 = 0;

  for (const race of RACES) {
    let liste: ReturnType<typeof rankByRaceTime> = [];
    try { liste = rankByRaceTime(await fetchLeaderboardRaw(race)); } catch { /* epreuve muette */ }
    let actifs7 = 0;
    for (const e of liste) {
      lignes++;
      const k = String(e.name || '').trim().toLowerCase();
      if (k) noms.add(k);
      const age = now - (e.updated_at || 0);
      if (age < jour) a24++;
      if (age < 7 * jour) { a7++; actifs7++; }
      if (age < 30 * jour) a30++;
    }
    parEpreuve.push({
      race,
      classes: liste.length,
      meilleur: liste.length ? liste[0].best_split_ms : null,
      meilleurNom: liste.length ? liste[0].name : '',
      actifs7j: actifs7,
    });
  }
  return { parEpreuve, joueurs: [...noms], lignes, actifs24h: a24, actifs7j: a7, actifs30j: a30 };
}

/** Le tableau de bord est-il demande dans l'URL ? */
export function dashboardRequested(): boolean {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.has('stats') || p.has('tableau');
  } catch {
    return false;
  }
}
