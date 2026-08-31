// Le controle d'acces a la version de test, contre le vrai serveur.
//
// Ce qu'on cherche a prendre en defaut n'est pas l'ecran de saisie — il se voit
// — mais les trois proprietes qu'on ne peut verifier qu'ici :
//
//   1. sans code, les modes reserves restent fermes ;
//   2. avec un code, ils s'ouvrent, et les ecritures partent dans la base de
//      test — jamais dans celle de production ;
//   3. une revocation prend effet tout de suite, sans jeton qui survivrait.

const B = 'http://127.0.0.1:8788';
const CLE = 'cle-de-test-locale-uniquement';

const post = (u, b, h = {}) => fetch(B + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...h },
  body: JSON.stringify(b || {}),
}).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const get = (u, h = {}) => fetch(B + u, { headers: h })
  .then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));

const admin = { 'X-Sprinter-Admin': CLE };
let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  ACCES A LA VERSION DE TEST                                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// ------------------------------------------------------------ sans code
console.log('\n── SANS CODE ────────────────────────────────────────────────');
const relaisFerme = await get('/relay/ranking');
ok('le relais est ferme', relaisFerme.statut === 403, `HTTP ${relaisFerme.statut}`);
const champFerme = await get('/champ/pays');
ok('les championnats sont fermes', champFerme.statut === 403, `HTTP ${champFerme.statut}`);
const duelsOuverts = await get('/duels');
ok('le classement des duels reste public', duelsOuverts.statut === 200);

const faux = await post('/test/entrer', { code: 'ZZZZZZ' });
ok('un code invente est refuse', faux.statut === 403);

// -------------------------------------------------------- administration
console.log('\n── ADMINISTRATION ───────────────────────────────────────────');
const sansCle = await get('/test/admin/liste');
ok('sans la cle, l administration est fermee', sansCle.statut === 403);

const cree = await post('/test/admin/creer', { nom: 'Bakary' }, admin);
ok('un acces se cree', cree.statut === 200 && !!cree.corps.code,
   JSON.stringify(cree.corps));
const CODE = cree.corps.code;
console.log(`   code delivre : ${CODE} (${cree.corps.nom})`);

const cree2 = await post('/test/admin/creer', { nom: 'Invite' }, admin);
const CODE2 = cree2.corps.code;
ok('deux acces ont des codes distincts', CODE !== CODE2);

// -------------------------------------------------------------- avec code
console.log('\n── AVEC UN CODE VALIDE ──────────────────────────────────────');
const entree = await post('/test/entrer', { code: CODE });
ok('le code ouvre', entree.statut === 200 && entree.corps.ok === true);
ok('le serveur renvoie a qui il appartient', entree.corps.nom === 'Bakary');

const h = { 'X-Sprinter-Test': CODE };
const relais = await get('/relay/ranking', h);
ok('le relais s ouvre', relais.statut === 200, `HTTP ${relais.statut}`);
const champ = await get('/champ/pays', h);
ok('les championnats s ouvrent', champ.statut === 200, `HTTP ${champ.statut}`);

// Le code peut aussi voyager dans l'URL : les WebSockets n'ont pas d'en-tetes.
const parUrl = await get('/relay/ranking?acces=' + CODE);
ok('le code marche aussi dans l URL', parUrl.statut === 200, `HTTP ${parUrl.statut}`);

// ------------------------------------------------------ le role organisateur
//
// Un code d'acces ouvre le canal de test. Il n'ouvre pas pour autant le
// calendrier des championnats : ouvrir une edition ou clore une phase sont des
// actes irreversibles, visibles par tous ceux qui y courent. Ils demandent un
// role en plus, qui se donne et se retire sans toucher a l'acces lui-meme.
console.log('\n── LE ROLE D ORGANISATEUR ───────────────────────────────────');
const debutSamedi = Date.UTC(2027, 0, 2);
const sansRole = await post('/champ/ouvrir', { pays: 'FR', debut: debutSamedi }, h);
ok('sans role, ouvrir un championnat est refuse', sansRole.statut === 403,
   `HTTP ${sansRole.statut} ${JSON.stringify(sansRole.corps).slice(0, 60)}`);
const cycleSansRole = await post('/champ/cycle', { debut: debutSamedi }, h);
ok('sans role, ouvrir un cycle est refuse', cycleSansRole.statut === 403,
   `HTTP ${cycleSansRole.statut}`);
const cloreSansRole = await post('/champ/cloturer', { edition: 'ZZZZZZZZ' }, h);
ok('sans role, cloturer une phase est refuse', cloreSansRole.statut === 403,
   `HTTP ${cloreSansRole.statut}`);
const salonSansRole = await get('/champ/salon', h);
ok('sans role, le salon reste ferme', salonSansRole.statut === 403,
   `HTTP ${salonSansRole.statut}`);
const lireSansRole = await get('/champ/pays', h);
ok('la lecture ordinaire, elle, reste ouverte', lireSansRole.statut === 200,
   `HTTP ${lireSansRole.statut}`);

const donne = await post('/test/admin/role', { code: CODE, role: 'organisateur' }, admin);
ok('le role se donne sous cle d administration', donne.statut === 200,
   JSON.stringify(donne.corps));
const roleSansCle = await post('/test/admin/role', { code: CODE2, role: 'organisateur' });
ok('sans la cle, le role ne se donne pas', roleSansCle.statut === 403);

const avecRole = await post('/champ/ouvrir', { pays: 'FR', debut: debutSamedi }, h);
// Le pays peut n'avoir personne sur cette base : ce qui se verifie ici est le
// passage de la porte, pas le contenu de la grille. Un 400 « pays trop petit »
// est donc un succes — c'est la regle du sport qui repond, plus la porte.
ok('avec le role, la porte s ouvre', avecRole.statut !== 403,
   `HTTP ${avecRole.statut} ${JSON.stringify(avecRole.corps).slice(0, 70)}`);
const salonAvecRole = await get('/champ/salon', h);
ok('le salon s ouvre a l organisateur', salonAvecRole.statut === 200,
   `HTTP ${salonAvecRole.statut}`);
const entreeRole = await post('/test/entrer', { code: CODE });
ok('le jeu apprend le role a l entree', entreeRole.corps.role === 'organisateur',
   JSON.stringify(entreeRole.corps));

const retire = await post('/test/admin/role', { code: CODE, role: null }, admin);
ok('le role se retire', retire.statut === 200);
const apresRetrait = await post('/champ/ouvrir', { pays: 'FR', debut: debutSamedi }, h);
ok('le championnat se referme aussitot', apresRetrait.statut === 403,
   `HTTP ${apresRetrait.statut}`);
const accesIntact = await get('/champ/pays', h);
ok('retirer le role ne retire pas l acces', accesIntact.statut === 200,
   `HTTP ${accesIntact.statut}`);
const roleInconnu = await post('/test/admin/role', { code: CODE, role: 'arbitre' }, admin);
ok('un role inconnu est refuse', roleInconnu.statut === 400,
   JSON.stringify(roleInconnu.corps));

// ------------------------------------------------- les deux bases sont bien
//                                                    separees
console.log('\n── LES DEUX BASES SONT SEPAREES ─────────────────────────────');
const nom = 'CanalTest' + Math.floor(Math.random() * 100000);
const defi = await post('/challenge', {
  races: ['100'], level_idx: 4, total_ms: 9700, splits: [9700],
  traces: [[0, 10, 30]], name: nom, device_id: 'devcanaltest001',
}, h);
ok('un defi se cree sur le canal de test', defi.statut === 200 && !!defi.corps.id);

await post('/challenge/attempt', {
  id: defi.corps.id, device_id: 'devcanaltest002',
  name: nom + 'B', total_ms: 9500, splits: [9500],
}, h);

const clTest = await get('/duels', h);
const clProd = await get('/duels');
const dansTest = (clTest.corps.classement || []).some(r => r.name === nom);
const dansProd = (clProd.corps.classement || []).some(r => r.name === nom);
ok('le duel apparait au classement de test', dansTest);
ok('le duel n apparait PAS au classement de production', !dansProd);
console.log(`   test : ${(clTest.corps.classement || []).length} joueurs · ` +
            `production : ${(clProd.corps.classement || []).length} joueurs`);

// ------------------------------------------------------------ revocation
console.log('\n── REVOCATION ───────────────────────────────────────────────');
const rev = await post('/test/admin/revoquer', { code: CODE }, admin);
ok('l acces se revoque', rev.statut === 200);

const apres = await post('/test/entrer', { code: CODE });
ok('le code revoque ne passe plus', apres.statut === 403);
const relaisApres = await get('/relay/ranking', h);
ok('le relais se referme aussitot', relaisApres.statut === 403,
   `HTTP ${relaisApres.statut}`);

const autre = await get('/relay/ranking', { 'X-Sprinter-Test': CODE2 });
ok('l autre acces continue de fonctionner', autre.statut === 200,
   `HTTP ${autre.statut}`);

const rendu = await post('/test/admin/rendre', { code: CODE }, admin);
ok('un acces revoque peut etre rendu', rendu.statut === 200);
const reOuvert = await post('/test/entrer', { code: CODE });
ok('le code rendu repasse', reOuvert.statut === 200);

// ------------------------------------------------------------------ liste
console.log('\n── LA LISTE ─────────────────────────────────────────────────');
const liste = await get('/test/admin/liste', admin);
ok('la liste se lit', liste.statut === 200);
for (const a of (liste.corps.acces || []).slice(0, 6)) {
  console.log(`     ${a.code}  ${(a.nom || '').padEnd(10)} ` +
              `${a.actif ? 'actif  ' : 'revoque'}  ${a.passages} passage(s)`);
}
ok('les passages sont comptes', (liste.corps.acces || []).some(a => a.passages > 0));

// menage : on ne laisse pas trainer les acces du test
for (const c of [CODE, CODE2]) await post('/test/admin/revoquer', { code: c }, admin);

console.log('\n' + '─'.repeat(62));
console.log(echecs === 0 ? '   TOUT PASSE.' : `   ${echecs} VERIFICATION(S) EN ECHEC.`);
console.log('');
process.exit(echecs ? 1 : 0);
