// La revanche d'une course en direct compte-t-elle au classement des duels ?
//
// Une salle vit quarante-cinq secondes apres le verdict, et c'est fait pour :
// on se remet pret, on repart. Chaque depart est un duel — un vainqueur, un
// perdant, des points qui changent de main — et le classement doit les voir
// tous, comme il voit tous les defis.
//
// Ce qu'on prend en defaut ici est precis : l'identifiant sous lequel la salle
// depose son duel. Tant qu'il ne portait que le code de la salle, la seconde
// course tombait sur la cle d'unicite de duel_results — celle qui empeche un
// meme defi d'etre credite deux fois — et repartait sans un point. Elle se
// courait, elle s'affichait, elle annoncait un vainqueur : rien ne le disait.
//
// Et puisque les points existent, ils doivent se dire. Le second volet suit
// donc l'annonce que la salle envoie apres le verdict : chacun recoit les
// siens, personne ne recoit ceux de l'autre, et une course a trois — qui n'est
// pas un duel — n'en recoit aucun.

const B = process.env.BASE || 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const attendre = ms => new Promise(r => setTimeout(r, ms));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const m = Math.random().toString(36).slice(2, 6).toUpperCase();
const RAPIDE = `RV${m}RAPIDE`, LENT = `RV${m}LENT`;

function client(code, nom, places = 2) {
  const c = { nom, moi: null, depart: null, resultats: [], points: [] };
  const q = `name=${encodeURIComponent(nom)}&races=100&level=5&max=${places}`;
  c.ws = new WebSocket(`${WS}/live/${code}?${q}`);
  c.ouvert = new Promise(res => c.ws.addEventListener('open', res));
  c.ws.addEventListener('message', ev => {
    const x = JSON.parse(ev.data);
    if (x.t === 'bienvenue') c.moi = x.moi;
    if (x.depart_a) c.depart = x.depart_a;
    if (x.t === 'resultat') c.resultats.push(x);
    if (x.t === 'duel') c.points.push(x);
  });
  c.envoyer = o => c.ws.send(JSON.stringify(o));
  return c;
}

/** Ce que CE joueur a gagne sur la derniere course annoncee. */
function aMoi(c) {
  const d = c.points[c.points.length - 1];
  if (!d) return null;
  return [d.hote, d.invite].find(x => x && x.id === c.moi) || null;
}

const ligne = (board, nom) =>
  (board.classement || []).find(x => x.name.toLowerCase() === nom.toLowerCase()) || null;

const duels = () => fetch(`${B}/duels?name=${encodeURIComponent(RAPIDE)}`).then(r => r.json());

/** Une course entiere : tout le monde pret, le pistolet, deux chronos. */
async function courir(a, b, msA, msB, rang) {
  const avant = a.resultats.length;
  a.envoyer({ t: 'pret', pret: true });
  b.envoyer({ t: 'pret', pret: true });
  for (let i = 0; i < 60 && !a.depart; i++) await attendre(100);
  ok(`course ${rang} : le pistolet est annonce`, !!a.depart);
  a.depart = null; b.depart = null;
  a.envoyer({ t: 'fini', ms: msA });
  b.envoyer({ t: 'fini', ms: msB });
  for (let i = 0; i < 60 && a.resultats.length === avant; i++) await attendre(100);
  const r = a.resultats[a.resultats.length - 1];
  ok(`course ${rang} : le verdict est rendu`, !!r && r.issue,
     r ? 'issue ' + r.issue : 'aucun resultat');
  // La base s'ecrit hors du chemin de l'annonce : on lui laisse le temps.
  await attendre(1200);
  return r;
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  REVANCHE EN DIRECT ET CLASSEMENT DES DUELS                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(`   ${RAPIDE} contre ${LENT}, deux courses dans la meme salle`);

const nouvelle = await fetch(`${B}/live/nouveau`, { method: 'POST' }).then(r => r.json());
const code = nouvelle.id;
ok('la salle est ouverte', !!code, JSON.stringify(nouvelle));
if (!code) process.exit(1);

const a = client(code, RAPIDE), b = client(code, LENT);
await Promise.all([a.ouvert, b.ouvert]);
await attendre(400);

titre('la premiere course');
await courir(a, b, 10500, 11200, 1);
const gagne1 = aMoi(a), perdu1 = aMoi(b);
ok('les points sont annonces aux deux joueurs',
   a.points.length === 1 && b.points.length === 1,
   `${a.points.length} / ${b.points.length}`);
ok('le vainqueur voit ses points monter', (gagne1?.lp ?? 0) > 0, `lp=${gagne1?.lp}`);
ok('le perdant voit les siens descendre', (perdu1?.lp ?? 0) < 0, `lp=${perdu1?.lp}`);
ok('chacun recoit son rang', !!gagne1?.rang && !!perdu1?.rang,
   JSON.stringify([gagne1?.rang, perdu1?.rang]));
ok('personne ne recoit les points de l autre',
   gagne1?.id === a.moi && perdu1?.id === b.moi);
const apres1 = await duels();
const l1 = ligne(apres1, RAPIDE), p1 = ligne(apres1, LENT);
ok('le vainqueur est au classement', !!l1, 'absent du tableau');
ok('une victoire comptee', l1?.wins === 1, `wins=${l1?.wins}`);
ok('une defaite comptee en face', p1?.losses === 1, `losses=${p1?.losses}`);
const lp1 = l1?.lp ?? 0, palier1 = l1?.palier ?? 0;

titre('la revanche, dans la meme salle');
await courir(a, b, 10300, 11400, 2);
ok('la revanche annonce ses points a son tour',
   a.points.length === 2, `${a.points.length} annonce(s)`);
ok('et ils ne sont pas nuls', (aMoi(a)?.lp ?? 0) > 0, `lp=${aMoi(a)?.lp}`);
const apres2 = await duels();
const l2 = ligne(apres2, RAPIDE), p2 = ligne(apres2, LENT);
ok('deux victoires comptees', l2?.wins === 2, `wins=${l2?.wins}`);
ok('deux defaites en face', p2?.losses === 2, `losses=${p2?.losses}`);
ok('les points ont bouge une seconde fois',
   (l2?.palier ?? 0) > palier1 || (l2?.lp ?? 0) > lp1,
   `palier ${palier1}→${l2?.palier}, lp ${lp1}→${l2?.lp}`);

titre('a trois, ce n est plus un duel');
const code3 = (await fetch(`${B}/live/nouveau`, { method: 'POST' }).then(r => r.json())).id;
const t = [client(code3, `${RAPIDE}3A`, 3), client(code3, `${RAPIDE}3B`, 3),
           client(code3, `${RAPIDE}3C`, 3)];
await Promise.all(t.map(x => x.ouvert));
await attendre(400);
for (const x of t) x.envoyer({ t: 'pret', pret: true });
for (let i = 0; i < 60 && !t[0].depart; i++) await attendre(100);
t.forEach((x, i) => x.envoyer({ t: 'fini', ms: 10500 + i * 200 }));
for (let i = 0; i < 60 && !t[0].resultats.length; i++) await attendre(100);
await attendre(1500);
ok('un classement est rendu', t[0].resultats.length === 1);
ok('mais aucun point de duel n est annonce',
   t.every(x => x.points.length === 0),
   t.map(x => x.points.length).join('/'));
for (const x of t) x.ws.close();

a.ws.close(); b.ws.close();
console.log(`\n${echecs === 0 ? '✓ tout passe' : '✗ ' + echecs + ' echec(s)'}\n`);
process.exit(echecs === 0 ? 0 : 1);
