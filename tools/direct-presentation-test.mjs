// La mise en scene du duel en direct, contre le vrai serveur.
//
// Ce qu'on cherche a prendre en defaut ici n'est pas l'affichage — il faut un
// navigateur pour cela — mais les deux choses que seul le serveur peut rater :
//
//   1. les deux clients doivent recevoir EXACTEMENT la meme sequence, aux
//      memes millisecondes et dans le meme ordre. Une divergence d'un seul
//      champ et les deux ecrans presentent des athletes differents en meme
//      temps, ce qui ne se verrait qu'en production, a deux.
//   2. la signalisation WebRTC doit traverser la salle sans etre alteree, et
//      n'arriver qu'a l'autre — un pair qui recoit sa propre offre casse la
//      negociation.

const B = 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

const attendre = ms => new Promise(r => setTimeout(r, ms));

/** Un client de salle, qui garde tout ce qu'il recoit. */
function client(code, nom) {
  const c = {
    nom, recus: [], moi: null, presentation: null, depart: null,
    signaux: [], ws: null, pret: null,
  };
  c.ws = new WebSocket(`${WS}/live/${code}?name=${encodeURIComponent(nom)}&races=100&level=4`);
  c.ouvert = new Promise(res => { c.ws.addEventListener('open', res); });
  c.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    c.recus.push(m);
    if (m.t === 'bienvenue') c.moi = m.moi;
    if ((m.t === 'salle' || m.t === 'bienvenue') && m.presentation) c.presentation = m.presentation;
    if ((m.t === 'salle' || m.t === 'bienvenue') && m.depart_a) c.depart = m.depart_a;
    if (m.t === 'sdp' || m.t === 'ice') c.signaux.push(m);
  });
  c.envoyer = o => c.ws.send(JSON.stringify(o));
  return c;
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  DUEL EN DIRECT — presentation, signalisation                ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const code = (await (await fetch(B + '/live/nouveau', { method: 'POST' })).json()).id;
console.log('── LA SALLE ─────────────────────────────────────────────────');
console.log(`   code ${code}\n`);

const a = client(code, 'Hôte');
await a.ouvert;
await attendre(150);
const b = client(code, 'Invité');
await b.ouvert;
await attendre(250);

ok('les deux clients ont une identite', !!a.moi && !!b.moi);
ok('les identites sont distinctes', a.moi !== b.moi);

// ------------------------------------------------------------ presentation
console.log('\n── LA PRESENTATION ──────────────────────────────────────────');
a.envoyer({ t: 'pret', pret: true });
await attendre(120);
b.envoyer({ t: 'pret', pret: true });
await attendre(350);

ok('les deux recoivent une presentation', !!a.presentation && !!b.presentation);

if (a.presentation && b.presentation) {
  const pa = a.presentation, pb = b.presentation;
  console.log(`   debut a  ${new Date(pa.debut_a).toISOString().slice(11, 23)}`);
  console.log(`   par joueur ${pa.par} ms, micro ${pa.micro} ms`);
  console.log('   ordre : ' + pa.ordre.map(o => `${o.couloir}.${o.nom}`).join('  '));

  ok('meme instant de debut pour les deux', pa.debut_a === pb.debut_a,
     `${pa.debut_a} vs ${pb.debut_a}`);
  ok('meme duree par participant', pa.par === pb.par);
  ok('meme fenetre micro', pa.micro === pb.micro);
  ok('meme ordre, au champ pres', JSON.stringify(pa.ordre) === JSON.stringify(pb.ordre));
  ok('la fenetre micro tient dans le creneau', pa.micro <= pa.par,
     `${pa.micro} > ${pa.par}`);
  ok('deux participants annonces', pa.ordre.length === 2, pa.ordre.length + '');
  ok("l'hote passe en premier", pa.ordre[0] && pa.ordre[0].id === a.moi);
  ok('les couloirs sont numerotes a partir de 1',
     pa.ordre.every((o, i) => o.couloir === i + 1));

  // Le pistolet doit tomber apres que tout le monde soit passe, sans quoi la
  // course commencerait pendant la presentation.
  const attendu = pa.debut_a + pa.ordre.length * pa.par + 4000;
  ok('le depart suit la presentation', a.depart === attendu,
     `depart ${a.depart}, attendu ${attendu}`);
  ok('les deux ont le meme depart', a.depart === b.depart);
  console.log(`   presentation ${(pa.ordre.length * pa.par) / 1000} s, ` +
              `puis ${(attendu - pa.debut_a - pa.ordre.length * pa.par) / 1000} s avant le pistolet`);
}

// ---------------------------------------------------------- signalisation
console.log('\n── LA SIGNALISATION WEBRTC ──────────────────────────────────');
const offre = { type: 'offer', sdp: 'v=0\r\no=- 42 2 IN IP4 127.0.0.1\r\n' };
a.envoyer({ t: 'sdp', charge: offre });
await attendre(200);

ok("l'offre arrive a l'autre pair", b.signaux.length === 1, b.signaux.length + ' recus');
ok("l'emetteur ne recoit pas sa propre offre", a.signaux.length === 0,
   a.signaux.length + ' recus');
if (b.signaux[0]) {
  ok('la charge traverse intacte',
     JSON.stringify(b.signaux[0].charge) === JSON.stringify(offre));
  ok("l'emetteur est identifie", b.signaux[0].de === a.moi);
}

const candidat = { candidate: 'candidate:1 1 udp 2113937151 192.0.2.1 5000 typ host', sdpMid: '0' };
b.envoyer({ t: 'ice', charge: candidat });
await attendre(200);
ok('un candidat ICE traverse dans l’autre sens', a.signaux.length === 1);
if (a.signaux[0]) {
  ok('le candidat arrive intact',
     JSON.stringify(a.signaux[0].charge) === JSON.stringify(candidat));
}

// ------------------------------------------------------- apres la course
console.log('\n── LE RESULTAT ──────────────────────────────────────────────');
a.envoyer({ t: 'fini', ms: 9500 });
b.envoyer({ t: 'fini', ms: 9900 });
await attendre(300);

const resA = a.recus.find(m => m.t === 'resultat');
ok('un resultat est rendu', !!resA);
if (resA) {
  console.log(`   ${resA.hote.nom} ${(resA.hote.ms / 1000).toFixed(3)} s  ` +
              `contre ${resA.invite.nom} ${(resA.invite.ms / 1000).toFixed(3)} s → ${resA.issue}`);
  ok("l'hote le plus rapide gagne en tant qu'initiateur", resA.issue === 'challenger');
}

// La presentation appartient a la course passee : une revanche doit en refaire
// une neuve, sinon le second duel rejouerait une sequence deja consommee.
const dernierEtat = [...a.recus].reverse().find(m => m.t === 'salle' || m.t === 'resultat');
await attendre(100);
const etat = await (await fetch(`${B}/live/${code}/etat`)).json();
ok('la presentation est retiree apres la course', etat.presentation === null,
   JSON.stringify(etat.presentation));
ok('le depart est retire apres la course', etat.depart_a === null);

a.ws.close(); b.ws.close();
console.log('\n' + '─'.repeat(62));
console.log(echecs === 0 ? '   TOUT PASSE.' : `   ${echecs} VERIFICATION(S) EN ECHEC.`);
console.log('');
process.exit(echecs ? 1 : 0);
