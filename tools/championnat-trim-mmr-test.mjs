// Quand la somme des podiums qualifies depasse 32, seuls les plus rapides au
// MMR doivent rester dans la grille. Douze nations oceaniennes fictives, trois
// medailles chacune : 36 qualifies pour 32 places.
const B = 'http://127.0.0.1:8788';
const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...H },
  body: JSON.stringify(b) }).then(r => r.json());
const get = u => fetch(B + u, { headers: H }).then(r => r.json());

const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': 'cle-de-test-locale-uniquement' };
const _acces = await fetch(B + '/test/admin/creer', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ nom: 'harnais-trim' }) }).then(r => r.json());
await fetch(B + '/test/admin/role', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ code: _acces.code, role: 'organisateur' }) });
const H = { 'X-Sprinter-Test': _acces.code };

let echecs = 0;
function verifier(nom, condition, detail) {
  if (condition) { console.log(`   ✓ ${nom}`); }
  else { console.log(`   ✗ ${nom}${detail ? ' — ' + detail : ''}`); echecs++; }
}

// Seedes directement en base (voir seed-trim.sql) : ocmmr00..31 conserves
// (les 32 meilleurs MMR), ocmmr32..35 coupes (les 4 plus faibles).
const CONSERVES = Array.from({ length: 32 }, (_, i) => 'ocmmr' + String(i).padStart(2, '0'));
const COUPES = Array.from({ length: 4 }, (_, i) => 'ocmmr' + String(32 + i).padStart(2, '0'));

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  PLAFOND A 32 — plus de podiums que de places                 ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

console.log('\n── LE SALON, AVANT OUVERTURE ─────────────────────────────────');
const salon = await get('/champ/salon');
const oc = (salon.continents || []).find(c => c.zone === 'OC');
verifier('le salon voit les douze nations qualifiees', !!oc && oc.entites === 12, JSON.stringify(oc));
verifier('le salon plafonne l effectif annonce a 32', !!oc && oc.partants === 32, JSON.stringify(oc));

console.log('\n── OUVERTURE DU CONTINENTAL OCEANIEN ────────────────────────');
const samedi = Date.UTC(2026, 8, 5);
const ouv = await post('/champ/ouvrir', { echelon: 'continental', zone: 'OC', debut: samedi });
verifier('l edition s ouvre', !ouv.error, JSON.stringify(ouv).slice(0, 120));
if (!ouv.error) {
  verifier('exactement 32 partants malgre 36 qualifies', ouv.partants === 32, String(ouv.partants));
  const cles = new Set(ouv.grille.flatMap(c => c.joueurs.map(j => j.cle)));
  verifier('tous les conserves attendus sont dans la grille',
    CONSERVES.every(c => cles.has(c)), [...cles].slice(0, 3).join(','));
  verifier('aucun des coupes n est dans la grille',
    COUPES.every(c => !cles.has(c)), [...cles].filter(c => COUPES.includes(c)).join(','));
}

console.log(`\n${echecs === 0 ? 'TOUT PASSE' : 'ECHECS'} — ${echecs} echec(s)\n`);
process.exit(echecs === 0 ? 0 : 1);
