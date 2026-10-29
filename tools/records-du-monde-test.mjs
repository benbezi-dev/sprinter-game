// LES RECORDS DU MONDE COMME PLAFOND (28/10/2026) : un joueur surhumain (vitesse de pointe enorme, aucun freinage)
// ne finit jamais sous le record de son epreuve ; un adversaire tire plus vite y est ramene ; sans record, rien ne change.
import '../src/game/sprinter-core.js';
import assert from 'node:assert/strict';
const K = globalThis.SprinterCore;
const R = K.RECORDS_DU_MONDE;
assert.deepEqual(R, { '60': 6.34, '100': 9.58, '200': 19.19, '400': 43.03, '200s': 19.92, '400s': 44.49 });

function courir(total, record) {
  const j = new K.Runner('TOI', 0, { isPlayer: true, maxSpeed: 40, total, record });
  const dt = 1 / 120;
  for (let t = 0; t < 120 && !j.finished; t += dt) { j.v = 40; j.stepPlayer(dt, t + dt); }
  return j.finishTime;
}
for (const [cle, rec] of Object.entries(R)) {
  const total = { '60': 60, '100': 100, '200': 200, '400': 400, '200s': 200, '400s': 400 }[cle];
  const t = courir(total, rec);
  assert.ok(t >= rec - 1 / 120, `${cle} : ${t} sous le record ${rec}`);
  assert.ok(t < rec + 0.05, `${cle} : ${t}, le plafond freine trop (record ${rec})`);
  const a = new K.Runner('ADV', 1, { target: rec - 2, total, record: rec });
  assert.equal(a.target, rec, `${cle} : l'adversaire garde ${a.target}`);
}
assert.ok(courir(100, null) < 5, 'sans record, pas de plafond');

// L'ALLURE DU JOUEUR (29/10/2026) : la limite du jeu — depart et transition parfaits, cadence sans fin (1000/s) —
// tombe sur le record ; le meilleur joueur reel (8,16 s au 100 m d'avant, ~39 appuis/s) reste au-dessus.
const { COURSES_EN_SALLE } = await import('../src/game/piste-salle.js');
const EP = { ...K.RACES, ...COURSES_EN_SALLE };
function parfait(cle, f) {
  const race = EP[cle], T = new K.Track(race);
  const p = new K.Runner('TOI', 3, { isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: T.total,
    record: R[cle], allure: K.ALLURE_DU_JOUEUR[cle] });
  p.cadenceLancee = true;
  if (T.salle) p.pente = (s, v) => T.accelPente(s, p.lane, v);
  const dt = f > 100 ? 1 / 4000 : 1 / 240; let t = 0, prochain = 0.12, cote = 0;
  while (!p.finished && t < 120) {
    while (t >= prochain) { p.press(cote ? 'R' : 'L', prochain); cote ^= 1; prochain += p.d < 7 ? 1 / (f * 0.7) : 1 / f; }
    p.stepPlayer(dt, t); t += dt;
  }
  return p.finishTime;
}
for (const cle of Object.keys(R)) {
  const t = parfait(cle, 1000);
  assert.ok(t < R[cle] + 0.03, `${cle} : la limite du jeu donne ${t.toFixed(3)}, loin du record ${R[cle]} (recalculer ALLURE_DU_JOUEUR)`);
  if (cle === '60') continue;
  assert.ok(parfait(cle, 39) > R[cle] + 0.1, `${cle} : 39 appuis/s atteignent le record`);
}
// LE 60 M (29/10/2026) : le record tombe a 39 appuis/s, pas avant 37.
assert.ok(parfait('60', 39) < R['60'] + 0.005, `60 : 39 appuis/s donnent ${parfait('60', 39).toFixed(3)}, pas le record`);
assert.ok(parfait('60', 37) > R['60'] + 0.01, '60 : 37 appuis/s atteignent deja le record');
console.log('allure du joueur : OK (100 m : 39/s ' + parfait('100', 39).toFixed(2) + ' s, limite ' + parfait('100', 1000).toFixed(2) + ' s)');
console.log('records du monde : OK', Object.entries(R).map(([k, v]) => `${k} ${v}`).join(', '));
