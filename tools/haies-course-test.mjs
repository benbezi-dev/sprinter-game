// Les haies posees sur le VRAI moteur, et non sur un modele qui lui ressemble.
//
// Les deux harnais precedents verifient le reglement et les regles du jeu, mais
// ni l'un ni l'autre ne fait courir un athlete. Celui-ci fait courir le coureur
// de sprinter-core.js avec LA logique du jeu, haies-pas.js — pas une copie :
// la copie a vecu ici, et elle aurait menti au premier correctif.
//
// C'est ici que se sont vus les trois defauts que la version actuelle corrige :
// un appui fantome au depart, des appels notes haches parce que la regle ne
// pouvait pas tomber a 2,15 m avec quatre appuis, et une foulee qui tournait en
// l'air et faisait alterner quatre et cinq appuis a cadence parfaite.

import '../src/game/sprinter-core.js';
import { HAIES, PLATEAUX, APPUIS } from '../src/game/haies.js';
import { nouvelleCourse, preparerCoureur, libererCoureur, pas } from '../src/game/haies-pas.js';

const { Track, Runner } = globalThis.SprinterCore;

const CLES = ['100h', '110h', '400h'];
const NIVEAUX = ['scolaire', 'regional', 'national', 'mondial', 'jeux mondiaux', 'ZEZE'];

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/**
 * Une course de haies jouee par un automate qui tape a cadence constante, au
 * rythme d'image du jeu (60 par seconde). `trace` recoit chaque image.
 *
 * `bruit` fait varier chaque intervalle entre deux frappes de plus ou moins
 * cette part de la cadence, comme un vrai doigt ; `graine` rend ce bruit
 * reproductible. Sans bruit, l'automate est un metronome.
 */
function courir(cle, { cadence, dureeMax = 120, trace, bruit = 0, graine = 1 } = {}) {
  const race = HAIES[cle];
  const track = new Track(race);
  const r = new Runner('TOI', 3, {
    isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total,
  });
  const course = nouvelleCourse(cle);
  preparerCoureur(course, r);
  const dt = 1 / 60;

  let t = 0, fin = null, prochainTap = 0, gauche = true, auSol = 0, dernier = 0;
  let premierAppuiD = null;
  const journal = [];
  const chutes = [];
  let g = graine;
  const alea = () => (g = (g * 16807) % 2147483647) / 2147483647;
  r.reaction = 0.15;
  while (t < dureeMax && r.d < track.total) {
    while (prochainTap <= t) {
      r.press(gauche ? 'a' : 'z', t);
      gauche = !gauche;
      prochainTap += 1 / (cadence * (1 + (alea() * 2 - 1) * bruit));
    }
    r.stepPlayer(dt, t);
    t += dt;
    const tombait = r.fallAnim > 0;
    const juge = pas(course, r);
    if (juge) journal.push(juge);
    if (juge && r.fallAnim > 0 && !tombait) chutes.push(juge);
    const n = Math.floor(r.stride / Math.PI + 1e-9);
    if (n > dernier) {
      auSol += n - dernier; dernier = n;
      if (premierAppuiD === null) premierAppuiD = r.d;
    }
    if (trace) trace(r, course);
    if (r.d >= track.total && fin === null) fin = t;
  }
  return { temps: fin, journal, chutes, r, track, appuisAuSol: auSol, premierAppuiD };
}

titre('LE MOTEUR COMPTE BIEN UN APPUI PAR DEMI-TOUR DE FOULEE');

{
  const c = courir('110h', { cadence: 11 });
  const parMetre = c.appuisAuSol / c.r.d;
  ok(`110 m parcourus en ${c.appuisAuSol} appuis au sol`,
     parMetre > 0.38 && parMetre < 0.62,
     `${(1 / parMetre).toFixed(2)} m par appui — hors de la fourchette humaine`);
  ok('pas d appui fantome : le premier pied se pose apres la ligne',
     c.premierAppuiD !== null && c.premierAppuiD > 0.3,
     `premier appui a ${c.premierAppuiD} m`);
}

titre('UNE COURSE DE HAIES SE COURT');

for (const cle of CLES) {
  const c = courir(cle, { cadence: 9.5 });
  const total = cle === '400h' ? 400 : HAIES[cle].straight;
  ok(`${cle} : la ligne est franchie`, c.temps !== null,
     `arrete a ${c.r.d.toFixed(1)} m sur ${total}`);
  ok(`${cle} : les dix haies sont jugees`, c.journal.length === 10,
     `${c.journal.length} jugees`);
  ok(`${cle} : a cadence moyenne on ne descend pas sous les ZEZE`,
     c.temps > PLATEAUX[cle][5][0],
     `${c.temps && c.temps.toFixed(2)} s alors que les ZEZE plafonnent a ${PLATEAUX[cle][5][0]}`);
}

titre('LE JUGEMENT PORTE SUR UN APPUI REEL');

for (const cle of CLES) {
  const c = courir(cle, { cadence: 9.5 });
  const mauvais = c.journal.filter(j => j.avant < 0.5 || j.avant > 3.5);
  ok(`${cle} : chaque appel tombe entre 0,5 et 3,5 m devant la haie`,
     mauvais.length === 0,
     mauvais.map(j => `haie ${j.haie} a ${j.avant} m`).join(', '));
  const sansAppui = c.journal.filter(j => j.appuis < 2);
  ok(`${cle} : aucun intervalle ne se passe d appui`, sansAppui.length === 0,
     sansAppui.map(j => `haie ${j.haie}`).join(', '));
}

titre('LA FOULEE NE TOURNE PAS EN L AIR');

{
  let bouge = 0, vols = 0, avant = null;
  courir('110h', {
    cadence: 11,
    trace: (r, course) => {
      if (course.enVol && r.freeze > 0) {
        if (avant !== null && Math.abs(r.stride - avant) > 1e-9) bouge++;
        avant = r.stride; vols++;
      } else avant = null;
    },
  });
  ok(`en vol, la phase de foulee reste celle de l appel (${vols} images de vol)`,
     vols > 100 && bouge === 0, `${bouge} images ou elle a bouge`);
}

titre('LE RYTHME DU REGLEMENT TOMBE A CADENCE SOUTENUE');

// La promesse faite au joueur : a une cadence de doigt soutenue, le compte est
// exactement celui de l'entraineur, a chaque haie.
const PLAGE = { '100h': [10, 15], '110h': [10, 14], '400h': [9, 14] };
for (const cle of CLES) {
  const [lo, hi] = PLAGE[cle];
  const { premiere, intervalle } = APPUIS[cle];
  const fautes = [];
  for (let cad = lo; cad <= hi; cad += 0.5) {
    const c = courir(cle, { cadence: cad });
    const a = c.journal.map(j => j.appuis);
    const horsPremiere = a[0] < premiere[0] || a[0] > premiere[1];
    const horsInt = a.slice(1).filter(n => n < intervalle[0] || n > intervalle[1]);
    if (horsPremiere || horsInt.length) fautes.push(`${cad}/s : ${a.join(' ')}`);
  }
  ok(`${cle} : de ${lo} a ${hi} frappes/s, ${premiere.join('-')} puis ${intervalle.join('-')} a chaque haie`,
     fautes.length === 0, fautes.join(' ; '));
}

titre('TROP LENT, LE RYTHME CASSE');

// L'autre moitie de la promesse : le rythme se gagne. S'il tombait a toute
// cadence, le compter ne servirait a rien.
for (const [cle, cad] of [['100h', 8], ['110h', 8], ['400h', 6]]) {
  const c = courir(cle, { cadence: cad });
  const rompus = c.journal.filter(j => !j.tenu).length;
  ok(`${cle} : a ${cad} frappes/s, le rythme se perd`, rompus >= 5, `${rompus}/10 rompus`);
}

titre('UNE HAIE NE FAIT PAS TOMBER LE COUREUR');

// Le joueur ne choisit ni son pied d'appel ni l'endroit ou il quitte le sol :
// c'est sa vitesse qui en decide. Une chute sur la haie tombait donc sans
// qu'il ait rien fait de travers — a neuf frappes par seconde, un doigt qui
// alternait parfaitement voyait son coureur plonger a peu pres une course sur
// deux. Seule une repetition de touche fait tomber, comme dans Sprinter ; la
// haie mal attaquee, elle, se renverse et coute sa vitesse.
for (const cle of CLES) {
  const fautes = [];
  for (let cad = 5; cad <= 14; cad += 0.5) {
    for (let graine = 1; graine <= 12; graine++) {
      const c = courir(cle, { cadence: cad, bruit: 0.3, graine });
      for (const j of c.chutes) fautes.push(`${cad}/s graine ${graine} : haie ${j.haie} ${j.note}, ${j.appuis} appuis`);
    }
  }
  ok(`${cle} : de 5 a 14 frappes/s, doigt irregulier, aucune chute sur une haie`,
     fautes.length === 0, `${fautes.length} chutes, dont ${fautes.slice(0, 3).join(' ; ')}`);
}

{
  // Sans haie hachee a rythme casse, le test du dessus ne prouverait rien :
  // c'est exactement la haie qui faisait tomber.
  let visees = 0;
  for (let graine = 1; graine <= 12; graine++) {
    const c = courir('110h', { cadence: 9, bruit: 0.3, graine });
    visees += c.journal.filter(j => j.note === 'hache' && !j.tenu).length;
  }
  ok('110h : a 9 frappes/s, des haies se hachent encore a rythme casse', visees > 0,
     `${visees} haies concernees`);
}

titre('TAPER PLUS VITE FAIT COURIR PLUS VITE');

// Un point entier de cadence doit payer tant qu'il reste quelque chose a
// gagner ; tout en haut, le coureur est a son plafond et le chrono peut
// hesiter de quelques centiemes. On borne cette hesitation.
for (const cle of CLES) {
  const T = {};
  for (let c = 5; c <= 13; c += 0.25) {
    const t = courir(cle, { cadence: c }).temps;
    if (t !== null) T[c.toFixed(2)] = t;
  }
  const cs = Object.keys(T).map(Number).sort((x, y) => x - y);
  let perte = 0, ouPerte = '';
  for (const c of cs) {
    const k = (c + 1).toFixed(2);
    if (T[k] === undefined) continue;
    const d = T[k] - T[c.toFixed(2)];
    if (d > perte) { perte = d; ouPerte = `de ${c} a ${c + 1} frappes/s`; }
  }
  ok(`${cle} : un point entier de cadence ne fait jamais perdre de chrono`,
     perte < 0.1, `${perte.toFixed(2)} s perdues ${ouPerte}`);

  let recul = 0, ou = '';
  for (let i = 1; i < cs.length; i++) {
    const d = T[cs[i].toFixed(2)] - T[cs[i - 1].toFixed(2)];
    if (d > recul) { recul = d; ou = `a ${cs[i]} frappes/s`; }
  }
  ok(`${cle} : l hesitation a la frontiere reste sous une demi-seconde`,
     recul < 0.5, `${recul.toFixed(2)} s ${ou}`);
}

titre('CHAQUE PLATEAU SE GAGNE A UNE CADENCE DE DOIGT');

for (const cle of CLES) {
  const atteints = new Set();
  for (let cad = 4; cad <= 14; cad += 0.1) {
    const t = courir(cle, { cadence: cad }).temps;
    if (t === null) continue;
    PLATEAUX[cle].forEach(([a, b], i) => { if (t >= a && t <= b) atteints.add(i); });
  }
  const morts = [0, 1, 2, 3, 4, 5].filter(i => !atteints.has(i));
  ok(`${cle} : les six plateaux se gagnent`, morts.length === 0,
     `hors de portee : ${morts.map(i => NIVEAUX[i]).join(', ')}`);
}

titre('COURIR LENTEMENT COUTE, SANS TOUT CASSER');

for (const cle of ['110h', '400h']) {
  const vite = courir(cle, { cadence: 12 });
  const lent = courir(cle, { cadence: 6.5 });
  ok(`${cle} : le lent met plus de temps`, lent.temps > vite.temps,
     `${lent.temps && lent.temps.toFixed(2)} contre ${vite.temps && vite.temps.toFixed(2)}`);
  ok(`${cle} : mais il finit la course`, lent.temps !== null);
  ok(`${cle} : et il ne met pas le double`, lent.temps < vite.temps * 2,
     `${(lent.temps / vite.temps).toFixed(2)} fois plus lent`);
}

titre('LA COURSE PLATE NE CHANGE PAS');

{
  const r = new Runner('TOI', 3, { isPlayer: true, maxSpeed: 12.435 });
  ok('un coureur neuf a la foulee du sprinteur', r.foulee === 1);
  r.v = 12;
  const plat = r.strideLength();
  r.foulee = HAIES['110h'].foulee;
  const haies = r.strideLength();
  libererCoureur(r);
  ok('liberer le coureur lui rend exactement sa foulee', r.strideLength() === plat,
     `${r.strideLength()} contre ${plat}`);
  ok('et la foulee du hurdleur est bien plus courte', haies < plat,
     `${haies.toFixed(2)} contre ${plat.toFixed(2)}`);
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
