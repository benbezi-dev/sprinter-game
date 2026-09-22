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
import { lireLeBandeau, quandDeLaCourse } from './bandeau-rejeu';
import { recordConnu, s2 } from './record';
import { DEPART_STARTER } from './canal';
import {
  OR, TEXTE, SOURDINE, CARTE, ROUGE, VERT, CYAN, CYAN_CLAIR, FUCHSIA,
  AFFICHE, CHIFFRES, SM, MD,
  ecrire, largeur, tailler, boite, remplir, pastille,
} from './pinceau-film';

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
  if (etat === 'race' && !G.rejeu) ecartAuVoisin(ctx, l, { G, N, p, sm, M, paysage });
  if (etat === 'count') departAuMilieu(ctx, l, h, { G, N, sm });
  if (G.rejeu) rappelDesCouloirs(ctx, l, h, { G, sm });
  pileDuBas(ctx, l, h, { G, N, sm });
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

  // CE QUE LE FILM DIT D'UNE COURSE QU'ON REGARDE.
  //
  // Le HUD du jeu se tait sur trois points des qu'on regarde au lieu de courir
  // (voir `RaceHUD`) : le nom du niveau cede la place a celui de la course, la
  // phase de foulee disparait, et la jauge de poussee avec. Le pinceau, lui,
  // les peignait tous les trois — une video de Championnat de France sortait
  // donc avec « ZEZE.GAMES » ecrit en haut a gauche et « VITESSE MAX » a
  // droite. Il lit maintenant le meme en-tete que l'ecran.
  //
  // Il se lit AVANT les mesures parce qu'il en change : ses trois lignes
  // descendent plus bas que le record qu'elles remplacent, et une barre
  // dimensionnee sans elles les laisserait deborder sur la piste.
  const bandeau = G.rejeu ? lireLeBandeau() : null;
  const tBandeau = sm ? 9 : 8;
  const lignesBandeau = bandeau
    ? 1 + (bandeau.course ? 1 : 0) + (quandDeLaCourse(bandeau.quand) ? 1 : 0)
    : 0;

  const hRang = tRang * 1.4;
  const hChrono = tChrono * 1.333;
  const colChrono = hChrono + 2
    + (bandeau ? lignesBandeau * (tBandeau + 2) : tRecord);   // gap-0.5
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
  const niveau = String(
    (bandeau ? bandeau.course : N.levelName(G.levelIdx)) || '').toUpperCase();
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
  // L'EN-TETE DE LA RETRANSMISSION, sous le chrono.
  //
  // C'est le seul endroit du film qui dise ce qu'on regarde pendant qu'on le
  // regarde : la video part hors du jeu, et le carton de fin arrive une
  // seconde et demie trop tard pour celui qui decroche avant. Mesures et
  // position sont celles de `RaceHUD` — le record occupe cette place quand il
  // y en a un, et il n'y en a jamais sur une course qu'on regarde, donc les
  // deux ne se disputent pas la ligne.
  if (bandeau) {
    let yB = padY + hChrono + 2 + tBandeau / 2;
    const ligne = (txt: string, style: any) => {
      lCol = Math.max(lCol, ecrire(ctx, txt, droite, yB, style));
      yB += tBandeau + 2;
    };
    ligne(bandeau.competition.toUpperCase(),
          { taille: tBandeau, gras: 700, espace: 1.5, couleur: OR, alpha: 0.8,
            aligne: 'right' as CanvasTextAlign, ombre });
    // SERIE, DEMI-FINALE OU FINALE. Douze des treize courses d'un championnat
    // ne sont pas la finale : une video qui ne le dirait pas laisserait croire
    // a chaque fois qu'on regarde le titre se jouer.
    if (bandeau.course) {
      ligne(bandeau.course.toUpperCase(),
            { taille: tBandeau, gras: 700, espace: 1.5, couleur: TEXTE, alpha: 0.7,
              aligne: 'right' as CanvasTextAlign, ombre });
    }
    const quand = quandDeLaCourse(bandeau.quand);
    if (quand) {
      ligne(quand, { taille: tBandeau, gras: 700, police: CHIFFRES, couleur: SOURDINE,
                     alpha: 0.8, aligne: 'right' as CanvasTextAlign, ombre });
    }
  }
  if (recordMs !== null) {
    const perdu = chronoMs > recordMs && enCourse;
    const eRec = { taille: tRecord, gras: 700, police: CHIFFRES, espace: 0.8,
                   couleur: perdu ? ROUGE : SOURDINE, alpha: perdu ? 0.7 : 1,
                   aligne: 'right' as CanvasTextAlign, ombre };
    const txtRec = `${N.t('pb_label')} ${s2(recordMs)}`;
    lCol = Math.max(lCol, largeur(ctx, txtRec, eRec));
    ecrire(ctx, txtRec, droite, padY + hChrono + 2 + tRecord / 2, eRec);
  }

  if (!bandeau) {
    const cPhase = ph === 0 ? OR : ph === 1 ? CYAN : SOURDINE;
    ecrire(ctx, String(N.t(['phase_drive', 'phase_trans', 'phase_max'][ph])).toUpperCase(),
           droite - lCol - 8, cy,
           { taille: tPetit, gras: 700, couleur: cPhase, espace: 1, aligne: 'right', ombre });
  }

  // --- la reglette de progression. Retiree en paysage, comme dans le HUD —
  // et retiree aussi sur une course qu'on regarde : « la jauge de poussee est
  // un instrument de pilotage ; sur une course qu'on regarde, c'est une barre
  // qui avance toute seule » (RaceHUD, qui la masque deja). Le film la peignait
  // quand meme, et montrait donc un instrument que l'ecran venait de retirer.
  if (paysage || G.rejeu) return;
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

/* --------------------------------------------------- le rappel des couloirs */

/**
 * QUI EST QUI, DANS LA VIDEO.
 *
 * L'ecran repond a la question depuis le debut : un bandeau bas, couloir et
 * nom, les quatre premieres secondes de course (`RappelCouloirs`). La VIDEO,
 * elle, ne repondait rien — ce bandeau est du DOM React, et `captureStream()`
 * ne voit que le canevas. Un film de championnat sortait donc avec huit
 * inconnus sur une piste : ni etiquette au-dessus des tetes, ni cerceau au sol
 * (le rejeu les retire), ni liste de depart. Celui qui recevait la video ne
 * pouvait identifier personne, pas meme celui qui la lui envoyait.
 *
 * On le repeint donc ici, aux memes mesures et sur la meme regle de duree. La
 * grille se relit dans `G.runners` plutot que dans l'etat du rejeu : c'est la
 * meme source — l'etat la construit depuis la piste — et cela evite au pinceau
 * d'importer `champ-rejeu`, qui le reimporterait par `film-course`.
 */
const RAPPEL_MS = 4000;
/** Le fondu de sortie, comme celui de `RappelCouloirs` (0,5 s). */
const RAPPEL_FONDU_MS = 500;

function rappelDesCouloirs(ctx: CanvasRenderingContext2D, l: number, h: number, o: any) {
  const { G, sm } = o;
  const ecoule = (G.elapsed || 0) * 1000;
  if (ecoule >= RAPPEL_MS + RAPPEL_FONDU_MS) return;
  const alpha = ecoule <= RAPPEL_MS ? 1 : 1 - (ecoule - RAPPEL_MS) / RAPPEL_FONDU_MS;

  const grille = (G.runners || [])
    .map((r: any) => ({ couloir: r.lane + 1, nom: String(r.name || '') }))
    .sort((a: any, b: any) => a.couloir - b.couloir);
  if (!grille.length) return;

  // Quatre colonnes, comme a l'ecran : huit noms sur deux lignes tiennent sous
  // la course sans jamais monter dans le cadre ou les coureurs passent.
  const COLS = 4;
  const lignes = Math.ceil(grille.length / COLS);
  const t = sm ? 10 : 9;
  const hLigne = t + 3;
  const padX = 10, padY2 = 6;
  const lb = Math.min(l - 24, 380);
  const hb = lignes * hLigne + 2 * padY2;
  const x = (l - lb) / 2;
  const y = h - 16 - hb;

  ctx.save();
  ctx.globalAlpha = alpha;
  remplir(ctx, x, y, lb, hb, 8, 'rgba(0,0,0,0.45)');
  const lCol = (lb - 2 * padX) / COLS;
  grille.forEach((c: any, i: number) => {
    const cx = x + padX + (i % COLS) * lCol;
    const cy = y + padY2 + Math.floor(i / COLS) * hLigne + hLigne / 2;
    const eNum = { taille: t - 1, gras: 400, police: CHIFFRES, couleur: 'rgba(255,255,255,0.40)' };
    const lNum = ecrire(ctx, String(c.couloir), cx, cy, eNum);
    const eNom = { taille: t - 1, gras: 600, couleur: 'rgba(255,255,255,0.75)', espace: 0.3 };
    ecrire(ctx, tailler(ctx, c.nom, lCol - lNum - 8, eNom), cx + lNum + 4, cy, eNom);
  });
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

  // Le faux depart n'est plus peint ici : il vit dans la pile du bas, au-dessus
  // des touches, comme dans RaceHUD.

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

/* ------------------------------------------------- le depart, dans le film */

/**
 * L'ECRAN DU DEPART, TEL QUE LE JEU LE MONTRE.
 *
 * Le film doit garder l'attente : c'est elle qui fait la sortie des blocs, et
 * un replay qui commencerait au signal perdrait la seule seconde ou le
 * spectateur retient son souffle.
 *
 * Le jeu compte : un cercle, une seconde dedans, qui enfle a mesure qu'elle
 * s'use — sur les deux canaux, le depart etant toujours cale sur le 3, 2, 1.
 * Le canal de test ajoute au-dessus la commande du starter : `G.depart.dit`
 * vaut 1 (« a vos marques ») ou 2 (« pret ») ; c'est la source du moteur,
 * que le magasin React expose sous le nom `starter`.
 *
 * Sans voile sur l'image, comme a l'ecran : les coureurs dans leurs blocs et
 * le starter sont justement ce que ces trois secondes ont a montrer. Et plus
 * au milieu : le chiffre se tient AU-DESSUS de la ligne de depart, et
 * l'adversaire au-dessus des touches — voir `pileDuBas`.
 */
function departAuMilieu(ctx: CanvasRenderingContext2D, l: number, h: number, o: any) {
  const { G, N, sm } = o;
  const md = l >= MD;
  // `[@media(max-height:500px)]` : un telephone en paysage.
  const court = h <= 500;
  const paysage = l > h;

  const cx = l / 2;
  const pret = (G.depart ? G.depart.dit : 0) >= 2;

  // text-lg / sm:text-2xl / md:text-4xl, et text-xl sur un ecran court
  const tMot = court ? 20 : md ? 36 : sm ? 24 : 18;
  const padX = court ? 16 : md ? 28 : 16, padY = court ? 6 : md ? 12 : 8;
  const eMot = { taille: tMot, gras: 900, police: AFFICHE, espace: tMot * 0.1,
                 couleur: pret ? OR : '#FFFFFF', aligne: 'center' as CanvasTextAlign };
  const mot = String(N.t(pret ? 'get_set' : 'ready'));
  const lCarte = Math.min(l * 0.92, largeur(ctx, mot, eMot) + padX * 2);
  const diam = court ? 64 : md ? 160 : sm ? 128 : 96;
  const avecCarte = DEPART_STARTER && (G.depart ? G.depart.dit : 0) >= 1;
  const hCarte = avecCarte ? tMot + padY * 2 : 0;
  const multiple = G.mode === 'oneshot' && (G.shotRaces || []).length > 1;

  // Le haut de la pile : 8,5 rem sous le bord en portrait (le bandeau du HUD
  // est au-dessus), 7,5 % de la hauteur en paysage, jamais moins de 2,75 rem.
  let y = paysage ? Math.max(h * 0.075, 44) : 136;

  if (avecCarte) {
    // Le « pret » respire, comme `animate-pulse` le fait a l'ecran : deux
    // secondes de cycle, jamais en dessous de la moitie. Sans lui, le film
    // montrerait un panneau fige la ou le joueur voyait un signal vivant.
    const souffle = pret ? 0.75 + 0.25 * Math.cos(performance.now() / 1000 * Math.PI) : 1;
    ctx.globalAlpha = souffle;
    remplir(ctx, cx - lCarte / 2, y, lCarte, hCarte, 12,
            pret ? 'rgba(248,205,74,0.15)' : `rgba(${CARTE}, 0.6)`,
            pret ? OR : 'rgba(255,255,255,0.25)');
    ctx.lineWidth = 2;
    boite(ctx, cx - lCarte / 2, y, lCarte, hCarte, 12);
    ctx.strokeStyle = pret ? OR : 'rgba(255,255,255,0.25)';
    ctx.stroke();
    ecrire(ctx, mot, cx, y + hCarte / 2, { ...eMot, alpha: souffle, ombre: !pret });
    ctx.globalAlpha = 1;
    y += hCarte + (court ? 8 : md ? 20 : 12);
  }
  {
    // LE CERCLE DU DECOMPTE. Il enfle a mesure que la seconde s'use — c'est ce
    // que fait le `transform: scale` du HUD, et le film le refait ici pour que
    // le depart s'y voie venir comme il se voyait venir a l'ecran.
    const reste = 3 - (G.countT || 0);
    const n = Math.ceil(reste);
    const frac = reste - Math.floor(reste);
    const r = diam / 2 * (1 + 0.1 * (1 - frac));
    const cy = y + diam / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${CARTE}, 0.6)`;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = OR;
    ctx.stroke();
    if (n > 0) {
      const tNombre = court ? 30 : md ? 72 : sm ? 60 : 36;  // text-4xl / sm:text-6xl / md:text-7xl
      ecrire(ctx, String(n), cx, cy, {
        taille: tNombre, gras: 900, police: AFFICHE, espace: -tNombre * 0.03,
        couleur: '#FFFFFF', aligne: 'center', ombre: true });
    }
    y += diam;
  }

  if (multiple) {
    y += md ? 20 : 12;
    const t = md ? 14 : sm ? 12 : 10;
    ecrire(ctx, String(N.t('event_n', { n: G.shotIdx + 1, t: G.shotRaces.length })).toUpperCase(),
           cx, y + t * 0.75, { taille: t, gras: 700, couleur: OR, alpha: 0.8,
                               espace: 1, aligne: 'center', ombre: true });
  }
}

/**
 * LA PILE DU BAS : le faux depart, et pendant le decompte l'adversaire.
 *
 * Posee au-dessus des touches — 20 % de la hauteur en portrait, 17 % en
 * paysage, entre 70 et 250 points — plus 3 rem, comme dans RaceHUD. Le film
 * n'a pas de touches, mais il garde leur place : c'est l'ecran du joueur
 * qu'il rejoue, pas un autre.
 */
function pileDuBas(ctx: CanvasRenderingContext2D, l: number, h: number, o: any) {
  const { G, N, sm } = o;
  const md = l >= MD;
  const paysage = l > h;
  const cx = l / 2;
  const enDecompte = G.state === 'count';
  const rival = enDecompte ? leRival(G) : null;
  const fantome = enDecompte && !!G.ghostName;
  const faux = G.falseFlash > 0;
  if (!faux && !rival && !fantome) return;

  const ecart = md ? 12 : 8;
  const tFaux = md ? 30 : sm ? 24 : 20, hFaux = md ? 36 : sm ? 32 : 28;
  const hRival = sm ? 33 : 29;
  const t1 = sm ? 12 : 10, t2 = sm ? 10 : 9;
  const hFantome = t1 * 1.5 + t2 * 1.5 + 2;
  const morceaux = [faux ? hFaux : 0, rival ? hRival : 0, fantome ? hFantome : 0].filter(v => v > 0);
  const hPile = morceaux.reduce((s, v) => s + v, 0) + ecart * (morceaux.length - 1);
  const touches = Math.min(Math.max((paysage ? 0.17 : 0.20) * h, 70), 250);
  let y = h - touches - 48 - hPile;

  if (faux) {
    ecrire(ctx, String(N.t('false_start')), cx, y + hFaux / 2,
           { taille: tFaux, gras: 900, couleur: ROUGE, espace: tFaux * 0.1,
             alpha: Math.min(G.falseFlash, 1), aligne: 'center', ombre: true });
    y += hFaux + ecart;
  }

  if (rival) {
    // Un defi RECU se court a l'aveugle : le nom, jamais le chrono. Meme regle
    // que le HUD — voir RaceHUD, `aveugle`.
    const txt = G.challenge
      ? `${N.t('to_race')}${rival.nom}`
      : `${N.t('to_beat')}${rival.nom} — ${rival.temps.toFixed(2)} s`;
    pastille(ctx, txt, cx, y, hRival,
             { taille: sm ? 12 : 10, gras: 700, espace: 1,
               couleur: G.ghostName ? CYAN_CLAIR : FUCHSIA },
             'rgba(0,0,0,0.6)',
             G.ghostName ? 'rgba(34,211,238,0.4)' : 'rgba(232,121,249,0.3)');
    y += hRival + ecart;
  }

  // « MODE FANTOME · il court sa course, pas la tienne ». Deux lignes qui
  // disent contre QUOI l'on court — sans elles, un spectateur du replay prend
  // le fantome pour un adversaire ordinaire.
  if (fantome) {
    ecrire(ctx, String(N.t('ghost_mode')).toUpperCase(), cx, y + t1 * 0.75,
           { taille: t1, gras: 900, couleur: CYAN_CLAIR, espace: t1 * 0.3, aligne: 'center', ombre: true });
    y += t1 * 1.5;
    ecrire(ctx, String(N.t('ghost_live')), cx, y + t2 * 0.75,
           { taille: t2, gras: 400, couleur: TEXTE, alpha: 0.75, espace: 0.5, aligne: 'center', ombre: true });
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
