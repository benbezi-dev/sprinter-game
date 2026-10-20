// Les correctifs du 21/10 (invitations, codes de test, etapes Halloween, meute),
// contre un worker local neuf : BASE=http://127.0.0.1:PORT node tools/correctifs-21-10-test.mjs
import assert from 'node:assert';
const B = process.env.BASE || 'http://127.0.0.1:8794';
const post = (p, b, h = {}) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(b) });
const get = (p, h = {}) => fetch(B + p, { headers: h });
const A = 'appareilhote00000001', V = 'appareilinvite000001';

// 5. invitations en double
assert.equal((await post('/claim', { device_id: A, name: 'Hote' })).status, 200);
assert.equal((await post('/claim', { device_id: V, name: 'Invite' })).status, 200);
const inv = () => post('/direct/inviter', { device_id: A, nom: 'Hote', cibles: ['Invite'], code: 'ABCD12', epreuve: '100' });
const r1 = await (await inv()).json();
const r2 = await (await inv()).json();
assert.deepEqual(r1.invites, ['Invite']); assert.deepEqual(r2.invites, ['Invite']);
const l = await (await get(`/direct/invitations?device_id=${V}`)).json();
assert.equal(l.invitations.length, 1, 'une seule carte pour la meme salle');
console.log('✓ invitation renvoyee = une seule carte');

// 4. codes du canal de test
let derniers = [];
for (let i = 0; i < 12; i++) derniers.push((await get('/presence', { 'X-Sprinter-Test': 'FAUX' + i })).status);
// au plus 10 codes differents par adresse et par 10 min ; d'autres essais du
// meme poste dans la fenetre peuvent avancer le blocage, jamais le retarder
const premier = derniers.indexOf(429);
assert.ok(premier > 0 && premier <= 10, 'bloque au plus tard au 11e : ' + derniers);
assert.ok(derniers.slice(premier).every(s => s === 429), 'et reste bloque : ' + derniers);
console.log('✓ codes rates refuses des le', premier + 1, 'e :', derniers.join(','));

// 3. etape halloween invraisemblable ignoree
const e = await (await post('/etape', { device_id: A, etape: 'hw_tenue_13' })).json();
assert.equal(e.ignoree, true);
console.log('✓ hw_tenue_13 a la main : ignoree');

// 1. meute : un depart du salon libere sa place
const ws = (nom) => new Promise((ok, ko) => {
  const s = new WebSocket(`${B.replace('http', 'ws')}/live/MEUTE7?name=${nom}&races=nuit-100&nuit=1&ouvertes=1&max=3`);
  s.etats = []; s.onmessage = m => s.etats.push(JSON.parse(m.data)); s.onopen = () => ok(s); s.onerror = ko;
});
const attendre = ms => new Promise(r => setTimeout(r, ms));
const a = await ws('Loup1'); await attendre(300);
const b = await ws('Loup2'); await attendre(300);
const c = await ws('Loup3'); await attendre(300);
a.send(JSON.stringify({ t: 'pret', pret: true }));
b.send(JSON.stringify({ t: 'pret', pret: true }));
await attendre(400);
const avant = [...a.etats].reverse().find(m => m.depart_a !== undefined || m.max);
c.close(); await attendre(800);
const apres = [...a.etats].reverse().find(m => m.max !== undefined);
assert.equal(apres.max, 2, 'la place de Loup3 disparait : ' + JSON.stringify(apres).slice(0, 200));
assert.ok(apres.depart_a, 'les deux restants etaient prets : la meute part');
console.log('✓ meute 3 places, un part du salon : max', apres.max, ', depart programme');
a.close(); b.close();
process.exit(0);
