// LES MONUMENTS DES LIEUX — un par etape, au loin, sur le ciel.
//
// La Legende court ses etapes dans des stades du jeu (stades.ts) : la piste,
// la tribune et le public sont ceux de leur theme. Ce qui dit OU l'on court,
// c'est le monument qui se leve derriere la tribune — le Pavillon d'or a
// Kyoto, Big Ben a Londres. Il se pose comme la tour du Champ-de-Mars
// (decor-champ-de-mars.js) : a des centaines de metres, il ne defile presque
// pas quand la camera suit le coureur. Il tient donc une position d'ECRAN,
// a peine derivee par la course, plante sur l'horizon du stade et trace sur
// le ciel AVANT le sol — la tribune lui passe devant le pied.
//
// Chaque monument est un modele Tripo (photo libre de Wikimedia Commons,
// voir assets-sources/legende/<lieu>/references-libres/CREDITS.md) rendu dans
// Blender a l'angle du jeu (tools/blender/decors/legende_monuments.py), qui
// ecrit l'image et, dans le manifeste, le pixel ou tombe son pied (ax, ay).
// Paris reprend la tour du Champ-de-Mars, deja servie avec le jeu.
//
// Le moteur l'appelle par G.lointainEvenement (sprinter-app.js), pose par
// lancerLEtape et retire au rangement de la Legende.

import manifeste from '@/assets/legende/decors/manifeste.json';
import londres from '@/assets/legende/decors/londres.webp?url';
import izmir from '@/assets/legende/decors/izmir.webp?url';
import kingston from '@/assets/legende/decors/kingston.webp?url';
import abuja from '@/assets/legende/decors/abuja.webp?url';
import newyork from '@/assets/legende/decors/newyork.webp?url';
import menole from '@/assets/legende/decors/menole.webp?url';
import kyoto from '@/assets/legende/decors/kyoto.webp?url';
import barcelone from '@/assets/legende/decors/barcelone.webp?url';
import casablanca from '@/assets/legende/decors/casablanca.webp?url';
import apotheose from '@/assets/legende/decors/apotheose.webp?url';
// l'arene-asteroide de l'apotheose : image FLUX.1-schnell, modele TRELLIS.2
// (voir areneFlottante)
import arene from '@/assets/legende/decors/arene.webp?url';
// les pieces de premier plan, modelisees dans Blender (legende_pieces.py)
import torii from '@/assets/legende/decors/torii.webp?url';
import cabine from '@/assets/legende/decors/cabine.webp?url';
import morris from '@/assets/legende/decors/morris.webp?url';
import { citeCeleste, W as CITE_W, H as CITE_H, AX as CITE_AX, AY as CITE_AY } from './cite-celeste';
import { cumulus, chargerLesCumulus, poserCumulus } from './nuages';
// les dieux de l'Olympe en pied (rendus de leur maillage, vedette_tripo.py)
import hermesPied from '@/assets/legende/boss/hermes-pied.webp?url';
import wukongPied from '@/assets/legende/boss/wukong-pied.webp?url';
import anansiPied from '@/assets/legende/boss/anansi-pied.webp?url';
import intiPied from '@/assets/legende/boss/inti-pied.webp?url';

type Piece = { f: string; w: number; h: number; ax: number; ay: number };
type Pose = {
  /** L'abscisse visee, en part de la largeur d'ecran (portrait, paysage). */
  x: [number, number];
  /** La part du ciel disponible que le monument occupe en hauteur. */
  part: number;
  /** Sa largeur a l'ecran ne depasse pas cette part de l'image. */
  large: number;
};

// Les images, par lieu. Une cle absente : le stade reste sans monument.
const IMAGES: Record<string, string> = {
  menole, kyoto, kingston, izmir, barcelone, casablanca, abuja,
  newyork, londres, apotheose, arene,
  torii, cabine, morris,
};

// A DROITE. En portrait, le ciel n'entre dans le cadre qu'une fois la course
// lancee (la camera recule), et seulement en haut a droite, au-dessus de la
// tribune : la ligne d'horizon y descend, et c'est la que le monument a le
// plus de ciel pour se lever (mesure a Londres le 06/10 : pose a 60 % de la
// largeur, Big Ben tenait en soixante-dix pixels).
const POSE_PAR_DEFAUT: Pose = { x: [0.80, 0.70], part: 1, large: 0.40 };
const POSES: Record<string, Partial<Pose>> = {
  // un inselberg et un temple sont plus larges que hauts
  abuja: { part: 0.85, large: 0.75 },
  karman: { part: 1, large: 0.62 },
  barcelone: { large: 0.5 },
  apotheose: { large: 0.5 },
};

// Les quatre lieux de l'Olympe (un par maitre tire au sort) partagent le
// meme temple.
const MONUMENT_DU_LIEU = (cle: string) => (cle.startsWith('karman') ? 'karman' : cle);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

type Image_ = { im: CanvasImageSource; p: Piece };

function piece(cle: string): Image_ | null {
  // l'Olympe : la cite celeste, peinte au canvas (cite-celeste.ts)
  if (cle === 'karman') {
    const im = citeCeleste();
    return im ? { im, p: { f: '', w: CITE_W, h: CITE_H, ax: CITE_AX, ay: CITE_AY } } : null;
  }
  const imgs = (globalThis as any).SprinterImages;
  if (!imgs) return null;
  if (cle === 'paris') {
    // la Tour Eiffel du Champ-de-Mars, servie avec le jeu (public/decors)
    const p = (globalThis as any).ChampDeMarsManifeste?.pieces?.tour as Piece | undefined;
    const im = p && imgs.image(BASE + '/decors/champdemars/' + p.f);
    return im ? { im, p } : null;
  }
  const url = IMAGES[cle];
  const p = (manifeste as any)?.pieces?.[cle] as Piece | undefined;
  if (!url || !p) return null;
  const im = imgs.image(url);
  return im ? { im, p } : null;
}

/** Le monument du lieu (ou la piece qui en tient lieu), pour les
 *  cinematiques ; null tant qu'il n'est pas charge. */
export function monumentDuLieu(lieu: string): { im: CanvasImageSource; w: number; h: number; ax: number; ay: number } | null {
  const R = piece(MONUMENT_DU_LIEU(lieu));
  return R ? { im: R.im, w: R.p.w, h: R.p.h, ax: R.p.ax, ay: R.p.ay } : null;
}

/** Le point de l'horizon (rayon rH) a l'abscisse d'ecran x, le plus haut. */
function horizonEn(api: any, sm: any[], rH: number, x: number): [number, number] | null {
  let best: [number, number] | null = null;
  for (let i = 0; i + 1 < sm.length; i++) {
    const a = api.ground(...api.ptOf(sm[i], rH)), b = api.ground(...api.ptOf(sm[i + 1], rH));
    if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
    const y = a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    if (!best || y < best[1]) best = [x, y];
  }
  return best;
}

/** Les images du lieu, demandees avant le pistolet (le decompte les attend). */
export function preparerLeLointain(cle: string) {
  piece(MONUMENT_DU_LIEU(cle));
  const P = PREMIER_PLAN[MONUMENT_DU_LIEU(cle)];
  if (P) piece(P.img);
  for (const d of dieuxSpectateurs(cle)) image(d.url);
  if (MONUMENT_DU_LIEU(cle) === 'karman') chargerLesCumulus();
  if (MONUMENT_DU_LIEU(cle) === 'apotheose') piece('arene');
}

// -----------------------------------------------------------------------
// LES DIEUX DE L'OLYMPE, EN COLOSSES.
// -----------------------------------------------------------------------
//
// A la ligne de Karman, le maitre tire au sort court ; les trois autres
// regardent. Ils se dressent au loin, de part et d'autre du temple, plus
// grands que lui et voiles par la distance — les dieux en tribune du plan,
// sans un credit Tripo : ce sont les rendus en pied de leurs corps
// (vedette_tripo.py), deja faits pour les boss. Le pied de chacun est
// mesure sur sa couche alpha (900 x 1200).
const DIEUX: Record<string, { url: string; p: Piece }> = {
  karman: { url: hermesPied, p: { f: '', w: 900, h: 1200, ax: 453, ay: 1168 } },
  'karman-wukong': { url: wukongPied, p: { f: '', w: 900, h: 1200, ax: 399, ay: 1168 } },
  'karman-anansi': { url: anansiPied, p: { f: '', w: 900, h: 1200, ax: 456, ay: 1171 } },
  'karman-inti': { url: intiPied, p: { f: '', w: 900, h: 1200, ax: 405, ay: 1172 } },
};
// a gauche du temple, a sa droite, et plus loin a gauche
const POSES_DES_DIEUX: Pose[] = [
  { x: [0.60, 0.56], part: 1, large: 0.34 },
  { x: [0.99, 0.86], part: 1, large: 0.34 },
  { x: [0.46, 0.44], part: 0.9, large: 0.30 },
];
const VOILE_DES_DIEUX = 0.82;

/** Les dieux qui ne courent pas a l'etape `lieu` (vide hors de l'Olympe). */
export function dieuxSpectateurs(lieu: string): { url: string; p: Piece }[] {
  if (!lieu.startsWith('karman')) return [];
  return Object.keys(DIEUX).filter(k => k !== lieu).map(k => DIEUX[k]);
}

function image(url: string): HTMLImageElement | null {
  const imgs = (globalThis as any).SprinterImages;
  return imgs ? imgs.image(url) : null;
}

/** Pose une piece lointaine sur l'horizon, a l'abscisse et la taille de `pose`. */
function poserAuLoin(ctx: CanvasRenderingContext2D, api: any, sm: any[], rOut: number, horizon: number,
                     R: Image_, pose: Pose) {
  const { G } = api;
  // La derive d'un objet lointain : un metre couru le deplace d'un pixel
  // et demi, quand la piste en defile une vingtaine.
  const cible = G.VW * (G.portrait ? pose.x[0] : pose.x[1]) - (G.camX - 50) * 1.4 * api.ui();
  const pied = horizonEn(api, sm, rOut + horizon + 4.0, cible);
  if (!pied) return;
  // Il tient le ciel qui reste au-dessus de l'horizon sans sortir par le
  // haut : le haut du cadre appartient au bandeau de course.
  const haut = G.VH * (G.portrait ? 0.13 : 0.07);
  let h = Math.min(G.VH * 0.8, pied[1] - haut) * pose.part;
  if (h < 40) return;
  let k = h / R.p.ay;
  // un monument large (temple, basilique) se borne en largeur
  const wMax = G.VW * pose.large;
  if (R.p.w * k > wMax) { k = wMax / R.p.w; h = R.p.ay * k; }
  ctx.drawImage(R.im, pied[0] - R.p.ax * k, pied[1] - R.p.ay * k, R.p.w * k, R.p.h * k);
}

/**
 * L'ARENE-ASTEROIDE de l'apotheose (G2 du plan) : un stade dore creuse dans un
 * rocher qui flotte, plus loin que la couronne de cristal et plus haut que
 * l'horizon. L'image vient de FLUX.1-schnell (Apache 2.0), le modele de
 * TRELLIS.2 (MIT), le rendu de legende_monuments.py (elev 28, pour voir dans
 * l'arene). Il derive moins que la couronne (il est plus loin), se balance
 * doucement, et une lueur violette le porte.
 */
function areneFlottante(ctx: CanvasRenderingContext2D, api: any, sm: any[], rOut: number, horizon: number) {
  const R = piece('arene');
  if (!R) return;
  const { G } = api;
  const u = api.ui(), t = performance.now() / 1000;
  const x = G.VW * (G.portrait ? 0.56 : 0.46) - (G.camX - 50) * 1.0 * u;
  const pied = horizonEn(api, sm, rOut + horizon + 4.0, x);
  if (!pied) return;
  const k = (G.VW * (G.portrait ? 0.34 : 0.2)) / R.p.w;
  let y = pied[1] - G.VH * (G.portrait ? 0.16 : 0.12) + Math.sin(t * 0.7) * 4 * u;
  // le haut du cadre appartient au bandeau de course
  const haut = G.VH * (G.portrait ? 0.13 : 0.07);
  if (y - R.p.ay * k < haut) y = haut + R.p.ay * k;
  const l = R.p.w * k * 0.62;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(x, y, 0, x, y, l);
  halo.addColorStop(0, 'rgba(176,96,255,0.4)'); halo.addColorStop(1, 'rgba(176,96,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - l, y - l, l * 2, l * 2);
  ctx.restore();
  ctx.drawImage(R.im, x - R.p.ax * k, y - R.p.ay * k, R.p.w * k, R.p.h * k);
}

/**
 * La fonction que le moteur appelle a chaque image pour le lieu `cle`, ou
 * null s'il n'a pas de monument.
 */
export function lointainDe(lieu: string) {
  const cle = MONUMENT_DU_LIEU(lieu);
  // Menole : son image EST le premier plan (la pirogue), pas un monument
  if (PREMIER_PLAN[cle]?.img === cle) return null;
  if (cle !== 'paris' && cle !== 'karman' && !IMAGES[cle]) return null;
  const pose: Pose = { ...POSE_PAR_DEFAUT, ...(POSES[cle] || {}) };
  const dieux = dieuxSpectateurs(lieu);
  return function lointain(ctx: CanvasRenderingContext2D, api: any, _th: any, sm: any[], rOut: number, horizon: number) {
    // les colosses d'abord : ils sont plus loin que le temple
    if (dieux.length) {
      ctx.save();
      ctx.globalAlpha *= VOILE_DES_DIEUX;
      dieux.forEach((d, i) => {
        const im = image(d.url);
        if (im) poserAuLoin(ctx, api, sm, rOut, horizon, { im, p: d.p }, POSES_DES_DIEUX[i % POSES_DES_DIEUX.length]);
      });
      ctx.restore();
    }
    if (cle === 'karman') cielCeleste(ctx, api, pose);
    if (cle === 'apotheose') areneFlottante(ctx, api, sm, rOut, horizon);
    const R = piece(cle);
    if (R) poserAuLoin(ctx, api, sm, rOut, horizon, R, pose);
  };
}

/**
 * Le ciel de l'Olympe : un halo d'or derriere la cite, des cumulus qui
 * derivent, des rais de lumiere qui tombent du haut du cadre en eventail, et
 * une poussiere d'or qui monte lentement.
 * Peints avant la tribune, qui les coupe comme elle coupe la cite.
 */
function cielCeleste(ctx: CanvasRenderingContext2D, api: any, pose: Pose) {
  const { G } = api;
  const u = api.ui(), t = performance.now() / 1000;
  const x = G.VW * (G.portrait ? pose.x[0] : pose.x[1]) - (G.camX - 50) * 1.4 * u;
  const y = -G.VH * 0.08;
  const L = Math.hypot(G.VW, G.VH);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(x, G.VH * 0.12, 0, x, G.VH * 0.12, G.VW * 0.45);
  halo.addColorStop(0, 'rgba(255,214,140,0.28)'); halo.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, G.VW, G.VH);
  // les cumulus du ciel, qui derivent lentement (ceux du moteur, des ronds
  // blancs, sont eteints : `clouds: false`, stades.ts)
  ctx.globalCompositeOperation = 'source-over';
  const boucle = G.VW * 1.5;
  for (let i = 0; i < 6; i++) {
    const im = cumulus(i * 5 + 2);
    if (!im) continue;
    const l = G.VW * (G.portrait ? 0.3 : 0.16) * (0.7 + 0.15 * (i % 3));
    const px = ((i / 6) * boucle + t * 3 * u - (G.camX - 50) * 0.5 * u) % boucle;
    const py = G.VH * ((G.portrait ? 0.2 : 0.11) + 0.045 * ((i * 2) % 3));
    ctx.globalAlpha = 0.92;
    poserCumulus(ctx, im, (px < 0 ? px + boucle : px) - G.VW * 0.2, py, l, i % 2 === 1);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 11; i++) {
    const a = Math.PI / 2 + (i - 5) * 0.17 + 0.05 * Math.sin(t * 0.25 + i * 1.7);
    const w = 0.018 + 0.014 * ((i * 5) % 3);
    const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * L * 0.7, y + Math.sin(a) * L * 0.7);
    g.addColorStop(0, `rgba(255,232,180,${0.16 + 0.06 * Math.sin(t * 0.6 + i)})`);
    g.addColorStop(1, 'rgba(255,232,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a - w) * L, y + Math.sin(a - w) * L);
    ctx.lineTo(x + Math.cos(a + w) * L, y + Math.sin(a + w) * L);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 46; i++) {
    const g = Math.imul(i + 17, 2654435761) >>> 0;
    const v = 6 + (g % 14);
    const px = ((g >>> 4) % 1000) / 1000 * G.VW + 10 * Math.sin(t * 0.5 + i);
    const py = G.VH * 0.75 - ((t * v * u + ((g >>> 12) % 1000) / 1000 * G.VH * 0.75) % (G.VH * 0.75));
    const a = 0.4 + 0.4 * Math.sin(t * 2 + i);
    const r = (1 + (g >>> 22) % 3 * 0.6) * u;
    ctx.fillStyle = `rgba(255,224,150,${a})`;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// -----------------------------------------------------------------------
// LE PREMIER PLAN : ce qui se pose sur la pelouse, pas sur l'horizon.
// -----------------------------------------------------------------------
//
// La pirogue de Menole n'est pas un monument : posee au loin, elle se
// cachait derriere la tribune comme le reste de la plage (constate le
// 07/10). Elle est donc tiree sur le sable de la pelouse, a sa taille
// reelle, en deca du couloir 1, la ou le moteur plante les palmiers — et
// tracee au meme moment qu'eux (G.premierPlanEvenement, sprinter-app.js).
// Elle n'est pas triee avec les coureurs : posee a cinq metres de la
// piste, aucun ne passe devant.
type PremierPlan = {
  /** L'image posee (cle du manifeste). */
  img: string;
  /** Largeur reelle de ce que montre l'image, en metres. */
  largeur: number;
  /** Distance au bord interieur de la piste, en metres. */
  recul: number;
  /** Une piece tous les `pas` echantillons du trace (douze metres en ligne droite). */
  pas: number;
};
const PREMIER_PLAN: Record<string, PremierPlan> = {
  // deux barques peintes, cote a cote. A douze metres et neuf de recul
  // elles mangeaient le bas de l'ecran (07/10) : huit metres, a cinq du bord.
  menole: { img: 'menole', largeur: 8, recul: 5, pas: 3 },
  // Kyoto : une allee de torii, comme a Fushimi Inari, tous les 24 m
  kyoto: { img: 'torii', largeur: 6.9, recul: 4, pas: 2 },
  // Londres : la cabine rouge ; Paris : la colonne Morris
  londres: { img: 'cabine', largeur: 1.04, recul: 3, pas: 4 },
  paris: { img: 'morris', largeur: 1.32, recul: 3, pas: 4 },
};

// -----------------------------------------------------------------------
// LES ENFANTS DE LA PLAGE (Menole).
// -----------------------------------------------------------------------
//
// Le quartier vient voir courir Kouassi. Pas de Tripo ni de rendu : ils sont
// peints a la main, comme les badauds du Champ-de-Mars
// (decor-champ-de-mars.js) — jambes, short, maillot, tete, bras —, a leur
// taille d'enfant (1,15 a 1,40 m), poses sur le sable a deux ou trois metres
// de la piste. Ils sautent sur place et agitent les bras, chacun a son
// rythme. Les maillots : orange, vert et blanc de la Cote d'Ivoire, et des
// couleurs vives.
const MAILLOTS: [number, number, number][] = [
  [244, 130, 34], [22, 150, 82], [244, 244, 240], [250, 204, 40], [44, 108, 186], [214, 58, 62],
];
const SHORTS: [number, number, number][] = [[30, 40, 80], [120, 96, 64], [40, 40, 46], [244, 244, 240]];
const PEAUX_ENFANTS: [number, number, number][] = [[74, 46, 32], [92, 58, 40], [110, 70, 48], [128, 84, 58]];
const rgbCss = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;

function enfants(ctx: CanvasRenderingContext2D, api: any, sm: any[], rIn: number) {
  const { G } = api;
  const m = api.scaleM();
  const t = performance.now() / 1000;
  const fin = api.samples(0.5);
  const gens: [number, number[], number][] = [];
  for (let i = 0; i < fin.length; i++) {
    const g = Math.imul(i * 7 + 13, 2654435761) >>> 0;
    if (g % 9 > 1) continue;                                 // des groupes clairsemes
    for (let k = 0; k < 1 + (g >>> 8) % 3; k++) {
      const gk = Math.imul(g + k * 977, 2246822519) >>> 0;
      const base = api.ptOf(fin[i], rIn - 2.2 - ((gk >>> 4) % 120) / 100);
      const p = api.solid(base[0], base[1], 0);
      if (p[0] < -40 || p[0] > G.VW + 40 || p[1] < -80 || p[1] > G.VH + 80) continue;
      gens.push([p[1], base, gk]);
    }
  }
  gens.sort((a, b) => a[0] - b[0]);
  for (const [, base, g] of gens) {
    const h = 1.15 + ((g >>> 10) % 26) / 100;
    const rythme = 5 + ((g >>> 14) % 40) / 10, phase = ((g >>> 18) % 628) / 100;
    const saut = Math.max(0, Math.sin(t * rythme + phase)) * 0.12;
    const P = (z: number) => api.solid(base[0], base[1], z + saut);
    const pied = P(0), hanche = P(h * 0.48), epaule = P(h * 0.8), tete = P(h * 0.9);
    const l = 0.11 * m;
    const peau = PEAUX_ENFANTS[(g >>> 3) % PEAUX_ENFANTS.length];
    // l'ombre sur le sable
    const sol = api.solid(base[0], base[1], 0);
    ctx.fillStyle = 'rgba(80,60,30,0.22)';
    ctx.beginPath(); ctx.ellipse(sol[0], sol[1], l * 1.6, l * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    // les jambes
    ctx.strokeStyle = rgbCss(peau); ctx.lineCap = 'round'; ctx.lineWidth = l * 0.7;
    ctx.beginPath();
    ctx.moveTo(hanche[0] - l * 0.45, hanche[1]); ctx.lineTo(pied[0] - l * 0.6, pied[1]);
    ctx.moveTo(hanche[0] + l * 0.45, hanche[1]); ctx.lineTo(pied[0] + l * 0.6, pied[1]);
    ctx.stroke();
    // le short, puis le maillot
    ctx.fillStyle = rgbCss(SHORTS[(g >>> 6) % SHORTS.length]);
    ctx.fillRect(hanche[0] - l, hanche[1] - (hanche[1] - epaule[1]) * 0.12, l * 2, (pied[1] - hanche[1]) * 0.42);
    ctx.fillStyle = rgbCss(MAILLOTS[(g >>> 22) % MAILLOTS.length]);
    ctx.fillRect(epaule[0] - l, epaule[1], l * 2, hanche[1] - epaule[1]);
    // les bras : en l'air quand il saute, le long du corps sinon
    const leve = saut > 0.03;
    const agite = Math.sin(t * rythme * 1.7 + phase) * 0.35;
    ctx.strokeStyle = rgbCss(peau); ctx.lineWidth = l * 0.55;
    ctx.beginPath();
    for (const cote of [-1, 1]) {
      const ex = epaule[0] + cote * l * 0.95, ey = epaule[1] + l * 0.2;
      const a = leve ? -Math.PI / 2 + cote * (0.45 + agite) : Math.PI / 2 - cote * 0.15;
      const long = h * 0.36 * m;
      ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a) * long * (leve ? 1 : 0.35) + cote * (leve ? 0 : l * 0.2), ey + Math.sin(a) * long);
    }
    ctx.stroke();
    // la tete
    ctx.fillStyle = rgbCss(peau);
    ctx.beginPath(); ctx.arc(tete[0], tete[1] - l * 0.3, l * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgb(24,18,16)';
    ctx.beginPath(); ctx.arc(tete[0], tete[1] - l * 0.55, l * 0.82, Math.PI, 0); ctx.fill();
  }
}

// -----------------------------------------------------------------------
// LA PISTE CELESTE (l'Olympe).
// -----------------------------------------------------------------------
//
// « Je veux que le decor et la piste soient celestes » (l'auteur, 07/10),
// puis « accentue le cote celeste, sur le decor et la piste » : la piste bleu
// nuit du theme (stades.ts) devient un morceau de ciel — des nebuleuses, des
// etoiles qui scintillent, quelques-unes en croix — et chaque ligne de couloir
// rayonne d'or. Elle flotte sur une mer de nuages : des cumulus eclaires par
// le haut, qui debordent un peu sur le bord du couloir 1 et sous les
// panneaux. Les bords rayonnent par le `neon` du theme (decor-cosmos.js).
const hache = (n: number) => Math.imul(n, 2654435761) >>> 0;

function pisteCeleste(ctx: CanvasRenderingContext2D, api: any, sm: any[], rIn: number) {
  const { G, C } = api;
  const T = G.track;
  const u = api.ui(), m = api.scaleM();
  const t = performance.now() / 1000;
  const rOut = T.curved ? T.edge(C.LANE_COUNT) : C.LANE_W * C.LANE_COUNT;
  const fin = api.samples(2);
  const dansLeCadre = (p: number[], marge: number) =>
    p[0] > -marge && p[0] < G.VW + marge && p[1] > -marge && p[1] < G.VH + marge;

  // 1. LE CIEL DANS LA PISTE, tenu dans ses bords
  ctx.save();
  ctx.beginPath();
  sm.forEach((s, i) => { const p = api.ground(...api.ptOf(s, rIn)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
  for (let i = sm.length - 1; i >= 0; i--) { const p = api.ground(...api.ptOf(sm[i], rOut)); ctx.lineTo(p[0], p[1]); }
  ctx.closePath();
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  // les nebuleuses, larges et pales
  const teintes = ['120,96,255', '236,120,214', '86,170,255', '255,190,110'];
  for (let i = 0; i < fin.length; i += 3) {
    const g = hache(i * 7 + 3);
    const p = api.ground(...api.ptOf(fin[i], rIn + ((g % 1000) / 1000) * (rOut - rIn)));
    const r = (3 + ((g >>> 10) % 300) / 100) * m;
    if (!dansLeCadre(p, r)) continue;
    const n = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
    const c = teintes[(g >>> 4) % teintes.length];
    n.addColorStop(0, `rgba(${c},0.16)`); n.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = n;
    ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
  }
  // les etoiles : des points qui scintillent, une sur sept en croix
  for (let i = 0; i < fin.length; i++) {
    for (let k = 0; k < 7; k++) {
      const g = hache(i * 13 + k * 104729 + 11);
      const p = api.ground(...api.ptOf(fin[i], rIn + 0.15 + ((g % 1000) / 1000) * (rOut - rIn - 0.3)));
      if (!dansLeCadre(p, 8)) continue;
      const a = 0.5 + 0.5 * Math.sin(t * (1.5 + ((g >>> 20) % 4) * 0.6) + (g >>> 8));
      if (k === 0 && (g >>> 12) % 2 === 0) {
        const l = (3 + a * 5) * u;
        const halo = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], l * 1.4);
        halo.addColorStop(0, `rgba(255,236,190,${0.5 * a})`); halo.addColorStop(1, 'rgba(255,236,190,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(p[0] - l * 1.4, p[1] - l * 1.4, l * 2.8, l * 2.8);
        ctx.fillStyle = `rgba(255,246,220,${0.55 + 0.45 * a})`;
        ctx.fillRect(p[0] - l, p[1] - 0.5 * u, l * 2, u);
        ctx.fillRect(p[0] - 0.5 * u, p[1] - l * 0.7, u, l * 1.4);
      } else {
        const s = (0.9 + a * 1.3 + ((g >>> 16) % 3) * 0.4) * u;
        ctx.fillStyle = (g >>> 6) % 3 ? `rgba(255,240,206,${0.3 + 0.6 * a})` : `rgba(200,214,255,${0.3 + 0.6 * a})`;
        ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
      }
    }
  }
  ctx.restore();

  // 2. LES LIGNES D'OR, qui rayonnent
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let l = 1; l < C.LANE_COUNT; l++) {
    const r = T.curved ? T.edge(l) : C.LANE_W * l;
    api.rail(ctx, sm, r, 'rgba(255,180,70,0.12)', 11 * u);
    api.rail(ctx, sm, r, 'rgba(255,196,96,0.2)', 4.5 * u);
  }
  ctx.restore();
  for (let l = 1; l < C.LANE_COUNT; l++) {
    api.rail(ctx, sm, T.curved ? T.edge(l) : C.LANE_W * l, 'rgb(255,204,104)', 1.7 * u);
  }

  // 3. LA MER DE NUAGES, du plus loin au plus pres. Un cumulus se dresse
  // vers le haut de l'image, donc par-dessus la piste qui est derriere lui :
  // sa tete ne depasse jamais le bord du couloir 1 de plus d'un liseré, ou il
  // cacherait les lignes et les blocs des couloirs 1 et 2.
  const nuages: [number, number, number, HTMLImageElement, boolean, number][] = [];
  const deborde = 5 * u;
  const poser = (s: any, r: number, largeur: number, g: number) => {
    const im = cumulus(g);
    if (!im) return;
    const p = api.ground(...api.ptOf(s, r));
    if (!dansLeCadre(p, largeur)) return;
    // trop haut : on l'ecrase d'abord (un banc bas, en bordure), puis on le
    // retrecit
    const place = p[1] - (api.ground(...api.ptOf(s, rIn))[1] - deborde);
    const h = largeur * im.naturalHeight / im.naturalWidth * 0.9;
    let ecrase = 1;
    if (h > place) ecrase = Math.max(0.45, place / h);
    if (h * ecrase > place) largeur *= Math.max(0, place) / (h * ecrase);
    if (largeur < 0.8 * m) return;
    nuages.push([p[1], p[0], largeur, im, ((g >>> 3) & 1) === 1, ecrase]);
  };
  for (let i = 0; i < fin.length; i++) {
    for (let k = 0; k < 3; k++) {
      const g = hache(i * 3 + k * 52711 + 5);
      poser(fin[i], rIn - 0.6 - (g % 300) / 100, (2.6 + ((g >>> 6) % 160) / 100) * m, g);
    }
    for (let k = 0; k < 4; k++) {
      const h = hache(i * 11 + k * 7919 + 1);
      const r = rIn - 3 - (h % 2000) / 100;
      // une lente houle : les nuages ne sont pas poses, ils derivent
      poser(fin[i], r + 0.3 * Math.sin(t * 0.3 + (h >>> 8)), (3.6 + ((h >>> 9) % 400) / 100) * m, h);
    }
  }
  nuages.sort((a, z) => a[0] - z[0]);
  for (const [y, x, l, im, ret, e] of nuages) poserCumulus(ctx, im, x, y, l, ret, e);
  // la piste eclaire d'or le sommet des nuages qui la bordent
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  api.rail(ctx, sm, rIn - 0.5, 'rgba(255,190,96,0.10)', 26 * u);
  api.rail(ctx, sm, rIn - 0.25, 'rgba(255,200,110,0.14)', 10 * u);
  ctx.restore();
}

// -----------------------------------------------------------------------
// LA PISTE GALACTIQUE (l'apotheose).
// -----------------------------------------------------------------------
//
// L'auteur, 07/10, image de reference : une piste translucide posee dans une
// nebuleuse — on voit le ciel au travers, ses lignes sont de fins traits
// blancs, ses bords luisent ; autour, des nebuleuses, des filaments de
// poussiere sombre, des etoiles en croix et des galaxies. La piste est
// pervenche (stades.ts) ; on y verse ici la nebuleuse et les etoiles, en
// mode `lighter` : les lignes blanches du moteur restent blanches. Le dehors
// de la piste, c'est la pelouse — le vide du stade cosmos, sans ses planetes
// (`astres: []`). Deux versions plus fortes ont ete essayees et refusees
// (« ca reste sobre », puis une texture tiree de l'image : « c'est moche ») ;
// l'auteur a retenu celle-ci.
let galaxieSprite: HTMLCanvasElement | null = null;
/** Une petite galaxie spirale, vue de face : on l'incline au dessin. */
function petiteGalaxie(): HTMLCanvasElement {
  if (galaxieSprite) return galaxieSprite;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 160;
  const c = cv.getContext('2d')!;
  c.globalCompositeOperation = 'lighter';
  const coeur = c.createRadialGradient(80, 80, 0, 80, 80, 60);
  coeur.addColorStop(0, 'rgba(255,244,220,1)'); coeur.addColorStop(0.18, 'rgba(255,210,180,0.55)');
  coeur.addColorStop(0.5, 'rgba(160,140,255,0.15)'); coeur.addColorStop(1, 'rgba(120,100,255,0)');
  c.fillStyle = coeur; c.fillRect(0, 0, 160, 160);
  for (let i = 0; i < 700; i++) {
    const g = hache(i * 7 + 3), r = Math.pow((g % 1000) / 1000, 0.8);
    const bras = i % 2 ? Math.PI : 0;
    const ecart = (((g >>> 10) % 1000) / 1000 - 0.5) * 0.7 * (1.2 - r);
    const a = bras + ecart + r * 3.6;
    const x = 80 + Math.cos(a) * r * 72, y = 80 + Math.sin(a) * r * 72;
    c.fillStyle = (g >>> 20) % 3 ? 'rgba(190,210,255,0.55)' : 'rgba(255,200,240,0.5)';
    c.fillRect(x, y, 1.3, 1.3);
  }
  galaxieSprite = cv;
  return cv;
}

/** Le contour de la bande [r0, r1] du trace ; `suite` l'ajoute au chemin
 *  en cours au lieu d'en ouvrir un neuf (deux bandes, un seul decoupage). */
function bande(ctx: CanvasRenderingContext2D, api: any, sm: any[], r0: number, r1: number, suite = false) {
  if (!suite) ctx.beginPath();
  sm.forEach((s, i) => { const p = api.ground(...api.ptOf(s, r1)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
  for (let i = sm.length - 1; i >= 0; i--) { const p = api.ground(...api.ptOf(sm[i], r0)); ctx.lineTo(p[0], p[1]); }
  ctx.closePath();
}

function etoileEnCroix(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, a: number) {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, l * 1.3);
  halo.addColorStop(0, `rgba(255,246,236,${0.55 * a})`); halo.addColorStop(1, 'rgba(255,246,236,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - l * 1.3, y - l * 1.3, l * 2.6, l * 2.6);
  ctx.fillStyle = `rgba(255,255,255,${0.6 + 0.4 * a})`;
  ctx.fillRect(x - l, y - 0.5, l * 2, 1);
  ctx.fillRect(x - 0.5, y - l, 1, l * 2);
}

function pisteGalactique(ctx: CanvasRenderingContext2D, api: any, sm: any[], rIn: number) {
  const { G, C } = api;
  const T = G.track;
  const u = api.ui(), m = api.scaleM();
  const t = performance.now() / 1000;
  const rOut = T.curved ? T.edge(C.LANE_COUNT) : C.LANE_W * C.LANE_COUNT;
  const fin = api.samples(2);
  const vu = (p: number[], marge: number) =>
    p[0] > -marge && p[0] < G.VW + marge && p[1] > -marge && p[1] < G.VH + marge;
  const nuee = (x: number, y: number, rx: number, ry: number, coul: string, a: number) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${coul},${a})`); g.addColorStop(0.5, `rgba(${coul},${a * 0.45})`); g.addColorStop(1, `rgba(${coul},0)`);
    ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  };
  const GAZ = ['236,84,196', '150,96,255', '80,150,255', '255,140,64', '90,220,236', '255,110,170'];

  // LA NEBULEUSE, UNE SEULE, qui passe SOUS la piste : on la peint pleine
  // dehors, puis attenuee dans la piste — c'est ce qui en fait une vitre.
  type Nuee = [number, number, number, string, number];
  const nuees: Nuee[] = [], poussieres: Nuee[] = [], noeuds: Nuee[] = [];
  // (serrees : trois nuees par echantillon, de 24 m sous la piste a 3 m
  // au-dela — clairsemees, on voyait surtout le noir)
  for (let i = 0; i < fin.length; i++) {
    for (let k = 0; k < 3; k++) {
      const g = hache(i * 17 + k * 7919 + 5);
      const p = api.ground(...api.ptOf(fin[i], rIn - 24 + (g % 3000) / 100));
      const rx = (5 + ((g >>> 8) % 800) / 100) * m;
      if (vu(p, rx)) nuees.push([p[0], p[1], rx, GAZ[(g >>> 4) % GAZ.length], 0.12 + ((g >>> 16) % 14) / 100]);
    }
    const h = hache(i * 23 + 11);
    const q = api.ground(...api.ptOf(fin[i], rIn - 22 + (h % 2600) / 100));
    const rq = (1.4 + ((h >>> 8) % 200) / 100) * m;
    if (h % 2 === 0 && vu(q, rq)) noeuds.push([q[0], q[1], rq, ['255,220,250', '255,170,220', '200,220,255'][(h >>> 4) % 3], 0.35]);
  }
  for (let i = 1; i < fin.length; i++) {
    const g = hache(i * 29 + 9);
    const p = api.ground(...api.ptOf(fin[i], rIn - 22 + (g % 2600) / 100));
    const rx = (4 + ((g >>> 8) % 700) / 100) * m;
    if (vu(p, rx)) poussieres.push([p[0], p[1], rx, '18,4,26', 0.45]);
  }
  const peindre = (force: number) => {
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, r, c, a] of nuees) nuee(x, y, r, r * 0.55, c, a * force);
    ctx.globalCompositeOperation = 'source-over';
    for (const [x, y, r, c, a] of poussieres) nuee(x, y, r, r * 0.2, c, a * force);
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, r, c, a] of noeuds) nuee(x, y, r, r * 0.7, c, a * force);
  };

  // 1. DEHORS : la nebuleuse pleine, ses galaxies, ses etoiles
  ctx.save();
  bande(ctx, api, sm, rIn - 60, rIn);
  bande(ctx, api, sm, rOut, rOut + 1.6, true);
  ctx.clip();
  peindre(1);
  const gal = petiteGalaxie();
  for (let i = 2; i < fin.length; i += 11) {
    const g = hache(i * 41 + 1);
    const p = api.ground(...api.ptOf(fin[i], rIn - 8 - (g % 2200) / 100));
    const l = (2.2 + ((g >>> 9) % 300) / 100) * m;
    if (!vu(p, l)) continue;
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(((g >>> 3) % 628) / 100 + t * 0.05); ctx.scale(1, 0.45);
    ctx.drawImage(gal, -l / 2, -l / 2, l, l);
    ctx.restore();
  }
  for (let i = 0; i < fin.length; i++) {
    const g = hache(i * 13 + 77);
    const p = api.ground(...api.ptOf(fin[i], rIn - 1 - (g % 3200) / 100));
    if (!vu(p, 10)) continue;
    const a = 0.5 + 0.5 * Math.sin(t * (1.2 + (g >>> 22) % 3) + (g >>> 6));
    if (g % 4 === 0) etoileEnCroix(ctx, p[0], p[1], (3 + a * 4 + (g >>> 12) % 4) * u, a);
    else { ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.5 * a})`; const s2 = (1 + (g >>> 16) % 2) * u; ctx.fillRect(p[0], p[1], s2, s2); }
  }
  ctx.restore();

  // 2. LA PISTE EN VITRE : la meme nebuleuse au travers, attenuee ; des
  // reflets en biais qui glissent ; le liseré clair des deux tranches
  ctx.save();
  bande(ctx, api, sm, rIn, rOut);
  ctx.clip();
  peindre(0.5);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < fin.length; i += 5) {
    const g = hache(i * 61 + 3);
    if (g % 3 === 0) continue;
    const mm = api.ptOf(fin[i], rIn)[0];
    // un reflet : une bande qui traverse la piste en biais
    const base = (r: number, d: number): number[] => {
      const w = api.ptOf(fin[i], r);
      return api.ground(w[0] + d, w[1]);
    };
    const l0 = 1 + ((g >>> 6) % 160) / 100, biais = 2.5;
    const a1 = base(rIn - 0.5, 0), a2 = base(rIn - 0.5, l0), b2 = base(rOut + 0.5, l0 + biais), b1 = base(rOut + 0.5, biais);
    const gr = ctx.createLinearGradient(a1[0], a1[1], a2[0], a2[1]);
    const f = 0.22 + 0.08 * Math.sin(t * 0.8 + mm * 0.1);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(235,240,255,${f})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(b1[0], b1[1]); ctx.closePath(); ctx.fill();
  }
  // l'eclat du verre, plus fort vers le bord lointain
  api.rail(ctx, sm, rOut - 1.2, 'rgba(210,220,255,0.06)', 34 * u);
  for (let i = 0; i < fin.length; i++) {
    for (let k = 0; k < 6; k++) {
      const g = hache(i * 31 + k * 104729 + 3);
      const p = api.ground(...api.ptOf(fin[i], rIn + 0.1 + ((g % 1000) / 1000) * (rOut - rIn - 0.2)));
      if (!vu(p, 8)) continue;
      const a = 0.5 + 0.5 * Math.sin(t * (1.6 + ((g >>> 20) % 4) * 0.5) + (g >>> 8));
      if (k === 0 && (g >>> 12) % 3 === 0) etoileEnCroix(ctx, p[0], p[1], (2.5 + a * 4) * u, a);
      else { ctx.fillStyle = `rgba(255,250,255,${0.25 + 0.55 * a})`; const s2 = (0.8 + a * 1.2) * u; ctx.fillRect(p[0] - s2 / 2, p[1] - s2 / 2, s2, s2); }
    }
  }
  ctx.restore();
  // le liseré des tranches de la vitre
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  api.rail(ctx, sm, rIn + 0.1, 'rgba(255,255,255,0.75)', 1.6 * u);
  api.rail(ctx, sm, rOut - 0.1, 'rgba(255,255,255,0.75)', 1.6 * u);
  api.rail(ctx, sm, rIn + 0.35, 'rgba(200,220,255,0.18)', 5 * u);
  api.rail(ctx, sm, rOut - 0.35, 'rgba(200,220,255,0.18)', 5 * u);
  ctx.restore();
}

export function premierPlanDe(lieu: string) {
  const cle = MONUMENT_DU_LIEU(lieu);
  if (cle === 'karman') {
    return function premierPlan(ctx: CanvasRenderingContext2D, api: any, _th: any, sm: any[], rIn: number) {
      pisteCeleste(ctx, api, sm, rIn);
    };
  }
  if (cle === 'apotheose') {
    return function premierPlan(ctx: CanvasRenderingContext2D, api: any, _th: any, sm: any[], rIn: number) {
      pisteGalactique(ctx, api, sm, rIn);
    };
  }
  const P = PREMIER_PLAN[cle];
  if (!P || !IMAGES[P.img]) return null;
  return function premierPlan(ctx: CanvasRenderingContext2D, api: any, _th: any, sm: any[], rIn: number) {
    // les enfants d'abord : a deux ou trois metres de la piste, ils sont plus
    // loin de la camera que les barques (cinq metres)
    if (cle === 'menole') enfants(ctx, api, sm, rIn);
    const R = piece(P.img);
    if (!R) return;
    const { G } = api;
    const k = (P.largeur * api.scaleM()) / R.p.w;
    const w = R.p.w * k, h = R.p.h * k;
    for (let i = 1; i < sm.length; i += P.pas) {
      const p = api.solid(...api.ptOf(sm[i], rIn - P.recul), 0);
      const x = p[0] - R.p.ax * k, y = p[1] - R.p.ay * k;
      if (x > G.VW || x + w < 0 || y > G.VH || y + h < 0) continue;
      // une sur deux retournee : la plage n'aligne pas ses barques
      if (P.img === 'menole' && i % (2 * P.pas) === 1) {
        ctx.save(); ctx.translate(p[0], 0); ctx.scale(-1, 1);
        ctx.drawImage(R.im, -R.p.ax * k, y, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(R.im, x, y, w, h);
      }
    }
  };
}
