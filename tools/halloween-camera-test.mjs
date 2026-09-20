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

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/* ------------------------------------------------------- la table est complete */

titre('LES TREIZE NUITS ONT CHACUNE LEUR CAMERA');

ok('treize entrees', Object.keys(CAMERAS).length === 13, String(Object.keys(CAMERAS).length));
ok('une par nuit declaree, sans trou',
   NUITS.every(n => !!CAMERAS[n.n]),
   NUITS.filter(n => !CAMERAS[n.n]).map(n => n.n).join(', ') || 'aucun trou');
ok('chacune porte un angle, un zoom, une famille et un lieu',
   Object.values(CAMERAS).every(c =>
     typeof c.deg === 'number' && typeof c.zoom === 'number' &&
     typeof c.famille === 'string' && typeof c.lieu === 'string'));

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
  if (d > 4) ok(`nuit ${n} (${c.lieu}) reste dans sa famille`, false, `${d}° de ${c.famille}`);
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

/* ------------------------------------------------------------- la finale */

titre('LA FINALE DESCEND');

const f13 = CAMERAS[13];
ok('la treizieme a trois phases', Array.isArray(f13.phases) && f13.phases.length === 3);
ok('et elle est la SEULE a en avoir',
   Object.entries(CAMERAS).filter(([, c]) => c.phases).length === 1);
ok('chaque phase descend plus bas que la precedente',
   f13.phases.every((p, i) => i === 0 || f13.phases[i - 1].deg > p.deg),
   f13.phases.map(p => p.deg + '°').join(' → '));
ok('et se rapproche a chaque fois',
   f13.phases.every((p, i) => i === 0 || f13.phases[i - 1].zoom < p.zoom),
   f13.phases.map(p => '×' + p.zoom).join(' → '));
// J'AVAIS AUSSI EXIGE QUE LA FINALE SOIT LE CADRAGE LE PLUS BAS DE L'EDITION.
// Le harnais a dit non : le tunnel inonde est a 5°, la finale finit a 6°.
//
// Et le harnais a raison de le dire, parce qu'a y regarder la regle etait
// fausse. Un degre ne se voit pas — c'est la premiere chose que la planche des
// angles a montree. Descendre la finale a 4° pour gagner ce test serait de la
// fausse precision : personne ne verrait la difference avec le tunnel, et on
// aurait grave dans la table un chiffre choisi pour plaire a une assertion.
//
// CE QUI FAIT LA FINALE, C'EST LA DESCENTE, PAS LE PLANCHER. Vingt degres puis
// douze puis six : le monde se referme pendant qu'on court, et c'est la seule
// nuit ou cela arrive. Que le tunnel soit plus confine qu'elle est juste — un
// egout EST plus etroit qu'un cimetiere.
ok('sa derniere phase descend jusqu au plus confine des cadrages',
   f13.phases[2].deg <= FAMILLES.confine.deg,
   `${f13.phases[2].deg}° contre ${FAMILLES.confine.deg}° pour la famille confinee`);
ok('et la descente couvre les trois quarts de l amplitude de l edition',
   (f13.phases[0].deg - f13.phases[2].deg) >=
     0.75 * (Math.max(...Object.values(CAMERAS).map(c => c.deg))
             - Math.min(...Object.values(CAMERAS).map(c => c.deg))),
   `${f13.phases[0].deg - f13.phases[2].deg}° de descente`);
ok('sa premiere phase est bien celle que la table annonce',
   f13.phases[0].deg === f13.deg && f13.phases[0].zoom === f13.zoom);

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
  console.log(`   ${String(n.n).padStart(2)}  ${String(c.deg).padStart(4)}°  ×${c.zoom}  ${c.famille.padEnd(9)} ${c.lieu}`);
}

console.log(e ? `\n${e} echec(s)` : '\nTout passe.');
process.exit(e ? 1 : 0);
