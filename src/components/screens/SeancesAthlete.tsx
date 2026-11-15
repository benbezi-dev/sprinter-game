import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SprinterApp, SprinterCore } from '@/game/engine';
import {
  type Athlete, type Jour, type Exercice, type Stat, type Seance as ResultatSeance,
  SEANCES, BLESSURES, exerciceDuJour, faireLaSeance,
} from '@/game/athlete/regles';
import { mot, dans, EXOS } from '@/game/athlete/mots';
import { lookDe, apparenceDe } from '@/game/athlete/apparence';
import { tenue, GARDE_ROBE_DE_DEPART } from '@/game/athlete/garde-robe';
import { cheminDe } from '@/game/athlete/corps-gens';
import { charger, pret, dessiner } from '@/game/vedette-3d';
import { POSTURES } from '@/game/athlete/postures';
import { bonusDeSeance } from '@/game/athlete/gens';
import { ouvrirLesDeparts } from '@/game/athlete/departs';
import { sauver as sauverAthlete, demanderReouverture } from '@/game/athlete/carriere';
import { demarrerSequence, pasDuTuto, rangerLeTuto, figerLaPiste } from '@/game/sprint-tuto.js';
import { CLUB_PARTENAIRE, logoDuClub } from '@/game/athlete/partenaires';
import { Seance3D, webglPossible, type Pinceaux } from '@/game/athlete/seance-3d';

/* ---------------------------------------------------------------------------
   LES SEANCES : UN MINI-JEU PAR VRAI EXERCICE, JOUE PAR L'ATHLETE
   ---------------------------------------------------------------------------
   L'auteur, 25/10 : « sois varie sur les mini-jeux, il faut qu'ils
   correspondent aux exercices d'athletisme », puis « rends les mini-jeux plus
   beaux et plus vivants, avec le personnage qui fait vraiment l'exercice ».

   Chaque seance a sa SCENE (Scene, plus bas) : un decor dessine — le stade et
   sa tribune, la cote et ses pins, la salle de musculation, le tapis, le
   virage, le parc — et, au milieu, l'athlete du joueur, avec son corps et sa
   tenue de course (apparence.ts), anime par le moteur du jeu : la foulee suit
   la cadence, les blocs ont leur « a vos marques… prets », et les postures
   que la course ne connait pas (squat, planche, educatifs, bond) viennent de
   postures.ts.

     departs     partir au coup de pistolet ; avant, ou sous 0,100 s : faux depart
     lancee      l'elan, puis la frequence maximale dans la zone lancee
     gammes      suivre l'educatif en rythme (genoux, talons-fesses, pas chasses, griffes)
     virage      tenir la cadence de la courbe : trop vite on sort du couloir
     cotes       monter avant la fin du temps ; la pente rend chaque appui plus court
     muscu       squat : appuyer pour descendre, relacher dans la zone verte
     bonds       taper quand le pied touche le sol
     gainage     garder le corps aligne contre ce qui le fait pencher
     fractionne  tenir l'allure sur trois repetitions ; la zone se resserre
     tempo       rester dans la zone d'allure jusqu'au bout

   Le score va de 0 a 1 ; regles.ts en fait des points de qualite. Le geste
   reste celui de la course : deux zones, gauche et droite, ou les fleches.
--------------------------------------------------------------------------- */

const VERT = '#3DDC84';
const COULEUR: Record<Stat, string> = { vitesse: '#FF5A5F', force: '#F5A623', technique: '#4AA8FF', endurance: VERT };
const borne = (v: number) => Math.max(0, Math.min(1, v));

/* ================================================================ la scene */

type Decor = 'piste' | 'cote' | 'salle' | 'tapis' | 'virage' | 'parc';

/** Ce que les jeux pilotent ; la scene le lit a chaque image. */
type EtatScene = {
  decor: Decor;
  /** Le coureur au sens du moteur : stride, v, enBloc, prets, posture, drivePitch… */
  corps: any;
  /** L'orientation : de profil vers la droite par defaut ; inclinaison vers la corde en virage. */
  cap: number; incline: number;
  /** Les metres parcourus : le decor defile d'autant. */
  defile: number;
  /** La pente de la cote, en radians ; la hauteur d'un bond, en metres. */
  pente: number; vol: number;
  /** Le decalage vertical dans le couloir (virage), de -1 a 1. */
  couloir: number;
  /** Profondeur du squat (0 a 1), ou null : pas de barre. */
  barre: number | null;
  /** Un eclair de couleur (le pistolet, une faute) ; la fumee du pistolet. */
  flash: number; couleurFlash: string; fumee: number;
  /** La sueur, de 0 a 1 ; une zone a marquer sur la piste ([debut, fin] en metres). */
  sueur: number; zone: [number, number] | null;
};

const PROFIL = Math.PI / 2 + 0.2;

function nouvelEtat(look: any, decor: Decor): EtatScene {
  return {
    decor,
    corps: { look, stride: 0, v: 0, maxSpeed: 12, fallAnim: 0, celebrate: 0, drivePitch: 0, d: 0, legStart: 0 },
    cap: PROFIL, incline: 0, defile: 0, pente: 0, vol: 0, couloir: 0, barre: null,
    flash: 0, couleurFlash: '#FFFFFF', fumee: 0, sueur: 0, zone: null,
  };
}

/** Faire avancer la foulee a la vitesse `v` (m/s) : la phase suit la longueur de foulee du gabarit. */
function courir(e: EtatScene, v: number, dt: number) {
  const c = e.corps;
  c.v = v;
  const h = (c.look && c.look.h) || 1.8;
  c.stride += v * dt * Math.PI / (1.25 * h);
  e.defile += v * dt;
  c.d = (c.d || 0) + v * dt;
}

/** Le point le plus bas du corps, dans la projection du moteur : on l'aligne sur le sol. */
function plusBas(caps: any[]): number {
  const S = (SprinterCore as any).C.ISO_SIN;
  let m = Infinity;
  for (const c of caps) for (const e of [c[1], c[2]]) {
    const s = (e[0] + e[1]) * S + e[2] - (e[3] || 0);
    if (s < m) m = s;
  }
  return m;
}

/** Des taches qui ne bougent pas d'une image a l'autre (public, arbres) : un tirage fixe. */
const fixe = (i: number) => ((Math.sin(i * 127.1) * 43758.5453) % 1 + 1) % 1;

type Particule = { x: number; y: number; vx: number; vy: number; t: number; c: string; r: number; nuage?: boolean };

/** Le logo du club partenaire, charge une fois (partenaires.ts). */
const LOGO: HTMLImageElement | null = (() => { const s = logoDuClub(); if (!s || typeof Image === 'undefined') return null; const i = new Image(); i.src = s; return i; })();

function Scene({ etat }: { etat: React.MutableRefObject<EtatScene> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hote = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cv = ref.current!; const c = cv.getContext('2d')!;
    const A = SprinterApp as any;
    // LE LIEU EN 3D (seance-3d.ts) ; la 2D ne garde que les effets par-dessus. Sans WebGL : tout en 2D.
    let s3: Seance3D | null = null;
    if (webglPossible()) {
      try { s3 = new Seance3D(etat.current.decor, etat.current.corps.look, PINCEAUX); hote.current!.appendChild(s3.toile); }
      catch { s3 = null; }
    }
    let id = 0, avant = 0, piedAvant = 0, sol0: number | null = null;
    const parts: Particule[] = [];
    const tic = (ms: number) => {
      const dt = Math.min(0.05, avant ? (ms - avant) / 1000 : 0); avant = ms;
      // 2x au plus : au-dela, le telephone remplit 2,25 fois plus de pixels pour une nettete invisible
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const e = etat.current;
      const allonge = e.decor === 'tapis';
      let k = Math.min(H * 0.3, W * 0.42) * (allonge ? 0.72 : 1);   // l'echelle du corps : ~1,45 k de haut
      let ppm = k * 0.8;                                             // pixels par metre
      let sol = H * 0.8 + e.couloir * H * 0.05;
      let ax = W * (allonge ? 0.62 : 0.42);
      let corps3d = false;
      if (s3) {
        const p = s3.rendre(e, ms / 1000, W, H);
        ({ ax, sol, ppm } = p); k = ppm / 0.8; corps3d = p.corps;
        c.clearRect(0, 0, W, H);
      } else decor(c, e, W, H, ppm, sol, ax, ms / 1000);

      // le corps : ses volumes, poses sur le sol par leur point le plus bas
      const caps = A.personCapsules(e.corps, e.cap, e.incline, false, false, A.niveauDetail(k));
      if (sol0 === null) {
        const debout = { look: e.corps.look, stride: 0, v: 0, maxSpeed: 12, fallAnim: 0, celebrate: 0, drivePitch: 0, debout: 1 };
        sol0 = plusBas(A.personCapsules(debout, e.cap, 0, false, false, A.niveauDetail(k)));
      }
      const leve = (plusBas(caps) - sol0) * k;
      const y = sol + leve - e.vol * ppm;
      if (!corps3d) {
      // l'ombre, qui s'ecarte quand on vole
      const o = Math.max(0.3, 1 - e.vol * 0.8);
      c.fillStyle = `rgba(0,0,0,${0.28 * o})`;
      c.beginPath(); c.ellipse(ax, sol, k * 0.42 * o, k * 0.09 * o, 0, 0, Math.PI * 2); c.fill();
      const yBarre = sol - (1.24 - 0.42 * (e.barre || 0)) * k, xBarre = ax - k * (0.06 + 0.12 * (e.barre || 0));
      if (e.barre !== null) barre(c, xBarre, yBarre, k, false);
      const chemin = e.corps.look.maillage;
      if (!(chemin && pret(chemin) && dessiner(c, chemin, e.corps.squelette || null,
        A.repereDuCoureur(e.corps, e.cap, e.incline, false, false), ax, y, k, e.corps.look))) A.drawFacetFigure(c, caps, ax, y, k);
      if (e.barre !== null) barre(c, xBarre, yBarre, k, true);
      }

      // la poussiere a chaque appui, les traits de vitesse, la sueur
      const v = e.corps.v || 0;
      const pied = Math.floor((e.corps.stride || 0) / Math.PI);
      if (pied !== piedAvant && v > 2 && e.vol < 0.05) {
        // une bouffee qui gonfle et se dissout, et quelques grains projetes
        const terre = e.decor === 'cote' || e.decor === 'parc';
        for (let i = 0; i < 3; i++) parts.push({ x: ax - k * 0.08, y: sol - 2, vx: -v * ppm * 0.05 - Math.random() * 25, vy: -8 - Math.random() * 14, t: 0.7, c: terre ? 'rgba(196,170,128,0.55)' : 'rgba(236,176,150,0.5)', r: 3 + Math.random() * 3, nuage: true });
        for (let i = 0; i < 3; i++) parts.push({ x: ax - k * 0.1, y: sol, vx: -v * ppm * 0.08 - Math.random() * 40, vy: -20 - Math.random() * 40, t: 0.5, c: terre ? '#9C8058' : '#C9614A', r: 1.2 + Math.random() * 1.5 });
      }
      piedAvant = pied;
      if (e.sueur > 0.4 && Math.random() < e.sueur * dt * 8) parts.push({ x: ax + k * 0.05, y: y - k * 1.3, vx: (Math.random() - 0.5) * 30, vy: -30, t: 0.8, c: '#BFE6FF', r: 2 });
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t -= dt; if (p.t <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.nuage) { p.vx *= 1 - dt * 2.5; p.vy *= 1 - dt * 2; p.r += dt * 22; } else p.vy += 160 * dt;
        c.globalAlpha = Math.min(1, p.t * 2); c.fillStyle = p.c;
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
      if (v > 7.5) {
        c.strokeStyle = `rgba(255,255,255,${Math.min(0.5, (v - 7.5) / 8)})`; c.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const yy = y - k * (0.2 + fixe(i) * 1.2), l = 30 + fixe(i + 9) * 60, x0 = ax - k * 0.5 - ((ms / 3 + fixe(i + 3) * 400) % 220);
          c.beginPath(); c.moveTo(x0, yy); c.lineTo(x0 - l, yy); c.stroke();
        }
      }
      // une vignette douce : l'oeil va au centre, sur l'athlete
      const vg = c.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.4, W / 2, H * 0.55, Math.max(W, H) * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,10,20,0.3)');
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
      // le pistolet : un eclair, de la fumee en haut a gauche
      if (e.fumee > 0) {
        e.fumee = Math.max(0, e.fumee - dt * 0.7);
        c.fillStyle = `rgba(240,240,240,${e.fumee * 0.8})`;
        for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(W * 0.12 + i * 9 * (1.4 - e.fumee), H * 0.2 - i * 6 * (1.4 - e.fumee), 10 + i * 4 * (1.4 - e.fumee), 0, Math.PI * 2); c.fill(); }
      }
      if (e.flash > 0) {
        e.flash = Math.max(0, e.flash - dt * 2.5);
        c.globalAlpha = e.flash * 0.5; c.fillStyle = e.couleurFlash; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
      }
      id = requestAnimationFrame(tic);
    };
    id = requestAnimationFrame(tic);
    return () => { cancelAnimationFrame(id); if (s3) { s3.toile.remove(); s3.detruire(); } };
  }, []);
  return (
    <>
      <div ref={hote} className="absolute inset-0" />
      <canvas ref={ref} className="absolute inset-0 w-full h-full" />
    </>
  );
}

/** La barre de squat vue de trois quarts : les disques devant et derriere le corps. */
function barre(c: CanvasRenderingContext2D, x: number, y: number, k: number, devant: boolean) {
  const dx = k * 0.34, dy = k * 0.1, r = k * 0.27;
  const [px, py] = devant ? [x + dx, y + dy] : [x - dx, y - dy];
  c.strokeStyle = '#9AA0A8'; c.lineWidth = Math.max(3, k * 0.04);
  if (devant) { c.beginPath(); c.moveTo(x, y); c.lineTo(px + dx * 0.6, py + dy * 0.6); c.stroke(); }
  else { c.beginPath(); c.moveTo(px - dx * 0.6, py - dy * 0.6); c.lineTo(x, y); c.stroke(); }
  c.fillStyle = devant ? '#1F2933' : '#141B22';
  c.beginPath(); c.ellipse(px, py, r * 0.32, r, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = devant ? '#C0392B' : '#8E2A20';
  c.beginPath(); c.ellipse(px, py, r * 0.22, r * 0.72, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#D5D9DE';
  c.beginPath(); c.ellipse(px, py, r * 0.07, r * 0.16, 0, 0, Math.PI * 2); c.fill();
}

/* ------------------------------------------------------------- les decors */
/*
   Refaits le 15/11 (l'auteur : « des animations et decors plus propres et beaux pour les
   mini-jeux ») : des plans successifs voiles par la distance, la lumiere du soleil, un vrai
   public, des arbres qui respirent. Ce qui ne bouge pas (la tribune, le grain de la piste)
   est peint une fois dans une toile hors ecran puis recopie : rien de lourd a chaque image,
   pour les telephones faibles. Les cotes du jeu (sol, ax, ppm) ne changent pas.
*/

const TOUR = Math.PI * 2;
const disque = (c: CanvasRenderingContext2D, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, TOUR); c.fill(); };

const caches = new Map<string, HTMLCanvasElement>();
/** Une toile hors ecran peinte une fois (`ech` pixels par unite), gardee par sa cle. */
function cache(cle: string, w: number, h: number, peindre: (c: CanvasRenderingContext2D, w: number, h: number) => void, ech = 2) {
  let t = caches.get(cle);
  if (!t) {
    t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(w * ech)); t.height = Math.max(1, Math.round(h * ech));
    const c = t.getContext('2d')!; c.scale(ech, ech); peindre(c, w, h);
    caches.set(cle, t);
    if (caches.size > 16) caches.delete(caches.keys().next().value as string);
  }
  return t;
}

/** Une toile repetee en bande horizontale, glissee de `decal` pixels (la parallaxe). */
function frise(c: CanvasRenderingContext2D, t: HTMLCanvasElement, w: number, h: number, y: number, decal: number, W: number) {
  const off = ((decal % w) + w) % w;
  for (let x = -off; x < W; x += w) c.drawImage(t, x, y, w, h);
}

/** Le grain d'un sol (tartan, gravier) : des points fixes, une tuile de 64 px. */
let motifGrain: CanvasPattern | null = null;
function grain(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, decal: number, alpha: number) {
  if (!motifGrain) {
    const t = cache('grain', 64, 64, (g) => {
      for (let i = 0; i < 300; i++) {
        g.fillStyle = fixe(i + 0.5) < 0.6 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.45)';
        g.fillRect(Math.floor(fixe(i * 2.1) * 64), Math.floor(fixe(i * 3.7 + 1) * 64), 1, 1);
      }
    }, 1);
    motifGrain = c.createPattern(t, 'repeat');
  }
  if (!motifGrain) return;
  c.save(); c.globalAlpha = alpha; c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.translate(-(((decal % 64) + 64) % 64), 0); c.fillStyle = motifGrain; c.fillRect(x, y, w + 64, h);
  c.restore();
}

function ciel(c: CanvasRenderingContext2D, W: number, H: number, haut: string, bas: string, soleil?: [number, number]) {
  const g = c.createLinearGradient(0, 0, 0, H * 0.6);
  g.addColorStop(0, haut); g.addColorStop(1, bas);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (soleil) {
    const [sx, sy] = soleil, r = Math.max(W, H) * 0.4;
    const s = c.createRadialGradient(sx, sy, 0, sx, sy, r);
    s.addColorStop(0, 'rgba(255,250,228,1)'); s.addColorStop(0.05, 'rgba(255,246,215,0.9)');
    s.addColorStop(0.18, 'rgba(255,238,195,0.3)'); s.addColorStop(1, 'rgba(255,238,195,0)');
    c.fillStyle = s; c.fillRect(0, 0, W, H);
  }
}

/** Des cumulus : un dessous gris-bleu, des bouffees blanches, qui derivent lentement. */
function nuages(c: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const B: [number, number, number][] = [[0, 0, 20], [19, -10, 17], [37, -3, 19], [-17, 3, 14], [54, 4, 13]];
  for (let i = 0; i < 4; i++) {
    const L = W * 1.8, s = 0.65 + fixe(i + 2) * 0.6;
    const x = ((fixe(i) * L - t * (4 + i * 2.5)) % L + L) % L - W * 0.4, y = H * (0.05 + fixe(i + 5) * 0.15);
    c.fillStyle = 'rgba(160,182,210,0.5)';
    c.beginPath(); c.ellipse(x + 18 * s, y + 9 * s, 50 * s, 10 * s, 0, 0, TOUR); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.97)';
    c.beginPath(); for (const [dx, dy, r] of B) { c.moveTo(x + (dx + r) * s, y + dy * s); c.arc(x + dx * s, y + dy * s, r * s, 0, TOUR); } c.fill();
    c.fillStyle = 'rgba(214,226,242,0.7)';
    c.beginPath(); c.ellipse(x + 18 * s, y + 10 * s, 44 * s, 6 * s, 0, 0, TOUR); c.fill();
  }
}

/** Une ligne de crete (montagnes, collines, lisiere) qui glisse de `decal` pixels. */
function crete(c: CanvasRenderingContext2D, W: number, H: number, base: number, amp: number, onde: number, decal: number, couleur: string | CanvasGradient) {
  c.fillStyle = couleur; c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W + 12; x += 12) {
    const u = (x + decal) / onde;
    c.lineTo(x, base - amp * (0.55 * Math.sin(u) + 0.3 * Math.sin(u * 2.3 + 1.7) + 0.15 * Math.sin(u * 5.1 + 0.4)));
  }
  c.lineTo(W, H); c.closePath(); c.fill();
}

/** La brume de la distance, entre deux hauteurs. */
function brume(c: CanvasRenderingContext2D, W: number, y0: number, y1: number, rvb: string, a: number) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, `rgba(${rvb},0)`); g.addColorStop(0.6, `rgba(${rvb},${a})`); g.addColorStop(1, `rgba(${rvb},0)`);
  c.fillStyle = g; c.fillRect(0, y0, W, y1 - y0);
}

type Dessin = (c: CanvasRenderingContext2D, x: number, base: number, s: number, i: number) => void;

/**
 * Une rangee d'objets qui defile a `vitesse` fois le sol, de `metres` de haut, tous les `pasM` metres.
 * A L'ECHELLE DE L'ATHLETE (l'auteur, 26/10) : une rangee qui defile a 0,1 fois le sol est 10 fois
 * plus loin, donc 10 fois plus petite. Chaque objet garde son tirage d'une image a l'autre.
 */
function rangee(c: CanvasRenderingContext2D, W: number, base: number, defile: number, ppm: number, vitesse: number, metres: number, pasM: number, dessin: Dessin) {
  const taille = metres * ppm * vitesse, pas = pasM * ppm * vitesse;
  const glisse = defile * ppm * vitesse, i0 = Math.floor(glisse / pas), off = glisse - i0 * pas;
  for (let x = -off - pas, i = i0 - 1; x < W + pas * 1.5; x += pas, i++) {
    if (fixe(i * 3.7 + metres) < 0.15) continue;
    dessin(c, x + (fixe(i * 1.3 + 2) - 0.5) * pas * 0.6, base, taille * (0.75 + fixe(i + metres * 11) * 0.5), i);
  }
}

const pin = (clair: string, sombre: string): Dessin => (c, x, b, s) => {
  c.fillStyle = '#4A3424'; c.fillRect(x - s * 0.03, b - s * 0.16, s * 0.06, s * 0.16);
  for (let k = 0; k < 3; k++) {
    const y0 = b - s * (0.1 + k * 0.25), w = s * (0.25 - k * 0.055), h = s * 0.42;
    c.fillStyle = clair; c.beginPath(); c.moveTo(x - w, y0); c.lineTo(x, y0 - h); c.lineTo(x + w, y0); c.closePath(); c.fill();
    c.fillStyle = sombre; c.beginPath(); c.moveTo(x, y0 - h); c.lineTo(x + w, y0); c.lineTo(x + w * 0.05, y0); c.closePath(); c.fill();
  }
};

const feuillu = (clair: string, sombre: string, reflet: string, t: number): Dessin => (c, x, b, s, i) => {
  const bal = Math.sin(t * 0.9 + i) * s * 0.012;   // le houppier respire au vent
  c.fillStyle = '#5A3E2A'; c.fillRect(x - s * 0.045, b - s * 0.48, s * 0.09, s * 0.48);
  c.fillStyle = sombre;
  disque(c, x + bal, b - s * 0.6, s * 0.33); disque(c, x - s * 0.22 + bal, b - s * 0.53, s * 0.23); disque(c, x + s * 0.24 + bal, b - s * 0.55, s * 0.25);
  c.fillStyle = clair;
  disque(c, x - s * 0.03 + bal * 1.4, b - s * 0.7, s * 0.28); disque(c, x - s * 0.2 + bal, b - s * 0.62, s * 0.18); disque(c, x + s * 0.19 + bal, b - s * 0.65, s * 0.2);
  c.fillStyle = reflet; disque(c, x - s * 0.1 + bal * 1.6, b - s * 0.82, s * 0.13);
};

const PEAUX_FOULE = ['#F1C9A5', '#D9A577', '#A86F45', '#7A4A2C', '#4E2E1C'];
const MAILLOTS_FOULE = ['#E74C3C', '#3498DB', '#F1C40F', '#ECF0F1', '#2ECC71', '#9B59B6', '#E67E22', '#1ABC9C', '#34495E'];

/** La tribune et son public, peints une fois : six gradins, des gens assis, quelques bras leves. */
function peindreTribune(g: CanvasRenderingContext2D, w: number, h: number) {
  const R = 6, rh = h / R;
  for (let r = 0; r < R; r++) {
    g.fillStyle = r % 2 ? '#3D4A5D' : '#48566C'; g.fillRect(0, r * rh, w, rh);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, r * rh + rh - 1.5, w, 1.5);
    for (let x = 5, i = 0; x < w - 4; x += 7.5, i++) {
      const n = r * 97 + i;
      if (fixe(n) < 0.12) continue;
      const yb = r * rh + rh - 1.5, bh = rh * 0.42, bx = x + (fixe(n + 11) - 0.5) * 2;
      g.fillStyle = MAILLOTS_FOULE[Math.floor(fixe(n + 7) * MAILLOTS_FOULE.length)];
      g.fillRect(bx - 3, yb - bh, 6, bh);
      g.fillStyle = PEAUX_FOULE[Math.floor(fixe(n + 3) * PEAUX_FOULE.length)];
      disque(g, bx, yb - bh - 2.3, 2.4);
      if (fixe(n + 13) > 0.9) { g.fillRect(bx + 2.2, yb - bh - 6, 1.6, 6); }
    }
  }
  // l'ombre du toit sur les gradins du haut
  const o = g.createLinearGradient(0, 0, 0, h * 0.5);
  o.addColorStop(0, 'rgba(8,14,30,0.55)'); o.addColorStop(1, 'rgba(8,14,30,0)');
  g.fillStyle = o; g.fillRect(0, 0, w, h * 0.5);
}

function decor(c: CanvasRenderingContext2D, e: EtatScene, W: number, H: number, ppm: number, sol: number, ax: number, t: number) {
  const d = e.defile;
  switch (e.decor) {
    case 'piste': case 'virage': {
      ciel(c, W, H, '#3F86CC', '#CFE6F5', [W * 0.82, H * 0.06]); nuages(c, W, H, t);
      const tH = H * 0.2, tY = H * 0.24, pY = tY + tH + H * 0.07;
      // les pylones d'eclairage, derriere le toit
      for (const f of [0.12, 0.88]) {
        const px = ((f * W * 1.6 - d * ppm * 0.18) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3;
        c.fillStyle = '#7E8794'; c.fillRect(px - 2, tY - H * 0.16, 4, H * 0.16);
        c.fillStyle = '#5B6470'; c.fillRect(px - 14, tY - H * 0.19, 28, H * 0.035);
        c.fillStyle = '#FFF7DA'; for (let j = 0; j < 4; j++) c.fillRect(px - 12 + j * 6.4, tY - H * 0.185, 4.6, H * 0.024);
      }
      // la tribune, son public, son toit
      const tw = 360, tuile = cache(`tribune${Math.round(tH)}`, tw, tH, peindreTribune);
      frise(c, tuile, tw, tH, tY, d * ppm * 0.25, W);
      const toit = c.createLinearGradient(0, tY - H * 0.05, 0, tY);
      toit.addColorStop(0, '#DDE3EA'); toit.addColorStop(0.55, '#B8C1CC'); toit.addColorStop(1, '#6E7886');
      c.fillStyle = toit; c.fillRect(0, tY - H * 0.05, W, H * 0.05);
      c.strokeStyle = 'rgba(60,70,84,0.45)'; c.lineWidth = 1.5;
      const pasT = 46, offT = ((d * ppm * 0.25) % pasT + pasT) % pasT;
      for (let x = -offT; x < W + pasT; x += pasT) { c.beginPath(); c.moveTo(x, tY - H * 0.05); c.lineTo(x + pasT * 0.5, tY); c.lineTo(x + pasT, tY - H * 0.05); c.stroke(); }
      // trois drapeaux agites dans le public
      for (let i = 0; i < 3; i++) {
        const fx = ((fixe(i + 40) * W * 1.5 - d * ppm * 0.25) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.2;
        const fy = tY + tH * (0.3 + fixe(i + 41) * 0.5), ond = Math.sin(t * 6 + i * 2);
        c.strokeStyle = '#2B2F36'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 18); c.stroke();
        c.fillStyle = ['#FFD23F', '#E63946', '#2A9D8F'][i];
        c.beginPath(); c.moveTo(fx, fy - 18); c.quadraticCurveTo(fx + 7, fy - 20 + ond * 2, fx + 14, fy - 17 + ond * 3);
        c.lineTo(fx + 14, fy - 10 + ond * 3); c.quadraticCurveTo(fx + 7, fy - 13 + ond * 2, fx, fy - 11); c.closePath(); c.fill();
      }
      // la barriere et ses panneaux
      const bY = tY + tH, bH = H * 0.05;
      c.fillStyle = '#14304D'; c.fillRect(0, bY, W, bH);
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, bY, W, 2);
      if (CLUB_PARTENAIRE) {
        // le club partenaire (partenaires.ts) : ses panneaux defilent au bord de la piste
        const pas = W * 0.7, off2 = ((d * ppm) % pas + pas) % pas;
        for (let x = -off2; x < W + pas; x += pas) {
          c.fillStyle = CLUB_PARTENAIRE.couleurs[0]; c.fillRect(x, bY + 2, W * 0.5, bH - 3);
          if (LOGO && LOGO.complete && LOGO.naturalWidth) {
            const h = H * 0.04, l = h * LOGO.naturalWidth / LOGO.naturalHeight;
            c.drawImage(LOGO, x + 6, bY + 2 + H * 0.004, l, h);
          }
          c.fillStyle = CLUB_PARTENAIRE.couleurs[1]; c.font = `900 ${Math.round(H * 0.026)}px system-ui`; c.textAlign = 'left';
          c.fillText(CLUB_PARTENAIRE.court, x + H * 0.1, bY + H * 0.035);
        }
      } else {
        const pas = W * 0.55, off2 = ((d * ppm) % pas + pas) % pas;
        c.font = `900 ${Math.round(H * 0.024)}px system-ui`; c.textAlign = 'center';
        for (let x = -off2; x < W + pas; x += pas) { c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillText('SPRINTER', x + pas / 2, bY + bH * 0.68); }
      }
      // l'herbe, tondue en bandes
      const hY = bY + bH, hH = pY - hY;
      c.fillStyle = '#5C9A4D'; c.fillRect(0, hY, W, hH);
      c.fillStyle = '#69A859';
      const pasH = 36, offH = ((d * ppm * 0.6) % (pasH * 2) + pasH * 2) % (pasH * 2);
      for (let x = -offH; x < W; x += pasH * 2) c.fillRect(x, hY, pasH, hH);
      // la piste : le tartan plus sombre au loin, son grain, ses couloirs
      const tg = c.createLinearGradient(0, pY, 0, H);
      tg.addColorStop(0, '#A3402A'); tg.addColorStop(1, '#D8623F');
      c.fillStyle = tg; c.fillRect(0, pY, W, H - pY);
      grain(c, 0, pY, W, H - pY, d * ppm, 0.35);
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, pY, W, 3);
      c.strokeStyle = 'rgba(255,255,255,0.88)';
      const lignes = [0, 0.13, 0.3, 0.52, 0.8, 1.15];
      lignes.forEach((f, i) => {
        const yy = pY + f * (H - pY) * 0.86;
        c.lineWidth = 1 + i * 0.4;
        if (e.decor === 'virage') {
          c.beginPath();
          for (let x = 0; x <= W; x += 12) { const u = (x - W / 2) / W; c.lineTo(x, yy - u * u * H * 0.18 * (1 + i * 0.2)); }
          c.stroke();
        } else { c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke(); }
      });
      // les reperes tous les 10 m
      c.fillStyle = 'rgba(255,255,255,0.92)'; c.font = `800 ${Math.round(ppm * 0.35)}px system-ui`; c.textAlign = 'center';
      for (let m = Math.floor((d - ax / ppm) / 10) * 10; m < d + (W - ax) / ppm + 10; m += 10) {
        const x = ax + (m - d) * ppm;
        c.fillRect(x - 1.5, pY + (H - pY) * 0.45, 3, (H - pY) * 0.5);
        if (m > 0) c.fillText(`${m}`, x, pY + (H - pY) * 0.4);
      }
      // la zone a marquer (vitesse lancee) : un liseré dore et des plots
      if (e.zone) {
        const x0 = ax + (e.zone[0] - d) * ppm, x1 = ax + (e.zone[1] - d) * ppm;
        const zg = c.createLinearGradient(0, sol - ppm * 0.4, 0, sol + ppm * 0.2);
        zg.addColorStop(0, 'rgba(255,214,90,0)'); zg.addColorStop(1, 'rgba(255,214,90,0.45)');
        c.fillStyle = zg; c.fillRect(x0, sol - ppm * 0.4, x1 - x0, ppm * 0.6);
        for (const x of [x0, x1]) {
          c.fillStyle = '#FF8A00'; c.beginPath(); c.moveTo(x - 8, sol + 2); c.lineTo(x + 8, sol + 2); c.lineTo(x, sol - 22); c.closePath(); c.fill();
          c.fillStyle = '#FFFFFF'; c.fillRect(x - 4.5, sol - 11, 9, 3);
        }
      }
      // les blocs de depart, poses a 0 m : le rail et ses deux cales
      const bx = ax + (0 - d) * ppm;
      if (bx > -80 && bx < W + 80) {
        c.fillStyle = '#2E333A'; c.fillRect(bx - ppm * 0.95, sol - 4, ppm * 0.8, 4);
        for (const [dx, l] of [[-0.82, 0.17], [-0.42, 0.14]] as const) {
          c.save(); c.translate(bx + dx * ppm, sol - 4); c.rotate(-0.75);
          c.fillStyle = '#D7DCE2'; c.fillRect(-ppm * 0.02, -ppm * l, ppm * 0.09, ppm * l);
          c.fillStyle = '#E63946'; c.fillRect(ppm * 0.055, -ppm * l, ppm * 0.03, ppm * l);
          c.restore();
        }
      }
      break;
    }
    case 'cote': {
      ciel(c, W, H, '#4F93D3', '#F3E7CF', [W * 0.18, H * 0.1]); nuages(c, W, H, t);
      // la montagne au loin, puis les collines boisees, puis la cote elle-meme qui monte vers la droite
      crete(c, W, H, H * 0.42, H * 0.07, 130, d * ppm * 0.02, '#A4B9CF');
      crete(c, W, H, H * 0.47, H * 0.045, 75, d * ppm * 0.04, '#8AA9A6');
      rangee(c, W, H * 0.5, d, ppm, 0.05, 16, 3.5, pin('#4F7C67', '#40695A'));
      brume(c, W, H * 0.36, H * 0.54, '226,234,240', 0.55);
      crete(c, W, H, H * 0.55, H * 0.025, 90, d * ppm * 0.1, '#7DAF63');
      rangee(c, W, H * 0.565, d, ppm, 0.1, 14, 5, pin('#2F6B3E', '#24573A'));
      const p = Math.tan(e.pente);
      const yAt = (x: number) => sol - (x - ax) * p;
      const pente = c.createLinearGradient(0, yAt(W), 0, H);
      pente.addColorStop(0, '#7DB862'); pente.addColorStop(1, '#4C863B');
      c.fillStyle = pente;
      c.beginPath(); c.moveTo(0, yAt(0)); c.lineTo(W, yAt(W)); c.lineTo(W, H); c.lineTo(0, H); c.fill();
      // des touffes d'herbe le long du chemin, qui defilent avec le sol
      c.strokeStyle = '#3F7A31'; c.lineWidth = 1.6;
      for (let m = Math.floor(d - ax / ppm); m < d + (W - ax) / ppm + 1; m += 0.8) {
        const i = Math.round(m / 0.8), x = ax + (m - d) * ppm + fixe(i) * ppm * 0.4, y = yAt(x) - ppm * 0.18 - fixe(i + 4) * ppm * 0.12;
        c.beginPath(); c.moveTo(x - 3, y - 7); c.lineTo(x, y); c.lineTo(x + 3, y - 8); c.moveTo(x, y); c.lineTo(x + 1, y - 10); c.stroke();
      }
      // le chemin de terre, bord plus sombre
      c.lineCap = 'round';
      c.strokeStyle = '#A88D5E'; c.lineWidth = ppm * 0.56;
      c.beginPath(); c.moveTo(0, yAt(0) + ppm * 0.12); c.lineTo(W, yAt(W) + ppm * 0.12); c.stroke();
      c.strokeStyle = '#CDB585'; c.lineWidth = ppm * 0.42;
      c.beginPath(); c.moveTo(0, yAt(0) + ppm * 0.1); c.lineTo(W, yAt(W) + ppm * 0.1); c.stroke();
      c.lineCap = 'butt';
      // les fanions tous les 10 m, qui flottent
      for (let m = Math.floor((d - ax / ppm) / 10) * 10; m < d + (W - ax) / ppm + 10; m += 10) {
        if (m < 0 || m > 60) continue;
        const x = ax + (m - d) * ppm, y = yAt(x), ond = Math.sin(t * 5 + m) * ppm * 0.04;
        c.fillStyle = '#5D4630'; c.fillRect(x - 1.5, y - ppm * 0.9, 3, ppm * 0.9);
        c.fillStyle = m === 60 ? '#F1C40F' : '#E74C3C';
        c.beginPath(); c.moveTo(x + 1.5, y - ppm * 0.9);
        c.quadraticCurveTo(x + ppm * 0.25, y - ppm * 0.86 + ond, x + ppm * 0.48, y - ppm * 0.78 + ond * 1.5);
        c.quadraticCurveTo(x + ppm * 0.25, y - ppm * 0.7 + ond, x + 1.5, y - ppm * 0.66); c.fill();
        c.fillStyle = '#fff'; c.font = `800 ${Math.round(ppm * 0.28)}px system-ui`; c.textAlign = 'center'; c.fillText(m === 60 ? '60 m' : `${m}`, x, y + ppm * 0.4);
      }
      break;
    }
    case 'parc': {
      ciel(c, W, H, '#4E94D5', '#E6F1F8', [W * 0.78, H * 0.08]); nuages(c, W, H, t);
      // la lisiere au loin, voilee ; la pelouse ; une rangee d'arbres plus pres
      crete(c, W, H, H * 0.47, H * 0.02, 26, d * ppm * 0.03, '#94B79E');
      rangee(c, W, H * 0.5, d, ppm, 0.05, 13, 6, feuillu('#6E9D73', '#5C8A62', 'rgba(255,255,255,0.12)', t));
      brume(c, W, H * 0.4, H * 0.52, '228,238,244', 0.5);
      const pel = c.createLinearGradient(0, H * 0.5, 0, H);
      pel.addColorStop(0, '#8CC06F'); pel.addColorStop(1, '#5B964A');
      c.fillStyle = pel; c.fillRect(0, H * 0.5, W, H);
      rangee(c, W, H * 0.62, d, ppm, 0.12, 11, 8, feuillu('#3F8A46', '#2F7136', 'rgba(255,255,255,0.16)', t));
      // les lampadaires et les bancs du parc, juste derriere l'allee
      const der = sol - ppm * 0.35;
      // l'ecran ne montre que ~3 m d'allee : un objet tous les 4 m, lampadaire puis banc
      for (let m = Math.floor((d - ax / ppm) / 4) * 4 - 4; m < d + (W - ax) / ppm + 4; m += 4) {
        const x = ax + (m - d) * ppm + ppm * 1.2;
        if (((m / 4) % 2 + 2) % 2 === 0) {
          c.fillStyle = '#2F3B36'; c.fillRect(x - 2, der - ppm * 2.4, 4, ppm * 2.4);
          c.fillRect(x - ppm * 0.12, der - ppm * 2.5, ppm * 0.24, ppm * 0.14);
          c.fillStyle = '#FFF3C4'; c.fillRect(x - ppm * 0.08, der - ppm * 2.38, ppm * 0.16, ppm * 0.1);
        } else {
          c.fillStyle = '#8A5A36'; c.fillRect(x - ppm * 0.6, der - ppm * 0.42, ppm * 1.2, ppm * 0.07);
          c.fillRect(x - ppm * 0.6, der - ppm * 0.62, ppm * 1.2, ppm * 0.07);
          c.fillStyle = '#2F3B36'; c.fillRect(x - ppm * 0.55, der - ppm * 0.42, 3, ppm * 0.42); c.fillRect(x + ppm * 0.52, der - ppm * 0.42, 3, ppm * 0.42);
        }
      }
      // l'allee de gravier, ses bords
      c.fillStyle = '#D6C29A'; c.fillRect(0, der, W, ppm * 0.9);
      grain(c, 0, der, W, ppm * 0.9, d * ppm, 0.3);
      c.fillStyle = 'rgba(90,70,40,0.25)'; c.fillRect(0, der, W, 2); c.fillRect(0, der + ppm * 0.9 - 2, W, 2);
      break;
    }
    case 'salle': case 'tapis': {
      const chambre = e.decor === 'tapis';
      // le mur et ses panneaux
      const g = c.createLinearGradient(0, 0, 0, H * 0.62);
      g.addColorStop(0, chambre ? '#EDE7F2' : '#E7DFD2'); g.addColorStop(1, chambre ? '#D8CFE3' : '#CDBFAA');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(0,0,0,0.05)'; for (let x = W / 5; x < W; x += W / 5) c.fillRect(x, 0, 1.5, H * 0.62);
      if (chambre) {
        // la fenetre, ses rideaux, une affiche, une plante
        const fx = W * 0.1, fy = H * 0.1, fw = W * 0.45, fh = H * 0.32;
        const vitre = c.createLinearGradient(0, fy, 0, fy + fh); vitre.addColorStop(0, '#78B5E6'); vitre.addColorStop(1, '#D9ECF8');
        c.fillStyle = vitre; c.fillRect(fx, fy, fw, fh);
        c.fillStyle = 'rgba(255,255,255,0.85)'; disque(c, fx + fw * 0.3, fy + fh * 0.3, fh * 0.08); disque(c, fx + fw * 0.4, fy + fh * 0.28, fh * 0.1);
        c.fillStyle = '#F5F1EA'; c.fillRect(fx + fw / 2 - 2, fy, 4, fh); c.fillRect(fx, fy + fh / 2 - 2, fw, 4);
        c.strokeStyle = '#F5F1EA'; c.lineWidth = 5; c.strokeRect(fx, fy, fw, fh);
        c.fillStyle = '#C8576B'; c.fillRect(fx - W * 0.05, fy - 8, W * 0.07, fh + 26); c.fillRect(fx + fw - W * 0.02, fy - 8, W * 0.07, fh + 26);
        c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(fx - W * 0.05, fy - 8, W * 0.02, fh + 26); c.fillRect(fx + fw - W * 0.02, fy - 8, W * 0.02, fh + 26);
        c.fillStyle = '#5C5470'; c.fillRect(fx - W * 0.07, fy - 12, fw + W * 0.14, 4);
        const ax2 = W * 0.66, ay = H * 0.14, aw = W * 0.24, ah = H * 0.26;
        c.fillStyle = '#1D2A44'; c.fillRect(ax2, ay, aw, ah);
        // l'affiche : une piste vue du ciel, ses couloirs
        const ox = ax2 + aw / 2, oy = ay + ah * 0.45, rx = aw * 0.36, ry = ah * 0.28;
        c.fillStyle = '#C8553D'; c.beginPath(); c.ellipse(ox, oy, rx, ry, 0, 0, TOUR); c.fill();
        c.fillStyle = '#4E9A4A'; c.beginPath(); c.ellipse(ox, oy, rx * 0.66, ry * 0.5, 0, 0, TOUR); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1;
        for (const f2 of [0.75, 0.84, 0.92]) { c.beginPath(); c.ellipse(ox, oy, rx * f2, ry * (0.5 + (f2 - 0.66) * 1.47), 0, 0, TOUR); c.stroke(); }
        c.fillStyle = '#FFD23F'; c.font = `900 ${Math.round(ah * 0.11)}px system-ui`; c.textAlign = 'center';
        c.fillText('SPRINT', ox, ay + ah * 0.9);
        c.strokeStyle = '#E9E4D8'; c.lineWidth = 4; c.strokeRect(ax2, ay, aw, ah);
      } else {
        // les hautes fenetres et leurs rais de lumiere, l'horloge, le miroir
        for (let i = 0; i < 4; i++) {
          const fx = W * (0.06 + i * 0.16), fw = W * 0.12;
          const vitre = c.createLinearGradient(0, H * 0.025, 0, H * 0.085); vitre.addColorStop(0, '#8EC3EC'); vitre.addColorStop(1, '#DCEEFA');
          c.fillStyle = vitre; c.fillRect(fx, H * 0.025, fw, H * 0.06);
          c.strokeStyle = '#7C6A55'; c.lineWidth = 2; c.strokeRect(fx, H * 0.025, fw, H * 0.06);
        }
        const now = new Date(), hx = W * 0.86, hy = H * 0.055, hr = H * 0.032;
        c.fillStyle = '#FFFFFF'; disque(c, hx, hy, hr); c.strokeStyle = '#2B2F36'; c.lineWidth = 2.5; c.beginPath(); c.arc(hx, hy, hr, 0, TOUR); c.stroke();
        const aig = (a: number, l: number, w: number) => { c.lineWidth = w; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + Math.sin(a) * l, hy - Math.cos(a) * l); c.stroke(); };
        aig((now.getHours() % 12 + now.getMinutes() / 60) / 12 * TOUR, hr * 0.5, 2.2); aig(now.getMinutes() / 60 * TOUR, hr * 0.8, 1.6);
        c.strokeStyle = '#E63946'; aig(now.getSeconds() / 60 * TOUR, hr * 0.85, 0.8);
        const mx = W * 0.06, my = H * 0.12, mw = W * 0.88, mh = H * 0.43;
        const mir = c.createLinearGradient(mx, my, mx + mw, my + mh);
        mir.addColorStop(0, '#D3DEE7'); mir.addColorStop(0.5, '#B5C6D4'); mir.addColorStop(1, '#9CB0C1');
        c.fillStyle = mir; c.fillRect(mx, my, mw, mh);
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.beginPath(); c.moveTo(mx + mw * 0.16, my); c.lineTo(mx + mw * 0.28, my); c.lineTo(mx + mw * 0.12, my + mh); c.lineTo(mx, my + mh); c.lineTo(mx, my + mh * 0.75); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.beginPath(); c.moveTo(mx + mw * 0.33, my); c.lineTo(mx + mw * 0.37, my); c.lineTo(mx + mw * 0.21, my + mh); c.lineTo(mx + mw * 0.17, my + mh); c.fill();
        c.strokeStyle = '#2E3238'; c.lineWidth = 3; c.strokeRect(mx, my, mw, mh);
        // la lumiere des fenetres qui tombe en biais
        c.fillStyle = 'rgba(255,246,222,0.13)';
        for (let i = 0; i < 4; i++) { const fx = W * (0.06 + i * 0.16); c.beginPath(); c.moveTo(fx, H * 0.085); c.lineTo(fx + W * 0.12, H * 0.085); c.lineTo(fx + W * 0.42, H * 0.75); c.lineTo(fx + W * 0.24, H * 0.75); c.fill(); }
      }
      // la plinthe, le parquet en perspective, son vernis
      const y0 = H * 0.62;
      const sl = c.createLinearGradient(0, y0, 0, H); sl.addColorStop(0, '#B07E4E'); sl.addColorStop(1, '#C99863');
      c.fillStyle = sl; c.fillRect(0, y0, W, H - y0);
      c.strokeStyle = 'rgba(70,40,15,0.28)'; c.lineWidth = 1;
      for (let k = 1; k < 9; k++) { const y = y0 + (H - y0) * Math.pow(k / 9, 1.5); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      for (let i = -7; i <= 7; i++) { const xb = W / 2 + i * W * 0.17; c.beginPath(); c.moveTo(W / 2 + (xb - W / 2) * 0.35, y0); c.lineTo(xb, H); c.stroke(); }
      const ve = c.createRadialGradient(W * 0.45, H * 0.78, 0, W * 0.45, H * 0.78, W * 0.5);
      ve.addColorStop(0, 'rgba(255,240,215,0.22)'); ve.addColorStop(1, 'rgba(255,240,215,0)');
      c.fillStyle = ve; c.fillRect(0, y0, W, H - y0);
      c.fillStyle = chambre ? '#F2EEE8' : '#7A5C3E'; c.fillRect(0, y0 - 6, W, 6);
      if (!chambre) {
        // la plateforme d'haltero, le rack, l'arbre a disques, les halteres
        c.fillStyle = '#2A2E34';
        c.beginPath(); c.moveTo(ax - ppm * 1.5, sol + ppm * 0.25); c.lineTo(ax + ppm * 1.5, sol + ppm * 0.25); c.lineTo(ax + ppm * 1.25, sol - ppm * 0.2); c.lineTo(ax - ppm * 1.25, sol - ppm * 0.2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(ax - ppm * 1.3, sol - ppm * 0.2, ppm * 2.6, 2);
        const montant = (x: number, h: number) => {
          c.fillStyle = '#353A42'; c.fillRect(x, sol - ppm * h, ppm * 0.12, ppm * h);
          c.fillStyle = '#5E6670'; c.fillRect(x + ppm * 0.02, sol - ppm * h, ppm * 0.025, ppm * h);
          c.fillStyle = '#9AA0A8'; for (let y = sol - ppm * h + 8; y < sol - 6; y += ppm * 0.12) c.fillRect(x + ppm * 0.075, y, 2, 2);
        };
        montant(ax - ppm * 1.0, 2.4); montant(ax + ppm * 0.9, 2.6);
        c.fillStyle = '#353A42'; c.fillRect(ax - ppm * 1.0, sol - ppm * 2.4, ppm * 2.0, ppm * 0.1);
        c.fillStyle = '#C0392B'; c.fillRect(ax - ppm * 0.96, sol - ppm * 1.35, ppm * 0.16, ppm * 0.05); c.fillRect(ax + ppm * 0.86, sol - ppm * 1.35, ppm * 0.16, ppm * 0.05);
        const ar = W * 0.86;
        c.fillStyle = '#353A42'; c.fillRect(ar - 2, sol - ppm * 0.9, 4, ppm * 0.9); c.fillRect(ar - ppm * 0.3, sol - 4, ppm * 0.6, 4);
        [['#C0392B', 0.42], ['#2980B9', 0.36], ['#27AE60', 0.3], ['#F1C40F', 0.24]].forEach(([coul, r], i) => {
          c.fillStyle = '#1C2026'; c.fillRect(ar + 3 + i * 6, sol - ppm * 0.45 - ppm * (r as number) / 2, 6, ppm * (r as number));
          c.fillStyle = coul as string; c.fillRect(ar + 4 + i * 6, sol - ppm * 0.45 - ppm * (r as number) / 2 + 2, 4, ppm * (r as number) - 4);
        });
        const hx = W * 0.05;
        c.fillStyle = '#353A42'; c.fillRect(hx, sol - ppm * 0.7, ppm * 0.7, 4); c.fillRect(hx, sol - ppm * 0.7, 3, ppm * 0.7); c.fillRect(hx + ppm * 0.7 - 3, sol - ppm * 0.7, 3, ppm * 0.7);
        for (let i = 0; i < 3; i++) { const x = hx + ppm * (0.1 + i * 0.22); c.fillStyle = '#1C2026'; c.fillRect(x, sol - ppm * 0.78, ppm * 0.07, ppm * 0.1); c.fillRect(x + ppm * 0.07, sol - ppm * 0.74, ppm * 0.06, 2); }
      } else {
        // le tapis de sol, un liseré, une plante dans son pot
        const tg2 = c.createLinearGradient(0, sol - 6, 0, sol + 8); tg2.addColorStop(0, '#4A8FD9'); tg2.addColorStop(1, '#2C69AE');
        c.fillStyle = tg2; c.fillRect(ax - ppm * 1.6, sol - 5, ppm * 2.6, 11);
        c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(ax - ppm * 1.55, sol - 3, ppm * 2.5, 1.5);
        const px = W * 0.88, py = H * 0.62;
        c.fillStyle = '#C8794B'; c.beginPath(); c.moveTo(px - 16, py - 30); c.lineTo(px + 16, py - 30); c.lineTo(px + 12, py); c.lineTo(px - 12, py); c.fill();
        c.fillStyle = '#3E8E4E';
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.35 + Math.sin(t * 0.7 + i) * 0.04; c.save(); c.translate(px, py - 30); c.rotate(a); c.beginPath(); c.ellipse(22, 0, 22, 6, 0, 0, TOUR); c.fill(); c.restore(); }
      }
      break;
    }
  }
}

/** Les peintures 2D, reprises comme textures par la 3D (seance-3d.ts). */
const PINCEAUX: Pinceaux = {
  tribune: peindreTribune,
  ciel(c, w, h, lieu) {
    const [haut, bas] = lieu === 'cote' ? ['#4F93D3', '#F3E7CF'] : lieu === 'parc' ? ['#4E94D5', '#E6F1F8'] : ['#3F86CC', '#CFE6F5'];
    ciel(c, w, h, haut, bas, [w * 0.78, h * 0.1]); nuages(c, w, h, 0);
  },
  montagnes(c, w, h) {
    crete(c, w, h, h * 0.7, h * 0.32, 150, 0, '#A9BDD2');
    crete(c, w, h, h * 0.86, h * 0.18, 80, 60, '#8FAEB0');
  },
  affiche(c, w, h) {
    c.fillStyle = '#1D2A44'; c.fillRect(0, 0, w, h);
    const ox = w / 2, oy = h * 0.42, rx = w * 0.38, ry = h * 0.24;
    c.fillStyle = '#C8553D'; c.beginPath(); c.ellipse(ox, oy, rx, ry, 0, 0, TOUR); c.fill();
    c.fillStyle = '#4E9A4A'; c.beginPath(); c.ellipse(ox, oy, rx * 0.66, ry * 0.5, 0, 0, TOUR); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2;
    for (const f of [0.75, 0.84, 0.92]) { c.beginPath(); c.ellipse(ox, oy, rx * f, ry * (0.5 + (f - 0.66) * 1.47), 0, 0, TOUR); c.stroke(); }
    c.fillStyle = '#FFD23F'; c.font = `900 ${Math.round(h * 0.1)}px system-ui`; c.textAlign = 'center'; c.fillText('SPRINT', ox, h * 0.86);
    c.strokeStyle = '#E9E4D8'; c.lineWidth = 10; c.strokeRect(0, 0, w, h);
  },
};

/* ================================================================ les entrees */

type Cote = 'g' | 'd';
type JeuProps = { fini: (score: number) => void; couleur: string; scene: React.MutableRefObject<EtatScene> };

/** L'horloge d'un jeu : rappelle `tic(t, dt)` a chaque image, t en secondes depuis le debut. */
function useHorloge(tic: (t: number, dt: number) => boolean | void) {
  const f = useRef(tic); f.current = tic;
  useEffect(() => {
    let id = 0, debut = 0, avant = 0;
    const boucle = (ms: number) => {
      if (!debut) { debut = ms; avant = ms; }
      const fin = f.current((ms - debut) / 1000, Math.min(0.05, (ms - avant) / 1000));
      avant = ms;
      if (fin !== true) id = requestAnimationFrame(boucle);
    };
    id = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(id);
  }, []);
}

/** Les appuis : les deux zones, les fleches du clavier, et l'appui long (muscu). */
function useAppuis(surAppui: (c: Cote, t: number) => void, surLache?: (c: Cote) => void) {
  const a = useRef(surAppui); a.current = surAppui;
  const l = useRef(surLache); l.current = surLache;
  useEffect(() => {
    const bas = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); a.current('g', performance.now() / 1000); }
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); a.current('d', performance.now() / 1000); }
    };
    const haut = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') l.current?.('g');
      else if (e.key === 'ArrowRight' || e.key === ' ') l.current?.('d');
    };
    window.addEventListener('keydown', bas); window.addEventListener('keyup', haut);
    return () => { window.removeEventListener('keydown', bas); window.removeEventListener('keyup', haut); };
  }, []);
  return {
    zone: (c: Cote) => ({
      onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); a.current(c, performance.now() / 1000); },
      onPointerUp: () => l.current?.(c),
      onPointerCancel: () => l.current?.(c),
    }),
  };
}

function Zones({ zone, libelles = ['←', '→'] }: { zone: (c: Cote) => object; libelles?: [string, string] }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] h-[24vh] shrink-0 bg-[#0A1410]">
      {(['g', 'd'] as const).map((c, i) => (
        <button key={c} {...zone(c)}
                className="rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.12] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] active:from-white/30 active:to-white/10 active:border-white/40 active:shadow-[0_0_24px_rgba(61,220,132,0.35)] active:scale-[0.97] transition-[transform,box-shadow] duration-75 font-black text-3xl text-white/70 select-none">
          {libelles[i]}
        </button>
      ))}
    </div>
  );
}

/** La cadence glissante sur la derniere seconde (appuis alternes seulement). */
function useCadence() {
  const appuis = useRef<{ t: number; bon: boolean }[]>([]);
  const dernier = useRef<Cote | null>(null);
  return {
    appui(c: Cote, t: number) {
      const bon = dernier.current !== c; dernier.current = c;
      appuis.current.push({ t, bon });
      return bon;
    },
    cadence(t: number) { return appuis.current.filter(x => x.bon && x.t > t - 1).length; },
    fautes() { return appuis.current.filter(x => !x.bon).length; },
  };
}

/** Le bandeau par-dessus la scene : un grand chiffre, une ligne. */
function Bandeau({ grand, petit, couleur, haut }: { grand?: React.ReactNode; petit?: React.ReactNode; couleur?: string; haut?: React.ReactNode }) {
  return (
    <div className="absolute top-2 inset-x-0 flex flex-col items-center gap-0.5 pointer-events-none text-center px-3">
      {haut && <span className="text-[10px] font-black tracking-[0.3em] text-white px-2 py-0.5 rounded-full bg-black/45">{haut}</span>}
      {grand !== undefined && <span className="font-black font-display text-4xl tabular-nums text-white" style={{ textShadow: '0 2px 10px rgba(0,0,0,.55)' }}>{grand}</span>}
      {petit && <span className="text-sm font-black px-2 py-0.5 rounded-full bg-black/45" style={{ color: couleur || '#fff' }}>{petit}</span>}
    </div>
  );
}

/** Une jauge d'allure : la zone a tenir, et ou l'on est. */
function JaugeAllure({ v, lo, hi, couleur }: { v: number; lo: number; hi: number; couleur: string }) {
  const ok = v >= lo && v <= hi;
  return (
    <div className="absolute bottom-2 inset-x-6 h-4 rounded-full bg-black/40 overflow-hidden">
      <div className="absolute inset-y-0" style={{ left: `${lo / 14 * 100}%`, width: `${(hi - lo) / 14 * 100}%`, background: `${VERT}88` }} />
      <div className="absolute inset-y-0 w-1.5 -ml-0.5 rounded-full" style={{ left: `${Math.min(14, v) / 14 * 100}%`, background: ok ? couleur : '#FF5A5F' }} />
    </div>
  );
}

/* ================================================================ les jeux */

/** Vitesse lancee : 3 s d'elan, puis 3 s dans la zone ; la vitesse suit la cadence. */
function Lancee({ fini, scene }: JeuProps) {
  const c = useCadence();
  const [t, setT] = useState(0);
  const bons = useRef(0), debut = useRef(0), zoneDe = useRef<number | null>(null);
  const e = scene.current;
  useHorloge((tt, dt) => {
    if (!debut.current) debut.current = performance.now() / 1000 - tt;
    setT(tt);
    const cad = c.cadence(performance.now() / 1000);
    courir(e, Math.min(12, 2 + cad * 0.85), dt);
    if (tt >= 3 && zoneDe.current === null) { zoneDe.current = e.defile; e.zone = [e.defile, e.defile + 30]; }
    e.sueur = tt / 6;
    if (tt >= 6) { fini(borne((bons.current / 3 - 5) / 7) - c.fautes() * 0.01); return true; }
  });
  const { zone } = useAppuis((cote, ts) => { const bon = c.appui(cote, ts); if (bon && ts - debut.current >= 3) bons.current++; });
  const cad = c.cadence(performance.now() / 1000);
  return { haut: t < 3 ? dans(['L’ÉLAN', 'BUILD-UP']) : dans(['ZONE LANCÉE', 'FLYING ZONE']), grand: `${cad}`, petit: mot('appuis', { n: cad }), zone };
}

/** Gammes : des notes descendent ; a chaque note tapee a temps, l'athlete fait l'educatif. */
const EDUCATIFS: { nom: [string, string]; pas: number; motif: Cote[]; pose: 'genoux' | 'talons' | 'chasses' | 'griffes' }[] = [
  { nom: ['Montées de genoux', 'High knees'], pas: 0.42, motif: ['g', 'd'], pose: 'genoux' },
  { nom: ['Talons-fesses', 'Butt kicks'], pas: 0.36, motif: ['g', 'd'], pose: 'talons' },
  { nom: ['Pas chassés', 'Side shuffles'], pas: 0.42, motif: ['g', 'g', 'd', 'd'], pose: 'chasses' },
  { nom: ['Griffés', 'Pawing'], pas: 0.4, motif: ['g', 'd', 'd', 'g'], pose: 'griffes' },
];
function Gammes({ fini, couleur, scene }: JeuProps) {
  const notes = useRef<{ t: number; c: Cote; ed: number; vu: boolean }[]>([]);
  if (!notes.current.length) {
    let t = 1.5;
    for (const k of [...EDUCATIFS.keys()].sort(() => Math.random() - 0.5).slice(0, 3)) {
      const ed = EDUCATIFS[k];
      for (let i = 0; i < 8; i++) { notes.current.push({ t, c: ed.motif[i % ed.motif.length], ed: k, vu: false }); t += ed.pas; }
      t += 1;
    }
  }
  const fin = notes.current[notes.current.length - 1].t + 1;
  const [t, setT] = useState(0);
  const debut = useRef(0), touches = useRef(0), fautes = useRef(0), geste = useRef({ t: -9, cote: 1, pose: 'genoux' as string });
  const e = scene.current;
  useHorloge((tt, dt) => {
    if (!debut.current) debut.current = performance.now() / 1000 - tt;
    setT(tt);
    // le geste : il monte vite, redescend en 0,3 s ; entre deux, l'athlete avance au pas
    const g = geste.current, a = Math.max(0, 1 - (tt - g.t) / 0.32), h = Math.sin(Math.min(1, a) * Math.PI / 2);
    e.corps.posture = h > 0.02
      ? (g.pose === 'talons' || g.pose === 'griffes' ? POSTURES.talons(g.cote, h * (g.pose === 'griffes' ? 0.6 : 1)) : POSTURES.genoux(g.cote, h * (g.pose === 'chasses' ? 0.45 : 1)))
      : { w: 0 };
    e.corps.debout = h > 0.02 ? 0 : 1;
    e.defile += dt * 1.1;
    if (tt >= fin) { fini(borne(touches.current / notes.current.length - fautes.current * 0.02)); return true; }
  });
  const { zone } = useAppuis((c, ts) => {
    const tt = ts - debut.current;
    const n = notes.current.find(x => !x.vu && x.c === c && Math.abs(x.t - tt) <= 0.12);
    if (n) { n.vu = true; touches.current++; geste.current = { t: tt, cote: c === 'g' ? 1 : -1, pose: EDUCATIFS[n.ed].pose }; }
    else { fautes.current++; e.flash = 0.4; e.couleurFlash = '#FF3B3B'; }
  });
  const enCours = notes.current.find(x => x.t > t - 0.2);
  const AVANCE = 1.6;
  const pistes = (
    <div className="absolute right-2 top-14 bottom-2 w-24 grid grid-cols-2 gap-1">
      {(['g', 'd'] as const).map(c => (
        <div key={c} className="relative rounded-lg bg-black/35 overflow-hidden">
          <div className="absolute inset-x-0 bottom-3 h-1 bg-white/60" />
          {notes.current.filter(n => n.c === c && n.t > t - 0.3 && n.t < t + AVANCE).map((n, i) => (
            <div key={i} className="absolute left-1/2 -ml-4 w-8 h-3.5 rounded-full"
                 style={{ bottom: `calc(${((n.t - t) / AVANCE) * 100}% + 4px)`, background: n.vu ? '#ffffff44' : couleur, boxShadow: n.vu ? undefined : `0 0 8px ${couleur}` }} />
          ))}
        </div>
      ))}
    </div>
  );
  return { haut: enCours ? dans(EDUCATIFS[enCours.ed].nom).toUpperCase() : '', grand: `${touches.current} / ${notes.current.length}`, zone, extra: pistes };
}

/** Virage : la cadence fait la vitesse ; trop vite, la courbe pousse dehors ; trop lent, on perd. */
function Virage({ fini, couleur, scene }: JeuProps) {
  const c = useCadence();
  const x = useRef(0.5), dedans = useRef(0), total = useRef(0);
  const [, maj] = useState(0);
  const e = scene.current;
  useHorloge((tt, dt) => {
    const cad = c.cadence(performance.now() / 1000);
    x.current = Math.max(0, Math.min(1, x.current + (cad > 9 ? 0.35 : cad < 6 ? -0.25 : (0.5 - x.current)) * dt));
    if (tt > 1) { total.current++; if (cad >= 6 && cad <= 9 && x.current > 0.2 && x.current < 0.8) dedans.current++; }
    courir(e, Math.min(11, 2 + cad * 0.9), dt);
    e.couloir = (x.current - 0.5) * 2;
    e.incline = -0.05 - 0.012 * cad;
    e.cap = PROFIL - 0.25;
    maj(n => n + 1);
    if (tt >= 10) { fini(borne(total.current ? dedans.current / total.current : 0)); return true; }
  });
  const { zone } = useAppuis((cote, ts) => { c.appui(cote, ts); });
  const cad = c.cadence(performance.now() / 1000);
  return {
    haut: dans(['VIRAGE', 'BEND']), grand: `${cad}`, couleur: cad >= 6 && cad <= 9 ? VERT : '#FF5A5F',
    petit: cad > 9 ? dans(['Trop vite : tu sors du couloir', 'Too fast: drifting out']) : cad < 6 ? dans(['Trop lent', 'Too slow']) : dans(['Bien à la corde', 'Nicely on the line']),
    zone, extra: <JaugeAllure v={cad} lo={6} hi={9} couleur={couleur} />,
  };
}

/** Cotes : quatre montees de 60 m en 8 s ; plus haut, chaque appui porte moins loin. */
function Cotes({ fini, scene }: JeuProps) {
  const [rep, setRep] = useState(0);
  const [, maj] = useState(0);
  const debutRep = useRef(0), scores = useRef<number[]>([]), dist = useRef(0), dernier = useRef<Cote | null>(null);
  const pause = useRef(0), vitesse = useRef(0), t0 = useRef(0);
  const e = scene.current;
  e.pente = 0.2; e.corps.buste = -0.18;
  useHorloge((tt, dt) => {
    t0.current = tt;
    if (rep >= 4) return true;
    const c = e.corps;
    if (pause.current) {
      // on redescend en marchant, le dos a la pente
      c.marche = 1; c.marcheT = (c.marcheT || 0) + dt * 6; c.v = 0; e.cap = -PROFIL;
      e.defile = Math.max(0, e.defile - dt * 22);
      if (tt >= pause.current) { pause.current = 0; debutRep.current = tt; dist.current = 0; e.defile = 0; c.marche = 0; e.cap = PROFIL; }
      maj(n => n + 1); return;
    }
    if (!debutRep.current) debutRep.current = tt;
    const el = tt - debutRep.current;
    vitesse.current *= Math.exp(-2.2 * dt);
    courir(e, vitesse.current, dt);
    e.defile = dist.current;
    e.sueur = rep / 3;
    if (dist.current >= 60 || el >= 8) {
      scores.current.push(borne(dist.current / 60) * (dist.current >= 60 ? 1 : 0.85) + (dist.current >= 60 ? borne((8 - el) / 8) * 0.25 : 0));
      const n = rep + 1; setRep(n);
      if (n >= 4) { fini(borne(scores.current.reduce((x, y) => x + y, 0) / 4)); return true; }
      pause.current = tt + 2.2;
    }
    maj(n => n + 1);
  });
  const { zone } = useAppuis(c => {
    if (pause.current) return;
    const bon = dernier.current !== c; dernier.current = c;
    // la pente : 0,9 m par appui en bas, 0,45 m en haut ; deux fois le meme pied, presque rien
    const pas = bon ? 0.9 - 0.45 * (dist.current / 60) : 0.1;
    dist.current += pas;
    vitesse.current = Math.min(9, vitesse.current + pas * 2.2);
  });
  const reste = Math.max(0, 8 - (t0.current - debutRep.current));
  return {
    haut: `${dans(['MONTÉE', 'REP'])} ${Math.min(4, rep + 1)} / 4`, grand: `${Math.min(60, dist.current).toFixed(0)} m`,
    petit: pause.current ? dans(['Retour en marchant…', 'Walk back down…']) : `${reste.toFixed(1)} s`, zone,
  };
}

/** Musculation, le squat : appuyer pour descendre, relacher dans la zone. Cinq repetitions. */
function Muscu({ fini, scene }: JeuProps) {
  const [rep, setRep] = useState(0);
  const [msg, setMsg] = useState('');
  const [, maj] = useState(0);
  const prof = useRef(0), appuye = useRef(false), monte = useRef(false), bons = useRef(0), bas = useRef(0);
  const ZONE: [number, number] = [0.82, 0.97];
  const e = scene.current;
  const lacher = (p?: number) => {
    if (!appuye.current) return;
    appuye.current = false; bas.current = 0;
    const v = p ?? prof.current;
    let s = 0, m: string;
    if (v > 1) { m = dans(['Trop bas, la barre t’écrase', 'Too deep, the bar wins']); e.flash = 0.6; e.couleurFlash = '#FF3B3B'; }
    else if (v >= ZONE[0] && v <= ZONE[1]) { s = 1; m = dans(['Parfait : cuisses parallèles', 'Perfect: thighs parallel']); e.flash = 0.4; e.couleurFlash = VERT; }
    else if (v >= 0.6) { s = 0.5; m = dans(['Pas assez profond', 'Not deep enough']); }
    else m = dans(['Demi-squat…', 'Half squat…']);
    bons.current += s;
    monte.current = true; setMsg(m);
    const n = rep + 1; setRep(n);
    if (n >= 5) setTimeout(() => fini(bons.current / 5), 900);
  };
  useHorloge((tt, dt) => {
    if (monte.current) { prof.current -= dt * 1.4; if (prof.current <= 0) { prof.current = 0; monte.current = false; } }
    else if (appuye.current) {
      prof.current += dt * 0.7;
      if (prof.current >= 1) { prof.current = 1; bas.current += dt; if (bas.current > 0.35) lacher(1.01); }
    }
    e.corps.posture = POSTURES.squat(prof.current);
    e.barre = prof.current;
    e.sueur = rep / 4;
    maj(n => n + 1);
    if (rep >= 5 && !monte.current) return true;
  });
  const { zone } = useAppuis(() => { if (!monte.current && rep < 5) appuye.current = true; }, () => lacher());
  const jauge = (
    <div className="absolute right-3 top-14 bottom-3 w-5 rounded-full bg-black/40 overflow-hidden">
      <div className="absolute inset-x-0" style={{ top: `${ZONE[0] * 100}%`, height: `${(ZONE[1] - ZONE[0]) * 100}%`, background: `${VERT}AA` }} />
      <div className="absolute inset-x-0 h-1.5 -mt-0.5 bg-white" style={{ top: `${Math.min(1, prof.current) * 100}%` }} />
    </div>
  );
  return {
    haut: `SQUAT ${Math.min(5, rep + 1)} / 5`, grand: undefined,
    petit: msg || dans(['Garde appuyé pour descendre', 'Hold to go down']), zone,
    libelles: [dans(['DESCENDRE', 'DOWN']), dans(['DESCENDRE', 'DOWN'])] as [string, string], extra: jauge,
  };
}

/** Bondissements : le pied revient au sol en rythme ; taper a l'impact, du bon pied. */
function Bonds({ fini, couleur, scene }: JeuProps) {
  const [t, setT] = useState(0);
  const contacts = useRef<{ t: number; c: Cote; vu: boolean; bon: boolean }[]>([]);
  if (!contacts.current.length) {
    let tt = 1.2, p = 0.62;
    for (let i = 0; i < 12; i++) { contacts.current.push({ t: tt, c: i % 2 ? 'd' : 'g', vu: false, bon: false }); tt += p; p = Math.max(0.48, p - 0.012); }
  }
  const fin = contacts.current[contacts.current.length - 1].t + 0.8;
  const debut = useRef(0), bons = useRef(0);
  const e = scene.current;
  useHorloge((tt, dt) => {
    if (!debut.current) debut.current = performance.now() / 1000 - tt;
    setT(tt);
    const L = contacts.current, i = L.findIndex(x => x.t > tt);
    const a = i > 0 ? L[i - 1].t : 0, b = i >= 0 ? L[i].t : fin;
    const u = i < 0 ? 0 : Math.min(1, Math.max(0, (tt - a) / (b - a)));
    // un bond reussi va plus loin et plus haut
    const reussi = i > 0 ? L[i - 1].bon : true;
    e.vol = tt < 1.2 ? 0 : Math.sin(Math.PI * u) * (reussi ? 0.55 : 0.3);
    e.corps.posture = tt < 1.2 ? { w: 0 } : POSTURES.bond(u, i % 2 ? 1 : -1);
    courir(e, tt < 1.2 ? 2 : reussi ? 6.5 : 4.5, dt);
    if (tt >= fin) { e.vol = 0; fini(borne(bons.current / L.length)); return true; }
  });
  const { zone } = useAppuis((c, ts) => {
    const tt = ts - debut.current;
    const k = contacts.current.find(x => !x.vu && Math.abs(x.t - tt) <= 0.09);
    if (k) { k.vu = true; if (k.c === c) { k.bon = true; bons.current++; } }
  });
  const i = contacts.current.findIndex(x => x.t > t);
  const prochain = i >= 0 ? contacts.current[i].c : 'g';
  return { haut: dans(['BONDISSEMENTS', 'BOUNDING']), grand: `${bons.current} / ${contacts.current.length}`, petit: `${dans(['Pied', 'Foot'])} ${prochain === 'g' ? mot('gauche') : mot('droite')}`, couleur, zone };
}

/** Gainage : le corps penche ; corriger a gauche et a droite pour rester aligne. */
function Gainage({ fini, couleur, scene }: JeuProps) {
  const [, maj] = useState(0);
  const ang = useRef(0), v = useRef(0), dedans = useRef(0), total = useRef(0), pousse = useRef(0), t0 = useRef(0);
  const e = scene.current;
  useHorloge((tt, dt) => {
    t0.current = tt;
    // le tremblement monte avec le temps : la fin d'une planche, on la sent
    pousse.current += (Math.random() - 0.5) * (1.2 + tt * 0.12) * dt * 6;
    pousse.current *= 0.96;
    v.current += (pousse.current + ang.current * 0.9) * dt; v.current *= 0.97;
    ang.current = Math.max(-1, Math.min(1, ang.current + v.current * dt * 3));
    total.current++; if (Math.abs(ang.current) < 0.25) dedans.current++;
    e.corps.posture = POSTURES.gainage(ang.current * 0.22 + Math.sin(tt * 40) * 0.006 * (1 + tt / 6));
    e.sueur = tt / 20;
    maj(n => n + 1);
    if (tt >= 20) { fini(borne(dedans.current / total.current)); return true; }
  });
  const { zone } = useAppuis(c => { v.current += c === 'g' ? -0.35 : 0.35; });
  const a = ang.current;
  const niveau = (
    <div className="absolute bottom-3 left-1/2 -ml-24 w-48 h-6 rounded-full bg-black/40">
      <div className="absolute left-1/2 top-0 bottom-0 w-12 -ml-6 rounded-full" style={{ background: `${VERT}55` }} />
      <div className="absolute top-1 bottom-1 w-4 -ml-2 rounded-full" style={{ left: `${50 + a * 45}%`, background: Math.abs(a) < 0.25 ? couleur : '#FF5A5F' }} />
    </div>
  );
  return {
    haut: dans(['PLANCHE', 'PLANK']), grand: `${Math.max(0, 20 - t0.current).toFixed(0)} s`,
    petit: Math.abs(a) < 0.25 ? dans(['Aligné', 'Straight']) : a < 0 ? dans(['Tu penches à gauche', 'Leaning left']) : dans(['Tu penches à droite', 'Leaning right']),
    zone, extra: niveau,
  };
}

/** Une zone d'allure a tenir, sur une ou plusieurs repetitions ; la fatigue alourdit la foulee. */
function Allure({ fini, couleur, scene, reps, duree, zones }: JeuProps & { reps: number; duree: number; zones: [number, number][] }) {
  const c = useCadence();
  const [etat, setEtat] = useState({ rep: 0, e: 0, repos: false });
  const dedans = useRef(0), total = useRef(0);
  const e = scene.current;
  useHorloge((tt, dt) => {
    const cycle = duree + 2.5, rep = Math.floor(tt / cycle), el = tt - rep * cycle;
    if (rep >= reps) { fini(borne(total.current ? dedans.current / total.current : 0)); return true; }
    const repos = el > duree, cad = c.cadence(performance.now() / 1000);
    if (repos) {
      e.corps.marche = 1; e.corps.marcheT = (e.corps.marcheT || 0) + dt * 6; e.corps.v = 0; e.defile += dt * 1.4;
    } else {
      e.corps.marche = 0;
      courir(e, Math.min(11, 1.5 + cad * 0.9), dt);
      if (el > 0.8) { const [lo, hi] = zones[rep]; total.current++; if (cad >= lo && cad <= hi) dedans.current++; }
    }
    e.corps.fatigue = Math.min(1, (rep + el / duree) / (reps + 0.5));
    e.sueur = e.corps.fatigue;
    setEtat({ rep, e: el, repos });
  });
  const { zone } = useAppuis((cote, ts) => { if (!etat.repos) c.appui(cote, ts); });
  const cad = c.cadence(performance.now() / 1000), [lo, hi] = zones[Math.min(reps - 1, etat.rep)];
  return {
    haut: reps > 1 ? `${dans(['RÉPÉTITION', 'REP'])} ${etat.rep + 1} / ${reps}` : dans(['TEMPO', 'TEMPO']),
    grand: etat.repos ? '…' : `${cad}`, couleur: etat.repos ? undefined : cad >= lo && cad <= hi ? VERT : '#FF5A5F',
    petit: etat.repos ? dans(['Récupération', 'Recovery']) : `${dans(['Zone', 'Zone'])} ${lo}–${hi} ${dans(['appuis/s', 'taps/s'])}`,
    zone, extra: <JaugeAllure v={cad} lo={lo} hi={hi} couleur={couleur} />,
  };
}

type Rendu = { haut?: React.ReactNode; grand?: React.ReactNode; petit?: React.ReactNode; couleur?: string; zone: (c: Cote) => object; libelles?: [string, string]; extra?: React.ReactNode };

// les departs en blocs n'ont pas de jeu dessine : ils se font sur la piste du jeu (DepartsEnPiste)
const JEUX: Record<Exclude<Exercice, 'departs'>, { decor: Decor; jeu: (p: JeuProps) => Rendu }> = {
  lancee: { decor: 'piste', jeu: Lancee },
  gammes: { decor: 'piste', jeu: Gammes },
  virage: { decor: 'virage', jeu: Virage },
  cotes: { decor: 'cote', jeu: Cotes },
  muscu: { decor: 'salle', jeu: Muscu },
  bonds: { decor: 'piste', jeu: Bonds },
  gainage: { decor: 'tapis', jeu: Gainage },
  fractionne: { decor: 'piste', jeu: p => Allure({ ...p, reps: 3, duree: 6, zones: [[6, 9], [6.5, 9], [7, 9]] }) },
  tempo: { decor: 'parc', jeu: p => Allure({ ...p, reps: 1, duree: 16, zones: [[5, 7]] }) },
};

/** Le jeu en cours : la scene, le bandeau par-dessus, les zones dessous. */
function EnJeu({ ex, fini, couleur, scene }: { ex: Exclude<Exercice, 'departs'> } & Omit<JeuProps, 'scene'> & { scene: React.MutableRefObject<EtatScene> }) {
  const r = JEUX[ex].jeu({ fini, couleur, scene });
  return (
    <>
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <Scene etat={scene} />
        <Bandeau haut={r.haut} grand={r.grand} petit={r.petit} couleur={r.couleur} />
        {r.extra}
      </div>
      <Zones zone={r.zone} libelles={r.libelles} />
    </>
  );
}

/* ================================================================ la seance */

export function SeanceJeu(p: { jour: Jour; a: Athlete; onFin: () => void; exercice?: Exercice }) {
  // `exercice` : imposer l'exercice (l'apercu tools/apercu-seances.html) ; sinon, le programme du jour
  const ex = p.exercice || exerciceDuJour(p.a, p.jour);
  return ex === 'departs' ? <VersLaPiste {...p} /> : <SeanceDessinee {...p} ex={ex} />;
}

/** Les departs : la seance part sur la piste du jeu, et l'ecran de la carriere se referme. */
function VersLaPiste({ jour, a, onFin }: { jour: Jour; a: Athlete; onFin: () => void }) {
  useEffect(() => { onFin(); ouvrirLesDeparts(a, jour); }, []);
  return null;
}

function SeanceDessinee({ jour, a, onFin, ex }: { jour: Jour; a: Athlete; onFin: () => void; ex: Exclude<Exercice, 'departs'> }) {
  const e = EXOS[ex];
  // le lieu decide du decor : seul, les seances de piste se font au parc
  const decor: Decor = !a.club && JEUX[ex].decor === 'piste' ? 'parc' : JEUX[ex].decor;
  const couleur = COULEUR[SEANCES[jour].stat];
  // le corps MakeHuman de la ville (corps-gens.ts), dans sa tenue d'entrainement ; les facettes en attendant
  const look = useRef((() => {
    const l = lookDe(apparenceDe(a), false, tenue((a.garde || GARDE_ROBE_DE_DEPART).porte.entrainement));
    l.maillage = cheminDe(l);
    return l;
  })());
  useEffect(() => { charger(look.current.maillage); }, []);
  const scene = useRef<EtatScene>(nouvelEtat(look.current, decor));
  const [phase, setPhase] = useState<'pret' | 'jeu' | 'fini'>('pret');
  const [res, setRes] = useState<{ score: number; r: ResultatSeance | null } | null>(null);
  // commencee puis quittee : la seance compte, a zero (sinon on la rejouait a volonte, sans fatigue ni usure)
  const enCours = useRef(false);
  useEffect(() => () => { if (enCours.current) { enCours.current = false; faireLaSeance(a, jour, 0, Math.random, bonusDeSeance(a)); sauverAthlete(a); } }, []);
  const finir = (s: number) => {
    enCours.current = false;
    const score = borne(s);
    // le conseil du coach, la seance a deux, la confiance du coach : la seance rend plus
    setRes({ score, r: faireLaSeance(a, jour, score, Math.random, bonusDeSeance(a)) });
    // le corps se pose : bras leves si la seance est belle, debout sinon
    const c = scene.current.corps;
    c.v = 0; c.posture = { w: 0 }; c.marche = 0; scene.current.barre = null; scene.current.vol = 0;
    c.debout = 1; c.celebrate = score >= 0.7 ? 1 : 0;
    setPhase('fini');
  };
  // avant de commencer : l'athlete attend, en place pour l'exercice
  useEffect(() => {
    const s = scene.current, c = s.corps;
    // au squat, les pieds a la largeur des epaules (l'ouverture des jambes du moteur)
    if (ex === 'muscu') { c.posture = POSTURES.squat(0); s.barre = 0; c.look.ouverture = 0.25; }
    else if (ex === 'gainage') c.posture = POSTURES.gainage();
    else c.debout = 1;
  }, [ex]);

  return createPortal(
    <div className="fixed inset-0 z-[85] flex flex-col bg-[#0A1410] text-foreground select-none touch-none">
      <div className="px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 flex flex-col gap-0.5 max-w-lg w-full mx-auto shrink-0">
        <span className="text-[10px] font-black tracking-[0.22em]" style={{ color: couleur }}>
          {mot(jour)} · {mot(SEANCES[jour].stat).toUpperCase()}
        </span>
        <h2 className="font-black font-display text-2xl leading-tight">{dans(e.nom)}</h2>
        <p className="text-xs text-white/70">{dans(a.coach ? e.serie : e.seul)}</p>
      </div>

      {phase === 'jeu' ? <EnJeu ex={ex} fini={finir} couleur={couleur} scene={scene} /> : (
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <Scene etat={scene} />
          <div className="absolute inset-x-0 bottom-0 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] flex flex-col items-center gap-3 text-center bg-gradient-to-t from-black/80 to-transparent">
            {phase === 'pret' && (
              <>
                <p className="text-sm text-white max-w-xs leading-relaxed" style={{ textShadow: '0 1px 4px rgba(0,0,0,.6)' }}>{dans(e.jeu)}</p>
                <button onClick={() => {
                  // l'attente est finie : le corps quitte sa pose d'attente pour l'exercice
                  const c = scene.current.corps;
                  c.debout = 0; c.enBloc = 0;
                  if (ex !== 'muscu' && ex !== 'gainage') c.posture = { w: 0 };
                  enCours.current = true;
                  setPhase('jeu');
                }}
                        className="rounded-2xl px-12 py-4 text-xl font-black tracking-widest text-black shadow-2xl" style={{ background: VERT }}>
                  {mot('go')}
                </button>
              </>
            )}
            {phase === 'fini' && res && <Bilan a={a} res={res} onFin={onFin} />}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

/** Le bilan d'une seance : la note, ce qu'elle a rapporte, ou la blessure. */
function Bilan({ a, res, onFin }: { a: Athlete; res: { score: number; r: ResultatSeance | null }; onFin: () => void }) {
  return (
    <>
      <span className="font-black font-display text-3xl text-white">{mot('score', { n: Math.round(res.score * 100) })}</span>
      {res.r?.blessure
        ? <span className="text-red-400 font-bold">{res.r.type ? dans(BLESSURES[res.r.type].nom) : mot('blessure_s')} · {a.blessure} {dans(['sem. d’arrêt', 'wk out'])}</span>
        : res.r && (
          <div className="flex gap-3">
            {Object.entries(res.r.gains).map(([k, v]) => (
              <span key={k} className="font-black" style={{ color: COULEUR[k as Stat] }}>{mot(k)} +{v}</span>
            ))}
          </div>
        )}
      {res.r?.gene && <span className="text-amber-300 text-sm font-bold">⚠ {dans(BLESSURES[res.r.gene].gene)}</span>}
      <button onClick={onFin} className="mt-1 rounded-xl px-8 py-3 font-black tracking-widest text-black" style={{ background: VERT }}>
        {mot('continuer')}
      </button>
    </>
  );
}

/* ================================================================ les departs, sur la piste */

const ESSAIS = 5;

/**
 * Les departs en blocs sur la piste du jeu : la sequence « depart » du tutoriel, le starter
 * et le pistolet du moteur, le corps de l'athlete. Cinq essais ; la reaction que mesure le
 * moteur fait la note (0,13 s : parfait ; 0,35 s et plus, ou faux depart : rien).
 */
export function DepartsEnPiste({ a, jour, onFin }: { a: Athlete; jour: Jour; onFin: () => void }) {
  const [essai, setEssai] = useState(0);
  const [dernier, setDernier] = useState<string | null>(null);
  const [res, setRes] = useState<{ score: number; r: ResultatSeance | null } | null>(null);
  const scores = useRef<number[]>([]);
  const traite = useRef(false);
  // la seance a ete comptee (au bilan ou en quittant) : une fois seulement
  const traite2 = useRef(false);

  const lancer = () => { traite.current = false; setDernier(null); demarrerSequence({ geste: 'depart', tempo: 1, demo: false }); };
  useEffect(() => {
    const G = SprinterApp.G as any;
    G.reglagesJoueur = { look: lookDe(apparenceDe(a), false) };
    lancer();
    let raf = 0, minuteur = 0;
    const pas = () => {
      const e = pasDuTuto() as { fini: boolean; abandon: boolean; reaction: number | null; fauxDepart: boolean } | null;
      if (e && e.fini && !traite.current) {
        traite.current = true;
        const r = e.reaction;
        const s = e.fauxDepart || e.abandon || r === null ? 0 : borne((0.35 - r) / 0.22);
        scores.current.push(s);
        setDernier(e.fauxDepart ? mot('faux') : r === null ? dans(['Trop tard', 'Too late']) : `${dans(['Réaction', 'Reaction'])} ${r.toFixed(3)} s`);
        minuteur = window.setTimeout(() => {
          const n = scores.current.length;
          setEssai(n);
          if (n < ESSAIS) { lancer(); return; }
          figerLaPiste();
          traite2.current = true;
          const score = scores.current.reduce((x, y) => x + y, 0) / ESSAIS;
          setRes({ score, r: faireLaSeance(a, jour, score, Math.random, bonusDeSeance(a)) });
          sauverAthlete(a);
        }, 1500);
      }
      raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    // la piste rendue en partant, et le corps de l'athlete retire : rien ne doit le suivre ailleurs
    return () => {
      cancelAnimationFrame(raf); clearTimeout(minuteur); rangerLeTuto(); G.reglagesJoueur = null;
      // quittee en route (Pause > Accueil) : la seance compte, les essais manquants a zero
      const n = scores.current.length;
      if (n > 0 && !traite2.current) {
        traite2.current = true;
        faireLaSeance(a, jour, scores.current.reduce((x, y) => x + y, 0) / ESSAIS, Math.random, bonusDeSeance(a));
        sauverAthlete(a);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center pointer-events-none text-foreground
                    pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] px-4">
      {/* sous le bandeau de course et la reaction du jeu, qui tiennent le haut de l'ecran */}
      <span className="relative mt-[11.5rem] px-3 py-1 rounded-full bg-black/60 text-[10px] font-black tracking-[0.22em]" style={{ color: COULEUR[SEANCES[jour].stat] }}>
        {mot(jour)} · {dans(EXOS.departs.nom).toUpperCase()}
      </span>
      <span className="relative mt-1 text-xs font-black tracking-[0.3em] text-white/80">{dans(['ESSAI', 'ATTEMPT'])} {Math.min(ESSAIS, essai + 1)} / {ESSAIS}</span>
      {dernier && <span className="relative mt-2 font-black font-display text-2xl text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">{dernier}</span>}
      {res && (
        <div className="pointer-events-auto mt-auto w-full max-w-sm rounded-2xl bg-[#0A1410]/95 border border-white/10 p-4 flex flex-col items-center gap-3 text-center">
          {/* la carriere se rouvre a l'accueil, la ou on l'a laissee */}
          <Bilan a={a} res={res} onFin={() => { demanderReouverture(); onFin(); }} />
        </div>
      )}
    </div>
  );
}
