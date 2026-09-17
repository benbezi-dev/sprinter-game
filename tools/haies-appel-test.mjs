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
import { APPEL, TOLERANCE, TOLERANCE_T, APPEL_MINI } from '../src/game/haies-jeu.js';
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
 */
function courir(cle, {
  cadence, cible = null, jambe = 'bonne', enVolAussi = false, mitraille = false,
  dureeMax = 120, bruit = 0, graine = 1,
} = {}) {
  const race = HAIES[cle];
  const track = new Track(race);
  const r = new Runner('TOI', 3, {
    isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total,
  });
  const course = nouvelleCourse(cle, { appelJoueur: true });
  preparerCoureur(course, r);
  const dt = 1 / 60;

  let t = 0, fin = null, prochainTap = 0, gauche = true;
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
      else r.press(gauche ? 'left' : 'right', t);
      gauche = !gauche;
      prochainTap += 1 / (cadence * (1 + (alea() * 2 - 1) * bruit));
    }

    // L'APPEL. On note aussi ce que la touche annoncait, image par image :
    // c'est ce qui permet de verifier qu'elle ne change pas sous le pouce.
    const a = approche(course);
    if (a) {
      annonces.push({ haie: a.haie, cote: a.cote });
      const reste = course.positions[course.i] - r.d;
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
  return { temps: fin, journal, chutes, annonces, course, r };
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
