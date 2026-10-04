// LE TOURNOI A ELIMINATION EN DIRECT, CONTRE LE VRAI SERVEUR.
//
// De trois a huit partants, la piste court des manches et le dernier de
// chacune sort, jusqu'a la finale a deux. Ce harnais joue des tournois entiers
// en parlant le protocole a la main, et verifie ce qui fait un tournoi :
//
//   1. a huit : sept manches, un elimine par manche, la presentation a la
//      premiere et a la finale seulement, des places finales de 1 a 8 ;
//   2. les elimines restent dans la salle, recoivent les positions des autres
//      (c'est ce qui leur permet de regarder), mais ne courent plus : ce
//      qu'ils envoient ne compte pas ;
//   3. on n'entre pas dans un tournoi lance ;
//   4. deux faux departs dans la meme manche sortent ensemble ; tout le monde
//      a egalite, personne ne sort et la manche se recourt ;
//   5. partir, en manche comme en pause, c'est declarer forfait ;
//   6. la manche suivante part d'elle-meme apres la pause, et un retardataire
//      ne bloque pas une manche indefiniment ;
//   7. un tournoi fini se relance quand tout le monde redit oui ;
//   8. une piste a deux qui demande un tournoi court en duel simple.
//
//   cd worker && npx wrangler dev --local --port 8788
//   node tools/direct-tournoi-test.mjs

const B = process.env.BASE || 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const attendre = ms => new Promise(r => setTimeout(r, ms));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);
const jusqua = async (cond, ms = 6000) => {
  for (let t = 0; t < ms && !cond(); t += 50) await attendre(50);
  return cond();
};

const marque = Math.random().toString(36).slice(2, 6).toUpperCase();
const nouvelle = () => fetch(`${B}/live/nouveau`, { method: 'POST' }).then(r => r.json()).then(x => x.id);

/** Un joueur qui parle le protocole a la main. */
function client(code, nom, { places = 8, tournoi = true } = {}) {
  const c = { nom, moi: null, etat: null, departs: [], presentations: [],
              resultats: [], points: [], positions: new Map(), fermee: false };
  const q = `name=${encodeURIComponent(nom)}&races=100&level=5&max=${places}`
          + (tournoi ? '&tournoi=1' : '');
  c.ws = new WebSocket(`${WS}/live/${code}?${q}`);
  c.ouvert = new Promise((res, rej) => {
    c.ws.addEventListener('open', res);
    c.ws.addEventListener('error', rej);
  });
  c.ws.addEventListener('close', () => { c.fermee = true; });
  c.ws.addEventListener('message', ev => {
    const x = JSON.parse(ev.data);
    if (x.t === 'bienvenue') c.moi = x.moi;
    if (x.t === 'bienvenue' || x.t === 'salle' || x.t === 'sorti') {
      c.etat = x;
      if (x.depart_a && !c.departs.includes(x.depart_a)) {
        c.departs.push(x.depart_a);
        c.presentations.push(x.presentation || null);
      }
    }
    if (x.t === 'pos') c.positions.set(x.id, x.d);
    if (x.t === 'resultat') c.resultats.push(x);
    if (x.t === 'duel') c.points.push(x);
  });
  c.envoyer = o => c.ws.send(JSON.stringify(o));
  c.pret = v => c.envoyer({ t: 'pret', pret: v });
  c.fini = ms => c.envoyer({ t: 'fini', ms });
  c.tournoi = () => c.etat?.tournoi || null;
  return c;
}

async function remplir(code, noms, opts) {
  const cl = [];
  for (const n of noms) {
    const c = client(code, n, opts);
    await c.ouvert;
    cl.push(c);
    await attendre(60);
  }
  await jusqua(() => cl.every(c => c.etat?.joueurs?.length === noms.length));
  return cl;
}

/** Fait courir une manche : chacun envoie son chrono, on attend le verdict. */
async function courirManche(coureurs, chronos, temoin) {
  const avant = temoin.resultats.length;
  coureurs.forEach((c, i) => { if (chronos[i] != null) c.fini(chronos[i]); });
  await jusqua(() => temoin.resultats.length > avant);
  return temoin.resultats[temoin.resultats.length - 1];
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  TOURNOI A ELIMINATION EN DIRECT                             ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

/* ------------------------------------------------------------------ 1, 2, 3 */
titre('a huit : sept manches jusqu a la finale');
{
  const code = await nouvelle();
  const NOMS = ['Bakary', 'Leo', 'Nina', 'Omar', 'Zoe', 'Malik', 'Ines', 'Theo'].map(n => n + marque);
  const cl = await remplir(code, NOMS);
  const parId = new Map(cl.map(c => [c.moi, c]));
  const t0 = cl[0].tournoi();
  ok('la piste annonce un tournoi, en inscription', t0?.etat === 'inscription', JSON.stringify(t0));
  ok('tout le monde est en lice avant le depart', cl[0].etat.joueurs.every(j => j.en_lice));

  for (let i = 0; i < 7; i++) cl[i].pret(true);
  await attendre(400);
  ok('a sept prets sur huit, rien ne part', cl.every(c => c.departs.length === 0));
  cl[7].pret(true);
  ok('le huitieme fait partir la manche 1', await jusqua(() => cl.every(c => c.departs.length === 1)));
  ok('la manche 1 est presentee, huit athletes', cl[0].presentations[0]?.ordre?.length === 8);
  ok('le tournoi est en manche 1 sur 7',
     cl[0].tournoi()?.etat === 'manche' && cl[0].tournoi()?.manche === 1 && cl[0].tournoi()?.manches === 7,
     JSON.stringify(cl[0].tournoi()));

  // L'entree est fermee, meme pour un curieux qui passe par l'etat.
  const etat = await (await fetch(`${B}/live/${code}/etat`)).json();
  ok('l etat dit le tournoi en cours, piste complete', etat.en_cours === true && etat.complete === true);

  const couloirs = new Map(cl[0].etat.joueurs.map(j => [j.id, j.couloir]));
  let enLice = cl.slice();
  const sortisDans = [];
  for (let manche = 1; manche <= 7; manche++) {
    if (manche > 1) {
      // Seuls ceux qui courent encore se disent prets : les elimines n'ont
      // pas a le faire, et leur silence ne doit rien retenir.
      const avant = cl[0].departs.length;
      enLice.forEach(c => c.pret(true));
      const parti = await jusqua(() => cl.every(c => c.departs.length === avant + 1));
      ok(`manche ${manche} : partie sur le oui des ${enLice.length} en lice`, parti);
      const pres = cl[0].presentations[cl[0].presentations.length - 1];
      if (manche < 7) ok(`manche ${manche} : pas de presentation`, !pres, JSON.stringify(pres));
      else ok('la finale est presentee, deux athletes', pres?.ordre?.length === 2,
              JSON.stringify(pres?.ordre));
      ok(`manche ${manche} : les couloirs n ont pas bouge`,
         cl[0].etat.joueurs.every(j => couloirs.get(j.id) === j.couloir));
    }
    // Les positions : un elimine les recoit, mais les siennes ne partent pas.
    if (sortisDans.length) {
      const spect = sortisDans[0];
      const coureur = enLice[0];
      spect.positions.clear(); coureur.positions.clear();
      coureur.envoyer({ t: 'pos', d: 12.5, c: 1500 });
      spect.envoyer({ t: 'pos', d: 40, c: 1500 });
      await attendre(250);
      if (manche === 2) {
        ok('un elimine recoit les positions de ceux qui courent', spect.positions.get(coureur.moi) === 12.5);
        ok('les siennes ne partent nulle part', !coureur.positions.has(spect.moi));
      }
      // Et son chrono ne compte pas.
      spect.fini(5000);
    }
    // Le dernier de la liste court le plus lentement : c'est lui qui sort.
    const chronos = enLice.map((_, i) => 9500 + i * 137);
    const r = await courirManche(enLice, chronos, cl[0]);
    ok(`manche ${manche} : verdict rendu, ${enLice.length} partants`,
       r && r.partants === enLice.length && r.classement.length === enLice.length,
       r ? `${r.partants} partants` : 'aucun');
    const sorti = enLice[enLice.length - 1];
    ok(`manche ${manche} : le dernier sort, et lui seul`,
       r.tournoi?.elimines?.length === 1 && r.tournoi.elimines[0] === sorti.moi
       && r.classement.filter(l => l.elimine).map(l => l.id).join() === sorti.moi);
    ok(`manche ${manche} : un elimine n apparait pas au classement`,
       !r.classement.some(l => sortisDans.some(s => s.moi === l.id)));
    sortisDans.push(sorti);
    enLice = enLice.slice(0, -1);
    await jusqua(() => cl[0].tournoi()?.manche === manche && cl[0].tournoi()?.etat !== 'manche');
    const t = cl[0].tournoi();
    if (manche < 7) {
      ok(`manche ${manche} : pause, ${enLice.length} en lice, depart automatique annonce`,
         t.etat === 'pause' && t.en_lice.length === enLice.length && t.prochaine_a > Date.now() + 20000,
         JSON.stringify({ etat: t.etat, n: t.en_lice.length, dans: t.prochaine_a - Date.now() }));
      ok(`manche ${manche} : l elimine est marque hors course`,
         cl[0].etat.joueurs.find(j => j.id === sorti.moi)?.en_lice === false);
    }
  }
  const t = cl[0].tournoi();
  ok('le tournoi est fini', t?.etat === 'fini' && cl[0].resultats.at(-1)?.tournoi?.fini === true);
  ok('le champion est le plus rapide', t?.champion?.id === cl[0].moi, JSON.stringify(t?.champion));
  const places = t.elimines.map(e => [parId.get(e.id)?.nom, e.place, e.manche]);
  ok('les places vont de 8 (manche 1) a 2 (finale)',
     JSON.stringify(t.elimines.map(e => e.place)) === JSON.stringify([8, 7, 6, 5, 4, 3, 2])
     && JSON.stringify(t.elimines.map(e => e.manche)) === JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
     JSON.stringify(places));
  for (const [n, p, m] of places) console.log(`     ${String(p).padStart(2)}. ${n} — sorti en manche ${m}`);
  console.log(`      1. ${t.champion?.nom} — champion`);

  // Les points : chaque manche est une course, chaque paire un duel.
  await jusqua(() => cl[0].points.length >= 7, 15000);
  const duelsDe = (c, k) => (c.points[k]?.joueurs || []).find(x => x.id === c.moi)?.duels?.length;
  ok('manche 1 : sept duels pour chacun', cl.every(c => duelsDe(c, 0) === 7),
     cl.map(c => duelsDe(c, 0)).join(','));
  ok('le champion a des points a chaque manche', cl[0].points.length === 7
     && cl[0].points.every(p => p.joueurs.some(x => x.id === cl[0].moi)));
  ok('le premier elimine ne compte plus apres sa manche',
     cl[7].points.slice(1).every(p => !p.joueurs.some(x => x.id === cl[7].moi)));

  // ------------------------------------------------------------------ 7
  titre('un tournoi fini se relance quand tout le monde redit oui');
  const avant = cl[0].departs.length;
  cl.slice(0, 7).forEach(c => c.pret(true));
  await attendre(400);
  ok('a sept sur huit, rien ne repart', cl[0].departs.length === avant);
  cl[7].pret(true);
  ok('le huitieme relance le tournoi', await jusqua(() => cl[0].departs.length === avant + 1));
  ok('manche 1 d un tournoi neuf, huit en lice, presentee',
     cl[0].tournoi()?.manche === 1 && cl[0].tournoi()?.en_lice?.length === 8
     && cl[0].tournoi()?.elimines?.length === 0 && cl[0].presentations.at(-1)?.ordre?.length === 8,
     JSON.stringify(cl[0].tournoi()));
  for (const c of cl) c.ws.close();
}

/* ---------------------------------------------------------------------- 3 */
titre('on n entre pas dans un tournoi lance');
{
  const code = await nouvelle();
  const cl = await remplir(code, ['A', 'B', 'C'].map(n => `TE${marque}${n}`), { places: 3 });
  cl.forEach(c => c.pret(true));
  await jusqua(() => cl.every(c => c.departs.length === 1));
  await courirManche(cl, [9500, 9600, 9700], cl[0]);
  await jusqua(() => cl[0].tournoi()?.etat === 'pause');
  // Un couloir s'est libere — le troisieme est sorti puis parti — mais la
  // salle ne prend personne pour autant.
  cl[2].ws.close();
  await jusqua(() => cl[0].etat?.joueurs?.length === 2);
  const intrus = client(code, `TE${marque}X`, { places: 3 });
  let refuse = false;
  try { await intrus.ouvert; await attendre(300); refuse = intrus.fermee; } catch { refuse = true; }
  ok('le nouveau venu est refuse', refuse);
  ok('la finale est toujours a deux', cl[0].tournoi()?.en_lice?.length === 2);
  for (const c of cl) c.ws.close();
}

/* ---------------------------------------------------------------------- 4 */
titre('deux faux departs sortent ensemble ; tous ex aequo, on recourt');
{
  const code = await nouvelle();
  const cl = await remplir(code, ['A', 'B', 'C', 'D'].map(n => `FD${marque}${n}`), { places: 4 });
  cl.forEach(c => c.pret(true));
  await jusqua(() => cl.every(c => c.departs.length === 1));
  const avant = cl[0].resultats.length;
  cl[0].fini(9800); cl[1].fini(9900);
  cl[2].envoyer({ t: 'abandon' }); cl[3].envoyer({ t: 'abandon' });
  await jusqua(() => cl[0].resultats.length > avant);
  const r = cl[0].resultats.at(-1);
  ok('les deux fautifs sortent ensemble',
     JSON.stringify([...r.tournoi.elimines].sort()) === JSON.stringify([cl[2].moi, cl[3].moi].sort()));
  const t = cl[0].tournoi();
  ok('ils partagent la troisieme place', t.elimines.every(e => e.place === 3),
     JSON.stringify(t.elimines.map(e => e.place)));
  ok('la suite est deja la finale', t.en_lice.length === 2 && t.manches === 2, JSON.stringify(t));

  // La finale : deux faux departs, personne ne sort, on la recourt.
  cl[0].pret(true); cl[1].pret(true);
  await jusqua(() => cl[0].departs.length === 2);
  const n = cl[0].resultats.length;
  cl[0].envoyer({ t: 'abandon' }); cl[1].envoyer({ t: 'abandon' });
  await jusqua(() => cl[0].resultats.length > n);
  const t2 = cl[0].tournoi();
  ok('tous ex aequo : personne ne sort', cl[0].resultats.at(-1).tournoi.elimines.length === 0);
  ok('la finale se recourt — manche 3 sur 3', t2.etat === 'pause' && t2.en_lice.length === 2
     && t2.manches === 3, JSON.stringify(t2));
  cl[0].pret(true); cl[1].pret(true);
  await jusqua(() => cl[0].departs.length === 3);
  await courirManche([cl[0], cl[1]], [10100, 9900], cl[0]);
  await jusqua(() => cl[0].tournoi()?.etat === 'fini');
  ok('le vainqueur de la finale rejouee est champion', cl[0].tournoi()?.champion?.id === cl[1].moi);
  for (const c of cl) c.ws.close();
}

/* ---------------------------------------------------------------------- 5 */
titre('partir, c est declarer forfait');
{
  const code = await nouvelle();
  const cl = await remplir(code, ['A', 'B', 'C', 'D', 'E'].map(n => `FF${marque}${n}`), { places: 5 });
  cl.forEach(c => c.pret(true));
  await jusqua(() => cl.every(c => c.departs.length === 1));
  // C a franchi la ligne le premier, puis il est parti avant le verdict.
  const avant = cl[0].resultats.length;
  cl[2].fini(9300);
  await attendre(100);
  cl[2].ws.close();
  await attendre(100);
  cl[0].fini(9500); cl[1].fini(9600); cl[3].fini(9900); cl[4].fini(10400);
  await jusqua(() => cl[0].resultats.length > avant);
  const r = cl[0].resultats.at(-1);
  ok('parti en manche : il sort, avec le dernier',
     JSON.stringify([...r.tournoi.elimines].sort()) === JSON.stringify([cl[2].moi, cl[4].moi].sort()),
     JSON.stringify(r.tournoi.elimines));
  ok('le forfait est dit au classement',
     r.classement.find(l => l.id === cl[2].moi)?.motif === 'forfait');
  const t = cl[0].tournoi();
  ok('le dernier au chrono passe devant le forfait, meme plus rapide : 4e et 5e',
     t.elimines.find(e => e.id === cl[4].moi)?.place === 4
     && t.elimines.find(e => e.id === cl[2].moi)?.place === 5,
     JSON.stringify(t.elimines));
  // D part pendant la pause : forfait tout de suite, la finale est formee.
  cl[3].ws.close();
  await jusqua(() => cl[0].tournoi()?.en_lice?.length === 2);
  const t2 = cl[0].tournoi();
  ok('parti en pause : sorti a la 3e place, la suite est une finale',
     t2.elimines.find(e => e.id === cl[3].moi)?.place === 3 && t2.manches === 2,
     JSON.stringify(t2));
  // Et la finale part sur le oui des deux qui restent.
  cl[0].pret(true); cl[1].pret(true);
  ok('la finale part', await jusqua(() => cl[0].departs.length === 2));
  // Puis A part en pleine finale : B est champion des qu'il arrive.
  cl[0].ws.close();
  await attendre(150);
  cl[1].fini(9700);
  ok('le finaliste reste champion par forfait',
     await jusqua(() => cl[1].tournoi()?.etat === 'fini' && cl[1].tournoi()?.champion?.id === cl[1].moi),
     JSON.stringify(cl[1].tournoi()));
  for (const c of cl) try { c.ws.close(); } catch { }
}

/* ---------------------------------------------------------------------- 8 */
titre('a deux, un tournoi demande reste un duel');
{
  const code = await nouvelle();
  const cl = await remplir(code, ['A', 'B'].map(n => `DU${marque}${n}`), { places: 2 });
  ok('pas de tournoi sur une piste a deux', cl[0].etat.tournoi === null, JSON.stringify(cl[0].etat.tournoi));
  cl.forEach(c => c.pret(true));
  await jusqua(() => cl.every(c => c.departs.length === 1));
  const r = await courirManche(cl, [9500, 9700], cl[0]);
  ok('le duel garde son issue historique', r?.issue === 'challenger' && !r.tournoi);
  for (const c of cl) c.ws.close();
}

/* ---------------------------------------------------------------------- 6 */
titre('la manche suivante part seule ; un retardataire ne bloque rien');
{
  const code = await nouvelle();
  const cl = await remplir(code, ['A', 'B', 'C'].map(n => `AU${marque}${n}`), { places: 3 });
  cl.forEach(c => c.pret(true));
  await jusqua(() => cl.every(c => c.departs.length === 1));
  // C ne franchit jamais la ligne : le telephone en veille.
  const t0 = Date.now();
  cl[0].fini(9400); cl[1].fini(9800);
  const tranche = await jusqua(() => cl[0].resultats.length === 1, 26000);
  const delai = Date.now() - t0;
  ok('le retardataire est compte en abandon, vingt secondes apres le premier',
     tranche && delai >= 19000 && delai < 25000, `${Math.round(delai / 100) / 10} s`);
  const r = cl[0].resultats[0];
  ok('et c est lui qui sort', r?.tournoi?.elimines?.[0] === cl[2].moi
     && r.classement.find(l => l.id === cl[2].moi)?.abandon === true);
  // Personne ne se dit pret : la finale part d'elle-meme.
  const pause = cl[0].tournoi()?.prochaine_a;
  console.log('   … personne ne se dit pret, on attend le depart automatique');
  const partie = await jusqua(() => cl[0].departs.length === 2, 36000);
  ok('la finale part d elle-meme a l heure annoncee', partie
     && Math.abs(Date.now() - pause) < 2500, pause ? `${Date.now() - pause} ms d'ecart` : 'aucune heure');
  ok('presentee, a deux', cl[0].presentations.at(-1)?.ordre?.length === 2);
  for (const c of cl) c.ws.close();
}

console.log('\n' + '─'.repeat(62));
console.log(echecs === 0 ? '   TOUT PASSE.' : `   ${echecs} VERIFICATION(S) EN ECHEC.`);
console.log('');
process.exit(echecs ? 1 : 0);
