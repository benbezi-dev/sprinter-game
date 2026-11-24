// Les demandes de changement de pseudo (src/pseudo-demandes.js).
// node worker/test/pseudo-demandes.test.mjs
import assert from 'node:assert/strict';
import { baseD1 } from './d1-sqlite.mjs';
import {
  ensurePseudoTables, creerDemande, demandeDuJeton, trancherDemande, forcerChangement,
  etatPseudo, nomReserveParDemande, courrielDemande, empreinte, tirerJeton, PREFIXE_PROVISOIRE,
} from '../src/pseudo-demandes.js';

const JOUR = 86_400_000;
const T = Date.UTC(2026, 10, 24, 12);           // « maintenant » des tests
const env = {};                                   // reglages par defaut : 180 j, 30 j, 72 h

const db = baseD1();
await ensurePseudoTables(db);
await db.exec(`
  CREATE TABLE races (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id TEXT, name_key TEXT, name TEXT,
    race_key TEXT, time_ms INTEGER, mode TEXT, level_idx INTEGER, created_at INTEGER);
  CREATE TABLE champ_medailles (id INTEGER PRIMARY KEY, name_key TEXT, nom TEXT, place INTEGER);
  CREATE TABLE visits (day TEXT, device_id TEXT, hits INTEGER, last_at INTEGER, PRIMARY KEY (day, device_id));
`);
const joueur = (key, nom, creeLe, appareil) => db.batch([
  db.prepare(`INSERT INTO players (name_key, name, code, created_at) VALUES (?, ?, ?, ?)`)
    .bind(key, nom, 'C' + key.toUpperCase().slice(0, 5), creeLe),
  db.prepare(`INSERT INTO player_devices VALUES (?, ?, ?)`).bind(key, appareil, creeLe),
]);
const course = (key, quand) => db.prepare(
  `INSERT INTO races (name_key, name, race_key, time_ms, created_at) VALUES (?, ?, '100m', 10800, ?)`
).bind(key, key, quand).run();

await joueur('jules', 'Jules', T - 100 * JOUR, 'appareil-jules');   await course('jules', T - JOUR);
await joueur('lea', 'Lea', T - 100 * JOUR, 'appareil-lea');         await course('lea', T - JOUR);
await joueur('vieux', 'Vieux', T - 400 * JOUR, 'appareil-vieux');   await course('vieux', T - 300 * JOUR);
await joueur('actif', 'Actif', T - 400 * JOUR, 'appareil-actif');   await course('actif', T - 10 * JOUR);
await joueur('champion', 'Champion', T - 400 * JOUR, 'appareil-ch'); await course('champion', T - 300 * JOUR);
await db.prepare(`INSERT INTO champ_medailles (name_key, nom, place) VALUES ('champion', 'Champion', 1)`).run();
await joueur('fantome', 'Fantome', T - 40 * JOUR, 'appareil-fantome');  // jamais couru
await joueur('nouveau', 'Nouveau', T - 5 * JOUR, 'appareil-nouveau');   // jamais couru, recent
await joueur('revient', 'Revient', T - 40 * JOUR, 'appareil-revient');  // jamais couru... mais visite hier
await db.prepare(`INSERT INTO visits VALUES ('2026-11-23', 'appareil-revient', 3, ?)`).bind(T - JOUR).run();

const demander = (nom, appareil, demande, quand = T) =>
  creerDemande(db, env, { nom, deviceId: appareil, demande, pays: 'FR' }, quand);
const un = (sql, ...a) => db.sqlite.prepare(sql).get(...a);

// 1. Demande pour un pseudo libre, puis pour des pseudos inactifs ; refus pour
//    les actifs et les proteges.
const libre = await demander('Jules', 'appareil-jules', 'Flash');
assert.equal(libre.ok, true);
assert.equal(libre.demande.cible, null);
assert.match(libre.jeton, /^[0-9a-f]{64}$/);
// Le jeton ne vit qu'en empreinte.
const ligne = un(`SELECT * FROM pseudo_demandes WHERE id = ?`, libre.demande.id);
assert.equal(ligne.statut, 'PENDING');
assert.equal(ligne.jeton_hash, await empreinte(libre.jeton));
assert.ok(!JSON.stringify(ligne).includes(libre.jeton));
assert.equal(ligne.expire_le, T + 72 * 3_600_000);
// Le courriel porte les infos et les deux liens.
const mail = courrielDemande(env, libre.demande, 'https://w.example/pseudo/admin?t=' + libre.jeton);
assert.match(mail.texte, /Pseudo actuel : Jules/);
assert.match(mail.texte, /Pseudo demandé : Flash/);
assert.match(mail.texte, /LIBRE/);
assert.match(mail.texte, /action=confirmer/);
assert.match(mail.texte, /action=refuser/);
assert.equal(mail.a, 'contact@sprinter-game.com');
// Une seule demande a la fois, et le pseudo est reserve.
assert.equal((await demander('Jules', 'appareil-jules', 'Eclair')).code, 'REQUEST_PENDING');
assert.equal((await demander('Lea', 'appareil-lea', 'flash')).code, 'USERNAME_TAKEN');
assert.equal(await nomReserveParDemande(db, 'FLASH', T), true);
// Pas de demande au nom d'un autre, ni pour un pseudo interdit ou mal forme.
assert.equal((await demander('Jules', 'appareil-lea', 'Autre')).statut, 403);
assert.equal((await demander('Lea', 'appareil-lea', 'Grosse pute')).code, 'INVALID_USERNAME_PROFANITY');
assert.equal((await demander('Lea', 'appareil-lea', 'x')).code, 'INVALID_USERNAME');
assert.equal((await demander('Lea', 'appareil-lea', PREFIXE_PROVISOIRE + 'abc')).code, 'INVALID_USERNAME');
assert.equal((await demander('Lea', 'appareil-lea', 'lea')).code, 'SAME_USERNAME');
// Actif, protege par un palmares, trop recent, ou revenu jouer : pas repris.
assert.equal((await demander('Lea', 'appareil-lea', 'Actif')).code, 'USERNAME_TAKEN');
assert.equal((await demander('Lea', 'appareil-lea', 'Champion')).code, 'USERNAME_TAKEN');
assert.equal((await demander('Lea', 'appareil-lea', 'Nouveau')).code, 'USERNAME_TAKEN');
assert.equal((await demander('Lea', 'appareil-lea', 'Revient')).code, 'USERNAME_TAKEN');
// Inactif depuis plus de 180 jours : reclamable.
const reprise = await demander('Lea', 'appareil-lea', 'Vieux');
assert.equal(reprise.ok, true);
assert.equal(reprise.demande.cible, 'vieux');
assert.match(courrielDemande(env, reprise.demande, 'x?t=1').texte, /REPRIS sur un compte inactif/);

// 2. Jetons : invalide, expire, deja utilise.
assert.equal(await demandeDuJeton(db, tirerJeton(), T), null);
assert.equal(await demandeDuJeton(db, 'pas-un-jeton', T), null);
assert.equal((await trancherDemande(db, env, tirerJeton(), 'confirmer', T)).erreur !== undefined, true);
await joueur('tardif', 'Tardif', T - 100 * JOUR, 'appareil-tardif');
// (Dans le passe : l'horloge des tests ne doit jamais reculer.)
const D = T - 100 * 3_600_000;
const perime = await demander('Tardif', 'appareil-tardif', 'Bientot', D);
assert.ok(await demandeDuJeton(db, perime.jeton, D + 71 * 3_600_000));
assert.equal(await demandeDuJeton(db, perime.jeton, D + 73 * 3_600_000), null);
assert.equal(un(`SELECT statut FROM pseudo_demandes WHERE id = ?`, perime.demande.id).statut, 'EXPIRED');
assert.equal(await nomReserveParDemande(db, 'Bientot', D + 73 * 3_600_000), false);

// 3. Approbation atomique d'une reprise.
const ok = await trancherDemande(db, env, reprise.jeton, 'confirmer', T + 3_600_000);
assert.equal(ok.ok, true);
assert.equal(ok.statut, 'APPROVED');
const provisoire = ok.provisoire;
assert.match(provisoire, /^Player_[0-9a-f]{6}$/);
const pk = provisoire.toLowerCase();
// Le demandeur porte le pseudo, avec sa progression et son code.
assert.deepEqual({ ...un(`SELECT name, code FROM players WHERE name_key = 'vieux'`) },
  { name: 'Vieux', code: 'CLEA' });
assert.equal(un(`SELECT device_id FROM player_devices WHERE name_key = 'vieux'`).device_id, 'appareil-lea');
assert.equal(un(`SELECT count(*) c FROM races WHERE name_key = 'vieux'`).c, 1);
assert.equal(un(`SELECT created_at FROM races WHERE name_key = 'vieux'`).created_at, T - JOUR);
assert.equal(un(`SELECT count(*) c FROM players WHERE name_key = 'lea'`).c, 0);
// L'ancien porteur : renomme, marque, rien de perdu.
const ancien = un(`SELECT name, code, must_change_username m, ancien_nom FROM players WHERE name_key = ?`, pk);
assert.deepEqual({ ...ancien }, { name: provisoire, code: 'CVIEUX', m: 1, ancien_nom: 'Vieux' });
assert.equal(un(`SELECT device_id FROM player_devices WHERE name_key = ?`, pk).device_id, 'appareil-vieux');
assert.equal(un(`SELECT created_at FROM races WHERE name_key = ?`, pk).created_at, T - 300 * JOUR);
// La demande est close, le jeton brule, l'operation journalisee.
const close = un(`SELECT statut, jeton_hash, resolu_le FROM pseudo_demandes WHERE id = ?`, reprise.demande.id);
assert.deepEqual({ ...close }, { statut: 'APPROVED', jeton_hash: null, resolu_le: T + 3_600_000 });
assert.equal(un(`SELECT count(*) c FROM pseudo_journal WHERE demande_id = ?`, reprise.demande.id).c, 2);
assert.ok((await trancherDemande(db, env, reprise.jeton, 'confirmer', T + 2 * 3_600_000)).erreur);
assert.ok((await trancherDemande(db, env, reprise.jeton, 'refuser', T + 2 * 3_600_000)).erreur);

// Ce que les deux jeux apprennent en se rouvrant.
const pourLea = await etatPseudo(db, { nom: 'Lea', deviceId: 'appareil-lea', pays: 'FR' }, T + 2 * 3_600_000);
assert.equal(pourLea.nom, 'Vieux');
assert.equal(pourLea.a_changer, false);
assert.equal(pourLea.demande.statut, 'APPROVED');
const pourVieux = await etatPseudo(db, { nom: 'Vieux', deviceId: 'appareil-vieux', pays: 'FR' }, T + 2 * 3_600_000);
assert.deepEqual({ nom: pourVieux.nom, a_changer: pourVieux.a_changer, raison: pourVieux.raison, ancien: pourVieux.ancien },
  { nom: provisoire, a_changer: true, raison: 'libere', ancien: 'Vieux' });
// L'ancien porteur choisit un nouveau pseudo tout de suite, sans validation.
const choisi = await forcerChangement(db, env,
  { nom: provisoire, deviceId: 'appareil-vieux', nouveau: 'Revenant', pays: 'FR' }, T + 3 * 3_600_000);
assert.equal(choisi.ok, true);
assert.equal(un(`SELECT must_change_username m FROM players WHERE name_key = 'revenant'`).m, 0);
assert.equal(un(`SELECT created_at FROM races WHERE name_key = 'revenant'`).created_at, T - 300 * JOUR);
// Sans raison de changer, pas de changement force.
assert.equal((await forcerChangement(db, env,
  { nom: 'Revenant', deviceId: 'appareil-vieux', nouveau: 'Autre', pays: 'FR' }, T)).code, 'NO_CHANGE_REQUIRED');

// Le joueur inactif revient entre la demande et la confirmation : rien ne bouge.
const surFantome = await demander('Actif', 'appareil-actif', 'Fantome', T);
assert.equal(surFantome.demande.cible, 'fantome');
await course('fantome', T + 60_000);
const revenu = await trancherDemande(db, env, surFantome.jeton, 'confirmer', T + 120_000);
assert.ok(revenu.erreur);
assert.equal(un(`SELECT name FROM players WHERE name_key = 'fantome'`).name, 'Fantome');
assert.equal(un(`SELECT count(*) c FROM players WHERE name_key = 'actif'`).c, 1);
assert.equal(un(`SELECT statut FROM pseudo_demandes WHERE id = ?`, surFantome.demande.id).statut, 'REJECTED');

// 4. Refus : rien ne change, la reservation est levee.
const non = await trancherDemande(db, env, libre.jeton, 'refuser', T + 3_600_000);
assert.equal(non.statut, 'REJECTED');
assert.equal(un(`SELECT name FROM players WHERE name_key = 'jules'`).name, 'Jules');
assert.equal(un(`SELECT count(*) c FROM players WHERE name_key = 'flash'`).c, 0);
assert.equal(un(`SELECT count(*) c FROM races WHERE name_key = 'jules'`).c, 1);
assert.equal(await nomReserveParDemande(db, 'Flash', T + 3_600_000), false);
assert.equal(un(`SELECT jeton_hash FROM pseudo_demandes WHERE id = ?`, libre.demande.id).jeton_hash, null);
// Le joueur peut redemander.
assert.equal((await demander('Jules', 'appareil-jules', 'Flash', T + 2 * 3_600_000)).ok, true);

console.log('ok pseudo-demandes.test');
