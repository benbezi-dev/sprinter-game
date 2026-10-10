// LE GLOBE DU VOYAGE — sur l'affiche de chaque etape de la Legende (10/10).
//
// Remplace la carte plate (LegendeCarte.tsx, gardee en secours si le
// telephone n'a pas de WebGL). L'auteur, 10/10 : « ameliore la carte et les
// modes de deplacement », « ajoute du motion design et du reel design ».
//
// Ce qui change, et pourquoi :
//   - LA VRAIE TERRE : la Blue Marble de la NASA (domaine public), drapee sur
//     une sphere three.js, avec son halo d'atmosphere et un ciel d'etoiles.
//   - LE VRAI CHEMIN : l'arc suit le grand cercle (le plus court, par le
//     Pacifique s'il le faut), souleve au-dessus du sol d'autant plus que le
//     vol est long. L'ancienne carte tracait une courbe plate a travers tout
//     le planisphere (Kingston -> Kyoto traversait l'Atlantique et l'Asie).
//   - DES TRANSPORTS COHERENTS : on ne traverse plus l'ocean en voiture. Sur
//     le globe, le velo longe la cote jusqu'a Menole, l'avion de ligne porte
//     le regional et le national, le jet prive BENBEZI le mondial, la fusee
//     le reste. La voiture et le car de l'equipe font le dernier trajet,
//     jusqu'au stade (LegendeCinematiques.tsx) — c'est `transport`
//     (etapes.ts) ; ici on lit `VOL`.
//   - LE MOTION DESIGN : la camera part au-dessus du depart, prend de la
//     hauteur et suit le vehicule, puis plonge sur l'arrivee ; la trainee se
//     trace derriere lui avec une tete lumineuse ; les villes s'annoncent en
//     typographie animee, le compteur de kilometres defile.
//
// Le dessin tourne tant que l'affiche est la, a la densite du telephone
// (plafonnee a 2) ; tout est libere au demontage.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import terreUrl from '@/assets/legende/carte/terre.jpg';
import { ETAPES, DEPART, type Lieu } from '@/game/legende/etapes';
import { lieuDeLEtape } from '@/game/legende/legende';
import { dans } from '@/game/legende/mots';
import { vehicule as spriteVehicule, prechargerVehicules } from '@/game/legende/vehicules';
import { CarteDuVoyage } from './LegendeCarte';

/** Le vehicule DU GLOBE, etape par etape (le dernier trajet au sol est ailleurs). */
export type Vol = 'velo' | 'avion' | 'jet' | 'fusee';
export const VOL: Vol[] = ['velo', 'avion', 'avion', 'jet', 'fusee', 'fusee'];
const VOL_NOM: Record<Vol, [string, string]> = {
  velo: ['À VÉLO', 'BY BIKE'], avion: ['VOL DE LIGNE', 'AIRLINER'],
  jet: ['JET PRIVÉ BENBEZI', 'BENBEZI PRIVATE JET'], fusee: ['FUSÉE', 'ROCKET'],
};

const RAYON_TERRE_KM = 6371;
const DUREE_VOL = 3.4;      // s : le trajet
const ATTENTE = 0.45;       // s : avant de partir (les noms s'annoncent)

/** Latitude / longitude en degres -> point de la sphere unite (repere de SphereGeometry). */
function surSphere(geo: [number, number]): THREE.Vector3 {
  const f = THREE.MathUtils.degToRad(geo[0]), l = THREE.MathUtils.degToRad(geo[1]);
  return new THREE.Vector3(Math.cos(l) * Math.cos(f), Math.sin(f), -Math.sin(l) * Math.cos(f));
}

/** Le grand cercle de a a b (unitaires), a l'instant t. */
function slerp(a: THREE.Vector3, b: THREE.Vector3, t: number, out = new THREE.Vector3()) {
  const w = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
  if (w < 1e-6) return out.copy(a);
  const s = Math.sin(w);
  return out.copy(a).multiplyScalar(Math.sin((1 - t) * w) / s).addScaledVector(b, Math.sin(t * w) / s);
}

const lisse = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Le pictogramme du vehicule, dessine une fois dans une toile (vu de dessus, nez vers le haut). */
function textureVehicule(vol: Vol, teinte: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.translate(128, 128);
  // ombre portee douce : l'objet vole au-dessus du sol
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 18; g.shadowOffsetX = 10; g.shadowOffsetY = 14;
  const corps = vol === 'jet' ? '#141418' : '#F6F6F4';
  const filet = vol === 'jet' ? '#E2B355' : teinte;
  g.fillStyle = corps;
  if (vol === 'avion' || vol === 'jet') {
    const l = vol === 'jet' ? 0.86 : 1;
    g.beginPath();                                         // fuselage
    g.ellipse(0, 0, 13 * l, 96 * l, 0, 0, Math.PI * 2); g.fill();
    g.beginPath();                                         // ailes en fleche
    g.moveTo(-10, -6 * l); g.lineTo(-92 * l, 38 * l); g.lineTo(-88 * l, 52 * l); g.lineTo(-8, 26 * l);
    g.lineTo(8, 26 * l); g.lineTo(88 * l, 52 * l); g.lineTo(92 * l, 38 * l); g.lineTo(10, -6 * l); g.closePath(); g.fill();
    g.beginPath();                                         // empennage
    g.moveTo(-6, 66 * l); g.lineTo(-36 * l, 94 * l); g.lineTo(-32 * l, 102 * l); g.lineTo(0, 90 * l);
    g.lineTo(32 * l, 102 * l); g.lineTo(36 * l, 94 * l); g.lineTo(6, 66 * l); g.closePath(); g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = filet;                                   // filet de couleur
    g.fillRect(-2.5, -80 * l, 5, 160 * l);
    if (vol === 'avion') {                                 // reacteurs sous les ailes
      g.fillStyle = '#9AA3B2';
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 44, 14, 6, 15, 0, 0, Math.PI * 2); g.fill(); }
    } else {
      g.fillStyle = filet;                                 // winglets dores
      for (const s of [-1, 1]) g.fillRect(s * 80 - 3, 32, 6, 16);
    }
  } else if (vol === 'fusee') {
    g.beginPath(); g.moveTo(0, -100); g.quadraticCurveTo(26, -60, 22, 40); g.lineTo(-22, 40);
    g.quadraticCurveTo(-26, -60, 0, -100); g.fill();
    g.fillStyle = filet;
    g.beginPath(); g.moveTo(-22, 20); g.lineTo(-44, 62); g.lineTo(-20, 50); g.fill();
    g.beginPath(); g.moveTo(22, 20); g.lineTo(44, 62); g.lineTo(20, 50); g.fill();
    g.shadowColor = 'transparent';
    const fl = g.createLinearGradient(0, 40, 0, 120);
    fl.addColorStop(0, '#FFF3C0'); fl.addColorStop(0.4, '#FFB43A'); fl.addColorStop(1, 'rgba(255,90,30,0)');
    g.fillStyle = fl; g.beginPath(); g.moveTo(-14, 42); g.lineTo(0, 124); g.lineTo(14, 42); g.fill();
  } else {
    // le velo, vu de dessus : le cycliste, le guidon, les deux roues
    g.fillStyle = '#1B1B22';
    g.fillRect(-4, -96, 8, 70); g.fillRect(-4, 26, 8, 70);
    g.fillRect(-30, -62, 60, 7);
    g.fillStyle = '#F6F6F4';
    g.beginPath(); g.ellipse(0, -4, 26, 34, 0, 0, Math.PI * 2); g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = '#3A2418'; g.beginPath(); g.arc(0, -30, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = teinte; g.fillRect(-26, -4, 52, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Halo d'atmosphere : une sphere a l'envers, plus claire sur le bord. */
function atmosphere(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { couleur: { value: new THREE.Color('#5AA8FF') } },
    vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 couleur; varying vec3 vN; void main(){
      float i = pow(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 3.0);
      gl_FragColor = vec4(couleur, 1.0) * i * 1.6; }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 32), mat);
}

/** Une tache lumineuse ronde (tete de trainee, reperes). */
function textureLueur(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

type Etiquette = { x: number; y: number; vis: number };

function webglPossible(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export function GlobeDuVoyage({ rang, teinte, boss }: { rang: number; teinte: string; boss: string }) {
  const [secours] = useState(() => !webglPossible());
  if (secours) return <CarteDuVoyage rang={rang} teinte={teinte} boss={boss} />;
  return <Globe rang={rang} teinte={teinte} boss={boss} />;
}

function Globe({ rang, teinte, boss }: { rang: number; teinte: string; boss: string }) {
  const boite = useRef<HTMLDivElement>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  const lieu = lieuDeLEtape(rang);
  const avant: Lieu = rang === 0 ? DEPART : lieuDeLEtape(rang - 1);
  const vol = VOL[rang] ?? 'avion';
  const espace = rang === ETAPES.length - 1;
  // la derniere ville sur Terre : d'ou part la fusee
  const villeTerrestre = useMemo(() => {
    for (let r = rang - 1; r >= 0; r--) { const l = lieuDeLEtape(r); if (l.geo) return l; }
    return DEPART;
  }, [rang]);

  // l'etat que l'habillage HTML lit a chaque image
  const [hud, setHud] = useState({ p: 0, km: 0, dep: null as Etiquette | null, arr: null as Etiquette | null, s: 0 });

  const geoDep = (avant.geo ?? villeTerrestre.geo)!;
  const kmTotal = useMemo(() => {
    if (!lieu.geo) return espace ? 0 : 100;           // Karman : cent kilometres, vers le haut
    const a = surSphere(geoDep), b = surSphere(lieu.geo);
    return Math.round(Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) * RAYON_TERRE_KM);
  }, [geoDep, lieu, espace]);

  useEffect(() => {
    const cv = toile.current, bx = boite.current;
    if (!cv || !bx) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: false, powerPreference: 'low-power' });
    } catch { return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(espace || !lieu.geo ? '#03030A' : '#040814');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1.6, 0.01, 200);
    const jetable: { dispose: () => void }[] = [];

    // le ciel
    const n = 1400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const g1 = Math.imul(i + 11, 2654435761) >>> 0, g2 = Math.imul(i + 97, 2246822519) >>> 0;
      const u = (g1 % 10000) / 10000, v = (g2 % 10000) / 10000;
      const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
      pos.set([60 * Math.sin(ph) * Math.cos(th), 60 * Math.cos(ph), 60 * Math.sin(ph) * Math.sin(th)], i * 3);
    }
    const gEt = new THREE.BufferGeometry(); gEt.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mEt = new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.75, depthWrite: false });
    scene.add(new THREE.Points(gEt, mEt)); jetable.push(gEt, mEt);

    // la Terre
    const tex = new THREE.TextureLoader().load(terreUrl);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const gT = new THREE.SphereGeometry(1, 96, 64);
    const mT = new THREE.MeshPhongMaterial({ map: tex, shininess: 6, specular: new THREE.Color('#223344') });
    const terre = new THREE.Mesh(gT, mT);
    scene.add(terre); jetable.push(tex, gT, mT);
    const atm = atmosphere(); scene.add(atm); jetable.push(atm.geometry, atm.material as THREE.Material);
    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const soleil = new THREE.DirectionalLight(0xffffff, 1.25);
    scene.add(soleil);

    // le trajet
    const A = surSphere(geoDep);
    const B = lieu.geo ? surSphere(lieu.geo) : null;
    const w = B ? Math.acos(THREE.MathUtils.clamp(A.dot(B), -1, 1)) : 0;
    const hauteur = B ? Math.min(0.32, 0.004 + w * 0.17) : 0;
    const N = 160;
    const pts: THREE.Vector3[] = [];
    // hors de la Terre : la fusee monte (Karman), ou file vers l'apotheose
    const ailleurs = espace
      ? A.clone().multiplyScalar(1).add(new THREE.Vector3(0.9, 0.7, 0.3)).normalize().multiplyScalar(4.2)
      : A.clone().multiplyScalar(1.85).add(new THREE.Vector3(0, 0.25, 0));
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      if (B) {
        const p = slerp(A, B, t).multiplyScalar(1.004 + hauteur * Math.sin(Math.PI * t));
        pts.push(p);
      } else {
        // une courbe qui decolle droit puis s'incline
        const p = A.clone().multiplyScalar(1.004).lerp(ailleurs, t * t * (3 - 2 * t));
        pts.push(p);
      }
    }
    const courbe = new THREE.CatmullRomCurve3(pts);
    const RAD = 6, SEG = 240;
    const epais = B ? Math.max(0.0012, Math.min(0.0032, w * 0.0022)) : 0.004;
    const gTr = new THREE.TubeGeometry(courbe, SEG, epais, RAD, false);
    const mTr = new THREE.MeshBasicMaterial({ color: new THREE.Color(teinte), transparent: true, opacity: 0.95 });
    const trainee = new THREE.Mesh(gTr, mTr);
    const gHalo = new THREE.TubeGeometry(courbe, SEG, epais * 3, RAD, false);
    const mHalo = new THREE.MeshBasicMaterial({ color: new THREE.Color(teinte), transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Mesh(gHalo, mHalo);
    scene.add(trainee, halo); jetable.push(gTr, mTr, gHalo, mHalo);
    // le chemin a venir, en pointilles discrets
    const gPt = new THREE.BufferGeometry().setFromPoints(courbe.getPoints(120));
    const mPt = new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, dashSize: 0.012, gapSize: 0.012 });
    const pointilles = new THREE.Line(gPt, mPt); pointilles.computeLineDistances();
    scene.add(pointilles); jetable.push(gPt, mPt);

    // les reperes : un anneau au depart, une colonne de lumiere a l'arrivee
    const lueur = textureLueur(); jetable.push(lueur);
    const repere = (p: THREE.Vector3, couleur: string, taille: number) => {
      const m = new THREE.SpriteMaterial({ map: lueur, color: new THREE.Color(couleur), transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(m); s.position.copy(p).multiplyScalar(1.006); s.scale.setScalar(taille);
      scene.add(s); jetable.push(m); return s;
    };
    const rDep = repere(A, '#FFFFFF', 0.05);
    const rArr = B ? repere(B, teinte, 0.07) : repere(ailleurs, teinte, espace ? 0.9 : 0.08);
    let colonne: THREE.Mesh | null = null;
    if (B) {
      const gC = new THREE.CylinderGeometry(0.0035, 0.0035, 0.18, 8, 1, true);
      gC.translate(0, 0.09, 0);
      const mC = new THREE.MeshBasicMaterial({ color: new THREE.Color(teinte), transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false });
      colonne = new THREE.Mesh(gC, mC);
      colonne.position.copy(B);
      colonne.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().normalize());
      scene.add(colonne); jetable.push(gC, mC);
    }
    // la tete de la trainee et le vehicule
    const tete = repere(A, teinte, 0.06);
    const texV = textureVehicule(vol, teinte); jetable.push(texV);
    const mV = new THREE.SpriteMaterial({ map: texV, transparent: true, depthTest: false });
    const vehicule = new THREE.Sprite(mV); vehicule.renderOrder = 10;
    scene.add(vehicule); jetable.push(mV);
    // son ombre, posee au sol sous lui : plus il vole haut, plus elle s'ecarte
    const mOmbre = new THREE.SpriteMaterial({ map: texV, color: 0x000000, transparent: true, opacity: 0.35, depthTest: false });
    const ombre = new THREE.Sprite(mOmbre); ombre.renderOrder = 9;
    scene.add(ombre); jetable.push(mOmbre);
    // le vrai modele (Tripo, vu de dessus) remplace le pictogramme des qu'il est charge
    prechargerVehicules([vol, 'velo', 'avion', 'voiture', 'car', 'jet']);
    let aspect = 1, vrai = false;
    const essayerLeVrai = () => {
      if (vrai) return;
      const sp = spriteVehicule(vol, 'dessus');
      if (!sp) return;
      const t = new THREE.Texture(sp.im); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      jetable.push(t);
      mV.map = t; mOmbre.map = t; mV.needsUpdate = true; mOmbre.needsUpdate = true;
      aspect = sp.w / sp.h; vrai = true;
    };
    // la taille du vehicule a l'ecran ne depend pas du zoom : on la recale a chaque image
    const TAILLE_ECRAN = vol === 'velo' ? 0.085 : 0.11;

    // la camera : au-dessus du depart, prend de la hauteur, suit, plonge sur l'arrivee
    const loinDep = B ? (w < 0.01 ? 1.38 : 2.7) : 2.5;
    const loinMilieu = B ? Math.max(loinDep, 2.2 + w * 1.15) : (espace ? 9 : 3.6);
    const loinArr = B ? (w < 0.01 ? 1.32 : 2.6) : (espace ? 10 : 3.4);
    const dirCam = new THREE.Vector3(), pVeh = new THREE.Vector3(), tmp = new THREE.Vector3();
    const NORD = new THREE.Vector3(0, 1, 0);

    const redim = () => {
      const W = bx.clientWidth, H = Math.round(W * 0.62);
      renderer.setSize(W, H, false);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      camera.aspect = W / H; camera.updateProjectionMatrix();
    };
    redim();
    const ro = new ResizeObserver(redim); ro.observe(bx);

    const versEcran = (p: THREE.Vector3): Etiquette => {
      const q = p.clone().project(camera);
      // derriere la Terre : la normale tourne le dos a la camera
      const face = p.clone().normalize().dot(camera.position.clone().sub(p).normalize());
      return { x: (q.x * 0.5 + 0.5) * 100, y: (-q.y * 0.5 + 0.5) * 100, vis: clamp01(face * 6) };
    };

    let raf = 0; const t0 = performance.now(); let dernierHud = 0;
    const image = (now: number) => {
      const s = (now - t0) / 1000;
      const p = clamp01((s - ATTENTE) / DUREE_VOL);
      const e = lisse(p);
      courbe.getPointAt(e, pVeh);

      // la camera
      if (B) {
        // la camera suit le vehicule ; elle prend de la hauteur au milieu d'un
        // long vol (on voit l'arc entier), puis redescend sur l'arrivee
        slerp(A, B, e, dirCam);
        const base = THREE.MathUtils.lerp(loinDep, loinArr, e);
        const loin = base + Math.max(0, loinMilieu - base) * Math.sin(Math.PI * e);
        // apres l'atterrissage, une lente approche
        const approche = 1 - 0.06 * lisse(clamp01((s - ATTENTE - DUREE_VOL) / 2.5));
        camera.position.copy(dirCam).multiplyScalar(1 + (loin - 1) * approche);
        camera.up.copy(NORD);
        camera.lookAt(0, 0, 0);
      } else {
        const loin = THREE.MathUtils.lerp(loinDep, loinMilieu, e);
        dirCam.copy(A).lerp(pVeh.clone().normalize(), 0.35 * e).normalize();
        camera.position.copy(dirCam).multiplyScalar(loin).add(tmp.set(0, 0.25 * e, 0));
        camera.up.copy(NORD);
        camera.lookAt(tmp.copy(pVeh).multiplyScalar(0.55));
      }
      // le soleil vient du haut gauche de l'ecran : une Terre en volume, jamais dans la nuit
      soleil.position.copy(camera.position).add(tmp.set(-1.2, 1.4, 0.4).applyQuaternion(camera.quaternion));

      // la trainee se trace jusqu'au vehicule
      const seg = Math.floor(e * SEG);
      gTr.setDrawRange(0, seg * RAD * 6);
      gHalo.setDrawRange(0, seg * RAD * 6);
      // les reperes gardent leur taille A L'ECRAN, quel que soit le zoom
      const ecran = (q: THREE.Vector3) => camera.position.distanceTo(q) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      tete.position.copy(pVeh);
      tete.scale.setScalar((0.05 + 0.012 * Math.sin(s * 9)) * ecran(pVeh));
      (tete.material as THREE.SpriteMaterial).opacity = p < 1 ? 1 : Math.max(0, 1 - (s - ATTENTE - DUREE_VOL) * 2);

      // le vehicule, oriente selon sa trajectoire A L'ECRAN, de taille constante
      essayerLeVrai();
      vehicule.position.copy(pVeh);
      const d = camera.position.distanceTo(pVeh);
      const taille = TAILLE_ECRAN * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (vrai ? 1.25 : 1);
      vehicule.scale.set(taille * Math.min(1, aspect), taille / Math.max(1, aspect), 1);
      ombre.position.copy(pVeh).normalize().multiplyScalar(1.003);
      ombre.scale.copy(vehicule.scale).multiplyScalar(0.92);
      const q0 = pVeh.clone().project(camera);
      const q1 = courbe.getPointAt(Math.min(1, e + 0.01)).project(camera);
      const q2 = courbe.getPointAt(Math.max(0, e - 0.01)).project(camera);
      const dx = (q1.x - q2.x) * camera.aspect, dy = q1.y - q2.y;
      if (Math.abs(dx) + Math.abs(dy) > 1e-5) mV.rotation = Math.atan2(dy, dx) - Math.PI / 2;
      mOmbre.rotation = mV.rotation;
      void q0;
      mV.opacity = p >= 1 && vol !== 'velo' ? Math.max(0, 1 - (s - ATTENTE - DUREE_VOL) * 1.5) : 1;
      mOmbre.opacity = 0.35 * mV.opacity * (vol === 'fusee' ? 0 : 1);

      // l'arrivee s'allume
      const arrivee = clamp01((s - ATTENTE - DUREE_VOL * 0.85) / 0.5);
      rArr.scale.setScalar((B ? 0.07 : (espace ? 0.16 : 0.08)) * ecran(rArr.position) * (1 + 0.35 * Math.sin(s * 3.2)) * (0.6 + 0.4 * arrivee));
      if (colonne) {
        (colonne.material as THREE.MeshBasicMaterial).opacity = 0.75 * arrivee;
        // la colonne a la hauteur de la vue : courte quand on rase le sol
        const alt = THREE.MathUtils.clamp((camera.position.length() - 1) / 1.6, 0.08, 1);
        colonne.scale.set(alt, (0.2 + 0.8 * lisse(arrivee)) * alt, alt);
      }
      rDep.scale.setScalar(0.045 * ecran(rDep.position) * (1 + 0.3 * Math.sin(s * 2.4 + 1)));
      mPt.opacity = 0.28 * (1 - arrivee);
      terre.rotation.y = 0;
      renderer.render(scene, camera);

      // l'habillage : dix fois par seconde suffit au texte, a chaque image pour les positions
      if (now - dernierHud > 33) {
        dernierHud = now;
        setHud({
          p, km: Math.round(kmTotal * e), s,
          dep: versEcran(A.clone().multiplyScalar(1.006)),
          arr: versEcran((B ?? ailleurs).clone().multiplyScalar(B ? 1.006 : 1)),
        });
      }
      raf = requestAnimationFrame(image);
    };
    raf = requestAnimationFrame(image);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      jetable.forEach(j => j.dispose());
      renderer.dispose();
    };
  }, [rang, teinte, vol, espace, lieu, geoDep, kmTotal]);

  // ---------------------------------------------------------------- habillage
  const dureeTexte = (() => {
    if (vol === 'velo') return '8 MIN';
    if (vol === 'fusee') return espace ? '∞' : '100 KM ↑';
    const h = kmTotal / (vol === 'jet' ? 900 : 830) + 0.5;
    return `${Math.floor(h)} H ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  })();
  const kmTexte = vol === 'fusee'
    ? (espace ? '' : `${Math.round(100 * clamp01(hud.p))} KM`)
    : `${hud.km.toLocaleString('fr-FR').replace(/ | /g, ' ')} KM`;
  const annonce = (x: number) => ({ opacity: clamp01(x), transform: `translateY(${(1 - lisse(clamp01(x))) * 10}px)` });
  const dep = hud.dep, arr = hud.arr;
  const lettrage = (x: number) => ({ letterSpacing: `${0.32 - 0.16 * lisse(clamp01(x))}em` });

  return (
    <div ref={boite} className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-[#040814]">
      <canvas ref={toile} className="block w-full" role="img" aria-label={`${avant.nom} → ${lieu.nom}`} />

      {/* un balayage de lumiere au lever du rideau */}
      <div className="pointer-events-none absolute inset-0"
           style={{ background: `linear-gradient(105deg, transparent 35%, rgba(255,255,255,${0.16 * (1 - clamp01(hud.s / 0.9))}) 50%, transparent 65%)`,
                    transform: `translateX(${-60 + 160 * clamp01(hud.s / 0.9)}%)` }} />
      {/* un vignetage : le regard au centre */}
      <div className="pointer-events-none absolute inset-0"
           style={{ background: 'radial-gradient(ellipse at 50% 55%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />

      {/* le depart, epingle sur le globe tant qu'on le voit */}
      {dep && dep.vis > 0.02 && (
        <div className="pointer-events-none absolute" style={{ left: `${dep.x}%`, top: `${dep.y}%`, opacity: dep.vis * (1 - clamp01((hud.p - 0.25) * 3)) }}>
          <div className="absolute -translate-x-1/2 -translate-y-full pb-2 text-center whitespace-nowrap">
            <div className="text-[9px] font-bold tracking-[0.2em] text-white/60">{dans(['DÉPART', 'FROM'])}</div>
            <div className="text-[13px] font-black tracking-wider text-white" style={{ textShadow: '0 1px 8px #000' }}>
              {avant.nom.toUpperCase()}</div>
          </div>
        </div>
      )}
      {/* l'arrivee : elle s'annonce quand le vehicule approche */}
      {arr && (
        <div className="pointer-events-none absolute" style={{ left: `${arr.x}%`, top: `${arr.y}%`, opacity: arr.vis > 0.02 || !lieu.geo ? 1 : 0 }}>
          <div className="absolute -translate-x-1/2 -translate-y-full pb-3 text-center whitespace-nowrap"
               style={annonce((hud.p - 0.72) * 3.5)}>
            <div className="text-[9px] font-bold tracking-[0.2em]" style={{ color: teinte }}>{dans(['ARRIVÉE', 'TO'])}</div>
            <div className="text-[18px] font-black text-white leading-none" style={{ ...lettrage((hud.p - 0.72) * 3), textShadow: `0 0 14px ${teinte}, 0 1px 8px #000` }}>
              {lieu.nom.toUpperCase()}</div>
          </div>
        </div>
      )}

      {/* le bandeau : le mode, la distance qui defile, la duree */}
      <div className="pointer-events-none absolute left-0 right-0 bottom-0 px-3 pt-6 pb-1.5 flex items-end justify-between"
           style={{ background: 'linear-gradient(0deg, rgba(4,8,20,0.92), transparent)' }}>
        <div style={annonce(hud.s * 2)}>
          <div className="text-[8px] font-bold tracking-[0.22em] text-white/50">{dans(VOL_NOM[vol])}</div>
          <div className="text-[10px] font-bold tracking-[0.14em] text-white/80 truncate max-w-[52vw]">
            {avant.nom.toUpperCase()} → {lieu.nom.toUpperCase()}</div>
        </div>
        <div className="text-right" style={annonce(hud.s * 2 - 0.4)}>
          <div className="font-black text-white tabular-nums leading-none text-[17px]" style={{ textShadow: `0 0 10px ${teinte}88` }}>
            {kmTexte}</div>
          <div className="text-[8px] font-bold tracking-[0.2em] text-white/50">{dureeTexte}</div>
        </div>
      </div>
      {/* le nom du boss, comme avant, sous le globe */}
      <div className="absolute top-2 right-2 pointer-events-none" style={annonce((hud.p - 0.85) * 4)}>
        <span className="px-2 py-0.5 rounded-md text-[10px] tracking-[0.16em] font-bold"
              style={{ color: '#0B0B12', background: teinte, boxShadow: `0 0 12px ${teinte}AA` }}>
          {boss.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
