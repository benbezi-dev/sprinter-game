// La session audio du systeme, et qui la tient apres le micro.
//
// Le probleme se voit et ne s'explique pas : on ouvre un duel, la presentation
// donne la parole a chacun, le pistolet part — et la musique de la course est
// deux fois moins forte qu'avant, jusqu'a ce qu'on relance le jeu.
//
// Ce n'est pas le jeu qui baisse son son. C'est iOS.
//
// L'application pose au demarrage une categorie de session audio, `playback`
// avec `mixWithOthers` : le jeu s'entend meme telephone en silencieux, et il
// ne coupe pas la musique du joueur (voir SessionAudio.swift, qui defend ces
// deux choix). Mais des qu'une page capture le micro, WebKit REMPLACE cette
// categorie par la sienne — `playAndRecord`, en mode voix — parce qu'on ne
// peut pas enregistrer en `playback`. C'est legitime.
//
// Ce qui ne l'est pas, c'est qu'il ne la rend jamais. La capture s'arrete, la
// session reste en mode voix : le traitement d'annulation d'echo continue de
// s'appliquer a TOUT ce qui sort, la sortie passe par le circuit de la
// conversation, et le jeu se retrouve au volume d'un appel telephonique. Pour
// le joueur, le son a baisse tout seul au milieu d'un duel.
//
// On reprend donc la session des que le micro est rendu. C'est le pendant
// exact de ce que SessionAudio.swift fait deja apres un appel entrant : iOS ne
// rend pas ce qu'il a pris, il faut aller le rechercher.
//
// Deux precautions, chacune apprise :
//
// - On attend un instant. WebKit ajuste la session APRES avoir arrete la
//   capture, et une categorie posee trop tot est ecrasee par la sienne.
// - On repasse une seconde fois plus tard. La premiere tentative suffit
//   presque toujours ; la seconde ne coute rien et rattrape les appareils
//   lents, ou une capture qui se termine en deux temps.
//
// Sur Android et sur le web, rien de tout cela : le systeme rend la sortie de
// lui-meme quand la capture s'arrete. Ce fichier n'y fait rien.

import { EST_NATIF } from './canal';

/** Delais des deux tentatives de reprise, en millisecondes. */
const REPRISE = [350, 1500];

let greffonDemande = false;
let greffon: any = null;
const minuteurs: any[] = [];

/** iOS uniquement : c'est le seul systeme qui garde la session. */
function surIOS(): boolean {
  try {
    const c = (window as any).Capacitor;
    return !!c && typeof c.getPlatform === 'function' && c.getPlatform() === 'ios';
  } catch {
    return false;
  }
}

/**
 * Le greffon natif, charge une seule fois et seulement dans l'application.
 *
 * L'import est dynamique et garde par `EST_NATIF`, comme celui des
 * notifications : un build web ne doit rien telecharger de Capacitor pour un
 * correctif qui ne le concerne pas.
 */
async function plugin(): Promise<any> {
  if (greffonDemande) return greffon;
  greffonDemande = true;
  try {
    const { registerPlugin } = await import('@capacitor/core');
    greffon = registerPlugin('SessionAudio');
  } catch {
    greffon = null;
  }
  return greffon;
}

function appeler(methode: 'rendreAuJeu') {
  if (!EST_NATIF || !surIOS()) return;
  void plugin()
    .then(g => g?.[methode]?.())
    .catch(() => { /* version de l'application sans le greffon */ });
}

/**
 * Le micro vient d'etre rendu : la sortie revient au jeu.
 *
 * Appelable autant de fois qu'on veut — les tentatives en attente sont
 * remplacees, pas empilees.
 */
export function rendreLeSonAuJeu() {
  if (!EST_NATIF || !surIOS()) return;
  while (minuteurs.length) clearTimeout(minuteurs.pop());
  for (const d of REPRISE) minuteurs.push(setTimeout(() => appeler('rendreAuJeu'), d));
}
