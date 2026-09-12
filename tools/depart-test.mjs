// LE DEPART, DANS L'UN ET L'AUTRE CANAL.
//
// Le jeu publie part au DECOMPTE : trois secondes, un bip a chaque seconde
// franchie, un signal au bout. Le canal de test essaie un STARTER : « a vos
// marques », « pret », et un coup de pistolet qui tombe entre trois et dix
// secondes plus tard, sans que rien n'annonce lequel.
//
// Les deux departs vivent dans les memes fonctions, separees par un drapeau
// qui se replie a la compilation (voir DEPART_STARTER dans game/canal.ts).
// C'est exactement ce que ce harnais verifie, et ce qu'aucune relecture ne
// peut promettre : on COMPILE le moteur deux fois, une fois par canal, et on
// ecoute ce que chaque version joue jusqu'au signal.
//
// Le decor est celui d'un navigateur absent : le jeu dessine, mesure et
// stocke, et rien de tout cela n'existe ici. Ce qu'on lui demande — compter,
// et dire ce qu'il entend — n'en a pas besoin.

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { avantDepart, DEPART_MIN_MS, DEPART_MAX_MS } from '../worker/src/depart.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/* ------------------------------------------------------------- le decor */

globalThis.Image = class { set src(v) { this._src = v; } get src() { return this._src; } };
globalThis.window = { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 };
globalThis.document = {
  createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} }, body: { style: {} },
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

/* --------------------------------------------------------- les deux jeux
   Un canal, un paquet. `VITE_CANAL` est remplace par sa valeur litterale a la
   compilation, exactement comme le fait Vite : c'est le vrai mecanisme qu'on
   met a l'epreuve, et non une variable qu'on aurait posee a la main. Les deux
   paquets sont independants — chacun garde son propre `SprinterApp`, referme
   dans sa portee — et peuvent donc courir l'un apres l'autre. */

async function moteurDe(canal) {
  const dossier = mkdtempSync(join(tmpdir(), `sprinter-depart-${canal}-`));
  const entree = join(dossier, 'entree.ts');
  const sortie = join(dossier, 'paquet.mjs');
  writeFileSync(entree, `export * from '${join(process.cwd(), 'src/game/engine.ts')}';`);
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

/**
 * Une course menee jusqu'au signal, en notant tout ce qu'on entend.
 *
 * `attente` remplace, quand elle est donnee, le depart tire par le jeu : c'est
 * ce que fait une salle en direct, qui impose sa date a tout le monde.
 */
function jusquAuSignal(M, attente) {
  const A = M.SprinterApp, G = A.G;
  const entendu = [];
  A.Audio_.sfx = n => entendu.push(n);
  A.Audio_.starter = n => { entendu.push(n); return 0; };
  A.Audio_.music = () => {};

  A.startOneShot(['100'], { levelIdx: 0 });
  if (attente != null) A.poserLeDepart(attente);

  const debut = G.countT;
  const dit = [];
  let pas = 0;
  // Un soixantieme de seconde par tour, comme la boucle du jeu ; le garde-fou
  // est a trente secondes de jeu, bien au-dela du plus long depart possible.
  while (G.state === 'count' && pas < 60 * 30) {
    M.updateLogic(1 / 60);
    dit.push(G.depart ? G.depart.dit : 0);
    pas++;
  }
  return { entendu, debut, dit, etat: G.state, secondes: pas / 60,
           flash: G.flash, longueur: G.depart ? G.depart.duree : null };
}

const compte = (l, quoi) => l.filter(x => x === quoi).length;

/* ---------------------------------------------------------- le jeu publie */

const jeu = await moteurDe('production');

titre('LE JEU PUBLIE : UN DECOMPTE');

const tirages = Array.from({ length: 20 }, () => jeu.SprinterApp.tirerLeDepart());
ok('trois secondes, et les memes a chaque course',
   tirages.every(t => t === 3), `tire ${[...new Set(tirages)].join(', ')}`);

const c = jusquAuSignal(jeu);
ok('le decompte part de zero', Math.abs(c.debut) < 1e-9, `part de ${c.debut}`);
ok('le signal tombe trois secondes plus tard',
   Math.abs(c.secondes - 3) <= 1 / 60 + 1e-9, `${c.secondes.toFixed(3)} s`);
ok('un bip par seconde franchie, jamais sur la premiere',
   compte(c.entendu, 'beep') === 2, `${compte(c.entendu, 'beep')} bips`);
ok('et le signal, une seule fois, au bout',
   compte(c.entendu, 'go') === 1 && c.entendu[c.entendu.length - 1] === 'go',
   c.entendu.join(' '));
ok('le starter ne dit rien : il n\'est pas de cette version',
   !c.entendu.some(x => x === 'marques' || x === 'pret' || x === 'feu'),
   c.entendu.join(' '));
ok('et rien ne part d\'un canon : ni eclair, ni secousse',
   c.flash === 0 && c.dit.every(x => x === 0));
ok('la course commence', c.etat === 'race');

// Une salle qui annonce son depart impose sa date : le decompte part alors de
// plus loin, et compte les secondes en plus comme il compte les siennes.
const salle = jusquAuSignal(jeu, 4);
ok('quatre secondes annoncees par une salle se comptent aussi',
   Math.abs(salle.secondes - 4) <= 1 / 60 + 1e-9, `${salle.secondes.toFixed(3)} s`);
ok('et donnent un bip de plus', compte(salle.entendu, 'beep') === 3,
   `${compte(salle.entendu, 'beep')} bips`);

/* ------------------------------------------------------- le canal de test */

const test = await moteurDe('test');

titre('LE CANAL DE TEST : UN STARTER');

const t20 = Array.from({ length: 200 }, () => test.SprinterApp.tirerLeDepart());
ok('la longueur est tiree entre trois et dix secondes',
   t20.every(t => t >= 3 && t <= 10), `${Math.min(...t20)} a ${Math.max(...t20)}`);
ok('et elle change d\'une course a l\'autre', new Set(t20).size > 150);
ok('le tirage penche vers les departs courts',
   t20.filter(t => t < 5).length > t20.filter(t => t > 7).length);

const s = jusquAuSignal(test);
ok('« a vos marques », puis « pret », puis le coup',
   s.entendu.join(' ') === 'marques pret feu', s.entendu.join(' '));
ok('pas un bip : rien ne doit dire quand le coup va partir',
   compte(s.entendu, 'beep') === 0);
// `dit` est ce que le starter a deja donne, et c'est de lui que le dessin tire
// la position de son bras : le pistolet le long du corps aux marques, leve au
// « pret », le recul au coup.
ok('il passe des marques au pret, puis au coup',
   s.dit[0] === 1 && s.dit.includes(2) && s.dit[s.dit.length - 1] === 3);
ok('le coup fait l\'eclair et la secousse', s.flash > 0);
ok('l\'attente dure ce que le tirage a dit',
   Math.abs(s.secondes - s.longueur) <= 1 / 60 + 1e-9,
   `${s.secondes.toFixed(3)} s pour ${s.longueur.toFixed(3)} tires`);

/* ------------------------------------------------- ce qu'annoncent les salles */

titre('LE DELAI ANNONCE PAR LES SALLES');

ok('en production, la salle garde son delai, connu et fixe',
   avantDepart(false, 4000) === 4000 && avantDepart(false, 6000) === 6000);

const tirs = Array.from({ length: 200 }, () => avantDepart(true, 4000));
ok('sur le canal de test, il est tire entre trois et dix secondes',
   tirs.every(t => t >= DEPART_MIN_MS && t <= DEPART_MAX_MS),
   `${Math.min(...tirs)} a ${Math.max(...tirs)} ms`);
ok('et il change d\'une course a l\'autre', new Set(tirs).size > 150);

console.log(e ? `\n${e} erreur(s)\n` : '\nTout est en ordre.\n');
process.exit(e ? 1 : 0);
