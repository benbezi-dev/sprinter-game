// LE CALENDRIER DE L'AVENT — les dates et le double verrou.
//
// Vingt-quatre cases, du 1er au 24 decembre 2026, chacune ouverte a 22 h, heure de
// Paris, comme les nuits d'Halloween (halloween-calendrier.ts). Une case est jouable si
// SA DATE EST ATTEINTE et si LA PRECEDENTE EST GAGNEE : deux verrous, et il faut les deux.
//
// DECEMBRE N'A PAS DE CHANGEMENT D'HEURE : Paris est a UTC+1 tout le mois, et chaque
// case s'ouvre a 21 h UTC. Le calcul reste quand meme sur un calendrier reel, pas sur des
// multiples de 86 400 000.
//
// AUCUN IMPORT ICI : le harnais (tools/avent-test.mjs) charge ce fichier nu sous node.

/** Combien de cases. */
export const NB_CASES = 24;

/** L'heure d'ouverture de chaque case, a Paris. */
export const HEURE_DES_CASES = 22;

/** Paris est a UTC+1 en decembre. */
const PARIS_HIVER = 1;

/** L'instant ou la case `n` s'ouvre, en UTC : le n decembre 2026 a 22 h a Paris. */
export function ouvertureDe(n: number): number {
  return Date.UTC(2026, 11, n, HEURE_DES_CASES - PARIS_HIVER, 0, 0);
}

/** La case `n` est-elle ouverte par la DATE, a cet instant ? */
export function ouverteParLaDate(n: number, maintenant: number): boolean {
  return n >= 1 && n <= NB_CASES && maintenant >= ouvertureDe(n);
}

/** Combien de cases la date a ouvertes. Zero avant le 1er decembre a 22 h. */
export function casesParLaDate(maintenant: number): number {
  let n = 0;
  for (let i = 1; i <= NB_CASES; i++) if (ouverteParLaDate(i, maintenant)) n = i;
  return n;
}

/**
 * LE DOUBLE VERROU. `gagnees` est le nombre de cases gagnees d'affilee depuis la
 * premiere. Une case perdue reste jouable : c'est la SUIVANTE qui attend.
 */
export function casesJouables(gagnees: number, maintenant: number): number {
  return Math.min(casesParLaDate(maintenant), gagnees + 1, NB_CASES);
}

/** Ce qui manque a une case : la date, la victoire de la veille, ou rien. */
export type Blocage = 'ouverte' | 'date' | 'victoire' | 'inconnue';

export function blocageDe(n: number, gagnees: number, maintenant: number): Blocage {
  if (n < 1 || n > NB_CASES) return 'inconnue';
  if (!ouverteParLaDate(n, maintenant)) return 'date';
  if (n > gagnees + 1) return 'victoire';
  return 'ouverte';
}
