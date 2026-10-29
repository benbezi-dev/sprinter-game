// LA CARRIERE D'ATHLETE — l'histoire : qui vient te parler, et ce que tu reponds.
//
// Deux sortes d'evenements :
//
//  - LES TOURNANTS, qui arrivent quand la carriere y est (`force`) : le prof
//    d'EPS au premier jour, les entraineurs qui t'abordent apres ta premiere
//    competition, le programme du coach, le choix d'une specialite, les
//    sponsors. Une fois chacun.
//  - LA VIE DE LA SEMAINE, tiree au hasard en fin de semaine : les conflits
//    entre la direction et les coachs, entre coachs, entre athletes, et les
//    bons moments — un anniversaire, un stage, un voyage.
//
// Chaque reponse change quelque chose de concret : l'argent, la fatigue, le
// moral, une stat, une relation, le club. Une reponse qu'on ne peut pas se
// payer est grisee — c'est la que la famille modeste sent la difference.
//
// Les noms des clubs, des coachs et des sponsors sont INVENTES, en attendant
// des partenaires reels (docs/carriere-athlete.md). Ce fichier n'importe que
// les regles, et rien qui dessine.

import { type Athlete, type Epreuve, type Objectif, club, noter, NATIONAL, payer } from './regles';

type Texte = [string, string];

export type Choix = {
  t: Texte;
  /** Une ligne sous le choix : ce qu'il coute, ce qu'il rapporte. */
  d?: Texte;
  possible?: (a: Athlete) => boolean;
  faire: (a: Athlete) => void;
};

export type Evenement = {
  id: string;
  qui: Texte;
  texte: (a: Athlete) => Texte;
  choix: Choix[];
  /** Un tournant : arrive des que c'est vrai, une seule fois. */
  force?: (a: Athlete) => boolean;
  /** La vie de la semaine : peut etre tire si c'est vrai. */
  tirable?: (a: Athlete) => boolean;
  /** Tire plusieurs fois au cours d'une carriere ? */
  repetable?: boolean;
};

const borne = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const moral = (a: Athlete, d: number) => { a.moral = borne(a.moral + d, 0, 100); };
const fatigue = (a: Athlete, d: number) => { a.fatigue = borne(a.fatigue + d, 0, 100); };
const rel = (a: Athlete, k: keyof Athlete['relations'], d: number) => { a.relations[k] = borne(a.relations[k] + d, -100, 100); };

function rejoindre(a: Athlete, id: string) {
  const c = club(id);
  if (!c) return;
  const gratuit = c.gratuitPourModeste && a.origine === 'modeste';
  if (!gratuit) payer(a, -c.licence, 'Licence du club', 'Club licence');
  a.club = c.id;
  a.coach = c.coach;
  a.chapitre = 'club';
  rel(a, 'club', 10); rel(a, 'coach', 15);
}

const OBJECTIF: (o: Objectif) => Choix = o => ({
  t: o === 'france' ? ['Les Championnats de France', 'The French Championships']
    : o === 'europe' ? ['Les Championnats d’Europe', 'The European Championships']
    : ['Les Mondiaux', 'The World Championships'],
  d: o === 'france' ? ['Un cycle sûr, un pic de forme tôt.', 'A safe cycle, an early peak.']
    : o === 'europe' ? ['Plus long, plus dur, plus haut.', 'Longer, harder, higher.']
    : ['Tout pour le sommet. Aucune séance à manquer.', 'All in for the top. Miss no session.'],
  faire: a => {
    a.objectif = o;
    a.assiduite = { proposees: 0, faites: 0 };
    rel(a, 'coach', 5);
  },
});

const SPECIALITE: (e: Epreuve) => Choix = e => ({
  t: [`Le ${e} m`, `The ${e} m`],
  faire: a => { a.voie = 'specialiste'; a.specialite = e; rel(a, 'coach', 5); },
});

export const EVENEMENTS: Evenement[] = [
  /* ------------------------------------------------ les tournants */
  {
    id: 'intro',
    qui: ['M. Roche, prof d’EPS', 'Mr Roche, PE teacher'],
    texte: a => a.origine === 'aisee'
      ? ['« Je t’ai chronométré au 50 m : tu as quelque chose. Il y a la compétition scolaire du district dans deux semaines. Tes parents ont déjà proposé de t’y conduire. »',
         '“I timed you over 50 m: you’ve got something. The district school meet is in two weeks. Your parents already offered to drive you.”']
      : ['« Je t’ai chronométré au 50 m : tu as quelque chose. Il y a la compétition scolaire du district dans deux semaines. Le bus scolaire y va, c’est gratuit. »',
         '“I timed you over 50 m: you’ve got something. The district school meet is in two weeks. The school bus goes, it’s free.”'],
    choix: [
      { t: ['« J’y serai. »', '“I’ll be there.”'], d: ['Moral +10', 'Morale +10'], faire: a => moral(a, 10) },
      { t: ['« Vous croyez vraiment ? »', '“You really think so?”'], d: ['Il te montre les éducatifs. Technique +2', 'He shows you drills. Technique +2'],
        faire: a => { a.stats.technique += 2; } },
    ],
  },
  {
    id: 'approche',
    // Apres une premiere competition, tant qu'on n'a pas de club. Qui decline
    // les revoit apres la course suivante (`seul@n`, n = courses courues).
    force: a => a.palmares.length > 0 && !a.club && !a.vus.includes(`seul@${a.palmares.length}`),
    qui: ['Au bord de la piste', 'Trackside'],
    texte: a => {
      const bon = a.palmares.some(p => p.niveau === 0 && p.place <= 3);
      return bon
        ? ['Deux entraîneurs t’attendent après la course. Coach Mireille, du Club Athlé Horizon — piste couverte, groupe d’élite, licence 220 €. Et Coach Dédé, des Foulées du Quartier — un club de quartier où tout le monde se connaît, licence 90 €.',
           'Two coaches are waiting after the race. Coach Mireille, from Club Athlé Horizon — indoor track, elite group, €220 licence. And Coach Dédé, from Foulées du Quartier — a neighbourhood club where everyone knows everyone, €90 licence.']
        : ['Tu n’as pas fait de podium, mais Coach Dédé, des Foulées du Quartier, a vu ta foulée. « Viens essayer mercredi. » Coach Mireille, du Club Athlé Horizon, est passée sans s’arrêter… mais t’a laissé sa carte.',
           'No podium, but Coach Dédé, from Foulées du Quartier, saw your stride. “Come and try on Wednesday.” Coach Mireille, from Club Athlé Horizon, walked past… but left her card.'];
    },
    choix: [
      { t: ['Club Athlé Horizon — Coach Mireille', 'Club Athlé Horizon — Coach Mireille'],
        d: ['Licence 220 €. Séances +30 %.', '€220 licence. Sessions +30%.'],
        possible: a => a.argent >= 220, faire: a => rejoindre(a, 'horizon') },
      { t: ['Foulées du Quartier — Coach Dédé', 'Foulées du Quartier — Coach Dédé'],
        d: ['Licence 90 € (offerte aux familles modestes). Séances +20 %.', '€90 licence (free for low-income families). Sessions +20%.'],
        possible: a => a.origine === 'modeste' || a.argent >= 90, faire: a => rejoindre(a, 'quartier') },
      { t: ['Continuer seul pour l’instant', 'Keep going alone for now'],
        d: ['Ils reviendront après la prochaine course.', 'They’ll come back after the next race.'],
        faire: a => { a.vus = a.vus.filter(v => v !== 'approche'); a.vus.push(`seul@${a.palmares.length}`); moral(a, -5); } },
    ],
  },
  {
    id: 'programme',
    force: a => !!a.club && !a.objectif,
    qui: [ 'Ton coach', 'Your coach'],
    texte: a => a.club === 'horizon'
      ? ['« Ici on travaille en cycles. Lundi vitesse, mercredi force, vendredi technique, et le samedi pour ceux qui ont faim. Dis-moi ce que tu vises, je te compresse un programme dessus. »',
         '“Here we work in cycles. Monday speed, Wednesday strength, Friday technique, and Saturday for the hungry ones. Tell me what you’re aiming for and I’ll compress a programme around it.”']
      : ['« Chez nous on rigole, mais on bosse. Trois séances par semaine, le samedi si t’as la forme. Alors, c’est quoi ton rêve ? »',
         '“We have fun here, but we work. Three sessions a week, Saturday if you’re up for it. So, what’s your dream?”'],
    choix: [OBJECTIF('france'), OBJECTIF('europe'), OBJECTIF('monde')],
  },
  {
    id: 'specialite',
    force: a => a.voie === 'polyvalent' && !!a.club && a.palmares.some(p => p.niveau >= 1),
    qui: ['Ton coach', 'Your coach'],
    texte: () => ['« Tu as touché à tout. Pour aller aux France, il faut choisir. Où est-ce que tu te sens chez toi ? »',
                  '“You’ve tried everything. To get to the nationals you have to choose. Where do you feel at home?”'],
    choix: [SPECIALITE('100'), SPECIALITE('200'), SPECIALITE('400'),
      { t: ['Rester polyvalent', 'Stay an all-rounder'], d: ['Le coach soupire. Relation coach −10', 'The coach sighs. Coach relation −10'],
        faire: a => rel(a, 'coach', -10) }],
  },
  {
    id: 'sponsor1',
    force: a => a.reputation >= 30,
    qui: ['Un équipementier régional', 'A regional kit brand'],
    texte: () => ['« On a vu tes résultats. On te fournit les pointes de la saison et 60 € par semaine, contre ton logo sur le maillot et deux posts par mois. »',
                  '“We’ve seen your results. We’ll supply your spikes for the season and €60 a week, in exchange for our logo on your vest and two posts a month.”'],
    choix: [
      { t: ['Signer', 'Sign'], d: ['+60 €/semaine, déplacements payés', '+€60/week, travel paid'],
        faire: a => { a.sponsors.push('equipementier'); a.abonnes += 300; } },
      { t: ['Attendre mieux', 'Wait for better'], d: ['Moral +5', 'Morale +5'], faire: a => moral(a, 5) },
    ],
  },
  {
    id: 'sponsor2',
    force: a => a.reputation >= 90 && a.sponsors.length < 2,
    qui: ['Une grande marque de sport', 'A major sports brand'],
    texte: () => ['« Contrat national : matériel de pointe, une séance photo, une vraie visibilité. On veut un athlète qui sait parler à sa communauté. »',
                  '“National deal: top kit, a photo shoot, real visibility. We want an athlete who knows how to talk to their community.”'],
    choix: [
      { t: ['Signer', 'Sign'], d: ['+60 €/semaine, abonnés +2 000', '+€60/week, followers +2,000'],
        faire: a => { a.sponsors.push('marque'); a.abonnes += 2000; if (!a.materiel.includes('pointes3')) { a.materiel = a.materiel.filter(x => !x.startsWith('pointes')); a.materiel.push('pointes3'); } } },
      { t: ['Refuser', 'Decline'], faire: a => moral(a, 3) },
    ],
  },
  {
    id: 'reseaux',
    force: a => a.niveau >= NATIONAL && a.abonnes >= 500,
    qui: ['Ton téléphone', 'Your phone'],
    texte: () => ['Ta dernière course tourne sur les réseaux. Des milliers de vues. Il faut poster quelque chose.',
                  'Your last race is going around online. Thousands of views. You need to post something.'],
    choix: [
      { t: ['Les coulisses de l’entraînement', 'Behind the scenes of training'], d: ['Abonnés +800, coach +10', 'Followers +800, coach +10'],
        faire: a => { a.abonnes += 800; rel(a, 'coach', 10); } },
      { t: ['Un clash avec ton rival', 'A diss at your rival'], d: ['Abonnés +2 500, rival −30, club −15', 'Followers +2,500, rival −30, club −15'],
        faire: a => { a.abonnes += 2500; rel(a, 'rival', -30); rel(a, 'club', -15); } },
      { t: ['Rien. Focus.', 'Nothing. Focus.'], d: ['Moral +8', 'Morale +8'], faire: a => moral(a, 8) },
    ],
  },

  /* ------------------------------------------------ la vie de la semaine, avant le club */
  {
    id: 'controle',
    tirable: a => a.chapitre === 'debut',
    repetable: true,
    qui: ['Le collège', 'School'],
    texte: () => ['Contrôle de maths vendredi. Tes parents veulent que tu révises.', 'Maths test on Friday. Your parents want you to revise.'],
    choix: [
      { t: ['Réviser (pas de séance vendredi)', 'Revise (no Friday session)'], d: ['Moral +5', 'Morale +5'],
        faire: a => { if (!a.faites.includes('vendredi')) a.faites.push('vendredi'); moral(a, 5); } },
      { t: ['S’entraîner quand même', 'Train anyway'], d: ['Moral −8', 'Morale −8'], faire: a => moral(a, -8) },
    ],
  },
  {
    id: 'potes',
    tirable: a => a.chapitre === 'debut',
    repetable: true,
    qui: ['Tes potes', 'Your friends'],
    texte: () => ['« Ciné samedi ? Tout le monde vient. »', '“Cinema on Saturday? Everyone’s coming.”'],
    choix: [
      { t: ['Y aller', 'Go'], d: ['Moral +10, pas de séance samedi', 'Morale +10, no Saturday session'],
        faire: a => { if (!a.faites.includes('samedi')) a.faites.push('samedi'); moral(a, 10); } },
      { t: ['Décliner', 'Decline'], d: ['Moral −3', 'Morale −3'], faire: a => moral(a, -3) },
    ],
  },

  /* ------------------------------------------------ la vie du club */
  {
    id: 'direction',
    tirable: a => a.chapitre === 'club',
    qui: ['Assemblée du club', 'Club meeting'],
    texte: () => ['Le président veut couper le budget des déplacements. Ton coach menace de partir si ça passe.',
                  'The president wants to cut the travel budget. Your coach threatens to leave if it goes through.'],
    choix: [
      { t: ['Soutenir le coach', 'Back the coach'], d: ['Coach +15, club −10', 'Coach +15, club −10'],
        faire: a => { rel(a, 'coach', 15); rel(a, 'club', -10); } },
      { t: ['Soutenir la direction', 'Back the board'], d: ['Club +15, coach −15', 'Club +15, coach −15'],
        faire: a => { rel(a, 'club', 15); rel(a, 'coach', -15); } },
      { t: ['Rester en dehors', 'Stay out of it'], d: ['Moral −3', 'Morale −3'], faire: a => moral(a, -3) },
    ],
  },
  {
    id: 'creneau',
    tirable: a => a.chapitre === 'club',
    repetable: true,
    qui: ['Sur la piste', 'On the track'],
    texte: () => ['Deux coachs se disputent le créneau de la piste du mercredi. Le ton monte devant tout le groupe.',
                  'Two coaches are fighting over the Wednesday track slot. It’s getting heated in front of the whole group.'],
    choix: [
      { t: ['Proposer le créneau de 7 h', 'Suggest the 7 am slot'], d: ['Fatigue +10, coach +10', 'Fatigue +10, coach +10'],
        faire: a => { fatigue(a, 10); rel(a, 'coach', 10); } },
      { t: ['Laisser faire', 'Let them sort it out'], d: ['Séance du mercredi perdue', 'Wednesday session lost'],
        faire: a => { if (!a.faites.includes('mercredi')) a.faites.push('mercredi'); } },
    ],
  },
  {
    id: 'rival',
    tirable: a => a.chapitre === 'club',
    repetable: true,
    qui: ['Yanis, du même groupe', 'Yanis, same training group'],
    texte: () => ['« Toi ? Aux championnats ? Viens on fait un 60 m, là, maintenant. »', '“You? At the championships? Let’s do a 60 m, right here, right now.”'],
    choix: [
      { t: ['Relever le défi', 'Take him on'], d: ['Vitesse +1, fatigue +10, rival −10', 'Speed +1, fatigue +10, rival −10'],
        faire: a => { a.stats.vitesse += 1; fatigue(a, 10); rel(a, 'rival', -10); } },
      { t: ['Proposer de s’entraîner ensemble', 'Offer to train together'], d: ['Technique +1, rival +15', 'Technique +1, rival +15'],
        faire: a => { a.stats.technique += 1; rel(a, 'rival', 15); } },
      { t: ['L’ignorer', 'Ignore him'], d: ['Moral +3', 'Morale +3'], faire: a => moral(a, 3) },
    ],
  },
  {
    id: 'anniversaire',
    tirable: a => a.chapitre === 'club',
    repetable: true,
    qui: ['Le groupe', 'The group'],
    texte: () => ['Gâteau surprise au vestiaire pour l’anniversaire de la plus ancienne du groupe. Tout le monde chante faux.',
                  'Surprise cake in the locker room for the group’s longest-standing member. Everyone sings out of tune.'],
    choix: [{ t: ['Profiter du moment', 'Enjoy the moment'], d: ['Moral +12, club +5', 'Morale +12, club +5'],
              faire: a => { moral(a, 12); rel(a, 'club', 5); } }],
  },
  {
    id: 'stage',
    tirable: a => a.chapitre === 'club',
    repetable: true,
    qui: ['Ton coach', 'Your coach'],
    texte: () => ['Stage d’entraînement d’une semaine à la montagne pendant les vacances. 180 €, hébergement compris.',
                  'A one-week training camp in the mountains over the holidays. €180, accommodation included.'],
    choix: [
      { t: ['Partir en stage', 'Go to the camp'], d: ['−180 €. Toutes les stats +2, fatigue +20', '−€180. All stats +2, fatigue +20'],
        possible: a => a.argent >= 180,
        faire: a => { payer(a, -180, 'Stage', 'Training camp'); for (const k of ['vitesse', 'force', 'technique', 'endurance'] as const) a.stats[k] = Math.min(100, a.stats[k] + 2); fatigue(a, 20); rel(a, 'coach', 5); } },
      { t: ['Le club t’aide : moitié prix', 'The club helps: half price'], d: ['−90 €. Toutes les stats +2', '−€90. All stats +2'],
        possible: a => a.origine === 'modeste' && a.relations.club >= 15 && a.argent >= 90,
        faire: a => { payer(a, -90, 'Stage', 'Training camp'); for (const k of ['vitesse', 'force', 'technique', 'endurance'] as const) a.stats[k] = Math.min(100, a.stats[k] + 2); fatigue(a, 20); rel(a, 'club', 5); } },
      { t: ['Rester à la maison', 'Stay home'], d: ['Moral −5', 'Morale −5'], faire: a => moral(a, -5) },
    ],
  },
  {
    id: 'voyage',
    tirable: a => a.chapitre === 'club' && a.niveau >= 1,
    repetable: true,
    qui: ['Le club', 'The club'],
    texte: () => ['Le club monte un déplacement pour un meeting à l’étranger. Minibus, auberge de jeunesse, 250 €.',
                  'The club is organising a trip to a meet abroad. Minibus, youth hostel, €250.'],
    choix: [
      { t: ['Partir avec le groupe', 'Go with the group'], d: ['−250 €. Réputation +8, moral +12', '−€250. Reputation +8, morale +12'],
        possible: a => a.argent >= 250,
        faire: a => { payer(a, -250, 'Voyage du club', 'Club trip'); a.reputation += 8; moral(a, 12); rel(a, 'club', 8); } },
      { t: ['Pas cette fois', 'Not this time'], faire: a => moral(a, -4) },
    ],
  },
  {
    id: 'soiree',
    tirable: a => a.chapitre === 'club',
    repetable: true,
    qui: ['Le groupe WhatsApp', 'The group chat'],
    texte: () => ['Soirée chez un coéquipier vendredi soir. Séance tôt samedi.', 'Party at a teammate’s on Friday night. Early session on Saturday.'],
    choix: [
      { t: ['Y aller', 'Go'], d: ['Moral +8, fatigue +15', 'Morale +8, fatigue +15'], faire: a => { moral(a, 8); fatigue(a, 15); rel(a, 'rival', 5); } },
      { t: ['Dormir', 'Sleep'], d: ['Fatigue −10', 'Fatigue −10'], faire: a => fatigue(a, -10) },
    ],
  },
];

export const evenement = (id: string | null) => EVENEMENTS.find(e => e.id === id) || null;

/** Le tournant qui attend, s'il y en a un. */
export function tournant(a: Athlete): string | null {
  for (const e of EVENEMENTS) if (e.force && !a.vus.includes(e.id) && e.force(a)) return e.id;
  return null;
}

/**
 * L'evenement de la fin de semaine : un tournant s'il y en a un, sinon un
 * peu plus d'une fois sur deux un moment de la vie de la semaine.
 */
export function tirerLaSemaine(a: Athlete, alea: () => number): string | null {
  const t = tournant(a);
  if (t) return t;
  if (alea() >= 0.55) return null;
  const pool = EVENEMENTS.filter(e => e.tirable && e.tirable(a) && (e.repetable || !a.vus.includes(e.id)));
  if (!pool.length) return null;
  return pool[Math.floor(alea() * pool.length) % pool.length].id;
}

/** Repondre a l'evenement en attente. Rend false si le choix est impossible. */
export function repondre(a: Athlete, i: number): boolean {
  const e = evenement(a.evenement);
  if (!e) { a.evenement = null; return false; }
  const c = e.choix[i];
  if (!c || (c.possible && !c.possible(a))) return false;
  if (!a.vus.includes(e.id)) a.vus.push(e.id);
  c.faire(a);
  for (const k of ['vitesse', 'force', 'technique', 'endurance'] as const) a.stats[k] = Math.min(100, a.stats[k]);
  noter(a, `${e.qui[0]} — ${c.t[0]}`, `${e.qui[1]} — ${c.t[1]}`);
  // Un tournant peut en appeler un autre (le club rejoint, le programme suit).
  a.evenement = tournant(a);
  return true;
}
