// -----------------------------------------------------------------------
// LES STADES DES SAUTS — un lieu par etape.
//
// Jumper reprenait les etapes de Sprinter telles quelles, et les quatre
// premieres partagent le meme stade (le theme `day`) : memes couleurs, meme
// lumiere, seule la tribune grandissait. D'une etape a l'autre, rien ne
// changeait a l'ecran — « monotone et plat ».
//
// Les sauts vont donc chercher leurs lieux parmi les stades qui existent
// deja, et la lumiere monte avec la competition : le stade de Sprinter en
// plein midi pour la competition scolaire, le meeting d'ete de la Riviera au
// bord de l'eau pour le regional, le Champ-de-Mars — que le jeu decrit deja
// comme une finale nationale — pour le national, et le Danube, de nuit sous
// ses projecteurs et ses ecrans, pour le championnat du monde. Les deux
// dernieres etapes gardent leur stade : les Mondiaux, puis le cosmos.
//
// Cela ne touche que les sauts. Le 100 m de Sprinter court toujours ses
// quatre premieres etapes au stade `day` : le concours ne fait que choisir
// quel niveau il construit (armerConcoursSaut, armerConcoursHauteur), et le
// retour a l'accueil (goHome) reconstruit le reste.
// -----------------------------------------------------------------------

import { SprinterCore } from './engine';

/** Par etape du concours : la cle du stade hors serie, ou null pour le sien. */
const STADES = [null, 'riviera', 'champdemars', 'danube', null, null];

/**
 * L'index de LEVELS a construire pour cette etape. Un stade introuvable — une
 * liste qui aurait change — rend l'etape elle-meme : on saute alors dans le
 * stade d'avant plutot que dans le vide.
 */
export function stadeDuSaut(etape) {
  const cle = STADES[etape];
  if (!cle) return etape;
  const i = SprinterCore.LEVELS.findIndex((l) => l.cle === cle);
  return i >= 0 ? i : etape;
}

// -----------------------------------------------------------------------
// ET LA LUMIERE DE L'HEURE.
//
// Le stade change, l'heure aussi : plein midi au scolaire, fin d'apres-midi
// doree au bord de l'eau pour le regional, soleil couchant sur Paris pour le
// national, puis la nuit du Danube, qui a deja la sienne. Deux aplats sur
// l'image entiere, poses par GameCanvas juste avant la vignette : un
// `multiply` qui rechauffe et baisse la lumiere, un `soft-light` qui la fait
// venir d'un cote. Rien d'autre ne bouge — ni les couleurs du stade, ni le
// HUD, qui est en React au-dessus de la toile.
// -----------------------------------------------------------------------

const AMBIANCES = [null, 'doree', 'couchant', null, null, null];

/** L'ambiance de l'etape, ou null pour la lumiere propre du stade. */
export function ambianceDuSaut(etape) {
  return AMBIANCES[etape] || null;
}

/** Etalonne l'image entiere (W x H, en pixels de la toile). */
export function appliquerAmbiance(ctx, W, H, sorte) {
  if (!sorte || !(W > 0 && H > 0)) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (sorte === 'doree') {
    // Le meeting d'ete, en fin d'apres-midi : chaud, bas, venu du haut a gauche.
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255,236,210)';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.hypot(W, H));
    g.addColorStop(0, 'rgba(255,196,110,0.55)');
    g.addColorStop(1, 'rgba(255,196,110,0)');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (sorte === 'couchant') {
    // Le soleil qui se couche derriere la tour : orange en haut, les ombres
    // qui bleuissent en bas.
    ctx.globalCompositeOperation = 'multiply';
    const m = ctx.createLinearGradient(0, 0, 0, H);
    m.addColorStop(0, 'rgb(238,200,196)');
    m.addColorStop(1, 'rgb(206,198,228)');
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
    g.addColorStop(0, 'rgba(255,128,70,0.55)');
    g.addColorStop(1, 'rgba(255,128,70,0)');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
