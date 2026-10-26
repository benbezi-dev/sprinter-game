// LE STADE COUVERT JESSE OWENS DE VAL-DE-REUIL, EN 3D (26/10/2026).
//
// L'auteur : « cree cette piste dans la version 3D », « il faut que l'interieur de la salle
// soit reconnaissable directement », « texture et realisme de la piste et de la salle ».
// Releve d'apres les plans de la ville (assets-sources/piste-couverte-val-de-reuil/
// references/plans), la visite filmee de janvier 2025 (apres la renovation de la piste de
// 2024 : couloirs alternes bleu roi et anthracite, plateau gris clair) et les replays des
// France U18-U20 de fevrier 2026 :
//  - l'anneau de 200 m, virages releves a 15°, six couloirs (piste-salle.js, les memes cotes
//    que le moteur) ; la ligne droite centrale a six couloirs, d'un bord de l'anneau a l'autre ;
//  - autour de l'anneau, un muret blanc puis des gradins de bois sous la coursive vitree,
//    des sieges bleus le long de la ligne d'arrivee ; muret et coursive s'ecartent dans les virages ;
//  - au milieu, les aires du plan (img-010) : perche, longueur et triple, hauteur, poids ;
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

export const RS = SALLE.rayon;                       // la demi-largeur interieure (17,20 m)
const S = DROITE;                                     // la ligne droite de l'anneau (35 m)
const A = SALLE.demiLong;                             // la demi-longueur des virages allonges (23,53 m)
/** Du repere du stade au repere neutre d'un virage (piste-salle.js) : il bombe vers +X. */
const versVirage = (x: number, y: number) => (x > 0 ? [x, y + RS] : [-S - x, -(y + RS)]);
const NC = SALLE.couloirs, CW = SALLE.couloir;        // six couloirs de 0,90 m
const W = NC * CW;
// LA PENTE SE RAIDIT VERS L'EXTERIEUR (« les couloirs du dessus ont un pourcentage de montee et
// descente de plus en plus fort », l'auteur, 26/10) : 10° au bord interieur, 18° au bord du
// sixieme couloir (15° en moyenne sur les couloirs exterieurs), puis 18° jusqu'au muret. Les
// couloirs du dessus montent donc plus haut, et plus raide, sur les memes rampes d'entree.
// shortcut: angles a caler sur les cotes reelles quand on les aura (la recherche est en cours).
const ALPHA0 = 10 * Math.PI / 180, ALPHA1 = 18 * Math.PI / 180;
/** La hauteur du revetement plein-releve a d metres du bord interieur (la pente tourne de ALPHA0 a ALPHA1). */
function profil(d: number) {
  if (d <= 0) return 0;
  const k = (ALPHA1 - ALPHA0) / W, dd = Math.min(d, W);
  // (pente constante : k nul, la formule se reduit a d x tan)
  const plein = Math.abs(k) < 1e-9 ? dd * Math.tan(ALPHA0) : (Math.log(Math.cos(ALPHA0)) - Math.log(Math.cos(ALPHA0 + k * dd))) / k;
  return plein + Math.max(0, d - W) * Math.tan(ALPHA1);
}
// LE RELEVEMENT EST DANS LE VIRAGE SEUL (« le muret blanc et la piste ne sont pas deformes mais
// droits », l'auteur, 26/10) : les lignes droites sont plates ; il monte en douceur sur le premier
// tiers du virage (« trop sec », 26/10 : courbe a derivee nulle aux deux bouts), redescend sur le dernier.
const RAMPE = Math.PI / 3, ENTREE = Math.PI / 4;   // (ENTREE : l'evasement de la coursive)
// LE BORD DE L'ANNEAU : le muret blanc contre le sixieme couloir (« il n'y a pas de bande grise
// apres le couloir 6 dans la salle », l'auteur, 26/10) ; le bord de la coursive a 1,90 m (le plan),
// 1,15 m plus loin au coeur des virages.
const R_MUR = RS + W + 0.05;                          // le muret blanc
const R_BOIS = RS + W + 1.9;                          // le bord de la coursive, au-dessus des gradins de bois
const EV = 1.15;                                      // l'evasement de la coursive dans les virages
const H_COURSIVE = 5.0;                               // (la visite de 2025 : au niveau du haut de la tribune)
const R_G = R_MUR + 0.15;                             // le passage derriere le muret commence la
// la halle (le plan) : ses pignons a 8,75 m du bord interieur au bout des virages ; le long cote
// oppose a 29 m de l'axe, celui de la tribune a 35 m (le plan : ses gradins vont jusque-la)
// (au moins 0,3 m de coursive au bout des virages : sinon son plancher deborde du pignon)
const LONG = A + Math.max(8.75, W + 1.9 + 1.15 + 0.3), LARGE = 29, LARGE_T = 35;
const LY = LARGE + LARGE_T, YC = -RS + (LARGE_T - LARGE) / 2;     // la largeur de la halle, son milieu
// LA TRIBUNE, cote ligne d'arrivee (les France 2026, la photo Wikimedia ; « les gradins cote ligne
// droite d'arrivee », l'auteur, 26/10) : derriere le muret, un passage, un podium a 1,10 m et sa
// rambarde vitree, puis dix rangs de beton gris de 0,80 m sur 0,40 m, aux sieges bleu ciel.
const R_T = R_MUR + 1.2, N_T = 10, P_T = 0.8, Z_T = 1.1, M_T = 0.4;
const H_TOIT = 12.5;
const CW_DROITE = 1.22, NC_DROITE = SALLE.couloirsDroite; // la ligne droite centrale
const W60 = NC_DROITE * CW_DROITE;
// les lignes peintes a 8 cm, comme dans tout le jeu en 3D (plus fines, elles se crenelaient au loin ; l auteur, 24/10)
const LIGNE = 0.08;

const lisse = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * t * (t * (t * 6 - 15) + 10); };

/** Le relevement (0 a 1) en un point du stade : nul en ligne droite, plein au coeur des virages. */
function releve(x: number, y: number) {
  if (x > 0 || x < -S) {
    // l'angle du virage (0 a pi), et sa distance au bout le plus proche
    const [X, Y] = versVirage(x, y), phi = SALLE.surVirage(X, Y).phi, e = Math.min(phi, Math.PI - phi);
    return lisse(0, RAMPE, e);
  }
  return 0;
}
/** RS + l'ecart au bord interieur (dans un virage), ou la distance a l'axe (en ligne droite). */
function rayonEn(x: number, y: number) {
  if (x > 0 || x < -S) { const [X, Y] = versVirage(x, y); return RS + SALLE.surVirage(X, Y).d; }
  return Math.abs(y + RS);
}
// LA ZONE DE FREINAGE DU 60 M (« le tapis commence en bas de la zone grise ; cette zone permet de
// freiner, sinon les sprinters se prennent le mur », l'auteur, 26/10) : dans l'axe de la ligne droite
// centrale, au bout du virage qui suit l'arrivee, pas de muret ; la piste se prolonge, a plat, en
// gris, jusqu'au tapis.
const DEMI_FREIN = 5.6;
const dansFreinage = (p: { x: number; y: number }) => p.x > 0 && Math.abs(p.y + RS) <= DEMI_FREIN;
const horsFreinage = (p: { x: number; y: number }) => !dansFreinage(p);
/** Ce point du tour longe-t-il la tribune (la ligne d'arrivee, hors virages) ? */
const surTribune = (p: { x: number; y: number }) => p.y > -RS && p.x >= -S - 1e-6 && p.x <= 1e-6;
/**
 * LA CAMERA RESTE AU BORD DE LA PISTE : au-dela du muret, elle tomberait dans les gradins et
 * les sieges de la coursive. Ramene (x, y) a moins de `marge` metres du muret, vers l'axe.
 */
export function auBordDeLaPiste(x: number, y: number, marge = 0.3): [number, number] {
  const lim = R_MUR - RS - marge;
  if (x > 0 || x < -S) {
    const [X, Y] = versVirage(x, y), v = SALLE.surVirage(X, Y);
    if (v.d <= lim) return [x, y];
    const q = SALLE.virage(v.phi, lim);
    return x > 0 ? [q[0], q[1] - RS] : [-S - q[0], -RS - q[1]];
  }
  const e = y + RS;
  return Math.abs(e) <= RS + lim ? [x, y] : [x, -RS + Math.sign(e) * (RS + lim)];
}
/** La hauteur du sol en un point du stade : l'anneau relevé, le plateau a zero. */
export function zSol(x: number, y: number) {
  const r = rayonEn(x, y);
  if (r <= RS) return 0;
  return profil(Math.min(r, R_MUR) - RS) * releve(x, y);
}

// LE 60 M (la visite de 2025, image 0661) : il court vers le virage qui suit l'arrivee de l'anneau,
// celui de la perche, du sautoir et des fresques, ou un grand tapis l'attend derriere le dernier
// couloir ; son arrivee a 3,6 m du bord de l'anneau. On y court vers +x, comme sur l'anneau.
const DEPART_60 = -S - 5.07, ARRIVEE_60 = DEPART_60 + 60;
/**
 * Du repere du jeu a celui de la salle (voir caler, course-3d.ts). L'anneau : le jeu met
 * son premier virage autour de l'origine et finit sur y = -r en allant vers -x ; on le
 * retourne. Le 60 m : la ligne droite centrale, dans le sens du jeu.
 */
export function calageSalle(T: any): { sx: number; x0: number; y0: number } {
  if (T.salle) return { sx: -1, x0: 0, y0: -RS };
  return { sx: 1, x0: DEPART_60, y0: -RS - (NC_DROITE / 2) * CW_DROITE };
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

/** Le sable des bacs : grains clairs et sombres, quelques traces de rateau. */
function grainDeSable() {
  const h = tirage(41);
  const t = toile(256, 256, (c, w, hh) => {
    c.fillStyle = '#c9b38a'; c.fillRect(0, 0, w, hh);
    for (let i = 0; i < 9000; i++) { const k = h(); c.fillStyle = k < 0.5 ? `rgba(120,95,60,${0.25 * h()})` : `rgba(245,232,205,${0.3 * h()})`; c.fillRect(h() * w, h() * hh, 1 + h() * 2, 1 + h() * 2); }
    c.strokeStyle = 'rgba(110,88,55,0.18)'; c.lineWidth = 2;
    for (let y = 8; y < hh; y += 14) { c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= w; x += 16) c.lineTo(x, y + Math.sin(x / 30 + y) * 2); c.stroke(); }
  });
  t.repeat.set(2, 1);
  return t;
}

/* ------------------------------------------------------------------ la geometrie */

/**
 * Le tour de l'anneau au rayon r : la suite des points (x, y) et du relevement, de l'arrivee a
 * l'arrivee. `partie` (0 a 3 : ligne d'arrivee, virage, ligne opposee, virage) n'en rend qu'un
 * quart, avec le premier point du suivant (la lumiere cuite range chaque quart a part).
 */
type PointTour = { x: number; y: number; f: number; r: number; g: number };
function tour(r: number, partie = -1, ev = 0): PointTour[] {
  const parts: PointTour[][] = [[], [], [], []];
  const pas = 0.5, seg = 128;
  // g : l'evasement (0 en ligne droite, 1 des le premier quart du virage) ; le rayon s'ecarte de ev * g
  const p = (k: number, x: number, y: number, rr = r, g = 0) => parts[k].push({ x, y, f: releve(x, y), r: rr, g });
  const evase = (a: number) => lisse(0, ENTREE, Math.min(a, Math.PI - a));
  for (let x = -S; x < 0; x += pas) p(0, x, -RS + r);                                          // la ligne d'arrivee, vers +x
  // (les virages allonges : la parallele au bord interieur a r - RS metres, evasee)
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI, g = evase(a), rr = r + ev * g, q = SALLE.virage(a, rr - RS); p(1, q[0], -RS + q[1], rr, g); }
  for (let x = 0; x > -S; x -= pas) p(2, x, -RS - r);                                          // la ligne opposee, vers -x
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI, g = evase(a), rr = r + ev * g, q = SALLE.virage(a, rr - RS); p(3, -S - q[0], -RS - q[1], rr, g); }
  if (partie >= 0) return [...parts[partie], parts[(partie + 1) % 4][0]];
  const pts = parts.flat();
  pts.push(pts[0]);
  return pts;
}
/** La hauteur du revetement releve en un point du tour (le releve va jusqu'au muret, evase avec lui). */
const zEn = (p: PointTour) => profil(Math.min(p.r, R_MUR) - RS) * p.f;

/**
 * Une bande de l'anneau entre deux rayons (evases de ev0 et ev1), relevee, a dz au-dessus du
 * revetement — ou a la hauteur zf, si on la donne. Les UV en metres.
 */
function bandeAnneau(r0: number, r1: number, dz: number, partie = -1, ev0 = 0, ev1 = 0, zf?: (p: PointTour) => number, garder = (_p: PointTour) => true) {
  const a = tour(r0, partie, ev0), b = tour(r1, partie, ev1);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    if (i) s += Math.hypot(a[i].x - a[i - 1].x, a[i].y - a[i - 1].y);
    pos.push(a[i].x, a[i].y, zf ? zf(a[i]) : zEn(a[i]) + dz, b[i].x, b[i].y, zf ? zf(b[i]) : zEn(b[i]) + dz);
    uv.push(s, 0, s, r1 - r0);
    // (le tour tourne dans le sens horaire vu de dessus, l'interieur a droite : cet ordre met les faces vers le haut)
    if (i && garder(a[i - 1]) && garder(a[i])) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** Un mur qui suit l'anneau au rayon r (evase de ev), de z0 a z1. */
function murAnneau(r: number, z0: (p: PointTour) => number, z1: (p: PointTour) => number, partie = -1, ev = 0, garder = (_p: PointTour) => true) {
  const a = tour(r, partie, ev);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    if (i) s += Math.hypot(a[i].x - a[i - 1].x, a[i].y - a[i - 1].y);
    const b = z0(a[i]), h = z1(a[i]);
    pos.push(a[i].x, a[i].y, b, a[i].x, a[i].y, h);
    uv.push(s, b, s, h);
    if (i && garder(a[i - 1]) && garder(a[i])) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
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
  const parametres = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const exporter = parametres.has('exporterSalle');
  // LES TEXTURES PHOTO (« apporte des textures pour augmenter le realisme », l'auteur, 26/10) :
  // Poly Haven, CC0, en 1k et recompressees (216 Ko a elles toutes) — le chene verni des gradins et
  // du plafond, le bardage d'acier nervure des facades (passe au gris). Les UV sont en metres.
  // (pour l'export vers Blender, les toiles dessinees : ces images ne sont pas encore chargees)
  const photo = (nom: string, metres: number, srgb = true, rot = 0, repli?: THREE.Texture) => {
    if (exporter && repli) return repli;
    const t = new THREE.TextureLoader().load(ctx.base + 'modeles/salle/textures/' + nom);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / metres, 1 / metres); t.rotation = rot;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    return t;
  };
  // tout l'interieur dans un groupe : on le cache quand la camera survole le batiment, dehors
  const g = new THREE.Group(); ctx.stade.add(g);
  // `lumiere` : la surface recoit la lumiere cuite dans Blender — 'sol' (vue de dessus) ou 'coque' (l'atlas)
  // (les aires de concours vont dans `terrain`, retourne d'un bout a l'autre : voir plus bas)
  let cible: THREE.Group = g;
  const ajouter = (geo: THREE.BufferGeometry, mat: THREE.Material, ombre = true, lumiere: '' | 'sol' | 'coque' = '') => {
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = ombre; cible.add(m);
    if (lumiere) m.userData.lumiere = lumiere;
    return m;
  };
  /** Une bande ou un mur de l'ovale, en quatre quarts (chacun sa place dans l'atlas de lumiere). */
  const enQuarts = (fab: (k: number) => THREE.BufferGeometry, mat: THREE.Material, lumiere: 'sol' | 'coque') => {
    for (let k = 0; k < 4; k++) ajouter(fab(k), mat, true, lumiere);
  };
  // les murs qui suivent l'anneau se voient des deux cotes (la piste et la coursive)
  const double = (mat: THREE.Material) => { const m2 = (mat as THREE.MeshStandardMaterial).clone(); m2.side = THREE.DoubleSide; return m2; };
  // (les teintes relevees sur la visite de 2025 : un bleu moins sature, un plateau plus chaud)
  const BLEU = [56, 100, 166], ANTHRACITE = [74, 74, 79], PLATEAU = [168, 163, 154], BLANC = [244, 245, 246];
  const bleu = matRevetement(BLEU, 11, 1), anthracite = matRevetement(ANTHRACITE, 23, 1);
  const plateau = matRevetement(PLATEAU, 37, 1);
  const ligne = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.93, 0.94, 0.95), roughness: 0.6 });
  ligne.polygonOffset = true; ligne.polygonOffsetFactor = -2; ligne.polygonOffsetUnits = -4;
  for (const m of [bleu, anthracite]) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; }
  // les textures de revetement sont en metres : une tuile pour 1,6 m
  for (const m of [bleu, anthracite, plateau]) { m.map!.repeat.set(1 / 1.6, 1 / 1.6); m.normalMap!.repeat.set(1 / 1.6, 1 / 1.6); }

  // LE PLATEAU : tout le sol de la halle, gris clair
  const sol = new THREE.PlaneGeometry(S + 2 * LONG, LY);
  const ps = ajouter(sol, plateau, true, 'sol');
  ps.position.set(-S / 2, YC, -0.01);
  const uvSol = sol.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uvSol.count; i++) uvSol.setXY(i, uvSol.getX(i) * (S + 2 * LONG), uvSol.getY(i) * LY);

  // L'ANNEAU : six couloirs alternes, et une bande d'anthracite derriere le sixieme jusqu'au muret
  for (let k = 0; k < NC; k++) ajouter(bandeAnneau(RS + k * CW, RS + (k + 1) * CW, 0.004), k % 2 ? anthracite : bleu, true, 'sol');
  for (let k = 0; k <= NC; k++) ajouter(bandeAnneau(RS + k * CW - LIGNE / 2, RS + k * CW + LIGNE / 2, 0.008), ligne, false, 'sol');
  // la corde : une lisse blanche en saillie au bord interieur
  ajouter(murAnneau(RS - 0.06, () => 0, () => 0.05), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }), false);

  // LA LIGNE DROITE CENTRALE (le plan) : six couloirs, d'un bord de l'anneau a l'autre — ses
  // bouts suivent le bord interieur des virages (« la ligne droite du 60 m va jusqu'a la ligne
  // du premier couloir du 200 m », l'auteur, 26/10)
  const xD = (y: number) => A * Math.sqrt(Math.max(0, 1 - ((y + RS) / RS) ** 2));    // le bord de l'anneau, cote x > 0
  const yD = -RS - (NC_DROITE / 2) * CW_DROITE;
  /** Une bande du plateau entre y0 et y1, d'un bord de l'anneau a l'autre (les UV en metres : ShapeGeometry). */
  const entreLesVirages = (y0: number, y1: number, z: number, mat: THREE.Material, lumiere: '' | 'sol' = 'sol') => {
    const f = new THREE.Shape(), n = 12;
    f.moveTo(-S - xD(y0), y0); f.lineTo(xD(y0), y0);
    for (let i = 1; i <= n; i++) { const y = y0 + (y1 - y0) * i / n; f.lineTo(xD(y), y); }
    for (let i = 0; i <= n; i++) { const y = y1 - (y1 - y0) * i / n; f.lineTo(-S - xD(y), y); }
    const m = ajouter(new THREE.ShapeGeometry(f), mat, lumiere !== '', lumiere); m.position.z = z;
    return m;
  };
  for (let k = 0; k < NC_DROITE; k++) entreLesVirages(yD + k * CW_DROITE, yD + (k + 1) * CW_DROITE, 0.004, k % 2 ? anthracite : bleu);
  for (let k = 0; k <= NC_DROITE; k++) { const y = yD + k * CW_DROITE; entreLesVirages(y - LIGNE / 2, y + LIGNE / 2, 0.008, ligne, ''); }
  /** Un trait blanc en travers du plateau, a plat. */
  const traitPlat = (x: number, y: number, lx: number, ly: number, mat: THREE.Material = ligne, z = 0.009) => {
    const m = ajouter(new THREE.PlaneGeometry(lx, ly), mat, false); m.position.set(x, y, z); return m;
  };
  // le depart du 60 m, la ligne des 50 m (les haies), l'arrivee — plus large
  traitPlat(DEPART_60, yD + W60 / 2, LIGNE, W60);
  traitPlat(DEPART_60 + 10, yD + W60 / 2, LIGNE, W60);
  traitPlat(ARRIVEE_60, yD + W60 / 2, 0.1, W60);

  // L'ARRIVEE ET LES DEPARTS DE L'ANNEAU, peints sur le revetement releve (« la ligne d'arrivee n'est
  // pas materialisee, les traits de depart non plus », l'auteur, 26/10). Chaque couloir court
  // `total` sur sa ligne de mesure (0,20 m du bord) : son depart est a (-total) modulo son tour,
  // compte depuis l'arrivee dans le sens de la course — le meme decalage que le moteur.
  /** Ou est-on, u metres apres l'arrivee sur la ligne de mesure de rayon rm, au rayon rho ; et le cap. */
  const surAnneau = (u: number, rm: number, rho: number) => {
    const arc = SALLE.longueurVirage(rm - RS), tourL = 2 * S + 2 * arc;
    u = ((u % tourL) + tourL) % tourL;
    if (u < arc) {
      const a = SALLE.phiVirage(u, rm - RS), q = SALLE.virage(a, rho - RS);
      return { x: q[0], y: -RS + q[1], cap: -SALLE.capVirage(a) };
    }
    if ((u -= arc) < S) return { x: -u, y: -RS - rho, cap: Math.PI };
    if ((u -= S) < arc) {
      const a = SALLE.phiVirage(u, rm - RS), q = SALLE.virage(a, rho - RS);
      return { x: -S - q[0], y: -RS - q[1], cap: Math.PI - SALLE.capVirage(a) };
    }
    u -= arc; return { x: -S + u, y: -RS + rho, cap: 0 };
  };
  /** Un trait en travers des couloirs, de rho0 a rho1, a u metres de l'arrivee : il epouse le relevement. */
  const traitAnneau = (u: number, rm: number, rho0: number, rho1: number, larg: number) => {
    const pos: number[] = [], idx: number[] = [], n = Math.max(2, Math.ceil((rho1 - rho0) / 0.15));
    for (let i = 0; i <= n; i++) {
      const p = surAnneau(u, rm, rho0 + (rho1 - rho0) * i / n), tx = Math.cos(p.cap) * larg / 2, ty = Math.sin(p.cap) * larg / 2;
      const z = zSol(p.x, p.y) + 0.012;
      pos.push(p.x - tx, p.y - ty, z, p.x + tx, p.y + ty, z);
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = ajouter(geo, ligneDouble, false);
    return m;
  };
  const ligneDouble = ligne.clone(); ligneDouble.side = THREE.DoubleSide;
  traitAnneau(0, RS + SALLE.mes1, RS, RS + W, 0.1);                    // l'arrivee
  for (const total of [200, 400]) for (let k = 1; k < NC; k++) {
    const rm = RS + k * CW + SALLE.mesN;
    traitAnneau(-total, rm, RS + k * CW, RS + (k + 1) * CW, LIGNE);
  }

  // LES AIRES DE CONCOURS, au plateau, d'apres le plan, cotes relevees depuis le milieu de la salle
  // (« tapis de perche et couloir d'elan, bac de saut en longueur et triple, les tapis de saut en
  // hauteur et l'aire de lancer de poids », l'auteur, 26/10). Le plan est dessine de l'autre cote :
  // la visite de 2025 (image 0661) met la perche et le sautoir pres du virage qui suit l'arrivee.
  // Les cotes du plan restent, le groupe est retourne d'un bout a l'autre de la salle.
  const terrain = new THREE.Group(); terrain.scale.x = -1; terrain.position.x = -S; g.add(terrain);
  cible = terrain;
  const sable = new THREE.MeshStandardMaterial({ map: grainDeSable(), roughness: 1 });
  const bordure = new THREE.MeshStandardMaterial({ color: 0xd9d9d6, roughness: 0.8 });
  const tapisR = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.80, 0.14, 0.16, THREE.SRGBColorSpace), roughness: 0.7 });
  const tapisB = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.13, 0.33, 0.70, THREE.SRGBColorSpace), roughness: 0.75 });
  const tapisG = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.8 });
  const acierBlanc = new THREE.MeshStandardMaterial({ color: 0xeef0f2, roughness: 0.35, metalness: 0.5 });
  const boite = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material, ombre = true) => {
    const b = ajouter(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), z1 - z0), mat);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); b.castShadow = ombre; return b;
  };
  /** Un couloir d'elan bleu, de x0 a x1, centre en y, borde de blanc. */
  const couloirElan = (x0: number, x1: number, y: number) => {
    const lx = Math.abs(x1 - x0), p = new THREE.PlaneGeometry(lx, 1.22), uv = p.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * lx, uv.getY(i) * 1.22);
    const m = ajouter(p, bleu, true, 'sol'); m.position.set((x0 + x1) / 2, y, 0.004);
    for (const d of [-0.61, 0.61]) traitPlat((x0 + x1) / 2, y + d, lx, LIGNE);
  };
  /** Un bac a sable affleurant, son cadre blanc. */
  const bac = (x0: number, x1: number, y0: number, y1: number) => {
    boite(x0 - 0.25, x1 + 0.25, y0 - 0.25, y1 + 0.25, -0.02, 0.012, bordure, false);
    const m = traitPlat((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), sable, 0.016);
    m.receiveShadow = true;
  };
  // la longueur et le triple : deux couloirs d'elan cote a cote, un bac a chaque bout, leurs planches
  // (0,50 m plus pres de la ligne d'arrivee que sur le plan : la ligne droite a desormais 8 couloirs)
  couloirElan(-54.8, 7.6, -8.0);
  couloirElan(-40.9, 7.6, -10.8);
  bac(7.8, 17.0, -6.8, -12.1);
  bac(-41.1, -49.9, -9.4, -12.2);
  for (const [x, y] of [[6.5, -8.0], [-5.5, -8.0], [-29.7, -10.8], [-31.7, -10.8], [-33.8, -10.8], [-39.5, -10.8]]) traitPlat(x, y, 0.2, 1.22, acierBlanc, 0.012);
  // la perche : son couloir, le butoir, le grand tapis rouge et bleu, ses deux montants et la barre
  couloirElan(14.5, -35.0, -3.95);
  boite(-35.0, -35.6, -3.65, -4.25, -0.2, 0.01, tapisG, false);                       // le butoir
  boite(-35.6, -41.4, -0.9, -7.0, 0, 0.32, tapisR);                                     // le socle
  boite(-35.75, -41.25, -1.05, -6.85, 0.32, 0.86, tapisB);                              // le tapis
  boite(-33.2, -35.6, -1.2, -3.5, 0, 0.42, tapisB); boite(-33.2, -35.6, -4.4, -6.7, 0, 0.42, tapisB); // les avancees
  for (const y of [-0.75, -7.15]) { boite(-35.4, -35.8, y - 0.2, y + 0.2, 0, 0.12, acierBlanc); boite(-35.55, -35.65, y - 0.05, y + 0.05, 0.12, 5.2, acierBlanc); }
  { const b = ajouter(new THREE.CylinderGeometry(0.025, 0.025, 6.4, 6), new THREE.MeshStandardMaterial({ color: 0xf0c020, roughness: 0.5 })); b.position.set(-35.6, -3.95, 4.6); }
  // la hauteur : le tapis (6,4 x 4 m), les deux poteaux et la barre, du cote de l'elan
  boite(0.5, -3.5, -24.4, -30.8, 0, 0.3, tapisR);
  boite(0.35, -3.35, -24.55, -30.65, 0.3, 0.75, tapisB);
  for (const y of [-24.3, -30.9]) { boite(-3.55, -3.95, y - 0.2, y + 0.2, 0, 0.1, acierBlanc); boite(-3.7, -3.8, y - 0.04, y + 0.04, 0.1, 2.6, acierBlanc); }
  { const b = ajouter(new THREE.CylinderGeometry(0.015, 0.015, 6.6, 6), new THREE.MeshStandardMaterial({ color: 0xe03a2a, roughness: 0.5 })); b.position.set(-3.75, -27.6, 1.85); }
  // le poids : le cercle (2,135 m), son butoir, le secteur de 34,92° et l'aire de chute
  {
    const cx = -47.6, cy = -27.66;
    boite(-25.4, -46.4, -22.9, -32.5, -0.01, 0.006, new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 1 }), false);
    const cercle = ajouter(new THREE.CircleGeometry(1.0675, 40), new THREE.MeshStandardMaterial({ color: 0x8c8c88, roughness: 0.95 }), false);
    cercle.position.set(cx, cy, 0.014);
    const anneau = ajouter(new THREE.RingGeometry(1.0675, 1.1175, 48), ligne, false); anneau.position.set(cx, cy, 0.016);
    const butoir = ajouter(new THREE.CylinderGeometry(1.17, 1.17, 0.1, 24, 1, true, -Math.PI / 6 + Math.PI / 2, Math.PI / 3), acierBlanc, false);
    butoir.rotation.x = Math.PI / 2; butoir.position.set(cx, cy, 0.05);
    for (const s of [-1, 1]) {
      const a = s * 34.92 / 2 * Math.PI / 180, l = 15;
      const m = traitPlat(cx + Math.cos(a) * (1.12 + l / 2), cy + Math.sin(a) * (1.12 + l / 2), l, LIGNE, ligne, 0.018);
      m.rotation.z = a;
    }
    // LA CAGE DE LANCER (la grande paroi verte vue de la tribune, 2025 ; le rectangle du plan) : un
    // filet vert de 4,5 m sur des poteaux de bois, tout autour de l'aire
    const filet = new THREE.MeshStandardMaterial({ color: 0x2fa64a, transparent: true, opacity: 0.38, roughness: 0.9, side: THREE.DoubleSide, depthWrite: false });
    const poteau = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8 });
    const xa = -25.4, xb = -49.6, ya = -22.9, yb = -32.5, hc = 4.5;
    for (const [x0, y0, x1, y1] of [[xa, ya, xb, ya], [xa, yb, xb, yb], [xb, ya, xb, yb], [xa, ya, xa, yb]]) {
      const l = Math.hypot(x1 - x0, y1 - y0), f = ajouter(new THREE.PlaneGeometry(l, hc), filet, false);
      f.position.set((x0 + x1) / 2, (y0 + y1) / 2, hc / 2); f.rotation.set(Math.PI / 2, 0, Math.atan2(y1 - y0, x1 - x0), 'ZXY');
      for (let t = 0; t <= l + 1e-6; t += l / Math.ceil(l / 3)) { const b = boite(x0 + (x1 - x0) * t / l - 0.06, x0 + (x1 - x0) * t / l + 0.06, y0 + (y1 - y0) * t / l - 0.06, y0 + (y1 - y0) * t / l + 0.06, 0, hc, poteau); b.castShadow = false; }
    }
  }

  cible = g;

  // LE TAPIS D'ARRET DU 60 M (« un gros tapis apres l'arrivee, derriere le dernier couloir de
  // l'anneau », l'auteur, 26/10 ; image 0661) : un mur de mousse bleue de 10 m sur 4,5 m, au nom de
  // la ville, dans l'axe de la ligne droite, contre le bord de la coursive du virage
  {
    let xMur = Infinity;
    for (let i = 0; i <= 180; i++) {
      const phi = Math.PI * i / 180, g1 = lisse(0, ENTREE, Math.min(phi, Math.PI - phi)), q = SALLE.virage(phi, R_BOIS - RS + EV * g1);
      if (Math.abs(q[1]) <= 5) xMur = Math.min(xMur, q[0]);
    }
    // (pose sur la zone de freinage, a sa hauteur, jusque sous la coursive)
    // (un seul tapis d'amortissement, 0,30 m d'epaisseur, plaque contre le mur : rien ne deborde sur la piste)
    const EP = 0.3, xf = xMur - EP, base = profil(R_MUR - RS), hT = H_COURSIVE - 0.1 - base;
    const mousse = new THREE.MeshStandardMaterial({ color: 0x1d5bb0, roughness: 0.9 });
    const corps = ajouter(new THREE.BoxGeometry(EP, 10, hT), mousse); corps.position.set(xf + EP / 2, -RS, base + hT / 2);
    const toileTapis = new THREE.MeshStandardMaterial({ roughness: 0.85, map: toile(1024, 460, (c, w, h) => {
      c.fillStyle = '#1d5bb0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff'; c.textAlign = 'center';
      for (let k = 0; k < 3; k++) {
        const x = w * (k + 0.5) / 3;
        c.font = '700 22px system-ui, sans-serif'; c.fillText('NATURELLEMENT', x, 74);
        c.font = '900 40px system-ui, sans-serif'; c.fillText('VAL DE REUIL', x, 124);
        c.beginPath(); c.moveTo(x - 46, 160); c.lineTo(x + 46, 160); c.lineTo(x, 236); c.closePath(); c.fill();
      }
    }) });
    const face = ajouter(new THREE.PlaneGeometry(10, hT), toileTapis, false);
    // (face a la piste, vers -x ; retournee comme les fresques du pignon : le monde est en miroir)
    face.position.set(xf - 0.01, -RS, base + hT / 2); face.scale.x = -1;
    face.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));
  }

  // AUTOUR DE L'ANNEAU : le muret blanc, le passage, puis le bandeau de bois qui porte la coursive
  const blanc = new THREE.MeshStandardMaterial({ map: mur(BLANC, 5), roughness: 0.9 });
  // (le haut du muret : le releve au muret plus 0,90 m — les gradins partent de la)
  const hautMur = (p: PointTour) => profil(R_MUR - RS) * p.f + 0.9;
  enQuarts(k => murAnneau(R_MUR, () => 0, hautMur, k, 0, horsFreinage), double(blanc), 'coque');
  enQuarts(k => bandeAnneau(R_MUR, R_G, 0, k, 0, 0, hautMur, horsFreinage), blanc, 'coque');
  // la zone de freinage : la piste prolongee a plat, en gris, du sixieme couloir jusqu'au tapis
  const zoneGrise = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.55, 0.56, 0.58, THREE.SRGBColorSpace), roughness: 0.85 });
  const zFrein = (p: PointTour) => profil(R_MUR - RS) * p.f;
  ajouter(bandeAnneau(RS + W, R_BOIS, 0.006, 1, 0, EV, p => zFrein(p) + 0.006, dansFreinage), zoneGrise, true, 'sol');
  // (sur le muret des virages, une rambarde d'acier a deux lisses : la photo Wikimedia)
  const acierRambarde = new THREE.MeshStandardMaterial({ color: 0x7a828a, roughness: 0.4, metalness: 0.6 });
  for (const k of [1, 3]) for (const dz of [0.5, 1.0]) ajouter(murAnneau(R_MUR + 0.08, p => hautMur(p) + dz - 0.04, p => hautMur(p) + dz, k, 0, horsFreinage), acierRambarde, false);
  // SOUS LA COURSIVE, HORS DE LA TRIBUNE (la visite filmee de 2025, images 0199, 0353, 0485, 0661 :
  // « analyse bien la ligne droite opposee », l'auteur, 26/10) : derriere le muret, un passage au
  // sol ; au bord de la coursive, un mur — en bas, les grandes vitres vertes de la salle
  // d'echauffement le long de la ligne opposee, des murs blancs dans les virages ; au-dessus, jusqu'au
  // plancher de la coursive, un bandeau de planches de bois HORIZONTALES (pas des gradins).
  const bois = lamesDeBois([176, 98, 52], false, 17); bois.repeat.set(1 / 3, 1 / 1.6);
  // (le chene, teinte du rouge orange des gradins de la salle)
  const matBois = new THREE.MeshStandardMaterial({ map: photo('bois-chene.jpg', 1.2, true, 0, bois), color: exporter ? 0xffffff : new THREE.Color().setRGB(1, 0.62, 0.42, THREE.SRGBColorSpace),
    normalMap: exporter ? null : photo('bois-chene-relief.jpg', 1.2, false), roughness: 0.55 });
  const H_VITRE = 3.0;
  // (le passage derriere le muret est bleu comme la piste : la photo Wikimedia)
  const passage = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.24, 0.42, 0.66, THREE.SRGBColorSpace), roughness: 0.85 });
  for (const k of [1, 2, 3]) {
    ajouter(bandeAnneau(R_G, R_BOIS, 0, k, 0, EV, () => 0.005), passage, true, 'sol');                                   // le passage
    ajouter(murAnneau(R_BOIS, () => H_VITRE, () => H_COURSIVE, k, EV), double(matBois), true, 'coque');                  // le bandeau de bois
    if (k !== 2) ajouter(murAnneau(R_BOIS, () => 0, () => H_VITRE, k, EV), double(blanc), true, 'coque');               // les murs blancs des virages
  }
  // LA SALLE D'ECHAUFFEMENT, derriere les vitres vertes de toute la ligne opposee : ses montants, et au
  // fond son mur turquoise
  {
    // (des panneaux translucides cyan pale, pas des vitres sombres : la visite de 2025)
    const vert = new THREE.MeshStandardMaterial({ color: 0xbfe6e3, transparent: true, opacity: 0.78, roughness: 0.3, metalness: 0, depthWrite: false });
    ajouter(murAnneau(R_BOIS, () => 0, () => H_VITRE, 2, 0), vert, false);
    const fond = new THREE.MeshStandardMaterial({ color: 0x4fb7c4, roughness: 0.8, side: THREE.DoubleSide });
    ajouter(murAnneau(R_BOIS + 4, () => 0, () => H_COURSIVE, 2, 0), fond, false);
    const montantVitre = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.6 });
    const y = -RS - R_BOIS;
    for (let x = -S; x <= 1e-6; x += 1.5) { const m = ajouter(new THREE.BoxGeometry(0.07, 0.09, H_VITRE), montantVitre, false); m.position.set(x, y, H_VITRE / 2); }
    const traverse = ajouter(new THREE.BoxGeometry(S, 0.09, 0.1), montantVitre, false); traverse.position.set(-S / 2, y, H_VITRE);
  }
  // la coursive : un plancher de l'ovale aux murs de la halle, et sa lisse vitree
  {
    const forme = new THREE.Shape();
    forme.moveTo(-S - LONG, -RS - LARGE); forme.lineTo(LONG, -RS - LARGE); forme.lineTo(LONG, -RS + LARGE_T); forme.lineTo(-S - LONG, -RS + LARGE_T); forme.closePath();
    // (pas de coursive au-dessus de la tribune : le trou va jusqu'au mur, le long de la ligne d'arrivee)
    const trou = new THREE.Path(), a = tour(R_BOIS, -1, EV).map(p => (surTribune(p) ? { ...p, y: -RS + LARGE_T - 0.3 } : p));
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
  for (const k of [1, 2, 3]) ajouter(murAnneau(R_BOIS + 0.05, () => H_COURSIVE, () => H_COURSIVE + 1.05, k, EV), verre, false);
  const lisseRail = new THREE.MeshStandardMaterial({ color: 0x7a828a, roughness: 0.4, metalness: 0.7 });   // (acier gris, pas noir)
  for (const k of [1, 2, 3]) ajouter(murAnneau(R_BOIS + 0.05, () => H_COURSIVE + 1.02, () => H_COURSIVE + 1.1, k, EV), lisseRail, false);
  // LES GRADINS DU HAUT (« les gradins du dessus manquent cruellement de details », l'auteur, 26/10) :
  // sur place, la coursive porte un rang de sieges bleus derriere sa balustrade de verre a
  // poteaux d'acier. Tout est instancie.
  {
    const Mx = new THREE.Matrix4(), q = new THREE.Quaternion(), un = new THREE.Vector3(1, 1, 1), Z = new THREE.Vector3(0, 0, 1);
    const poser = (lot: THREE.InstancedMesh, i: number, x: number, y: number, z: number, cap: number, sx = 1, sy = 1, sz = 1) => {
      q.setFromAxisAngle(Z, cap); Mx.compose(new THREE.Vector3(x, y, z), q, un.set(sx, sy, sz)); lot.setMatrixAt(i, Mx);
    };
    const a = tour(R_BOIS + 0.05, -1, EV).filter(p => !surTribune(p));
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
      const b = tour(r, -1, EV).filter(p => !surTribune(p));
      let l = 0;
      for (let i = 1; i < b.length && ns < 1400; i++) {
        const dx = b[i].x - b[i - 1].x, dy = b[i].y - b[i - 1].y;
        l += Math.hypot(dx, dy);
        if (l < 0.5) continue;
        l = 0;
        if (b[i].x > LONG - 0.5 || b[i].x < -S - LONG + 0.5) continue;   // contre les pignons, plus de place
        // (pas de sieges sur la coursive du virage d'apres l'arrivee, cote tribune : la table de
        // chronometrage et des gens debout, image 0661)
        if (b[i].x > 0 && b[i].y > -RS) continue;
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

  // LA TRIBUNE (voir R_T) : le podium et sa rambarde vitree, dix rangs de beton, deux flancs, un
  // passage en haut ; un escalier au milieu ; les sieges bleu ciel, assise et dossier
  {
    const beton = new THREE.MeshStandardMaterial({ color: 0xb3b6bb, roughness: 0.9 });
    const yT = (r: number) => -RS + r, xa = -S, xb = 0;
    const bloc = (r0: number, r1: number, z: number, mat: THREE.Material = beton) => {
      const b = ajouter(new THREE.BoxGeometry(xb - xa, r1 - r0, z), mat); b.position.set((xa + xb) / 2, yT((r0 + r1) / 2), z / 2); return b;
    };
    bloc(R_T, R_T + 0.3, Z_T);                                                       // le podium
    for (let i = 0; i < N_T; i++) bloc(R_T + 0.3 + i * P_T, R_T + 0.3 + (i + 1) * P_T, Z_T + (i + 1) * M_T);
    const fond = R_T + 0.3 + N_T * P_T, haut = Z_T + N_T * M_T;
    bloc(fond, LARGE_T - 0.05, haut + 0.1);                                           // le passage du haut
    for (const x of [xa, xb]) { const f = ajouter(new THREE.BoxGeometry(0.3, LARGE_T - R_T, haut + 1.1), beton); f.position.set(x, yT((R_T + LARGE_T) / 2), (haut + 1.1) / 2); }
    // la rambarde vitree du podium
    const vitre = ajouter(new THREE.BoxGeometry(xb - xa, 0.03, 1), verre, false); vitre.position.set((xa + xb) / 2, yT(R_T + 0.05), Z_T + 0.5);
    const main = ajouter(new THREE.BoxGeometry(xb - xa, 0.06, 0.06), lisseRail, false); main.position.set((xa + xb) / 2, yT(R_T + 0.05), Z_T + 1.02);
    // l'escalier du milieu : des marches plus basses, du beton plus clair
    const marche = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.85 });
    for (let j = 0; j < 2 * N_T; j++) {
      const m = ajouter(new THREE.BoxGeometry(1.2, P_T / 2, Z_T + (j + 1) * M_T / 2), marche);
      m.position.set(-S / 2, yT(R_T + 0.3 + (j + 0.5) * P_T / 2), (Z_T + (j + 1) * M_T / 2) / 2 + 0.005);
    }
  }
  const siege = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.36, 0.68, 0.92, THREE.SRGBColorSpace), roughness: 0.5 });
  const places = siegesTribune();
  const assiseT = new THREE.InstancedMesh(new THREE.BoxGeometry(0.44, 0.4, 0.07), siege, places.length);
  const dossierT = new THREE.InstancedMesh(new THREE.BoxGeometry(0.44, 0.06, 0.42), siege, places.length);
  const M = new THREE.Matrix4();
  places.forEach((p, i) => {
    M.makeTranslation(p.x, p.y, p.z + 0.42); assiseT.setMatrixAt(i, M);
    M.makeTranslation(p.x, p.y + 0.22, p.z + 0.62); dossierT.setMatrixAt(i, M);
  });
  for (const lot of [assiseT, dossierT]) { lot.castShadow = false; lot.receiveShadow = true; g.add(lot); }

  /** Une banderole bleu ciel au nom de la ville (le meme dessin partout ; aucune marque). */
  const matBandeVille = () => new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide, map: toile(512, 640, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2dbccb'); gr.addColorStop(1, '#1a9aaa');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.font = '900 64px system-ui, sans-serif'; c.textAlign = 'center';
    c.fillText('VAL', w / 2, h * 0.42); c.fillText('DE REUIL', w / 2, h * 0.56);
    c.beginPath(); c.moveTo(w / 2 - 60, h * 0.66); c.lineTo(w / 2 + 60, h * 0.66); c.lineTo(w / 2, h * 0.8); c.closePath(); c.fill();
  }) });
  // LES MURS DE LA HALLE, ses facades, et le plafond de bois sur des fermes d'acier
  const L = S + 2 * LONG, X0 = -S - LONG, X1 = LONG, Y0 = -RS - LARGE, Y1 = -RS + LARGE_T;
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
  // (le bardage photo : 2 m de cote, ses nervures tournees a l'horizontale)
  const matBardage = new THREE.MeshStandardMaterial({ map: photo('bardage.jpg', 2, true, Math.PI / 2, bardage), color: exporter ? 0xffffff : 0xd4d8de,
    normalMap: exporter ? null : photo('bardage-relief.jpg', 2, false, Math.PI / 2), roughness: 0.5, metalness: 0.25 });
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
    const bd = paroi(axe === 'y' ? -S / 2 : pos, axe === 'y' ? pos : YC, H_COURSIVE, H_TOIT, long, n, matBardage);
    if (!exporter) {
      // (ses UV en metres, pour la texture photo ; la carte de lumiere le sait : uvMetres)
      const uv = bd.geometry.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * long, uv.getY(i) * (H_TOIT - H_COURSIVE));
      bd.geometry.userData.uvMetres = true;
    }
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
  facade('x', X0, 'x+', LY, [[0.08, 0.5, 7.2, 9.4, 4.2]]);           // un pignon : cinq fenetres
  facade('x', X1, 'x-', LY, [[0.1, 0.3, 6.5, 9.6, 2.9]]);            // l'autre : un groupe de fenetres...
  for (const [a, b, gr] of [[0.4, 0.62, 3], [0.67, 0.89, 7]] as const) {    // ... et deux fresques sepia
    const f = paroi(X1, Y0 + (a + b) / 2 * LY, 6.5, 9.7, (b - a) * LY, 'x-', new THREE.MeshStandardMaterial({ map: sepia(gr), roughness: 0.9 }));
    // (scale.x = -1 : le monde de la course est en miroir, voir les panneaux de course-3d.ts)
    f.position.x -= 0.05; f.scale.x = -1; delete f.userData.lumiere;
  }
  // les grandes banderoles bleu ciel suspendues devant le grand vitrage
  for (const a of [0.36, 0.62]) {
    const m = ajouter(new THREE.PlaneGeometry(5, 5.5), matBandeVille(), false);
    // (retournee des deux sens : vue de la piste, sous le miroir du monde, le texte se lit droit)
    m.position.set(X0 + a * L, Y0 + 0.9, 7.6); m.rotation.x = -Math.PI / 2; m.scale.y = -1;
  }
  // le plafond de bois clair, en lames dans la longueur
  const plafondBois = lamesDeBois([196, 126, 70], false, 29); plafondBois.repeat.set(L / 3, LY / 3);
  // (le plafond : le meme chene, plus clair, ses lames dans la longueur ; UV de 0 a 1 sur L x LY)
  const plafondPhoto = exporter ? plafondBois : photo('bois-chene.jpg', 1);
  if (!exporter) plafondPhoto.repeat.set(L / 1.2, LY / 1.2);
  // (une face, vers le bas : vu d'au-dessus, on voit a travers)
  const toit = new THREE.Group(); g.add(toit);
  const plafond = new THREE.Mesh(new THREE.PlaneGeometry(L, LY), new THREE.MeshStandardMaterial({ map: plafondPhoto, color: exporter ? 0xffffff : new THREE.Color().setRGB(1, 0.8, 0.6, THREE.SRGBColorSpace), roughness: 0.7 }));
  plafond.position.set(-S / 2, YC, H_TOIT); plafond.rotation.x = Math.PI; toit.add(plafond); plafond.userData.lumiere = 'coque';
  // les fermes d'acier, en travers, tous les 7,5 m : membrures haute et basse, montants en zigzag
  const acier = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.45, metalness: 0.6 });   // (les fermes : acier gris clair)
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
    m.position.set(x, y, H_COURSIVE - 0.75); m.rotation.x = -Math.PI / 2; m.scale.y = -1;   // (retournee : vue de la piste, sous le miroir du monde, elle se lit droit)
  }
  // un grand drapeau bleu ciel sous le toit, comme sur place
  { const m = ajouter(new THREE.PlaneGeometry(2.2, 3.4), matBand, false); m.position.set(-S / 2, Y1 - 0.6, H_TOIT - 4); m.rotation.x = Math.PI / 2; m.scale.x = -1; }

  // LA LUMIERE CUITE DANS BLENDER (tools/blender/salle/cuire_lumiere.py) : les plafonniers, les
  // grands vitrages, les rebonds et les ombres douces, cuits une fois pour toutes dans deux images.
  // Le jeu garde ses matieres de detail (le grain de la piste, le bois) et les multiplie par
  // cette lumiere. Les cartes ci-dessous sont DETERMINISTES : l'export pour Blender (?exporterSalle=1)
  // et le jeu les recalculent a l'identique.
  // (?lumiere=0 : la salle eclairee par le jeu seul, sans la lumiere cuite)
  const sansCuisson = !exporter && parametres.get('lumiere') === '0';
  const cuites = sansCuisson ? { coque: [], sol: [] } : cartesDeLumiere(g, { X0, Y0, L, LY });
  if (exporter) exporterPourBlender(g.clone());
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
  if (!sansCuisson) {
    appliquer('lumiere-coque.jpg', cuites.coque, true);
    appliquer('lumiere-sol.jpg', cuites.sol, false);
  }

  // L'EXTERIEUR (Tripo, d'apres la vue aerienne du ministere des Sports ; tools/blender/salle/exterieur_tripo.py) :
  // le batiment vu de dehors, au seul survol d'avant-course — il cacherait la piste a tout autre plan
  const dehors = new THREE.Group(); dehors.visible = false; dehors.position.set(-S / 2, YC, 0); ctx.stade.add(dehors);
  // autour du batiment : la pelouse du parc des sports et le parvis
  { const p = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.36, 0.52, 0.27, THREE.SRGBColorSpace), roughness: 1 }));
    p.position.z = -0.05; dehors.add(p);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(L + 16, LY + 16), new THREE.MeshStandardMaterial({ color: 0xb8b4ac, roughness: 0.95 }));
    v.position.z = -0.02; dehors.add(v); }
  const chargeur = new GLTFLoader(); chargeur.setMeshoptDecoder(MeshoptDecoder);
  chargeur.load(ctx.base + 'modeles/salle/exterieur.glb', gl => {
    // le bardage est d'aluminium argent : la texture Tripo, prise sur une photo au soleil couchant, tire au beige
    gl.scene.traverse((o: any) => { if (o.isMesh) { o.receiveShadow = false; o.castShadow = false; if (o.material?.color) o.material.color.setRGB(0.86, 0.9, 0.96); } });
    // (le modele est a 103,34 m de long : la halle du plan est un peu plus courte)
    gl.scene.scale.x *= L / 103.34; gl.scene.scale.y *= LY / 58;
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
 * Les places des gradins de bois, sur les deux lignes droites : rang i (0 en bas), tous les 0,5 m.
 * Cote arrivee, deux blocs de sieges bleus de part et d'autre d'un escalier (le plan) ; en face,
 * on s'assoit sur le bois, sauf devant la paroi vitree de la salle d'echauffement.
 */
function placesGradins(arrivee: boolean) {
  const out: { x: number; y: number; z: number; rang: number }[] = [];
  if (arrivee) {
    // la tribune : dix rangs, une place tous les 0,5 m, l'escalier du milieu laisse libre
    for (let i = 0; i < N_T; i++) {
      const y = -RS + R_T + 0.3 + i * P_T + P_T * 0.45, z = Z_T + (i + 1) * M_T;
      for (let x = -S + 0.6; x < -0.5; x += 0.5) if (Math.abs(x + S / 2) > 0.9) out.push({ x, y, z, rang: i });
    }
    return out;
  }
  // la ligne opposee : debout dans le passage, devant les vitres
  for (let x = -S + 1; x < -1; x += 0.8) out.push({ x, y: -RS - (R_G + R_BOIS) / 2, z: 0, rang: 0 });
  return out;
}
const siegesTribune = () => placesGradins(true);

/**
 * LE PUBLIC DE LA SALLE : assis dans la tribune (face a la piste) et sur les gradins de bois d'en
 * face, debout le long de la lisse vitree de la coursive (tourne vers l'anneau). Comme au stade,
 * il se remplit par le bas et selon l'affluence (fouleDe) ; la coursive se garnit par endroits.
 */
export function placesDuPublic(affluence: number, hasard: () => number): { x: number; y: number; z: number; face: number; debout: boolean }[] {
  const places: { x: number; y: number; z: number; face: number; debout: boolean }[] = [];
  for (const arrivee of [true, false]) for (const p of placesGradins(arrivee)) {
    const occupe = arrivee ? 0.95 * Math.min(1, Math.max(0.05, affluence * 1.6 - (p.rang / N_T) * 1.6 * (1 - affluence))) : 0.08 + 0.2 * affluence;
    if (hasard() < occupe) places.push({ x: p.x + (arrivee ? 0 : (hasard() - 0.5) * 0.4), y: p.y + (arrivee ? 0.05 : 0), z: arrivee ? p.z + 0.05 : 0, face: arrivee ? -Math.PI / 2 : Math.PI / 2, debout: !arrivee });
  }
  // les sieges de la coursive (construireSalle les a poses) : assis, la piste en face
  for (const p of sieges3) if (hasard() < 0.08 + 0.55 * affluence) places.push({ x: p.x, y: p.y, z: p.z, face: p.face, debout: false });
  // la coursive : tous les 0,7 m le long de la lisse, plus ou moins garnie
  const a = tour(R_BOIS + 0.55, -1, EV);
  let reste = 0;
  for (let i = 1; i < a.length; i++) {
    const dx = a[i].x - a[i - 1].x, dy = a[i].y - a[i - 1].y, l = Math.hypot(dx, dy);
    reste += l;
    if (reste < 0.7) continue;
    reste = 0;
    // pas au-dessus de la tribune (elle a deja son monde), et un peu plus dans les virages
    const p = a[i];
    if (p.y > -RS && p.x > -S && p.x < 0) continue;
    if (p.x > LONG - 0.5 || p.x < -S - LONG + 0.5) continue;
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
    const plan = geo.type === 'PlaneGeometry' && !geo.userData.uvMetres;
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
