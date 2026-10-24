// LES STADES DE LA CARRIERE CLASSIQUE EN 3D (23/10/2026, l'auteur : « ameliore les decors des
// stades du mode carriere classique »).
//
// Le 3D construisait pour eux le stade generique aux couleurs du theme, avec des blocs verts
// en guise d'arbres. Ce module reprend ce que le 2D leur donne en propre (sprinter-app.js,
// THEMES) sans toucher aux tribunes (« non surtout pas », 22/10 : on ne les reduit pas) :
//   - LES ARBRES DU LIEU : le rideau de platanes du stade de jour (`feuillus`), les palmiers
//     de la Riviera (`arbres: 'palmier'`), les cypres de la Nuit etoilee (`arbres: 'cypres'`) ;
//   - LA RIVIERA (`piscine`, `transats`, `immeubles`, `haie`, `lointain`) : la piscine et ses
//     transats au milieu de la pelouse, des palmiers autour, la haie fleurie au bord, les
//     hotels blancs derriere les tribunes, la mer jusqu'a l'horizon, un avion qui passe ;
//   - LA NUIT ETOILEE (`tourbillons`, `village`, `pinceau`) : le ciel tourbillonnant a la
//     Van Gogh sur toute la voute, ses astres a halo, la lune, le hameau aux fenetres
//     allumees tout autour.
// Repere : celui du stade de course-3d.ts — x le long de la ligne droite, y vers la tribune
// principale, z en haut ; le centre de l'ovale est en (xc, -R).

import * as THREE from 'three';
import { flotter, toileDeDrapeau } from './drapeau-3d';

export type ContexteClassique = {
  stade: THREE.Group;
  th: any;
  W: number; R: number; D0: number; D1: number;
  hasard: () => number;
};

const c3 = (v: number[]) => new THREE.Color().setRGB(v[0] / 255, v[1] / 255, v[2] / 255, THREE.SRGBColorSpace);
const rgb = (v: number[], k = 1, a = 1) => `rgba(${Math.min(255, v[0] * k) | 0},${Math.min(255, v[1] * k) | 0},${Math.min(255, v[2] * k) | 0},${a})`;

function toile(dessin: (c: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  dessin(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return t;
}

class Lot {
  m: THREE.Matrix4[] = []; c: (THREE.Color | null)[] = [];
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material) {}
  poser(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rz = 0, c: THREE.Color | null = null) {
    this.m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rz), new THREE.Vector3(sx, sy, sz)));
    this.c.push(c);
  }
  finir(g: THREE.Group) {
    if (!this.m.length) return;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.m.length);
    this.m.forEach((m, i) => { im.setMatrixAt(i, m); if (this.c[i]) im.setColorAt(i, this.c[i]!); });
    im.frustumCulled = false; im.receiveShadow = true;
    g.add(im);
  }
}

/** Les arbres du lieu, tout autour du stade, au-dela des tribunes. Rend vrai s'il en a pose. */
export function arbresDuLieu(o: ContexteClassique): boolean {
  const { stade, th, R, D0, D1, hasard } = o;
  const xc = (D0 + D1) / 2, yc = -R;
  const sorte: 'platane' | 'palmier' | 'cypres' | null = th.arbres === 'palmier' ? 'palmier' : th.arbres === 'cypres' ? 'cypres'
    : th.feuillus ? 'platane' : null;
  if (!sorte) return false;
  const anneau = (n: number, f: (x: number, y: number, k: number) => void) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (hasard() - 0.5) * 0.05;
      const rx = 150 + hasard() * 34, ry = 98 + hasard() * 26;
      f(xc + rx * Math.cos(a), yc + ry * Math.sin(a), i);
    }
  };
  if (sorte === 'platane') {
    // LE RIDEAU DE PLATANES : des troncs clairs tachetes, une ramure faite de cinq masses
    const feuille = th.feuillage || [44, 104, 38];
    const tronc = new Lot(new THREE.CylinderGeometry(0.32, 0.5, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xb8ac90 }));
    const masse = new Lot(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    anneau(130, (x, y) => {
      const h = 9 + hasard() * 5;
      tronc.poser(x, y, 0, 1, 1, h * 0.6);
      for (let k = 0; k < 5; k++) {
        const r = 2.6 + hasard() * 1.6, a = hasard() * Math.PI * 2, d = k ? 1.8 + hasard() * 1.4 : 0;
        const v = 0.78 + hasard() * 0.38;
        masse.poser(x + Math.cos(a) * d, y + Math.sin(a) * d, h * 0.62 + (k ? hasard() * 2.4 : 2.2), r * 1.15, r * 1.15, r * 0.9, a,
          c3(feuille.map((c: number) => c * v)));
      }
    });
    tronc.finir(stade); masse.finir(stade);
  } else if (sorte === 'palmier') {
    palmiers(o, (f) => anneau(110, (x, y) => f(x, y, 12 + hasard() * 8)));
  } else {
    // LES CYPRES : des flammes sombres, droites, plus claires d'un cote
    const sombre = th.cypresSombre || [16, 38, 34], clair = th.cypresClair || [48, 88, 58];
    const flamme = new THREE.LatheGeometry([[0.05, 0], [0.9, 0.6], [1.25, 2.2], [1.2, 4.6], [0.9, 7.2], [0.45, 9.4], [0.02, 10.6]]
      .map(([r, h]) => new THREE.Vector2(r, h)), 10).rotateX(Math.PI / 2);
    const cy = new Lot(flamme, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    anneau(150, (x, y) => {
      const k = 1.3 + hasard() * 1.3;
      cy.poser(x, y, 0, k * 0.9, k * 0.9, k * (1.4 + hasard() * 0.6), hasard() * 6, c3(sombre.map((c: number, i: number) => c + (clair[i] - c) * hasard() * 0.6)));
    });
    cy.finir(stade);
  }
  return true;
}

/** Des palmiers : un stipe courbe, une couronne de palmes retombantes. */
function palmiers(o: ContexteClassique, placer: (f: (x: number, y: number, h: number) => void) => void) {
  const { stade, th, hasard } = o;
  const troncC = th.palmTrunk || [206, 172, 132], feuilleC = th.palmLeaf || [20, 122, 100];
  const palme = toile((c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = rgb(feuilleC, 0.7); c.lineWidth = 4;
    c.beginPath(); c.moveTo(0, h / 2); c.quadraticCurveTo(w * 0.5, h * 0.42, w, h / 2); c.stroke();
    for (let i = 4; i < w - 6; i += 7) {
      const u = i / w, l = h * 0.46 * Math.sin(Math.PI * Math.min(1, u * 1.15));
      c.strokeStyle = rgb(feuilleC, 0.85 + 0.3 * ((i / 7) % 2)); c.lineWidth = 3;
      c.beginPath(); c.moveTo(i, h / 2); c.lineTo(i + 10, h / 2 - l); c.moveTo(i, h / 2); c.lineTo(i + 10, h / 2 + l); c.stroke();
    }
  }, 256, 96);
  const matPalme = new THREE.MeshLambertMaterial({ map: palme, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
  const geoPalme = new THREE.PlaneGeometry(5.2, 1.9, 6, 1).translate(2.6, 0, 0);
  // la palme retombe : on courbe ses sommets vers le bas, du coeur a la pointe
  const pp = geoPalme.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i); pp.setZ(i, -0.09 * x * x); }
  geoPalme.computeVertexNormals();
  const palmes = new Lot(geoPalme, matPalme);
  const stipe = new Lot(new THREE.CylinderGeometry(0.22, 0.32, 1, 7).rotateX(Math.PI / 2).translate(0, 0, 0.5),
    new THREE.MeshLambertMaterial({ color: c3(troncC) }));
  placer((x, y, h) => {
    const pente = (hasard() - 0.5) * 0.5, a0 = hasard() * Math.PI * 2;
    // le stipe en quatre troncons qui s'inclinent un peu plus a chaque fois
    let px = x, py = y, pz = 0;
    for (let k = 0; k < 4; k++) {
      const l = h / 4, inc = pente * (k + 1) * 0.3;
      const m = new THREE.Matrix4().makeTranslation(px, py, pz)
        .multiply(new THREE.Matrix4().makeRotationZ(a0)).multiply(new THREE.Matrix4().makeRotationY(inc))
        .multiply(new THREE.Matrix4().makeScale(1 - k * 0.08, 1 - k * 0.08, l));
      stipe.m.push(m); stipe.c.push(null);
      px += Math.cos(a0) * Math.sin(inc) * l; py += Math.sin(a0) * Math.sin(inc) * l; pz += Math.cos(inc) * l;
    }
    for (let k = 0; k < 9; k++) {
      const a = a0 + (k / 9) * Math.PI * 2 + hasard() * 0.3;
      const m = new THREE.Matrix4().makeTranslation(px, py, pz)
        .multiply(new THREE.Matrix4().makeRotationZ(a)).multiply(new THREE.Matrix4().makeRotationY(-0.25 - hasard() * 0.35))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 * (k % 2 ? 0.15 : -0.15)));
      palmes.m.push(m); palmes.c.push(null);
    }
  });
  stipe.finir(stade); palmes.finir(stade);
}

/** LA RIVIERA : la piscine et ses transats, les palmiers, la haie fleurie, les hotels, la mer,
 *  l'avion. Rend la fonction d'animation (l'avion qui passe). */
export function riviera(o: ContexteClassique): (t: number) => void {
  const { stade, th, W, R, D0, D1, hasard } = o;
  const xc = (D0 + D1) / 2, yc = -R;
  const ajoute = <M extends THREE.Object3D>(m: M) => { stade.add(m); return m; };
  // LA MER jusqu'a l'horizon, tout autour, au-dela des hotels
  const mer = toile((c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgb(th.lointain || [96, 198, 224])); g.addColorStop(1, rgb(th.lointainFond || [18, 104, 168]));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(255,255,255,${0.1 + hasard() * 0.25})`; c.fillRect(hasard() * w, hasard() * h, 3 + hasard() * 8, 1); }
  }, 512, 512);
  mer.wrapS = mer.wrapT = THREE.RepeatWrapping; mer.repeat.set(24, 24);
  const pm = ajoute(new THREE.Mesh(new THREE.RingGeometry(260, 2400, 96, 1), new THREE.MeshStandardMaterial({ map: mer, roughness: 0.25, metalness: 0.1 })));
  pm.position.set(xc, yc, -0.3);
  // LES HOTELS BLANCS, en arc derriere les tribunes : balcons, baies bleues, toits-terrasses
  const facade = toile((c, w, h) => {
    c.fillStyle = '#f4f0e6'; c.fillRect(0, 0, w, h);
    for (let e = 0; e < 12; e++) {
      const y = e * h / 12;
      c.fillStyle = 'rgba(40,120,170,0.85)';
      for (let k = 0; k < 6; k++) c.fillRect(k * w / 6 + 6, y + 6, w / 6 - 12, h / 12 - 14);
      c.fillStyle = 'rgba(255,255,255,0.95)'; c.fillRect(0, y + h / 12 - 8, w, 5);
      c.fillStyle = 'rgba(120,120,130,0.4)'; c.fillRect(0, y + h / 12 - 3, w, 2);
    }
  }, 256, 512);
  const hotels = new Lot(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5), new THREE.MeshLambertMaterial({ map: facade }));
  for (let i = 0; i < 26; i++) {
    const a = -0.35 + (i / 25) * (Math.PI + 0.7), r = 200 + hasard() * 40;
    const x = xc + Math.cos(a) * r * 1.25, y = yc + Math.sin(a) * r;
    if (y < yc - 40) continue;
    const l = 26 + hasard() * 22;
    hotels.poser(x, y, 0, l, 16, 34 + hasard() * 30, a + Math.PI / 2);
  }
  hotels.finir(stade);
  // LA PISCINE, au milieu de la pelouse, son eau qui brille, sa margelle blanche
  const eau = toile((c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgb(th.eau || [96, 214, 226])); g.addColorStop(1, rgb(th.eauFond || [22, 146, 190]));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2;
    for (let i = 0; i < 40; i++) { c.beginPath(); const x = hasard() * w, y = hasard() * h; c.moveTo(x, y); c.bezierCurveTo(x + 20, y - 8, x + 40, y + 8, x + 60, y); c.stroke(); }
  }, 512, 256);
  const piscine = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(26, 12), new THREE.MeshStandardMaterial({ map: eau, roughness: 0.05, metalness: 0.2 })));
  piscine.position.set(xc, yc, 0.06);
  const blanc = new THREE.MeshLambertMaterial({ color: 0xf6f4ee });
  for (const [x, y, lx, ly] of [[0, 6.6, 28, 1.2], [0, -6.6, 28, 1.2], [13.6, 0, 1.2, 12], [-13.6, 0, 1.2, 12]]) {
    const b = ajoute(new THREE.Mesh(new THREE.BoxGeometry(lx, ly, 0.3), blanc)); b.position.set(xc + x, yc + y, 0.15);
  }
  // LES TRANSATS, en rangs le long de la piscine, et leurs parasols
  const toileT = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const assise = new Lot(new THREE.BoxGeometry(0.7, 1.4, 0.12), toileT), dossier = new Lot(new THREE.BoxGeometry(0.7, 0.75, 0.1), toileT);
  const mat = new Lot(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6).rotateX(Math.PI / 2).translate(0, 0, 1.2), new THREE.MeshLambertMaterial({ color: 0xdcd6c8 }));
  const ombrelle = new Lot(new THREE.ConeGeometry(1.5, 0.55, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 2.5),
    new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  const rayures = [[236, 87, 87], [242, 201, 76], [45, 156, 219], [255, 255, 255], [86, 206, 208]];
  for (const s of [-1, 1]) for (let k = 0; k < 9; k++) {
    const x = xc - 12 + k * 3, y = yc + s * 9.2;
    const col = c3(rayures[(k + (s > 0 ? 2 : 0)) % rayures.length]);
    assise.poser(x, y, 0.4, 1, 1, 1, 0, col);
    const dm = new THREE.Matrix4().makeTranslation(x, y + s * 0.85, 0.65).multiply(new THREE.Matrix4().makeRotationX(s * 0.9));
    dossier.m.push(dm); dossier.c.push(col);
    if (k % 2 === 0) { mat.poser(x + 1.5, y, 0); ombrelle.poser(x + 1.5, y, 0, 1, 1, 1, 0, c3(rayures[(k / 2 + (s > 0 ? 1 : 3)) % rayures.length])); }
  }
  for (const l of [assise, dossier, mat, ombrelle]) l.finir(stade);
  // DES PALMIERS autour de la piscine, et dans les virages
  palmiers(o, (f) => {
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; f(xc + Math.cos(a) * 19, yc + Math.sin(a) * 15, 9 + hasard() * 4); }
    for (const cx of [D0, D1]) for (let k = 0; k < 4; k++) {
      const a = -1.1 + k * 0.73; f(cx + (cx === D1 ? 1 : -1) * Math.cos(a) * (R - 9), yc + Math.sin(a) * (R - 9), 8 + hasard() * 4);
    }
  });
  // LA HAIE FLEURIE, basse, au bord de la pelouse : du vert sombre pique de bougainvilliers
  const fleurs = toile((c, w, h) => {
    c.fillStyle = rgb(th.haieSombre || [24, 104, 76]); c.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) {
      c.fillStyle = hasard() < 0.55 ? `rgba(${220 + hasard() * 35 | 0},${40 + hasard() * 60 | 0},${140 + hasard() * 60 | 0},0.9)` : rgb(th.haieSombre || [24, 104, 76], 1.3 + hasard() * 0.4);
      c.beginPath(); c.arc(hasard() * w, hasard() * h, 1.5 + hasard() * 3, 0, Math.PI * 2); c.fill();
    }
  }, 256, 64);
  fleurs.wrapS = THREE.RepeatWrapping; fleurs.repeat.set((D1 - D0) / 4, 1);
  const matHaie = new THREE.MeshLambertMaterial({ map: fleurs });
  for (const y of [-4.2, -2 * R + 4.2]) {
    const h = ajoute(new THREE.Mesh(new THREE.BoxGeometry(D1 - D0 - 10, 0.9, 0.75), matHaie)); h.position.set(xc, y, 0.37);
  }
  // L'AVION, qui traverse le ciel avec sa trainee
  const avion = ajoute(new THREE.Group());
  const fuselage = new THREE.MeshLambertMaterial({ color: 0xf2f4f8 });
  avion.add(new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 22, 4, 10).rotateZ(Math.PI / 2), fuselage));
  const aile = new THREE.Mesh(new THREE.BoxGeometry(5, 30, 0.4), fuselage); aile.position.x = 1; avion.add(aile);
  const derive = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 5), fuselage); derive.position.set(-11, 0, 2.6); avion.add(derive);
  const trainee = new THREE.Mesh(new THREE.PlaneGeometry(500, 2.4).translate(-262, 0, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
    opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, fog: false, map: toile((c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 256, 8) }));
  trainee.rotation.x = Math.PI / 2; avion.add(trainee);
  return (t: number) => {
    const u = (t % 70) / 70;
    avion.position.set(xc - 900 + u * 1800, yc + 420, 260);
  };
}

/** LA NUIT ETOILEE : le ciel tourbillonnant sur toute la voute, astres et lune, le hameau. */
export function nuitEtoilee(o: ContexteClassique): (t: number) => void {
  const { stade, th, R, D0, D1, hasard } = o;
  const xc = (D0 + D1) / 2, yc = -R;
  const ajoute = <M extends THREE.Object3D>(m: M) => { stade.add(m); return m; };
  // LE CIEL DE VAN GOGH : un bleu profond, des tourbillons de touches claires, des volutes
  const ciel = toile((c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a1848'); g.addColorStop(0.5, rgb(th.skyBot || [42, 88, 156])); g.addColorStop(1, '#1c3c78');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.lineCap = 'round';
    // des touches courtes qui suivent un champ de volutes
    const centres = Array.from({ length: 9 }, () => [hasard() * w, h * (0.15 + hasard() * 0.5), 60 + hasard() * 140, hasard() < 0.5 ? 1 : -1]);
    for (let i = 0; i < 9000; i++) {
      let x = hasard() * w, y = hasard() * h * 0.85;
      let a = 0, k = 0;
      for (const [cx, cy, r, s] of centres) {
        const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
        const p = Math.exp(-d / r);
        a += (Math.atan2(dy, dx) + s * Math.PI / 2) * p; k += p;
      }
      a = k > 0.05 ? a / k : 0.15 * Math.sin(y * 0.02);
      const l = 6 + hasard() * 10, clair = hasard();
      c.strokeStyle = clair < 0.35 ? `rgba(${150 + hasard() * 60 | 0},${190 + hasard() * 50 | 0},${230 + hasard() * 25 | 0},0.55)`
        : clair < 0.45 ? `rgba(240,226,140,0.5)` : `rgba(${30 + hasard() * 40 | 0},${70 + hasard() * 50 | 0},${150 + hasard() * 60 | 0},0.5)`;
      c.lineWidth = 2 + hasard() * 2.5;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    // les astres a halo : des cercles concentriques jaunes et blancs
    for (let i = 0; i < 14; i++) {
      const x = hasard() * w, y = h * (0.08 + hasard() * 0.45), r = 6 + hasard() * 10;
      for (let k = 4; k >= 0; k--) {
        c.fillStyle = k === 0 ? 'rgba(255,250,210,1)' : `rgba(${230 - k * 10},${210 - k * 8},${120 + k * 20},${0.16 + 0.05 * (4 - k)})`;
        c.beginPath(); c.arc(x, y, r * (1 + k * 0.8), 0, Math.PI * 2); c.fill();
      }
    }
  }, 2048, 1024);
  ciel.wrapS = THREE.RepeatWrapping;
  const voute = ajoute(new THREE.Mesh(new THREE.SphereGeometry(540, 48, 24), new THREE.MeshBasicMaterial({ map: ciel, side: THREE.BackSide, fog: false, depthWrite: false })));
  voute.rotation.x = Math.PI / 2; voute.position.set(xc, yc, -40); voute.renderOrder = -10;
  // la lune, un croissant dans son halo
  const lune = ajoute(new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, depthWrite: false, map: toile((c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,236,150,0.9)'); g.addColorStop(0.25, 'rgba(255,220,120,0.5)'); g.addColorStop(1, 'rgba(255,200,90,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff3b8'; c.beginPath(); c.arc(w / 2, h / 2, w * 0.14, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(w / 2 + w * 0.07, h / 2 - w * 0.04, w * 0.13, 0, Math.PI * 2); c.fill();
  }, 256, 256) })));
  lune.position.set(xc + 260, yc + 380, 230); lune.scale.set(150, 150, 1);
  // LE HAMEAU : des maisons basses aux fenetres allumees, en anneau, tres loin
  const mur = toile((c, w, h) => {
    c.fillStyle = rgb(th.villageSombre || [12, 24, 56]); c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) if (hasard() < 0.7) { c.fillStyle = 'rgba(255,214,110,0.95)'; c.fillRect(8 + i * 15, 12 + hasard() * 10, 7, 9); }
  }, 64, 40);
  const maisons = new Lot(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ map: mur }));
  const toits = new Lot(new THREE.ConeGeometry(0.75, 0.6, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4), new THREE.MeshBasicMaterial({ color: c3((th.villageSombre || [12, 24, 56]).map((v: number) => v * 0.7)) }));
  const clocher = new Lot(new THREE.ConeGeometry(0.9, 12, 6).rotateX(Math.PI / 2).translate(0, 0, 6), new THREE.MeshBasicMaterial({ color: c3((th.villageSombre || [12, 24, 56]).map((v: number) => v * 0.8)) }));
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2 + hasard() * 0.03, r = 235 + hasard() * 30;
    const x = xc + Math.cos(a) * r * 1.2, y = yc + Math.sin(a) * r, l = 7 + hasard() * 6, h = 5 + hasard() * 4;
    maisons.poser(x, y, 0, l, 6, h, a + Math.PI / 2);
    toits.poser(x, y, h + 1.5, l * 0.9, 5.2, 5, a + Math.PI / 2);
    if (i % 23 === 7) clocher.poser(x + 4, y, 0, 1.6, 1.6, 2.6);
  }
  for (const l of [maisons, toits, clocher]) l.finir(stade);
  return (t: number) => { voute.rotation.y = t * 0.004; };
}

/** La pelouse « a coups de pinceau » de la Nuit etoilee (`pinceau`) : une toile pour course-3d. */
export function pelouseAuPinceau(th: any, hasard: () => number) {
  return toile((c, w, h) => {
    c.fillStyle = rgb(th.grass || [26, 68, 72]); c.fillRect(0, 0, w, h);
    c.lineCap = 'round';
    for (let i = 0; i < 1400; i++) {
      const x = hasard() * w, y = hasard() * h, a = -0.6 + hasard() * 1.2, l = 6 + hasard() * 12;
      c.strokeStyle = hasard() < 0.5 ? rgb(th.grassEdge || [46, 108, 98], 0.9 + hasard() * 0.4, 0.7) : rgb(th.grass || [26, 68, 72], 0.7 + hasard() * 0.5, 0.7);
      c.lineWidth = 2 + hasard() * 3;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
  }, 256, 256);
}

/** 0.GAMES (etape 4) : le grand evenement, tout a fait distinct du Championnat du monde (etape
 *  3), qui gardait le meme materiel sur la pelouse (« distingue-les completement », 23/10).
 *  La vasque et sa flamme au bout du stade, une grande arche blanche haubanee au-dessus de la
 *  tribune, l'anneau des drapeaux, un ruban LED vert qui court, le podium, et 0.GAMES peint
 *  dans la pelouse. Rend la fonction d'animation (flamme, drapeaux, ruban). */
export function zeroGames(o: ContexteClassique): (t: number) => void {
  const { stade, th, W, R, D0, D1, hasard } = o;
  const xc = (D0 + D1) / 2, yc = -R, rS = R + W + 3.2;
  const ajoute = <M extends THREE.Object3D>(m: M) => { stade.add(m); return m; };
  const vert = c3(th.kerb || [56, 196, 92]), blancMetal = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, metalness: 0.4, roughness: 0.35 });
  // L'ARCHE, de part et d'autre de la tribune principale, et ses haubans
  const yA = W + 34;
  const courbe = new THREE.CatmullRomCurve3([[D0 - 30, 0], [D0 + 5, 40], [xc, 64], [D1 - 5, 40], [D1 + 30, 0]]
    .map(([x, z]) => new THREE.Vector3(x, yA, z)));
  ajoute(new THREE.Mesh(new THREE.TubeGeometry(courbe, 80, 1.3, 12, false), blancMetal)).castShadow = false;
  const haubans: number[] = [];
  for (let i = 1; i < 12; i++) {
    const p = courbe.getPoint(i / 12);
    if (p.z < 8) continue;
    haubans.push(p.x, p.y, p.z, p.x, W + 18, 21.6);
  }
  const gh = new THREE.BufferGeometry(); gh.setAttribute('position', new THREE.Float32BufferAttribute(haubans, 3));
  ajoute(new THREE.LineSegments(gh, new THREE.LineBasicMaterial({ color: 0xdfe3e8 })));
  // LA VASQUE, sur son trepied, au-dela du virage d'arrivee, et sa flamme
  // dans l'axe de la ligne droite : la camera de depart l'a droit devant elle, au-dessus du virage
  const xv = D1 + rS + 40, yv = W + 34, hv = 46;   // au-dessus de la ligne du toit, vue du depart
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2, bx = xv + Math.cos(a) * 9, by = yv + Math.sin(a) * 9;
    const pied = new THREE.Vector3(bx, by, 0), haut = new THREE.Vector3(xv + Math.cos(a) * 2.5, yv + Math.sin(a) * 2.5, hv);
    const l = pied.distanceTo(haut);
    const m = ajoute(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, l, 10), blancMetal));
    m.position.copy(pied).add(haut).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), haut.clone().sub(pied).normalize());
  }
  const vasque = ajoute(new THREE.Mesh(new THREE.LatheGeometry([[0.5, 0], [3.2, 0.6], [5.2, 2.4], [5.6, 3.4], [5.0, 3.5]].map(([r, h]) => new THREE.Vector2(r, h)), 32)
    .rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 0.8, roughness: 0.3 })));
  vasque.position.set(xv, yv, hv);
  const feu = toile((c, w, h) => {
    const g = c.createRadialGradient(w / 2, h * 0.8, 0, w / 2, h * 0.8, w / 2);
    g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.3, 'rgba(255,190,60,0.85)'); g.addColorStop(0.7, 'rgba(255,90,20,0.4)'); g.addColorStop(1, 'rgba(255,40,0,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(w / 2, 0); c.quadraticCurveTo(w, h * 0.6, w / 2, h); c.quadraticCurveTo(0, h * 0.6, w / 2, 0); c.fill();
  }, 128, 256);
  const flammes = [0, 1, 2, 3].map(k => {
    const s = ajoute(new THREE.Sprite(new THREE.SpriteMaterial({ map: feu, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })));
    s.center.set(0.5, 0.05); s.position.set(xv + (k - 1.5) * 1.2, yv, hv + 3.2); return s;
  });
  const halo = ajoute(new THREE.Sprite(new THREE.SpriteMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.55,
    map: toile((c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,170,70,1)'); g.addColorStop(1, 'rgba(255,120,30,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 128, 128) })));
  halo.position.set(xv, yv, hv + 6); halo.scale.set(34, 34, 1);
  // L'ANNEAU DES DRAPEAUX, en haut des tribunes : des bandes de couleurs, toutes differentes
  const motifs = [[[0, 85, 164], [255, 255, 255], [239, 65, 53]], [[0, 140, 69], [244, 249, 255], [205, 33, 42]], [[0, 0, 0], [221, 0, 0], [255, 206, 0]],
    [[0, 122, 61], [252, 209, 22], [206, 17, 38]], [[0, 56, 168], [252, 209, 22], [0, 56, 168]], [[220, 20, 60], [255, 255, 255], [220, 20, 60]],
    [[0, 106, 167], [254, 204, 0], [0, 106, 167]], [[255, 153, 51], [255, 255, 255], [19, 136, 8]], [[0, 158, 96], [255, 255, 255], [0, 158, 96]]];
  const mats = motifs.map((m, i) => flotter(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, map: toile((c, w, h) => {
    m.forEach((v, k) => { c.fillStyle = rgb(v); if (i % 2) c.fillRect(0, k * h / 3, w, h / 3); else c.fillRect(k * w / 3, 0, w / 3, h); });
  }, 96, 64) }), 0.3));
  const fut = new Lot(new THREE.CylinderGeometry(0.06, 0.08, 6, 6).rotateX(Math.PI / 2).translate(0, 0, 3), new THREE.MeshLambertMaterial({ color: 0xd0d4da }));
  const drapeaux: THREE.Mesh[] = [];
  const mat = (x: number, y: number, z: number, i: number) => {
    fut.poser(x, y, z);
    const d = ajoute(new THREE.Mesh(toileDeDrapeau(2.4, 1.5).translate(1.2, 0, 0).rotateX(Math.PI / 2), mats[i % mats.length]));
    d.position.set(x, y, z + 5.2); d.userData.ph = hasard() * 6; drapeaux.push(d);
  };
  let i = 0;
  for (let x = D0 + 4; x < D1; x += 9) { mat(x, W + 3.2 + 27.5, 21.5, i++); mat(x, -2 * R - W - 3.2 - 14, 9.9, i++); }
  for (const [cx, s] of [[D1, 1], [D0, -1]] as const) for (let k = 0; k <= 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI, r = rS + 14;
    mat(cx + s * Math.cos(a) * r, yc + Math.sin(a) * r, 9.9, i++);
  }
  fut.finir(stade);
  // LE RUBAN LED, tout autour, au bord du toit : un vert qui court
  const ruban = toile((c, w, h) => {
    c.fillStyle = '#04100a'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { const g = c.createLinearGradient(x, 0, x + 32, 0); g.addColorStop(0, rgb([56, 196, 92], 1, 0)); g.addColorStop(0.8, rgb([120, 255, 150], 1, 1)); g.addColorStop(1, rgb([56, 196, 92], 1, 0)); c.fillStyle = g; c.fillRect(x, 2, 32, h - 4); }
  }, 512, 16);
  ruban.wrapS = THREE.RepeatWrapping; ruban.repeat.set(30, 1);
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 160; k++) {
    const u = k / 160, L = 2 * (D1 - D0) + 2 * Math.PI * (rS + 13), s = u * L, S = D1 - D0, r = rS + 13;
    let x: number, y: number;
    if (s < S) { x = D0 + s; y = r - R; }
    else if (s < S + Math.PI * r) { const a = Math.PI / 2 - (s - S) / r; x = D1 + r * Math.cos(a); y = yc + r * Math.sin(a); }
    else if (s < 2 * S + Math.PI * r) { x = D1 - (s - S - Math.PI * r); y = yc - r; }
    else { const a = -Math.PI / 2 - (s - 2 * S - Math.PI * r) / r; x = D0 + r * Math.cos(a); y = yc + r * Math.sin(a); }
    pts.push(new THREE.Vector3(x, y, 10.6));
  }
  ajoute(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 320, 0.35, 6, true), new THREE.MeshBasicMaterial({ map: ruban, toneMapped: false })));
  // LE PODIUM, pres de l'arrivee, dans la pelouse
  const marche = (x: number, h: number, n: string) => {
    const face = toile((c, w, hh) => { c.fillStyle = '#f6f8f6'; c.fillRect(0, 0, w, hh); c.fillStyle = rgb([56, 196, 92]); c.fillRect(0, 0, w, hh * 0.18);
      c.fillStyle = '#10241a'; c.font = `900 ${hh * 0.55}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n, w / 2, hh * 0.6); }, 128, 128);
    const m = ajoute(new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, h), [blancMetal, blancMetal, new THREE.MeshLambertMaterial({ map: face }), blancMetal,
      new THREE.MeshLambertMaterial({ color: vert }), blancMetal]));
    m.position.set(x, -15, h / 2);
  };
  marche(D1 - 12, 1.3, '1'); marche(D1 - 14.2, 0.95, '2'); marche(D1 - 9.8, 0.7, '3');
  // 0.GAMES peint dans la pelouse
  const mot = toile((c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = `900 ${h * 0.8}px system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('0.GAMES', w / 2, h / 2 + h * 0.04); }, 1024, 200);
  const sol = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(44, 8.6), new THREE.MeshLambertMaterial({ map: mot, transparent: true })));
  sol.position.set(xc, yc, 0.02); sol.scale.x = -1;     // le monde est en miroir : le mot se lit a l'endroit
  // LE RUBAN RALENTIT AU DEPART (« l'ecran au-dessus du stade au depart du 200 m et du 400 m tourne
  // trop vite », l'auteur, 24/10) : un cinquieme de sa vitesse pendant le decompte et les vingt
  // premiers metres, puis il reprend la sienne — celle d'un sprinteur — quand la course passe devant
  let avant = -1, vitesse = 0.2, decale = 0;
  return (t: number) => {
    const G = (globalThis as any).SprinterApp?.G;
    const lancee = !!G && G.state === 'race' && !!G.player && G.player.d > 20;
    const dt = avant < 0 ? 0 : Math.min(0.1, Math.max(0, t - avant)); avant = t;
    vitesse += ((lancee ? 1 : 0.2) - vitesse) * Math.min(1, dt * 0.8);
    decale -= dt * 0.6 * vitesse;
    flammes.forEach((f, k) => { const s = 1 + 0.18 * Math.sin(t * (9 + k * 2.3) + k) + 0.1 * Math.sin(t * 23 + k * 5); f.scale.set(8 * s, 19 * s * (k % 2 ? 0.8 : 1), 1); });
    halo.material.opacity = 0.45 + 0.12 * Math.sin(t * 11);
    ruban.offset.x = decale;
    // la toile flotte (drapeau-3d.ts) ; le drapeau ne fait plus que tourner un peu au vent
    for (const d of drapeaux) d.rotation.z = 0.12 * Math.sin(t * 0.9 + d.userData.ph);
  };
}
