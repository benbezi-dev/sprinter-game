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
// LA PENTE ET LE VIRAGE SERRE DANS LE CHRONO (27/10) : plus dur qu'en plein air ; le couloir 1 (virage serre)
// le plus lent, le couloir 6 (plus de montee et de descente) le plus rapide ; le rythme y compte
{
  const { Runner, RACES } = globalThis.SprinterCore;
  const chrono = (race, salle, lane = 3, cadence = 10) => {
    let tot = 0, vmax = 0;
    for (let k = 0; k < 4; k++) {
      const T = new Track(race), r = new Runner('TOI', lane, { isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: T.total });
      if (salle) r.pente = (q, v) => T.accelPente(q, lane, v);
      let t = 0, suivant = 0, g = 0;
      while (!r.finished && t < 90) { if (t >= suivant) { r.press(g++ % 2 ? 'R' : 'L', t); suivant += 1 / cadence; } r.stepPlayer(1 / 60, t); vmax = Math.max(vmax, r.v); t += 1 / 60; }
      tot += r.finishTime;
    }
    return { t: tot / 4, vmax };
  };
  const pct = (a, b) => ((b / a - 1) * 100).toFixed(1) + ' %';
  const dehors = chrono(RACES['200'], false).t;
  const [c1, c4, c6] = [0, 3, 5].map(k => chrono(COURSES_EN_SALLE['200s'], true, k).t);
  ok(`200s a dix appuis, plus dur qu'en plein air : couloir 4 ${pct(dehors, c4)}`, c4 > dehors * 1.03 && c4 < dehors * 1.06);
  ok(`200s : couloir 1 (${pct(dehors, c1)}) plus lent que le 4, le 6 (${pct(dehors, c6)}) plus rapide`, c1 > c4 && c6 < c4 - 0.2);
  const d8 = chrono(RACES['200'], false, 3, 8).t, d13 = chrono(RACES['200'], false, 3, 13).t;
  const s8 = chrono(COURSES_EN_SALLE['200s'], true, 3, 8).t, s13 = chrono(COURSES_EN_SALLE['200s'], true, 3, 13).t;
  ok(`200s : le rythme compte (couloir 4 : ${pct(d8, s8)} a huit appuis, ${pct(d13, s13)} a treize)`, s8 / d8 > s13 / d13 + 0.04);
  const v6 = chrono(COURSES_EN_SALLE['200s'], true, 5, 13).vmax;
  ok(`200s : a treize appuis, la descente porte le couloir 6 au-dela de la pointe (${v6.toFixed(1)} m/s > ${COURSES_EN_SALLE['200s'].maxSpeed})`, v6 > COURSES_EN_SALLE['200s'].maxSpeed + 0.5);
  const d400 = chrono(RACES['400'], false).t, s400 = chrono(COURSES_EN_SALLE['400s'], true).t;
  ok(`400s a dix appuis, plus dur qu'en plein air : ${pct(d400, s400)}`, s400 > d400 * 1.015);
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
