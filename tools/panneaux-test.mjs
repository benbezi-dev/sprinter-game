// node tools/panneaux-test.mjs
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { panneauxDuMoment, noterVue, bilanPanneau, PLAFOND_VUES_PAR_JOUR as P } from '../worker/src/panneaux.js';

const f = (...a) => panneauxDuMoment(...a).map(p => p.image);

const L = [{ image: 'a', debut: 100, fin: 200 }, { image: 't', debut: 100, fin: 200, test: true }];
assert.deepEqual(f(L, 99, false), []);
assert.deepEqual(f(L, 100, false), ['a']);
assert.deepEqual(f(L, 150, true), ['a', 't']);
assert.deepEqual(f(L, 200, true), []);

// la base imite D1, comme pour les pieces
const s = new DatabaseSync(':memory:');
const db = { prepare: q => { const st = s.prepare(q); const faire = (a = []) => ({
  run: async () => st.run(...a), all: async () => ({ results: st.all(...a) }) });
  return { ...faire(), bind: (...a) => faire(a) }; } };
const J1 = Date.UTC(2026, 11, 1), J2 = Date.UTC(2026, 11, 2);
await noterVue(db, 'm', 'a', J1); await noterVue(db, 'm', 'a', J1);
await noterVue(db, 'm', 'b', J1); await noterVue(db, 'm', 'a', J2);
await noterVue(db, 'autre', 'c', J1);
let b = await bilanPanneau(db, 'm');
assert.equal(b.vues, 4); assert.equal(b.appareils, 2);
assert.deepEqual(b.jours.map(j => [j.jour, j.vues, j.appareils]), [['2026-12-01', 3, 2], ['2026-12-02', 1, 1]]);
for (let i = 0; i < P + 5; i++) await noterVue(db, 'x', 'a', J1);
assert.equal((await bilanPanneau(db, 'x')).vues, P);
assert.equal((await bilanPanneau(db, 'vide')).vues, 0);
console.log('panneaux : ok');
