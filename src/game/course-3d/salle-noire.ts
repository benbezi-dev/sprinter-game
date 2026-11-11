// LA COURSE EN VRAIE 3D — la competition dans le noir (decoupe de course-3d.ts, 11/11/2026).

import * as THREE from 'three';
import { zSol } from '../salle-3d';
import { presentationCourante } from '../presentation-directe';
import { LANE_W } from './reglages';
import { milieu, ici, capIci } from './repere';
import { nCouloirs } from '../course-3d';

// LA PRESENTATION DE LA FINALE, ECRITE DANS LA PISTE (Championnat de France du 19/12, l'auteur, 7/11 ;
// la direction : la finale du 100 m de Doha 2019, « en mieux et dans la piste »). Un athlete toutes les
// 3 s : son nom s'ecrit en lumiere, couche dans son couloir, une trainee fantome part des blocs a la
// vitesse de son chrono, puis tout se retire (« ils sont la pour la presentation puis se retirent »).
// Le joueur : « TOI », en or. Au pistolet, plus rien sur la piste — on court dans le noir, lignes allumees.
const PRES_PAS = 3;
export let presente = -1, presenteTexte = '';
export const presenteOu = new THREE.Vector3(), finCam = new THREE.Vector3(), finVise = new THREE.Vector3();
function peinte(w: number, h: number, peindre: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  peindre(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
/**
 * L'EXTINCTION DE LA SALLE, avant la presentation d'une serie (l'auteur, 8/11) : quatre secondes. Les plafonniers
 * s'eteignent en trois rangees, chacune avec son clignotement (0,8 s, 1,4 s, 2 s) ; puis les neons s'allument comme
 * de vrais tubes, en hesitant (2,6 a 3,4 s) — les couloirs, les fleches, les logos, le tapis. Elle part au premier
 * moment d'avant-course (la cinematique d'intro ou le decompte) et ne revient jamais en arriere : la salle reste noire.
 */
export const DUREE_EXTINCTION = 4;
/**
 * LE SON DE L'EXTINCTION : le « clonk » d'un contacteur par rangee de plafonniers, qui roule dans la halle ; le
 * public qui monte d'un cran quand le noir tombe ; le gresillement des tubes neon qui s'allument. Synthetise sur
 * l'horloge audio du jeu (Audio_.ctx, Audio_.sortie) : rien a charger, muet si le son est coupe.
 */
const sonDeSalle = {
  audio() { const A = (globalThis as any).SprinterApp?.Audio_; return A && A.ok && A.on && A.ctx && A.sortie ? A : null; },
  bruit(ctx: AudioContext, dur: number) {
    const b = ctx.createBuffer(1, Math.max(1, (dur * ctx.sampleRate) | 0), ctx.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b; return s;
  },
  enveloppe(ctx: AudioContext, t: number, pic: number, monte: number, tombe: number) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pic, t + monte); g.gain.exponentialRampToValueAtTime(0.0001, t + monte + tombe);
    return g;
  },
  /** Un contacteur qui coupe une rangee : un choc sourd, un clic metallique, et la halle qui le renvoie. */
  clonk(force = 1) {
    const A = this.audio(); if (!A) return;
    const ctx: AudioContext = A.ctx, t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
    const go = this.enveloppe(ctx, t, 0.55 * force, 0.004, 0.35); o.connect(go).connect(A.sortie); o.start(t); o.stop(t + 0.4);
    const clic = this.bruit(ctx, 0.05), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 1.2;
    const gc = this.enveloppe(ctx, t, 0.35 * force, 0.002, 0.04); clic.connect(f).connect(gc).connect(A.sortie); clic.start(t);
    // l'echo de la halle : le meme choc, etouffe, qui revient trois fois
    for (let k = 1; k <= 3; k++) {
      const e = this.bruit(ctx, 0.3), fe = ctx.createBiquadFilter(); fe.type = 'lowpass'; fe.frequency.value = 900 - k * 200;
      const ge = this.enveloppe(ctx, t + k * 0.11, 0.12 * force / k, 0.01, 0.28); e.connect(fe).connect(ge).connect(A.sortie); e.start(t + k * 0.11);
    }
  },
  /** Le public qui monte quand le noir tombe : une rumeur qui enfle deux secondes, puis retombe. */
  rumeur() {
    const A = this.audio(); if (!A) return;
    const ctx: AudioContext = A.ctx, t = ctx.currentTime + 0.02, d = 4.5;
    for (const [fq, q, a] of [[520, 0.8, 0.22], [1150, 1.1, 0.14], [2300, 1.4, 0.06]] as const) {
      const n = this.bruit(ctx, d), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(a, t + 1.8); g.gain.setValueAtTime(a, t + 2.3); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      n.connect(f).connect(g).connect(A.sortie); n.start(t);
    }
  },
  /** L'ovation d'un nom : des applaudissements serres (un bruit haché) et la clameur qui monte, plus fort pour toi. */
  ovation(moi = false) {
    const A = this.audio(); if (!A) return;
    const ctx: AudioContext = A.ctx, t = ctx.currentTime + 0.02, d = 2.4, f = moi ? 1.5 : 1;
    const n = this.bruit(ctx, d), ch = (n.buffer as AudioBuffer).getChannelData(0), sr = ctx.sampleRate;
    // des centaines de mains : chaque claquement, 4 ms de bruit, place au hasard (plus dense au milieu)
    for (let i = 0; i < ch.length; i++) ch[i] *= 0.15;
    for (let c = 0; c < 900 * d; c++) {
      const u = Math.random(), at = (u * u * (3 - 2 * u)) * (ch.length - 200) | 0, a = 0.4 + Math.random() * 0.6;
      for (let j = 0; j < 180; j++) ch[at + j] += (Math.random() * 2 - 1) * a * Math.exp(-j / 30);
    }
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 * f, t + 0.25); g.gain.setValueAtTime(0.09 * f, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    n.connect(hp).connect(g).connect(A.sortie); n.start(t);
    const cl = this.bruit(ctx, d), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.9;
    const gc = this.enveloppe(ctx, t, 0.12 * f, 0.4, d - 0.4); cl.connect(bp).connect(gc).connect(A.sortie); cl.start(t);
  },
  /** Un tube neon qui s'amorce : un ping, puis le bourdon du ballast. */
  neon(dur = 0.12) {
    const A = this.audio(); if (!A) return;
    const ctx: AudioContext = A.ctx, t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    const g = this.enveloppe(ctx, t, 0.05, 0.005, dur); o.connect(f).connect(g).connect(A.sortie); o.start(t); o.stop(t + dur + 0.05);
    const p = ctx.createOscillator(); p.type = 'sine'; p.frequency.value = 3800;
    const gp = this.enveloppe(ctx, t, 0.04, 0.002, 0.06); p.connect(gp).connect(A.sortie); p.start(t); p.stop(t + 0.1);
  },
};
export function lExtinction(eteindre: (lumiere: number, neons: number) => void, eclairer: (k: number) => void) {
  const RANGEES = [0.8, 1.4, 2.0];
  const ALLUMAGE: [number, number][] = [[2.6, 0.6], [2.7, 0], [2.8, 1], [2.95, 0.2], [3.05, 1], [3.3, 0.7], [3.4, 1]];
  let debut = -1, fini = false, vu = -1;
  return (t: number) => {
    if (fini) return;
    const dt = vu < 0 ? 0 : t - vu; vu = t;
    const G = (globalThis as any).SprinterApp?.G;
    const avant = !!G && ((G.state === 'cut' && G.cut && G.cut.kind === 'intro') || G.state === 'count');
    if (debut < 0) { if (!avant) return; debut = t; }
    const e = t - debut;
    // la lumiere : un tiers de moins a chaque rangee, et 0,18 s de clignotement au moment ou elle tombe
    let lumiere = 1;
    for (let i = 0; i < RANGEES.length; i++) {
      const f = e - RANGEES[i];
      if (f < 0) break;
      const avantR = 1 - i / RANGEES.length, apres = 1 - (i + 1) / RANGEES.length;
      lumiere = f < 0.18 && Math.floor(f / 0.045) % 2 === 0 ? avantR : apres;
    }
    let neons = 0;
    for (const [a, v] of ALLUMAGE) if (e >= a) neons = v;
    // le son : un clonk a chaque rangee qui tombe, la rumeur au premier, le gresillement a chaque amorce de neon
    const avantE = e - dt;
    RANGEES.forEach((r, i) => { if (avantE < r && e >= r) { sonDeSalle.clonk(1 - i * 0.15); if (i === 0) sonDeSalle.rumeur(); } });
    ALLUMAGE.forEach(([a, v]) => { if (v > 0 && avantE < a && e >= a) sonDeSalle.neon(v === 1 ? 0.25 : 0.08); });
    eteindre(lumiere, neons); eclairer(lumiere);
    if (e > DUREE_EXTINCTION) fini = true;
  };
}

/**
 * LES LAMPES DES TELEPHONES DANS LES TRIBUNES (l'auteur, 8/11) : pendant la presentation des noms, des points de
 * lumiere qui scintillent chacun a son rythme, puis a moitie jusqu'a l'arrivee. Un seul objet Points (quelques
 * centaines de sommets), additif.
 */
export function lesLampesDuPublic(groupe: THREE.Group, pos: number[], hasard: () => number) {
  const n = pos.length / 3, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const coul = new Float32Array(n * 3), phase = new Float32Array(n), vite = new Float32Array(n);
  for (let i = 0; i < n; i++) { phase[i] = hasard() * 6.28; vite[i] = 0.6 + hasard() * 1.8; }
  geo.setAttribute('color', new THREE.BufferAttribute(coul, 3));
  const tache = peinte(32, 32, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(220,235,255,0.35)'); g.addColorStop(1, 'rgba(200,220,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const mat = new THREE.PointsMaterial({ size: 2.4, map: tache, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.renderOrder = 4; pts.frustumCulled = false;
  groupe.add(pts);
  let k = 0, vu = -1;
  return (t: number) => {
    const dt = vu < 0 ? 0 : Math.min(0.1, t - vu); vu = t;
    // pleine lumiere pendant la presentation, a moitie jusqu'a l'arrivee (le plan de course voit les tribunes)
    const G = (globalThis as any).SprinterApp?.G, st = G?.state;
    const cible = presente >= 0 ? 1 : st === 'count' || st === 'race' || st === 'falseout' ? 0.5 : 0;
    k += (cible - k) * Math.min(1, dt * 2.5);
    pts.visible = k > 0.01;
    if (!pts.visible) return;
    for (let i = 0; i < n; i++) {
      const v = k * (0.55 + 0.45 * Math.sin(t * vite[i] + phase[i]));
      coul[i * 3] = v * 0.95; coul[i * 3 + 1] = v * 0.97; coul[i * 3 + 2] = v;
    }
    geo.attributes.color.needsUpdate = true;
  };
}
const H_TOIT_SALLE = 11.5;   // (sous la charpente de la salle, H_TOIT = 12,5 m dans salle-3d.ts)
/**
 * LE FAUX DEPART EN ROUGE (l'auteur, 9/11) : les lignes de la salle noire virent au rouge une seconde — 0,8 s pleines,
 * 0,2 s pour revenir. Le faux depart du joueur (falseFlash), le rappel du starter en championnat (G.rappel), ou
 * l'elimination (falseout).
 */
export function lesLignesRouges(alerte: (k: number) => void) {
  let avant = false, depuis = -1;
  return (t: number) => {
    const G = (globalThis as any).SprinterApp?.G;
    const faute = !!G && (G.falseFlash > 0 || !!G.rappel || G.state === 'falseout');
    if (faute && !avant) depuis = t;
    avant = faute;
    const e = depuis < 0 ? 99 : t - depuis;
    alerte(e < 0.8 ? 1 : e < 1 ? (1 - e) / 0.2 : 0);
  };
}
/**
 * L'ARRIVEE EN OR (l'auteur, 9/11) : quand le premier passe la ligne, son couloir s'allume en or sur toute sa longueur
 * et son chrono s'ecrit au sol, avant la ligne. La salle reste dans le noir. Aucun nom (championnat : seul « TOI »).
 */
export function lArriveeEnOr(T: any, groupe: THREE.Group) {
  const cw = (T.salle && T.salle.couloir) || LANE_W;
  const bord = peinte(8, 64, (c, w, h) => {   // (plus vif sur les bords du couloir, comme deux tubes)
    for (let y = 0; y < h; y++) { const d = Math.abs(y + 0.5 - h / 2) / (h / 2), a = 0.18 + 0.82 * d ** 6; c.fillStyle = `rgba(255,196,64,${a})`; c.fillRect(0, y, w, 1); }
  });
  const matB = new THREE.MeshBasicMaterial({ map: bord, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const matC = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  for (const m of [matB, matC]) { m.polygonOffset = true; m.polygonOffsetFactor = -8; m.polygonOffsetUnits = -16; m.forceSinglePass = true; }
  const bande = new THREE.Mesh(new THREE.PlaneGeometry(1, cw * 0.96, 120, 1), matB);
  const chrono = new THREE.Mesh(new THREE.PlaneGeometry(7, cw * 0.9, 24, 1), matC);
  bande.renderOrder = chrono.renderOrder = 3; bande.visible = chrono.visible = false; bande.frustumCulled = chrono.frustumCulled = false;
  groupe.add(bande, chrono);
  const plier = (m: THREE.Mesh, k: number, dc: number, sl: number, tourne = 0) => {
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    const base: Float32Array = m.userData.base ??= Float32Array.from(pos.array as Float32Array);
    const sens = Math.cos(tourne), mil = milieu(T, k);
    for (let i = 0; i < pos.count; i++) {
      const d = Math.max(0, dc + base[i * 3] * sl * sens), lat = base[i * 3 + 1] * sens;
      const p = ici(T.posDemi(d, k, mil)), a = capIci(T.heading(d, k));
      const x = p[0] - Math.sin(a) * lat, y = p[1] + Math.cos(a) * lat;
      pos.setXYZ(i, x, y, zSol(x, y) + 0.02);
    }
    pos.needsUpdate = true; m.geometry.computeBoundingSphere();
  };
  let pose = '', depuis = -1;
  return (t: number) => {
    const G = (globalThis as any).SprinterApp?.G;
    let best: any = null;
    // (les adversaires connaissent leur temps des le depart, finished compris : on attend qu'ils passent la ligne)
    for (const r of G?.runners || []) if (r.finished && r.finishTime > 0 && r.d >= T.total && (!best || r.finishTime < best.finishTime)) best = r;
    if (!best) { bande.visible = chrono.visible = false; pose = ''; depuis = -1; return; }
    const k = best.lane | 0, texte = (+best.finishTime).toFixed(2), cle = k + '/' + texte;
    if (cle !== pose) {
      pose = cle; if (depuis < 0) depuis = t;
      plier(bande, k, T.total / 2, T.total);
      plier(chrono, k, Math.max(4, T.total - 7), 1, Math.PI);   // (lu depuis la tribune, comme les noms)
      matC.map?.dispose();
      matC.map = peinte(1024, 160, (x, w, h) => {
        x.translate(0, h); x.scale(1, -1);   // (le monde est en miroir)
        x.font = '900 132px Outfit, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.shadowColor = 'rgba(255,190,50,0.95)'; x.shadowBlur = 26; x.fillStyle = '#ffd34a';
        x.fillText(texte, w / 2, h / 2 + 6, w * 0.9);
      });
      matC.needsUpdate = true;
    }
    const a = Math.min(1, (t - depuis) / 0.6);
    bande.visible = chrono.visible = true;
    matB.opacity = 0.85 * a; matC.opacity = a;
  };
}
export function laPresentationAuSol(T: any, groupe: THREE.Group, fleches?: (k: number, a: number) => void, retard = 0) {
  const n = T.lanes || nCouloirs, cw = (T.salle && T.salle.couloir) || LANE_W;
  type Couloir = { nom: THREE.Mesh; mat: THREE.MeshBasicMaterial; trace: THREE.Mesh; tmat: THREE.MeshBasicMaterial; ecrit: string };
  const couloirs: Couloir[] = [];
  // la trainee : un degrade (la tete a droite, x = 1), additive
  const degrade = peinte(256, 16, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(90,210,255,0)'); g.addColorStop(0.85, 'rgba(120,225,255,0.55)'); g.addColorStop(1, 'rgba(235,252,255,1)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const LN = 9, D_NOM = 7;                         // le nom : 9 m de long, centre a 7 m des blocs
  for (let k = 0; k < n; k++) {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    // (decoupes en tranches : chaque sommet se pose sur la ligne du couloir, le nom epouse le virage — plier)
    const nom = new THREE.Mesh(new THREE.PlaneGeometry(LN, cw * 0.9, 36, 1), mat);
    const tmat = new THREE.MeshBasicMaterial({ map: degrade, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const trace = new THREE.Mesh(new THREE.PlaneGeometry(1, cw * 0.55, 12, 1), tmat);
    nom.renderOrder = trace.renderOrder = 3;
    // (le tartan et les lignes sont tires vers la camera par polygonOffset : le nom l'est davantage, sinon il passe dessous)
    for (const x of [mat, tmat]) { x.polygonOffset = true; x.polygonOffsetFactor = -8; x.polygonOffsetUnits = -16; }
    groupe.add(nom, trace);
    couloirs.push({ nom, mat, trace, tmat, ecrit: '' });
  }
  /** Poser un plan a plat dans le couloir k, centre a d metres de la ligne de depart. */
  /**
   * Plier un plan dans le couloir k, centre a dc metres de la ligne de depart, `sl` fois sa longueur : chaque sommet
   * suit la ligne du couloir et son cap (« les noms dans les virages ne respectent pas les courbes », l'auteur, 9/11).
   * `tourne` = PI : retourne d'un demi-tour (le nom se lit depuis la tribune).
   */
  const plier = (m: THREE.Mesh, k: number, dc: number, sl = 1, tourne = 0) => {
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    const base: Float32Array = m.userData.base ??= Float32Array.from(pos.array as Float32Array);
    const sens = Math.cos(tourne), mil = milieu(T, k);
    for (let i = 0; i < pos.count; i++) {
      const d = Math.max(0, dc + base[i * 3] * sl * sens), lat = base[i * 3 + 1] * sens;
      const p = ici(T.posDemi(d, k, mil)), a = capIci(T.heading(d, k));
      const x = p[0] - Math.sin(a) * lat, y = p[1] + Math.cos(a) * lat;
      pos.setXYZ(i, x, y, zSol(x, y) + 0.02);
    }
    pos.needsUpdate = true; m.geometry.computeBoundingSphere();
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
  };
  const ecrire = (c: Couloir, texte: string, moi: boolean) => {
    if (c.ecrit === texte) return;
    c.ecrit = texte;
    c.mat.map?.dispose();
    // (le monde est en miroir, monde.scale.y = -1 : on ecrit a l'envers pour lire a l'endroit)
    c.mat.map = peinte(1024, 128, (x, w, h) => {
      // (le monde est en miroir, monde.scale.y = -1 : on ecrit retourne pour lire a l'endroit)
      x.translate(0, h); x.scale(1, -1);
      x.font = '900 104px Outfit, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = moi ? 'rgba(255,200,60,0.9)' : 'rgba(150,215,255,0.9)'; x.shadowBlur = 22;
      x.fillStyle = moi ? '#ffd34a' : '#f2f8ff';
      x.fillText(texte, w / 2, h / 2 + 4, w * 0.94);
    });
    c.mat.needsUpdate = true;
  };
  let debut = -1;
  return (t: number) => {
    const G = (globalThis as any).SprinterApp?.G;
    // AU VRAI CHAMPIONNAT, la presentation est celle de la salle (champ-direct.ts) : meme ordre (par couloir), memes
    // 3 s par athlete (salle-championnat.js), et le premier nom quand la salle le dit (dansMs) ; la serie s'est
    // eteinte des l'entree dans la salle (lExtinction part au decompte suspendu).
    const pc = G?.champDirect ? presentationCourante() : undefined;
    const avant = pc !== undefined ? !!pc && G.state === 'count'
      : !!G && ((G.state === 'cut' && G.cut && G.cut.kind === 'intro') || G.state === 'count');
    if (!avant) { debut = -1; presente = -1; for (let k = 0; k < n; k++) { couloirs[k].mat.opacity = couloirs[k].tmat.opacity = 0; fleches?.(k, 1); } return; }
    if (debut < 0) debut = t;
    const e = t - debut - (pc ? pc.presentation.dansMs / 1000 : retard), i = e < 0 ? -1 : Math.floor(e / PRES_PAS), dans = e - i * PRES_PAS;
    const ordre = (G.runners || []).slice().sort((a: any, b: any) => (a.lane | 0) - (b.lane | 0));
    const lui = ordre[i];
    // prototype : le pistolet attend la fin de la presentation (le vrai championnat suspend countT, voir engine.ts)
    const avD = G.avantDepart; if (G.state === 'count' && avD?.attitudes) avD.reste = Math.max(avD.reste, ordre.length * PRES_PAS + 0.5 - e);
    const avantP = presente;
    presente = lui ? (lui.lane | 0) : -1;
    presenteTexte = lui ? (lui.isPlayer ? 'TOI' : String(lui.name || '').toUpperCase()) : '';
    if (presente >= 0 && presente !== avantP) sonDeSalle.ovation(!!lui?.isPlayer);   // le public salue chaque nom
    if (lui) { const q = ici(T.posDemi(D_NOM, presente, milieu(T, presente))); presenteOu.set(q[0], q[1], 0); }
    for (let k = 0; k < n; k++) {
      const c = couloirs[k], r = lui && (lui.lane | 0) === k ? lui : null;
      if (!r) { c.mat.opacity = c.tmat.opacity = 0; fleches?.(k, 1); continue; }
      ecrire(c, r.isPlayer ? 'TOI' : String(r.name || '').toUpperCase(), !!r.isPlayer);
      const fondu = Math.min(1, dans / 0.35, (PRES_PAS - dans) / 0.45);
      c.mat.opacity = Math.max(0, fondu);
      // le nom prend la place des fleches de lumiere de son couloir, qui reviennent quand il se retire (l'auteur, 8/11)
      fleches?.(k, 1 - Math.max(0, fondu));
      plier(c.nom, k, D_NOM, 1, Math.PI);   // (le nom se lit depuis la tribune : retourne d'un demi-tour)
      // le fantome : 60 m au chrono annonce (ou 6,9 s), parti 0,4 s apres le nom
      const chrono = +(r.announced || r.chrono || r.pb || 0) || 6.9, d = Math.max(0, (dans - 0.4) * (60 / chrono));
      // (la trainee nait au bout du nom : additive et blanche, elle fondait les lettres qu'elle traversait)
      const queue = Math.max(D_NOM + LN / 2, d - 7), lt = d - queue;
      c.tmat.opacity = lt > 0 ? Math.max(0, fondu) : 0;
      plier(c.trace, k, queue + Math.max(0, lt) / 2, Math.max(0.01, lt));
    }
  };
}
