// LE DEFI DE LA CAMERA — poser n'est pas lancer.
//
// La camera pose un defi a l'arrivee de chaque course filmee, pour que son
// code puisse figurer sur le carton de fin de la video. C'est du volume : une
// ligne par course, la ou il n'y en avait une que par defi envoye.
//
// A NE PAS CONFONDRE avec le « defi ouvert » de la communication — un defi
// sans cible mais bel et bien LANCE, publie avec son code sur Instagram ou
// TikTok. Celui-la compte au tableau des defis lances ; celui de la camera
// non, et c'est tout l'objet de ce fichier.
//
// Tout ce fichier tient a cette phrase, et a ce qu'elle casserait si on la
// prenait a la legere : le compteur « defis lances » du classement des duels.
// Un joueur qui court dix fois sans defier personne doit y lire zero. Le
// compter au fil de l'eau ne suffit pas — le classement se REFAIT, a partir
// de la table des defis, et un recalcul qui compterait les lignes de la camera
// donnerait un autre chiffre que le compteur vivant. L'ecart n'apparaitrait
// qu'au premier recalcul, des semaines apres le changement qui l'a cause.
//
// Le reste est de la meme eau : un code ecrit en clair sur une video que
// n'importe qui peut recevoir, et il faut qu'aucun de ces gens ne puisse s'en
// servir pour faire sonner le telephone de quelqu'un.
//
//     cd worker && npx wrangler dev --local --port 8788
//     node tools/defi-camera-test.mjs

const B = process.env.BASE || 'http://127.0.0.1:8788';
const ACCES = process.env.ACCES || 'ECRAN1';
// La cle d'administration du worker local, telle que .dev.vars la pose — la
// meme convention que classement-integration-test.mjs.
const ADMIN = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';
const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': ACCES };
const post = (u, b, h = {}) => fetch(B + u, { method: 'POST', headers: { ...H, ...h }, body: JSON.stringify(b) })
  .then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
/* LE MEME APPEL, MAIS HORS DU CANAL DE TEST.
   Le canal de test est EXEMPTE de l'anti-abus — qui s'y trouve a deja presente
   un code individuel, et les harnais de simulation le martellent volontairement.
   Un essai qui verifie une limite de frequence en passant par lui ne verifie
   donc rien du tout : il voit zero refus et se declare content. */
const postHorsTest = (u, b) => fetch(B + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
}).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const lire = u => fetch(B + u, { headers: H }).then(r => r.json());

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const m = Math.random().toString(36).slice(2, 6).toUpperCase();
const nom = s => `DF${m}${s}`;
const dev = s => `dev-df-${m.toLowerCase()}-${s.toLowerCase()}`;

/** Une course de 100 m, avec de quoi faire un fantome. */
const course = ms => ({
  races: ['100'], level_idx: 4, total_ms: ms, splits: [ms],
  traces: [[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]],
});

const poser = (n, d, ms) => post('/challenge/camera', { ...course(ms), name: n, device_id: d });
const creer = (n, d, ms, plus = {}) => post('/challenge', { ...course(ms), name: n, device_id: d, ...plus });
const lancer = (id, n, d, plus = {}) => post('/challenge/lance', { id, name: n, device_id: d, ...plus });
const relever = (id, n, d, ms) => post('/challenge/attempt', {
  id, name: n, device_id: d, total_ms: ms, splits: [ms], traces: [[0, 10, 20, 30, 40]],
});

/** La ligne de quelqu'un au classement des duels — la ou `launched` se lit. */
async function ligne(n) {
  const b = await lire('/duels?epreuve=100');
  return (b.classement || []).find(x => x.name === n) || null;
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LE DEFI DE LA CAMERA — poser n est pas lancer                ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

titre('TROIS COURSES FILMEES, UN SEUL DEFI LANCE');
{
  const A = nom('A'), dA = dev('a');
  // Trois courses filmees : la camera pose un defi a chacune.
  const o = [];
  for (const ms of [9120, 9340, 9080]) {
    const r = await poser(A, dA, ms);
    ok(`la camera pose un defi (${ms} ms)`, r.statut === 200 && !!r.corps.id, JSON.stringify(r.corps));
    o.push(r.corps.id);
  }
  // Le joueur n'en envoie qu'un : il appuie une fois sur « DEFIER UN AMI ».
  const l = await lancer(o[0], A, dA);
  ok('le premier est lance', l.statut === 200 && l.corps.id === o[0], JSON.stringify(l.corps));

  // LE CODE D'UNE VIDEO SE COURT SANS AVOIR ETE LANCE. C'est tout l'objet de
  // la manoeuvre : la video part, quelqu'un lit le code, il court.
  const r = await relever(o[2], nom('B'), dev('b'), 9500);
  ok('un defi seulement pose se court quand meme',
     r.statut === 200 && r.corps.owner_name === A, JSON.stringify(r.corps).slice(0, 120));

  // LE TEST QUI COMPTE.
  const li = await ligne(A);
  ok('il est au classement', !!li, 'ligne absente');
  ok('un seul defi lance, pas trois', li?.launched === 1, `launched = ${li?.launched}`);
}

titre('LE RECALCUL DIT LA MEME CHOSE QUE LE COMPTEUR');
{
  // Le piege vicieux : `launched` est tenu au fil de l'eau ET refait depuis la
  // table des defis. Deux sources, deux occasions de compter ce qu'il ne faut
  // pas. On refait le classement et on relit la meme ligne.
  const A = nom('A');
  const avant = await ligne(A);
  const r = await post('/duels/recalculer', {}, { 'X-Sprinter-Admin': ADMIN });
  ok('le recalcul a tourne', r.statut === 200, `statut ${r.statut} ${JSON.stringify(r.corps).slice(0, 90)}`);
  const apres = await ligne(A);
  ok('le compteur dit toujours un', apres?.launched === 1, `launched = ${apres?.launched}`);
  ok('et il n a pas bouge', apres?.launched === avant?.launched,
     `${avant?.launched} puis ${apres?.launched}`);
}

titre('SEUL SON AUTEUR LE LANCE');
{
  const C = nom('C'), dC = dev('c');
  const { corps } = await poser(C, dC, 9200);
  // Le code est ecrit en clair sur une video : le lire ne doit pas suffire.
  const vol = await lancer(corps.id, nom('X'), dev('x'));
  ok('un inconnu est refuse', vol.statut === 403, `statut ${vol.statut}`);
  const sien = await lancer(corps.id, C, dC);
  ok('son auteur passe', sien.statut === 200, `statut ${sien.statut}`);
}

titre('DEUX APPUIS NE VALENT PAS DEUX DEFIS');
{
  const D = nom('D'), dD = dev('d');
  const { corps } = await poser(D, dD, 9150);
  await lancer(corps.id, D, dD);
  const encore = await lancer(corps.id, D, dD);
  ok('le second appui est sans effet', encore.corps.deja === true, JSON.stringify(encore.corps));

  await relever(corps.id, nom('E'), dev('e'), 9600);
  const li = await ligne(D);
  ok('un seul defi au compteur', li?.launched === 1, `launched = ${li?.launched}`);
}

titre('LE NOM SAISI APRES COUP REMPLACE CELUI DE LA POSE');
{
  // La camera pose avec le nom enregistre ; l'ecran de fin laisse le corriger
  // juste avant d'envoyer, et c'est meme la qu'on le saisit la premiere fois.
  const F1 = nom('F'), F2 = nom('G'), dF = dev('f');
  const { corps } = await poser(F1, dF, 9300);
  await lancer(corps.id, F2, dF);
  const d = await lire(`/challenge?id=${corps.id}`);
  ok('le defi porte le nom du lancement', d.owner_name === F2, d.owner_name);
}

titre('MAIS PAS SI QUELQU UN A DEJA COURU CONTRE');
{
  // Le code part avec la video, parfois avant l'appui : une rencontre peut
  // exister deja, et elle porte l'ancien nom. Le changer ferait diverger le
  // defi de la rencontre qu'il a produite.
  const H1 = nom('H'), H2 = nom('I'), dH = dev('h');
  const { corps } = await poser(H1, dH, 9250);
  await relever(corps.id, nom('J'), dev('j'), 9700);
  await lancer(corps.id, H2, dH);
  const d = await lire(`/challenge?id=${corps.id}`);
  ok('le nom d origine est garde', d.owner_name === H1, d.owner_name);
}

titre('LE DEFI DE LA CAMERA NE VISE PERSONNE, LE DEFI LANCE VISE');
{
  const K = nom('K'), dK = dev('k');       // la cible
  const L = nom('L'), dL = dev('l');       // celui qui defie
  await post('/submit', {
    device_id: dK, race_key: '100', name: K, time_ms: 1200000, best_split_ms: 9400,
  });
  const board = await lire('/leaderboard?race=100&by=race');
  const sa = (board.entries || []).find(x => x.name === K);
  ok('la cible est au classement', !!sa, 'absente');

  const { corps } = await poser(L, dL, 9100);
  // On lui passe une cible a la pose : elle doit etre IGNOREE. Sinon la
  // sonnette partirait avant que son auteur ait choisi d'appeler.
  const o2 = await post('/challenge/camera',
                        { ...course(9110), name: L, device_id: dL, target_score_id: sa?.id });
  const boite0 = await lire(`/inbox?device_id=${dK}`);
  ok('rien dans la boite de la cible',
     !(boite0.defis || []).some(x => x.id === o2.corps.id || x.id === corps.id),
     JSON.stringify(boite0.defis || []).slice(0, 120));

  await lancer(corps.id, L, dL, { target_score_id: sa?.id });
  const boite1 = await lire(`/inbox?device_id=${dK}`);
  ok('le defi lance arrive chez elle',
     (boite1.defis || []).some(x => x.id === corps.id),
     JSON.stringify(boite1.defis || []).slice(0, 120));
}

titre('LA CAMERA NE PUISE PAS DANS LE QUOTA DU BOUTON');
{
  // L'anti-abus compte par (route, IP) : 30 ecritures par minute. Si la camera
  // passait par /challenge, une soiree de courses filmees derriere la meme
  // adresse refuserait le defi que le joueur envoie enfin. Ici on epuise
  // largement la route de la camera, puis on verifie que le bouton passe.
  const P = nom('P'), dP = dev('p');
  const courseP = ms => ({ ...course(ms), name: P, device_id: dP });
  let refus = 0;
  for (let i = 0; i < 34; i++) {
    const r = await postHorsTest('/challenge/camera', courseP(9000 + i));
    if (r.statut === 429) refus++;
  }
  ok('la camera finit par ceder', refus > 0, `${refus} refus sur 34`);
  const bouton = await postHorsTest('/challenge', courseP(9999));
  ok('le bouton passe quand meme', bouton.statut === 200 && !!bouton.corps.id,
     `statut ${bouton.statut} ${JSON.stringify(bouton.corps)}`);
}

titre('UN DEFI ORDINAIRE RESTE LANCE D EMBLEE');
{
  // Non-regression : le chemin d'avant ce changement ne doit rien perdre.
  const M = nom('M'), dM = dev('m');
  const { corps } = await creer(M, dM, 9050);
  const l = await lancer(corps.id, M, dM);
  ok('il est deja lance', l.corps.deja === true, JSON.stringify(l.corps));
  await relever(corps.id, nom('N'), dev('n'), 9800);
  const li = await ligne(M);
  ok('un seul defi au compteur', li?.launched === 1, `launched = ${li?.launched}`);
}

console.log(e ? `\n✗ ${e} essai(s) en echec` : '\n✓ tout passe');
process.exit(e ? 1 : 0);
