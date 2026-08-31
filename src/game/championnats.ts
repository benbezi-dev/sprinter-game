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
  /** Code du pays : un continental ou un mondial n'a aucun sens sans lui. */
  pays?: string | null;
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

/** Ce qu'une zone donnerait si on l'ouvrait maintenant. */
export type Prevision = {
  echelon: 'national' | 'continental' | 'mondial';
  zone: string;
  zoneNom: string;
  /** Joueurs classes et actifs de la zone (national), ou medailles (au-dessus). */
  joueurs: number;
  partants?: number;
  requis?: number;
  ouvrable: boolean;
  raison?: string | null;
  /** Moins de 32 partants : format reduit, et c'est la premiere edition. */
  reduit?: boolean;
  premiere?: boolean;
  courses?: number;
  finale?: number;
  zones?: number;
  tete?: string[];
  /** Edition deja ouverte pour cette zone, s'il y en a une. */
  edition?: string | null;
  phase?: string | null;
};

export type Salon = {
  maintenant: number;
  nations: Prevision[];
  continents: Prevision[];
  monde: Prevision;
  ouvrables: number;
  enCours: {
    edition: string; echelon: string; zone: string; zoneNom: string;
    phase: string; debut: number;
  }[];
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
  /** L'effectif prevu par le format fige a l'ouverture. */
  partantsAttendus?: number;
  /** Vrai si cette edition ne court pas le format nominal a 32. */
  reduit?: boolean;
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

/**
 * Un appel qui ecrit. Le corps d'erreur est rendu tel quel plutot qu'avale :
 * le salon a besoin de dire POURQUOI une zone refuse de s'ouvrir, et le
 * serveur le sait — « pays trop petit », « edition deja ouverte », « reserve
 * aux organisateurs » sont trois refus qui ne se corrigent pas pareil.
 */
async function poster<T>(chemin: string, corps: any): Promise<T & { error?: string }> {
  try {
    const r = await fetch(API_BASE + chemin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok && !d.error) return { ...d, error: 'HTTP ' + r.status } as any;
    return d as any;
  } catch {
    return { error: 'reseau' } as any;
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

/* ------------------------------------------------------- le salon organisateur

   Toutes ces routes existent deja cote serveur et sont gardees par le role
   d'organisateur : ce qui suit ne fait que les appeler. Le client ne decide de
   rien — il demande, et le serveur refuse ou fait. */

/** L'etat du monde : effectifs par nation, par continent, et pour le monde. */
export const previsionSalon = () => json<Salon>('/champ/salon');

export const ouvrirCycle = (debut: number, echelon = 'national') =>
  poster<{ ouvertes: any[]; ecartes: any[] }>('/champ/cycle', { debut, echelon });

export const ouvrirZone = (echelon: string, zone: string, debut: number) =>
  poster<{ edition: string; partants: number; reduit: boolean }>(
    '/champ/ouvrir', { echelon, zone, debut });

export const cloturerPhase = (edition: string) =>
  poster<{ phase: string; suivante?: string; finale?: boolean; champion?: string }>(
    '/champ/cloturer', { edition });

/**
 * La saisie manuelle d'une course. Le filet de securite, et rien d'autre.
 *
 * Les chronos arrivent normalement de la salle en direct, qui les a arbitres.
 * Mais un partant absent bloque la cloture de sa phase, et il faut alors
 * pouvoir poser un chrono — ou un abandon — a la main plutot que d'abandonner
 * l'edition entiere.
 */
export const saisirCourse = (
  edition: string, phase: string, course: number,
  chronos: { cle: string; ms: number | null }[],
) => poster<{ ok: boolean; enregistres: number }>(
  '/champ/course', { edition, phase, course, chronos });

/**
 * Le code de salon d'une course de championnat.
 *
 * Miroir exact de `codeCourseChamp` cote serveur (worker/src/championnats.js).
 * Recopie plutot que demandee : huit joueurs doivent tomber sur la meme salle
 * sans qu'aucun aller-retour ne le leur dise, et un calcul de deux lignes qui
 * ne depend que de donnees deja connues ne merite pas une route.
 *
 * Les deux implementations doivent rester identiques ; c'est le seul endroit du
 * client ou une regle du serveur est recopiee, et direct-champ-test.mjs verifie
 * qu'elles disent la meme chose.
 */
export function codeCourseChamp(edition: string, phase: string, course: number): string {
  const lettre = (phase || 'X').slice(0, 1).toUpperCase();
  const n = Math.max(1, Math.min(9, Math.floor(course) || 1));
  return (lettre + n + (edition || ''))
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

/**
 * Ma course dans cette edition, et son rendez-vous.
 *
 * Un joueur ne connait de son championnat que son propre nom : c'est a partir
 * de lui qu'on retrouve la course ou il est engage, puis le creneau de cette
 * course dans le calendrier. Rien n'est renvoye s'il est deja sorti — un
 * elimine n'a pas de prochaine course, et lui en proposer une serait cruel.
 */
export function maCourse(e: Edition, nameKey: string): {
  phase: string; phaseNom: string; course: number; partants: Partant[];
  code: string; at: number | null; couru: boolean;
} | null {
  const cle = (nameKey || '').trim().toLowerCase();
  const moi = e.partants.find(p => p.name_key === cle);
  if (!moi || moi.sorti_en || moi.course == null) return null;
  if (moi.phase !== e.phase || e.etat === 'terminee') return null;

  const rv = e.calendrier.find(r => r.phase === moi.phase && r.course === moi.course);
  const partants = e.partants.filter(p => p.phase === moi.phase && p.course === moi.course);
  return {
    phase: moi.phase,
    phaseNom: e.phases.find(p => p.cle === moi.phase)?.nom || moi.phase,
    course: moi.course,
    partants,
    code: codeCourseChamp(e.id, moi.phase, moi.course),
    at: rv ? rv.at : null,
    // Deja courue : le chrono est en base, il n'y a plus rien a rejoindre.
    couru: e.resultats.some(r =>
      r.phase === moi.phase && r.course === moi.course && r.name_key === cle),
  };
}

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
