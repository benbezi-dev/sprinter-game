// Le faux depart des anciennes versions du jeu, en direct.
//
// Le jeu signale maintenant son faux depart a la salle. Les versions deja
// installees ne le font pas : leur joueur est elimine a l'ecran, et la salle
// n'en sait rien. Elle attendait donc une arrivee qui ne viendrait jamais, et
// les autres restaient sans verdict ni points.
//
// La salle les reconnait a leur silence : un partant qui n'a envoye aucune
// position huit secondes apres le pistolet n'a pas couru. On verifie :
//   - a deux, le muet perd, et le duel se tranche et se compte ;
//   - a trois, seul le muet est ecarte — le coureur lent qui envoie sa
//     position n'est pas touche, et la course attend son arrivee ;
//   - celui qui annonce lui-meme son abandon ne change rien a la regle.
//
//   cd worker && npx wrangler dev --local --port 8788
//   node tools/direct-faux-depart-ancien-test.mjs

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

function client(code, nom, places) {
  const c = { nom, moi: null, depart: null, resultat: null, points: null, finis: [] };
  const q = `name=${encodeURIComponent(nom)}&races=100&level=5&max=${places}`;
  c.ws = new WebSocket(`${WS}/live/${code}?${q}`);
  c.ouvert = new Promise(res => c.ws.addEventListener('open', res));
  c.ws.addEventListener('message', ev => {
    const x = JSON.parse(ev.data);
    if (x.t === 'bienvenue') c.moi = x.moi;
    if (x.depart_a) c.depart = x.depart_a;
    if (x.t === 'fini') c.finis.push(x);
    if (x.t === 'resultat') c.resultat = x;
    if (x.t === 'duel') c.points = x;
  });
  c.envoyer = o => c.ws.send(JSON.stringify(o));
  return c;
}

/** Court pour de vrai : une position tous les dixiemes, puis l'arrivee. */
function courir(c, msCourse) {
  const debut = c.depart;
  const t = setInterval(() => {
    const ecoule = Date.now() - debut;
    if (ecoule < 0) return;
    c.envoyer({ t: 'pos', d: Math.min(100, ecoule / msCourse * 100), c: ecoule });
    if (ecoule >= msCourse) {
      clearInterval(t);
      c.envoyer({ t: 'fini', ms: msCourse });
    }
  }, 100);
}

const nouvelle = async () =>
  (await fetch(`${B}/live/nouveau`, { method: 'POST' }).then(r => r.json())).id;

async function piste(noms) {
  const code = await nouvelle();
  const cl = [];
  for (const n of noms) {
    const c = client(code, n, noms.length);
    await c.ouvert;
    cl.push(c);
    await attendre(80);
  }
  await attendre(300);
  for (const c of cl) c.envoyer({ t: 'pret', pret: true });
  for (let i = 0; i < 60 && !cl[0].depart; i++) await attendre(100);
  return cl;
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  FAUX DEPART D UNE ANCIENNE VERSION, EN DIRECT               ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

titre('a deux, le muet perd le duel');
{
  const [hote, muet] = await piste([`FDA${m}Hote`, `FDA${m}Muet`]);
  ok('le pistolet est annonce', !!hote.depart);
  courir(hote, 10400);
  // Le muet ne fait rien : c'est tout ce que fait une ancienne version apres
  // son faux depart.
  const limite = hote.depart + 8000;
  await attendre(Math.max(0, limite - Date.now() - 1500));
  ok('avant huit secondes, personne n est ecarte', !hote.finis.some(f => f.abandon));
  for (let i = 0; i < 120 && !hote.resultat; i++) await attendre(100);
  const r = hote.resultat;
  ok('la salle tranche', !!r);
  ok('le muet est range en abandon', r?.classement?.find(x => x.id === muet.moi)?.abandon === true,
     JSON.stringify(r?.classement));
  ok('l hote gagne le duel', r?.issue === 'challenger', r?.issue);
  ok('le verdict arrive aussi chez le muet', !!muet.resultat);
  for (let i = 0; i < 50 && !hote.points; i++) await attendre(100);
  const p = (hote.points?.joueurs || []).find(x => x.id === hote.moi);
  ok('et la victoire compte', (p?.lp ?? 0) > 0 && p?.duels?.[0]?.issue === 'gagne',
     JSON.stringify(p));
  hote.ws.close(); muet.ws.close();
}

titre('a trois, le lent n est pas le muet');
{
  const [a, lent, muet] = await piste([`FDB${m}A`, `FDB${m}Lent`, `FDB${m}Muet`]);
  ok('le pistolet est annonce', !!a.depart);
  courir(a, 9800);
  // Plus lent que le guet : il passe la ligne apres les huit secondes, mais il
  // court, et sa position le dit.
  courir(lent, 12500);
  await attendre(Math.max(0, a.depart + 9500 - Date.now()));
  const ecartes = a.finis.filter(f => f.abandon).map(f => f.id);
  ok('apres huit secondes, seul le muet est ecarte',
     ecartes.length === 1 && ecartes[0] === muet.moi, JSON.stringify(ecartes));
  ok('la course attend encore le lent', !a.resultat);
  for (let i = 0; i < 80 && !a.resultat; i++) await attendre(100);
  const r = a.resultat;
  ok('elle se tranche a son arrivee', !!r);
  ok('dans l ordre : A, le lent, le muet',
     JSON.stringify(r?.classement?.map(x => x.id)) === JSON.stringify([a.moi, lent.moi, muet.moi]),
     JSON.stringify(r?.classement?.map(x => x.nom)));
  ok('le lent garde son chrono', r?.classement?.[1]?.ms === 12500 && !r?.classement?.[1]?.abandon);
  for (const c of [a, lent, muet]) c.ws.close();
}

titre('l abandon annonce reste immediat');
{
  const [a, b] = await piste([`FDC${m}A`, `FDC${m}B`]);
  courir(a, 10100);
  await attendre(Math.max(0, a.depart - Date.now() + 300));
  b.envoyer({ t: 'abandon' });
  await attendre(400);
  ok('l abandon est diffuse tout de suite',
     a.finis.some(f => f.id === b.moi && f.abandon));
  for (let i = 0; i < 120 && !a.resultat; i++) await attendre(100);
  ok('et la course se tranche a l arrivee de l autre', a.resultat?.issue === 'challenger',
     a.resultat?.issue);
  a.ws.close(); b.ws.close();
}

console.log(`\n${echecs === 0 ? '✓ tout passe' : '✗ ' + echecs + ' echec(s)'}\n`);
process.exit(echecs === 0 ? 0 : 1);
