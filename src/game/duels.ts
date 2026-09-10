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
// Ouvert partout. Le drapeau reste : refermer doit tenir en un mot, et le
// canal de test garde son interet — il ecrit dans une autre base.
const OUVERT_EN_PRODUCTION = true;
export const DUELS_OUVERTS = EST_TEST || OUVERT_EN_PRODUCTION;

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const VU_KEY = 'sprinter_duels_vus';

/** Les etages de l'echelle, du premier au dernier. */
export type Etage = 'departemental' | 'regional' | 'national' | 'elite' | 'legende';

/**
 * LA DISCIPLINE : ce sur quoi une division se gagne.
 *
 * Un joueur n'a pas un niveau, il en a un par distance. Regional sur 100 m ne
 * dit rien de ce qu'on vaut sur 400 m, et le classement le dit maintenant :
 * il y a une echelle par discipline, et l'ecran demande celle qu'il montre.
 *
 * Une discipline est une epreuve — `'100'` — ou le cumul de plusieurs, courues
 * d'un bloc : `'100+200'`. L'ordre est celui du programme, 100 avant 200 avant
 * 400, sans quoi deux ecrans demanderaient deux classements pour la meme
 * course. `cleDiscipline` est le seul endroit ou cette cle se fabrique.
 */
export const EPREUVES_DUEL = ['100', '200', '400'];
export const DISCIPLINE_DEFAUT = '100';

export function cleDiscipline(epreuves?: string[] | null): string {
  const vues = new Set((epreuves || []).map(e => String(e).trim()));
  const cle = EPREUVES_DUEL.filter(k => vues.has(k)).join('+');
  return cle || DISCIPLINE_DEFAUT;
}

/** Le libelle d'une discipline : « 100 M », « 100 + 200 M ». */
export function nomDiscipline(cle: string): string {
  const eps = String(cle || '').split('+').filter(k => EPREUVES_DUEL.includes(k));
  return (eps.length ? eps : [DISCIPLINE_DEFAUT]).join(' + ') + ' M';
}

/** Ma division sur une discipline, telle que le serveur la rend. */
export type MonRang = {
  epreuve: string;
  palier: number;
  etage: Etage;
  division: number;
  lp: number;
  wins: number;
  losses: number;
  draws: number;
};

export type Echelle = {
  etages: Etage[];
  divisions: number;
  legende: number;
  lp_par_palier: number;
};

export type DuelRow = {
  name: string;
  /** La discipline de ce classement. La meme sur toutes ses lignes. */
  epreuve: string;
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
  /**
   * La discipline ou ce duel a compte.
   *
   * Elle accompagne le rang pour une raison simple : « TU MONTES EN NATIONAL
   * II » ne veut plus rien dire sans distance depuis que les niveaux ne sont
   * plus partages — on monte sur 400 m, pas partout a la fois.
   */
  epreuve?: string;
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
  /** La discipline de ce classement, telle que le serveur l'a comprise. */
  epreuve: string;
  /** Les disciplines qu'un ecran peut proposer : les trois distances seules. */
  epreuves: string[];
  classement: DuelRow[];
  moi: DuelRow | null;
  /** Mes divisions sur TOUTES mes disciplines, la plus haute en tete. */
  mes_epreuves: MonRang[];
};

// On ne retient que le rang, et par discipline : le 12e du 100 m n'est pas le
// 12e du 400 m, et une seule memoire pour les deux ferait clignoter des
// fleches qui ne racontent rien.
type Vu = Record<string, Record<string, { rank: number }>>;

function lireVu(): Vu {
  try {
    const brut = JSON.parse(localStorage.getItem(VU_KEY) || '{}');
    if (!brut || typeof brut !== 'object') return {};
    // Le souvenir d'avant les disciplines rangeait des joueurs a la racine, la
    // ou l'on range maintenant des distances. On ne le lit pas — un rang de
    // joueur pris pour un classement entier ferait n'importe quoi — et il ne
    // survit pas a la premiere ecriture, qui ne recopie que ce qui passe ici.
    const propre: Vu = {};
    for (const cle of Object.keys(brut)) {
      if (cleDiscipline(cle.split('+')) === cle) propre[cle] = brut[cle];
    }
    return propre;
  } catch { return {}; }
}
function ecrireVu(epreuve: string, rows: DuelRow[]) {
  try {
    // On garde les autres disciplines : chacune a son dernier passage, et
    // regarder le 200 m ne doit pas effacer les fleches du 100 m.
    const v = lireVu();
    const d: Record<string, { rank: number }> = {};
    for (const r of rows) d[r.name.trim().toLowerCase()] = { rank: r.rank };
    v[epreuve] = d;
    localStorage.setItem(VU_KEY, JSON.stringify(v));
  } catch { /* sans memoire : pas de fleches, le classement reste juste */ }
}

/**
 * Le mouvement se mesure depuis la derniere fois que CE joueur a regarde le
 * classement. Un rang fige cote serveur ne survivrait pas au duel suivant et
 * l'indicateur serait vide la plupart du temps ; ainsi il raconte toujours
 * quelque chose : « voila ce qui a change depuis ton dernier passage ».
 */
export async function fetchDuels(
  epreuve: string = DISCIPLINE_DEFAUT, marquerVu = true,
): Promise<DuelBoard | null> {
  try {
    const nom = encodeURIComponent(getSavedName() || '');
    const ep = encodeURIComponent(epreuve || DISCIPLINE_DEFAUT);
    const res = await fetch(`${API_BASE}/duels?name=${nom}&epreuve=${ep}`);
    if (!res.ok) return null;
    const data: DuelBoard = await res.json();
    // La discipline rendue fait foi : c'est celle que le serveur a comprise,
    // et c'est sous elle que se rangent les fleches. Comparer un classement du
    // 200 m au souvenir d'un 100 m inventerait des montees.
    const cle = data.epreuve || epreuve || DISCIPLINE_DEFAUT;
    const vu = lireVu()[cle] || {};
    for (const r of data.classement) {
      const avant = vu[r.name.trim().toLowerCase()];
      r.move = avant ? avant.rank - r.rank : 0;
    }
    if (data.moi) {
      const a = vu[data.moi.name.trim().toLowerCase()];
      data.moi.move = a ? a.rank - data.moi.rank : 0;
    }
    if (!Array.isArray(data.mes_epreuves)) data.mes_epreuves = [];
    if (marquerVu) ecrireVu(cle, data.classement);
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
  /**
   * De quel cote j'etais dans cette rencontre.
   *
   * Le meme ecran sert les deux roles depuis que le vainqueur peut laisser un
   * mot : celui qui a lance apprend son resultat, celui qui a releve apprend ce
   * qu'on lui a dit. Sans ce champ, l'ecran ne saurait pas de quel cote lire
   * l'issue — et annoncerait une victoire a celui qui vient de perdre.
   */
  role: 'challenger' | 'opponent';
  issue: 'challenger' | 'opponent' | 'draw';
  /** Ce que ce duel m'a rapporte, tel qu'inscrit au moment ou il s'est joue. */
  lp: number;
  mon_ms: number;
  son_ms: number;
  /** Le mot du vainqueur, s'il en a laisse un. Nul pour le vainqueur lui-meme. */
  mot?: string | null;
  /** Sa voix, encodee. Effacee du serveur des que cette fenetre se ferme. */
  voix?: string | null;
  voix_type?: string | null;
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

/**
 * Le fantome a battre dans une revanche : celui du vainqueur.
 *
 * La revanche partait sur une piste vide. Le chrono a battre etait connu — le
 * jeu le tenait, le serveur aussi — mais rien ne courait a cote du joueur, et
 * une cible qu'on ne voit pas ne se court pas : on ne savait qu'a l'arrivee si
 * on avait tenu le rythme.
 *
 * Le serveur ne la rend qu'au PERDANT de la rencontre, et c'est lui qui le
 * verifie. Nul quand il n'y a rien a rendre : une rencontre d'avant que les
 * tentatives ne gardent leur trace, un duel nul, ou quelqu'un qui reclame la
 * trace d'un duel dont il n'etait pas.
 */
export type FantomeDuel = {
  /** Le nom a afficher dans le couloir du fantome. */
  name: string;
  /** Son total, en millisecondes : le chrono qu'il faut battre. */
  total_ms: number;
  races: string[];
  level_idx: number;
  /** Ses chronos epreuve par epreuve, en millisecondes. */
  splits: number[];
  /** Une trace par epreuve, en decimetres. Vide si le duel est trop ancien. */
  traces: number[][];
};

export async function fantomeDuDuel(id: string): Promise<FantomeDuel | null> {
  try {
    const q = `id=${encodeURIComponent(id)}` +
              `&device_id=${encodeURIComponent(getDeviceId())}` +
              `&name=${encodeURIComponent(getSavedName() || '')}`;
    const res = await fetch(`${API_BASE}/duel/fantome?${q}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.found) return null;
    return {
      name: String(data.name || ''),
      total_ms: Number(data.total_ms) || 0,
      races: Array.isArray(data.races) ? data.races.map(String) : [],
      level_idx: Number(data.level_idx) || 0,
      splits: Array.isArray(data.splits) ? data.splits.map((v: any) => Number(v) || 0) : [],
      traces: Array.isArray(data.traces) ? data.traces : [],
    };
  } catch {
    return null;
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

/**
 * Defier quelqu'un depuis le classement des duels.
 *
 * On relance les MEMES epreuves que celles qu'on vient de courir : defier
 * quelqu'un sur un 400 m parce qu'on vient d'en faire un a l'instant est le
 * seul enchainement qui ait un sens depuis un ecran d'arrivee.
 *
 * LE CIBLAGE PASSE PAR LE TOP 500, et il faut savoir pourquoi. Le serveur
 * n'accepte qu'un identifiant de score pour designer un adversaire : c'est
 * ainsi qu'il retrouve son appareil et lui pose le defi dans sa boite. Or le
 * classement des duels est tenu par NOM, sans cet identifiant. On va donc le
 * chercher la ou il existe.
 *
 * Quand le nom ne s'y retrouve pas — un joueur classe en duels qui n'est pas
 * au TOP 500 de cette epreuve — le defi part quand meme, mais sans destinataire
 * : il produit un code a envoyer soi-meme. C'est une degradation, pas un echec,
 * et l'ecran le dit plutot que de laisser croire que la personne a ete
 * prevenue.
 */
export async function defierDepuisClassement(
  nom: string,
  epreuves: string[],
  niveau = 4,
): Promise<{ cible: boolean }> {
  const { SprinterApp } = await import('./engine');
  const { fetchLeaderboard } = await import('./leaderboard');

  const cherche = nom.trim().toLowerCase();
  let trouve: { scoreId: number; name: string } | null = null;

  // On interroge l'epreuve qu'on vient de courir en premier : c'est celle ou
  // la personne a le plus de chances de figurer si elle nous y a croises.
  for (const e of [...new Set(epreuves)]) {
    try {
      const liste = await fetchLeaderboard(e as '100' | '200' | '400');
      const l = liste.find(x => x.id != null && x.name.trim().toLowerCase() === cherche);
      if (l && l.id != null) { trouve = { scoreId: l.id, name: l.name }; break; }
    } catch { /* le reseau a manque : on part sans cible */ }
  }

  SprinterApp.G.challengeTarget = trouve;
  SprinterApp.startOneShot(epreuves, { levelIdx: niveau });
  return { cible: !!trouve };
}
