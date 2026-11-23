// Le message FCM d'une invitation en direct passe par le canal `invitations`,
// les autres restent sur le canal par defaut. node worker/test/push-canal-urgent.test.mjs
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { notifierAppareil } from '../src/push.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = { FCM_COMPTE_SERVICE: { client_email: 'x@y', project_id: 'p',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) } };
const db = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [{ jeton: 'j', langue: 'fr' }] }) }) }) };

const envoyes = [];
globalThis.fetch = async (url, o) => {
  if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }));
  envoyes.push(JSON.parse(o.body).message);
  return new Response('{}');
};

for (const t of ['direct', 'relais_defi', 'defi']) await notifierAppareil(db, 'd', t, env);
const [direct, relais, defi] = envoyes.map(m => m.android.notification);
assert.equal(direct.channel_id, 'invitations');
assert.equal(direct.notification_priority, 'PRIORITY_MAX');
assert.equal(relais.channel_id, 'invitations');
assert.equal(defi.channel_id, undefined);
assert.equal(defi.visibility, 'PUBLIC');
console.log('ok', JSON.stringify(direct));
