// Répétition : deux championnats de France le même weekend (60 m + 200 m salle),
// le cas d'un duel des épreuves fini à égalité (08/11/2026).
//
//   node tools/championnat-peupler.mjs --vider-editions && node tools/championnat-peupler.mjs
//   ADMIN_CLE=<worker/.dev.vars> BASE=http://127.0.0.1:8788 node tools/championnat-double-test.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const B = process.env.BASE || 'http://127.0.0.1:8788';
const WORKER = fileURLToPath(new URL('../worker', import.meta.url));
const CLE_ADMIN = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';
const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': CLE_ADMIN };
const acces = await fetch(B + '/test/admin/creer', { method: 'POST', headers: ADMIN, body: JSON.stringify({ nom: 'double' }) }).then(r => r.json());
const H = { 'X-Sprinter-Test': acces.code, 'X-Sprinter-Admin': CLE_ADMIN };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...H }, body: JSON.stringify(b) }).then(r => r.json());
const get = u => fetch(B + u, { headers: H }).then(r => r.json());
const sql = q => JSON.parse(execFileSync('npx', ['wrangler', 'd1', 'execute', 'sprinter-leaderboard-test', '--local', '--json', '--command', q],
  { cwd: WORKER, stdio: ['ignore', 'pipe', 'ignore'] }).toString())[0].results;
let ok = 0, ko = 0;
const verif = (cond, msg) => { cond ? ok++ : ko++; console.log(`   ${cond ? 'OK ' : 'ÉCHEC'} ${msg}`); };

await get('/champ/prochain?pays=FR');   // crée les tables et les colonnes neuves
// Le tenant : un titre « Champion de France » sans épreuve (comme celui du 100 m du 27/09).
const [t0] = sql(`SELECT p.name_key AS cle FROM player_pays p JOIN duel_players d ON d.name_key = p.name_key AND d.epreuve = '60'
                   WHERE p.pays = 'FR' ORDER BY d.mmr DESC LIMIT 1 OFFSET 3`);
const maintenant = Date.now();
sql(`INSERT INTO champ_titres (echelon, zone, name_key, nom, libelle, edition, sacre_le, expire_le)
     VALUES ('national', 'FR', '${t0.cle}', '${t0.cle}', 'Champion de France', 'ANCIEN', ${maintenant - 40 * 864e5}, ${maintenant + 60 * 864e5})`);
console.log(`Tenant posé : ${t0.cle}`);

const samedi = Date.UTC(2026, 8, 5);
const e60 = await post('/champ/ouvrir', { pays: 'FR', debut: samedi, epreuve: '60' });
const e200 = await post('/champ/ouvrir', { pays: 'FR', debut: samedi, epreuve: '200s' });
const bis = await post('/champ/ouvrir', { pays: 'FR', debut: samedi, epreuve: '60' });
const autre = await post('/champ/ouvrir', { pays: 'FR', debut: samedi + 7 * 864e5, epreuve: '400s' });
verif(e60.edition && e200.edition, `deux éditions ouvertes : ${e60.edition} (60) et ${e200.edition} (200s)`);
verif(bis.error === 'edition deja ouverte', `un 2e 60 m le même weekend refusé (${bis.error})`);
verif(autre.error === 'edition deja ouverte', `un autre weekend refusé tant que celui-ci court (${autre.error})`);

const s60 = await get('/champ/edition/' + e60.edition), s200 = await get('/champ/edition/' + e200.edition);
const premier = s => s.calendrier.find(r => r.cle === 'serie-1').at;
verif(premier(s200) - premier(s60) === 45 * 60e3, `200 m décalé de 45 min (${new Date(premier(s60)).toISOString().slice(11,16)} / ${new Date(premier(s200)).toISOString().slice(11,16)} UTC)`);
const finale = s => s.calendrier.find(r => r.cle === 'finale').at;
verif(finale(s200) - finale(s60) === 45 * 60e3, 'finales décalées de 45 min');
const tenantDe = s => s.partants.filter(p => p.tenant).map(p => p.name_key);
verif(tenantDe(s60).includes(t0.cle), `tenant en lice au 60 m (${tenantDe(s60)})`);
verif(tenantDe(s200).length === 0, 'aucun tenant au 200 m');
const communs = s60.partants.map(p => p.name_key).filter(k => s200.partants.some(p => p.name_key === k));
console.log(`   ${communs.length} joueurs sélectionnés dans les deux`);
if (communs.length) {
  const m = await get('/champ/mien?name=' + encodeURIComponent(communs[0]));
  verif(m.editions?.length === 2 && m.edition === e60.edition, `/champ/mien rend les deux, le 60 m d'abord (${JSON.stringify(m)})`);
}

let graine = 4242;
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const base = { [e60.edition]: 6900, [e200.edition]: 21500 };
async function phase(ed, n) {
  const etat = await get('/champ/edition/' + ed);
  for (let c = 1; c <= n; c++) {
    const ps = etat.partants.filter(p => p.phase === etat.phase && p.course === c);
    const chronos = ps.map((p, i) => ({ cle: p.name_key, ms: Math.round(base[ed] + i * 40 + hasard() * 300) }));
    const r = await post('/champ/course', { edition: ed, phase: etat.phase, course: c, chronos });
    if (r.error) { console.log('   course', ed, etat.phase, c, r); process.exit(1); }
  }
  const cl = await post('/champ/cloturer', { edition: ed });
  if (cl.error) { console.log('   cloture', ed, cl); process.exit(1); }
  return cl;
}
for (const n of [4, 2]) { await phase(e60.edition, n); await phase(e200.edition, n); }
const f60 = await phase(e60.edition, 1);
const f200 = await phase(e200.edition, 1);
console.log(`   60 m : ${f60.champion} — « ${f60.libelle} » (détrôné : ${f60.detrone?.nom ?? 'personne'})`);
console.log(`   200 m : ${f200.champion} — « ${f200.libelle} » (détrôné : ${f200.detrone?.nom ?? 'personne'})`);
verif(f60.libelle === 'Champion de France', 'titre du 60 m = « Champion de France » (lignée du tenant)');
verif(f200.libelle === 'Champion de France du 200 m', 'titre du 200 m nommé par sa distance');
verif(!f200.detrone, 'le sacre du 200 m ne détrône personne');
const vivants = sql(`SELECT name_key, libelle, epreuve FROM champ_titres WHERE zone = 'FR' AND revoque_le IS NULL AND expire_le > ${Date.now()}`);
console.log('   titres vivants :', JSON.stringify(vivants));
verif(vivants.length === 2, 'deux titres vivants : 60 m et 200 m');
verif(!vivants.some(v => v.name_key === t0.cle && v.libelle === 'Champion de France' && f60.champion.toLowerCase() !== t0.cle), 'l\'ancien titre du tenant est remis en jeu au 60 m');
console.log(`\n${ok} OK, ${ko} échec(s)`);
