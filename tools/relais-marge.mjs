import { courirRelais } from './relais-simulation.mjs';
const SYNC = [0.04,0.04,0.04];

function bord(cad, marque) {
  // On cherche au centimetre la derniere avance qui survit.
  let bas = 0.5, haut = 30;
  for (let i = 0; i < 40; i++) {
    const m = (bas + haut) / 2;
    const x = courirRelais({ cadences:cad, marques:[marque,marque,marque], departs:[m,m,m], ecarts:SYNC });
    if (x.elimine) haut = m; else bas = m;
  }
  return bas;
}
function chrono(cad, marque, dep) {
  const x = courirRelais({ cadences:cad, marques:[marque,marque,marque], departs:[dep,dep,dep], ecarts:SYNC });
  return x.elimine ? null : x.total;
}

console.log('=== combien de millisecondes separent le meilleur choix de l elimination ?\n');
console.log('  porteur       vitesse   avance max   gain vs prudent   marge de temps');
console.log('  ------------- --------- ------------ ----------------- --------------');
for (const [nom, cad] of [
  ['rapide 100ms', [0.100,0.100,0.100,0.100]],
  ['normal 110ms', [0.110,0.110,0.110,0.110]],
  ['moyen  125ms', [0.125,0.125,0.125,0.125]],
  ['lent   145ms', [0.145,0.145,0.145,0.145]],
]) {
  const b = bord(cad, 0);
  const opt = chrono(cad, 0, b - 0.05);
  const prudent = chrono(cad, 0, Math.max(0.5, b - 4));
  // vitesse du porteur a l approche : on l estime par la physique tenue
  const v = 1.05 / (1 - Math.exp(-0.80 * cad[0]));
  const marge = (b - (b - 0.05)) ; // largeur exploree
  // combien de temps le porteur met a parcourir 1 metre
  const parMetre = 1 / Math.min(v, 12.435);
  console.log(`  ${nom.padEnd(13)} ${Math.min(v,12.435).toFixed(2)} m/s  ${b.toFixed(2)} m      ` +
    `${prudent && opt ? ('-' + (prudent-opt).toFixed(2) + ' s').padEnd(17) : '—'.padEnd(17)} ` +
    `${(parMetre*1000).toFixed(0)} ms par metre`);
}

console.log('\n=== probabilite de finir la course selon la precision du joueur');
console.log('  (trois passages ; un seul rate elimine)\n');
console.log('  ecart-type du joueur   1 passage   course entiere');
const cad = [0.110,0.110,0.110,0.110];
const b = bord(cad, 0);
const v = Math.min(1.05 / (1 - Math.exp(-0.80 * 0.110)), 12.435);
for (const sigmaMs of [40, 60, 80, 120, 160]) {
  // Le joueur vise une marge de securite optimale : il cherche a maximiser
  // sa reussite. On suppose qu'il vise b - 2*sigma converti en metres.
  const sigmaM = (sigmaMs/1000) * v;
  const vise = b - 2*sigmaM;
  // P(depasser le bord) = P(erreur > 2 sigma) = 2.3 %
  const pRate = 0.0228;
  const p1 = 1 - pRate;
  console.log(`  ${String(sigmaMs).padStart(3)} ms (${sigmaM.toFixed(2)} m)        ${(p1*100).toFixed(1)} %      ${(Math.pow(p1,3)*100).toFixed(1)} %   ` +
    (vise > 0.5 ? `(vise ${vise.toFixed(1)} m, cout ${((chrono(cad,0,vise)||0) - (chrono(cad,0,b-0.05)||0)).toFixed(2)} s)` : '(marge impossible)'));
}
