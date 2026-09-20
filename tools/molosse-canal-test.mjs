// LA NUIT DU MOLOSSE, DANS L'UN ET L'AUTRE CANAL.
//
// Ce harnais est ne d'une panne qui n'a fait aucun bruit : le mode a ete
// DEPLOYE sur /test et INJOUABLE, en meme temps, pendant plusieurs jours.
//
// DEUX VERROUS EN SERIE, CHACUN JUSTE, ET PERSONNE NE PASSE.
//
//   HALLOWEEN_OUVERT (canal.ts)  decide QUI voit le mode  — le canal de test.
//   la fenetre       (edition.ts) decide QUAND on l'annonce — des le 24 octobre.
//
// Relu separement, chacun etait bien regle, et c'est pour cela que personne
// n'a rien vu. Leur INTERSECTION, elle, etait vide jusqu'au 24 octobre : le
// code du mode partait bien dans le paquet de /test, et l'accueil n'affichait
// rien du tout, parce que la banderole est la SEULE porte du mode et qu'un
// joueur neuf n'a pas de carnet pour la forcer.
//
// Un drapeau se relit. Une intersection de deux drapeaux, non — il faut la
// calculer. C'est ce que fait ce fichier, et c'est sa seule raison d'etre.
//
// ON COMPILE PAR CANAL, comme les autres harnais de canal du projet
// (poussee-canal-test.mjs, haies-canal-test.mjs) : `HALLOWEEN_OUVERT` se
// replie a la compilation, et ce qui compte n'est pas ce que dit la source
// mais ce qui ARRIVE dans le paquet du joueur.
//
//   node tools/molosse-canal-test.mjs

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/* ------------------------------------------------- les deux canaux, batis */

const src = f => join(process.cwd(), 'src/game', f);

async function canalDe(canal) {
  const dossier = mkdtempSync(join(tmpdir(), `sprinter-molosse-${canal}-`));
  const entree = join(dossier, 'entree.ts');
  const sortie = join(dossier, 'paquet.mjs');
  writeFileSync(entree, [
    `export { EST_TEST, HALLOWEEN_OUVERT, HALLOWEEN_2026_OUVERT } from '${src('canal.ts')}';`,
    `export { EDITION_HALLOWEEN, editionActive } from '${src('edition.ts')}';`,
  ].join('\n'));
  await build({
    entryPoints: [entree], outfile: sortie, bundle: true,
    format: 'esm', platform: 'node', logLevel: 'silent',
    define: {
      'import.meta.env.VITE_CANAL': JSON.stringify(canal),
      'import.meta.env.BASE_URL': '"/"',
    },
  });
  return { M: await import(sortie), texte: readFileSync(sortie, 'utf8') };
}

const test = await canalDe('test');
const prod = await canalDe('production');

/* ------------------------------------------------------ les deux verrous */

titre('LE PREMIER VERROU : QUI VOIT LE MODE');

ok('sur /test, le mode est dans le paquet', test.M.HALLOWEEN_OUVERT === true);
ok('en production, il n y est pas', prod.M.HALLOWEEN_OUVERT === false);

// L'EDITION 2026 A SON PROPRE DRAPEAU, et il doit se replier pareillement.
// Deux drapeaux separes valent mieux qu'un : on peut ouvrir le mode sans le
// calendrier, ou preparer le calendrier sans montrer le mode.
ok('sur /test, l edition datee est dans le paquet', test.M.HALLOWEEN_2026_OUVERT === true);
ok('en production, l edition datee n y est pas', prod.M.HALLOWEEN_2026_OUVERT === false);
ok('EST_TEST se replie bien a la compilation',
   test.M.EST_TEST === true && prod.M.EST_TEST === false,
   `test=${test.M.EST_TEST} prod=${prod.M.EST_TEST}`);

titre('LE SECOND VERROU : QUAND ON L ANNONCE');

const H = test.M.EDITION_HALLOWEEN;
const avant = H.debut - 86400000;   // la veille de l'ouverture
const pendant = H.debut + 86400000; // le lendemain
const apres = H.fin + 86400000;     // apres la fermeture

ok('la fenetre est fermee avant le 24 octobre', test.M.editionActive(H, avant) === false);
ok('elle est ouverte pendant', test.M.editionActive(H, pendant) === true);
ok('elle est refermee apres', test.M.editionActive(H, apres) === false);
ok('editionActive ne depend PAS du canal — c est un predicat de dates',
   [avant, pendant, apres].every(t =>
     test.M.editionActive(H, t) === prod.M.editionActive(H, t)));

/* ----------------------------------------------------- et leur croisement */

titre('L INTERSECTION — CE QUE PERSONNE NE RELIT');

// La porte, telle que l'ecrit BanderoleMolosse (components/screens/Halloween.tsx) :
//
//     const dansLaFenetre = EST_TEST || editionActive(EDITION_HALLOWEEN);
//     if (!dansLaFenetre && !commence) return null;
//
// On la rejoue ici pour les deux canaux, a plusieurs instants, avec un carnet
// VIDE — le cas qui etait casse, et le seul qui compte : un joueur qui a deja
// commence garde son entree de toute facon.
const porte = (c, quand) => c.M.HALLOWEEN_OUVERT && (c.M.EST_TEST || c.M.editionActive(H, quand));

ok('SUR /test, LA PORTE EST OUVERTE HORS FENETRE — la panne corrigee',
   porte(test, avant) === true);
ok('sur /test, elle l est aussi pendant la fenetre', porte(test, pendant) === true);
ok('sur /test, elle l est encore apres — le lieu ne se reprend pas',
   porte(test, apres) === true);
ok('en production, rien avant la fenetre', porte(prod, avant) === false);
ok('en production, rien pendant non plus, tant que le mode n est pas ouvert a tous',
   porte(prod, pendant) === false);

// LA GARDE EST-ELLE BIEN CELLE QU ON VIENT DE REJOUER ? On relit la ligne
// plutot que de faire confiance a la memoire — meme methode que la seconde
// moitie de edition-danube-test.mjs. Si quelqu'un retire `EST_TEST ||` de la
// banderole, le calcul ci-dessus continuerait de passer en mentant.
const ecran = readFileSync(new URL('../src/components/screens/Halloween.tsx', import.meta.url), 'utf8');
ok('la banderole ouvre bien sur EST_TEST, et pas seulement sur les dates',
   /const dansLaFenetre = EST_TEST \|\| editionActive\(EDITION_HALLOWEEN\);/.test(ecran));
ok('et un carnet commence force toujours l entree',
   /if \(!dansLaFenetre && !commence\) return null;/.test(ecran));

/* ------------------------------------- ce qui ne doit pas partir chez tous */

titre('LE MODE SORT VRAIMENT DU PAQUET PUBLIC');

// ON BATIT POUR DE VRAI, ET C'EST LA SEULE FACON DE LE SAVOIR.
//
// esbuild ne sait pas repondre a cette question : il ne fait pas le decoupage
// en morceaux de Rollup, donc il inline tout et repond « oui, c'est la » quel
// que soit l'etat du drapeau. Il a fallu deux builds Vite complets — une
// quinzaine de secondes — pour voir ce qui se passait reellement. Ce harnais
// se lance a la main, pas en CI : il peut se les offrir.
//
// CE QU'ON A TROUVE EN FAISANT CELA, et qui etait EN LIGNE :
//
//   sprinter-game.com/assets/Halloween-*.js   200, 21 724 octets
//   sprinter-game.com/assets/molosse-*.mp3    200, 708 432 octets
//
// Sur la PRODUCTION, ou le mode n'est propose a personne. Aucun joueur ne
// pouvait l'ouvrir — le drapeau tenait bon — mais les treize nuits, leurs
// noms et la musique etaient telechargeables par quiconque lisait la liste
// des fichiers, un mois avant l'ouverture. Pour une edition limitee dont
// toute la valeur est la surprise, c'est la surprise qui fuyait.
//
// Deux causes distinctes, et c'est pourquoi il faut les deux verifications :
//   — le MORCEAU JS survivait parce que `lazy(...)` est un appel que Rollup
//     n'ose pas supprimer. Repare par `@__PURE__` (voir App.tsx).
//     Les trois `lazy` s'ecrivent donc `/* @__PURE__ */ lazy(...)`.
//   — le MP3 survivait parce qu'un import `?url` est emis quand le module est
//     LU, avant tout elagage. Repare par un greffon de vite.config.ts.

const { execFileSync } = await import('child_process');
const { existsSync, readdirSync, rmSync } = await import('fs');

const batir = (canal, dossier) => {
  rmSync(dossier, { recursive: true, force: true });
  execFileSync('npx', ['vite', 'build', '--outDir', dossier], {
    env: { ...process.env, VITE_CANAL: canal, BASE_PATH: '/' },
    stdio: 'pipe',
  });
  const a = join(dossier, 'assets');
  return existsSync(a) ? readdirSync(a) : [];
};

const dossierProd = join(tmpdir(), 'sprinter-canal-prod');
const dossierTest = join(tmpdir(), 'sprinter-canal-test');

const fichiersProd = batir('production', dossierProd);
const fichiersTest = batir('test', dossierTest);

const duMode = f => /halloween|molosse/i.test(f);

ok('aucun fichier du mode dans le build public',
   fichiersProd.filter(duMode).length === 0,
   fichiersProd.filter(duMode).join(', '));
ok('le morceau JS du mode n est pas publie',
   !fichiersProd.some(f => /^Halloween-.*\.js$/.test(f)));
ok('la musique du mode n est pas publiee — 708 ko qui partaient pour rien',
   !fichiersProd.some(f => /^molosse-.*\.mp3$/.test(f)));

// L'AUTRE MOITIE, ET ELLE COMPTE AUTANT. Un remede qui retirerait le mode des
// DEUX canaux aurait l'air de marcher et casserait /test en silence.
ok('sur /test, le morceau du mode est bien la',
   fichiersTest.some(f => /^Halloween-.*\.js$/.test(f)),
   fichiersTest.filter(duMode).join(', '));
ok('sur /test, la musique est bien la',
   fichiersTest.some(f => /^molosse-.*\.mp3$/.test(f)));

// L'EDITION LIMITEE NE VAUT QUE PAR LA SURPRISE, et treize noms de courses
// lisibles dans le paquet public un mois avant, c'est l'edition eventee. On
// relit donc le JS publie, pas seulement la liste des fichiers.
titre('LES TREIZE NUITS NE FUITENT PAS DANS LE PAQUET PUBLIC');

const { readFileSync: lireF } = await import('fs');
const texteDe = (dossier, fichiers) => fichiers
  .filter(f => f.endsWith('.js'))
  .map(f => lireF(join(dossier, 'assets', f), 'utf8')).join('\n');

const jsProd = texteDe(dossierProd, fichiersProd);
const jsTest = texteDe(dossierTest, fichiersTest);

// Des noms de nuits qui n'existent nulle part ailleurs dans le jeu.
const SECRETS = ['La ruelle', 'Le caveau', 'La lune rousse', 'Le glas',
                 'La terre remuee', 'La terre remuée',
                 // L'edition datee : son calendrier, ses outils testeurs, et la
                 // route qui donne l'heure. Rien de tout cela n'a a exister
                 // dans le paquet public avant le 19 octobre — et « MODE TEST »
                 // publie serait le plus embarrassant des trois.
                 'LE CALENDRIER', 'VOYAGEUR TEMPOREL', 'MODE TEST',
                 'halloween2026', '/now',
                 // LES TREIZE LIEUX. Ils ne sont encore que dans la table des
                 // cameras, mais ce sont eux la surprise : « Palais des
                 // glaces » lisible en septembre dans le paquet public raconte
                 // la dixieme course a qui sait lire un fichier.
                 'Ruelle du Croissant', 'Parking souterrain', 'Palais des glaces',
                 'Champ de crash', 'Toits de la ville', 'Egouts, tunnel'];
for (const mot of SECRETS) {
  ok(`« ${mot} » absent du paquet public`, !jsProd.includes(mot));
}
ok('mais /test les a bien, sinon on ne verifierait rien',
   SECRETS.some(m => jsTest.includes(m)),
   'aucun nom de nuit dans /test non plus — le test ne prouve rien');

rmSync(dossierProd, { recursive: true, force: true });
rmSync(dossierTest, { recursive: true, force: true });

console.log(e ? `\n${e} echec(s)` : '\nTout passe.');
process.exit(e ? 1 : 0);
