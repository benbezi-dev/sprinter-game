// LA PLAGE PARADIS EN 3D (22/10/2026).
//
// « Une piste fondue au sable sur une plage paradisiaque, un decor paradisiaque, pas de
// gradins : un public debout, d'autres sur une chaise, d'autres sur leurs bateaux de marque
// BENBEZI comme le logo des panneaux. » Le rendu a ete cherche dans Unity (StadePlage.cs,
// quatre passes) et valide par l'auteur ; ce module le reconstruit pour la course three.js
// (course-3d.ts l'appelle a la place des tribunes quand le theme porte `plage`).
//
// Tout ce qui se repete est fondu ou instancie — palmiers, transats, parasols, ecume,
// buissons, reflets du soleil : un appel de dessin par sorte d'objet, pour le plus faible
// des telephones. Le public est fait des cartes de plage (public_cartes.py --plage) :
// allonges sur un transat, debout qui applaudissent, bras leves, ou calmes.
//
// Repere : celui du stade de course-3d.ts — x le long de la ligne droite d'arrivee, y vers
// l'exterieur (la mer est de ce cote, au-dela de la plage), z en haut ; les virages tournent
// autour de (D0, -R) et (D1, -R).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type ContextePlage = {
  stade: THREE.Group;
  W: number; R: number; D0: number; D1: number;
  hasard: () => number;
  /** Une carte du public : x, y, z, geste (0 transat, 1 applaudit, 2 bras leves, 3 calme), cap. */
  spectateur: (x: number, y: number, z: number, geste: number, face: number) => void;
  base: string;
};

/** La ligne de la mer : la plage s'arrete la, au-dela de la ligne droite d'arrivee. */
export const RIVAGE = (W: number) => W + 30;
/** Le soleil couchant, au-dessus de la mer (direction horizontale, dans le repere du stade). */
export const SOLEIL = new THREE.Vector2(0.38, 0.91).normalize();

const c3 = (r: number, g: number, b: number) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);

function toile(dessin: (c: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  dessin(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Un lot d'instances : une geometrie, une matiere, des matrices (et des couleurs). */
class Lot {
  m: THREE.Matrix4[] = []; c: (THREE.Color | null)[] = [];
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material, public ombre = false) {}
  poser(m: THREE.Matrix4, c: THREE.Color | null = null) { this.m.push(m.clone()); this.c.push(c); }
  finir(g: THREE.Group) {
    if (!this.m.length) return;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.m.length);
    this.m.forEach((m, i) => { im.setMatrixAt(i, m); if (this.c[i]) im.setColorAt(i, this.c[i]!); });
    im.frustumCulled = false; im.castShadow = this.ombre; im.receiveShadow = true;
    g.add(im);
  }
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const place = (x: number, y: number, z: number, rz = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0) =>
  _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'ZXY')), _s.set(sx, sy, sz));

export function construirePlage(o: ContextePlage) {
  const { stade, W, R, D0, D1, hasard } = o;
  const S = D1 - D0, xc = (D0 + D1) / 2, yE = RIVAGE(W);
  const ajoute = (m: THREE.Object3D) => { stade.add(m); return m; };
  const plat = (lx: number, ly: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(lx, ly), mat);
    m.position.set(x, y, z); m.receiveShadow = true; return ajoute(m);
  };
  /** Le point a la distance r de l'axe du stade, au parametre t (0..1 sur le tour). */
  const ovale = (r: number, t: number) => {
    const B = Math.PI * r, L = 2 * S + 2 * B;
    let s = ((t % 1) + 1) % 1 * L;
    if (s < S) return [D0 + s, r - R];
    s -= S;
    if (s < B) { const a = Math.PI / 2 - s / r; return [D1 + r * Math.cos(a), -R + r * Math.sin(a)]; }
    s -= B;
    if (s < S) return [D1 - s, -R - r];
    s -= S;
    const b = -Math.PI / 2 - s / r;
    return [D0 + r * Math.cos(b), -R + r * Math.sin(b)];
  };

  // --- LE SABLE, et ses rides --------------------------------------------------------
  const rides = toile((c, w, h) => {
    c.fillStyle = '#f0d6a6'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      c.fillStyle = `rgba(150,110,60,${0.05 + 0.05 * Math.sin(y * 0.4)})`;
      c.beginPath();
      for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin(x * 0.05 + y * 0.3) * 2);
      c.lineTo(w, y + 1.4); c.lineTo(0, y + 1.4); c.fill();
    }
  }, 256, 256);
  rides.wrapS = rides.wrapT = THREE.RepeatWrapping; rides.repeat.set(120, 120);
  plat(2400, 2400, new THREE.MeshLambertMaterial({ map: rides }), xc, yE - 1 - 1200, -0.03);

  // --- LA PISTE SE FOND DANS LE SABLE ------------------------------------------------
  // dix bandes de chaque cote, du rouge de la piste au sable, sur les lignes droites et
  // dans les virages ; puis des depots allonges qui mordent sur le premier couloir
  const piste = c3(204, 86, 60), sable = c3(240, 214, 166);
  const bande = (r0: number, r1: number, mat: THREE.Material, z: number) => {
    plat(S, r1 - r0, mat, xc, (r0 + r1) / 2 - R, z);                 // ligne droite d'arrivee
    plat(S, r1 - r0, mat, xc, -R - (r0 + r1) / 2, z);                 // ligne opposee
    for (const [cx, debut] of [[D1, -Math.PI / 2], [D0, Math.PI / 2]] as const) {
      const g = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96, 1, debut, Math.PI), mat);
      g.position.set(cx, -R, z); g.receiveShadow = true; ajoute(g);
    }
  };
  for (let i = 0; i < 10; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: piste.clone().lerp(sable, (i + 0.5) / 10) });
    bande(R - 0.8 - (i + 1) * 0.22, R - 0.8 - i * 0.22, mat, 0.0005);
    bande(R + W + 0.8 + i * 0.22, R + W + 0.8 + (i + 1) * 0.22, mat, 0.0005);
  }
  const depots = new Lot(new THREE.CircleGeometry(1, 14), new THREE.MeshLambertMaterial({ color: c3(232, 202, 150) }));
  for (let i = 0; i < 700; i++) {
    const dehors = hasard() < 0.6, mord = hasard() * hasard() * 0.9;
    const r = dehors ? R + W + 0.8 - mord : R - 0.8 + mord;
    const t = hasard(), p = ovale(r, t), q = ovale(r, t + 0.0005);
    const cap = Math.atan2(q[1] - p[1], q[0] - p[0]);
    depots.poser(place(p[0], p[1], 0.006, cap + (hasard() - 0.5) * 0.25, 0.5 + hasard() * 2, 0.1 + hasard() * 0.3, 1));
  }
  depots.finir(stade);

  // --- LA MER --------------------------------------------------------------------------
  // un degrade continu, du turquoise laiteux sur le sable au bleu profond du large
  // (« trop sec » en quatre bandes) : des bandes fines, serrees pres du bord
  const cles: [number, THREE.Color][] = [[0, c3(158, 237, 217)], [0.12, c3(87, 222, 219)], [0.3, c3(31, 173, 204)],
    [0.55, c3(10, 115, 173)], [1, c3(5, 61, 122)]];
  const mer = (u: number) => {
    for (let k = 0; k < cles.length - 1; k++)
      if (u <= cles[k + 1][0]) {
        const t = (u - cles[k][0]) / (cles[k + 1][0] - cles[k][0]);
        return cles[k][1].clone().lerp(cles[k + 1][1], t * t * (3 - 2 * t));
      }
    return cles[cles.length - 1][1].clone();
  };
  for (let i = 0; i < 26; i++) {
    const u0 = i / 26, u1 = (i + 1) / 26, ya = yE + 1100 * u0 * u0, yb = yE + 1100 * u1 * u1;
    plat(2600, yb - ya + 0.2, new THREE.MeshStandardMaterial({ color: mer((u0 + u1) / 2), roughness: 0.22, metalness: 0.05 }),
      xc, (ya + yb) / 2, -0.04);
  }
  plat(2600, 5, new THREE.MeshLambertMaterial({ color: c3(204, 174, 128) }), xc, yE - 2.2, -0.025);   // le sable mouille
  // l'ecume ondulee du rivage, et des nappes plus claires et plus sombres plus loin
  const ecume = new Lot(new THREE.CircleGeometry(1, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  for (let x = xc - 600; x < xc + 600; x += 3.6)
    ecume.poser(place(x + hasard() * 2, yE + Math.sin(x * 0.07) * 1.2 + hasard() * 0.5, -0.03, 0, 2.6 + hasard() * 1.6, 0.25 + hasard() * 0.35, 1));
  ecume.finir(stade);
  const nappes = new Lot(new THREE.CircleGeometry(1, 20), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  for (let i = 0; i < 18; i++) {
    const r = 12 + hasard() * 40;
    nappes.poser(place(xc - 300 + hasard() * 700, yE + 20 + hasard() * 160, -0.035, hasard() * 3, r * (1.4 + hasard()), r, 1),
      // a peine plus sombres ou plus claires que l'eau autour : des taches franches faisaient des trous
      i % 3 === 0 ? mer(Math.min(1, ((hasard() * 160 + 20) / 1100) ** 0.5 + 0.08)) : mer(Math.max(0, ((hasard() * 160 + 20) / 1100) ** 0.5 - 0.06)));
  }
  nappes.finir(stade);
  // LE CHEMIN DU SOLEIL : une trainee de reflets dores, vers le couchant
  const reflets = new Lot(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: c3(255, 214, 150), transparent: true,
    opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  const lat = new THREE.Vector2(-SOLEIL.y, SOLEIL.x);
  for (let i = 0; i < 900; i++) {
    const t = 20 + Math.pow(hasard(), 0.6) * 900, ecart = (hasard() - 0.5) * (5 + t * 0.08) * (hasard() + hasard());
    const x = xc + SOLEIL.x * t + lat.x * ecart, y = yE + SOLEIL.y * t + lat.y * ecart;
    reflets.poser(place(x, y, -0.02, Math.atan2(lat.y, lat.x), 0.6 + t * 0.012 * (0.5 + hasard()), 0.06 + t * 0.001, 1));
  }
  reflets.finir(stade);
  // des iles au loin, des voiliers
  const ile = new THREE.MeshLambertMaterial({ color: c3(40, 110, 50) }), plageIle = new THREE.MeshLambertMaterial({ color: c3(240, 214, 166) });
  for (const [x, y, r] of [[xc - 220, 430, 60], [xc + 60, 560, 90], [xc + 320, 390, 45]]) {
    const s1 = ajoute(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), plageIle)); s1.position.set(x, yE + y, -r * 0.85); s1.scale.set(r * 1.3, r * 1.2, r);
    const s2 = ajoute(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), ile)); s2.position.set(x, yE + y, -r * 0.74); s2.scale.set(r, r * 0.9, r);
  }
  const voile = new THREE.MeshLambertMaterial({ color: 0xfffaf0, side: THREE.DoubleSide });
  for (const [x, y] of [[xc - 100, 240], [xc + 110, 300], [xc, 180]]) {
    const coque = ajoute(new THREE.Mesh(new THREE.BoxGeometry(9, 2.6, 1), new THREE.MeshLambertMaterial({ color: 0xffffff })));
    coque.position.set(x, yE + y, 0.3);
    const v = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(5, 11), voile));
    v.position.set(x, yE + y, 6.2); v.rotation.set(Math.PI / 2, 0.4, 0);
  }

  // --- LE CIEL : le soleil, son halo, les nuages ---------------------------------------
  const halo = toile((c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,250,230,1)'); g.addColorStop(0.12, 'rgba(255,236,190,1)');
    g.addColorStop(0.2, 'rgba(255,190,120,0.6)'); g.addColorStop(1, 'rgba(255,150,80,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, 256, 256);
  const soleil = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  soleil.position.set(xc + SOLEIL.x * 700, yE + SOLEIL.y * 700, 120); soleil.scale.set(320, 320, 1);
  ajoute(soleil);
  const nuages = [0, 1, 2].map(() => toile((c, w, h) => {
    for (let k = 0; k < 26; k++) {
      const x = w * (0.15 + hasard() * 0.7), y = h * (0.35 + hasard() * 0.3), r = h * (0.12 + hasard() * 0.22);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,240,228,0.5)'); g.addColorStop(1, 'rgba(255,200,170,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
  }, 256, 128));
  const azSoleil = Math.atan2(SOLEIL.y, SOLEIL.x);
  for (let i = 0; i < 20; i++) {
    const a = hasard() * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - azSoleil), Math.cos(a - azSoleil))) < 0.3) continue;   // le soleil reste degage
    const d = 450 + hasard() * 300, lg = 150 + hasard() * 200;
    const n = new THREE.Sprite(new THREE.SpriteMaterial({ map: nuages[i % 3], transparent: true, depthWrite: false, fog: false }));
    n.position.set(xc + Math.cos(a) * d, -R + Math.sin(a) * d, 60 + hasard() * 110); n.scale.set(lg, lg * (0.3 + hasard() * 0.15), 1);
    ajoute(n);
  }

  // --- LES PALMIERS : un seul modele, fondu, instancie --------------------------------
  // un stipe bague qui s'incline, trois noix de coco, douze palmes en lanieres decoupees
  const morceaux: THREE.BufferGeometry[] = [];
  const H = 9, N = 10;
  let px = 0, pz = 0;
  for (let i = 0; i < N; i++) {
    const t = (i + 1) / N, x = 0.12 * t * t * H, z = H * t, r = 0.38 - 0.14 * t;
    const g = new THREE.CylinderGeometry(r * 0.92, r, Math.hypot(x - px, z - pz), 9).toNonIndexed();
    g.rotateX(Math.PI / 2); g.rotateY(Math.atan2(x - px, z - pz)); g.translate((px + x) / 2, 0, (pz + z) / 2);
    morceaux.push(g); px = x; pz = z;
  }
  for (let k = 0; k < 3; k++) {
    const g = new THREE.SphereGeometry(0.17, 8, 6).toNonIndexed();
    g.translate(px + Math.cos(k * 2.1) * 0.28, Math.sin(k * 2.1) * 0.28, pz - 0.3);
    morceaux.push(g);
  }
  const stipeGeo = mergeGeometries(morceaux.map(g => { g.deleteAttribute('uv'); return g; }))!;
  const palme = new THREE.PlaneGeometry(1.1, 4.6, 1, 10);
  const pp = palme.getAttribute('position');
  for (let k = 0; k < pp.count; k++) {
    const u = (pp.getY(k) + 2.3) / 4.6;                  // 0 au coeur, 1 au bout
    pp.setXYZ(k, pp.getX(k) * (0.35 + Math.sin(u * Math.PI) * 0.9), u * 4.6, -u * u * 1.9);
  }
  palme.computeVertexNormals();
  const frondes: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 12; k++) {
    const g = palme.clone();
    g.rotateX(0.25 + (k % 3) * 0.12); g.rotateZ(k * Math.PI / 6 + (k % 2) * 0.2); g.translate(px, 0, pz);
    frondes.push(g);
  }
  const frondeGeo = mergeGeometries(frondes)!;
  const feuille = toile((c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#3d7a2a'; c.fillRect(w / 2 - 2, 0, 4, h);
    for (let y = 4; y < h; y += 6) {
      const l = w / 2 * (0.6 + 0.4 * Math.sin(y / h * Math.PI));
      c.strokeStyle = y % 12 ? '#2f8a35' : '#3fa042'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(w / 2, y); c.lineTo(w / 2 - l, y + 10); c.moveTo(w / 2, y); c.lineTo(w / 2 + l, y + 10); c.stroke();
    }
  }, 64, 256);
  const lStipe = new Lot(stipeGeo, new THREE.MeshLambertMaterial({ color: c3(130, 100, 72) }), true);
  const lFronde = new Lot(frondeGeo, new THREE.MeshLambertMaterial({ map: feuille, alphaTest: 0.4, side: THREE.DoubleSide }), true);
  const palmier = (x: number, y: number, h = 1) => {
    const m = place(x, y, 0, hasard() * Math.PI * 2, h, h, h);
    lStipe.poser(m); lFronde.poser(m);
  };
  for (let x = xc - 140; x < xc + 160; x += 8 + hasard() * 4) palmier(x, yE - 7 - hasard() * 7, 0.8 + hasard() * 0.5);
  for (let i = 0; i < 40; i++) {                           // autour du stade, cote terre
    const p = ovale(R + W + 20 + hasard() * 70, hasard());
    if (p[1] > -R) continue;
    palmier(p[0], p[1], 0.8 + hasard() * 0.6);
  }

  // --- LE JARDIN TROPICAL, au centre de la piste ----------------------------------------
  const cx = xc, cy = -R;
  const ellipse = (rx: number, ry: number, mat: THREE.Material, z: number) => {
    const m = ajoute(new THREE.Mesh(new THREE.CircleGeometry(1, 64), mat)); m.position.set(cx, cy, z); m.scale.set(rx, ry, 1);
    m.receiveShadow = true; return m;
  };
  ellipse(29, 18, new THREE.MeshLambertMaterial({ color: c3(206, 176, 130) }), 0.002);
  ellipse(26, 15, new THREE.MeshStandardMaterial({ color: c3(77, 219, 214), roughness: 0.2 }), 0.004);
  ellipse(17, 9, new THREE.MeshStandardMaterial({ color: c3(31, 168, 199), roughness: 0.2 }), 0.006);
  const ecumeL = new Lot(new THREE.CircleGeometry(1, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  for (let i = 0; i < 150; i++) {
    const a = i / 150 * Math.PI * 2;
    ecumeL.poser(place(cx + Math.cos(a) * 25.8, cy + Math.sin(a) * 14.8, 0.008, a + Math.PI / 2, 1.2 + hasard(), 0.2 + hasard() * 0.2, 1));
  }
  ecumeL.finir(stade);
  const rochers = new Lot(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: c3(110, 98, 88) }), true);
  for (let i = 0; i < 16; i++) {
    const a = hasard() * Math.PI * 2;
    rochers.poser(place(cx + Math.cos(a) * 27, cy + Math.sin(a) * 16, 0.2, hasard() * 3, 1 + hasard() * 1.6, 0.8 + hasard(), 0.5 + hasard() * 0.7));
  }
  rochers.finir(stade);
  const bois = new THREE.MeshLambertMaterial({ color: c3(156, 112, 72) });
  const ponton = ajoute(new THREE.Mesh(new THREE.BoxGeometry(12, 2.4, 0.14), bois)); ponton.position.set(cx, cy + 9, 0.55); ponton.castShadow = true;
  for (let i = 0; i < 6; i++) for (const d of [-1.1, 1.1]) {
    const p = ajoute(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 6), bois));
    p.rotation.x = Math.PI / 2; p.position.set(cx - 5 + i * 2, cy + 9 + d, 0.3);
  }
  for (let i = 0; i < 30; i++) {                           // les bosquets autour du lagon
    const a = hasard() * Math.PI * 2, rr = 1.1 + hasard() * 0.35;
    const x = cx + Math.cos(a) * 29 * rr, y = cy + Math.sin(a) * 18 * rr;
    if (Math.abs(x - (D0 + 6)) < 12 || Math.abs(x - (D1 - 6)) < 12) continue;
    palmier(x, y, 0.75 + hasard() * 0.5);
  }
  // deux terrains de beach-volley, leurs filets et leurs joueurs
  const blanc = new THREE.MeshLambertMaterial({ color: 0xffffff }), filet = new THREE.MeshLambertMaterial({ color: 0x222226 });
  for (const tx of [D0 + 6, D1 - 6]) {
    for (const [dx, dy, lx, ly] of [[0, -4, 0.08, 16], [0, 4, 0.08, 16], [-8, 0, 8, 0.08], [8, 0, 8, 0.08]]) {
      const l = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(ly, lx), blanc)); l.position.set(tx + dx, cy + dy, 0.006);
      if (lx < 1) l.rotation.z = 0; else l.rotation.z = Math.PI / 2;
    }
    for (const dy of [-4.6, 4.6]) {
      const p = ajoute(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), blanc)); p.rotation.x = Math.PI / 2; p.position.set(tx, cy + dy, 1.25);
    }
    const f = ajoute(new THREE.Mesh(new THREE.BoxGeometry(0.03, 9.2, 0.9), filet)); f.position.set(tx, cy, 2.05);
    for (let k = 0; k < 4; k++) o.spectateur(tx + (k < 2 ? -1 : 1) * (3 + hasard() * 3), cy + (hasard() - 0.5) * 6, 0, 1, k < 2 ? 0 : Math.PI);
  }
  // des transats au bord du lagon, tournes vers l'eau
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * Math.PI * 2;
    if (Math.abs(Math.sin(a)) > 0.92 && Math.cos(a) * 0 === 0 && i % 2) continue;
    o.spectateur(cx + Math.cos(a) * 31, cy + Math.sin(a) * 19.5, 0, 0, a + Math.PI);
  }
  // les torches tiki, tout le long de la corde
  const bambou = new Lot(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 6).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: c3(140, 106, 56) }));
  const flamme = new Lot(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: c3(255, 150, 50) }));
  for (let i = 0; i < 40; i++) {
    const p = ovale(R - 3, (i + 0.5) / 40);
    bambou.poser(place(p[0], p[1], 0.9)); flamme.poser(place(p[0], p[1], 1.95, 0, 0.16, 0.16, 0.3));
  }
  bambou.finir(stade); flamme.finir(stade);

  // --- LA PLAGE : le public, les transats, les parasols, le bar, la vigie ---------------
  // pas de gradins : debout dans le sable, sur un transat, sous un parasol, face a la piste
  const face = -Math.PI / 2;
  for (let i = 0; i < 620; i++) {
    const x = D0 - 25 + hasard() * (S + 60), y = W + 3 + hasard() * (yE - W - 10);
    const u = hasard(), geste = u < 0.3 ? 0 : u < 0.62 ? 3 : u < 0.84 ? 1 : 2;
    o.spectateur(x, y, 0, geste, face + (hasard() - 0.5) * 0.6);
  }
  const mat = (c: THREE.Color) => new THREE.MeshLambertMaterial({ color: c });
  const couleurs = [c3(235, 87, 87), c3(242, 201, 76), c3(45, 156, 219), c3(255, 255, 255), c3(39, 174, 96), c3(255, 143, 177)];
  const mats = new Lot(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6).rotateX(Math.PI / 2), mat(c3(245, 245, 240)));
  const ombrelles = new Lot(new THREE.ConeGeometry(1.5, 0.55, 12).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff }), true);
  const serviettes = new Lot(new THREE.PlaneGeometry(0.9, 1.8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const planches = new Lot(new THREE.CapsuleGeometry(0.28, 1.6, 4, 8).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff }), true);
  for (let i = 0; i < 70; i++) {
    const x = D0 - 25 + hasard() * (S + 60), y = W + 4 + hasard() * (yE - W - 11);
    mats.poser(place(x, y, 1.25)); ombrelles.poser(place(x, y, 2.5), couleurs[i % couleurs.length]);
  }
  for (let i = 0; i < 60; i++)
    serviettes.poser(place(D0 - 25 + hasard() * (S + 60), W + 4 + hasard() * (yE - W - 11), 0.01, hasard() * 3), couleurs[(i * 7) % couleurs.length]);
  for (let i = 0; i < 16; i++)
    planches.poser(place(D0 - 20 + i * 9 + hasard() * 4, yE - 4 - hasard() * 2, 1.0, hasard() * 3, 1, 1, 1, (hasard() - 0.5) * 0.2), couleurs[i % couleurs.length]);
  mats.finir(stade); ombrelles.finir(stade); serviettes.finir(stade); planches.finir(stade);
  // le bar de plage, au bout de la ligne droite, et la vigie du maitre-nageur
  const bar = new THREE.Group(); bar.position.set(D1 + 26, W + 12, 0); ajoute(bar);
  const sous = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const e = new THREE.Mesh(geo, m); e.position.set(x, y, z); e.castShadow = true; bar.add(e); return e;
  };
  sous(new THREE.BoxGeometry(9, 6, 0.6), bois, 0, 0, 0.3);
  sous(new THREE.BoxGeometry(8, 0.7, 1.1), bois, 0, -2.4, 1.15);
  for (const [dx, dy] of [[-4, -2.8], [4, -2.8], [-4, 2.8], [4, 2.8]]) sous(new THREE.CylinderGeometry(0.2, 0.2, 3.6, 6).rotateX(Math.PI / 2), bois, dx, dy, 2);
  sous(new THREE.ConeGeometry(7.2, 2.6, 16).rotateX(Math.PI / 2), mat(c3(210, 174, 96)), 0, 0, 4.6);
  const vigie = new THREE.Group(); vigie.position.set(D0 + 4, yE - 5, 0); ajoute(vigie);
  for (const [dx, dy] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3, 6).rotateX(Math.PI / 2), blanc); p.position.set(dx, dy, 1.5); vigie.add(p);
  }
  const cabine = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 1.3), mat(c3(230, 51, 51))); cabine.position.z = 3.6; cabine.castShadow = true; vigie.add(cabine);
  const toit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.8, 0.2), blanc); toit.position.z = 4.4; vigie.add(toit);

  // --- LES YACHTS BENBEZI, au mouillage, le public a bord --------------------------------
  const logo = new THREE.TextureLoader().load(o.base + 'pubs/benbezi-logo-3d.webp');
  logo.colorSpace = THREE.SRGBColorSpace;
  const matLogo = new THREE.MeshBasicMaterial({ map: logo, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide });
  const coque = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
  const vitre = new THREE.MeshStandardMaterial({ color: 0x14202c, roughness: 0.1, metalness: 0.4 });
  const teck = new THREE.MeshLambertMaterial({ color: c3(140, 97, 56) });
  const refletTex = toile((c, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = 1 - y / h, trait = Math.abs(Math.sin(y * 0.9)) > 0.45 ? 1 : 0.2;
      const g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.2, `rgba(255,255,255,${(v ** 1.6) * trait})`);
      g.addColorStop(0.8, `rgba(255,255,255,${(v ** 1.6) * trait})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, y, w, 1);
    }
  }, 128, 128);
  const matReflet = new THREE.MeshBasicMaterial({ map: refletTex, transparent: true, opacity: 0.5, depthWrite: false });
  for (let i = 0; i < 8; i++) {
    const L = 24 + hasard() * 8, l = L * 0.24, y = yE + 16 + hasard() * 18;
    const g = new THREE.Group(); g.position.set(D0 - 45 + i * 26 + hasard() * 6, y, 0.25); g.rotation.z = (hasard() - 0.5) * 0.5; ajoute(g);
    const m = (geo: THREE.BufferGeometry, mt: THREE.Material, x: number, yy: number, z: number) => {
      const e = new THREE.Mesh(geo, mt); e.position.set(x, yy, z); e.castShadow = true; g.add(e); return e;
    };
    m(carene(L, l, L * 0.1), coque, 0, 0, 0);
    m(new THREE.BoxGeometry(L * 0.62, l * 0.9, 0.06), teck, -L * 0.16, 0, L * 0.1);
    const cab = m(new THREE.CapsuleGeometry(L * 0.09, L * 0.3, 6, 12), coque, -L * 0.06, 0, L * 0.13);
    cab.rotation.z = Math.PI / 2; cab.scale.set(1, 1, 1); cab.scale.y = 1; cab.scale.x = 1; cab.scale.set(1, l * 0.8 / (L * 0.18), 0.7);
    const vit = m(new THREE.CapsuleGeometry(L * 0.04, L * 0.32, 6, 12), vitre, -L * 0.06, 0, L * 0.145);
    vit.rotation.z = Math.PI / 2; vit.scale.set(1, l * 0.82 / (L * 0.08), 1);
    for (const s of [1, -1]) {
      const p = m(new THREE.PlaneGeometry(L * 0.42, L * 0.075), matLogo, L * 0.05, s * (l / 2 + 0.03), L * 0.04);
      p.rotation.x = Math.PI / 2; p.scale.x = s > 0 ? -1 : 1;    // le monde est en miroir : le logo se lit a l'endroit
    }
    // son monde sur le pont, debout et bras leves
    for (let k = 0; k < 8; k++) {
      const lx = -L * 0.4 + hasard() * L * 0.28, ly = (hasard() - 0.5) * l * 0.7;
      const v = new THREE.Vector3(lx, ly, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), g.rotation.z).add(g.position);
      o.spectateur(v.x, v.y, L * 0.1 + 0.25, hasard() < 0.5 ? 2 : 3, face);
    }
    // son reflet, une coulee blanche brisee par les rides, vers la plage
    const r = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.85, L * 0.5), matReflet);
    r.position.set(g.position.x, y - L * 0.32, -0.015); ajoute(r);
  }

  // --- LA LISIERE, cote terre : des buissons ----------------------------------------------
  const buissons = new Lot(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), true);
  for (let i = 0; i < 360; i++) {
    const p = ovale(R + W + 50 + hasard() * 80, hasard());
    if (p[1] > -R + 10) continue;
    const r = 2 + hasard() * 4;
    buissons.poser(place(p[0], p[1], r * 0.35, hasard() * 3, r * 1.4, r * 1.2, r * 0.9), hasard() < 0.5 ? c3(50, 118, 46) : c3(86, 148, 56));
  }
  buissons.finir(stade);
  lStipe.finir(stade); lFronde.finir(stade);
}

/**
 * Une carene : des couples de l'arriere a l'etrave, chacun un V arrondi, la largeur qui se
 * referme en pointe sur le dernier tiers, l'etrave qui se releve ; un pont et un tableau
 * arriere la ferment (meme forme que dans StadePlage.cs). Le passage du repere d'Unity
 * (y en haut) a celui-ci (z en haut) est une symetrie : l'ordre des sommets reste le sien,
 * sinon la coque s'eclaire par l'interieur et sort noire.
 */
function carene(L: number, l: number, h: number) {
  const N = 28;
  const prof: [number, number][] = [[1, 1], [0.97, 0.55], [0.72, 0.12], [0, -0.18], [-0.72, 0.12], [-0.97, 0.55], [-1, 1]];
  const P = prof.length, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = -L / 2 + u * L;
    const w = l / 2 * (u < 0.62 ? 0.94 + 0.06 * u / 0.62 : Math.sqrt(Math.max(0, 1 - ((u - 0.62) / 0.38) ** 2)));
    const leve = u > 0.75 ? (u - 0.75) * h * 1.6 : 0;
    for (const [py, pz] of prof) pos.push(x, w * py, h * pz + leve * (1 - pz));
  }
  for (let i = 0; i < N; i++)
    for (let k = 0; k < P - 1; k++) {
      const a = i * P + k, b = a + 1, c = a + P, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  for (let i = 0; i < N; i++) {
    const a = i * P, b = i * P + P - 1, c = (i + 1) * P, d = (i + 1) * P + P - 1;
    idx.push(a, b, c, b, d, c);
  }
  for (let k = 1; k < P - 1; k++) idx.push(0, k + 1, k);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
