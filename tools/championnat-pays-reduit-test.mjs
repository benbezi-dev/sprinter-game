// Le repli d'une premiere edition nationale trop petite, contre le vrai
// serveur : moins de 32 joueurs, mais assez pour un format reduit — puis, a
// la deuxieme edition, le retour a l'exigence stricte de 32.
const B = 'http://127.0.0.1:8788';
const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...H },
  body: JSON.stringify(b) }).then(r => r.json());
const get = u => fetch(B + u, { headers: H }).then(r => r.json());

const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': 'cle-de-test-locale-uniquement' };
const _acces = await fetch(B + '/test/admin/creer', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ nom: 'harnais-reduit' }) }).then(r => r.json());
await fetch(B + '/test/admin/role', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ code: _acces.code, role: 'organisateur' }) });
const H = { 'X-Sprinter-Test': _acces.code };

let echecs = 0;
function verifier(nom, condition, detail) {
  if (condition) { console.log(`   ✓ ${nom}`); }
  else { console.log(`   ✗ ${nom}${detail ? ' — ' + detail : ''}`); echecs++; }
}

const samedi = Date.UTC(2026, 8, 5);
let graine = 777;
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/** Deroule une edition entiere, de la premiere course au sacre. */
async function courir(id) {
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
        if (niveau[p.name_key] == null) niveau[p.name_key] = 9400 + (p.rang_duel || 8) * 20;
        return { cle: p.name_key, ms: Math.round(niveau[p.name_key] + (hasard() - 0.5) * 300) };
      });
      const r = await post('/champ/course', { edition: id, phase: etat.phase, course: c, chronos });
      if (r.error) return { erreur: r.error + ' (course ' + c + ')' };
    }
    const cl = await post('/champ/cloturer', { edition: id });
    if (cl.error) return { erreur: cl.error };
    if (cl.finale) return { champion: cl.champion, libelle: cl.libelle, podium: cl.podium, classement: cl.classement };
  }
  return { erreur: 'trop de phases' };
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  PREMIERE EDITION REDUITE — moins de 32 joueurs               ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

console.log('\n── UN PAYS AVEC 10 JOUEURS, JAMAIS OUVERT ───────────────────');
const ouv = await post('/champ/ouvrir', { pays: 'LU', debut: samedi });
verifier('la premiere edition s ouvre malgre l effectif reduit', !ouv.error, JSON.stringify(ouv).slice(0, 120));
if (!ouv.error) {
  verifier('10 partants exactement', ouv.partants === 10, String(ouv.partants));
  verifier('le drapeau reduit est pose', ouv.reduit === true);
  console.log(`   édition ${ouv.edition} — ${ouv.partants} partants`);
  for (const c of ouv.grille) {
    console.log(`   série ${c.course} : ` + c.joueurs.map(j => j.nom).join(', '));
  }

  const r = await courir(ouv.edition);
  verifier('la competition va jusqu au sacre', !r.erreur && !!r.champion, JSON.stringify(r));
  if (!r.erreur) {
    verifier('le podium ne depasse pas 3', r.podium.length <= 3, String(r.podium.length));
    verifier('la finale ne depasse pas 8 couloirs', r.classement.length <= 8, String(r.classement.length));
    console.log(`   champion : ${r.champion} — podium : ${r.podium.map(p => p.nom).join(', ')}`);
  }
}

console.log('\n── LE MEME PAYS, UNE DEUXIEME FOIS ──────────────────────────');
const ouv2 = await post('/champ/ouvrir', { pays: 'LU', debut: samedi + 30 * 24 * 3600 * 1000 });
verifier('la deuxieme edition exige a nouveau 32 joueurs',
  ouv2.error === 'pays trop petit' && ouv2.requis === 32, JSON.stringify(ouv2));

console.log('\n── UN PAYS SOUS LE PLANCHER ABSOLU (3 JOUEURS) ──────────────');
const ouv3 = await post('/champ/ouvrir', { pays: 'AD', debut: samedi });
verifier('sous 4 joueurs, meme une premiere edition est refusee',
  ouv3.error === 'pays trop petit' && ouv3.requis === 4, JSON.stringify(ouv3));

console.log(`\n${echecs === 0 ? 'TOUT PASSE' : 'ECHECS'} — ${echecs} echec(s)\n`);
process.exit(echecs === 0 ? 0 : 1);
