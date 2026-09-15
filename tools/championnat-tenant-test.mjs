// LE CHAMPION EN TITRE, contre le vrai serveur.
//
// Ce harnais ne verifie pas le format d'une course — championnats-test.mjs s'en
// charge — mais les quatre regles du champion en titre, et surtout la seule
// qu'un test naif laisserait passer : l'etancheite.
//
//   1. qualification d'office pour la finale de l'edition suivante ;
//   2. la cinematique d'entree en lice (l'annonce `boss`) ;
//   3. la perte du titre en cas de defaite en finale ;
//   4. l'etancheite : les privileges ne valent que pour le couple
//      (echelon, zone) exactement remporte.
//
// Plus l'exception d'activite : un champion qui n'a plus joue depuis son sacre
// repart sans rien.
//
//   node tools/championnat-peupler.mjs                  (une fois)
//   node tools/championnat-tenant-test.mjs
//
// Le harnais vide les editions lui-meme au demarrage : il a besoin d'une base
// sans titre en cours, sinon le premier sacre entre en concurrence avec un
// tenant venu d'un essai precedent et les assertions parlent d'un autre monde.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const WORKER = join(RACINE, 'worker');
const BASE_D1 = 'sprinter-leaderboard-test';

const B = process.env.BASE || 'http://127.0.0.1:8788';
const CLE_ADMIN = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';
const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': CLE_ADMIN };
const _acces = await fetch(B + '/test/admin/creer', {
  method: 'POST', headers: ADMIN, body: JSON.stringify({ nom: 'harnais-tenant' }),
}).then(r => r.json());
const H = { 'X-Sprinter-Test': _acces.code, 'X-Sprinter-Admin': CLE_ADMIN };

const post = (u, b) => fetch(B + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...H },
  body: JSON.stringify(b),
}).then(r => r.json());
const get = u => fetch(B + u, { headers: H }).then(r => r.json());

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};
const titre = t => console.log(`\n══ ${t} ${'═'.repeat(Math.max(0, 58 - t.length))}`);

/** Le seul geste qui passe par la base : simuler un duel joue. */
function sqlLocal(lignes) {
  const f = join(mkdtempSync(join(tmpdir(), 'tenant-')), 'x.sql');
  writeFileSync(f, lignes.join('\n'));
  execFileSync('npx', ['wrangler', 'd1', 'execute', BASE_D1, '--local', '--file', f],
    { cwd: WORKER, stdio: ['ignore', 'ignore', 'ignore'] });
}

/**
 * Rejouer un duel classe, vu de la base.
 *
 * `updated_at` est la colonne que toute selection lit deja, et la seule chose
 * qu'un duel classe change de facon observable ici. La poser a maintenant est
 * donc exactement equivalent a « ce joueur vient de jouer », sans avoir a
 * monter une salle de duel a deux clients pour le prouver.
 */
const rejouer = cle => sqlLocal([
  `UPDATE duel_players SET updated_at = ${Date.now()} WHERE name_key = '${cle.replace(/'/g, "''")}';`,
]);

let graine = 90210;
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/**
 * Deroule une edition entiere. `cancre` recoit le pire chrono de chaque course
 * ou il figure : c'est ce qui permet de verifier qu'un tenant passe MALGRE ses
 * resultats, et non grace a eux.
 */
async function courir(id, { cancre = null, favori = null } = {}) {
  const reveals = [];
  let sacre = null;
  for (let garde = 0; garde < 6; garde++) {
    const etat = await get('/champ/edition/' + id);
    if (etat.error) throw new Error('edition ' + id + ' : ' + etat.error);
    if (etat.etat === 'terminee') break;

    const enCours = etat.partants.filter(p => p.phase === etat.phase && !p.sorti_en);
    for (let c = 1; c <= etat.courses; c++) {
      const dedans = enCours.filter(p => p.course === c);
      if (!dedans.length) continue;
      const chronos = dedans.map(p => ({
        cle: p.name_key,
        ms: p.name_key === cancre
          // Volontairement derriere tout le monde, et de loin : aucun
          // departage ne peut le sauver par accident.
          ? 12000 + Math.round(hasard() * 100)
          : p.name_key === favori
            // Et devant tout le monde, de la meme facon : c'est ce qui permet
            // de verifier qu'un tenant qui se qualifie tout seul ne coute
            // aucune place a personne.
            ? 9000 + Math.round(hasard() * 20)
            : Math.round(9400 + (p.rang_duel || 16) * 18 + (hasard() - 0.5) * 200),
      }));
      const r = await post('/champ/course', { edition: id, phase: etat.phase, course: c, chronos });
      if (r.error) throw new Error('course : ' + r.error);
    }
    const cl = await post('/champ/cloturer', { edition: id });
    if (cl.error) throw new Error('cloturer : ' + cl.error);
    if (cl.finale) sacre = cl;
    else reveals.push(cl);
  }
  return { reveals, sacre };
}

/** Les annonces d'une edition, par type. */
async function annonces(id) {
  const out = [];
  let curseur = 0;
  for (let page = 0; page < 40; page++) {
    const f = await get('/champ/direct?depuis=' + curseur + '&limite=200');
    if (!f || !f.annonces || !f.annonces.length) break;
    out.push(...f.annonces.filter(a => a.edition === id));
    if (f.curseur === curseur) break;
    curseur = f.curseur;
  }
  return out;
}

const SAMEDI = n => Date.UTC(2026, 8, 5) + n * 7 * 24 * 3600 * 1000;

/* ═══════════════════════════════════════════════════════════════════════ */

titre('REMISE A ZERO');
sqlLocal(['champ_resultats', 'champ_partants', 'champ_selection', 'champ_annonces',
          'champ_medailles', 'champ_titres', 'champ_editions']
  .map(t => `DELETE FROM ${t};`));
console.log('   Editions, titres et annonces vides.');

/* ---------------------------------------------------------------- edition 1 */
titre('EDITION 1 — il n y a pas encore de tenant');
const e1 = await post('/champ/ouvrir', { pays: 'FR', debut: SAMEDI(0) });
if (e1.error) { console.log('   ', e1); process.exit(1); }
ok('aucun tenant a la premiere edition', e1.tenant === null,
   JSON.stringify(e1.tenant));
const a1 = await annonces(e1.edition);
ok('aucune annonce `boss`', !a1.some(a => a.type === 'boss'));

const r1 = await courir(e1.edition);
const CHAMPION = r1.sacre.champion;
const etat1 = await get('/champ/edition/' + e1.edition);
const CLE = etat1.partants.find(p => p.nom === CHAMPION).name_key;
console.log(`   Champion : ${CHAMPION}  (${CLE})`);
const t1 = await get('/champ/titres?name=' + encodeURIComponent(CLE));
ok('le titre est pose', t1.titres.length === 1 && t1.titres[0].zone === 'FR',
   JSON.stringify(t1.titres));
ok('aucun detrone au premier sacre', r1.sacre.detrone === null,
   JSON.stringify(r1.sacre.detrone));

/* ---------------------------------------------------------------- edition 2 */
titre('EDITION 2 — champion inactif depuis son sacre');
const e2 = await post('/champ/ouvrir', { pays: 'FR', debut: SAMEDI(1) });
if (e2.error) { console.log('   ', e2); process.exit(1); }
ok('le tenant est ecarte', e2.tenant === null && !!e2.tenantEcarte,
   'tenant=' + JSON.stringify(e2.tenant) + ' ecarte=' + JSON.stringify(e2.tenantEcarte));
ok('la raison est dite', e2.tenantEcarte && e2.tenantEcarte.raison === 'inactif depuis le sacre');
const a2 = await annonces(e2.edition);
ok('aucune cinematique pour un tenant ecarte', !a2.some(a => a.type === 'boss'));
ok('mais le fil le dit', a2.some(a => a.type === 'tenant-ecarte'));
const etat2 = await get('/champ/edition/' + e2.edition);
ok('aucun partant marque tenant', !etat2.partants.some(p => p.tenant));
await courir(e2.edition);

/* ---------------------------------------------------------------- edition 3 */
titre('EDITION 3 — le champion a rejoue : il est le tenant');
// Le titre de l'edition 1 a ete eteint par le sacre de l'edition 2 : on repart
// donc du champion de l'edition 2, qui est le porteur actuel.
const etat2b = await get('/champ/edition/' + e2.edition);
const CHAMP2 = etat2b.champion;
const CLE2 = etat2b.partants.find(p => p.nom === CHAMP2).name_key;
console.log(`   Tenant attendu : ${CHAMP2}  (${CLE2})`);
rejouer(CLE2);

const e3 = await post('/champ/ouvrir', { pays: 'FR', debut: SAMEDI(2) });
if (e3.error) { console.log('   ', e3); process.exit(1); }
ok('le tenant est reconnu', !!e3.tenant && e3.tenant.cle === CLE2,
   JSON.stringify(e3.tenant));
ok('il est entre d office', e3.doffice === 1, 'doffice=' + e3.doffice);
ok('la grille fait toujours 32', e3.partants === 32, 'partants=' + e3.partants);
// L'archive de la barre ne depasse jamais son plafond declare.
//
// On verifie le PLAFOND et non la valeur exacte : le nombre de suivants
// disponibles depend de la profondeur du pays, pas de la regle. La base de test
// compte 38 Francais classes, donc 38 - 32 = 6 suivants a archiver, et il n'y a
// pas de huitieme a garder. L'assertion « exactement 8 » supposait un pays de
// plus de quarante joueurs — elle testait le peuplement, pas le code.
//
// Le vrai risque etait l'inverse, et c'est ce plafond qui le tient : en versant
// le tenant sans baisser la limite de lecture, la selection lisait un rang de
// plus qu'elle n'en declare — neuf suivants dans une table qui existe pour
// repondre a qui reclame sa place.
ok('l archive de la barre ne depasse pas son plafond',
   e3.suivants >= 1 && e3.suivants <= 8, 'suivants=' + e3.suivants);

const a3 = await annonces(e3.edition);
const boss = a3.find(a => a.type === 'boss');
ok('la cinematique est declenchee', !!boss);
ok('elle nomme la mise en scene', boss && boss.donnees.cinematique === 'boss',
   boss && JSON.stringify(boss.donnees.cinematique));
ok('elle porte le libelle du titre', boss && /Champion de France/.test(boss.donnees.libelle || ''),
   boss && boss.donnees.libelle);
ok('elle porte sa serie et son couloir', boss && boss.donnees.course >= 1 && boss.donnees.rang >= 1,
   boss && `course=${boss.donnees.course} rang=${boss.donnees.rang}`);

const etat3 = await get('/champ/edition/' + e3.edition);
ok('un seul partant est marque tenant',
   etat3.partants.filter(p => p.tenant).length === 1);
ok('l etat publie le tenant', !!etat3.tenant && etat3.tenant.name_key === CLE2,
   JSON.stringify(etat3.tenant));

/* ------------------------------------------------ il passe malgre ses chronos */
titre('EDITION 3 — dernier de chaque course, et pourtant en finale');
const r3 = await courir(e3.edition, { cancre: CLE2 });

const revSeries = r3.reveals.find(r => r.suivante === 'demies');
const revDemies = r3.reveals.find(r => r.suivante === 'finale');

const dofficeSeries = revSeries.repeches.filter(r => r.doffice);
ok('series : 8 repeches en tout', revSeries.repeches.length === 8,
   'n=' + revSeries.repeches.length);
ok('series : exactement un verse d office', dofficeSeries.length === 1,
   JSON.stringify(dofficeSeries.map(r => r.nom)));
ok('series : c est bien le tenant', dofficeSeries[0] && dofficeSeries[0].nom === CHAMP2,
   dofficeSeries[0] && dofficeSeries[0].nom);
ok('series : 7 repeches au chrono, un couloir cede',
   revSeries.repeches.filter(r => !r.doffice).length === 7);

const dofficeDemies = revDemies.repeches.filter(r => r.doffice);
ok('demies : 4 repeches en tout', revDemies.repeches.length === 4,
   'n=' + revDemies.repeches.length);
ok('demies : un seul d office, le tenant',
   dofficeDemies.length === 1 && dofficeDemies[0].nom === CHAMP2);
ok('demies : 3 repeches au chrono — le repechage passe de 4 a 3',
   revDemies.repeches.filter(r => !r.doffice).length === 3);

const etat3b = await get('/champ/edition/' + e3.edition);
const finale = etat3b.resultats.filter(r => r.phase === 'finale');
ok('la finale a huit couloirs, pas neuf', finale.length === 8, 'n=' + finale.length);
ok('le tenant y a couru', finale.some(r => r.name_key === CLE2));
ok('il n a jamais ete elimine',
   !etat3b.partants.find(p => p.name_key === CLE2).sorti_en);

/* -------------------------------------------------------- il perd son titre */
titre('EDITION 3 — il perd la finale, il perd le titre');
ok('un autre est sacre', r3.sacre.champion !== CHAMP2, r3.sacre.champion);
ok('le detrone est nomme', r3.sacre.detrone && r3.sacre.detrone.cle === CLE2,
   JSON.stringify(r3.sacre.detrone));
ok('et il avait bien couru la finale', r3.sacre.detrone && r3.sacre.detrone.en_finale === true);
const tApres = await get('/champ/titres?name=' + encodeURIComponent(CLE2));
ok('son titre ne lui est plus rendu', tApres.titres.length === 0,
   JSON.stringify(tApres.titres));
const etat3c = await get('/champ/edition/' + e3.edition);
const t3 = await get('/champ/titres?name=' + encodeURIComponent(
  etat3c.partants.find(p => p.nom === etat3c.champion).name_key));
ok('le nouveau champion porte le titre', t3.titres.length === 1 && t3.titres[0].zone === 'FR');

/* ---------------------------------------------------------------- edition 4 */
titre('EDITION 4 — le tenant se qualifie au merite, et conserve son titre');
// Le porteur du titre est desormais le champion de l'edition 3. On le
// reactive, puis on le fait courir devant tout le monde : son passe-droit ne
// doit alors rien couter a personne.
const CLE4 = etat3c.partants.find(p => p.nom === etat3c.champion).name_key;
rejouer(CLE4);
const e4 = await post('/champ/ouvrir', { pays: 'FR', debut: SAMEDI(3) });
if (e4.error) { console.log('   ', e4); process.exit(1); }
ok('le nouveau champion est le tenant', !!e4.tenant && e4.tenant.cle === CLE4,
   JSON.stringify(e4.tenant));

const r4 = await courir(e4.edition, { favori: CLE4 });
const rev4series = r4.reveals.find(r => r.suivante === 'demies');
const rev4demies = r4.reveals.find(r => r.suivante === 'finale');

// LE POINT DE CE SCENARIO. Un tenant premier de sa course passe par la porte
// que tout le monde franchit : il n'apparait pas dans les repeches, et le
// repechage garde ses huit puis ses quatre places entieres. Ceder un couloir a
// chaque fois qu'un tenant est engage aurait puni sept joueurs pour un
// privilege qui n'a pas servi — c'est le defaut que ces quatre assertions
// tiennent fermé.
ok('series : aucun verse d office quand il gagne',
   rev4series.repeches.every(r => !r.doffice),
   JSON.stringify(rev4series.repeches.filter(r => r.doffice).map(r => r.nom)));
ok('series : le repechage garde ses 8 places',
   rev4series.repeches.length === 8, 'n=' + rev4series.repeches.length);
ok('demies : aucun verse d office non plus',
   rev4demies.repeches.every(r => !r.doffice));
ok('demies : le repechage garde ses 4 places',
   rev4demies.repeches.length === 4, 'n=' + rev4demies.repeches.length);
ok('il est qualifie direct, pas repeche',
   rev4series.directs.some(r => r.nom === e4.tenant.nom)
   && rev4demies.directs.some(r => r.nom === e4.tenant.nom));

ok('il gagne la finale', r4.sacre.champion === e4.tenant.nom, r4.sacre.champion);
ok('le titre est conserve', r4.sacre.titre_conserve === true,
   JSON.stringify(r4.sacre.titre_conserve));
ok('personne n est detrone', r4.sacre.detrone === null,
   JSON.stringify(r4.sacre.detrone));

// Un titre conserve n'est pas un titre prolonge : l'ancienne ligne s'eteint et
// une neuve s'ouvre, avec une echeance neuve. Un seul titre vivant par couple
// (echelon, zone), toujours.
const t4 = await get('/champ/titres?name=' + encodeURIComponent(CLE4));
ok('il ne porte qu UN titre, pas deux', t4.titres.length === 1,
   JSON.stringify(t4.titres.map(t => t.sacre_le)));
ok('et l echeance est celle du nouveau sacre',
   t4.titres[0] && t4.titres[0].sacre_le >= r4.sacre.expire_le - 100 * 24 * 3600 * 1000);

/* --------------------------------------------------------------- etancheite */
titre('ETANCHEITE — le titre ne vaut que pour son couple (echelon, zone)');
// Le porteur du titre francais a ce stade est le champion de l'edition 4.

// a) une autre ZONE, meme echelon.
const es = await post('/champ/ouvrir', { pays: 'ES', debut: SAMEDI(4) });
if (es.error) { console.log('   ES :', es); process.exit(1); }
ok('champion de France : aucun privilege en Espagne', es.tenant === null,
   JSON.stringify(es.tenant));
const aEs = await annonces(es.edition);
ok('aucune cinematique en Espagne', !aEs.some(a => a.type === 'boss'));
const etatEs = await get('/champ/edition/' + es.edition);
ok('aucun partant tenant en Espagne', !etatEs.partants.some(p => p.tenant));
await courir(es.edition);

// b) un autre ECHELON. Le champion national y entre d'office — c'est la regle
//    d'entree, anterieure et distincte — mais sans titre a defendre.
const eu = await post('/champ/ouvrir', { echelon: 'continental', zone: 'EU', debut: SAMEDI(5) });
if (eu.error) { console.log('   EU :', eu); process.exit(1); }
ok('le continental s ouvre', !eu.error, JSON.stringify(eu.error));
ok('des champions nationaux y entrent d office', eu.doffice >= 2, 'doffice=' + eu.doffice);
ok('mais aucun tenant : personne ne detient ce titre-la', eu.tenant === null,
   JSON.stringify(eu.tenant));
const aEu = await annonces(eu.edition);
ok('aucune cinematique au continental', !aEu.some(a => a.type === 'boss'));
const etatEu = await get('/champ/edition/' + eu.edition);
ok('aucun partant tenant au continental', !etatEu.partants.some(p => p.tenant));

titre(echecs ? `${echecs} ECHEC(S)` : 'TOUT PASSE');
process.exit(echecs ? 1 : 0);
