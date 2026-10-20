// La fusion de deux profils (src/game/profil.ts), sans navigateur : ce fichier
// ne touche ni au stockage ni au reseau, pour que tools/profil-fusion-test.mjs
// le prenne en defaut avec node seul.
//
// UNE REGLE PAR CLE, ET JAMAIS UNE SOMME. Deux appareils peuvent tenir la meme
// histoire — le telephone neuf vient de la recevoir de l'autre. Additionner
// compterait deux fois chaque course. On garde donc le meilleur de chacun :
// union des chronos, max des progressions, min des meilleurs temps. Quand une
// valeur ne se decoupe pas sans mentir (le compte des carrieres, le carnet
// scelle d'Halloween), on garde la plus avancee EN ENTIER.

/** Les cles qui font le profil. Tout le reste reste sur l'appareil. */
export const CLES_PROFIL = [
  'sprinter_web_v1',               // carriere : scores, meilleurs parcours, etape la plus loin
  'sprinter_history',              // les 300 dernieres courses
  'sprinter_legende_v1',           // la Legende
  'sprinter_carrieres_gagnees_v1', // le compte qui l'ouvre
  'sprinter_vestiaire',            // les skins gagnes
  'sprinter_defis_vedettes_battus',
  'sprinter_defis_vedettes',
  'halloween2026.v1',              // le carnet du molosse (pas celui du testeur)
  'sprinter.longueur.v1', 'sprinter.triple.v1', 'sprinter.hauteur.v1',
  ...Array.from({ length: 13 }, (_, i) => `sprinter_halloween_piece_${i + 1}_vue`),
];

const lire = s => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const objet = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const nombre = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Les dix meilleurs chronos de deux listes, sans doublon, du plus rapide au plus lent. */
function dixMeilleurs(a, b) {
  const t = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]
    .filter(x => nombre(x) !== null && x > 0);
  return [...new Set(t)].sort((x, y) => x - y).slice(0, 10);
}

/** Pour chaque clef, la valeur que `garder(x, y)` retient. */
function parClef(a, b, garder) {
  const r = { ...(objet(a) || {}) };
  for (const [k, v] of Object.entries(objet(b) || {})) r[k] = k in r ? garder(r[k], v) : v;
  return r;
}
const plusPetit = (x, y) => (nombre(x) !== null && nombre(y) !== null ? Math.min(x, y) : nombre(x) ?? y);
const plusGrand = (x, y) => (nombre(x) !== null && nombre(y) !== null ? Math.max(x, y) : nombre(x) ?? y);

const REGLES = {
  sprinter_web_v1(a, b) {
    const r = { ...b, ...a };
    r.scores = parClef(a.scores, b.scores, dixMeilleurs);
    r.runs = parClef(a.runs, b.runs, dixMeilleurs);
    r.furthest = parClef(a.furthest, b.furthest, plusGrand);
    if (!a.lang && b.lang) r.lang = b.lang;           // la langue de cet appareil d'abord
    return r;
  },
  sprinter_history(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return Array.isArray(a) ? a : b;
    const vus = new Set();
    return [...a, ...b]
      .filter(c => c && typeof c === 'object')
      .filter(c => { const k = `${c.r}|${c.t}|${c.m}|${c.l}|${c.d}`; return !vus.has(k) && vus.add(k); })
      .sort((x, y) => (y.d || 0) - (x.d || 0))
      .slice(0, 300);
  },
  sprinter_legende_v1(a, b) {
    return {
      ...b, ...a,
      plusLoin: plusGrand(a.plusLoin, b.plusLoin) ?? 0,
      accomplies: plusGrand(a.accomplies, b.accomplies) ?? 0,
      meilleurs: parClef(a.meilleurs, b.meilleurs, plusPetit),
    };
  },
  // `avant` est deduit de la carriere et de l'historique de l'appareil : melange
  // a un `total` venu d'ailleurs, il compterait deux fois. Le compte entier le
  // plus haut, donc — un minimum, comme le compte l'a toujours ete.
  sprinter_carrieres_gagnees_v1(a, b) {
    const n = c => (nombre(c.total) || 0) + (nombre(c.avant) || 0);
    return n(b) > n(a) ? b : a;
  },
  sprinter_vestiaire(a, b) {
    const gagnes = [...new Set([...(Array.isArray(a.gagnes) ? a.gagnes : []),
                                ...(Array.isArray(b.gagnes) ? b.gagnes : [])])];
    const porte = gagnes.includes(a.porte) ? a.porte : gagnes.includes(b.porte) ? b.porte : null;
    return { ...b, ...a, gagnes, porte };
  },
  sprinter_defis_vedettes_battus: (a, b) => parClef(a, b, (x, y) => !!(x || y)),
  sprinter_defis_vedettes: (a, b) => parClef(a, b, plusPetit),
  // Le carnet porte un sceau (halloween-carnet.ts, `sc`) : retouche a la main,
  // il se relirait comme trafique et repartirait a zero. On le prend entier.
  'halloween2026.v1'(a, b) {
    const t = c => [nombre(c.tenues) || 0, nombre(c.dernierJour) || 0];
    const [ta, ja] = t(a), [tb, jb] = t(b);
    return tb > ta || (tb === ta && jb > ja) ? b : a;
  },
};

function fusionSaut(a, b) {
  const pb = [a.pb, b.pb].filter(p => p && nombre(p.m) !== null).sort((x, y) => y.m - x.m)[0] || null;
  const vues = new Set();
  const marques = [...(Array.isArray(a.marques) ? a.marques : []), ...(Array.isArray(b.marques) ? b.marques : [])]
    .filter(x => x && nombre(x.m) !== null)
    .filter(x => { const k = `${x.m}|${x.etape}`; return !vues.has(k) && vues.add(k); })
    .sort((x, y) => y.m - x.m).slice(0, 5);
  return {
    ...b, ...a,
    debloque: plusGrand(a.debloque, b.debloque) ?? 0,
    plusLoin: plusGrand(a.plusLoin, b.plusLoin) ?? 0,
    pb, marques,
  };
}
for (const k of ['sprinter.longueur.v1', 'sprinter.triple.v1', 'sprinter.hauteur.v1']) REGLES[k] = fusionSaut;

/**
 * Fusionner la valeur de cet appareil (`ici`) et celle du serveur (`la`), deux
 * textes tels que le stockage les tient (ou null). Rend le texte a garder.
 */
export function fusionnerCle(cle, ici, la) {
  if (la == null || la === ici) return ici;
  if (ici == null) return la;
  // Une piece d'Halloween vue : vue ici ou la-bas, elle est vue.
  if (cle.startsWith('sprinter_halloween_piece_')) return ici || la;
  const a = lire(ici), b = lire(la);
  const regle = REGLES[cle];
  if (!regle) return ici;
  if (cle === 'sprinter_history') {
    if (!Array.isArray(a)) return la;
    if (!Array.isArray(b)) return ici;
  } else {
    if (!objet(a)) return objet(b) ? la : ici;
    if (!objet(b)) return ici;
  }
  return JSON.stringify(regle(a, b));
}

/** Deux profils { cle: texte } : le profil fusionne, cle par cle. */
export function fusionnerProfils(ici, la) {
  const r = {};
  for (const k of CLES_PROFIL) {
    const v = fusionnerCle(k, ici?.[k] ?? null, la?.[k] ?? null);
    if (v != null) r[k] = v;
  }
  return r;
}
