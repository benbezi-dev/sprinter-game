// La piste couverte : l'anneau du moteur boucle, chaque couloir court sa distance.
import '../src/game/sprinter-core.js';
import { COURSES_EN_SALLE, DROITE, SALLE } from '../src/game/piste-salle.js';
const { Track } = globalThis.SprinterCore;
let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };

ok('ligne droite de 35 m', Math.abs(DROITE - 35) < 1e-9, DROITE);
// (les virages allonges : 65 m au couloir 1, a sa ligne de mesure ; l'auteur, 26/10)
ok('virage de 65 m au couloir 1', Math.abs(SALLE.longueurVirage(SALLE.mes1) - 65) < 0.01, SALLE.longueurVirage(SALLE.mes1));
ok('60 m sur 8 couloirs', COURSES_EN_SALLE['60'].couloirs === 8 && new Track(COURSES_EN_SALLE['60']).lanes === 8);
for (const cle of ['200s', '400s']) {
  const T = new Track(COURSES_EN_SALLE[cle]);
  ok(`${cle} : total ${T.total} m`, T.total === (cle === '200s' ? 200 : 400));
  for (let lane = 0; lane < 6; lane++) {
    // la trajectoire est continue et mesure exactement `total` dans chaque couloir
    let p = T.pos(0, lane), long = 0, saut = 0;
    for (let s = 0.01; s <= T.total + 1e-9; s += 0.01) { const q = T.pos(s, lane); const d = Math.hypot(q[0] - p[0], q[1] - p[1]); long += d; saut = Math.max(saut, d); p = q; }
    ok(`${cle} couloir ${lane + 1} : ${long.toFixed(2)} m, continu`, Math.abs(long - T.total) < 0.05 && saut < 0.011, `saut ${saut}`);
    const fin = T.pos(T.total, lane);
    ok(`${cle} couloir ${lane + 1} : arrivee sur la ligne (x=0, sous la corde)`, Math.abs(fin[0]) < 1e-6 && fin[1] < 0);
  }
  ok(`${cle} : cap pi au depart du couloir 1, -pi a l'arrivee du dernier tour`, Math.abs(T.heading(0, 0) - Math.PI) < 1e-9 && Math.abs(T.heading(T.total, 0) - (Math.PI - 2 * Math.PI * (cle === '200s' ? 1 : 2))) < 1e-9);
  const dec = T.bend1(T.radius(0)) - T.bend1(T.radius(5));
  console.log(`      decalage couloir 6 : ${dec.toFixed(2)} m`);
}
// LE 400 M SE RABAT (27/10) : en couloirs jusqu'a la sortie du second virage, puis tous a la corde
{
  const T = new Track(COURSES_EN_SALLE['400s']);
  const R1 = T.radius(0), avant5 = SALLE.rabattement(T.radius(5) - SALLE.rayon, 400).avant;
  // (la ligne droite d'arrivee du moteur : y = -r, x de DROITE a 0)
  const surLaDroite = (p) => (p[0] >= 0 && p[0] <= DROITE + 1e-6 ? Math.abs(p[1]) : NaN);
  ok(`400s couloir 6 : dans son couloir a la ligne de rabattement (${avant5.toFixed(1)} m)`, Math.abs(surLaDroite(T.pos(avant5 + 0.01, 5)) - T.radius(5)) < 0.02);
  let ecart = 0;
  for (let s = 220; s <= 399; s += 7) for (let k = 1; k < 6; k++) { const a = T.pos(s, k), b = T.pos(s, 0); ecart = Math.max(ecart, Math.hypot(a[0] - b[0], a[1] - b[1])); }
  ok('400s : apres la ligne droite de rabattement, tous les couloirs courent a la corde', ecart < 1e-6, ecart);
  ok('400s couloir 1 : la ligne de rabattement a la sortie du second virage (165 m)', Math.abs(SALLE.rabattement(SALLE.mes1, 400).avant - 165) < 0.01);
}
// LA PENTE DANS LE CHRONO (27/10) : a dix appuis par seconde, le joueur perd en salle 3,5 % au 200 m (l'ecart
// des records du monde), 1,8 % au 400 m, a 0,1 s pres ; et le rythme compte : huit appuis y perdent plus que treize
{
  const { Runner, RACES } = globalThis.SprinterCore;
  const chrono = (race, salle, cadence = 10) => {
    let tot = 0;
    for (let k = 0; k < 5; k++) {
      const r = new Runner('TOI', 3, { isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: salle ? race.total : (race.fullLap ? 2 : 1) * (race.arc + race.straight) });
      const T = new Track(race); if (T.salle) r.pente = (q) => T.accelPente(q, 3);
      let t = 0, suivant = 0, g = 0;
      while (!r.finished && t < 90) { if (t >= suivant) { r.press(g++ % 2 ? 'R' : 'L', t); suivant += 1 / cadence; } r.stepPlayer(1 / 60, t); t += 1 / 60; }
      tot += r.finishTime;
    }
    return tot / 5;
  };
  for (const [dehors, dedans, k] of [['200', '200s', 1.035], ['400', '400s', 1.018]]) {
    const a = chrono(RACES[dehors], false), b = chrono(COURSES_EN_SALLE[dedans], true);
    ok(`${dedans} a dix appuis : ${b.toFixed(2)} s (plein air ${a.toFixed(2)} s x ${k} = ${(a * k).toFixed(2)})`, Math.abs(b - a * k) < 0.1);
  }
  const perte = (c) => chrono(COURSES_EN_SALLE['200s'], true, c) / chrono(RACES['200'], false, c);
  const p8 = perte(8), p13 = perte(13);
  ok(`200s : le rythme compte dans les virages (perte ${((p8 - 1) * 100).toFixed(1)} % a huit appuis, ${((p13 - 1) * 100).toFixed(1)} % a treize)`, p8 > p13 + 0.015);
}
// LES ACCROCHAGES DU 400 M (27/10) : au second tour, deux coureurs colles se touchent ; ecartes en travers, non
{
  const T = new Track(COURSES_EN_SALLE['400s']);
  ok('400s : contact entre deux coureurs colles au second tour', T.auContact({ d: 300, lane: 0 }, { d: 300.4, lane: 3 }));
  ok('400s : pas de contact a un metre en travers', !T.auContact({ d: 300, lane: 0 }, { d: 300, lane: 2 }));
  ok('400s : pas de contact dans les couloirs du premier tour', !T.auContact({ d: 100, lane: 0 }, { d: 100.2, lane: 1 }));
  ok('200s : jamais de contact', !new Track(COURSES_EN_SALLE['200s']).auContact({ d: 150, lane: 0 }, { d: 150, lane: 1 }));
}
console.log(e ? `\n${e} echec(s)\n` : '\nTout passe.\n');
process.exit(e ? 1 : 0);
