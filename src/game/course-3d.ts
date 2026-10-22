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

function plan(w: number, l: number, mat: THREE.Material, x: number, y: number, z = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  monde.add(m);
  return m;
}

/** Le stade : piste rouge brique, huit couloirs, numeros peints, gradins. Tout en +X, Z en haut. */
function construireLeStade(nCouloirs: number) {
  scene.background = new THREE.Color(0x8ec9f0);
  scene.fog = new THREE.Fog(0x8ec9f0, 90, 220);
  const largeur = nCouloirs * LANE_W;
  // le sol, puis la piste un peu au-dessus (z-fighting)
  plan(400, 120, new THREE.MeshLambertMaterial({ color: 0x3f8f3a }), 50, largeur / 2, -0.01).rotation.set(0, 0, Math.PI / 2);
  plan(170, largeur + 2.4, new THREE.MeshLambertMaterial({ color: 0xb4503a }), 55, largeur / 2, 0);
  const blanc = new THREE.MeshBasicMaterial({ color: 0xf4f1ea });
  for (let k = 0; k <= nCouloirs; k++) plan(170, 0.05, blanc, 55, k * LANE_W, 0.002);
  plan(0.05, largeur, blanc, 0, largeur / 2, 0.003);                 // depart
  // l'arrivee en damier
  const damier = texteCanvas((c, w, h) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 40; j++) {
      c.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; c.fillRect(i * w / 4, j * h / 40, w / 4, h / 40);
    }
  }, 64, 640);
  plan(0.5, largeur, new THREE.MeshBasicMaterial({ map: damier }), 100.25, largeur / 2, 0.003);
  // les numeros, devant les blocs, lisibles depuis l'arriere (haut du chiffre vers +X)
  for (let k = 0; k < nCouloirs; k++) {
    const t = texteCanvas((c, w, h) => {
      c.fillStyle = '#f4f1ea'; c.font = `900 ${h * 0.9}px system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(k + 1), w / 2, h / 2 + h * 0.04);
    }, 128, 128);
    const m = plan(1.0, 1.0, new THREE.MeshBasicMaterial({ map: t, transparent: true }), -2.2, (k + 0.5) * LANE_W, 0.004);
    m.rotation.z = -Math.PI / 2;
    m.scale.x = -1;   // le monde est en miroir (voir initialiser) : le chiffre, lui, se lit a l'endroit
  }
  // les gradins : des marches de public, des deux cotes
  const foule = texteCanvas((c, w, h) => {
    c.fillStyle = '#3a4152'; c.fillRect(0, 0, w, h);
    const teintes = ['#e94b3c', '#f5c242', '#3c7be9', '#ffffff', '#2fb36d', '#c13cbf', '#f08a3c'];
    for (let i = 0; i < 900; i++) {
      c.fillStyle = teintes[i % teintes.length];
      c.fillRect(Math.random() * w, Math.random() * h, 3, 4);
    }
  }, 512, 64);
  foule.wrapS = foule.wrapT = THREE.RepeatWrapping; foule.repeat.set(24, 1);
  const matFoule = new THREE.MeshLambertMaterial({ map: foule });
  const matBeton = new THREE.MeshLambertMaterial({ color: 0xc9c4bb });
  for (const cote of [-1, 1]) {
    const y0 = cote < 0 ? -6 : largeur + 6;
    for (let r = 0; r < 6; r++) {
      const marche = new THREE.Mesh(new THREE.BoxGeometry(170, 1.4, 0.8), r % 2 ? matBeton : matFoule);
      marche.position.set(55, y0 + cote * r * 1.4, 0.4 + r * 0.8);
      monde.add(marche);
    }
    // le bandeau rouge et blanc au bord de la piste
    const bandeau = texteCanvas((c, w, h) => {
      for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#d9261c' : '#ffffff'; c.fillRect(i * w / 16, 0, w / 16, h); }
    }, 256, 16);
    bandeau.wrapS = THREE.RepeatWrapping; bandeau.repeat.set(30, 1);
    const mur = new THREE.Mesh(new THREE.PlaneGeometry(170, 0.9), new THREE.MeshBasicMaterial({ map: bandeau, side: THREE.DoubleSide }));
    mur.position.set(55, cote < 0 ? -2.2 : largeur + 2.2, 0.45);
    mur.rotation.x = Math.PI / 2;
    monde.add(mur);
  }
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
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
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
  construireLeStade(nCouloirs);
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
    afficher(true);
  }
  if (T.curved) return;   // shortcut: ligne droite seulement

  const tous = (G.ghost && G.runners.indexOf(G.ghost.runner) < 0) ? G.runners.concat([G.ghost.runner]) : G.runners;
  // les blocs et le « prets » : c'est le dessin du jeu qui les pose, a chaque image
  for (const r of tous) App.phaseBlocs(r);

  let n = 0, nj = 0;
  for (const r of tous) {
    if (!r || !r.look) continue;
    const p = T.posDemi(r.d, r.lane, r.demi || 0);
    const cap = T.heading(r.d, r.lane) + (r.retour ? Math.PI : 0) + (r.cap || 0);
    const k = (r.look.h || C.MODEL_H) / C.MODEL_H;
    const caps = App.personCapsules(r, cap, T.lean(r.d, r.lane, r.v) + (r.roulis || 0), false, false, r === G.player ? 0 : 1);
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
    // Centree sur le couloir du joueur, decalee vers l'exterieur (couloirs hauts) :
    // il est au milieu de l'image, ses voisins des deux cotes. Y retourne : voir `monde`.
    const yAxe = p[1];
    const voulu = _a.set(p[0] - RECUL, -(yAxe + COTE), HAUT);
    // le point vise prolonge la droite camera -> joueur : il reste au centre de l'image
    const loin = DOS ? 14 : 7;
    const vise = _b.set(p[0] + loin, -(yAxe - COTE * loin / RECUL), DOS ? 0.9 : 0.6);
    const lisse = camPret ? 1 - Math.exp(-(dt || 0.016) * 6) : 1;
    camPos.lerp(voulu, lisse); camVise.lerp(vise, lisse);
    camPret = true;
    camera.position.copy(camPos);
    camera.lookAt(camVise);
    soleil.position.set(p[0] - 10, p[1] - 18, 30);
    soleil.target.position.set(p[0] + 6, p[1], 0);
  }
  renderer!.render(scene, camera);
}
