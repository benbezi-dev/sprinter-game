/* ---------------------------------------------------------------------------
   JUMPER — la longueur et le triple, en trois dimensions
   ---------------------------------------------------------------------------
   LA TELEVISION NE MONTRE PAS UN SAUT D'EN HAUT. Elle le suit de cote, au
   teleobjectif, le decor qui defile derriere un athlete qui reste au meme
   endroit de l'image — c'est ainsi qu'on voit la longueur. Et le triple saut,
   elle le prend souvent dans l'axe, du bout de la fosse : l'athlete arrive
   vers nous, ses trois bonds grandissent, le sable explose au premier plan.

   L'isometrie du moteur ne sait faire ni l'un ni l'autre. Cette scene les
   fait, par-dessus le canvas du moteur, pendant un concours de longueur ou de
   triple saut. Elle ne decide de rien : le jeu du saut reste celui de
   longueur-course.js, et l'athlete reste celui du moteur — ses angles, sa
   foulee, son ciseau et son ramene viennent de SprinterCore.pose(), membre par
   membre, avec les memes troncs de cone mesures sur Blender. Ce fichier ne
   fait que regarder.

   LE DECOR NE BOUGE PAS. Il est construit une fois, dans les coordonnees du
   sautoir (la piste le long de x), et seule la camera se deplace, suivie par
   un ressort amorti : pas de zoom qui respire, pas de recadrage a chaque
   phase.

   Axes : X le long de la piste d'elan (vers la fosse), Y vers le haut, Z en
   travers (0 sur l'axe de la piste, les tribunes vers -Z).
--------------------------------------------------------------------------- */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SprinterApp, SprinterCore } from './engine';
import { etatSaut, sauteurLocal, PISTE_Y } from './longueur-course.js';
import { FOSSE, PLANCHE, PLASTICINE, PISTE_ELAN } from './longueur.js';

/* ------------------------------------------------------------ couleurs */

const COULEURS = {
  ciel: 0x8ecdf5, horizon: 0xdcefff,
  pelouse: 0x4fae4a, pelouseClaire: 0x5fc257,
  tartan: 0xc9573f, tartanElan: 0xd2603f, ligne: 0xffffff,
  sable: 0xecd6a4, bordure: 0xf4f1ea,
  planche: 0xffffff, plancheInactive: 0xd9d9d9, plasticine: 0x9ad3a0,
  tribune: 0x2f6db5, tribuneMarche: 0x3b82d0, toit: 0xeef2f7,
  pub: [0xffcc00, 0xe63946, 0x1d4ed8, 0x10b981, 0xf97316, 0x7c3aed],
};

/* --------------------------------------------------------- outils */

const lisse = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

/**
 * La couche de finition est-elle a l'ULTRA (voir rendu-premium.js) ?
 *
 * Le decor la lit une fois, a la construction de la scene : la definition de
 * la toile, la carte d'ombre, le ciel et les projecteurs ne se refont pas en
 * cours de concours. Le corps de l'athlete, lui, la relit a chaque image
 * (creerCorps) : c'est lui qui coute, et c'est donc lui qui doit pouvoir
 * redescendre en route.
 */
function aLUltra() {
  const P = globalThis.RenduPremium;
  return !!(P && P.ULTRA !== undefined && P.niveau >= P.ULTRA);
}

/** Une texture de bruit, pour que le sable et la pelouse ne soient pas des aplats. */
function textureBruit(base, ecart, taille = 128, rayures = 0) {
  const c = document.createElement('canvas');
  c.width = c.height = taille;
  const g = c.getContext('2d');
  const col = new THREE.Color(base);
  const img = g.createImageData(taille, taille);
  for (let i = 0; i < taille * taille; i++) {
    const y = Math.floor(i / taille);
    const bande = rayures ? (Math.floor(y / (taille / rayures)) % 2 ? 0.04 : -0.02) : 0;
    const n = (Math.random() - 0.5) * ecart + bande;
    img.data[i * 4] = Math.max(0, Math.min(255, (col.r + n) * 255));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, (col.g + n) * 255));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, (col.b + n) * 255));
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Un texte sur un panneau, pour les reperes de distance et les lignes. */
function textureTexte(texte, fond, encre, l = 256, h = 128) {
  const c = document.createElement('canvas');
  c.width = l; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = fond; g.fillRect(0, 0, l, h);
  g.fillStyle = encre;
  g.font = `900 ${Math.round(h * 0.62)}px system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texte, l / 2, h / 2 + h * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function boite(l, h, p, couleur, x, y, z, ombre = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(l, h, p),
    new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.85 }));
  m.position.set(x, y, z);
  m.castShadow = ombre; m.receiveShadow = true;
  return m;
}

function sol(l, p, materiau, x, z, y = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(l, p), materiau);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------ le stade */

const PEAUX = ['#f1c7a5', '#e0a882', '#c68a62', '#9a6440', '#6e4428', '#4a2c1a'];
const HABITS = ['#f8fafc', '#e11d48', '#2563eb', '#16a34a', '#facc15', '#0f172a', '#f97316',
  '#7c3aed', '#94a3b8', '#0ea5e9', '#be123c', '#fde68a', '#1e3a8a', '#e5e7eb'];

/**
 * La foule, peinte : des rangees de sieges bleus, et sur presque chacun un
 * spectateur — un buste de couleur, une tete, parfois des bras leves. Un
 * leger flou, parce que c'est ce que fait le teleobjectif, et parce qu'un
 * damier net de milliers de points se lit comme du bruit.
 */
function textureFoule(rangs) {
  const place = 32, rang = 40, colonnes = 48;
  const c = document.createElement('canvas');
  c.width = place * colonnes; c.height = rang * rangs;
  const g = c.getContext('2d');
  for (let r = 0; r < rangs; r++) {
    const y0 = r * rang;
    // la marche et le dossier des sieges
    g.fillStyle = r % 2 ? '#27508f' : '#2c5aa0'; g.fillRect(0, y0, c.width, rang);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y0 + rang - 6, c.width, 6);
    for (let k = 0; k < colonnes; k++) {
      const x0 = k * place + (r % 2 ? place / 2 : 0);
      // les escaliers : une colonne vide, grise, tous les seize sieges
      if (k % 16 === 7) { g.fillStyle = '#9aa3ad'; g.fillRect(k * place, y0, place, rang); continue; }
      if (Math.random() < 0.1) continue;
      const habit = HABITS[Math.floor(Math.random() * HABITS.length)];
      const peau = PEAUX[Math.floor(Math.random() * PEAUX.length)];
      const cx = x0 + place / 2 + (Math.random() - 0.5) * 5;
      g.fillStyle = habit;
      g.beginPath(); g.ellipse(cx, y0 + rang * 0.78, place * 0.36, rang * 0.34, 0, Math.PI, 0); g.fill();
      g.fillRect(cx - place * 0.36, y0 + rang * 0.76, place * 0.72, rang * 0.24);
      if (Math.random() < 0.08) {
        g.strokeStyle = peau; g.lineWidth = 4;
        g.beginPath(); g.moveTo(cx - 8, y0 + rang * 0.6); g.lineTo(cx - 12, y0 + rang * 0.05);
        g.moveTo(cx + 8, y0 + rang * 0.6); g.lineTo(cx + 12, y0 + rang * 0.05); g.stroke();
      }
      g.fillStyle = peau;
      g.beginPath(); g.arc(cx, y0 + rang * 0.36, place * 0.2, 0, Math.PI * 2); g.fill();
      if (Math.random() < 0.5) {
        g.fillStyle = Math.random() < 0.7 ? '#1c1410' : '#caa472';
        g.beginPath(); g.arc(cx, y0 + rang * 0.3, place * 0.2, Math.PI, 0); g.fill();
      }
    }
  }
  // le flou du teleobjectif
  const f = document.createElement('canvas');
  f.width = c.width; f.height = c.height;
  const gf = f.getContext('2d');
  gf.filter = 'blur(1.4px)';
  gf.drawImage(c, 0, 0);
  const t = new THREE.CanvasTexture(f);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { texture: t, largeur: colonnes * 0.55 };
}

/** Le bandeau lumineux au pied de la tribune : des marques, pas des aplats. */
function texturePub() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 96;
  const g = c.getContext('2d');
  const marques = [['JUMPER', '#0b1d12', '#2bff6e'], ['SPRINTER', '#111827', '#facc15'],
    ['ZEZE', '#1d4ed8', '#ffffff'], ['HURDLERS', '#0b1220', '#60a5fa'], ['JUMPER', '#2bff6e', '#07140b'],
    ['ATHLÉ', '#dc2626', '#ffffff'], ['THROWER', '#160f0c', '#fb923c'], ['SPRINTER', '#facc15', '#111827']];
  const l = c.width / marques.length;
  marques.forEach(([m, fond, encre], i) => {
    g.fillStyle = fond; g.fillRect(i * l, 0, l, c.height);
    g.fillStyle = encre; g.font = '900 50px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(m, i * l + l / 2, c.height / 2 + 3, l * 0.8);
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textureEcran() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 224;
  const g = c.getContext('2d');
  const d = g.createLinearGradient(0, 0, 0, c.height);
  d.addColorStop(0, '#0b3d1f'); d.addColorStop(1, '#03140a');
  g.fillStyle = d; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#2bff6e'; g.font = '900 96px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('JUMPER', c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Une tribune couverte, face a +Z, l'origine au pied de son mur : le mur de
 * beton et son bandeau lumineux, la pente des gradins et sa foule, le toit en
 * porte-a-faux et ses poteaux, a l'arriere.
 */
function tribune(longueur, rangs) {
  const g = new THREE.Group();
  const marche = 0.8, haut = 0.42, mur = 2.2;
  // le mur de beton, et le bandeau de publicite en haut
  g.add(boite(longueur, mur, 0.4, 0xb8bec6, 0, mur / 2, 0, false));
  const pub = texturePub();
  // un panneau de sept metres par marque, comme au bord d'une piste
  pub.repeat.set(longueur / 56, 1);
  const bandeau = new THREE.Mesh(new THREE.PlaneGeometry(longueur, 0.9),
    new THREE.MeshBasicMaterial({ map: pub }));
  bandeau.position.set(0, mur - 0.55, 0.21);
  g.add(bandeau);
  // la pente des gradins, peinte
  const { texture, largeur } = textureFoule(rangs);
  texture.repeat.set(longueur / largeur, 1);
  const profondeur = rangs * marche, hauteur = rangs * haut;
  const pente = new THREE.Mesh(new THREE.PlaneGeometry(longueur, Math.hypot(profondeur, hauteur)),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 }));
  pente.rotation.x = -Math.atan2(profondeur, hauteur);
  pente.position.set(0, mur + hauteur / 2, -0.2 - profondeur / 2);
  g.add(pente);
  // les flancs et le fond de la tribune
  g.add(boite(longueur, hauteur + mur + 7, 0.5, 0x8d96a1, 0, (hauteur + mur + 7) / 2, -profondeur - 0.6, false));
  // le toit en porte-a-faux, blanc dessous, et ses poteaux a l'arriere
  const toitY = mur + hauteur + 5.5;
  const toit = boite(longueur, 0.35, profondeur + 3.5, 0xf3f4f6, 0, toitY, -profondeur / 2 + 0.8, false);
  toit.rotation.x = -0.08;
  g.add(toit);
  g.add(boite(longueur, 0.9, 0.25, 0x6b7280, 0, toitY - 0.35, 2.4, false));
  for (let x = -longueur / 2 + 4; x < longueur / 2; x += 18) {
    g.add(boite(0.5, toitY, 0.5, 0x9ca3af, x, toitY / 2, -profondeur - 0.2, false));
  }
  return g;
}

/** Un mat d'eclairage : un fut, et une grille de projecteurs en haut. */
function mat(x, z) {
  const g = new THREE.Group();
  g.add(boite(0.7, 34, 0.7, 0xaeb4bb, 0, 17, 0, false));
  const tete = boite(5, 3, 0.5, 0x374151, 0, 35, 0, false);
  g.add(tete);
  const cotes = aLUltra() ? 32 : 12;
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.42, cotes), new THREE.MeshBasicMaterial({ color: 0xfffbe6 }));
    p.position.set(-1.8 + i * 1.2, 34 + k * 0.95, 0.27);
    g.add(p);
  }
  g.position.set(x, 0, z);
  g.lookAt(x * 0.2, 0, 0);
  return g;
}

/** Le ciel : un degrade, et quelques nuages peints, tres loin. */
function ciel(scene) {
  // Le degrade se lit sur la position interpolee d'un sommet a l'autre : a
  // l'ULTRA, deux fois plus de fuseaux, et ses marches disparaissent.
  const geo = aLUltra() ? new THREE.SphereGeometry(500, 64, 32) : new THREE.SphereGeometry(500, 32, 16);
  const matCiel = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { haut: { value: new THREE.Color(0x3d8fe0) }, bas: { value: new THREE.Color(0xd6ecff) } },
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 haut; uniform vec3 bas; varying vec3 p; void main(){ float h = clamp(p.y*1.6, 0.0, 1.0); gl_FragColor = vec4(mix(bas, haut, pow(h, 0.7)), 1.0); }',
  });
  const s = new THREE.Mesh(geo, matCiel);
  s.renderOrder = -1;
  scene.add(s);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 18 + Math.random() * 26;
    const d = g.createRadialGradient(x, y, 0, x, y, r);
    d.addColorStop(0, 'rgba(255,255,255,0.9)'); d.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = d; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 14; i++) {
    const n = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false, opacity: 0.85 }));
    const a = Math.random() * Math.PI * 2, d = 300 + Math.random() * 120;
    n.position.set(Math.cos(a) * d, 60 + Math.random() * 90, Math.sin(a) * d);
    n.scale.set(120 + Math.random() * 80, 45 + Math.random() * 25, 1);
    scene.add(n);
  }
  return s;
}

/* ------------------------------------------------------------ le decor */

function construireDecor(scene, e) {
  const fosseFin = e.fosseX + (FOSSE.fond - FOSSE.debut);
  const debut = Math.min(...e.planches.map(p => p.x)) - PISTE_ELAN.recommandee - 10;
  const centre = (debut + fosseFin) / 2;
  const long = fosseFin - debut + 260;

  // La pelouse, tondue en bandes comme dans un stade.
  const herbe = textureBruit(COULEURS.pelouse, 0.08, 256, 8);
  herbe.repeat.set(long / 12, 40 / 12);
  scene.add(sol(long, 120, new THREE.MeshStandardMaterial({ map: herbe, roughness: 1 }), centre, -20, -0.01));

  // L'aire d'elan en tartan, et la piste d'elan qui la traverse, bordee de blanc.
  const tartan = textureBruit(COULEURS.tartan, 0.06, 128);
  tartan.repeat.set(long / 4, 1);
  scene.add(sol(fosseFin - debut + 6, 3.4, new THREE.MeshStandardMaterial({ map: tartan, roughness: 0.95 }),
    (debut + fosseFin) / 2, 0, 0));
  const larg = PISTE_ELAN.largeur;
  for (const z of [-larg / 2, larg / 2]) {
    scene.add(sol(e.fosseX - debut, 0.05, new THREE.MeshBasicMaterial({ color: COULEURS.ligne }),
      (debut + e.fosseX) / 2, z, 0.003));
  }

  // La piste du stade, huit couloirs, derriere la piste d'elan.
  const couloirs = 8, lc = 1.22, z0 = -4.5;
  const piste = textureBruit(COULEURS.tartan, 0.05, 128);
  piste.repeat.set(long / 4, 3);
  scene.add(sol(long, couloirs * lc + 1, new THREE.MeshStandardMaterial({ map: piste, roughness: 0.95 }),
    centre, z0 - couloirs * lc / 2, 0));
  for (let i = 0; i <= couloirs; i++) {
    scene.add(sol(long, 0.05, new THREE.MeshBasicMaterial({ color: COULEURS.ligne }), centre, z0 - i * lc, 0.003));
  }

  // La fosse : un bac de sable a bordure blanche, un rien plus bas que la piste.
  const lf = FOSSE.fond - FOSSE.debut, pf = FOSSE.largeur;
  const sable = textureBruit(COULEURS.sable, 0.10, 256, 24);
  sable.repeat.set(lf / 3, pf / 3);
  const bac = sol(lf, pf, new THREE.MeshStandardMaterial({ map: sable, roughness: 1 }), e.fosseX + lf / 2, 0, 0.004);
  scene.add(bac);
  const b = 0.12;
  scene.add(boite(lf + 2 * b, 0.04, b, COULEURS.bordure, e.fosseX + lf / 2, 0.02, -pf / 2 - b / 2));
  scene.add(boite(lf + 2 * b, 0.04, b, COULEURS.bordure, e.fosseX + lf / 2, 0.02, pf / 2 + b / 2));
  scene.add(boite(b, 0.04, pf, COULEURS.bordure, fosseFin + b / 2, 0.02, 0));

  // Les planches d'appel, et la plasticine devant celle qui sert.
  for (const p of e.planches) {
    scene.add(boite(PLANCHE.largeur, 0.012, PLANCHE.longueur,
      p.actif ? COULEURS.planche : COULEURS.plancheInactive, p.x - PLANCHE.largeur / 2, 0.006, 0, false));
    if (p.actif) {
      scene.add(boite(PLASTICINE.largeur, 0.014, PLANCHE.longueur, COULEURS.plasticine,
        p.x + PLASTICINE.largeur / 2, 0.007, 0, false));
    }
  }

  // Les reperes de distance le long du sable, comme a la television.
  const active = e.planches.find(p => p.actif) || e.planches[0];
  for (let m = Math.ceil(e.fosseX - active.x + 0.5); active.x + m <= fosseFin; m++) {
    const x = active.x + m;
    const panneau = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25),
      new THREE.MeshBasicMaterial({ map: textureTexte(String(m), '#ffffff', '#111827') }));
    panneau.position.set(x, 0.16, pf / 2 + 0.45);
    panneau.rotation.x = -0.35;
    scene.add(panneau);
    scene.add(sol(0.03, 0.25, new THREE.MeshBasicMaterial({ color: 0xffffff }), x, pf / 2 + 0.2, 0.005));
  }

  // LE STADE. Au teleobjectif, la television ne montre pas des spectateurs un
  // par un : elle montre une foule floue, par rangees, derriere un mur de
  // publicite lumineuse. C'est ce qu'on peint (tribune(), plus haut).
  const lt = long * 0.9;
  const cote = tribune(lt, 16);
  cote.position.set(centre, 0, -17.5);
  scene.add(cote);
  // Au bout de la piste d'elan, une seconde tribune : c'est elle qu'on voit
  // derriere l'athlete quand la camera est dans l'axe, au triple saut.
  const bout = tribune(90, 16);
  bout.rotation.y = Math.PI / 2;
  bout.position.set(debut - 45, 0, -10);
  scene.add(bout);
  // Les mats d'eclairage, aux coins, et l'ecran geant.
  for (const x of [centre - lt * 0.42, centre + lt * 0.42]) scene.add(mat(x, -44));
  scene.add(mat(debut - 62, 30), mat(debut - 62, -50));
  const ecran = new THREE.Mesh(new THREE.PlaneGeometry(16, 7),
    new THREE.MeshBasicMaterial({ map: textureEcran() }));
  ecran.position.set(fosseFin + 40, 13, -30);
  ecran.rotation.y = -0.5;
  scene.add(ecran);
  scene.add(boite(16.6, 7.6, 0.6, 0x1f2937, fosseFin + 40.2, 13, -30.3, false).rotateY(-0.5));
  scene.add(boite(0.6, 9.5, 0.6, 0x9ca3af, fosseFin + 40.4, 4.75, -30.6, false));

  return { bac, fosseFin, debut };
}

/* ------------------------------------------------------------ l'athlete */

// Les segments du moteur, dans le repere du corps : x devant, y en travers,
// z vers le haut, en unites du rig. C'est le calcul de personCapsules
// (sprinter-app.js), sans la courbe ni le miroir : on est sur une ligne droite.
function capsulesDe(r) {
  // Le corps de l'ultra (le quatrieme niveau mesure dans Blender) tant que la
  // couche de finition y est ; le niveau pres sinon. Relu a chaque image, pour
  // la meme raison que le maillage (voir creerCorps).
  const parts = SprinterCore.pose(r, aLUltra() ? 3 : undefined);
  const fsh = SprinterCore.fallShape(r.fallAnim);
  const sautW = r.saut ? Math.max(0, Math.min(1, r.saut.w)) : 0;
  const fall = (fsh ? fsh.pitch : 0) -
    (r.drivePitch || 0) * Math.pow(1 - Math.max(0, Math.min(1, r.enBloc || 0)), 2) * (1 - sautW);
  const fc = Math.cos(fall), fs = Math.sin(fall);
  const caps = [];
  for (const [col, pv, ang, off, hf, yaw, bout] of parts) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const yc = Math.cos(yaw), ys = Math.sin(yaw);
    const ends = [];
    for (const zSign of [-1, 1]) {
      const hx = zSign < 0 ? hf[0] : hf[2], hy = zSign < 0 ? hf[1] : hf[3];
      const lx = zSign < 0 || off[3] === undefined ? off[0] : off[3];
      const lz = off[2] + zSign * hf[4];
      let wx = pv[0] + lx * ca - lz * sa;
      let wz = pv[2] + lx * sa + lz * ca;
      let wy = pv[1] + off[1];
      if (yaw) { const t = wx * yc - wy * ys; wy = wx * ys + wy * yc; wx = t; }
      if (Math.abs(fall) > 0.001) { const t = wx * fc - wz * fs; wz = wx * fs + wz * fc; wx = t; }
      if (wz < 0) wz = 0;
      const rm = (hx + hy) * 0.5;
      ends.push((bout & 8) ? [wx, wy, wz, hx, hy] : [wx, wy, wz, rm, rm]);
    }
    let Wx = -ys, Wy = yc, Wz = 0;
    if (Math.abs(fall) > 0.001) { const t = Wx * fc - Wz * fs; Wz = Wx * fs + Wz * fc; Wx = t; }
    caps.push([col, ends[0], ends[1], bout | 0, [Wx, Wy, Wz]]);
  }
  return caps;
}

/**
 * Le corps, en un seul maillage refait a chaque image : un tronc de cone a
 * section elliptique par segment, ferme par une calotte la ou le bout n'est
 * pas enfoui dans le segment voisin.
 *
 * A L'ULTRA, TRENTE-DEUX SOMMETS PAR ANNEAU ET HUIT ANNEAUX PAR CALOTTE, au
 * lieu de seize et quatre : une camera de television s'approche assez de
 * l'athlete pour qu'on compte les facettes d'une cuisse. Et deux fois plus de
 * segments, parce que le corps de l'ultra en porte deux fois plus (le
 * quatrieme niveau de coureur-hd.js) : au plafond d'avant, le maillage
 * s'arretait avant les pieds.
 *
 * LE PALIER SE RELIT A CHAQUE IMAGE. Les tampons sont dimensionnes une fois,
 * pour l'ultra si la scene s'ouvre a l'ultra ; mais si la couche de finition
 * le lache en plein concours — un telephone qui ne tient pas la cadence —, le
 * corps redescend a seize sommets des l'image suivante au lieu de garder
 * jusqu'a la fin un maillage que l'appareil ne sait pas porter.
 */
function creerCorps() {
  const depart = aLUltra();
  const MAX = (depart ? 320 : 160) * ((depart ? 32 : 16) * (2 + 2 * (depart ? 8 : 4)) + 2);
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3);
  const idx = new Uint32Array(MAX * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(new THREE.BufferAttribute(idx, 1).setUsage(THREE.DynamicDrawUsage));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.55, metalness: 0.02,
  }));
  mesh.castShadow = true;
  mesh.frustumCulled = false;

  const c = new THREE.Color();
  const a = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3(), W = new THREE.Vector3();

  let niAvant = 0;
  function maj(caps, k) {
    const ultra = depart && aLUltra();
    const SEG = ultra ? 32 : 16;          // sommets par anneau
    const CALOTTE = ultra ? 8 : 4;        // anneaux par calotte
    let nv = 0, ni = 0;
    const anneau = (cx, cy, cz, rx, ry, dir) => {
      const base = nv;
      for (let s = 0; s < SEG; s++) {
        const t = (s / SEG) * Math.PI * 2, co = Math.cos(t), si = Math.sin(t);
        const i = nv * 3;
        // corps : x devant, y en travers, z en haut  ->  scene : X, Y=z, Z=y
        const px = cx + (u.x * co * rx + v.x * si * ry) + dir.x;
        const py = cy + (u.y * co * rx + v.y * si * ry) + dir.y;
        const pz = cz + (u.z * co * rx + v.z * si * ry) + dir.z;
        pos[i] = px * k; pos[i + 1] = pz * k; pos[i + 2] = py * k;
        col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
        nv++;
      }
      return base;
    };
    const relier = (b0, b1) => {
      for (let s = 0; s < SEG; s++) {
        const s2 = (s + 1) % SEG;
        idx[ni++] = b0 + s; idx[ni++] = b1 + s; idx[ni++] = b1 + s2;
        idx[ni++] = b0 + s; idx[ni++] = b1 + s2; idx[ni++] = b0 + s2;
      }
    };
    const zero = new THREE.Vector3();
    for (const [couleur, e0, e1, bout, w] of caps) {
      if (nv + SEG * (2 + 2 * CALOTTE) >= MAX) break;
      if (Array.isArray(couleur)) c.setRGB(couleur[0] / 255, couleur[1] / 255, couleur[2] / 255, THREE.SRGBColorSpace);
      else c.set(couleur || '#888');
      a.set(e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2]);
      const L = a.length();
      if (L < 1e-5) a.set(0, 0, 1); else a.multiplyScalar(1 / L);
      W.set(w[0], w[1], w[2]);
      u.crossVectors(W, a);
      if (u.lengthSq() < 1e-8) u.set(1, 0, 0);
      u.normalize();
      v.crossVectors(a, u).normalize();
      const r0 = anneau(e0[0], e0[1], e0[2], e0[3], e0[4], zero);
      const r1 = anneau(e1[0], e1[1], e1[2], e1[3], e1[4], zero);
      relier(r0, r1);
      // Les calottes : un bout enfoui (bits 2 et 4) reste ouvert, il est
      // dans le segment voisin ; les autres s'arrondissent.
      const calotte = (e, sens, anneau0) => {
        let prec = anneau0;
        for (let q = 1; q <= CALOTTE; q++) {
          const ang = (q / (CALOTTE + 1)) * Math.PI / 2;
          const f = Math.cos(ang), h = Math.sin(ang) * Math.min(e[3], e[4]);
          const d = new THREE.Vector3(a.x * h * sens, a.y * h * sens, a.z * h * sens);
          const r = anneau(e[0], e[1], e[2], e[3] * f, e[4] * f, d);
          if (sens > 0) relier(prec, r); else relier(r, prec);
          prec = r;
        }
        const i = nv * 3, h = Math.min(e[3], e[4]) * sens;
        const px = e[0] + a.x * h, py = e[1] + a.y * h, pz = e[2] + a.z * h;
        pos[i] = px * k; pos[i + 1] = pz * k; pos[i + 2] = py * k;
        col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
        const pole = nv++;
        for (let s = 0; s < SEG; s++) {
          const s2 = (s + 1) % SEG;
          if (sens > 0) { idx[ni++] = prec + s; idx[ni++] = pole; idx[ni++] = prec + s2; }
          else { idx[ni++] = prec + s; idx[ni++] = prec + s2; idx[ni++] = pole; }
        }
      };
      if (!(bout & 2)) calotte(e0, -1, r0);
      if (!(bout & 4)) calotte(e1, 1, r1);
    }
    // Les indices d'une image plus chargee ne doivent pas peser sur les normales.
    if (ni < niAvant) idx.fill(0, ni, niAvant);
    niAvant = ni;
    geo.setDrawRange(0, ni);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.index.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  return { mesh, maj };
}

/* ------------------------------------------------------------ le sable */

function creerGerbe(scene) {
  const N = 180;
  const pos = new Float32Array(N * 3);
  const vit = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xe2c68b, size: 0.07, transparent: true, opacity: 0.95, depthWrite: false,
  }));
  pts.visible = false;
  pts.frustumCulled = false;
  scene.add(pts);
  let cle = null, age = 0;
  return {
    maj(gerbe, dt) {
      if (gerbe && gerbe !== cle) {
        cle = gerbe; age = 0;
        const f = gerbe.force || 1;
        for (let i = 0; i < N; i++) {
          pos[i * 3] = gerbe.x + (Math.random() - 0.3) * 0.4;
          pos[i * 3 + 1] = 0.02;
          pos[i * 3 + 2] = (gerbe.y - PISTE_Y) + (Math.random() - 0.5) * 0.4;
          vit[i * 3] = (1.0 + Math.random() * 2.6) * f;
          vit[i * 3 + 1] = (1.2 + Math.random() * 2.6) * f;
          vit[i * 3 + 2] = (Math.random() - 0.5) * 2.4 * f;
        }
        pts.visible = true;
      }
      if (!pts.visible) return;
      age += dt;
      for (let i = 0; i < N; i++) {
        if (pos[i * 3 + 1] <= 0.01 && age > 0.05) continue;
        vit[i * 3 + 1] -= 9.81 * dt;
        pos[i * 3] += vit[i * 3] * dt;
        pos[i * 3 + 1] = Math.max(0.01, pos[i * 3 + 1] + vit[i * 3 + 1] * dt);
        pos[i * 3 + 2] += vit[i * 3 + 2] * dt;
      }
      pts.material.opacity = Math.max(0, 0.95 - Math.max(0, age - 0.6) * 1.2);
      geo.attributes.position.needsUpdate = true;
      if (age > 1.5) { pts.visible = false; cle = null; }
    },
  };
}

/** Les empreintes et les lignes de la television, posees sur le sable. */
function creerMarques(scene) {
  const groupe = new THREE.Group();
  scene.add(groupe);
  // L'empreinte dans le sable se voit de pres, au ralenti de la mesure.
  const empreinte = new THREE.Mesh(new THREE.CircleGeometry(1, aLUltra() ? 64 : 24),
    new THREE.MeshStandardMaterial({ color: 0xb89a62, roughness: 1, transparent: true, opacity: 0.85 }));
  empreinte.rotation.x = -Math.PI / 2;
  empreinte.visible = false;
  groupe.add(empreinte);
  let lignesCle = null;
  const lignes = new THREE.Group();
  groupe.add(lignes);
  return {
    maj(e) {
      if (e.empreinte) {
        empreinte.visible = true;
        empreinte.position.set(e.empreinte.x + 0.25, 0.008, e.empreinte.y - PISTE_Y);
        empreinte.scale.set(0.55, 0.28, 1);
      } else empreinte.visible = false;
      if (e.lignes !== lignesCle) {
        lignesCle = e.lignes;
        lignes.clear();
        const active = e.planches.find(p => p.actif) || e.planches[0];
        for (const l of e.lignes || []) {
          const x = active.x + l.m;
          const col = new THREE.Color(); col.setStyle(l.couleur);
          const trait = sol(0.05, FOSSE.largeur, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9 }), x, 0, 0.012);
          lignes.add(trait);
          const panneau = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3),
            new THREE.MeshBasicMaterial({ map: textureTexte(l.texte, '#' + col.getHexString(), '#0b0f19', 384, 128), transparent: true }));
          panneau.position.set(x, 0.35, -FOSSE.largeur / 2 - 0.5);
          lignes.add(panneau);
        }
      }
    },
  };
}

/* ------------------------------------------------------------ la camera */

/**
 * Un ressort amorti critique : la camera rejoint sa cible sans la depasser,
 * et sans a-coup quand la cible saute d'une phase a l'autre.
 *
 * On l'applique a l'AVANCE de la camera sur l'athlete, pas a sa position : un
 * ressort qui suivrait un athlete lance a onze metres par seconde prendrait
 * sept metres de retard, et le sortirait du cadre.
 */
function ressort(raideur) {
  let x = null, v = 0;
  return (cible, dt) => {
    if (x === null) { x = cible; v = 0; return x; }
    const w = raideur, f = 1 + 2 * dt * w + dt * dt * w * w;
    const a = (v - w * w * dt * (x - cible)) / f;
    x = (x + dt * a);
    v = a;
    return x;
  };
}

/* ------------------------------------------------------------ la scene */

/**
 * Monter la scene par-dessus le canvas du moteur. Rend `detruire()`.
 * Sans WebGL, ne fait rien : l'isometrie du moteur reste visible.
 */
export function monterScene3D() {
  const G = SprinterApp.G;
  const hote = G.cv && G.cv.parentElement;
  if (!hote) return () => {};
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch {
    return () => {};
  }
  const toile = renderer.domElement;
  toile.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block;';
  hote.appendChild(toile);
  // LA DEFINITION DU CONCOURS SE FIXE ICI, une fois : celle de la couche de
  // finition (trois pixels par point a l'ULTRA, deux ailleurs). Le corps, lui,
  // suit le palier a chaque image (voir creerCorps).
  const Prem = globalThis.RenduPremium;
  const ultra = aLUltra();
  renderer.setPixelRatio(Prem && Prem.dpr ? Prem.dpr() : Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COULEURS.ciel);
  ciel(scene);
  // La brume d'un apres-midi : les tribunes lointaines perdent du contraste,
  // l'athlete, lui, reste net.
  scene.fog = new THREE.Fog(0xcfe6f7, 70, 300);
  // Des reflets doux sur la peau et le maillot, sans aucune image a charger.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.35;
  scene.add(new THREE.HemisphereLight(0xdff1ff, 0x5a8f3c, 0.7));
  const soleil = new THREE.DirectionalLight(0xfff1dc, 2.6);
  soleil.castShadow = true;
  // L'ombre d'un maillage plus fin merite une carte plus fine : a 2048, les
  // doigts d'un athlete ultra projetaient la meme tache que le poing.
  soleil.shadow.mapSize.set(ultra ? 4096 : 2048, ultra ? 4096 : 2048);
  const sc = soleil.shadow.camera;
  sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 1; sc.far = 60;
  soleil.shadow.bias = -0.0004;
  soleil.shadow.normalBias = 0.02;
  scene.add(soleil, soleil.target);
  // La lumiere de contour, de derriere : elle detache l'athlete des tribunes,
  // comme les projecteurs d'un stade televise.
  const contour = new THREE.DirectionalLight(0xffffff, 1.3);
  scene.add(contour, contour.target);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 600);
  const corps = creerCorps();
  scene.add(corps.mesh);
  const gerbe = creerGerbe(scene);
  const marques = creerMarques(scene);

  let decor = null, decorCle = null;
  const suitX = ressort(3.2), suitY = ressort(3.2);

  function taille() {
    const l = hote.clientWidth || window.innerWidth, h = hote.clientHeight || window.innerHeight;
    renderer.setSize(l, h, false);
    camera.aspect = l / Math.max(1, h);
  }
  taille();
  const obs = new ResizeObserver(taille);
  obs.observe(hote);

  let dernier = performance.now(), id = 0, vivant = true;
  function image(t) {
    if (!vivant) return;
    id = requestAnimationFrame(image);
    const dt = Math.min(0.05, Math.max(0, (t - dernier) / 1000));
    dernier = t;
    const e = etatSaut();
    const ou = sauteurLocal();
    const j = G.player;
    if (!e || !ou || !j) { toile.style.visibility = 'hidden'; return; }
    toile.style.visibility = 'visible';
    // Un nouveau concours, un nouveau decor.
    const cle = `${e.epreuve}|${e.etape}|${e.ligne}`;
    if (cle !== decorCle) {
      if (decor) scene.remove(decor.groupe);
      const groupe = new THREE.Group();
      const d = construireDecor(groupe, e);
      scene.add(groupe);
      decor = { ...d, groupe };
      decorCle = cle;
    }

    // L'athlete : la posture du moteur, en metres, a sa place sur la piste.
    if (G.obstacles && G.obstacles.preparer) G.obstacles.preparer(j, G, SprinterCore.C);
    const k = (j.look && j.look.h ? j.look.h : 1.8) / SprinterCore.C.MODEL_H;
    corps.maj(capsulesDe(j), k);
    corps.mesh.position.set(ou.d, 0, ou.y - PISTE_Y);
    gerbe.maj(e.gerbe, dt);
    marques.maj(e);

    // Le soleil suit l'athlete, pour que son ombre reste nette.
    soleil.position.set(ou.d - 8, 18, 10);
    soleil.target.position.set(ou.d, 0, 0);
    contour.position.set(ou.d + 4, 6, -12);
    contour.target.position.set(ou.d, 1, 0);

    placerCamera(e, ou, dt);
    renderer.render(scene, camera);
  }

  /**
   * LA LONGUEUR SE REGARDE DE COTE ; LE TRIPLE, DANS L'AXE.
   *
   * De cote, la camera suit l'athlete en travelling, un peu devant lui pour
   * qu'on voie venir la planche puis le sable ; elle s'arrete au bout de la
   * fosse. Dans l'axe, elle est plantee derriere la fosse et zoome pour garder
   * l'athlete a la meme taille, comme un cadreur au teleobjectif.
   */
  function placerCamera(e, ou, dt) {
    const fosseFin = decor ? decor.fosseFin : e.fosseX + 9;
    const portrait = camera.aspect < 1;
    if (e.epreuve === 'triple') {
      const cx = fosseFin + 14, cy = 2.4, cz = 0.5;
      const cibleX = ou.d + suitX(e.phase === 'reception' ? 0.6 : 0, dt);
      // vise sous le bassin : l'athlete monte dans l'image, au-dessus des paves
      const cibleY = suitY(e.phase === 'vol' ? 1.0 : 0.72, dt);
      camera.position.set(cx, cy, cz);
      camera.lookAt(cibleX, cibleY, 0);
      const dist = Math.max(4, Math.hypot(cx - cibleX, cy - cibleY, cz));
      // l'athlete occupe a peu pres la moitie de la hauteur de l'image
      const cadre = portrait ? 4.2 : 5.2;
      camera.fov = THREE.MathUtils.clamp(2 * Math.atan(cadre / 2 / dist) * 180 / Math.PI, 3, 55);
    } else {
      // Le cadre, en metres a la distance de l'athlete. Tenu en portrait,
      // l'image est etroite : on la garde au moins cinq metres de large,
      // quitte a voir l'athlete plus petit.
      const visible = portrait ? Math.max(7.5, 5 / camera.aspect) : 5.2;
      const large = visible * camera.aspect;
      // Devant lui, en part de la largeur de l'image : plus il approche de la
      // planche, plus le sable entre dans le cadre.
      const part = e.phase === 'reception' ? 0.08 : e.phase === 'vol' ? 0.18
        : e.phase === 'repos' || e.phase === 'attente' ? 0.12
        : 0.16 + 0.12 * lisse((ou.d - (e.ligne - 16)) / 12);
      const cibleX = Math.min(ou.d + suitX(part * large, dt), fosseFin - 2);
      // en portrait, on vise plus haut : la piste descend vers les paves, et
      // l'herbe vide sous elle disparait
      const cibleY = suitY((e.phase === 'vol' ? 1.15 : 0.8) + (portrait ? 1.6 : 0), dt);
      const recul = portrait ? 18 : 13;
      camera.position.set(cibleX, 4.2, recul);
      camera.lookAt(cibleX, cibleY, 0);
      camera.fov = 2 * Math.atan(visible / 2 / recul) * 180 / Math.PI;
    }
    camera.updateProjectionMatrix();
  }

  id = requestAnimationFrame(image);

  return function detruire() {
    vivant = false;
    cancelAnimationFrame(id);
    obs.disconnect();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); }
      }
    });
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
    toile.remove();
  };
}
