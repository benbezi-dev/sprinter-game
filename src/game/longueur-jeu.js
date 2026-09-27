/* ---------------------------------------------------------------------------
   JUMPER — le jeu du saut en longueur
   ---------------------------------------------------------------------------
   Le reglement est dans `longueur.js`. Ici vit ce qui se decide, et rien ne
   touche ni au moteur ni a l'ecran : tout ce fichier se teste dans Node
   (tools/longueur-test.mjs).

   UN SAUT, QUATRE GESTES, ET PAS UN DE PLUS.

   Sprinter tient sur l'alternance de deux pouces ; Hurdlers y ajoute l'appel
   sur le pave. Le saut en longueur reprend ce vocabulaire tel quel, parce que
   c'est le meme athlete qui court :

     1. L'ELAN — on alterne, comme au 100 m. La vitesse a la planche est la
        premiere chose que le saut rend : la portee va comme son carre.
     2. L'APPEL — dans le dernier metre, un appui pose le pied d'appel. Au-dela
        de la ligne, l'essai est mordu ; avant, il compte, mais on perd tout ce
        qui separe la pointe de la ligne, puisque la mesure part de la ligne.
     3. L'IMPULSION — on TIENT le pave, et l'angle d'envol monte. On relache
        pour quitter la planche. Trop tot, le saut est rasant ; trop tard, on
        a ecrase son appel et la vitesse est partie dans le sol.
     4. LE RAMENE — en l'air, les deux pouces ensemble ramenent les deux
        jambes devant. Trop tot, on s'assoit dans le sable derriere ses
        talons ; trop tard, les pieds tombent sous le bassin.

   Entre l'impulsion et le ramene, des appuis alternes font pedaler l'athlete
   en l'air — le ciseau. Il n'est pas obligatoire, un saut en suspension reste
   un saut ; mais il equilibre le vol, et la fenetre du ramene s'en elargit.
--------------------------------------------------------------------------- */

import { G, FOSSE, ESSAIS, marque } from './longueur.js';

/* ------------------------------------------------------------- l'appel */

/**
 * De combien la pointe du pied d'appel se pose DEVANT le centre de masse, en
 * metres, a l'instant ou le pied touche.
 *
 * C'est l'instant que le joueur choisit : son appui pose le pied. Le moteur,
 * lui, sait ou est le corps ; le pied est un peu plus loin, et c'est le pied
 * que le juge regarde.
 */
export const AVANCE_PIED = 0.35;

/**
 * La fenetre de l'appel, en metres de la pointe a la ligne.
 *
 * Plus loin, un appui est une foulee ordinaire. C'est ce qui rend a la cadence
 * son role, exactement comme aux haies : un joueur qui mitraille pose son
 * appel au premier appui entre dans la fenetre, donc a une soixantaine de
 * centimetres de la ligne en moyenne — un saut valable, et une soixantaine de
 * centimetres jetes. Celui qui cale son dernier appui gagne tout cela.
 */
export const APPEL_MAXI = 1.20;

/** Ce que l'on dit d'un appel, de la pointe a la ligne. */
export function jugerPlanche(ecart) {
  if (ecart < 0) return 'mordu';
  if (ecart <= 0.20) return 'planche';     // le pied est sur la planche
  if (ecart <= 0.45) return 'proche';
  return 'loin';
}

/* ------------------------------------------------------------ l'angle */

/**
 * L'ANGLE D'ENVOL SE REGLE EN TENANT LE PAVE.
 *
 * Il part de ANGLE_MIN a l'instant ou le pied touche, et monte de
 * ANGLE_PAR_S degres par seconde de maintien, comptee sur l'horloge du
 * JOUEUR et non sur celle du monde : le monde, lui, passe au ralenti (voir
 * RALENTI). Le joueur a donc sous le doigt trois dixiemes de seconde pour un
 * contact qui en dure douze centiemes sur une vraie piste — et c'est bien ce
 * qu'il voit : trois dixiemes de ralenti.
 */
export const ANGLE_MIN = 8;
export const ANGLE_MAX = 40;
export const ANGLE_PAR_S = 42;

/**
 * Le monde ralentit pendant l'impulsion.
 *
 * Un appel dure douze centiemes. A vitesse reelle, le relacher au bon degre
 * demanderait une precision de dix millisecondes, et le jeu ne mesurerait plus
 * que le hasard. Au ralenti — le ralenti de la television, celui qu'on regarde
 * sur tous les sauts — le meme geste en prend trois dixiemes : assez pour
 * viser, pas assez pour hesiter.
 */
export const RALENTI = 0.4;

/** L'angle atteint apres `tenu` secondes de maintien, sur l'horloge du joueur. */
export function angleDe(tenu) {
  const a = ANGLE_MIN + ANGLE_PAR_S * Math.max(0, tenu);
  return Math.min(ANGLE_MAX, a);
}

/** Le maintien le plus long, au-dela duquel le pied quitte la planche seul. */
export const TENUE_MAXI = (ANGLE_MAX - ANGLE_MIN) / ANGLE_PAR_S;

/**
 * CE QUE L'IMPULSION COUTE EN VITESSE HORIZONTALE, en part de la vitesse
 * d'elan.
 *
 * C'est la constante qui fait tout le jeu de l'angle. Un projectile nu part au
 * mieux a 45° ; un sauteur jamais. Pour se lever, il plante son pied devant
 * lui et freine : plus il cherche la hauteur, plus il laisse de vitesse dans
 * la planche, et la perte croit plus vite que l'angle. Les mesures sur les
 * finales donnent des envols de 18 a 24°, et c'est cette courbe-la qui les
 * rend justes : le modele les retrouve de lui-meme, sans qu'on les lui dise.
 *
 *     perte = 4 % + 0,35 % x (angle - 10°) ^ 1,5
 *
 * Mesure sur ce modele, a 11 m/s d'elan (tools/longueur-test.mjs) :
 *
 *     10°  ->  -1,6 m     rasant : le vol n'a pas le temps d'exister
 *     15°  ->  -0,5 m
 *     21°  ->  optimum    9,1 m/s a l'horizontale, 3,5 m/s a la verticale
 *     27°  ->  -0,4 m
 *     33°  ->  -1,8 m     cloche : la vitesse est restee dans la planche
 *
 * L'angle pese donc autant que la planche, et c'est voulu : cinq degres de
 * trop coutent ce que coutent quarante centimetres d'appel manque.
 */
export function perteImpulsion(angle) {
  return 0.04 + 0.0035 * Math.pow(Math.max(0, angle - 10), 1.5);
}

/* --------------------------------------------------------------- le vol */

/**
 * Les hauteurs du centre de masse, en metres : a l'envol, pointe du pied
 * encore au sol et genou libre leve ; a la reception, talons dans le sable et
 * jambes tendues devant. La difference est un gain de vol que la balistique
 * doit compter — c'est pourquoi l'optimum n'est pas a 45°, ni meme a 30°.
 */
export const HAUTEUR_ENVOL = 1.25;
export const HAUTEUR_RECEPTION = 0.55;

/**
 * La distance d'envol : de combien le centre de masse est deja devant la
 * pointe quand elle quitte la planche.
 */
export const DISTANCE_ENVOL = 0.25;

/**
 * Le vol du centre de masse : ses deux vitesses, sa duree, sa longueur.
 *
 * De la balistique, sans air : a 9 m/s sur huit metres, la trainee d'un corps
 * humain retire de l'ordre du centimetre, sous la precision de la mesure.
 */
export function vol(vElan, angle) {
  // La perte porte sur l'HORIZONTALE : c'est elle que la planche freine. La
  // verticale est ce que l'impulsion en tire, a l'angle choisi.
  const vx = Math.max(0, vElan) * (1 - perteImpulsion(angle));
  const vy = vx * Math.tan(angle * Math.PI / 180);
  const dh = HAUTEUR_ENVOL - HAUTEUR_RECEPTION;
  const duree = (vy + Math.sqrt(vy * vy + 2 * G * dh)) / G;
  return { vx, vy, duree, longueur: vx * duree, sommet: HAUTEUR_ENVOL + vy * vy / (2 * G) };
}

/** La hauteur du centre de masse `t` secondes apres l'envol. */
export function hauteurA(v, t) {
  return HAUTEUR_ENVOL + v.vy * t - 0.5 * G * t * t;
}

/* ------------------------------------------------------------ le ramene */

/**
 * LE RAMENE, et ce qu'il rend a la reception.
 *
 * Le juge mesure la trace LA PLUS PROCHE de la ligne. Des talons qui
 * touchent loin devant le bassin gagnent donc tout ce qu'ils avancent — un
 * demi-metre chez les meilleurs — a condition que le corps passe ensuite
 * au-dessus d'eux. S'il retombe en arriere, c'est la marque des fesses, ou
 * celle d'une main, qui compte.
 *
 * Le moment juste est une affaire de trois dixiemes : c'est le temps que
 * mettent deux jambes a se tendre devant. On le vise en temps de jeu restant
 * avant le contact, a l'instant ou les deux pouces sont baisses.
 */
export const RAMENE_VISE = 0.30;
/** La tolerance, en secondes de part et d'autre. Le ciseau l'elargit. */
export const RAMENE_TOLERANCE = 0.07;
export const CISEAU_TOLERANCE = 1.4;
/** Le nombre d'appuis alternes en l'air qui font un ciseau. */
export const CISEAU_APPUIS = 2;

/** Ce que les talons gagnent devant le centre de masse, selon le ramene. */
export const RECEPTION = {
  parfait: 0.55, bon: 0.45,
  sans: 0.05,              // jamais ramene : les pieds sous le bassin
  plancherTard: 0.08,
  plancherTot: -0.30,      // assis en arriere, la marque est derriere
};

/**
 * Le ramene, note. `avance` est le temps restant avant le contact quand les
 * deux pouces sont baisses (null s'ils ne l'ont jamais ete).
 */
export function jugerRamene(avance, ciseau = false) {
  if (avance == null) return { note: 'sans', gain: RECEPTION.sans, ecart: null };
  const tol = RAMENE_TOLERANCE * (ciseau ? CISEAU_TOLERANCE : 1);
  const e = avance - RAMENE_VISE;
  if (Math.abs(e) <= tol * 0.5) return { note: 'parfait', gain: RECEPTION.parfait, ecart: e };
  if (Math.abs(e) <= tol) return { note: 'bon', gain: RECEPTION.bon, ecart: e };
  if (e > 0) {
    const gain = Math.max(RECEPTION.plancherTot, RECEPTION.bon - (e - tol) * 3.0);
    return { note: gain < 0 ? 'assis' : 'tot', gain, ecart: e };
  }
  const gain = Math.max(RECEPTION.plancherTard, RECEPTION.bon - (-e - tol) * 1.6);
  return { note: 'tard', gain, ecart: e };
}

/* --------------------------------------------------------------- le vent */

/**
 * Ce que le vent ajoute, en metres par m/s de vent favorable.
 *
 * Un vent arriere porte l'elan plus qu'il ne porte le vol : les estimations
 * publiees donnent une dizaine de centimetres pour +2 m/s sur un saut de huit
 * metres. On le proportionne au saut — le meme vent porte moins un enfant de
 * cinq metres qu'un finaliste.
 */
export const VENT_PAR_MS = 0.05;

/** Un vent de concours : le plus souvent faible et favorable. */
export function tirerVent(alea) {
  // somme de trois tirages : une cloche, pas une planche
  const u = (alea() + alea() + alea()) / 3;
  return Math.round((0.5 + (u - 0.5) * 5.2) * 10) / 10;
}

/* ------------------------------------------------------------- un saut */

/**
 * UN SAUT, du geste a la marque.
 *
 *   vElan   la vitesse d'elan sur les derniers metres, en m/s
 *   ecart   de la pointe du pied d'appel a la ligne, en metres (negatif : mordu)
 *   angle   l'angle d'envol, en degres
 *   avance  le temps restant avant le contact au ramene (null : aucun)
 *   ciseau  l'athlete a-t-il pedale en l'air
 *   vent    en m/s, positif dans le dos
 *
 * Rend toujours le meme objet, mordu ou non : un essai mordu reste un essai,
 * il compte dans les six, et l'ecran doit pouvoir le montrer.
 */
export function sauter({ vElan, ecart, angle, avance = null, ciseau = false, vent = 0 }) {
  const planche = jugerPlanche(ecart);
  const v = vol(vElan, angle);
  const r = jugerRamene(avance, ciseau);
  const brut = DISTANCE_ENVOL + v.longueur + r.gain;
  const porte = VENT_PAR_MS * vent * (brut / 8.5);
  // La mesure part de la ligne, pas de la pointe : l'ecart est perdu.
  const metres = Math.max(0.5, brut + porte - Math.max(0, ecart));
  const mordu = planche === 'mordu';
  return {
    mordu, planche, ecart, angle, vElan, vent,
    ramene: r.note, ciseau,
    vol: v,
    // ou le corps retombe, depuis la pointe : c'est la que l'animation le pose
    contact: DISTANCE_ENVOL + v.longueur,
    gain: r.gain,
    metres: mordu ? 0 : metres,
    marque: mordu ? null : marque(metres),
    // la marque que le saut aurait valu depuis la pointe, pour le dire
    depuisPointe: brut + porte,
  };
}

/* --------------------------------------------------------- le concours */

/**
 * LE PLATEAU DE CHAQUE ETAPE : le niveau de chaque adversaire, en metres.
 *
 * Six etapes, les memes que Sprinter et dans le meme ordre (levelName). Le
 * niveau est la marque qu'un adversaire peut sortir un bon jour ; il en
 * approche sur ses six essais, il ne la depasse pas.
 *
 *     Competition scolaire   4,60 - 5,90
 *     Niveau regional        6,10 - 7,10
 *     Niveau national        7,35 - 7,95
 *     Championnat du monde   8,15 - 8,65   (record du monde : 8,95)
 *     0.Games                8,40 - 8,95
 *     Inter galactique       9,50 - 10,05
 *
 * Comme a Sprinter, les quatre premieres etapes sont de l'athletisme, les
 * deux dernieres n'en sont plus. Le meilleur ZEZE ne se bat qu'avec tout :
 * l'elan au plafond, la pointe sur la planche, l'angle et le ramene justes.
 */
export const PLATEAU = [
  [4.60, 5.90], [6.10, 7.10], [7.35, 7.95],
  [8.15, 8.65], [8.40, 8.95], [9.50, 10.05],
];

/** La part d'essais mordus, par etape. */
export const MORDUS = [0.18, 0.20, 0.22, 0.25, 0.25, 0.20];

/**
 * Combien de sauteurs en finale. Douze aux grands championnats — c'est ce qui
 * fait exister la coupe des trois essais —, huit ailleurs, et huit ZEZE pour
 * la finale intergalactique, comme au 100 m.
 */
export const CONCURRENTS = [8, 8, 8, 12, 12, 8];

/** Un essai d'adversaire. */
export function essaiAdversaire(niveau, etape, alea) {
  const vent = tirerVent(alea);
  if (alea() < MORDUS[Math.max(0, Math.min(5, etape))]) {
    return { mordu: true, metres: 0, marque: null, vent };
  }
  // Le plus souvent pres de son niveau, parfois nettement en dessous : un
  // saut rate en longueur l'est d'un demi-metre, pas d'un centimetre.
  const perte = 0.075 * Math.pow(alea(), 1.6);
  const metres = niveau * (1 - perte) + VENT_PAR_MS * vent * (niveau / 8.5) * 0.5;
  return { mordu: false, metres, marque: marque(metres), vent };
}

/**
 * Un concours neuf.
 *
 * `noms` : les adversaires, dans l'ordre ou le plateau les donne. `alea` : le
 * tirage, seme ou non. L'ordre de passage est tire au sort, comme sur une
 * vraie feuille de concours.
 */
export function nouveauConcours({ etape, noms, alea = Math.random, joueur = 'TOI', plateau = PLATEAU }) {
  const e = Math.max(0, Math.min(5, etape | 0));
  // Le plateau de l'epreuve : celui de la longueur par defaut, celui du
  // triple saut (triple-jeu.js) quand c'est lui qu'on saute. Le reste du
  // concours — l'ordre, la coupe, le classement — est le meme.
  const [lo, hi] = plateau[e];
  const n = Math.min(CONCURRENTS[e], noms.length + 1);
  const athletes = [{ nom: joueur, joueur: true, niveau: 0, essais: [] }];
  for (let i = 0; i < n - 1; i++) {
    athletes.push({ nom: noms[i], joueur: false, niveau: lo + alea() * (hi - lo), essais: [] });
  }
  const ordre = athletes.map((_, i) => i);
  for (let i = ordre.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  }
  return { etape: e, athletes, ordre, tour: 1, rang: 0, fini: false, coupe: null };
}

/** Le nombre total de tours. */
export function tours() { return ESSAIS.premiers + ESSAIS.derniers; }

/**
 * Les marques valables d'un athlete, de la meilleure a la moins bonne. C'est
 * sur elles que se departagent deux ex aequo : la deuxieme meilleure, puis la
 * troisieme, et ainsi de suite.
 */
export function marquesDe(a) {
  return a.essais.filter(e => e && !e.mordu && !e.passe && e.marque != null)
    .map(e => e.marque).sort((x, y) => y - x);
}

/** La meilleure marque d'un athlete, ou 0. */
export function meilleur(a) {
  const m = marquesDe(a);
  return m.length ? m[0] : 0;
}

/** Comparer deux athletes : negatif si `a` est devant. */
function devant(a, b) {
  const ma = marquesDe(a), mb = marquesDe(b);
  for (let k = 0; k < Math.max(ma.length, mb.length); k++) {
    const x = ma[k] || 0, y = mb[k] || 0;
    if (x !== y) return y - x;
  }
  return 0;
}

/**
 * Le classement du concours : chaque athlete avec sa place. Deux athletes que
 * rien ne departage partagent la meme place.
 */
export function classement(c) {
  const l = c.athletes.map((a, i) => ({ i, a })).sort((x, y) => devant(x.a, y.a) || x.i - y.i);
  let place = 0;
  return l.map((x, k) => {
    if (k === 0 || devant(l[k - 1].a, x.a) !== 0) place = k + 1;
    return { index: x.i, nom: x.a.nom, joueur: x.a.joueur, meilleur: meilleur(x.a),
             place, essais: x.a.essais, qualifie: c.coupe ? c.coupe.includes(x.i) : true };
  });
}

/** L'ordre de passage du tour courant. */
function ordreDuTour(c) {
  return c.tour <= ESSAIS.premiers || !c.coupe ? c.ordre : c.ordreFinal;
}

/**
 * Qui saute maintenant : l'index de l'athlete, ou null quand le concours est
 * fini.
 */
export function aQui(c) {
  if (c.fini) return null;
  return ordreDuTour(c)[c.rang];
}

/**
 * APRES LE TROISIEME TOUR, LA COUPE.
 *
 * Au-dela de huit, seuls les huit meilleurs continuent, et ils sautent dans
 * l'ordre inverse du classement : le premier en dernier. A huit ou moins,
 * tout le monde continue — dans le meme ordre inverse, qui est la regle.
 */
function couper(c) {
  const cl = classement(c);
  const gardes = cl.slice(0, ESSAIS.qualifies);
  // Des ex aequo a la huitieme place passent tous.
  const derniere = gardes.length ? gardes[gardes.length - 1].place : 0;
  const tous = cl.filter(x => x.place <= derniere && x.place <= ESSAIS.qualifies);
  c.coupe = tous.map(x => x.index);
  c.ordreFinal = tous.map(x => x.index).reverse();
}

/**
 * Inscrire l'essai de celui qui vient de sauter, et passer au suivant.
 * Rend l'index de l'athlete suivant, ou null si le concours est fini.
 */
export function inscrire(c, essai) {
  const i = aQui(c);
  if (i === null) return null;
  c.athletes[i].essais.push(essai);
  c.rang++;
  if (c.rang >= ordreDuTour(c).length) {
    c.rang = 0;
    c.tour++;
    if (ESSAIS.derniers > 0 && c.tour === ESSAIS.premiers + 1) couper(c);
    if (c.tour > tours()) c.fini = true;
  }
  return aQui(c);
}

/** Le joueur est-il encore en lice ? */
export function joueurEnLice(c) {
  if (c.fini) return false;
  const j = c.athletes.findIndex(a => a.joueur);
  return !c.coupe || c.coupe.includes(j);
}

/**
 * Faire sauter les adversaires jusqu'au tour du joueur (ou a la fin).
 * Rend la liste de ce qui s'est passe, dans l'ordre : l'ecran la deroule.
 */
export function avancerJusquAuJoueur(c, alea) {
  const faits = [];
  for (let garde = 0; garde < 200; garde++) {
    const i = aQui(c);
    if (i === null) break;
    const a = c.athletes[i];
    if (a.joueur) break;
    const e = essaiAdversaire(a.niveau, c.etape, alea);
    faits.push({ index: i, nom: a.nom, tour: c.tour, essai: e });
    inscrire(c, e);
  }
  return faits;
}

/** La place du joueur. */
export function placeDuJoueur(c) {
  const x = classement(c).find(l => l.joueur);
  return x ? x.place : null;
}

/** Ce que le joueur doit sauter pour prendre la tete (ou la garder). */
export function aBattre(c) {
  const cl = classement(c);
  const autre = cl.find(l => !l.joueur);
  return autre ? autre.meilleur : 0;
}

/** La fosse, pour dire si un saut y tombe encore. */
export function dansLaFosse(metresDepuisLigne) {
  return metresDepuisLigne <= FOSSE.fond;
}
