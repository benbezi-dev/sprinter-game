// Les pseudos interdits et le changement de pseudo, par les vraies routes du
// worker (src/index.js) sur une base node:sqlite.
// node worker/test/pseudo-routes.test.mjs
import assert from 'node:assert/strict';
import { baseD1 } from './d1-sqlite.mjs';
import worker, { masquerNoms, filtrePseudosActif } from '../src/index.js';
import { CLES } from '../src/epreuves.js';

const db = baseD1();
const courriels = [];
const fetchReel = globalThis.fetch;
globalThis.fetch = async (url, o) => {
  if (String(url).includes('api.resend.com')) {
    courriels.push(JSON.parse(o.body));
    return new Response('{}');
  }
  return fetchReel(url, o);
};
const env = { DB: db, ADMIN_CLE: 'cle-admin', RESEND_CLE: 'cle-resend' };

async function appel(chemin, { methode = 'GET', corps, entetes = {}, formulaire } = {}) {
  const attentes = [];
  const ctx = { waitUntil: p => attentes.push(Promise.resolve(p).catch(() => {})) };
  const init = { method: methode, headers: { 'CF-Connecting-IP': '203.0.113.' + Math.floor(Math.random() * 250), ...entetes } };
  if (corps) { init.body = JSON.stringify(corps); init.headers['Content-Type'] = 'application/json'; }
  if (formulaire) init.body = new URLSearchParams(formulaire);
  const r = await worker.fetch(new Request('https://w.example' + chemin, init), env, ctx);
  await Promise.all(attentes);
  const texte = await r.text();
  let json = null;
  try { json = JSON.parse(texte); } catch { /* HTML */ }
  return { status: r.status, json, texte };
}
const course = (name, device_id) => appel('/race', { methode: 'POST', corps: {
  device_id, name, race_key: CLES[0], time_ms: 60_000, mode: 'campaign', level_idx: 0 } });
const un = (sql, ...a) => db.sqlite.prepare(sql).get(...a);

// 4. Reservation d'un pseudo interdit : refusee par l'API.
let r = await appel('/claim', { methode: 'POST', corps: { device_id: 'appareil-0001', name: 'Axel ma pute' } });
assert.equal(r.status, 400);
assert.equal(r.json.code, 'INVALID_USERNAME_PROFANITY');
assert.ok(!r.texte.includes('pute'), 'le refus ne repete pas le mot');
r = await appel('/claim', { methode: 'POST', corps: { device_id: 'appareil-0001', name: 'c0nn4rd' } });
assert.equal(r.json.code, 'INVALID_USERNAME_PROFANITY');
r = await appel('/claim', { methode: 'POST', corps: { device_id: 'appareil-0001', name: 'Jules' } });
assert.equal(r.json.ok, true);
// La demande de changement refuse aussi un pseudo interdit.
r = await appel('/pseudo/demande', { methode: 'POST', corps: { device_id: 'appareil-0001', name: 'Jules', demande: 'Sale pute' } });
assert.equal(r.status, 400);
assert.equal(r.json.code, 'INVALID_USERNAME_PROFANITY');

// 5. Un pseudo interdit deja en base : la partie est bloquee...
await db.batch([
  db.prepare(`INSERT INTO players (name_key, name, code, created_at) VALUES ('elise la pedale', 'Elise la pedale', 'AAAAAA', 1)`),
  db.prepare(`INSERT INTO player_devices VALUES ('elise la pedale', 'appareil-elise', 1)`),
]);
r = await course('Elise la pedale', 'appareil-elise');
assert.equal(r.status, 403);
assert.equal(r.json.code, 'USERNAME_CHANGE_REQUIRED');
r = await appel('/live/ABCD12?name=' + encodeURIComponent('Elise la pedale'), { entetes: { Upgrade: 'websocket' } });
assert.equal(r.status, 403);
assert.equal(r.json.code, 'USERNAME_CHANGE_REQUIRED');
r = await appel('/claim', { methode: 'POST', corps: { device_id: 'appareil-elise', name: 'Elise la pedale' } });
assert.equal(r.json.code, 'INVALID_USERNAME_PROFANITY', 'un nom interdit deja reserve ne se reconfirme pas');
r = await appel('/pseudo/etat?name=' + encodeURIComponent('Elise la pedale') + '&device_id=appareil-elise');
assert.equal(r.json.a_changer, true);
assert.equal(r.json.raison, 'interdit');
// ... un joueur ordinaire, lui, joue.
r = await course('Jules', 'appareil-0001');
assert.notEqual(r.json && r.json.code, 'USERNAME_CHANGE_REQUIRED');
assert.equal(r.status, 200);
const avant = un(`SELECT count(*) c FROM races WHERE name_key = 'jules'`).c;
assert.equal(avant, 1);

// ... puis debloquee des que le pseudo change, progression comprise.
await db.prepare(`INSERT INTO races (device_id, name_key, name, race_key, time_ms, mode, level_idx, created_at)
                  VALUES ('appareil-elise', 'elise la pedale', 'Elise la pedale', ?, 59000, 'campaign', 0, 5)`)
  .bind(CLES[0]).run();
r = await appel('/pseudo/forcer', { methode: 'POST', corps: { device_id: 'appareil-elise', name: 'Elise la pedale', nouveau: 'Grosse pute' } });
assert.equal(r.json.code, 'INVALID_USERNAME_PROFANITY');
r = await appel('/pseudo/forcer', { methode: 'POST', corps: { device_id: 'appareil-0001', name: 'Elise la pedale', nouveau: 'Elise' } });
assert.equal(r.status, 403, 'on ne renomme pas le nom d un autre');
r = await appel('/pseudo/forcer', { methode: 'POST', corps: { device_id: 'appareil-elise', name: 'Elise la pedale', nouveau: 'Elise' } });
assert.equal(r.json.ok, true);
assert.equal(r.json.name, 'Elise');
assert.equal(r.json.code, 'AAAAAA');
r = await course('Elise', 'appareil-elise');
assert.equal(r.status, 200);
assert.equal(un(`SELECT count(*) c FROM races WHERE name_key = 'elise'`).c, 2, 'l ancienne course a suivi');
r = await appel('/pseudo/etat?name=Elise&device_id=appareil-elise');
assert.equal(r.json.a_changer, false);

// Un pseudo interdit jamais reserve : ses courses (sur cet appareil) suivent.
await db.prepare(`INSERT INTO races (device_id, name_key, name, race_key, time_ms, mode, level_idx, created_at)
                  VALUES ('appareil-libre', 'cacacarine', 'Cacacarine', ?, 61000, 'campaign', 0, 6)`)
  .bind(CLES[0]).run();
r = await appel('/pseudo/forcer', { methode: 'POST', corps: { device_id: 'appareil-libre', name: 'Cacacarine', nouveau: 'Carine' } });
assert.equal(r.json.ok, true);
assert.equal(un(`SELECT count(*) c FROM races WHERE name_key = 'carine'`).c, 1);
assert.equal(un(`SELECT device_id FROM player_devices WHERE name_key = 'carine'`).device_id, 'appareil-libre');

// Les classements masquent un pseudo interdit, et la presence ne le nomme pas.
assert.deepEqual(masquerNoms({ entries: [{ name: 'Axel ma pute', ms: 1 }, { name: 'Jules', ms: 2 }], race: '100m' }),
  { entries: [{ name: 'Joueur masqué', ms: 1 }, { name: 'Jules', ms: 2 }], race: '100m' });
assert.deepEqual(masquerNoms({ joueurs: [{ nom: 'Cacacarine', quoi: 'menu' }] }),
  { joueurs: [{ nom: 'Joueur masqué', quoi: 'menu' }] });
// Le canal de test n'est pas concerne.
assert.equal(filtrePseudosActif({ test: true }), false);
assert.equal(filtrePseudosActif({ test: false }), true);

// Changement de pseudo, de la demande au clic de l'admin.
r = await appel('/pseudo/demande', { methode: 'POST', corps: { device_id: 'appareil-0001', name: 'Jules', demande: 'Flash' } });
assert.equal(r.json.ok, true);
assert.equal(r.json.statut, 'PENDING');
assert.equal(courriels.length, 1);
const lien = courriels[0].text.match(/https:\/\/w\.example\/pseudo\/admin\?t=[0-9a-f]{64}/)[0];
const t = new URL(lien).searchParams.get('t');
// Le pseudo reserve ne se prend pas par /claim.
r = await appel('/claim', { methode: 'POST', corps: { device_id: 'appareil-9999', name: 'Flash' } });
assert.equal(r.json.pris, true);
// Le GET montre, et ne change rien.
r = await appel(`/pseudo/admin?t=${t}&action=confirmer`);
assert.equal(r.status, 200);
assert.match(r.texte, /Confirmer le changement/);
assert.match(r.texte, /method="POST"/);
assert.equal(un(`SELECT statut FROM pseudo_demandes`).statut, 'PENDING');
assert.equal(un(`SELECT count(*) c FROM players WHERE name_key = 'jules'`).c, 1);
// Un jeton faux ne montre rien.
r = await appel(`/pseudo/admin?t=${'0'.repeat(64)}`);
assert.equal(r.status, 410);
// Le POST confirme.
r = await appel('/pseudo/admin', { methode: 'POST', formulaire: { t, action: 'confirmer' } });
assert.equal(r.status, 200);
assert.match(r.texte, /Changement confirmé/);
assert.equal(un(`SELECT name FROM players WHERE name_key = 'flash'`).name, 'Flash');
assert.equal(un(`SELECT count(*) c FROM races WHERE name_key = 'flash'`).c, 1);
// Le lien ne sert qu'une fois.
r = await appel('/pseudo/admin', { methode: 'POST', formulaire: { t, action: 'confirmer' } });
assert.equal(r.status, 409);
r = await appel(`/pseudo/admin?t=${t}`);
assert.equal(r.status, 410);
// Le jeu de Jules apprend son nouveau nom.
r = await appel('/pseudo/etat?name=Jules&device_id=appareil-0001');
assert.equal(r.json.nom, 'Flash');
assert.equal(r.json.demande.statut, 'APPROVED');

globalThis.fetch = fetchReel;
console.log('ok pseudo-routes.test');
