// VERSION MOBILE D'UNE PIECE ULTRA : moins de triangles, meme silhouette, meme rendu a facettes
//
//   node tools/assets/version-mobile.mjs [--triangles 60000] [--bits-position 14] [--sortie dossier] piece-ultra.glb...
//
// Les pieces Tripo ultra (stades-ultra/) n'ont ni texture ni couleur de sommet : leur rendu tient
// a leurs facettes (une normale par face, aucun sommet partage — 693 000 sommets pour 232 000
// triangles). Dans l'ordre :
//   1. sommets en Float32, normales retirees, sommets soudes par position (0,1 mm) ;
//   2. simplification meshoptimizer jusqu'a --triangles (la silhouette d'abord, erreur bornee) ;
//   3. re-desoudage et normales a facettes recalculees : meme aspect que l'ultra ;
//   4. quantification (positions 14 bits, normales 10) et compression meshopt, comme les pieces
//      ultra deja publiees : le jeu fusionne les matrices via geometrieFlottante (ruelle-3d.ts).
// Sans --sortie, ecrit a cote : piece.mobile.glb.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dequantize, normals, prune, quantize, simplify, unweld, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { statSync } from 'node:fs';
import { basename, join } from 'node:path';

const args = process.argv.slice(2);
const opt = (nom, defaut) => { const i = args.indexOf(nom); if (i < 0) return defaut; const v = args[i + 1]; args.splice(i, 2); return v; };
const cible = +opt('--triangles', 60000);
const sortie = opt("--sortie", null);
const bits = +opt("--bits-position", 14); // 16 pour les grandes pieces (mat de 10 m), comme leurs ultra
if (!args.length) { console.error('usage : version-mobile.mjs [--triangles 60000] [--sortie dossier] piece.glb...'); process.exit(1); }

await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const triangles = (doc) => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
  .reduce((n, p) => n + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0);

for (const f of args) {
  const doc = await io.read(f);
  const t0 = triangles(doc);
  await doc.transform(dequantize());
  for (const p of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
    const n = p.getAttribute('NORMAL'); if (n) { p.setAttribute('NORMAL', null); n.dispose(); }
  }
  await doc.transform(
    weld({ tolerance: 0.0001 }),
    simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, cible / t0), error: 0.01, lockBorder: false }),
    unweld(),
    normals({ overwrite: true }),
    prune(),
    quantize({ quantizePosition: bits, quantizeNormal: 10 }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const out = sortie ? join(sortie, basename(f)) : f.replace(/\.glb$/, '.mobile.glb');
  await io.write(out, doc);
  console.log(`${Math.round(t0)} -> ${Math.round(triangles(doc))} triangles, ${(statSync(f).size / 1e6).toFixed(2)} -> ${(statSync(out).size / 1e6).toFixed(2)} Mo  ${out}`);
}
