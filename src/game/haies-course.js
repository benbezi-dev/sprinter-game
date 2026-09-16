/* ---------------------------------------------------------------------------
   HURDLERS — les haies posees sur la course du moteur
   ---------------------------------------------------------------------------
   Ce fichier est la charniere : d'un cote le moteur de Sprinter, qui sait
   faire courir un athlete ; de l'autre le pas du hurdleur (haies-pas.js), qui
   sait compter ses appuis, caler son appel et le faire voler. Il n'y a rien
   d'autre ici, et c'est voulu — la moindre regle qui s'installerait a cet
   etage serait une regle qu'on ne peut plus tester sans lancer une course.

   LES APPUIS SE LISENT SUR `stride`, ET SURTOUT PAS SUR tookStep().

   Le moteur avance `stride` de PI par appui pour animer la foulee, et il
   expose tookStep() qui repond a la meme question. Mais tookStep() est a etat
   ET A CONSOMMATEUR UNIQUE : il retient le dernier appui vu et ne repond vrai
   qu'une fois. engine.ts s'en sert deja pour le bruit de pas. L'appeler ici
   aussi ferait que chacun des deux n'en verrait qu'un sur deux — les pas
   sonneraient une fois sur deux et les haies seraient jugees sur un appui
   fantome, sans la moindre erreur pour le dire. haies-pas.js lit donc le
   compteur brut, qui ne s'use pas a etre lu.
--------------------------------------------------------------------------- */

import { SprinterApp } from './engine';
import { HAIES } from './haies.js';
import { nouvelleCourse, preparerCoureur, libererCoureur, pas } from './haies-pas.js';
import { obstaclesDe } from './haies-rendu.js';

/** L'etat d'une course de haies. Nul en dehors d'une course de haies. */
let course = null;

/**
 * Les haies que le joueur a renversees : numero de la haie -> instant du
 * choc, sur le chrono de la course. Le rendu les fait tomber a partir de la.
 */
const touchees = new Map();

/** Y a-t-il des haies sur la piste en ce moment ? */
export function haiesEnCours() { return course !== null; }

/** Ce que le rendu a besoin de savoir : ou sont les haies, et lesquelles restent. */
export function haiesPosees() {
  return course ? { cle: course.cle, positions: course.positions, passees: course.i } : null;
}

/** Le dernier franchissement juge, pour l'affichage. Se vide apres lecture. */
export function dernierFranchissement() {
  if (!course || !course.dernier) return null;
  const d = course.dernier;
  course.dernier = null;
  return d;
}

/** Le bilan de la course : ce que le joueur a tenu, et ce qu'il a paye. */
export function bilanHaies() {
  if (!course) return null;
  const { parfaites, rompus, appuis, notes } = course;
  return {
    cle: course.cle, parfaites, rompus,
    appuis: appuis.slice(),
    notes: notes.slice(),
    rythme: [...new Set(appuis.slice(1))].join('/'),
  };
}

/**
 * Poser les haies avant le depart.
 *
 * Appele une fois la course construite : le moteur a deja place la piste et
 * les coureurs, on ne fait qu'ajouter ce qu'ils vont devoir franchir.
 */
export function armerHaies(cle) {
  if (!HAIES[cle]) { rangerHaies(); return; }

  // LE CROCHET, PLUTOT QU'UN IMPORT. Le moteur ne connait pas les haies et ne
  // doit pas les connaitre : un import de ce fichier depuis engine.ts ferait
  // repartir tout le reglement dans le paquet public, ou rien ne l'affiche.
  // C'est deja arrive une fois, sur la mise en forme des cotes. La dependance
  // va donc dans l'autre sens — l'ecran des haies charge ce module, ce module
  // se pose sur le moteur, et le moteur ne fait qu'appeler ce qui s'y trouve.
  const G = SprinterApp.G;
  G.pasHaies = pasHaies;

  course = nouvelleCourse(cle);
  touchees.clear();
  preparerCoureur(course, G.player);
  // Le rendu, par le meme chemin : il trouve les haies sur `G.obstacles` et
  // ne sait rien d'autre.
  if (G.obstacles) oublierSur(G);
  G.obstacles = obstaclesDe(course, touchees);
}

/** Retirer des coureurs la posture que le rendu des haies y a posee. */
function oublierSur(G) {
  const o = G.obstacles;
  for (const r of G.runners || []) o.oublier(r);
  if (G.ghost && G.ghost.runner) o.oublier(G.ghost.runner);
}

/**
 * Ranger les haies. A appeler en quittant la course, sans quoi elles suivent —
 * et le coureur garderait sa foulee de hurdleur sur le prochain 100 m plat.
 */
export function rangerHaies() {
  course = null;
  touchees.clear();
  const G = SprinterApp.G;
  if (G) {
    G.pasHaies = null;
    if (G.obstacles) oublierSur(G);
    G.obstacles = null;
    libererCoureur(G.player);
  }
}

/** Un pas de simulation, apres celui du moteur. */
export function pasHaies(joueur) {
  const juge = pas(course, joueur);
  // Une haie attaquee trop pres se prend dans le genou : elle tombe. Le
  // jugement la note hachee, rythme tenu ou non — le coureur la touche dans
  // les deux cas, il ne tombe lui-meme que si son rythme etait deja rompu.
  if (juge && juge.note === 'hache') {
    touchees.set(juge.haie - 1, SprinterApp.G.elapsed || 0);
  }
}
