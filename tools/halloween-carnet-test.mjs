// LE CARNET DE L'EDITION 2026 — ce qu'on garde, et ce qu'on refuse de croire.
//
// Trois choses a prouver, et la troisieme est celle qui se casse en silence :
//
//   — LA MIGRATION ne perd pas ce qui a deja ete couru. Le mode a vecu sur
//     /test avant l'edition datee ; des testeurs y ont des nuits tenues. Elles
//     se reprennent dans l'espace TESTEUR : /test est le seul a avoir ecrit
//     l'ancienne clef, et il partage son stockage avec le jeu (meme origine).
//   — LES DEUX ESPACES ne se contaminent pas. Un testeur qui finit les treize
//     nuits par le voyageur temporel ne doit pas revenir le 19 octobre avec
//     une edition deja finie — ni par l'espace testeur, ni par l'ancienne clef.
//   — LE SCEAU distingue une sauvegarde editee a la main d'une sauvegarde
//     intacte. Ce n'est pas une serrure — tout est a portee du joueur — c'est
//     un sceau : il ne resiste pas, il se voit.
//
//   node tools/halloween-carnet-test.mjs

import {
  VERSION, CLE_JOUEUR, CLE_TESTEUR, CLE_ANCIENNE,
  carnetVide, sommeDe, migrerDepuisAncien, migrer, lire, ecrire, tenir, mordre,
} from '../src/game/halloween-carnet.ts';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/** Un rangement de poche, qui remplace localStorage sous node. */
const poche = (depart = {}) => {
  const m = { ...depart };
  return { lire: k => (k in m ? m[k] : null), ecrire: (k, v) => { m[k] = v; }, tout: () => m };
};

/* ------------------------------------------------------------- migration */

titre('LA MIGRATION NE PERD PAS CE QUI A ETE COURU');

const ancien = { tenues: 5, chronos: { '1': 12.4, '3': 10.8 }, morsures: 7, vues: ['a', 'b'] };
const r1 = poche({ [CLE_ANCIENNE]: JSON.stringify(ancien) });
const l1 = lire(r1, true);
ok('un ancien carnet est repris dans l espace testeur', l1.etat === 'repris', l1.etat);
ok('les cinq nuits tenues survivent', l1.carnet.tenues === 5);
ok('les chronos survivent', l1.carnet.chronos['1'] === 12.4 && l1.carnet.chronos['3'] === 10.8);
ok('les morsures survivent', l1.carnet.morsures === 7);
ok('les cinematiques vues survivent', l1.carnet.vues.length === 2);
ok('et il porte la version courante', l1.carnet.v === VERSION);

ok('un ancien carnet absurde ne casse rien',
   migrerDepuisAncien({ tenues: -3, morsures: 'beaucoup', chronos: { x: NaN } }).tenues === 0);
ok('et un tenues de 99 se plafonne a treize',
   migrerDepuisAncien({ tenues: 99 }).tenues === 13);
ok('une version inconnue repart a zero', migrer({ v: 42, tenues: 9 }).tenues === 0);

/* ----------------------------------------------------------- les espaces */

titre('LES DEUX ESPACES NE SE CONTAMINENT PAS');

// L'ANCIENNE CLEF A ETE ECRITE PAR /test, QUI PARTAGE L'ORIGINE DU JEU. Le
// joueur qui ouvre l'edition le 19 octobre sur le meme navigateur qu'un testeur
// ne doit RIEN en heriter.
const r2 = poche({ [CLE_ANCIENNE]: JSON.stringify(ancien) });
const joueurNeuf = lire(r2, false);
ok('l espace joueur NAIT VIDE, meme quand l ancienne clef existe',
   joueurNeuf.carnet.tenues === 0 && joueurNeuf.etat === 'neuf',
   `${joueurNeuf.etat} ${joueurNeuf.carnet.tenues}`);

// Le testeur finit les treize nuits.
let ct = carnetVide();
for (let n = 1; n <= 13; n++) ct = tenir(ct, n, 10, 1, 0);
ecrire(r2, true, ct);
ok('le testeur a bien ses treize nuits', lire(r2, true).carnet.tenues === 13);

const joueur = lire(r2, false);
ok('et le joueur n en voit aucune — rien n a debordé',
   joueur.carnet.tenues === 0, String(joueur.carnet.tenues));

// Le joueur tient sa premiere nuit ; le testeur garde les siennes.
ecrire(r2, false, tenir(joueur.carnet, 1, 9.0, 2.0, 0));
ok('le joueur avance de son cote', lire(r2, false).carnet.tenues === 1);
ok('sans toucher au testeur', lire(r2, true).carnet.tenues === 13);
ok('les deux clefs coexistent en base',
   CLE_JOUEUR in r2.tout() && CLE_TESTEUR in r2.tout(),
   Object.keys(r2.tout()).join(', '));

/* --------------------------------------------------------------- le sceau */

titre('LE SCEAU : IL NE RESISTE PAS, IL SE VOIT');

const r3 = poche();
const scelle = ecrire(r3, false, tenir(carnetVide(), 1, 11.2, 2.5, 0));
ok('une ecriture pose une somme', typeof scelle.sc === 'string' && scelle.sc.length > 0);
ok('et la relecture la trouve intacte', lire(r3, false).etat === 'intact');

// Le joueur curieux passe tenues de 1 a 13 dans l'inspecteur.
const trafique = JSON.parse(r3.lire(CLE_JOUEUR));
trafique.tenues = 13;
r3.ecrire(CLE_JOUEUR, JSON.stringify(trafique));
const l3 = lire(r3, false);
ok('une sauvegarde editee a la main est vue', l3.etat === 'edite');
ok('et elle ne sert pas une edition finie', l3.carnet.tenues === 0, String(l3.carnet.tenues));

// CE QUE L'ON ECRIT DOIT SE RELIRE INTACT, QUELS QUE SOIENT LES CHAMPS. Le
// jour retenu est une heure qui avance a la milliseconde fractionnaire
// (halloween-calendrier.ts) ; la lecture l'arrondit. Scelle avant
// l'arrondi, le carnet se relisait « edite » — et se videait. Trouve par
// l'essai en navigateur du 16/10, apres la premiere nuit tenue.
{
  const r4 = poche();
  ecrire(r4, false, tenir(carnetVide(), 1, 8.57, 2.4, 1792362628405.8));
  const l4 = lire(r4, false);
  ok('un jour a la milliseconde fractionnaire se relit intact', l4.etat === 'intact', l4.etat);
  ok('et la nuit tenue est toujours la', l4.carnet.tenues === 1 && l4.carnet.chronos['1'] === 8.57);
  const r5 = poche();
  ecrire(r5, false, tenir(carnetVide(), 1, NaN, Infinity, 0));
  const l5 = lire(r5, false);
  ok('un chrono illisible ne fait pas passer le carnet pour trafique', l5.etat === 'intact', l5.etat);
  ok('il est simplement oublie, la nuit reste tenue', l5.carnet.tenues === 1 && !('1' in l5.carnet.chronos));
}

// La somme ne doit pas dependre de l'ordre des champs.
const a = { ...carnetVide(), tenues: 3, morsures: 2 };
const b = { morsures: 2, tenues: 3, ...carnetVide(), tenues: 3, morsures: 2 };
ok('la somme ne depend pas de l ordre des champs', sommeDe(a) === sommeDe(b));

// Et elle doit changer des qu'un chiffre change.
ok('elle change quand tenues change',
   sommeDe({ ...a, tenues: 4 }) !== sommeDe(a));
ok('elle change quand un chrono change',
   sommeDe({ ...a, chronos: { '1': 9.9 } }) !== sommeDe({ ...a, chronos: { '1': 9.8 } }));

/* ------------------------------------------------------------ la tenue */

titre('TENIR UNE NUIT');

let c = carnetVide();
c = tenir(c, 1, 12.0, 3.0, 100);
ok('tenir la premiere fait monter a un', c.tenues === 1);
c = tenir(c, 3, 9.0, 1.0, 101);
ok('tenir la troisieme hors tour n avance PAS la progression', c.tenues === 1);
ok('mais son chrono est garde', c.chronos['3'] === 9.0);
c = tenir(c, 2, 11.0, 2.0, 102);
ok('tenir la deuxieme avance a deux', c.tenues === 2);
c = tenir(c, 1, 13.0, 4.0, 103);
ok('un moins bon chrono ne remplace pas le meilleur', c.chronos['1'] === 12.0);
c = tenir(c, 1, 10.5, 0.5, 104);
ok('un meilleur chrono, si', c.chronos['1'] === 10.5);
ok('et l ecart minimal suit la meme regle', c.ecarts['1'] === 0.5);
ok('le jour de la derniere tenue est garde', c.dernierJour === 102);

ok('une morsure se compte sans couter de progression',
   (() => { const m = mordre(c); return m.morsures === 1 && m.tenues === c.tenues; })());

/* -------------------------------------------------------- le stockage refuse */

titre('UN STOCKAGE REFUSE NE FAIT RIEN TOMBER');

const mur = { lire: () => { throw new Error('refus'); }, ecrire: () => { throw new Error('refus'); } };
ok('lire ne jette pas', (() => { try { return lire(mur, false).carnet.tenues === 0; } catch { return false; } })());
ok('ecrire ne jette pas', (() => { try { ecrire(mur, false, carnetVide()); return true; } catch { return false; } })());

console.log(e ? `\n${e} echec(s)` : '\nTout passe.');
process.exit(e ? 1 : 0);
