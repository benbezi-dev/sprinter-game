// LE VILLAGE DE L'ETOILE — le stade de l'evenement de Noel 2026 (calendrier de l'Avent,
// « La Course de l'Etoile », docs/NOEL_HISTOIRE.md).
//
// L'auteur, 15/11 : « creer un stade dedie a l'evenement si besoin ». Le lieu de l'histoire
// est la place du Marche, son grand sapin dont l'etoile est eteinte, la colline au loin.
// Ce module habille le stade generique aux couleurs du theme `noel` (sprinter-app.js) :
//   - LE GRAND SAPIN au centre de l'aire interieure : etages de branches enneigees, une
//     guirlande en spirale, et L'ETOILE au sommet. Elle est ETEINTE par defaut, comme dans
//     l'histoire ; `etoileAllumee` (globalThis.__ETOILE_NOEL, pose par le mode Noel quand
//     quelqu'un tient l'etoile) la fait briller ;
//   - LES GUIRLANDES le long de la ligne droite d'arrivee, des deux cotes de la piste, sur
//     des piquets bas : des ampoules chaudes qui scintillent, a hauteur des coureurs ;
//   - LES CHALETS du marche de Noel autour du sapin, fenetres allumees ;
//   - LES SAPINS ENNEIGES tout autour du stade, la ou les autres stades ont leurs arbres ;
//   - LA NEIGE QUI TOMBE, autour de la camera, comme la pluie du Stade Neon.
//
// Repere : celui du stade de course-3d.ts — x le long de la ligne droite, y vers la tribune
// principale, z en haut ; le centre de l'ovale est en (xc, -R). La piste occupe y de 0 a W
// sur la ligne droite d'arrivee.

import * as THREE from 'three';

export type ContexteNoel = {
  stade: THREE.Group;
  W: number; R: number; D0: number; D1: number;
  hasard: () => number;
};

const c3 = (r: number, g: number, b: number) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);

/** Un halo rond, pour les ampoules, les flocons et l'etoile. */
function halo(couleur: string, taille = 64) {
  const cv = document.createElement('canvas'); cv.width = cv.height = taille;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(taille / 2, taille / 2, 0, taille / 2, taille / 2, taille / 2);
  g.addColorStop(0, couleur); g.addColorStop(0.35, couleur.replace(/[\d.]+\)$/, '0.55)')); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, taille, taille);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Lot {
  m: THREE.Matrix4[] = []; c: (THREE.Color | null)[] = [];
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material, public ombre = false) {}
  poser(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rz = 0, c: THREE.Color | null = null) {
    this.m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rz), new THREE.Vector3(sx, sy, sz)));
    this.c.push(c);
  }
  finir(g: THREE.Group) {
    if (!this.m.length) return null;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.m.length);
    this.m.forEach((m, i) => { im.setMatrixAt(i, m); if (this.c[i]) im.setColorAt(i, this.c[i]!); });
    im.frustumCulled = false; im.castShadow = this.ombre; im.receiveShadow = true;
    g.add(im);
    return im;
  }
}

/** Des points lumineux (ampoules, scintillement) : un nuage additif, une couleur par point. */
function lumieres(pos: number[], coul: THREE.Color[], taille: number, tex: THREE.Texture) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const c = new Float32Array(coul.length * 3);
  coul.forEach((k, i) => c.set([k.r, k.g, k.b], i * 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: taille, map: tex, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  p.frustumCulled = false;
  return p;
}

/** Les couleurs des ampoules : chaudes surtout, quelques rouges, verts et bleus glaces. */
const AMPOULES = [c3(255, 196, 110), c3(255, 214, 140), c3(255, 182, 90), c3(236, 64, 64), c3(90, 210, 120), c3(140, 190, 255)];

/** L'etoile a cinq branches, en volume. */
function etoileGeo(r1: number, r0: number, ep: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? r0 : r1;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: ep, bevelEnabled: true, bevelThickness: ep * 0.3, bevelSize: ep * 0.3, bevelSegments: 1 })
    .translate(0, 0, -ep / 2);
}

/**
 * LE SOL ENNEIGE, a la place de la pelouse tondue en bandes : des congeres a peine
 * marquees et des cristaux qui accrochent la lumiere. Une toile carree qui se repete.
 */
export function toileDeNeige(base: number[], hasard: () => number): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const c = cv.getContext('2d')!;
  c.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; c.fillRect(0, 0, 512, 512);
  // les congeres : de grandes taches douces, plus claires ou plus bleues
  for (let i = 0; i < 70; i++) {
    const x = hasard() * 512, y = hasard() * 512, r = 30 + hasard() * 90, clair = hasard() < 0.6;
    for (const [dx, dy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) {
      const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      g.addColorStop(0, clair ? 'rgba(255,255,255,0.10)' : 'rgba(60,80,140,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
  // les cristaux
  for (let i = 0; i < 1400; i++) {
    c.fillStyle = `rgba(255,255,255,${0.25 + hasard() * 0.6})`;
    c.fillRect(hasard() * 512, hasard() * 512, 1, 1);
  }
  return cv;
}

export function construireNoel(o: ContexteNoel): (t: number, camX: number, camY: number, cap: number) => void {
  const { stade, W, R, D0, D1, hasard } = o;
  const xc = (D0 + D1) / 2, yc = -R;
  const ajoute = <M extends THREE.Object3D>(m: M) => { stade.add(m); return m; };
  const texAmpoule = halo('rgba(255,255,255,1)');
  const anims: ((t: number, cx: number, cy: number) => void)[] = [];

  // --- LE GRAND SAPIN ------------------------------------------------------------------
  // Vingt-six metres : il depasse les tribunes, on le voit de la ligne droite.
  const HAUT = 26, BASE = 7.5, ETAGES = 9;
  const vert = new THREE.MeshStandardMaterial({ color: c3(22, 70, 44), roughness: 0.9, flatShading: true });
  const neigeMat = new THREE.MeshStandardMaterial({ color: c3(236, 244, 255), roughness: 0.8, flatShading: true });
  const tronc = ajoute(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 3, 10).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: c3(70, 46, 30), roughness: 1 })));
  tronc.position.set(xc, yc, 1.5);
  for (let i = 0; i < ETAGES; i++) {
    const k = i / ETAGES;
    const r = BASE * (1 - k * 0.88), z0 = 2.2 + k * (HAUT - 4.5), h = (HAUT - 2) / ETAGES * 1.9;
    // le cone de branches, un peu irregulier (12 pans, sommets tires au hasard)
    const g = new THREE.ConeGeometry(r, h, 12, 2, true);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let j = 0; j < p.count; j++) if (p.getY(j) < -h / 2 + 0.01) { p.setX(j, p.getX(j) * (0.9 + hasard() * 0.22)); p.setZ(j, p.getZ(j) * (0.9 + hasard() * 0.22)); }
    g.computeVertexNormals();
    g.rotateX(Math.PI / 2);
    const cone = ajoute(new THREE.Mesh(g, vert)); cone.position.set(xc, yc, z0 + h / 2); cone.castShadow = true;
    // la neige posee sur le haut de chaque etage
    const gn = new THREE.ConeGeometry(r * 0.62, h * 0.42, 12, 1, true).rotateX(Math.PI / 2);
    const n = ajoute(new THREE.Mesh(gn, neigeMat)); n.position.set(xc, yc, z0 + h * 0.79);
  }
  // la neige au pied du sapin
  const tapis = ajoute(new THREE.Mesh(new THREE.CircleGeometry(BASE * 1.5, 40), new THREE.MeshStandardMaterial({ color: c3(240, 246, 255), roughness: 0.9 })));
  tapis.position.set(xc, yc, 0.03);

  // la guirlande : une spirale d'ampoules qui monte autour du sapin, et des boules
  {
    const pos: number[] = [], coul: THREE.Color[] = [];
    const tours = 7, n = 420;
    for (let i = 0; i < n; i++) {
      const k = i / n, a = k * tours * Math.PI * 2;
      const z = 2.4 + k * (HAUT - 5), r = BASE * (1 - (z - 2.2) / (HAUT - 2.2) * 0.9) * 0.98 + 0.2;
      pos.push(xc + Math.cos(a) * r, yc + Math.sin(a) * r, z);
      coul.push(AMPOULES[i % 3]);
    }
    // et des ampoules semees dans les branches
    for (let i = 0; i < 360; i++) {
      const z = 2.6 + hasard() * (HAUT - 5), a = hasard() * Math.PI * 2;
      const r = BASE * (1 - (z - 2.2) / (HAUT - 2.2) * 0.9) * (0.7 + hasard() * 0.28);
      pos.push(xc + Math.cos(a) * r, yc + Math.sin(a) * r, z);
      coul.push(AMPOULES[Math.floor(hasard() * AMPOULES.length)]);
    }
    const guirlande = ajoute(lumieres(pos, coul, 1.25, texAmpoule));
    const mat = guirlande.material as THREE.PointsMaterial;
    anims.push(t => { mat.opacity = 0.82 + 0.18 * Math.sin(t * 2.3); });
    const boule = new Lot(new THREE.SphereGeometry(0.42, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.6 }));
    const teintes = [c3(196, 30, 40), c3(220, 170, 60), c3(200, 210, 230)];
    for (let i = 0; i < 70; i++) {
      const z = 3 + hasard() * (HAUT - 7), a = hasard() * Math.PI * 2;
      const r = BASE * (1 - (z - 2.2) / (HAUT - 2.2) * 0.9) * 0.95;
      boule.poser(xc + Math.cos(a) * r, yc + Math.sin(a) * r, z, 1, 1, 1, 0, teintes[i % 3]);
    }
    boule.finir(stade);
  }

  // L'ETOILE, au sommet. Eteinte : un or terne. Allumee : elle brille, son halo grandit.
  const matEtoile = new THREE.MeshStandardMaterial({ color: c3(150, 128, 80), roughness: 0.35, metalness: 0.8,
    emissive: c3(255, 210, 110), emissiveIntensity: 0 });
  const etoile = ajoute(new THREE.Mesh(etoileGeo(1.9, 0.8, 0.5), matEtoile));
  etoile.rotation.x = Math.PI / 2;           // debout, face a la ligne droite
  etoile.position.set(xc, yc, HAUT + 0.6);
  const haloEtoile = ajoute(new THREE.Sprite(new THREE.SpriteMaterial({ map: halo('rgba(255,226,150,1)', 128), blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0 })));
  haloEtoile.position.copy(etoile.position); haloEtoile.scale.setScalar(16);
  const lumiereEtoile = ajoute(new THREE.PointLight(0xffd890, 0, 90, 1.6));
  lumiereEtoile.position.set(xc, yc + 2, HAUT);
  let eclat = 1;
  anims.push((t) => {
    // allumee par defaut (« plus lumineux », l'auteur, 15/11) ; `__ETOILE_NOEL = false` l'eteint
    const allumee = (globalThis as any).__ETOILE_NOEL !== false;
    eclat += ((allumee ? 1 : 0) - eclat) * 0.04;
    matEtoile.emissiveIntensity = eclat * (2.2 + 0.4 * Math.sin(t * 3));
    (haloEtoile.material as THREE.SpriteMaterial).opacity = eclat * (0.85 + 0.15 * Math.sin(t * 2.1));
    haloEtoile.scale.setScalar(14 + eclat * 10 + Math.sin(t * 1.3) * eclat);
    lumiereEtoile.intensity = eclat * 900;
    etoile.rotation.y = Math.sin(t * 0.4) * 0.25;
  });

  // --- LES GUIRLANDES DE LA LIGNE DROITE ----------------------------------------------
  // Le long de la piste, des piquets bas tous les six metres et, entre eux, un fil
  // qui tombe en chainette, une ampoule tous les quarante centimetres.
  {
    const piquet = new Lot(new THREE.CylinderGeometry(0.05, 0.06, 1.2, 6).rotateX(Math.PI / 2).translate(0, 0, 0.6),
      new THREE.MeshStandardMaterial({ color: c3(60, 40, 30), roughness: 0.9 }));
    const pos: number[] = [], coul: THREE.Color[] = [];
    const xa = Math.min(D0, D1) - 30, xb = Math.max(D0, D1) + 12;
    // seulement cote tribune : cote pelouse, les cameras de l'alignement filment depuis l'aire
    // interieure et les piquets leur passaient devant
    for (const y of [W + 1.3]) {
      for (let x = xa; x < xb; x += 6) {
        piquet.poser(x, y, 0);
        for (let k = 0; k < 15; k++) {
          const u = k / 15;
          pos.push(x + u * 6, y, 1.18 - Math.sin(u * Math.PI) * 0.32);
          coul.push(AMPOULES[(((k + Math.round(x)) % AMPOULES.length) + AMPOULES.length) % AMPOULES.length]);
        }
      }
    }
    piquet.finir(stade);
    // trois groupes qui scintillent a tour de role
    const groupes = [0, 1, 2].map(j => {
      const p: number[] = [], c: THREE.Color[] = [];
      for (let i = j; i < coul.length; i += 3) { p.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); c.push(coul[i]); }
      return ajoute(lumieres(p, c, 0.75, texAmpoule));
    });
    anims.push(t => groupes.forEach((g, j) => {
      (g.material as THREE.PointsMaterial).opacity = 0.55 + 0.45 * Math.max(0, Math.sin(t * 2.6 + j * 2.1));
    }));
  }

  // --- LES CHALETS DU MARCHE, autour du sapin ------------------------------------------
  {
    const bois = new Lot(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5), new THREE.MeshStandardMaterial({ color: c3(120, 78, 48), roughness: 0.9 }), true);
    const toit = new Lot(new THREE.CylinderGeometry(0.01, 0.75, 1, 4, 1).rotateY(Math.PI / 4).rotateX(Math.PI / 2).translate(0, 0, 0.5),
      new THREE.MeshStandardMaterial({ color: c3(238, 244, 255), roughness: 0.85, flatShading: true }));
    const vitre = new Lot(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: c3(255, 196, 110) }));
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3, d = 17 + (i % 2) * 2.5;
      const x = xc + Math.cos(a) * d * 1.9, y = yc + Math.sin(a) * d * 0.9;
      const rz = a + Math.PI / 2;
      bois.poser(x, y, 0, 3.6, 2.6, 2.4, rz);
      toit.poser(x, y, 2.4, 3.6 * 1.25, 2.6 * 1.25, 1.6, rz);
      // la vitrine, tournee vers le sapin
      const ox = -Math.cos(a) * 1.32, oy = -Math.sin(a) * 1.32;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x + ox, y + oy, 1.25),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, a + Math.PI / 2, 0, 'ZXY')), new THREE.Vector3(2.4, 1.1, 1));
      vitre.m.push(m); vitre.c.push(null);
    }
    bois.finir(stade); toit.finir(stade);
    const v = vitre.finir(stade);
    if (v) (v.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
  }

  // --- LES ARCHES LUMINEUSES, au-dessus de la ligne droite ------------------------------
  // Tous les vingt metres, un arc d'ampoules enjambe les huit couloirs, a sept metres au
  // sommet : on court sous des portes de lumiere, comme dans une rue un soir de fete.
  {
    const pos: number[] = [], coul: THREE.Color[] = [];
    const montant = new Lot(new THREE.CylinderGeometry(0.09, 0.11, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5),
      new THREE.MeshStandardMaterial({ color: c3(236, 236, 244), roughness: 0.4, metalness: 0.5 }));
    const y0 = -1.6, y1 = W + 1.6, haut = 7.2;
    for (let x = Math.min(D0, D1) - 20; x <= Math.max(D0, D1) + 10; x += 20) {
      montant.poser(x, y0, 0, 1, 1, haut - 2.4); montant.poser(x, y1, 0, 1, 1, haut - 2.4);
      for (let k = 0; k <= 60; k++) {
        const u = k / 60, a = u * Math.PI;
        const y = y0 + (y1 - y0) * u, z = (haut - 2.4) + Math.sin(a) * 2.4;
        pos.push(x, y, z); coul.push(k % 4 === 0 ? c3(236, 64, 64) : k % 4 === 2 ? c3(90, 210, 120) : c3(255, 214, 140));
        // l'etoile qui coiffe chaque arche
        if (k === 30) for (let e = 0; e < 10; e++) {
          const b = Math.PI / 2 + e * Math.PI / 5, r = e % 2 ? 0.35 : 0.8;
          pos.push(x, y + Math.cos(b) * r, z + 0.9 + Math.sin(b) * r); coul.push(c3(255, 230, 150));
        }
      }
      // les montants enroules d'ampoules
      for (const y of [y0, y1]) for (let k = 0; k < 24; k++) {
        const z = k / 24 * (haut - 2.4), a = k * 1.3;
        pos.push(x + Math.cos(a) * 0.16, y + Math.sin(a) * 0.16, z); coul.push(AMPOULES[k % 3]);
      }
    }
    montant.finir(stade);
    const arches = ajoute(lumieres(pos, coul, 0.85, texAmpoule));
    anims.push(t => { (arches.material as THREE.PointsMaterial).opacity = 0.85 + 0.15 * Math.sin(t * 3.1); });
  }

  // --- LES SUCRES D'ORGE GEANTS, au bord interieur de la piste ---------------------------
  {
    const rayures = (() => {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
      const c = cv.getContext('2d')!;
      c.fillStyle = '#f8f8fa'; c.fillRect(0, 0, 64, 256);
      c.fillStyle = '#d4202c';
      for (let i = -4; i < 16; i++) { c.beginPath(); c.moveTo(0, i * 24); c.lineTo(64, i * 24 + 36); c.lineTo(64, i * 24 + 48); c.lineTo(0, i * 24 + 12); c.fill(); }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3);
      return t;
    })();
    const mat = new THREE.MeshStandardMaterial({ map: rayures, roughness: 0.35 });
    // la canne : un tube droit puis une crosse
    const chemin = new THREE.CurvePath<THREE.Vector3>();
    chemin.add(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 3.2)));
    chemin.add(new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0, 3.2), new THREE.Vector3(0, 0, 4.4),
      new THREE.Vector3(1.2, 0, 4.4), new THREE.Vector3(1.2, 0, 3.6)));
    const geo = new THREE.TubeGeometry(chemin as any, 40, 0.18, 10, false);
    const cannes = new Lot(geo, mat, true);
    for (let x = Math.min(D0, D1) - 10; x <= Math.max(D0, D1) + 4; x += 14) cannes.poser(x, -3.2, 0, 1, 1, 1, Math.PI / 2);
    cannes.finir(stade);
  }

  // --- LES CADEAUX, au pied du sapin -----------------------------------------------------
  {
    const boite = new Lot(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), true);
    const ruban = new Lot(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.4 }));
    const papiers = [c3(204, 32, 44), c3(30, 120, 70), c3(40, 80, 180), c3(240, 240, 246), c3(220, 170, 60), c3(150, 40, 150)];
    const rubans = [c3(240, 200, 80), c3(250, 250, 250), c3(210, 30, 40)];
    for (let i = 0; i < 34; i++) {
      const a = hasard() * Math.PI * 2, d = BASE * 1.05 + hasard() * 3.2;
      const x = xc + Math.cos(a) * d, y = yc + Math.sin(a) * d;
      const sx = 0.9 + hasard() * 1.3, sy = 0.9 + hasard() * 1.3, sz = 0.7 + hasard() * 1.2, rz = hasard() * 3;
      boite.poser(x, y, 0, sx, sy, sz, rz, papiers[i % papiers.length]);
      const r = rubans[i % rubans.length];
      ruban.poser(x, y, 0, sx * 1.02, 0.16, sz * 1.02, rz, r);
      ruban.poser(x, y, 0, 0.16, sy * 1.02, sz * 1.02, rz, r);
    }
    boite.finir(stade); ruban.finir(stade);
  }

  // --- LES BONSHOMMES DE NEIGE, dans l'aire interieure -----------------------------------
  {
    const blanc = new THREE.MeshStandardMaterial({ color: c3(246, 250, 255), roughness: 0.85 });
    const noir = new THREE.MeshStandardMaterial({ color: c3(24, 24, 30), roughness: 0.6 });
    const carotte = new THREE.MeshStandardMaterial({ color: c3(240, 120, 30), roughness: 0.6 });
    const echarpe = new THREE.MeshStandardMaterial({ color: c3(200, 30, 40), roughness: 0.8 });
    const places = [[-28, 12], [26, 14], [-36, -12], [34, -10], [0, 20]];
    for (const [dx, dy] of places) {
      const g = new THREE.Group(); g.position.set(xc + dx, yc + dy, 0); ajoute(g);   // de face vers +y : la ligne droite d'arrivee
      const boule = (r: number, z: number) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), blanc); m.position.z = z; m.castShadow = true; g.add(m); };
      boule(1.3, 1.1); boule(0.95, 2.95); boule(0.68, 4.3);
      const nez = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.7, 8), carotte); nez.position.set(0, 0.95, 4.3); g.add(nez);   // le cone pointe vers +y
      for (const ox of [-0.24, 0.24]) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), noir); o.position.set(ox, 0.6, 4.5); g.add(o); }
      const bord = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 18).rotateX(Math.PI / 2), noir); bord.position.z = 4.88; g.add(bord);
      const chapeau = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.5, 0.75, 18).rotateX(Math.PI / 2), noir); chapeau.position.z = 5.28; g.add(chapeau);
      const ech = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.15, 8, 20), echarpe); ech.position.z = 3.75; g.add(ech);
      for (const z of [2.6, 3.0, 3.4]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), noir); b.position.set(0, 0.93, z); g.add(b); }
    }
  }

  // --- LES RENNES LUMINEUX, au galop dans l'aire interieure ------------------------------
  // Des silhouettes de guirlande, comme sur les places de village. Le premier est petit :
  // c'est Givre, qui suit les coureurs (docs/NOEL_HISTOIRE.md).
  {
    // le profil d'un renne, en metres (x vers l'avant, z en haut), trace d'un seul trait
    const P = [[-1.1, 0], [-1.0, 0.9], [-1.2, 1.25], [-1.0, 1.55], [0.8, 1.55], [1.15, 1.9], [1.3, 2.35], [1.55, 2.3], [1.5, 2.05],
      [1.05, 1.5], [0.95, 0.9], [1.05, 0], [0.85, 0], [0.7, 0.9], [-0.7, 0.9], [-0.85, 0], [-1.1, 0]];
    const BOIS = [[[1.3, 2.35], [1.1, 3.0], [0.8, 3.3]], [[1.1, 3.0], [1.4, 3.25]], [[1.35, 2.4], [1.7, 3.0], [2.0, 3.15]], [[1.7, 3.0], [1.6, 3.35]]];
    const trait = (pts: number[][], pas: number, f: (x: number, z: number) => void) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / pas));
        for (let k = 0; k < n; k++) f(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n);
      }
    };
    const pos: number[] = [], coul: THREE.Color[] = [];
    const troupeau = [[-46, 6, 1.0, 0.2], [-40, 2, 1.25, 0.2], [44, 4, 1.25, Math.PI + 0.2], [-10, -24, 0.7, 0]];
    for (const [dx, dy, k, rz] of troupeau) {
      const ca = Math.cos(rz), sa = Math.sin(rz);
      const poser = (x: number, z: number) => { pos.push(xc + dx + x * k * ca, yc + dy + x * k * sa, z * k); coul.push(c3(235, 245, 255)); };
      trait(P, 0.18, poser);
      for (const b of BOIS) trait(b, 0.16, (x, z) => { pos.push(xc + dx + x * k * ca, yc + dy + x * k * sa, z * k); coul.push(c3(255, 214, 140)); });
    }
    const rennes = ajoute(lumieres(pos, coul, 0.7, texAmpoule));
    anims.push(t => { (rennes.material as THREE.PointsMaterial).opacity = 0.9 + 0.1 * Math.sin(t * 5); });
  }

  // --- LE PANNEAU « JOYEUX NOEL », face a la ligne droite --------------------------------
  {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, 1024, 256);
    c.font = 'bold 150px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(255,200,110,1)'; c.shadowBlur = 40;
    c.fillStyle = '#ffe2a0'; c.fillText('Joyeux Noël', 512, 132);
    c.shadowBlur = 0; c.fillStyle = '#fff6dc'; c.fillText('Joyeux Noël', 512, 132);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const enseigne = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(22, 5.5), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false })));
    // debout dans l'aire interieure, tournee vers la ligne droite d'arrivee, derriere le sapin
    enseigne.rotation.x = Math.PI / 2;
    enseigne.position.set(xc, yc - 14, 9);
  }

  // --- LES SAPINS ENNEIGES, tout autour du stade --------------------------------------
  {
    const branches = new Lot(new THREE.ConeGeometry(1, 1, 8, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    const neige = new Lot(new THREE.ConeGeometry(1, 1, 8, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5),
      new THREE.MeshLambertMaterial({ color: c3(236, 244, 255), flatShading: true }));
    const n = 170;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (hasard() - 0.5) * 0.05;
      for (const couche of [0, 1]) {
        if (couche && hasard() < 0.4) continue;
        const rx = 150 + couche * 22 + hasard() * 30, ry = 98 + couche * 16 + hasard() * 22;
        const x = xc + rx * Math.cos(a), y = yc + ry * Math.sin(a);
        const h = 9 + hasard() * 9, r = h * 0.3;
        const v = 0.7 + hasard() * 0.4;
        for (let e = 0; e < 3; e++) {
          const z = e * h * 0.26, he = h * (0.55 - e * 0.1), re = r * (1 - e * 0.25);
          branches.poser(x, y, z, re, re, he, hasard() * 6, c3(20 * v, 58 * v, 40 * v));
          neige.poser(x, y, z + he * 0.55, re * 0.6, re * 0.6, he * 0.45, hasard() * 6);
        }
      }
    }
    branches.finir(stade); neige.finir(stade);
  }

  // --- LA NEIGE QUI TOMBE, autour de la camera ------------------------------------------
  // Une boite de quatre-vingts metres de cote qui suit la camera ; chaque flocon descend,
  // ondule, et repart du haut. Tout le calcul tient dans `animer` : pas de shader a maintenir.
  const N = 4200, BOITE = 70, HAUTEUR = 30;
  const base = new Float32Array(N * 4);   // x, y, z0, phase
  for (let i = 0; i < N; i++) base.set([(hasard() - 0.5) * BOITE, (hasard() - 0.5) * BOITE, hasard() * HAUTEUR, hasard() * 6.28], i * 4);
  const pos = new Float32Array(N * 3);
  const gNeige = new THREE.BufferGeometry();
  gNeige.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flocons = ajoute(new THREE.Points(gNeige, new THREE.PointsMaterial({ size: 0.3, map: halo('rgba(255,255,255,1)', 32),
    color: 0xf4f8ff, transparent: true, opacity: 0.95, depthWrite: false })));
  flocons.frustumCulled = false;
  anims.push((t, cx, cy) => {
    for (let i = 0; i < N; i++) {
      const b = i * 4, ph = base[b + 3];
      const z = ((base[b + 2] - t * (0.9 + (ph % 1) * 0.6)) % HAUTEUR + HAUTEUR) % HAUTEUR;
      // la boite suit la camera, mais chaque flocon reste a sa place dans le monde : on replie
      // sa position autour de la camera au lieu de deplacer le nuage entier.
      const x = cx + ((((base[b] - cx) % BOITE) + BOITE * 1.5) % BOITE) - BOITE / 2;
      const y = cy + ((((base[b + 1] - cy) % BOITE) + BOITE * 1.5) % BOITE) - BOITE / 2;
      pos[i * 3] = x + Math.sin(t * 0.8 + ph) * 0.7;
      pos[i * 3 + 1] = y + Math.cos(t * 0.6 + ph) * 0.5;
      pos[i * 3 + 2] = z;
    }
    gNeige.attributes.position.needsUpdate = true;
  });

  return (t, camX, camY) => { for (const f of anims) f(t, camX, camY); };
}
