// La revanche, cote serveur : a qui elle s'adresse, et a quelles conditions.
//
// Le jeu tient deja la regle a l'ecran — rien ne part si le chrono ne bat pas
// celui du vainqueur — mais une regle qui ne vit que dans l'ecran n'est pas une
// regle : l'identifiant d'un duel circule des deux cotes, et il suffirait de le
// renvoyer avec n'importe quel chrono pour s'adresser a n'importe qui.
const B = process.env.BASE || 'http://127.0.0.1:8788';
const H = { 'Content-Type': 'application/json' };
let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 54 - t.length))}`);
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b) })
  .then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const get = u => fetch(B + u)
  .then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));

const s = Math.random().toString(36).slice(2, 6).toUpperCase();
const devA = `revaaaa1-${s}-2222-3333-444444444444`;
const devB = `revbbbb1-${s}-2222-3333-444444444444`;
const devC = `revcccc1-${s}-2222-3333-444444444444`;
const nomA = 'REVA' + s, nomB = 'REVB' + s, nomC = 'REVC' + s;

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LA REVANCHE — a qui, et a quelles conditions                ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const defi = async (dev, nom, ms, extra = {}) => (await post('/challenge', {
  device_id: dev, name: nom, races: ['100'], level_idx: 4,
  total_ms: ms, splits: [ms], traces: [[0, 10, 20, 30]], ...extra,
})).corps;

titre('LE PERDANT VISE JUSTE, S IL A BATTU LE CHRONO');
// A lance a 11,00 s ; B repond a 10,00 s et gagne. Le perdant est A.
const id = (await defi(devA, nomA, 11000)).id;
await post('/challenge/attempt', { id, device_id: devB, name: nomB, total_ms: 10000, splits: [10000] });

const trop = await defi(devA, nomA, 10500, { revanche_de: id });
ok('a 10,50 s, rien n est adresse', !trop.target_name, String(trop.target_name));

const bon = await defi(devA, nomA, 9800, { revanche_de: id });
ok('a 9,80 s, la revanche part chez B', bon.target_name === nomB, String(bon.target_name));

titre('ET PERSONNE D AUTRE NE PEUT S EN SERVIR');
const parLeVainqueur = await defi(devB, nomB, 9000, { revanche_de: id });
ok('le vainqueur ne « prend pas sa revanche »', !parLeVainqueur.target_name,
   String(parLeVainqueur.target_name));

const parUnTiers = await defi(devC, nomC, 9000, { revanche_de: id });
ok('un tiers qui connait le code n atteint personne', !parUnTiers.target_name,
   String(parUnTiers.target_name));

const inconnu = await defi(devA, nomA, 9000, { revanche_de: 'ZZZZZZ' });
ok('un duel inexistant ne vise personne', !inconnu.target_name, String(inconnu.target_name));

titre('L AUTRE SENS : LE RELEVEUR QUI PERD');
// A lance a 10,00 s ; B repond a 11,00 s et perd. Le perdant est B.
const id2 = (await defi(devA, nomA, 10000)).id;
await post('/challenge/attempt', { id: id2, device_id: devB, name: nomB, total_ms: 11000, splits: [11000] });
const parB = await defi(devB, nomB, 9500, { revanche_de: id2 });
ok('B vise A en battant son chrono', parB.target_name === nomA, String(parB.target_name));
const parBmou = await defi(devB, nomB, 10400, { revanche_de: id2 });
ok('mais pas avec un chrono plus lent', !parBmou.target_name, String(parBmou.target_name));

titre('LE FANTOME A BATTRE — RENDU AU SEUL PERDANT');
/* La revanche se court contre le vainqueur, pas contre une piste vide. Le
   serveur rend donc sa trace — et seulement a celui qui a perdu, parce que
   l'identifiant d'un duel circule des deux cotes. */
const id3 = (await defi(devA, nomA, 11000)).id;
await post('/challenge/attempt', {
  id: id3, device_id: devB, name: nomB, total_ms: 10000, splits: [10000],
  traces: [[0, 40, 90, 150, 220]],
});

const vuParA = (await get(`/duel/fantome?id=${id3}&device_id=${devA}&name=${nomA}`)).corps;
ok('le perdant recoit la course du vainqueur', vuParA.found === true, JSON.stringify(vuParA));
ok('  avec son nom', vuParA.name === nomB, String(vuParA.name));
ok('  avec son chrono', vuParA.total_ms === 10000, String(vuParA.total_ms));
ok('  avec sa trace', Array.isArray(vuParA.traces) && vuParA.traces[0]
   && vuParA.traces[0].length === 5, JSON.stringify(vuParA.traces));

const vuParB = (await get(`/duel/fantome?id=${id3}&device_id=${devB}&name=${nomB}`)).corps;
ok('le vainqueur n a pas de fantome a courir', vuParB.found === false, JSON.stringify(vuParB));

const vuParC = (await get(`/duel/fantome?id=${id3}&device_id=${devC}&name=${nomC}`)).corps;
ok('un tiers qui connait le code n obtient rien', vuParC.found === false, JSON.stringify(vuParC));

// L'autre sens : le releveur qui perd court contre la course du lanceur, celle
// que le defi gardait depuis toujours.
const id4 = (await defi(devA, nomA, 10000)).id;
await post('/challenge/attempt', { id: id4, device_id: devB, name: nomB, total_ms: 11000, splits: [11000] });
const vuParBperdant = (await get(`/duel/fantome?id=${id4}&device_id=${devB}&name=${nomB}`)).corps;
ok('le releveur qui perd recoit la course du lanceur',
   vuParBperdant.found === true && vuParBperdant.name === nomA, JSON.stringify(vuParBperdant));
ok('  avec sa trace', Array.isArray(vuParBperdant.traces) && vuParBperdant.traces[0]
   && vuParBperdant.traces[0].length === 4, JSON.stringify(vuParBperdant.traces));

// Une rencontre d'avant que les tentatives ne gardent leur trace : le fantome
// est vide, et c'est un fantome en moins, pas une erreur. Le jeu repart alors
// avec le seul chrono pour cible.
const id5 = (await defi(devA, nomA, 11000)).id;
await post('/challenge/attempt', { id: id5, device_id: devB, name: nomB, total_ms: 10000, splits: [10000] });
const sansTrace = (await get(`/duel/fantome?id=${id5}&device_id=${devA}&name=${nomA}`)).corps;
ok('sans trace enregistree, la reponse tient quand meme',
   sansTrace.found === true && sansTrace.total_ms === 10000, JSON.stringify(sansTrace));
ok('  et la trace revient vide',
   Array.isArray(sansTrace.traces) && (sansTrace.traces[0] || []).length === 0,
   JSON.stringify(sansTrace.traces));

const nul = (await get(`/duel/fantome?id=ZZZZZZ&device_id=${devA}&name=${nomA}`)).corps;
ok('un duel inexistant ne rend rien', nul.found === false, JSON.stringify(nul));

console.log(e ? `\n${e} echec(s)\n` : '\nTout tient.\n');
process.exit(e ? 1 : 0);
