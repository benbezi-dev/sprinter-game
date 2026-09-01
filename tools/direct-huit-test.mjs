// Une piste a huit couloirs, contre le vrai serveur.
//
// Ce que ce harnais cherche a prendre en defaut, ce sont les endroits ou le
// code supposait « deux » sans le dire : le depart qui n'attend que deux
// « pret », le verdict qui cherche un hote et un invite, la position qui part
// vers « l'adversaire » au singulier. A deux, tout cela marche par accident.

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
              resultat: null, positionsRecues: new Map(), max: null };
  const q = `name=${encodeURIComponent(nom)}&races=100&level=4&max=${places}`;
  c.ws = new WebSocket(`${WS}/live/${code}?${q}`);
  c.ouvert = new Promise(res => c.ws.addEventListener('open', res));
  c.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'bienvenue') c.moi = m.moi;
    if (m.joueurs) { c.joueurs = m.joueurs; c.max = m.max; }
    if (m.presentation) c.presentation = m.presentation;
    if (m.depart_a) c.depart = m.depart_a;
    if (m.t === 'pos') c.positionsRecues.set(m.id, m.d);
    if (m.t === 'resultat') c.resultat = m;
  });
  c.envoyer = o => c.ws.send(JSON.stringify(o));
  return c;
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  COURSE EN DIRECT A HUIT                                     ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const code = (await (await fetch(B + '/live/nouveau', { method: 'POST' })).json()).id;
console.log(`── LA PISTE ${code} ─────────────────────────────────────────\n`);

// Des noms uniques a chaque execution : la base de test locale porte des
// joueurs de toutes les seances precedentes, et un homonyme ferait passer une
// verification pour un echec — ou pire, l'inverse.
const marque = Math.random().toString(36).slice(2, 6).toUpperCase();
const NOMS = ['Bakary', 'Leo', 'Nina', 'Omar', 'Zoe', 'Malik', 'Ines', 'Theo']
  .map(n => n + marque);
const cl = [];
for (const [i, n] of NOMS.entries()) {
  const c = client(code, n, 8);
  await c.ouvert;
  cl.push(c);
  await attendre(90);
}
await attendre(400);

ok('les huit sont entres', cl.every(c => c.joueurs.length === 8),
   cl.map(c => c.joueurs.length).join(','));
ok('la piste annonce huit couloirs', cl.every(c => c.max === 8),
   cl.map(c => c.max).join(','));
ok('chacun a une identite distincte', new Set(cl.map(c => c.moi)).size === 8);
ok('les couloirs vont de 1 a 8, sans doublon',
   JSON.stringify([...cl[0].joueurs].map(j => j.couloir).sort((a, b) => a - b))
     === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]));
ok('tous les clients voient les memes couloirs',
   cl.every(c => JSON.stringify(c.joueurs.map(j => [j.id, j.couloir]))
               === JSON.stringify(cl[0].joueurs.map(j => [j.id, j.couloir]))));

// --------------------------------------------------------------- le depart
console.log('\n── LE DEPART N ATTEND PAS SEULEMENT DEUX « PRET » ──────────');
for (let i = 0; i < 7; i++) cl[i].envoyer({ t: 'pret', pret: true });
await attendre(350);
ok('a sept prets sur huit, rien ne part', cl.every(c => !c.depart));
cl[7].envoyer({ t: 'pret', pret: true });
await attendre(400);
ok('le huitieme declenche le depart', cl.every(c => !!c.depart));
ok('tous ont le meme instant de depart',
   new Set(cl.map(c => c.depart)).size === 1);

const p = cl[0].presentation;
ok('la presentation annonce huit participants', p && p.ordre.length === 8,
   p ? String(p.ordre.length) : 'aucune');
if (p) {
  const attendu = p.debut_a + 8 * p.par + 4000;
  ok('trois secondes par athlete', p.par === 3000, `${p.par} ms`);
  ok('la sequence entiere tient sous trente secondes', 8 * p.par <= 30000,
     `${(8 * p.par) / 1000} s`);
  ok('le pistolet suit les huit presentations', cl[0].depart === attendu,
     `${cl[0].depart} vs ${attendu}`);
  console.log(`   presentation ${(8 * p.par) / 1000} s, puis 4 s avant le pistolet`);
}

// ------------------------------------------------------------ les positions
console.log('\n── LES POSITIONS PARTENT AVEC LEUR EMETTEUR ────────────────');
for (const [i, c] of cl.entries()) c.envoyer({ t: 'pos', d: 10 + i });
await attendre(350);

const vues = cl[0].positionsRecues;
ok('chacun recoit les sept autres, pas la sienne', vues.size === 7, `${vues.size} recues`);
ok('sa propre position ne lui revient pas', !vues.has(cl[0].moi));
const parId = new Map(cl.map(c => [c.moi, c]));
ok('chaque position porte le bon identifiant',
   [...vues.entries()].every(([id, d]) => {
     const src = parId.get(id);
     return src && Math.abs(d - (10 + cl.indexOf(src))) < 0.001;
   }));

// -------------------------------------------------------------- le verdict
console.log('\n── LE VERDICT A HUIT ───────────────────────────────────────');
// Chronos volontairement melanges : l'ordre d'arrivee ne doit rien devoir a
// l'ordre d'inscription.
const chronos = [10200, 9700, 10500, 9900, 9600, 10800, 9800, 10100];
for (const [i, c] of cl.entries()) c.envoyer({ t: 'fini', ms: chronos[i] });
await attendre(500);

const r = cl[0].resultat;
ok('un resultat est rendu', !!r);
if (r) {
  ok('il compte huit partants', r.partants === 8, String(r.partants));
  ok('le classement compte huit lignes', r.classement.length === 8);
  const trie = [...chronos].sort((a, b) => a - b);
  ok('il est trie par chrono',
     JSON.stringify(r.classement.map(x => x.ms)) === JSON.stringify(trie));
  ok('les places vont de 1 a 8',
     JSON.stringify(r.classement.map(x => x.place)) === JSON.stringify([1,2,3,4,5,6,7,8]));
  ok('a huit, aucun champ de duel n est produit',
     r.issue === undefined && r.hote === undefined);
  console.log('');
  for (const x of r.classement) {
    console.log(`     ${String(x.place).padStart(2)}. ${x.nom.padEnd(8)} ${(x.ms / 1000).toFixed(3)} s`);
  }
  ok('tous les clients recoivent le meme classement',
     cl.every(c => JSON.stringify(c.resultat?.classement) === JSON.stringify(r.classement)));
}

// Le classement des duels ne doit pas avoir bouge : une course a huit n'est
// pas un duel, et le bareme n'a pas de generalisation honnete a huit.
const duels = await (await fetch(B + '/duels')).json();
const dedans = (duels.classement || []).some(x => NOMS.includes(x.name));
ok('aucun coureur de la course n entre au classement des duels', !dedans);

for (const c of cl) c.ws.close();

// ----------------------------------------------- le duel a deux, intact
console.log('\n── ET LE DUEL A DEUX MARCHE TOUJOURS ───────────────────────');
const code2 = (await (await fetch(B + '/live/nouveau', { method: 'POST' })).json()).id;
const a = client(code2, 'HoteDuo', 2); await a.ouvert; await attendre(120);
const b = client(code2, 'InviteDuo', 2); await b.ouvert; await attendre(300);
ok('la piste annonce deux couloirs', a.max === 2, String(a.max));
a.envoyer({ t: 'pret', pret: true }); b.envoyer({ t: 'pret', pret: true });
await attendre(350);
a.envoyer({ t: 'fini', ms: 9500 }); b.envoyer({ t: 'fini', ms: 9900 });
await attendre(400);
ok('le duel produit toujours une issue', a.resultat && a.resultat.issue === 'challenger',
   a.resultat ? a.resultat.issue : 'aucun resultat');
ok('et un classement, comme les courses', a.resultat?.classement?.length === 2);
a.ws.close(); b.ws.close();

console.log('\n' + '─'.repeat(62));
console.log(echecs === 0 ? '   TOUT PASSE.' : `   ${echecs} VERIFICATION(S) EN ECHEC.`);
console.log('');
process.exit(echecs ? 1 : 0);
