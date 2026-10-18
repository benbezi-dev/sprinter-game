// Le tchat du duel des marques (worker/src/tchat-marques.js), sur une base
// SQLite en memoire : poster, designer, ecrire en prive, lire, bloquer,
// signaler, retirer, inviter, aimer, marquer lu, et les cadences.
//
//   node tools/tchat-marques-test.mjs
import { DatabaseSync } from 'node:sqlite';
import {
  poster, lire, participants, invitables, inviter, mesInvitations, signalerMessage,
  reserverSonnerie, ECART_MS, PAR_MINUTE, INVITS_PAR_JOUR, SONNERIE_TCHAT_MS,
  posterOfficiel, imiteOfficiel, aimer, marquerLu,
} from '../worker/src/tchat-marques.js';
import { choisirCamp } from '../worker/src/marques.js';
import { bloquer, trancher, listeSignalements } from '../worker/src/moderation.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || d === undefined ? '' : ' — ' + JSON.stringify(d)}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const base = new DatabaseSync(':memory:');
const db = {
  prepare(sql) {
    const faire = (args) => ({
      all: async () => ({ results: base.prepare(sql).all(...args) }),
      first: async () => base.prepare(sql).get(...args) ?? null,
      run: async () => { const r = base.prepare(sql).run(...args); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; },
    });
    return { bind: (...args) => faire(args), ...faire([]) };
  },
  async batch(liste) { for (const x of liste) await x.run(); return []; },
};
base.exec(`CREATE TABLE players (name_key TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, created_at INTEGER)`);
base.exec(`INSERT INTO players VALUES ('alice','Alice','x',0),('bob','Bob','x',0),('carla','Carla','x',0)`);

let t = Date.UTC(2026, 9, 13, 12);
const pas = (ms = ECART_MS + 1) => (t += ms);

titre('inscription');
for (const [k, c] of [['alice', 'adidas'], ['bob', 'nike'], ['carla', 'nike']]) {
  await choisirCamp(db, { nameKey: k, name: k, deviceId: 'd-' + k, camp: c, epreuve: '100', maintenant: t });
}
const p = await participants(db);
ok('trois inscrits, nom reserve affiche', p.length === 3 && p[0].name === 'Alice', p);

titre('poster');
let r = await poster(db, { auteurKey: 'zoe', auteurName: 'Zoe', texte: 'salut', maintenant: pas() });
ok('hors du duel : refuse', r.status === 409);
r = await poster(db, { auteurKey: 'alice', auteurName: 'Alice', texte: 'Allez adidas !', maintenant: pas() });
ok('commun sans designation : accepte, ne sonne personne', r.status === 200 && r.sonner === null, r);
r = await poster(db, { auteurKey: 'alice', auteurName: 'Alice', texte: 'mon snap : alice_06', maintenant: pas() });
ok('contact refuse par le filtre', r.status === 422 && r.corps.raison === 'contact', r.corps);
r = await poster(db, { auteurKey: 'alice', auteurName: 'Alice', texte: 'va voir www.site.com', maintenant: pas() });
ok('lien refuse', r.status === 422 && r.corps.raison === 'lien', r.corps);
r = await poster(db, { auteurKey: 'alice', auteurName: 'Alice', texte: 'Bob t es un connard', maintenant: pas() });
ok('insulte refusee', r.status === 422 && r.corps.raison === 'grossier', r.corps);
r = await poster(db, { auteurKey: 'alice', auteurName: 'Alice', texte: 'x'.repeat(141), maintenant: pas() });
ok('141 caracteres refuses', r.status === 422 && r.corps.raison === 'long');

r = await poster(db, { auteurKey: 'alice', auteurName: 'Alice', texte: 'Bob, je te prends au 100', pour: 'Bob', maintenant: pas() });
ok('designation : sonne Bob', r.status === 200 && r.sonner === 'bob' && r.corps.message.pour === 'Bob', r);
r = await poster(db, { auteurKey: 'alice', auteurName: 'Alice', texte: 'tu dors ?', pour: 'bob', maintenant: pas() });
ok('seconde designation dans la minute : pas de seconde sonnerie', r.status === 200 && r.sonner === null, r);
r = await poster(db, { auteurKey: 'alice', auteurName: 'Alice', texte: 'hello', pour: 'zoe', maintenant: pas() });
ok('designer quelqu un hors du duel : refuse', r.status === 404);
r = await poster(db, { auteurKey: 'carla', auteurName: 'Carla', texte: 'entre nous : on gagne', pour: 'bob', prive: true, maintenant: pas(SONNERIE_TCHAT_MS + 1) });
ok('prive Carla → Bob : sonne Bob (minute passee)', r.status === 200 && r.sonner === 'bob' && r.corps.message.prive, r);
r = await poster(db, { auteurKey: 'carla', auteurName: 'Carla', texte: 'oups', prive: true, maintenant: pas() });
ok('prive sans destinataire : refuse', r.status === 400);

titre('lire');
const lu = (k) => lire(db, { cleLecteur: k });
let a = await lu('alice'), b = await lu('bob');
ok('Alice ne voit pas le prive Carla → Bob', !a.messages.some(m => m.prive), a.messages.map(m => m.texte));
ok('Bob voit le prive, marque pour_moi', b.messages.some(m => m.prive && m.pour_moi && m.de === 'Carla'));
ok('Bob voit la designation, pour_moi', b.messages.some(m => !m.prive && m.pour_moi && m.texte.startsWith('Bob,')));
const suite = await lire(db, { cleLecteur: 'bob', depuis: b.dernier });
ok('depuis le dernier : rien de neuf', suite.messages.length === 0 && suite.dernier === b.dernier);

titre('bloquer');
await bloquer(db, 'bob', 'alice');
b = await lu('bob');
ok('Bob ne voit plus Alice', !b.messages.some(m => m.de === 'Alice'));
r = await poster(db, { auteurKey: 'alice', auteurName: 'Alice', texte: 'coucou', pour: 'bob', prive: true, maintenant: pas(SONNERIE_TCHAT_MS + 1) });
ok('prive vers qui vous a bloque : garde, mais ne sonne pas', r.status === 200 && r.sonner === null);

titre('signaler, trancher');
const cible = (await lu('carla')).messages.find(m => m.de === 'Alice' && !m.prive);
const prive = (await lu('bob')).messages.find(m => m.prive);
r = await signalerMessage(db, { id: prive.id, cleLecteur: 'alice', motif: 'insulte' });
ok('signaler un prive qui ne vous est pas adresse : refuse', r.status === 403);
r = await signalerMessage(db, { id: cible.id, cleLecteur: 'carla', motif: 'insulte' });
ok('Carla signale un message commun', r.status === 200);
const f = await listeSignalements(db);
ok('la file porte la copie du texte', f.length === 1 && f[0].mot === cible.texte && f[0].duel === 'tchat-marques:' + cible.id, f);
const v = await trancher(db, { id: f[0].id, verdict: 'retire' });
ok('trancher : retire', v.ok);
ok('le message a disparu du tchat', !(await lu('carla')).messages.some(m => m.id === cible.id));

titre('cadences');
r = await poster(db, { auteurKey: 'carla', auteurName: 'Carla', texte: 'un', maintenant: pas(60_000) });
r = await poster(db, { auteurKey: 'carla', auteurName: 'Carla', texte: 'deux', maintenant: pas(500) });
ok('moins de deux secondes : refuse', r.status === 429);
let refus = 0;
for (let i = 0; i < PAR_MINUTE + 2; i++) {
  const x = await poster(db, { auteurKey: 'carla', auteurName: 'Carla', texte: 'msg ' + i, maintenant: pas() });
  if (x.status === 429) refus++;
}
ok(`au plus ${PAR_MINUTE} par minute`, refus >= 2, refus);
ok('sonnerie : reservee une fois par minute',
  await reserverSonnerie(db, 'zz', 'marques_tchat', t) && !(await reserverSonnerie(db, 'zz', 'marques_tchat', t + 1000))
  && await reserverSonnerie(db, 'zz', 'marques_tchat', t + SONNERIE_TCHAT_MS));

titre('inviter le top 500');
const top = ['Alice', 'Bob', 'Dan', 'dan', 'Eve', 'anonyme'];
const topCles = new Set(top.map(n => n.toLowerCase()));
const inv = await invitables(db, { deKey: 'alice', top });
ok('invitables : sans les inscrits, sans doublon, sans anonyme', JSON.stringify(inv.map(x => x.name)) === '["Dan","Eve"]', inv);
r = await inviter(db, { deKey: 'alice', deName: 'Alice', cible: 'Dan', topCles, maintenant: pas() });
ok('Alice invite Dan : sonne Dan', r.status === 200 && r.sonner === 'dan', r);
r = await inviter(db, { deKey: 'alice', deName: 'Alice', cible: 'dan', topCles, maintenant: pas() });
ok('la meme invitation deux fois : deja, sans sonnerie', r.corps.deja && r.sonner === null);
r = await inviter(db, { deKey: 'bob', deName: 'Bob', cible: 'dan', topCles, maintenant: pas() });
ok('Bob invite Dan juste apres : gardee, sonnerie retenue (6 h)', r.status === 200 && !r.corps.deja && r.sonner === null, r);
r = await inviter(db, { deKey: 'alice', deName: 'Alice', cible: 'Zed', topCles, maintenant: pas() });
ok('hors du top 500 : refuse', r.status === 404);
r = await inviter(db, { deKey: 'alice', deName: 'Alice', cible: 'Bob', topCles, maintenant: pas() });
ok('deja dans le duel : refuse', r.status === 409);
r = await inviter(db, { deKey: 'zoe', deName: 'Zoe', cible: 'Dan', topCles, maintenant: pas() });
ok('il faut etre inscrit pour inviter', r.status === 409);
ok('Dan voit ses deux invitations', (await mesInvitations(db, { cleLecteur: 'dan' })).length === 2);
ok('marquee invitee dans la liste d Alice', (await invitables(db, { deKey: 'alice', top })).find(x => x.name === 'Dan').invite);
const grand = new Set(Array.from({ length: 40 }, (_, i) => 'j' + i));
let n = 0;
for (let i = 0; i < 20; i++) {
  const x = await inviter(db, { deKey: 'carla', deName: 'Carla', cible: 'j' + i, topCles: grand, maintenant: pas() });
  if (x.status === 200) n++;
}
ok(`au plus ${INVITS_PAR_JOUR} invitations par jour`, n === INVITS_PAR_JOUR, n);

titre('le compte SprinterGame');
r = await posterOfficiel(db, { texte: '  Derniere ligne droite :   le duel ferme samedi 21h30 !  ', maintenant: pas() });
ok('poste sans camp ni inscription', r.status === 200 && r.corps.message.officiel === true && r.corps.message.camp === 'sprinter', r.corps);
ok('texte nettoye', r.corps.message.texte === 'Derniere ligne droite : le duel ferme samedi 21h30 !', r.corps.message.texte);
r = await posterOfficiel(db, { texte: 'Tout sur sprinter-game.com', maintenant: pas(1) });
ok('pas de filtre ni de cadence : un lien, une seconde apres', r.status === 200, r.corps);
ok('vide refuse', (await posterOfficiel(db, { texte: '   ' })).status === 422);
ok('sans limite de longueur (17/10)', (await posterOfficiel(db, { texte: 'x'.repeat(141) })).status === 200);
a = await lu('alice'); b = await lu('bob');
const off = m => m.officiel && m.de === 'SprinterGame' && m.camp === 'sprinter' && !m.a_moi && !m.prive;
ok('Alice (adidas) et Bob (nike) le lisent, marque officiel', a.messages.filter(off).length === 3 && b.messages.filter(off).length === 3);
ok('les messages des joueurs ne sont pas officiels', a.messages.filter(m => m.de !== 'SprinterGame').every(m => m.officiel === false));
for (const x of ['SprinterGame', 'Sprinter Game', 'sprinter_game', 'SPRINTER-GAME']) ok(`« ${x} » imite le compte`, imiteOfficiel(x));
for (const x of ['Sprinter', 'SprinterGame2', 'Alice']) ok(`« ${x} » ne l imite pas`, !imiteOfficiel(x));
await choisirCamp(db, { nameKey: 'sprinter game', name: 'Sprinter Game', deviceId: 'd-imite', camp: 'nike', epreuve: '100', maintenant: t });
r = await poster(db, { auteurKey: 'sprinter game', auteurName: 'Sprinter Game', texte: 'Nike a gagne', maintenant: pas() });
ok('un joueur inscrit sous « Sprinter Game » ne peut pas ecrire', r.status === 403 && r.corps.error === 'nom du jeu', r);

titre('apres le duel : le tchat du jeu');
// Dan a un nom reserve mais n'a jamais choisi de camp.
base.exec(`INSERT INTO players VALUES ('dan','Dan','x',0)`);
r = await poster(db, { auteurKey: 'dan', auteurName: 'Dan', texte: 'je suis la', maintenant: pas() });
ok('pendant le duel : sans camp, refuse', r.status === 409);
r = await poster(db, { auteurKey: 'dan', auteurName: 'Dan', texte: 'je suis la', duelOuvert: false, maintenant: pas() });
ok('apres : sans camp, accepte, camp « joueur »', r.status === 200 && r.corps.message.camp === 'joueur', r.corps);
r = await poster(db, { auteurKey: 'dan', auteurName: 'Dan', texte: 'texte avec www.site.com', duelOuvert: false, maintenant: pas() });
ok('apres : le filtre tient toujours', r.status === 422 && r.corps.raison === 'lien');
r = await poster(db, { auteurKey: 'alice', auteurName: 'Alice', texte: 'Dan, bienvenue', pour: 'dan', duelOuvert: false, maintenant: pas(SONNERIE_TCHAT_MS + 1) });
ok('apres : designer un nom reserve hors duel, sonne', r.status === 200 && r.sonner === 'dan' && r.corps.message.camp === 'joueur', r);
r = await poster(db, { auteurKey: 'alice', auteurName: 'Alice', texte: 'tu es la ?', pour: 'fantome', duelOuvert: false, maintenant: pas() });
ok('apres : designer un nom inconnu, refuse', r.status === 404);
r = await poster(db, { auteurKey: 'sprinter game', auteurName: 'Sprinter Game', texte: 'coucou', duelOuvert: false, maintenant: pas() });
ok('apres : l imitation reste refusee', r.status === 403);
const apres = await participants(db, { duelOuvert: false, maintenant: t });
ok('apres : participants = qui a ecrit (dont Dan), sans SprinterGame', apres.some(p => p.name === 'Dan') && !apres.some(p => p.name === 'SprinterGame') && apres.every(p => p.camp === 'joueur'), apres);
a = await lu('bob');
ok('les messages du duel restent lisibles apres', a.messages.some(m => m.camp === 'nike') && a.messages.some(m => m.camp === 'joueur'));

titre('aimer');
const msgDan = (await lu('alice')).messages.find(m => m.de === 'Dan' && !m.prive);
r = await aimer(db, { id: msgDan.id, cleLecteur: 'alice' });
ok('Alice aime le message de Dan', r.status === 200 && r.corps.aimes === 1 && r.corps.aime, r.corps);
r = await aimer(db, { id: msgDan.id, cleLecteur: 'alice' });
ok('deux fois : toujours un seul j aime', r.corps.aimes === 1);
r = await aimer(db, { id: msgDan.id, cleLecteur: 'carla' });
ok('Carla aussi : deux', r.corps.aimes === 2);
r = await aimer(db, { id: msgDan.id, cleLecteur: 'dan' });
ok('Dan ne peut pas aimer son message', r.status === 400);
let vu = (await lu('alice')).messages.find(m => m.id === msgDan.id);
ok('Alice lit : 2 j aime, dont le sien', vu.aimes === 2 && vu.aime === true, vu);
vu = (await lu('dan')).messages.find(m => m.id === msgDan.id);
ok('Dan lit : 2 j aime, pas le sien', vu.aimes === 2 && vu.aime === false, vu);
let suiteA = await lire(db, { cleLecteur: 'dan', depuis: 1e9 });
ok('une relecture sans message neuf rend quand meme les compteurs', suiteA.messages.length === 0 && suiteA.aimes.some(x => x.id === msgDan.id && x.n === 2), suiteA.aimes);
r = await aimer(db, { id: msgDan.id, cleLecteur: 'alice', aime: false });
ok('Alice retire son j aime : un', r.corps.aimes === 1 && r.corps.aime === false);
const pv = (await lu('bob')).messages.find(m => m.prive && m.de === 'Carla');
ok('aimer un prive qui ne vous est pas adresse : refuse', (await aimer(db, { id: pv.id, cleLecteur: 'dan' })).status === 403);
ok('Bob aime le prive de Carla', (await aimer(db, { id: pv.id, cleLecteur: 'bob' })).status === 200);
ok('Dan ne voit pas le compteur de ce prive', !(await lire(db, { cleLecteur: 'dan', depuis: 1e9 })).aimes.some(x => x.id === pv.id));
ok('message inconnu : 404', (await aimer(db, { id: 999999, cleLecteur: 'bob' })).status === 404);
ok('message retire : 404', (await aimer(db, { id: cible.id, cleLecteur: 'bob' })).status === 404);

titre('prives lus');
const lusDe = async k => (await lire(db, { cleLecteur: k, depuis: 1e9 })).lus;
ok('rien de lu au depart', (await lusDe('bob')).length === 0);
const recus = (await lu('bob')).messages.filter(m => m.prive && m.de === 'Carla');
const dernierCarla = recus[recus.length - 1].id;
r = await marquerLu(db, { cleLecteur: 'bob', avec: 'Carla', jusqua: dernierCarla });
ok('Bob ouvre la conversation avec Carla : lue jusqu a son dernier prive', r.status === 200 && r.corps.avec === 'carla' && r.corps.id === dernierCarla, r.corps);
let l = await lusDe('bob');
ok('la lecture suivante rend la marque', l.length === 1 && l[0].avec === 'carla' && l[0].id === dernierCarla, l);
r = await marquerLu(db, { cleLecteur: 'bob', avec: 'carla', jusqua: 1e9 });
ok('un id invente ne marque que ce qui est arrive', r.corps.id === dernierCarla, r.corps);
r = await marquerLu(db, { cleLecteur: 'bob', avec: 'carla', jusqua: 1 });
ok('une marque ne recule pas', r.corps.id === dernierCarla, r.corps);
r = await poster(db, { auteurKey: 'carla', auteurName: 'Carla', texte: 'encore moi', pour: 'Bob', prive: true, maintenant: pas() });
l = await lusDe('bob');
ok('un prive arrive apres : au-dela de la marque, donc non lu', r.corps.message.id > l[0].id);
ok('Carla n a rien lu de Bob', (await lusDe('carla')).length === 0);
ok('conversation avec soi-meme : refusee', (await marquerLu(db, { cleLecteur: 'bob', avec: 'Bob', jusqua: 5 })).status === 400);
ok('id invalide : refuse', (await marquerLu(db, { cleLecteur: 'bob', avec: 'carla', jusqua: 'x' })).status === 400);
ok('personne a qui on n a jamais parle : rien a marquer', (await marquerLu(db, { cleLecteur: 'bob', avec: 'zoe', jusqua: 5 })).corps.id === 0);

console.log(e ? `\n   ${e} ECHEC(S)\n` : '\n   tout passe\n');
process.exit(e ? 1 : 0);
