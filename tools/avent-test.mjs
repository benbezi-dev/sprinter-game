// LE CALENDRIER DE L'AVENT, eprouve sans navigateur.
//
//   node tools/avent-test.mjs
//
// 1. LES DATES : chaque case s'ouvre le n decembre 2026 a 22 h, heure de Paris
//    (21 h UTC), et le double verrou date + victoire tient.
// 2. L'ECHELLE : chaque chrono a battre est tenu par le VRAI moteur (sprinter-core.js)
//    a la cadence annoncee, et ne l'est pas un appui par seconde plus bas — sinon la
//    case ne demande rien. L'automate tape parfaitement alterne ; un vrai doigt fait
//    moins bien, et c'est la cadence MINIMALE qu'on mesure.

import '../src/game/sprinter-core.js';
import { NB_CASES, ouvertureDe, casesParLaDate, casesJouables, blocageDe } from '../src/game/avent-calendrier.ts';

const { RACES, Track, Runner } = globalThis.SprinterCore;
let fautes = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) fautes++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 56 - t.length))}`);

titre('LES DATES');
ok('24 cases', NB_CASES === 24);
ok('case 1 : 1er decembre 2026, 21 h UTC', ouvertureDe(1) === Date.UTC(2026, 11, 1, 21));
ok('case 24 : 24 decembre 2026, 21 h UTC', ouvertureDe(24) === Date.UTC(2026, 11, 24, 21));
ok('rien avant le 1er decembre a 22 h', casesParLaDate(Date.UTC(2026, 11, 1, 20, 59)) === 0);
ok('le 5 decembre a 22 h 01 : cinq cases', casesParLaDate(Date.UTC(2026, 11, 5, 21, 1)) === 5);
ok('le 5 a 21 h 59 (Paris) : quatre', casesParLaDate(Date.UTC(2026, 11, 5, 20, 59)) === 4);
const le10 = Date.UTC(2026, 11, 10, 22);
ok('double verrou : trois gagnees le 10 -> la case 4', casesJouables(3, le10) === 4);
ok('double verrou : tout gagne le 10 -> la case 10', casesJouables(24, le10) === 10);
ok('blocage par la victoire', blocageDe(6, 3, le10) === 'victoire');
ok('blocage par la date', blocageDe(11, 24, le10) === 'date');
ok('case perdue rejouable', blocageDe(4, 3, le10) === 'ouverte');

// Les chronos (game/avent.ts) : on relit la table dans le source, sans charger le
// module (il importe le moteur et le navigateur).
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/game/avent.ts', import.meta.url), 'utf8');
const CASES = [...src.matchAll(/\{ n: (\d+), epreuve: '(\d+)', imparti: ([\d.]+) \}/g)]
  .map(m => ({ n: +m[1], epreuve: m[2], imparti: +m[3] }));

function courir(epreuve, cadence) {
  const race = RACES[epreuve]; const track = new Track(race);
  const r = new Runner('TOI', 3, { isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total });
  const dt = 1 / 240; let t = 0, prochain = 0, cote = 0;
  while (t < 120 && !r.finished) {
    if (t >= prochain) { r.press(cote ? 'left' : 'right', t); cote ^= 1; prochain += 1 / cadence; }
    t += dt; r.stepPlayer(dt, t);
  }
  return r.finished ? (r.finishTime ?? t) : Infinity;
}
/** La plus basse cadence (au quart d'appui) qui tient le chrono. */
function cadenceMinimale(epreuve, imparti) {
  for (let c = 5; c <= 16; c += 0.25) if (courir(epreuve, c) <= imparti) return c;
  return Infinity;
}

titre("L'ECHELLE");
ok('vingt-quatre cases lues dans avent.ts', CASES.length === 24, `${CASES.length}`);
let precedente = 0;
for (const c of CASES) {
  const cad = cadenceMinimale(c.epreuve, c.imparti);
  const tenable = Number.isFinite(cad) && cad <= 13;
  console.log(`   case ${String(c.n).padStart(2)}  ${c.epreuve.padStart(3)} m  ${c.imparti.toFixed(2)} s  -> ${cad} appuis/s`);
  if (!tenable) ok(`case ${c.n} tenable a 13 appuis/s ou moins`, false, `${cad}`);
  precedente = Math.max(precedente, cad);
}
const c1 = cadenceMinimale(CASES[0].epreuve, CASES[0].imparti);
const c24 = cadenceMinimale(CASES[23].epreuve, CASES[23].imparti);
ok('la case 1 est la plus douce (8 appuis/s au plus)', c1 <= 8, `${c1}`);
ok('la case 24 demande plus que la case 1', c24 > c1, `${c1} -> ${c24}`);

console.log(fautes ? `\n  ${fautes} ECHEC(S)\n` : '\n  tout est vert\n');
process.exit(fautes ? 1 : 0);
