// auto-test de etapeHalloweenPlausible sur une fausse base en memoire
import { etapeHalloweenPlausible, ouvertureDeLaNuit } from '../worker/src/tunnel.js';
import assert from 'node:assert';
const lignes = new Map();
const db = { prepare: sql => ({ bind: (...v) => ({
  run: async () => { if (/INSERT OR IGNORE INTO tunnel/.test(sql)) { const k=v[0]+'|'+v[1]; if(!lignes.has(k)) lignes.set(k,v[2]); } return {}; },
  first: async () => { const k=v[0]+'|'+v[1]; return lignes.has(k) ? { premier_at: lignes.get(k) } : null; },
  all: async () => ({ results: [] }) }), run: async () => ({}) }) };
assert.equal(new Date(ouvertureDeLaNuit(1)).toISOString(), '2026-10-19T20:00:00.000Z');
assert.equal(new Date(ouvertureDeLaNuit(6)).toISOString(), '2026-10-24T20:00:00.000Z');
assert.equal(new Date(ouvertureDeLaNuit(7)).toISOString(), '2026-10-25T21:00:00.000Z');
assert.equal(new Date(ouvertureDeLaNuit(13)).toISOString(), '2026-10-31T21:00:00.000Z');
const t = Date.UTC(2026, 9, 21, 22);       // 21/10, nuits 1 a 3 ouvertes
const P = (e, now = t) => etapeHalloweenPlausible(db, 'appareil1', e, now);
assert.equal(await P('hw_entree'), true);
assert.equal(await P('hw_tenue_13'), false, 'nuit 13 pas ouverte');
assert.equal(await P('hw_tenue_1'), false, 'tenue sans tentative');
lignes.set('appareil1|hw_nuit_1', t);
assert.equal(await P('hw_tenue_1', t + 1000), false, 'trop rapide');
assert.equal(await P('hw_tenue_1', t + 9000), true);
assert.equal(await P('hw_nuit_2'), false, 'nuit 1 pas tenue');
lignes.set('appareil1|hw_tenue_1', t);
assert.equal(await P('hw_nuit_2'), true);
assert.equal(await P('hw_nuit_4'), false, 'nuit 4 pas encore ouverte le 21');
console.log('hw ok');
