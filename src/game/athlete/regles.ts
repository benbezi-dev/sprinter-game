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

export type Jeu = 'frequence' | 'charge' | 'rythme' | 'tempo';

export const SEANCES: Record<Jour, { stat: Stat; secondaire: Stat; fatigue: number; jeu: Jeu }> = {
  lundi:    { stat: 'vitesse',   secondaire: 'technique', fatigue: 18, jeu: 'frequence' },
  mercredi: { stat: 'force',     secondaire: 'vitesse',   fatigue: 22, jeu: 'charge' },
  vendredi: { stat: 'technique', secondaire: 'force',     fatigue: 14, jeu: 'rythme' },
  samedi:   { stat: 'endurance', secondaire: 'force',     fatigue: 20, jeu: 'tempo' },
};

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

/* ------------------------------------------------------------ outils */

const borne = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rond = (v: number) => Math.round(v * 10) / 10;

export function noter(a: Athlete, fr: string, en: string) {
  a.journal.unshift({ s: a.semaine, fr, en });
  if (a.journal.length > 40) a.journal.length = 40;
}

/* ------------------------------------------------------------ la naissance */

export function nouvelAthlete(nom: string, origine: Origine, voie: Voie, specialite: Epreuve | null): Athlete {
  const aisee = origine === 'aisee';
  return {
    v: 2,
    nom: nom || 'TOI',
    origine,
    voie,
    specialite: voie === 'specialiste' ? (specialite || '100') : null,
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
  const base = 3.2 * q * encadrement * forme * outil * moral;
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
  if (a.fatigue >= 85 && alea() < 0.35) {
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
}
