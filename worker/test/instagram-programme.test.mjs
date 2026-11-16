// Essais des publications programmees : node --test worker/test/
// Une vraie base SQLite (celle de Node) derriere une imitation de l'API D1,
// et des doublures a la place de Meta : rien ne part sur le compte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  programmer, listerProgrammes, annuler, relancer, publierLesProgrammes,
  RETARD_MAX_MS, AVANCE_VIDEO_MS,
} from '../src/instagram-programme.js';

function baseD1() {
  const s = new DatabaseSync(':memory:');
  const prepare = sql => {
    let params = [];
    const st = {
      bind: (...p) => { params = p.map(v => (v === undefined ? null : v)); return st; },
      run: async () => ({ meta: { changes: Number(s.prepare(sql).run(...params).changes) } }),
      first: async () => s.prepare(sql).get(...params) ?? null,
      all: async () => ({ results: s.prepare(sql).all(...params) }),
    };
    return st;
  };
  return { prepare, batch: async l => Promise.all(l.map(x => x.run())) };
}

function doublures(o = {}) {
  const j = { images: [], conteneurs: [], marques: [], depots: [], oublies: [] };
  return {
    journal: j,
    pret: () => o.pret !== false,
    deposer: async jpeg => { j.depots.push(jpeg); return 'a'.repeat(32); },
    oublier: async id => { j.oublies.push(id); },
    publierImage: async x => { j.images.push(x); return o.image || { ok: true, publication: '17', lien: 'https://instagram.com/p/x' }; },
    etatConteneur: async () => o.etat || { ok: true, etat: 'FINISHED' },
    publierConteneur: async c => { j.conteneurs.push(c); return o.conteneur || { ok: true, publication: '18', lien: null }; },
    marquer: async id => { j.marques.push(id); },
  };
}

const T0 = Date.UTC(2026, 10, 16, 18, 0);
const H = 3600 * 1000;
const image = { format: 'story', image: 'QUJD', origine: 'https://w.example', titre: 'Finale 100 m' };

test('une image part a son heure, pas avant, et une seule fois', async () => {
  const db = baseD1(), d = doublures();
  const p = await programmer(db, { ...image, quand: T0 + 2 * H, moment: 42 }, T0);
  assert.equal(p.ok, true);

  let b = await publierLesProgrammes(db, d, T0 + H);
  assert.equal(b.publiees.length, 0);
  assert.equal(d.journal.images.length, 0);

  b = await publierLesProgrammes(db, d, T0 + 2 * H + 60000);
  assert.deepEqual(b.publiees, [p.id]);
  assert.equal(d.journal.images[0].adresseImage, `https://w.example/img/${'a'.repeat(32)}.jpg`);
  assert.equal(d.journal.images[0].format, 'story');
  assert.deepEqual(d.journal.oublies, ['a'.repeat(32)]);
  assert.deepEqual(d.journal.marques, [42]);

  b = await publierLesProgrammes(db, d, T0 + 2 * H + 5 * 60000);
  assert.equal(b.publiees.length, 0);
  assert.equal(d.journal.images.length, 1, 'pas de second envoi');

  const [l] = await listerProgrammes(db);
  assert.equal(l.etat, 'publie');
  assert.equal(l.lien, 'https://instagram.com/p/x');
  assert.equal('jpeg' in l, false, 'la liste ne transporte pas les images');
});

test('un refus de Meta passe en echec, sans nouvel essai, et se relance a la main', async () => {
  const db = baseD1();
  const d = doublures({ image: { ok: false, etape: 'publication', erreur: 'boom', http: 500 } });
  const p = await programmer(db, { ...image, format: 'fil', quand: T0 }, T0);
  await publierLesProgrammes(db, d, T0);
  let [l] = await listerProgrammes(db);
  assert.equal(l.etat, 'echec');
  assert.match(l.erreur, /publication : boom/);
  assert.match(l.erreur, /Meta a pu publier/);

  await publierLesProgrammes(db, d, T0 + 10 * 60000);
  assert.equal(d.journal.images.length, 1, 'aucun essai automatique');

  assert.equal((await relancer(db, p.id, null, T0 + 20 * 60000)).ok, true);
  const d2 = doublures();
  const b = await publierLesProgrammes(db, d2, T0 + 20 * 60000);
  assert.deepEqual(b.publiees, [p.id]);
});

test('une video attend que Meta ait fini, puis publie le conteneur', async () => {
  const db = baseD1();
  const p = await programmer(db, { format: 'reel', creation: '999', quand: T0 }, T0);
  assert.equal(p.ok, true);
  let d = doublures({ etat: { ok: true, etat: 'IN_PROGRESS' } });
  let b = await publierLesProgrammes(db, d, T0);
  assert.deepEqual(b.attente, [p.id]);
  assert.equal((await listerProgrammes(db))[0].etat, 'attente');

  d = doublures();
  b = await publierLesProgrammes(db, d, T0 + 5 * 60000);
  assert.deepEqual(d.journal.conteneurs, ['999']);
  assert.deepEqual(b.publiees, [p.id]);
});

test('une video refusee par Meta passe en echec', async () => {
  const db = baseD1();
  await programmer(db, { format: 'reel', creation: '999', quand: T0 }, T0);
  const d = doublures({ etat: { ok: true, etat: 'ERROR', detail: '2207026' } });
  await publierLesProgrammes(db, d, T0);
  const [l] = await listerProgrammes(db);
  assert.equal(l.etat, 'echec');
  assert.match(l.erreur, /2207026/);
  assert.equal(d.journal.conteneurs.length, 0);
});

test('les bornes de saisie', async () => {
  const db = baseD1();
  assert.match((await programmer(db, { ...image, quand: T0 - H }, T0)).erreur, /deja passee/);
  assert.match((await programmer(db, { format: 'reel', creation: '1', quand: T0 + AVANCE_VIDEO_MS + 1 }, T0)).erreur, /23 h/);
  assert.match((await programmer(db, { format: 'reel', quand: T0 }, T0)).erreur, /conteneur/);
  assert.match((await programmer(db, { ...image, image: 'A'.repeat(1300 * 1024), quand: T0 }, T0)).erreur, /lourde/);
  assert.match((await programmer(db, { ...image, format: 'tiktok', quand: T0 }, T0)).erreur, /format/);
  assert.match((await programmer(db, { ...image, origine: 'http://x', quand: T0 }, T0)).erreur, /origine/);
  assert.equal((await programmer(db, { ...image, quand: T0 - 5 * 60000 }, T0)).ok, true, 'quelques minutes de retard passent');
});

test('trop en retard : on n envoie plus', async () => {
  const db = baseD1(), d = doublures();
  await programmer(db, { ...image, quand: T0 }, T0);
  const b = await publierLesProgrammes(db, d, T0 + RETARD_MAX_MS + 60000);
  assert.equal(b.echecs.length, 1);
  assert.equal(d.journal.images.length, 0);
  assert.match((await listerProgrammes(db))[0].erreur, /retard/);
});

test('un envoi interrompu passe en echec, pas en attente', async () => {
  const db = baseD1();
  const p = await programmer(db, { ...image, quand: T0 }, T0);
  // Le Worker meurt pendant l'envoi : la ligne reste « en_cours ».
  const d = doublures();
  d.publierImage = () => new Promise(() => {});
  publierLesProgrammes(db, d, T0);
  await new Promise(r => setTimeout(r, 50));
  assert.equal((await listerProgrammes(db))[0].etat, 'en_cours');

  const d2 = doublures();
  await publierLesProgrammes(db, d2, T0 + 20 * 60000);
  const [l] = await listerProgrammes(db);
  assert.equal(l.id, p.id);
  assert.equal(l.etat, 'echec');
  assert.match(l.erreur, /interrompu/);
  assert.equal(d2.journal.images.length, 0);
});

test('annuler retire ce qui attend ; ce qui est parti ne s annule pas', async () => {
  const db = baseD1(), d = doublures();
  const a = await programmer(db, { ...image, quand: T0 + H }, T0);
  const b = await programmer(db, { ...image, quand: T0 }, T0);
  assert.equal(await annuler(db, a.id, T0), true);
  await publierLesProgrammes(db, d, T0 + 2 * H);
  assert.equal(d.journal.images.length, 1);
  assert.equal(await annuler(db, b.id, T0 + 2 * H), false);
});

test('sans jeton, ce qui est du passe en echec avec la raison', async () => {
  const db = baseD1(), d = doublures({ pret: false });
  await programmer(db, { ...image, quand: T0 }, T0);
  await publierLesProgrammes(db, d, T0);
  assert.match((await listerProgrammes(db))[0].erreur, /IG_JETON/);
});

test('trois envois au plus par passage, dans l ordre des heures', async () => {
  const db = baseD1(), d = doublures();
  for (let i = 4; i >= 0; i--) await programmer(db, { ...image, titre: 't' + i, quand: T0 + i * 60000 }, T0);
  const b = await publierLesProgrammes(db, d, T0 + H);
  assert.equal(b.publiees.length, 3);
  const b2 = await publierLesProgrammes(db, d, T0 + H + 5 * 60000);
  assert.equal(b2.publiees.length, 2);
});
