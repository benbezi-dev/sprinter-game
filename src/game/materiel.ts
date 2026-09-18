// LE MATERIEL DES TROIS AUTRES JEUX, PENDANT LE PASSAGE.
//
// Etape 2 du passage. L'etape 1 emmenait la camera ; celle-ci pose ce qu'elle
// va chercher : dix haies qui sortent du couloir, une planche et un bac de
// sable, un cercle et sa cage. Rien ici ne touche au mouvement — le materiel
// s'accroche a la camera deja livree et ne la redefinit pas.
//
// TOUT EST ANCRE DANS LE MONDE, PAS SUR L'ECRAN. On dessine avec `solid()`,
// la meme projection que la piste et les coureurs : une haie est posee sur un
// couloir a une distance en metres, pas a un pourcentage de largeur d'ecran.
// C'est ce qui fait qu'elle se deplace avec la piste quand la camera bouge,
// au lieu de glisser dessus. Le prix a payer est ce fichier : il faut
// raisonner en metres, en hauteurs et en rayons.
//
// DEUX CHOSES SE MONTENT, UNE TROISIEME EXISTE DEJA. Les haies se posent
// vraiment entre deux epreuves, et une cage de lancer se leve : ces deux-la
// s'animent. La fosse de saut et le cercle, eux, ne surgissent pas — ils sont
// dans le stade depuis toujours, et c'est la camera qui va les voir. Les
// faire apparaitre aurait ete plus spectaculaire et faux.
//
// LES COTES SONT CELLES DU REGLEMENT. Haie de 1,067 m, ecart de 9,14 m, barre
// de 1,18 m — le 110 m haies. Fosse de 2,75 m sur 9, planche d'appel de
// 1,22 sur 0,20 posee a un metre du sable. Cercle de 2,135 m, secteur de
// 34,92 degres. Elles se verifient, et l'accueil des Hurdlers affiche deja
// les memes chiffres : les voir dessines autrement serait un mensonge visible.
//
// CE QUI N'EST PAS REGLEMENTAIRE, ET POURQUOI. La PREMIERE haie d'un 110 m
// haies se dresse a 13,72 m du depart. A l'echelle ou le jeu regarde une
// piste, 13,72 m tombent hors du cadre sur un telephone : le champ de haies
// se cale donc sur la camera, et c'est l'ECART qui porte la verite. Une
// transition n'est pas une course ; ce qu'elle doit dire juste, c'est le
// rythme et la taille.

import type { Camera } from './passage';
import { passageCourant, posePourArrivee, ressort } from './passage';
import { MONDES } from './mondes';

/** Le 110 m haies, celui dont la haie est la plus haute. */
const HAIE = { hauteur: 1.067, ecart: 9.14, nombre: 10, barre: 1.18, epaisseur: 0.07 };
/** Huit couloirs, comme C.LANE_COUNT dans le moteur. */
const COULOIRS = 8;

const borne = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;

type Moteur = any;

/* ------------------------------------------------------- le son des haies */

/**
 * LE RYTHME D'UN RANG, EN UN SEUL ENDROIT.
 *
 * Ces quatre nombres servent deux fois : a dessiner la haie qui se leve, et a
 * placer son claquement. Les ecrire deux fois aurait garanti qu'ils divergent
 * — on retouche le mouvement, on oublie le son, et le « tac » arrive un
 * dixieme de seconde a cote. Tout est exprime en fraction du passage, jamais
 * en millisecondes : un passage doux dure cent vingt millisecondes, un
 * passage normal neuf cents, et le rythme doit tenir dans les deux.
 */
const RANG = {
  /** A l'aller : quand le premier rang s'ebranle, l'ecart entre deux rangs,
   *  et le temps que met le ressort. */
  depart: 0.03, ecart: 0.019, ressort: 0.11,
  /** Au retour : meme chose pour la chute, qui part du rang le plus proche. */
  chuteEcart: 0.016, chuteDuree: 0.12,
};
/**
 * Le moment ou le ressort atteint sa hauteur pleine, en fraction de sa duree.
 *
 * `ressort(x) = 1 - e^-7x cos(7,5x)` vaut 1 quand le cosinus s'annule, donc a
 * x = pi/15. C'EST LA QUE LA HAIE SE POSE, et donc la qu'elle claque — pas
 * quand elle commence a monter. Un son cale sur le debut du mouvement arrive
 * un dixieme de seconde trop tot, et l'oreille l'entend tout de suite.
 */
const SOMMET = Math.PI / 15;

/** La hauteur atteinte par le rang `k`, sur `n`, a cet instant du passage. */
function niveauDuRang(cam: Camera, k: number, n: number): number {
  if (cam.sens === 'aller') {
    return ressort((cam.u - RANG.depart - k * RANG.ecart) / RANG.ressort);
  }
  return 1 - Math.pow(
    borne((cam.u - (n - 1 - k) * RANG.chuteEcart) / RANG.chuteDuree, 0, 1), 2.4);
}

/** Quand ce rang-la claque, en fraction du passage. */
function instantDuClaquement(cam: Camera, k: number, n: number): number {
  if (cam.sens === 'aller') {
    return RANG.depart + k * RANG.ecart + RANG.ressort * SOMMET;
  }
  // La chute est finie quand la hauteur touche le sol.
  return (n - 1 - k) * RANG.chuteEcart + RANG.chuteDuree;
}

/**
 * DIX CLAQUEMENTS EN CENT CINQUANTE MILLISECONDES, PROGRAMMES D'AVANCE.
 *
 * C'est rapide — c'est le bruit d'une rangee qu'on monte, pas de dix haies
 * posees une par une. Deux reglages empechent que ce soit une mitraillette :
 * les rangs lointains sonnent plus haut et plus faible que les proches, et
 * chacun est legerement detimbre. Sans cela, dix copies identiques du meme
 * echantillon ne font qu'un bruit ; avec, la salve VIENT VERS le joueur.
 *
 * Tout part en une fois, des la premiere image du passage, sur l'horloge
 * audio. On garde les sources pour pouvoir les taire : un second geste au
 * milieu du passage laisserait sinon claquer des haies d'un monde qu'on a
 * deja quitte.
 */
let passageSonore: unknown = null;
let sourcesHaies: any[] = [];

function programmerLesClaquements(A: Moteur, cam: Camera, n: number, duree: number) {
  for (let k = 0; k < n; k++) {
    const attente = (instantDuClaquement(cam, k, n) - cam.u) * duree / 1000;
    if (attente < -0.05) continue;
    const proche = n <= 1 ? 1 : k / (n - 1);
    // Un grain de desordre, tire du rang : toujours le meme d'une fois sur
    // l'autre, jamais le meme d'une haie a la suivante.
    const grain = ((Math.imul(k + 1, 2654435761) >>> 0) % 1000) / 1000;
    const src = A.Audio_.sfx('haie', {
      gain: 0.12 + 0.34 * proche,
      rate: (1.16 - 0.24 * proche) * (0.96 + 0.08 * grain),
      delay: Math.max(0, attente),
    });
    if (src) sourcesHaies.push(src);
  }
}

function tairelesClaquements() {
  for (const s of sourcesHaies) { try { s.stop(); } catch (e) { /* deja fini */ } }
  sourcesHaies = [];
}

/**
 * Le point du monde qui se projette a cet endroit de l'ecran.
 *
 * `ground()` est affine : trois projections suffisent a la renverser, sans
 * rien savoir de la rotation du monde, de l'echelle ni du cadrage. C'est ce
 * qui permet de poser une installation « la ou le travelling l'amenera au
 * centre » sans reecrire la projection a l'envers a la main.
 */
function versLeMonde(A: Moteur) {
  const { G, ground } = A;
  const o = ground(G.camX, G.camY);
  const px = ground(G.camX + 1, G.camY), py = ground(G.camX, G.camY + 1);
  const ex = [px[0] - o[0], px[1] - o[1]];
  const ey = [py[0] - o[0], py[1] - o[1]];
  const det = ex[0] * ey[1] - ey[0] * ex[1] || 1;
  return (sx: number, sy: number): [number, number] => {
    const dx = sx - o[0], dy = sy - o[1];
    return [G.camX + (ey[1] * dx - ey[0] * dy) / det,
            G.camY + (-ex[1] * dx + ex[0] * dy) / det];
  };
}

/** Un rectangle pose a plat sur le sol, entre deux coins du monde. */
function dalle(ctx: CanvasRenderingContext2D, A: Moteur,
               x0: number, y0: number, x1: number, y1: number,
               couleur: string, z = 0) {
  const s = A.solid;
  const a = s(x0, y0, z), b = s(x1, y0, z), c = s(x1, y1, z), d = s(x0, y1, z);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
  ctx.closePath();
  ctx.fillStyle = couleur; ctx.fill();
}

function trait(ctx: CanvasRenderingContext2D, A: Moteur,
               x0: number, y0: number, z0: number,
               x1: number, y1: number, z1: number) {
  const a = A.solid(x0, y0, z0), b = A.solid(x1, y1, z1);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}

/** Hors champ, et largement : on prefere dessiner pour rien que couper net. */
function horsCadre(A: Moteur, p: number[]) {
  const { G } = A;
  return p[0] < -G.VW || p[0] > G.VW * 2 || p[1] < -G.VH || p[1] > G.VH * 2;
}

/* ------------------------------------------------------- les dix haies */

/**
 * Une haie : deux montants, une barre, deux patins.
 *
 * `h` est la hauteur ATTEINTE, pas la hauteur reglementaire : la haie sort du
 * couloir en grandissant. On ne la fait pas monter depuis le sous-sol, ce qui
 * obligerait a decouper la piste pour cacher ce qui depasse ; elle pousse, et
 * le ressort de l'etape 1 lui donne le claquement d'une haie qu'on deplie.
 */
/**
 * Un rang de haies traverse la piste PERPENDICULAIREMENT.
 *
 * Sur la ligne droite, cela veut dire « a la meme distance ». Dans le virage,
 * non : chaque couloir compte sa distance sur son propre arc, et le meme `s`
 * met le couloir 8 trente degres plus loin que le couloir 1. Les dix haies
 * partaient alors en eventail a travers la pelouse. Un rang, c'est un ANGLE,
 * pris une fois pour toutes sur le couloir de la camera.
 */
function pointDuRang(T: any, s: number, r: number, largeurVoie: number) {
  if (!T.curved) return [s, r];
  return T.posR((T.arc - s) / T.radius(3), r, true);
}

function uneHaie(ctx: CanvasRenderingContext2D, A: Moteur, T: any,
                 s: number, voie: number, largeurVoie: number,
                 h: number, accent: string) {
  const { solid, scaleM } = A;
  const rc = T.curved ? T.radius(voie) : largeurVoie * (voie + 0.5);
  const demi = HAIE.barre / 2;
  const pg = pointDuRang(T, s, rc - demi, largeurVoie);
  const pd = pointDuRang(T, s, rc + demi, largeurVoie);
  const basG = solid(pg[0], pg[1], 0);
  if (horsCadre(A, basG)) return;
  const basD = solid(pd[0], pd[1], 0);
  const hautG = solid(pg[0], pg[1], h), hautD = solid(pd[0], pd[1], h);
  const m = scaleM();

  // AUCUN TRAIT SOUS DEUX PIXELS. Une barre de haie fait 70 mm : a l'echelle
  // ou le jeu regarde une piste, cela donne un cheveu d'un pixel et demi, et
  // dix haies dessinees juste deviennent dix fils gris. On garde les cotes
  // reelles pour la HAUTEUR et l'ECART — ce sont elles qui font la course —
  // et on donne aux traits l'epaisseur qu'il faut pour se voir.
  const epais = (metres: number, mini: number) => Math.max(mini, metres * m);
  const piedG = pointDuRang(T, s - 0.34, rc - demi, largeurVoie);
  const piedD = pointDuRang(T, s - 0.34, rc + demi, largeurVoie);
  ctx.strokeStyle = 'rgba(214,222,236,0.55)';
  ctx.lineWidth = epais(0.05, 1.5);
  trait(ctx, A, pg[0], pg[1], 0, piedG[0], piedG[1], 0);
  trait(ctx, A, pd[0], pd[1], 0, piedD[0], piedD[1], 0);

  // Les montants.
  ctx.strokeStyle = 'rgba(232,238,248,0.95)';
  ctx.lineWidth = epais(0.055, 2.2);
  ctx.beginPath();
  ctx.moveTo(basG[0], basG[1]); ctx.lineTo(hautG[0], hautG[1]);
  ctx.moveTo(basD[0], basD[1]); ctx.lineTo(hautD[0], hautD[1]);
  ctx.stroke();

  // La barre. Sa bande de couleur est ce qui fait qu'une haie se lit COMME
  // une haie a trente pixels de haut : sans elle, il ne reste qu'un trait.
  const ep = Math.min(Math.max(HAIE.epaisseur, 3.2 / m), h * 0.9);
  const mi = solid, bG = mi(pg[0], pg[1], h - ep), bD = mi(pd[0], pd[1], h - ep);
  const cG = mi(pg[0], pg[1], h - ep * 0.45), cD = mi(pd[0], pd[1], h - ep * 0.45);
  ctx.beginPath();
  ctx.moveTo(cG[0], cG[1]); ctx.lineTo(cD[0], cD[1]);
  ctx.lineTo(hautD[0], hautD[1]); ctx.lineTo(hautG[0], hautG[1]);
  ctx.closePath();
  ctx.fillStyle = '#eef1f7'; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bG[0], bG[1]); ctx.lineTo(bD[0], bD[1]);
  ctx.lineTo(cD[0], cD[1]); ctx.lineTo(cG[0], cG[1]);
  ctx.closePath();
  ctx.fillStyle = accent; ctx.fill();
}

function lesHaies(ctx: CanvasRenderingContext2D, A: Moteur, cam: Camera, accent: string) {
  const { G, solid, depthOf } = A;
  const T = G.track;
  const largeurVoie = T.edge(1) - T.edge(0);

  // OU POSER LE CHAMP DE HAIES.
  //
  // La camera regarde la ligne de depart (buildLevel : pos(0, 3)), mais on ne
  // peut pas poser les haies a leur distance reglementaire : a l'echelle du
  // jeu, neuf metres quatorze valent presque une largeur d'ecran, et la
  // premiere haie d'un 110 m — 13,72 m — tombe hors du cadre. On centre donc
  // les dix haies SUR la camera, deux en arriere et sept devant, et l'on
  // decale l'ensemble vers le bas de l'image, la ou il reste de la place.
  //
  // Le decalage se calcule, il ne se devine pas : selon la course, la piste
  // part en ligne droite ou dans un virage, et « avancer d'un metre » ne va
  // pas du tout dans la meme direction a l'ecran. On projette donc un metre
  // de piste, et on lit combien de metres valent le decalage voulu.
  const centre = T.pos(0, 3), suivant = T.pos(1, 3);
  const o = solid(centre[0], centre[1], 0), q = solid(suivant[0], suivant[1], 0);
  const parMetre = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1;
  // Le rang le plus proche se pose a un tiers d'ecran EN DECA de la camera :
  // les suivants reculent alors en travers du cadre au lieu d'en sortir par
  // le premier bord venu.
  const S0 = -0.34 * Math.min(G.VW, G.VH) / parMetre;

  // L'ORDRE DE LA VAGUE SE PREND A LA PROFONDEUR, pas au numero de la haie.
  // Sur la ligne droite, la haie suivante s'eloigne ; dans le virage, elle
  // part sur le cote. Trier par profondeur reelle donne la meme lecture dans
  // les deux cas : la vague ARRIVE sur le joueur, et repart en sens inverse.
  const rangs: { s: number; p: number }[] = [];
  for (let i = -2; i < HAIE.nombre - 2; i++) {
    const s = S0 + i * HAIE.ecart;
    const c = pointDuRang(T, s, T.curved ? T.radius(3) : largeurVoie * 3.5, largeurVoie);
    rangs.push({ s, p: depthOf(c[0], c[1]) });
  }
  rangs.sort((a, b) => b.p - a.p);

  // Le son part en une fois, a la premiere image du passage. TOUT EST DEBOUT
  // AU TIERS DU PASSAGE, et ce n'est pas negociable : la camera s'ebranle
  // lentement mais elle part, et une haie qui se leve quand le stade a deja
  // quitte la moitie de l'image se leve hors champ.
  const p = passageCourant();
  if (p !== passageSonore) {
    passageSonore = p;
    tairelesClaquements();
    if (p) programmerLesClaquements(A, cam, rangs.length, p.duree);
  }

  for (let k = 0; k < rangs.length; k++) {
    const niveau = niveauDuRang(cam, k, rangs.length);
    if (niveau <= 0.004) continue;
    for (let v = 0; v < COULOIRS; v++) {
      uneHaie(ctx, A, T, rangs[k].s, v, largeurVoie, HAIE.hauteur * niveau, accent);
    }
  }
}

/* ---------------------------------------------- la planche et le sable */

function laFosse(ctx: CanvasRenderingContext2D, A: Moteur, cam: Camera,
                 p: any, VW: number, VH: number, accent: string) {
  const { G, solid, scaleM } = A;
  const monde = versLeMonde(A);
  // La fosse doit se retrouver ICI quand la camera aura fini son travelling.
  const [rx, ry] = posePourArrivee(p, VW, VH, VW * 0.46, VH * 0.56);
  const [cx, cy] = monde(rx, ry);
  const m = scaleM();

  // On saute vers les X decroissants : sur cette projection, c'est le sens
  // ou la camera part. L'elan arrive donc par-derriere, le long de la piste.
  const demiLarge = 2.75 / 2;
  const sableHaut = cx + 4.5, sableBas = cx - 4.5;
  const planche = sableHaut + 1.0;

  // La piste d'elan : le meme couloir, qui ne cesse pas d'en etre un.
  dalle(ctx, A, planche + 0.1, cy - 0.61, planche + 15, cy + 0.61, '#8f4133');
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, 0.05 * m);
  trait(ctx, A, planche + 0.1, cy - 0.61, 0, planche + 15, cy - 0.61, 0);
  trait(ctx, A, planche + 0.1, cy + 0.61, 0, planche + 15, cy + 0.61, 0);

  // Le sable.
  dalle(ctx, A, sableBas, cy - demiLarge, sableHaut, cy + demiLarge, '#cdad7b');
  // Les traces du rateau, en travers : c'est ce qui fait la matiere.
  ctx.strokeStyle = 'rgba(148,116,72,0.45)';
  ctx.lineWidth = Math.max(1, 0.03 * m);
  for (let d = 0.35; d < 9; d += 0.42) {
    trait(ctx, A, sableHaut - d, cy - demiLarge, 0, sableHaut - d, cy + demiLarge, 0);
  }
  // La bordure du bac.
  ctx.strokeStyle = 'rgba(238,241,247,0.55)';
  ctx.lineWidth = Math.max(1, 0.06 * m);
  trait(ctx, A, sableBas, cy - demiLarge, 0, sableHaut, cy - demiLarge, 0);
  trait(ctx, A, sableBas, cy + demiLarge, 0, sableHaut, cy + demiLarge, 0);
  trait(ctx, A, sableBas, cy - demiLarge, 0, sableBas, cy + demiLarge, 0);

  // La planche d'appel : 1,22 sur 0,20, un metre avant le sable.
  dalle(ctx, A, planche - 0.10, cy - 0.61, planche + 0.10, cy + 0.61, '#f3f6fb');
  // Le bac a plasticine, juste derriere elle.
  dalle(ctx, A, planche - 0.20, cy - 0.61, planche - 0.10, cy + 0.61, accent);

  // LA POUSSIERE, au moment ou la camera se pose. C'est la seule chose qui
  // s'anime ici : la parabole de l'etape 1 retombe dans le sable a quatre
  // vingt-six pour cent du passage, et un atterrissage sans poussiere ne
  // s'entend pas.
  if (cam.sens !== 'aller' || cam.u < 0.80) return;
  const t = borne((cam.u - 0.80) / 0.20, 0, 1);
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const a = (i * 2.399) % 6.283;
    const px = sableHaut - 1.2 - Math.cos(a) * 0.9 * t * 2.2;
    const py = cy + Math.sin(a) * 1.1 * t * 1.8;
    const c = solid(px, py, 0.25 * t + 0.1);
    ctx.globalAlpha = 0.30 * (1 - t);
    ctx.fillStyle = '#d8bd8c';
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], (0.35 + 1.5 * t) * m, (0.18 + 0.75 * t) * m, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------- le cercle et la cage */

function leCercle(ctx: CanvasRenderingContext2D, A: Moteur, cam: Camera,
                  p: any, VW: number, VH: number, accent: string) {
  const { solid, scaleM } = A;
  const monde = versLeMonde(A);
  const [rx, ry] = posePourArrivee(p, VW, VH, VW * 0.5, VH * 0.60);
  const [cx, cy] = monde(rx, ry);
  const m = scaleM();
  const R = 2.135 / 2;

  const anneau = (rayon: number, z: number) => {
    ctx.beginPath();
    for (let i = 0; i <= 44; i++) {
      const a = (i / 44) * Math.PI * 2;
      const q = solid(cx + Math.cos(a) * rayon, cy + Math.sin(a) * rayon, z);
      i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
    }
    ctx.closePath();
  };

  // L'aire de chute, devant le cercle : le secteur de 34,92 degres. Il part
  // vers les X croissants, c'est-a-dire vers le fond de l'image.
  const demiSecteur = (34.92 / 2) * Math.PI / 180;
  const portee = 26;
  ctx.beginPath();
  {
    const o = solid(cx, cy, 0);
    const g = solid(cx + Math.cos(-demiSecteur) * portee, cy + Math.sin(-demiSecteur) * portee, 0);
    const d = solid(cx + Math.cos(demiSecteur) * portee, cy + Math.sin(demiSecteur) * portee, 0);
    ctx.moveTo(o[0], o[1]); ctx.lineTo(g[0], g[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.lineWidth = Math.max(1, 0.05 * m);
  ctx.stroke();

  // Le cercle lui-meme : beton, et son cercle d'acier.
  anneau(R, 0);
  ctx.fillStyle = '#6d6c73'; ctx.fill();
  ctx.strokeStyle = '#f6f8fc';
  ctx.lineWidth = Math.max(2.5, 0.07 * m);
  ctx.stroke();
  // Le butoir, a l'avant.
  {
    const a = solid(cx + Math.cos(-0.42) * R, cy + Math.sin(-0.42) * R, 0);
    const b = solid(cx + Math.cos(0.42) * R, cy + Math.sin(0.42) * R, 0.10);
    ctx.strokeStyle = '#f3f6fb'; ctx.lineWidth = Math.max(2, 0.10 * m);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }

  // La lueur du jeu, montee de l'interieur du cercle.
  {
    const o = solid(cx, cy, 0);
    const lueur = ctx.createRadialGradient(o[0], o[1], 0, o[0], o[1], 7 * m);
    lueur.addColorStop(0, accent.replace('rgb(', 'rgba(').replace(')', `,${0.30 * cam.part})`));
    lueur.addColorStop(1, accent.replace('rgb(', 'rgba(').replace(')', ',0)'));
    ctx.fillStyle = lueur;
    ctx.beginPath(); ctx.arc(o[0], o[1], 7 * m, 0, Math.PI * 2); ctx.fill();
  }

  // LA CAGE, qui descend. Elle entoure le cercle partout sauf devant, la ou
  // l'engin part : c'est exactement sa raison d'etre.
  const descente = borne((cam.part - 0.30) / 0.60, 0, 1);
  if (descente <= 0.002) return;
  const pose = 1 - Math.pow(1 - descente, 3);
  const zBas = (1 - pose) * 16, haut = 7;
  const Rc = 3.6;
  const a0 = demiSecteur + 0.25, a1 = Math.PI * 2 - demiSecteur - 0.25;
  const POTEAUX = 9;
  const angle = (i: number) => a0 + (a1 - a0) * (i / (POTEAUX - 1));

  // Le filet : une bande sombre et translucide, tendue entre les poteaux.
  ctx.beginPath();
  for (let i = 0; i < POTEAUX; i++) {
    const a = angle(i);
    const q = solid(cx + Math.cos(a) * Rc, cy + Math.sin(a) * Rc, zBas + haut);
    i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
  }
  for (let i = POTEAUX - 1; i >= 0; i--) {
    const a = angle(i);
    const q = solid(cx + Math.cos(a) * Rc, cy + Math.sin(a) * Rc, zBas);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(12,8,5,0.34)'; ctx.fill();

  // Les mailles : quelques cables horizontaux, les poteaux par-dessus.
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 1;
  for (const z of [1.2, 2.6, 4.0, 5.4]) {
    ctx.beginPath();
    for (let i = 0; i < POTEAUX; i++) {
      const a = angle(i);
      const q = solid(cx + Math.cos(a) * Rc, cy + Math.sin(a) * Rc, zBas + z);
      i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(206,214,229,0.65)';
  ctx.lineWidth = Math.max(1, 0.07 * m);
  for (let i = 0; i < POTEAUX; i++) {
    const a = angle(i);
    trait(ctx, A, cx + Math.cos(a) * Rc, cy + Math.sin(a) * Rc, zBas,
              cx + Math.cos(a) * Rc, cy + Math.sin(a) * Rc, zBas + haut);
  }
}

/* -------------------------------------------------------------- entree */

/**
 * Le materiel du jeu ou l'on va, dessine dans le repere de la camera.
 *
 * Appele APRES le voile, et volontairement : le stade se dissout dans la
 * couleur du jeu qu'on rejoint, et ce qui reste net dedans, c'est ce qu'on
 * vient y chercher.
 */
export function dessinerMateriel(
  ctx: CanvasRenderingContext2D, cam: Camera, VW: number, VH: number,
) {
  const A: Moteur = (globalThis as any).SprinterApp;
  if (!A || !A.G || !A.G.track || !A.solid) return;
  // Mouvement reduit : le passage se reduit a un fondu de teinte. Des haies
  // qui se dressent en cent vingt millisecondes seraient precisement ce que
  // ce reglage demande d'eviter — et le claquement avec.
  if (cam.doux) return;
  const p = passageCourant();
  if (!p) return;
  // Le materiel appartient au monde des concours, pas a Sprinter : au retour
  // c'est celui qu'on quitte qu'il faut habiller.
  const monde = p.sens === 'aller' ? p.vers : p.de;
  const accent = MONDES[monde].accent;

  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (cam.axe === 'bas') lesHaies(ctx, A, cam, accent);
  else if (cam.axe === 'droite') laFosse(ctx, A, cam, p, VW, VH, accent);
  else leCercle(ctx, A, cam, p, VW, VH, accent);
  ctx.restore();
}
