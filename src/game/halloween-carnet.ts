// LE CARNET DE L'ÉDITION 2026 — ce que le joueur a fait, et comment on le garde.
//
// Un schéma versionné, une migration depuis l'ancien carnet, une somme de
// contrôle, et DEUX ESPACES SÉPARÉS : celui du joueur et celui du testeur.
//
// POURQUOI DEUX ESPACES. Un testeur qui déverrouille les treize nuits par le
// voyageur temporel ne doit pas revenir, le 19 octobre, avec une édition déjà
// finie. Le §9 bis du brief l'exige, et c'est juste : sortir du mode test doit
// rendre la progression réelle intacte, pas une progression contaminée.
//
// AUCUN IMPORT ICI NON PLUS, même raison que game/halloween-calendrier.ts : le
// harnais charge ce fichier nu sous node. Le stockage est donc passé en
// paramètre, jamais appelé directement — ce qui a l'avantage de rendre les
// deux espaces triviaux à écrire et à éprouver.

/** La version du schéma. Toute lecture d'une version inférieure passe par `migrer`. */
export const VERSION = 1;

/** L'espace du joueur, et celui du testeur. */
export const CLE_JOUEUR = 'halloween2026.v1';
export const CLE_TESTEUR = 'halloween2026.tester.v1';

/** L'ancien carnet, celui de « La nuit du molosse ». */
export const CLE_ANCIENNE = 'sprinter_halloween';

export type Carnet = {
  v: number;
  /** La dernière nuit tenue. 0 tant qu'aucune ne l'est. */
  tenues: number;
  /** Le meilleur chrono de chaque nuit tenue, par rang. */
  chronos: Record<string, number>;
  /** L'écart minimal atteint dans chaque nuit — ce qui se raconte après. */
  ecarts: Record<string, number>;
  /** Combien de fois on s'est fait rattraper, toutes nuits confondues. */
  morsures: number;
  /** Les cinématiques déjà vues, pour ne pas servir deux fois la même. */
  vues: string[];
  /** Le jour où la dernière nuit a été tenue, pour le calendrier. */
  dernierJour: number;
  /** La somme de contrôle, posée à l'écriture et vérifiée à la lecture. */
  sc?: string;
};

export function carnetVide(): Carnet {
  return { v: VERSION, tenues: 0, chronos: {}, ecarts: {}, morsures: 0, vues: [], dernierJour: 0 };
}

/* ===========================================================================
   LA SOMME DE CONTRÔLE
   ===========================================================================
   ELLE NE PROTÈGE DE RIEN, ET IL FAUT LE DIRE. Tout ce qui tourne dans le
   navigateur du joueur est à la portée du joueur : la fonction est là, à côté
   des données, et qui veut recalculer la somme le peut en une minute.

   CE QU'ELLE FAIT VRAIMENT, et qui est utile : elle distingue une sauvegarde
   ÉDITÉE À LA MAIN d'une sauvegarde intacte. Un joueur curieux qui passe
   `tenues` de 3 à 13 dans l'inspecteur casse la somme, et le jeu peut alors
   choisir — ici, repartir d'un carnet vide plutôt que de servir une édition
   finie à quelqu'un qui n'a rien couru.

   Ce n'est donc pas une serrure, c'est un SCEAU : il ne résiste pas, il se
   voit. Pour une serrure, il faudrait que la progression vive sur le serveur,
   ce qui n'est pas le sujet d'une édition limitée jouable hors ligne.
=========================================================================== */

/**
 * Une écriture stable d'une valeur : mêmes données, même texte, quel que soit
 * l'ordre dans lequel les champs ont été posés.
 *
 * ON NE PASSE PAS PAR LE SECOND ARGUMENT DE `JSON.stringify`, ET LE HARNAIS A
 * DÛ ME L'APPRENDRE. Un tableau de clefs n'y est pas un ORDRE DE TRI : c'est
 * une LISTE BLANCHE, appliquée à TOUS LES NIVEAUX. En lui donnant les clefs de
 * premier rang — `v`, `tenues`, `chronos`… — on gardait bien `chronos`, mais
 * ses clefs internes (« 1 », « 3 »…) n'étaient pas dans la liste et
 * disparaissaient : `chronos` se sérialisait en `{}`.
 *
 * La somme ignorait donc TOUS les chronos et TOUS les écarts. Le sceau se
 * posait, se vérifiait, et n'aurait rien vu de quelqu'un qui se donne 8,00 s
 * sur les treize nuits. Un test qui vérifie qu'une somme CHANGE quand la
 * donnée change vaut mieux qu'un test qui vérifie qu'elle est stable.
 */
function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).sort()
    .map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
}

/** Une empreinte courte et stable du contenu, hors somme. */
export function sommeDe(c: Carnet): string {
  const sans: Record<string, unknown> = { ...c };
  delete sans.sc;
  const texte = stable(sans);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < texte.length; i++) {
    const c0 = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c0, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c0, 0x85ebca6b) >>> 0;
  }
  return (h1 >>> 0).toString(36) + '-' + (h2 >>> 0).toString(36);
}

/* ===========================================================================
   MIGRATION
=========================================================================== */

/**
 * Reprendre l'ancien carnet de « La nuit du molosse ».
 *
 * ON NE JETTE PAS CE QUI A ÉTÉ COURU. Le mode a vécu sur /test avant l'édition
 * datée ; des testeurs y ont des nuits tenues et des chronos. Les perdre à
 * l'ouverture serait leur reprendre quelque chose.
 *
 * Ce qui ne se reprend pas : `dernierJour`, qui n'existait pas. Il reste à zéro,
 * et le calendrier s'en accommode — la date ouvre ce qu'elle ouvre, la victoire
 * fait le reste.
 */
export function migrerDepuisAncien(ancien: unknown): Carnet {
  const c = carnetVide();
  if (!ancien || typeof ancien !== 'object') return c;
  const a = ancien as Record<string, unknown>;
  if (typeof a.tenues === 'number' && a.tenues >= 0) c.tenues = Math.min(13, Math.floor(a.tenues));
  if (typeof a.morsures === 'number' && a.morsures >= 0) c.morsures = Math.floor(a.morsures);
  if (a.chronos && typeof a.chronos === 'object') {
    for (const [k, v] of Object.entries(a.chronos as Record<string, unknown>)) {
      if (typeof v === 'number' && isFinite(v) && v > 0) c.chronos[k] = v;
    }
  }
  if (Array.isArray(a.vues)) c.vues = a.vues.filter(x => typeof x === 'string') as string[];
  return c;
}

/**
 * Amener un carnet lu au schéma courant.
 *
 * Une version inconnue ou plus récente que la nôtre rend un carnet vide : mieux
 * vaut repartir de zéro que d'interpréter des champs qu'on ne connaît pas.
 */
export function migrer(brut: unknown): Carnet {
  if (!brut || typeof brut !== 'object') return carnetVide();
  const b = brut as Record<string, unknown>;
  if (b.v === VERSION) return normaliser(b);
  if (typeof b.v !== 'number') return migrerDepuisAncien(b);  // l'ancien n'avait pas de `v`
  return carnetVide();
}

/** Remettre chaque champ dans ses bornes, sans faire confiance à ce qu'on lit. */
function normaliser(b: Record<string, unknown>): Carnet {
  const c = carnetVide();
  if (typeof b.tenues === 'number') c.tenues = Math.max(0, Math.min(13, Math.floor(b.tenues)));
  if (typeof b.morsures === 'number') c.morsures = Math.max(0, Math.floor(b.morsures));
  if (typeof b.dernierJour === 'number') c.dernierJour = Math.max(0, Math.floor(b.dernierJour));
  for (const champ of ['chronos', 'ecarts'] as const) {
    const src = b[champ];
    if (src && typeof src === 'object') {
      for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
        if (typeof v === 'number' && isFinite(v)) c[champ][k] = v;
      }
    }
  }
  if (Array.isArray(b.vues)) c.vues = b.vues.filter(x => typeof x === 'string') as string[];
  if (typeof b.sc === 'string') c.sc = b.sc;
  return c;
}

/* ===========================================================================
   LIRE ET ÉCRIRE
=========================================================================== */

/** Le stockage, passé en paramètre — voir l'en-tête. */
export type Rangement = {
  lire: (cle: string) => string | null;
  ecrire: (cle: string, v: string) => void;
};

/** Ce qu'une lecture a donné, et ce qui s'est passé en chemin. */
export type Lecture = {
  carnet: Carnet;
  /** `neuf` : rien en base. `repris` : migré. `intact` / `edite` : lu tel quel. */
  etat: 'neuf' | 'repris' | 'intact' | 'edite';
};

export function lire(r: Rangement, testeur: boolean): Lecture {
  const cle = testeur ? CLE_TESTEUR : CLE_JOUEUR;
  let brut: string | null = null;
  try { brut = r.lire(cle); } catch { brut = null; }

  if (!brut) {
    // Rien dans l'espace demandé. On ne reprend l'ancien carnet QUE pour le
    // joueur : l'espace testeur doit naître vide, sinon il hériterait de la
    // progression réelle et la contaminerait en retour.
    if (testeur) return { carnet: carnetVide(), etat: 'neuf' };
    let ancien: string | null = null;
    try { ancien = r.lire(CLE_ANCIENNE); } catch { ancien = null; }
    if (!ancien) return { carnet: carnetVide(), etat: 'neuf' };
    try {
      return { carnet: migrerDepuisAncien(JSON.parse(ancien)), etat: 'repris' };
    } catch { return { carnet: carnetVide(), etat: 'neuf' }; }
  }

  let objet: unknown;
  try { objet = JSON.parse(brut); } catch { return { carnet: carnetVide(), etat: 'neuf' }; }
  const c = migrer(objet);

  // LE SCEAU. Un carnet sans somme vient d'une migration — c'est normal, on ne
  // l'accuse pas. Un carnet AVEC une somme qui ne correspond pas a été touché.
  if (c.sc !== undefined) {
    const attendue = sommeDe(c);
    if (c.sc !== attendue) return { carnet: carnetVide(), etat: 'edite' };
    return { carnet: c, etat: 'intact' };
  }
  return { carnet: c, etat: 'repris' };
}

export function ecrire(r: Rangement, testeur: boolean, c: Carnet): Carnet {
  const scelle: Carnet = { ...c, v: VERSION };
  delete scelle.sc;
  scelle.sc = sommeDe(scelle);
  try { r.ecrire(testeur ? CLE_TESTEUR : CLE_JOUEUR, JSON.stringify(scelle)); } catch { /* refusé */ }
  return scelle;
}

/**
 * Enregistrer une nuit tenue.
 *
 * `tenues` ne monte que d'un cran, et seulement quand c'est la nuit SUIVANTE
 * qui vient d'être tenue : regagner la nuit 3 quand on en est à 7 améliore le
 * chrono, pas la progression.
 */
export function tenir(c: Carnet, n: number, chrono: number, ecartMin: number,
                      jour: number): Carnet {
  const d: Carnet = { ...c, chronos: { ...c.chronos }, ecarts: { ...c.ecarts } };
  const clef = String(n);
  if (d.chronos[clef] === undefined || chrono < d.chronos[clef]) d.chronos[clef] = chrono;
  if (d.ecarts[clef] === undefined || ecartMin < d.ecarts[clef]) d.ecarts[clef] = ecartMin;
  if (n === d.tenues + 1) { d.tenues = n; d.dernierJour = jour; }
  return d;
}

/** Enregistrer une morsure. Elle ne coûte pas de progression, elle se compte. */
export function mordre(c: Carnet): Carnet {
  return { ...c, morsures: c.morsures + 1 };
}
