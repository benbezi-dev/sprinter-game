// LE CALENDRIER DES TREIZE NUITS — ce qui ouvre quoi, et quand.
//
// Le mode Halloween 2026 ouvre une course par jour du 19 au 31 octobre, et
// chaque course demande DEUX verrous : sa date, et la victoire de la veille.
// Ce harnais éprouve les deux, plus les trois garde-fous qui empêchent
// d'avancer sa montre.
//
// POURQUOI CE HARNAIS EXISTE AVANT L'ÉCRAN. Une erreur de date ne se voit pas :
// elle se voit le 24 octobre, chez les joueurs, une fois. Il n'y a pas de
// seconde édition pour corriger. Tout ce qui se calcule ici doit donc être
// prouvé avant qu'une seule carte soit dessinée.
//
// TROIS PIÈGES QU'ON VÉRIFIE NOMMÉMENT :
//
//   — LE CHANGEMENT D'HEURE TOMBE AU MILIEU DE LA FENÊTRE. Paris passe de
//     UTC+2 à UTC+1 le 25 octobre 2026 à 3 h du matin. Les treize jours ne
//     sont donc PAS espacés de 86 400 000 ms, et un calcul par multiplication
//     décale LES SIX DERNIÈRES NUITS d'une heure.
//
//     LA COUPURE EST ENTRE LA NUIT 7 ET LA NUIT 8, et ce harnais me l'a appris
//     en échouant : j'avais écrit « entre la 6 et la 7 ». La nuit 7 ouvre à
//     minuit le 25 octobre, soit trois heures AVANT la bascule — elle est
//     encore à UTC+2. C'est la nuit 8, le 26, qui est la première à UTC+1.
//
//   — LA TREIZIÈME SUIT L'HEURE LOCALE DU JOUEUR, pas celle de Paris. Elle
//     ouvre à 18 h chez lui. Un joueur à Tokyo et un joueur à Los Angeles ne
//     la reçoivent pas au même instant absolu, et c'est voulu.
//
//   — LE MODE HORS LIGNE EST LA PORTE DE DERRIÈRE ÉVIDENTE. Sans serveur, on
//     ne doit jamais accorder un jour futur, et le cliquet doit tenir même
//     quand l'horloge de l'appareil recule.
//
//   node tools/halloween-calendrier-test.mjs

import {
  NB_NUITS, PREMIER_JOUR_UTC, HEURE_FINALE,
  ouvertureDe, ouverteAt, nuitsParLaDate, nuitsJouables, nuitJouable, blocageDe,
  horlogeRetenue, MEMOIRE_MUETTE,
} from '../src/game/halloween-calendrier.ts';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const JOUR = 86400000;
const iso = ms => new Date(ms).toISOString().replace('.000Z', 'Z');

/* ------------------------------------------------------- les treize dates */

titre('LES TREIZE DATES');

ok('treize nuits', NB_NUITS === 13, String(NB_NUITS));
ok('la première ouvre le 19 octobre à minuit à Paris',
   ouvertureDe(1) === PREMIER_JOUR_UTC && iso(ouvertureDe(1)) === '2026-10-18T22:00:00Z',
   iso(ouvertureDe(1)));
ok('la treizième tombe le 31 octobre',
   new Date(ouvertureDe(13)).getUTCDate() === 30 &&
   new Date(ouvertureDe(13)).getUTCHours() === 23,
   iso(ouvertureDe(13)));

ok('les treize s ouvrent dans l ordre, une par jour',
   (() => {
     for (let n = 2; n <= NB_NUITS; n++) {
       const d = ouvertureDe(n) - ouvertureDe(n - 1);
       if (d < 23 * 3600000 || d > 25 * 3600000) return false;
     }
     return true;
   })());

// LE CHANGEMENT D'HEURE, NOMMÉMENT. C'est le seul jour de la fenêtre qui ne
// dure pas vingt-quatre heures, et un calcul par multiplication le rate.
titre('LE CHANGEMENT D HEURE, AU MILIEU DE LA FENETRE');

const ecarts = [];
for (let n = 2; n <= NB_NUITS; n++) ecarts.push(ouvertureDe(n) - ouvertureDe(n - 1));
const court = ecarts.filter(d => d !== JOUR);
ok('exactement un jour de la fenêtre ne dure pas vingt-quatre heures',
   court.length === 1, ecarts.map(d => (d / 3600000) + 'h').join(' '));
// ET C'EST ENTRE LA NUIT 7 ET LA NUIT 8, pas entre la 6 et la 7 — ce harnais me
// l'a appris en échouant sur ma propre étiquette. La nuit 7 ouvre à minuit le
// 25 octobre, soit TROIS HEURES AVANT la bascule de 3 h du matin : elle est
// encore à UTC+2. C'est la nuit 8, le 26, qui est la première à UTC+1.
ok('et il sépare la nuit 7 de la nuit 8 — la 7 ouvre AVANT la bascule de 3 h',
   court.length === 1 && ecarts.indexOf(court[0]) === 6 && court[0] === 25 * 3600000,
   court.length ? (court[0] / 3600000) + 'h entre la nuit ' + (ecarts.indexOf(court[0]) + 1)
                  + ' et la ' + (ecarts.indexOf(court[0]) + 2) : '—');

// La preuve par l'absurde : le calcul naïf qu'on aurait pu écrire.
const naif = n => PREMIER_JOUR_UTC + (n - 1) * JOUR;
ok('le calcul naïf tient encore pour la nuit 7', naif(7) === ouvertureDe(7));
ok('et se décale d une heure à partir de la nuit 8 — la moitié de l édition',
   naif(8) !== ouvertureDe(8) && ouvertureDe(8) - naif(8) === 3600000,
   `naïf ${iso(naif(8))} contre ${iso(ouvertureDe(8))}`);
ok('les six dernières nuits seraient toutes décalées',
   [8, 9, 10, 11, 12, 13].every(n => ouvertureDe(n) - naif(n) === 3600000));

/* -------------------------------------------------- les bornes, à la ms */

titre('LES BORNES, A LA MILLISECONDE');

for (const n of [1, 6, 7, 12]) {
  ok(`nuit ${n} : fermée une milliseconde avant`, ouverteAt(n, ouvertureDe(n) - 1) === false);
  ok(`nuit ${n} : ouverte à la milliseconde`, ouverteAt(n, ouvertureDe(n)) === true);
}

ok('aucune nuit n est ouverte la veille du 19 octobre',
   nuitsParLaDate(ouvertureDe(1) - 1) === 0);
ok('la douzième est ouverte le 30 octobre, pas la treizième',
   nuitsParLaDate(ouvertureDe(12) + 3600000) === 12);
ok('rien au-delà de treize, même en décembre',
   nuitsParLaDate(Date.UTC(2026, 11, 25)) === 13);

/* ------------------------------------------- la treizième et l heure locale */

titre('LA TREIZIEME SUIT L HEURE LOCALE DU JOUEUR');

// Paris (UTC+1 le 31 octobre) : 18 h locale = 17 h UTC.
const parisMinuit31 = ouvertureDe(13);
ok('à Paris, fermée à 17 h 59 locale',
   ouverteAt(13, parisMinuit31 + (HEURE_FINALE * 3600000) - 60000, 60) === false);
ok('à Paris, ouverte à 18 h 00 locale',
   ouverteAt(13, parisMinuit31 + HEURE_FINALE * 3600000, 60) === true);

// Un joueur à Tokyo (UTC+9) la reçoit huit heures plus tôt en absolu.
const tokyo = ouverteAt(13, parisMinuit31 + (HEURE_FINALE - 8) * 3600000, 9 * 60);
ok('à Tokyo, elle ouvre huit heures plus tôt en temps absolu', tokyo === true);

// Los Angeles (UTC-7) : huit heures plus tard.
ok('à Los Angeles, elle n est pas encore ouverte à la même seconde',
   ouverteAt(13, parisMinuit31 + (HEURE_FINALE - 8) * 3600000, -7 * 60) === false);

// LE FUSEAU EST UNE ENTRÉE DU JOUEUR, DONC IL EST BORNÉ. Sans plafond, se
// déclarer à UTC+23 ouvrirait la finale la veille.
const triche = ouverteAt(13, parisMinuit31, 23 * 60);
const honnete = ouverteAt(13, parisMinuit31, 14 * 60);
ok('un fuseau aberrant (UTC+23) n ouvre pas plus tôt que le plus avancé des vrais',
   triche === honnete, `UTC+23 ${triche} / UTC+14 ${honnete}`);

/* ----------------------------------------------------- le double verrou */

titre('LE DOUBLE VERROU : LA DATE ET LA VICTOIRE');

const le25 = ouvertureDe(7);   // sept nuits ouvertes par la date

ok('sept nuits par la date le 25 octobre', nuitsParLaDate(le25) === 7);
ok('mais une seule jouable si rien n est tenu', nuitsJouables(0, le25) === 1);
ok('trois jouables si deux sont tenues', nuitsJouables(2, le25) === 3);
ok('la date plafonne : dix victoires n ouvrent pas la huitième le 25 octobre',
   nuitsJouables(10, le25) === 7);

ok('une nuit perdue reste jouable — c est la SUIVANTE qui attend',
   nuitJouable(3, 2, le25) === true && nuitJouable(4, 2, le25) === false);

ok('le 19 octobre, seule la première est jouable',
   nuitsJouables(0, ouvertureDe(1)) === 1 && nuitJouable(2, 0, ouvertureDe(1)) === false);

titre('CE QUI MANQUE A UNE NUIT — POUR QUE LA CARTE NE MENTE PAS');

ok('nuit 1 le 19 octobre, rien tenu : ouverte', blocageDe(1, 0, ouvertureDe(1)) === 'ouverte');
ok('nuit 8 le 25 octobre : c est la DATE qui manque',
   blocageDe(8, 7, le25) === 'date');
ok('nuit 5 le 25 octobre avec rien de tenu : c est la VICTOIRE qui manque',
   blocageDe(5, 0, le25) === 'victoire');
ok('une carte bloquée par la victoire n affiche donc pas de compte à rebours',
   blocageDe(5, 0, le25) !== 'date');

/* ------------------------------------------------- les trois garde-fous */

titre('LES TROIS GARDE-FOUS CONTRE LA MONTRE AVANCEE');

const memoireDePoche = () => { let v = null; return { lire: () => v, ecrire: x => { v = x; }, valeur: () => v }; };

// 1. Le serveur fait foi.
{
  const m = memoireDePoche();
  const h = horlogeRetenue(le25, le25 + 9 * JOUR, m);
  ok('le serveur fait foi, même quand l appareil prétend neuf jours de plus',
     h.ms === le25 && h.source === 'serveur', `${h.source} ${iso(h.ms)}`);
  ok('et il grave le cliquet au passage', Number(m.valeur()) === le25);
}

// 2. Le cliquet ne redescend pas.
{
  const m = memoireDePoche();
  horlogeRetenue(le25, le25, m);                        // on a vu le 25
  const h = horlogeRetenue(null, ouvertureDe(2), m);    // puis on recule au 20
  ok('hors ligne, reculer sa montre ne fait pas redescendre',
     h.ms >= le25 && h.source === 'cliquet', `${h.source} ${iso(h.ms)}`);
  ok('et la nuit 7 reste ouverte malgré le recul',
     nuitsParLaDate(h.ms) === 7, String(nuitsParLaDate(h.ms)));
}

// 3. Hors ligne, jamais un jour futur.
{
  const m = memoireDePoche();
  horlogeRetenue(le25, le25, m);
  const h = horlogeRetenue(null, le25 + 6 * JOUR, m);   // l appareil saute au 31
  ok('hors ligne, avancer sa montre de six jours n ouvre rien de plus',
     nuitsParLaDate(h.ms) === 7, `${nuitsParLaDate(h.ms)} nuits, ${h.source}`);
  ok('la finale reste fermée', ouverteAt(13, h.ms, 60) === false);
}

// Le mode hors ligne doit tout de même laisser la journée acquise s écouler,
// sans quoi la finale ne s ouvrirait jamais à 18 h pour un joueur hors ligne.
{
  const m = memoireDePoche();
  const matinDu31 = ouvertureDe(13) + 3600000;          // 1 h du matin, heure de Paris
  horlogeRetenue(matinDu31, matinDu31, m);
  const soir = horlogeRetenue(null, matinDu31 + 17 * 3600000, m);
  ok('mais la journée déjà acquise peut s écouler hors ligne',
     ouverteAt(13, soir.ms, 60) === true, `${soir.source} ${iso(soir.ms)}`);
}

// Première visite hors ligne : rien d acquis, donc rien à voler.
{
  const h = horlogeRetenue(null, ouvertureDe(13), MEMOIRE_MUETTE);
  ok('première visite hors ligne : on lit l appareil, faute de mieux',
     h.source === 'appareil');
  ok('un stockage refusé ne fait pas tomber le calcul', typeof h.ms === 'number');
}

/* ------------------------------------------------------------- le fuseau */

titre('LE HARNAIS NE DOIT PAS DEPENDRE DE LA MACHINE QUI LE LANCE');

ok('toutes les frontières sont des instants absolus',
   typeof ouvertureDe(1) === 'number' && ouvertureDe(1) === PREMIER_JOUR_UTC);
console.log(`   · fuseau de cette machine : UTC${-new Date().getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-new Date().getTimezoneOffset() / 60}`);

console.log(e ? `\n${e} echec(s)` : '\nTout passe.');
process.exit(e ? 1 : 0);
