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
//   — LA TREIZIÈME S'OUVRE COMME LES AUTRES, à 22 h de Paris (19/10). Elle
//     suivait l'heure locale du joueur (18 h chez lui) ; plus maintenant.
//
//   — LE MODE HORS LIGNE EST LA PORTE DE DERRIÈRE ÉVIDENTE. Sans serveur, on
//     ne doit jamais accorder un jour futur, et le cliquet doit tenir même
//     quand l'horloge de l'appareil recule.
//
//   node tools/halloween-calendrier-test.mjs

import {
  NB_NUITS, PREMIER_JOUR_UTC,
  ouvertureDe, ouverteAt, nuitsParLaDate, nuitsJouables, nuitJouable, blocageDe,
  horlogeRetenue, MEMOIRE_MUETTE,
  poserHorloge, poserMonotone, maintenant, simuler,
} from '../src/game/halloween-calendrier.ts';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const JOUR = 86400000;
const iso = ms => new Date(ms).toISOString().replace('.000Z', 'Z');

/* ------------------------------------------------------- les treize dates */

titre('LES TREIZE DATES');

ok('treize nuits', NB_NUITS === 13, String(NB_NUITS));
ok('la première ouvre le 19 octobre à 22 h à Paris (consigne du 19/10)',
   ouvertureDe(1) === PREMIER_JOUR_UTC && iso(ouvertureDe(1)) === '2026-10-19T20:00:00Z',
   iso(ouvertureDe(1)));
ok('la treizième tombe le 31 octobre au soir',
   new Date(ouvertureDe(13)).getUTCDate() === 31 &&
   new Date(ouvertureDe(13)).getUTCHours() === 21,
   iso(ouvertureDe(13)));

ok('les treize s ouvrent dans l ordre, une par jour, à 22 h',
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
// DEPUIS LE PASSAGE A 22 H (19/10), C'EST ENTRE LA NUIT 6 ET LA NUIT 7. La
// nuit 7 ouvre le 25 octobre a 22 h, DIX-NEUF HEURES APRES la bascule de 3 h
// du matin : elle est deja a UTC+1. A minuit, c'etait entre la 7 et la 8.
ok('et il sépare la nuit 6 de la nuit 7 — la 7 ouvre APRÈS la bascule de 3 h',
   court.length === 1 && ecarts.indexOf(court[0]) === 5 && court[0] === 25 * 3600000,
   court.length ? (court[0] / 3600000) + 'h entre la nuit ' + (ecarts.indexOf(court[0]) + 1)
                  + ' et la ' + (ecarts.indexOf(court[0]) + 2) : '—');

// La preuve par l'absurde : le calcul naïf qu'on aurait pu écrire.
const naif = n => PREMIER_JOUR_UTC + (n - 1) * JOUR;
ok('le calcul naïf tient encore pour la nuit 6', naif(6) === ouvertureDe(6));
ok('et se décale d une heure à partir de la nuit 7 — plus de la moitié de l édition',
   naif(7) !== ouvertureDe(7) && ouvertureDe(7) - naif(7) === 3600000,
   `naïf ${iso(naif(7))} contre ${iso(ouvertureDe(7))}`);
ok('les sept nuits suivantes, de la 7 à la 13, seraient toutes décalées',
   [7, 8, 9, 10, 11, 12, 13].every(n => ouvertureDe(n) - naif(n) === 3600000));
ok('la nuit 7 s ouvre bien à 22 h à Paris (21 h UTC, heure d hiver)',
   iso(ouvertureDe(7)) === '2026-10-25T21:00:00Z', iso(ouvertureDe(7)));

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

titre('LA TREIZIEME, A 22 H DE PARIS COMME LES AUTRES');

// Consigne du 19/10 : « mets-les tous a 22 h ». Le 31 octobre, Paris est a
// UTC+1 : 22 h = 21 h UTC, et le meme instant pour tout le monde.
const finale = ouvertureDe(13);
ok('la treizième s ouvre le 31 octobre à 22 h à Paris',
   iso(finale) === '2026-10-31T21:00:00Z', iso(finale));
ok('fermée une minute avant', ouverteAt(13, finale - 60000) === false);
ok('ouverte à 22 h 00', ouverteAt(13, finale) === true);
ok('le fuseau de l appareil n y change rien (Tokyo, Los Angeles, UTC+23)',
   [9 * 60, -7 * 60, 23 * 60].every(dec =>
     ouverteAt(13, finale - 60000, dec) === false && ouverteAt(13, finale, dec) === true));
ok('et toutes les nuits s ouvrent à 22 h à Paris',
   Array.from({ length: NB_NUITS }, (_, i) => ouvertureDe(i + 1))
     .every(t => new Date(t).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit' }).startsWith('22')));

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

/* ------------------------------------------------- l'horloge qui avance */

titre('L HORLOGE AVANCE — LA NUIT S OUVRE A MINUIT SANS ROUVRIR LE PANNEAU');

// LE BOGUE DU 16/10 : `maintenant()` rendait l'instant pose a l'ouverture du
// panneau, fige. A 23 h 59 le soir du 19, la nuit 2 restait scellee pour qui
// gardait le panneau ouvert, et le compte a rebours ne bougeait pas.
{
  let montre = 1000;
  poserMonotone(() => montre);
  const veille = ouvertureDe(2) - 60000;           // 23 h 59 a Paris, le 19
  poserHorloge({ ms: veille, source: 'serveur' });
  ok('a 23 h 59, la nuit 2 est encore scellee',
     !nuitJouable(2, 1, maintenant()), new Date(maintenant()).toISOString());
  montre += 90000;                                  // une minute et demie plus tard
  ok('quatre-vingt-dix secondes plus tard, elle est ouverte',
     nuitJouable(2, 1, maintenant()), new Date(maintenant()).toISOString());
  ok('l heure a avance exactement du temps ecoule', maintenant() === veille + 90000);

  // La montre monotone ne recule pas ; si elle le faisait, on ne recule pas.
  montre -= 500000;
  ok('une montre qui recule ne passe jamais sous l heure retenue', maintenant() === veille);

  // Le voyageur temporel passe devant, et rend la main.
  simuler(ouvertureDe(9));
  ok('le jour simule remplace l horloge', maintenant() === ouvertureDe(9));
  simuler(null);
  ok('et la rend en partant', maintenant() === veille);
}

/* ------------------------------------------------------------- le fuseau */

titre('LE HARNAIS NE DOIT PAS DEPENDRE DE LA MACHINE QUI LE LANCE');

ok('toutes les frontières sont des instants absolus',
   typeof ouvertureDe(1) === 'number' && ouvertureDe(1) === PREMIER_JOUR_UTC);
console.log(`   · fuseau de cette machine : UTC${-new Date().getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-new Date().getTimezoneOffset() / 60}`);

console.log(e ? `\n${e} echec(s)` : '\nTout passe.');
process.exit(e ? 1 : 0);
