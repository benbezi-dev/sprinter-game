// Un 4x100 complet, joue de bout en bout dans la vraie physique.
//
// Le temoin est la seule verite : il part de 0 et doit arriver a 400. Chaque
// relayeur en porte une part variable — celui qui recoit a deja couru une
// partie de sa zone de lancement quand le temoin lui arrive, exactement comme
// sur une piste.
import { readFileSync } from 'fs';
new Function(readFileSync('src/game/sprinter-core.js','utf8'))();
const { C, Runner, RACES } = globalThis.SprinterCore;
const PAS = 1/240;
const R = RACES['4x100'];

/**
 * @param cadences  cadence d'appui de chacun des quatre, en secondes
 * @param avances   a quelle distance du relayeur le porteur declenche le
 *                  depart du suivant, en metres (3 valeurs)
 * @param ecarts    desynchronisation des deux touches, en secondes (3 valeurs)
 */
function courirRelais({ cadences, avances, ecarts, trace = false }) {
  const coureurs = [0,1,2,3].map(k => {
    const r = new Runner('R'+(k+1), 1, { maxSpeed: R.maxSpeed, total: 400, pool: [] });
    r.isPlayer = true;
    r.legStart = k * R.legLength;
    r.driveEnd = k === 0 ? C.DRIVE_END : C.RELAY_LAUNCH;
    r.d = r.legStart;
    r.actif = k === 0;                 // seul le premier part au pistolet
    r.aLeTemoin = k === 0;
    return r;
  });

  let t = 0, echange = 0, prochain = coureurs.map(() => 0), cote = coureurs.map(() => 0);
  const journal = [], passes = [];

  while (t < 90) {
    for (let k = 0; k < 4; k++) {
      const r = coureurs[k];
      if (!r.actif || r.finished) continue;
      if (t >= prochain[k]) {
        prochain[k] = t + cadences[k];
        r.press(cote[k] ? 'right' : 'left', t);
        cote[k] ^= 1;
      }
      r.stepPlayer(PAS, t);
    }

    // Le porteur approche : on lance le suivant.
    if (echange < 3) {
      const porteur = coureurs[echange], receveur = coureurs[echange + 1];
      const ligne = receveur.legStart;
      if (!receveur.actif && ligne - porteur.d <= avances[echange]) {
        receveur.actif = true;
        if (trace) journal.push(`${t.toFixed(2)}s  R${echange+2} s'elance (le porteur est a ${(ligne-porteur.d).toFixed(1)} m)`);
      }
      // Passage : le porteur rejoint le receveur, dans la zone.
      if (receveur.actif) {
        const dansZone = receveur.d - ligne <= C.RELAY_LAUNCH;
        // Sans temoin, on ne franchit pas le bout de la zone : le receveur
        // est cloue sur place et regarde le porteur arriver. C'est la
        // sanction reelle d'un depart trop tot — pas une penalite abstraite,
        // l'attente elle-meme.
        if (!dansZone && !receveur.aLeTemoin) {
          receveur.d = ligne + C.RELAY_LAUNCH;
          receveur.v = 0;
          receveur.bloque = true;
        }
        const rejoint = porteur.d >= receveur.d;
        if (rejoint && (dansZone || receveur.bloque)) {
          const rate = !!receveur.bloque;
          const g = receveur.gradeHandoff(ecarts[echange], !rate);
          receveur.aLeTemoin = true;
          receveur.bloque = false;
          porteur.actif = false;
          passes.push({ a: receveur.d, note: g, t });
          if (trace) journal.push(rate
            ? `${t.toFixed(2)}s  TEMOIN MANQUE : R${echange+2} a attendu au bout de la zone`
            : `${t.toFixed(2)}s  passage a ${receveur.d.toFixed(1)} m (${(receveur.d-ligne).toFixed(1)} m dans la zone) -> ${['RATE','BON','PARFAIT'][g]}`);
          echange++;
        }
      }
    }

    if (coureurs[3].finished) break;
    t += PAS;
  }
  return { total: coureurs[3].finishTime, passes, journal, coureurs };
}


const CAD = [0.110,0.110,0.110,0.110];
const SYNC = [0.04,0.04,0.04];

console.log('=== a cadence egale (110 ms), sync parfaite : que coute un temoin perdu ?');
const bon = courirRelais({ cadences:CAD, avances:[8,8,8], ecarts:SYNC });
console.log('   trois passages parfaits :', bon.total.toFixed(3), 's');
const perdu = courirRelais({ cadences:CAD, avances:[8,40,8], ecarts:SYNC });
console.log('   un temoin perdu         :', perdu.total.toFixed(3), 's   (+' + (perdu.total-bon.total).toFixed(3) + ' s)');
const rate = courirRelais({ cadences:CAD, avances:[8,8,8], ecarts:[0.04,0.30,0.04] });
console.log('   un passage rate         :', rate.total.toFixed(3), 's   (+' + (rate.total-bon.total).toFixed(3) + ' s)');


console.log('\n=== le bord de la falaise, au demi-metre');
for (let a = 11; a <= 14.5; a += 0.5) {
  const r = courirRelais({ cadences:CAD, avances:[a,a,a], ecarts:SYNC });
  const p = r.passes[0];
  const ok = r.passes.every(x => x.note >= 0);
  console.log(`   avance ${a.toFixed(1)} m -> passage a ${p.a.toFixed(1)} m (${(p.a-100).toFixed(1)} m dans la zone)  ${ok?'OK    ':'PERDU '} ${r.total.toFixed(3)} s`);
}

console.log('\n=== et si les cadences different d un relayeur a l autre ?');
for (const [nom, cad] of [['tous a 105 ms',[.105,.105,.105,.105]],
                          ['un maillon faible (3e a 145 ms)',[.105,.105,.145,.105]],
                          ['tous a 130 ms',[.130,.130,.130,.130]]]) {
  const r = courirRelais({ cadences:cad, avances:[10,10,10], ecarts:SYNC });
  const ok = r.passes.every(x => x.note >= 0);
  console.log(`   ${nom.padEnd(34)} ${r.total.toFixed(3)} s  ${ok?'':'(temoin perdu)'}`);
}
console.log('\n=== profondeur strategique : a quelle distance declencher le suivant ?');
console.log('   avance   passage a      note        total     zone utilisee');
for (const a of [2,4,6,8,10,12,14,16,18,20,24]) {
  const r = courirRelais({ cadences:CAD, avances:[a,a,a], ecarts:SYNC });
  const p = r.passes[0];
  const dans = p ? (p.a - 100) : 0;
  const notes = r.passes.map(x => x.note < 0 ? 'PERDU' : ['RATE','BON','PARF'][x.note]).join(' ');
  console.log(`   ${String(a).padStart(2)} m     ${p ? p.a.toFixed(1).padStart(6) : '  --  '} m   ${notes.padEnd(16)} ${r.total.toFixed(3)} s   ${dans.toFixed(1)} m / 30`);
}
