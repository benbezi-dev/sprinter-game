// Les face-a-face (src/face-a-face.js). node worker/test/face-a-face.test.mjs
import assert from 'node:assert/strict';
import { baseD1 } from './d1-sqlite.mjs';
import worker from '../src/index.js';
import { bilans, beteNoire, victimeFavorite, tableau, faceAFace, TOUTES } from '../src/face-a-face.js';

const L = (lui, moi, issue, epreuve = '100') => ({ lui, moi, issue, epreuve });

// 1. Le calcul V/N/D, des deux cotes du duel.
const lignes = [
  L('moi', 'lubin', 'challenger'),        // je lance, je gagne
  L('lubin', 'moi', 'challenger'),        // il lance, il gagne : defaite
  L('lubin', 'moi', 'opponent'),          // il lance, je gagne
  L('moi', 'lubin', 'draw'),              // chronos egaux : nul
  L('moi', 'arthur', 'opponent', '200'),  // je lance, il gagne : defaite
  L('autre', 'tiers', 'challenger'),      // pas moi : ignore
  L('moi', 'anonyme', 'challenger'),      // contre un sans-nom : ignore
];
const b = bilans(lignes, 'moi');
assert.deepEqual(b.get('100').get('lubin'), { v: 2, n: 1, d: 1 });
assert.deepEqual(b.get('200').get('arthur'), { v: 0, n: 0, d: 1 });
assert.deepEqual(b.get(TOUTES).get('lubin'), { v: 2, n: 1, d: 1 });
assert.equal(b.get(TOUTES).size, 2);
assert.equal(b.get('100').has('anonyme'), false);
assert.equal(bilans([], 'moi').size, 0);

// 2. Bete noire et victime favorite, departages compris.
const adv = (o) => new Map(Object.entries(o));
// Le plus de defaites.
assert.equal(beteNoire(adv({ a: { v: 5, n: 0, d: 2 }, b: { v: 0, n: 0, d: 3 } })).cle, 'b');
// Egalite de defaites : le pire ratio V/D l'emporte.
assert.equal(beteNoire(adv({ a: { v: 4, n: 0, d: 3 }, b: { v: 1, n: 0, d: 3 } })).cle, 'b');
// Egalite parfaite : l'ordre alphabetique, stable.
assert.equal(beteNoire(adv({ zoe: { v: 1, n: 0, d: 2 }, ali: { v: 1, n: 0, d: 2 } })).cle, 'ali');
// Le plus de victoires.
assert.equal(victimeFavorite(adv({ a: { v: 3, n: 0, d: 0 }, b: { v: 4, n: 0, d: 4 } })).cle, 'b');
// Egalite de victoires : le meilleur ratio (sans defaite = imbattable).
assert.equal(victimeFavorite(adv({ a: { v: 3, n: 0, d: 1 }, b: { v: 3, n: 0, d: 0 } })).cle, 'b');
assert.equal(victimeFavorite(adv({ a: { v: 3, n: 0, d: 1 }, b: { v: 3, n: 0, d: 2 } })).cle, 'a');
// Les nuls ne font ni bete noire ni victime.
const nuls = adv({ a: { v: 0, n: 4, d: 0 } });
assert.equal(beteNoire(nuls), null);
assert.equal(victimeFavorite(nuls), null);
// 3. Cas limites : aucune defaite → pas de bete noire ; aucune victoire → pas de victime.
assert.equal(beteNoire(adv({ a: { v: 2, n: 1, d: 0 } })), null);
assert.equal(victimeFavorite(adv({ a: { v: 0, n: 1, d: 2 } })), null);
assert.equal(beteNoire(new Map()), null);
assert.equal(victimeFavorite(new Map()), null);
// Le tableau : les plus affrontes d'abord.
assert.deepEqual(tableau(adv({ a: { v: 1, n: 0, d: 0 }, b: { v: 1, n: 1, d: 1 } })).map(r => r.cle), ['b', 'a']);

// 4. Sur une vraie base : duel_results relu comme le classement le relit.
const db = baseD1();
const env = { DB: db };
const ctx = { waitUntil: () => {} };
const appel = async (chemin) => {
  const r = await worker.fetch(new Request('https://w.example' + chemin, { headers: { 'CF-Connecting-IP': '203.0.113.9' } }), env, ctx);
  return { status: r.status, json: await r.json() };
};
// Une premiere lecture cree les tables.
let r = await appel('/duels/face-a-face?name=Moi');
assert.equal(r.status, 200);
assert.deepEqual(r.json, { epreuves: [] });
const duel = (id, lui, moi, cms, oms, ep) => db.prepare(
  `INSERT INTO duel_results (challenge_id, opponent_key, opponent_name, challenger_key, challenger_ms, opponent_ms,
     outcome, epreuve, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
).bind(id, moi, moi, lui, cms, oms, oms < cms ? 'opponent' : oms > cms ? 'challenger' : 'draw', ep).run();
await duel('d1', 'moi', 'lubin', 10500, 10800, '100');   // victoire
await duel('d2', 'lubin', 'moi', 10400, 10600, '100');   // defaite
await duel('d3', 'lubin', 'moi', 10400, 10400, '100');   // chronos egaux : nul
await duel('d4', 'moi', 'arthur', 21500, 21000, '200');  // defaite
await duel('d5', 'arthur', 'moi', 21000, 20900, '200');  // victoire
await duel('d6', 'moi', 'axel ma pute', 21500, 21000, '200'); // defaite, nom interdit
await db.prepare(`INSERT INTO players (name_key, name, code, created_at) VALUES ('lubin', 'Lubin', 'X', 1)`).run()
  .catch(async () => {
    await db.exec(`CREATE TABLE players (name_key TEXT PRIMARY KEY, name TEXT, code TEXT, created_at INTEGER)`);
    await db.prepare(`INSERT INTO players VALUES ('lubin', 'Lubin', 'X', 1)`).run();
  });
r = await appel('/duels/face-a-face?name=Moi');
const parEp = Object.fromEntries(r.json.epreuves.map(e => [e.epreuve, e]));
assert.deepEqual(r.json.epreuves.map(e => e.epreuve), [TOUTES, '100', '200']);
assert.deepEqual(parEp['100'].bilan, { v: 1, n: 1, d: 1 });
assert.equal(parEp['100'].bete_noire.nom, 'Lubin');
assert.deepEqual({ v: parEp['100'].bete_noire.v, n: parEp['100'].bete_noire.n, d: parEp['100'].bete_noire.d }, { v: 1, n: 1, d: 1 });
assert.equal(parEp['100'].victime_favorite.nom, 'Lubin');
// 200 m : une defaite contre chacun ; le pire ratio est contre le nom interdit (0 V).
assert.equal(parEp['200'].bete_noire.nom, 'Joueur masqué');
assert.equal(parEp['200'].victime_favorite.nom, 'arthur');
assert.ok(!JSON.stringify(r.json).includes('pute'), 'un pseudo interdit ne fuit pas');
assert.deepEqual(parEp[TOUTES].bilan, { v: 2, n: 1, d: 3 });
// Un joueur sans duel : rien, proprement.
r = await appel('/duels/face-a-face?name=Personne');
assert.deepEqual(r.json, { epreuves: [] });
assert.deepEqual(await faceAFace(db, 'anonyme'), { epreuves: [] });

console.log('ok face-a-face.test');
