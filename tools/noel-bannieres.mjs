// Ecrit les bannieres des quatre clans de Noel (src/game/noel-clans.ts) dans
// public/noel/bannieres/<clan>.svg (et <clan>-en.svg), pour les reseaux et la presse.
//   node tools/noel-bannieres.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { CLANS, svgBanniere } from '../src/game/noel-clans.ts';
const dossier = new URL('../public/noel/bannieres/', import.meta.url);
mkdirSync(dossier, { recursive: true });
for (const k of CLANS) {
  writeFileSync(new URL(`${k.cle}.svg`, dossier), svgBanniere(k.n, true));
  writeFileSync(new URL(`${k.cle}-en.svg`, dossier), svgBanniere(k.n, false));
  console.log(`   ${k.cle}.svg, ${k.cle}-en.svg`);
}
