// La piste couverte : l'anneau du moteur boucle, chaque couloir court sa distance.
import '../src/game/sprinter-core.js';
import { COURSES_EN_SALLE, DROITE } from '../src/game/piste-salle.js';
const { Track } = globalThis.SprinterCore;
let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };

ok('ligne droite de 45,34 m', Math.abs(DROITE - 45.34) < 0.01, DROITE);
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
console.log(e ? `\n${e} echec(s)\n` : '\nTout passe.\n');
process.exit(e ? 1 : 0);
