/**
 * LA SALLE DU RELAIS — CE QUI SE PASSE APRES L'ARRIVEE.
 *
 * `tools/relais-regles-test.mjs` eprouve les regles pures : zones, portee,
 * eliminations. Celui-ci eprouve la SALLE, c'est-a-dire l'objet qui tient les
 * sockets, le pistolet et les declarations de presence — et un defaut qui ne
 * se voit que la : une course terminee laissait les quatre joueurs marques
 * prets, si bien que le premier `pret` venu rearmait le pistolet et effacait
 * le resultat que les autres etaient en train de lire.
 *
 * Il parle au worker local en WebSocket, comme le jeu. Demarrer d'abord :
 *   cd worker && npx wrangler dev --local --port 8788
 */
const API = process.env.API || 'http://127.0.0.1:8788';
const CODE = process.env.CODE_ACCES || 'RELAIS4';
const entete = { 'X-Sprinter-Test': CODE, 'Content-Type': 'application/json' };

const SUF = Date.now().toString(36).slice(-4).toUpperCase();
const NOMS = [1, 2, 3, 4].map(i => `SALLE${i}${SUF}`);
const EQUIPE = `SALLE ${SUF}`;

const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const poster = async (route, corps) =>
  (await fetch(`${API}${route}`, { method: 'POST', headers: entete, body: JSON.stringify(corps) })).json();

let echecs = 0;
function verifier(nom, vrai, detail = '') {
  console.log(`   ${vrai ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`);
  if (!vrai) echecs++;
}

console.log('\n── LA SALLE APRES L ARRIVEE ──────────────────────────────');

// 1 · une equipe complete, par les memes routes que les boutons du jeu
const cree = await poster('/relay/team', { name: EQUIPE, creator: NOMS[0], members: NOMS.slice(1) });
if (cree.error) throw new Error('equipe refusee : ' + cree.error);
const ID = cree.equipe.id;
for (const n of NOMS.slice(1)) {
  const r = await poster('/relay/answer', { id: ID, name: n, accept: true });
  if (r.error) throw new Error(`${n} : ${r.error}`);
}
const ord = await poster('/relay/order', { id: ID, order: NOMS.map(n => n.toLowerCase()) });
if (ord.error) throw new Error('ordre refuse : ' + ord.error);
console.log(`   equipe ${ID} · ${NOMS.join(', ')}`);

const etat = async () => (await fetch(`${API}/relay/room/${ID}/etat`, { headers: entete })).json();

// 2 · quatre sockets, comme quatre telephones
const ws = [];
for (const n of NOMS) {
  const s = new WebSocket(
    `${API.replace('http', 'ws')}/relay/room/${ID}/ws?name=${encodeURIComponent(n)}&acces=${CODE}`);
  s.addEventListener('message', (e) => {
    try { const m = JSON.parse(e.data); if (m.t === 'ferme') s.close(); } catch (_) {}
  });
  await new Promise((ok, ko) => {
    s.addEventListener('open', ok, { once: true });
    s.addEventListener('error', ko, { once: true });
  });
  ws.push(s);
}
const envoyer = (i, m) => ws[i].send(JSON.stringify(m));
await dormir(400);
verifier('les quatre sont dans la salle', (await etat()).joueurs.length === 4);

// 3 · tous prets : le pistolet s'arme
for (let i = 0; i < 4; i++) envoyer(i, { t: 'pret', pret: true });
await dormir(600);
const arme = await etat();
verifier('le pistolet s arme quand les quatre sont prets', !!arme.depart_a);

// 4 · on attend le coup, puis on elimine l equipe volontairement : le
//     deuxieme relayeur sort de sa zone (100–130 m) sans le temoin.
await dormir(Math.max(0, arme.depart_a - arme.horloge) + 300);
envoyer(1, { t: 'pos', d: 136 });
await dormir(500);
const fini = await etat();
verifier('l equipe est eliminee', !!fini.elimine, fini.elimine?.raison || 'aucune elimination');
verifier('le pistolet est desarme', fini.depart_a === null);

// 5 · LE POINT DU TEST. Un joueur rebascule son bouton « pret ». Avant le
//     correctif, les trois autres etaient restes marques prets : la salle
//     repartait aussitot et `reinitialiser()` effacait l elimination.
envoyer(0, { t: 'pret', pret: true });
await dormir(700);
const apres = await etat();
verifier('un seul « pret » ne relance PAS la course',
         apres.depart_a === null, `depart_a = ${apres.depart_a}`);
verifier('le resultat de la course survit',
         !!apres.elimine, apres.elimine ? '' : 'l elimination a ete effacee');

// 6 · et l equipe peut bien recourir quand les QUATRE se redeclarent
for (let i = 1; i < 4; i++) envoyer(i, { t: 'pret', pret: true });
await dormir(700);
const rejoue = await etat();
verifier('les quatre redeclares relancent bien la course', !!rejoue.depart_a);

for (const s of ws) { try { s.close(); } catch (_) {} }
console.log('\n──────────────────────────────────────────────────────────');
console.log(echecs === 0 ? '   TOUT PASSE.\n' : `   ${echecs} ECHEC(S).\n`);
process.exit(echecs === 0 ? 0 : 1);
