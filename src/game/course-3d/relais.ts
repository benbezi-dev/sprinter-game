// LA COURSE EN VRAIE 3D — le relais 4 x 100 (l'auteur, 14/11/2026 : « fais passer le relais en 3D »).
//
// Ce que le 3D ne savait pas du relais, et que le dessin du jeu montre : les zones de transmission
// au sol, en jaune comme sur une piste, et la marque d'elan cyan de chaque receveur dans le couloir
// de l'equipe (voir le meme dessin en 2D, sprinter-app.js, « Zones de transmission du relais »).
// Le temoin, lui, se pose dans la main du coureur (course-3d.ts), et la camera le suit
// (camera.ts, `suiviDuRelais`).

import * as THREE from 'three';
import { zSol } from '../salle-3d';
import { monde } from './scene';
import { ici, salleActive } from './repere';

const MAX_TRAITS = 8 * 3 * 3 + 16;
let traits: THREE.InstancedMesh | null = null;
const JAUNE = new THREE.Color(1, 206 / 255, 0), JAUNE_PALE = new THREE.Color(0.75, 0.62, 0.12);
const CYAN = new THREE.Color(70 / 255, 230 / 255, 1), CYAN_PALE = new THREE.Color(0.2, 0.55, 0.62);
const _B = new THREE.Matrix4(), _P = new THREE.Matrix4();
const _f = new THREE.Vector3(), _l = new THREE.Vector3(), _u = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();

/**
 * Pose les traits du relais sur la piste, a chaque image (une seule instanciation pour tous).
 *
 * Les distances sont celles de la course, dans chaque couloir — `posDemi(d, e, …)`, comme les
 * coureurs et les haies : le debut de zone que l'on voit au sol est celui ou la salle juge.
 */
export function poserLeRelais(G: any, T: any, C: any) {
  const relais = G.raceKey === '4x100' && T && T.relay && T.legLength > 0;
  if (!relais) { if (traits) traits.count = 0; return; }
  if (!traits) {
    // un aplat qui ne recoit ni lumiere ni ombre : de la peinture, pas un objet
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    mat.polygonOffset = true; mat.polygonOffsetFactor = -3; mat.polygonOffsetUnits = -6;
    traits = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, MAX_TRAITS);
    traits.frustumCulled = false; traits.castShadow = false; traits.receiveShadow = false;
    traits.setColorAt(0, JAUNE);
    monde.add(traits);
  }
  const L = C.LANE_W || 1.22;
  let n = 0;
  // Un trait en travers du couloir `e`, a la distance `d` : de son bord interieur a son bord
  // exterieur (la ligne de mesure passe a 0,20 m du bord interieur), large de `w` metres.
  const trait = (d: number, e: number, w: number, col: THREE.Color, de = -0.2, a = L - 0.2) => {
    if (n >= MAX_TRAITS) return;
    const milieuLat = (de + a) / 2;
    const p0 = ici(T.posDemi(d, e, milieuLat)), p1 = ici(T.posDemi(d + 1, e, milieuLat));
    _f.set(p1[0] - p0[0], p1[1] - p0[1], 0).normalize();
    _l.crossVectors(_u, _f);
    const z = (salleActive ? zSol(p0[0], p0[1]) : 0) + 0.004;
    _B.makeBasis(_f, _l, _u).setPosition(p0[0], p0[1], z);
    _P.compose(_c.set(0, 0, 0), _q, _s.set(w, a - de, 1));
    traits!.setMatrixAt(n, _P.premultiply(_B));
    traits!.setColorAt(n, col);
    n++;
  };
  const nl = C.LANE_COUNT || 8;
  for (let k = 1; k < (T.legs || 4); k++) {
    const z0 = k * T.legLength;
    for (let e = 0; e < nl; e++) {
      trait(z0, e, 0.08, JAUNE);
      trait(z0 + C.RELAY_LAUNCH, e, 0.08, JAUNE);
      trait(z0 + 20, e, 0.05, JAUNE_PALE);
    }
  }
  // LA MARQUE D'ELAN DE CHAQUE RECEVEUR, dans le couloir de l'equipe : un trait epais, un second fin.
  const marques = G.relaisMarques || [];
  if (marques.length && G.player) {
    const e = Math.round(G.player.lane);
    for (const m of marques) {
      trait(m.d, e, 0.12, CYAN);
      trait(m.d - 0.6, e, 0.05, CYAN_PALE);
    }
  }
  traits.count = n;
  traits.instanceMatrix.needsUpdate = true;
  if (traits.instanceColor) traits.instanceColor.needsUpdate = true;
}

/**
 * QUI LA CAMERA SUIT AU RELAIS. Le meme choix que le dessin du jeu (`cibleRelais`, sprinter-app.js) :
 * le joueur quand il porte le temoin, sinon le porteur — jusqu'a ce que celui-ci arrive pres du
 * joueur qui l'attend, pour qu'on voie la transmission. Apres sa portion, on suit le temoin jusqu'a
 * la ligne. Rend null hors relais (la camera garde son coureur).
 */
export function suiviDuRelais(G: any): any {
  if (G.raceKey !== '4x100' || !G.player || G.player.relaisRang == null || G.spectateur) return null;
  const moi = G.player.relaisRang, p = G.relaisPorteur || 1;
  if (p === moi) return null;
  const porteur = (G.runners || []).find((r: any) => r !== G.player && r.relaisRang === p);
  if (!porteur) return null;
  if (p === moi - 1 && G.player.d - porteur.d <= 14) return null;
  return porteur;
}
