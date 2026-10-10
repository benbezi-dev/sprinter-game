// LES VEHICULES DE LA LEGENDE (10/10) — modeles Tripo rendus dans Blender
// (tools/blender/decors/legende_vehicules.py), deux vues par vehicule :
//   profil — le flanc, nez vers la droite, pour les voyages vers le stade ;
//   dessus — vu d'en haut, nez vers le haut, pour le globe.
// Charges a la demande (la Legende est un morceau du canal de test seul) ;
// null tant que l'image n'est pas la : l'appelant garde son dessin de secours.

export type NomVehicule = 'velo' | 'avion' | 'voiture' | 'car' | 'jet' | 'fusee';
export type Vue = 'profil' | 'dessus';
export type Sprite = { im: HTMLImageElement; w: number; h: number; ax: number; ay: number };

const URLS = import.meta.glob('../../assets/legende/vehicules/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const MANIFESTES = import.meta.glob('../../assets/legende/vehicules/manifeste.json', { import: 'default', eager: true }) as Record<string, any>;
const MANIFESTE: Record<string, Record<string, { f: string; w: number; h: number; ax: number; ay: number }>> =
  Object.values(MANIFESTES)[0] || {};

const cache = new Map<string, HTMLImageElement>();

function urlDe(f: string): string | null {
  const k = Object.keys(URLS).find(c => c.endsWith('/' + f));
  return k ? URLS[k] : null;
}

/** Le sprite du vehicule dans cette vue, ou null (pas rendu, ou pas encore charge). */
export function vehicule(nom: NomVehicule, vue: Vue): Sprite | null {
  const p = MANIFESTE[nom]?.[vue];
  if (!p) return null;
  let im = cache.get(p.f);
  if (!im) {
    const u = urlDe(p.f);
    if (!u) return null;
    im = new Image();
    im.decoding = 'async';
    im.src = u;
    cache.set(p.f, im);
  }
  return im.complete && im.naturalWidth > 0 ? { im, w: p.w, h: p.h, ax: p.ax, ay: p.ay } : null;
}

/** Demander les images tot (a l'affiche), pour qu'elles soient la au voyage. */
export function prechargerVehicules(noms: NomVehicule[]) {
  for (const n of noms) { vehicule(n, 'profil'); vehicule(n, 'dessus'); }
}
