/* ---------------------------------------------------------------------------
   HURDLERS — le tutoriel se joue SUR LA PISTE
   ---------------------------------------------------------------------------
   Pas une maquette du geste : le geste. Le moteur fait courir le vrai coureur
   sur la vraie piste, les vraies haies y sont posees, et ce qui note le joueur
   est ce qui le notera en course. Le tutoriel n'ajoute que trois choses, et
   aucune n'est une regle :

     UN DEPART LANCE   on repose le coureur devant une haie, autant de fois
                       qu'on veut, sans refaire la mise en action.
     UN RALENTI        le monde entier tourne moins vite (game/tempo.ts), le
                       temps qu'un geste de quatre dixiemes devienne lisible.
     UN PILOTE         pour la demonstration, quelqu'un doit jouer. C'est une
                       machine, et elle joue AVEC LES MEMES TOUCHES que le
                       joueur — padPress et padRelease, rien d'autre. Une demo
                       qui tricherait montrerait un geste impossible.

   LE PILOTE COMPTE EN TEMPS SIMULE, ET C'EST LE PIEGE DE TOUT LE FICHIER.
   Sa cadence est une frequence du jeu — neuf frappes par seconde de course.
   Comptee sur l'horloge du navigateur, elle resterait a neuf frappes par
   seconde reelle : au ralenti, la machine taperait deux fois trop vite pour le
   monde ou elle court, hacherait sa foulee et raterait ses haies sous les yeux
   du joueur a qui l'on demande d'imiter. Elle lit donc `G.elapsed`, le chrono
   de la course, qui ralentit avec le reste.
--------------------------------------------------------------------------- */

import { SprinterApp, padPress, padRelease } from './engine';
import { poserLeTempo, rendreLeTempo } from './tempo';
import { armerHaies, rangerHaies, haiesEnCours, haiesFranchies,
         lancerDevantLaHaie, approcheHaies, ciseauHaies } from './haies-course.js';
import { HAIES } from './haies.js';
import { CISEAU_VISE } from './haies-jeu.js';

/** L'epreuve du tutoriel. Le 110 m haies, comme la premiere course du monde. */
export const CLE = '110h';

/**
 * COMBIEN DE PISTE AVANT LA HAIE, en metres.
 *
 * Douze : de quoi installer sa cadence sur cinq ou six appuis avant que la
 * fenetre d'appel ne s'ouvre, et pas davantage. A vitesse reelle cela fait
 * treize dixiemes de seconde — une sequence se rejoue donc en trois secondes,
 * ce qui est la seule raison pour laquelle on accepte de la rejouer.
 */
const ELAN = 12;

/**
 * La vitesse a laquelle on repose le coureur : celle d'un hurdleur lance.
 *
 * Pas son maximum — un hurdleur ne court jamais a son maximum de sprinteur —
 * mais la vitesse ou le compte du reglement tombe juste. C'est aussi celle que
 * le joueur retrouvera en course s'il tient sa cadence.
 */
const VITESSE = () => (HAIES[CLE].maxSpeed || 9.6) * 0.96;

/**
 * La cadence du pilote, en frappes par seconde de course.
 *
 * Le milieu de la bande ou le compte du reglement tombe — sept appuis jusqu'a
 * la premiere haie, quatre par intervalle. En dessous on s'etire, au-dessus on
 * hache. C'est la meme bande que le joueur devra tenir a l'etape de la
 * cadence, et c'est voulu : la demo joue ce que l'etape demande.
 */
const CADENCE = 9;

/**
 * OU LE PILOTE DONNE SON APPEL, sur la jauge d'approche.
 *
 * A 1 la jauge est pleine et le pied tombe au point du reglement. On ne vise
 * pas 0,99 « pour etre sur » : la machine doit montrer le geste juste, pas un
 * geste prudent. Le retard d'une image — quinze centimetres a cette vitesse —
 * tient dans la tolerance du parfait, qui en fait trente.
 */
const APPEL_VISE = 1;

/**
 * QUAND UNE SEQUENCE EST PERDUE, ET POURQUOI IL EN FAUT UNE DEFINITION.
 *
 * Le coureur n'avance que si l'on tape. Un joueur qui regarde sans rien faire
 * — la premiere fois, c'est le cas de tout le monde — le voit donc ralentir,
 * s'arreter a trois metres de la haie, et plus rien n'arrive : la sequence
 * attend une haie qui ne sera jamais franchie, l'ecran attend la sequence, et
 * le tutoriel est mort sans un mot. On declare donc la sequence perdue des que
 * le coureur n'avance plus, ou qu'elle dure plus longtemps qu'aucune ne peut
 * durer, et l'on repropose.
 *
 * `ARRET` est en metres par seconde : en dessous, personne ne franchit plus
 * rien. `LIMITE` est en secondes de course — vingt et un metres a la vitesse
 * d'un hurdleur en font deux et demie, et le double laisse de la place a qui
 * tape trop lentement sans laisser d'attente inexplicable.
 */
const ARRET = 1.5;
const LIMITE = 6;

/** L'etat de la sequence en cours. Nul quand le tutoriel ne tourne pas. */
let seq = null;

/** Le tutoriel tient-il la piste en ce moment ? */
export function tutoEnPiste() { return seq !== null; }

/**
 * Ce que l'ecran a besoin de savoir a chaque image, et rien de plus.
 *
 * `franchies` compte les haies de CETTE sequence ; `fini` dit que la derniere
 * est passee et que le monde est fige.
 */
export function etatDuTuto() {
  if (!seq) return null;
  return {
    demo: seq.demo,
    franchies: Math.max(0, haiesFranchies() - seq.haie0),
    total: seq.nb,
    fini: seq.fini,
    // La sequence s'est-elle arretee faute de coureur plutot qu'au bout des
    // haies ? L'ecran doit pouvoir le dire : ce n'est pas une haie ratee,
    // c'est une haie jamais tentee.
    abandon: seq.abandon,
    tempo: seq.tempo,
  };
}

/**
 * Poser le decor une fois pour toutes : la piste, les haies, et le coureur
 * seul dessus.
 *
 * LE JOUEUR COURT SEUL, et ce n'est pas une economie. Sept adversaires partis
 * des blocs pendant qu'on repose le coureur au milieu de la piste donnent une
 * image que rien n'explique — on ne sait plus qui regarder, et la premiere
 * chose qu'apprend le joueur est qu'il a cent metres de retard.
 */
function poserLaScene() {
  const A = SprinterApp, G = A.G;
  // `RACES` recoit les epreuves de haies au chargement de game/jeux.ts. Le
  // repli sur HAIES n'est pas de la prudence decorative : ce module peut etre
  // charge par un harnais qui ne monte pas le jeu entier, et une course nulle
  // ferait tomber buildLevel sans rien dire de la cause.
  G.race = (A.RACES && A.RACES[CLE]) || HAIES[CLE];
  G.raceKey = CLE;
  A.buildLevel(G.levelIdx || 0);
  G.runners = [G.player];
  armerHaies(CLE);
}

/**
 * Lancer une sequence : le coureur repose devant la haie `haie`, il en a `nb`
 * a franchir, le monde tourne a `tempo`, et `demo` dit qui joue.
 */
export function demarrerSequence({ haie = 0, nb = 2, tempo = 1, demo = false } = {}) {
  const G = SprinterApp.G;
  if (!haiesEnCours()) poserLaScene();

  G.state = 'race';
  G.paused = false;
  G.elapsed = 0;
  // Le faux depart n'a pas de sens sur un depart lance : il n'y a pas eu de
  // pistolet. Sans cela, la premiere frappe du joueur serait jugee anticipee.
  G.falseOut = false;
  G.falseOutT = 0;
  G.skipArm = 0;

  lancerDevantLaHaie(haie, ELAN, VITESSE());

  seq = {
    haie0: haie, nb, tempo, demo, fini: false, abandon: false,
    // Le pilote : son dernier appui, de quel cote, et ce qu'il tient.
    derniere: 0, cote: 'left', tenu: null, appele: false,
  };
  poserLeTempo(tempo);
  return etatDuTuto();
}

/**
 * Figer la piste sur place, sans rien ranger.
 *
 * L'ecran de fin du tutoriel s'affiche par-dessus le stade : le coureur doit
 * s'arreter la ou il est. Sans cet appel, plus personne ne fait avancer le
 * tutoriel — l'ecran a fini son travail — et le monde, lui, tourne toujours :
 * le coureur part finir sa course seul derriere la page de felicitations.
 */
export function figerLaPiste() {
  if (seq) seq.fini = true;
  poserLeTempo(0);
}

/** Rejouer la meme sequence, aux memes conditions. */
export function rejouerSequence() {
  if (!seq) return null;
  return demarrerSequence({ haie: seq.haie0, nb: seq.nb, tempo: seq.tempo, demo: seq.demo });
}

/**
 * Ranger le tutoriel : le monde reprend sa vitesse et la piste ses haies.
 *
 * A APPELER EN QUITTANT, toujours. Un tempo laisse a 0,5 rendrait le jeu
 * entier poisseux sans que rien ne le dise, et des haies laissees sur la piste
 * suivraient le joueur sur son prochain 100 m plat.
 */
export function rangerLeTuto() {
  seq = null;
  rendreLeTempo();
  rangerHaies();
  const G = SprinterApp.G;
  if (G) G.state = 'title';
}

/**
 * LE PAS DU TUTORIEL, a appeler a chaque image.
 *
 * Deux choses : faire jouer le pilote quand c'est la demo, et figer le monde
 * quand la derniere haie est passee. Le gel se fait par le tempo plutot que
 * par une pause : `G.paused` ouvre le panneau de sortie de course, et la
 * question « veux-tu quitter ? » n'a rien a faire au milieu d'une lecon.
 */
export function pasDuTuto() {
  if (!seq) return null;
  const G = SprinterApp.G;
  if (!G || !G.player) return etatDuTuto();

  // LE GEL SE REPOSE A CHAQUE IMAGE TANT QU'IL N'A PAS PRIS, et c'est une
  // correction, pas une precaution. On attend la fin du vol pour figer —
  // couper le monde en plein saut donnerait un coureur suspendu en l'air. Mais
  // sortir ici des que la sequence est finie laissait ce report sans seconde
  // chance : si la derniere haie se terminait en l'air, le gel n'arrivait
  // jamais. Le tutoriel affichait sa page de fin pendant que le coureur, lui,
  // continuait de courir le 110 m tout seul derriere — vu une fois, une course
  // entiere terminee en 23,67 s et un classement affiche sous l'ecran de fin.
  if (seq.fini) {
    if (!G.player.freeze) poserLeTempo(0);
    return etatDuTuto();
  }

  // LE COUREUR S'EST-IL ARRETE ? On ne regarde pas la demo : le pilote tape
  // toujours, et un faux positif la couperait en plein geste.
  const j = G.player;
  if (!seq.demo && ((!j.freeze && j.v < ARRET) || G.elapsed > LIMITE)) {
    seq.fini = true;
    seq.abandon = true;
    poserLeTempo(0);
    return etatDuTuto();
  }

  if (haiesFranchies() - seq.haie0 >= seq.nb) {
    seq.fini = true;
    // On laisse la reception se terminer avant de figer : couper le monde en
    // plein vol donnerait un coureur suspendu en l'air, ce qui n'est l'image
    // de rien. Le gel differe se repose plus haut, a chaque image.
    if (!G.player.freeze) poserLeTempo(0);
    return etatDuTuto();
  }

  if (seq.demo) piloter(G);
  return etatDuTuto();
}

/**
 * LE PILOTE. Trois gestes, dans cet ordre de priorite, et jamais deux dans la
 * meme image : relacher le ciseau, donner l'appel, tenir la cadence.
 */
function piloter(G) {
  const vol = ciseauHaies();
  if (vol) {
    // EN L'AIR ON NE TAPE PAS. Une frappe donnee en vol se paie (haies-jeu.js,
    // GARDE_FRAPPE_VOL) : la demo doit montrer un pouce qui attend, parce que
    // c'est ce qu'on demande au joueur.
    if (!vol.fait && vol.part >= CISEAU_VISE && seq.tenu) {
      padRelease(seq.tenu);
      seq.tenu = null;
    }
    return;
  }

  const ap = approcheHaies();
  if (ap) {
    // LA FENETRE EST OUVERTE : on ne court plus, on attend le point d'appel.
    // Taper ici donnerait l'appel de trop loin — c'est la faute que le joueur
    // commet, et la demo n'a pas a la commettre devant lui.
    if (!seq.appele && ap.avance >= APPEL_VISE) {
      const cote = ap.cote || seq.cote;
      padPress(cote);
      seq.tenu = cote;
      seq.appele = true;
    }
    return;
  }

  // Ni en l'air ni en approche : on court, en alternant, a la cadence de la
  // bande juste. Le compte est sur le chrono de la course, pas sur celui du
  // navigateur — voir l'en-tete du fichier.
  seq.appele = false;
  if (seq.tenu) { padRelease(seq.tenu); seq.tenu = null; }
  if (G.elapsed - seq.derniere >= 1 / CADENCE) {
    seq.derniere = G.elapsed;
    seq.cote = seq.cote === 'left' ? 'right' : 'left';
    padPress(seq.cote);
    padRelease(seq.cote);
  }
}

/* ---------------------------------------------------------------------------
   QUI TIENT L'ECRAN DU TUTORIEL
   ---------------------------------------------------------------------------
   Une question d'architecture, et elle a une bonne raison d'etre ici.

   L'ecran du tutoriel ne peut pas vivre dans l'accueil, comme vivait celui
   qu'il remplace. L'accueil n'est monte que pendant l'etat `title`, et ce
   tutoriel met le jeu en etat `race` — il se demonterait lui-meme a la
   premiere sequence. Il est donc monte a la racine, et c'est ce drapeau qui
   dit a la racine de le monter.

   Il vit ici plutot que dans un module a part parce qu'il decrit exactement la
   meme chose que `seq` : le tutoriel occupe-t-il la piste. Les separer
   donnerait deux verites a tenir d'accord.
--------------------------------------------------------------------------- */

let ouvert = false;
const abonnes = new Set();

/** L'ecran du tutoriel doit-il etre a l'ecran ? */
export function tutoOuvert() { return ouvert; }

/** S'abonner a l'ouverture et a la fermeture. Rend de quoi se desabonner. */
export function abonnerAuTuto(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

function prevenir() { for (const f of abonnes) f(); }

/** Ouvrir le tutoriel. L'ecran se monte, et lance sa premiere sequence. */
export function ouvrirLeTuto() {
  if (ouvert) return;
  ouvert = true;
  prevenir();
}

/**
 * Fermer le tutoriel. C'est le demontage de l'ecran qui rend la piste — voir
 * rangerLeTuto — pour que la fermeture par la croix, par la fin, ou par un
 * changement d'ecran passent toutes par le meme chemin.
 */
export function fermerLeTuto() {
  if (!ouvert) return;
  ouvert = false;
  prevenir();
}
