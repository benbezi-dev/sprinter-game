// LA COURSE EN VRAIE 3D — la competition dans le noir (decoupe de course-3d.ts, 11/11/2026).

import * as THREE from 'three';
import { zSol } from '../salle-3d';
import { presentationCourante } from '../presentation-directe';
import { LANE_W } from './reglages';
import { milieu, ici, capIci, ouCourt } from './repere';
import { nCouloirs } from '../course-3d';

// LA PRESENTATION DE LA FINALE, ECRITE DANS LA PISTE (Championnat de France du 19/12, l'auteur, 7/11 ;
// la direction : la finale du 100 m de Doha 2019, « en mieux et dans la piste »). Un athlete toutes les
// 3 s : son nom s'ecrit en lumiere, couche dans son couloir, une trainee fantome part des blocs a la
// vitesse de son chrono, puis tout se retire (« ils sont la pour la presentation puis se retirent »).
// Le joueur : « TOI », en or. Au pistolet, plus rien sur la piste — on court dans le noir, lignes allumees.
const PRES_PAS = 3;
export let presente = -1, presenteTexte = '', presenteMoi = false;
/** Le plan de l'extinction (camera.ts) : de la premiere rangee qui tombe au premier nom. */
export let planExtinction = false;
/** Ou en est le creneau de l'athlete presente, en secondes (camera.ts : son gros plan, puis son nom). */
export let presenteDans = 0;
/** L'arrivee en or, de 0 a 1 : les fleches LED s'effacent devant elle (laPresentationAuSol). */
export let orA = 0;
/** Ou s'ecrit le chrono en or (camera.ts : le plan de l'arrivee), et son couloir. */
export const orOu = new THREE.Vector3(); export let orCouloir = -1;
/** « TOI » dans la langue du joueur (YOU en anglais). */
const toi = () => { try { return String((globalThis as any).SprinterApp?.N?.t('you') || 'TOI').toUpperCase(); } catch { return 'TOI'; } };
/** presenteAthlete : ou se tient l'athlete presente (son gros plan, camera.ts). */
export const presenteOu = new THREE.Vector3(), presenteAthlete = new THREE.Vector3(), finCam = new THREE.Vector3(), finVise = new THREE.Vector3();
function peinte(w: number, h: number, peindre: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  peindre(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
/**
 * L'EXTINCTION DE LA SALLE, entre l'appel et le premier nom d'une serie (l'auteur, 8/11 ; refaite le 16/11 : « plus
 * spectaculaire, qui reste en tete », puis « pas assez spectaculaire et trop rapide, il faut de la tension »). Onze
 * secondes, en cinq temps :
 *  1. les plafonniers tombent en trois rangees (0,6 / 1,4 / 2,2 s), chacune son clignotement et son contacteur ;
 *  2. le noir complet, plus de deux secondes : un coeur qui bat dans la halle, et un tube du couloir 1 qui tente de
 *     s'allumer, gresille... et meurt ;
 *  3. les lignes de la piste courue s'allument UNE PAR UNE, lentement d'abord puis de plus en plus vite, comme le
 *     coeur : chaque tube hesite (trois amorces) et sonne une note plus haute que la precedente ;
 *  4. le souffle : toutes les lignes allumees battent avec le coeur, une montee de bruit blanc enfle ;
 *  5. le coup : tout le reste s'allume d'un bloc (la piste qu'on ne court pas, les fleches, les logos, le tapis), un
 *     grand eclair qui fait gonfler les halos et retombe en une seconde et demie, un choc grave et la clameur.
 * La camera (camera.ts) avance lentement vers la piste pendant toute la montee, puis recule d'un coup au dernier coup
 * pour montrer la salle entiere. Elle part au premier moment d'avant-course (le decompte suspendu de l'appel) et ne
 * revient jamais en arriere. La salle du championnat laisse ce temps avant la presentation
 * (worker/src/salle-championnat.js, avantPresentation).
 */
export const DUREE_EXTINCTION = 11;
/** Le dernier coup, en secondes depuis le debut de l'extinction (camera.ts recule a cet instant). */
export const EXT_COUP = 9.2;
/** Ou en est l'extinction, en secondes (camera.ts : son lent travelling). */
export let extinctionE = 0;
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
  /** Une ligne qui s'allume : une note claire (son rang dans la montee), sur le bourdon du tube. */
  note(rang: number) {
    const A = this.audio(); if (!A) return;
    const ctx: AudioContext = A.ctx, t = ctx.currentTime + 0.01;
    const GAMME = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];   // (pentatonique majeure, depuis le la grave)
    const f = 220 * Math.pow(2, GAMME[Math.min(GAMME.length - 1, rang)] / 12);
    for (const [mult, a, type] of [[1, 0.09, 'triangle'], [2, 0.03, 'sine']] as const) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mult;
      const g = this.enveloppe(ctx, t, a, 0.006, 0.9); o.connect(g).connect(A.sortie); o.start(t); o.stop(t + 1);
    }
    this.neon(0.1);
  },
  /** Le dernier coup : un choc grave qui tient, le claquement de tous les contacteurs, et la clameur. */
  coup() {
    const A = this.audio(); if (!A) return;
    const ctx: AudioContext = A.ctx, t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(34, t + 1.2);
    const g = this.enveloppe(ctx, t, 0.7, 0.005, 1.4); o.connect(g).connect(A.sortie); o.start(t); o.stop(t + 1.5);
    this.clonk(1.5); this.ovation(true);
    // la halle renvoie le choc : un grondement qui tient deux secondes
    const n = this.bruit(ctx, 2.2), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    const gn = this.enveloppe(ctx, t, 0.5, 0.01, 2.1); n.connect(lp).connect(gn).connect(A.sortie); n.start(t);
  },
  /** Un battement de coeur, deux coups sourds (lub-dub), plus fort a mesure que la tension monte. */
  coeur(force = 1) {
    const A = this.audio(); if (!A) return;
    const ctx: AudioContext = A.ctx, t0 = ctx.currentTime + 0.01;
    for (const [dt, a] of [[0, 0.5], [0.16, 0.32]] as const) {
      const t = t0 + dt, o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(62, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
      const g = this.enveloppe(ctx, t, a * force, 0.008, 0.22); o.connect(g).connect(A.sortie); o.start(t); o.stop(t + 0.3);
    }
  },
  /** La montee d'avant le coup : un bruit blanc dont le filtre s'ouvre pendant `d` secondes. */
  souffle(d: number) {
    const A = this.audio(); if (!A) return;
    const ctx: AudioContext = A.ctx, t = ctx.currentTime + 0.01;
    const n = this.bruit(ctx, d + 0.1), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(5200, t + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08);
    n.connect(f).connect(g).connect(A.sortie); n.start(t);
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
export function lExtinction(eteindre: (lumiere: number, neons: number, lignesA?: (i: number, n: number) => number, eclat?: number) => void,
                            eclairer: (k: number) => void) {
  const RANGEES = [0.6, 1.4, 2.2];
  // le tube qui rate (couloir 1), la premiere ligne, la derniere : entre elles, des ecarts qui raccourcissent
  // d'un quart a chaque ligne — lent, puis de plus en plus vite —, quel que soit le nombre de lignes
  const RATE = 3.5, LIGNE0 = 4.9, LIGNE_FIN = 8.0, COUP = EXT_COUP, RESSERRE = 0.75;
  const heureLigne = (i: number, n: number) => {
    if (n <= 1) return LIGNE0;
    const S = (k: number) => (1 - Math.pow(RESSERRE, k)) / (1 - RESSERRE);
    return LIGNE0 + (LIGNE_FIN - LIGNE0) * S(i) / S(n - 1);
  };
  /** Une amorce de tube a `f` secondes de son heure : trois hesitations, puis il tient. */
  const amorce = (f: number) => f < 0 ? 0 : f < 0.06 ? 0.7 : f < 0.13 ? 0 : f < 0.2 ? 0.9 : f < 0.27 ? 0.12 : f < 0.33 ? 1 : f < 0.37 ? 0.45 : 1;
  /** Le tube qui rate : quelques sursauts faibles, de plus en plus faibles, puis plus rien. */
  const rate = (f: number) => f < 0 || f > 0.75 ? 0 : [0.35, 0, 0.5, 0.1, 0, 0.25, 0, 0, 0.12, 0, 0, 0, 0.05, 0, 0][Math.floor(f / 0.05)] || 0;
  // le coeur : de plus en plus vite et de plus en plus fort, du noir jusqu'au coup
  const COEUR0 = 2.6;
  const battements: number[] = [];
  for (let b = COEUR0, p = 0.95; b < COUP - 0.15; b += p, p = Math.max(0.36, p * 0.93)) battements.push(b);
  let debut = -1, fini = false, vu = -1, nVu = 9;
  return (t: number) => {
    if (fini) return;
    const dt = vu < 0 ? 0 : t - vu; vu = t;
    const G = (globalThis as any).SprinterApp?.G;
    const avant = !!G && ((G.state === 'cut' && G.cut && G.cut.kind === 'intro') || G.state === 'count');
    if (debut < 0) { if (!avant) return; debut = t; planExtinction = true; }
    const e = t - debut, avantE = e - dt;
    extinctionE = e;
    // 1. la lumiere : un tiers de moins a chaque rangee, et 0,25 s de clignotement au moment ou elle tombe
    let lumiere = 1;
    for (let i = 0; i < RANGEES.length; i++) {
      const f = e - RANGEES[i];
      if (f < 0) break;
      const avantR = 1 - i / RANGEES.length, apres = 1 - (i + 1) / RANGEES.length;
      lumiere = f < 0.25 && Math.floor(f / 0.05) % 2 === 0 ? avantR : apres;
    }
    // le souffle avant le coup : les lignes allumees battent avec le coeur
    let pouls = 1;
    if (e > LIGNE_FIN + 0.4 && e < COUP) {
      let dernier = -1; for (const b of battements) if (b <= e) dernier = b;
      const fb = dernier < 0 ? 1 : e - dernier;
      pouls = 0.55 + 0.45 * Math.min(1, fb / 0.3);
    }
    // 2. le rate ; 3. les lignes, une par une, de plus en plus vite ; 5. le reste d'un bloc, l'eclair en 1,5 s
    const lignesA = (i: number, n: number) => {
      nVu = n;
      const allume = amorce(e - heureLigne(i, n)) * pouls;
      return Math.max(i === 0 ? rate(e - RATE) : 0, allume, e >= COUP ? 1 : 0);
    };
    const neons = e >= COUP ? amorce(e - COUP) : 0;
    const fc = e - COUP, eclat = fc >= 0.1 && fc < 1.6 ? 2.4 * Math.pow(1 - (fc - 0.1) / 1.5, 2) : 0;
    // le son
    RANGEES.forEach((r, i) => { if (avantE < r && e >= r) { sonDeSalle.clonk(1 - i * 0.15); if (i === 0) sonDeSalle.rumeur(); } });
    battements.forEach((b, k) => { if (avantE < b && e >= b) sonDeSalle.coeur(0.5 + 0.5 * k / Math.max(1, battements.length - 1)); });
    if (avantE < RATE && e >= RATE) { sonDeSalle.neon(0.08); setTimeout(() => sonDeSalle.neon(0.05), 110); setTimeout(() => sonDeSalle.neon(0.04), 280); }
    for (let i = 0; i < nVu; i++) { const a = heureLigne(i, nVu); if (avantE < a && e >= a) sonDeSalle.note(i); }
    if (avantE < LIGNE_FIN + 0.4 && e >= LIGNE_FIN + 0.4) sonDeSalle.souffle(COUP - LIGNE_FIN - 0.4);
    if (avantE < COUP && e >= COUP) sonDeSalle.coup();
    eteindre(lumiere, neons, lignesA, eclat); eclairer(lumiere);
    if (e > DUREE_EXTINCTION) { eteindre(0, 1, () => 1, 0); fini = true; }
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
  // (taille en metres, la perspective l'applique : une lampe et son halo font une soixantaine de centimetres. A 2,4 m,
  // chaque point couvrait une quarantaine de pixels a 25 m sur un telephone : le public disparaissait sous une nappe
  // blanche)
  const mat = new THREE.PointsMaterial({ size: 0.6, map: tache, vertexColors: true, transparent: true, depthWrite: false,
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
  let pose = '', depuis = -1, garde: any = null;
  return (t: number) => {
    const G = (globalThis as any).SprinterApp?.G;
    let best: any = null;
    // (les adversaires connaissent leur temps des le depart, finished compris : on attend qu'ils passent la ligne)
    for (const r of G?.runners || []) if (r.finished && r.finishTime > 0 && r.d >= T.total && (!best || r.finishTime < best.finishTime)) best = r;
    // (elle tient jusqu'a la course suivante : a l'arrivee du resultat, les coureurs de la salle sont remplaces et le
    // vainqueur disparaissait de G.runners — l'or s'eteignait au bout de 0,7 s)
    if (!best && pose && G?.state !== 'count') best = garde;
    if (!best) { bande.visible = chrono.visible = false; pose = ''; depuis = -1; orA = 0; orCouloir = -1; garde = null; return; }
    if (best !== garde) garde = { lane: best.lane, finishTime: best.finishTime };
    const k = garde.lane | 0, texte = (+garde.finishTime).toFixed(2), cle = k + '/' + texte;
    if (cle !== pose) {
      pose = cle; if (depuis < 0) depuis = t;
      plier(bande, k, T.total / 2, T.total);
      plier(chrono, k, Math.max(4, T.total - 7), 1, Math.PI);   // (lu depuis la tribune, comme les noms)
      { const q = ici(T.posDemi(Math.max(4, T.total - 7), k, milieu(T, k))); orOu.set(q[0], q[1], 0); orCouloir = k; }
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
    orA = a;   // (au 200 m, les fleches tricolores d'apres la ligne noyaient l'or : elles s'effacent)
  };
}
export function laPresentationAuSol(T: any, groupe: THREE.Group, fleches?: (k: number, a: number) => void, retard = 0,
  lignes?: (k: number, a: number, bleu: number) => void) {
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
  // L'ATHLETE PRESENTE DANS SA LUMIERE (l'auteur, 16/11 : « on doit voir le personnage presente ») : une lampe au-dessus
  // de ses blocs, qui monte et descend avec son nom ; les autres restent dans le noir
  const lampe = new THREE.SpotLight(0xfff1dc, 0, 9, 0.32, 0.7, 1.4);
  groupe.add(lampe, lampe.target);
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
      // (le nom en rouge neon, la couleur du drapeau qui manquait aux lignes ; TOI garde son or)
      x.shadowColor = moi ? 'rgba(255,200,60,0.9)' : 'rgba(255,30,50,0.95)'; x.shadowBlur = 22;
      x.fillStyle = moi ? '#ffd34a' : '#ff3a46';
      x.fillText(texte, w / 2, h / 2 - 6, w * 0.94);
      // LE CHAMPIONNAT DE FRANCE SOUS CHAQUE NOM : un filet bleu, blanc, rouge, de la largeur du nom
      const lw = Math.min(w * 0.94, x.measureText(texte).width), y = h - 14, tiers = lw / 3, x0 = (w - lw) / 2;
      x.shadowBlur = 12;
      ([['#2a5bff', 'rgba(40,90,255,0.9)'], ['#ffffff', 'rgba(220,230,255,0.9)'], ['#ff2a3a', 'rgba(255,30,50,0.9)']] as const)
        .forEach(([coul, halo], i) => { x.shadowColor = halo; x.fillStyle = coul; x.fillRect(x0 + i * tiers, y, tiers, 8); });
    });
    c.mat.needsUpdate = true;
  };
  // LA SALLE AUX COULEURS DU DRAPEAU, LE TEMPS DE LA PRESENTATION SEULEMENT (l'auteur, 15/11) : au premier nom, les
  // fleches LED de l'anneau s'eteignent et les lignes passent au bleu ; apres le dernier, tout revient. Un fondu de
  // FONDU_DRAPEAU secondes, adouci aux deux bouts (« l'extinction doit etre fluide, pas seche ») : `avance` progresse
  // a vitesse constante, `drapeau` en est la courbe en S.
  const FONDU_DRAPEAU = 1.4;
  let debut = -1, plateau: any = null, avance = 0, drapeau = 0, vuT = -1;
  const lisser = (t: number, vers: number) => {
    const dt = vuT < 0 ? 0 : Math.min(0.1, Math.max(0, t - vuT)); vuT = t;
    avance = vers > avance ? Math.min(vers, avance + dt / FONDU_DRAPEAU) : Math.max(vers, avance - dt / FONDU_DRAPEAU);
    drapeau = avance * avance * avance * (avance * (avance * 6 - 15) + 10);
  };
  return (t: number) => {
    const G = (globalThis as any).SprinterApp?.G;
    // (une nouvelle course sans image entre deux, relancee pendant la presentation : elle repart du premier nom,
    // au lieu de se croire finie et de laisser partir le pistolet aussitot)
    if (G?.runners !== plateau) { plateau = G?.runners; debut = -1; }
    // AU VRAI CHAMPIONNAT, la presentation est celle de la salle (champ-direct.ts) : meme ordre (par couloir), memes
    // 3 s par athlete (salle-championnat.js), et le premier nom quand la salle le dit (dansMs) ; la serie s'est
    // eteinte des l'entree dans la salle (lExtinction part au decompte suspendu).
    const pc = G?.champDirect ? presentationCourante() : undefined;
    const avant = pc !== undefined ? !!pc && G.state === 'count'
      : !!G && ((G.state === 'cut' && G.cut && G.cut.kind === 'intro') || G.state === 'count');
    if (!avant) {
      debut = -1; presente = -1; presenteMoi = false; lisser(t, 0); lignes?.(-1, 0, drapeau);
      for (let k = 0; k < n; k++) { couloirs[k].mat.opacity = couloirs[k].tmat.opacity = 0; fleches?.(k, (1 - drapeau) * (1 - orA)); }
      lampe.intensity = 0;
      return;
    }
    if (debut < 0) debut = t;
    const e = t - debut - (pc ? pc.presentation.dansMs / 1000 : retard), i = e < 0 ? -1 : Math.floor(e / PRES_PAS), dans = e - i * PRES_PAS;
    const ordre = (G.runners || []).slice().sort((a: any, b: any) => (a.lane | 0) - (b.lane | 0));
    const lui = ordre[i];
    // prototype : le pistolet attend la fin de la presentation (le vrai championnat suspend countT, voir engine.ts)
    const avD = G.avantDepart; if (G.state === 'count' && avD?.attitudes) avD.reste = Math.max(avD.reste, ordre.length * PRES_PAS + 0.5 - e);
    const avantP = presente;
    presente = lui ? (lui.lane | 0) : -1;
    if (presente >= 0) planExtinction = false;
    presenteDans = Math.max(0, dans);
    presenteMoi = !!lui?.isPlayer;
    presenteTexte = lui ? (lui.isPlayer ? toi() : String(lui.name || '').toUpperCase()) : '';
    if (presente >= 0 && presente !== avantP) sonDeSalle.ovation(!!lui?.isPlayer);   // le public salue chaque nom
    lisser(t, lui ? 1 : 0);
    if (lui) {
      const q = ici(T.posDemi(D_NOM, presente, milieu(T, presente))); presenteOu.set(q[0], q[1], 0);
      // L'ATHLETE DANS LE CADRE, PAS SEULEMENT SON NOM (l'auteur, 16/11) : il attend un metre derriere la ligne
      const a = ouCourt(T, lui); presenteAthlete.set(a[0], a[1], 0);
    }
    else { lignes?.(-1, 0, drapeau); lampe.intensity = 0; }
    for (let k = 0; k < n; k++) {
      const c = couloirs[k], r = lui && (lui.lane | 0) === k ? lui : null;
      if (!r) { c.mat.opacity = c.tmat.opacity = 0; fleches?.(k, 1 - drapeau); continue; }
      ecrire(c, r.isPlayer ? toi() : String(r.name || '').toUpperCase(), !!r.isPlayer);
      const fondu = Math.min(1, dans / 0.35, (PRES_PAS - dans) / 0.45);
      c.mat.opacity = Math.max(0, fondu);
      lignes?.(k, Math.max(0, fondu), drapeau);
      // le nom prend la place des fleches de lumiere de son couloir, qui reviennent quand il se retire (l'auteur, 8/11)
      fleches?.(k, (1 - Math.max(0, fondu)) * (1 - drapeau));
      plier(c.nom, k, D_NOM, 1, Math.PI);   // (le nom se lit depuis la tribune : retourne d'un demi-tour)
      { const b = ouCourt(T, r), z = zSol(b[0], b[1]);
        lampe.position.set(b[0], b[1], z + 5.5); lampe.target.position.set(b[0], b[1], z); lampe.intensity = 60 * Math.max(0, fondu); }
      // le fantome : sa vitesse moyenne sur l'epreuve courue (sa distance, son chrono vise), parti 0,4 s apres le nom.
      // (les coureurs portent `target` et `total` ; `announced`, `chrono`, `pb` n'existaient pas : tous filaient a
      // 60 m en 6,9 s, au 200 et au 400 m compris)
      const dist = +(r.total || T.total || 60), chrono = +(r.announced || r.target || 0);
      const vit = chrono > 0 && dist > 0 ? Math.min(11, dist / chrono) : 60 / 6.9, d = Math.max(0, (dans - 0.4) * vit);
      // (la trainee nait au bout du nom : additive et blanche, elle fondait les lettres qu'elle traversait)
      const queue = Math.max(D_NOM + LN / 2, d - 7), lt = d - queue;
      c.tmat.opacity = lt > 0 ? Math.max(0, fondu) : 0;
      plier(c.trace, k, queue + Math.max(0, lt) / 2, Math.max(0.01, lt));
    }
  };
}
