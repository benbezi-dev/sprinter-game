// Deux equipes de relais, un seul coup de pistolet, un classement.
//
// Ce qu'on cherche a prendre en defaut : le depart qui partirait avant que
// toutes les equipes soient pretes, une position qui ne sortirait pas de son
// equipe — auquel cas chacun courrait seul en croyant courir contre l'autre —
// et l'elimination d'une equipe qui emporterait les autres avec elle.
const B = 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const ACCES = process.env.ACCES || 'ECRAN1';
const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': ACCES };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json());
const attendre = ms => new Promise(r => setTimeout(r, ms));

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };

const LEG = 100, ZONE = 30;

/** Une equipe complete, prete a courir. */
async function monterEquipe(prefixe) {
  const m = Math.random().toString(36).slice(2, 5).toUpperCase();
  const noms = [1, 2, 3, 4].map(i => `${prefixe}${i}${m}`);
  const c = await post('/relay/team', { name: prefixe + m, creator: noms[0], members: noms.slice(1) });
  for (const n of noms.slice(1)) await post('/relay/answer', { id: c.equipe.id, name: n, accept: true });
  return { id: c.equipe.id, nom: c.equipe.nom, noms };
}

/** Un relayeur : il court, s'elance quand le porteur approche, et tape. */
function relayeur(conf, equipe, nom, vitesse) {
  const c = { nom, equipe, relais: 0, zone: null, moi: null, etat: null,
              vus: new Set(), fini: false, tape: false, boucle: null,
              porteur: 1, d: {} };
  const url = `${WS}/relay/conf/${conf}?acces=${ACCES}&team=${equipe}&name=${encodeURIComponent(nom)}`;
  c.ws = new WebSocket(url);
  c.pret = new Promise(res => c.ws.addEventListener('open', res));
  c.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'bienvenue') { c.moi = m.moi; c.relais = m.relais; c.zone = m.zone; }
    if (m.equipes) c.etat = m;
    // Pendant la course, seules les positions circulent : l'etat complet n'est
    // diffuse que sur evenement. Un client qui ne lirait que l'etat courrait
    // avec un temoin fige a zero — c'est exactement ce qui s'est passe ici.
    if (m.t === 'pos') {
      c.vus.add(m.equipe);
      if (!c.d[m.equipe]) c.d[m.equipe] = {};
      c.d[m.equipe][m.relais] = m.d;
    }
    if (m.t === 'passe' && m.equipe === c.equipe) { c.porteur = m.vers; c.tape = false; }
    if (m.t === 'termine') c.fini = m;
    if (m.depart_a && !c.boucle) demarrer(c, m.depart_a, vitesse);
  });
  c.envoyer = o => c.ws.send(JSON.stringify(o));
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
    // Le porteur et les positions se suivent au fil des messages, pas de
    // l'etat complet.
    const miens = c.d[c.equipe] || {};
    const temoinD = miens[c.porteur] ?? (c.porteur - 1) * LEG;
    const porte = c.porteur === c.relais;
    const recois = c.porteur === c.relais - 1;
    // Le receveur s'elance quand le temoin arrive derriere lui, et part de
    // l'arret : c'est ce qui permet au porteur de le rattraper dans la zone.
    // Sans cette montee en vitesse, il garde son avance et sort de la zone
    // avant le temoin — ce qui elimine, a juste titre.
    if (porte) {
      d += vitesse * 0.1;
      c.envoyer({ t: 'pos', d });
    } else if (recois && temoinD > d - 6) {
      c.lance = (c.lance || 0) + 0.1;
      const v = vitesse * Math.min(1, c.lance / 2.2);
      d += v * 0.1;
      c.envoyer({ t: 'pos', d });
    }
    // Cote a cote dans la zone : les DEUX tapent. Le donneur aussi — c'est
    // tout l'objet d'un passage, et l'oublier condamne le relayeur 1 a courir
    // au-dela de la zone avec le temoin.
    const suivantD = miens[c.relais + 1];
    if (!c.tape && recois && Math.abs(temoinD - d) < 3 &&
        d >= (c.zone?.debut ?? 0) && temoinD >= (c.zone?.debut ?? 0)) {
      c.tape = true; c.envoyer({ t: 'temoin' });
    }
    // Le donneur ne tape qu'une fois DANS la zone du receveur : taper avant
    // elimine, et c'est la regle que le serveur applique.
    const zoneSuivant = c.relais * LEG;
    if (!c.tape && porte && suivantD != null &&
        d >= zoneSuivant && Math.abs(suivantD - d) < 3) {
      c.tape = true; c.envoyer({ t: 'temoin' });
    }
    if (c.relais === 4 && porte && d >= 400 && !c.aFini) {
      c.aFini = true; c.envoyer({ t: 'fini', ms: t });
      clearInterval(c.boucle);
    }
  }, 100);
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  CONFRONTATION — deux equipes, un pistolet                   ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const conf = (await post('/relay/confrontation', {})).id;
console.log(`   confrontation ${conf}`);
const A = await monterEquipe('AA');
const Bq = await monterEquipe('BB');
console.log(`   ${A.nom} (${A.id})  contre  ${Bq.nom} (${Bq.id})\n`);

const cl = [];
for (const [eq, v] of [[A, 9.0], [Bq, 8.4]]) {
  for (const [i, n] of eq.noms.entries()) {
    const c = relayeur(conf, eq.id, n, v);
    await c.pret; cl.push(c); await attendre(60);
  }
}
await attendre(600);

ok('les huit sont entres', cl.every(c => c.relais >= 1 && c.relais <= 4));
ok('deux equipes sont formees', cl[0].etat?.equipes?.length === 2,
   String(cl[0].etat?.equipes?.length));

console.log('\n── LE DEPART N EST PAS DONNE A UNE SEULE EQUIPE ────────────');
for (const c of cl.filter(x => x.equipe === A.id)) c.envoyer({ t: 'pret', pret: true });
await attendre(400);
ok('une equipe prete sur deux ne declenche rien', !cl[0].etat?.depart_a);
for (const c of cl.filter(x => x.equipe === Bq.id)) c.envoyer({ t: 'pret', pret: true });
await attendre(500);
ok('les deux pretes declenchent le pistolet', !!cl[0].etat?.depart_a);
ok('un seul instant pour tout le monde',
   new Set(cl.map(c => c.etat?.depart_a)).size === 1);

console.log('\n── LA COURSE ────────────────────────────────────────────────');
for (let i = 0; i < 220; i++) {
  await attendre(400);
  if (cl.some(c => c.fini)) break;
}
// Si rien n'a abouti, on dit ou en est chacun plutot que de conclure a vide.
if (!cl.some(c => c.fini)) {
  console.log('   (rien n a abouti — etat des equipes)');
  for (const eq of (cl[0].etat?.equipes || [])) {
    console.log(`     ${eq.nom} porteur ${eq.porteur} temoin ${eq.temoin_d} m ` +
                `passes ${eq.passes.length} ` + (eq.elimine ? 'ELIMINEE ' + eq.elimine.raison : ''));
  }
  for (const c of cl.slice(0, 4)) {
    console.log(`     ${c.nom} relais ${c.relais} · vu ${JSON.stringify(c.d[c.equipe] || {})}`);
  }
}
const f = cl.find(c => c.fini)?.fini;
ok('la confrontation se termine', !!f);
ok('chacun a vu courir l equipe adverse',
   cl.every(c => c.vus.size >= 2 || c.vus.has(c.equipe === A.id ? Bq.id : A.id)),
   cl.map(c => c.vus.size).join(','));

if (f) {
  console.log('');
  for (const l of f.classement) {
    console.log(l.total != null
      ? `     ${l.place}. ${l.nom.padEnd(10)} ${(l.total / 1000).toFixed(3)} s   passages ${l.passes.join('/')}`
      : `     —. ${l.nom.padEnd(10)} eliminee : ${l.elimine.raison} (relais ${l.elimine.relais})`);
  }
  const finies = f.classement.filter(x => x.total != null);
  ok('le classement range les finies au chrono',
     finies.every((x, i) => i === 0 || x.total >= finies[i - 1].total));
  ok('les eliminees passent derriere',
     f.classement.every((x, i) => x.total != null || f.classement.slice(i).every(y => y.total == null)));
}

for (const c of cl) { clearInterval(c.boucle); c.ws.close(); }
console.log('\n' + '─'.repeat(62));
console.log(e === 0 ? '   TOUT PASSE.' : `   ${e} VERIFICATION(S) EN ECHEC.`);
process.exit(e ? 1 : 0);
