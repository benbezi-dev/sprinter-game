// Un defi envoye a plusieurs personnes, contre un vrai worker local.
//
// Ce qui doit tenir : un seul code ; chaque cible (ligne du TOP 500 ou nom du
// classement des duels) le trouve dans sa boite ; l'auteur ne se l'envoie pas ;
// le lancement du defi de la camera fait pareil ; l'ancien champ simple marche.

const B = process.env.BASE || 'http://127.0.0.1:8788';
let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const post = (u, b) => fetch(B + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
}).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const boite = dev => fetch(`${B}/inbox?device_id=${dev}`).then(r => r.json()).then(d => (d.defis || []).map(x => x.id));

const s = Math.random().toString(36).slice(2, 6).toUpperCase();
const dev = k => `${k.repeat(8)}-1111-2222-3333-${s.toLowerCase().padEnd(12, '0')}`;
const J = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map(k => [k, { dev: dev(k), nom: 'MULTI' + k.toUpperCase() + s }]));

for (const k of ['b', 'c', 'd', 'e']) {
  const r = await post('/submit', { device_id: J[k].dev, race_key: '100', name: J[k].nom, time_ms: 10500, best_split_ms: 10500 });
  ok(`chrono de ${k.toUpperCase()} enregistre`, r.statut === 200, JSON.stringify(r.corps).slice(0, 120));
}
const liste = await fetch(`${B}/leaderboard?race=100&by=race`).then(r => r.json());
const id = k => (liste.entries || []).find(x => x.name === J[k].nom)?.id;
ok('B et C ont un identifiant de ligne', id('b') != null && id('c') != null);

const course = { races: ['100'], level_idx: 4, total_ms: 10200, splits: [10200], traces: [[0, 10, 20, 30]] };

console.log('\n── /challenge a trois cibles (deux lignes, un nom, et soi-meme)');
const d1 = await post('/challenge', {
  device_id: J.a.dev, name: J.a.nom, ...course,
  target_score_id: id('b'), target_score_ids: [id('b'), id('c')], target_names: [J.d.nom, J.a.nom],
});
ok('le defi part', d1.statut === 200 && !!d1.corps.id, JSON.stringify(d1.corps));
const noms = (d1.corps.target_names || []).sort();
ok('trois joints : B, C, D', JSON.stringify(noms) === JSON.stringify([J.b.nom, J.c.nom, J.d.nom].sort()), JSON.stringify(noms));
for (const k of ['b', 'c', 'd']) ok(`boite de ${k.toUpperCase()} le porte`, (await boite(J[k].dev)).includes(d1.corps.id));
ok('boite de A ne le porte pas', !(await boite(J.a.dev)).includes(d1.corps.id));
ok('boite de E ne le porte pas', !(await boite(J.e.dev)).includes(d1.corps.id));

console.log('\n── un joueur releve le defi : il sort de SA boite, pas de celle des autres');
const t = await post('/challenge/attempt', { id: d1.corps.id, device_id: J.c.dev, name: J.c.nom, total_ms: 9900, splits: [9900] });
ok('tentative de C enregistree', t.statut === 200, JSON.stringify(t.corps).slice(0, 100));
ok('sorti de la boite de C', !(await boite(J.c.dev)).includes(d1.corps.id));
ok('toujours dans celle de B', (await boite(J.b.dev)).includes(d1.corps.id));

console.log('\n── defi de la camera, lance vers deux noms');
const cam = await post('/challenge/camera', { device_id: J.a.dev, name: J.a.nom, ...course });
ok('la camera pose le defi', cam.statut === 200 && !!cam.corps.id, JSON.stringify(cam.corps));
const l = await post('/challenge/lance', { id: cam.corps.id, device_id: J.a.dev, name: J.a.nom, target_names: [J.b.nom, J.e.nom] });
ok('lance', l.statut === 200, JSON.stringify(l.corps));
ok('joints : B et E', JSON.stringify((l.corps.target_names || []).sort()) === JSON.stringify([J.b.nom, J.e.nom].sort()), JSON.stringify(l.corps.target_names));
ok('boite de E le porte', (await boite(J.e.dev)).includes(cam.corps.id));
ok('boite de B le porte', (await boite(J.b.dev)).includes(cam.corps.id));

console.log('\n── ancien client : un seul target_score_id');
const d2 = await post('/challenge', { device_id: J.a.dev, name: J.a.nom, ...course, target_score_id: id('c') });
ok('joint C', d2.corps.target_name === J.c.nom && (d2.corps.target_names || []).length === 1, JSON.stringify(d2.corps));
ok('boite de C le porte', (await boite(J.c.dev)).includes(d2.corps.id));

console.log(e ? `\n${e} echec(s)\n` : '\nTout tient.\n');
process.exit(e ? 1 : 0);
