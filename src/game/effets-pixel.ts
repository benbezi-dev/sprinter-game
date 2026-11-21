/* ---------------------------------------------------------------------------
   EFFETS PIXEL ART DE LA COURSE 2D (pixelfx, MIT — voir pixelfx/PROVENANCE.md)
   ---------------------------------------------------------------------------
   Quatre effets calcules pixel par pixel, poses sur la piste en metres et
   dessines par-dessus les coureurs :

   - le coup de pistolet du starter, a cote du joueur, au depart ;
   - un choc rouge sur le joueur elimine au faux depart ;
   - une etincelle sur la haie que le joueur accroche ;
   - deux bouquets de feu d'artifice au-dessus de la ligne quand il gagne.

   Le module REGARDE l'etat du jeu (G.state, G.player.finished) au lieu de
   s'accrocher au moteur : rien dans sprinter-app.js ne change, et un effet qui
   casserait ne peut pas casser une course. Seule la haie touchee l'appelle
   (haies-course.js), parce que rien dans G ne dit laquelle vient de tomber.

   La 3D n'en recoit aucun : GameCanvas ne l'appelle que si la course est
   dessinee en 2D, et vide la liste sinon. Comme la poussiere de
   rendu-premium.js, les effets se taisent au palier SOBRE (telephone qui
   rame) et quand le systeme demande moins d'animations.
--------------------------------------------------------------------------- */
// @ts-ignore — modules JS sans types
import { createFrame, clearFrame, createFx, composite } from './pixelfx/core/index.js';
// @ts-ignore
import * as pistolet from './pixelfx/fx/projectiles/muzzle-pistol.js';
// @ts-ignore
import * as etincelle from './pixelfx/fx/impacts/hit-spark.js';
// @ts-ignore
import * as choc from './pixelfx/fx/impacts/crit-hit.js';
// @ts-ignore
import * as bouquet from './pixelfx/fx/explosions/firework-burst.js';

type Mod = { meta: { size: number[]; origin: number[]; duration: number } };

/**
 * `hauteurM` : la hauteur que prend l'image entiere de l'effet sur la piste,
 * en metres. C'est elle qui fixe la taille du pixel : un coureur mesure 1,8 m.
 */
const EFFETS: Record<string, { mod: Mod; hauteurM: number; options?: Record<string, unknown> }> = {
  pistolet: { mod: pistolet, hauteurM: 1.5, options: { height: 30 } },
  etincelle: { mod: etincelle, hauteurM: 1.1 },
  choc: { mod: choc, hauteurM: 2.6 },
  bouquet: { mod: bouquet, hauteurM: 11 },
};
export type NomEffet = keyof typeof EFFETS;

type Vivant = {
  fx: any; frame: any; img: ImageData; toile: HTMLCanvasElement; tctx: CanvasRenderingContext2D;
  X: number; Y: number; z: number; hauteurM: number; size: number[]; origin: number[];
  retard: number;
};

const MAX = 10;
let vivants: Vivant[] = [];
let graine = 1;

function moinsDAnimations(): boolean {
  try { return !!globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
function tropLent(): boolean {
  const P = (globalThis as any).RenduPremium;
  return !!P && typeof P.niveau === 'number' && P.niveau <= P.SOBRE;
}

/**
 * Lance un effet au point (X, Y) de la piste, en metres, `z` metres au-dessus
 * du sol. `retard` en secondes : l'effet attend avant de partir.
 */
export function lancer(nom: NomEffet, X: number, Y: number, o: { z?: number; flip?: boolean; retard?: number } = {}) {
  const def = EFFETS[nom];
  if (!def || !Number.isFinite(X) || !Number.isFinite(Y)) return;
  if (moinsDAnimations() || tropLent() || typeof document === 'undefined') return;
  const { size, origin } = def.mod.meta;
  const [w, h] = size;
  const toile = document.createElement('canvas');
  toile.width = w; toile.height = h;
  const tctx = toile.getContext('2d');
  if (!tctx) return;
  graine = (graine * 16807) % 2147483647;
  const fx = createFx(def.mod, { ...(def.options || {}), x: 0, y: 0, flip: !!o.flip, seed: graine % 100000 });
  if (vivants.length >= MAX) vivants.shift();
  vivants.push({
    fx, frame: createFrame(w, h, -origin[0], -origin[1]), img: new ImageData(w, h), toile, tctx,
    X, Y, z: o.z || 0, hauteurM: def.hauteurM, size, origin, retard: o.retard || 0,
  });
}

export function vider() { vivants = []; }

/* --- ce que le module guette d'une image a l'autre ----------------------- */
let etatAvant = '';
let joueurArriveAvant = false;

function guetter(app: any) {
  const G = app.G, T = G.track, J = G.player;
  if (!G || !T || !J) { etatAvant = G ? G.state : ''; return; }
  const etat = G.state;
  // LE COUP DE PISTOLET : le decompte se termine, la course part. Un depart
  // debout n'a pas de canon (coupDePistolet, sprinter-app.js).
  if (etatAvant === 'count' && etat === 'race' && !G.departDebout) {
    const p = T.posDemi(J.d, J.lane - 1, 0);
    lancer('pistolet', p[0], p[1], { z: 0.2 });
  }
  // LE FAUX DEPART QUI ELIMINE.
  if (etatAvant !== 'falseout' && etat === 'falseout') {
    const p = T.posDemi(J.d, J.lane, J.demi || 0);
    lancer('choc', p[0], p[1], { z: 0.9 });
  }
  // LA VICTOIRE : le joueur passe la ligne et personne n'est passe avant lui.
  // Seul en piste (contre-la-montre sans adversaire), pas de feu d'artifice :
  // il n'a battu personne.
  const arrive = !!J.finished;
  if (arrive && !joueurArriveAvant && etat === 'race') {
    const autres = (G.runners || []).filter((r: any) => r && r !== J);
    const premier = autres.length > 0 && !autres.some((r: any) => r.finished && r.finishTime != null
      && J.finishTime != null && r.finishTime < J.finishTime);
    if (premier) {
      const L = T.total;
      const a = T.posDemi(L + 4, 1.5, 0), b = T.posDemi(L + 10, 5.5, 0);
      lancer('bouquet', a[0], a[1]);
      lancer('bouquet', b[0], b[1], { retard: 0.55 });
    }
  }
  joueurArriveAvant = arrive;
  if (etat === 'count' || etat === 'title') joueurArriveAvant = false;
  etatAvant = etat;
}

/**
 * Une image : guetter, avancer, dessiner. `actif` est faux quand la course
 * est dessinee en 3D — les effets en cours disparaissent alors.
 */
export function image(dt: number, ctx: CanvasRenderingContext2D, app: any, actif: boolean) {
  guetter(app);
  if (!actif) { if (vivants.length) vivants = []; return; }
  if (!vivants.length) return;
  const m = app.scaleM();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const restants: Vivant[] = [];
  for (const v of vivants) {
    if (v.retard > 0) { v.retard -= dt; restants.push(v); continue; }
    if (dt > 0) v.fx.update(dt);
    if (v.fx.done()) continue;
    restants.push(v);
    clearFrame(v.frame);
    v.fx.draw(v.frame);
    composite(v.frame, v.img.data, null);
    v.tctx.putImageData(v.img, 0, 0);
    // Le pixel de l'effet, en pixels d'ecran : entier des qu'il depasse 1,5,
    // pour garder le dessin net.
    let k = (v.hauteurM * m) / v.size[1];
    if (k >= 1.5) k = Math.round(k);
    const p = app.ground(v.X, v.Y);
    const x = p[0] - v.origin[0] * k, y = p[1] - v.z * m - v.origin[1] * k;
    ctx.drawImage(v.toile, Math.round(x), Math.round(y), v.size[0] * k, v.size[1] * k);
  }
  vivants = restants;
  ctx.restore();
}

/** Le point d'entree que haies-course.js trouve sans import circulaire. */
(globalThis as any).EffetsPixel = { lancer, vider, image };
