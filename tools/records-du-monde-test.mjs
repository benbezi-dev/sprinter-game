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
console.log('records du monde : OK', Object.entries(R).map(([k, v]) => `${k} ${v}`).join(', '));
