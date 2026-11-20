/**
 * Le niveau FFA d'une performance : IA, N2, R4, D7…
 *
 * Le barème lui-même vit dans `bareme-ffa-donnees.ts`, relevé tel quel sur le
 * site de la Fédération (Barème Hommes, classement des clubs). Ici, seulement
 * la lecture : quelle ligne pour quelle épreuve du jeu, et quel niveau pour un
 * chrono ou une marque.
 *
 * LA RÈGLE DE LA FÉDÉRATION : un niveau est acquis dès que la performance est
 * égale ou meilleure que sa case. Un chrono se lit au centième supérieur
 * (10,101 s compte 10,11 s, comme sur une feuille de résultats), une marque au
 * centimètre inférieur.
 *
 * CE QUE LE BARÈME NE COUVRE PAS : c'est le barème HOMMES. Le 100 m haies et
 * le 60 m haies femmes n'y figurent pas, le relais non plus : pour ceux-là on
 * ne montre rien plutôt qu'un niveau emprunté à une autre épreuve.
 */
import { BAREME_HOMMES_FFA, NIVEAUX_FFA, type LigneBaremeFFA } from './bareme-ffa-donnees';

export { NIVEAUX_FFA, BAREME_HOMMES_FFA };

export type CodeNiveauFFA = typeof NIVEAUX_FFA[number]['code'];

/** Les cinq étages du barème, du plus haut au plus modeste. */
export type EchelonFFA = 'international' | 'national' | 'interregional' | 'regional' | 'departemental';

export const ECHELONS_FFA: Record<EchelonFFA, { fr: string; en: string }> = {
  international: { fr: 'International', en: 'International' },
  national: { fr: 'National', en: 'National' },
  interregional: { fr: 'Interrégional', en: 'Inter-regional' },
  regional: { fr: 'Régional', en: 'Regional' },
  departemental: { fr: 'Départemental', en: 'County' },
};

export function echelonDe(code: string): EchelonFFA {
  if (code.startsWith('IR')) return 'interregional';
  if (code.startsWith('I')) return 'international';
  if (code.startsWith('N')) return 'national';
  if (code.startsWith('R')) return 'regional';
  return 'departemental';
}

/** Épreuve du jeu → ligne du barème. Absente = hors barème hommes. */
const LIGNE_DU_JEU: Record<string, string> = {
  '60': '60m',
  '100': '100m',
  '200': '200m',
  '200s': '200m',
  '400': '400m',
  '400s': '400m',
  '60h': '60m Haies 1.06m',
  '110h': '110m Haies 1.06m',
  '400h': '400m Haies',
  hauteur: 'Hauteur',
  longueur: 'Longueur',
  triple: 'Triple Saut',
  poids: 'Poids 7kg',
};

/** La ligne du barème (catégorie seniors) pour une épreuve du jeu. */
export function ligneBaremeFFA(cle: string): LigneBaremeFFA | null {
  const nom = LIGNE_DU_JEU[cle];
  if (!nom) return null;
  // Les haies existent en trois hauteurs ; seule la ligne CJESM (1,06 m) a
  // toutes ses cases, et c'est celle des adultes.
  return BAREME_HOMMES_FFA.find(l => l.epreuve === nom && l.categories.includes('S')) ?? null;
}

export type NiveauFFA = {
  code: CodeNiveauFFA;
  points: number;
  /** 0 pour IA, 22 pour D7. */
  rang: number;
  echelon: EchelonFFA;
  /** La case du barème atteinte, écrite comme la Fédération. */
  seuil: string;
  /** Le niveau au-dessus, et ce qui manque pour l'atteindre. */
  suivant: { code: CodeNiveauFFA; points: number; seuil: string; ecart: number } | null;
};

function arrondir(perf: number, sens: LigneBaremeFFA['sens']): number {
  return sens === 'temps'
    ? Math.ceil(perf * 100 - 1e-6) / 100
    : Math.floor(perf * 100 + 1e-6) / 100;
}

function vaut(perf: number, seuil: number, sens: LigneBaremeFFA['sens']): boolean {
  return sens === 'temps' ? perf <= seuil + 1e-9 : perf >= seuil - 1e-9;
}

/**
 * Le niveau d'une performance (secondes pour une course, mètres pour un
 * concours). `undefined` si l'épreuve n'a pas de barème ; `null` si la
 * performance est sous le dernier niveau (D7).
 */
export function niveauFFA(cle: string, perf: number | null | undefined): NiveauFFA | null | undefined {
  const ligne = ligneBaremeFFA(cle);
  if (!ligne) return undefined;
  if (perf == null || !Number.isFinite(perf) || perf <= 0) return null;
  const p = arrondir(perf, ligne.sens);
  for (let i = 0; i < NIVEAUX_FFA.length; i++) {
    const s = ligne.perfs[i];
    if (s == null || !vaut(p, s, ligne.sens)) continue;
    let suivant: NiveauFFA['suivant'] = null;
    if (i > 0 && ligne.perfs[i - 1] != null) {
      const s2 = ligne.perfs[i - 1] as number;
      suivant = {
        code: NIVEAUX_FFA[i - 1].code, points: NIVEAUX_FFA[i - 1].points,
        seuil: ligne.textes[i - 1], ecart: Math.abs(p - s2),
      };
    }
    return {
      code: NIVEAUX_FFA[i].code, points: NIVEAUX_FFA[i].points, rang: i,
      echelon: echelonDe(NIVEAUX_FFA[i].code), seuil: ligne.textes[i], suivant,
    };
  }
  return null;
}

/** Ce qui manque pour entrer au barème (D7) quand on n'y est pas encore. */
export function entreeBaremeFFA(cle: string, perf: number): { seuil: string; ecart: number } | null {
  const ligne = ligneBaremeFFA(cle);
  if (!ligne) return null;
  const der = ligne.perfs.length - 1;
  const s = ligne.perfs[der];
  if (s == null) return null;
  return { seuil: ligne.textes[der], ecart: Math.abs(arrondir(perf, ligne.sens) - s) };
}

/**
 * Le classement d'un groupe de performances selon le barème : le meilleur
 * niveau d'abord, puis la meilleure performance à niveau égal — c'est ainsi
 * qu'un classement des clubs départage ses athlètes. Rend, pour chaque entrée,
 * son niveau et sa place au barème (ex aequo à niveau égal).
 */
export function classementFFA<T>(
  cle: string, entrees: T[], perfDe: (e: T) => number | null | undefined,
): { entree: T; niveau: NiveauFFA | null; place: number | null }[] {
  const lus = entrees.map(entree => {
    const n = niveauFFA(cle, perfDe(entree));
    return { entree, niveau: n ?? null };
  });
  const tries = [...lus].filter(l => l.niveau).sort((a, b) => a.niveau!.rang - b.niveau!.rang);
  const place = new Map<T, number>();
  tries.forEach((l, i) => {
    const prec = i > 0 ? tries[i - 1] : null;
    place.set(l.entree, prec && prec.niveau!.rang === l.niveau!.rang ? place.get(prec.entree)! : i + 1);
  });
  return lus.map(l => ({ ...l, place: place.get(l.entree) ?? null }));
}

/** Le total de points du barème pour une liste de performances. */
export function pointsFFA(cle: string, perfs: (number | null | undefined)[]): number {
  return perfs.reduce<number>((t, p) => t + (niveauFFA(cle, p)?.points ?? 0), 0);
}
