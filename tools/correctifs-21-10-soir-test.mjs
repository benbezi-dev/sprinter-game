// Les correctifs du check du 21/10 au soir, contre le worker local de worker/ :
//
//   (cd worker && npx wrangler dev --local --port 8788)
//   node tools/correctifs-21-10-soir-test.mjs
//
// 1. /claim ne rattache plus que l'appareil qui reserve : un chrono envoye sous
//    un nom libre ne donne plus son code au jour ou le vrai joueur le reserve.
// 2. /champ/pays tient le verrou de nationalite, comme /profil.
// 3. /objectif/classement?n=-1 n'enleve plus la limite.
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';

const B = process.env.BASE || 'http://127.0.0.1:8788';
const post = (p, b) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(b) }).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const m = Math.random().toString(36).slice(2, 7);
const NOM = `Ck${m}`, VRAI = `vrai-${m}-appareil`, INTRUS = `intrus-${m}-appareil`;

// 1. L'intrus a couru sous le nom tant qu'il etait libre. On pose sa ligne de
//    score directement : /submit demanderait une trace complete, et c'est la
//    table qu'on lisait au rattachement.
execFileSync('npx', ['wrangler', 'd1', 'execute', 'sprinter-leaderboard', '--local', '--command',
  `INSERT INTO scores (device_id, race_key, name, time_ms, best_split_ms, updated_at)
   VALUES ('${INTRUS}', '100', '${NOM}', 11000, 0, ${Date.now()})`],
  { cwd: 'worker', stdio: 'ignore' });
const reserve = await post('/claim', { device_id: VRAI, name: NOM });
assert.equal(reserve.corps.ok, true, JSON.stringify(reserve.corps));
const intrus = await post('/claim', { device_id: INTRUS, name: NOM });
assert.equal(intrus.corps.ok, false, 'l intrus ne recupere pas le nom : ' + JSON.stringify(intrus.corps));
assert.equal(intrus.corps.code, undefined, 'ni son code');
console.log('✓ /claim : l appareil qui avait couru sous le nom libre n est pas rattache');

// 2. Le verrou de nationalite sur /champ/pays.
const p1 = await post('/champ/pays', { device_id: VRAI, name: NOM, pays: 'FR' });
assert.equal(p1.statut, 200, JSON.stringify(p1.corps));
const p2 = await post('/champ/pays', { device_id: VRAI, name: NOM, pays: 'MA' });
assert.equal(p2.statut, 409, 'second choix refuse : ' + JSON.stringify(p2.corps));
assert.equal(p2.corps.pays, 'FR');
const p3 = await post('/champ/pays', { device_id: VRAI, name: NOM, pays: 'FR' });
assert.equal(p3.statut, 200, 'reposer le meme pays passe');
const p4 = await post('/profil', { device_id: VRAI, name: NOM, pays: 'MA' });
assert.equal(p4.statut, 409, '/profil refuse aussi : ' + JSON.stringify(p4.corps));
assert.ok(String(p4.corps.error).startsWith('nationalite'), 'le jeu tranche sur ce message');
console.log('✓ /champ/pays et /profil : une nationalite choisie ne change plus');

// 3. Une limite negative.
const c = await fetch(`${B}/objectif/classement?n=-1`);
assert.equal(c.status, 200);
assert.ok((await c.json()).classement.length <= 1, 'n=-1 vaut n=1, pas « sans limite »');
console.log('✓ /objectif/classement?n=-1 : une ligne au plus');

console.log('\nTout passe.');
