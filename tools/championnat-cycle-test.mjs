// Un cycle complet contre le vrai serveur : national -> continental -> mondial.
//
// Ce que ce harnais cherche a prendre en defaut, ce n'est pas le format d'une
// course — championnats-test.mjs s'en charge — mais l'enchainement : est-ce
// qu'un champion national arrive bien dans son continental, est-ce qu'un
// champion continental arrive bien au mondial, et est-ce que le fil d'annonces
// raconte la meme competition que la base.

const B = 'http://127.0.0.1:8788';
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

let graine = 4242;
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const SEMAINE = 7 * 24 * 3600 * 1000;
const samedi = Date.UTC(2026, 8, 5);

let echecs = 0;
function verifier(nom, condition, detail) {
  if (condition) { console.log(`   ✓ ${nom}`); }
  else { console.log(`   ✗ ${nom}${detail ? ' — ' + detail : ''}`); echecs++; }
}

/** Deroule une edition entiere, de la premiere serie au sacre. */
async function courir(id, silencieux = true) {
  const niveau = {};
  for (let garde = 0; garde < 6; garde++) {
    const etat = await get('/champ/edition/' + id);
    if (etat.error) return { erreur: etat.error };
    if (etat.etat === 'terminee') return { champion: etat.champion };

    const courses = [...new Set(etat.partants
      .filter(p => p.phase === etat.phase).map(p => p.course))].sort((a, b) => a - b);

    for (const c of courses) {
      const partants = etat.partants.filter(p => p.phase === etat.phase && p.course === c);
      const chronos = partants.map(p => {
        if (niveau[p.name_key] == null) niveau[p.name_key] = 9400 + (p.rang_duel || 16) * 20;
        return { cle: p.name_key, ms: Math.round(niveau[p.name_key] + (hasard() - 0.5) * 300) };
      });
      const r = await post('/champ/course', { edition: id, phase: etat.phase, course: c, chronos });
      if (r.error) return { erreur: r.error + ' (course ' + c + ')' };
      if (!silencieux) {
        const tri = [...chronos].sort((a, b) => a.ms - b.ms);
        const nomDe = k => partants.find(p => p.name_key === k).nom;
        console.log(`     course ${c} : ` + tri.slice(0, 3).map((x, i) => `${i + 1}.${nomDe(x.cle)} ${s(x.ms)}`).join('  '));
      }
    }
    const cl = await post('/champ/cloturer', { edition: id });
    if (cl.error) return { erreur: cl.error };
    if (cl.finale) return { champion: cl.champion, libelle: cl.libelle, podium: cl.podium };
  }
  return { erreur: 'trop de phases' };
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  CYCLE COMPLET — national → continental → mondial            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// ---------------------------------------------------------------- calendrier
console.log('\n── LE CALENDRIER DU CYCLE ───────────────────────────────────');
const cal = await get('/champ/calendrier?debut=' + samedi);
for (const e of cal.cycle) {
  console.log(`   ${e.echelon.padEnd(12)} ${new Date(e.debut).toISOString().slice(0, 10)}` +
              `   ${e.rendezVous.length} rendez-vous`);
}
verifier('continental 3 semaines apres le national',
  cal.cycle[1].debut - cal.cycle[0].debut === 3 * SEMAINE);
verifier('mondial 4 semaines apres le continental',
  cal.cycle[2].debut - cal.cycle[1].debut === 4 * SEMAINE);

// ------------------------------------------------- garde-fou avant l'heure
console.log('\n── AVANT TOUT : LES GARDE-FOUS ──────────────────────────────');
const tropTot = await post('/champ/ouvrir', { echelon: 'continental', zone: 'EU', debut: samedi });
verifier('un continental sans champions est refuse',
  tropTot.error === 'pas assez de champions', JSON.stringify(tropTot).slice(0, 90));

// ------------------------------------------------------------- nationaux
console.log('\n── LES CHAMPIONNATS NATIONAUX, LE MEME WEEKEND ──────────────');
const cycle = await post('/champ/cycle', { debut: samedi, echelon: 'national' });
console.log(`   ${cycle.ouvertes.length} pays ouvrent, ${cycle.ecartes.length} ecartes`);
for (const e of cycle.ecartes.slice(0, 4)) {
  console.log(`     ecarte ${e.zone} : ${e.raison}${e.joueurs != null ? ' (' + e.joueurs + ' joueurs)' : ''}`);
}
verifier('les six pays semes ouvrent leur championnat',
  ['FR', 'DE', 'ES', 'MA', 'SN', 'CI'].every(p => cycle.ouvertes.some(o => o.zone === p)),
  cycle.ouvertes.map(o => o.zone).join(','));

const redite = await post('/champ/ouvrir', { pays: 'FR', debut: samedi });
verifier('deux editions pour un meme pays sont refusees',
  redite.error === 'edition deja ouverte');

console.log('');
for (const o of cycle.ouvertes) {
  const r = await courir(o.edition);
  if (r.erreur) { console.log(`   ✗ ${o.zone} : ${r.erreur}`); echecs++; }
  else console.log(`   ${o.zone} → ${r.libelle || 'champion'} : ${r.champion}`);
}

// ---------------------------------------------------------- continentaux
console.log('\n── LES CHAMPIONNATS CONTINENTAUX ────────────────────────────');
const cycleC = await post('/champ/cycle', { debut: samedi + 3 * SEMAINE, echelon: 'continental' });
console.log(`   ${cycleC.ouvertes.length} continents ouvrent, ${cycleC.ecartes.length} ecartes`);
for (const e of cycleC.ecartes) {
  console.log(`     ecarte ${e.zone} : ${e.raison}` +
              (e.champions != null ? ` (${e.champions} champions)` : '') +
              (e.joueurs != null ? ` (${e.joueurs} joueurs)` : ''));
}
verifier('EU et AF ouvrent leur continental',
  cycleC.ouvertes.filter(o => o.zone === 'EU' || o.zone === 'AF').length === 2);

// Les champions nationaux doivent etre dans la grille de leur continental.
const euEd = cycleC.ouvertes.find(o => o.zone === 'EU');
if (euEd) {
  const etatEu = await get('/champ/edition/' + euEd.edition);
  const noms = new Set(etatEu.partants.map(p => p.nom));
  const champsEu = (await get('/champ/monde?echelon=national')).sacres
    .filter(x => ['FR', 'DE', 'ES'].includes(x.zone));
  const dedans = champsEu.filter(c => noms.has(c.champion));
  verifier('les champions nationaux europeens sont dans la grille continentale',
    dedans.length === champsEu.length,
    `${dedans.length}/${champsEu.length}`);
  verifier('la grille continentale compte 32 partants', etatEu.partants.length === 32,
    etatEu.partants.length + ' partants');
}

console.log('');
for (const o of cycleC.ouvertes) {
  const r = await courir(o.edition);
  if (r.erreur) { console.log(`   ✗ ${o.zone} : ${r.erreur}`); echecs++; }
  else console.log(`   ${o.zone} → ${r.libelle || 'champion'} : ${r.champion}`);
}

// ---------------------------------------------------------------- mondial
console.log('\n── LE CHAMPIONNAT DU MONDE ──────────────────────────────────');
const cycleM = await post('/champ/cycle', { debut: samedi + 7 * SEMAINE, echelon: 'mondial' });
if (cycleM.ecartes.length) console.log('   ecarte :', JSON.stringify(cycleM.ecartes[0]).slice(0, 120));
verifier('le mondial ouvre', cycleM.ouvertes.length === 1);

if (cycleM.ouvertes.length) {
  const id = cycleM.ouvertes[0].edition;
  const etatM = await get('/champ/edition/' + id);
  const noms = new Set(etatM.partants.map(p => p.nom));
  const champsC = (await get('/champ/monde?echelon=continental')).sacres;
  const dedans = champsC.filter(c => noms.has(c.champion));
  verifier('les champions continentaux sont dans la grille mondiale',
    dedans.length === champsC.length, `${dedans.length}/${champsC.length}`);

  const r = await courir(id, false);
  if (r.erreur) { console.log('   ✗', r.erreur); echecs++; }
  else {
    console.log(`\n   ★ ${r.libelle} : ${r.champion}`);
    if (r.podium) r.podium.forEach(p => console.log(`     ${p.place}. ${p.nom.padEnd(12)} ${s(p.ms)}`));
    verifier('le mondial produit un champion du monde', r.libelle === 'Champion du monde', r.libelle);
  }
}

// ------------------------------------------------------- diffusion directe
console.log('\n── LE FIL DES ANNONCES ──────────────────────────────────────');
let curseur = 0, total = 0, pousses = 0;
const parType = {};
for (let i = 0; i < 60; i++) {
  const f = await get(`/champ/direct?depuis=${curseur}&limite=200`);
  if (!f.annonces.length) break;
  for (const a of f.annonces) {
    total++; if (a.pousser) pousses++;
    parType[a.type] = (parType[a.type] || 0) + 1;
  }
  curseur = f.curseur;
}
console.log(`   ${total} annonces, dont ${pousses} a pousser en notification`);
for (const [t, n] of Object.entries(parType).sort((a, b) => b[1] - a[1])) {
  console.log(`     ${t.padEnd(22)} ${n}`);
}
verifier('le fil contient des sacres', (parType['sacre'] || 0) >= 8, (parType['sacre'] || 0) + ' sacres');
verifier('le fil revele les repechages', (parType['reveal-demies'] || 0) > 0);
verifier('le fil annonce les qualifies directs', (parType['qualification-directe'] || 0) > 0);

const vide = await get(`/champ/direct?depuis=${curseur}`);
verifier('un curseur a jour ne renvoie rien', vide.annonces.length === 0);

// On filtre sur une zone qui a reellement couru dans ce cycle, sans quoi le
// test passerait aussi bien sur un fil vide.
const zoneTest = cycle.ouvertes.length ? cycle.ouvertes[0].zone : 'FR';
const filZone = await get(`/champ/direct?zone=${zoneTest}&limite=200`);
verifier(`le fil se filtre par zone (${zoneTest})`,
  filZone.annonces.length > 0 && filZone.annonces.every(a => a.zone === zoneTest),
  `${filZone.annonces.length} annonces`);

// ------------------------------------------------------ recap mondial
console.log('\n── LE RECAPITULATIF MONDIAL ─────────────────────────────────');
const monde = await get('/champ/monde');
console.log(`   ${monde.total} editions, ${monde.termines} terminees, ${monde.encours.length} en cours`);
for (const x of monde.sacres.slice(0, 12)) {
  console.log(`     ${x.echelon.padEnd(12)} ${x.zoneNom.padEnd(12)} ${x.champion}`);
}
verifier('toutes les editions sont terminees', monde.encours.length === 0,
  monde.encours.length + ' encore en cours');

console.log('\n' + '─'.repeat(62));
console.log(echecs === 0 ? '   TOUT PASSE.' : `   ${echecs} VERIFICATION(S) EN ECHEC.`);
console.log('');
process.exit(echecs ? 1 : 0);
