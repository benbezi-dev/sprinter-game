/* ---------------------------------------------------------------------------
   HURDLERS — le pas du hurdleur, sans moteur ni ecran
   ---------------------------------------------------------------------------
   Ce qui se passe a chaque image pour le coureur du joueur, entre le depart et
   la derniere haie : compter ses appuis, caler son pied d'appel sur la haie,
   juger l'appel et le rythme, le faire voler, le faire retomber.

   CE FICHIER N'IMPORTE NI LE MOTEUR NI LE DOM. C'est ce qui permet au harnais
   de faire courir le vrai coureur de sprinter-core.js avec LA logique du jeu,
   et non une copie. La copie a existe : elle etait juste le jour ou elle a ete
   ecrite et elle ne l'aurait plus ete au premier correctif. haies-course.js ne
   fait que poser cette logique sur SprinterApp.

   TROIS CHOSES ONT CHANGE PAR RAPPORT A LA PREMIERE VERSION, et chacune
   corrige un defaut mesure sur le vrai moteur :

   1. LE COMPTE PART DE ZERO. Le coureur arme a `stride = 0` et un appui se
      compte quand la phase FRANCHIT un multiple de PI. L'ancienne lecture
      (`appuiN = -1`) comptait la position de depart comme un appui : tout
      compte jusqu'a la premiere haie avait un appui de trop.

   2. LE PIED D'APPEL SE CALE SUR LA HAIE. La regle d'avant partait « si le
      prochain appui tomberait au-dela de la haie ». Geometriquement, elle ne
      pouvait pas donner a la fois quatre appuis et un appel a 2,15 m : avec la
      foulee qui fait quatre appuis, l'appel tombait a un metre de la haie, et
      la plupart des haies se notaient hachees. Un hurdleur, lui, REGLE sa
      foulee sur les derniers metres pour poser le pied d'appel au bon endroit.
      C'est ce que fait la fenetre ci-dessous : a une foulee et demie du point
      d'appel, on compte combien d'appuis la foulee naturelle aurait mis pour y
      arriver, on vise l'appui qui coute le moins a une demi-foulee pres (voir
      viser()), et la phase est menee droit sur cet appui. Ce qu'il a fallu
      corriger — un appui naturel tombe trop tot ou trop tard — devient la
      distance d'appel jugee : plane s'il a fallu allonger, hache s'il a fallu
      raccourcir.

   3. LA FOULEE NE TOURNE PAS EN L'AIR. Le moteur continue de la faire avancer
      pendant le vol ; la phase a la reception tombait donc au hasard, et le
      compte de l'intervalle suivant alternait quatre et cinq meme a cadence
      parfaite. En vol la phase reste celle de l'appel, et la reception pose le
      pied suivant : c'est le premier appui de l'intervalle.
--------------------------------------------------------------------------- */

import { HAIES, positionsDes } from './haies.js';
import { APPEL, volDe, franchir, rythmeDe, jugerAppel, GARDE_RYTHME_ROMPU } from './haies-jeu.js';

const PI = Math.PI;

/**
 * A combien de foulees du point d'appel on commence a regler.
 *
 * Une et demie : assez pour que l'appui vise soit toujours DEVANT le coureur
 * (on ne recule jamais la phase), assez peu pour que le reglement ne se voie
 * pas — au pire un tiers de foulee en plus ou en moins, sur les deux derniers
 * appuis.
 */
const FENETRE = 1.5;

/**
 * Le plus grand reglage accepte, en foulees : une demie.
 *
 * C'est aussi ce qui fait que le rythme SE GAGNE. A trois quarts de foulee, un
 * coureur a 8 frappes/s tenait encore ses quatre appuis en s'etirant de 1,3 m
 * sur la haie : la cadence parfaite ne demandait plus de cadence. Une demie,
 * c'est l'appui le plus proche, et le choix entre deux seulement quand la
 * foulee tombe pile entre les deux.
 */
const REGLAGE_MAX = 0.5;

/**
 * QUEL APPUI VISER, quand la foulee naturelle tombe entre deux.
 *
 * La premiere version arrondissait a l'appui le plus proche. Le harnais a
 * montre ce que cela coutait a la frontiere de deux rythmes : a 9,25 frappes/s
 * sur le 100 m haies, l'arrondi choisissait tantot quatre appuis, tantot cinq
 * avec un appel hache — le pire des deux — et le chrono y perdait 1,4 seconde
 * sur celui d'un joueur qui tapait MOINS vite. Taper plus vite faisait perdre.
 *
 * Un hurdleur ne tire pas son nombre d'appuis a pile ou face : il prend celui
 * qui lui coute le moins. On fait donc le compte pour chaque appui a portee
 * d'un reglage — ce que garderait la vitesse, rythme et appel compris — et l'on
 * garde le meilleur. A cout egal, le rythme du reglement d'abord, puis le plus
 * petit reglage.
 */
function viser(course, j, naturel, s) {
  const a = APPEL[course.cle];
  const premiere = course.i === 0;
  const plancher = Math.floor(j.stride / PI) + 1;
  let meilleur = null;
  for (let vise = Math.max(plancher, Math.floor(naturel - REGLAGE_MAX));
       vise <= Math.ceil(naturel + REGLAGE_MAX); vise++) {
    const ecart = naturel - vise;
    if (Math.abs(ecart) > REGLAGE_MAX + 1e-9) continue;
    const appuis = premiere ? vise : vise - course.reception + 1;
    const tenu = rythmeDe(course.cle, appuis, premiere ? 'premiere' : 'intervalle').tenu;
    const garde = jugerAppel(course.cle, a.avant + ecart * s).garde * (tenu ? 1 : GARDE_RYTHME_ROMPU);
    const mieux = !meilleur
      || garde > meilleur.garde + 1e-9
      || (Math.abs(garde - meilleur.garde) <= 1e-9
          && (tenu && !meilleur.tenu
              || (tenu === meilleur.tenu && Math.abs(ecart) < Math.abs(meilleur.ecart))));
    if (mieux) meilleur = { vise, ecart, garde, tenu };
  }
  // La fenetre s'ouvre a une foulee et demie du point : l'appui le plus proche
  // est donc toujours devant le coureur, et la boucle en trouve un. Ce repli ne
  // sert que si le coureur arrive d'un coup dans la fenetre (image tres longue).
  if (!meilleur) {
    const vise = Math.max(plancher, Math.round(naturel));
    meilleur = { vise, ecart: naturel - vise };
  }
  return meilleur;
}

/** L'etat d'une course de haies, neuf. */
export function nouvelleCourse(cle) {
  if (!HAIES[cle]) return null;
  return {
    cle,
    positions: positionsDes(cle),
    i: 0,              // la prochaine haie
    reception: 0,      // index de l'appui de reception (0 : on part des blocs)
    fenetre: null,     // le reglage en cours avant l'appel
    enVol: false,
    phaseVol: 0,
    parfaites: 0, rompus: 0, appuis: [], notes: [], dernier: null,
  };
}

/**
 * Preparer le coureur du joueur.
 *
 * LE PIED DE DEPART EST CHOISI, PAS TIRE AU SORT. Le moteur donne a chaque
 * coureur une phase de foulee aleatoire pour que huit athletes ne partent pas
 * du meme pied comme un corps de ballet ; sur une course de haies, cette phase
 * deciderait ou tombent les appuis, et deux courses identiques ne donneraient
 * pas le meme compte. Un hurdleur choisit sa jambe avant le depart.
 */
export function preparerCoureur(course, joueur) {
  if (!course || !joueur) return;
  joueur.stride = 0;
  joueur.lastStep = 0;
  joueur.foulee = HAIES[course.cle].foulee || 1;
}

/** Rendre au coureur sa foulee de sprinteur. */
export function libererCoureur(joueur) {
  if (joueur) joueur.foulee = 1;
}

/**
 * Un pas, apres celui du moteur. Rend le jugement de la haie quand il vient
 * d'en franchir une, `null` sinon.
 */
export function pas(course, j) {
  if (!course || !j) return null;

  // EN VOL : la phase reste celle de l'appel. A la reception, le pied suivant
  // se pose, et c'est le premier appui du nouvel intervalle.
  if (course.enVol) {
    if (j.freeze > 0) { j.stride = course.phaseVol; return null; }
    course.enVol = false;
    j.stride = course.phaseVol + PI;
    course.reception = Math.round(j.stride / PI);
    return null;
  }

  // Apres la derniere haie, le compte est libre.
  if (course.i >= course.positions.length) return null;

  const a = APPEL[course.cle];
  const point = course.positions[course.i] - a.avant;

  // L'OUVERTURE DU REGLAGE. On mesure combien d'appuis la foulee du moment
  // mettrait jusqu'au point d'appel — un nombre a virgule — et l'on vise
  // l'appui entier qui coute le moins, jamais un appui deja pose.
  if (!course.fenetre) {
    const s = j.strideLength();
    const reste = point - j.d;
    if (reste > FENETRE * s) return null;
    const naturel = j.stride / PI + Math.max(0, reste) / s;
    const { vise, ecart } = viser(course, j, naturel, s);
    course.fenetre = { vise, ecart, s, phase0: j.stride, d0: j.d };
  }

  const f = course.fenetre;
  if (j.d < point) {
    // Mener la phase droit sur l'appui vise, proportionnellement a la distance.
    const t = (j.d - f.d0) / Math.max(1e-6, point - f.d0);
    j.stride = f.phase0 + (f.vise * PI - f.phase0) * Math.min(1, Math.max(0, t));
    return null;
  }

  // L'APPEL.
  j.stride = f.vise * PI;
  const premiere = course.i === 0;
  const appuis = premiere ? f.vise : f.vise - course.reception + 1;
  // Un appui naturel tombe AVANT le point (ecart > 0) : il a fallu allonger,
  // on est parti de plus loin. APRES (ecart < 0) : il a fallu hacher.
  const avant = a.avant + f.ecart * f.s;
  const r = rythmeDe(course.cle, appuis, premiere ? 'premiere' : 'intervalle');
  const p = franchir(course.cle, j.v, avant, r.tenu);

  j.v = p.v;
  // LE VOL. Le coureur avance et freine, mais ne peut plus pousser : c'est ce
  // que `freeze` fait deja dans le moteur.
  j.freeze = volDe(course.cle, j.v);
  // ET LA REMISE A ZERO DU DERNIER PIED. press() sort a la premiere ligne quand
  // le coureur est gele, avant de noter la touche : sans cette ligne, le premier
  // appui apres la reception avait une chance sur deux de passer pour un double
  // appui et de faire trebucher un joueur qui a parfaitement alterne.
  j.lastKey = null;
  // PAS DE CHUTE SUR UNE HAIE. Il y en avait une — l'accroc du moteur, pose sur
  // une haie hachee a rythme casse — et elle rendait le jeu injouable : le
  // joueur ne choisit ni son pied d'appel ni l'endroit ou il quitte le sol, sa
  // vitesse en decide. Le coureur plongeait donc sous un doigt qui avait
  // parfaitement alterne, a peu pres une course sur deux a neuf frappes par
  // seconde (tools/haies-course-test.mjs). Comme dans Sprinter, seule une
  // repetition de touche fait tomber. La haie hachee se paie deja : franchir()
  // retire la vitesse, la haie se renverse (haies-course.js) et le bandeau dit
  // « trop pres ».

  if (p.note === 'parfait' && r.tenu) course.parfaites++;
  if (!r.tenu) course.rompus++;
  course.appuis.push(appuis);
  course.notes.push(p.note);
  const juge = {
    haie: course.i + 1, note: p.note, tenu: r.tenu, appuis,
    min: r.min, max: r.max, avant: +avant.toFixed(2),
  };
  course.dernier = juge;

  course.enVol = true;
  course.phaseVol = j.stride;
  course.fenetre = null;
  course.i++;
  return juge;
}
