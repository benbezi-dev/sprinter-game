// LA BETE EN VRAI MAILLAGE — le molosse fait dans TRELLIS.2.
//
// Le trace de halloween-molosse.js dessinait la bete en capsules. Celle-ci
// vient d'une image (FLUX), passee dans TRELLIS.2, riggee et mise au galop par
// tools/blender/molosse_trellis.py : un maillage d'un seul tenant, et une
// foulee en boucle que le jeu cale sur la distance, comme le trace.
//
// LE MEME PROFIL TRICHE QUE LE TRACE. La camera du jeu regarde la bete de
// trois quarts arriere : une vraie projection montrerait sa croupe, jamais sa
// gueule ni ses yeux (voir aussi tools/blender/molosse.py, qui l'avait vu). Le
// maillage est donc rendu DE PROFIL — vu de son flanc, legerement d'en haut —
// puis halloween-molosse.js le couche sur l'axe de la piste, exactement comme
// il couchait son trace. La hauteur ne se raccourcit pas (ecran = z + y sin),
// comme celle des personnages du jeu.
//
// SA DOUBLURE. Tant que le maillage n'est pas charge, que WebGL manque ou que
// le rendu echoue, halloween-molosse.js dessine le trace : on ne voit jamais
// un trou. Rien ici ne part dans le paquet public : ce module n'est demande
// que par la nuit du molosse, et le fichier ne l'est que par lui.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

type Bete = {
  racine: THREE.Group;
  melangeur: THREE.AnimationMixer;
  duree: number;
  /** Les deux yeux (os oeil_g, oeil_d) : le trace y pose son halo. */
  yeux: THREE.Object3D[];
  /** De l'origine (le sol sous le milieu du corps) au bout de la gueule, en metres. */
  museau: number;
};

// Le repere du modele (glTF, y en haut) vers celui de la bete (x en avant,
// y a sa gauche, z en haut) : Blender exporte (x, y, z) en (x, z, -y).
const Q = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);

/**
 * LA BETE EST PLUS GRANDE QUE LE TRACE (08/10, « plus grand la bete », puis
 * « plus haut ») : 1,60 m au garrot contre 1,00 — son dos arrive a l'epaule du
 * coureur. Ce chiffre est celui du GLB, pose a l'export
 * (`molosse_trellis.py --garrot 1.6`) — il ne le change pas, il le dit au
 * jeu, et les deux doivent rester egaux. Le cadre ci-dessous et l'ombre de
 * halloween-molosse.js en tirent leur mesure. Le galop, lui, n'a rien a
 * suivre : son amplitude est en metres de sol, et le pied ne patine pas plus.
 */
export const GARROT_DU_MAILLAGE = 1.6;

/**
 * LE CADRE DE L'IMAGE, en metres autour de l'origine de la bete (le sol sous
 * le milieu de son corps). De la queue au museau, et des pieds aux cretes —
 * la tete basse et la queue tendue y tiennent au galop. Regle sur la bete
 * d'un metre, il grandit avec elle.
 */
const E = GARROT_DU_MAILLAGE;
const AVANT = 1.9 * E, ARRIERE = 1.9 * E, DESSUS = 1.75 * E, DESSOUS = 0.35 * E;

/** Les facettes des coureurs du jeu (vedette-3d.ts, FACETTES) : une face, une teinte. */
const FACETTES = true;

/**
 * LE FICHIER EST FACULTATIF. Tant que le maillage TRELLIS n'est pas dans
 * src/assets, cette table est vide, le module ne charge rien et le trace
 * reste : le jeu se construit et tourne sans lui. Un import direct aurait
 * casse le build au premier depot sans le fichier.
 */
const FICHIERS = import.meta.glob('/src/assets/molosse.glb', { query: '?url', import: 'default' }) as
  Record<string, () => Promise<string>>;

let bete: Bete | null = null;
let enCours: Promise<Bete | null> | null = null;
let rendu: THREE.WebGLRenderer | null = null;
let refuse = false;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera();
camera.matrixAutoUpdate = false;

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
 * LA LUMIERE DE LA NUIT, pas celle du stade. Une lune froide qui tombe du
 * cote du joueur, un ciel sombre qui remplit a peine, et SURTOUT LA BRAISE
 * DANS LE DOS : une lumiere orange qui vient de derriere et d'en haut, et qui
 * allume l'echine et les cretes. C'est le fil de lumiere du trace (POIL_CLAIR
 * sur l'echine) : une bete noire, la nuit, sur un fond sombre, ne se detache
 * que par son contour.
 */
/**
 * ELLES SONT POSEES POUR LA VUE DE PROFIL — la camera du cote -y — et
 * tournent avec la vue (voir dessiner) : au virage, vue de dos, la braise
 * fixee sur la bete lui eclairait la croupe en plein, et la bete noire
 * sortait brune.
 */
const eclairage = new THREE.Group();
eclairage.matrixAutoUpdate = false;
function lumieres() {
  scene.add(eclairage);
  const lune = new THREE.DirectionalLight(0xc8d4ff, 2.2);
  lune.position.set(0.5, -1.0, 1.4);
  eclairage.add(lune); scene.add(lune.target);
  const braise = new THREE.DirectionalLight(0xff8a30, 3.2);
  braise.position.set(-0.6, 1.0, 0.9);
  eclairage.add(braise); scene.add(braise.target);
  const ciel = new THREE.HemisphereLight(0x8a90b8, 0x2a1c18, 1.1);
  ciel.position.set(0, 0, 1);
  scene.add(ciel);
}

/**
 * La finition premium (rendu-premium.js) ne juge pas les images pendant que
 * three.js, le fichier et les shaders arrivent : un travail qui finit, pas ce
 * que l'appareil tient (voir nePasJuger, vedette-3d.ts).
 */
function nePasJuger() {
  const P = (globalThis as any).RenduPremium;
  if (P) P.composeDAvance = Math.max(P.composeDAvance || 0, performance.now() + 1000);
}

/** Demander la bete. Rend null si elle ne peut pas l'etre (le trace reste). */
export function charger(): Promise<Bete | null> {
  if (bete) return Promise.resolve(bete);
  if (enCours) return enCours;
  const fichier = Object.values(FICHIERS)[0];
  if (!fichier) return Promise.resolve(null);
  const R = renduWebGL();
  nePasJuger();
  if (!R) return Promise.resolve(null);
  enCours = fichier().then((u) => new Promise<Bete | null>((ok) => {
    const chargeur = new GLTFLoader();
    chargeur.setMeshoptDecoder(MeshoptDecoder);
    chargeur.load(u, (gltf) => {
      nePasJuger();
      let b: Bete;
      try { b = preparer(gltf); } catch { ok(null); return; }
      prechauffer(b).then(() => { bete = b; ok(b); });
    }, undefined, () => ok(null));
  })).catch(() => null);
  const tenir = () => { nePasJuger(); if (!bete && enCours) requestAnimationFrame(tenir); };
  tenir();
  // un echec ne condamne pas la nuit suivante : elle le redemandera
  enCours.then((b) => { if (!b) enCours = null; });
  return enCours;
}

function preparer(gltf: any): Bete {
  const racine = new THREE.Group();
  racine.matrixAutoUpdate = false;
  racine.matrix.copy(Q);
  racine.add(gltf.scene);
  const yeux: THREE.Object3D[] = [];
  gltf.scene.traverse((o: any) => {
    if (o.isBone && /^oeil_/.test(o.name)) yeux.push(o);
    if (o.isMesh) {
      o.frustumCulled = false;
      if (FACETTES && o.geometry.index) {
        o.geometry = o.geometry.toNonIndexed();
        o.geometry.computeVertexNormals();
      }
    }
  });
  const clip = gltf.animations.find((a: THREE.AnimationClip) => a.name === 'galop') || gltf.animations[0];
  if (!clip) throw new Error('pas de galop');
  const melangeur = new THREE.AnimationMixer(gltf.scene);
  melangeur.clipAction(clip).play();
  scene.add(racine);
  racine.visible = false;
  // l'oeil droit d'abord : y negatif, du cote de la camera
  yeux.sort((a, b) => a.name.localeCompare(b.name));
  // LA GUEULE, MESUREE ET NON SUPPOSEE : le point le plus en avant de la bete
  // debout, avant que le galop ne la mette en mouvement. Elle grandit avec le
  // GLB sans qu'on ait a la recopier nulle part.
  racine.updateMatrixWorld(true);
  const museau = Math.max(0, new THREE.Box3().setFromObject(racine).max.x);
  return { racine, melangeur, duree: clip.duration, yeux, museau };
}

/**
 * Ses shaders sont compiles avant qu'elle n'apparaisse, pendant que le trace
 * tient sa place : sinon le premier dessin les compilait au milieu de la
 * course (pres d'une demi-seconde de gel, mesure pour les vedettes).
 */
async function prechauffer(b: Bete) {
  const R = rendu;
  if (!R) return;
  try {
    await Promise.race([R.compileAsync(b.racine, camera, scene), new Promise((ok) => setTimeout(ok, 4000))]);
    nePasJuger();
    b.racine.visible = true;
    R.setSize(64, 64, false);
    R.render(scene, camera);
    b.racine.visible = false;
  } catch { /* le premier vrai dessin fera le reste */ }
  nePasJuger();
}

export function pret(): boolean { return bete !== null; }

/** Ou est sa gueule, en metres devant son origine (0 tant qu'elle n'est pas la). */
export function museau(): number { return bete ? bete.museau : 0; }

const _v = new THREE.Vector3();

/** La demi-largeur du cadre, de flanc a flanc, en metres. */
const FLANC = 0.5 * E;

/**
 * Dessiner la bete dans `ctx`, deja posee par halloween-molosse.js : son
 * origine au sol sous le milieu du corps, dans le repere de l'ecran (pas de
 * cisaillement), `k` pixels par metre de hauteur.
 *
 * `cycle` : la phase de la foulee, de 0 a 1 (la distance, pas l'horloge).
 *
 * `av`, `ga` : ce que deviennent a l'ecran un metre vers l'avant de la bete et
 * un metre vers sa gauche, en pixels — la projection du jeu a l'endroit ou
 * elle court (halloween-molosse.js, pieces). En ligne droite `ga` n'y garde
 * que sa part verticale : c'est le profil triche, la gueule de flanc et le
 * dos un peu vu d'en haut. Au virage elle reprend sa part horizontale, et la
 * bete qui s'eloigne dans la courbe montre sa croupe et sa largeur.
 *
 * Rend la place de ses yeux dans le repere de `ctx` (le plus proche d'abord),
 * ou null si le maillage n'est pas pret — le trace se dessine alors.
 */
export function dessiner(ctx: CanvasRenderingContext2D, cycle: number, k: number,
                         av: number[], ga: number[]): [number, number][] | null {
  const b = bete, R = rendu;
  if (!b || !R) return null;
  try {
    // L'ECRAN, ligne par ligne, en fonction de (avant, gauche, haut) :
    // x = r1 . p, y = r2 . p (vers le bas).
    const r1 = new THREE.Vector3(av[0], ga[0], 0);
    const r2 = new THREE.Vector3(av[1], ga[1], -k);
    // LA PROFONDEUR SE COMPTE LE LONG DU RAYON. La seule direction qui ne
    // bouge pas l'image est celle de la vue (r1 x r2) : deux points d'un meme
    // pixel ne different que par elle, et c'est tout ce que le tampon a a
    // trancher. On l'oriente pour qu'elle descende en s'eloignant — la camera
    // est au-dessus. Si cette orientation inverse le sens de rotation des
    // faces, on peint l'image en miroir et la toile la retourne.
    const vue = new THREE.Vector3().crossVectors(r1, r2);
    if (vue.lengthSq() < 1e-9) return null;
    vue.normalize();
    const miroir = vue.z > 0;
    if (miroir) vue.negate();

    // LE CADRE : les huit coins de la boite de la bete, projetes.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, d0 = Infinity, d1 = -Infinity;
    for (const ax of [-ARRIERE, AVANT]) for (const ay of [-FLANC, FLANC]) for (const az of [-DESSOUS, DESSUS]) {
      _v.set(ax, ay, az);
      const sx = r1.dot(_v), sy = r2.dot(_v), sd = vue.dot(_v);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx);
      y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      d0 = Math.min(d0, sd); d1 = Math.max(d1, sd);
    }
    const L = x1 - x0, H = y1 - y0, D = (d1 - d0) || 1;

    // L'IMAGE A LA DENSITE DE LA TOILE (vedette-3d.ts) : rendue a un pixel
    // par point puis agrandie, elle sortait floue a cote des coureurs.
    const tr = ctx.getTransform ? ctx.getTransform() : null;
    const dens = tr ? Math.max(1, Math.min(3, Math.hypot(tr.a, tr.b))) : 1;
    const W = Math.min(2048, Math.ceil(L * dens)), Hp = Math.min(2048, Math.ceil(H * dens));
    if (W < 2 || Hp < 2) return null;
    if (R.domElement.width !== W || R.domElement.height !== Hp) R.setSize(W, Hp, false);

    b.melangeur.setTime(((cycle % 1) + 1) % 1 * b.duree);
    b.racine.matrix.copy(Q);
    b.racine.updateMatrixWorld(true);
    // la lumiere suit la vue : de profil (vue vers +y) elle ne bouge pas
    eclairage.matrix.makeRotationZ(Math.atan2(vue.y, vue.x) - Math.PI / 2);
    eclairage.updateMatrixWorld(true);

    // De l'ecran au cadre normalise : x et y dans [-1, 1] (y vers le haut),
    // la profondeur aussi, proche = -1.
    const sxn = (miroir ? -2 : 2) / L, syn = -2 / H, sdn = 2 / D;
    const P = new THREE.Matrix4().set(
      sxn * r1.x, sxn * r1.y, sxn * r1.z, -sxn * (x0 + x1) / 2,
      syn * r2.x, syn * r2.y, syn * r2.z, -syn * (y0 + y1) / 2,
      sdn * vue.x, sdn * vue.y, sdn * vue.z, -sdn * (d0 + d1) / 2,
      0, 0, 0, 1);
    // une vue orthonormee pour l'eclairage : la camera regarde vers +y
    const V = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1),
                                            new THREE.Vector3(0, -1, 0)).invert();
    camera.matrixWorld.copy(V).invert();
    camera.matrixWorldInverse.copy(V);
    camera.projectionMatrix.multiplyMatrices(P, camera.matrixWorld);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

    b.racine.visible = true;
    R.render(scene, camera);
    b.racine.visible = false;
    if (miroir) {
      ctx.save();
      ctx.translate(x0 + x1, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(R.domElement, 0, 0, W, Hp, x0, y0, L, H);
      ctx.restore();
    } else {
      ctx.drawImage(R.domElement, 0, 0, W, Hp, x0, y0, L, H);
    }

    return b.yeux.map((o) => {
      o.getWorldPosition(_v);
      return [r1.dot(_v), r2.dot(_v)] as [number, number];
    });
  } catch {
    return null;
  }
}
