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
import karman from '@/assets/legende/decors/karman.webp?url';
import apotheose from '@/assets/legende/decors/apotheose.webp?url';
// les pieces de premier plan, modelisees dans Blender (legende_pieces.py)
import torii from '@/assets/legende/decors/torii.webp?url';
import cabine from '@/assets/legende/decors/cabine.webp?url';
import morris from '@/assets/legende/decors/morris.webp?url';
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
  newyork, londres, karman, apotheose,
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
  karman: { part: 0.8, large: 0.6 },
  barcelone: { large: 0.5 },
  apotheose: { large: 0.5 },
};

// Les quatre lieux de l'Olympe (un par maitre tire au sort) partagent le
// meme temple.
const MONUMENT_DU_LIEU = (cle: string) => (cle.startsWith('karman') ? 'karman' : cle);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

function piece(cle: string): { im: HTMLImageElement; p: Piece } | null {
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
                     R: { im: HTMLImageElement; p: Piece }, pose: Pose) {
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
 * La fonction que le moteur appelle a chaque image pour le lieu `cle`, ou
 * null s'il n'a pas de monument.
 */
export function lointainDe(lieu: string) {
  const cle = MONUMENT_DU_LIEU(lieu);
  // Menole : son image EST le premier plan (la pirogue), pas un monument
  if (PREMIER_PLAN[cle]?.img === cle) return null;
  if (cle !== 'paris' && !IMAGES[cle]) return null;
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
    const R = piece(cle);
    if (R) poserAuLoin(ctx, api, sm, rOut, horizon, R, pose);
  };
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

export function premierPlanDe(lieu: string) {
  const cle = MONUMENT_DU_LIEU(lieu);
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
