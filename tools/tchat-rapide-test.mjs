// Le tchat rapide, contre le vrai serveur.
//
// Pre-requis, comme pour les harnais du championnat : `wrangler dev --local`
// depuis worker/ (ADMIN_CLE posee), et une base de test peuplee
// (`node tools/championnat-peupler.mjs`, `--vider-editions` pour rejouer).
// BASE=http://127.0.0.1:8791 pour viser un autre port.
//
// Ce que le harnais cherche a prendre en defaut :
//   0. les trois listes — serveur, jeu, dictionnaire — disent la meme chose,
//      et la cadence tient ses deux verrous ;
//   A. dans une salle du direct : une phrase de la liste part chez tout le
//      monde, l'envoyeur compris ; du texte libre ou un identifiant inconnu
//      ne part chez personne ; trop vite, l'envoyeur est prevenu et personne
//      ne recoit rien ;
//   B. dans la salle d'une serie : le coureur parle sous son nom, un
//      spectateur sous le sien s'il peut le porter, et personne ne parle
//      sous le nom d'un partant a sa place ; la tribune pleine est plafonnee.

import fs from 'node:fs';
import { RAPIDES, DebitRapide, ECART_MS, FENETRE_MS, MAX_FENETRE } from '../worker/src/tchat-rapide.js';

const B = process.env.BASE || 'http://127.0.0.1:8791';
const WS = B.replace(/^http/, 'ws');
const CLE_ADMIN = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';
const attendre = ms => new Promise(r => setTimeout(r, ms));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || detail == null ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

async function quand(cond, max = 5000) {
  const fin = Date.now() + max;
  while (Date.now() < fin) { if (cond()) return true; await attendre(30); }
  return false;
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LE TCHAT RAPIDE                                             ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

/* ═════════════════════════════════════════════════════════════════════════
   0. LES LISTES, ET LA CADENCE
   ═════════════════════════════════════════════════════════════════════════ */
{
  console.log('── 0. les listes et la cadence ──────────────────────────────');
  const jeu = fs.readFileSync(new URL('../src/game/tchat-rapide.ts', import.meta.url), 'utf8');
  const dico = fs.readFileSync(new URL('../src/game/sprinter-i18n.js', import.meta.url), 'utf8');
  const familles = jeu.slice(jeu.indexOf('export const FAMILLES'), jeu.indexOf('export const EMOJIS'));
  const emojis = jeu.slice(jeu.indexOf('export const EMOJIS'), jeu.indexOf('export const RAPIDES'));
  const idsJeu = [...familles.matchAll(/'([pea]_[a-z]+)'/g), ...emojis.matchAll(/(x_[a-z]+):/g)]
    .map(m => m[1]);
  const serveur = [...RAPIDES];
  ok('le jeu et le serveur ont la meme liste',
     idsJeu.length === serveur.length && idsJeu.every(q => RAPIDES.has(q)),
     `jeu ${idsJeu.length}, serveur ${serveur.length}`);
  const sansTexte = serveur.filter(q => !q.startsWith('x_'))
    .filter(q => !new RegExp(`rapide_${q}:\\s*\\['[^']+',\\s*'[^']+'\\]`).test(dico));
  ok('chaque phrase a son texte en francais et en anglais', sansTexte.length === 0, sansTexte.join(', '));

  const d = new DebitRapide();
  const t0 = 1_000_000;
  ok('un premier envoi passe', d.juger('a', t0) === null);
  ok('un second tout de suite est refuse', d.juger('a', t0 + 100) === 'debit');
  ok('apres l\'ecart, il passe', d.juger('a', t0 + ECART_MS) === null);
  let n = 2, t = t0 + ECART_MS;
  while (d.juger('a', t += ECART_MS) === null) n++;
  ok(`${MAX_FENETRE} au plus sur ${FENETRE_MS / 1000} s`, n === MAX_FENETRE, `n=${n}`);
  const s = new DebitRapide();
  let passe = 0;
  for (let i = 0; i < 20; i++) if (s.juger('j' + i, t0 + i) === null) passe++;
  ok('la salle entiere est plafonnee a 12 sur 5 s', passe === 12, `passe=${passe}`);
  ok('le plafond de la salle se dit « salle »', s.juger('autre', t0 + 50) === 'salle');
  ok('et se leve 5 s plus tard', s.juger('autre', t0 + 5100) === null);
}

/* ─────────────────────────────────────────────────── l'acces et les clients */
const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': CLE_ADMIN };
const acces = await fetch(B + '/test/admin/creer', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ nom: 'harnais-tchat-rapide' }) }).then(r => r.json());
if (!acces.code) { console.log('pas d acces de test :', acces); process.exit(1); }
const H = { ...ADMIN, 'X-Sprinter-Test': acces.code };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b || {}) })
  .then(r => r.json());
const get = u => fetch(B + u, { headers: H }).then(r => r.json());

function client(chemin, params) {
  const c = { moi: null, role: null, rapides: [], refus: [], fermee: false };
  const q = new URLSearchParams({ ...params, acces: acces.code });
  c.ws = new WebSocket(`${WS}${chemin}?${q}`);
  c.ouvert = new Promise((res, rej) => {
    c.ws.addEventListener('open', res);
    c.ws.addEventListener('error', rej);
  });
  c.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'bienvenue') { c.moi = m.moi; c.role = m.role || null; }
    if (m.t === 'rapide') c.rapides.push(m);
    if (m.t === 'rapide_refus') c.refus.push(m);
  });
  c.ws.addEventListener('close', () => { c.fermee = true; });
  c.envoyer = o => { try { c.ws.send(JSON.stringify(o)); } catch { /* fermee */ } };
  return c;
}

/* ═════════════════════════════════════════════════════════════════════════
   A. UNE SALLE DU DIRECT
   ═════════════════════════════════════════════════════════════════════════ */
{
  console.log('\n── A. une salle du direct ───────────────────────────────────');
  const salle = await post('/live/nouveau');
  ok('une salle s\'ouvre', !!salle.id, JSON.stringify(salle));
  const chemin = `/live/${salle.id}`;
  const alice = client(chemin, { name: 'Alice', races: '100', level: '4', max: '2' });
  await alice.ouvert;
  const bob = client(chemin, { name: 'Bob', races: '100', level: '4', max: '2' });
  await bob.ouvert;
  await quand(() => alice.moi && bob.moi);

  alice.envoyer({ t: 'rapide', q: 'e_revanche' });
  ok('la phrase arrive chez l\'autre', await quand(() => bob.rapides.length === 1));
  ok('et chez l\'envoyeur', await quand(() => alice.rapides.length === 1));
  const m = bob.rapides[0] || {};
  ok('elle porte l\'identifiant, le nom et l\'envoyeur',
     m.q === 'e_revanche' && m.nom === 'Alice' && m.id === alice.moi, JSON.stringify(m));
  ok('et rien d\'autre', Object.keys(m).sort().join() === 'id,nom,q,t', Object.keys(m).join());

  alice.envoyer({ t: 'rapide', q: 'x_feu' });
  ok('trop vite : l\'envoyeur est prevenu', await quand(() => alice.refus.length === 1));
  await attendre(300);
  ok('et personne ne recoit rien', bob.rapides.length === 1, `bob=${bob.rapides.length}`);

  await attendre(ECART_MS);
  bob.envoyer({ t: 'rapide', q: 'Tu es nul' });
  bob.envoyer({ t: 'rapide', q: 'rapide_e_bien' });
  bob.envoyer({ t: 'rapide', q: { toString: 'x' } });
  bob.envoyer({ t: 'rapide', texte: 'coucou' });
  await attendre(400);
  ok('du texte libre, un identifiant inconnu : rien ne part',
     alice.rapides.length === 1 && bob.rapides.length === 1);
  ok('et ne coute pas la cadence', bob.refus.length === 0);
  bob.envoyer({ t: 'rapide', q: 'a_photo' });
  ok('une phrase de la liste passe ensuite', await quand(() => alice.rapides.length === 2
     && alice.rapides[1].q === 'a_photo' && alice.rapides[1].nom === 'Bob'));

  alice.ws.close(); bob.ws.close();
}

/* ═════════════════════════════════════════════════════════════════════════
   B. LA SALLE D'UNE SERIE
   ═════════════════════════════════════════════════════════════════════════ */
{
  console.log('\n── B. la salle d\'une serie de championnat ──────────────────');
  const samedi = Date.UTC(2026, 8, 5);
  const ouv = await post('/champ/ouvrir', { pays: 'FR', debut: samedi });
  if (ouv.error) {
    console.log('  ', ouv);
    console.log('   → base vide ou edition deja ouverte : node tools/championnat-peupler.mjs --vider-editions');
    process.exit(1);
  }
  const ed = await get('/champ/edition/' + ouv.edition);
  const grille = ed.partants.filter(p => p.phase === ed.phase && p.course === 1)
    .sort((x, y) => (x.rang_duel || 99) - (y.rang_duel || 99));
  const chemin = `/champ/salle/${ed.id}/${ed.phase}/1`;
  const suffixe = Date.now().toString(36);

  const coureur = client(chemin, { name: grille[0].nom, device: 'rapide-c-' + suffixe });
  await coureur.ouvert;
  const badaud = client(chemin, { name: 'Badaud', device: 'rapide-b-' + suffixe });
  await badaud.ouvert;
  const imposteur = client(chemin, { name: grille[0].nom, device: 'rapide-i-' + suffixe });
  await imposteur.ouvert;
  const anonyme = client(chemin, { name: '', device: 'rapide-a-' + suffixe });
  await anonyme.ouvert;
  await quand(() => coureur.role && badaud.role && imposteur.role && anonyme.role);
  ok('le partant court, les trois autres regardent',
     coureur.role === 'coureur' && [badaud, imposteur, anonyme].every(c => c.role === 'spectateur'),
     [coureur, badaud, imposteur, anonyme].map(c => c.role).join(','));

  coureur.envoyer({ t: 'rapide', q: 'a_go' });
  badaud.envoyer({ t: 'rapide', q: 'e_envoie' });
  imposteur.envoyer({ t: 'rapide', q: 'p_blocs' });
  anonyme.envoyer({ t: 'rapide', q: 'x_bravo' });
  ok('les quatre bulles arrivent partout', await quand(() =>
     [coureur, badaud, imposteur, anonyme].every(c => c.rapides.length === 4)));
  const par = q => (badaud.rapides.find(m => m.q === q) || {}).nom;
  ok('le coureur parle sous son nom', par('a_go') === grille[0].nom, par('a_go'));
  ok('le spectateur sous le sien', par('e_envoie') === 'Badaud', par('e_envoie'));
  ok('personne ne parle sous le nom d\'un partant a sa place', par('p_blocs') === null,
     String(par('p_blocs')));
  ok('un anonyme parle en tribune', par('x_bravo') === null, String(par('x_bravo')));

  // Une tribune pleine : vingt spectateurs envoient ensemble, douze passent.
  await attendre(5200);
  const foule = [];
  for (let i = 0; i < 20; i++) {
    const c = client(chemin, { name: 'Foule' + i, device: `rapide-f${i}-${suffixe}` });
    foule.push(c);
  }
  await Promise.all(foule.map(c => c.ouvert));
  await quand(() => foule.every(c => c.role));
  const avant = coureur.rapides.length;
  for (const c of foule) c.envoyer({ t: 'rapide', q: 'x_feu' });
  await attendre(800);
  ok('une tribune pleine est plafonnee a 12 bulles', coureur.rapides.length - avant === 12,
     `recues=${coureur.rapides.length - avant}`);
  ok('et le trop-plein ne previent personne', foule.every(c => c.refus.length === 0));

  for (const c of [coureur, badaud, imposteur, anonyme, ...foule]) c.ws.close();
}

console.log(echecs ? `\n   ${echecs} ECHEC(S)\n` : '\n   tout passe\n');
process.exit(echecs ? 1 : 0);
