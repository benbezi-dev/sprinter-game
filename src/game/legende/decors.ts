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
}

/**
 * La fonction que le moteur appelle a chaque image pour le lieu `cle`, ou
 * null s'il n'a pas de monument.
 */
export function lointainDe(lieu: string) {
  const cle = MONUMENT_DU_LIEU(lieu);
  if (PREMIER_PLAN[cle]) return null;
  if (cle !== 'paris' && !IMAGES[cle]) return null;
  const pose: Pose = { ...POSE_PAR_DEFAUT, ...(POSES[cle] || {}) };
  return function lointain(ctx: CanvasRenderingContext2D, api: any, _th: any, sm: any[], rOut: number, horizon: number) {
    const R = piece(cle);
    if (!R) return;
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
  menole: { largeur: 8, recul: 5, pas: 3 },
};

export function premierPlanDe(lieu: string) {
  const cle = MONUMENT_DU_LIEU(lieu);
  const P = PREMIER_PLAN[cle];
  if (!P || !IMAGES[cle]) return null;
  return function premierPlan(ctx: CanvasRenderingContext2D, api: any, _th: any, sm: any[], rIn: number) {
    const R = piece(cle);
    if (!R) return;
    const { G } = api;
    const k = (P.largeur * api.scaleM()) / R.p.w;
    const w = R.p.w * k, h = R.p.h * k;
    for (let i = 1; i < sm.length; i += P.pas) {
      const p = api.solid(...api.ptOf(sm[i], rIn - P.recul), 0);
      const x = p[0] - R.p.ax * k, y = p[1] - R.p.ay * k;
      if (x > G.VW || x + w < 0 || y > G.VH || y + h < 0) continue;
      // une sur deux retournee : la plage n'aligne pas ses barques
      if (i % (2 * P.pas) === 1) {
        ctx.save(); ctx.translate(p[0], 0); ctx.scale(-1, 1);
        ctx.drawImage(R.im, -R.p.ax * k, y, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(R.im, x, y, w, h);
      }
    }
  };
}
