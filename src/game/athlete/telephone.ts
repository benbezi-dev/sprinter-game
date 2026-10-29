// LE TELEPHONE DE LA CARRIERE D'ATHLETE — le centre de commande, comme dans
// Lagos Life (docs/carriere-athlete.md, « le telephone »).
//
// Ce fichier tient ce que le telephone sait, sans rien dessiner : les messages
// qui arrivent (au reveil, apres une course), le classement de la categorie,
// les trajets (a pied, a velo, en bus) et l'agenda de la semaine. L'ecran est
// dans CarriereAthlete.tsx.

import {
  type Athlete, type Epreuve, type Resultat, type Jour,
  COMPETITIONS, JOURS, JOUR_DE, DIMANCHE, EPREUVES,
  exerciceDuJour, lieuDeLExercice, jourDeCompetition, jourDe, heureDe, besoinsDe, avancer, payer, etape, categorie,
} from './regles';
import { type Personne, lienDe } from './gens';
import { EXOS, MOTS } from './mots';

export type Texte = [string, string];

/* ------------------------------------------------------------------ les messages */

/** Qui ecrit : une personne du jeu, le club, ou la banque. */
export type Auteur = Personne | 'club' | 'banque';

export function envoyer(a: Athlete, de: Auteur, t: Texte) {
  (a.messages ||= []).unshift({ de, fr: t[0], en: t[1], s: a.semaine, j: jourDe(a), h: heureDe(a) });
  if (a.messages.length > 40) a.messages.length = 40;
}
export const nonLus = (a: Athlete) => (a.messages || []).filter(m => !m.lu).length;
export function toutLire(a: Athlete) { for (const m of a.messages || []) m.lu = true; }

const parmi = <T,>(l: T[], alea: () => number) => l[Math.floor(alea() * l.length) % l.length];
const LIEUX_COURTS: Record<string, Texte> = {
  stade: ['au stade', 'at the stadium'], cote: ['à la côte', 'on the hill'], parc: ['au parc', 'in the park'],
  club_quartier: ['à la salle du club', 'at the club gym'], club_horizon: ['à la salle du club', 'at the club gym'],
};

/**
 * Ce qui arrive au reveil, selon le jour : le coach rappelle la seance, Ines
 * propose de sortir, Yanis chambre avant la course, les parents s'inquietent,
 * la banque previent. Appele quand on se leve (carriere.ts, agir).
 */
export function messagesDuReveil(a: Athlete, alea: () => number = Math.random) {
  const j = jourDe(a), b = besoinsDe(a);
  const seance = JOURS.find(x => JOUR_DE[x] === j) as Jour | undefined;
  if (seance && a.club) {
    const ex = exerciceDuJour(a, seance), ou = LIEUX_COURTS[lieuDeLExercice(a, ex)];
    const h = seance === 'samedi' ? '10 h' : '18 h';
    envoyer(a, 'coach', [`Ce soir ${h} : ${EXOS[ex].nom[0].toLowerCase()}, ${ou[0]}. Sois à l’heure.`, `${seance === 'samedi' ? 'Today 10 am' : 'Tonight 6 pm'}: ${EXOS[ex].nom[1].toLowerCase()}, ${ou[1]}. Be on time.`]);
  } else if (seance && alea() < 0.35) {
    envoyer(a, 'amie', ['Tu t’entraînes ce soir ? Je viens t’encourager si tu veux 😄', 'Training tonight? I can come and cheer if you like 😄']);
  }
  // la course de dimanche
  if (jourDeCompetition(a)) {
    const nom = MOTS[COMPETITIONS[a.niveau].cle];
    if (j === 4) envoyer(a, a.club ? 'coach' : 'prof', [`Dimanche : ${nom[0]}. Pas de folie samedi, couche-toi tôt.`, `Sunday: ${nom[1]}. Nothing crazy on Saturday, early night.`]);
    if (j === 5 && lienDe(a, 'rival') < 0) envoyer(a, 'rival', parmi<Texte>([['Demain je te mets deux mètres.', 'Tomorrow I put two metres on you.'], ['Profite de ta dernière nuit de sommeil tranquille 😏', 'Enjoy your last quiet night’s sleep 😏']], alea));
    if (j === DIMANCHE) envoyer(a, 'maman', ['Bonne course mon cœur. On est fiers de toi, quoi qu’il arrive.', 'Good luck today love. We’re proud of you, whatever happens.']);
  }
  // Ines, la vie a cote
  if (j < 5 && alea() < 0.3) envoyer(a, 'amie', etape(a) === 'adulte' ? ['Pause café à 10 h ?', 'Coffee break at 10?'] : ['Parc après les cours ?', 'Park after school?']);
  if (j >= 5 && alea() < 0.4) envoyer(a, 'amie', ['Pizza ce soir ? 🍕', 'Pizza tonight? 🍕']);
  // la famille veille
  if (etape(a) !== 'adulte') {
    if (b.hygiene < 35) envoyer(a, 'maman', ['Douche. Tout de suite. 😅', 'Shower. Right now. 😅']);
    if ((a.ecole ?? 60) < 45) envoyer(a, 'papa', ['Le collège a appelé. On en parle ce soir.', 'School called. We’ll talk tonight.']);
  } else if (j === 0) envoyer(a, 'prof', ['Point d’équipe à 9 h lundi, sois là.', 'Team meeting at 9 on Monday, be there.']);
  if (a.argent < 0) envoyer(a, 'banque', [`Votre compte est à découvert (${a.argent} €).`, `Your account is overdrawn (€${a.argent}).`]);
}

/** Le premier matin : la famille et Ines souhaitent bonne chance. */
export function messagesDeBienvenue(a: Athlete) {
  if (etape(a) === 'adulte') envoyer(a, 'maman', ['Alors, ce premier matin dans ton appart ? Passe manger dimanche.', 'So, first morning in your flat? Come for lunch on Sunday.']);
  else envoyer(a, 'maman', ['Bonne première journée ! Le petit-déj est sur la table.', 'Have a great first day! Breakfast is on the table.']);
  envoyer(a, 'amie', ['Alors, il paraît que tu te mets à l’athlé ?? 😄 Je veux tout savoir.', 'So I hear you’re getting into athletics?? 😄 Tell me everything.']);
}

/** Les reactions a une course : la famille, l'amie, le coach, le rival. */
export function messagesDeCourse(a: Athlete, r: Resultat) {
  const podium = r.chrono !== null && r.place <= 3, ch = r.chrono !== null ? r.chrono.toFixed(2) : '';
  if (r.chrono === null) {
    envoyer(a, 'maman', ['Un faux départ, ça arrive aux plus grands. Rentre, il y a des crêpes.', 'False starts happen to the best. Come home, there are pancakes.']);
    if (a.club) envoyer(a, 'coach', ['On retravaille la concentration au départ cette semaine.', 'We work on start focus this week.']);
    return;
  }
  if (r.record) envoyer(a, 'amie', [`RECORD PERSO !!! ${ch} 🔥🔥🔥`, `PERSONAL BEST!!! ${ch} 🔥🔥🔥`]);
  if (podium) {
    envoyer(a, 'papa', [`${r.place === 1 ? 'VAINQUEUR' : 'Sur le podium'} ! J’ai tout filmé.`, `${r.place === 1 ? 'WINNER' : 'On the podium'}! I filmed everything.`]);
    if (a.club) envoyer(a, 'coach', [`${ch}. Bien. Lundi on repart au travail.`, `${ch}. Good. Back to work on Monday.`]);
    if (lienDe(a, 'rival') < 0) envoyer(a, 'rival', ['Profite. La prochaine est à moi.', 'Enjoy it. The next one’s mine.']);
  } else {
    envoyer(a, 'maman', [`${r.place}e en ${ch}. Tu progresses, c’est ça qui compte.`, `${r.place}th in ${ch}. You’re improving, that’s what matters.`]);
    if (a.club) envoyer(a, 'coach', ['Pas de podium. On regarde la vidéo mardi, on corrige.', 'No podium. We watch the video on Tuesday and fix it.']);
  }
}

/* ------------------------------------------------------------------ le classement */

// LE CLASSEMENT DE LA CATEGORIE. Quarante sprinteurs inventes par categorie et
// par epreuve, toujours les memes (un tirage fixe) ; ta place vient de ton
// record personnel. Les chronos sont ceux du jeu (l'echelle des plateaux du
// moteur), pas ceux d'un classement reel : aucun vrai athlete n'y figure.
const MEILLEUR_100: Record<string, number> = { Benjamin: 12.3, Minime: 11.4, Cadet: 10.9, Junior: 10.5, Espoir: 10.25, Senior: 10.0, Master: 10.9 };
const FACTEUR: Record<Epreuve, number> = { '100': 1, '200': 2.03, '400': 4.6 };
const PRENOMS = ['Rayan', 'Lucas', 'Noah', 'Adam', 'Ibrahim', 'Hugo', 'Mamadou', 'Enzo', 'Kenzo', 'Sacha', 'Ilyes', 'Nathan', 'Moussa', 'Théo', 'Amine', 'Jules', 'Sofiane', 'Malik', 'Tom', 'Kylian'];
const PRENOMS_F = ['Lina', 'Jade', 'Aïcha', 'Léa', 'Maëlys', 'Fatou', 'Chloé', 'Inaya', 'Sarah', 'Manon', 'Awa', 'Zoé', 'Nour', 'Emma', 'Kenza', 'Louise', 'Maryam', 'Lola', 'Assia', 'Romane'];
const NOMS = 'BDKMTLSNRGHCPFV';
const fixe = (i: number) => ((Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1 + 1) % 1;

export type Ligne = { nom: string; temps: number | null; moi?: boolean; rang: number };

export function classement(a: Athlete, e: Epreuve): { lignes: Ligne[]; moi: Ligne; categorie: Texte; total: number } {
  const cat = categorie(a.age ?? 14), f = (a.apparence?.corps || 'f') === 'f';
  const base = MEILLEUR_100[cat[0]] * FACTEUR[e] * (f ? 1.1 : 1), ecart = 2.8 * FACTEUR[e];
  const graine = cat[0].length * 101 + EPREUVES.indexOf(e) * 7 + (f ? 3 : 0);
  const autres: Ligne[] = Array.from({ length: 39 }, (_, i) => ({
    nom: `${(f ? PRENOMS_F : PRENOMS)[Math.floor(fixe(graine + i) * 20)]} ${NOMS[Math.floor(fixe(graine + i + 50) * NOMS.length)]}.`,
    temps: Math.round((base + ecart * Math.pow(fixe(graine + i * 3 + 1), 0.8)) * 100) / 100,
    rang: 0,
  }));
  const record = a.records?.[e] ?? null;
  const moi: Ligne = { nom: a.nom, temps: record, moi: true, rang: 0 };
  const tous = [...autres, moi].sort((x, y) => (x.temps ?? 999) - (y.temps ?? 999));
  tous.forEach((l, i) => { l.rang = i + 1; });
  return { lignes: tous, moi, categorie: cat, total: tous.length };
}

/* ------------------------------------------------------------------ les trajets */

export type Mode = 'pied' | 'velo' | 'bus';
export const TICKET = 1;

/** Ce que coute un trajet : en minutes de jeu, en euros, et pourquoi c'est impossible. */
export function trajet(a: Athlete, mode: Mode, metres: number): { minutes: number; prix: number; refus: Texte | null } {
  const h = heureDe(a);
  if (mode === 'pied') return { minutes: Math.max(1, Math.round(metres / 75)), prix: 0, refus: null };
  if (mode === 'velo') return { minutes: Math.max(1, Math.round(metres / 250) + 2), prix: 0, refus: a.velo ? null : ['Pas de vélo (à la boutique)', 'No bike (at the shop)'] };
  const refus: Texte | null = h < 6 * 60 || h > 22 * 60 ? ['Plus de bus à cette heure', 'No buses at this time'] : a.argent < TICKET ? ['Pas de quoi payer le ticket', 'Can’t pay the ticket'] : null;
  return { minutes: Math.round(metres / 400) + 8, prix: TICKET, refus };
}

/** Faire le trajet : le temps passe, on paie le ticket ; le velo et la marche fatiguent un peu. */
export function voyager(a: Athlete, mode: Mode, metres: number): Texte | null {
  const t = trajet(a, mode, metres);
  if (t.refus) return t.refus;
  if (t.prix) payer(a, -t.prix, 'Ticket de bus', 'Bus ticket');
  avancer(a, t.minutes, mode === 'bus' ? {} : { energie: -Math.min(8, metres / 600), hygiene: -Math.min(6, metres / 900) });
  return null;
}

/* ------------------------------------------------------------------ l'agenda */

export type Rendez = { quand: [number, number]; quoi: Texte; ou: string };

/** La semaine, jour par jour : l'ecole ou le travail, les seances, la competition. */
export function agenda(a: Athlete): Rendez[][] {
  const e = etape(a);
  const jours: Rendez[][] = Array.from({ length: 7 }, () => []);
  for (let j = 0; j < 5; j++) {
    jours[j].push(e === 'adulte'
      ? { quand: [9 * 60, 17 * 60], quoi: ['Travail', 'Work'], ou: 'travail' }
      : { quand: [8 * 60, 16 * 60 + 30], quoi: ['Cours', 'Classes'], ou: e === 'lycee' ? 'lycee' : 'college' });
  }
  for (const s of JOURS) {
    const ex = exerciceDuJour(a, s);
    jours[JOUR_DE[s]].push({ quand: s === 'samedi' ? [10 * 60, 11 * 60 + 30] : [18 * 60, 19 * 60 + 30], quoi: EXOS[ex].nom, ou: lieuDeLExercice(a, ex) });
  }
  if (jourDeCompetition(a)) jours[DIMANCHE].push({ quand: [9 * 60, 18 * 60], quoi: MOTS[COMPETITIONS[a.niveau].cle], ou: 'gare' });
  return jours;
}
