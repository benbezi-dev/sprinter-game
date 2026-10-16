// LA NUIT DU MOLOSSE — ce qu'on en sait, nuit par nuit.
//
// L'audit du 16/10 l'a releve : le serveur comptait les courses du mode, mais
// ni la nuit, ni l'issue. Rien ne pouvait dire, pendant l'edition, qu'une nuit
// arretait presque tout le monde — alors que la suite du calendrier en depend
// (une nuit perdue ferme toutes les suivantes) et que les temps impartis sont
// de simples constantes (halloween-loi.js), qu'un deploiement regle.
//
// TROIS MARCHES, UNE FOIS CHACUNE PAR APPAREIL : il a ouvert le mode, il a
// tente la nuit n, il l'a tenue. On passe par le tunnel des premiers pas
// (game/tunnel.ts), qui sait deja n'envoyer une marche qu'une fois et la
// renvoyer au lancement suivant si le reseau manquait. Le tableau de bord les
// lit sur TOUS les appareils (worker/src/tunnel.js, lireHalloween).
//
// RIEN SUR LE CANAL DE TEST : il partage le serveur avec le jeu, et les
// testeurs — qui courent les treize nuits dans le desordre — feraient mentir
// les parts de chaque nuit.

import { EST_TEST } from './canal';
import { etapeTunnel } from './tunnel';

export function mesurerLaNuit(quoi: 'entree' | 'nuit' | 'tenue', n = 0) {
  if (EST_TEST) return;
  if (quoi === 'entree') { etapeTunnel('hw_entree'); return; }
  const k = Math.floor(n);
  if (k < 1 || k > 13) return;
  etapeTunnel(quoi === 'nuit' ? `hw_nuit_${k}` : `hw_tenue_${k}`);
}
