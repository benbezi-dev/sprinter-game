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
// LE RELEVEMENT S'INSTALLE EN DOUCEUR (« la montee dans le virage manque de douceur, c'est trop
// sec », l'auteur, 26/10) : il commence 20 m avant le virage, y arrive a 55 %, et ne devient plein
// qu'au premier quart du virage ; la meme chose en sortie. Courbes a derivee nulle aux deux bouts.
const TRANS = 20, PART_DROITE = 0.55, ENTREE = Math.PI / 4;
const R_MUR = RS + W + 0.35;                          // le muret blanc au bord de l'anneau
const R_BOIS = R_MUR + 2.2;                           // le bandeau de bois, sous la coursive
const H_COURSIVE = 3.4;
const LONG = 29, LARGE = 29;                          // la halle : 29 m au-dela des centres des virages, de chaque cote
const H_TOIT = 12.5;
const CW_DROITE = 1.22, NC_DROITE = 8;                // la ligne droite centrale

const lisse = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * t * (t * (t * 6 - 15) + 10); };

/** Le relevement (0 a 1) en un point du stade : nul au milieu des lignes droites, plein au coeur des virages. */
function releve(x: number, y: number) {
  if (x > 0 || x < -S) {
    // l'angle tourne depuis l'entree du virage (0 a pi), et la distance a son bout le plus proche
    const c = x > 0 ? 0 : -S, phi = Math.atan2(Math.abs(x - c), y + RS), e = Math.min(phi, Math.PI - phi);
    return PART_DROITE + (1 - PART_DROITE) * lisse(0, ENTREE, e);
  }
  const d = Math.min(-x, x + S);           // la distance au virage le plus proche, sur la ligne droite
  return PART_DROITE * (1 - lisse(0, TRANS, d));
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
  return Math.min(r, R_MUR) - RS > 0 ? (Math.min(r, R_MUR) - RS) * PENTE * releve(x, y) : 0;
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

/**
 * Le tour de l'anneau au rayon r : la suite des points (x, y) et du relevement, de l'arrivee a
 * l'arrivee. `partie` (0 a 3 : ligne d'arrivee, virage, ligne opposee, virage) n'en rend qu'un
 * quart, avec le premier point du suivant (la lumiere cuite range chaque quart a part).
 */
function tour(r: number, partie = -1): { x: number; y: number; f: number }[] {
  const parts: { x: number; y: number; f: number }[][] = [[], [], [], []];
  const pas = 0.5, seg = 128;
  const p = (k: number, x: number, y: number) => parts[k].push({ x, y, f: releve(x, y) });
  for (let x = -S; x < 0; x += pas) p(0, x, -RS + r);                                          // la ligne d'arrivee, vers +x
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI; p(1, r * Math.sin(a), -RS + r * Math.cos(a)); }
  for (let x = 0; x > -S; x -= pas) p(2, x, -RS - r);                                          // la ligne opposee, vers -x
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI; p(3, -S - r * Math.sin(a), -RS - r * Math.cos(a)); }
  if (partie >= 0) return [...parts[partie], parts[(partie + 1) % 4][0]];
  const pts = parts.flat();
  pts.push(pts[0]);
  return pts;
}
const zEn = (r: number, f: number) => Math.max(0, Math.min(r, R_MUR) - RS) * PENTE * f;

/** Une bande de l'anneau entre deux rayons, relevee, a dz au-dessus du revetement. Les UV en metres. */
function bandeAnneau(r0: number, r1: number, dz: number, partie = -1) {
  const a = tour(r0, partie), b = tour(r1, partie);
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
function murAnneau(r: number, z0: (f: number) => number, z1: (f: number) => number, partie = -1) {
  const a = tour(r, partie);
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
  // `lumiere` : la surface recoit la lumiere cuite dans Blender — 'sol' (vue de dessus) ou 'coque' (l'atlas)
  const ajouter = (geo: THREE.BufferGeometry, mat: THREE.Material, ombre = true, lumiere: '' | 'sol' | 'coque' = '') => {
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = ombre; g.add(m);
    if (lumiere) m.userData.lumiere = lumiere;
    return m;
  };
  /** Une bande ou un mur de l'ovale, en quatre quarts (chacun sa place dans l'atlas de lumiere). */
  const enQuarts = (fab: (k: number) => THREE.BufferGeometry, mat: THREE.Material, lumiere: 'sol' | 'coque') => {
    for (let k = 0; k < 4; k++) ajouter(fab(k), mat, true, lumiere);
  };
  // les murs qui suivent l'anneau se voient des deux cotes (la piste et la coursive)
  const double = (mat: THREE.Material) => { const m2 = (mat as THREE.MeshStandardMaterial).clone(); m2.side = THREE.DoubleSide; return m2; };
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
  const ps = ajouter(sol, plateau, true, 'sol');
  ps.position.set(-S / 2, -RS, -0.01);
  const uvSol = sol.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uvSol.count; i++) uvSol.setXY(i, uvSol.getX(i) * (S + 2 * LONG), uvSol.getY(i) * 2 * LARGE);

  // L'ANNEAU : six couloirs alternes, et une bande d'anthracite derriere le sixieme jusqu'au muret
  for (let k = 0; k < NC; k++) ajouter(bandeAnneau(RS + k * CW, RS + (k + 1) * CW, 0.004), k % 2 ? anthracite : bleu, true, 'sol');
  ajouter(bandeAnneau(RS + W, R_MUR, 0.004), anthracite, true, 'sol');
  for (let k = 0; k <= NC; k++) ajouter(bandeAnneau(RS + k * CW - 0.025, RS + k * CW + 0.025, 0.008), ligne, false, 'sol');
  // la corde : une lisse blanche en saillie au bord interieur
  ajouter(murAnneau(RS - 0.06, () => 0, () => 0.05), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }), false);

  // LA LIGNE DROITE CENTRALE : huit couloirs alternes, du depart du 60 m a la fin de la decelleration
  const yD = -RS - (NC_DROITE / 2) * CW_DROITE, x0D = -59, x1D = 15;
  for (let k = 0; k < NC_DROITE; k++) {
    const p = new THREE.PlaneGeometry(x1D - x0D, CW_DROITE);
    const uvp = p.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uvp.count; i++) uvp.setXY(i, uvp.getX(i) * (x1D - x0D), uvp.getY(i) * CW_DROITE);
    const m = ajouter(p, k % 2 ? anthracite : bleu, true, 'sol');
    m.position.set((x0D + x1D) / 2, yD + (k + 0.5) * CW_DROITE, 0.004);
  }
  for (let k = 0; k <= NC_DROITE; k++) {
    const m = ajouter(new THREE.PlaneGeometry(x1D - x0D, 0.05), ligne, false, 'sol');
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
  enQuarts(k => murAnneau(R_MUR, () => 0, hautMur, k), double(blanc), 'coque');
  const passage = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.55, 0.56, 0.58, THREE.SRGBColorSpace), roughness: 0.9 });
  ajouter(bandeAnneau(R_MUR, R_BOIS, 0), passage, true, 'sol');
  // (des planches HORIZONTALES, d'un bois chaud : la visite filmee de 2025)
  const bois = lamesDeBois([176, 98, 52], false, 17); bois.repeat.set(1 / 3, 1 / 1.6);
  const matBois = new THREE.MeshStandardMaterial({ map: bois, roughness: 0.75 });
  enQuarts(k => murAnneau(R_BOIS, () => 0, () => H_COURSIVE, k), double(matBois), 'coque');
  // la coursive : un plancher de l'ovale aux murs de la halle, et sa lisse vitree
  {
    const forme = new THREE.Shape();
    forme.moveTo(-S - LONG, -RS - LARGE); forme.lineTo(LONG, -RS - LARGE); forme.lineTo(LONG, -RS + LARGE); forme.lineTo(-S - LONG, -RS + LARGE); forme.closePath();
    const trou = new THREE.Path(), a = tour(R_BOIS);
    a.slice(0, -1).forEach((p, i) => (i ? trou.lineTo(p.x, p.y) : trou.moveTo(p.x, p.y)));
    forme.holes.push(trou);
    const plancher = ajouter(new THREE.ShapeGeometry(forme, 4), new THREE.MeshStandardMaterial({ color: 0xc8c9cc, roughness: 0.9 }), true, 'coque');
    plancher.position.z = H_COURSIVE;
    // le dessous, retourne pour de bon (pas une face arriere) : la cuisson le voit regarder vers le bas
    const geoDessous = new THREE.ShapeGeometry(forme, 4), id = geoDessous.getIndex()!;
    for (let i = 0; i < id.count; i += 3) { const t = id.getX(i + 1); id.setX(i + 1, id.getX(i + 2)); id.setX(i + 2, t); }
    geoDessous.computeVertexNormals();
    const dessous = ajouter(geoDessous, new THREE.MeshStandardMaterial({ color: 0x9a9ca0, roughness: 0.9 }), false, 'coque');
    dessous.position.z = H_COURSIVE - 0.25;
  }
  const verre = new THREE.MeshStandardMaterial({ color: 0xcfe6f0, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false });
  ajouter(murAnneau(R_BOIS + 0.05, () => H_COURSIVE, () => H_COURSIVE + 1.05), verre, false);
  const lisseRail = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.4, metalness: 0.7 });
  ajouter(murAnneau(R_BOIS + 0.05, () => H_COURSIVE + 1.02, () => H_COURSIVE + 1.1), lisseRail, false);
  // LES GRADINS DU HAUT (« les gradins du dessus manquent cruellement de details », l'auteur, 26/10) :
  // sur place, la coursive porte un rang de sieges bleus derriere sa balustrade de verre a
  // poteaux d'acier. Tout est instancie.
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
    // les sieges : une coque bleue (assise + dossier), deux rangs, tous les 0,5 m
    const assise = new THREE.BoxGeometry(0.44, 0.42, 0.06), dossier = new THREE.BoxGeometry(0.44, 0.06, 0.4);
    const bleu = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.10, 0.36, 0.78, THREE.SRGBColorSpace), roughness: 0.5 });
    const lotA = new THREE.InstancedMesh(assise, bleu, 1400), lotD = new THREE.InstancedMesh(dossier, bleu, 1400);
    let ns = 0;
    // UN SEUL RANG (« une seule ligne de chaises bleues, pas deux », l'auteur, 26/10), juste derriere la balustrade
    for (const [r, z] of [[R_BOIS + 0.95, H_COURSIVE + 0.45]] as const) {
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

  /** Une banderole bleu ciel au nom de la ville (le meme dessin partout ; aucune marque). */
  const matBandeVille = () => new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide, map: toile(512, 640, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6cc8ea'); gr.addColorStop(1, '#3a9ad6');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.font = '900 64px system-ui, sans-serif'; c.textAlign = 'center';
    c.fillText('VAL', w / 2, h * 0.42); c.fillText('DE REUIL', w / 2, h * 0.56);
    c.beginPath(); c.moveTo(w / 2 - 60, h * 0.66); c.lineTo(w / 2 + 60, h * 0.66); c.lineTo(w / 2, h * 0.8); c.closePath(); c.fill();
  }) });
  // LES MURS DE LA HALLE, ses facades, et le plafond de bois sur des fermes d'acier
  const L = S + 2 * LONG, X0 = -S - LONG, X1 = LONG, Y0 = -RS - LARGE, Y1 = -RS + LARGE;
  const ciel = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0xcfe6ff, emissiveIntensity: 0.9, roughness: 0.1 });
  ciel.name = 'vitrage';
  const montant = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.6 });
  const pan = (lx: number, ly: number, x: number, y: number, z0: number, z1: number, mat: THREE.Material) => {
    const b = ajouter(new THREE.BoxGeometry(lx, ly, z1 - z0), mat); b.position.set(x, y, (z0 + z1) / 2); return b;
  };
  // LES PAROIS N'ONT QU'UNE FACE, TOURNEE VERS L'INTERIEUR (comme au Palais) : le plan de
  // camera venu du 2D filme de loin et de haut, depuis dehors, et doit voir a travers.
  const paroi = (x: number, y: number, z0: number, z1: number, long: number, normale: 'x+' | 'x-' | 'y+' | 'y-', mat: THREE.Material) => {
    // la longueur en u, la hauteur en v, le haut de l'image en haut (nervures horizontales, textes droits)
    const m = ajouter(new THREE.PlaneGeometry(long, z1 - z0), mat, false, mat === ciel ? '' : 'coque');
    m.position.set(x, y, (z0 + z1) / 2);
    // (une base posee a la main, pas lookAt : la salle est sous le miroir de `monde`)
    const n = new THREE.Vector3(normale === 'x+' ? 1 : normale === 'x-' ? -1 : 0, normale === 'y+' ? 1 : normale === 'y-' ? -1 : 0, 0);
    const haut = new THREE.Vector3(0, 0, 1), droite = new THREE.Vector3().crossVectors(haut, n);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(droite, haut, n));
    return m;
  };
  // LES FACADES (« les fenetres ne font pas toutes les facades, il y a des parties mur », l'auteur,
  // 26/10 ; la visite filmee de 2025) : un bardage d'acier gris clair a nervures horizontales, et
  // des vitrages par endroits seulement — un grand vitrage central face a la tribune, entre des
  // poteaux blancs, deux grandes banderoles bleu ciel suspendues devant ; au-dessus de la tribune,
  // deux groupes de fenetres ; une rangee de cinq fenetres sur un pignon ; sur l'autre, un groupe
  // de fenetres et deux grandes fresques sepia. Chaque vitrage est pose devant le bardage.
  const bardage = toile(256, 256, (c, w, hh) => {
    c.fillStyle = '#c9ccd1'; c.fillRect(0, 0, w, hh);
    for (let y = 0; y < hh; y += 16) {
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(0, y, w, 3);
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, y + 12, w, 4);
    }
  });
  bardage.repeat.set(1 / 4, 1 / 4);
  const matBardage = new THREE.MeshStandardMaterial({ map: bardage, roughness: 0.6, metalness: 0.2 });
  const poteauBlanc = new THREE.MeshStandardMaterial({ color: 0xf1f2f4, roughness: 0.5 });
  const sepia = (graine: number) => toile(512, 384, (c, w, hh) => {
    // une fresque de sport en sepia : des silhouettes d'athletes, sans personne de reel
    const h = tirage(graine);
    const gr = c.createLinearGradient(0, 0, w, hh); gr.addColorStop(0, '#a07a52'); gr.addColorStop(1, '#5e4028');
    c.fillStyle = gr; c.fillRect(0, 0, w, hh);
    for (let i = 0; i < 14; i++) {
      const x = h() * w, y = hh * (0.35 + h() * 0.4), k = 30 + h() * 50;
      c.fillStyle = `rgba(40,24,12,${0.35 + h() * 0.4})`;
      c.beginPath(); c.arc(x, y - k * 1.1, k * 0.18, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(x, y - k * 0.5, k * 0.2, k * 0.5, (h() - 0.5) * 0.6, 0, Math.PI * 2); c.fill();
      c.fillRect(x - k * 0.25, y, k * 0.12, k * 0.7); c.fillRect(x + k * 0.1, y - k * 0.05, k * 0.12, k * 0.6);
    }
    c.fillStyle = 'rgba(255,240,215,0.85)'; c.font = '700 34px Georgia, serif'; c.fillText('LE SPORT', 24, 52);
  });
  /** Une facade : le bardage plein, puis ses vitrages (fractions de la longueur, hauteurs), poteaux et meneaux. */
  const facade = (axe: 'x' | 'y', pos: number, n: 'x+' | 'x-' | 'y+' | 'y-', long: number,
                  vitrages: [number, number, number, number, number][]) => {
    const debut = axe === 'y' ? X0 : Y0, d = n === 'y+' || n === 'x+' ? 1 : -1;
    // le bardage
    paroi(axe === 'y' ? -S / 2 : pos, axe === 'y' ? pos : -RS, H_COURSIVE, H_TOIT, long, n, matBardage);
    for (const [a, b, z0, z1, pas] of vitrages) {
      const c = debut + (a + b) / 2 * long, l = (b - a) * long;
      const v = paroi(axe === 'y' ? c : pos, axe === 'y' ? pos : c, z0, z1, l, n, ciel);
      v.position[axe === 'y' ? 'y' : 'x'] += d * 0.04;
      // les meneaux (ou les poteaux blancs du grand vitrage) et les traverses
      const blanc = pas > 4;
      for (let t = debut + a * long; t <= debut + b * long + 1e-6; t += pas) {
        if (axe === 'y') pan(blanc ? 0.4 : 0.14, 0.2, t, pos + d * 0.12, z0, z1, blanc ? poteauBlanc : montant);
        else pan(0.2, blanc ? 0.4 : 0.14, pos + d * 0.12, t, z0, z1, blanc ? poteauBlanc : montant);
      }
      for (const z of [z0, z1, (z0 + z1) / 2]) {
        if (axe === 'y') pan(l, 0.16, c, pos + d * 0.1, z - 0.07, z + 0.07, montant);
        else pan(0.16, l, pos + d * 0.1, c, z - 0.07, z + 0.07, montant);
      }
    }
  };
  facade('y', Y0, 'y+', L, [[0.22, 0.78, 4.6, 10.8, 5.2]]);                 // face a la tribune : le grand vitrage
  facade('y', Y1, 'y-', L, [[0.12, 0.38, 7, 9.8, 3], [0.6, 0.86, 7, 9.8, 3]]); // au-dessus de la tribune
  facade('x', X0, 'x+', 2 * LARGE, [[0.08, 0.5, 7.2, 9.4, 4.2]]);           // un pignon : cinq fenetres
  facade('x', X1, 'x-', 2 * LARGE, [[0.1, 0.3, 6.5, 9.6, 2.9]]);            // l'autre : un groupe de fenetres...
  for (const [a, b, gr] of [[0.4, 0.62, 3], [0.67, 0.89, 7]] as const) {    // ... et deux fresques sepia
    const f = paroi(X1, Y0 + (a + b) / 2 * 2 * LARGE, 6.5, 9.7, (b - a) * 2 * LARGE, 'x-', new THREE.MeshStandardMaterial({ map: sepia(gr), roughness: 0.9 }));
    // (scale.x = -1 : le monde de la course est en miroir, voir les panneaux de course-3d.ts)
    f.position.x -= 0.05; f.scale.x = -1; delete f.userData.lumiere;
  }
  // les grandes banderoles bleu ciel suspendues devant le grand vitrage
  for (const a of [0.36, 0.62]) {
    const m = ajouter(new THREE.PlaneGeometry(5, 5.5), matBandeVille(), false);
    m.position.set(X0 + a * L, Y0 + 0.9, 7.6); m.rotation.x = -Math.PI / 2; m.scale.x = -1;
  }
  // le plafond de bois clair, en lames dans la longueur
  const plafondBois = lamesDeBois([196, 126, 70], false, 29); plafondBois.repeat.set(L / 3, 2 * LARGE / 3);
  // (une face, vers le bas : vu d'au-dessus, on voit a travers)
  const toit = new THREE.Group(); g.add(toit);
  const plafond = new THREE.Mesh(new THREE.PlaneGeometry(L, 2 * LARGE), new THREE.MeshStandardMaterial({ map: plafondBois, roughness: 0.8 }));
  plafond.position.set(-S / 2, -RS, H_TOIT); plafond.rotation.x = Math.PI; toit.add(plafond); plafond.userData.lumiere = 'coque';
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
  const lampe = new THREE.MeshBasicMaterial({ color: 0xfffbf0 }); lampe.name = 'plafonnier';
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
    m.position.set(x, y, H_COURSIVE - 0.75); m.rotation.x = -Math.PI / 2; m.scale.x = -1;
  }
  // un grand drapeau bleu ciel sous le toit, comme sur place
  { const m = ajouter(new THREE.PlaneGeometry(2.2, 3.4), matBand, false); m.position.set(-S / 2, Y1 - 0.6, H_TOIT - 4); m.rotation.x = Math.PI / 2; m.scale.x = -1; }

  // LA LUMIERE CUITE DANS BLENDER (tools/blender/salle/cuire_lumiere.py) : les plafonniers, les
  // grands vitrages, les rebonds et les ombres douces, cuits une fois pour toutes dans deux images.
  // Le jeu garde ses matieres de detail (le grain de la piste, le bois) et les multiplie par
  // cette lumiere. Les cartes ci-dessous sont DETERMINISTES : l'export pour Blender (?exporterSalle=1)
  // et le jeu les recalculent a l'identique.
  const cuites = cartesDeLumiere(g, { X0, Y0, L, LY: 2 * LARGE });
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('exporterSalle')) exporterPourBlender(g.clone());
  const charge = new THREE.TextureLoader();
  const appliquer = (fichier: string, liste: THREE.Mesh[], coque: boolean) => charge.load(ctx.base + 'modeles/salle/' + fichier, t => {
    // (flipY a faux, comme les textures glTF : a l'import, Blender retourne v ; notre v = 0 tombe en haut de l'image cuite)
    t.channel = 1; t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
    const deja = new Map<THREE.Material, THREE.Material>();
    for (const m of liste) {
      const ancien = m.material as THREE.MeshStandardMaterial;
      let neuf = deja.get(ancien);
      if (!neuf) {
        // la coque n'a plus besoin des lumieres du jeu : sa lumiere est cuite (MeshBasic : albedo x lumiere / pi)
        neuf = coque
          ? new THREE.MeshBasicMaterial({ map: ancien.map, color: ancien.color, side: ancien.side, lightMap: t, lightMapIntensity: LUMIERE_COQUE })
          : Object.assign(ancien.clone(), { lightMap: t, lightMapIntensity: LUMIERE_SOL });
        deja.set(ancien, neuf);
      }
      m.material = neuf;
    }
  }, undefined, () => { /* sans lumiere cuite : la salle eclairee par le jeu */ });
  appliquer('lumiere-coque.jpg', cuites.coque, true);
  appliquer('lumiere-sol.jpg', cuites.sol, false);

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

/** Les intensites des lumieres cuites (les images sont gardees en dessous de 1 : voir cuire_lumiere.py, EXPO). */
const LUMIERE_COQUE = Math.PI * 1.05, LUMIERE_SOL = 0.85;
export const ATLAS = 2048;

/**
 * Les cartes de lumiere (uv1) : le sol et la piste vus de dessus, dans le rectangle de la halle ;
 * la coque rangee dans un atlas de ATLAS px (chaque surface a sa place, a la meme densite,
 * rangees en etageres par hauteur decroissante, la plus forte densite qui tienne).
 */
function cartesDeLumiere(g: THREE.Group, h: { X0: number; Y0: number; L: number; LY: number }) {
  g.traverse(o => o.updateMatrix());
  const versG = (o: THREE.Object3D) => { const m = new THREE.Matrix4(); for (let p: THREE.Object3D | null = o; p && p !== g; p = p.parent) m.premultiply(p.matrix); return m; };
  const sol: THREE.Mesh[] = [], coque: THREE.Mesh[] = [];
  g.traverse((o: any) => { if (o.isMesh && o.userData.lumiere === 'sol') sol.push(o); else if (o.isMesh && o.userData.lumiere === 'coque') coque.push(o); });
  const v = new THREE.Vector3();
  for (const m of sol) {
    const pos = m.geometry.getAttribute('position'), M = versG(m), uv1 = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(M); uv1[i * 2] = (v.x - h.X0) / h.L; uv1[i * 2 + 1] = (v.y - h.Y0) / h.LY; }
    m.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  }
  // la coque : les UV de chaque surface en metres, sa boite, puis le rangement
  const brut = coque.map(m => {
    const geo = m.geometry as any, uv = geo.getAttribute('uv'), sx = geo.parameters?.width ?? 1, sy = geo.parameters?.height ?? 1;
    const plan = geo.type === 'PlaneGeometry';
    const u = new Float32Array(uv.count * 2);
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    for (let i = 0; i < uv.count; i++) {
      const a = uv.getX(i) * (plan ? sx : 1), b = uv.getY(i) * (plan ? sy : 1);
      u[i * 2] = a; u[i * 2 + 1] = b;
      u0 = Math.min(u0, a); u1 = Math.max(u1, a); v0 = Math.min(v0, b); v1 = Math.max(v1, b);
    }
    return { m, u, u0, v0, w: u1 - u0, h: v1 - v0 };
  });
  const ordre = brut.map((_, i) => i).sort((a, b) => brut[b].h - brut[a].h || a - b);
  const MARGE = 6;
  const ranger = (k: number) => {
    const places: { x: number; y: number }[] = [];
    let x = MARGE, y = MARGE, haut = 0;
    for (const i of ordre) {
      const w = Math.ceil(brut[i].w * k), hh = Math.ceil(brut[i].h * k);
      if (w + 2 * MARGE > ATLAS) return null;
      if (x + w + MARGE > ATLAS) { x = MARGE; y += haut + MARGE; haut = 0; }
      places[i] = { x, y }; x += w + MARGE; haut = Math.max(haut, hh);
    }
    return y + haut + MARGE <= ATLAS ? places : null;
  };
  let k = 40, places = ranger(k);
  while (!places && k > 1) { k *= 0.96; places = ranger(k); }
  brut.forEach((b, i) => {
    const uv1 = new Float32Array(b.u.length), P = places![i];
    for (let j = 0; j < b.u.length; j += 2) { uv1[j] = (P.x + (b.u[j] - b.u0) * k) / ATLAS; uv1[j + 1] = (P.y + (b.u[j + 1] - b.v0) * k) / ATLAS; }
    b.m.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  });
  return { sol, coque, densite: k };
}

/** L'export pour Blender (?exporterSalle=1) : la salle telle que le jeu la construit, ses cartes de lumiere comprises. */
function exporterPourBlender(g: THREE.Object3D) {
  import('three/examples/jsm/exporters/GLTFExporter.js').then(({ GLTFExporter }) => {
    new GLTFExporter().parse(g, (glb: any) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
      a.download = 'salle-source.glb'; a.click();
    }, (e: any) => console.error('export salle', e), { binary: true, onlyVisible: false });
  });
}

/** Les lumieres de la salle : un jour d'hiver par les vitres, les plafonniers, aucune ombre dure. */
export const SALLE_LUMIERE = { fond: 0xdde4ec, brume: 0xd4dce6, hemiCiel: 0xf4f7ff, hemiSol: 0x8a8478, hemi: 1.55, soleil: 1.25, soleilCouleur: 0xfff6ea };
