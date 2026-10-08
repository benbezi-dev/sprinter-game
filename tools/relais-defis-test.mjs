// Defier des equipes deja formees : l'annuaire, le defi, sa distribution.
//
// Ce qu'on cherche a prendre en defaut : une equipe incomplete proposee a
// l'annuaire, ses propres equipes proposees a soi-meme, un defi a plus de sept
// equipes accepte, un defi qui n'arriverait pas chez les coequipiers du
// lanceur, et une confrontation qui ne reunirait pas les equipes du defi.
//
//   B=http://127.0.0.1:8791 node tools/relais-defis-test.mjs
const B = process.env.B || 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const H = { 'Content-Type': 'application/json' };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json());
const get = u => fetch(B + u).then(r => r.json());

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };

const marque = Math.random().toString(36).slice(2, 6).toUpperCase();

async function monterEquipe(prefixe, complete = true) {
  const noms = [1, 2, 3, 4].map(i => `${prefixe}${i}${marque}`);
  const c = await post('/relay/team', { name: prefixe + marque, creator: noms[0], members: noms.slice(1) });
  const autres = complete ? noms.slice(1) : noms.slice(1, 3);
  for (const n of autres) await post('/relay/answer', { id: c.equipe.id, name: n, accept: true });
  return { id: c.equipe.id, nom: c.equipe.nom, noms };
}

console.log('— monter neuf equipes completes et une incomplete');
const equipes = [];
for (let i = 0; i < 9; i++) equipes.push(await monterEquipe('Df' + String.fromCharCode(65 + i)));
const boiteuse = await monterEquipe('Dz', false);
const [moi, ...autres] = equipes;

console.log('— l annuaire');
const a = await get(`/relay/teams?name=${encodeURIComponent(moi.noms[0])}&q=${marque.toLowerCase()}`);
const ids = new Set((a.equipes || []).map(x => x.id));
ok('les huit autres equipes completes y sont', autres.every(x => ids.has(x.id)), JSON.stringify([...ids]));
ok('ma propre equipe n y est pas', !ids.has(moi.id));
ok('l equipe incomplete n y est pas', !ids.has(boiteuse.id));
ok('chaque equipe porte ses quatre coureurs',
   (a.equipes || []).every(x => x.membres.length === 4 && typeof x.en_ligne === 'number'));
const parCoureur = await get(`/relay/teams?q=${encodeURIComponent(autres[2].noms[3].toLowerCase())}`);
ok('on trouve une equipe par le nom d un de ses coureurs',
   (parCoureur.equipes || []).some(x => x.id === autres[2].id));

console.log('— les refus');
let r = await post('/relay/defi', { team: moi.id, name: moi.noms[0], targets: autres.map(x => x.id) });
ok('huit equipes defiees : refuse (sept au plus)', !!r.error, JSON.stringify(r));
r = await post('/relay/defi', { team: moi.id, name: autres[0].noms[0], targets: [autres[1].id] });
ok('defier au nom d une equipe ou l on ne court pas : refuse', !!r.error, JSON.stringify(r));
r = await post('/relay/defi', { team: moi.id, name: moi.noms[0], targets: [boiteuse.id] });
ok('defier une equipe incomplete : refuse', !!r.error, JSON.stringify(r));
r = await post('/relay/defi', { team: moi.id, name: moi.noms[0], targets: [moi.id] });
ok('se defier soi-meme : refuse', !!r.error, JSON.stringify(r));

console.log('— defier sept equipes');
const cibles = autres.slice(0, 7);
r = await post('/relay/defi', { team: moi.id, name: moi.noms[0], targets: cibles.map(x => x.id) });
ok('le defi part', !!r.id && r.max === 8, JSON.stringify(r));
const conf = r.id;

const recu = await get(`/relay/defis?name=${encodeURIComponent(cibles[6].noms[2])}`);
const d = (recu.defis || []).find(x => x.conf === conf);
ok('un coureur d une equipe defiee le recoit', !!d, JSON.stringify(recu));
ok('avec son equipe, celle qui defie et les six autres',
   d && d.equipe === cibles[6].id && d.role === 'defie' && d.de === moi.nom
     && d.adversaires.length === 7 && d.max === 8, JSON.stringify(d));
const coeq = await get(`/relay/defis?name=${encodeURIComponent(moi.noms[2])}`);
const dc = (coeq.defis || []).find(x => x.conf === conf);
ok('un coequipier du lanceur le recoit aussi',
   dc && dc.role === 'lanceur' && dc.equipe === moi.id && !dc.lance_par_moi, JSON.stringify(dc));
const lanceur = await get(`/relay/defis?name=${encodeURIComponent(moi.noms[0])}`);
ok('le lanceur le voit comme le sien',
   (lanceur.defis || []).some(x => x.conf === conf && x.lance_par_moi));
const horsJeu = await get(`/relay/defis?name=${encodeURIComponent(autres[7].noms[0])}`);
ok('une equipe non defiee ne le recoit pas', !(horsJeu.defis || []).some(x => x.conf === conf));

console.log('— la confrontation reunit les equipes du defi');
const sockets = [];
function entrer(eq, nom) {
  return new Promise(res => {
    const ws = new WebSocket(`${WS}/relay/conf/${conf}?team=${eq.id}&name=${encodeURIComponent(nom)}&max=8`);
    sockets.push(ws);
    ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.t === 'bienvenue') res(m); });
    ws.addEventListener('error', () => res(null));
  });
}
const b1 = await entrer(moi, moi.noms[0]);
const b2 = await entrer(cibles[3], cibles[3].noms[1]);
ok('le lanceur et une equipe defiee entrent dans la meme salle',
   b1 && b2 && b2.equipes.length === 2 && b2.max === 8, JSON.stringify(b2 && b2.equipes.map(x => x.equipe)));
for (const s of sockets) s.close();

console.log('— la sonnette ne sert pas de jouet');
let refus = null;
for (let i = 0; i < 6 && !refus; i++) {
  const x = await post('/relay/defi', { team: moi.id, name: moi.noms[0], targets: [autres[7].id] });
  if (x.error) refus = x.error;
}
ok('au-dela de cinq defis en dix minutes, l equipe attend', !!refus, refus);

console.log(e ? `\n${e} ECHEC(S)` : '\nTOUT PASSE');
process.exit(e ? 1 : 0);
