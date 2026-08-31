// Le chat d'une salle en direct, contre le vrai serveur.
//
// Trois proprietes, et aucune ne se voit a l'usage normal — elles ne se
// manifestent que le jour ou quelqu'un s'en sert de travers :
//
//   1. on ne peut pas noyer l'ecran des autres. Cinq messages par dix secondes,
//      et le surplus tombe en silence plutot qu'en erreur ;
//   2. un message ne peut pas s'etendre indefiniment. Deux cents caracteres,
//      coupes par le serveur et pas seulement par le champ de saisie ;
//   3. ce qui n'est pas du texte n'entre pas. Un caractere de controle ne se
//      voit pas et fait n'importe quoi une fois rendu.
//
// Les trois sont verifiees cote serveur, la ou elles comptent : le client peut
// etre contourne, la salle non.

const B = 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const attendre = ms => new Promise(r => setTimeout(r, ms));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

function client(code, nom, places) {
  const c = { nom, moi: null, recus: [] };
  const q = `name=${encodeURIComponent(nom)}&races=100&level=4&max=${places}`;
  c.ws = new WebSocket(`${WS}/live/${code}?${q}`);
  c.ouvert = new Promise(res => c.ws.addEventListener('open', res));
  c.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'bienvenue') c.moi = m.moi;
    if (m.t === 'chat') c.recus.push(m);
  });
  c.dire = texte => c.ws.send(JSON.stringify({ t: 'chat', texte }));
  return c;
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LE CHAT DE LA SALLE                                         ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const code = (await (await fetch(B + '/live/nouveau', { method: 'POST' })).json()).id;
const marque = Math.random().toString(36).slice(2, 6).toUpperCase();
console.log(`── LA SALLE ${code} ────────────────────────────────────────\n`);

const a = client(code, 'Ada' + marque, 2);
await a.ouvert;
const b = client(code, 'Bob' + marque, 2);
await b.ouvert;
await attendre(300);

// ------------------------------------------------------------- diffusion
console.log('── LA DIFFUSION ─────────────────────────────────────────────');
a.dire('bonne chance');
await attendre(250);
ok('l autre recoit le message', b.recus.some(m => m.texte === 'bonne chance'),
   JSON.stringify(b.recus.map(m => m.texte)));
ok('celui qui parle se recoit aussi', a.recus.some(m => m.texte === 'bonne chance'));
ok('le message porte le nom de son auteur',
   b.recus[0] && b.recus[0].nom === a.nom, b.recus[0] && b.recus[0].nom);

// ------------------------------------------------------------ troncature
console.log('\n── LA TRONCATURE ────────────────────────────────────────────');
b.recus.length = 0;
a.dire('x'.repeat(320));
await attendre(250);
const long = b.recus.find(m => m.texte.startsWith('x'));
ok('un message trop long est coupe a 200 caracteres',
   !!long && long.texte.length === 200, long ? long.texte.length + ' caracteres' : 'rien recu');

// ------------------------------------------ nettoyage des caracteres de controle
console.log('\n── LES CARACTERES DE CONTROLE ───────────────────────────────');
b.recus.length = 0;
a.dire('avant\u0007 milieu\napres\u001b[31m');
await attendre(250);
const propre = b.recus.find(m => m.texte.includes('avant'));
ok('le message passe malgre les caracteres de controle', !!propre,
   JSON.stringify(b.recus.map(m => m.texte)));
if (propre) {
  console.log(`     recu : « ${propre.texte} »`);
  ok('plus aucun caractere de controle',
     !/[\u0000-\u001F\u007F-\u009F]/.test(propre.texte), JSON.stringify(propre.texte));
  ok('le texte lisible est conserve',
     propre.texte.includes('avant') && propre.texte.includes('milieu') &&
     propre.texte.includes('apres'), propre.texte);
}

// ---------------------------------------------------------- message vide
console.log('\n── LE VIDE ──────────────────────────────────────────────────');
b.recus.length = 0;
a.dire('   ');
// Rien que des caracteres de controle : une fois nettoyes, il ne reste rien.
a.dire('\u0000\u0007');
await attendre(250);
ok('un message vide n est pas diffuse', b.recus.length === 0,
   JSON.stringify(b.recus.map(m => m.texte)));

// ------------------------------------------------------------ rate-limit
//
// Un joueur neuf, pour que le compteur parte de zero : les messages ci-dessus
// ont deja consomme la fenetre d'Ada.
console.log('\n── CINQ MESSAGES PAR DIX SECONDES ───────────────────────────');
// La salle d'Ada est pleine a deux : on en ouvre une autre plutot que de
// forcer l'entree d'un troisieme, ce que le serveur refuse a raison.
const code2 = (await (await fetch(B + '/live/nouveau', { method: 'POST' })).json()).id;
const d1 = client(code2, 'Dia' + marque, 2);
await d1.ouvert;
const d2 = client(code2, 'Eve' + marque, 2);
await d2.ouvert;
await attendre(250);

for (let i = 1; i <= 8; i++) d1.dire('message ' + i);
await attendre(500);
const passes = d2.recus.filter(m => m.texte.startsWith('message ')).length;
console.log(`   ${passes} messages sur 8 diffuses`);
ok('cinq messages passent, les trois suivants tombent', passes === 5, passes + ' passes');
ok('ce sont les cinq premiers qui passent',
   d2.recus.filter(m => m.texte.startsWith('message '))
     .map(m => m.texte).join('|') === 'message 1|message 2|message 3|message 4|message 5',
   d2.recus.map(m => m.texte).join('|'));

// L'autre joueur de la meme salle n'est pas bride par le compteur du premier :
// c'est un compteur par personne, sans quoi un bavard ferait taire les autres.
d2.recus.length = 0;
d1.recus.length = 0;
d2.dire('et moi je parle encore');
await attendre(250);
ok('le compteur est propre a chaque joueur',
   d1.recus.some(m => m.texte === 'et moi je parle encore'));

for (const x of [a, b, d1, d2]) { try { x.ws.close(); } catch { /* deja fermee */ } }

console.log('\n' + '─'.repeat(62));
console.log(echecs === 0 ? '   TOUT PASSE.' : `   ${echecs} VERIFICATION(S) EN ECHEC.`);
console.log('');
process.exit(echecs ? 1 : 0);
