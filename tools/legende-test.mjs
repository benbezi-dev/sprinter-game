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

async function paquet(nom, lignes, canal = 'test') {
  const dossier = mkdtempSync(join(tmpdir(), `sprinter-legende-${nom}-`));
  const entree = join(dossier, 'entree.ts');
  const sortie = join(dossier, 'paquet.mjs');
  writeFileSync(entree, lignes.join('\n'));
  await build({
    entryPoints: [entree], outfile: sortie, bundle: true,
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
for (let i = 0; i < 400; i++) {
  const t = T.tirer();
  vus.add(`${t[2]}-${t[3]}`);
  if (t.some((v, k) => v < 0 || v >= T.ETAPES[k].lieux.length)) { ok('un tirage hors des lieux', false, t.join(',')); break; }
}
ok('les neuf couples national x mondial sortent', vus.size === 9, `${vus.size} vus`);
ok('un alea a 0,9999 reste dans les lieux', T.tirer(() => 0.99999).every((v, k) => v < T.ETAPES[k].lieux.length));
ok('un alea a 1 aussi (Math.random ne le rend jamais, un autre si)',
   T.tirer(() => 1).every((v, k) => v < T.ETAPES[k].lieux.length));
const t0 = T.tirer(() => 0.5);
ok('un lieu se relit tel que tire', T.lieuDe(t0, 2).cle === 'casablanca' && T.lieuDe(t0, 3).cle === 'newyork',
   `${T.lieuDe(t0, 2).cle} ${T.lieuDe(t0, 3).cle}`);

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
ok('dix lieux', tous.length === 10, `${tous.length}`);
ok('le boss est 4e de la liste : couloir 5, a droite du joueur (couloir 4)',
   tous.every(({ l, s }) => s.names[3] === l.boss && s.names.length === 7));
ok('son chrono est fixe (cibles) et vaut celui de l etape',
   tous.every(({ l, s, rang }) => s.cibles['100'][l.boss] === S.DIFFICULTE[rang].boss));
ok('aucun stade de la Legende n est ouvert au public ni choisissable',
   tous.every(({ s }) => s.ouvert === false && s.reserve === true && s.legende === true && s.horsSerie === true));
ok('les clefs des stades sont uniques', new Set(tous.map(({ s }) => s.cle)).size === tous.length);

/* -------------------------------------------------------------- le canal */

titre('LE CANAL : LA LEGENDE NE PART PAS EN PRODUCTION');

const canal = async c => paquet(`canal-${c}`, [`export { LEGENDE_OUVERTE, EST_TEST } from '${src('canal.ts')}';`], c);
const ct = await canal('test');
const cp = await canal('production');
ok('sur /test, la Legende est ouverte', ct.M.LEGENDE_OUVERTE === true);
ok('en production, elle est fermee a la compilation', cp.M.LEGENDE_OUVERTE === false);

console.log(e ? `\n${e} ECHEC(S)\n` : '\nTOUT PASSE\n');
process.exit(e ? 1 : 0);
