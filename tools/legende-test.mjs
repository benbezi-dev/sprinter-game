// LA CARRIERE LEGENDE — la regle des 99, le tirage, et le canal.
//
// Trois choses a tenir, et chacune s'est deja vue casser ailleurs dans le jeu :
//
//   1. LE COMPTE. 99 carrieres gagnees jusqu'au bout, toutes epreuves
//      confondues, et rien d'autre ne les compte. Un compte qui deraille sur
//      une valeur pourrie du localStorage ouvrirait la Legende a tout le
//      monde, ou la fermerait a qui l'a meritee.
//   2. LE TIRAGE. Une fois par carriere ; une etape recommencee garde son lieu.
//   3. LE CANAL. La Legende vit sur le canal de test SEULEMENT : en
//      production, LEGENDE_OUVERTE se replie en `false` a la compilation et
//      aucun de ses ecrans ne part dans le paquet. Comme pour les autres
//      harnais de canal (molosse-canal-test.mjs), ce qui compte n'est pas ce
//      que dit la source, mais ce qui ARRIVE dans le paquet du joueur.
//
//   node tools/legende-test.mjs

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const src = f => join(process.cwd(), 'src/game', f);

// Le moteur (game/engine.ts) ne se charge pas sous Node — il attend le
// navigateur et les modules virtuels de Vite. Ce qui l'importe pour l'appeler
// en course (entrees.ts, legende.ts) le recoit donc en doublure ici.
const doublureDuMoteur = {
  name: 'doublure-moteur',
  setup(b) {
    b.onResolve({ filter: /(^|\/)engine$/ }, () => ({ path: 'engine', namespace: 'doublure' }));
    b.onLoad({ filter: /^engine$/, namespace: 'doublure' }, () => ({
      contents: 'export const SprinterApp = { G: {} }; export const SprinterCore = {};', loader: 'js',
    }));
    // ...et les fichiers que Vite sert par leur adresse (`?url`, les corps
    // des boss) : une adresse de banc, telle que Vite la rendrait.
    b.onResolve({ filter: /\?url$/ }, a => ({ path: '/' + a.path.replace(/^@\//, 'src/').replace(/\?url$/, ''), namespace: 'doublure-url' }));
    b.onLoad({ filter: /.*/, namespace: 'doublure-url' }, a => ({ contents: `export default ${JSON.stringify(a.path)};`, loader: 'js' }));
  },
};

async function paquet(nom, lignes, canal = 'test') {
  const dossier = mkdtempSync(join(tmpdir(), `sprinter-legende-${nom}-`));
  const entree = join(dossier, 'entree.ts');
  const sortie = join(dossier, 'paquet.mjs');
  writeFileSync(entree, lignes.join('\n'));
  await build({
    entryPoints: [entree], outfile: sortie, bundle: true, plugins: [doublureDuMoteur],
    format: 'esm', platform: 'node', logLevel: 'silent',
    define: {
      'import.meta.env.VITE_CANAL': JSON.stringify(canal),
      'import.meta.env.BASE_URL': '"/"',
      'import.meta.env.VITE_ENVELOPPE': 'undefined',
    },
  });
  return { M: await import(sortie), texte: readFileSync(sortie, 'utf8') };
}

/* ------------------------------------------------ un localStorage de banc */

const memoire = new Map();
globalThis.localStorage = {
  getItem: k => (memoire.has(k) ? memoire.get(k) : null),
  setItem: (k, v) => { memoire.set(k, String(v)); },
  removeItem: k => { memoire.delete(k); },
  clear: () => memoire.clear(),
};

/* --------------------------------------------------------------- le compte */

titre('LE COMPTE DES CARRIERES GAGNEES');

const { M: C } = await paquet('compte', [`export * from '${src('legende/compte.ts')}';`]);
const CLE = 'sprinter_carrieres_gagnees_v1';

ok('le seuil est 99', C.CARRIERES_REQUISES === 99);
ok('un appareil neuf part de zero', C.carrieresGagnees() === 0 && C.legendeMeritee() === false);

C.compterCarriere('100', 1000);
C.compterCarriere('200', 2000);
C.compterCarriere('100', 3000);
const c = C.lireCompte();
ok('toutes epreuves confondues', c.total === 3, `total=${c.total}`);
ok('et par epreuve', c.par['100'] === 2 && c.par['200'] === 1, JSON.stringify(c.par));
ok('la premiere et la derniere sont datees', c.premiere === 1000 && c.derniere === 3000);

for (let i = 0; i < 95; i++) C.compterCarriere('110h');
ok('a 98 la Legende reste fermee', C.carrieresGagnees() === 98 && !C.legendeMeritee());
C.compterCarriere('400');
ok('a 99 elle s ouvre', C.carrieresGagnees() === 99 && C.legendeMeritee());

titre('UN COMPTE POURRI NE S OUVRE PAS TOUT SEUL');

for (const [nom, brut] of [
  ['du texte', 'n importe quoi'],
  ['un total en chaine', '{"total":"999"}'],
  ['un total negatif', '{"total":-5}'],
  ['un total infini', '{"total":1e999}'],
  ['null', 'null'],
  ['un tableau', '[1,2,3]'],
]) {
  memoire.set(CLE, brut);
  ok(`${nom} vaut zero`, C.carrieresGagnees() === 0 && !C.legendeMeritee(), `lu ${C.carrieresGagnees()}`);
}
memoire.set(CLE, '{"total":12.9,"par":{"100":"3","200":4}}');
const p = C.lireCompte();
ok('un total a virgule est arrondi en dessous', p.total === 12);
ok('une epreuve mal ecrite est ignoree, pas le reste', p.par['100'] === undefined && p.par['200'] === 4,
   JSON.stringify(p.par));

const vraiSet = globalThis.localStorage.setItem;
globalThis.localStorage.setItem = () => { throw new Error('plein'); };
memoire.delete(CLE);
let sansEcrire;
try { sansEcrire = C.compterCarriere('100'); } catch { sansEcrire = null; }
ok('un appareil qui refuse d ecrire ne fait pas tomber la course', sansEcrire && sansEcrire.total === 1);
globalThis.localStorage.setItem = vraiSet;

/* ------------------------------------------------ les carrieres d'avant */

titre('LES CARRIERES D AVANT LE COMPTE : UN MINIMUM, CHERCHE UNE FOIS');

memoire.clear();
const plusRapide = e => ({ '100': 8.75, '200': 17.75, '400': 36.70 })[e] ?? null;
memoire.set('sprinter_web_v1', JSON.stringify({ runs: { '100': [60.1, 61.2, 63.0], '200': [130.5], '400': [] } }));
ok('chaque meilleur parcours garde est une carriere', C.estimerLesCarrieresDAvant(plusRapide) === 4,
   `${C.estimerLesCarrieresDAvant(plusRapide)}`);
const h = [
  { r: '100', t: 8.70, m: 'campaign', l: 5 },   // sous le plus rapide des ZEZE : gagnee
  { r: '100', t: 8.70, m: 'campaign', l: 5 },
  { r: '100', t: 8.70, m: 'campaign', l: 5 },
  { r: '200', t: 17.70, m: 'campaign', l: 5 },
  { r: '100', t: 8.70, m: 'campaign', l: 5 },
  { r: '100', t: 8.80, m: 'campaign', l: 5 },   // dans la fourchette : on ne sait pas
  { r: '100', t: 8.50, m: 'oneshot', l: 5 },    // pas une carriere
  { r: '100', t: 8.50, m: 'campaign', l: 4 },   // pas la sixieme etape
  { r: '110h', t: 12.0, m: 'campaign', l: 5 },  // epreuve sans fourchette connue
];
memoire.set('sprinter_history', JSON.stringify(h));
ok('la plus haute des deux traces, pas leur somme (elles se recouvrent)',
   C.estimerLesCarrieresDAvant(plusRapide) === 5, `${C.estimerLesCarrieresDAvant(plusRapide)}`);
ok('une sauvegarde illisible ne casse rien', (() => {
  memoire.set('sprinter_web_v1', '{pas du json'); const n = C.estimerLesCarrieresDAvant(plusRapide);
  memoire.set('sprinter_web_v1', JSON.stringify({ runs: { '100': [60.1, 61.2, 63.0], '200': [130.5] } }));
  return n === 5;
})());
ok('avant la recherche, rien n est retrouve', C.lireCompte().avant === null && C.carrieresGagnees() === 0);
C.compterCarriere('100', 5000);
ok('une carriere comptee avant la recherche...', C.carrieresGagnees() === 1);
ok('...est retiree de ce qu on retrouve (pas de double compte)', C.poserLesCarrieresDAvant(plusRapide) === 4);
ok('le total = comptees + retrouvees', C.carrieresGagnees() === 5 && C.lireCompte().avant === 4);
ok('on ne cherche qu une fois', C.poserLesCarrieresDAvant(plusRapide) === 0 && C.carrieresGagnees() === 5);
C.compterCarriere('200', 6000);
ok('les suivantes s ajoutent, les retrouvees restent', C.carrieresGagnees() === 6 && C.lireCompte().avant === 4);
memoire.set(CLE, JSON.stringify({ total: 3, par: { '100': 3 }, premiere: 1, derniere: 2, avant: 97 }));
ok('97 retrouvees + 3 comptees : la Legende est ouverte', C.carrieresGagnees() === 100 && C.legendeMeritee());
memoire.clear();

/* -------------------------------------------------------------- le tirage */

titre('LE TIRAGE, UNE FOIS PAR CARRIERE');

const { M: T } = await paquet('tirage', [
  `export * from '${src('legende/tirage.ts')}';`,
  `export { ETAPES, DEPART } from '${src('legende/etapes.ts')}';`,
]);

ok('six etapes', T.ETAPES.length === 6);
ok('les transports de la consigne',
   T.ETAPES.map(x => x.transport).join(',') === 'velo,voiture,car,avion,fusee,fusee',
   T.ETAPES.map(x => x.transport).join(','));
ok('le regional se tire entre Kyoto, Kingston, Izmir',
   T.ETAPES[1].lieux.map(l => l.cle).join(',') === 'kyoto,kingston,izmir');
ok('le national se tire entre Espagne, Maroc, Nigeria',
   T.ETAPES[2].lieux.map(l => l.drapeau).join(',') === 'es,ma,ng');
ok('le mondial entre Paris, New York, Londres',
   T.ETAPES[3].lieux.map(l => l.cle).join(',') === 'paris,newyork,londres');
ok('chaque lieu a son boss et six autres couloirs',
   T.ETAPES.every(x => x.lieux.every(l => l.boss && l.plateau.length === 6)));
ok('la piste du national est celle du jeu de base (theme day)',
   T.ETAPES[2].lieux.every(l => l.theme === 'day'));
ok('la piste du mondial est bleue (theme mondiaux)',
   T.ETAPES[3].lieux.every(l => l.theme === 'mondiaux'));
ok('la premiere etape est a San-Pedro', T.ETAPES[0].lieux[0].pays.startsWith('San-Pédro'));

const vus = new Set();
for (let i = 0; i < 3000; i++) {
  const t = T.tirer();
  vus.add(`${t[1]}-${t[2]}-${t[3]}`);
  if (t.some((v, k) => v < 0 || v >= T.ETAPES[k].lieux.length)) { ok('un tirage hors des lieux', false, t.join(',')); break; }
}
ok('les 27 combinaisons regional x national x mondial sortent', vus.size === 27, `${vus.size} vues`);
ok('un alea a 0,9999 reste dans les lieux', T.tirer(() => 0.99999).every((v, k) => v < T.ETAPES[k].lieux.length));
ok('un alea a 1 aussi (Math.random ne le rend jamais, un autre si)',
   T.tirer(() => 1).every((v, k) => v < T.ETAPES[k].lieux.length));
const t0 = T.tirer(() => 0.5);
ok('un lieu se relit tel que tire', T.lieuDe(t0, 1).cle === 'kingston' && T.lieuDe(t0, 2).cle === 'casablanca'
   && T.lieuDe(t0, 3).cle === 'newyork', `${T.lieuDe(t0, 1).cle} ${T.lieuDe(t0, 2).cle} ${T.lieuDe(t0, 3).cle}`);

/* -------------------------------------------------------------- les stades */

titre('LES STADES : LE BOSS EST LE PLUS RAPIDE, A COTE DU JOUEUR');

const { M: S } = await paquet('stades', [
  `export { stadeDe, DIFFICULTE } from '${src('legende/stades.ts')}';`,
  `export { ETAPES } from '${src('legende/etapes.ts')}';`,
]);
ok('une difficulte par etape', S.DIFFICULTE.length === 6);
ok('l echelle monte : chaque boss plus rapide que le precedent',
   S.DIFFICULTE.every((d, i) => i === 0 || d.boss < S.DIFFICULTE[i - 1].boss));
ok('le boss court sous le plateau de son etape',
   S.DIFFICULTE.every(d => d.boss < d.plateau[0] && d.plateau[0] < d.plateau[1]));
const tous = S.ETAPES.flatMap((e, rang) => e.lieux.map(l => ({ l, rang, s: S.stadeDe(l, rang) })));
ok('douze lieux', tous.length === 12, `${tous.length}`);
ok('le boss est 4e de la liste : couloir 5, a droite du joueur (couloir 4)',
   tous.every(({ l, s }) => s.names[3] === l.boss && s.names.length === 7));
ok('son chrono est fixe (cibles) et vaut celui de l etape',
   tous.every(({ l, s, rang }) => s.cibles['100'][l.boss] === S.DIFFICULTE[rang].boss));
ok('aucun stade de la Legende n est ouvert au public ni choisissable',
   tous.every(({ s }) => s.ouvert === false && s.reserve === true && s.legende === true && s.horsSerie === true));
ok('les clefs des stades sont uniques', new Set(tous.map(({ s }) => s.cle)).size === tous.length);

/* ------------------------------------------------- les entrees des boss */

titre('CHAQUE BOSS A SON ENTREE, SA PRESENTATION ET SA REPLIQUE');

const { M: En } = await paquet('entrees', [
  `export { ENTREES, dureeDeLEntree } from '${src('legende/entrees.ts')}';`,
  `export { ETAPES } from '${src('legende/etapes.ts')}';`,
]);
const lieux = En.ETAPES.flatMap(e => e.lieux);
ok('douze entrees, une par boss', En.ENTREES.length === 12 && new Set(lieux.map(l => l.entree)).size === 12,
   En.ENTREES.join(','));
ok('chaque boss joue une entree qui existe', lieux.every(l => En.ENTREES.includes(l.entree)),
   lieux.filter(l => !En.ENTREES.includes(l.entree)).map(l => l.boss).join(','));
ok('aucune entree ne retient le decompte plus de 8 s', En.ENTREES.every(c => En.dureeDeLEntree(c) > 3 && En.dureeDeLEntree(c) <= 8));
ok('chaque boss a sa bio en francais et en anglais', lieux.every(l => l.bio[0].length > 20 && l.bio[1].length > 20));
ok('chaque replique tient dans la bulle (2 lignes, ~32 caracteres)',
   lieux.every(l => (l.replique.vo || l.replique.fr).length <= 32 && (l.replique.vo || l.replique.en).length <= 32),
   lieux.filter(l => (l.replique.vo || l.replique.fr).length > 32).map(l => l.boss).join(','));
ok('une replique en langue etrangere a sa traduction', lieux.every(l => !l.replique.vo || (l.replique.fr && l.replique.en)));

/* -------------------------------------------------------------- le canal */

titre('LE CANAL : LA LEGENDE NE PART PAS EN PRODUCTION');

const canal = async c => paquet(`canal-${c}`, [`export { LEGENDE_OUVERTE, EST_TEST } from '${src('canal.ts')}';`], c);
const ct = await canal('test');
const cp = await canal('production');
ok('sur /test, la Legende est ouverte', ct.M.LEGENDE_OUVERTE === true);
ok('en production, elle est fermee a la compilation', cp.M.LEGENDE_OUVERTE === false);

console.log(e ? `\n${e} ECHEC(S)\n` : '\nTOUT PASSE\n');
process.exit(e ? 1 : 0);
