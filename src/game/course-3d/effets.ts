// LA COURSE EN VRAIE 3D — les coups de poussee (decoupe de course-3d.ts, 11/11/2026).

import * as THREE from 'three';
import { clone as clonerSquelette } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { poser } from '../vedette-3d';
import { zSol } from '../salle-3d';
import { texteCanvas, monde } from './scene';
import { ouCourt, capIci, virageApres, salleActive } from './repere';
import { gabarit, modeleDe, _M, _T, _S, Qgl, type Corps } from './corps';

// --- LES COUPS DE POUSSEE : le depart et la transition, recompenses ------------
//
// Les memes regles que le jeu (game/poussee-gestes.ts, la meme duree et la
// meme enveloppe que rendu-premium.js) : le DEPART CANON (reaction au-dessus de
// 82 % du gain maximal) allume le halo — l'onde doree au sol sous ses appuis et
// l'aura sur son buste ; la TRANSITION PARFAITE y ajoute l'image remanente, trois
// copies du coureur derriere lui (le depart aussi sous un skin qui part plus
// fort, look.departParfait). En 3D s'y ajoutent, a mi-force et sans copies, le
// BON DEPART (au moins 45 % du gain) et la BONNE TRANSITION (note 1), que le 2D
// ne signait que par le texte du HUD (demande de l'auteur, 22/10).
const POUSS_DUREE = 0.85, SEUIL_CANON = 0.82, SEUIL_BON = 0.45;
let poussT0 = -1, poussF = 0, poussEchos = false;
let vuReaction = false, vuTrans = false, coureurVu: any = null;
let onde: THREE.Mesh, aura: THREE.Sprite;
const echos: Corps[] = [];

function armer(f: number, avecEchos: boolean) {
  poussT0 = performance.now() / 1000; poussF = f; poussEchos = avecEchos;
}
function partPoussee() {
  const t = performance.now() / 1000 - poussT0;
  if (poussT0 < 0 || t > POUSS_DUREE) return { f: 0, age: -1 };
  const u = t / POUSS_DUREE;
  return { f: poussF * (u < 0.1 ? u / 0.1 : Math.pow(1 - (u - 0.1) / 0.9, 1.9)), age: u };
}
function guetterLesGestes(G: any, C: any) {
  const p = G.player;
  if (G.state !== 'race' || !p) { if (G.state !== 'race') { vuReaction = vuTrans = false; } return; }
  if (p !== coureurVu) { coureurVu = p; vuReaction = vuTrans = false; }
  if (!vuReaction && p.reaction !== null && p.reaction !== undefined) {
    vuReaction = true;
    const part = p.jumped ? 0 : (p.reactBonus || 0) / (C.REACT_BONUS || 1);
    if (part > SEUIL_CANON) armer(1, !!(p.look && p.look.departParfait > 1));
    else if (part > SEUIL_BON) armer(0.5, false);
  }
  if (!vuTrans && p.transGrade !== null && p.transGrade !== undefined) {
    vuTrans = true;
    if (p.transGrade === 2) armer(1, true);
    else if (p.transGrade === 1) armer(0.55, false);
  }
}

export function initialiserLesEffets() {
  const or = new THREE.Color(248 / 255, 205 / 255, 74 / 255);
  onde = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48),
    new THREE.MeshBasicMaterial({ color: or, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  onde.visible = false;
  const halo = texteCanvas((c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(248,205,74,0.9)'); g.addColorStop(0.5, 'rgba(250,190,64,0.4)'); g.addColorStop(1, 'rgba(248,205,74,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, 128, 128);
  aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  aura.visible = false;
  monde.add(onde, aura);
}

/** Un double du coureur, translucide et dore, pour l'image remanente. */
function echoDe(k: number): Corps | null {
  if (echos[k]) return echos[k];
  if (!gabarit) return null;
  const copie = clonerSquelette(gabarit);
  // une silhouette pleine, doree, et non une lueur additive : sur le rouge de la piste,
  // une lueur a 30 % disparaissait en pleine course (l'auteur, 22/10 : « je ne la vois pas »)
  const mat = new THREE.MeshLambertMaterial({ color: 0xffc93a, emissive: 0x6a4a00, transparent: true, opacity: 0.6, depthWrite: false });
  copie.traverse((o: any) => { if (o.isMesh) { o.material = mat; o.castShadow = false; } });
  echos[k] = { m: modeleDe(copie), mats: {} };
  (echos[k] as any).mat = mat;
  monde.add(echos[k].m.racine);
  return echos[k];
}

export function dessinerLesEffets(App: any) {
  const { G, C } = App;
  guetterLesGestes(G, C);
  const { f, age } = partPoussee();
  const p = G.player;
  for (const e of echos) if (e) e.m.racine.visible = false;
  onde.visible = aura.visible = false;
  if (age < 0 || !p) return;
  const T = G.track, q = ouCourt(T, p);
  // l'onde s'ouvre sous ses appuis
  const r = 0.5 + 3.6 * age;
  onde.position.set(q[0], q[1], 0.02); onde.scale.set(r, r, 1);
  (onde.material as THREE.MeshBasicMaterial).opacity = f * 0.75 * (1 - age);
  onde.visible = true;
  // l'aura sur le buste
  const ra = (1.15 + 0.75 * f) * 1.6;
  aura.position.set(q[0], q[1], 1.05); aura.scale.set(ra, ra, 1);
  (aura.material as THREE.SpriteMaterial).opacity = f * 0.5;
  aura.visible = true;
  // les copies derriere lui, de plus en plus pales
  if (!poussEchos || !p.squelette) return;
  const cap = capIci(T.heading(p.d, p.lane)) - virageApres(T, p.lane, p.d), lean = T.lean(p.d, p.lane, p.v);
  const k0 = (p.look.h || C.MODEL_H) / C.MODEL_H;
  for (let k = 1; k <= 3; k++) {
    // plus espacees qu'en 2D : vue de dos, des copies serrees se fondent en une tache
    const d = p.d - Math.max(0.7, p.v * 0.11) * k;
    if (d <= 0) continue;
    const e = echoDe(k - 1);
    if (!e) continue;
    poser(e.m, p.squelette);
    const pq = ouCourt(T, p, d);
    const [ex, ey, ez] = App.repereDuCoureur(p, cap, lean, false, false);
    _M.set(ex[0], ey[0], ez[0], 0, ex[1], ey[1], ez[1], 0, ex[2], ey[2], ez[2], 0, 0, 0, 0, 1);
    e.m.racine.matrix.multiplyMatrices(_T.makeTranslation(pq[0], pq[1], salleActive ? zSol(pq[0], pq[1]) : 0), _S.makeScale(k0, k0, k0)).multiply(_M).multiply(Qgl);
    e.m.racine.matrixWorldNeedsUpdate = true;
    // l'image remanente tient sa pleine force plus longtemps que le halo
    (e as any).mat.opacity = (1 - age * age) * 0.75 * (4 - k) / 3;
    e.m.racine.visible = true;
  }
}
