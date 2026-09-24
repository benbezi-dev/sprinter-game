// Les partants fictifs d'une serie de championnat courue EN DIRECT : l'un vole
// le depart, les autres courent leur chrono fixe.
//
// Pre-requis : `wrangler dev --local` depuis worker/, et une base de test
// peuplee (`node tools/championnat-peupler.mjs --vider-editions`).
// BASE=http://127.0.0.1:8791 pour viser un autre port.
//
// Le harnais marque trois partants de la serie 1 comme fictifs dans la base de
// TEST locale (player_pays.source = 'fictif'), puis fait courir les cinq
// autres. Ce qu'il cherche a prendre en defaut :
//   - le fictif designe par fauxDepartFictif est sorti par un rappel, sans
//     qu'aucun telephone n'ait rien signale, a l'instant prevu ;
//   - les deux autres fictifs repartent et sont ranges a leur chrono, entre
//     9,05 et 9,15 s ;
//   - le carton du fictif est en base, avec son instant.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chronoFictif, fauxDepartFictif } from '../worker/src/championnats.js';

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

const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': CLE_ADMIN };
const acces = await fetch(B + '/test/admin/creer', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ nom: 'harnais-fictifs' }) }).then(r => r.json());
if (!acces.code) { console.log('pas d acces de test :', acces); process.exit(1); }
const H = { ...ADMIN, 'X-Sprinter-Test': acces.code };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b || {}) })
  .then(r => r.json());
const get = u => fetch(B + u, { headers: H }).then(r => r.json());

function client(chemin, nom, appareil) {
  const c = { nom, moi: null, role: null, etat: null, rappels: [], resultat: null, enregistre: null };
  const q = new URLSearchParams({ name: nom, device: appareil, acces: acces.code });
  c.ws = new WebSocket(`${WS}${chemin}?${q}`);
  c.ouvert = new Promise((res, rej) => {
    c.ws.addEventListener('open', res);
    c.ws.addEventListener('error', rej);
  });
  c.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'bienvenue') { c.moi = m.moi; c.role = m.role; }
    if (m.champ) c.etat = m;
    if (m.t === 'rappel') c.rappels.push(m);
    if (m.t === 'resultat') c.resultat = m;
    if (m.t === 'enregistre') c.enregistre = m;
  });
  c.envoyer = o => { try { c.ws.send(JSON.stringify(o)); } catch { /* fermee */ } };
  return c;
}

async function quand(cond, max = 60000) {
  const fin = Date.now() + max;
  while (Date.now() < fin) { if (cond()) return true; await attendre(50); }
  return false;
}

console.log('\n── FICTIFS : un faux depart, des chronos de 9,05 a 9,15 ──────');

const ouv = await post('/champ/ouvrir', { pays: 'FR', debut: Date.UTC(2026, 8, 5) });
if (ouv.error) {
  console.log('  ', ouv, '\n   → node tools/championnat-peupler.mjs --vider-editions');
  process.exit(1);
}
const ed = await get('/champ/edition/' + ouv.edition);
const grille = ed.partants
  .filter(p => p.phase === ed.phase && p.course === 1)
  .sort((x, y) => (x.rang_duel || 99) - (y.rang_duel || 99));
const fictifs = [grille[2], grille[4], grille[6]].map(p => p.name_key);
const vrais = grille.filter(p => !fictifs.includes(p.name_key));

const sql = fictifs.map(k => `INSERT OR REPLACE INTO player_pays (name_key, pays, continent, source, vu_le)
  VALUES ('${k.replace(/'/g, "''")}', 'FR', 'EU', 'fictif', ${Date.now()});`).join('\n');
execFileSync('npx', ['wrangler', 'd1', 'execute', 'sprinter-leaderboard-test', '--local', '--command', sql],
  { cwd: WORKER, stdio: 'pipe' });

const attendu = fauxDepartFictif(ed.id, ed.phase, 1, fictifs);
const chronos = Object.fromEntries(fictifs.map(k => [k, chronoFictif(ed.id, ed.phase, k, ed.epreuve)]));
console.log(`   edition ${ed.id} · fictifs ${fictifs.join(', ')}`);
console.log(`   attendu : ${attendu.cle} part ${attendu.ms} ms avant le coup`);
ok('le tirage designe un fictif de la course', fictifs.includes(attendu.cle));
ok('entre 30 et 150 ms avant le coup', attendu.ms <= -30 && attendu.ms >= -150, attendu.ms);
ok('chronos des fictifs entre 9,05 et 9,15',
   Object.values(chronos).every(ms => ms >= 9050 && ms <= 9150), JSON.stringify(chronos));
ok('pas de faux depart fictif en finale', fauxDepartFictif(ed.id, 'finale', 1, fictifs) === null);

const chemin = `/champ/salle/${ed.id}/${ed.phase}/1`;
const cl = [];
for (const [i, p] of vrais.entries()) {
  const c = client(chemin, p.nom, 'harnais-fictif-' + i + '-' + Date.now().toString(36));
  await c.ouvert; cl.push(c); await attendre(60);
}
await attendre(300);
ok('les cinq vrais partants courent', cl.every(c => c.role === 'coureur'), cl.map(c => c.role).join(','));

const lance = await post(`${chemin}/lancer?dans=0`);
ok('lancee a la main', lance.ok === true, JSON.stringify(lance));
ok('le pistolet est annonce', await quand(() => cl.every(c => c.etat && c.etat.depart_a), 15000));
const d1 = cl[0].etat.depart_a;
const cibles = Object.fromEntries((cl[0].etat.joueurs || []).filter(j => j.cible_ms).map(j => [j.cle, j.cible_ms]));
ok('les trois fictifs sont en lice avec leur chrono',
   fictifs.every(k => cibles[k] === chronos[k]), JSON.stringify(cibles));

// Les vrais partent au coup, proprement. Personne ne signale rien.
await quand(() => Date.now() >= d1, 90000);
for (const c of cl) c.envoyer({ t: 'pos', d: 1.5, c: 300, n: 1 });

ok('un rappel tombe', await quand(() => cl.every(c => c.rappels.length === 1), 8000),
   cl.map(c => c.rappels.length).join(','));
const r = cl[0].rappels[0] || {};
ok('le fautif est le fictif tire', (r.fautifs || []).length === 1 && r.fautifs[0].cle === attendu.cle,
   JSON.stringify(r.fautifs));
ok('a l\'instant prevu', r.fautifs && r.fautifs[0] && r.fautifs[0].ms === attendu.ms);
ok('un nouveau depart, numero 2', r.depart_n === 2, r.depart_n);
const apresRappel = (r.joueurs || []).find(j => j.cle === attendu.cle);
ok('le fautif est dq, sans chrono vise', !!apresRappel && apresRappel.statut === 'dq' && !apresRappel.cible_ms,
   JSON.stringify(apresRappel));
const d2 = r.depart_a;

await quand(() => Date.now() >= d2 + 100, 20000);
ok('pas de second rappel', cl.every(c => c.rappels.length === 1));
for (let k = 1; k <= 5; k++) {
  for (const c of cl) c.envoyer({ t: 'pos', d: k * 18, c: k * 1700, n: 2 });
  await attendre(80);
}
for (const [j, c] of cl.entries()) c.envoyer({ t: 'fini', ms: 8800 + j * 111, n: 2 });

ok('le resultat arrive', await quand(() => cl[0].resultat, 15000));
const cla = (cl[0].resultat || {}).classement || [];
console.log('   ' + cla.map(l => `${l.place ?? '—'} ${l.nom} ${l.motif || (l.ms / 1000).toFixed(3)}`).join(' | '));
for (const k of fictifs.filter(k => k !== attendu.cle)) {
  const l = cla.find(x => x.cle === k);
  ok(`${k} range a ${chronos[k]} ms`, l && l.ms === chronos[k], JSON.stringify(l));
}
const lf = cla.find(x => x.cle === attendu.cle);
ok('le fictif fautif ferme la marche en carton rouge', lf && lf.motif === 'faux_depart' && lf.abandon);

ok('la salle a range la course', await quand(() => cl[0].enregistre, 8000) && cl[0].enregistre.ok,
   JSON.stringify(cl[0].enregistre));
const apres = await get('/champ/edition/' + ed.id);
const lignes = apres.resultats.filter(x => x.phase === ed.phase && x.course === 1);
const carton = lignes.find(x => x.name_key === attendu.cle);
ok('le carton du fictif est en base, avec son instant',
   carton && carton.motif === 'faux_depart' && carton.motif_ms === attendu.ms && carton.ms == null,
   JSON.stringify(carton));
ok('huit lignes en base', lignes.length === 8, lignes.length);
for (const c of cl) try { c.ws.close(); } catch { }

console.log(echecs ? `\n✗ ${echecs} echec(s)` : '\n✓ TOUT PASSE');
process.exit(echecs ? 1 : 0);
