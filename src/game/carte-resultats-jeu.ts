/* ===========================================================================
   LA CARTE « RÉSULTATS » D'UNE COURSE DE CHAMPIONNAT, DESSINEE DANS LE JEU.

   L'image que le jeu faisait sortir (« L'image du résultat ») avait sa propre
   voix — titre en flamme orange, Outfit, pastille — alors que les cartes
   publiees pour le championnat en ont une autre : fond de nuit a diagonales
   dorees, titres en Oswald dont la seconde ligne est en or, surtitre rouge,
   tableau a filets, jauge des places directes, pied explicatif et SPRINTER en
   or (tools/carte-resultats.mjs, dans sprinter-game-ceremonie). L'organisateur
   veut une seule voix (26/09) : c'est celle des cartes, reproduite ici au
   pinceau, dans le meme format story (1080 x 1920) et avec les memes regles.

   Memes couleurs, memes polices (Oswald, Space Mono, Work Sans), memes
   accroches tirees des chiffres : l'ecart entre les deux premiers choisit le
   titre (« au millième près », « sans appel »), un faux depart s'ecrit s'il a
   eu lieu, les absents a l'appel se comptent.
=========================================================================== */
import { ecrire, largeur, tailler, type Ecriture } from './pinceau-film';

/* Les couleurs des cartes (`:root` de carte-resultats.mjs). */
export const C = {
  fond: '#060913', or: '#F8CD4A', or2: '#C9A43A', texte: '#F1F2F6', gris: '#8E97AE',
  carte: '#0C1324', bord: '#1F2A45', bleu: '#1B2745', rouge: '#E5484D', acc: '#C7CDDB',
};
export const OSWALD = 'Oswald, "Arial Narrow", sans-serif';
export const MONO = '"Space Mono", ui-monospace, monospace';
export const WORK = '"Work Sans", system-ui, sans-serif';

/* Le format story et ses mesures (`V` de carte-resultats.mjs, STORY). */
const L = 1080, H = 1920, TOP = 250, BAS = 250, MX = 78, U = 28;

export type LigneCarte = {
  nom: string; ms: number | null;
  /** 'faux_depart' | 'forfait' | 'abandon' pour qui n'a pas de chrono. */
  motif?: string | null;
};

export type Carte = {
  /** 'series' | 'demies' | 'finale'. */
  phase: string;
  numero: number;
  /** L'heure de la course (calendrier de l'edition). */
  quand: number | null;
  /** « Champion de France », pour la finale. */
  titreChampion?: string;
  /** Le drapeau de la zone, pose devant chaque nom (edition nationale). */
  drapeau?: string;
  lignes: LigneCarte[];
};

const COURSES: Record<string, number> = { series: 4, demies: 2, finale: 1 };
const DIRECTS: Record<string, number> = { series: 2, demies: 2, finale: 0 };
const PAR_COURSE = 8;
/** Les revelations, en minutes UTC apres minuit du jour de la course (CALENDRIER). */
const REVELATION_UTC: Record<string, number> = { series: 19 * 60, demies: 14 * 60 + 30 };
const MOTIF: Record<string, string> = { faux_depart: 'DQ', forfait: 'DNS', abandon: 'DNF' };

export const deux = (n: number) => String(n).padStart(2, '0');
const ecartTxt = (ms: number, fr: boolean) => {
  const s = (Math.abs(ms) / 1000).toFixed(Math.abs(ms) < 10 ? 3 : 2);
  return fr ? s.replace('.', ',') : s;
};
export const chronoTxt = (ms: number, fr: boolean) => {
  const s = (ms / 1000).toFixed(3);
  return fr ? s.replace('.', ',') : s;
};
export function jourHeure(t: number | null, fr: boolean): { jour: string; heure: string } {
  if (t == null) return { jour: '', heure: '' };
  try {
    const lang = fr ? 'fr-FR' : 'en-GB';
    return {
      jour: new Date(t).toLocaleDateString(lang, { weekday: 'long', timeZone: 'Europe/Paris' }),
      heure: new Date(t).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }),
    };
  } catch { return { jour: '', heure: '' }; }
}

/* ------------------------------------------------------------- le fond */

export function peindreFond(ctx: CanvasRenderingContext2D, L = 1080, H = 1920) {
  ctx.fillStyle = C.fond;
  ctx.fillRect(0, 0, L, H);
  // Le halo dore en haut, le bleu de nuit en bas (les deux radial-gradient).
  const halo = (cx: number, cy: number, rx: number, ry: number, couleur: string) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, couleur);
    g.addColorStop(0.7, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  };
  halo(L / 2, H * 0.06, 1000, 620, 'rgba(248,205,74,0.17)');
  halo(L / 2, H * 1.2, 1200, 700, 'rgba(27,39,69,0.55)');
  // Les diagonales : repeating-linear-gradient(-62deg, … 118px, or .035 3px).
  ctx.save();
  ctx.strokeStyle = 'rgba(248,205,74,0.035)';
  ctx.lineWidth = 3;
  const a = (-62 + 90) * Math.PI / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const pas = 121 / Math.abs(Math.sin((62) * Math.PI / 180));
  // Les raies montent vers la droite, comme sur les cartes.
  for (let x = -H * 2; x < L + H * 2; x += pas) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + dx / dy * H, 0);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------- le texte riche */

type Morceau = { t: string; b?: boolean };

/** Ecrit un paragraphe a morceaux gras, coupe aux espaces, et rend le y suivant. */
function paragraphe(ctx: CanvasRenderingContext2D, morceaux: Morceau[], x: number, y: number,
                    max: number, taille: number, interligne: number, couleur: string = C.acc): number {
  const eN: Ecriture = { taille, gras: 400, police: WORK, couleur };
  const eB: Ecriture = { taille, gras: 700, police: WORK, couleur: C.texte };
  const mots: { t: string; b: boolean }[] = [];
  for (const m of morceaux) for (const w of m.t.split(/(\s+)/)) if (w) mots.push({ t: w, b: !!m.b });
  let lx = x, ly = y;
  for (const w of mots) {
    const e = w.b ? eB : eN;
    const l = largeur(ctx, w.t, e);
    if (/^\s+$/.test(w.t)) { if (lx > x) lx += l; continue; }
    if (lx + l > x + max && lx > x) { lx = x; ly += interligne; }
    ecrire(ctx, w.t, lx, ly, e);
    lx += l;
  }
  return ly + interligne;
}

export function arrondi(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + h, r);
  ctx.arcTo(x + l, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

/* ----------------------------------------------------------- la carte */

export function dessinerCarte(cv: HTMLCanvasElement, c: Carte, fr: boolean) {
  cv.width = L; cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  peindreFond(ctx);

  const finale = c.phase === 'finale';
  const directs = DIRECTS[c.phase] ?? 0;
  const arr = c.lignes.filter(l => l.ms != null).sort((a, b) => a.ms! - b.ms!);
  const hors = c.lignes.filter(l => l.ms == null);
  const [p1, p2] = arr;
  const ec = p1 && p2 ? p2.ms! - p1.ms! : null;
  const fd = hors.filter(h => h.motif === 'faux_depart');
  const ns = hors.filter(h => h.motif === 'forfait');
  const w = L - MX * 2;
  const dr = c.drapeau ? c.drapeau + ' ' : '';

  // L'ACCROCHE, tiree des chiffres de la course (memes seuils que les cartes).
  const champion = (c.titreChampion || (fr ? 'Champion de France' : 'French Champion')).split(' ');
  const [sur, l1, l2] = finale
    ? [fr ? 'LA FINALE · 8 PARTANTS' : 'THE FINAL · 8 RUNNERS', champion[0], champion.slice(1).join(' ')]
    : ec != null && ec < 10 ? ['PHOTO-FINISH', fr ? 'Au millième' : 'By a', fr ? 'près' : 'thousandth']
    : ec != null && ec < 50 ? [fr ? 'UNE POITRINE D\'ÉCART' : 'BY A CHEST', fr ? 'À la' : 'On the', fr ? 'poitrine' : 'dip']
    : fd.length ? [fr ? 'FAUX DÉPART · CARTON ROUGE' : 'FALSE START · RED CARD', fr ? 'Un départ' : 'One start', fr ? 'de trop' : 'too many']
    : ec != null && ec >= 150 ? ['DOMINATION', fr ? 'Sans' : 'No', fr ? 'appel' : 'contest']
    : ['VERDICT', fr ? 'La ligne' : 'The line', fr ? 'a parlé' : 'has spoken'];

  let y = TOP;

  // --- le kicker : « SÉRIE 3 / 4 »  …  « SAMEDI 16:00 ».
  const eK: Ecriture = { taille: 26, gras: 700, police: MONO, couleur: C.or, espace: 26 * 0.3 };
  const nomTour = finale ? (fr ? 'FINALE' : 'FINAL')
    : `${(c.phase === 'series' ? (fr ? 'SÉRIE' : 'HEAT') : (fr ? 'DEMIE' : 'SEMI'))} ${c.numero} / ${COURSES[c.phase] ?? 1}`;
  ecrire(ctx, nomTour, MX, y + 13, eK);
  const { jour, heure } = jourHeure(c.quand, fr);
  if (jour) {
    ecrire(ctx, `${jour} ${heure}`.toUpperCase(), L - MX, y + 13,
           { ...eK, couleur: C.gris, aligne: 'right' });
  }
  y += 26;

  // --- le surtitre rouge.
  y += Math.round(U * 1.1);
  ecrire(ctx, `${fr ? 'RÉSULTATS' : 'RESULTS'} · ${sur}`, MX, y + 12,
         { taille: 24, gras: 700, police: MONO, couleur: C.rouge, espace: 24 * 0.24 });
  y += 24;

  // --- le titre : deux lignes en Oswald, la seconde en or. Ajuste a la largeur.
  y += 30;
  let t1 = 104;
  const mesurer = (t: number) => Math.max(
    largeur(ctx, l1.toUpperCase(), { taille: t, gras: 700, police: OSWALD }),
    largeur(ctx, l2.toUpperCase(), { taille: t, gras: 700, police: OSWALD }));
  while (mesurer(t1) > w && t1 > 40) t1 -= 2;
  const lh = Math.round(t1 * 0.95);
  ecrire(ctx, l1.toUpperCase(), MX, y + lh / 2, { taille: t1, gras: 700, police: OSWALD, couleur: C.texte });
  ecrire(ctx, l2.toUpperCase(), MX, y + lh * 1.5, { taille: t1, gras: 700, police: OSWALD, couleur: C.or });
  y += lh * 2;

  // --- l'accroche en phrase.
  y += Math.round(U * 0.9) + 16;
  const m: Morceau[] = [];
  if (p1) {
    m.push({ t: p1.nom, b: true }, { t: finale ? (fr ? ' est sacré en ' : ' is crowned in ') : (fr ? ' gagne en ' : ' wins in ') },
           { t: chronoTxt(p1.ms!, fr), b: true });
    if (p2) m.push({ t: ', ' }, { t: `${ecartTxt(ec!, fr)} s`, b: true }, { t: fr ? ' devant ' : ' ahead of ' }, { t: p2.nom, b: true });
    m.push({ t: '.' });
  }
  if (directs && arr.length >= directs) {
    m.push({ t: fr
      ? ` Les ${directs} premiers passent ${c.phase === 'series' ? 'en demi-finale' : 'en finale'}.`
      : ` The top ${directs} go through to the ${c.phase === 'series' ? 'semi-final' : 'final'}.` });
  }
  if (fd.length) m.push({ t: ' ' }, { t: fr ? `${fd.length} faux départ${fd.length > 1 ? 's' : ''}` : `${fd.length} false start${fd.length > 1 ? 's' : ''}`, b: true }, { t: '.' });
  if (ns.length) m.push({ t: ' ' }, { t: fr ? `${ns.length} absent${ns.length > 1 ? 's' : ''}` : `${ns.length} no-show${ns.length > 1 ? 's' : ''}`, b: true }, { t: fr ? ' à l\'appel.' : ' at the call.' });
  y = paragraphe(ctx, m, MX, y, Math.min(900, w), 31, Math.round(31 * 1.38));

  // --- le duel des deux premiers.
  if (p1 && p2) {
    y += Math.round(U * 1.1);
    const hv = 190;
    ctx.save();
    ctx.fillStyle = 'rgba(12,19,36,0.85)';
    arrondi(ctx, MX, y, w, hv, 18); ctx.fill();
    ctx.strokeStyle = C.bord; ctx.lineWidth = 2; arrondi(ctx, MX, y, w, hv, 18); ctx.stroke();
    ctx.restore();
    const px = 36, col = (w - px * 2) * 0.42;
    const eLb: Ecriture = { taille: 18, gras: 400, police: MONO, couleur: C.gris, espace: 18 * 0.2 };
    ecrire(ctx, '1ER', MX + px, y + 42, eLb);
    ecrire(ctx, tailler(ctx, p1.nom.toUpperCase(), col, { taille: 36, gras: 600, police: OSWALD }),
           MX + px, y + 84, { taille: 36, gras: 600, police: OSWALD, couleur: C.texte });
    ecrire(ctx, chronoTxt(p1.ms!, fr), MX + px, y + 140, { taille: 58, gras: 700, police: MONO, couleur: C.or });
    ecrire(ctx, '2E', L - MX - px, y + 42, { ...eLb, aligne: 'right' });
    ecrire(ctx, tailler(ctx, p2.nom.toUpperCase(), col, { taille: 36, gras: 600, police: OSWALD }),
           L - MX - px, y + 84, { taille: 36, gras: 600, police: OSWALD, couleur: C.texte, aligne: 'right' });
    ecrire(ctx, chronoTxt(p2.ms!, fr), L - MX - px, y + 140, { taille: 58, gras: 700, police: MONO, couleur: C.texte, aligne: 'right' });
    ecrire(ctx, 'VS', L / 2, y + 80, { taille: 54, gras: 700, police: OSWALD, couleur: C.or2, aligne: 'center' });
    ecrire(ctx, `${ecartTxt(ec!, fr)} s`, L / 2, y + 128, { taille: 22, gras: 700, police: MONO, couleur: C.texte, aligne: 'center' });
    y += hv;
  }

  // --- le tableau.
  y += Math.round(U * 1.2);
  const filet = (yy: number, fort = false) => {
    ctx.save(); ctx.fillStyle = fort ? C.bord : 'rgba(31,42,69,0.8)'; ctx.fillRect(MX, yy, w, fort ? 2 : 1); ctx.restore();
  };
  filet(y, true);
  const eT: Ecriture = { taille: 17, gras: 400, police: MONO, couleur: C.gris, espace: 17 * 0.18 };
  const xN = MX + 78, xT = L - MX - 64;
  ecrire(ctx, fr ? 'PL.' : 'PL.', MX, y + 22, eT);
  ecrire(ctx, fr ? 'ATHLÈTE' : 'ATHLETE', xN, y + 22, eT);
  ecrire(ctx, 'CHRONO', xT, y + 22, { ...eT, aligne: 'right' });
  y += 44;
  filet(y);
  const hl = 60;
  const ligne = (rang: string, nom: string, chrono: string, fort: boolean, q: boolean, marque: string | null) => {
    const cy = y + hl / 2;
    ecrire(ctx, rang, MX, cy, { taille: 22, gras: 700, police: MONO, couleur: C.or2 });
    const eNom: Ecriture = { taille: 32, gras: 600, police: WORK, couleur: marque ? C.gris : C.texte };
    const eCh: Ecriture = { taille: 32, gras: marque ? 400 : 700, police: MONO, couleur: marque ? C.gris : fort ? C.or : C.texte, aligne: 'right' };
    const lCh = largeur(ctx, chrono, eCh);
    ecrire(ctx, tailler(ctx, dr + nom, xT - lCh - 24 - xN, eNom), xN, cy, eNom);
    ecrire(ctx, chrono, xT, cy, eCh);
    if (q) {
      ctx.save(); ctx.fillStyle = C.or; arrondi(ctx, L - MX - 40, cy - 20, 40, 40, 9); ctx.fill(); ctx.restore();
      ecrire(ctx, 'Q', L - MX - 20, cy + 1, { taille: 24, gras: 700, police: OSWALD, couleur: C.fond, aligne: 'center' });
    } else if (marque) {
      ecrire(ctx, marque, L - MX, cy, { taille: 19, gras: 400, police: MONO, couleur: C.rouge, aligne: 'right' });
    }
    y += hl;
    filet(y);
  };
  arr.forEach((l, i) => {
    const q = !!directs && i < directs;
    ligne(deux(i + 1), l.nom, chronoTxt(l.ms!, fr), q || (finale && i === 0), q, null);
  });
  hors.forEach(l => ligne('—', l.nom, '—', false, false, MOTIF[l.motif || ''] || ''));

  // --- la jauge des places directes.
  if (directs) {
    y += Math.round(U * 1.2);
    const total = c.lignes.length || PAR_COURSE;
    const on = Math.min(directs, arr.length);
    const eM: Ecriture = { taille: 20, gras: 700, police: MONO, couleur: C.texte, espace: 20 * 0.14 };
    const txt = fr ? ' QUALIFIÉS DIRECTS' : ' DIRECT QUALIFIERS';
    const lTxt = largeur(ctx, txt, eM) + largeur(ctx, String(on), { ...eM, couleur: C.or });
    const lJ = w - lTxt - 24, lb = (lJ - (total - 1) * 8) / total;
    for (let i = 0; i < total; i++) {
      ctx.save(); ctx.fillStyle = i < on ? C.or : C.bleu;
      arrondi(ctx, MX + i * (lb + 8), y, lb, 10, 5); ctx.fill(); ctx.restore();
    }
    const xM = L - MX - lTxt;
    const lOn = ecrire(ctx, String(on), xM, y + 5, { ...eM, couleur: C.or });
    ecrire(ctx, txt, xM + lOn, y + 5, eM);
    y += 10;
  }

  // --- le pied, colle en bas de la zone lisible.
  const rep = c.phase === 'series' ? PAR_COURSE * 2 - 2 * 4 : c.phase === 'demies' ? PAR_COURSE - 2 * 2 : 0;
  let revele = '';
  if (!finale && c.quand != null && REVELATION_UTC[c.phase] != null) {
    const j0 = new Date(c.quand); j0.setUTCHours(0, 0, 0, 0);
    const r = jourHeure(j0.getTime() + REVELATION_UTC[c.phase] * 60000, fr);
    revele = fr ? `, révélés ${r.jour} à ` : `, revealed ${r.jour} at `;
    revele += '\u0000' + r.heure;
  }
  const piedM: Morceau[] = finale
    ? (fr ? [{ t: 'Titre porté ' }, { t: 'trois mois', b: true }, { t: ', remis en jeu au prochain championnat. Heures de Paris.' }]
          : [{ t: 'Title held for ' }, { t: 'three months', b: true }, { t: ', back at stake at the next championship. Paris time.' }])
    : [{ t: 'Q', b: true }, { t: fr ? ' qualifié d\'office. ' : ' qualified directly. ' },
       { t: fr ? `${rep} repêchés` : `${rep} fastest losers`, b: true },
       { t: (fr ? ' au chrono' : ' on time') + revele.split('\u0000')[0] },
       ...(revele ? [{ t: revele.split('\u0000')[1], b: true }] : []),
       { t: fr ? '. Heures de Paris.' : '. Paris time.' }];
  const yPied = H - BAS - 96;
  filet(yPied - 34, true);
  paragraphe(ctx, piedM, MX, yPied, w - 220, 23, Math.round(23 * 1.42), C.gris);
  ecrire(ctx, 'SPRINTER', L - MX, yPied + 16, { taille: 34, gras: 700, police: OSWALD, couleur: C.or2, espace: 34 * 0.08, aligne: 'right' });
}

/** Les polices de la carte, chargees avant de dessiner. */
export async function policesDeLaCarte(): Promise<void> {
  const f = (document as any).fonts;
  if (!f) return;
  try {
    await Promise.all([
      f.load('700 100px Oswald'), f.load('600 36px Oswald'),
      f.load('700 26px "Space Mono"'), f.load('400 18px "Space Mono"'),
      f.load('400 31px "Work Sans"'), f.load('700 31px "Work Sans"'), f.load('600 32px "Work Sans"'),
    ]);
  } catch { /* on dessinera avec ce qu'on a */ }
}
