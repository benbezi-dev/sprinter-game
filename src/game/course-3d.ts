// LA COURSE EN VRAIE 3D — PROTOTYPE (22/10/2026).
//
// Rien du jeu ne change : le moteur fait avancer `G` comme toujours, et ce
// fichier ne fait que le REGARDER autrement. Il n'est charge que derriere
// `?rendu=3d` (components/GameCanvas.tsx) et ne remplace le dessin 2D que
// pendant le decompte, la course et le faux depart ; accueil, cinematiques
// et resultats restent ceux du jeu.
//
// LES COUREURS SONT CEUX DU JEU. `personCapsules` (sprinter-app.js) rend deja
// chaque athlete en troncs de cone dans un repere metrique 3D — x devant,
// y a gauche, z en haut — que le jeu aplatit ensuite pour son dessin. On les
// rend ici tels quels : looks, foulees, blocs, chutes et fatigue viennent
// gratuitement. Un seul maillage instancie pour tous les troncs, un autre
// pour les articulations : deux appels de dessin, quel que soit le nombre
// de coureurs.
//
// shortcut: un seul stade (piste de jour en ligne droite), pas de virage, pas
// de haies, pas d'enregistreur video — a etendre si le prototype convainc.
//
// LA CAMERA SERT LE JEU ACTUEL (l'auteur, 22/10) : on y court en voyant les
// huit couloirs, pour se mesurer aux autres. Par defaut, elle se tient donc en
// hauteur, de trois quarts arriere et un peu sur le cote, et cadre toute la
// piste en suivant le joueur. `?cam=dos` la met derriere lui, dans son couloir.
//
// Reglages d'URL : ?cam=dos ?haut= (hauteur, m) ?recul= (m derriere le
// joueur) ?cote= (m sur le cote) ?ombres=0 (sans ombres, telephones faibles).

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as clonerSquelette } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { poser, type Modele } from './vedette-3d';

const Q = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
const nombre = (k: string, d: number) => { const v = parseFloat(Q.get(k) || ''); return Number.isFinite(v) ? v : d; };
const DOS = Q.get('cam') === 'dos';
const HAUT = nombre('haut', DOS ? 2.5 : 5.5);
const RECUL = nombre('recul', DOS ? 5.5 : 8.5);
const COTE = nombre('cote', DOS ? 0 : 2.4);
const OMBRES = Q.get('ombres') !== '0';

const MAX_TRONCS = 1400;
const LANE_W = 1.22;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene, monde: THREE.Group, camera: THREE.PerspectiveCamera, soleil: THREE.DirectionalLight;
let troncs: THREE.InstancedMesh, joints: THREE.InstancedMesh, aR: THREE.InstancedBufferAttribute;
let toile: HTMLCanvasElement;
let visible = false;
let nCouloirs = 8;
const camPos = new THREE.Vector3(), camVise = new THREE.Vector3();
let camPret = false;

/** Un tronc de cone de rayon 1, axe Y de -0,5 a +0,5 : ses deux rayons viennent de l'instance. */
function materiauTronc() {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aR;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.xz *= mix(aR.x, aR.y, position.y + 0.5);');
  };
  return m;
}

function texteCanvas(dessin: (c: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  dessin(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// --- LE STADE, AUX COULEURS DU THEME DU JEU ----------------------------------
//
// Chaque stade du jeu est un theme (THEMES, sprinter-app.js) : ciel, pelouse et
// sa tonte, piste, marches et contremarches des gradins, toit, barriere,
// panneaux, public, feuillage. Le stade 3D se construit sur ces memes couleurs :
// l'etape en cours a donc sa version 3D sans rien dessiner de plus, et un
// changement d'etape le reconstruit.
//
// UN VRAI STADE, PAS UN DECOR DE THEATRE. La ligne droite tient dans un anneau
// complet : deux virages, la ligne opposee, une tribune principale a deux
// etages (loges vitrees, toit, facade), des tribunes qui suivent les virages et
// la ligne opposee, quatre pylones d'eclairage, un ecran geant, des drapeaux,
// des arbres et des nuages autour ; sur la piste, les blocs, le portique du
// chrono, des officiels et des photographes a l'arrivee. La camera se tient du
// cote de la corde : la tribune principale est en face, derriere ses panneaux.
//
// TOUT CE QUI SE REPETE EST INSTANCIE : marches, sieges, spectateurs, poteaux,
// troncs, feuillages — un appel de dessin par sorte d'objet, quel que soit le
// nombre. Le public est fait de deux formes basses (un buste, une tete de
// vingt faces) : une dizaine de milliers de gens pour quelques centaines de
// milliers de triangles. `?public=0.5` en met deux fois moins.
// shortcut: les pieces de decor propres a chaque stade (images Blender du jeu,
// cuites pour sa vue 2D) ne sont pas reprises : seul le theme l'est.
let stade: THREE.Group | null = null;
let themeVu: any = null;
const PUBLIC = Math.max(0, Math.min(1, nombre('public', 1)));
const R_CORDE = 36.5;                     // rayon de la corde dans les virages (m)
const DROITE0 = -12, DROITE1 = 100;       // la ligne droite, de la sortie du virage a l'arrivee
const c3 = (v: number[] | undefined, d: number[]) => {
  const a = v || d;
  return new THREE.Color().setRGB(a[0] / 255, a[1] / 255, a[2] / 255, THREE.SRGBColorSpace);
};
const css = (v: number[], k = 1) => `rgb(${Math.min(255, v[0] * k) | 0},${Math.min(255, v[1] * k) | 0},${Math.min(255, v[2] * k) | 0})`;

function plan(w: number, l: number, mat: THREE.Material, x: number, y: number, z = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  stade!.add(m);
  return m;
}

/** Un lot d'objets identiques, poses un par un puis rendus en un seul InstancedMesh. */
class Lot {
  m: THREE.Matrix4[] = []; c: (THREE.Color | null)[] = [];
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material, public ombre = false) {}
  poser(m: THREE.Matrix4, c: THREE.Color | null = null) { this.m.push(m.clone()); this.c.push(c ? c.clone() : null); }
  finir(g: THREE.Group) {
    if (!this.m.length) return;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.m.length);
    this.m.forEach((m, i) => { im.setMatrixAt(i, m); if (this.c[i]) im.setColorAt(i, this.c[i]!); });
    im.frustumCulled = false; im.castShadow = this.ombre; im.receiveShadow = true;
    g.add(im);
  }
}

const _bx = new THREE.Matrix4(), _tr = new THREE.Matrix4(), _sc = new THREE.Matrix4();
/** Une boite du repere local `M` : centre (x, y, z), cotes (lx, ly, lz). */
function boite(lot: Lot, M: THREE.Matrix4, x: number, y: number, z: number, lx: number, ly: number, lz: number, c: THREE.Color | null = null) {
  lot.poser(_bx.copy(M).multiply(_tr.makeTranslation(x, y, z)).multiply(_sc.makeScale(lx, ly, lz)), c);
}

function construireLeStade(nCouloirs: number, th: any) {
  if (stade) { monde.remove(stade); stade.traverse((o: any) => { o.geometry?.dispose?.(); }); }
  stade = new THREE.Group();
  monde.add(stade);
  const W = nCouloirs * LANE_W;
  let alea = 7;
  const hasard = () => ((alea = (alea * 16807) % 2147483647) / 2147483647);
  const couleur = (v: number[]) => new THREE.Color().setRGB(v[0] / 255, v[1] / 255, v[2] / 255, THREE.SRGBColorSpace);
  const base = (import.meta as any).env?.BASE_URL || '/';

  // LE CIEL, en degrade, et ses nuages
  const ciel = texteCanvas((c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(th.skyTop || [57, 73, 178])); g.addColorStop(1, css(th.skyBot || [71, 87, 192], 1.3));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, 4, 256);
  scene.background = ciel;
  scene.fog = new THREE.Fog(c3(th.skyBot, [71, 87, 192]).getHex(), 160, 420);
  if (!th.stars) {
    const nuage = texteCanvas((c, w, h) => {
      for (let i = 0; i < 14; i++) {
        const x = w * (0.2 + 0.6 * Math.random()), y = h * (0.45 + 0.2 * Math.random()), r = h * (0.18 + 0.2 * Math.random());
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }
    }, 256, 128);
    const matN = new THREE.MeshBasicMaterial({ map: nuage, transparent: true, depthWrite: false, fog: false });
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 45), matN);
      const a = -0.9 + i * 0.22;
      m.position.set(60 + 300 * Math.cos(a), -40 + 300 * Math.sin(a) * 0.6, 70 + 25 * hasard());
      m.lookAt(40, -30, 30);
      stade.add(m);
    }
  }

  // LA PELOUSE et sa tonte en bandes
  const herbe = th.grass || [29, 115, 17], bord = th.grassEdge || [18, 91, 9];
  const tonte = texteCanvas((c, w, h) => {
    for (let i = 0; i < 8; i++) { c.fillStyle = css(herbe, i % 2 ? 0.88 : 1.06); c.fillRect(i * w / 8, 0, w / 8, h); }
  }, 256, 8);
  tonte.wrapS = THREE.RepeatWrapping; tonte.repeat.set(10, 1);
  plan(400, 400, new THREE.MeshLambertMaterial({ map: tonte }), 44, -R_CORDE, -0.03);

  // LA PISTE : les deux lignes droites et les deux virages, couloir par couloir
  const A = th.trackA || [148, 0, 0], B = th.trackB || A;
  const matA = new THREE.MeshLambertMaterial({ color: c3(A, A) }), matB = new THREE.MeshLambertMaterial({ color: c3(B, B) });
  const ligne = new THREE.MeshBasicMaterial({ color: c3(th.lane, [247, 242, 233]) });
  const LD = DROITE1 - DROITE0, XD = (DROITE0 + DROITE1) / 2;
  const yOppose = -2 * R_CORDE - W;          // la ligne opposee, de l'autre cote de la pelouse
  for (const y0 of [0, yOppose]) {
    plan(LD, W + 1.6, matA, XD, y0 + W / 2, 0);
    for (let k = 1; k < nCouloirs; k += 2) plan(LD, LANE_W, matB, XD, y0 + (k + 0.5) * LANE_W, 0.001);
    for (let k = 0; k <= nCouloirs; k++) plan(LD, 0.05, ligne, XD, y0 + k * LANE_W, 0.002);
  }
  // les virages : des anneaux autour des deux centres, sur la pelouse
  for (const [xc, debut] of [[DROITE1, -Math.PI / 2], [DROITE0, Math.PI / 2]] as const) {
    const anneau = (r0: number, r1: number, mat: THREE.Material, z: number) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 64, 1, debut, Math.PI), mat);
      m.position.set(xc, -R_CORDE, z); m.receiveShadow = true; stade!.add(m);
    };
    anneau(R_CORDE - 0.8, R_CORDE + W + 0.8, matA, 0);
    for (let k = 1; k < nCouloirs; k += 2) anneau(R_CORDE + k * LANE_W, R_CORDE + (k + 1) * LANE_W, matB, 0.001);
    for (let k = 0; k <= nCouloirs; k++) anneau(R_CORDE + k * LANE_W - 0.025, R_CORDE + k * LANE_W + 0.025, ligne, 0.002);
  }
  plan(0.05, W, ligne, 0, W / 2, 0.003);                       // la ligne de depart
  const damier = texteCanvas((c, w, h) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 40; j++) {
      c.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; c.fillRect(i * w / 4, j * h / 40, w / 4, h / 40);
    }
  }, 64, 640);
  plan(0.5, W, new THREE.MeshBasicMaterial({ map: damier }), 100.25, W / 2, 0.003);
  for (let k = 0; k < nCouloirs; k++) {
    const t = texteCanvas((c, w, h) => {
      c.fillStyle = css(th.lane || [247, 242, 233]); c.font = `900 ${h * 0.9}px system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(k + 1), w / 2, h / 2 + h * 0.04);
    }, 128, 128);
    const m = plan(1.0, 1.0, new THREE.MeshBasicMaterial({ map: t, transparent: true }), -2.2, (k + 0.5) * LANE_W, 0.004);
    m.rotation.z = -Math.PI / 2;
    m.scale.x = -1;   // le monde est en miroir (voir initialiser) : le chiffre, lui, se lit a l'endroit
  }

  // LES LOTS : tout ce qui se repete
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const lMarche = new Lot(cube, new THREE.MeshLambertMaterial({ color: c3(th.tread, [175, 177, 187]) }));
  const lContre = new Lot(cube, new THREE.MeshLambertMaterial({ color: c3(th.riser, [130, 135, 150]) }));
  const lSiege = new Lot(new THREE.BoxGeometry(0.46, 0.38, 0.34), new THREE.MeshLambertMaterial({ color: 0x2457b8 }));
  const lBuste = new Lot(new THREE.BoxGeometry(0.36, 0.24, 0.5), new THREE.MeshLambertMaterial());
  const lTete = new Lot(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshLambertMaterial({ flatShading: false }));
  const lToit = new Lot(cube, new THREE.MeshLambertMaterial({ color: c3(th.roof, [76, 81, 100]) }), true);
  const lBeton = new Lot(cube, new THREE.MeshLambertMaterial({ color: 0xc9c6c0 }));
  const lBlanc = new Lot(cube, new THREE.MeshLambertMaterial({ color: c3(th.barrier, [231, 234, 239]) }));
  const lVitre = new Lot(cube, new THREE.MeshLambertMaterial({ color: 0x9fc4dc, emissive: 0x1a2a38 }));
  const lMetal = new Lot(new THREE.CylinderGeometry(0.5, 0.5, 1, 10), new THREE.MeshLambertMaterial({ color: 0xd8dbe2 }), true);
  const lBloc = new Lot(cube, new THREE.MeshLambertMaterial({ color: 0x8b9099 }));
  const lTronc = new Lot(new THREE.CylinderGeometry(0.22, 0.3, 1, 7), new THREE.MeshLambertMaterial({ color: 0x5b4030 }));
  const lFeuille = new Lot(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: c3(th.feuillage, [38, 111, 31]) }), true);
  const lo = th.crowdLo || [43, 38, 56], hi = th.crowdHi || [252, 242, 230];
  const maillots: number[][] = [...(th.panels || [[231, 60, 45], [28, 106, 202], [255, 203, 55], [50, 162, 121]]), lo, hi, [240, 240, 240]];
  const peaux = [[74, 46, 32], [120, 76, 50], [176, 122, 78], [224, 186, 142], [246, 220, 190]].map(couleur);
  const coulMaillots = maillots.map(couleur);
  const UP = new THREE.Vector3(0, 0, 1);
  const repere = (x: number, y: number, a: number) => new THREE.Matrix4().makeRotationAxis(UP, a).setPosition(x, y, 0);

  /** Un spectateur assis (ou debout) au point local (x, y, z) du repere M. */
  const spectateur = (M: THREE.Matrix4, x: number, y: number, z: number) => {
    boite(lBuste, M, x + (hasard() - 0.5) * 0.06, y, z + 0.5, 1, 1, 1, coulMaillots[(hasard() * coulMaillots.length) | 0]);
    boite(lTete, M, x, y - 0.02, z + 0.88 + hasard() * 0.05, 1, 1, 1, peaux[(hasard() * peaux.length) | 0]);
  };

  /**
   * DES GRADINS dans le repere local M : x le long de la tribune (0 -> L),
   * y en s'eloignant de la piste, z en haut. Rend la hauteur atteinte.
   */
  const gradins = (M: THREE.Matrix4, L: number, rangs: number, y0: number, z0: number, prof = 0.85, monte = 0.42) => {
    const pas = 0.55, n = Math.max(1, Math.floor(L / pas));
    for (let r = 0; r < rangs; r++) {
      const y = y0 + r * prof, z = z0 + r * monte;
      boite(lMarche, M, L / 2, y + prof / 2, z - 0.04, L, prof, 0.08);
      boite(lContre, M, L / 2, y + prof, z + monte / 2, L, 0.06, monte);
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * (L / n);
        boite(lSiege, M, x, y + prof * 0.55, z + 0.19, 1, 1, 1);
        if (hasard() < 0.74 * PUBLIC) spectateur(M, x, y + prof * 0.5, z);
      }
    }
    // le dessous, plein : on ne voit pas le jour entre les marches
    boite(lBeton, M, L / 2, y0 + rangs * prof / 2, z0 / 2 - 0.1, L, rangs * prof, z0);
    return z0 + rangs * monte;
  };

  // LA TRIBUNE PRINCIPALE, le long de la ligne droite, en face de la camera
  const yS = W + 3.2, XA = DROITE0 - 4, LS = DROITE1 - DROITE0 + 8;
  const Mp = repere(XA, yS, 0);
  boite(lBlanc, Mp, LS / 2, -0.15, 0.6, LS, 0.25, 1.2);                       // le muret
  const z1 = gradins(Mp, LS, 13, 0.4, 1.2);
  const yLoges = 0.4 + 13 * 0.85;
  boite(lBeton, Mp, LS / 2, yLoges + 1.2, z1 + 0.3, LS, 2.4, 0.6);
  boite(lVitre, Mp, LS / 2, yLoges + 1.9, z1 + 1.9, LS, 0.2, 2.6);           // les loges vitrees
  boite(lBeton, Mp, LS / 2, yLoges + 1.2, z1 + 3.3, LS, 2.6, 0.3);
  const z2 = gradins(Mp, LS, 15, yLoges + 2.6, z1 + 3.6, 0.85, 0.5);
  const yFond = yLoges + 2.6 + 15 * 0.85;
  boite(lToit, Mp, LS / 2, yFond + 0.2, (z2 + 3.4) / 2, LS, 0.4, z2 + 3.4);  // la facade
  boite(lToit, Mp, LS / 2, yFond - 9, z2 + 3.4, LS + 2, 20, 0.35);          // le toit en porte-a-faux
  for (let x = 0; x <= LS; x += 14) boite(lMetal, Mp, x, yFond - 1, z2 + 2, 0.35, 0.35, 3.0);

  // LES TRIBUNES DES VIRAGES ET DE LA LIGNE OPPOSEE, plus basses, en segments
  const rS = R_CORDE + W + 3.2;
  for (const [xc, sens] of [[DROITE1, 1], [DROITE0, -1]] as const) {
    const N = 18, L = Math.PI * (rS + 6) / N + 0.6;
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N * Math.PI;
      const nx = sens * Math.sin(t), ny = Math.cos(t);       // la normale, vers l'exterieur
      const px = xc + rS * nx, py = -R_CORDE + rS * ny;
      // repere local : x le long (tangente), y vers l'exterieur
      const a = Math.atan2(ny, nx) - Math.PI / 2;
      const M = repere(px, py, a).multiply(_tr.makeTranslation(-L / 2, 0, 0));
      boite(lBlanc, M, L / 2, -0.15, 0.6, L, 0.25, 1.2);
      const z = gradins(M, L, 16, 0.4, 1.2);
      boite(lToit, M, L / 2, 0.4 + 16 * 0.85 + 0.2, (z + 2) / 2, L, 0.4, z + 2);
    }
  }
  const Mo = repere(DROITE1 + 4, yOppose - 3.2, Math.PI);                    // ligne opposee
  boite(lBlanc, Mo, LS / 2, -0.15, 0.6, LS, 0.25, 1.2);
  const zo = gradins(Mo, LS, 16, 0.4, 1.2);
  boite(lToit, Mo, LS / 2, 0.4 + 16 * 0.85 + 0.2, (zo + 2) / 2, LS, 0.4, zo + 2);

  // LES PANNEAUX LED, au bord de la piste, devant la tribune principale
  const pub = new THREE.TextureLoader().load(base + 'pubs/benbezi-logo-3d-cadre.webp');
  pub.colorSpace = THREE.SRGBColorSpace; pub.wrapS = THREE.RepeatWrapping; pub.repeat.set(LS / 5, 1);
  const panneau = new THREE.Mesh(new THREE.PlaneGeometry(LS, 1.03), new THREE.MeshBasicMaterial({ map: pub }));
  panneau.position.set(XA + LS / 2, W + 1.7, 0.55); panneau.rotation.x = Math.PI / 2; panneau.scale.x = -1;  // (monde en miroir)
  stade.add(panneau);
  boite(lBloc, repere(0, 0, 0), XA + LS / 2, W + 1.78, 0.55, LS, 0.12, 1.1);
  // ... et le bandeau entre les deux etages
  const bandeau = new THREE.Mesh(new THREE.PlaneGeometry(LS, 0.7), new THREE.MeshBasicMaterial({ map: pub.clone() }));
  (bandeau.material as THREE.MeshBasicMaterial).map!.repeat.set(LS / 3.4, 1);
  bandeau.position.set(XA + LS / 2, yS + yLoges + 0.05, z1 + 0.3); bandeau.rotation.x = Math.PI / 2; bandeau.scale.x = -1;
  stade.add(bandeau);

  // L'ECRAN GEANT, au-dessus du virage d'arrivee, tourne vers la ligne droite
  const ecran = texteCanvas((c, w, h) => {
    c.fillStyle = '#05070d'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ff7a1a'; c.font = `900 ${h * 0.42}px system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SPRINTER', w / 2, h * 0.42);
    c.fillStyle = '#e8ecf4'; c.font = `700 ${h * 0.16}px system-ui, sans-serif`;
    c.fillText('100 M  ·  LIVE', w / 2, h * 0.78);
  }, 512, 256);
  const xE = DROITE1 + rS + 22;
  const ec = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: ecran, fog: false }));
  ec.position.set(xE, -R_CORDE + 6, 22); ec.rotation.set(Math.PI / 2, -Math.PI / 2, 0); ec.scale.x = -1;
  stade.add(ec);
  boite(lBloc, repere(0, 0, 0), xE + 0.4, -R_CORDE + 6, 22, 0.6, 17, 9);
  boite(lMetal, repere(0, 0, 0), xE + 0.6, -R_CORDE + 6, 9, 1.2, 1.2, 18);

  // LES PYLONES D'ECLAIRAGE, aux quatre coins
  const lampes = texteCanvas((c, w, h) => {
    c.fillStyle = '#20242c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) {
      c.fillStyle = '#fffbe8'; c.fillRect(4 + j * (w - 8) / 6, 4 + i * (h - 8) / 4, (w - 8) / 6 - 4, (h - 8) / 4 - 4);
    }
  }, 128, 96);
  const matLampes = new THREE.MeshBasicMaterial({ map: lampes });
  for (const [x, y] of [[DROITE1 + 30, W + 34], [DROITE0 - 30, W + 34], [DROITE1 + 30, yOppose - 34], [DROITE0 - 30, yOppose - 34]]) {
    boite(lMetal, repere(0, 0, 0), x, y, 24, 1.4, 1.4, 48);
    const p = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 6), [matLampes, matLampes, matLampes, matLampes, matLampes, matLampes]);
    p.position.set(x, y, 49); p.lookAt(44, -R_CORDE, 0); stade.add(p);
  }

  // LES DRAPEAUX, sur la facade de la tribune principale
  const lDrap = maillots.slice(0, 4).map(v => new THREE.MeshLambertMaterial({ color: couleur(v), side: THREE.DoubleSide }));
  for (let i = 0, x = 4; x < LS; x += 9, i++) {
    boite(lMetal, Mp, x, yFond + 0.1, z2 + 5.4, 0.08, 0.08, 4);
    const d = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), lDrap[i % lDrap.length]);
    d.position.copy(new THREE.Vector3(x + 0.9, yFond + 0.1, z2 + 6.8).applyMatrix4(Mp));
    d.rotation.x = Math.PI / 2; d.rotation.y = 0.25 * Math.sin(i);
    stade.add(d);
  }

  // SUR LA PISTE : les blocs, le portique du chrono, officiels et photographes
  const M0 = repere(0, 0, 0);
  for (let k = 0; k < nCouloirs; k++) {
    const y = (k + 0.5) * LANE_W;
    boite(lBloc, M0, -0.55, y, 0.04, 0.6, 0.12, 0.05);
    boite(lBloc, M0, -0.42, y + 0.14, 0.09, 0.08, 0.14, 0.16);
    boite(lBloc, M0, -0.7, y - 0.14, 0.09, 0.08, 0.14, 0.16);
  }
  for (const y of [-0.9, W + 0.9]) boite(lMetal, M0, 100, y, 1.6, 0.18, 0.18, 3.2);
  boite(lBlanc, M0, 100, W / 2, 3.25, 0.25, W + 1.8, 0.3);
  const chrono = texteCanvas((c, w, h) => {
    c.fillStyle = '#0a0a0a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd23a'; c.font = `700 ${h * 0.7}px ui-monospace, monospace`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('0.00', w / 2, h / 2);
  }, 256, 96);
  const ch = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ map: chrono }));
  ch.position.set(103, W + 1.2, 1.4); ch.rotation.set(Math.PI / 2, -Math.PI / 2, 0); ch.scale.x = -1;
  stade.add(ch);
  boite(lBloc, M0, 103.1, W + 1.2, 1.0, 0.2, 2.6, 2.0);
  // une poignee de gens au bord de la piste : officiels a l'arrivee, photographes apres la ligne
  for (let i = 0; i < 6; i++) spectateur(M0, 101 + i * 0.7, -1.6 - (i % 2) * 0.6, -0.1);
  for (let i = 0; i < 7; i++) spectateur(M0, 104 + i * 0.8, W * (i / 6), -0.55);
  for (let i = 0; i < 4; i++) spectateur(M0, 30 + i * 18, -1.8, -0.1);

  // LES ARBRES, autour du stade
  for (let i = 0; i < 70; i++) {
    const a = hasard() * Math.PI * 2, rx = 150 + hasard() * 40, ry = 95 + hasard() * 30;
    const x = 44 + rx * Math.cos(a), y = -R_CORDE + ry * Math.sin(a), h = 5 + hasard() * 5;
    boite(lTronc, M0, x, y, h * 0.3, 1, 1, h * 0.6);
    const r = 2.2 + hasard() * 1.6;
    boite(lFeuille, M0, x, y, h * 0.65 + r * 0.6, r, r, r * 1.2);
  }

  for (const l of [lMarche, lContre, lSiege, lBuste, lTete, lToit, lBeton, lBlanc, lVitre, lMetal, lBloc, lTronc, lFeuille]) l.finir(stade);
}

function initialiser(nCouloirs: number, toileDuJeu: HTMLCanvasElement | null) {
  toile = document.createElement('canvas');
  toile.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;display:none';
  // juste sous la toile du jeu, dans son conteneur : le fond de l'appli la cacherait sinon
  if (toileDuJeu && toileDuJeu.parentElement) toileDuJeu.parentElement.insertBefore(toile, toileDuJeu);
  else document.body.insertBefore(toile, document.body.firstChild);
  renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = OMBRES;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  // LE MONDE EN MIROIR. Le repere du jeu met le couloir 1 a droite de qui
  // regarde la ligne droite ; un vrai stade le met a gauche. Tout ce qui est
  // pose en coordonnees du jeu vit donc dans ce groupe retourne en Y, et la
  // camera, hors du groupe, retourne ses Y elle aussi.
  monde = new THREE.Group();
  monde.scale.y = -1;
  scene.add(monde);
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
  camera.up.set(0, 0, 1);
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a7a40, 1.6));
  soleil = new THREE.DirectionalLight(0xfff4e0, 2.2);
  soleil.castShadow = OMBRES;
  soleil.shadow.mapSize.set(1024, 1024);
  const sc = soleil.shadow.camera as THREE.OrthographicCamera;
  sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 80;
  soleil.shadow.bias = -0.0005;
  monde.add(soleil, soleil.target);

  const geoT = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
  aR = new THREE.InstancedBufferAttribute(new Float32Array(MAX_TRONCS * 2), 2);
  geoT.setAttribute('aR', aR);
  troncs = new THREE.InstancedMesh(geoT, materiauTronc(), MAX_TRONCS);
  joints = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX_TRONCS);
  for (const m of [troncs, joints]) {
    m.castShadow = OMBRES; m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    monde.add(m);
  }
  window.addEventListener('resize', dimensionner);
  dimensionner();
}

function dimensionner() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // en portrait, on elargit le champ pour garder les couloirs voisins
  camera.fov = w < h ? 62 : 50;
  camera.updateProjectionMatrix();
}

// --- LE CORPS EN VRAI MAILLAGE -------------------------------------------------
//
// Un seul corps generique (tools/blender/coureur_generique.py : Quaternius, CC0,
// passe par la chaine des vedettes), clone par coureur et teint a son look par
// zones. Il est pose par `poser` (vedette-3d.ts) sur r.squelette, que pose()
// releve des que r.squelette3D est vrai : memes angles que ses tubes. Tant qu'il
// n'est pas charge, ou si le chargement echoue, les tubes restent.
// shortcut: un corps d'homme pour tous, coureuses comprises — un corps de femme
// passe par le meme script le jour ou l'on va plus loin.
const Qgl = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
let gabarit: THREE.Object3D | null = null;
let chargement: Promise<void> | null = null;
type Corps = { m: Modele; mats: Record<string, THREE.MeshStandardMaterial> };
const corps = new Map<any, Corps>();

function chargerLeCorps() {
  if (chargement) return;
  const base = (import.meta as any).env?.BASE_URL || '/';
  const l = new GLTFLoader();
  l.setMeshoptDecoder(MeshoptDecoder);
  chargement = l.loadAsync(base + 'modeles/coureur-homme.glb')
    .then(g => { gabarit = g.scene; })
    .catch(() => { /* les tubes restent */ });
}

function modeleDe(racineGltf: THREE.Object3D): Modele {
  const racine = new THREE.Group();
  racine.matrixAutoUpdate = false;
  racine.add(racineGltf);
  racineGltf.updateMatrixWorld(true);
  const os = new Map<string, THREE.Bone>();
  racineGltf.traverse((o: any) => {
    if (o.isBone) os.set(o.name, o);
    if (o.isMesh) { o.frustumCulled = false; o.castShadow = OMBRES; }
  });
  const prof = (b: THREE.Object3D) => { let n = 0; while (b.parent) { b = b.parent; n++; } return n; };
  const ordre = [...os.values()].sort((a, b) => prof(a) - prof(b));
  const repos = new Map<THREE.Bone, THREE.Quaternion>(), reposLocal = new Map<THREE.Bone, THREE.Quaternion>();
  const inv = new THREE.Matrix4().copy(racineGltf.matrixWorld).invert();
  for (const b of ordre) {
    repos.set(b, new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().multiplyMatrices(inv, b.matrixWorld)));
    reposLocal.set(b, b.quaternion.clone());
  }
  const bassin = os.get('pelvis')!;
  const bassinParent = new THREE.Matrix4().multiplyMatrices(inv, bassin.parent!.matrixWorld);
  return { racine, os, ordre, repos, reposLocal, bassinParent } as Modele;
}

const SANS_CHEVEUX = new Set(['ras', 'shaved']);
function corpsDe(r: any): Corps | null {
  let c = corps.get(r);
  if (c) return c;
  if (!gabarit) return null;
  const copie = clonerSquelette(gabarit);
  const mats: Record<string, THREE.MeshStandardMaterial> = {};
  copie.traverse((o: any) => {
    if (!o.isMesh) return;
    const liste = Array.isArray(o.material) ? o.material : [o.material];
    const neufs = liste.map((m: any) => {
      const zone = String(m.name || '').replace('Coureur_', '');
      const n = new THREE.MeshStandardMaterial({ roughness: zone === 'peau' ? 0.55 : 0.7, metalness: 0 });
      mats[zone] = n;
      return n;
    });
    o.material = Array.isArray(o.material) ? neufs : neufs[0];
  });
  const L = r.look, rgb = (v: number[], k = 1) => new THREE.Color().setRGB(v[0] / 255 * k, v[1] / 255 * k, v[2] / 255 * k, THREE.SRGBColorSpace);
  mats.peau?.color.copy(rgb(L.skin));
  mats.maillot?.color.copy(rgb(L.jersey || [200, 40, 50]));
  mats.short?.color.copy(rgb(L.shorts));
  mats.pointes?.color.copy(rgb(L.shoe));
  mats.cheveux?.color.copy(SANS_CHEVEUX.has(L.hair) ? rgb(L.skin, 0.8) : rgb(L.hairCol || [20, 16, 14]));
  c = { m: modeleDe(copie), mats };
  monde.add(c.m.racine);
  corps.set(r, c);
  return c;
}

const _M = new THREE.Matrix4(), _S = new THREE.Matrix4(), _T = new THREE.Matrix4();
/** Le maillage du coureur, pose et place ; faux s'il n'est pas (encore) la. */
function poserLeCorps(App: any, r: any, p: number[], cap: number, lean: number, k: number): boolean {
  const c = corpsDe(r);
  if (!c || !r.squelette) return false;
  poser(c.m, r.squelette);
  const [ex, ey, ez] = App.repereDuCoureur(r, cap, lean, false, false);
  _M.set(ex[0], ey[0], ez[0], 0, ex[1], ey[1], ez[1], 0, ex[2], ey[2], ez[2], 0, 0, 0, 0, 1);
  c.m.racine.matrix.multiplyMatrices(_T.makeTranslation(p[0], p[1], 0), _S.makeScale(k, k, k))
    .multiply(_M).multiply(Qgl);
  c.m.racine.matrixWorldNeedsUpdate = true;
  c.m.racine.visible = true;
  return true;
}

// --- LES COUPS DE POUSSEE : le depart et la transition, recompenses ------------
//
// Les memes regles que le jeu (game/poussee-gestes.ts, la meme duree et la
// meme enveloppe que rendu-premium.js) : le DEPART CANON (reaction au-dessus de
// 82 % du gain maximal) allume le halo — l'onde doree au sol sous ses appuis et
// l'aura sur son buste ; la TRANSITION PARFAITE y ajoute l'image remanente, trois
// copies du coureur derriere lui (le depart aussi sous un skin qui part plus
// fort, look.departParfait). En 3D s'y ajoutent, a mi-force et sans copies, le
// BON DEPART (au moins 45 % du gain) et la BONNE TRANSITION (note 1), que le 2D
// ne signait que par le texte du HUD (demande de l'auteur, 22/10).
const POUSS_DUREE = 0.85, SEUIL_CANON = 0.82, SEUIL_BON = 0.45;
let poussT0 = -1, poussF = 0, poussEchos = false;
let vuReaction = false, vuTrans = false, coureurVu: any = null;
let onde: THREE.Mesh, aura: THREE.Sprite;
const echos: Corps[] = [];

function armer(f: number, avecEchos: boolean) {
  poussT0 = performance.now() / 1000; poussF = f; poussEchos = avecEchos;
}
function partPoussee() {
  const t = performance.now() / 1000 - poussT0;
  if (poussT0 < 0 || t > POUSS_DUREE) return { f: 0, age: -1 };
  const u = t / POUSS_DUREE;
  return { f: poussF * (u < 0.1 ? u / 0.1 : Math.pow(1 - (u - 0.1) / 0.9, 1.9)), age: u };
}
function guetterLesGestes(G: any, C: any) {
  const p = G.player;
  if (G.state !== 'race' || !p) { if (G.state !== 'race') { vuReaction = vuTrans = false; } return; }
  if (p !== coureurVu) { coureurVu = p; vuReaction = vuTrans = false; }
  if (!vuReaction && p.reaction !== null && p.reaction !== undefined) {
    vuReaction = true;
    const part = p.jumped ? 0 : (p.reactBonus || 0) / (C.REACT_BONUS || 1);
    if (part > SEUIL_CANON) armer(1, !!(p.look && p.look.departParfait > 1));
    else if (part > SEUIL_BON) armer(0.5, false);
  }
  if (!vuTrans && p.transGrade !== null && p.transGrade !== undefined) {
    vuTrans = true;
    if (p.transGrade === 2) armer(1, true);
    else if (p.transGrade === 1) armer(0.55, false);
  }
}

function initialiserLesEffets() {
  const or = new THREE.Color(248 / 255, 205 / 255, 74 / 255);
  onde = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48),
    new THREE.MeshBasicMaterial({ color: or, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  onde.visible = false;
  const halo = texteCanvas((c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(248,205,74,0.9)'); g.addColorStop(0.5, 'rgba(250,190,64,0.4)'); g.addColorStop(1, 'rgba(248,205,74,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, 128, 128);
  aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  aura.visible = false;
  monde.add(onde, aura);
}

/** Un double du coureur, translucide et dore, pour l'image remanente. */
function echoDe(k: number): Corps | null {
  if (echos[k]) return echos[k];
  if (!gabarit) return null;
  const copie = clonerSquelette(gabarit);
  const mat = new THREE.MeshBasicMaterial({ color: 0xf8cd4a, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
  copie.traverse((o: any) => { if (o.isMesh) { o.material = mat; o.castShadow = false; } });
  echos[k] = { m: modeleDe(copie), mats: {} };
  (echos[k] as any).mat = mat;
  monde.add(echos[k].m.racine);
  return echos[k];
}

function dessinerLesEffets(App: any) {
  const { G, C } = App;
  guetterLesGestes(G, C);
  const { f, age } = partPoussee();
  const p = G.player;
  for (const e of echos) if (e) e.m.racine.visible = false;
  onde.visible = aura.visible = false;
  if (f <= 0.02 || !p) return;
  const T = G.track, q = T.posDemi(p.d, p.lane, p.demi || 0);
  // l'onde s'ouvre sous ses appuis
  const r = 0.5 + 3.6 * age;
  onde.position.set(q[0], q[1], 0.02); onde.scale.set(r, r, 1);
  (onde.material as THREE.MeshBasicMaterial).opacity = f * 0.75 * (1 - age);
  onde.visible = true;
  // l'aura sur le buste
  const ra = (1.15 + 0.75 * f) * 1.6;
  aura.position.set(q[0], q[1], 1.05); aura.scale.set(ra, ra, 1);
  (aura.material as THREE.SpriteMaterial).opacity = f * 0.5;
  aura.visible = true;
  // les copies derriere lui, de plus en plus pales
  if (!poussEchos || !p.squelette) return;
  const cap = T.heading(p.d, p.lane), lean = T.lean(p.d, p.lane, p.v);
  const k0 = (p.look.h || C.MODEL_H) / C.MODEL_H;
  for (let k = 1; k <= 3; k++) {
    // plus espacees qu'en 2D : vue de dos, des copies serrees se fondent en une tache
    const d = p.d - Math.max(0.7, p.v * 0.11) * k;
    if (d <= 0) continue;
    const e = echoDe(k - 1);
    if (!e) continue;
    poser(e.m, p.squelette);
    const pq = T.posDemi(d, p.lane, p.demi || 0);
    const [ex, ey, ez] = App.repereDuCoureur(p, cap, lean, false, false);
    _M.set(ex[0], ey[0], ez[0], 0, ex[1], ey[1], ez[1], 0, ex[2], ey[2], ez[2], 0, 0, 0, 0, 1);
    e.m.racine.matrix.multiplyMatrices(_T.makeTranslation(pq[0], pq[1], 0), _S.makeScale(k0, k0, k0)).multiply(_M).multiply(Qgl);
    e.m.racine.matrixWorldNeedsUpdate = true;
    (e as any).mat.opacity = f * 0.3 * (4 - k) / 3;
    e.m.racine.visible = true;
  }
}

/** Montrer ou cacher la scene 3D (le dessin 2D reprend la main hors course). */
export function afficher(oui: boolean) {
  if (oui === visible || !renderer) { visible = oui && !!renderer; if (renderer) toile.style.display = visible ? 'block' : 'none'; return; }
  visible = oui;
  toile.style.display = oui ? 'block' : 'none';
  if (!oui) camPret = false;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _a = new THREE.Vector3(),
  _b = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const AXE_Y = new THREE.Vector3(0, 1, 0);

/** Une image de la course, lue sur l'etat du jeu. */
export function rendre(App: any, dt: number) {
  const { G, C } = App;
  const T = G.track;
  if (!renderer) {
    const lanes = (G.runners || []).map((r: any) => r.lane | 0);
    nCouloirs = Math.max(8, ...lanes.map((l: number) => l + 1));
    initialiser(nCouloirs, G.cv || null);
    initialiserLesEffets();
    chargerLeCorps();
  }
  // le stade de l'etape en cours (le theme a l'heure ou l'on joue, comme le dessin 2D)
  // (l'eclairage de l'heure rend un nouvel objet : c'est le theme brut qui dit si l'etape a change)
  const brut = App.themeBrut ? App.themeBrut() : null;
  if (!stade || brut !== themeVu) { themeVu = brut; construireLeStade(nCouloirs, App.theme ? App.theme() : {}); }
  if (!toile || toile.style.display === 'none') {
    afficher(true);
  }
  if (T.curved) return;   // shortcut: ligne droite seulement

  const tous = (G.ghost && G.runners.indexOf(G.ghost.runner) < 0) ? G.runners.concat([G.ghost.runner]) : G.runners;
  // les blocs et le « prets » : c'est le dessin du jeu qui les pose, a chaque image
  for (const r of tous) App.phaseBlocs(r);

  // les corps des coureurs d'une course passee s'en vont avec elle
  for (const [r, c] of corps) {
    c.m.racine.visible = false;
    if (tous.indexOf(r) < 0) { monde.remove(c.m.racine); corps.delete(r); }
  }
  let n = 0, nj = 0;
  for (const r of tous) {
    if (!r || !r.look) continue;
    const p = T.posDemi(r.d, r.lane, r.demi || 0);
    const cap = T.heading(r.d, r.lane) + (r.retour ? Math.PI : 0) + (r.cap || 0);
    const k = (r.look.h || C.MODEL_H) / C.MODEL_H;
    const lean = T.lean(r.d, r.lane, r.v) + (r.roulis || 0);
    r.squelette3D = true;
    const caps = App.personCapsules(r, cap, lean, false, false, r === G.player ? 0 : 1);
    if (poserLeCorps(App, r, p, cap, lean, k)) continue;
    for (const [col, e0, e1] of caps) {
      if (n >= MAX_TRONCS || nj >= MAX_TRONCS - 1) break;
      _a.set(p[0] + e0[0] * k, p[1] + e0[1] * k, e0[2] * k);
      _b.set(p[0] + e1[0] * k, p[1] + e1[1] * k, e1[2] * k);
      _d.subVectors(_b, _a);
      const L = _d.length();
      _c.setRGB(col[0] / 255, col[1] / 255, col[2] / 255, THREE.SRGBColorSpace);
      if (L > 1e-4) {
        _q.setFromUnitVectors(AXE_Y, _d.divideScalar(L));
        _m.compose(_s.addVectors(_a, _b).multiplyScalar(0.5), _q, _d.set(1, L, 1));
        troncs.setMatrixAt(n, _m);
        aR.setXY(n, e0[3] * k, e1[3] * k);
        troncs.setColorAt(n, _c);
        n++;
      }
      for (const e of [e0, e1]) {
        const rr = e[3] * k;
        _m.compose(_s.set(p[0] + e[0] * k, p[1] + e[1] * k, e[2] * k), _q.identity(), _d.set(rr, rr, rr));
        joints.setMatrixAt(nj, _m); joints.setColorAt(nj, _c); nj++;
      }
    }
  }
  troncs.count = n; joints.count = nj;
  troncs.instanceMatrix.needsUpdate = true; joints.instanceMatrix.needsUpdate = true;
  aR.needsUpdate = true;
  if (troncs.instanceColor) troncs.instanceColor.needsUpdate = true;
  if (joints.instanceColor) joints.instanceColor.needsUpdate = true;

  // LA CAMERA, derriere le joueur dans l'axe de son couloir, un peu en hauteur
  const pl = G.player;
  if (pl) {
    const p = T.posDemi(pl.d, pl.lane, pl.demi || 0);
    // Centree sur le couloir du joueur, decalee vers la corde (couloir 1), la tribune en face :
    // il est au milieu de l'image, ses voisins des deux cotes. Y retourne : voir `monde`.
    const yAxe = p[1];
    const voulu = _a.set(p[0] - RECUL, -(yAxe - COTE), HAUT);
    // le point vise prolonge la droite camera -> joueur : il reste au centre de l'image
    const loin = DOS ? 14 : 7;
    const vise = _b.set(p[0] + loin, -(yAxe + COTE * loin / RECUL), DOS ? 0.9 : 0.6);
    const lisse = camPret ? 1 - Math.exp(-(dt || 0.016) * 6) : 1;
    camPos.lerp(voulu, lisse); camVise.lerp(vise, lisse);
    camPret = true;
    camera.position.copy(camPos);
    camera.lookAt(camVise);
    soleil.position.set(p[0] - 10, p[1] - 18, 30);
    soleil.target.position.set(p[0] + 6, p[1], 0);
  }
  dessinerLesEffets(App);
  renderer!.render(scene, camera);
}
