// Les championnats, vus du jeu.
//
// Le serveur tient les regles : qui participe, qui passe, quand. Ce fichier ne
// fait que demander et transmettre — aucune regle de qualification n'est
// recopiee ici, sous peine qu'un jour les deux ne disent plus la meme chose.
//
// Le fil d'annonces merite un mot. Il se lit par curseur et non par date : on
// demande « la suite apres 412 » plutot que « depuis telle heure ». Un ecran
// qui reste ouvert tout un weekend recoit alors exactement ce qu'il n'a pas
// encore vu, sans trou ni doublon, meme si deux annonces tombent dans la meme
// milliseconde et meme si le telephone s'est endormi entre-temps.

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

export type Partant = {
  name_key: string;
  nom: string;
  rang_duel: number | null;
  phase: string;
  course: number | null;
  /** Phase ou il a ete elimine, ou null s'il court encore. */
  sorti_en: string | null;
};

export type Resultat = {
  phase: string; course: number; name_key: string;
  ms: number | null; place: number | null;
};

export type PhaseInfo = { cle: string; nom: string; courses: number };

export type RendezVous = {
  cle: string; phase: string; course?: number; minute: number; at: number;
  reveal?: boolean; ceremonie?: boolean;
};

export type Edition = {
  id: string;
  echelon: 'national' | 'continental' | 'mondial';
  zone: string;
  zoneNom: string;
  /** « Championnat national de France », deja accorde. */
  titre: string;
  debut: number;
  phase: string;
  phaseNom: string;
  phaseIndex: number;
  phases: PhaseInfo[];
  etat: 'ouverte' | 'terminee';
  courses: number;
  parCourse: number;
  directsParCourse: number;
  repechages: number;
  champion: string | null;
  partants: Partant[];
  resultats: Resultat[];
  calendrier: RendezVous[];
};

export type Annonce = {
  id: number;
  edition: string | null;
  echelon: string;
  zone: string;
  zoneNom: string;
  type: string;
  titre: string;
  texte: string | null;
  donnees: any;
  au: number;
  pousser: boolean;
};

export type Sacre = {
  edition: string; echelon: string; zone: string; zoneNom: string;
  champion: string; fini_le: number;
};

export type Monde = {
  encours: { edition: string; echelon: string; zone: string; zoneNom: string; phase: string }[];
  sacres: Sacre[];
  total: number;
  termines: number;
};

async function json<T>(chemin: string): Promise<T | null> {
  try {
    const r = await fetch(API_BASE + chemin);
    if (!r.ok) return null;
    return await r.json() as T;
  } catch {
    return null;
  }
}

/** Le championnat ou ce joueur est engage, s'il y en a un. */
export const monEdition = (nom: string) =>
  json<{ edition: string | null }>('/champ/mien?name=' + encodeURIComponent(nom));

export const etatEdition = (id: string) =>
  json<Edition>('/champ/edition/' + encodeURIComponent(id));

export const recapMondial = (echelon?: string) =>
  json<Monde>('/champ/monde' + (echelon ? '?echelon=' + echelon : ''));

/** La suite du fil apres `depuis`. Renvoie aussi le curseur a garder. */
export const fluxDirect = (depuis = 0, zone?: string) =>
  json<{ annonces: Annonce[]; curseur: number }>(
    `/champ/direct?depuis=${depuis}` + (zone ? `&zone=${encodeURIComponent(zone)}` : ''));

/** Le prochain rendez-vous du calendrier, a partir de maintenant. */
export function prochain(cal: RendezVous[], maintenant = Date.now()) {
  return cal.find(r => r.at > maintenant) || null;
}

/**
 * Qui court dans quelle course, pour la phase en cours.
 *
 * Un partant porte le numero de sa course tant qu'il n'est pas sorti ; les
 * elimines gardent la phase ou ils se sont arretes. On ne montre donc que ceux
 * dont la phase est celle du moment.
 */
export function grille(e: Edition): { course: number; couloirs: Partant[] }[] {
  const par = new Map<number, Partant[]>();
  for (const p of e.partants) {
    if (p.phase !== e.phase || p.course == null) continue;
    if (!par.has(p.course)) par.set(p.course, []);
    par.get(p.course)!.push(p);
  }
  return [...par.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([course, couloirs]) => ({
      course,
      // Le mieux classe au duel prend le couloir du milieu, comme sur une
      // vraie piste : les couloirs 4 et 5 sont les plus favorables.
      couloirs: couloirs.sort((x, y) => (x.rang_duel || 99) - (y.rang_duel || 99)),
    }));
}

/** L'arrivee d'une course, si elle a eu lieu. */
export function arrivee(e: Edition, phase: string, course: number) {
  const noms = new Map(e.partants.map(p => [p.name_key, p.nom]));
  return e.resultats
    .filter(r => r.phase === phase && r.course === course)
    .map(r => ({ ...r, nom: noms.get(r.name_key) || r.name_key }))
    .sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity));
}
