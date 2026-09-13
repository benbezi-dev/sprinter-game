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
              porteur: 1, d: {},
              // Ce que le JEU dessinerait, selon les deux lectures possibles
              // d'un message de position — voir le commentaire dans `pos`.
              piste: {}, naif: {}, ecart: {}, sansTemoin: 0 };
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

      // CE QUE LE JEU DESSINE, et c'est la que le harnais etait aveugle.
      //
      // Il verifiait qu'une position adverse arrive, jamais a quelle distance
      // elle place le coureur. Or un client n'affiche qu'UN coureur par equipe
      // adverse — le temoin — et l'avance par liveDistDe, qui ne retient que
      // ce qui monte. La salle, elle, annonce la position de chacun des quatre
      // relayeurs, les trois receveurs comprises : des le pistolet, une equipe
      // emet 0, 100, 200 et 300. La lecture naive plantait donc l'equipe d'a
      // cote a trois cents metres au coup de pistolet.
      //
      // On rejoue les deux lectures pour que l'ecart se voie ici plutot qu'a
      // l'ecran : `piste` suit le champ `temoin`, qui fait foi ; `naif` prend
      // la position de n'importe quel relayeur, comme avant le correctif.
      if (m.temoin == null) c.sansTemoin++;
      else c.piste[m.equipe] = Math.max(c.piste[m.equipe] ?? 0, m.temoin);
      c.naif[m.equipe] = Math.max(c.naif[m.equipe] ?? 0, m.d);
      if (m.temoin != null) {
        c.ecart[m.equipe] = Math.max(c.ecart[m.equipe] ?? 0,
                                     c.naif[m.equipe] - m.temoin);
      }
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
    } else if (recois && temoinD > d - 6) {
      c.lance = (c.lance || 0) + 0.1;
      const v = vitesse * Math.min(1, c.lance / 2.2);
      d += v * 0.1;
    }
    // ON EMET A CHAQUE TOUR, QU'ON COURE OU NON.
    //
    // C'est ce que fait le jeu : `pousserPosition` transmet `G.player.d` dix
    // fois par seconde des le coup de pistolet, et la salle du relais est
    // branchee a ce moment-la pour les quatre relayeurs — celui qui attend a
    // sa marque emet donc sa marque. Le harnais n'emettait, lui, que depuis le
    // porteur et le receveur lance : il courait dans des conditions que le jeu
    // ne connait pas, et c'est ainsi qu'il a pu declarer bonne une lecture qui
    // posait l'equipe adverse a trois cents metres au depart.
    c.envoyer({ t: 'pos', d });
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

// --- OU l'a-t-il vue courir ? ---------------------------------------------
console.log('\n── LE TEMOIN ADVERSE, ET NON UN RELAYEUR A SA MARQUE ───────');
const adverseDe = c => (c.equipe === A.id ? Bq.id : A.id);
ok('la salle annonce la position du temoin', cl.every(c => c.sansTemoin === 0),
   'messages sans le champ : ' + cl.map(c => c.sansTemoin).join(','));
// La verite, c'est le temoin tenu par la salle. Le coureur dessine doit le
// suivre exactement — au dixieme de metre pres, la salle arrondissant la.
ok('le coureur dessine EST le temoin',
   cl.every(c => Math.abs((c.piste[adverseDe(c)] ?? -1)
                          - (c.etat?.equipes?.find(x => x.equipe === adverseDe(c))?.temoin_d ?? -2)) < 1),
   cl.map(c => `${(c.piste[adverseDe(c)] ?? -1).toFixed(1)} vs ` +
               `${c.etat?.equipes?.find(x => x.equipe === adverseDe(c))?.temoin_d}`).join(' | '));
// Et voila ce que coutait la lecture naive : l'ecart maximal, en metres, entre
// le coureur qu'elle dessinait et le temoin qu'il pretendait etre.
const pire = Math.max(...cl.map(c => c.ecart[adverseDe(c)] ?? 0));
console.log(`   la lecture d'avant le correctif s'ecartait du temoin de ${pire.toFixed(1)} m au pire`);
ok('la lecture naive etait bien fautive (temoin de non-regression)', pire > 50,
   `ecart maximal ${pire.toFixed(1)} m`);

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
