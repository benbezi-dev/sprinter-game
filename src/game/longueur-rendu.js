/* ---------------------------------------------------------------------------
   JUMPER — le saut en longueur, dessine
   ---------------------------------------------------------------------------
   Deux choses vivent ici, et rien d'autre : la POSTURE de l'athlete, calculee
   a chaque image a partir de ce que le joueur a fait, et le DESSIN de
   l'installation — piste d'elan, planche, plasticine, fosse, empreintes,
   gerbe, juge. Les regles sont dans longueur-jeu.js ; ce qui les relie au
   moteur, dans longueur-course.js.

   LA POSTURE SE CALCULE, ELLE NE SE LIT PAS DANS UNE TABLE. La haie en a une
   parce que son geste est toujours le meme. Un saut en longueur non : le pied
   reste sur la planche le temps que le joueur tient, les jambes se tendent
   devant quand il le decide, et ce qui se passe dans le sable depend de ce
   qu'il a fait des deux. Les jambes se posent donc par cinematique inverse —
   la cuisse et la jambe du rig, du bassin jusqu'a la cheville qu'on vise —,
   comme les blocs de depart : un pied plante sur la planche y reste, un talon
   plante dans le sable ne glisse pas quand le bassin passe au-dessus.

   LE SABLE VIENT DE BLENDER (tools/blender/longueur/sable.py) : la fosse
   ratissee, les empreintes, la gerbe. Rien n'y est indispensable — tant
   qu'une image n'est pas chargee, un dessin plus simple la remplace.
--------------------------------------------------------------------------- */

import { FOSSE, PISTE_ELAN, PLANCHE, PLASTICINE } from './longueur.js';
import { RAMENE_VISE, AVANCE_PIED } from './longueur-jeu.js';
import MANIFESTE from './longueur-manifeste.json';

/* ------------------------------------------------------------ le rig */

// Les longueurs du rig (sprinter-core.js) : cuisse, jambe, hauteur de la
// cheville au-dessus de la semelle, et le pivot des cuisses debout.
const CUISSE = 0.392, JAMBE = 0.380, CHEVILLE = 0.07, PIVOT = 0.85;
const DEBOUT_Z = 0.87;

const lisse = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const mix2 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];

/**
 * Deux segments, du pivot a la cible : les deux angles absolus du rig
 * (0 vers le bas, positif vers l'avant), genou devant. C'est deuxSegments()
 * de sprinter-core.js, reecrit ici parce qu'il vit dans sa fermeture.
 */
function ik(px, pz, tx, tz, a = CUISSE, b = JAMBE) {
  const dx = tx - px, dz = tz - pz;
  const d = Math.min(Math.max(Math.hypot(dx, dz), Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const base = Math.atan2(dx, -dz);
  const c = (a * a + d * d - b * b) / (2 * a * d);
  const t1 = base + Math.acos(Math.max(-1, Math.min(1, c)));
  const kx = px + a * Math.sin(t1), kz = pz - a * Math.cos(t1);
  return [t1, Math.atan2(tx - kx, -(tz - kz))];
}

/** Une jambe dont la cheville vise (x, z), en unites du rig, depuis le bassin. */
function jambeVers(hanche, hz, x, z, pied) {
  const [t, s] = ik(hanche, hz - 0.02, x, z);
  return [t, s, pied];
}

/**
 * LA POSTURE, image par image.
 *
 * `e` est l'etat du saut (longueur-course.js) ; `r` le coureur ; `ech` le
 * nombre d'unites du rig par metre (MODEL_H / taille). Rend l'objet que pose()
 * lit sur `r.posture`, ou null quand l'athlete court simplement.
 */
export function postureDe(e, r, ech) {
  const P = e.posture || (e.posture = { w: 0, jambes: [[0, 0, 0], [0, 0, 0]], bras: [[0, 0], [0, 0]],
                                        buste: 0, leve: 0, hanche: 0 });
  const A = e.jambeAppel || 0;        // l'index de la jambe d'appel
  const B = 1 - A;
  const J = P.jambes, BR = P.bras;
  P.hanche = 0;
  // La tete, que le rig sait pencher (positif : en arriere) : droite en
  // course, un rien renversee dans la suspension, rentree pour le canif.
  r.tete = 0;

  switch (e.phase) {
    case 'attente': {
      // En attente sur la marque : un pied devant, l'autre sur la pointe,
      // le buste qui se penche. Il se balance a peine.
      const b = 0.012 * Math.sin(e.horlogeT * 2.2);
      J[A] = [0.14, 0.03, 0.05];
      J[B] = [-0.20, -0.46, -0.55];
      BR[A] = [-0.30, 0.10];
      BR[B] = [0.28, 0.85];
      P.buste = -0.16 + b;
      P.leve = -0.03 + b * 0.5;
      P.w = 1;
      return P;
    }
    case 'elan': {
      // Il vient de partir : la posture s'efface en deux dixiemes.
      P.w = Math.max(0, 1 - e.t / 0.22);
      return P.w > 0 ? P : null;
    }
    case 'traverse':
      return null;
    case 'appel':
    case 'pose': {
      // LE PIED EST PLANTE ET N'EN BOUGE PLUS — sur la planche, ou sur la
      // piste entre deux bonds du triple saut. Le bassin passe au-dessus : de
      // trente-cinq centimetres derriere la pointe a vingt-cinq devant.
      // Au-dela du bon maintien, il s'ecrase — le genou plie, la vitesse part
      // dans le sol, et cela doit se voir. Une pose qui attend l'appui en
      // retard reste au debut de ce mouvement, jambe qui plie sous le poids.
      const a = e.phase === 'pose'
        ? { orteil: e.pose.orteil, u: 0.12 * Math.min(1, e.pose.t / 0.3), charge: Math.min(1, e.pose.t / 0.3) * 0.6 }
        : e.appel;
      const u = a.u, charge = a.charge;
      const hz = mix(0.82, 0.96, lisse(u)) - 0.10 * charge;
      const pointe = (a.orteil - r.d) * ech;
      const cheville = pointe - 0.16;
      const pied = mix(0.12, -0.95, lisse(u));
      const zCh = mix(CHEVILLE, 0.13, lisse(u));
      J[A] = jambeVers(0, hz, cheville, zCh, pied);
      // La jambe libre part de derriere, pliee, et monte genou devant.
      J[B] = mix3([-0.40, -1.70, -1.30], [1.45, 0.25, 0.35], lisse(u * 1.15));
      BR[A] = mix2([-0.60, -0.10], [2.30, 2.70], lisse(u * 1.1));
      BR[B] = mix2([0.70, 1.30], [-0.75, -0.30], lisse(u * 1.1));
      P.buste = mix(0.12, -0.04, u) + 0.20 * charge;
      P.leve = hz - DEBOUT_Z;
      P.w = 1;
      return P;
    }
    case 'vol': {
      const v = e.vol;
      const t = v.t, T = v.duree;
      if (v.pose) return postureBond(P, v, A, B, ech);
      // Le bassin suit le centre de masse, un peu en dessous de lui : bras
      // leves et genou haut, le centre de masse sort du bassin au decollage,
      // et y rentre jambes tendues devant.
      const zCM = v.hauteur(t);
      const sous = mix(0.20, 0.08, t / T);
      const hz = (zCM - sous) * ech;
      P.leve = hz - DEBOUT_Z;
      // Au decollage, la posture de l'appel ; puis le ciseau ou la
      // suspension ; puis, si le joueur l'a demande, le ramene.
      const sortie = lisse(t / 0.12);
      const depart = {
        a: [-0.45, -0.52, -0.95], b: [1.45, 0.25, 0.35],
        ba: [2.30, 2.70], bb: [-0.75, -0.30],
      };
      let ja, jb, ba, bb, buste;
      if (v.ciseaux > 0) {
        // LE CISEAU — le « hitch-kick » des sauteurs : ils COURENT en l'air.
        // Chaque appui du joueur avance le cycle d'un demi-tour ; c'est une
        // foulee complete, pas un battement. Une jambe part tendue derriere,
        // revient genou replie, talon sous la fesse, se deplie devant, puis
        // balaie vers le bas, tendue. L'autre fait la meme chose a l'oppose.
        const phi = v.phase;
        const jambe = (q) => {
          const s = Math.sin(q), c = Math.cos(q);
          // la cuisse : de soixante centimetres derriere a franchement devant
          const th = 0.30 + 0.90 * s;
          // le genou se replie quand la jambe revient vers l'avant (c > 0),
          // et reste tendu quand elle balaie vers l'arriere
          const plie = 0.18 + 1.45 * Math.pow(Math.max(0, c), 1.4);
          const sh = th - plie;
          return [th, sh, sh + 0.30 + 0.25 * Math.max(0, -c)];
        };
        ja = jambe(phi - Math.PI / 2);
        jb = jambe(phi + Math.PI / 2);
        // LES BRAS TOURNENT, ILS NE BATTENT PAS. De grands moulinets, un bras
        // a l'oppose de l'autre, le coude a peine flechi, et DANS LE SENS DES
        // JAMBES : ils passent par-dessus la tete de l'arriere vers l'avant,
        // comme le genou qui revient. C'est ce qui retient le sauteur de
        // basculer en avant — la raison d'etre du ciseau. Battus de haut en
        // bas, en miroir, ils faisaient un papillon.
        // L'angle est ramene dans un tour pour que le ramene qui suit ne
        // les fasse pas tourner plusieurs fois sur eux-memes.
        const tour = (a) => { const T = Math.PI * 2; return ((a + 1.2) % T + T) % T - 1.2; };
        const moulinet = (a) => { const x = tour(a); return [x, x + 0.22 + 0.12 * Math.sin(x)]; };
        ba = moulinet(2.30 - phi);
        bb = moulinet(2.30 - phi + Math.PI);
        // le buste reste droit, un rien en arriere, et suit le rythme
        buste = -0.08 - 0.04 * Math.sin(phi);
      } else {
        // LA SUSPENSION, telle qu'on la voit aux grands concours : le corps
        // s'OUVRE. La jambe libre, lancee genou haut a l'appel, redescend
        // rejoindre l'autre derriere le bassin, genoux plies ; les bras font le
        // tour par-dessus la tete et passent DERRIERE elle ; la poitrine
        // s'ouvre, les hanches passent devant. C'est un arc tendu de la main
        // au pied, pas un athlete debout les bras en l'air. Le bras qui etait
        // devant monte le premier, l'autre le rejoint par l'avant : un moulinet,
        // pas deux bras qui se levent ensemble.
        const k = lisse((t - 0.04) / 0.30);
        const k2 = lisse((t - 0.10) / 0.32);
        ja = mix3(depart.a, [-0.30, -1.55, -1.20], k);
        jb = mix3(depart.b, [-0.08, -1.40, -1.10], lisse((t - 0.02) / 0.34));
        ba = mix2(depart.ba, [3.55, 3.85], k);
        bb = k2 < 0.5
          ? mix2(depart.bb, [1.55, 1.75], k2 * 2)
          : mix2([1.55, 1.75], [3.45, 3.72], (k2 - 0.5) * 2);
        buste = mix(-0.04, 0.24, k);
        P.hanche = 0.05 * k;
      }
      ja = mix3(depart.a, ja, sortie);
      jb = mix3(depart.b, jb, sortie);
      ba = mix2(depart.ba, ba, sortie);
      bb = mix2(depart.bb, bb, sortie);
      // LE RAMENE — le canif. Les jambes montent tendues devant, le buste se
      // plie au-dessus d'elles, et les bras, partis de derriere la tete,
      // balaient vers l'avant puis vers le bas : ils passent devant les genoux
      // au moment ou les talons cherchent le sable, et finiront derriere les
      // hanches a l'impact. L'angle des jambes se deduit de la hauteur du
      // bassin a la reception : les talons touchent pile au contact.
      if (v.tRamene != null) {
        const k = lisse((t - v.tRamene) / 0.20);
        const bal = lisse((t - v.tRamene) / 0.30);
        const hzC = (v.hauteur(T) - 0.08) * ech;
        const th = Math.acos(Math.max(-1, Math.min(1, (hzC - 0.02 - CHEVILLE) / (CUISSE + JAMBE))));
        const leve = Math.max(th, 1.50 - 0.35 * lisse(t / T));
        const tendue = [leve, leve + 0.04, leve + 0.55];
        ja = mix3(ja, tendue, k);
        jb = mix3(jb, [leve - 0.05, leve, leve + 0.50], k);
        // les bras : de derriere la tete a devant, puis vers le bas
        const bras = bal < 0.6 ? mix2([3.3, 3.55], [1.55, 1.65], bal / 0.6) : mix2([1.55, 1.65], [0.75, 0.95], (bal - 0.6) / 0.4);
        ba = mix2(ba, bras, k);
        bb = mix2(bb, [bras[0] - 0.08, bras[1] - 0.08], k);
        buste = mix(buste, -0.66, k);
        P.hanche = mix(P.hanche || 0, 0, k);
      }
      J[A] = ja; J[B] = jb; BR[A] = ba; BR[B] = bb;
      P.buste = buste;
      r.tete = v.ciseaux > 0 ? 0.05 : 0.22 * lisse((t - 0.05) / 0.3);
      if (v.tRamene != null) r.tete = mix(r.tete, -0.38, lisse((t - v.tRamene) / 0.2));
      P.w = 1;
      return P;
    }
    case 'reception': {
      const c = e.reception;
      const tau = c.t;
      // Les talons restent plantes ou ils sont entres : on vise leur place
      // dans le sable, quelle que soit celle du bassin.
      const talon = (c.talonX - r.d) * ech;
      const assis = c.variante === 'assis';
      const pieds = c.variante === 'pieds';
      // Trois temps : on tombe (0 - 0,35 s), on se tient (0,35 - 0,9 s), on se
      // releve (0,9 - 1,7 s).
      const tombe = lisse(tau / 0.35), releve = lisse((tau - 0.9) / 0.8);
      let hz, buste, bras;
      if (assis) {
        hz = mix(c.hz0, 0.20, tombe);
        buste = mix(-0.40, 0.95, tombe);
        bras = [[-1.05, -0.80], [-1.10, -0.85]];
      } else if (pieds) {
        // PIEDS SOUS LE BASSIN : les jambes ne sont pas venues devant, les
        // pieds touchent sous lui. Il encaisse en accroupi profond, le buste
        // penche mais pas couche, les bras devant pour ne pas partir en
        // avant — pas un plongeon tete la premiere.
        hz = mix(c.hz0, 0.44, tombe);
        buste = mix(-0.40, -0.62, tombe);
        bras = [[0.95, 1.20], [0.90, 1.15]];
      } else {
        // A l'impact, les bras filent derriere les hanches — c'est ce qui fait
        // passer le corps par-dessus les talons —, puis reviennent devant a
        // mesure qu'il se redresse.
        hz = mix(c.hz0, 0.30, tombe);
        buste = mix(-0.66, -0.95, tombe);
        const re = lisse((tau - 0.35) / 0.45);
        bras = [mix2([-0.85, -0.55], [1.10, 1.40], re), mix2([-0.90, -0.60], [1.05, 1.35], re)];
      }
      let ja, jb;
      if (pieds) {
        // Accroupi, les pieds a plat sous lui : les genoux plient, les talons
        // restent ou ils sont entres.
        ja = jambeVers(0, hz, talon + 0.06, CHEVILLE, 0.05);
        jb = jambeVers(0, hz, talon - 0.02, CHEVILLE, 0.05);
      } else {
        const pied = assis ? 0.55 : mix(0.55, 0.10, tombe);
        ja = jambeVers(0, hz, talon, CHEVILLE, pied);
        jb = jambeVers(0, hz, talon - 0.03, CHEVILLE, pied);
      }
      // Se relever : debout, les bras le long du corps.
      if (releve > 0) {
        hz = mix(hz, DEBOUT_Z - 0.02, releve);
        buste = mix(buste, -0.05, releve);
        ja = mix3(ja, [0.05, 0.02, 0.0], releve);
        jb = mix3(jb, [-0.05, -0.08, -0.05], releve);
        bras = [mix2(bras[0], [0.05, 0.25], releve), mix2(bras[1], [-0.05, 0.20], releve)];
      }
      J[A] = ja; J[B] = jb; BR[A] = bras[0]; BR[B] = bras[1];
      P.buste = buste;
      P.leve = hz - DEBOUT_Z;
      // Il sort de la fosse en marchant : la foulee reprend la main.
      P.w = 1 - lisse((tau - 1.75) / 0.35);
      return P.w > 0 ? P : null;
    }
    default: {
      P.w = 0;
      return null;
    }
  }
}

/**
 * LES DEUX PREMIERS BONDS DU TRIPLE SAUT.
 *
 * LE CLOCHE-PIED retombe sur la jambe d'appel : elle part tendue derriere,
 * revient sous le bassin talon a la fesse — le cycle, le geste qu'on
 * reconnait de loin — et se tend devant pour griffer le sol. La jambe libre,
 * elle, repart derriere et y reste.
 *
 * LA FOULEE BONDISSANTE retombe sur l'autre : c'est une foulee figee en
 * l'air, genou libre haut devant, jambe d'appel tendue derriere, tenue le
 * plus longtemps possible, puis la jambe avant descend chercher le sol.
 *
 * Les bras travaillent ensemble, vers l'arriere puis vers l'avant : c'est le
 * double bras des triple-sauteurs, qui equilibre des bonds qu'aucune foulee
 * ne relie.
 */
function postureBond(P, v, A, B, ech) {
  const J = P.jambes, BR = P.bras;
  const u = Math.max(0, Math.min(1, v.t / v.duree));
  const zCM = v.hauteur(v.t);
  const hz = (zCM - mix(0.20, 0.12, u)) * ech;
  P.leve = hz - DEBOUT_Z;
  const appel = [-0.45, -0.52, -0.95], genou = [1.45, 0.25, 0.35];
  const griffe = [0.45, 0.30, 0.25];
  if (v.bond === 0) {
    const cycle = [0.55, -0.85, -0.50];
    J[A] = u < 0.45 ? mix3(appel, cycle, lisse(u / 0.45)) : mix3(cycle, griffe, lisse((u - 0.45) / 0.5));
    J[B] = mix3(genou, [-0.28, -1.28, -1.0], lisse(u / 0.6));
    const arriere = [-0.70, -0.30], avant = [1.20, 1.55];
    BR[A] = u < 0.5 ? mix2([2.30, 2.70], arriere, lisse(u / 0.5)) : mix2(arriere, avant, lisse((u - 0.5) / 0.45));
    BR[B] = u < 0.5 ? mix2([-0.75, -0.30], arriere, lisse(u / 0.5)) : mix2(arriere, avant, lisse((u - 0.5) / 0.45));
    P.buste = mix(-0.02, -0.10, u);
  } else {
    J[A] = mix3(appel, [-0.55, -1.20, -1.00], lisse(u / 0.4));
    J[B] = u < 0.65 ? mix3(genou, [1.40, 0.15, 0.30], lisse(u / 0.3))
      : mix3([1.40, 0.15, 0.30], griffe, lisse((u - 0.65) / 0.3));
    BR[A] = mix2([2.10, 2.50], [1.20, 1.50], lisse((u - 0.55) / 0.4));
    BR[B] = mix2([-0.60, -0.20], [1.10, 1.45], lisse((u - 0.45) / 0.5));
    P.buste = -0.06;
  }
  P.w = 1;
  return P;
}

/* ----------------------------------------------------------- les images */

const BASE = (typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.BASE_URL : '/').replace(/\/$/, '');
// Les images du sable voyagent avec ce module, et avec lui seul : importees
// ici, elles sortent du build public avec lui (canal.ts, LONGUEUR_OUVERTE).
const FICHIERS = import.meta.glob('../assets/longueur/*.webp',
  { eager: true, query: '?url', import: 'default' });
const images = new Map();
function image(f) {
  if (!f) return null;
  let im = images.get(f);
  if (!im) {
    const url = FICHIERS['../assets/longueur/' + f];
    if (!url) return null;
    im = new Image();
    im.decoding = 'async';
    im.src = url.startsWith('http') || url.startsWith('/') || url.startsWith('data:') ? url : BASE + '/' + url;
    images.set(f, im);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}

/** Le sable du stade : celui de la Terre, ou la poussiere d'etoiles. */
function sableDu(th) {
  return th && th.espace ? 'cosmos' : 'terre';
}

/** Precharger les images du stade, pour qu'elles soient la au premier saut. */
export function prechargerSable(th) {
  const s = sableDu(th);
  const f = MANIFESTE.fosse && MANIFESTE.fosse[s];
  if (f) image(f.f);
  const e = MANIFESTE.empreintes && MANIFESTE.empreintes[s];
  if (e) for (const k in e) image(e[k].f);
  const g = MANIFESTE.gerbe && MANIFESTE.gerbe[s];
  if (g) image(g.f);
}

/* ------------------------------------------------------------ le dessin */

const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/** Un quadrilatere a plat sur le sol, en metres du jeu. */
function dalle(ctx, api, x0, y0, x1, y1, fill, z = 0) {
  const s = api.solid;
  const a = s(x0, y0, z), b = s(x1, y0, z), c = s(x1, y1, z), d = s(x0, y1, z);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function trait(ctx, api, x0, y0, x1, y1, style, largeur, z = 0) {
  const a = api.solid(x0, y0, z), b = api.solid(x1, y1, z);
  ctx.strokeStyle = style;
  ctx.lineWidth = largeur;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}

/** Une image vue d'aplomb, plaquee sur le sol : `x0, y0` son coin, en metres. */
function plaquer(ctx, api, im, x0, y0, mw, alpha = 1) {
  const o = api.ground(x0, y0), ex = api.ground(x0 + 1, y0), ey = api.ground(x0, y0 + 1);
  const k = im.naturalWidth / mw;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.transform((ex[0] - o[0]) / k, (ex[1] - o[1]) / k, (ey[0] - o[0]) / k, (ey[1] - o[1]) / k, o[0], o[1]);
  ctx.drawImage(im, 0, 0);
  ctx.restore();
}

/**
 * L'INSTALLATION, a plat : piste d'elan, planche, plasticine, fosse, et ce
 * que les sauts y ont laisse. Appelee sous les ombres (drawAthletes).
 */
export function dessinerSol(ctx, api, e, th) {
  const L = e.ligne, Y = e.pisteY;
  const m = api.scaleM();
  const demi = PISTE_ELAN.largeur / 2;
  const tartan = th && th.trackA ? th.trackA : [138, 10, 10];
  const blanc = th && th.lane ? th.lane : [246, 242, 234];
  ctx.save();
  ctx.lineCap = 'round';

  // LA PISTE D'ELAN : quarante-cinq metres de tartan, jusqu'au sable.
  const planches = e.planches || [{ x: L, actif: true }];
  const debut = Math.min(...planches.map(p => p.x)) - PISTE_ELAN.recommandee;
  const sable0 = e.fosseX != null ? e.fosseX : L + FOSSE.debut;
  // La fosse se lit depuis le debut du sable : c'est lui qui est fixe, les
  // planches se placent devant lui.
  const F0 = sable0 - FOSSE.debut, fondX = F0 + FOSSE.fond;
  dalle(ctx, api, debut, Y - demi, sable0, Y + demi, rgb(tartan));
  const lw = Math.max(1, 0.05 * m);
  trait(ctx, api, debut, Y - demi, sable0, Y - demi, rgb(blanc, 0.9), lw);
  trait(ctx, api, debut, Y + demi, sable0, Y + demi, rgb(blanc, 0.9), lw);
  // La marque de l'athlete, au bord de la piste, la ou il se place : un
  // adhesif de couleur, comme ceux que les sauteurs collent eux-memes.
  const marque = e.depart;
  dalle(ctx, api, marque - 0.05, Y + demi + 0.04, marque + 0.05, Y + demi + 0.34,
        rgb(th && th.accent ? th.accent : [240, 158, 46]));

  // LES PLANCHES, chacune suivie de sa plasticine. Celle du saut en longueur
  // et celle du triple saut sont sur la meme piste, et on voit les deux ; on
  // ne s'appelle que sur celle de l'epreuve.
  for (const p of planches) {
    const X = p.x;
    dalle(ctx, api, X - PLANCHE.largeur, Y - PLANCHE.longueur / 2, X, Y + PLANCHE.longueur / 2,
          p.actif ? 'rgb(244,246,250)' : 'rgba(236,238,242,0.78)', 0.004);
    trait(ctx, api, X, Y - PLANCHE.longueur / 2, X, Y + PLANCHE.longueur / 2,
          'rgba(40,40,48,0.35)', Math.max(1, 0.012 * m), 0.005);
    dalle(ctx, api, X, Y - PLANCHE.longueur / 2, X + PLASTICINE.largeur, Y + PLANCHE.longueur / 2,
          p.actif ? 'rgb(214,206,168)' : 'rgba(170,166,150,0.8)', 0.004);
  }
  // Le pied mordu y laisse sa pointe : c'est ce que le juge regarde.
  if (e.traceMordue != null && e.traceMordue > L && e.traceMordue < L + PLASTICINE.largeur + 0.3) {
    const x = Math.min(L + PLASTICINE.largeur - 0.01, e.traceMordue);
    const cy = Y + (e.jambeAppel ? 0.08 : -0.08);
    dalle(ctx, api, L + 0.004, cy - 0.045, x, cy + 0.045, 'rgba(92,80,60,0.75)', 0.006);
  }

  // LA FOSSE. L'image Blender si elle est la, un aplat sinon.
  const s = sableDu(th);
  const mf = MANIFESTE.fosse && MANIFESTE.fosse[s];
  const imF = mf && image(mf.f);
  if (imF) {
    plaquer(ctx, api, imF, F0 + mf.x0, Y + mf.y0, mf.mw);
  } else {
    const b = 0.12, w = FOSSE.largeur / 2;
    dalle(ctx, api, sable0 - b, Y - w - b, fondX + b, Y + w + b, 'rgb(196,194,188)');
    dalle(ctx, api, sable0, Y - w, fondX, Y + w,
          s === 'cosmos' ? 'rgb(184,170,206)' : 'rgb(222,190,138)', 0.002);
  }

  // LES LIGNES DE LA TELEVISION, tracees dans le sable : ce qu'il faut
  // sauter pour prendre la tete, et le record du monde quand il tombe dans
  // la fosse. On les lit sans quitter l'athlete des yeux.
  const w = FOSSE.largeur / 2;
  for (const l of e.lignes || []) {
    const x = L + l.m;
    if (x < sable0 || x > fondX) continue;
    ctx.setLineDash([Math.max(3, 0.18 * m), Math.max(2, 0.10 * m)]);
    trait(ctx, api, x, Y - w, x, Y + w, l.couleur, Math.max(1.5, 0.04 * m), 0.01);
    ctx.setLineDash([]);
    const p = api.solid(x, Y + w + 0.15, 0);
    ctx.font = `700 ${Math.max(9, Math.round(0.30 * m))}px ui-monospace, monospace`;
    ctx.fillStyle = l.couleur;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(l.texte, p[0] + 2, p[1]);
  }

  // L'EMPREINTE du dernier saut, posee sur la marque : sa trace la plus
  // proche de la ligne tombe exactement la ou le juge mesure.
  const emp = e.empreinte;
  if (emp) {
    const me = MANIFESTE.empreintes && MANIFESTE.empreintes[s] && MANIFESTE.empreintes[s][emp.variante];
    const im = me && image(me.f);
    const a = lisse(emp.age / 0.18);
    if (im) {
      plaquer(ctx, api, im, emp.x + (me.x0 - me.trace), emp.y + me.y0, me.mw, a);
    } else {
      ctx.save();
      ctx.globalAlpha = 0.45 * a;
      dalle(ctx, api, emp.x, emp.y - 0.16, emp.x + 0.35, emp.y + 0.16, 'rgb(120,96,60)', 0.003);
      ctx.restore();
    }
  }
  // Le decametre du juge, de la marque a la ligne, le temps de la mesure.
  if (e.mesure && e.mesure.a > 0) {
    ctx.save();
    ctx.globalAlpha = e.mesure.a;
    trait(ctx, api, L, Y - w - 0.25, e.mesure.x, Y - w - 0.25, 'rgba(250,214,60,0.95)',
          Math.max(1.5, 0.035 * m), 0.01);
    trait(ctx, api, e.mesure.x, Y - w - 0.25, e.mesure.x, e.mesure.y, 'rgba(250,214,60,0.95)',
          Math.max(1, 0.02 * m), 0.01);
    ctx.restore();
  }
  ctx.restore();
}

/* ------------------------------------------------ ce qui se tient debout */

/**
 * Les pieces a ranger parmi les athletes : la gerbe, l'arc de l'angle, le
 * juge. Chacune avec sa profondeur.
 */
export function piecesDebout(e, api, out) {
  out.length = 0;
  const Y = e.pisteY;
  if (e.gerbe) {
    const g = e.gerbe;
    // un rien devant le point d'impact : le sable vole devant l'athlete
    out.push({ profondeur: api.depthOf(g.x + 0.05, g.y - 0.05), sorte: 'gerbe' });
  }
  if (e.phase === 'appel' || (e.phase === 'vol' && e.vol.t < 0.35)) {
    out.push({ profondeur: -1e9, sorte: 'angle' });
  }
  out.push({ profondeur: api.depthOf(e.ligne + 0.4, Y - 2.3), sorte: 'juge' });
  // LES PANNEAUX DE DISTANCE, debout le long du sable cote tribune, un par
  // metre depuis la planche qui sert : c'est ce que lit le public, et ce que
  // lit la television pour situer un saut avant la mesure.
  const pl = (e.planches || []).find(p => p.actif) || { x: e.ligne };
  const fin = e.fosseX + (FOSSE.fond - FOSSE.debut);
  const yP = Y + FOSSE.largeur / 2 + 0.55;
  for (let m = Math.ceil(e.fosseX - pl.x + 0.3); pl.x + m <= fin - 0.2; m++) {
    out.push({ profondeur: api.depthOf(pl.x + m, yP), sorte: 'panneau', x: pl.x + m, y: yP, m });
  }
  // Les officiels assis derriere le sable : celui qui tient le decametre, et
  // celui qui note. Ils sont la a chaque saut, comme au stade.
  for (const [i, dx] of [[0, 2.2], [1, 6.4]]) {
    const x = e.fosseX + dx, y = Y + FOSSE.largeur / 2 + 2.1;
    out.push({ profondeur: api.depthOf(x, y), sorte: 'officiel', x, y, i });
  }
  return out;
}

export function dessinerPiece(ctx, api, e, pc, th, A) {
  if (pc.sorte === 'gerbe') dessinerGerbe(ctx, api, e, th);
  else if (pc.sorte === 'angle') dessinerAngle(ctx, api, e, A);
  else if (pc.sorte === 'juge') dessinerJuge(ctx, api, e, A);
  else if (pc.sorte === 'panneau') dessinerPanneau(ctx, api, pc);
  else if (pc.sorte === 'officiel') dessinerOfficiel(ctx, api, e, pc, A);
}

/** Un panneau de distance : une plaque noire, un chiffre blanc, deux pieds. */
function dessinerPanneau(ctx, api, pc) {
  const { x, y, m: metres } = pc;
  const m = api.scaleM();
  const o = api.solid(x, y, 0);
  if (o[0] < -100 || o[0] > api.G.VW + 100 || o[1] < -100 || o[1] > api.G.VH + 150) return;
  const l = 0.34, z0 = 0.16, z1 = 0.62;
  const a = api.solid(x - l, y, z0), b = api.solid(x + l, y, z0);
  const c = api.solid(x + l, y, z1), d = api.solid(x - l, y, z1);
  ctx.save();
  // les pieds
  ctx.strokeStyle = 'rgb(70,72,80)';
  ctx.lineWidth = Math.max(1, 0.03 * m);
  for (const dx of [-l * 0.7, l * 0.7]) {
    const p0 = api.solid(x + dx, y, 0), p1 = api.solid(x + dx, y, z0);
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
  }
  // la plaque, et son liseré
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
  ctx.closePath();
  ctx.fillStyle = 'rgb(18,20,26)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, 0.012 * m);
  ctx.stroke();
  // le chiffre, couche dans le plan de la plaque
  const ux = (b[0] - a[0]) / (2 * l), uy = (b[1] - a[1]) / (2 * l);
  const vx = (d[0] - a[0]) / (z1 - z0), vy = (d[1] - a[1]) / (z1 - z0);
  const cx = (a[0] + c[0]) / 2, cy = (a[1] + c[1]) / 2;
  // Le texte se lit de gauche a droite A L'ECRAN : la piste avance vers le
  // haut a gauche, il court donc a rebours d'elle, et du haut vers le bas.
  ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([-ux, -uy, -vx, -vy, cx, cy])));
  ctx.fillStyle = 'rgb(248,248,244)';
  ctx.font = '900 0.34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(metres), 0, 0.01);
  ctx.restore();
}

/** Les officiels assis : blazer, pantalon, une chaise pliante. */
const TENUES = [
  { build: 'm', skin: 'ambre', jersey: [38, 70, 138], shorts: [70, 74, 84], pantalon: [70, 74, 84],
    shoe: [30, 30, 34], hair: 'crop', h: 1.76, civil: true },
  { build: 'f', skin: 'porcelaine', jersey: [38, 70, 138], shorts: [70, 74, 84], pantalon: [70, 74, 84],
    shoe: [30, 30, 34], hair: 'bun', h: 1.68, civil: true },
];
function dessinerOfficiel(ctx, api, e, pc, A) {
  const G = api.G, C = api.C, K = globalThis.SprinterCore;
  const g = api.ground(pc.x, pc.y);
  if (g[0] < -200 || g[0] > G.VW + 200 || g[1] < -260 || g[1] > G.VH + 200) return;
  const m = api.scaleM();
  const offs = e.officiels || (e.officiels = []);
  const o = offs[pc.i] || (offs[pc.i] = {
    look: K.look(TENUES[pc.i % TENUES.length]), stride: 0, v: 0, maxSpeed: 12, fallAnim: 0, celebrate: 0,
  });
  // ASSIS : cuisses a l'horizontale, jambes a la verticale, le bassin a la
  // hauteur d'une chaise ; les mains posees sur les cuisses, sauf quand le
  // saut retombe — alors celui qui tient le decametre se penche en avant.
  const penche = e.mesure ? 0.35 : 0;
  o.posture = { w: 1, jambes: [[1.52, 0.05, 0.30], [1.46, -0.02, 0.26]],
                bras: [[0.55, 1.35], [0.45, 1.30]], buste: -0.06 - penche, leve: -0.40, hanche: 0.05 };
  const k = m * (o.look.h / C.MODEL_H);
  ctx.save();
  // la chaise
  const s0 = api.solid(pc.x - 0.24, pc.y - 0.22, 0.46), s1 = api.solid(pc.x + 0.24, pc.y - 0.22, 0.46);
  const s2 = api.solid(pc.x + 0.24, pc.y + 0.22, 0.46), s3 = api.solid(pc.x - 0.24, pc.y + 0.22, 0.46);
  ctx.strokeStyle = 'rgb(120,124,132)';
  ctx.lineWidth = Math.max(1, 0.025 * m);
  for (const [dx, dy] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) {
    const p0 = api.solid(pc.x + dx, pc.y + dy, 0), p1 = api.solid(pc.x + dx, pc.y + dy, 0.46);
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
  }
  ctx.fillStyle = 'rgb(58,62,72)';
  ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.lineTo(s2[0], s2[1]); ctx.lineTo(s3[0], s3[1]);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(g[0], g[1], 14 * m / 30, 6 * m / 30, 0, 0, Math.PI * 2); ctx.fill();
  // tourne vers la piste d'elan, face a la camera
  const caps = A.personCapsules(o, -Math.PI / 2 + (api.rot || 0) - 0.35, 0, false, false, A.niveauDetail(k));
  A.drawFacetFigure(ctx, caps, g[0], g[1], k);
  ctx.restore();
}

function dessinerGerbe(ctx, api, e, th) {
  const g = e.gerbe;
  const s = sableDu(th);
  const mg = MANIFESTE.gerbe && MANIFESTE.gerbe[s];
  const im = mg && image(mg.f);
  const m = api.scaleM();
  const p = api.ground(g.x, g.y);
  const i = Math.floor(g.t * (mg ? mg.fps : 30));
  if (im && mg) {
    if (i >= mg.images) return;
    // Un rien plus grande que nature : a la taille ou le jeu montre la fosse,
    // une gerbe a l'echelle se lisait comme de la poussiere.
    const k = (m / mg.ppm) * g.force * 1.35;
    ctx.drawImage(im, i * mg.w, 0, mg.w, mg.h,
                  p[0] - mg.ax * k, p[1] - mg.ay * k, mg.w * k, mg.h * k);
    return;
  }
  // Sans l'image : quelques grains, pour que la reception ne soit pas muette.
  if (g.t > 0.45) return;
  ctx.save();
  ctx.fillStyle = s === 'cosmos' ? 'rgba(200,186,226,0.9)' : 'rgba(214,182,128,0.9)';
  for (let k = 0; k < 24; k++) {
    const a = (k * 2.399) % 6.283, v = 1.5 + (k % 5) * 0.6;
    const x = g.x + Math.cos(a * 0.3) * v * g.t * 1.4;
    const y = g.y + Math.sin(a) * 0.9 * v * g.t;
    const z = Math.max(0, (1.2 + (k % 3) * 0.5) * g.t - 4.9 * g.t * g.t);
    const q = api.solid(x, y, z);
    ctx.fillRect(q[0], q[1], Math.max(1.5, 0.03 * m), Math.max(1.5, 0.03 * m));
  }
  ctx.restore();
}

/**
 * L'ARC DE L'ANGLE, pendant l'impulsion : un eventail au-dessus de la planche,
 * le secteur des bons angles en vert, et l'aiguille qui monte avec le pouce.
 * C'est le meme chiffre que la jauge du pave, pose la ou l'oeil regarde deja.
 */
function dessinerAngle(ctx, api, e, A) {
  const angle = e.phase === 'appel' ? e.appel.angle : e.angleEnvol;
  if (angle == null) return;
  const m = api.scaleM();
  const x = e.appel.orteil, Y = e.pisteY;
  const o = api.solid(x, Y, 0.02);
  // l'eventail se dessine dans le plan vertical de la piste : avant = +X
  const R = 1.25;
  const pt = (deg, r) => {
    const a = deg * Math.PI / 180;
    return api.solid(x + Math.cos(a) * r, Y, Math.sin(a) * r);
  };
  const vise = e.angleVise || [19, 24];
  ctx.save();
  ctx.globalAlpha = e.phase === 'appel' ? 1 : Math.max(0, 1 - e.vol.t / 0.35);
  ctx.lineWidth = Math.max(1, 0.03 * m);
  // l'arc complet, pale
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  for (let d = 5; d <= 45; d += 2.5) { const q = pt(d, R); if (d === 5) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); }
  ctx.stroke();
  // le secteur juste
  ctx.fillStyle = 'rgba(74,222,128,0.35)';
  ctx.beginPath();
  ctx.moveTo(o[0], o[1]);
  for (let d = vise[0]; d <= vise[1] + 0.01; d += 0.5) { const q = pt(d, R); ctx.lineTo(q[0], q[1]); }
  ctx.closePath();
  ctx.fill();
  // l'aiguille
  const bon = angle >= vise[0] && angle <= vise[1];
  const loin = angle < vise[0] - 5 || angle > vise[1] + 5;
  const col = bon ? 'rgb(74,222,128)' : loin ? 'rgb(248,113,113)' : 'rgb(250,214,60)';
  const q = pt(angle, R * 1.12);
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(2, 0.06 * m);
  ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  ctx.font = `800 ${Math.max(11, Math.round(0.42 * m))}px ui-monospace, monospace`;
  ctx.fillStyle = col;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(angle)}°`, q[0] + 4, q[1] - 2);
  ctx.restore();
  void A;
}

/**
 * LE JUGE DE PLANCHE, de l'autre cote de la piste d'elan — derriere elle, vue
 * de profil : devant, il cacherait l'appel qu'il est la pour juger. Il leve le
 * drapeau blanc pour un essai valable, le rouge pour un essai mordu : c'est
 * le signal que tout le stade lit avant le tableau.
 */
function dessinerJuge(ctx, api, e, A) {
  const G = api.G, C = api.C;
  const X = e.ligne + 0.4, Y = e.pisteY - 2.3;
  const g = api.ground(X, Y);
  if (g[0] < -200 || g[0] > G.VW + 200 || g[1] < -260 || g[1] > G.VH + 200) return;
  const m = api.scaleM();
  const look = A.LOOK_STARTER;
  const k = m * (look.h / C.MODEL_H);
  const leve = e.drapeau ? lisse(e.drapeau.age / 0.35) : 0;
  const juge = e.juge || (e.juge = {
    look, stride: 0, v: 0, maxSpeed: 12, fallAnim: 0, celebrate: 0, pistolet: -1,
  });
  juge.bras = [0.10, 0.20 + (2.85 - 0.20) * leve, 0.18, 0.12 * (1 - leve) + 0.04];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(g[0], g[1], 15 * m / 30, 6 * m / 30, 0, 0, Math.PI * 2);
  ctx.fill();
  // Il regarde la planche, donc la piste : de trois quarts vers la camera.
  // (`api.rot` : le sautoir est tourne dans le monde, le juge avec lui.)
  // Il regarde la planche, de trois quarts vers la camera.
  const caps = A.personCapsules(juge, Math.PI / 2 + 0.5 + (api.rot || 0), 0, false, false, A.niveauDetail(k));
  // La derniere capsule est l'arme du starter : on garde sa place — c'est
  // la main — et on la remplace par le drapeau.
  const main = caps.pop();
  A.drawFacetFigure(ctx, caps, g[0], g[1], k);
  if (leve > 0.05 && main) {
    const b = main[1];
    const hx = g[0] + (b[1] - b[0]) * C.ISO_COS * k;
    const hy = g[1] - (b[0] + b[1]) * C.ISO_SIN * k - b[2] * k;
    const col = e.drapeau.blanc ? 'rgb(246,246,242)' : 'rgb(226,40,40)';
    const t = (G.elapsed || 0) * 9;
    const fw = 0.42 * m, fh = 0.30 * m;
    ctx.strokeStyle = 'rgb(60,60,66)';
    ctx.lineWidth = Math.max(1, 0.025 * m);
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy - 0.5 * m); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 0.5 * m);
    ctx.quadraticCurveTo(hx - fw * 0.5, hy - 0.5 * m - 3 * Math.sin(t), hx - fw, hy - 0.5 * m + 2 * Math.sin(t + 1));
    ctx.lineTo(hx - fw, hy - 0.5 * m + fh + 2 * Math.sin(t + 1));
    ctx.quadraticCurveTo(hx - fw * 0.5, hy - 0.5 * m + fh - 3 * Math.sin(t), hx, hy - 0.5 * m + fh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

/** Ou la pointe du pied se pose, depuis le centre de masse. */
export { AVANCE_PIED, RAMENE_VISE };
