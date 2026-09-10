// Les refus de nom sont-ils reellement comptes ?
//
// Ce test APPELLE LES ROUTES plutot que d'eprouver le module seul, et pour la
// meme raison que `objectif-test.mjs` : ce qui a failli ici n'est pas le
// calcul, c'est le cablage. Sept routes refusent un nom qui n'appartient pas a
// l'appareil, chacune dans un bloc different et a cent lignes des autres. Une
// note oubliee sur l'une d'elles ne se voit pas — le refus continue de
// marcher, le compteur ment, et c'est tout.
//
// On verifie donc la chaine entiere, du 403 rendu au chiffre relu :
//   - un nom libre passe, un nom pris est refuse ;
//   - le refus est compte, sur la bonne route et le bon appareil ;
//   - deux refus se cumulent sur une ligne au lieu d'en creer deux ;
//   - la route de lecture est fermee sans cle, et masque les noms sans
//     `?noms=1` ;
//   - le proprietaire legitime, lui, n'est jamais compte.
//
//   (cd worker && npx wrangler dev --local --port 8787 --var TABLEAU_CLE:test-cle)
//   node tools/refus-test.mjs
//
//   BASE=... CLE=... node tools/refus-test.mjs      # contre un autre worker

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const CLE = process.env.CLE || 'test-cle';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const appareil = () => Array.from({ length: 32 },
  () => Math.floor(Math.random() * 16).toString(16)).join('');

async function poste(route, corps) {
  const r = await fetch(BASE + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  return { statut: r.status, corps: await r.json().catch(() => ({})) };
}
async function lis(route, cle) {
  const r = await fetch(BASE + route, cle ? { headers: { 'X-Sprinter-Tableau': cle } } : undefined);
  return { statut: r.status, corps: await r.json().catch(() => ({})) };
}

try {
  await fetch(BASE + '/leaderboard?race=100');
} catch {
  console.log(`\n⚠  Aucun worker sur ${BASE}. Lancer :`);
  console.log('   (cd worker && npx wrangler dev --local --port 8787 --var TABLEAU_CLE:test-cle)\n');
  process.exit(2);
}

// Un nom neuf a chaque passage : le test doit pouvoir se rejouer sur la meme
// base sans que le compte du tour precedent le fasse passer pour vert.
const nom = 'Refus' + Math.floor(Math.random() * 1e9);
const cle = nom.toLowerCase();
const proprietaire = appareil();
const intrus = appareil();

/* ------------------------------------------------------ le decor */

titre('LE NOM EST RESERVE PAR SON PROPRIETAIRE');

const claim = await poste('/claim', { device_id: proprietaire, name: nom });
ok('le nom libre se reserve', claim.statut === 200 && claim.corps.ok === true,
   JSON.stringify(claim.corps).slice(0, 120));

const sien = await poste('/race', {
  device_id: proprietaire, name: nom, race_key: '100', time_ms: 9500,
  mode: 'oneshot', level_idx: 0,
});
ok('son proprietaire court sans etre inquiete', sien.statut === 200, String(sien.statut));

/* --------------------------------------------------- les refus */

titre('UN AUTRE APPAREIL SE FAIT REFUSER, ET C EST COMPTE');

const course = await poste('/race', {
  device_id: intrus, name: nom, race_key: '100', time_ms: 8220,
  mode: 'oneshot', level_idx: 0,
});
ok('/race refuse en 403', course.statut === 403, String(course.statut));
ok('...et le dit comme avant', course.corps.pris === true && course.corps.error === 'nom reserve',
   JSON.stringify(course.corps));

const envoi = await poste('/submit', {
  device_id: intrus, race_key: '100', name: nom, time_ms: 1200000, best_split_ms: 8220,
});
ok('/submit refuse en 403', envoi.statut === 403, String(envoi.statut));

// Deux fois la meme route : le compteur doit s'incrementer, pas se dupliquer.
await poste('/submit', {
  device_id: intrus, race_key: '100', name: nom, time_ms: 1200000, best_split_ms: 8220,
});

/* ------------------------------------------------------ la lecture */

titre('CE QUE LE COMPTEUR EN DIT');

const sansCle = await lis('/refus');
ok('sans cle, la route n existe pas', sansCle.statut === 404, String(sansCle.statut));

const vu = await lis('/refus?noms=1', CLE);
ok('avec la cle, elle repond', vu.statut === 200, String(vu.statut));

const moi = (vu.corps.mures || []).find(m => m.nom === cle);
ok('le nom mure apparait', !!moi, JSON.stringify(vu.corps.mures || []).slice(0, 160));
ok('trois refus comptes pour lui', moi && moi.refus === 3, moi && String(moi.refus));
ok('un seul appareil mis en cause', moi && moi.appareils === 1, moi && String(moi.appareils));

const parRoute = Object.fromEntries((vu.corps.routes || []).map(r => [r.route, r.refus]));
ok('/race compte son refus', (parRoute['/race'] || 0) >= 1, JSON.stringify(parRoute));
ok('/submit compte ses deux refus cumules', (parRoute['/submit'] || 0) >= 2, JSON.stringify(parRoute));

const masque = await lis('/refus', CLE);
const cache = (masque.corps.mures || [])[0];
ok('sans ?noms=1, les pseudonymes sont masques', cache !== undefined && cache.nom === null,
   JSON.stringify(cache));
ok('...mais les chiffres restent lisibles', typeof masque.corps.refus === 'number' && masque.corps.refus >= 3,
   String(masque.corps.refus));

/* -------------------------------- le proprietaire n est jamais compte */

titre('LE PROPRIETAIRE N ENTRE PAS DANS LE COMPTE');

const avant = (await lis('/refus?noms=1', CLE)).corps;
await poste('/race', {
  device_id: proprietaire, name: nom, race_key: '100', time_ms: 9400,
  mode: 'oneshot', level_idx: 0,
});
const apres = (await lis('/refus?noms=1', CLE)).corps;
ok('une course legitime n ajoute aucun refus', avant.refus === apres.refus,
   `${avant.refus} → ${apres.refus}`);

console.log(`\n${e ? `✗ ${e} echec(s)` : '✓ tout passe'}\n`);
process.exit(e ? 1 : 0);
