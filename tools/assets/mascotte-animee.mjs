// LA MASCOTTE ANIMEE : un GLB Tripo (squelette UE5, ses clips) allege pour le jeu et les videos
//
//   node tools/assets/mascotte-animee.mjs <tripo.glb> <sortie.glb> "court=debut du nom;court2=autre debut;..."
//        [--couleur 2048] [--normale 1024] [--rugosite 512] [--plus autre-tripo.glb]...
//
// Contrairement a tripo-vers-jeu.mjs (le corps de COURSE, pose par le code sur le squelette du
// jeu, sans clip), ce fichier garde le squelette UE5 de Tripo et SES animations : la mascotte
// y joue ses gestes avec un THREE.AnimationMixer (src/game/mascotte-3d.ts), comme le molosse.
// Ce que fait le script :
//   1. ne garde que les clips demandes, chacun retrouve par le DEBUT de son nom Tripo (sans
//      casse ; « idle » trouve « idle.001 ») et renomme d'un nom court (« rire », « trepigne ») ;
//      un clip demande et introuvable arrete tout ;
//   2. retire les cles redondantes des animations (resample) et ce qui ne sert plus (prune) ;
//   3. ramene les textures Tripo (couleur 4096, normale 2048 en PNG de 5 Mo) aux cotes donnees.
// Ensuite : optimiser-glb.mjs (meshopt) puis textures-ktx2.mjs (KTX2), comme les autres modeles.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, resample, dedup } from '@gltf-transform/functions';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (nom, def) => { const i = args.indexOf('--' + nom); if (i < 0) return def; const v = +args[i + 1]; args.splice(i, 2); return v; };
const COULEUR = opt('couleur', 2048), NORMALE = opt('normale', 1024), RUGOSITE = opt('rugosite', 512);
// --plus : les clips d'un autre export Tripo du MEME corps (le rival v2 a ete exporte en deux
// fichiers, 30 clips IA + 12 prereglages) ; ses pistes sont rattachees aux os de meme nom.
const PLUS = [];
for (let i; (i = args.indexOf('--plus')) >= 0;) { PLUS.push(args[i + 1]); args.splice(i, 2); }
const [src, sortie, liste] = args;
if (!src || !sortie || !liste) {
  console.error('usage : mascotte-animee.mjs <tripo.glb> <sortie.glb> "court=debut;..." [--couleur 2048] [--normale 1024] [--rugosite 512]');
  process.exit(1);
}
const voulus = liste.split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
  const [court, debut] = s.split('=');
  return { court: court.trim(), debut: (debut || court).trim().toLowerCase() };
});

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const racine = doc.getRoot();

for (const f of PLUS) {
  const autre = (await io.read(f)).getRoot();
  const parNom = new Map(racine.listNodes().map((n) => [n.getName(), n]));
  const tampon = racine.listBuffers()[0];
  const copier = (acc) => doc.createAccessor().setArray(acc.getArray().slice()).setType(acc.getType())
    .setNormalized(acc.getNormalized()).setBuffer(tampon);
  for (const a of autre.listAnimations()) {
    const b = doc.createAnimation(a.getName());
    for (const c of a.listChannels()) {
      const cible = parNom.get(c.getTargetNode()?.getName());
      if (!cible) continue;
      const s = c.getSampler();
      const e = doc.createAnimationSampler().setInput(copier(s.getInput())).setOutput(copier(s.getOutput()))
        .setInterpolation(s.getInterpolation());
      b.addSampler(e).addChannel(doc.createAnimationChannel().setTargetNode(cible).setTargetPath(c.getTargetPath()).setSampler(e));
    }
  }
}

// 1. les clips
const anims = racine.listAnimations();
const gardes = new Set();
for (const v of voulus) {
  const a = anims.find((x) => !gardes.has(x) && x.getName().toLowerCase().startsWith(v.debut));
  if (!a) { console.error(`clip introuvable : « ${v.debut} » (${v.court})\n  dans : ${anims.map((x) => x.getName().slice(0, 40)).join(' | ')}`); process.exit(1); }
  a.setName(v.court);
  gardes.add(a);
}
for (const a of anims) if (!gardes.has(a)) a.dispose();

// 2. les cles redondantes, ce qui ne sert plus
await doc.transform(resample(), prune({ keepAttributes: false, keepLeaves: true }), dedup());

// 3. les textures, a la cote de leur role
const cote = new Map();
for (const m of racine.listMaterials()) {
  const t = (tex, c) => { if (tex) cote.set(tex, Math.min(cote.get(tex) || Infinity, c)); };
  t(m.getBaseColorTexture(), COULEUR);
  t(m.getEmissiveTexture(), COULEUR);
  t(m.getNormalTexture(), NORMALE);
  t(m.getMetallicRoughnessTexture(), RUGOSITE);
  t(m.getOcclusionTexture(), RUGOSITE);
}
for (const [tex, c] of cote) {
  const img = tex.getImage();
  if (!img) continue;
  const meta = await sharp(img).metadata();
  if (Math.max(meta.width, meta.height) <= c) continue;
  // (PNG : textures-ktx2.mjs le reencode de toute facon, et une normale ne supporte pas le JPEG)
  const png = await sharp(img).resize(c, c, { fit: 'inside' }).png().toBuffer();
  tex.setImage(new Uint8Array(png)).setMimeType('image/png');
}

await io.write(sortie, doc);
const duree = (a) => Math.max(0, ...a.listSamplers().map((s) => s.getInput()?.getMax([])[0] || 0));
console.log(`${sortie} : ${racine.listAnimations().map((a) => `${a.getName()} ${duree(a).toFixed(1)} s`).join(', ')}`);
