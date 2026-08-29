// La geometrie des haies, verifiee contre le reglement.
//
// Ces nombres ne se relisent pas a l'oeil. Une haie posee a 9,41 m au lieu de
// 9,14 ne se voit pas sur une piste dessinee : elle se voit six mois plus tard,
// quand quelqu'un compare un chrono du jeu a un chrono reel et ne comprend pas
// l'ecart. Le reglement, lui, donne une egalite exacte — et une egalite, ca se
// verifie.

import {
  HAIES, RECORDS, PLATEAUX, APPUIS_IDEAL, NB_HAIES,
  distanceDe, positionsDes, verifierGeometrie, fouleeIdeale,
} from '../src/game/haies.js';

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

titre('LA FOULEE DEMANDEE RESTE HUMAINE');

// Le moteur pose lui-meme la fourchette : un sprinteur d'elite pose le pied
// tous les 2,2 a 2,5 m a pleine vitesse. Une cible hors de cette fourchette
// serait injouable, ou trop facile.
for (const c of CLES) {
  const f = fouleeIdeale(c);
  ok(`${c} : ${APPUIS_IDEAL[c]} appuis font ${f.toFixed(2)} m de foulee`,
     f >= 2.05 && f <= 2.55, `${f.toFixed(2)} m`);
}

titre('LE PLATEAU MONDIAL ENCADRE LE RECORD');

for (const c of CLES) {
  const [a, b] = PLATEAUX[c][3];
  const R = RECORDS[c].s;
  ok(`${c} : ${a} a ${b} autour de ${R}`,
     Math.abs((R - a) - 0.30) < 0.005 && Math.abs((b - R) - 0.30) < 0.005,
     `${(R - a).toFixed(2)} avant, ${(b - R).toFixed(2)} apres`);
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
