// LA COULEUR DU LOGO BENBEZI SE DETACHE DE CHAQUE STADE.
//
// A chaque course, le logo des panneaux publicitaires prend une teinte tiree
// au sort (src/game/teintes-pub.js), mais seulement parmi celles qui
// s'ecartent d'au moins ECART_MIN (ΔE 1976) de toutes les couleurs du decor :
// piste, sol, ciel, gradins, toit, muret, neons, panneaux voisins.
//
//   node tools/teintes-pub-test.mjs
//
// Pour chaque stade de THEMES, on liste les teintes retenues et leur ecart au
// decor. Le blanc (le logo d'origine) y est toujours, hors filtre. Le test
// echoue si un stade ne garde aucune AUTRE teinte qui se detache : le logo n'y
// changerait plus de couleur. Il signale aussi un stade ou le tirage n'aurait
// presque plus de hasard (une ou deux couleurs en plus du blanc).
import { readFileSync } from 'node:fs';

await import('../src/game/teintes-pub.js');
const TP = globalThis.TeintesPub;

// THEMES est un litteral de donnees pures dans sprinter-app.js, qui, lui, ne
// se charge pas hors du navigateur : on n'en lit que ce litteral.
const src = readFileSync(new URL('../src/game/sprinter-app.js', import.meta.url), 'utf8');
const i = src.indexOf('const THEMES = {');
const j = src.indexOf('\n  };', i);
const THEMES = new Function('return (' + src.slice(i + 'const THEMES = '.length, j + 4) + ')')();
// Au chargement, le jeu ravive toutes ces couleurs (`aviver`, juste apres
// THEMES) : c'est ce qui s'affiche, et donc ce qu'il faut verifier. On
// applique la meme fonction, lue au meme endroit.
const a0 = src.indexOf('(function aviver(');
const a1 = src.indexOf('})(1.22);', a0) + '})(1.22);'.length;
if (a0 < 0 || a1 < a0) throw new Error('aviver() introuvable dans sprinter-app.js');
new Function('THEMES', src.slice(a0, a1))(THEMES);

let echecs = 0;
for (const [nom, th] of Object.entries(THEMES)) {
  const permises = TP.teintesPour(th);
  if (!permises.some(t => t.toujours)) { console.log(`${nom} : le blanc manque`); echecs++; }
  const bonnes = permises.filter(t => !t.toujours && t.ecart >= TP.ECART_MIN);
  const liste = permises.map(t => t.toujours ? `${t.nom} (toujours)` : `${t.nom} ${t.ecart.toFixed(0)}`).join(', ');
  const note = bonnes.length === 0 ? 'ECHEC : aucune couleur ne se detache'
    : bonnes.length < 3 ? 'peu de hasard' : 'ok';
  if (bonnes.length === 0) echecs++;
  console.log(`${nom.padEnd(12)} blanc + ${String(bonnes.length).padStart(2)}  [${note}]  ${liste}`);
}
if (echecs) {
  console.error(`\n${echecs} stade(s) sans teinte qui se detache.`);
  process.exit(1);
}
console.log('\nChaque stade garde le blanc, et au moins une couleur qui se detache de son decor.');
