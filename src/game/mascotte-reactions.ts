// QUI REAGIT, ET COMMENT — sans three.js : les ecrans s'en servent sans charger la 3D.
// Visage et corps vont ensemble (assets-sources/mascotte/EXPRESSIONS.md) : chaque reaction est un
// fichier d'expression et un de ses gestes (src/game/mascotte-3d.ts, MASCOTTES).
import type { Personnage } from './mascotte-3d';

export type Reaction = [Personnage, string];

/** LE HEROS vit ta course comme la sienne : le frimeur et le mauvais perdant du jeu. */
export const REACTIONS_COURSE: Record<'gagne' | 'podium' | 'milieu' | 'dernier' | 'rate', Reaction[]> = {
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
