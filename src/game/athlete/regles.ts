// LA CARRIERE D'ATHLETE — les regles, sans rien dessiner ni rien courir.
//
// Une vie d'athlete en semaines. Chaque semaine a ses seances fixes — le
// lundi la vitesse, le mercredi la force, le vendredi la technique — et une
// quatrieme, le samedi, pour qui veut progresser plus vite : l'endurance. Le
// dimanche, quand le calendrier en porte une, c'est la competition, de la
// rencontre scolaire aux mondiaux.
//
// LES STATS SE GAGNENT A L'ENTRAINEMENT, PAS A LA BOUTIQUE. Une seance rend
// selon la qualite de ce qu'on y a fait (le score du mini-jeu, la frequence
// des appuis), l'encadrement (un coach de club), la fatigue, et ce qu'il
// reste a gagner : plus une qualite est haute, plus elle coute. Le materiel
// aide, un peu — les pointes valent quelques points en course, jamais une
// saison de travail.
//
// EN COURSE, LES STATS SONT DES COEFFICIENTS PROCHES DE 1 (`reglages`) :
// la vitesse de pointe a +/-5 %, la poussee, ce qu'on perd entre deux appuis,
// le risque de faux pas. C'est toujours la frequence des appuis du joueur qui
// fait la course ; un athlete entraine la fait juste mieux payer.
//
// CE FICHIER N'IMPORTE RIEN : le harnais (tools/athlete-test.mjs) le charge
// seul, et le hasard arrive toujours en parametre.

import type { Origine as Traits } from './corps-gens';
export type Stat = 'vitesse' | 'force' | 'technique' | 'endurance';
export const STATS: Stat[] = ['vitesse', 'force', 'technique', 'endurance'];

export type Origine = 'aisee' | 'modeste';
export type Voie = 'polyvalent' | 'specialiste';
export type Epreuve = '100' | '200' | '400';
export const EPREUVES: Epreuve[] = ['100', '200', '400'];
/**
 * LA PISTE COUVERTE DE VAL-DE-REUIL (piste-salle.js ; l'auteur, 25/10 : « on va ajouter les
 * courses en salle »). Le 60 m sur la ligne droite centrale, le 200 m (un tour) et le 400 m
 * (deux tours) sur l'anneau de 200 m. Courues aux meetings en salle du dimanche.
 */
export type EpreuveSalle = '60' | '200s' | '400s';
export const EPREUVES_SALLE: EpreuveSalle[] = ['60', '200s', '400s'];
export type Course = Epreuve | EpreuveSalle;
export const enSalle = (e: Course) => (EPREUVES_SALLE as string[]).includes(e);
/** « 60 m », « 200 m salle » : le nom d'une epreuve a l'ecran. */
export const libelleEpreuve = (e: Course) => e === '200s' ? '200 m salle' : e === '400s' ? '400 m salle' : `${e} m`;
export type Jour = 'lundi' | 'mercredi' | 'vendredi' | 'samedi';
export const JOURS: Jour[] = ['lundi', 'mercredi', 'vendredi', 'samedi'];
export type Objectif = 'france' | 'europe' | 'monde';
export type Chapitre = 'debut' | 'club';

export type Ligne = { s: number; fr: string; en: string };

export type Athlete = {
  v: 2;
  nom: string;
  origine: Origine;
  voie: Voie;
  /** L'epreuve du specialiste ; null tant qu'on touche a tout. */
  specialite: Epreuve | null;
  stats: Record<Stat, number>;
  argent: number;
  /** 0 frais, 100 epuise. */
  fatigue: number;
  /** 0 a 100. */
  moral: number;
  /** Semaines d'arret qui restent. */
  blessure: number;
  semaine: number;
  /** Les seances deja faites (ou perdues) cette semaine. */
  faites: Jour[];
  /** Les petits boulots faits cette semaine : chacun une fois, deux au plus. */
  boulots?: string[];
  club: string | null;
  coach: string | null;
  objectif: Objectif | null;
  materiel: string[];
  /** L'usure de chaque piece, de 0 (neuve) a 100 (usee : plus de bonus tant qu'on ne la rachete pas). */
  usureMat?: Record<string, number>;
  /** Le niveau de la prochaine competition (index de COMPETITIONS). */
  niveau: number;
  /** La semaine ou elle a lieu. */
  prochaine: number;
  reputation: number;
  abonnes: number;
  relations: { coach: number; club: number; rival: number };
  sponsors: string[];
  /** La categorie de la semaine derniere (statutDe), pour annoncer un changement. */
  statut?: Statut;
  chapitre: Chapitre;
  /** LA JOURNEE (game/athlete/regles.ts, « la journee ») : le jour (0 = lundi), l'heure en minutes. */
  jour?: number;
  heure?: number;
  /** Les besoins, de 0 (vide) a 100 (comble). Absents des sauvegardes d'avant : BESOINS_PLEINS. */
  besoins?: Record<Besoin, number>;
  /** L'ecole : 0 a 100, les cours et les devoirs la montent, secher la fait baisser. */
  ecole?: number;
  /** LE TELEPHONE (telephone.ts) : le releve de compte, les messages, les records, l'age, le velo. */
  compte?: { s: number; j: number; m: number; fr: string; en: string }[];
  messages?: { de: string; fr: string; en: string; s: number; j: number; h: number; lu?: boolean }[];
  records?: Partial<Record<Course, number>>;
  age?: number;
  velo?: boolean;
  /** LES GENS (gens.ts) : les relations hors coach et rival, qui l'on a vu cette semaine. */
  liens?: Record<string, number>;
  vus_semaine?: string[];
  /** Deja demande de l'argent aux parents cette semaine ? */
  argentParents?: boolean;
  /** Pour la prochaine seance : le conseil du coach, l'entrainement a deux (part de gain en plus). */
  conseil?: number;
  ensemble?: number;
  /** LE CORPS : la blessure en cours, la gene qui previent, les jours d'effort, l'echauffement fait. */
  blessureType?: TypeBlessure | null;
  gene?: TypeBlessure | null;
  charge?: number[];
  echauffe?: boolean;
  /** L'usure de chaque zone (0 a 100), le grade de la blessure en cours. */
  usure?: Record<Zone, number>;
  blessureGrade?: 1 | 2 | 3;
  /** LA SANTE (sante.ts) : ce que le medecin et l'imagerie ont dit, l'osteo de la semaine, le certificat de la saison. */
  diagnostic?: { type: TypeBlessure; grade?: 1 | 2 | 3; examen?: 'radio' | 'irm'; fracture?: boolean } | null;
  osteo?: boolean;
  certificat?: number;
  /** Une blessure jamais diagnostiquee prend une semaine de plus (une fois). */
  retard?: boolean;
  /** Les actions faites aujourd'hui (guide.ts) : remis a zero au reveil. */
  faitAujourdhui?: string[];
  /** Les nuits dormies en ville cette semaine : le tableau ne les repare pas une seconde fois. */
  nuits?: number;
  /** La garde-robe (garde-robe.ts) : les tenues possedees, et celle de chaque moment. */
  garde?: import('./garde-robe').GardeRobe;
  /** La semaine du dernier meeting couru : un par dimanche. */
  meeting?: number;
  /** Le departement declare (departements.ts) : ou l'on court ses departementaux et regionaux en direct. */
  departement?: string;
  /** Deja alle en cours aujourd'hui ? */
  cours?: boolean;
  /** Deja passe chez le kine, deja fait son footing cette semaine ? */
  kine?: boolean;
  footing?: boolean;
  /** Le corps et la tenue choisis a la creation (absent des sauvegardes d'avant : APPARENCE). */
  apparence?: Apparence;
  /** Ou l'athlete se tient dans la ville (ville.ts), entre deux visites. */
  position?: [number, number];
  /** Le dernier vrai championnat (id d'edition) couru ou declare forfait : on ne le court qu'une fois. */
  rendezVous?: string | null;
  /** Qualifie pour la demie ou la finale de ce dimanche : on la reprend sans repayer (carriere.ts). */
  tourAttendu?: { epreuve: Epreuve; tour: 'demie' | 'finale'; semaine: number };
  /** L'evenement qui attend une reponse, ou null. */
  evenement: string | null;
  vus: string[];
  journal: Ligne[];
  palmares: { s: number; niveau: number; epreuve: Course; place: number; chrono: number | null; meeting?: string }[];
  /** L'assiduite du cycle : seances proposees, seances faites. */
  assiduite: { proposees: number; faites: number };
  /** Les Grands Jeux courus (la semaine, l'epreuve, la place). */
  jeux?: { s: number; epreuve: Epreuve; place: number }[];
  /** Les Jeux viennent de se courir : le changement de discipline est propose (changerDeDiscipline). */
  apresJeux?: boolean;
  /** Les changements de discipline (la semaine, la nouvelle epreuve). */
  disciplines?: { s: number; epreuve: Epreuve }[];
};

/* ------------------------------------------------------------ les seances */

export const SEANCES: Record<Jour, { stat: Stat; secondaire: Stat; fatigue: number }> = {
  lundi:    { stat: 'vitesse',   secondaire: 'technique', fatigue: 18 },
  mercredi: { stat: 'force',     secondaire: 'vitesse',   fatigue: 22 },
  // l'endurance aussi le vendredi (le virage) : sans quoi le samedi, un bonus, devenait obligatoire pour monter
  vendredi: { stat: 'technique', secondaire: 'endurance', fatigue: 14 },
  samedi:   { stat: 'endurance', secondaire: 'force',     fatigue: 20 },
};

/* ------------------------------------------------------------ les exercices */

// DE VRAIS EXERCICES DE SPRINTEUR (l'auteur, 25/10 : « il faut qu'ils
// correspondent aux exercices d'athletisme », « seance de cotes, le kine,
// n'oublie rien »). Chacun a son mini-jeu (SeancesAthlete.tsx) et son lieu
// dans la ville : on va a la cote pour les cotes, a la salle du club pour la
// musculation, au parc quand on s'entraine seul.
export type Exercice =
  | 'departs' | 'lancee' | 'gammes' | 'virage' | 'cotes' | 'muscu'
  | 'bonds' | 'gainage' | 'fractionne' | 'tempo';

/** Le programme d'un entraineur : chaque jour tourne sur ses exercices, semaine apres semaine. */
export const PROGRAMME: Record<Jour, Exercice[]> = {
  lundi: ['departs', 'lancee', 'departs'],
  mercredi: ['cotes', 'muscu', 'bonds'],
  vendredi: ['gammes', 'virage', 'gainage'],
  samedi: ['fractionne', 'tempo', 'fractionne'],
};
/** Seul, sans entraineur : ce qu'on trouve a faire au parc et a la cote. */
export const SEUL: Record<Jour, Exercice> = { lundi: 'lancee', mercredi: 'cotes', vendredi: 'gammes', samedi: 'tempo' };

export function exerciceDuJour(a: Athlete, j: Jour): Exercice {
  if (!a.coach) return SEUL[j];
  const l = PROGRAMME[j];
  return l[a.semaine % l.length];
}

/** Ou se fait l'exercice : un lieu de la ville (ville.ts). */
export function lieuDeLExercice(a: Athlete, ex: Exercice): 'stade' | 'cote' | 'parc' | 'club_quartier' | 'club_horizon' {
  if (ex === 'cotes') return 'cote';
  if (!a.club) return 'parc';
  if (ex === 'muscu') return a.club === 'horizon' ? 'club_horizon' : 'club_quartier';
  return 'stade';
}

/* ------------------------------------------------------------ le soin */

/** Le kine : une seance par semaine, moitie prise par le club. */
export const KINE = 40;
// la part de l'athlete selon sa categorie (statutDe, plus bas) ; le kine n'est pas rembourse
export const prixDuKine = (a: Athlete) => deTaPoche(a, KINE, false);

/**
 * Une seance chez le kine : la fatigue tombe, une blessure guerit d'une
 * semaine plus vite. Rend la raison si ce n'est pas possible.
 */
export function chezLeKine(a: Athlete): null | 'fait' | 'argent' {
  if (a.kine) return 'fait';
  const p = prixDuKine(a);
  if (a.argent < p) return 'argent';
  payer(a, -p, 'Kiné', 'Physio');
  a.kine = true;
  a.fatigue = borne(a.fatigue - 25, 0, 100);
  if (a.blessure > 0) a.blessure -= 1;
  // le kine s'occupe de la zone la plus usee : une gene prise a temps ne devient pas une blessure
  const gene = a.gene;
  soulager(a, 22, true);
  if (gene && !a.gene) noter(a, 'Le kiné a traité la gêne à temps.', 'The physio caught the niggle in time.');
  noter(a, 'Chez le kiné : massage, étirements, le corps respire.', 'At the physio: massage, stretching, the body breathes.');
  return null;
}

/** Le footing de recuperation au parc : gratuit, une fois par semaine. */
export function footingAuParc(a: Athlete): boolean {
  if (a.footing || a.blessure > 0) return false;
  a.footing = true;
  a.fatigue = borne(a.fatigue - 12, 0, 100);
  soulager(a, 5);
  a.moral = borne(a.moral + 4, 0, 100);
  return true;
}

/** Les qualites qui font chaque epreuve : le specialiste y gagne plus vite. */
export const CLES_EPREUVE: Record<Epreuve, Stat[]> = {
  '100': ['vitesse', 'force'],
  '200': ['vitesse', 'endurance'],
  '400': ['endurance', 'vitesse'],
};

/* ------------------------------------------------------------ le materiel */

export type Piece = {
  id: string;
  prix: number;
  /** Points ajoutes aux stats EN COURSE seulement. */
  course?: Partial<Record<Stat, number>>;
  /** Seance dont le gain monte de 15 %. */
  seance?: Jour;
  /** Fatigue en moins chaque fin de semaine. */
  recup?: number;
  /** Remplace une autre piece (les pointes montent en gamme). */
  remplace?: string;
  /** Toutes les seances +x (0,05 = 5 %). */
  toutes?: number;
  /** Il faut un club (maillot, survetement du club). */
  club?: boolean;
  /**
   * L'USURE (24/11, l'auteur : « ajoute de l'usure sur les objets ») : le nombre d'utilisations avant d'etre use —
   * une course pour ce qui sert en course, la seance du jour pour un outil, toute seance pour les chaussures,
   * une semaine pour la recuperation. Usee, la piece ne donne plus rien ; on la rachete au meme prix.
   */
  duree: number;
};

export const MATERIEL: Piece[] = [
  { id: 'pointes1', prix: 60, course: { vitesse: 3 }, duree: 12 },
  { id: 'pointes2', prix: 180, course: { vitesse: 6, technique: 2 }, remplace: 'pointes1', duree: 10 },
  { id: 'pointes3', prix: 450, course: { vitesse: 9, technique: 4 }, remplace: 'pointes2', duree: 8 },
  { id: 'tenue', prix: 70, course: { endurance: 2 }, duree: 20 },
  { id: 'maillot_club', prix: 35, course: { technique: 1 }, club: true, duree: 25 },
  { id: 'survet_club', prix: 60, recup: 5, club: true, duree: 30 },
  { id: 'baskets', prix: 55, toutes: 0.05, duree: 40 },
  { id: 'elastiques', prix: 25, seance: 'mercredi', duree: 20 },
  { id: 'traineau', prix: 110, seance: 'mercredi', duree: 60 },
  { id: 'plots', prix: 20, seance: 'vendredi', duree: 30 },
  { id: 'haies_basses', prix: 40, seance: 'vendredi', duree: 40 },
  { id: 'montre', prix: 90, seance: 'samedi', duree: 80 },
  { id: 'starting', prix: 140, seance: 'lundi', course: { force: 2 }, duree: 50 },
  { id: 'gilet', prix: 65, seance: 'lundi', duree: 40 },
  { id: 'rouleau', prix: 15, recup: 6, duree: 20 },
  { id: 'recup', prix: 120, recup: 15, duree: 40 },
];

export const piece = (id: string) => MATERIEL.find(p => p.id === id) || null;
/** L'usure d'une piece possedee, de 0 a 100. */
export const usureDuMateriel = (a: Athlete, id: string) => a.usureMat?.[id] ?? 0;
/** La piece sert-elle encore ? Usee a 100 %, elle ne donne plus rien. */
export const enEtat = (a: Athlete, id: string) => a.materiel.includes(id) && usureDuMateriel(a, id) < 100;
/** Une utilisation de plus pour chaque piece possedee qui repond a `sert`. */
export function user(a: Athlete, sert: (p: Piece) => boolean) {
  for (const id of a.materiel) {
    const p = piece(id);
    if (!p || !sert(p) || !enEtat(a, id)) continue;
    const u = usureDuMateriel(a, id) + 100 / p.duree;
    (a.usureMat ||= {})[id] = u > 99.9 ? 100 : u;   // 12 fois 100/12 ne tombe pas pile sur 100 en flottants
  }
}
/** Le gain des seances apporte par le materiel en etat, le jour `j` : +15 % par outil du jour, chaussures comprises, 30 % au plus. */
export function outilDuJour(a: Athlete, j: Jour) {
  let b = 0;
  for (const id of a.materiel) {
    const p = piece(id);
    if (p && enEtat(a, id)) b += (p.seance === j ? 0.15 : 0) + (p.toutes || 0);
  }
  return 1 + Math.min(0.3, b);
}

/* ------------------------------------------------------- les petits boulots */

/** `adulte` : la paie d'un adulte, qui a un loyer (LOYER) ; deux boulots le paient et laissent de quoi courir. */
export type Boulot = { id: string; gain: number; adulte: number; fatigue: number; prend: Jour | null };

export const BOULOTS: Boulot[] = [
  { id: 'babysitting', gain: 30, adulte: 70, fatigue: 3, prend: null },
  { id: 'livraison', gain: 45, adulte: 90, fatigue: 12, prend: null },
  { id: 'marche', gain: 60, adulte: 110, fatigue: 8, prend: 'samedi' },
];
/** Ce que rapporte ce boulot a cet athlete. */
export const paieDu = (a: Athlete, b: Boulot) => (etape(a) === 'adulte' ? b.adulte : b.gain);

/* ---------------------------------------------------------- les competitions */

export type Competition = {
  cle: string;
  /** Le plateau du moteur (LEVELS) : scolaire, regional, national... */
  plateau: number;
  deplacement: number;
  prime: number;
  reputation: number;
  /** Semaines jusqu'a la suivante : le local revient vite, le national se prepare. */
  ecart: number;
  /** Le plafond des qualites a ce niveau : on ne s'entraine pas au-dela de sa marche. */
  plafond: number;
  /** Les chronos du plateau, par epreuve, quand aucun plateau du moteur ne convient. */
  chronos?: Record<string, [number, number]>;
};

/** La moyenne des quatre qualites. */
export const moyenneDes = (a: Athlete) => STATS.reduce((s, k) => s + a.stats[k], 0) / STATS.length;
/** La moyenne qu'il faut pour monter d'un niveau : 85 % du plafond du sien (l'endurance, seance du samedi, monte moins vite). */
// 85 % du plafond, 90 % a partir des France (15/11 : l'adulte montait aux Mondes en une saison)
export const exigePourMonter = (niveau: number) => Math.round(COMPETITIONS[niveau].plafond * (niveau >= NATIONAL ? 0.9 : 0.85));
/** Les stats sont-elles pretes pour le niveau suivant ? (le podium fait le reste) */
export const pretPourLaSuite = (a: Athlete) => moyenneDes(a) >= exigePourMonter(a.niveau);

export const COMPETITIONS: Competition[] = [
  { cle: 'scolaire', plateau: 0, deplacement: 0, prime: 0, reputation: 5, ecart: 2, plafond: 30 },
  // Entre le scolaire (12,50-15,00) et les regionaux (11,20-12,50) : aucun
  // plateau du moteur n'y tombe, la marche se donne ses chronos.
  { cle: 'departementaux', plateau: 0, deplacement: 15, prime: 0, reputation: 8, ecart: 2, plafond: 45,
    chronos: { '100': [11.80, 13.40], '200': [23.60, 27.00], '400': [51.00, 57.00] } },
  { cle: 'regionaux', plateau: 1, deplacement: 40, prime: 0, reputation: 12, ecart: 2, plafond: 60 },
  // ALLONGER LA CARRIERE (l'auteur, 15/11 : « en moins d'une semaine c'est boucle […] minimum 1 mois ») : les grands
  // championnats s'espacent (4 semaines partout jusque-la) : on s'y prepare.
  { cle: 'france', plateau: 2, deplacement: 150, prime: 400, reputation: 30, ecart: 6, plafond: 75 },
  { cle: 'europe', plateau: 3, deplacement: 600, prime: 1500, reputation: 70, ecart: 8, plafond: 90 },
  { cle: 'monde', plateau: 4, deplacement: 1500, prime: 5000, reputation: 160, ecart: 12, plafond: 100 },
  // Les Grands Jeux, tous les quatre saisons (voir JEUX) : `ecart` n'y sert pas, la date est fixe.
  { cle: 'jeux', plateau: 4, deplacement: 2500, prime: 12000, reputation: 320, ecart: 12, plafond: 100 },
];

/**
 * LES 0.GAMES (l'auteur, 15/11 : « d'autres etapes apres les Mondes, genre JO », puis « pouvoir
 * changer de discipline apres les J.O »). Nom generique : « Jeux olympiques », « olympique » et
 * « olympiade » sont proteges en France (Code du sport, art. L141-5), comme on ne cite pas la FFA.
 * Tous les quatre saisons (la 4e, la 8e…), la semaine 30 de la saison, en ete. La selection se joue
 * aux Mondes de cette saison-la, avant les Jeux : un podium, les stats pretes. Les autres saisons,
 * les Mondes rapportent le titre et la prime, sans monter. Les Jeux courus, on redescend aux Mondes
 * et l'on peut changer de discipline.
 */
export const MONDE = 5, JEUX = 6;
export const SEMAINE_DES_JEUX = 30;
/** La moyenne des qualites qu'il faut, avec un podium aux Mondes, pour etre selectionne·e. */
export const SELECTION_JEUX = 85;
/** La saison (0, 1, 2…) de la semaine `s`. */
export const saisonDe = (s: number) => Math.floor((s - 1) / SAISON);
/** La saison de la semaine `s` est-elle celle des Jeux ? */
export const anneeDesJeux = (s: number) => saisonDe(s) % 4 === 3;
/** La semaine des prochains Jeux, a partir de la semaine `s` (comprise). */
export function semaineDesProchainsJeux(s: number): number {
  for (let k = saisonDe(s); ; k++) {
    const w = k * SAISON + SEMAINE_DES_JEUX + 1;
    if (k % 4 === 3 && w >= s) return w;
  }
}

/** Le niveau vise par chaque objectif du programme. */
export const NIVEAU_OBJECTIF: Record<Objectif, number> = { france: 3, europe: 4, monde: 5 };
/** Le premier niveau national : la ou les abonnes et les medias arrivent. */
export const NATIONAL = 3;

/** Semaines avant la competition suivante, au niveau `niveau`. */
export const ecart = (niveau: number) => COMPETITIONS[Math.min(niveau, COMPETITIONS.length - 1)].ecart;
/** Les trois premiers passent au niveau du dessus. */
export const QUALIFIES = 3;

/* ------------------------------------------------------------ les clubs */

export type Club = { id: string; licence: number; coach: string; gratuitPourModeste: boolean; bonus: number };

// DES NOMS INVENTES, EN ATTENDANT DES PARTENAIRES. L'idee est d'y mettre de
// vrais clubs et de vrais coachs, avec leur accord ecrit (docs/carriere-athlete.md).
export const CLUBS: Club[] = [
  { id: 'horizon', licence: 220, coach: 'mireille', gratuitPourModeste: false, bonus: 1.3 },
  { id: 'quartier', licence: 90, coach: 'dede', gratuitPourModeste: true, bonus: 1.2 },
];
export const club = (id: string | null) => CLUBS.find(c => c.id === id) || null;

/* ------------------------------------------------------------ l'apparence */

// Ce que le moteur sait dessiner (look, sprinter-core.js) : les memes corps,
// peaux et coiffures que les coureurs du jeu. Le personnage de la ville est
// celui qui court les competitions.
export const CORPS = ['f', 'm'] as const;
export const PEAUX = ['ebene', 'cacao', 'acajou', 'noisette', 'bronze', 'ambre', 'miel', 'olive', 'sable', 'clair', 'porcelaine'] as const;
export const COIFFURES = ['crop', 'fade', 'ras', 'flattop', 'twists', 'braids', 'ponytail', 'bun', 'shaved'] as const;
export const CHEVEUX = ['noir', 'brun', 'chatain', 'blond', 'roux', 'gris'] as const;
export const COULEURS: [number, number, number][] = [
  [61, 220, 132], [80, 140, 230], [236, 72, 96], [248, 205, 74],
  [167, 139, 250], [251, 146, 60], [45, 212, 191], [240, 240, 246],
];
export type Apparence = {
  corps: typeof CORPS[number];
  peau: typeof PEAUX[number];
  coiffure: typeof COIFFURES[number];
  cheveux: typeof CHEVEUX[number];
  /** La taille en metres, de 1,55 a 2,00. */
  taille: number;
  /** L'index dans COULEURS : le maillot en course, le haut en ville. */
  couleur: number;
  /** Les traits du visage et du corps (corps-gens.ts) ; absent des sauvegardes d'avant : d'apres la peau. */
  origine?: Traits;
};
export const APPARENCE: Apparence = { corps: 'f', peau: 'miel', coiffure: 'ponytail', cheveux: 'chatain', taille: 1.72, couleur: 0 };

/* ------------------------------------------------------------ outils */

const borne = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rond = (v: number) => Math.round(v * 10) / 10;

/**
 * Tout mouvement d'argent passe par ici : le solde, et une ligne au releve de
 * la banque (le telephone). `m` positif : on recoit ; negatif : on paie.
 */
export function payer(a: Athlete, m: number, fr: string, en: string) {
  if (!m) return;
  a.argent += m;
  (a.compte ||= []).unshift({ s: a.semaine, j: a.jour ?? 0, m, fr, en });
  if (a.compte.length > 40) a.compte.length = 40;
}

/** L'age fait la categorie d'age de l'athletisme (une par saison). Jamais presentee comme celle d'une federation : l'auteur n'a pas de contrat avec la FFA (25/10). */
export const SAISON = 36;
export type Etape = 'college' | 'lycee' | 'adulte';
/** L'etape de vie : le college jusqu'a 14 ans, le lycee jusqu'a 17, la vie active ensuite. */
export const etape = (a: Athlete): Etape => ((a.age ?? 14) <= 14 ? 'college' : (a.age ?? 14) <= 17 ? 'lycee' : 'adulte');
export const LOYER = 110;
export const SALAIRE = 65;

/**
 * GRANDIR (lot 3 de l'audit, accepte par l'auteur le 15/11) : le plus haut championnat ouvert a
 * chaque categorie d'age. Benjamin et Minime : les regionaux ; Cadet : les France ; Junior et
 * Espoir : l'Europe ; Senior : le Monde. Un podium au plafond de sa categorie attend l'anniversaire.
 * Une sauvegarde deja plus haut garde son niveau : on ne redescend jamais.
 */
export const niveauMaxDe = (age: number) => (age <= 15 ? 2 : age <= 17 ? 3 : age <= 22 ? 4 : 6);
/** L'age ou la categorie ouvre le niveau au-dessus de `niveau` (null au sommet). */
export function ageQuiOuvre(niveau: number): number | null {
  for (let age = 10; age <= 40; age++) if (niveauMaxDe(age) > niveau) return age;
  return null;
}

/**
 * LA SAISON EN SALLE : les semaines 13 a 24 de chaque saison de 36 (decembre a fevrier si la
 * saison part en septembre, comme la saison d'athletisme). Hors de la, pas de meeting en salle.
 */
export const semaineDeSaison = (a: Athlete) => (((a.semaine - 1) % SAISON) + SAISON) % SAISON;
export const SALLE_DEBUT = 12, SALLE_FIN = 24;
export const saisonEnSalle = (a: Athlete) => semaineDeSaison(a) >= SALLE_DEBUT && semaineDeSaison(a) < SALLE_FIN;
/** Semaines avant la prochaine saison en salle (0 pendant). */
export const semainesAvantLaSalle = (a: Athlete) => (saisonEnSalle(a) ? 0 : (SALLE_DEBUT - semaineDeSaison(a) + SAISON) % SAISON);

export function categorie(age: number): [string, string] {
  if (age <= 13) return ['Benjamin', 'Under-14'];
  if (age <= 15) return ['Minime', 'Under-16'];
  if (age <= 17) return ['Cadet', 'Under-18'];
  if (age <= 19) return ['Junior', 'Under-20'];
  if (age <= 22) return ['Espoir', 'Under-23'];
  if (age >= 35) return ['Master', 'Masters'];
  return ['Senior', 'Senior'];
}

export function noter(a: Athlete, fr: string, en: string) {
  a.journal.unshift({ s: a.semaine, fr, en });
  if (a.journal.length > 40) a.journal.length = 40;
}

/* ------------------------------------------------------------ la naissance */

export function nouvelAthlete(nom: string, origine: Origine, voie: Voie, specialite: Epreuve | null,
                             apparence: Apparence = APPARENCE, age = 14): Athlete {
  const aisee = origine === 'aisee';
  // un adulte a un peu d'argent de cote, et ne passe plus par le scolaire
  const adulte = age >= 18;
  const a: Athlete = {
    v: 2,
    nom: nom || 'TOI',
    origine,
    voie,
    specialite: voie === 'specialiste' ? (specialite || '100') : null,
    apparence: { ...apparence },
    // LES STATS PARTENT DE ZERO, a tout age (l'auteur, 26/10 : « stats de base trop elevees »)
    stats: { vitesse: 0, force: 0, technique: 0, endurance: 0 },
    argent: adulte ? (aisee ? 900 : 150) : aisee ? 600 : 20,
    fatigue: 0,
    moral: 70,
    blessure: 0,
    semaine: 1,
    faites: [],
    boulots: [],
    club: null,
    coach: null,
    objectif: null,
    // Une famille aisee equipe son enfant des le premier jour.
    materiel: aisee ? ['pointes1', 'tenue'] : [],
    niveau: adulte ? 1 : 0,
    prochaine: 3,
    reputation: 0,
    abonnes: 0,
    relations: { coach: 0, club: 0, rival: 0 },
    sponsors: [],
    chapitre: 'debut',
    evenement: 'intro',
    vus: [],
    journal: [],
    palmares: [],
    assiduite: { proposees: 0, faites: 0 },
    jour: 0,
    heure: 7 * 60,
    besoins: { energie: 90, faim: 80, hygiene: 90, social: 70, plaisir: 70 },
    ecole: 60,
    age,
    compte: [],
    messages: [],
    records: {},
  };
  // l'histoire commence par le prof d'EPS au college ; a l'age adulte, elle commence sans lui
  if (adulte) a.evenement = null;
  return a;
}

/* ------------------------------------------------------------ s'entrainer */

/** Une seance est-elle possible aujourd'hui ? Rend la raison sinon. */
export function seancePossible(a: Athlete, j: Jour): null | 'faite' | 'blesse' | 'boulot' {
  if (a.blessure > 0) return 'blesse';
  if (a.faites.includes(j)) return 'faite';
  if (BOULOTS.some(b => b.prend === j && boulotFait(a, b.id))) return 'boulot';
  return null;
}

/** Ce que rapporte une qualite a ce niveau : plus elle est haute, moins on y gagne. */
// Plus on monte, plus chaque point coute : au-dessus de 50, le frein s'ajoute (15/11, carriere bouclee en une
// semaine par un testeur : 100 partout en 106 semaines) ; a 77, un gain vaut le tiers d'avant, a 90 le cinquieme.
const reste = (v: number) => Math.max(0.08, 1 - v / 115) * (v <= 50 ? 1 : Math.max(0.12, Math.pow((105 - v) / 55, 1.5)));

/**
 * Le gain d'une seance, sans l'appliquer. `score` : la qualite de la seance,
 * de 0 a 1 (le mini-jeu). Une seance ratee rend quand meme un peu : on est
 * venu, on a couru.
 */
export function gainDeSeance(a: Athlete, j: Jour, score: number, bonus = 0): Partial<Record<Stat, number>> {
  const s = SEANCES[j];
  // bien jouer compte : sous 40 % de reussite, la seance ne rapporte presque rien (lot 3 de l'audit)
  const sc = borne(score, 0, 1), q = sc < 0.4 ? 0.1 : sc;
  const c = club(a.club);
  const encadrement = a.coach && c ? c.bonus : 1;
  const forme = 1 - Math.max(0, a.fatigue - 50) / 100;
  const outil = outilDuJour(a, j);
  const moral = 0.85 + 0.3 * (a.moral / 100);
  // 2,5 (7 jusqu'au 15/11 : champion du monde en moins d'une saison) : avec le plafond par age
  // (niveauMaxDe), une carriere de 14 ans au sommet dure environ six saisons
  const base = 2.5 * q * encadrement * forme * outil * moral * formeDuJour(a) * (1 + bonus);
  const cles = a.specialite ? CLES_EPREUVE[a.specialite] : [];
  const spe = (st: Stat) => (a.voie === 'specialiste' && cles.includes(st) ? 1.2 : 1);
  // Le polyvalent gagne moins vite sur l'essentiel mais plus sur le reste.
  const part2 = a.voie === 'polyvalent' ? 0.5 : 0.3;
  return {
    [s.stat]: rond(base * spe(s.stat) * reste(a.stats[s.stat])),
    [s.secondaire]: rond(base * part2 * spe(s.secondaire) * reste(a.stats[s.secondaire])),
  };
}

export type Seance = { gains: Partial<Record<Stat, number>>; blessure: boolean; type?: TypeBlessure; gene?: TypeBlessure };

/**
 * Faire la seance du jour `j` avec ce score. S'entrainer epuise expose a la
 * blessure : au-dessus de 85 de fatigue, une chance sur trois de s'arreter
 * deux semaines — et la seance ne rapporte rien.
 */
export function faireLaSeance(a: Athlete, j: Jour, score: number, alea: () => number, bonus = 0): Seance | null {
  if (seancePossible(a, j)) return null;
  a.faites.push(j);
  if (j !== 'samedi') a.assiduite.faites += 1;
  // le corps : la charge, la fatigue, l'energie decident du risque (voir « le corps »)
  const corps = tirerLeCorps(a, exerciceDuJour(a, j));
  if (corps.blessure) return { gains: {}, blessure: true, type: corps.blessure };
  const gains = gainDeSeance(a, j, score, bonus);
  user(a, p => p.seance === j || !!p.toutes);
  // Au plafond du niveau, la seance entretient sans faire monter : c'est la competition qui ouvre la suite.
  const plafond = COMPETITIONS[a.niveau].plafond;
  for (const k of Object.keys(gains) as Stat[]) {
    const v = Math.max(a.stats[k], borne(rond(a.stats[k] + (gains[k] || 0)), 0, plafond));
    gains[k] = rond(v - a.stats[k]);
    a.stats[k] = v;
  }
  a.fatigue = borne(a.fatigue + SEANCES[j].fatigue, 0, 100);
  if (a.besoins) avancer(a, DUREE_SEANCE, { energie: -18, faim: -12, hygiene: -40 });
  return { gains, blessure: false, gene: corps.gene };
}

/* ------------------------------------------------------------ l'argent */

/** Deux boulots par semaine au plus : le dimanche reste aux competitions. */
export const BOULOTS_PAR_SEMAINE = 2;
/** Ce boulot est-il deja fait cette semaine ? */
export const boulotFait = (a: Athlete, id: string) => !!a.boulots?.includes(id);

export function prendreUnBoulot(a: Athlete, id: string): boolean {
  const b = BOULOTS.find(x => x.id === id);
  if (!b || boulotFait(a, id) || (a.boulots?.length || 0) >= BOULOTS_PAR_SEMAINE) return false;
  if (b.prend && a.faites.includes(b.prend)) return false;
  (a.boulots ||= []).push(id);
  payer(a, paieDu(a, b), 'Petit boulot', 'Side job');
  a.fatigue = borne(a.fatigue + b.fatigue, 0, 100);
  return true;
}

/** Peut-on acheter cette piece ? Rend la raison sinon. */
export function achatPossible(a: Athlete, id: string): null | 'possede' | 'argent' | 'avant' | 'club' | 'inconnu' {
  const p = piece(id);
  if (!p) return 'inconnu';
  if (p.club && !a.club) return 'club';
  // usee, une piece se rachete ; remplacee par mieux, elle ne se rachete plus
  if (enEtat(a, id) || MATERIEL.some(q => q.remplace === id && a.materiel.includes(q.id))) return 'possede';
  if (p.remplace && !a.materiel.includes(p.remplace) && !a.materiel.includes(id)) return 'avant';
  if (a.argent < prixDuMateriel(a, p.prix)) return 'argent';
  return null;
}

export function acheter(a: Athlete, id: string): boolean {
  if (achatPossible(a, id)) return false;
  const p = piece(id)!;
  payer(a, -prixDuMateriel(a, p.prix), 'Matériel', 'Kit');
  if (p.remplace) a.materiel = a.materiel.filter(x => x !== p.remplace);
  if (!a.materiel.includes(id)) a.materiel.push(id);
  if (a.usureMat) delete a.usureMat[id];
  return true;
}

/** Les points de materiel ajoutes aux stats en course. */
export function bonusMateriel(a: Athlete): Record<Stat, number> {
  const b: Record<Stat, number> = { vitesse: 0, force: 0, technique: 0, endurance: 0 };
  for (const id of a.materiel) {
    const p = piece(id);
    if (p && p.course && enEtat(a, id)) for (const k of Object.keys(p.course) as Stat[]) b[k] += p.course[k] || 0;
  }
  return b;
}

/* ----------------------------------------------- les quatre categories d'athletes */

/**
 * LES QUATRE CATEGORIES (video envoyee par l'auteur le 15/11 : « les 4 categories d'athletes de
 * haut niveau ») : ce qui separe les athletes, c'est QUI PAIE LEUR SPORT, et ils courent pourtant
 * les memes competitions pour les memes objectifs.
 *  1. Professionnel·le : le sport est son metier (contrat, aides) ; il ou elle s'y consacre a 110 %.
 *  2. Soutenu·e : le sport fait 50 a 70 % de ses revenus, mais pas de quoi s'y donner a 100 %.
 *  3. Aide·e : 30 a 40 % de la saison sort de sa poche, le reste vient du club ou d'un sponsor ;
 *     un travail alimentaire a cote.
 *  4. Laisse·e pour compte : le travail paie la vie ET 100 % du sport (materiel, deplacements, soins).
 * La categorie se deduit de ce que l'athlete a obtenu : club, sponsors, niveau. Rien n'est tire au hasard.
 */
export type Statut = 1 | 2 | 3 | 4;
export const STATUTS: Record<Statut, { nom: [string, string]; phrase: [string, string] }> = {
  1: { nom: ['professionnel·le', 'professional'], phrase: ['Ton sport est ton métier : tu peux t’y donner à 110 %.', 'Your sport is your job: you can give it 110%.'] },
  2: { nom: ['soutenu·e', 'supported'], phrase: ['Le sport fait plus de la moitié de tes revenus, mais pas de quoi t’y consacrer à 100 %.', 'Sport is over half your income, but not enough to commit 100%.'] },
  3: { nom: ['aidé·e', 'helped'], phrase: ['Club et sponsor paient une partie : 35 % de ta saison sort de ta poche, il te faut un travail à côté.', 'Club and sponsor cover part: 35% of your season comes out of your pocket, you need a job on the side.'] },
  4: { nom: ['laissé·e pour compte', 'left behind'], phrase: ['Ton travail paie ta vie ET 100 % de ton sport : matériel, déplacements, soins.', 'Your job pays for your life AND 100% of your sport: kit, travel, care.'] },
};
/* ------------------------------------------------------------ les sponsors */

/**
 * LES SPONSORS (24/11, l'auteur : « plusieurs sponsors, être réaliste : un athlète en 12 secondes ne peut pas avoir de
 * sponsor, sauf s'il gère très très bien ses réseaux ou s'il est très jeune »). Plusieurs a la fois, un de chaque sorte,
 * quatre au plus. Aucun ne vient au-dessus de 10"80 au 100 m (11"90 pour une femme), sauf avec 20 000 abonnes, ou a
 * 15 ans et moins avec un chrono rare pour son age. Les noms sont INVENTES, comme les clubs.
 */
export type Sponsor = {
  id: string;
  nom: [string, string];
  /** Ce qu'il verse chaque semaine. */
  paie: number;
  /** Ce qu'il demande en plus du niveau de base. */
  exige: (a: Athlete) => boolean;
  /** Les pointes qu'il fournit. */
  pointes?: 'pointes2' | 'pointes3';
  abonnes: number;
};
export const SPONSORS_MAX = 4;
/** Le record au 100 m, ou rien. */
const rec100 = (a: Athlete) => a.records?.['100'] ?? null;
const femme = (a: Athlete) => a.apparence?.corps === 'f';
/** Le chrono qu'un sponsor attend : homme, femme. */
const sous = (a: Athlete, h: number, f: number) => { const r = rec100(a); return r !== null && r <= (femme(a) ? f : h); };
/** Le seuil de base : un vrai niveau, des reseaux tres suivis, ou un tres jeune talent. */
export function sponsorisable(a: Athlete) {
  return sous(a, 10.8, 11.9) || a.abonnes >= 20000 || ((a.age ?? 99) <= 15 && sous(a, 11.6, 12.6));
}
export const SPONSORS: Sponsor[] = [
  { id: 'magasin', nom: ['Le magasin de sport du coin', 'The local sports shop'], paie: 40, abonnes: 100, exige: a => a.reputation >= 15 },
  { id: 'equipementier', nom: ['Un équipementier régional', 'A regional kit brand'], paie: 60, abonnes: 300, pointes: 'pointes2', exige: a => a.reputation >= 30 },
  { id: 'nutrition', nom: ['Une marque de boisson pour sportifs', 'A sports drink brand'], paie: 50, abonnes: 500, exige: a => a.abonnes >= 5000 },
  { id: 'banque', nom: ['Une banque régionale', 'A regional bank'], paie: 80, abonnes: 400, exige: a => a.niveau >= NATIONAL && a.reputation >= 60 },
  { id: 'marque', nom: ['Une grande marque de sport', 'A major sports brand'], paie: 120, abonnes: 2000, pointes: 'pointes3', exige: a => a.reputation >= 90 && sous(a, 10.3, 11.3) },
];
export const sponsor = (id: string) => SPONSORS.find(s => s.id === id) || null;
/** Ce sponsor peut-il faire une offre ? */
export const sponsorPossible = (a: Athlete, s: Sponsor) =>
  !a.sponsors.includes(s.id) && a.sponsors.length < SPONSORS_MAX && sponsorisable(a) && s.exige(a);
/** Signer : la paie chaque semaine, les abonnes, les pointes promises (sans reprendre une meilleure paire). */
export function signer(a: Athlete, id: string) {
  const s = sponsor(id);
  if (!s || a.sponsors.includes(id)) return;
  a.sponsors.push(id);
  a.abonnes += s.abonnes;
  const rang = (x: string) => ['pointes1', 'pointes2', 'pointes3'].indexOf(x);
  if (s.pointes && !a.materiel.some(x => rang(x) >= rang(s.pointes!))) {
    a.materiel = a.materiel.filter(x => !x.startsWith('pointes'));
    a.materiel.push(s.pointes);
  }
  // les pointes fournies sont neuves
  if (s.pointes && a.usureMat) for (const k of Object.keys(a.usureMat)) if (k.startsWith('pointes')) delete a.usureMat[k];
}
/** Ce que versent les sponsors chaque semaine. */
export const paieDesSponsors = (a: Athlete) => a.sponsors.reduce((t, id) => t + (sponsor(id)?.paie ?? 60), 0);

export function statutDe(a: Athlete): Statut {
  const s = a.sponsors.length;
  if (s >= 2 && a.niveau >= 4) return 1;            // deux contrats et l'Europe : on vit du sport
  if (s >= 1 && a.niveau >= NATIONAL) return 2;     // un sponsor au niveau national, et les aides qui vont avec
  if (s >= 1 || a.club) return 3;
  return 4;
}
/** La part de ses depenses de sport que l'athlete paie lui-meme, par categorie. */
export const PART_DE_TA_POCHE: Record<Statut, number> = { 1: 0, 2: 0.1, 3: 0.35, 4: 1 };
/** Les parents aises d'un mineur paient sa part ; sinon, `prix` × sa part. */
export const deTaPoche = (a: Athlete, prix: number, parents = true) =>
  parents && etape(a) !== 'adulte' && a.origine === 'aisee' ? 0 : Math.round(prix * PART_DE_TA_POCHE[statutDe(a)]);
/** Ce que le sport rapporte chaque semaine : un salaire en categorie 1, sponsors et aides ensuite. */
export function revenuDuSport(a: Athlete): number {
  const st = statutDe(a);
  return Math.max(st === 1 ? 300 : st === 2 ? 150 : 0, paieDesSponsors(a));
}
/** En categorie 1, le sport est le metier : plus d'obligation d'aller au travail. */
export const vitDuSport = (a: Athlete) => statutDe(a) === 1;

/** Ce que coute le deplacement a l'athlete, apres parents, club et sponsors (sa categorie). */
export function coutDuDeplacement(a: Athlete, niveau: number): number {
  const c = COMPETITIONS[borne(niveau, 0, COMPETITIONS.length - 1)];
  return deTaPoche(a, c.deplacement);
}
/** Le materiel : fourni en partie selon la categorie (les parents ne l'achetent pas). */
export const prixDuMateriel = (a: Athlete, prix: number) => deTaPoche(a, prix, false);

/* ------------------------------------------------------------ la course */

export type Reglages = { vitesse: number; boost: number; drag: number; chute: number };

/** Le programme a-t-il ete suivi assez pour un pic de forme a cette competition ? */
export function picDeForme(a: Athlete, niveau: number): boolean {
  if (!a.objectif || NIVEAU_OBJECTIF[a.objectif] !== niveau) return false;
  const { proposees, faites } = a.assiduite;
  return proposees >= 6 && faites / proposees >= 0.75;
}

/**
 * LA VITESSE SUIT LES STATS (l'auteur, 26/10 : « stats a zero, le personnage court en 12"50 ;
 * 100 % des stats = la vitesse max du jeu par rapport au nombre de frappes, comme dans le jeu
 * principal »). Carriere seulement : ces reglages ne servent qu'a ses courses
 * (carriere.ts, G.reglagesJoueur), dont les chronos ne vont jamais au classement du jeu.
 * A 0, chaque qualite bride son reglage (A_ZERO, mesure dans le moteur : 12"42 au 100 m a
 * 10 appuis/s, 12"90 a 8/s, 24"90 au 200, 51"12 au 400) ; a 100, tous valent 1 — le coureur
 * du jeu principal, que seule la frequence des appuis fait aller plus vite.
 */
export const A_ZERO = { vitesse: 0.72, boost: 0.9, drag: 1.1, chute: 1.2 };

/** Les coefficients poses sur le coureur du joueur (G.reglagesJoueur, lu par buildLevel). */
export function reglages(a: Athlete, niveau: number): Reglages {
  const m = bonusMateriel(a);
  // le pic de forme compte comme 10 points de vitesse ; rien ne depasse 100 %
  const pic = picDeForme(a, niveau) ? 10 : 0;
  const vers = (zero: number, k: Stat, plus = 0) => zero + (1 - zero) * borne(a.stats[k] + m[k] + plus, 0, 100) / 100;
  const forme = a.fatigue > 60 ? -0.03 * (a.fatigue - 60) / 40 : 0;
  return {
    vitesse: rond5(vers(A_ZERO.vitesse, 'vitesse', pic) + forme),
    boost: rond5(vers(A_ZERO.boost, 'force')),
    drag: rond5(vers(A_ZERO.drag, 'endurance')),
    chute: rond5(vers(A_ZERO.chute, 'technique')),
  };
}
function rond5(v: number) { return Math.round(v * 1e5) / 1e5; }

export type Resultat = {
  niveau: number;
  epreuve: Course;
  place: number;
  chrono: number | null;
  qualifie: boolean;
  prime: number;
  reputation: number;
  /** Champion·ne des Grands Jeux ? */
  sommet: boolean;
  /** Champion·ne du monde ? */
  mondial?: boolean;
  /** Selectionne·e pour les Grands Jeux par ce podium aux Mondes. */
  selection?: boolean;
  /** Une course des Grands Jeux. */
  jeux?: boolean;
  /** Semaines jusqu'aux prochains Grands Jeux (aux Mondes). */
  avantLesJeux?: number;
  /** Un nouveau record personnel ? */
  record?: boolean;
  /** Le vent (m/s, 100 et 200 m), et si le chrono vaut record (vent de +2,0 au plus). */
  vent?: number | null;
  homologue?: boolean;
  /** A partir des France : le tour couru, et le tour suivant s'il est qualifie (au temps ou non). */
  tour?: Tour;
  suivant?: Tour;
  auTemps?: boolean;
  /** Sur le podium, mais les stats n'ont pas encore la moyenne du niveau suivant (pretPourLaSuite). */
  pasPret?: boolean;
  /** Sur le podium au plafond de sa categorie d'age (niveauMaxDe) : l'age qui ouvre la suite. */
  tropJeune?: number;
  /** Un meeting de club (ne qualifie pour rien) : son nom. */
  meeting?: [string, string];
  /** Blesse pendant la course ? */
  blessure?: TypeBlessure;
};

/**
 * LES TOURS, au format du championnat en direct (worker/src/championnats-config.js) :
 * 4 series de 8, 2 demi-finales de 8, la finale ; par course, 2 qualifies directs
 * et le repechage au temps (8 sur 4 series, 4 sur 2 demies). Le dimanche du direct
 * donne les heures : demies a 13 h 30, finale a 19 h.
 */
export type Tour = 'serie' | 'demie' | 'finale';
export const HEURE_DU_TOUR: Record<Tour, number> = { serie: 10 * 60 + 30, demie: 13 * 60 + 30, finale: 19 * 60 };
export function apresLeTour(tour: Tour, place: number): { suivant: Tour | null; auTemps: boolean; placeFinale: number } {
  if (tour === 'finale') return { suivant: null, auTemps: false, placeFinale: place };
  // shortcut: seule la course du joueur est courue ; le repechage au temps vaut deux places
  // par course (3e et 4e), ce qu'il donne en moyenne en direct. Simuler les autres courses si l'on veut l'exact.
  if (place <= 4) return { suivant: tour === 'serie' ? 'demie' : 'finale', auTemps: place > 2, placeFinale: place };
  // elimine : 17e a 32e en serie, 9e a 16e en demie
  return { suivant: null, auTemps: false, placeFinale: place + (tour === 'serie' ? 16 : 8) };
}

/**
 * Ranger une competition courue. Les trois premiers montent d'un niveau ;
 * les autres retentent le meme `ecart` semaines plus tard.
 */
export function conclureLaCompetition(a: Athlete, epreuve: Epreuve, place: number, chrono: number | null, vent: number | null = null): Resultat {
  const niveau = a.niveau;
  const c = COMPETITIONS[niveau];
  const podium = chrono !== null && place <= QUALIFIES;
  const prime = podium ? Math.round(c.prime * (place === 1 ? 1 : place === 2 ? 0.6 : 0.4)) : 0;
  const rep = podium ? Math.round(c.reputation * (place === 1 ? 1 : 0.6)) : Math.round(c.reputation * 0.15);
  payer(a, prime, 'Prime de course', 'Prize money');
  user(a, p => !!p.course);
  a.reputation += rep;
  a.abonnes += rep * (a.niveau >= NATIONAL ? 40 : 10);
  a.moral = borne(a.moral + (place === 1 ? 15 : podium ? 8 : -10), 0, 100);
  a.palmares.unshift({ s: a.semaine, niveau, epreuve, place, chrono });
  // le record personnel : le meilleur chrono de l'epreuve
  const rec = a.records ||= {};
  // un record ne vaut que par vent reglementaire : +2,0 m/s au plus (le 400 m, lui, n'a pas de mesure de vent)
  const homologue = vent === null || vent <= 2.0;
  const record = chrono !== null && homologue && (rec[epreuve] === undefined || chrono < rec[epreuve]!);
  if (record) rec[epreuve] = Math.round(chrono! * 100) / 100;
  const sommet = niveau === JEUX && place === 1 && chrono !== null;
  const mondial = niveau === MONDE && place === 1 && chrono !== null;
  a.assiduite = { proposees: 0, faites: 0 };
  // LES GRANDS JEUX COURUS : retour aux Mondes, et la discipline peut changer
  if (niveau === JEUX) {
    (a.jeux ||= []).push({ s: a.semaine, epreuve: epreuve as Epreuve, place });
    a.niveau = MONDE; a.apresJeux = true;
    a.prochaine = a.semaine + ecart(MONDE);
    return { niveau, epreuve, place, chrono, qualifie: false, prime, reputation: rep, sommet, record, vent, homologue, jeux: true };
  }
  // LE PODIUM ET LES STATS (l'auteur, 26/10 : « au depart les stats sont bridees sur le niveau
  // scolaire et les stats liberent les niveaux ») : on ne monte que les deux reunis.
  // Aux Mondes, on ne monte aux Jeux que la saison des Jeux, avant eux.
  const auSommet = niveau >= MONDE;
  const tropJeune = !auSommet && niveau >= niveauMaxDe(a.age ?? 14);
  const enHaut = auSommet || tropJeune, pret = pretPourLaSuite(a);
  // la selection : 85 de moyenne (pas 90) : un athlete serieux court ses premiers Jeux a la 4e saison
  const selection = niveau === MONDE && podium && moyenneDes(a) >= SELECTION_JEUX && niveauMaxDe(a.age ?? 14) >= JEUX
    && anneeDesJeux(a.semaine) && semaineDeSaison(a) < SEMAINE_DES_JEUX;
  if (podium && pret && !enHaut) a.niveau += 1;
  if (selection) a.niveau = JEUX;
  a.prochaine = a.niveau === JEUX ? semaineDesProchainsJeux(a.semaine) : a.semaine + ecart(a.niveau);
  return { niveau, epreuve, place, chrono, qualifie: (podium && pret && !enHaut) || selection, pasPret: podium && !pret && !enHaut,
           tropJeune: podium && tropJeune ? ageQuiOuvre(niveau) ?? undefined : undefined, prime, reputation: rep, sommet, record, vent, homologue,
           mondial, selection, avantLesJeux: niveau === MONDE ? semaineDesProchainsJeux(a.semaine) - a.semaine : undefined };
}

/**
 * LES MEETINGS DE CLUB (l'auteur, 25/10 : « des competitions de club et/ou meetings
 * pour garnir ») : entre deux championnats, un dimanche sans competition officielle,
 * on peut courir un meeting au plateau de son niveau. Il ne qualifie pour rien et
 * ne decale pas le championnat ; il rapporte un peu de reputation, une petite prime
 * sur le podium, et un chrono qui compte pour le record. Noms inventes.
 */
export const MEETINGS: [string, string][] = [
  ['Meeting de la Seine', 'Seine meet'], ['Meeting des Coteaux', 'Hillside meet'],
  ['Meeting des Falaises', 'Cliffs meet'], ['Meeting d’automne du club', 'Club autumn meet'],
];
export const DEPLACEMENT_MEETING = 10;
/** Le meeting, selon la categorie (et les parents d'un mineur aise). */
export const coutDuMeeting = (a: Athlete) => deTaPoche(a, DEPLACEMENT_MEETING);
export const meetingDe = (a: Athlete) => MEETINGS[a.semaine % MEETINGS.length];
/** Un meeting est-il possible ce jour-ci ? Rend la raison sinon. */
export function meetingPossible(a: Athlete, championnatAujourdhui: boolean): [string, string] | null {
  if (a.niveau < 1) return ['Les meetings s’ouvrent après la compétition scolaire', 'Meets open after the school meet'];
  if (a.jour !== DIMANCHE) return ['Les meetings ont lieu le dimanche', 'Meets are on Sundays'];
  if (championnatAujourdhui) return ['Aujourd’hui, c’est le championnat', 'Today is the championship'];
  if (a.meeting === a.semaine) return ['Déjà couru ce dimanche', 'Already raced this Sunday'];
  if (a.blessure > 0) return ['Blessé·e', 'Injured'];
  if (a.argent < coutDuMeeting(a)) return ['Pas assez d’argent', 'Not enough money'];
  return null;
}
export function conclureLeMeeting(a: Athlete, epreuve: Course, place: number, chrono: number | null, vent: number | null): Resultat {
  // en salle : le stade couvert de Val-de-Reuil (un lieu public, son vrai nom)
  const niveau = a.niveau, c = COMPETITIONS[niveau], nom: [string, string] = enSalle(epreuve) ? ['Meeting en salle · Jesse Owens', 'Indoor meet · Jesse Owens'] : meetingDe(a);
  const podium = chrono !== null && place <= QUALIFIES;
  const prime = podium ? [0, 30, 20, 10][place] * Math.max(1, niveau) : 0;
  const rep = Math.round(c.reputation * (podium ? 0.4 : 0.1));
  payer(a, prime, nom[0], nom[1]);
  a.reputation += rep;
  a.moral = borne(a.moral + (place === 1 ? 8 : podium ? 4 : -3), 0, 100);
  a.palmares.unshift({ s: a.semaine, niveau, epreuve, place, chrono, meeting: nom[0] });
  const rec = a.records ||= {}, homologue = vent === null || vent <= 2.0;
  const record = chrono !== null && homologue && (rec[epreuve] === undefined || chrono < rec[epreuve]!);
  if (record) rec[epreuve] = Math.round(chrono! * 100) / 100;
  return { niveau, epreuve, place, chrono, qualifie: false, prime, reputation: rep, sommet: false, record, vent, homologue, meeting: nom };
}

/** Ne pas aller a la competition (pas les moyens, blesse, ou choix). */
export function declarerForfait(a: Athlete) {
  // forfait aux Jeux : ils sont passes, retour aux Mondes (sans changement de discipline : on ne les a pas courus)
  if (a.niveau === JEUX) a.niveau = MONDE;
  a.prochaine = a.semaine + ecart(a.niveau);
  a.moral = borne(a.moral - 8, 0, 100);
  noter(a, 'Forfait : la compétition se fera sans toi.', 'Withdrawn: the meet goes on without you.');
}

/** Est-ce le dimanche d'une competition ? */
export function jourDeCompetition(a: Athlete): boolean {
  return a.semaine >= a.prochaine;
}

/** Un vrai championnat en direct, annonce ou en cours (worker, /champ/monde). */
export type RendezVousReel = { id: string; debut: number };

/**
 * LE JOUR DE COMPETITION, CALE SUR LE DIRECT A PARTIR DE LA FRANCE (l'auteur,
 * 25/10). Quand un vrai championnat du meme echelon est annonce ou en cours,
 * la competition de la carriere s'ouvre a sa date reelle, et pas avant : les
 * semaines continuent d'ici la (le plafond du niveau empeche d'en profiter).
 * Sans championnat annonce, on garde les semaines de jeu : rien ne doit
 * bloquer le joueur. `date` : l'heure reelle d'ouverture, ou null.
 */
export function jourCale(a: Athlete, rdv: RendezVousReel | null, maintenant: number): { jour: boolean; date: number | null } {
  if (a.niveau >= 1 && rdv && rdv.id !== a.rendezVous) return { jour: maintenant >= rdv.debut, date: rdv.debut };
  return { jour: jourDeCompetition(a), date: null };
}

/**
 * LE CYCLE DES CHAMPIONNATS (l'auteur, 25/10) : les France tous les trois mois ;
 * les regionaux un mois avant, les departementaux deux mois avant. Compte en
 * semaines pour tomber un samedi, comme l'edition des France : 4 et 8 semaines.
 */
export const SEMAINES_AVANT_FRANCE: Record<number, number> = { 1: 8, 2: 4 };
export function rendezVousAvantFrance(niveau: number, france: RendezVousReel | null): RendezVousReel | null {
  const avant = SEMAINES_AVANT_FRANCE[niveau];
  if (!france || !avant) return null;
  return { id: `${france.id}-${niveau === 1 ? 'D' : 'R'}`, debut: france.debut - avant * 7 * 24 * 3600 * 1000 };
}

/* ------------------------------------------------------------ la semaine */

export const ARGENT_DE_POCHE = 30;

/**
 * Tourner la page de la semaine : le repos du dimanche, l'argent de poche,
 * les sponsors, la blessure qui guerit. Ne tire PAS l'evenement de la
 * semaine (recit.ts s'en charge, il connait les histoires).
 */
export function finirLaSemaine(a: Athlete) {
  a.nuits = 0;
  const recup = a.materiel.reduce((s, id) => s + (enEtat(a, id) ? piece(id)?.recup || 0 : 0), 0);
  user(a, p => !!p.recup);
  a.fatigue = borne(a.fatigue - 45 - recup, 0, 100);
  if (a.origine === 'aisee' && etape(a) !== 'adulte') payer(a, ARGENT_DE_POCHE, 'Argent de poche', 'Pocket money');
  if (etape(a) === 'adulte') payer(a, -LOYER, 'Loyer', 'Rent');
  const st = statutDe(a), gagne = revenuDuSport(a);
  payer(a, gagne, st === 1 ? 'Contrat : tu vis de ton sport' : st === 2 ? 'Sponsors et aides' : 'Sponsors', st === 1 ? 'Contract: you live off your sport' : st === 2 ? 'Sponsors and grants' : 'Sponsors');
  if (a.statut && a.statut !== st) noter(a, `Tu passes en catégorie ${st} : ${STATUTS[st].nom[0]}. ${STATUTS[st].phrase[0]}`, `You move to category ${st}: ${STATUTS[st].nom[1]}. ${STATUTS[st].phrase[1]}`);
  a.statut = st;
  // une nouvelle saison : un an de plus, peut-etre une nouvelle categorie
  if (a.semaine % SAISON === 0) a.age = (a.age ?? 14) + 1;
  // Trois seances proposees par semaine (le samedi reste un bonus).
  if (a.blessure === 0) a.assiduite.proposees += 3;
  const faitesSemaine = a.faites.filter(j => j !== 'samedi').length;
  if (a.blessure === 0 && faitesSemaine === 0) a.moral = borne(a.moral - 5, 0, 100);
  // sans diagnostic, on reprend trop tot et l'on retarde : une semaine de plus, une fois
  if (a.blessure > 0 && !a.diagnostic && !a.retard) { a.blessure += 1; a.retard = true; }
  if (a.blessure > 0) a.blessure -= 1;
  if (a.blessure === 0) { a.blessureType = null; a.diagnostic = null; a.retard = false; }
  a.osteo = false;
  a.semaine += 1;
  a.faites = [];
  a.boulots = [];
  a.kine = false;
  a.footing = false;
  delete a.tourAttendu;
}

/* ------------------------------------------------------------ la journee */

// LE TEMPS QUI PASSE, COMME DANS LES SIMS (docs/carriere-athlete.md). Une
// minute de jeu par seconde dans la ville ; chaque action prend son temps ; on
// dort la nuit. Les besoins baissent a l'heure, et les remplir est la moitie
// du jeu : une seance a jeun et sans sommeil vaut moins, et se paie.

export type Besoin = 'energie' | 'faim' | 'hygiene' | 'social' | 'plaisir';
export const BESOINS: Besoin[] = ['energie', 'faim', 'hygiene', 'social', 'plaisir'];
export const BESOINS_PLEINS: Record<Besoin, number> = { energie: 90, faim: 80, hygiene: 90, social: 70, plaisir: 70 };
/** Ce que chaque besoin perd par heure eveillee. */
// une journee de 16 h eveillee, cours et entrainement compris, doit tenir : il reste ~20 d'energie au coucher
const BAISSE: Record<Besoin, number> = { energie: 3, faim: 6.5, hygiene: 3, social: 2.5, plaisir: 3 };
export const JOUR_DE: Record<Jour, number> = { lundi: 0, mercredi: 2, vendredi: 4, samedi: 5 };
export const DIMANCHE = 6;
export const DUREE_SEANCE = 90;
export const REVEIL = 7 * 60;

export const besoinsDe = (a: Athlete) => (a.besoins ||= { ...BESOINS_PLEINS });
export const jourDe = (a: Athlete) => a.jour ?? 0;
export const heureDe = (a: Athlete) => a.heure ?? REVEIL;
const enSemaine = (a: Athlete) => jourDe(a) < 5;

/** La forme du jour : de 0,7 (vide) a 1 (repose et nourri). */
export function formeDuJour(a: Athlete): number {
  if (!a.besoins) return 1;
  return 0.7 + 0.3 * Math.min(a.besoins.energie, a.besoins.faim) / 100;
}

/**
 * Faire passer `minutes`. Les besoins baissent (en plus des `effets` de ce
 * qu'on fait), minuit change de jour, et le college note une absence a 9 h.
 * Rend ce qui s'est passe : 'absence', 'epuise' (plus d'energie : on
 * s'endort ou l'on est).
 */
export function avancer(a: Athlete, minutes: number, effets: Partial<Record<Besoin, number>> = {}): string[] {
  const b = besoinsDe(a), out: string[] = [];
  const h0 = heureDe(a);
  for (const k of BESOINS) b[k] = borne(b[k] - BAISSE[k] * minutes / 60 + (effets[k] || 0), 0, 100);
  let h = h0 + minutes;
  // en categorie 1, le sport est le metier : personne n'attend l'athlete au bureau
  if (enSemaine(a) && h0 < 9 * 60 && h >= 9 * 60 && !a.cours && !(etape(a) === 'adulte' && vitDuSport(a))) {
    a.ecole = borne((a.ecole ?? 60) - 5, 0, 100);
    a.moral = borne(a.moral - 3, 0, 100);
    const e = etape(a);
    if (e === 'adulte') noter(a, 'Absent au travail : le patron n’est pas content, et la journée n’est pas payée.', 'Missed work: the boss isn’t happy, and the day isn’t paid.');
    else noter(a, e === 'lycee' ? 'Absent au lycée : la vie scolaire a appelé tes parents.' : 'Absent au collège : le CPE a appelé à la maison.', e === 'lycee' ? 'Missed school: the office called your parents.' : 'Missed school: the office called home.');
    out.push('absence');
  }
  while (h >= 24 * 60) { h -= 24 * 60; jourSuivant(a); }
  a.heure = h;
  if (b.energie <= 0) out.push('epuise');
  // un ventre vide et une tete fatiguee pesent sur le moral
  if (b.faim < 15 || b.energie < 15) a.moral = borne(a.moral - minutes / 60, 0, 100);
  return out;
}

/**
 * Passer au jour suivant (minuit, ou le reveil d'une nuit commencee avant
 * minuit). Apres le dimanche, la semaine tourne — meme si l'on veille ou si
 * l'on s'effondre apres minuit : sinon le loyer sautait et le lundi restait
 * bloque. Une competition non courue devient un forfait.
 */
function jourSuivant(a: Athlete) {
  if (jourDe(a) === DIMANCHE) {
    if (jourDeCompetition(a)) declarerForfait(a);
    finirLaSemaine(a);
  }
  a.jour = (jourDe(a) + 1) % 7;
  a.cours = false;
}

/** La fenetre d'entrainement : apres les cours en semaine, en journee le samedi. */
export function seanceMaintenant(a: Athlete, j: Jour): null | 'pas_ce_jour' | 'pas_l_heure' {
  if (jourDe(a) !== JOUR_DE[j]) return 'pas_ce_jour';
  const h = heureDe(a);
  if (j === 'samedi' ? h < 9 * 60 || h > 19 * 60 : h < 16 * 60 + 30 || h > 21 * 60) return 'pas_l_heure';
  return null;
}

export type Action = {
  id: string;
  /** Le lieu de la ville (ville.ts) ou l'action se fait. */
  lieu: string;
  /** Sa duree en minutes ; 'nuit' : jusqu'au reveil. */
  duree: number | 'nuit' | 'cours';
  cout?: number;
  effets: Partial<Record<Besoin, number>>;
  moral?: number;
  /** Quand c'est possible : [debut, fin] en minutes, et en semaine seulement ? */
  /** Debut et fin en minutes ; un debut apres la fin passe minuit. */
  quand?: [number, number];
  semaine?: boolean;
};

export const ACTIONS: Action[] = [
  { id: 'dormir', lieu: 'maison', duree: 'nuit', effets: {}, quand: [20 * 60, REVEIL - 30] },
  { id: 'sieste', lieu: 'maison', duree: 60, effets: { energie: 16 } },
  { id: 'manger', lieu: 'maison', duree: 30, effets: { faim: 60, social: 6 } },
  { id: 'douche', lieu: 'maison', duree: 15, effets: { hygiene: 85 } },
  { id: 'devoirs', lieu: 'maison', duree: 60, effets: { plaisir: -6 }, quand: [16 * 60, 23 * 60] },
  { id: 'console', lieu: 'maison', duree: 60, effets: { plaisir: 40, energie: -2 } },
  { id: 'telephone', lieu: 'maison', duree: 30, effets: { social: 28, plaisir: 6 } },
  { id: 'cours', lieu: 'college', duree: 'cours', effets: { social: 30, faim: 45, energie: -10 }, quand: [7 * 60, 9 * 60], semaine: true },
  { id: 'cours_lycee', lieu: 'lycee', duree: 'cours', effets: { social: 28, faim: 45, energie: -12 }, quand: [7 * 60, 9 * 60], semaine: true },
  { id: 'travail', lieu: 'travail', duree: 'cours', effets: { social: 15, faim: 40, energie: -16 }, quand: [7 * 60, 9 * 60], semaine: true },
  { id: 'manger_parents', lieu: 'parents', duree: 45, effets: { faim: 70, social: 20, plaisir: 6 } },
  { id: 'echauffement', lieu: 'gare', duree: 25, effets: { energie: -3, hygiene: -6 } },
  { id: 'pizza', lieu: 'livraison', duree: 40, cout: 12, effets: { faim: 70, plaisir: 16 } },
  { id: 'fruits', lieu: 'marche', duree: 15, cout: 5, effets: { faim: 25, energie: 4 }, quand: [8 * 60, 13 * 60] },
  { id: 'discuter_parc', lieu: 'parc', duree: 30, effets: { social: 22, plaisir: 8 } },
  { id: 'discuter_club', lieu: 'club', duree: 30, effets: { social: 25 } },
];
export const action = (id: string) => ACTIONS.find(x => x.id === id);

/** Peut-on faire cette action maintenant ? Rend la raison sinon. */
export function actionPossible(a: Athlete, id: string): null | 'heure' | 'argent' | 'fait' | 'week-end' | 'etape' {
  const x = action(id); if (!x) return 'heure';
  // l'ecole et le travail suivent l'age
  const e = etape(a);
  if ((id === 'cours' && e !== 'college') || (id === 'cours_lycee' && e !== 'lycee') || (id === 'travail' && e !== 'adulte')) return 'etape';
  if (x.semaine && !enSemaine(a)) return 'week-end';
  if (x.duree === 'cours' && a.cours) return 'fait';
  const h = heureDe(a);
  // une fenetre qui passe minuit (dormir : 20 h – 6 h 30) a son debut apres sa fin
  if (x.quand && (x.quand[0] <= x.quand[1] ? h < x.quand[0] || h > x.quand[1] : h < x.quand[0] && h > x.quand[1])) return 'heure';
  if (x.cout && a.argent < x.cout) return 'argent';
  return null;
}

/**
 * Faire une action : payer, prendre le temps, remplir les besoins. Dormir
 * mene au reveil du lendemain ; dormir le dimanche soir tourne la semaine
 * (et une competition non courue devient un forfait).
 */
export function faireUneAction(a: Athlete, id: string): null | string {
  const r = actionPossible(a, id); if (r) return r;
  const x = action(id)!;
  (a.faitAujourdhui ||= []).push(id);
  if (x.cout) payer(a, -x.cout, x.id === 'pizza' ? 'Pizzeria' : 'Marché', x.id === 'pizza' ? 'Pizzeria' : 'Market');
  if (x.duree === 'nuit') { dormir(a); return null; }
  if (x.duree === 'cours') {
    a.cours = true;
    // la journee de travail finit a 17 h et se paie ; la journee de cours finit a 16 h 30
    if (id === 'travail') { avancer(a, Math.max(30, 17 * 60 - heureDe(a)), x.effets); payer(a, SALAIRE, 'Salaire', 'Wages'); return null; }
    a.ecole = borne((a.ecole ?? 60) + 3, 0, 100);
    avancer(a, Math.max(30, 16 * 60 + 30 - heureDe(a)), x.effets);
    return null;
  }
  if (id === 'echauffement') a.echauffe = true;
  avancer(a, x.duree, x.effets);
  if (x.moral) a.moral = borne(a.moral + x.moral, 0, 100);
  if (id === 'devoirs') a.ecole = borne((a.ecole ?? 60) + 2, 0, 100);
  return null;
}

/** Dormir jusqu'au reveil. Les heures de sommeil font l'energie (8 h : plein). */
export function dormir(a: Athlete) {
  const b = besoinsDe(a), h = heureDe(a);
  const duree = h <= REVEIL ? REVEIL - h : 24 * 60 - h + REVEIL;
  // la nuit : la faim baisse doucement, l'energie remonte, les muscles recuperent
  b.energie = borne(b.energie + duree / 60 * 12.5, 0, 100);
  b.faim = borne(b.faim - duree / 60 * 2.5, 0, 100);
  b.hygiene = borne(b.hygiene - duree / 60 * 1.5, 0, 100);
  a.fatigue = borne(a.fatigue - duree / 60 * 0.6, 0, 100);
  // la nuit repare : 4 points d'usure par zone, mieux apres 8 h, moins sous 6 h
  soulager(a, 4 * (duree >= 8 * 60 ? 1.5 : duree < 6 * 60 ? 0.5 : 1));
  if (duree < 7 * 60) a.moral = borne(a.moral - 4, 0, 100);
  // couche avant minuit : le jour change au reveil (et la semaine apres le dimanche) ; apres minuit, c'est deja fait
  a.nuits = (a.nuits || 0) + 1;
  if (h > REVEIL) jourSuivant(a);
  a.faitAujourdhui = [];
  a.heure = REVEIL;
}

/* ------------------------------------------------------------ le corps */

// LES BLESSURES SONT DES CONSEQUENCES, PAS DU HASARD (l'auteur, 25/10 : « les
// blessures ne doivent pas etre un facteur de hasard mais de consequences »).
//
// Chaque zone du corps a son USURE, de 0 a 100. Chaque effort l'use selon ce
// qu'il demande (les departs et la vitesse les ischios, les cotes et les
// bondissements les tendons d'Achille et les chevilles, le tempo les tibias),
// et d'autant plus qu'on le fait fatigue, sans energie, sans echauffement, ou
// apres trop de seances en sept jours. La nuit, le kine, l'osteopathe, le
// footing la font redescendre. A SEUIL_GENE, une gene previent ; a
// SEUIL_BLESSURE, la zone casse — et ce qui a ete depasse fait la gravite
// (le grade que lira l'IRM, la duree d'arret). Le surmenage vient d'une
// fatigue poussee a bout. Rien n'est tire au sort : le joueur sait toujours
// pourquoi. Les durees sont des ordres de grandeur, pas un avis medical.

export type TypeBlessure = 'ischio' | 'periostite' | 'achille' | 'cheville' | 'surmenage';
export type Zone = Exclude<TypeBlessure, 'surmenage'>;
export const ZONES: Zone[] = ['ischio', 'periostite', 'achille', 'cheville'];
export const NOMS_ZONES: Record<Zone, [string, string]> = {
  ischio: ['Ischio-jambiers', 'Hamstrings'], periostite: ['Tibias', 'Shins'], achille: ['Tendons d’Achille', 'Achilles'], cheville: ['Chevilles', 'Ankles'],
};
export const SEUIL_GENE = 60, SEUIL_BLESSURE = 85;

/** Les semaines d'arret selon le grade (1, 2, 3). */
export const BLESSURES: Record<TypeBlessure, { nom: [string, string]; semaines: [number, number, number]; gene: [string, string] }> = {
  ischio: { nom: ['Claquage des ischio-jambiers', 'Hamstring strain'], semaines: [2, 4, 7], gene: ['L’arrière de ta cuisse tire.', 'The back of your thigh feels tight.'] },
  periostite: { nom: ['Périostite tibiale', 'Shin splints'], semaines: [2, 3, 8], gene: ['Ton tibia te fait mal quand tu appuies.', 'Your shin hurts when you press it.'] },
  achille: { nom: ['Tendinite d’Achille', 'Achilles tendinitis'], semaines: [3, 5, 8], gene: ['Ton tendon d’Achille est raide le matin.', 'Your Achilles is stiff in the morning.'] },
  cheville: { nom: ['Entorse de la cheville', 'Ankle sprain'], semaines: [1, 2, 4], gene: ['Ta cheville est fragile depuis la dernière séance.', 'Your ankle has felt weak since the last session.'] },
  surmenage: { nom: ['Surmenage', 'Overtraining'], semaines: [1, 1, 2], gene: ['Tu te sens vidé, même après une nuit.', 'You feel drained, even after a night’s sleep.'] },
};

/** Ce que chaque effort use, zone par zone, a l'etat frais. */
const USE: Record<Exercice | 'course', Partial<Record<Zone, number>>> = {
  departs: { ischio: 9, cheville: 2 }, lancee: { ischio: 10 }, virage: { ischio: 6, cheville: 4, periostite: 2 },
  cotes: { achille: 7, ischio: 4 }, muscu: { ischio: 3 }, bonds: { achille: 7, cheville: 5, periostite: 4 },
  gammes: { periostite: 3 }, gainage: {}, fractionne: { ischio: 6, periostite: 4 }, tempo: { periostite: 5 },
  course: { ischio: 12, achille: 3 },
};

const jourAbsolu = (a: Athlete) => a.semaine * 7 + (a.jour ?? 0);
/** Les jours d'effort (seances et courses) des sept derniers jours. */
export const chargeDe = (a: Athlete) => (a.charge || []).filter(j => jourAbsolu(a) - j < 7).length;
export const usureDe = (a: Athlete) => (a.usure ||= { ischio: 0, periostite: 0, achille: 0, cheville: 0 });

/** Ce qui multiplie l'usure : la fatigue, l'energie, la charge des sept jours. */
export function facteurDEffort(a: Athlete): number {
  let f = 1;
  if (a.fatigue > 60) f *= 1 + (a.fatigue - 60) / 40;
  if (a.besoins && a.besoins.energie < 30) f *= 1.3;
  const ch = chargeDe(a);
  if (ch >= 5) f *= 1 + 0.2 * (ch - 4);
  return f;
}

/** Ce que cet effort va user, maintenant (pour prevenir le joueur avant). */
export function usurePrevue(a: Athlete, quoi: Exercice | 'course'): Partial<Record<Zone, number>> {
  const f = facteurDEffort(a), out: Partial<Record<Zone, number>> = {};
  for (const z of ZONES) {
    let u = (USE[quoi][z] || 0) * f;
    if (z === 'periostite' && (a.age ?? 14) <= 15 && quoi !== 'gainage') u += 1;      // la croissance
    if (z === 'ischio' && quoi === 'course' && !a.echauffe) u += 12;                  // pas d'echauffement
    if (u) out[z] = Math.round(u * 10) / 10;
  }
  return out;
}

/** La gene : la zone la plus usee, si elle passe SEUIL_GENE. */
export function majGene(a: Athlete) {
  const u = usureDe(a);
  const z = ZONES.reduce((m, x) => (u[x] > u[m] ? x : m), ZONES[0]);
  a.gene = a.blessure === 0 && u[z] >= SEUIL_GENE ? z : null;
}

/**
 * L'effort est fait : il use le corps, et le corps repond — rien, une gene,
 * ou une blessure, selon ce qui a ete depasse.
 */
export function tirerLeCorps(a: Athlete, quoi: Exercice | 'course'): { blessure?: TypeBlessure; gene?: TypeBlessure } {
  const u = usureDe(a), avant = a.gene;
  for (const [z, v] of Object.entries(usurePrevue(a, quoi)) as [Zone, number][]) u[z] = Math.min(110, u[z] + v);
  (a.charge ||= []).push(jourAbsolu(a));
  a.charge = a.charge.filter(j => jourAbsolu(a) - j < 14);
  if (quoi === 'course') a.echauffe = false;
  // le surmenage : s'entrainer fatigue a bout
  if (quoi !== 'course' && a.fatigue >= 95) return { blessure: blesser(a, 'surmenage', 1) };
  const z = ZONES.reduce((m, x) => (u[x] > u[m] ? x : m), ZONES[0]);
  if (u[z] >= SEUIL_BLESSURE) {
    const grade = (u[z] >= 100 ? 3 : u[z] >= 92 ? 2 : 1) as 1 | 2 | 3;
    u[z] = 45;                       // la zone blessee est mise au repos
    return { blessure: blesser(a, z, grade) };
  }
  majGene(a);
  return a.gene ? { gene: a.gene } : avant ? {} : {};
}

function blesser(a: Athlete, type: TypeBlessure, grade: 1 | 2 | 3): TypeBlessure {
  a.blessure = BLESSURES[type].semaines[grade - 1];
  a.blessureType = type; a.blessureGrade = grade; a.gene = null;
  a.moral = borne(a.moral - 15, 0, 100);
  noter(a, `${BLESSURES[type].nom[0]} : ${a.blessure} semaine${a.blessure > 1 ? 's' : ''} d’arrêt.`, `${BLESSURES[type].nom[1]}: ${a.blessure} week${a.blessure > 1 ? 's' : ''} out.`);
  return type;
}

/** Faire redescendre l'usure : `points` partout, ou sur la zone la plus usee. */
export function soulager(a: Athlete, points: number, laPire = false) {
  const u = usureDe(a);
  if (laPire) { const z = ZONES.reduce((m, x) => (u[x] > u[m] ? x : m), ZONES[0]); u[z] = Math.max(0, u[z] - points); }
  else for (const z of ZONES) u[z] = Math.max(0, u[z] - points);
  majGene(a);
}

/**
 * CHANGER DE DISCIPLINE apres les Grands Jeux (l'auteur, 15/11) : la nouvelle epreuve devient la specialite ;
 * on repart des Championnats de France, les qualites a 80 % (le corps est la, pas encore la course), et l'on
 * vise les Jeux suivants dans cette epreuve.
 */
export function changerDeDiscipline(a: Athlete, e: Epreuve) {
  const avant = a.specialite;
  a.voie = 'specialiste'; a.specialite = e;
  a.niveau = NATIONAL;
  for (const k of STATS) a.stats[k] = rond(a.stats[k] * 0.8);
  a.apresJeux = false;
  a.prochaine = a.semaine + ecart(NATIONAL);
  a.assiduite = { proposees: 0, faites: 0 };
  (a.disciplines ||= []).push({ s: a.semaine, epreuve: e });
  noter(a, `Nouvelle discipline : le ${e} m${avant ? ` après le ${avant} m` : ''}. Retour aux Championnats de France.`,
        `New event: the ${e} m${avant ? ` after the ${avant} m` : ''}. Back to the national championships.`);
}
/** Garder sa discipline apres les Jeux : rien ne change, on vise les suivants. */
export function garderSaDiscipline(a: Athlete) { a.apresJeux = false; }
