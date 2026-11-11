// LA COURSE EN VRAIE 3D — le moteur de rendu, la scene, ses lumieres et les tubes des coureurs (decoupe de course-3d.ts, 11/11/2026).

import * as THREE from 'three';
import { brancherKTX2 } from '../chargeur-gltf';
import { Q, OMBRES, MAX_TRONCS } from './reglages';
import { palier, RATIO } from './paliers';

export let renderer: THREE.WebGLRenderer | null = null;
export let hemi: THREE.HemisphereLight;
export let scene: THREE.Scene, monde: THREE.Group, camera: THREE.PerspectiveCamera, soleil: THREE.DirectionalLight;
export let troncs: THREE.InstancedMesh, joints: THREE.InstancedMesh, aR: THREE.InstancedBufferAttribute;
export let toile: HTMLCanvasElement, vignetteDe: HTMLDivElement | null = null;
export let champBase = 55;
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

export function texteCanvas(dessin: (c: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  dessin(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

export function initialiser(nCouloirs: number, toileDuJeu: HTMLCanvasElement | null) {
  toile = document.createElement('canvas');
  toile.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;display:none';
  // juste sous la toile du jeu, dans son conteneur : le fond de l'appli la cacherait sinon
  if (toileDuJeu && toileDuJeu.parentElement) toileDuJeu.parentElement.insertBefore(toile, toileDuJeu);
  else document.body.insertBefore(toile, document.body.firstChild);
  // (?aa=0, ?foule=0, ?aces=0 : pour mesurer ce que coute chacun sur un telephone)
  // L'ANTICRENELAGE AUSSI AU TELEPHONE, des le palier 2 (« la qualite est basse meme en ultra, les
  // lignes blanches sont en pointille », l'auteur, 24/10) : sans lui, une ligne de couloir plus fine
  // qu'un pixel au loin se cassait en tirets, et la foule crenelait. Il coutait de la cadence au
  // Galaxy Flip (23/10) : tenirLaCadence redescend si besoin. Il se decide a la creation.
  // (24/10) et a tous les paliers : il se decide ici, une fois pour la partie — un telephone qui
  // demarrait au palier bas le perdait jusqu'au bout, et c'est au palier bas qu'il manque le plus
  renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: Q.get('aa') !== '0', powerPreference: 'high-performance' });
  brancherKTX2(renderer);
  (globalThis as any).__palier3d = () => palier;
  // L'ULTRA (l'auteur, 23/10 : « mets le jeu en ultra ») : la definition pleine de l'ecran,
  // jusqu'a trois pixels par point, et des ombres deux fois plus fines. Comme l'ULTRA du
  // 2D (rendu-premium.js), il cede s'il fait perdre la cadence (voir tenirLaCadence).
  renderer.setPixelRatio(Math.min(RATIO[palier], window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = OMBRES;
  // les ombres adoucies coutent quatre lectures de plus par pixel : l'ULTRA seulement
  // adoucies a tous les paliers (24/10) : un bord d'ombre en escalier est un crenelage aussi
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // L'ESTHETIQUE CINEMATIQUE (l'auteur, 22/10) : une courbe filmique (ACES) plutot
  // que l'ecretage brut, et un vignettage peint en CSS sur la toile — il ne coute
  // rien au processeur graphique, meme sur le plus faible des telephones.
  renderer.toneMapping = Q.get('aces') === '0' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
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
  soleil.castShadow = OMBRES && palier > 0;
  soleil.shadow.mapSize.set(palier >= 3 ? 2048 : palier === 2 ? 1024 : 512, palier >= 3 ? 2048 : palier === 2 ? 1024 : 512);
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

export function dimensionner() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // en portrait, on elargit le champ pour garder les couloirs voisins
  camera.fov = champBase = w < h ? 62 : 50;
  camera.updateProjectionMatrix();
}

export const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _a = new THREE.Vector3(),
  _b = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
export const AXE_Y = new THREE.Vector3(0, 1, 0);
