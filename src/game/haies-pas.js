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
import { APPEL, COUT, VITESSE_VOL_MIN, volDe, franchir, rythmeDe, jugerAppel,
         GARDE_RYTHME_ROMPU, APPEL_MINI, APPEL_MAXI, FORME_INTERVALLE, GARDE_PERCUTE, GARDE_FRAPPE_VOL,
         GARDE_VOL_MINI, POUSSEE_APPEL, DRAG_VOL, AVANCE_CM, CISEAU_VISE, jugerCiseau,
         PLAFOND_INTERVALLE } from './haies-jeu.js';

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
 * A combien de FOULEES de la haie les touches d'attaque s'allument.
 *
 * Deux : a 9,5 m/s, la fenetre s'ouvre environ six metres avant la haie, soit
 * six dixiemes de seconde. Assez pour voir la touche s'allumer, lever le
 * pouce et viser ; trop peu pour que le joueur ait le temps d'hesiter, ce qui
 * est exactement ce qu'on veut lui faire ressentir.
 *
 * C'est aussi ce qui empeche le martelement de la touche d'attaque : LE
 * PREMIER APPUI DONNE DANS LA FENETRE EST L'APPEL. Un joueur qui mitraille
 * decolle donc six metres avant la haie, retombe devant, et la percute. Sans
 * cette regle, mitrailler garantissait un appel au bord de la fenetre.
 */
const FENETRE_APPEL = 2.0;

/**
 * CE QU'UNE HAIE PERCUTEE COUTE EN PLUS D'UN VOL, en secondes.
 *
 * Le temps d'arret d'une percussion ne se pose pas dans le vide : il se pose
 * SUR la duree du vol qu'on aurait fait. Le harnais a montre pourquoi, et
 * c'etait un vrai defaut du prototype.
 *
 * A la premiere version, percuter ne coutait que de la vitesse (GARDE_PERCUTE)
 * et deux dixiemes d'arret. Sur les courtes, cela suffisait. Sur le tour, non :
 * le vol y est une DUREE d'une seconde pendant laquelle on ne pousse plus
 * (haies-jeu.js, COUT), et dix secondes de non-poussee coutaient plus cher que
 * dix percussions dont le moteur se relevait a chaque fois. Un joueur qui ne
 * touchait jamais les touches d'attaque bouclait le 400 m haies en 41,97 s
 * quand celui qui visait juste mettait 44,23 : LE JEU PAYAIT POUR NE PAS
 * JOUER, ce qui est la pire chose qu'un prototype puisse faire.
 *
 * C'est le meme piege que celui deja documente dans COUT — « le moteur
 * reaccelere plus vite qu'une haie ne coute ». Il ressort des que franchir
 * devient facultatif.
 *
 * Une percussion coute donc le vol qu'on n'a pas fait, PLUS ce quart de
 * seconde. Elle est ainsi strictement plus chere que le pire franchissement
 * legal sur les trois courses, et ce sera encore vrai si la duree du vol
 * change un jour.
 */
const ACCROC_PERCUTE = 0.25;

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
export function nouvelleCourse(cle, { appelJoueur = false } = {}) {
  if (!HAIES[cle]) return null;
  return {
    cle,
    // QUI QUITTE LE SOL. A false, viser() cale le pied d'appel sur la haie et
    // le joueur n'a que sa cadence : c'est le jeu tel qu'il tourne aujourd'hui.
    // A true, c'est le joueur, avec tout ce que cela ouvre — la mauvaise
    // jambe, la haie percutee, les frappes en vol. Le drapeau vient de
    // canal.ts (APPEL_JOUEUR) et descend par haies-course.js : ce fichier ne
    // doit rien savoir du canal, sans quoi le harnais ne pourrait plus le
    // charger seul.
    appelJoueur,
    positions: positionsDes(cle),
    i: 0,              // la prochaine haie
    reception: 0,      // index de l'appui de reception (0 : on part des blocs)
    fenetre: null,     // le reglage en cours avant l'appel
    approche: null,    // la haie a portee de touche, et de quelle jambe
    enVol: false,
    phaseVol: 0,
    vitesseVol: 0,     // la vitesse tenue en l'air, sur un vol en distance
    vitesseSol: 0,     // celle qu'il retrouvera a la reception
    reception_d: null, // ou il se recoit, en metres ; null sur un vol en duree
    penaliteVol: 1,    // ce que les frappes donnees en l'air ont deja coute
    // LE CISEAU. `dAppel` et `volDuree` figent le vol au moment ou il commence,
    // pour qu'on sache a tout instant ou l'on en est ; `ciseauPart` recoit la
    // part du vol ecoulee au relache, et reste null tant qu'on n'a pas relache.
    dAppel: 0, volDuree: 0, volCiseau: 0, coteAppel: null, ciseauPart: null,
    ciseaux: [], dernierCiseau: null,
    // LE PLAFOND DE L'INTERVALLE. `plafondBas` est celui que la reception
    // permet ; il remonte au plafond de l'epreuve d'ici au point d'appel
    // suivant. Voir haies-jeu.js, PLAFOND_INTERVALLE.
    plafondBas: 0, dReception: 0,
    // LA JAMBE D'ATTAQUE DU COUREUR. Nulle avant la premiere haie ; la premiere
    // l'arrete pour toute la course. Voir GARDE_MAUVAISE_JAMBE.
    jambe: null,
    parfaites: 0, rompus: 0, percutees: 0, mauvaisesJambes: 0, frappesEnVol: 0,
    appuis: [], notes: [], dernier: null,
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
    // ON NE FREINE PAS EN L'AIR COMME ON FREINE AU SOL, et c'est la correction
    // la plus lourde de tout ce fichier.
    //
    // Le moteur freine un coureur qui ne pousse pas, en l'air comme au sol :
    // C.DRAG = 0,8, soit exp(-0,8 x 0,36) = 0,75 sur un vol de 110 m haies. Le
    // coureur se recevait donc a trois quarts de sa vitesse. Jackson, lui, perd
    // 0,34 m/s sur 9,11 — 3,7 % (Coh 2003). Le jeu payait SEPT FOIS le prix
    // reel d'une haie, et aucun hurdleur ne se serait reconnu la-dedans : toute
    // sa doctrine dit qu'on ne perd pas de vitesse sur une haie.
    //
    // La perte se calcule donc une fois, a l'appel, sur la duree du vol et avec
    // le freinage de l'air (haies-jeu.js, DRAG_VOL). Pendant le vol, le coureur
    // tient la vitesse de son appel — c'est la distance, ou la duree, qui le
    // pose — et il retrouve `vitesseSol` en touchant la piste.
    if (course.reception_d !== null) {
      j.v = course.vitesseVol;
      const reste = course.reception_d - j.d;
      if (reste > 0) {
        j.freeze = reste / course.vitesseVol;
        j.stride = course.phaseVol;
        return null;
      }
      j.freeze = 0;
    } else if (j.freeze > 0) {
      // Sur le tour, le vol est une duree : le moteur la decompte, et l'on tient
      // la vitesse pendant ce temps-la comme sur les courtes.
      j.v = course.vitesseVol;
      j.stride = course.phaseVol;
      return null;
    }
    j.v = course.vitesseSol;
    // LA RECEPTION PAIE LE CISEAU, et c'est le coeur du jeu.
    //
    // Le freinage de l'air est de la physique, il est deja dans `vitesseSol`.
    // Ce qui se paie ici est de la TECHNIQUE : un ciseau net remet le coureur
    // en course, un ciseau en retard le fait retomber derriere son appui. Voir
    // haies-jeu.js, GARDE_CISEAU.
    //
    // Sous l'appel automatique il n'y a pas de ciseau a juger — la machine ne
    // relache rien — et le franchissement ne coute alors que l'air.
    if (course.appelJoueur) {
      const jc = jugerCiseau(course.ciseauPart, course.volCiseau);
      j.v *= jc.garde;
      // LE PLAFOND DU PROCHAIN INTERVALLE SE DECIDE ICI. C'est la reception qui
      // dit a quelle vitesse on peut repartir — pas l'epreuve.
      course.plafondBas = HAIES[course.cle].maxSpeed * (PLAFOND_INTERVALLE[jc.note] ?? 1);
      const ms = course.ciseauPart === null ? null
        : Math.round(course.ciseauPart * course.volCiseau * 1000);
      course.ciseaux.push({ note: jc.note, ms });
      // SON PROPRE CANAL, et pas un champ de plus sur le verdict de l'appel :
      // le bandeau a lu et vide `dernier` depuis longtemps quand on se recoit —
      // le vol dure vingt-deux images. Les deux temps du geste se disent donc
      // l'un apres l'autre, ce qui est aussi la facon dont on les joue.
      course.dernierCiseau = { haie: course.i, note: jc.note, ms };
    }
    // Et ce que les frappes donnees en l'air ont coute.
    j.v *= course.penaliteVol;
    course.penaliteVol = 1;
    course.ciseauPart = null;
    course.enVol = false;
    j.stride = course.phaseVol + PI;
    course.reception = Math.round(j.stride / PI);
    course.dReception = j.d;
    return null;
  }

  // LE PLAFOND QUE LA RECEPTION A LAISSE, et sa remontee.
  //
  // On plafonne la VITESSE, jamais `maxSpeed` : le moteur s'en sert aussi pour
  // l'amplitude de la foulee (`strideLength`, qui lit v / maxSpeed), et le
  // baisser ALLONGERAIT la foulee au lieu de la raccourcir — l'inverse de ce
  // qu'un coureur ralenti fait. Ici la vitesse tombe, le rapport tombe avec, et
  // la foulee se raccourcit d'elle-meme : le compte d'appuis de l'intervalle
  // s'en trouve deplace, ce qui EST la spirale qu'on cherche a produire.
  if (course.appelJoueur && course.plafondBas > 0 && course.reception > 0) {
    const plein = HAIES[course.cle].maxSpeed;
    const point = course.positions[Math.min(course.i, course.positions.length - 1)]
                  - APPEL[course.cle].avant + AVANCE_CM;
    const total = Math.max(0.5, point - course.dReception);
    const t = Math.min(1, Math.max(0, (j.d - course.dReception) / total));
    const plafond = course.plafondBas + (plein - course.plafondBas) * t;
    if (j.v > plafond) j.v = plafond;
  }

  // LA FORME DE L'INTERVALLE. Les trois foulees entre deux haies ne sont pas
  // egales — courte, longue, un peu plus courte — et c'est ce qui distingue un
  // intervalle de haies de trois foulees de sprint. Voir FORME_INTERVALLE.
  //
  // On la pose ici, a chaque pas, parce que la foulee du moteur se lit a chaque
  // pas : `strideLength()` multiplie son amplitude par `Runner.foulee`, et il
  // suffit de faire varier ce facteur d'un appui a l'autre.
  if (course.reception > 0) {
    const n = Math.floor(j.stride / PI) - course.reception;
    const f = n >= 0 && n < FORME_INTERVALLE.length ? FORME_INTERVALLE[n] : 1;
    j.foulee = (HAIES[course.cle].foulee || 1) * f;
  }

  // Apres la derniere haie, le compte est libre.
  if (course.i >= course.positions.length) return null;

  const a = APPEL[course.cle];
  // LE POINT D'APPEL EST CELUI DU CORPS : le pied quitte le sol a `avant`
  // metres de la haie, mais le corps est deja AVANCE_CM devant lui.
  const point = course.positions[course.i] - a.avant + AVANCE_CM;

  // L'APPEL DU JOUEUR. Tout ce qui suit — la fenetre de reglage, viser(), la
  // phase menee droit sur l'appui, l'appel qui part tout seul — n'existe que
  // parce que la machine choisit. Quand c'est le joueur, on ne regle rien : on
  // allume les touches, et on regarde s'il est trop tard.
  if (course.appelJoueur) return veille(course, j, point);

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
  // LE VOL. Le coureur avance mais ne peut plus pousser : c'est ce que
  // `freeze` fait deja dans le moteur. Sur les courtes, il tient sa vitesse
  // jusqu'a la reception (voir plus haut) ; sur le tour, le vol est une duree
  // et le freinage fait partie de ce qu'elle coute (haies-jeu.js, COUT).
  j.freeze = volDe(course.cle, j.v);
  j.v = Math.max(VITESSE_VOL_MIN, j.v);
  course.vitesseVol = j.v;
  // LA PERTE DU VOL, calculee une seule fois : sa duree, et le freinage de
  // l'air. Un vol plus long — appel donne de trop loin — coute donc davantage,
  // sans qu'aucune penalite n'ait eu besoin d'etre inventee. Voir DRAG_VOL.
  course.vitesseSol = j.v * Math.exp(-DRAG_VOL * j.freeze);
  course.reception_d = COUT[course.cle].vol === 'distance'
    ? course.positions[course.i] + a.apres
    : null;
  course.dAppel = j.d; course.volDuree = j.freeze;
  course.volCiseau = volDe(course.cle === '400h' ? '110h' : course.cle, j.v);
  course.coteAppel = null; course.ciseauPart = null;
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


/* ---------------------------------------------------------------------------
   L'APPEL DECLENCHE PAR LE JOUEUR
   ---------------------------------------------------------------------------
   Trois fonctions, et une seule est appelee par le moteur : veille(), depuis
   pas(). Les deux autres viennent du pouce, par haies-course.js.

   CE QUI DISPARAIT : viser(), la fenetre de reglage, la phase menee droit sur
   l'appui. La foulee court naturellement, et le coureur quitte le sol exactement
   la ou le joueur a appuye. Ce qui etait le coeur du fichier devient la moitie
   automatique, gardee telle quelle : le drapeau se retire.

   CE QUI APPARAIT : la jambe d'attaque, la haie percutee, les frappes en vol.
--------------------------------------------------------------------------- */

/**
 * L'APPROCHE. Ouvrir la fenetre des touches, puis guetter le trop-tard.
 *
 * LA JAMBE EST ANNONCEE, PUIS FIGEE, et c'est ce qui rend la regle jouable.
 * Le pied d'appel se deduit de la parite du compte d'appuis ; or ce compte
 * change si le joueur appuie une demi-foulee plus tot. Calcule a l'appui, le
 * bon cote aurait donc bascule sous le pouce entre le moment ou la touche
 * s'allume et celui ou on l'atteint : le joueur n'aurait pas joue, il aurait
 * devine. On le calcule une fois, a l'ouverture de la fenetre, on l'affiche,
 * et c'est celui-la qui compte — le jeu passe un contrat, il le tient.
 *
 * Le compte d'appuis, lui, reste honnete : il se lit sur la foulee reelle au
 * moment de l'appel. Les deux jugements sont distincts, et doivent le rester —
 * obeir a la touche annoncee ne doit jamais excuser un rythme casse.
 */
function veille(course, j, point) {
  const haie = course.positions[course.i];

  if (!course.approche) {
    const s = j.strideLength();
    const reste = point - j.d;
    if (reste > FENETRE_APPEL * s) return null;
    const naturel = j.stride / PI + Math.max(0, reste) / s;
    const vise = Math.max(Math.floor(j.stride / PI) + 1, Math.round(naturel));
    // `cote` n'est plus une consigne mais un RAPPEL : la jambe d'attaque que le
    // coureur s'est choisie a la premiere haie. Nul avant elle — on ne rappelle
    // rien tant que rien n'est choisi, et les deux paves s'allument.
    course.approche = { haie: course.i + 1, cote: course.jambe, vise, d0: j.d, point, avance: 0 };
  }

  // L'AVANCE : ou en est le coureur sur son approche, de 0 a 1, ou 1 est le
  // point d'appel du reglement. Au-dela de 1, il est en retard.
  //
  // CE CHIFFRE EST LE CORRECTIF LE PLUS UTILE DU PROTOTYPE, et il vient d'une
  // video d'essai. La touche disait QUEL POUCE et jamais QUAND : le joueur la
  // voyait s'allumer, puis jugeait l'instant sur une haie qui arrive en vue
  // isometrique. Il REAGISSAIT au lieu d'anticiper, et le temps de reaction
  // plus le voyage du pouce le mettaient en retard de 150 ms a chaque haie —
  // toujours du meme cote. Mesure : 17,22 s sur le 110 m haies, sept « trop
  // pres » et trois percussions, quand le meme joueur a l'heure fait 13,12 s.
  // Aucune tolerance elargie ne rattrape un retard systematique ; il fallait un
  // signal qui se voie VENIR. L'ecran en fait une jauge qui se remplit, pleine
  // exactement au point d'appel (TouchControls).
  const a = course.approche;
  const course_totale = Math.max(1e-6, a.point - a.d0);
  a.avance = Math.min(1.5, Math.max(0, (j.d - a.d0) / course_totale));

  // ET CE QUE VAUDRAIT UN APPEL DONNE MAINTENANT. La regle vit ici, pas dans
  // l'ecran : la jauge et le jugement doivent etre le meme calcul, sans quoi
  // le joueur apprendrait a viser une lumiere qui ment. jugerAppel() est la
  // fonction qui notera son appel une image plus tard.
  a.zone = jugerAppel(course.cle, haie - j.d + AVANCE_CM, j.v).note;

  // TROP TARD : le coureur est sur la haie et n'a pas appele. Il la percute.
  if (j.d >= haie - APPEL_MINI) return percuter(course, j);
  return null;
}

/**
 * LE POUCE APPUIE. Rend le jugement de la haie, ou `null` si l'appui ne
 * tombait pas sur une haie a portee — auquel cas il ne coute rien : hors
 * fenetre, la touche d'attaque n'est pas une faute, elle n'est rien.
 */
export function appeler(course, j, cote) {
  if (!course || !j || !course.appelJoueur) return null;
  if (course.enVol || !course.approche) return null;
  if (course.i >= course.positions.length) return null;

  const cle = course.cle;
  const a = APPEL[cle];
  const haie = course.positions[course.i];
  // Ce que le joueur est juge sur : la distance du PIED a la haie. Le corps
  // est AVANCE_CM plus loin — voir haies-jeu.js.
  const avant = haie - j.d + AVANCE_CM;
  if (avant <= 0) return null;
  // TROP LOIN POUR ETRE UN APPEL : c'est une foulee, pas un decollage. On rend
  // `null`, et padPress() laisse alors le moteur la traiter comme une frappe
  // ordinaire. Voir APPEL_MAXI — c'est ce qui rend a la cadence son role.
  if (avant > APPEL[cle].avant + APPEL_MAXI) return null;

  // LE PIED D'APPEL SE CALE SUR L'APPUI LE PLUS PROCHE, et non sur celui qui
  // vient de se poser. On ne quitte pas le sol au milieu d'une foulee : arrondir
  // met la posture d'accord avec le saut, au prix d'un quart de foulee de
  // fiction. Le jugement, lui, porte sur la distance REELLE au moment de
  // l'appui — c'est cela que le joueur a dans les doigts, et c'est cela qui
  // doit se noter.
  const nAppel = Math.max(course.reception, Math.round(j.stride / PI));
  const premiere = course.i === 0;
  const appuis = premiere ? nAppel : nAppel - course.reception + 1;
  // LA PREMIERE HAIE CHOISIT LA JAMBE, les suivantes la gardent. Un hurdleur ne
  // change pas de jambe d'attaque en cours de course ; celui qui le fait le
  // paie, et c'est tout ce que le jeu a besoin de dire.
  const bonneJambe = course.jambe === null || cote === course.jambe;
  if (course.jambe === null) course.jambe = cote;
  const r = rythmeDe(cle, appuis, premiere ? 'premiere' : 'intervalle');
  const p = franchir(cle, j.v, avant, r.tenu, { jambe: bonneJambe, v: j.v });

  j.v = p.v;
  // L'APPEL EST UNE POUSSEE, et elle se compte en PART de la vitesse : Jackson
  // gagne 3,3 % entre l'amortissement et la poussee, pas trois dixiemes de m/s
  // en toutes circonstances. Voir POUSSEE_APPEL.
  if (bonneJambe) j.v = Math.min(j.maxSpeed, j.v * (1 + (POUSSEE_APPEL[p.note] || 0)));
  j.stride = nAppel * PI;

  if (COUT[cle].vol === 'distance') {
    j.v = Math.max(VITESSE_VOL_MIN, j.v);
    // Sur le chemin du centre de masse, pas d un pied a l autre — voir AVANCE_CM.
    j.freeze = Math.max(0.05, avant + a.apres - AVANCE_CM) / j.v;
    course.vitesseVol = j.v;
    course.vitesseSol = j.v * Math.exp(-DRAG_VOL * j.freeze);
    course.reception_d = haie + a.apres;
  } else {
    // SUR LE TOUR, LE VOL EST UNE DUREE, ET ELLE NE SE REMBOURSE PAS.
    //
    // Cette seconde n'est pas le saut : c'est de courir POUR la haie sur
    // trente-cinq metres, et haies-jeu.js le dit en toutes lettres. Elle ne
    // depend donc pas de l'endroit d'ou l'on s'appelle.
    //
    // Deux versions se sont cassees dessus avant celle-ci. Une duree fixe
    // rendait l'appel au plus tot gratuit — mitrailler la touche etait la
    // meilleure facon de jouer le 400 m haies. La rapporter a la distance
    // d'appel a retourne le defaut sans le corriger : l'appel le plus tardif
    // raccourcissait le vol d'un tiers de seconde, et le harnais l'a mesure —
    // 42,02 s en appelant au ras de la haie contre 44,23 en visant juste.
    //
    // Ce qui suit ne va que dans un sens : partir de plus loin AJOUTE le temps
    // d'air en trop, partir plus pres ne retire rien. Le hache se paie en
    // vitesse (GARDE), comme sur les courtes, et jamais en temps gagne.
    j.freeze = COUT[cle].duree + Math.max(0, avant - a.avant) / Math.max(VITESSE_VOL_MIN, j.v);
    j.v = Math.max(VITESSE_VOL_MIN, j.v);
    course.vitesseVol = j.v;
    course.vitesseSol = j.v * Math.exp(-DRAG_VOL * j.freeze);
    course.reception_d = null;
  }

  // Le vol est fige ici : on saura a tout instant ou l'on en est, donc quand
  // tombe le relache. Voir `ciseauDe`.
  course.dAppel = j.d; course.volDuree = j.freeze;
  course.volCiseau = volDe(cle === '400h' ? '110h' : cle, j.v);
  course.coteAppel = cote; course.ciseauPart = null;

  // Meme raison que sur l'appel automatique : press() ne note pas la touche
  // pendant le gel, donc le premier appui apres la reception passerait une fois
  // sur deux pour un double appui.
  j.lastKey = null;

  if (p.note === 'parfait' && r.tenu && bonneJambe) course.parfaites++;
  if (!r.tenu) course.rompus++;
  if (!bonneJambe) course.mauvaisesJambes++;
  course.appuis.push(appuis);
  course.notes.push(p.note);
  const juge = {
    haie: course.i + 1, note: p.note, tenu: r.tenu, appuis,
    min: r.min, max: r.max, avant: +avant.toFixed(2), jambe: bonneJambe,
  };
  course.dernier = juge;

  course.enVol = true;
  course.phaseVol = j.stride;
  course.penaliteVol = 1;
  course.approche = null;
  course.fenetre = null;
  course.i++;
  return juge;
}

/**
 * LA HAIE PERCUTEE. Le coureur arrive dessus sans avoir appele.
 *
 * C'est la seule faute de Hurdlers qui vienne entierement du joueur, et c'est
 * elle qui rend le reste honnete : sans elle, ne rien faire reviendrait a
 * franchir, et les touches d'attaque seraient une decoration.
 *
 * Il ne tombe pas (haies-jeu.js, GARDE_PERCUTE dit pourquoi) : il perd quatre
 * dixiemes de sa vitesse, reste un instant sans pouvoir pousser, et la haie
 * s'en va — haies-course.js la couche, comme une haie hachee.
 */
function percuter(course, j) {
  const cle = course.cle;
  const nAppel = Math.max(course.reception, Math.round(j.stride / PI));
  const premiere = course.i === 0;
  const appuis = premiere ? nAppel : nAppel - course.reception + 1;
  const r = rythmeDe(cle, appuis, premiere ? 'premiere' : 'intervalle');

  j.v = Math.max(VITESSE_VOL_MIN,
                 j.v * GARDE_PERCUTE * (r.tenu ? 1 : GARDE_RYTHME_ROMPU));
  // Le vol qu'on n'a pas fait, plus l'arret. Voir ACCROC_PERCUTE.
  j.freeze = volDe(cle, j.v) + ACCROC_PERCUTE;
  j.lastKey = null;

  // On ne vole pas : la foulee continue, et l'intervalle suivant se compte
  // depuis ici. Sans cette ligne, il repartirait du dernier appui d'avant la
  // haie precedente et compterait une douzaine d'appuis.
  course.reception = nAppel;

  course.percutees++;
  if (!r.tenu) course.rompus++;
  course.appuis.push(appuis);
  course.notes.push('percute');
  const juge = {
    haie: course.i + 1, note: 'percute', tenu: r.tenu, appuis,
    min: r.min, max: r.max,
    avant: +(course.positions[course.i] - j.d + AVANCE_CM).toFixed(2),
    jambe: null,
  };
  course.dernier = juge;
  course.approche = null;
  course.i++;
  return juge;
}

/**
 * UNE FRAPPE DONNEE PENDANT LE VOL. Rend `true` si elle a compte.
 *
 * Elle ne passe pas par Runner.press(), qui sort a la premiere ligne quand le
 * coureur est gele : c'est precisement pourquoi marteler en l'air ne coutait
 * rien. L'interception se fait donc en amont, dans padPress().
 */
export function frappeEnVol(course) {
  if (!course || !course.appelJoueur || !course.enVol) return false;
  course.penaliteVol = Math.max(GARDE_VOL_MINI, course.penaliteVol * GARDE_FRAPPE_VOL);
  course.frappesEnVol++;
  return true;
}

/** La haie a portee de touche, et de quelle jambe l'attaquer. `null` sinon. */
export function approche(course) {
  if (!course || !course.appelJoueur || course.enVol) return null;
  return course.approche;
}

/** Le coureur est-il en l'air ? */
export function enVol(course) {
  return !!(course && course.enVol);
}


/**
 * OU EN EST LE VOL, de 0 (on quitte le sol) a 1 (on touche la piste).
 *
 * Sur les courtes le vol est une distance et la vitesse y est tenue : la part
 * parcourue EST la part du temps ecoule. Sur le tour c'est une duree, et le
 * moteur la decompte dans `freeze`. Deux lectures, un seul nombre.
 */
function partDuVol(course, j) {
  if (!course.enVol) return null;
  if (course.reception_d !== null) {
    const total = course.reception_d - course.dAppel;
    return total <= 0 ? 1 : Math.min(1, Math.max(0, (j.d - course.dAppel) / total));
  }
  // SUR LE TOUR, LE GEL N'EST PAS LE TEMPS EN L'AIR. La seconde de COUT
  // represente le fait de courir POUR la haie sur trente-cinq metres ; le vrai
  // vol y dure environ un tiers de seconde comme partout ailleurs. Le ciseau se
  // rapporte donc au vol reel (`volCiseau`), sans quoi il faudrait le placer a
  // une demi-seconde du decollage, c'est-a-dire longtemps apres avoir atterri.
  if (!course.volCiseau) return 1;
  const ecoule = course.volDuree - Math.max(0, j.freeze);
  return Math.min(1, Math.max(0, ecoule / course.volCiseau));
}

/**
 * LE POUCE SE LEVE — le ciseau.
 *
 * Appuyer lance la jambe d'attaque, relacher ramene la jambe arriere : un seul
 * geste continu, comme un hurdleur qui ne fait pas deux choses mais une. Le
 * relache ne compte que du cote ou l'on s'est appele ; lever l'autre pouce ne
 * ciseaute rien.
 *
 * Un seul ciseau par haie : le premier relache est le bon. Sans cela, un joueur
 * qui pianote pendant le vol finirait par en placer un dans la fenetre sans
 * l'avoir vise.
 */
export function relacher(course, j, cote) {
  if (!course || !j || !course.appelJoueur) return null;
  if (!course.enVol || course.ciseauPart !== null) return null;
  if (course.coteAppel && cote !== course.coteAppel) return null;
  course.ciseauPart = partDuVol(course, j);
  return jugerCiseau(course.ciseauPart, course.volCiseau);
}

/**
 * Le vol en cours, pour la jauge : ou l'on en est, ou tombe le ciseau, et ce
 * que vaudrait un relache maintenant. `null` hors vol.
 */
export function ciseauDe(course, j) {
  if (!course || !course.appelJoueur || !course.enVol) return null;
  const part = partDuVol(course, j);
  return {
    part, vise: CISEAU_VISE, fait: course.ciseauPart !== null,
    zone: jugerCiseau(part, course.volCiseau).note,
    cote: course.coteAppel,
  };
}


/**
 * Ou en est le plafond de l'intervalle, de 0 a 1 — 1 etant celui de l'epreuve.
 *
 * Pour l'ecran : une mauvaise reception doit SE VOIR, sans quoi le coureur
 * parait lent sans raison et le joueur ne relie pas l'effet a sa cause.
 */
export function plafondDe(course, j) {
  if (!course || !j || !course.appelJoueur || !course.plafondBas) return 1;
  if (course.enVol || course.reception <= 0) return 1;
  const plein = HAIES[course.cle].maxSpeed;
  const point = course.positions[Math.min(course.i, course.positions.length - 1)]
                - APPEL[course.cle].avant + AVANCE_CM;
  const total = Math.max(0.5, point - course.dReception);
  const t = Math.min(1, Math.max(0, (j.d - course.dReception) / total));
  return Math.min(1, (course.plafondBas + (plein - course.plafondBas) * t) / plein);
}
