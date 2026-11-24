// Les versions des stores (src/app-version.js) et leur route GET /app/version.
// node worker/test/app-version.test.mjs
import assert from 'node:assert/strict';
import { baseD1 } from './d1-sqlite.mjs';
import worker from '../src/index.js';
import { versionsDesStores, ID_APPLE, PAQUET_ANDROID } from '../src/app-version.js';

// 1. Les valeurs posees dans l'environnement passent telles quelles.
let v = versionsDesStores({
  APP_IOS_LATEST: '1.0.21', APP_IOS_MIN: '1.0.20',
  APP_ANDROID_LATEST: '1.10.0', APP_ANDROID_MIN: '1.2',
});
assert.equal(v.ios.latestVersion, '1.0.21');
assert.equal(v.ios.minSupportedVersion, '1.0.20');
assert.equal(v.android.latestVersion, '1.10.0');
assert.equal(v.android.minSupportedVersion, '1.2');
assert.equal(v.ios.storeUrl, `https://apps.apple.com/app/id${ID_APPLE}`);
assert.equal(v.android.storeUrl, `https://play.google.com/store/apps/details?id=${PAQUET_ANDROID}`);

// 2. Une faute de frappe ne bloque personne : retour au defaut.
v = versionsDesStores({ APP_IOS_MIN: '9.9.9 ', APP_ANDROID_MIN: 'v2', APP_IOS_LATEST: '' });
assert.equal(v.ios.minSupportedVersion, '9.9.9'); // espaces tolerees
assert.equal(v.android.minSupportedVersion, '1.0.0');
assert.match(v.ios.latestVersion, /^\d+\.\d+\.\d+$/);

// 3. Sans rien : des defauts qui ne bloquent aucune version publiee.
v = versionsDesStores();
assert.equal(v.ios.minSupportedVersion, '1.0.0');
assert.equal(v.android.minSupportedVersion, '1.0.0');

// 4. La vraie route, publique, en cache court, avec CORS.
const env = { DB: baseD1(), APP_ANDROID_LATEST: '1.0.25' };
const ctx = { waitUntil() {} };
const r = await worker.fetch(new Request('https://w.example/app/version',
  { headers: { 'CF-Connecting-IP': '203.0.113.7', Origin: 'capacitor://localhost' } }), env, ctx);
assert.equal(r.status, 200);
assert.match(r.headers.get('Cache-Control') || '', /max-age=300/);
assert.ok(r.headers.get('Access-Control-Allow-Origin'));
const corps = await r.json();
assert.equal(corps.android.latestVersion, '1.0.25');
assert.ok(corps.ios.storeUrl.includes(ID_APPLE));

// 5. Seul GET repond.
const p = await worker.fetch(new Request('https://w.example/app/version', { method: 'POST' }), env, ctx);
assert.notEqual(p.status, 200);

console.log('app-version : ok');
