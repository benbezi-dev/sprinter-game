// Une serie de championnat courue EN DIRECT, avec ses faux departs, contre le
// vrai serveur.
//
// Pre-requis : `wrangler dev --local` depuis worker/, et une base de test
// peuplee (`node tools/championnat-peupler.mjs`, `--vider-editions` pour
// rejouer). BASE=http://127.0.0.1:8791 pour viser un autre port.
//
// Ce que le harnais cherche a prendre en defaut :
//   A. deux fautifs sur le meme depart sortent TOUS LES DEUX, les autres
//      reviennent sur la ligne et repartent ; une position du depart annule,
//      arrivee apres le rappel, ne disqualifie personne ; un spectateur ne
//      peut rien signaler ; l'arrivee range chronos, abandon et cartons.
//   B. les absents a l'appel sont forfaits ; le controle dur attrape un
//      coureur qui AVANCE avant le pistolet, sans signalement.

const B = process.env.BASE || 'http://127.0.0.1:8791';
const WS = B.replace(/^http/, 'ws');
const CLE_ADMIN = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';
const attendre = ms => new Promise(r => setTimeout(r, ms));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || detail == null ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': CLE_ADMIN };
const acces = await fetch(B + '/test/admin/creer', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ nom: 'harnais-faux-depart' }) }).then(r => r.json());
if (!acces.code) { console.log('pas d acces de test :', acces); process.exit(1); }
const H = { ...ADMIN, 'X-Sprinter-Test': acces.code };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b || {}) })
  .then(r => r.json());
const get = u => fetch(B + u, { headers: H }).then(r => r.json());

function client(chemin, nom, appareil) {
  const c = { nom, moi: null, role: null, etat: null, rappels: [], resultat: null,
              enregistre: null, positions: new Map(), fermee: false };
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
    if (m.t === 'pos') c.positions.set(m.id, m.d);
  });
  c.ws.addEventListener('close', () => { c.fermee = true; });
  c.envoyer = o => { try { c.ws.send(JSON.stringify(o)); } catch { /* fermee */ } };
  return c;
}

/** Attend qu'une condition soit vraie, ou abandonne apres `max` ms. */
async function quand(cond, max = 60000) {
  const fin = Date.now() + max;
  while (Date.now() < fin) { if (cond()) return true; await attendre(50); }
  return false;
}

/** L'heure de la salle vue par un client : son horloge envoyee dans l'etat. */
const departDe = c => c.etat && c.etat.depart_a;

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  CHAMPIONNAT EN DIRECT — LE FAUX DEPART                      ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const samedi = Date.UTC(2026, 8, 5);
const ouv = await post('/champ/ouvrir', { pays: 'FR', debut: samedi });
if (ouv.error) {
  console.log('  ', ouv);
  console.log('   → base vide ou edition deja ouverte : node tools/championnat-peupler.mjs --vider-editions');
  process.exit(1);
}
const ed = await get('/champ/edition/' + ouv.edition);
console.log(`   edition ${ed.id}, phase ${ed.phase}, ${ed.partants.length} partants\n`);

const grilleDe = course => ed.partants
  .filter(p => p.phase === ed.phase && p.course === course)
  .sort((x, y) => (x.rang_duel || 99) - (y.rang_duel || 99));

/* ═════════════════════════════════════════════════════════════════════════
   A. HUIT PRESENTS, DEUX FAUTIFS, UN RAPPEL
   ═════════════════════════════════════════════════════════════════════════ */
{
  console.log('── A. serie 1 : deux fautifs sur le meme depart ─────────────');
  const chemin = `/champ/salle/${ed.id}/${ed.phase}/1`;
  const grille = grilleDe(1);
  const cl = [];
  for (const [i, p] of grille.entries()) {
    const c = client(chemin, p.nom, 'harnais-a-' + i + '-' + Date.now().toString(36));
    await c.ouvert; cl.push(c); await attendre(60);
  }
  const badaud = client(chemin, 'Badaud', 'harnais-badaud-' + Date.now().toString(36));
  await badaud.ouvert;
  await attendre(300);

  ok('les huit partants courent', cl.every(c => c.role === 'coureur'),
     cl.map(c => c.role).join(','));
  ok('le visiteur regarde', badaud.role === 'spectateur', badaud.role);
  ok('couloirs du semis, 1 a 8', cl.every((c, i) =>
       (c.etat.champ.grille.find(g => g.cle === c.moi) || {}).couloir === i + 1));

  const lance = await post(`${chemin}/lancer?dans=0`);
  ok('lancee a la main', lance.ok === true, JSON.stringify(lance));

  ok('le pistolet est annonce', await quand(() => cl.every(c => departDe(c)), 15000));
  const d1 = departDe(cl[0]);
  ok('une presentation de huit precede le pistolet',
     !!cl[0].etat.presentation && cl[0].etat.presentation.ordre.length === 8);
  console.log(`   pistolet dans ${((d1 - Date.now()) / 1000).toFixed(1)} s`);

  // Le badaud signale un faux depart : il n'en a pas le droit.
  await quand(() => Date.now() > d1 - 2500, 60000);
  badaud.envoyer({ t: 'faux_depart', ms: -900, n: 1 });
  // Deux fautifs, a 300 ms l'un de l'autre, avant le coup.
  await quand(() => Date.now() > d1 - 1200, 5000);
  cl[1].envoyer({ t: 'faux_depart', ms: -1200, n: 1 });
  await attendre(300);
  cl[4].envoyer({ t: 'faux_depart', ms: -900, n: 1 });

  // Les autres partent au coup, comme si de rien n'etait.
  await quand(() => Date.now() >= d1, 5000);
  for (const [i, c] of cl.entries()) if (i !== 1 && i !== 4) c.envoyer({ t: 'pos', d: 1.5, c: 300, n: 1 });

  ok('le rappel tombe chez tout le monde', await quand(() => cl.every(c => c.rappels.length === 1), 5000));
  const r = cl[0].rappels[0] || {};
  const noms = (r.fautifs || []).map(f => f.cle).sort();
  ok('les DEUX fautifs sont sortis', noms.length === 2 &&
     noms.includes(cl[1].moi) && noms.includes(cl[4].moi), JSON.stringify(noms));
  ok('le badaud n\'a fait sortir personne', !noms.includes(badaud.moi));
  ok('l\'instant du faux depart est garde', (r.fautifs || []).some(f => f.ms === -1200));
  ok('le rappel tombe APRES le coup', !!r.horloge && r.horloge >= d1, `${r.horloge - d1} ms`);
  ok('un nouveau depart, numero 2', r.depart_n === 2 && r.depart_a > Date.now(),
     `n=${r.depart_n}`);
  const d2 = r.depart_a;

  // Une position du depart ANNULE, arrivee apres le rappel : elle ne compte
  // pas, et surtout ne declenche pas le controle dur.
  cl[0].envoyer({ t: 'pos', d: 6, c: 800, n: 1 });
  // Un fautif tente de courir quand meme : il est spectateur.
  cl[1].envoyer({ t: 'pos', d: 3, c: 400, n: 2 });

  await quand(() => Date.now() >= d2 + 100, 15000);
  ok('pas de second rappel', cl.every(c => c.rappels.length === 1),
     cl.map(c => c.rappels.length).join(','));

  // La course, pour les six restants. Le couloir 8 abandonne en route.
  const restants = cl.filter((_, i) => i !== 1 && i !== 4);
  for (let k = 1; k <= 5; k++) {
    for (const c of restants) c.envoyer({ t: 'pos', d: k * 18, c: k * 2000, n: 2 });
    await attendre(80);
  }
  cl[7].ws.close();
  await attendre(200);
  for (const [j, c] of restants.entries()) {
    if (c === cl[7]) continue;
    c.envoyer({ t: 'fini', ms: 10100 + j * 37, n: 2 });
  }
  // Un chrono envoye par un fautif ne compte pas.
  cl[4].envoyer({ t: 'fini', ms: 9000, n: 2 });

  ok('le resultat arrive', await quand(() => cl[0].resultat, 8000));
  const cla = (cl[0].resultat || {}).classement || [];
  console.log('   ' + cla.map(l => `${l.place ?? '—'} ${l.nom} ${l.motif || (l.ms / 1000).toFixed(3)}`).join(' | '));
  ok('cinq arrives classes 1 a 5', cla.filter(l => l.place).map(l => l.place).join() === '1,2,3,4,5');
  ok('l\'abandon vient avant les cartons', cla[5] && cla[5].motif === 'abandon' && cla[5].cle === cl[7].moi);
  ok('les deux cartons rouges ferment la marche',
     cla.slice(6).every(l => l.motif === 'faux_depart') && cla.length === 8);
  ok('le chrono du fautif n\'a pas ete pris', !cla.some(l => l.ms === 9000));

  ok('la salle a range la course', await quand(() => cl[0].enregistre, 8000) && cl[0].enregistre.ok,
     JSON.stringify(cl[0].enregistre));
  const apres = await get('/champ/edition/' + ed.id);
  const lignes = apres.resultats.filter(x => x.phase === ed.phase && x.course === 1);
  ok('huit lignes en base', lignes.length === 8, lignes.length);
  const fd = lignes.filter(x => x.motif === 'faux_depart');
  ok('les cartons sont en base, avec leur instant',
     fd.length === 2 && fd.some(x => x.motif_ms === -1200) && fd.every(x => x.ms == null),
     JSON.stringify(fd));
  ok('l\'abandon est en base', lignes.some(x => x.motif === 'abandon' && x.name_key === cl[7].moi));

  const rejoue = await post(`${chemin}/lancer?dans=0`);
  ok('une course rangee ne se recourt pas', !!rejoue.error, JSON.stringify(rejoue));
  for (const c of [...cl, badaud]) try { c.ws.close(); } catch { }
  console.log();
}

/* ═════════════════════════════════════════════════════════════════════════
   B. TROIS PRESENTS, CINQ FORFAITS, LE CONTROLE DUR
   ═════════════════════════════════════════════════════════════════════════ */
{
  console.log('── B. serie 2 : forfaits et controle dur ────────────────────');
  const chemin = `/champ/salle/${ed.id}/${ed.phase}/2`;
  const grille = grilleDe(2);
  const presents = [grille[0], grille[3], grille[6]];
  const cl = [];
  for (const [i, p] of presents.entries()) {
    const c = client(chemin, p.nom, 'harnais-b-' + i + '-' + Date.now().toString(36));
    await c.ouvert; cl.push(c); await attendre(60);
  }
  await attendre(200);
  await post(`${chemin}/lancer?dans=0`);
  ok('le pistolet est annonce', await quand(() => cl.every(c => departDe(c)), 15000));
  const d1 = departDe(cl[0]);
  const forfaits = cl[0].etat.champ.grille.filter(g => g.statut === 'forfait');
  ok('cinq forfaits a l\'appel', forfaits.length === 5, forfaits.length);
  ok('presentation de trois seulement', cl[0].etat.presentation.ordre.length === 3);

  // Le couloir 4 avance d'un bon metre une seconde avant le coup, sans rien
  // signaler : le controle dur doit le voir.
  await quand(() => Date.now() > d1 - 1000, 60000);
  cl[1].envoyer({ t: 'pos', d: 3.2, c: 250, n: 1 });

  ok('rappel sur controle dur', await quand(() => cl[0].rappels.length === 1, 5000));
  const r = cl[0].rappels[0] || {};
  ok('c\'est bien lui', (r.fautifs || []).length === 1 && r.fautifs[0].cle === cl[1].moi,
     JSON.stringify(r.fautifs));
  await quand(() => Date.now() >= r.depart_a + 100, 15000);
  cl[0].envoyer({ t: 'fini', ms: 10500, n: 2 });
  cl[2].envoyer({ t: 'fini', ms: 10420, n: 2 });
  ok('le resultat arrive', await quand(() => cl[0].resultat, 8000));
  const cla = (cl[0].resultat || {}).classement || [];
  console.log('   ' + cla.map(l => `${l.place ?? '—'} ${l.nom} ${l.motif || (l.ms / 1000).toFixed(3)}`).join(' | '));
  ok('deux arrives, dans l\'ordre du chrono',
     cla[0] && cla[0].cle === cl[2].moi && cla[1] && cla[1].cle === cl[0].moi);
  ok('puis le carton, puis cinq forfaits',
     cla[2] && cla[2].motif === 'faux_depart' && cla.slice(3).every(l => l.motif === 'forfait')
     && cla.length === 8);
  ok('rangee', await quand(() => cl[0].enregistre, 8000) && cl[0].enregistre.ok,
     JSON.stringify(cl[0].enregistre));
  for (const c of cl) try { c.ws.close(); } catch { }
  console.log();
}

console.log(echecs ? `✗ ${echecs} ECHEC(S)` : '✓ TOUT PASSE');
process.exit(echecs ? 1 : 0);
