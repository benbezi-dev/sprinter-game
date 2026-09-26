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

import { getDeviceId } from './leaderboard';

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
  /**
   * Le tenant du titre de cette edition. Un seul partant le porte, ou aucun.
   *
   * Le serveur l'a gele a la cloture et ne le recalcule plus : l'ecran n'a donc
   * jamais a comparer une date d'expiration a l'heure qu'il est, ce qui est
   * exactement le genre de regle qu'un client finit par dire differemment du
   * serveur.
   */
  tenant?: boolean;
};

export type Resultat = {
  phase: string; course: number; name_key: string;
  ms: number | null; place: number | null;
  /**
   * Pourquoi il n'y a pas de chrono, pour une course courue en direct :
   * carton rouge, abandon, forfait. Absent des courses remplies au harnais.
   */
  motif?: 'faux_depart' | 'abandon' | 'forfait' | null;
  /** L'instant du faux depart, en millisecondes depuis le coup (negatif). */
  motif_ms?: number | null;
};

export type PhaseInfo = { cle: string; nom: string; courses: number };

/**
 * LE MOT DU VAINQUEUR D'UNE COURSE.
 *
 * Un seul par course, celui du premier, et il ne s'efface pas : les sept
 * autres partants ne l'ouvrent pas tous au meme moment.
 *
 * `a_voix` dit qu'un enregistrement existe, jamais l'enregistrement lui-meme :
 * six secondes encodees pesent jusqu'a deux cents kilooctets, et l'edition se
 * recharge a chaque ouverture de l'ecran. Qui veut l'entendre le demande.
 */
export type MotDeCourse = {
  phase: string; course: number;
  name_key: string; nom: string;
  texte: string | null;
  a_voix: boolean;
  au: number;
};

/**
 * LE CHAMPION EN TITRE de l'edition en cours, et ce que son titre lui donne.
 *
 * `cinematique` est un NOM de mise en scene, pas la mise en scene : le serveur
 * dit qui est le tenant et ce que son titre lui accorde, le jeu decide de ce
 * qu'il en montre. C'est la meme frontiere que pour le format des phases —
 * recopier ici la regle « le tenant est en finale » garantirait qu'un jour les
 * deux ne disent plus la meme chose.
 *
 * Ce champ est l'ETAT ; l'annonce de type `boss` est l'EVENEMENT. Les deux
 * existent parce qu'ils ne servent pas la meme chose : l'annonce passe une fois
 * et declenche la scene en direct, ce champ-la reste et permet a qui ouvre
 * l'ecran le dimanche matin de savoir lequel de ces trente-deux noms a un titre
 * a defendre.
 */
export type TenantEnTitre = {
  name_key: string;
  nom: string;
  /** Sa serie au premier tour. */
  course: number | null;
  rang_duel: number | null;
  /** Phase ou il est sorti — normalement jamais, et c'est tout le privilege. */
  sorti_en: string | null;
  /** « Champion de France » — le titre remis en jeu, compose par le serveur. */
  libelle: string;
  cinematique: string;
  /** Vrai si son titre le qualifie d'office pour la finale. */
  finaleDOffice: boolean;
};

export type RendezVous = {
  cle: string; phase: string; course?: number; minute: number; at: number;
  reveal?: boolean; ceremonie?: boolean;
};

export type Edition = {
  id: string;
  echelon: 'national' | 'continental' | 'mondial';
  zone: string;
  zoneNom: string;
  zoneNomEn?: string;
  /**
   * La distance de l'edition : '100', '200' ou '400'.
   *
   * Le serveur la rend toujours, y compris pour les editions ouvertes avant
   * qu'elle existe — il retombe alors sur le 100 m. Pas de `| null` ici, donc :
   * un ecran n'a jamais a se demander de quoi on est champion.
   */
  epreuve: string;
  /** « Championnat de France », deja accorde. */
  titre: string;
  /**
   * Le lieu ou l'edition se rejoue, s'il est impose par le serveur : la cle
   * d'un stade ('champdemars'). `null` ou absent : le stade par defaut.
   */
  lieu?: string | null;
  debut: number;
  /**
   * L'heure ou la selection ferme : trois jours avant le depart.
   *
   * C'est l'echeance vers laquelle on decompte, et la seule sur laquelle le
   * joueur peut encore agir — apres elle, la grille ne bouge plus.
   *
   * `null` pour les editions ouvertes d'un seul geste (canal de test) et pour
   * celles d'avant que la cloture existe. Un ecran ne doit pas decompter vers
   * une echeance qui n'a jamais ete annoncee.
   */
  cloture: number | null;
  phase: string;
  phaseNom: string;
  phaseIndex: number;
  phases: PhaseInfo[];
  /**
   * Quatre etats, et ils ne se ressemblent pas :
   *
   *   annoncee   la date est publique, la grille n'existe pas encore. C'est
   *              l'etat ou le classement compte encore pour quelque chose.
   *   ouverte    les 32 sont geles, les series peuvent partir.
   *   annulee    annoncee, puis pas assez de partants a la cloture.
   *   terminee   il y a un champion.
   */
  etat: 'annoncee' | 'ouverte' | 'annulee' | 'terminee';
  courses: number;
  parCourse: number;
  directsParCourse: number;
  repechages: number;
  champion: string | null;
  /**
   * Le tenant du titre, ou `null` — et `null` est le cas ordinaire pour
   * l'instant : il n'y a de tenant que si une edition precedente a sacre
   * quelqu'un dans cette meme zone et a ce meme echelon, et que ce quelqu'un a
   * rejoue depuis.
   */
  tenant: TenantEnTitre | null;
  partants: Partant[];
  resultats: Resultat[];
  /** Les mots deja poses, toutes phases confondues. */
  mots?: MotDeCourse[];
  calendrier: RendezVous[];
};

export type Annonce = {
  id: number;
  edition: string | null;
  echelon: string;
  zone: string;
  zoneNom: string;
  zoneNomEn?: string;
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

type LigneEdition = {
  edition: string; echelon: string; zone: string; zoneNom: string;
  epreuve: string; debut: number; cloture: number | null; phase: string;
};

export type Monde = {
  /** Les championnats a venir. Le seul bloc qui parle a qui n'est pas engage. */
  annoncees: LigneEdition[];
  encours: LigneEdition[];
  sacres: Sacre[];
  /** Annoncees puis sans partants a la cloture. Elles n'ont pas eu lieu. */
  annulees: LigneEdition[];
  total: number;
  termines: number;
};

/** Le prochain championnat d'un pays, annonce ou en cours. */
export type Rendezvous = {
  id: string;
  echelon: string;
  zone: string;
  zoneNom: string;
  zoneNomEn?: string;
  titre: string;
  epreuve: string;
  debut: number;
  cloture: number | null;
  etat: 'annoncee' | 'ouverte';
  /** Le nombre de places. Vient du serveur : le format n'est pas au jeu. */
  partants: number;
  calendrier: RendezVous[];
};

/**
 * Ou en est ce joueur par rapport a la barre de selection de son pays.
 *
 * `manque` est le nombre de places qui le separent de la qualification, et
 * c'est la seule valeur de tout ce fichier qui fasse rejouer quelqu'un. Elle
 * vaut `null` de deux facons qu'il ne faut pas confondre : le joueur est
 * qualifie, ou il n'est pas classe du tout — deux phrases differentes a
 * l'ecran, pas la meme avec un zero dedans.
 *
 * Le MMR n'apparait pas ici, et ce n'est pas un oubli : le serveur ne le rend
 * pas. Un rang se verifie en comptant les lignes du classement, un nombre
 * cache ne se verifie pas.
 */
export type MaSelection = {
  pays: string | null;
  /** « Championnat de France », deja accorde. `null` sans edition. */
  titre: string | null;
  epreuve: string | null;
  zoneNom: string | null;
  edition: string | null;
  etat: 'annoncee' | 'ouverte' | null;
  cloture: number | null;
  debut: number | null;
  /** Le nombre de places qualificatives. */
  places: number;
  /** Combien de joueurs actifs sont classes dans ce pays. */
  classes?: number;
  /**
   * La cle du joueur qui occupe la derniere place qualificative.
   *
   * Le jeu trace sa barre APRES cette ligne, et pas apres la 32e qu'il compte
   * lui-meme : le classement affiche montre tout le monde, la selection exige
   * un duel classe dans les soixante derniers jours. Les endormis tiennent une
   * ligne sans occuper de place, et compter les lignes tracerait la barre trop
   * bas sans le dire.
   *
   * `null` quand le pays n'a pas assez de joueurs, et apres le gel — le
   * classement du jour ne selectionne alors plus rien.
   */
  barre: string | null;
  /** Son rang dans l'ordre de selection, ou `null` s'il n'est pas classe. */
  rang: number | null;
  retenu: boolean;
  manque: number | null;
  /** Vrai apres la cloture : la reponse ne bougera plus. */
  gele: boolean;
  /**
   * Sa serie et son heure de convocation. `null` avant le gel — la grille
   * n'existe pas — et `null` pour qui n'est pas retenu.
   */
  course: { phase: string; numero: number; at: number | null } | null;
  /** L'edition ne selectionne que les joueurs engages (confirmes). */
  engagement?: boolean;
  /** Ce joueur a confirme sa participation. */
  engage?: boolean;
  raison?: string;
};

/* --------------------------------------------- la memoire de la cinematique
 *
 * L'ENTREE EN LICE DU TENANT NE PEUT PAS SE DECLENCHER SUR UNE ANNONCE, et
 * c'est le fil d'annonces lui-meme qui l'interdit.
 *
 * Le serveur emet `boss` a la cloture — c'est l'instant juste : le statut est
 * fige, le couloir existe. Mais avant la cloture il n'y a aucun partant, donc
 * `/champ/mien` ne rend rien et le panneau du championnat n'est pas a l'ecran.
 * Personne n'a donc jamais son ecran ouvert pour recevoir cette annonce en
 * direct ; et au montage, le rattrapage du curseur marque toutes les annonces
 * passees comme vues sans les jouer — sans quoi il rejouerait la revelation des
 * repeches d'un championnat termine il y a des jours. La cinematique ne serait
 * donc JAMAIS jouee.
 *
 * Elle se declenche donc sur l'ETAT — `edition.tenant` — et cette memoire-ci
 * remplace ce que le curseur du fil apporte aux deux autres scenes : jouee une
 * fois par edition et par appareil, pas a chaque ouverture de l'accueil.
 *
 * On garde par identifiant d'edition et non par un simple drapeau : deux
 * championnats se suivent, et le second doit presenter son tenant meme si l'on
 * a vu celui du premier.
 */
const BOSS_VU = 'sprinter_champ_boss_vu';

function lireBossVus(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(BOSS_VU) || '{}'); } catch { return {}; }
}

/** La cinematique de cette edition a-t-elle deja ete jouee sur cet appareil ? */
export function bossVu(edition: string): boolean {
  return !!lireBossVus()[edition];
}

export function marquerBossVu(edition: string) {
  try {
    const v = lireBossVus();
    v[edition] = Date.now();
    // On ne garde que les vingt dernieres : sans plafond, cette cle grossit
    // d'une ligne par championnat et pour toujours. Vingt couvre cinq ans de
    // championnats nationaux a quatre par an, ce qui est tres au-dela de ce
    // qu'un appareil verra.
    const gardees = Object.entries(v)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    localStorage.setItem(BOSS_VU, JSON.stringify(Object.fromEntries(gardees)));
  } catch {
    // Sans memoire, la scene se rejoue a chaque ouverture. C'est degrade et
    // pas casse — et c'est le bon compromis : l'inverse (ne jamais la jouer)
    // rendrait la fonctionnalite invisible.
  }
}

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

/**
 * Le prochain championnat d'un pays — annonce ou en cours.
 *
 * A ne pas confondre avec `monEdition`, qui cherche le championnat ou le
 * joueur COURT. Celle-ci repond meme a qui n'y est pas, et c'est tout son
 * interet : avant la cloture personne n'est engage, et apres la cloture il
 * reste vingt fois plus de joueurs dehors que dedans. Ce sont eux qu'il faut
 * convaincre de jouer, et jusqu'ici rien ne leur parlait.
 */
export const prochainChampionnat = (pays: string) =>
  json<{ edition: Rendezvous | null }>('/champ/prochain?pays=' + encodeURIComponent(pays));

/** A combien de places de la qualification ce joueur se trouve. */
export const maSelection = (nom: string) =>
  json<MaSelection>('/champ/selection?name=' + encodeURIComponent(nom));

/**
 * Confirmer sa participation — ou la retirer — pour l'edition a venir.
 * Rend la selection relue par le serveur, ou `{ error }`.
 */
export async function engager(nom: string, oui: boolean): Promise<MaSelection | { error: string }> {
  try {
    const r = await fetch(API_BASE + '/champ/engager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name: nom, engage: oui }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) return { error: (j && j.error) || 'erreur' };
    return j as MaSelection;
  } catch {
    return { error: 'reseau' };
  }
}

/**
 * Ce qu'il reste avant une echeance, ou `null` si elle est passee.
 *
 * Rendre `null` plutot que zero ou un negatif est le point : « il reste 0 j »
 * et « c'est ferme » ne se disent pas pareil, et un ecran qui recoit un nombre
 * finit toujours par l'afficher.
 */
export function restant(echeance: number | null, maintenant = Date.now()) {
  if (echeance == null) return null;
  const ms = echeance - maintenant;
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return {
    ms,
    jours: Math.floor(s / 86400),
    heures: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    secondes: s % 60,
  };
}

export const etatEdition = (id: string) =>
  json<Edition>('/champ/edition/' + encodeURIComponent(id));

export const recapMondial = (echelon?: string) =>
  json<Monde>('/champ/monde' + (echelon ? '?echelon=' + echelon : ''));

/* ------------------------------------------ le tableau des medailles */

export type LigneNation = {
  pays: string;
  continent: string | null;
  or: number; argent: number; bronze: number;
  total: number;
  /** Combien de joueurs distincts de ce pays ont ete medailles. */
  athletes: number;
  /** La derniere medaille du pays, en millisecondes. */
  derniere: number;
  /**
   * Le rang, ex aequo compris — deux pays au meme palmares le partagent.
   *
   * Il vient du serveur et non de la position dans la liste : numeroter les
   * lignes a l'ecran donnerait un 4e et un 5e a deux pays strictement egaux.
   */
  rang: number;
};

export type TableauNations = {
  echelon: string | null;
  epreuve: string | null;
  nations: LigneNation[];
  /**
   * Les medailles dont on ne connait pas le drapeau.
   *
   * Elles ne sont rangees sous aucun pays, et l'ecran le dit plutot que de
   * laisser une somme qui ne tombe pas juste.
   */
  sansPays: number;
  medailles: number;
};

/**
 * Le palmares de chaque pays.
 *
 * Sans argument il additionne tout — les trois echelons, les trois distances,
 * depuis la premiere edition. C'est la vue qui repond a « ou en est mon
 * pays », et c'est celle qu'on montre d'abord.
 */
export const tableauNations = (o: { echelon?: string; epreuve?: string } = {}) => {
  const q = new URLSearchParams();
  if (o.echelon) q.set('echelon', o.echelon);
  if (o.epreuve) q.set('epreuve', o.epreuve);
  const s = q.toString();
  return json<TableauNations>('/champ/nations' + (s ? '?' + s : ''));
};

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
