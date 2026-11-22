// Les modes de defi, cote serveur : plusieurs releveurs, le sans-nom, le rang,
// et les invitations en direct qui ne menent nulle part.
const B = process.env.BASE || 'http://127.0.0.1:8788';
const H = { 'Content-Type': 'application/json' };
let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c ? '' : ' — ' + JSON.stringify(d)}`); if (!c) e++; };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json());
const get = u => fetch(B + u).then(r => r.json());
const dormir = ms => new Promise(r => setTimeout(r, ms));

const s = Math.random().toString(36).slice(2, 6).toUpperCase();
const dev = l => `audit${l}00-${s}-2222-3333-444444444444`;
const nom = l => `AUD${l}${s}`;
const defi = (l, ms, plus = {}) => post('/challenge', {
  device_id: dev(l), name: nom(l), races: ['100'], level_idx: 4,
  total_ms: ms, splits: [ms], traces: [[0, 1, 2, 3]], ...plus });
const releve = (id, l, ms, trace, sansNom) => post('/challenge/attempt', {
  id, device_id: dev(l), name: sansNom ? undefined : nom(l), total_ms: ms, splits: [ms], traces: [trace] });
const fantome = (id, l) => get(`/duel/fantome?id=${id}&device_id=${dev(l)}&name=${nom(l)}`);

console.log('── un defi, trois releveurs');
const { id } = await defi('A', 11000);
// D perd d'abord, puis C gagne, puis B gagne mieux : l'ordre qui piegeait la route.
await releve(id, 'D', 12000, [0, 1, 1, 1]);
await releve(id, 'C', 10500, [0, 8, 9, 9]);
await releve(id, 'B', 10000, [0, 5, 6, 7]);
let f = await fantome(id, 'D');
ok('D court contre A', f.found && f.name === nom('A') && f.total_ms === 11000, f);
f = await fantome(id, 'A');
ok('A court contre B, le meilleur', f.found && f.name === nom('B') && f.total_ms === 10000, f);
ok('avec la trace de B', JSON.stringify(f.traces) === '[[0,5,6,7]]', f.traces);
ok('C, vainqueur, n a pas de fantome', !(await fantome(id, 'C')).found);
let r = await defi('A', 9900, { revanche_de: id });
ok('la revanche de A part chez B', r.target_name === nom('B'), r);
r = await defi('A', 10200, { revanche_de: id });
ok('a 10,20 elle ne part pas', !r.target_name, r);
r = await defi('D', 10900, { revanche_de: id });
ok('la revanche de D part chez A', r.target_name === nom('A'), r);

console.log('── le releveur sans nom');
const { id: id2 } = await defi('E', 11000);
r = await releve(id2, 'F', 10000, [0, 1, 2, 3], true);
ok('il a son verdict', r.duel?.issue === 'opponent', r);
ok('sans point', r.duel?.lp === undefined, r.duel);
r = await releve(id2, 'G', 12000, [0, 1, 2, 3], true);
ok('un second sans-nom a le sien', r.duel?.issue === 'challenger', r);
r = await get(`/duel/results?device_id=${dev('E')}&name=${nom('E')}`);
ok('le lanceur l apprend', r.results?.length === 1, r);
r = await get(`/duels?epreuve=100&name=${nom('E')}`);
ok('et n est pas classe dessus', !r.moi, r.moi);
ok('aucune ligne Anonyme', !r.classement.some(x => x.name.trim().toLowerCase() === 'anonyme'));

console.log('── ma ligne');
r = await get(`/duels?epreuve=100&name=${nom('A')}`);
ok('rendue, avec son rang', r.moi?.rank >= 1, r.moi);

console.log('── les invitations');
await post('/claim', { device_id: dev('H'), name: nom('H') });
await post('/claim', { device_id: dev('I'), name: nom('I') });
const code = 'ZZ' + s;
r = await post('/direct/inviter', { device_id: dev('H'), nom: nom('H'), cibles: [nom('I')], code });
ok('elle part', r.invites?.includes(nom('I')), r);
const recues = async () => (await get(`/direct/invitations?device_id=${dev('I')}`)).invitations;
ok('salle jamais ouverte : rien', (await recues()).length === 0);
const ws = new WebSocket(`${B.replace('http', 'ws')}/live/${code}?name=${nom('H')}&races=100&max=2`);
await new Promise((oui, non) => { ws.onopen = oui; ws.onerror = non; });
ok('l hote attend : elle est rendue', (await recues()).length === 1);
ws.close();
await dormir(500);
ok('l hote est reparti : rien', (await recues()).length === 0);

console.log(e ? `✗ ${e} echec(s)` : '✓ tout passe');
process.exit(e ? 1 : 0);
