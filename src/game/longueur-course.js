/* ---------------------------------------------------------------------------
   JUMPER — les sauts horizontaux poses sur le moteur de Sprinter
   ---------------------------------------------------------------------------
   Ce fichier est la charniere, comme haies-course.js l'est pour les haies :
   d'un cote le moteur, qui sait faire courir un athlete dans un stade ; de
   l'autre le jeu du saut (longueur-jeu.js, triple-jeu.js), qui sait ce que
   vaut un appel, un angle, une pose et un ramene. Il n'y a rien d'autre ici
   que ce qui les relie.

   LE MOTEUR NE CONNAIT PAS LE SAUT. Il offre des portes, et ce fichier les
   ouvre a l'armement et les referme en partant :

     G.pasSauteur     le pas de simulation du joueur, a la place de stepPlayer
     G.appuiSaut      un appui sur un pave : foulee, appel, pose, ciseau, ramene
     G.relacheSaut    le pouce qui quitte le sol : l'angle est fixe
     G.viseCamera     ou regarder : la piste d'elan, puis la fosse
     G.obstacles      le calque au sol et ce qui se tient debout
     G.zoneReservee   la pelouse ou le decor ne se pose pas
     G.sautEnCours    pas de ligne d'arrivee : le concours tranche

   L'ATHLETE COURT DANS LA PELOUSE. La piste d'elan longe la ligne droite,
   a quatre metres de la corde, comme dans tous les stades : on garde donc la
   piste du 100 m, et l'on pose le coureur a cote d'elle — `demi` est l'ecart
   lateral que le moteur sait deja lire, celui du relais.

   DEUX EPREUVES, UNE PISTE, UNE FOSSE. Le saut en longueur et le triple saut
   se sautent sur la meme piste d'elan, vers le meme sable : seule change la
   planche, a deux metres du sable pour l'une, de sept a treize pour l'autre.
   On voit les deux planches, comme dans tous les stades. Le triple saut ajoute
   deux poses entre l'appel et le saut, et chacune est un appel de plus : le
   pied se pose, on tient pour l'angle, on relache.
--------------------------------------------------------------------------- */

import { SprinterApp, SprinterCore, resetInputRhythm } from './engine';
import './sauts-mots.js'; // les mots des sauts, hors de la table commune
import { poserLeTempo, rendreLeTempo } from './tempo';
import { ELAN, FOSSE, TEMPS_ESSAI } from './longueur.js';
import {
  AVANCE_PIED, APPEL_MAXI, angleDe, TENUE_MAXI, ANGLE_MIN, ANGLE_PAR_S, RALENTI,
  vol as volDe, hauteurA, sauter, DISTANCE_ENVOL, RAMENE_VISE, RAMENE_TOLERANCE,
  CISEAU_TOLERANCE, CISEAU_APPUIS,
} from './longueur-jeu.js';
import { plancheDe, BONDS } from './triple.js';
import {
  bond as bondDe, hauteurBond, jugerPose, POSE, sauterTriple, ANGLES_VISES, BONDS_JEU, vitesseTriple,
} from './triple-jeu.js';
import {
  postureDe, dessinerSol, piecesDebout, dessinerPiece, prechargerSable,
} from './longueur-rendu.js';
import { creerVue, PROFIL } from './sauts-vue.js';

/** La ligne d'appel du saut en longueur, en metres le long de la ligne droite. */
export const LIGNE = 50;
/** Le debut du sable, que les deux epreuves partagent. */
export const FOSSE_X = LIGNE + FOSSE.debut;
/** L'axe de la piste d'elan : dans la pelouse, a 4,40 m de la corde. */
export const PISTE_Y = -4.4;

/**
 * LE SAUTOIR DE PROFIL (sauts-vue.js). Les coordonnees ci-dessus sont celles du
 * sautoir : la piste le long de x, la fosse au bout. Dans le monde, il est
 * tourne sur la diagonale que l'isometrie met a l'horizontale de l'ecran, la
 * ligne d'appel posee dans la pelouse, a quatorze metres de la corde : on
 * court de gauche a droite, les tribunes derriere.
 */
const PIVOT_MONDE = [55, -14];

/**
 * LE SAUTOIR LE LONG DE LA LIGNE DROITE, comme a la television et dans les
 * jeux de saut : la piste d'elan longe la piste, entre elle et la grande
 * tribune, et la camera de Sprinter la voit en trois-quarts, en diagonale a
 * l'ecran, avec les panneaux et le public juste derriere. La tribune recule
 * de ECART_TRIBUNE pour lui laisser la place (sprinter-app.js, drawWorld).
 */
const LE_LONG = true;
const ECART_TRIBUNE = 7;
/** L'axe de la piste d'elan, en metres au-dela du dernier couloir. */
const AU_DELA = 3.4;
let vue = null;

/**
 * LA VITESSE D'ELAN LA PLUS HAUTE, en m/s.
 *
 * Un sauteur ne court pas a la vitesse d'un sprinteur : il arrive sur la
 * planche a la sienne, CONTROLEE, onze metres par seconde chez les
 * meilleurs, parce qu'il doit encore poser un pied au centimetre et se
 * lever. Le plafond est donc celui-la, un peu au-dessus ; la transition
 * parfaite le releve comme au 100 m (TRANS_VMAX), et c'est ce qu'il faut pour
 * sauter avec les ZEZE. Voir tools/longueur-test.mjs et triple-test.mjs.
 */
export const VITESSE_ELAN_MAX = 11.6;

/**
 * L'epreuve telle que le moteur la lit : une ligne droite de cent metres —
 * celle du stade —, et le plafond d'elan. Les `ranges` ne servent qu'a
 * buildLevel, qui tire un plateau de coureurs que l'on renvoie aussitot aux
 * vestiaires : au saut, on s'elance seul sur la piste.
 */
const EPREUVE = {
  key: 'longueur', label: 'SAUT EN LONGUEUR', sub: 'la planche et le sable',
  arc: 0, straight: 100, maxSpeed: VITESSE_ELAN_MAX, best: 9.1,
  ranges: [[20, 21], [20, 21], [20, 21], [20, 21], [20, 21], [20, 21]],
};

/**
 * Le ralenti du vol : un peu moins que celui de l'appel. Le ramene se juge a
 * trois centiemes pres en temps de jeu ; au ralenti de trois quarts, cela
 * fait quatre centiemes sous le doigt, et le saut se regarde.
 */
const VOL_RALENTI = 0.75;

/** Ce que chaque ramene laisse dans le sable (voir sable.py). */
const VARIANTE = { parfait: 'avant', bon: 'avant', tot: 'cote', assis: 'assis', tard: 'pieds', sans: 'pieds' };
/** Ou sont les talons par rapport a la trace mesuree, selon l'empreinte. */
const TALONS = { avant: 0, cote: 0, pieds: 0, assis: 0.45 };
/** De combien le bassin glisse en avant une fois les talons plantes. */
const GLISSE = { avant: 0.42, cote: 0.25, pieds: 0.36, assis: -0.04 };

const lisse = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

/* -------------------------------------------------------------- l'etat */

let e = null;          // l'etat du saut ; nul hors d'un concours
let sauvegarde = null; // ce que l'armement a pris au moteur
const ecouteurs = new Set();

function annoncer(evt) {
  for (const f of ecouteurs) { try { f(evt); } catch (err) { /* un ecran ne fait pas tomber le saut */ } }
}

/** Ecouter ce qui se passe sur la piste : appel, pose, envol, contact, marque, fin. */
export function ecouterSaut(f) {
  ecouteurs.add(f);
  return () => { ecouteurs.delete(f); };
}

/** L'etat du saut en cours, pour l'ecran. Nul hors d'un concours. */
export function etatSaut() { return e; }

/**
 * Le joueur vient de battre son record personnel (l'ecran le sait, lui qui
 * tient la memoire) : l'athlete leve les bras en sortant du sable, et la
 * camera vient le chercher de pres.
 */
export function celebrer() { if (e) e.celebre = true; }

/** Le triple saut est-il l'epreuve en cours ? */
const triple = () => !!e && e.epreuve === 'triple';

/** L'angle que vise l'impulsion en cours : celui du bond qu'elle lance. */
function angleVise() {
  if (!triple()) return 21.5;
  return ANGLES_VISES[Math.min(2, e.bond)];
}

/* ------------------------------------------------------------ l'armement */

/**
 * Monter le stade du concours, et ouvrir les portes du moteur.
 *
 * `etape` choisit le stade — les six etapes de Sprinter — et donc le public,
 * la piste et le sable ; au triple saut, elle choisit aussi la planche.
 * `epreuve` : 'longueur' ou 'triple'.
 */
export function armerConcoursSaut(etape, epreuve = 'longueur') {
  const A = SprinterApp, G = A.G;
  if (e) nettoyer();
  sauvegarde = { race: G.race, raceKey: G.raceKey, surRetour: G.surRetourAccueil };
  G.race = EPREUVE;
  A.buildLevel(etape);
  const lignetriple = FOSSE_X - plancheDe(etape);
  const ligne = epreuve === 'triple' ? lignetriple : LIGNE;
  e = {
    epreuve, etape, ligne, fosseX: FOSSE_X, pisteY: PISTE_Y, depart: ligne - ELAN,
    // les deux planches, chacune a sa place : on ne se sert que d'une
    planches: [{ x: LIGNE, actif: epreuve !== 'triple' }, { x: lignetriple, actif: epreuve === 'triple' }],
    phase: 'repos', t: 0, horlogeT: 0, horloge: TEMPS_ESSAI,
    jambeAppel: 0, vHist: [], appel: null, vol: null, pose: null, reception: null,
    bond: 0, angles: [], poses: [], pieds: [], planche: null,
    angleEnvol: null, angleVise: [19, 24], resultat: null,
    empreinte: null, gerbe: null, mesure: null, drapeau: null, traceMordue: null,
    lignes: [], vent: 0, posture: null, juge: null, pieces: [],
    theme: A.theme(),
  };
  prechargerSable(e.theme);

  const C = SprinterCore.C;
  vue = LE_LONG
    ? creerVue({ rot: 0, pivotLocal: [LIGNE, PISTE_Y], pivotMonde: [LIGNE, C.LANE_W * C.LANE_COUNT + AU_DELA], laneW: C.LANE_W })
    : creerVue({ rot: PROFIL, pivotLocal: [LIGNE, PISTE_Y], pivotMonde: PIVOT_MONDE, laneW: C.LANE_W });
  G.ecartTribune = LE_LONG ? ECART_TRIBUNE : 0;
  // Tout ce que le moteur demande au saut passe par le repere du sautoir : le
  // coureur y revient le temps de la reponse, et retourne au monde apres.
  const local = (fn) => vue.avec(G.player, fn);
  G.sautEnCours = true;
  G.pasSauteur = (j, dt, el) => local(() => pas(j, dt, el));
  G.appuiSaut = (cote) => local(() => appui(cote));
  G.relacheSaut = (cote) => local(() => relache(cote));
  G.viseCamera = () => { const p = local(viseCamera); return vue.monde(p[0], p[1]); };
  G.jaugeSaut = () => local(jauge);
  G.consigneSaut = () => local(consigne);
  G.pavesSaut = pavesDuSaut;
  // Le decor ne se pose pas sur la piste d'elan ni dans la fosse.
  const debut = Math.min(LIGNE, lignetriple) - ELAN - 8;
  const fond = FOSSE_X + (FOSSE.fond - FOSSE.debut) + 3;
  G.zoneReservee = vue.zone([[debut, PISTE_Y - 4.6], [fond, PISTE_Y - 4.6], [debut, PISTE_Y + 3], [fond, PISTE_Y + 3]]);
  G.obstacles = {
    saut: true,
    preparer(r, G2, C) {
      if (!e || r !== G2.player) { r.posture = null; return; }
      r.posture = local(() => postureDe(e, r, C.MODEL_H / r.look.h));
    },
    oublier(r) { r.posture = null; },
    sol(ctx, api) { if (e) local(() => dessinerSol(ctx, vue.api(api), e, e.theme)); },
    pieces(api) { return e ? local(() => piecesDebout(e, vue.api(api), e.pieces)) : []; },
    dessiner(ctx, api, pc) { if (e) local(() => dessinerPiece(ctx, vue.api(api), e, pc, e.theme, SprinterApp)); },
  };
  // Tous les chemins de sortie passent par l'accueil — le bouton de l'ecran,
  // la pause, le retour du telephone. C'est la qu'on range, et la seulement.
  G.surRetourAccueil = () => {
    const avant = sauvegarde && sauvegarde.surRetour;
    nettoyer();
    if (avant) avant();
  };
  nouveauSauteur();
  G.state = 'race';
  G.elapsed = 0; G.acc = 0;
  G.depart = null;            // pas de starter : on part quand on veut
  G.recTrace = null;          // rien a rejouer en fantome
  e.phase = 'repos';
  placerCamera(true);
}

/** Un athlete neuf sur sa marque : la vitesse, la transition, tout repart. */
function nouveauSauteur() {
  const A = SprinterApp, G = A.G, C = SprinterCore.C;
  // Le triple-sauteur court moins vite : ses deux premiers bonds doivent
  // retomber sur la piste, avant le sable (triple-jeu.js, VITESSE_TRIPLE).
  const plafond = triple() ? vitesseTriple(e.etape) : VITESSE_ELAN_MAX;
  const j = new SprinterCore.Runner('TOI', 0, {
    isPlayer: true, maxSpeed: plafond, best: EPREUVE.best, total: G.track.total,
  });
  j.lane = 0;
  j.demi = PISTE_Y - C.LANE_W * 0.5;
  j.d = e.depart;
  j.legStart = e.depart;
  j.stride = 0;
  // Debout sur sa marque, pas dans des blocs : le buste est droit.
  j.drivePitch = 0;
  // Aucun coup de pistolet : pas de temps de reaction a noter, ni a payer.
  j.reaction = 0; j.reactBonus = 0;
  // Un sauteur neuf a chaque essai : le guetteur des gestes de Sprinter
  // (poussee-gestes.ts) le reconnait a ce drapeau, et le juge de nouveau —
  // l'image remanente se merite a chaque elan, par une transition parfaite.
  j.sauteur = true;
  G.player = j;
  G.runners = [j];
  G.reactShown = true;
  G.transShown = false;
  resetInputRhythm();
  // Un coureur neuf, pose au monde : l'ancien n'a plus rien a garder.
  if (vue) { vue.oublier(); vue.poser(j); }
}

/** Tout ce qu'un essai laisse derriere lui, remis a zero. */
function essaiNeuf() {
  return {
    t: 0, vHist: [], appel: null, vol: null, pose: null, reception: null,
    bond: 0, angles: [], poses: [], pieds: [], planche: null,
    angleEnvol: null, resultat: null, empreinte: null, gerbe: null,
    mesure: null, drapeau: null, traceMordue: null, finAnnoncee: false,
    anglesOk: [], notesPoses: [], parfait: false,
  };
}

/**
 * Appeler le joueur sur la piste : c'est a lui. La minute part, le vent de
 * cet essai est tire, les lignes de la television sont tracees.
 */
export function appelerSauteur({ vent = 0, lignes = [] } = {}) {
  if (!e) return;
  const G = SprinterApp.G;
  nouveauSauteur();
  rendreLeTempo();
  Object.assign(e, essaiNeuf(), { phase: 'attente', horloge: TEMPS_ESSAI, vent, lignes });
  G.state = 'race';
  placerCamera(true);
}

/** Le joueur attend son tour : sur sa marque, sans chrono, sans paves. */
export function mettreAuRepos() {
  if (!e) return;
  nouveauSauteur();
  rendreLeTempo();
  Object.assign(e, essaiNeuf(), { phase: 'repos' });
  placerCamera(true);
}

/** Tout rendre au moteur. Sans effet si rien n'est arme. */
function nettoyer() {
  const G = SprinterApp.G;
  rendreLeTempo();
  if (!sauvegarde && !e) return;
  G.sautEnCours = false;
  G.pasSauteur = null;
  G.appuiSaut = null;
  G.relacheSaut = null;
  G.viseCamera = null;
  G.jaugeSaut = null;
  G.consigneSaut = null;
  G.pavesSaut = null;
  G.zoneReservee = null;
  G.ecartTribune = 0;
  if (G.obstacles && G.obstacles.saut) G.obstacles = null;
  G.zoomMode = 1;
  if (G.player) {
    const j = G.player;
    j.posture = null; j.celebrate = 0; j.fallAnim = 0; j.tete = 0; j.cap = 0; j.demi = 0; j.roulis = 0;
  }
  if (vue) vue.oublier();
  vue = null;
  if (sauvegarde) {
    G.race = sauvegarde.race;
    G.raceKey = sauvegarde.raceKey;
    G.surRetourAccueil = sauvegarde.surRetour;
  }
  sauvegarde = null;
  e = null;
  annoncer({ type: 'range' });
}

/** Quitter le concours : on range, et l'on rend l'accueil. */
export function rangerConcoursSaut() {
  if (!e && !sauvegarde) return;
  // goHome passe par G.surRetourAccueil, qui range.
  SprinterApp.goHome();
  nettoyer();
}

/* ---------------------------------------------------------- les gestes */

/**
 * Un appui sur un pave. Rend ce qu'il a ete — 'appel', 'pose', 'ciseau',
 * 'ramene' —, ou 'rien' s'il n'a rien fait, ou null pour une foulee
 * ordinaire, que le moteur traite alors comme au 100 m.
 */
function appui(cote) {
  if (!e) return null;
  const G = SprinterApp.G, j = G.player;
  switch (e.phase) {
    case 'attente':
      // Le premier appui lance l'elan. C'est une foulee : le moteur la prend.
      e.phase = 'elan'; e.t = 0;
      annoncer({ type: 'elan' });
      return null;
    case 'elan': {
      const orteil = j.d + AVANCE_PIED;
      const ecart = e.ligne - orteil;
      if (ecart > APPEL_MAXI) return null;
      // L'APPEL. Le pied se pose ICI, a l'instant de l'appui : c'est lui
      // que le juge regarde, et c'est lui que la mesure retranche.
      const vElan = vitesseDElan();
      e.planche = { orteil, ecart, vElan, cote };
      e.appel = {
        cote, orteil, d0: j.d, t0: performance.now(), u: 0, charge: 0,
        angle: ANGLE_MIN, vEntree: vElan,
      };
      e.jambeAppel = cote === 'left' ? 0 : 1;
      e.bond = 0;
      e.phase = 'appel'; e.t = 0;
      if (ecart < 0) e.traceMordue = orteil;
      poserLeTempo(RALENTI);
      annoncer({ type: 'appel', ecart, vElan });
      return 'appel';
    }
    case 'appel':
      // L'autre pouce pendant l'impulsion ne fait rien : on tient, on relache.
      return 'rien';
    case 'vol': {
      const v = e.vol;
      // LES DEUX PREMIERS BONDS DU TRIPLE SAUT : un appui dans les derniers
      // centiemes du vol est la pose. Plus tot, le pied n'est pas la — rien.
      if (v.pose) {
        if (v.tPose == null && v.duree - v.t <= POSE.bonAvance) {
          v.tPose = v.t;
          v.tPoseReel = performance.now();
          v.cotePose = cote;
          return 'pose';
        }
        return 'rien';
      }
      const autre = cote === 'left' ? 'right' : 'left';
      // LES DEUX POUCES ENSEMBLE : les deux jambes devant. On le reconnait a
      // ce que l'autre pave est encore tenu quand celui-ci s'abaisse.
      if (v.tRamene == null && G.touches && G.touches[autre]) {
        v.tRamene = v.t;
        annoncer({ type: 'ramene', avance: v.duree - v.t });
        return 'ramene';
      }
      // Sinon, un pas en l'air : le ciseau.
      if (v.tRamene == null && cote !== v.dernierCote) {
        v.ciseaux++;
        v.phaseVise += Math.PI;
        v.dernierCote = cote;
        return 'ciseau';
      }
      return 'rien';
    }
    case 'pose':
      // Le pied est deja au sol, et l'appui arrive en retard : il compte, et
      // son retard se paie (triple-jeu.js, jugerPose).
      poser(cote, e.pose.t, performance.now());
      return 'pose';
    default:
      return 'rien';
  }
}

/**
 * Le pouce se leve. Au sol, c'est le decollage.
 *
 * Au triple saut, il peut se lever AVANT que le pied touche : un joueur qui
 * tape sa pose un rien en avance a deja fini son geste quand le pied arrive.
 * On retient alors l'instant, et l'impulsion partira au contact avec l'angle
 * qu'il a tenu — sans quoi il resterait plante sur la piste jusqu'a
 * quarante degres, pour un geste parfaitement donne.
 */
function relache(cote) {
  if (!e) return false;
  if (e.phase === 'vol' && e.vol.pose && e.vol.tPose != null && cote === e.vol.cotePose
      && e.vol.relachePose == null) {
    e.vol.relachePose = performance.now();
    return true;
  }
  if (e.phase !== 'appel' || cote !== e.appel.cote) return false;
  decoller();
  return true;
}

/** La vitesse d'elan : la moyenne des trois derniers dixiemes avant l'appel. */
function vitesseDElan() {
  const h = e.vHist;
  if (!h.length) return SprinterApp.G.player.v;
  const fin = h[h.length - 1][0];
  let s = 0, n = 0;
  for (const [t, v] of h) if (t >= fin - 0.3) { s += v; n++; }
  return n ? s / n : h[h.length - 1][1];
}

/** Le pied quitte le sol a l'angle tenu (`h` secondes, horloge du joueur). */
function decoller(h = tenu()) {
  const G = SprinterApp.G, j = G.player;
  const a = e.appel;
  a.angle = angleDe(h);
  e.angleEnvol = a.angle;
  e.angles[e.bond] = a.angle;
  // l'angle etait-il dans la zone parfaite de la jauge (jauge(), plus bas) ?
  const o = angleVise();
  e.anglesOk[e.bond] = a.angle >= o - 2 && a.angle <= o + 2.5;
  if (triple() && e.bond < 2) {
    // UN DES DEUX PREMIERS BONDS : il finit sur un pied, pas dans le sable.
    const B = bondDe(e.bond, a.vEntree, a.angle);
    const p = BONDS_JEU[e.bond];
    const pose = a.orteil + p.envol + B.vol;          // le centre de masse a la pose
    e.vol = {
      bond: e.bond, pose: true, t: 0, duree: B.duree, x0: j.d, vx: (pose - j.d) / B.duree, B,
      hauteur: (t) => hauteurBond(B, t),
      orteilSuivant: pose + p.pose,
      // Le cloche-pied et la foulee se posent sur la piste. Un bond qui
      // retomberait dans le sable ne se reprend pas : l'essai est nul.
      sable: pose + p.pose >= e.fosseX - 0.05,
      // le pied qui doit toucher : le meme au cloche-pied, l'autre a la foulee
      coteAttendu: BONDS[e.bond].pied === 'meme' ? a.cote : (a.cote === 'left' ? 'right' : 'left'),
      tPose: null, cotePose: null, relachePose: null, ciseaux: 0, phase: 0, phaseVise: 0, dernierCote: a.cote, tRamene: null,
    };
  } else {
    const V = volDe(a.vEntree, a.angle);
    const contact = a.orteil + DISTANCE_ENVOL + V.longueur;
    e.vol = {
      bond: e.bond, pose: false, t: 0, duree: V.duree, x0: j.d, vx: (contact - j.d) / V.duree, V,
      hauteur: (t) => hauteurA(V, t),
      ciseaux: 0, phase: 0, phaseVise: 0, dernierCote: a.cote, tRamene: null,
    };
  }
  e.phase = 'vol'; e.t = 0;
  poserLeTempo(VOL_RALENTI);
  annoncer({ type: 'envol', angle: a.angle, vElan: a.vEntree, bond: e.bond });
}

/**
 * Une pose du triple saut : le pied touche, la pose est jugee, et un nouvel
 * appel commence — on tient pour l'angle du bond suivant.
 *
 * `retard` est en secondes de jeu apres le contact, `t0` l'instant de
 * l'appui sur l'horloge du joueur : le maintien se compte depuis lui.
 */
function poser(cote, retard, t0) {
  const j = SprinterApp.G.player;
  const v = e.vol;
  const p = jugerPose(retard);
  const bon = cote === v.coteAttendu;
  e.poses[v.bond] = retard;
  e.notesPoses[v.bond] = p.note;
  e.pieds[v.bond] = bon;
  const vEntree = v.B.vApres * (p.garde || 0.9);
  e.appel = {
    cote, orteil: v.orteilSuivant, d0: j.d, t0, u: 0, charge: 0,
    angle: ANGLE_MIN, vEntree,
  };
  e.jambeAppel = cote === 'left' ? 0 : 1;
  e.bond = v.bond + 1;
  e.pose = null;
  e.phase = 'appel'; e.t = 0;
  poserLeTempo(RALENTI);
  annoncer({ type: 'pose', note: p.note, bonPied: bon, bond: v.bond });
  // Le pouce etait deja leve au contact : on decolle tout de suite.
  if (v.relachePose != null) decoller(Math.max(0, (v.relachePose - t0) / 1000));
}

/** Depuis combien de temps le pouce tient, sur l'horloge du joueur. */
function tenu() {
  return e && e.appel ? (performance.now() - e.appel.t0) / 1000 : 0;
}

/* ------------------------------------------------------------- le pas */

/** Le pas de simulation du joueur, a la place de stepPlayer. */
function pas(j, dt, elapsed) {
  if (!e) { j.stepPlayer(dt, elapsed); return; }
  e.t += dt;
  e.horlogeT += dt;
  if (e.empreinte) e.empreinte.age += dt;
  if (e.gerbe) { e.gerbe.t += dt; if (e.gerbe.t > 0.7) e.gerbe = null; }
  if (e.drapeau) e.drapeau.age += dt;
  if (j.fallAnim > 0) j.fallAnim = Math.max(0, j.fallAnim - dt / SprinterCore.C.FALL_TIME);
  zoomer(dt);

  switch (e.phase) {
    case 'repos':
      j.v = 0; j.drivePitch = 0;
      return;
    case 'attente':
      j.v = 0; j.drivePitch = 0;
      e.horloge -= dt;
      if (e.horloge <= 0) {
        // Une minute sans s'elancer : l'essai est perdu.
        nul('temps');
        e.phase = 'temps'; e.t = 0;
        e.drapeau = { blanc: false, age: 0 };
        annoncer({ type: 'marque', resultat: e.resultat });
      }
      return;
    case 'elan': {
      j.stepPlayer(dt, elapsed);
      // Un sauteur ne sort pas de blocs : il part debout, le buste a peine
      // penche. L'inclinaison du moteur est celle d'un sprinteur.
      j.drivePitch *= 0.4;
      e.vHist.push([elapsed, j.v]);
      if (e.vHist.length > 200) e.vHist.splice(0, e.vHist.length - 200);
      // COURU A TRAVERS LA PLANCHE : le pied a franchi la ligne sans appel.
      // C'est un essai, et il est nul.
      if (j.d + AVANCE_PIED > e.ligne + 0.25) {
        e.phase = 'traverse'; e.t = 0;
        e.traceMordue = e.ligne + 0.06;
        nul('traverse');
      }
      return;
    }
    case 'appel': {
      const a = e.appel;
      const h = tenu();
      a.angle = angleDe(h);
      // Le bassin passe au-dessus du pied le temps d'atteindre le bon angle ;
      // tenu plus longtemps, il s'ecrase.
      const bon = (angleVise() - ANGLE_MIN) / ANGLE_PAR_S;
      a.u = Math.min(1, h / bon);
      a.charge = Math.max(0, Math.min(1, (h - bon) / 0.4));
      const vise = a.orteil + (triple() && e.bond < 2 ? BONDS_JEU[e.bond].envol : DISTANCE_ENVOL);
      j.d = a.d0 + (vise - a.d0) * lisse(a.u);
      j.v = a.vEntree * (1 - 0.5 * a.u);
      if (h >= TENUE_MAXI) decoller();
      return;
    }
    case 'vol': {
      const v = e.vol;
      v.t = Math.min(v.duree, v.t + dt);
      j.d = v.x0 + v.vx * v.t;
      j.v = v.vx;
      // LE CYCLE DU CISEAU SUIT LES APPUIS PAR UN RESSORT : il accelere puis
      // ralentit, comme une jambe. Rattrape en un saut exponentiel, chaque
      // demi-tour partait d'un coup et freinait net — un battement d'aile.
      // Un ressort souple : la jambe met le temps d'une vraie foulee a passer,
      // on voit le ciseau se faire au lieu d'un battement.
      const w = 11, ecart = v.phase - v.phaseVise;
      v.phaseV = (v.phaseV || 0) + (-w * w * ecart - 2 * w * (v.phaseV || 0)) * dt;
      v.phase += v.phaseV * dt;
      if (v.t >= v.duree) {
        if (v.pose && v.sable) dansLeSable();
        else if (!v.pose) contact();
        else if (v.tPose != null) poser(v.cotePose, v.tPose - v.duree, v.tPoseReel);
        else {
          // Le pied touche et personne n'a appuye : on attend l'appui, un
          // temps. Le corps passe au-dessus du pied, lentement.
          e.pose = { t: 0, orteil: v.orteilSuivant, x0: j.d };
          e.jambeAppel = v.coteAttendu === 'left' ? 0 : 1;
          e.phase = 'pose'; e.t = 0;
          poserLeTempo(RALENTI);
        }
      }
      return;
    }
    case 'pose': {
      const p = e.pose, v = e.vol;
      p.t += dt;
      j.d = p.x0 + v.vx * 0.35 * p.t;
      j.v = v.vx * 0.5;
      if (p.t > POSE.casse) casser();
      return;
    }
    case 'casse': {
      // Le bond casse : il trebuche, court encore trois pas, s'arrete.
      j.v *= Math.exp(-2.6 * dt);
      if (j.v < 0.25) j.v = 0;
      j.d += j.v * dt;
      j.stride += j.v * dt * (Math.PI / j.strideLength());
      if (e.t >= 0.9 && !e.drapeau) {
        e.drapeau = { blanc: false, age: 0 };
        annoncer({ type: 'marque', resultat: e.resultat });
      }
      if (e.t >= 2.6 && !e.finAnnoncee) { e.finAnnoncee = true; annoncer({ type: 'fin', resultat: e.resultat }); }
      return;
    }
    case 'reception': {
      const c = e.reception;
      c.t += dt;
      // Record personnel : les bras montent quand il se releve.
      if (e.celebre) j.celebrate = lisse((c.t - 1.5) / 0.45);
      if (c.t > 0.3) rendreLeTempo();
      if (c.t < 1.75) {
        j.d = c.x + GLISSE[c.variante] * lisse(c.t / 0.35);
        j.v = 0;
      } else {
        // Il sort de la fosse en marchant, droit devant — revenir en arriere
        // dans le sable serait, au reglement, un essai nul.
        j.v = 1.25;
        j.d += j.v * dt;
        j.stride += j.v * dt * (Math.PI / j.strideLength());
      }
      if (!c.mordu && c.t >= 1.05 && !e.mesure) mesurer();
      if (c.mordu && c.t >= 0.55 && !e.drapeau) {
        e.drapeau = { blanc: false, age: 0 };
        annoncer({ type: 'marque', resultat: e.resultat });
      }
      if (e.mesure) e.mesure.a = 1 - lisse((c.t - 2.6) / 0.4);
      if (c.t >= 3.2 && !c.fini) { c.fini = true; annoncer({ type: 'fin', resultat: e.resultat }); }
      return;
    }
    case 'traverse': {
      // Il freine, entre dans le sable, s'arrete.
      const dansLeSable = j.d > e.fosseX;
      j.v *= Math.exp(-(dansLeSable ? 3.2 : 1.6) * dt);
      if (j.v < 0.25) j.v = 0;
      j.d += j.v * dt;
      j.stride += j.v * dt * (Math.PI / j.strideLength());
      if (dansLeSable && !e.empreinte) {
        e.empreinte = { x: e.fosseX + 0.05, y: PISTE_Y, variante: 'course', age: 0 };
      }
      if (e.t >= 0.9 && !e.drapeau) {
        e.drapeau = { blanc: false, age: 0 };
        annoncer({ type: 'marque', resultat: e.resultat });
      }
      if (e.t >= 2.8 && !e.finAnnoncee) { e.finAnnoncee = true; annoncer({ type: 'fin', resultat: e.resultat }); }
      return;
    }
    case 'temps':
      j.v = 0;
      if (e.t >= 1.8 && !e.finAnnoncee) { e.finAnnoncee = true; annoncer({ type: 'fin', resultat: e.resultat }); }
      return;
    default:
      j.v = 0;
  }
}

/** Un essai nul sans marque, pour la raison donnee. */
function nul(raison) {
  e.resultat = {
    mordu: true, raison, metres: 0, marque: null, vent: e.vent,
    bonds: [], angles: e.angles.slice(), ecart: e.planche ? e.planche.ecart : null,
  };
}

/**
 * LE BOND CASSE : le pied a touche, et l'appui n'est jamais venu. L'athlete
 * ne repart pas — il trebuche et court jusqu'a s'arreter. Pas de marque.
 */
function casser() {
  const j = SprinterApp.G.player;
  const v = e.vol;
  e.poses[v.bond] = null;
  nul('rompu');
  e.pose = null;
  e.phase = 'casse'; e.t = 0;
  j.v = v.vx * 0.6;
  j.fallAnim = 1;
  rendreLeTempo();
  annoncer({ type: 'pose', note: 'rompu', bonPied: true, bond: v.bond });
}

/**
 * UN BOND DANS LE SABLE. Le cloche-pied ou la foulee devaient se poser sur la
 * piste ; ils retombent dans la fosse, ou l'on ne rebondit pas. L'athlete s'y
 * enfonce et s'arrete. Nul.
 */
function dansLeSable() {
  const j = SprinterApp.G.player;
  const v = e.vol;
  e.poses[v.bond] = null;
  nul('sable');
  e.empreinte = { x: v.orteilSuivant - 0.25, y: PISTE_Y, variante: 'course', age: 0 };
  e.gerbe = { x: v.orteilSuivant, y: PISTE_Y, t: 0, force: 0.8 };
  e.phase = 'casse'; e.t = 0;
  j.v = v.vx * 0.5;
  j.fallAnim = 1;
  rendreLeTempo();
  annoncer({ type: 'pose', note: 'sable', bonPied: true, bond: v.bond });
}

/** Les talons touchent le sable : le saut est fait, il reste a le mesurer. */
function contact() {
  const j = SprinterApp.G.player;
  const a = e.appel, v = e.vol, pl = e.planche;
  const avance = v.tRamene == null ? null : v.duree - v.tRamene;
  const ciseau = v.ciseaux >= CISEAU_APPUIS;
  let r;
  if (triple()) {
    r = sauterTriple({
      vElan: pl.vElan, ecart: pl.ecart, angles: e.angles, poses: e.poses, pieds: e.pieds,
      avance, ciseau, vent: e.vent,
    });
  } else {
    r = sauter({ vElan: pl.vElan, ecart: pl.ecart, angle: a.angle, avance, ciseau, vent: e.vent });
    r.raison = r.mordu ? 'planche' : null;
    r.bonds = [];
  }
  // LA TRACE que le juge mesure : depuis la pointe du pied d'appel sur la
  // planche, tout ce que le saut a valu. Mordu ou non, le sable la garde.
  const trace = pl.orteil + r.depuisPointe;
  const dansLeSable = trace >= e.fosseX + 0.02;
  // Retombe avant le sable : au reglement, un essai qui touche le sol hors
  // de la fosse est nul — et sur le tartan, il n'y a rien a mesurer.
  if (!dansLeSable && !r.mordu) {
    r.mordu = true; r.raison = 'hors'; r.metres = 0; r.marque = null;
  }
  e.resultat = r;
  const variante = VARIANTE[r.ramene] || 'avant';
  const y = PISTE_Y + (Math.sin(trace * 7.3) * 0.08);
  const talonX = trace + TALONS[variante];
  if (dansLeSable) {
    e.empreinte = { x: trace, y, variante, age: 0 };
    e.gerbe = { x: talonX, y, t: 0, force: Math.max(0.6, Math.min(1.25, v.vx / 9)) };
  }
  e.reception = {
    t: 0, x: j.d, variante, talonX, mordu: r.mordu,
    hz0: (v.hauteur(v.duree) - 0.08) * (SprinterCore.C.MODEL_H / j.look.h),
  };
  e.phase = 'reception'; e.t = 0;
  SprinterApp.Audio_.sfx && SprinterApp.Audio_.sfx('trip');
  annoncer({ type: 'contact', resultat: r });
  // LE SAUT PARFAIT, SUR TOUS LES POINTS : transition parfaite a l'elan,
  // appel dans les vingt derniers centimetres, angle d'envol dans la zone,
  // ramene parfait — et au triple, des appuis actifs sur le bon pied a chaque
  // bond. Lui seul fait exploser le sable, trembler l'image et s'ouvrir le
  // halo de Sprinter sous l'athlete.
  const bonds = triple() ? 3 : 1;
  const posesParfaites = !triple() || (e.notesPoses.length === 2
    && e.notesPoses.every(n => n === 'actif') && e.pieds.every(Boolean));
  e.parfait = !r.mordu && dansLeSable && j.transGrade === 2
    && pl.ecart >= 0 && pl.ecart <= 0.20
    && e.anglesOk.length === bonds && e.anglesOk.every(Boolean)
    && r.ramene === 'parfait' && posesParfaites;
  if (e.parfait) {
    if (e.gerbe) e.gerbe.force = Math.min(2, e.gerbe.force * 1.6);
    SprinterApp.G.shake = 0.9;
    const P = globalThis.RenduPremium;
    if (P && P.poussee) P.poussee(1, false);
    annoncer({ type: 'parfait', resultat: r });
  }
}

/** Le decametre du juge, puis le drapeau blanc. */
function mesurer() {
  e.mesure = { x: e.empreinte.x, y: e.empreinte.y, a: 1 };
  e.drapeau = { blanc: true, age: 0 };
  annoncer({ type: 'marque', resultat: e.resultat });
}

/* ----------------------------------------------------------- la camera */

/**
 * OU REGARDE LA CAMERA : DEVANT L'ATHLETE, PAS SUR LUI.
 *
 * Au 100 m, le coureur est au milieu de l'image, et c'est juste : ce qui
 * compte est a cote de lui, dans les autres couloirs. Au saut, ce qui compte
 * est DEVANT — la planche, puis le sable —, et cette projection envoie le
 * devant vers le haut a gauche. Sur un telephone tenu droit, l'image est
 * etroite : centre, l'athlete ne voyait pas la planche avant d'avoir le pied
 * dessus. On le pose donc en bas a droite du cadre, d'autant plus que l'ecran
 * est etroit, et la piste qu'il a devant lui remplit le reste.
 */
function viseCamera() {
  const G = SprinterApp.G, j = G.player;
  if (!e || !j) return [LIGNE, PISTE_Y];
  if (LE_LONG) return viseLeLong(j);
  // DE PROFIL (sauts-vue.js), un metre de piste occupe 1,26 metre d'ecran en
  // largeur, et un metre de travers 0,63 en hauteur. On pose donc l'athlete a
  // une part de la largeur de l'ecran, et le sol a une part de sa hauteur —
  // en metres de piste, pas en metres d'ecran.
  const m = SprinterApp.scaleM();
  const demi = G.VW / 2 / (m * 1.26);
  const haut = G.VH / m;
  // Le sol un peu sous le milieu : le vol monte, et les paves tiennent le bas.
  const cote = -(0.10 * haut) / 0.632;
  let part = 0.45;
  if (e.phase === 'repos' || e.phase === 'attente') part = 0.40;
  else if (e.phase === 'elan' || e.phase === 'traverse' || e.phase === 'casse') {
    // plus il approche, plus la planche et le sable entrent dans le cadre
    part = 0.40 + 0.15 * lisse((j.d - (e.ligne - 16)) / 12);
  } else if (e.phase === 'appel' || e.phase === 'vol' || e.phase === 'pose') part = 0.50;
  else if (e.phase === 'reception') {
    return [Math.max(j.d, e.reception.x) + 0.15 * demi, PISTE_Y + cote];
  }
  return [j.d + part * demi, PISTE_Y + cote];
}

/**
 * LA CAMERA DU SAUTOIR LE LONG DE LA PISTE. Dans la vue de Sprinter, la piste
 * d'elan descend en diagonale vers la droite de l'ecran : on vise quelques
 * metres devant l'athlete, pour qu'il ait devant lui la planche puis le
 * sable, et un peu vers la tribune, pour que le public reste dans le cadre.
 */
function viseLeLong(j) {
  // L'avance reste courte : dans cette vue, devant l'athlete c'est vers le
  // haut de l'ecran, et plus la camera vise loin, plus il descend sous les
  // paves — la ou se trouve justement la planche qu'il doit voir.
  let devant = 2.2;
  if (e.phase === 'elan' || e.phase === 'traverse' || e.phase === 'casse') {
    devant = 2.2 + 1.8 * lisse((j.d - (e.ligne - 16)) / 12);
  } else if (e.phase === 'appel' || e.phase === 'vol' || e.phase === 'pose') {
    devant = 2.6;
  } else if (e.phase === 'reception') {
    // Le gros plan du record : on vient sur lui, et on le pose dans le bas de
    // l'image — le haut est pris par la marque et la banniere du record.
    if (e.celebre && e.reception.t > 1.2) return [j.d + 2.3, PISTE_Y + 2.3];
    return [Math.max(j.d, e.reception.x) + 0.8, PISTE_Y + 1.0];
  }
  return [j.d + devant, PISTE_Y + 1.0];
}

/**
 * Le sautoir le long de la piste se regarde de pres, et d'une distance qui ne
 * change presque pas : un zoom qui respire a chaque phase fait bouger tout le
 * stade derriere l'athlete.
 */
function zoomLeLong() {
  switch (e.phase) {
    case 'repos': case 'attente': return 2.45;
    case 'reception': return e.celebre && e.reception.t > 1.2 ? 4.2 : 2.75;
    default: return 2.6;
  }
}

function zoomVise() {
  if (!e) return 1;
  if (LE_LONG) return zoomLeLong();
  const j = SprinterApp.G.player;
  // De profil, le cadre est large et bas : on regarde d'un peu plus loin qu'en
  // trois quarts, et le triple saut, qui s'etend sur vingt metres, plus loin
  // encore.
  const loin = triple() ? 0.9 : 1;
  switch (e.phase) {
    case 'repos': case 'attente': return 1.35;
    case 'elan': return 1.15 + 0.25 * loin * lisse((j.d - (e.ligne - 12)) / 10);
    case 'appel': case 'pose': return 1.55 * loin;
    case 'vol': return 1.50 * loin;
    case 'reception': return e.reception.t < 1.6 ? 1.62 : 1.5;
    default: return 1.35;
  }
}

function zoomer(dt) {
  const G = SprinterApp.G;
  const z = G.zoomMode || 1;
  G.zoomMode = z + (zoomVise() - z) * (1 - Math.exp(-(LE_LONG ? 1.2 : 2.4) * dt));
}

function placerCamera(net) {
  const G = SprinterApp.G;
  if (net) G.zoomMode = zoomVise();
  const [x, y] = G.viseCamera ? G.viseCamera() : viseCamera();
  G.camX = x; G.camY = y;
}

/* ------------------------------------------------- la jauge des paves */

/**
 * CE QUE MONTRENT LES PAVES, avec la regle de Hurdlers : on agit quand c'est
 * plein. Pendant l'elan, la jauge monte vers la ligne — on appuie. Pendant
 * l'impulsion, elle monte vers le bon angle — on relache. En l'air, elle
 * monte vers la pose (le bon pave seulement : c'est le pied qui doit toucher)
 * ou vers le ramene — les deux pouces.
 *
 * Les couleurs viennent des memes regles que le jugement : un ecran qui
 * recalculerait les siennes finirait par mentir.
 */
function jauge() {
  if (!e) return null;
  const j = SprinterApp.G.player;
  if (e.phase === 'elan') {
    const ecart = e.ligne - (j.d + AVANCE_PIED);
    if (ecart > 7) return null;
    const zone = ecart > APPEL_MAXI ? 'plane' : ecart > 0.20 ? 'bon' : ecart >= 0 ? 'parfait' : 'hache';
    return { cote: null, lesDeux: true, part: Math.max(0, Math.min(1, 1 - ecart / 7)), zone };
  }
  if (e.phase === 'appel') {
    const a = e.appel.angle, o = angleVise();
    const zone = a < o - 4.5 ? 'plane' : a < o - 2 ? 'bon' : a <= o + 2.5 ? 'parfait' : a <= o + 5.5 ? 'bon' : 'hache';
    return { cote: e.appel.cote, lesDeux: false, part: Math.min(1, (a - ANGLE_MIN) / (o - ANGLE_MIN)), zone };
  }
  if (e.phase === 'vol' && e.vol.pose) {
    const v = e.vol;
    if (v.tPose != null) return null;
    const avant = v.duree - v.t;
    const zone = avant > POSE.bonAvance ? 'accroche' : avant > POSE.avance ? 'bon' : 'ciseau';
    return { cote: v.coteAttendu, lesDeux: false, part: Math.max(0, Math.min(1, v.t / v.duree)), zone };
  }
  if (e.phase === 'pose') {
    const t = e.pose.t;
    const zone = t <= POSE.retard ? 'ciseau' : t <= POSE.bonRetard ? 'bon' : 'traine';
    return { cote: e.vol.coteAttendu, lesDeux: false, part: 1, zone };
  }
  if (e.phase === 'vol') {
    const v = e.vol;
    if (v.tRamene != null) return null;
    const vise = v.duree - RAMENE_VISE;
    const tol = RAMENE_TOLERANCE * (v.ciseaux >= CISEAU_APPUIS ? CISEAU_TOLERANCE : 1);
    const ec = v.t - vise;
    const zone = ec < -tol ? 'accroche' : ec < -tol / 2 ? 'bon' : ec <= tol / 2 ? 'ciseau' : ec <= tol ? 'bon' : 'traine';
    return { cote: null, lesDeux: true, part: Math.max(0, Math.min(1, v.t / Math.max(0.05, vise))), zone };
  }
  return null;
}

/** La consigne sous les paves, en clef de traduction. */
function consigne() {
  if (!e) return null;
  const j = SprinterApp.G.player;
  switch (e.phase) {
    case 'attente': return 'saut_c_partir';
    case 'elan': return e.ligne - (j.d + AVANCE_PIED) < 7 ? 'saut_c_appel' : 'alternate';
    case 'appel': return 'saut_c_angle';
    case 'pose': return e.vol.bond === 0 ? 'triple_c_cloche' : 'triple_c_foulee';
    case 'vol':
      if (e.vol.pose) return e.vol.bond === 0 ? 'triple_c_cloche' : 'triple_c_foulee';
      return e.vol.tRamene == null ? 'saut_c_ramene' : null;
    default: return null;
  }
}

/** Les paves se montrent-ils ? Seulement quand on a quelque chose a y faire. */
export function pavesDuSaut() {
  if (!e) return true;
  return e.phase === 'attente' || e.phase === 'elan' || e.phase === 'appel'
    || e.phase === 'vol' || e.phase === 'pose';
}
