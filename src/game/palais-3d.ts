// LE PALAIS ROYAL EN 3D (23/10/2026).
//
// « Un stade a l'interieur d'un chateau : toute la deco de l'interieur du chateau, la piste
// couleur cristal, pas de gradins mais des personnes assises sur des chaises, d'autres a
// table, d'autres qui regardent la course depuis la mezzanine. Une atmosphere chic et
// sprint. » Cherche dans Unity (StadeChateau.cs : Versailles, la Galerie des Glaces, un sol
// de panneaux de marbre — « pas un echiquier » —, les details accentues, le centre garni),
// valide par l'auteur ; ce module le reconstruit pour la course three.js (course-3d.ts
// l'appelle a la place des tribunes quand le theme porte `palais`).
//
// La salle entoure tout l'ovale : quatre murs de glaces en arcades entre des pilastres de
// marbre griotte, une mezzanine doree tout autour, une voute peinte, des lustres de
// cristal ; entre la piste et les murs, des tables de gala ; au centre, la fontaine sur un
// soleil incruste, quatre statues, des orangers en caisse. Tout ce qui se repete est
// instancie : un appel de dessin par sorte d'objet.
//
// Repere : celui du stade de course-3d.ts — x le long de la ligne droite d'arrivee, y vers
// l'exterieur, z en haut ; les virages tournent autour de (D0, -R) et (D1, -R).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type ContextePalais = {
  stade: THREE.Group;
  W: number; R: number; D0: number; D1: number;
  hasard: () => number;
  /** Une carte du public (atlas du stade : 0-2 assis, 3 debout), et son cap. */
  spectateur: (x: number, y: number, z: number, geste: number, face: number) => void;
  /** Le reflet de la salle (PMREM), pour l'or, le cristal et le marbre poli. */
  env: THREE.Texture | null;
};

const c3 = (r: number, g: number, b: number) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);

function toile(dessin: (c: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  dessin(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

/** Un lot d'instances : une geometrie, une matiere, des matrices (et des couleurs). */
class Lot {
  m: THREE.Matrix4[] = []; c: (THREE.Color | null)[] = [];
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material, public ombre = false) {}
  poser(m: THREE.Matrix4, c: THREE.Color | null = null) { this.m.push(m.clone()); this.c.push(c); }
  finir(g: THREE.Group) {
    if (!this.m.length) return;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.m.length);
    this.m.forEach((m, i) => { im.setMatrixAt(i, m); if (this.c[i]) im.setColorAt(i, this.c[i]!); });
    im.frustumCulled = false; im.castShadow = this.ombre; im.receiveShadow = true;
    g.add(im);
  }
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const place = (x: number, y: number, z: number, rz = 0, sx = 1, sy = 1, sz = 1) =>
  _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, 0, rz)), _s.set(sx, sy, sz));

// les couleurs du palais (StadeChateau.cs)
const CREME = '#efe6d4', GRIOTTE = '#7d1424', GRIOTTE_C = '#a3263a', OR = '#d4a64a', OR_C = '#f3d58a', OR_F = '#8a6424';

/**
 * LA PISTE EN CRISTAL TAILLE (24/10 : « la couleur de piste d'avant, mais ameliore la qualite et les
 * details »). Le bleu de glace revient ; ce qui lui manquait de force vient de la taille : des facettes
 * en losange de quatre-vingts centimetres, chacune d'une nuance, leurs aretes qui accrochent la lumiere, et
 * un vernis (clearcoat) qui renvoie la salle. Calcule dans le repere du monde — les bandes droites et
 * les anneaux des virages se raccordent sans couture —, et les aretes s'adoucissent a la largeur
 * d'un pixel (fwidth) : aucun crenelage.
 */
export function cristalTaille(c: THREE.Color, env: THREE.Texture | null) {
  const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.14, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.04,
    envMap: env, envMapIntensity: 1.25, emissive: c, emissiveIntensity: 0.08 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCristal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCristal = (modelMatrix * vec4(transformed, 1.0)).xy;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCristal;')
      .replace('#include <color_fragment>', `#include <color_fragment>
vec2 q = vec2(vCristal.x + vCristal.y, vCristal.x - vCristal.y) * 0.85;
vec2 f = abs(fract(q) - 0.5);
float bord = 0.5 - max(f.x, f.y);
float largeur = max(fwidth(bord) * 1.5, 1e-4);
float arete = 1.0 - smoothstep(0.0, largeur + 0.012, bord);
float face = fract(sin(dot(floor(q), vec2(12.9898, 78.233))) * 43758.5453);
diffuseColor.rgb *= 0.93 + 0.12 * face;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.97, 1.0), arete * 0.16);`);
  };
  m.customProgramCacheKey = () => 'cristal-taille';
  return m;
}

/** Un degrade d'or, de haut en bas, pour peindre les cadres. */
function or(c: CanvasRenderingContext2D, y0: number, y1: number) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, OR_C); g.addColorStop(0.5, OR); g.addColorStop(1, OR_F);
  return g;
}

export function construirePalais(o: ContextePalais) {
  const { stade, W, R, D0, D1, hasard, env } = o;
  const ajoute = <M extends THREE.Object3D>(m: M) => { stade.add(m); return m; };
  const xc = (D0 + D1) / 2, yc = -R;

  // LA SALLE : un rectangle autour de l'ovale, ses cotes en multiples de la travee (8 m)
  const BAIE = 8, H = 22, MARGE = 26;
  const lx = Math.ceil((D1 - D0 + 2 * (R + W + MARGE)) / BAIE) * BAIE;
  const ly = Math.ceil((2 * (R + W + MARGE)) / BAIE) * BAIE;
  const X0 = xc - lx / 2, X1 = xc + lx / 2, Y0 = yc - ly / 2, Y1 = yc + ly / 2;
  /** La distance au bord exterieur de la piste (negative sur la piste et dedans). */
  const horsPiste = (x: number, y: number) => Math.hypot(x - Math.min(D1, Math.max(D0, x)), y - yc) - (R + W);

  // --- LES MATIERES -------------------------------------------------------------------
  const matOr = new THREE.MeshStandardMaterial({ color: c3(212, 166, 74), metalness: env ? 0.85 : 0.35, roughness: 0.28, envMap: env, envMapIntensity: 1.1 });
  const matGriotte = new THREE.MeshStandardMaterial({ color: c3(125, 20, 36), roughness: 0.22, envMap: env, envMapIntensity: 0.5 });
  const matMarbre = new THREE.MeshStandardMaterial({ color: c3(242, 236, 226), roughness: 0.3, envMap: env, envMapIntensity: 0.4 });
  const matNappe = new THREE.MeshStandardMaterial({ color: c3(248, 244, 236), roughness: 0.85 });
  const matCristal = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: c3(255, 236, 200), emissiveIntensity: 0.55,
    roughness: 0.02, metalness: 0.1, envMap: env, envMapIntensity: 1.6, transparent: true, opacity: 0.9 });
  const matFlamme = new THREE.MeshBasicMaterial({ color: c3(255, 214, 130) });
  const matVelours = new THREE.MeshStandardMaterial({ color: c3(138, 15, 30), roughness: 0.9 });

  // --- LE SOL : des panneaux de marbre creme, des bandes de griotte, un filet d'or ----
  // LE SOL NE SE REPETE PLUS EN GRILLE (« le decor est trop plat et sans ame », 24/10) : le carreau de
  // 4 m, aux memes veines partout, faisait un grand quadrillage rouge. Une dalle de 8 m porte quatre
  // panneaux de marbre, chacun ses teintes et ses veines, des bandes de griotte plus fines a double
  // filet d'or, des rosaces aux croisements et un losange incruste au coeur de chaque panneau.
  const sol = toile((c, w, h) => {
    const P = w / 2, tons = ['#f1e8d6', '#ece0cb', '#f4ede0', '#e9ddc6'];
    for (let i = 0; i < 4; i++) {
      const x0 = (i % 2) * P, y0 = Math.floor(i / 2) * P;
      c.save(); c.beginPath(); c.rect(x0, y0, P, P); c.clip();
      const g = c.createLinearGradient(x0, y0, x0 + P, y0 + P);
      g.addColorStop(0, tons[i]); g.addColorStop(0.5, tons[(i + 1) % 4]); g.addColorStop(1, tons[i]);
      c.fillStyle = g; c.fillRect(x0, y0, P, P);
      // les veines : un fil principal, ses affluents, des nuages laiteux
      const ang = hasard() * Math.PI;
      for (let n = 0; n < 9; n++) {
        c.fillStyle = `rgba(255,252,246,${0.05 + hasard() * 0.06})`;
        c.beginPath(); c.ellipse(x0 + hasard() * P, y0 + hasard() * P, 40 + hasard() * 160, 20 + hasard() * 60, ang, 0, Math.PI * 2); c.fill();
      }
      for (let v = 0; v < 14; v++) {
        const fort = v < 3;
        c.strokeStyle = fort ? `rgba(${120 + hasard() * 30 | 0},${96 + hasard() * 24 | 0},${78 + hasard() * 20 | 0},${0.22 + hasard() * 0.18})`
          : `rgba(${150 + hasard() * 40 | 0},${126 + hasard() * 30 | 0},${104 + hasard() * 30 | 0},${0.06 + hasard() * 0.1})`;
        c.lineWidth = fort ? 1.6 + hasard() * 2.2 : 0.6 + hasard() * 1.2;
        let x = x0 + hasard() * P, y = y0 + hasard() * P, a = ang + (hasard() - 0.5) * 0.9;
        c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 9; k++) {
          a += (hasard() - 0.5) * 0.7; const l = 40 + hasard() * 90;
          const nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l;
          c.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, nx, ny); x = nx; y = ny;
        }
        c.stroke();
      }
      // le losange incruste : marbre rose de Languedoc, cerne d'un filet d'or
      const cx = x0 + P / 2, cy = y0 + P / 2, r = P * 0.27;
      c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath();
      c.fillStyle = 'rgba(196,128,118,0.55)'; c.fill();
      c.strokeStyle = OR; c.lineWidth = 5; c.stroke();
      c.beginPath(); c.arc(cx, cy, r * 0.22, 0, Math.PI * 2); c.fillStyle = OR_C; c.fill();
      c.restore();
    }
    // les bandes de griotte (0,18 m) a double filet d'or, sur les bords de chaque panneau
    const b = w * 0.0225;
    c.fillStyle = GRIOTTE;
    for (const k of [0, P]) { c.fillRect(0, k - b / 2, w, b); c.fillRect(k - b / 2, 0, b, h); }
    c.fillRect(0, h - b / 2, w, b / 2); c.fillRect(w - b / 2, 0, b / 2, h);
    c.fillStyle = OR;
    for (const k of [0, P, w]) for (const e of [-b / 2 - 4, b / 2]) { c.fillRect(0, k + e, w, 4); c.fillRect(k + e, 0, 4, h); }
    // les rosaces d'or aux croisements : huit petales autour d'un coeur de griotte
    for (const [rx, ry] of [[0, 0], [P, 0], [0, P], [P, P], [w, 0], [0, h], [w, h], [w, P], [P, h]]) {
      c.fillStyle = OR_C;
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        c.beginPath(); c.ellipse(rx + Math.cos(a) * b * 0.9, ry + Math.sin(a) * b * 0.9, b * 0.55, b * 0.24, a, 0, Math.PI * 2); c.fill();
      }
      c.beginPath(); c.arc(rx, ry, b * 0.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = GRIOTTE_C; c.beginPath(); c.arc(rx, ry, b * 0.3, 0, Math.PI * 2); c.fill();
    }
  }, 2048, 2048);
  sol.wrapS = sol.wrapT = THREE.RepeatWrapping; sol.repeat.set(lx / 8, ly / 8);
  const plancher = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(lx, ly),
    new THREE.MeshStandardMaterial({ map: sol, roughness: 0.16, envMap: env, envMapIntensity: 0.55 })));
  plancher.position.set(xc, yc, -0.1); plancher.receiveShadow = true;

  // --- LES MURS : une travee peinte (glaces en arcade, fenetres et rideaux) -----------
  const K = 64;                                   // pixels par metre
  const Z = (z: number) => H * K - z * K;
  const travee = toile((c, w, h) => {
    c.fillStyle = '#ece0c8'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      c.strokeStyle = `rgba(160,130,96,${0.05 + hasard() * 0.08})`; c.lineWidth = 1 + hasard() * 2;
      c.beginPath(); c.moveTo(hasard() * w, hasard() * h); c.lineTo(hasard() * w, hasard() * h); c.stroke();
    }
    // le soubassement de griotte et ses panneaux d'or
    c.fillStyle = GRIOTTE; c.fillRect(0, Z(1.1), w, 1.1 * K);
    c.strokeStyle = OR; c.lineWidth = 3; c.strokeRect(0.9 * K, Z(0.95), 6.2 * K, 0.8 * K);
    c.fillStyle = or(c, Z(1.2), Z(1.1)); c.fillRect(0, Z(1.2), w, 0.1 * K);
    // LA GLACE EN ARCADE : 5 m de large, plein cintre, des petits carreaux dans un cadre d'or
    const arcade = (x0: number, x1: number, z0: number, zc: number) => {
      const r = (x1 - x0) / 2;
      c.beginPath(); c.moveTo(x0 * K, Z(z0)); c.lineTo(x0 * K, Z(zc));
      c.arc((x0 + r) * K, Z(zc), r * K, Math.PI, 0); c.lineTo(x1 * K, Z(z0)); c.closePath();
    };
    arcade(1.5, 6.5, 1.3, 4.8);
    c.save(); c.clip();
    const g = c.createLinearGradient(0, Z(7.3), 0, Z(1.3));
    g.addColorStop(0, '#6e5a44'); g.addColorStop(0.45, '#cdb88e'); g.addColorStop(0.7, '#8a7458'); g.addColorStop(1, '#4a3a2c');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // les lustres d'en face qui s'y refletent, et un voile clair en biais
    for (let i = 0; i < 7; i++) {
      const x = (1.8 + hasard() * 4.4) * K, y = Z(3.5 + hasard() * 3.4), r = (0.25 + hasard() * 0.5) * K;
      const l = c.createRadialGradient(x, y, 0, x, y, r);
      l.addColorStop(0, 'rgba(255,240,200,0.95)'); l.addColorStop(1, 'rgba(255,220,160,0)');
      c.fillStyle = l; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    c.fillStyle = 'rgba(255,250,236,0.16)';
    c.beginPath(); c.moveTo(1.5 * K, Z(2)); c.lineTo(3.4 * K, Z(7.4)); c.lineTo(4.6 * K, Z(7.4)); c.lineTo(2.7 * K, Z(1.3)); c.fill();
    c.strokeStyle = 'rgba(138,100,36,0.85)'; c.lineWidth = 2;
    for (let x = 1.5; x < 6.5; x += 0.83) { c.beginPath(); c.moveTo(x * K, 0); c.lineTo(x * K, h); c.stroke(); }
    for (let z = 1.3; z < 7.3; z += 0.7) { c.beginPath(); c.moveTo(0, Z(z)); c.lineTo(w, Z(z)); c.stroke(); }
    c.restore();
    arcade(1.5, 6.5, 1.3, 4.8); c.strokeStyle = or(c, Z(7.5), Z(1.3)); c.lineWidth = 0.3 * K; c.stroke();
    // la clef de l'arc : un mascaron d'or
    c.fillStyle = or(c, Z(8), Z(7.2));
    c.beginPath(); c.moveTo(3.6 * K, Z(7.3)); c.lineTo(4.4 * K, Z(7.3)); c.lineTo(4.25 * K, Z(7.95)); c.lineTo(3.75 * K, Z(7.95)); c.fill();
    // la corniche sous la mezzanine
    c.fillStyle = or(c, Z(8.5), Z(7.95)); c.fillRect(0, Z(8.5), w, 0.55 * K);
    // L'ETAGE : une haute fenetre, ses rideaux de griotte, un lambrequin a franges d'or
    arcade(2, 6, 9.4, 16);
    const vitre = c.createLinearGradient(0, Z(18), 0, Z(9.4));
    vitre.addColorStop(0, '#1c2a58'); vitre.addColorStop(0.6, '#5a5a86'); vitre.addColorStop(1, '#c48c5c');
    c.fillStyle = vitre; c.fill();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(40,30,20,0.8)'; c.lineWidth = 3;
    for (let x = 2; x < 6; x += 0.66) { c.beginPath(); c.moveTo(x * K, 0); c.lineTo(x * K, h); c.stroke(); }
    for (let z = 9.4; z < 18; z += 0.9) { c.beginPath(); c.moveTo(0, Z(z)); c.lineTo(w, Z(z)); c.stroke(); }
    c.restore();
    arcade(2, 6, 9.4, 16); c.strokeStyle = or(c, Z(18.3), Z(9.4)); c.lineWidth = 0.22 * K; c.stroke();
    for (const [a, b] of [[1.1, 2.7], [5.3, 6.9]]) {
      const plis = c.createLinearGradient(a * K, 0, b * K, 0);
      for (let k = 0; k <= 6; k++) plis.addColorStop(k / 6, k % 2 ? GRIOTTE : GRIOTTE_C);
      c.fillStyle = plis;
      c.beginPath(); c.moveTo(a * K, Z(19)); c.lineTo(b * K, Z(19));
      c.quadraticCurveTo((a + b) / 2 * K, Z(13), b * K, Z(9.2));
      c.lineTo(a * K, Z(9.2)); c.closePath(); c.fill();
      c.fillStyle = OR; c.fillRect(a * K, Z(13.2), (b - a) * K, 0.18 * K);       // l'embrasse
    }
    c.fillStyle = GRIOTTE; c.fillRect(1, Z(19.6), w - 2, 0.7 * K);              // le lambrequin
    c.fillStyle = OR; for (let x = 0; x < w; x += 10) c.fillRect(x, Z(18.9), 5, 0.22 * K);
    // le medaillon et l'entablement a denticules
    c.fillStyle = or(c, Z(21), Z(19.8));
    c.beginPath(); c.ellipse(4 * K, Z(20.35), 0.75 * K, 0.5 * K, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = GRIOTTE_C; c.beginPath(); c.ellipse(4 * K, Z(20.35), 0.42 * K, 0.26 * K, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = or(c, Z(22), Z(21)); c.fillRect(0, 0, w, 1 * K);
    c.fillStyle = OR_F; for (let x = 0; x < w; x += 16) c.fillRect(x, 0.55 * K, 8, 0.3 * K);
  }, BAIE * K, H * K);
  travee.wrapS = THREE.RepeatWrapping;
  // une seule face, tournee vers la salle : le survol, de dehors, voit a travers
  const matMur = new THREE.MeshStandardMaterial({ map: travee, roughness: 0.5, envMap: env, envMapIntensity: 0.25 });

  // les quatre murs : u le long du mur, n vers l'interieur (u x z = n)
  const murs: { a: THREE.Vector2; u: THREE.Vector2; n: THREE.Vector2; L: number }[] = [
    { a: new THREE.Vector2(X0, Y1), u: new THREE.Vector2(1, 0), n: new THREE.Vector2(0, -1), L: lx },
    { a: new THREE.Vector2(X1, Y0), u: new THREE.Vector2(-1, 0), n: new THREE.Vector2(0, 1), L: lx },
    { a: new THREE.Vector2(X1, Y1), u: new THREE.Vector2(0, -1), n: new THREE.Vector2(-1, 0), L: ly },
    { a: new THREE.Vector2(X0, Y0), u: new THREE.Vector2(0, 1), n: new THREE.Vector2(1, 0), L: ly },
  ];
  const quat = (u: THREE.Vector2, n: THREE.Vector2) =>
    new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(u.x, u.y, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(n.x, n.y, 0)));
  // posee dans le repere du mur : s le long, d vers l'interieur, z en haut
  const auMur = (m: typeof murs[0], s: number, d: number, z: number, lu: number, ld: number, lz: number) =>
    _m.compose(_v.set(m.a.x + m.u.x * s + m.n.x * d, m.a.y + m.u.y * s + m.n.y * d, z), quat(m.u, m.n), _s.set(lu, lz, ld));

  const boiteU = new THREE.BoxGeometry(1, 1, 1);
  const pilastres = new Lot(boiteU, matGriotte), dores = new Lot(boiteU, matOr), dalles = new Lot(boiteU, matMarbre);
  const colonnes = new Lot(new THREE.CylinderGeometry(0.32, 0.36, 1, 16).rotateX(Math.PI / 2), matGriotte, true);
  const balustres = new Lot(new THREE.LatheGeometry([[0.07, 0], [0.11, 0.1], [0.05, 0.3], [0.12, 0.55], [0.05, 0.8], [0.09, 0.9]]
    .map(([r, h]) => new THREE.Vector2(r, h)), 8).rotateX(Math.PI / 2), matOr);
  const ZM = 8.5, PM = 5;                         // la mezzanine : son plancher, sa profondeur
  for (const m of murs) {
    const p = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(m.L, H), matMur));
    const t = (p.material as THREE.MeshStandardMaterial).map!;
    t.repeat.set(m.L / BAIE, 1);
    p.position.set(m.a.x + m.u.x * m.L / 2, m.a.y + m.u.y * m.L / 2, H / 2);
    p.quaternion.copy(quat(m.u, m.n));
    for (let s = 0; s <= m.L + 0.01; s += BAIE) {
      pilastres.poser(auMur(m, s, 0.3, H / 2, 1.2, 0.6, H));                   // le pilastre de griotte
      dores.poser(auMur(m, s, 0.35, 0.25, 1.5, 0.75, 0.5));                    // sa base
      dores.poser(auMur(m, s, 0.35, ZM - 0.9, 1.45, 0.72, 0.5));               // ses chapiteaux d'or
      dores.poser(auMur(m, s, 0.35, H - 1.4, 1.45, 0.72, 0.6));
      // les colonnes qui portent la mezzanine, et leurs chapiteaux
      colonnes.poser(_m.compose(_v.set(m.a.x + m.u.x * s + m.n.x * (PM - 0.4), m.a.y + m.u.y * s + m.n.y * (PM - 0.4), ZM / 2), _q.identity(), _s.set(1, 1, ZM)));
      dores.poser(auMur(m, s, PM - 0.4, ZM - 0.55, 0.95, 0.95, 0.4));
      dores.poser(auMur(m, s, PM - 0.4, 0.2, 0.95, 0.95, 0.4));
    }
    dalles.poser(auMur(m, m.L / 2, PM / 2, ZM - 0.2, m.L, PM, 0.4));           // le plancher de la mezzanine
    dores.poser(auMur(m, m.L / 2, PM, ZM - 0.25, m.L, 0.16, 0.5));             // son bandeau d'or
    dores.poser(auMur(m, m.L / 2, PM - 0.1, ZM + 1.05, m.L, 0.16, 0.08));      // la main courante
    dores.poser(auMur(m, m.L / 2, 0.2, H - 0.35, m.L, 0.8, 0.7));              // la corniche, sous la voute
    for (let s = 0.2; s < m.L; s += 0.32)
      balustres.poser(_m.compose(_v.set(m.a.x + m.u.x * s + m.n.x * (PM - 0.1), m.a.y + m.u.y * s + m.n.y * (PM - 0.1), ZM), _q.identity(), _s.set(1, 1, 1.15)));
    // LES INVITES DE LA MEZZANINE, debout a la balustrade
    for (let s = 2; s < m.L - 2; s += 1.0) {
      if (hasard() > 0.62) continue;
      const d = PM - 0.8 - hasard() * 1.6;
      const x = m.a.x + m.u.x * s + m.n.x * d, y = m.a.y + m.u.y * s + m.n.y * d;
      o.spectateur(x, y, ZM, hasard() < 0.7 ? 3 : 1, Math.atan2(m.n.y, m.n.x));
    }
  }

  // --- LA VOUTE PEINTE : un ciel de fresque dans des cadres d'or ----------------------
  const fresque = toile((c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
    g.addColorStop(0, '#cfe0f4'); g.addColorStop(0.6, '#9fbce0'); g.addColorStop(1, '#e8d2a8');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      const x = w * (0.15 + hasard() * 0.7), y = h * (0.15 + hasard() * 0.7), r = w * (0.05 + hasard() * 0.1);
      const n = c.createRadialGradient(x, y, 0, x, y, r);
      n.addColorStop(0, 'rgba(255,250,240,0.75)'); n.addColorStop(1, 'rgba(255,240,220,0)');
      c.fillStyle = n; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    const b = w * 0.06;
    c.strokeStyle = or(c, 0, h); c.lineWidth = b; c.strokeRect(b / 2, b / 2, w - b, h - b);
    c.strokeStyle = GRIOTTE; c.lineWidth = b * 0.18; c.strokeRect(b * 1.1, b * 1.1, w - b * 2.2, h - b * 2.2);
    c.strokeStyle = OR; c.lineWidth = b * 0.3;
    c.beginPath(); c.ellipse(w / 2, h / 2, w * 0.2, h * 0.14, 0, 0, Math.PI * 2); c.stroke();
    for (const [x, y] of [[b / 2, b / 2], [w - b / 2, b / 2], [b / 2, h - b / 2], [w - b / 2, h - b / 2]]) {
      c.fillStyle = OR_C; c.beginPath(); c.arc(x, y, b * 0.9, 0, Math.PI * 2); c.fill();
      c.fillStyle = GRIOTTE; c.beginPath(); c.arc(x, y, b * 0.4, 0, Math.PI * 2); c.fill();
    }
  }, 1024, 1024);
  fresque.wrapS = fresque.wrapT = THREE.RepeatWrapping; fresque.repeat.set(lx / 16, ly / 16);
  const voute = ajoute(new THREE.Mesh(new THREE.PlaneGeometry(lx, ly),
    new THREE.MeshBasicMaterial({ map: fresque, fog: false, color: c3(230, 220, 205) })));
  voute.position.set(xc, yc, H); voute.rotation.x = Math.PI;   // tournee vers le bas : invisible du survol
  // les nervures d'or : des bandes tournees vers le bas, comme la voute (du survol, une grille doree coupait la salle)
  const nervures = new Lot(new THREE.PlaneGeometry(1, 1).rotateX(Math.PI), matOr);
  for (let x = X0; x <= X1 + 0.01; x += 16) nervures.poser(place(x, yc, H - 0.05, 0, 0.8, ly, 1));
  for (let y = Y0; y <= Y1 + 0.01; y += 16) nervures.poser(place(xc, y, H - 0.06, 0, lx, 0.8, 1));

  // --- LES LUSTRES DE CRISTAL ----------------------------------------------------------
  // trois couronnes d'or, des pendeloques, des bougies ; un halo et une flaque de lumiere
  // au sol sous chacun (peints : une vraie lumiere par lustre, c'est trop pour un telephone)
  const couronnes: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.04, 0.04, 4, 6).rotateX(Math.PI / 2).translate(0, 0, 2.2)];
  const pendeloques: THREE.BufferGeometry[] = [], bougies: THREE.BufferGeometry[] = [];
  for (const [r, z, n] of [[1.35, 0, 18], [0.9, 0.75, 12], [0.45, 1.4, 8]]) {
    couronnes.push(new THREE.TorusGeometry(r, 0.05, 6, 28).translate(0, 0, z));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      pendeloques.push(new THREE.OctahedronGeometry(0.09).scale(1, 1, 1.8).translate(Math.cos(a) * r, Math.sin(a) * r, z - 0.22));
      pendeloques.push(new THREE.OctahedronGeometry(0.06).scale(1, 1, 1.8).translate(Math.cos(a) * r, Math.sin(a) * r, z - 0.48));
      if (k % 2 === 0) bougies.push(new THREE.SphereGeometry(0.06, 6, 4).scale(1, 1, 1.6).translate(Math.cos(a) * r, Math.sin(a) * r, z + 0.18));
    }
  }
  pendeloques.push(new THREE.OctahedronGeometry(0.3).scale(1, 1, 1.6).translate(0, 0, -0.6));   // la grosse goutte du bas
  const lLustre = new Lot(mergeGeometries(couronnes), matOr), lCristal = new Lot(mergeGeometries(pendeloques), matCristal);
  const lBougie = new Lot(mergeGeometries(bougies), matFlamme);
  const halo = toile((c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,236,190,1)'); g.addColorStop(0.25, 'rgba(255,214,150,0.45)'); g.addColorStop(1, 'rgba(255,200,130,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, 128, 128);
  const matHalo = new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
  const flaques = new Lot(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: halo, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.16 }));
  const lustres: THREE.Vector3[] = [];
  for (let x = X0 + 10; x < X1 - 6; x += 18) for (let y = Y0 + 10; y < Y1 - 6; y += 18) lustres.push(new THREE.Vector3(x, y, 14.5));
  for (const p of lustres) {
    const k = 1.25;
    lLustre.poser(place(p.x, p.y, p.z, 0, k, k, k)); lCristal.poser(place(p.x, p.y, p.z, 0, k, k, k)); lBougie.poser(place(p.x, p.y, p.z, 0, k, k, k));
    const s = ajoute(new THREE.Sprite(matHalo)); s.position.set(p.x, p.y, p.z + 0.4); s.scale.set(6, 6, 1);
    flaques.poser(place(p.x, p.y, 0.06, 0, 13, 13, 1));   // (6 cm : a 8 mm, elle clignotait sur le tapis et la piste — course-3d.ts, LE SOL EN COUCHES)
  }

  // --- LES TABLES DE GALA, entre la piste et les murs ---------------------------------
  const lNappe = new Lot(new THREE.CylinderGeometry(0.95, 1.0, 0.76, 24).rotateX(Math.PI / 2).translate(0, 0, 0.38), matNappe, true);
  const lFleurs = new Lot(new THREE.SphereGeometry(0.2, 10, 8).translate(0, 0, 0.98), new THREE.MeshStandardMaterial({ color: c3(196, 40, 70), roughness: 0.8 }));
  const lFlambeau = new Lot(mergeGeometries([
    new THREE.CylinderGeometry(0.03, 0.07, 0.5, 8).rotateX(Math.PI / 2).translate(0.35, 0, 1.0),
    new THREE.CylinderGeometry(0.03, 0.07, 0.5, 8).rotateX(Math.PI / 2).translate(-0.35, 0, 1.0)]), matOr);
  const lFlamme = new Lot(mergeGeometries([
    new THREE.SphereGeometry(0.04, 6, 4).scale(1, 1, 1.8).translate(0.35, 0, 1.3),
    new THREE.SphereGeometry(0.04, 6, 4).scale(1, 1, 1.8).translate(-0.35, 0, 1.3)]), matFlamme);
  // LE DAIS ROYAL, derriere l'arrivee : on ne pose pas de table dessus
  const xDais = D1 + 2, yDais = W + 11;
  for (let x = X0 + 8; x < X1 - 8; x += 6.5) for (let y = Y0 + 8; y < Y1 - 8; y += 5.2) {
    const tx = x + (hasard() - 0.5) * 1.6, ty = y + (hasard() - 0.5) * 1.2;
    const d = horsPiste(tx, ty);
    if (d < 6.5 || d > 18 || (Math.abs(tx - xDais) < 8 && Math.abs(ty - yDais) < 6)) continue;
    lNappe.poser(place(tx, ty, 0)); lFleurs.poser(place(tx, ty, 0));
    const a0 = hasard() * Math.PI;
    lFlambeau.poser(place(tx, ty, 0, a0)); lFlamme.poser(place(tx, ty, 0, a0));
    // les convives, tout autour : ils regardent la course (la carte se tourne vers la camera)
    for (let k = 0; k < 5; k++) {
      if (hasard() > 0.85) continue;
      const a = a0 + (k / 5) * Math.PI * 2;
      const vers = Math.atan2(yc - ty, Math.min(D1, Math.max(D0, tx)) - tx);
      o.spectateur(tx + Math.cos(a) * 1.35, ty + Math.sin(a) * 1.35, 0, hasard() < 0.7 ? 0 : 1, vers);
    }
  }
  // LE PREMIER RANG : des chaises au bord de la piste, tout autour (assis, et quelques
  // invites debout derriere)
  const ovale = (r: number, t: number) => {
    const S = D1 - D0, B = Math.PI * r, L = 2 * S + 2 * B;
    let s = ((t % 1) + 1) % 1 * L;
    if (s < S) return [D0 + s, r - R, Math.PI / 2];
    s -= S;
    if (s < B) { const a = Math.PI / 2 - s / r; return [D1 + r * Math.cos(a), -R + r * Math.sin(a), a]; }
    s -= B;
    if (s < S) return [D1 - s, -R - r, -Math.PI / 2];
    s -= S;
    const b = -Math.PI / 2 - s / r;
    return [D0 + r * Math.cos(b), -R + r * Math.sin(b), b];
  };
  for (const [r, pas, geste] of [[R + W + 3.4, 0.72, -1], [R + W + 4.6, 1.3, 3]] as const) {
    const L = 2 * (D1 - D0) + 2 * Math.PI * r;
    for (let s = 0; s < L; s += pas) {
      if (hasard() > (geste < 0 ? 0.82 : 0.35)) continue;
      const [x, y, a] = ovale(r, s / L);
      if (Math.abs(x - xDais) < 6 && y > W) continue;
      o.spectateur(x, y, 0, geste < 0 ? (hasard() < 0.6 ? 0 : hasard() < 0.6 ? 1 : 2) : 3, a + Math.PI);
    }
  }

  // le dais : une estrade tendue de velours, deux trones, un baldaquin
  const estrade = new Lot(boiteU, matVelours, true);
  estrade.poser(place(xDais, yDais, 0.3, 0, 9, 6, 0.6));
  estrade.poser(place(xDais, yDais - 3.4, 0.12, 0, 6, 1.2, 0.24));
  dores.poser(place(xDais, yDais - 3.0, 0.62, 0, 9, 0.12, 0.08));
  for (const dx of [-1.2, 1.2]) {
    dores.poser(place(xDais + dx, yDais + 0.5, 1.05, 0, 1.0, 0.9, 0.9));        // l'assise
    dores.poser(place(xDais + dx, yDais + 1.0, 1.9, 0, 1.1, 0.18, 2.3));       // le dossier
    estrade.poser(place(xDais + dx, yDais + 0.88, 1.95, 0, 0.8, 0.06, 1.7));
    o.spectateur(xDais + dx, yDais + 0.4, 0.75, 0, -Math.PI / 2);
  }
  for (const [dx, dy] of [[-4.2, -2.6], [4.2, -2.6], [-4.2, 2.6], [4.2, 2.6]]) colonnes.poser(place(xDais + dx, yDais + dy, 3.6, 0, 0.5, 0.5, 6));
  estrade.poser(place(xDais, yDais, 6.7, 0, 9.4, 6.2, 0.35));
  dores.poser(place(xDais, yDais - 3.1, 6.4, 0, 9.4, 0.15, 0.6));
  const couronne = ajoute(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.12, 8, 20), matOr));
  couronne.position.set(xDais, yDais - 3.2, 7.6); couronne.rotation.x = Math.PI / 2;

  // --- LE CENTRE : le soleil incruste, la fontaine, les statues, les orangers --------
  const soleil = toile((c, w, h) => {
    const r = w / 2;
    c.translate(r, r);
    c.fillStyle = CREME; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = GRIOTTE; c.lineWidth = r * 0.06; c.beginPath(); c.arc(0, 0, r * 0.95, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = OR; c.lineWidth = r * 0.015; c.beginPath(); c.arc(0, 0, r * 0.9, 0, Math.PI * 2); c.stroke();
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, long = k % 2 ? 0.62 : 0.86, larg = k % 2 ? 0.05 : 0.08;
      c.fillStyle = k % 2 ? OR_F : OR;
      c.beginPath(); c.moveTo(Math.cos(a - larg) * r * 0.4, Math.sin(a - larg) * r * 0.4);
      c.lineTo(Math.cos(a) * r * long, Math.sin(a) * r * long);
      c.lineTo(Math.cos(a + larg) * r * 0.4, Math.sin(a + larg) * r * 0.4); c.fill();
    }
    c.fillStyle = or(c, -r * 0.4, r * 0.4); c.beginPath(); c.arc(0, 0, r * 0.4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = GRIOTTE; c.lineWidth = r * 0.02; c.beginPath(); c.arc(0, 0, r * 0.4, 0, Math.PI * 2); c.stroke();
  }, 1024, 1024);
  const incruste = ajoute(new THREE.Mesh(new THREE.CircleGeometry(15, 96),
    new THREE.MeshStandardMaterial({ map: soleil, roughness: 0.2, metalness: 0.2, envMap: env, envMapIntensity: 0.6 })));
  incruste.position.set(xc, yc, -0.05); incruste.receiveShadow = true;
  // la fontaine : un bassin de marbre, l'eau, deux vasques, un globe d'or ; les jets
  const bassin = ajoute(new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.4, 0.7, 48, 1, true).rotateX(Math.PI / 2), matMarbre));
  bassin.position.set(xc, yc, 0.35); bassin.castShadow = true;
  const margelle = ajoute(new THREE.Mesh(new THREE.TorusGeometry(5.3, 0.16, 8, 64), matOr)); margelle.position.set(xc, yc, 0.72);
  const eau = ajoute(new THREE.Mesh(new THREE.CircleGeometry(5.2, 48),
    new THREE.MeshStandardMaterial({ color: c3(60, 110, 140), roughness: 0.04, metalness: 0.3, envMap: env, envMapIntensity: 1.2 })));
  eau.position.set(xc, yc, 0.5);
  const fut = ajoute(new THREE.Mesh(new THREE.LatheGeometry([[0.7, 0], [0.5, 0.4], [0.35, 1.6], [2.1, 2.0], [2.2, 2.2], [0.3, 2.3], [0.25, 3.3],
    [1.1, 3.6], [1.15, 3.75], [0.2, 3.8], [0.15, 4.4]].map(([r, h]) => new THREE.Vector2(r, h)), 32).rotateX(Math.PI / 2), matMarbre));
  fut.position.set(xc, yc, 0.4); fut.castShadow = true;
  const globe = ajoute(new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 14), matOr)); globe.position.set(xc, yc, 5.1);
  const nGouttes = 420, gouttes = new Float32Array(nGouttes * 3), phase = new Float32Array(nGouttes);
  for (let i = 0; i < nGouttes; i++) phase[i] = hasard();
  const jets = new THREE.BufferGeometry(); jets.setAttribute('position', new THREE.BufferAttribute(gouttes, 3));
  const lJets = ajoute(new THREE.Points(jets, new THREE.PointsMaterial({ color: 0xe8f4ff, size: 0.09, transparent: true, opacity: 0.75, depthWrite: false })));
  lJets.frustumCulled = false;
  // quatre statues de marbre sur leurs socles, des bancs entre elles, des orangers en caisse
  const statue = mergeGeometries([
    new THREE.CapsuleGeometry(0.34, 1.2, 4, 12).rotateX(Math.PI / 2).translate(0, 0, 0.95),
    new THREE.SphereGeometry(0.24, 14, 10).translate(0, 0, 1.95),
    new THREE.CapsuleGeometry(0.09, 0.8, 3, 8).rotateY(-0.6).translate(0.42, 0, 1.75),
    new THREE.CylinderGeometry(0.5, 0.42, 0.25, 16).rotateX(Math.PI / 2).translate(0, 0, 0.12)]);
  const lStatue = new Lot(statue, matMarbre, true);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2, x = xc + Math.cos(a) * 11, y = yc + Math.sin(a) * 11;
    dalles.poser(place(x, y, 0.8, 0, 1.4, 1.4, 1.6)); dores.poser(place(x, y, 1.62, 0, 1.55, 1.55, 0.1));
    lStatue.poser(place(x, y, 1.65, a + Math.PI, 1.15, 1.15, 1.15));
    const b = a + Math.PI / 4;
    dalles.poser(place(xc + Math.cos(b) * 9, yc + Math.sin(b) * 9, 0.25, b, 0.6, 2.6, 0.5));
  }
  const lCaisse = new Lot(boiteU, new THREE.MeshStandardMaterial({ color: c3(244, 240, 230), roughness: 0.6 }), true);
  const lFeuille = new Lot(new THREE.IcosahedronGeometry(1.15, 2), new THREE.MeshStandardMaterial({ color: c3(46, 92, 44), roughness: 0.85 }), true);
  const lOrange = new Lot(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshStandardMaterial({ color: c3(240, 138, 28), roughness: 0.6 }));
  const oranger = (x: number, y: number) => {
    lCaisse.poser(place(x, y, 0.5, 0, 1.2, 1.2, 1.0)); dores.poser(place(x, y, 1.02, 0, 1.28, 1.28, 0.06));
    dores.poser(place(x, y, 1.6, 0, 0.12, 0.12, 1.2));
    lFeuille.poser(place(x, y, 2.85, hasard() * 6, 1, 1, 1.1));
    for (let k = 0; k < 12; k++) {
      const a = hasard() * Math.PI * 2, h = hasard() * 1.6 - 0.6;
      lOrange.poser(place(x + Math.cos(a) * 1.05, y + Math.sin(a) * 1.05, 2.85 + h));
    }
  };
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; oranger(xc + Math.cos(a) * 18, yc + Math.sin(a) * 15); }
  // dans les virages aussi, et le long des murs entre les tables
  for (const cx of [D0, D1]) for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k / 4) * Math.PI;
    oranger(cx + (cx === D1 ? 1 : -1) * Math.cos(a) * (R - 8), yc + Math.sin(a) * (R - 8));
  }
  for (const m of murs) for (let s = BAIE * 1.5; s < m.L - BAIE; s += BAIE * 2)
    oranger(m.a.x + m.u.x * s + m.n.x * (PM + 1.6), m.a.y + m.u.y * s + m.n.y * (PM + 1.6));
  // des invites debout autour de la fontaine
  for (let k = 0; k < 22; k++) {
    const a = hasard() * Math.PI * 2, r = 6.4 + hasard() * 7;
    o.spectateur(xc + Math.cos(a) * r, yc + Math.sin(a) * r, 0, 3, Math.atan2(-Math.sin(a), -Math.cos(a)));
  }

  // --- LE TAPIS ROUGE ET LES GIRANDOLES, entre la piste et les chaises (24/10, « sans ame ») ---
  // Un velours de griotte borde d'or court tout autour de la piste ; des girandoles d'or le jalonnent,
  // trois bougies chacune, et posent au sol une flaque de lumiere chaude.
  const velours = toile((c, w, h) => {
    c.fillStyle = '#7a0f1f'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${hasard() < 0.5 ? '40,0,8' : '170,40,60'},${0.08 + hasard() * 0.08})`; c.fillRect(hasard() * w, hasard() * h, 2, 2); }
    c.fillStyle = OR; c.fillRect(0, 0, w * 0.07, h); c.fillRect(w * 0.93, 0, w * 0.07, h);
    c.fillStyle = OR_F; c.fillRect(w * 0.07, 0, w * 0.015, h); c.fillRect(w * 0.915, 0, w * 0.015, h);
    // une fleur de lys d'or au milieu, tous les deux metres
    c.fillStyle = OR_C; const cx = w / 2, cy = h / 2, k = w * 0.12;
    c.beginPath(); c.ellipse(cx, cy - k * 0.6, k * 0.28, k * 0.75, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(cx - k * 0.55, cy - k * 0.2, k * 0.22, k * 0.55, -0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(cx + k * 0.55, cy - k * 0.2, k * 0.22, k * 0.55, 0.7, 0, Math.PI * 2); c.fill();
    c.fillRect(cx - k * 0.6, cy + k * 0.15, k * 1.2, k * 0.18);
  }, 256, 256);
  velours.wrapS = velours.wrapT = THREE.RepeatWrapping;
  {
    // (au-dela du tartan, W + 0,8, et de la bordure d'or : il commencait 30 cm dessus — course-3d.ts, LE SOL EN COUCHES)
    const r0 = R + W + 0.92, r1 = R + W + 2.5, N = 720, pos: number[] = [], uv: number[] = [], ix: number[] = [];
    const S = D1 - D0, Lr = 2 * S + Math.PI * (r0 + r1);
    for (let i = 0; i <= N; i++) {
      const t = i / N, [xa, ya] = ovale(r0, t), [xb, yb] = ovale(r1, t);
      pos.push(xa, ya, 0.006, xb, yb, 0.006); uv.push(0, t * Lr / 2, 1, t * Lr / 2);
      if (i < N) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ix); g.computeVertexNormals();
    const tapis = ajoute(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: velours, roughness: 0.95, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })));
    tapis.receiveShadow = true;
  }
  const lGirandole = new Lot(mergeGeometries([
    new THREE.LatheGeometry([[0.0, 0], [0.26, 0], [0.24, 0.06], [0.1, 0.12], [0.07, 0.5], [0.11, 0.62], [0.05, 0.75], [0.05, 1.5], [0.09, 1.56], [0.0, 1.62]]
      .map(([r, z]) => new THREE.Vector2(r, z)), 16).rotateX(Math.PI / 2),
    new THREE.TorusGeometry(0.32, 0.025, 6, 24, Math.PI).rotateY(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0, 1.58),
    ...[-0.32, 0, 0.32].map(dx => new THREE.CylinderGeometry(0.06, 0.04, 0.06, 10).rotateX(Math.PI / 2).translate(dx, 0, dx === 0 ? 1.66 : 1.58))]), matOr, true);
  const lCierge = new Lot(mergeGeometries([-0.32, 0, 0.32].map(dx => new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8).rotateX(Math.PI / 2).translate(dx, 0, (dx === 0 ? 1.69 : 1.61) + 0.11))),
    new THREE.MeshStandardMaterial({ color: c3(250, 246, 236), roughness: 0.6 }));
  const lFlammeG = new Lot(mergeGeometries([-0.32, 0, 0.32].map(dx => new THREE.SphereGeometry(0.035, 6, 4).scale(1, 1, 1.9).translate(dx, 0, (dx === 0 ? 1.69 : 1.61) + 0.27))), matFlamme);
  {
    const r = R + W + 1.5, S = D1 - D0, L = 2 * S + 2 * Math.PI * r, n = Math.round(L / 10);
    for (let i = 0; i < n; i++) {
      const [x, y, a] = ovale(r, (i + 0.5) / n);
      if (Math.abs(x - xDais) < 7 && Math.abs(y - yDais) < 5) continue;
      for (const l of [lGirandole, lCierge, lFlammeG]) l.poser(place(x, y, 0, a));
      const s = ajoute(new THREE.Sprite(matHalo)); s.position.set(x, y, 1.95); s.scale.set(1.1, 1.1, 1);
      flaques.poser(place(x, y, 0.06, 0, 5, 5, 1));
    }
  }

  // --- LA POUSSIERE DE CRISTAL qui scintille au-dessus de la piste ---------------------
  const nEclats = 700, eclats = new Float32Array(nEclats * 3);
  for (let i = 0; i < nEclats; i++) {
    const [x, y] = ovale(R + hasard() * (W + 1), hasard());
    eclats.set([x, y, 0.05 + hasard() * hasard() * 4], i * 3);
  }
  const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.BufferAttribute(eclats, 3));
  const matEclat = new THREE.PointsMaterial({ color: 0xdff4ff, size: 0.06, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  ajoute(new THREE.Points(ge, matEclat));

  for (const l of [pilastres, dores, nervures, dalles, colonnes, balustres, lLustre, lCristal, lBougie, flaques, lNappe, lFleurs, lFlambeau, lFlamme,
    estrade, lStatue, lCaisse, lFeuille, lOrange, lGirandole, lCierge, lFlammeG]) l.finir(stade);

  // les jets de la fontaine retombent en gerbe ; les bougies et le cristal frissonnent
  return (t: number) => {
    for (let i = 0; i < nGouttes; i++) {
      const u = (t * 0.6 + phase[i]) % 1, a = phase[i] * 97, haut = i % 3 === 0;
      const r = (haut ? 1.1 : 2.2) * u, z = haut ? 4.5 + 2.4 * u - 3.2 * u * u : 2.4 + 1.2 * u - 2.0 * u * u;
      gouttes[i * 3] = xc + Math.cos(a) * r; gouttes[i * 3 + 1] = yc + Math.sin(a) * r; gouttes[i * 3 + 2] = Math.max(0.5, z);
    }
    jets.attributes.position.needsUpdate = true;
    matCristal.emissiveIntensity = 0.5 + 0.08 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 13.1);
    matEclat.opacity = 0.6 + 0.25 * Math.sin(t * 3.1);
  };
}
