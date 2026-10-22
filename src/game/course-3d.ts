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
// panneaux, public. Le stade 3D se construit sur ces memes couleurs : le stade
// de l'etape en cours a donc sa version 3D sans rien dessiner de plus, et un
// changement d'etape le reconstruit.
//
// On le voit comme dans le jeu : la camera se tient du cote des couloirs hauts,
// les gradins sont en face, de l'autre cote de la piste, derriere leurs
// panneaux. shortcut: une seule tribune, droite ; pas d'arbres ni de pieces de
// decor par stade (les images Blender du jeu sont cuites pour sa vue 2D).
let stade: THREE.Group | null = null;
let themeVu: any = null;
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

function construireLeStade(nCouloirs: number, th: any) {
  if (stade) { monde.remove(stade); stade.traverse((o: any) => { o.geometry?.dispose?.(); }); }
  stade = new THREE.Group();
  monde.add(stade);
  const largeur = nCouloirs * LANE_W;
  const X0 = -30, X1 = 140, LX = X1 - X0, XM = (X0 + X1) / 2;

  // le ciel, en degrade
  const ciel = texteCanvas((c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(th.skyTop || [57, 73, 178])); g.addColorStop(1, css(th.skyBot || [71, 87, 192], 1.25));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, 4, 256);
  scene.background = ciel;
  scene.fog = new THREE.Fog(c3(th.skyBot, [71, 87, 192]).getHex(), 120, 260);

  // la pelouse et sa tonte en bandes (les bandes traversent le stade)
  const herbe = th.grass || [29, 115, 17], bord = th.grassEdge || [18, 91, 9];
  const tonte = texteCanvas((c, w, h) => {
    for (let i = 0; i < 8; i++) { c.fillStyle = css(herbe, i % 2 ? 0.88 : 1.06); c.fillRect(i * w / 8, 0, w / 8, h); }
  }, 256, 8);
  tonte.wrapS = THREE.RepeatWrapping; tonte.repeat.set(LX / 40, 1);
  plan(LX, 160, new THREE.MeshLambertMaterial({ map: tonte }), XM, largeur / 2, -0.02);
  // le liseré d'herbe sombre le long de la piste
  plan(LX, 0.8, new THREE.MeshLambertMaterial({ color: c3(bord, bord) }), XM, -0.4 - 1.2, -0.01);
  plan(LX, 0.8, new THREE.MeshLambertMaterial({ color: c3(bord, bord) }), XM, largeur + 1.6, -0.01);

  // la piste : deux rouges qui alternent d'un couloir a l'autre, et ses lignes
  const A = th.trackA || [148, 0, 0], B = th.trackB || A;
  plan(LX, largeur + 2.4, new THREE.MeshLambertMaterial({ color: c3(A, A) }), XM, largeur / 2, 0);
  const matB = new THREE.MeshLambertMaterial({ color: c3(B, B) });
  for (let k = 1; k < nCouloirs; k += 2) plan(LX, LANE_W, matB, XM, (k + 0.5) * LANE_W, 0.001);
  const ligne = new THREE.MeshBasicMaterial({ color: c3(th.lane, [247, 242, 233]) });
  for (let k = 0; k <= nCouloirs; k++) plan(LX, 0.05, ligne, XM, k * LANE_W, 0.002);
  plan(0.05, largeur, ligne, 0, largeur / 2, 0.003);
  const damier = texteCanvas((c, w, h) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 40; j++) {
      c.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; c.fillRect(i * w / 4, j * h / 40, w / 4, h / 40);
    }
  }, 64, 640);
  plan(0.5, largeur, new THREE.MeshBasicMaterial({ map: damier }), 100.25, largeur / 2, 0.003);
  for (let k = 0; k < nCouloirs; k++) {
    const t = texteCanvas((c, w, h) => {
      c.fillStyle = css(th.lane || [247, 242, 233]); c.font = `900 ${h * 0.9}px system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(k + 1), w / 2, h / 2 + h * 0.04);
    }, 128, 128);
    const m = plan(1.0, 1.0, new THREE.MeshBasicMaterial({ map: t, transparent: true }), -2.2, (k + 0.5) * LANE_W, 0.004);
    m.rotation.z = -Math.PI / 2;
    m.scale.x = -1;   // le monde est en miroir (voir initialiser) : le chiffre, lui, se lit a l'endroit
  }

  // LA TRIBUNE, en face de la camera : panneaux, barriere, marches, sieges, public, toit
  const yP = -2.2;                       // les panneaux, au bord de la piste
  const base = (import.meta as any).env?.BASE_URL || '/';
  const pub = new THREE.TextureLoader().load(base + 'pubs/benbezi-logo-3d-cadre.webp');
  pub.colorSpace = THREE.SRGBColorSpace; pub.wrapS = THREE.RepeatWrapping; pub.repeat.set(LX / 5, 1);
  const panneau = new THREE.Mesh(new THREE.PlaneGeometry(LX, 1.03),
    new THREE.MeshBasicMaterial({ map: pub, color: 0xffffff }));
  panneau.position.set(XM, yP, 0.55); panneau.rotation.x = Math.PI / 2; panneau.rotation.y = Math.PI;
  panneau.scale.x = -1;
  stade.add(panneau);
  const dos = new THREE.Mesh(new THREE.BoxGeometry(LX, 0.12, 1.1), new THREE.MeshLambertMaterial({ color: 0x14161d }));
  dos.position.set(XM, yP - 0.08, 0.55); stade.add(dos);

  const RANGS = 12, PROF = 0.85, MONTE = 0.42, y0 = yP - 2.6;
  const marche = new THREE.MeshLambertMaterial({ color: c3(th.tread, [175, 177, 187]) });
  const contre = new THREE.MeshLambertMaterial({ color: c3(th.riser, [130, 135, 150]) });
  const muret = new THREE.Mesh(new THREE.BoxGeometry(LX, 0.25, 1.15), new THREE.MeshLambertMaterial({ color: c3(th.barrier, [231, 234, 239]) }));
  muret.position.set(XM, y0 + 0.3, 0.575); stade.add(muret);
  for (let r = 0; r < RANGS; r++) {
    const z = 1.0 + r * MONTE, y = y0 - r * PROF;
    const t = new THREE.Mesh(new THREE.BoxGeometry(LX, PROF, 0.08), marche);
    t.position.set(XM, y - PROF / 2, z); t.receiveShadow = true; stade.add(t);
    const c = new THREE.Mesh(new THREE.BoxGeometry(LX, 0.06, MONTE), contre);
    c.position.set(XM, y - PROF, z + MONTE / 2); stade.add(c);
  }
  // les sieges bleus et leur public : instancies, un appel de dessin chacun
  const PAS = 0.55, parRang = Math.floor(LX / PAS), N = RANGS * parRang;
  const sieges = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.4, 0.34),
    new THREE.MeshLambertMaterial({ color: 0x2457b8 }), N);
  const bustes = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.17, 0.32, 3, 8), new THREE.MeshLambertMaterial(), N);
  const tetes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshLambertMaterial(), N);
  const lo = th.crowdLo || [43, 38, 56], hi = th.crowdHi || [252, 242, 230];
  const panneaux: number[][] = th.panels || [[231, 60, 45], [28, 106, 202], [255, 203, 55], [50, 162, 121]];
  const peaux = [[74, 46, 32], [120, 76, 50], [176, 122, 78], [224, 186, 142], [246, 220, 190]];
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  let alea = 7;
  const hasard = () => ((alea = (alea * 16807) % 2147483647) / 2147483647);
  let n = 0, nb = 0;
  for (let r = 0; r < RANGS; r++) {
    const z = 1.0 + r * MONTE, y = y0 - r * PROF - PROF * 0.55;
    for (let i = 0; i < parRang; i++, n++) {
      const x = X0 + (i + 0.5) * PAS;
      sieges.setMatrixAt(n, m4.makeTranslation(x, y, z + 0.2));
      if (hasard() < 0.72) {          // trois places sur quatre sont prises
        const u = hasard();
        const mail = u < 0.5 ? panneaux[(hasard() * panneaux.length) | 0] : [lo, hi][(hasard() * 2) | 0];
        bustes.setMatrixAt(nb, m4.makeRotationX(Math.PI / 2).setPosition(x + (hasard() - 0.5) * 0.08, y - 0.02, z + 0.62));
        bustes.setColorAt(nb, col.setRGB(mail[0] / 255, mail[1] / 255, mail[2] / 255, THREE.SRGBColorSpace));
        const pe = peaux[(hasard() * peaux.length) | 0];
        tetes.setMatrixAt(nb, m4.makeTranslation(x, y - 0.03, z + 1.0 + hasard() * 0.05));
        tetes.setColorAt(nb, col.setRGB(pe[0] / 255, pe[1] / 255, pe[2] / 255, THREE.SRGBColorSpace));
        nb++;
      }
    }
  }
  bustes.count = nb; tetes.count = nb;
  for (const m of [sieges, bustes, tetes]) { m.frustumCulled = false; stade.add(m); }
  // le toit, sur ses poteaux
  const yT = y0 - RANGS * PROF, zT = 1.0 + RANGS * MONTE + 2.6;
  const toit = new THREE.Mesh(new THREE.BoxGeometry(LX, RANGS * PROF + 2.5, 0.25), new THREE.MeshLambertMaterial({ color: c3(th.roof, [76, 81, 100]) }));
  toit.position.set(XM, (y0 + yT) / 2 + 0.6, zT); stade.add(toit);
  const fond = new THREE.Mesh(new THREE.BoxGeometry(LX, 0.3, zT), new THREE.MeshLambertMaterial({ color: c3(th.roof, [76, 81, 100]) }));
  fond.position.set(XM, yT - 0.15, zT / 2); stade.add(fond);
  const poteau = new THREE.MeshLambertMaterial({ color: 0xd8dbe2 });
  for (let x = X0 + 6; x < X1; x += 18) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, zT, 8), poteau);
    p.rotation.x = Math.PI / 2; p.position.set(x, y0 + 0.2, zT / 2); stade.add(p);
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
