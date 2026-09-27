/* ---------------------------------------------------------------------------
   JUMPER — le saut en longueur pose sur le moteur de Sprinter
   ---------------------------------------------------------------------------
   Ce fichier est la charniere, comme haies-course.js l'est pour les haies :
   d'un cote le moteur, qui sait faire courir un athlete dans un stade ; de
   l'autre le jeu du saut (longueur-jeu.js), qui sait ce que vaut un appel,
   un angle et un ramene. Il n'y a rien d'autre ici que ce qui les relie.

   LE MOTEUR NE CONNAIT PAS LE SAUT. Il offre des portes, et ce fichier les
   ouvre a l'armement et les referme en partant :

     G.pasSauteur     le pas de simulation du joueur, a la place de stepPlayer
     G.appuiSaut      un appui sur un pave : foulee, appel, ciseau ou ramene
     G.relacheSaut    le pouce qui quitte la planche : l'angle est fixe
     G.viseCamera     ou regarder : la piste d'elan, puis la fosse
     G.obstacles      le calque au sol et ce qui se tient debout
     G.zoneReservee   la pelouse ou le decor ne se pose pas
     G.sautEnCours    pas de ligne d'arrivee : le concours tranche

   L'ATHLETE COURT DANS LA PELOUSE. La piste d'elan longe la ligne droite,
   a quatre metres de la corde, comme dans tous les stades : on garde donc la
   piste du 100 m, et l'on pose le coureur a cote d'elle — `demi` est l'ecart
   lateral que le moteur sait deja lire, celui du relais.
--------------------------------------------------------------------------- */

import { SprinterApp, SprinterCore, resetInputRhythm } from './engine';
import { poserLeTempo, rendreLeTempo } from './tempo';
import { ELAN, FOSSE, TEMPS_ESSAI } from './longueur.js';
import {
  AVANCE_PIED, APPEL_MAXI, angleDe, TENUE_MAXI, ANGLE_MIN, ANGLE_PAR_S, RALENTI,
  vol as volDe, hauteurA, sauter, DISTANCE_ENVOL, RAMENE_VISE, RAMENE_TOLERANCE,
  CISEAU_TOLERANCE, CISEAU_APPUIS,
} from './longueur-jeu.js';
import {
  postureDe, dessinerSol, piecesDebout, dessinerPiece, prechargerSable,
} from './longueur-rendu.js';

/** La ligne d'appel, en metres le long de la ligne droite. */
export const LIGNE = 50;
/** L'axe de la piste d'elan : dans la pelouse, a 4,40 m de la corde. */
export const PISTE_Y = -4.4;

/**
 * LA VITESSE D'ELAN LA PLUS HAUTE, en m/s.
 *
 * Un sauteur ne court pas a la vitesse d'un sprinteur : il arrive sur la
 * planche a la sienne, CONTROLEE, onze metres par seconde chez les
 * meilleurs, parce qu'il doit encore poser un pied au centimetre et se
 * lever. Le plafond est donc celui-la, un peu au-dessus ; la transition
 * parfaite le releve comme au 100 m (TRANS_VMAX), et c'est ce qu'il faut pour
 * sauter avec les ZEZE. Voir tools/longueur-test.mjs.
 */
export const VITESSE_ELAN_MAX = 11.6;

/**
 * L'epreuve telle que le moteur la lit : une ligne droite de cent metres —
 * celle du stade —, et le plafond d'elan. Les `ranges` ne servent qu'a
 * buildLevel, qui tire un plateau de coureurs que l'on renvoie aussitot aux
 * vestiaires : au saut en longueur, on saute seul sur la piste.
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

/** Ecouter ce qui se passe sur la piste : appel, envol, contact, marque, fin. */
export function ecouterSaut(f) {
  ecouteurs.add(f);
  return () => { ecouteurs.delete(f); };
}

/** L'etat du saut en cours, pour l'ecran. Nul hors d'un concours. */
export function etatSaut() { return e; }

/* ------------------------------------------------------------ l'armement */

/**
 * Monter le stade du concours, et ouvrir les portes du moteur.
 *
 * `etape` choisit le stade — les six etapes de Sprinter — et donc le public,
 * la piste et le sable.
 */
export function armerConcoursSaut(etape) {
  const A = SprinterApp, G = A.G;
  if (e) nettoyer();
  sauvegarde = { race: G.race, raceKey: G.raceKey, surRetour: G.surRetourAccueil };
  G.race = EPREUVE;
  A.buildLevel(etape);
  e = {
    ligne: LIGNE, pisteY: PISTE_Y, depart: LIGNE - ELAN,
    phase: 'repos', t: 0, horlogeT: 0, horloge: TEMPS_ESSAI,
    jambeAppel: 0, vHist: [], appel: null, vol: null, reception: null,
    angleEnvol: null, angleVise: [19, 24], resultat: null,
    empreinte: null, gerbe: null, mesure: null, drapeau: null, traceMordue: null,
    lignes: [], vent: 0, posture: null, juge: null, pieces: [],
    theme: A.theme(),
  };
  prechargerSable(e.theme);

  G.sautEnCours = true;
  G.pasSauteur = pas;
  G.appuiSaut = appui;
  G.relacheSaut = relache;
  G.viseCamera = viseCamera;
  G.jaugeSaut = jauge;
  G.consigneSaut = consigne;
  G.pavesSaut = pavesDuSaut;
  // Le decor ne se pose pas sur la piste d'elan ni dans la fosse.
  G.zoneReservee = { x0: LIGNE - 48, x1: LIGNE + FOSSE.fond + 3, y0: PISTE_Y - 4.6, y1: 0 };
  G.obstacles = {
    saut: true,
    preparer(r, G2, C) {
      if (!e || r !== G2.player) { r.posture = null; return; }
      r.posture = postureDe(e, r, C.MODEL_H / r.look.h);
    },
    oublier(r) { r.posture = null; },
    sol(ctx, api) { if (e) dessinerSol(ctx, api, e, e.theme); },
    pieces(api) { return e ? piecesDebout(e, api, e.pieces) : []; },
    dessiner(ctx, api, pc) { if (e) dessinerPiece(ctx, api, e, pc, e.theme, SprinterApp); },
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
  const j = new SprinterCore.Runner('TOI', 0, {
    isPlayer: true, maxSpeed: VITESSE_ELAN_MAX, best: EPREUVE.best, total: G.track.total,
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
  G.player = j;
  G.runners = [j];
  G.reactShown = true;
  G.transShown = false;
  resetInputRhythm();
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
  Object.assign(e, {
    phase: 'attente', t: 0, horloge: TEMPS_ESSAI, vHist: [], appel: null, vol: null,
    reception: null, angleEnvol: null, resultat: null, empreinte: null, gerbe: null,
    mesure: null, drapeau: null, traceMordue: null, vent, lignes,
  });
  G.state = 'race';
  placerCamera(true);
}

/** Le joueur attend son tour : sur sa marque, sans chrono, sans paves. */
export function mettreAuRepos() {
  if (!e) return;
  nouveauSauteur();
  rendreLeTempo();
  Object.assign(e, { phase: 'repos', t: 0, appel: null, vol: null, reception: null,
                     gerbe: null, mesure: null, drapeau: null });
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
  if (G.obstacles && G.obstacles.saut) G.obstacles = null;
  G.zoomMode = 1;
  if (G.player) G.player.posture = null;
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
 * Un appui sur un pave. Rend ce qu'il a ete — 'appel', 'ciseau', 'ramene' —
 * ou 'rien' s'il n'a rien fait, ou null pour une foulee ordinaire, que le
 * moteur traite alors comme au 100 m.
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
      const ecart = LIGNE - orteil;
      if (ecart > APPEL_MAXI) return null;
      // L'APPEL. Le pied se pose ICI, a l'instant de l'appui : c'est lui
      // que le juge regarde, et c'est lui que la mesure retranche.
      e.appel = {
        cote, orteil, ecart, d0: j.d, t0: performance.now(), u: 0, charge: 0,
        angle: ANGLE_MIN, vElan: vitesseDElan(),
      };
      e.jambeAppel = cote === 'left' ? 0 : 1;
      e.phase = 'appel'; e.t = 0;
      if (ecart < 0) e.traceMordue = orteil;
      poserLeTempo(RALENTI);
      annoncer({ type: 'appel', ecart, vElan: e.appel.vElan });
      return 'appel';
    }
    case 'appel':
      // L'autre pouce pendant l'impulsion ne fait rien : on tient, on relache.
      return 'rien';
    case 'vol': {
      const v = e.vol;
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
    default:
      return 'rien';
  }
}

/** Le pouce se leve. Sur la planche, c'est le decollage. */
function relache(cote) {
  if (!e || e.phase !== 'appel' || cote !== e.appel.cote) return false;
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

/** L'impulsion est finie : le pied quitte la planche a l'angle tenu. */
function decoller() {
  const G = SprinterApp.G, j = G.player;
  const a = e.appel;
  a.angle = angleDe(tenu());
  e.angleEnvol = a.angle;
  const V = volDe(a.vElan, a.angle);
  const contact = a.orteil + DISTANCE_ENVOL + V.longueur;
  e.vol = {
    t: 0, duree: V.duree, x0: j.d, vx: (contact - j.d) / V.duree, V,
    hauteur: (t) => hauteurA(V, t),
    ciseaux: 0, phase: 0, phaseVise: 0, dernierCote: a.cote, tRamene: null,
  };
  e.phase = 'vol'; e.t = 0;
  poserLeTempo(VOL_RALENTI);
  annoncer({ type: 'envol', angle: a.angle, vElan: a.vElan });
}

/** Depuis combien de temps le pouce tient la planche, sur l'horloge du joueur. */
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
        e.phase = 'temps'; e.t = 0;
        e.resultat = { mordu: true, raison: 'temps', metres: 0, marque: null, vent: e.vent };
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
      if (j.d + AVANCE_PIED > LIGNE + 0.25) {
        e.phase = 'traverse'; e.t = 0;
        e.traceMordue = LIGNE + 0.06;
        e.resultat = { mordu: true, raison: 'traverse', metres: 0, marque: null, vent: e.vent };
      }
      return;
    }
    case 'appel': {
      const a = e.appel;
      const h = tenu();
      a.angle = angleDe(h);
      // Le bassin passe au-dessus du pied en trois dixiemes de pouce ; tenu
      // plus longtemps, il s'ecrase.
      const bon = (21.5 - ANGLE_MIN) / ANGLE_PAR_S;
      a.u = Math.min(1, h / bon);
      a.charge = Math.max(0, Math.min(1, (h - bon) / 0.4));
      const vise = a.orteil + DISTANCE_ENVOL;
      j.d = a.d0 + (vise - a.d0) * lisse(a.u);
      j.v = a.vElan * (1 - 0.5 * a.u);
      if (h >= TENUE_MAXI) decoller();
      return;
    }
    case 'vol': {
      const v = e.vol;
      v.t = Math.min(v.duree, v.t + dt);
      j.d = v.x0 + v.vx * v.t;
      j.v = v.vx;
      v.phase += (v.phaseVise - v.phase) * (1 - Math.exp(-16 * dt));
      if (v.t >= v.duree) contact();
      return;
    }
    case 'reception': {
      const c = e.reception;
      c.t += dt;
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
      const dansLeSable = j.d > LIGNE + FOSSE.debut;
      j.v *= Math.exp(-(dansLeSable ? 3.2 : 1.6) * dt);
      if (j.v < 0.25) j.v = 0;
      j.d += j.v * dt;
      j.stride += j.v * dt * (Math.PI / j.strideLength());
      if (dansLeSable && !e.empreinte) {
        e.empreinte = { x: LIGNE + FOSSE.debut + 0.05, y: PISTE_Y, variante: 'course', age: 0 };
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

/** Les talons touchent le sable : le saut est fait, il reste a le mesurer. */
function contact() {
  const j = SprinterApp.G.player;
  const a = e.appel, v = e.vol;
  const avance = v.tRamene == null ? null : v.duree - v.tRamene;
  const r = sauter({
    vElan: a.vElan, ecart: a.ecart, angle: a.angle, avance,
    ciseau: v.ciseaux >= CISEAU_APPUIS, vent: e.vent,
  });
  r.raison = r.mordu ? 'planche' : null;
  e.resultat = r;
  const variante = VARIANTE[r.ramene] || 'avant';
  // LA TRACE que le juge mesure : depuis la pointe du pied d'appel, tout ce
  // que le saut a valu. Mordu ou non, le sable la garde.
  const trace = a.orteil + r.depuisPointe;
  const y = PISTE_Y + (Math.sin(trace * 7.3) * 0.08);
  e.empreinte = { x: trace, y, variante, age: 0 };
  const talonX = trace + TALONS[variante];
  e.gerbe = { x: talonX, y, t: 0, force: Math.max(0.6, Math.min(1.25, v.vx / 9)) };
  e.reception = {
    t: 0, x: j.d, variante, talonX, mordu: r.mordu,
    hz0: (v.hauteur(v.duree) - 0.08) * (SprinterCore.C.MODEL_H / j.look.h),
  };
  e.phase = 'reception'; e.t = 0;
  SprinterApp.Audio_.sfx && SprinterApp.Audio_.sfx('trip');
  annoncer({ type: 'contact', resultat: r });
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
  const etroit = G.portrait ? 1 : 0.35;
  let avance = 1.2, cote = 0.8;
  if (e.phase === 'repos' || e.phase === 'attente') {
    avance = 2.5 + 2.5 * etroit; cote = 1.2;
  } else if (e.phase === 'elan' || e.phase === 'traverse') {
    // plus il approche, plus la planche et le sable entrent dans le cadre
    const k = lisse((j.d - (LIGNE - 16)) / 12);
    avance = 2.5 + 2.5 * etroit + k * (1.5 + 1.5 * etroit);
    cote = 1.2;
  } else if (e.phase === 'appel' || e.phase === 'vol') {
    avance = 3.0 + 2.0 * etroit; cote = 1.0;
  } else if (e.phase === 'reception') {
    return [Math.max(j.d, e.reception.x) + 0.6 + 0.8 * etroit, PISTE_Y + 0.8];
  }
  return [j.d + avance, PISTE_Y + cote];
}

function zoomVise() {
  if (!e) return 1;
  const j = SprinterApp.G.player;
  switch (e.phase) {
    case 'repos': case 'attente': return 1.45;
    case 'elan': return 1.20 + 0.35 * lisse((j.d - (LIGNE - 12)) / 10);
    case 'appel': return 1.62;
    case 'vol': return 1.58;
    case 'reception': return e.reception.t < 1.6 ? 1.72 : 1.55;
    default: return 1.45;
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
  const [x, y] = viseCamera();
  G.camX = x; G.camY = y;
}

/* ------------------------------------------------- la jauge des paves */

/**
 * CE QUE MONTRENT LES PAVES, avec la regle de Hurdlers : on agit quand c'est
 * plein. Pendant l'elan, la jauge monte vers la ligne — on appuie. Pendant
 * l'impulsion, elle monte vers le bon angle — on relache. En l'air, elle
 * monte vers le ramene — les deux pouces.
 *
 * Les couleurs viennent des memes regles que le jugement : un ecran qui
 * recalculerait les siennes finirait par mentir.
 */
function jauge() {
  if (!e) return null;
  const j = SprinterApp.G.player;
  if (e.phase === 'elan') {
    const ecart = LIGNE - (j.d + AVANCE_PIED);
    if (ecart > 7) return null;
    const zone = ecart > APPEL_MAXI ? 'plane' : ecart > 0.20 ? 'bon' : ecart >= 0 ? 'parfait' : 'hache';
    return { cote: null, lesDeux: true, part: Math.max(0, Math.min(1, 1 - ecart / 7)), zone };
  }
  if (e.phase === 'appel') {
    const a = e.appel.angle;
    const zone = a < 17 ? 'plane' : a < 19 ? 'bon' : a <= 24 ? 'parfait' : a <= 27 ? 'bon' : 'hache';
    return { cote: e.appel.cote, lesDeux: false, part: Math.min(1, (a - ANGLE_MIN) / (21.5 - ANGLE_MIN)), zone };
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
    case 'elan': return LIGNE - (j.d + AVANCE_PIED) < 7 ? 'saut_c_appel' : 'alternate';
    case 'appel': return 'saut_c_angle';
    case 'vol': return e.vol.tRamene == null ? 'saut_c_ramene' : null;
    default: return null;
  }
}

/** Les paves se montrent-ils ? Seulement quand on a quelque chose a y faire. */
export function pavesDuSaut() {
  if (!e) return true;
  return e.phase === 'attente' || e.phase === 'elan' || e.phase === 'appel' || e.phase === 'vol';
}
