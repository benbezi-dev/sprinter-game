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
    case 'appel': {
      // LE PIED EST PLANTE SUR LA PLANCHE ET N'EN BOUGE PLUS. Le bassin passe
      // au-dessus : de trente-cinq centimetres derriere la pointe a vingt-cinq
      // devant. Au-dela du bon maintien, il s'ecrase — le genou plie, la
      // vitesse part dans le sol, et cela doit se voir.
      const u = e.appel.u, charge = e.appel.charge;
      const hz = mix(0.82, 0.96, lisse(u)) - 0.10 * charge;
      const pointe = (e.appel.orteil - r.d) * ech;
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
        // LE CISEAU : les jambes continuent de courir. Chaque appui du joueur
        // avance le cycle d'un demi-tour — ce sont SES foulees en l'air.
        const phi = v.phase;
        const jambe = (q) => {
          const th = 0.50 + 0.95 * Math.sin(q);
          const plie = 0.35 + 0.95 * Math.max(0, Math.cos(q));
          return [th, th - plie, th - plie + 0.30];
        };
        ja = jambe(phi - Math.PI / 2);
        jb = jambe(phi + Math.PI / 2);
        ba = [1.2 + 1.3 * Math.sin(phi + Math.PI / 2), 1.7 + 1.2 * Math.sin(phi + Math.PI / 2)];
        bb = [1.2 + 1.3 * Math.sin(phi - Math.PI / 2), 1.7 + 1.2 * Math.sin(phi - Math.PI / 2)];
        buste = -0.10;
      } else {
        // LA SUSPENSION : les deux genoux plies derriere, les bras en haut,
        // le corps cambre. Elle arrive en un quart de seconde.
        const k = lisse((t - 0.05) / 0.25);
        ja = mix3(depart.a, [-0.12, -1.35, -1.15], k);
        jb = mix3(depart.b, [0.30, -0.95, -0.75], k);
        ba = mix2(depart.ba, [2.75, 3.05], k);
        bb = mix2(depart.bb, [2.65, 2.95], k);
        buste = mix(-0.04, 0.26, k);
      }
      ja = mix3(depart.a, ja, sortie);
      jb = mix3(depart.b, jb, sortie);
      ba = mix2(depart.ba, ba, sortie);
      bb = mix2(depart.bb, bb, sortie);
      // LE RAMENE : les deux jambes tendues devant, talons au sol pile au
      // contact. L'angle se deduit de la hauteur du bassin a la reception.
      if (v.tRamene != null) {
        const k = lisse((t - v.tRamene) / 0.22);
        const hzC = (v.hauteur(T) - 0.08) * ech;
        const th = Math.acos(Math.max(-1, Math.min(1, (hzC - 0.02 - CHEVILLE) / (CUISSE + JAMBE))));
        const leve = Math.max(th, 1.45 - 0.35 * lisse(t / T));
        const tendue = [leve, leve + 0.04, leve + 0.55];
        ja = mix3(ja, tendue, k);
        jb = mix3(jb, [leve - 0.04, leve, leve + 0.50], k);
        ba = mix2(ba, [mix(1.4, 0.3, lisse((t - v.tRamene) / 0.4)), 1.0], k);
        bb = mix2(bb, [mix(1.3, 0.2, lisse((t - v.tRamene) / 0.4)), 0.9], k);
        buste = mix(buste, -0.62, k);
      }
      J[A] = ja; J[B] = jb; BR[A] = ba; BR[B] = bb;
      P.buste = buste;
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
        hz = mix(c.hz0, 0.36, tombe);
        buste = mix(-0.60, -1.25, tombe);
        bras = [[1.40, 1.50], [1.45, 1.55]];
      } else {
        hz = mix(c.hz0, 0.30, tombe);
        buste = mix(-0.62, -0.95, tombe);
        bras = [[1.30, 1.60], [1.25, 1.55]];
      }
      let ja, jb;
      if (pieds) {
        // A genoux dans le sable : les cuisses a la verticale, les tibias
        // couches derriere.
        ja = mix3(jambeVers(0, hz, talon, CHEVILLE, 0.3), [0.25, -1.30, -1.10], tombe);
        jb = mix3(jambeVers(0, hz, talon, CHEVILLE, 0.3), [0.20, -1.35, -1.15], tombe);
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
  const debut = L - PISTE_ELAN.recommandee;
  const sable0 = L + FOSSE.debut;
  dalle(ctx, api, debut, Y - demi, sable0, Y + demi, rgb(tartan));
  const lw = Math.max(1, 0.05 * m);
  trait(ctx, api, debut, Y - demi, sable0, Y - demi, rgb(blanc, 0.9), lw);
  trait(ctx, api, debut, Y + demi, sable0, Y + demi, rgb(blanc, 0.9), lw);
  // La marque de l'athlete, au bord de la piste, la ou il se place : un
  // adhesif de couleur, comme ceux que les sauteurs collent eux-memes.
  const marque = e.depart;
  dalle(ctx, api, marque - 0.05, Y + demi + 0.04, marque + 0.05, Y + demi + 0.34,
        rgb(th && th.accent ? th.accent : [240, 158, 46]));

  // LA PLANCHE, puis la plasticine juste apres la ligne.
  dalle(ctx, api, L - PLANCHE.largeur, Y - PLANCHE.longueur / 2, L, Y + PLANCHE.longueur / 2,
        'rgb(244,246,250)', 0.004);
  trait(ctx, api, L, Y - PLANCHE.longueur / 2, L, Y + PLANCHE.longueur / 2,
        'rgba(40,40,48,0.35)', Math.max(1, 0.012 * m), 0.005);
  dalle(ctx, api, L, Y - PLANCHE.longueur / 2, L + PLASTICINE.largeur, Y + PLANCHE.longueur / 2,
        'rgb(214,206,168)', 0.004);
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
    plaquer(ctx, api, imF, L + mf.x0, Y + mf.y0, mf.mw);
  } else {
    const b = 0.12, w = FOSSE.largeur / 2;
    dalle(ctx, api, L + FOSSE.debut - b, Y - w - b, L + FOSSE.fond + b, Y + w + b, 'rgb(196,194,188)');
    dalle(ctx, api, L + FOSSE.debut, Y - w, L + FOSSE.fond, Y + w,
          s === 'cosmos' ? 'rgb(184,170,206)' : 'rgb(222,190,138)', 0.002);
  }

  // LES LIGNES DE LA TELEVISION, tracees dans le sable : ce qu'il faut
  // sauter pour prendre la tete, et le record du monde quand il tombe dans
  // la fosse. On les lit sans quitter l'athlete des yeux.
  const w = FOSSE.largeur / 2;
  for (const l of e.lignes || []) {
    const x = L + l.m;
    if (x < L + FOSSE.debut || x > L + FOSSE.fond) continue;
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
  out.push({ profondeur: api.depthOf(e.ligne + 0.25, Y + 1.7), sorte: 'juge' });
  return out;
}

export function dessinerPiece(ctx, api, e, pc, th, A) {
  if (pc.sorte === 'gerbe') dessinerGerbe(ctx, api, e, th);
  else if (pc.sorte === 'angle') dessinerAngle(ctx, api, e, A);
  else if (pc.sorte === 'juge') dessinerJuge(ctx, api, e, A);
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
 * LE JUGE DE PLANCHE, assis de l'autre cote de la piste d'elan. Il leve le
 * drapeau blanc pour un essai valable, le rouge pour un essai mordu : c'est
 * le signal que tout le stade lit avant le tableau.
 */
function dessinerJuge(ctx, api, e, A) {
  const G = api.G, C = api.C;
  const X = e.ligne + 0.25, Y = e.pisteY + 1.7;
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
  const caps = A.personCapsules(juge, -Math.PI / 2 - 0.5, 0, false, false, A.niveauDetail(k));
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
