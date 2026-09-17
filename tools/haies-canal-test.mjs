// HURDLERS, OUVERT SUR LE CANAL DE TEST ET LUI SEUL.
//
// Le drapeau HAIES_OUVERTES (game/canal.ts) se replie a la compilation. Comme
// depart-test, ce harnais COMPILE le jeu une fois par canal et regarde ce que
// chaque version fait du monde Hurdlers :
//
//   - test : le monde bascule l'accueil de Sprinter sur les haies, et ses
//     trois epreuves sont jouables ;
//   - production : le monde reste l'accueil qui les annonce « bientot », et
//     une course de haies lancee par un lien se court sans que cet accueil
//     vienne se poser par-dessus.

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

titre('LE CANAL DE TEST');

{
  const M = await jeuDe('test');
  ok('les haies y sont ouvertes', M.HAIES_OUVERTES === true);
  ok('le monde Hurdlers y joue Hurdlers', M.jeuDuMonde('hurdlers') === 'hurdlers');
  ok('ses trois epreuves y sont jouables', jouables(M) === 3, `${jouables(M)}/3`);
  courseDeHaies(M);
  ok('une course de haies y arme les haies', M.haiesEnCours());
  ok('et ramene au monde Hurdlers', M.mondeCourant() === 'hurdlers', M.mondeCourant());
}

titre('LE JEU PUBLIE');

{
  const M = await jeuDe('production');
  ok('les haies y sont fermees', M.HAIES_OUVERTES === false);
  ok('le monde Hurdlers y reste Sprinter', M.jeuDuMonde('hurdlers') === 'sprinter');
  ok('ses trois epreuves y sont annoncees, pas jouables', jouables(M) === 0, `${jouables(M)}/3`);
  courseDeHaies(M);
  ok('une course de haies venue d un lien se court quand meme', M.haiesEnCours());
  ok('sans que l accueil « bientot » se pose par-dessus', M.mondeCourant() === 'sprinter',
     M.mondeCourant());
  ok('le jeu suit l epreuve le temps de la course', M.jeuCourant() === 'hurdlers', M.jeuCourant());
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
