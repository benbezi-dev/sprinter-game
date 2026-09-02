// La salle en direct (salle.js) branchee sur une course de championnat : le
// verdict de la piste doit s'ecrire tout seul dans l'edition, sans passer par
// une saisie manuelle — et un intrus ne doit jamais apparaitre au resultat.
const B = 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const attendre = ms => new Promise(r => setTimeout(r, ms));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': 'cle-de-test-locale-uniquement' };
const acces = await fetch(B + '/test/admin/creer', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ nom: 'harnais-direct-champ' }) }).then(r => r.json());
await fetch(B + '/test/admin/role', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ code: acces.code, role: 'organisateur' }) });
const CODE = acces.code;
const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': CODE };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json());
const get = u => fetch(B + u, { headers: H }).then(r => r.json());

// Miroir exact de codeCourseChamp cote serveur (championnats.js).
function codeCourseChamp(edition, phase, course) {
  const lettre = { series: 'S', demies: 'D', finale: 'F' }[phase] || 'X';
  return (lettre + String(course || 1) + edition).toUpperCase().slice(0, 10);
}

function client(codeSalle, name, max, champ, extra = '') {
  const c = { name, moi: null, resultat: null, chat: [] };
  const q = `name=${encodeURIComponent(name)}&max=${max}` +
    `&champ_edition=${champ.edition}&champ_phase=${champ.phase}&champ_course=${champ.course}` +
    `&acces=${CODE}${extra}`;
  c.ws = new WebSocket(`${WS}/live/${codeSalle}?${q}`);
  c.ouvert = new Promise(res => c.ws.addEventListener('open', res));
  c.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'bienvenue') c.moi = m.moi;
    if (m.t === 'resultat') c.resultat = m;
    if (m.t === 'chat') c.chat.push(m);
  });
  c.envoyer = o => c.ws.send(JSON.stringify(o));
  return c;
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  SALLE EN DIRECT ↔ CHAMPIONNAT                                 ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('── OUVERTURE D UNE EDITION REDUITE (4 JOUEURS) ───────────────');
const samedi = Date.UTC(2026, 8, 5);
const ouv = await post('/champ/ouvrir', { pays: 'PT', debut: samedi });
ok('l edition s ouvre', !ouv.error, JSON.stringify(ouv));
if (ouv.error) process.exit(1);
console.log(`   édition ${ouv.edition} — ${ouv.partants} partants`);

/** Fait courir une phase entiere via la salle en direct, avec un intrus. */
async function courirPhaseEnDirect(edition, phase, courseNum, partantsAttendus) {
  const codeSalle = codeCourseChamp(edition, phase, courseNum);
  const champ = { edition, phase, course: courseNum };
  const n = partantsAttendus.length;

  // Un cinquieme joueur, hors grille : la salle doit accepter qu'il coure,
  // mais son chrono ne doit jamais atteindre l'edition.
  const cl = [];
  for (const key of partantsAttendus) {
    const c = client(codeSalle, key, n + 1, champ);
    await c.ouvert;
    cl.push(c);
  }
  const intrus = client(codeSalle, 'intrus_hors_grille', n + 1, champ);
  await intrus.ouvert;
  await attendre(300);

  // Un mot de chat, au passage : il doit se diffuser a tout le monde.
  cl[0].envoyer({ t: 'chat', texte: 'bonne chance a tous' });
  await attendre(200);

  for (const c of [...cl, intrus]) c.envoyer({ t: 'pret', pret: true });
  await attendre(400);

  const chronos = partantsAttendus.map((_, i) => 9500 + i * 80);
  cl.forEach((c, i) => c.envoyer({ t: 'fini', ms: chronos[i] }));
  intrus.envoyer({ t: 'fini', ms: 20000 });
  await attendre(500);

  const resultatRendu = cl.every(c => !!c.resultat);
  const chatRecu = cl[1] ? cl[1].chat.some(m => m.texte === 'bonne chance a tous') : true;
  for (const c of [...cl, intrus]) c.ws.close();
  return { resultatRendu, chatRecu, chronos };
}

console.log('\n── SERIE, JOUEE EN DIRECT (avec un intrus) ──────────────────');
let etat = await get('/champ/edition/' + ouv.edition);
let partants = etat.partants.filter(p => p.phase === etat.phase && p.course === 1).map(p => p.name_key);
ok('quatre partants attendus en serie', partants.length === 4, String(partants.length));
const r1 = await courirPhaseEnDirect(ouv.edition, etat.phase, 1, partants);
ok('le resultat de la salle est rendu a tous', r1.resultatRendu);
ok('le chat s est diffuse entre les partants', r1.chatRecu);

await attendre(200);
etat = await get('/champ/edition/' + ouv.edition);
const resSeries = etat.resultats.filter(r => r.phase === 'series' && r.course === 1);
ok('la salle a bien ecrit les chronos dans l edition, sans saisie manuelle',
   resSeries.length === 4, `${resSeries.length} lignes`);
ok('les chronos correspondent a ceux envoyes en direct',
   partants.every(k => {
     const i = partants.indexOf(k);
     const ligne = resSeries.find(r => r.name_key === k);
     return ligne && ligne.ms === r1.chronos[i];
   }));
ok('l intrus n apparait nulle part dans les resultats',
   !resSeries.some(r => r.name_key === 'intrus_hors_grille'));

console.log('\n── CLOTURE DE LA SERIE ────────────────────────────────────────');
const cl1 = await post('/champ/cloturer', { edition: ouv.edition });
ok('la phase se cloture', !cl1.error, JSON.stringify(cl1));

console.log('\n── DEMIE, JOUEE EN DIRECT ─────────────────────────────────────');
etat = await get('/champ/edition/' + ouv.edition);
partants = etat.partants.filter(p => p.phase === etat.phase && p.course === 1).map(p => p.name_key);
const r2 = await courirPhaseEnDirect(ouv.edition, etat.phase, 1, partants);
ok('la demie se joue aussi en direct', r2.resultatRendu);
const cl2 = await post('/champ/cloturer', { edition: ouv.edition });
ok('la demie se cloture', !cl2.error, JSON.stringify(cl2));

console.log('\n── FINALE, JOUEE EN DIRECT ─────────────────────────────────────');
etat = await get('/champ/edition/' + ouv.edition);
partants = etat.partants.filter(p => p.phase === etat.phase && p.course === 1).map(p => p.name_key);
await courirPhaseEnDirect(ouv.edition, etat.phase, 1, partants);
const cl3 = await post('/champ/cloturer', { edition: ouv.edition });
ok('la finale sacre un champion', cl3.finale === true && !!cl3.champion, JSON.stringify(cl3).slice(0, 150));
if (cl3.champion) console.log(`   ★ champion : ${cl3.champion}`);

console.log(`\n${echecs === 0 ? 'TOUT PASSE' : 'ECHECS'} — ${echecs} echec(s)\n`);
process.exit(echecs === 0 ? 0 : 1);
