// L'APPEL DECLENCHE PAR LE JOUEUR, sur le vrai moteur (canal.ts, APPEL_JOUEUR).
//
// haies-course-test.mjs fait courir l'automate sous l'appel automatique : la
// machine vise, et rien de ce qui suit ne peut arriver. Ce harnais-ci fait
// courir le meme moteur avec `appelJoueur: true`, et verifie les trois choses
// que l'etape 1 du prototype ajoute :
//
//   - c'est le joueur qui quitte le sol, et ne rien faire se paie ;
//   - la jambe d'attaque est annoncee, puis figee — le jeu passe un contrat ;
//   - marteler en l'air coute, donc lever les pouces vaut mieux.
//
// CE QUE CE HARNAIS NE SAIT PAS DIRE. Il ne dit pas si la fenetre se SENT sous
// un pouce, ni si un pouce peut quitter un pave qu'il martele et y revenir a
// une haie par seconde. C'est la seule question qui compte pour decider de
// l'etape 2, et elle se tranche sur telephone, pas ici. Ce que le harnais
// garantit, c'est que la regle est jouable AU MOMENT ou on la portera au pouce.

import '../src/game/sprinter-core.js';
import { HAIES } from '../src/game/haies.js';
import { APPEL, TOLERANCE, TOLERANCE_T, APPEL_MINI, POUSSEE_APPEL,
         CISEAU_VISE, GARDE_CISEAU } from '../src/game/haies-jeu.js';
import { nouvelleCourse, preparerCoureur, pas, appeler, approche, enVol,
         frappeEnVol, relacher, ciseauDe } from '../src/game/haies-pas.js';

const { Track, Runner } = globalThis.SprinterCore;

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/**
 * Une course de haies jouee par un automate qui appelle lui-meme.
 *
 * `cible`   a quelle distance de la haie il appuie, en metres. `null` : jamais.
 * `jambe`   'bonne' suit la touche annoncee, 'mauvaise' prend l'autre.
 * `enVol`   continue-t-il de marteler les paves pendant le vol ?
 * `mitraille` appuie sur la touche d'attaque des qu'elle s'allume.
 * `joueur`  false remet l'appel a la machine : c'est la course de reference.
 * `ciseau`  a quelle part du vol le pouce se leve. `null` : jamais.
 *
 * `voyage`  LE TEMPS QUE LE POUCE PASSAIT EN L'AIR pour atteindre une touche
 *           d'attaque au-dessus des paves, en secondes. Ces touches n'existent
 *           plus — le geste vit sur le pave — et ce parametre ne sert donc plus
 *           qu'a une chose : rejouer l'ancienne commande pour verifier qu'on a
 *           bien gagne ce qu'on croit avoir gagne. Il vaut zero partout
 *           ailleurs, et c'est le sujet de « LE GESTE NE COUTE PLUS RIEN ».
 */
function courir(cle, {
  cadence, cible = null, jambe = 'bonne', enVolAussi = false, mitraille = false,
  joueur = true, voyage = 0, ciseau = CISEAU_VISE, mouchard = null,
  dureeMax = 120, bruit = 0, graine = 1,
} = {}) {
  const race = HAIES[cle];
  const track = new Track(race);
  const r = new Runner('TOI', 3, {
    isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total,
  });
  const course = nouvelleCourse(cle, { appelJoueur: joueur });
  preparerCoureur(course, r);
  const dt = 1 / 60;

  let t = 0, fin = null, prochainTap = 0, gauche = true, muetJusqua = -1, perdues = 0;
  const journal = [], chutes = [], annonces = [];
  let g = graine;
  const alea = () => (g = (g * 16807) % 2147483647) / 2147483647;
  r.reaction = 0.15;

  while (t < dureeMax && r.d < track.total) {
    while (prochainTap <= t) {
      // EXACTEMENT LE CHEMIN DE padPress() : en l'air, la frappe ne pousse pas,
      // elle coute. Un automate qui appellerait press() en vol mesurerait un
      // jeu qui n'existe pas.
      if (enVol(course)) { if (enVolAussi) frappeEnVol(course); }
      else if (t < muetJusqua) perdues++;   // le pouce est en voyage vers la touche
      else r.press(gauche ? 'left' : 'right', t);
      gauche = !gauche;
      prochainTap += 1 / (cadence * (1 + (alea() * 2 - 1) * bruit));
    }

    // LE CISEAU — le pouce se leve. C'est le meme pave, le meme doigt : on ne
    // simule rien de plus qu'un relache au bon moment du vol.
    const vol = ciseauDe(course, r);
    if (vol && !vol.fait && ciseau !== null && vol.part >= ciseau) {
      relacher(course, r, vol.cote);
    }

    // L'APPEL. On note aussi ce que la touche annoncait, image par image :
    // c'est ce qui permet de verifier qu'elle ne change pas sous le pouce.
    const a = approche(course);
    if (a) {
      annonces.push({ haie: a.haie, cote: a.cote });
      if (mouchard) mouchard(a);
      const reste = course.positions[course.i] - r.d;
      // Le pouce quitte les paves une demi-duree de voyage avant d'appuyer, et
      // y revient une demi-duree apres : le silence est centre sur l'appel.
      if (cible !== null && voyage > 0 && reste <= cible + r.v * voyage / 2 && muetJusqua < t) {
        muetJusqua = t + voyage;
      }
      if (cible !== null && (mitraille || reste <= cible)) {
        const cote = jambe === 'bonne' ? a.cote : (a.cote === 'left' ? 'right' : 'left');
        appeler(course, r, cote);
      }
    }

    r.stepPlayer(dt, t);
    t += dt;
    const tombait = r.fallAnim > 0;
    const juge = pas(course, r);
    if (juge) journal.push(juge);
    if (juge && r.fallAnim > 0 && !tombait) chutes.push(juge);
    if (r.d >= track.total && fin === null) fin = t;
  }
  const n = k => course.ciseaux.filter(x => x.note === k).length;
  return { temps: fin, journal, chutes, annonces, course, r, perdues,
           ciseaux: course.ciseaux.slice(), nets: n('ciseau') };
}

/** La cible qui tombe pile sur le point d'appel du reglement. */
const JUSTE = cle => APPEL[cle].avant;

titre("CE QUE LA FENETRE VAUT SOUS UN POUCE");

// La tolerance est en secondes depuis ce prototype, et la distance n'en est
// plus que le plancher. On ecrit ce que cela donne : c'est le seul endroit du
// depot ou la fenetre se lit en millisecondes, et c'est en millisecondes
// qu'elle se calera a la main.
for (const cle of ['100h', '110h']) {
  const v = 9.5;
  const p = Math.max(TOLERANCE.parfait, TOLERANCE_T.parfait * v);
  const b = Math.max(TOLERANCE.bon, TOLERANCE_T.bon * v);
  ok(`${cle} : a ${v} m/s, parfait ±${Math.round(p / v * 1000)} ms, bon ±${Math.round(b / v * 1000)} ms`,
     p / v >= 0.05 && b / v >= 0.09,
     `${(p / v * 1000).toFixed(0)} / ${(b / v * 1000).toFixed(0)} ms`);
  // La zone « trop pres » doit exister entre la fenetre « bon » et le mur.
  ok(`${cle} : « trop pres » garde une place entre « bon » et la percussion`,
     APPEL[cle].avant - b > APPEL_MINI,
     `bon s'arrete a ${(APPEL[cle].avant - b).toFixed(2)} m, le mur est a ${APPEL_MINI}`);
}

// A pleine vitesse la fenetre ne doit pas se refermer : c'etait tout le defaut
// de la tolerance en metres.
{
  const bas = Math.max(TOLERANCE.parfait, TOLERANCE_T.parfait * 9.0) / 9.0;
  const haut = Math.max(TOLERANCE.parfait, TOLERANCE_T.parfait * 11.0) / 11.0;
  ok('la fenetre ne retrecit pas quand le coureur va plus vite',
     haut >= bas - 1e-9, `${(bas * 1000).toFixed(0)} ms a 9 m/s, ${(haut * 1000).toFixed(0)} ms a 11`);
}

titre("NE RIEN FAIRE SE PAIE");

for (const cle of ['100h', '110h', '400h']) {
  const rien = courir(cle, { cadence: 9.5, cible: null });
  const joue = courir(cle, { cadence: 9.5, cible: JUSTE(cle) });
  const percutees = rien.journal.filter(j => j.note === 'percute').length;
  ok(`${cle} : sans appuyer, les dix haies se percutent`, percutees === 10, `${percutees}/10`);
  ok(`${cle} : et cela coute, franchement`, rien.temps > joue.temps + 1.0,
     `${rien.temps?.toFixed(2)} s contre ${joue.temps?.toFixed(2)}`);
  ok(`${cle} : personne ne tombe pour autant`, rien.chutes.length === 0,
     `${rien.chutes.length} chute(s)`);
}

titre("LA TOUCHE ANNONCEE EST UN CONTRAT");

for (const cle of ['100h', '110h', '400h']) {
  const c = courir(cle, { cadence: 9.5, cible: JUSTE(cle) });
  // Le cote annonce ne doit jamais changer pendant une meme approche : sinon le
  // joueur ne joue pas, il devine.
  const parHaie = new Map();
  let bascules = 0;
  for (const a of c.annonces) {
    if (parHaie.has(a.haie) && parHaie.get(a.haie) !== a.cote) bascules++;
    parHaie.set(a.haie, a.cote);
  }
  ok(`${cle} : le cote annonce ne bascule jamais en cours d'approche`,
     bascules === 0, `${bascules} bascule(s)`);
  ok(`${cle} : chaque haie a bien ete annoncee`, parHaie.size === 10, `${parHaie.size}/10`);
}

titre("LA MAUVAISE JAMBE COUTE, LA BONNE PAIE");

for (const cle of ['100h', '110h', '400h']) {
  const bonne = courir(cle, { cadence: 9.5, cible: JUSTE(cle), jambe: 'bonne' });
  const mauvaise = courir(cle, { cadence: 9.5, cible: JUSTE(cle), jambe: 'mauvaise' });
  ok(`${cle} : attaquer de la mauvaise jambe coute du chrono`,
     mauvaise.temps > bonne.temps + 0.05,
     `${mauvaise.temps?.toFixed(2)} s contre ${bonne.temps?.toFixed(2)}`);
  ok(`${cle} : et le jugement le dit, haie par haie`,
     mauvaise.journal.every(j => j.jambe === false),
     `${mauvaise.journal.filter(j => j.jambe === false).length}/10`);
}

titre("LEVER LES POUCES VAUT MIEUX QUE MARTELER EN L'AIR");

for (const cle of ['100h', '110h', '400h']) {
  const leve = courir(cle, { cadence: 9.5, cible: JUSTE(cle), enVolAussi: false });
  const martele = courir(cle, { cadence: 9.5, cible: JUSTE(cle), enVolAussi: true });
  ok(`${cle} : marteler a travers les haies coute du chrono`,
     martele.temps > leve.temps + 0.05,
     `${martele.temps?.toFixed(2)} s contre ${leve.temps?.toFixed(2)}`);
  ok(`${cle} : et les frappes en vol ont bien ete comptees`,
     martele.course.frappesEnVol > 0 && leve.course.frappesEnVol === 0,
     `${martele.course.frappesEnVol} contre ${leve.course.frappesEnVol}`);
}

titre("MITRAILLER LA TOUCHE D'ATTAQUE NE PAIE PAS");

for (const cle of ['100h', '110h', '400h']) {
  const juste = courir(cle, { cadence: 9.5, cible: JUSTE(cle) });
  const fou = courir(cle, { cadence: 9.5, cible: JUSTE(cle), mitraille: true });
  // Un dixieme, et pas trois. A la base de vitesse de Sprinter le coureur
  // revient vite a son plafond : ce qu'un mauvais appel lui retire, il le
  // reprend dans l'intervalle. Le cout reste reel — il doit rester mesurable —
  // mais il ne pese plus ce qu'il pesait sous un plafond reduit.
  ok(`${cle} : appuyer des que la touche s'allume coute du chrono`,
     fou.temps > juste.temps + 0.10,
     `${fou.temps?.toFixed(2)} s contre ${juste.temps?.toFixed(2)}`);
}

titre("VISER JUSTE PAIE, ET LE CHRONO RESTE UN CHRONO");

for (const cle of ['100h', '110h', '400h']) {
  const a = APPEL[cle].avant;
  const juste = courir(cle, { cadence: 9.5, cible: a });
  const tot = courir(cle, { cadence: 9.5, cible: a + 1.6 });
  const tard = courir(cle, { cadence: 9.5, cible: a - 1.1 });
  ok(`${cle} : appeler trop tot coute`, tot.temps > juste.temps,
     `${tot.temps?.toFixed(2)} contre ${juste.temps?.toFixed(2)}`);
  ok(`${cle} : appeler trop tard coute`, tard.temps > juste.temps,
     `${tard.temps?.toFixed(2)} contre ${juste.temps?.toFixed(2)}`);
}

titre("LE BAREME SE GAGNE, ET IL SE MERITE");

// UN PLATEAU N'EST PAS UNE CASE OU ATTERRIR : c'est la fourchette des chronos
// donnes aux ADVERSAIRES de l'etape (sprinter-app.js, chaque coureur recoit un
// `target` tire entre les deux bornes). Le test precedent demandait au joueur
// d'y « rester », ce qui ne voulait rien dire — courir plus vite que la borne
// basse, c'est gagner largement, pas sortir du jeu.
//
// Ce qu'il faut verifier est ailleurs, et c'est ce que le bareme decide par le
// joueur (haies.js, BAREME) engage : le dernier niveau doit se gagner a haute
// cadence, et ne pas se gagner a basse. Un bareme qu'aucun doigt ne bat est un
// mur ; un bareme qu'un doigt tranquille bat est un decor.
for (const cle of ['100h', '110h', '400h']) {
  const [bas, haut] = HAIES[cle].ranges[5];          // le dernier plateau, les ZEZE
  const vif = courir(cle, { cadence: 12, cible: JUSTE(cle) });
  const lent = courir(cle, { cadence: 8, cible: JUSTE(cle) });
  ok(`${cle} : a 12 frappes/s, le dernier plateau se gagne`,
     vif.temps !== null && vif.temps <= bas,
     `${vif.temps?.toFixed(2)} s contre ${bas} au mieux en face`);
  ok(`${cle} : a 8 frappes/s, il ne se gagne pas`,
     lent.temps !== null && lent.temps >= haut,
     `${lent.temps?.toFixed(2)} s contre ${haut} au pire en face`);
}

titre("LA JAUGE NE MENT PAS");

// La jauge d'appel (TouchControls) se remplit pendant l'approche et doit etre
// PLEINE au point du reglement. Le joueur apprend a viser le vert : si la jauge
// et le jugement divergeaient d'un cheveu, il apprendrait a viser un mensonge,
// et ce serait le pire des defauts — un jeu qui punit ce qu'il a montre.
//
// C'est aussi ce qui a manque a la premiere version : elle disait quel pouce et
// jamais quand, et le joueur reagissait au lieu d'anticiper.
for (const cle of ['100h', '110h', '400h']) {
  const vus = [];
  courir(cle, { cadence: 10, cible: 0.0001, mouchard: a => vus.push({ ...a }) });
  const parfaits = vus.filter(v => v.zone === 'parfait');
  const bornes = parfaits.length
    ? [Math.min(...parfaits.map(v => v.avance)), Math.max(...parfaits.map(v => v.avance))]
    : [NaN, NaN];
  ok(`${cle} : la jauge pleine (avance = 1) tombe dans le « parfait »`,
     bornes[0] < 1 && bornes[1] > 1,
     `le parfait va de ${bornes[0]?.toFixed(2)} a ${bornes[1]?.toFixed(2)}`);
  // Et elle doit monter, pas sauter : une jauge qui bondit ne s'anticipe pas.
  let saut = 0;
  for (let i = 1; i < vus.length; i++) {
    if (vus[i].haie === vus[i - 1].haie) saut = Math.max(saut, vus[i].avance - vus[i - 1].avance);
  }
  ok(`${cle} : elle monte doucement, elle ne bondit pas`, saut < 0.12,
     `plus grand pas : ${saut.toFixed(3)}`);
}

titre("LE GESTE NE COUTE PLUS RIEN AU POUCE");

// CE QUE CETTE SECTION GARDE FERME, et il a fallu une video d'essai pour le
// voir. Quand l'appel se donnait sur deux touches AU-DESSUS des paves, le pouce
// devait monter et redescendre : deux frappes perdues par haie, dix haies. A
// dix frappes par seconde sur le 110 m, un joueur qui passait les DIX haies en
// « parfait » mettait 14,12 s la ou la machine mettait 12,52. Le jeu punissait
// le geste qu'il demandait.
//
// Le geste vit maintenant SUR le pave — appuyer, maintenir, relacher — et le
// maintien occupe le vol, ou l'on ne doit de toute facon plus marteler. Il ne
// prend donc rien a la course : il occupe le temps que la haie lui prenait
// deja. Ce qui suit verifie qu'il en reste ainsi.
for (const cle of ['100h', '110h', '400h']) {
  let pire = 0, ou = '';
  for (const cad of [8, 9, 10, 11, 12]) {
    const machine = courir(cle, { cadence: cad, joueur: false });
    const pouce = courir(cle, { cadence: cad, cible: JUSTE(cle) });
    if (machine.temps === null || pouce.temps === null) continue;
    const d = pouce.temps - machine.temps;
    if (d > pire) { pire = d; ou = `a ${cad} frappes/s (${pouce.temps.toFixed(2)} contre ${machine.temps.toFixed(2)})`; }
  }
  // Jouer le geste a la perfection ne doit jamais couter par rapport a la
  // machine qui ne le joue pas. Un dixieme de tolerance pour le bruit de
  // quantification du rythme, pas davantage.
  ok(`${cle} : le geste joue juste ne coute rien contre la machine`,
     pire < 0.10, `${pire.toFixed(2)} s ${ou}`);
}

titre("LE CISEAU EST CE QUI FAIT LA COURSE");

// LE SECOND TEMPS DU GESTE, et celui qui definit le hurdling : la jambe
// d'attaque griffe vers le bas pendant que la jambe arriere passe. C'est lui
// qui remet le coureur en course au lieu de le faire retomber en arriere.
//
// Le freinage de l'air est de la physique et se subit ; le ciseau est de la
// TECHNIQUE et se decide. GARDE_CISEAU chiffre la difference.
ok('un ciseau net ne coute rien, et tout le reste coute',
   GARDE_CISEAU.ciseau === 1 && GARDE_CISEAU.bon < 1
   && GARDE_CISEAU.accroche < GARDE_CISEAU.bon && GARDE_CISEAU.traine < GARDE_CISEAU.bon
   && GARDE_CISEAU.absent < GARDE_CISEAU.accroche,
   JSON.stringify(GARDE_CISEAU));

for (const cle of ['100h', '110h', '400h']) {
  const net = courir(cle, { cadence: 10, cible: JUSTE(cle), ciseau: CISEAU_VISE });
  // ON SONDE AUX EXTREMES, et il a fallu y venir. A 0,20 et 0,85 du vol, le
  // relache tombe encore dans la fenetre « bon » sur le 100 m haies : son vol
  // ne dure que 243 ms, et la tolerance bornee y couvre presque tout. Un
  // « bon » ne coute que trois centiemes et demi, que le moteur reprend — le
  // chrono ne bougeait pas, et le test criait sur une verite.
  const tot = courir(cle, { cadence: 10, cible: JUSTE(cle), ciseau: 0.05 });
  const tard = courir(cle, { cadence: 10, cible: JUSTE(cle), ciseau: 0.95 });
  const jamais = courir(cle, { cadence: 10, cible: JUSTE(cle), ciseau: null });
  ok(`${cle} : les dix ciseaux tombent nets quand on vise juste`,
     net.nets === 10, `${net.nets}/10`);
  ok(`${cle} : relacher trop tot coute`, tot.temps > net.temps,
     `${tot.temps?.toFixed(2)} contre ${net.temps?.toFixed(2)}`);
  ok(`${cle} : relacher trop tard coute`, tard.temps > net.temps,
     `${tard.temps?.toFixed(2)} contre ${net.temps?.toFixed(2)}`);
  // Ne jamais ciseauter, c'est franchir a plat, pieds joints. Cela doit se
  // payer d'un demi-chrono, pas d'une broutille : c'est la faute qui separe un
  // hurdleur d'un sauteur.
  ok(`${cle} : ne jamais ciseauter coute une demi-seconde ou plus`,
     jamais.temps - net.temps >= 0.5,
     `${(jamais.temps - net.temps).toFixed(2)} s (${jamais.temps?.toFixed(2)} contre ${net.temps?.toFixed(2)})`);
}

// LA CIBLE SUIT LE VOL, DONC ELLE SE RESSERRE AVEC LA VITESSE — c'est la lecon
// de dynamisme, et elle sort du reglement : plus on va vite, plus le vol est
// court (3,30 m de centre de masse divises par la vitesse), donc plus le ciseau
// doit venir tot. Un hurdleur rapide n'a pas le loisir de trainer sa jambe
// arriere. La TOLERANCE, elle, reste constante en millisecondes : la demande
// change, la precision exigee non.
for (const cle of ['100h', '110h']) {
  const lent = courir(cle, { cadence: 8, cible: JUSTE(cle) });
  const vif = courir(cle, { cadence: 12, cible: JUSTE(cle) });
  const msL = lent.ciseaux.filter(c => c.ms).map(c => c.ms);
  const msV = vif.ciseaux.filter(c => c.ms).map(c => c.ms);
  const moy = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  ok(`${cle} : a haute cadence, le ciseau se place plus tot`,
     moy(msV) < moy(msL),
     `${moy(msV).toFixed(0)} ms a 12 frappes/s contre ${moy(msL).toFixed(0)} a 8`);
}

// ON NE JOUE PAS LES HAIES AVEC LES DOIGTS DE SPRINTER, et c'est le garde-fou
// qui manquait. Il a fallu qu'un joueur le trouve : « quand j'appuie comme sur
// le 100 m je fais 11 secondes sur le 110 m haies ».
//
// Le defaut venait d'une sur-correction — la fenetre du cote tot avait ete
// elargie pour qu'une frappe reflexe ne soit plus un accrochage, et elle
// devenait un ciseau MOYEN, qui ne coute presque rien. CISEAU_PLANCHER ferme
// cela : sous trente pour cent du vol, on n'a pas ciseaute, on a tape.
//
// Une frappe ordinaire dure 50 a 80 ms sur un vol de 300 : elle tombe donc
// sous le plancher. Ce test la joue a 0,15 du vol — plus genereux qu'un vrai
// pouce — et exige qu'elle coute au moins une seconde sur la course.
for (const cle of ['100h', '110h', '400h']) {
  const tenu = courir(cle, { cadence: 10, cible: JUSTE(cle), ciseau: CISEAU_VISE });
  const tape = courir(cle, { cadence: 10, cible: JUSTE(cle), ciseau: 0.15 });
  ok(`${cle} : marteler comme sur le plat ne passe pas les haies`,
     tape.temps - tenu.temps >= 1.0,
     `${(tape.temps - tenu.temps).toFixed(2)} s (${tape.temps?.toFixed(2)} contre ${tenu.temps?.toFixed(2)})`);
  ok(`${cle} : et le jeu le dit — aucun ciseau compte`,
     tape.ciseaux.every(x => x.note === 'absent'),
     [...new Set(tape.ciseaux.map(x => x.note))].join(' '));
}

// ET NE RIEN FAIRE NE PASSE PAS POUR UN CISEAU : sans relache, les dix haies
// se notent « absent ». C'est ce qui empeche le second temps du geste de
// devenir facultatif, comme l'appel l'etait avant lui.
for (const cle of ['110h', '400h']) {
  const c = courir(cle, { cadence: 10, cible: JUSTE(cle), ciseau: null });
  ok(`${cle} : sans relache, les dix ciseaux sont notes absents`,
     c.ciseaux.filter(x => x.note === 'absent').length === 10,
     c.ciseaux.map(x => x.note).join(' '));
}

titre("AUCUNE CHUTE NE VIENT D'UNE HAIE");

// Comme sous l'appel automatique : seule une repetition de touche fait tomber.
// Une haie mal prise coute de la vitesse, jamais l'equilibre — sans quoi, a une
// haie par seconde, la course deviendrait inracontable des la deuxieme.
for (const cle of ['100h', '110h', '400h']) {
  let total = 0;
  for (let graine = 1; graine <= 12; graine++) {
    for (const cible of [JUSTE(cle), JUSTE(cle) + 1.4, JUSTE(cle) - 1.0, null]) {
      total += courir(cle, { cadence: 9, cible, bruit: 0.3, graine }).chutes.length;
    }
  }
  ok(`${cle} : doigt irregulier, appel juste ou manque, aucune chute sur une haie`,
     total === 0, `${total} chute(s)`);
}

console.log(`\n${'─'.repeat(62)}`);
console.log(e ? `   ${e} VERIFICATION(S) EN ECHEC.` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
