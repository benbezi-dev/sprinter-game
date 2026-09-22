// LE PHOTO-FINISH D'UNE COURSE DE CHAMPIONNAT.
//
// CE QUE C'EST, ET CE QUE CE N'EST PAS. Un photo-finish n'est pas une
// photographie de l'arrivee. C'est le releve d'une camera a fente : un capteur
// d'UNE colonne de pixels, braque sur le plan de la ligne, qui ecrit une
// colonne par milliseconde. L'image qui en sort n'a donc pas d'axe horizontal
// spatial — l'axe horizontal EST LE TEMPS. Deux coureurs eloignes sur l'image
// ne sont pas a deux endroits de la piste : ils y sont passes a deux instants.
//
// Trois conventions viennent de la, et les rater fait une image qui ressemble a
// un graphique au lieu d'un releve :
//
//   LE TEMPS DECROIT VERS LA DROITE. Le vainqueur est le plus a droite : sa
//     colonne a ete ecrite le plus tot. C'est la convention des releves
//     officiels, et elle surprend a la premiere lecture.
//   LA CAMERA EST AU BORD DE LA PISTE, a hauteur d'homme. Le couloir 8 est a
//     ses pieds, le couloir 1 de l'autre cote : les bandes se resserrent vers
//     le haut et les coureurs du fond sont plus petits. Huit bandes d'egale
//     hauteur donneraient un diagramme.
//   UN TRAIT ROUGE PAR COUREUR, pose sur le BUSTE. C'est le buste qui coupe le
//     plan et donne le chrono — ni la tete, ni le pied tendu qui arrive avant.
//     Le trait est donc l'instrument de lecture, pas une decoration.
//
// POURQUOI ON LE RECONSTRUIT AU LIEU DE LE FILMER. Le vrai procede demanderait
// une vue de face de la ligne, que le moteur ne sait pas rendre — sa camera est
// isometrique et suit le coureur — et de piloter la simulation pas a pas hors
// ecran. La reconstruction, elle, ne demande que les huit chronos : elle est
// donc exacte sur ce qui compte (l'ordre, les ecarts, l'echelle) et elle marche
// sur une serie que PERSONNE n'a regardee. Le jour ou le moteur saura filmer la
// ligne, ce fichier sera remplace sans que rien d'autre ne bouge — c'est le
// meme pari que `champ-rejeu` fait avec sa course reconstituee.
//
// QUAND IL APPARAIT. Jamais tout seul. Une arrivee etalee n'a rien a faire
// dans un releve : l'image ne dirait que ce que le tableau dit deja, en moins
// clair. Voir `arriveeSerree`.

import { policesPretes, sortir, type Sortie } from './affiche';
import { FOND, OR, or, ENCRE } from './palette-affiche';

const SprinterCore: any = (globalThis as any).SprinterCore;

/**
 * CE QUI REND UNE ARRIVEE « SERREE ».
 *
 * Un centieme entre deux places qui se suivent. Ce n'est pas un chiffre rond
 * choisi au hasard : les chronos officiels de l'athletisme sont donnes au
 * centieme, et c'est exactement le cas ou deux athletes affichent le meme et
 * ou la photo doit les departager. En dessous, l'image sert ; au-dessus, le
 * tableau suffit.
 *
 * La comparaison se fait sur des places QUI SE SUIVENT, et pas sur les deux
 * premiers : une finale peut se jouer a une seconde en tete et a trois
 * milliemes pour la troisieme place — et c'est cette troisieme place-la qu'on
 * veut voir.
 */
export const ECART_SERRE_MS = 10;

/** Le decor du rejeu de championnat, d'ou viennent les tenues. Voir champ-rejeu. */
const NIVEAU = 4;

export type LignePhoto = {
  /** Le couloir couru, 1 a 8. */
  couloir: number | null;
  nom: string;
  /** Le chrono, en millisecondes. `null` pour un abandon : il n'entre pas dans l'image. */
  ms: number | null;
  /** Le joueur de ce telephone, s'il courait cette course-la. */
  moi?: boolean;
};

export type CoursePhoto = {
  /** « Championnat de France ». */
  competition: string;
  /** « Serie 3 », « Demi-finale 1 », « Finale ». */
  nomCourse: string;
  /** '100', '200', '400'. */
  epreuve: string;
  /** L'heure de la course au calendrier de l'edition, ou `null`. */
  quand: number | null;
  lignes: LignePhoto[];
};

/**
 * Deux places qui se suivent sont-elles dans le meme centieme ?
 *
 * Les abandons sont ecartes avant la comparaison : ils n'ont pas de chrono, et
 * un `null` traite comme un zero ferait passer toutes les courses pour serrees.
 */
export function arriveeSerree(lignes: LignePhoto[]): boolean {
  const ms = lignes
    .map(l => l.ms)
    .filter((m): m is number => m != null)
    .sort((a, b) => a - b);
  for (let i = 1; i < ms.length; i++) {
    if (ms[i] - ms[i - 1] < ECART_SERRE_MS) return true;
  }
  return false;
}

/** Le plus petit ecart entre deux places qui se suivent, en ms. `null` s'il n'y a pas deux chronos. */
export function ecartLePlusSerre(lignes: LignePhoto[]): number | null {
  const ms = lignes
    .map(l => l.ms)
    .filter((m): m is number => m != null)
    .sort((a, b) => a - b);
  if (ms.length < 2) return null;
  let min = Infinity;
  for (let i = 1; i < ms.length; i++) min = Math.min(min, ms[i] - ms[i - 1]);
  return min;
}

/* ------------------------------------------------------------- les tenues */

type Tenue = {
  /** Le look du moteur, tel quel : c'est lui qui dessine le corps. */
  look: any;
  /** Ou en est la foulee, en radians. */
  stride: number;
  /** 0 a 1 entre MIN_H et MAX_H : de combien cet athlete est grand. */
  taille: number;
};

/**
 * LA TENUE VIENT DU MOTEUR, PAS DE CE FICHIER.
 *
 * `lookFor(nom, pool)` est ce qui habille deja le coureur sur la piste, et le
 * rejeu s'en sert pour repeindre les huit (voir `habiller` dans champ-rejeu).
 * Le releve lit la meme source : deux personnes qui viennent de regarder la
 * course doivent retrouver sur l'image le maillot qu'elles ont suivi des yeux.
 * Inventer une palette ici ferait huit inconnus.
 */
function tenueDe(l: LignePhoto): Tenue {
  const pool = SprinterCore?.LEVELS?.[NIVEAU]?.pool;
  const look = l.moi
    ? SprinterCore?.PLAYER_LOOK
    : SprinterCore?.lookFor?.(l.nom, pool);
  // La foulee : chacun est pris a un instant different de son cycle. Un hachage
  // du nom plutot qu'un tirage, pour que la meme course rende toujours la meme
  // image — on la repartage, on la compare, elle ne doit pas bouger.
  let h = 2166136261;
  for (let i = 0; i < l.nom.length; i++) { h ^= l.nom.charCodeAt(i); h = Math.imul(h, 16777619); }
  const phase = ((h >>> 0) % 1000) / 1000;
  return {
    look,
    stride: phase * Math.PI * 2,
    // 1,60 m a 2,00 m : l'ecart se voit sur l'image, et c'est juste qu'il s'y
    // voie — un grand et un petit ne rendent pas la meme silhouette.
    taille: look?.h ? (look.h - 1.6) / 0.4 : 0.5,
  };
}

/* --------------------------------------------------------- le coureur */

/**
 * LE PROFIL SAGITTAL : TROIS HUITIEMES DE TOUR, ET CE N'EST PAS UN COMPTE ROND.
 *
 * `personCapsules` prend le CAP du coureur : sa rotation autour de la verticale
 * DANS LE MONDE. Mais le monde du jeu n'est pas vu de face — la camera est
 * isometrique et sa projection ajoute sa propre rotation. Le profil a l'ECRAN
 * ne tombe donc pas sur un quart de tour, qui ne donne ici qu'un trois-quarts :
 * on y voit encore les deux bras et toute la largeur du torse.
 *
 * 135 degres placent le plan sagittal — celui qui separe la gauche de la droite
 * du corps — face au regard : un bras devant l'autre, les jambes en ciseaux
 * vues de cote, la tete de profil, et le coureur avance vers la droite,
 * c'est-a-dire vers les chronos les plus courts. C'est la vue d'une camera
 * plantee au bord de la piste, et donc celle d'un releve.
 *
 * CET ANGLE S'EST CHOISI A L'OEIL, sur une planche de sept caps dessines cote a
 * cote — il ne se deduit pas de la geometrie de la projection, parce que la
 * foulee tourne elle aussi les epaules et le bassin. Refaire cette planche est
 * le seul moyen honnete de le rejuger si le rendu des corps change.
 */
const CAP_PROFIL = (3 * Math.PI) / 4;

/**
 * UN COUREUR, DESSINE PAR LE MOTEUR DU JEU ET PAS PAR CE FICHIER.
 *
 * `personCapsules` + `drawFacetFigure` sont le rendu des personnages, sorti tel
 * quel du moteur — c'est deja par la que `tools/apercu-coureur.html` regarde
 * les corps hors course. L'image porte donc les VRAIS athletes : le meme
 * maillot, la meme carnation, les memes chaussures, le meme gabarit et la meme
 * foulee que sur la piste. Un dessin refait a la main ici aurait donne huit
 * inconnus a cote d'un jeu qui, lui, sait exactement a quoi ils ressemblent.
 *
 * `x` est l'abscisse du BUSTE, celle que le trait de lecture recoupe ; `ySol`
 * la ligne de son couloir, ou ses pieds se posent.
 */
function coureur(ctx: CanvasRenderingContext2D, x: number, ySol: number, h: number, t: Tenue) {
  const A: any = (globalThis as any).SprinterApp;
  if (!A?.personCapsules || !A?.drawFacetFigure || !A?.niveauDetail || !t.look) return;
  const perso = {
    look: t.look, stride: t.stride,
    // La vitesse ne sert qu'a la posture : a l'arrivee d'un 100 m, on court a
    // pleine vitesse, buste redresse. `drivePitch` a zero — la mise en action
    // est finie depuis quatre-vingts metres.
    v: 11.4, maxSpeed: 12, fallAnim: 0, celebrate: 0, drivePitch: 0,
  };
  ctx.save();
  ctx.translate(x, ySol);
  // L'ETIREMENT, ET SA MESURE. Un sprinter a 10 m/s devant une fente de
  // quelques millimetres sort a peine allonge. On reste donc a 1,18 : au-dela
  // on ne dessine plus un releve, on dessine un effet de vitesse.
  ctx.scale(1.18, 1);
  // Le quatrieme argument dit si le coureur est couche (chute), le cinquieme si
  // la piste tourne : ni l'un ni l'autre sur une ligne d'arrivee.
  const caps = A.personCapsules(perso, CAP_PROFIL, 0, false, false, A.niveauDetail(h));
  A.drawFacetFigure(ctx, caps, 0, 0, h);
  ctx.restore();
}

/* ------------------------------------------------------------- le releve */

function arrondi(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Le releve lui-meme : la bande, ses couloirs, ses coureurs, son echelle.
 *
 * `X, Y, L, H` delimitent l'IMAGE seule ; l'echelle du temps se pose sous elle
 * et deborde donc de `H`.
 */
export function dessinerReleve(
  ctx: CanvasRenderingContext2D, X: number, Y: number, L: number, H: number, c: CoursePhoto,
) {
  const partants = c.lignes.filter(l => l.ms != null && l.couloir != null);
  if (!partants.length) return;
  const chronos = partants.map(l => l.ms as number);
  const tMin = Math.min(...chronos), tMax = Math.max(...chronos);

  // LA FENETRE DE TEMPS, ET POURQUOI ELLE A UN PLANCHER.
  //
  // Sur une arrivee a trois milliemes, une fenetre calee sur les seuls chronos
  // ferait huit coureurs empiles au meme endroit : l'image ne montrerait plus
  // l'ecart, elle le cacherait. On garde donc une largeur minimale — assez pour
  // que deux graduations au centieme tiennent dans le cadre — et les coureurs
  // se retrouvent groupes au milieu, ce qui EST le sujet.
  const etale = Math.max(tMax - tMin, 45);
  const marge = etale * 0.30;
  const t0 = tMin - marge, t1 = tMax + marge;
  const xDe = (ms: number) => X + ((t1 - ms) / (t1 - t0)) * L;

  // Trois etages : le panneau du bord de piste, la piste hors couloirs, les
  // huit couloirs. Les coureurs des couloirs 1 et 2 montent dans les deux
  // etages du dessus — c'est ce qui donne la profondeur.
  const hPan = H * 0.115, yHors = Y + hPan, hHors = H * 0.145;
  const yCoul = yHors + hHors, hCoul = H - hPan - hHors;
  const bord = (i: number) => yCoul + hCoul * Math.pow(i / 8, 1.22);

  ctx.save();
  ctx.textBaseline = 'middle';

  // la piste, delavee : la fente ne laisse passer presque aucune lumiere
  const f = ctx.createLinearGradient(0, yHors, 0, Y + H);
  f.addColorStop(0, '#cfd3da'); f.addColorStop(0.4, '#e3e7ec'); f.addColorStop(1, '#b4b9c2');
  ctx.fillStyle = f; ctx.fillRect(X, yHors, L, H - hPan);

  // le panneau du bord de piste, qui bouche l'horizon
  ctx.fillStyle = '#eceef2'; ctx.fillRect(X, Y, L, hPan);
  ctx.fillStyle = 'rgba(104,28,84,0.9)';
  ctx.fillRect(X, Y + hPan * 0.14, L, hPan * 0.72);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `900 ${(hPan * 0.4).toFixed(0)}px Outfit, sans-serif`;
  ctx.textAlign = 'center';
  ctx.letterSpacing = `${(hPan * 0.09).toFixed(0)}px`;
  for (let i = 0; i < 4; i++) ctx.fillText('SPRINTER', X + L * (0.135 + i * 0.25), Y + hPan / 2);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#31363f'; ctx.fillRect(X, Y + hPan, L, 2.5);

  // les lignes de couloir
  for (let i = 0; i <= 8; i++) {
    ctx.fillStyle = 'rgba(38,42,50,0.5)';
    ctx.fillRect(X, bord(i), L, i === 0 || i === 8 ? 2.2 : 1.3);
  }

  // les coureurs, du fond vers l'avant : les plus proches recouvrent
  const parCouloir = [...partants].sort((a, b) => (a.couloir as number) - (b.couloir as number));
  parCouloir.forEach(l => {
    const i = (l.couloir as number) - 1;
    const t = tenueDe(l);
    // La bande du couloir donne l'echelle ; la taille de l'athlete la module.
    const h = (bord(i + 1) - bord(i)) * (2.25 + t.taille * 0.38);
    coureur(ctx, xDe(l.ms as number), bord(i + 1), h, t);
  });

  // LE GRAIN DE LA FENTE : l'image est faite de colonnes, et cela se voit.
  ctx.save();
  ctx.globalAlpha = 0.05; ctx.fillStyle = '#000';
  for (let x = X; x < X + L; x += 3) ctx.fillRect(x, yHors, 1, H - hPan);
  ctx.restore();

  // les traits de lecture, un par coureur, sur le buste
  parCouloir.forEach(l => {
    const x = xDe(l.ms as number);
    ctx.strokeStyle = 'rgba(214,31,31,0.9)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x, Y); ctx.lineTo(x, Y + H); ctx.stroke();
  });

  // la place, en cartouche au sommet de son trait. Le nom et le chrono sont
  // dans le tableau : l'image n'a pas a les porter deux fois.
  const places = [...partants].sort((a, b) => (a.ms as number) - (b.ms as number));
  ctx.textAlign = 'center';
  places.forEach((l, i) => {
    const x = xDe(l.ms as number), premier = i === 0;
    const w = hPan * 0.62, h = hPan * 0.48, y = Y + hPan - h - hPan * 0.1;
    ctx.fillStyle = premier ? OR : 'rgba(10,12,18,0.88)';
    arrondi(ctx, x - w / 2, y, w, h, h * 0.26); ctx.fill();
    ctx.fillStyle = premier ? FOND : '#fff';
    ctx.font = `900 ${(h * 0.66).toFixed(0)}px Outfit, sans-serif`;
    ctx.fillText(String(i + 1), x, y + h / 2 + 1);
  });

  // le numero de couloir, dans la marge gauche
  ctx.textAlign = 'right';
  parCouloir.forEach(l => {
    const i = (l.couloir as number) - 1;
    ctx.fillStyle = l.moi ? OR : 'rgba(255,255,255,0.5)';
    ctx.font = '700 15px "Space Mono", monospace';
    ctx.fillText(String(l.couloir), X - 10, (bord(i) + bord(i + 1)) / 2);
  });

  // L'ECHELLE DU TEMPS, sous l'image. Sans elle, une bande de coureurs ne dit
  // pas de combien ils sont separes — et c'est la seule chose qu'on lui demande.
  const yE = Y + H, hE = Math.max(34, H * 0.09);
  ctx.fillStyle = FOND; ctx.fillRect(X, yE, L, hE);
  ctx.textAlign = 'center';
  const pas = (t1 - t0) > 400 ? 20 : 10;
  const fort = (t1 - t0) > 400 ? 100 : 50;
  for (let ms = Math.ceil(t0 / pas) * pas; ms <= t1; ms += pas) {
    const x = xDe(ms), gros = ms % fort === 0;
    ctx.fillStyle = gros ? OR : 'rgba(255,255,255,0.4)';
    ctx.fillRect(x, yE, 1, gros ? hE * 0.3 : hE * 0.17);
    if (gros) {
      ctx.font = `700 ${(hE * 0.4).toFixed(0)}px "Space Mono", monospace`;
      ctx.fillText((ms / 1000).toFixed(2), x, yE + hE * 0.74);
    }
  }
  ctx.restore();
}

/* ---------------------------------------------------------- la carte */

/** La date et l'heure de la course, dans la langue du joueur. */
function quandEcrit(quand: number | null): string {
  if (quand == null) return '';
  try {
    const N: any = (globalThis as any).SprinterApp?.N;
    const lang = N?.getLang?.() === 'en' ? 'en-GB' : 'fr-FR';
    const d = new Date(quand);
    return d.toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

/** Le format partageable : portrait, celui des visuels du compte. */
export const LARGEUR = 1080;
export const HAUTEUR = 1500;

/**
 * Dessine la carte complete dans un canvas.
 *
 * Le releve seul ne se partage pas : hors du stade, personne ne sait lire une
 * bande sans savoir de quelle course il s'agit ni qui y court. La carte porte
 * donc l'en-tete de la competition au-dessus et l'ordre d'arrivee au-dessous —
 * et c'est le tableau, pas l'image, qui donne les noms et les milliemes.
 */
export function dessinerPhotoFinish(cv: HTMLCanvasElement, c: CoursePhoto) {
  cv.width = LARGEUR; cv.height = HAUTEUR;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const W = LARGEUR, H = HAUTEUR;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b1020'); g.addColorStop(1, FOND);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const lu = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.7);
  lu.addColorStop(0, or(0.13)); lu.addColorStop(1, or(0));
  ctx.fillStyle = lu; ctx.fillRect(0, 0, W, H * 0.38);

  const N: any = (globalThis as any).SprinterApp?.N;
  const t = (cle: string, secours: string) => {
    const v = N?.t?.(cle);
    return v && v !== cle ? v : secours;
  };

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '7px';
  ctx.fillStyle = `rgba(255,255,255,${ENCRE.surtitre})`;
  ctx.font = '700 19px Outfit, sans-serif';
  ctx.fillText(c.competition.toUpperCase(), W / 2, 88);
  ctx.letterSpacing = '4px';
  ctx.fillStyle = OR;
  ctx.font = '900 52px Outfit, sans-serif';
  ctx.fillText(`${c.nomCourse.toUpperCase()} · ${c.epreuve} M`, W / 2, 152);
  ctx.letterSpacing = '3px';
  ctx.fillStyle = `rgba(255,255,255,${ENCRE.etiquette * 0.85})`;
  ctx.font = '700 16px "Space Mono", monospace';
  const quand = quandEcrit(c.quand);
  if (quand) ctx.fillText(quand.toUpperCase(), W / 2, 188);
  ctx.letterSpacing = '0px';

  const ecart = ecartLePlusSerre(c.lignes);
  ctx.letterSpacing = '5px';
  ctx.fillStyle = OR;
  ctx.font = '900 17px Outfit, sans-serif';
  ctx.fillText(t('pf_titre', 'PHOTO-FINISH'), W / 2, 236);
  ctx.letterSpacing = '0px';

  dessinerReleve(ctx, 60, 268, 960, 430, c);

  // CE QUE L'IMAGE A DEPARTAGE, juste sous elle. C'est la legende du releve et
  // non un pied de carte : elle dit pourquoi cette image existe, et elle doit
  // se lire dans le meme regard que la bande.
  if (ecart != null) {
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,255,255,${ENCRE.lien})`;
    ctx.font = '700 17px "Space Mono", monospace';
    ctx.fillText(t('pf_ecart', 'ÉCART LE PLUS SERRÉ') + ' : '
      + (ecart / 1000).toFixed(3).replace('.', ',') + ' s', W / 2, 770);
  }

  // l'ordre d'arrivee
  const places = [...c.lignes]
    .filter(l => l.ms != null)
    .sort((a, b) => (a.ms as number) - (b.ms as number));
  let y = 812;
  const hL = 66, saut = 76;
  places.forEach((r, i) => {
    const premier = i === 0;
    ctx.fillStyle = premier ? or(0.13) : 'rgba(255,255,255,0.035)';
    arrondi(ctx, 60, y, 960, hL, 16); ctx.fill();
    ctx.strokeStyle = premier ? or(0.5) : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5; ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = premier ? OR : 'rgba(255,255,255,0.6)';
    ctx.font = '900 30px Outfit, sans-serif';
    ctx.fillText(String(i + 1), 104, y + hL / 2);

    // le couloir, dans sa case — la meme que le tableau d'arrivee du jeu
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
    arrondi(ctx, 144, y + 18, 30, 30, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '700 16px "Space Mono", monospace';
    ctx.fillText(r.couloir != null ? String(r.couloir) : '—', 159, y + hL / 2);

    ctx.textAlign = 'left';
    ctx.fillStyle = r.moi ? OR : '#e8ecf5';
    ctx.font = `${premier ? '900 27px' : '700 24px'} Outfit, sans-serif`;
    ctx.fillText(r.nom, 200, y + hL / 2);

    ctx.textAlign = 'right';
    ctx.fillStyle = premier ? OR : 'rgba(255,255,255,0.8)';
    ctx.font = '700 26px "Space Mono", monospace';
    ctx.fillText(((r.ms as number) / 1000).toFixed(3), 990, y + hL / 2);
    y += saut;
  });

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '5px';
  ctx.fillStyle = `rgba(255,255,255,${ENCRE.piedDroit})`;
  ctx.font = '700 17px Outfit, sans-serif';
  ctx.fillText('SPRINTER-GAME.COM', W / 2, H - 48);
  ctx.letterSpacing = '0px';
}

/* -------------------------------------------------------------- la sortie */

function nomDeFichier(c: CoursePhoto): string {
  const propre = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `photo-finish-${propre(c.competition)}-${propre(c.nomCourse)}.jpg`;
}

/** Fabrique l'image et la fait sortir de l'application. */
export async function partagerPhotoFinish(c: CoursePhoto): Promise<Sortie> {
  try {
    await policesPretes();
    const cv = document.createElement('canvas');
    dessinerPhotoFinish(cv, c);
    const blob = await new Promise<Blob | null>(r => cv.toBlob(b => r(b), 'image/jpeg', 0.92));
    if (!blob) return 'echec';
    return await sortir(blob, nomDeFichier(c));
  } catch {
    return 'echec';
  }
}
