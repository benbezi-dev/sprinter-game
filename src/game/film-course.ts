// Le film de la course, entre celle qui le tourne et l'ecran qui le propose.
//
// `review.ts` sait filmer un canvas ; il ne sait pas OU LE POSER. Le one shot
// coupe cette continuite en deux — la course se joue sous `RaceHUD`, l'ecran de
// fin ne se monte qu'apres, et un enregistreur pose dans l'un n'existe deja
// plus quand l'autre arrive.
//
// LE DIRECT ET LE RELAIS ONT EXACTEMENT LE MEME PROBLEME, et c'est pour cela
// qu'ils sont ici eux aussi. Le direct gardait son enregistreur dans un `ref`
// de `LivePanel` — un panneau qui vit dans l'ecran-titre, lequel disparait au
// coup de pistolet. Le film se tournait donc bien, mais son proprietaire etait
// demonte avant la premiere image : au retour, le panneau se remontait a neuf,
// avec un `ref` vide, et la video de la course restait en memoire sans qu'un
// seul ecran puisse la proposer. Le relais, lui, ne filmait rien du tout.
//
// D'ou ce module : l'enregistreur vit ici, au-dessus des composants, et chacun
// s'y adresse depuis son cote. C'est le meme arrangement que `objectif.ts` —
// un etat de jeu qui traverse les ecrans, avec un abonnement pour que React le
// suive.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Review, type EtatReview } from './review';
import { SprinterApp, useGameStore } from './engine';
import { peindreLeHud } from './hud-film';
import { peindreLeCarton, peindreLOuverture } from './carton-film';
import { poserLeDefiDeLaCamera, oublierLeDefiDeLaCamera } from './defi-camera';

/**
 * A QUELLE COURSE APPARTIENT LE FILM.
 *
 * Il n'y a qu'un enregistreur — on ne court qu'une course a la fois, et
 * encoder deux fois le meme canvas doublerait le travail au pire moment. Mais
 * quatre modes s'en servent maintenant, et chacun a ses propres regles de
 * debut, de fin et d'abandon. Sans nom sur la prise, celui qui range apres sa
 * course jetterait le film d'un autre : cette ligne-la passait aussi pendant
 * un relais.
 *
 * Le genre sert aussi a l'ECRAN. L'ecran de fin du one shot, le salon du
 * direct, l'arrivee du relais et l'ecran de fin de carriere lisent le meme
 * etat ; chacun ne montre que ce qui le concerne.
 *
 * `campaign` s'est ajoute le 20/10/2026 : la carriere est filmee a son tour,
 * une course a la fois (pas le parcours entier — six etapes en 2K feraient un
 * fichier qu'un telephone modeste ne tiendrait pas), et son replay se propose
 * sur l'ecran de victoire comme sur l'ecran de defaite.
 */
export type GenreFilm = 'oneshot' | 'direct' | 'relais' | 'campaign';

/** L'etat du film, plus le nom de la course a qui il appartient. */
export type VueFilm = EtatReview & { genre: GenreFilm | null };

const REPOS: EtatReview = {
  phase: 'inactif', url: null, fichier: 'sprinter.mp4', reste: 0, taille: 0,
};

let film: Review | null = null;
let genre: GenreFilm | null = null;
let vue: VueFilm = { ...REPOS, genre: null };
/** Le demarrage programme, garde pour pouvoir l'annuler. Voir `programmerLeFilm`. */
let depart: ReturnType<typeof setTimeout> | null = null;
/**
 * L'arret en cours, le temps que le carton se peigne. Le film est encore
 * « en enregistrement » pendant cette seconde et demie : sans cette trace, un
 * retour au salon dans l'intervalle le prenait pour une course abandonnee et
 * le jetait — la video d'une course finie, perdue sur un appui trop rapide.
 */
let arret: Promise<void> | null = null;
const abonnes = new Set<() => void>();

function prevenir() {
  for (const dire of Array.from(abonnes)) dire();
}

function diffuser(e: EtatReview) {
  vue = { ...e, genre };
  prevenir();
}

function poserGenre(g: GenreFilm | null) {
  if (g === genre) return;
  genre = g;
  vue = { ...vue, genre };
  prevenir();
}

/** L'enregistreur, cree au premier besoin. */
export function filmDeLaCourse(): Review {
  if (!film) film = new Review(diffuser);
  return film;
}

export function etatDuFilm(): VueFilm { return vue; }

/** A qui est le film en cours — ou `null` s'il n'y en a pas. */
export function genreDuFilm(): GenreFilm | null { return genre; }

function abonner(prevenirMoi: () => void): () => void {
  abonnes.add(prevenirMoi);
  return () => { abonnes.delete(prevenirMoi); };
}

/** L'etat du film, pour un composant. */
export function useFilmDeLaCourse(): VueFilm {
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
 *
 * Personne ne l'appelle du dehors : les trois courses passent par
 * `demarrerLeFilm`, qui prend le son du jeu de lui-meme. Un mode qui filmerait
 * sans le stade serait un oubli, pas un choix.
 */
function sonDuJeu(): MediaStreamTrack[] {
  try {
    const flux: MediaStream | null = SprinterApp.Audio_?.prise?.() || null;
    return flux ? flux.getAudioTracks() : [];
  } catch {
    return [];
  }
}

/**
 * L'avance prise sur le pistolet.
 *
 * Un encodeur ne demarre pas a l'instant ou on le lui demande. Le lancer sur
 * le coup de feu, c'est perdre la sortie des blocs — la seule image que tout
 * le monde regarde deux fois.
 */
const AVANCE_MS = 300;

function annulerLeDepart() {
  if (depart) { clearTimeout(depart); depart = null; }
}

/**
 * LE HUD DU JEU, POUR LE FILM.
 *
 * Le pendant de `sonDuJeu`, pour l'image. Le canevas ne porte que le stade :
 * le chrono qui defile, le rang, l'epreuve, le starter et les retours de
 * course sont du DOM React pose au-dessus, et `captureStream` ne voit pas le
 * DOM. Les replays sortaient donc sans chrono — on y regardait courir sans
 * jamais savoir en combien. `peindreLeHud` les repeint sur le montage
 * qu'enregistre `review.ts` ; voir `hud-film.ts`.
 */

/** Commence une prise neuve pour cette course, son du jeu compris. */
export function demarrerLeFilm(
  g: GenreFilm,
  sons: Array<MediaStreamTrack | null | undefined> = [],
) {
  annulerLeDepart();
  poserGenre(g);
  // Une prise neuve n'herite pas du code de la precedente : le carton
  // afficherait le defi d'une course qui n'est pas celle qu'on regarde.
  oublierLeDefiDeLaCamera();
  filmDeLaCourse().demarrer(SprinterApp.G.cv || null, [...sonDuJeu(), ...sons],
                            hudEtOuverture());
}

/**
 * LE HUD, ET L'OUVERTURE PAR-DESSUS — tant que l'appareil suit.
 *
 * L'ouverture (`peindreLOuverture`) ne coute presque rien : trois textes et
 * deux aplats. Mais le jeu doit tourner sur le plus modeste des telephones :
 * si les images du film arrivent a plus de 60 ms d'ecart en moyenne (moins de
 * 17 par seconde), l'appareil peine deja, et on ne lui ajoute rien.
 */
function hudEtOuverture() {
  const debut = performance.now();
  let avant = 0, ecart = 33;
  return (ctx: CanvasRenderingContext2D, l: number, h: number) => {
    peindreLeHud(ctx, l, h);
    const t = performance.now();
    if (avant) ecart = ecart * 0.8 + (t - avant) * 0.2;
    avant = t;
    if (ecart > 60) return;
    try { peindreLOuverture(ctx, l, h, t - debut); } catch { /* le film sortira sans */ }
  };
}

/**
 * FILME DANS `dansMs`, UN PEU AVANT LE PISTOLET.
 *
 * Le direct et le relais ne partent pas « dans trois secondes » mais a une
 * date annoncee par la salle. Ils savent donc, a la milliseconde pres, quand
 * la course commence — et c'est la seule facon d'avoir le depart dans le film
 * sans filmer l'attente du salon.
 *
 * LES PISTES SON SONT UNE FONCTION, ET NON UNE LISTE. La voix de l'adversaire
 * arrive par une connexion qui se negocie encore au moment ou l'on programme :
 * la lire ici rendrait `null` a tous les coups. On la relit au depart.
 *
 * Le genre est pose TOUT DE SUITE, avant meme que la camera ne tourne : sans
 * cela, un joueur qui quitte pendant ces trois secondes ne pourrait pas
 * annuler une prise qui ne lui appartient pas encore.
 */
export function programmerLeFilm(
  g: GenreFilm,
  dansMs: number,
  sons?: () => Array<MediaStreamTrack | null | undefined>,
) {
  annulerLeDepart();
  poserGenre(g);
  depart = setTimeout(() => {
    depart = null;
    demarrerLeFilm(g, sons ? sons() : []);
  }, Math.max(0, dansMs - AVANCE_MS));
}

/**
 * Arrete la prise et publie le fichier — si elle est bien a nous.
 *
 * Rien ne garantit qu'un message de fin arrive apres la course qui l'a
 * demande : une salle peut annoncer un resultat alors que le joueur est deja
 * reparti sur autre chose. Le genre tranche.
 *
 * LE CARTON DE FIN EST POSE ICI, et pour les trois courses sans distinction.
 * C'est le pendant exact de `peindreLeHud` a `demarrerLeFilm` : `review.ts`
 * sait quand l'enregistreur ecrit encore, ce module sait ce qu'il faut y
 * ecrire. Le film gagne donc une seconde et demie — d'ou l'attente avant que
 * le bouton de partage ne s'allume, voir `Review.arreter`.
 */
export function arreterLeFilm(g: GenreFilm): Promise<void> {
  if (genre !== g) return Promise.resolve();
  annulerLeDepart();
  // Deux demandes pour une seule prise — le direct s'arrete au retour au
  // salon, puis au verdict de la salle — ne font qu'un arret, et un seul
  // defi de camera. Et rien ne tourne, rien ne s'arrete.
  if (arret) return arret;
  if (!filmDeLaCourse().filme()) return Promise.resolve();
  // LA CAMERA POSE SON DEFI AVANT DE S'ARRETER, et d'un cheveu : le carton met
  // une seconde et demie a se peindre, c'est tout ce dont le serveur dispose
  // pour rendre un code. On n'attend pas sa reponse — voir
  // `poserLeDefiDeLaCamera` — le carton lui garde sa place et sort sans lui
  // s'il tarde.
  poserLeDefiDeLaCamera(g);
  const ceLui = filmDeLaCourse().arreter(peindreLeCarton)
    .finally(() => { if (arret === ceLui) arret = null; });
  arret = ceLui;
  return ceLui;
}

/** Libere le film de cette course-la, et rien d'autre. */
export function jeterLeFilm(g: GenreFilm | null) {
  if (!g || genre !== g) return;
  annulerLeDepart();
  filmDeLaCourse().jeter();
  oublierLeDefiDeLaCamera();
  poserGenre(null);
}

/**
 * FILME LES COURSES PILOTEES PAR LE MOTEUR : LE ONE SHOT ET LA CARRIERE.
 *
 * Ce crochet se pose une seule fois, a la racine, et ne rend rien : il regarde
 * l'etat du jeu passer et decide quand la camera tourne. Le decoupage suit
 * exactement celui du moteur.
 *
 *   count   premiere course   -> on demarre une prise neuve, son compris
 *   count   epreuve suivante  -> one shot : on REPREND la meme prise
 *                                carriere : on repart a neuf (voir plus bas)
 *   result                    -> one shot : pause (l'attente entre deux
 *                                epreuves n'a rien a faire dans le film)
 *   winall                    -> on arrete, et le compte a rebours part
 *   over                      -> defaite de carriere : on arrete AUSSI — la
 *                                course a eu lieu, l'ecran de defaite la propose
 *   falseout                  -> on arrete : le depart manque se partage lui
 *                                aussi (demande du 20/10/2026)
 *   title                     -> on jette si l'on QUITTE une course
 *
 * ONE SHOT ET CARRIERE SE FILMENT DIFFEREMMENT. Le one shot additionne les
 * epreuves choisies dans UN seul film — son chrono les additionne aussi — donc
 * on REPREND la prise d'une epreuve a la suivante, avec une pause entre les
 * deux. La carriere, elle, filme chaque course A PART : six etapes d'affilee en
 * 2K feraient un fichier qu'un telephone modeste ne tiendrait pas en memoire.
 * Son replay est donc celui de la DERNIERE course — la finale sur l'ecran de
 * victoire, l'etape perdue sur l'ecran de defaite. L'etape suivante repart a
 * neuf : `demarrerLeFilm` jette la prise precedente avant d'en ouvrir une.
 *
 * LE DIRECT ET LE RELAIS NE PASSENT PAS PAR ICI. Ils partent sur une date
 * annoncee par leur salle et s'arretent sur son verdict, pas sur l'etat du
 * moteur : ils posent leur camera eux-memes. Ce crochet ne touche donc qu'aux
 * films marques « oneshot » ou « campaign » — a une exception, le retour a
 * l'ecran-titre, seul chemin par lequel une course abandonnee passe quel que
 * soit son mode.
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

    // Une course qu'on abandonne n'a pas de replay, quel que soit son mode.
    //
    // Le bouton « accueil » de la course passe par ici et par nulle part
    // ailleurs : sans cette ligne, l'enregistreur d'un direct ou d'un relais
    // quitte en cours de route continuerait de filmer l'ecran-titre, jusqu'a
    // ce que quelqu'un pense a l'arreter — c'est-a-dire jamais.
    //
    // MAIS UNE COURSE FINIE N'EST PAS ABANDONNEE. Deux cas gardent leur film :
    //   - celui qui s'arrete deja, le temps de peindre son carton ;
    //   - le direct dont on a passe la ligne — on revient de l'ecran de fin,
    //     pas de la piste. Les autres courent peut-etre encore, mais l'ecran-
    //     titre n'a rien a faire dans le film : on l'arrete ici, et la video
    //     attend dans le salon, ou elle se partage.
    if (state === 'title' && etatDuFilm().phase === 'enregistre') {
      if (arret) return;
      const enCourse = veille === 'count' || veille === 'race' || veille === 'result';
      if (genreDuFilm() === 'direct' && !enCourse) { void arreterLeFilm('direct'); return; }
      jeterLeFilm(genreDuFilm());
      return;
    }

    if (!Review.supporte()) return;
    const oneShot = mode === 'oneshot' && !liveOn;
    const campagne = mode === 'campaign' && !liveOn;
    if (!oneShot && !campagne) return;
    const g: GenreFilm = oneShot ? 'oneshot' : 'campaign';
    const f = filmDeLaCourse();

    if (state === 'count') {
      // One shot : reprendre plutot que recommencer, la prise en cours contient
      // deja les epreuves precedentes et le chrono les additionne. Carriere :
      // chaque course est un film a elle seule, donc toujours une prise neuve
      // (demarrerLeFilm jette d'abord la precedente).
      if (oneShot && shotIdx > 0 && genreDuFilm() === 'oneshot' && f.filme()) f.reprendre();
      else demarrerLeFilm(g);
      return;
    }

    if (state === 'result') {
      // L'attente entre deux epreuves d'un one shot n'entre pas dans le film.
      // En carriere il n'y a rien a suspendre : la prise de l'etape suivante
      // repartira a neuf, celle-ci n'ira nulle part.
      if (oneShot && genreDuFilm() === 'oneshot') f.pause();
      return;
    }

    if (state === 'winall') { void arreterLeFilm(g); return; }

    // La defaite d'une carriere garde son film : la course a bien eu lieu, et
    // l'ecran de defaite (le Continue) la propose. Si le joueur reprend
    // l'etape, le prochain `count` ouvrira une prise neuve.
    if (state === 'over') { void arreterLeFilm(g); return; }

    // LE FAUX DEPART GARDE SON FILM (demande du 20/10/2026). Il n'elimine qu'en
    // one shot (falseStartOut) ; au lieu de jeter la prise, on l'arrete, et
    // l'ecran de fin propose le replay du depart manque. Le carton sort sans
    // chrono — il n'y en a pas (voir chronoDuCarton).
    if (state === 'falseout') { void arreterLeFilm(g); return; }

    // Retour a l'ecran-titre, mais seulement en QUITTANT une course. La video
    // prete survit a tout le reste : le joueur peut ouvrir le classement, lire
    // sa boite, revenir — elle l'attend, jusqu'a ses deux heures.
    if (state === 'title' && (veille === 'count' || veille === 'race' || veille === 'result')) {
      jeterLeFilm(g);
    }
  }, [state, mode, liveOn, shotIdx]);
}
