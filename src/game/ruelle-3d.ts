// LA RUELLE DES TANNEURS EN 3D — la nuit du molosse (23/10/2026, « recree
// l'evenement le molosse en full 3D »).
//
// Le decor 2D (decors-stades.js, PLAN.halloween ; ruelle-nuit.js) posait des
// facades Tripo de part et d'autre d'une piste fondue dans les paves, des
// reverberes, des guirlandes. Ce module le reconstruit pour la course three.js
// (course-3d.ts l'appelle a la place du stade quand le theme porte `ruelle`), sur
// TOUTE la longueur de la nuit (100, 200, 300, 400 m, ou le virage de 100 m) :
// le stade, lui, ne connait qu'une ligne droite de cent metres.
//
// LE COTE DE LA CAMERA RESTE OUVERT. La camera se tient du cote de la corde et
// regarde la course de profil : une rangee de maisons de ce cote-la passerait
// entre elle et les coureurs. Les facades y sont donc reculees au-dela de la
// camera ; on ne les voit qu'au depart, de trois quarts.
//
// LE TELEPHONE LE PLUS FAIBLE. Une maison Tripo fait trente mille faces : une
// ruelle de 400 m en aligne cent cinquante. Elles sont instanciees, et seules
// celles qui sont autour de la camera sont dessinees (`animer`). Les reverberes
// sont faits a la main (le GLB en faisait trente mille aussi), et quatre vraies
// lumieres seulement suivent le joueur de reverbere en reverbere ; le reste de
// la lumiere est peint (halos, flaques de lumiere sur les paves).

import * as THREE from 'three';

export type ContexteRuelle = {
  stade: THREE.Group;
  /** Le trace du jeu (Track) : `total`, `curved`, `arc`. */
  T: any;
  /** Largeur de la piste (huit couloirs) et rayon de la corde, en metres. */
  W: number; R1: number;
  /** Du repere du jeu a celui du stade (course-3d.ts). */
  ici: (p: number[]) => number[];
  th: any;
  hasard: () => number;
  /** Une piece Tripo du decor (public/modeles/stades/<cle>.glb), ou null tant qu'elle n'est pas chargee. */
  piece: (cle: string) => THREE.Object3D | null;
};

export type Ruelle = {
  /** A chaque image : la camera et le joueur, dans le repere du stade ; l'horloge en secondes. */
  animer(camX: number, camY: number, jx: number, jy: number, t: number): void;
};

const c3 = (r: number, g: number, b: number) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);

function toile(dessin: (c: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  dessin(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Des paves : des galets arrondis en rangees decalees, joints sombres. */
function paves(fond: number[], k: number, hasard: () => number) {
  return toile((c, w, h) => {
    c.fillStyle = `rgb(${fond.map(v => (v * 0.45) | 0).join(',')})`; c.fillRect(0, 0, w, h);
    const R = 16;
    for (let y = 0; y < h; y += R) for (let x = -R; x < w; x += R) {
      const dx = ((y / R) % 2) * R / 2, v = (0.75 + hasard() * 0.4) * k;
      c.fillStyle = `rgb(${fond.map(u => Math.min(255, u * v) | 0).join(',')})`;
      c.beginPath();
      (c as any).roundRect ? (c as any).roundRect(x + dx + 1.5, y + 1.5, R - 3, R - 3, 5) : c.rect(x + dx + 1.5, y + 1.5, R - 3, R - 3);
      c.fill();
      // le bombe du galet : un reflet en haut a gauche
      c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x + dx + 4, y + 4, 5, 3);
    }
  }, 128, 128);
}

const halo = (couleur: string) => toile((c, w, h) => {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, couleur); g.addColorStop(0.35, couleur.replace(/[\d.]+\)$/, '0.35)')); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}, 64, 64);

export function construireRuelle(o: ContexteRuelle): Ruelle {
  const { stade, T, W, R1, ici, th, hasard } = o;
  const ajoute = <M extends THREE.Object3D>(m: M) => { stade.add(m); return m; };
  const total = T.total as number;
  const U0 = -40, U1 = total + 70;

  // LE CHEMIN : un point a la distance u le long de la corde, a `lat` metres vers
  // l'exterieur (negatif : vers l'interieur), et le cap du trace a cet endroit.
  // Sur le virage, l'angle est pris sur la corde : les facades restent alignees.
  const pt = (u: number, lat: number): number[] => {
    if (!T.curved) return ici([u, lat]);
    const A = T.arc, r = R1 + lat;
    if (u < A) { const phi = (A - u) / R1; return ici([-r * Math.sin(phi), r * Math.cos(phi)]); }
    return ici([u - A, r]);
  };
  const cap = (u: number) => { const a = pt(u - 0.5, 0), b = pt(u + 0.5, 0); return Math.atan2(b[1] - a[1], b[0] - a[0]); };

  /** Un ruban le long du chemin, de u0 a u1, entre deux bords ; uv en metres / `pas`. */
  const ruban = (u0: number, u1: number, l0: number, l1: number, z: number, mat: THREE.Material, pas = 2) => {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const n = Math.max(1, Math.ceil((u1 - u0) / (T.curved ? 1 : 10)));
    for (let i = 0; i <= n; i++) {
      const u = u0 + (u1 - u0) * i / n, a = pt(u, l0), b = pt(u, l1);
      pos.push(a[0], a[1], z, b[0], b[1], z);
      uv.push(u / pas, l0 / pas, u / pas, l1 / pas);
      if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.material.side = THREE.DoubleSide;
    m.receiveShadow = true;
    return ajoute(m);
  };

  // --- LE SOL : la rue pavee, la piste rouille fondue dedans, les caniveaux -------------
  const rue = paves(th.grass || [46, 48, 58], 1.15, hasard);
  ruban(U0 - 30, U1 + 30, -60, W + 40, -0.03, new THREE.MeshStandardMaterial({ map: rue, roughness: 0.55, metalness: 0.15 }), 1.6);
  const piste = paves(th.trackA || [150, 78, 40], 1.0, hasard);
  ruban(-6, total + 30, -0.3, W + 0.3, 0, new THREE.MeshStandardMaterial({ map: piste, roughness: 0.6, metalness: 0.1 }), 1.6);
  const caniveau = new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.15, metalness: 0.5 });
  ruban(U0, U1, -0.9, -0.35, 0.004, caniveau);
  ruban(U0, U1, W + 0.35, W + 0.9, 0.004, caniveau);
  // les lignes des couloirs, usees (« ligneUsee » du 2D) : a moitie effacees
  const ligne = new THREE.MeshBasicMaterial({ color: c3(...((th.lane || [242, 232, 208]) as [number, number, number])), transparent: true, opacity: 0.45, depthWrite: false });
  for (let k = 0; k <= 8; k++) ruban(-6, total + 30, k * 1.22 - 0.03, k * 1.22 + 0.03, 0.006, ligne);
  // le depart et l'arrivee : des bandes de peinture blanche ecaillee
  const peinture = toile((c, w, h) => {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
      c.fillStyle = (i + j) % 2 ? '#1a1418' : '#e8dcc8'; c.fillRect(i * w / 8, j * h / 2, w / 8, h / 2);
    }
    for (let k = 0; k < 120; k++) { c.fillStyle = 'rgba(40,30,30,0.7)'; c.fillRect(Math.random() * w, Math.random() * h, 3, 2); }
  }, 128, 32);
  peinture.wrapS = peinture.wrapT = THREE.ClampToEdgeWrapping;
  const matArrivee = new THREE.MeshBasicMaterial({ map: peinture, transparent: true, opacity: 0.85, depthWrite: false });
  ruban(total - 0.35, total + 0.35, 0, W, 0.008, matArrivee, 100);
  ruban(-0.08, 0.08, 0, W, 0.008, new THREE.MeshBasicMaterial({ color: 0xe8dcc8, transparent: true, opacity: 0.6, depthWrite: false }));
  // des flaques : du noir poli qui renvoie les reverberes
  const flaque = new THREE.MeshStandardMaterial({ color: 0x07070c, roughness: 0.04, metalness: 0.7 });
  for (let i = 0; i < Math.round((U1 - U0) / 9); i++) {
    const u = U0 + hasard() * (U1 - U0), lat = hasard() < 0.5 ? -2 - hasard() * 8 : W + 1.2 + hasard() * 5;
    const p = pt(u, lat), f = new THREE.Mesh(new THREE.CircleGeometry(1, 18), flaque);
    f.position.set(p[0], p[1], 0.01); f.scale.set(0.8 + hasard() * 2.2, 0.5 + hasard() * 1.1, 1); f.rotation.z = hasard() * 3;
    ajoute(f);
  }

  // --- LES FACADES : une rangee en face de la camera, une autre reculee derriere elle --
  type Rang = { im: THREE.InstancedMesh | null; cle: string; places: THREE.Matrix4[]; xy: number[][]; rayon: number };
  const rangs: Rang[] = [];
  const rang = (cle: string, rayon: number) => { const r: Rang = { im: null, cle, places: [], xy: [], rayon }; rangs.push(r); return r; };
  const maisons = rang('halloween/maison', 95), portes = rang('halloween/porte', 95), poubelles = rang('halloween/poubelles', 60);
  const tours = [0, 90, 270, 0, 270, 90].map(d => d * Math.PI / 180);
  const poser = (r: Rang, u: number, lat: number, tour: number) => {
    const p = pt(u, lat);
    r.places.push(new THREE.Matrix4().makeRotationZ(cap(u) + tour).setPosition(p[0], p[1], 0));
    r.xy.push(p);
  };
  const FACE = W + 14.2 - 9.8, DOS = -26;      // l'exterieur comme le 2D (d = -14,2) ; l'interieur recule
  for (let u = U0, i = 0; u <= U1; u += 6.4, i++) {
    const porte = i % 7 === 3;
    poser(porte ? portes : maisons, u, porte ? FACE - 2 : FACE, porte ? 0 : tours[i % 6]);
    poser(porte ? portes : maisons, u, porte ? DOS + 2 : DOS, Math.PI + (porte ? 0 : tours[(i + 2) % 6]));
  }
  for (let u = U0 + 10, i = 0; u <= U1; u += 23, i++) poser(poubelles, u, FACE - 3.2, tours[i % 6]);
  const instancier = () => {
    for (const r of rangs) {
      if (r.im) continue;
      const modele = o.piece(r.cle);
      if (!modele) continue;
      let mesh: THREE.Mesh | null = null;
      modele.traverse((x: any) => { if (!mesh && x.isMesh) mesh = x; });
      if (!mesh) continue;
      const m = mesh as THREE.Mesh;
      // la teinte de la nuit : les facades rendues au soleil (Tripo), assombries et bleuies
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if ((mat as any).color) mat.color.multiply(new THREE.Color(0.55, 0.52, 0.68));
      m.updateWorldMatrix(true, false);
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      r.im = new THREE.InstancedMesh(geo, mat, r.places.length);
      r.im.count = 0; r.im.castShadow = false; r.im.receiveShadow = true; r.im.frustumCulled = false;
      ajoute(r.im);
    }
  };
  instancier();

  // --- LES REVERBERES : fonte noire, lanterne, halo, flaque de lumiere ; et les vraies -
  // lumieres, quatre, qui suivent le joueur de reverbere en reverbere
  const fonte = new THREE.MeshStandardMaterial({ color: 0x15141a, roughness: 0.5, metalness: 0.6 });
  const vitre = new THREE.MeshBasicMaterial({ color: c3(255, 196, 110) });
  const matHalo = new THREE.SpriteMaterial({ map: halo('rgba(255,190,110,1)'), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 });
  const matNappe = new THREE.MeshBasicMaterial({ map: halo('rgba(255,170,90,1)'), transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const fut = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.1, 4.2, 8).rotateX(Math.PI / 2).translate(0, 0, 2.1), fonte, 200);
  const lanterne = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.14, 0.5, 6).rotateX(Math.PI / 2), vitre, 200);
  const chapeau = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 0.3, 6).rotateX(Math.PI / 2), fonte, 200);
  fut.count = lanterne.count = chapeau.count = 0;
  const lampes: number[][] = [];
  const reverbere = (u: number, lat: number) => {
    const p = pt(u, lat), M = new THREE.Matrix4();
    fut.setMatrixAt(fut.count++, M.makeTranslation(p[0], p[1], 0));
    lanterne.setMatrixAt(lanterne.count++, M.makeTranslation(p[0], p[1], 4.45));
    chapeau.setMatrixAt(chapeau.count++, M.makeTranslation(p[0], p[1], 4.85));
    const h = new THREE.Sprite(matHalo); h.position.set(p[0], p[1], 4.45); h.scale.setScalar(2.6); ajoute(h);
    const n = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), matNappe); n.position.set(p[0], p[1], 0.02); ajoute(n);
    lampes.push([p[0], p[1], 4.3]);
  };
  for (let u = -24; u <= U1 - 10 && fut.count < 198; u += 18) { reverbere(u, W + 1.1); reverbere(u + 9, -1.4); }
  fut.castShadow = true;
  for (const m of [fut, lanterne, chapeau]) { m.frustumCulled = false; ajoute(m); }
  const vraies = [0, 1, 2, 3].map(() => {
    const l = new THREE.PointLight(0xffb36a, 18, 22, 1.6);
    return ajoute(l);
  });

  // --- LES GUIRLANDES : des lanternes orange et violettes tendues au-dessus de la rue --
  const perles: number[] = [], teintes: number[] = [];
  const orange = c3(255, 140, 40), violet = c3(170, 80, 255);
  for (let u = -10; u <= U1 - 10; u += 14) {
    const a = pt(u, FACE - 3.8), b = pt(u + 3, -3);
    for (let k = 0; k <= 22; k++) {
      const t = k / 22, z = 7.2 - Math.sin(t * Math.PI) * 1.6;
      perles.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z);
      const c = k % 3 === 2 ? violet : orange; teintes.push(c.r, c.g, c.b);
    }
  }
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(perles, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(teintes, 3));
    ajoute(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.32, vertexColors: true, map: halo('rgba(255,255,255,1)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  }

  // --- LES CITROUILLES, au pied des facades : sculptees, une bougie dedans --------------
  const courge = new THREE.MeshStandardMaterial({ color: c3(214, 96, 20), roughness: 0.6, emissive: c3(120, 40, 0), emissiveIntensity: 0.6 });
  const tige = new THREE.MeshStandardMaterial({ color: 0x2c3a18, roughness: 0.8 });
  const matBougie = new THREE.SpriteMaterial({ map: halo('rgba(255,150,40,1)'), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 });
  for (let u = U0 + 4; u <= U1; u += 8.5 + hasard() * 4) {
    for (const lat of [FACE - 3.5 - hasard() * 0.6, -2.4 - hasard() * 0.8]) {
      if (hasard() < 0.35) continue;
      const p = pt(u + hasard() * 2, lat), r = 0.28 + hasard() * 0.18;
      const c = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), courge);
      c.position.set(p[0], p[1], r * 0.8); c.scale.set(r * 1.15, r * 1.15, r * 0.85); c.castShadow = true; ajoute(c);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.14, 6).rotateX(Math.PI / 2), tige);
      t.position.set(p[0], p[1], r * 1.62); ajoute(t);
      const s = new THREE.Sprite(matBougie); s.position.set(p[0], p[1], r * 0.8); s.scale.setScalar(r * 3.2); ajoute(s);
    }
  }

  // --- LE CIEL : la lune rousse et son halo, au-dessus des toits d'en face ----------------
  {
    const lune = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, depthWrite: false, map: toile((c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,236,200,1)'); g.addColorStop(0.16, 'rgba(250,214,160,1)'); g.addColorStop(0.19, 'rgba(240,150,90,0.45)');
      g.addColorStop(0.5, 'rgba(160,70,90,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      // ses mers
      c.fillStyle = 'rgba(190,140,110,0.35)';
      for (const [x, y, r] of [[0.46, 0.45, 0.04], [0.54, 0.52, 0.03], [0.5, 0.42, 0.025]]) { c.beginPath(); c.arc(x * w, y * h, r * w, 0, 7); c.fill(); }
    }, 256, 256), blending: THREE.AdditiveBlending }));
    const p = pt(total * 0.55, 420);
    lune.position.set(p[0], p[1], 170); lune.scale.setScalar(260);
    ajoute(lune);
  }

  // --- LA BRUME : des nappes basses qui derivent dans la rue -----------------------------
  const matBrume = new THREE.SpriteMaterial({ map: halo('rgba(150,130,190,1)'), transparent: true, depthWrite: false, opacity: 0.16 });
  const brumes: { s: THREE.Sprite; u: number; lat: number; v: number }[] = [];
  for (let i = 0; i < Math.round((U1 - U0) / 6); i++) {
    const s = new THREE.Sprite(matBrume.clone());
    (s.material as THREE.SpriteMaterial).opacity = 0.08 + hasard() * 0.12;
    const b = { s, u: U0 + hasard() * (U1 - U0), lat: -8 + hasard() * (FACE + 4), v: 0.3 + hasard() * 0.5 };
    s.scale.set(9 + hasard() * 8, 3 + hasard() * 2, 1);
    brumes.push(b); ajoute(s);
  }

  // --- CHAQUE IMAGE ----------------------------------------------------------------------
  return {
    animer(camX, camY, jx, jy, t) {
      instancier();
      for (const r of rangs) {
        if (!r.im) continue;
        let n = 0;
        for (let i = 0; i < r.places.length; i++) {
          const dx = r.xy[i][0] - camX, dy = r.xy[i][1] - camY;
          if (dx * dx + dy * dy < r.rayon * r.rayon) r.im.setMatrixAt(n++, r.places[i]);
        }
        r.im.count = n; r.im.instanceMatrix.needsUpdate = true;
      }
      // les quatre reverberes les plus proches du joueur portent les vraies lumieres
      const proches = lampes.map((l, i) => [(l[0] - jx) ** 2 + (l[1] - jy) ** 2, i]).sort((a, b) => a[0] - b[0]);
      vraies.forEach((l, k) => { const q = lampes[proches[k] ? proches[k][1] : 0]; if (q) l.position.set(q[0], q[1], q[2]); });
      for (const b of brumes) {
        const u = U0 + (((b.u + t * b.v) - U0) % (U1 - U0) + (U1 - U0)) % (U1 - U0);
        const p = pt(u, b.lat);
        b.s.position.set(p[0], p[1], 0.9 + Math.sin(t * 0.3 + b.lat) * 0.3);
      }
    },
  };
}
