// LE CHAMP-DE-MARS EN 3D (23/10/2026, « le stade du Champ-de-Mars n'est pas du tout comme
// je l'avais travaille »).
//
// Ce que l'auteur a travaille en 2D (decor-champ-de-mars.js, sprinter-app.js) : IL N'Y A PAS
// DE STADE. La piste est posee au milieu des parterres, entre des rideaux de tilleuls
// tailles au carre ; derriere, les facades creme a balcons filants et toits de zinc du
// septieme ; la tour au bout, sur l'horizon, a droite d'elle la montgolfiere BENBEZI ; la
// patrouille trace ses trois fumees ; dans la pelouse, un drapeau tondu et « FRANCE ».
// La piste tricolore et la tribune provisoire d'un gradin sont dans course-3d.ts.
//
// La tour et la montgolfiere sont les images Blender du 2D (public/decors*/champdemars,
// manifeste au pied et a l'echelle), en decoupes tournees vers la camera ; elles TIENNENT
// AU LOIN comme en 2D (« tenue a une position d'ecran ») : elles suivent la camera le long
// de la ligne droite, comme un objet a l'horizon. Le reste est construit.
//
// Repere : celui du stade de course-3d.ts — x le long de la ligne droite d'arrivee, y vers
// l'exterieur (la tribune, puis le parc), z en haut.

import * as THREE from 'three';
import MANIFESTE from './champ-de-mars-manifeste.json';

export type ContexteChamp = {
  stade: THREE.Group;
  W: number; R: number; D0: number; D1: number;
  hasard: () => number;
  /** le dossier des images (public/decors-ultra en ULTRA, public/decors sinon) */
  dossier: string;
};

const c3 = (r: number, g: number, b: number) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
export const BLEU = [18, 72, 196], BLANC = [236, 238, 246], ROUGE = [222, 34, 48];

function toile(dessin: (c: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  dessin(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return t;
}
const rgb = (v: number[], k = 1) => `rgb(${Math.min(255, v[0] * k) | 0},${Math.min(255, v[1] * k) | 0},${Math.min(255, v[2] * k) | 0})`;

class Lot {
  m: THREE.Matrix4[] = [];
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material, public ombre = false) {}
  poser(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rz = 0) {
    this.m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rz), new THREE.Vector3(sx, sy, sz)));
  }
  finir(g: THREE.Group) {
    if (!this.m.length) return;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.m.length);
    this.m.forEach((m, i) => im.setMatrixAt(i, m));
    im.frustumCulled = false; im.castShadow = this.ombre; im.receiveShadow = true;
    g.add(im);
  }
}

/** Une image du manifeste en panneau debout face a la ligne droite (plan x-z), le pied a
 *  l'origine, `haut` metres de haut. (Une decoupe Sprite ne sortait pas dans le monde en miroir.) */
function decoupe(dossier: string, cle: keyof typeof MANIFESTE.pieces, haut: number) {
  const p = MANIFESTE.pieces[cle] as { f: string; w: number; h: number; ax: number; ay: number };
  const t = new THREE.TextureLoader().load(dossier + p.f);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  const L = haut * p.w / p.h;
  const g = new THREE.PlaneGeometry(L, haut).rotateX(Math.PI / 2)
    .translate(-(p.ax / p.w - 0.5) * L, 0, (p.ay / p.h - 0.5) * haut);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.2, fog: false, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  return m;
}

export function construireChamp(o: ContexteChamp) {
  const { stade, W, R, D0, D1, hasard, dossier } = o;
  const ajoute = <M extends THREE.Object3D>(m: M) => { stade.add(m); return m; };
  const xc = (D0 + D1) / 2, yc = -R, yOpp = -2 * R - W;
  const x0 = D0 - R - W - 30, x1 = D1 + R + W + 30;

  // --- LES RIDEAUX DE TILLEULS, tailles au carre sur des troncs nus, coupes d'allees ----
  const feuillage = toile((c, w, h) => {
    c.fillStyle = '#3f6e2c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 0.75 + hasard() * 0.5;
      c.fillStyle = rgb([70, 120, 48], v);
      const x = hasard() * w, y = hasard() * h, r = 2 + hasard() * 5;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    const g = c.createLinearGradient(0, 0, 0, h);     // le dessous du rideau, dans l'ombre
    g.addColorStop(0, 'rgba(255,255,220,0.12)'); g.addColorStop(0.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,30,5,0.45)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, 512, 256);
  feuillage.wrapS = THREE.RepeatWrapping;
  const matFeuille = new THREE.MeshLambertMaterial({ map: feuillage });
  const rideaux: THREE.BufferGeometry[] = [];
  const troncs = new Lot(new THREE.CylinderGeometry(0.16, 0.22, 1, 7).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5a4636 }), true);
  const rangee = (ax: number, ay: number, ux: number, uy: number, L: number) => {
    for (let s = 0; s < L; s += 36) {
      const l = Math.min(30, L - s);
      if (l < 6) break;
      const cx = ax + ux * (s + l / 2), cy = ay + uy * (s + l / 2);
      const g = new THREE.BoxGeometry(ux ? l : 3.2, ux ? 3.2 : l, 5.5);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * l / 12);
      rideaux.push(g.translate(cx, cy, 3.2 + 2.75));
      for (let k = 2; k < l; k += 4) troncs.poser(ax + ux * (s + k), ay + uy * (s + k), 1.7, 1, 1, 3.4);
    }
  };
  rangee(x0, W + 26, 1, 0, x1 - x0);
  rangee(x0, yOpp - 26, 1, 0, x1 - x0);
  rangee(x0 - 4, yOpp - 26, 0, 1, W + 26 - yOpp + 26);
  rangee(x1 + 4, yOpp - 26, 0, 1, W + 26 - yOpp + 26);
  for (const g of rideaux) { const m = ajoute(new THREE.Mesh(g, matFeuille)); m.castShadow = true; m.receiveShadow = true; }

  // --- LES IFS, en cones, tous les six metres le long des allees ------------------------
  const ifs = new Lot(new THREE.ConeGeometry(0.85, 3.2, 10).rotateX(Math.PI / 2).translate(0, 0, 1.9), new THREE.MeshLambertMaterial({ color: 0x24502a }), true);
  const pieds = new Lot(new THREE.CylinderGeometry(0.1, 0.12, 0.4, 6).rotateX(Math.PI / 2).translate(0, 0, 0.2), new THREE.MeshLambertMaterial({ color: 0x5a4636 }));
  for (let x = x0 + 4; x < x1 - 4; x += 6) for (const y of [W + 17, yOpp - 17]) { ifs.poser(x, y, 0); pieds.poser(x, y, 0); }

  // --- LE SABLE CLAIR DES ALLEES, entre la piste et les rideaux -------------------------
  const sable = new THREE.MeshLambertMaterial({ color: c3(226, 214, 186) });
  for (const y of [W + 20.5, yOpp - 20.5]) {
    const m = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 7), sable)); m.position.set(xc, y, -0.05); m.receiveShadow = true;
  }

  // --- LES FACADES DU SEPTIEME : pierre creme, balcons filants, toits de zinc ----------
  const facade = toile((c, w, h) => {
    c.fillStyle = '#e8d8ba'; c.fillRect(0, 0, w, h);
    const etages = 7, hE = h / (etages + 0.6);
    for (let e = 0; e < etages; e++) {
      const y = h - (e + 1) * hE;
      c.fillStyle = 'rgba(150,120,80,0.25)'; c.fillRect(0, y + hE - 3, w, 3);      // le cordon
      for (let k = 0; k < 9; k++) {
        const x = (k + 0.5) * w / 9 - w / 9 * 0.2;
        c.fillStyle = e === 0 ? '#5a4a3a' : '#3c4656';
        c.fillRect(x, y + hE * 0.22, w / 9 * 0.4, hE * 0.62);
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x, y + hE * 0.22, w / 9 * 0.4, hE * 0.1);
      }
      if (e === 1 || e === 4) {                                 // les balcons filants
        c.fillStyle = '#2a2e36'; c.fillRect(0, y + hE * 0.78, w, hE * 0.06);
        for (let x = 0; x < w; x += 6) c.fillRect(x, y + hE * 0.66, 2, hE * 0.13);
      }
    }
  }, 512, 512);
  const matPierre = new THREE.MeshLambertMaterial({ map: facade });
  const matZinc = new THREE.MeshLambertMaterial({ color: c3(110, 126, 150) });
  const ilots = new Lot(new THREE.BoxGeometry(1, 1, 1), matPierre);
  const toits = new Lot(new THREE.CylinderGeometry(0.62, 1, 1, 4, 1).rotateY(Math.PI / 4).rotateX(Math.PI / 2), matZinc);
  const cheminees = new Lot(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: c3(176, 120, 96) }));
  const pose = (x: number, y: number, long: number, prof: number, sur: 'x' | 'y') => {
    const h = 16 + hasard() * 3, lx = sur === 'x' ? long : prof, ly = sur === 'x' ? prof : long;
    ilots.poser(x, y, h / 2, lx, ly, h);
    toits.poser(x, y, h + 2.6, lx * 0.71, ly * 0.71, 5.2);
    for (let k = 0; k < 3; k++) cheminees.poser(x + (sur === 'x' ? (k - 1) * long * 0.3 : 0), y + (sur === 'y' ? (k - 1) * long * 0.3 : 0), h + 5, 0.8, 0.8, 2.4);
  };
  for (let x = x0 - 90; x < x1 + 90; x += 30) { pose(x, W + 110 + hasard() * 6, 27, 16, 'x'); pose(x, yOpp - 110 - hasard() * 6, 27, 16, 'x'); }
  for (let y = yOpp - 100; y < W + 100; y += 30) { pose(x0 - 90, y, 27, 16, 'y'); pose(x1 + 90, y, 27, 16, 'y'); }

  for (const l of [troncs, ifs, pieds, ilots, toits, cheminees]) l.finir(stade);

  // --- DANS LA PELOUSE : le drapeau tondu et FRANCE --------------------------------------
  const tondu = toile((c, w, h) => {
    c.clearRect(0, 0, w, h);
    [BLEU, BLANC, ROUGE].forEach((v, i) => { c.fillStyle = rgb(v); c.fillRect(i * w / 3, 0, w / 3, h); });
  }, 96, 64);
  const drapeau = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(10.5, 7), new THREE.MeshLambertMaterial({ map: tondu, transparent: true, opacity: 0.85 })));
  drapeau.position.set(62, -12, 0.01);
  drapeau.scale.x = -1;                         // le monde est en miroir : le bleu reste a la hampe, a gauche
  const mot = toile((c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.8)';
    c.font = `900 ${h * 0.86}px system-ui, -apple-system, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('FRANCE', w / 2, h / 2 + h * 0.04);
  }, 1024, 160);
  const france = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(21, 3.3), new THREE.MeshLambertMaterial({ map: mot, transparent: true })));
  france.position.set(36, -12, 0.012); france.scale.x = -1;

  // --- LA TOUR, LA MONTGOLFIERE, LA PATROUILLE : au loin, tenues a l'horizon ------------
  const tour = ajoute(decoupe(dossier, 'tour', 175));
  const ballon = ajoute(decoupe(dossier, 'montgolfiere', 52));
  ballon.scale.x = -1;                          // le monde est en miroir : BENBEZI se lit a l'endroit
  const fumee = (v: number[]) => toile((c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, `rgba(${v[0]},${v[1]},${v[2]},0)`); g.addColorStop(0.85, `rgba(${v[0]},${v[1]},${v[2]},0.75)`);
    g.addColorStop(1, `rgba(${v[0]},${v[1]},${v[2]},0.95)`);
    c.fillStyle = g;
    for (let x = 0; x < w; x += 2) { const e = h * (0.25 + 0.2 * (x / w)); c.fillRect(x, h / 2 - e / 2, 2, e); }
  }, 512, 32);
  const trainees = [BLEU, [250, 250, 250], ROUGE].map((v, i) => {
    const m = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(260, 9).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: fumee(v), transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide })));
    m.userData.dz = i * 7;
    return m;
  });
  // TENUES A L'HORIZON, comme en 2D (« tenue a une position d'ecran ») : la tour se pose a
  // 650 m dans la direction ou regarde la camera — au bout de la ligne droite au depart, de
  // trois quarts pendant la course —, le cap borne entre les deux (le survol ne la fait pas
  // tourner autour du stade). Le ballon oscille a sa droite, la patrouille passe devant.
  let capLisse = 0.5;
  return (t: number, camX: number, camY: number, cap: number) => {
    const c = Math.min(Math.PI / 2, Math.max(0, cap));
    capLisse += (c - capLisse) * 0.08;
    const loin = (a: number, d: number) => [camX + Math.cos(a) * d, camY + Math.sin(a) * d];
    const [tx, ty] = loin(capLisse + 0.1, 650);
    tour.position.set(tx, ty, -12); tour.rotation.z = capLisse + 0.1 - Math.PI / 2;   // de face, toujours
    const [bx, by] = loin(capLisse - 0.16, 380);
    ballon.position.set(bx + Math.sin(t * 0.13) * 4, by, 46 + Math.sin(t * 0.4) * 2.5); ballon.rotation.z = capLisse - 0.16 - Math.PI / 2;
    // la patrouille traverse le ciel en quarante secondes, puis revient
    const u = (t % 40) / 40, [px, py] = loin(capLisse + 0.5 - u, 520);
    for (const m of trainees) { m.position.set(px, py, 135 - m.userData.dz - u * 25); m.rotation.z = capLisse + 0.5 - u - Math.PI / 2; }
  };
}
