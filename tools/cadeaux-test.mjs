// Les cadeaux de l'auteur (worker/src/cadeaux.js), contre le vrai serveur.
//
// Ce qui se verifie ici : un cadeau ne part que vers un appareil relie au nom
// reserve. Un nom libre se tape par n'importe qui, un appareil non relie peut
// porter n'importe quel nom dans sa puce — ni l'un ni l'autre ne recoit rien.
//
// Le cadeau d'essai est celui de Choppa : le nom doit etre LIBRE au depart,
// d'ou une base neuve a chaque execution.
//
//   npx wrangler dev --local --port 8788 --persist-to "$(mktemp -d)"   (depuis worker/)
//   node tools/cadeaux-test.mjs

const B = 'http://127.0.0.1:8788';

const post = (u, b) => fetch(B + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}),
}).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const cadeaux = (nom, appareil) =>
  fetch(`${B}/cadeaux?name=${encodeURIComponent(nom)}&device_id=${encodeURIComponent(appareil)}`)
    .then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};
const rien = c => Array.isArray(c.skins) && Array.isArray(c.stades)
  && c.skins.length === 0 && c.stades.length === 0;
const leCadeau = c => JSON.stringify(c.skins) === '["meba"]' && JSON.stringify(c.stades) === '["riviera"]';

const marque = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const tel = `dev-${marque}-tel`, autre = `dev-${marque}-autre`, second = `dev-${marque}-second`;

console.log('\n── LE NOM ENCORE LIBRE ──────────────────────────────────────');
const libre = await cadeaux('Choppa', tel);
ok('la route repond', libre.statut === 200, String(libre.statut));
ok('un nom libre ne recoit rien', rien(libre.corps), JSON.stringify(libre.corps));

console.log('\n── LE NOM RESERVE ───────────────────────────────────────────');
const reserve = await post('/claim', { device_id: tel, name: 'Choppa' });
ok('Choppa se reserve', reserve.corps.ok === true, JSON.stringify(reserve.corps));
const sien = await cadeaux('Choppa', tel);
ok('son appareil recoit le skin de Meba et la Riviera', leCadeau(sien.corps), JSON.stringify(sien.corps));
ok('la casse du nom ne compte pas', leCadeau((await cadeaux('CHOPPA', tel)).corps));
ok('un autre appareil sous le meme nom ne recoit rien', rien((await cadeaux('Choppa', autre)).corps));

console.log('\n── UN SECOND APPAREIL RELIE ─────────────────────────────────');
const lien = await post('/link', { device_id: second, name: 'Choppa', code: reserve.corps.code });
ok('il se relie avec le code', lien.corps.ok === true, JSON.stringify(lien.corps));
ok('et recoit le cadeau a son tour', leCadeau((await cadeaux('Choppa', second)).corps));

console.log('\n── TOUS LES AUTRES ──────────────────────────────────────────');
const lui = `Joueur ${marque}`.slice(0, 20);
await post('/claim', { device_id: autre, name: lui });
ok('un autre nom reserve ne recoit rien', rien((await cadeaux(lui, autre)).corps));
ok('un appareil invalide ne recoit rien', rien((await cadeaux('Choppa', 'x')).corps));
ok('sans nom, rien', rien((await cadeaux('', tel)).corps));

console.log('\n' + '─'.repeat(62));
console.log(echecs ? `   ${echecs} ECHEC(S).` : '   TOUT PASSE.');
process.exit(echecs ? 1 : 0);
