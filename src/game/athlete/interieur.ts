// LA MAISON, EN VRAI (26/10/2026).
//
// L'auteur : « est-ce que j'ai ca lorsque je rentre dans un batiment ? » (un interieur de
// Lagos Life), puis « on n'entre toujours pas chez soi ». Entrer a la maison ouvrait une
// liste ; c'est maintenant une piece en vue coupee (deux murs, le sol, les meubles), ou
// l'athlete marche. Chaque meuble porte ce qu'on y fait (regles.ts, ACTIONS) : on touche le
// lit, l'athlete y va, et le lit propose « dormir » et « sieste ».
//
// Tout est construit ici en boites, sans fichier a charger : le plus petit telephone ouvre
// la maison tout de suite. L'athlete est le meme corps qu'en ville (Personne, ville.ts).

import * as THREE from 'three';
import { Personne, SOL } from './ville';

export type Meuble = 'lit' | 'bureau' | 'canape' | 'table' | 'douche' | 'miroir' | 'porte';
/** Ce qu'on fait a chaque meuble (les id d'ACTIONS ; « miroir » ouvre la garde-robe, « porte » ressort). */
export const ACTIONS_DU_MEUBLE: Record<Meuble, string[]> = {
  lit: ['dormir', 'sieste'], bureau: ['devoirs'], canape: ['console', 'telephone'],
  table: ['manger'], douche: ['douche'], miroir: [], porte: [],
};

// LE PLAN, en metres : x vers la droite, z vers la camera. Les murs du fond (z = -P) et de
// gauche (x = -L) sont montres ; les deux autres sont ouverts, comme une maison de poupee.
const L = 4.6, P = 3.6, HAUT = 2.6, MUR = 0.12, CASE = 0.2;
const COLS = Math.round(2 * L / CASE), RANGS = Math.round(2 * P / CASE);

const mat = (c: string | number, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...o });
function boite(g: THREE.Object3D, l: number, h: number, p: number, x: number, y: number, z: number, m: THREE.Material) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(l, h, p), m);
  b.position.set(x, y + h / 2, z); b.castShadow = true; b.receiveShadow = true;
  g.add(b); return b;
}

type Place = { meuble: Meuble; groupe: THREE.Group; ou: [number, number]; regard: [number, number]; emprise: [number, number, number, number] };

export class Interieur {
  private rendu: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  private moi: Personne;
  private places: Place[] = [];
  private bloque = new Uint8Array(COLS * RANGS);
  private sol!: THREE.Mesh;
  private vise: Meuble | null = null;
  private anneau: THREE.Mesh;
  private id = 0;
  private avant = 0;
  private fini = false;
  private ecoute: Array<[string, any]> = [];

  constructor(private hote: HTMLElement, look: any, nuit: boolean,
              private o: { surMeuble: (m: Meuble) => void }) {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block';
    hote.appendChild(cv);
    this.rendu = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    this.rendu.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.rendu.outputColorSpace = THREE.SRGBColorSpace;
    this.rendu.toneMapping = THREE.ACESFilmicToneMapping;
    this.rendu.shadowMap.enabled = true;
    this.rendu.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(nuit ? '#0E1620' : '#1B2A24');
    this.construire(nuit);
    this.moi = new Personne(look, 0.6, P - 0.9, this.scene, 320);
    this.moi.dir.set(0, 0, -1); this.moi.placer();
    this.anneau = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.38, 32),
      new THREE.MeshBasicMaterial({ color: '#3DDC84', transparent: true, opacity: 0, depthWrite: false }));
    this.anneau.rotation.x = -Math.PI / 2;
    this.scene.add(this.anneau);
    this.cadrer();
    this.toucher(cv);
    const ro = () => this.cadrer();
    window.addEventListener('resize', ro); this.ecoute.push(['resize', ro]);
    this.id = requestAnimationFrame(this.boucle);
  }

  /** Les murs, le sol, les meubles et la lumiere. */
  private construire(nuit: boolean) {
    const s = this.scene;
    // le sol en parquet, une plinthe, le carrelage de la salle d'eau
    const parquet = mat('#B98A5E', { roughness: 0.7 });
    this.sol = new THREE.Mesh(new THREE.BoxGeometry(2 * L, 0.1, 2 * P), parquet);
    this.sol.position.set(0, SOL - 0.05, 0); this.sol.receiveShadow = true; s.add(this.sol);
    for (let i = -L + 0.6; i < L; i += 0.6) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.002, 2 * P), mat('#9C7048'));
      l.position.set(i, SOL + 0.001, 0); s.add(l);
    }
    const carrelage = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.02, 2.1), mat('#DCE3E6', { roughness: 0.4 }));
    carrelage.position.set(L - 1.1, SOL + 0.01, -P + 1.05); carrelage.receiveShadow = true; s.add(carrelage);
    // les deux murs, une fenetre dans celui du fond, une cloison basse pour la salle d'eau
    const murM = mat('#E9E1D3');
    const g = new THREE.Group(); s.add(g);
    boite(g, 2 * L + MUR, HAUT, MUR, 0, SOL, -P - MUR / 2, murM);
    boite(g, MUR, HAUT, 2 * P, -L - MUR / 2, SOL, 0, mat('#DDD3C2'));
    boite(g, MUR, 1.2, 2.1, L - 2.2, SOL, -P + 1.05, mat('#E9E1D3'));
    const fen = boite(g, 1.6, 1.1, 0.04, -0.6, SOL + 1.0, -P + 0.01, mat(nuit ? '#1D2C44' : '#BFE3FF', { emissive: nuit ? '#0A1430' : '#A8D8FF', emissiveIntensity: nuit ? 0.4 : 0.6 }));
    fen.castShadow = false;
    boite(g, 1.7, 0.06, 0.14, -0.6, SOL + 0.97, -P + 0.06, mat('#FFFFFF'));
    // un tapis, une plante, un cadre
    boite(g, 2.4, 0.015, 1.6, -1.6, SOL, 0.9, mat('#3E6B8C'));
    boite(g, 0.35, 0.35, 0.35, -L + 0.35, SOL, P - 0.4, mat('#8A5A3C'));
    const feuilles = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), mat('#3F8A4A'));
    feuilles.position.set(-L + 0.35, SOL + 0.75, P - 0.4); feuilles.castShadow = true; s.add(feuilles);
    boite(g, 0.7, 0.5, 0.03, 1.2, SOL + 1.3, -P + 0.02, mat('#2D3A4A'));

    // LES MEUBLES, chacun a sa place : ou l'athlete se tient pour s'en servir, et ce qu'il bloque au sol
    this.meuble('lit', -L + 1.1, -P + 1.1, [-L + 1.1, -P + 2.25], [0, -1], g2 => {
      boite(g2, 1.5, 0.35, 2.1, 0, SOL, 0, mat('#6B4A30'));
      boite(g2, 1.4, 0.2, 2.0, 0, SOL + 0.35, 0, mat('#F4F1EA'));
      boite(g2, 1.42, 0.08, 1.3, 0, SOL + 0.55, 0.35, mat('#3D7DCA'));
      boite(g2, 0.9, 0.14, 0.35, 0, SOL + 0.55, -0.75, mat('#FFFFFF'));
      boite(g2, 1.5, 0.9, 0.08, 0, SOL, -1.05, mat('#5A3D27'));
    }, [-L + 0.3, -P, -L + 1.9, -P + 2.2]);
    this.meuble('bureau', 1.0, -P + 0.4, [1.0, -P + 1.3], [0, -1], g2 => {
      boite(g2, 1.3, 0.05, 0.6, 0, SOL + 0.72, 0, mat('#E8E2D6'));
      for (const x of [-0.6, 0.6]) boite(g2, 0.05, 0.72, 0.55, x, SOL, 0, mat('#A9A39A'));
      boite(g2, 0.4, 0.02, 0.28, 0.1, SOL + 0.77, 0.05, mat('#2A2F36'));
      boite(g2, 0.4, 0.26, 0.02, 0.1, SOL + 0.78, -0.09, mat('#1F6FB5', { emissive: '#1F6FB5', emissiveIntensity: 0.5 }));
      boite(g2, 0.45, 0.45, 0.45, 0, SOL, 0.6, mat('#2B2F36'));
      boite(g2, 0.45, 0.5, 0.06, 0, SOL + 0.45, 0.82, mat('#2B2F36'));
    }, [0.3, -P, 1.7, -P + 1.0]);
    this.meuble('canape', -1.6, 1.55, [-1.6, 0.75], [0, -1], g2 => {
      boite(g2, 2.0, 0.42, 0.85, 0, SOL, 0, mat('#C2553D'));
      boite(g2, 2.0, 0.45, 0.2, 0, SOL + 0.42, 0.33, mat('#A9452F'));
      for (const x of [-0.95, 0.95]) boite(g2, 0.18, 0.6, 0.85, x, SOL, 0, mat('#A9452F'));
      // la television et la console, en face
      boite(g2, 1.6, 0.45, 0.4, 0, SOL, -2.15, mat('#3A3F46'));
      boite(g2, 1.3, 0.75, 0.05, 0, SOL + 0.55, -2.25, mat('#0F1418', { emissive: '#2A5C8A', emissiveIntensity: 0.35 }));
      boite(g2, 0.3, 0.06, 0.2, 0.45, SOL + 0.45, -2.1, mat('#F2F2F2'));
    }, [-2.7, 1.1, -0.5, 2.0], [-2.5, -0.8, -0.7, -0.5]);
    this.meuble('table', 2.6, 1.3, [2.6, 0.5], [0, 1], g2 => {
      boite(g2, 1.2, 0.05, 0.8, 0, SOL + 0.74, 0, mat('#D9B98C'));
      for (const [x, z] of [[-0.5, -0.32], [0.5, -0.32], [-0.5, 0.32], [0.5, 0.32]]) boite(g2, 0.05, 0.74, 0.05, x, SOL, z, mat('#8C6A44'));
      boite(g2, 0.25, 0.04, 0.25, 0, SOL + 0.79, 0, mat('#FFFFFF'));
      boite(g2, 0.42, 0.45, 0.42, 0.75, SOL, 0, mat('#8C6A44'));
      // le frigo et le plan de travail, contre le mur de droite de la cuisine
      boite(g2, 0.7, 1.8, 0.65, 1.55, SOL, 1.6, mat('#E6ECEF', { roughness: 0.35, metalness: 0.2 }));
      boite(g2, 0.02, 0.5, 0.02, 1.22, SOL + 0.9, 1.4, mat('#9AA4AA'));
    }, [1.9, 0.8, 3.3, 1.8], [3.8, 2.6, 4.6, 3.6]);
    this.meuble('douche', L - 0.65, -P + 0.65, [L - 1.4, -P + 1.6], [1, -1], g2 => {
      boite(g2, 1.1, 0.08, 1.1, 0, SOL, 0, mat('#F5F7F8', { roughness: 0.3 }));
      boite(g2, 0.03, 1.9, 1.1, -0.55, SOL + 0.08, 0, mat('#BFE6F5', { transparent: true, opacity: 0.35, roughness: 0.1 }));
      boite(g2, 0.06, 0.06, 0.4, 0.45, SOL + 1.95, 0, mat('#B0B6BA', { metalness: 0.6, roughness: 0.3 }));
    }, [L - 1.25, -P, L, -P + 1.25]);
    this.meuble('miroir', L - 1.6, -P + 0.25, [L - 1.6, -P + 1.0], [0, -1], g2 => {
      boite(g2, 0.6, 0.8, 0.35, 0, SOL, 0, mat('#FFFFFF'));
      boite(g2, 0.5, 0.75, 0.03, 0, SOL + 1.0, -0.15, mat('#CFE4EE', { roughness: 0.05, metalness: 0.6 }));
    }, [L - 1.95, -P, L - 1.25, -P + 0.5]);
    this.meuble('porte', 0.6, P - 0.05, [0.6, P - 0.9], [0, 1], g2 => {
      boite(g2, 0.95, 0.03, 0.4, 0, SOL, 0, mat('#3DDC84', { transparent: true, opacity: 0.6 }));
    }, null);
    // la cloison de la salle d'eau bloque aussi le passage
    this.bloquer([L - 2.3, -P, L - 2.1, -P + 2.1]);

    // la lumiere : le jour par la fenetre, le soir une lampe chaude
    s.add(new THREE.HemisphereLight(nuit ? '#6B7CA8' : '#DCEBFF', '#6A5040', nuit ? 0.55 : 1.0));
    const soleil = new THREE.DirectionalLight(nuit ? '#FFC98A' : '#FFF4E0', nuit ? 1.4 : 2.4);
    soleil.position.set(nuit ? 1 : -2.5, 6, nuit ? 2 : -1);
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(1024, 1024);
    const c = soleil.shadow.camera as THREE.OrthographicCamera;
    c.left = -L - 1; c.right = L + 1; c.top = P + 1; c.bottom = -P - 1; c.near = 0.5; c.far = 20;
    soleil.shadow.bias = -0.0005;
    s.add(soleil);
    if (nuit) { const lampe = new THREE.PointLight('#FFC27A', 6, 7, 1.6); lampe.position.set(-1.6, SOL + 2.2, 0.6); s.add(lampe); }
  }

  private meuble(m: Meuble, x: number, z: number, ou: [number, number], regard: [number, number],
                 faire: (g: THREE.Group) => void, emprise: [number, number, number, number] | null,
                 emprise2?: [number, number, number, number]) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    faire(g);
    g.traverse(o => { o.userData.meuble = m; });
    this.scene.add(g);
    if (emprise) this.bloquer(emprise);
    if (emprise2) this.bloquer(emprise2);
    this.places.push({ meuble: m, groupe: g, ou, regard, emprise: emprise || [0, 0, 0, 0] });
  }

  private bloquer([x0, z0, x1, z1]: [number, number, number, number]) {
    for (let i = 0; i < COLS; i++) for (let j = 0; j < RANGS; j++) {
      const x = -L + (i + 0.5) * CASE, z = -P + (j + 0.5) * CASE;
      if (x > x0 - 0.15 && x < x1 + 0.15 && z > z0 - 0.15 && z < z1 + 0.15) this.bloque[j * COLS + i] = 1;
    }
  }

  /** Le chemin le plus court sur la grille du sol, de meuble en meuble (A*, huit voisins). */
  private chemin(x0: number, z0: number, x1: number, z1: number): [number, number][] {
    const c = (x: number, z: number) => [Math.max(0, Math.min(COLS - 1, Math.floor((x + L) / CASE))), Math.max(0, Math.min(RANGS - 1, Math.floor((z + P) / CASE)))];
    const [ai, aj] = c(x0, z0), [bi, bj] = c(x1, z1);
    const n = COLS * RANGS, cout = new Float32Array(n).fill(Infinity), de = new Int32Array(n).fill(-1);
    const libre = (i: number, j: number) => i >= 0 && j >= 0 && i < COLS && j < RANGS && (!this.bloque[j * COLS + i] || (i === bi && j === bj) || (i === ai && j === aj));
    const ouverts: number[] = [aj * COLS + ai]; cout[ouverts[0]] = 0;
    const h = (k: number) => Math.hypot(k % COLS - bi, Math.floor(k / COLS) - bj);
    while (ouverts.length) {
      let m = 0; for (let k = 1; k < ouverts.length; k++) if (cout[ouverts[k]] + h(ouverts[k]) < cout[ouverts[m]] + h(ouverts[m])) m = k;
      const k = ouverts.splice(m, 1)[0];
      if (k === bj * COLS + bi) break;
      const i = k % COLS, j = Math.floor(k / COLS);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (!libre(i + di, j + dj) || (di && dj && (!libre(i + di, j) || !libre(i, j + dj)))) continue;
        const v = (j + dj) * COLS + i + di, nc = cout[k] + Math.hypot(di, dj);
        if (nc < cout[v]) { if (cout[v] === Infinity) ouverts.push(v); cout[v] = nc; de[v] = k; }
      }
    }
    const fin = bj * COLS + bi;
    if (de[fin] < 0 && fin !== aj * COLS + ai) return [[x1, z1]];
    const pts: [number, number][] = [[x1, z1]];
    for (let k = de[fin]; k >= 0 && k !== aj * COLS + ai; k = de[k]) pts.unshift([-L + (k % COLS + 0.5) * CASE, -P + (Math.floor(k / COLS) + 0.5) * CASE]);
    return pts;
  }

  /** Aller a un meuble : l'athlete y marche, puis le meuble propose ce qu'on y fait. */
  allerA(m: Meuble) {
    const p = this.places.find(q => q.meuble === m); if (!p) return;
    this.vise = m;
    this.moi.route = this.chemin(this.moi.pos.x, this.moi.pos.z, p.ou[0], p.ou[1]);
    this.marquer(p.ou[0], p.ou[1]);
  }

  private marquer(x: number, z: number) {
    this.anneau.position.set(x, SOL + 0.02, z);
    (this.anneau.material as THREE.MeshBasicMaterial).opacity = 0.9;
  }

  private toucher(cv: HTMLCanvasElement) {
    const ray = new THREE.Raycaster(), v = new THREE.Vector2();
    let x0 = 0, y0 = 0;
    const bas = (e: PointerEvent) => { x0 = e.clientX; y0 = e.clientY; };
    const haut = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - x0, e.clientY - y0) > 12) return;
      const r = cv.getBoundingClientRect();
      v.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(v, this.camera);
      const touche = ray.intersectObjects(this.scene.children, true).find(i => i.object.userData.meuble || i.object === this.sol);
      if (!touche) return;
      const m = touche.object.userData.meuble as Meuble | undefined;
      if (m) { this.allerA(m); return; }
      const px = Math.max(-L + 0.3, Math.min(L - 0.3, touche.point.x)), pz = Math.max(-P + 0.3, Math.min(P - 0.3, touche.point.z));
      this.vise = null;
      this.moi.route = this.chemin(this.moi.pos.x, this.moi.pos.z, px, pz);
      this.marquer(px, pz);
    };
    cv.addEventListener('pointerdown', bas); cv.addEventListener('pointerup', haut);
  }

  /** La camera de la maison de poupee : de face et un peu de cote, la piece entiere dans l'ecran. */
  private cadrer() {
    const w = this.hote.clientWidth || 1, h = this.hote.clientHeight || 1;
    this.rendu.setSize(w, h, false);
    this.camera.aspect = w / h;
    // la piece doit tenir en largeur (telephone en portrait) comme en hauteur
    const rayon = Math.hypot(L, P) * 1.02;
    const fovV = THREE.MathUtils.degToRad(this.camera.fov), fovH = 2 * Math.atan(Math.tan(fovV / 2) * this.camera.aspect);
    const d = rayon / Math.sin(Math.min(fovV, fovH) / 2);
    const dir = new THREE.Vector3(0.35, 0.95, 1).normalize();
    this.camera.position.copy(dir.multiplyScalar(d)).add(new THREE.Vector3(0, 0.6, 0));
    this.camera.lookAt(0, 0.6, 0.2);
    this.camera.updateProjectionMatrix();
  }

  private boucle = (ms: number) => {
    if (this.fini) return;
    const dt = Math.min(0.05, this.avant ? (ms - this.avant) / 1000 : 0); this.avant = ms;
    const arrive = this.moi.avancer(dt, 2.2);
    if (!this.moi.route.length) this.moi.marche = false;
    if (arrive) {
      (this.anneau.material as THREE.MeshBasicMaterial).opacity = 0;
      if (this.vise) {
        const p = this.places.find(q => q.meuble === this.vise)!;
        this.moi.dir.set(p.regard[0], 0, p.regard[1]).normalize(); this.moi.placer();
        const m = this.vise; this.vise = null;
        this.o.surMeuble(m);
      }
    }
    this.moi.peindre(this.camera);
    this.rendu.render(this.scene, this.camera);
    this.id = requestAnimationFrame(this.boucle);
  };

  /** Changer de tenue (le miroir) sans sortir. */
  habiller(look: any) { this.moi.habiller(look); }

  detruire() {
    this.fini = true;
    cancelAnimationFrame(this.id);
    for (const [t, f] of this.ecoute) window.removeEventListener(t, f);
    this.scene.traverse((o: any) => { o.geometry?.dispose?.(); });
    this.rendu.dispose();
    this.rendu.domElement.remove();
  }
}
