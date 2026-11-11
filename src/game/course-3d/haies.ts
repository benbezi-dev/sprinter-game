// LA COURSE EN VRAIE 3D — les haies (decoupe de course-3d.ts, 11/11/2026).

import * as THREE from 'three';
import { zSol } from '../salle-3d';
import { OMBRES } from './reglages';
import { monde } from './scene';
import { ici, salleActive } from './repere';

// --- LES HAIES ------------------------------------------------------------------
//
// « On passe Hurdlers en 3D aussi » (l'auteur, 29/10). Celles de haies-rendu.js, aux memes mesures : deux pieds
// de 70 cm tournes vers le coureur qui arrive, deux montants, une barre a bandes, claires aux deux bouts. Trois
// maillages instancies pour toutes les haies de la course (huit couloirs, dix haies). Une haie touchee bascule
// vers l'arrivee autour du bas de ses montants, comme dans le dessin du jeu. Le saut des coureurs, lui, vient
// du moteur (G.obstacles.preparer) : la 3D ne connait pas le reglement des haies.
const H_DEMI = 0.59, H_MONTANT = 0.555, H_PIED = 0.70, H_BARRE = 0.07, H_BANDES = [0.25, 0.215, 0.25, 0.215, 0.25];
const MAX_HAIES = 8 * 10;
let haies: THREE.InstancedMesh[] | null = null;
const _hB = new THREE.Matrix4(), _hR = new THREE.Matrix4(), _hP = new THREE.Matrix4();
const _hf = new THREE.Vector3(), _hl = new THREE.Vector3(), _hu = new THREE.Vector3(0, 0, 1);
const _hc = new THREE.Vector3(), _hs = new THREE.Vector3(), _hq = new THREE.Quaternion();
export function poserLesHaies(G: any, T: any, C: any) {
  const h = G.obstacles && G.obstacles.haies3D;
  if (!h) { if (haies) for (const m of haies) m.count = 0; return; }
  if (!haies) {
    const cube = new THREE.BoxGeometry(1, 1, 1);
    // le metal (pieds et montants), les bandes claires, les bandes sombres
    haies = ([[0xb0b6c4, 4], [0xf6f8fc, 3], [0x1c1e28, 2]] as const).map(([c, n]) => {
      const m = new THREE.InstancedMesh(cube, new THREE.MeshLambertMaterial({ color: c }), MAX_HAIES * n);
      m.frustumCulled = false; m.castShadow = OMBRES; monde.add(m); return m;
    });
  }
  const [metal, clair, sombre] = haies;
  const cpt = [0, 0, 0];
  const piece = (m: THREE.InstancedMesh, k: number, u: number, v: number, z: number, lu: number, lv: number, lz: number) => {
    _hP.compose(_hc.set(u, v, z), _hq, _hs.set(lu, lv, lz));
    m.setMatrixAt(cpt[k]++, _hP.premultiply(_hB));
  };
  const H = h.hauteur;
  for (let e = 0; e < C.LANE_COUNT; e++) {
    const centre = h.centre(T, C, e);
    for (let i = 0; i < h.positions.length && cpt[0] < MAX_HAIES * 4; i++) {
      const d = h.positions[i];
      const p0 = ici(T.posDemi(d, e, centre)), p1 = ici(T.posDemi(d + 1, e, centre));
      _hf.set(p1[0] - p0[0], p1[1] - p0[1], 0).normalize();
      _hl.crossVectors(_hu, _hf);
      _hB.makeBasis(_hf, _hl, _hu).setPosition(p0[0], p0[1], salleActive ? zSol(p0[0], p0[1]) : 0);
      // (la chute : le haut part vers l'arrivee, +u, autour du bas des montants)
      _hB.multiply(_hR.makeRotationY(h.chute(e, i, G) * Math.PI / 2));
      for (const v of [H_MONTANT, -H_MONTANT]) {
        piece(metal, 0, -H_PIED / 2, v, 0.02, H_PIED, 0.05, 0.04);
        piece(metal, 0, 0, v, (H - H_BARRE) / 2, 0.04, 0.04, H - H_BARRE);
      }
      let v0 = -H_DEMI;
      H_BANDES.forEach((l, k) => { piece(k % 2 ? sombre : clair, k % 2 ? 2 : 1, 0, v0 + l / 2, H - H_BARRE / 2, 0.03, l, H_BARRE); v0 += l; });
    }
  }
  haies.forEach((m, k) => { m.count = cpt[k]; m.instanceMatrix.needsUpdate = true; });
}
