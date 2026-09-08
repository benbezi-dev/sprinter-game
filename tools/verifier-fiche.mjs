// Verifie que les textes de la fiche Play tiennent dans les bornes de Google.
//
//   node tools/verifier-fiche.mjs
//
// Les bornes se comptent en caracteres, pas en octets — un accent compte pour
// un. On lit `assets-stores/fiche-play.md` plutot qu'une copie : le document
// que l'on colle dans la console est le seul qui fasse foi.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const FICHE = fileURLToPath(new URL('../assets-stores/fiche-play.md', import.meta.url));

const BORNES = [
  ['Titre', 30],
  ['Description courte', 80],
  ['Description longue', 4000],
];

const md = await readFile(FICHE, 'utf8');
let ko = 0;

for (const [nom, max] of BORNES) {
  // Le premier bloc de code qui suit le titre de section.
  const i = md.indexOf('## ' + nom);
  if (i < 0) { console.log(`  MANQUE   ${nom}`); ko++; continue; }
  const bloc = md.slice(i).match(/```\n([\s\S]*?)\n```/);
  if (!bloc) { console.log(`  MANQUE   ${nom} — pas de bloc`); ko++; continue; }

  const texte = bloc[1];
  const n = [...texte].length;
  const etat = n <= max ? 'ok      ' : 'TROP LONG';
  if (n > max) ko++;
  const reste = max - n;
  console.log(`  ${etat} ${nom.padEnd(20)} ${String(n).padStart(4)} / ${max}` +
              (n <= max ? `   (${reste} de marge)` : `   (${-reste} de trop)`));
}

// Les descriptions passent par des champs qui n'aiment pas les lignes vides
// en trop ni les espaces de fin : Play les garde tels quels a l'affichage.
const longue = md.slice(md.indexOf('## Description longue')).match(/```\n([\s\S]*?)\n```/);
if (longue && /[ \t]+$/m.test(longue[1])) {
  console.log('  ATTENTION  la description longue a des espaces en fin de ligne');
  ko++;
}

console.log(ko ? `\n${ko} probleme(s)` : '\nToutes les longueurs passent.');
process.exit(ko ? 1 : 0);
