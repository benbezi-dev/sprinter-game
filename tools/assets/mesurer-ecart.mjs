// L'ÉCART D'UNE QUANTIFICATION, SOMMET PAR SOMMET
//   node tools/assets/mesurer-ecart.mjs original.glb quantifie.glb [tolerance_mm=1] [angle_deg=1]
// La quantification garde l'ordre des sommets : on compare chaque sommet à lui-même,
// en coordonnées du monde (matrice du nœud appliquée, celle qui porte la mise à
// l'échelle des entiers normalisés). Affiche l'écart maximal des positions (mm) et
// des normales (degrés). Code de sortie 1 au-delà des tolérances.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const [fa, fb, tolMm = '1', tolDeg = '1'] = process.argv.slice(2);
const mat = (m, v, w) => [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + (w ? m[12 + r] : 0));
const norme = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
function sommets(doc) {
  const out = [];
  for (const n of doc.getRoot().listNodes()) {
    const mesh = n.getMesh(); if (!mesh) continue;
    const M = n.getWorldMatrix();
    // normales : inverse transposée ; la quantification n'ajoute qu'échelle et translation,
    // et une échelle uniforme ne change pas la direction après normalisation
    for (const p of mesh.listPrimitives()) {
      const P = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), t = [];
      for (let i = 0; i < P.getCount(); i++) {
        const pos = mat(M, P.getElement(i, t), true);
        const nor = N ? norme(mat(M, N.getElement(i, []), false)) : null;
        out.push([pos, nor]);
      }
    }
  }
  return out;
}
const A = sommets(await io.read(fa)), B = sommets(await io.read(fb));
if (A.length !== B.length) { console.log(`nombre de sommets : ${A.length} contre ${B.length}`); process.exit(1); }
let dP = 0, dN = 0;
for (let i = 0; i < A.length; i++) {
  dP = Math.max(dP, Math.hypot(A[i][0][0] - B[i][0][0], A[i][0][1] - B[i][0][1], A[i][0][2] - B[i][0][2]));
  if (A[i][1] && B[i][1]) {
    const c = Math.min(1, A[i][1][0] * B[i][1][0] + A[i][1][1] * B[i][1][1] + A[i][1][2] * B[i][1][2]);
    dN = Math.max(dN, Math.acos(c) * 180 / Math.PI);
  }
}
const ok = dP * 1000 <= +tolMm && dN <= +tolDeg;
console.log(`${ok ? 'OK ' : 'TROP'}  position ${(dP * 1000).toFixed(3)} mm · normale ${dN.toFixed(3)}°  ${fb}`);
process.exit(ok ? 0 : 1);
