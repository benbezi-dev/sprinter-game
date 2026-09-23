// Les partants fictifs d'une grille completee, courus en direct — et la
// course que personne n'est venu courir, rangee par la tache planifiee.
//
// BASE DE TEST LOCALE UNIQUEMENT : le harnais marque des partants `fictif`
// dans player_pays par `wrangler d1 execute --local`, comme le peupleur.
//
// Pre-requis : `wrangler dev --local --test-scheduled --port 8791` depuis
// worker/, et `node tools/championnat-peupler.mjs --vider-editions`.
//
//   C. deux vrais presents, trois vrais absents, trois fictifs : les fictifs
//      courent a leur chrono fixe, les absents sont forfaits, et le verdict
//      attend que le dernier fictif ait franchi la ligne.
//   D. personne ne vient : la tache planifiee range la course un quart
//      d'heure apres l'heure — les fictifs avec leur chrono, les autres en
//      forfait.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const B = process.env.BASE || 'http://127.0.0.1:8791';
const WS = B.replace(/^http/, 'ws');
const CLE_ADMIN = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';
const WORKER = join(fileURLToPath(new URL('..', import.meta.url)), 'worker');
const attendre = ms => new Promise(r => setTimeout(r, ms));
let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || detail == null ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};
const sql = (q) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'sprinter-leaderboard-test',
  '--local', '--command', q], { cwd: WORKER, stdio: ['ignore', 'pipe', 'pipe'] });

const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': CLE_ADMIN };
const acces = await fetch(B + '/test/admin/creer', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ nom: 'harnais-fictifs' }) }).then(r => r.json());
const H = { ...ADMIN, 'X-Sprinter-Test': acces.code };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b || {}) }).then(r => r.json());
const get = u => fetch(B + u, { headers: H }).then(r => r.json());

const ouv = await post('/champ/ouvrir', { pays: 'FR', debut: Date.UTC(2026, 8, 5) });
if (ouv.error) { console.log(ouv, '→ node tools/championnat-peupler.mjs --vider-editions'); process.exit(1); }
const ed = await get('/champ/edition/' + ouv.edition);
const grilleDe = n => ed.partants.filter(p => p.phase === ed.phase && p.course === n)
  .sort((x, y) => (x.rang_duel || 99) - (y.rang_duel || 99));

console.log('\n── C. serie 3 : deux presents, trois absents, trois fictifs ──');
{
  const g = grilleDe(3);
  const fictifs = [g[1], g[4], g[6]];
  const presents = [g[0], g[3]];
  sql(`UPDATE player_pays SET source = 'fictif' WHERE name_key IN (${fictifs.map(p => `'${p.name_key.replace(/'/g, "''")}'`).join(',')})`);
  const chemin = `/champ/salle/${ed.id}/${ed.phase}/3`;
  const cl = [];
  for (const [i, p] of presents.entries()) {
    const c = { etat: null, resultat: null, enregistre: null };
    c.ws = new WebSocket(`${WS}${chemin}?${new URLSearchParams({ name: p.nom, device: 'hf-' + i + Date.now().toString(36), acces: acces.code })}`);
    await new Promise(r => c.ws.addEventListener('open', r));
    c.ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.champ) c.etat = m;
      if (m.t === 'resultat') { c.resultat = m; c.recuA = Date.now(); }
      if (m.t === 'enregistre') c.enregistre = m;
    });
    c.envoyer = o => c.ws.send(JSON.stringify(o));
    cl.push(c);
  }
  await attendre(300);
  const avant = cl[0].etat.champ.grille;
  ok('les fictifs sont annonces engages dans la chambre d\'appel',
     fictifs.every(f => avant.find(x => x.cle === f.name_key).present));
  await post(`${chemin}/lancer?dans=0`);
  const t0 = Date.now();
  while (Date.now() - t0 < 20000 && !cl[0].etat?.depart_a) await attendre(50);
  const d1 = cl[0].etat.depart_a;
  const joueurs = cl[0].etat.joueurs;
  const cibles = fictifs.map(f => (joueurs.find(j => j.id === f.name_key) || {}).cible_ms);
  ok('chaque fictif porte son chrono vise', cibles.every(x => x > 10000 && x < 11500), cibles.join(','));
  ok('cinq forfaits... non : trois forfaits (les vrais absents)',
     cl[0].etat.champ.grille.filter(x => x.statut === 'forfait').length === 3);
  while (Date.now() < d1 + 50) await attendre(20);
  cl[0].envoyer({ t: 'fini', ms: 9800, n: 1 });
  cl[1].envoyer({ t: 'fini', ms: 10050, n: 1 });
  while (Date.now() - t0 < 60000 && !cl[0].resultat) await attendre(50);
  const plusLent = Math.max(...cibles);
  ok('le verdict attend le dernier fictif', cl[0].recuA - d1 >= plusLent,
     `${cl[0].recuA - d1} ms apres le coup, dernier fictif a ${plusLent}`);
  const cla = cl[0].resultat.classement;
  console.log('   ' + cla.map(l => `${l.place ?? '—'} ${l.nom} ${l.motif || (l.ms / 1000).toFixed(3)}`).join(' | '));
  ok('deux vrais et trois fictifs classes au chrono', cla.filter(l => l.place).length === 5);
  ok('trois forfaits sans rang', cla.filter(l => l.motif === 'forfait').length === 3);
  while (Date.now() - t0 < 70000 && !cl[0].enregistre) await attendre(50);
  ok('rangee', cl[0].enregistre && cl[0].enregistre.ok, JSON.stringify(cl[0].enregistre));
  const apres = await get('/champ/edition/' + ed.id);
  const lignes = apres.resultats.filter(r => r.phase === ed.phase && r.course === 3);
  ok('les chronos des fictifs sont en base, tels qu\'annonces',
     fictifs.every((f, i) => (lignes.find(r => r.name_key === f.name_key) || {}).ms === cibles[i]));
  for (const c of cl) c.ws.close();
}

console.log('\n── D. serie 4 : personne ne vient ─────────────────────────');
{
  const g = grilleDe(4);
  const fictifs = [g[2], g[5]];
  sql(`UPDATE player_pays SET source = 'fictif' WHERE name_key IN (${fictifs.map(p => `'${p.name_key.replace(/'/g, "''")}'`).join(',')})`);
  const rv = ed.calendrier.find(r => r.phase === ed.phase && r.course === 4);
  const rv1 = ed.calendrier.find(r => r.phase === ed.phase && r.course === 1);
  // La tache planifiee a une heure choisie : la route d'admin appelle la
  // meme fonction (le simulateur local ignore l'heure passee a __scheduled).
  const cron = t => fetch(`${B}/champ/ranger`, { method: 'POST', headers: H, body: JSON.stringify({ maintenant: t }) });
  // Avant l'heure : rien ne se range.
  const r1 = await cron(rv1.at - 60 * 60 * 1000);
  await attendre(1200);
  const avant = await get('/champ/edition/' + ed.id);
  ok('avant l\'heure, rien n\'est range', r1.ok &&
     !avant.resultats.some(r => r.phase === ed.phase && [1, 2, 4].includes(r.course)));
  // Vingt minutes apres la serie 4 : les series 1, 2 et 4 du meme jour, que
  // personne n'a courues, sont rangees ; la 3 l'a deja ete par sa salle.
  const r0 = await cron(rv.at + 20 * 60 * 1000);
  ok('la tache planifiee repond', r0.ok, r0.status);
  await attendre(2000);
  const apres = await get('/champ/edition/' + ed.id);
  const lignes = apres.resultats.filter(r => r.phase === ed.phase && r.course === 4);
  console.log('   ' + lignes.map(r => `${r.name_key} ${r.ms ?? r.motif}`).join(' | '));
  ok('la serie 4 est rangee', lignes.length === g.length, lignes.length);
  ok('ses fictifs ont un chrono', fictifs.every(f => (lignes.find(r => r.name_key === f.name_key) || {}).ms > 10000));
  ok('les autres sont forfaits', lignes.filter(r => r.motif === 'forfait').length === g.length - fictifs.length);
  ok('les series 1 et 2 aussi', [1, 2].every(n => apres.resultats.some(r => r.phase === ed.phase && r.course === n)));
  const s3 = apres.resultats.filter(r => r.phase === ed.phase && r.course === 3);
  ok('la serie 3, courue en direct, n\'a pas ete retouchee', s3.filter(r => r.ms != null).length === 5);
}

// Rendre la base comme on l'a trouvee : les autres harnais font courir ces
// partants comme de vrais joueurs.
sql(`UPDATE player_pays SET source = 'harnais' WHERE source = 'fictif'`);

console.log(echecs ? `\n✗ ${echecs} ECHEC(S)` : '\n✓ TOUT PASSE');
process.exit(echecs ? 1 : 0);
