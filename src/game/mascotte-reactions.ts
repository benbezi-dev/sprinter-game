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

export function tirer(liste: Reaction[]): Reaction {
  return liste[Math.floor(Math.random() * liste.length)];
}

/**
 * UNE REACTION DEVIENT UNE SUITE (20/11/2026, « il garde la bouche ouverte, passe d'une animation
 * a une autre pour changer de pose et creer plus de possibilites ; de facon fluide, sans
 * cassure », l'auteur). Le visage est sculpte dans chaque fichier : rester sur heros-hilare, c'est
 * garder la bouche ouverte pour toujours. La suite :
 *   1. le geste tire (le visage fort),
 *   2. un second geste du MEME visage (fondu des gestes, aucun changement de corps),
 *   3. le corps neutre — bouche fermee — dans un geste qui prolonge l'humeur (fondu des corps),
 * puis le repos neutre, qui change de pose de temps en temps.
 */
export type Programme = { etapes: Reaction[]; repos: { p: Personnage; gestes: string[] } };

const GESTES_FORTS: Partial<Record<Personnage, string[]>> = {
  'heros-hilare': ['rire', 'fourire', 'applaudit', 'joie'],
  'heros-furieux': ['trepigne', 'rage', 'colere'],
  'heros-larmes': ['pleure', 'abattu'],
  'heros-choque': ['doubletake', 'stupeur'],
  'rival-sourire': ['nargue', 'victoire', 'doigt'],
  'rival-fureur': ['colere', 'controle'],
  'rival-stupeur': ['stupeur', 'silence'],
};
/** Le geste neutre qui prolonge l'humeur, et les poses du repos qui suit. */
const NEUTRE: Record<Personnage, { p: Personnage; relais: string[]; repos: string[] }> = {
  // content : il frime encore un peu
  'heros': { p: 'heros', relais: ['frime'], repos: ['frime', 'defi', 'echauffement'] },
  'heros-hilare': { p: 'heros', relais: ['celebration', 'frime'], repos: ['frime', 'celebration', 'defi'] },
  // vexe : il veut sa revanche
  'heros-furieux': { p: 'heros', relais: ['defi'], repos: ['defi', 'echauffement', 'attente'] },
  'heros-larmes': { p: 'heros', relais: ['echauffement'], repos: ['echauffement', 'defi', 'attente'] },
  'heros-choque': { p: 'heros', relais: ['defi', 'echauffement'], repos: ['defi', 'echauffement', 'attente'] },
  // le rival : il toise, ou promet la revanche
  'rival': { p: 'rival', relais: ['toise'], repos: ['toise', 'defi', 'echauffement'] },
  'rival-sourire': { p: 'rival', relais: ['applaudit', 'toise'], repos: ['toise', 'applaudit', 'defi'] },
  'rival-fureur': { p: 'rival', relais: ['defi'], repos: ['defi', 'toise', 'echauffement'] },
  'rival-stupeur': { p: 'rival', relais: ['toise', 'defi'], repos: ['toise', 'defi', 'echauffement'] },
};

export function programme([p, g]: Reaction): Programme {
  const etapes: Reaction[] = [[p, g]];
  const forts = (GESTES_FORTS[p] || []).filter((x) => x !== g);
  if (forts.length) etapes.push([p, forts[Math.floor(Math.random() * forts.length)]]);
  const n = NEUTRE[p];
  const relais = n.relais.filter((x) => !(n.p === p && x === etapes[etapes.length - 1][1]));
  if (relais.length) etapes.push([n.p, relais[Math.floor(Math.random() * relais.length)]]);
  return { etapes, repos: { p: n.p, gestes: n.repos } };
}
