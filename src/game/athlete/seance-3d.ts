/* ---------------------------------------------------------------------------
   LES SEANCES EN 3D (l'auteur, 15/11 : « Oui, en 3D »)
   ---------------------------------------------------------------------------
   Chaque seance de la carriere se joue dans un vrai lieu en trois dimensions :
   le stade (piste, tribune, public, blocs), le virage (un vrai arc de 200 m dans
   son anneau de gradins), la cote boisee, le parc, la salle de musculation, la
   chambre. L'athlete est le corps premium de la ville (corps3D, ville.ts), pose a
   chaque image sur le squelette du moteur (personCapsules -> poser), comme les
   habitants : les jeux (SeancesAthlete.tsx) pilotent le meme etat qu'en 2D.

   L'athlete reste a l'origine, face a +x, la camera fixe sur son flanc ; c'est le
   monde qui defile (ou tourne, au virage ; ou monte, a la cote). Un seul rendu
   WebGL, une seule ombre portee (celle du corps), des primitives et des toiles
   peintes une fois : leger pour les telephones faibles. Si le WebGL manque, la
   seance garde son dessin 2D (SeancesAthlete.tsx).
--------------------------------------------------------------------------- */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SprinterApp } from '../engine';
import { chargeurGLTF, brancherKTX2 } from '../chargeur-gltf';
import { poser } from '../vedette-3d';
import { corps3D } from './ville';

export type Lieu3D = 'piste' | 'virage' | 'cote' | 'parc' | 'salle' | 'tapis';

/** Ce que la scene 2D pilote (EtatScene de SeancesAthlete.tsx), vu d'ici. */
export type Etat3D = {
  decor: Lieu3D; corps: any; cap: number; incline: number; defile: number; pente: number; vol: number;
  couloir: number; barre: number | null; zone: [number, number] | null;
};

/** Les peintures 2D reutilisees comme textures (SeancesAthlete.tsx les possede). */
export type Pinceaux = {
  tribune: (c: CanvasRenderingContext2D, w: number, h: number) => void;
  ciel: (c: CanvasRenderingContext2D, w: number, h: number, lieu: Lieu3D) => void;
  montagnes: (c: CanvasRenderingContext2D, w: number, h: number) => void;
  affiche: (c: CanvasRenderingContext2D, w: number, h: number) => void;
};

/** Ou tombe l'athlete a l'ecran : la couche 2D y pose sa poussiere et ses traits. */
export type Projection = { ax: number; sol: number; ppm: number; corps: boolean };

const PROFIL = Math.PI / 2 + 0.2;
const COULOIR = 1.22;
/** Le couloir de l'athlete au virage : 36,5 m a la corde + 4,5 couloirs. */
const R_VIRAGE = 36.8 + COULOIR * 4.5;
const fixe = (i: number) => ((Math.sin(i * 127.1) * 43758.5453) % 1 + 1) % 1;

const faible = () => {
  const n = navigator as any;
  return (n.deviceMemory && n.deviceMemory <= 4) || (n.hardwareConcurrency && n.hardwareConcurrency <= 4);
};

export function webglPossible(): boolean {
  // (16/11) le contexte d'essai est rendu aussitot : garde jusqu'au ramasse-miettes, chaque seance en laissait un de
  // plus, et un telephone n'en tient que quelques-uns a la fois
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch { return false; }
}

/**
 * LE LIEU EN 3D, OU POURQUOI IL MANQUE (16/11, l'auteur, capture d'une cote en 2D sur son telephone : « tu peux faire
 * beaucoup mieux pour les decors »). Le decor 3D existait ; un echec a sa creation retombait en silence sur la 2D de
 * secours. On retente une fois avec un rendu plus simple (sans lissage ni ombres, GPU par defaut), et l'erreur est
 * rendue a l'ecran de la seance, qui la montre au canal de test.
 */
export function creerSeance3D(lieu: Lieu3D, look: any, P: Pinceaux): { s: Seance3D | null; erreur: string | null } {
  if (!webglPossible()) return { s: null, erreur: 'WebGL indisponible' };
  let erreur: string | null = null;
  for (const simple of [false, true]) {
    try { return { s: new Seance3D(lieu, look, P, simple), erreur: null }; }
    catch (e: any) { erreur = String((e && e.message) || e).slice(0, 160); console.warn('[seance 3D]', simple ? 'repli simple' : 'rendu', e); }
  }
  return { s: null, erreur };
}

export class Seance3D {
  readonly toile: HTMLCanvasElement;
  private R: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  // grand angle et pres du corps : l'athlete reste grand, le decor lointain recule (la tribune a 1/6 de son echelle)
  private cam = new THREE.PerspectiveCamera(46, 1, 0.1, 500);
  private vise = new THREE.Vector3(0.55, 0.92, 0);
  /** Ce qui defile sous l'athlete. */
  private monde = new THREE.Group();
  /** Au virage : le centre de l'arc, qui tourne. */
  private pivot: THREE.Group | null = null;
  private m3: ReturnType<typeof corps3D> = null;
  private barre: THREE.Group | null = null;
  private zone: THREE.Mesh | null = null;
  private plots: THREE.Mesh[] = [];
  private fanions: THREE.Mesh[] = [];
  private pins: { tronc: THREE.InstancedMesh; cime: THREE.InstancedMesh; pos: [number, number, number][] } | null = null;
  private penteFaite = NaN;
  private jetables = new Set<{ dispose(): void }>();
  private os: THREE.Bone[] = [];
  private _v = new THREE.Vector3();
  private _m = new THREE.Matrix4();
  private _q = new THREE.Quaternion();

  constructor(private lieu: Lieu3D, private look: any, private P: Pinceaux, simple = false) {
    const bas = simple || faible();
    this.R = new THREE.WebGLRenderer({ antialias: !bas, powerPreference: simple ? 'default' : 'high-performance' });
    this.R.setPixelRatio(Math.min(window.devicePixelRatio || 1, bas ? 1.25 : 2));
    this.R.outputColorSpace = THREE.SRGBColorSpace;
    this.R.toneMapping = THREE.ACESFilmicToneMapping;
    this.R.toneMappingExposure = 1.05;
    this.R.shadowMap.enabled = !simple;
    this.R.shadowMap.type = THREE.PCFSoftShadowMap;
    // les corps premium et les modeles ont des textures KTX2 : le decodeur se branche sur ce rendu (comme la ville)
    brancherKTX2(this.R);
    this.toile = this.R.domElement;
    this.toile.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    this.scene.add(this.monde);
    const dedans = lieu === 'salle' || lieu === 'tapis';
    // la lumiere : le ciel et le sol, un soleil qui porte l'ombre du corps
    const hemi = new THREE.HemisphereLight(dedans ? 0xfff4e6 : 0xd8ecff, dedans ? 0x8a6a4a : 0x5e7a45, dedans ? 1.4 : 1.25);
    const soleil = new THREE.DirectionalLight(dedans ? 0xfff0dc : 0xfff3df, dedans ? 1.8 : 2.4);
    soleil.position.set(dedans ? -4 : 6, dedans ? 7 : 12, dedans ? 6 : 9);
    soleil.castShadow = true;
    const s = bas ? 512 : 1024;
    soleil.shadow.mapSize.set(s, s);
    Object.assign(soleil.shadow.camera, { left: -2.5, right: 2.5, top: 2.8, bottom: -1, near: 1, far: 30 });
    soleil.shadow.bias = -0.0006; soleil.shadow.normalBias = 0.02;
    this.scene.add(hemi, soleil, soleil.target);
    if (!dedans) {
      this.scene.background = this.texture(256, 512, (c, w, h) => P.ciel(c, w, h, lieu));
      this.scene.fog = new THREE.Fog(lieu === 'cote' ? 0xdfe8ee : 0xd4e6f2, 45, lieu === 'virage' ? 180 : 260);
    }
    ({ piste: () => this.piste(), virage: () => this.virage(), cote: () => this.cote(), parc: () => this.parc(),
      salle: () => this.salle(), tapis: () => this.chambre() } as Record<Lieu3D, () => void>)[lieu]();
    if (lieu === 'tapis') { this.cam.position.set(-0.1, 1.0, 3.7); this.vise.set(-0.35, 0.45, 0); }
    // la salle de trois quarts face, comme le coach : la barre et ses disques se voient de cote, pas en bout
    else if (lieu === 'salle') { this.cam.position.set(2.6, 1.4, 3.2); this.vise.set(0.0, 0.95, 0); }
    else { this.cam.position.set(0.7, 1.1, 3.8); this.vise.set(0.5, 1.05, 0); }
  }

  /* ------------------------------------------------------------ outils */

  private garder<T extends { dispose(): void }>(x: T): T { this.jetables.add(x); return x; }
  private texture(w: number, h: number, peindre: (c: CanvasRenderingContext2D, w: number, h: number) => void, rep?: [number, number]) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    peindre(cv.getContext('2d')!, w, h);
    const t = this.garder(new THREE.CanvasTexture(cv));
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  private mat(o: THREE.MeshStandardMaterialParameters) { return this.garder(new THREE.MeshStandardMaterial({ roughness: 0.85, ...o })); }
  private geo<T extends THREE.BufferGeometry>(g: T): T { return this.garder(g); }
  private bloc(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.monde, ombre = false) {
    const b = new THREE.Mesh(this.geo(new THREE.BoxGeometry(w, h, d)), m);
    b.position.set(x, y, z); b.castShadow = ombre; b.receiveShadow = true; parent.add(b); return b;
  }
  /** Un plan couche au sol, de x0 a x1, de z0 a z1. */
  private sol(x0: number, x1: number, z0: number, z1: number, m: THREE.Material, y = 0, parent: THREE.Object3D = this.monde) {
    const p = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(x1 - x0, z1 - z0)), m);
    p.rotation.x = -Math.PI / 2; p.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); p.receiveShadow = true; parent.add(p); return p;
  }
  private tartan(rep: [number, number]) {
    return this.texture(128, 128, (c, w, h) => {
      c.fillStyle = '#C24F37'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { c.fillStyle = fixe(i) < 0.55 ? 'rgba(90,20,10,0.35)' : 'rgba(255,190,160,0.25)'; c.fillRect(fixe(i * 2.1) * w, fixe(i * 3.7 + 1) * h, 1.2, 1.2); }
    }, rep);
  }
  private herbe(rep: [number, number], a = '#5E9C4E', b = '#6BAA5A') {
    return this.texture(128, 128, (c, w, h) => {
      c.fillStyle = a; c.fillRect(0, 0, w, h); c.fillStyle = b; c.fillRect(0, 0, w / 2, h);
      for (let i = 0; i < 700; i++) { c.fillStyle = fixe(i + 9) < 0.5 ? 'rgba(30,70,20,0.25)' : 'rgba(200,240,150,0.18)'; c.fillRect(fixe(i * 1.7) * w, fixe(i * 2.9) * h, 1, 2); }
    }, rep);
  }
  private chargerBlocs(x: number) {
    const base = (import.meta as any).env?.BASE_URL || '/';
    chargeurGLTF().loadAsync(base + 'modeles/bloc-depart.glb').then(g => {
      if (!this.jetables.size) return;   // deja detruite
      const o = g.scene; const b = new THREE.Box3().setFromObject(o), t = b.getSize(new THREE.Vector3());
      const k = 0.85 / Math.max(t.x, t.z, 0.01);
      o.scale.setScalar(k); o.position.set(x, -b.min.y * k, 0);
      o.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; this.jetables.add(m.geometry); this.jetables.add(m.material); } });
      this.monde.add(o);
    }).catch(() => { /* pas de blocs : la piste reste */ });
  }

  /* ------------------------------------------------------------ les lieux */

  /** Le stade : 8 couloirs, l'athlete au 5e ; l'herbe, la barriere, la tribune et son toit au loin. */
  private piste() {
    const L0 = -120, L1 = 620, zi = -5.5, ze = zi + 8 * COULOIR;
    this.sol(L0, L1, zi, ze, this.mat({ map: this.tartan([(L1 - L0) / 3, 8 * COULOIR / 3]), roughness: 0.92 }));
    const blanc = this.mat({ color: 0xffffff, roughness: 0.6 });
    for (let i = 0; i <= 8; i++) this.sol(L0, L1, zi + i * COULOIR - 0.025, zi + i * COULOIR + 0.025, blanc, 0.004);
    // les reperes : un trait tous les 10 m dans le couloir, son chiffre au sol
    for (let m = 10; m <= 300; m += 10) {
      this.sol(m - 0.03, m + 0.03, -COULOIR / 2, COULOIR / 2, blanc, 0.005);
      const n = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(0.9, 0.45)), this.garder(new THREE.MeshBasicMaterial({
        map: this.texture(128, 64, (c, w, h) => { c.fillStyle = '#fff'; c.font = '900 52px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(m), w / 2, h / 2 + 3); }),
        transparent: true, depthWrite: false })));
      n.rotation.x = -Math.PI / 2; n.position.set(m - 0.55, 0.006, -COULOIR * 0.75); this.monde.add(n);
    }
    // la zone lancee (Lancee) : un tapis dore et ses plots, places a chaque image
    this.zone = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(1, COULOIR)), this.garder(new THREE.MeshBasicMaterial({ color: 0xffd65a, transparent: true, opacity: 0.38, depthWrite: false })));
    this.zone.rotation.x = -Math.PI / 2; this.zone.visible = false; this.monde.add(this.zone);
    const plot = this.geo(new THREE.ConeGeometry(0.11, 0.32, 14)), orange = this.mat({ color: 0xff8a00, roughness: 0.5 });
    for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(plot, orange); p.castShadow = true; p.visible = false; this.monde.add(p); this.plots.push(p); }
    this.chargerBlocs(-0.65);
    // les abords : le gazon cote camera, le terrain interieur au loin
    this.sol(L0, L1, ze, ze + 14, this.mat({ color: 0x8a9096, roughness: 0.95 }));
    // le terrain interieur, large : la tribune d'en face recule et laisse voir le toit et le ciel
    this.sol(L0, L1, zi - 34, zi, this.mat({ map: this.herbe([(L1 - L0) / 6, 5]) }));
    this.tribune(L0, L1, zi - 34);
  }

  private tribune(L0: number, L1: number, z0: number) {
    const long = L1 - L0;
    // la barriere et ses panneaux
    const pub = this.texture(512, 64, (c, w, h) => {
      c.fillStyle = '#14304D'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = '900 34px system-ui'; c.textAlign = 'center'; c.fillText('SPRINTER', w / 2, h * 0.68);
      c.fillStyle = '#FFD23F'; c.fillRect(0, h - 5, w, 5);
    }, [long / 8, 1]);
    this.bloc(long, 1.0, 0.15, this.mat({ map: pub, roughness: 0.6 }), (L0 + L1) / 2, 0.5, z0);
    // les gradins : un plan incline couvert du public peint (le meme que la 2D, 6 rangs par tuile)
    const foule = this.texture(720, 192, (c, w, h) => { c.scale(2, 2); this.P.tribune(c, w / 2, h / 2); }, [long / 24, 2.5]);
    const prof = 16, haut = 11, lg = Math.hypot(prof, haut);
    const g = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(long, lg)), this.mat({ map: foule, roughness: 1 }));
    g.rotation.x = -Math.atan2(haut, prof); g.position.set((L0 + L1) / 2, 1.2 + haut / 2, z0 - 1 - prof / 2); this.monde.add(g);
    this.bloc(long, 1.2, 0.4, this.mat({ color: 0x2b3442 }), (L0 + L1) / 2, 0.6, z0 - 1);
    // le toit, sa tranche claire, ses poteaux
    const toit = this.mat({ color: 0xc9d1da, roughness: 0.5, metalness: 0.2 });
    const t = this.bloc(long, 0.3, prof + 4, toit, (L0 + L1) / 2, haut + 4.2, z0 - 1 - prof / 2 - 1);
    t.rotation.x = 0.06;
    const acier = this.mat({ color: 0x7e8794, metalness: 0.5, roughness: 0.4 }), pot = this.geo(new THREE.CylinderGeometry(0.18, 0.22, haut + 4, 8));
    for (let x = L0; x < L1; x += 24) { const p = new THREE.Mesh(pot, acier); p.position.set(x, (haut + 4) / 2 + 1, z0 - 2 - prof); this.monde.add(p); }
    // les pylones d'eclairage
    const pyl = this.geo(new THREE.CylinderGeometry(0.25, 0.4, 34, 8)), feux = this.mat({ color: 0xfff7da, emissive: 0xfff2c0, emissiveIntensity: 1.2 });
    for (let x = L0 + 60; x < L1; x += 150) {
      const p = new THREE.Mesh(pyl, acier); p.position.set(x, 17, z0 - prof - 8); this.monde.add(p);
      this.bloc(5, 2.2, 0.5, acier, x, 34, z0 - prof - 8); this.bloc(4.4, 1.6, 0.1, feux, x, 34, z0 - prof - 7.7);
    }
  }

  /** Le virage : un arc de piste autour de son centre, dans un anneau de gradins. */
  private virage() {
    const piv = this.pivot = new THREE.Group();
    piv.position.set(0, 0, -R_VIRAGE); this.scene.add(piv);
    const ri = R_VIRAGE - 4.5 * COULOIR, re = ri + 8 * COULOIR;
    const anneau = (a: number, b: number, m: THREE.Material, y: number) => {
      const r = new THREE.Mesh(this.geo(new THREE.RingGeometry(a, b, 220, 1)), m);
      r.rotation.x = -Math.PI / 2; r.position.y = y; r.receiveShadow = true; piv.add(r); return r;
    };
    anneau(ri, re, this.mat({ map: this.tartan([24, 24]), roughness: 0.92 }), 0);
    const blanc = this.mat({ color: 0xffffff, roughness: 0.6 });
    for (let i = 0; i <= 8; i++) anneau(ri + i * COULOIR - 0.025, ri + i * COULOIR + 0.025, blanc, 0.004);
    const pelouse = new THREE.Mesh(this.geo(new THREE.CircleGeometry(ri, 160)), this.mat({ map: this.herbe([14, 14]) }));
    pelouse.rotation.x = -Math.PI / 2; pelouse.receiveShadow = true; piv.add(pelouse);
    anneau(re, re + 14, this.mat({ color: 0x8a9096, roughness: 0.95 }), 0);
    // les gradins tout autour, le public peint a l'interieur du cone
    const foule = this.texture(720, 192, (c, w, h) => { c.scale(2, 2); this.P.tribune(c, w / 2, h / 2); }, [Math.round(2 * Math.PI * (re + 20) / 24), 2.5]);
    const gr = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(re + 30, re + 14, 12, 96, 1, true)), this.mat({ map: foule, side: THREE.BackSide, roughness: 1 }));
    gr.position.y = 7; piv.add(gr);
    const toit = new THREE.Mesh(this.geo(new THREE.RingGeometry(re + 18, re + 34, 96, 1)), this.mat({ color: 0xc9d1da, side: THREE.DoubleSide, roughness: 0.5 }));
    toit.rotation.x = -Math.PI / 2; toit.position.y = 15; piv.add(toit);
  }

  /** La cote : la pente et son chemin, les fanions tous les 10 m, les pins, la montagne au loin. */
  private cote() {
    this.sol(-80, 280, -90, 30, this.mat({ map: this.herbe([60, 20], '#6FAE56', '#78B85E') }));
    this.sol(-80, 280, -0.8, 0.8, this.mat({ color: 0xcdb585, roughness: 1 }), 0.006);
    const poteau = this.geo(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6)), bois = this.mat({ color: 0x5d4630 });
    for (let m = 0; m <= 60; m += 10) {
      const p = new THREE.Mesh(poteau, bois); p.position.set(m, 0.65, -1.1); p.castShadow = true; this.monde.add(p);
      const f = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(0.5, 0.3)), this.mat({ color: m === 60 ? 0xf1c40f : 0xe74c3c, side: THREE.DoubleSide, roughness: 0.7 }));
      f.geometry.translate(0.25, 0, 0); f.position.set(m, 1.15, -1.1); this.monde.add(f); this.fanions.push(f);
    }
    // les pins : troncs et cimes en deux maillages instancies
    const pos: [number, number, number][] = [];
    for (let i = 0; i < 420; i++) {
      const z = -6 - fixe(i * 1.9) * 85, x = -80 + fixe(i * 3.3 + 1) * 360;
      if (z > -10) continue;   // rien entre la camera et le chemin de l'athlete
      pos.push([x, z, 0.7 + fixe(i + 7) * 0.7]);
    }
    const cimes = mergeGeometries([0, 1, 2].map(k => new THREE.ConeGeometry(1.6 - k * 0.38, 3.2, 7).translate(0, 2.6 + k * 1.7, 0)))!;
    const tronc = new THREE.InstancedMesh(this.geo(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 6).translate(0, 1.1, 0)), this.mat({ color: 0x4a3424 }), pos.length);
    const cime = new THREE.InstancedMesh(this.geo(cimes), this.mat({ color: 0x2f6b3e, flatShading: true }), pos.length);
    const c = new THREE.Color();
    pos.forEach((_, i) => cime.setColorAt(i, c.setHSL(0.36 + fixe(i) * 0.04, 0.4, 0.24 + fixe(i + 3) * 0.08)));
    tronc.castShadow = false; cime.castShadow = false;
    this.monde.add(tronc, cime);
    this.pins = { tronc, cime, pos };
    // la montagne : une toile peinte tres loin, hors du monde (elle ne defile pas)
    const mont = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(700, 140)), this.garder(new THREE.MeshBasicMaterial({
      map: this.texture(1024, 256, this.P.montagnes), transparent: true, fog: false, depthWrite: false })));
    mont.position.set(60, 40, -240); mont.renderOrder = -1; this.scene.add(mont);
  }

  /** Les pins suivent la pente du monde mais restent droits : leurs matrices, refaites quand elle change. */
  private planterLesPins(p: number) {
    if (!this.pins || p === this.penteFaite) return;
    this.penteFaite = p;
    const { tronc, cime, pos } = this.pins, s = new THREE.Vector3(), t = new THREE.Vector3();
    this._q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -p);
    pos.forEach(([x, z, k], i) => {
      this._m.compose(t.set(x, 0, z), this._q, s.set(k, k * (0.9 + fixe(i) * 0.3), k));
      tronc.setMatrixAt(i, this._m); cime.setMatrixAt(i, this._m);
    });
    tronc.instanceMatrix.needsUpdate = true; cime.instanceMatrix.needsUpdate = true;
  }

  /** Le parc : la pelouse, l'allee de gravier, les arbres, les lampadaires et les bancs. */
  private parc() {
    this.sol(-80, 520, -90, 30, this.mat({ map: this.herbe([80, 16], '#7DB862', '#86C06A') }));
    this.sol(-80, 520, -1.1, 1.1, this.mat({ map: this.texture(64, 64, (c, w, h) => {
      c.fillStyle = '#D8C49C'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) { c.fillStyle = fixe(i) < 0.5 ? 'rgba(120,95,60,0.35)' : 'rgba(255,255,240,0.4)'; c.fillRect(fixe(i * 1.3) * w, fixe(i * 2.7) * h, 1, 1); }
    }, [300, 1]), roughness: 1 }), 0.006);
    const pos: [number, number, number][] = [];
    for (let i = 0; i < 900; i++) {
      const z = -4.5 - Math.pow(fixe(i * 2.3), 1.6) * 60, x = -80 + fixe(i * 1.1 + 3) * 600;
      pos.push([x, z, 0.8 + fixe(i + 5) * 0.6]);
    }
    const tronc = new THREE.InstancedMesh(this.geo(new THREE.CylinderGeometry(0.16, 0.24, 2.6, 6).translate(0, 1.3, 0)), this.mat({ color: 0x5a3e2a }), pos.length);
    const houppe = mergeGeometries([
      new THREE.IcosahedronGeometry(1.7, 1).translate(0, 3.6, 0),
      new THREE.IcosahedronGeometry(1.2, 1).translate(1.0, 3.0, 0.3),
      new THREE.IcosahedronGeometry(1.1, 1).translate(-0.9, 3.1, -0.2),
    ])!;
    const cime = new THREE.InstancedMesh(this.geo(houppe), this.mat({ color: 0xffffff, flatShading: true }), pos.length);
    const c = new THREE.Color();
    pos.forEach(([x, z, k], i) => {
      this._m.compose(this._v.set(x, 0, z), this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), fixe(i) * 6), new THREE.Vector3(k, k, k));
      tronc.setMatrixAt(i, this._m); cime.setMatrixAt(i, this._m);
      cime.setColorAt(i, c.setHSL(0.27 + fixe(i + 1) * 0.06, 0.45, 0.3 + fixe(i + 2) * 0.1));
    });
    this.monde.add(tronc, cime);
    // un lampadaire puis un banc tous les 8 m, juste derriere l'allee
    const fonte = this.mat({ color: 0x2f3b36, metalness: 0.3, roughness: 0.5 }), lat = this.mat({ color: 0x8a5a36 });
    const mat = this.geo(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 8)), lan = this.mat({ color: 0xfff3c4, emissive: 0xffe9a8, emissiveIntensity: 0.6 });
    for (let x = -40, i = 0; x < 520; x += 8, i++) {
      if (i % 2 === 0) {
        const p = new THREE.Mesh(mat, fonte); p.position.set(x, 1.6, -1.6); p.castShadow = true; this.monde.add(p);
        this.bloc(0.3, 0.35, 0.3, lan, x, 3.3, -1.6);
      } else {
        this.bloc(1.5, 0.06, 0.45, lat, x, 0.45, -1.6, this.monde, true);
        this.bloc(1.5, 0.35, 0.05, lat, x, 0.72, -1.85, this.monde, true);
        this.bloc(0.06, 0.45, 0.45, fonte, x - 0.68, 0.22, -1.6); this.bloc(0.06, 0.45, 0.45, fonte, x + 0.68, 0.22, -1.6);
      }
    }
  }

  private parquet(w: number, d: number) {
    return this.mat({ map: this.texture(256, 256, (c, W, H) => {
      c.fillStyle = '#B98654'; c.fillRect(0, 0, W, H);
      for (let r = 0; r < 8; r++) {
        const y = r * H / 8, dec = fixe(r) * W;
        c.fillStyle = `hsl(28,${40 + fixe(r + 3) * 12}%,${44 + fixe(r + 5) * 8}%)`; c.fillRect(0, y, W, H / 8);
        c.fillStyle = 'rgba(60,35,15,0.4)'; c.fillRect(0, y, W, 1.5); c.fillRect((dec) % W, y, 1.5, H / 8); c.fillRect((dec + W / 2) % W, y, 1.5, H / 8);
      }
    }, [w / 2, d / 2]), roughness: 0.45 });
  }

  /** La salle de musculation : le parquet, le mur et son miroir, les fenetres hautes, le rack, les disques. */
  private salle() {
    const m = this.scene;
    this.sol(-7, 7, -4, 7, this.parquet(14, 11), 0, m);
    const mur = this.mat({ color: 0xe3d9ca, roughness: 0.95 });
    this.bloc(14, 6, 0.2, mur, 0, 3, -4.1, m); this.bloc(0.2, 6, 11, mur, -7, 3, 1.5, m);
    this.bloc(14, 0.15, 0.06, this.mat({ color: 0x7a5c3e }), 0, 0.075, -3.98, m);
    // le miroir : un reflet peint, des stries
    const miroir = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(9, 2.3)), this.mat({ roughness: 0.15, metalness: 0.1,
      map: this.texture(512, 128, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#D7E2EA'); g.addColorStop(0.5, '#B3C4D2'); g.addColorStop(1, '#9AAEC0');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(w * 0.18, 0); c.lineTo(w * 0.26, 0); c.lineTo(w * 0.14, h); c.lineTo(w * 0.06, h); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(w * 0.3, 0); c.lineTo(w * 0.32, 0); c.lineTo(w * 0.2, h); c.lineTo(w * 0.18, h); c.fill();
      }) }));
    miroir.position.set(0.5, 1.55, -3.99); m.add(miroir);
    this.bloc(9.1, 0.06, 0.05, this.mat({ color: 0x2e3238 }), 0.5, 2.73, -3.97, m); this.bloc(9.1, 0.06, 0.05, this.mat({ color: 0x2e3238 }), 0.5, 0.37, -3.97, m);
    const vitre = this.mat({ color: 0xcfe7fb, emissive: 0xbfe0ff, emissiveIntensity: 0.9 });
    for (let i = 0; i < 5; i++) this.bloc(1.6, 0.8, 0.05, vitre, -5 + i * 2.6, 4.3, -3.98, m);
    // la plateforme, le rack, l'arbre a disques, les halteres
    // la plateforme d'haltero : caoutchouc noir, bois au centre sous les pieds
    this.bloc(2.6, 0.04, 2.6, this.mat({ color: 0x24272c, roughness: 0.95 }), 0, 0.02, 0, m);
    this.bloc(1.0, 0.045, 2.6, this.parquet(1, 2.6), 0, 0.023, 0, m);
    const acier = this.mat({ color: 0x1e2126, metalness: 0.25, roughness: 0.45 });
    // un demi-rack contre le dos de l'athlete : rien entre elle et la camera
    for (const z of [-0.85, 0.85]) this.bloc(0.08, 2.4, 0.08, acier, -0.6, 1.2, z, m, true);
    this.bloc(0.08, 0.08, 1.78, acier, -0.6, 2.4, 0, m);
    const rouge = this.mat({ color: 0xc0392b });
    for (const z of [-0.85, 0.85]) { this.bloc(0.7, 0.05, 0.06, rouge, -0.25, 0.75, z, m); this.bloc(0.12, 0.06, 0.06, rouge, -0.52, 1.45, z, m); }
    const disques = [[0xc0392b, 0.225], [0x2980b9, 0.2], [0x27ae60, 0.17], [0xf1c40f, 0.14]] as const;
    disques.forEach(([coul, r], i) => {
      const d = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(r, r, 0.05, 28)), this.mat({ color: coul, roughness: 0.5 }));
      d.rotation.x = Math.PI / 2; d.position.set(3.3, 0.5, -1.4 + i * 0.07); d.castShadow = true; m.add(d);
    });
    this.bloc(0.06, 0.9, 0.06, acier, 3.3, 0.45, -1.3, m);
    // le rateau d'halteres contre le mur de droite, un banc
    const fonte = this.mat({ color: 0x1c2026, roughness: 0.6 });
    this.bloc(0.5, 0.06, 1.6, acier, 4.2, 0.55, -2.2, m); this.bloc(0.06, 0.55, 1.6, acier, 4.0, 0.27, -2.2, m);
    for (let i = 0; i < 5; i++) { const z = -2.85 + i * 0.32; this.bloc(0.24, 0.13, 0.13, fonte, 4.2, 0.65, z, m); }
    this.bloc(1.2, 0.08, 0.32, this.mat({ color: 0x1f2933, roughness: 0.7 }), 2.4, 0.45, -2.6, m, true);
    this.bloc(0.06, 0.42, 0.06, acier, 1.95, 0.21, -2.6, m); this.bloc(0.06, 0.42, 0.06, acier, 2.85, 0.21, -2.6, m);
    // la barre, tenue sur la nuque (placee a chaque image)
    const b = this.barre = new THREE.Group();
    const tige = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.014, 0.014, 2.1, 10)), this.mat({ color: 0xb8bec6, metalness: 0.8, roughness: 0.3 }));
    tige.rotation.x = Math.PI / 2; tige.castShadow = true; b.add(tige);
    // de chaque cote : un disque rouge de 25, un bleu de 20, le collier
    const d25 = this.geo(new THREE.CylinderGeometry(0.225, 0.225, 0.055, 32)), d20 = this.geo(new THREE.CylinderGeometry(0.225, 0.225, 0.045, 32));
    const col = this.geo(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 12)), bleu = this.mat({ color: 0x2471a3, roughness: 0.5 });
    const chrome = this.mat({ color: 0xd5d9de, metalness: 0.9, roughness: 0.25 });
    for (const sg of [-1, 1]) {
      ([[d25, rouge, 0.82], [d20, bleu, 0.875], [col, chrome, 0.92]] as const).forEach(([g, mt, z]) => {
        const d = new THREE.Mesh(g, mt); d.rotation.x = Math.PI / 2; d.position.z = sg * z; d.castShadow = true; b.add(d);
      });
    }
    b.visible = false; m.add(b);
  }

  /** La chambre : le parquet, le mur, la fenetre et ses rideaux, l'affiche, le lit, la plante, le tapis. */
  private chambre() {
    const m = this.scene;
    this.sol(-5, 5, -2.6, 6, this.parquet(10, 8.6), 0, m);
    const mur = this.mat({ color: 0xe6deee, roughness: 0.95 });
    this.bloc(10, 4, 0.2, mur, 0, 2, -2.7, m); this.bloc(0.2, 4, 8, mur, -4.4, 2, 1.3, m);
    this.bloc(10, 0.12, 0.05, this.mat({ color: 0xf2eee8 }), 0, 0.06, -2.58, m);
    const fen = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(1.8, 1.3)), this.garder(new THREE.MeshBasicMaterial({ map: this.texture(256, 192, (c, w, h) => this.P.ciel(c, w, h, 'parc')) })));
    fen.position.set(-1.4, 1.75, -2.58); m.add(fen);
    const cadre = this.mat({ color: 0xf5f1ea });
    this.bloc(1.9, 0.07, 0.06, cadre, -1.4, 2.42, -2.56, m); this.bloc(1.9, 0.07, 0.06, cadre, -1.4, 1.08, -2.56, m);
    this.bloc(0.06, 1.4, 0.06, cadre, -1.4, 1.75, -2.55, m); this.bloc(1.8, 0.05, 0.05, cadre, -1.4, 1.75, -2.55, m);
    const rideau = this.mat({ color: 0xc8576b, roughness: 1 });
    this.bloc(0.45, 1.9, 0.08, rideau, -2.55, 1.6, -2.5, m, true); this.bloc(0.45, 1.9, 0.08, rideau, -0.25, 1.6, -2.5, m, true);
    this.bloc(2.9, 0.04, 0.04, this.mat({ color: 0x5c5470 }), -1.4, 2.58, -2.48, m);
    const aff = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(0.8, 1.05)), this.mat({ map: this.texture(256, 336, this.P.affiche), roughness: 0.7 }));
    aff.position.set(1.6, 1.7, -2.58); m.add(aff);
    // le lit, la plante
    this.bloc(2.1, 0.45, 1.5, this.mat({ color: 0xf0ece6 }), -3.2, 0.22, -1.6, m, true);
    this.bloc(2.1, 0.12, 1.5, this.mat({ color: 0x4a6fa5 }), -3.2, 0.5, -1.6, m, true);
    const pot = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.2, 0.15, 0.35, 16)), this.mat({ color: 0xc8794b }));
    pot.position.set(2.9, 0.175, -2.1); pot.castShadow = true; m.add(pot);
    const feuille = this.geo(new THREE.SphereGeometry(0.1, 8, 6).scale(1, 3.2, 0.5)), vert = this.mat({ color: 0x3e8e4e });
    for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(feuille, vert); f.position.set(2.9, 0.62, -2.1); f.rotation.set((fixe(i) - 0.5) * 0.9, i, (fixe(i + 2) - 0.5) * 0.9); m.add(f); }
    // le tapis de sol sous l'athlete
    this.bloc(2.0, 0.015, 0.7, this.mat({ color: 0x3a7fc6, roughness: 0.9 }), 0, 0.008, 0, m);
  }

  /* ------------------------------------------------------------ chaque image */

  rendre(e: Etat3D, t: number, W: number, H: number): Projection {
    const w = Math.max(1, Math.round(W)), h = Math.max(1, Math.round(H));
    const sz = this.R.getSize(this._v2);
    if (sz.x !== w || sz.y !== h) { this.R.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
    // le monde defile sous l'athlete
    const d = e.defile;
    if (this.pivot) this.pivot.rotation.y = -d / R_VIRAGE;
    else if (this.lieu === 'cote') {
      const p = e.pente; this.planterLesPins(p);
      this.monde.rotation.z = p; this.monde.position.set(-d * Math.cos(p), -d * Math.sin(p), 0);
    } else if (this.lieu !== 'salle' && this.lieu !== 'tapis') this.monde.position.x = -d;
    for (const [i, f] of this.fanions.entries()) f.rotation.y = Math.sin(t * 5 + i) * 0.35;
    if (this.zone) {
      const z = e.zone; this.zone.visible = !!z; this.plots.forEach(p => { p.visible = !!z; });
      if (z) {
        this.zone.scale.x = z[1] - z[0]; this.zone.position.set((z[0] + z[1]) / 2, 0.007, 0);
        [[z[0], -0.7], [z[0], 0.7], [z[1], -0.7], [z[1], 0.7]].forEach(([x, zz], i) => this.plots[i].position.set(x, 0.16, zz));
      }
    }
    // le corps : charge des que possible, pose sur le squelette du moteur
    const c = e.corps;
    if (!this.m3) {
      this.m3 = corps3D(this.look);
      if (this.m3) {
        c.squelette3D = true;
        this.m3.m.racine.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
        this.m3.m.racine.traverse((o: any) => { if (o.isBone && /foot|ball|toe|hand/i.test(o.name)) this.os.push(o); });
        this.scene.add(this.m3.m.racine);
      }
    }
    if (this.m3) {
      const A = SprinterApp as any;
      A.personCapsules(c, 0, e.incline, false, false, 0);
      if (c.squelette) poser(this.m3.m, c.squelette);
      const k = ((this.look && this.look.h) || this.m3.hauteur) / this.m3.hauteur;
      const z = this.pivot ? e.couloir * COULOIR * 0.5 : 0;
      const racine = this.m3.m.racine;
      racine.matrix.compose(this._v.set(0, e.vol, z), this._q.setFromAxisAngle(this._axeY, PROFIL - e.cap), this._s.set(k, k, k));
      racine.matrixWorldNeedsUpdate = true;
      // a terre (squat, planche) : le point le plus bas du corps pose sur le sol, comme la 2D
      if (e.barre !== null || this.lieu === 'tapis') {
        racine.updateMatrixWorld(true);
        let bas = Infinity;
        for (const o of this.os) bas = Math.min(bas, o.getWorldPosition(this._v).y);
        if (isFinite(bas)) { racine.matrix.elements[13] += (this.lieu === 'tapis' ? 0.06 : 0.05) - bas; racine.matrixWorldNeedsUpdate = true; }
      }
      if (this.barre) {
        // la barre posee sur les trapezes : sous la nuque du squelette, un peu en arriere, elle suit le corps
        this.barre.visible = e.barre !== null;
        const nuque = this.m3.m.os.get('neck_01');
        if (nuque && this.barre.visible) {
          racine.updateMatrixWorld(true);
          nuque.getWorldPosition(this._v);
          const yaw = PROFIL - e.cap;
          this.barre.position.set(this._v.x - Math.cos(yaw) * 0.07, this._v.y - 0.06, this._v.z + Math.sin(yaw) * 0.07);
          this.barre.rotation.y = yaw;
        }
      }
    }
    this.cam.lookAt(this.vise);
    this.R.render(this.scene, this.cam);
    // ou tombe l'athlete a l'ecran
    const p0 = this._v.set(0, 0, 0).project(this.cam), ax = (p0.x + 1) / 2 * W, sol = (1 - p0.y) / 2 * H;
    const p1 = this._v.set(1, 0, 0).project(this.cam), ppm = Math.abs((p1.x + 1) / 2 * W - ax);
    return { ax, sol, ppm, corps: !!this.m3 };
  }
  private _v2 = new THREE.Vector2();
  private _s = new THREE.Vector3();
  private _axeY = new THREE.Vector3(0, 1, 0);

  detruire() {
    for (const j of this.jetables) j.dispose();
    this.jetables.clear();
    this.scene.clear();
    this.R.dispose();
    this.R.forceContextLoss();
  }
}
