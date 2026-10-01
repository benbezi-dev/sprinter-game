// L'anti-abus de worker/src/limites.js, contre une vraie base D1 locale.
//
// Trois proprietes qu'on ne voit pas en jouant :
//
//   1. aucune adresse IP n'arrive dans la table, seulement une empreinte qui
//      change de secret en secret et de jour en jour ;
//   2. le compteur arrete toujours au meme seuil, et rouvre a la fenetre
//      suivante ;
//   3. la purge du cron efface les lignes expirees — dont les anciennes en
//      clair — sans rendre son quota a qui est en train d'etre arrete.
//
// Pas besoin du worker demarre : wrangler ouvre la base lui-meme, dans un
// dossier temporaire qui ne touche pas a l'etat local du worker.
//
//   node tools/limites-test.mjs

import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const WORKER = new URL('../worker/', import.meta.url);
const { getPlatformProxy } = createRequire(new URL('package.json', WORKER))('wrangler');
const { empreinteIp, sousLimite, purgerLimites, RATE_LIMITS } =
  await import(new URL('src/limites.js', WORKER));

const dossier = mkdtempSync(join(tmpdir(), 'limites-'));
const { env, dispose } = await getPlatformProxy({
  configPath: new URL('wrangler.toml', WORKER).pathname,
  persist: { path: dossier },
});
const db = env.DB;
await db.prepare('DROP TABLE IF EXISTS rate_limits').run();
let ok = 0; const vu = (m) => { ok++; console.log('ok', m); };

// 1. L'empreinte
const t0 = Date.parse('2026-10-01T12:00:00Z');
const a = await empreinteIp('203.0.113.7', 'secret-A', t0);
assert.match(a, /^[0-9a-f]{32}$/); vu('32 hex : ' + a);
assert.equal(a, await empreinteIp('203.0.113.7', 'secret-A', t0 + 3_600_000)); vu('stable dans la journee');
assert.notEqual(a, await empreinteIp('203.0.113.7', 'secret-A', t0 + 86_400_000)); vu('change le lendemain');
assert.notEqual(a, await empreinteIp('203.0.113.7', 'secret-B', t0)); vu('depend du secret');
assert.notEqual(a, await empreinteIp('203.0.113.8', 'secret-A', t0)); vu('depend de l adresse');
assert.match(await empreinteIp('203.0.113.7', undefined, t0), /^[0-9a-f]{32}$/); vu('sans secret : ne plante pas');

// 2. Le compteur : /test/entrer laisse passer 8 appels par minute
const max = RATE_LIMITS['/test/entrer'].max;
for (let i = 0; i < max; i++) assert.equal(await sousLimite(db, a, '/test/entrer', t0 + i), true);
assert.equal(await sousLimite(db, a, '/test/entrer', t0 + 100), false); vu(max + ' passent, le ' + (max + 1) + 'e est refuse');
assert.equal(await sousLimite(db, a, '/test/entrer', t0 + 60_000), true); vu('fenetre suivante : rouvert');

// 3. Rien en clair dans la table
const lignes = (await db.prepare('SELECT cle FROM rate_limits').all()).results;
assert.ok(lignes.every(l => !l.cle.includes('203.0.113'))); vu('aucune adresse dans la table : ' + JSON.stringify(lignes));

// 4. La purge : une vieille ligne en clair (comme en prod) et une ligne vivante
await db.prepare('INSERT INTO rate_limits VALUES (?, ?, 3)').bind('/duel/mot:198.51.100.9', t0 - 86_400_000).run();
const maintenant = t0 + 60_000 + 30_000;   // la ligne de a a 30 s : vivante
await sousLimite(db, 'bord', '/duel/mot', maintenant - 60_000);   // exactement 60 s : doit rester
const n = await purgerLimites(db, maintenant);
const reste = (await db.prepare('SELECT cle FROM rate_limits ORDER BY cle').all()).results.map(r => r.cle);
assert.equal(n, 1); assert.deepEqual(reste, ['/duel/mot:bord', '/test/entrer:' + a]);
vu('purge : 1 ligne effacee (l ancienne en clair), restent ' + JSON.stringify(reste));
assert.equal(await sousLimite(db, a, '/test/entrer', maintenant), true);
const c = await db.prepare('SELECT compte FROM rate_limits WHERE cle = ?').bind('/test/entrer:' + a).first();
assert.equal(c.compte, 2); vu('la ligne vivante garde son compte apres la purge (2)');
assert.equal(await purgerLimites(db, maintenant + 61_000), 2); vu('une minute plus tard, tout part');

await dispose();
rmSync(dossier, { recursive: true, force: true });
console.log('TOUT PASSE', ok);
