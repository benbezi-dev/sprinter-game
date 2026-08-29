// La salle de course en direct, et sa duree de vie.
//
// Ce fichier n'existe que pour corriger une chose, et elle merite d'etre
// ecrite parce qu'elle n'avait rien d'evident.
//
// Le panneau du direct vit dans l'ecran-titre. L'ecran-titre disparait au coup
// de pistolet — `state` passe a « count », React demonte le titre, et tout ce
// qu'il contenait avec lui. Le panneau fermait sa WebSocket a son demontage,
// comme on ferme proprement ce qu'on a ouvert. La salle se fermait donc a la
// seconde exacte ou la course commencait.
//
// Chez les deux joueurs en meme temps, evidemment. Chacun continuait de voir
// SON coureur avancer — il est calcule en local — et voyait l'autre fige sur
// la ligne, faute de la moindre position recue. Aucune erreur nulle part : la
// position sortante teste l'etat de la socket et se tait. A l'arrivee, aucun
// resultat n'arrivait non plus, et le jeu retombait sur l'ecran de fin du one
// shot comme si le duel n'avait jamais eu lieu.
//
// La correction n'est pas dans le reseau. C'est une erreur de duree de vie :
// une salle ne vit pas le temps qu'un panneau est affiche, elle vit de
// l'instant ou l'on entre sur la piste a celui ou l'on en sort. Que React
// monte ou demonte l'ecran entre les deux est un detail d'affichage.

import type { Salle } from './live';

let courant: Salle | null = null;

/**
 * Prend une salle en charge. Celle qui etait la, s'il y en avait une, est
 * fermee — on ne court pas deux courses a la fois.
 */
export function poserSalon(s: Salle | null) {
  if (courant && courant !== s) {
    try { courant.fermer(); } catch { /* deja fermee */ }
  }
  courant = s;
}

export function salonCourant(): Salle | null { return courant; }

/**
 * Sortir de la piste. C'est le SEUL endroit qui ferme une salle du direct :
 * un demontage de composant ne doit plus jamais le faire.
 */
export function quitterSalon() {
  if (!courant) return;
  try { courant.fermer(); } catch { /* deja fermee */ }
  courant = null;
}
