// LE HUD, REPEINT POUR LE FILM.
//
// `review.ts` filme un canvas, et le canvas ne porte que le stade : la piste,
// les coureurs, la foule. Tout le reste de l'ecran — le chrono qui defile, le
// rang, le nom de l'epreuve, le decompte, « TRANSITION PARFAITE » — est du DOM
// React pose PAR-DESSUS, et `captureStream()` ne voit pas le DOM. La video
// sortait donc sans une seule de ces informations : une course muette, sans
// chrono, ou l'on ne sait ni qui court, ni depuis combien de temps, ni si
// c'etait bon.
//
// Il n'y a pas d'API pour filmer un ecran compose sans demander une permission
// de partage d'ecran au joueur, ce qui est hors de question au milieu d'une
// course. On REDESSINE donc le HUD, au pinceau, sur le montage que `review.ts`
// enregistre. Ce fichier est ce pinceau.
//
// DEUX REGLES QU'IL SE DONNE.
//
//   1. IL NE LIT QUE `G`. Pas de state React, pas d'abonnement : la surcouche
//      est appelee a chaque image, depuis la meme boucle que le jeu, et `G` est
//      la source que le moteur vient d'ecrire. Passer par React ajouterait une
//      image de retard au chrono — visible, sur un nombre qui change trente
//      fois par seconde.
//   2. IL NE TOMBE JAMAIS EN PANNE. Une erreur ici ne doit pas arreter un
//      enregistrement en cours ; l'appelant l'attrape (voir `Review.tracer`),
//      et ce qui manque manque, mais la course continue d'etre filmee.
//
// LES MESURES SONT CELLES DE `RaceHUD.tsx`, relevees sur l'appareil simule du
// harnais (405 x 720 points). Elles ne sont pas devinees : la barre fait 76 px
// parce que 8 de marge haute + 42 de rangee + 8 d'espace + 8 de reglette + 8 de
// marge basse + 2 de filet font 76. Le calcul est refait ici plutot que fige,
// pour qu'un ecran plus large — ou le palier `sm:` de Tailwind s'applique —
// donne les memes proportions et non un HUD decale.

import { SprinterApp } from './engine';
import { recordConnu, s2 } from './record';

/* ------------------------------------------------------------- la palette */

// Les valeurs de `index.css` et de Tailwind, en dur : un canvas ne sait pas
// lire une variable CSS, et `getComputedStyle` a chaque image coute une lecture
// de style par frame pour des couleurs qui ne bougent jamais.
const OR        = '#F8CD4A';  // --primary
const TEXTE     = '#EEF0F8';  // --foreground
const SOURDINE  = '#94A3B8';  // --muted-foreground
const CARTE     = '11, 15, 25';  // --card, en composantes pour les fonds voiles
const ROUGE     = '#EF4444';  // --destructive
const VERT      = '#34D399';  // emerald-400
const CYAN      = '#22D3EE';  // cyan-400
const CYAN_CLAIR= '#67E8F9';  // cyan-300
const FUCHSIA   = '#E879F9';  // fuchsia-400

const SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
const AFFICHE = 'Outfit, system-ui, sans-serif';
const CHIFFRES = '"Space Mono", ui-monospace, monospace';

/** Le palier `sm:` de Tailwind. En deca, les tailles de base. */
const SM = 640;

/* -------------------------------------------------------------- le pinceau */

type Ecriture = {
  taille: number; gras?: number; police?: string; couleur?: string;
  aligne?: CanvasTextAlign; espace?: number; alpha?: number; ombre?: boolean;
};

function poser(ctx: CanvasRenderingContext2D, e: Ecriture) {
  ctx.font = `${e.gras ?? 700} ${e.taille}px ${e.police || SANS}`;
  ctx.fillStyle = e.couleur || TEXTE;
  ctx.textAlign = e.aligne || 'left';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = e.alpha ?? 1;
  // `letterSpacing` manque sur les Safari d'avant 17.4. C'est du confort de
  // lecture, pas de l'information : on l'applique quand il existe et on passe.
  try { (ctx as any).letterSpacing = `${e.espace || 0}px`; } catch { /* tant pis */ }
  // En paysage le bandeau est transparent (voir RaceHUD) : le texte se pose
  // alors sur la pelouse, et sans cette ombre il devient illisible.
  ctx.shadowColor = e.ombre ? 'rgba(0,0,0,0.9)' : 'transparent';
  ctx.shadowBlur = e.ombre ? 3 : 0;
  ctx.shadowOffsetY = e.ombre ? 1 : 0;
}

/** Ecrit, et rend la largeur prise — de quoi empiler a droite. */
function ecrire(ctx: CanvasRenderingContext2D, s: string, x: number, y: number,
                e: Ecriture): number {
  poser(ctx, e);
  ctx.fillText(s, x, y);
  const w = ctx.measureText(s).width;
  ctx.globalAlpha = 1; ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  return w;
}

function largeur(ctx: CanvasRenderingContext2D, s: string, e: Ecriture): number {
  poser(ctx, e);
  const w = ctx.measureText(s).width;
  ctx.globalAlpha = 1;
  return w;
}

/**
 * Coupe un texte trop long, comme `truncate` le ferait.
 *
 * Le nom d'une epreuve — « Championnat du monde » — deborde sur le rang des
 * qu'on filme un ecran etroit. Le DOM y met des points de suspension ; on fait
 * pareil, plutot que d'ecrire par-dessus le chiffre.
 */
function tailler(ctx: CanvasRenderingContext2D, s: string, max: number, e: Ecriture): string {
  if (largeur(ctx, s, e) <= max) return s;
  let court = s;
  while (court.length > 1 && largeur(ctx, court + '…', e) > max) court = court.slice(0, -1);
  return court + '…';
}

/** Un rectangle a coins ronds, sans `roundRect` — absent des Safari anciens. */
function boite(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number) {
  const rr = Math.min(r, l / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + l, y, x + l, y + h, rr);
  ctx.arcTo(x + l, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + l, y, rr);
  ctx.closePath();
}

function remplir(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number,
                 r: number, fond: string, filet?: string) {
  boite(ctx, x, y, l, h, r);
  ctx.fillStyle = fond; ctx.fill();
  if (filet) { ctx.strokeStyle = filet; ctx.lineWidth = 1; ctx.stroke(); }
}

/** Une pastille de texte centree, comme les `rounded-full` du HUD. */
function pastille(ctx: CanvasRenderingContext2D, s: string, cx: number, y: number, h: number,
                  e: Ecriture, fond: string, filet?: string, padX = 16) {
  const l = largeur(ctx, s, e) + padX * 2;
  remplir(ctx, cx - l / 2, y, l, h, h / 2, fond, filet);
  ecrire(ctx, s, cx, y + h / 2, { ...e, aligne: 'center' });
  return l;
}

/* ------------------------------------------------------------- la peinture */

/**
 * Repeint le HUD de course sur le montage.
 *
 * `l` et `h` sont les dimensions en POINTS CSS, pas en pixels du film :
 * `review.ts` a deja mis le pinceau a l'echelle de l'appareil. On raisonne donc
 * avec les memes nombres que la feuille de style.
 */
export function peindreLeHud(ctx: CanvasRenderingContext2D, l: number, h: number) {
  const G: any = SprinterApp.G;
  const N: any = SprinterApp.N;
  const C: any = SprinterApp.C;
  const etat = G?.state;
  // Le HUD n'existe qu'en course : `App.tsx` ne le monte que pour 'count' et
  // 'race'. Le film suit exactement la meme regle — sans quoi il porterait un
  // chrono par-dessus l'ecran de resultat.
  if (etat !== 'count' && etat !== 'race') return;
  const p = G.player;
  if (!p || !N || !C) return;

  const sm = l >= SM;
  const paysage = l > h;
  const M = 16;

  // L'ORDRE EST CELUI DES PLANS DU HUD, et il compte : le bandeau du fantome
  // et l'ecart au voisin sont en `z-10`, les retours de course en `z-0`, le
  // decompte en `z-20`. En paysage ces trois-la se chevauchent — le bandeau
  // commence a 46 points, les retours a 80 — et c'est le bandeau qui gagne a
  // l'ecran. Peindre dans l'ordre inverse ferait un film qui ne ressemble pas
  // au jeu a l'endroit meme ou le joueur regardait.
  barreDuHaut(ctx, l, { G, N, C, p, sm, paysage, M, etat });
  retours(ctx, l, { G, N, C, p, sm, paysage });
  if (etat === 'race' && G.ghost && !p.finished) bandeauFantome(ctx, l, { G, N, p, M, paysage });
  if (etat === 'race') ecartAuVoisin(ctx, l, { G, N, p, sm, M, paysage });
  if (etat === 'count') starterAuMilieu(ctx, l, h, { G, N, sm });
}

/* --------------------------------------------------------- la barre du haut */

function barreDuHaut(ctx: CanvasRenderingContext2D, l: number, o: any) {
  const { G, N, C, p, sm, paysage, M, etat } = o;

  // En paysage le rang passe en `text-sm` a peine gras : la place va a la
  // course, pas au chiffre. Voir `landscape:!text-sm` dans RaceHUD.
  const tRang    = paysage ? 14 : sm ? 24 : 20;   // text-xl / sm:text-2xl
  const tChrono  = sm ? 30 : 24;   // text-2xl / sm:text-3xl
  const tPetit   = sm ? 12 : 10;   // text-[10px] / sm:text-xs
  const tRecord  = sm ? 9 : 8;
  const padY     = sm ? 12 : 8;    // py-2 / sm:py-3

  const hRang = tRang * 1.4;
  const hChrono = tChrono * 1.333;
  const colChrono = hChrono + 2 + tRecord;     // gap-0.5
  const rangee = Math.max(hRang, colChrono);
  const yBarre = padY + rangee + 8;            // gap-y-2
  const hautBarre = yBarre + 8 + padY + 2;     // reglette + marge + filet

  // En paysage le bandeau s'efface : la course a besoin de toute la hauteur, et
  // le texte se defend a l'ombre (voir RaceHUD, `landscape:bg-transparent`).
  if (!paysage) {
    ctx.fillStyle = `rgba(${CARTE}, 0.8)`;
    ctx.fillRect(0, 0, l, hautBarre - 2);
    ctx.fillStyle = 'rgba(248, 205, 74, 0.5)';
    ctx.fillRect(0, hautBarre - 2, l, 2);
  }
  const ombre = paysage;

  const cy = padY + rangee / 2;
  const demi = (l - 2 * M) / 2;

  // --- a gauche : l'epreuve, puis le rang.
  const rang = classement(G, p);
  const txtRang = N.ord(rang);
  const eRang = { taille: tRang, gras: paysage ? 600 : 900, police: AFFICHE,
                  couleur: rang === 1 ? OR : TEXTE, ombre };
  const lRang = largeur(ctx, txtRang, eRang);
  ecrire(ctx, txtRang, M + demi, cy, { ...eRang, aligne: 'right' });

  const eNiveau = { taille: tPetit, gras: 700, couleur: SOURDINE, espace: 1, ombre };
  const niveau = String(N.levelName(G.levelIdx) || '').toUpperCase();
  ecrire(ctx, tailler(ctx, niveau, demi - 8 - lRang, eNiveau), M, cy, eNiveau);

  // --- a droite : la phase, le chrono, le record.
  const droite = l - M;
  const ph = p.phase ? p.phase() : 0;

  // LE CHRONO, ET SA COULEUR. Elle repond a la seule question qu'on se pose en
  // courant : « est-ce que je suis dans mon record ? ». Vert tant qu'il est
  // atteignable, rouge des qu'il ne l'est plus. Un film qui garderait le nombre
  // mais perdrait sa couleur perdrait la moitie de ce qu'il raconte.
  const recordMs = record(G);
  const chronoMs = (G.elapsed || 0) * 1000;
  const enCourse = etat === 'race';
  const couleurChrono = !enCourse || recordMs === null ? OR
    : chronoMs <= recordMs ? VERT : ROUGE;

  const eChrono = { taille: tChrono, gras: 900, police: CHIFFRES,
                    couleur: couleurChrono, aligne: 'right' as CanvasTextAlign, ombre };
  const txtChrono = (G.elapsed || 0).toFixed(2);
  const yChrono = padY + hChrono / 2;
  const lChrono = ecrire(ctx, txtChrono, droite, yChrono, eChrono);

  let lCol = lChrono;
  if (recordMs !== null) {
    const perdu = chronoMs > recordMs && enCourse;
    const eRec = { taille: tRecord, gras: 700, police: CHIFFRES, espace: 0.8,
                   couleur: perdu ? ROUGE : SOURDINE, alpha: perdu ? 0.7 : 1,
                   aligne: 'right' as CanvasTextAlign, ombre };
    const txtRec = `${N.t('pb_label')} ${s2(recordMs)}`;
    lCol = Math.max(lCol, largeur(ctx, txtRec, eRec));
    ecrire(ctx, txtRec, droite, padY + hChrono + 2 + tRecord / 2, eRec);
  }

  const cPhase = ph === 0 ? OR : ph === 1 ? CYAN : SOURDINE;
  ecrire(ctx, String(N.t(['phase_drive', 'phase_trans', 'phase_max'][ph])).toUpperCase(),
         droite - lCol - 8, cy,
         { taille: tPetit, gras: 700, couleur: cPhase, espace: 1, aligne: 'right', ombre });

  // --- la reglette de progression. Retiree en paysage, comme dans le HUD.
  if (paysage) return;
  const total = (G.track && G.track.total) || 100;
  const lRegle = Math.min(l - 2 * M, 280);
  const xRegle = (l - lRegle) / 2;
  remplir(ctx, xRegle, yBarre, lRegle, 8, 4, 'rgba(0,0,0,0.5)', 'rgba(255,255,255,0.1)');
  const dedans = lRegle - 2;
  ctx.save();
  boite(ctx, xRegle + 1, yBarre + 1, dedans, 6, 3); ctx.clip();
  ctx.fillStyle = 'rgba(248,205,74,0.2)';
  ctx.fillRect(xRegle + 1, yBarre + 1, dedans * (C.DRIVE_END / total), 6);
  ctx.fillStyle = 'rgba(34,211,238,0.2)';
  ctx.fillRect(xRegle + 1 + dedans * (C.DRIVE_END / total), yBarre + 1,
               dedans * ((C.TRANS_END - C.DRIVE_END) / total), 6);
  ctx.fillStyle = OR;
  ctx.fillRect(xRegle + 1, yBarre + 1, dedans * (Math.min(p.d || 0, total) / total), 6);
  ctx.restore();
}

/* ------------------------------------------------------------ les fantomes */

function bandeauFantome(ctx: CanvasRenderingContext2D, l: number, o: any) {
  const { G, N, p, M, paysage } = o;
  const gr = G.ghost && G.ghost.runner;
  if (!gr) return;
  const total = (G.track && G.track.total) || 100;
  const ecartM = (p.d || 0) - (gr.d || 0);
  const v = p.v || 0;
  const ecartS = v > 2 ? ecartM / v : null;
  const devant = ecartM > 0.15, derriere = ecartM < -0.15;
  const teinte = devant ? VERT : derriere ? ROUGE : CYAN_CLAIR;

  const lb = Math.min(l - 2 * M, 300);
  const x = (l - lb) / 2, y = paysage ? 46 : 104, hb = 58;
  remplir(ctx, x, y, lb, hb, 16,
          devant ? 'rgba(52,211,153,0.12)' : derriere ? 'rgba(239,68,68,0.12)' : 'rgba(0,0,0,0.5)',
          devant ? 'rgba(52,211,153,0.5)' : derriere ? 'rgba(239,68,68,0.5)' : 'rgba(34,211,238,0.4)');

  const e9 = { taille: 9, gras: 700, espace: 1.2 };
  ecrire(ctx, String(G.ghostName || N.t('ghost_mode')).slice(0, 18), x + 12, y + 12,
         { ...e9, couleur: CYAN_CLAIR, alpha: 0.9 });
  ecrire(ctx, String(devant ? N.t('ghost_ahead') : derriere ? N.t('ghost_behind') : N.t('ghost_level')),
         x + lb - 12, y + 12, { ...e9, couleur: devant ? VERT : derriere ? ROUGE : SOURDINE, aligne: 'right' });

  const txtM = `${ecartM > 0 ? '+' : ''}${ecartM.toFixed(1)} m`;
  const txtS = ecartS !== null ? `${ecartS > 0 ? '+' : ''}${ecartS.toFixed(2)} s` : '';
  const eM = { taille: 20, gras: 900, police: CHIFFRES, couleur: teinte };
  const eS = { taille: 11, police: CHIFFRES, gras: 400, couleur: TEXTE, alpha: 0.7 };
  const lTot = largeur(ctx, txtM, eM) + (txtS ? 8 + largeur(ctx, txtS, eS) : 0);
  const x0 = x + (lb - lTot) / 2;
  const lM = ecrire(ctx, txtM, x0, y + 32, eM);
  if (txtS) ecrire(ctx, txtS, x0 + lM + 8, y + 34, eS);

  // Les deux coureurs sur la meme reglette.
  const xr = x + 12, lr = lb - 24, yr = y + 46;
  remplir(ctx, xr, yr, lr, 6, 3, 'rgba(0,0,0,0.6)', 'rgba(255,255,255,0.1)');
  const pctG = Math.min(1, (gr.d || 0) / total), pctP = Math.min(1, (p.d || 0) / total);
  ctx.fillStyle = 'rgba(34,211,238,0.4)';
  ctx.fillRect(xr + 1, yr + 1, (lr - 2) * pctG, 4);
  ctx.fillStyle = CYAN_CLAIR; ctx.fillRect(xr + (lr - 3) * pctG, yr + 1, 3, 4);
  ctx.fillStyle = OR;         ctx.fillRect(xr + (lr - 3) * pctP, yr + 1, 3, 4);
}

/* --------------------------------------------------------- l'ecart au voisin */

function ecartAuVoisin(ctx: CanvasRenderingContext2D, l: number, o: any) {
  const { G, p, sm, M, paysage } = o;
  const ordre = ordreDeCourse(G);
  const moi = ordre.indexOf(p);
  const autre = moi === 0 ? ordre[1] : ordre[moi - 1];
  if (!autre) return;

  const t = sm ? 12 : 10;
  const e = { taille: t, gras: 700, espace: 0.25 };
  const gap = (autre.d || 0) - (p.d || 0);
  const couleur = gap > 0 ? ROUGE : VERT;
  const txtGap = `${gap > 0 ? '+' : ''}${gap.toFixed(1)} m`;
  const nom = autre.isPlayer ? '' : String(autre.name || '').split(' ')[0];

  const padX = sm ? 12 : 8, hb = sm ? 27 : 25;
  const lg = largeur(ctx, txtGap, e);
  const ln = nom ? largeur(ctx, nom, e) : 0;
  const lb = padX * 2 + lg + (nom ? 6 + ln : 0);
  const x = l - M - lb, y = paysage ? 70 : 110;

  remplir(ctx, x, y, lb, hb, 8, `rgba(${CARTE}, 0.8)`, 'rgba(255,255,255,0.1)');
  ecrire(ctx, txtGap, x + padX, y + hb / 2, { ...e, couleur });
  if (nom) ecrire(ctx, nom, x + padX + lg + 6, y + hb / 2, { ...e, couleur, alpha: 0.8 });
}

/* ------------------------------------------------------------- les retours */

/**
 * Ce que le jeu dit au joueur pendant qu'il court.
 *
 * Reaction, transition, chute, faux depart : ce sont les seuls moments ou la
 * course commente elle-meme, et ils durent une seconde. Un replay qui les perd
 * garde les jambes et jette le recit — c'est ce qui distingue une bonne course
 * d'une course rapide.
 */
function retours(ctx: CanvasRenderingContext2D, l: number, o: any) {
  const { G, N, C, p, sm, paysage } = o;
  const cx = l / 2;
  let y = paysage ? 80 : 130;

  const bloc = (titre: string, cTitre: string, tTitre: number,
                sous: string | null, cSous: string, alpha: number) => {
    const e = { taille: tTitre, gras: 900, couleur: cTitre, espace: tTitre * 0.1, alpha, ombre: true };
    ecrire(ctx, titre, cx, y + tTitre * 0.78, { ...e, aligne: 'center' });
    y += tTitre * 1.55;
    if (sous) {
      y += 4;
      const eS = { taille: sm ? 14 : 12, gras: 700, police: CHIFFRES, couleur: cSous, espace: 0.3, alpha };
      const hS = (sm ? 14 : 12) * 1.7;
      pastille(ctx, sous, cx, y, hS, eS, `rgba(0,0,0,${0.5 * alpha})`, undefined, 10);
      y += hS;
    }
  };

  if (G.falseFlash > 0)
    bloc(String(N.t('false_start')), ROUGE, sm ? 24 : 20, null, '', Math.min(G.falseFlash, 1));

  if (G.stumbleFlash > 0)
    bloc(String(N.t('stumble')).toUpperCase(), ROUGE, sm ? 30 : 24, null, '',
         Math.min(G.stumbleFlash, 1));

  if (G.reactFlash > 0 && p.reaction !== null && !p.jumped) {
    const top = p.reactBonus > C.REACT_BONUS * 0.82;
    bloc(String(N.t(top ? 'react_top' : 'reaction')).toUpperCase(), top ? OR : TEXTE,
         sm ? 18 : 16,
         `${p.reaction.toFixed(3)} s  +${p.reactBonus.toFixed(2)} m/s`, CYAN,
         Math.min(G.reactFlash, 1));
  }

  if (G.transFlash > 0 && p.transGrade !== null) {
    y += 8;                                   // mt-2
    const g = p.transGrade;
    bloc(String(N.t(`trans_${g}`)).toUpperCase(),
         g === 2 ? OR : g === 1 ? VERT : SOURDINE, sm ? 20 : 18,
         g > 0 ? `+${C.TRANS_BOOST[g].toFixed(2)} m/s  —  ${Math.round((1 - C.TRANS_DRAG[g]) * 100)}% drag` : null,
         CYAN, Math.min(G.transFlash, 1));
  }

  const ph = p.phase ? p.phase() : 0;
  if (ph === 0 && (G.elapsed || 0) > 0.1 && G.transFlash <= 0 && G.reactFlash <= 0 && !p.finished) {
    y += 16;
    ecrire(ctx, String(N.t('drive_hint')).toUpperCase(), cx, y + 6,
           { taille: sm ? 14 : 12, gras: 500, couleur: SOURDINE, espace: 1.2,
             aligne: 'center', ombre: true });
  }
}

/* -------------------------------------------------------------- le starter */

/**
 * L'ECRAN DU DEPART, TEL QUE LE STARTER LE FAIT.
 *
 * Il n'y a pas de nombre a peindre : le decompte a cede la place a un starter
 * qui appelle les marques, demande le « pret », et tire quand il veut. Le film
 * doit garder cette attente — c'est elle qui fait la sortie des blocs, et un
 * replay qui commencerait au coup de feu perdrait la seule seconde ou le
 * spectateur retient son souffle.
 *
 * `G.depart.dit` vaut 0 (rien), 1 (« a vos marques »), 2 (« pret »). C'est la
 * source du moteur ; le magasin React l'expose sous le nom `starter`.
 */
function starterAuMilieu(ctx: CanvasRenderingContext2D, l: number, h: number, o: any) {
  const { G, N, sm } = o;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, l, h);

  const cx = l / 2;
  const pret = (G.depart ? G.depart.dit : 0) >= 2;

  const tMot = sm ? 36 : 24;                 // text-2xl / sm:text-4xl
  const padX = sm ? 40 : 20, padY = sm ? 20 : 12;
  const eMot = { taille: tMot, gras: 900, police: AFFICHE, espace: tMot * 0.1,
                 couleur: pret ? OR : '#FFFFFF', aligne: 'center' as CanvasTextAlign };
  const mot = String(N.t(pret ? 'get_set' : 'ready'));
  const lCarte = Math.min(l * 0.92, largeur(ctx, mot, eMot) + padX * 2);
  const hCarte = tMot + padY * 2;

  const tAttente = sm ? 12 : 10;
  const hAttente = tAttente * 1.5;
  const multiple = G.mode === 'oneshot' && (G.shotRaces || []).length > 1;
  const hEpreuve = multiple ? (sm ? 12 : 10) * 1.5 + (sm ? 32 : 16) : 0;
  const rival = leRival(G);
  const hRival = rival ? (sm ? 33 : 29) + 24 : 0;
  const hFantome = G.ghostName ? (sm ? 12 : 10) * 1.5 + (sm ? 10 : 9) * 1.5 + 8 : 0;

  let y = (h - (hCarte + 12 + hAttente + hEpreuve + hRival + hFantome)) / 2;

  // Le « pret » respire, comme `animate-pulse` le fait a l'ecran : deux
  // secondes de cycle, jamais en dessous de la moitie. Sans lui, le film
  // montrerait un panneau fige la ou le joueur voyait un signal vivant.
  const souffle = pret ? 0.75 + 0.25 * Math.cos(performance.now() / 1000 * Math.PI) : 1;
  ctx.globalAlpha = souffle;
  remplir(ctx, cx - lCarte / 2, y, lCarte, hCarte, 16,
          pret ? 'rgba(248,205,74,0.15)' : `rgba(${CARTE}, 0.6)`,
          pret ? OR : 'rgba(255,255,255,0.25)');
  ctx.lineWidth = 2;
  boite(ctx, cx - lCarte / 2, y, lCarte, hCarte, 16);
  ctx.strokeStyle = pret ? OR : 'rgba(255,255,255,0.25)';
  ctx.stroke();
  ecrire(ctx, mot, cx, y + hCarte / 2, { ...eMot, alpha: souffle, ombre: !pret });
  ctx.globalAlpha = 1;
  y += hCarte + 12;

  // La seule regle qui compte tant qu'il n'a pas tire.
  ecrire(ctx, String(N.t('wait_gun')).toUpperCase(), cx, y + hAttente / 2,
         { taille: tAttente, gras: 700, couleur: SOURDINE, espace: 1.2, aligne: 'center' });
  y += hAttente;

  if (multiple) {
    y += sm ? 32 : 16;
    ecrire(ctx, String(N.t('event_n', { n: G.shotIdx + 1, t: G.shotRaces.length })).toUpperCase(),
           cx, y, { taille: sm ? 12 : 10, gras: 700, couleur: OR, alpha: 0.8,
                    espace: 1, aligne: 'center' });
    y += (sm ? 12 : 10) * 1.5;
  }

  if (rival) {
    y += 24;
    // Un defi RECU se court a l'aveugle : le nom, jamais le chrono. Meme regle
    // que le HUD — voir RaceHUD, `aveugle`.
    const txt = G.challenge
      ? `${N.t('to_race')}${rival.nom}`
      : `${N.t('to_beat')}${rival.nom} — ${rival.temps.toFixed(2)} s`;
    pastille(ctx, txt, cx, y, sm ? 33 : 29,
             { taille: sm ? 12 : 10, gras: 700, espace: 1,
               couleur: G.ghostName ? CYAN_CLAIR : FUCHSIA },
             'rgba(0,0,0,0.6)',
             G.ghostName ? 'rgba(34,211,238,0.4)' : 'rgba(232,121,249,0.3)');
    y += sm ? 33 : 29;
  }

  // « MODE FANTOME · il court sa course, pas la tienne ». Deux lignes qui
  // disent contre QUOI l'on court — sans elles, un spectateur du replay prend
  // le fantome pour un adversaire ordinaire.
  if (G.ghostName) {
    y += 8;
    const t1 = sm ? 12 : 10, t2 = sm ? 10 : 9;
    ecrire(ctx, String(N.t('ghost_mode')).toUpperCase(), cx, y + t1 * 0.75,
           { taille: t1, gras: 900, couleur: CYAN_CLAIR, espace: t1 * 0.3, aligne: 'center' });
    y += t1 * 1.5;
    ecrire(ctx, String(N.t('ghost_live')), cx, y + t2 * 0.75,
           { taille: t2, gras: 400, couleur: SOURDINE, espace: 0.5, aligne: 'center' });
  }
}

/* --------------------------------------------------------------- le detail */

/** L'ordre de course, exactement celui du HUD. */
function ordreDeCourse(G: any): any[] {
  return [...(G.runners || [])].sort((a, b) => {
    const fa = a.finished ? 0 : 1, fb = b.finished ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.finished ? a.finishTime - b.finishTime : b.d - a.d;
  });
}

function classement(G: any, p: any): number {
  return ordreDeCourse(G).indexOf(p) + 1;
}

/**
 * Le record de l'epreuve, sans reveiller le reseau.
 *
 * `recordConnu` lit le cache deja rempli par le HUD — la course tourne, il a
 * ete demande bien avant le pistolet. On ne declenche surtout pas de requete
 * ici : cette fonction est appelee a chaque image.
 */
function record(G: any): number | null {
  try { return recordConnu(G.raceKey).ms; } catch { return null; }
}

function leRival(G: any): { nom: string; temps: number } | null {
  const split = (G.ghostSplits || [])[G.shotIdx];
  if (G.ghostName && split != null) return { nom: G.ghostName, temps: split };
  if (G.champion) return { nom: G.champion, temps: G.championTime || 0 };
  return null;
}
