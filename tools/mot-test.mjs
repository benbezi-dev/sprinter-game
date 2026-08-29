// Le mot du vainqueur, contre une vraie base.
//
// C'est la seule ecriture du jeu ou un joueur produit un contenu qu'un autre
// lira. Ce qui doit tenir n'est donc pas « ca marche », c'est le cadre :
//
//   - seul le VAINQUEUR peut parler. Le perdant non, un tiers non plus.
//   - une seule fois. Pas de correction apres coup, pas de conversation.
//   - le mot ne part qu'au PERDANT. Ni au vainqueur qui voudrait se relire,
//     ni a personne d'autre par une requete bien tournee.
//   - la voix disparait quand la fenetre se ferme. C'est une promesse faite au
//     joueur, et une promesse ne se verifie pas a l'oeil.
//   - un nul ne se chambre pas.
const B = process.env.BASE || 'http://127.0.0.1:8788';
const ACCES = process.env.ACCES || 'ECRAN1';
const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': ACCES };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b) })
  .then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const lire = u => fetch(B + u, { headers: H }).then(r => r.json());

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const m = Math.random().toString(36).slice(2, 6).toUpperCase();
const nom = r => `MOT${m}${r}`;
const app = n => 'dev-' + n.toLowerCase();
/** Une seconde de silence encodee : de quoi eprouver les bornes, sans plus. */
const VOIX = 'T2dnUwACAAAAAAAAAAA' + 'A'.repeat(400);

async function duel(lanceur, releveur, msL, msR) {
  const c = await post('/challenge', {
    name: lanceur, device_id: app(lanceur), races: ['100'], level_idx: 4,
    splits: [msL], total_ms: msL, traces: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
  });
  const id = c.corps.id;
  if (!id) throw new Error('defi refuse : ' + JSON.stringify(c.corps));
  await post('/challenge/attempt', {
    id, name: releveur, device_id: app(releveur), splits: [msR], total_ms: msR,
  });
  return id;
}

const mesDuels = (n) =>
  lire(`/duel/results?device_id=${encodeURIComponent(app(n))}&name=${encodeURIComponent(n)}`)
    .then(r => r.results || []);

(async () => {
  titre('QUI A LE DROIT DE PARLER');

  // Le releveur gagne : c'est lui le vainqueur.
  const lanceur = nom('L'), releveur = nom('R');
  const id = await duel(lanceur, releveur, 11000, 10200);

  const parLePerdant = await post('/duel/mot', { id, name: lanceur, texte: 'et voila' });
  ok('le perdant ne laisse pas de mot', parLePerdant.statut === 403,
     JSON.stringify(parLePerdant.corps));

  const parUnTiers = await post('/duel/mot', { id, name: nom('X'), texte: 'coucou' });
  ok('un tiers non plus', parUnTiers.statut === 403, JSON.stringify(parUnTiers.corps));

  const vide = await post('/duel/mot', { id, name: releveur, texte: '   ' });
  ok('un mot vide est refuse', vide.statut === 403, JSON.stringify(vide.corps));

  const bon = await post('/duel/mot', { id, name: releveur, texte: 'tu as couru ?' });
  ok('le vainqueur laisse son mot', bon.statut === 200 && bon.corps.ok,
     JSON.stringify(bon.corps));

  const deux = await post('/duel/mot', { id, name: releveur, texte: 'enfin bref' });
  ok('et une seule fois', deux.statut === 409, JSON.stringify(deux.corps));

  titre('A QUI LE MOT PARVIENT');

  const cotePerdant = (await mesDuels(lanceur)).find(d => d.id === id);
  ok('le perdant le recoit', cotePerdant && cotePerdant.mot === 'tu as couru ?',
     JSON.stringify(cotePerdant && cotePerdant.mot));
  ok('et sait de quel cote il etait', cotePerdant && cotePerdant.role === 'challenger',
     cotePerdant && cotePerdant.role);

  const coteVainqueur = (await mesDuels(releveur)).find(d => d.id === id);
  ok('le vainqueur ne se relit pas', !coteVainqueur,
     coteVainqueur ? JSON.stringify(coteVainqueur) : '');

  titre('CE QUE LE NETTOYAGE RETIRE');

  const sale = nom('S'), sale2 = nom('T');
  const id2 = await duel(sale, sale2, 11000, 10100);
  const invisible = 'trop' + String.fromCharCode(0x202E) + '   lent' +
                    String.fromCharCode(0x200B) + ' pour moi';
  await post('/duel/mot', { id: id2, name: sale2, texte: invisible });
  const recu = (await mesDuels(sale)).find(d => d.id === id2);
  ok('les caracteres invisibles sont retires',
     recu && recu.mot === 'trop lent pour moi', JSON.stringify(recu && recu.mot));

  titre('LA VOIX, ET SA DISPARITION');

  const a = nom('A'), b = nom('B');
  const id3 = await duel(a, b, 11000, 10300);
  const mauvaise = await post('/duel/mot', { id: id3, name: b, voix: 'pas du base64 !', voix_type: 'audio/webm' });
  ok('une voix qui n est pas du base64 est refusee', mauvaise.statut === 403,
     JSON.stringify(mauvaise.corps));
  const mauvaisType = await post('/duel/mot', { id: id3, name: b, voix: VOIX, voix_type: 'application/x-msdownload' });
  ok('un type qui n est pas de l audio est refuse', mauvaisType.statut === 403,
     JSON.stringify(mauvaisType.corps));
  const enorme = await post('/duel/mot', { id: id3, name: b, voix: 'A'.repeat(200000), voix_type: 'audio/webm' });
  ok('un enregistrement trop lourd est refuse', enorme.statut === 403,
     JSON.stringify(enorme.corps));

  const posee = await post('/duel/mot', { id: id3, name: b, voix: VOIX, voix_type: 'audio/webm;codecs=opus' });
  ok('la voix se depose', posee.statut === 200 && posee.corps.voix,
     JSON.stringify(posee.corps));

  const avant = (await mesDuels(a)).find(d => d.id === id3);
  ok('le perdant l entend', avant && avant.voix === VOIX && avant.voix_type === 'audio/webm',
     avant ? `${(avant.voix || '').length} caracteres, ${avant.voix_type}` : 'rien');

  // La fenetre se ferme : c'est le geste qui efface.
  await post('/duel/results/seen', { device_id: app(a), name: a, ids: [id3] });
  const apres = (await mesDuels(a)).find(d => d.id === id3);
  ok('la fenetre fermee, le duel ne revient pas', !apres);

  // On rouvre la porte pour verifier que la voix, elle, n'est plus la.
  const relu = await lire(`/duel/results?device_id=${encodeURIComponent(app(a))}&name=${encodeURIComponent(a)}`);
  ok('et la voix a disparu de la base',
     !JSON.stringify(relu).includes(VOIX.slice(0, 40)));

  titre('UN NUL NE SE CHAMBRE PAS');

  const n1 = nom('N'), n2 = nom('M');
  const id4 = await duel(n1, n2, 10500, 10500);
  const surNul = await post('/duel/mot', { id: id4, name: n2, texte: 'match nul mais bon' });
  ok('aucun des deux ne parle apres un nul', surNul.statut === 403,
     JSON.stringify(surNul.corps));

  titre('LA PORTE EST FERMEE HORS DU CANAL DE TEST');

  // Sans l'en-tete d'acces, la requete tombe sur la production. Le mot doit y
  // etre refuse : c'est la seule ecriture ou un joueur produit un contenu qu'un
  // autre lira, et rien ne la relit encore.
  const horsTest = await fetch(B + '/duel/mot', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name: releveur, texte: 'coucou la production' }),
  }).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
  ok('en production, personne ne depose de mot', horsTest.statut === 403,
     JSON.stringify(horsTest.corps));

  titre('LE CHEMIN INVERSE : LE LANCEUR GAGNE');

  const g = nom('G'), p = nom('P');
  const id5 = await duel(g, p, 10000, 11000);        // le lanceur l'emporte
  await post('/duel/mot', { id: id5, name: g, texte: 'merci pour l echauffement' });
  const coteReleveur = (await mesDuels(p)).find(d => d.id === id5);
  ok('celui qui a releve recoit le mot apres coup',
     coteReleveur && coteReleveur.mot === 'merci pour l echauffement',
     JSON.stringify(coteReleveur && coteReleveur.mot));
  ok('et sait qu il etait du cote du releveur',
     coteReleveur && coteReleveur.role === 'opponent', coteReleveur && coteReleveur.role);
  ok('un duel deja vu et sans mot ne revient pas',
     !(await mesDuels(sale2)).some(d => d.id === id2),
     'le vainqueur de id2 ne doit rien recevoir');

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
  process.exit(e ? 1 : 0);
})().catch(x => { console.error(x); process.exit(1); });
