// Ce que le jeu raconte aux reseaux, contre le vrai serveur.
//
// Trois proprietes, et la premiere est la seule qui puisse vraiment couter
// cher :
//
//   1. RIEN DU CANAL DE TEST N'ENTRE DANS LA FILE. La charte l'interdit (§5.2)
//      parce qu'un chrono joue sur /test/ n'est classe nulle part : le publier
//      serait une fausse nouvelle, publiee par nous, sur notre propre compte.
//      Elle ne se raisonne pas, elle se mesure — on joue reellement un record
//      sur le canal de test, puis on regarde si la file l'a vu.
//   2. Les pseudonymes ne sortent pas en clair sans qu'on les demande (§5.4).
//   3. Un meme moment ne remplit pas la file de copies.
//
// Se lance contre `wrangler dev` : cd worker && npx wrangler dev --port 8788

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

// Un appareil par execution : le classement garde une ligne par appareil et
// par epreuve, et rejouer le test avec le meme identifiant comparerait un
// record a lui-meme.
const appareil = () => 'test-' + Math.random().toString(36).slice(2, 12).padEnd(10, '0');

/**
 * Un chrono qui prend la tete du 100 m, quel que soit l'etat de la base.
 *
 * Ecrire une valeur en dur ne marche qu'une fois : la deuxieme execution la
 * retrouve deja en tete, le chrono n'est plus un record, et le harnais echoue
 * en accusant le code. On lit donc le classement et on vise dessous.
 */
async function chronoDeTete(marge = 5) {
  const { corps } = await get('/leaderboard?race=100');
  const liste = corps.entries || corps || [];
  const meilleur = Array.isArray(liste) && liste.length
    ? Math.min(...liste.map(e => Number(e.best_split_ms ?? e.time_ms)).filter(Number.isFinite))
    : 9000;
  // 1000 ms est le plancher que le serveur accepte : on ne descend pas dessous,
  // meme apres cent executions du harnais.
  return Math.max(1100, meilleur - marge);
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  CE QUE LE JEU RACONTE AUX RESEAUX                           ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// ------------------------------------------------------------- la porte
console.log('\n── LA PORTE ─────────────────────────────────────────────────');
const nue = await get('/reseaux/file');
ok('sans cle, la file n existe pas', nue.statut === 404, `HTTP ${nue.statut}`);
const avec = await get('/reseaux/file', admin);
ok('avec la cle, elle repond', avec.statut === 200, `HTTP ${avec.statut}`);
ok('elle rend un bareme', !!(avec.corps.bareme && avec.corps.bareme.tete));

// ------------------------------------------------- le canal de test ne sort pas
console.log('\n── LE CANAL DE TEST NE SORT PAS ─────────────────────────────');

// On se fabrique un acces de test, puis on court avec — un chrono tres bas,
// donc un record certain, celui qui remplirait la file s'il le pouvait.
const cree = await post('/test/admin/creer', { nom: 'harnais reseaux' }, admin);
const codeTest = cree.corps && cree.corps.code;
ok('un acces de test est cree', !!codeTest, JSON.stringify(cree.corps).slice(0, 80));

const avantTest = (await get('/reseaux/file?limite=200', admin)).corps.moments || [];

if (codeTest) {
  const r = await post('/submit', {
    device_id: appareil(), race_key: '100', name: 'FantomeDeTest',
    time_ms: 8000, best_split_ms: 8000,
  }, { 'X-Sprinter-Test': codeTest });
  ok('la course de test est bien acceptee', r.statut === 200, `HTTP ${r.statut}`);
  ok('elle est meme en tete du classement de test',
     r.corps.rank === 1, 'rang ' + r.corps.rank);
}

// Le signalement part en waitUntil : il peut arriver apres la reponse. On lui
// laisse le temps, sans quoi le test passerait pour une bonne raison qui n'est
// pas la bonne — la file serait vide parce qu'on l'a lue trop tot.
await new Promise(r => setTimeout(r, 1200));

const apresTest = (await get('/reseaux/file?limite=200', admin)).corps.moments || [];
ok('la file n a pas bouge apres une course de test',
   apresTest.length === avantTest.length,
   `${avantTest.length} → ${apresTest.length}`);
ok('aucun moment ne porte le nom joue sur le canal de test',
   !JSON.stringify(apresTest).includes('FantomeDeTest'));

// ------------------------------------------------------ la production, elle
console.log('\n── LA PRODUCTION, ELLE, REMPLIT LA FILE ─────────────────────');

// Un chrono impossible a battre : la tete du classement, donc le moment le
// plus fort du bareme.
const nomVrai = 'HarnaisReseaux';
const viseTete = await chronoDeTete();
const prod = await post('/submit', {
  device_id: appareil(), race_key: '100', name: nomVrai,
  time_ms: viseTete, best_split_ms: viseTete,
});
ok('la course de production est acceptee', prod.statut === 200, `HTTP ${prod.statut}`);
await new Promise(r => setTimeout(r, 1200));

const file = (await get('/reseaux/file?limite=200', admin)).corps.moments || [];
const moment = file.find(m => m.type === 'tete' && m.donnees &&
                              Number(m.donnees.chrono_ms) === viseTete);
ok('un moment « tete » est apparu', !!moment,
   'types vus : ' + [...new Set(file.map(m => m.type))].join(', '));
if (moment) {
  ok('il porte son pilier et son titre', !!moment.titre && !!moment.pilier);
  ok('il connait le nombre de chronos classes', Number(moment.donnees.classes) > 0);
}

// ------------------------------------------------------ les noms sont masques
console.log('\n── LES NOMS NE SORTENT PAS SEULS ────────────────────────────');
ok('le nom ne sort pas en clair par defaut',
   !JSON.stringify(file).includes(nomVrai),
   'le pseudonyme entier se lit dans la file');
if (moment) {
  ok('mais il reste lisible comme un nom',
     typeof moment.donnees.nom === 'string' && moment.donnees.nom.startsWith('H') &&
     moment.donnees.nom.includes('•'),
     'rendu : ' + moment.donnees.nom);
}
const clair = (await get('/reseaux/file?limite=200&noms=1', admin)).corps.moments || [];
ok('on l obtient en le demandant explicitement',
   JSON.stringify(clair).includes(nomVrai));

// --------------------------------------------------------- pas de doublon
console.log('\n── UN MOMENT NE SE RACONTE QU UNE FOIS ──────────────────────');
const avantBis = (await get('/reseaux/file?limite=200', admin)).corps.moments || [];
// Le meme record, rejoue depuis un autre appareil : meme epreuve, meme chrono.
// C'est le cas qui remplissait la file de copies un soir de test.
await post('/submit', {
  device_id: appareil(), race_key: '100', name: 'UnAutre',
  time_ms: viseTete, best_split_ms: viseTete,
});
await new Promise(r => setTimeout(r, 1200));
const apresBis = (await get('/reseaux/file?limite=200', admin)).corps.moments || [];
ok('le meme fait ne cree pas une seconde ligne',
   apresBis.length === avantBis.length, `${avantBis.length} → ${apresBis.length}`);

// ------------------------------------------------------- le duel serre
console.log('\n── UN DUEL AUX CENTIEMES ────────────────────────────────────');

// Un vrai defi, joue jusqu'au bout : c'est la seule facon d'atteindre le
// crochet, qui vit dans la resolution du duel et pas dans une route a soi.
const auteur = appareil();
const defi = await post('/challenge', {
  device_id: auteur, name: 'AuteurDuDefi', races: ['100'], level_idx: 0,
  total_ms: 9000, splits: [9000], traces: [[]],
});
ok('un defi se cree', defi.statut === 200 && !!defi.corps.id,
   JSON.stringify(defi.corps).slice(0, 90));

if (defi.corps && defi.corps.id) {
  // Trois centiemes derriere : sous le seuil du moment « duel ».
  const rep = await post('/challenge/attempt', {
    id: defi.corps.id, device_id: appareil(), name: 'CeluiQuiRepond',
    total_ms: 9030, splits: [9030],
  });
  ok('l adversaire repond', rep.statut === 200, `HTTP ${rep.statut}`);
  await new Promise(r => setTimeout(r, 1200));

  const f = (await get('/reseaux/file?limite=200', admin)).corps.moments || [];
  const duel = f.find(m => m.type === 'duel' && m.donnees &&
                           Number(m.donnees.ecart_ms) === 30);
  ok('le duel serre est signale', !!duel,
     'types vus : ' + [...new Set(f.map(m => m.type))].join(', '));
  if (duel) {
    ok('il connait l ecart et les deux chronos',
       duel.donnees.gagnant_ms === 9000 && duel.donnees.perdant_ms === 9030,
       `${duel.donnees.gagnant_ms} / ${duel.donnees.perdant_ms}`);
    ok('et les noms y sont masques',
       !JSON.stringify(duel).includes('AuteurDuDefi'));
  }
}

// ------------------------------------------------------------- les gestes
console.log('\n── ECARTER, ET MARQUER PUBLIE ───────────────────────────────');
if (moment) {
  const e = await post('/reseaux/ecarter', { id: moment.id }, admin);
  ok('un moment s ecarte', e.statut === 200, `HTTP ${e.statut}`);
  const encore = await post('/reseaux/ecarter', { id: moment.id }, admin);
  ok('et ne se tranche pas deux fois', encore.statut === 409, `HTTP ${encore.statut}`);
  const reste = (await get('/reseaux/file?limite=200', admin)).corps.moments || [];
  ok('il a quitte la file d attente', !reste.some(m => m.id === moment.id));
  const ecartes = (await get('/reseaux/file?etat=ecarte&limite=200', admin)).corps.moments || [];
  ok('on le retrouve parmi les ecartes', ecartes.some(m => m.id === moment.id));
}

// On refait tomber la tete du classement pour avoir de quoi publier : le seul
// moment de la file vient d'etre ecarte, et une section qui ne trouve rien a
// tester passerait au vert sans avoir rien verifie. C'est arrive au premier
// jet, et c'est precisement ce qu'un harnais ne doit pas faire.
const encore = await chronoDeTete();
await post('/submit', {
  device_id: appareil(), race_key: '100', name: 'EncorePlusVite',
  time_ms: encore, best_split_ms: encore,
});
await new Promise(r => setTimeout(r, 1200));

const aPublier = (await get('/reseaux/file?limite=200', admin)).corps.moments || [];
ok('il y a bien un moment a publier', aPublier.length > 0, 'file vide');
if (aPublier.length) {
  const m = aPublier[0];
  const p = await post('/reseaux/publie', { id: m.id, reseaux: ['instagram', 'x'] }, admin);
  ok('un moment se marque publie', p.statut === 200, `HTTP ${p.statut}`);
  const publies = (await get('/reseaux/file?etat=publie&limite=200', admin)).corps.moments || [];
  const vu = publies.find(x => x.id === m.id);
  ok('et le registre retient ou il est parti',
     !!vu && vu.reseaux.includes('instagram') && vu.reseaux.includes('x'),
     vu ? vu.reseaux.join('+') : 'introuvable');
}

// ------------------------------------------------------------- le menage
if (codeTest) await post('/test/admin/revoquer', { code: codeTest }, admin);

console.log('\n' + (echecs === 0
  ? '  Tout tient.\n'
  : `  ${echecs} verification(s) en echec.\n`));
process.exit(echecs === 0 ? 0 : 1);
