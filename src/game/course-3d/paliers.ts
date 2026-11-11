// LA COURSE EN VRAIE 3D — les paliers de qualite et la cadence mesuree (decoupe de course-3d.ts, 11/11/2026).

import { Q, OMBRES } from './reglages';
import { gpuDeLAppareil, gpuHautDeGamme } from './gpu';
import { renderer, soleil, dimensionner, toile } from './scene';

// LES PALIERS DE QUALITE (23/10 : « ca rame beaucoup, ca manque de fluidite sur mon Galaxy
// Flip »). 3 = l'ULTRA (jusqu'a 3 pixels par point, ombres 2048 adoucies, pieces et boss
// pleins) ; 2 = deux pixels par point, ombres 1024, pieces et boss legers ; 1 = un pixel et
// demi, ombres 512 ; 0 = un pixel, sans ombres. Un ordinateur part en ULTRA, un telephone au
// palier 2 ; puis la cadence decide : deux secondes et demie sous 45 images/s et l'on
// descend d'un palier, et l'appareil s'en souvient pour la fois suivante.
// ?qualite=ultra force l'ULTRA, ?qualite=plein le palier 2.
const TELEPHONE = (() => {
  try { return matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); } catch { return false; }
})();
// v3 (24/10) : les paliers retenus sous l'ancien seuil (45 images/s) repartent de zero
// v4 (10/11) : ceux retenus sous la regle trop prompte du 10/11 (seuil a 22 ms, presentation
// jugee, un pixel par point) aussi — « on perd enormement en qualite », l'auteur, video du Flip
const PALIER_CLE = 'sprinter_palier3d-v4';
const palierRetenu = (() => { try { const v = localStorage.getItem(PALIER_CLE); return v == null ? null : Math.max(0, Math.min(3, +v | 0)); } catch { return null; } })();
const QUALITE = Q.get('qualite');
// ?palier=0..3 : un palier fixe, sans adaptation (pour mesurer)
const PALIER_FORCE = Q.get('palier');
// L'ULTRA SUR UN TELEPHONE HAUT DE GAMME (11/11, gpu.ts) : sa puce graphique et sa memoire lui ouvrent
// le palier 3, mais il part du palier 2 comme les autres et n'y monte que si la course est fluide
// (tenirLaCadence). S'il en retombe, il s'en souvient : plus d'ULTRA sur cet appareil.
const ULTRA_REFUSE_CLE = 'sprinter_palier3d-ultra-refuse';
const TELEPHONE_FORT = TELEPHONE && gpuHautDeGamme(gpuDeLAppareil(), (globalThis.navigator as any)?.deviceMemory)
  && (() => { try { return localStorage.getItem(ULTRA_REFUSE_CLE) == null; } catch { return true; } })();
const PALIER_MAX = TELEPHONE && !TELEPHONE_FORT ? 2 : 3, PALIER_MIN = 0;
export let palier = PALIER_FORCE != null ? Math.max(0, Math.min(3, +PALIER_FORCE | 0))
  : QUALITE === 'ultra' ? 3 : QUALITE === 'plein' ? 2 : Math.max(0, Math.min(PALIER_MAX, palierRetenu ?? (TELEPHONE ? 2 : 3)));
// les pieces et les boss se choisissent au chargement : pleins seulement en ULTRA
export let ULTRA = palier >= 3;
// LE TELEPHONE NE DESCEND PAS SOUS 1,5 PIXEL PAR POINT (24/10, l'auteur : « je ne veux pas de
// crenelage », « les lignes ne sont toujours pas droites ») : a un pixel par point, les lignes de
// couloir se crenelaient en escaliers. 1,5 dessine encore 44 % de pixels de moins que 2. Au
// palier 0, le telephone garde donc 1,5 et ne perd que les ombres.
export const RATIO = TELEPHONE ? [1.5, 1.5, 2, 3] : [1, 1.5, 2, 3];
let intervalles: number[] = [], mesure = 0, fluide = 0, aBaisse = false;
let qualiteApres = 0;
// UNE IMAGE LENTE SE JUGE CONTRE LA CADENCE DE L'ECRAN, pas contre un seuil fixe. Un iPhone en
// economie d'energie (Safari plafonne alors a 30 images/s) donnait 33 ms a chaque image : toutes
// « lentes » sous un seuil de 22 ms, et le palier tombait a 0 des la presentation. La cadence de
// base est le 20e centile des intervalles de la fenetre ; une image est lente au-dela d'une fois
// et demie cette base, entre 34 ms (le seuil d'avant le 10/11, que le Flip tenait en course au
// palier 2 ; 22 ms le faisait tomber) et 39 ms (sous 26 images/s, c'est lent quelle que soit la base).
const IMAGE_LENTE_MIN = 0.034, IMAGE_LENTE_MAX = 0.039;
/** La mesure de cadence repart de zero (la scene vient d'etre cachee). */
export function oublierLaMesure() { mesure = 0; intervalles = []; }
/** Un stade neuf compile ses shaders : une seconde sans juger la cadence. */
export function laisserCompiler() { qualiteApres = performance.now() + 1000; oublierLaMesure(); }
function seuilImageLente(dts: number[]) {
  const tries = [...dts].sort((a, b) => a - b);
  const base = tries[Math.floor(tries.length * 0.2)] || 1 / 60;
  return Math.min(IMAGE_LENTE_MAX, Math.max(IMAGE_LENTE_MIN, base * 1.5));
}
function appliquerLePalier() {
  if (!renderer) return;
  renderer.setPixelRatio(Math.min(RATIO[palier], window.devicePixelRatio || 1));
  const t = palier >= 3 ? 2048 : palier === 2 ? 1024 : 512;
  if (soleil && soleil.shadow.mapSize.x !== t) {
    soleil.shadow.mapSize.set(t, t);
    if (soleil.shadow.map) { soleil.shadow.map.dispose(); (soleil.shadow as any).map = null; }
  }
  if (soleil) soleil.castShadow = OMBRES && palier > 0;
  dimensionner();
}
/** Une baisse durable sur 2,5 s de course allege le rendu ; une image isolee ne suffit pas. */
export function tenirLaCadence(dt: number, enCourse: boolean) {
  // SEULE LA COURSE SE JUGE (retabli le 10/11, apres la video du Flip) : la presentation et le
  // decompte chargent encore (stade, foule, shaders) et faisaient tomber au palier 0 un appareil
  // qui tient le palier 2 en course. La premiere seconde d'un stade laisse aussi ses shaders se
  // compiler. Un retour d'onglet (> 1 s) ne compte pas comme une cadence perdue.
  if (!renderer || !dt || dt > 1 || QUALITE === 'ultra' || PALIER_FORCE != null || !enCourse || performance.now() < qualiteApres) return;
  mesure += dt; intervalles.push(dt);
  if (mesure < 2.5) return;
  const dureeMesuree = mesure, seuil = seuilImageLente(intervalles);
  const lentes = intervalles.reduce((s, d) => s + (d > seuil ? d : 0), 0);
  // un quart du temps en images lentes, c'est deja une course qui saccade (au Flip, en ULTRA :
  // 40 images/s, une image sur six a 33 ms)
  const part = lentes / mesure, trop = part > 0.25;
  mesure = 0; intervalles = [];
  // ON REMONTE AUSSI (« la qualite du jeu est basse meme en ultra », l'auteur, 24/10) : un
  // telephone qui avait saccade une fois restait au palier bas pour toujours. Dix secondes de
  // course fluide (moins d'une image lente sur trente), sans avoir baisse dans la visite : un
  // palier de plus, jusqu'a celui de l'appareil. Seule la course compte pour remonter.
  if (!trop) {
    fluide = part < 0.03 ? fluide + dureeMesuree : 0;
    if (fluide >= 10 && !aBaisse && palier < PALIER_MAX) {
      palier++; fluide = 0;
      appliquerLePalier();
      try { localStorage.setItem(PALIER_CLE, String(palier)); } catch { /* le palier vaut pour la visite */ }
    }
    return;
  }
  aBaisse = true; fluide = 0;
  if (palier <= PALIER_MIN) return;
  if (palier === 3 && TELEPHONE) try { localStorage.setItem(ULTRA_REFUSE_CLE, '1'); } catch { /* il reessaiera a la prochaine visite */ }
  palier--;
  ULTRA = false;
  appliquerLePalier();
  try { localStorage.setItem(PALIER_CLE, String(palier)); } catch { /* le palier vaut pour la visite */ }
}
// LE COMPTEUR D'IMAGES (?ips=1) : pour mesurer sur un telephone (« teste sur telephone », l'auteur, 28/10) — les
// images par seconde et la pire image de la derniere seconde, en haut a gauche
let ipsBoite: HTMLDivElement | null = null, ipsN = 0, ipsT0 = 0, ipsPire = 0, ipsPrec = 0;
export function compterLesImages() {
  const t = performance.now();
  if (!ipsBoite) {
    ipsBoite = document.createElement('div');
    ipsBoite.style.cssText = 'position:fixed;left:6px;top:6px;z-index:99999;font:700 13px ui-monospace,Menlo,monospace;color:#7fff7f;background:rgba(0,0,0,.65);padding:3px 6px;border-radius:4px;pointer-events:none';
    document.body.appendChild(ipsBoite); ipsT0 = t; ipsPrec = t;
  }
  ipsN++; ipsPire = Math.max(ipsPire, t - ipsPrec); ipsPrec = t;
  // LE NIVEAU S'AFFICHE AVEC LA CADENCE (10/11, pour comparer des mesures sur telephone) : sans
  // lui, on ne savait pas quel palier le reglage automatique avait choisi pendant la course.
  if (t - ipsT0 >= 1000) {
    const r = renderer ? renderer.getPixelRatio() : 0;
    const qui = PALIER_FORCE != null ? 'force' : QUALITE === 'ultra' ? 'ultra' : TELEPHONE_FORT ? 'auto, ultra permis' : 'auto';
    ipsBoite.textContent = `${Math.round(ipsN * 1000 / (t - ipsT0))} i/s · pire ${Math.round(ipsPire)} ms · niveau ${palier} ${qui} · ${String(+r.toFixed(2)).replace('.', ',')} px`
      + (toile ? ` · ${toile.width}×${toile.height}` : '');
    ipsN = 0; ipsT0 = t; ipsPire = 0;
  }
}
export const IPS = Q.get('ips') !== null;
