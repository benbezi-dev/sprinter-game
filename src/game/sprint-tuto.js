/* ---------------------------------------------------------------------------
   SPRINTER — le tutoriel se joue SUR LA PISTE
   ---------------------------------------------------------------------------
   Meme patron que celui des haies (haies-tuto.js), et pour la meme raison : ce
   qu'on enseigne doit se passer la ou le joueur le jouera. Le moteur tourne, le
   coureur court, le starter parle, et ce qui note le joueur est ce qui le
   notera en course — `reaction`, `pressTimes`, `transGrade`, les faux pas. Le
   tutoriel n'ajoute qu'un depart lance, un ralenti, et une machine qui joue la
   demonstration sur les memes touches que lui.

   TROIS GESTES, ET LE RALENTI N'EN SERT QU'UN. C'est la difference avec les
   haies, et elle n'est pas un detail :

     ALTERNER   se voit. Gauche, droite, gauche — et le pied qui se prend dans
                l'autre quand on tape deux fois du meme cote. Au ralenti, la
                faute devient lisible, et c'est tout l'objet de l'etape.

     LE DEPART  est un REFLEXE, pas un geste. La note se lit sur `reaction`,
                mesuree en secondes de course. Ralentir le monde donne au
                joueur deux fois plus de temps reel pour repondre au meme
                pistolet : sa reaction s'ameliorerait sans que lui ne change,
                et le tutoriel lui apprendrait un reflexe qu'il n'a pas.

     LA CADENCE est une FREQUENCE. `pressTimes` est en secondes de course :
                taper au meme rythme reel sous un ralenti donne des intervalles
                simules deux fois plus courts, donc une cadence deux fois plus
                rapide qu'elle n'est. La note serait fausse dans l'autre sens.

   Les deux derniers se jouent donc a la vitesse de la course, toujours. Seule
   la DEMONSTRATION peut ralentir partout : on regarde, on n'est pas note.
--------------------------------------------------------------------------- */

import { SprinterApp, padPress } from './engine';
import { poserLeTempo, rendreLeTempo } from './tempo';

/** L'epreuve du tutoriel : le 100 m, la premiere course du jeu. */
export const CLE = '100';

/** Les trois gestes, dans l'ordre ou on les apprend. */
export const GESTES = ['alterner', 'depart', 'cadence'];

/**
 * COMBIEN DE PISTE POUR APPRENDRE A ALTERNER, en metres.
 *
 * Vingt : une dizaine d'appuis a la cadence ou l'on commence, assez pour que
 * se tromper de pied arrive vraiment, et assez court pour qu'on recommence
 * sans soupirer.
 */
const PISTE_ALTERNER = 20;

/** La vitesse du depart lance de l'etape d'alternance. */
const VITESSE_LANCE = () => (SprinterApp.G.player.maxSpeed || 12) * 0.55;

/**
 * LA CADENCE DU PILOTE, en frappes par seconde de course.
 *
 * Pour l'alternance, une cadence tranquille : l'etape n'enseigne pas la
 * vitesse, elle enseigne a ne pas taper deux fois du meme cote. Une demo qui
 * martele ferait croire que c'est la que tout se joue.
 */
const CADENCE_ALTERNER = 5.5;

/**
 * LE PROFIL DU DEPART, en secondes entre deux appuis.
 *
 * ON RESSERRE A CHAQUE APPUI, puis on tient. Ce n'est pas un choix de style :
 * c'est ce que `gradeTransition` mesure, et l'ancien tutoriel enseignait le
 * contraire sans qu'on s'en apercoive.
 *
 * LE DEFAUT, MESURE SUR LA VRAIE PISTE. Le modele d'avant — trois appuis
 * larges (0,34 / 0,30 / 0,26) puis la cadence installee d'un coup — etait note
 * sur les quatorze appuis que le tutoriel jouait lui-meme, et il y passait.
 * Mais une vraie sortie de blocs en compte DIX-NEUF avant les quinze metres de
 * DRIVE_END : la premiere moitie en contient alors neuf, dont six deja a 0,115,
 * sa mediane tombe a 0,115 comme celle de la seconde, le rapport vaut 1,00 — et
 * `transGrade` sort a 0. Le tutoriel apprenait donc un geste que la course ne
 * recompense pas, et c'est en le jouant sur la piste que ca s'est vu : trois
 * essais parfaitement executes, trois notes nulles.
 *
 * La descente continue, elle, tient quel que soit le nombre d'appuis : a
 * dix-huit intervalles la mediane de la premiere moitie vaut 0,175 contre 0,115
 * — rapport 1,52, au-dela de TRANS_PERFECT (1,20) — et elle reste au-dessus de
 * TRANS_GOOD (1,09) de seize a vingt-deux intervalles. La fin tient 0,115, sous
 * le plancher TRANS_FLOOR de 0,125 sans lequel aucune montee ne compte.
 */
const PROFIL_DEPART = [0.30, 0.26, 0.23, 0.20, 0.175, 0.155, 0.14, 0.13, 0.12,
                       0.115];

/**
 * QUAND LE PILOTE REPOND AU PISTOLET, en secondes de course.
 *
 * Cent quarante millisecondes : ce qu'un bon sprinteur fait, au-dessus du
 * plancher legal de cent. La machine ne montre pas un reflexe surhumain — le
 * joueur doit pouvoir se dire qu'il en est capable.
 */
const REACTION_PILOTE = 0.14;

/**
 * QUAND UNE SEQUENCE EST PERDUE. Le coureur n'avance que si l'on tape ; un
 * joueur qui regarde sans rien faire le verrait s'arreter, et la sequence
 * attendrait une ligne qui ne vient pas. Comme pour les haies.
 */
const ARRET = 1.5;
const LIMITE = 8;

/** L'etat de la sequence en cours. Nul quand le tutoriel ne tourne pas. */
let seq = null;

/** Le tutoriel tient-il la piste en ce moment ? */
export function tutoEnPiste() { return seq !== null; }

/** Ce que l'ecran a besoin de savoir a chaque image, et rien de plus. */
export function etatDuTuto() {
  if (!seq) return null;
  return {
    geste: seq.geste,
    demo: seq.demo,
    fini: seq.fini,
    abandon: seq.abandon,
    tempo: seq.tempo,
    // Ce que la sequence vient de mesurer, avec les valeurs du moteur.
    fautes: seq.fautes,
    reaction: seq.reaction,
    fauxDepart: seq.fauxDepart,
    transition: seq.transition,
  };
}

/**
 * Poser le decor : la piste du 100 m, et le coureur seul dessus.
 *
 * LE JOUEUR COURT SEUL, comme dans le tutoriel des haies. Sept adversaires
 * apprennent au joueur qu'il est dernier avant de lui apprendre a courir.
 */
function poserLaScene() {
  const A = SprinterApp, G = A.G;
  G.race = A.RACES[CLE];
  G.raceKey = CLE;
  A.buildLevel(G.levelIdx || 0);
  G.runners = [G.player];
}

/**
 * Lancer une sequence.
 *
 * `geste` dit ce qu'on apprend, et decide du depart : l'alternance se joue
 * lancee — reapprendre le pistolet a chaque essai n'enseignerait pas a
 * alterner — les deux autres partent des blocs, parce que c'est precisement le
 * depart qu'elles enseignent.
 */
export function demarrerSequence({ geste = 'alterner', tempo = 1, demo = false } = {}) {
  const A = SprinterApp, G = A.G;
  poserLaScene();

  const j = G.player;
  seq = {
    geste, tempo, demo, fini: false, abandon: false,
    fautes: 0, reaction: null, fauxDepart: false, transition: null,
    depart0: 0, derniere: 0, cote: 'left', appuis: 0, tombait: false,
  };

  if (geste === 'alterner') {
    // Depart lance : le coureur est deja en course, il ne reste que les pieds.
    G.state = 'race';
    G.elapsed = 0;
    j.d = 20;
    j.v = VITESSE_LANCE();
    j.stride = 0;
    j.lastKey = null;
    j.reaction = 0;          // pas de pistolet ici : aucune reaction a mesurer
    seq.depart0 = j.d;
  } else {
    // Depart des blocs. `buildLevel` a deja pose le decompte et l'heure des
    // deux commandes du starter (poserLeDepart) : il suffit d'entrer dans le
    // compte pour que la voix et le pistolet tombent d'eux-memes.
    G.state = 'count';
  }

  poserLeTempo(tempo);
  return etatDuTuto();
}

/** Rejouer la meme sequence, aux memes conditions. */
export function rejouerSequence() {
  if (!seq) return null;
  return demarrerSequence({ geste: seq.geste, tempo: seq.tempo, demo: seq.demo });
}

/**
 * Figer la piste sur place, sans rien ranger.
 *
 * Comme pour les haies : l'ecran de fin s'affiche par-dessus le stade, et sans
 * cet appel plus personne ne fait avancer le tutoriel pendant que le monde,
 * lui, tourne toujours — le coureur part finir sa course seul derriere la page
 * de felicitations.
 */
export function figerLaPiste() {
  if (seq) seq.fini = true;
  poserLeTempo(0);
}

/** Ranger le tutoriel : le monde reprend sa vitesse, le jeu son accueil. */
export function rangerLeTuto() {
  seq = null;
  rendreLeTempo();
  const G = SprinterApp.G;
  if (G) G.state = 'title';
}

/**
 * LE PAS DU TUTORIEL, a appeler a chaque image.
 *
 * Il lit ce que le moteur vient d'ecrire — jamais il ne recalcule une note —
 * fait jouer le pilote quand c'est la demonstration, et fige le monde quand la
 * sequence a dit ce qu'elle avait a dire.
 */
export function pasDuTuto() {
  if (!seq) return null;
  const G = SprinterApp.G;
  if (!G || !G.player) return etatDuTuto();
  const j = G.player;

  // Le gel se repose a chaque image tant qu'il n'a pas pris : sortir ici des
  // que la sequence est finie laisserait la course courir seule derriere
  // l'ecran. Le defaut a ete vu en entier sur le tutoriel des haies.
  if (seq.fini) {
    poserLeTempo(0);
    return etatDuTuto();
  }

  // LES FAUTES SE COMPTENT AU FRONT MONTANT. `stumbleTimer` reste positif
  // pendant toute la duree du faux pas ; le lire a chaque image compterait
  // vingt fautes pour un seul pied mal pose.
  const tombe = j.stumbleTimer > 0;
  if (tombe && !seq.tombait) seq.fautes++;
  seq.tombait = tombe;

  // Ce que le moteur a mesure, recopie tel quel.
  if (j.jumped) seq.fauxDepart = true;
  if (seq.geste !== 'alterner' && j.reaction !== null) seq.reaction = j.reaction;
  if (j.transGrade !== null && j.transGrade !== undefined) seq.transition = j.transGrade;

  if (seq.demo) piloter(G, j);

  // LA FIN DE LA SEQUENCE, geste par geste : chacun s'arrete des qu'il a de
  // quoi juger, et pas une foulee plus tard. Faire courir cent metres pour
  // noter les quinze premiers, c'est faire attendre pour rien.
  let fini = false;
  if (seq.geste === 'alterner') fini = j.d - seq.depart0 >= PISTE_ALTERNER;
  else if (seq.geste === 'depart') fini = seq.fauxDepart || seq.reaction !== null;
  else fini = seq.fauxDepart || seq.transition !== null;

  if (fini) { seq.fini = true; poserLeTempo(0); return etatDuTuto(); }

  // Le coureur s'est-il arrete ? Jamais pendant le compte — personne ne court
  // encore — ni pendant la demo, ou le pilote tape toujours.
  if (!seq.demo && G.state === 'race' &&
      ((j.v < ARRET && j.reaction !== null) || G.elapsed > LIMITE)) {
    seq.fini = true;
    seq.abandon = true;
    poserLeTempo(0);
  }
  return etatDuTuto();
}

/**
 * LE PILOTE. Il joue sur `padPress`, la touche du joueur, et compte en temps
 * simule — une cadence lue sur l'horloge du navigateur taperait deux fois trop
 * vite sous un ralenti, et montrerait un geste que la course punit.
 */
function piloter(G, j) {
  if (G.state !== 'race') return;          // pendant le compte, on attend
  const t = G.elapsed;

  if (seq.geste === 'depart' || seq.geste === 'cadence') {
    if (seq.appuis === 0) {
      if (t >= REACTION_PILOTE) frapper(t);
      return;
    }
    if (seq.geste === 'depart') return;    // la reaction dite, le reste suit seul
    const attendu = PROFIL_DEPART[Math.min(seq.appuis - 1, PROFIL_DEPART.length - 1)];
    if (t - seq.derniere >= attendu) frapper(t);
    return;
  }

  if (t - seq.derniere >= 1 / CADENCE_ALTERNER) frapper(t);
}

/** Un appui du pilote, cote alterne. */
function frapper(t) {
  seq.derniere = t;
  seq.cote = seq.cote === 'left' ? 'right' : 'left';
  seq.appuis++;
  padPress(seq.cote);
}

/* ---------------------------------------------------------------------------
   QUI TIENT L'ECRAN DU TUTORIEL
   ---------------------------------------------------------------------------
   Comme pour les haies : l'ecran ne peut pas vivre dans l'accueil, qui n'est
   monte qu'a l'etat `title` alors que ce tutoriel met le jeu en `count` puis en
   `race` — il se demonterait lui-meme a la premiere sequence. Il est monte a la
   racine, et ce drapeau dit a la racine de le monter.
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

/** Fermer le tutoriel. C'est le demontage de l'ecran qui rend la piste. */
export function fermerLeTuto() {
  if (!ouvert) return;
  ouvert = false;
  prevenir();
}
