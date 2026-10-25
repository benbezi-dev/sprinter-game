import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SprinterApp, SprinterCore } from '@/game/engine';
import {
  type Athlete, type Jour, type Exercice, type Stat, type Seance as ResultatSeance,
  SEANCES, exerciceDuJour, faireLaSeance,
} from '@/game/athlete/regles';
import { mot, dans, EXOS } from '@/game/athlete/mots';
import { lookDe, apparenceDe } from '@/game/athlete/apparence';
import { POSTURES } from '@/game/athlete/postures';

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

type Particule = { x: number; y: number; vx: number; vy: number; t: number; c: string; r: number };

function Scene({ etat }: { etat: React.MutableRefObject<EtatScene> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const c = cv.getContext('2d')!;
    const A = SprinterApp as any;
    let id = 0, avant = 0, piedAvant = 0, sol0: number | null = null;
    const parts: Particule[] = [];
    const tic = (ms: number) => {
      const dt = Math.min(0.05, avant ? (ms - avant) / 1000 : 0); avant = ms;
      const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const e = etat.current;
      const allonge = e.decor === 'tapis';
      const k = Math.min(H * 0.3, W * 0.42) * (allonge ? 0.72 : 1);   // l'echelle du corps : ~1,45 k de haut
      const ppm = k * 0.8;                                             // pixels par metre
      const sol = H * 0.8 + e.couloir * H * 0.05;
      const ax = W * (allonge ? 0.62 : 0.42);

      decor(c, e, W, H, ppm, sol, ax, ms / 1000);

      // le corps : ses volumes, poses sur le sol par leur point le plus bas
      const caps = A.personCapsules(e.corps, e.cap, e.incline, false, false, A.niveauDetail(k));
      if (sol0 === null) {
        const debout = { look: e.corps.look, stride: 0, v: 0, maxSpeed: 12, fallAnim: 0, celebrate: 0, drivePitch: 0, debout: 1 };
        sol0 = plusBas(A.personCapsules(debout, e.cap, 0, false, false, A.niveauDetail(k)));
      }
      const leve = (plusBas(caps) - sol0) * k;
      const y = sol + leve - e.vol * ppm;
      // l'ombre, qui s'ecarte quand on vole
      const o = Math.max(0.3, 1 - e.vol * 0.8);
      c.fillStyle = `rgba(0,0,0,${0.28 * o})`;
      c.beginPath(); c.ellipse(ax, sol, k * 0.42 * o, k * 0.09 * o, 0, 0, Math.PI * 2); c.fill();
      const yBarre = sol - (1.24 - 0.42 * (e.barre || 0)) * k, xBarre = ax - k * (0.06 + 0.12 * (e.barre || 0));
      if (e.barre !== null) barre(c, xBarre, yBarre, k, false);
      A.drawFacetFigure(c, caps, ax, y, k);
      if (e.barre !== null) barre(c, xBarre, yBarre, k, true);

      // la poussiere a chaque appui, les traits de vitesse, la sueur
      const v = e.corps.v || 0;
      const pied = Math.floor((e.corps.stride || 0) / Math.PI);
      if (pied !== piedAvant && v > 2 && e.vol < 0.05) {
        for (let i = 0; i < 5; i++) parts.push({ x: ax - k * 0.1, y: sol, vx: -v * ppm * 0.08 - Math.random() * 40, vy: -20 - Math.random() * 40, t: 0.6, c: e.decor === 'cote' || e.decor === 'parc' ? '#B89B70' : '#E9A58F', r: 2 + Math.random() * 3 });
      }
      piedAvant = pied;
      if (e.sueur > 0.4 && Math.random() < e.sueur * dt * 8) parts.push({ x: ax + k * 0.05, y: y - k * 1.3, vx: (Math.random() - 0.5) * 30, vy: -30, t: 0.8, c: '#BFE6FF', r: 2 });
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t -= dt; if (p.t <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt;
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
    return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
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

function ciel(c: CanvasRenderingContext2D, W: number, H: number, haut: string, bas: string) {
  const g = c.createLinearGradient(0, 0, 0, H * 0.6);
  g.addColorStop(0, haut); g.addColorStop(1, bas);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

function nuages(c: CanvasRenderingContext2D, W: number, H: number, t: number) {
  c.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 4; i++) {
    const x = ((fixe(i) * W * 1.6 - t * (6 + i * 3)) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3, y = H * (0.06 + fixe(i + 5) * 0.14);
    for (let j = 0; j < 4; j++) { c.beginPath(); c.arc(x + j * 18, y + (j % 2) * -7, 16 + (j % 3) * 5, 0, Math.PI * 2); c.fill(); }
  }
}

/** Une rangee d'arbres qui defile a `vitesse` fois le sol. */
function arbres(c: CanvasRenderingContext2D, W: number, base: number, defile: number, ppm: number, vitesse: number, taille: number, teinte: string) {
  const pas = taille * 2.6, off = ((defile * ppm * vitesse) % pas + pas) % pas;
  for (let x = -off - pas, i = 0; x < W + pas; x += pas, i++) {
    const s = taille * (0.8 + fixe(i + Math.floor(defile * ppm * vitesse / pas)) * 0.5);
    c.fillStyle = '#6B4A30'; c.fillRect(x - s * 0.07, base - s * 0.6, s * 0.14, s * 0.6);
    c.fillStyle = teinte; c.beginPath(); c.arc(x, base - s * 0.85, s * 0.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.arc(x - s * 0.15, base - s * 1.0, s * 0.22, 0, Math.PI * 2); c.fill();
  }
}

function decor(c: CanvasRenderingContext2D, e: EtatScene, W: number, H: number, ppm: number, sol: number, ax: number, t: number) {
  const d = e.defile;
  switch (e.decor) {
    case 'piste': case 'virage': {
      ciel(c, W, H, '#6FB1E6', '#CFE8F7'); nuages(c, W, H, t);
      // la tribune et son public, loin derriere
      const tH = H * 0.2, tY = H * 0.24;
      c.fillStyle = '#8D96A3'; c.fillRect(0, tY, W, tH);
      c.fillStyle = '#E8ECF1'; c.fillRect(0, tY - H * 0.035, W, H * 0.035);
      const off = (d * ppm * 0.25) % 14;
      for (let r = 0; r < 5; r++) for (let x = -off - 14, i = 0; x < W + 14; x += 14, i++) {
        const n = Math.floor(d * ppm * 0.25 / 14) + i + r * 31;
        if (fixe(n) < 0.25) continue;
        c.fillStyle = ['#E74C3C', '#3498DB', '#F1C40F', '#ECF0F1', '#2ECC71', '#9B59B6', '#E67E22'][Math.floor(fixe(n + 7) * 7)];
        c.beginPath(); c.arc(x + 7, tY + 10 + r * (tH - 16) / 4, 4, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#5E9450'; c.fillRect(0, tY + tH, W, H * 0.07);
      // la piste : rouge, couloirs blancs plus espaces vers l'avant (la perspective)
      const pY = tY + tH + H * 0.07;
      c.fillStyle = '#C8553D'; c.fillRect(0, pY, W, H - pY);
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      const lignes = [0, 0.13, 0.3, 0.52, 0.8, 1.15];
      lignes.forEach((f, i) => {
        const yy = pY + f * (H - pY) * 0.86;
        c.lineWidth = 1 + i * 0.4;
        if (e.decor === 'virage') {
          // la courbe : les lignes s'arrondissent vers le haut
          c.beginPath();
          for (let x = 0; x <= W; x += 12) { const u = (x - W / 2) / W; c.lineTo(x, yy - u * u * H * 0.18 * (1 + i * 0.2)); }
          c.stroke();
        } else { c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke(); }
      });
      // les reperes tous les 10 m
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.font = `800 ${Math.round(ppm * 0.35)}px system-ui`; c.textAlign = 'center';
      for (let m = Math.floor((d - ax / ppm) / 10) * 10; m < d + (W - ax) / ppm + 10; m += 10) {
        const x = ax + (m - d) * ppm;
        c.fillRect(x - 1.5, pY + (H - pY) * 0.45, 3, (H - pY) * 0.5);
        if (m > 0) c.fillText(`${m}`, x, pY + (H - pY) * 0.4);
      }
      // la zone a marquer (vitesse lancee) : des plots et un liseré dore
      if (e.zone) {
        const x0 = ax + (e.zone[0] - d) * ppm, x1 = ax + (e.zone[1] - d) * ppm;
        c.fillStyle = 'rgba(248,205,74,0.28)'; c.fillRect(x0, sol - ppm * 0.4, x1 - x0, ppm * 0.6);
        for (const x of [x0, x1]) { c.fillStyle = '#FF8A00'; c.beginPath(); c.moveTo(x - 8, sol + 2); c.lineTo(x + 8, sol + 2); c.lineTo(x, sol - 22); c.closePath(); c.fill(); }
      }
      // les blocs de depart, poses a 0 m
      const bx = ax + (0 - d) * ppm;
      if (bx > -60 && bx < W + 60) { c.fillStyle = '#3A3F46'; c.fillRect(bx - ppm * 0.9, sol - 6, ppm * 0.7, 6); c.fillStyle = '#C0C5CC'; c.fillRect(bx - ppm * 0.85, sol - 14, 8, 10); c.fillRect(bx - ppm * 0.45, sol - 12, 8, 8); }
      break;
    }
    case 'cote': {
      ciel(c, W, H, '#7DB9E8', '#E4F1F9'); nuages(c, W, H, t);
      // les collines lointaines, puis la cote elle-meme qui monte vers la droite
      c.fillStyle = '#9CC28A';
      c.beginPath(); c.moveTo(0, H * 0.5);
      for (let x = 0; x <= W; x += 20) c.lineTo(x, H * 0.48 - Math.sin((x + d * ppm * 0.15) / 90) * 14);
      c.lineTo(W, H); c.lineTo(0, H); c.fill();
      const p = Math.tan(e.pente);
      const yAt = (x: number) => sol - (x - ax) * p;
      arbres(c, W, H * 0.5, d, ppm, 0.4, ppm * 0.7, '#4C8C4A');
      c.fillStyle = '#6FA65B';
      c.beginPath(); c.moveTo(0, yAt(0)); c.lineTo(W, yAt(W)); c.lineTo(W, H); c.lineTo(0, H); c.fill();
      // le chemin de terre et les fanions tous les 10 m
      c.strokeStyle = '#C9B48A'; c.lineWidth = ppm * 0.5;
      c.beginPath(); c.moveTo(0, yAt(0) + ppm * 0.12); c.lineTo(W, yAt(W) + ppm * 0.12); c.stroke();
      for (let m = Math.floor((d - ax / ppm) / 10) * 10; m < d + (W - ax) / ppm + 10; m += 10) {
        if (m < 0 || m > 60) continue;
        const x = ax + (m - d) * ppm, y = yAt(x);
        c.fillStyle = '#5D4630'; c.fillRect(x - 1.5, y - ppm * 0.9, 3, ppm * 0.9);
        c.fillStyle = m === 60 ? '#F1C40F' : '#E74C3C';
        c.beginPath(); c.moveTo(x + 1.5, y - ppm * 0.9); c.lineTo(x + ppm * 0.45, y - ppm * 0.78); c.lineTo(x + 1.5, y - ppm * 0.66); c.fill();
        c.fillStyle = '#fff'; c.font = `800 ${Math.round(ppm * 0.28)}px system-ui`; c.textAlign = 'center'; c.fillText(m === 60 ? '60 m' : `${m}`, x, y + ppm * 0.4);
      }
      break;
    }
    case 'parc': {
      ciel(c, W, H, '#7DB9E8', '#E4F1F9'); nuages(c, W, H, t);
      c.fillStyle = '#8DBB74'; c.fillRect(0, H * 0.48, W, H);
      arbres(c, W, H * 0.55, d, ppm, 0.35, ppm * 0.8, '#3F7D42');
      arbres(c, W, H * 0.66, d, ppm, 0.7, ppm * 1.1, '#4C9A4E');
      c.fillStyle = '#D9C8A3'; c.fillRect(0, sol - ppm * 0.35, W, ppm * 0.9);
      c.fillStyle = 'rgba(0,0,0,0.06)';
      const off = (d * ppm) % 60;
      for (let x = -off; x < W; x += 60) c.fillRect(x, sol - ppm * 0.1, 26, 3);
      break;
    }
    case 'salle': case 'tapis': {
      // le mur, le miroir, le parquet
      const g = c.createLinearGradient(0, 0, 0, H * 0.7); g.addColorStop(0, '#E9E2D6'); g.addColorStop(1, '#D8CDBB');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = '#B9C7D3'; c.fillRect(W * 0.06, H * 0.1, W * 0.88, H * 0.45);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(W * 0.2, H * 0.1); c.lineTo(W * 0.32, H * 0.1); c.lineTo(W * 0.18, H * 0.55); c.lineTo(W * 0.06, H * 0.55); c.fill();
      c.strokeStyle = '#8B7355'; c.lineWidth = 4; c.strokeRect(W * 0.06, H * 0.1, W * 0.88, H * 0.45);
      c.fillStyle = '#B98A5A'; c.fillRect(0, H * 0.62, W, H);
      c.strokeStyle = 'rgba(80,50,20,0.25)'; c.lineWidth = 1;
      for (let y = H * 0.62; y < H; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      if (e.decor === 'salle') {
        // le rack de squat, les disques ranges
        c.fillStyle = '#3A3F46';
        c.fillRect(ax - ppm * 1.0, sol - ppm * 2.4, ppm * 0.12, ppm * 2.4);
        c.fillRect(ax + ppm * 0.9, sol - ppm * 2.6, ppm * 0.12, ppm * 2.6);
        c.fillRect(ax - ppm * 1.0, sol - ppm * 2.4, ppm * 2.0, ppm * 0.1);
        for (let i = 0; i < 4; i++) { c.fillStyle = ['#C0392B', '#2980B9', '#27AE60', '#F1C40F'][i]; c.fillRect(W * 0.82 + i * 7, sol - ppm * (0.5 + i * 0.05), 6, ppm * (0.5 + i * 0.05)); }
      } else {
        c.fillStyle = '#2F6FB5'; c.fillRect(ax - ppm * 1.6, sol - 4, ppm * 2.6, 10);
        c.fillStyle = '#3B7FC6'; c.fillRect(ax - ppm * 1.6, sol - 6, ppm * 2.6, 4);
      }
      break;
    }
  }
}

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
                className="rounded-2xl border-2 border-white/15 bg-white/[0.06] active:bg-white/25 active:scale-[0.98] transition-transform font-black text-2xl text-white/60 select-none">
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

/** Departs en blocs : cinq essais au pistolet. */
function Departs({ fini, couleur, scene }: JeuProps) {
  const [essai, setEssai] = useState(0);
  const [ordre, setOrdre] = useState<'marques' | 'prets' | 'pan' | 'vu'>('marques');
  const [dernier, setDernier] = useState('');
  const scores = useRef<number[]>([]);
  const pan = useRef(0), tir = useRef(0), debutEssai = useRef(0), sortie = useRef(-1), faute = useRef(false);
  const e = scene.current;
  const remettre = (t: number) => {
    debutEssai.current = t; tir.current = 1.4 + 1.0 + Math.random() * 1.4; pan.current = 0; sortie.current = -1; faute.current = false;
    const c = e.corps; c.enBloc = 1; c.prets = 0; c.v = 0; c.drivePitch = 0; c.d = 0; c.debout = 0; e.defile = 0;
    setOrdre('marques');
  };
  useHorloge((t, dt) => {
    if (essai >= 5) return true;
    if (!debutEssai.current) remettre(t || 0.001);
    const el = t - debutEssai.current, c = e.corps;
    if (ordre === 'marques' && el > 1.4) setOrdre('prets');
    if (ordre === 'prets') c.prets = Math.min(1, c.prets + dt * 2.2);
    if (ordre === 'prets' && el > tir.current) { setOrdre('pan'); pan.current = performance.now() / 1000; e.flash = 1; e.couleurFlash = '#FFF6D0'; e.fumee = 1; }
    if (ordre === 'pan' && performance.now() / 1000 - pan.current > 0.9) partir(performance.now() / 1000);
    // la sortie des blocs : le corps se deplie, accelere, se redresse
    if (sortie.current >= 0) {
      const s = performance.now() / 1000 - sortie.current;
      c.enBloc = Math.max(0, 1 - s * 4);
      c.drivePitch = 0.62 * Math.max(0, 1 - s / 1.3);
      courir(e, Math.min(faute.current ? 3 : 9.5, 2 + s * 7), dt);
      if (faute.current && s > 0.45) { c.v = 0; c.debout = Math.min(1, (s - 0.45) * 3); }
    }
  });
  const partir = (t: number) => {
    if (ordre === 'vu' || essai >= 5) return;
    let s = 0, msg: string;
    if (ordre !== 'pan') { msg = mot('faux'); faute.current = true; e.flash = 1; e.couleurFlash = '#FF3B3B'; }
    else {
      const r = t - pan.current;
      if (r < 0.1) { msg = `${mot('faux')} · ${r.toFixed(3)} s`; faute.current = true; e.flash = 1; e.couleurFlash = '#FF3B3B'; }
      else { s = borne((0.35 - r) / 0.22); msg = `${dans(['Réaction', 'Reaction'])} ${r.toFixed(3)} s`; }
    }
    // l'athlete part (ou s'arrete net sur un faux depart) : la sortie se compte en temps reel
    sortie.current = performance.now() / 1000;
    scores.current.push(s);
    setDernier(msg); setOrdre('vu');
    setTimeout(() => {
      const n = essai + 1; setEssai(n);
      if (n >= 5) fini(scores.current.reduce((x, y) => x + y, 0) / 5);
      else debutEssai.current = 0;
    }, 1500);
  };
  const { zone } = useAppuis((_, t) => partir(t));
  const texte = ordre === 'marques' ? dans(['À vos marques…', 'On your marks…'])
    : ordre === 'prets' ? dans(['Prêts…', 'Set…']) : ordre === 'pan' ? 'PAN !' : dernier;
  return { haut: `${dans(['ESSAI', 'ATTEMPT'])} ${Math.min(5, essai + 1)} / 5`, grand: texte, couleur, zone, libelles: [dans(['PARTIR', 'GO']), dans(['PARTIR', 'GO'])] as [string, string] };
}

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

const JEUX: Record<Exercice, { decor: Decor; jeu: (p: JeuProps) => Rendu }> = {
  departs: { decor: 'piste', jeu: Departs },
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
function EnJeu({ ex, fini, couleur, scene }: { ex: Exercice } & Omit<JeuProps, 'scene'> & { scene: React.MutableRefObject<EtatScene> }) {
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

export function SeanceJeu({ jour, a, onFin, exercice }: { jour: Jour; a: Athlete; onFin: () => void; exercice?: Exercice }) {
  // `exercice` : imposer l'exercice (l'apercu tools/apercu-seances.html) ; sinon, le programme du jour
  const ex = exercice || exerciceDuJour(a, jour);
  const e = EXOS[ex];
  // le lieu decide du decor : seul, les seances de piste se font au parc
  const decor: Decor = !a.club && JEUX[ex].decor === 'piste' ? 'parc' : JEUX[ex].decor;
  const couleur = COULEUR[SEANCES[jour].stat];
  const look = useRef(lookDe(apparenceDe(a), false));
  const scene = useRef<EtatScene>(nouvelEtat(look.current, decor));
  const [phase, setPhase] = useState<'pret' | 'jeu' | 'fini'>('pret');
  const [res, setRes] = useState<{ score: number; r: ResultatSeance | null } | null>(null);
  const finir = (s: number) => {
    const score = borne(s);
    setRes({ score, r: faireLaSeance(a, jour, score, Math.random) });
    // le corps se pose : bras leves si la seance est belle, debout sinon
    const c = scene.current.corps;
    c.v = 0; c.posture = { w: 0 }; c.marche = 0; scene.current.barre = null; scene.current.vol = 0;
    c.debout = 1; c.celebrate = score >= 0.7 ? 1 : 0;
    setPhase('fini');
  };
  // avant de commencer : l'athlete attend, en place pour l'exercice
  useEffect(() => {
    const s = scene.current, c = s.corps;
    if (ex === 'departs') { c.enBloc = 1; c.prets = 0; }
    else if (ex === 'muscu') { c.posture = POSTURES.squat(0); s.barre = 0; }
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
                  if (ex !== 'departs') { c.debout = 0; c.enBloc = 0; }
                  if (ex !== 'muscu' && ex !== 'gainage') c.posture = { w: 0 };
                  setPhase('jeu');
                }}
                        className="rounded-2xl px-12 py-4 text-xl font-black tracking-widest text-black shadow-2xl" style={{ background: VERT }}>
                  {mot('go')}
                </button>
              </>
            )}
            {phase === 'fini' && res && (
              <>
                <span className="font-black font-display text-3xl text-white">{mot('score', { n: Math.round(res.score * 100) })}</span>
                {res.r?.blessure
                  ? <span className="text-red-400 font-bold">{mot('blessure_s')}</span>
                  : res.r && (
                    <div className="flex gap-3">
                      {Object.entries(res.r.gains).map(([k, v]) => (
                        <span key={k} className="font-black" style={{ color: COULEUR[k as Stat] }}>{mot(k)} +{v}</span>
                      ))}
                    </div>
                  )}
                <button onClick={onFin} className="mt-1 rounded-xl px-8 py-3 font-black tracking-widest text-black" style={{ background: VERT }}>
                  {mot('continuer')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
