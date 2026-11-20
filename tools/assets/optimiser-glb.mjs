// OPTIMISER DES GLB SANS CHANGER LEUR FORME
//
//   node tools/assets/optimiser-glb.mjs [--sortie dossier] [--quantifier [--bits-position 16]] fichier.glb...
//
// Sans --sortie, chaque fichier est réécrit sur place (git garde l'original).
// Ce que fait le script, dans l'ordre :
//   1. retire les attributs que rien n'utilise (coordonnées de texture d'un matériau
//      sans texture, par exemple : les pièces Tripo des stades en portent 8 Mo pour rien) ;
//   2. fusionne les doublons (matériaux, accessoires identiques) ;
//   3. réordonne sommets et triangles pour la carte graphique (cache de sommets),
//      puis compresse en EXT_meshopt_compression, que le jeu décode déjà
//      (GLTFLoader.setMeshoptDecoder).
// SANS QUANTIFICATION, ET C'EST VOULU : les sommets restent en Float32, comme dans les
// pièces légères déjà publiées. Le jeu fusionne la transformation des nœuds dans la
// géométrie (ruelle-3d.ts, `applyMatrix4` ; course-3d.ts, le bloc de départ) : sur des
// entiers normalisés, cette opération écrêterait les positions entre -1 et 1.
// La compression est donc sans perte : mêmes sommets, mêmes triangles, au bit près.
// Un fichier déjà compressé en meshopt est laissé tel quel.
//
// --quantifier (AVEC PERTE, INVISIBLE) : les sommets passent en entiers normalisés
// (KHR_mesh_quantization) — positions sur 14 bits (0,3 mm sur une pièce de 4 m),
// normales sur 10, UV sur 12 — et le restent dans la mémoire graphique : environ
// deux fois moins de mémoire vidéo et de téléchargement. La mise à l'échelle passe
// dans la matrice du nœud : tout code qui fusionne cette matrice dans la géométrie
// doit d'abord repasser les sommets en Float32 (geometrieFlottante, ruelle-3d.ts).
// L'ordre des sommets est conservé : verifier-identique.mjs --tolerance mesure l'écart.
// Accepte des fichiers déjà compressés sans perte ; ignore ceux déjà quantifiés.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { statSync } from 'node:fs';
import { basename, join } from 'node:path';

const args = process.argv.slice(2);
let sortie = null;
const i = args.indexOf('--sortie');
if (i >= 0) { sortie = args[i + 1]; args.splice(i, 2); }
const quantifier = args.includes('--quantifier');
if (quantifier) args.splice(args.indexOf('--quantifier'), 1);
// --bits-position 16 : pour les grandes pièces (mât, sautoir de 10 m), dont l'écart dépasse 1 mm à 14 bits
let bitsPosition = 14;
const b = args.indexOf('--bits-position');
if (b >= 0) { bitsPosition = +args[b + 1]; args.splice(b, 2); }
if (!args.length) { console.error('usage : optimiser-glb.mjs [--sortie dossier] fichier.glb...'); process.exit(1); }

await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

let avant = 0, apres = 0;
for (const f of args) {
  const doc = await io.read(f);
  const taille0 = statSync(f).size;
  const exts = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName);
  if (quantifier ? exts.includes('KHR_mesh_quantization') : exts.includes('EXT_meshopt_compression')) {
    console.log(`déjà fait, ignoré : ${f}`);
    continue;
  }
  if (quantifier) {
    await doc.transform(quantize({ quantizePosition: bitsPosition, quantizeNormal: 10, quantizeTexcoord: 12 }));
  } else {
    await doc.transform(
      prune({ keepAttributes: false, keepLeaves: true }),
      dedup(),
      reorder({ encoder: MeshoptEncoder }),
    );
  }
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const cible = sortie ? join(sortie, basename(f)) : f;
  await io.write(cible, doc);
  const taille1 = statSync(cible).size;
  avant += taille0; apres += taille1;
  console.log(`${(taille0 / 1e6).toFixed(1)} Mo -> ${(taille1 / 1e6).toFixed(1)} Mo  ${f}`);
}
if (apres) console.log(`total : ${(avant / 1e6).toFixed(1)} Mo -> ${(apres / 1e6).toFixed(1)} Mo`);
