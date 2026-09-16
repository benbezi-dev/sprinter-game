// La geometrie des haies, verifiee contre le reglement.
//
// Ces nombres ne se relisent pas a l'oeil. Une haie posee a 9,41 m au lieu de
// 9,14 ne se voit pas sur une piste dessinee : elle se voit six mois plus tard,
// quand quelqu'un compare un chrono du jeu a un chrono reel et ne comprend pas
// l'ecart. Le reglement, lui, donne une egalite exacte — et une egalite, ca se
// verifie.

import {
  HAIES, RECORDS, PLATEAUX, APPUIS, NB_HAIES, ECART_MONDIAL,
  distanceDe, positionsDes, verifierGeometrie, fouleeIdeale,
} from '../src/game/haies.js';
import { APPEL } from '../src/game/haies-jeu.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const CLES = ['100h', '110h', '400h'];

titre('LA GEOMETRIE TOMBE JUSTE');

for (const c of CLES) {
  const v = verifierGeometrie(c);
  ok(`${c} : premiere + 9 ecarts + fin = ${v.attendu} m`, v.exact,
     `${v.somme.toFixed(2)} contre ${v.attendu}`);
}

ok('dix haies partout, sans exception',
   CLES.every(c => HAIES[c].haies.nombre === NB_HAIES && positionsDes(c).length === NB_HAIES));

titre('LES COTES DU REGLEMENT');

// Les valeurs de World Athletics, recopiees ici a la main : le test ne vaut
// que s'il connait la reponse par un autre chemin que le fichier qu'il teste.
const REGLEMENT = {
  '100h': { hauteur: 0.838, premiere: 13.00, ecart: 8.50, fin: 10.50, total: 100 },
  '110h': { hauteur: 1.067, premiere: 13.72, ecart: 9.14, fin: 14.02, total: 110 },
  '400h': { hauteur: 0.914, premiere: 45.00, ecart: 35.00, fin: 40.00, total: 400 },
};
for (const c of CLES) {
  const a = HAIES[c].haies, r = REGLEMENT[c];
  ok(`${c} : hauteur ${r.hauteur} m`, a.hauteur === r.hauteur, String(a.hauteur));
  ok(`${c} : premiere haie a ${r.premiere} m`, a.premiere === r.premiere, String(a.premiere));
  ok(`${c} : ${r.ecart} m entre les haies`, a.ecart === r.ecart, String(a.ecart));
  ok(`${c} : ${r.fin} m de la derniere a l arrivee`, a.fin === r.fin, String(a.fin));
  ok(`${c} : ${r.total} m au total`, distanceDe(c) === r.total, String(distanceDe(c)));
}

titre('LA DERNIERE HAIE N EST PAS SUR LA LIGNE');

for (const c of CLES) {
  const p = positionsDes(c);
  const derniere = p[p.length - 1];
  const total = distanceDe(c);
  ok(`${c} : derniere haie a ${derniere.toFixed(2)} m, ligne a ${total} m`,
     derniere < total - 5, `${(total - derniere).toFixed(2)} m de course apres`);
  ok(`${c} : aucune haie avant le depart`, p[0] > 10, String(p[0]));
}

titre('LE RYTHME EST CELUI DE L ENTRAINEUR');

// Les nombres de l'utilisateur, recopies ici expres : un changement dans
// haies.js doit se voir dans ce harnais, pas passer en silence.
ok('100 m haies : 7 appuis puis 4',
   APPUIS['100h'].premiere.join('-') === '7-7' && APPUIS['100h'].intervalle.join('-') === '4-4');
ok('110 m haies : 7 appuis puis 4',
   APPUIS['110h'].premiere.join('-') === '7-7' && APPUIS['110h'].intervalle.join('-') === '4-4');
ok('400 m haies : 21 a 23 appuis puis 13 a 17',
   APPUIS['400h'].premiere.join('-') === '21-23' && APPUIS['400h'].intervalle.join('-') === '13-17');

titre('LA FOULEE DEMANDEE RESTE HUMAINE');

// Entre deux haies, un hurdleur ne court pas a la foulee d'un sprinteur lance
// (2,2 a 2,5 m) : il court plus serre, 1,8 a 2 m sur les courtes, un peu plus
// ample sur le tour. Une cible hors de cette fourchette serait injouable, ou
// dirait autre chose que l'epreuve.
for (const c of CLES) {
  const a = APPEL[c], h = HAIES[c].haies;
  const f = fouleeIdeale(c, h.ecart - a.avant - a.apres);
  ok(`${c} : le rythme vise demande ${f.toFixed(2)} m de foulee`,
     f >= 1.6 && f <= 2.6, `${f.toFixed(2)} m`);
  ok(`${c} : la foulee du hurdleur est plus serree que celle du sprinteur, sans l'ecraser`,
     HAIES[c].foulee > 0.7 && HAIES[c].foulee <= 1, String(HAIES[c].foulee));
}

titre('LE PLATEAU MONDIAL ENCADRE LE RECORD');

for (const c of CLES) {
  const [a, b] = PLATEAUX[c][3];
  const R = RECORDS[c].s;
  const attendu = R * ECART_MONDIAL;
  ok(`${c} : ${a} a ${b} autour de ${R}`,
     Math.abs((R - a) - attendu) < 0.01 && Math.abs((b - R) - attendu) < 0.01,
     `${(R - a).toFixed(2)} avant, ${(b - R).toFixed(2)} apres`);
}

// L'ecart est une PROPORTION, et c'est ce qui doit etre verifie.
//
// Exprime en secondes, il valait 2,3 % d'un 110 m haies et 0,65 % d'un tour :
// le plateau du 400 m tenait dans six dixiemes apres quarante-six secondes de
// course, ou l'on ne pouvait ni prendre de l'avance ni en perdre. Le test
// verifie donc que les trois epreuves respirent pareil, et que le 110 m — ou
// le chiffre a ete pose — retombe exactement sur ses trois dixiemes.
ok('les trois epreuves ont la meme respiration',
   CLES.every(c => {
     const [a, b] = PLATEAUX[c][3];
     return Math.abs((b - a) / RECORDS[c].s - 2 * ECART_MONDIAL) < 0.002;
   }),
   CLES.map(c => {
     const [a, b] = PLATEAUX[c][3];
     return `${c} ${(100 * (b - a) / RECORDS[c].s).toFixed(1)}%`;
   }).join(' · '));

ok('le 110 m retombe sur les trois dixiemes demandes',
   Math.abs((RECORDS['110h'].s - PLATEAUX['110h'][3][0]) - 0.30) < 0.005,
   `${(RECORDS['110h'].s - PLATEAUX['110h'][3][0]).toFixed(3)} s`);

// Un plateau trop serre n'est plus une course : personne ne prend d'avance,
// tout se joue au centieme. On exige de quoi se detacher.
for (const c of CLES) {
  const [a, b] = PLATEAUX[c][3];
  ok(`${c} : le plateau mondial laisse de quoi se detacher`,
     b - a >= 0.5, `${(b - a).toFixed(2)} s entre le premier et le dernier`);
}

titre('CHAQUE NIVEAU EST PLUS DUR QUE LE PRECEDENT');

for (const c of CLES) {
  const g = PLATEAUX[c];
  const monte = g.every((x, i) => i === 0 || (x[0] <= g[i - 1][0] + 1e-9 && x[1] <= g[i - 1][1] + 1e-9));
  ok(`${c} : la progression ne recule jamais`, monte,
     g.map(x => x[0].toFixed(2)).join(' > '));
  ok(`${c} : six plateaux`, g.length === 6, String(g.length));
  ok(`${c} : chaque plateau a une largeur`, g.every(([a, b]) => b > a));
}

titre('LES ZEZE PASSENT SOUS LE RECORD');

for (const c of CLES) {
  const [a, b] = PLATEAUX[c][5];
  ok(`${c} : ${a} a ${b}, record ${RECORDS[c].s}`, b < RECORDS[c].s,
     `${(RECORDS[c].s - b).toFixed(2)} s sous la marque`);
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
