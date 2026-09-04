/* Extrait la colonne anglaise de sprinter-i18n.js en un squelette JSON.
   C'est la source a traduire : tant qu'un paquet couvre ces cles-la, il
   couvre le jeu. Usage : node tools/langues-extraire.mjs */
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/game/sprinter-i18n.js', import.meta.url), 'utf8');
new Function(src)();
const N = globalThis.SprinterI18N;

const EN = 1;
const ui = {};
for (const k of Object.keys(N.UI)) ui[k] = N.UI[k][EN];

const raceSub = {};
for (const k of Object.keys(N.RACE_SUB)) raceSub[k] = N.RACE_SUB[k][EN];

const scene = t => t.map(v => v[EN]);
const parEtape = t => t.map(scene);

const source = {
  UI: ui,
  LEVEL_NAMES: N.LEVEL_NAMES.map(v => v[EN]),
  RACE_SUB: raceSub,
  CUTS: {
    intro: parEtape(N.CUT_INTRO),
    defeat: parEtape(N.CUT_DEFEAT),
    taunt: parEtape(N.CUT_TAUNT),
    champion: scene(N.CUT_CHAMPION)
  }
};

const out = new URL('../src/game/langues/_source.json', import.meta.url);
writeFileSync(out, JSON.stringify(source, null, 2) + '\n');

const lignes = source.CUTS.champion.length +
  ['intro', 'defeat', 'taunt'].reduce(
    (n, k) => n + source.CUTS[k].reduce((m, e) => m + e.length, 0), 0);
console.log('UI          ', Object.keys(ui).length, 'cles');
console.log('LEVEL_NAMES ', source.LEVEL_NAMES.length);
console.log('RACE_SUB    ', Object.keys(raceSub).length);
console.log('CUTS        ', lignes, 'scenes de 4 lignes');
console.log('->          ', out.pathname);
