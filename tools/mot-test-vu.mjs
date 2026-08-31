// Le mot du vainqueur : il arrive, et il arrive entier.
//
// Deux pertes silencieuses corrigees, verifiees ici contre un vrai serveur :
//
//   1. LA VOIX EFFACEE PAR SON AUTEUR. L'effacement suivait « l'un des deux a
//      ferme sa fenetre » — vainqueur compris. On gagne, on parle, on referme
//      son annonce, et l'enregistrement disparaissait avant d'avoir ete
//      entendu. Il suit maintenant `mot_vu`, pose par le destinataire seul.
//   2. LE MOT ARRIVE APRES L'ANNONCE. Le duel se tranche a la ligne
//      d'arrivee ; le mot est depose ensuite. Le perdant qui avait referme son
//      annonce entre les deux ne le recevait jamais.
// WebSocket est fourni par Node depuis la version 22 : rien a installer.

const B = process.env.BASE || 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const ACCES = process.env.ACCES || 'ECRAN1';
const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': ACCES };
let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 54 - t.length))}`);
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b) })
  .then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const lire = u => fetch(B + u, { headers: H }).then(r => r.json());

const s = Math.random().toString(36).slice(2, 6).toUpperCase();
const devA = `aaaa1111-${s}-2222-3333-444444444444`;
const devB = `bbbb1111-${s}-2222-3333-444444444444`;
const nomA = 'MOTA' + s, nomB = 'MOTB' + s;
const voix = Buffer.alloc(2000, 7).toString('base64');   // faux WAV, mais valide en base64

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LE MOT DU VAINQUEUR                                         ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const creer = async (msA) => (await post('/challenge', {
  device_id: devA, name: nomA, races: ['100'], level_idx: 4,
  total_ms: msA, splits: [msA], traces: [[0, 10, 20, 30]],
})).corps.id;
const repondre = (id, msB) => post('/challenge/attempt',
  { id, device_id: devB, name: nomB, total_ms: msB, splits: [msB] });
const mesResultats = (dev, nom) =>
  lire(`/duel/results?device_id=${dev}&name=${encodeURIComponent(nom)}`).then(d => d.results || []);
const vu = (dev, nom, ids) => post('/duel/results/seen', { device_id: dev, name: nom, ids });

titre('LE VAINQUEUR PARLE, PUIS REFERME SA FENETRE');
{
  // A lance et gagne : c'est lui qui apprend le resultat apres coup, et lui
  // qui laisse le mot depuis son annonce.
  const id = await creer(10000);
  await repondre(id, 11000);                       // B perd
  const aRecoit = await mesResultats(devA, nomA);
  ok('A apprend son duel', aRecoit.length === 1 && aRecoit[0].id === id,
     JSON.stringify(aRecoit).slice(0, 140));

  const pose = await post('/duel/mot', { id, name: nomA, texte: 'trop lent', voix, voix_type: 'audio/wav' });
  ok('A laisse son mot', pose.statut === 200 && pose.corps.voix === true,
     JSON.stringify(pose.corps).slice(0, 120));

  // Le geste qui detruisait tout : le vainqueur referme SON annonce.
  await vu(devA, nomA, [id]);

  const bRecoit = await mesResultats(devB, nomB);
  const ligne = bRecoit.find(r => r.id === id);
  ok('B recoit le mot', !!ligne && ligne.mot === 'trop lent', JSON.stringify(ligne || {}).slice(0, 140));
  ok('ET la voix avec', !!ligne && typeof ligne.voix === 'string' && ligne.voix.length > 100,
     ligne ? String(ligne.voix && ligne.voix.length) : 'aucune ligne');

  await vu(devB, nomB, [id]);
  const apres = (await mesResultats(devB, nomB)).find(r => r.id === id);
  ok('une fois ecoute, il ne revient plus', !apres);
  const aApres = (await mesResultats(devA, nomA)).find(r => r.id === id);
  ok('et le vainqueur ne se relit pas', !aApres);
}

titre('LE MOT ARRIVE APRES QUE LE PERDANT A REFERME');
{
  // Cette fois B gagne : le perdant est A, qui apprend son resultat avant que
  // le mot existe, le referme, et doit quand meme le recevoir ensuite.
  const id = await creer(11000);
  await repondre(id, 10000);                       // B gagne
  const avant = await mesResultats(devA, nomA);
  ok('A apprend sa defaite', avant.some(r => r.id === id));
  ok('sans mot, puisqu il n y en a pas encore',
     !(avant.find(r => r.id === id) || {}).mot);
  await vu(devA, nomA, [id]);                      // il referme son annonce
  ok('et son annonce ne revient pas', !(await mesResultats(devA, nomA)).some(r => r.id === id));

  // La boite de A doit sonner au depot du mot.
  const boite = new WebSocket(`${WS}/boite/${devA}?acces=${ACCES}`);
  const recu = [];
  boite.onmessage = ev => { try { recu.push(JSON.parse(String(ev.data))); } catch { /* ignore */ } };
  await new Promise((res, rej) => { boite.onopen = res; boite.onerror = rej; });

  const pose = await post('/duel/mot', { id, name: nomB, texte: 'la prochaine fois', voix, voix_type: 'audio/wav' });
  ok('B laisse son mot', pose.statut === 200, JSON.stringify(pose.corps).slice(0, 120));

  const fin = Date.now() + 4000;
  while (Date.now() < fin && !recu.some(m => m.t === 'mot')) await new Promise(r => setTimeout(r, 100));
  ok('la boite de A sonne', recu.some(m => m.t === 'mot'), JSON.stringify(recu));

  const rattrape = (await mesResultats(devA, nomA)).find(r => r.id === id);
  ok('le mot revient a A malgre l annonce deja vue', !!rattrape && rattrape.mot === 'la prochaine fois',
     JSON.stringify(rattrape || {}).slice(0, 140));
  ok('avec sa voix', !!rattrape && typeof rattrape.voix === 'string' && rattrape.voix.length > 100);

  await vu(devA, nomA, [id]);
  ok('lu une fois, il ne revient plus', !(await mesResultats(devA, nomA)).some(r => r.id === id));
  boite.close();
}

console.log(e ? `\n${e} echec(s)\n` : '\nTout tient.\n');
process.exit(e ? 1 : 0);
