// Huit equipes de relais, trente-deux telephones, un seul coup de pistolet.
//
// Le harnais a deux equipes (relais-confrontation-test.mjs) ne pouvait pas voir
// ce qui ne casse qu'au-dela de deux, et il y en avait :
//
// - le pistolet partait des que DEUX equipes etaient pretes, quel que soit le
//   nombre annonce a l'ouverture. On ouvrait pour huit, on courait a deux, et
//   les six autres trouvaient une piste deja partie.
// - une equipe entree puis repartie avant le depart gardait sa place. Elle
//   comptait dans la piste pleine, et surtout la confrontation attendait
//   qu'elle finisse une course qu'elle ne courrait jamais : pas de classement,
//   rien d'ecrit au tableau.
// - les couloirs se decidaient sur chaque telephone, et le huitieme tombait
//   hors de la piste.
// - chacun recevait la position des trente et un autres, dix fois par
//   seconde : les vingt-quatre relayeurs qui attendent a leur marque compris,
//   qui ne disent rien aux autres equipes.
//
// Puis une confrontation a trois, pour les couloirs du milieu.
//
// Contre le serveur local : `npx wrangler dev --local --port 8788` dans worker/.
const B = process.env.API || 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const ACCES = process.env.ACCES || 'ECRAN1';
const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': ACCES };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json());
const attendre = ms => new Promise(r => setTimeout(r, ms));

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };

const LEG = 100;

/** Une equipe complete, prete a courir. */
async function monterEquipe(prefixe) {
  const m = Math.random().toString(36).slice(2, 5).toUpperCase();
  const noms = [1, 2, 3, 4].map(i => `${prefixe}${i}${m}`);
  const c = await post('/relay/team', { name: prefixe + m, creator: noms[0], members: noms.slice(1) });
  for (const n of noms.slice(1)) await post('/relay/answer', { id: c.equipe.id, name: n, accept: true });
  return { id: c.equipe.id, nom: c.equipe.nom, noms };
}

/**
 * Un relayeur : il court, s'elance quand le porteur approche, et tape.
 * Le meme que celui du harnais a deux, avec la taille de la piste en plus.
 */
function relayeur(conf, equipe, nom, vitesse, max) {
  const c = { nom, equipe, relais: 0, zone: null, moi: null, etat: null,
              fini: false, tape: false, boucle: null, porteur: 1, d: {},
              refuse: false, ouvert: false,
              // Ce qui arrive des AUTRES equipes : combien, et combien venaient
              // d'un relayeur qui ne portait pas le temoin.
              recusAutres: 0, horsTemoin: 0, recusMiens: 0 };
  const q = `acces=${ACCES}&team=${equipe}&name=${encodeURIComponent(nom)}&max=${max}`;
  c.ws = new WebSocket(`${WS}/relay/conf/${conf}?${q}`);
  c.pret = new Promise(res => {
    c.ws.addEventListener('open', () => { c.ouvert = true; res(true); });
    // Une piste pleine ou deja partie refuse la poignee de main : la socket ne
    // s'ouvre jamais.
    c.ws.addEventListener('error', () => { c.refuse = true; res(false); });
    c.ws.addEventListener('close', () => { if (!c.ouvert) { c.refuse = true; res(false); } });
  });
  c.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'bienvenue') { c.moi = m.moi; c.relais = m.relais; c.zone = m.zone; }
    if (m.equipes) c.etat = m;
    if (m.t === 'pos') {
      if (!c.d[m.equipe]) c.d[m.equipe] = {};
      c.d[m.equipe][m.relais] = m.d;
      if (m.equipe === c.equipe) c.recusMiens++;
      else {
        c.recusAutres++;
        // Un porteur annonce le temoin lui-meme : sa position ET celle du
        // temoin sont le meme nombre. Tout autre ecart vient d'un relayeur qui
        // attend, dont la position ne regarde que son equipe.
        if (m.temoin == null || Math.abs(m.d - m.temoin) > 0.05) c.horsTemoin++;
      }
    }
    if (m.t === 'passe' && m.equipe === c.equipe) { c.porteur = m.vers; c.tape = false; }
    if (m.t === 'termine') c.fini = m;
    if (m.depart_a && !c.boucle) demarrer(c, m.depart_a, vitesse);
  });
  c.envoyer = o => { try { c.ws.send(JSON.stringify(o)); } catch { } };
  return c;
}

function demarrer(c, departA, vitesse) {
  const debut = (c.relais - 1) * LEG;
  let d = c.zone ? Math.max(debut, c.zone.debut) : debut;
  c.boucle = setInterval(() => {
    const t = Date.now() - departA;
    if (t < 0) return;
    const mien = c.etat?.equipes?.find(x => x.equipe === c.equipe);
    if (mien && (mien.elimine || mien.total != null)) return;
    const miens = c.d[c.equipe] || {};
    const temoinD = miens[c.porteur] ?? (c.porteur - 1) * LEG;
    const porte = c.porteur === c.relais;
    const recois = c.porteur === c.relais - 1;
    if (porte) {
      d += vitesse * 0.1;
    } else if (recois && temoinD > d - 6) {
      c.lance = (c.lance || 0) + 0.1;
      d += vitesse * Math.min(1, c.lance / 2.2) * 0.1;
    }
    // On emet a chaque tour, qu'on coure ou non : c'est ce que fait le jeu.
    c.envoyer({ t: 'pos', d });
    const suivantD = miens[c.relais + 1];
    if (!c.tape && recois && Math.abs(temoinD - d) < 2 &&
        d >= (c.zone?.debut ?? 0) && temoinD >= (c.zone?.debut ?? 0)) {
      c.tape = true; c.envoyer({ t: 'temoin' });
    }
    const zoneSuivant = c.relais * LEG;
    if (!c.tape && porte && suivantD != null &&
        d >= zoneSuivant && Math.abs(suivantD - d) < 2) {
      c.tape = true; c.envoyer({ t: 'temoin' });
    }
    if (c.relais === 4 && porte && d >= 400 && !c.aFini) {
      c.aFini = true; c.envoyer({ t: 'fini', ms: t });
      clearInterval(c.boucle);
    }
  }, 100);
}

async function entrer(conf, eq, vitesse, max) {
  const out = [];
  for (const n of eq.noms) {
    const c = relayeur(conf, eq.id, n, vitesse, max);
    await c.pret; out.push(c); await attendre(30);
  }
  return out;
}

const pret = (cl) => { for (const c of cl) c.envoyer({ t: 'pret', pret: true }); };
const fermer = (cl) => { for (const c of cl) { clearInterval(c.boucle); try { c.ws.close(); } catch { } } };

async function courirJusquauBout(cl, max = 240) {
  for (let i = 0; i < max; i++) {
    await attendre(400);
    if (cl.every(c => c.fini)) break;
  }
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  CONFRONTATION A HUIT EQUIPES — trente-deux relayeurs        ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const PREFIXES = ['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG', 'HH'];
const equipes = [];
for (const p of PREFIXES) equipes.push(await monterEquipe(p));
const partante = await monterEquipe('XX');       // entre, puis repart
const intruse = await monterEquipe('ZZ');        // trouve la piste pleine
console.log(`   ${equipes.length} equipes montees, plus deux pour les cas limites\n`);

const conf = (await post('/relay/confrontation', {})).id;
console.log(`── LA CONFRONTATION ${conf}, OUVERTE POUR HUIT ──────────────\n`);

const cl = [];
// Les sept premieres, toutes pretes.
for (const [i, eq] of equipes.slice(0, 7).entries()) {
  cl.push(...await entrer(conf, eq, 8.6 + i * 0.1, 8));
}
await attendre(300);
pret(cl);
await attendre(600);
ok('sept equipes pretes sur huit ne declenchent pas le pistolet', !cl[0].etat?.depart_a);
ok('la salle dit qu il en manque une', cl[0].etat?.equipes?.length === 7 && cl[0].etat?.max === 8,
   `${cl[0].etat?.equipes?.length} / ${cl[0].etat?.max}`);

// Une huitieme entre... et repart sans courir.
const partants = await entrer(conf, partante, 9, 8);
await attendre(300);
ok('la huitieme place est prise', cl[0].etat?.equipes?.length === 8);
fermer(partants);
await attendre(600);
ok('une equipe repartie avant le depart libere sa place',
   cl[0].etat?.equipes?.length === 7 &&
   !cl[0].etat.equipes.some(x => x.equipe === partante.id),
   (cl[0].etat?.equipes || []).map(x => `${x.equipe}:${x.presents}`).join(' '));

// La vraie huitieme.
const huitieme = await entrer(conf, equipes[7], 9.3, 8);
cl.push(...huitieme);
await attendre(300);
ok('aucun depart tant que la huitieme n est pas prete', !cl[0].etat?.depart_a);

// La neuvieme trouve la piste pleine.
const intrus = relayeur(conf, intruse.id, intruse.noms[0], 9, 8);
const entre = await intrus.pret;
ok('une neuvieme equipe est refusee', !entre, 'elle est entree');
fermer([intrus]);

pret(huitieme);
await attendre(700);
ok('la piste pleine et prete : le pistolet part', !!cl[0].etat?.depart_a);
ok('un seul instant pour les trente-deux',
   new Set(cl.map(c => c.etat?.depart_a)).size === 1);

console.log('\n── LES COULOIRS ─────────────────────────────────────────────');
const couloirs = (c) => (c.etat?.equipes || []).map(x => `${x.equipe}=${x.couloir}`).sort().join(',');
const lus = cl[0].etat?.equipes?.map(x => x.couloir) || [];
ok('chaque equipe a son couloir, de 1 a 8',
   lus.length === 8 && [...lus].sort((a, b) => a - b).join() === '1,2,3,4,5,6,7,8',
   JSON.stringify(lus));
ok('le meme couloir sur les trente-deux telephones',
   new Set(cl.map(couloirs)).size === 1);

console.log('\n── LA COURSE ────────────────────────────────────────────────');
// Une equipe tardive ne doit pas pouvoir entrer pendant la course.
await courirJusquauBout(cl);
const f = cl.find(c => c.fini)?.fini;
ok('la confrontation se termine', !!f);
ok('les huit sont au classement', f?.classement?.length === 8,
   String(f?.classement?.length));
if (f) {
  for (const l of f.classement) {
    console.log(l.total != null
      ? `     ${String(l.place).padStart(2)}. ${l.nom.padEnd(8)} ${(l.total / 1000).toFixed(3)} s`
      : `      —. ${l.nom.padEnd(8)} eliminee : ${l.elimine.raison} (relais ${l.elimine.relais})`);
  }
  const finies = f.classement.filter(x => x.total != null);
  ok('le classement range les finies au chrono',
     finies.every((x, i) => i === 0 || x.total >= finies[i - 1].total));
}

console.log('\n── CE QUI CIRCULE ───────────────────────────────────────────');
const autres = cl.reduce((s, c) => s + c.recusAutres, 0);
const hors = cl.reduce((s, c) => s + c.horsTemoin, 0);
console.log(`   positions recues des autres equipes : ${autres}, dont ${hors} hors temoin`);
ok('chacun voit courir les sept autres', cl.every(c => Object.keys(c.d).length === 8),
   cl.map(c => Object.keys(c.d).length).join(','));
ok('les autres equipes ne recoivent que le temoin', hors === 0, `${hors} positions de trop`);
ok('chacun suit ses trois coequipiers', cl.every(c => c.recusMiens > 0));
fermer(cl);

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  A TROIS — les couloirs du milieu                            ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const conf3 = (await post('/relay/confrontation', {})).id;
const cl3 = [];
for (const [i, eq] of equipes.slice(0, 3).entries()) {
  cl3.push(...await entrer(conf3, eq, 8.8 + i * 0.2, 3));
}
await attendre(300);
pret(cl3);
await attendre(700);
ok('trois equipes sur trois : le pistolet part', !!cl3[0].etat?.depart_a);
const lus3 = (cl3[0].etat?.equipes || []).map(x => x.couloir);
ok('elles courent au milieu de la piste, couloirs 3, 4 et 5',
   lus3.join() === '3,4,5', JSON.stringify(lus3));
const tard = relayeur(conf3, equipes[3].id, equipes[3].noms[0], 9, 3);
ok('personne n entre pendant la course', !(await tard.pret));
fermer([tard]);
await courirJusquauBout(cl3);
const f3 = cl3.find(c => c.fini)?.fini;
ok('la confrontation a trois se termine', !!f3 && f3.classement.length === 3,
   String(f3?.classement?.length));
fermer(cl3);

console.log('\n' + '─'.repeat(62));
console.log(e === 0 ? '   TOUT PASSE.' : `   ${e} VERIFICATION(S) EN ECHEC.`);
process.exit(e ? 1 : 0);
