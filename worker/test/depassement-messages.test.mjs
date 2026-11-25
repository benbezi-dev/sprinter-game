// Les messages du record battu (src/depassement.js). node worker/test/depassement-messages.test.mjs
import assert from 'node:assert/strict';
import { baseD1 } from './d1-sqlite.mjs';
import {
  MESSAGES_RECORD, choisirMessage, texteRecordBattu, nomAffichableDansNotif, recordsBattus,
} from '../src/depassement.js';

// Vingt messages, par paires francais / anglais, memes drapeaux.
assert.equal(MESSAGES_RECORD.fr.length, 20);
assert.equal(MESSAGES_RECORD.en.length, 20);
MESSAGES_RECORD.fr.forEach((m, i) => {
  const en = MESSAGES_RECORD.en[i];
  assert.equal(m.nom, en.nom, `drapeau nom du message ${i}`);
  assert.equal(m.top, en.top, `drapeau top du message ${i}`);
  // Un message « sans nom » ne doit pas l'ecrire, un message « avec » doit l'ecrire.
  for (const x of [m, en]) assert.equal((x.titre + x.corps).includes('{nom}'), x.nom, `message ${i} : {nom}`);
});

// Le choix : jamais de nom ecrit sans nom, jamais de Top 500 hors du Top 500,
// jamais deux fois de suite le meme.
for (let k = 0; k < 500; k++) {
  const sans = choisirMessage({ nom: null, place: 12 });
  assert.equal(MESSAGES_RECORD.fr[sans].nom, false);
  const loin = choisirMessage({ nom: 'Lubin', place: 812 });
  assert.equal(MESSAGES_RECORD.fr[loin].top, false);
  const dernier = choisirMessage({ nom: 'Lubin', place: 12 });
  assert.notEqual(choisirMessage({ nom: 'Lubin', place: 12, dernier }), dernier);
}
// Tous les messages finissent par sortir.
const vus = new Set();
for (let k = 0; k < 2000; k++) vus.add(choisirMessage({ nom: 'Lubin', place: 50 }));
assert.equal(vus.size, 20);

// Le texte : tout est rempli, rien ne reste entre accolades.
const [titre, corps] = texteRecordBattu('60', { index: 0, nom: 'Lubin', place: 50 }, 'fr');
assert.equal(titre, 'Lubin a froissé ton record');
assert.match(corps, /60 m/);
assert.match(corps, /50e/);
for (const langue of ['fr', 'en']) {
  for (let i = 0; i < 20; i++) {
    const t = texteRecordBattu('60', { index: i, nom: 'Arthur', place: 7 }, langue).join(' ');
    assert.ok(!/[{}]/.test(t), `${langue} ${i} : ${t}`);
  }
}
assert.equal(texteRecordBattu('60', { index: 1, nom: 'Arthur', place: 50 }, 'en')[1],
  'Your 60 m record didn’t survive. You’re #50 in the Top 500 now.'.replace(/’/g, "'"));

// Un pseudo interdit ne s'ecrit pas.
assert.equal(nomAffichableDansNotif('Axel ma pute'), null);
assert.equal(nomAffichableDansNotif('Anonyme'), null);
assert.equal(nomAffichableDansNotif(' Lubin '), 'Lubin');

// La place annoncee : celle d'avant, plus un.
const db = baseD1();
await db.exec(`
  CREATE TABLE scores (device_id TEXT, race_key TEXT, name TEXT, best_split_ms INTEGER,
    PRIMARY KEY (device_id, race_key));
  CREATE TABLE player_devices (name_key TEXT, device_id TEXT, added_at INTEGER);
`);
const ligne = (d, n, ms) => db.prepare(`INSERT OR REPLACE INTO scores VALUES (?, '60', ?, ?)`).bind(d, n, ms).run();
await ligne('a1', 'Rapide', 6500);
await ligne('a2', 'Moyen', 6900);
await ligne('a3', 'Lent', 7100);
await ligne('a4', 'Lubin', 7300);
for (const [k, d] of [['rapide', 'a1'], ['moyen', 'a2'], ['lent', 'a3'], ['lubin', 'a4']]) {
  await db.prepare(`INSERT INTO player_devices VALUES (?, ?, 1)`).bind(k, d).run();
}
// Lubin court en 6,80 s : il passe devant Lent (3e) et Moyen (2e).
await ligne('a4', 'Lubin', 6800);
const r = await recordsBattus(db, { epreuve: '60', deviceId: 'a4', ancien: 7300, ms: 6800 });
assert.equal(r.auteur, 'lubin');
assert.deepEqual(r.battus, [{ cle: 'moyen', place: 3 }, { cle: 'lent', place: 4 }]);

console.log('ok depassement-messages.test');
