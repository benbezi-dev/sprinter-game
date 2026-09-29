// UN ATHLETE EN VRAI MAILLAGE, dans un jeu de troncs de cone.
//
// Le moteur dessine ses coureurs en troncs, un par morceau de membre : c'est ce
// qui en fait courir huit dans un virage, et c'est aussi pourquoi, de pres, un
// corps s'y lit comme un assemblage. Le skin premium de Meba-Mickael Zeze est
// un corps d'un seul tenant (tools/blender/meba_maillage.py) : ce module le
// pose et le rend, et drawRunner (sprinter-app.js) colle l'image a sa place.
//
// RIEN N'EST ANIME ICI. Les gestes sont ceux de pose() : la foulee canon, la
// fatigue, le rituel dans les blocs, le clap. pose() releve au passage les
// angles qu'il vient de calculer (r.squelette) ; on les donne aux os du
// maillage avec la meme convention — un angle absolu dans le plan de course,
// 0 le membre vers le bas, positif vers l'avant ; puis le roulis autour de
// l'axe de course, puis le lacet —, verifiee dans Blender. Le maillage ne peut
// donc pas faire un geste que ses tubes ne font pas.
//
// LA MEME CAMERA QUE LES TUBES. Un point du monde (x vers l'avant, y a gauche,
// z en haut) tombe a l'ecran en ((y - x) cos, -(x + y) sin - z), exactement
// comme dans drawSegmentFacets ; la profondeur est celle du tri des facettes
// (VIEW). La projection est donc ecrite a la main plutot que tiree d'une
// camera orthographique : c'est une axonometrie, pas une vue orthonormee.
//
// SA DOUBLURE. Tant que le maillage n'est pas charge, que WebGL manque ou que
// le rendu echoue, drawRunner dessine les tubes : on ne voit jamais un trou.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

type Squelette = {
  hip: number[]; angB: number; lean: number; yawHip: number; yawTop: number; tete: number;
  jambes: { side: number; th: number; sk: number; ft: number; yT: number; yS: number; yF: number }[];
  bras: { side: number; a: number; f: number; rB: number; rAv: number }[];
  mains: 'poing' | 'plat' | 'sol';
};

type Modele = {
  racine: THREE.Group;
  os: Map<string, THREE.Bone>;
  ordre: THREE.Bone[];
  /** L'orientation de chaque os au repos, dans le repere du modele. */
  repos: Map<THREE.Bone, THREE.Quaternion>;
  reposLocal: Map<THREE.Bone, THREE.Quaternion>;
  /** Le parent du bassin, au repos : pour y poser la hanche. */
  bassinParent: THREE.Matrix4;
};

// Le repere du modele (glTF, y en haut) vers celui du jeu (z en haut) :
// Blender exporte (x, y, z) en (x, z, -y).
const Q = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
const Qi = Q.clone().invert();
const qQ = new THREE.Quaternion().setFromRotationMatrix(Q);
const qQi = qQ.clone().invert();

/** De combien la peau remonte a l'ecran du jeu (lineaire : 1,9 = x1,33 en sRGB). */
const ECLAIRCIR_PEAU = 1.9;

const modeles = new Map<string, Modele>();
const enCours = new Map<string, Promise<Modele | null>>();
let rendu: THREE.WebGLRenderer | null = null;
let refuse = false;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera();
camera.matrixAutoUpdate = false;

function moteur(): any { return (globalThis as any).SprinterCore; }

/** Le chemin d'un fichier de public/, sous la base du deploiement. */
function url(chemin: string): string {
  return import.meta.env.BASE_URL.replace(/\/?$/, '/') + chemin.replace(/^\//, '');
}

function renduWebGL(): THREE.WebGLRenderer | null {
  if (rendu || refuse) return rendu;
  try {
    const cv = document.createElement('canvas');
    rendu = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, premultipliedAlpha: true });
    rendu.setPixelRatio(1);
    rendu.outputColorSpace = THREE.SRGBColorSpace;
    rendu.toneMapping = THREE.NoToneMapping;
    rendu.setClearColor(0x000000, 0);
    lumieres();
  } catch {
    refuse = true; rendu = null;
  }
  return rendu;
}

/**
 * LA LUMIERE DU STADE : celle des facettes (LIGHT, sprinter-core.js) — un
 * soleil haut, et un ciel qui remplit les ombres. Les tubes melangent une part
 * fixe et une part tournee vers le soleil ; un soleil et un ciel font la meme
 * chose, sur une peau lisse.
 */
function lumieres() {
  const L = (moteur() && moteur().LIGHT) || [0.4, -0.3, 0.87];
  const soleil = new THREE.DirectionalLight(0xffffff, 3.0);
  soleil.position.set(L[0] * 10, L[1] * 10, L[2] * 10);
  scene.add(soleil); scene.add(soleil.target);
  const ciel = new THREE.HemisphereLight(0xdfe8ff, 0x6a5040, 1.5);
  ciel.position.set(0, 0, 1);
  scene.add(ciel);
}

/** Charger un maillage d'athlete. Rend null s'il ne peut pas l'etre. */
export function charger(chemin: string): Promise<Modele | null> {
  if (modeles.has(chemin)) return Promise.resolve(modeles.get(chemin)!);
  if (enCours.has(chemin)) return enCours.get(chemin)!;
  if (!renduWebGL()) return Promise.resolve(null);
  const p = new Promise<Modele | null>((ok) => {
    const chargeur = new GLTFLoader();
    chargeur.setMeshoptDecoder(MeshoptDecoder);
    chargeur.load(url(chemin), (gltf) => {
      try { const m = preparer(gltf.scene); modeles.set(chemin, m); ok(m); } catch { ok(null); }
    }, undefined, () => ok(null));
  });
  enCours.set(chemin, p);
  return p;
}

function preparer(racineGltf: THREE.Object3D): Modele {
  const racine = new THREE.Group();
  racine.matrixAutoUpdate = false;
  racine.add(racineGltf);
  racineGltf.updateMatrixWorld(true);
  const os = new Map<string, THREE.Bone>();
  racineGltf.traverse((o: any) => {
    if (o.isBone) os.set(o.name, o);
    if (o.isMesh) {
      o.frustumCulled = false;
      // LA PEAU, ECLAIRCIE POUR LE STADE. Sa teinte est celle des portraits
      // (Cycles, un studio sombre) ; sous le soleil et le ciel de la piste
      // elle tombait presque au noir, bien plus sombre que sa doublure en
      // tubes. On la remonte ici, au chargement, sans toucher aux portraits.
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        // et les levres avec elle : la levre du bas est plus claire que la
        // peau, celle du haut plus sombre — eclaircie seule, la peau passait
        // devant les deux
        if (m && (m.name === 'Meba_peau' || m.name.startsWith('Meba_levre')) && m.color) {
          m.color.multiplyScalar(ECLAIRCIR_PEAU);
        }
      }
    }
  });
  const prof = (b: THREE.Object3D) => { let n = 0; while (b.parent) { b = b.parent; n++; } return n; };
  const ordre = [...os.values()].sort((a, b) => prof(a) - prof(b));
  const repos = new Map<THREE.Bone, THREE.Quaternion>();
  const reposLocal = new Map<THREE.Bone, THREE.Quaternion>();
  const inv = new THREE.Matrix4().copy(racineGltf.matrixWorld).invert();
  for (const b of ordre) {
    const m = new THREE.Matrix4().multiplyMatrices(inv, b.matrixWorld);
    repos.set(b, new THREE.Quaternion().setFromRotationMatrix(m));
    reposLocal.set(b, b.quaternion.clone());
  }
  const bassin = os.get('pelvis')!;
  const bassinParent = new THREE.Matrix4().multiplyMatrices(inv, bassin.parent!.matrixWorld);
  scene.add(racine);
  racine.visible = false;
  return { racine, os, ordre, repos, reposLocal, bassinParent };
}

export function pret(chemin: string): boolean { return modeles.has(chemin); }

// --- LA POSE -------------------------------------------------------------------
const _R = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qa = new THREE.Quaternion();
const _v = new THREE.Vector3();

/** L'orientation du jeu (lacet . roulis . angle), passee dans le repere du modele. */
function orientation(a: number, roule: number, lacet: number, out: THREE.Quaternion) {
  const g = new THREE.Matrix4().makeRotationZ(lacet)
    .multiply(new THREE.Matrix4().makeRotationX(roule))
    .multiply(new THREE.Matrix4().makeRotationY(-a));
  _R.multiplyMatrices(Qi, g).multiply(Q);
  return out.setFromRotationMatrix(_R);
}

// Les doigts : un poing pour courir, la main plate pour frapper, ouverte au sol.
const PHALANGES = ['index', 'middle', 'ring', 'pinky'];
const COURBE = { poing: [1.25, 1.45, 1.05], plat: [0.08, 0.06, 0.04], sol: [0.35, 0.30, 0.20] };
const POUCE = { poing: [0.35, 0.55, 0.45], plat: [0.05, 0.05, 0.05], sol: [0.15, 0.2, 0.2] };

function poser(m: Modele, sq: Squelette) {
  const cibles = new Map<string, [number, number, number]>();
  cibles.set('pelvis', [sq.angB, 0, sq.yawHip]);
  for (const n of ['spine_01', 'spine_02', 'spine_03']) cibles.set(n, [sq.lean, 0, sq.yawTop]);
  cibles.set('clavicle_l', [sq.lean, 0, sq.yawTop]);
  cibles.set('clavicle_r', [sq.lean, 0, sq.yawTop]);
  cibles.set('neck_01', [sq.lean + sq.tete * 0.4, 0, sq.yawTop * 0.5]);
  cibles.set('head', [sq.lean + sq.tete, 0, sq.yawTop * 0.2]);
  for (const j of sq.jambes) {
    const c = j.side > 0 ? '_l' : '_r';
    cibles.set('thigh' + c, [j.th, 0, j.yT]);
    cibles.set('calf' + c, [j.sk, 0, j.yS]);
    cibles.set('foot' + c, [j.ft, 0, j.yF]);
  }
  for (const b of sq.bras) {
    const c = b.side > 0 ? '_l' : '_r';
    cibles.set('upperarm' + c, [b.a, b.rB, sq.yawTop]);
    cibles.set('lowerarm' + c, [b.f, b.rAv, sq.yawTop]);
    cibles.set('hand' + c, [b.f, b.rAv, sq.yawTop]);
  }
  const monde = new Map<THREE.Bone, THREE.Quaternion>();
  const courbe = COURBE[sq.mains] || COURBE.poing, pouce = POUCE[sq.mains] || POUCE.poing;
  for (const b of m.ordre) {
    const parent = b.parent as THREE.Bone;
    const qp = monde.get(parent) || null;
    const t = cibles.get(b.name);
    let qm: THREE.Quaternion;
    if (t) {
      qm = orientation(t[0], t[1], t[2], new THREE.Quaternion()).multiply(m.repos.get(b)!);
    } else {
      // l'os suit son parent, avec son orientation de repos sous lui
      const qr = m.reposLocal.get(b)!.clone();
      const doigt = b.name.split('_');
      if (PHALANGES.includes(doigt[0]) || doigt[0] === 'thumb') {
        const k = Math.max(0, Math.min(2, (parseInt(doigt[1], 10) || 1) - 1));
        const a = (doigt[0] === 'thumb' ? pouce : courbe)[k];
        qr.multiply(_qa.setFromAxisAngle(_v.set(1, 0, 0), a));
      }
      qm = (qp ? qp.clone() : new THREE.Quaternion()).multiply(qr);
    }
    monde.set(b, qm);
    b.quaternion.copy(qp ? qp.clone().invert().multiply(qm) : qm);
  }
  // la hanche : ou pose() l'a mise, le pivot des cuisses deux centimetres dessous
  const bassin = m.os.get('pelvis')!;
  _v.set(sq.hip[0], sq.hip[1], sq.hip[2] - 0.02).applyMatrix4(Qi);
  bassin.position.copy(_v.applyMatrix4(m.bassinParent.clone().invert()));
}

// --- LE RENDU ------------------------------------------------------------------

/**
 * Dessiner l'athlete dans `ctx`, a la place de ses tubes.
 *
 * `repere` : les images des trois axes par repereDuCoureur (sprinter-app.js) ;
 * (ax, ay) : l'origine du coureur a l'ecran ; k : pixels par metre du rig.
 * Rend faux si le maillage n'est pas pret — drawRunner dessine alors les tubes.
 */
export function dessiner(ctx: CanvasRenderingContext2D, chemin: string, sq: Squelette | null,
                         repere: number[][], ax: number, ay: number, k: number): boolean {
  const m = modeles.get(chemin);
  const R = rendu;
  const C = moteur() && moteur().C;
  if (!m || !R || !sq || !C) return false;
  try {
    const S = Math.max(48, Math.min(1600, Math.ceil(k * 2.5)));
    const oy = S * 0.80;
    if (R.domElement.width !== S || R.domElement.height !== S) R.setSize(S, S, false);
    poser(m, sq);
    // le repere du coureur (tourne, bascule, miroir), puis le passage glTF -> jeu
    const [ex, ey, ez] = repere;
    const M = new THREE.Matrix4().set(ex[0], ey[0], ez[0], 0, ex[1], ey[1], ez[1], 0,
                                      ex[2], ey[2], ez[2], 0, 0, 0, 0, 1);
    m.racine.matrix.multiplyMatrices(M, Q);
    m.racine.matrixWorldNeedsUpdate = true;
    // l'axonometrie du jeu, ecrite a la main : ecran = ((y-x) cos, -(x+y) sin - z)
    const cs = C.ISO_COS, sn = C.ISO_SIN;
    const VIEW = new THREE.Vector3(cs, cs, -2 * cs * sn).normalize();
    const P = new THREE.Matrix4().set(
      -cs * k * 2 / S, cs * k * 2 / S, 0, 0,
      sn * k * 2 / S, sn * k * 2 / S, k * 2 / S, 1 - 2 * oy / S,
      VIEW.x / 4, VIEW.y / 4, VIEW.z / 4, 0,
      0, 0, 0, 1);
    // une vue orthonormee pour l'eclairage (le regard est VIEW), le reste
    // dans la projection : projection x vue = P
    const zc = VIEW.clone().negate();
    const xc = new THREE.Vector3(-1, 1, 0).addScaledVector(zc, -new THREE.Vector3(-1, 1, 0).dot(zc)).normalize();
    const yc = new THREE.Vector3().crossVectors(zc, xc);
    const V = new THREE.Matrix4().makeBasis(xc, yc, zc).invert();
    camera.matrixWorld.copy(V).invert();
    camera.matrixWorldInverse.copy(V);
    camera.projectionMatrix.multiplyMatrices(P, new THREE.Matrix4().copy(V).invert());
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    for (const o of modeles.values()) o.racine.visible = o === m;
    R.render(scene, camera);
    m.racine.visible = false;
    ctx.drawImage(R.domElement, ax - S / 2, ay - oy);
    return true;
  } catch {
    return false;
  }
}

// Le moteur (sprinter-app.js, du JavaScript sans import) le trouve ici.
(globalThis as any).SprinterVedette3D = { charger, pret, dessiner };
