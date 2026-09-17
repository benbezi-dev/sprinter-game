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
import { APPEL, TOLERANCE, TOLERANCE_T, APPEL_MINI, POUSSEE_APPEL } from '../src/game/haies-jeu.js';
import { nouvelleCourse, preparerCoureur, pas, appeler, approche, enVol,
         frappeEnVol } from '../src/game/haies-pas.js';

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
 *
 * `voyage`  LE TEMPS QUE LE POUCE PASSE EN L'AIR entre les paves et la touche
 *           d'attaque, en secondes — donc pendant lequel il ne martele plus.
 *           C'est la seule chose que ce harnais modelise et que le jeu ne
 *           contient pas, et c'est ce qui manquait : sans elle, le prototype
 *           se mesurait comme si le pouce se dedoublait. Le joueur, lui, l'a
 *           senti tout de suite.
 */
function courir(cle, {
  cadence, cible = null, jambe = 'bonne', enVolAussi = false, mitraille = false,
  joueur = true, voyage = 0, mouchard = null, dureeMax = 120, bruit = 0, graine = 1,
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
  return { temps: fin, journal, chutes, annonces, course, r, perdues };
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
  ok(`${cle} : appuyer des que la touche s'allume coute du chrono`,
     fou.temps > juste.temps + 0.3,
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
  const plateaux = HAIES[cle].ranges;
  ok(`${cle} : un joueur qui vise juste a 9,5 frappes/s reste dans le bareme`,
     juste.temps > plateaux[5][0] * 0.95 && juste.temps < plateaux[0][1] * 1.15,
     `${juste.temps?.toFixed(2)} s`);
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

titre("L'APPEL REND CE QUE LE POUCE A COUTE");

// LE DEFAUT QUE CETTE SECTION GARDE FERME, et il a ete trouve au pouce, pas
// ici : rendre l'appel au joueur rendait le jeu plus LENT, parce que le pouce
// qui monte vers la touche d'attaque ne martele plus. Deux frappes perdues par
// haie, dix haies. Sur le 110 m haies a dix frappes par seconde, un joueur qui
// passait les DIX haies en « parfait » mettait 14,12 s la ou la machine mettait
// 12,52 : le jeu punissait le geste qu'il demandait.
//
// POUSSEE_APPEL comble le trou a l'endroit exact ou il est. Ce qui suit verifie
// que le compte y est, et qu'il y reste.
// LA BORNE EST ASYMETRIQUE, et c'est voulu. La premiere version demandait au
// joueur de coller au chrono de la machine dans les deux sens, et elle a
// echoue sur le 110 m haies a huit frappes par seconde : le joueur y gagnait
// 1,38 s. C'etait le test qui avait tort. La machine, a cette cadence, casse
// son rythme a chaque haie ; le joueur qui vise juste tient ses quatre appuis.
// Il vient d'acquerir une competence qu'elle n'a pas, et elle doit payer —
// sans quoi on aurait ajoute un geste sans ajouter un jeu.
//
// Ce qui ne doit pas arriver, en revanche, c'est d'etre PUNI pour bien jouer :
// c'est le defaut qui a ete vu au pouce, et c'est ce que la borne basse garde
// fermee. La borne haute n'est la que pour que le bareme veuille encore dire
// quelque chose.
for (const cle of ['100h', '110h', '400h']) {
  let pireLent = 0, ouLent = '', pireVif = 0, ouVif = '';
  for (const cad of [8, 9, 10, 11, 12]) {
    const machine = courir(cle, { cadence: cad, joueur: false });
    const pouce = courir(cle, { cadence: cad, cible: JUSTE(cle), voyage: 0.16 });
    if (machine.temps === null || pouce.temps === null) continue;
    const d = pouce.temps - machine.temps;
    const ou = `a ${cad} frappes/s (${pouce.temps.toFixed(2)} contre ${machine.temps.toFixed(2)})`;
    if (d > pireLent) { pireLent = d; ouLent = ou; }
    if (-d > pireVif) { pireVif = -d; ouVif = ou; }
  }
  ok(`${cle} : bien jouer au pouce ne coute jamais plus d'une seconde`,
     pireLent < 1.0, `${pireLent.toFixed(2)} s ${ouLent}`);
  ok(`${cle} : et n'en rapporte pas plus de deux — le bareme tient`,
     pireVif < 2.0, `${pireVif.toFixed(2)} s ${ouVif}`);
}

// Et le voyage du pouce doit COUTER quelque chose : s'il ne coutait rien, la
// poussee serait un cadeau et non une compensation.
for (const cle of ['110h', '400h']) {
  const net = courir(cle, { cadence: 10, cible: JUSTE(cle), voyage: 0 });
  const lourd = courir(cle, { cadence: 10, cible: JUSTE(cle), voyage: 0.24 });
  ok(`${cle} : un pouce plus lent coute quand meme du chrono`,
     lourd.temps > net.temps, `${lourd.temps?.toFixed(2)} contre ${net.temps?.toFixed(2)}`);
}

// LA POUSSEE SE MERITE. Elle doit suivre la note, et la mauvaise jambe n'en
// recoit rien : sans cela, appuyer n'importe comment rapporterait autant que
// viser, et l'on aurait remplace un jeu qu'on subit par un jeu qu'on tape.
ok('la poussee suit la note, et le rate n\'en recoit rien',
   POUSSEE_APPEL.parfait > POUSSEE_APPEL.bon && POUSSEE_APPEL.bon > 0
   && POUSSEE_APPEL.plane === 0 && POUSSEE_APPEL.hache === 0,
   JSON.stringify(POUSSEE_APPEL));

for (const cle of ['100h', '110h', '400h']) {
  const bonne = courir(cle, { cadence: 10, cible: JUSTE(cle), voyage: 0.16, jambe: 'bonne' });
  const mauvaise = courir(cle, { cadence: 10, cible: JUSTE(cle), voyage: 0.16, jambe: 'mauvaise' });
  ok(`${cle} : la mauvaise jambe ne recoit aucune poussee`,
     mauvaise.temps > bonne.temps + 0.3,
     `${mauvaise.temps?.toFixed(2)} contre ${bonne.temps?.toFixed(2)}`);
}

// LA CADENCE RESTE LE COEUR DU JEU. C'est la borne haute de la poussee : trop
// genereuse, elle devient le levier principal et Sprinter disparait sous ses
// haies. Au balayage, 1,30 faisait gagner trois secondes a un joueur lent.
for (const cle of ['100h', '110h', '400h']) {
  const lent = courir(cle, { cadence: 8, cible: JUSTE(cle), voyage: 0.16 });
  const vif = courir(cle, { cadence: 12, cible: JUSTE(cle), voyage: 0.16 });
  ok(`${cle} : de 8 a 12 frappes/s, la cadence pese encore lourd`,
     lent.temps - vif.temps > 1.0,
     `${(lent.temps - vif.temps).toFixed(2)} s entre les deux`);
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
