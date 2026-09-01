/**
 * Un QR code, sans dependance.
 *
 * Le jeu n'a besoin que d'une chose : transformer une adresse courte en carre
 * noir et blanc, pour qu'un telephone vise l'ecran d'un autre appareil au lieu
 * de faire epeler un code. Les bibliotheques qui font cela font aussi le reste
 * — tous les modes d'encodage, toutes les versions, la lecture, le rendu en
 * canvas — et pesent en consequence pour un jeu qui tient a se charger vite.
 *
 * On s'en tient donc au strict necessaire, et le domaine restreint est ce qui
 * rend le fichier court :
 *
 *   · mode octet uniquement — une URL, pas des chiffres ni du Kanji ;
 *   · correction de niveau M — 15 % de degats absorbes, ce qu'il faut pour un
 *     ecran vise de travers ;
 *   · versions 1 a 6, soit 106 octets. Nos adresses en font une cinquantaine,
 *     et s'arreter a 6 evite le bloc d'information de version, qui n'apparait
 *     qu'a partir de la 7 et n'aurait servi a rien ici.
 *
 * Le reste suit la norme sans invention : polynome generateur sur GF(256),
 * entrelacement des blocs, huit masques evalues par les quatre regles de
 * penalite, et le meilleur retenu. tools/qr-test.mjs relit ce que ce fichier
 * produit avec un vrai decodeur, parce qu'un QR code qu'on ne verifie qu'a
 * l'oeil est un QR code qu'on n'a pas verifie.
 */

/* ------------------------------------------------------------ GF(256) */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;          // polynome de la norme
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** g(x) = produit des (x - a^i), coefficient de plus haut degre en tete. */
function polyGenerateur(n: number): Uint8Array {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const suivant = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      suivant[j] ^= g[j];                       // terme en x
      suivant[j + 1] ^= mul(g[j], EXP[i]);      // terme constant
    }
    g = suivant;
  }
  return Uint8Array.from(g);
}

/** Le reste de la division : les mots de correction d'un bloc. */
function correction(donnees: Uint8Array, n: number): Uint8Array {
  const g = polyGenerateur(n);
  const r = new Uint8Array(donnees.length + n);
  r.set(donnees);
  for (let i = 0; i < donnees.length; i++) {
    const f = r[i];
    if (f) for (let j = 0; j < g.length; j++) r[i + j] ^= mul(g[j], f);
  }
  return r.slice(donnees.length);
}

/* ------------------------------------------- ce que chaque version contient

   Pour le niveau M, versions 1 a 6 : nombre total de mots de donnees, nombre
   de blocs, mots de correction par bloc. Les six versions retenues ont toutes
   des blocs de taille egale, ce qui evite d'avoir a gerer deux groupes. */

const VERSIONS = [
  { v: 1, donnees: 16, blocs: 1, ec: 10 },
  { v: 2, donnees: 28, blocs: 1, ec: 16 },
  { v: 3, donnees: 44, blocs: 1, ec: 26 },
  { v: 4, donnees: 64, blocs: 2, ec: 18 },
  { v: 5, donnees: 86, blocs: 2, ec: 24 },
  { v: 6, donnees: 108, blocs: 4, ec: 16 },
];

/** Les centres des motifs d'alignement, par version. */
const ALIGNEMENTS: number[][] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

/** Le plus grand nombre d'octets que ce fichier sait encoder. */
export const CAPACITE_MAX = VERSIONS[VERSIONS.length - 1].donnees - 2;

/* ----------------------------------------------------------- la matrice */

type Grille = { taille: number; pixels: Uint8Array; reserve: Uint8Array };

const lire = (g: Grille, r: number, c: number) => g.pixels[r * g.taille + c];
const poser = (g: Grille, r: number, c: number, v: number) => { g.pixels[r * g.taille + c] = v; };
const reserver = (g: Grille, r: number, c: number) => { g.reserve[r * g.taille + c] = 1; };
const estReserve = (g: Grille, r: number, c: number) => !!g.reserve[r * g.taille + c];

function motifDeReperage(g: Grille, r0: number, c0: number) {
  // Le carre de 7x7, et le separateur blanc qui l'entoure.
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = r0 + r, cc = c0 + c;
      if (rr < 0 || rr >= g.taille || cc < 0 || cc >= g.taille) continue;
      const bord = r === 0 || r === 6 || c === 0 || c === 6;
      const coeur = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const dedans = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      poser(g, rr, cc, dedans && (bord || coeur) ? 1 : 0);
      reserver(g, rr, cc);
    }
  }
}

function motifDAlignement(g: Grille, r0: number, c0: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const bord = Math.max(Math.abs(r), Math.abs(c));
      poser(g, r0 + r, c0 + c, bord === 1 ? 0 : 1);
      reserver(g, r0 + r, c0 + c);
    }
  }
}

function squelette(version: number): Grille {
  const taille = 17 + 4 * version;
  const g: Grille = {
    taille,
    pixels: new Uint8Array(taille * taille),
    reserve: new Uint8Array(taille * taille),
  };

  motifDeReperage(g, 0, 0);
  motifDeReperage(g, 0, taille - 7);
  motifDeReperage(g, taille - 7, 0);

  // Les lignes de synchronisation, qui donnent l'echelle au lecteur.
  for (let i = 8; i < taille - 8; i++) {
    const noir = i % 2 === 0 ? 1 : 0;
    poser(g, 6, i, noir); reserver(g, 6, i);
    poser(g, i, 6, noir); reserver(g, i, 6);
  }

  const centres = ALIGNEMENTS[version];
  for (const r of centres) {
    for (const c of centres) {
      // Les trois coins portent deja un motif de reperage.
      const coin = (r === 6 && c === 6)
                || (r === 6 && c === taille - 7)
                || (r === taille - 7 && c === 6);
      if (!coin) motifDAlignement(g, r, c);
    }
  }

  // Le module toujours noir, et les emplacements du format.
  poser(g, taille - 8, 8, 1); reserver(g, taille - 8, 8);
  for (let i = 0; i <= 8; i++) {
    if (!estReserve(g, 8, i)) reserver(g, 8, i);
    if (!estReserve(g, i, 8)) reserver(g, i, 8);
  }
  for (let i = 0; i < 8; i++) {
    reserver(g, 8, taille - 1 - i);
    reserver(g, taille - 1 - i, 8);
  }

  return g;
}

/* -------------------------------------------------------------- masques */

type Masque = (r: number, c: number) => boolean;
const MASQUES: Masque[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/**
 * Les quatre regles de penalite de la norme.
 *
 * Elles ne mesurent pas la beaute du carre mais sa lisibilite : des trainees
 * d'une meme couleur, des paves uniformes, un motif qui imite un reperage, ou
 * un desequilibre general entre noir et blanc sont autant de facons de
 * derouter un lecteur. On les compte pour les huit masques, et on garde le
 * moins mauvais.
 */
function penalite(g: Grille): number {
  const n = g.taille;
  let total = 0;

  // 1. cinq modules de meme couleur a la suite, ou plus.
  for (let r = 0; r < n; r++) {
    for (const parLigne of [true, false]) {
      let suite = 1;
      for (let i = 1; i < n; i++) {
        const a = parLigne ? lire(g, r, i - 1) : lire(g, i - 1, r);
        const b = parLigne ? lire(g, r, i) : lire(g, i, r);
        if (a === b) { suite++; if (i === n - 1 && suite >= 5) total += 3 + (suite - 5); }
        else { if (suite >= 5) total += 3 + (suite - 5); suite = 1; }
      }
    }
  }

  // 2. les paves de 2x2 d'une seule couleur.
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = lire(g, r, c);
      if (v === lire(g, r, c + 1) && v === lire(g, r + 1, c) && v === lire(g, r + 1, c + 1)) {
        total += 3;
      }
    }
  }

  // 3. le motif qui imite un reperage : 1011101 borde de quatre blancs.
  const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c + 11 <= n; c++) {
      let ligneA = true, ligneB = true, colA = true, colB = true;
      for (let k = 0; k < 11; k++) {
        const h = lire(g, r, c + k), v = lire(g, c + k, r);
        if (h !== A[k]) ligneA = false;
        if (h !== B[k]) ligneB = false;
        if (v !== A[k]) colA = false;
        if (v !== B[k]) colB = false;
      }
      if (ligneA) total += 40;
      if (ligneB) total += 40;
      if (colA) total += 40;
      if (colB) total += 40;
    }
  }

  // 4. le desequilibre entre noir et blanc.
  let noirs = 0;
  for (let i = 0; i < g.pixels.length; i++) noirs += g.pixels[i];
  const pourcent = (noirs * 100) / g.pixels.length;
  total += Math.floor(Math.abs(pourcent - 50) / 5) * 10;

  return total;
}

/** Les quinze bits du format : niveau de correction, masque, et leur BCH. */
function bitsDeFormat(masque: number): number {
  const format = (0b00 << 3) | masque;          // 00 = niveau M
  let reste = format << 10;
  for (let i = 4; i >= 0; i--) {
    if (reste & (1 << (i + 10))) reste ^= 0x537 << i;
  }
  return ((format << 10) | reste) ^ 0x5412;
}

function poserFormat(g: Grille, masque: number) {
  const bits = bitsDeFormat(masque);
  const bit = (i: number) => (bits >> i) & 1;
  const n = g.taille;

  // La premiere copie longe le reperage du coin superieur gauche : les six
  // premiers bits descendent la colonne 8, les six derniers longent la ligne 8
  // vers la gauche. L'ordre n'est pas symetrique et ne se devine pas — le lire
  // a l'envers donne un carre d'allure parfaite qu'aucun telephone ne lit.
  for (let i = 0; i <= 5; i++) poser(g, i, 8, bit(i));
  poser(g, 7, 8, bit(6));
  poser(g, 8, 8, bit(7));
  poser(g, 8, 7, bit(8));
  for (let i = 9; i <= 14; i++) poser(g, 8, 14 - i, bit(i));

  // La seconde copie se partage entre le bord droit et le bord bas, pour
  // qu'un coin abime n'emporte pas les deux.
  for (let i = 0; i <= 7; i++) poser(g, 8, n - 1 - i, bit(i));
  for (let i = 8; i <= 14; i++) poser(g, n - 15 + i, 8, bit(i));

  poser(g, n - 8, 8, 1);                        // le module toujours noir
}

/* ---------------------------------------------------------------- encodage */

/**
 * Le carre, en modules : `true` = noir.
 *
 * Renvoie `null` si le texte depasse ce que six versions savent porter. Le
 * jeu n'y envoie que des adresses courtes, mais un appelant merite un refus
 * franc plutot qu'un carre illisible.
 */
export function qrModules(texte: string): boolean[][] | null {
  const octets = new TextEncoder().encode(texte);
  const spec = VERSIONS.find(s => octets.length <= s.donnees - 2);
  if (!spec) return null;

  // --- le flux binaire : mode octet, longueur, donnees, terminateur.
  const bits: number[] = [];
  const pousser = (valeur: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((valeur >> i) & 1);
  };
  pousser(0b0100, 4);
  pousser(octets.length, 8);
  for (const o of octets) pousser(o, 8);

  const capaciteBits = spec.donnees * 8;
  pousser(0, Math.min(4, capaciteBits - bits.length));
  while (bits.length % 8) bits.push(0);

  const mots: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let o = 0;
    for (let j = 0; j < 8; j++) o = (o << 1) | bits[i + j];
    mots.push(o);
  }
  // Le remplissage de la norme, deux octets qui alternent.
  const REMPLISSAGE = [0xec, 0x11];
  while (mots.length < spec.donnees) mots.push(REMPLISSAGE[(mots.length - bits.length / 8) % 2]);

  // --- blocs et entrelacement
  const parBloc = spec.donnees / spec.blocs;
  const blocsDonnees: Uint8Array[] = [];
  const blocsCorrection: Uint8Array[] = [];
  for (let b = 0; b < spec.blocs; b++) {
    const d = Uint8Array.from(mots.slice(b * parBloc, (b + 1) * parBloc));
    blocsDonnees.push(d);
    blocsCorrection.push(correction(d, spec.ec));
  }

  const flux: number[] = [];
  for (let i = 0; i < parBloc; i++) for (const b of blocsDonnees) flux.push(b[i]);
  for (let i = 0; i < spec.ec; i++) for (const b of blocsCorrection) flux.push(b[i]);

  const fluxBits: number[] = [];
  for (const o of flux) for (let i = 7; i >= 0; i--) fluxBits.push((o >> i) & 1);

  // --- placement, une fois par masque
  let meilleur: Grille | null = null;
  let meilleurScore = Infinity;

  for (let m = 0; m < 8; m++) {
    const g = squelette(spec.v);
    const masque = MASQUES[m];
    const n = g.taille;
    let idx = 0;
    let sens = -1;
    let ligne = n - 1;

    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;                     // la colonne de synchronisation
      for (;;) {
        for (let d = 0; d < 2; d++) {
          const c = col - d;
          if (!estReserve(g, ligne, c)) {
            let noir = idx < fluxBits.length ? fluxBits[idx++] : 0;
            if (masque(ligne, c)) noir ^= 1;
            poser(g, ligne, c, noir);
          }
        }
        ligne += sens;
        if (ligne < 0 || ligne >= n) { ligne -= sens; sens = -sens; break; }
      }
    }

    poserFormat(g, m);
    const score = penalite(g);
    if (score < meilleurScore) { meilleurScore = score; meilleur = g; }
  }

  const g = meilleur!;
  const sortie: boolean[][] = [];
  for (let r = 0; r < g.taille; r++) {
    const ligne: boolean[] = [];
    for (let c = 0; c < g.taille; c++) ligne.push(lire(g, r, c) === 1);
    sortie.push(ligne);
  }
  return sortie;
}

/**
 * Le meme carre, en un chemin SVG.
 *
 * Un seul `<path>` plutot qu'un millier de `<rect>` : c'est le meme dessin,
 * et le navigateur n'a qu'un noeud a poser au lieu d'un par module noir.
 * La marge de quatre modules est exigee par la norme — sans elle, un lecteur
 * ne trouve pas les bords.
 */
export function qrChemin(texte: string, marge = 4): { d: string; taille: number } | null {
  const m = qrModules(texte);
  if (!m) return null;
  const n = m.length;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (m[r][c]) d += `M${c + marge} ${r + marge}h1v1h-1z`;
    }
  }
  return { d, taille: n + marge * 2 };
}
