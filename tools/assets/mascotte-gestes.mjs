// LES GESTES EN PLUS D'UNE MASCOTTE, SANS SON CORPS (20/11/2026)
//
//   node tools/assets/mascotte-gestes.mjs <anime-complet.glb> <sortie-gestes.glb> "geste1,geste2,..."
//
// <anime-complet.glb> : la sortie de mascotte-animee.mjs avec TOUS les clips Tripo (43 pour le
// heros, 42 pour le rival). On n'en garde que les gestes NOMMES — ceux qui ne sont pas deja dans
// le fichier de base (public/modeles/mascotte/anime/<nom>.glb) — et l'on retire maillages,
// matieres et textures : il reste les os (leurs noms, que les pistes visent) et les animations.
// Le jeu charge ce fichier APRES le corps (src/game/mascotte-3d.ts, chargerGestes) et rattache
// ses clips au meme squelette : la mascotte s'affiche aussi vite qu'avant, ses gestes en plus
// arrivent ensuite. Puis : optimiser-glb.mjs (meshopt) sur la sortie.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';

const [src, sortie, liste] = process.argv.slice(2);
if (!src || !sortie || !liste) { console.error('usage : mascotte-gestes.mjs <anime-complet.glb> <sortie.glb> "geste1,geste2"'); process.exit(1); }
const voulus = new Set(liste.split(',').map((s) => s.trim()).filter(Boolean));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const r = doc.getRoot();
for (const a of r.listAnimations()) if (!voulus.has(a.getName())) a.dispose();
const manque = [...voulus].filter((n) => !r.listAnimations().some((a) => a.getName() === n));
if (manque.length) { console.error('gestes introuvables : ' + manque.join(', ')); process.exit(1); }
for (const n of r.listNodes()) { n.setMesh(null); n.setSkin(null); }
for (const x of [...r.listMeshes(), ...r.listSkins(), ...r.listMaterials(), ...r.listTextures()]) x.dispose();
await doc.transform(prune({ keepLeaves: true }));
await io.write(sortie, doc);
console.log(`${sortie} : ${r.listAnimations().length} gestes`);
