/* Couverture des paquets de langue, cle par cle.
   Ce qui manque retombe sur l'anglais : le jeu ne casse pas, mais il parle
   deux langues a la fois. Ce compte-la est donc le seul qui dise si une
   langue est reellement livrable.
   Usage : node tools/langues-verifier.mjs [code...] */
import { readFileSync, existsSync } from 'node:fs';

const base = new URL('../src/game/langues/', import.meta.url);
const source = JSON.parse(readFileSync(new URL('_source.json', base), 'utf8'));

const i18n = readFileSync(new URL('../src/game/sprinter-i18n.js', import.meta.url), 'utf8');
new Function(i18n)();
const LANGUES = globalThis.SprinterI18N.LANGUES;

const attendu = (() => {
  let n = Object.keys(source.UI).length + source.LEVEL_NAMES.length +
          Object.keys(source.RACE_SUB).length;
  n += source.CUTS.champion.length;
  for (const k of ['intro', 'defeat', 'taunt'])
    for (const etape of source.CUTS[k]) n += etape.length;
  return n;
})();

// Une variable perdue en traduction ne se voit qu'a l'ecran, sur le mot
// manquant. On la rattrape ici : {n}, {s}, {r}... doivent survivre.
const vars = t => (String(t).match(/\{[a-z_]+\}/g) || []).sort().join(',');

function variables(p) {
  const fautes = [];
  for (const k of Object.keys(source.UI)) {
    const cible = p.UI && p.UI[k];
    if (typeof cible !== 'string') continue;
    if (vars(cible) !== vars(source.UI[k])) fautes.push('UI.' + k);
  }
  const scenes = (nom, src, cible) => src.forEach((s, i) => {
    const c = cible && cible[i];
    if (!Array.isArray(c)) return;
    if (vars(c.join(' ')) !== vars(s.join(' '))) fautes.push(nom + '[' + i + ']');
  });
  if (p.CUTS) {
    scenes('CUTS.champion', source.CUTS.champion, p.CUTS.champion);
    for (const k of ['intro', 'defeat', 'taunt'])
      source.CUTS[k].forEach((etape, e) =>
        scenes('CUTS.' + k + '[' + e + ']', etape, p.CUTS[k] && p.CUTS[k][e]));
  }
  return fautes;
}

function compte(p) {
  if (!p) return { fait: 0, trous: [] };
  let fait = 0; const trous = [];
  const plein = v => typeof v === 'string' && v.trim() !== '';

  for (const k of Object.keys(source.UI)) {
    if (p.UI && plein(p.UI[k])) fait++; else trous.push('UI.' + k);
  }
  source.LEVEL_NAMES.forEach((_, i) => {
    if (p.LEVEL_NAMES && plein(p.LEVEL_NAMES[i])) fait++; else trous.push('LEVEL_NAMES[' + i + ']');
  });
  for (const k of Object.keys(source.RACE_SUB)) {
    if (p.RACE_SUB && plein(p.RACE_SUB[k])) fait++; else trous.push('RACE_SUB.' + k);
  }
  const scenes = (nom, src, cible) => src.forEach((s, i) => {
    const c = cible && cible[i];
    if (Array.isArray(c) && c.length === s.length && c.every(plein)) fait++;
    else trous.push(nom + '[' + i + ']');
  });
  scenes('CUTS.champion', source.CUTS.champion, p.CUTS && p.CUTS.champion);
  for (const k of ['intro', 'defeat', 'taunt'])
    source.CUTS[k].forEach((etape, e) =>
      scenes('CUTS.' + k + '[' + e + ']', etape, p.CUTS && p.CUTS[k] && p.CUTS[k][e]));
  return { fait, trous };
}

const vises = process.argv.slice(2);
const liste = LANGUES.filter(l => l.code !== 'fr' && l.code !== 'en')
                     .filter(l => !vises.length || vises.includes(l.code));

console.log('reference : ' + attendu + ' entrees (anglais)\n');
let pret = 0;
for (const l of liste) {
  const f = new URL(l.code + '.js', base);
  if (!existsSync(f)) { console.log(pad(l.code) + pad(l.nom, 18) + '  —  aucun paquet'); continue; }
  const p = (await import(f.href)).default;
  const { fait, trous } = compte(p);
  const fautes = variables(p);
  const pc = Math.round(fait / attendu * 100);
  if (fait === attendu && !fautes.length) pret++;
  if (fautes.length) {
    console.log(pad(l.code) + pad(l.nom, 18) + '  VARIABLES PERDUES : ' +
                fautes.slice(0, 5).join(', ') +
                (fautes.length > 5 ? ' (+' + (fautes.length - 5) + ')' : ''));
  }
  console.log(pad(l.code) + pad(l.nom, 18) + String(fait).padStart(4) + ' / ' + attendu +
              String(pc).padStart(5) + ' %' + (trous.length ? '   manque : ' + trous.slice(0, 3).join(', ') +
              (trous.length > 3 ? ' (+' + (trous.length - 3) + ')' : '') : '   complet'));
}
console.log('\n' + pret + ' / ' + liste.length + ' langues completes');
function pad(s, n = 5) { return String(s).padEnd(n); }
