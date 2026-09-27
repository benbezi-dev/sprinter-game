/* ---------------------------------------------------------------------------
   JUMPER — le saut en hauteur pose sur le moteur de Sprinter
   ---------------------------------------------------------------------------
   La charniere, comme longueur-course.js l'est pour les sauts horizontaux :
   d'un cote le moteur, qui sait faire courir un athlete dans un stade ; de
   l'autre le jeu du saut (hauteur-jeu.js), qui sait ce que vaut un appel, un
   angle, une cambrure et un lancer de jambes. Rien d'autre ici que ce qui les
   relie.

   LES MEMES PORTES QUE LA LONGUEUR. Le moteur ne connait pas plus la hauteur
   qu'il ne connaissait le sable ; il offre ses portes — G.pasSauteur,
   G.appuiSaut, G.relacheSaut, G.viseCamera, G.obstacles, G.zoneReservee,
   G.sautEnCours —, et ce fichier les ouvre a l'armement, les referme en
   partant. Une seule chose est neuve : un athlete qui ne suit pas le couloir.

   L'ELAN EN J. Le coureur ne court plus le long de la piste : il suit un
   chemin dans la pelouse — quelques foulees droites, une courbe de onze metres
   de rayon, puis une ligne droite de biais contre la barre. Le moteur continue
   de le faire courir (sa vitesse, sa foulee, sa cadence) sur une distance ;
   c'est ici qu'on la lit comme une abscisse le long du J, et qu'on pose
   l'athlete a sa place et dans sa direction (`cap`), penche dans la courbe
   (`roulis`). Le moteur les lit au dessin, et nulle part ailleurs.

   LE SAUTOIR EST DANS LA PELOUSE, a quinze metres de la corde : la barre est
   perpendiculaire a la ligne droite, le tapis derriere elle, et l'athlete
   arrive de la piste, par la gauche de la barre, pour prendre son appel du
   pied gauche — le pied exterieur a sa courbe.
--------------------------------------------------------------------------- */

import { SprinterApp, SprinterCore, resetInputRhythm } from './engine';
import { poserLeTempo, rendreLeTempo } from './tempo';
import { TAPIS, MONTANTS, BARRE } from './hauteur.js';
import {
  AVANCE_PIED, APPEL_MAXI, APPEL_MINI, BIAIS, angleDe, TENUE_MAXI, ANGLE_MIN, ANGLE_PAR_S, RALENTI,
  vol as volDe, instantsJustes, meilleurAngle, repere, CORPS, sortDeLaBarre, EFFLEURE,
  VITESSE_ELAN_MAX, VITESSE_JUSTE, jugerElan, sauter, ecartJuste, DISTANCE_ENVOL, pesanteurDe,
} from './hauteur-jeu.js';
import { postureDe, dessinerSol, piecesDebout, dessinerPiece } from './hauteur-rendu.js';
import { creerVue, PROFIL } from './sauts-vue.js';

const D2R = Math.PI / 180;
const lisse = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

/* ------------------------------------------------------------ le sautoir */

/** Le plan de la barre, en metres le long de la ligne droite. */
export const BARRE_X = 60;
/** Le milieu de la barre, dans la pelouse. */
export const BARRE_Y = -15;
/**
 * LE SAUTOIR DE PROFIL (sauts-vue.js), a vingt-cinq degres pres. Parfaitement
 * de profil, la barre serait vue par le bout — un trait vertical a l'ecran, qui
 * se confond avec les montants. Un quart de tour d'horloge de biais la couche
 * en diagonale, et le rouleau reste vu presque de cote : l'athlete court de
 * gauche a droite, passe la barre, retombe sur le tapis.
 */
const ROT_VUE = PROFIL + 25 * D2R;
const PIVOT_MONDE = [60, -10];
let vue = null;

/** Le pied d'appel : le gauche, exterieur a une courbe prise vers la droite. */
export const PIED_APPEL = 'left';

/** La direction de la course a l'appel : trente-cinq degres de biais. */
export const CAP_FINAL = -(90 - BIAIS) * D2R;
const DIR = [Math.cos(CAP_FINAL), Math.sin(CAP_FINAL)];
/** Le rayon de la courbe, et les deux lignes droites qui l'encadrent. */
const RAYON_J = 11;
const DROIT_DEBUT = 8.5;
const DROIT_FIN = 3.0;
/** L'appel de reference : 1,35 m du plan, 1,5 m du milieu de la barre. */
const APPEL_REF = [BARRE_X - 1.35, BARRE_Y + 1.5];

// Le J se construit a rebours, depuis l'appel de reference.
const CM_REF = [APPEL_REF[0] - AVANCE_PIED * DIR[0], APPEL_REF[1] - AVANCE_PIED * DIR[1]];
const FIN_COURBE = [CM_REF[0] - DROIT_FIN * DIR[0], CM_REF[1] - DROIT_FIN * DIR[1]];
const ALPHA = -CAP_FINAL;
const CENTRE = [FIN_COURBE[0] - RAYON_J * Math.sin(ALPHA), FIN_COURBE[1] - RAYON_J * Math.cos(ALPHA)];
const DEBUT_COURBE = [CENTRE[0], CENTRE[1] + RAYON_J];
/** La marque de depart de l'athlete. */
export const MARQUE = [DEBUT_COURBE[0] - DROIT_DEBUT, DEBUT_COURBE[1]];
const L1 = DROIT_DEBUT, L2 = RAYON_J * ALPHA;

/** Le J : ou est l'athlete, et vers ou il court, a `s` metres de sa marque. */
export function chemin(s) {
  if (s <= L1) return { x: MARQUE[0] + s, y: MARQUE[1], cap: 0, courbe: 0 };
  if (s <= L1 + L2) {
    const a = (s - L1) / RAYON_J;
    return { x: CENTRE[0] + RAYON_J * Math.sin(a), y: CENTRE[1] + RAYON_J * Math.cos(a), cap: -a, courbe: 1 / RAYON_J };
  }
  const u = s - L1 - L2;
  return { x: FIN_COURBE[0] + u * DIR[0], y: FIN_COURBE[1] + u * DIR[1], cap: CAP_FINAL, courbe: 0 };
}
/** Les reperes de l'athlete sur le tartan : la marque et le debut de la courbe. */
export const REPERES = { marque: MARQUE, courbe: DEBUT_COURBE, centre: CENTRE, rayon: RAYON_J, L1, L2 };

/**
 * L'epreuve telle que le moteur la lit : la ligne droite du stade, et le
 * plafond d'elan. Comme a la longueur, les `ranges` ne servent qu'a
 * buildLevel, qui tire un plateau de coureurs aussitot renvoyes.
 */
const EPREUVE = {
  key: 'hauteur', label: 'SAUT EN HAUTEUR', sub: 'la barre et le tapis',
  arc: 0, straight: 100, maxSpeed: VITESSE_ELAN_MAX, best: 9.5,
  ranges: [[20, 21], [20, 21], [20, 21], [20, 21], [20, 21], [20, 21]],
};

/**
 * Le ralenti du vol. Les deux gestes en l'air se jugent a quelques centiemes
 * en temps de jeu : a quarante-cinq pour cent, cela fait un dixieme sous le
 * doigt, et le rouleau se regarde.
 */
const VOL_RALENTI = 0.45;

const RAYON_BARRE = BARRE.diametre / 2;
const BORD_TAPIS = BARRE_X + MONTANTS.jeuTapis;

/* -------------------------------------------------------------- l'etat */

let e = null;
let sauvegarde = null;
const ecouteurs = new Set();

function annoncer(evt) {
  for (const f of ecouteurs) { try { f(evt); } catch (err) { /* un ecran ne fait pas tomber le saut */ } }
}

/** Ecouter ce qui se passe au sautoir. */
export function ecouterHauteur(f) {
  ecouteurs.add(f);
  return () => { ecouteurs.delete(f); };
}

/** L'etat du saut en cours, pour l'ecran. Nul hors d'un concours. */
export function etatHauteur() { return e; }

/* ------------------------------------------------------------ l'armement */

/** Monter le stade du concours, et ouvrir les portes du moteur. */
export function armerConcoursHauteur(etape) {
  const A = SprinterApp, G = A.G;
  if (e) nettoyer();
  sauvegarde = { race: G.race, raceKey: G.raceKey, surRetour: G.surRetourAccueil };
  G.race = EPREUVE;
  A.buildLevel(etape);
  e = {
    epreuve: 'hauteur', etape, g: pesanteurDe(etape),
    phase: 'repos', t: 0, horlogeT: 0, horloge: 60,
    s: 0, vHist: [], appel: null, vol: null, reception: null,
    hauteur: 1.5, barre: { chute: null, tremble: null }, impact: null,
    resultat: null, drapeau: null, posture: null, juge: null, pieces: [],
    roulis: 0, theme: A.theme(),
    // Ce que le rendu doit savoir du sautoir, sans revenir chercher ce module.
    sautoir: {
      x: BARRE_X, y: BARRE_Y, dir: DIR, cap: CAP_FINAL, marque: MARQUE, courbe: DEBUT_COURBE,
      centre: CENTRE, rayon: RAYON_J, alpha: ALPHA, finCourbe: FIN_COURBE,
      laneW: SprinterCore.C.LANE_W,
    },
  };
  vue = creerVue({ rot: ROT_VUE, pivotLocal: [BARRE_X, BARRE_Y], pivotMonde: PIVOT_MONDE, laneW: SprinterCore.C.LANE_W });
  const local = (fn) => vue.avec(G.player, fn);
  G.sautEnCours = true;
  G.pasSauteur = (j, dt, el) => local(() => pas(j, dt, el));
  G.appuiSaut = (cote) => local(() => appui(cote));
  G.relacheSaut = (cote) => local(() => relache(cote));
  G.viseCamera = () => { const p = local(viseCamera); return vue.monde(p[0], p[1]); };
  G.jaugeSaut = () => local(jauge);
  G.consigneSaut = () => local(consigne);
  G.pavesSaut = pavesHauteur;
  // Le decor ne se pose ni sur l'aire d'elan ni sur le tapis.
  G.zoneReservee = vue.zone([
    [MARQUE[0] - 6, BARRE_Y - TAPIS.largeur / 2 - 4], [BARRE_X + TAPIS.profondeur + 3, BARRE_Y - TAPIS.largeur / 2 - 4],
    [MARQUE[0] - 6, MARQUE[1] + 3], [BARRE_X + TAPIS.profondeur + 3, MARQUE[1] + 3],
  ]);
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
  G.surRetourAccueil = () => {
    const avant = sauvegarde && sauvegarde.surRetour;
    nettoyer();
    if (avant) avant();
  };
  nouveauSauteur();
  G.state = 'race';
  G.elapsed = 0; G.acc = 0;
  G.depart = null;
  G.recTrace = null;
  placerCamera(true);
}

/** Un athlete neuf sur sa marque. */
function nouveauSauteur() {
  const G = SprinterApp.G;
  const j = new SprinterCore.Runner('TOI', 0, {
    isPlayer: true, maxSpeed: VITESSE_ELAN_MAX, best: EPREUVE.best, total: G.track.total,
  });
  j.lane = 0;
  j.stride = 0;
  j.drivePitch = 0;
  j.reaction = 0; j.reactBonus = 0;
  j.legStart = 0;
  G.player = j;
  G.runners = [j];
  G.reactShown = true;
  G.transShown = false;
  resetInputRhythm();
  e.s = 0;
  e.roulis = 0;
  placer(j);
  // Un coureur neuf, pose au monde : l'ancien n'a plus rien a garder.
  if (vue) { vue.oublier(); vue.poser(j); }
}

/** Tout ce qu'un essai laisse derriere lui, remis a zero. */
function essaiNeuf() {
  return {
    t: 0, s: 0, vHist: [], appel: null, vol: null, reception: null,
    barre: { chute: null, tremble: null }, impact: null,
    resultat: null, drapeau: null, finAnnoncee: false, arret: null,
  };
}

/** Montrer la barre a sa hauteur, entre deux essais. */
export function montrerBarre(h) {
  if (e) e.hauteur = h;
}

/**
 * Appeler le joueur : c'est a lui. La barre est a `hauteur`, il a `temps`
 * secondes pour s'elancer.
 *
 * @param {{ hauteur?: number, temps?: number }} [o]
 */
export function appelerSauteur({ hauteur, temps = 60 } = {}) {
  if (!e) return;
  Object.assign(e, essaiNeuf(), { phase: 'attente', horloge: temps, hauteur: hauteur || e.hauteur });
  nouveauSauteur();
  rendreLeTempo();
  SprinterApp.G.state = 'race';
  placerCamera(true);
}

/** Le joueur attend son tour, sur sa marque. */
export function mettreAuRepos(hauteur) {
  if (!e) return;
  Object.assign(e, essaiNeuf(), { phase: 'repos' });
  if (hauteur) e.hauteur = hauteur;
  nouveauSauteur();
  rendreLeTempo();
  placerCamera(true);
}

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
  if (G.obstacles && G.obstacles.saut) G.obstacles = null;
  G.zoomMode = 1;
  if (G.player) {
    const j = G.player;
    j.posture = null; j.fallAnim = 0; j.tete = 0; j.cap = 0; j.roulis = 0; j.sansOmbre = false; j.demi = 0;
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

/** Quitter le concours. */
export function rangerConcoursHauteur() {
  if (!e && !sauvegarde) return;
  SprinterApp.goHome();
  nettoyer();
}

/* ------------------------------------------------------- les positions */

/** Poser l'athlete a un point du monde, tourne vers `cap`. */
function poserA(j, x, y, cap) {
  j.d = x;
  j.demi = y - SprinterCore.C.LANE_W * 0.5;
  j.cap = cap;
}

/** Poser l'athlete a sa place sur le J. */
function placer(j) {
  const p = chemin(e.s);
  poserA(j, p.x, p.y, p.cap);
  return p;
}

/** Ou est la pointe du pied qui se poserait maintenant, et a quelle distance du plan. */
function pointe() {
  const p = chemin(e.s);
  const x = p.x + AVANCE_PIED * Math.cos(p.cap), y = p.y + AVANCE_PIED * Math.sin(p.cap);
  return { x, y, ecart: BARRE_X - x, cap: p.cap };
}

/** Le monde, en y : la ou le moteur le dessine. */
function yDe(j) { return SprinterCore.C.LANE_W * 0.5 + (j.demi || 0); }

/* ---------------------------------------------------------- les gestes */

function appui(cote) {
  if (!e) return null;
  const j = SprinterApp.G.player;
  switch (e.phase) {
    case 'attente':
      e.phase = 'elan'; e.t = 0;
      annoncer({ type: 'elan' });
      return null;
    case 'elan': {
      if (cote !== PIED_APPEL) return null;
      const p = pointe();
      if (p.ecart > APPEL_MAXI || p.ecart < APPEL_MINI) return null;
      // L'APPEL : le pied gauche se pose ici, a cette distance du plan.
      const vElan = vitesseDElan();
      const vise = meilleurAngle(vElan, p.ecart, e.g);
      e.appel = {
        cote, pointe: [p.x, p.y], ecart: p.ecart, vElan, t0: performance.now(),
        cm0: [chemin(e.s).x, chemin(e.s).y], u: 0, charge: 0, angle: ANGLE_MIN, vise,
        roulis0: e.roulis,
      };
      e.phase = 'appel'; e.t = 0;
      poserLeTempo(RALENTI);
      annoncer({ type: 'appel', ecart: p.ecart, vElan, elan: jugerElan(vElan), juste: ecartJuste(vElan, e.g) });
      return 'appel';
    }
    case 'vol': {
      const v = e.vol;
      if (v.tCambre == null) {
        // LA CAMBRURE : on appuie, et l'on tient.
        v.tCambre = v.t;
        v.coteCambre = cote;
        annoncer({ type: 'cambre' });
        return 'ramene';
      }
      return 'rien';
    }
    default:
      return 'rien';
  }
}

function relache(cote) {
  if (!e) return false;
  if (e.phase === 'appel' && cote === e.appel.cote) { decoller(); return true; }
  if (e.phase === 'vol') {
    const v = e.vol;
    if (v.tCambre != null && v.tJambes == null && cote === v.coteCambre) {
      // LES JAMBES : le pouce se leve, elles partent vers le ciel.
      v.tJambes = v.t;
      annoncer({ type: 'jambes' });
      return true;
    }
  }
  return false;
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

function tenu() {
  return e && e.appel ? (performance.now() - e.appel.t0) / 1000 : 0;
}

/** Le pied quitte le sol a l'angle tenu. */
function decoller() {
  const j = SprinterApp.G.player;
  const a = e.appel;
  a.angle = angleDe(tenu());
  const V = volDe(a.vElan, a.angle, a.ecart, e.g);
  const cm0 = [a.pointe[0] + DISTANCE_ENVOL * DIR[0], a.pointe[1] + DISTANCE_ENVOL * DIR[1]];
  e.vol = {
    V, t: 0, cm0, justes: instantsJustes(V),
    tCambre: null, tJambes: null, coteCambre: null,
    passes: {}, prec: {}, fini: false,
  };
  j.sansOmbre = true;
  e.phase = 'vol'; e.t = 0;
  poserLeTempo(VOL_RALENTI);
  annoncer({ type: 'envol', angle: a.angle, vise: a.vise.angle, vElan: a.vElan });
}

/* ------------------------------------------------------------- le pas */

function pas(j, dt, elapsed) {
  if (!e) { j.stepPlayer(dt, elapsed); return; }
  e.t += dt;
  e.horlogeT += dt;
  if (e.drapeau) e.drapeau.age += dt;
  if (e.barre.tremble) e.barre.tremble.t += dt;
  if (e.barre.chute) avancerChute(dt);
  if (e.impact) e.impact.t += dt;
  zoomer(dt);

  switch (e.phase) {
    case 'repos':
    case 'attente': {
      j.v = 0; j.drivePitch = 0;
      e.s = 0; placer(j);
      if (e.phase === 'attente') {
        e.horloge -= dt;
        if (e.horloge <= 0) {
          echec('temps');
          e.phase = 'temps'; e.t = 0;
          e.drapeau = { blanc: false, age: 0 };
          annoncer({ type: 'marque', resultat: e.resultat });
        }
      }
      return;
    }
    case 'elan': {
      // Le moteur fait courir l'athlete sur une distance : c'est son abscisse
      // le long du J. On la lui rend, puis on le pose sur le J.
      j.d = e.s;
      j.stepPlayer(dt, elapsed);
      j.drivePitch *= 0.4;
      e.s = j.d;
      const p = placer(j);
      // Penche dans la courbe, comme au 200 m : la tangente de l'angle est le
      // rapport de l'acceleration centripete a la pesanteur.
      const vise = p.courbe ? Math.min(0.42, Math.atan(j.v * j.v * p.courbe / 9.81)) : 0;
      e.roulis += (vise - e.roulis) * (1 - Math.exp(-6 * dt));
      j.roulis = e.roulis;
      e.vHist.push([elapsed, j.v]);
      if (e.vHist.length > 200) e.vHist.splice(0, e.vHist.length - 200);
      // PASSE SOUS LA BARRE : il n'a pas pris son appel, il entre dans le
      // tapis au-dela du plan des montants. C'est un echec.
      if (pointe().ecart < APPEL_MINI) {
        e.phase = 'dessous'; e.t = 0;
        echec('dessous');
      }
      return;
    }
    case 'appel': {
      const a = e.appel;
      const h = tenu();
      a.angle = angleDe(h);
      const bon = Math.max(0.05, (a.vise.angle - ANGLE_MIN) / ANGLE_PAR_S);
      a.u = Math.min(1, h / bon);
      a.charge = Math.max(0, Math.min(1, (h - bon) / 0.4));
      // Le bassin passe au-dessus du pied, du talon a la pointe.
      const dest = [a.pointe[0] + DISTANCE_ENVOL * DIR[0], a.pointe[1] + DISTANCE_ENVOL * DIR[1]];
      const k = lisse(a.u);
      poserA(j, a.cm0[0] + (dest[0] - a.cm0[0]) * k, a.cm0[1] + (dest[1] - a.cm0[1]) * k, CAP_FINAL);
      j.v = a.vElan * (1 - 0.6 * a.u);
      // Il se redresse : l'inclinaison de la courbe se defait dans l'appel.
      e.roulis = a.roulis0 * (1 - k);
      j.roulis = e.roulis;
      if (h >= TENUE_MAXI) decoller();
      return;
    }
    case 'vol': {
      const v = e.vol, V = v.V;
      v.t += dt;
      // Le centre de masse file dans la direction de l'appel ; le bassin, que
      // le moteur pose, s'en ecarte avec la rotation et les deux gestes.
      const x = v.cm0[0] + V.vh * v.t * DIR[0], y = v.cm0[1] + V.vh * v.t * DIR[1];
      const b = bassinRelatif(v, v.t);
      // Le dos tourne vers la barre : du cap de la course au cap oppose au tapis.
      const cap = CAP_FINAL + (-Math.PI - CAP_FINAL) * lisse(v.t / 0.32);
      poserA(j, x + b, y, cap);
      j.v = V.vh;
      e.roulis *= Math.exp(-8 * dt);
      j.roulis = e.roulis;
      franchissements(v);
      // Le dos touche le tapis.
      if (v.t > V.sommetT && V.z(v.t) <= TAPIS.hauteur + 0.28) receptionner();
      return;
    }
    case 'reception': {
      const c = e.reception;
      c.t += dt;
      if (c.t > 0.35) rendreLeTempo();
      // Il glisse un peu sur le tapis, puis s'arrete.
      const k = lisse(c.t / 0.45);
      poserA(j, c.x + c.glisse[0] * k, c.y + c.glisse[1] * k, -Math.PI);
      j.v = 0;
      // LE JUGE ATTEND QUE LA BARRE SE SOIT TUE : tombee, ou immobile.
      const barreCalme = e.barre.chute ? e.barre.chute.pose : (!e.barre.tremble || e.barre.tremble.t > 0.9);
      if (!e.drapeau && c.t >= 0.7 && barreCalme) {
        e.drapeau = { blanc: e.resultat.franchi, age: 0 };
        annoncer({ type: 'marque', resultat: e.resultat });
      }
      if (e.drapeau && e.drapeau.age >= 2.1 && !e.finAnnoncee) {
        e.finAnnoncee = true;
        annoncer({ type: 'fin', resultat: e.resultat });
      }
      return;
    }
    case 'dessous': {
      // Il freine, passe sous la barre, s'arrete contre le tapis.
      if (!e.arret) {
        j.v *= Math.exp(-2.2 * dt);
        e.s += j.v * dt;
        j.stride += j.v * dt * (Math.PI / j.strideLength());
        const p = placer(j);
        if (p.x >= BORD_TAPIS - 0.25 || j.v < 0.3) { e.arret = { x: p.x, y: p.y }; j.v = 0; }
      }
      if (e.t >= 1.0 && !e.drapeau) {
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

/**
 * De combien le bassin est en avant du centre de masse, vers le tapis. C'est
 * le meme calcul que le repere « bassin » du jeu : le rendu et le verdict
 * parlent du meme corps.
 */
export function bassinRelatif(v, t) {
  const p = CORPS.find((q) => q.cle === 'bassin');
  const r = v.V.rotation(t);
  const { cambre, jambes } = gestes(v, t);
  const lift = p.cambre * cambre + p.jambes * jambes;
  return p.s * Math.sin(r) - lift * Math.cos(r);
}

/** La cambrure et le lancer des jambes a l'instant `t` du vol. */
export function gestes(v, t) {
  const GESTE = 0.08;
  const jambes = v.tJambes == null ? 0 : Math.max(0, Math.min(1, (t - v.tJambes) / GESTE));
  const cambre = v.tCambre == null ? 0 : Math.max(0, Math.min(1, (t - v.tCambre) / GESTE)) * (1 - jambes);
  return { cambre, jambes };
}

/**
 * LE CORPS PASSE LA BARRE, PARTIE PAR PARTIE, EN DIRECT.
 *
 * Chaque image, on regarde quels reperes du corps viennent de passer le plan
 * de la barre, et a quelle hauteur leur dos l'a fait. Ce que le joueur fera
 * plus tard ne change rien a un repere deja passe — c'est donc le verdict
 * exact, et il tombe a l'instant ou on le voit.
 */
function franchissements(v) {
  const H = e.hauteur;
  for (const p of CORPS) {
    if (v.passes[p.cle]) continue;
    const [x, z] = repere(v.V, p, v.t, v.tCambre, v.tJambes);
    const prev = v.prec[p.cle];
    if (x >= 0) {
      const zc = prev ? prev[1] + (z - prev[1]) * (-prev[0]) / Math.max(1e-6, x - prev[0]) : z;
      const marge = zc - RAYON_BARRE - H;
      v.passes[p.cle] = { t: v.t, z: zc, marge };
      toucher(p.cle, marge);
    }
    v.prec[p.cle] = [x, z];
  }
}

/** Un repere du corps passe la barre avec cette marge. */
function toucher(cle, marge) {
  if (e.barre.chute || marge >= EFFLEURE) return;
  const s = sortDeLaBarre(marge);
  const j = SprinterApp.G.player;
  if (s.tombe) {
    const y = Math.max(BARRE_Y - 1.9, Math.min(BARRE_Y + 1.9, yDe(j)));
    e.barre.chute = {
      par: cle, y, t: 0, pose: false,
      // les deux bouts : celui qui est le plus pres du choc part le premier
      bouts: [0, 1].map((k) => {
        const yb = BARRE_Y + (k ? 1 : -1) * BARRE.longueur / 2;
        const loin = Math.abs(yb - y) / BARRE.longueur;
        return { retard: 0.03 + 0.10 * loin, x: BARRE_X, z: e.hauteur, vx: 1.1 + 0.6 * (1 - loin), vz: 0.4, pose: false };
      }),
    };
    annoncer({ type: 'touche', par: cle, tombe: true });
  } else if (s.tremble) {
    e.barre.tremble = { t: 0, amp: 0.018 + 0.02 * Math.max(0, -marge) / 0.012, y: yDe(j) };
    annoncer({ type: 'touche', par: cle, tombe: false });
  }
}

/** La barre qui tombe : chaque bout quitte son taquet, et retombe sur le tapis. */
function avancerChute(dt) {
  const c = e.barre.chute;
  c.t += dt;
  let poses = 0;
  for (const b of c.bouts) {
    if (c.t < b.retard) continue;
    if (b.pose) { poses++; continue; }
    b.vz -= 9.81 * dt;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    const sol = b.x > BORD_TAPIS ? TAPIS.hauteur + 0.02 : RAYON_BARRE;
    if (b.z <= sol) {
      b.z = sol;
      if (Math.abs(b.vz) > 1.2) { b.vz = -b.vz * 0.25; b.vx *= 0.5; }
      else { b.pose = true; b.vz = 0; b.vx = 0; }
    }
  }
  c.pose = poses === 2;
}

/** Le dos touche le tapis : le saut est fait. */
function receptionner() {
  const j = SprinterApp.G.player;
  const v = e.vol, a = e.appel;
  // Un repere qui n'a jamais passe le plan : le corps retombe sur la barre.
  for (const p of CORPS) if (!v.passes[p.cle]) { v.passes[p.cle] = { t: v.t, z: -1, marge: -1 }; toucher(p.cle, -1); }
  const r = sauter({
    vElan: a.vElan, ecart: a.ecart, angle: a.angle, tCambre: v.tCambre, tJambes: v.tJambes,
    hauteur: e.hauteur, g: e.g, alea: () => 0.5,
  });
  // Le verdict est celui de la piste, pas celui d'un nouveau tirage.
  r.franchi = !e.barre.chute;
  r.tremble = !!e.barre.tremble;
  if (e.barre.chute) r.par = e.barre.chute.par;
  r.raison = r.franchi ? null : 'barre';
  e.resultat = r;
  const x = j.d, y = yDe(j);
  e.reception = { t: 0, x, y, glisse: [DIR[0] * 0.25 + 0.35, DIR[1] * 0.45], phi0: v.V.rotation(v.t), bassin0: v.V.z(v.t) };
  e.impact = { x: x + 0.3, y, t: 0 };
  e.phase = 'reception'; e.t = 0;
  SprinterApp.Audio_.sfx && SprinterApp.Audio_.sfx('trip');
  annoncer({ type: 'reception', resultat: r });
}

/** Un essai manque sans saut : le temps, ou passe sous la barre. */
function echec(raison) {
  e.resultat = {
    franchi: false, raison, par: null, hauteur: e.hauteur,
    vElan: e.vHist.length ? vitesseDElan() : 0, ecart: null, angle: null,
  };
}

/* ----------------------------------------------------------- la camera */

/**
 * OU REGARDE LA CAMERA : entre l'athlete et la barre. Au depart, la barre est
 * a vingt metres ; on la montre de loin, l'athlete en bas a droite du cadre,
 * d'autant plus que l'ecran est etroit. A l'appel, on cadre la barre et le
 * tapis ; a la reception, l'athlete sur le tapis, sous la barre.
 */
function viseCamera() {
  const G = SprinterApp.G, j = G.player;
  if (!e || !j) return [BARRE_X, BARRE_Y];
  // LE CADRAGE SE COMPTE A L'ECRAN. Le sautoir est tourne dans le monde
  // (sauts-vue.js) : la droite de l'ecran et son « haut » au sol sont deux
  // directions du sautoir, qu'on retrouve en defaisant la rotation. Un metre
  // pris vers la droite vaut 1,26 metre d'ecran, un metre vers le haut 0,63.
  const m = SprinterApp.scaleM();
  const demi = G.VW / 2 / (m * 1.26), haut = G.VH / m;
  const r = -ROT_VUE;
  const tourne = (a, b) => [a * Math.cos(r) - b * Math.sin(r), a * Math.sin(r) + b * Math.cos(r)];
  const D = tourne(-Math.SQRT1_2, Math.SQRT1_2), U = tourne(Math.SQRT1_2, Math.SQRT1_2);
  const leve = 0.12 * haut / 0.632;
  const cadre = (x, y, part) => [x + D[0] * part * demi + U[0] * leve, y + D[1] * part * demi + U[1] * leve];
  const x = j.d, y = yDe(j);
  // La barre, et ce qu'il faut voir au-dessus d'elle.
  const barre = cadre(BARRE_X + 0.4, BARRE_Y - 0.3, 0);
  if (e.phase === 'repos' || e.phase === 'attente') return cadre(x, y, 0.42);
  if (e.phase === 'elan') {
    // l'athlete d'abord, la barre a mesure qu'elle approche
    const k = lisse((e.s - L1 * 0.5) / (L1 * 0.5 + L2));
    const a = cadre(x, y, 0.42);
    return [a[0] + (barre[0] - a[0]) * k, a[1] + (barre[1] - a[1]) * k];
  }
  if (e.phase === 'appel' || e.phase === 'vol') return barre;
  if (e.phase === 'reception') return cadre(x, y, 0.05);
  return cadre(x, y, 0.15);
}

function zoomVise() {
  if (!e) return 1;
  switch (e.phase) {
    case 'repos': case 'attente': return 1.25;
    case 'elan': return 1.2 + 0.2 * lisse(e.s / (L1 + L2 + 2));
    case 'appel': return 1.45;
    case 'vol': return 1.42;
    case 'reception': return e.reception.t < 1.2 ? 1.45 : 1.4;
    default: return 1.35;
  }
}

function zoomer(dt) {
  const G = SprinterApp.G;
  const z = G.zoomMode || 1;
  G.zoomMode = z + (zoomVise() - z) * (1 - Math.exp(-2.4 * dt));
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
 * plein. A l'approche de la barre, le pave GAUCHE — le pied d'appel — se
 * remplit vers la bonne distance. Pendant l'impulsion, il monte vers le bon
 * angle : on relache. En l'air, les deux paves montent vers la cambrure ;
 * puis, le pouce tenu, vers le lancer des jambes : on relache.
 */
function jauge() {
  if (!e) return null;
  const j = SprinterApp.G.player;
  if (e.phase === 'elan') {
    const p = pointe();
    if (p.ecart > 7) return null;
    const juste = ecartJuste(vitesseDElan(), e.g);
    const d = p.ecart - juste;
    const zone = p.ecart > APPEL_MAXI ? 'plane' : d > 0.35 ? 'bon' : d >= -0.2 ? 'parfait' : d >= -0.45 ? 'bon' : 'hache';
    return { cote: PIED_APPEL, lesDeux: false, part: Math.max(0, Math.min(1, (7 - p.ecart) / (7 - juste))), zone };
  }
  if (e.phase === 'appel') {
    const a = e.appel.angle, o = e.appel.vise.angle;
    const zone = a < o - 6 ? 'plane' : a < o - 2.5 ? 'bon' : a <= o + 2.5 ? 'parfait' : a <= o + 6 ? 'bon' : 'hache';
    return { cote: e.appel.cote, lesDeux: false, part: Math.min(1, (a - ANGLE_MIN) / Math.max(1, o - ANGLE_MIN)), zone };
  }
  if (e.phase === 'vol') {
    const v = e.vol, J = v.justes;
    if (J.cambre == null) return null;
    if (v.tCambre == null) {
      const ec = v.t - J.cambre;
      const zone = ec < -0.07 ? 'accroche' : ec < -0.035 ? 'bon' : ec <= 0.035 ? 'parfait' : ec <= 0.07 ? 'bon' : 'traine';
      return { cote: null, lesDeux: true, part: Math.max(0, Math.min(1, v.t / Math.max(0.05, J.cambre))), zone };
    }
    if (v.tJambes == null) {
      const ec = v.t - J.jambes;
      const zone = ec < -0.07 ? 'accroche' : ec < -0.035 ? 'bon' : ec <= 0.035 ? 'parfait' : ec <= 0.07 ? 'bon' : 'traine';
      const part = (v.t - v.tCambre) / Math.max(0.05, J.jambes - v.tCambre);
      return { cote: v.coteCambre, lesDeux: false, part: Math.max(0, Math.min(1, part)), zone };
    }
    return null;
  }
  void j;
  return null;
}

/** La consigne sous les paves, en clef de traduction. */
function consigne() {
  if (!e) return null;
  switch (e.phase) {
    case 'attente': return 'haut_c_partir';
    case 'elan': return pointe().ecart < 7 ? 'haut_c_appel' : 'haut_c_elan';
    case 'appel': return 'haut_c_angle';
    case 'vol':
      if (e.vol.tCambre == null) return 'haut_c_cambre';
      if (e.vol.tJambes == null) return 'haut_c_jambes';
      return null;
    default: return null;
  }
}

/** Les paves se montrent-ils ? Seulement quand on a quelque chose a y faire. */
export function pavesHauteur() {
  if (!e) return true;
  return e.phase === 'attente' || e.phase === 'elan' || e.phase === 'appel'
    || (e.phase === 'vol' && e.vol.tJambes == null);
}

/** La vitesse juste, pour l'ecran. */
export { VITESSE_JUSTE };
