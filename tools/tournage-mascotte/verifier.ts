// RIEN NE PASSE A TRAVERS LE CORPS NI LE SOL — mesure et corrections (tools/mascotte-verifier.mjs).
//
// Le corps est coupe en sept zones d'apres l'os qui pese le plus sur chaque sommet : tete, buste,
// bras gauche, bras droit, jambe gauche, jambe droite. Pour chaque geste, image par image (tous les
// PAS s), on pose la vraie peau (sommets deformes par le squelette) et on teste :
//   - l'avant-bras et la main de chaque cote (articulations + un sommet de peau sur trois) contre le
//     buste, la tete, les deux jambes et l'autre bras ;
//   - le mollet et le pied de chaque cote contre l'autre jambe et le buste ;
//   - la tete (sans le cou) contre le buste — un menton qui rentre dans la poitrine ;
//   - le sol : aucun sommet sous y = 0 (les pieds poses au repos, mascotte-3d.ts).
// Un point est DEDANS une zone quand un rayon tire de lui traverse la surface de ces zones un nombre
// impair de fois, dans deux directions (x et z) : une seule, et une couture ouverte faussait le compte.
// (Le simple « derriere le sommet le plus proche » ne tient pas sur une peau fine — bord du short,
// dossard : on ne s'en sert plus que pour la direction.)
// La correction (chercher) : pour chaque membre, la plus petite poussee de son bout — le long de la
// normale de la peau la plus proche, puis des six axes et huit diagonales, de 1 % a 16 % de la taille
// — qui sort TOUS ses points, le membre replie par l'IK du jeu ; dans le repere du bassin, comme la
// relit mascotte-3d.ts. Le sol : tout le corps releve. Puis adoucie dans le temps (lisser).
import * as THREE from 'three';
import { MASCOTTES, CHAINES, vueMascotte, poserCorrections, type Corrections, type Membre, type Personnage } from '../../src/game/mascotte-3d';

const PAS = 0.1;
type Zone = 'tete' | 'buste' | 'brasL' | 'brasR' | 'jambeL' | 'jambeR';
const ZONES: Zone[] = ['tete', 'buste', 'brasL', 'brasR', 'jambeL', 'jambeR'];
function zoneDe(nom: string): Zone {
  const c = nom.endsWith('_l') ? 'L' : nom.endsWith('_r') ? 'R' : '';
  if (/^(head|neck_02)/.test(nom)) return 'tete';
  if (c && /clavicle|upperarm|lowerarm|hand|index|middle|ring|pinky|thumb/.test(nom)) return ('bras' + c) as Zone;
  if (c && /thigh|calf|foot|ball/.test(nom)) return ('jambe' + c) as Zone;
  return 'buste';
}
// ce qu'on teste (les os et la peau du bout du membre) et contre quoi
type Testee = Membre | 'tete';
const POINTS: Record<Testee, RegExp> = {
  l: /^(lowerarm|hand|index|middle|ring|pinky|thumb).*_l$/, r: /^(lowerarm|hand|index|middle|ring|pinky|thumb).*_r$/,
  jl: /^(calf|foot|ball).*_l$/, jr: /^(calf|foot|ball).*_r$/, tete: /^head$/,
};
const CONTRE: Record<Testee, Zone[]> = {
  l: ['buste', 'tete', 'jambeL', 'jambeR', 'brasR'], r: ['buste', 'tete', 'jambeL', 'jambeR', 'brasL'],
  jl: ['jambeR', 'buste'], jr: ['jambeL', 'buste'], tete: ['buste'],
};
const TESTEES: Testee[] = ['l', 'r', 'jl', 'jr', 'tete'];

type Preparation = {
  mesh: THREE.SkinnedMesh; haut: number; n: number;
  tris: Record<Zone, Uint32Array>; zone: Uint8Array;
  os: Record<Testee, THREE.Object3D[]>; peau: Record<Testee, number[]>;
  dominant: Int32Array; normales: Float32Array;
};

function preparer(racine: THREE.Object3D, haut: number): Preparation | null {
  let mesh: THREE.SkinnedMesh | null = null;
  racine.traverse((o: any) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  if (!mesh) return null;
  const m = mesh as THREE.SkinnedMesh;
  const g = m.geometry, n = g.attributes.position.count;
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const squelette = m.skeleton.bones;
  const dominant = new Int32Array(n), zone = new Uint8Array(n);
  const peau = { l: [], r: [], jl: [], jr: [], tete: [] } as Record<Testee, number[]>;
  for (let i = 0; i < n; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    dominant[i] = best;
    const nom = squelette[best].name;
    zone[i] = ZONES.indexOf(zoneDe(nom));
    for (const t of TESTEES) if (POINTS[t].test(nom) && i % 3 === 0) peau[t].push(i);
  }
  const idx = g.index ? g.index.array : null;
  const nt = (idx ? idx.length : n) / 3;
  const parZone: Record<Zone, number[]> = { tete: [], buste: [], brasL: [], brasR: [], jambeL: [], jambeR: [] };
  for (let t = 0; t < nt; t++) {
    const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
    if (zone[a] !== zone[b] || zone[a] !== zone[c]) continue;   // (les coutures entre zones : laissees)
    parZone[ZONES[zone[a]]].push(a, b, c);
  }
  const tris = {} as Record<Zone, Uint32Array>;
  for (const z of ZONES) tris[z] = Uint32Array.from(parZone[z]);
  const os = { l: [], r: [], jl: [], jr: [], tete: [] } as Record<Testee, THREE.Object3D[]>;
  for (const b of squelette) for (const t of TESTEES) if (POINTS[t].test(b.name)) os[t].push(b);
  if (!g.attributes.normal) g.computeVertexNormals();
  return { mesh: m, haut, n, tris, zone, os, peau, dominant, normales: g.attributes.normal.array as Float32Array };
}

const _p = new THREE.Vector3(), _N = new THREE.Matrix3();
const _q = new THREE.Quaternion();

/** Une grille 2D des triangles, pour les rayons le long de l'axe `ax` (0 = x, 2 = z). */
function grille(W: Float32Array, tris: Uint32Array, ax: 0 | 2, cote: number) {
  const u = ax === 0 ? 1 : 0, v = ax === 0 ? 2 : 1;   // rayon x : plan (y, z) ; rayon z : plan (x, y)
  const cases = new Map<number, number[]>();
  const cle = (i: number, j: number) => i * 100003 + j;
  for (let t = 0; t < tris.length; t += 3) {
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let k = 0; k < 3; k++) {
      const s = tris[t + k] * 3;
      u0 = Math.min(u0, W[s + u]); u1 = Math.max(u1, W[s + u]);
      v0 = Math.min(v0, W[s + v]); v1 = Math.max(v1, W[s + v]);
    }
    for (let i = Math.floor(u0 / cote); i <= Math.floor(u1 / cote); i++)
      for (let j = Math.floor(v0 / cote); j <= Math.floor(v1 / cote); j++) {
        const c = cle(i, j); let l = cases.get(c); if (!l) cases.set(c, l = []); l.push(t);
      }
  }
  return { cases, cle, u, v, ax, cote, tris };
}
type Grille = ReturnType<typeof grille>;

/** Combien de fois le rayon tire de p le long de +ax traverse les triangles de la grille. */
function traversees(G: Grille, W: Float32Array, p: THREE.Vector3) {
  const P = [p.x, p.y, p.z];
  // (decale d'un rien : un rayon qui passe pile sur une arete compterait deux fois)
  const pu = P[G.u] + 1.37e-5, pv = P[G.v] + 2.91e-5, pa = P[G.ax];
  const l = G.cases.get(G.cle(Math.floor(pu / G.cote), Math.floor(pv / G.cote)));
  if (!l) return 0;
  let n = 0;
  const tris = G.tris;
  for (const t of l) {
    const a = tris[t] * 3, b = tris[t + 1] * 3, c = tris[t + 2] * 3;
    const ax = W[a + G.u], ay = W[a + G.v], bx = W[b + G.u], by = W[b + G.v], cx = W[c + G.u], cy = W[c + G.v];
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(d) < 1e-14) continue;
    const l1 = ((by - cy) * (pu - cx) + (cx - bx) * (pv - cy)) / d;
    const l2 = ((cy - ay) * (pu - cx) + (ax - cx) * (pv - cy)) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) continue;
    if (l1 * W[a + G.ax] + l2 * W[b + G.ax] + l3 * W[c + G.ax] > pa) n++;
  }
  return n;
}

/** Le corps pose a cette image : tous ses sommets dans le monde et, par zone, les grilles des rayons. */
function etatCorps(pr: Preparation) {
  const m = pr.mesh;
  m.updateMatrixWorld(true);
  const W = new Float32Array(pr.n * 3);
  let yMin = Infinity;
  for (let i = 0; i < pr.n; i++) {
    m.getVertexPosition(i, _p).applyMatrix4(m.matrixWorld);
    W[i * 3] = _p.x; W[i * 3 + 1] = _p.y; W[i * 3 + 2] = _p.z;
    if (_p.y < yMin) yMin = _p.y;
  }
  const cote = pr.haut / 40;
  const G = {} as Record<Zone, { x: Grille; z: Grille }>;
  for (const z of ZONES) G[z] = { x: grille(W, pr.tris[z], 0, cote), z: grille(W, pr.tris[z], 2, cote) };
  return { W, G, yMin };
}
type Etat = ReturnType<typeof etatCorps>;

/** Les points de `t` dans les zones qu'il ne doit pas toucher : combien, et le premier trouve. */
function dedans(pr: Preparation, E: Etat, t: Testee, toutCompter = true) {
  const m = pr.mesh, zones = CONTRE[t];
  let nb = 0, premier: THREE.Vector3 | null = null;
  const tester = (p: THREE.Vector3) => {
    let nx = 0, nz = 0;
    for (const z of zones) { nx += traversees(E.G[z].x, E.W, p); nz += traversees(E.G[z].z, E.W, p); }
    if (!(nx & 1) || !(nz & 1)) return false;
    nb++; if (!premier) premier = p.clone();
    return true;
  };
  for (const b of pr.os[t]) { if (tester(b.getWorldPosition(_p)) && !toutCompter) return { nb, premier }; }
  for (const i of pr.peau[t]) { if (tester(m.getVertexPosition(i, _p).applyMatrix4(m.matrixWorld)) && !toutCompter) return { nb, premier }; }
  return { nb, premier };
}

/** La normale de la peau la plus proche de p, parmi les zones de `t` (monde). */
function normaleProche(pr: Preparation, E: Etat, t: Testee, p: THREE.Vector3) {
  const m = pr.mesh, W = E.W, zs = CONTRE[t].map((z) => ZONES.indexOf(z));
  let best = Infinity, bi = -1;
  for (let i = 0; i < pr.n; i++) {
    if (!zs.includes(pr.zone[i])) continue;
    const dx = W[i * 3] - p.x, dy = W[i * 3 + 1] - p.y, dz = W[i * 3 + 2] - p.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < best) { best = d2; bi = i; }
  }
  if (bi < 0) return null;
  const j = pr.dominant[bi];
  const M = new THREE.Matrix4().multiplyMatrices(m.matrixWorld, m.bindMatrixInverse)
    .multiply(m.skeleton.bones[j].matrixWorld).multiply(m.skeleton.boneInverses[j]).multiply(m.bindMatrix);
  _N.getNormalMatrix(M);
  const nr = pr.normales;
  return new THREE.Vector3(nr[bi * 3], nr[bi * 3 + 1], nr[bi * 3 + 2]).applyMatrix3(_N).normalize();
}

// LES DIRECTIONS ESSAYEES : la normale de la peau d'abord, puis les six axes et les huit diagonales.
// Les pas, en part de la taille : du contact (1 %) au plus franc (16 %).
const DIRS = (() => {
  const d: THREE.Vector3[] = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
    const n = Math.abs(x) + Math.abs(y) + Math.abs(z);
    if (n === 1 || n === 3) d.push(new THREE.Vector3(x, y, z).normalize());
  }
  return d;
})();
const PAS_POUSSEE = [0.01, 0.02, 0.03, 0.045, 0.06, 0.08, 0.1, 0.13, 0.16];

/** Le point le plus bas des sommets d'un membre (pour qu'une jambe poussee ne passe pas sous le sol). */
function basDe(pr: Preparation, t: Testee) {
  let y = Infinity;
  for (const i of pr.peau[t]) y = Math.min(y, pr.mesh.getVertexPosition(i, _p).applyMatrix4(pr.mesh.matrixWorld).y);
  return y;
}

/**
 * La plus petite poussee du bout du membre `t` (monde) qui sort TOUS ses points des zones interdites,
 * le membre replie par l'IK du jeu (vue.plier). La pose est remise telle quelle apres chaque essai.
 */
function chercher(vue: ReturnType<typeof vueMascotte>, pr: Preparation, E: Etat, t: Membre, marge: number, sol: number) {
  const corps = vue.inspecter()!.corps;
  const os = CHAINES[t].map((n) => corps.getObjectByName(n)!);
  const garde = os.map((o) => o.quaternion.clone());
  const remettre = () => { os.forEach((o, i) => o.quaternion.copy(garde[i])); os[0].updateMatrixWorld(true); };
  const bout = os[2].getWorldPosition(new THREE.Vector3());
  const r0 = dedans(pr, E, t);
  if (!r0.nb) return null;
  const n = r0.premier ? normaleProche(pr, E, t, r0.premier) : null;
  const dirs = n ? [n, ...DIRS] : DIRS;
  const jambe = t === 'jl' || t === 'jr';
  for (const s of PAS_POUSSEE) {
    for (const d of dirs) {
      const v = d.clone().multiplyScalar((s + marge) * pr.haut);
      vue.plier(t, bout.clone().add(v));
      const ok = dedans(pr, E, t, false).nb === 0 && (!jambe || basDe(pr, t) >= sol);
      remettre();
      if (ok) return v;
    }
  }
  // rien ne suffit : la plus grande poussee le long de la normale (le rapport le dira)
  return (n || DIRS[0]).clone().multiplyScalar((PAS_POUSSEE[PAS_POUSSEE.length - 1] + marge) * pr.haut);
}

/**
 * Le plus petit relevement de la tete (cou tourne autour de l'axe des epaules, dans un sens ou dans
 * l'autre, de 3 a 40 degres) qui sort le menton du buste. Il reste pose ; rend l'angle (0 : rien trouve).
 */
function chercherTete(vue: ReturnType<typeof vueMascotte>, pr: Preparation) {
  const cou = vue.inspecter()!.corps.getObjectByName('neck_01');
  if (!cou) return 0;
  const garde = cou.quaternion.clone();
  const remettre = () => { cou.quaternion.copy(garde); cou.updateMatrixWorld(true); };
  for (const deg of [3, 6, 10, 15, 20, 26, 33, 40]) {
    for (const sens of [-1, 1]) {
      const a = sens * deg * Math.PI / 180;
      vue.leverTete(a);
      const ok = dedans(pr, etatCorps(pr), 'tete', false).nb === 0;
      remettre();
      if (ok) { vue.leverTete(a); return a; }
    }
  }
  return 0;
}

/**
 * Une passe sur tous les gestes, avec les corrections posees (poserCorrections). Rend le rapport
 * (par geste : images touchees et points dedans, par sorte — bras, jambes, tete, sol) et, si
 * `chercherAussi`, par geste, ce qu'il faut AJOUTER aux corrections.
 */
async function passe(opts: { corriger: boolean; marge: number; chercherAussi: boolean; seulement?: string[] }) {
  const toile = document.createElement('canvas');
  toile.style.cssText = 'width:64px;height:128px';
  document.body.appendChild(toile);
  const rapport: any[] = [];
  const ajout: Corrections = {};
  for (const p of Object.keys(MASCOTTES) as Personnage[]) {
    for (const g of MASCOTTES[p]) {
      const cle = `${p}/${g}`;
      if (opts.seulement && !opts.seulement.includes(cle)) continue;
      const vue = vueMascotte({ toile, pixels: 1, manuelle: true, corriger: opts.corriger });
      if (!(await vue.jouer(p, g, null))) { rapport.push({ cle, erreur: 'non charge' }); vue.liberer(); continue; }
      const duree = vue.duree();
      const haut = vue.inspecter()!.haut;
      const pr = preparer(vue.inspecter()!.corps, haut)!;
      const sol = -opts.marge * haut;
      const n = Math.floor(duree / PAS) + 1;
      const sorties = { l: [] as number[][], r: [] as number[][], jl: [] as number[][], jr: [] as number[][], y: [] as number[], tete: [] as number[] };
      const compte = { bras: 0, jambes: 0, tete: 0, sol: 0 };
      let images = 0, pireSol = 0, tPire = 0, pirePoints = 0;
      for (let k = 0; k < n; k++) {
        vue.avancer(k === 0 ? 0 : PAS);
        const ins = vue.inspecter()!;
        let E = etatCorps(pr);
        let touchee = false;
        // le sol : tout le corps releve de ce qui depasse en dessous
        const sous = Math.max(0, -E.yMin + sol);
        if (sous > 0) { touchee = true; compte.sol++; pireSol = Math.max(pireSol, sous / haut); }
        sorties.y.push(opts.chercherAussi && sous > 0 ? +(sous + opts.marge * haut).toFixed(5) : 0);
        // la tete d'abord (elle change la place du menton, que les bras evitent ensuite)
        let angle = 0;
        if (opts.chercherAussi && dedans(pr, E, 'tete', false).nb) {
          angle = chercherTete(vue, pr);
          if (angle) E = etatCorps(pr);
        }
        sorties.tete.push(+angle.toFixed(4));
        for (const t of TESTEES) {
          const nb = dedans(pr, E, t).nb;
          if (nb) {
            touchee = true;
            compte[t === 'tete' ? 'tete' : t.startsWith('j') ? 'jambes' : 'bras'] += nb;
            if (nb > pirePoints) { pirePoints = nb; tPire = +(k * PAS).toFixed(2); }
          }
          if (t === 'tete') continue;   // (la tete n'a pas d'IK : rapportee seulement)
          let v: THREE.Vector3 | null = null;
          if (nb && opts.chercherAussi) v = chercher(vue, pr, E, t, opts.marge, sol);
          if (v) { ins.bassin!.getWorldQuaternion(_q); v.applyQuaternion(_q.invert()); }
          sorties[t].push(v ? [+v.x.toFixed(5), +v.y.toFixed(5), +v.z.toFixed(5)] : [0, 0, 0]);
        }
        if (touchee) images++;
      }
      vue.liberer();
      rapport.push({ cle, images: `${images}/${n}`, ...compte, pireSol: +(pireSol * 100).toFixed(1), pirePoints, tPire });
      if (images && opts.chercherAussi) {
        const vide = (t: number[][]) => t.every((v) => !v[0] && !v[1] && !v[2]);
        const x: Corrections[string] = { pas: PAS };
        for (const m of ['l', 'r', 'jl', 'jr'] as const) if (!vide(sorties[m])) x[m] = sorties[m];
        if (sorties.y.some((v) => v)) x.y = sorties.y;
        if (sorties.tete.some((v) => v)) x.tete = sorties.tete;
        if (Object.keys(x).length > 1) ajout[cle] = x;
      }
    }
  }
  toile.remove();
  return { rapport, ajout };
}

/**
 * Adoucir dans le temps : un membre qui saute de 5 cm d'une image a l'autre se voit. Chaque decalage
 * s'annonce et s'eteint sur les images voisines (moitie de part et d'autre), puis une moyenne
 * glissante 1-2-1. Les creux que cela ouvre sont repris par la passe suivante.
 */
function lisser(corr: Corrections): Corrections {
  const out: Corrections = JSON.parse(JSON.stringify(corr));
  const adoucir = (a: number[][]) => {
    const mag = (v: number[]) => Math.hypot(...v);
    const b = a.map((v, i) => {
      if (mag(v) > 0) return v;
      const vois = [a[i - 1], a[i + 1]].filter((w) => w && mag(w) > 0) as number[][];
      if (!vois.length) return v;
      return vois.reduce((m, q) => (mag(q) > mag(m) ? q : m)).map((k) => k * 0.5);
    });
    return b.map((v, i) => v.map((_, k) => +(((b[i - 1] || v)[k] + 2 * v[k] + (b[i + 1] || v)[k]) / 4).toFixed(5)));
  };
  for (const x of Object.values(out)) {
    for (const m of ['l', 'r', 'jl', 'jr'] as const) if (x[m]) x[m] = adoucir(x[m]!);
    if (x.y) x.y = adoucir(x.y.map((v) => [v])).map((v) => v[0]);
    if (x.tete) x.tete = adoucir(x.tete.map((v) => [v])).map((v) => v[0]);
  }
  return out;
}

/** Ajouter des corrections a d'autres (memes cles, meme pas). */
function cumuler(base: Corrections, ajout: Corrections): Corrections {
  const out: Corrections = JSON.parse(JSON.stringify(base));
  for (const [cle, a] of Object.entries(ajout)) {
    const b = out[cle] || (out[cle] = { pas: a.pas });
    for (const m of ['l', 'r', 'jl', 'jr'] as const) {
      if (!a[m]) continue;
      const cur = b[m] || a[m]!.map(() => [0, 0, 0]);
      b[m] = cur.map((v, i) => [0, 1, 2].map((k) => +((v[k] || 0) + (a[m]![i]?.[k] || 0)).toFixed(5)));
    }
    for (const k of ['y', 'tete'] as const) {
      const av = a[k]; if (!av) continue;
      const cur = b[k] || av.map(() => 0);
      b[k] = cur.map((v, i) => +(v + (av[i] || 0)).toFixed(5));
    }
  }
  return out;
}

/** Une image d'un geste au temps t, sur une toile visible (controle a l'oeil). Rend une adresse PNG. */
async function image(p: Personnage, g: string, t: number, lacet: number, corriger: boolean) {
  const toile = document.createElement('canvas');
  toile.style.cssText = 'width:300px;height:600px';
  document.body.appendChild(toile);
  const vue = vueMascotte({ toile, pixels: 3, manuelle: true, lacet, corriger });
  await vue.jouer(p, g, null);
  vue.avancer(0);
  for (let s = 0; s < t - 1e-6; s += PAS) vue.avancer(Math.min(PAS, t - s));
  const url = toile.toDataURL('image/png');
  vue.liberer(); toile.remove();
  return url;
}

(window as any).__verifier = { passe, cumuler, lisser, poserCorrections, image };
(window as any).__pret = true;
