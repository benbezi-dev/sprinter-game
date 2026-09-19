// LE PASSAGE D'UN JEU A L'AUTRE, ET CE QUE LA CAMERA Y FAIT.
//
// Jusqu'ici, changer de jeu faisait glisser un panneau par-dessus le stade.
// Ca marchait, et ca ne disait rien : le couloir disparaissait sous une carte,
// et rien ne laissait croire que les quatre epreuves se courent au meme
// endroit. L'en-tete de mondes.ts affirme pourtant le contraire — « on descend
// vers les haies parce que c'est le meme couloir avec des obstacles dedans ».
//
// C'EST LA CAMERA QUI PORTE LE MOUVEMENT, PAS UN CALQUE. Le stade ne se fait
// pas recouvrir : il s'en va. Il sort par le haut quand on descend vers les
// haies, par la gauche quand on part a droite vers les sauts, et il tourne en
// sortant vers les lancers — parce qu'un lancer est une rotation, et que c'est
// le seul des trois passages qui tourne. Derriere lui, la couleur du jeu ou
// l'on va monte progressivement ; le panneau d'arrivee n'a plus qu'a s'y
// poser.
//
// CE FICHIER NE DESSINE RIEN. Il tient l'etat du passage en cours et repond a
// une seule question, une fois par image : ou en est la camera. La boucle
// d'image (components/GameCanvas.tsx) applique le resultat sur la toile du
// jeu, sans toucher a la projection. Meme partage que fete.ts et Feux.tsx :
// un module qui decide, un calque qui joue.
//
// DEUX PASSAGES POUR UN SEUL GESTE, ET LE CANAL DECIDE. Aller dans Hurdlers
// n'ouvre pas toujours le meme endroit : quand les haies sont fermees, c'est
// un accueil qui les annonce, et le stade doit s'effacer pour lui laisser la
// place ; quand elles sont ouvertes, Hurdlers se joue DANS l'enveloppe de
// Sprinter — meme menu, memes modes — et il n'y a nulle part ou aller. Le
// passage le sait par `surPlace`, et change de mise en scene : dans un cas il
// PART, dans l'autre il PLONGE. « Le meme couloir, avec des obstacles
// dedans » devient alors litteral — on ne quitte pas le stade, il se
// transforme.
//
// LE MATERIEL EST AILLEURS, ET C'EST VOLONTAIRE. Les dix haies qui sortent du
// couloir, la planche et le sable, le cercle et sa cage vivent dans
// game/materiel.ts. Ce fichier-ci ne repond qu'a « ou en est la camera » : il
// a ete ecrit en premier, livre seul, et le materiel est venu s'accrocher
// dessus sans le redefinir. C'est cette separation qui permet d'ajouter une
// installation — une perche, un butoir — sans retoucher un mouvement qui
// marche.

import type { Direction, Monde } from './mondes';
import { DUREE } from '@/lib/mouvement';
import { useSyncExternalStore } from 'react';

export type Sens = 'aller' | 'retour';

export type Passage = {
  de: Monde;
  vers: Monde;
  /**
   * L'axe du depart DEPUIS Sprinter : bas, droite ou gauche.
   *
   * On le garde meme au retour, et c'est voulu : revenir des haies, c'est
   * remonter par la ou l'on est descendu. Le chemin doit etre le meme dans
   * les deux sens, sans quoi le geste est un piege.
   */
  axe: Direction;
  sens: Sens;
  /** L'horodatage du depart, sur la meme horloge que les images. */
  debut: number;
  duree: number;
  /** Les deux teintes de fond, du monde qu'on quitte et de celui qu'on rejoint. */
  fondDe: string;
  fondVers: string;
  /**
   * Vrai quand il n'y a nulle part ou aller.
   *
   * Hurdlers ouvert se joue dans l'enveloppe de Sprinter : aucun accueil ne
   * se pose, le menu reste et change de couleur. Faire sortir le stade
   * reviendrait alors a le faire sortir pour le faire revenir, et le joueur
   * verrait un aller-retour sans destination. On plonge au lieu de partir.
   */
  surPlace: boolean;
};

/**
 * On part plus lentement qu'on ne revient.
 *
 * Partir, c'est decouvrir : la camera a le droit de prendre son temps.
 * Revenir, c'est retrouver — on connait deja le chemin, et 900 ms pour
 * rentrer chez soi deviendraient un peage.
 */
export const DUREE_ALLER = DUREE.scene * 1000;
/**
 * Sept cents millisecondes, et c'est volontairement hors du bareme.
 *
 * lib/mouvement n'a pas ce palier — il s'arrete a `scene`, 900 ms, qui est la
 * duree de l'aller. Le vocabulaire laisse ce droit a ce qui est une mise en
 * scene et non un composant d'interface, et le retour en est une : il doit
 * etre plus court que l'aller, sans quoi rentrer chez soi devient un peage.
 */
export const DUREE_RETOUR = 700;
/** Mouvement reduit : la teinte change, le stade ne bouge pas. */
export const DUREE_DOUCE = DUREE.instant * 1000;

export function mouvementReduit(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let courant: Passage | null = null;
let minuteur: ReturnType<typeof setTimeout> | null = null;
const ecoutes = new Set<() => void>();

function prevenir() { for (const f of ecoutes) f(); }

/**
 * Arme un passage. Il se termine tout seul.
 *
 * Le minuteur n'est pas une commodite : un passage s'acheve par le temps qui
 * passe, pas par un evenement, et personne d'autre n'est en position de le
 * declarer fini. Un second geste pendant le premier remplace le passage en
 * cours — la camera saute, ce qui vaut mieux que deux mouvements qui
 * s'additionnent.
 */
export function armerPassage(p: Omit<Passage, 'debut' | 'duree' | 'sens'>) {
  if (minuteur) clearTimeout(minuteur);
  const sens: Sens = p.vers === 'sprinter' ? 'retour' : 'aller';
  const duree = mouvementReduit() ? DUREE_DOUCE
    : sens === 'aller' ? DUREE_ALLER : DUREE_RETOUR;
  courant = { ...p, sens, duree, debut: performance.now() };
  minuteur = setTimeout(() => {
    minuteur = null; courant = null; prevenir();
  }, duree);
  prevenir();
}

export function passageCourant(): Passage | null { return courant; }

export function usePassage(): Passage | null {
  return useSyncExternalStore(
    (l) => { ecoutes.add(l); return () => { ecoutes.delete(l); }; },
    () => courant,
    () => courant,
  );
}

/* ------------------------------------------------------------- la camera */

export type Camera = {
  /** Ou l'on en est, de 0 a 1, et dans quel sens. */
  u: number;
  sens: Sens;
  axe: Direction;
  /**
   * A quel point le stade a quitte l'image, de 0 a 1.
   *
   * Different de `u` : il monte lentement au debut, file, et se pose. Le
   * materiel s'y accroche plutot qu'a l'horloge — une cage qui descend au
   * rythme de la camera arrive avec elle, quel que soit le sens.
   */
  part: number;
  /**
   * Vrai quand le systeme demande moins de mouvement.
   *
   * Le passage se reduit alors a un fondu de teinte — et le materiel ne se
   * dessine pas du tout. Des haies qui se dressent en cent vingt
   * millisecondes sont exactement ce qu'on venait d'eviter.
   */
  doux: boolean;
  /** Recopie du passage : la mise en scene n'est pas la meme. */
  surPlace: boolean;
  /** Le decalage de l'image, en pixels d'ecran. */
  dx: number; dy: number;
  /** La rotation, en radians, autour du centre de l'ecran. */
  roll: number;
  /** L'echelle, prise elle aussi au centre. */
  zoom: number;
  /** La couleur decouverte derriere le stade. */
  fond: string;
  /**
   * L'opacite de cette meme couleur POSEE SUR le stade, de 0 a 1.
   *
   * Le decalage seul ne suffisait pas. Un stade qui sort par le haut emmene
   * sa pelouse avec lui : la moitie du passage se jouait sur un aplat vert,
   * et la teinte du jeu ou l'on va n'apparaissait qu'une fois tout sorti,
   * trop tard pour annoncer quoi que ce soit. Le voile monte avec l'eloignement
   * — discret tant que le stade se lit, franc quand il a quitte l'image.
   */
  voile: number;
};

const borne = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;

/**
 * Monte vite, depasse d'environ 9 %, se pose.
 *
 * Le geste d'une haie qu'on deplie et qui claque. Exporte : le materiel s'en
 * sert, et deux ressorts differents dans un meme passage se verraient.
 */
export function ressort(u: number): number {
  u = borne(u, 0, 1);
  return u <= 0 ? 0 : 1 - Math.exp(-7 * u) * Math.cos(7.5 * u);
}

/**
 * Depart lent, course, arrivee freinee net.
 *
 * C'est le profil d'un travelling, et pas une courbe d'interface. Une camera
 * ne demarre pas a pleine vitesse et ne s'arrete pas en glissant : elle
 * s'ebranle, elle file, elle se pose.
 */
function travelling(u: number): number {
  u = borne(u, 0, 1);
  return u < 0.34
    ? 0.19 * Math.pow(u / 0.34, 1.9)
    : 0.19 + 0.81 * (1 - Math.pow(1 - (u - 0.34) / 0.66, 2.9));
}
/** L'arrivee du retour : elle part tout de suite, et se pose. */
const arrivee = (u: number) => 1 - Math.pow(1 - borne(u, 0, 1), 3);
const adoucir = (u: number) => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

function teintes(h: string): [number, number, number] {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function melange(a: string, b: string, t: number): string {
  const x = teintes(a), y = teintes(b);
  const v = (i: number) => Math.round(x[i] + (y[i] - x[i]) * t);
  return `rgb(${v(0)},${v(1)},${v(2)})`;
}

/**
 * Ou en est la camera, a cet instant. `null` quand aucun passage ne court.
 *
 * Appelee une fois par image depuis la boucle de la toile. Elle ne lit que
 * l'horloge : rien ici ne depend d'un etat React, et le mouvement ne peut
 * donc pas sauter parce qu'un rendu est arrive en retard.
 */
export function cameraPassage(maintenant: number, VW: number, VH: number): Camera | null {
  const p = courant;
  if (!p) return null;
  const u = borne((maintenant - p.debut) / p.duree, 0, 1);
  const fond = melange(p.fondDe, p.fondVers, adoucir(u));

  // Mouvement reduit : la couleur suffit a dire qu'on a change d'endroit.
  if (p.duree === DUREE_DOUCE) {
    return { u, sens: p.sens, axe: p.axe, doux: true, surPlace: p.surPlace,
             part: p.sens === 'aller' ? u : 1 - u,
             dx: 0, dy: 0, roll: 0, zoom: 1, fond,
             voile: adoucir(u) * (p.surPlace ? 0 : 0.92) };
  }

  // « part » : a quel point le stade a quitte l'image, de 0 a 1.
  const part = p.sens === 'aller' ? travelling(u) : 1 - arrivee(u);

  let dx = 0, dy = 0, roll = 0, zoom = 1;
  if (p.axe === 'bas' && p.surPlace) {
    // ON NE PART NULLE PART : ON PLONGE.
    //
    // Hurdlers ouvert se joue dans l'enveloppe de Sprinter — le menu reste,
    // il change seulement de couleur. Faire sortir le stade par le haut
    // reviendrait a le faire sortir pour le faire revenir au meme endroit,
    // et l'oeil n'y lirait qu'un soubresaut. La camera descend donc vers le
    // couloir pendant que les haies s'y dressent, puis remonte se poser d'ou
    // elle venait : ce qui a change a la fin, ce n'est pas le cadrage, c'est
    // la piste. « Le meme couloir, avec des obstacles dedans », a la lettre.
    //
    // D'ou le sinus, et non une course de zero a un : une camera qui
    // resterait baissee laisserait l'accueil mal cadre pour le reste de la
    // partie. En repartant vers Sprinter elle fait l'inverse — elle prend du
    // recul le temps que les haies se couchent — et le chemin se lit dans
    // les deux sens, comme le geste qui l'a declenche.
    const plongee = Math.sin(Math.PI * Math.pow(u, 0.75));
    const vers = p.sens === 'aller' ? 1 : -1;
    dy = -VH * 0.15 * plongee * vers;
    zoom = 1 + 0.24 * plongee * vers;
  } else if (p.axe === 'bas') {
    // Les haies fermees : c'est leur accueil qui les annonce, et le stade lui
    // laisse la place en sortant par le haut. L'oeil se rapproche du sol —
    // c'est ce leger rapprochement qui fait la difference entre une camera
    // qui descend et une image qui glisse.
    dy = -VH * 1.05 * part;
    // Il RECULE d'abord. Sans ce retrait, une seule haie tenait dans le
    // cadre : a l'echelle du jeu, neuf metres quatorze mangent la moitie de
    // l'ecran, et on ne voyait pas le peigne se monter.
    zoom = 1 + 0.34 * part - 0.20 * Math.sin(Math.PI * borne(u / 0.5, 0, 1));
  } else {
    // Les concours sont sur les cotes. Le panneau d'arrivee vient de la
    // droite pour les sauts, de la gauche pour les lancers : le stade sort
    // du cote oppose.
    dx = (p.axe === 'droite' ? -1 : 1) * VW * 1.15 * part;
    // On arrive SUR l'installation, pas en face d'elle. Un cercle de lancer
    // fait 2,135 m : vu de la distance ou l'on regarde une piste, c'est une
    // piece de monnaie. La camera s'en approche donc franchement.
    zoom = 1 + (p.axe === 'gauche' ? 0.45 : 0.15) * part;
    // Un lancer est une rotation. C'est le seul passage qui tourne, et il
    // se derange exactement autant au retour qu'a l'aller : on ne fait pas
    // un tour de plus en rentrant.
    // Elle tourne, puis se REPOSE A PLAT. Une rotation qui reste acquise
    // laissait le cercle de lancer penche a l'arrivee, et un cercle penche
    // n'est plus un cercle de lancer — c'est une erreur de dessin. Le
    // mouvement se voit quand meme : c'est pendant qu'il tourne qu'on le lit.
    if (p.axe === 'gauche') roll = -0.46 * Math.sin(Math.PI * Math.pow(part, 0.75));
  }

  // La parabole des sauts. Les derniers quinze pour cent du travelling
  // quittent le sol et s'y reposent : on sent le saut sans voir d'athlete.
  // A l'aller seulement — en revenant on court, on ne saute pas.
  if (p.axe === 'droite' && p.sens === 'aller' && u > 0.72) {
    dy -= VH * 0.085 * Math.sin(Math.PI * (u - 0.72) / 0.28);
  }

  // Le voile suit l'eloignement, pas l'horloge : il se retire donc tout seul
  // au retour, exactement au rythme ou le stade revient.
  // Sur place, le voile n'a rien a couvrir : le menu se recolore tout seul en
  // changeant de jeu. Il n'en reste qu'une ombre breve, le temps de la
  // plongee, pour que la piste ne change pas d'etat sans que rien ne passe
  // dessus.
  const voile = p.surPlace
    ? 0.22 * Math.sin(Math.PI * Math.pow(u, 0.75))
    : 0.92 * Math.pow(part, 2.2);

  return { u, sens: p.sens, axe: p.axe, doux: false, surPlace: p.surPlace, part,
           dx, dy, roll, zoom, fond, voile };
}

/**
 * Pose la camera sur la toile.
 *
 * Ecrit une seule fois : le monde et le materiel doivent partager exactement
 * le meme repere, sinon les haies flottent a cote du couloir. Rotation et
 * echelle se prennent au centre de l'ecran, le decalage s'ajoute par-dessus.
 */
export function appliquerCamera(
  ctx: CanvasRenderingContext2D, cam: Camera, VW: number, VH: number,
) {
  ctx.translate(VW / 2 + cam.dx, VH / 2 + cam.dy);
  ctx.rotate(cam.roll);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-VW / 2, -VH / 2);
}

/**
 * L'inverse : ou poser, AU REPOS, ce qui doit se retrouver la a l'arrivee.
 *
 * Les installations des concours ne surgissent pas — elles sont dans le
 * stade, et c'est la camera qui va les chercher. Encore faut-il les mettre a
 * l'endroit exact ou le travelling les amenera au centre du cadre : on prend
 * donc la camera de FIN de passage et on la remonte a l'envers.
 */
export function posePourArrivee(
  p: Passage, VW: number, VH: number, viseX: number, viseY: number,
): [number, number] {
  const fin = { ...p, debut: 0, duree: p.duree };
  const sauve = courant; courant = fin;
  const c = cameraPassage(p.duree, VW, VH)!;
  courant = sauve;
  const cx = VW / 2, cy = VH / 2;
  const ax = viseX - cx - c.dx, ay = viseY - cy - c.dy;
  const co = Math.cos(-c.roll), si = Math.sin(-c.roll);
  return [cx + (ax * co - ay * si) / c.zoom, cy + (ax * si + ay * co) / c.zoom];
}
