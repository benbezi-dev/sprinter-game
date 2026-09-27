// LE SON DE LA BETE, verifie sans contexte audio.
//
// Un mix se regle a l'oreille. Ses COURBES, elles, se verifient — et c'est
// tout l'interet d'avoir sorti la loi du cablage (halloween-son-loi.js n'a
// aucun import, et se charge donc nu sous node).
//
// CE QUE CE HARNAIS PROTEGE, dans l'ordre d'importance :
//
//   1. LE PLAFOND. Aucune source ne depasse le niveau d'un bruitage ordinaire
//      du jeu, sur toute la plage d'ecarts. C'est la traduction chiffree de la
//      regle du brief — jamais de pic brutal au-dessus du mix — et la seule
//      facon de la tenir est de la mesurer. Un jour ou l'autre quelqu'un
//      remontera un gain « juste un peu » pour l'entendre mieux dans son
//      casque ; ce fichier lui repondra.
//
//   2. LA CONTINUITE. Aucune courbe ne saute. Un gain discontinu s'entend
//      comme un clic, et un clic dans un son d'ambiance devient la seule chose
//      qu'on entend.
//
//   3. LA PORTEE. Rien ne s'entend au-dela de douze metres — la meme distance
//      que la jauge du HUD et que le tremblement du sol. Trois expressions
//      d'une seule regle, et le joueur qui apprend l'une apprend les trois.
//
//   4. LE STINGER. Il tombe dans la fenetre voulue, quel que soit le tirage,
//      sur les treize nuits.
//
//   node tools/halloween-son-test.mjs

import {
  PLAFOND, PORTEE, SEUIL_COEUR, SILENCE,
  proximite, grondement, coupure, foulee, secondesDeBete, coeur,
  stinger, attenue,
} from '../src/game/halloween-son-loi.js';
import { NUITS } from '../src/game/halloween-loi.js';

let fautes = 0;
const ok = (n, c, d) => {
  console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`);
  if (!c) fautes++;
};
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 56 - t.length))}`);

/** Balaye les ecarts de -2 m (la bete a double) a 30 m, au centimetre. */
function balayage(f) {
  const v = [];
  for (let e = -200; e <= 3000; e++) v.push({ e: e / 100, v: f(e / 100) });
  return v;
}

// ---------------------------------------------------------------------------
titre('LE PLAFOND — rien ne passe au-dessus du mix');
// ---------------------------------------------------------------------------
{
  const pics = [
    ['le grondement', balayage(grondement)],
    ['la foulee lourde', balayage(e => foulee(e, true))],
    ['la foulee legere', balayage(e => foulee(e, false))],
  ];
  for (const [nom, courbe] of pics) {
    const max = Math.max(...courbe.map(p => p.v));
    ok(`${nom} reste sous le plafond`, max <= PLAFOND + 1e-9,
       `${max.toFixed(4)} > ${PLAFOND}`);
    ok(`${nom} ne descend jamais sous zero`,
       courbe.every(p => p.v >= 0),
       'une valeur negative inverserait la phase');
  }

  // Le coeur se mesure en secondes, pas en metres.
  let maxCoeur = 0;
  for (let s = 0; s <= 300; s++) {
    const c = coeur(s / 100);
    if (c) maxCoeur = Math.max(maxCoeur, c.gain);
  }
  ok('le coeur reste sous le plafond', maxCoeur <= PLAFOND + 1e-9,
     `${maxCoeur.toFixed(4)}`);

  // LE CUMUL, qui est le vrai risque : trois sources a leur maximum au meme
  // instant. C'est ce qui arrive a la derniere seconde d'une nuit perdue.
  const cumul = grondement(0) + foulee(0, true) + (coeur(0) || { gain: 0 }).gain;
  ok('les trois sources cumulees tiennent dans la marge', cumul <= 1,
     `${cumul.toFixed(3)} — ca ecreterait`);
}

// ---------------------------------------------------------------------------
titre('LA PORTEE — rien ne s\'entend de trop loin');
// ---------------------------------------------------------------------------
{
  ok('le grondement est muet a la portee', grondement(PORTEE) === 0);
  ok('les foulees sont muettes a la portee',
     foulee(PORTEE, true) === 0 && foulee(PORTEE, false) === 0);
  ok('et au-dela aussi',
     grondement(PORTEE + 5) === 0 && foulee(PORTEE + 5, true) === 0);
  ok('la proximite vaut 1 quand la bete est au contact', proximite(0) === 1);
  ok('elle ne depasse pas 1 quand la bete a double', proximite(-4) === 1,
     'un gain au-dela de 1 ecreterait');

  // LE CREUX DU DEBUT, qui est la raison d'etre du carre. A onze metres — le
  // premier metre de la portee — la bete doit etre pratiquement inaudible.
  ok('a onze metres, le grondement est encore negligeable',
     grondement(11) < 0.005, `${grondement(11).toFixed(4)}`);
  ok('mais a trois metres il est franc',
     grondement(3) > 0.10, `${grondement(3).toFixed(4)}`);
}

// ---------------------------------------------------------------------------
titre('LA CONTINUITE — aucune courbe ne claque');
// ---------------------------------------------------------------------------
{
  const continue_ = (nom, courbe, seuil) => {
    let pire = 0, ou = 0;
    for (let i = 1; i < courbe.length; i++) {
      const d = Math.abs(courbe[i].v - courbe[i - 1].v);
      if (d > pire) { pire = d; ou = courbe[i].e; }
    }
    ok(`${nom} est continue`, pire <= seuil,
       `saut de ${pire.toFixed(5)} a ${ou.toFixed(2)} m`);
  };
  // Un centimetre d'ecart ne doit jamais changer un gain de plus d'un millieme.
  continue_('le grondement', balayage(grondement), 0.001);
  continue_('la foulee lourde', balayage(e => foulee(e, true)), 0.002);
  // La coupure se compte en hertz : cinquante hertz par centimetre est deja
  // bien au-dela de ce que l'oreille suit.
  continue_('la coupure du filtre', balayage(coupure), 50);
}

// ---------------------------------------------------------------------------
titre('LA COUPURE — c\'est elle qui dit la distance');
// ---------------------------------------------------------------------------
{
  ok('elle monte quand la bete approche',
     coupure(12) < coupure(6) && coupure(6) < coupure(0));
  ok('loin, elle etouffe tout ce qui est aigu', coupure(PORTEE) <= 260,
     `${coupure(PORTEE) | 0} Hz`);
  ok('au contact, les griffes passent', coupure(0) >= 5000,
     `${coupure(0) | 0} Hz`);
  // La progression geometrique : a mi-portee on doit etre bien en dessous de
  // la moyenne arithmetique des deux bornes, sinon la bete serait deja claire
  // a six metres et n'aurait plus rien a reveler en approchant.
  const moyenne = (coupure(0) + coupure(PORTEE)) / 2;
  ok('a mi-portee elle est encore sourde', coupure(6) < moyenne * 0.6,
     `${coupure(6) | 0} Hz contre ${moyenne | 0} Hz`);
}

// ---------------------------------------------------------------------------
titre('LE COEUR — il ne part pas au coup de pistolet');
// ---------------------------------------------------------------------------
{
  // Au depart la bete est couchee derriere la ligne : vitesse nulle.
  ok('a l\'arret, la bete est a une distance infinie',
     secondesDeBete(14, 0) === Infinity);
  ok('et le coeur ne bat donc pas', coeur(secondesDeBete(14, 0)) === null);

  ok('au-dessus du seuil, rien', coeur(SEUIL_COEUR) === null
     && coeur(SEUIL_COEUR + 0.01) === null);
  ok('juste sous le seuil, il commence', coeur(SEUIL_COEUR - 0.01) !== null);

  const bas = coeur(SEUIL_COEUR - 0.01);
  const haut = coeur(0);
  ok('il demarre a un tempo de repos', bas.bpm < 95, `${bas.bpm.toFixed(0)} bpm`);
  ok('il finit a un tempo de fin de course',
     haut.bpm > 160 && haut.bpm < 190, `${haut.bpm.toFixed(0)} bpm`);
  ok('il demarre discret', bas.gain < 0.05, `${bas.gain.toFixed(4)}`);

  // Le tempo ne doit jamais redescendre quand la bete se rapproche.
  let monotone = true, avant = 0;
  for (let s = 150; s >= 0; s--) {
    const c = coeur(s / 100);
    if (!c) continue;
    if (c.bpm < avant - 1e-9) monotone = false;
    avant = c.bpm;
  }
  ok('son tempo ne redescend jamais quand elle approche', monotone);

  // Les secondes, pas les metres : c'est tout l'argument de secondesDeBete.
  const lente = secondesDeBete(8, 4);
  const rapide = secondesDeBete(8, 12);
  ok('huit metres devant une bete lancee, c\'est sous le seuil',
     rapide < SEUIL_COEUR, `${rapide.toFixed(2)} s`);
  ok('huit metres devant une bete qui demarre, c\'est au-dessus',
     lente > SEUIL_COEUR, `${lente.toFixed(2)} s`);
}

// ---------------------------------------------------------------------------
titre('LE STINGER — dans la fenetre, sur les treize nuits');
// ---------------------------------------------------------------------------
{
  let hors = 0, pireBas = 1, pireHaut = 0;
  for (const nuit of NUITS) {
    for (let k = 0; k < 1000; k++) {
      const t = stinger(nuit.imparti, k / 1000);
      const part = t / nuit.imparti;
      pireBas = Math.min(pireBas, part);
      pireHaut = Math.max(pireHaut, part);
      if (part < 0.25 - 1e-9 || part > 0.75 + 1e-9) hors++;
    }
  }
  ok('il tombe toujours entre le quart et les trois quarts', hors === 0,
     `${hors} placements hors fenetre`);
  ok('la fenetre est bien exploitee de bout en bout',
     pireBas < 0.26 && pireHaut > 0.74,
     `de ${(pireBas * 100).toFixed(1)} % a ${(pireHaut * 100).toFixed(1)} %`);

  // LES BORNES SONT PAYEES, et se verifient en secondes sur la nuit la plus
  // courte : le silence qui precede doit tenir apres le depart.
  const courte = NUITS.reduce((a, b) => a.imparti < b.imparti ? a : b);
  const tot = stinger(courte.imparti, 0);
  ok('meme sur la nuit la plus courte, le silence tient apres le depart',
     tot - SILENCE > 0.5,
     `${courte.nom[0]} — silence a ${(tot - SILENCE).toFixed(2)} s`);

  // Deux nuits de meme duree tirees au meme endroit donneraient le meme
  // instant : c'est le tirage qui garantit qu'on ne le revoit pas deux fois.
  const a = stinger(10, 0.3), b = stinger(10, 0.7);
  ok('deux tirages differents donnent deux instants differents', a !== b,
     'un stinger previsible cesse d\'etre un stinger');
}

// ---------------------------------------------------------------------------
titre('LA FRAYEUR REDUITE — elle attenue, elle ne coupe pas');
// ---------------------------------------------------------------------------
{
  const g = grondement(2);
  ok('le grondement reste audible', attenue(g, true, false) > g * 0.5,
     'un mode muet n\'est pas un mode confortable');
  ok('mais il baisse', attenue(g, true, false) < g);
  ok('le stinger baisse beaucoup plus que le reste',
     attenue(1, true, true) < attenue(1, true, false) * 0.5);
  ok('sans l\'option, rien ne change',
     attenue(g, false, false) === g && attenue(1, false, true) === 1);
  ok('ce qui porte l\'information survit a l\'option',
     attenue(foulee(1, true), true, false) > 0,
     'sans les foulees, le joueur ne sait plus ou est le chien');
}

console.log(fautes ? `\n${fautes} verification(s) en echec\n`
                   : '\nTout passe.\n');
process.exit(fautes ? 1 : 0);
