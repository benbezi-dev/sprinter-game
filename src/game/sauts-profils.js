/* ---------------------------------------------------------------------------
   JUMPER — les profils d'athletes (27/11/2026)
   ---------------------------------------------------------------------------
   Chaque profil est un STYLE de sauteur, cale sur des mesures publiees. Les
   noms reels ne servent que de cle de calibration : a l'ecran, on ne montre que
   le style (« pas de nom reel », l'auteur, 27/11). Pour l'instant, seuls les
   ADVERSAIRES en ont un (essaiAdversaire) ; le joueur garde la physique du jeu.

   La consigne est de s'en tenir aux FOURCHETTES OFFICIELLES (l'auteur, 27/11).
   Chaque chiffre dit d'ou il vient :
     WA17L   rapport biomecanique World Athletics, Londres 2017, longueur hommes
             (Tucker, Bissas) : moyennes de finale, et Manyonga (8,48 m)
     WA17T   le meme, triple saut femmes : Rojas (14,91 m)
     K08     Koyama et al., ISBS 2008, citant Fukashiro 1994 (Tokyo 1991)
     LW05    Lu & Wang, ISBS 2005 (Edwards, 18,29 m)
   Ce qui n'est pas publie est dit « derive » (calcule) ou laisse a la valeur
   du jeu. Detail et fichiers : references-sauts/DESIGN-SAUTS.md.

   LONGUEUR. Le modele est celui du jeu (longueur-jeu.js, vol) : la planche
   prend `a + b x (angle - e)^1,5` de la vitesse d'elan, le centre de masse
   vole de h0 a hL. Les coefficients sont AJUSTES (grille) pour que l'angle
   optimal, les vitesses d'envol et la marque tombent sur la mesure ; la
   hauteur de reception hL = 0,85 m est celle qui rend Manyonga a 8,48 m avec
   ses vitesses mesurees (WA17L).

   TRIPLE. Les trois bonds sont CALIBRES A LA LECTURE (calibrerTriple) a partir
   des vitesses d'envol mesurees : la perte de chaque appui, l'angle, et la
   chute du centre de masse qui rend la longueur mesuree du bond.
--------------------------------------------------------------------------- */

import { G } from './longueur.js';

/** Les styles de la longueur. */
export const PROFILS_LONGUEUR = {
  // Carl Lewis, Tokyo 1991 : approche 11,06 m/s (K08). Envol rasant ~20° (partiel).
  // Ajuste : optimum 20,6°, vx 9,53 / vy 3,58 m/s, perte 1,53 m/s (WA17L : -0,53 a -2,80),
  // 8,70 m sans vent — 8,85 m avec ses +2,9 m/s de Tokyo.
  vitesse: {
    style: 'Vitesse', cle: 'lewis', vApproche: 11.06,
    perte: { a: 0.050, b: 0.0052, e: 14 }, h0: 1.25, hL: 0.85,
    regularite: 0.6, planche: 0.10, vol: 'ciseau',
  },
  // Mike Powell, Tokyo 1991 (8,95 m) : approche 11,00 m/s (K08). Envol haut ~24° (partiel).
  // Ajuste : optimum 23,1°, vx 9,16 / vy 3,91, perte 1,84 m/s (WA17L moyenne : 1,81) -> 8,94 m.
  envol: {
    style: 'Envol', cle: 'powell', vApproche: 11.00,
    perte: { a: 0.045, b: 0.0038, e: 13 }, h0: 1.25, hL: 0.85,
    regularite: 1.0, planche: 0.12, vol: 'ciseau',
  },
  // Pas de rapport public pour Tentoglou : cale sur le champion de Londres 2017 (WA17L,
  // Manyonga) — approche 10,70, vx 9,12 / vy 3,68, 22,0°, 8,48 m. Ajuste : 21,7°, 9,16 / 3,65, 8,50 m.
  // La precision a la planche est son trait : moins de mordus, moins de centimetres perdus.
  precision: {
    style: 'Précision', cle: 'tentoglou', vApproche: 10.70,
    perte: { a: 0.020, b: 0.0041, e: 12 }, h0: 1.25, hL: 0.85,
    regularite: 0.5, planche: 0.05, vol: 'ciseau',
  },
};

/** Les styles du triple : les vitesses d'envol de chaque bond, et sa longueur. */
export const PROFILS_TRIPLE = {
  // Jonathan Edwards, Goteborg 1995. Envols (LW05) : 9,60 / 2,75 ; 9,10 / 2,07 ; 7,80 / 2,44 m/s.
  // Contacts (LW05) : 0,099 / 0,099 / 0,141 s. Bonds : 6,05 / 5,22 / 7,02 m.
  // Approche non publiee : derivee du rapport hop / dernier appui de Taylor (WA 2017 hommes,
  // 9,89 / 10,10) -> 9,60 / 0,979 = 9,81 m/s.
  elastique: {
    style: 'Élastique', cle: 'edwards', vApproche: 9.81,
    envols: [[9.60, 2.75], [9.10, 2.07], [7.80, 2.44]],
    bonds: [6.05, 5.22, 7.02], contacts: [0.099, 0.099, 0.141],
    ecrasement: null, bras: 'double', regularite: 0.6, planche: 0.08,
  },
  // Yulimar Rojas, Londres 2017 (WA17T) : dernier appui 8,31 m/s ; envols 8,01 / 2,39 ;
  // 8,01 / 1,66 ; 6,28 / 3,15 ; bonds 5,21 / 3,95 / 5,86 m (effectif 15,02, 0,11 perdu a la
  // planche) ; contacts 0,120 / 0,150 / 0,150 s (lus sur graphique) ; le centre de masse
  // s'ecrase de 5 / 18 / 13 cm.
  amplitude: {
    style: 'Amplitude', cle: 'rojas', vApproche: 8.31,
    envols: [[8.01, 2.39], [8.01, 1.66], [6.28, 3.15]],
    bonds: [5.21, 3.95, 5.86], contacts: [0.120, 0.150, 0.150],
    ecrasement: [0.05, 0.18, 0.13], bras: 'double', regularite: 0.8, planche: 0.11,
  },
};

/* --------------------------------------------------------- la calibration */

// Ce que le jeu prend comme distances fixes (triple-jeu.js, BONDS_JEU ; longueur-jeu.js)
const ENVOL = 0.20, POSE_PIED = 0.25, ENVOL_SAUT = 0.25, GAIN_RAMENE = 0.55;
const GARDE_ACTIF = 0.985, H0 = 1.12;
const deg = (r) => r * 180 / Math.PI;

/** La chute du centre de masse qui fait durer le vol `T` a la vitesse verticale `vy`. */
function chutePour(T, vy) {
  const s = G * T - vy;              // vitesse verticale a la pose
  return Math.max(0, (s * s - vy * vy) / (2 * G));
}

/**
 * Les coefficients des trois bonds, tires des mesures, en suivant la chaine :
 * chaque bond part de la vitesse que le precedent lui a laissee.
 *
 *  - LA PERTE ENTRE DEUX ENVOLS (vx mesure du bond -> vx mesure du suivant) se
 *    partage : 40 % a l'impulsion du suivant, avec la forme du jeu
 *    `a + b x (angle - e)^1,5` (e six degres sous l'angle mesure), 60 % a la
 *    reception du bond (pertePose, par m/s de vitesse verticale a la pose).
 *  - L'ANGLE est celui des vitesses mesurees.
 *  - LA CHUTE DU CENTRE DE MASSE est celle qui rend la longueur mesuree, a la
 *    vitesse effectivement atteinte.
 *
 * Quand la mesure ne perd rien d'un envol au suivant (Rojas : 8,01 puis 8,01),
 * le jeu garde ses 1,5 % de pose active : le pas part a 7,9 au lieu de 8,01,
 * et la longueur mesuree est quand meme rendue.
 */
export function calibrerTriple(p) {
  const out = { ...p, bondsJeu: [], saut: null, angles: [] };
  const vxs = p.envols.map(x => x[0]);
  let vin = p.vApproche, perteSuivante = Math.max(0.002, 1 - vxs[0] / vin);
  p.envols.forEach(([vxm, vym], i) => {
    const angle = deg(Math.atan2(vym, vxm));
    const perte = perteSuivante;
    const e = angle - 6, b = 0.6 * perte / Math.pow(6, 1.5), a = 0.4 * perte;
    const vx = vin * (1 - perte), vy = vx * Math.tan(angle * Math.PI / 180);
    out.angles.push(angle);
    if (i < 2) {
      const T = (p.bonds[i] - ENVOL - POSE_PIED) / vx;
      const dh = chutePour(T, vy);
      const vyPose = Math.sqrt(vy * vy + 2 * G * dh);
      // la perte jusqu'au prochain envol : 40 % a son impulsion, le reste a cette pose
      const L = Math.max(0.002, 1 - vxs[i + 1] / vx);
      perteSuivante = Math.max(0.002, 0.4 * L);
      const vinVoulu = vxs[i + 1] / (1 - perteSuivante);
      const pertePose = Math.max(0, (1 - vinVoulu / (vx * GARDE_ACTIF)) / vyPose);
      out.bondsJeu.push({ cle: i ? 'foulee' : 'cloche', h0: H0, hL: H0 - dh, a, b, e, pose: POSE_PIED, envol: ENVOL, pertePose });
      vin = vx * (1 - pertePose * vyPose) * GARDE_ACTIF;
    } else {
      const T = (p.bonds[i] - ENVOL_SAUT - GAIN_RAMENE) / vx;
      const dh = chutePour(T, vy);
      out.saut = { perte: { a, b, e }, h0: 1.25, hL: 1.25 - dh };
    }
  });
  return out;
}

/** Les profils du triple, calibres une fois pour toutes. */
export const TRIPLE_CALIBRE = Object.fromEntries(Object.entries(PROFILS_TRIPLE).map(([k, p]) => [k, calibrerTriple(p)]));

/** Les cles des styles, dans l'ordre ou on les distribue aux adversaires. */
export const STYLES_LONGUEUR = Object.keys(PROFILS_LONGUEUR);
export const STYLES_TRIPLE = Object.keys(PROFILS_TRIPLE);
