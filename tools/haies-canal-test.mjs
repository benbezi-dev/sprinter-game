// HURDLERS, OUVERT PARTOUT.
//
// Ce harnais a d'abord servi a prouver le CONTRAIRE : que les haies ne
// s'ouvraient que sur le canal de test, et que le build public les annoncait
// « bientot ». Elles sont ouvertes a tout le monde depuis le 19 septembre
// 2026, et il verifie donc maintenant que les deux canaux en disent la meme
// chose — c'est-a-dire qu'aucun reste de garde ne s'est glisse quelque part.
//
// On garde la compilation PAR CANAL, et ce n'est pas une precaution pour
// rien : HAIES_OUVERTES se replie a la compilation, un seul `EST_TEST` oublie
// dans une condition suffirait a redonner deux jeux differents sans que
// personne ne s'en apercoive avant de l'ouvrir sur un telephone.
//
// Ce que les deux versions doivent faire : basculer l'accueil de Sprinter sur
// les haies, rendre les trois epreuves jouables, et courir une course de haies
// venue d'un lien en suivant l'epreuve.

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/* ------------------------------------------------------------- le decor */

globalThis.Image = class { set src(v) { this._src = v; } get src() { return this._src; } };
globalThis.window = { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 };
globalThis.document = {
  createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {}, dataset: {} }, body: { style: {} },
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

/* --------------------------------------------------------- les deux jeux */

async function jeuDe(canal) {
  const dossier = mkdtempSync(join(tmpdir(), `sprinter-haies-${canal}-`));
  const entree = join(dossier, 'entree.ts');
  const sortie = join(dossier, 'paquet.mjs');
  const src = f => join(process.cwd(), 'src/game', f);
  writeFileSync(entree, [
    `export { SprinterApp } from '${src('engine.ts')}';`,
    `export { jeuDuMonde, jeuCourant } from '${src('jeux.ts')}';`,
    `export { MONDES, mondeCourant } from '${src('mondes.ts')}';`,
    `export { HAIES_OUVERTES } from '${src('canal.ts')}';`,
    `export { haiesEnCours } from '${src('haies-course.js')}';`,
  ].join('\n'));
  await build({
    entryPoints: [entree], outfile: sortie, bundle: true,
    format: 'esm', platform: 'node', logLevel: 'silent',
    define: {
      'import.meta.env.VITE_CANAL': JSON.stringify(canal),
      'import.meta.env.BASE_URL': '"/"',
    },
  });
  return import(sortie);
}

/** Une course de haies posee comme la pose un lien de defi : par la cle. */
function courseDeHaies(M) {
  const A = M.SprinterApp, G = A.G;
  G.raceKey = '110h';
  G.race = A.RACES['110h'];
  A.buildLevel(0);
}

const jouables = M => M.MONDES.hurdlers.disciplines.filter(d => d.jouable).length;

for (const canal of ['test', 'production']) {
  titre(canal === 'test' ? 'LE CANAL DE TEST' : 'LE JEU PUBLIE');
  const M = await jeuDe(canal);
  ok('les haies y sont ouvertes', M.HAIES_OUVERTES === true);
  ok('le monde Hurdlers y joue Hurdlers', M.jeuDuMonde('hurdlers') === 'hurdlers');
  ok('ses trois epreuves y sont jouables', jouables(M) === 3, `${jouables(M)}/3`);
  courseDeHaies(M);
  ok('une course de haies y arme les haies', M.haiesEnCours());
  ok('et ramene au monde Hurdlers', M.mondeCourant() === 'hurdlers', M.mondeCourant());
  ok('le jeu suit l epreuve le temps de la course', M.jeuCourant() === 'hurdlers', M.jeuCourant());
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
