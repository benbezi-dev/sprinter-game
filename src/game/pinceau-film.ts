// LE PINCEAU DU FILM : la palette et les gestes de trace, en un seul endroit.
//
// Deux modules peignent sur le montage qu'enregistre `review.ts` — le HUD de
// course (`hud-film.ts`) et le carton de fin (`carton-film.ts`). Ils tracent
// les memes boites, les memes pastilles, dans les memes couleurs, et rien ne
// serait plus facile que de les laisser chacun avec sa copie.
//
// Ce serait une erreur, et elle se verrait : le jour ou `--primary` change
// dans `index.css`, une seule des deux copies suivrait, et le carton sortirait
// dans l'or d'avant sur une course peinte dans l'or d'apres — dans le MEME
// fichier video. Un fond voile a 0,8 d'un cote et 0,75 de l'autre ne se
// rattrape pas non plus une fois le film encode.
//
// LES REGLES QUE CE FICHIER SE DONNE sont celles de `hud-film.ts`, dont il est
// extrait :
//
//   1. IL NE LIT RIEN. Pas d'etat de jeu, pas de DOM, pas de style calcule :
//      on lui passe un contexte et des nombres, il pose de l'encre. C'est ce
//      qui permet de l'appeler soixante fois par seconde sans y penser.
//   2. IL RAISONNE EN POINTS CSS. `review.ts` met le pinceau a l'echelle de
//      l'appareil avant d'appeler ; les nombres qu'on ecrit ici sont donc les
//      memes que ceux de la feuille de style.

/* ------------------------------------------------------------- la palette */

// Les valeurs de `index.css` et de Tailwind, en dur : un canvas ne sait pas
// lire une variable CSS, et `getComputedStyle` a chaque image coute une lecture
// de style par frame pour des couleurs qui ne bougent jamais.
// --primary de Sprinter, monte d'un cran en meme temps que lui (index.css).
// Ce n'est PAS l'or des medailles (Insignes.tsx, COULEURS_MEDAILLE), qui reste
// a #F8CD4A : celui-la est un metal, pas la couleur d'un jeu, et il ne doit
// pas suivre les humeurs du theme.
export const OR         = '#FFD426';  // --primary
export const TEXTE      = '#EEF0F8';  // --foreground
export const SOURDINE   = '#94A3B8';  // --muted-foreground
export const CARTE      = '11, 15, 25';  // --card, en composantes pour les fonds voiles
export const ROUGE      = '#EF4444';  // --destructive
export const VERT       = '#34D399';  // emerald-400
export const CYAN       = '#22D3EE';  // cyan-400
export const CYAN_CLAIR = '#67E8F9';  // cyan-300
export const FUCHSIA    = '#E879F9';  // fuchsia-400

/**
 * LE FOND DE L'APPLICATION, EN COMPOSANTES.
 *
 * `#05070d` — la meme nuit que `capacitor.config.ts` donne au lancement et que
 * le jeu dessine derriere son stade. Le carton de fin voile l'image avec elle
 * plutot qu'avec du noir : un noir pur sur un stade bleute se voit comme un
 * trou, et le voile doit fermer le film, pas le trouer.
 */
export const NUIT = '5, 7, 13';


export const SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
export const AFFICHE = 'Outfit, system-ui, sans-serif';
export const CHIFFRES = '"Space Mono", ui-monospace, monospace';

/** Le palier `sm:` de Tailwind. En deca, les tailles de base. */
export const SM = 640;
/** Le palier `md:` de Tailwind. */
export const MD = 768;

/* -------------------------------------------------------------- le pinceau */

export type Ecriture = {
  taille: number; gras?: number; police?: string;
  /**
   * Une couleur, ou un degrade.
   *
   * Le carton de fin ecrit son chrono dans le meme degrade or-vers-orange que
   * les cartes de communication, et un canvas prend un `CanvasGradient` la ou
   * il prend une couleur. Le degrade est construit par l'appelant, aux
   * coordonnees du texte : un degrade se pose dans l'espace du canvas, pas
   * dans celui de la lettre.
   */
  couleur?: string | CanvasGradient;
  aligne?: CanvasTextAlign; espace?: number; alpha?: number; ombre?: boolean;
};

export function poser(ctx: CanvasRenderingContext2D, e: Ecriture) {
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
export function ecrire(ctx: CanvasRenderingContext2D, s: string, x: number, y: number,
                       e: Ecriture): number {
  poser(ctx, e);
  ctx.fillText(s, x, y);
  const w = ctx.measureText(s).width;
  ctx.globalAlpha = 1; ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  return w;
}

export function largeur(ctx: CanvasRenderingContext2D, s: string, e: Ecriture): number {
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
export function tailler(ctx: CanvasRenderingContext2D, s: string, max: number,
                        e: Ecriture): string {
  if (largeur(ctx, s, e) <= max) return s;
  let court = s;
  while (court.length > 1 && largeur(ctx, court + '…', e) > max) court = court.slice(0, -1);
  return court + '…';
}

/** Un rectangle a coins ronds, sans `roundRect` — absent des Safari anciens. */
export function boite(ctx: CanvasRenderingContext2D, x: number, y: number,
                      l: number, h: number, r: number) {
  const rr = Math.min(r, l / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + l, y, x + l, y + h, rr);
  ctx.arcTo(x + l, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + l, y, rr);
  ctx.closePath();
}

export function remplir(ctx: CanvasRenderingContext2D, x: number, y: number,
                        l: number, h: number, r: number,
                        fond: string | CanvasGradient, filet?: string) {
  boite(ctx, x, y, l, h, r);
  ctx.fillStyle = fond; ctx.fill();
  if (filet) { ctx.strokeStyle = filet; ctx.lineWidth = 1; ctx.stroke(); }
}

/** Une pastille de texte centree, comme les `rounded-full` du HUD. */
export function pastille(ctx: CanvasRenderingContext2D, s: string, cx: number, y: number,
                         h: number, e: Ecriture, fond: string, filet?: string, padX = 16) {
  const l = largeur(ctx, s, e) + padX * 2;
  remplir(ctx, cx - l / 2, y, l, h, h / 2, fond, filet);
  ecrire(ctx, s, cx, y + h / 2, { ...e, aligne: 'center' });
  return l;
}
