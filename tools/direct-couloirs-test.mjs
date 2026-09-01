// Les tailles de piste, une par une, contre le vrai serveur.
//
// Le direct n'a longtemps connu que le duel, puis les tailles paires : deux,
// quatre, six, huit. Cela paraissait suffire jusqu'au jour ou l'on est trois.
// Il fallait alors ouvrir une piste a quatre et attendre un quatrieme qui
// n'existait pas — et comme le depart n'est donne QUE lorsque tous les couloirs
// sont pris, cette course-la ne partait jamais.
//
// Ce harnais verifie donc les deux bouts que le format pair cachait :
//
// 1. une taille impaire tient debout de bout en bout — trois entrent, trois
//    couloirs, le troisieme « pret » declenche le depart, et un quatrieme est
//    refuse a la porte ;
// 2. une piste a UN couloir part toute seule, sans presentation — on ne se
//    presente pas a des couloirs vides — et rend un resultat.
//
// Et que les bornes tiennent : ce qu'un client demande hors de 1..8 est ramene
// dedans par la salle, jamais accepte tel quel.

const B = 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const attendre = ms => new Promise(r => setTimeout(r, ms));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

function client(code, nom, places) {
  const c = { nom, moi: null, joueurs: [], presentation: null, depart: null,
              resultat: null, max: null, refuse: false };
  const q = `name=${encodeURIComponent(nom)}&races=100&level=4&max=${places}`;
  c.ws = new WebSocket(`${WS}/live/${code}?${q}`);
  // Une salle pleine repond 409 : la poignee de main echoue et l'on n'a pas
  // d'« open ». On attend donc l'un ou l'autre, jamais indefiniment.
  c.ouvert = new Promise(res => {
    c.ws.addEventListener('open', () => res(true));
    c.ws.addEventListener('error', () => { c.refuse = true; res(false); });
    c.ws.addEventListener('close', () => { if (!c.moi) c.refuse = true; res(false); });
  });
  c.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'bienvenue') c.moi = m.moi;
    if (m.joueurs) { c.joueurs = m.joueurs; c.max = m.max; }
    if (m.presentation) c.presentation = m.presentation;
    if (m.depart_a) c.depart = m.depart_a;
    if (m.t === 'resultat') c.resultat = m;
  });
  c.envoyer = o => c.ws.send(JSON.stringify(o));
  return c;
}

const nouvelleSalle = async () =>
  (await (await fetch(B + '/live/nouveau', { method: 'POST' })).json()).id;

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  COURSE EN DIRECT — DE UN A HUIT COULOIRS                    ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Des noms uniques a chaque execution : la base de test locale porte les
// joueurs de toutes les seances precedentes, et un homonyme ferait passer une
// verification pour un echec — ou pire, l'inverse.
const marque = Math.random().toString(36).slice(2, 6).toUpperCase();

// ------------------------------------------------------- une piste a trois
console.log('── TROIS COULOIRS : LA TAILLE QU ON NE POUVAIT PAS DEMANDER ─\n');

const code3 = await nouvelleSalle();
const NOMS3 = ['Aya', 'Bilal', 'Chloe'].map(n => n + marque);
const trois = [];
for (const n of NOMS3) {
  const c = client(code3, n, 3);
  await c.ouvert;
  trois.push(c);
  await attendre(100);
}
await attendre(350);

ok('les trois sont entres', trois.every(c => c.joueurs.length === 3),
   trois.map(c => c.joueurs.length).join(','));
ok('la piste annonce trois couloirs', trois.every(c => c.max === 3),
   trois.map(c => c.max).join(','));
ok('les couloirs vont de 1 a 3, sans doublon',
   JSON.stringify(trois[0].joueurs.map(j => j.couloir).sort((a, b) => a - b))
     === JSON.stringify([1, 2, 3]));

// La porte : une piste a trois est pleine a trois, pas a quatre.
const etat3 = await (await fetch(`${B}/live/${code3}/etat`)).json();
ok('la piste se declare complete a trois', etat3.complete === true);
const quatrieme = client(code3, 'Djamel' + marque, 3);
await quatrieme.ouvert;
await attendre(250);
ok('un quatrieme est refuse a la porte', quatrieme.refuse && !quatrieme.moi);
ok('et la piste reste a trois', trois[0].joueurs.length === 3,
   String(trois[0].joueurs.length));

console.log('\n── LE DEPART ATTEND LE TROISIEME « PRET » ──────────────────');
trois[0].envoyer({ t: 'pret', pret: true });
trois[1].envoyer({ t: 'pret', pret: true });
await attendre(350);
ok('a deux prets sur trois, rien ne part', trois.every(c => !c.depart));
trois[2].envoyer({ t: 'pret', pret: true });
await attendre(400);
ok('le troisieme declenche le depart', trois.every(c => !!c.depart));
ok('tous ont le meme instant de depart', new Set(trois.map(c => c.depart)).size === 1);

const p3 = trois[0].presentation;
ok('la presentation annonce trois participants', p3 && p3.ordre.length === 3,
   p3 ? String(p3.ordre.length) : 'aucune');
if (p3) {
  // Le creneau vaut trois secondes quel que soit le nombre de partants : a
  // trois, la sequence entiere tient donc en neuf secondes.
  ok('trois secondes par athlete', p3.par === 3000, `${p3.par} ms`);
  ok('le pistolet suit les trois presentations',
     trois[0].depart === p3.debut_a + 3 * p3.par + 4000,
     `${trois[0].depart} vs ${p3.debut_a + 3 * p3.par + 4000}`);
  console.log(`   presentation ${(3 * p3.par) / 1000} s, puis 4 s avant le pistolet`);
}

console.log('\n── LE VERDICT A TROIS ──────────────────────────────────────');
const chronos3 = [10400, 9900, 10100];
for (const [i, c] of trois.entries()) c.envoyer({ t: 'fini', ms: chronos3[i] });
await attendre(500);

const r3 = trois[0].resultat;
ok('un resultat est rendu', !!r3);
if (r3) {
  ok('il compte trois partants', r3.partants === 3, String(r3.partants));
  ok('le classement est trie par chrono',
     JSON.stringify(r3.classement.map(x => x.ms)) === JSON.stringify([9900, 10100, 10400]));
  ok('les places vont de 1 a 3',
     JSON.stringify(r3.classement.map(x => x.place)) === JSON.stringify([1, 2, 3]));
  ok('a trois, aucun champ de duel n est produit',
     r3.issue === undefined && r3.hote === undefined);
  for (const x of r3.classement) {
    console.log(`     ${x.place}. ${x.nom.padEnd(9)} ${(x.ms / 1000).toFixed(3)} s`);
  }
}
for (const c of trois) c.ws.close();

// --------------------------------------------------------- un seul couloir
console.log('\n── UN COULOIR : LE TOUR DE PISTE SEUL ──────────────────────\n');

const code1 = await nouvelleSalle();
const seul = client(code1, 'Solo' + marque, 1);
await seul.ouvert;
await attendre(300);

ok('la piste annonce un couloir', seul.max === 1, String(seul.max));
ok('un seul coureur dessus', seul.joueurs.length === 1);
const etat1 = await (await fetch(`${B}/live/${code1}/etat`)).json();
ok('elle est complete des le premier arrive', etat1.complete === true);

const intrus = client(code1, 'Intrus' + marque, 1);
await intrus.ouvert;
await attendre(250);
ok('personne ne peut s y ajouter', intrus.refuse && !intrus.moi);

seul.envoyer({ t: 'pret', pret: true });
await attendre(400);
ok('un seul « pret » suffit a declencher le depart', !!seul.depart);
// Se presenter a des couloirs vides n'est plus une presentation, c'est une
// attente : la salle n'en annonce pas, et le pistolet tombe tout de suite.
ok('aucune presentation n est annoncee', seul.presentation === null,
   JSON.stringify(seul.presentation));
ok('le pistolet tombe dans les secondes qui suivent',
   seul.depart - Date.now() < 5000, `${seul.depart - Date.now()} ms`);

seul.envoyer({ t: 'fini', ms: 10250 });
await attendre(500);
const r1 = seul.resultat;
ok('un resultat est rendu', !!r1);
if (r1) {
  ok('il compte un partant', r1.partants === 1, String(r1.partants));
  ok('le classement tient en une ligne, premiere place',
     r1.classement.length === 1 && r1.classement[0].place === 1);
  ok('seul, aucun champ de duel n est produit',
     r1.issue === undefined && r1.hote === undefined);
}
seul.ws.close();

// ------------------------------------------------------------- les bornes
console.log('\n── CE QU ON DEMANDE HORS DE 1..8 EST RAMENE DEDANS ─────────');

const codeBas = await nouvelleSalle();
const bas = client(codeBas, 'Zero' + marque, 0);
await bas.ouvert; await attendre(250);
ok('zero couloir devient un', bas.max === 1, String(bas.max));
bas.ws.close();

const codeHaut = await nouvelleSalle();
const haut = client(codeHaut, 'Cent' + marque, 99);
await haut.ouvert; await attendre(250);
ok('quatre-vingt-dix-neuf couloirs deviennent huit', haut.max === 8, String(haut.max));
haut.ws.close();

// Le classement des duels ne bouge pas : ni une course a trois, ni un tour de
// piste seul ne sont des duels, et le bareme est fait pour une paire.
const duels = await (await fetch(B + '/duels')).json();
const tous = [...NOMS3, 'Solo' + marque];
ok('aucun de ces coureurs n entre au classement des duels',
   !(duels.classement || []).some(x => tous.includes(x.name)));

console.log('\n' + '─'.repeat(62));
console.log(echecs === 0 ? '   TOUT PASSE.' : `   ${echecs} VERIFICATION(S) EN ECHEC.`);
console.log('');
process.exit(echecs ? 1 : 0);
