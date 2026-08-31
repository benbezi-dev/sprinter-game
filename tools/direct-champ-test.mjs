// Une serie de championnat courue en direct, contre le vrai serveur.
//
// C'est le branchement qui manquait : la salle du direct savait faire courir
// huit personnes ensemble, le championnat savait ranger des chronos, et rien
// ne reliait les deux — il fallait ressaisir a la main un resultat que la
// salle venait d'arbitrer.
//
// Ce harnais verifie le fil entier, du code de salon au tableau du
// championnat :
//
//   1. le code de la salle se CALCULE des deux cotes. Huit joueurs doivent
//      tomber sur la meme piste sans se donner rendez-vous ;
//   2. le resultat s'ecrit tout seul. Aucun appel a /champ/course dans ce
//      fichier — si le chrono est en base, c'est la salle qui l'y a mis ;
//   3. un intrus ne rentre pas dans le tableau. Quelqu'un qui se connecte avec
//      un nom hors grille court peut-etre, mais ne marque rien.

import { semerPays, nomsDe } from './graine-championnats.mjs';

const B = 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': 'cle-de-test-locale-uniquement' };
const attendre = ms => new Promise(r => setTimeout(r, ms));

const _acces = await fetch(B + '/test/admin/creer', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ nom: 'harnais-direct-champ' }) }).then(r => r.json());
await fetch(B + '/test/admin/role', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ code: _acces.code, role: 'organisateur' }) });
const CODE_ACCES = _acces.code;
const H = { 'X-Sprinter-Test': CODE_ACCES };

const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...H },
  body: JSON.stringify(b) }).then(r => r.json().catch(() => ({})));
const get = u => fetch(B + u, { headers: H }).then(r => r.json().catch(() => ({})));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

/**
 * Le code de salon d'une course de championnat.
 *
 * Recopie du serveur (worker/src/championnats.js) et du jeu
 * (src/game/championnats.ts) : c'est justement ce que ce harnais verifie —
 * les trois doivent dire la meme chose, sinon les joueurs se retrouvent sur
 * trois pistes differentes et s'attendent chacun de leur cote.
 */
function codeCourseChamp(edition, phase, course) {
  const lettre = String(phase || 'X').slice(0, 1).toUpperCase();
  const n = Math.max(1, Math.min(9, parseInt(course, 10) || 1));
  return (lettre + n + String(edition || '')).toUpperCase()
    .replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

function client(code, nom, places, champ) {
  const c = { nom, moi: null, joueurs: [], depart: null, resultat: null };
  const q = new URLSearchParams({
    name: nom, races: '100', level: '4', max: String(places), acces: CODE_ACCES,
  });
  if (champ) {
    q.set('champ_edition', champ.edition);
    q.set('champ_phase', champ.phase);
    q.set('champ_course', String(champ.course));
  }
  c.ws = new WebSocket(`${WS}/live/${code}?${q}`);
  c.ouvert = new Promise((res, rej) => {
    c.ws.addEventListener('open', res);
    c.ws.addEventListener('error', rej);
  });
  c.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'bienvenue') c.moi = m.moi;
    if (m.joueurs) c.joueurs = m.joueurs;
    if (m.depart_a) c.depart = m.depart_a;
    if (m.t === 'resultat') c.resultat = m;
  });
  c.envoyer = o => c.ws.send(JSON.stringify(o));
  return c;
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  UNE SERIE DE CHAMPIONNAT, COURUE EN DIRECT                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// Un pays fictif, sans edition anterieure : son championnat s'ouvre en format
// reduit, ce qui donne des series de taille humaine a faire courir ici.
const PAYS = 'LU';
const marque = Math.random().toString(36).slice(2, 5).toUpperCase();
const noms = nomsDe('Lux' + marque, 6);

console.log('\n── ON SEME ET ON OUVRE ──────────────────────────────────────');
await semerPays(B, H, PAYS, noms);
const ouv = await post('/champ/ouvrir', { pays: PAYS, debut: Date.UTC(2026, 8, 5) });
if (ouv.error) {
  console.log('   ✗ ouverture impossible :', JSON.stringify(ouv).slice(0, 160));
  console.log('     (ce pays a-t-il deja tenu un championnat sur cette base ?)');
  process.exit(1);
}
console.log(`   edition ${ouv.edition} — ${ouv.partants} partants, ` +
            `${ouv.format.phases[0].courses} serie(s)`);

const etat0 = await get('/champ/edition/' + ouv.edition);
const course1 = etat0.partants.filter(p => p.phase === etat0.phase && p.course === 1);
console.log('   serie 1 : ' + course1.map(p => p.nom).join(', '));

const code = codeCourseChamp(ouv.edition, etat0.phase, 1);
console.log(`   code de salon calcule : ${code}`);
ok('le code de salon a la forme qu accepte /live/', /^[A-Z0-9]{4,10}$/.test(code), code);

// Le serveur calcule le meme code, sans que personne ne le lui demande : on le
// verifie en interrogeant la salle sous ce code apres coup (voir plus bas).

console.log('\n── LES COUREURS ENTRENT ─────────────────────────────────────');
// Un couloir de plus que la grille : c'est l'intrus, quelqu'un qui connait le
// code et n'est pas dans cette course. Il doit pouvoir courir sans marquer.
const INTRUS = 'Intrus' + marque;
const places = course1.length + 1;
const clients = [];
for (const p of course1) {
  const c = client(code, p.nom, places, { edition: ouv.edition, phase: etat0.phase, course: 1 });
  await c.ouvert;
  clients.push(c);
  await attendre(60);
}
const intrus = client(code, INTRUS, places, { edition: ouv.edition, phase: etat0.phase, course: 1 });
await intrus.ouvert;
clients.push(intrus);
await attendre(400);

ok('tout le monde est sur la piste',
   clients.every(c => c.joueurs.length === places),
   clients.map(c => c.joueurs.length).join(','));

console.log('\n── LA COURSE ────────────────────────────────────────────────');
for (const c of clients) c.envoyer({ t: 'pret', pret: true });
await attendre(500);
ok('la salle annonce un depart', clients.every(c => c.depart), 'aucune date de depart');

// On ne joue pas la presentation : ce qui nous interesse est le chemin du
// resultat, pas la mise en scene. Les chronos partent directement.
const chronos = {};
clients.forEach((c, i) => { chronos[c.nom] = 9500 + i * 55; });
for (const c of clients) c.envoyer({ t: 'fini', ms: chronos[c.nom] });
await attendre(900);

ok('la salle rend un classement', clients.every(c => !!c.resultat),
   clients.filter(c => !c.resultat).length + ' clients sans resultat');
if (clients[0].resultat) {
  clients[0].resultat.classement.forEach(r =>
    console.log(`     ${r.place}. ${r.nom.padEnd(12)} ${(r.ms / 1000).toFixed(3)} s`));
}

console.log('\n── LE CHAMPIONNAT A TOUT ENREGISTRE, SEUL ───────────────────');
// L'ecriture part en waitUntil : on laisse a la salle le temps de la finir.
let etat = null;
for (let essai = 0; essai < 12; essai++) {
  await attendre(300);
  etat = await get('/champ/edition/' + ouv.edition);
  const n = (etat.resultats || []).filter(r => r.phase === etat0.phase && r.course === 1).length;
  if (n >= course1.length) break;
}
const ecrits = (etat.resultats || []).filter(r => r.phase === etat0.phase && r.course === 1);
console.log(`   ${ecrits.length} chronos en base pour ${course1.length} partants`);
ok('les chronos de la serie sont en base sans passer par /champ/course',
   ecrits.length === course1.length, ecrits.length + ' ecrits');

const parCle = new Map(ecrits.map(r => [r.name_key, r.ms]));
ok('chaque chrono est bien celui annonce par son coureur',
   course1.every(p => parCle.get(p.name_key) === chronos[p.nom]),
   course1.map(p => `${p.nom}:${parCle.get(p.name_key)}≠${chronos[p.nom]}`).join(' '));

ok('l intrus n apparait pas dans les resultats',
   !ecrits.some(r => r.name_key === INTRUS.toLowerCase()),
   JSON.stringify(ecrits.map(r => r.name_key)));
ok('l intrus n est pas entre dans la grille',
   !(etat.partants || []).some(p => p.name_key === INTRUS.toLowerCase()));

// La preuve que le code de salon est bien celui que les DEUX cotes calculent :
// la salle interrogee sous ce code est celle ou la course vient d'avoir lieu.
const vue = await get(`/live/${code}/etat`);
ok('la salle existe bien sous le code calcule', vue && vue.existe === true,
   JSON.stringify(vue).slice(0, 90));

console.log('\n── ET LA PHASE PEUT SE CLORE ────────────────────────────────');
// Les autres series n'ont pas eu lieu : la cloture doit le dire, et le dire
// precisement — c'est ce qui empeche de sacrer un champion sur une phase
// incomplete.
const cl = await post('/champ/cloturer', { edition: ouv.edition });
const restantes = ouv.format.phases[0].courses - 1;
if (restantes > 0) {
  ok('une phase incomplete refuse de se clore',
     cl.error === 'toutes les courses n ont pas eu lieu', JSON.stringify(cl).slice(0, 120));
  ok('elle dit lesquelles manquent',
     Array.isArray(cl.manquantes) && cl.manquantes.length === restantes,
     JSON.stringify(cl.manquantes));
} else {
  ok('la phase se clot', !cl.error, JSON.stringify(cl).slice(0, 120));
}

for (const c of clients) { try { c.ws.close(); } catch { /* deja fermee */ } }

console.log('\n' + '─'.repeat(62));
console.log(echecs === 0 ? '   TOUT PASSE.' : `   ${echecs} VERIFICATION(S) EN ECHEC.`);
console.log('');
process.exit(echecs ? 1 : 0);
