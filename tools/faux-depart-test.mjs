// Les regles du faux depart en championnat, sans rien monter.
//
//   node tools/faux-depart-test.mjs

import { jugerSignalement, jugerPosition, classerLaCourse, TOLERANCE_RECEPTION_MS }
  from '../worker/src/faux-depart.js';
import { qualifier } from '../worker/src/championnats-moteur.js';

let echecs = 0, n = 0;
const ok = (nom, cond, detail) => {
  n++;
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || detail == null ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

const D = 1_000_000;

console.log('\n── le signalement du telephone');
ok('parti 120 ms avant le coup : faux', jugerSignalement({ departA: D, recuA: D - 50, ms: -120 }).faux);
ok('l instant est garde', jugerSignalement({ departA: D, recuA: D - 50, ms: -120.4 }).ms === -120);
ok('parti pile au coup : pas faux (seuil au pistolet)', !jugerSignalement({ departA: D, recuA: D + 80, ms: 0 }).faux);
ok('parti a +40 ms : pas faux (la regle des 100 ms n est pas retenue)',
   !jugerSignalement({ departA: D, recuA: D + 90, ms: 40 }).faux);
ok('arrive une latence apres le coup : compte encore',
   jugerSignalement({ departA: D, recuA: D + 400, ms: -30 }).faux);
ok('arrive trop tard : ignore',
   !jugerSignalement({ departA: D, recuA: D + TOLERANCE_RECEPTION_MS + 1, ms: -30 }).faux);
ok('sans depart annonce : ignore', !jugerSignalement({ departA: null, recuA: D, ms: -30 }).faux);
ok('instant illisible : ignore', !jugerSignalement({ departA: D, recuA: D, ms: 'x' }).faux);
ok('11 s avant : pas credible', !jugerSignalement({ departA: D, recuA: D - 11000, ms: -11000 }).faux);

console.log('\n── le controle dur');
ok('3 m, 1 s avant le coup : faux', jugerPosition({ departA: D, recuA: D - 1000, d: 3 }).faux);
ok('3 m, 200 ms avant : marge d horloge, pas faux', !jugerPosition({ departA: D, recuA: D - 200, d: 3 }).faux);
ok('1 m, 1 s avant : sous le seuil de distance', !jugerPosition({ departA: D, recuA: D - 1000, d: 1 }).faux);
ok('apres le coup : jamais', !jugerPosition({ departA: D, recuA: D + 10, d: 30 }).faux);

console.log('\n── l ordre d une course courue en direct');
const cl = classerLaCourse([
  { cle: 'a', nom: 'A', couloir: 1, fin: 10200, motif: null },
  { cle: 'b', nom: 'B', couloir: 2, fin: null, motif: 'forfait' },
  { cle: 'c', nom: 'C', couloir: 3, fin: 10100, motif: null },
  { cle: 'd', nom: 'D', couloir: 4, fin: null, motif: 'faux_depart', motif_ms: -80 },
  { cle: 'e', nom: 'E', couloir: 5, fin: 10100, motif: null },
  { cle: 'f', nom: 'F', couloir: 6, fin: null, motif: 'abandon' },
]);
ok('arrives au chrono, egalite partagee',
   cl.slice(0, 3).map(l => `${l.place}${l.cle}`).join() === '1c,1e,3a', cl.slice(0, 3).map(l => l.place + l.cle).join());
ok('puis abandon, faux depart, forfait', cl.slice(3).map(l => l.motif).join() === 'abandon,faux_depart,forfait');
ok('pas de place pour un carton rouge', cl.find(l => l.cle === 'd').place === null);
ok('l instant du carton voyage', cl.find(l => l.cle === 'd').motif_ms === -80);

console.log('\n── la qualification ne prend pas un chrono absent');
const course = (lignes) => lignes.map(([cle, ms]) => ({ cle, ms, rang: 1 }));
const q = qualifier([
  course([['x1', 10000], ['x2', null], ['x3', null]]),          // un seul arrive
  course([['y1', 10100], ['y2', 10200], ['y3', 10300]]),
], { directsParCourse: 2, repechages: 1 });
const directs = q.directs.map(r => r.cle).sort().join();
ok('un seul direct dans la course a un arrivant', directs === 'x1,y1,y2', directs);
ok('le repechage garde sa place', q.repeches.map(r => r.cle).join() === 'y3', q.repeches.map(r => r.cle).join());
ok('les sans-chrono sont elimines', ['x2', 'x3'].every(c => q.elimines.some(r => r.cle === c)));

console.log(`\n${echecs ? '✗' : '✓'} ${n - echecs}/${n}`);
process.exit(echecs ? 1 : 0);
