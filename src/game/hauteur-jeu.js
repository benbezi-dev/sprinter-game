/* ---------------------------------------------------------------------------
   JUMPER — le jeu du saut en hauteur
   ---------------------------------------------------------------------------
   Le reglement est dans `hauteur.js`. Ici vit ce qui se decide, et rien ne
   touche ni au moteur ni a l'ecran : tout ce fichier se teste dans Node
   (tools/hauteur-test.mjs).

   LE SAUT EN HAUTEUR NE SE GAGNE PAS EN COURANT PLUS VITE.

   C'est la premiere chose qu'il apprend au joueur de Sprinter, et c'est ce qui
   le separe de la longueur : l'elan se CONTROLE. Un sauteur en hauteur arrive
   sur son appel a la vitesse qu'il sait convertir en hauteur — huit metres par
   seconde chez les meilleurs —, pas a la sienne. Plus vite, la jambe d'appel
   ne tient plus et l'energie part dans le tapis de course ; moins vite, il n'y
   a rien a convertir. Le joueur module donc sa cadence, comme on regle un
   rythme, et la vitesse s'affiche en vert quand il y est.

   UN SAUT, CINQ GESTES.

     1. L'ELAN — on alterne, en J : quelques foulees droites face au tapis,
        puis la courbe, que l'athlete prend seul. On y regle sa vitesse.
     2. L'APPEL — sur le pied EXTERIEUR a la courbe, le gauche. Le pave de ce
        pied s'allume quand la barre approche ; c'est la distance de l'appel au
        plan de la barre qui se joue : trop loin, le sommet du saut tombe avant
        elle ; trop pres, on la touche en montant.
     3. L'IMPULSION — on TIENT le pave, et l'angle d'envol monte, au ralenti.
        On relache pour s'envoler. Le bon angle depend de l'appel : on voit sur
        l'eventail celui qui porte le sommet au-dessus de la barre.
     4. LA CAMBRURE — en l'air, on appuie et l'on TIENT : le dos se cambre, le
        bassin monte. Trop tot, les epaules plongent avant d'avoir passe la
        barre ; trop tard, le bassin la touche.
     5. LES JAMBES — on relache : les jambes se lancent vers le ciel. Trop tot,
        le bassin retombe sur la barre ; trop tard, les talons l'emportent.

   LE FRANCHISSEMENT SE CALCULE, IL NE SE TIRE PAS AU SORT. Le corps passe la
   barre partie par partie — les epaules, le bassin, les genoux, les talons —,
   chacune a son instant, et chacune a sa hauteur, qui depend du centre de masse
   a cet instant, de la rotation du corps et de ce que le joueur en a fait. La
   barre tombe si l'une d'elles passe dessous, et l'ecran dit laquelle. C'est ce
   qui permet a un bon franchissement de passer une barre plus haute que le
   centre de masse — et c'est tout le rouleau dorsal.
--------------------------------------------------------------------------- */

import { G as PESANTEUR_TERRE, BARRE, cm, tempsEssai, ECHECS_ELIMINATOIRES } from './hauteur.js';

const D2R = Math.PI / 180;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/* --------------------------------------------------------------- l'elan */

/**
 * LA VITESSE QUE L'ATHLETE SAIT CONVERTIR, en m/s.
 *
 * Au-dela, chaque dixieme de trop se perd — et au-dela de la moitie en plus,
 * car la jambe d'appel plie au lieu de pousser. C'est la regle qui fait que le
 * joueur ne mitraille pas : a la cadence du 100 m, il arrive a 8,8 m/s et saute
 * comme s'il en courait 7,2.
 */
export const VITESSE_JUSTE = 8.0;
export const SURVITESSE = 1.0;

/** Le plafond d'elan du moteur : assez pour se tromper par exces. */
export const VITESSE_ELAN_MAX = 9.2;

/** La vitesse utile, celle que l'appel transforme. */
export function vitesseUtile(vElan) {
  const v = Math.max(0, vElan);
  return v <= VITESSE_JUSTE ? v : Math.max(0, VITESSE_JUSTE - SURVITESSE * (v - VITESSE_JUSTE));
}

/** Ce que l'on dit d'un elan. */
export function jugerElan(vElan) {
  if (vElan > VITESSE_JUSTE + 0.45) return 'trop';
  if (vElan >= VITESSE_JUSTE - 0.35) return 'juste';
  if (vElan >= VITESSE_JUSTE - 1.0) return 'lent';
  return 'trop_lent';
}

/* ------------------------------------------------------------- l'appel */

/** De combien la pointe du pied d'appel se pose devant le centre de masse. */
export const AVANCE_PIED = 0.35;

/**
 * LA FENETRE DE L'APPEL, en metres de la pointe au plan de la barre.
 *
 * Plus loin, un appui du pied d'appel est une foulee ordinaire. Plus pres que
 * APPEL_MINI sans s'etre leve, l'athlete passe sous la barre — un echec.
 *
 * Deux metres, et pas davantage : a la cadence juste, deux appuis du pied
 * gauche sont a un metre trente l'un de l'autre, et une fenetre plus large
 * posait l'appel des le premier, a deux metres et plus, pour qui ne faisait
 * que garder son rythme. Celle-ci laisse le premier tomber pres du bon appel ;
 * le joueur qui regarde la jauge le pose dans le vert.
 */
export const APPEL_MAXI = 2.00;
export const APPEL_MINI = 0.30;

/**
 * L'ANGLE ENTRE LA COURSE ET LA BARRE, a l'appel.
 *
 * C'est ce que fait le J : l'athlete n'arrive pas face a la barre mais de
 * biais, a trente-cinq degres. Toute sa vitesse horizontale ne le porte donc
 * pas vers le tapis ; une partie le fait glisser le long de la barre, et c'est
 * pourquoi il s'envole pres d'un montant et retombe au milieu du tapis.
 */
export const BIAIS = 35;

/* ------------------------------------------------------------ l'angle */

/**
 * L'ANGLE D'ENVOL SE REGLE EN TENANT LE PAVE, comme en longueur — mais il part
 * de bien plus haut. Un sauteur en longueur s'envole a vingt degres, un sauteur
 * en hauteur a cinquante : il ne cherche pas a aller loin.
 */
export const ANGLE_MIN = 30;
export const ANGLE_MAX = 70;
export const ANGLE_PAR_S = 60;
export const RALENTI = 0.4;

export function angleDe(tenu) {
  return Math.min(ANGLE_MAX, ANGLE_MIN + ANGLE_PAR_S * Math.max(0, tenu));
}
export const TENUE_MAXI = (ANGLE_MAX - ANGLE_MIN) / ANGLE_PAR_S;

/**
 * CE QUE L'IMPULSION DONNE A LA VERTICALE, en m/s.
 *
 *     vy = forme(angle) x (1,6 + 0,39 x vitesse utile)
 *
 * La part fixe est la force de la jambe d'appel ; l'autre, ce que l'elan lui
 * apporte. C'est ce qui rend la vitesse importante sans la rendre tout : un
 * demi-metre par seconde de moins coute une dizaine de centimetres, pas trente.
 *
 * L'angle se paie de part et d'autre de 48° : plus rasant, le pied n'a pas le
 * temps de lever le corps ; plus redresse, il freine sans rien rendre. La
 * vitesse horizontale suit : c'est l'angle qui la fixe.
 */
export const ANGLE_JUSTE = 48;
const LARGEUR_ANGLE = 33;
const FORCE = 1.6, PORTEE_ELAN = 0.39;

export function impulsion(vElan, angle) {
  const f = Math.max(0.2, 1 - ((angle - ANGLE_JUSTE) / LARGEUR_ANGLE) ** 2);
  const vy = f * (FORCE + PORTEE_ELAN * vitesseUtile(vElan));
  const vh = vy / Math.tan(Math.max(20, angle) * D2R);
  return { vy, vh, vers: vh * Math.sin(BIAIS * D2R), long: vh * Math.cos(BIAIS * D2R) };
}

/* --------------------------------------------------------------- le vol */

/** La hauteur du centre de masse a l'envol : sur la pointe, bras leves. */
export const HAUTEUR_ENVOL = 1.28;
/** De combien le centre de masse a avance sur la pointe quand elle quitte le sol. */
export const DISTANCE_ENVOL = 0.25;

/**
 * LA ROTATION DU CORPS, en degres depuis la verticale, vers la barre.
 *
 * Elle nait de la courbe : l'athlete tournait deja en courant, il continue en
 * l'air. Debout a l'envol, couche sur le dos au sommet, tete en bas a la
 * reception. Elle est la meme pour tous les sauts : c'est ce qui fait qu'un
 * appel trop loin met le corps a plat avant la barre, et le bassin dessous.
 */
export const ROTATION_ENVOL = 8;
export const ROTATION_PAR_S = 140;

/**
 * Le vol du centre de masse, dans le plan perpendiculaire a la barre.
 *
 * `ecart` est la distance de la pointe au plan de la barre ; `g` la pesanteur
 * du stade — la Terre partout, sauf au stade intergalactique.
 */
export function vol(vElan, angle, ecart, g = PESANTEUR_TERRE) {
  const I = impulsion(vElan, angle);
  const x0 = -ecart + DISTANCE_ENVOL * Math.sin(BIAIS * D2R);
  const sommetT = I.vy / g;
  return {
    ...I, g, x0, ecart, angle, vElan,
    sommetT,
    sommet: HAUTEUR_ENVOL + I.vy * I.vy / (2 * g),
    x: (t) => x0 + I.vers * t,
    z: (t) => HAUTEUR_ENVOL + I.vy * t - 0.5 * g * t * t,
    rotation: (t) => (ROTATION_ENVOL + ROTATION_PAR_S * t) * D2R,
  };
}

/* ----------------------------------------------------- le franchissement */

/**
 * LE CORPS, TEL QU'IL PASSE LA BARRE : quatre reperes le long de l'axe du
 * corps, depuis le centre de masse (positif vers la tete).
 *
 *   s       la place le long du corps, en metres
 *   dos     l'epaisseur entre l'os et la peau du dos : c'est le dos qui passe
 *   cambre  ce que la cambrure leve (positif) ou abaisse ce repere
 *   jambes  ce que le lancer des jambes leve ou abaisse
 *
 * La cambrure leve le bassin et fait plonger les epaules et les genoux ; le
 * lancer des jambes leve genoux et talons et fait retomber le bassin. Tout le
 * geste est dans ces huit nombres.
 */
export const CORPS = [
  { cle: 'epaules', s: 0.45, dos: 0.10, cambre: -0.08, jambes: 0.00 },
  { cle: 'bassin', s: 0.02, dos: 0.10, cambre: 0.16, jambes: -0.20 },
  { cle: 'genoux', s: -0.42, dos: 0.06, cambre: -0.12, jambes: 0.25 },
  { cle: 'talons', s: -0.70, dos: 0.05, cambre: -0.15, jambes: 0.45 },
];

/** Le temps que met la cambrure — ou le lancer des jambes — a se faire. */
export const GESTE = 0.08;

/** La cambrure et le lancer des jambes, de 0 a 1, a l'instant `t`. */
export function gestesA(t, tCambre, tJambes) {
  const jambes = tJambes == null ? 0 : clamp01((t - tJambes) / GESTE);
  const cambre = tCambre == null ? 0 : clamp01((t - tCambre) / GESTE) * (1 - jambes);
  return { cambre, jambes };
}

/** Ou est le dos d'un repere du corps, dans le plan de la barre : [x, z]. */
export function repere(V, p, t, tCambre, tJambes) {
  const { cambre, jambes } = gestesA(t, tCambre, tJambes);
  const d = p.dos - p.cambre * cambre - p.jambes * jambes;
  const r = V.rotation(t);
  return [V.x(t) + p.s * Math.sin(r) + d * Math.cos(r), V.z(t) + p.s * Math.cos(r) - d * Math.sin(r)];
}

/**
 * Le passage de chaque repere au-dessus du plan de la barre : l'instant, et la
 * hauteur de son dos a cet instant.
 */
export function passages(V, tCambre = null, tJambes = null, pas = 0.002) {
  const out = [];
  for (const p of CORPS) {
    let prev = repere(V, p, 0, tCambre, tJambes);
    if (prev[0] >= 0) { out.push({ cle: p.cle, t: 0, z: prev[1] }); continue; }
    let trouve = null;
    for (let t = pas; t < 2.5; t += pas) {
      const q = repere(V, p, t, tCambre, tJambes);
      if (q[0] >= 0) {
        const u = -prev[0] / (q[0] - prev[0]);
        trouve = { cle: p.cle, t: t - pas + u * pas, z: prev[1] + u * (q[1] - prev[1]) };
        break;
      }
      prev = q;
    }
    // Jamais arrive au plan de la barre : le corps retombe de ce cote-ci, et
    // la barre n'est pas franchie. Rien ne se passe sans passer.
    out.push(trouve || { cle: p.cle, t: null, z: -Infinity });
  }
  return out;
}

/** Le rayon de la barre : c'est son dessus qui est a la hauteur annoncee. */
const RAYON = BARRE.diametre / 2;

/**
 * La barre la plus haute que ce saut passe, et la partie du corps qui la
 * limite.
 */
export function plafond(V, tCambre, tJambes) {
  const ps = passages(V, tCambre, tJambes);
  let pire = ps[0];
  for (const p of ps) if (p.z < pire.z) pire = p;
  return { h: pire.z - RAYON, par: pire.cle, passages: ps };
}

/**
 * LES BONS INSTANTS, pour ce vol : ceux de la cambrure et des jambes.
 *
 * La cambrure doit etre faite quand le bassin passe, et commencee apres les
 * epaules ; les jambes lancees apres le bassin, et hautes quand les genoux
 * passent. On vise le milieu de chacune de ces fenetres — c'est ce que la
 * jauge du pave montre, et ce que la note juge.
 */
export function instantsJustes(V) {
  const ps = passages(V, null, null);
  const t = (k) => ps.find((p) => p.cle === k).t;
  const tE = t('epaules'), tB = t('bassin'), tG = t('genoux');
  if (tB == null) return { cambre: null, jambes: null, fenetres: null };
  const c0 = tE == null ? tB - 2 * GESTE : tE, c1 = tB - GESTE;
  const j0 = tB, j1 = (tG == null ? tB + 3 * GESTE : tG) - GESTE;
  const cambre = c1 > c0 ? (c0 + c1) / 2 : c1;
  const jambes = j1 > j0 ? (j0 + j1) / 2 : j0;
  return { cambre, jambes, fenetres: { cambre: [c0, Math.max(c0, c1)], jambes: [j0, Math.max(j0, j1)] } };
}

/**
 * La barre la plus haute qu'un appel et un angle permettent, franchissement
 * parfait. C'est ce qui colore l'eventail de l'angle.
 */
export function plafondParfait(vElan, angle, ecart, g) {
  const V = vol(vElan, angle, ecart, g);
  const j = instantsJustes(V);
  return plafond(V, j.cambre, j.jambes).h;
}

/**
 * LE BON ANGLE, POUR L'APPEL QU'ON VIENT DE POSER.
 *
 * Le pied est deja au sol quand l'angle se regle : on ne peut plus rien a la
 * distance, et l'angle juste est celui qui porte le sommet au-dessus de la
 * barre depuis la. Trop loin, il faut s'envoler plus rasant ; trop pres, plus
 * redresse. Rend l'angle et la barre qu'il passe au mieux.
 */
export function meilleurAngle(vElan, ecart, g) {
  let best = { angle: ANGLE_JUSTE, h: -Infinity };
  for (let a = ANGLE_MIN; a <= ANGLE_MAX; a += 1) {
    const h = plafondParfait(vElan, a, ecart, g);
    if (h > best.h) best = { angle: a, h };
  }
  // un demi-degre de finesse autour du meilleur entier
  for (const a of [best.angle - 0.5, best.angle + 0.5]) {
    const h = plafondParfait(vElan, a, ecart, g);
    if (h > best.h) best = { angle: a, h };
  }
  return best;
}

/**
 * LA BONNE DISTANCE D'APPEL, pour la jauge du pave : celle qui porte le
 * sommet du saut parfait au-dessus de la barre, a cette vitesse.
 *
 * Elle grandit avec la vitesse utile — un athlete plus rapide va plus loin
 * avant d'atteindre son sommet —, et avec une pesanteur plus faible. La
 * recherche exhaustive (tools/hauteur-test.mjs) la trouve a quelques
 * centimetres de cette droite, dans un plateau de trente centimetres de large.
 */
export function ecartJuste(vElan, g = PESANTEUR_TERRE) {
  const u = vitesseUtile(vElan) - 6;
  const terre = 0.85 + 0.25 * u, station = 1.35 + 0.20 * u;
  const k = clamp01((PESANTEUR_TERRE - g) / (PESANTEUR_TERRE - 7.5));
  return Math.max(0.5, terre + (station - terre) * k);
}

/** Ce que l'on dit de la cambrure ou du lancer des jambes. */
export function jugerGeste(t, juste, fenetre) {
  if (t == null) return 'sans';
  const e = t - juste;
  const demi = fenetre ? Math.max(0.02, (fenetre[1] - fenetre[0]) / 2) : 0.03;
  if (Math.abs(e) <= demi * 0.5 + 0.012) return 'parfait';
  if (Math.abs(e) <= demi + 0.03) return 'bon';
  return e < 0 ? 'tot' : 'tard';
}

/* ----------------------------------------------------- la barre, touchee */

/**
 * UNE BARRE EFFLEUREE PEUT RESTER.
 *
 * Au-dessus de la marge, le dos passe sans la toucher. Juste au-dessus, il
 * l'effleure : elle tremble sur ses taquets, et tient. Juste en dessous, elle
 * saute sur ses taquets et retombe — ou pas : c'est le seul endroit ou le jeu
 * laisse le hasard parler, parce que c'est le seul ou le stade entier retient
 * son souffle. Plus bas, elle tombe.
 */
export const EFFLEURE = 0.010;
export const HESITE = 0.012;

export function sortDeLaBarre(marge, alea = Math.random) {
  if (marge >= EFFLEURE) return { tombe: false, tremble: false };
  if (marge >= 0) return { tombe: false, tremble: true };
  if (marge >= -HESITE) {
    const p = Math.pow(-marge / HESITE, 0.7);
    return { tombe: alea() < p, tremble: true };
  }
  return { tombe: true, tremble: false };
}

/* ------------------------------------------------------------- un saut */

/**
 * UN SAUT, du geste au verdict.
 *
 *   vElan     la vitesse d'elan sur les derniers metres, en m/s
 *   ecart     de la pointe du pied d'appel au plan de la barre, en metres
 *   angle     l'angle d'envol, en degres
 *   tCambre   l'instant de la cambrure apres l'envol (null : jamais)
 *   tJambes   l'instant du lancer des jambes (null : jamais)
 *   hauteur   la barre, en metres
 *   g         la pesanteur du stade
 *
 * Rend toujours le meme objet, franchi ou non : l'ecran doit pouvoir dire
 * quelle partie du corps a fait tomber la barre, et de combien.
 */
export function sauter({ vElan, ecart, angle, tCambre = null, tJambes = null, hauteur,
                         g = PESANTEUR_TERRE, alea = Math.random }) {
  const V = vol(vElan, angle, ecart, g);
  const P = plafond(V, tCambre, tJambes);
  const marge = P.h - hauteur;
  const sort = sortDeLaBarre(marge, alea);
  const j = instantsJustes(V);
  // L'instant ou la barre est touchee : quand la partie fautive la passe.
  const fautif = P.passages.find((p) => p.cle === P.par);
  return {
    franchi: !sort.tombe, tremble: sort.tremble, marge, plafond: P.h, par: P.par,
    tContact: fautif ? fautif.t : null, passages: P.passages,
    vElan, ecart, angle, hauteur, vol: V,
    elan: jugerElan(vElan),
    cambre: jugerGeste(tCambre, j.cambre, j.fenetres && j.fenetres.cambre),
    jambes: jugerGeste(tJambes, j.jambes, j.fenetres && j.fenetres.jambes),
    justes: j,
  };
}

/* --------------------------------------------------------- le concours */

/**
 * LES SIX ETAPES, les memes que Sprinter et dans le meme ordre (levelName).
 *
 * `niveaux` : la barre qu'un adversaire passe un bon jour, du plus faible au
 * plus fort. `barres` : la montee annoncee, qui respecte la regle — jamais
 * moins de deux centimetres, et un ecart qui ne grandit jamais. Au-dela de la
 * derniere, la barre monte de deux centimetres.
 *
 * Le record du monde se passe avec tout : l'elan juste, l'appel a la bonne
 * distance, l'angle et les deux gestes en l'air. Au stade intergalactique, la
 * pesanteur de la station — les trois quarts de celle de la Terre — emmene
 * les ZEZE ou aucun humain n'est jamais alle.
 */
export const PLATEAU = [
  { niveaux: [1.45, 1.80], barres: [1.30, 1.35, 1.40, 1.45, 1.50, 1.55, 1.59, 1.63, 1.67, 1.70, 1.73, 1.76, 1.79, 1.81, 1.83] },
  { niveaux: [1.84, 2.06], barres: [1.70, 1.75, 1.80, 1.85, 1.89, 1.93, 1.96, 1.99, 2.02, 2.05, 2.07, 2.09] },
  { niveaux: [2.08, 2.25], barres: [1.95, 2.00, 2.05, 2.09, 2.13, 2.16, 2.19, 2.22, 2.25, 2.27, 2.29] },
  { niveaux: [2.24, 2.36], barres: [2.14, 2.19, 2.23, 2.27, 2.30, 2.33, 2.36, 2.38, 2.40, 2.42, 2.44] },
  { niveaux: [2.30, 2.42], barres: [2.18, 2.22, 2.26, 2.29, 2.32, 2.35, 2.37, 2.39, 2.41, 2.43, 2.45] },
  { niveaux: [2.48, 2.64], barres: [2.35, 2.40, 2.45, 2.49, 2.53, 2.56, 2.59, 2.62, 2.64, 2.66, 2.68, 2.70] },
];

/** La pesanteur de chaque etape : la Terre, puis la station intergalactique. */
export const PESANTEUR = [9.81, 9.81, 9.81, 9.81, 9.81, 7.5];
export function pesanteurDe(etape) {
  return PESANTEUR[Math.max(0, Math.min(5, etape | 0))];
}

/** Combien de sauteurs en finale. Douze aux grands championnats. */
export const CONCURRENTS = [8, 8, 8, 12, 12, 8];

/**
 * LA REUSSITE D'UN ADVERSAIRE, a une hauteur : une chance sur deux a sa forme
 * du jour, presque sur cinq centimetres en dessous, presque jamais cinq
 * au-dessus. C'est un essai, pas une moyenne.
 */
export const DISPERSION = 0.016;
export function chanceAdversaire(forme, h) {
  return 1 / (1 + Math.exp(-(forme - h) / DISPERSION));
}

/** La barre suivante : celle du programme, ou deux centimetres de plus. */
export function barreApres(c, i) {
  const b = c.barres;
  if (i + 1 < b.length) return b[i + 1];
  return Math.round((b[b.length - 1] + 0.02 * (i + 2 - b.length)) * 100) / 100;
}

/** La barre du rang `i` dans le programme. */
export function barreDu(c, i) {
  if (i < c.barres.length) return c.barres[i];
  return Math.round((c.barres[c.barres.length - 1] + 0.02 * (i + 1 - c.barres.length)) * 100) / 100;
}

/**
 * Un concours neuf. L'ordre de passage est tire au sort.
 *
 * Chaque adversaire a un niveau, une forme du jour autour de lui, et une
 * barre d'entree : il passe les premieres, comme les meilleurs le font.
 */
export function nouveauConcours({ etape, noms, alea = Math.random, joueur = 'TOI' }) {
  const e = Math.max(0, Math.min(5, etape | 0));
  const P = PLATEAU[e];
  const [lo, hi] = P.niveaux;
  const n = Math.min(CONCURRENTS[e], noms.length + 1);
  const athletes = [{ nom: joueur, joueur: true, niveau: 0, forme: 0, entree: 0, feuille: {}, suite: 0, elimine: false, arrete: false }];
  for (let i = 0; i < n - 1; i++) {
    const niveau = lo + alea() * (hi - lo);
    const forme = niveau + (alea() + alea() + alea() - 1.5) * 0.02;
    // il entre entre dix et vingt centimetres sous son niveau
    const entree = niveau - 0.10 - alea() * 0.10;
    athletes.push({ nom: noms[i], joueur: false, niveau, forme, entree, feuille: {}, suite: 0, elimine: false, arrete: false });
  }
  const ordre = athletes.map((_, i) => i);
  for (let i = ordre.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  }
  const c = {
    etape: e, g: pesanteurDe(e), barres: P.barres.slice(), athletes, ordre,
    i: 0,            // le rang de la barre dans le programme
    h: P.barres[0],  // la barre
    manche: 1,       // premier, deuxieme ou troisieme essai a cette barre
    rang: 0,         // dans l'ordre de passage
    fini: false, libre: false, dernierSauteur: null,
    barrage: null, partage: null, departage: null,
  };
  return c;
}

/** Ce qu'un athlete a fait a une barre : « xo », « xx- », « o »… */
export function aLaBarre(a, h) {
  return a.feuille[cm(h)] || '';
}

/** Les barres d'un athlete, dans l'ordre. */
function barresDe(a) {
  return Object.keys(a.feuille).map(Number).sort((x, y) => x - y);
}

/** La plus haute barre franchie, en metres, ou 0. */
export function meilleur(a) {
  let m = 0;
  for (const k of barresDe(a)) if (a.feuille[k].includes('o')) m = k / 100;
  return m;
}

/** Les essais a la meilleure barre, et les echecs jusqu'a elle incluse. */
export function departage(a) {
  const m = cm(meilleur(a));
  if (!m) return { essais: 0, echecs: 0 };
  const f = a.feuille[m];
  const essais = f.indexOf('o') + 1;
  let echecs = 0;
  for (const k of barresDe(a)) if (k <= m) echecs += (a.feuille[k].match(/x/g) || []).length;
  return { essais, echecs };
}

/**
 * COMPARER DEUX ATHLETES (TR 26.8) : la plus haute barre ; a egalite, le moins
 * d'essais a cette barre ; puis le moins d'echecs sur tout le concours jusqu'a
 * elle. Negatif si `a` est devant, zero s'ils sont ex aequo.
 */
export function devant(a, b) {
  const ma = meilleur(a), mb = meilleur(b);
  if (cm(ma) !== cm(mb)) return mb - ma;
  if (!ma) return 0;
  const da = departage(a), db = departage(b);
  if (da.essais !== db.essais) return da.essais - db.essais;
  return da.echecs - db.echecs;
}

/**
 * Le classement : chaque athlete avec sa place. Deux ex aequo partagent la
 * meme ; pour la premiere, un barrage les a departages, ou ils l'ont partagee.
 */
export function classement(c) {
  const rangBarrage = (i) => {
    if (!c.departage) return 0;
    const k = c.departage.indexOf(i);
    return k < 0 ? 0 : k + 1;
  };
  const l = c.athletes.map((a, i) => ({ i, a }))
    .sort((x, y) => devant(x.a, y.a) || (rangBarrage(x.i) && rangBarrage(y.i) ? rangBarrage(x.i) - rangBarrage(y.i) : 0) || x.i - y.i);
  let place = 0;
  return l.map((x, k) => {
    const prec = l[k - 1];
    const egal = k > 0 && devant(prec.a, x.a) === 0 && !(rangBarrage(prec.i) && rangBarrage(x.i) && rangBarrage(prec.i) !== rangBarrage(x.i));
    if (!egal) place = k + 1;
    return {
      index: x.i, nom: x.a.nom, joueur: x.a.joueur, meilleur: meilleur(x.a), place,
      feuille: x.a.feuille, elimine: x.a.elimine, ...departage(x.a),
    };
  });
}

/** Encore en concours : ni elimine, ni arrete. */
export function enLice(a) {
  return !a.elimine && !a.arrete;
}
export function combienEnLice(c) {
  return c.athletes.filter(enLice).length;
}

/**
 * L'athlete saute-t-il encore a la barre courante ? Il y a deja franchi,
 * l'a passee, ou y a epuise ses essais : non.
 */
function aSauter(c, a) {
  if (!enLice(a)) return false;
  const f = aLaBarre(a, c.h);
  if (f.includes('o') || f.includes('-')) return false;
  return f.length < ECHECS_ELIMINATOIRES && a.suite < ECHECS_ELIMINATOIRES;
}

/** Celui dont c'est le tour a cette manche, ou null quand la manche est finie. */
function prochainDeLaManche(c) {
  for (; c.rang < c.ordre.length; c.rang++) {
    const i = c.ordre[c.rang];
    const a = c.athletes[i];
    // a la manche n, on saute son n-ieme essai de la barre
    if (aSauter(c, a) && aLaBarre(a, c.h).length === c.manche - 1) return i;
  }
  return null;
}

/**
 * QUI SAUTE MAINTENANT : l'index de l'athlete, ou null quand le concours est
 * fini. Fait avancer la manche, puis la barre, quand plus personne n'a rien a y
 * faire.
 */
export function aQui(c) {
  if (c.fini) return null;
  if (c.barrage) return aQuiBarrage(c);
  for (let garde = 0; garde < 400; garde++) {
    const i = prochainDeLaManche(c);
    if (i !== null) return i;
    // la manche est finie : la suivante, a la meme barre
    if (c.manche < ECHECS_ELIMINATOIRES && c.athletes.some((a) => aSauter(c, a) && aLaBarre(a, c.h).length === c.manche)) {
      c.manche++; c.rang = 0;
      continue;
    }
    // la barre est finie
    if (!barreSuivante(c)) return null;
  }
  return null;
}

/**
 * LA BARRE MONTE. Rend faux si le concours est fini.
 *
 * Personne en lice : fini. Un seul, et il a gagne : c'est lui qui choisit
 * (c.libre) — le joueur a l'ecran, un adversaire en montant de deux
 * centimetres. Sinon, la barre suivante du programme.
 */
function barreSuivante(c) {
  const restants = c.athletes.map((a, i) => i).filter((i) => enLice(c.athletes[i]));
  if (!restants.length) { terminer(c); return false; }
  if (restants.length === 1) {
    const i = restants[0];
    const cl = classement(c);
    const premier = cl[0];
    const gagne = premier.index === i && (cl.length < 2 || cl[1].place > 1 || cl[1].meilleur < premier.meilleur);
    if (gagne) c.libre = true;
  }
  c.i++;
  // Seul et vainqueur : deux centimetres de plus, que le joueur peut changer
  // (choisirBarre). Sinon, la barre suivante du programme.
  c.h = c.libre ? Math.round((c.h + 0.02) * 100) / 100 : barreDu(c, c.i);
  c.manche = 1; c.rang = 0;
  return true;
}

/** Le joueur, seul et vainqueur, choisit sa barre. */
export function choisirBarre(c, h) {
  c.h = Math.round(h * 100) / 100;
  c.manche = 1; c.rang = 0;
}

/**
 * INSCRIRE UN ESSAI : 'o' franchi, 'x' manque, '-' passe (le reste de la
 * barre). Trois echecs de suite eliminent.
 */
export function inscrire(c, i, essai) {
  const a = c.athletes[i];
  const k = cm(c.h);
  a.feuille[k] = (a.feuille[k] || '') + essai;
  if (essai === 'o') a.suite = 0;
  if (essai === 'x') {
    a.suite++;
    if (a.suite >= ECHECS_ELIMINATOIRES) a.elimine = true;
  }
  c.dernierSauteur = i;
  c.rang++;
}

/** Le joueur, seul et vainqueur, s'arrete la. */
export function arreter(c, i) {
  c.athletes[i].arrete = true;
}

/**
 * L'ADVERSAIRE DECIDE, puis saute : il passe les barres sous son entree, et
 * parfois, apres un echec pres de sa limite, il garde ses essais pour la
 * suivante. Rend 'o', 'x' ou '-'.
 */
export function essaiAdversaire(c, i, alea = Math.random) {
  const a = c.athletes[i];
  const f = aLaBarre(a, c.h);
  // Tant qu'il n'a rien tente, il passe les barres sous son entree. Une barre
  // passee s'inscrit « - » : c'est un essai tente qui le fait entrer.
  const entre = Object.values(a.feuille).some((x) => /[ox]/.test(x));
  if (!entre && c.h < a.entree - 1e-9 && !c.libre) return '-';
  if (f === 'x' && a.suite === 1 && c.h >= a.forme - 0.03 && !c.libre && alea() < 0.15) return '-';
  return alea() < chanceAdversaire(a.forme, c.h) ? 'o' : 'x';
}

/**
 * Faire sauter les adversaires jusqu'au tour du joueur (ou a la fin). Rend ce
 * qui s'est passe, dans l'ordre : l'ecran le deroule.
 */
export function avancerJusquAuJoueur(c, alea = Math.random) {
  const faits = [];
  for (let garde = 0; garde < 2000; garde++) {
    const i = aQui(c);
    if (i === null) break;
    const a = c.athletes[i];
    if (a.joueur) break;
    const h = c.h;
    const essai = c.barrage ? essaiBarrageAdversaire(c, i, alea) : essaiAdversaire(c, i, alea);
    if (c.barrage) inscrireBarrage(c, i, essai);
    else inscrire(c, i, essai);
    faits.push({ index: i, nom: a.nom, h, essai, barrage: !!c.barrage || undefined });
  }
  return faits;
}

/** Le joueur est-il encore en lice ? */
export function joueurEnLice(c) {
  if (c.fini) return false;
  const j = c.athletes.find((a) => a.joueur);
  if (c.barrage) return c.barrage.en.includes(c.athletes.indexOf(j));
  return enLice(j);
}

/** La place du joueur. */
export function placeDuJoueur(c) {
  const x = classement(c).find((l) => l.joueur);
  return x ? x.place : null;
}

/** Le temps accorde au joueur pour l'essai qu'on lui demande. */
export function tempsDuJoueur(c) {
  const j = c.athletes.findIndex((a) => a.joueur);
  return tempsEssai(combienEnLice(c), c.dernierSauteur === j);
}

/** Le joueur saute-t-il deux fois de suite ? */
export function consecutif(c) {
  return c.dernierSauteur === c.athletes.findIndex((a) => a.joueur);
}

/* ------------------------------------------------ la fin, et le barrage */

/**
 * LE CONCOURS EST FINI. Si plusieurs athletes sont encore ex aequo pour la
 * premiere place apres le departage, le reglement les envoie au barrage — a
 * moins qu'ils ne decident ensemble de partager le titre, ce que la regle
 * permet depuis Tokyo. Le joueur en decide (c.partage attend sa reponse) ; entre
 * adversaires, ils partagent.
 */
function terminer(c) {
  const cl = classement(c);
  const premiers = cl.filter((l) => l.place === 1 && l.meilleur > 0);
  if (premiers.length > 1 && !c.departage && premiers.some((l) => l.joueur)) {
    c.partage = { en: premiers.map((l) => l.index), h: premiers[0].meilleur };
    return;
  }
  c.fini = true;
}

/** Le joueur a choisi : partager le titre, ou le barrage. */
export function deciderPartage(c, barrage) {
  const p = c.partage;
  if (!p) return;
  c.partage = null;
  if (!barrage) { c.fini = true; return; }
  // La premiere barre du barrage est la suivante du programme, au-dessus de
  // la derniere que les ex aequo ont passee.
  let k = 0;
  while (barreDu(c, k) <= p.h + 1e-9 && k < 200) k++;
  const h = barreDu(c, k);
  c.barrage = { en: p.en.slice(), h, faits: {}, rang: 0, tour: 1, sorts: [] };
  c.h = h;
}

/**
 * LE BARRAGE (TR 26.9) : un essai chacun a la barre au-dessus de celle qui les
 * a laisses ex aequo. Seul a passer : il gagne. Tous passent : la barre monte de
 * deux centimetres ; personne : elle descend d'autant. Ceux qui manquent quand
 * un autre passe sont departages derriere lui.
 */
function aQuiBarrage(c) {
  const b = c.barrage;
  const ordre = c.ordre.filter((i) => b.en.includes(i));
  while (b.rang < ordre.length) {
    const i = ordre[b.rang];
    if (b.faits[i] === undefined) return i;
    b.rang++;
  }
  // tout le monde a saute a cette barre
  const passes = b.en.filter((i) => b.faits[i] === 'o');
  const restent = passes.length ? passes : b.en;
  // ceux qui ont manque derriere ceux qui ont passe, dans l'ordre ou ils sortent
  const sortis = b.en.filter((i) => !restent.includes(i));
  b.sorts = [...sortis, ...b.sorts];
  if (restent.length === 1) {
    c.departage = [restent[0], ...b.sorts];
    c.barrage = null;
    c.fini = true;
    return null;
  }
  b.en = restent;
  b.h = Math.round((b.h + (passes.length ? 0.02 : -0.02)) * 100) / 100;
  c.h = b.h;
  b.faits = {};
  b.rang = 0;
  b.tour++;
  return aQuiBarrage(c);
}

function inscrireBarrage(c, i, essai) {
  c.barrage.faits[i] = essai;
  c.barrage.rang++;
  c.dernierSauteur = i;
}

/** L'essai du joueur au barrage. */
export function inscrireJoueur(c, essai) {
  const i = c.athletes.findIndex((a) => a.joueur);
  if (c.barrage) inscrireBarrage(c, i, essai);
  else inscrire(c, i, essai);
}

function essaiBarrageAdversaire(c, i, alea) {
  return alea() < chanceAdversaire(c.athletes[i].forme, c.h) ? 'o' : 'x';
}
