// LES TREIZE CAMERAS — et surtout : celle du jeu revient toujours.
//
// Chaque nuit a son cadrage. Le mode ECRIT dans C.ISO_COS / C.ISO_SIN, qui
// appartiennent a TOUT le jeu et sont lus treize fois par image. Une camera
// laissee en place, c'est le sprint qui se joue a six degres au-dessus de
// l'horizon — et personne ne comprendrait d'ou ca vient.
//
// C'est le genre de defaut qui ne se voit pas la ou on l'a fait : on quitte
// une nuit, on lance un 100 m ordinaire, et c'est le 100 m qui est casse.
//
//   node tools/halloween-camera-test.mjs

import { CAMERAS, FAMILLES, CAMERA_DU_JEU, cameraDe, isoDe, famillesUtilisees }
  from '../src/game/halloween-cameras.js';
import { NUITS } from '../src/game/halloween-loi.js';
import { readFileSync, existsSync } from 'fs';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/* ------------------------------------------------------- la table est complete */

titre('LES TREIZE NUITS ONT CHACUNE LEUR CAMERA');

ok('treize entrees', Object.keys(CAMERAS).length === 13, String(Object.keys(CAMERAS).length));
ok('une par nuit declaree, sans trou',
   NUITS.every(n => !!CAMERAS[n.n]),
   NUITS.filter(n => !CAMERAS[n.n]).map(n => n.n).join(', ') || 'aucun trou');
ok('chacune porte un angle, un zoom et une famille',
   Object.values(CAMERAS).every(c =>
     typeof c.deg === 'number' && typeof c.zoom === 'number' && typeof c.famille === 'string'));
// LES TREIZE LIEUX ONT ETE RETIRES (16/10) : aucune nuit ne les montrait, les
// treize se courent dans la ruelle. Un nom de lieu qui revient dans la table
// sans son decor referait le meme mensonge.
ok('aucune ne pretend un lieu qu elle ne montre pas',
   Object.values(CAMERAS).every(c => !('lieu' in c)));

/* ------------------------------------------------------------ les bornes */

titre('LES VALEURS TIENNENT DANS CE QUI SE REGARDE');

ok('aucun angle sous 4° — au ras du sol, la piste disparait entierement',
   Object.values(CAMERAS).every(c => c.deg >= 4),
   Object.values(CAMERAS).map(c => c.deg).join(' '));
ok('aucun au-dessus de 26,6° — au-dela on remonte vers la vue du sprint',
   Object.values(CAMERAS).every(c => c.deg <= CAMERA_DU_JEU.deg));
ok('toutes descendent SOUS la vue du sprint : c est tout l objet du mode',
   Object.values(CAMERAS).every(c => c.deg < CAMERA_DU_JEU.deg));
ok('aucun zoom sous 1 — on ne s eloigne jamais',
   Object.values(CAMERAS).every(c => c.zoom >= 1));
ok('aucun au-dessus de 3 — au-dela le coureur sort du cadre',
   Object.values(CAMERAS).every(c => c.zoom <= 3));

// J'AVAIS ECRIT ICI « plus l'angle est bas, plus le zoom est fort », ET C'ETAIT
// UNE REGLE SANS FONDEMENT. Le harnais l'a refusee sur la foret — 11° et ×1,9,
// donc plus bas ET moins zoomee que le palais des glaces a 13° et ×2,0.
//
// En cherchant a la defendre, on s'apercoit qu'elle ne repose sur rien : depuis
// que le corps de la bete suit la DIRECTION de la piste sans son raccourci
// (halloween-molosse.js), sa taille a l'ecran ne depend PLUS de l'angle. Elle
// vaut sa longueur en metres fois `scaleM()` fois le zoom, un point c'est tout.
// L'angle ne change que la quantite de SOL qu'on voit — et une foret de
// faisceaux VERTICAUX veut justement du champ vertical, donc moins de zoom.
//
// CE QUI COMPTE VRAIMENT, et qui se mesure : la bete doit rester lisible sans
// manger l'ecran. C'est cela qu'on verifie.
const LONG_BETE = 1.66;           // metres, voir halloween-molosse.js
const PX_PAR_M = 30;              // ligne droite ; 44 en courbe
const UI = 0.97;                  // facteur d'interface a la taille courante
const largeurBete = c => LONG_BETE * PX_PAR_M * UI * c.zoom;

ok('la bete reste au-dessus de 70 pixels partout — en dessous ce n est plus un animal',
   Object.values(CAMERAS).every(c => largeurBete(c) >= 70),
   Object.values(CAMERAS).map(c => Math.round(largeurBete(c))).join(' '));
ok('et sous 140 — au-dela elle mange l ecran et on ne voit plus ou l on court',
   Object.values(CAMERAS).every(c => largeurBete(c) <= 140));
ok('toutes sont plus grandes qu au cadrage du sprint, qui la laissait a 49 px',
   Object.values(CAMERAS).every(c => largeurBete(c) > 49 * 1.4));

/* ---------------------------------------------------------- les familles */

titre('LES FAMILLES — CE QUI DECIDE DU TRAVAIL DANS BLENDER');

ok('chaque nuit pointe une famille qui existe',
   Object.values(CAMERAS).every(c => !!FAMILLES[c.famille]),
   Object.values(CAMERAS).filter(c => !FAMILLES[c.famille]).map(c => c.famille).join(', '));

const f = famillesUtilisees();
ok('quatre familles pour treize nuits', f.length === 4, f.join(', '));
ok('aucune famille declaree et jamais servie',
   Object.keys(FAMILLES).every(k => f.includes(k)),
   Object.keys(FAMILLES).filter(k => !f.includes(k)).join(', ') || 'aucune');

// UNE NUIT NE DOIT PAS S'ECARTER DE SA FAMILLE AU POINT D'EN DEMANDER UNE
// AUTRE. C'est la regle qui permet de partager les pieces : si l'angle d'une
// nuit derive de plus de quatre degres du centre de sa famille, le jeu de
// pieces ne convient plus et il faut le savoir.
for (const [n, c] of Object.entries(CAMERAS)) {
  const centre = FAMILLES[c.famille].deg;
  const d = Math.abs(c.deg - centre);
  if (d > 4) ok(`nuit ${n} reste dans sa famille`, false, `${d}° de ${c.famille}`);
}
ok('aucune nuit ne derive de plus de 4° de sa famille',
   Object.values(CAMERAS).every(c => Math.abs(c.deg - FAMILLES[c.famille].deg) <= 4));

/* --------------------------------------------------------- la projection */

titre('L ANGLE NE DOIT PAS CHANGER L ECHELLE');

// Si la paire (cos, sin) cessait d'etre unitaire, l'angle changerait aussi la
// taille de tout — et un metre de piste ne vaudrait plus scaleM() pixels.
for (const [n, c] of Object.entries(CAMERAS)) {
  const { cos, sin } = isoDe(c.deg);
  const norme = Math.hypot(cos, sin);
  if (Math.abs(norme - 1) > 1e-12) ok(`nuit ${n} : vecteur unitaire`, false, String(norme));
}
ok('les treize donnent un vecteur unitaire',
   Object.values(CAMERAS).every(c => {
     const { cos, sin } = isoDe(c.deg);
     return Math.abs(Math.hypot(cos, sin) - 1) < 1e-12;
   }));

ok('et la camera du jeu se retrouve bien a 2:1',
   (() => {
     const { cos, sin } = isoDe(CAMERA_DU_JEU.deg);
     return Math.abs(cos - 2 / Math.sqrt(5)) < 1e-4 && Math.abs(sin - 1 / Math.sqrt(5)) < 1e-4;
   })(),
   `${isoDe(CAMERA_DU_JEU.deg).cos.toFixed(6)} / ${(2 / Math.sqrt(5)).toFixed(6)}`);

/* --------------------------------------------- aucune serie de decor morte */

titre('CHAQUE SERIE DE DECOR SERT UNE NUIT');

// LA FINALE EN TROIS PHASES A ETE RETIREE (16/10) : `poserLaPhase` n'etait
// appelee par personne, et la serie rendue a 12° pour sa deuxieme phase partait
// dans chaque build — dix megaoctets que personne ne regardait.
//
// L'invariant qui reste : le rendu prend la serie dont l'angle est le plus
// proche de la camera (serieDeLaVue, decors-stades.js). Une serie qu'aucune
// nuit ne choisit est un poids mort dans public/, et il faut le voir ici.
ok('aucune nuit n a de phases sans code pour les jouer',
   Object.values(CAMERAS).every(c => !('phases' in c)));
{
  const man = JSON.parse(readFileSync(new URL('../src/game/decors-manifeste.json', import.meta.url), 'utf8'));
  const series = Object.keys(man.stades).filter(k => /^halloween-a[\d.]+$/.test(k))
    .map(k => parseFloat(k.slice('halloween-a'.length)));
  const choisie = deg => series.reduce((m, a) => Math.abs(a - deg) < Math.abs(m - deg) ? a : m, series[0]);
  const servies = new Set(Object.values(CAMERAS).map(c => choisie(c.deg)));
  const mortes = series.filter(a => !servies.has(a));
  ok('chaque serie halloween-a* du manifeste est choisie par au moins une nuit',
     mortes.length === 0, mortes.map(a => `halloween-a${a}`).join(', '));
  ok('et chaque serie du manifeste a son dossier dans public/',
     series.every(a => existsSync(new URL(`../public/decors/halloween-a${a}`, import.meta.url))));
}

/* ------------------------------------------------------------- le repli */

titre('UNE NUIT INCONNUE REND LA CAMERA DU JEU');

for (const n of [0, 14, 99, -1, null, undefined]) {
  const c = cameraDe(n);
  if (c !== CAMERA_DU_JEU) ok(`nuit ${n} : repli sur la camera du jeu`, false, String(c.deg));
}
ok('zero, quatorze, quatre-vingt-dix-neuf et null replient sur le sprint',
   [0, 14, 99, -1, null, undefined].every(n => cameraDe(n) === CAMERA_DU_JEU));

console.log('\n── LE TABLEAU, POUR LE COUP D OEIL ' + '─'.repeat(25));
for (const n of NUITS) {
  const c = CAMERAS[n.n];
  console.log(`   ${String(n.n).padStart(2)}  ${String(c.deg).padStart(4)}°  ×${c.zoom}  ${c.famille}`);
}

console.log(e ? `\n${e} echec(s)` : '\nTout passe.');
process.exit(e ? 1 : 0);
