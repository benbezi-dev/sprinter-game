// LE STADE COUVERT JESSE OWENS DE VAL-DE-REUIL, EN 3D (26/10/2026).
//
// L'auteur : « cree cette piste dans la version 3D », « il faut que l'interieur de la salle
// soit reconnaissable directement », « texture et realisme de la piste et de la salle ».
// Releve d'apres les plans de la ville (assets-sources/piste-couverte-val-de-reuil/
// references/plans), la visite filmee de janvier 2025 (apres la renovation de la piste de
// 2024 : couloirs alternes bleu roi et anthracite, plateau gris clair) et les replays des
// France U18-U20 de fevrier 2026 :
//  - l'anneau de 200 m, virages releves a 15°, six couloirs (piste-salle.js, les memes cotes
//    que le moteur) ; la ligne droite centrale a huit couloirs, dans le plateau ;
//  - autour de l'anneau, un muret blanc puis le grand bandeau de bois rouge qui porte la
//    coursive vitree ; une tribune bleue le long de la ligne d'arrivee ;
//  - des murs blancs aux longs bandeaux vitres, des fermes d'acier sous un plafond de bois.
// Aucune marque (ni piste, ni federation, ni sponsor) : les banderoles portent le nom de la ville.
//
// Repere : celui du stade de course-3d.ts — x le long de la ligne d'arrivee (l'arrivee en
// x = 0, on court vers +x), y vers l'exterieur (couloirs de la ligne d'arrivee en y > 0),
// z en haut. Les virages tournent autour de (0, -RS) et (-S, -RS).

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { SALLE, DROITE } from './piste-salle.js';

export const RS = SALLE.rayon;                       // la corde (17,20 m)
const S = DROITE;                                     // la ligne droite de l'anneau (45,34 m)
const NC = SALLE.couloirs, CW = SALLE.couloir;        // six couloirs de 0,90 m
const W = NC * CW;
const PENTE = Math.tan(SALLE.inclinaison);            // le relevement des virages (15°)
const TRANS = 10;                                     // le relevement s'installe sur dix metres de ligne droite
const R_MUR = RS + W + 0.35;                          // le muret blanc au bord de l'anneau
const R_BOIS = R_MUR + 2.2;                           // le bandeau de bois, sous la coursive
const H_COURSIVE = 3.4;
const LONG = 29, LARGE = 29;                          // la halle : 29 m au-dela des centres des virages, de chaque cote
const H_TOIT = 12.5;
const CW_DROITE = 1.22, NC_DROITE = 8;                // la ligne droite centrale

const lisse = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Le relevement (0 a 1) en un point de l'axe x : plein dans les virages, nul au milieu des lignes droites. */
function releve(x: number) {
  if (x >= 0 || x <= -S) return 1;
  return Math.max(1 - lisse(0, TRANS, -x), 1 - lisse(0, TRANS, x + S));
}
/** La distance au centre de virage le plus proche (dans un virage), ou a l'axe (en ligne droite). */
function rayonEn(x: number, y: number) {
  if (x > 0) return Math.hypot(x, y + RS);
  if (x < -S) return Math.hypot(x + S, y + RS);
  return Math.abs(y + RS);
}
/** La hauteur du sol en un point du stade : l'anneau relevé, le plateau a zero. */
export function zSol(x: number, y: number) {
  const r = rayonEn(x, y);
  if (r <= RS) return 0;
  return Math.min(r, R_MUR) - RS > 0 ? (Math.min(r, R_MUR) - RS) * PENTE * releve(x) : 0;
}

/**
 * Du repere du jeu a celui de la salle (voir caler, course-3d.ts). L'anneau : le jeu met
 * son premier virage autour de l'origine et finit sur y = -r en allant vers -x ; on le
 * retourne. Le 60 m : la ligne droite centrale, son depart a 55 m de l'arrivee (x = 5).
 */
export function calageSalle(T: any): { sx: number; x0: number; y0: number } {
  if (T.salle) return { sx: -1, x0: 0, y0: -RS };
  return { sx: 1, x0: -55, y0: -RS - (NC_DROITE / 2) * CW_DROITE };
}
export const estEnSalle = (T: any, race: any) => !!(T && (T.salle || (race && race.salleDroite)));
/** Le survol de presentation : dehors, autour du batiment (l'exterieur Tripo), puis la plongee vers le depart. */
export const SURVOL_SALLE = { cx: -S / 2, cy: -RS, rx: 105, ry: 78, z: 40 };

/* ------------------------------------------------------------------ les matieres */

/** Une toile en texture repetee. */
function toile(w: number, h: number, peindre: (c: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  peindre(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}
/** Un tirage fixe : la salle est la meme a chaque course. */
function tirage(graine: number) { let a = graine; return () => ((a = (a * 16807) % 2147483647) / 2147483647); }

/** Le grain du revetement coule (granulats de caoutchouc) : une couleur pointillee et son relief. */
function revetement(rgb: number[], graine: number) {
  const h = tirage(graine);
  const N = 512;
  const relief = new Float32Array(N * N);
  const couleur = toile(N, N, (c) => {
    const im = c.createImageData(N, N);
    for (let i = 0; i < N * N; i++) {
      const g = h(), k = 0.9 + 0.2 * g + (h() < 0.03 ? 0.18 : 0) - (h() < 0.03 ? 0.14 : 0);
      relief[i] = g;
      im.data[i * 4] = Math.min(255, rgb[0] * k); im.data[i * 4 + 1] = Math.min(255, rgb[1] * k); im.data[i * 4 + 2] = Math.min(255, rgb[2] * k); im.data[i * 4 + 3] = 255;
    }
    c.putImageData(im, 0, 0);
  });
  // la normale, des differences du relief (un grain, pas des bosses)
  const normale = toile(N, N, (c) => {
    const im = c.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, dx = relief[y * N + ((x + 1) % N)] - relief[i], dy = relief[((y + 1) % N) * N + x] - relief[i];
      im.data[i * 4] = 128 - dx * 70; im.data[i * 4 + 1] = 128 - dy * 70; im.data[i * 4 + 2] = 255; im.data[i * 4 + 3] = 255;
    }
    c.putImageData(im, 0, 0);
  }, false);
  return { couleur, normale };
}
function matRevetement(rgb: number[], graine: number, rep: number) {
  const { couleur, normale } = revetement(rgb, graine);
  couleur.repeat.set(rep, rep); normale.repeat.set(rep, rep);
  return new THREE.MeshStandardMaterial({ map: couleur, normalMap: normale, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.82, metalness: 0 });
}
/** Les lames de bois rouge du bandeau : verticales, chacune sa teinte et son veinage. */
function lamesDeBois(base: number[], verticales: boolean, graine: number) {
  const h = tirage(graine);
  return toile(512, 512, (c, w, hh) => {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const k = 0.82 + h() * 0.3;
      c.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
      if (verticales) c.fillRect(i * w / n, 0, w / n - 3, hh); else c.fillRect(0, i * hh / n, w, hh / n - 3);
      // le veinage
      c.strokeStyle = `rgba(60,25,10,${0.08 + h() * 0.1})`; c.lineWidth = 1;
      for (let v = 0; v < 6; v++) {
        c.beginPath();
        const o = h() * (verticales ? w / n : hh / n);
        if (verticales) { c.moveTo(i * w / n + o, 0); for (let y = 0; y <= hh; y += 32) c.lineTo(i * w / n + o + Math.sin(y / 40 + h() * 6) * 2, y); }
        else { c.moveTo(0, i * hh / n + o); for (let x = 0; x <= w; x += 32) c.lineTo(x, i * hh / n + o + Math.sin(x / 40 + h() * 6) * 2); }
        c.stroke();
      }
    }
    c.fillStyle = 'rgba(30,12,4,0.55)';
    for (let i = 0; i < n; i++) if (verticales) c.fillRect((i + 1) * w / n - 3, 0, 3, hh); else c.fillRect(0, (i + 1) * hh / n - 3, w, 3);
  });
}
/** Un beton peint, blanc casse, a peine marque. */
function mur(rgb: number[], graine: number) {
  const h = tirage(graine);
  return toile(256, 256, (c, w, hh) => {
    c.fillStyle = `rgb(${rgb.join(',')})`; c.fillRect(0, 0, w, hh);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(0,0,0,${h() * 0.03})`; c.fillRect(h() * w, h() * hh, 2 + h() * 6, 2 + h() * 6); }
  });
}

/* ------------------------------------------------------------------ la geometrie */

/** Le tour de l'anneau au rayon r : la suite des points (x, y) et du relevement, de l'arrivee a l'arrivee. */
function tour(r: number): { x: number; y: number; f: number }[] {
  const pts: { x: number; y: number; f: number }[] = [];
  const pas = 0.5, seg = 128;
  for (let x = -S; x < 0; x += pas) pts.push({ x, y: -RS + r, f: releve(x) });          // la ligne d'arrivee, vers +x
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI; pts.push({ x: r * Math.sin(a), y: -RS + r * Math.cos(a), f: 1 }); }
  for (let x = 0; x > -S; x -= pas) pts.push({ x, y: -RS - r, f: releve(x) });          // la ligne opposee, vers -x
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI; pts.push({ x: -S - r * Math.sin(a), y: -RS - r * Math.cos(a), f: 1 }); }
  pts.push(pts[0]);
  return pts;
}
const zEn = (r: number, f: number) => Math.max(0, Math.min(r, R_MUR) - RS) * PENTE * f;

/** Une bande de l'anneau entre deux rayons, relevee, a dz au-dessus du revetement. Les UV en metres. */
function bandeAnneau(r0: number, r1: number, dz: number) {
  const a = tour(r0), b = tour(r1);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    if (i) s += Math.hypot(a[i].x - a[i - 1].x, a[i].y - a[i - 1].y);
    pos.push(a[i].x, a[i].y, zEn(r0, a[i].f) + dz, b[i].x, b[i].y, zEn(r1, b[i].f) + dz);
    uv.push(s, 0, s, r1 - r0);
    // (le tour tourne dans le sens horaire vu de dessus, l'interieur a droite : cet ordre met les faces vers le haut)
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** Un mur qui suit l'anneau au rayon r, de z0 a z1 (z1 < 0 : jusqu'au haut du relevement + |z1|). */
function murAnneau(r: number, z0: (f: number) => number, z1: (f: number) => number) {
  const a = tour(r);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    if (i) s += Math.hypot(a[i].x - a[i - 1].x, a[i].y - a[i - 1].y);
    const b = z0(a[i].f), h = z1(a[i].f);
    pos.push(a[i].x, a[i].y, b, a[i].x, a[i].y, h);
    uv.push(s, b, s, h);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Les sieges de la coursive, pour y asseoir le public (placesDuPublic). */
const sieges3: { x: number; y: number; z: number; face: number }[] = [];
export type ContexteSalle = { stade: THREE.Group; renderer: THREE.WebGLRenderer | null; base: string };

/**
 * Construire la salle dans `stade`. Rend l'animation de la salle (rien a animer pour
 * l'instant) ; course-3d.ts regle lui-meme le ciel, la brume et les lumieres d'apres SALLE_LUMIERE.
 */
export function construireSalle(ctx: ContexteSalle) {
  sieges3.length = 0;
  // tout l'interieur dans un groupe : on le cache quand la camera survole le batiment, dehors
  const g = new THREE.Group(); ctx.stade.add(g);
  const ajouter = (geo: THREE.BufferGeometry, mat: THREE.Material, ombre = true) => {
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = ombre; g.add(m); return m;
  };
  // les murs qui suivent l'anneau se voient des deux cotes (la piste et la coursive)
  const murDouble = (geo: THREE.BufferGeometry, mat: THREE.Material) => { const m2 = (mat as THREE.MeshStandardMaterial).clone(); m2.side = THREE.DoubleSide; return ajouter(geo, m2); };
  const BLEU = [30, 92, 178], ANTHRACITE = [78, 80, 88], PLATEAU = [176, 176, 170], BLANC = [244, 245, 246];
  const bleu = matRevetement(BLEU, 11, 1), anthracite = matRevetement(ANTHRACITE, 23, 1);
  const plateau = matRevetement(PLATEAU, 37, 1);
  const ligne = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.93, 0.94, 0.95), roughness: 0.6 });
  ligne.polygonOffset = true; ligne.polygonOffsetFactor = -2; ligne.polygonOffsetUnits = -4;
  for (const m of [bleu, anthracite]) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; }
  // les textures de revetement sont en metres : une tuile pour 1,6 m
  for (const m of [bleu, anthracite, plateau]) { m.map!.repeat.set(1 / 1.6, 1 / 1.6); m.normalMap!.repeat.set(1 / 1.6, 1 / 1.6); }

  // LE PLATEAU : tout le sol de la halle, gris clair
  const sol = new THREE.PlaneGeometry(S + 2 * LONG, 2 * LARGE);
  const ps = ajouter(sol, plateau);
  ps.position.set(-S / 2, -RS, -0.01);
  const uvSol = sol.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uvSol.count; i++) uvSol.setXY(i, uvSol.getX(i) * (S + 2 * LONG), uvSol.getY(i) * 2 * LARGE);

  // L'ANNEAU : six couloirs alternes, et une bande d'anthracite derriere le sixieme jusqu'au muret
  for (let k = 0; k < NC; k++) ajouter(bandeAnneau(RS + k * CW, RS + (k + 1) * CW, 0.004), k % 2 ? anthracite : bleu);
  ajouter(bandeAnneau(RS + W, R_MUR, 0.004), anthracite);
  for (let k = 0; k <= NC; k++) ajouter(bandeAnneau(RS + k * CW - 0.025, RS + k * CW + 0.025, 0.008), ligne, false);
  // la corde : une lisse blanche en saillie au bord interieur
  ajouter(murAnneau(RS - 0.06, () => 0, () => 0.05), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }), false);

  // LA LIGNE DROITE CENTRALE : huit couloirs alternes, du depart du 60 m a la fin de la decelleration
  const yD = -RS - (NC_DROITE / 2) * CW_DROITE, x0D = -59, x1D = 15;
  for (let k = 0; k < NC_DROITE; k++) {
    const p = new THREE.PlaneGeometry(x1D - x0D, CW_DROITE);
    const uvp = p.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uvp.count; i++) uvp.setXY(i, uvp.getX(i) * (x1D - x0D), uvp.getY(i) * CW_DROITE);
    const m = ajouter(p, k % 2 ? anthracite : bleu);
    m.position.set((x0D + x1D) / 2, yD + (k + 0.5) * CW_DROITE, 0.004);
  }
  for (let k = 0; k <= NC_DROITE; k++) {
    const m = ajouter(new THREE.PlaneGeometry(x1D - x0D, 0.05), ligne, false);
    m.position.set((x0D + x1D) / 2, yD + k * CW_DROITE, 0.008);
  }
  // le depart et l'arrivee du 60 m (x = -55 et 5) : deux lignes blanches en travers
  for (const x of [-55, 5]) { const m = ajouter(new THREE.PlaneGeometry(0.05, NC_DROITE * CW_DROITE), ligne, false); m.position.set(x, yD + NC_DROITE * CW_DROITE / 2, 0.009); }
  // l'arrivee de l'anneau, en travers des six couloirs (x = 0)
  { const m = ajouter(new THREE.PlaneGeometry(0.05, W), ligne, false); m.position.set(0, -RS + W / 2, 0.012); }

  // LE SAUTOIR DE LONGUEUR ET LES TAPIS (le plateau, cote ligne opposee) — rouge et bleu, comme sur place
  const sable = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.78, 0.66, 0.46, THREE.SRGBColorSpace), roughness: 1 });
  { const m = ajouter(new THREE.BoxGeometry(9, 3, 0.06), sable); m.position.set(-34, -RS - 9.5, 0.03); }
  const tapisR = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.72, 0.12, 0.14, THREE.SRGBColorSpace), roughness: 0.7 });
  const tapisB = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.12, 0.28, 0.62, THREE.SRGBColorSpace), roughness: 0.7 });
  for (const [x, y, lx, ly, lz] of [[8, -RS - 11, 6, 5, 0.7], [-50, -RS + 9, 5, 4, 0.55]] as number[][]) {
    const b = ajouter(new THREE.BoxGeometry(lx, ly, lz * 0.3), tapisR); b.position.set(x, y, lz * 0.15); b.castShadow = true;
    const t = ajouter(new THREE.BoxGeometry(lx - 0.2, ly - 0.2, lz * 0.7), tapisB); t.position.set(x, y, lz * 0.3 + lz * 0.35); t.castShadow = true;
  }

  // AUTOUR DE L'ANNEAU : le muret blanc, le passage, puis le bandeau de bois qui porte la coursive
  const blanc = new THREE.MeshStandardMaterial({ map: mur(BLANC, 5), roughness: 0.9 });
  const hautMur = (f: number) => zEn(R_MUR, f) + 0.9;
  murDouble(murAnneau(R_MUR, () => 0, hautMur), blanc);
  const passage = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.55, 0.56, 0.58, THREE.SRGBColorSpace), roughness: 0.9 });
  ajouter(bandeAnneau(R_MUR, R_BOIS, 0), passage);
  const bois = lamesDeBois([168, 82, 46], true, 17); bois.repeat.set(1 / 1.5, 1 / 1.5);
  const matBois = new THREE.MeshStandardMaterial({ map: bois, roughness: 0.75 });
  murDouble(murAnneau(R_BOIS, () => 0, () => H_COURSIVE), matBois);
  // la coursive : un plancher de l'ovale aux murs de la halle, et sa lisse vitree
  {
    const forme = new THREE.Shape();
    forme.moveTo(-S - LONG, -RS - LARGE); forme.lineTo(LONG, -RS - LARGE); forme.lineTo(LONG, -RS + LARGE); forme.lineTo(-S - LONG, -RS + LARGE); forme.closePath();
    const trou = new THREE.Path(), a = tour(R_BOIS);
    a.slice(0, -1).forEach((p, i) => (i ? trou.lineTo(p.x, p.y) : trou.moveTo(p.x, p.y)));
    forme.holes.push(trou);
    const plancher = ajouter(new THREE.ShapeGeometry(forme, 4), new THREE.MeshStandardMaterial({ color: 0xc8c9cc, roughness: 0.9 }));
    plancher.position.z = H_COURSIVE;
    const dessous = ajouter(new THREE.ShapeGeometry(forme, 4), new THREE.MeshStandardMaterial({ color: 0x9a9ca0, roughness: 0.9, side: THREE.BackSide }), false);
    dessous.position.z = H_COURSIVE - 0.25;
  }
  const verre = new THREE.MeshStandardMaterial({ color: 0xcfe6f0, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false });
  ajouter(murAnneau(R_BOIS + 0.05, () => H_COURSIVE, () => H_COURSIVE + 1.05), verre, false);
  const lisseRail = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.4, metalness: 0.7 });
  ajouter(murAnneau(R_BOIS + 0.05, () => H_COURSIVE + 1.02, () => H_COURSIVE + 1.1), lisseRail, false);
  // LES GRADINS DU HAUT (« les gradins du dessus manquent cruellement de details », l'auteur, 26/10) :
  // sur place, la coursive porte deux rangs de sieges bleus derriere sa balustrade de verre a
  // poteaux d'acier ; le second rang monte d'une marche. Tout est instancie.
  {
    const Mx = new THREE.Matrix4(), q = new THREE.Quaternion(), un = new THREE.Vector3(1, 1, 1), Z = new THREE.Vector3(0, 0, 1);
    const poser = (lot: THREE.InstancedMesh, i: number, x: number, y: number, z: number, cap: number, sx = 1, sy = 1, sz = 1) => {
      q.setFromAxisAngle(Z, cap); Mx.compose(new THREE.Vector3(x, y, z), q, un.set(sx, sy, sz)); lot.setMatrixAt(i, Mx);
    };
    const a = tour(R_BOIS + 0.05);
    // les poteaux de la balustrade, tous les 1,5 m
    const poteaux = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 1.1), lisseRail, 400);
    let np = 0, reste = 0;
    for (let i = 1; i < a.length && np < 400; i++) {
      reste += Math.hypot(a[i].x - a[i - 1].x, a[i].y - a[i - 1].y);
      if (reste < 1.5) continue;
      reste = 0; poser(poteaux, np++, a[i].x, a[i].y, H_COURSIVE + 0.55, 0);
    }
    poteaux.count = np; g.add(poteaux);
    // la marche du second rang, en bois clair comme le reste de la coursive
    const marcheHaute = lamesDeBois([150, 120, 96], false, 41); marcheHaute.repeat.set(1 / 1.2, 1);
    ajouter(bandeAnneau(R_BOIS + 1.45, R_BOIS + 2.3, H_COURSIVE + 0.32), new THREE.MeshStandardMaterial({ map: marcheHaute, roughness: 0.8 }));
    ajouter(murAnneau(R_BOIS + 1.45, () => H_COURSIVE, () => H_COURSIVE + 0.32), new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.9, side: THREE.DoubleSide }));
    // les sieges : une coque bleue (assise + dossier), deux rangs, tous les 0,5 m
    const assise = new THREE.BoxGeometry(0.44, 0.42, 0.06), dossier = new THREE.BoxGeometry(0.44, 0.06, 0.4);
    const bleu = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.10, 0.36, 0.78, THREE.SRGBColorSpace), roughness: 0.5 });
    const lotA = new THREE.InstancedMesh(assise, bleu, 1400), lotD = new THREE.InstancedMesh(dossier, bleu, 1400);
    let ns = 0;
    for (const [r, z] of [[R_BOIS + 0.95, H_COURSIVE + 0.45], [R_BOIS + 1.85, H_COURSIVE + 0.77]] as const) {
      const b = tour(r);
      let l = 0;
      for (let i = 1; i < b.length && ns < 1400; i++) {
        const dx = b[i].x - b[i - 1].x, dy = b[i].y - b[i - 1].y;
        l += Math.hypot(dx, dy);
        if (l < 0.5) continue;
        l = 0;
        const cap = Math.atan2(dy, dx);                       // le long du tour ; la piste a droite
        const ox = Math.sin(cap) * 0.2, oy = -Math.cos(cap) * 0.2;   // le dossier, cote exterieur
        poser(lotA, ns, b[i].x, b[i].y, z, cap);
        poser(lotD, ns, b[i].x - ox, b[i].y - oy, z + 0.2, cap);
        sieges3.push({ x: b[i].x, y: b[i].y, z: z - 0.4, face: cap - Math.PI / 2 });
        ns++;
      }
    }
    lotA.count = ns; lotD.count = ns; g.add(lotA, lotD);
  }

  // LA TRIBUNE BLEUE, le long de la ligne d'arrivee : des gradins entre le muret et la coursive
  const marche = new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.85 });
  const siege = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.10, 0.36, 0.78, THREE.SRGBColorSpace), roughness: 0.55 });
  const RANGS = 6, PROF = (R_BOIS - R_MUR - 0.2) / RANGS, MONTE = (H_COURSIVE - 0.9) / RANGS;
  const nSieges = Math.floor((S - 6) / 0.5);
  const geoSiege = new THREE.BoxGeometry(0.42, 0.4, 0.38);
  const sieges = new THREE.InstancedMesh(geoSiege, siege, RANGS * nSieges);
  const M = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < RANGS; i++) {
    const y = -RS + R_MUR + 0.2 + (i + 0.5) * PROF, z = 0.9 + (i + 1) * MONTE;
    const gr = ajouter(new THREE.BoxGeometry(S - 4, PROF, z), marche); gr.position.set(-S / 2, y, z / 2);
    for (let j = 0; j < nSieges; j++) { M.makeTranslation(-S + 3 + j * 0.5, y + 0.05, z + 0.2); sieges.setMatrixAt(n++, M); }
  }
  sieges.count = n; sieges.castShadow = false; sieges.receiveShadow = true; g.add(sieges);

  // LES MURS DE LA HALLE, ses longs bandeaux vitres, et le plafond de bois sur des fermes d'acier
  const L = S + 2 * LONG, X0 = -S - LONG, X1 = LONG, Y0 = -RS - LARGE, Y1 = -RS + LARGE;
  const blancHaut = new THREE.MeshStandardMaterial({ map: mur([236, 238, 240], 9), roughness: 0.95 });
  const ciel = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0xcfe6ff, emissiveIntensity: 0.9, roughness: 0.1 });
  const montant = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.6 });
  const pan = (lx: number, ly: number, x: number, y: number, z0: number, z1: number, mat: THREE.Material) => {
    const b = ajouter(new THREE.BoxGeometry(lx, ly, z1 - z0), mat); b.position.set(x, y, (z0 + z1) / 2); return b;
  };
  // LES PAROIS N'ONT QU'UNE FACE, TOURNEE VERS L'INTERIEUR (comme au Palais) : le plan de
  // camera venu du 2D filme de loin et de haut, depuis dehors, et doit voir a travers.
  const paroi = (x: number, y: number, z0: number, z1: number, long: number, normale: 'x+' | 'x-' | 'y+' | 'y-', mat: THREE.Material) => {
    const m = ajouter(new THREE.PlaneGeometry(normale[0] === 'y' ? long : z1 - z0, normale[0] === 'y' ? z1 - z0 : long), mat, false);
    m.position.set(x, y, (z0 + z1) / 2);
    if (normale === 'y-') m.rotation.x = Math.PI / 2; else if (normale === 'y+') m.rotation.x = -Math.PI / 2;
    else if (normale === 'x-') m.rotation.y = -Math.PI / 2; else m.rotation.y = Math.PI / 2;
    return m;
  };
  // les grands murs : pleins jusqu'a 6 m, vitres de 6 a 10,5 m (montants tous les 4,5 m), pleins au-dessus
  for (const [y, n] of [[Y0, 'y+'], [Y1, 'y-']] as const) {
    paroi(-S / 2, y, H_COURSIVE, 6, L, n, blancHaut);
    paroi(-S / 2, y, 10.5, H_TOIT, L, n, blancHaut);
    paroi(-S / 2, y, 6, 10.5, L, n, ciel);
    const d = n === 'y+' ? 0.12 : -0.12;
    for (let x = X0; x <= X1; x += 4.5) pan(0.25, 0.2, x, y + d, 6, 10.5, montant);
    pan(L, 0.2, -S / 2, y + d, 8.2, 8.35, montant);
  }
  for (const [x, n] of [[X0, 'x+'], [X1, 'x-']] as const) {
    paroi(x, -RS, H_COURSIVE, 7, 2 * LARGE, n, blancHaut);
    paroi(x, -RS, 10, H_TOIT, 2 * LARGE, n, blancHaut);
    paroi(x, -RS, 7, 10, 2 * LARGE, n, ciel);
    const d = n === 'x+' ? 0.12 : -0.12;
    for (let y = Y0; y <= Y1; y += 4.5) pan(0.2, 0.25, x + d, y, 7, 10, montant);
  }
  // le plafond de bois clair, en lames dans la longueur
  const plafondBois = lamesDeBois([196, 126, 70], false, 29); plafondBois.repeat.set(L / 3, 2 * LARGE / 3);
  // (une face, vers le bas : vu d'au-dessus, on voit a travers)
  const toit = new THREE.Group(); g.add(toit);
  const plafond = new THREE.Mesh(new THREE.PlaneGeometry(L, 2 * LARGE), new THREE.MeshStandardMaterial({ map: plafondBois, roughness: 0.8 }));
  plafond.position.set(-S / 2, -RS, H_TOIT); plafond.rotation.x = Math.PI; toit.add(plafond);
  // les fermes d'acier, en travers, tous les 7,5 m : membrures haute et basse, montants en zigzag
  const acier = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.45, metalness: 0.7 });
  const geoBarre = new THREE.BoxGeometry(1, 1, 1);
  const barres = new THREE.InstancedMesh(geoBarre, acier, 4000);
  let nb = 0;
  const barre = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, e: number) => {
    const d = new THREE.Vector3(bx - ax, by - ay, bz - az), l = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().normalize());
    M.compose(new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), q, new THREE.Vector3(e, e, l));
    barres.setMatrixAt(nb++, M);
  };
  for (let x = X0 + 3.75; x < X1; x += 7.5) {
    barre(x, Y0, H_TOIT - 0.15, x, Y1, H_TOIT - 0.15, 0.28);
    barre(x, Y0 + 1, H_TOIT - 2.1, x, Y1 - 1, H_TOIT - 2.1, 0.22);
    for (let y = Y0 + 1, i = 0; y < Y1 - 1; y += 2.4, i++) barre(x, y, i % 2 ? H_TOIT - 0.15 : H_TOIT - 2.1, x, y + 2.4, i % 2 ? H_TOIT - 2.1 : H_TOIT - 0.15, 0.1);
  }
  // les pannes, dans la longueur
  for (let y = Y0 + 4; y < Y1; y += 6) barre(X0, y, H_TOIT - 0.35, X1, y, H_TOIT - 0.35, 0.16);
  barres.count = nb; toit.add(barres);
  // les plafonniers : des disques qui brillent sous les fermes
  const lampe = new THREE.MeshBasicMaterial({ color: 0xfffbf0 });
  const lampes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 16), lampe, 200);
  let nl = 0;
  for (let x = X0 + 7.5; x < X1; x += 7.5) for (let y = Y0 + 6; y < Y1 - 3; y += 8) { M.makeRotationX(Math.PI / 2).setPosition(x, y, H_TOIT - 2.3); lampes.setMatrixAt(nl++, M); }
  lampes.count = nl; toit.add(lampes);

  // LES BANDEROLES BLEU CIEL de la ville, accrochees a la lisse de la coursive (le nom de la ville, aucune marque)
  const banderole = toile(1024, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#5ec2e6'); gr.addColorStop(1, '#2f8fd0');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.font = '900 120px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('VAL-DE-REUIL', w / 2, h / 2 + 6);
  });
  const matBand = new THREE.MeshStandardMaterial({ map: banderole, roughness: 0.7, side: THREE.DoubleSide });
  for (const x of [-S + 6, -S / 2, -6]) for (const y of [-RS - R_BOIS - 0.08]) {
    const m = ajouter(new THREE.PlaneGeometry(5, 1.25), matBand, false);
    m.position.set(x, y, H_COURSIVE - 0.75); m.rotation.x = -Math.PI / 2;
  }
  // un grand drapeau bleu ciel sous le toit, comme sur place
  { const m = ajouter(new THREE.PlaneGeometry(2.2, 3.4), matBand, false); m.position.set(-S / 2, Y1 - 0.6, H_TOIT - 4); m.rotation.x = Math.PI / 2; }

  // L'EXTERIEUR (Tripo, d'apres la vue aerienne du ministere des Sports ; tools/blender/salle/exterieur_tripo.py) :
  // le batiment vu de dehors, au seul survol d'avant-course — il cacherait la piste a tout autre plan
  const dehors = new THREE.Group(); dehors.visible = false; dehors.position.set(-S / 2, -RS, 0); ctx.stade.add(dehors);
  // autour du batiment : la pelouse du parc des sports et le parvis
  { const p = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.36, 0.52, 0.27, THREE.SRGBColorSpace), roughness: 1 }));
    p.position.z = -0.05; dehors.add(p);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(L + 16, 2 * LARGE + 16), new THREE.MeshStandardMaterial({ color: 0xb8b4ac, roughness: 0.95 }));
    v.position.z = -0.02; dehors.add(v); }
  const chargeur = new GLTFLoader(); chargeur.setMeshoptDecoder(MeshoptDecoder);
  chargeur.load(ctx.base + 'modeles/salle/exterieur.glb', gl => {
    // le bardage est d'aluminium argent : la texture Tripo, prise sur une photo au soleil couchant, tire au beige
    gl.scene.traverse((o: any) => { if (o.isMesh) { o.receiveShadow = false; o.castShadow = false; if (o.material?.color) o.material.color.setRGB(0.86, 0.9, 0.96); } });
    dehors.add(gl.scene);
  }, undefined, () => { /* sans exterieur : le survol montre l'interieur */ });
  return {
    /** L'interieur (la foule s'y range aussi : cachee avec lui quand on survole dehors). */
    interieur: g,
    animer: (_t: number) => { /* rien ne bouge encore */ },
    /**
     * Ou est la camera (repere du stade) : la charpente se cache au-dessus du toit (le plan venu
     * du 2D) ; l'exterieur ne se montre qu'au survol, la camera hors de la halle.
     */
    camera: (x: number, y: number, z: number, survol: boolean) => {
      toit.visible = z < H_TOIT - 0.3;
      const dedans = x > X0 - 0.5 && x < X1 + 0.5 && y > Y0 - 0.5 && y < Y1 + 0.5 && z < H_TOIT + 1.5;
      dehors.visible = survol && !dedans;
      g.visible = !dehors.visible;
    },
  };
}

/**
 * LE PUBLIC DE LA SALLE : assis dans la tribune bleue (face a la piste), debout le long de la
 * lisse vitree de la coursive (tourne vers l'anneau). Comme au stade, il se remplit par le bas
 * et selon l'affluence (fouleDe) ; la coursive, elle, se garnit par endroits.
 */
export function placesDuPublic(affluence: number, hasard: () => number): { x: number; y: number; z: number; face: number; debout: boolean }[] {
  const places: { x: number; y: number; z: number; face: number; debout: boolean }[] = [];
  const RANGS = 6, PROF = (R_BOIS - R_MUR - 0.2) / RANGS, MONTE = (H_COURSIVE - 0.9) / RANGS;
  for (let i = 0; i < RANGS; i++) {
    const y = -RS + R_MUR + 0.2 + (i + 0.5) * PROF, z = 0.9 + (i + 1) * MONTE;
    const occupe = 0.95 * Math.min(1, Math.max(0.05, affluence * 1.6 - (i / RANGS) * 1.6 * (1 - affluence)));
    for (let x = -S + 3; x < -3; x += 0.5) if (hasard() < occupe) places.push({ x, y: y + 0.1, z, face: -Math.PI / 2, debout: false });
  }
  // les sieges de la coursive (construireSalle les a poses) : assis, la piste en face
  for (const p of sieges3) if (hasard() < 0.08 + 0.55 * affluence) places.push({ x: p.x, y: p.y, z: p.z, face: p.face, debout: false });
  // la coursive : tous les 0,7 m le long de la lisse, plus ou moins garnie
  const a = tour(R_BOIS + 0.55);
  let reste = 0;
  for (let i = 1; i < a.length; i++) {
    const dx = a[i].x - a[i - 1].x, dy = a[i].y - a[i - 1].y, l = Math.hypot(dx, dy);
    reste += l;
    if (reste < 0.7) continue;
    reste = 0;
    // pas au-dessus de la tribune (elle a deja son monde), et un peu plus dans les virages
    const p = a[i];
    if (p.y > -RS && p.x > -S && p.x < 0) continue;
    if (hasard() > 0.05 + 0.2 * affluence) continue;
    // tourne vers l'interieur : la normale au tour (sens horaire : l'interieur a droite)
    const face = Math.atan2(-dx, dy);
    places.push({ x: p.x + (hasard() - 0.5) * 0.3, y: p.y, z: H_COURSIVE, face, debout: true });
  }
  return places;
}

/** Les lumieres de la salle : un jour d'hiver par les vitres, les plafonniers, aucune ombre dure. */
export const SALLE_LUMIERE = { fond: 0xdde4ec, brume: 0xd4dce6, hemiCiel: 0xf4f7ff, hemiSol: 0x8a8478, hemi: 1.55, soleil: 1.25, soleilCouleur: 0xfff6ea };
