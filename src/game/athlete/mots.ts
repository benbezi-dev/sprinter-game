// LES MOTS DE LA CARRIERE D'ATHLETE, en [francais, anglais].
//
// Ici et non dans sprinter-i18n.js, pour la raison de la Legende
// (legende/mots.ts) : tout le mode doit sortir du paquet public d'un seul
// drapeau, et une table posee sur un global y resterait.

import { type Jour, type Athlete, type Exercice, exerciceDuJour } from './regles';

export const MOTS: Record<string, [string, string]> = {
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
  departementaux: ['Championnats départementaux', 'County championships'],
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
  direct:       ['En même temps que le vrai championnat en direct.', 'At the same time as the real live championship.'],
  pas_qualifie: ['Pas de podium. Prochaine chance dans {n} semaines.', 'No podium. Next chance in {n} weeks.'],
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

/* ------------------------------------------------ les exercices */

// Le nom, la seance telle que l'entraineur l'ecrit, et ce qu'on fait au
// mini-jeu. Des seances reelles de sprinteur, ecrites pour l'exemple : le jour
// ou des coachs partenaires apporteront les leurs, elles prendront cette place.
export const EXOS: Record<Exercice, { nom: [string, string]; serie: [string, string]; seul: [string, string]; jeu: [string, string] }> = {
  departs: {
    nom: ['Départs en blocs', 'Block starts'],
    serie: ['8 × 20 m départ en blocs, récup 3’', '8 × 20 m from the blocks, 3’ rest'],
    seul: ['Départs accroupis sur l’herbe', 'Crouch starts on the grass'],
    jeu: ['« À vos marques… Prêts… » Pars au coup de pistolet, pas avant : un faux départ et l’essai compte pour rien.', '“On your marks… Set…” Go on the gun, not before: a false start wastes the attempt.'],
  },
  lancee: {
    nom: ['Vitesse lancée', 'Flying sprints'],
    serie: ['4 × 30 m lancés après 20 m d’élan', '4 × 30 m flying after a 20 m run-up'],
    seul: ['Accélérations au parc', 'Strides in the park'],
    jeu: ['Prends ton élan, puis tape le plus vite possible dans la zone lancée.', 'Build up, then tap as fast as you can through the flying zone.'],
  },
  gammes: {
    nom: ['Gammes', 'Drills'],
    serie: ['Montées de genoux, talons-fesses, pas chassés', 'High knees, butt kicks, side shuffles'],
    seul: ['Éducatifs vus sur YouTube', 'Drills from YouTube'],
    jeu: ['Suis l’éducatif : tape du bon côté, au bon moment.', 'Follow the drill: tap the right side, on time.'],
  },
  virage: {
    nom: ['Virage', 'Bend running'],
    serie: ['4 × 80 m en courbe, à la corde', '4 × 80 m on the bend, hugging the line'],
    seul: ['Courbes autour du rond-point', 'Curves round the roundabout'],
    jeu: ['Garde la cadence et reste dans ton couloir : la courbe te pousse dehors.', 'Keep the cadence and stay in your lane: the bend pushes you out.'],
  },
  cotes: {
    nom: ['Côtes', 'Hill sprints'],
    serie: ['8 × 60 m en côte, retour en marchant', '8 × 60 m uphill, walk back down'],
    seul: ['Côtes à la colline des pins', 'Hills on the pine hill'],
    jeu: ['Monte la côte avant la fin du temps : plus ça grimpe, plus chaque appui coûte.', 'Reach the top in time: the steeper it gets, the more each step costs.'],
  },
  muscu: {
    nom: ['Musculation', 'Weights'],
    serie: ['Squat 5 × 5, épaulé 4 × 3', 'Squat 5 × 5, clean 4 × 3'],
    seul: ['Pompes et escaliers de l’immeuble', 'Push-ups and the stairwell'],
    jeu: ['Appuie pour descendre, relâche dans la zone verte : la barre remonte.', 'Hold to go down, release in the green zone: the bar drives up.'],
  },
  bonds: {
    nom: ['Bondissements', 'Bounding'],
    serie: ['5 × 30 m foulées bondissantes', '5 × 30 m bounding'],
    seul: ['Sauts sur les marches', 'Jumps on the steps'],
    jeu: ['Tape au moment où le pied touche le sol : chaque bond bien rendu va plus loin.', 'Tap as the foot hits the ground: every good bounce goes further.'],
  },
  gainage: {
    nom: ['Gainage', 'Core'],
    serie: ['Planche 4 × 45 s, gainage latéral', 'Plank 4 × 45 s, side plank'],
    seul: ['Planche dans ta chambre', 'Plank in your bedroom'],
    jeu: ['Garde le corps aligné : corrige à gauche, à droite, sans trembler.', 'Keep your body straight: correct left and right, without shaking.'],
  },
  fractionne: {
    nom: ['Fractionné', 'Intervals'],
    serie: ['3 × 150 m à 90 %, récup 5’', '3 × 150 m at 90%, 5’ rest'],
    seul: ['Allers-retours entre deux lampadaires', 'Shuttles between two lampposts'],
    jeu: ['Tiens l’allure dans la zone, répétition après répétition : la fatigue la déplace.', 'Hold the pace in the zone, rep after rep: fatigue moves it.'],
  },
  tempo: {
    nom: ['Tempo', 'Tempo'],
    serie: ['6 × 150 m à 75 %, récup 1’', '6 × 150 m at 75%, 1’ rest'],
    seul: ['Footing de 30 minutes', '30-minute jog'],
    jeu: ['Reste dans la zone d’allure, ni trop vite ni trop lent, jusqu’au bout.', 'Stay in the pace zone, not too fast nor too slow, to the end.'],
  },
};

/** La seance du jour, telle qu'on la lit sur le tableau. */
export function seanceDuJour(a: Athlete, j: Jour): string {
  const e = EXOS[exerciceDuJour(a, j)];
  return dans(a.coach ? e.serie : e.seul);
}
