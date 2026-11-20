// INVENTAIRE DES TEXTURES DES GLB : poids sur disque et memoire video, par fichier
//
//   node tools/assets/inventaire-textures.mjs [dossier=public/modeles] [--tsv]
//
// Memoire video estimee avec mipmaps (x4/3) : RGBA8 = 4 octets/pixel pour une image png/jpg/webp ;
// KTX2 transcode = 1 octet/pixel (ASTC 4x4, BC7, ETC2 RGBA) ou 0,5 (ETC1S sans alpha sur ETC1/BC1 :
// on compte 1, le cas le moins favorable). Trie du plus gourmand au moins gourmand.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const tsv = process.argv.includes('--tsv');
const dossier = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'public/modeles';
const glbs = [];
const parcourir = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? parcourir(p) : n.endsWith('.glb') && glbs.push(p); } };
parcourir(dossier);

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const lignes = [];
for (const f of glbs) {
  let doc;
  try { doc = await io.read(f); } catch (e) { console.error(`illisible : ${f} (${e.message})`); continue; }
  let octets = 0, video = 0, n = 0, maxCote = 0; const types = new Set();
  for (const t of doc.getRoot().listTextures()) {
    const img = t.getImage(); if (!img) continue;
    const mime = t.getMimeType(); types.add(mime.replace('image/', ''));
    octets += img.byteLength; n++;
    let l = 0, h = 0;
    if (mime === 'image/ktx2') { const v = new DataView(img.buffer, img.byteOffset); l = v.getUint32(20, true); h = v.getUint32(24, true); }
    else ({ width: l, height: h } = await sharp(Buffer.from(img)).metadata());
    maxCote = Math.max(maxCote, l, h);
    video += l * h * (mime === 'image/ktx2' ? 1 : 4) * 4 / 3;
  }
  if (n) lignes.push({ f, n, types: [...types].join('+'), maxCote, disque: statSync(f).size, octets, video });
}
lignes.sort((a, b) => b.video - a.video);
const mo = (x) => (x / 1e6).toFixed(1);
if (tsv) { console.log('fichier\ttextures\ttypes\tcote_max\tglb_mo\ttextures_mo\tvideo_mo'); for (const l of lignes) console.log([l.f, l.n, l.types, l.maxCote, mo(l.disque), mo(l.octets), mo(l.video)].join('\t')); }
else for (const l of lignes) console.log(`${mo(l.video).padStart(7)} Mo video  ${mo(l.disque).padStart(6)} Mo glb  ${String(l.n).padStart(2)} tex ${l.types.padEnd(9)} ${String(l.maxCote).padStart(5)}px  ${l.f}`);
const s = (k) => lignes.reduce((a, l) => a + l[k], 0);
console.log(`total : ${lignes.length} GLB textures, ${mo(s('disque'))} Mo sur disque (dont textures ${mo(s('octets'))}), memoire video ~${mo(s('video'))} Mo`);
