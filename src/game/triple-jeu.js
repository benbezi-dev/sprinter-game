/* ---------------------------------------------------------------------------
   JUMPER — le jeu du triple saut
   ---------------------------------------------------------------------------
   Le reglement est dans `triple.js` et `longueur.js`. Rien ici ne touche ni
   au moteur ni a l'ecran : tout se teste dans Node (tools/triple-test.mjs).

   LE MEME GESTE, TROIS FOIS.

   Le saut en longueur tient en un appui qu'on tient puis qu'on relache : le
   pied se pose, l'angle monte, on quitte la planche. Le triple saut, c'est ce
   geste trois fois de suite, et une chose de plus entre chaque : RETOMBER.

     1. L'appel sur la planche, comme en longueur — l'angle du cloche-pied.
     2. La pose du cloche-pied : appuyer sur le MEME pave quand le pied touche,
        tenir pour l'angle de la foulee bondissante, relacher.
     3. La pose de la foulee : l'AUTRE pave, tenir pour l'angle du saut.
     4. Le saut finit comme en longueur : les deux pouces pour le ramene.

   CE QUI SE PAIE, ET QUE LE TRIPLE SAUT A EN PROPRE.

   Chaque pose coute de la vitesse, et d'autant plus que le bond precedent
   etait haut : retomber de haut, c'est freiner. Un cloche-pied en cloche fait
   un beau premier bond et casse les deux suivants — c'est l'erreur de tous
   les debutants, et le modele la retrouve de lui-meme. La pose elle-meme se
   juge a l'instant : un pied qui griffe le sol en arrivant garde la vitesse,
   un pied qui s'ecrase la laisse dans la piste.
--------------------------------------------------------------------------- */

import { G } from './longueur.js';
import {
  vol as volSaut, perteImpulsion, jugerRamene, DISTANCE_ENVOL, VENT_PAR_MS,
} from './longueur-jeu.js';
import { marque } from './longueur.js';

/* ------------------------------------------------------------- les bonds */

/**
 * Les deux premiers bonds.
 *
 *   h0, hL   la hauteur du centre de masse a l'envol et a la pose, en metres
 *   a, b, e  la perte de vitesse horizontale a l'impulsion, en part :
 *            a + b x (angle - e)^1,5 — la meme forme qu'en longueur, plus
 *            douce : ces bonds-la se prennent a ras du sol.
 *   pose     de combien le pied se pose devant le centre de masse
 *   envol    de combien le centre de masse est devant la pointe a l'envol
 *
 * Mesure sur ce modele (tools/triple-test.mjs), a 11,1 m/s d'elan : les
 * trois bonds optimaux partent a 15°, 16° et 20°, et se partagent le saut en
 * 37 / 30 / 33 % — le triple saut « a dominante cloche-pied » des meilleurs.
 */
export const BONDS_JEU = [
  { cle: 'cloche', h0: 1.12, hL: 0.92, a: 0.015, b: 0.0026, e: 7, pose: 0.25, envol: 0.20 },
  { cle: 'foulee', h0: 1.10, hL: 0.92, a: 0.015, b: 0.0030, e: 7, pose: 0.25, envol: 0.20 },
];

/** Les angles qui rendent le plus, pour la jauge et l'arc : cloche, foulee, saut. */
export const ANGLES_VISES = [15, 16, 20.5];

/**
 * CE QUE COUTE UNE POSE, en part de vitesse par m/s de vitesse verticale a
 * l'arrivee. Plus le bond etait haut, plus il faut freiner pour le recevoir.
 */
export const PERTE_POSE = 0.012;

/** La perte a l'impulsion d'un des deux premiers bonds. */
export function perteBond(i, angle) {
  const p = BONDS_JEU[i];
  return p.a + p.b * Math.pow(Math.max(0, angle - p.e), 1.5);
}

/**
 * Un des deux premiers bonds, de l'envol a la pose.
 *
 * `vEntree` est la vitesse horizontale qui arrive dans l'impulsion. Rend la
 * vitesse au decollage, la duree et la longueur du vol du centre de masse, la
 * vitesse qu'il reste apres la pose — avant que l'appui ne soit juge.
 */
export function bond(i, vEntree, angle) {
  const p = BONDS_JEU[i];
  const vx = Math.max(0, vEntree) * (1 - perteBond(i, angle));
  const vy = vx * Math.tan(angle * Math.PI / 180);
  const dh = p.h0 - p.hL;
  const vyPose = Math.sqrt(vy * vy + 2 * G * dh);
  const duree = (vy + vyPose) / G;
  return {
    i, vx, vy, duree, vol: vx * duree,
    // de pointe a pointe : le centre de masse devant la pointe a l'envol, le
    // vol, le pied devant le centre de masse a la pose
    longueur: p.envol + vx * duree + p.pose,
    vApres: vx * (1 - PERTE_POSE * vyPose),
    h0: p.h0, hL: p.hL,
  };
}

/** La hauteur du centre de masse `t` secondes apres l'envol d'un bond. */
export function hauteurBond(b, t) {
  return b.h0 + b.vy * t - 0.5 * G * t * t;
}

/* ------------------------------------------------------------- la pose */

/**
 * LA POSE, jugee a l'instant de l'appui.
 *
 * `retard` est le temps de l'appui apres le contact du pied, en secondes de
 * jeu — negatif s'il a ete donne avant. Le bon geste est un rien EN AVANCE :
 * un sauteur ne subit pas le sol, il le griffe vers l'arriere avant d'y
 * arriver. Un appui trop tot n'est pas une pose (le pied n'est pas la) ; trop
 * tard, la jambe s'ecrase ; beaucoup trop tard, le bond est casse.
 */
export const POSE = {
  avance: 0.06,      // un appui donne jusqu'a 6 centiemes avant le contact
  retard: 0.045,     // ou 4,5 centiemes apres : actif
  bonAvance: 0.11,   // au-dela, mais encore dans ces bornes : bon
  bonRetard: 0.10,
  casse: 0.30,       // plus rien apres trois dixiemes : le bond est casse
};
export const GARDE_POSE = { actif: 0.985, bon: 0.955 };

export function jugerPose(retard) {
  if (retard == null || retard > POSE.casse) return { note: 'rompu', garde: 0 };
  if (retard >= -POSE.avance && retard <= POSE.retard) return { note: 'actif', garde: GARDE_POSE.actif };
  if (retard >= -POSE.bonAvance && retard <= POSE.bonRetard) return { note: 'bon', garde: GARDE_POSE.bon };
  if (retard < -POSE.bonAvance) return { note: 'tot', garde: null };   // pas encore une pose
  // ecrase : de 0,955 a 0,86 entre un et trois dixiemes de retard
  const k = (retard - POSE.bonRetard) / (POSE.casse - POSE.bonRetard);
  return { note: 'ecrase', garde: GARDE_POSE.bon - 0.095 * k };
}

/* ------------------------------------------------------------ un essai */

/**
 * UN TRIPLE SAUT, du geste a la marque.
 *
 *   vElan    la vitesse d'elan sur les derniers metres
 *   ecart    de la pointe du pied d'appel a la ligne (negatif : mordu)
 *   angles   les trois angles d'envol, en degres
 *   poses    les deux retards de pose, en secondes de jeu
 *   pieds    les deux pieds poses sont-ils les bons
 *   avance   le ramene, comme en longueur
 *   ciseau   l'athlete a-t-il pedale pendant le saut
 *   vent     en m/s
 *
 * Rend les trois bonds, la marque, et ce qui a rendu l'essai nul s'il l'est.
 */
export function sauterTriple({ vElan, ecart, angles, poses = [0, 0], pieds = [true, true],
                               avance = null, ciseau = false, vent = 0 }) {
  const bonds = [];
  let v = vElan, raison = null;
  const notes = [];
  for (let i = 0; i < 2; i++) {
    const b = bond(i, v, angles[i]);
    const p = jugerPose(poses[i]);
    notes.push(p.note);
    bonds.push(b);
    if (!raison && !pieds[i]) raison = 'pied';
    if (p.note === 'rompu' || p.garde == null) { raison = raison || 'rompu'; break; }
    v = b.vApres * p.garde;
  }
  let saut = null, r = null;
  if (bonds.length === 2 && raison !== 'rompu') {
    saut = volSaut(v, angles[2]);
    r = jugerRamene(avance, ciseau);
  }
  const longueurs = bonds.map(b => b.longueur);
  const dernier = saut ? DISTANCE_ENVOL + saut.longueur + r.gain : 0;
  if (saut) longueurs.push(dernier);
  const brut = longueurs.reduce((s, x) => s + x, 0);
  const porte = VENT_PAR_MS * vent * (brut / 8.5) * 0.6;
  if (!raison && ecart < 0) raison = 'planche';
  const metres = Math.max(0.5, brut + porte - Math.max(0, ecart));
  const nul = !!raison || !saut;
  return {
    mordu: nul, raison: raison || (saut ? null : 'rompu'),
    ecart, vElan, vent, angles, notes, bonds: longueurs,
    vitesses: [vElan, ...bonds.map(b => b.vx), saut ? saut.vx : 0],
    saut, ramene: r ? r.note : null, gain: r ? r.gain : 0, ciseau,
    depuisPointe: brut + porte,
    metres: nul ? 0 : metres,
    marque: nul ? null : marque(metres),
  };
}

/* ----------------------------------------------------------- le plateau */

/**
 * LE PLATEAU DE CHAQUE ETAPE, en metres, comme en longueur.
 *
 *     Competition scolaire    9,50 - 12,00
 *     Niveau regional        12,80 - 14,60
 *     Niveau national        15,20 - 16,40
 *     Championnat du monde   16,80 - 17,70   (record du monde : 18,29)
 *     0.Games                17,20 - 18,20
 *     Inter galactique       19,40 - 20,40
 *
 * Chaque etape a sa planche (triple.js) : ce plateau-ci retombe toujours dans
 * la fosse qu'on lui a donnee.
 */
export const PLATEAU_TRIPLE = [
  [9.50, 12.00], [12.80, 14.60], [15.20, 16.40],
  [16.80, 17.70], [17.20, 18.20], [19.40, 20.40],
];
