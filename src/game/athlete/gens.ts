// LES GENS DE LA CARRIERE D'ATHLETE — ceux qu'on croise dans Val-de-Reuil.
//
// L'auteur, 25/10 : « attaque la tranche des gens : parents, coach, amis,
// rival dans la ville, avec leurs relations et des interactions »
// (docs/carriere-athlete.md, tranche 2).
//
// COMME DANS LES SIMS. Chacun a sa vie : il est quelque part selon le jour et
// l'heure (ouEst), on va le voir, on lui parle. Chaque relation va de -100 a
// 100 ; elle monte quand on s'en occupe et retombe doucement vers zero quand
// on l'oublie (une semaine sans se voir : deux points). Elle a des effets :
// - le coach   : une seance mieux encadree (jusqu'a +10 %) ;
// - les parents : un coup de pouce d'argent, le moral ;
// - l'amie     : le social qui tient, le moral ;
// - le rival   : la motivation (moral) quand ca chauffe, un allie quand ca va ;
// - la partenaire : une seance a deux rend plus.
//
// Les personnages du recit (recit.ts) gardent leurs noms : M. Roche, Coach
// Mireille, Coach Dede, Yanis. Le coach et le rival lisent et ecrivent
// `a.relations` (coach, rival) comme le recit ; les autres vivent dans `a.liens`.
// Ce fichier ne depend que des regles : l'ecran et la ville le lisent.

import { type Athlete, type Besoin, besoinsDe, jourDe, heureDe, avancer, noter } from './regles';

export type Personne = 'maman' | 'papa' | 'prof' | 'coach' | 'amie' | 'rival' | 'partenaire';
export type Texte = [string, string];

export const GENS: Record<Personne, { nom: (a: Athlete) => Texte; role: Texte; f: boolean }> = {
  maman: { nom: () => ['Ta mère', 'Your mum'], role: ['Famille', 'Family'], f: true },
  papa: { nom: () => ['Ton père', 'Your dad'], role: ['Famille', 'Family'], f: false },
  prof: { nom: () => ['M. Roche', 'Mr Roche'], role: ['Prof d’EPS', 'PE teacher'], f: false },
  coach: {
    nom: a => (a.club === 'horizon' ? ['Coach Mireille', 'Coach Mireille'] : ['Coach Dédé', 'Coach Dédé']),
    role: ['Ton entraîneur', 'Your coach'], f: false,
  },
  amie: { nom: () => ['Inès', 'Inès'], role: ['Ta meilleure amie', 'Your best friend'], f: true },
  rival: { nom: () => ['Yanis', 'Yanis'], role: ['Ton rival', 'Your rival'], f: false },
  partenaire: { nom: () => ['Lina', 'Lina'], role: ['Partenaire d’entraînement', 'Training partner'], f: true },
};
export const PERSONNES = Object.keys(GENS) as Personne[];

/* ---------------------------------------------------------------- ou ils sont */

type LieuDeVie = 'maison' | 'college' | 'stade' | 'club_quartier' | 'club_horizon' | 'parc' | 'marche' | 'gare';

const entre = (h: number, a: number, b: number) => h >= a * 60 && h < b * 60;
const JOURS_SEANCE = [0, 2, 4];                   // lundi, mercredi, vendredi

/** Ou est cette personne maintenant, ou null : on ne la croise pas. */
export function ouEst(a: Athlete, p: Personne): LieuDeVie | null {
  const j = jourDe(a), h = heureDe(a), semaine = j < 5;
  const salle: LieuDeVie = a.club === 'horizon' ? 'club_horizon' : 'stade';
  const seance = (JOURS_SEANCE.includes(j) && entre(h, 16.5, 20.5)) || (j === 5 && entre(h, 9, 13));
  switch (p) {
    case 'maman': return entre(h, 6.5, 8) || entre(h, 18, 23.5) || (!semaine && entre(h, 9, 23.5)) ? (j === 5 && entre(h, 9, 12) ? 'marche' : 'maison') : null;
    case 'papa': return entre(h, 6.5, 7.75) || entre(h, 19, 23.5) || (j === 6 && entre(h, 9, 23.5)) ? 'maison' : j === 5 && entre(h, 14, 18) ? 'stade' : null;
    case 'prof': return semaine && entre(h, 8, 17) ? 'college' : null;
    case 'coach': return a.club && seance ? salle : null;
    case 'amie': return semaine && entre(h, 8, 16.5) ? 'college' : (semaine && entre(h, 17, 20)) || (j === 5 && entre(h, 14, 19)) ? 'parc' : null;
    // Yanis s'entraine aux memes heures ; sans club, on le voit au stade municipal
    case 'rival': return seance ? (a.club ? salle : 'stade') : semaine && entre(h, 8, 16.5) ? 'college' : null;
    case 'partenaire': return a.club && seance ? salle : null;
  }
}

/* ---------------------------------------------------------------- les liens */

const borne = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));

export function lienDe(a: Athlete, p: Personne): number {
  if (p === 'coach') return a.relations.coach;
  if (p === 'rival') return a.relations.rival;
  return (a.liens ||= {})[p] ?? DEPART[p];
}
export function changerLien(a: Athlete, p: Personne, d: number) {
  if (p === 'coach') a.relations.coach = borne(a.relations.coach + d);
  else if (p === 'rival') a.relations.rival = borne(a.relations.rival + d);
  else (a.liens ||= {})[p] = borne(lienDe(a, p) + d);
}
/** Ou l'on en est au debut : la famille t'aime, l'amie aussi, les autres sont a faire. */
const DEPART: Record<Personne, number> = { maman: 50, papa: 40, prof: 10, coach: 0, amie: 45, rival: 0, partenaire: 5 };

/** Le mot d'une relation, comme les Sims l'affichent. */
export function etiquette(v: number): Texte {
  if (v <= -50) return ['En froid', 'At odds'];
  if (v < -15) return ['Tendu', 'Strained'];
  if (v < 15) return ['Connaissance', 'Acquaintance'];
  if (v < 50) return ['Bonne entente', 'Friendly'];
  if (v < 80) return ['Proche', 'Close'];
  return ['Inséparables', 'Inseparable'];
}

/** Une semaine sans se voir : chaque relation retombe de deux points vers zero. */
export function laSemainePasse(a: Athlete) {
  for (const p of PERSONNES) {
    if (p === 'coach' && !a.club) continue;
    const v = lienDe(a, p);
    if (Math.abs(v) >= 2 && !(a.vus_semaine || []).includes(p)) changerLien(a, p, v > 0 ? -2 : 2);
  }
  a.vus_semaine = [];
  a.argentParents = false;
}

/* ---------------------------------------------------------------- les interactions */

export type Interaction = {
  id: string;
  /** Avec qui c'est possible. */
  avec: Personne[];
  duree: number;
  texte: Texte;
  /** Ce qu'on ne peut faire qu'une fois par semaine, et pourquoi c'est refuse sinon. */
  possible?: (a: Athlete, p: Personne) => null | Texte;
  /** L'effet ; rend la replique de la personne. */
  faire: (a: Athlete, p: Personne, alea: () => number) => Texte;
};

const besoin = (a: Athlete, b: Besoin, d: number) => { const n = besoinsDe(a); n[b] = Math.max(0, Math.min(100, n[b] + d)); };
const moral = (a: Athlete, d: number) => { a.moral = Math.max(0, Math.min(100, a.moral + d)); };
const parmi = <T,>(l: T[], alea: () => number) => l[Math.floor(alea() * l.length) % l.length];

/** Les repliques, selon la relation : froide, neutre, chaleureuse. */
function replique(a: Athlete, p: Personne, froid: Texte[], neutre: Texte[], chaud: Texte[], alea: () => number): Texte {
  const v = lienDe(a, p);
  return parmi(v < -15 ? froid : v < 40 ? neutre : chaud, alea);
}

export const INTERACTIONS: Interaction[] = [
  {
    id: 'discuter', avec: PERSONNES, duree: 15, texte: ['Discuter', 'Chat'],
    faire: (a, p, alea) => {
      changerLien(a, p, 3 + Math.round(alea() * 3)); besoin(a, 'social', 14);
      return parle(a, p, alea);
    },
  },
  {
    id: 'plaisanter', avec: ['amie', 'rival', 'partenaire', 'papa'], duree: 10, texte: ['Plaisanter', 'Joke around'],
    faire: (a, p, alea) => {
      // ca passe ou ca casse : mieux on s'entend, plus ca passe
      const passe = alea() < 0.45 + lienDe(a, p) / 200;
      changerLien(a, p, passe ? 6 : -5); besoin(a, 'plaisir', passe ? 10 : 0); besoin(a, 'social', 8);
      return passe
        ? parmi<Texte>([['« Ha ! T’es trop bête. »', '“Ha! You’re such an idiot.”'], ['(fou rire)', '(laughs out loud)'], ['« Arrête, j’ai mal au ventre ! »', '“Stop, my stomach hurts!”']], alea)
        : parmi<Texte>([['« …C’était censé être drôle ? »', '“…Was that meant to be funny?”'], ['« Pas le moment. »', '“Not now.”']], alea);
    },
  },
  {
    id: 'conseil', avec: ['coach', 'prof', 'maman', 'papa'], duree: 20, texte: ['Demander conseil', 'Ask for advice'],
    faire: (a, p, alea) => {
      changerLien(a, p, 4);
      if (p === 'coach') { a.conseil = 0.06 + Math.max(0, lienDe(a, 'coach')) / 1000; return parmi<Texte>([['« Relâche les épaules. La vitesse vient du sol, pas des bras. »', '“Relax your shoulders. Speed comes from the ground, not your arms.”'], ['« Pense “pousser” en sortie de blocs, pas “courir”. »', '“Think ‘push’ out of the blocks, not ‘run’.”'], ['« Ce soir, pieds actifs : griffe la piste. »', '“Tonight, active feet: claw the track.”']], alea); }
      if (p === 'prof') { a.ecole = Math.min(100, (a.ecole ?? 60) + 2); return parmi<Texte>([['« Les cours d’abord, la piste ensuite. Les deux, c’est possible. »', '“Classes first, track second. You can do both.”'], ['« Il existe des sections sport-études. Pense-y pour le lycée. »', '“There are sport-study programmes. Think about it for high school.”']], alea); }
      moral(a, 5);
      return parmi<Texte>([['« Fais ce que tu aimes, mais dors un peu, hein. »', '“Do what you love, but get some sleep, OK?”'], ['« On est fiers de toi, tu sais. »', '“We’re proud of you, you know.”']], alea);
    },
  },
  {
    id: 'ensemble', avec: ['partenaire', 'amie', 'rival'], duree: 20, texte: ['Proposer de s’entraîner ensemble', 'Offer to train together'],
    possible: a => (a.ensemble ? ['Déjà prévu pour la prochaine séance', 'Already set for the next session'] : null),
    faire: (a, p, alea) => {
      const oui = p !== 'rival' || lienDe(a, 'rival') > -20 || alea() < 0.3;
      if (!oui) { changerLien(a, p, -3); return ['« Je m’entraîne seul. »', '“I train alone.”']; }
      a.ensemble = p === 'rival' ? 0.1 : 0.07;
      changerLien(a, p, 5);
      return p === 'rival' ? ['« OK. Mais je vais te mettre deux mètres. »', '“Fine. But I’ll put two metres on you.”'] : ['« Grave ! Je viens à la prochaine. »', '“For sure! I’ll come to the next one.”'];
    },
  },
  {
    id: 'chambrer', avec: ['rival'], duree: 5, texte: ['Le chambrer', 'Trash-talk him'],
    faire: (a, _p, alea) => {
      changerLien(a, 'rival', -6); moral(a, 4);
      return parmi<Texte>([['« Parle sur la piste. »', '“Talk on the track.”'], ['« Dimanche, on verra qui rigole. »', '“Sunday, we’ll see who’s laughing.”']], alea);
    },
  },
  {
    id: 'feliciter', avec: ['rival', 'partenaire'], duree: 5, texte: ['Le féliciter', 'Congratulate'],
    faire: (a, p, alea) => {
      changerLien(a, p, 7);
      return parmi<Texte>([['« …Merci. Toi aussi, t’as bien bossé. »', '“…Thanks. You worked well too.”'], ['« Respect. »', '“Respect.”']], alea);
    },
  },
  {
    id: 'argent', avec: ['maman', 'papa'], duree: 10, texte: ['Demander un peu d’argent', 'Ask for some money'],
    possible: a => (a.argentParents ? ['Déjà demandé cette semaine', 'Already asked this week'] : null),
    faire: (a, p, alea) => {
      a.argentParents = true;
      const aisee = a.origine === 'aisee', v = lienDe(a, p);
      if (aisee && v > 0) { a.argent += 25; return ['« Tiens, 25 €. Pour tes pointes, pas pour les bonbons. »', '“Here, €25. For your spikes, not for sweets.”']; }
      if (!aisee && v > 30 && alea() < 0.6) { a.argent += 8; return ['« C’est tout ce que j’ai ce mois-ci, mon cœur. »', '“That’s all I have this month, love.”']; }
      changerLien(a, p, -3);
      return ['« L’argent ne pousse pas sur les arbres. »', '“Money doesn’t grow on trees.”'];
    },
  },
  {
    id: 'remercier', avec: ['maman', 'papa', 'coach', 'prof'], duree: 5, texte: ['Remercier', 'Say thank you'],
    faire: (a, p) => { changerLien(a, p, 5); moral(a, 2); return ['« Ça fait plaisir. Continue comme ça. »', '“That means a lot. Keep it up.”']; },
  },
  {
    id: 'pizza', avec: ['amie'], duree: 60, texte: ['Inviter à manger une pizza (24 €)', 'Invite for a pizza (€24)'],
    possible: a => (a.argent < 24 ? ['Pas assez d’argent', 'Not enough money'] : null),
    faire: (a, p, alea) => {
      a.argent -= 24; changerLien(a, p, 12); besoin(a, 'faim', 60); besoin(a, 'social', 30); besoin(a, 'plaisir', 20);
      return parmi<Texte>([['« La meilleure soirée de la semaine. »', '“Best evening of the week.”'], ['« Tu m’invites ? T’es le meilleur. »', '“You’re paying? You’re the best.”']], alea);
    },
  },
];

/** Ce que dit la personne quand on vient discuter. */
function parle(a: Athlete, p: Personne, alea: () => number): Texte {
  switch (p) {
    case 'maman': return replique(a, p,
      [['« On en reparlera quand tu rangeras ta chambre. »', '“We’ll talk when you’ve tidied your room.”']],
      [['« Tu as mangé ? Il reste des pâtes. »', '“Have you eaten? There’s pasta left.”'], ['« Et les devoirs ? »', '“And your homework?”']],
      [['« Ta grand-mère a vu ta course en vidéo. Elle a pleuré. »', '“Your grandma watched your race video. She cried.”'], ['« Je suis fière de toi. Vraiment. »', '“I’m proud of you. Really.”']], alea);
    case 'papa': return replique(a, p,
      [['« Pas maintenant, il y a le match. »', '“Not now, the match is on.”']],
      [['« Tu sais qu’à ton âge je courais le 100 en 12 secondes ? »', '“You know at your age I ran the 100 in 12 seconds?”'], ['« Le club, ça se passe bien ? »', '“How’s the club going?”']],
      [['« Dimanche, je viens te voir courir. Je ferai le plus de bruit de la tribune. »', '“Sunday I’m coming to watch. I’ll be the loudest in the stand.”']], alea);
    case 'prof': return replique(a, p,
      [['« Tu n’étais pas en cours mardi. »', '“You weren’t in class on Tuesday.”']],
      [['« Ça avance, la piste ? »', '“How’s the track going?”'], ['« Pense à t’étirer après l’effort. »', '“Remember to stretch after training.”']],
      [['« Je l’ai dit au principal : on a un futur champion au collège. »', '“I told the head: we’ve got a future champion here.”']], alea);
    case 'coach': return replique(a, p,
      [['« On se reparle quand tu arriveras à l’heure. »', '“We’ll talk when you show up on time.”']],
      [['« La régularité, c’est ça le talent. »', '“Consistency is the talent.”'], ['« Échauffe-toi bien ce soir. »', '“Warm up properly tonight.”']],
      [['« Toi, tu as quelque chose. Je ne te lâche plus. »', '“You’ve got something. I’m not letting you go.”'], ['« Les régionaux, c’est dans tes jambes. »', '“The regionals are in your legs.”']], alea);
    case 'amie': return replique(a, p,
      [['« Ah, tu te souviens que j’existe ? »', '“Oh, you remember I exist?”']],
      [['« T’as vu le dernier TikTok de la classe ? »', '“Did you see the class’s latest TikTok?”'], ['« On se fait un truc ce week-end ? »', '“Shall we do something this weekend?”']],
      [['« Dimanche, je serai au bord de la piste. Avec une banderole. »', '“Sunday I’ll be trackside. With a banner.”'], ['« T’es ma star préférée, tu le sais ? »', '“You’re my favourite star, you know that?”']], alea);
    case 'rival': return replique(a, p,
      [['« Tu regardes quoi ? »', '“What are you looking at?”'], ['« Profite de ta place, elle est à moi dimanche. »', '“Enjoy your spot, it’s mine on Sunday.”']],
      [['« T’as fait combien au dernier 60 ? »', '“What did you run in the last 60?”']],
      [['« Franchement… tu me fais progresser. »', '“Honestly… you make me better.”']], alea);
    case 'partenaire': return replique(a, p,
      [['« On n’est pas obligés de se parler. »', '“We don’t have to talk.”']],
      [['« Je fais les gammes avec toi ce soir ? »', '“Drills together tonight?”'], ['« J’ai mal aux ischios depuis mercredi… »', '“My hamstrings have hurt since Wednesday…”']],
      [['« À deux, ça passe mieux, les côtes. »', '“Hills are easier with two.”']], alea);
  }
}

/** Ce qu'on peut faire avec cette personne. */
export const interactionsAvec = (p: Personne) => INTERACTIONS.filter(i => i.avec.includes(p));

/** Interagir : le temps passe, la relation bouge. Rend la replique, ou la raison du refus. */
export function interagir(a: Athlete, p: Personne, id: string, alea: () => number = Math.random): { replique?: Texte; refus?: Texte } {
  const i = INTERACTIONS.find(x => x.id === id && x.avec.includes(p));
  if (!i) return { refus: ['Pas avec cette personne', 'Not with this person'] };
  const r = i.possible?.(a, p); if (r) return { refus: r };
  const replique = i.faire(a, p, alea);
  avancer(a, i.duree);
  a.vus_semaine = [...new Set([...(a.vus_semaine || []), p])];
  if (id === 'pizza') noter(a, 'Pizza avec Inès.', 'Pizza with Inès.');
  return { replique };
}

/** Les bonus pour la prochaine seance : le conseil du coach, l'entrainement a deux. Consommes une fois. */
export function bonusDeSeance(a: Athlete): number {
  const b = (a.conseil || 0) + (a.ensemble || 0) + Math.max(0, lienDe(a, 'coach')) / 1000;
  a.conseil = 0; a.ensemble = 0;
  return b;
}
