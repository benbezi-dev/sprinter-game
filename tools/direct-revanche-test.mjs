// RECOMMENCER ENSEMBLE, ET LES POINTS DE CHAQUE MANCHE.
//
// Deux choses se verifient ici, et elles se tenaient par le meme fil.
//
// 1. Une revanche demande l'accord des DEUX. Elle partait avant sans le
//    demander : les drapeaux « pret » restaient leves de la course precedente,
//    si bien qu'un joueur qui baissait le sien et le relevait aussitot
//    relancait la piste pour l'autre — souvent en train de lire son resultat.
//
// 2. Une revanche COMPTE. Le classement des duels refuse de trancher deux fois
//    le meme identifiant, et la salle donnait le sien, « LIVE-CODE », a toutes
//    ses manches. La deuxieme course d'une piste, et toutes les suivantes, se
//    jouaient donc pour rien : elles s'affichaient et n'existaient pas au
//    classement. C'est la verification la plus importante de ce fichier, parce
//    que c'est celle que personne ne peut faire a l'oeil — une course qui ne
//    rapporte rien ressemble a une course.

const B = process.env.BASE || 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const attendre = ms => new Promise(r => setTimeout(r, ms));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 54 - t.length))}`);

function client(code, nom) {
  const c = { nom, moi: null, joueurs: [], manche: null, depart: null,
              presentations: 0, resultats: [], points: [] };
  const q = `name=${encodeURIComponent(nom)}&races=100&level=4&max=2`;
  c.ws = new WebSocket(`${WS}/live/${code}?${q}`);
  c.ouvert = new Promise(res => c.ws.addEventListener('open', res));
  c.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'bienvenue') c.moi = m.moi;
    if (m.joueurs) { c.joueurs = m.joueurs; c.manche = m.manche; }
    if (m.presentation) c.presentations++;
    // Le depart est une date : on retient la derniere annoncee, et le passage
    // a null entre deux courses est ce qui rend la suivante detectable.
    if (m.depart_a !== undefined) c.depart = m.depart_a;
    if (m.t === 'resultat') c.resultats.push(m);
    if (m.t === 'points') c.points.push(m);
  });
  c.envoyer = o => c.ws.send(JSON.stringify(o));
  c.pret = v => c.envoyer({ t: 'pret', pret: v });
  c.mien = () => c.joueurs.find(j => j.id === c.moi);
  return c;
}

/** Ce que le classement des duels retient de ce joueur. */
async function auClassement(nom) {
  const r = await fetch(`${B}/duels?name=${encodeURIComponent(nom)}`);
  const d = await r.json();
  const moi = d.moi;
  if (!moi) return { duels: 0, lp: 0, palier: 0 };
  return {
    duels: (moi.wins || 0) + (moi.losses || 0) + (moi.draws || 0),
    lp: moi.lp || 0, palier: moi.palier || 0, delta: moi.last_delta || 0,
  };
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  RECOMMENCER ENSEMBLE — l accord, et les points              ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const marque = Math.random().toString(36).slice(2, 6).toUpperCase();
const NOM_A = 'Hote' + marque, NOM_B = 'Invite' + marque;

const code = (await (await fetch(B + '/live/nouveau', { method: 'POST' })).json()).id;
console.log(`\n   piste ${code} — ${NOM_A} contre ${NOM_B}`);

const a = client(code, NOM_A); await a.ouvert; await attendre(150);
const b = client(code, NOM_B); await b.ouvert; await attendre(350);

titre('LA PREMIERE COURSE');
ok('la piste est neuve : aucune manche courue', a.manche === 0, String(a.manche));
a.pret(true); b.pret(true);
await attendre(400);
ok('les deux « pret » donnent le depart', !!a.depart && !!b.depart);
const departUn = a.depart;

a.envoyer({ t: 'fini', ms: 9500 });
b.envoyer({ t: 'fini', ms: 9900 });
await attendre(600);
ok('un resultat est rendu', a.resultats.length === 1, String(a.resultats.length));
ok('l hote l emporte', a.resultats[0]?.issue === 'challenger',
   String(a.resultats[0]?.issue));
ok('le resultat porte le numero de la manche', a.resultats[0]?.manche === 0,
   String(a.resultats[0]?.manche));

titre('APRES LA COURSE, PERSONNE N EST PRET');
// Le coeur de la premiere correction. Sans cette remise a zero, les deux
// drapeaux restaient leves et la piste etait a un clic de repartir toute seule.
ok('la salle a compte la manche', a.manche === 1, String(a.manche));
ok('les deux drapeaux sont baisses chez l hote',
   a.joueurs.length === 2 && a.joueurs.every(j => !j.pret),
   JSON.stringify(a.joueurs.map(j => j.pret)));
ok('et chez l invite aussi',
   b.joueurs.length === 2 && b.joueurs.every(j => !j.pret),
   JSON.stringify(b.joueurs.map(j => j.pret)));
ok('la piste n annonce plus de depart', !a.depart, String(a.depart));

titre('UN SEUL NE PEUT PAS RELANCER L AUTRE');
// L ancien chemin, exactement : baisser son drapeau et le relever. Il partait.
a.pret(false); await attendre(200);
a.pret(true); await attendre(450);
ok('l hote a dit oui', !!a.mien()?.pret);
ok('l invite voit que l hote a dit oui',
   !!b.joueurs.find(j => j.id === a.moi)?.pret);
ok('l invite n a rien demande', !b.mien()?.pret);
ok('et rien ne part', !a.depart && !b.depart, String(a.depart));

titre('L ACCORD DES DEUX FAIT REPARTIR LA PISTE');
b.pret(true);
await attendre(500);
ok('un nouveau depart est annonce', !!a.depart && !!b.depart);
ok('ce n est pas celui de la premiere course', a.depart !== departUn);
ok('les deux partent au meme instant', a.depart === b.depart,
   `${a.depart} vs ${b.depart}`);
ok('une nouvelle presentation est annoncee', a.presentations === 2,
   String(a.presentations));

titre('LA REVANCHE COMPTE AU CLASSEMENT');
// L invite gagne la seconde : les deux ont donc une victoire et une defaite,
// ce qui ne peut arriver que si les DEUX manches sont entrees au classement.
a.envoyer({ t: 'fini', ms: 10100 });
b.envoyer({ t: 'fini', ms: 9800 });
await attendre(900);

ok('un second resultat est rendu', a.resultats.length === 2, String(a.resultats.length));
ok('l invite l emporte cette fois', a.resultats[1]?.issue === 'opponent',
   String(a.resultats[1]?.issue));
ok('il porte le numero de la seconde manche', a.resultats[1]?.manche === 1,
   String(a.resultats[1]?.manche));

const clA = await auClassement(NOM_A);
const clB = await auClassement(NOM_B);
ok('l hote a bien DEUX duels tranches, pas un', clA.duels === 2, String(clA.duels));
ok('l invite aussi', clB.duels === 2, String(clB.duels));

titre('CE QUE CHACUN A GAGNE, ET IL LE SAIT');
// Les points partaient deja au classement ; ils partaient en silence. Chaque
// course les annonce maintenant aux deux joueurs, chacun sa ligne.
ok('deux annonces de points chez l hote', a.points.length === 2, String(a.points.length));
ok('et deux chez l invite', b.points.length === 2, String(b.points.length));

const monMouvement = (c, i) => {
  const p = c.points[i];
  if (!p) return null;
  return [p.hote, p.invite].find(x => x && x.id === c.moi) || null;
};
const gainA1 = monMouvement(a, 0), gainB1 = monMouvement(b, 0);
ok('chacun recoit SA ligne, designee par son identifiant', !!gainA1 && !!gainB1);
ok('le vainqueur de la premiere prend des points', (gainA1?.lp ?? 0) > 0,
   String(gainA1?.lp));
ok('le perdant en rend', (gainB1?.lp ?? 0) < 0, String(gainB1?.lp));
ok('les deux voient les memes chiffres',
   JSON.stringify(a.points[0]?.hote) === JSON.stringify(b.points[0]?.hote));

const gainA2 = monMouvement(a, 1), gainB2 = monMouvement(b, 1);
ok('la seconde manche paie elle aussi',
   (gainB2?.lp ?? 0) > 0 && (gainA2?.lp ?? 0) < 0,
   `${gainA2?.lp} / ${gainB2?.lp}`);
ok('chaque annonce porte sa manche',
   a.points[0]?.manche === 0 && a.points[1]?.manche === 1,
   `${a.points[0]?.manche} / ${a.points[1]?.manche}`);
if (gainA1 && gainB2) {
  console.log(`\n     manche 1 : ${NOM_A} ${gainA1.lp > 0 ? '+' : ''}${gainA1.lp}` +
              ` · ${NOM_B} ${gainB1.lp > 0 ? '+' : ''}${gainB1.lp}`);
  console.log(`     manche 2 : ${NOM_A} ${gainA2.lp > 0 ? '+' : ''}${gainA2.lp}` +
              ` · ${NOM_B} ${gainB2.lp > 0 ? '+' : ''}${gainB2.lp}`);
}

titre('L HOTE N EST PAS TAXE POUR AVOIR OUVERT LA PISTE');
// En direct, personne ne court contre un chrono deja pose : les deux camps
// doivent etre payes pareil. Une victoire de l hote et une victoire de
// l invite, a rang de depart egal, se valent donc — c'est ce que verifie
// l egalite ci-dessous, et elle serait fausse avec le bareme des roles, ou
// relever rapporte 25 et lancer 20.
if (gainA1 && gainB2) {
  ok('la victoire de l hote vaut celle de l invite', gainA1.lp === gainB2.lp,
     `${gainA1.lp} vs ${gainB2.lp}`);
}

a.ws.close(); b.ws.close();

console.log('\n' + '─'.repeat(62));
console.log(echecs === 0 ? '   TOUT PASSE.' : `   ${echecs} VERIFICATION(S) EN ECHEC.`);
console.log('');
process.exit(echecs ? 1 : 0);
