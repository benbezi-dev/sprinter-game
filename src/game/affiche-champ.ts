// L'IMAGE D'UNE COURSE DE CHAMPIONNAT.
//
// La video raconte la course ; cette image-ci raconte son RESULTAT. Les deux
// ne servent pas le meme geste et ne partent pas au meme endroit : on envoie
// une video a quelqu'un qui va la regarder dix secondes, on poste une image
// que l'on lit d'un coup d'oeil en faisant defiler. Un jour de competition, un
// compte a besoin des deux.
//
// ELLE EST DE LA VOIX DES JOURS DE COMPETITION — bleu nuit, degrade orange,
// adresse en pastille — et non de la voix ordinaire du jeu. C'est la meme
// regle que pour le carton de fin de la video (voir `carton-film.ts`) et pour
// la meme raison : cette image tombe dans le fil a cote des cartes du compte,
// le meme jour, et deux voix pour un seul evenement se voient.
//
// LE FORMAT EST CELUI DU FIL : 1080 x 1350. C'est celui des cartes du compte
// (voir `FORMATS` dans tools/voix-competition.mjs), et une image qui sort du
// jeu n'a aucune raison d'etre recadree autrement que celles qu'on fabrique a
// cote.
//
// CE QU'ELLE NE FAIT PAS. Elle ne remplace pas l'affiche de fin de course du
// one shot (`affiche.ts`) : celle-la parle du joueur et de son chrono, dans la
// voix du jeu. Ici le sujet est la COURSE — huit noms, huit couloirs, huit
// chronos — et le joueur n'y est qu'une ligne parmi les autres, s'il y est.

import { AFFICHE, CHIFFRES, ecrire, largeur, tailler } from './pinceau-film';
import { dessinerCarte, policesDeLaCarte, type Carte } from './carte-resultats-jeu';
import { ENCRE, peindreLeFond, flammeSur } from './voix-competition';
import { policesPretes, sortir, type Sortie } from './affiche';

/** Le format du fil, celui des cartes du compte. */
const L = 1080;
const H = 1350;
const SITE = 'sprinter-game.com';

export type LigneArrivee = {
  place: number; nom: string; ms: number | null; couloir: number | null;
};

export type AfficheChamp = {
  /** « Championnat de France ». */
  competition: string;
  /** « Finale », « Série 3 » — au singulier, avec son numero. */
  course: string;
  /** L'epreuve, ecrite comme la charte l'ecrit : « 100 m ». */
  epreuve: string;
  /** L'heure de la course, prise au calendrier de l'edition. */
  quand: number | null;
  lignes: LigneArrivee[];
  /** Le mot du vainqueur, s'il en a laisse un. Le texte seul : une voix ne se dessine pas. */
  mot: { nom: string; texte: string } | null;
  /**
   * « LE MOT DU VAINQUEUR », dans la langue du joueur.
   *
   * Il arrive tout ecrit plutot que d'etre cherche ici : ce module dessine, il
   * ne traduit pas. Le carton de la video prend le meme libelle a la meme cle,
   * et les deux disent donc la meme chose le meme jour.
   */
  etiquetteMot?: string;
  /**
   * La carte des championnats (carte-resultats-jeu.ts). Presente, c'est elle
   * qui se dessine, au format story : la voix des cartes publiees.
   */
  carte?: Carte;
};

/** Le chrono, comme les cartes l'ecrivent : virgule en francais. */
function chrono(ms: number | null, fr: boolean): string {
  if (ms == null) return '—';
  const s = (ms / 1000).toFixed(3);
  return (fr ? s.replace('.', ',') : s) + ' s';
}

/**
 * Coupe un texte aux ESPACES pour qu'il tienne en `maxLignes`.
 *
 * Jamais au milieu d'un mot : une pique coupee en deux se lit deux fois. La
 * derniere ligne est tronquee par `tailler`, qui pose les points de suspension.
 */
function habiller(ctx: CanvasRenderingContext2D, texte: string, max: number,
                  e: any, maxLignes: number): string[] {
  const mots = String(texte || '').split(/\s+/).filter(Boolean);
  if (!mots.length) return [];
  const lignes: string[] = [];
  let courante = '';
  for (const m of mots) {
    const essai = courante ? courante + ' ' + m : m;
    if (largeur(ctx, essai, e) <= max || !courante) { courante = essai; continue; }
    lignes.push(courante);
    courante = m;
    if (lignes.length === maxLignes - 1) break;
  }
  const dejaPoses = lignes.join(' ').split(/\s+/).filter(Boolean).length;
  const reste = mots.slice(dejaPoses).join(' ');
  if (lignes.length < maxLignes) lignes.push(tailler(ctx, reste || courante, max, e));
  return lignes.slice(0, maxLignes);
}

/** La date et l'heure, a l'heure d'ici — le calendrier, lui, est en UTC. */
function quandEcrit(quand: number | null, lang: string): string {
  if (quand == null) return '';
  try {
    const d = new Date(quand);
    const j = d.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
    const h = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    return `${j} · ${h}`;
  } catch {
    return '';
  }
}

/** Une gelule, comme le `border-radius:999px` des cartes. */
function gelule(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + h, r);
  ctx.arcTo(x + l, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

export function dessiner(cv: HTMLCanvasElement, a: AfficheChamp, fr: boolean) {
  cv.width = L; cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx) return;

  peindreLeFond(ctx, L, H);

  const M = Math.round(L * 0.082);
  const dispo = L - M * 2;
  const cx = L / 2;

  // --- le kicker : de quelle competition il s'agit.
  let y = Math.round(H * 0.085);
  const eKick = { taille: 30, gras: 700, police: AFFICHE, couleur: ENCRE.kicker,
                  espace: 30 * 0.36, aligne: 'center' as CanvasTextAlign };
  ecrire(ctx, tailler(ctx, `${a.competition} · ${a.epreuve}`.toUpperCase(), dispo, eKick),
         cx, y, eKick);

  // --- le titre : la course. C'est le sujet, et il est en grand.
  y += 78;
  const eTitre = { taille: 96, gras: 900, police: AFFICHE,
                   couleur: flammeSur(ctx, M, y - 60, dispo, 96),
                   aligne: 'center' as CanvasTextAlign };
  ecrire(ctx, tailler(ctx, a.course.toUpperCase(), dispo, eTitre), cx, y, eTitre);

  const quand = quandEcrit(a.quand, fr ? 'fr-FR' : 'en-GB');
  if (quand) {
    y += 56;
    const e = { taille: 28, gras: 500, police: AFFICHE, couleur: ENCRE.sous,
                aligne: 'center' as CanvasTextAlign };
    ecrire(ctx, quand, cx, y, e);
  }

  /* --- LE TABLEAU. Huit lignes, et la premiere se distingue des sept autres :
     un classement ou le vainqueur a le meme poids que le huitieme ne se lit
     pas, il se dechiffre. Meme composition qu'a l'ecran — place, couloir, nom,
     chrono — parce que celui qui a vu la course doit retrouver ce qu'il a lu. */
  y += 76;
  const hL = 72, ecart = 10;
  for (const r of a.lignes.slice(0, 8)) {
    const premier = r.place === 1;
    ctx.save();
    ctx.fillStyle = premier ? 'rgba(247,160,60,0.13)' : 'rgba(255,255,255,0.035)';
    gelule(ctx, M, y, dispo, hL);
    ctx.fill();
    if (premier) {
      ctx.strokeStyle = 'rgba(251,196,78,0.55)';
      ctx.lineWidth = 2;
      gelule(ctx, M, y, dispo, hL);
      ctx.stroke();
    }
    ctx.restore();

    const cyL = y + hL / 2;
    const ePlace = { taille: premier ? 44 : 38, gras: 900, police: AFFICHE,
                     couleur: premier ? flammeSur(ctx, M + 28, y, 60, hL) : ENCRE.rang };
    ecrire(ctx, String(r.place), M + 34, cyL, ePlace);

    // Le couloir dans sa case : le meme chiffre, la meme graisse qu'a l'ecran.
    const xC = M + 104;
    ctx.save();
    ctx.strokeStyle = ENCRE.filet;
    ctx.lineWidth = 2;
    ctx.strokeRect(xC, cyL - 21, 42, 42);
    ctx.restore();
    const eC = { taille: 26, gras: 400, police: CHIFFRES, couleur: ENCRE.etiquette,
                 aligne: 'center' as CanvasTextAlign };
    ecrire(ctx, r.couloir == null ? '—' : String(r.couloir), xC + 21, cyL, eC);

    const eChrono = { taille: premier ? 40 : 36, gras: 700, police: CHIFFRES,
                      couleur: premier ? ENCRE.vif : ENCRE.doux,
                      aligne: 'right' as CanvasTextAlign };
    const txtChrono = chrono(r.ms, fr);
    ecrire(ctx, txtChrono, L - M - 32, cyL, eChrono);

    const eNom = { taille: premier ? 40 : 36, gras: premier ? 900 : 700, police: AFFICHE,
                   couleur: premier ? ENCRE.vif : ENCRE.doux };
    const placeNom = (L - M - 32) - largeur(ctx, txtChrono, eChrono) - 28 - (xC + 42 + 24);
    ecrire(ctx, tailler(ctx, r.nom, placeNom, eNom), xC + 42 + 24, cyL, eNom);

    y += hL + ecart;
  }

  /* --- LA PASTILLE SE MESURE AVANT LE MOT, ET NON APRES.
     Elle est posee a une hauteur fixe — c'est une signature de pied, elle ne
     flotte pas avec le contenu. Le mot, lui, varie : cent quarante caracteres
     tiennent sur deux lignes, dix sur une. Dessine sans savoir ou s'arrete la
     place libre, il passait DERRIERE la pastille sur les textes longs. On
     calcule donc le plancher d'abord, et le mot prend ce qui reste. */
  const ePast = { taille: 34, gras: 700, police: AFFICHE, couleur: ENCRE.surPastille,
                  aligne: 'center' as CanvasTextAlign };
  const lTexte = largeur(ctx, SITE, ePast);
  const padX = 52, padY = 26;
  const hPast = 34 + padY * 2;
  const yPast = H - Math.round(H * 0.070) - hPast;

  // --- le mot du vainqueur, s'il a parle.
  if (a.mot && a.mot.texte) {
    y += 28;
    const eQui = { taille: 24, gras: 700, police: AFFICHE,
                   couleur: flammeSur(ctx, M, y - 16, dispo, 24),
                   espace: 24 * 0.36, aligne: 'center' as CanvasTextAlign };
    const dit = a.etiquetteMot
      ? `${a.etiquetteMot} · ${a.mot.nom}`.toUpperCase()
      : a.mot.nom.toUpperCase();
    ecrire(ctx, tailler(ctx, dit, dispo, eQui), cx, y, eQui);
    y += 46;
    const e = { taille: 32, gras: 500, police: AFFICHE, couleur: ENCRE.sous,
                aligne: 'center' as CanvasTextAlign };
    // Ce qui reste entre la derniere ligne du tableau et la pastille, en
    // lignes entieres : une ligne coupee en deux par une pastille orange ne se
    // lit pas, et le mot vaut mieux tronque qu'illisible.
    const tiennent = Math.max(1, Math.min(2, Math.floor((yPast - 16 - y) / 44)));
    for (const ligne of habiller(ctx, `« ${a.mot.texte} »`, dispo, e, tiennent)) {
      ecrire(ctx, ligne, cx, y, e);
      y += 44;
    }
  }

  /* --- L'ADRESSE, EN PASTILLE. La signature de cette voix : sur un fond bleu
     nuit, une url orange se lit d'un coup d'oeil et c'est la derniere chose
     que l'oeil accroche avant de faire defiler. */
  const xPast = cx - (lTexte + padX * 2) / 2;
  ctx.save();
  ctx.fillStyle = flammeSur(ctx, xPast, yPast, lTexte + padX * 2, hPast);
  gelule(ctx, xPast, yPast, lTexte + padX * 2, hPast);
  ctx.fill();
  ctx.restore();
  ecrire(ctx, SITE, cx, yPast + hPast / 2, ePast);
}

/** Fabrique l'image et la fait sortir de l'application. */
export async function partagerLArrivee(a: AfficheChamp, fr: boolean): Promise<Sortie> {
  try {
    await policesPretes();
    const cv = document.createElement('canvas');
    if (a.carte) { await policesDeLaCarte(); dessinerCarte(cv, a.carte, fr); }
    else dessiner(cv, a, fr);
    const blob = await new Promise<Blob | null>(r => cv.toBlob(b => r(b), 'image/jpeg', 0.92));
    if (!blob) return 'echec';
    const nom = `sprinter-${a.course}-${a.epreuve}`
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return sortir(blob, `${nom}.jpg`);
  } catch {
    return 'echec';
  }
}
