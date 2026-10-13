// Le mot du vainqueur d'un duel EN DIRECT, contre une vraie salle et une vraie base.
//
// Le duel differe avait son mot depuis longtemps ; le direct n'avait que cinq
// secondes de micro ouvert, qui ne s'entendent que si l'autre ecoute a cet
// instant. Le mot s'accroche maintenant a la rencontre que la salle range —
// `LIVE-<salle>-<pistolet>` — et la salle le remet au perdant.
//
// Ce qui doit tenir est le meme cadre que pour le duel differe :
//
//   - seul le VAINQUEUR parle, et une seule fois ;
//   - le mot ne va qu'au PERDANT : ni au vainqueur, ni a un spectateur ;
//   - ce que le perdant a bloque ne lui arrive pas ;
//   - le perdant peut le signaler, et ce signalement en garde la copie ;
//   - une course a plus de deux n'a pas UN perdant : sa forme est refusee.
//
// A lancer contre `wrangler dev --local` : BASE=http://127.0.0.1:8799 node tools/mot-direct-test.mjs
// Six /duel/mot par passage : le limiteur en laisse six par minute et par IP,
// il faut donc une minute entre deux passages.

const B = process.env.BASE || 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const attendre = ms => new Promise(r => setTimeout(r, ms));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);
const post = (u, b) => fetch(B + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
}).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));

const m = Math.random().toString(36).slice(2, 6).toUpperCase();
const GAGNANT = `MD${m}VITE`, PERDANT = `MD${m}LENT`;
// Six echantillons de WAV vide suffisent : le serveur verifie le format, pas l'oreille.
const VOIX = Buffer.from('RIFF0000WAVEfmt data').toString('base64');

function client(code, nom, places = 2) {
  const c = { nom, moi: null, depart: null, resultats: [], mots: [] };
  const q = `name=${encodeURIComponent(nom)}&races=100&level=5&max=${places}`;
  c.ws = new WebSocket(`${WS}/live/${code}?${q}`);
  c.ouvert = new Promise(res => c.ws.addEventListener('open', res));
  c.ws.addEventListener('message', ev => {
    const x = JSON.parse(ev.data);
    if (x.t === 'bienvenue') c.moi = x.moi;
    if (x.depart_a) c.depart = x.depart_a;
    if (x.t === 'resultat') c.resultats.push(x);
    if (x.t === 'mot_duel') c.mots.push(x.mot);
  });
  c.envoyer = o => c.ws.send(JSON.stringify(o));
  return c;
}

async function courir(cs, chronos) {
  for (const c of cs) c.envoyer({ t: 'pret', pret: true });
  for (let i = 0; i < 60 && !cs[0].depart; i++) await attendre(100);
  cs.forEach((c, i) => c.envoyer({ t: 'fini', ms: chronos[i] }));
  for (let i = 0; i < 60 && !cs[0].resultats.length; i++) await attendre(100);
  // La rencontre s'ecrit hors du chemin de l'annonce.
  await attendre(1500);
  return cs[0].resultats[cs[0].resultats.length - 1];
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LE MOT DU VAINQUEUR EN DIRECT                               ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

titre('un duel a deux');
const code = (await fetch(`${B}/live/nouveau`, { method: 'POST' }).then(r => r.json())).id;
const g = client(code, GAGNANT), p = client(code, PERDANT);
await Promise.all([g.ouvert, p.ouvert]);
await attendre(400);
const r = await courir([g, p], [10400, 11300]);
ok('le verdict porte l instant du pistolet', !!r?.course, JSON.stringify(r));
const duel = `LIVE-${code}-${r.course}`;

const parLePerdant = await post('/duel/mot', { id: duel, name: PERDANT, texte: 'pas moi' });
ok('le perdant ne parle pas', parLePerdant.statut === 403, JSON.stringify(parLePerdant));
const parUnTiers = await post('/duel/mot', { id: duel, name: `MD${m}TIERS`, texte: 'moi non plus' });
ok('un tiers non plus', parUnTiers.statut === 403, JSON.stringify(parUnTiers));

const pose = await post('/duel/mot', {
  id: duel.toLowerCase(), name: GAGNANT, texte: 'trop court ce 100', voix: VOIX, voix_type: 'audio/wav',
});
ok('le vainqueur pose son mot, texte et voix', pose.statut === 200 && pose.corps.voix === true,
   JSON.stringify(pose));
for (let i = 0; i < 30 && !p.mots.length; i++) await attendre(100);
ok('la salle le remet au perdant', p.mots.length === 1, `${p.mots.length} mot(s)`);
ok('avec la rencontre, le nom, le texte et la voix',
   p.mots[0]?.duel === duel && p.mots[0]?.nom === GAGNANT
   && p.mots[0]?.texte === 'trop court ce 100' && p.mots[0]?.voix === VOIX
   && p.mots[0]?.voix_type === 'audio/wav', JSON.stringify(p.mots[0])?.slice(0, 200));
ok('le vainqueur ne le recoit pas', g.mots.length === 0, `${g.mots.length} mot(s)`);

const encore = await post('/duel/mot', { id: duel, name: GAGNANT, texte: 'et encore' });
ok('une seule fois', encore.statut === 409, JSON.stringify(encore));

const sig = await post('/moderation/signaler', {
  duel, motif: 'insulte', name: PERDANT, device_id: `md-${m}-perdant-appareil`,
});
ok('le perdant peut le signaler', sig.statut === 200, JSON.stringify(sig));
const sigTiers = await post('/moderation/signaler', {
  duel, motif: 'insulte', name: `MD${m}TIERS`, device_id: `md-${m}-tiers-appareil`,
});
ok('pas un tiers', sigTiers.statut !== 200, JSON.stringify(sigTiers));
g.ws.close(); p.ws.close();

titre('ce que le perdant a bloque ne lui arrive pas');
const code2 = (await fetch(`${B}/live/nouveau`, { method: 'POST' }).then(r => r.json())).id;
const g2 = client(code2, `${GAGNANT}B`), p2 = client(code2, `${PERDANT}B`);
await Promise.all([g2.ouvert, p2.ouvert]);
await attendre(400);
const bloc = await post('/moderation/bloquer', {
  name: `${PERDANT}B`, cible: `${GAGNANT}B`,
});
ok('le blocage est pose', bloc.statut === 200, JSON.stringify(bloc));
const r2 = await courir([g2, p2], [10400, 11300]);
const pose2 = await post('/duel/mot', { id: `LIVE-${code2}-${r2.course}`, name: `${GAGNANT}B`, texte: 'coucou' });
ok('le mot est accepte (le vainqueur n a pas a savoir)', pose2.statut === 200, JSON.stringify(pose2));
await attendre(1500);
ok('mais il n arrive pas', p2.mots.length === 0, `${p2.mots.length} mot(s)`);
g2.ws.close(); p2.ws.close();

titre('a trois, pas de mot');
const code3 = (await fetch(`${B}/live/nouveau`, { method: 'POST' }).then(r => r.json())).id;
const t = [0, 1, 2].map(i => client(code3, `${GAGNANT}T${i}`, 3));
await Promise.all(t.map(x => x.ouvert));
await attendre(400);
const r3 = await courir(t, [10400, 10800, 11300]);
const trois = await post('/duel/mot', {
  id: `LIVE-${code3}-${r3.course}-${t[0].moi}`, name: `${GAGNANT}T0`, texte: 'a tous',
});
ok('la forme a plusieurs est refusee', trois.statut === 400, JSON.stringify(trois));
for (const x of t) x.ws.close();

console.log(`\n${echecs === 0 ? '✓ tout passe' : '✗ ' + echecs + ' echec(s)'}\n`);
process.exit(echecs === 0 ? 0 : 1);
