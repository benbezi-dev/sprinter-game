// PREUVE QU'UNE OPTIMISATION N'A RIEN CHANGÉ À LA FORME
//   node tools/assets/verifier-identique.mjs original.glb optimise.glb
// Compare, maillage par maillage, l'ensemble des triangles : positions, normales,
// couleurs et coordonnées de texture de chacun de leurs trois coins, sens de
// rotation compris (un triangle retourné change d'éclairage). L'ordre des sommets
// et des triangles peut différer (le réordonnancement le change), pas leur contenu.
// Les attributs retirés parce qu'inutilisés (UV d'un matériau sans texture) sont
// ignorés s'ils manquent dans le second fichier ; ils sont listés.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const [fa, fb] = process.argv.slice(2);
const [A, B] = [await io.read(fa), await io.read(fb)];
const prims = (d) => d.getRoot().listMeshes().flatMap((m) => m.listPrimitives().map((p) => ({ m: m.getName(), p })));
const pa = prims(A), pb = prims(B);
let ok = pa.length === pb.length;
if (!ok) console.log(`nombre de primitives : ${pa.length} contre ${pb.length}`);
for (let k = 0; ok && k < pa.length; k++) {
  const a = pa[k].p, b = pb[k].p;
  const sem = b.listSemantics();
  const retires = a.listSemantics().filter((s) => !sem.includes(s));
  if (retires.length) console.log(`${pa[k].m} : attributs retirés ${retires.join(', ')}`);
  const cles = (p) => {
    const idx = p.getIndices(), n = idx ? idx.getCount() : p.getAttribute('POSITION').getCount();
    const at = sem.map((s) => p.getAttribute(s)); const tmp = [];
    const coin = (i) => at.map((x) => x.getElement(i, tmp).map((v) => Math.fround(v)).join(',')).join('|');
    const m = new Map();
    for (let t = 0; t < n; t += 3) {
      const c = [0, 1, 2].map((j) => coin(idx ? idx.getScalar(t + j) : t + j));
      // la plus petite des trois rotations (même sens) : stable même si deux coins coïncident
      const key = [0, 1, 2].map((r) => [c[r], c[(r + 1) % 3], c[(r + 2) % 3]].join('#')).sort()[0];
      m.set(key, (m.get(key) || 0) + 1);
    }
    return m;
  };
  const ma = cles(a), mb = cles(b);
  let diff = ma.size !== mb.size;
  if (!diff) for (const [key, v] of ma) if (mb.get(key) !== v) { diff = true; break; }
  if (diff) { ok = false; console.log(`${pa[k].m} : les triangles diffèrent`); }
}
console.log(ok ? `IDENTIQUE  ${fb}` : `DIFFÉRENT  ${fb}`);
process.exit(ok ? 0 : 1);
