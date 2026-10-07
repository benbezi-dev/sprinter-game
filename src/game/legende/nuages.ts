// -----------------------------------------------------------------------
// LES CUMULUS DE L'OLYMPE, partages par la piste (decors.ts), la cite
// celeste (cite-celeste.ts) et la cinematique de Karman (LegendeKarman.tsx).
//
// Rendus hors ligne par tools/blender/decors/legende_nuages.py : un relief
// en chou-fleur, eclaire par le haut, des ombres lavande, un bas qui
// s'efface. Ils remplacent les ronds degrades peints au canvas — l'auteur,
// 07/10 : « tu peux mieux faire pour les nuages ».
// -----------------------------------------------------------------------

import cumulus0 from '@/assets/legende/decors/nuages/cumulus0.webp?url';
import cumulus1 from '@/assets/legende/decors/nuages/cumulus1.webp?url';
import cumulus2 from '@/assets/legende/decors/nuages/cumulus2.webp?url';
import cumulus3 from '@/assets/legende/decors/nuages/cumulus3.webp?url';
import cumulus4 from '@/assets/legende/decors/nuages/cumulus4.webp?url';
import cumulus5 from '@/assets/legende/decors/nuages/cumulus5.webp?url';

const URLS = [cumulus0, cumulus1, cumulus2, cumulus3, cumulus4, cumulus5];
export const NB_CUMULUS = URLS.length;
const IMAGES: (HTMLImageElement | null)[] = URLS.map(() => null);

/** Lance le chargement des cumulus (sans effet s'il est deja lance). */
export function chargerLesCumulus() {
  if (typeof Image === 'undefined') return;
  URLS.forEach((u, i) => {
    if (IMAGES[i] || !u) return;
    const im = new Image();
    im.decoding = 'async';
    im.src = u;
    IMAGES[i] = im;
  });
}

/** Le cumulus n° i, ou null tant qu'il n'est pas charge. */
export function cumulus(i: number): HTMLImageElement | null {
  chargerLesCumulus();
  const im = IMAGES[((i % NB_CUMULUS) + NB_CUMULUS) % NB_CUMULUS];
  return im && im.complete && im.naturalWidth ? im : null;
}

/** Combien sont charges (la cite se repeint quand ce compte change). */
export function cumulusCharges(): number {
  return IMAGES.filter(im => im && im.complete && im.naturalWidth).length;
}

/**
 * Pose un cumulus : `largeur` en pixels, son pied (le bas, qui s'efface dans
 * la mer de nuages) au point (x, y). `ecrase` < 1 l'aplatit.
 */
export function poserCumulus(ctx: CanvasRenderingContext2D, im: HTMLImageElement, x: number, y: number,
                             largeur: number, retourne = false, ecrase = 1) {
  const h = largeur * im.naturalHeight / im.naturalWidth * ecrase;
  if (retourne) {
    ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1);
    ctx.drawImage(im, -largeur / 2, y - h * 0.9, largeur, h);
    ctx.restore();
  } else {
    ctx.drawImage(im, x - largeur / 2, y - h * 0.9, largeur, h);
  }
}
