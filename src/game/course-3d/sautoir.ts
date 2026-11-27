// LA COURSE EN VRAIE 3D — le sautoir du saut en longueur et du triple (27/11/2026).
//
// « On passe les sauts en 3D » (l'auteur, 27/11). Le jeu du saut ne change pas : il vit dans le repere de
// son sautoir (longueur-course.js, sauts-vue.js), la piste d'elan le long de x, la fosse au bout. Il nous
// donne son etat et le passage de ce repere au monde du moteur (G.obstacles.saut3D) ; on y pose la piste
// d'elan, ses lignes, les planches, la fosse et son cadre, et la trace du sauteur dans le sable.

import * as THREE from 'three';
import { monde } from './scene';
import { ici } from './repere';

const LARGEUR_PISTE = 1.22;   // longueur.js, PISTE_ELAN.largeur
const PLANCHE = 0.20;         // la planche d'appel, le long de l'elan
const CADRE = 0.12;           // la bordure de la fosse

type Piece = THREE.Mesh;
let pieces: {
  piste: Piece; lignes: Piece[]; planches: Piece[]; plasticines: Piece[]; sable: Piece; cadre: Piece[]; trace: Piece;
  juge: Piece[]; hampe: Piece; drapeau: Piece; grains: THREE.InstancedMesh;
} | null = null;
const N_GRAINS = 70;
// un tirage fixe par grain : la gerbe a sa forme, toujours la meme, que la force etire
const ALEA = Array.from({ length: N_GRAINS * 4 }, (_, i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); });
const _g = new THREE.Matrix4(), _gp = new THREE.Vector3(), _gs = new THREE.Vector3(), _gq = new THREE.Quaternion();
const _B = new THREE.Matrix4(), _P = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _f = new THREE.Vector3(), _l = new THREE.Vector3(), _u = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Vector3(), _s = new THREE.Vector3();

function bloc(couleur: number, ombre = true): Piece {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: couleur }));
  m.matrixAutoUpdate = false; m.receiveShadow = ombre; m.frustumCulled = false;
  monde.add(m);
  return m;
}

function creer() {
  return {
    piste: bloc(0x2c4c9c),                                    // le tartan bleu de l'elan
    lignes: [bloc(0xf4f4f0), bloc(0xf4f4f0)],
    planches: [bloc(0xffffff), bloc(0xffffff)],
    plasticines: [bloc(0x7d8a6a), bloc(0x7d8a6a)],           // le temoin du mordu, juste apres la planche
    sable: bloc(0xd8bd85),
    cadre: [bloc(0xe9e6de), bloc(0xe9e6de), bloc(0xe9e6de), bloc(0xe9e6de)],
    trace: bloc(0xa98a55, false),
    // le juge de la planche, cote piste : pantalon, veste, tete ; et son drapeau
    juge: [bloc(0x4a4f5a), bloc(0x1f2d55), bloc(0x8a5a3c)],
    hampe: bloc(0x2a2a2a),
    drapeau: bloc(0xffffff),
    grains: (() => {
      const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xc9a86c }), N_GRAINS);
      m.frustumCulled = false; m.count = 0; monde.add(m); return m;
    })(),
  };
}

/** Le sautoir, a chaque image : rien hors d'un concours de longueur ou de triple. */
export function poserLeSautoir(G: any, T: any) {
  const s = G.obstacles && G.obstacles.saut3D;
  const e = s && s.etat();
  if (!e) { if (pieces) toutes(pieces).forEach(m => { m.visible = false; }); return; }
  if (!pieces) pieces = creer();
  const P = pieces;
  // un pave du sautoir : de x0 a x1 le long de l'elan, centre en y (repere du sautoir), du sol a z
  const pave = (m: Piece, x0: number, x1: number, y: number, larg: number, z0: number, z1: number) => {
    const xm = (x0 + x1) / 2;
    const [d0, h0] = s.monde(xm, y), [d1, h1] = s.monde(xm + 1, y);
    const p0 = ici(T.posDemi(d0, 0, h0)), p1 = ici(T.posDemi(d1, 0, h1));
    _f.set(p1[0] - p0[0], p1[1] - p0[1], 0).normalize();
    _l.crossVectors(_u, _f);
    _B.makeBasis(_f, _l, _u).setPosition(p0[0], p0[1], 0);
    _P.compose(_c.set(0, 0, (z0 + z1) / 2), _q, _s.set(Math.max(1e-3, x1 - x0), larg, Math.max(1e-3, z1 - z0)));
    m.matrix.copy(_P.premultiply(_B));
    m.matrixWorldNeedsUpdate = true;
    m.visible = true;
  };
  const F = s.fosse, y = e.pisteY;
  const fin = e.fosseX + (F.fond - F.debut);
  // la piste d'elan, de la marque de depart jusqu'au sable, et ses deux lignes blanches
  pave(P.piste, e.depart - 3, e.fosseX, y, LARGEUR_PISTE, 0, 0.012);
  P.lignes.forEach((m, i) => pave(m, e.depart - 3, e.fosseX, y + (i ? 1 : -1) * (LARGEUR_PISTE / 2 + 0.025), 0.05, 0, 0.014));
  // les planches : on ne se sert que d'une, l'autre reste a sa place (longueur 1 m, triple plus loin)
  e.planches.forEach((pl: any, i: number) => {
    pave(P.planches[i], pl.x - PLANCHE, pl.x, y, LARGEUR_PISTE, 0, 0.016);
    pave(P.plasticines[i], pl.x, pl.x + 0.10, y, LARGEUR_PISTE, 0, pl.actif ? 0.02 : 0.014);
  });
  // la fosse : le sable a niveau de la planche, et son cadre
  pave(P.sable, e.fosseX, fin, y, F.largeur, 0, 0.018);
  const L = F.largeur / 2 + CADRE / 2;
  pave(P.cadre[0], e.fosseX - CADRE, fin + CADRE, y - L, CADRE, 0, 0.04);
  pave(P.cadre[1], e.fosseX - CADRE, fin + CADRE, y + L, CADRE, 0, 0.04);
  pave(P.cadre[2], e.fosseX - CADRE, e.fosseX, y, F.largeur, 0, 0.03);
  pave(P.cadre[3], fin, fin + CADRE, y, F.largeur, 0, 0.04);
  // la trace du sauteur dans le sable : un creux plus sombre la ou les talons sont tombes
  const t = e.empreinte;
  if (t) pave(P.trace, t.x - 0.25, t.x + 0.55, t.y, 0.45, 0.018, 0.022);
  else P.trace.visible = false;

  // LE JUGE, au bord de la fosse cote piste, face a la camera : il leve le drapeau BLANC quand l'essai est
  // bon, ROUGE quand il est nul (e.drapeau, longueur-course.js). Le bras monte en un quart de seconde. Pose
  // a la planche, il levait son drapeau hors du cadre : la camera est alors sur le sauteur, dans le sable.
  // (il se tient pres de la trace, comme le juge du decametre : un metre derriere elle, cote piste)
  const xj = Math.max(e.fosseX + 1.4, (e.empreinte ? e.empreinte.x : e.fosseX + 6) - 1.0), yj = y + F.largeur / 2 + 0.9;
  pave(P.juge[0], xj - 0.12, xj + 0.12, yj, 0.30, 0, 0.82);
  pave(P.juge[1], xj - 0.14, xj + 0.14, yj, 0.40, 0.82, 1.48);
  pave(P.juge[2], xj - 0.10, xj + 0.10, yj, 0.19, 1.50, 1.72);
  const dr = e.drapeau;
  if (dr) {
    const monte = Math.min(1, dr.age / 0.25), haut = 1.25 + 0.95 * monte * (2 - monte);
    pave(P.hampe, xj + 0.13, xj + 0.16, yj + 0.24, 0.03, haut - 0.65, haut);
    pave(P.drapeau, xj + 0.16, xj + 0.66, yj + 0.24, 0.02, haut - 0.36, haut);
    (P.drapeau.material as THREE.MeshLambertMaterial).color.setHex(dr.blanc ? 0xf6f6f2 : 0xd41f26);
  } else { P.hampe.visible = false; P.drapeau.visible = false; }

  // LA GERBE DE SABLE, a l'impact (e.gerbe, 0,7 s) : des grains projetes devant et sur les cotes, qui
  // retombent ; la force vient de la vitesse du sauteur.
  const g = e.gerbe;
  if (g && g.t < 0.7) {
    const k = g.force || 1, tt = g.t;
    for (let i = 0; i < N_GRAINS; i++) {
      const a = ALEA[i * 4], b = ALEA[i * 4 + 1], c = ALEA[i * 4 + 2], d = ALEA[i * 4 + 3];
      const vx = k * (0.6 + 3.2 * a), vy = (b - 0.5) * 2.6 * k, vz = k * (0.9 + 2.6 * c);
      const z = Math.max(0.02, 0.03 + vz * tt - 4.9 * tt * tt);
      const [dd, hh] = s.monde(g.x + vx * tt, g.y + vy * tt);
      const q = ici(T.posDemi(dd, 0, hh));
      const taille = (0.022 + 0.03 * d) * Math.max(0, 1 - tt / 0.7);
      _g.compose(_gp.set(q[0], q[1], z), _gq.identity(), _gs.set(taille, taille, taille));
      P.grains.setMatrixAt(i, _g);
    }
    P.grains.count = N_GRAINS; P.grains.instanceMatrix.needsUpdate = true; P.grains.visible = true;
  } else P.grains.count = 0;
}

function toutes(P: NonNullable<typeof pieces>): Piece[] {
  return [P.piste, P.sable, P.trace, ...P.lignes, ...P.planches, ...P.plasticines, ...P.cadre, ...P.juge, P.hampe, P.drapeau, P.grains];
}
