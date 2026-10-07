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
// le depaysement des stades 2 a 4 (legende_pieces.py ; voir CULTURE)
import toro from '@/assets/legende/decors/toro.webp?url';
import sakura from '@/assets/legende/decors/sakura.webp?url';
import kiosque from '@/assets/legende/decors/kiosque.webp?url';
import jerk from '@/assets/legende/decors/jerk.webp?url';
import cesme from '@/assets/legende/decors/cesme.webp?url';
import simit from '@/assets/legende/decors/simit.webp?url';
import trencadis from '@/assets/legende/decors/trencadis.webp?url';
import drac from '@/assets/legende/decors/drac.webp?url';
import fanous from '@/assets/legende/decors/fanous.webp?url';
import zellige from '@/assets/legende/decors/zellige.webp?url';
import tambours from '@/assets/legende/decors/tambours.webp?url';
import etal from '@/assets/legende/decors/etal.webp?url';
import baobab from '@/assets/legende/decors/baobab.webp?url';
import terrasse from '@/assets/legende/decors/terrasse.webp?url';
import wallace from '@/assets/legende/decors/wallace.webp?url';
import reverbere from '@/assets/legende/decors/reverbere.webp?url';
import taxi from '@/assets/legende/decors/taxi.webp?url';
import borne from '@/assets/legende/decors/borne.webp?url';
import hotdog from '@/assets/legende/decors/hotdog.webp?url';
import boite from '@/assets/legende/decors/boite.webp?url';
import bus from '@/assets/legende/decors/bus.webp?url';
import garde from '@/assets/legende/decors/garde.webp?url';
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
  toro, sakura, kiosque, jerk, cesme, simit, trencadis, drac, fanous, zellige, tambours,
  etal, baobab, terrasse, wallace, reverbere, taxi, borne, hotdog, boite, bus, garde,
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
  const Cu = CULTURE[MONUMENT_DU_LIEU(cle)];
  if (Cu) for (const ob of Cu.objets) piece(ob.img);
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
};

// -----------------------------------------------------------------------
// LE DEPAYSEMENT DES STADES 2 A 4.
// -----------------------------------------------------------------------
//
// L'auteur, 07/10 : « ajoute plus d'elements culturels sur tous les autres
// stades, ca manque de depaysement » — sauf la plage de Menole, l'Olympe et
// l'apotheose. Trois choses par lieu :
//   - des OBJETS TYPIQUES poses dans la pelouse interieure, chacun a sa
//     distance de la piste, tires au sort (mais toujours les memes a la meme
//     place : le hasard est une graine du trace) ;
//   - une GUIRLANDE le long des panneaux, aux couleurs du pays — a Kyoto, des
//     lanternes de papier ;
//   - a Kyoto, un JARDIN SEC (karesansui) a la place du gazon.
// Les objets sont modelises dans Blender (legende_pieces.py), comme le torii.
//
// LES VERS ET PROVERBES PEINTS AU SOL, verifies le 07/10 (pas par un
// locuteur : contre des sources) — Basho, Yunus Emre, Apollinaire, Emma
// Lazarus, Shakespeare (domaine public) ; « We likkle but we tallawah »
// (Jamaique, graphie la plus attestee : « Wi » d'abord ecrit), « Qui no
// s'arrisca no pisca » (Catalogne, Softcatala), « من جد وجد » (arabe
// classique), « Komai yayi farko zai yi karshe » (haoussa, Zikoko : tout ce
// qui commence finit ; « Komai nisan dare, gari zai waye », d'abord ecrit,
// n'etait atteste nulle part). A faire relire avant toute ouverture.
type Objet = { img: string; recul: [number, number]; poids: number };
type Motif = 'sakura' | 'hibiscus' | 'nazar' | 'panot' | 'etoile8' | 'spirale' | 'feuille' | 'plaque' | 'rose';
/** La piste du lieu : un motif peint ca et la, et un vers (ou un proverbe)
 *  peint a plat dans un couloir, comme une inscription au sol. */
type Piste = { motif: Motif; texte: string; couleur: string; police?: string };
type Culture = { objets: Objet[]; pas: number; guirlande: number[][] | 'chochin'; sol?: 'karesansui'; piste?: Piste };
const objet = (img: string, recul: [number, number], poids = 1): Objet => ({ img, recul, poids });
const CULTURE: Record<string, Culture> = {
  kyoto: { objets: [objet('torii', [4, 4.5], 2), objet('toro', [1.6, 3]), objet('sakura', [5, 9], 2)], pas: 6,
           guirlande: 'chochin', sol: 'karesansui',
          piste: { motif: 'sakura', texte: '古池や　蛙飛び込む　水の音', couleur: 'rgba(232,190,96,0.8)', police: 'serif' } },
  kingston: { objets: [objet('kiosque', [4, 6]), objet('jerk', [1.6, 3])], pas: 5,
              guirlande: [[0, 155, 58], [254, 209, 0], [24, 24, 24]],
             piste: { motif: 'hibiscus', texte: 'We likkle but we tallawah', couleur: 'rgba(0,96,48,0.8)' } },
  izmir: { objets: [objet('cesme', [3.5, 5]), objet('simit', [1.6, 3])], pas: 5,
           guirlande: [[227, 10, 23], [250, 250, 250]],
          piste: { motif: 'nazar', texte: 'Gelin tanış olalım', couleur: 'rgba(255,255,255,0.78)' } },
  barcelone: { objets: [objet('trencadis', [2.5, 4], 2), objet('drac', [3, 6])], pas: 6,
               guirlande: [[252, 221, 9], [218, 18, 26]],
              piste: { motif: 'panot', texte: 'Qui no s’arrisca, no pisca', couleur: 'rgba(252,221,9,0.8)' } },
  casablanca: { objets: [objet('fanous', [1.4, 2.4], 2), objet('zellige', [4, 6])], pas: 5,
                guirlande: [[193, 39, 45], [0, 98, 51]],
               piste: { motif: 'etoile8', texte: 'مَن جَدَّ وَجَدَ', couleur: 'rgba(232,192,96,0.85)' } },
  abuja: { objets: [objet('tambours', [1.6, 3]), objet('etal', [3, 5]), objet('baobab', [7, 11])], pas: 6,
           guirlande: [[0, 135, 81], [250, 250, 250]],
          piste: { motif: 'spirale', texte: 'Komai yayi farko zai yi karshe', couleur: 'rgba(255,255,255,0.78)' } },
  paris: { objets: [objet('morris', [3, 3.5]), objet('terrasse', [1.6, 3], 2), objet('wallace', [3, 5]), objet('reverbere', [1.2, 1.6])], pas: 5,
           guirlande: [[0, 85, 164], [250, 250, 250], [239, 65, 53]],
          piste: { motif: 'feuille', texte: 'Sous le pont Mirabeau coule la Seine', couleur: 'rgba(255,255,255,0.8)', police: 'serif' } },
  newyork: { objets: [objet('taxi', [2.5, 3.5]), objet('borne', [1.2, 1.6], 2), objet('hotdog', [3, 5])], pas: 5,
             guirlande: [[178, 34, 52], [250, 250, 250], [60, 59, 110]],
            piste: { motif: 'plaque', texte: 'Give me your tired, your poor', couleur: 'rgba(250,206,40,0.8)' } },
  londres: { objets: [objet('cabine', [3, 3.5]), objet('boite', [1.2, 2]), objet('bus', [8, 10]), objet('garde', [3, 5])], pas: 6,
             guirlande: [[200, 16, 46], [250, 250, 250], [1, 33, 105]],
            piste: { motif: 'rose', texte: 'All the world’s a stage', couleur: 'rgba(232,190,96,0.8)', police: 'serif' } },
};

/**
 * Pose le repere au sol : en unites d'un centimetre, `u` dans le sens de la
 * course et `v` vers l'interieur — le haut d'une lettre regarde alors la
 * tribune, et un texte se lit comme une inscription peinte au sol.
 *
 * (L'echantillon suivant du trace est a GAUCHE a l'ecran, pas a droite :
 * pris tel quel, le vers se lisait a l'envers, en miroir — vu le 07/10.)
 */
function auSol(ctx: CanvasRenderingContext2D, api: any, s0: any, s1: any, r: number, dessiner: () => void) {
  const a = api.ground(...api.ptOf(s0, r)), ex = api.ground(...api.ptOf(s1, r)), ey = api.ground(...api.ptOf(s0, r + 1));
  ctx.save();
  ctx.transform(-(ex[0] - a[0]) / 100, -(ex[1] - a[1]) / 100, -(ey[0] - a[0]) / 100, -(ey[1] - a[1]) / 100, a[0], a[1]);
  dessiner();
  ctx.restore();
}

function motif(ctx: CanvasRenderingContext2D, m: Motif, l: number, g: number) {
  const fleur = (n: number, R: number, r: number, coul: string, rot: number) => {
    ctx.fillStyle = coul;
    for (let k = 0; k < n; k++) {
      const a = rot + (k * Math.PI * 2) / n;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * R, Math.sin(a) * R, r * 1.1, r * 0.75, a, 0, Math.PI * 2); ctx.fill();
    }
  };
  const rot = (g % 628) / 100;
  switch (m) {
    case 'sakura':
      fleur(5, l * 0.24, l * 0.2, 'rgba(232,190,96,0.7)', rot);
      ctx.fillStyle = 'rgba(255,236,170,0.8)'; ctx.beginPath(); ctx.arc(0, 0, l * 0.08, 0, Math.PI * 2); ctx.fill();
      break;
    case 'hibiscus':
      fleur(5, l * 0.26, l * 0.24, 'rgba(214,32,58,0.75)', rot);
      ctx.strokeStyle = 'rgba(250,220,60,0.9)'; ctx.lineWidth = l * 0.04;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(rot) * l * 0.5, Math.sin(rot) * l * 0.5); ctx.stroke();
      break;
    case 'nazar':
      for (const [r, c] of [[0.5, 'rgba(20,60,170,0.85)'], [0.34, 'rgba(255,255,255,0.9)'], [0.22, 'rgba(90,170,230,0.9)'], [0.11, 'rgba(14,14,20,0.9)']] as [number, string][]) {
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, l * r, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'panot':
      ctx.strokeStyle = 'rgba(250,250,250,0.35)'; ctx.lineWidth = l * 0.03;
      ctx.strokeRect(-l / 2, -l / 2, l, l);
      fleur(4, l * 0.2, l * 0.15, 'rgba(250,250,250,0.32)', Math.PI / 4);
      break;
    case 'etoile8':
      ctx.fillStyle = 'rgba(232,192,96,0.55)';
      for (const a of [0, Math.PI / 4]) { ctx.save(); ctx.rotate(a); ctx.fillRect(-l * 0.32, -l * 0.32, l * 0.64, l * 0.64); ctx.restore(); }
      ctx.fillStyle = 'rgba(250,246,230,0.75)'; ctx.beginPath(); ctx.arc(0, 0, l * 0.14, 0, Math.PI * 2); ctx.fill();
      break;
    case 'spirale':
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = l * 0.04;
      ctx.beginPath();
      for (let k = 0; k <= 60; k++) { const a = k * 0.32 + rot, r = l * 0.008 * k; k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(0, 0); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; ctx.beginPath(); ctx.arc(Math.cos(a) * l * 0.62, Math.sin(a) * l * 0.62, l * 0.05, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'feuille': {
      const coul = ['rgba(150,86,34,0.75)', 'rgba(214,140,40,0.75)', 'rgba(120,70,30,0.75)'][g % 3];
      ctx.rotate(rot);
      ctx.fillStyle = coul;
      ctx.beginPath(); ctx.moveTo(-l * 0.5, 0); ctx.quadraticCurveTo(0, -l * 0.32, l * 0.5, 0); ctx.quadraticCurveTo(0, l * 0.32, -l * 0.5, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(80,44,20,0.7)'; ctx.lineWidth = l * 0.025;
      ctx.beginPath(); ctx.moveTo(-l * 0.55, 0); ctx.lineTo(l * 0.45, 0); ctx.stroke();
      break;
    }
    case 'plaque':
      ctx.fillStyle = 'rgba(30,30,34,0.85)'; ctx.beginPath(); ctx.arc(0, 0, l * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(110,110,116,0.8)'; ctx.lineWidth = l * 0.03;
      ctx.beginPath(); ctx.arc(0, 0, l * 0.4, 0, Math.PI * 2); ctx.stroke();
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(-l * 0.36, k * l * 0.12); ctx.lineTo(l * 0.36, k * l * 0.12); ctx.stroke(); }
      break;
    case 'rose':
      fleur(5, l * 0.24, l * 0.22, 'rgba(200,24,40,0.8)', rot);
      fleur(5, l * 0.12, l * 0.12, 'rgba(250,246,240,0.9)', rot + 0.6);
      ctx.fillStyle = 'rgba(232,190,96,0.9)'; ctx.beginPath(); ctx.arc(0, 0, l * 0.06, 0, Math.PI * 2); ctx.fill();
      break;
  }
}

/** Les motifs peints dans les couloirs, et le vers du lieu, peint a plat. */
function pistePoetique(ctx: CanvasRenderingContext2D, api: any, rIn: number, P: Piste, graine: number) {
  const { G, C } = api;
  const fin = api.samples(1);
  const lw = C.LANE_W;
  const vu = (s: any, r: number) => {
    const p = api.ground(...api.ptOf(s, r));
    return p[0] > -80 && p[0] < G.VW + 80 && p[1] > -80 && p[1] < G.VH + 80;
  };
  // les motifs, un tous les deux metres environ, d'un couloir a l'autre
  for (let i = 1; i + 1 < fin.length; i += 2) {
    const g = hache(i * 53 + graine);
    if (g % 3 === 0) continue;
    const couloir = (g >>> 4) % C.LANE_COUNT;
    const r = rIn + (couloir + 0.25 + (((g >>> 8) % 50) / 100)) * lw;
    if (!vu(fin[i], r)) continue;
    auSol(ctx, api, fin[i], fin[i + 1], r, () => motif(ctx, P.motif, (45 + ((g >>> 12) % 35)), g));
  }
  // le vers, dans le couloir 2 puis dans le 7, a 18 m et a 62 m du depart
  for (const [depart, couloir] of [[18, 1], [62, 6]] as [number, number][]) {
    const i = fin.findIndex((s: any) => api.ptOf(s, rIn)[0] >= depart);
    if (i < 0 || i + 1 >= fin.length) continue;
    const r = rIn + (couloir + 0.25) * lw;
    if (!vu(fin[i], r) && !vu(fin[Math.min(fin.length - 1, i + 15)], r)) continue;
    auSol(ctx, api, fin[i], fin[i + 1], r, () => {
      ctx.font = `700 ${Math.round(lw * 100 * 0.62)}px ${P.police === 'serif' ? 'Georgia, \'Noto Serif CJK JP\', serif' : 'system-ui, sans-serif'}`;
      ctx.fillStyle = P.couleur;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(P.texte, 0, 0);
    });
  }
}

/** Les petales de cerisier qui traversent l'ecran, a Kyoto. */
function petales(ctx: CanvasRenderingContext2D, api: any) {
  const { G } = api;
  const u = api.ui(), t = performance.now() / 1000;
  for (let i = 0; i < 26; i++) {
    const g = hache(i * 31 + 7);
    const v = 0.04 + ((g % 100) / 100) * 0.05;
    const x = ((((g >>> 7) % 1000) / 1000) * 1.3 + t * v) % 1.3 - 0.15;
    const y = ((((g >>> 17) % 1000) / 1000) + t * v * 1.4) % 1.1 - 0.05;
    const a = t * (1 + (g % 3)) + i;
    ctx.save();
    ctx.translate(x * G.VW + Math.sin(t + i) * 12 * u, y * G.VH);
    ctx.rotate(a);
    ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(a * 0.7)));
    ctx.fillStyle = i % 3 ? 'rgba(250,196,214,0.85)' : 'rgba(255,226,236,0.85)';
    ctx.beginPath(); ctx.ellipse(0, 0, 4 * u, 2.6 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/** La largeur reelle d'une piece, en metres (manifeste, legende_pieces.py). */
const largeurDe = (img: string): number => ((manifeste as any)?.pieces?.[img]?.largeur_m as number) || 1;

/** Les objets typiques du lieu, poses dans la pelouse, du plus loin au plus pres. */
function objetsDuLieu(ctx: CanvasRenderingContext2D, api: any, rIn: number, C: Culture, graine: number) {
  const { G } = api;
  const m = api.scaleM();
  const fin = api.samples(1);
  const total = C.objets.reduce((a, b) => a + b.poids, 0);
  const poses: [number, CanvasImageSource, number, number, number, number, number, boolean][] = [];
  for (let k = 0, i = 0; ; k++) {
    const g = hache(k * 131 + graine);
    i += Math.max(3, Math.round(C.pas * (0.7 + 0.6 * ((g % 1000) / 1000))));
    if (i >= fin.length) break;
    let tirage = ((g >>> 10) % 1000) / 1000 * total, ob = C.objets[0];
    for (const c of C.objets) { if (tirage < c.poids) { ob = c; break; } tirage -= c.poids; }
    const R = piece(ob.img);
    if (!R) continue;
    const recul = ob.recul[0] + (((g >>> 20) % 100) / 100) * (ob.recul[1] - ob.recul[0]);
    const p = api.solid(...api.ptOf(fin[i], rIn - recul), 0);
    const kk = (largeurDe(ob.img) * m) / R.p.w;
    const w = R.p.w * kk, h = R.p.h * kk;
    if (p[0] + w < 0 || p[0] - w > G.VW || p[1] - h > G.VH || p[1] + h < 0) continue;
    poses.push([p[1], R.im, p[0], R.p.ax * kk, R.p.ay * kk, w, h, ((g >>> 5) & 1) === 1 && ob.img !== 'kiosque']);
  }
  poses.sort((a, b) => a[0] - b[0]);
  for (const [y, im, x, ax, ay, w, h, retourne] of poses) {
    if (retourne) {
      ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1);
      ctx.drawImage(im, -ax, y - ay, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(im, x - ax, y - ay, w, h);
    }
  }
}

/**
 * La guirlande tendue le long des panneaux, de mat en mat (tous les six
 * metres), qui pend entre eux : des fanions aux couleurs du pays, qui
 * battent un peu — ou, a Kyoto, des lanternes de papier rouges et blanches.
 */
function guirlande(ctx: CanvasRenderingContext2D, api: any, rOut: number, C: Culture) {
  const { G } = api;
  const u = api.ui(), t = performance.now() / 1000;
  const fin = api.samples(1);
  const r = rOut + 1.45 + (G.ecartTribune || 0);
  const pt = (i: number, f: number, z: number) => {
    const a = api.ptOf(fin[i], r), b = api.ptOf(fin[Math.min(fin.length - 1, i + 1)], r);
    return api.solid(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, z);
  };
  const MAT = 6;
  for (let i0 = 0; i0 + MAT < fin.length; i0 += MAT) {
    const a = pt(i0, 0, 0), e = pt(i0 + MAT, 0, 2.3);
    if (Math.max(a[0], e[0]) < -40 || Math.min(a[0], e[0]) > G.VW + 40) continue;
    // le mat
    const haut = pt(i0, 0, 2.3);
    ctx.strokeStyle = 'rgba(60,56,52,0.9)'; ctx.lineWidth = 1.6 * u;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(haut[0], haut[1]); ctx.stroke();
    // le fil, qui pend
    const fil = (s: number) => {
      const i = i0 + Math.floor(s * MAT), f = s * MAT - Math.floor(s * MAT);
      return pt(Math.min(i, fin.length - 1), f, 2.25 - 0.45 * 4 * s * (1 - s));
    };
    ctx.strokeStyle = 'rgba(40,36,34,0.8)'; ctx.lineWidth = 1 * u;
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) { const q = fil(k / 12); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
    ctx.stroke();
    if (C.guirlande === 'chochin') {
      for (let k = 1; k < 5; k++) {
        const q = fil(k / 5), L = Math.max(5 * u, api.scaleM() * 0.45);
        const cx = q[0] + Math.sin(t * 1.5 + k + i0) * 0.6 * u, cy = q[1] + L * 0.62;
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, L * 1.2);
        halo.addColorStop(0, 'rgba(255,170,90,0.35)'); halo.addColorStop(1, 'rgba(255,170,90,0)');
        ctx.fillStyle = halo; ctx.fillRect(cx - L * 1.2, cy - L * 1.2, L * 2.4, L * 2.4);
        ctx.fillStyle = (k + i0 / MAT) % 3 === 0 ? '#F4EEE2' : '#D8322A';
        ctx.beginPath(); ctx.ellipse(cx, cy, L * 0.36, L * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1E1A1A';
        ctx.fillRect(cx - L * 0.22, cy - L * 0.56, L * 0.44, L * 0.12);
        ctx.fillRect(cx - L * 0.22, cy + L * 0.44, L * 0.44, L * 0.12);
      }
    } else {
      const coul = C.guirlande;
      for (let k = 0; k < 10; k++) {
        const s0 = k / 10, s1 = (k + 0.8) / 10;
        const q0 = fil(s0), q1 = fil(s1);
        const pointe = api.scaleM() * 0.38;
        const bat = Math.sin(t * 3 + k * 0.8 + i0) * 0.12 * pointe;
        const c = coul[(k + i0) % coul.length];
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]);
        ctx.lineTo((q0[0] + q1[0]) / 2 + bat, (q0[1] + q1[1]) / 2 + pointe);
        ctx.closePath(); ctx.fill();
      }
    }
  }
}

/**
 * Le jardin sec de Kyoto, a la place du gazon : du gravier ratisse en lignes
 * paralleles a la piste, et quelques rochers mousseux, que les ratissages
 * contournent en cercles.
 */
function karesansui(ctx: CanvasRenderingContext2D, api: any, sm: any[], rIn: number) {
  const { G } = api;
  const u = api.ui(), m = api.scaleM();
  ctx.save();
  ctx.beginPath();
  sm.forEach((s, i) => { const p = api.ground(...api.ptOf(s, rIn - 0.5)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
  for (let i = sm.length - 1; i >= 0; i--) { const p = api.ground(...api.ptOf(sm[i], rIn - 60)); ctx.lineTo(p[0], p[1]); }
  ctx.closePath();
  ctx.fillStyle = 'rgb(222,218,206)';
  ctx.fill();
  ctx.clip();
  for (let k = 0; k < 70; k++) {
    api.rail(ctx, sm, rIn - 0.9 - k * 0.32, k % 2 ? 'rgba(176,170,156,0.7)' : 'rgba(250,248,240,0.7)', 1 * u);
  }
  // les rochers, et leurs cercles ratisses
  const fin = api.samples(1);
  for (let i = 9; i < fin.length; i += 23) {
    const g = hache(i * 97 + 3);
    const w0 = api.ptOf(fin[i], rIn - 5 - (g % 600) / 100);
    const c = api.ground(w0[0], w0[1]);
    if (c[0] < -6 * m || c[0] > G.VW + 6 * m || c[1] < -6 * m || c[1] > G.VH + 6 * m) continue;
    const anneau = (R: number, coul: string, larg: number) => {
      ctx.strokeStyle = coul; ctx.lineWidth = larg;
      ctx.beginPath();
      for (let a = 0; a <= 24; a++) {
        const q = api.ground(w0[0] + Math.cos(a / 24 * Math.PI * 2) * R, w0[1] + Math.sin(a / 24 * Math.PI * 2) * R);
        a ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      ctx.stroke();
    };
    ctx.fillStyle = 'rgb(222,218,206)';
    ctx.beginPath();
    for (let a = 0; a <= 24; a++) {
      const q = api.ground(w0[0] + Math.cos(a / 24 * Math.PI * 2) * 2.6, w0[1] + Math.sin(a / 24 * Math.PI * 2) * 2.6);
      a ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
    }
    ctx.fill();
    for (let k = 0; k < 5; k++) anneau(1.2 + k * 0.32, k % 2 ? 'rgba(176,170,156,0.8)' : 'rgba(250,248,240,0.8)', 1 * u);
    anneau(0.95, 'rgba(96,124,82,0.95)', 5 * u);
    const r = (0.55 + (g % 40) / 100) * m;
    const roc = ctx.createRadialGradient(c[0] - r * 0.3, c[1] - r * 0.7, r * 0.1, c[0], c[1] - r * 0.3, r * 1.1);
    roc.addColorStop(0, '#9C9A94'); roc.addColorStop(1, '#4E4C48');
    ctx.fillStyle = roc;
    ctx.beginPath(); ctx.ellipse(c[0], c[1] - r * 0.35, r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

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
  const Cu = CULTURE[cle];
  if (Cu) {
    const graine = cle.length * 7919 + cle.charCodeAt(0);
    return function premierPlan(ctx: CanvasRenderingContext2D, api: any, _th: any, sm: any[], rIn: number) {
      const { G, C } = api;
      const rOut = G.track.curved ? G.track.edge(C.LANE_COUNT) : C.LANE_W * C.LANE_COUNT;
      if (Cu.sol === 'karesansui') karesansui(ctx, api, sm, rIn);
      if (Cu.piste) pistePoetique(ctx, api, rIn, Cu.piste, graine);
      guirlande(ctx, api, rOut, Cu);
      objetsDuLieu(ctx, api, rIn, Cu, graine);
      if (cle === 'kyoto') petales(ctx, api);
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
