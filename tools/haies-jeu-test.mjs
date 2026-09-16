// Les regles du jeu de haies, verifiees par ce qu'elles doivent produire.
//
// Le fichier de geometrie se teste contre le reglement : il y a une reponse
// exacte, on la compare. Les regles du jeu n'ont pas de reponse exacte — elles
// ont des PROPRIETES, et ce sont elles qu'on verifie ici.
//
// La premiere de ces proprietes a deja ete violee une fois, et c'est pour cela
// qu'elle est en tete : sur le tour, l'ancienne regle de parite faisait
// qu'accelerer de 2,20 a 2,40 m de foulee DEGRADAIT le rythme, avant que 2,60
// le repare. Un jeu ou le progres peut nuire n'est pas difficile, il est casse.
// Rien dans le fichier de geometrie ne pouvait le montrer.

import '../src/game/sprinter-core.js';
import {
  APPEL, TOLERANCE, GARDE, GARDE_RYTHME_ROMPU,
  appuisPour, rythmeDe, jugerAppel, franchir, simuler, fouleeRelative,
} from '../src/game/haies-jeu.js';
import { PLATEAUX, HAIES, APPUIS } from '../src/game/haies.js';

const { Runner } = globalThis.SprinterCore;

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const CLES = ['100h', '110h', '400h'];

// Le coureur type de chaque epreuve, a une vitesse donnee. SA FOULEE EST CELLE
// DU MOTEUR : le coureur du joueur, avec la foulee du hurdleur de l'epreuve,
// mesure a cette vitesse. Une formule a part avait vecu ici ; elle donnait
// 3,35 m de foulee a 11,5 m/s sur le tour, une enjambee qu'aucun coureur du jeu
// ne fait, et la simulation calait alors les plateaux sur un rythme que la
// course ne produit pas. L'usure suit la vitesse : le tour se paie plus cher
// que la ligne droite.
const fouleeMoteur = (cle, v) => {
  const r = new Runner('TOI', 3, { isPlayer: true, maxSpeed: HAIES[cle].maxSpeed });
  r.foulee = HAIES[cle].foulee;
  r.v = v;
  return r.strideLength();
};
const coureur = (cle, v) => ({
  vitesse: v, foulee: fouleeMoteur(cle, v),
  usure: cle === '400h' ? 0.28 - 0.019 * v : 0.02,
});

titre('ACCELERER NE PEUT JAMAIS NUIRE');

// La propriete qui compte plus que toutes les autres. On balaie toute la
// plage jouable au demi-dixieme : aucun pas ne doit rendre le chrono pire.
for (const c of CLES) {
  let pire = null, precedent = Infinity;
  for (let v = 7.0; v <= 10.4; v += 0.05) {
    const t = simuler(c, coureur(c, v)).temps;
    if (t > precedent + 1e-9 && !pire) pire = `a ${v.toFixed(2)} m/s : ${t} apres ${precedent}`;
    precedent = t;
  }
  ok(`${c} : le chrono ne remonte jamais quand la vitesse monte`, !pire, pire);
}

titre('CHAQUE PLATEAU EST ATTEIGNABLE');

// Un niveau qu'aucune vitesse ne permet d'atteindre est un niveau mort : le
// joueur le voit dans la liste et ne peut pas y entrer. C'est exactement ce
// qui arrivait au 110 m avant la reprise — un trou de deux secondes entre le
// niveau olympique et le regional.
for (const c of CLES) {
  const atteints = new Set();
  for (let v = 6.0; v <= 11.5; v += 0.02) {
    const t = simuler(c, coureur(c, v)).temps;
    PLATEAUX[c].forEach(([a, b], i) => { if (t >= a && t <= b) atteints.add(i); });
  }
  const manquants = [0, 1, 2, 3, 4, 5].filter(i => !atteints.has(i));
  ok(`${c} : les six plateaux se laissent atteindre`, manquants.length === 0,
     `niveaux hors de portee : ${manquants.join(', ')}`);
}

titre('LE RYTHME EST UNE CONSEQUENCE, PAS UN REGLAGE');

for (const c of CLES) {
  const h = HAIES[c].haies, a = APPEL[c];
  const courue = h.ecart - a.avant - a.apres;
  // A la foulee ideale de l'epreuve, on doit tomber dans le rythme du
  // reglement. Sans cela, la cible annoncee au joueur serait un mensonge.
  const [min, max] = APPUIS[c].intervalle;
  const vise = Math.round((min + max) / 2);
  const ideale = courue / (vise - 1);
  ok(`${c} : la foulee de ${ideale.toFixed(2)} m donne les ${vise} appuis vises`,
     appuisPour(c, ideale) === vise, String(appuisPour(c, ideale)));

  // A pleine vitesse, la foulee du moteur tient le rythme. C'est ce que la
  // foulee du hurdleur a ete calee pour donner.
  const pleine = appuisPour(c, fouleeMoteur(c, HAIES[c].maxSpeed));
  ok(`${c} : a pleine vitesse, ${pleine} appuis tiennent le rythme`,
     rythmeDe(c, pleine, 'intervalle').tenu, `${pleine} hors de ${min}-${max}`);

  // Plus lent veut dire plus d'appuis, toujours.
  let monte = true;
  for (let f = 1.2; f < 3.2; f += 0.01)
    if (appuisPour(c, f) > appuisPour(c, f - 0.01)) monte = false;
  ok(`${c} : allonger la foulee ne rajoute jamais d'appui`, monte);
}

titre('LE RYTHME SE COMPTE COMME L ENTRAINEUR LE COMPTE');

for (const c of ['100h', '110h']) {
  ok(`${c} : sept appuis jusqu a la premiere tiennent`, rythmeDe(c, 7, 'premiere').tenu);
  ok(`${c} : six ou huit la rompent`,
     !rythmeDe(c, 6, 'premiere').tenu && !rythmeDe(c, 8, 'premiere').tenu);
  ok(`${c} : quatre appuis par intervalle tiennent`, rythmeDe(c, 4).tenu);
  ok(`${c} : trois, cinq ou six rompent`,
     !rythmeDe(c, 3).tenu && !rythmeDe(c, 5).tenu && !rythmeDe(c, 6).tenu,
     'le nombre, et non plus la parite');
}
{
  const tient = n => rythmeDe('400h', n, 'premiere').tenu;
  ok('400h : de 21 a 23 appuis jusqu a la premiere, tout tient',
     [21, 22, 23].every(tient));
  ok('400h : 20 ou 24 rompent', !tient(20) && !tient(24));
  const int = n => rythmeDe('400h', n).tenu;
  ok('400h : de 13 a 17 appuis par intervalle, tout tient',
     [13, 14, 15, 16, 17].every(int));
  ok('400h : 12 ou 18 rompent', !int(12) && !int(18));
}
ok('l ecart dit de combien on sort, et dans quel sens',
   rythmeDe('110h', 6).ecart === 2 && rythmeDe('400h', 11).ecart === -2);

titre('L APPEL SE PAIE A SA JUSTE MESURE');

for (const c of CLES) {
  const vise = APPEL[c].avant;
  ok(`${c} : l appel juste ne coute rien`,
     jugerAppel(c, vise).note === 'parfait' && jugerAppel(c, vise).garde === 1);
  ok(`${c} : trop pres, on hache`,
     jugerAppel(c, vise - TOLERANCE.bon - 0.1).note === 'hache');
  ok(`${c} : trop loin, on plane`,
     jugerAppel(c, vise + TOLERANCE.bon + 0.1).note === 'plane');
}

ok('hacher coute plus cher que planer', GARDE.hache < GARDE.plane,
   'un appel court ne se rattrape pas');
ok('un rythme rompu coute, mais moins qu un appel hache',
   GARDE.hache < GARDE_RYTHME_ROMPU && GARDE_RYTHME_ROMPU < 1);

// Les deux causes se multiplient : la haie ou l'on tombe est celle ou le
// rythme perdu rencontre le mauvais appel.
const seul = franchir('110h', 10, APPEL['110h'].avant - 1, true).v;
const double = franchir('110h', 10, APPEL['110h'].avant - 1, false).v;
ok('rythme rompu ET appel hache coutent plus que l un des deux',
   double < seul, `${double.toFixed(2)} contre ${seul.toFixed(2)}`);

titre('UNE FAUTE NE S INSTALLE PAS');

// Le defaut qui avait creuse le trou de deux secondes : chaque penalite
// retirait de la vitesse pour toujours, et dix haies manquees divisaient la
// course par deux. Une faute doit couter sur son intervalle, pas sur la
// course.
for (const c of CLES) {
  const propre = simuler(c, { ...coureur(c, 9.0), precision: 1 });
  const sale = simuler(c, { ...coureur(c, 9.0), precision: 0 });
  const perte = (sale.temps - propre.temps) / propre.temps;
  ok(`${c} : dix appels rates coutent ${(100 * perte).toFixed(1)} %, pas la course`,
     perte > 0.01 && perte < 0.25,
     `${propre.temps} contre ${sale.temps}`);
}

titre('LA FOULEE SUIT LA COURBE DU MOTEUR');

ok('a pleine vitesse, la foulee est entiere', Math.abs(fouleeRelative(1) - 1) < 1e-9);
ok('a 80 % de vitesse, la foulee perd environ 11 %',
   fouleeRelative(0.8) > 0.86 && fouleeRelative(0.8) < 0.92,
   fouleeRelative(0.8).toFixed(3));
// Le plancher n'est pas un choix : c'est l'amplitude de 34 % du moteur, qui
// donne 0,366 a l'arret. Ce qui compte n'est pas cette valeur mais la pente
// dans la plage ou l'on court vraiment — c'est elle qui decide si une perte
// de vitesse rajoute un appui, et donc si une course peut s'emballer.
ok('a 70 % de vitesse, la foulee garde plus de 80 %',
   fouleeRelative(0.7) > 0.80,
   `${fouleeRelative(0.7).toFixed(3)} — une perte de vitesse ne doit pas doubler en perte de foulee`);
ok('le plancher est celui du moteur, pas un autre',
   Math.abs(fouleeRelative(0) - 0.366) < 0.005, fouleeRelative(0).toFixed(3));
let croit = true;
for (let p = 0; p <= 1; p += 0.01)
  if (fouleeRelative(p) < fouleeRelative(Math.max(0, p - 0.01)) - 1e-9) croit = false;
ok('elle grandit avec la vitesse, sans exception', croit);

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
