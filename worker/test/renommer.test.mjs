// Le renommage (src/renommer.js). node worker/test/renommer.test.mjs
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { REGISTRE, EXEMPTEES, renommer, instructionsRenommage } from '../src/renommer.js';
import { baseD1 } from './d1-sqlite.mjs';

// 1. Chaque table creee par le worker est rangee : au registre, ou exemptee.
const dossier = new URL('../src/', import.meta.url);
const creees = new Set();
for (const f of readdirSync(dossier).filter(f => f.endsWith('.js'))) {
  for (const m of readFileSync(new URL(f, dossier), 'utf8').matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) {
    creees.add(m[1]);
  }
}
const rangees = new Set([...REGISTRE.map(e => e.table), ...Object.keys(EXEMPTEES)]);
const oubliees = [...creees].filter(t => !rangees.has(t));
assert.deepEqual(oubliees, [], `tables a ranger dans renommer.js : ${oubliees.join(', ')}`);
// Et chaque colonne du registre existe bien dans le schema de sa table (au
// CREATE ou par un ALTER) : une colonne mal orthographiee serait sautee en
// silence, et ses lignes ne suivraient pas le joueur.
const sources = readdirSync(dossier).filter(f => f.endsWith('.js'))
  .map(f => readFileSync(new URL(f, dossier), 'utf8')).join('\n');
for (const e of REGISTRE) {
  const create = sources.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${e.table}\\b[\\s\\S]*?\\)\\s*\``));
  const alters = [...sources.matchAll(new RegExp(`ALTER TABLE ${e.table} ADD COLUMN (\\w+)`, 'g'))].map(m => m[1]);
  const cols = [...(e.paires || []).flat().filter(Boolean), ...(e.affiches || []),
    ...(e.composees || []).map(c => c.colonne)];
  for (const c of cols) {
    assert.ok((create && new RegExp(`\\b${c}\\b`).test(create[0])) || alters.includes(c),
      `${e.table}.${c} : colonne introuvable dans le schema`);
  }
}
const fantomes = REGISTRE.map(e => e.table).filter(t => !creees.has(t));
assert.deepEqual(fantomes, [], `tables du registre qui n'existent pas : ${fantomes.join(', ')}`);

// 2. Un renommage reecrit tout, garde tout, et ne touche pas aux autres.
const db = baseD1();
await db.exec(`
  CREATE TABLE players (name_key TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE player_devices (name_key TEXT NOT NULL, device_id TEXT NOT NULL, added_at INTEGER NOT NULL,
    PRIMARY KEY (name_key, device_id));
  CREATE TABLE scores (device_id TEXT NOT NULL, race_key TEXT NOT NULL, name TEXT NOT NULL, time_ms INTEGER NOT NULL,
    updated_at INTEGER NOT NULL, PRIMARY KEY (device_id, race_key));
  CREATE TABLE races (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id TEXT, name_key TEXT, name TEXT, race_key TEXT,
    time_ms INTEGER, mode TEXT, level_idx INTEGER, created_at INTEGER);
  CREATE TABLE duel_results (challenge_id TEXT NOT NULL, opponent_key TEXT NOT NULL, challenger_key TEXT NOT NULL,
    created_at INTEGER, opponent_name TEXT, PRIMARY KEY (challenge_id, opponent_key));
  CREATE TABLE duel_players (name_key TEXT NOT NULL, epreuve TEXT NOT NULL, name TEXT NOT NULL, lp INTEGER,
    PRIMARY KEY (name_key, epreuve));
  CREATE TABLE marques_duels (evenement TEXT, paire TEXT, tenant_key TEXT, tenant_name TEXT, vaincu_key TEXT,
    vaincu_name TEXT);
`);
await db.batch([
  db.prepare(`INSERT INTO players VALUES ('jules', 'Jules', 'ABC123', 1), ('lea', 'Lea', 'XYZ789', 1)`),
  db.prepare(`INSERT INTO player_devices VALUES ('jules', 'appareil-jules', 1), ('lea', 'appareil-lea', 1)`),
  db.prepare(`INSERT INTO scores VALUES ('appareil-jules', '100m', ' Jules ', 10500, 5), ('appareil-lea', '100m', 'Lea', 11000, 5)`),
  db.prepare(`INSERT INTO races (name_key, name, race_key, time_ms) VALUES ('jules', 'Jules', '100m', 10500)`),
  db.prepare(`INSERT INTO duel_results VALUES ('D1', 'lea', 'jules', 1, 'Lea'), ('D2', 'jules', 'lea', 2, 'Jules')`),
  db.prepare(`INSERT INTO duel_players VALUES ('jules', '100m', 'Jules', 42), ('lea', '100m', 'Lea', 7)`),
  db.prepare(`INSERT INTO marques_duels VALUES ('E', 'jules|lea', 'jules', 'Jules', 'lea', 'Lea')`),
]);
const n = await renommer(db, 'Jules', 'Flash');
assert.ok(n > 0);
const un = (sql) => db.sqlite.prepare(sql).get();
const tous = (sql) => db.sqlite.prepare(sql).all();
assert.equal(un(`SELECT count(*) c FROM players WHERE name_key = 'jules'`).c, 0);
assert.deepEqual({ ...un(`SELECT name, code FROM players WHERE name_key = 'flash'`) }, { name: 'Flash', code: 'ABC123' });
assert.equal(un(`SELECT device_id FROM player_devices WHERE name_key = 'flash'`).device_id, 'appareil-jules');
assert.equal(un(`SELECT name FROM scores WHERE device_id = 'appareil-jules'`).name, 'Flash');
assert.equal(un(`SELECT time_ms FROM scores WHERE device_id = 'appareil-jules'`).time_ms, 10500);
assert.equal(un(`SELECT name_key FROM races`).name_key, 'flash');
assert.equal(un(`SELECT challenger_key FROM duel_results WHERE challenge_id = 'D1'`).challenger_key, 'flash');
assert.deepEqual({ ...un(`SELECT opponent_key, opponent_name FROM duel_results WHERE challenge_id = 'D2'`) },
  { opponent_key: 'flash', opponent_name: 'Flash' });
assert.equal(un(`SELECT lp FROM duel_players WHERE name_key = 'flash'`).lp, 42);
assert.equal(un(`SELECT paire FROM marques_duels`).paire, 'flash|lea');
// Lea n'a pas bouge.
assert.equal(un(`SELECT name FROM players WHERE name_key = 'lea'`).name, 'Lea');
assert.equal(tous(`SELECT * FROM duel_players WHERE name_key = 'lea'`).length, 1);

// 3. Tout ou rien : une instruction qui echoue annule les autres.
const ops = await instructionsRenommage(db, 'Flash', 'Eclair');
ops.push(db.prepare(`INSERT INTO table_qui_nexiste_pas VALUES (1)`));
await assert.rejects(db.batch(ops));
assert.equal(un(`SELECT count(*) c FROM players WHERE name_key = 'flash'`).c, 1, 'rien ne doit avoir ete renomme');
assert.equal(un(`SELECT name FROM scores WHERE device_id = 'appareil-jules'`).name, 'Flash');

console.log('ok renommer.test');
