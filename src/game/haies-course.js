/* ---------------------------------------------------------------------------
   HURDLERS — les haies posees sur la course du moteur
   ---------------------------------------------------------------------------
   Ce fichier est la charniere : d'un cote le moteur de Sprinter, qui sait
   faire courir un athlete ; de l'autre les regles de haies-jeu.js, qui savent
   ce que coute une haie. Il n'y a rien d'autre ici, et c'est voulu — la
   moindre regle qui s'installerait a cet etage serait une regle qu'on ne peut
   plus tester sans lancer une course.

   LES APPUIS SE LISENT SUR `stride`, ET SURTOUT PAS SUR tookStep().

   Le moteur avance `stride` de PI par appui pour animer la foulee, et il
   expose tookStep() qui repond a la meme question. Mais tookStep() est a etat
   ET A CONSOMMATEUR UNIQUE : il retient le dernier appui vu et ne repond vrai
   qu'une fois. engine.ts s'en sert deja pour le bruit de pas. L'appeler ici
   aussi ferait que chacun des deux n'en verrait qu'un sur deux — les pas
   sonneraient une fois sur deux et les haies seraient jugees sur un appui
   fantome, sans la moindre erreur pour le dire.

   On lit donc le compteur brut, qui ne s'use pas a etre lu.
--------------------------------------------------------------------------- */

import { SprinterApp } from './engine';
import { HAIES, positionsDes } from './haies.js';
import { APPEL } from './haies-jeu.js';
import { REGLE, volDe, franchir, rythmeDe } from './haies-jeu.js';

/** L'etat d'une course de haies. Nul en dehors d'une course de haies. */
let course = null;

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
  const { parfaites, rompus, appuis } = course;
  return {
    cle: course.cle, parfaites, rompus,
    appuis: appuis.slice(),
    rythme: [...new Set(appuis)].join('/'),
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
  SprinterApp.G.pasHaies = pasHaies;

  // LE PIED DE DEPART EST CHOISI, PAS TIRE AU SORT.
  //
  // Le moteur donne a chaque coureur une phase de foulee aleatoire —
  // `stride = Math.random() * TAU` — pour que huit athletes ne partent pas du
  // meme pied comme un corps de ballet. Sur une course a plat, cela ne change
  // rien : personne ne compte les appuis.
  //
  // Sur une course de haies, cela change tout. La phase decide de l'endroit ou
  // tombent les appuis, donc du pied d'appel a la premiere haie, donc de toute
  // la chaine de parite. Deux courses identiques ne donnaient pas le meme
  // resultat, et le harnais l'a montre avant nous : trois passages de suite,
  // deux echecs, puis un, puis zero.
  //
  // Un hurdleur choisit sa jambe d'attaque avant le depart. On la lui rend.
  const j = SprinterApp.G.player;
  if (j) { j.stride = 0; j.lastStep = 0; }
  course = {
    cle,
    positions: positionsDes(cle),
    i: 0,                 // la prochaine haie
    appuiD: 0,            // ou est tombe le dernier appui
    appuiN: -1,           // son numero, pour connaitre le pied
    depuisHaie: 0,        // appuis depuis la haie precedente
    precedent: undefined, // le rythme de l'intervalle d'avant
    piedPrec: null,       // le pied du dernier appel
    parfaites: 0, rompus: 0, appuis: [], dernier: null,
  };
}

/** Ranger les haies. A appeler en quittant la course, sans quoi elles suivent. */
export function rangerHaies() {
  course = null;
  if (SprinterApp.G) SprinterApp.G.pasHaies = null;
}

/**
 * Un pas de simulation, apres celui du moteur.
 *
 * Deux choses seulement : noter ou tombent les appuis, et juger la haie quand
 * le coureur la depasse. Le jugement porte sur le DERNIER APPUI AVANT LA HAIE,
 * parce que c'est de la que l'on decolle — juger a l'instant du passage
 * reviendrait a juger une position en l'air, ou plus rien ne se decide.
 */
export function pasHaies(joueur) {
  if (!course || !joueur) return;
  if (course.i >= course.positions.length) return;

  // Un appui vient-il d'etre pose ? Le moteur avance `stride` de PI par appui.
  //
  // ON NE COMPTE PAS LES APPUIS EN L'AIR. Le moteur continue de faire tourner
  // la foulee pendant le vol — il anime un coureur, pas une trajectoire — et
  // les compter revenait a poser le pied par-dessus la haie. A 10 m/s, quatre
  // dixiemes de vol font 4 m des 9,14 m de l'intervalle : presque la moitie du
  // rythme etait faite de pas qui n'existent pas. Le test l'a dit avant qu'on
  // le voie — trois intervalles sur dix seulement tombaient sur le rythme
  // vise. Le rythme se compte au sol.
  const n = Math.floor(joueur.stride / Math.PI);
  if (n === course.appuiN || joueur.freeze > 0) return;
  course.appuiN = n;
  course.appuiD = joueur.d;
  course.depuisHaie++;

  // CET APPUI EST-IL L'APPEL ? C'est la question que se pose un hurdleur a
  // chaque foulee, et la seule facon honnete de la trancher : si le prochain
  // appui tomberait au-dela de la haie, alors c'est d'ici qu'il faut partir.
  //
  // La version d'avant declenchait a une distance fixe devant l'obstacle et
  // prenait le dernier appui d'avant ce point. Avec une foulee de 2,5 m, ce
  // dernier appui pouvait etre a 3,9 m de la haie : le joueur etait juge sur
  // un appel qu'aucun hurdleur n'aurait choisi, et la zone parfaite ne
  // pouvait presque jamais tomber.
  const haie = course.positions[course.i];
  if (joueur.d + joueur.strideLength() < haie) return;

  const avant = Math.max(0, haie - joueur.d);
  const appuis = course.depuisHaie;
  const pied = n % 2;

  // Le rythme : le pied d'appel sur les courtes, la constance sur le tour.
  const r = rythmeDe(course.cle, appuis, course.precedent);
  const tenu = REGLE[course.cle] === 'parite'
    ? (course.piedPrec === null || pied === course.piedPrec)
    : r.tenu;

  const p = franchir(course.cle, joueur.v, avant, tenu);
  joueur.v = p.v;

  // LE VOL. Le coureur avance et freine, mais ne peut plus pousser : c'est ce
  // que `freeze` fait deja dans le moteur, et c'est ce qui distingue un 110 m
  // haies d'un 110 m plat. Sans lui, dix haies coutaient quatre dixiemes de
  // seconde et l'automate bouclait le 110 m haies en 10,37 s. Sa duree se
  // calcule sur la vitesse du moment pour les courtes et reste fixe sur le
  // tour — voir COUT, ou les deux cas sont expliques.
  joueur.freeze = volDe(course.cle, joueur.v);

  // ET LA REMISE A ZERO DU DERNIER PIED, qui n'est pas un detail.
  //
  // press() sort a la premiere ligne quand le coureur est gele — AVANT de
  // noter la touche utilisee. Les appuis tapes pendant le vol sont donc perdus
  // sans que `lastKey` bouge, et le premier appui apres la reception a une
  // chance sur deux de tomber sur la meme touche qu'avant : le moteur y voit
  // un double appui et fait trebucher, au hasard, un joueur qui a parfaitement
  // alterne. Sans cette ligne, le chrono du 110 m sautait de 12,49 a 20,29 a
  // 21,10 pour trois durees de vol croissantes ; avec, il monte proprement.
  joueur.lastKey = null;

  // Une haie vraiment manquee se voit : le moteur a deja tout ce qu'il faut
  // pour la montrer, on emprunte son accroc plutot que d'inventer une
  // animation qui ne ressemblerait a rien d'autre dans le jeu.
  if (p.note === 'hache' && !tenu) {
    joueur.stumbleTimer = 0.28;
    joueur.fallAnim = 1;
  }

  if (p.note === 'parfait' && tenu) course.parfaites++;
  if (!tenu) course.rompus++;
  course.appuis.push(appuis);
  course.dernier = { haie: course.i + 1, note: p.note, tenu, appuis, avant: +avant.toFixed(2) };

  course.precedent = appuis;
  course.piedPrec = pied;
  course.depuisHaie = 0;
  course.i++;
}
