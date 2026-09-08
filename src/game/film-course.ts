// Le film du one shot, entre la course qui le tourne et l'ecran qui le propose.
//
// `review.ts` sait filmer un canvas ; il ne sait pas OU LE POSER. En direct la
// question ne se posait pas : le panneau qui lance la course est le meme qui
// montre la video, il gardait donc son enregistreur dans une reference et tout
// tenait dans un composant. Le one shot coupe cette continuite en deux — la
// course se joue sous `RaceHUD`, l'ecran de fin ne se monte qu'apres, et un
// enregistreur pose dans l'un n'existe deja plus quand l'autre arrive.
//
// D'ou ce module : l'enregistreur vit ici, au-dessus des composants, et chacun
// s'y adresse depuis son cote. C'est le meme arrangement que `objectif.ts` —
// un etat de jeu qui traverse les ecrans, avec un abonnement pour que React le
// suive.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Review, type EtatReview } from './review';
import { SprinterApp, useGameStore } from './engine';

const REPOS: EtatReview = {
  phase: 'inactif', url: null, fichier: 'sprinter.mp4', reste: 0, taille: 0,
};

let film: Review | null = null;
let etat: EtatReview = REPOS;
const abonnes = new Set<() => void>();

function diffuser(e: EtatReview) {
  etat = e;
  for (const prevenir of Array.from(abonnes)) prevenir();
}

/** L'enregistreur, cree au premier besoin. */
export function filmDeLaCourse(): Review {
  if (!film) film = new Review(diffuser);
  return film;
}

export function etatDuFilm(): EtatReview { return etat; }

function abonner(prevenir: () => void): () => void {
  abonnes.add(prevenir);
  return () => { abonnes.delete(prevenir); };
}

/** L'etat du film, pour un composant. */
export function useFilmDeLaCourse(): EtatReview {
  return useSyncExternalStore(abonner, etatDuFilm, etatDuFilm);
}

/** Fait sortir le film de l'application. Voir `Review.partager`. */
export function partagerLeFilm() {
  return filmDeLaCourse().partager();
}

/**
 * LE SON DU JEU, POUR LE FILM.
 *
 * Un replay muet n'est pas un replay : la course, c'est le pistolet, la foule
 * et la musique qui s'arrete a l'arrivee. Le moteur pose une derivation sur sa
 * sortie audio — voir `Audio_.prise` dans sprinter-app.js — et on lui prend
 * simplement sa piste.
 *
 * Rend un tableau vide quand le son n'est pas disponible : navigateur sans
 * Web Audio, contexte jamais ouvert, appareil recalcitrant. Le film se tourne
 * alors sans, ce qui reste mieux que pas de film.
 */
export function sonDuJeu(): MediaStreamTrack[] {
  try {
    const flux: MediaStream | null = SprinterApp.Audio_?.prise?.() || null;
    return flux ? flux.getAudioTracks() : [];
  } catch {
    return [];
  }
}

/**
 * FILME LE ONE SHOT, D'UN BOUT A L'AUTRE.
 *
 * Ce crochet se pose une seule fois, a la racine, et ne rend rien : il regarde
 * l'etat du jeu passer et decide quand la camera tourne. Le decoupage suit
 * exactement celui du moteur.
 *
 *   count   premiere epreuve  -> on demarre une prise neuve, son compris
 *   count   epreuve suivante  -> on REPREND la meme prise
 *   result                    -> on met en pause : l'attente entre deux
 *                                epreuves n'a rien a faire dans le film
 *   winall                    -> on arrete, et le compte a rebours part
 *   falseout / over / title   -> on jette : il n'y a pas de course a montrer
 *
 * DEUX COURSES QU'ON NE FILME PAS ICI. Le direct a son propre enregistreur,
 * dans `LivePanel`, et filmer deux fois le meme canvas doublerait le travail
 * d'encodage au pire moment. La carriere, elle, n'a pas d'ecran ou proposer la
 * video — c'est le one shot qui porte « PARTAGER MA COURSE ».
 *
 * ET ON NE FILME PAS UN ECRAN QU'ON NE MONTRERA PAS. Un appareil qui ne sait
 * pas encoder le dit tout de suite ; on ne lui prend pas d'images pour rien.
 */
export function useFilmerLeOneShot() {
  const state = useGameStore(s => s.state);
  const mode = useGameStore(s => s.mode);
  const liveOn = useGameStore(s => s.liveOn);
  const shotIdx = useGameStore(s => s.shotIdx);

  /** L'etat precedent : on agit sur les PASSAGES, pas sur les sejours. */
  const avant = useRef<string>('');

  useEffect(() => {
    if (state === avant.current) return;
    const veille = avant.current;
    avant.current = state;

    if (!Review.supporte()) return;
    const oneShot = mode === 'oneshot' && !liveOn;
    const f = filmDeLaCourse();

    if (state === 'count') {
      if (!oneShot) return;
      // Reprendre plutot que recommencer : la prise en cours contient deja les
      // epreuves precedentes, et la jeter ici ne laisserait au joueur que son
      // 400 m alors que son chrono, lui, additionne les trois.
      if (shotIdx > 0 && f.filme()) f.reprendre();
      else f.demarrer(SprinterApp.G.cv || null, sonDuJeu());
      return;
    }

    if (state === 'result') { if (oneShot) f.pause(); return; }

    if (state === 'winall') { if (oneShot) void f.arreter(); return; }

    // Un faux depart n'a pas de chrono, donc pas d'affiche et pas de video :
    // l'ecran de fin cache les deux boutons, et garder le film en memoire
    // reviendrait a stocker quelques mega-octets que personne ne verra.
    if (state === 'falseout' || state === 'over') { f.jeter(); return; }

    // Retour a l'ecran-titre, mais seulement en QUITTANT une course. La video
    // prete survit a tout le reste : le joueur peut ouvrir le classement, lire
    // sa boite, revenir — elle l'attend, jusqu'a ses deux heures.
    if (state === 'title' && (veille === 'count' || veille === 'race' || veille === 'result')) f.jeter();
  }, [state, mode, liveOn, shotIdx]);
}
