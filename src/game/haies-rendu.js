/* ---------------------------------------------------------------------------
   HURDLERS — les haies a l'ecran, et le coureur qui les franchit
   ---------------------------------------------------------------------------
   Deux choses, et seulement celles-la : dessiner les haies dans les huit
   couloirs, et dire a chaque coureur ou il en est de son saut.

   LE SAUT SE LIT SUR LA DISTANCE, PAS SUR LE MOTEUR. Le pas du hurdleur
   (haies-pas.js) ne pilote que le coureur du joueur ; les sept autres courent
   au chrono vise, sans rien savoir des haies. Lire le saut sur `d` donne a
   tous le meme geste, au meme endroit — l'appel a APPEL.avant de la haie, la
   reception a APPEL.apres — et le coureur du joueur, dont le vol est regle
   sur ces memes distances, tombe exactement dans ce qu'on dessine.

   LE MOTEUR NE CONNAIT PAS CE FICHIER. haies-course.js le pose sur
   `G.obstacles` a l'armement et l'en retire au rangement ; le rendu ne fait
   qu'appeler ce qu'il y trouve. Comme pour le pas du hurdleur, la dependance
   va dans ce sens-la pour que le reglement ne parte pas dans le paquet public.

   Aucune image ici : une haie, ce sont deux pieds, deux montants et une
   barre. A trente pixels le metre, un rendu Blender n'en montrerait pas
   davantage, et une haie renversee devrait alors exister en autant d'images
   que d'angles de chute.
--------------------------------------------------------------------------- */

import { HAIES } from './haies.js';
import { APPEL } from './haies-jeu.js';

const PI = Math.PI;

/**
 * Ce que le coureur prend d'avance sur l'appel pour attaquer la haie, en
 * metres. Une demi-foulee : a 9 m/s, soixante centimetres ne duraient que
 * quatre images, et la jambe d'attaque traversait l'ecran pour se mettre en
 * place.
 */
const ATTAQUE = 1.2;
/** Ce qu'il lui faut apres la reception pour retrouver sa foulee, en metres. */
const REPRISE = 0.8;

const lisse = (x) => {
  const f = Math.max(0, Math.min(1, x));
  return f * f * (3 - 2 * f);
};

/**
 * Ou en est un coureur a `d` metres, face a ces haies.
 *
 * Rend `null` loin de toute haie, sinon `{ i, t, w }` : la haie, l'avancee du
 * vol (0 a l'appel, 1 a la reception) et le poids de la posture. Le poids
 * monte sur les derniers centimetres avant l'appel et redescend apres la
 * reception : c'est ce qui fait entrer la foulee dans le saut au lieu de la
 * remplacer d'une image a l'autre.
 */
export function sautDe(d, positions, appel) {
  for (let i = 0; i < positions.length; i++) {
    const a = positions[i] - appel.avant, b = positions[i] + appel.apres;
    // Les haies sont rangees dans l'ordre de la course : si celle-ci est
    // encore loin, les suivantes le sont davantage.
    if (d < a - ATTAQUE) return null;
    if (d > b + REPRISE) continue;
    if (d < a) return { i, t: 0, w: lisse((d - (a - ATTAQUE)) / ATTAQUE) };
    if (d <= b) return { i, t: (d - a) / (b - a), w: 1 };
    return { i, t: 1, w: 1 - lisse((d - b) / REPRISE) };
  }
  return null;
}

/**
 * La jambe d'attaque, selon l'appui de l'appel.
 *
 * Au pas `k` (la foulee vaut k x PI), la jambe du cote +1 est au contact si k
 * est pair (voir GAIT dans sprinter-core.js : la cuisse est devant, le genou
 * tendu, a la phase 0). C'est elle qui pousse ; l'autre, en retour, passe
 * devant et attaque. Le coureur du joueur se repose ensuite sur sa jambe
 * d'attaque — haies-pas.js le fait retomber sur l'appui k + 1 — et le compte
 * reste juste.
 */
export function piedDAttaque(k) {
  return (((k % 2) + 2) % 2) === 0 ? -1 : 1;
}

/**
 * De combien lever le bassin au sommet du vol, en unites du rig.
 *
 * Un hurdleur passe la barre la hanche a vingt-cinq ou trente centimetres
 * au-dessus d'elle : sa jambe d'attaque, tendue devant lui, descend un peu
 * vers le talon, et c'est ce talon qui doit encore froler la barre par le
 * haut. A dix centimetres, le harnais voyait le tibia passer dans la barre ; a
 * vingt-cinq, il ne restait qu'un millimetre au 110 m haies. Jamais moins de
 * cinq, sans quoi une haie basse franchie par un grand gabarit ressemblerait
 * a une foulee.
 */
export function leveeDe(hauteur, tailleCoureur, C) {
  return Math.max(0.05, (hauteur + 0.29) * C.MODEL_H / tailleCoureur - 0.87);
}

// ---------------------------------------------------------------------------
// LA HAIE
// ---------------------------------------------------------------------------
// Mesures du reglement, arrondies a ce qui se voit : 1,18 m de large, des pieds
// de 70 cm tournes vers le coureur qui arrive, une barre de 7 cm. La barre est
// epaissie a 10 cm pour rester lisible : a trente pixels le metre, sept
// centimetres font deux pixels.
const DEMI_LARGE = 0.59;
const MONTANT = 0.555;
const PIED = 0.70;
const BARRE = 0.10;
// Les bandes de la barre, du bord interieur au bord exterieur : claires aux
// deux bouts, comme le veut le reglement, pour que la haie se lise de loin.
const BANDES = [0.25, 0.215, 0.25, 0.215, 0.25];

const CLAIR = 'rgb(246,248,252)';
const SOMBRE = 'rgb(28,30,40)';
const METAL = 'rgb(176,182,196)';
const METAL_OMBRE = 'rgb(112,118,134)';
const SOL = 'rgb(58,62,76)';

/** Combien de temps met une haie a tomber, en secondes. */
const CHUTE = 0.35;

/**
 * Les obstacles d'une course de haies, prets a poser sur `G.obstacles`.
 *
 * `course` est l'etat du pas du hurdleur (haies-pas.js) : on n'y lit que ce
 * qui dit ou en est le joueur, et on n'y ecrit rien.
 */
export function obstaclesDe(course, touchees) {
  const cle = course.cle;
  const positions = course.positions;
  const appel = APPEL[cle];
  const hauteur = HAIES[cle].haies.hauteur;
  // Une reserve de pieces reutilisees d'une image a l'autre : huit couloirs,
  // dix haies, et un rendu a soixante images par seconde.
  const reserve = [];
  const pieces = [];

  /** Le pas d'appel du coureur du joueur, quand il le connait. */
  function appelDuJoueur(i) {
    if (course.enVol && course.i === i + 1) return Math.round(course.phaseVol / PI);
    if (course.fenetre && course.i === i) return course.fenetre.vise;
    return null;
  }

  /**
   * LE COUREUR DU JOUEUR NE GLISSE PAS APRES LA RECEPTION.
   *
   * Sur le tour, le vol est une duree (haies-jeu.js, COUT) : une seconde, dont
   * le saut dessine n'occupe qu'une moitie. Le pas du hurdleur garde la foulee
   * figee jusqu'au bout, et c'est ce qui tient le compte juste — mais a
   * l'ecran, le coureur filait jambes immobiles sur quatre metres.
   *
   * On avance donc l'IMAGE de la foulee, jamais le compte : un demi-cycle
   * plus un nombre entier de cycles, reparti sur ce qui reste de gel, pour
   * que la foulee affichee tombe exactement sur celle que haies-pas.js pose a
   * la fin du vol. Ni saut ni a-coup au raccord.
   */
  function decaler(r, G) {
    const i = course.i - 1;
    if (r !== G.player || !course.enVol || i < 0 || !(r.freeze > 0)) {
      r.decalePas = 0;
      r._gelHaie = -1;
      return;
    }
    // Encore en l'air : le saut dessine s'en charge. On ne remet pas le gel a
    // zero pour autant — un echo du coureur, dessine un peu en arriere, passe
    // aussi par ici, et le raccord doit survivre a son passage.
    if (r.d <= positions[i] + appel.apres) { r.decalePas = 0; return; }
    if (r._gelHaie !== i) {
      r._gelHaie = i;
      r._gel = r.freeze;
      const foulees = r.v * r.freeze / Math.max(0.5, r.strideLength());
      r._gelTours = Math.max(0, Math.round((foulees - 1) / 2));
    }
    const fait = 1 - r.freeze / Math.max(1e-6, r._gel);
    r.decalePas = PI * (2 * r._gelTours + 1) * fait;
  }

  return {
    /** Pose `saut` (et `decalePas`) sur un coureur, juste avant de le dessiner. */
    preparer(r, G, C) {
      decaler(r, G);
      const s = sautDe(r.d, positions, appel);
      if (!s) { r.saut = null; return; }
      if (!r._pieds) r._pieds = {};
      let pied = r._pieds[s.i];
      if (pied === undefined) {
        const k = r === G.player ? appelDuJoueur(s.i) : null;
        pied = piedDAttaque(k !== null ? k : Math.round(r.stride / PI));
        r._pieds[s.i] = pied;
      }
      const saut = r.saut || (r.saut = {});
      saut.t = s.t;
      saut.w = s.w;
      saut.pied = pied;
      saut.haut = leveeDe(hauteur, r.look.h, C);
    },

    /** Retirer d'un coureur tout ce que `preparer` y a pose. */
    oublier(r) {
      r.saut = null;
      r.decalePas = 0;
      r._pieds = null;
      r._gelHaie = -1;
    },

    /**
     * Les haies a l'ecran, chacune avec sa profondeur, pour que le rendu les
     * range parmi les coureurs. La profondeur est celle du milieu de la
     * barre : dans un meme couloir, c'est exactement « devant ou derriere le
     * coureur » ; d'un couloir a l'autre, deux objets assez loin pour se
     * tromper d'ordre sont aussi trop loin pour se recouvrir.
     */
    pieces(api) {
      const { G, C, ground, depthOf, scaleM } = api;
      const T = G.track;
      const m = scaleM();
      const marge = (hauteur + PIED) * m + 40;
      pieces.length = 0;
      for (let e = 0; e < C.LANE_COUNT; e++) {
        const centre = milieuDuCouloir(T, C, e);
        for (let i = 0; i < positions.length; i++) {
          const q = T.posDemi(positions[i], e, centre);
          const g = ground(q[0], q[1]);
          if (g[0] < -marge || g[0] > G.VW + marge ||
              g[1] < -marge || g[1] > G.VH + marge) continue;
          const pc = reserve[pieces.length] || (reserve[pieces.length] = {});
          pc.profondeur = depthOf(q[0], q[1]);
          pc.couloir = e;
          pc.haie = i;
          pc.centre = centre;
          pc.chute = chuteDe(touchees, e, i, G);
          pieces.push(pc);
        }
      }
      return pieces;
    },

    /** Dessiner une piece rendue par `pieces`. */
    dessiner(ctx, api, pc) {
      dessinerHaie(ctx, api, positions[pc.haie], pc.couloir, pc.centre,
                   hauteur, pc.chute);
    },
  };
}

/**
 * Le decalage du milieu du couloir par rapport a sa ligne de mesure.
 *
 * En ligne droite, la piste place deja chaque coureur au milieu de son
 * couloir. En virage, elle le place sur la ligne de mesure, a vingt ou trente
 * centimetres du bord interieur : une haie posee la depasserait du couloir.
 */
function milieuDuCouloir(T, C, e) {
  if (!T.curved) return 0;
  return T.edge(e) + C.LANE_W * 0.5 - T.radius(e);
}

/** Ou en est la chute d'une haie touchee : 0 debout, 1 couchee. */
function chuteDe(touchees, e, i, G) {
  if (!touchees || !G.player || G.player.lane !== e) return 0;
  const t0 = touchees.get(i);
  if (t0 === undefined) return 0;
  return lisse(((G.elapsed || 0) - t0) / CHUTE);
}

/**
 * Une haie, dans le couloir `e`, a `h` metres de la ligne de depart.
 *
 * Tout passe par la piste : `posDemi` pour le point, avec la distance le long
 * du couloir et l'ecart en travers. Une haie du 400 m suit donc le virage
 * comme les blocs de depart, sans angle a tenir nulle part.
 *
 * Une haie touchee bascule vers l'arrivee autour du bas de ses montants : les
 * montants se couchent sur la piste et les pieds se relevent, comme sur une
 * vraie piste.
 */
function dessinerHaie(ctx, api, h, e, centre, H, chute) {
  const { G, solid, scaleM } = api;
  const T = G.track;
  const m = scaleM();
  const phi = chute * PI * 0.5, cph = Math.cos(phi), sph = Math.sin(phi);
  // (u, v, z) : le long du couloir, en travers, en hauteur.
  const P = (u, v, z) => {
    const u2 = u * cph + z * sph, z2 = -u * sph + z * cph;
    const q = T.posDemi(h + u2, e, centre + v);
    return solid(q[0], q[1], Math.max(0, z2));
  };
  const trait = (a, b, couleur, largeur) => {
    ctx.strokeStyle = couleur;
    ctx.lineWidth = largeur;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  const plaque = (a, b, c, d, couleur) => {
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fill();
  };

  ctx.save();
  ctx.lineCap = 'round';
  const epPied = Math.max(1.5, 0.05 * m);
  const epMontant = Math.max(1.5, 0.04 * m);

  // L'ombre de la barre, a plat sous elle : c'est elle qui pose la haie sur
  // la piste plutot que de la laisser flotter devant.
  if (chute < 0.5) {
    ctx.globalAlpha = 0.16 * (1 - 2 * chute);
    plaque(P(0.10, -DEMI_LARGE, 0), P(0.10, DEMI_LARGE, 0),
           P(0.26, DEMI_LARGE, 0), P(0.26, -DEMI_LARGE, 0), 'rgb(0,0,0)');
    ctx.globalAlpha = 1;
  }

  // Les pieds, puis les montants — le plus loin de la camera d'abord, soit le
  // cote exterieur du couloir.
  for (const v of [MONTANT, -MONTANT]) {
    trait(P(0, v, 0), P(-PIED, v, 0), SOL, epPied);
  }
  for (const v of [MONTANT, -MONTANT]) {
    const couleur = v > 0 ? METAL_OMBRE : METAL;
    trait(P(0, v, 0), P(0, v, H - BARRE * 0.5), couleur, epMontant);
  }

  // La barre, en bandes : claires aux deux bouts.
  let v0 = -DEMI_LARGE;
  for (let k = 0; k < BANDES.length; k++) {
    const v1 = v0 + BANDES[k];
    plaque(P(0, v0, H - BARRE), P(0, v1, H - BARRE),
           P(0, v1, H), P(0, v0, H), k % 2 ? SOMBRE : CLAIR);
    v0 = v1;
  }
  // Le fil du dessus, qui donne a la barre son epaisseur.
  trait(P(0, -DEMI_LARGE, H), P(0, DEMI_LARGE, H), 'rgba(255,255,255,0.85)',
        Math.max(1, 0.012 * m));
  ctx.restore();
}
