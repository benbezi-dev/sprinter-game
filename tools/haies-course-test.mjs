// Les haies posees sur le VRAI moteur, et non sur un modele qui lui ressemble.
//
// Les deux harnais precedents verifient le reglement et les regles du jeu, mais
// ni l'un ni l'autre ne fait courir un athlete. Or la charniere repose sur un
// pari precis : que `stride`, le compteur de foulee du moteur, avance bien de
// PI par appui et puisse donc servir a compter les appuis entre deux haies.
//
// Si ce pari est faux, tout tient encore debout a la lecture et rien ne marche
// a l'ecran — le joueur verrait son athlete poser le pied a un endroit et la
// haie jugee a un autre. C'est exactement le genre de defaut qu'on ne trouve
// qu'en faisant tourner la chose.

import '../src/game/sprinter-core.js';
import { HAIES, PLATEAUX, positionsDes, APPUIS_IDEAL } from '../src/game/haies.js';
import { APPEL, REGLE, volDe, franchir, rythmeDe } from '../src/game/haies-jeu.js';

const { Track, Runner } = globalThis.SprinterCore;

const CLES = ['100h', '110h', '400h'];
const NIVEAUX = ['scolaire', 'regional', 'national', 'mondial', 'olympique', 'ZEZE'];

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/**
 * Une course de haies jouee par un automate qui tape a cadence constante.
 *
 * La logique de franchissement est celle de haies-course.js, recopiee ici sur
 * un coureur nu : le module vrai se pose sur SprinterApp, que Node n'a pas.
 * Ce qui est teste — la lecture de `stride`, le dernier appui avant la haie,
 * le rythme — est identique ligne pour ligne.
 */
function courir(cle, { cadence, dureeMax = 90 }) {
  const race = HAIES[cle];
  const track = new Track(race);
  const r = new Runner('TOI', 3, {
    isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total,
  });
  const positions = positionsDes(cle);
  const pas = 1 / 240;

  let t = 0, i = 0, appuiN = -1, appuiD = 0, depuis = 0, auSol = 0;
  let precedent, piedPrec = null, cle_ = 0;
  const journal = [];
  let prochainTap = 0, gauche = true;

  r.reaction = 0.15;
  // Le pied de depart est choisi, comme dans le jeu : sans cela la phase de
  // foulee est tiree au sort et deux courses identiques ne se ressemblent pas.
  r.stride = 0; r.lastStep = 0;
  while (t < dureeMax && i <= positions.length && r.d < track.total) {
    // Le joueur tape : touches alternees, a cadence reguliere.
    while (prochainTap <= t) {
      r.press(gauche ? 'a' : 'z', t);
      gauche = !gauche;
      prochainTap += 1 / cadence;
    }
    r.stepPlayer(pas, t);
    t += pas;

    const n = Math.floor(r.stride / Math.PI);
    // Pas d'appui en l'air, et l'appel se decide a l'appui : si le prochain
    // tomberait au-dela de la haie, c'est d'ici qu'on part.
    if (n !== appuiN && !(r.freeze > 0)) {
      appuiN = n; appuiD = r.d; depuis++; auSol++;

    if (i < positions.length && r.d + r.strideLength() >= positions[i]) {
      const avant = Math.max(0, positions[i] - r.d);
      const appuis = depuis, pied = n % 2;
      const ry = rythmeDe(cle, appuis, precedent);
      const tenu = REGLE[cle] === 'parite'
        ? (piedPrec === null || pied === piedPrec) : ry.tenu;
      const p = franchir(cle, r.v, avant, tenu);
      r.v = p.v;
      r.freeze = volDe(cle, r.v);
      r.lastKey = null;
      journal.push({ haie: i + 1, appuis, avant: +avant.toFixed(2), note: p.note, tenu, v: +r.v.toFixed(2) });
      precedent = appuis; piedPrec = pied; depuis = 0; i++;
    }
    }
    if (r.d >= track.total && !cle_) cle_ = t;
  }
  return { temps: cle_ || null, journal, r, track, appuisAuSol: auSol };
}

titre('LE MOTEUR COMPTE BIEN UN APPUI PAR DEMI-TOUR DE FOULEE');

// La lecture qui porte toute la charniere. Un sprinteur d'elite pose le pied
// 41 a 48 fois sur 100 m — c'est le repere que le moteur se donne a lui-meme,
// en commentaire, au-dessus de strideLength().
{
  const c = courir('110h', { cadence: 9.5 });
  const parMetre = c.appuisAuSol / c.r.d;
  ok(`110 m parcourus en ${c.appuisAuSol} appuis au sol`,
     parMetre > 0.38 && parMetre < 0.58,
     `${(1 / parMetre).toFixed(2)} m par appui — hors de la fourchette humaine`);
}

titre('UNE COURSE DE HAIES SE COURT');

for (const cle of CLES) {
  const c = courir(cle, { cadence: 9.5 });
  const total = cle === '400h' ? 400 : HAIES[cle].straight;
  ok(`${cle} : la ligne est franchie`, c.temps !== null,
     `arrete a ${c.r.d.toFixed(1)} m sur ${total}`);
  ok(`${cle} : les dix haies sont jugees`, c.journal.length === 10,
     `${c.journal.length} jugees`);
  // Un jeu correct mais pas parfait ne doit pas battre les surhommes.
  ok(`${cle} : a cadence moyenne on ne descend pas sous les ZEZE`,
     c.temps > PLATEAUX[cle][5][0],
     `${c.temps && c.temps.toFixed(2)} s alors que les ZEZE plafonnent a ${PLATEAUX[cle][5][0]}`);
}

titre('LE JUGEMENT PORTE SUR UN APPUI REEL');

// L'appel juge doit tomber devant la haie, jamais derriere, et jamais plus
// loin qu'une foulee : au-dela, c'est qu'on a saute un appui a la lecture.
for (const cle of ['110h', '400h']) {
  const c = courir(cle, { cadence: 9.5 });
  const mauvais = c.journal.filter(j => j.avant < 0 || j.avant > 3.2);
  ok(`${cle} : chaque appel tombe a moins de 3,2 m devant la haie`,
     mauvais.length === 0,
     mauvais.map(j => `haie ${j.haie} a ${j.avant} m`).join(', '));

  const sansAppui = c.journal.filter(j => j.appuis < 2);
  ok(`${cle} : aucun intervalle ne se passe d appui`, sansAppui.length === 0,
     sansAppui.map(j => `haie ${j.haie}`).join(', '));
}

titre('TAPER PLUS VITE FAIT COURIR PLUS VITE');

// La propriete que le joueur sentira avant toutes les autres.
//
// Elle ne peut pas etre exigee au centieme pres, et c'est une consequence
// assumee de la regle : franchir la frontiere entre quatre et cinq appuis fait
// basculer le pied d'appel, ce qui coute. Autour de cette frontiere le chrono
// hesite. C'est le mecanisme, pas un defaut.
//
// Ce qui serait un defaut, c'est qu'un VRAI gain d'effort ne paie pas. On
// exige donc les deux : qu'un point entier de cadence rende toujours du
// chrono, et que l'hesitation locale reste petite. La distinction compte —
// c'est exactement ce qui separait le cas sain du cas casse sur le tour, ou
// accelerer degradait le rythme sur toute une plage avant de le reparer.
for (const cle of CLES) {
  const T = {};
  for (let c = 5; c <= 13; c += 0.25) {
    const t = courir(cle, { cadence: c }).temps;
    if (t !== null) T[c.toFixed(2)] = t;
  }
  const cs = Object.keys(T).map(Number).sort((x, y) => x - y);

  // Un point entier de cadence doit payer — tant qu'il reste quelque chose a
  // gagner. Tout en haut de la plage le coureur est a son plafond de vitesse :
  // taper plus vite ne peut plus rien rendre, et la frontiere du rythme fait
  // alors hesiter le chrono de quelques centiemes. On borne cette hesitation
  // au lieu d'exiger un gain qui n'existe plus.
  //
  // Le seuil separe les deux cas rencontres : les vrais defauts valaient 0,12
  // a 0,53 seconde et couvraient la plage utile ; la saturation vaut trois
  // centiemes tout en haut.
  let perte = 0, ouPerte = '';
  for (const c of cs) {
    const k = (c + 1).toFixed(2);
    if (T[k] === undefined) continue;
    const d = T[k] - T[c.toFixed(2)];
    if (d > perte) { perte = d; ouPerte = `de ${c} a ${c + 1} appuis/s`; }
  }
  ok(`${cle} : un point entier de cadence ne fait jamais perdre de chrono`,
     perte < 0.05, `${perte.toFixed(2)} s perdues ${ouPerte}`);

  let recul = 0, ou = '';
  for (let i = 1; i < cs.length; i++) {
    const d = T[cs[i].toFixed(2)] - T[cs[i - 1].toFixed(2)];
    if (d > recul) { recul = d; ou = `a ${cs[i]} appuis/s`; }
  }
  ok(`${cle} : l hesitation a la frontiere reste sous une demi-seconde`,
     recul < 0.5, `${recul.toFixed(2)} s ${ou}`);
}

titre('CHAQUE PLATEAU SE GAGNE A UNE CADENCE DE DOIGT');

// La verification qui compte le plus pour le joueur, et la seule qui ne peut
// pas se faire sur un modele : y a-t-il, pour chaque niveau, une cadence de
// doigt qui l'atteint ? Un plateau qu'aucune facon de jouer ne touche est un
// plateau mort.
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

titre('LE RYTHME SE TIENT QUAND ON COURT VITE');

// La promesse du jeu : a pleine vitesse on trouve le rythme de l'epreuve, et
// on le garde. Si le nombre d'appuis vise n'est jamais atteint en jouant bien,
// la cible affichee au joueur serait decorative.
for (const cle of ['100h', '110h']) {
  const c = courir(cle, { cadence: 12 });
  const vise = c.journal.filter(j => j.appuis === APPUIS_IDEAL[cle]).length;
  ok(`${cle} : a pleine cadence, le rythme vise sort au moins six fois sur dix`,
     vise >= 6, `${vise}/10 intervalles a ${APPUIS_IDEAL[cle]} appuis`);
  const tenus = c.journal.filter(j => j.tenu).length;
  ok(`${cle} : et le rythme tient au moins sept haies sur dix`, tenus >= 7,
     `${tenus}/10`);
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

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
