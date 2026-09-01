// Un championnat de France complet, contre le vrai serveur.
//
// L'adresse se laisse choisir, comme dans les autres harnais : codee en dur,
// elle interroge le `wrangler dev` qui se trouve la, meme s'il sert une copie
// du depot restee en arriere — et l'ecart de version ressemble alors a un bug.
const B = process.env.BASE || 'http://127.0.0.1:8788';
const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...H },
  body: JSON.stringify(b) }).then(r => r.json());
const get = u => fetch(B + u, { headers: H }).then(r => r.json());

// Les routes des championnats sont reservees au canal de test : le harnais se
// procure un acces comme n'importe quel appelant, puis le presente a chaque
// requete.
const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': 'cle-de-test-locale-uniquement' };
const _acces = await fetch(B + '/test/admin/creer', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ nom: 'harnais' }) }).then(r => r.json());
const H = { 'X-Sprinter-Test': _acces.code };

const s = ms => ms == null ? 'abandon' : (ms / 1000).toFixed(3) + ' s';

// Chaque joueur a un niveau intrinseque tire de son rang, plus du bruit :
// c'est ce qui rend les repechages interessants plutot que mecaniques.
const niveau = {};
let graine = 12345;
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const samedi = Date.UTC(2026, 8, 5);
console.log('\n══ OUVERTURE ═══════════════════════════════════════════════');
const ouv = await post('/champ/ouvrir', { pays: 'FR', debut: samedi });
if (ouv.error) {
  console.log('  ', ouv);
  // « pays trop petit » n'est pas une panne : c'est une base vide. Ce harnais
  // convoque des joueurs deja classes et n'en cree aucun.
  if (ouv.error === 'pays trop petit' || ouv.error === 'grille incomplete') {
    console.log(`\n   Il faut au moins ${ouv.requis} joueurs classes en FR pour ouvrir une`);
    console.log(`   edition ; la base en compte ${ouv.joueurs}. Rien a verifier tant que`);
    console.log('   personne ne peut courir.');
  }
  console.log(`\n   Serveur interroge : ${B}  (BASE=... pour en changer)`);
  process.exit(1);
}
console.log(`   Édition ${ouv.edition} — ${ouv.partants} partants, Championnat de France\n`);
for (const c of ouv.grille) {
  for (const j of c.joueurs) niveau[j.cle] = 9400 + j.rang * 22;
  console.log(`   Série ${c.course} : ` + c.joueurs.map(j => `${j.nom}(${j.rang})`).join(', '));
}

const courir = cles => cles.map(k => ({
  cle: k, ms: Math.round(niveau[k] + (hasard() - 0.5) * 260),
}));

async function phase(nom, nCourses) {
  console.log(`\n══ ${nom.toUpperCase()} ══════════════════════════════════════`);
  const etat = await get('/champ/edition/' + ouv.edition);
  for (let c = 1; c <= nCourses; c++) {
    const partants = etat.partants.filter(p => p.phase === etat.phase && p.course === c);
    const chronos = courir(partants.map(p => p.name_key));
    await post('/champ/course', { edition: ouv.edition, phase: etat.phase, course: c, chronos });
    const tri = [...chronos].sort((a, b) => a.ms - b.ms);
    const nomDe = k => partants.find(p => p.name_key === k).nom;
    console.log(`\n   ${nom} ${c}`);
    tri.forEach((r, i) => console.log(`     ${i + 1}. ${nomDe(r.cle).padEnd(10)} ${s(r.ms)}`));
  }
  const cl = await post('/champ/cloturer', { edition: ouv.edition });
  if (cl.error) { console.log('   ERREUR :', cl); process.exit(1); }
  return cl;
}

const c1 = await phase('Série', 4);
console.log('\n   ── Qualifiés directs (2 par série) ──');
c1.directs.forEach(d => console.log(`     ${d.nom.padEnd(10)} série ${d.course}, ${d.place}${d.place===1?'er':'e'}   ${s(d.ms)}`));
console.log('\n   ── Repêchés au chrono (révélés après la Série 4) ──');
c1.repeches.forEach(d => console.log(`     ${d.nom.padEnd(10)} série ${d.course}, ${d.place}e   ${s(d.ms)}`));
console.log(`\n   ${c1.elimines} éliminés.`);

const c2 = await phase('Demi-finale', 2);
console.log('\n   ── Qualifiés directs ──');
c2.directs.forEach(d => console.log(`     ${d.nom.padEnd(10)} demie ${d.course}, ${d.place}${d.place===1?'er':'e'}   ${s(d.ms)}`));
console.log('\n   ── Repêchés au chrono ──');
c2.repeches.forEach(d => console.log(`     ${d.nom.padEnd(10)} demie ${d.course}, ${d.place}e   ${s(d.ms)}`));

const c3 = await phase('Finale', 1);
console.log('\n══ CLASSEMENT DE LA FINALE ═════════════════════════════════');
c3.classement.forEach(r => console.log(`   ${String(r.place).padStart(2)}. ${r.nom.padEnd(10)} ${s(r.ms)}`));
console.log('\n══ SACRE ═══════════════════════════════════════════════════');
console.log(`   ${c3.champion} — « ${c3.libelle} »`);
console.log(`   titre porté jusqu'au ${new Date(c3.expire_le).toISOString().slice(0,10)}`);
console.log(`   podium : ${c3.podium.map((p,i)=>`${i+1}. ${p.nom}`).join('   ')}\n`);

const t = await get('/champ/titres?name=' + encodeURIComponent(c3.podium[0].cle));
console.log('   vérification du titre en base :', JSON.stringify(t.titres));
