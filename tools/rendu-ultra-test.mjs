// L'ULTRA, verifie sans navigateur.
//
// Ce que ce harnais tient, et qu'une capture d'ecran ne dit pas :
//
//   1. la couche de finition PART de l'ultra, le garde tant que l'appareil
//      tient la cadence pleine, le lache en moins d'une seconde des qu'elle
//      flechit — donc pendant les trois secondes d'un compte a rebours, avant
//      le coup de pistolet — et ne le reprend jamais ;
//   2. la definition suit : la densite native de l'ecran jusqu'a trois pixels
//      par point a l'ultra, deux au plus ailleurs ;
//   3. les corps ont leur quatrieme niveau, deux fois plus fin que le niveau
//      pres, et il COUPE AUX MEMES JOINTS : le poignet, le short et le bandeau
//      tombent exactement la ou ils tombaient ;
//   4. pose() porte au niveau ultra la main et le pied entiers — doigts,
//      tige, semelle —, pas le poing et le sabot des niveaux lointains.
//
//   node tools/rendu-ultra-test.mjs

import { readFileSync } from 'node:fs';
import '../src/game/sprinter-i18n.js';
import '../src/game/coureur-hd.js';
import '../src/game/coureur-vedettes.js';
import '../src/game/coureur-premium.js';
import '../src/game/sprinter-core.js';

const K = globalThis.SprinterCore;
const HD = globalThis.SprinterHD;
const PREM = globalThis.SprinterPremium;

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/* ------------------------------------------------ la couche de finition */

// Une couche neuve par scenario : son etat (palier, ultra perdu, moyenne) est
// interne, et un scenario ne doit pas heriter de celui d'avant.
const SOURCE = readFileSync(new URL('../src/game/rendu-premium.js', import.meta.url), 'utf8');
function couche(densite = 3) {
  globalThis.window = { devicePixelRatio: densite };
  new Function(SOURCE)();
  return globalThis.RenduPremium;
}
/** Fait passer `s` secondes d'images de `ms` millisecondes ; rend le temps
 *  ecoule au moment ou `quand` devient vrai, ou null. */
function images(P, ms, s, quand) {
  let t = 0;
  while (t < s) {
    P.mesurer(ms / 1000); t += ms / 1000;
    if (quand && quand()) return t;
  }
  return null;
}

titre('L ULTRA TIENT A PLEINE CADENCE');
{
  const P = couche();
  ok('on part de l ultra', P.niveau === P.ULTRA, String(P.niveau));
  images(P, 1000 / 60, 10);
  ok('dix secondes a soixante images par seconde : toujours l ultra', P.niveau === P.ULTRA);
  ok('...a trois pixels par point', P.dpr() === 3, String(P.dpr()));
}
{
  // Un ramasse-miettes, un onglet qui revient : une image longue par seconde
  // ne doit rien declencher.
  const P = couche();
  for (let s = 0; s < 10; s++) { images(P, 1000 / 60, 1); P.mesurer(0.05); }
  ok('une image longue par seconde ne le fait pas tomber', P.niveau === P.ULTRA);
}

titre('ET IL SE PERD AVANT LE COUP DE PISTOLET');
{
  // L'accueil tient la cadence ; la course, a huit coureurs, tourne a 40
  // images par seconde. Le compte a rebours dure trois secondes.
  const P = couche();
  images(P, 1000 / 60, 5);
  const t = images(P, 25, 3, () => P.niveau < P.ULTRA);
  ok('a 25 ms l image, l ultra tombe pendant le compte a rebours',
     t !== null && t < 1.5, t === null ? 'jamais' : `${t.toFixed(2)} s`);
  ok('...sur le palier plein, pas plus bas', P.niveau === P.PLEIN, String(P.niveau));
  ok('...et la definition revient a deux pixels par point', P.dpr() === 2, String(P.dpr()));
  // Un ecran a 120 Hz remonterait d'un cran toutes les quatre secondes : il
  // ne doit pas remonter a l'ultra, qu'il vient de ne pas tenir.
  images(P, 1000 / 120, 30);
  ok('trente secondes rapides ensuite : l ultra ne revient pas', P.niveau === P.PLEIN,
     String(P.niveau));
}
{
  const P = couche();
  images(P, 1000 / 60, 3);
  images(P, 30, 0.9);
  ok('a 30 ms l image, l ultra tombe en moins d une seconde', P.niveau === P.PLEIN,
     String(P.niveau));
  images(P, 30, 1.6);
  ok('...puis le plein, une seconde plus tard, comme avant', P.niveau === P.MOYEN,
     String(P.niveau));
}

titre('LA DEFINITION ET LE REGLAGE A LA MAIN');
{
  const P = couche(2.625);
  ok('un ecran a 2,625 pixels par point les a tous a l ultra', P.dpr() === 2.625);
  P.niveau = 2;
  ok('...et deux au palier plein', P.dpr() === 2);
  P.niveau = 9;
  ok('un reglage a la main plafonne a l ultra', P.niveau === P.ULTRA, String(P.niveau));
  ok('...et coupe la mesure', P.auto === false);
  images(P, 40, 5);
  ok('...qui ne le fait donc plus descendre', P.niveau === P.ULTRA);
}
{
  const P = couche(1);
  ok('un ecran a un pixel par point reste a un', P.dpr() === 1);
}

/* ------------------------------------------------------- les corps */

titre('LE QUATRIEME NIVEAU DES CORPS');
ok('les niveaux sont pres, moyen, loin, ultra — l ultra en dernier',
   HD.NIVEAUX.join(',') === 'pres,moyen,loin,ultra', HD.NIVEAUX.join(','));
const corps = { homme: HD.m, femme: HD.f };
for (const [c, v] of Object.entries(HD.vedettes || {})) corps['vedette ' + c] = v;
for (const [nom, pro] of Object.entries(corps)) {
  const faux = Object.keys(pro).filter(ch =>
    !pro[ch][3] || pro[ch][3].length !== 2 * pro[ch][0].length);
  ok(`${nom} : chaque chaine a son ultra, deux fois plus fin que le niveau pres`,
     faux.length === 0, faux.join(', '));
}

titre('L ULTRA COUPE AUX MEMES JOINTS');
// POIGNET (-0,20) et l'ourlet du short (-0,156) : sprinter-core.js. Le bandeau
// de poignet s'arrete a -0,14 au niveau pres.
for (const [nom, pro] of Object.entries(corps)) {
  const ecarts = [['forearm', -0.20], ['forearm', -0.14], ['thigh', -0.156]]
    .map(([ch, h]) => Math.abs(PREM.bord(pro, ch, 3, h) - PREM.bord(pro, ch, 0, h)));
  ok(`${nom} : poignet, bandeau et short tombent au meme endroit`,
     ecarts.every(x => x < 1e-4), ecarts.map(x => (x * 1000).toFixed(2) + ' mm').join(' / '));
}
ok('un corps sans ultra retombe sur son niveau pres',
   PREM.niveauDe({ torso: [[1], [1], [1]] }, 3) === PREM.PRES);
ok('le niveau pres et l ultra sont detailles, les deux autres non',
   PREM.detaille(PREM.PRES) && PREM.detaille(PREM.ULTRA)
   && !PREM.detaille(PREM.MOYEN) && !PREM.detaille(PREM.LOIN));

titre('A L ULTRA, LA MAIN ET LE PIED ENTIERS');
// Les doigts se reconnaissent a leur section ([0,018 ; 0,026], voir mainDe) et
// la tige du talon a sa section du haut ([0,022 ; 0,049], voir chausser).
const pres = (a, b) => Math.abs(a - b) < 1e-9;
const doigts = ps => ps.filter(p => pres(p[4][0], 0.018) && pres(p[4][1], 0.026)).length;
const tiges = ps => ps.filter(p => pres(p[4][2], 0.022) && pres(p[4][3], 0.049)).length;
for (const L of [K.PLAYER_LOOK, K.lookFor('Aurel MANGA', 'divers')]) {
  const r = { look: L, stride: 1.2, v: 11, maxSpeed: 12, fallAnim: 0, celebrate: 0 };
  const [p0, p1, p3] = [0, 1, 3].map(n => K.pose(r, n));
  const qui = L === K.PLAYER_LOOK ? 'le joueur' : 'Aurel Manga';
  ok(`${qui} : plus de volumes a l ultra qu au niveau pres`, p3.length > p0.length,
     `${p0.length} -> ${p3.length}`);
  ok(`${qui} : six doigts a l ultra comme au niveau pres, aucun au niveau moyen`,
     doigts(p3) === 6 && doigts(p0) === 6 && doigts(p1) === 0,
     `${doigts(p0)} / ${doigts(p1)} / ${doigts(p3)}`);
  ok(`${qui} : deux tiges de chaussure a l ultra, comme au niveau pres`,
     tiges(p3) === 2 && tiges(p0) === 2, `${tiges(p0)} / ${tiges(p3)}`);
}

console.log(`\n${'─'.repeat(62)}\n   ${e ? e + ' ECHEC(S).' : 'TOUT PASSE.'}`);
process.exit(e ? 1 : 0);
