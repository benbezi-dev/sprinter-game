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

import { useSyncExternalStore } from 'react';
import type { Salle } from './live';

let courant: Salle | null = null;

/* ---------------------------------------------------------------------------
   QUI REGARDE LA SALLE
   ---------------------------------------------------------------------------
   Le panneau du direct la pilote ; l'ecran de fin de course, lui, n'a qu'a la
   lire — qui est encore la, qui veut la revanche, si la piste est encore
   ouverte. Il s'abonne ici plutot qu'a la salle elle-meme : la salle change
   quand on la quitte ou qu'on en rejoint une autre, et l'abonnement doit
   suivre sans que l'ecran ait a s'en occuper.
--------------------------------------------------------------------------- */

let version = 0;
const abonnes = new Set<() => void>();
let lacher: (() => void) | null = null;

function prevenir() {
  version++;
  for (const f of abonnes) {
    try { f(); } catch { /* un ecran casse n'empeche pas les autres */ }
  }
}

function suivre(s: Salle | null) {
  lacher?.();
  lacher = s ? s.observer(prevenir) : null;
  prevenir();
}

/**
 * La salle du direct, et un nouveau rendu a chacun de ses changements.
 *
 * Rend la salle elle-meme : c'est elle qui sait ou elle en est (dernierEtat,
 * enVie, coupee, pretMoi). Nulle quand on n'est sur aucune piste.
 */
export function useSalonDirect(): Salle | null {
  useSyncExternalStore(
    f => { abonnes.add(f); return () => { abonnes.delete(f); }; },
    () => version,
  );
  return courant;
}

/**
 * Prend une salle en charge. Celle qui etait la, s'il y en avait une, est
 * fermee — on ne court pas deux courses a la fois.
 */
export function poserSalon(s: Salle | null) {
  if (courant && courant !== s) {
    try { courant.fermer(); } catch { /* deja fermee */ }
  }
  courant = s;
  suivre(s);
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
  suivre(null);
}

/**
 * LA REVANCHE : DIRE OUI, OU REVENIR SUR SON OUI.
 *
 * Dans la salle, c'est « pret », et rien d'autre : la salle repart quand tous
 * ses couloirs sont pris et que chacun l'a dit — elle remet tout le monde a
 * « pas pret » a chaque verdict, si bien qu'aucun oui de la course d'avant ne
 * compte pour la suivante.
 *
 * Une salle qui s'est fermee entre-temps se rouvre sous le meme code, et l'on
 * y revient deja pret : demander la revanche, c'est accepter de courir.
 */
export function voterRevanche(oui: boolean) {
  const s = courant;
  if (!s) return;
  if (s.enVie()) s.pret(oui);
  else if (oui) s.rouvrir(true);
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
