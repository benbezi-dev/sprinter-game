/* ---------------------------------------------------------------------------
   JUMPER — le saut en hauteur, dessine
   ---------------------------------------------------------------------------
   La POSTURE de l'athlete, calculee a chaque image a partir de ce que le
   joueur a fait, et le DESSIN du sautoir — l'aire d'elan, le tapis, les
   montants, la barre, le tableau de hauteur, le juge. Les regles sont dans
   hauteur-jeu.js ; ce qui les relie au moteur, dans hauteur-course.js.

   LE ROULEAU DORSAL SE CALCULE, IL NE SE LIT PAS DANS UNE TABLE. Le corps
   tourne en arriere a la vitesse du modele (ROTATION_PAR_S) ; la cambrure
   leve le bassin, le lancer des jambes les envoie au ciel, exactement quand
   le joueur les a demandes, et avec les memes nombres que ceux qui decident
   si la barre tombe (CORPS, gestesA). Ce qu'on voit passer au-dessus de la
   barre est donc ce qui a ete juge.

   Le rig ne connait qu'un plan — celui de la foulee — et un cap. C'est assez :
   un athlete qui tourne le dos a la barre (cap oppose au tapis) et se couche
   en arriere (buste au-dela de l'horizontale) EST un rouleau dorsal. Tout se
   dit dans la convention du rig : angles absolus, 0 vers le bas, positif vers
   l'avant ; un buste positif part en arriere.
--------------------------------------------------------------------------- */

import { TAPIS, MONTANTS, BARRE, lireHauteur } from './hauteur.js';
import { CORPS, gestesA, AVANCE_PIED } from './hauteur-jeu.js';

/* ------------------------------------------------------------ le rig */

const CUISSE = 0.392, JAMBE = 0.380, CHEVILLE = 0.07;
const DEBOUT_Z = 0.87;

const lisse = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const mix2 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];

/** Deux segments, du pivot a la cible (voir longueur-rendu.js). */
function ik(px, pz, tx, tz, a = CUISSE, b = JAMBE) {
  const dx = tx - px, dz = tz - pz;
  const d = Math.min(Math.max(Math.hypot(dx, dz), Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const base = Math.atan2(dx, -dz);
  const c = (a * a + d * d - b * b) / (2 * a * d);
  const t1 = base + Math.acos(Math.max(-1, Math.min(1, c)));
  const kx = px + a * Math.sin(t1), kz = pz - a * Math.cos(t1);
  return [t1, Math.atan2(tx - kx, -(tz - kz))];
}

/** Debout, les bras le long du corps. */
const DEBOUT = { a: [0.05, 0.02, 0.0], b: [-0.05, -0.08, -0.05], ba: [0.06, 0.26], bb: [-0.04, 0.20], buste: -0.03 };

/** L'enfoncement du tapis sous le dos, en metres : il cede, puis rend un peu. */
export function enfoncement(t) {
  if (t == null) return 0;
  return 0.20 * lisse(t / 0.10) - 0.07 * lisse((t - 0.25) / 0.6);
}

/**
 * LA POSTURE, image par image. `e` est l'etat du saut (hauteur-course.js),
 * `r` le coureur, `ech` le nombre d'unites du rig par metre.
 */
export function postureDe(e, r, ech) {
  const P = e.posture || (e.posture = { w: 0, jambes: [[0, 0, 0], [0, 0, 0]], bras: [[0, 0], [0, 0]],
                                        buste: 0, leve: 0, hanche: 0 });
  // La jambe d'appel est la gauche : l'index 0 du rig.
  const A = 0, B = 1;
  const J = P.jambes, BR = P.bras;
  P.hanche = 0;
  P.leve = 0;
  // LA TETE, que le rig sait pencher (positif : en arriere). Elle fait la
  // moitie de l'elegance d'un rouleau : renversee, elle regarde le tapis et
  // tire le dos en pont ; rentree, elle leve les jambes.
  r.tete = 0;
  const debout = () => {
    J[A] = DEBOUT.a.slice(); J[B] = DEBOUT.b.slice();
    BR[A] = DEBOUT.ba.slice(); BR[B] = DEBOUT.bb.slice();
    P.buste = DEBOUT.buste;
    P.w = 1;
    return P;
  };

  switch (e.phase) {
    case 'repos':
      return debout();
    case 'attente': {
      // LE BALANCEMENT DU SAUTEUR EN HAUTEUR, avant de partir : le poids passe
      // d'un pied a l'autre, le buste suit. On le reconnait de loin.
      const b = Math.sin(e.horlogeT * 2.4);
      J[A] = [0.16 + 0.04 * b, 0.05, 0.05];
      J[B] = [-0.22 + 0.05 * b, -0.48, -0.55];
      BR[A] = [-0.25 + 0.20 * b, 0.10];
      BR[B] = [0.25 - 0.20 * b, 0.75];
      P.buste = -0.10 - 0.06 * b;
      P.leve = -0.02 + 0.012 * b;
      P.w = 1;
      return P;
    }
    case 'elan':
      P.w = Math.max(0, 1 - e.t / 0.22);
      return P.w > 0 ? P : null;
    case 'dessous':
    case 'temps':
      if (e.phase === 'dessous' && !e.arret) return null;
      return debout();
    case 'appel': {
      // LE PIED EST PLANTE, le bassin passe au-dessus, le genou libre monte et
      // les deux bras avec lui : le double bras des sauteurs en hauteur. Le
      // buste se renverse un peu en arriere, loin de la barre.
      const a = e.appel;
      const u = a.u, charge = a.charge;
      const hz = mix(0.80, 0.97, lisse(u)) - 0.10 * charge;
      const W = e.sautoir.laneW;
      const rx = r.d, ry = W * 0.5 + (r.demi || 0);
      const d = e.sautoir.dir;
      const pointe = ((a.pointe[0] - rx) * d[0] + (a.pointe[1] - ry) * d[1]) * ech;
      const cheville = pointe - 0.16;
      const [t1, t2] = ik(0, hz - 0.02, cheville, mix(CHEVILLE, 0.12, lisse(u)));
      J[A] = [t1, t2, mix(0.12, -0.90, lisse(u))];
      J[B] = mix3([-0.40, -1.70, -1.30], [1.60, 0.45, 0.40], lisse(u * 1.15));
      BR[A] = mix2([-0.70, -0.30], [2.55, 2.95], lisse(u * 1.1));
      BR[B] = mix2([-0.60, -0.20], [2.45, 2.85], lisse(u * 1.1));
      P.buste = mix(0.26, 0.14, u) + 0.12 * charge;
      P.leve = hz - DEBOUT_Z;
      r.tete = 0.12 * lisse(u);
      P.w = 1;
      return P;
    }
    case 'vol': {
      const v = e.vol, t = v.t, V = v.V;
      const phi = V.rotation(t);
      const { cambre: a, jambes: k } = gestesA(t, v.tCambre, v.tJambes);
      // Le bassin : le meme repere que celui que la barre juge.
      const pB = CORPS.find((p) => p.cle === 'bassin');
      const lift = pB.cambre * a + pB.jambes * k;
      const zHanche = V.z(t) + pB.s * Math.cos(phi) + lift * Math.sin(phi);
      P.leve = zHanche * ech - DEBOUT_Z;
      // LE CORPS SE COUCHE. Droit, il ferait un meme angle du buste aux pieds ;
      // les genoux plies laissent pendre les jambes. La cambrure renverse la
      // tete et descend les genoux — le bassin est le point le plus haut. Les
      // jambes lancees se tendent vers le ciel, et le menton revient.
      const plie = 1.25;
      const buste = phi + 0.45 * a - 0.35 * k;
      const cuisse = phi - 0.55 * a + 0.60 * k;
      const tibia = cuisse - plie * (1 - k);
      const sortie = lisse(t / 0.22);
      J[A] = mix3([-0.30, -0.40, -0.70], [cuisse, tibia, tibia + 0.35], sortie);
      J[B] = mix3([1.55, 0.40, 0.40], [cuisse - 0.06, tibia - 0.08, tibia + 0.28], sortie);
      // Les bras, leves a l'appel, redescendent le long du corps.
      const bras = lisse((t - 0.06) / 0.30);
      BR[A] = mix2([2.55, 2.95], [buste + 0.18, buste + 0.50], bras);
      BR[B] = mix2([2.45, 2.85], [buste + 0.08, buste + 0.40], bras);
      P.buste = mix(0.18, buste, sortie);
      // la tete part en arriere avec la rotation, plus encore dans la
      // cambrure ; le menton revient sur la poitrine quand les jambes partent
      r.tete = mix(0.12, 0.30, sortie) + 0.35 * a - 0.75 * k;
      P.w = 1;
      return P;
    }
    case 'reception': {
      const c = e.reception, tau = c.t;
      const surface = TAPIS.hauteur - enfoncement(e.impact ? e.impact.t : null);
      // Trois temps : le dos s'enfonce et les jambes passent par-dessus
      // (0 - 0,3 s), il se couche (0,3 - 0,9 s), il s'assoit (1,1 - 1,7 s) et
      // regarde la barre.
      const choc = lisse(tau / 0.28), couche = lisse((tau - 0.3) / 0.6), assis = lisse((tau - 1.1) / 0.6);
      let phi = mix(c.phi0, 1.95, choc);
      phi = mix(phi, 1.57, couche);
      phi = mix(phi, 0.18, assis);
      P.leve = (surface + 0.11) * ech - DEBOUT_Z;
      const roule = [phi + 0.55, phi - 0.25, phi + 0.1];
      const genoux = [2.25, 0.95, 1.30];
      const allonge = [1.55, 1.35, 1.75];
      let ja = mix3(roule, genoux, couche);
      ja = mix3(ja, allonge, assis);
      J[A] = ja;
      J[B] = [ja[0] - 0.08, ja[1] - 0.06, ja[2]];
      // Assis, il a vu : les bras au ciel si la barre tient, les mains sur la
      // tete si elle est tombee.
      const franchi = e.resultat && e.resultat.franchi;
      const lu = lisse((tau - 1.5) / 0.35);
      const repos = [phi + 0.2, phi + 0.5];
      const fin = franchi ? [2.85, 3.05] : [1.95, 3.55];
      BR[A] = mix2(repos, fin, lu);
      BR[B] = mix2([phi + 0.1, phi + 0.4], franchi ? [2.75, 2.95] : [1.90, 3.50], lu);
      P.buste = phi;
      // le menton rentre pour rouler, puis la tete se releve vers la barre
      r.tete = mix(-0.45, 0.15, couche) * (1 - assis) + 0.25 * assis;
      P.w = 1;
      return P;
    }
    default:
      P.w = 0;
      return null;
  }
}

/* ------------------------------------------------------------ le dessin */

const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function poly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function dalle(ctx, api, x0, y0, x1, y1, fill, z = 0) {
  const s = api.solid;
  poly(ctx, [s(x0, y0, z), s(x1, y0, z), s(x1, y1, z), s(x0, y1, z)], fill);
}

/** Les couleurs du tapis : bleu sur Terre, violet dans la station. */
function couleursTapis(th) {
  if (th && th.espace) return { cote: [72, 44, 140], dessus: [104, 70, 186], bord: [170, 140, 240], bande: [236, 226, 255] };
  return { cote: [22, 66, 150], dessus: [40, 96, 186], bord: [120, 164, 232], bande: [246, 246, 250] };
}

/**
 * LE SOL DU SAUTOIR, et ce qui s'y pose a plat : l'aire d'elan, les reperes de
 * l'athlete, le tapis — sous les ombres des athletes, parce qu'il est en
 * dessous d'eux : on n'y passe jamais derriere.
 */
export function dessinerSol(ctx, api, e, th) {
  const S = e.sautoir;
  const m = api.scaleM();
  ctx.save();
  ctx.lineCap = 'round';

  // L'AIRE D'ELAN : un demi-disque de tartan devant la barre, la ou l'on court
  // en J. Arrondi du cote de la pelouse, droit le long de la barre.
  const tartan = th && th.trackB ? th.trackB : [122, 6, 8];
  const cx = S.x, cy = S.y + 4, R = 24;
  const pts = [];
  for (let k = 0; k <= 24; k++) {
    const a = Math.PI / 2 + (k / 24) * Math.PI;           // de +y a -y, cote elan
    let x = cx + R * Math.cos(a), y = cy + R * Math.sin(a) * 0.62;
    y = Math.min(-1.2, y);
    pts.push(api.solid(x, y, 0));
  }
  poly(ctx, pts, rgb(tartan));
  // Les reperes que l'athlete a colles lui-meme : sa marque, le debut de sa
  // courbe. Et, a peine, le J qu'il va courir.
  const accent = th && th.accent ? th.accent : [240, 158, 46];
  for (const q of [S.marque, S.courbe]) dalle(ctx, api, q[0] - 0.05, q[1] - 0.22, q[0] + 0.05, q[1] + 0.22, rgb(accent));
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  for (let a = 0.08; a < S.alpha; a += 0.09) {
    const p = api.solid(S.centre[0] + S.rayon * Math.sin(a), S.centre[1] + S.rayon * Math.cos(a), 0);
    ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(1, 0.035 * m), 0, Math.PI * 2); ctx.fill();
  }

  // LE TAPIS : six metres sur quatre, soixante-dix centimetres de haut, a dix
  // centimetres derriere le plan des montants. On n'en voit que le dessus et
  // les deux faces tournees vers la camera.
  const C = couleursTapis(th);
  const x0 = S.x + MONTANTS.jeuTapis, x1 = x0 + TAPIS.profondeur;
  const y0 = S.y - TAPIS.largeur / 2, y1 = S.y + TAPIS.largeur / 2, h = TAPIS.hauteur;
  const s = api.solid;
  // LES FACES QUI REGARDENT LA CAMERA. Le sautoir est tourne dans le monde
  // (sauts-vue.js) : une face se voit quand sa normale, tournee avec lui, pointe
  // vers la camera — vers les profondeurs decroissantes, (-1, -1).
  const rot = api.rot || 0, rc = Math.cos(rot), rs = Math.sin(rot);
  const vue = (nx, ny) => (nx * rc - ny * rs) + (nx * rs + ny * rc) < 0;
  const faces = [
    { n: [-1, 0], p: [[x0, y1], [x0, y0]] }, { n: [1, 0], p: [[x1, y0], [x1, y1]] },
    { n: [0, -1], p: [[x0, y0], [x1, y0]] }, { n: [0, 1], p: [[x1, y1], [x0, y1]] },
  ];
  faces.forEach((f, i) => {
    if (!vue(f.n[0], f.n[1])) return;
    const [[ax, ay], [bx, by]] = f.p;
    const teinte = i < 2 ? C.cote : C.cote.map((v) => v * 0.8);
    poly(ctx, [s(ax, ay, 0), s(bx, by, 0), s(bx, by, h), s(ax, ay, h)], rgb(teinte));
    // la bande blanche des tapis de competition, sur les grandes faces
    if (i >= 2 || i === 0) {
      const k = 0.3 / Math.hypot(bx - ax, by - ay);
      const ux = ax + (bx - ax) * k, uy = ay + (by - ay) * k, vx = bx - (bx - ax) * k, vy = by - (by - ay) * k;
      poly(ctx, [s(ux, uy, h * 0.52), s(vx, vy, h * 0.52), s(vx, vy, h * 0.64), s(ux, uy, h * 0.64)], rgb(C.bande, 0.85));
    }
  });
  poly(ctx, [s(x0, y0, h), s(x1, y0, h), s(x1, y1, h), s(x0, y1, h)], rgb(C.dessus));
  // les coutures de la housse, en quadrillage
  ctx.strokeStyle = rgb(C.bord, 0.28);
  ctx.lineWidth = Math.max(1, 0.02 * m);
  ctx.beginPath();
  for (let x = x0 + 1; x < x1 - 0.1; x += 1) { const a = s(x, y0, h), b = s(x, y1, h); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  for (let y = y0 + 1.5; y < y1 - 0.1; y += 1.5) { const a = s(x0, y, h), b = s(x1, y, h); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  ctx.stroke();
  ctx.strokeStyle = rgb(C.bord, 0.9);
  ctx.lineWidth = Math.max(1, 0.03 * m);
  ctx.beginPath();
  for (const f of faces) {
    if (!vue(f.n[0], f.n[1])) continue;
    const a = s(f.p[0][0], f.p[0][1], h), b = s(f.p[1][0], f.p[1][1], h);
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();

  // LE CREUX du dos dans le tapis, qui se reforme lentement.
  if (e.impact) {
    const k = enfoncement(e.impact.t) / 0.20;
    const p = s(e.impact.x, e.impact.y, h);
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.1 * m);
    g.addColorStop(0, `rgba(0,0,20,${0.38 * k})`);
    g.addColorStop(1, 'rgba(0,0,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 1.1 * m, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // L'OMBRE de l'athlete en l'air : sur le tapis s'il est au-dessus, sur le
  // tartan sinon. Plus il est haut, plus elle est pale et large.
  const j = api.G.player;
  if (j && j.sansOmbre) {
    const x = j.d, y = S.laneW * 0.5 + (j.demi || 0);
    const sur = x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const z = sur ? h - enfoncement(e.impact ? e.impact.t : null) : 0;
    const haut = e.vol && e.phase === 'vol' ? Math.max(0, e.vol.V.z(e.vol.t) - z) : 0.3;
    const p = s(x, y, z);
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.scale(1, 0.5);
    const rr = (0.55 + 0.25 * haut) * m;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
    g.addColorStop(0, `rgba(0,0,0,${0.42 / (1 + haut)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/* ------------------------------------------------ ce qui se tient debout */

/**
 * Les pieces a ranger parmi les athletes : les deux montants, la barre, le
 * tableau de hauteur, le juge, et l'eventail de l'angle a l'appel.
 *
 * LA BARRE SE RANGE A LA PROFONDEUR DE L'ATHLETE QUI LA PASSE. C'est une
 * ligne qui traverse le cadre : aucune profondeur unique ne la place bien par
 * rapport a tout le monde. Mais il n'y a qu'un athlete, et c'est a lui qu'elle
 * doit se comparer : on la prend au point ou il la croise. Tant qu'il est de
 * ce cote-ci du plan, il passe devant elle ; au-dela, elle passe devant lui.
 */
export function piecesDebout(e, api, out) {
  out.length = 0;
  const S = e.sautoir;
  const demi = MONTANTS.ecart / 2;
  out.push({ profondeur: api.depthOf(S.x, S.y + demi), sorte: 'montant', cote: 1 });
  out.push({ profondeur: api.depthOf(S.x, S.y - demi), sorte: 'montant', cote: -1 });
  const j = api.G.player;
  const yj = j ? S.laneW * 0.5 + (j.demi || 0) : S.y;
  const yb = Math.max(S.y - demi, Math.min(S.y + demi, yj));
  const c = e.barre && e.barre.chute;
  const xb = c ? (c.bouts[0].x + c.bouts[1].x) / 2 : S.x;
  out.push({ profondeur: api.depthOf(xb, yb), sorte: 'barre' });
  out.push({ profondeur: api.depthOf(S.x - 1.3, S.y - 3.4), sorte: 'tableau' });
  out.push({ profondeur: api.depthOf(S.x - 1.6, S.y - 4.4), sorte: 'juge' });
  if (e.phase === 'appel' || (e.phase === 'vol' && e.vol.t < 0.3)) out.push({ profondeur: -1e9, sorte: 'angle' });
  return out;
}

export function dessinerPiece(ctx, api, e, pc, th, A) {
  if (pc.sorte === 'montant') dessinerMontant(ctx, api, e, pc.cote);
  else if (pc.sorte === 'barre') dessinerBarre(ctx, api, e, th);
  else if (pc.sorte === 'tableau') dessinerTableau(ctx, api, e);
  else if (pc.sorte === 'juge') dessinerJuge(ctx, api, e, A);
  else if (pc.sorte === 'angle') dessinerAngle(ctx, api, e);
}

/** Un montant : son socle, son mat gradue, et le taquet a la hauteur de la barre. */
function dessinerMontant(ctx, api, e, cote) {
  const S = e.sautoir, m = api.scaleM(), s = api.solid;
  const y = S.y + cote * MONTANTS.ecart / 2;
  const haut = Math.max(2.5, e.hauteur + 0.28);
  // le socle
  ctx.fillStyle = 'rgba(40,44,52,0.9)';
  const b = [s(S.x - 0.25, y - 0.2, 0.01), s(S.x + 0.05, y - 0.2, 0.01), s(S.x + 0.05, y + 0.2, 0.01), s(S.x - 0.25, y + 0.2, 0.01)];
  poly(ctx, b, 'rgba(40,44,52,0.9)');
  // le mat
  const p0 = s(S.x, y, 0), p1 = s(S.x, y, haut);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgb(206,212,220)';
  ctx.lineWidth = Math.max(2, 0.07 * m);
  ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = Math.max(1, 0.02 * m);
  ctx.beginPath(); ctx.moveTo(p0[0] - 0.015 * m, p0[1]); ctx.lineTo(p1[0] - 0.015 * m, p1[1]); ctx.stroke();
  // la graduation, un trait tous les dix centimetres au-dessus d'un metre
  ctx.strokeStyle = 'rgba(30,30,40,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let z = 1; z < haut; z += 0.1) {
    const q = s(S.x, y, z), w = (Math.round(z * 10) % 5 === 0 ? 0.05 : 0.025) * m;
    ctx.moveTo(q[0] - w, q[1]); ctx.lineTo(q[0] + w, q[1]);
  }
  ctx.stroke();
  // le taquet, tourne vers l'autre montant
  const t0 = s(S.x, y, e.hauteur - 0.01), t1 = s(S.x, y - cote * TAQUET, e.hauteur - 0.01);
  ctx.strokeStyle = 'rgb(60,64,72)';
  ctx.lineWidth = Math.max(2, 0.04 * m);
  ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.stroke();
  // le pommeau
  ctx.fillStyle = 'rgb(236,240,246)';
  ctx.beginPath(); ctx.arc(p1[0], p1[1], Math.max(1.5, 0.045 * m), 0, Math.PI * 2); ctx.fill();
}
const TAQUET = 0.06;

/**
 * LA BARRE. Au repos, elle flechit d'un centimetre en son milieu ; effleuree,
 * elle vibre sur ses taquets ; touchee, ses deux bouts quittent les taquets
 * l'un apres l'autre et elle retombe sur le tapis.
 */
function dessinerBarre(ctx, api, e, th) {
  const S = e.sautoir, m = api.scaleM(), s = api.solid;
  const L = BARRE.longueur;
  const c = e.barre && e.barre.chute;
  const pts = [];
  if (c) {
    const a = c.bouts[0], b = c.bouts[1];
    for (let k = 0; k <= 12; k++) {
      const u = k / 12;
      pts.push(s(mix(a.x, b.x, u), S.y - L / 2 + L * u, mix(a.z, b.z, u) + (c.t < Math.min(a.retard, b.retard) ? 0 : 0)));
    }
  } else {
    const tr = e.barre && e.barre.tremble;
    for (let k = 0; k <= 16; k++) {
      const u = k / 16;
      let z = e.hauteur - BARRE.fleche * Math.sin(Math.PI * u);
      if (tr) z -= tr.amp * Math.sin(Math.PI * u) * Math.sin(34 * tr.t) * Math.exp(-tr.t / 0.35);
      pts.push(s(S.x, S.y - L / 2 + L * u, z));
    }
  }
  const w = Math.max(2, BARRE.diametre * 1.4 * m);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = w + 2;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.stroke();
  ctx.strokeStyle = 'rgb(248,248,244)';
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.stroke();
  // les bandes de couleur, qui la font voir de loin
  const bande = th && th.espace ? 'rgb(232,121,216)' : 'rgb(226,52,40)';
  ctx.strokeStyle = bande;
  ctx.lineCap = 'butt';
  for (let k = 0; k < pts.length - 1; k += 2) {
    ctx.beginPath(); ctx.moveTo(pts[k][0], pts[k][1]); ctx.lineTo(pts[k + 1][0], pts[k + 1][1]); ctx.stroke();
  }
}

/** Le tableau de hauteur, au pied du sautoir : la barre, en chiffres jaunes. */
function dessinerTableau(ctx, api, e) {
  const S = e.sautoir, m = api.scaleM(), s = api.solid;
  // Au loin, de l'autre cote des montants : il se lit derriere la barre sans
  // jamais passer devant l'appel.
  const X = S.x - 1.3, Y = S.y - 3.4;
  const p0 = s(X, Y, 0), p1 = s(X, Y, 1.55);
  ctx.strokeStyle = 'rgb(70,74,82)';
  ctx.lineWidth = Math.max(1.5, 0.05 * m);
  ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
  const w = 0.95 * m, h = 0.42 * m;
  ctx.fillStyle = 'rgb(18,18,22)';
  ctx.fillRect(p1[0] - w / 2, p1[1] - h, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(p1[0] - w / 2, p1[1] - h, w, h);
  ctx.font = `700 ${Math.max(8, Math.round(0.30 * m))}px ui-monospace, monospace`;
  ctx.fillStyle = 'rgb(250,204,21)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(lireHauteur(e.hauteur, '.'), p1[0], p1[1] - h / 2);
}

/** L'eventail de l'angle a l'appel : le secteur juste en vert, l'aiguille. */
function dessinerAngle(ctx, api, e) {
  const a = e.appel;
  if (!a) return;
  const angle = e.phase === 'appel' ? a.angle : a.angle;
  const S = e.sautoir, m = api.scaleM();
  const x = a.pointe[0], y = a.pointe[1], d = S.dir;
  const R = 1.25;
  const pt = (deg, r) => {
    const q = deg * Math.PI / 180;
    return api.solid(x + Math.cos(q) * r * d[0], y + Math.cos(q) * r * d[1], Math.sin(q) * r);
  };
  const o = api.solid(x, y, 0.02);
  const vise = a.vise ? a.vise.angle : 48;
  ctx.save();
  ctx.globalAlpha = e.phase === 'appel' ? 1 : Math.max(0, 1 - e.vol.t / 0.3);
  ctx.lineWidth = Math.max(1, 0.03 * m);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  for (let q = 25; q <= 75; q += 2.5) { const p = pt(q, R); if (q === 25) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(74,222,128,0.35)';
  ctx.beginPath();
  ctx.moveTo(o[0], o[1]);
  for (let q = vise - 2.5; q <= vise + 2.51; q += 0.5) { const p = pt(q, R); ctx.lineTo(p[0], p[1]); }
  ctx.closePath();
  ctx.fill();
  const ec = Math.abs(angle - vise);
  const col = ec <= 2.5 ? 'rgb(74,222,128)' : ec <= 6 ? 'rgb(250,214,60)' : 'rgb(248,113,113)';
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
}

/**
 * LE JUGE, debout pres du montant cote camera. Drapeau blanc : la barre a
 * tenu. Rouge : elle est tombee, ou l'athlete est passe dessous.
 */
function dessinerJuge(ctx, api, e, A) {
  const G = api.G, C = api.C;
  const S = e.sautoir;
  // Au loin, cote elan, derriere le montant du fond : il voit la barre de
  // bout, et ne se tient jamais entre elle et la camera.
  const X = S.x - 1.6, Y = S.y - 4.4;
  const g = api.ground(X, Y);
  if (g[0] < -200 || g[0] > G.VW + 200 || g[1] < -260 || g[1] > G.VH + 200) return;
  const m = api.scaleM();
  const look = A.LOOK_STARTER;
  const k = m * (look.h / C.MODEL_H);
  const leve = e.drapeau ? lisse(e.drapeau.age / 0.35) : 0;
  const juge = e.juge || (e.juge = { look, stride: 0, v: 0, maxSpeed: 12, fallAnim: 0, celebrate: 0, pistolet: -1 });
  juge.bras = [0.10, 0.20 + (2.85 - 0.20) * leve, 0.18, 0.12 * (1 - leve) + 0.04];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(g[0], g[1], 15 * m / 30, 6 * m / 30, 0, 0, Math.PI * 2);
  ctx.fill();
  // Il regarde la barre : de trois quarts, vers le tapis.
  const caps = A.personCapsules(juge, 0.9 + (api.rot || 0), 0, false, false, A.niveauDetail(k));
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
    ctx.quadraticCurveTo(hx + fw * 0.5, hy - 0.5 * m - 3 * Math.sin(t), hx + fw, hy - 0.5 * m + 2 * Math.sin(t + 1));
    ctx.lineTo(hx + fw, hy - 0.5 * m + fh + 2 * Math.sin(t + 1));
    ctx.quadraticCurveTo(hx + fw * 0.5, hy - 0.5 * m + fh - 3 * Math.sin(t), hx, hy - 0.5 * m + fh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

export { AVANCE_PIED };
