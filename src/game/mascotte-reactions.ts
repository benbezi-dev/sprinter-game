// QUI REAGIT, ET COMMENT — sans three.js : les ecrans s'en servent sans charger la 3D.
// Visage et corps vont ensemble (assets-sources/mascotte/EXPRESSIONS.md) : chaque reaction est un
// fichier d'expression et un de ses gestes (src/game/mascotte-3d.ts, MASCOTTES).
import type { Personnage } from './mascotte-3d';

export type Reaction = [Personnage, string];

/** LE HEROS vit ta course comme la sienne : le frimeur et le mauvais perdant du jeu. */
export const REACTIONS_COURSE: Record<'gagne' | 'podium' | 'milieu' | 'dernier' | 'rate' | 'record' | 'recordMonde', Reaction[]> = {
  // un record perso (les confettis, game/fete.ts) passe avant la place : il le fete
  record: [['heros', 'celebration'], ['heros-hilare', 'joie'], ['heros', 'frime']],
  // le record du monde (les feux d'artifice) : il n'en revient pas de rire
  recordMonde: [['heros-hilare', 'fourire'], ['heros', 'celebration']],
  // gagne : il frime
  gagne: [['heros', 'celebration'], ['heros-hilare', 'rire'], ['heros-hilare', 'joie'], ['heros', 'frime']],
  // sur le podium sans gagner : il ne le supporte pas
  podium: [['heros-furieux', 'colere'], ['heros-choque', 'stupeur']],
  // au milieu : la crise
  milieu: [['heros-furieux', 'trepigne'], ['heros-furieux', 'rage']],
  // dernier : les larmes
  dernier: [['heros-larmes', 'pleure'], ['heros-larmes', 'genoux']],
  // faux depart, abandon : il n'en revient pas
  rate: [['heros-choque', 'doubletake']],
};

/**
 * LE RIVAL, dans les duels (20/11/2026) : il est l'adversaire. Il provoque quand on te defie, te
 * toise tant que le resultat n'est pas tombe, nargue si tu perds, et perd son sang-froid si tu gagnes.
 */
export const REACTIONS_RIVAL: Record<'defi' | 'attente' | 'gagne' | 'perdu' | 'nul', Reaction[]> = {
  defi: [['rival', 'defi'], ['rival-sourire', 'doigt']],
  attente: [['rival', 'toise']],
  // tu gagnes : sa colere froide, ou la stupeur
  gagne: [['rival-fureur', 'colere'], ['rival-fureur', 'controle'], ['rival-stupeur', 'stupeur'], ['rival-stupeur', 'silence']],
  // tu perds : il te nargue, ou t'applaudit avec mepris
  perdu: [['rival-sourire', 'nargue'], ['rival-sourire', 'victoire'], ['rival', 'applaudit']],
  nul: [['rival', 'toise']],
};
export type IssueRival = keyof typeof REACTIONS_RIVAL;

export function tirer<T>(liste: T[]): T {
  return liste[Math.floor(Math.random() * liste.length)];
}

/**
 * DES SCENES SELON LA SITUATION (21/11/2026, « passer entre plusieurs poses selon la situation »,
 * l'auteur). Une scene : des gestes enchaines — d'abord sur le visage de l'emotion (heros-furieux,
 * heros-larmes...), puis sur le visage neutre, bouche fermee — et le repos qui suit, ou la mascotte
 * change de pose de temps en temps (src/game/mascotte-3d.ts, enchainer). Plusieurs scenes par
 * situation, tirees au sort ; l'historique du joueur (series de victoires ou de defaites) en
 * choisit d'autres. Visage et corps vont ensemble : un geste de rage ne se joue que sur un visage
 * furieux (les gestes Tripo en plus sont pretes aux visages, mascotte-3d.ts, EMPRUNTS).
 */
export type Programme = { etapes: Reaction[]; repos: { p: Personnage; gestes: string[] } };
const sc = (etapes: Reaction[], p: Personnage, gestes: string[]): Programme => ({ etapes, repos: { p, gestes } });

// les poses du repos, selon l'humeur
const R_FIER = ['frime', 'numero1', 'epaules', 'depoussiere', 'lunettes', 'bras_croises'];
const R_REVANCHE = ['defi', 'gammes', 'echauffement', 'bras_croises', 'montre'];
const R_VEXE = ['bras_croises', 'boude', 'montre', 'defi', 'echauffement'];
const R_RIVAL_FIER = ['toise', 'epaules', 'lunettes', 'numero1', 'bras_croises', 'applaudit'];
const R_RIVAL_VEXE = ['defi', 'bras_croises', 'montre', 'echauffement', 'toise'];

export type IssueCourseMascotte = keyof typeof REACTIONS_COURSE;

export const SCENES_COURSE: Record<IssueCourseMascotte, Programme[]> = {
  gagne: [
    sc([['heros', 'celebration'], ['heros', 'lunettes']], 'heros', R_FIER),
    sc([['heros-hilare', 'rire'], ['heros-hilare', 'moquerie'], ['heros', 'numero1']], 'heros', R_FIER),
    sc([['heros', 'glissade'], ['heros', 'frime'], ['heros', 'epaules']], 'heros', R_FIER),
    sc([['heros-hilare', 'joie'], ['heros', 'provoc']], 'heros', R_FIER),
  ],
  podium: [
    sc([['heros-choque', 'stupeur'], ['heros-furieux', 'fache'], ['heros', 'defi']], 'heros', R_REVANCHE),
    sc([['heros-furieux', 'colere'], ['heros-furieux', 'frustre'], ['heros', 'bras_croises']], 'heros', R_VEXE),
    sc([['heros-furieux', 'arbitre'], ['heros', 'defi']], 'heros', R_REVANCHE),
  ],
  milieu: [
    sc([['heros-furieux', 'trepigne'], ['heros-furieux', 'rageur'], ['heros', 'boude']], 'heros', R_VEXE),
    sc([['heros-furieux', 'rage'], ['heros-furieux', 'rage_muette'], ['heros', 'gammes']], 'heros', R_REVANCHE),
    sc([['heros-furieux', 'frustre'], ['heros-furieux', 'boude'], ['heros', 'montre']], 'heros', R_VEXE),
  ],
  dernier: [
    sc([['heros-larmes', 'pleure'], ['heros-larmes', 'sanglot'], ['heros', 'echauffement']], 'heros', R_REVANCHE),
    sc([['heros-larmes', 'genoux'], ['heros-larmes', 'ecrase'], ['heros', 'installation']], 'heros', R_REVANCHE),
    sc([['heros-larmes', 'defaite'], ['heros-larmes', 'abattu'], ['heros', 'echauffement']], 'heros', R_REVANCHE),
  ],
  rate: [
    sc([['heros-choque', 'doubletake'], ['heros-furieux', 'arbitre'], ['heros', 'rituel']], 'heros', R_REVANCHE),
    sc([['heros-choque', 'stupeur'], ['heros-choque', 'frustre'], ['heros', 'installation']], 'heros', R_REVANCHE),
  ],
  record: [
    sc([['heros', 'celebration'], ['heros', 'glissade'], ['heros', 'numero1']], 'heros', R_FIER),
    sc([['heros-hilare', 'joie'], ['heros-hilare', 'glissade'], ['heros', 'lunettes']], 'heros', R_FIER),
  ],
  recordMonde: [
    sc([['heros-hilare', 'fourire'], ['heros-hilare', 'glissade'], ['heros', 'numero1']], 'heros', R_FIER),
    sc([['heros', 'glissade'], ['heros-hilare', 'rire'], ['heros', 'lunettes']], 'heros', R_FIER),
  ],
};

// LA SERIE DU JOUEUR : 3 victoires de suite et il ne fait plus que frimer ; les defaites, elles,
// font monter la colere (2 de suite : la rage), puis les larmes (3 et plus), quelle que soit la place.
const SCENES_SERIE = {
  victoires: [
    sc([['heros', 'lunettes'], ['heros', 'epaules'], ['heros', 'numero1']], 'heros', R_FIER),
    sc([['heros', 'depoussiere'], ['heros', 'frime'], ['heros', 'provoc']], 'heros', R_FIER),
  ],
  rage: [
    sc([['heros-furieux', 'rageur'], ['heros-furieux', 'arbitre'], ['heros', 'defi']], 'heros', R_REVANCHE),
    sc([['heros-furieux', 'rage'], ['heros-furieux', 'fache'], ['heros', 'boude']], 'heros', R_VEXE),
  ],
  larmes: [
    sc([['heros-larmes', 'genoux'], ['heros-larmes', 'sanglot'], ['heros', 'installation']], 'heros', R_REVANCHE),
    sc([['heros-larmes', 'ecrase'], ['heros-larmes', 'pleure'], ['heros', 'echauffement']], 'heros', R_REVANCHE),
  ],
};
export type Serie = { sorte: 'v' | 'd' | ''; n: number };
const VICTOIRE = new Set<IssueCourseMascotte>(['gagne', 'record', 'recordMonde']);
const DEFAITE = new Set<IssueCourseMascotte>(['milieu', 'dernier', 'rate', 'podium']);
/** La serie apres cette issue. */
export function suivreSerie(av: Serie, issue: IssueCourseMascotte): Serie {
  const sorte = VICTOIRE.has(issue) ? 'v' : DEFAITE.has(issue) ? 'd' : '';
  return { sorte, n: sorte && sorte === av.sorte ? av.n + 1 : sorte ? 1 : 0 };
}
/** La scene d'une course : celle de l'issue, ou celle de la serie quand elle pese. */
export function sceneCourse(issue: IssueCourseMascotte, serie: Serie): Programme {
  // (un record se fete toujours comme un record)
  if (issue !== 'record' && issue !== 'recordMonde') {
    if (serie.sorte === 'v' && serie.n >= 3 && issue === 'gagne') return tirer(SCENES_SERIE.victoires);
    if (serie.sorte === 'd' && serie.n >= 3) return tirer(SCENES_SERIE.larmes);
    if (serie.sorte === 'd' && serie.n === 2 && issue !== 'dernier') return tirer(SCENES_SERIE.rage);
  }
  return tirer(SCENES_COURSE[issue]);
}

/** LE RIVAL : il provoque, toise en attendant, enrage si tu gagnes, se pavane si tu perds. */
export const SCENES_RIVAL: Record<IssueRival, Programme[]> = {
  defi: [
    sc([['rival', 'toise'], ['rival', 'pointe']], 'rival', R_RIVAL_FIER),
    sc([['rival-sourire', 'doigt'], ['rival', 'provoc']], 'rival', R_RIVAL_FIER),
  ],
  attente: [sc([['rival', 'toise']], 'rival', ['montre', 'bras_croises', 'toise', 'echauffement'])],
  gagne: [
    sc([['rival-stupeur', 'stupeur'], ['rival-fureur', 'colere'], ['rival', 'defi']], 'rival', R_RIVAL_VEXE),
    sc([['rival-fureur', 'arbitre'], ['rival-fureur', 'rageur'], ['rival', 'boude']], 'rival', R_RIVAL_VEXE),
    sc([['rival-stupeur', 'silence'], ['rival-fureur', 'rage_muette'], ['rival', 'installation']], 'rival', R_RIVAL_VEXE),
  ],
  perdu: [
    sc([['rival-sourire', 'nargue'], ['rival-sourire', 'moquerie'], ['rival', 'numero1']], 'rival', R_RIVAL_FIER),
    sc([['rival-sourire', 'victoire'], ['rival-sourire', 'epaules'], ['rival', 'lunettes']], 'rival', R_RIVAL_FIER),
    sc([['rival', 'applaudit'], ['rival-sourire', 'depoussiere'], ['rival', 'provoc']], 'rival', R_RIVAL_FIER),
  ],
  nul: [sc([['rival', 'toise'], ['rival', 'montre']], 'rival', ['toise', 'bras_croises', 'montre'])],
};
