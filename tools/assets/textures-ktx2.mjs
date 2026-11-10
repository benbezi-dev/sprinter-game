// TEXTURES DES GLB EN KTX2/BASIS (compressees pour le GPU : elles le restent en memoire video)
//
//   node tools/assets/textures-ktx2.mjs [--sortie dossier] fichier.glb...
//
// Sans --sortie, chaque fichier est reecrit sur place (git garde l'original).
// Il faut l'encodeur toktx de Khronos (KTX-Software 4.x) dans le PATH :
//   Mac : bash /Volumes/MUSIQUE/BENBEZI/claude-commun/installer-ktx-mac.sh (Homebrew n'a pas de paquet)
//   Linux : tools/assets/ktx.sh (alors TOKTX="tools/assets/ktx.sh toktx")
// Le jeu doit lire ces fichiers : src/game/chargeur-gltf.ts (KTX2Loader + public/basis/).
//
// Par texture, selon ce qu'elle porte (gltf-transform listTextureSlots) :
//   couleur, emission            -> ETC1S, sRGB      (petit, perte visible seulement de pres)
//   rugosite/metal, occlusion    -> ETC1S, lineaire
//   normale                      -> UASTC + RDO, lineaire (ETC1S y ferait des escaliers sur l'eclairage)
// Mipmaps generees. Une image webp/jpg/png est d'abord passee en PNG (sharp), toktx ne lit pas le webp.
// Dimensions ramenees a un multiple de 4 (blocs 4x4 de Basis). La geometrie n'est pas touchee
// (meshopt relu et reecrit tel quel).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { listTextureSlots } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const args = process.argv.slice(2);
let sortie = null;
const i = args.indexOf('--sortie');
if (i >= 0) { sortie = args[i + 1]; args.splice(i, 2); }
if (!args.length) { console.error('usage : textures-ktx2.mjs [--sortie dossier] fichier.glb...'); process.exit(1); }
const [toktx, ...toktxPre] = (process.env.TOKTX || 'toktx').split(' ');

const DONNEES = new Set(['normalTexture', 'metallicRoughnessTexture', 'occlusionTexture']);
const NORMALE = 'normalTexture'; // seule a passer en UASTC : ETC1S y fait des escaliers sur l'eclairage

await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const tmp = mkdtempSync(join(tmpdir(), 'ktx2-'));
let avant = 0, apres = 0;
try {
  for (const f of args) {
    const doc = await io.read(f);
    const taille0 = statSync(f).size;
    let n = 0;
    for (const tex of doc.getRoot().listTextures()) {
      if (tex.getMimeType() === 'image/ktx2') continue;
      const slots = listTextureSlots(tex);
      // une texture partagee entre couleur et donnees : on la traite en donnees (lineaire)
      const donnees = slots.some((s) => DONNEES.has(s)), normale = slots.includes(NORMALE);
      const img = sharp(Buffer.from(tex.getImage()));
      const { width: l, height: h } = await img.metadata();
      const l4 = Math.max(4, Math.round(l / 4) * 4), h4 = Math.max(4, Math.round(h / 4) * 4);
      const png = join(tmp, `t${n}.png`), ktx = join(tmp, `t${n}.ktx2`);
      await (l4 === l && h4 === h ? img : img.resize(l4, h4, { fit: 'fill' })).png().toFile(png);
      const lin = ['--assign_oetf', 'linear', '--assign_primaries', 'none'];
      const opts = normale
        ? ['--encode', 'uastc', '--uastc_quality', '2', '--uastc_rdo_l', '1', '--zcmp', '19', ...lin]
        : ['--encode', 'etc1s', '--clevel', '4', '--qlevel', '255', ...(donnees ? lin : ['--assign_oetf', 'srgb'])];
      execFileSync(toktx, [...toktxPre, '--t2', '--genmipmap', ...opts, ktx, png], { stdio: ['ignore', 'ignore', 'inherit'] });
      tex.setImage(new Uint8Array(readFileSync(ktx))).setMimeType('image/ktx2');
      if (tex.getURI()) tex.setURI(tex.getURI().replace(/\.(png|jpe?g|webp)$/i, '.ktx2'));
      n++;
    }
    if (!n) { console.log(`rien a convertir : ${f}`); continue; }
    doc.createExtension(KHRTextureBasisu).setRequired(true);
    // plus aucune image webp : l'extension ne doit plus etre exigee du lecteur
    if (!doc.getRoot().listTextures().some((t) => t.getMimeType() === 'image/webp')) {
      doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === 'EXT_texture_webp')?.dispose();
    }
    const cible = sortie ? join(sortie, basename(f)) : f;
    await io.write(cible, doc);
    const taille1 = statSync(cible).size;
    avant += taille0; apres += taille1;
    console.log(`${n} texture(s), ${(taille0 / 1e6).toFixed(2)} Mo -> ${(taille1 / 1e6).toFixed(2)} Mo  ${f}`);
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }
if (apres) console.log(`total : ${(avant / 1e6).toFixed(1)} Mo -> ${(apres / 1e6).toFixed(1)} Mo`);
