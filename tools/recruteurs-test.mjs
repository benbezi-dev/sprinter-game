// LE CLASSEMENT DES RECRUTEURS — on compte des personnes, pas des courses.
//
// Ce tableau ne mesure pas la vitesse mais la portee : contre qui on court le
// plus. C'est le seul classement du jeu qu'un joueur lent puisse gagner, et
// c'est ce qui en fait le moteur du partage — donner son code y rapporte.
//
// Tout ce fichier tient aux trois facons de le fausser :
//
//   1. COMPTER LES COURSES AU LIEU DES PERSONNES. Un ami qui reprend vingt
//      fois le meme code ferait vingt recrues, et le premier du classement
//      serait celui qui a l'ami le plus tetu.
//   2. SE COMPTER SOI-MEME. Rien n'empeche de relever son propre defi depuis
//      un second telephone ; sans la ligne qui l'ecarte, le classement
//      recompense d'avoir deux appareils.
//   3. OUBLIER LES DEFIS DE LA CAMERA. Ailleurs ils ne comptent pas — ouvrir
//      n'est pas lancer. Ici si : ce tableau ne mesure pas une intention, il
//      mesure que quelqu'un a couru. Un code lu sur une video et releve vaut
//      exactement ce qu'il dit.
//
//     cd worker && npx wrangler dev --local --port 8788
//     node tools/recruteurs-test.mjs

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
const nom = s => `RC${m}${s}`;
const dev = s => `dev-rc-${m.toLowerCase()}-${s.toLowerCase()}`;

const course = (ms, races = ['100']) => ({
  races, level_idx: 4, total_ms: ms, splits: races.map(() => ms),
  traces: races.map(() => [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
});

const creer = (n, d, ms, races) => post('/challenge', { ...course(ms, races), name: n, device_id: d });
const poser = (n, d, ms) => post('/challenge/camera', { ...course(ms), name: n, device_id: d });
const relever = (id, n, d, ms) => post('/challenge/attempt', {
  id, name: n, device_id: d, total_ms: ms, splits: [ms], traces: [[0, 10, 20, 30, 40]],
});

/** La ligne de quelqu'un au classement des recruteurs. */
async function ligne(n) {
  const b = await lire(`/recruteurs?name=${encodeURIComponent(n)}`);
  return b.moi || (b.classement || []).find(x => x.name === n) || null;
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LE CLASSEMENT DES RECRUTEURS — des personnes, pas des courses║');
console.log('╚══════════════════════════════════════════════════════════════╝');

titre('UN AMI TETU NE FAIT QU UNE RECRUE');
{
  const A = nom('A'), dA = dev('a');
  const ids = [];
  for (const ms of [9100, 9200, 9300]) {
    const r = await creer(A, dA, ms);
    ids.push(r.corps.id);
  }
  // Le meme adversaire releve les trois defis : trois courses, une personne.
  const Bq = nom('B'), dB = dev('b');
  for (const id of ids) await relever(id, Bq, dB, 9500);

  const li = await ligne(A);
  ok('il est au classement', !!li, 'absent');
  ok('une seule recrue pour trois courses', li?.recrues === 1,
     `recrues = ${li?.recrues}`);
  ok('les trois courses sont comptees a part', li?.courses === 3,
     `courses = ${li?.courses}`);

  // Un second adversaire : la deuxieme personne, elle, compte.
  await relever(ids[0], nom('C'), dev('c'), 9600);
  const li2 = await ligne(A);
  ok('un second adversaire fait une seconde recrue', li2?.recrues === 2,
     `recrues = ${li2?.recrues}`);
}

titre('ON NE SE COMPTE PAS SOI-MEME');
{
  const D = nom('D'), dD = dev('d');
  const { corps } = await creer(D, dD, 9150);
  // Son propre defi, depuis son propre appareil.
  const sien = await relever(corps.id, D, dD, 9400);
  const li = await ligne(D);
  if (sien.statut !== 200) {
    ok('le serveur refuse deja qu on releve son propre defi', true,
       `statut ${sien.statut}`);
  }
  ok('il n a aucune recrue', !li || li.recrues === 0, `recrues = ${li?.recrues}`);

  // Et un vrai adversaire, lui, compte.
  await relever(corps.id, nom('E'), dev('e'), 9700);
  const li2 = await ligne(D);
  ok('un vrai adversaire compte', li2?.recrues === 1, `recrues = ${li2?.recrues}`);
}

titre('LES DEFIS DE LA CAMERA COMPTENT ICI');
{
  // C'est le seul tableau ou ils comptent : ailleurs, ouvrir n'est pas lancer.
  const F = nom('F'), dF = dev('f');
  const { corps } = await poser(F, dF, 9050);
  ok('la camera a pose un defi', !!corps.id, JSON.stringify(corps));
  const avant = await ligne(F);
  ok('pose mais pas releve, il ne compte pas', !avant, `${JSON.stringify(avant)}`);

  await relever(corps.id, nom('G'), dev('g'), 9800);
  const apres = await ligne(F);
  ok('releve, il compte', apres?.recrues === 1, `recrues = ${apres?.recrues}`);
}

titre('TOUTES DISTANCES CONFONDUES');
{
  // On regarde la personne, pas son 200 m : deux recrues sur deux epreuves
  // font deux recrues, et non une par tableau.
  const I = nom('I'), dI = dev('i');
  const c1 = await creer(I, dI, 9100, ['100']);
  const c2 = await creer(I, dI, 21000, ['200']);
  await relever(c1.corps.id, nom('J'), dev('j'), 9500);
  await relever(c2.corps.id, nom('K'), dev('k'), 22000);
  const li = await ligne(I);
  ok('les deux epreuves se cumulent', li?.recrues === 2, `recrues = ${li?.recrues}`);
}

titre('LE PLUS SUIVI PASSE DEVANT');
{
  const board = await lire('/recruteurs');
  const cl = board.classement || [];
  ok('le classement est rendu', cl.length > 0, `${cl.length} ligne(s)`);
  const trie = cl.every((r, i) => i === 0 || r.recrues <= cl[i - 1].recrues);
  ok('il descend par recrues', trie);
  const rangs = cl.every((r, i) => r.rank === i + 1);
  ok('les rangs suivent l ordre', rangs);
  const aDeux = cl.find(r => r.name === nom('A'));
  const aUne = cl.find(r => r.name === nom('F'));
  if (aDeux && aUne) {
    ok('deux recrues passent devant une', aDeux.rank < aUne.rank,
       `${aDeux.rank} contre ${aUne.rank}`);
  } else {
    ok('les deux joueurs sont au tableau', false,
       `${aDeux ? '' : 'A absent '}${aUne ? '' : 'F absent'}`);
  }
}

titre('MOI, MEME SANS RIEN');
{
  const b = await lire(`/recruteurs?name=${encodeURIComponent(nom('Z'))}`);
  ok('un inconnu n a pas de ligne', b.moi === null, JSON.stringify(b.moi));
  const b2 = await lire('/recruteurs');
  ok('sans nom, pas de moi non plus', b2.moi === null, JSON.stringify(b2.moi));
}

console.log(e ? `\n✗ ${e} essai(s) en echec` : '\n✓ tout passe');
process.exit(e ? 1 : 0);
