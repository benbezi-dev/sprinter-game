/* Verification du moteur de championnat, sans base ni reseau. */
import { serpentin, desequilibre, ordonner, qualifier, podium, calendrier, prochain,
         formatDynamique }
  from '../worker/src/championnats-moteur.js';
import { FORMAT, CALENDRIER, FORMAT_REDUIT_MIN } from '../worker/src/championnats-config.js';

let ok = 0, ko = 0;
const dit = (b, m) => { if (b) { ok++; console.log('   ✓ ' + m); } else { ko++; console.log('   ✗ ' + m); } };

// --- des joueurs classes 1 a 32 -------------------------------------------
const joueurs = Array.from({ length: 32 }, (_, i) => ({
  cle: 'j' + String(i + 1).padStart(2, '0'), nom: 'Joueur ' + (i + 1), rang: i + 1,
}));

console.log('\n=== 1. le serpentin repartit a parite de niveau');
const series = serpentin(joueurs, 4);
dit(series.length === 4, '4 series');
dit(series.every(c => c.length === 8), '8 partants dans chacune');
const sommes = series.map(c => c.reduce((s, j) => s + j.rang, 0));
console.log('     sommes des rangs :', sommes.join('  '), ' — ecart', desequilibre(series));
dit(desequilibre(series) <= 4, 'ecart entre series negligeable (<= 4)');
const tous = new Set(series.flat().map(j => j.cle));
dit(tous.size === 32, 'aucun joueur perdu ni duplique');
dit(series[0][0].rang === 1 && series[3][0].rang === 4, 'les quatre premiers sont separes');

console.log('\n=== 2. les series : 8 directs + 8 repeches = 16');
// Chrono : d'autant meilleur que le rang est bon, avec du bruit reproductible.
const chrono = (j, bruit) => 9500 + j.rang * 18 + bruit;
const resultatsSeries = series.map((c, ic) =>
  c.map((j, ij) => ({ ...j, ms: chrono(j, ((ij * 37 + ic * 11) % 13) * 7) })));
const q1 = qualifier(resultatsSeries, FORMAT.phases[0]);
dit(q1.directs.length === 8, '8 qualifies directs (2 par serie)');
dit(q1.repeches.length === 8, '8 repeches au chrono');
dit(q1.directs.length + q1.repeches.length === 16, '16 qualifies pour les demies');
dit(q1.elimines.length === 16, '16 elimines');
const dbl = new Set([...q1.directs, ...q1.repeches].map(r => r.cle));
dit(dbl.size === 16, 'aucun qualifie compte deux fois');
dit(q1.directs.every(r => r.place <= 2), 'les directs sont bien les deux premiers de leur serie');

console.log('\n=== 3. le repechage regarde le chrono, pas la place');
// Une serie tres rapide et une tres lente : un 4e de la rapide doit passer
// devant un 3e de la lente.
const rapide = [1,2,3,4,5,6,7,8].map(i => ({ cle: 'r'+i, rang: i, ms: 9400 + i * 5 }));
const lente  = [1,2,3,4,5,6,7,8].map(i => ({ cle: 'l'+i, rang: 20+i, ms: 9900 + i * 5 }));
const q = qualifier([rapide, lente], { directsParCourse: 2, repechages: 2 });
const clesRep = q.repeches.map(r => r.cle);
console.log('     repeches :', clesRep.join(', '));
dit(clesRep.every(c => c.startsWith('r')), 'les deux repeches viennent de la serie rapide');

console.log('\n=== 4. un abandon ne se repeche jamais');
const avecAbandon = [
  [{cle:'a1',rang:1,ms:9500},{cle:'a2',rang:2,ms:9600},{cle:'a3',rang:3,ms:null},{cle:'a4',rang:4,ms:9900}],
];
const qa = qualifier(avecAbandon, { directsParCourse: 2, repechages: 2 });
dit(!qa.repeches.some(r => r.cle === 'a3'), 'l abandon reste elimine malgre une place de repechage libre');
dit(qa.repeches.length === 1, 'on ne repeche que ce qui est repechable');
dit(ordonner(avecAbandon[0])[3].cle === 'a3', 'l abandon est classe dernier');

console.log('\n=== 5. deux chronos rigoureusement egaux se departagent');
const ex = [
  { cle: 'z', rang: 9, msPrecedent: 9700, ms: 9800 },
  { cle: 'a', rang: 4, msPrecedent: 9700, ms: 9800 },
  { cle: 'm', rang: 2, msPrecedent: 9600, ms: 9800 },
];
const o = ordonner(ex).map(r => r.cle);
console.log('     ordre obtenu :', o.join(' < '));
dit(o[0] === 'm', 'le meilleur chrono de la phase precedente passe devant');
dit(o[1] === 'a' && o[2] === 'z', 'a chrono precedent egal, le meilleur rang duel passe');
dit(ordonner(ex).map(r=>r.cle).join() === ordonner([...ex].reverse()).map(r=>r.cle).join(),
    'le resultat ne depend pas de l ordre d entree');

console.log('\n=== 6. la finale : podium et champion');
const finale = Array.from({ length: 8 }, (_, i) => ({ cle: 'f'+i, rang: i+1, ms: 9600 + i * 12 }));
const p = podium(finale, FORMAT.phases[2].podium);
dit(p.podium.length === 3, 'un podium de trois');
dit(p.champion.cle === 'f0', 'le champion est le meilleur chrono de la finale');
dit(p.classement.length === 8, 'les huit sont classes');

console.log('\n=== 7. le calendrier du weekend');
const samedi = Date.UTC(2026, 8, 5, 0, 0, 0);      // samedi 5 septembre 2026
const rv = calendrier(samedi, CALENDRIER);
dit(rv.length === 10, '10 rendez-vous sur le weekend');
const h = t => new Date(t).toISOString().slice(5, 16).replace('T', ' ');
for (const r of rv) console.log(`     ${h(r.at)}  ${r.cle}`);
const s1 = rv.find(r => r.cle === 'serie-1').at, s2 = rv.find(r => r.cle === 'serie-2').at;
dit(s2 - s1 >= 90 * 60000, 'au moins 1h30 entre deux series');
dit(rv.find(r => r.cle === 'reveal-demies').at > rv.find(r => r.cle === 'serie-4').at,
    'les repeches ne sont reveles qu apres la derniere serie');
dit(rv.find(r => r.cle === 'sacre').at > rv.find(r => r.cle === 'finale').at,
    'le sacre suit la finale');
dit(prochain(rv, samedi).cle === 'serie-1', 'le premier rendez-vous est la serie 1');

console.log('\n=== 8. le format reduit : un championnat garde sa forme a tout effectif');
// Ce qu'on verifie n'est pas une valeur mais des invariants : un format dont
// les portes ne mènent pas exactement a l'effectif de la phase suivante produit
// une competition qui a l'air normale et qui perd — ou invente — des coureurs.
for (const n of [4, 6, 8, 9, 12, 16, 20, 24, 31, 32]) {
  const f = formatDynamique(n);
  const [p0, p1, p2] = f.phases;
  const sorties = [
    p0.directsParCourse * p0.courses + p0.repechages,
    p1.directsParCourse * p1.courses + p1.repechages,
  ];
  const ligne = `n=${String(n).padStart(2)} : ` + f.phases.map(p =>
    `${p.cle}(${p.courses}x${p.parCourse}, ${p.directsParCourse}d+${p.repechages}r)`).join(' → ');
  console.log('     ' + ligne);

  dit(f.phases.length === 3, `n=${n} : trois phases, jamais moins`);
  dit(f.phases.every(p => p.parCourse <= 8), `n=${n} : jamais plus de 8 par course`);
  dit(f.phases.every(p => p.courses * p.parCourse >= 1), `n=${n} : chaque phase a une course`);
  dit(p0.courses * p0.parCourse >= n || n > FORMAT.partants,
      `n=${n} : les series ont de la place pour tout le monde`);
  dit(sorties[0] === p1.courses * p1.parCourse ||
      sorties[0] <= p1.courses * p1.parCourse,
      `n=${n} : les qualifies des series tiennent dans les demies`);
  dit(sorties[1] === p2.parCourse, `n=${n} : les demies remplissent exactement la finale`);
  dit(f.phases.every(p => p.repechages >= 0), `n=${n} : aucun repechage negatif`);
  dit(p2.parCourse <= 8 && p2.parCourse === Math.min(8, n), `n=${n} : finale a ${Math.min(8, n)}`);
  dit(p2.podium <= p2.parCourse && p2.podium <= 3, `n=${n} : podium tenable`);
}

console.log('\n=== 9. les bornes du format reduit');
dit(formatDynamique(2).partants === FORMAT_REDUIT_MIN, 'sous le plancher, on remonte au plancher');
dit(formatDynamique(99).partants === FORMAT.partants, 'au-dessus de 32, on redescend a 32');
const f32 = formatDynamique(32);
dit(f32.phases[0].courses === FORMAT.phases[0].courses &&
    f32.phases[0].directsParCourse === FORMAT.phases[0].directsParCourse &&
    f32.phases[0].repechages === FORMAT.phases[0].repechages,
    'a 32, le format calcule retombe sur le format nominal');
dit(FORMAT.partants === 32 && FORMAT.phases[0].courses === 4,
    'le format nominal n est pas remplace par le calcul');

console.log('\n=== 10. le calendrier ne montre que les courses qui existent');
const samedi2 = Date.UTC(2026, 8, 5);
const f12 = formatDynamique(12);
const rv12 = calendrier(samedi2, CALENDRIER, f12);
const cles12 = rv12.map(r => r.cle);
console.log('     ' + cles12.join('  '));
dit(!cles12.includes('serie-3') && !cles12.includes('serie-4'),
    `les series surnumeraires disparaissent (${f12.phases[0].courses} series)`);
dit(cles12.includes('serie-1') && cles12.includes('serie-2'), 'les series reelles restent');
dit(cles12.includes('reveal-demies') && cles12.includes('reveal-finale') &&
    cles12.includes('sacre'), 'les reveals et le sacre ne dependent pas du nombre de courses');
dit(cles12.filter(c => c.startsWith('demie-')).length === f12.phases[1].courses,
    'autant de creneaux de demies que de demies');
dit(calendrier(samedi2, CALENDRIER).length === 10,
    'sans format donne, le calendrier nominal est inchange');
const f6 = formatDynamique(6);
const cles6 = calendrier(samedi2, CALENDRIER, f6).map(r => r.cle);
dit(cles6.filter(c => c.startsWith('serie-')).length === 1 &&
    cles6.filter(c => c.startsWith('demie-')).length === 1,
    'a six partants, une serie et une demie');

console.log(`\n${ko === 0 ? 'TOUT PASSE' : 'ECHECS'} — ${ok} verifications, ${ko} echec(s)\n`);
process.exit(ko === 0 ? 0 : 1);
