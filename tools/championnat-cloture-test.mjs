// La cloture de selection, contre le vrai serveur.
//
// Ce harnais ne verifie pas qu'un championnat court — `championnat-france-test`
// s'en charge. Il verifie que la SELECTION est juste, ce qui est une autre
// question et se joue avant le coup de pistolet.
//
// Ce qu'il tient sous surveillance, et pourquoi :
//
//   1. la cloture est une heure annoncee d'avance, pas l'instant ou quelqu'un
//      a lance une commande. C'etait le defaut d'origine : ouvrir une edition
//      gelait ses trente-deux partants du meme geste, si bien que le classement
//      se lisait a une heure que personne ne pouvait ni prevoir ni verifier.
//
//   2. l'ordre de selection est RIGOUREUSEMENT celui du classement affiche.
//      C'est la propriete centrale, et la seule qui rende la barre honnete : un
//      joueur doit pouvoir compter les lignes au-dessus de lui et en deduire
//      s'il est pris. Elle tient par `ordreClassement()`, partage entre le
//      classement et la selection — et il suffirait d'ajouter un critere d'un
//      seul cote pour qu'elle cesse de tenir sans que rien ne casse. D'ou ce
//      harnais.
//
//   3. rien n'est gele a l'annonce, et tout l'est apres la cloture.
//
// Le semis, lui, ne se verifie pas d'ici : il se fait au MMR, et le MMR ne sort
// jamais du serveur. C'est voulu, et cela veut dire qu'on ne peut controler de
// l'exterieur que la forme de la grille — permutation complete, series
// equilibrees. Le reste se lit dans `championnats-test.mjs`, qui appelle le
// moteur directement.
//
//   node tools/championnat-peupler.mjs --vider-editions   # d'abord
//   node tools/championnat-cloture-test.mjs

const B = process.env.BASE || 'http://127.0.0.1:8788';
const CLE_ADMIN = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';

const _acces = await fetch(B + '/test/admin/creer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Sprinter-Admin': CLE_ADMIN },
  body: JSON.stringify({ nom: 'harnais-cloture' }),
}).then(r => r.json()).catch(() => ({}));

if (!_acces.code) {
  console.log(`\n   Pas d'acces au canal de test sur ${B}.`);
  console.log(`   Le serveur tourne-t-il ? (npx wrangler dev --local --port 8788)`);
  console.log(`   BASE=... pour interroger ailleurs, ADMIN_CLE=... pour la cle.\n`);
  process.exit(1);
}

const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': _acces.code };
const HA = { ...H, 'X-Sprinter-Admin': CLE_ADMIN };
const get = u => fetch(B + u, { headers: H }).then(r => r.json());
const post = (u, b) => fetch(B + u, {
  method: 'POST', headers: HA, body: JSON.stringify(b || {}),
}).then(r => r.json());

let ok = 0, ko = 0;
const dit = (b, m) => { if (b) { ok++; console.log('   ✓ ' + m); } else { ko++; console.log('   ✗ ' + m); } };
const JOUR = 24 * 3600 * 1000;
const iso = t => t == null ? 'jamais' : new Date(t).toISOString().replace('T', ' ').slice(0, 16);

// --- de quoi remplir une grille --------------------------------------------
const nations = await get('/champ/pays');
const zones = (nations.pays || []).filter(p => p.eligible);
if (zones.length < 2) {
  console.log(`\n   Il faut deux pays capables de tenir un championnat ; la base en a ${zones.length}.`);
  console.log('   node tools/championnat-peupler.mjs\n');
  process.exit(1);
}
// Deux zones : une pour l'echeance qui ne doit pas tomber, une pour celle qui
// doit tomber. Les melanger dans la meme zone est impossible — une zone ne
// tient qu'un championnat a la fois, et c'est justement ce qu'on verifie plus bas.
const [ZA, ZB] = [zones[0].pays, zones[1].pays];

for (const z of [ZA, ZB]) {
  const d = await get(`/champ/prochain?pays=${z}`);
  if (d.edition) {
    console.log(`\n   ${z} tient deja une edition (${d.edition.id}, ${d.edition.etat}).`);
    console.log('   node tools/championnat-peupler.mjs --vider-editions\n');
    process.exit(1);
  }
}

console.log(`\n   Serveur ${B} — zones d'essai ${ZA} et ${ZB}`);

// =========================================================== 1. l'annonce
console.log('\n=== 1. annoncer ne gele rien');
const samedi = Date.now() + 12 * JOUR;
const a = await post('/champ/annoncer', { pays: ZA, debut: samedi });
dit(!a.error, 'l\'annonce passe' + (a.error ? ' — ' + a.error : ''));
dit(a.etat === 'annoncee', `etat « annoncee » et non « ouverte »`);
dit(a.debut - a.cloture === 3 * JOUR, 'la cloture tombe trois jours avant le depart');
dit(a.partants === undefined, 'aucun partant : le classement n\'a pas ete lu');
console.log(`     cloture ${iso(a.cloture)}   depart ${iso(a.debut)}`);

const p = (await get(`/champ/prochain?pays=${ZA}`)).edition;
dit(!!p && p.etat === 'annoncee', 'un joueur non selectionne peut voir l\'edition venir');
dit(!!p && p.cloture === a.cloture && p.partants === 32,
  'il lit la meme heure de cloture et le nombre de places');

// =============================================== 2. l'echeance ne bouge pas
console.log('\n=== 2. le cron ne cloture pas avant l\'heure');
const tot = await post('/champ/echeances');
dit(tot.vues === 0, `aucune echeance vue (${tot.vues})`);
dit((await get(`/champ/prochain?pays=${ZA}`)).edition.etat === 'annoncee',
  'l\'edition est toujours annoncee apres le balayage');

// ============================================ 3. l'echeance tombe toute seule
console.log('\n=== 3. le cron cloture a l\'heure, sans personne');
const b = await post('/champ/annoncer', {
  pays: ZB, debut: Date.now() + 2 * 3600 * 1000, cloture: Date.now() - 60_000,
});
dit(!b.error && b.etat === 'annoncee', 'seconde edition annoncee, cloture deja passee');
const bal = await post('/champ/echeances');
dit(bal.vues === 1, `une echeance vue (${bal.vues})`);
dit(bal.cloturees.length === 1 && bal.cloturees[0].partants === 32,
  'cloturee avec 32 partants');
dit((await get(`/champ/prochain?pays=${ZB}`)).edition.etat === 'ouverte',
  'l\'edition est passee a « ouverte »');

// ============================== 4. LA propriete : selection == classement
console.log('\n=== 4. les 32 retenus sont les 32 premiers du classement affiche');
const cl = await get('/duels');
const local = (cl.classement || []).filter(r => r.pays === ZB);
const e = await get(`/champ/edition/${bal.cloturees[0].edition}`);
const partants = new Set((e.partants || []).map(x => x.name_key));

dit(partants.size === 32, `32 partants dans la grille (${partants.size})`);
const attendus = local.slice(0, 32).map(r => r.name.trim().toLowerCase());
const manquants = attendus.filter(k => !partants.has(k));
dit(manquants.length === 0,
  'aucun des 32 premiers du classement n\'a ete oublie'
  + (manquants.length ? ' — ' + manquants.join(', ') : ''));
const intrus = [...partants].filter(k => !attendus.includes(k));
dit(intrus.length === 0,
  'personne d\'en dessous de la barre n\'a ete pris'
  + (intrus.length ? ' — ' + intrus.join(', ') : ''));
console.log(`     ${local.length} classes en ${ZB} — barre a la 32e place`);

// ============================================ 5. la barre reste consultable
console.log('\n=== 5. chacun peut savoir ou il est par rapport a la barre');
if (local.length > 32) {
  const dehors = local[32];                       // le 33e
  const s = await get(`/champ/selection?name=${encodeURIComponent(dehors.name)}`);
  dit(s.rang === 33, `le 33e du classement se lit 33e de la selection (${s.rang})`);
  dit(s.retenu === false, 'il n\'est pas retenu');
  dit(s.manque === 1, `il lui manque une place (${s.manque})`);
  dit(s.gele === true, 'et la reponse est gelee, la grille ne bougeant plus');
  dit(!('mmr' in s), 'le MMR ne sort pas de cette route');
} else {
  console.log(`   – ${ZB} n'a que ${local.length} classes : pas de 33e a interroger.`);
}
const dedans = local[0];
const s1 = await get(`/champ/selection?name=${encodeURIComponent(dedans.name)}`);
dit(s1.rang === 1 && s1.retenu === true, 'le premier du classement est retenu');

// ================================================== 6. la forme de la grille
console.log('\n=== 6. la grille est complete et equilibree');
const rangs = (e.partants || []).map(x => x.rang_duel).sort((x, y) => x - y);
dit(rangs.length === 32 && rangs.every((r, i) => r === i + 1),
  'les rangs de semis sont une permutation de 1 a 32');
const parCourse = new Map();
for (const x of e.partants || []) {
  if (!parCourse.has(x.course)) parCourse.set(x.course, []);
  parCourse.get(x.course).push(x.rang_duel);
}
dit(parCourse.size === 4 && [...parCourse.values()].every(c => c.length === 8),
  '4 series de 8');
const sommes = [...parCourse.values()].map(c => c.reduce((a, b) => a + b, 0));
dit(Math.max(...sommes) - Math.min(...sommes) <= 4,
  `series equilibrees (ecart ${Math.max(...sommes) - Math.min(...sommes)})`);

// ======================================================= 7. les refus
console.log('\n=== 7. ce qui doit etre refuse l\'est');
const r1 = await post('/champ/annoncer', { pays: ZB, debut: samedi });
dit(r1.error === 'edition deja ouverte', 'une zone ne tient qu\'un championnat a la fois');
const r2 = await post('/champ/annoncer', { pays: 'LU', debut: samedi });
dit(r2.error === 'pays trop petit',
  'un pays trop petit est refuse a l\'annonce, pas annule trois jours apres');
const r3 = await post('/champ/annoncer', {
  pays: zones[2] ? zones[2].pays : ZA, debut: samedi, cloture: samedi + JOUR,
});
dit(r3.error === 'cloture apres le depart', 'une cloture posterieure au depart est refusee');
const r4 = await post('/champ/cloturer-selection', { edition: bal.cloturees[0].edition });
dit(r4.error === 'edition deja cloturee', 'on ne cloture pas deux fois');

console.log(`\n   ${ok} verifications passees, ${ko} en echec\n`);
process.exit(ko ? 1 : 0);
