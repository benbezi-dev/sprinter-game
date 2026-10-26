// LA VILLE DE LA CARRIERE D'ATHLETE : VAL-DE-REUIL, en vraie 3D.
//
// L'auteur, 25/10 : « une vraie ville avec des clubs, des deplacements…
// comme les Sims », « le plus proche des Sims, le joueur doit etre
// pilotable », « tu peux faire beaucoup mieux », puis « re-creer la ville de
// Val-de-Reuil ».
//
// LA VILLE VIENT D'OPENSTREETMAP (tools/ville/osm-val-de-reuil.mjs ->
// public/athlete/val-de-reuil.json) : les vraies rues et allees pietonnes, les
// batiments a leur emprise reelle, l'eau, les pelouses, les bois, la voie
// ferree, la gare, les pistes d'athletisme. Les hauteurs que la carte ne donne
// pas sont ESTIMEES d'apres l'emprise (hauteurDe). Donnees © contributeurs
// OpenStreetMap, ODbL — la mention s'affiche a l'ecran.
//
// LE RENDU : tout est construit au chargement, sans modele a telecharger, et
// fusionne par matiere (quelques dizaines d'appels de dessin pour toute la
// ville). Lumiere d'apres-midi, ombres douces autour du joueur, camera
// orthographique a 45° qu'on tourne d'un quart de tour et qu'on zoome.
//
// LES PERSONNAGES SONT CEUX DE LA PISTE : le corps a facettes du moteur peint
// dans une affiche tournee vers la camera, dans sa demarche.
//
// LA NETTETE D'ABORD (l'auteur, 24/10 : « je ne veux pas de crenelage ») :
// anticrenelage toujours, jamais moins de 2 pixels par point. Sur un telephone
// qui peine, ce sont les ombres qui partent, jamais la nettete.
//
// Ce fichier ne sait rien de React ni des regles : il dit quand on arrive a
// la porte d'un lieu (`surLieu`), l'ecran decide de ce qui s'y passe.

import * as THREE from 'three';
import { SprinterApp, SprinterCore } from '../engine';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as clonerSquelette } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { poser, type Modele } from '../vedette-3d';
import { couleursDe, tenueDeVilleDe } from './garde-robe';

export type Lieu =
  | 'maison' | 'college' | 'stade' | 'club_quartier' | 'club_horizon' | 'kine'
  | 'boutique' | 'marche' | 'livraison' | 'babysitting' | 'gare' | 'cote' | 'parc'
  | 'piscine' | 'mairie' | 'lycee' | 'travail' | 'parents';

type P2 = [number, number];
export type Donnees = {
  origine: [number, number];
  batiments: { p: P2[]; h: number; t: string; n?: string; a?: string }[];
  routes: { l: P2[]; w: number; t: string; n?: string }[];
  rails: { l: P2[]; t: string }[];
  eau: P2[][];
  vert: { k: string; p: P2[]; n?: string }[];
  arbres: P2[];
  pistes: { p: P2[]; sport: string; ferme: boolean; lanes?: number }[];
  parkings: P2[][];
};

/** Les donnees de la ville, lues une fois et partagees (la ville 3D, la carte du telephone). */
let donnees: Promise<Donnees> | null = null;
export function chargerVille(): Promise<Donnees> {
  const base = (import.meta as any).env?.BASE_URL || '/';
  return (donnees ||= fetch(base + 'athlete/val-de-reuil.json').then(r => r.json()));
}

/* ----------------------------------------------------------------- les lieux */

// Ou se trouve chaque lieu du jeu dans la vraie ville. Les lieux publics
// portent leur vrai nom ; les clubs, le kine, la boutique et la pizzeria sont
// des lieux de jeu (pas de vrai commerce ni de vrai club sans leur accord).
// `ll` : latitude, longitude (OSM, releve du 25/10) ; `xz` : metres sur la carte.
export const LIEUX: Record<Lieu, { ll?: P2; xz?: P2; vrai?: string }> = {
  maison: { ll: [49.2722, 1.2088] },
  college: { ll: [49.27397, 1.21297], vrai: 'Collège Alphonse Allais' },
  lycee: { ll: [49.26902, 1.20265], vrai: 'Lycée Marc Bloch' },
  stade: { ll: [49.27051, 1.19753], vrai: 'Stade Bernard Amsalem' },
  club_quartier: { ll: [49.27125, 1.19640] },
  club_horizon: { ll: [49.26749, 1.21765] },
  kine: { ll: [49.27205, 1.21420] },
  boutique: { xz: [-231.5, 237.8] },
  marche: { xz: [-7, 336.9], vrai: 'Promenade du Marché' },
  livraison: { ll: [49.26679, 1.20413] },
  babysitting: { ll: [49.2762, 1.2168] },
  gare: { ll: [49.27551, 1.22491], vrai: 'Gare de Val-de-Reuil' },
  cote: { xz: [-643.9, 621.8], vrai: 'Avenue des Falaises' },
  parc: { xz: [608, -428], vrai: 'Parc de Sztum' },
  piscine: { ll: [49.27233, 1.21526], vrai: 'Piscine Alice Milliat' },
  mairie: { ll: [49.27293, 1.21662], vrai: 'Mairie' },
  travail: { xz: [-96, -580], vrai: 'Zone d’activité des Lacs' },
  // chez les parents : la maison de l'enfance ; un adulte habite son appartement, pres de la gare
  parents: { ll: [49.2722, 1.2088] },
};
/** L'appartement d'un athlete adulte (Options.adulte) : la ou la maison de l'enfance etait. */
const APPARTEMENT: P2 = [49.2748, 1.2226];

/* ------------------------------------------------------------- le reseau */

/**
 * Les rues et allees comme un graphe : on marche le long des vraies voies.
 * Les segments longs sont recoupes tous les 8 m, pour qu'un doigt pose
 * n'importe ou trouve un point proche.
 */
class Reseau {
  xs: number[] = []; zs: number[] = [];
  adj: number[][] = [];
  private cles = new Map<string, number>();
  private seaux = new Map<string, number[]>();

  /** Les traces auxquels appartient chaque noeud (pour raccorder un bout a une AUTRE rue). */
  private traces: number[][] = [];
  constructor(lignes: P2[][]) {
    lignes.forEach((l, li) => {
      let avant = this.noeud(l[0][0], l[0][1], li);
      for (let i = 1; i < l.length; i++) {
        const [ax, az] = l[i - 1], [bx, bz] = l[i];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 8));
        for (let k = 1; k <= n; k++) {
          const j = this.noeud(ax + (bx - ax) * k / n, az + (bz - az) * k / n, li);
          if (j !== avant) { this.adj[avant].push(j); this.adj[j].push(avant); }
          avant = j;
        }
      }
    });
  }

  /**
   * Raccorder les bouts de tracés (un noeud qui n'a qu'un voisin) aux noeuds les plus proches
   * d'un autre tracé, a moins de `rayon` metres : les trottoirs se rejoignent aux carrefours.
   */
  relier(rayon: number) {
    const bouts = this.adj.map((a, i) => (a.length <= 1 ? i : -1)).filter(i => i >= 0);
    for (const i of bouts) {
      const voisins: [number, number][] = [];
      const cx = Math.floor(this.xs[i] / 20), cz = Math.floor(this.zs[i] / 20);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        for (const j of this.seaux.get(`${cx + dx},${cz + dz}`) || []) {
          if (j === i || this.adj[i].includes(j) || this.traces[j].some(t => this.traces[i].includes(t))) continue;
          const d = Math.hypot(this.xs[j] - this.xs[i], this.zs[j] - this.zs[i]);
          if (d < rayon) voisins.push([d, j]);
        }
      }
      voisins.sort((a, b) => a[0] - b[0]);
      for (const [, j] of voisins.slice(0, 3)) { this.adj[i].push(j); this.adj[j].push(i); }
    }
  }

  /**
   * Souder les morceaux isoles : la carte (OpenStreetMap) a des chemins qui ne se touchent pas — le
   * lycee et la gare etaient injoignables a pied. Chaque morceau est relie, par son noeud le plus
   * proche, au noeud d'un autre morceau a moins de `max` metres ; on recommence tant que ca soude.
   */
  souder(max: number) {
    for (let passe = 0; passe < 6; passe++) {
      const comp = new Int32Array(this.xs.length).fill(-1); const tailles: number[] = [];
      for (let i = 0; i < this.xs.length; i++) {
        if (comp[i] >= 0) continue;
        const c = tailles.length; let n = 0; const pile = [i]; comp[i] = c;
        while (pile.length) { const a = pile.pop()!; n++; for (const b of this.adj[a]) if (comp[b] < 0) { comp[b] = c; pile.push(b); } }
        tailles.push(n);
      }
      if (tailles.length <= 1) return;
      const r = Math.ceil(max / 20);
      const meilleur = new Map<number, [number, number, number]>();
      for (let i = 0; i < this.xs.length; i++) {
        // le grand morceau (plus de la moitie des noeuds) ne cherche pas : ce sont les autres qu'on y soude
        const ci = comp[i]; if (tailles[ci] >= this.xs.length / 2) continue;
        const cx = Math.floor(this.xs[i] / 20), cz = Math.floor(this.zs[i] / 20);
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          for (const j of this.seaux.get(`${cx + dx},${cz + dz}`) || []) {
            if (comp[j] === ci) continue;
            const d = Math.hypot(this.xs[j] - this.xs[i], this.zs[j] - this.zs[i]);
            const m = meilleur.get(ci);
            if (d < max && (!m || d < m[0])) meilleur.set(ci, [d, i, j]);
          }
        }
      }
      if (!meilleur.size) return;
      for (const [, [, i, j]] of meilleur) { this.adj[i].push(j); this.adj[j].push(i); }
    }
  }

  private noeud(x: number, z: number, trace = -1): number {
    const c = Math.round(x * 2) + ',' + Math.round(z * 2);
    let i = this.cles.get(c);
    if (i !== undefined) { if (!this.traces[i].includes(trace)) this.traces[i].push(trace); return i; }
    i = this.xs.length; this.xs.push(x); this.zs.push(z); this.adj.push([]); this.traces.push([trace]);
    this.cles.set(c, i);
    const s = Math.floor(x / 20) + ',' + Math.floor(z / 20);
    (this.seaux.get(s) || this.seaux.set(s, []).get(s)!).push(i);
    return i;
  }

  /** Le point du reseau le plus proche, a moins de `max` metres. */
  proche(x: number, z: number, max = 60): number {
    let best = -1, bd = max * max;
    const r = Math.ceil(max / 20), cx = Math.floor(x / 20), cz = Math.floor(z / 20);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      for (const k of this.seaux.get((cx + i) + ',' + (cz + j)) || []) {
        const d = (this.xs[k] - x) ** 2 + (this.zs[k] - z) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
    }
    return best;
  }

  /** Le plus court chemin (Dijkstra, tas binaire). Rend la suite des points, sans le depart. */
  chemin(a: number, b: number): P2[] {
    if (a < 0 || b < 0) return [];
    const n = this.xs.length, dist = new Float64Array(n).fill(Infinity), venu = new Int32Array(n).fill(-1);
    const tas: [number, number][] = [[0, a]]; dist[a] = 0;
    const pousser = (e: [number, number]) => {
      tas.push(e); let i = tas.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (tas[p][0] <= tas[i][0]) break; [tas[p], tas[i]] = [tas[i], tas[p]]; i = p; }
    };
    const tirer = () => {
      const h = tas[0], f = tas.pop()!;
      if (tas.length) {
        tas[0] = f; let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < tas.length && tas[l][0] < tas[m][0]) m = l;
          if (r < tas.length && tas[r][0] < tas[m][0]) m = r;
          if (m === i) break; [tas[m], tas[i]] = [tas[i], tas[m]]; i = m;
        }
      }
      return h;
    };
    while (tas.length) {
      const [d, u] = tirer();
      if (u === b) break;
      if (d > dist[u]) continue;
      for (const v of this.adj[u]) {
        const nd = d + Math.hypot(this.xs[u] - this.xs[v], this.zs[u] - this.zs[v]);
        if (nd < dist[v]) { dist[v] = nd; venu[v] = u; pousser([nd, v]); }
      }
    }
    if (a !== b && venu[b] < 0) return [];
    const out: P2[] = [];
    for (let k = b; k !== a; k = venu[k]) out.unshift([this.xs[k], this.zs[k]]);
    return out;
  }

  auHasard(pres: P2, rayon: number): number {
    for (let essai = 0; essai < 30; essai++) {
      const k = this.proche(pres[0] + (Math.random() - 0.5) * 2 * rayon, pres[1] + (Math.random() - 0.5) * 2 * rayon, 40);
      if (k >= 0 && this.adj[k].length) return k;
    }
    return -1;
  }
}

/* ------------------------------------------------------------- les matieres */

function toile(l: number, h: number, peindre: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = l; cv.height = h;
  peindre(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const mat = (couleur: string | number, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.9, metalness: 0, ...o });

/** La meme travee, la nuit : seules certaines fenetres sont allumees. */
function traveeNuit() {
  return toile(512, 384, c => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 512, 384);
    // quatre travees sur quatre etages dans une seule image : pas toutes les memes fenetres allumees
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (const x of [16, 76]) {
      if (((i * 7 + j * 3 + x) % 5) > 1) continue;
      c.fillStyle = ['#FFD9A0', '#FFE7B8', '#FFC97A'][(i + j) % 3];
      c.fillRect(i * 128 + x, j * 96 + 26, 36, 50);
    }
  });
}

/** Une travee de facade (4 m x 3 m) : deux fenetres sur un mur blanc, que la couleur du batiment teinte. */
function travee(petite: boolean) {
  return toile(128, 96, c => {
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, 128, 96);
    for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`; c.fillRect(Math.random() * 128, Math.random() * 96, 2, 2); }
    if (petite) return;
    for (const x of [16, 76]) {
      const g = c.createLinearGradient(x, 26, x + 36, 76);
      g.addColorStop(0, '#9FC2DA'); g.addColorStop(0.55, '#53779A'); g.addColorStop(1, '#3B5774');
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x - 2, 24, 40, 54);
      c.fillStyle = g; c.fillRect(x, 26, 36, 50);
      c.fillStyle = '#F4F1EA'; c.fillRect(x + 16, 26, 3, 50); c.fillRect(x - 3, 76, 42, 4);
    }
  });
}

/* ------------------------------------------------------------- les constructions */

/** Un tampon de triangles qu'on remplit puis qu'on fige en une geometrie. */
class Tampon {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; col: number[] = [];
  tri(a: number[], b: number[], c: number[], n: number[], uva: number[] = [0, 0], uvb: number[] = [0, 0], uvc: number[] = [0, 0], couleur?: THREE.Color) {
    this.pos.push(...a, ...b, ...c); this.nor.push(...n, ...n, ...n); this.uv.push(...uva, ...uvb, ...uvc);
    if (couleur) for (let i = 0; i < 3; i++) this.col.push(couleur.r, couleur.g, couleur.b);
  }
  geometrie() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}

const HAUT: number[] = [0, 1, 0];

// LA VILLE EN TUILES (25/10, mesure sur Mac M1 : 1,1 million de triangles dessines a chaque
// image pour 34 a 60 m de rue a l'ecran). Chaque piece fusionnee et chaque lot d'objets repetes
// est coupe en tuiles de TUILE metres, chacune avec sa sphere englobante : three.js ne dessine
// que celles que la camera (ou la lumiere des ombres) voit.
const TUILE = 150;
const cleTuile = (x: number, z: number) => `${Math.floor(x / TUILE)},${Math.floor(z / TUILE)}`;
/** Un tampon coupe en tuiles, triangle par triangle, selon son centre. */
function enTuiles(t: Tampon): Tampon[] {
  const parTuile = new Map<string, Tampon>(), couleur = t.col.length > 0;
  for (let i = 0, n = t.pos.length / 9; i < n; i++) {
    const p = t.pos, k = cleTuile((p[i * 9] + p[i * 9 + 3] + p[i * 9 + 6]) / 3, (p[i * 9 + 2] + p[i * 9 + 5] + p[i * 9 + 8]) / 3);
    let u = parTuile.get(k); if (!u) parTuile.set(k, (u = new Tampon()));
    u.pos.push(...p.slice(i * 9, i * 9 + 9)); u.nor.push(...t.nor.slice(i * 9, i * 9 + 9)); u.uv.push(...t.uv.slice(i * 6, i * 6 + 6));
    if (couleur) u.col.push(...t.col.slice(i * 9, i * 9 + 9));
  }
  return [...parTuile.values()];
}

/** Une ligne decalee de `d` metres sur sa gauche (negatif : sa droite), joints en onglet bornes. */
function decaler(l: P2[], d: number): P2[] {
  return l.map((p, i) => {
    const a = l[Math.max(0, i - 1)], b = l[Math.min(l.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), nz = b[0] - a[0];
    const n = Math.hypot(nx, nz) || 1; nx /= n; nz /= n;
    return [p[0] + nx * d, p[1] + nz * d] as P2;
  });
}

/** Un polygone plat a la hauteur y. */
function aplat(t: Tampon, p: P2[], y: number, echelleUV = 0, couleur?: THREE.Color) {
  if (p.length < 3) return;
  const pts = p.map(([x, z]) => new THREE.Vector2(x, z));
  const faces = THREE.ShapeUtils.triangulateShape(pts, []);
  for (const [a, b, c] of faces) {
    const A = pts[a], B = pts[b], C = pts[c];
    // la face doit regarder vers le haut, quel que soit le sens du contour
    const croise = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
    const [P, Q] = croise > 0 ? [C, B] : [B, C];
    t.tri([A.x, y, A.y], [P.x, y, P.y], [Q.x, y, Q.y], HAUT,
      [A.x * echelleUV, A.y * echelleUV], [P.x * echelleUV, P.y * echelleUV], [Q.x * echelleUV, Q.y * echelleUV], couleur);
  }
}

/** Un ruban le long d'une ligne, de largeur w, joints arrondis. */
function ruban(t: Tampon, l: P2[], w: number, y: number, uvLong = 0) {
  const r = w / 2;
  let s = 0;
  for (let i = 0; i < l.length - 1; i++) {
    const [ax, az] = l[i], [bx, bz] = l[i + 1];
    const d = Math.hypot(bx - ax, bz - az); if (d < 0.01) continue;
    const nx = -(bz - az) / d * r, nz = (bx - ax) / d * r;
    const u0 = s * uvLong, u1 = (s + d) * uvLong; s += d;
    const p1 = [ax + nx, y, az + nz], p2 = [ax - nx, y, az - nz], p3 = [bx - nx, y, bz - nz], p4 = [bx + nx, y, bz + nz];
    t.tri(p1, p3, p2, HAUT, [u0, 1], [u1, 0], [u0, 0]);
    t.tri(p1, p4, p3, HAUT, [u0, 1], [u1, 1], [u1, 0]);
  }
  // les joints : un petit disque a chaque sommet
  for (const [x, z] of l) for (let k = 0; k < 8; k++) {
    const a0 = k / 8 * Math.PI * 2, a1 = (k + 1) / 8 * Math.PI * 2;
    t.tri([x, y, z], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], HAUT);
  }
}

const aire = (p: P2[]) => { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length]; a += x1 * z2 - x2 * z1; } return a / 2; };

/**
 * La hauteur d'un batiment. OSM la donne rarement ici : on l'estime d'apres
 * l'emprise — les grands volumes de la dalle (ville nouvelle des annees 1970)
 * montent de 3 a 5 etages, les pavillons d'un, les garages a peine.
 */
function hauteurDe(b: Donnees['batiments'][number], i: number): number {
  if (b.t !== 'yes' || b.h !== 6) return b.h;
  const s = Math.abs(aire(b.p)), v = ((i * 2654435761) >>> 0) % 100 / 100;
  if (s < 40) return 3;
  if (s < 140) return 5.5 + v * 1.5;
  if (s < 450) return 7 + v * 5;
  if (s < 1500) return 10 + v * 6;
  return 8 + v * 8;
}

// Les facades de la ville nouvelle : enduits clairs et couleurs franches.
const ENDUITS = ['#F1E2C6', '#F2D3AE', '#E7C29C', '#F6EDDB', '#DCE5E9', '#EEC4AC', '#CFE0CF', '#F0DC9A', '#F5F3EE', '#E2CDB2', '#F0B79B', '#CADCEB'];

/* ------------------------------------------------------------- les gens */

/**
 * Un personnage : son corps a facettes peint dans une affiche. L'affiche fait
 * face a la camera ; le corps est tourne vers la ou il marche.
 */
// --- LES CORPS EN VRAI MAILLAGE (25/10) --------------------------------------
//
// « Remplace les personnages plats de la ville par les vrais modeles 3D animes »
// (l'auteur, apres Lagos Life). Le corps generique de la course en 3D
// (public/modeles/coureur-homme.glb, Quaternius CC0 passe par
// tools/blender/coureur_generique.py), clone par habitant, teint a son look par
// zones, pose a chaque image par `poser` (vedette-3d.ts) sur le squelette que le
// moteur releve (r.squelette3D) : la marche et la course sont celles des tubes,
// donc celles du jeu. Tant qu'il n'est pas charge, l'affiche peinte reste.
// DEUX CORPS (« surtout pas un seul corps d'homme, fais femme et homme », l'auteur) :
// tools/blender/corps_ville.py, Quaternius femme 1,68 m et homme 1,78 m, avec les zones
// des vetements de ville (garde-robe.ts) ; le look choisit le sien par `build`.
const gabarits: Record<'f' | 'm', THREE.Object3D | null> = { f: null, m: null };
let gabaritDemande = false;
function chargerLeCorps() {
  if (gabaritDemande) return;
  gabaritDemande = true;
  const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
  const base = (import.meta as any).env?.BASE_URL || '/';
  for (const k of ['f', 'm'] as const) {
    l.loadAsync(base + `modeles/corps-${k === 'f' ? 'femme' : 'homme'}.glb`).then(g => { gabarits[k] = g.scene; }).catch(() => { /* l'affiche reste */ });
  }
}
const gabaritDe = (look: any) => gabarits[look && look.build === 'f' ? 'f' : 'm'];
const SANS_CHEVEUX = new Set(['ras', 'shaved']);
function corps3D(look: any): { m: Modele; mats: Record<string, THREE.MeshStandardMaterial>; hauteur: number } | null {
  const gabarit = gabaritDe(look);
  if (!gabarit) return null;
  const copie = clonerSquelette(gabarit);
  const mats: Record<string, THREE.MeshStandardMaterial> = {};
  copie.traverse((o: any) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; o.castShadow = true;
    const liste = Array.isArray(o.material) ? o.material : [o.material];
    const neufs = liste.map((m: any) => {
      const zone = String(m.name || '').replace('Coureur_', '');
      return (mats[zone] = new THREE.MeshStandardMaterial({ roughness: zone === 'peau' ? 0.55 : 0.7, metalness: 0 }));
    });
    o.material = Array.isArray(o.material) ? neufs : neufs[0];
  });
  teindre(mats, look);
  const racine = new THREE.Group();
  racine.matrixAutoUpdate = false;
  racine.add(copie);
  copie.updateMatrixWorld(true);
  const os = new Map<string, THREE.Bone>();
  copie.traverse((o: any) => { if (o.isBone) os.set(o.name, o); });
  const prof = (b: THREE.Object3D) => { let n = 0; while (b.parent) { b = b.parent; n++; } return n; };
  const ordre = [...os.values()].sort((a, b) => prof(a) - prof(b));
  const repos = new Map<THREE.Bone, THREE.Quaternion>(), reposLocal = new Map<THREE.Bone, THREE.Quaternion>();
  const inv = new THREE.Matrix4().copy(copie.matrixWorld).invert();
  for (const b of ordre) {
    repos.set(b, new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().multiplyMatrices(inv, b.matrixWorld)));
    reposLocal.set(b, b.quaternion.clone());
  }
  const bassin = os.get('pelvis')!;
  const bassinParent = new THREE.Matrix4().multiplyMatrices(inv, bassin.parent!.matrixWorld);
  const boite = new THREE.Box3().setFromObject(copie);
  return { m: { racine, os, ordre, repos, reposLocal, bassinParent } as unknown as Modele, mats, hauteur: boite.max.y - boite.min.y };
}
function teindre(mats: Record<string, THREE.MeshStandardMaterial>, L: any) {
  if (!L) return;
  const rgb = (v: number[] | undefined, d: number[], k = 1) => { const a = v || d; return new THREE.Color().setRGB(a[0] / 255 * k, a[1] / 255 * k, a[2] / 255 * k, THREE.SRGBColorSpace); };
  mats.peau?.color.copy(rgb(L.skin, [180, 130, 100]));
  // la tenue du moment : chaque zone a la couleur du haut, du bas, ou de la peau (garde-robe.ts)
  if (L.tenue) {
    const z = couleursDe(L.tenue, L.skin || [180, 130, 100], L.jersey);
    for (const [k, v] of Object.entries(z)) mats[k]?.color.copy(rgb(v as number[], [128, 128, 128]));
  } else {
    for (const k of ['manches', 'avantbras', 'ventre', 'cuisses', 'mollets']) mats[k]?.color.copy(rgb(L.skin, [180, 130, 100]));
    mats.maillot?.color.copy(rgb(L.jersey, [200, 40, 50]));
    mats.short?.color.copy(rgb(L.shorts, [30, 30, 40]));
    mats.pointes?.color.copy(rgb(L.shoe, [240, 240, 240]));
  }
  mats.cheveux?.color.copy(SANS_CHEVEUX.has(L.hair) ? rgb(L.skin, [180, 130, 100], 0.8) : rgb(L.hairCol, [20, 16, 14]));
}
/** La glTF a y en haut comme la ville ; le moteur pose son coureur face a +x. */
const _T = new THREE.Matrix4(), _R = new THREE.Matrix4(), _S = new THREE.Matrix4(), _vDos = new THREE.Vector3();
/** La foulee de course en ville, en metres (le moteur avance sa phase d'un demi-tour par appui). */
const FOULEE = 2.1;

class Personne {
  sprite: THREE.Sprite;
  ombre: THREE.Mesh;
  private cv = document.createElement('canvas');
  private c: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  corps: any;
  pos = new THREE.Vector3();
  route: P2[] = [];
  dir = new THREE.Vector3(0, 0, 1);
  private marcheT = Math.random() * 6;
  marche = false;
  /** Il court (plus vite que la marche) : la phase de foulee avance avec la distance. */
  court = false;
  private dejaPeint = '';
  private m3: ReturnType<typeof corps3D> = null;
  private scene: THREE.Object3D;

  constructor(look: any, x: number, z: number, scene: THREE.Object3D, private px = 256) {
    this.cv.width = px; this.cv.height = px;
    this.c = this.cv.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, alphaTest: 0.08 }));
    this.sprite.center.set(0.5, 0.06);
    const h = ((look && look.h) || 1.75) * 1.25 * GRANDI;
    this.sprite.scale.set(h, h, 1);
    this.corps = { look, stride: 0, v: 0, maxSpeed: 12, fallAnim: 0, celebrate: 0, drivePitch: 0, marche: 0, marcheT: 0 };
    this.pos.set(x, 0, z);
    this.ombre = new THREE.Mesh(new THREE.CircleGeometry(0.45 * GRANDI, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    this.ombre.rotation.x = -Math.PI / 2;
    scene.add(this.sprite, this.ombre);
    this.scene = scene;
    chargerLeCorps();
    this.placer();
  }

  habiller(look: any) {
    const avant = this.corps.look && this.corps.look.build;
    this.corps.look = look; this.dejaPeint = '';
    if (!this.m3) return;
    // un autre corps (le miroir) : on refait le maillage a la prochaine image
    if ((look && look.build) !== avant) { this.scene.remove(this.m3.m.racine); this.m3 = null; this.sprite.visible = true; return; }
    teindre(this.m3.mats, look);
  }
  placer() {
    this.sprite.position.set(this.pos.x, SOL, this.pos.z); this.ombre.position.set(this.pos.x, SOL + 0.02, this.pos.z);
    if (!this.m3) return;
    // tourne vers ou il va : +x du corps sur la direction de marche
    // a sa taille choisie : le corps est construit a 1,68 m (femme) ou 1,78 m (homme)
    const k = GRANDI * (((this.corps.look && this.corps.look.h) || 0) / this.m3.hauteur || 1);
    this.m3.m.racine.matrix.multiplyMatrices(_T.makeTranslation(this.pos.x, SOL, this.pos.z), _R.makeRotationY(Math.atan2(-this.dir.z, this.dir.x)))
      .multiply(_S.makeScale(k, k, k));
    this.m3.m.racine.matrixWorldNeedsUpdate = true;
  }
  /** Le retirer de la ville (affiche, ombre, corps). */
  retirer() { this.scene.remove(this.sprite, this.ombre); if (this.m3) this.scene.remove(this.m3.m.racine); }

  /** Avancer le long de la route. Rend vrai a l'arrivee du dernier point. */
  avancer(dt: number, vitesse: number): boolean {
    if (!this.route.length) { this.marche = false; return false; }
    let pas = vitesse * dt;
    this.marche = true;
    this.marcheT += dt * 7.5 * Math.min(1.6, vitesse / 4.2);
    // en courant, la foulee du moteur : un demi-tour de phase par appui
    if (this.court) { this.corps.stride = (this.corps.stride || 0) + pas * Math.PI / FOULEE; this.corps.v = vitesse; }
    while (pas > 0 && this.route.length) {
      const [bx, bz] = this.route[0];
      const dx = bx - this.pos.x, dz = bz - this.pos.z, d = Math.hypot(dx, dz);
      if (d > 1e-3) this.dir.set(dx / d, 0, dz / d);
      if (d <= pas) { this.pos.set(bx, 0, bz); this.route.shift(); pas -= d; }
      else { this.pos.x += dx / d * pas; this.pos.z += dz / d * pas; pas = 0; }
    }
    this.placer();
    return !this.route.length;
  }

  /** Repeindre l'affiche si la pose ou l'angle de vue ont change. */
  peindre(camera: THREE.Camera) {
    if (!this.m3 && gabaritDe(this.corps.look)) {
      this.m3 = corps3D(this.corps.look);
      if (this.m3) {
        this.scene.add(this.m3.m.racine); this.sprite.visible = false; this.corps.squelette3D = true;
        // le corps porte sa vraie ombre : la tache de l'affiche ne garde qu'un contact discret au sol
        (this.ombre.material as THREE.MeshBasicMaterial).opacity = 0.14; this.ombre.scale.setScalar(0.6);
        this.placer();
      }
    }
    if (this.m3) {
      // la marche, ou la course (le moteur sprinte quand marche = 0 et v > 0), ou l'arret
      const A = SprinterApp as any, c = this.corps;
      c.marche = this.marche && !this.court ? 1 : 0;
      c.marcheT = this.marcheT;
      if (!this.marche || !this.court) c.v = 0;
      A.personCapsules(c, 0, 0, false, false, 0);
      if (c.squelette) poser(this.m3.m, c.squelette);
      return;
    }
    const a = this.pos.clone().project(camera), b = this.pos.clone().add(this.dir).project(camera);
    // LE CAP DU MOTEUR N'EST PAS UN ANGLE D'ECRAN (« le joueur marche a l'envers », l'auteur) :
    // personCapsules tourne le corps au sol puis le projette en isometrie, x du sol vers le haut
    // a gauche (-ISO_COS, -ISO_SIN), y vers le haut a droite (ISO_COS, -ISO_SIN). On inverse
    // cette projection pour que le corps regarde la ou il va a l'ecran.
    const C = (SprinterApp as any).C, p = (b.x - a.x) / C.ISO_COS, q = (b.y - a.y) / C.ISO_SIN;
    const cap = Math.atan2(p + q, q - p);
    this.corps.marche = this.marche ? 1 : 0;
    this.corps.marcheT = this.marcheT;
    const cle = `${cap.toFixed(2)}|${this.marche ? this.marcheT.toFixed(2) : 'arret'}|${this.corps.look && this.corps.look.skin}`;
    if (cle === this.dejaPeint) return;
    this.dejaPeint = cle;
    const c = this.c, px = this.px, A = SprinterApp as any;
    c.clearRect(0, 0, px, px);
    const k = px * 0.56;
    A.drawFacetFigure(c, A.personCapsules(this.corps, cap, 0, false, false, A.niveauDetail(k)), px / 2, px * 0.94, k);
    this.tex.needsUpdate = true;
  }
}

function voiture(couleur: string) {
  const g = new THREE.Group();
  const caisse = mat(couleur, { roughness: 0.35, metalness: 0.3 });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 3.9), caisse); b1.position.y = 0.65;
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 2), mat('#2B3A4A', { roughness: 0.1, metalness: 0.4 })); b2.position.set(0, 1.25, -0.2);
  g.add(b1, b2);
  const roue = new THREE.CylinderGeometry(0.33, 0.33, 0.25, 12); roue.rotateZ(Math.PI / 2);
  const mr = mat('#1A1A1A');
  for (const [x, z] of [[-0.8, -1.2], [0.8, -1.2], [-0.8, 1.2], [0.8, 1.2]]) { const r = new THREE.Mesh(roue, mr); r.position.set(x, 0.33, z); g.add(r); }
  g.traverse(o => { (o as THREE.Mesh).castShadow = true; });
  return g;
}

function dansPoly(poly: P2[], x: number, z: number) {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) dedans = !dedans;
  }
  return dedans;
}

/* ------------------------------------------------------------ la scene */

/** Les gens a leur taille reelle (« les proportions joueurs / decors ne sont pas bonnes », l'auteur, 25/10 :
 *  ils etaient grandis de 1,55 et mesuraient pres de 3 m a cote des voitures). La camera s'approche a la place. */
const GRANDI = 1;
/** Le niveau des trottoirs et dalles, sur lequel on marche. */
const SOL = 0.12;
// « les deplacements sont trop lents, c'est plus rapide dans les Sims » (l'auteur, 25/10) : on presse le pas ;
// et « le personnage peut aussi courir pour aller plus vite » : la course double la vitesse
// (a taille reelle et camera rapprochee : la meme vitesse a l'ecran qu'avant, en metres d'un vrai pas)
const VITESSE = 4, VITESSE_COURSE = 8.5;
const COULEURS_AUTO = ['#C0392B', '#2E86C1', '#F4F6F7', '#1C2833', '#F1C40F', '#7D8C8E', '#27AE60', '#8E44AD', '#D35400'];
const VOITURES = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service', 'primary_link', 'secondary_link', 'tertiary_link']);

type Options = {
  look: any;
  /** Ou l'on se tient (metres), ou null : devant la maison. */
  depart: P2 | null;
  nom: (l: Lieu) => string;
  surLieu: (l: Lieu) => void;
  surPosition?: (p: P2) => void;
  /** La ville est prete (le fichier lu, la scene construite). */
  surPret?: () => void;
  /** Un adulte : son appartement a la place de la maison, ses parents chez eux. */
  adulte?: boolean;
  /** On a touche quelqu'un (gens.ts). */
  surPersonne?: (id: string) => void;
};

/** Une personne du jeu dans la ville : ou elle est, a quoi elle ressemble. */
export type Habitant = { id: string; nom: string; lieu: Lieu; look: any };

export class Ville {
  private rendu: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 800);
  // LA CAMERA DERRIERE LE JOUEUR (« Eyes » de Lagos Life, l'auteur, 25/10) : en perspective,
  // a hauteur d'epaule, elle suit la direction de marche en douceur. `vue` choisit la camera.
  private dos = new THREE.PerspectiveCamera(58, 1, 0.1, 700);
  private vue: 'dessus' | 'derriere' = 'dessus';
  private capDos = 0;
  /** Le joystick de l'ecran : direction (x a droite, y vers le haut de l'ecran), force 0..1. */
  private joy: { x: number; y: number } | null = null;
  private soleil = new THREE.DirectionalLight('#FFF1D6', 2.4);
  private ciel = new THREE.HemisphereLight('#E4F0FF', '#6E8A5A', 1.25);
  private lampe = mat('#FFF4D2', { emissive: '#FFE6A0', emissiveIntensity: 0.7 });
  private heureDuJour = 15 * 60;
  private murs: THREE.MeshStandardMaterial | null = null;
  private monde = new THREE.Group();
  private pietons!: Reseau;
  private chaussee!: Reseau;
  private portes = {} as Record<Lieu, P2>;
  private moi: Personne | null = null;
  private passants: Personne[] = [];
  /** Les gens du jeu (gens.ts) presents en ce moment, et leur etiquette. */
  private habitants = new Map<string, { p: Personne; lieu: Lieu; el: HTMLDivElement; flane: number }>();
  private roulent: { v: THREE.Group; route: P2[]; dir: THREE.Vector3 }[] = [];
  private enseignes: THREE.Object3D[] = [];
  private cible = new THREE.Vector3();
  private lieuVise: Lieu | null = null;
  private azimut = Math.PI / 4;
  private azimutVise = Math.PI / 4;
  private zoom = 1;
  private etiquettes: { l: Lieu; el: HTMLDivElement; p: THREE.Vector3 }[] = [];
  private marque: THREE.Mesh;
  private id = 0;
  private dernier = 0;
  private touches = new Set<string>();
  private pixels = 2;
  /** Courir par defaut (le bouton du tableau de bord), et les metres courus depuis la derniere lecture. */
  private enCourse = false; private metres = 0;
  private dernierAppui = 0;
  private arrete = false;
  private enPause = false;
  private lent = 0;
  private pointeurs = new Map<number, { x: number; y: number }>();
  private pince = 0;
  private bouge = false;
  private glisse0: { x: number; y: number } | null = null;

  constructor(private hote: HTMLElement, private o: Options) {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block';
    hote.appendChild(cv);
    this.rendu = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    this.rendu.outputColorSpace = THREE.SRGBColorSpace;
    this.rendu.toneMapping = THREE.ACESFilmicToneMapping;
    this.rendu.toneMappingExposure = 1.05;
    this.rendu.shadowMap.enabled = true;
    this.rendu.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color('#A9D3F0');
    this.scene.fog = new THREE.Fog('#BFDDF3', 260, 480);
    this.scene.add(this.ciel);
    this.soleil.castShadow = true;
    this.soleil.shadow.mapSize.set(2048, 2048);
    const sc = this.soleil.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 300;
    this.soleil.shadow.bias = -0.0004; this.soleil.shadow.normalBias = 0.04;
    this.scene.add(this.soleil, this.soleil.target, this.monde);

    this.marque = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 32),
      new THREE.MeshBasicMaterial({ color: '#3DDC84', transparent: true, opacity: 0.9, depthWrite: false }));
    this.marque.rotation.x = -Math.PI / 2; this.marque.visible = false;
    this.scene.add(this.marque);

    const credit = document.createElement('div');
    credit.textContent = '© contributeurs OpenStreetMap';
    credit.style.cssText = 'position:absolute;right:6px;bottom:4px;font:10px system-ui;color:rgba(0,0,0,.55);pointer-events:none;z-index:2';
    hote.appendChild(credit);

    this.redimensionner();
    cv.addEventListener('pointerdown', this.appui);
    cv.addEventListener('pointermove', this.glisse);
    cv.addEventListener('pointerup', this.lache);
    cv.addEventListener('pointercancel', this.lache);
    cv.addEventListener('wheel', this.molette, { passive: false });
    window.addEventListener('keydown', this.clavier);
    window.addEventListener('keyup', this.relache);
    window.addEventListener('resize', this.redimensionner);

    chargerVille().then((d: Donnees) => {
      if (this.arrete) return;
      this.construire(d);
      this.o.surPret?.();
      this.id = requestAnimationFrame(this.boucle);
    });
  }

  detruire() {
    this.arrete = true;
    cancelAnimationFrame(this.id);
    window.removeEventListener('keydown', this.clavier);
    window.removeEventListener('keyup', this.relache);
    window.removeEventListener('resize', this.redimensionner);
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mm = m.material as THREE.Material | THREE.Material[] | undefined;
      for (const x of Array.isArray(mm) ? mm : mm ? [mm] : []) { const t = (x as THREE.MeshStandardMaterial).map; if (t) t.dispose(); x.dispose(); }
    });
    this.rendu.dispose();
    this.hote.innerHTML = '';
  }

  habiller(look: any) { this.moi?.habiller(look); }
  pause(oui: boolean) { this.enPause = oui; if (oui && this.moi) { this.moi.route = []; this.touches.clear(); } }
  tourner(sens: 1 | -1) { this.azimutVise += sens * Math.PI / 2; }
  /** La camera active : la vue de dessus, ou derriere le joueur. */
  private get cam(): THREE.Camera { return this.vue === 'derriere' ? this.dos : this.camera; }
  /** Basculer entre la vue de dessus et la vue derriere le joueur. */
  changerDeVue(v: 'dessus' | 'derriere') {
    this.vue = v;
    if (v === 'derriere' && this.moi) this.capDos = Math.atan2(this.moi.dir.z, this.moi.dir.x);
  }
  /** Le joystick : x a droite, y vers le haut de l'ecran, dans [-1, 1] ; pousse a fond, on court. */
  joystick(x: number, y: number) {
    const f = Math.hypot(x, y);
    if (f < 0.15) { this.joy = null; if (this.moi && !this.touches.size) { this.moi.route = []; this.moi.court = this.enCourse; } return; }
    this.joy = { x, y };
    this.lieuVise = null; this.marque.visible = false;
    if (this.moi) this.moi.court = this.enCourse || f > 0.85;
  }
  zoomer(f: number) { this.zoom = Math.min(2.4, Math.max(0.35, this.zoom * f)); this.redimensionner(); }

  /**
   * L'heure qu'il est (minutes depuis minuit) : le soleil se leve et se
   * couche, le ciel passe du bleu au rose puis a la nuit, les lampadaires
   * s'allument.
   */
  heure(h: number) {
    if (Math.abs(h - this.heureDuJour) < 1) return;
    this.heureDuJour = h;
    const t = h / 60;
    // jour : 1 de 8 h a 18 h, 0 la nuit, en pente a l'aube et au crepuscule
    const jour = Math.max(0, Math.min(1, Math.min((t - 6) / 2, (21 - t) / 2.5)));
    const dore = Math.max(0, 1 - Math.abs(t - 19.5) / 1.6) + Math.max(0, 1 - Math.abs(t - 7) / 1.2) * 0.7;
    const c = (a: string, b: string, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), k);
    const fond = c('#0E1A33', '#A9D3F0', jour).lerp(new THREE.Color('#F2A97E'), dore * 0.45);
    (this.scene.background as THREE.Color).copy(fond);
    (this.scene.fog as THREE.Fog).color.copy(fond);
    this.soleil.color.copy(c('#9DB4E8', '#FFF1D6', jour).lerp(new THREE.Color('#FFB27A'), dore * 0.6));
    this.soleil.intensity = 0.35 + 2.1 * jour;
    this.ciel.intensity = 0.45 + 0.8 * jour;
    this.ciel.color.copy(c('#4A5F99', '#E4F0FF', jour));
    this.lampe.emissiveIntensity = jour < 0.4 ? 2.4 : 0.15;
    // les fenetres s'allument au crepuscule
    if (this.murs) this.murs.emissiveIntensity = Math.max(0, 1 - jour * 1.6) * 0.9;
    this.rendu.toneMappingExposure = 0.9 + 0.15 * jour;
  }

  /**
   * Qui est ou, maintenant (gens.ts, ouEst). Les absents s'effacent ; un
   * nouveau venu apparait pres de la porte de son lieu ; celui qui change de
   * lieu y est deja (on ne le suit pas a travers la ville).
   */
  gens(liste: Habitant[]) {
    if (!this.moi) return;
    const vus = new Set(liste.map(h => h.id));
    for (const [id, h] of this.habitants) {
      if (vus.has(id)) continue;
      h.p.retirer(); h.el.remove(); this.habitants.delete(id);
    }
    liste.forEach((h, i) => {
      // shortcut: une ville batie pour un mineur n'a pas de porte « parents » ; si l'athlete
      // passe adulte en cours de visite, ses parents n'apparaissent qu'a la reouverture
      if (!this.portes[h.lieu]) return;
      const [x, z] = this.portes[h.lieu];
      const ici = this.habitants.get(h.id);
      if (ici && ici.lieu === h.lieu) return;
      // autour de la porte, chacun a sa place : on ne s'empile pas
      const a = (i * 2.4) % (Math.PI * 2), r = 2.6 + (i % 3) * 0.9;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (ici) { ici.p.pos.set(px, 0, pz); ici.p.route = []; ici.p.placer(); ici.lieu = h.lieu; return; }
      const p = new Personne(h.look, px, pz, this.scene, 200);
      const el = document.createElement('div');
      el.textContent = h.nom;
      el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:auto;cursor:pointer;white-space:nowrap;z-index:1;'
        + 'padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.92);color:#0F2A1E;font:800 10px system-ui,sans-serif;'
        + 'box-shadow:0 2px 6px rgba(0,0,0,.25)';
      el.addEventListener('click', ev => { ev.stopPropagation(); if (!this.enPause) this.o.surPersonne?.(h.id); });
      this.hote.appendChild(el);
      this.habitants.set(h.id, { p, lieu: h.lieu, el, flane: Math.random() * 4 });
    });
  }

  /** Marcher jusqu'a un lieu (le chemin par les rues). */
  allerA(l: Lieu) {
    if (!this.moi) return;
    const r = this.pietons.chemin(this.pietons.proche(this.moi.pos.x, this.moi.pos.z), this.pietons.proche(...this.portes[l]));
    this.moi.route = [...r, this.portes[l]];
    this.lieuVise = l;
    this.montrerMarque(this.portes[l]);
  }

  /** Y etre tout de suite : le bus, le velo — la camera traverse la ville. */
  filerA(l: Lieu) {
    if (!this.moi) return;
    const [x, z] = this.portes[l];
    this.moi.route = []; this.moi.pos.set(x, 0, z); this.moi.placer();
    this.marque.visible = false; this.lieuVise = null;
    this.o.surPosition?.([x, z]);
    setTimeout(() => { if (!this.arrete) this.o.surLieu(l); }, 900);
  }

  /** Ou se tient le joueur (metres), ou null avant que la ville soit prete. */
  position(): P2 | null { return this.moi ? [this.moi.pos.x, this.moi.pos.z] : null; }

  /** La porte d'un lieu (metres), ou null s'il n'existe pas ici. */
  /** Le joueur est-il en chemin ? (l'horloge ralentit pendant les trajets) */
  enMarche() { return !!this.moi && this.moi.route.length > 0; }
  /** LA SONDE DE FLUIDITE (?mesure=1) : les temps d'image en millisecondes, tant qu'elle ecoute. */
  private sonde: number[] | null = null;
  ecouter(oui: boolean) { this.sonde = oui ? [] : null; }
  temps() { return this.sonde ? this.sonde.slice() : []; }
  /** Ce que l'appareil dit de lui : puce graphique, resolution, ombres, corps 3D charges. */
  appareil() {
    const gl = this.rendu.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      gpu: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'inconnu',
      pixels: `${this.rendu.domElement.width}×${this.rendu.domElement.height}`,
      dpr: this.rendu.getPixelRatio(), ombres: this.rendu.shadowMap.enabled,
      corps3d: [this.moi, ...this.passants].filter(p => p && (p as any).m3).length,
    };
  }
  /** Le bouton « Courir » : tous les trajets a pied se font en courant. */
  courir(oui: boolean) { this.enCourse = oui; if (this.moi) this.moi.court = oui; }
  /** Les metres courus depuis la derniere lecture (ils coutent de l'energie, CarriereAthlete). */
  metresCourus() { const m = this.metres; this.metres = 0; return m; }
  porte(l: Lieu): P2 | null { return this.portes[l] || null; }

  /** La distance a pied jusqu'a un lieu, a vol d'oiseau, en metres. */
  distance(l: Lieu): number {
    if (!this.moi || !this.portes[l]) return 0;
    return Math.hypot(this.portes[l][0] - this.moi.pos.x, this.portes[l][1] - this.moi.pos.z);
  }

  /* --------------------------------------------------------- la construction */

  private construire(d: Donnees) {
    const [lat0, lon0] = d.origine;
    const KX = Math.cos(lat0 * Math.PI / 180) * 111320, KZ = 110540;
    const xz = (ll: P2): P2 => [(ll[1] - lon0) * KX, -(ll[0] - lat0) * KZ];
    const g = this.monde;

    // la terre, les champs et les pelouses
    const fond = new THREE.Mesh(new THREE.PlaneGeometry(4000, 3000), mat('#86B46E'));
    fond.rotation.x = -Math.PI / 2; fond.position.y = -0.05; fond.receiveShadow = true; g.add(fond);
    const COUL: Record<string, string> = { herbe: '#7CB866', bois: '#4F8A45', terrain: '#5FA65A', jeux: '#D9C49B', champ: '#C9C27A', ecole: '#B9C9A4', dalle: '#CFC9BD' };
    const verts: Record<string, Tampon> = {};
    for (const v of d.vert) aplat(verts[v.k] ||= new Tampon(), v.p, 0);
    for (const [k, t] of Object.entries(verts)) this.poser(t, mat(COUL[k] || '#7CB866'), false, true, k === 'terrain' || k === 'jeux' ? 0.025 : 0.01);
    const parking = new Tampon(); for (const p of d.parkings) aplat(parking, p, 0);
    this.poser(parking, mat('#8A8F96'), false, true, 0.04);
    const eau = new Tampon(); for (const p of d.eau) aplat(eau, p, 0);
    this.poser(eau, mat('#5C9FCC', { roughness: 0.15, metalness: 0.2 }), false, true, 0.05);

    // les rues : un trottoir clair, puis la chaussee ; les allees pietonnes en dalles
    const trottoir = new Tampon(), chaussee = new Tampon(), allee = new Tampon(), ligne = new Tampon();
    for (const r of d.routes) {
      if (VOITURES.has(r.t)) {
        ruban(trottoir, r.l, r.w + 3.2, 0);
        ruban(chaussee, r.l, r.w, 0);
        if (r.t === 'primary' || r.t === 'secondary' || r.t === 'tertiary') ruban(ligne, r.l, 0.15, 0, 0.25);
      } else ruban(allee, r.l, r.w, 0, 0.25);
    }
    const tirets = toile(32, 8, c => { c.clearRect(0, 0, 32, 8); c.fillStyle = '#F2F2EE'; c.fillRect(0, 0, 18, 8); });
    const dalles = toile(64, 64, c => {
      c.fillStyle = '#D8CDB8'; c.fillRect(0, 0, 64, 64);
      c.strokeStyle = 'rgba(120,100,80,0.35)'; c.lineWidth = 1.5; c.strokeRect(0, 0, 32, 32); c.strokeRect(32, 32, 32, 32);
    });
    this.poser(trottoir, mat('#CFCBC3'), false, true, 0.07);
    this.poser(allee, mat('#ffffff', { map: dalles }), false, true, 0.09);
    this.poser(chaussee, mat('#555A62', { roughness: 0.95 }), false, true, 0.1);
    this.poser(ligne, mat('#ffffff', { map: tirets, transparent: true, alphaTest: 0.5 }), false, true, 0.11);

    // la voie ferree : ballast et rails
    const ballast = new Tampon(), rail = new Tampon();
    for (const r of d.rails) {
      if (r.t === 'platform') { ruban(ballast, r.l, 3, 0); continue; }
      ruban(ballast, r.l, 3.2, 0);
      for (const o of [-0.72, 0.72]) {
        const dec = r.l.map((p, i) => {
          const q = r.l[Math.min(i + 1, r.l.length - 1)], s = r.l[Math.max(i - 1, 0)];
          const dx = q[0] - s[0], dz = q[1] - s[1], n = Math.hypot(dx, dz) || 1;
          return [p[0] - dz / n * o, p[1] + dx / n * o] as P2;
        });
        ruban(rail, dec, 0.12, 0);
      }
    }
    this.poser(ballast, mat('#8C8378'), false, true, 0.06);
    this.poser(rail, mat('#B5B8BD', { metalness: 0.7, roughness: 0.35 }), false, true, 0.2);

    // les pistes : le tartan et son liseré
    for (const p of d.pistes) {
      if (!p.ferme || p.p.length < 4) continue;
      const tartan = new Tampon(); aplat(tartan, p.p, 0);
      this.poser(tartan, mat('#C8553D', { roughness: 0.8 }), false, true, 0.13);
      const bord = new Tampon(); ruban(bord, [...p.p, p.p[0]], 0.12, 0);
      this.poser(bord, mat('#F5F5F0'), false, true, 0.14);
    }

    // les batiments : murs a fenetres teintes, toits plats ou de tuiles
    const murs = new Tampon(), mursPetits = new Tampon(), toits = new Tampon(), tuiles = new Tampon(), acroteres = new Tampon();
    const couleur = new THREE.Color(), gris = new THREE.Color();
    d.batiments.forEach((b, i) => {
      const p = b.p; if (p.length < 3) return;
      const h = hauteurDe(b, i);
      const maison = b.t === 'house' || b.t === 'detached' || b.t === 'semidetached_house' || b.t === 'terrace';
      couleur.set(maison ? ['#F1E7D3', '#EADCC4', '#E4D2B8'][i % 3] : ENDUITS[(i * 7) % ENDUITS.length]);
      const t = h < 4 ? mursPetits : murs;
      // la normale vers l'exterieur : le sens du contour decide de quel cote
      const sens = aire(p) > 0 ? 1 : -1;
      let s = 0;
      for (let k = 0; k < p.length; k++) {
        const [ax, az] = p[k], [bx, bz] = p[(k + 1) % p.length];
        const lg = Math.hypot(bx - ax, bz - az); if (lg < 0.05) continue;
        const n = [-(bz - az) / lg * sens, 0, (bx - ax) / lg * sens];
        const u0 = s / 4, u1 = (s + lg) / 4, v1 = h / 3; s += lg;
        const A = [ax, 0, az], B = [bx, 0, bz], Bh = [bx, h, bz], Ah = [ax, h, az];
        if (sens > 0) { t.tri(A, Bh, B, n, [u0, 0], [u1, v1], [u1, 0], couleur); t.tri(A, Ah, Bh, n, [u0, 0], [u0, v1], [u1, v1], couleur); }
        else { t.tri(A, B, Bh, n, [u0, 0], [u1, 0], [u1, v1], couleur); t.tri(A, Bh, Ah, n, [u0, 0], [u1, v1], [u0, v1], couleur); }
      }
      gris.set(maison ? '#B6553A' : ['#8D9096', '#7E8188', '#9A9CA2'][i % 3]);
      aplat(maison ? tuiles : toits, p, h, 0, gris);
      // l'acrotere : un liseré net qui dessine le haut des murs
      if (!maison && h >= 4) ruban(acroteres, [...p, p[0]], 0.45, h + 0.03);
    });
    const nuit = traveeNuit(); nuit.repeat.set(0.25, 0.25);
    this.murs = mat('#ffffff', { map: travee(false), vertexColors: true, emissiveMap: nuit, emissive: '#FFFFFF', emissiveIntensity: 0 });
    this.poser(murs, this.murs, true, true);
    this.poser(mursPetits, mat('#ffffff', { map: travee(true), vertexColors: true }), true, true);
    this.poser(toits, mat('#ffffff', { vertexColors: true, roughness: 0.95 }), true, true);
    this.poser(tuiles, mat('#ffffff', { vertexColors: true, roughness: 0.8 }), true, true);
    this.poser(acroteres, mat('#5F636B', { roughness: 0.9 }), false, false);

    // les arbres : ceux de la carte, et les bois semes
    const arbres: P2[] = [...d.arbres];
    for (const v of d.vert) {
      if (v.k !== 'bois' && !(v.k === 'herbe' && Math.abs(aire(v.p)) > 2500)) continue;
      const xs = v.p.map(q => q[0]), zs = v.p.map(q => q[1]);
      const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
      const n = Math.min(160, Math.floor(Math.abs(aire(v.p)) / (v.k === 'bois' ? 60 : 400)));
      for (let k = 0, essais = 0; k < n && essais < n * 4; essais++) {
        const x = x0 + Math.random() * (x1 - x0), z = z0 + Math.random() * (z1 - z0);
        if (dansPoly(v.p, x, z)) { arbres.push([x, z]); k++; }
      }
    }
    this.instancier(new THREE.CylinderGeometry(0.16, 0.24, 2.6, 7), mat('#6B4A30'), arbres, 1.3, 0.35);
    this.instancier(new THREE.IcosahedronGeometry(1.9, 1), mat('#3F8A47', { flatShading: true }), arbres, 3.8, 0.35);
    this.instancier(new THREE.IcosahedronGeometry(1.2, 1), mat('#5AA55E', { flatShading: true }), arbres.map(([x, z]) => [x + 0.6, z + 0.5] as P2), 4.9, 0.35);

    // les lampadaires le long des rues, des voitures garees le long des rues de quartier
    const lampes: P2[] = [], garees: { x: number; z: number; a: number }[] = [];
    for (const r of d.routes) {
      if (!VOITURES.has(r.t)) continue;
      let acc = 0;
      for (let i = 0; i < r.l.length - 1; i++) {
        const [ax, az] = r.l[i], [bx, bz] = r.l[i + 1], lg = Math.hypot(bx - ax, bz - az);
        if (lg < 0.1) continue;
        const nx = -(bz - az) / lg, nz = (bx - ax) / lg;
        for (let s = 30 - acc; s < lg; s += 30) {
          const x = ax + (bx - ax) * s / lg, z = az + (bz - az) * s / lg;
          if (r.t !== 'service') lampes.push([x + nx * (r.w / 2 + 1.2), z + nz * (r.w / 2 + 1.2)]);
          if ((r.t === 'residential' || r.t === 'service') && ((Math.floor(x) * 31 + Math.floor(z) * 17) & 3) === 0)
            garees.push({ x: x - nx * (r.w / 2 - 1.1), z: z - nz * (r.w / 2 - 1.1), a: Math.atan2(bx - ax, bz - az) });
        }
        acc = (acc + lg) % 30;
      }
    }
    this.instancier(new THREE.CylinderGeometry(0.07, 0.09, 5, 6), mat('#3A3F46', { metalness: 0.5 }), lampes, 2.5);
    this.instancier(new THREE.SphereGeometry(0.22, 10, 6), this.lampe, lampes, 5.1);
    garees.slice(0, 260).forEach((c, i) => { const v = voiture(COULEURS_AUTO[i % COULEURS_AUTO.length]); v.position.set(c.x, SOL - 0.02, c.z); v.rotation.y = c.a; g.add(v); });

    // les reseaux : a pied partout, en voiture sur les rues
    // LES PIETONS SUR LES TROTTOIRS (« le personnage est sur la route au lieu du trottoir », l'auteur,
    // 25/10) : le long d'une rue, deux traces au milieu de chaque trottoir (la bande de 1,6 m dessinee
    // plus haut), des passages pour traverser tous les ~50 m et aux bouts ; les allees gardent leur axe.
    const lignesPietons: P2[][] = [];
    for (const r of d.routes) {
      if (!VOITURES.has(r.t) || r.l.length < 2) { lignesPietons.push(r.l); continue; }
      const ecart = r.w / 2 + 0.8, g = decaler(r.l, ecart), dr = decaler(r.l, -ecart);
      lignesPietons.push(g, dr);
      let parcouru = 0;
      for (let i = 0; i < r.l.length; i++) {
        if (i > 0) parcouru += Math.hypot(r.l[i][0] - r.l[i - 1][0], r.l[i][1] - r.l[i - 1][1]);
        if (i === 0 || i === r.l.length - 1 || parcouru > 50) { lignesPietons.push([g[i], dr[i]]); parcouru = 0; }
      }
    }
    this.pietons = new Reseau(lignesPietons);
    this.pietons.relier(9);
    this.pietons.souder(40);
    this.chaussee = new Reseau(d.routes.filter(r => VOITURES.has(r.t) && r.t !== 'service').map(r => r.l));

    // les lieux du jeu : leur porte (le point du reseau le plus proche), une enseigne
    for (const l of Object.keys(LIEUX) as Lieu[]) {
      // la maison des parents n'est un lieu a part que pour un adulte
      if (l === 'parents' && !this.o.adulte) continue;
      const L = l === 'maison' && this.o.adulte ? { ll: APPARTEMENT } : LIEUX[l], [x, z] = L.xz || xz(L.ll!);
      const k = this.pietons.proche(x, z, 200);
      this.portes[l] = k >= 0 ? [this.pietons.xs[k], this.pietons.zs[k]] : [x, z];
      const el = document.createElement('div');
      el.textContent = this.o.nom(l);
      el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:auto;cursor:pointer;white-space:nowrap;z-index:1;'
        + 'padding:4px 10px;border-radius:999px;background:rgba(8,18,14,0.82);color:#fff;font:800 11px system-ui,sans-serif;'
        + 'letter-spacing:.05em;box-shadow:0 2px 8px rgba(0,0,0,.3);border:1px solid rgba(61,220,132,.55)';
      el.addEventListener('click', e => { e.stopPropagation(); if (!this.enPause) this.allerA(l); });
      this.hote.appendChild(el);
      this.etiquettes.push({ l, el, p: new THREE.Vector3(this.portes[l][0], 6, this.portes[l][1]) });
      // devant la porte, un cercle vert au sol : on sait ou entrer
      const seuil = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 40),
        new THREE.MeshBasicMaterial({ color: '#3DDC84', transparent: true, opacity: 0.85, depthWrite: false }));
      seuil.rotation.x = -Math.PI / 2; seuil.position.set(this.portes[l][0], SOL + 0.04, this.portes[l][1]);
      g.add(seuil);
      this.enseignes.push(seuil);
    }

    // le joueur, les passants, les voitures qui roulent
    const [dx, dz] = this.o.depart || this.portes.maison;
    this.moi = new Personne(this.o.look, dx, dz, this.scene, 320);
    this.cible.copy(this.moi.pos);
    const C = SprinterCore as any;
    for (let i = 0; i < 14; i++) {
      const base = C.lookFor('passant-' + i, 'divers');
      const look = C.look({ ...base, civil: true, manches: base.jersey, pantalon: [50, 52, 70] });
      look.tenue = tenueDeVilleDe('passant-' + i, look.build === 'f' ? 'f' : 'm');
      const k = this.pietons.auHasard([dx, dz], 120);
      if (k >= 0) this.passants.push(new Personne(look, this.pietons.xs[k], this.pietons.zs[k], this.scene, 160));
    }
    for (let i = 0; i < 10; i++) {
      const k = this.chaussee.auHasard([dx, dz], 300);
      if (k < 0) continue;
      const v = voiture(COULEURS_AUTO[(i * 3) % COULEURS_AUTO.length]);
      v.position.set(this.chaussee.xs[k], SOL - 0.02, this.chaussee.zs[k]);
      this.scene.add(v);
      this.roulent.push({ v, route: [], dir: new THREE.Vector3(0, 0, 1) });
    }
  }

  /** Fige un tampon en une piece de la scene. */
  private poser(t: Tampon, m: THREE.MeshStandardMaterial, ombre: boolean, recoit: boolean, y = 0) {
    if (!t.pos.length) return;
    for (const u of enTuiles(t)) {
      const mesh = new THREE.Mesh(u.geometrie(), m);
      mesh.position.y = y; mesh.castShadow = ombre; mesh.receiveShadow = recoit;
      this.monde.add(mesh);
    }
  }

  private instancier(geo: THREE.BufferGeometry, m: THREE.Material, pts: P2[], dy: number, varie = 0) {
    if (!pts.length) return;
    const q = new THREE.Quaternion();
    // un lot par tuile (voir TUILE) : la sphere englobante de chacun permet d'ecarter ceux hors champ
    const parTuile = new Map<string, number[]>();
    pts.forEach(([x, z], i) => { const k = cleTuile(x, z); (parTuile.get(k) || parTuile.set(k, []).get(k)!).push(i); });
    for (const idx of parTuile.values()) {
      const im = new THREE.InstancedMesh(geo, m, idx.length);
      idx.forEach((i, j) => {
        const [x, z] = pts[i], s = 1 + varie * ((((i * 37) % 10) / 10) - 0.5);
        im.setMatrixAt(j, new THREE.Matrix4().compose(new THREE.Vector3(x, SOL + dy * s, z), q, new THREE.Vector3(s, s, s)));
      });
      im.computeBoundingSphere();
      im.castShadow = true; im.receiveShadow = true;
      this.monde.add(im);
    }
  }

  private montrerMarque([x, z]: P2) { this.marque.position.set(x, SOL + 0.05, z); this.marque.visible = true; }

  /* --------------------------------------------------------- l'ecran */

  private redimensionner = () => {
    const l = this.hote.clientWidth || 1, h = this.hote.clientHeight || 1;
    // Deux pixels par point (net sans payer le triple des ecrans les plus denses), l'anticrenelage
    // toujours ; un appareil qui rame y redescend a 1,5 (voir la boucle)
    this.rendu.setPixelRatio(this.pixels);
    this.rendu.setSize(l, h, false);
    // la LARGEUR vue, en metres : un telephone en portrait voit une rue et ses deux trottoirs
    // a taille reelle, un athlete se lit sur une rue et demie de large en portrait
    const vue = (l < h ? 22 : 40) / this.zoom, asp = l / h;
    this.camera.left = -vue / 2; this.camera.right = vue / 2;
    this.camera.top = vue / asp / 2; this.camera.bottom = -vue / asp / 2;
    this.camera.updateProjectionMatrix();
    this.dos.aspect = asp; this.dos.updateProjectionMatrix();
  };

  private solSous(e: { clientX: number; clientY: number }): THREE.Vector3 | null {
    const r = this.rendu.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(v, this.cam);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -SOL), p) ? p : null;
  }

  private appui = (e: PointerEvent) => {
    this.pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.bouge = false; this.glisse0 = { x: e.clientX, y: e.clientY };
    if (this.pointeurs.size === 2) { const [a, b] = [...this.pointeurs.values()]; this.pince = Math.hypot(a.x - b.x, a.y - b.y); }
  };
  private glisse = (e: PointerEvent) => {
    const avant = this.pointeurs.get(e.pointerId);
    if (!avant) return;
    if (this.glisse0 && Math.hypot(e.clientX - this.glisse0.x, e.clientY - this.glisse0.y) > 8) this.bouge = true;
    this.pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointeurs.size === 2) {
      const [a, b] = [...this.pointeurs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pince) this.zoomer(d / this.pince);
      this.pince = d;
    }
  };
  private lache = (e: PointerEvent) => {
    const seul = this.pointeurs.size === 1;
    this.pointeurs.delete(e.pointerId); this.pince = 0;
    if (!seul || this.bouge || this.enPause || !this.moi) return;
    const p = this.solSous(e); if (!p) return;
    // DEUX APPUIS RAPPROCHES : on y va en courant (comme le double clic des Sims)
    const t = performance.now();
    this.moi.court = this.enCourse || t - this.dernierAppui < 350;
    this.dernierAppui = t;
    // une personne touchee : on lui parle
    for (const [id, h] of this.habitants) {
      if (Math.hypot(h.p.pos.x - p.x, h.p.pos.z - p.z) < 2.2) { this.o.surPersonne?.(id); return; }
    }
    // pres de la porte d'un lieu : c'est lui qu'on vise
    for (const l of Object.keys(this.portes) as Lieu[]) {
      if (Math.hypot(this.portes[l][0] - p.x, this.portes[l][1] - p.z) < 6) {
        if (Math.hypot(this.portes[l][0] - this.moi.pos.x, this.portes[l][1] - this.moi.pos.z) < 2) this.o.surLieu(l);
        else this.allerA(l);
        return;
      }
    }
    const k = this.pietons.proche(p.x, p.z, 25); if (k < 0) return;
    this.moi.route = this.pietons.chemin(this.pietons.proche(this.moi.pos.x, this.moi.pos.z), k);
    this.lieuVise = null;
    this.montrerMarque([this.pietons.xs[k], this.pietons.zs[k]]);
  };
  private molette = (e: WheelEvent) => { e.preventDefault(); this.zoomer(e.deltaY > 0 ? 0.9 : 1.1); };

  private clavier = (e: KeyboardEvent) => {
    if (this.enPause) return;
    if (e.key === 'q' || e.key === 'Q') { this.tourner(-1); return; }
    if (e.key === 'e' || e.key === 'E') { this.tourner(1); return; }
    if (e.key === 'Shift') { if (this.moi) this.moi.court = true; return; }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    if (this.moi) this.moi.court = e.shiftKey || this.enCourse;
    this.touches.add(e.key); this.lieuVise = null; this.marque.visible = false;
    if (this.moi) this.moi.route = [];
  };
  private relache = (e: KeyboardEvent) => { this.touches.delete(e.key); if (e.key === 'Shift' && this.moi) this.moi.court = this.enCourse; };

  /** Au clavier : marcher dans la direction DE L'ECRAN, en suivant le reseau. */
  private pasClavier() {
    const moi = this.moi; if (!moi) return;
    let sx = 0, sy = 0;
    if (this.touches.has('ArrowUp')) sy += 1;
    if (this.touches.has('ArrowDown')) sy -= 1;
    if (this.touches.has('ArrowLeft')) sx -= 1;
    if (this.touches.has('ArrowRight')) sx += 1;
    if (this.joy) { sx += this.joy.x; sy += this.joy.y; }
    if (!sx && !sy) return;
    const droite = new THREE.Vector3(1, 0, 0).applyQuaternion(this.cam.quaternion); droite.y = 0; droite.normalize();
    const haut = new THREE.Vector3(0, 1, 0).applyQuaternion(this.cam.quaternion); haut.y = 0; haut.normalize();
    const v = droite.multiplyScalar(sx).add(haut.multiplyScalar(sy)).normalize();
    const k = this.pietons.proche(moi.pos.x, moi.pos.z, 30); if (k < 0) return;
    // pas encore sur le reseau : on le rejoint ; sinon, le voisin le mieux aligne
    if (Math.hypot(this.pietons.xs[k] - moi.pos.x, this.pietons.zs[k] - moi.pos.z) > 0.5) { moi.route = [[this.pietons.xs[k], this.pietons.zs[k]]]; return; }
    let best = -1, bs = 0.35;
    for (const j of this.pietons.adj[k]) {
      const dx = this.pietons.xs[j] - moi.pos.x, dz = this.pietons.zs[j] - moi.pos.z, n = Math.hypot(dx, dz) || 1;
      const s = (dx * v.x + dz * v.z) / n;
      if (s > bs) { bs = s; best = j; }
    }
    if (best >= 0) moi.route = [[this.pietons.xs[best], this.pietons.zs[best]]];
  }

  private boucle = (t: number) => {
    if (this.arrete) return;
    if (this.sonde && this.dernier) this.sonde.push(t - this.dernier);
    const dt = Math.min(0.05, this.dernier ? (t - this.dernier) / 1000 : 0);
    this.dernier = t;
    const moi = this.moi!;

    if (!this.enPause && !moi.route.length && (this.touches.size || this.joy)) this.pasClavier();
    const avait = moi.route.length > 0;
    const x0 = moi.pos.x, z0 = moi.pos.z;
    const arrive = moi.avancer(dt, moi.court ? VITESSE_COURSE : VITESSE);
    if (moi.court) this.metres += Math.hypot(moi.pos.x - x0, moi.pos.z - z0);
    if (arrive && avait) {
      this.marque.visible = false;
      this.o.surPosition?.([moi.pos.x, moi.pos.z]);
      if (this.lieuVise) { const l = this.lieuVise; this.lieuVise = null; this.o.surLieu(l); }
    }
    for (const p of this.passants) {
      p.avancer(dt, 1.5);
      if (!p.route.length && Math.random() < 0.02) p.route = this.pietons.chemin(this.pietons.proche(p.pos.x, p.pos.z), this.pietons.auHasard([moi.pos.x, moi.pos.z], 90));
      // trop loin du joueur : il revient pres de lui, la ou on le verra
      if (Math.hypot(p.pos.x - moi.pos.x, p.pos.z - moi.pos.z) > 160) {
        const k = this.pietons.auHasard([moi.pos.x, moi.pos.z], 80);
        if (k >= 0) { p.pos.set(this.pietons.xs[k], 0, this.pietons.zs[k]); p.route = []; p.placer(); }
      }
    }
    for (const r of this.roulent) {
      if (!r.route.length) r.route = this.chaussee.chemin(this.chaussee.proche(r.v.position.x, r.v.position.z), this.chaussee.auHasard([moi.pos.x, moi.pos.z], 250));
      let pas = 8 * dt;
      while (pas > 0 && r.route.length) {
        const [bx, bz] = r.route[0], dx = bx - r.v.position.x, dz = bz - r.v.position.z, d = Math.hypot(dx, dz);
        if (d > 1e-3) r.dir.set(dx / d, 0, dz / d);
        if (d <= pas) { r.v.position.x = bx; r.v.position.z = bz; r.route.shift(); pas -= d; }
        else { r.v.position.x += dx / d * pas; r.v.position.z += dz / d * pas; pas = 0; }
      }
      r.v.rotation.y = Math.atan2(r.dir.x, r.dir.z);
    }
    // les gens du jeu flanent pres de leur lieu, et se tournent vers toi quand tu approches
    for (const [, h] of this.habitants) {
      h.p.avancer(dt, 1.2);
      h.flane -= dt;
      if (h.flane <= 0 && !h.p.route.length) {
        h.flane = 3 + Math.random() * 5;
        const [x, z] = this.portes[h.lieu];
        const k = this.pietons.proche(x + (Math.random() - 0.5) * 10, z + (Math.random() - 0.5) * 10, 12);
        if (k >= 0) h.p.route = this.pietons.chemin(this.pietons.proche(h.p.pos.x, h.p.pos.z), k).slice(0, 4);
      }
      if (!h.p.route.length && Math.hypot(moi.pos.x - h.p.pos.x, moi.pos.z - h.p.pos.z) < 8) h.p.dir.set(moi.pos.x - h.p.pos.x, 0, moi.pos.z - h.p.pos.z).normalize();
    }
    if (this.marque.visible) this.marque.rotation.z += dt * 1.5;

    // la camera suit, tourne en douceur ; le soleil suit pour garder l'ombre nette
    this.azimut += (this.azimutVise - this.azimut) * (1 - Math.exp(-8 * dt));
    this.cible.lerp(moi.pos, 1 - Math.exp(-4 * dt));
    const elev = 0.62, dist = 260;
    this.camera.position.set(this.cible.x + Math.cos(this.azimut) * Math.cos(elev) * dist, Math.sin(elev) * dist,
      this.cible.z + Math.sin(this.azimut) * Math.cos(elev) * dist);
    this.camera.lookAt(this.cible);
    if (this.vue === 'derriere') {
      // derriere le joueur : la camera rattrape sa direction (le plus court chemin d'angle)
      if (moi.marche) {
        const vise = Math.atan2(moi.dir.z, moi.dir.x);
        let d = vise - this.capDos; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.capDos += d * (1 - Math.exp(-3 * dt));
      }
      const recul = 4.4, haut = 2.3, cx = Math.cos(this.capDos), cz = Math.sin(this.capDos);
      const vx = moi.pos.x - cx * recul, vz = moi.pos.z - cz * recul;
      this.dos.position.lerp(_vDos.set(vx, SOL + haut, vz), 1 - Math.exp(-10 * dt));
      this.dos.lookAt(moi.pos.x + cx * 3, SOL + 1.25, moi.pos.z + cz * 3);
      this.cible.copy(moi.pos);
    }
    this.soleil.position.set(this.cible.x - 60, 110, this.cible.z + 40);
    this.soleil.target.position.copy(this.cible);
    // les seuils des lieux respirent doucement
    for (const e of this.enseignes) e.scale.setScalar(1 + 0.08 * Math.sin(t / 380));

    moi.peindre(this.cam);
    if (Math.floor(t / 66) !== Math.floor((t - dt * 1000) / 66)) {
      for (const p of this.passants) p.peindre(this.cam);
      for (const [, h] of this.habitants) h.p.peindre(this.cam);
    }

    this.rendu.render(this.scene, this.cam);
    this.lesEtiquettes();

    if (dt > 0.045) this.lent++; else this.lent = Math.max(0, this.lent - 1);
    if (this.lent > 90 && !this.rendu.shadowMap.enabled && this.pixels > 1.5) {
      // les ombres deja coupees et toujours lent : moins de pixels
      this.pixels = 1.5; this.lent = 0; this.redimensionner();
    }
    if (this.lent > 90 && this.rendu.shadowMap.enabled) {
      this.rendu.shadowMap.enabled = false;
      this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => (x.needsUpdate = true)); });
    }
    this.id = requestAnimationFrame(this.boucle);
  };

  private lesEtiquettes() {
    const l = this.hote.clientWidth, h = this.hote.clientHeight;
    for (const [, g] of this.habitants) {
      const q = g.p.pos.clone(); q.y = 2.5; q.project(this.cam);
      const x = (q.x + 1) / 2 * l, y = (1 - q.y) / 2 * h;
      const dehors = q.z > 1 || x < -60 || x > l + 60 || y < -20 || y > h + 40;
      g.el.style.display = dehors ? 'none' : '';
      if (!dehors) g.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%,-100%)`;
    }
    for (const { el, p } of this.etiquettes) {
      const q = p.clone().project(this.cam);
      const x = (q.x + 1) / 2 * l, y = (1 - q.y) / 2 * h;
      const dehors = q.z > 1 || x < -80 || x > l + 80 || y < -20 || y > h + 40;
      el.style.display = dehors ? 'none' : '';
      if (!dehors) el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%,-100%)`;
    }
  }
}
