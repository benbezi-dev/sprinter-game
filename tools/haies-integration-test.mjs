// Les haies contre un vrai worker : TOP 500, record, defi et duel.
//
// A lancer contre le worker local (`npm run dev` dans worker/, port 8788),
// comme classement-integration-test.mjs. Le harnais haies-serveur verifie que
// les cles sont les memes des deux cotes ; celui-ci verifie que le serveur en
// fait bien ce qu'il fait du sprint, et qu'il ne melange pas les deux jeux.

const B = process.env.BASE || 'http://127.0.0.1:8788';
const ACCES = process.env.ACCES || 'ECRAN1';
const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': ACCES };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b) })
  .then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const lire = u => fetch(B + u, { headers: H })
  .then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const m = Math.random().toString(36).slice(2, 7).toUpperCase();
const nom = s => `HA${m}${s}`;
const appareil = s => `dev-haies-${m.toLowerCase()}-${s.toLowerCase()}`;

/** Une trace reguliere, en decimetres, un point toutes les 80 ms. */
function trace(metres, ms) {
  const n = Math.round(ms / 80), out = [];
  for (let i = 0; i <= n + 5; i++) out.push(Math.round(metres * 10 * i / n));
  return out;
}

titre('LE TOP 500 DU 110 M HAIES');

{
  const r = await post('/submit', {
    device_id: appareil('A'), race_key: '110h', name: nom('A'),
    time_ms: 15210, best_split_ms: 15210, trace: trace(110, 15210),
  });
  ok('un chrono de 110 m haies est accepte', r.statut === 200, `${r.statut} ${JSON.stringify(r.corps)}`);
  const lb = await lire('/leaderboard?race=110h');
  ok('il figure au classement du 110 m haies',
     lb.statut === 200 && (lb.corps.entries || []).some(x => x.name === nom('A')),
     `${lb.statut} ${JSON.stringify(lb.corps).slice(0, 160)}`);
  const lb100 = await lire('/leaderboard?race=100');
  ok('et pas a celui du 100 m', !(lb100.corps.entries || []).some(x => x.name === nom('A')));
  const lb100h = await lire('/leaderboard?race=100h');
  ok('ni a celui du 100 m haies', lb100h.statut === 200 &&
     !(lb100h.corps.entries || []).some(x => x.name === nom('A')));
  const rang = await lire(`/rank?race=110h&device_id=${appareil('A')}`);
  ok('son rang se lit sur le 110 m haies', rang.statut === 200, `${rang.statut} ${JSON.stringify(rang.corps)}`);
  const bad = await lire('/leaderboard?race=110');
  ok('une cle inconnue reste refusee', bad.statut === 400, String(bad.statut));
}

titre('L HISTORIQUE ET LE RECORD');

{
  const r = await post('/race', {
    device_id: appareil('A'), name: nom('A'), race_key: '110h', time_ms: 15210,
    mode: 'campaign', level: 2,
  });
  ok('la course part a l historique', r.statut === 200, `${r.statut} ${JSON.stringify(r.corps)}`);
  const rec = await lire(`/record?nom=${encodeURIComponent(nom('A'))}&race=110h`);
  ok('le record du 110 m haies est lisible', rec.statut === 200,
     `${rec.statut} ${JSON.stringify(rec.corps)}`);
}

titre('UN DEFI SUR 110 M HAIES, ET SON DUEL');

{
  const c = await post('/challenge', {
    name: nom('A'), device_id: appareil('A'),
    races: ['110h'], level_idx: 4, splits: [15210], total_ms: 15210,
    traces: [trace(110, 15210)],
  });
  const id = c.corps.id || c.corps.code;
  ok('le defi est pose', c.statut === 200 && !!id, `${c.statut} ${JSON.stringify(c.corps)}`);
  if (id) {
    const lu = await lire(`/challenge?id=${encodeURIComponent(id)}`);
    ok('il se relit avec ses haies',
       lu.statut === 200 && lu.corps.found && JSON.stringify(lu.corps.races) === '["110h"]',
       `${lu.statut} ${JSON.stringify(lu.corps).slice(0, 160)}`);
    const t = await post('/challenge/attempt', {
      id, name: nom('B'), device_id: appareil('B'), splits: [14900], total_ms: 14900,
    });
    ok('il est releve', t.statut === 200, `${t.statut} ${JSON.stringify(t.corps)}`);
    const d = await lire(`/duels?epreuve=110h&name=${encodeURIComponent(nom('B'))}`);
    const ligne = (d.corps.classement || []).find(x => x.name === nom('B'));
    ok('le duel range le releveur au classement du 110 m haies',
       d.statut === 200 && d.corps.epreuve === '110h' && !!ligne,
       `${d.statut} ${JSON.stringify(d.corps).slice(0, 200)}`);
    const mes = d.corps.mes_epreuves || [];
    ok('sa division de haies est dans ses disciplines',
       mes.some(x => x.epreuve === '110h'), JSON.stringify(mes));
    const d100 = await lire(`/duels?epreuve=100&name=${encodeURIComponent(nom('B'))}`);
    ok('et il n entre pas au classement du 100 m',
       !(d100.corps.classement || []).some(x => x.name === nom('B')));
    ok('les haies sont proposees par le serveur',
       ['100h', '110h', '400h'].every(k => (d.corps.epreuves || []).includes(k)),
       JSON.stringify(d.corps.epreuves));
  }
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
