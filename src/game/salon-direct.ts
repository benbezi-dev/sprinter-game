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

/* ---------------------------------------------------------------------------
   REJOINDRE UNE SALLE DEPUIS L'EXTERIEUR DU PANNEAU
   ---------------------------------------------------------------------------
   Une invitation arrive n'importe quand, et l'ecran qui l'affiche n'est pas
   celui qui sait rejoindre une salle. Le panneau du direct, lui, sait — mais
   il n'est monte que dans l'ecran-titre, et pas toujours.

   Meme nature de probleme que le reste de ce fichier : deux choses qui doivent
   se parler n'ont pas la meme duree de vie. On depose donc la demande ici, et
   le panneau la ramasse — qu'il soit deja la, ou qu'il arrive apres.
--------------------------------------------------------------------------- */

let demande: string | null = null;
const guetteurs = new Set<(code: string) => void>();

/** Demande a rejoindre cette salle. Prise tout de suite, ou au montage. */
export function demanderRejoindre(code: string) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return;
  demande = c;
  // On previent qui ecoute. Si personne n'ecoute, la demande attend : c'est
  // tout l'objet de ce mecanisme.
  for (const g of guetteurs) {
    try { g(c); } catch { /* un guetteur casse n'empeche pas les autres */ }
  }
}

/**
 * Le panneau s'annonce. Il recoit la demande en attente s'il y en a une, puis
 * celles qui viendront tant qu'il reste monte.
 */
export function surDemandeRejoindre(f: (code: string) => void): () => void {
  guetteurs.add(f);
  if (demande) {
    const c = demande;
    demande = null;
    try { f(c); } catch { /* le panneau decidera */ }
  }
  return () => { guetteurs.delete(f); };
}

/** La demande a ete honoree : elle ne doit pas se rejouer. */
export function oublierDemande() { demande = null; }
