// LES AUTRES CINEMATIQUES DE LA LEGENDE — l'auteur, 07/10 : « les autres
// cinematiques ? ». Le cahier des charges n'en demandait qu'une (la montee
// vers Karman, LegendeKarman.tsx) ; il a choisi d'ajouter :
//
//   - LES VOYAGES 1 A 4 : a velo du quartier a la plage de Menole, en voiture
//     vers le regional, en car vers le national, en avion vers le mondial. Le
//     paysage du depart se change en paysage d'arrivee, la vraie distance
//     defile (grand cercle entre les deux lieux), et l'on arrive devant le
//     monument de l'etape — celui-la meme qui se dresse au loin pendant la
//     course (decors.ts).
//   - LA MONTEE VERS L'APOTHEOSE : la fusee quitte l'Olympe et traverse
//     l'espace — la Lune, Saturne, la nebuleuse d'Orion, Sagittarius A* au
//     coeur de la galaxie — jusqu'a la couronne de cristal de l'etape 6.
//   - LE SACRE : apres la sixieme etape gagnee, les six boss battus de cette
//     Legende s'allument un a un en constellation, convergent, et le nom du
//     joueur s'ecrit en or au milieu.
//
// Comme Karman : canvas 2D, sans un modele Tripo, toute la scene calculee
// depuis le temps (rien ne s'accumule), une touche passe. Pas de son.

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getSavedName } from '@/game/leaderboard';
import { drapeauDe } from '@/components/Insignes';
import { DEPART, ETAPES, type Lieu } from '@/game/legende/etapes';
import { lieuDeLEtape, memoire } from '@/game/legende/legende';
import { monumentDuLieu, objetsCulturels, preparerLeLointain } from '@/game/legende/decors';
import { cumulus, chargerLesCumulus, poserCumulus } from '@/game/legende/nuages';
import { citeCeleste, W as CITE_W, AX as CITE_AX, AY as CITE_AY } from '@/game/legende/cite-celeste';
import { mot, dans, nombre } from '@/game/legende/mots';
import { fusee } from './LegendeKarman';
import { vehicule as spriteVehicule, prechargerVehicules, type NomVehicule } from '@/game/legende/vehicules';
import { PORTRAITS, TEINTES } from './legende-commun';

type Rgb = [number, number, number];
type Pt = [number, number];
const mel = (a: Rgb, b: Rgb, t: number): Rgb =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: Rgb, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const lisse = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const fenetre = (t: number, a: number, b: number) => lisse((t - a) / (b - a));
const hache = (n: number) => Math.imul(n + 0x9e37, 2654435761) >>> 0;
const alea = (n: number) => hache(n) / 4294967296;
const sombre = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

type Peintre = (ctx: CanvasRenderingContext2D, W: number, H: number, t: number) => void;

/**
 * Le cadre commun : un portail plein ecran au-dessus de tout, une toile a la
 * taille de l'ecran, le fondu d'entree et de sortie, « touche pour passer ».
 * `creer` est appele une fois, au montage, et rend le peintre.
 */
function Cinematique({ nom, duree, creer, onFin }:
  { nom: string; duree: number; creer: () => Peintre; onFin: () => void }) {
  const toile = useRef<HTMLCanvasElement | null>(null);
  const fini = useRef(false);
  // le parent passe des fonctions neuves a chaque rendu : dans les
  // dependances, elles relanceraient la cinematique a chaque fois
  const surFin = useRef(onFin);
  surFin.current = onFin;
  const fabrique = useRef(creer);
  useEffect(() => {
    const cv = toile.current!;
    const ctx = cv.getContext('2d')!;
    const peindre = fabrique.current();
    const t0 = performance.now();
    let raf = 0;
    const finir = () => { if (fini.current) return; fini.current = true; surFin.current(); };
    const image = (now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth, H = window.innerHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = (now - t0) / 1000;
      if (t >= duree) { finir(); return; }
      ctx.save();
      peindre(ctx, W, H, t);
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.font = `600 ${Math.round(Math.max(10, H * 0.014))}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(mot('passer'), W / 2, H - 22);
      const voile = Math.max(1 - fenetre(t, 0, 0.35), fenetre(t, duree - 0.6, duree));
      if (voile > 0) { ctx.fillStyle = `rgba(0,0,0,${voile})`; ctx.fillRect(0, 0, W, H); }
      raf = requestAnimationFrame(image);
    };
    raf = requestAnimationFrame(image);
    return () => cancelAnimationFrame(raf);
  }, [duree]);

  return createPortal(
    <div data-legende={nom} className="fixed inset-0 z-[60] bg-black"
         onPointerDown={() => { if (!fini.current) { fini.current = true; surFin.current(); } }}>
      <canvas ref={toile} className="w-full h-full block" />
    </div>,
    document.body,
  );
}

/** Le texte, en gras, d'une taille qui tient dans `largeur`. */
function titre(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, taille: number, largeur: number,
               couleur: string | CanvasGradient, poids = 900) {
  ctx.font = `${poids} ${Math.round(taille)}px system-ui, sans-serif`;
  const w = ctx.measureText(s).width;
  if (w > largeur) ctx.font = `${poids} ${Math.round(taille * largeur / w)}px system-ui, sans-serif`;
  ctx.fillStyle = couleur;
  ctx.fillText(s, x, y);
}

/** Les kilometres a vol d'oiseau (grand cercle) entre deux lieux. */
function distanceKm(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180;
  const h = Math.sin((b[0] - a[0]) * r / 2) ** 2
          + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/* ===========================================================================
   LE VRAI DESIGN ET LE MOTION DESIGN DES VOYAGES (10/10)
   ===========================================================================
   L'auteur : « ameliore ou change les modes de deplacement », « ajoute du
   motion design et du reel design ». Les vehicules sont des modeles Tripo
   rendus de profil (game/legende/vehicules.ts) ; le dessin au canvas d'avant
   ne sert plus que tant que l'image n'est pas chargee. Par-dessus chaque
   voyage, un habillage : bandes cinema qui entrent avec un filet de la
   couleur de l'etape, balayage de lumiere a l'ouverture, vignette ; entre le
   vol et le trajet au sol, un volet en diagonale.
   =========================================================================== */

/** Le vehicule de profil, roues a yPied, haut de hPx ; false s'il n'est pas encore la. */
function poserVehicule(ctx: CanvasRenderingContext2D, nom: NomVehicule, x: number, yPied: number, hPx: number, rot = 0): boolean {
  const s = spriteVehicule(nom, 'profil');
  if (!s) return false;
  const k = hPx / s.h;
  ctx.save();
  ctx.translate(x, yPied); ctx.rotate(rot);
  ctx.drawImage(s.im, -s.w * k / 2, -s.h * k, s.w * k, s.h * k);
  ctx.restore();
  return true;
}

/** Des traits de vitesse qui filent vers la gauche, entre y0 et y1. */
function traitsDeVitesse(ctx: CanvasRenderingContext2D, W: number, H: number, y0: number, y1: number, t: number, force: number) {
  if (force <= 0.02) return;
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const L = W * (0.08 + 0.18 * alea(i * 5));
    const x = W + 60 - ((t * W * (1.6 + alea(i) * 1.4) + alea(i * 3) * W * 2) % (W + L + 120));
    const y = y0 + (y1 - y0) * alea(i * 7);
    const g = ctx.createLinearGradient(x, 0, x + L, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(255,255,255,${0.32 * force})`);
    ctx.fillStyle = g; ctx.fillRect(x, y, L, Math.max(1, H * 0.0018));
  }
  ctx.restore();
}

/** L'habillage commun : bandes cinema, filet de couleur, vignette, balayage de lumiere. */
function habillage(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, duree: number, teinte: string) {
  const b = H * 0.055 * fenetre(t, 0.05, 0.6) * (1 - fenetre(t, duree - 0.8, duree - 0.25));
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.36)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const s = fenetre(t, 0.15, 1.25);
  if (s > 0 && s < 1) {
    const x = -W * 0.5 + s * W * 2;
    const g = ctx.createLinearGradient(x - W * 0.3, 0, x + W * 0.3, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (b > 0.5) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, b); ctx.fillRect(0, H - b, W, b);
    const lw = W * fenetre(t, 0.35, 1.2);
    ctx.fillStyle = teinte;
    ctx.fillRect(0, b - 2, lw, 2); ctx.fillRect(W - lw, H - b, lw, 2);
  }
}

/** Le volet entre deux plans : une diagonale de la teinte couvre (u de 0 a 0,5) puis decouvre. */
function volet(ctx: CanvasRenderingContext2D, W: number, H: number, u: number, teinte: string) {
  const a = lisse(Math.min(1, u * 2)), b = lisse(Math.max(0, u * 2 - 1));
  const pente = W * 0.45;
  const x1 = -pente + (W + pente * 2) * a, x0 = -pente + (W + pente * 2) * b;
  ctx.save();
  ctx.fillStyle = teinte;
  ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.lineTo(x1 - pente, H); ctx.lineTo(x0 - pente, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1 + 5, 0); ctx.lineTo(x1 + 5 - pente, H); ctx.lineTo(x1 - pente, H); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ===========================================================================
   LES VOYAGES (etapes 1 a 4)
   =========================================================================== */

type Arbre = 'palmier' | 'cypres' | 'erable' | 'acacia' | 'pin' | 'maison' | 'pagode';
type Loin = 'collines' | 'montagnes' | 'mer' | 'ville' | 'villeBlanche' | 'plaine';
type Style = { loin: Loin; arbres: Arbre[]; sol: Rgb; loinC: Rgb; feuille: Rgb };

// Le paysage de chaque lieu, tel qu'on le traverse en arrivant.
const STYLES: Record<string, Style> = {
  quartier:   { loin: 'ville',        arbres: ['maison', 'palmier', 'maison'],    sol: [206, 178, 128], loinC: [150, 146, 160], feuille: [58, 138, 70] },
  menole:     { loin: 'mer',          arbres: ['palmier'],                        sol: [236, 212, 156], loinC: [70, 150, 200],  feuille: [56, 146, 66] },
  kyoto:      { loin: 'montagnes',    arbres: ['erable', 'erable', 'pagode'],     sol: [118, 148, 88],  loinC: [96, 124, 150],  feuille: [216, 70, 40] },
  kingston:   { loin: 'montagnes',    arbres: ['palmier', 'palmier', 'maison'],   sol: [108, 158, 78],  loinC: [70, 108, 150],  feuille: [48, 138, 58] },
  izmir:      { loin: 'mer',          arbres: ['cypres', 'maison', 'cypres'],     sol: [188, 168, 118], loinC: [60, 130, 190],  feuille: [36, 86, 48] },
  barcelone:  { loin: 'collines',     arbres: ['pin', 'cypres', 'maison'],        sol: [196, 170, 120], loinC: [134, 142, 156], feuille: [58, 108, 58] },
  casablanca: { loin: 'villeBlanche', arbres: ['palmier', 'maison'],              sol: [210, 190, 150], loinC: [236, 232, 224], feuille: [58, 138, 68] },
  abuja:      { loin: 'collines',     arbres: ['acacia', 'acacia', 'maison'],     sol: [178, 150, 90],  loinC: [124, 112, 92],  feuille: [92, 128, 58] },
  transit:    { loin: 'plaine',       arbres: ['acacia', 'pin', 'acacia'],        sol: [148, 160, 100], loinC: [122, 140, 152], feuille: [70, 118, 58] },
};
const styleDe = (l: Lieu) => STYLES[l.cle] || STYLES.transit;

// Le ciel de chaque voyage : le matin a velo, le plein jour en voiture,
// l'apres-midi dore en car, le couchant au-dessus des nuages en avion.
const CIELS: [Rgb, Rgb, Rgb][] = [   // haut, bas, soleil
  [[104, 172, 236], [255, 216, 168], [255, 236, 190]],
  [[64, 136, 224], [188, 224, 250], [255, 250, 230]],
  [[84, 124, 206], [255, 198, 136], [255, 226, 160]],
  [[40, 66, 146], [255, 172, 112], [255, 214, 150]],
];

function hauteurLoin(s: Loin, u: number, H: number) {
  const tri = (v: number) => 1 - Math.abs((((v % 2) + 2) % 2) - 1);
  switch (s) {
    case 'collines': return H * (0.05 + 0.025 * Math.sin(u * 0.0061) + 0.018 * Math.sin(u * 0.0173 + 1.3));
    case 'montagnes': return H * (0.035 + 0.1 * tri(u * 0.0042) + 0.035 * tri(u * 0.011 + 0.4));
    case 'mer': return H * 0.004;
    case 'ville': return H * (0.025 + 0.07 * alea(Math.floor(u / 26) * 7 + 3));
    case 'villeBlanche': {
      const i = Math.floor(u / 22);
      return H * (alea(i * 5 + 1) > 0.93 ? 0.085 : 0.016 + 0.03 * alea(i * 3));
    }
    default: return H * (0.012 + 0.008 * Math.sin(u * 0.01));
  }
}

function arbre(ctx: CanvasRenderingContext2D, type: Arbre, x: number, y: number, h: number, feuille: Rgb, g: number) {
  const tronc = '#6B4A30';
  switch (type) {
    case 'palmier': {
      const tx = x + h * 0.16 * (g % 2 ? 1 : -1), ty = y - h;
      ctx.strokeStyle = '#8A6A48'; ctx.lineWidth = h * 0.05; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - h * 0.6, tx, ty); ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.5 + (g % 7) * 0.03;
        const ex = tx + Math.cos(a) * h * 0.42, ey = ty + Math.sin(a) * h * 0.2 + h * 0.16;
        ctx.strokeStyle = css(sombre(feuille, i % 2 ? 0.8 : 1));
        ctx.lineWidth = h * 0.06;
        ctx.beginPath(); ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + Math.cos(a) * h * 0.3, ty + Math.sin(a) * h * 0.3 - h * 0.08, ex, ey); ctx.stroke();
      }
      ctx.fillStyle = '#5A3E22';
      ctx.beginPath(); ctx.arc(tx, ty + h * 0.04, h * 0.035, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'cypres': {
      const gr = ctx.createLinearGradient(x - h * 0.12, 0, x + h * 0.12, 0);
      gr.addColorStop(0, css(sombre(feuille, 1.25))); gr.addColorStop(1, css(sombre(feuille, 0.7)));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(x, y - h);
      ctx.quadraticCurveTo(x + h * 0.16, y - h * 0.45, x + h * 0.06, y);
      ctx.lineTo(x - h * 0.06, y); ctx.quadraticCurveTo(x - h * 0.16, y - h * 0.45, x, y - h); ctx.fill();
      break;
    }
    case 'erable': case 'acacia': case 'pin': {
      const plat = type !== 'erable';
      ctx.strokeStyle = tronc; ctx.lineWidth = h * (plat ? 0.045 : 0.07); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + h * 0.03, y - h * (plat ? 0.78 : 0.5)); ctx.stroke();
      if (type === 'acacia') {
        ctx.beginPath(); ctx.moveTo(x + h * 0.02, y - h * 0.5); ctx.lineTo(x - h * 0.22, y - h * 0.78); ctx.stroke();
      }
      const boules: [number, number, number][] = type === 'erable'
        ? [[-0.2, -0.62, 0.28], [0.2, -0.64, 0.27], [0, -0.82, 0.3], [0.02, -0.55, 0.24]]
        : [[-0.25, -0.86, 0.2], [0.05, -0.9, 0.22], [0.3, -0.85, 0.18], [-0.05, -0.8, 0.2]];
      boules.forEach(([dx, dy, r], i) => {
        ctx.fillStyle = css(sombre(feuille, 0.82 + 0.12 * ((i + g) % 3)));
        ctx.beginPath();
        ctx.ellipse(x + dx * h, y + dy * h, r * h * (plat ? 1.5 : 1), r * h * (plat ? 0.55 : 1), 0, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
    case 'maison': case 'pagode': {
      const w = h * 0.9, hm = h * 0.55;
      const murs: Rgb[] = [[236, 222, 196], [222, 196, 168], [246, 238, 226], [214, 222, 230]];
      const mur = murs[g % murs.length];
      if (type === 'pagode') {
        for (let n = 0; n < 3; n++) {
          const ww = w * (1 - n * 0.22), yy = y - n * h * 0.32;
          ctx.fillStyle = css(mel(mur, [120, 40, 30], 0.6)); ctx.fillRect(x - ww * 0.36, yy - h * 0.22, ww * 0.72, h * 0.22);
          ctx.fillStyle = '#3A3036';
          ctx.beginPath(); ctx.moveTo(x - ww * 0.62, yy - h * 0.2); ctx.quadraticCurveTo(x, yy - h * 0.34, x + ww * 0.62, yy - h * 0.2);
          ctx.lineTo(x + ww * 0.45, yy - h * 0.3); ctx.lineTo(x - ww * 0.45, yy - h * 0.3); ctx.closePath(); ctx.fill();
        }
        break;
      }
      ctx.fillStyle = css(mur); ctx.fillRect(x - w / 2, y - hm, w, hm);
      ctx.fillStyle = css(sombre(mur, 0.82)); ctx.fillRect(x + w * 0.22, y - hm, w * 0.28, hm);
      ctx.fillStyle = ['#B4553A', '#8A4A3A', '#C9763E', '#5F6E80'][(g >>> 3) % 4];
      ctx.beginPath(); ctx.moveTo(x - w * 0.58, y - hm); ctx.lineTo(x, y - hm - h * 0.32); ctx.lineTo(x + w * 0.58, y - hm); ctx.fill();
      ctx.fillStyle = '#3C4656';
      ctx.fillRect(x - w * 0.3, y - hm * 0.7, w * 0.16, hm * 0.3);
      ctx.fillRect(x + w * 0.02, y - hm * 0.62, w * 0.14, hm * 0.62);
      break;
    }
  }
}

/** Une roue : pneu, jante, rayons qui tournent. */
function roue(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, rayons: number, fine: boolean) {
  if (fine) {
    ctx.strokeStyle = '#1C1D22'; ctx.lineWidth = r * 0.2;
    ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(210,214,222,0.9)'; ctx.lineWidth = 0.7;
    for (let i = 0; i < rayons; i++) {
      const a = ang + (i * Math.PI * 2) / rayons;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#1C1D22'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#C9CED6'; ctx.beginPath(); ctx.arc(x, y, r * 0.58, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5B606C'; ctx.lineWidth = r * 0.12;
    for (let i = 0; i < rayons; i++) {
      const a = ang + (i * Math.PI * 2) / rayons;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.14, y + Math.sin(a) * r * 0.14);
      ctx.lineTo(x + Math.cos(a) * r * 0.52, y + Math.sin(a) * r * 0.52); ctx.stroke();
    }
  }
  ctx.fillStyle = '#7A808C'; ctx.beginPath(); ctx.arc(x, y, r * 0.12, 0, Math.PI * 2); ctx.fill();
}

// LE LOGO BENBEZI, celui des panneaux de la piste (public/pubs, rendu du
// logo 3D, BENBEZI/logo-3d) : « ·BEN BB EZI· », argent sur fond transparent.
// Le monogramme BB en occupe le milieu (x 650 a 870 sur 1400).
let logo: HTMLImageElement | null = null;
function logoBenbezi(): HTMLImageElement | null {
  if (!logo && typeof Image !== 'undefined') {
    logo = new Image();
    logo.src = import.meta.env.BASE_URL.replace(/\/$/, '') + '/pubs/benbezi-logo-3d.webp';
  }
  return logo && logo.complete && logo.naturalWidth ? logo : null;
}

/** Le logo passe a une couleur pleine (sur le fuselage blanc, l'argent ne se
 *  voit pas). Peint une fois par couleur. */
const logosTeints: Record<string, HTMLCanvasElement> = {};
function logoTeint(couleur: string): HTMLCanvasElement | null {
  const lg = logoBenbezi();
  if (!lg) return null;
  if (logosTeints[couleur]) return logosTeints[couleur];
  const cv = document.createElement('canvas');
  cv.width = lg.naturalWidth; cv.height = lg.naturalHeight;
  const c = cv.getContext('2d')!;
  c.drawImage(lg, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = couleur; c.fillRect(0, 0, cv.width, cv.height);
  return (logosTeints[couleur] = cv);
}

const PEAU = '#7A4A2C';

/** La jambe du cycliste : la hanche, le pied sur la pedale, le genou devant. */
function jambe(ctx: CanvasRenderingContext2D, P: Pt, Q: Pt, loin: boolean) {
  const L = 21;
  const dx = Q[0] - P[0], dy = Q[1] - P[1];
  const d = Math.min(Math.hypot(dx, dy), 2 * L - 0.01);
  const a0 = Math.atan2(dy, dx), al = Math.acos(d / (2 * L));
  const K: Pt = [P[0] + L * Math.cos(a0 - al), P[1] + L * Math.sin(a0 - al)];
  ctx.lineCap = 'round';
  ctx.strokeStyle = loin ? '#5A3620' : PEAU;
  ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(P[0], P[1]); ctx.lineTo(K[0], K[1]); ctx.stroke();
  ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(K[0], K[1]); ctx.lineTo(Q[0], Q[1]); ctx.stroke();
  ctx.strokeStyle = loin ? '#1E3C78' : '#2A56A8'; ctx.lineWidth = 8.5;
  ctx.beginPath(); ctx.moveTo(P[0], P[1]); ctx.lineTo(P[0] + (K[0] - P[0]) * 0.5, P[1] + (K[1] - P[1]) * 0.5); ctx.stroke();
  ctx.fillStyle = loin ? '#C8C8C8' : '#F4F4F4';
  ctx.beginPath(); ctx.ellipse(Q[0] + 2, Q[1], 5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
}

/** L'enfant sur son velo (la plage de Menole est la course des enfants). */
function velo(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, ang: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(0, 0, 46, 4, 0, 0, Math.PI * 2); ctx.fill();
  const cr = ang * 0.7;
  const BB: Pt = [-3, -16], S: Pt = [-11, -45], HD: Pt = [19, -47], R: Pt = [-27, -17], F: Pt = [27, -17];
  const pedale = (ph: number): Pt => [BB[0] + 8 * Math.cos(cr + ph), BB[1] + 8 * Math.sin(cr + ph)];
  const bob = Math.sin(cr * 2) * 0.6;
  const hanche: Pt = [-10, -52 + bob];
  jambe(ctx, hanche, pedale(Math.PI), true);
  roue(ctx, R[0], R[1], 17, ang, 10, true);
  roue(ctx, F[0], F[1], 17, ang, 10, true);
  ctx.strokeStyle = '#F2B632'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(R[0], R[1]); ctx.lineTo(BB[0], BB[1]); ctx.lineTo(S[0], S[1]); ctx.lineTo(R[0], R[1]);
  ctx.moveTo(S[0], S[1]); ctx.lineTo(HD[0], HD[1]); ctx.lineTo(BB[0], BB[1]);
  ctx.moveTo(HD[0], HD[1]); ctx.lineTo(F[0], F[1]);
  ctx.stroke();
  ctx.strokeStyle = '#2B2B30'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(HD[0], HD[1]); ctx.lineTo(21, -54); ctx.lineTo(26, -54); ctx.stroke();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-16, -47); ctx.lineTo(-6, -47); ctx.stroke();
  // la manivelle
  const p1 = pedale(0), p2 = pedale(Math.PI);
  ctx.strokeStyle = '#8A8F9A'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(p2[0], p2[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
  // le buste, penche sur le guidon, le t-shirt blanc floque
  const epaule: Pt = [5, -75 + bob];
  ctx.strokeStyle = '#F7F5F0'; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(hanche[0], hanche[1]); ctx.lineTo(epaule[0], epaule[1]); ctx.stroke();
  ctx.strokeStyle = '#F2B632'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hanche[0] + 2, hanche[1] - 9); ctx.lineTo(epaule[0] - 3, epaule[1] + 8); ctx.stroke();
  jambe(ctx, hanche, p1, false);
  // le bras, jusqu'a la poignee
  ctx.strokeStyle = PEAU; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(epaule[0], epaule[1]); ctx.lineTo(15, -62 + bob); ctx.lineTo(24, -55); ctx.stroke();
  ctx.strokeStyle = '#F7F5F0'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(epaule[0], epaule[1]); ctx.lineTo(epaule[0] + 4, epaule[1] + 5); ctx.stroke();
  // la tete et la casquette rouge, visiere devant
  ctx.fillStyle = PEAU; ctx.beginPath(); ctx.arc(12, -86 + bob, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#D93A2E';
  ctx.beginPath(); ctx.arc(11, -88 + bob, 8.4, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(14, -89 + bob, 10, 2.4);
  ctx.restore();
}

function voiture(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, ang: number, teinte: string) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 70, 5, 0, 0, Math.PI * 2); ctx.fill();
  const caisse = () => {
    ctx.beginPath();
    ctx.moveTo(-64, -12); ctx.lineTo(-65, -30); ctx.quadraticCurveTo(-64, -37, -56, -38); ctx.lineTo(-40, -39);
    ctx.lineTo(-26, -57); ctx.quadraticCurveTo(-23, -60, -18, -60); ctx.lineTo(13, -60);
    ctx.quadraticCurveTo(19, -60, 23, -56); ctx.lineTo(37, -41); ctx.lineTo(57, -38);
    ctx.quadraticCurveTo(66, -36, 66, -28); ctx.lineTo(66, -12); ctx.closePath();
  };
  const gr = ctx.createLinearGradient(0, -60, 0, -12);
  gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.08, teinte); gr.addColorStop(1, '#7A1E14');
  caisse(); ctx.fillStyle = gr; ctx.fill();
  ctx.save(); caisse(); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-70, -37, 140, 4);
  ctx.restore();
  const vitre = (pts: Pt[]) => {
    const v = ctx.createLinearGradient(0, -56, 0, -40);
    v.addColorStop(0, '#9CC0E0'); v.addColorStop(1, '#2C3E58');
    ctx.fillStyle = v; ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.fill();
  };
  vitre([[-36, -41], [-24, -56], [-5, -56], [-5, -41]]);
  vitre([[-1, -41], [-1, -56], [12, -56], [18, -53], [30, -41]]);
  ctx.fillStyle = '#1C2230'; ctx.beginPath(); ctx.arc(9, -48, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(4, -44, 11, 4);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-3, -40); ctx.lineTo(-3, -16); ctx.moveTo(30, -40); ctx.lineTo(32, -16); ctx.stroke();
  ctx.fillStyle = '#FFF4C0'; ctx.fillRect(61, -33, 5, 5);
  ctx.fillStyle = '#C21E1E'; ctx.fillRect(-66, -34, 4, 6);
  ctx.fillStyle = '#25272E';
  ctx.beginPath(); ctx.arc(-38, -12, 16, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.arc(40, -12, 16, Math.PI, 0); ctx.fill();
  roue(ctx, -38, -13, 13, ang, 5, false);
  roue(ctx, 40, -13, 13, ang, 5, false);
  ctx.restore();
}

function autocar(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, ang: number, teinte: string) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 112, 6, 0, 0, Math.PI * 2); ctx.fill();
  const caisse = () => {
    ctx.beginPath();
    ctx.moveTo(-104, -14); ctx.lineTo(-104, -84); ctx.quadraticCurveTo(-104, -92, -96, -92);
    ctx.lineTo(94, -92); ctx.quadraticCurveTo(101, -92, 103, -84); ctx.lineTo(108, -24);
    ctx.quadraticCurveTo(108, -14, 100, -14); ctx.closePath();
  };
  caisse(); ctx.fillStyle = '#F4F2EC'; ctx.fill();
  ctx.save(); caisse(); ctx.clip();
  ctx.fillStyle = teinte; ctx.fillRect(-110, -44, 230, 32);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-110, -20, 230, 8);
  ctx.fillStyle = '#2C2C34'; ctx.fillRect(-110, -48, 230, 4);
  ctx.restore();
  // les vitres et les passagers
  for (let i = 0; i < 7; i++) {
    const vx = -96 + i * 25;
    const v = ctx.createLinearGradient(0, -84, 0, -54);
    v.addColorStop(0, '#9CC0E0'); v.addColorStop(1, '#2C3E58');
    ctx.fillStyle = v; ctx.fillRect(vx, -84, 22, 30);
    if (i % 3 !== 1) {
      ctx.fillStyle = '#1C2230'; ctx.beginPath(); ctx.arc(vx + 11, -64, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(vx + 5, -60, 12, 6);
    }
  }
  const pb = ctx.createLinearGradient(0, -88, 0, -50);
  pb.addColorStop(0, '#B4D2EC'); pb.addColorStop(1, '#2C3E58');
  ctx.fillStyle = pb;
  ctx.beginPath(); ctx.moveTo(80, -86); ctx.lineTo(100, -86); ctx.lineTo(104, -48); ctx.lineTo(80, -48); ctx.fill();
  ctx.fillStyle = '#2C3E58'; ctx.fillRect(80, -44, 16, 28);
  const lg = logoBenbezi();
  if (lg) {
    // entre les deux passages de roue
    const lw = 92, lh = (lw * lg.naturalHeight) / lg.naturalWidth;
    ctx.save();
    ctx.shadowColor = 'rgba(60,24,0,0.55)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
    ctx.drawImage(lg, -4 - lw / 2, -31 - lh / 2, lw, lh);
    ctx.restore();
  }
  ctx.fillStyle = '#FFF4C0'; ctx.fillRect(103, -32, 5, 6);
  ctx.fillStyle = '#25272E';
  ctx.beginPath(); ctx.arc(-64, -14, 18, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.arc(62, -14, 18, Math.PI, 0); ctx.fill();
  roue(ctx, -64, -15, 15, ang, 6, false);
  roue(ctx, 62, -15, 15, ang, 6, false);
  ctx.restore();
}

function avion(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, rot: number, teinte: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
  // l'aile lointaine
  ctx.fillStyle = '#9AA2B0';
  ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(-26, -30); ctx.lineTo(-14, -30); ctx.lineTo(34, -4); ctx.fill();
  // le fuselage
  const f = ctx.createLinearGradient(0, -16, 0, 14);
  f.addColorStop(0, '#FFFFFF'); f.addColorStop(0.6, '#E8ECF2'); f.addColorStop(1, '#B8C0CC');
  ctx.fillStyle = f;
  ctx.beginPath();
  ctx.moveTo(-108, -6); ctx.quadraticCurveTo(-110, -14, -96, -14); ctx.lineTo(96, -14);
  ctx.bezierCurveTo(116, -14, 124, -4, 124, 2); ctx.bezierCurveTo(122, 10, 110, 12, 96, 12);
  ctx.lineTo(-84, 12); ctx.quadraticCurveTo(-104, 10, -108, -6); ctx.fill();
  ctx.fillStyle = teinte; ctx.fillRect(-90, 3, 190, 3);
  ctx.fillStyle = '#2C3E58';
  for (let i = 0; i < 18; i++) {
    const wx = -76 + i * 9.4;
    if (wx > -6 && wx < 66) continue;          // la place du logo
    ctx.beginPath(); ctx.ellipse(wx, -5, 1.6, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(108, -8); ctx.lineTo(116, -8); ctx.lineTo(118, -3); ctx.lineTo(107, -3); ctx.fill();
  // la derive, aux couleurs de l'etape
  ctx.fillStyle = teinte;
  ctx.beginPath(); ctx.moveTo(-84, -13); ctx.lineTo(-112, -54); ctx.lineTo(-98, -54); ctx.lineTo(-62, -13); ctx.fill();
  const lg = logoBenbezi();
  if (lg) {
    // le monogramme BB sur la derive, le logo entier le long du fuselage
    const sx = lg.naturalWidth * (650 / 1400), sw = lg.naturalWidth * (220 / 1400);
    ctx.drawImage(lg, sx, 0, sw, lg.naturalHeight, -99, -38, 16, (16 * lg.naturalHeight) / sw);
    const lw = 66, lh = (lw * lg.naturalHeight) / lg.naturalWidth;
    const lt = logoTeint(teinte);
    if (lt) ctx.drawImage(lt, 30 - lw / 2, -5 - lh / 2, lw, lh);
  }
  ctx.fillStyle = '#B8C0CC';
  ctx.beginPath(); ctx.moveTo(-92, 2); ctx.lineTo(-118, 12); ctx.lineTo(-106, 12); ctx.lineTo(-80, 4); ctx.fill();
  // l'aile proche et son reacteur
  const a = ctx.createLinearGradient(0, 0, 0, 40);
  a.addColorStop(0, '#E2E6EE'); a.addColorStop(1, '#A4ACBA');
  ctx.fillStyle = a;
  ctx.beginPath(); ctx.moveTo(16, 4); ctx.lineTo(-34, 40); ctx.lineTo(-18, 40); ctx.lineTo(40, 6); ctx.fill();
  ctx.fillStyle = '#C4CAD4'; ctx.beginPath(); ctx.ellipse(-2, 20, 15, 6.5, -0.05, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3A3F4A'; ctx.beginPath(); ctx.ellipse(12, 20, 2.6, 5.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** La progression du voyage : on demarre, on file, on freine devant le monument. */
function progression(duree: number) {
  const N = 400, v: number[] = [], cum: number[] = [0];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * duree;
    v.push(fenetre(t, 0.3, 1.4) * (1 - fenetre(t, duree - 2.4, duree - 0.9)) + 0.0001);
    cum.push(cum[i] + v[i]);
  }
  return (t: number) => {
    const i = Math.max(0, Math.min(N, Math.round((t / duree) * N)));
    return cum[i] / cum[N];
  };
}

// Les voyages, coherents (10/10) : a velo jusqu'a Menole ; vol de ligne puis
// voiture (regional) ; vol de ligne puis car de l'equipe (national) ; jet
// prive BENBEZI (mondial). On ne traverse plus l'ocean en voiture.
const VOL_ARRIVEE = 3.8;     // s : la part du vol, avant le volet
const DUREES = [8.2, 11.0, 11.0, 8.6];

export function CinematiqueVoyage({ rang, onFin }: { rang: number; onFin: () => void }) {
  const duree = DUREES[rang] ?? 8.2;
  return <Cinematique nom={`voyage-${rang}`} duree={duree} onFin={onFin}
                      creer={() => {
                        prechargerVehicules(['velo', 'avion', 'voiture', 'car', 'jet']);
                        const p = rang === 3 ? peintreAvion(rang, { nom: 'jet', mode: mot('vol_jet') })
                          : rang === 0 ? peintreRoute(0) : peintreVolPuisSol(rang);
                        return (ctx, W, H, t) => { p(ctx, W, H, t); habillage(ctx, W, H, t, duree, TEINTES[rang]); };
                      }} />;
}

/** Regional et national : le vol de ligne, un volet, puis le dernier bout au sol. */
function peintreVolPuisSol(rang: number): Peintre {
  const vol = peintreAvion(rang, { duree: VOL_ARRIVEE + 0.7, descente: false, nom: 'avion', mode: mot('vol_ligne') });
  const sol = peintreRoute(rang, { local: true, duree: (DUREES[rang] ?? 11) - VOL_ARRIVEE,
                                   departNom: dans(['Aéroport', 'Airport']), km: 22 + rang * 4 });
  const teinte = TEINTES[rang];
  return (ctx, W, H, t) => {
    if (t < VOL_ARRIVEE) vol(ctx, W, H, t); else sol(ctx, W, H, t - VOL_ARRIVEE);
    const u = (t - (VOL_ARRIVEE - 0.38)) / 0.76;
    if (u > 0 && u < 1) volet(ctx, W, H, u, teinte);
  };
}

/** Ce qui s'ecrit en haut : l'etape, d'ou vers ou, la distance, puis le lieu. */
function hudVoyage(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, duree: number,
                   rang: number, depart: Lieu, arrivee: Lieu, km: number, mode?: string) {
  const e = ETAPES[rang];
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 8;
  ctx.textAlign = 'left';
  ctx.font = `700 ${Math.round(Math.max(12, H * 0.018))}px ui-monospace, monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(`${nombre(km, km < 10 ? 1 : 0)} ${mot('u_km')}`, 18, 34);
  ctx.textAlign = 'center';
  ctx.font = `800 ${Math.round(Math.max(10, H * 0.015))}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText(`${mot('etape', { n: rang + 1 })} · ${dans(e.intitule).toUpperCase()} · ${(mode ?? mot(e.transport)).toUpperCase()}`, W / 2, H * 0.085);
  titre(ctx, `${depart.nom.toUpperCase()}  →  ${arrivee.nom.toUpperCase()}`, W / 2, H * 0.12,
        Math.max(14, H * 0.024), W * 0.9, 'rgba(255,255,255,0.95)', 800);
  ctx.restore();
  const a = fenetre(t, duree - 2.7, duree - 2.1);
  if (a > 0) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 12;
    const d = drapeauDe(arrivee.drapeau);
    titre(ctx, (d ? d + ' ' : '') + arrivee.nom.toUpperCase(), W / 2, H * 0.22 + (1 - a) * 10,
          Math.min(W * 0.13, H * 0.075), W * 0.92, '#FFFFFF');
    // le filet de la couleur de l'etape se tire sous le nom
    ctx.shadowBlur = 0;
    const lw = W * 0.42 * fenetre(t, duree - 2.5, duree - 1.7);
    ctx.fillStyle = TEINTES[rang];
    ctx.fillRect(W / 2 - lw / 2, H * 0.22 + Math.min(W * 0.13, H * 0.075) * 0.32, lw, Math.max(2, H * 0.004));
    ctx.restore();
  }
}

function peintreRoute(rang: number, o: { local?: boolean; duree?: number; departNom?: string; km?: number } = {}): Peintre {
  const duree = o.duree ?? 8.2;
  const arrivee = lieuDeLEtape(rang);
  // au sol apres le vol : de l'aeroport au stade, dans la ville d'arrivee
  const depart: Lieu = o.local ? { ...arrivee, nom: o.departNom ?? arrivee.nom } : (rang === 0 ? DEPART : lieuDeLEtape(rang - 1));
  const sA = styleDe(arrivee);
  const sD = o.local ? sA : styleDe(depart), sT = o.local ? sA : STYLES.transit;
  const km = o.km ?? (depart.geo && arrivee.geo ? distanceKm(depart.geo, arrivee.geo) : 0);
  const p = progression(duree);
  const [cielH, cielB, soleil] = CIELS[rang];
  const teinte = TEINTES[rang];
  const transport = ETAPES[rang].transport;
  // le monument et les nuages se chargent des l'ouverture ; au sol apres le
  // vol, les objets du lieu aussi (ils bordent la route)
  monumentDuLieu(arrivee.cle);
  if (o.local) preparerLeLointain(arrivee.cle);
  chargerLesCumulus(true);
  logoBenbezi();
  const poids = (fr: number): [number, number, number] => {
    const a = 1 - fenetre(fr, 0.22, 0.38), c = fenetre(fr, 0.58, 0.74);
    return [a, Math.max(0, 1 - a - c), c];
  };
  const melStyles = (w: [number, number, number], f: (s: Style) => Rgb): Rgb => {
    const A = f(sD), B = f(sT), C = f(sA);
    return [A[0] * w[0] + B[0] * w[1] + C[0] * w[2], A[1] * w[0] + B[1] * w[1] + C[1] * w[2],
            A[2] * w[0] + B[2] * w[1] + C[2] * w[2]];
  };

  return (ctx, W, H, t) => {
    const D = W * 7;
    const X = p(t) * D;
    const v = Math.max(0, p(Math.min(duree, t + 0.05)) - p(t)) * D / 0.05;   // px/s
    const k = Math.min(W / 400, H / 560) * (transport === 'velo' ? 1.25 : 1);
    const parM0 = Math.min(H * 0.07, W * 0.062);          // pixels par metre, au bord de la route
    const yH = H * 0.6, yMid = H * 0.67, yR0 = H * 0.72, yR1 = H * 0.8, yRoue = H * 0.775;
    const frac = (u: number, f: number) => Math.max(0, Math.min(1, (u - W * 0.5) / (D * f)));

    // le ciel et le soleil
    const g = ctx.createLinearGradient(0, 0, 0, yH);
    g.addColorStop(0, css(cielH)); g.addColorStop(1, css(cielB));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, yH + 2);
    const sx = W * 0.8 - X * 0.01, sy = H * (rang === 2 ? 0.36 : 0.24);
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.45);
    halo.addColorStop(0, css(soleil, 0.6)); halo.addColorStop(1, css(soleil, 0));
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, yH);
    ctx.fillStyle = css(soleil); ctx.beginPath(); ctx.arc(sx, sy, Math.min(W, H) * 0.045, 0, Math.PI * 2); ctx.fill();
    // des cumulus qui passent lentement
    for (let i = 0; i < 5; i++) {
      const im = cumulus(i * 2 + rang, true);
      if (!im) continue;
      const boucle = W * 1.8;
      const cx = ((i * boucle) / 5 - X * 0.03 + boucle * 4) % boucle - W * 0.3;
      poserCumulus(ctx, im, cx, H * (0.3 + 0.06 * (i % 3)), W * (0.22 + 0.06 * (i % 2)), i % 2 === 1);
    }

    // les silhouettes lointaines, qui changent de forme du depart a l'arrivee
    const fL = 0.1;
    ctx.beginPath(); ctx.moveTo(-10, yH + 2);
    let cL: Rgb = sD.loinC;
    for (let x = -10; x <= W + 10; x += 6) {
      const u = x + X * fL, w = poids(frac(u, fL));
      const h = w[0] * hauteurLoin(sD.loin, u, H) + w[1] * hauteurLoin(sT.loin, u, H) + w[2] * hauteurLoin(sA.loin, u, H);
      ctx.lineTo(x, yH - h);
      if (Math.abs(x - W / 2) < 4) cL = melStyles(w, s => s.loinC);
    }
    ctx.lineTo(W + 10, yH + 2); ctx.closePath();
    ctx.fillStyle = css(mel(cL, cielB, 0.35)); ctx.fill();

    // le sol, et la mer quand le paysage en a une
    const wC = poids(p(t));
    const sol = melStyles(wC, s => s.sol);
    const gs = ctx.createLinearGradient(0, yH, 0, H);
    gs.addColorStop(0, css(mel(sol, cielB, 0.25))); gs.addColorStop(1, css(sombre(sol, 0.78)));
    ctx.fillStyle = gs; ctx.fillRect(0, yH, W, H - yH);
    const mer = (sD.loin === 'mer' ? wC[0] : 0) + (sA.loin === 'mer' ? wC[2] : 0);
    if (mer > 0.01) {
      const gm = ctx.createLinearGradient(0, yH, 0, yH + H * 0.05);
      gm.addColorStop(0, `rgba(80,160,214,${mer})`); gm.addColorStop(1, `rgba(40,120,190,${mer})`);
      ctx.fillStyle = gm; ctx.fillRect(0, yH, W, H * 0.05);
      ctx.fillStyle = `rgba(255,255,255,${0.7 * mer})`;
      for (let i = 0; i < 26; i++) {
        const xx = ((i * 97 + t * 8 - X * 0.12) % (W + 40) + W + 40) % (W + 40) - 20;
        ctx.fillRect(xx, yH + H * (0.008 + 0.038 * alea(i)), 6 + 8 * alea(i + 9), 1.4);
      }
      // l'ecume sur le sable
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * mer})`; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, yH + H * 0.05 + Math.sin(x * 0.05 + t * 2) * 2);
      ctx.stroke();
    }

    // LE STADE S'ANNONCE : au sol apres le vol, ses projecteurs s'allument a
    // l'horizon et balaient le ciel quand on approche
    if (o.local) {
      const a = fenetre(p(t), 0.42, 0.72);
      if (a > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let j = 0; j < 4; j++) {
          const bx = W * (0.08 + 0.26 * j) + (1 - a) * W * 0.3, by = yH - H * 0.01;
          const ang = -Math.PI / 2 + Math.sin(t * 0.9 + j * 1.7) * 0.32;
          const L = H * 0.55, l = W * 0.05;
          const gx = bx + Math.cos(ang) * L, gy = by + Math.sin(ang) * L;
          const g = ctx.createLinearGradient(bx, by, gx, gy);
          const scint = 0.75 + 0.25 * Math.sin(t * 23 + j * 5) * (1 - fenetre(p(t), 0.6, 0.7));
          g.addColorStop(0, `rgba(255,248,220,${0.38 * a * scint})`); g.addColorStop(1, 'rgba(255,248,220,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(bx - 3, by);
          ctx.lineTo(gx - Math.sin(ang) * l, gy + Math.cos(ang) * l); ctx.lineTo(gx + Math.sin(ang) * l, gy - Math.cos(ang) * l);
          ctx.lineTo(bx + 3, by); ctx.closePath(); ctx.fill();
          const h = ctx.createRadialGradient(bx, by, 0, bx, by, W * 0.07);
          h.addColorStop(0, `rgba(255,250,230,${0.8 * a * scint})`); h.addColorStop(1, 'rgba(255,250,230,0)');
          ctx.fillStyle = h; ctx.fillRect(bx - W * 0.07, by - W * 0.07, W * 0.14, W * 0.14);
        }
        ctx.restore();
      }
    }

    // le monument d'arrivee, qui se leve a droite en fin de voyage
    const M = monumentDuLieu(arrivee.cle);
    if (M) {
      const plage = arrivee.cle === 'menole';
      const fM = plage ? 0.45 : 0.22;
      const xm = (plage ? 0.78 : 0.66) * W + D * fM - X * fM;
      let kM = plage ? (W * 0.4) / M.w : (H * (W > H ? 0.5 : 0.36)) / M.ay;
      if (M.w * kM > W * 0.9) kM = (W * 0.9) / M.w;
      if (xm - M.ax * kM < W && xm + (M.w - M.ax) * kM > 0) {
        // au bord de la mer, il se pose sur la rive et non dans l'eau
        const base = plage ? yMid + H * 0.012 : sA.loin === 'mer' ? yMid : yH + H * 0.012;
        ctx.drawImage(M.im, xm - M.ax * kM, base - M.ay * kM, M.w * kM, M.h * kM);
      }
    }

    // les arbres et les maisons du bord, de chaque lieu traverse
    const fM = 0.45, pas = 92;
    for (let i = Math.floor((X * fM - 120) / pas); i * pas - X * fM < W + 120; i++) {
      if (alea(i * 13) < 0.22) continue;
      const u = i * pas + alea(i) * 40, x = u - X * fM;
      const fr = frac(u, fM);
      // l'arrivee se degage : rien ne pousse devant le monument
      if (fr > 0.93) continue;
      const s = fr < 0.3 ? sD : fr > 0.66 ? sA : sT;
      // au sol apres le vol : les vrais objets du lieu (torii, lanternes,
      // kiosques...), un sur deux, entre les arbres
      const objets = o.local ? objetsCulturels(arrivee.cle) : [];
      if (objets.length && hache(i * 5) % 2 === 0) {
        const ob = objets[hache(i * 11) % objets.length];
        const kO = (Math.min(ob.largeurM, 6) * parM0) / ob.w;
        ctx.drawImage(ob.im, x - ob.ax * kO, yMid + H * 0.01 - ob.ay * kO, ob.w * kO, ob.h * kO);
        continue;
      }
      const type = s.arbres[hache(i) % s.arbres.length];
      arbre(ctx, type, x, yMid, H * 0.1 * (0.8 + 0.5 * alea(i * 3)) * (type === 'maison' ? 0.75 : 1), s.feuille, hache(i * 7));
    }

    // la route : du sable tasse pour le velo, l'asphalte ensuite
    const sable = transport === 'velo';
    ctx.fillStyle = sable ? css(mel(sol, [200, 170, 120], 0.5)) : '#4A4C55';
    ctx.fillRect(0, yR0, W, yR1 - yR0);
    ctx.fillStyle = sable ? 'rgba(255,255,255,0.18)' : '#D8D4C8';
    ctx.fillRect(0, yR0, W, 2);
    if (!sable) {
      ctx.fillStyle = '#F2EFE6';
      const L = 46;
      for (let x = -((X % (L * 2)) + L * 2) % (L * 2); x < W; x += L * 2) ctx.fillRect(x, (yR0 + yR1) / 2 - 1.5, L, 3);
      // les bornes
      for (let x = -((X % 260) + 260) % 260; x < W + 20; x += 260) {
        ctx.fillStyle = '#F4F4F4'; ctx.fillRect(x, yR0 - 16, 4, 16);
        ctx.fillStyle = '#D33A2C'; ctx.fillRect(x, yR0 - 13, 4, 3);
      }
    }

    // le vehicule : le modele Tripo de profil, sinon le dessin d'avant
    const xv = W * (transport === 'car' ? 0.42 : 0.36);
    const ang = X / (14 * k);
    const vite = Math.min(1, v / 300);
    traitsDeVitesse(ctx, W, H, yR0 - H * 0.12, yR1, t, vite * (transport === 'velo' ? 0.5 : 1));
    const parM = parM0 * (transport === 'velo' ? 1.45 : transport === 'voiture' ? 1.35 : 1);
    const nomV: NomVehicule = transport === 'velo' ? 'velo' : transport === 'voiture' ? 'voiture' : 'car';
    const hautM = transport === 'velo' ? 1.75 : transport === 'voiture' ? 1.48 : 3.7;
    const cahot = Math.sin(t * (transport === 'velo' ? 9 : 19)) * 0.6 * vite;
    if (transport === 'velo') {
      for (let i = 0; i < 10; i++) {
        const age = (t * 3 + i / 10) % 1;
        ctx.fillStyle = `rgba(236,214,170,${0.4 * (1 - age) * vite})`;
        ctx.beginPath(); ctx.arc(xv - 30 * k - age * 60 * k, yRoue - 3 - age * 10, 3 + age * 6, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (poserVehicule(ctx, nomV, xv, yR1 - H * 0.018 + cahot, hautM * parM)) {
      // le car de l'equipe porte le logo BENBEZI sur son flanc
      const sp = nomV === 'car' ? spriteVehicule('car', 'profil') : null, lg = logoBenbezi();
      if (sp && lg) {
        const hv = hautM * parM, lv = hv * sp.w / sp.h, ll = lv * 0.3;
        ctx.drawImage(lg, xv - lv * 0.06 - ll / 2, yR1 - H * 0.018 + cahot - hv * 0.5 - ll * lg.height / lg.width / 2,
                      ll, ll * lg.height / lg.width);
      }
    } else if (transport === 'velo') {
      velo(ctx, xv, yRoue, k, ang);
    } else if (transport === 'voiture') {
      voiture(ctx, xv, yRoue + Math.sin(t * 22) * 0.5 * Math.min(1, v / 300), k, ang, teinte);
    } else {
      autocar(ctx, xv, yRoue + Math.sin(t * 16) * 0.6 * Math.min(1, v / 300), k, ang, teinte);
    }

    // le premier plan, qui file : touffes, cailloux
    const fP = 1.7;
    for (let i = Math.floor((X * fP - 60) / 70); i * 70 - X * fP < W + 60; i++) {
      const x = i * 70 + alea(i * 5) * 50 - X * fP, y = H * (0.84 + 0.12 * alea(i * 11));
      ctx.fillStyle = css(sombre(sol, 0.6), 0.7);
      if (alea(i * 2) < 0.5) {
        for (let j = 0; j < 5; j++) {
          ctx.beginPath(); ctx.moveTo(x + j * 3, y);
          ctx.quadraticCurveTo(x + j * 3 - 2, y - 10, x + j * 3 + (j - 2) * 3, y - 16 - 4 * alea(i + j)); ctx.lineTo(x + j * 3 + 2, y); ctx.fill();
        }
      } else {
        ctx.beginPath(); ctx.ellipse(x, y, 7 + 5 * alea(i), 4, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    hudVoyage(ctx, W, H, t, duree, rang, depart, arrivee, km * p(t), o.local ? mot(transport) : undefined);
  };
}

/** En avion : au-dessus de la mer de nuages, puis la descente sur la ville. */
function peintreAvion(rang: number, o: { duree?: number; descente?: boolean; nom?: 'avion' | 'jet'; mode?: string } = {}): Peintre {
  const duree = o.duree ?? 8.6;
  const nomAvion = o.nom ?? 'avion';
  const depart = lieuDeLEtape(rang - 1), arrivee = lieuDeLEtape(rang);
  const km = depart.geo && arrivee.geo ? distanceKm(depart.geo, arrivee.geo) : 0;
  const p = progression(duree);
  const [cielH, cielB, soleil] = CIELS[rang];
  const teinte = TEINTES[rang];
  chargerLesCumulus(true);
  monumentDuLieu(arrivee.cle);
  logoBenbezi();
  return (ctx, W, H, t) => {
    const X = p(t) * W * 9;
    const descente = o.descente === false ? 0 : fenetre(t, duree - 3.4, duree - 1.0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, css(mel(cielH, [70, 130, 210], descente)));
    g.addColorStop(1, css(mel(cielB, [196, 222, 244], descente)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const sx = W * 0.82, sy = H * (0.5 - 0.25 * descente);
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.6);
    halo.addColorStop(0, css(soleil, 0.7)); halo.addColorStop(1, css(soleil, 0));
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = css(soleil); ctx.beginPath(); ctx.arc(sx, sy, Math.min(W, H) * 0.05, 0, Math.PI * 2); ctx.fill();

    // la ville d'arrivee, qui monte sous les nuages qui s'ouvrent : les
    // immeubles dans la brume, le monument, un rang plus proche, et le
    // fleuve — la Seine, la Tamise ou l'Hudson
    const monte = (1 - descente) * H * 0.5;
    if (descente > 0) {
      const yS = H * 0.8 + monte;
      const rang_ = (y0: number, larg: number, hmax: number, graine: number, c: Rgb) => {
        ctx.fillStyle = css(c);
        for (let x = -20, i = 0; x < W + 20; i++) {
          const w = larg * (0.6 + 0.8 * alea(graine + i * 3));
          const h = H * hmax * (0.35 + 0.65 * alea(graine + i * 7));
          ctx.fillRect(x, y0 - h, w - 2, h + 2);
          // les fenetres allumees
          ctx.fillStyle = 'rgba(255,240,200,0.35)';
          for (let fy = y0 - h + 5; fy < y0 - 4; fy += 7) for (let fx = x + 3; fx < x + w - 5; fx += 6) {
            if (alea(graine + i * 13 + fx * 3 + fy) > 0.6) ctx.fillRect(fx, fy, 2, 3);
          }
          ctx.fillStyle = css(c);
          x += w;
        }
      };
      rang_(yS, 34, 0.11, 400, mel(mel(cielB, [196, 222, 244], descente), [96, 108, 130], 0.45));
      const M = monumentDuLieu(arrivee.cle);
      if (M) {
        let kM = (H * (W > H ? 0.48 : 0.3)) / M.ay;
        if (M.w * kM > W * 0.9) kM = (W * 0.9) / M.w;
        ctx.drawImage(M.im, W * 0.64 - M.ax * kM, yS + H * 0.02 - M.ay * kM, M.w * kM, M.h * kM);
      }
      rang_(yS + H * 0.035, 46, 0.05, 900, [74, 84, 104]);
      const gf = ctx.createLinearGradient(0, yS + H * 0.035, 0, yS + H * 0.1);
      gf.addColorStop(0, '#5E86B0'); gf.addColorStop(1, '#2E4C72');
      ctx.fillStyle = gf; ctx.fillRect(0, yS + H * 0.035, W, H * 0.065);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (let i = 0; i < 20; i++) {
        ctx.fillRect(((i * 83 + t * 12) % (W + 30)) - 15, yS + H * (0.045 + 0.05 * alea(i + 70)), 10 + 10 * alea(i), 1.4);
      }
      ctx.fillStyle = '#3E4A3C'; ctx.fillRect(0, yS + H * 0.1, W, H);
    }

    // trois nappes de cumulus : loin, milieu, pres — elles s'ecartent a la descente
    const nappes: [number, number, number, number][] = [[0.05, 0.62, 0.2, 9], [0.18, 0.72, 0.32, 7], [0.5, 0.86, 0.55, 5], [0.9, 1.0, 0.75, 4]];
    // le dessus de la mer de nuages, sous les cumulus : pas de ciel en bas
    const fond = 1 - descente;
    if (fond > 0.01) {
      const gn = ctx.createLinearGradient(0, H * 0.7, 0, H);
      gn.addColorStop(0, 'rgba(236,236,244,0)'); gn.addColorStop(0.35, `rgba(232,232,242,${0.9 * fond})`);
      gn.addColorStop(1, `rgba(214,216,232,${fond})`);
      ctx.fillStyle = gn; ctx.fillRect(0, H * 0.7 + descente * H * 0.6, W, H);
    }
    nappes.forEach(([f, yy, l, n], j) => {
      const a = 1 - Math.min(1, descente * (j >= 2 ? 1.7 : 1.1));
      if (a <= 0.02) return;
      ctx.save(); ctx.globalAlpha = a;
      const boucle = W * (1 + l * 1.2);
      for (let i = 0; i < n; i++) {
        const im = cumulus(i * 3 + j, true);
        if (!im) continue;
        const x = ((i * boucle) / n - X * f) % boucle;
        const lx = W * l * (0.8 + 0.4 * alea(i + j * 9));
        poserCumulus(ctx, im, (x < 0 ? x + boucle : x) - lx * 0.5, H * yy + descente * H * 0.35 * (j + 1) + 18 * alea(i * 7 + j),
                     lx, (i + j) % 2 === 1);
      }
      ctx.restore();
    });

    // l'avion, et ses trainees
    // en fin de voyage il s'eloigne vers la ville, au-dessus du monument
    const loin_ = fenetre(t, duree - 3.0, duree - 0.4);
    const xa = W * (0.42 + 0.22 * loin_), ya = H * (0.44 - 0.12 * loin_) + Math.sin(t * 1.6) * 3;
    const k = Math.min(W / 360, H / 540) * (1 - 0.45 * loin_);
    const tr = ctx.createLinearGradient(xa - W * 0.6, 0, xa - 20 * k, 0);
    tr.addColorStop(0, 'rgba(255,255,255,0)'); tr.addColorStop(1, 'rgba(255,255,255,0.75)');
    ctx.strokeStyle = tr; ctx.lineWidth = 2.4 * k;
    ctx.beginPath(); ctx.moveTo(xa - W * 0.6, ya + 20 * k); ctx.lineTo(xa - 14 * k, ya + 20 * k); ctx.stroke();
    // le vrai avion (Tripo, de profil), un peu cabre en vol, qui pique a la descente
    // (le jet prive n'est pas encore modelise : l'avion de ligne le remplace)
    const nomVrai: 'avion' | 'jet' = spriteVehicule(nomAvion, 'profil') ? nomAvion : 'avion';
    const sp = spriteVehicule(nomVrai, 'profil');
    if (sp) {
      const larg = Math.min(W * 0.66, H * 0.52) * (1 - 0.45 * loin_) * (nomVrai === 'jet' ? 0.8 : 1);
      const hp = larg * sp.h / sp.w;
      poserVehicule(ctx, nomVrai, xa, ya + hp * 0.5, hp, -0.035 + 0.08 * descente + Math.sin(t * 1.1) * 0.01);
    } else {
      avion(ctx, xa, ya, k, 0.04 * descente, teinte);
    }
    traitsDeVitesse(ctx, W, H, ya - H * 0.15, ya + H * 0.15, t, 0.55 * (1 - descente));

    hudVoyage(ctx, W, H, t, duree, rang, depart, arrivee, km * p(t), o.mode);
  };
}

/* ===========================================================================
   LA MONTEE VERS L'APOTHEOSE (etape 6)
   =========================================================================== */

/** Une galaxie spirale : deux bras de poussiere d'etoiles, des nuees qui les
 *  font luire, autour d'un coeur dore. */
function galaxie(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, t: number, a: number,
                 points: [number, number, number, number][]) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rot = t * 0.08;
  const ou = (r: number, th: number): Pt => {
    const ang = th + rot + r * 3.4;
    return [cx + Math.cos(ang) * r * R, cy + Math.sin(ang) * r * R * 0.42];
  };
  // les nuees des bras
  for (let i = 0; i < 46; i++) {
    const r = 0.12 + 0.8 * (i / 46), th = (i % 2 ? Math.PI : 0) + (alea(i * 17) - 0.5) * 0.3;
    const [x, y] = ou(r, th), rr = R * (0.1 + 0.08 * alea(i * 19));
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    const c = i % 3 ? '150,140,255' : '255,140,210';
    g.addColorStop(0, `rgba(${c},${0.13 * a * (1.1 - r)})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  const coeur = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.45);
  coeur.addColorStop(0, `rgba(255,240,214,${0.95 * a})`); coeur.addColorStop(0.25, `rgba(255,190,150,${0.4 * a})`);
  coeur.addColorStop(1, 'rgba(140,90,230,0)');
  ctx.fillStyle = coeur; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  for (const [r, th, s, c] of points) {
    const [x, y] = ou(r, th);
    ctx.fillStyle = c > 0.75 ? `rgba(255,190,230,${0.5 * a})` : c > 0.4 ? `rgba(180,200,255,${0.55 * a})` : `rgba(255,250,240,${0.65 * a})`;
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

function pointsDeGalaxie(n: number): [number, number, number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const r = Math.min(1, Math.pow(alea(i * 3 + 1), 0.8) + (alea(i * 13) - 0.5) * 0.06);
    const bras = i % 2 ? Math.PI : 0;
    // l'ecart au bras : large au coeur, encore present au bord
    const ecart = (alea(i * 5) + alea(i * 5 + 2) - 1) * (0.55 + 0.5 * (1 - r));
    return [r, bras + ecart, 0.6 + alea(i * 7) * 1.4, alea(i * 11)] as [number, number, number, number];
  });
}

function sphere(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, clair: Rgb, ombre: Rgb) {
  const g = ctx.createRadialGradient(x + r * 0.4, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, css(clair)); g.addColorStop(0.7, css(mel(clair, ombre, 0.6))); g.addColorStop(1, css(ombre));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

// La distance a la Terre au fil des secondes (km), en echelle logarithmique
// entre les jalons : 100 km (Karman), la Lune, Saturne, Orion, Sagittarius A*.
const AL = 9.4607e12;
const JALONS_ESPACE: [number, number][] = [[0, 100], [1.8, 2e4], [2.8, 384400], [4.6, 1.43e9], [6.6, 1344 * AL], [8.8, 26000 * AL], [99, 26000 * AL]];
function distanceEspace(t: number) {
  for (let i = 1; i < JALONS_ESPACE.length; i++) {
    const [t1, d1] = JALONS_ESPACE[i], [t0, d0] = JALONS_ESPACE[i - 1];
    if (t <= t1) return Math.exp(Math.log(d0) + (Math.log(d1) - Math.log(d0)) * lisse((t - t0) / (t1 - t0)));
  }
  return 26000 * AL;
}
function ecrireDistance(km: number) {
  if (km < 1e9) return `${nombre(km)} ${mot('u_km')}`;
  if (km < 1e13) return `${nombre(km / 1e9, 1)} ${mot('u_md')}`;
  return `${nombre(km / AL)} ${mot('u_al')}`;
}

export function CinematiqueApotheose({ onFin }: { onFin: () => void }) {
  return <Cinematique nom="apotheose" duree={12.5} onFin={onFin} creer={peintreApotheose} />;
}

function peintreApotheose(): Peintre {
  const duree = 12.5;
  chargerLesCumulus();
  monumentDuLieu('apotheose');
  const etoiles = [0, 1, 2].map(c => Array.from({ length: 70 }, (_, i) =>
    [alea(i * 3 + c * 1000), alea(i * 5 + c * 1000 + 1), 0.6 + c * 0.6 + alea(i) * 0.6] as [number, number, number]));
  const pts = pointsDeGalaxie(2600);
  // la course vers le haut : lente au depart, vive entre les astres
  const vit = (t: number) => 0.06 + 0.5 * fenetre(t, 1.2, 2.2) * (1 - fenetre(t, 9.6, 11));
  const N = 500, cum: number[] = [0];
  for (let i = 0; i < N; i++) cum.push(cum[i] + vit((i / N) * duree) * (duree / N));
  const course = (t: number) => cum[Math.max(0, Math.min(N, Math.round((t / duree) * N)))];

  return (ctx, W, H, t) => {
    const m = Math.min(W, H);
    // le noir de l'espace ; au depart, encore l'or du ciel de l'Olympe en bas
    ctx.fillStyle = '#05030C'; ctx.fillRect(0, 0, W, H);
    const olympe = 1 - fenetre(t, 0.6, 2.0);
    if (olympe > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(26,30,92,0)'); g.addColorStop(0.6, `rgba(120,96,170,${0.6 * olympe})`);
      g.addColorStop(1, `rgba(255,202,136,${olympe})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // les etoiles, en trois plans ; elles filent quand on accelere
    const c = course(t), v = vit(t);
    // (des points, a peine etires : des traits longs faisaient une pluie)
    etoiles.forEach((plan, j) => {
      const f = 0.4 + j * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${0.45 + j * 0.2})`;
      for (const [x, y, s] of plan) {
        const yy = ((y + c * f) % 1) * H;
        const l = Math.max(s, v * f * H * 0.01);
        ctx.fillRect(x * W, yy - l, s * 0.9, l);
      }
    });

    // la cite celeste qui s'eloigne vers le bas, dans sa mer de nuages
    if (olympe > 0) {
      const cite = citeCeleste();
      const dy = fenetre(t, 0.2, 2.0) * H * 0.9;
      if (cite) {
        const k = Math.min(W * 1.05, 700) / CITE_W;
        ctx.globalAlpha = olympe;
        ctx.drawImage(cite, W / 2 - CITE_AX * k, H * 0.95 - CITE_AY * k + dy, cite.width * k, cite.height * k);
        ctx.globalAlpha = 1;
      }
      for (let i = 0; i < 6; i++) {
        const im = cumulus(i);
        if (im) poserCumulus(ctx, im, (i - 0.5) * W * 0.22, H * 1.02 + dy, W * 0.42, i % 2 === 1);
      }
    }

    // la Lune, a gauche
    const passe = (a: number, b: number) => (t - a) / (b - a);   // 0 en haut, 1 en bas
    const uL = passe(1.6, 3.8);
    if (uL > 0 && uL < 1) {
      const r = m * 0.22, x = W * 0.22, y = -r + uL * (H + 2 * r);
      sphere(ctx, x, y, r, [236, 234, 228], [70, 70, 78]);
      for (let i = 0; i < 9; i++) {
        const a = alea(i) * Math.PI * 2, d = Math.sqrt(alea(i + 20)) * r * 0.75, rc = r * (0.06 + 0.1 * alea(i + 40));
        ctx.fillStyle = 'rgba(90,90,100,0.28)';
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rc, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Saturne et ses anneaux, a droite
    const uS = passe(3.4, 5.6);
    if (uS > 0 && uS < 1) {
      const r = m * 0.13, x = W * 0.74, y = -r * 2 + uS * (H + 4 * r);
      const anneau = (devant: boolean) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35);
        for (let i = 0; i < 4; i++) {
          ctx.strokeStyle = `rgba(${226 - i * 12},${200 - i * 14},${150 - i * 10},${0.75 - i * 0.1})`;
          ctx.lineWidth = r * 0.12;
          ctx.beginPath(); ctx.ellipse(0, 0, r * (1.5 + i * 0.18), r * (0.42 + i * 0.05), 0, devant ? 0 : Math.PI, devant ? Math.PI : Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      };
      anneau(false);
      sphere(ctx, x, y, r, [244, 220, 170], [120, 90, 60]);
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
      for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(160,110,70,${0.14 + 0.06 * (i % 2)})`; ctx.fillRect(x - r, y - r + i * r * 0.36, r * 2, r * 0.12); }
      ctx.restore();
      anneau(true);
    }
    // la nebuleuse d'Orion : on la traverse
    const nb = fenetre(t, 5.0, 5.8) * (1 - fenetre(t, 7.4, 8.2));
    if (nb > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const teintes = ['236,96,170', '120,90,255', '70,190,230', '255,150,90'];
      for (let i = 0; i < 14; i++) {
        const x = alea(i * 3) * W, y = ((alea(i * 7) + c * 0.6) % 1.4 - 0.2) * H, r = m * (0.25 + 0.35 * alea(i * 9));
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(${teintes[i % 4]},${0.32 * nb})`); gr.addColorStop(1, `rgba(${teintes[i % 4]},0)`);
        ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.restore();
    }
    // Sagittarius A* : le disque d'accretion, lisse et plus chaud du cote qui
    // vient vers nous ; l'arriere du disque, devie par-dessus l'ombre en un
    // anneau ; l'ombre ; l'anneau de photons ; puis l'avant du disque
    const tn = fenetre(t, 7.6, 8.4) * (1 - fenetre(t, 9.6, 10.4));
    if (tn > 0) {
      const rb = m * (0.08 + 0.04 * fenetre(t, 7.6, 9.6)), x = W * 0.5, y = H * 0.32;
      ctx.save(); ctx.globalAlpha = tn;
      ctx.globalCompositeOperation = 'lighter';
      const lueur = ctx.createRadialGradient(x, y, rb, x, y, rb * 4);
      lueur.addColorStop(0, 'rgba(255,170,90,0.25)'); lueur.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = lueur; ctx.fillRect(x - rb * 4, y - rb * 4, rb * 8, rb * 8);
      const disque = (arriere: boolean) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.1);
        const n = 30;
        for (let i = 0; i < n; i++) {
          const f = i / (n - 1), chaud = 1 - f;
          const rx = rb * (1.3 + 2.2 * f), ry = rx * 0.2;
          const a = 0.05 + 0.2 * chaud * chaud;
          const g = ctx.createLinearGradient(-rx, 0, rx, 0);
          g.addColorStop(0, `rgba(255,${(196 + 59 * chaud) | 0},${(120 + 130 * chaud) | 0},${Math.min(1, a * 1.8)})`);
          g.addColorStop(1, `rgba(255,${(110 + 70 * chaud) | 0},${(50 + 50 * chaud) | 0},${a * 0.55})`);
          ctx.strokeStyle = g; ctx.lineWidth = rb * 0.13;
          ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, arriere ? Math.PI : 0, arriere ? Math.PI * 2 : Math.PI); ctx.stroke();
        }
        ctx.restore();
      };
      disque(true);
      for (let i = 0; i < 14; i++) {
        const f = i / 13, r = rb * (1.05 + 0.42 * f);
        const g = ctx.createLinearGradient(0, y - r, 0, y + r);
        g.addColorStop(0, `rgba(255,224,170,${0.3 * (1 - f)})`);
        g.addColorStop(0.55, `rgba(255,170,90,${0.1 * (1 - f)})`);
        g.addColorStop(1, `rgba(255,150,80,${0.05 * (1 - f)})`);
        ctx.strokeStyle = g; ctx.lineWidth = rb * 0.06;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(x, y, rb, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,240,214,0.85)'; ctx.lineWidth = Math.max(1, rb * 0.025);
      ctx.beginPath(); ctx.arc(x, y, rb * 1.02, 0, Math.PI * 2); ctx.stroke();
      disque(false);
      ctx.restore();
    }
    // l'arrivee : la galaxie, et la couronne de cristal qui se leve
    const fin = fenetre(t, 9.4, 11.0);
    galaxie(ctx, W / 2, H * 0.34, m * 0.62, t, fin, pts);
    const M = monumentDuLieu('apotheose');
    if (M && fin > 0) {
      let kM = (H * (W > H ? 0.5 : 0.36)) / M.ay;
      if (M.w * kM > W * 0.92) kM = (W * 0.92) / M.w;
      ctx.globalAlpha = fin;
      ctx.drawImage(M.im, W / 2 - M.ax * kM, H * 0.86 + (1 - fin) * H * 0.3 - M.ay * kM, M.w * kM, M.h * kM);
      ctx.globalAlpha = 1;
    }

    // la fusee : elle contourne le trou noir, puis file vers la couronne
    const ecart = Math.sin(fenetre(t, 7.8, 9.8) * Math.PI) * W * 0.22;
    const part = fenetre(t, 9.8, 11.6);
    const xF = W / 2 + ecart, yF = H * 0.66 - part * H * 0.32;
    const s = Math.min(2.2, W / 220) * (1 - 0.88 * part);
    if (part < 0.98) {
      ctx.save(); ctx.globalAlpha = 1 - part * part;
      ctx.translate(xF, yF); ctx.rotate(Math.cos(fenetre(t, 7.8, 9.8) * Math.PI) * 0.3 * (ecart ? 1 : 0));
      fusee(ctx, 0, 0, s, 1, t);
      ctx.restore();
    }

    // le HUD : la distance a la Terre, l'astre traverse, le titre
    ctx.textAlign = 'left';
    ctx.font = `700 ${Math.round(Math.max(12, H * 0.018))}px ui-monospace, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText(ecrireDistance(distanceEspace(t)), 18, 34);
    ctx.textAlign = 'center';
    for (const [a, b, nom] of [[1.9, 3.6, 'lune'], [3.8, 5.5, 'saturne'], [5.6, 7.4, 'orion'], [7.8, 9.6, 'sgr']] as [number, number, string][]) {
      const v2 = fenetre(t, a, a + 0.4) * (1 - fenetre(t, b - 0.4, b));
      if (v2 > 0) titre(ctx, mot(nom), W / 2, H * 0.16, Math.max(14, H * 0.026), W * 0.9, `rgba(255,255,255,${0.9 * v2})`, 800);
    }
    const ti = fenetre(t, 10.0, 10.6);
    if (ti > 0) {
      ctx.save(); ctx.shadowColor = 'rgba(155,107,255,0.8)'; ctx.shadowBlur = 18;
      titre(ctx, mot('apotheose_t'), W / 2, H * 0.14, Math.min(W * 0.12, H * 0.06), W * 0.9, `rgba(255,226,160,${ti})`);
      ctx.restore();
    }
  };
}

/* ===========================================================================
   LE SACRE (apres la sixieme etape gagnee)
   =========================================================================== */

export function CinematiqueSacre({ onFin }: { onFin: () => void }) {
  return <Cinematique nom="sacre" duree={13} onFin={onFin} creer={peintreSacre} />;
}

function peintreSacre(): Peintre {
  const boss = ETAPES.map((_, r) => ({ nom: lieuDeLEtape(r).boss, rang: r }))
    .map(b => {
      const url = PORTRAITS[b.nom];
      const im = url ? new Image() : null;
      if (im) im.src = url;
      return { ...b, im };
    });
  const nom = (getSavedName() || mot('toi')).toUpperCase();
  const n = Math.max(1, memoire().accomplies);
  const pts = pointsDeGalaxie(900);
  const confettis = Array.from({ length: 150 }, (_, i) => ({
    x: alea(i * 3), v: 0.12 + 0.2 * alea(i * 5), r: alea(i * 7) * 6, c: ['#FFD86B', '#FFFFFF', '#B58CFF', '#FFB84A'][i % 4],
    t0: 7 + alea(i * 9) * 2.5,
  }));
  const etoiles = Array.from({ length: 160 }, (_, i) => [alea(i), alea(i + 500), 0.6 + alea(i + 900) * 1.4]);

  return (ctx, W, H, t) => {
    const m = Math.min(W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.8);
    g.addColorStop(0, '#2A1650'); g.addColorStop(1, '#05030C');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const [x, y, s] of etoiles) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(t * 1.7 + x * 60)})`;
      ctx.fillRect(x * W, y * H, s, s);
    }
    const C: Pt = [W / 2, H * 0.42];
    galaxie(ctx, C[0], C[1], m * 0.7, t, 0.55, pts);

    // la constellation des boss battus, allumes un a un
    const R = Math.min(W * 0.36, H * 0.29);
    const tourne = fenetre(t, 7, 13) * 0.6;
    const pos = boss.map((_, i): Pt => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / boss.length + tourne;
      return [C[0] + Math.cos(a) * R, C[1] + Math.sin(a) * R];
    });
    const quand = (i: number) => 0.7 + i * 0.75;
    ctx.lineCap = 'round';
    for (let i = 1; i <= boss.length; i++) {
      if (i === boss.length && t < quand(boss.length - 1) + 0.6) break;
      const a = fenetre(t, quand(i - 1) + 0.2, quand(Math.min(i, boss.length - 1)) + 0.2);
      if (a <= 0) continue;
      const A = pos[i - 1], B = pos[i % boss.length];
      ctx.strokeStyle = 'rgba(255,214,120,0.55)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(A[0] + (B[0] - A[0]) * a, A[1] + (B[1] - A[1]) * a); ctx.stroke();
    }
    // les rayons qui convergent vers le centre
    const conv = fenetre(t, 5.6, 6.8);
    if (conv > 0) {
      ctx.strokeStyle = `rgba(255,226,150,${0.5 * (1 - fenetre(t, 7, 8))})`; ctx.lineWidth = 1.4;
      for (const P of pos) {
        ctx.beginPath(); ctx.moveTo(P[0], P[1]); ctx.lineTo(P[0] + (C[0] - P[0]) * conv, P[1] + (C[1] - P[1]) * conv); ctx.stroke();
      }
    }
    const pr = m * 0.085;
    boss.forEach((b, i) => {
      const a = fenetre(t, quand(i), quand(i) + 0.45);
      if (a <= 0) return;
      const [x, y] = pos[i];
      // l'eclat qui l'annonce
      const e = 1 - Math.abs((t - quand(i)) / 0.35);
      if (e > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gl = ctx.createRadialGradient(x, y, 0, x, y, pr * 2.4);
        gl.addColorStop(0, `rgba(255,240,200,${e})`); gl.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = gl; ctx.fillRect(x - pr * 2.4, y - pr * 2.4, pr * 4.8, pr * 4.8);
        ctx.restore();
      }
      const r = pr * (0.7 + 0.3 * a);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = '#100A22'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (b.im && b.im.complete && b.im.naturalWidth) {
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
        const w = r * 2, h = (w * b.im.naturalHeight) / b.im.naturalWidth;
        ctx.drawImage(b.im, x - r, y - r, w, h);
        ctx.restore();
      }
      ctx.strokeStyle = TEINTES[b.rang]; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = `800 ${Math.round(Math.max(10, m * 0.03))}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(b.nom.toUpperCase(), x, y + r + Math.max(13, m * 0.04));
      ctx.restore();
    });
    const sous = fenetre(t, 5.2, 5.8) * (1 - fenetre(t, 6.8, 7.2));
    if (sous > 0) {
      ctx.textAlign = 'center';
      ctx.font = `600 italic ${Math.round(Math.max(13, m * 0.04))}px system-ui, sans-serif`;
      ctx.fillStyle = `rgba(255,255,255,${0.85 * sous})`;
      ctx.fillText(mot('battus'), W / 2, H * 0.915);
    }

    // l'eclair, puis le nom en or au milieu
    const eclair = fenetre(t, 6.7, 7.0) * (1 - fenetre(t, 7.0, 7.8));
    const nomA = fenetre(t, 7.0, 7.6);
    if (nomA > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + t * 0.15;
        const gr = ctx.createLinearGradient(C[0], C[1], C[0] + Math.cos(a) * m * 0.6, C[1] + Math.sin(a) * m * 0.6);
        gr.addColorStop(0, `rgba(255,214,120,${0.22 * nomA})`); gr.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(C[0], C[1]);
        ctx.lineTo(C[0] + Math.cos(a - 0.06) * m, C[1] + Math.sin(a - 0.06) * m);
        ctx.lineTo(C[0] + Math.cos(a + 0.06) * m, C[1] + Math.sin(a + 0.06) * m);
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(255,190,80,0.9)'; ctx.shadowBlur = 24;
      ctx.font = `800 ${Math.round(Math.max(11, m * 0.035))}px system-ui, sans-serif`;
      ctx.fillStyle = `rgba(255,226,160,${nomA})`;
      ctx.fillText(mot('legende').split('').join(' '), C[0], C[1] - m * 0.1);
      const or = ctx.createLinearGradient(0, C[1] - m * 0.08, 0, C[1] + m * 0.04);
      or.addColorStop(0, '#FFF3C4'); or.addColorStop(0.5, '#F2C14E'); or.addColorStop(1, '#B9832A');
      ctx.globalAlpha = nomA;
      titre(ctx, nom, C[0], C[1] + m * 0.04, m * 0.14 * (0.9 + 0.1 * nomA), W * 0.6, or);
      ctx.shadowBlur = 0;
      ctx.font = `800 ${Math.round(Math.max(12, m * 0.045))}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(`${mot('accomplie')} ${mot('fois', { n })}`, C[0], H * 0.915);
      ctx.restore();
    }
    if (eclair > 0) { ctx.fillStyle = `rgba(255,248,230,${0.85 * eclair})`; ctx.fillRect(0, 0, W, H); }

    // les confettis d'or, a la gloire
    for (const c of confettis) {
      const u = t - c.t0;
      if (u < 0) continue;
      const y = -20 + u * c.v * H * 2.2, x = c.x * W + Math.sin(u * 3 + c.r) * 14;
      if (y > H + 20) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(u * 4 + c.r);
      ctx.fillStyle = c.c; ctx.fillRect(-4, -2, 8, 4 * Math.abs(Math.cos(u * 6 + c.r)) + 1);
      ctx.restore();
    }
  };
}
