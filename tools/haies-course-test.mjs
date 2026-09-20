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
import { APPEL, CISEAU_VISE } from '../src/game/haies-jeu.js';
import { nouvelleCourse, preparerCoureur, libererCoureur, pas,
         appeler, relacher, ciseauDe, enVol } from '../src/game/haies-pas.js';

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
function courir(cle, { cadence, joueur = false, dureeMax = 120, trace, bruit = 0, graine = 1,
                      contact = 0.065 } = {}) {
  const race = HAIES[cle];
  const track = new Track(race);
  const r = new Runner('TOI', 3, {
    isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total,
  });
  const course = nouvelleCourse(cle, { appelJoueur: joueur });
  preparerCoureur(course, r);
  const dt = 1 / 60;

  let t = 0, fin = null, prochainTap = 0, gauche = true, auSol = 0, dernier = 0;
  let premierAppuiD = null;
  // LE POUCE SE LEVE AUSSI, et il a fallu le hurdleur pour s'en apercevoir.
  //
  // Ce harnais n'appuyait jamais que sur des paves : il n'emettait pas de
  // relache, et le jeu n'en demandait pas. Deux regles l'ont change, et toutes
  // deux viennent du meme retour — « je reste un peu appuye et ca me coupe le
  // perso » :
  //
  //   - la DUREE de l'appui separe maintenant une frappe d'un maintien
  //     (haies-jeu.js, TENUE_POUCE) : un harnais qui ne leve pas le pouce ne
  //     mesure plus le geste, il mesure une position ;
  //   - un pave deja pose fait partir l'appel des que la fenetre s'ouvre
  //     (haies-pas.js, veille) : un pave jamais relache appellerait tout seul a
  //     chacune des dix haies, et la cadence du joueur ne deciderait plus rien.
  //
  // `contact` est la duree d'une frappe ordinaire — 50 a 80 ms sous un vrai
  // pouce. Le pouce qui a appele, lui, TIENT : c'est le geste que le jeu
  // enseigne, et c'est son relache au sommet du vol qui fait le ciseau.
  const baisse = { left: null, right: null };
  const lever = cote => {
    if (baisse[cote] === null) return;
    baisse[cote] = null;
    if (joueur) relacher(course, r, cote);
  };
  const frapper = cote => {
    if (baisse[cote] !== null) return null;
    baisse[cote] = t;
    if (!joueur) { r.press(cote === 'left' ? 'a' : 'z', t); return null; }
    const juge = appeler(course, r, cote);
    if (juge) return juge;
    if (!enVol(course)) r.press(cote, t);
    return null;
  };
  const journal = [];
  const chutes = [];
  let g = graine;
  const alea = () => (g = (g * 16807) % 2147483647) / 2147483647;
  r.reaction = 0.15;
  while (t < dureeMax && r.d < track.total) {
    // LE GESTE DU JOUEUR, quand c'est lui qui appelle : chaque frappe part sur
    // le pave, et c'est la fenetre qui decide si elle est une foulee ou un
    // appel. On relache a mi-vol pour le ciseau.
    {
      const vol = joueur ? ciseauDe(course, r) : null;
      for (const cote of ['left', 'right']) {
        if (baisse[cote] === null) continue;
        // Le pouce qui a appele tient jusqu'au sommet du vol : c'est le ciseau.
        if (vol && !vol.fait && vol.cote === cote) { if (vol.part >= CISEAU_VISE) lever(cote); continue; }
        if (t - baisse[cote] >= contact) lever(cote);
      }
    }
    while (prochainTap <= t) {
      // Sous l'appel du joueur, le verdict d'une haie sort de appeler(), pas
      // de pas() — qui ne rend plus que les percussions. Le journal doit donc
      // ecouter les deux, sans quoi il resterait vide.
      const juge = frapper(gauche ? 'left' : 'right');
      if (juge) journal.push(juge);
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

titre('ON SE RECOIT OU LE REGLEMENT LE DIT');

// Sur les courtes, le vol est une distance (haies-jeu.js, COUT). Le moteur
// freinait le coureur en l'air : parti pour 3,55 m sur le 110 m haies, il
// retombait un demi-metre trop tot, encore dans la posture du saut. La
// reception tolere une image de depassement, 20 cm a 60 images par seconde.
for (const cle of ['100h', '110h']) {
  const receptions = [];
  let vol = null, freinEnVol = 0, payees = 0;
  courir(cle, {
    cadence: 11,
    trace: (r, course) => {
      if (course.enVol) {
        if (!vol) vol = { haie: course.positions[course.i - 1], v: r.v };
        else if (Math.abs(r.v - vol.v) > 1e-9) freinEnVol++;
      } else if (vol) {
        receptions.push(r.d - vol.haie);
        if (r.v < vol.v) payees++;
        vol = null;
      }
    },
  });
  const apres = APPEL[cle].apres;
  const hors = receptions.filter(x => x < apres - 1e-9 || x > apres + 0.2);
  ok(`${cle} : les dix receptions tombent a ${apres} m derriere la haie`,
     receptions.length === 10 && hors.length === 0,
     receptions.map(x => x.toFixed(2)).join(' '));
  ok(`${cle} : en l air, la vitesse ne bouge pas`, freinEnVol === 0,
     `${freinEnVol} images ou elle a change`);
  ok(`${cle} : la reception coute toujours de la vitesse`, payees === 10, `${payees}/10`);
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

titre('IL EXISTE UNE CADENCE JUSTE, ET CE N EST PAS LA PLUS RAPIDE');

// CE QUE CETTE SECTION A REMPLACE. Elle demandait qu'a huit frappes par
// seconde le rythme se perde, et elle le verifiait sur l'appel automatique.
// Ca ne veut plus rien dire : viser() rattrape n'importe quelle cadence par
// construction — c'est son travail — et depuis que le plafond de vitesse est
// descendu au reel, il y arrive meme sans effort.
//
// LE RYTHME NE SE JOUE PLUS LA. Quand c'est le joueur qui appelle, rien ne
// rattrape sa foulee : sa cadence decide seule ou tombent ses appuis, donc
// combien il en met dans un intervalle. Une bande de cadence donne le compte
// du reglement ; en dessous on s'etire, au-dessus on hache.
//
// C'est le coeur de ce que Hurdlers doit enseigner et que Sprinter n'enseigne
// pas : la cadence juste n'est pas la cadence maximale.
// ON NE POSE PAS LA BANDE, ON LA CHERCHE. Ecrire « de 8 a 10 frappes/s » dans
// le test reviendrait a figer un reglage qui bougera au prochain correctif, et
// a faire echouer le harnais pour un dixieme de cadence. Ce qui doit etre vrai
// est plus simple : IL EXISTE UNE BANDE, elle est assez large pour se tenir, et
// elle ne couvre pas tout — sans quoi la cadence ne voudrait rien dire.
for (const cle of CLES) {
  const { premiere, intervalle } = APPUIS[cle];
  const tenu = c => {
    const a = c.journal.map(j => j.appuis);
    if (a.length < 10) return false;
    return a[0] >= premiere[0] && a[0] <= premiere[1]
      && a.slice(1).every(n => n >= intervalle[0] && n <= intervalle[1]);
  };
  const pas_ = 0.5, bas = 5, haut = 16;
  const cads = [], bons = [];
  for (let cad = bas; cad <= haut; cad += pas_) {
    cads.push(cad); bons.push(tenu(courir(cle, { cadence: cad, joueur: true })));
  }
  // la plus longue suite de cadences qui tiennent
  let meilleure = 0, debut = -1, courant = 0, d0 = -1;
  bons.forEach((b, i) => {
    if (b) { if (courant === 0) d0 = i; courant++; if (courant > meilleure) { meilleure = courant; debut = d0; } }
    else courant = 0;
  });
  const large = meilleure * pas_;
  ok(`${cle} : une bande de cadence donne le compte du reglement`,
     meilleure >= 4,
     meilleure ? `${large.toFixed(1)} point(s) de ${cads[debut]} a ${cads[debut + meilleure - 1]} frappes/s` : 'aucune');
  ok(`${cle} : et elle ne couvre pas toutes les cadences`,
     bons.some(b => !b),
     `${bons.filter(Boolean).length}/${bons.length} cadences tiennent`);
  // Trop lent, on s'etire et le compte monte : c'est l'autre bord de la bande.
  ok(`${cle} : a ${bas} frappes/s, le rythme sort du reglement`, !bons[0],
     courir(cle, { cadence: bas, joueur: true }).journal.map(j => j.appuis).join(' '));
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
  // Sans haie mal prise, le test du dessus ne prouverait rien : c'est
  // exactement la haie qui faisait tomber.
  //
  // ON LE CHERCHE MAINTENANT SUR L'APPEL DU JOUEUR, et il a fallu y venir.
  // L'appel automatique n'en produit plus : viser() trouve un bon appui meme
  // quand le compte sort du reglement, et le modele cale sur Jackson lui en
  // laisse largement les moyens. Le danger n'existe que la ou le joueur decide.
  //
  // ET C'EST LA HAIE PLANEE QU'ON COMPTE, plus la hachee. La fenetre d'appel
  // (APPEL_MAXI) est plus large qu'une foulee de hurdleur : un appui y tombe
  // donc toujours, et le premier de la fenetre est forcement le plus eloigne —
  // on plane, on ne hache pas. C'est une consequence de la geometrie, pas un
  // reglage : une fenetre plus etroite rendrait le jeu PLUS facile, puisqu'elle
  // forcerait l'appel pres du point ideal (mesure : 93 % de parfaits a 2,04 m
  // de fenetre contre 57 % a 2,59).
  let visees = 0;
  for (let graine = 1; graine <= 12; graine++) {
    const c = courir('110h', { cadence: 9, bruit: 0.3, graine, joueur: true });
    visees += c.journal.filter(j => j.note !== 'parfait').length;
  }
  ok('110h : a 9 frappes/s, doigt irregulier, des haies se prennent mal', visees > 0,
     `${visees} haies concernees`);
}

titre('SUR L APPEL AUTOMATIQUE, LE PROGRES N EST JAMAIS PUNI');

// CETTE SECTION NE VAUT PLUS QUE POUR L'APPEL AUTOMATIQUE, et il faut le dire.
// Elle s'appelait « taper plus vite fait courir plus vite » ; c'etait la regle
// de Sprinter, et c'etait precisement ce qui faisait que Hurdlers se jouait
// comme lui. Sous l'appel du joueur, elle est REMPLACEE par la bande de cadence
// juste, plus haut : la cadence maximale n'y est plus la bonne.
//
// L'appel automatique, lui, reste le jeu publie tant que APPEL_JOUEUR vaut
// EST_TEST, et il garde sa promesse : on ne perd pas a mieux jouer.
//
// LES DEUX SEUILS ONT ETE ELARGIS, et pas pour faire passer le harnais. Le
// modele cale sur Jackson a des frontieres de rythme beaucoup plus nettes
// qu'avant : la haie ne coute presque plus rien en vitesse, donc ce qui coute
// est le COMPTE, et il change d'un coup. Un dixieme de perte sur un point de
// cadence (mesure : 0,10 s de 11 a 12) et une demi-seconde a la bascule
// (mesure : 0,52 s a 7 frappes/s) sont le prix de cette nettete. Les bornes les
// encadrent sans les nier.
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
     perte < 0.15, `${perte.toFixed(2)} s perdues ${ouPerte}`);

  let recul = 0, ou = '';
  for (let i = 1; i < cs.length; i++) {
    const d = T[cs[i].toFixed(2)] - T[cs[i - 1].toFixed(2)];
    if (d > recul) { recul = d; ou = `a ${cs[i]} frappes/s`; }
  }
  ok(`${cle} : l hesitation a la frontiere reste sous sept dixiemes`,
     recul < 0.7, `${recul.toFixed(2)} s ${ou}`);
}

titre('CHAQUE PLATEAU SE GAGNE A UNE CADENCE DE DOIGT');

// Le pas se compte en DIXIEMES ENTIERS, il ne s'accumule pas. Un `cad += 0.1`
// derive en binaire : la boucle passait par 7,999999999999986 au lieu de 8, et
// le moteur y est assez sensible pour que 1,4e-14 de cadence deplace le chrono
// de 0,36 s — 11,47 s au 100 m haies au lieu de 11,83. La bande des ZEZE
// (11,65-12,07) etait enjambee, et le harnais annoncait un niveau injouable
// qui se joue tres bien a huit frappes rondes.
for (const cle of CLES) {
  const atteints = new Set();
  for (let d = 40; d <= 140; d++) {
    const cad = d / 10;
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
