// La geometrie des haies, verifiee contre le reglement.
//
// Ces nombres ne se relisent pas a l'oeil. Une haie posee a 9,41 m au lieu de
// 9,14 ne se voit pas sur une piste dessinee : elle se voit six mois plus tard,
// quand quelqu'un compare un chrono du jeu a un chrono reel et ne comprend pas
// l'ecart. Le reglement, lui, donne une egalite exacte — et une egalite, ca se
// verifie.

import {
  HAIES, RECORDS, PLATEAUX, APPUIS, NB_HAIES,
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

titre('LE BAREME EST CELUI QUI A ETE DECIDE');

// LE BAREME NE SE CALCULE PLUS, IL SE DECIDE (haies.js, BAREME), et ce harnais
// change donc de metier. Il verifiait avant qu'une formule tombait juste ; il
// verifie maintenant que DOUZE NOMBRES DECIDES PAR LE JOUEUR sont bien ceux
// qui arrivent dans le jeu. C'est le seul garde-fou possible contre la tentation
// de les « arranger » : quiconque les retouche doit le faire ici aussi, donc
// sciemment.
const VOULU = [
  [17.50, 19.00], [15.50, 17.50], [13.00, 14.50],
  [12.75, 13.20], [12.75, 13.00], [12.30, 12.75],
];
{
  const g = PLATEAUX['110h'];
  const pareil = VOULU.every(([a, b], i) =>
    Math.abs(g[i][0] - a) < 0.005 && Math.abs(g[i][1] - b) < 0.005);
  ok('110h : les six plateaux sont exactement ceux demandes', pareil,
     g.map(x => `${x[0]}-${x[1]}`).join(' '));
}

// Les deux autres epreuves se deduisent par le rapport des records : une seule
// echelle de difficulte, pas trois. Si un jour le 100 m ou le tour recoit son
// propre bareme mesure au pouce, c'est cette verification-la qui tombera — et
// elle doit tomber bruyamment, pas en silence.
for (const c of ['100h', '400h']) {
  const r = RECORDS[c].s / RECORDS['110h'].s;
  const g = PLATEAUX[c];
  const suit = VOULU.every(([a, b], i) =>
    Math.abs(g[i][0] - a * r) < 0.01 && Math.abs(g[i][1] - b * r) < 0.01);
  ok(`${c} : se deduit du 110 m par le rapport des records`, suit,
     g.map(x => `${x[0]}-${x[1]}`).join(' '));
}

titre('LE RECORD DU MONDE TOMBE AU BON ENDROIT');

// CE QUI A CHANGE, et c'est le renversement le plus visible du nouveau bareme.
// Avant, le mondial SEUL encadrait le record et les deux niveaux au-dessus
// passaient dessous. Maintenant, le mondial ET les Jeux mondiaux l'encadrent
// tous deux ; seuls les ZEZE descendent.
for (const c of CLES) {
  const R = RECORDS[c].s;
  for (const [n, i] of [['mondial', 3], ['Jeux mondiaux', 4]]) {
    const [a, b] = PLATEAUX[c][i];
    ok(`${c} : le ${n} (${a}-${b}) encadre le record ${R}`, a <= R && R <= b,
       `${a} · ${R} · ${b}`);
  }
}

titre('CE QUI SE JOUE AU PHOTO-FINISH');

// L'ancien bareme exigeait une demi-seconde au plateau mondial, « de quoi se
// detacher » : un plateau trop serre n'est plus une course, tout s'y joue au
// centieme. Le bareme decide passe sous cette barre — un quart de seconde aux
// Jeux mondiaux du 110 m — et c'est assume : a ce niveau-la, la course DOIT se
// jouer au centieme.
//
// On garde donc une borne, beaucoup plus basse, et surtout on AFFICHE le plus
// serre a chaque passage. Le jour ou le niveau 5 se jouera comme une loterie,
// le chiffre sera la, sous les yeux, et ce sera lui qu'il faudra ouvrir.
for (const c of CLES) {
  const g = PLATEAUX[c];
  const serre = g.reduce((m, [a, b], i) => (b - a < m.l ? { l: b - a, i } : m), { l: Infinity, i: -1 });
  ok(`${c} : le plus serre des six tient encore une course`, serre.l >= 0.2,
     `niveau ${serre.i + 1}, ${serre.l.toFixed(2)} s entre le premier et le dernier`);
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
