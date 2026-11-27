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
let pieces: { piste: Piece; lignes: Piece[]; planches: Piece[]; plasticines: Piece[]; sable: Piece; cadre: Piece[]; trace: Piece } | null = null;
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
}

function toutes(P: NonNullable<typeof pieces>): Piece[] {
  return [P.piste, P.sable, P.trace, ...P.lignes, ...P.planches, ...P.plasticines, ...P.cadre];
}
