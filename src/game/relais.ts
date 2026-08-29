// Le relais 4×100, vu du jeu.
//
// Une equipe EST sa composition : quatre noms, quel que soit l'ordre, forment
// toujours la meme equipe et portent toujours le meme nom. La regle vit dans la
// base, garantie par un index unique — ce fichier ne fait que demander.
//
// Un mot sur les invitations, parce qu'elles expliquent la forme du reste :
// creer une equipe n'engage que son createur. Les trois autres doivent
// accepter, et tant qu'ils ne l'ont pas fait l'equipe existe sans pouvoir
// courir. C'est voulu — on ne se retrouve pas inscrit a une competition parce
// qu'un ami a tape son nom.

import { getSavedName } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

/** L'etat d'un membre, tel que la base le nomme. */
export type EtatMembre = 'invited' | 'in' | 'out';

export type MembreRelais = {
  nom: string;
  cle: string;
  /** Le rang du relayeur, 1 a 4, ou null tant que l'ordre n'est pas fixe. */
  relais: number | null;
  etat: EtatMembre;
};

export type EquipeRelais = {
  id: string;
  nom: string;
  statut: string;
  createur: string;
  cree_le: number;
  complete_le: number | null;
  membres: MembreRelais[];
  /** Combien de places restent a pourvoir. Zero = l'equipe est au complet. */
  manquants: number;
};

export type LigneRelais = {
  rang: number;
  id: string;
  nom: string;
  meilleur_ms: number;
  courses: number;
  derniere: number;
};

async function lire<T>(chemin: string): Promise<T | null> {
  try {
    const r = await fetch(API_BASE + chemin);
    if (!r.ok) return null;
    return await r.json() as T;
  } catch { return null; }
}

async function poster<T>(chemin: string, corps: any): Promise<T & { error?: string }> {
  try {
    const r = await fetch(API_BASE + chemin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ...(d || {}), error: (d && d.error) || 'refus du serveur' } as any;
    return d as any;
  } catch {
    return { error: 'reseau' } as any;
  }
}

/**
 * Mes equipes et mes invitations, separement.
 *
 * Le serveur les distingue, et c'est utile : une invitation demande une
 * reponse, une equipe demande d'etre menee. Les melanger dans une seule liste
 * obligerait a relire l'etat de chaque membre pour savoir quoi faire.
 */
export const mesEquipes = (nom = getSavedName()) =>
  lire<{ equipes: EquipeRelais[]; invitations: EquipeRelais[] }>(
    '/relay/mine?name=' + encodeURIComponent(nom || ''));

export const uneEquipe = (id: string) =>
  lire<{ equipe: EquipeRelais }>('/relay/team/' + encodeURIComponent(id));

/**
 * Cree une equipe et invite les trois autres.
 *
 * Le serveur enveloppe sa reponse dans `{ equipe }`, comme la lecture : c'est
 * ce qui permet d'y ajouter un jour autre chose sans casser les appelants.
 */
export const creerEquipe = (nom: string, coequipiers: string[]) =>
  poster<{ equipe: EquipeRelais }>('/relay/team', {
    name: nom, creator: getSavedName(), members: coequipiers,
  });

/** Accepter ou refuser une invitation. */
export const repondre = (id: string, accepte: boolean) =>
  poster<{ ok: true }>('/relay/answer', { id, name: getSavedName(), accept: accepte });

/** Fixer l'ordre des relayeurs : quatre cles, du premier au dernier. */
export const ordonner = (id: string, ordre: string[]) =>
  poster<{ ok: true }>('/relay/order', { id, order: ordre });

export const classementRelais = (race = '4x100') =>
  lire<{ race: string; classement: LigneRelais[] }>(
    '/relay/ranking?race=' + encodeURIComponent(race));

/** Une course enregistree, affrontable sans que personne se connecte. */
export type FantomeRelais = {
  rang: number;
  /** L'identifiant de la COURSE, pas celui de l'equipe : une equipe en a
      plusieurs, et c'est une course precise que l'on reaffronte. */
  id: number;
  equipe: string;
  equipe_id: string;
  total_ms: number;
  relais: number[];
  le: number;
};

/**
 * Les courses rejouables, du meilleur au moins bon.
 *
 * Le serveur n'en garde que dix : au-dela, une equipe conserve son chrono au
 * classement mais sa trace est effacee. Affronter le onzieme n'aurait pas
 * grand interet, et stocker quatre cents positions par course pour toutes les
 * equipes du jeu en aurait encore moins.
 */
export const fantomesRelais = (race = '4x100') =>
  lire<{ race: string; fantomes: FantomeRelais[] }>(
    '/relay/ghosts?race=' + encodeURIComponent(race));

/** Ouvre une confrontation et renvoie son code, a partager comme un salon. */
export const ouvrirConfrontation = () =>
  poster<{ id: string }>('/relay/confrontation', {});

/** Les membres qui ont accepte, dans l'ordre des relais quand il est fixe. */
export const titulaires = (e: EquipeRelais) =>
  e.membres.filter(m => m.etat === 'in')
    .sort((a, b) => (a.relais ?? 9) - (b.relais ?? 9));

/**
 * Ce qui manque encore pour courir, en clair.
 *
 * On renvoie la raison plutot qu'un simple faux, pour pouvoir l'afficher au
 * lieu d'un bouton grise sans explication.
 *
 * L'ordre n'y figure pas, et c'est une decision du serveur qu'il vaut mieux
 * connaitre : il attribue les relais 1 a 4 au fur et a mesure des
 * acceptations. Une equipe complete a donc toujours un ordre — celui de
 * l'ordre d'arrivee — et le fixer soi-meme, c'est le CHANGER, pas le creer.
 * Une equipe ne reste donc jamais bloquee faute d'ordre.
 */
export function ceQuiManque(e: EquipeRelais): 'attente' | 'refus' | null {
  if (e.membres.some(m => m.etat === 'invited')) return 'attente';
  if (e.manquants > 0) return 'refus';
  return null;
}

export const preteACourir = (e: EquipeRelais) => ceQuiManque(e) === null;
