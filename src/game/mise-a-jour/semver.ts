// LA COMPARAISON DES VERSIONS — chiffre par chiffre, jamais en texte.
//
// En texte, « 1.10.0 » passe avant « 1.9.0 » (le « 1 » de 10 est plus petit
// que le « 9 »), et le jeu se croirait en retard sur une version plus ancienne.
// Ici chaque partie se compare comme un nombre : 1.10.0 > 1.9.0 > 1.2.0.
//
// Tolere ce que les stores et les outils ecrivent autour : un « v » devant, une
// partie manquante (« 1.2 » vaut « 1.2.0 »), un suffixe apres un tiret ou une
// espace (« 1.0.19-beta », « 1.0.19 (38) ») qui est ignore. Ce fichier n'importe
// rien : le harnais le charge seul (tools/mise-a-jour-test.mjs).

/** « 1.10.0 » -> [1, 10, 0]. Rend null si la chaine n'est pas une version. */
export function lireVersion(brute: unknown): number[] | null {
  if (typeof brute !== 'string') return null;
  const tete = brute.trim().replace(/^v/i, '').split(/[\s+-]/)[0];
  if (!/^\d+(\.\d+)*$/.test(tete)) return null;
  const parties = tete.split('.').map(Number);
  return parties.every(Number.isSafeInteger) ? parties : null;
}

/**
 * -1 si a < b, 0 si egales, 1 si a > b. Null si l'une n'est pas une version :
 * l'appelant decide alors de ne rien faire plutot que de bloquer sur du bruit.
 */
export function comparerVersions(a: unknown, b: unknown): -1 | 0 | 1 | null {
  const x = lireVersion(a);
  const y = lireVersion(b);
  if (!x || !y) return null;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}
