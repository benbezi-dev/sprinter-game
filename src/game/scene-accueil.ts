// LA SCENE DE L'ACCUEIL — trois coureurs sur la piste, dans la place que
// l'accueil leur reserve.
//
// Ils etaient peints a une place fixe de l'ecran, sans regarder ni ce qu'il y
// avait dessous ni ce qui passait dessus. En 1280 x 720 cette place tombait
// exactement derriere la carte SPRINTER : il ne restait que des pieds sous la
// carte, poses dans la pelouse.
//
// UNE SCENE A EUX. Les chercher dans les interstices du menu ne marchait qu'a
// moitie : sur un telephone tenu debout il n'en reste presque pas, et il n'en
// reste aucun sur un petit ecran ou sous l'onglet ONE SHOT. L'accueil leur
// garde donc une place dans sa mise en page — sous le titre en portrait,
// au-dessus en paysage, la ou la piste traverse deja l'ecran — et cette partie
// de l'accueil ne defile jamais : seul le menu defile, dans sa propre zone. Le
// stade reste fixe, et aucune carte ne peut passer sur les coureurs. Voir
// `data-accueil-scene` dans TitleScreen.
//
// SUR LA PISTE. La camera est posee pour que la piste passe exactement sous
// leurs pieds (voir cadrage.ts), et chacun court dans son couloir, avec l'ombre
// de la course.

import { cameraPour } from './cadrage';

/** Une boite dans le repere du canvas : gauche, haut, droite, bas. */
type Boite = { g: number; h: number; d: number; b: number };

/**
 * Ou court la meute : les pieds du coureur du milieu, la taille des trois — les
 * pixels pour deux metres, comme pour drawIcon — et l'ecart entre deux voisins,
 * en couloirs.
 */
type Place = { x: number; y: number; taille: number; pas: number };

/**
 * L'emprise d'un coureur autour de son appui, en fractions de sa taille.
 *
 * Mesuree pixel par pixel sur les trois silhouettes de l'accueil, sur un cycle
 * de foulee entier, droites puis tournees du virage : la tete monte a 1,01, un
 * pied descend a 0,11 sous l'appui, le corps deborde de 0,39 a gauche et de
 * 0,52 a droite. On garde un rien de plus ; sous les pieds, c'est l'ombre qui
 * descend le plus bas — 0,18 la ou elle passe sous 3 % d'opacite.
 */
const HAUT = 1.02, BAS = 0.19, GAUCHE = 0.40, DROITE = 0.52;
/** L'air laisse entre la meute et les bords de sa scene, en pixels. */
const MARGE = 6;
/**
 * En dessous, on renonce. Trois silhouettes de quarante pixels pour deux
 * metres font encore trois coureurs ; plus petites, ce sont des taches sur la
 * piste. La scene de TitleScreen est dimensionnee pour ne jamais y descendre.
 */
const TAILLE_MINI = 40;
/** Le couloir du coureur du milieu : le quatrieme. */
const COULOIR = 3;
/** Ou court la meute : dans la ligne droite, loin des blocs et de l'arrivee. */
const DANS_LA_DROITE = 40;

/** La place de la meute. */
let place: Place | null = null;
/** L'ecran et la course de cette place : s'ils changent, elle ne vaut plus rien. */
let clePlace = '';
/** De quoi redessiner l'image courante : voir accueilPose. */
let redessiner: (() => void) | null = null;

/** La scene reservee aux coureurs, dans le repere du canvas. */
function mesurer(cv: HTMLCanvasElement): Boite | null {
  const scene = document.querySelector('[data-accueil-scene]');
  if (!scene) return null;
  const o = cv.getBoundingClientRect(), r = scene.getBoundingClientRect();
  return { g: r.left - o.left, h: r.top - o.top, d: r.right - o.left, b: r.bottom - o.top };
}

/**
 * Le pas de la meute, lu sur la projection elle-meme — virage compris.
 *
 * Un coureur plus a l'exterieur que son voisin se tient aussi `recul` metres de
 * ligne droite derriere lui, par metre de cote : juste ce qu'il faut pour que
 * leurs pieds restent a la meme hauteur de l'ecran. `ecart` est ce que ce metre
 * de cote fait gagner a l'ecran, en pixels. On ne lit que des differences : la
 * camera n'y entre pas.
 */
function pasDeLaMeute(A: any): { recul: number; ecart: number } {
  const o = A.ground(0, 0), ex = A.ground(1, 0), ey = A.ground(0, 1);
  const recul = -(ey[1] - o[1]) / (ex[1] - o[1]);
  return { recul, ecart: (ex[0] - o[0]) * recul + (ey[0] - o[0]) };
}

/**
 * La plus grande meute que la scene tienne entiere, sans depasser la taille
 * d'origine (ui x 160), centree dans la scene.
 */
function ajuster(A: any, zone: Boite): Place | null {
  const parCouloir = Math.abs(pasDeLaMeute(A).ecart) * A.C.LANE_W;
  let taille = Math.min(A.ui() * 160, (zone.b - zone.h - 2 * MARGE) / (HAUT + BAS));
  // Deux voisins a trois quarts de silhouette l'un de l'autre : colles, ils se
  // confondent ; plus loin, ce n'est plus un peloton. Et l'on compte en
  // couloirs entiers — un sprinteur court dans le sien, pas sur la ligne. Le
  // coureur du dedans ne descend jamais sous le premier.
  let pas = Math.min(COULOIR, Math.max(1, Math.round(0.75 * taille / parCouloir)));
  const largeur = () => 2 * pas * parCouloir + (GAUCHE + DROITE) * taille + 2 * MARGE;
  while (pas > 1 && largeur() > zone.d - zone.g) pas--;
  if (largeur() > zone.d - zone.g) {
    taille = (zone.d - zone.g - 2 * MARGE - 2 * pas * parCouloir) / (GAUCHE + DROITE);
  }
  if (!(taille >= TAILLE_MINI)) return null;
  return {
    // Centree : l'emprise deborde un peu plus a droite qu'a gauche.
    x: (zone.g + zone.d) / 2 - (DROITE - GAUCHE) * taille / 2,
    y: (zone.h + zone.b) / 2 + (HAUT - BAS) * taille / 2,
    taille,
    pas,
  };
}

/** Ou la meute court sur cette piste : dans la premiere ligne droite. */
function distance(T: any): number {
  return (T.curved ? T.bend1(T.radius(COULOIR)) : 0) + DANS_LA_DROITE;
}

/**
 * Pose la camera de l'accueil. Appelee a chaque image, avant le monde.
 *
 * La scene est relue a chaque image : elle change avec l'onglet, une banderole
 * qui arrive ou un ecran qu'on tourne, et la meute doit suivre dans la meme
 * image. Une boite a relire ne coute rien.
 *
 * Rend faux tant que l'accueil n'a jamais pu etre mesure sur cet ecran : le
 * stade n'a alors pas encore de camera a lui, et GameCanvas ne le montre pas.
 *
 * `A` est SprinterApp.
 */
export function placerLaCameraDeLAccueil(A: any): boolean {
  const G = A.G, T = G.track;
  if (!T || !G.cv) return false;
  const cle = G.VW + 'x' + G.VH + ':' + G.raceKey;
  if (cle !== clePlace) { place = null; clePlace = cle; }
  const zone = mesurer(G.cv);
  // Sans scene — l'accueil n'est pas encore monte — on garde la place d'avant,
  // qui vaut pour cet ecran : c'est le cas du retour a l'accueil apres une
  // course. Voir accueilPose pour la toute premiere image.
  if (zone) place = ajuster(A, zone);
  if (!place) {
    const p = T.pos(0, 3);
    G.camX = p[0]; G.camY = p[1];
    return !!zone;
  }
  const [x, y] = cameraPour(A, T.pos(distance(T), COULOIR), [place.x, place.y]);
  G.camX = x; G.camY = y;
  return true;
}

/**
 * Les trois coureurs, chacun dans son couloir, avec leur ombre. Appelee apres
 * le monde, et apres placerLaCameraDeLAccueil.
 */
export function dessinerLesCoureursDeLAccueil(ctx: CanvasRenderingContext2D, A: any, theme: any): void {
  const G = A.G, T = G.track, P = place;
  if (!T || !P) return;
  const Core = (globalThis as any).SprinterCore;
  const Prem = (globalThis as any).RenduPremium;
  const { recul } = pasDeLaMeute(A);
  const s = distance(T);
  const milieu = T.pos(s, COULOIR);
  const zeze: any[] = Object.values(Core.ZEZE);
  const tick = performance.now() / 1000;
  // Le coureur du dedans devant, celui du dehors derriere : en ligne a
  // l'ecran, et chacun au milieu de son couloir.
  const meute = [-1, 0, 1].map((cote, i) => {
    const Y = T.pos(s, COULOIR + cote * P.pas)[1];
    const [x, y] = A.ground(milieu[0] + recul * (Y - milieu[1]), Y);
    const man = { look: zeze[i], stride: tick * 10 + i * 2.1, v: 12, maxSpeed: 12,
                  fallAnim: 0, celebrate: 0 };
    return { man, x, y, k: man.look.h / Core.C.MODEL_H };
  });
  // Les ombres d'abord, toutes : celle d'un coureur ne doit pas passer sur la
  // jambe de son voisin. Ce sont celles de la course — penombre large, contact
  // serre — a l'echelle de la silhouette (taille / 2 pixels par metre).
  if (Prem) {
    for (const c of meute) {
      Prem.ombre(ctx, c.x, c.y, P.taille / 2, c.k, c.man.stride, theme.projecteurs);
    }
  }
  for (const c of meute) {
    // Comme en course, la silhouette tourne avec le stade quand la piste a un
    // virage ; drawIcon, lui, ne la tourne jamais.
    const k = P.taille * c.k / 2;
    const caps = A.personCapsules(c.man, 0, 0, false, T.curved, A.niveauDetail(k));
    A.drawFacetFigure(ctx, caps, c.x, c.y, k);
  }
}

/** GameCanvas se declare ici : de quoi redessiner l'image courante sur demande. */
export function brancherLeRedessin(fn: (() => void) | null): void {
  redessiner = fn;
}

/**
 * L'ACCUEIL VIENT D'APPARAITRE : on refait l'image avant qu'elle ne s'affiche.
 *
 * Le jeu passe a l'accueil au milieu d'une image : le canvas la dessine aussitot,
 * alors que React n'a pas encore monte l'accueil — il n'y a pas de scene a
 * mesurer, et le stade partait avec la camera de la course. React monte ensuite
 * l'accueil, toujours avant l'affichage. TitleScreen appelle donc cette
 * fonction a son montage (useLayoutEffect) : la scene existe, on redessine, et
 * c'est cette image-la qui s'affiche.
 */
export function accueilPose(): void {
  if (redessiner) redessiner();
}
