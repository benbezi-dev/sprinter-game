// LA COURSE EN VRAIE 3D — le GPU du telephone (11/11/2026, lot 2 de docs/audit-refonte-3d-2026-11-10.md).
//
// L'ULTRA SUR UN TELEPHONE HAUT DE GAMME. Jusqu'ici, tout telephone etait plafonne au palier 2
// (paliers.ts). Un telephone dont la puce graphique est de la generation des fleurons 2022 et
// suivants, avec au moins 8 Go de memoire quand le navigateur la dit, a maintenant droit au
// palier 3 — mais il part toujours du palier 2 : c'est la cadence mesuree en course qui l'y
// fait monter (dix secondes fluides), et il s'en souvient. Les autres restent au palier 2.
// shortcut: les iPhone repondent « Apple GPU » sans modele ni memoire — on ne peut pas les trier,
// ils restent au palier 2 (?qualite=ultra le force) ; a reprendre avec une mesure sur un vrai iPhone.

/** Le nom de la puce graphique (WEBGL_debug_renderer_info), '' si le navigateur le cache. */
export function gpuDeLAppareil(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const nom = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();   // ce contexte n'a servi qu'a lire le nom
    return nom;
  } catch { return ''; }
}

/** Un telephone haut de gamme ? `memoire` : navigator.deviceMemory (Go, plafonne a 8 ; absent hors Chromium). */
export function gpuHautDeGamme(gpu: string, memoire?: number): boolean {
  if (memoire != null && memoire < 8) return false;
  const adreno = /Adreno \(TM\) (\d{3})/.exec(gpu);
  if (adreno) return +adreno[1] >= 730;                    // Snapdragon 8 Gen 1 et suivants (le Flip6 : 750)
  const mali = /Mali-G(\d+)/.exec(gpu);
  if (mali) return +mali[1] >= 710;                        // G710, G715, G720, G925 ; pas les G6xx ni les G5x/G7x a deux chiffres
  return /Immortalis|Xclipse 9\d\d/.test(gpu);             // Dimensity 9200+, Exynos 2200+
}
