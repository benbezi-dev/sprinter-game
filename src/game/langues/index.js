/* -----------------------------------------------------------------------
   SPRINTER — chargement des paquets de langue.

   Le francais et l'anglais sont dans sprinter-i18n.js : le jeu demarre dans
   l'une des deux sans rien telecharger de plus. Les autres langues sont un
   fichier chacune, a deux lettres, tire a la demande. Ce qu'un paquet ne
   traduit pas retombe sur l'anglais, cote i18n.
   ----------------------------------------------------------------------- */

// Deux lettres exactement : index.js ne se ramasse pas lui-meme.
const PAQUETS = import.meta.glob('./[a-z][a-z].js');

/** Depose le paquet d'une langue. Rend true si la langue est utilisable. */
export async function charger(code) {
  const N = globalThis.SprinterI18N;
  if (!N || !code) return false;
  if (N.loaded(code)) return true;
  const tirer = PAQUETS['./' + code + '.js'];
  if (!tirer) return false;
  try {
    const m = await tirer();
    const p = m.default || m.paquet;
    return p ? N.register(code, p) : false;
  } catch (e) {
    // Paquet absent ou casse : la langue reste en anglais, le jeu continue.
    return false;
  }
}

/** Charge puis applique. Rend la langue reellement en place. */
export async function choisir(code) {
  const N = globalThis.SprinterI18N;
  if (!N) return 'fr';
  await charger(code);
  return N.setLang(code);
}

/** Les langues dont le paquet est present dans le bundle. */
export function disponibles() {
  const N = globalThis.SprinterI18N;
  if (!N) return [];
  return N.LANGUES.filter(l =>
    l.code === 'fr' || l.code === 'en' || !!PAQUETS['./' + l.code + '.js']);
}

// Le moteur est du JavaScript ancien, sans acces aux modules : il passe par
// ce global, comme il le fait deja pour SprinterI18N.
globalThis.SprinterLangues = { charger, choisir, disponibles };
