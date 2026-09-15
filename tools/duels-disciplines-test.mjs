// UN NIVEAU PAR DISCIPLINE, contre une vraie base.
//
// Le classement des duels n'en est plus un mais sept : les trois distances, et
// les combines qu'on court d'un bloc. C'est la seule chose que ce harnais
// verifie, et il la verifie de bout en bout parce qu'aucun test pur ne le
// peut : ce qui se joue ici est un rangement en base, pas un calcul.
//
//   - un duel sur 100 m ne deplace QUE le classement du 100 m ;
//   - regional sur 100 m ne rend regional nulle part ailleurs ;
//   - l'experience aussi se compte par discipline : on entre neuf sur une
//     distance qu'on decouvre, quel que soit son passe sur une autre ;
//   - un combine a son classement a lui, et ne compte pas trois fois ;
//   - le recalcul rejoue chaque discipline separement, et se rejoue.
//
//   npx wrangler dev --local        (dans worker/)
//   BASE=http://127.0.0.1:8788 node tools/duels-disciplines-test.mjs
//
// Comme `classement-integration-test`, il finit par un recalcul, et un recalcul
// rejoue l'historique — donc efface les joueurs poses a la main qui n'en ont
// pas. Une base peuplee pour les championnats se repeuple apres :
//
//   node tools/championnat-peupler.mjs
const B = process.env.BASE || 'http://127.0.0.1:8788';
const ACCES = process.env.ACCES || 'ECRAN1';
const ADMIN = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';
const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': ACCES };
const post = (u, b, h = {}) => fetch(B + u, { method: 'POST', headers: { ...H, ...h },
  body: JSON.stringify(b) }).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const lire = u => fetch(B + u, { headers: H }).then(r => r.json());

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const m = Math.random().toString(36).slice(2, 6).toUpperCase();
const nom = r => `EP${m}${r}`;

/** Un defi pose sur ces epreuves, puis releve. */
async function duel(lanceur, releveur, msLanceur, msReleveur, epreuves = ['100']) {
  const part = t => epreuves.map(() => Math.round(t / epreuves.length));
  const c = await post('/challenge', {
    name: lanceur, device_id: 'dev-' + lanceur.toLowerCase(),
    races: epreuves, level_idx: 4, splits: part(msLanceur), total_ms: msLanceur,
    traces: epreuves.map(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  });
  const id = c.corps.id;
  if (!id) throw new Error('defi refuse : ' + JSON.stringify(c.corps));
  const r = await post('/challenge/attempt', {
    id, name: releveur, device_id: 'dev-' + releveur.toLowerCase(),
    splits: part(msReleveur), total_ms: msReleveur,
  });
  return { id, ...r.corps };
}

const board = ep => lire(`/duels?epreuve=${encodeURIComponent(ep)}`);
const ligne = (b, n) => b.classement.find(x => x.name === n) || null;

(async () => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  UN NIVEAU PAR DISCIPLINE                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  titre('CHAQUE DISTANCE A SON CLASSEMENT');

  const a = nom('A'), z = nom('Z');
  const cent = await duel(a, z, 11000, 10500, ['100']);
  ok('le duel dit sur quoi il a compte',
     cent.duel && cent.duel.epreuve === '100', JSON.stringify(cent.duel && cent.duel.epreuve));

  const c100 = await board('100'), c200 = await board('200'), c400 = await board('400');
  ok('les deux joueurs entrent au classement du 100 m',
     !!ligne(c100, a) && !!ligne(c100, z));
  ok('et n entrent nulle part ailleurs',
     !ligne(c200, z) && !ligne(c400, z),
     `200 : ${!!ligne(c200, z)}, 400 : ${!!ligne(c400, z)}`);
  ok('le classement rendu porte sa discipline', c400.epreuve === '400', c400.epreuve);
  ok('et annonce les distances qu un ecran peut proposer',
     Array.isArray(c100.epreuves) && c100.epreuves.join(',') === '100,200,400',
     JSON.stringify(c100.epreuves));

  titre('MONTER SUR 100 M NE FAIT PAS MONTER SUR 400 M');

  // Le grimpeur gagne assez de 100 m pour changer d'etage. Son 400 m, lui, ne
  // doit rien avoir vu passer.
  const grimpeur = nom('G');
  for (let i = 0; i < 12; i++) await duel(nom('V' + i), grimpeur, 12000, 10000 + i, ['100']);

  const gCent = ligne(await board('100'), grimpeur);
  ok('douze victoires sur 100 m font changer d etage',
     gCent && gCent.palier >= 4 && gCent.etage !== 'departemental',
     JSON.stringify(gCent && { etage: gCent.etage, division: gCent.division, palier: gCent.palier }));
  ok('le 400 m ne le connait pas', !ligne(await board('400'), grimpeur));

  // Il descend sur la piste qu'il ne connait pas : il y repart de zero.
  await duel(nom('W'), grimpeur, 55000, 54000, ['400']);
  const gTour = ligne(await board('400'), grimpeur);
  ok('sa premiere victoire sur 400 m le laisse au bas de l echelle',
     gTour && gTour.palier === 0 && gTour.etage === 'departemental',
     JSON.stringify(gTour && { etage: gTour.etage, division: gTour.division, lp: gTour.lp }));
  ok('pendant que son 100 m reste ou il etait',
     ligne(await board('100'), grimpeur).palier === gCent.palier);

  // Et le gain est celui d'un joueur NEUF sur cette distance : l'experience se
  // compte par discipline, sinon un vieux du 100 m entrerait sur 400 m avec un
  // facteur K de veteran et resterait des mois au mauvais etage.
  const surPrise = await duel(nom('W2'), grimpeur, 55000, 53000, ['400']);
  ok('il y gagne comme un joueur neuf, pas comme un habitue',
     surPrise.duel.lp > (await board('400')).bareme.releveur.victoire,
     `${surPrise.duel.lp} PL`);

  titre('MES DIVISIONS, TOUTES DISTANCES');

  const mes = (await lire(`/duels?name=${encodeURIComponent(grimpeur)}`)).mes_epreuves;
  ok('le serveur les rend toutes', Array.isArray(mes) && mes.length === 2,
     JSON.stringify(mes && mes.map(r => r.epreuve)));
  ok('la plus haute en tete — c est celle que l accueil montre',
     mes[0].epreuve === '100' && mes[0].palier >= mes[1].palier,
     JSON.stringify(mes.map(r => [r.epreuve, r.palier])));
  ok('et chacune porte sa distance',
     mes.every(r => typeof r.epreuve === 'string' && r.epreuve.length > 0));

  titre('UN COMBINE EST UNE DISCIPLINE A LUI');

  const duo = nom('D'), duoz = nom('E');
  const combine = await duel(duo, duoz, 33000, 32000, ['100', '200']);
  ok('le duel se range sous les deux distances reunies',
     combine.duel.epreuve === '100+200', combine.duel.epreuve);
  ok('sans rien deposer sur le 100 m ni sur le 200 m',
     !ligne(await board('100'), duoz) && !ligne(await board('200'), duoz));
  ok('et le classement du combine existe',
     !!ligne(await board('100+200'), duoz));

  // L'ordre des epreuves ne fabrique pas un second classement.
  const envers = await duel(nom('F'), duoz, 33000, 31000, ['200', '100']);
  ok('l ordre des epreuves ne cree pas un classement jumeau',
     envers.duel.epreuve === '100+200', envers.duel.epreuve);
  const cDuo = ligne(await board('100+200'), duoz);
  ok('les deux courses ont compte sur la meme ligne',
     cDuo && cDuo.wins === 2, JSON.stringify(cDuo && { wins: cDuo.wins, lp: cDuo.lp }));

  titre('CE QUE LE SERVEUR REFUSE OU RAMENE');

  const bidon = await board('150');
  ok('une distance inconnue retombe sur le 100 m plutot que sur du vide',
     bidon.epreuve === '100' && bidon.classement.length > 0, bidon.epreuve);
  ok('le MMR ne sort toujours pas du serveur',
     !JSON.stringify(await board('400')).includes('"mmr"'));

  titre('LE RECALCUL REJOUE CHAQUE DISCIPLINE');

  const admin = { 'X-Sprinter-Admin': ADMIN };
  // On ne compare que NOS joueurs. Une base locale peuplee a la main — voir
  // `championnat-peupler.mjs` — contient des lignes sans rencontre derriere
  // elles, et le recalcul les efface : c'est ce qu'on lui demande, rejouer
  // l'historique et rien d'autre. Les compter ici ferait echouer le harnais
  // sur le comportement meme qu'il verifie.
  const mien = r => r.name.startsWith('EP' + m);
  const admis = ['100', '200', '400', '100+200'];
  const avant = {};
  for (const ep of admis) avant[ep] = (await board(ep)).classement.filter(mien);

  const un = await post('/duels/recalculer', {}, admin);
  ok('le recalcul rejoue tout l historique',
     un.statut === 200 && un.corps.duels > 0, JSON.stringify(un.corps));

  let identique = true, ecart = '';
  for (const ep of admis) {
    const apres = (await board(ep)).classement.filter(mien);
    // `last_delta` et l'ordre sont ce qui compte ; les compteurs de defis
    // lances se refont de la table des defis et ne bougent pas non plus.
    const cle = c => c.map(r => `${r.name}:${r.palier}:${r.lp}:${r.wins}:${r.losses}`).join('|');
    if (cle(avant[ep]) !== cle(apres)) {
      identique = false;
      ecart = `${ep} : ${cle(avant[ep])} → ${cle(apres)}`;
    }
  }
  ok('les classements sont les memes apres le recalcul qu avant', identique, ecart);

  const deux = await post('/duels/recalculer', {}, admin);
  ok('et deux recalculs de suite donnent le meme nombre de duels',
     deux.corps.duels === un.corps.duels, `${un.corps.duels} → ${deux.corps.duels}`);

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
  process.exit(e ? 1 : 0);
})().catch(x => { console.error(x); process.exit(1); });
