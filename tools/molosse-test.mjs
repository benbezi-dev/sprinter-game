// LA NUIT DU MOLOSSE, posee sur le VRAI moteur.
//
// Deux choses se verifient ici, et la seconde est la seule qui compte
// vraiment :
//
//   1. LA PROMESSE. La bete franchit la ligne d'arrivee exactement au temps
//      imparti, et elle reste derriere un coureur qui tient ce rythme. C'est
//      tout le mode : « passer dans les temps » et « ne pas se faire
//      rattraper » doivent etre la meme condition, ecrite deux fois. Une
//      premiere version de la loi la trahissait — la bete accelerait plus
//      fort qu'un coureur au depart et mordait a deux secondes et demie un
//      joueur qui avait dix secondes au compteur.
//
//   2. L'ECHELLE. Chaque nuit doit demander au pouce un peu plus que la
//      precedente. Ce n'est pas une evidence : la courbe chrono/cadence du
//      jeu s'aplatit fortement au-dela de neuf appuis par seconde, et une
//      echelle regulierement espacee EN TEMPS donne des paliers qui se
//      confondent EN GESTE. La premiere liste, ecrite au jugement, faisait
//      tomber six nuits d'affilee a la meme cadence. C'est ce harnais qui
//      l'a dit.
//
// Le coureur est celui de sprinter-core.js, pilote par un automate qui tape a
// cadence constante et parfaitement alternee. Un vrai doigt fait moins bien ;
// c'est justement ce qu'on veut mesurer — la cadence MINIMALE qui suffit.

import '../src/game/sprinter-core.js';
import { NUITS, nuitDe, constantes, positionDe } from '../src/game/halloween-loi.js';
import { COURSES, distanceDe } from '../src/game/halloween-courses.js';

const { RACES, Track, Runner, STADES_HORS_SERIE } = globalThis.SprinterCore;

let fautes = 0;
const ok = (n, c, d) => {
  console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`);
  if (!c) fautes++;
};
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 56 - t.length))}`);

/**
 * Une nuit jouee par un automate.
 *
 * Le pas est celui de la boucle du jeu (updateLogic : 1/240 s), et non celui
 * du rendu : c'est a cette frequence-la que le moteur integre la course, et
 * un harnais qui echantillonnerait plus grossierement mesurerait un autre
 * jeu que celui qu'on publie.
 */
function courir(rang, cadence, { dureeMax = 90 } = {}) {
  const nuit = nuitDe(rang);
  // CHAQUE NUIT A SON TRACE. Le harnais courait le cent metres pour les
  // treize : depuis que la nuit 6 est une ligne droite de quatre cents, il
  // mesurait une course qui n'existe plus.
  const race = COURSES[nuit.epreuve] || RACES['100'];
  const track = new Track(race);
  const r = new Runner('TOI', 3, {
    isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total,
  });
  const { tau, vmax } = constantes(nuit.imparti, track.total);

  const dt = 1 / 240;
  let t = 0, prochain = 0, cote = 0;
  let mordu = null, ecartMini = Infinity;

  while (t < dureeMax) {
    if (!r.finished && t >= prochain) {
      r.press(cote ? 'left' : 'right', t);
      cote ^= 1;
      prochain += 1 / cadence;
    }
    t += dt;
    r.stepPlayer(dt, t);

    const d = positionDe(nuit, t, tau, vmax);
    if (!r.finished && mordu === null) {
      const ecart = r.d - d;
      if (t > 0.2) ecartMini = Math.min(ecartMini, ecart);
      if (ecart <= 0) mordu = t;
    }
    if (r.finished) break;
  }

  return {
    rang, cadence,
    passe: mordu === null && r.finished,
    chrono: r.finishTime,
    mordu,
    ecartMini: ecartMini === Infinity ? null : ecartMini,
    imparti: nuit.imparti,
  };
}

/** La plus petite cadence (par pas de 0,25) qui fait tomber cette nuit. */
function seuilDe(rang) {
  for (let c = 4; c <= 20; c += 0.25) if (courir(rang, c).passe) return c;
  return null;
}

console.log('\nLA NUIT DU MOLOSSE — le harnais\n');

// ---------------------------------------------------------------------------
titre('le stade existe, et il est ouvert');
// ---------------------------------------------------------------------------
{
  // ON LIT `STADES_HORS_SERIE` ET NON `LEVELS`, et c'est une contrainte du
  // harnais plutot qu'un choix : c'est la couche navigateur qui verse les
  // stades hors serie dans LEVELS (voir la boucle dans sprinter-app.js), et
  // ce fichier-la ne se charge pas sans DOM. La definition, elle, vit dans le
  // moteur, et c'est elle qu'on veut verifier.
  const i = STADES_HORS_SERIE.findIndex(l => l && l.cle === 'cimetiere');
  ok('le cimetiere municipal est defini', i >= 0, 'aucune entree de cle « cimetiere »');
  if (i >= 0) {
    const s = STADES_HORS_SERIE[i];
    ok('il est hors serie', !!s.horsSerie);
    ok('il part avec la version publique', !!s.ouvert);
    ok('il porte le theme d\'Halloween', s.theme === 'halloween', `theme « ${s.theme} »`);
    ok('il a un plateau a lui', !!s.plateau && !!s.plateau['100']);
    ok('il compte sept adversaires', s.names && s.names.length === 7,
       `${s.names ? s.names.length : 0} noms`);
    // L'ORDRE EST UN CONTRAT : les stades ouverts avant les fermes, sans quoi
    // l'index d'un stade ne veut pas dire la meme chose sur les deux canaux,
    // et le classement public annonce un lieu que personne n'a couru.
    ok('aucun stade ferme ne le precede',
       STADES_HORS_SERIE.slice(0, i).every(l => l.ouvert),
       'un stade du canal de test le precede dans la liste');
  }
}

// ---------------------------------------------------------------------------
titre('les treize nuits se tiennent');
// ---------------------------------------------------------------------------
{
  ok('il y en a treize', NUITS.length === 13, `${NUITS.length}`);
  ok('leurs rangs vont de 1 a 13 dans l\'ordre',
     NUITS.every((n, k) => n.n === k + 1));
  // LE TEMPS NE DESCEND PLUS, ET C'EST NORMAL DEPUIS QUE LES TRACES VARIENT :
  // la nuit 6 est une ligne droite de quatre cents metres, elle laisse donc
  // trente-neuf secondes la ou la nuit 5, un cent metres, en laissait onze.
  // Ce qui doit monter, c'est la CADENCE exigee — et c'est la section de
  // l'echelle, plus bas, qui le verifie.
  ok('chaque nuit a un trace connu',
     NUITS.every(n => !!COURSES[n.epreuve]),
     NUITS.filter(n => !COURSES[n.epreuve]).map(n => n.epreuve).join(', '));
  ok('les cinq traces sont tous employes',
     new Set(NUITS.map(n => n.epreuve)).size === Object.keys(COURSES).length);
  ok('aucune nuit ne repete le trace de la precedente',
     NUITS.every((n, k) => k === 0 || n.epreuve !== NUITS[k - 1].epreuve));
  ok('chaque nuit a un nom dans les deux langues',
     NUITS.every(n => n.nom.length === 2 && n.nom[0] && n.nom[1]));
}

// ---------------------------------------------------------------------------
titre('LA PROMESSE : la bete est sur la ligne au temps imparti');
// ---------------------------------------------------------------------------
{
  let pire = 0, pireNuit = 0;
  for (const nuit of NUITS) {
    const total = distanceDe(nuit.epreuve);
    const { tau, vmax } = constantes(nuit.imparti, total);
    const e = Math.abs(positionDe(nuit, nuit.imparti, tau, vmax) - total);
    if (e > pire) { pire = e; pireNuit = nuit.n; }
  }
  ok('a un millimetre pres, les treize nuits', pire < 0.001,
     `${pire.toFixed(4)} m d'ecart a la nuit ${pireNuit}`);

  // Elle part bien derriere, et elle ne recule jamais.
  let derriere = true, monotone = true;
  for (const nuit of NUITS) {
    const { tau, vmax } = constantes(nuit.imparti, distanceDe(nuit.epreuve));
    if (Math.abs(positionDe(nuit, 0, tau, vmax) + nuit.retard) > 1e-9) derriere = false;
    let av = -1e9;
    for (let t = 0; t <= nuit.imparti + 2; t += 0.01) {
      const d = positionDe(nuit, t, tau, vmax);
      if (d < av - 1e-9) monotone = false;
      av = d;
    }
  }
  ok('elle part exactement a `-retard` metres', derriere);
  ok('elle avance sans jamais reculer, meme apres la ligne', monotone);
}

// ---------------------------------------------------------------------------
titre('LA PROMESSE : un coureur dans les temps n\'est jamais rattrape');
// ---------------------------------------------------------------------------
{
  // C'est le defaut que la premiere loi avait, et il ne se voyait qu'ici : la
  // bete arrivait bien a l'heure, mais elle doublait en chemin un joueur qui
  // aurait franchi la ligne dans les temps. On cherche donc, pour chaque
  // nuit, la cadence minimale qui la fait tomber — et l'on verifie qu'a cette
  // cadence-la le joueur n'a PAS ete mordu avant la ligne.
  let trahie = null;
  for (const nuit of NUITS) {
    const c = seuilDe(nuit.n);
    if (c === null) { trahie = `nuit ${nuit.n} : aucune cadence ne la fait tomber`; break; }
    const r = courir(nuit.n, c);
    if (!r.passe) { trahie = `nuit ${nuit.n} a ${c}/s : mordu a ${r.mordu.toFixed(2)} s`; break; }
  }
  ok('chaque nuit se passe des que le chrono suffit, sans morsure', trahie === null, trahie);

  // Et l'inverse : un joueur trop lent EST rattrape. Sans cela la bete ne
  // serait qu'une decoration.
  const lent = courir(1, 4.5);
  ok('un joueur trop lent se fait bien rattraper', !lent.passe && lent.mordu !== null,
     'la nuit la plus large se passe a 4,5 appuis par seconde');
  const immobile = courir(1, 0.001);
  ok('un joueur qui ne part pas se fait rattraper sur la ligne de depart',
     !immobile.passe && immobile.mordu !== null && immobile.mordu < 4,
     immobile.mordu === null ? 'jamais mordu' : `mordu a ${immobile.mordu.toFixed(2)} s`);
}

// ---------------------------------------------------------------------------
titre('L\'ECHELLE : chaque nuit demande plus que la precedente');
// ---------------------------------------------------------------------------
{
  const seuils = NUITS.map(n => ({ n: n.n, imparti: n.imparti, c: seuilDe(n.n) }));
  for (const s of seuils) {
    console.log(`     nuit ${String(s.n).padStart(2)} — ${s.imparti.toFixed(2)} s`
      + `  →  ${s.c === null ? 'HORS DE PORTEE' : s.c.toFixed(2) + ' appuis/s'}`);
  }
  ok('aucune nuit n\'est hors de portee', seuils.every(s => s.c !== null));

  // MONTANTE, ET SANS PALIER EN DOUBLE. Deux nuits qui se prennent a la meme
  // cadence sont deux fois la meme nuit : le joueur en traverse une sans rien
  // changer a son geste, et la progression ne veut plus rien dire.
  let double = null, recule = null;
  for (let k = 1; k < seuils.length; k++) {
    if (seuils[k].c === null || seuils[k - 1].c === null) continue;
    if (seuils[k].c < seuils[k - 1].c) recule = `${k} → ${k + 1}`;
    if (seuils[k].c === seuils[k - 1].c) double = `nuits ${k} et ${k + 1} a ${seuils[k].c}/s`;
  }
  ok('la cadence exigee ne redescend jamais', recule === null, recule);
  ok('deux nuits ne se prennent jamais a la meme cadence', double === null, double);

  const ecart = seuils[12].c - seuils[0].c;
  ok('de la premiere a la treizieme, le geste double presque',
     ecart >= 7, `seulement ${ecart ? ecart.toFixed(2) : '?'} appuis/s d'ecart`);
}

// ---------------------------------------------------------------------------
titre('la derniere nuit reste atteignable');
// ---------------------------------------------------------------------------
{
  // Une derniere nuit imprenable n'est pas une derniere nuit, c'est un mur.
  // On la veut au niveau de la finale ZEZE de Sprinter : treize a quinze
  // appuis par seconde, ce qu'un joueur qui s'entraine atteint.
  const c = seuilDe(13);
  ok('elle se prend entre treize et seize appuis par seconde',
     c !== null && c >= 13 && c <= 16, c === null ? 'jamais' : `${c.toFixed(2)}/s`);
  // LA MARGE SE COMPTE EN SECONDES, PAS EN METRES, parce que c'est en
  // secondes que le joueur la lit : le compte a rebours est le seul nombre du
  // mode. Un dixieme de seconde d'avance a la cadence la plus haute que le
  // jeu recompense, c'est ce qu'il faut pour que la derniere nuit soit dure
  // sans etre une loterie.
  const large = courir(13, 17);
  const avance = large.passe ? nuitDe(13).imparti - large.chrono : 0;
  ok('a dix-sept appuis par seconde, il reste au moins un dixieme au compteur',
     large.passe && avance >= 0.10,
     large.passe ? `${avance.toFixed(3)} s d'avance seulement` : 'mordu');
}

console.log(fautes ? `\n${fautes} verification(s) en echec\n`
                   : '\nTout passe.\n');
process.exit(fautes ? 1 : 0);
