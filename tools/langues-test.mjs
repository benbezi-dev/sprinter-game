/* Le contrat de l'architecture N-langues : ce qu'un paquet ne traduit pas
   retombe sur l'anglais, et jamais sur un trou ni sur la cle nue.
   Usage : node tools/langues-test.mjs */
import { readFileSync } from 'node:fs';
new Function(readFileSync(new URL('../src/game/sprinter-i18n.js', import.meta.url), 'utf8'))();
const N = globalThis.SprinterI18N;

let rates = 0;
const ok = (libelle, vrai) => {
  if (!vrai) rates++;
  console.log((vrai ? '  ok   ' : 'ECHEC  ') + libelle);
};

ok('16 langues declarees', N.LANGUES.length === 16);
ok('arabe marque RTL', N.isRTL('ar') === true && N.isRTL('fr') === false);
ok('nom natif rendu', N.nomLangue('ja') === '日本語');

N.setLang('fr'); ok('fr : texte francais', N.t('start') === 'COMMENCER');
ok('fr : ordinal feminin', N.ord(1, true) === '1re');
N.setLang('en'); ok('en : texte anglais', N.t('start') === 'START');
ok('en : ordinal', N.ord(2) === '2nd' && N.ord(11) === '11th');

// Un paquet volontairement a trous : une cle, une scene.
N.register('es', { UI: { start: 'EMPEZAR' }, CUTS: { intro: [[['A', 'B', 'C', 'D']]] } });
N.setLang('es');
ok('paquet : cle traduite', N.t('start') === 'EMPEZAR');
ok('paquet : cle absente -> anglais', N.t('home') === 'HOME');
ok('paquet : niveau absent -> anglais', N.levelName(0) === N.LEVEL_NAMES[0][1]);
ok('paquet : scene absente -> anglais', N.cut('defeat', 0).length === 4);
ok('paquet : etape absente -> anglais', N.cut('intro', 1).length === 4);
ok('paquet : sans regle, ordinal nu', N.ord(1) === '1');

ok('champion : 5 lignes', N.cut('champion').length === 5);
ok('etape hors bornes -> vide', N.cut('intro', 99).length === 0);
ok('genre de scene inconnu -> vide', N.cut('nimporte', 0).length === 0);

N.setLang('zz'); ok('code inconnu -> francais', N.getLang() === 'fr');
ok('interpolation preservee', N.t('stage_done', { n: 3 }).includes('3'));

console.log(rates ? '\n' + rates + ' echec(s)' : '\ntout passe');
process.exit(rates ? 1 : 0);
