// LA COURSE EN VRAIE 3D — l'espace, le Stade Neon et les pieces de chaque stade (decoupe de course-3d.ts, 11/11/2026).

import * as THREE from 'three';
import { chargeurGLTF } from '../chargeur-gltf';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { R_CORDE, SURVOL } from './reglages';
import { ULTRA } from './paliers';
import { scene, texteCanvas } from './scene';
import { ici, capIci } from './repere';
import { css, stade, c3, hologrammes, pubAnim, refaireLeStade } from './stade';

export function carteNeon(r: THREE.WebGLRenderer) {
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(0x07040e);
  const couleurs = [0xff2bd6, 0x00e5ff, 0x8c3cff, 0xffdc1e, 0xff2bd6, 0x00e5ff];
  let g = 7;
  const h = () => ((g = (g * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const a = h() * Math.PI * 2, d = 8 + h() * 4, haut = (h() - 0.35) * 6;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.4 + h() * 2.2, 0.12 + h() * 0.25, 0.1),
      new THREE.MeshBasicMaterial({ color: couleurs[i % couleurs.length] }));
    m.position.set(Math.cos(a) * d, haut, Math.sin(a) * d); m.lookAt(0, haut, 0);
    if (i % 3 === 0) m.scale.set(0.15, 6, 1);           // des enseignes debout
    sc.add(m);
  }
  const tex = new THREE.PMREMGenerator(r).fromScene(sc, 0.02).texture;
  return tex;
}
// l'espace (Intergalactique) : la voute etoilee qui tourne et l'etoile filante
export let voute: THREE.Object3D | null = null, filante: THREE.Mesh | null = null;
export function oublierLEspace() { voute = null; filante = null; }
export let pluie: THREE.LineSegments | null = null;
export function retirerLaPluie() { if (pluie) { scene.remove(pluie); pluie.geometry.dispose(); pluie = null; } }
// --- L'ESPACE (Intergalactique) -------------------------------------------------

/** La voute du vide : nebuleuses et poussiere d'etoiles sur une sphere tout autour, et une galaxie. */
export function espaceAutour(th: any, hasard: () => number) {
  const fond = th.skyTop || [11, 7, 26];
  scene.background = new THREE.Color().setRGB(fond[0] / 255 * 0.5, fond[1] / 255 * 0.5, fond[2] / 255 * 0.5, THREE.SRGBColorSpace);
  scene.fog = new THREE.Fog(scene.background.getHex(), 380, 1400);
  const teintes: number[][] = th.nebuleuses || [[196, 72, 190], [52, 150, 220], [120, 70, 210]];
  const ciel = texteCanvas((c, w, h) => {
    c.fillStyle = css(fond, 0.6); c.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = hasard() * w, y = h * (0.1 + hasard() * 0.8), r = h * (0.08 + hasard() * 0.22);
      const col = teintes[i % teintes.length], a = 0.12 + hasard() * 0.16;
      for (const dx of [0, -w, w]) {
        const g = c.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(x + dx - r, y - r, 2 * r, 2 * r);
      }
    }
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = `rgba(255,255,255,${0.2 + hasard() * 0.6})`;
      c.fillRect(hasard() * w, hasard() * h, 1, 1);
    }
  }, 2048, 1024);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(560, 48, 24),
    new THREE.MeshBasicMaterial({ map: ciel, side: THREE.BackSide, fog: false, depthWrite: false }));
  sphere.rotation.x = Math.PI / 2;                      // ses poles sur l'axe z du monde
  sphere.position.set(44, -R_CORDE, 0);
  stade!.add(sphere);
  voute = sphere;
  // LA GALAXIE, au loin, sous l'horizon de la piste
  const spirale = texteCanvas((c, w, h) => {
    const cx = w / 2, cy = h / 2;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, w * 0.18);
    g.addColorStop(0, 'rgba(255,240,255,0.95)'); g.addColorStop(1, 'rgba(200,120,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let bras = 0; bras < 2; bras++) for (let i = 0; i < 1400; i++) {
      const t = i / 1400, a = bras * Math.PI + t * 9, r = t * w * 0.46;
      const x = cx + Math.cos(a) * r + (hasard() - 0.5) * w * 0.05 * (0.3 + t), y = cy + Math.sin(a) * r * 0.42 + (hasard() - 0.5) * h * 0.03;
      const col = teintes[(i + bras) % teintes.length];
      c.fillStyle = `rgba(${Math.min(255, col[0] + 60)},${Math.min(255, col[1] + 60)},${Math.min(255, col[2] + 60)},${0.5 * (1 - t)})`;
      c.fillRect(x, y, 2, 2);
    }
  }, 512, 512);
  const gal = new THREE.Mesh(new THREE.PlaneGeometry(260, 260),
    new THREE.MeshBasicMaterial({ map: spirale, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  gal.position.set(330, -R_CORDE - 160, -150);
  gal.lookAt(44, -R_CORDE, 20);
  stade!.add(gal);
  // L'ETOILE FILANTE : un trait qui traverse le ciel de temps en temps (rendre)
  const trace = texteCanvas((c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g; c.fillRect(0, h / 2 - 1, w, 2);
  }, 256, 8);
  filante = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.6),
    new THREE.MeshBasicMaterial({ map: trace, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  filante.visible = false;
  stade!.add(filante);
}

/** Les planetes de decor-cosmos.js, aux memes places le long du trace, loin sous la piste. */
const PLANETES_3D = [
  { f: 0.10, couloir: -12, R: 5.2, col: [214, 92, 200], anneau: true },
  { f: 0.42, couloir: -24, R: 10.5, col: [58, 170, 214], anneau: false },
  { f: 0.72, couloir: -10, R: 2.6, col: [236, 162, 84], anneau: false },
  { f: 0.95, couloir: -18, R: 6.4, col: [130, 110, 236], anneau: true },
];
export function planetesSousLaPiste(T: any, hasard: () => number) {
  const g = new THREE.Group();
  stade!.add(g);
  for (const pl of PLANETES_3D) {
    const p = ici(T.pos(pl.f * (T.total || 100), pl.couloir));
    const R = pl.R * 2.4, z = -(20 + R * 3.2);
    const bandes = texteCanvas((c, w, h) => {
      for (let y = 0; y < h; y += 4) {
        const k = 0.75 + 0.35 * Math.sin(y * 0.09 + hasard() * 0.6);
        c.fillStyle = css(pl.col, k); c.fillRect(0, y, w, 4);
      }
    }, 64, 128);
    const astre = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20),
      new THREE.MeshLambertMaterial({ map: bandes, emissive: c3(pl.col, pl.col).multiplyScalar(0.18), fog: false }));
    astre.position.set(p[0], p[1], z);
    astre.rotation.set(0.4, 0.2, 0);
    g.add(astre);
    // le halo autour, et l'anneau
    const halo = texteCanvas((c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w / 2);
      g.addColorStop(0, `rgba(${pl.col[0]},${pl.col[1]},${pl.col[2]},0.45)`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 128, 128);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.position.copy(astre.position); sp.scale.set(R * 3.4, R * 3.4, 1);
    g.add(sp);
    if (pl.anneau) {
      const a = new THREE.Mesh(new THREE.RingGeometry(R * 1.4, R * 2.2, 96),
        new THREE.MeshBasicMaterial({ color: c3(pl.col, pl.col).lerp(new THREE.Color(0xffffff), 0.4), transparent: true, opacity: 0.55,
          side: THREE.DoubleSide, depthWrite: false, fog: false }));
      a.position.copy(astre.position);
      a.rotation.set(1.15, 0.3, 0);
      g.add(a);
    }
  }
  return g;
}

// --- LE STADE NEON (cyberpunk) ------------------------------------------------------

/**
 * La ville autour du Stade Neon : des tours aux fenetres allumees, fondues en UN seul
 * maillage (un appel de dessin pour cent tours), des panneaux holographiques au-dessus
 * des tribunes, et la pluie.
 */
export function villeNeon(hasard: () => number, rS: number) {
  const fenetres = texteCanvas((c, w, h) => {
    c.fillStyle = '#05040a'; c.fillRect(0, 0, w, h);
    const teintes = ['#ffd9a0', '#00e5ff', '#00e5ff', '#ff2bd6', '#ff2bd6', '#b04dff', '#b0c8ff'];   // plus de neon que de lampes
    for (let y = 2; y < h - 4; y += 6) for (let x = 2; x < w - 3; x += 5) {
      if (hasard() > 0.36) continue;
      c.globalAlpha = 0.35 + hasard() * 0.65;
      c.fillStyle = teintes[(hasard() * teintes.length) | 0]; c.fillRect(x, y, 3, 3);
    }
    c.globalAlpha = 1;
  }, 64, 128);
  fenetres.wrapS = fenetres.wrapT = THREE.RepeatWrapping;
  fenetres.magFilter = THREE.NearestFilter;
  const tours: THREE.BufferGeometry[] = [], proches: number[][] = [];
  for (let i = 0; i < 110; i++) {
    const a = (i / 110) * Math.PI * 2 + hasard() * 0.04;
    const r = rS + 80 + hasard() * 150;   // au-dela du survol (orbite 125 x 95 m) : il traversait les premieres
    // le coin de l'ecran geant, au bout de la ligne droite, reste libre
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3 && r < rS + 130) continue;
    const x = 44 + Math.cos(a) * r * 1.25, y = -R_CORDE + Math.sin(a) * r;
    const h = 40 + hasard() * (r > rS + 140 ? 220 : 120), lx = 14 + hasard() * 22, ly = 14 + hasard() * 22;
    const g = new THREE.BoxGeometry(lx, ly, h).toNonIndexed();
    const uv = g.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * Math.max(lx, ly) / 8, uv.getY(k) * h / 16);
    g.rotateZ(hasard() * Math.PI);
    g.translate(x, y, h / 2);
    tours.push(g);
    if (r < rS + 130) proches.push([x, y, h, Math.max(lx, ly)]);
  }
  const ville = new THREE.Mesh(mergeGeometries(tours)!, new THREE.MeshBasicMaterial({ map: fenetres }));
  stade!.add(ville);
  // LES HOLOGRAMMES : des glyphes inventes sur une couleur vive, qui gresillent (rendre)
  const couleurs = ['#ff2bd6', '#00e5ff', '#8c3cff', '#ffdc1e'];
  for (let i = 0; i < 10; i++) {
    const col = couleurs[i % couleurs.length];
    const t = texteCanvas((c, w, h) => {
      c.fillStyle = col; c.globalAlpha = 0.16; c.fillRect(0, 0, w, h); c.globalAlpha = 1;
      for (let gy = 10; gy < h - 10; gy += 22) for (let gx = 10; gx < w - 12; gx += 14) {
        if (hasard() < 0.15) continue;
        for (let k = 0; k < 9; k++) if (hasard() < 0.55) c.fillRect(gx + (k % 3) * 3, gy + ((k / 3) | 0) * 5, 3, 4);
      }
      c.fillRect(0, 0, w, 3); c.fillRect(0, h - 3, w, 3);
    }, 256, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), new THREE.MeshBasicMaterial({ map: t, transparent: true,
      opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    const a = (i + 0.5) / 10 * Math.PI * 2;
    m.position.set(44 + Math.cos(a) * (rS + 40) * 1.25, -R_CORDE + Math.sin(a) * (rS + 40), 26 + (i % 3) * 7);
    m.lookAt(44, -R_CORDE, 12);
    stade!.add(m);
    hologrammes.push(m);
  }
  // PLUS CYBERPUNK (« accentue le cote cyberpunk », 22/10) : aux tours proches, des enseignes
  // verticales ; dans le ciel, la circulation des vehicules volants. (La grille de neon au sol
  // est retiree : « c'est trop, accentue au niveau des couleurs ».)
  const teintesEns = ['#ff2bd6', '#00e5ff', '#ffdc1e', '#ff4d4d', '#8c3cff'];
  proches.slice(0, 26).forEach(([x, y, h, l], i) => {
    const col = teintesEns[i % teintesEns.length];
    const t = texteCanvas((c, w, hh) => {
      c.fillStyle = '#05040a'; c.fillRect(0, 0, w, hh);
      c.strokeStyle = col; c.lineWidth = 3; c.strokeRect(3, 3, w - 6, hh - 6);
      c.fillStyle = col;
      // des glyphes inventes, en colonne, comme des katakana de neon
      for (let gy = 14; gy < hh - 16; gy += 26) for (let k = 0; k < 9; k++) if (hasard() < 0.6) c.fillRect(12 + (k % 3) * 6, gy + ((k / 3) | 0) * 7, 5, 5);
    }, 40, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 20), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, fog: false }));
    const a = Math.atan2(-R_CORDE - y, 44 - x);
    m.position.set(x + Math.cos(a) * (l / 2 + 0.6), y + Math.sin(a) * (l / 2 + 0.6), Math.min(h - 12, 18 + (i % 4) * 9));
    m.rotation.set(Math.PI / 2, 0, 0); m.rotateY(a + Math.PI / 2);
    stade!.add(m);
  });
  const feu = texteCanvas((c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, 32, 32);
  const volants = Array.from({ length: 14 }, (_, i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: feu, color: i % 3 ? 0xff3355 : 0xd8f4ff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.scale.setScalar(2.6); stade!.add(sp);
    return { sp, r: rS + 60 + hasard() * 120, h: 45 + hasard() * 70, v: (0.03 + hasard() * 0.04) * (i % 2 ? 1 : -1), a0: hasard() * 6.3 };
  });
  pubAnim.push(t => {
    for (const o of volants) {
      const a = o.a0 + t * o.v;
      o.sp.position.set(44 + Math.cos(a) * o.r * 1.25, -R_CORDE + Math.sin(a) * o.r, o.h + Math.sin(t * 0.7 + o.a0) * 3);
    }
  });
  // LA PLUIE : des traits qui tombent autour de la camera (rendre la fait descendre)
  // chaque goutte deux fois, a trente metres d'ecart : la descente boucle sans saut
  const n = 800, pts = new Float32Array(n * 12);
  for (let i = 0; i < n; i++) {
    const x = (hasard() - 0.5) * 70, y = (hasard() - 0.5) * 70, z = hasard() * 30;
    pts.set([x, y, z, x + 0.12, y + 0.08, z - 0.9, x, y, z + 30, x + 0.12, y + 0.08, z + 29.1], i * 12);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  pluie = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xa8b8ff, transparent: true, opacity: 0.35, depthWrite: false }));
  pluie.frustumCulled = false;
  if (!SURVOL) scene.add(pluie);
}

// --- LES PIECES DE CHAQUE STADE ------------------------------------------------
//
// Celles des images 2D, aux memes places : le plan de decors-stades.js (PLAN, lieu)
// dit quelle piece va ou et a partir de quelle etape ; tools/blender/stades_3d_glb.py
// les exporte en GLB, construites par les memes fonctions Blender que leurs images.
// Une piece pas encore chargee n'est pas posee ; son arrivee refait le stade.
const pieces3D = new Map<string, THREE.Object3D | null>();
const PIECES_MOBILES = new Set(['halloween/maison', 'halloween/reverbere', 'halloween/poubelles', 'halloween/porte',
  'montreuil/cabine', 'montreuil/mat']); // public/modeles/stades-mobile/
export function pieceDuStade(cleDemandee: string): THREE.Object3D | null {
  // `cle@leger` : la piece legere, quel que soit le palier (la ruelle du molosse garde les deux)
  const leger = cleDemandee.endsWith('@leger'), cle = leger ? cleDemandee.slice(0, -6) : cleDemandee;
  if (!pieces3D.has(cleDemandee)) {
    pieces3D.set(cleDemandee, null);
    const base = (import.meta as any).env?.BASE_URL || '/';
    const l = chargeurGLTF();
    // en ULTRA, la piece pleine (tools/blender/stades_3d_glb.py --ultra), sinon la legere — et
    // la legere si la pleine manque (la copie GitHub du site ne les porte pas : son plafond)
    const charger = (dossier: string) => l.loadAsync(base + 'modeles/' + dossier + '/' + cle + '.glb');
    // LES VERSIONS MOBILES (10/11, tools/assets/version-mobile.mjs) : les six pieces Tripo de
    // ~225 000 triangles et 6-7 Mo, simplifiees a 60 000 (1,3-1,4 Mo), silhouette et facettes
    // gardees — hors ULTRA, a la place de la pleine (ruelle) ou de la legere a 30 000 (Montreuil).
    // La ruelle du molosse prenait la pleine a tous les paliers (« la qualite la plus haute », 23/10) :
    // elle la garde en ULTRA ; ses maisons lointaines restent les legeres (`@leger`).
    const mobile = !leger && !ULTRA && PIECES_MOBILES.has(cle);
    const plein = !leger && !mobile && (ULTRA || /^halloween\//.test(cle));
    (mobile ? charger('stades-mobile').catch(() => charger('stades'))
      : plein ? charger('stades-ultra').catch(() => charger('stades')) : charger('stades')).then(g => {
      // le decor recoit l'ombre des coureurs mais n'en projette pas : sa propre ombre n'existait que
      // dans les 28 m autour du joueur, et apparaissait puis disparaissait devant lui (Plage Paradis, 23/10)
      g.scene.traverse((o: any) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      pieces3D.set(cleDemandee, g.scene);
      refaireLeStade();
    }).catch(() => { /* la piece manque : le stade reste sans elle */ });
  }
  return pieces3D.get(cleDemandee) || null;
}
export function poserLesPieces(T: any, stadeCle: string | null, etape: number) {
  const D = (globalThis as any).DecorsStades;
  const plan = stadeCle && D && D.PLAN && D.PLAN[stadeCle];
  if (!plan || !D.lieu) return;
  for (const e of plan) {
    if (etape < (e.des || 0)) continue;
    const L = D.lieu(T, e.l);
    if (!L) continue;
    const modele = pieceDuStade(stadeCle + '/' + e.p);
    if (!modele) continue;
    const o = modele.clone();
    const q = ici([L.X, L.Y]);
    o.position.set(q[0], q[1], 0);
    o.rotation.z = capIci((L.yaw + (e.rot || 0)) * Math.PI / 180);
    stade!.add(o);
  }
}
