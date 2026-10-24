// LES MOTS DE LA CARRIERE D'ATHLETE, en [francais, anglais].
//
// Ici et non dans sprinter-i18n.js, pour la raison de la Legende
// (legende/mots.ts) : tout le mode doit sortir du paquet public d'un seul
// drapeau, et une table posee sur un global y resterait.

import type { Jour } from './regles';

const MOTS: Record<string, [string, string]> = {
  titre:        ['CARRIÈRE D’ATHLÈTE', 'ATHLETE CAREER'],
  sous:         ['De la compétition scolaire aux Mondiaux. Ton club, ton coach, ta vie.', 'From the school meet to the Worlds. Your club, your coach, your life.'],
  creer:        ['CRÉER MON ATHLÈTE', 'CREATE MY ATHLETE'],
  ouvrir:       ['OUVRIR MA CARRIÈRE', 'OPEN MY CAREER'],
  fermer:       ['FERMER', 'CLOSE'],
  semaine:      ['SEMAINE {n}', 'WEEK {n}'],
  argent:       ['{n} €', '€{n}'],
  fatigue:      ['Fatigue', 'Fatigue'],
  moral:        ['Moral', 'Morale'],
  vitesse:      ['Vitesse', 'Speed'],
  force:        ['Force', 'Strength'],
  technique:    ['Technique', 'Technique'],
  endurance:    ['Endurance', 'Endurance'],
  // la creation
  famille:      ['TA FAMILLE', 'YOUR FAMILY'],
  aisee:        ['Famille aisée', 'Well-off family'],
  aisee_d:      ['600 € de départ, pointes et tenue offertes, 30 € d’argent de poche par semaine, déplacements payés par les parents.', '€600 to start, spikes and kit provided, €30 pocket money a week, parents pay for travel.'],
  modeste:      ['Famille modeste', 'Low-income family'],
  modeste_d:    ['20 € en poche. Petits boulots pour payer l’équipement et les déplacements. Le club de quartier t’ouvre ses portes.', '€20 in your pocket. Odd jobs to pay for kit and travel. The neighbourhood club opens its doors.'],
  voie:         ['TA VOIE', 'YOUR PATH'],
  polyvalent:   ['Toucher à tout', 'Try everything'],
  polyvalent_d: ['100, 200, 400 : tu choisis à chaque compétition. Le coach te demandera de te spécialiser plus tard.', '100, 200, 400: pick at every meet. Your coach will ask you to specialise later.'],
  specialiste:  ['Se spécialiser direct', 'Specialise now'],
  specialiste_d:['Une seule épreuve, et +20 % sur les qualités qui la font.', 'One event, and +20% on the qualities that make it.'],
  lancer:       ['COMMENCER L’HISTOIRE', 'START THE STORY'],
  // la semaine
  lundi:        ['LUNDI', 'MONDAY'],
  mercredi:     ['MERCREDI', 'WEDNESDAY'],
  vendredi:     ['VENDREDI', 'FRIDAY'],
  samedi:       ['SAMEDI · BONUS', 'SATURDAY · BONUS'],
  dimanche:     ['DIMANCHE', 'SUNDAY'],
  faite:        ['FAITE', 'DONE'],
  blesse:       ['BLESSÉ', 'INJURED'],
  pris:         ['AU TRAVAIL', 'AT WORK'],
  sentrainer:   ['S’ENTRAÎNER', 'TRAIN'],
  repos:        ['Repos', 'Rest'],
  fin_semaine:  ['FINIR LA SEMAINE', 'END THE WEEK'],
  seul:         ['Sans coach : tu t’entraînes seul.', 'No coach: you train alone.'],
  // la competition
  competition:  ['COMPÉTITION', 'COMPETITION'],
  dans:         ['dans {n} sem.', 'in {n} wk'],
  ce_dimanche:  ['CE DIMANCHE', 'THIS SUNDAY'],
  courir:       ['COURIR', 'RACE'],
  forfait:      ['FORFAIT', 'WITHDRAW'],
  deplacement:  ['Déplacement : {n} €', 'Travel: €{n}'],
  paye:         ['Déplacement payé', 'Travel paid'],
  pas_moyens:   ['Pas les moyens du déplacement', 'Can’t afford the trip'],
  objectif:     ['Objectif : {o}', 'Goal: {o}'],
  pic:          ['PIC DE FORME', 'PEAK FORM'],
  assiduite:    ['Assiduité du cycle : {f}/{p}', 'Cycle attendance: {f}/{p}'],
  scolaire:     ['Compétition scolaire', 'School meet'],
  regionaux:    ['Championnats régionaux', 'Regional championships'],
  france:       ['Championnats de France', 'French championships'],
  europe:       ['Championnats d’Europe', 'European championships'],
  monde:        ['Championnats du Monde', 'World championships'],
  // l'argent
  boulots:      ['PETITS BOULOTS', 'ODD JOBS'],
  boulot_pris:  ['Boulot de la semaine fait.', 'This week’s job is done.'],
  babysitting:  ['Baby-sitting', 'Babysitting'],
  livraison:    ['Livraison à vélo', 'Bike delivery'],
  marche:       ['Marché du samedi', 'Saturday market'],
  prend_samedi: ['prend la séance du samedi', 'takes the Saturday session'],
  boutique:     ['MATÉRIEL', 'GEAR'],
  acheter:      ['ACHETER', 'BUY'],
  possede:      ['À TOI', 'OWNED'],
  pointes1:     ['Pointes d’entrée de gamme', 'Entry-level spikes'],
  pointes2:     ['Pointes de compétition', 'Racing spikes'],
  pointes3:     ['Pointes carbone', 'Carbon spikes'],
  tenue:        ['Tenue de compétition', 'Racing kit'],
  elastiques:   ['Élastiques de résistance', 'Resistance bands'],
  plots:        ['Plots et échelle de rythme', 'Cones and agility ladder'],
  montre:       ['Montre GPS', 'GPS watch'],
  starting:     ['Starting-blocks perso', 'Personal starting blocks'],
  recup:        ['Kit de récupération', 'Recovery kit'],
  en_course:    ['en course', 'in races'],
  seance_plus:  ['séance du {j} +15 %', '{j} session +15%'],
  recup_d:      ['fatigue −{n} chaque semaine', 'fatigue −{n} every week'],
  // le club
  club:         ['CLUB', 'CLUB'],
  sans_club:    ['Pas encore de club', 'No club yet'],
  horizon:      ['Club Athlé Horizon', 'Club Athlé Horizon'],
  quartier:     ['Foulées du Quartier', 'Foulées du Quartier'],
  mireille:     ['Coach Mireille', 'Coach Mireille'],
  dede:         ['Coach Dédé', 'Coach Dédé'],
  rel_coach:    ['Coach', 'Coach'],
  rel_club:     ['Club', 'Club'],
  rel_rival:    ['Rival', 'Rival'],
  reputation:   ['Réputation {n}', 'Reputation {n}'],
  abonnes:      ['{n} abonnés', '{n} followers'],
  sponsors:     ['Sponsors : {n}', 'Sponsors: {n}'],
  journal:      ['JOURNAL', 'LOG'],
  palmares:     ['PALMARÈS', 'RECORD'],
  recommencer:  ['Recommencer une carrière', 'Start a new career'],
  sur:          ['Effacer cet athlète ? ', 'Delete this athlete? '],
  oui:          ['OUI', 'YES'],
  non:          ['NON', 'NO'],
  // la seance
  pret:         ['Alterne ← → (ou les deux zones) le plus juste possible.', 'Alternate ← → (or the two zones) as cleanly as you can.'],
  go:           ['GO', 'GO'],
  frequence_d:  ['Fréquence max : le plus d’appuis alternés en 6 s.', 'Max frequency: as many alternating taps as you can in 6 s.'],
  charge_d:     ['Sous charge : tiens une cadence haute pendant 10 s.', 'Under load: hold a high cadence for 10 s.'],
  rythme_d:     ['Rythme : tape sur chaque battement, gauche puis droite.', 'Rhythm: tap on every beat, left then right.'],
  tempo_d:      ['Tempo : reste dans la zone verte pendant 16 s.', 'Tempo: stay in the green zone for 16 s.'],
  appuis:       ['{n} appuis/s', '{n} taps/s'],
  score:        ['Qualité de la séance : {n} %', 'Session quality: {n}%'],
  gains:        ['Gains', 'Gains'],
  blessure_s:   ['Blessé ! Deux semaines d’arrêt.', 'Injured! Two weeks off.'],
  continuer:    ['CONTINUER', 'CONTINUE'],
  gauche:       ['GAUCHE', 'LEFT'],
  droite:       ['DROITE', 'RIGHT'],
  // la fin de course
  qualifie:     ['QUALIFIÉ·E POUR : {c}', 'QUALIFIED FOR: {c}'],
  pas_qualifie: ['Pas de podium. Prochaine chance dans 4 semaines.', 'No podium. Next chance in 4 weeks.'],
  prime:        ['Prime : {n} €', 'Prize: €{n}'],
  rep_plus:     ['Réputation +{n}', 'Reputation +{n}'],
  sommet:       ['CHAMPION·NE DU MONDE', 'WORLD CHAMPION'],
  place:        ['{o} place', '{o} place'],
  faux:         ['FAUX DÉPART', 'FALSE START'],
  retour_carriere: ['RETOUR À LA CARRIÈRE', 'BACK TO CAREER'],
};

export function lang(): 'fr' | 'en' {
  const N = (globalThis as any).SprinterI18N;
  return N && N.getLang && N.getLang() === 'en' ? 'en' : 'fr';
}

export function mot(k: string, p: Record<string, string | number> = {}): string {
  const m = MOTS[k];
  let s = m ? m[lang() === 'en' ? 1 : 0] : k;
  for (const c of Object.keys(p)) s = s.split(`{${c}}`).join(String(p[c]));
  return s;
}

/** Un texte [fr, en] dans la langue du jeu. */
export const dans = (t: [string, string]) => t[lang() === 'en' ? 1 : 0];

/* ------------------------------------------------ les seances du programme */

// DE VRAIES SEANCES DE SPRINT, ecrites pour l'exemple. Le jour ou des coachs
// partenaires apporteront les leurs, elles prendront cette place.
const PROGRAMME: Record<Jour, [string, string][]> = {
  lundi: [
    ['6 × 30 m départ accroupi, récup 3’', '6 × 30 m crouch starts, 3’ rest'],
    ['4 × 40 m lancés, récup complète', '4 × 40 m flying, full rest'],
    ['3 × 60 m à 95 %, récup 5’', '3 × 60 m at 95%, 5’ rest'],
  ],
  mercredi: [
    ['Côtes : 8 × 60 m', 'Hills: 8 × 60 m'],
    ['Muscu : squat 4 × 5, fentes 3 × 8', 'Gym: squat 4 × 5, lunges 3 × 8'],
    ['Bondissements 5 × 30 m + gainage', 'Bounding 5 × 30 m + core'],
  ],
  vendredi: [
    ['Gammes : montées de genoux, talons-fesses', 'Drills: high knees, butt kicks'],
    ['Départs en blocs : 8 × 15 m', 'Block starts: 8 × 15 m'],
    ['Virage : 4 × 80 m en courbe', 'Bend: 4 × 80 m on the curve'],
  ],
  samedi: [
    ['Tempo : 6 × 150 m à 75 %', 'Tempo: 6 × 150 m at 75%'],
    ['2 × (3 × 200 m), récup 2’/6’', '2 × (3 × 200 m), 2’/6’ rest'],
    ['Lactique : 2 × 300 m', 'Lactic: 2 × 300 m'],
  ],
};

const SEUL: Record<Jour, [string, string]> = {
  lundi: ['Accélérations au parc', 'Strides in the park'],
  mercredi: ['Pompes et escaliers de l’immeuble', 'Push-ups and the stairwell'],
  vendredi: ['Éducatifs vus sur YouTube', 'Drills from YouTube'],
  samedi: ['Footing de 30 minutes', '30-minute jog'],
};

/** La seance du jour, selon la semaine et la presence d'un coach. */
export function seanceDuJour(j: Jour, semaine: number, coach: boolean): string {
  if (!coach) return dans(SEUL[j]);
  const l = PROGRAMME[j];
  return dans(l[semaine % l.length]);
}
