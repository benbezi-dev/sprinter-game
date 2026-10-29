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
import { Personne, SOL, type Habitant, type Lieu } from './ville';
import { POSTURES } from './postures';

// TOUS LES BATIMENTS (29/10, l'auteur : « on ne peut toujours pas entrer dans les batiments comme dans les Sims »,
// avec un bureau de Lagos Life ou les collegues travaillent). La meme piece en vue coupee, amenagee selon le lieu :
// la classe, le vestiaire du club, le cabinet du kine, le magasin, l'open space, le guichet, la pizzeria, le bassin.
// Les gens qui sont la a cette heure (gens.ts, ouEst) y sont ; on les touche pour leur parler. Un meuble touche :
// l'athlete y va, puis le lieu ouvre ce qu'on y fait (le panneau du lieu, CarriereAthlete). Les lieux de plein air
// (stade, cote, parc, marche) n'ont pas de piece.
export type Amenagement = 'maison' | 'classe' | 'vestiaire' | 'cabinet' | 'magasin' | 'bureaux' | 'guichet' | 'pizzeria' | 'bassin';
export const AMENAGEMENT: Partial<Record<Lieu, Amenagement>> = {
  maison: 'maison', parents: 'maison', babysitting: 'maison', college: 'classe', lycee: 'classe',
  club_quartier: 'vestiaire', club_horizon: 'vestiaire', kine: 'cabinet', boutique: 'magasin', travail: 'bureaux',
  gare: 'guichet', mairie: 'guichet', livraison: 'pizzeria', piscine: 'bassin',
};

export type Meuble = 'lit' | 'bureau' | 'canape' | 'table' | 'douche' | 'miroir' | 'porte'
  | 'tableau' | 'pupitres' | 'casiers' | 'muscu' | 'massage' | 'rayons' | 'caisse' | 'guichet' | 'comptoir' | 'bassin';
/** Ce qu'on fait a chaque meuble (les id d'ACTIONS ; « miroir » ouvre la garde-robe, « porte » ressort). */
export const ACTIONS_DU_MEUBLE: Record<Meuble, string[]> = {
  lit: ['dormir', 'sieste'], bureau: ['devoirs'], canape: ['console', 'telephone'],
  table: ['manger'], douche: ['douche'], miroir: [], porte: [],
  tableau: [], pupitres: [], casiers: [], muscu: [], massage: [], rayons: [], caisse: [], guichet: [], comptoir: [], bassin: [],
};

/**
 * CE QU'ON FAIT A CE MEUBLE, ICI (29/10, « une action a lui, dormir au lit ») : les id d'ACTIONS (regles.ts).
 * Vide : le meuble ouvre ce que le lieu propose (seances, soins, boutique, competition...).
 */
export function actionsDuMeuble(lieu: Lieu, m: Meuble): string[] {
  if (lieu === 'maison') return ACTIONS_DU_MEUBLE[m];
  if (lieu === 'parents') return m === 'table' ? ['manger_parents'] : [];
  if (lieu === 'college' || lieu === 'lycee') return m === 'pupitres' ? [lieu === 'college' ? 'cours' : 'cours_lycee'] : [];
  if (lieu === 'travail') return m === 'bureau' ? ['travail'] : [];
  if (lieu === 'club_quartier' || lieu === 'club_horizon') return m === 'casiers' ? ['discuter_club'] : [];
  if (lieu === 'livraison') return m === 'comptoir' || m === 'table' ? ['pizza'] : [];
  if (lieu === 'gare') return m === 'canape' ? ['echauffement'] : [];
  return [];
}

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

const ASSIS = POSTURES.assis();
const COQUILLES: Record<Exclude<Amenagement, 'maison'>, { sol: string; mur: string; mur2: string }> = {
  classe: { sol: '#C9B79A', mur: '#F1E6C8', mur2: '#E6D9B5' }, vestiaire: { sol: '#8E9AA3', mur: '#DDE3E8', mur2: '#CDD5DC' },
  cabinet: { sol: '#D9DEE2', mur: '#F4F6F8', mur2: '#E6ECEF' }, magasin: { sol: '#3A3F46', mur: '#F4F1EA', mur2: '#E0453A' },
  bureaux: { sol: '#B9BEC4', mur: '#EEF0F2', mur2: '#DDE1E5' }, guichet: { sol: '#C9C2B4', mur: '#EDE6D8', mur2: '#D8CDB8' },
  pizzeria: { sol: '#B5652E', mur: '#F2E3C9', mur2: '#E7CFA4' }, bassin: { sol: '#E8EEF0', mur: '#D6EEF7', mur2: '#C3E3F0' },
};

type Place = { meuble: Meuble; groupe: THREE.Group; ou: [number, number]; regard: [number, number]; emprise: [number, number, number, number] };
/** S'installer sur un meuble : ou poser les pieds, vers ou regarder, assis ou couche (a quelle hauteur). */
type Assise = { pos: [number, number]; dir: [number, number]; couche?: number };
// (les places assises : les pieds une cuisse devant le siege ; couche : les pieds au bout, la tete vers -dir)
const ASSISES: Partial<Record<Amenagement, Partial<Record<Meuble, Assise>>>> = {
  maison: { lit: { pos: [-L + 1.1, -P + 2.05], dir: [0, 1], couche: 0.66 }, canape: { pos: [-1.6, 0.95], dir: [0, -1] },
    bureau: { pos: [1.0, -P + 0.55], dir: [0, -1] }, table: { pos: [2.9, 1.3], dir: [-1, 0] } },
  classe: { pupitres: { pos: [-0.85, 1.85], dir: [0, -1] } },
  bureaux: { bureau: { pos: [-0.8, -0.45], dir: [0, -1] }, canape: { pos: [2.8, 1.05], dir: [0, -1] } },
  vestiaire: { casiers: { pos: [-1.2, -P + 1.5], dir: [0, 1] } },
  cabinet: { massage: { pos: [-0.1, -0.6], dir: [1, 0], couche: 0.92 } },
  pizzeria: { table: { pos: [-2.95, 0.6], dir: [1, 0] } },
  guichet: { canape: { pos: [-3.35, 0.95], dir: [0, -1] } },
};

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

  private gens: { id: string; p: Personne; el: HTMLElement; attente: number; part?: boolean }[] = [];
  private am: Amenagement = 'maison';

  constructor(private hote: HTMLElement, look: any, nuit: boolean,
              private o: { surMeuble: (m: Meuble) => void; amenagement?: Amenagement; gens?: Habitant[]; surPersonne?: (id: string) => void }) {
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
    this.am = o.amenagement || 'maison';
    this.construire(nuit, this.am);
    this.moi = new Personne(look, 0.6, P - 0.9, this.scene, 320);
    this.majGens(o.gens || []);
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
  private construire(nuit: boolean, am: Amenagement) {
    if (am !== 'maison') { this.coquille(nuit, COQUILLES[am]); this.amenager(am); this.lumiere(nuit); return; }
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
    this.lumiere(nuit);
    if (nuit) { const lampe = new THREE.PointLight('#FFC27A', 6, 7, 1.6); lampe.position.set(-1.6, SOL + 2.2, 0.6); s.add(lampe); }
  }

  /** La lumiere : le jour par la fenetre, le soir une lampe chaude. */
  private lumiere(nuit: boolean) {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(nuit ? '#6B7CA8' : '#DCEBFF', '#6A5040', nuit ? 0.55 : 1.0));
    const soleil = new THREE.DirectionalLight(nuit ? '#FFC98A' : '#FFF4E0', nuit ? 1.4 : 2.4);
    soleil.position.set(nuit ? 1 : -2.5, 6, nuit ? 2 : -1);
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(1024, 1024);
    const c = soleil.shadow.camera as THREE.OrthographicCamera;
    c.left = -L - 1; c.right = L + 1; c.top = P + 1; c.bottom = -P - 1; c.near = 0.5; c.far = 20;
    soleil.shadow.bias = -0.0005;
    s.add(soleil);
  }

  /** Le sol, les deux murs montres, la fenetre, et la porte qui ramene en ville. */
  private coquille(nuit: boolean, c: { sol: string; mur: string; mur2: string }) {
    const s = this.scene;
    this.sol = new THREE.Mesh(new THREE.BoxGeometry(2 * L, 0.1, 2 * P), mat(c.sol, { roughness: 0.6 }));
    this.sol.position.set(0, SOL - 0.05, 0); this.sol.receiveShadow = true; s.add(this.sol);
    const g = new THREE.Group(); s.add(g);
    boite(g, 2 * L + MUR, HAUT, MUR, 0, SOL, -P - MUR / 2, mat(c.mur));
    boite(g, MUR, HAUT, 2 * P, -L - MUR / 2, SOL, 0, mat(c.mur2));
    const fen = boite(g, 0.04, 1.1, 1.8, -L + 0.01, SOL + 1.0, 0.4, mat(nuit ? '#1D2C44' : '#BFE3FF', { emissive: nuit ? '#0A1430' : '#A8D8FF', emissiveIntensity: nuit ? 0.4 : 0.6 }));
    fen.castShadow = false;
    // les plafonniers, allumes le soir
    if (nuit) for (const x of [-2, 2]) { const l = new THREE.PointLight('#FFE2B0', 5, 8, 1.5); l.position.set(x, SOL + 2.4, 0); s.add(l); }
    this.meuble('porte', 0.6, P - 0.05, [0.6, P - 0.9], [0, 1], g2 => {
      boite(g2, 0.95, 0.03, 0.4, 0, SOL, 0, mat('#3DDC84', { transparent: true, opacity: 0.6 }));
    }, null);
  }

  /** Les meubles de chaque lieu ; chacun ouvre ce qu'on fait ici (le panneau du lieu). */
  private amenager(am: Amenagement) {
    const M = (m: Meuble, x: number, z: number, ou: [number, number], regard: [number, number], e: [number, number, number, number], f: (g: THREE.Group) => void) =>
      this.meuble(m, x, z, ou, regard, f, e);
    const chaise = (g: THREE.Group, x: number, z: number, c = '#2B2F36') => { boite(g, 0.42, 0.45, 0.42, x, SOL, z, mat(c)); boite(g, 0.42, 0.45, 0.05, x, SOL + 0.45, z + 0.19, mat(c)); };
    const pupitre = (g: THREE.Group, x: number, z: number) => {
      boite(g, 1.1, 0.04, 0.5, x, SOL + 0.72, z, mat('#D9C7A6'));
      for (const dx of [-0.5, 0.5]) boite(g, 0.04, 0.72, 0.45, x + dx, SOL, z, mat('#7A828C'));
      chaise(g, x - 0.25, z + 0.5, '#3E6B8C'); chaise(g, x + 0.25, z + 0.5, '#3E6B8C');
    };
    switch (am) {
      case 'classe':
        M('tableau', -0.4, -P + 0.06, [-0.4, -P + 1.2], [0, -1], [-1.6, -P, 0.8, -P + 0.2], g => {
          boite(g, 2.6, 1.1, 0.05, 0, SOL + 0.9, 0, mat('#1F4D3A', { roughness: 0.9 }));
          boite(g, 2.7, 0.06, 0.12, 0, SOL + 0.85, 0.05, mat('#C9B48A'));
          boite(g, 1.2, 0.05, 0.6, 2.2, SOL + 0.75, 0.9, mat('#8C6A44'));        // le bureau du prof
          boite(g, 1.1, 0.75, 0.55, 2.2, SOL, 0.9, mat('#6B4A30'));
        });
        this.bloquer([1.6, -P + 0.5, 2.8, -P + 1.3]);
        M('pupitres', -1.2, 0.2, [0.4, 0.9], [-1, 0], [-3.4, -0.4, -0.4, 2.3], g => {
          for (const dz of [-0.4, 0.8, 2.0]) for (const dx of [-1.4, 0.1]) pupitre(g, dx, dz - 0.4);
        });
        break;
      case 'vestiaire':
        M('casiers', -1.2, -P + 0.3, [-1.2, -P + 1.5], [0, -1], [-3.4, -P, 1.0, -P + 0.9], g => {
          for (let i = 0; i < 8; i++) {
            boite(g, 0.5, 1.9, 0.5, -1.75 + i * 0.52, SOL, 0, mat(i % 2 ? '#2F6FB0' : '#2A62A0', { roughness: 0.5, metalness: 0.3 }));
            boite(g, 0.06, 0.06, 0.02, -1.6 + i * 0.52, SOL + 1.1, 0.26, mat('#D0D4D8', { metalness: 0.7 }));
          }
          boite(g, 4.0, 0.45, 0.35, 0, SOL, 0.75, mat('#B98A5E'));               // le banc
        });
        M('tableau', -L + 0.06, -0.6, [-L + 1.1, -0.6], [-1, 0], [-L, -1.6, -L + 0.3, 0.4], g => {
          boite(g, 0.04, 1.0, 1.8, 0, SOL + 1.0, 0, mat('#F4F6F8', { roughness: 0.3 }));
          boite(g, 0.03, 0.08, 1.2, 0.02, SOL + 1.6, 0, mat('#E0453A'));         // le programme du coach
        });
        M('muscu', 2.4, 0.4, [1.2, 0.4], [1, 0], [1.6, -0.6, 4.4, 1.6], g => {
          boite(g, 2.4, 0.03, 2.0, 0, SOL, 0, mat('#2B2F36', { roughness: 0.95 }));      // le tapis
          boite(g, 0.06, 1.6, 0.06, -0.6, SOL, -0.7, mat('#9AA4AA', { metalness: 0.6 }));
          boite(g, 0.06, 1.6, 0.06, 0.6, SOL, -0.7, mat('#9AA4AA', { metalness: 0.6 }));
          boite(g, 1.8, 0.04, 0.04, 0, SOL + 1.35, -0.7, mat('#C9CED2', { metalness: 0.8, roughness: 0.3 })); // la barre
          for (const x of [-0.85, 0.85]) boite(g, 0.08, 0.45, 0.45, x, SOL + 1.12, -0.7, mat('#1A1D21'));
          boite(g, 1.2, 0.35, 0.4, 0, SOL, 0.5, mat('#3A3F46'));                   // le banc de developpe
          for (let i = 0; i < 5; i++) boite(g, 0.22, 0.12, 0.12, -0.9 + i * 0.3, SOL, 0.95, mat('#1A1D21')); // les halteres
        });
        break;
      case 'cabinet':
        M('massage', -1.0, -0.6, [-1.0, 0.5], [0, -1], [-2.0, -1.0, 0.0, -0.2], g => {
          boite(g, 1.9, 0.7, 0.7, 0, SOL, 0, mat('#EDEFF1'));
          boite(g, 1.95, 0.12, 0.72, 0, SOL + 0.7, 0, mat('#4A9BB5'));
          boite(g, 0.4, 0.06, 0.6, -0.8, SOL + 0.82, 0, mat('#FFFFFF'));
        });
        M('bureau', 2.4, -P + 0.6, [2.4, -P + 1.6], [0, -1], [1.6, -P, 3.2, -P + 1.0], g => {
          boite(g, 1.4, 0.05, 0.7, 0, SOL + 0.74, 0, mat('#E8E2D6'));
          boite(g, 1.3, 0.74, 0.6, 0, SOL, 0, mat('#B0A89C'));
          boite(g, 0.5, 0.32, 0.03, 0, SOL + 0.78, -0.2, mat('#1F6FB5', { emissive: '#1F6FB5', emissiveIntensity: 0.5 }));
        });
        // l'espalier, le ballon, un squelette d'anatomie
        boite(this.scene, 1.2, 2.2, 0.08, -2.6, SOL, -P + 0.06, mat('#C9A36B'));
        { const b = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 16), mat('#E0453A', { roughness: 0.4 })); b.position.set(3.4, SOL + 0.33, 1.6); b.castShadow = true; this.scene.add(b); }
        this.bloquer([-3.2, -P, -2.0, -P + 0.3]); this.bloquer([3.0, 1.2, 3.8, 2.0]);
        break;
      case 'magasin':
        M('rayons', -1.0, -P + 0.3, [-1.0, -P + 1.4], [0, -1], [-3.4, -P, 1.4, -P + 0.7], g => {
          for (let i = 0; i < 4; i++) {
            boite(g, 1.15, 2.0, 0.45, -1.8 + i * 1.2, SOL, 0, mat('#F2F2F2'));
            for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++)
              boite(g, 0.26, 0.14, 0.3, -2.15 + i * 1.2 + k * 0.35, SOL + 0.35 + r * 0.42, 0.05,
                mat(['#E0453A', '#2F6FB0', '#3DDC84', '#F2B33D', '#1A1D21'][(i + r + k) % 5]));
          }
        });
        M('miroir', -L + 0.3, 1.0, [-L + 1.2, 1.0], [-1, 0], [-L, 0.4, -L + 0.6, 1.6], g => {
          boite(g, 0.05, 1.8, 0.9, -0.2, SOL, 0, mat('#CFE4EE', { roughness: 0.05, metalness: 0.6 }));
          boite(g, 0.5, 0.05, 1.0, 0, SOL + 1.9, 0, mat('#3A3F46'));            // la cabine
        });
        M('caisse', 2.6, 0.6, [2.6, 1.6], [0, -1], [1.6, 0.1, 3.6, 1.1], g => {
          boite(g, 1.9, 1.0, 0.7, 0, SOL, 0, mat('#2B2F36'));
          boite(g, 0.35, 0.3, 0.3, 0.4, SOL + 1.0, 0, mat('#D0D4D8'));
          boite(g, 1.95, 0.04, 0.75, 0, SOL + 1.0, 0, mat('#E0453A'));
        });
        // un portant de maillots
        boite(this.scene, 1.6, 0.04, 0.04, 0.5, SOL + 1.5, 0.6, mat('#9AA4AA', { metalness: 0.7 }));
        for (let k = 0; k < 6; k++) boite(this.scene, 0.06, 0.7, 0.45, -0.1 + k * 0.24, SOL + 0.75, 0.6, mat(['#E0453A', '#2F6FB0', '#F2F2F2'][k % 3]));
        this.bloquer([-0.4, 0.3, 1.4, 0.9]);
        break;
      case 'bureaux':
        M('bureau', -1.2, -0.4, [0.4, 1.4], [0, -1], [-3.6, -P + 0.4, 1.4, 1.0], g => {
          for (const [x, z] of [[-1.6, -2.4], [0.4, -2.4], [-1.6, -0.6], [0.4, -0.6]] as [number, number][]) {
            boite(g, 1.5, 0.05, 0.75, x, SOL + 0.74, z + 0.4, mat('#F4F1EA'));
            boite(g, 1.4, 0.74, 0.05, x, SOL, z + 0.05, mat('#B0A89C'));
            boite(g, 0.55, 0.36, 0.03, x, SOL + 0.79, z + 0.2, mat('#1F6FB5', { emissive: '#1F6FB5', emissiveIntensity: 0.5 }));
            chaise(g, x, z + 1.0);
          }
        });
        M('canape', 2.8, 1.5, [2.8, 0.6], [0, 1], [1.8, 1.1, 3.9, 2.0], g => {
          boite(g, 2.0, 0.42, 0.8, 0, SOL, 0, mat('#1F5C3A'));
          boite(g, 2.0, 0.45, 0.18, 0, SOL + 0.42, 0.32, mat('#174A2E'));
        });
        M('table', 2.8, -P + 0.9, [2.8, -P + 2.0], [0, -1], [1.8, -P + 0.4, 3.8, -P + 1.4], g => {
          boite(g, 1.6, 0.05, 0.8, 0, SOL + 0.74, 0, mat('#C9A36B'));                 // le coin cafe
          boite(g, 1.5, 0.74, 0.7, 0, SOL, 0, mat('#8C6A44'));
          boite(g, 0.3, 0.4, 0.3, 0.5, SOL + 0.76, 0, mat('#2B2F36'));
        });
        break;
      case 'guichet':
        M('guichet', -0.6, -P + 0.6, [-0.6, -P + 1.8], [0, -1], [-3.4, -P, 2.2, -P + 1.2], g => {
          boite(g, 5.4, 1.05, 0.6, 0, SOL, 0, mat('#C9A36B'));
          boite(g, 5.4, 0.05, 0.7, 0, SOL + 1.05, 0, mat('#F4F1EA'));
          boite(g, 5.4, 0.9, 0.03, 0, SOL + 1.1, 0.1, mat('#BFE6F5', { transparent: true, opacity: 0.3, roughness: 0.1 }));
          boite(g, 2.2, 0.5, 0.05, 1.2, SOL + 2.0, -0.25, mat('#0F1418', { emissive: '#F2B33D', emissiveIntensity: 0.25 })); // le panneau
        });
        M('canape', -2.6, 1.4, [-2.6, 0.5], [0, 1], [-3.8, 1.0, -1.4, 1.8], g => {
          for (let k = 0; k < 4; k++) chaise(g, -0.75 + k * 0.5, 0, '#5A6470');                  // les sieges d'attente
        });
        break;
      case 'pizzeria':
        M('comptoir', 0.4, -P + 1.0, [0.4, -P + 2.1], [0, -1], [-1.6, -P, 2.6, -P + 1.5], g => {
          boite(g, 4.0, 1.0, 0.7, 0, SOL, 0, mat('#8C3A2B'));
          boite(g, 4.0, 0.05, 0.75, 0, SOL + 1.0, 0, mat('#E8E2D6'));
          const four = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#B5652E'));
          four.position.set(1.4, SOL, -0.7); four.castShadow = true; g.add(four);
          boite(g, 0.5, 0.35, 0.05, 1.4, SOL + 0.05, 0.17 - 0.7, mat('#FF8A3D', { emissive: '#FF6A1A', emissiveIntensity: 0.9 }));
        });
        M('table', -2.2, 1.0, [-1.0, 1.0], [-1, 0], [-3.6, 0.0, -0.8, 2.2], g => {
          for (const [x, z] of [[-0.6, -0.4], [0.9, 0.6]] as [number, number][]) {
            boite(g, 0.9, 0.05, 0.9, x, SOL + 0.74, z, mat('#F4F1EA'));
            boite(g, 0.08, 0.74, 0.08, x, SOL, z, mat('#3A3F46'));
            chaise(g, x - 0.6, z, '#E0453A'); chaise(g, x + 0.6, z, '#E0453A');
          }
        });
        break;
      case 'bassin':
        M('bassin', -0.6, -0.8, [-0.6, 1.4], [0, -1], [-3.8, -P + 0.4, 2.6, 0.9], g => {
          boite(g, 6.4, 0.06, 4.0, 0, SOL - 0.04, 0, mat('#E8EEF0'));
          const eau = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.02, 3.6), mat('#3AA7D9', { transparent: true, opacity: 0.85, roughness: 0.05, metalness: 0.1 }));
          eau.position.set(0, SOL + 0.03, 0); g.add(eau);
          for (let k = 1; k < 5; k++) boite(g, 6.0, 0.03, 0.05, 0, SOL + 0.04, -1.8 + k * 0.72, mat(k % 2 ? '#E0453A' : '#F4F1EA'));
        });
        break;
    }
  }

  /**
   * Les gens qui sont la (gens.ts, ouEst) : ceux qui arrivent entrent par la porte, ceux qui s'en vont sortent ;
   * l'ecran le redemande a chaque minute de jeu (« la liste des presents ne change pas si l'heure tourne »).
   */
  majGens(liste: Habitant[]) {
    const vus = new Set(liste.map(h => h.id));
    // qui s'en va marche jusqu'a la porte, et ne disparait qu'en la passant (boucle)
    for (const g of this.gens) {
      if (!vus.has(g.id) && !g.part) { g.part = true; g.p.route = this.chemin(g.p.pos.x, g.p.pos.z, 0.6, P - 0.2); }
      else if (vus.has(g.id) && g.part) { g.part = false; g.attente = 0; }
    }
    for (const h of liste.slice(0, 6)) {
      if (this.gens.some(g => g.id === h.id)) continue;
      const p = new Personne(h.look, 0.6, P - 0.3, this.scene, 200);
      p.route = this.chemin(0.6, P - 0.3, ...this.pointLibre());
      const el = document.createElement('button');
      el.textContent = h.nom;
      el.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;z-index:1;padding:2px 8px;border-radius:999px;'
        + 'background:rgba(255,255,255,0.92);color:#0F2A1E;font:800 10px system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.25)';
      el.addEventListener('click', ev => { ev.stopPropagation(); this.o.surPersonne?.(h.id); });
      this.hote.appendChild(el);
      this.gens.push({ id: h.id, p, el, attente: 0 });
    }
  }

  /** Un point du sol ou personne ne bute : ni meuble, ni la porte. */
  private pointLibre(): [number, number] {
    for (let k = 0; k < 40; k++) {
      const x = -L + 0.5 + Math.random() * (2 * L - 1), z = -P + 0.5 + Math.random() * (2 * P - 1.6);
      const i = Math.floor((x + L) / CASE), j = Math.floor((z + P) / CASE);
      if (!this.bloque[j * COLS + i]) return [x, z];
    }
    return [-2.6, 2.4];
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

  /** La ou il se tenait avant de s'asseoir : il s'y releve. */
  private debout: [number, number] | null = null;
  /** Se lever du siege ou du lit avant de repartir. */
  private relever() {
    if (!this.debout) return;
    this.moi.pose = null; this.moi.couche = 0;
    this.moi.pos.set(this.debout[0], 0, this.debout[1]); this.debout = null; this.moi.placer();
  }

  /** Aller a un meuble : l'athlete y marche, puis le meuble propose ce qu'on y fait. */
  allerA(m: Meuble) {
    const p = this.places.find(q => q.meuble === m); if (!p) return;
    this.vise = m;
    this.relever();
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
      this.relever();
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
    // en portrait, la piece vue plus d'en haut et de plus pres : elle remplit l'ecran (« comme dans les Sims », 29/10)
    const portrait = this.camera.aspect < 0.8;
    const rayon = Math.hypot(L, P) * (portrait ? 0.74 : 1.02);
    const fovV = THREE.MathUtils.degToRad(this.camera.fov), fovH = 2 * Math.atan(Math.tan(fovV / 2) * this.camera.aspect);
    const d = rayon / Math.sin(Math.min(fovV, fovH) / 2);
    const dir = new THREE.Vector3(0.35, portrait ? 1.7 : 0.95, 1).normalize();
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
        this.moi.dir.set(p.regard[0], 0, p.regard[1]).normalize();
        // s'installer : assis sur le siege, couche sur le lit ou la table de soins
        const as = ASSISES[this.am]?.[p.meuble];
        if (as) {
          this.debout = [this.moi.pos.x, this.moi.pos.z];
          this.moi.pos.set(as.pos[0], 0, as.pos[1]); this.moi.dir.set(as.dir[0], 0, as.dir[1]).normalize();
          if (as.couche) this.moi.couche = as.couche; else this.moi.pose = ASSIS;
        }
        this.moi.placer();
        const m = this.vise; this.vise = null;
        this.o.surMeuble(m);
      }
    }
    this.moi.peindre(this.camera);
    const w = this.hote.clientWidth, h = this.hote.clientHeight, v = new THREE.Vector3();
    for (const g of this.gens.filter(g => g.part && !g.p.route.length)) { g.p.retirer(); g.el.remove(); }
    this.gens = this.gens.filter(g => !(g.part && !g.p.route.length));
    for (const g of this.gens) {
      if (g.part) g.p.avancer(dt, 1.3);
      else if (g.p.route.length) { if (g.p.avancer(dt, 1.1)) g.attente = 3 + Math.random() * 6; }
      else if ((g.attente -= dt) <= 0) { g.p.route = this.chemin(g.p.pos.x, g.p.pos.z, ...this.pointLibre()); g.attente = 99; }
      else g.p.marche = false;
      g.p.peindre(this.camera);
      v.set(g.p.pos.x, SOL + 2.0, g.p.pos.z).project(this.camera);
      g.el.style.transform = `translate(${(v.x + 1) / 2 * w}px, ${(1 - v.y) / 2 * h}px) translate(-50%, -100%)`;
    }
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
    for (const g of this.gens) g.el.remove();
    this.rendu.dispose();
    this.rendu.domElement.remove();
  }
}
