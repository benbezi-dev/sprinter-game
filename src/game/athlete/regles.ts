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

export type Stat = 'vitesse' | 'force' | 'technique' | 'endurance';
export const STATS: Stat[] = ['vitesse', 'force', 'technique', 'endurance'];

export type Origine = 'aisee' | 'modeste';
export type Voie = 'polyvalent' | 'specialiste';
export type Epreuve = '100' | '200' | '400';
export const EPREUVES: Epreuve[] = ['100', '200', '400'];
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
  /** Le petit boulot pris cette semaine. */
  boulot: string | null;
  club: string | null;
  coach: string | null;
  objectif: Objectif | null;
  materiel: string[];
  /** Le niveau de la prochaine competition (index de COMPETITIONS). */
  niveau: number;
  /** La semaine ou elle a lieu. */
  prochaine: number;
  reputation: number;
  abonnes: number;
  relations: { coach: number; club: number; rival: number };
  sponsors: string[];
  chapitre: Chapitre;
  /** LA JOURNEE (game/athlete/regles.ts, « la journee ») : le jour (0 = lundi), l'heure en minutes. */
  jour?: number;
  heure?: number;
  /** Les besoins, de 0 (vide) a 100 (comble). Absents des sauvegardes d'avant : BESOINS_PLEINS. */
  besoins?: Record<Besoin, number>;
  /** L'ecole : 0 a 100, les cours et les devoirs la montent, secher la fait baisser. */
  ecole?: number;
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
  /** L'evenement qui attend une reponse, ou null. */
  evenement: string | null;
  vus: string[];
  journal: Ligne[];
  palmares: { s: number; niveau: number; epreuve: Epreuve; place: number; chrono: number | null }[];
  /** L'assiduite du cycle : seances proposees, seances faites. */
  assiduite: { proposees: number; faites: number };
};

/* ------------------------------------------------------------ les seances */

export const SEANCES: Record<Jour, { stat: Stat; secondaire: Stat; fatigue: number }> = {
  lundi:    { stat: 'vitesse',   secondaire: 'technique', fatigue: 18 },
  mercredi: { stat: 'force',     secondaire: 'vitesse',   fatigue: 22 },
  vendredi: { stat: 'technique', secondaire: 'force',     fatigue: 14 },
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
export const prixDuKine = (a: Athlete) => (a.club ? KINE / 2 : KINE);

/**
 * Une seance chez le kine : la fatigue tombe, une blessure guerit d'une
 * semaine plus vite. Rend la raison si ce n'est pas possible.
 */
export function chezLeKine(a: Athlete): null | 'fait' | 'argent' {
  if (a.kine) return 'fait';
  const p = prixDuKine(a);
  if (a.argent < p) return 'argent';
  a.argent -= p;
  a.kine = true;
  a.fatigue = borne(a.fatigue - 25, 0, 100);
  if (a.blessure > 0) a.blessure -= 1;
  noter(a, 'Chez le kiné : massage, étirements, le corps respire.', 'At the physio: massage, stretching, the body breathes.');
  return null;
}

/** Le footing de recuperation au parc : gratuit, une fois par semaine. */
export function footingAuParc(a: Athlete): boolean {
  if (a.footing || a.blessure > 0) return false;
  a.footing = true;
  a.fatigue = borne(a.fatigue - 12, 0, 100);
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
};

export const MATERIEL: Piece[] = [
  { id: 'pointes1', prix: 60, course: { vitesse: 3 } },
  { id: 'pointes2', prix: 180, course: { vitesse: 6, technique: 2 }, remplace: 'pointes1' },
  { id: 'pointes3', prix: 450, course: { vitesse: 9, technique: 4 }, remplace: 'pointes2' },
  { id: 'tenue', prix: 70, course: { endurance: 2 } },
  { id: 'elastiques', prix: 25, seance: 'mercredi' },
  { id: 'plots', prix: 20, seance: 'vendredi' },
  { id: 'montre', prix: 90, seance: 'samedi' },
  { id: 'starting', prix: 140, seance: 'lundi', course: { force: 2 } },
  { id: 'recup', prix: 120, recup: 15 },
];

export const piece = (id: string) => MATERIEL.find(p => p.id === id) || null;

/* ------------------------------------------------------- les petits boulots */

export type Boulot = { id: string; gain: number; fatigue: number; prend: Jour | null };

export const BOULOTS: Boulot[] = [
  { id: 'babysitting', gain: 30, fatigue: 3, prend: null },
  { id: 'livraison', gain: 45, fatigue: 12, prend: null },
  { id: 'marche', gain: 60, fatigue: 8, prend: 'samedi' },
];

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

export const COMPETITIONS: Competition[] = [
  { cle: 'scolaire', plateau: 0, deplacement: 0, prime: 0, reputation: 5, ecart: 2, plafond: 36 },
  // Entre le scolaire (12,50-15,00) et les regionaux (11,20-12,50) : aucun
  // plateau du moteur n'y tombe, la marche se donne ses chronos.
  { cle: 'departementaux', plateau: 0, deplacement: 15, prime: 0, reputation: 8, ecart: 2, plafond: 40,
    chronos: { '100': [11.80, 13.40], '200': [23.60, 27.00], '400': [51.00, 57.00] } },
  { cle: 'regionaux', plateau: 1, deplacement: 40, prime: 0, reputation: 12, ecart: 2, plafond: 45 },
  { cle: 'france', plateau: 2, deplacement: 150, prime: 400, reputation: 30, ecart: 4, plafond: 50 },
  { cle: 'europe', plateau: 3, deplacement: 600, prime: 1500, reputation: 70, ecart: 4, plafond: 55 },
  { cle: 'monde', plateau: 4, deplacement: 1500, prime: 5000, reputation: 160, ecart: 4, plafond: 60 },
];

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
};
export const APPARENCE: Apparence = { corps: 'f', peau: 'miel', coiffure: 'ponytail', cheveux: 'chatain', taille: 1.72, couleur: 0 };

/* ------------------------------------------------------------ outils */

const borne = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rond = (v: number) => Math.round(v * 10) / 10;

export function noter(a: Athlete, fr: string, en: string) {
  a.journal.unshift({ s: a.semaine, fr, en });
  if (a.journal.length > 40) a.journal.length = 40;
}

/* ------------------------------------------------------------ la naissance */

export function nouvelAthlete(nom: string, origine: Origine, voie: Voie, specialite: Epreuve | null,
                             apparence: Apparence = APPARENCE): Athlete {
  const aisee = origine === 'aisee';
  return {
    v: 2,
    nom: nom || 'TOI',
    origine,
    voie,
    specialite: voie === 'specialiste' ? (specialite || '100') : null,
    apparence: { ...apparence },
    stats: { vitesse: 28, force: 24, technique: 22, endurance: 26 },
    argent: aisee ? 600 : 20,
    fatigue: 0,
    moral: 70,
    blessure: 0,
    semaine: 1,
    faites: [],
    boulot: null,
    club: null,
    coach: null,
    objectif: null,
    // Une famille aisee equipe son enfant des le premier jour.
    materiel: aisee ? ['pointes1', 'tenue'] : [],
    niveau: 0,
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
  };
}

/* ------------------------------------------------------------ s'entrainer */

/** Une seance est-elle possible aujourd'hui ? Rend la raison sinon. */
export function seancePossible(a: Athlete, j: Jour): null | 'faite' | 'blesse' | 'boulot' {
  if (a.blessure > 0) return 'blesse';
  if (a.faites.includes(j)) return 'faite';
  const b = BOULOTS.find(x => x.id === a.boulot);
  if (b && b.prend === j) return 'boulot';
  return null;
}

/** Ce que rapporte une qualite a ce niveau : plus elle est haute, moins on y gagne. */
const reste = (v: number) => Math.max(0.08, 1 - v / 115);

/**
 * Le gain d'une seance, sans l'appliquer. `score` : la qualite de la seance,
 * de 0 a 1 (le mini-jeu). Une seance ratee rend quand meme un peu : on est
 * venu, on a couru.
 */
export function gainDeSeance(a: Athlete, j: Jour, score: number): Partial<Record<Stat, number>> {
  const s = SEANCES[j];
  const q = 0.25 + 0.75 * borne(score, 0, 1);
  const c = club(a.club);
  const encadrement = a.coach && c ? c.bonus : 1;
  const forme = 1 - Math.max(0, a.fatigue - 50) / 100;
  const outil = a.materiel.some(id => piece(id)?.seance === j) ? 1.15 : 1;
  const moral = 0.85 + 0.3 * (a.moral / 100);
  const base = 3.2 * q * encadrement * forme * outil * moral * formeDuJour(a);
  const cles = a.specialite ? CLES_EPREUVE[a.specialite] : [];
  const spe = (st: Stat) => (a.voie === 'specialiste' && cles.includes(st) ? 1.2 : 1);
  // Le polyvalent gagne moins vite sur l'essentiel mais plus sur le reste.
  const part2 = a.voie === 'polyvalent' ? 0.5 : 0.3;
  return {
    [s.stat]: rond(base * spe(s.stat) * reste(a.stats[s.stat])),
    [s.secondaire]: rond(base * part2 * spe(s.secondaire) * reste(a.stats[s.secondaire])),
  };
}

export type Seance = { gains: Partial<Record<Stat, number>>; blessure: boolean };

/**
 * Faire la seance du jour `j` avec ce score. S'entrainer epuise expose a la
 * blessure : au-dessus de 85 de fatigue, une chance sur trois de s'arreter
 * deux semaines — et la seance ne rapporte rien.
 */
export function faireLaSeance(a: Athlete, j: Jour, score: number, alea: () => number): Seance | null {
  if (seancePossible(a, j)) return null;
  a.faites.push(j);
  if (j !== 'samedi') a.assiduite.faites += 1;
  // epuise, ou sans energie ni rien dans le ventre : le corps lache
  const vide = a.besoins ? Math.min(a.besoins.energie, a.besoins.faim) : 100;
  if ((a.fatigue >= 85 && alea() < 0.35) || (vide < 12 && alea() < 0.2)) {
    a.blessure = 2;
    a.moral = borne(a.moral - 15, 0, 100);
    noter(a, 'Blessé à l’entraînement : deux semaines d’arrêt.', 'Injured in training: two weeks off.');
    return { gains: {}, blessure: true };
  }
  const gains = gainDeSeance(a, j, score);
  // Au plafond du niveau, la seance entretient sans faire monter : c'est la competition qui ouvre la suite.
  const plafond = COMPETITIONS[a.niveau].plafond;
  for (const k of Object.keys(gains) as Stat[]) {
    const v = Math.max(a.stats[k], borne(rond(a.stats[k] + (gains[k] || 0)), 0, plafond));
    gains[k] = rond(v - a.stats[k]);
    a.stats[k] = v;
  }
  a.fatigue = borne(a.fatigue + SEANCES[j].fatigue, 0, 100);
  if (a.besoins) avancer(a, DUREE_SEANCE, { energie: -18, faim: -12, hygiene: -40 });
  return { gains, blessure: false };
}

/* ------------------------------------------------------------ l'argent */

export function prendreUnBoulot(a: Athlete, id: string): boolean {
  const b = BOULOTS.find(x => x.id === id);
  if (!b || a.boulot) return false;
  if (b.prend && a.faites.includes(b.prend)) return false;
  a.boulot = id;
  a.argent += b.gain;
  a.fatigue = borne(a.fatigue + b.fatigue, 0, 100);
  return true;
}

/** Peut-on acheter cette piece ? Rend la raison sinon. */
export function achatPossible(a: Athlete, id: string): null | 'possede' | 'argent' | 'avant' | 'inconnu' {
  const p = piece(id);
  if (!p) return 'inconnu';
  if (a.materiel.includes(id) || MATERIEL.some(q => q.remplace === id && a.materiel.includes(q.id))) return 'possede';
  if (p.remplace && !a.materiel.includes(p.remplace)) return 'avant';
  if (a.argent < p.prix) return 'argent';
  return null;
}

export function acheter(a: Athlete, id: string): boolean {
  if (achatPossible(a, id)) return false;
  const p = piece(id)!;
  a.argent -= p.prix;
  if (p.remplace) a.materiel = a.materiel.filter(x => x !== p.remplace);
  a.materiel.push(id);
  return true;
}

/** Les points de materiel ajoutes aux stats en course. */
export function bonusMateriel(a: Athlete): Record<Stat, number> {
  const b: Record<Stat, number> = { vitesse: 0, force: 0, technique: 0, endurance: 0 };
  for (const id of a.materiel) {
    const p = piece(id);
    if (p && p.course) for (const k of Object.keys(p.course) as Stat[]) b[k] += p.course[k] || 0;
  }
  return b;
}

/** Ce que coute le deplacement a l'athlete, apres parents, club et sponsors. */
export function coutDuDeplacement(a: Athlete, niveau: number): number {
  const c = COMPETITIONS[borne(niveau, 0, COMPETITIONS.length - 1)];
  if (a.origine === 'aisee') return 0;               // les parents paient
  if (a.sponsors.length) return 0;                   // le sponsor paie
  return a.club ? Math.round(c.deplacement / 2) : c.deplacement;   // le club en prend la moitie
}

/* ------------------------------------------------------------ la course */

export type Reglages = { vitesse: number; boost: number; drag: number; chute: number };

/** Le programme a-t-il ete suivi assez pour un pic de forme a cette competition ? */
export function picDeForme(a: Athlete, niveau: number): boolean {
  if (!a.objectif || NIVEAU_OBJECTIF[a.objectif] !== niveau) return false;
  const { proposees, faites } = a.assiduite;
  return proposees >= 6 && faites / proposees >= 0.75;
}

/**
 * Ce que vaut une qualite au-dessus de 50, rapporte a ce qu'elle coute en
 * dessous. L'auteur, 25/10 : l'athlete au sommet ne doit jamais gagner plus
 * d'un dixieme sur un joueur qui ne joue pas a ce mode. 50 partout, c'est le
 * coureur de tout le monde ; en dessous on perd franchement (c'est ce que
 * l'entrainement rattrape), au-dessus on gagne a peine. Verifie par
 * tools/athlete-test.mjs, au pire cas (110 partout, pic de forme), sur les
 * trois epreuves et toutes les cadences.
 */
export const HAUT = 0.009;

/**
 * Les coefficients poses sur le coureur du joueur (G.reglagesJoueur, lu par
 * buildLevel). 50 partout et sans materiel : 1 partout.
 */
export function reglages(a: Athlete, niveau: number): Reglages {
  const m = bonusMateriel(a);
  const pic = picDeForme(a, niveau) ? 0.1 : 0;
  // L'ecart a 50, de -0,5 a +0,6 ; le pic de forme compte comme 10 points de vitesse.
  const d = (k: Stat, plus = 0) => {
    const v = borne(a.stats[k] + m[k], 0, 110) / 100 - 0.5 + plus;
    return v < 0 ? v : v * HAUT;
  };
  const forme = a.fatigue > 60 ? -0.03 * (a.fatigue - 60) / 40 : 0;
  return {
    vitesse: rond5(1 + 0.05 * d('vitesse', pic) + forme),
    boost: rond5(1 + 0.15 * d('force')),
    drag: rond5(1 - 0.15 * d('endurance')),
    chute: rond5(1 - 0.6 * d('technique')),
  };
}
function rond5(v: number) { return Math.round(v * 1e5) / 1e5; }

export type Resultat = {
  niveau: number;
  epreuve: Epreuve;
  place: number;
  chrono: number | null;
  qualifie: boolean;
  prime: number;
  reputation: number;
  /** Champion du monde ? */
  sommet: boolean;
};

/**
 * Ranger une competition courue. Les trois premiers montent d'un niveau ;
 * les autres retentent le meme `ecart` semaines plus tard.
 */
export function conclureLaCompetition(a: Athlete, epreuve: Epreuve, place: number, chrono: number | null): Resultat {
  const niveau = a.niveau;
  const c = COMPETITIONS[niveau];
  const podium = chrono !== null && place <= QUALIFIES;
  const prime = podium ? Math.round(c.prime * (place === 1 ? 1 : place === 2 ? 0.6 : 0.4)) : 0;
  const rep = podium ? Math.round(c.reputation * (place === 1 ? 1 : 0.6)) : Math.round(c.reputation * 0.15);
  a.argent += prime;
  a.reputation += rep;
  a.abonnes += rep * (a.niveau >= NATIONAL ? 40 : 10);
  a.moral = borne(a.moral + (place === 1 ? 15 : podium ? 8 : -10), 0, 100);
  a.palmares.unshift({ s: a.semaine, niveau, epreuve, place, chrono });
  const sommet = niveau === COMPETITIONS.length - 1 && place === 1 && chrono !== null;
  if (podium && niveau < COMPETITIONS.length - 1) a.niveau += 1;
  a.prochaine = a.semaine + ecart(a.niveau);
  // Un nouveau cycle commence : l'assiduite se recompte jusqu'a la prochaine.
  a.assiduite = { proposees: 0, faites: 0 };
  return { niveau, epreuve, place, chrono, qualifie: podium && niveau < COMPETITIONS.length - 1, prime, reputation: rep, sommet };
}

/** Ne pas aller a la competition (pas les moyens, blesse, ou choix). */
export function declarerForfait(a: Athlete) {
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
  if (a.niveau >= NATIONAL && rdv && rdv.id !== a.rendezVous) return { jour: maintenant >= rdv.debut, date: rdv.debut };
  return { jour: jourDeCompetition(a), date: null };
}

/* ------------------------------------------------------------ la semaine */

export const ARGENT_DE_POCHE = 30;

/**
 * Tourner la page de la semaine : le repos du dimanche, l'argent de poche,
 * les sponsors, la blessure qui guerit. Ne tire PAS l'evenement de la
 * semaine (recit.ts s'en charge, il connait les histoires).
 */
export function finirLaSemaine(a: Athlete) {
  const recup = a.materiel.reduce((s, id) => s + (piece(id)?.recup || 0), 0);
  a.fatigue = borne(a.fatigue - 45 - recup, 0, 100);
  if (a.origine === 'aisee') a.argent += ARGENT_DE_POCHE;
  a.argent += a.sponsors.length * 60;
  // Trois seances proposees par semaine (le samedi reste un bonus).
  if (a.blessure === 0) a.assiduite.proposees += 3;
  const faitesSemaine = a.faites.filter(j => j !== 'samedi').length;
  if (a.blessure === 0 && faitesSemaine === 0) a.moral = borne(a.moral - 5, 0, 100);
  if (a.blessure > 0) a.blessure -= 1;
  a.semaine += 1;
  a.faites = [];
  a.boulot = null;
  a.kine = false;
  a.footing = false;
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
  if (enSemaine(a) && h0 < 9 * 60 && h >= 9 * 60 && !a.cours) {
    a.ecole = borne((a.ecole ?? 60) - 5, 0, 100);
    a.moral = borne(a.moral - 3, 0, 100);
    noter(a, 'Absent au collège : le CPE a appelé à la maison.', 'Missed school: the office called home.');
    out.push('absence');
  }
  while (h >= 24 * 60) { h -= 24 * 60; a.jour = (jourDe(a) + 1) % 7; a.cours = false; }
  a.heure = h;
  if (b.energie <= 0) out.push('epuise');
  // un ventre vide et une tete fatiguee pesent sur le moral
  if (b.faim < 15 || b.energie < 15) a.moral = borne(a.moral - minutes / 60, 0, 100);
  return out;
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
  quand?: [number, number];
  semaine?: boolean;
};

export const ACTIONS: Action[] = [
  { id: 'dormir', lieu: 'maison', duree: 'nuit', effets: {}, quand: [20 * 60, 24 * 60 - 1] },
  { id: 'sieste', lieu: 'maison', duree: 60, effets: { energie: 16 } },
  { id: 'manger', lieu: 'maison', duree: 30, effets: { faim: 60, social: 6 } },
  { id: 'douche', lieu: 'maison', duree: 15, effets: { hygiene: 85 } },
  { id: 'devoirs', lieu: 'maison', duree: 60, effets: { plaisir: -6 }, quand: [16 * 60, 23 * 60] },
  { id: 'console', lieu: 'maison', duree: 60, effets: { plaisir: 40, energie: -2 } },
  { id: 'telephone', lieu: 'maison', duree: 30, effets: { social: 28, plaisir: 6 } },
  { id: 'cours', lieu: 'college', duree: 'cours', effets: { social: 30, faim: 45, energie: -10 }, quand: [7 * 60, 9 * 60], semaine: true },
  { id: 'pizza', lieu: 'livraison', duree: 40, cout: 12, effets: { faim: 70, plaisir: 16 } },
  { id: 'fruits', lieu: 'marche', duree: 15, cout: 5, effets: { faim: 25, energie: 4 }, quand: [8 * 60, 13 * 60] },
  { id: 'discuter_parc', lieu: 'parc', duree: 30, effets: { social: 22, plaisir: 8 } },
  { id: 'discuter_club', lieu: 'club', duree: 30, effets: { social: 25 } },
];
export const action = (id: string) => ACTIONS.find(x => x.id === id);

/** Peut-on faire cette action maintenant ? Rend la raison sinon. */
export function actionPossible(a: Athlete, id: string): null | 'heure' | 'argent' | 'fait' | 'week-end' {
  const x = action(id); if (!x) return 'heure';
  if (x.semaine && !enSemaine(a)) return 'week-end';
  if (x.id === 'cours' && a.cours) return 'fait';
  const h = heureDe(a);
  if (x.quand && (h < x.quand[0] || h > x.quand[1])) return 'heure';
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
  if (x.cout) a.argent -= x.cout;
  if (x.duree === 'nuit') { dormir(a); return null; }
  if (x.duree === 'cours') {
    a.cours = true;
    a.ecole = borne((a.ecole ?? 60) + 3, 0, 100);
    avancer(a, Math.max(30, 16 * 60 + 30 - heureDe(a)), x.effets);
    return null;
  }
  avancer(a, x.duree, x.effets);
  if (x.moral) a.moral = borne(a.moral + x.moral, 0, 100);
  if (id === 'devoirs') a.ecole = borne((a.ecole ?? 60) + 2, 0, 100);
  return null;
}

/** Dormir jusqu'au reveil. Les heures de sommeil font l'energie (8 h : plein). */
export function dormir(a: Athlete) {
  const b = besoinsDe(a), h = heureDe(a);
  const duree = h <= REVEIL ? REVEIL - h : 24 * 60 - h + REVEIL;
  const dimanche = jourDe(a) === DIMANCHE && h > REVEIL;
  // la nuit : la faim baisse doucement, l'energie remonte, les muscles recuperent
  b.energie = borne(b.energie + duree / 60 * 12.5, 0, 100);
  b.faim = borne(b.faim - duree / 60 * 2.5, 0, 100);
  b.hygiene = borne(b.hygiene - duree / 60 * 1.5, 0, 100);
  a.fatigue = borne(a.fatigue - duree / 60 * 0.6, 0, 100);
  if (duree < 7 * 60) a.moral = borne(a.moral - 4, 0, 100);
  if (h > REVEIL) { a.jour = (jourDe(a) + 1) % 7; a.cours = false; }
  a.heure = REVEIL;
  // le dimanche soir, la semaine tourne ; une competition manquee est un forfait
  if (dimanche) {
    if (jourDeCompetition(a)) declarerForfait(a);
    finirLaSemaine(a);
  }
}
