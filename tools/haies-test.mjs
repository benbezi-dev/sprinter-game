// La geometrie des haies, verifiee contre le reglement.
//
// Ces nombres ne se relisent pas a l'oeil. Une haie posee a 9,41 m au lieu de
// 9,14 ne se voit pas sur une piste dessinee : elle se voit six mois plus tard,
// quand quelqu'un compare un chrono du jeu a un chrono reel et ne comprend pas
// l'ecart. Le reglement, lui, donne une egalite exacte — et une egalite, ca se
// verifie.

import {
  HAIES, RECORDS, PLATEAUX, PLATEAUX_PUBLICS, PLATEAUX_TEST, APPUIS, NB_HAIES,
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

titre('DEUX BAREMES, UN PAR CANAL');

// Depuis le 29 septembre 2026, le canal de test joue un nouveau bareme
// (haies.js, PLATEAUX_TEST) et la production garde l'ancien (PLATEAUX_PUBLICS).
// Ce harnais verifie les deux, quel que soit le canal ou il tourne ; le canal
// ne decide que lequel des deux devient PLATEAUX, et donc HAIES[cle].ranges.
const TEST = process.env.VITE_CANAL === 'test';
ok(`sous VITE_CANAL=${process.env.VITE_CANAL ?? '(rien)'}, le jeu prend le bareme ${TEST ? 'de test' : 'de la production'}`,
   PLATEAUX === (TEST ? PLATEAUX_TEST : PLATEAUX_PUBLICS)
   && CLES.every(c => HAIES[c].ranges === PLATEAUX[c]));

titre('PRODUCTION : LE BAREME EST CELUI QUI A ETE DECIDE');

// LE BAREME NE SE CALCULE PLUS, IL SE DECIDE (haies.js, BAREME), et ce harnais
// verifie que DOUZE NOMBRES DECIDES PAR LE JOUEUR sont bien ceux qui arrivent
// dans le jeu. C'est le seul garde-fou possible contre la tentation de les
// « arranger » : quiconque les retouche doit le faire ici aussi, donc
// sciemment.
const VOULU = [
  [17.50, 19.00], [15.50, 17.50], [13.00, 14.50],
  [12.75, 13.20], [12.75, 13.00], [12.30, 12.75],
];
{
  const g = PLATEAUX_PUBLICS['110h'];
  const pareil = VOULU.every(([a, b], i) =>
    Math.abs(g[i][0] - a) < 0.005 && Math.abs(g[i][1] - b) < 0.005);
  ok('110h : les six plateaux sont exactement ceux demandes', pareil,
     g.map(x => `${x[0]}-${x[1]}`).join(' '));
}

// Les autres epreuves se deduisent du 110 m par le rapport des records, SAUF
// ce qui leur a ete donne en propre : le dernier niveau du tour, 40,10 a
// 41,00 s. Cette verification doit tomber bruyamment le jour ou une epreuve
// recoit son propre bareme sans qu'on l'ait ecrit ici.
const PROPRE = { '400h': { 5: [40.10, 41.00] } };
for (const c of ['100h', '400h']) {
  const r = RECORDS[c].s / RECORDS['110h'].s;
  const g = PLATEAUX_PUBLICS[c], pr = PROPRE[c] || {};
  const suit = VOULU.every(([a, b], i) => pr[i]
    ? Math.abs(g[i][0] - pr[i][0]) < 0.005 && Math.abs(g[i][1] - pr[i][1]) < 0.005
    : Math.abs(g[i][0] - a * r) < 0.01 && Math.abs(g[i][1] - b * r) < 0.01);
  ok(`${c} : se deduit du 110 m, sauf ce qui lui est propre`, suit,
     g.map(x => `${x[0]}-${x[1]}`).join(' '));
}

titre('TEST : LE BAREME EST CELUI QUI A ETE DECIDE');

// Les DIX-HUIT FOURCHETTES du 29 septembre 2026, donnees par le joueur pour
// les trois courses : plus de rapport des records. Meme garde-fou.
const VOULU_TEST = {
  '100h': [[16.15, 17.85], [14.20, 16.15], [11.85, 13.25], [11.30, 11.90], [11.30, 11.85], [10.05, 10.70]],
  '110h': [[16.50, 17.00], [14.50, 15.50], [13.20, 13.70], [12.80, 13.00], [12.75, 12.90], [11.30, 11.45]],
  '400h': [[58.00, 62.15], [51.55, 58.00], [46.50, 47.90], [46.00, 46.50], [45.80, 46.10], [39.80, 40.30]],
};
for (const c of CLES) {
  const g = PLATEAUX_TEST[c];
  const pareil = g.length === 6 && VOULU_TEST[c].every(([a, b], i) =>
    Math.abs(g[i][0] - a) < 0.005 && Math.abs(g[i][1] - b) < 0.005);
  ok(`${c} : les six plateaux sont exactement ceux demandes`, pareil,
     g.map(x => `${x[0]}-${x[1]}`).join(' '));
}

// CE QUI DIFFERE D'UN CANAL A L'AUTRE, ET C'EST VOULU :
//
//   - LE RECORD. En production, le mondial ET les Jeux mondiaux l'encadrent
//     sur les trois courses. Sur le canal de test, au 110 m seulement : ailleurs
//     les plateaux suivent la cadence que Sprinter demande, et le record tombe
//     ou elle le met — dans le national au 100 m (le moteur court ce 100 m-la
//     plus vite que le reel), dans les Jeux mondiaux au 400 m.
//   - LE PHOTO-FINISH. L'ancien bareme exigeait une demi-seconde au mondial,
//     « de quoi se detacher ». La production descend a un quart de seconde aux
//     Jeux mondiaux du 110 m, le canal de test a quinze centiemes (Jeux
//     mondiaux et ZEZE du 110 m). C'est assume : a ce niveau-la, la course DOIT
//     se jouer au centieme. On AFFICHE le plus serre a chaque passage : le jour
//     ou un niveau se jouera comme une loterie, ce sera lui qu'il faudra ouvrir.
const BAREMES = [
  { nom: 'production', g: PLATEAUX_PUBLICS, record: CLES, serre: 0.2 },
  { nom: 'test', g: PLATEAUX_TEST, record: ['110h'], serre: 0.15 },
];

titre('LE RECORD DU MONDE TOMBE AU BON ENDROIT');

for (const { nom, g, record } of BAREMES) {
  for (const c of record) {
    const R = RECORDS[c].s;
    for (const [n, i] of [['mondial', 3], ['Jeux mondiaux', 4]]) {
      const [a, b] = g[c][i];
      ok(`${nom}, ${c} : le ${n} (${a}-${b}) encadre le record ${R}`, a <= R && R <= b,
         `${a} · ${R} · ${b}`);
    }
  }
}

titre('CE QUI SE JOUE AU PHOTO-FINISH');

for (const { nom, g: P, serre: min } of BAREMES) {
  for (const c of CLES) {
    const g = P[c];
    const serre = g.reduce((m, [a, b], i) => (b - a < m.l ? { l: b - a, i } : m), { l: Infinity, i: -1 });
    ok(`${nom}, ${c} : le plus serre des six tient encore une course`, serre.l >= min - 1e-9,
       `niveau ${serre.i + 1}, ${serre.l.toFixed(2)} s entre le premier et le dernier`);
  }
}

titre('CHAQUE NIVEAU EST PLUS DUR QUE LE PRECEDENT');

for (const { nom, g: P } of BAREMES) {
  for (const c of CLES) {
    const g = P[c];
    const monte = g.every((x, i) => i === 0 || (x[0] <= g[i - 1][0] + 1e-9 && x[1] <= g[i - 1][1] + 1e-9));
    ok(`${nom}, ${c} : la progression ne recule jamais`, monte,
       g.map(x => x[0].toFixed(2)).join(' > '));
    ok(`${nom}, ${c} : six plateaux`, g.length === 6, String(g.length));
    ok(`${nom}, ${c} : chaque plateau a une largeur`, g.every(([a, b]) => b > a));
  }
}

titre('LES ZEZE PASSENT SOUS LE RECORD');

for (const { nom, g } of BAREMES) {
  for (const c of CLES) {
    const [a, b] = g[c][5];
    ok(`${nom}, ${c} : ${a} a ${b}, record ${RECORDS[c].s}`, b < RECORDS[c].s,
       `${(RECORDS[c].s - b).toFixed(2)} s sous la marque`);
  }
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
