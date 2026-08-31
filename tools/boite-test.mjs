// La liaison permanente, contre un vrai worker local.
//
// Ce qui doit tenir : la socket s'ouvre, elle repond au battement de coeur,
// et un defi adresse a quelqu'un fait sonner SA boite — pas celle d'un autre.
// WebSocket est fourni par Node depuis la version 22 : rien a installer.

const B = process.env.BASE || 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 54 - t.length))}`);
const post = (u, b) => fetch(B + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
}).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));

const devA = 'aaaaaaaa-1111-2222-3333-444444444444';
const devB = 'bbbbbbbb-1111-2222-3333-444444444444';
const suffixe = Math.random().toString(36).slice(2, 6).toUpperCase();
const nomA = 'BOITEA' + suffixe, nomB = 'BOITEB' + suffixe;

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LA BOITE — liaison permanente                               ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

/** Ouvre une boite et retient ce qui y tombe. */
function boite(dev) {
  const recu = [];
  const ws = new WebSocket(`${WS}/boite/${dev}`);
  const prete = new Promise((res, rej) => {
    ws.onopen = () => res();
    ws.onerror = rej;
  });
  ws.onmessage = ev => { try { recu.push(JSON.parse(String(ev.data))); } catch { /* ignore */ } };
  return { ws, recu, prete, attendre: async (t, ms = 4000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      if (recu.some(m => m.t === t)) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  } };
}

titre('LA LIAISON S OUVRE');
const bA = boite(devA), bB = boite(devB);
await Promise.all([bA.prete, bB.prete]);
ok('la boite de A s ouvre', await bA.attendre('ouverte'));
ok('celle de B aussi', await bB.attendre('ouverte'));

titre('LE BATTEMENT DE COEUR');
bB.ws.send('{"t":"ping"}');
ok('le serveur repond au ping', await bB.attendre('pong'));

titre('UN DEFI ADRESSE FAIT SONNER LA BONNE BOITE');
// B pose un chrono au TOP 500 : c'est la ligne que A va viser.
const soumis = await post('/submit', {
  device_id: devB, race_key: '100', name: nomB, time_ms: 10500, best_split_ms: 10500,
});
ok('le chrono de B est enregistre', soumis.statut === 200, JSON.stringify(soumis.corps).slice(0, 120));
const liste = await fetch(`${B}/leaderboard?race=100&by=race`).then(r => r.json());
const ligneB = (liste.entries || []).find(x => x.name === nomB);
ok('sa ligne porte un identifiant', !!(ligneB && ligneB.id != null));

const avantA = bA.recu.length;
const defi = await post('/challenge', {
  device_id: devA, name: nomA, races: ['100'], level_idx: 4,
  total_ms: 10200, splits: [10200], traces: [[0, 10, 20, 30]],
  target_score_id: ligneB ? ligneB.id : null,
});
ok('le defi part', defi.statut === 200 && !!defi.corps.id, JSON.stringify(defi.corps).slice(0, 120));
ok('il est bien adresse a B', defi.corps.target_name === nomB, String(defi.corps.target_name));
ok('la boite de B sonne', await bB.attendre('defi'));
ok('celle de A reste muette', bA.recu.length === avantA,
   JSON.stringify(bA.recu.slice(avantA)));

titre('LE DUEL TRANCHE SONNE CHEZ CELUI QUI A LANCE');
const avantB = bB.recu.length;
const rep = await post('/challenge/attempt', {
  id: defi.corps.id, device_id: devB, name: nomB, total_ms: 9900, splits: [9900],
});
ok('la tentative est enregistree', rep.statut === 200, JSON.stringify(rep.corps).slice(0, 100));
ok('la boite de A sonne', await bA.attendre('duel'));
ok('celle de B ne sonne pas pour ca', !bB.recu.slice(avantB).some(m => m.t === 'duel'));

bA.ws.close(); bB.ws.close();
console.log(e ? `\n${e} echec(s)\n` : '\nTout tient.\n');
process.exit(e ? 1 : 0);
