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
// LES VIRAGES (200 et 400 m) : le jeu pose ces courses dans son propre repere,
// le virage de depart centre sur l'origine (voir Track, sprinter-core.js). `caler`
// le ramene sur le stade, l'arrivee toujours au bout de la ligne droite principale.
//
// shortcut: pas de haies, pas de relais, pas de concours (ils restent en 2D,
// GameCanvas.tsx), pas d'enregistreur video.
//
// LA CAMERA SERT LE JEU ACTUEL (l'auteur, 22/10) : on y court en voyant les
// huit couloirs, pour se mesurer aux autres. Par defaut, elle se tient donc en
// hauteur, de trois quarts arriere et un peu sur le cote, et cadre toute la
// piste en suivant le joueur. `?cam=dos` la met derriere lui, dans son couloir.
//
// Reglages d'URL : ?cam=dos ?haut= (hauteur, m) ?recul= (m derriere le
// joueur) ?cote= (m sur le cote) ?ombres=0 (sans ombres, telephones faibles)
// ?stade=or (habille la course 3D d'un autre stade du jeu, pour le voir sans le
// canal de test : la liste des stades, elle, ne change pas).

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as clonerSquelette } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { poser, type Modele } from './vedette-3d';
import { construirePlage } from './plage-3d';
import { construirePalais } from './palais-3d';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { construireRuelle, type Ruelle } from './ruelle-3d';
import { construireLegende } from './legende-3d';
import { construireMenole } from './menole-3d';
import { construireChamp, BLEU, BLANC, ROUGE } from './champ-de-mars-3d';

const Q = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
const nombre = (k: string, d: number) => { const v = parseFloat(Q.get(k) || ''); return Number.isFinite(v) ? v : d; };
const DOS = Q.get('cam') === 'dos';
const HAUT = nombre('haut', DOS ? 2.5 : 5.5);
const RECUL = nombre('recul', DOS ? 5.5 : 8.5);
const COTE = nombre('cote', DOS ? 0 : 2.4);
// Le profil (voir la camera, dans rendre) : ou il commence et s'acheve (en part de la
// course), sa hauteur et sa part d'arriere en portrait. A regler sur le telephone :
// ?pdebut=0.08 ?pfin=0.92 ?phaut=6 ?parriere=0.15 ?ploin=1.2
const P_DEBUT = nombre('pdebut', 0.08), P_FIN = Math.max(P_DEBUT + 0.05, nombre('pfin', 0.92));
// ?ploin : la distance du profil — 1,2 retenu par l'auteur sur son telephone (22/10)
const P_LOIN = Math.max(0.4, nombre('ploin', 1.2));
const P_HAUT = nombre('phaut', 6), P_ARRIERE = Math.min(0.9, Math.max(0, nombre('parriere', 0.15)));
const OMBRES = Q.get('ombres') !== '0';
const STADE_FORCE = Q.get('stade');
// ?qualite=plein : sans l'ULTRA (definition plafonnee a 2, ombres 1024)
let ULTRA = Q.get('qualite') !== 'plein';
let lentes = 0;
/** L'ULTRA cede si l'appareil ne tient pas la cadence : trois secondes d'images a plus de
 *  24 ms, et la definition redescend a deux pixels par point (une fois, pour la visite). */
function tenirLaCadence(dt: number) {
  // un a-coup (chargement, compilation d'un shader) n'est pas une cadence perdue
  if (!ULTRA || !renderer || !dt || dt > 0.1) return;
  lentes = dt > 0.024 ? lentes + dt : Math.max(0, lentes - dt * 0.5);
  if (lentes > 3) { ULTRA = false; renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); dimensionner(); }
}
// ?vue=survol : une vue aerienne fixe du stade entier, pour verifier le decor (rien ne s'y chevauche)
const SURVOL = Q.get('vue') === 'survol';

const MAX_TRONCS = 1400;
const LANE_W = 1.22;

let renderer: THREE.WebGLRenderer | null = null;
let envPalais: THREE.Texture | null = null;
// le Champ-de-Mars porte `angle: 15` en 2D pour que la tour tienne dans le ciel : en 3D, un profil plus bas qui vise plus haut
let profilBas = false;
const _camLocale = new THREE.Vector3(), _camCap = new THREE.Vector3();
let hemi: THREE.HemisphereLight;
let scene: THREE.Scene, monde: THREE.Group, camera: THREE.PerspectiveCamera, soleil: THREE.DirectionalLight;
let troncs: THREE.InstancedMesh, joints: THREE.InstancedMesh, aR: THREE.InstancedBufferAttribute;
let toile: HTMLCanvasElement, vignetteDe: HTMLDivElement | null = null;
let visible = false;
let nCouloirs = 8;
const camPos = new THREE.Vector3(), camVise = new THREE.Vector3();
let camPret = false;
let secousse = 0, etatVu = '', champBase = 55;
const soleilDecal = new THREE.Vector3(-10, -18, 30);
// LE SURVOL d'avant-course (voir rendre) : ou il en est, et ou il plonge
let volLance = false, volT = 0, volPlonge = -1;
const volDepart = new THREE.Vector3(), volVise0 = new THREE.Vector3();
let profilDecal = 0, profilEcart = 0, profilPret = false, profilB = 0;
// l'espace (Intergalactique) : la voute etoilee qui tourne et l'etoile filante
let voute: THREE.Object3D | null = null, filante: THREE.Mesh | null = null, filanteT = 0;
// le Stade Neon : ses hologrammes (qui gresillent) et sa pluie (qui suit la camera)
let hologrammes: THREE.Mesh[] = [], pluie: THREE.LineSegments | null = null;
// la nuit du molosse : sa ruelle (ruelle-3d.ts) et sa bete (molosse.glb)
let ruelle: Ruelle | null = null;
// la Carriere Legende : ses decors (legende/decors.ts), charges a la demande — le canal de test seul les sert
let legendeDecors: typeof import('./legende/decors') | null = null, legendeNuages: typeof import('./legende/nuages') | null = null;
let legendeDemande = false, legendeEssais = 0;
// les panneaux animes et le film de l'ecran geant (voir LES PANNEAUX LED)
// (t, et la camera dans le repere du stade : ce qui doit tenir au loin, comme la tour du Champ-de-Mars)
let pubAnim: ((t: number, camX: number, camY: number, cap: number) => void)[] = [], videoPub: HTMLVideoElement | null = null;
const _c3 = new THREE.Vector3(), _d3 = new THREE.Vector3();

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

// --- LE PUBLIC, EN CARTES -----------------------------------------------------
//
// Quinze mille spectateurs ne se modelisent pas : un corps fait douze mille faces.
// Chacun est donc une CARTE — deux triangles —, rendue dans Blender depuis de vrais
// corps (tools/blender/public_cartes.py : Quaternius CC0, homme et femme, trois
// coiffures, quatre gestes, cinq angles). Le shader la tourne vers la camera, prend
// l'angle rendu le plus proche et la teint : la case porte sa passe (peau, maillot,
// cheveux, pantalon, siege, chaussures) en rouge et sa lumiere en vert, et chaque
// spectateur a ses couleurs. Une seule texture, un seul appel de dessin.
//
// LA FOULE VIT. Elle se leve et saute au passage du joueur, et tout le stade se
// leve apres l'arrivee (uLiesse) ; ceux qui applaudissent sautillent.
const P_SIL = 6, P_GESTES = 5, P_ANGLES = 5, CARTE_L = 1.1, CARTE_H = 2.2;
let atlasPublic: THREE.Texture | null = null, publicDemande = false;
// le public de la plage : memes corps, sans siege de stade (public_cartes.py --plage)
let atlasPlage: THREE.Texture | null = null, plageDemandee = false;
const uFoule = {
  uAtlas: { value: null as THREE.Texture | null }, uCam: { value: new THREE.Vector3() },
  uT: { value: 0 }, uJoueur: { value: new THREE.Vector2(1e4, 1e4) }, uLiesse: { value: 0 },
  uSiege: { value: new THREE.Color(0x2457b8) }, uLum: { value: 1 },
};
function chargerLaPlage() {
  if (plageDemandee) return;
  plageDemandee = true;
  const base = (import.meta as any).env?.BASE_URL || '/';
  new THREE.TextureLoader().loadAsync(base + 'modeles/stades/public-plage-cartes.png').then(t => {
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.NoColorSpace;
    atlasPlage = t;
    formeVue = '';
  }).catch(() => { /* une plage sans public */ });
}
function chargerLePublic() {
  if (publicDemande) return;
  publicDemande = true;
  const base = (import.meta as any).env?.BASE_URL || '/';
  new THREE.TextureLoader().loadAsync(base + 'modeles/stades/public-cartes.png').then(t => {
    // au plus proche, sans mipmaps : une passe melangee a sa voisine n'existe pas
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.NoColorSpace;
    atlasPublic = uFoule.uAtlas.value = t;
    formeVue = '';   // le stade se refait, peuple
  }).catch(() => { /* gradins vides */ });
}
/** La foule : `cartes` = par spectateur x, y, z, cap, variante, phase, puis quatre couleurs. */
function laFoule(cartes: number[]) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const ib = new THREE.InstancedInterleavedBuffer(new Float32Array(cartes), 18);
  const at = (n: string, taille: number, decal: number) => g.setAttribute(n, new THREE.InterleavedBufferAttribute(ib, taille, decal));
  at('aPos', 3, 0); at('aFace', 1, 3); at('aVar', 1, 4); at('aPh', 1, 5);
  at('aC1', 3, 6); at('aC2', 3, 9); at('aC3', 3, 12); at('aC4', 3, 15);
  g.instanceCount = cartes.length / 18;
  const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uFoule);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 aPos, aC1, aC2, aC3, aC4;
attribute float aFace, aVar, aPh;
uniform vec3 uCam; uniform float uT, uLiesse; uniform vec2 uJoueur;
varying vec2 vCase; varying vec3 vC1, vC2, vC3, vC4;`)
      .replace('#include <begin_vertex>', `
vec2 versCam = uCam.xy - aPos.xy;
float ang = atan(versCam.y, versCam.x);
float ge0 = mod(aVar, ${P_GESTES}.0);
// LES PHOTOGRAPHES SUIVENT LA COURSE : leur objectif tourne vers le joueur (« en
// mouvement, pas tout droit », l'auteur, 22/10), chacun avec son petit ecart
float face = aFace;
if (ge0 > 3.5) face = atan(uJoueur.y - aPos.y, uJoueur.x - aPos.x) + (fract(aPh * 37.1) - 0.5) * 0.5;
float rel = mod(degrees(ang - face) + 180.0, 360.0) - 180.0;
float ia = clamp(floor((rel + 60.0) / 30.0 + 0.5), 0.0, ${P_ANGLES - 1}.0);
float sil = floor(aVar / ${P_GESTES}.0), ge = mod(aVar, ${P_GESTES}.0);
// au passage du joueur, et toute entiere apres l'arrivee, la foule se leve
float h = fract(sin(aPh * 91.7) * 4375.85);
float pres = 1.0 - smoothstep(10.0, 24.0, distance(aPos.xy, uJoueur));
if (ge < 2.5 && h < max(pres * 0.8, uLiesse)) ge = h < 0.5 ? 2.0 : 1.0;
float saut = (ge > 0.5 && ge < 2.5) ? abs(sin(uT * 7.0 + aPh * 6.2832)) * 0.08 : 0.0;
vec2 droite = vec2(-sin(ang), cos(ang));
vec3 transformed = aPos + vec3(droite * position.x * ${CARTE_L}, position.y * ${CARTE_H} + saut);
vCase = vec2((sil * ${P_GESTES}.0 + ge + uv.x) / ${P_SIL * P_GESTES}.0, 1.0 - (ia + 1.0 - uv.y) / ${P_ANGLES}.0);
vC1 = aC1; vC2 = aC2; vC3 = aC3; vC4 = aC4;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uAtlas; uniform vec3 uSiege; uniform float uLum;
varying vec2 vCase; varying vec3 vC1, vC2, vC3, vC4;`)
      .replace('#include <map_fragment>', `
vec4 tx = texture2D(uAtlas, vCase);
if (tx.a < 0.5) discard;
float zo = floor(tx.r * 255.0 / 32.0 + 0.5);
vec3 cz = zo < 0.5 ? vec3(0.05) : zo < 1.5 ? vC1 : zo < 2.5 ? vC2 : zo < 3.5 ? uSiege : zo < 4.5 ? vC3 : vC4;
diffuseColor.rgb = cz * (0.28 + 0.9 * tx.g) * uLum;`);
  };
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

// --- L'ESPACE (Intergalactique) -------------------------------------------------

/** La voute du vide : nebuleuses et poussiere d'etoiles sur une sphere tout autour, et une galaxie. */
function espaceAutour(th: any, hasard: () => number) {
  const fond = th.skyTop || [11, 7, 26];
  scene.background = new THREE.Color().setRGB(fond[0] / 255 * 0.5, fond[1] / 255 * 0.5, fond[2] / 255 * 0.5, THREE.SRGBColorSpace);
  scene.fog = new THREE.Fog(scene.background.getHex(), 380, 1400);
  const teintes: number[][] = th.nebuleuses || [[196, 72, 190], [52, 150, 220], [120, 70, 210]];
  const ciel = texteCanvas((c, w, h) => {
    c.fillStyle = css(fond, 0.6); c.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = hasard() * w, y = h * (0.1 + hasard() * 0.8), r = h * (0.08 + hasard() * 0.22);
      const col = teintes[i % teintes.length], a = 0.12 + hasard() * 0.16;
      for (const dx of [0, -w, w]) {
        const g = c.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(x + dx - r, y - r, 2 * r, 2 * r);
      }
    }
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = `rgba(255,255,255,${0.2 + hasard() * 0.6})`;
      c.fillRect(hasard() * w, hasard() * h, 1, 1);
    }
  }, 2048, 1024);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(560, 48, 24),
    new THREE.MeshBasicMaterial({ map: ciel, side: THREE.BackSide, fog: false, depthWrite: false }));
  sphere.rotation.x = Math.PI / 2;                      // ses poles sur l'axe z du monde
  sphere.position.set(44, -R_CORDE, 0);
  stade!.add(sphere);
  voute = sphere;
  // LA GALAXIE, au loin, sous l'horizon de la piste
  const spirale = texteCanvas((c, w, h) => {
    const cx = w / 2, cy = h / 2;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, w * 0.18);
    g.addColorStop(0, 'rgba(255,240,255,0.95)'); g.addColorStop(1, 'rgba(200,120,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let bras = 0; bras < 2; bras++) for (let i = 0; i < 1400; i++) {
      const t = i / 1400, a = bras * Math.PI + t * 9, r = t * w * 0.46;
      const x = cx + Math.cos(a) * r + (hasard() - 0.5) * w * 0.05 * (0.3 + t), y = cy + Math.sin(a) * r * 0.42 + (hasard() - 0.5) * h * 0.03;
      const col = teintes[(i + bras) % teintes.length];
      c.fillStyle = `rgba(${Math.min(255, col[0] + 60)},${Math.min(255, col[1] + 60)},${Math.min(255, col[2] + 60)},${0.5 * (1 - t)})`;
      c.fillRect(x, y, 2, 2);
    }
  }, 512, 512);
  const gal = new THREE.Mesh(new THREE.PlaneGeometry(260, 260),
    new THREE.MeshBasicMaterial({ map: spirale, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  gal.position.set(330, -R_CORDE - 160, -150);
  gal.lookAt(44, -R_CORDE, 20);
  stade!.add(gal);
  // L'ETOILE FILANTE : un trait qui traverse le ciel de temps en temps (rendre)
  const trace = texteCanvas((c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g; c.fillRect(0, h / 2 - 1, w, 2);
  }, 256, 8);
  filante = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.6),
    new THREE.MeshBasicMaterial({ map: trace, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  filante.visible = false;
  stade!.add(filante);
}

/** Les planetes de decor-cosmos.js, aux memes places le long du trace, loin sous la piste. */
const PLANETES_3D = [
  { f: 0.10, couloir: -12, R: 5.2, col: [214, 92, 200], anneau: true },
  { f: 0.42, couloir: -24, R: 10.5, col: [58, 170, 214], anneau: false },
  { f: 0.72, couloir: -10, R: 2.6, col: [236, 162, 84], anneau: false },
  { f: 0.95, couloir: -18, R: 6.4, col: [130, 110, 236], anneau: true },
];
function planetesSousLaPiste(T: any, hasard: () => number) {
  for (const pl of PLANETES_3D) {
    const p = ici(T.pos(pl.f * (T.total || 100), pl.couloir));
    const R = pl.R * 2.4, z = -(20 + R * 3.2);
    const bandes = texteCanvas((c, w, h) => {
      for (let y = 0; y < h; y += 4) {
        const k = 0.75 + 0.35 * Math.sin(y * 0.09 + hasard() * 0.6);
        c.fillStyle = css(pl.col, k); c.fillRect(0, y, w, 4);
      }
    }, 64, 128);
    const astre = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20),
      new THREE.MeshLambertMaterial({ map: bandes, emissive: c3(pl.col, pl.col).multiplyScalar(0.18), fog: false }));
    astre.position.set(p[0], p[1], z);
    astre.rotation.set(0.4, 0.2, 0);
    stade!.add(astre);
    // le halo autour, et l'anneau
    const halo = texteCanvas((c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w / 2);
      g.addColorStop(0, `rgba(${pl.col[0]},${pl.col[1]},${pl.col[2]},0.45)`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 128, 128);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.position.copy(astre.position); sp.scale.set(R * 3.4, R * 3.4, 1);
    stade!.add(sp);
    if (pl.anneau) {
      const a = new THREE.Mesh(new THREE.RingGeometry(R * 1.4, R * 2.2, 96),
        new THREE.MeshBasicMaterial({ color: c3(pl.col, pl.col).lerp(new THREE.Color(0xffffff), 0.4), transparent: true, opacity: 0.55,
          side: THREE.DoubleSide, depthWrite: false, fog: false }));
      a.position.copy(astre.position);
      a.rotation.set(1.15, 0.3, 0);
      stade!.add(a);
    }
  }
}

// --- LE STADE NEON (cyberpunk) ------------------------------------------------------

/**
 * La ville autour du Stade Neon : des tours aux fenetres allumees, fondues en UN seul
 * maillage (un appel de dessin pour cent tours), des panneaux holographiques au-dessus
 * des tribunes, et la pluie.
 */
function villeNeon(hasard: () => number, rS: number) {
  const fenetres = texteCanvas((c, w, h) => {
    c.fillStyle = '#05040a'; c.fillRect(0, 0, w, h);
    const teintes = ['#ffd9a0', '#00e5ff', '#00e5ff', '#ff2bd6', '#ff2bd6', '#b04dff', '#b0c8ff'];   // plus de neon que de lampes
    for (let y = 2; y < h - 4; y += 6) for (let x = 2; x < w - 3; x += 5) {
      if (hasard() > 0.36) continue;
      c.globalAlpha = 0.35 + hasard() * 0.65;
      c.fillStyle = teintes[(hasard() * teintes.length) | 0]; c.fillRect(x, y, 3, 3);
    }
    c.globalAlpha = 1;
  }, 64, 128);
  fenetres.wrapS = fenetres.wrapT = THREE.RepeatWrapping;
  fenetres.magFilter = THREE.NearestFilter;
  const tours: THREE.BufferGeometry[] = [], proches: number[][] = [];
  for (let i = 0; i < 110; i++) {
    const a = (i / 110) * Math.PI * 2 + hasard() * 0.04;
    const r = rS + 80 + hasard() * 150;   // au-dela du survol (orbite 125 x 95 m) : il traversait les premieres
    // le coin de l'ecran geant, au bout de la ligne droite, reste libre
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3 && r < rS + 130) continue;
    const x = 44 + Math.cos(a) * r * 1.25, y = -R_CORDE + Math.sin(a) * r;
    const h = 40 + hasard() * (r > rS + 140 ? 220 : 120), lx = 14 + hasard() * 22, ly = 14 + hasard() * 22;
    const g = new THREE.BoxGeometry(lx, ly, h).toNonIndexed();
    const uv = g.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * Math.max(lx, ly) / 8, uv.getY(k) * h / 16);
    g.rotateZ(hasard() * Math.PI);
    g.translate(x, y, h / 2);
    tours.push(g);
    if (r < rS + 130) proches.push([x, y, h, Math.max(lx, ly)]);
  }
  const ville = new THREE.Mesh(mergeGeometries(tours)!, new THREE.MeshBasicMaterial({ map: fenetres }));
  stade!.add(ville);
  // LES HOLOGRAMMES : des glyphes inventes sur une couleur vive, qui gresillent (rendre)
  const couleurs = ['#ff2bd6', '#00e5ff', '#8c3cff', '#ffdc1e'];
  for (let i = 0; i < 10; i++) {
    const col = couleurs[i % couleurs.length];
    const t = texteCanvas((c, w, h) => {
      c.fillStyle = col; c.globalAlpha = 0.16; c.fillRect(0, 0, w, h); c.globalAlpha = 1;
      for (let gy = 10; gy < h - 10; gy += 22) for (let gx = 10; gx < w - 12; gx += 14) {
        if (hasard() < 0.15) continue;
        for (let k = 0; k < 9; k++) if (hasard() < 0.55) c.fillRect(gx + (k % 3) * 3, gy + ((k / 3) | 0) * 5, 3, 4);
      }
      c.fillRect(0, 0, w, 3); c.fillRect(0, h - 3, w, 3);
    }, 256, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), new THREE.MeshBasicMaterial({ map: t, transparent: true,
      opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    const a = (i + 0.5) / 10 * Math.PI * 2;
    m.position.set(44 + Math.cos(a) * (rS + 40) * 1.25, -R_CORDE + Math.sin(a) * (rS + 40), 26 + (i % 3) * 7);
    m.lookAt(44, -R_CORDE, 12);
    stade!.add(m);
    hologrammes.push(m);
  }
  // PLUS CYBERPUNK (« accentue le cote cyberpunk », 22/10) : aux tours proches, des enseignes
  // verticales ; dans le ciel, la circulation des vehicules volants. (La grille de neon au sol
  // est retiree : « c'est trop, accentue au niveau des couleurs ».)
  const teintesEns = ['#ff2bd6', '#00e5ff', '#ffdc1e', '#ff4d4d', '#8c3cff'];
  proches.slice(0, 26).forEach(([x, y, h, l], i) => {
    const col = teintesEns[i % teintesEns.length];
    const t = texteCanvas((c, w, hh) => {
      c.fillStyle = '#05040a'; c.fillRect(0, 0, w, hh);
      c.strokeStyle = col; c.lineWidth = 3; c.strokeRect(3, 3, w - 6, hh - 6);
      c.fillStyle = col;
      // des glyphes inventes, en colonne, comme des katakana de neon
      for (let gy = 14; gy < hh - 16; gy += 26) for (let k = 0; k < 9; k++) if (hasard() < 0.6) c.fillRect(12 + (k % 3) * 6, gy + ((k / 3) | 0) * 7, 5, 5);
    }, 40, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 20), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, fog: false }));
    const a = Math.atan2(-R_CORDE - y, 44 - x);
    m.position.set(x + Math.cos(a) * (l / 2 + 0.6), y + Math.sin(a) * (l / 2 + 0.6), Math.min(h - 12, 18 + (i % 4) * 9));
    m.rotation.set(Math.PI / 2, 0, 0); m.rotateY(a + Math.PI / 2);
    stade!.add(m);
  });
  const feu = texteCanvas((c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, 32, 32);
  const volants = Array.from({ length: 14 }, (_, i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: feu, color: i % 3 ? 0xff3355 : 0xd8f4ff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.scale.setScalar(2.6); stade!.add(sp);
    return { sp, r: rS + 60 + hasard() * 120, h: 45 + hasard() * 70, v: (0.03 + hasard() * 0.04) * (i % 2 ? 1 : -1), a0: hasard() * 6.3 };
  });
  pubAnim.push(t => {
    for (const o of volants) {
      const a = o.a0 + t * o.v;
      o.sp.position.set(44 + Math.cos(a) * o.r * 1.25, -R_CORDE + Math.sin(a) * o.r, o.h + Math.sin(t * 0.7 + o.a0) * 3);
    }
  });
  // LA PLUIE : des traits qui tombent autour de la camera (rendre la fait descendre)
  // chaque goutte deux fois, a trente metres d'ecart : la descente boucle sans saut
  const n = 800, pts = new Float32Array(n * 12);
  for (let i = 0; i < n; i++) {
    const x = (hasard() - 0.5) * 70, y = (hasard() - 0.5) * 70, z = hasard() * 30;
    pts.set([x, y, z, x + 0.12, y + 0.08, z - 0.9, x, y, z + 30, x + 0.12, y + 0.08, z + 29.1], i * 12);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  pluie = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xa8b8ff, transparent: true, opacity: 0.35, depthWrite: false }));
  pluie.frustumCulled = false;
  if (!SURVOL) scene.add(pluie);
}

// --- LES PIECES DE CHAQUE STADE ------------------------------------------------
//
// Celles des images 2D, aux memes places : le plan de decors-stades.js (PLAN, lieu)
// dit quelle piece va ou et a partir de quelle etape ; tools/blender/stades_3d_glb.py
// les exporte en GLB, construites par les memes fonctions Blender que leurs images.
// Une piece pas encore chargee n'est pas posee ; son arrivee refait le stade.
const pieces3D = new Map<string, THREE.Object3D | null>();
function pieceDuStade(cle: string): THREE.Object3D | null {
  if (!pieces3D.has(cle)) {
    pieces3D.set(cle, null);
    const base = (import.meta as any).env?.BASE_URL || '/';
    const l = new GLTFLoader();
    l.setMeshoptDecoder(MeshoptDecoder);
    // en ULTRA, la piece pleine (tools/blender/stades_3d_glb.py --ultra), sinon la legere — et
    // la legere si la pleine manque (la copie GitHub du site ne les porte pas : son plafond)
    const charger = (dossier: string) => l.loadAsync(base + 'modeles/' + dossier + '/' + cle + '.glb');
    (ULTRA ? charger('stades-ultra').catch(() => charger('stades')) : charger('stades')).then(g => {
      g.scene.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      pieces3D.set(cle, g.scene);
      formeVue = '';
    }).catch(() => { /* la piece manque : le stade reste sans elle */ });
  }
  return pieces3D.get(cle) || null;
}
function poserLesPieces(T: any, stadeCle: string | null, etape: number) {
  const D = (globalThis as any).DecorsStades;
  const plan = stadeCle && D && D.PLAN && D.PLAN[stadeCle];
  if (!plan || !D.lieu) return;
  for (const e of plan) {
    if (etape < (e.des || 0)) continue;
    const L = D.lieu(T, e.l);
    if (!L) continue;
    const modele = pieceDuStade(stadeCle + '/' + e.p);
    if (!modele) continue;
    const o = modele.clone();
    const q = ici([L.X, L.Y]);
    o.position.set(q[0], q[1], 0);
    o.rotation.z = capIci((L.yaw + (e.rot || 0)) * Math.PI / 180);
    stade!.add(o);
  }
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
let themeVu: any = null, formeVue = '';
const PUBLIC = Math.max(0, Math.min(1, nombre('public', 1)));
const R_CORDE = 36.5;                     // rayon de la corde dans les virages (m)
const DROITE0_100 = -12, DROITE1 = 100;       // la ligne droite, de la sortie du virage a l'arrivee
// (au 100 m ; sur un virage, la ligne droite d'un vrai stade, 84,39 m, l'arrivee au meme endroit)

// DU REPERE DU JEU A CELUI DU STADE. En ligne droite, ce sont les memes. Sur un
// demi-tour, le jeu met son virage autour de l'origine et la ligne droite a y = r :
// on le pousse jusqu'au virage du stade. Sur un tour complet, il finit sur l'autre
// ligne droite, en sens inverse (y = -r, cap -pi) : on le retourne d'un demi-tour.
let sx = 1, x0 = 0, y0 = 0;
function caler(T: any) {
  if (!T.curved) { sx = 1; x0 = 0; y0 = 0; }
  else if (T.fullLap) { sx = -1; x0 = DROITE1; y0 = -R_CORDE; }
  else { sx = 1; x0 = DROITE1 - T.straight; y0 = -R_CORDE; }
}
const ici = (p: number[]) => [x0 + sx * p[0], y0 + sx * p[1]];
const capIci = (c: number) => (sx < 0 ? c + Math.PI : c);
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

function construireLeStade(nCouloirs: number, th: any, T: any, C: any, stadeCle: string | null, etape: number, affluence = 1) {
  // le virage du depart : celui du stade sur un virage, plus loin derriere au 100 m (sa ligne droite est plus longue)
  const DROITE0 = T.curved ? DROITE1 - T.straight : DROITE0_100;
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
  // LA NUIT : un ciel sombre (ou etoile) eteint le soleil et allume les projecteurs du
  // stade — une lumiere froide et dure, une ambiance basse, la foule dans la penombre.
  const ct = th.skyTop || [68, 81, 167];
  // LE PALAIS ROYAL (palais-3d.ts) : un interieur — ni ciel, ni heure, ni gradins ; la lumiere des lustres
  const palais = !!th.palais;
  // LE CHAMP-DE-MARS (champ-de-mars-3d.ts) : pas de stade, une tribune provisoire d'un gradin, la piste tricolore
  const cdm = !!th.champDeMars;
  profilBas = cdm;
  // LA PISTE ARC-EN-CIEL : un couloir, une couleur pure (piste-arc-en-ciel.js en 2D)
  const arc: number[][] | null = th.arcEnCiel || null;
  // (le Danube porte `heure: 'nuit'` : hors de la nuit, son ciel est celui de l'heure bleue, mais ses projecteurs restent allumes)
  const nuit = !palais && (th.heure === 'nuit' || !!th.stars || 0.3 * ct[0] + 0.59 * ct[1] + 0.11 * ct[2] < 60);
  // LE LUXE (Stade d'Or) : la nuit y est chaude — des projecteurs couleur d'or sur une
  // piste laquee, une ambiance presque nulle, la foule dans l'ombre (StadeOr.cs, Unity).
  const luxe = !!th.luxe;
  // LE STADE NEON (cyberpunk, StadeCyber.cs) : une nuit violette, des neons, la pluie
  const cyber = !!th.cyber;
  // LA PLAGE (plage-3d.ts) : un soleil bas et dore de fin d'apres-midi, pas de gradins
  // la plage de Menole (Carriere Legende) : la lumiere et l'absence de gradins d'une plage,
  // mais son decor a elle (menole-3d.ts), pas celui de la Plage Paradis
  const menole = stadeCle === 'legende-menole';
  const plage = !!th.plage || menole;
  if (plage) chargerLaPlage();
  uFoule.uAtlas.value = plage ? atlasPlage : atlasPublic;
  hemi.color.set(luxe ? 0x6a5638 : cyber ? 0x9a38d8 : plage ? 0xffe2c0 : nuit ? 0x7a88c0 : 0xdfefff);
  hemi.groundColor.set(luxe ? 0x080604 : cyber ? 0x1c0634 : plage ? 0xd8b080 : nuit ? 0x1a1f2a : 0x5a7a40);
  hemi.intensity = luxe ? 0.45 : cyber ? 0.7 : plage ? 1.25 : nuit ? 0.6 : 1.6;
  soleil.color.set(luxe ? 0xffd49a : cyber ? 0xe0a0ff : plage ? 0xffc58a : nuit ? 0xe6eeff : 0xfff4e0);
  soleil.intensity = luxe ? 2.6 : cyber ? 1.7 : plage ? 2.6 : nuit ? 2.0 : 2.2;
  soleilDecal.set(plage ? 22 : -10, plage ? 50 : -18, plage ? 16 : 30);   // a la plage, bas, au-dessus de la mer
  // LA LUMIERE DE L'HEURE (heure-du-jour.js : le theme du moment porte `moment`). Le jour
  // reste tel quel ; l'apres-midi le soleil baisse et se rechauffe ; le soir il est orange
  // et rasant, les ombres s'allongent ; la nuit, ce sont les projecteurs (plus haut).
  const moment = th.moment || 'jour';
  if (!luxe && !cyber && !plage && !th.espace && !nuit && moment === 'apres-midi') {
    hemi.color.set(0xfff0dc); hemi.intensity = 1.45;
    soleil.color.set(0xffe2b8); soleil.intensity = 2.3;
    soleilDecal.set(-30, -14, 20);
  } else if (!luxe && !cyber && !plage && !th.espace && !nuit && moment === 'soir') {
    // (trop rasant au premier essai, a 11 m : le soleil n'eclairait plus le sol, et le soir
    // sortait aussi sombre que la nuit)
    hemi.color.set(0xffd0b0); hemi.groundColor.set(0x806050); hemi.intensity = 1.35;
    soleil.color.set(0xffa860); soleil.intensity = 2.8;
    soleilDecal.set(-40, -12, 20);
    uFoule.uLum.value = 0.92;
  }
  uFoule.uLum.value = luxe ? 0.42 : cyber ? 0.5 : nuit ? 0.7 : 1;
  if (plage && nuit) {
    // LA PLAGE DE NUIT : la lune au-dessus de la mer, une ambiance bleue, les torches (plage-3d.ts)
    // la lumiere qui porte les ombres vient de la mer, des yachts : chaude ; la lune ne fait que l'ambiance
    hemi.color.set(0x5a6a9a); hemi.groundColor.set(0x3a3024); hemi.intensity = 0.7;
    soleil.color.set(0xffc890); soleil.intensity = 1.6;
    // a Menole, pas de yachts : la lumiere qui porte les ombres est celle de la lune
    if (menole) { soleil.color.set(0xb8c8ff); soleil.intensity = 1.2; }
  }
  uLisere.value = luxe || cyber ? 1 : 0;
  uLisereCoul.value.set(cyber ? 0x30e8ff : 0xffc76b);
  // au Stade Neon, le lisere reste un fil (« les neons sur les personnages sont trop forts,
  // un jeu de lumiere qui fait qu'on les voit clairement », 22/10) : la lumiere de face fait le reste
  uLisereForce.value = cyber ? 0.22 : 0.45;   // Stade d'Or : moitie moins (« reduis la lumiere qui emane du joueur », 22/10)
  uLisereFace.value = cyber ? 1 : 0;   // le Stade d'Or garde le reglage valide
  if (plage && nuit) {
    // la plage de nuit : les yachts eclairent de la mer, les coureurs vus de la piste sont a
    // contre-jour — un liseré chaud (les bateaux) et la lumiere de face du Stade Neon
    uLisere.value = 1; uLisereCoul.value.set(0xffc890); uLisereForce.value = 0.35; uLisereFace.value = 1;
  }
  uFoule.uSiege.value.set(luxe ? 0x1a1714 : cyber ? 0x14121e : plage ? 0xec7860 : palais ? 0x8a0f1e : 0x2457b8);
  if (palais) {
    // la lumiere chaude des lustres, de haut ; une brume doree qui fond le fond de la galerie
    hemi.color.set(0xfff0d8); hemi.groundColor.set(0x9a7448); hemi.intensity = 1.2;
    soleil.color.set(0xffdcaa); soleil.intensity = 2.0; soleilDecal.set(-8, -10, 40);
    scene.background = new THREE.Color(0x2a1c12);
    scene.fog = new THREE.Fog(0xcaa878, 150, 560);
    uFoule.uLum.value = 0.95;
    uLisere.value = 1; uLisereCoul.value.set(0xffd890); uLisereForce.value = 0.22; uLisereFace.value = 0;
    if (!envPalais && renderer) envPalais = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  }
  if (plage) scene.fog = nuit ? new THREE.Fog(0x0c1530, 220, 1100) : new THREE.Fog(0xf3c9a2, 260, 1300);
  if (luxe) scene.fog = new THREE.Fog(c3(th.skyBot, [28, 21, 13]).getHex(), 70, 300);
  if (cyber) {
    // les couleurs du Stade Neon poussees (« accentue au niveau des couleurs », 22/10) : un ciel
    // magenta sur violet profond, une brume violette, des lumieres plus saturees
    scene.background = texteCanvas((c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#12042a'); g.addColorStop(0.6, '#3a0c5e'); g.addColorStop(1, '#a3168c');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 4, 256);
    scene.fog = new THREE.Fog(0x2c0a46, 50, 420);
  }
  hologrammes = [];
  pubAnim = [];
  if (videoPub) { videoPub.pause(); videoPub.removeAttribute('src'); videoPub.load(); videoPub = null; }
  if (pluie) { scene.remove(pluie); pluie.geometry.dispose(); pluie = null; }
  // L'ESPACE (Intergalactique, Arc-en-ciel) : pas de pelouse, la piste FLOTTE dans le vide
  // (decor-cosmos.js en 2D) — des etoiles et des nebuleuses tout autour ET en dessous, des
  // planetes loin sous la piste, une galaxie, ses bords en neon (« une atmosphere plus
  // cosmique, la piste qui flotte dans l'espace », l'auteur, 22/10).
  const espace = !!th.espace;
  voute = null; filante = null;
  if (espace) espaceAutour(th, hasard);
  if (th.stars) {
    const n = Math.min(espace ? 4000 : 2500, th.stars * (espace ? 16 : 8)), pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = hasard() * Math.PI * 2, h = espace ? Math.asin(hasard() * 2 - 1) : 0.08 + hasard() * 0.9, r = 380;
      pts.set([44 + r * Math.cos(a) * Math.cos(h), -R_CORDE + r * Math.sin(a) * Math.cos(h), r * Math.sin(h)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    stade.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
  }
  if (!th.stars && !luxe && !cyber && !plage && !palais && !nuit) {
    // Des sprites loin autour du stade, comme a la plage : des plaques fixes a 300 m se
    // voyaient de biais et de pres pendant le survol — des taches blanches coupees net.
    // Les bouffees restent dans la toile (x 0,2-0,8, rayon <= 0,34 h) : aucun bord droit.
    const nuages = [0, 1, 2].map(() => texteCanvas((c, w, h) => {
      for (let i = 0; i < 22; i++) {
        const x = w * (0.2 + 0.6 * hasard()), y = h * (0.38 + 0.24 * hasard()), r = h * (0.12 + 0.22 * hasard());
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }
    }, 256, 128));
    for (let i = 0; i < 16; i++) {
      const a = hasard() * Math.PI * 2, d = 480 + hasard() * 260, lg = 140 + hasard() * 180;
      const n = new THREE.Sprite(new THREE.SpriteMaterial({ map: nuages[i % 3], transparent: true, depthWrite: false, fog: false }));
      n.position.set(44 + Math.cos(a) * d, -R_CORDE + Math.sin(a) * d, 90 + hasard() * 120);
      n.scale.set(lg, lg * (0.3 + hasard() * 0.15), 1);
      stade.add(n);
    }
  }

  ruelle = null;
  if (th.ruelle) {
    // LA NUIT DU MOLOSSE : la ruelle des Tanneurs a la place du stade, sur toute la
    // longueur de la nuit (ruelle-3d.ts). Une lune froide, une ambiance violette, les
    // reverberes font le reste ; les coureurs gardent un liseré chaud pour se detacher.
    hemi.color.set(0x4a3a72); hemi.groundColor.set(0x16101e); hemi.intensity = 0.55;
    soleil.color.set(0xb4c4ff); soleil.intensity = 1.1;
    soleilDecal.set(-6, 14, 30);
    scene.fog = new THREE.Fog(c3(th.skyBot, [46, 24, 58]).getHex(), 30, 150);
    uLisere.value = 1; uLisereCoul.value.set(0xffa860); uLisereForce.value = 0.3; uLisereFace.value = 1;
    ruelle = construireRuelle({ stade: stade!, T, W, R1: R_CORDE, ici, th, hasard, piece: pieceDuStade });
    return;
  }

  // LA PELOUSE et sa tonte en bandes
  const herbe = th.grass || [29, 115, 17], bord = th.grassEdge || [18, 91, 9];
  const tonte = texteCanvas((c, w, h) => {
    for (let i = 0; i < 8; i++) { c.fillStyle = css(herbe, i % 2 ? 0.88 : 1.06); c.fillRect(i * w / 8, 0, w / 8, h); }
  }, 256, 8);
  tonte.wrapS = THREE.RepeatWrapping; tonte.repeat.set(10, 1);
  // (au Champ-de-Mars, le parc s'etend jusqu'aux facades)
  if (cdm) tonte.repeat.set(30, 1);
  if (!espace && !plage && !palais) plan(cdm ? 1200 : 400, cdm ? 1200 : 400, new THREE.MeshLambertMaterial({ map: tonte }), 44, -R_CORDE, -0.1);

  // LA PISTE : les deux lignes droites et les deux virages, couloir par couloir
  const A = th.trackA || [148, 0, 0], B = th.trackB || A;
  // la piste du luxe est une laque : elle prend un reflet des projecteurs
  // ... et celle du Stade Neon, une chaussee mouillee qui renvoie les neons
  // ... et celle du palais, un cristal poli : reflet de la salle, une lueur bleutee
  const brillant = (c: THREE.Color) => palais ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.12, metalness: 0.2,
      envMap: envPalais, envMapIntensity: 0.7, emissive: c, emissiveIntensity: 0.08 }) : cyber ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.16, metalness: 0.35 })
    : luxe ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.32, metalness: 0.1 }) : new THREE.MeshLambertMaterial({ color: c });
  const matA = brillant(c3(A, A)), matB = brillant(c3(B, B));
  const ligne = new THREE.MeshBasicMaterial({ color: c3(th.lane, [247, 242, 233]) });
  const LD = DROITE1 - DROITE0, XD = (DROITE0 + DROITE1) / 2;
  const yOppose = -2 * R_CORDE - W;          // la ligne opposee, de l'autre cote de la pelouse
  // UNE PISTE PEINTE (arc-en-ciel, Champ-de-Mars) : une bande par couloir, en couleurs de sommet,
  // sur les deux lignes droites et les deux virages — la couleur suit le couloir (arc-en-ciel)
  // ou l'avancement de la course (le drapeau du Champ-de-Mars : bleu, perle, rouge)
  const peinte = !!arc || cdm;
  if (peinte) {
    const echant: number[][] = [];
    for (let d = 0; d <= T.total; d += 1) { const p = ici(T.pos(d, nCouloirs >> 1)); echant.push([p[0], p[1], d / T.total]); }
    const avance = (x: number, y: number) => {
      let best = Infinity, t = 0;
      for (const e of echant) { const q = (e[0] - x) ** 2 + (e[1] - y) ** 2; if (q < best) { best = q; t = e[2]; } }
      return t;
    };
    // les memes arrets qu'en 2D : le bleu tient le premier tiers, le rouge le dernier
    const ARRETS = [[0, 0], [0.30, 0], [0.47, 1], [0.53, 1], [0.70, 2], [1, 2]];
    const tricolore = (pal: number[][], t: number) => {
      for (let k = 1; k < ARRETS.length; k++) {
        const [t1, c1] = ARRETS[k], [t0, c0] = ARRETS[k - 1];
        if (t <= t1) { const u = (t - t0) / Math.max(1e-6, t1 - t0), e = u * u * (3 - 2 * u); return pal[c0].map((v, i) => v + (pal[c1][i] - v) * e); }
      }
      return pal[2];
    };
    const bande = (r0: number, r1: number, z: number, teinte: (x: number, y: number) => number[], mat: THREE.Material) => {
      const pos: number[] = [], col: number[] = [], c = new THREE.Color();
      const quad = (a: number[], b: number[], cc: number[], d: number[]) => {
        for (const p of [a, b, cc, a, cc, d]) {
          pos.push(p[0], p[1], z);
          const v = teinte(p[0], p[1]); c.setRGB(v[0] / 255, v[1] / 255, v[2] / 255, THREE.SRGBColorSpace); col.push(c.r, c.g, c.b);
        }
      };
      for (let x = DROITE0; x < DROITE1 - 1e-6; x += 1) {
        const x2 = Math.min(DROITE1, x + 1);
        quad([x, r0 - R_CORDE], [x2, r0 - R_CORDE], [x2, r1 - R_CORDE], [x, r1 - R_CORDE]);
        quad([x, -R_CORDE - r1], [x2, -R_CORDE - r1], [x2, -R_CORDE - r0], [x, -R_CORDE - r0]);
      }
      for (const [xc, a0] of [[DROITE1, -Math.PI / 2], [DROITE0, Math.PI / 2]] as const) for (let i = 0; i < 64; i++) {
        const a = a0 + (i / 64) * Math.PI, b = a0 + ((i + 1) / 64) * Math.PI;
        const P = (r: number, t: number) => [xc + r * Math.cos(t), -R_CORDE + r * Math.sin(t)];
        quad(P(r0, a), P(r0, b), P(r1, b), P(r1, a));
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; stade!.add(m);
    };
    const PISTE = [BLEU, BLANC, ROUGE], LIGNE = [[255, 255, 255], [22, 40, 96], [255, 255, 255]];
    // sans eclairage a l'arc-en-ciel : « une piste de lumiere n'a pas de gris »
    const matP = arc ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    for (let k = 0; k < nCouloirs; k++) {
      const r0 = R_CORDE + k * LANE_W - (k === 0 ? 0.8 : 0), r1 = R_CORDE + (k + 1) * LANE_W + (k === nCouloirs - 1 ? 0.8 : 0);
      bande(r0, r1, 0, arc ? () => arc[k % arc.length] : (x, y) => tricolore(PISTE, avance(x, y)), matP);
    }
    if (cdm) for (let k = 0; k <= nCouloirs; k++) {
      const r = R_CORDE + k * LANE_W, e = k === 0 || k === nCouloirs ? 0.05 : 0.03;
      bande(r - e, r + e, 0.002, (x, y) => tricolore(LIGNE, avance(x, y)), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    }
  }
  for (const y0 of peinte ? [] : [0, yOppose]) {
    plan(LD, W + 1.6, matA, XD, y0 + W / 2, 0);
    for (let k = 1; k < nCouloirs; k += 2) plan(LD, LANE_W, matB, XD, y0 + (k + 0.5) * LANE_W, 0.001);
    for (let k = 0; k <= nCouloirs; k++) plan(LD, 0.05, ligne, XD, y0 + k * LANE_W, 0.002);
  }
  if (arc) for (const y0 of [0, yOppose]) for (let k = 0; k <= nCouloirs; k++) plan(LD, 0.05, ligne, XD, y0 + k * LANE_W, 0.002);
  // les virages : des anneaux autour des deux centres, sur la pelouse
  for (const [xc, debut] of [[DROITE1, -Math.PI / 2], [DROITE0, Math.PI / 2]] as const) {
    const anneau = (r0: number, r1: number, mat: THREE.Material, z: number) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 64, 1, debut, Math.PI), mat);
      m.position.set(xc, -R_CORDE, z); m.receiveShadow = true; stade!.add(m);
    };
    if (!peinte) anneau(R_CORDE - 0.8, R_CORDE + W + 0.8, matA, 0);
    for (let k = 1; !peinte && k < nCouloirs; k += 2) anneau(R_CORDE + k * LANE_W, R_CORDE + (k + 1) * LANE_W, matB, 0.001);
    for (let k = 0; !cdm && k <= nCouloirs; k++) anneau(R_CORDE + k * LANE_W - 0.025, R_CORDE + k * LANE_W + 0.025, ligne, 0.002);
  }
  // LES BORDS EN NEON (th.neon, th.neonExt) : une surface qui flotte dans le noir doit
  // avoir une limite qui se voie. Un trait vif et deux halos additifs de chaque cote.
  if (th.neon) {
    for (const [e, col] of [[0, th.neon], [nCouloirs, th.neonExt || th.neon]] as const) {
      const r = R_CORDE + (e as number) * LANE_W;
      for (const [demi, op] of [[0.05, 1], [0.18, 0.45], [0.42, 0.18], [0.8, 0.07]]) {
        const m = new THREE.MeshBasicMaterial({ color: c3(col as number[], [96, 226, 255]), transparent: op < 1, opacity: op,
          blending: op < 1 ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false });
        for (const y0 of [0, yOppose]) plan(LD, demi * 2, m, XD, y0 + (e as number) * LANE_W, 0.004).receiveShadow = false;
        for (const [xc, debut] of [[DROITE1, -Math.PI / 2], [DROITE0, Math.PI / 2]] as const) {
          const g = new THREE.Mesh(new THREE.RingGeometry(r - demi, r + demi, 96, 1, debut, Math.PI), m);
          g.position.set(xc, -R_CORDE, 0.004); stade.add(g);
        }
      }
    }
  }
  if (espace && !arc) planetesSousLaPiste(T, hasard);
  if (arc) {
    // LES GUIRLANDES : une ampoule tous les 1,5 m sur les deux bords, les couleurs qui
    // defilent (sept decalages par seconde, piste-arc-en-ciel.js)
    const pts: number[] = [];
    for (const r of [R_CORDE - 0.12, R_CORDE + W + 0.12]) {
      const S = DROITE1 - DROITE0, L = 2 * S + 2 * Math.PI * r, n = Math.round(L / 1.5);
      for (let i = 0; i < n; i++) {
        let s = (i / n) * L, x: number, y: number;
        if (s < S) { x = DROITE0 + s; y = r - R_CORDE; }
        else if ((s -= S) < Math.PI * r) { const a = Math.PI / 2 - s / r; x = DROITE1 + r * Math.cos(a); y = -R_CORDE + r * Math.sin(a); }
        else if ((s -= Math.PI * r) < S) { x = DROITE1 - s; y = -R_CORDE - r; }
        else { s -= S; const a = -Math.PI / 2 - s / r; x = DROITE0 + r * Math.cos(a); y = -R_CORDE + r * Math.sin(a); }
        pts.push(x, y, 0.12);
      }
    }
    const g = new THREE.BufferGeometry(), n = pts.length / 3, cols = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const ampoule = texteCanvas((c, w, h) => {
      const r = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,255,255,0.9)'); r.addColorStop(0.45, 'rgba(255,255,255,0.3)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = r; c.fillRect(0, 0, w, h);
    }, 64, 64);
    stade.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, map: ampoule, vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending })));
    const teintes = arc.map(v => new THREE.Color().setRGB(v[0] / 255, v[1] / 255, v[2] / 255, THREE.SRGBColorSpace));
    let decale = -1;
    pubAnim.push(t => {
      const d = Math.floor(t * 7);
      if (d === decale) return;
      decale = d;
      for (let i = 0; i < n; i++) { const c = teintes[(i + d) % teintes.length]; cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
      g.attributes.color.needsUpdate = true;
    });
    // ET L'ARC-EN-CIEL LUI-MEME, immense, derriere le stade : un pont de lumiere dans le vide
    for (let k = 0; k < 7; k++) {
      const v = arc[k], r0 = 300 - k * 9;
      const m = new THREE.Mesh(new THREE.RingGeometry(r0 - 9, r0, 128, 1, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(v[0] / 255, v[1] / 255, v[2] / 255, THREE.SRGBColorSpace),
          transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      m.position.set(44, W + 520, -60); m.rotation.x = Math.PI / 2;
      stade.add(m);
    }
  }

  const damier = texteCanvas((c, w, h) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 40; j++) {
      c.fillStyle = (i + j) % 2 ? '#111' : luxe ? '#d8b46a' : cyber ? '#ffe11a' : '#f4f4f4'; c.fillRect(i * w / 4, j * h / 40, w / 4, h / 40);
    }
  }, 64, 640);
  plan(0.5, W, new THREE.MeshBasicMaterial({ map: damier }), 100.25, W / 2, 0.003);
  // LE DEPART, couloir par couloir : en ligne au 100 m, en quinconce dans le virage sinon
  const UP0 = new THREE.Vector3(0, 0, 1);
  const departs: [THREE.Matrix4, number, number][] = [];
  for (let k = 0; k < nCouloirs; k++) {
    const p = ici(T.pos(0, k)), a = capIci(T.heading(0, k));
    // le coureur court sur la ligne de mesure, pres du bord interieur : le milieu du couloir est plus loin
    const mil = T.curved ? LANE_W / 2 - (k ? C.MES_N : C.MES_1) : 0;
    departs.push([new THREE.Matrix4().makeRotationAxis(UP0, a).setPosition(p[0], p[1], 0), a, mil]);
  }
  for (let k = 0; k < nCouloirs; k++) {
    const [Md, a, mil] = departs[k];
    const q = new THREE.Vector3(0, mil, 0).applyMatrix4(Md);
    const l = plan(0.05, LANE_W, ligne, q.x, q.y, 0.003);
    l.rotation.z = a;
    const t = texteCanvas((c, w, h) => {
      c.fillStyle = css(th.lane || [247, 242, 233]); c.font = `900 ${h * 0.9}px system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(k + 1), w / 2, h / 2 + h * 0.04);
    }, 128, 128);
    const qn = new THREE.Vector3(-2.2, mil, 0).applyMatrix4(Md);
    const m = plan(1.0, 1.0, new THREE.MeshBasicMaterial({ map: t, transparent: true }), qn.x, qn.y, 0.004);
    m.rotation.z = a - Math.PI / 2;
    m.scale.x = -1;   // le monde est en miroir (voir initialiser) : le chiffre, lui, se lit a l'endroit
  }

  // LES LOTS : tout ce qui se repete
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const lMarche = new Lot(cube, new THREE.MeshLambertMaterial({ color: c3(th.tread, [175, 177, 187]) }));
  const lContre = new Lot(cube, new THREE.MeshLambertMaterial({ color: c3(th.riser, [130, 135, 150]) }));
  const lSiege = new Lot(new THREE.BoxGeometry(0.46, 0.38, 0.34), new THREE.MeshLambertMaterial({ color: uFoule.uSiege.value }));
  const lToit = new Lot(cube, new THREE.MeshLambertMaterial({ color: c3(th.roof, [76, 81, 100]) }), true);
  const lBeton = new Lot(cube, new THREE.MeshLambertMaterial({ color: 0xc9c6c0 }));
  const lBlanc = new Lot(cube, new THREE.MeshLambertMaterial({ color: c3(th.barrier, [231, 234, 239]) }));
  const lVitre = new Lot(cube, new THREE.MeshLambertMaterial(luxe ? { color: 0x2a2014, emissive: 0x4a3410 }
    : cyber ? { color: 0x1a0a2a, emissive: 0xb02ad8 } : { color: 0x9fc4dc, emissive: 0x1a2a38 }));
  const OR = new THREE.Color(0xc9a45c);
  const lMetal = new Lot(new THREE.CylinderGeometry(0.5, 0.5, 1, 10), cyber
    ? new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.4, metalness: 0.5 }) : luxe
    // satine, pas miroir : sans ciel a refleter, un metal pur sortait noir (pylones en triangles noirs)
    ? new THREE.MeshStandardMaterial({ color: OR, roughness: 0.45, metalness: 0.3, emissive: 0x5a3e14 })
    : new THREE.MeshLambertMaterial({ color: 0xd8dbe2 }), true);
  // les filets d'or (nez des gradins, muret) : sans lumiere propre, ils brillent dans le noir
  const lFilet = new Lot(cube, new THREE.MeshBasicMaterial({ color: new THREE.Color(cyber ? 0x00e5ff : 0xe2bd6e) }));
  const lFilet2 = new Lot(cube, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2bd6) }));   // le magenta du Stade Neon
  const lBloc = new Lot(cube, new THREE.MeshLambertMaterial({ color: 0x8b9099 }));
  const lTronc = new Lot(new THREE.CylinderGeometry(0.22, 0.3, 1, 7), new THREE.MeshLambertMaterial({ color: 0x5b4030 }));
  const lFeuille = new Lot(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: c3(th.feuillage, [38, 111, 31]) }), true);
  const lo = th.crowdLo || [43, 38, 56], hi = th.crowdHi || [252, 242, 230];
  // au luxe, le public est en tenue de soiree : surtout du noir, un peu de creme, d'or, de bordeaux
  const maillots: number[][] = cyber
    ? [[10, 10, 16], [18, 16, 26], [26, 20, 40], [10, 40, 50], [40, 10, 36], [10, 10, 16], [0, 200, 230], [230, 40, 190]]
    : luxe
    ? [[14, 13, 15], [20, 19, 22], [28, 25, 24], [38, 32, 28], [14, 13, 15], [201, 164, 92], [217, 207, 189], [74, 20, 24]]
    : [...(th.panels || [[231, 60, 45], [28, 106, 202], [255, 203, 55], [50, 162, 121]]), lo, hi, [240, 240, 240]];
  // HUIT TEINTES DE PEAU, LA MOITIE NOIRES ET BRUNES (« il n'y a pas de personnes noires ? »,
  // l'auteur, 22/10) : a deux sur cinq, sur des visages de quelques pixels, elles ne se voyaient pas
  const peaux = [[44, 28, 20], [66, 42, 30], [92, 58, 38], [120, 76, 50], [160, 108, 70], [196, 142, 98],
    [224, 186, 142], [246, 220, 190]].map(couleur);
  const coulMaillots = maillots.map(couleur);
  const coulCheveux = [[28, 20, 16], [58, 38, 24], [104, 70, 40], [196, 160, 98], [140, 136, 132]].map(couleur);
  const coulPantalons = [[30, 38, 68], [24, 24, 28], [58, 84, 128], [196, 178, 142], [96, 98, 104]].map(couleur);
  const cartes: number[] = [];
  const _p = new THREE.Vector3(), _f = new THREE.Vector3();
  const choix = (t: THREE.Color[]) => t[(hasard() * t.length) | 0];
  const UP = new THREE.Vector3(0, 0, 1);
  const repere = (x: number, y: number, a: number) => new THREE.Matrix4().makeRotationAxis(UP, a).setPosition(x, y, 0);

  /**
   * Un spectateur au point local (x, y, z) du repere M, tourne vers -y (la piste) :
   * une carte du public (voir LE PUBLIC, EN CARTES). `pied` : debout, bras le long
   * du corps et sans siege (officiels, photographes) ; `face` force son cap.
   */
  const spectateur = (M: THREE.Matrix4, x: number, y: number, z: number, pied: boolean | number = false, face?: number) => {
    _p.set(x, y, z).applyMatrix4(M);
    if (face === undefined) { _f.set(0, -1, 0).transformDirection(M); face = Math.atan2(_f.y, _f.x); }
    // `pied` : vrai pour un officiel debout (3), ou le geste lui-meme (4 : photographe)
    const u = hasard(), geste = typeof pied === 'number' ? pied : pied ? 3 : u < 0.6 ? 0 : u < 0.85 ? 1 : 2;
    cartes.push(_p.x, _p.y, _p.z, face, ((hasard() * P_SIL) | 0) * P_GESTES + geste, hasard());
    for (const c of [choix(peaux), choix(coulMaillots), choix(coulCheveux), choix(coulPantalons)]) cartes.push(c.r, c.g, c.b);
  };

  /**
   * DES GRADINS dans le repere local M : x le long de la tribune (0 -> L),
   * y en s'eloignant de la piste, z en haut. Rend la hauteur atteinte.
   */
  // L'AFFLUENCE SUIT L'ENVERGURE DE L'EPREUVE (fouleDe, sprinter-app.js : un quart des
  // places au scolaire, tout le stade a l'Intergalactique ; « trop de monde pour une
  // competition scolaire », l'auteur, 22/10). Un stade a moitie vide se remplit par le
  // bas : on s'assoit pres de la piste, les derniers rangs restent clairsemes.
  const occupe = (r: number, rangs: number) =>
    0.95 * Math.min(1, Math.max(0.03, affluence * 1.6 - (r / rangs) * 1.6 * (1 - affluence)));
  const gradins = (M: THREE.Matrix4, L: number, rangs: number, y0: number, z0: number, prof = 0.85, monte = 0.42) => {
    const pas = 0.55, n = Math.max(1, Math.floor(L / pas));
    for (let r = 0; r < rangs; r++) {
      const y = y0 + r * prof, z = z0 + r * monte;
      boite(lMarche, M, L / 2, y + prof / 2, z - 0.04, L, prof, 0.08);
      if (luxe || cyber) boite(cyber && r % 2 ? lFilet2 : lFilet, M, L / 2, y + 0.02, z + 0.005, L, 0.04, 0.02);
      boite(lContre, M, L / 2, y + prof, z + monte / 2, L, 0.06, monte);
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * (L / n);
        // la carte porte son siege ; un siege vide reste un siege
        if (atlasPublic && hasard() < occupe(r, rangs) * PUBLIC) spectateur(M, x, y + prof * 0.55, z);
        else boite(lSiege, M, x, y + prof * 0.55, z + 0.19, 1, 1, 1);
      }
    }
    // le dessous, plein : on ne voit pas le jour entre les marches
    boite(lBeton, M, L / 2, y0 + rangs * prof / 2, z0 / 2 - 0.1, L, rangs * prof, z0);
    return z0 + rangs * monte;
  };

  // LA TRIBUNE PRINCIPALE, le long de la ligne droite, en face de la camera
  // ELLE S'ARRETE OU COMMENCENT LES VIRAGES : elle debordait de quatre metres de chaque
  // cote et s'enfoncait dans les tribunes des virages (« pas de chevauchement », 22/10)
  const yS = W + 3.2, XA = DROITE0, LS = DROITE1 - DROITE0;
  const Mp = repere(XA, yS, 0);
  let z1 = 0, yLoges = 0, z2 = 0, yFond = 0;
  const rS = R_CORDE + W + 3.2;
  if (cdm) {
    // LA TRIBUNE PROVISOIRE du Champ-de-Mars : un gradin, sans toit, qui s'arrete a l'arrivee —
    // assez pour porter le public et ses drapeaux, trop basse pour cacher le parc
    boite(lBlanc, Mp, LS / 2, -0.15, 0.6, LS, 0.25, 1.2);
    z1 = z2 = gradins(Mp, LS, 7, 0.4, 1.2);
    yFond = 0.4 + 7 * 0.85;
    boite(lBlanc, Mp, LS / 2, yFond + 0.05, z2 + 0.5, LS, 0.08, 1.0);        // la rambarde du haut
  } else if (!plage && !palais) {                // la plage et le palais n'ont pas de gradins
  boite(lBlanc, Mp, LS / 2, -0.15, 0.6, LS, 0.25, 1.2);                       // le muret
  if (luxe || cyber) boite(cyber ? lFilet2 : lFilet, Mp, LS / 2, -0.15, 1.22, LS, 0.27, 0.04);
  z1 = gradins(Mp, LS, 13, 0.4, 1.2);
  yLoges = 0.4 + 13 * 0.85;
  boite(lBeton, Mp, LS / 2, yLoges + 1.2, z1 + 0.3, LS, 2.4, 0.6);
  boite(lVitre, Mp, LS / 2, yLoges + 1.9, z1 + 1.9, LS, 0.2, 2.6);           // les loges vitrees
  boite(lBeton, Mp, LS / 2, yLoges + 1.2, z1 + 3.3, LS, 2.6, 0.3);
  z2 = gradins(Mp, LS, 15, yLoges + 2.6, z1 + 3.6, 0.85, 0.5);
  yFond = yLoges + 2.6 + 15 * 0.85;
  if (cyber) {
    // a ciel ouvert sur la ville : un dernier filet de neon en haut des gradins
    boite(lFilet, Mp, LS / 2, yFond, z2 + 0.05, LS, 0.08, 0.08);
  } else {
    boite(lToit, Mp, LS / 2, yFond + 0.2, (z2 + 3.4) / 2, LS, 0.4, z2 + 3.4);  // la facade
    boite(lToit, Mp, LS / 2, yFond - 9, z2 + 3.4, LS + 2, 20, 0.35);          // le toit en porte-a-faux
    if (luxe) boite(lFilet, Mp, LS / 2, yFond - 19, z2 + 3.4, LS + 2, 0.12, 0.4);
    for (let x = 0; x <= LS; x += 14) boite(lMetal, Mp, x, yFond - 1, z2 + 2, 0.35, 0.35, 3.0);
  }

  // LES TRIBUNES DES VIRAGES ET DE LA LIGNE OPPOSEE, plus basses, en segments
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
      if (!cyber) boite(lToit, M, L / 2, 0.4 + 16 * 0.85 + 0.2, (z + 2) / 2, L, 0.4, z + 2);
      if (luxe) boite(lFilet, M, L / 2, 0.4 + 16 * 0.85, z + 2, L, 0.1, 0.1);
      if (cyber) boite(lFilet, M, L / 2, 0.4 + 16 * 0.85, z + 0.05, L, 0.08, 0.08);
    }
  }
  const Mo = repere(DROITE1, yOppose - 3.2, Math.PI);                        // ligne opposee
  boite(lBlanc, Mo, LS / 2, -0.15, 0.6, LS, 0.25, 1.2);
  const zo = gradins(Mo, LS, 16, 0.4, 1.2);
  if (!cyber) boite(lToit, Mo, LS / 2, 0.4 + 16 * 0.85 + 0.2, (zo + 2) / 2, LS, 0.4, zo + 2);
  if (luxe) boite(lFilet, Mo, LS / 2, 0.4 + 16 * 0.85, zo + 2, LS, 0.1, 0.1);
  if (cyber) boite(lFilet, Mo, LS / 2, 0.4 + 16 * 0.85, zo + 0.05, LS, 0.08, 0.08);
  }

  // LES PANNEAUX LED, au bord de la piste, devant la tribune principale — animes (« exploiter
  // les panneaux publicitaires : videos de promotion, logos animes », 22/10). Une toile
  // redessinee enchaine, six secondes chacun : le logo balaye d'un reflet, le logo qui
  // defile, une accroche. Le film, lui, passe sur l'ecran geant (un panneau d'un metre de
  // haut n'en montrerait qu'une vignette).
  const logoPub = new Image(); logoPub.src = base + 'pubs/benbezi-logo-3d-cadre.webp';
  const toileLed = document.createElement('canvas'); toileLed.width = 512; toileLed.height = 106;
  const cl = toileLed.getContext('2d')!;
  const pub = new THREE.CanvasTexture(toileLed);
  pub.colorSpace = THREE.SRGBColorSpace; pub.wrapS = THREE.RepeatWrapping; pub.repeat.set(LS / 5, 1);
  const pubHaut = pub.clone(); pubHaut.repeat.set(LS / 3.4, 1);
  const accent = css(th.accent || [255, 122, 26]);
  const accroches = ['SPRINTER', 'DÉFIE TES AMIS', (T.fullLap ? '400' : T.curved ? '200' : '100') + ' M EN DIRECT', 'BENBEZI'];
  let imageLed = -1;
  pubAnim.push(t => {
    const img = Math.floor(t * 20);          // 20 images/s suffisent a un panneau
    if (img === imageLed) return;
    imageLed = img;
    const w = 512, h = 106, n = Math.floor(t / 6), u = (t % 6) / 6, sorte = n % 3;
    cl.globalCompositeOperation = 'source-over';
    cl.fillStyle = '#050608'; cl.fillRect(0, 0, w, h);
    if (sorte < 2 && logoPub.complete && logoPub.naturalWidth) {
      if (sorte === 0) {
        cl.drawImage(logoPub, 0, 0, w, h);
        // le reflet qui traverse le panneau
        const x = (u * 1.8 - 0.4) * w, g = cl.createLinearGradient(x - 60, 0, x + 60, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        cl.globalCompositeOperation = 'lighter'; cl.fillStyle = g; cl.fillRect(0, 0, w, h);
      } else {
        const x = -((u * 3) % 1) * w;
        cl.drawImage(logoPub, x, 0, w, h); cl.drawImage(logoPub, x + w, 0, w, h);
      }
    } else {
      // l'accroche entre en grandissant, respire, puis s'eteint
      const k = Math.min(1, u * 6), f = Math.min(1, (1 - u) * 8);
      cl.globalAlpha = f;
      cl.fillStyle = accent; cl.textAlign = 'center'; cl.textBaseline = 'middle';
      const mot = accroches[Math.floor(n / 3) % accroches.length];
      let px = h * (0.42 + 0.12 * k + 0.02 * Math.sin(t * 6));
      cl.font = `900 ${Math.round(px)}px system-ui, sans-serif`;
      const lg = cl.measureText(mot).width;
      if (lg > w * 0.9) { px *= w * 0.9 / lg; cl.font = `900 ${Math.round(px)}px system-ui, sans-serif`; }   // tient dans le panneau
      cl.fillText(mot, w / 2, h / 2 + 2);
      cl.globalAlpha = 1;
    }
    if (cyber && Math.random() < 0.18) {
      // le panneau du Stade Neon gresille : des tranches decalees, une frange magenta
      for (let k = 0; k < 3; k++) {
        const y = (Math.random() * (h - 12)) | 0, hh = 4 + ((Math.random() * 10) | 0);
        cl.drawImage(toileLed, 0, y, w, hh, (Math.random() - 0.5) * 40, y, w, hh);
      }
      cl.globalCompositeOperation = 'lighter'; cl.fillStyle = 'rgba(255,43,214,0.25)'; cl.fillRect(0, 0, w, h);
      cl.globalCompositeOperation = 'source-over';
    }
    pub.needsUpdate = true; pubHaut.needsUpdate = true;
  });
  const panneau = new THREE.Mesh(new THREE.PlaneGeometry(LS, 1.03), new THREE.MeshBasicMaterial({ map: pub }));
  panneau.position.set(XA + LS / 2, W + 1.7, 0.55); panneau.rotation.x = Math.PI / 2; panneau.scale.x = -1;  // (monde en miroir)
  stade.add(panneau);
  boite(lBloc, repere(0, 0, 0), XA + LS / 2, W + 1.78, 0.55, LS, 0.12, 1.1);
  // ... et le bandeau entre les deux etages (pas a la plage : pas de tribune)
  if (!plage && !palais && !cdm) {
  const bandeau = new THREE.Mesh(new THREE.PlaneGeometry(LS, 0.7), new THREE.MeshBasicMaterial({ map: pubHaut }));
  bandeau.position.set(XA + LS / 2, yS + yLoges + 0.05, z1 + 0.3); bandeau.rotation.x = Math.PI / 2; bandeau.scale.x = -1;
  stade.add(bandeau);
  }

  // L'ECRAN GEANT, au-dessus du virage d'arrivee, tourne vers la ligne droite (pas a la plage)
  if (!plage && !palais && !cdm) {
  const ecran = texteCanvas((c, w, h) => {
    c.fillStyle = '#05070d'; c.fillRect(0, 0, w, h);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (cyber) {
      c.fillStyle = '#ff2bd6'; c.font = `900 ${h * 0.4}px ui-monospace, Menlo, monospace`;
      c.fillText('SPRINTER', w / 2, h * 0.42);
      c.font = `700 ${h * 0.14}px ui-monospace, Menlo, monospace`;
    } else if (luxe) {
      // la planche du style : un serif d'or en italique, un filet, des capitales espacees
      c.fillStyle = '#d8b46a'; c.font = `italic 500 ${h * 0.36}px Georgia, 'Times New Roman', serif`;
      c.fillText("Stade d'Or", w / 2, h * 0.42);
      c.fillRect(w * 0.38, h * 0.62, w * 0.24, 2);
      c.font = `400 ${h * 0.1}px Georgia, serif`;
    } else {
      c.fillStyle = '#ff7a1a'; c.font = `900 ${h * 0.42}px system-ui, sans-serif`;
      c.fillText('SPRINTER', w / 2, h * 0.42);
      c.font = `700 ${h * 0.16}px system-ui, sans-serif`;
    }
    c.fillStyle = luxe ? '#c9a45c' : cyber ? '#00e5ff' : '#e8ecf4';
    c.fillText((T.fullLap ? '400' : T.curved ? '200' : '100') + ' M  ·  LIVE', w / 2, h * 0.78);
  }, 512, 256);
  const xE = DROITE1 + rS + 22;
  const ec = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: ecran, fog: false }));
  ec.position.set(xE, -R_CORDE + 6, 22); ec.rotation.set(Math.PI / 2, -Math.PI / 2, 0); ec.scale.x = -1;
  stade.add(ec);
  // ... et le film de promotion (public/pubs/videos, tire du reel « course en direct »,
  // remonte en 2:1) : quinze secondes de film, six d'habillage du stade, en boucle
  const film = document.createElement('video');
  film.src = base + 'pubs/videos/sprinter-direct.mp4';
  film.muted = true; film.loop = true; film.playsInline = true; film.preload = 'auto'; film.setAttribute('playsinline', '');
  videoPub = film;
  const tFilm = new THREE.VideoTexture(film); tFilm.colorSpace = THREE.SRGBColorSpace;
  const matE = ec.material as THREE.MeshBasicMaterial;
  pubAnim.push(t => {
    if (film.paused) film.play().catch(() => {});
    matE.map = t % 21 < 15 && film.readyState >= 2 ? tFilm : ecran;
  });
  boite(lBloc, repere(0, 0, 0), xE + 0.4, -R_CORDE + 6, 22, 0.6, 17, 9);
  boite(lMetal, repere(0, 0, 0), xE + 0.6, -R_CORDE + 6, 9, 1.2, 1.2, 18);
  }

  // LES PYLONES D'ECLAIRAGE, aux quatre coins
  const lampes = texteCanvas((c, w, h) => {
    c.fillStyle = '#20242c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) {
      c.fillStyle = luxe ? '#ffe0a6' : '#fffbe8'; c.fillRect(4 + j * (w - 8) / 6, 4 + i * (h - 8) / 4, (w - 8) / 6 - 4, (h - 8) / 4 - 4);
    }
  }, 128, 96);
  const matLampes = new THREE.MeshBasicMaterial({ map: lampes });
  for (const [x, y] of cyber || plage || palais || cdm || espace ? [] : [[DROITE1 + 30, W + 34], [DROITE0 - 30, W + 34], [DROITE1 + 30, yOppose - 34], [DROITE0 - 30, yOppose - 34]]) {
    boite(lMetal, repere(0, 0, 0), x, y, 24, 1.4, 1.4, 48);
    const p = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 6), [matLampes, matLampes, matLampes, matLampes, matLampes, matLampes]);
    p.position.set(x, y, 49); p.lookAt(44, -R_CORDE, 0); stade.add(p);
  }

  // LES DRAPEAUX, sur la facade de la tribune principale
  const lDrap = cdm
    // au Champ-de-Mars, de grands pavillons tricolores hisses tous les seize metres
    ? [new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, map: texteCanvas((c, w, h) => {
        [BLEU, BLANC, ROUGE].forEach((v, i) => { c.fillStyle = css(v); c.fillRect(i * w / 3, 0, w / 3, h); }); }, 96, 64) })]
    : maillots.slice(0, 4).map(v => new THREE.MeshLambertMaterial({ color: couleur(v), side: THREE.DoubleSide }));
  for (let i = 0, x = 4; !plage && !palais && x < LS; x += cdm ? 16 : 9, i++) {
    boite(lMetal, Mp, x, yFond + 0.1, z2 + 5.4, 0.08, 0.08, 4);
    const d = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), lDrap[i % lDrap.length]);
    d.position.copy(new THREE.Vector3(x + 0.9, yFond + 0.1, z2 + 6.8).applyMatrix4(Mp));
    d.rotation.x = Math.PI / 2; d.rotation.y = 0.25 * Math.sin(i);
    stade.add(d);
  }

  // SUR LA PISTE : les blocs, le portique du chrono, officiels et photographes
  const M0 = repere(0, 0, 0);
  // les blocs du jeu, la ou pose() met chaque coureur au coup de feu (voir drawBlocs)
  if (blocLots) for (const { geo, mat } of blocLots) {
    const l = new Lot(geo, mat, true);
    for (const [Md] of departs) l.poser(Md);
    l.finir(stade);
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
  if (atlasPublic) {
    // tournes vers la piste (+y) : officiels a l'arrivee, commissaires
    for (let i = 0; i < 6; i++) spectateur(M0, 101 + i * 0.7, -1.6 - (i % 2) * 0.6, 0, true, Math.PI / 2);
    // pas de photographes (l'auteur, 22/10 : « retire les photographes »)
    for (let i = 0; i < 4; i++) spectateur(M0, 30 + i * 18, -1.8, 0, true, Math.PI / 2);
  }

  // LES NAPPES DE LUMIERE, au luxe : sous chaque projecteur, une flaque doree sur la
  // laque — peinte (un degrade radial en addition) plutot qu'eclairee : une lumiere de
  // plus couterait sur chaque pixel du plus faible des telephones.
  if (luxe) {
    const nappe = texteCanvas((c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,196,110,0.9)'); g.addColorStop(0.45, 'rgba(230,150,60,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 256, 256);
    // le faisceau : vif a la rampe (haut de la toile = sommet du cone), eteint au sol
    const faisceau = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide, opacity: 0.1, map: texteCanvas((c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, 'rgba(255,214,140,1)'); g.addColorStop(0.5, 'rgba(230,160,70,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }, 4, 128) });
    const mat = new THREE.MeshBasicMaterial({ map: nappe, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 });
    for (let x = DROITE0 + 8; x < DROITE1 + 10; x += 24) {
      const m = plan(34, W + 10, mat, x, W / 2, 0.008);
      m.receiveShadow = false;
    }
    // LES QUATRE PROJECTEURS eclairent tout le stade (« utilise la lumiere des projecteurs
    // sans perdre l'aspect luxueux, sublime-le », 22/10) : vu du ciel, seule la ligne
    // d'arrivee sortait du noir. Toujours peint en addition (aucune lumiere de plus) :
    // une large nappe par pylone sur la pelouse et les virages, un halo sur chaque
    // rampe, un faisceau d'or tres leger jusqu'au sol.
    const large = new THREE.MeshBasicMaterial({ map: nappe, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      opacity: 0.45, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const xc = 44, yc = -R_CORDE;
    for (const [x, y] of [[DROITE1 + 30, W + 34], [DROITE0 - 30, W + 34], [DROITE1 + 30, yOppose - 34], [DROITE0 - 30, yOppose - 34]]) {
      const cx = x + (xc - x) * 0.55, cy = y + (yc - y) * 0.55;
      const m = plan(150, 110, large, cx, cy, 0.02);
      m.rotation.z = Math.atan2(yc - y, xc - x); m.receiveShadow = false;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: nappe, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.9 }));
      halo.position.set(x, y, 49); halo.scale.set(22, 22, 1);
      stade.add(halo);
      const bout = new THREE.Vector3(x, y, 48), sol = new THREE.Vector3(cx, cy, 0);
      const long = bout.distanceTo(sol);
      const f = new THREE.Mesh(new THREE.ConeGeometry(20, long, 32, 1, true), faisceau);
      f.position.copy(bout).add(sol).multiplyScalar(0.5);
      f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bout.clone().sub(sol).normalize());
      stade.add(f);
    }
  }

  // LE STADE DE NUIT AUX PROJECTEURS (Danube) : ce qui le fait en 2D (drawProjecteurs, nappes de
  // rendu-premium.js), c'est la lumiere — une rangee de lampes tres blanches sous la rive du toit,
  // des nappes de lumiere sur la piste tous les seize metres, cote exterieur (le couloir 1 reste
  // plus sombre), et le halo des panneaux LED au sol. Tout peint en addition, aucune lumiere de plus.
  if (nuit && th.projecteurs && !luxe && !cyber && !plage && !palais && !cdm && !espace) {
    const tache = texteCanvas((c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,250,236,1)'); g.addColorStop(0.4, 'rgba(255,240,215,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 256, 256);
    const nappe = new THREE.MeshBasicMaterial({ map: tache, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.32,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    for (let x = DROITE0 + 8; x < DROITE1; x += 16) for (const y of [W * 0.6, yOppose + W * 0.4]) plan(20, W * 1.3, nappe, x, y, 0.006).receiveShadow = false;
    for (const [xc, a0, sens] of [[DROITE1, -Math.PI / 2, 1], [DROITE0, Math.PI / 2, 1]] as const) {
      const r = R_CORDE + W * 0.6;
      for (let i = 0; i < 7; i++) {
        const a = a0 + sens * (i + 0.5) / 7 * Math.PI;
        const m = plan(18, W * 1.3, nappe, xc + r * Math.cos(a), -R_CORDE + r * Math.sin(a), 0.006);
        m.rotation.z = a + Math.PI / 2; m.receiveShadow = false;
      }
    }
    // la rangee de lampes, tous les quatre metres sous le bord du toit principal et en haut des
    // tribunes d'en face : une barre blanche et son halo
    const lampe = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const halo = new THREE.SpriteMaterial({ map: tache, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85, fog: false });
    const lLampe = new Lot(cube, lampe);
    const rangee = (M: THREE.Matrix4, L: number, y: number, z: number) => {
      for (let x = 2; x < L; x += 4) {
        boite(lLampe, M, x, y, z, 1.1, 0.25, 0.18);
        const q = new THREE.Vector3(x, y - 0.3, z - 0.1).applyMatrix4(M);
        const h = new THREE.Sprite(halo); h.position.copy(q); const k = 3.2 + (x * 7.3 % 1) * 0.8; h.scale.set(k, k, 1); stade!.add(h);
      }
    };
    rangee(Mp, LS, yFond - 18.8, z2 + 3.1);
    rangee(repere(DROITE1, yOppose - 3.2, Math.PI), LS, 0.4 + 16 * 0.85, 1.2 + 16 * 0.42 + 2.3);
    lLampe.finir(stade);
    // la foule est DANS les gradins violet-noir, pas devant (sprinter-app.js, danube) : dans la penombre
    uFoule.uLum.value = 0.48;
    // LA BANDE MAGENTA au pied des tribunes, entre la piste et les panneaux (la capture de reference
    // du 12/09) : un bandeau lumineux, le long des deux lignes droites
    const bandeMag = new THREE.MeshBasicMaterial({ color: c3(th.accent, [236, 46, 150]).multiplyScalar(0.7) });
    plan(LS, 1.15, bandeMag, XA + LS / 2, W + 1.0, 0.004).receiveShadow = false;
    plan(LS, 1.15, bandeMag, XA + LS / 2, yOppose - 1.0, 0.004).receiveShadow = false;
    // le halo des panneaux LED, sur la piste devant eux
    if (th.pubsLed) {
      const lueur = new THREE.MeshBasicMaterial({ color: c3(th.accent, [236, 46, 150]), transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false, map: texteCanvas((c, w, h) => {
          const g = c.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
          c.fillStyle = g; c.fillRect(0, 0, w, h);
        }, 4, 64) });
      plan(LS, 2.2, lueur, XA + LS / 2, W + 0.6, 0.007).receiveShadow = false;
    }
  }

  // LA POUSSIERE D'OR, en suspension au-dessus de la piste (le luxe seulement)
  if (luxe) {
    const n = 900, pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pts.set([DROITE0 + hasard() * (DROITE1 - DROITE0 + 20), -6 + hasard() * (W + 14), 0.4 + hasard() * 7], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    stade.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe8c47a, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false })));
  }

  if (cyber) villeNeon(hasard, rS);
  if (menole) pubAnim.push(construireMenole({ stade, W, D0: DROITE0, D1: DROITE1, hasard, nuit,
    spectateur: (x, y, z, geste, face) => { if (atlasPlage) spectateur(repere(0, 0, 0), x, y, z, geste, face); } }));
  else if (cdm) pubAnim.push(construireChamp({ stade, W, R: R_CORDE, D0: DROITE0, D1: DROITE1, hasard,
    dossier: base + (ULTRA ? 'decors-ultra/champdemars/' : 'decors/champdemars/') }));
  else if (palais) pubAnim.push(construirePalais({ stade, W, R: R_CORDE, D0: DROITE0, D1: DROITE1, hasard, env: envPalais,
    spectateur: (x, y, z, geste, face) => { if (atlasPublic) spectateur(repere(0, 0, 0), x, y, z, geste, face); } }));
  else if (plage) construirePlage({ stade, W, R: R_CORDE, D0: DROITE0, D1: DROITE1, hasard, base, nuit,
    spectateur: (x, y, z, geste, face) => { if (atlasPlage) spectateur(repere(0, 0, 0), x, y, z, geste, face); } });

  // LES ARBRES, autour du stade (pas au luxe : autour, c'est le noir ; pas au Stade Neon : la ville)
  // (ni dans le vide de l'espace, ni autour d'un stade de nuit au sol noir, ni au Champ-de-Mars : ses rideaux de tilleuls)
  for (let i = 0; i < (luxe || cyber || plage || palais || cdm || espace || (nuit && th.projecteurs) ? 0 : 70); i++) {
    const a = hasard() * Math.PI * 2, rx = 150 + hasard() * 40, ry = 95 + hasard() * 30;
    const x = 44 + rx * Math.cos(a), y = -R_CORDE + ry * Math.sin(a), h = 5 + hasard() * 5;
    boite(lTronc, M0, x, y, h * 0.3, 1, 1, h * 0.6);
    const r = 2.2 + hasard() * 1.6;
    boite(lFeuille, M0, x, y, h * 0.65 + r * 0.6, r, r, r * 1.2);
  }

  if (cartes.length) stade.add(laFoule(cartes));
  poserLesPieces(T, stadeCle, etape);
  // LA CARRIERE LEGENDE : le monument du lieu, ses objets, sa guirlande (legende-3d.ts)
  if (stadeCle && stadeCle.startsWith('legende-')) {
    if (!legendeDecors) {
      if (!legendeDemande) {
        legendeDemande = true;
        Promise.all([import('./legende/decors'), import('./legende/nuages')])
          .then(([d, n]) => { legendeDecors = d; legendeNuages = n; formeVue = ''; })
          .catch(() => { legendeDemande = false; });
      }
    } else {
      const manque = construireLegende({ stade, lieu: stadeCle.slice('legende-'.length), W, D0: DROITE0, D1: DROITE1, R1: R_CORDE,
        hasard, decors: legendeDecors, nuages: legendeNuages });
      // une image pas encore chargee : on reconstruit un peu plus tard (six fois au plus)
      if (manque && legendeEssais++ < 6) setTimeout(() => { formeVue = ''; }, 1500);
      else if (!manque) legendeEssais = 0;
    }
  }
  for (const l of [lMarche, lContre, lSiege, lToit, lBeton, lBlanc, lVitre, lMetal, lBloc, lTronc, lFeuille, lFilet, lFilet2]) l.finir(stade);
}

function initialiser(nCouloirs: number, toileDuJeu: HTMLCanvasElement | null) {
  toile = document.createElement('canvas');
  toile.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;display:none';
  // juste sous la toile du jeu, dans son conteneur : le fond de l'appli la cacherait sinon
  if (toileDuJeu && toileDuJeu.parentElement) toileDuJeu.parentElement.insertBefore(toile, toileDuJeu);
  else document.body.insertBefore(toile, document.body.firstChild);
  renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, powerPreference: 'high-performance' });
  // L'ULTRA (l'auteur, 23/10 : « mets le jeu en ultra ») : la definition pleine de l'ecran,
  // jusqu'a trois pixels par point, et des ombres deux fois plus fines. Comme l'ULTRA du
  // 2D (rendu-premium.js), il cede s'il fait perdre la cadence (voir tenirLaCadence).
  renderer.setPixelRatio(Math.min(ULTRA ? 3 : 2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = OMBRES;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // L'ESTHETIQUE CINEMATIQUE (l'auteur, 22/10) : une courbe filmique (ACES) plutot
  // que l'ecretage brut, et un vignettage peint en CSS sur la toile — il ne coute
  // rien au processeur graphique, meme sur le plus faible des telephones.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const vignette = document.createElement('div');
  vignette.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;'
    + 'background:radial-gradient(ellipse at 50% 55%,rgba(0,0,0,0) 55%,rgba(0,0,0,0.38) 100%)';
  toile.after(vignette);
  vignetteDe = vignette;
  scene = new THREE.Scene();
  // LE MONDE EN MIROIR. Le repere du jeu met le couloir 1 a droite de qui
  // regarde la ligne droite ; un vrai stade le met a gauche. Tout ce qui est
  // pose en coordonnees du jeu vit donc dans ce groupe retourne en Y, et la
  // camera, hors du groupe, retourne ses Y elle aussi.
  monde = new THREE.Group();
  monde.scale.y = -1;
  scene.add(monde);
  camera = new THREE.PerspectiveCamera(55, 1, 0.3, 1600)   // pres a 0,3 m : la profondeur reste fine au loin (survol);
  camera.up.set(0, 0, 1);
  hemi = new THREE.HemisphereLight(0xdfefff, 0x5a7a40, 1.6);
  scene.add(hemi);
  soleil = new THREE.DirectionalLight(0xfff4e0, 2.2);
  soleil.castShadow = OMBRES;
  soleil.shadow.mapSize.set(ULTRA ? 2048 : 1024, ULTRA ? 2048 : 1024);
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
  camera.fov = champBase = w < h ? 62 : 50;
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
// echelle : un maillage Tripo n'a pas la taille du corps du jeu (Kouassi : 1,82 m au repos
// contre 1,54) — ramene a lui, il a la taille de son look comme les autres
type Corps = { m: Modele; mats: Record<string, THREE.MeshStandardMaterial>; echelle?: number };
const hauteurDe = (o: THREE.Object3D) => { const b = new THREE.Box3().setFromObject(o); return b.max.y - b.min.y; };
const corps = new Map<any, Corps>();

// LE BLOC DE DEPART : la piece Blender des images 2D (pieces.blocs), exportee par
// tools/blender/bloc_depart_glb.py, fondue en un maillage par matiere : quatre
// appels de dessin pour les huit couloirs. Ses couleurs, perdues a l'export, sont
// celles de pieces.py. Tant qu'il n'est pas la, pas de blocs (jamais de bloc au trait).
let blocLots: { geo: THREE.BufferGeometry; mat: THREE.Material }[] | null = null;
let blocDemande = false;
const BLOC_COULEURS: Record<string, number[]> = {
  aluminium: [190, 196, 208], fonte: [58, 62, 76], caoutchouc: [40, 42, 52], chariot: [204, 48, 54],
};
function chargerLeBloc() {
  if (blocDemande) return;
  blocDemande = true;
  const base = (import.meta as any).env?.BASE_URL || '/';
  const l = new GLTFLoader();
  l.setMeshoptDecoder(MeshoptDecoder);
  l.loadAsync(base + 'modeles/bloc-depart.glb').then(g => {
    g.scene.updateMatrixWorld(true);
    const parMat = new Map<string, THREE.BufferGeometry[]>();
    g.scene.traverse((o: any) => {
      if (!o.isMesh) return;
      const brut = o.geometry.clone().applyMatrix4(o.matrixWorld).toNonIndexed();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', brut.getAttribute('position'));
      geo.setAttribute('normal', brut.getAttribute('normal'));
      const n = o.material.name;
      if (!parMat.has(n)) parMat.set(n, []);
      parMat.get(n)!.push(geo);
    });
    blocLots = [...parMat].map(([n, gs]) => ({
      geo: mergeGeometries(gs)!,
      mat: new THREE.MeshLambertMaterial({ color: c3(BLOC_COULEURS[n], [128, 128, 128]) }),
    }));
    formeVue = '';   // le stade se refait, avec ses blocs
  }).catch(() => { /* pas de blocs */ });
}

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
// LE LISERE DES ATHLETES (Stade d'Or). Pour qu'on les voie au depart dans un stade
// volontairement sombre, ce sont EUX qu'on eclaire, pas le decor : un contre-jour dore
// sur leurs contours et un rien de lumiere propre. Des flaques et des faisceaux poses sur
// la piste « cassaient le style du stade » (l'auteur, 22/10). Eteint (0) ailleurs.
const uLisere = { value: 0 }, uLisereCoul = { value: new THREE.Color(0xffc76b) }, uLisereForce = { value: 0.9 }, uLisereFace = { value: 0 };
function lisere(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLisere = uLisere; sh.uniforms.uLisereCoul = uLisereCoul; sh.uniforms.uLisereForce = uLisereForce; sh.uniforms.uLisereFace = uLisereFace;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLisere, uLisereForce, uLisereFace; uniform vec3 uLisereCoul;')
      .replace('#include <opaque_fragment>', `
float bord = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.5);
// une lumiere de face douce, venue d'en haut a gauche de la camera : le cote qu'on voit
float face = max(dot(normalize(normal), normalize(vec3(-0.35, 0.55, 0.75))), 0.0);
outgoingLight += uLisere * (uLisereCoul * bord * uLisereForce + diffuseColor.rgb * (0.12 + 0.02 * uLisereFace + 0.5 * uLisereFace * face));
#include <opaque_fragment>`);
  };
}

// --- LA BETE (la nuit du molosse) ----------------------------------------------
//
// Le maillage TRELLIS de halloween-molosse-3d.ts (molosse.glb, 1,60 m au garrot, son
// galop d'une seconde), mais pose DANS la ruelle, au milieu des coureurs : la 2D le
// rendait de profil dans une toile a part et le couchait sur la piste. Sa position est
// celle de la regle (etatDeLaChasse : la distance de la bete, calee sur le chrono),
// dans le couloir du joueur (ou de celui qu'un mordu regarde, en meute) ; sa foulee
// suit la distance, comme le trace (FOULEE 0,45). Les yeux : deux braises rouges.
// La chasse est lue sur G.obstacles (molosseDe la porte) : la 3D n'importe pas le mode.
const FICHIER_BETE = import.meta.glob('/src/assets/molosse.glb', { query: '?url', import: 'default' }) as
  Record<string, () => Promise<string>>;
type Bete = { racine: THREE.Group; melangeur: THREE.AnimationMixer; duree: number };
let bete: Bete | null = null, beteDemandee = false;
function chargerLaBete() {
  if (beteDemandee) return;
  beteDemandee = true;
  const f = Object.values(FICHIER_BETE)[0];
  if (!f) return;
  f().then((u) => {
    const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
    l.load(u, (gltf) => {
      const racine = new THREE.Group(), corps = gltf.scene;
      corps.rotation.x = Math.PI / 2;      // le glTF a y en haut, le stade z
      racine.add(corps);
      const yeux: THREE.Object3D[] = [];
      corps.traverse((o: any) => {
        if (o.isBone && /^oeil_/.test(o.name)) yeux.push(o);
        if (o.isMesh) {
          o.frustumCulled = false; o.castShadow = true;
          const m = o.material as THREE.MeshStandardMaterial;
          if (m.color) m.color.multiplyScalar(0.6);     // une bete noire, la nuit
          lisere(m);
        }
      });
      const matOeil = new THREE.MeshBasicMaterial({ color: 0xff2a10 });
      const matLueur = new THREE.SpriteMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, map: texteCanvas((c, w, h) => {
        const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        g.addColorStop(0, 'rgba(255,80,40,1)'); g.addColorStop(0.3, 'rgba(255,30,10,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }, 64, 64) });
      for (const y of yeux) {
        const s = new THREE.Vector3(); y.getWorldScale(s);
        const k = 1 / Math.max(1e-3, s.x);        // en metres, quelle que soit l'echelle de l'os
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.035 * k, 10, 8), matOeil); y.add(b);
        const h = new THREE.Sprite(matLueur); h.scale.setScalar(0.5 * k); y.add(h);
      }
      const clip = gltf.animations.find((a: THREE.AnimationClip) => a.name === 'galop') || gltf.animations[0];
      const melangeur = new THREE.AnimationMixer(corps);
      if (clip) melangeur.clipAction(clip).play();
      racine.visible = false;
      monde.add(racine);
      bete = { racine, melangeur, duree: clip ? clip.duration : 1 };
    }, undefined, () => { beteDemandee = false; });
  }).catch(() => { beteDemandee = false; });
}
// ?sonde : la bete et la chasse, lisibles depuis la console (verifier sans jouer la nuit)
if (Q.get('sonde') !== null) (globalThis as any).__course3d = { get bete() { return bete; }, get chasse() { const o = (globalThis as any).SprinterApp?.G?.obstacles; return o && o.molosse ? o.chasse : null; }, get monde() { return monde; }, get camera() { return camera; } };
function poserLaBete(G: any, T: any, nuit: boolean) {
  if (!bete) return;
  // la chasse, portee par l'obstacle que la nuit pose (molosseDe) : pas d'import du mode,
  // qui resterait sinon dans le paquet de la 3D (et, en dev, en serait une seconde copie)
  const c = nuit && G.obstacles && G.obstacles.molosse ? G.obstacles.chasse : null;
  if (!c) { bete.racine.visible = false; return; }
  const suivi = G.spectateur && G.suivi ? G.suivi : G.player;
  const lane = suivi ? suivi.lane : 0, d = Math.min(c.d, T.total + 24);
  const p = ici(T.pos(d, lane));
  bete.racine.position.set(p[0], p[1], 0);
  bete.racine.rotation.z = capIci(T.heading(d, lane));
  bete.racine.visible = d > -14;          // elle sort de l'ombre, derriere la ligne
  bete.melangeur.setTime(((((d * 0.45) % 1) + 1) % 1) * bete.duree);
}

// LES ATHLETES EN VRAI MAILLAGE (look.maillage : les boss de la Legende, les vedettes) :
// leur GLB Tripo (vedette_tripo.py) a le squelette du coureur du jeu — il se pose pareil.
// Ses textures restent les siennes. Tant qu'il charge, les tubes tiennent sa place.
const maillages = new Map<string, THREE.Object3D | null | false>();
function maillageDe(chemin: string): THREE.Object3D | null | false {
  if (!maillages.has(chemin)) {
    maillages.set(chemin, null);
    const base = ((import.meta as any).env?.BASE_URL || '/').replace(/\/?$/, '/');
    const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
    l.loadAsync(base + chemin.replace(/^\//, '')).then((g) => { maillages.set(chemin, g.scene); })
      .catch(() => { maillages.set(chemin, false); });
  }
  return maillages.get(chemin)!;
}

function corpsDe(r: any): Corps | null {
  let c = corps.get(r);
  if (c) return c;
  const chemin = r.look && r.look.maillage;
  const sc = chemin ? maillageDe(chemin) : false;
  if (sc === null) return null;                // il charge : les tubes en attendant
  if (sc) {
    try {
      const copie = clonerSquelette(sc);
      copie.traverse((o: any) => {
        if (!o.isMesh) return;
        const m = (o.material as THREE.MeshStandardMaterial).clone();
        lisere(m);
        o.material = m;
      });
      const hGabarit = gabarit ? hauteurDe(gabarit) : 1.54, hMaillage = hauteurDe(sc);
      c = { m: modeleDe(copie), mats: {}, echelle: hMaillage > 0.5 ? hGabarit / hMaillage : 1 };
      monde.add(c.m.racine);
      corps.set(r, c);
      return c;
    } catch { maillages.set(chemin, false); }    // pas le squelette du jeu : le corps generique
  }
  if (!gabarit) return null;
  const copie = clonerSquelette(gabarit);
  const mats: Record<string, THREE.MeshStandardMaterial> = {};
  copie.traverse((o: any) => {
    if (!o.isMesh) return;
    const liste = Array.isArray(o.material) ? o.material : [o.material];
    const neufs = liste.map((m: any) => {
      const zone = String(m.name || '').replace('Coureur_', '');
      const n = new THREE.MeshStandardMaterial({ roughness: zone === 'peau' ? 0.55 : 0.7, metalness: 0 });
      lisere(n);
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
  const ke = k * (c.echelle || 1);
  c.m.racine.matrix.multiplyMatrices(_T.makeTranslation(p[0], p[1], 0), _S.makeScale(ke, ke, ke))
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
  // une silhouette pleine, doree, et non une lueur additive : sur le rouge de la piste,
  // une lueur a 30 % disparaissait en pleine course (l'auteur, 22/10 : « je ne la vois pas »)
  const mat = new THREE.MeshLambertMaterial({ color: 0xffc93a, emissive: 0x6a4a00, transparent: true, opacity: 0.6, depthWrite: false });
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
  if (age < 0 || !p) return;
  const T = G.track, q = ici(T.posDemi(p.d, p.lane, p.demi || 0));
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
  const cap = capIci(T.heading(p.d, p.lane)), lean = T.lean(p.d, p.lane, p.v);
  const k0 = (p.look.h || C.MODEL_H) / C.MODEL_H;
  for (let k = 1; k <= 3; k++) {
    // plus espacees qu'en 2D : vue de dos, des copies serrees se fondent en une tache
    const d = p.d - Math.max(0.7, p.v * 0.11) * k;
    if (d <= 0) continue;
    const e = echoDe(k - 1);
    if (!e) continue;
    poser(e.m, p.squelette);
    const pq = ici(T.posDemi(d, p.lane, p.demi || 0));
    const [ex, ey, ez] = App.repereDuCoureur(p, cap, lean, false, false);
    _M.set(ex[0], ey[0], ez[0], 0, ex[1], ey[1], ez[1], 0, ex[2], ey[2], ez[2], 0, 0, 0, 0, 1);
    e.m.racine.matrix.multiplyMatrices(_T.makeTranslation(pq[0], pq[1], 0), _S.makeScale(k0, k0, k0)).multiply(_M).multiply(Qgl);
    e.m.racine.matrixWorldNeedsUpdate = true;
    // l'image remanente tient sa pleine force plus longtemps que le halo
    (e as any).mat.opacity = (1 - age * age) * 0.75 * (4 - k) / 3;
    e.m.racine.visible = true;
  }
}

/** Montrer ou cacher la scene 3D (le dessin 2D reprend la main hors course). */
export function afficher(oui: boolean) {
  if (oui === visible || !renderer) { visible = oui && !!renderer; if (renderer) toile.style.display = visible ? 'block' : 'none'; return; }
  visible = oui;
  toile.style.display = oui ? 'block' : 'none';
  if (vignetteDe) vignetteDe.style.display = oui ? 'block' : 'none';
  if (!oui) camPret = false;
  if (!oui && videoPub) videoPub.pause();     // rendre() la relance au retour en piste
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _a = new THREE.Vector3(),
  _b = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const AXE_Y = new THREE.Vector3(0, 1, 0);

/** Une image de la course, lue sur l'etat du jeu. */
export function rendre(App: any, dt: number) {
  const { G, C } = App;
  tenirLaCadence(dt);
  const T = G.track;
  if (!renderer) {
    const lanes = (G.runners || []).map((r: any) => r.lane | 0);
    nCouloirs = Math.max(8, ...lanes.map((l: number) => l + 1));
    initialiser(nCouloirs, G.cv || null);
    initialiserLesEffets();
    chargerLeCorps();
    chargerLeBloc();
    chargerLePublic();
  }
  // le stade de l'etape en cours (le theme a l'heure ou l'on joue, comme le dessin 2D)
  // (l'eclairage de l'heure rend un nouvel objet : c'est le theme brut qui dit si l'etape a change)
  // le stade force passe lui aussi par l'heure (?stade=plage&heure=nuit), comme App.theme()
  const forceBrut = STADE_FORCE && App.THEMES && App.THEMES[STADE_FORCE];
  const force = forceBrut && App.eclaire ? App.eclaire(forceBrut) : forceBrut;
  const brut = forceBrut || (App.themeBrut ? App.themeBrut() : null);
  // ... et la forme de la course : ligne droite, demi-tour ou tour complet
  // ... et l'etape : les pieces du stade des quatre premieres en sortent de plus en plus
  const forme = (T.curved ? (T.fullLap ? 'tour' : 'demi') + T.straight : 'droite') + T.total + '/' + (G.levelIdx | 0)
    + '/' + ((App.theme && App.theme() && App.theme().moment) || 'jour');   // le moment de la journee aussi
  caler(T);
  if (!stade || brut !== themeVu || forme !== formeVue) {
    themeVu = brut; formeVue = forme;
    const b = (brut && brut.base) || brut, TH = App.THEMES || {};
    const stadeCle = Object.keys(TH).find(k => TH[k] === b) || null;
    const affluence = force ? 0.92 : App.fouleDe ? App.fouleDe(G.levelIdx | 0) : 1;
    construireLeStade(nCouloirs, force || (App.theme ? App.theme() : {}), T, C, stadeCle, force ? 9 : G.levelIdx | 0, affluence);
  }
  if (!toile || toile.style.display === 'none') {
    afficher(true);
  }
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
    const p = ici(T.posDemi(r.d, r.lane, r.demi || 0));
    const cap = capIci(T.heading(r.d, r.lane)) + (r.retour ? Math.PI : 0) + (r.cap || 0);
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
  // LA NUIT DU MOLOSSE : la ruelle vit (brume, reverberes), la bete court derriere le joueur
  const nuitDuMolosse = typeof G.raceKey === 'string' && G.raceKey.startsWith('nuit-');
  if (ruelle) {
    const qui = G.spectateur && G.suivi ? G.suivi : G.player;
    const pj = ici(T.pos(qui ? qui.d : 0, qui ? qui.lane : 0));
    ruelle.animer(camera.position.x, -camera.position.y, pj[0], pj[1], performance.now() / 1000);
  }
  if (nuitDuMolosse) chargerLaBete();
  poserLaBete(G, T, nuitDuMolosse);
  if (troncs.instanceColor) troncs.instanceColor.needsUpdate = true;
  if (joints.instanceColor) joints.instanceColor.needsUpdate = true;

  // LA CAMERA, derriere le joueur dans l'axe de son couloir, un peu en hauteur
  // (en meute, un mordu regarde la poursuite : la camera suit sa proie, `G.suivi`, comme le 2D)
  const pl = G.spectateur && G.suivi ? G.suivi : G.player;
  if (pl) {
    const p = ici(T.posDemi(pl.d, pl.lane, pl.demi || 0));
    // Centree sur le couloir du joueur, decalee vers la corde (couloir 1), la tribune en face :
    // il est au milieu de l'image, ses voisins des deux cotes. Dans un virage, elle tourne
    // avec lui. Y retourne : voir `monde`.
    const h = capIci(T.heading(pl.d, pl.lane));
    const ax = Math.cos(h), ay = Math.sin(h), ix = Math.sin(h), iy = -Math.cos(h);   // devant, vers la corde
    const voulu = _a.set(p[0] - RECUL * ax + COTE * ix, -(p[1] - RECUL * ay + COTE * iy), HAUT);
    // le point vise prolonge la droite camera -> joueur : il reste au centre de l'image
    const loin = DOS ? 14 : 7, kc = COTE * loin / RECUL;
    const vise = _b.set(p[0] + loin * ax - kc * ix, -(p[1] + loin * ay - kc * iy), DOS ? 0.9 : 0.6);
    // LE PROFIL (l'auteur, 22/10 : « le depart part comme actuellement et au fur et a
    // mesure de la course passe en vue de profil pour qu'on voie l'ecart entre les
    // joueurs »). Le depart garde notre camera ; de 8 a 92 % de la course (« trop
    // rapide » sur 6-31 %, puis « se bloque trop tot » a 60 % — l'auteur, 22/10), elle
    // glisse cote pelouse, face aux couloirs, la tribune derriere eux — le plan de la
    // camera sur rail des retransmissions. Elle cadre ses voisins, sept metres devant
    // et derriere lui au plus — au-dela, en portrait, les coureurs deviendraient des
    // points : l'ecart au premier, lui, reste ecrit dans le bandeau.
    const total = T.total || 100;
    // SUR UN TOUR (200, 400 m), LE PROFIL SUIT LA PISTE : entier dans les lignes droites,
    // a moitie dans les virages — de profil, un virage sort du cadre —, et la camera
    // pivote doucement de l'un a l'autre (« sur les lignes droites, pas assez de profil »,
    // l'auteur, 22/10). Le 100 m garde sa lente glissade.
    let cible: number;
    if (T.curved) {
      const v = Math.min(1, Math.max(0, (pl.d - 0.03 * total) / (0.08 * total)));
      cible = v * v * (3 - 2 * v) * (T.lean(pl.d, pl.lane, 1) ? 0.5 : 1);
    } else {
      const u = Math.min(1, Math.max(0, (pl.d - P_DEBUT * total) / ((P_FIN - P_DEBUT) * total)));
      cible = u * u * (3 - 2 * u);
    }
    if (pl.d < 0.5 || !T.curved) profilB = cible;
    else profilB += (cible - profilB) * Math.min(1, (dt || 0.016) * 0.7);
    const b = profilB;
    if (b <= 0) profilPret = false;
    if (b > 0 && !DOS && !nuitDuMolosse) {
      let dMin = pl.d, dMax = pl.d;
      for (const r of G.runners) if (r && r.look && !r.retour) { dMin = Math.min(dMin, r.d); dMax = Math.max(dMax, r.d); }
      dMin = Math.max(dMin, pl.d - 7); dMax = Math.min(dMax, pl.d + 7);
      // le joueur d'abord : le cadre ne va qu'a mi-chemin vers le milieu de ses voisins
      // le recentrage et le recul se font lentement : un voisin qui entre dans le cadre
      // ou en sort ne fait plus sauter le plan
      const k = Math.min(1, (dt || 0.016) * 1.1);
      const decalVoulu = 1.5 + ((dMin + dMax) / 2 - pl.d) * 0.5, ecartVoulu = dMax - dMin + 4;
      if (!profilPret) { profilDecal = decalVoulu; profilEcart = ecartVoulu; profilPret = true; }
      profilDecal += (decalVoulu - profilDecal) * k; profilEcart += (ecartVoulu - profilEcart) * k;
      const centre = pl.d + profilDecal, ecart = profilEcart;
      const milieu = (nCouloirs - 1) / 2;
      const f = ici(T.pos(centre, milieu)), hf = capIci(T.heading(centre, milieu));
      const fx = Math.sin(hf), fy = -Math.cos(hf);                 // vers la pelouse
      // EN PORTRAIT, UN PROFIL DE TROIS QUARTS. Le champ horizontal d'un telephone tenu
      // droit ne fait qu'une trentaine de degres : de profil pur, la piste n'etait plus
      // qu'une bande au milieu de l'ecran et les coureurs des points (mesure du 22/10,
      // 375 x 812). Un peu en arriere et plus haute, la camera range l'ecart dans la
      // profondeur — le premier en haut, les suivants plus bas. Ecran large : profil pur.
      // plus de profil et plus haut que le premier essai (0,55 et 5,4 m : « manque de
      // hauteur ou plus une vue de profil ») : de haut, la piste garde sa place a l'image
      const arriere = camera.aspect >= 1 ? 0 : P_ARRIERE;
      const demiChamp = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
      // « trop loin » a 11-22 m (l'auteur, 22/10) : 8 a 14 m en portrait, 8 a 18 m en large
      const D = P_LOIN * (arriere ? Math.min(14, Math.max(8, 5 + ecart * 0.5))
        : Math.min(18, Math.max(8, ecart / (2 * Math.tan(demiChamp)) + nCouloirs * LANE_W / 2)));
      const ax2 = Math.cos(hf), ay2 = Math.sin(hf);
      const lat = Math.sqrt(1 - arriere * arriere);
      voulu.lerp(_c3.set(f[0] + (fx * lat - ax2 * arriere) * D, -(f[1] + (fy * lat - ay2 * arriere) * D), camera.aspect >= 1 ? 4.2 : profilBas ? 3.4 : P_HAUT), b);
      // visant sous les coureurs : ils montent dans l'image, au-dessus des touches
      vise.lerp(_d3.set(f[0] + ax2 * arriere * 3, -(f[1] + ay2 * arriere * 3), camera.aspect >= 1 ? -0.6 : profilBas ? 1.3 : 0), b);
    }
    // LA NUIT DU MOLOSSE : UNE CAMERA DE POURSUITE (« recree l'evenement le molosse en full
    // 3D », l'auteur, 23/10). De profil, la bete qui court derriere sort du cadre d'un
    // telephone tenu droit ; de face, le coureur vient vers nous et elle grandit dans son
    // dos, les yeux dans la brume. Le depart garde notre camera, la bascule se fait sur les
    // six premiers metres ; plus la bete est loin, plus la camera recule et vise derriere.
    if (nuitDuMolosse && !DOS) {
      const ch = G.obstacles && G.obstacles.molosse ? G.obstacles.chasse : null;
      const e = ch ? Math.min(22, Math.max(0, pl.d - ch.d)) : 12;
      const v = Math.min(1, Math.max(0, pl.d / 6)), nb = v * v * (3 - 2 * v);
      const av = 6.2 + e * 0.12, cote = 1.8;
      voulu.lerp(_c3.set(p[0] + av * ax + cote * ix, -(p[1] + av * ay + cote * iy), 3.1 + e * 0.04), nb);
      vise.lerp(_d3.set(p[0] - e * 0.3 * ax, -(p[1] - e * 0.3 * ay), 0.8), nb);
    }
    // LE SURVOL D'AVANT-COURSE (« avant chaque course, un tour de stade pour le presenter
    // pendant qu'on presente l'adversaire ; une camera plongeante qui part du ciel vers le
    // point de depart en douceur », l'auteur, 22/10). Pendant la presentation (cinematique
    // `intro`), la camera tourne lentement au-dessus du stade ; quand le decompte commence
    // — ou tout de suite s'il n'y a pas de presentation —, elle plonge en 1,8 s sur la
    // camera de depart, qu'elle rejoint exactement, avant le coup de pistolet.
    const intro = G.state === 'cut' && G.cut && G.cut.kind === 'intro';
    // pas de survol pour la nuit du molosse (« pas de vue aerienne de presentation », l'auteur, 23/10)
    const avant = (intro || G.state === 'count') && !nuitDuMolosse;
    if (!avant && G.state !== 'race' && G.state !== 'falseout') { volLance = false; volPlonge = -1; }
    if (avant && !volLance) { volLance = true; volT = 0; volPlonge = -1; }
    let survol = false;
    // volPlonge : -1 avant la plongee, son instant pendant, -2 une fois finie
    if (volLance && !SURVOL && volPlonge !== -2) {
      volT += dt || 0.016;
      const cx = 44, cy = R_CORDE;                         // le centre du stade (y retourne : voir monde)
      const tourne = (t: number) => -2.3 + t * 0.32;        // un lent tour de piste, vu de haut
      const orbite = (t: number) => _c3.set(cx + Math.cos(tourne(t)) * 125, cy + Math.sin(tourne(t)) * 95, 62 - Math.min(12, t * 1.5));
      if (!intro && volPlonge === -1) {
        // la presentation est finie (ou n'existe pas) : la plongee commence, d'ou l'on est
        volPlonge = volT;
        volDepart.copy(orbite(volT)); volVise0.set(cx, cy, 0);
      }
      const DUREE = 1.8;   // finie avant « prets » : le decompte est court
      const u = volPlonge === -1 ? 0 : Math.min(1, (volT - volPlonge) / DUREE);
      if (u < 1) {
        const e = u * u * u * (u * (u * 6 - 15) + 10);       // tres doux aux deux bouts
        if (volPlonge === -1) { camPos.copy(orbite(volT)); camVise.set(cx, cy, 0); }
        else {
          camPos.lerpVectors(volDepart, voulu, e);
          camPos.z += Math.sin(u * Math.PI) * 6;            // la plongee s'arrondit
          camVise.lerpVectors(volVise0, vise, e);
        }
        camPret = true;
        survol = true;
      } else volPlonge = -2;                                // fini : la camera de course reprend
    }
    if (!survol) {
      const lisse = camPret ? 1 - Math.exp(-(dt || 0.016) * 6) : 1;
      camPos.lerp(voulu, lisse); camVise.lerp(vise, lisse);
      camPret = true;
    }
    camera.position.copy(camPos);
    // LA CAMERA VIT (l'auteur, 22/10 : « cinematique et dynamique ») : au coup de
    // pistolet elle tremble un instant, et son champ s'ouvre avec la vitesse.
    if (G.state === 'race' && etatVu !== 'race') secousse = 0.28;
    etatVu = G.state;
    if (secousse > 0) {
      secousse = Math.max(0, secousse - (dt || 0.016));
      const f = secousse * 0.22;
      camera.position.x += (Math.random() - 0.5) * f; camera.position.z += (Math.random() - 0.5) * f;
    }
    camera.lookAt(camVise);
    const fov = champBase + Math.min(1, Math.max(0, (pl.v || 0) / 11)) * 7;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, (dt || 0.016) * 3); camera.updateProjectionMatrix(); }
    soleil.position.set(p[0] + soleilDecal.x, p[1] + soleilDecal.y, soleilDecal.z);
    soleil.target.position.set(p[0] + 6, p[1], 0);
  }
  if (SURVOL) {
    camera.position.set(-40, R_CORDE + 75, 95);     // y retourne : voir `monde` ; au-dessus des tours proches
    camera.lookAt(46, R_CORDE, 0);
  }
  // la foule : ou est la camera (dans le repere du monde), ou est le joueur, l'arrivee passee
  if (voute) voute.rotation.y += (dt || 0.016) * 0.006;
  if (pubAnim.length && stade) {
    const t = performance.now() / 1000, c = stade.worldToLocal(_camLocale.copy(camera.position));
    camera.getWorldDirection(_camCap);
    const cap = Math.atan2(-_camCap.y, _camCap.x);            // le cap de la camera, dans le repere du stade (monde en miroir)
    for (const f of pubAnim) f(t, c.x, c.y, cap);
  }
  if (hologrammes.length) {
    const t = performance.now() / 1000;
    hologrammes.forEach((m, i) => {
      // un gresillement de temps en temps, sinon une lueur qui respire
      const g = Math.sin(t * 23 + i * 7) > 0.97 ? 0.25 : 0.82 + 0.12 * Math.sin(t * 1.7 + i);
      (m.material as THREE.MeshBasicMaterial).opacity = g;
    });
  }
  if (pluie) {
    // la pluie tombe autour de la camera (dans le repere de la scene, hors du monde en miroir)
    pluie.position.set(camera.position.x, camera.position.y, -((performance.now() / 1000 * 26) % 30));
  }
  if (filante) {
    filanteT -= dt || 0.016;
    if (filanteT < -0.9) {
      // une nouvelle, quelque part dans le ciel, toutes les cinq a dix secondes
      filanteT = 5 + Math.random() * 5;
      const a = Math.random() * Math.PI * 2;
      filante.position.set(44 + 260 * Math.cos(a), -R_CORDE + 260 * Math.sin(a), 70 + Math.random() * 90);
      filante.lookAt(44, -R_CORDE, 0);
      filante.rotateZ(Math.random() * Math.PI);
    }
    filante.visible = filanteT < 0;
    if (filanteT < 0) {
      filante.translateX(-(dt || 0.016) * 120);
      (filante.material as THREE.MeshBasicMaterial).opacity = Math.min(1, -filanteT * 4) * (1 + filanteT);
    }
  }
  uFoule.uT.value = performance.now() / 1000;
  monde.worldToLocal(uFoule.uCam.value.copy(camera.position));
  if (pl) {
    const q = ici(T.posDemi(pl.d, pl.lane, pl.demi || 0));
    uFoule.uJoueur.value.set(q[0], q[1]);
    const fini = pl.d >= T.total ? 0.9 : 0;
    uFoule.uLiesse.value += (fini - uFoule.uLiesse.value) * Math.min(1, (dt || 0.016) * 1.5);
  }
  dessinerLesEffets(App);
  renderer!.render(scene, camera);
}
