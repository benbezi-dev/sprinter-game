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

import { getDeviceId, getSavedName, type LigneClassee } from './leaderboard';
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
/** Ma propre place, gardee a part : voir monRangDuel(). */
const MON_RANG_KEY = 'sprinter_duel_mon_rang';

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
 * MA PLACE, TELLE QU'ON L'A LUE LA DERNIERE FOIS.
 *
 * Gardee a part de VU_KEY, qui retient le rang de TOUT LE MONDE pour les
 * fleches du tableau. Les deux reperes ne se posent pas aux memes moments :
 * celui des fleches ne bouge qu'a l'ouverture du classement — sinon elles
 * s'effaceraient seules pendant qu'on les regarde — alors que le mien doit
 * suivre chaque lecture, y compris les rafraichissements. C'est de lui que
 * l'annonce d'un duel tire « d'ou je viens ».
 */
export function monRangDuel(): number | null {
  try {
    const v = localStorage.getItem(MON_RANG_KEY);
    const n = v == null ? 0 : Number(v);
    return n > 0 ? n : null;
  } catch { return null; }
}

/**
 * LA LECTURE LA PLUS RECENTE GAGNE, MEME SI ELLE REPOND LA PREMIERE.
 *
 * Deux lectures se croisent pour de bon : celle prise avant un duel est
 * plafonnee — un reseau lent ne retient pas le resultat — et elle peut donc
 * repondre APRES celle qui annonce le deplacement. Sans ce jeton elle
 * reposerait alors la place d'avant le duel, et le duel suivant annoncerait
 * une seconde fois la montee de celui-ci.
 */
let derniereLecture = 0;
let lectures = 0;

function noterMonRang(rank: number | null, jeton: number) {
  if (jeton < derniereLecture) return;
  derniereLecture = jeton;
  try {
    if (rank == null) localStorage.removeItem(MON_RANG_KEY);
    else localStorage.setItem(MON_RANG_KEY, String(rank));
  } catch { /* sans memoire : pas d'annonce de montee, le classement reste juste */ }
}

/**
 * Le mouvement se mesure depuis la derniere fois que CE joueur a regarde le
 * classement. Un rang fige cote serveur ne survivrait pas au duel suivant et
 * l'indicateur serait vide la plupart du temps ; ainsi il raconte toujours
 * quelque chose : « voila ce qui a change depuis ton dernier passage ».
 */
export async function fetchDuels(marquerVu = true): Promise<DuelBoard | null> {
  // Pris avant la requete : c'est l'ordre des DEPARTS qui dit laquelle des
  // deux lectures est la plus recente, pas celui des reponses.
  const jeton = ++lectures;
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
    // Mon repere se pose a CHAQUE lecture, marquee ou non : il ne sert pas a
    // afficher une fleche mais a savoir d'ou partira la prochaine annonce.
    noterMonRang(data.moi ? data.moi.rank : null, jeton);
    return data;
  } catch {
    return null;
  }
}

/**
 * MON DEPLACEMENT AU CLASSEMENT DES DUELS : D'OU JE VIENS, OU JE SUIS, QUI EST
 * AUTOUR.
 *
 * Le serveur n'annonce ni l'un ni l'autre. Il rend des points de ligue et une
 * division — ce qui suffit a dire ce qu'un duel a rapporte, et pas a dire
 * qu'on vient de doubler trois personnes. La place, elle, ne se deduit pas
 * d'un total : elle depend de ce que mille autres joueurs ont fait pendant ce
 * temps. On la relit donc au tableau.
 *
 * `avant` est le repere pose a la derniere lecture. Il est repose au passage :
 * un meme deplacement ne s'annonce ainsi qu'une fois, et trois resultats
 * annonces d'affilee ne racontent pas trois fois la meme montee.
 */
export type MonMouvement = {
  /** Ma place d'avant. Nulle quand je n'etais pas classe : c'est une entree. */
  avant: number | null;
  apres: number;
  /** Le nom sous lequel je figure au tableau. */
  nom: string;
  /** Le voisinage de ma nouvelle place, ma ligne exclue. */
  lignes: LigneClassee[];
};

export async function mouvementDuel(rayon = 4): Promise<MonMouvement | null> {
  const avant = monRangDuel();
  // Sans marquer la visite : les fleches du tableau disent « depuis ton
  // dernier passage », et passer ici n'est pas y etre passe.
  const b = await fetchDuels(false);
  if (!b || !b.moi) return null;
  const apres = b.moi.rank;
  const cle = b.moi.name.trim().toLowerCase();
  const lignes = (b.classement || [])
    .filter(r => r.name.trim().toLowerCase() !== cle)
    .filter(r => r.rank >= apres - rayon && r.rank <= apres + rayon + 1)
    .map(r => ({ rank: r.rank, name: r.name }));
  return { avant, apres, nom: b.moi.name, lignes };
}

/**
 * LE MEME DEPLACEMENT, MAIS APRES UNE COURSE EN DIRECT.
 *
 * Le direct annonce son resultat AVANT d'inscrire les points : la salle
 * diffuse l'arrivee aux deux joueurs, puis ecrit au classement de son cote —
 * volontairement, pour qu'une base indisponible ne laisse pas deux personnes
 * bloquees devant une attente. Lire le tableau des l'arrivee tombe donc le
 * plus souvent avant que la ligne ait bouge.
 *
 * On redemande donc, quelques fois, jusqu'a ce que la place change. Un duel
 * qui ne deplace personne — et il y en a — fait relire pour rien : c'est le
 * prix a payer pour ne pas rater les autres, et il se paie en trois requetes
 * qu'aucun joueur ne voit passer.
 *
 * Repasser par mouvementDuel() est sans danger : le repere ne se deplace que
 * quand la place se deplace, donc une lecture qui ne trouve rien de neuf
 * repose la meme valeur et la suivante part du meme point.
 */
export async function mouvementApresDirect(essais = 3, pause = 900): Promise<MonMouvement | null> {
  for (let i = 0; i < essais; i++) {
    const m = await mouvementDuel();
    if (m && m.avant !== m.apres) return m;
    if (i < essais - 1) await new Promise(r => setTimeout(r, pause));
  }
  return null;
}

/**
 * Pose le repere JUSTE AVANT un duel.
 *
 * Sans lui, le deplacement annonce a l'arrivee serait compte depuis la
 * derniere fois que le joueur a ouvert le tableau — hier, ou jamais. Ce duel-ci
 * doit annoncer ce que CE duel a fait, et pour cela il faut avoir lu le
 * classement pendant qu'il tenait encore.
 *
 * A prendre AVANT d'envoyer le chrono : apres, le serveur a deja bouge la
 * ligne, et le repere ne mesurerait plus rien. Plafonne par l'appelant — le
 * resultat d'un duel n'attend pas apres un reseau lent.
 */
export async function repereAvantDuel(): Promise<void> {
  await fetchDuels(false);
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
