// La fenetre de deploiement du worker, sans reseau : le calcul seul.
//
//   node tools/fenetre-deploiement-test.mjs
//
// Le calendrier est celui du weekend du 26/09/2026, repechages compris, tel
// que `/champ/edition` le rend (voir tools/fenetre-deploiement.mjs).

import { coursesDe, fenetreEnCours, prochaine, AVANT_MS, APRES_MS } from './fenetre-deploiement.mjs';

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || detail == null ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

const SAM = Date.UTC(2026, 8, 26), DIM = SAM + 24 * 3600e3;
const a = (jour, h, m = 0) => jour + (h * 60 + m) * 60e3;
const MIN = 60e3;

const edition = {
  id: 'HMW36AHQ', zoneNom: 'France',
  calendrier: [
    { cle: 'serie-1', phase: 'series', course: 1, at: a(SAM, 9) },
    { cle: 'serie-2', phase: 'series', course: 2, at: a(SAM, 10, 30) },
    { cle: 'repechage-1950', phase: 'series', course: 6, at: a(SAM, 17, 50) },
    { cle: 'repechage-2010', phase: 'series', course: 7, at: a(SAM, 18, 10) },
    { cle: 'repechage', phase: 'series', course: 5, at: a(SAM, 18, 30) },
    { cle: 'reveal-demies', phase: 'series', reveal: true, at: a(SAM, 19) },
    { cle: 'demie-1', phase: 'demies', course: 1, at: a(DIM, 10, 30) },
    { cle: 'reveal-finale', phase: 'demies', reveal: true, at: a(DIM, 14, 30) },
    { cle: 'finale', phase: 'finale', course: 1, at: a(DIM, 19) },
    { cle: 'sacre', phase: 'finale', ceremonie: true, at: a(DIM, 19, 20) },
  ],
};
const courses = coursesDe([edition]);

console.log('\n── la fenetre de deploiement ──────────────────────────────────');
ok('seules les courses comptent, pas les revelations ni le sacre',
   courses.length === 7 && courses.every(c => !/reveal|sacre/.test(c.cle)), courses.map(c => c.cle).join(','));

ok('loin de toute course, on deploie', fenetreEnCours(courses, a(SAM, 12)) === null);
ok('21 minutes avant la serie 1, on deploie', fenetreEnCours(courses, a(SAM, 9) - 21 * MIN) === null);

const f1 = fenetreEnCours(courses, a(SAM, 9) - 19 * MIN);
ok('19 minutes avant : la chambre d\'appel va ouvrir, on attend',
   !!f1 && f1.course.cle === 'serie-1' && f1.fin === a(SAM, 9) + APRES_MS);
ok('pendant la course, on attend', !!fenetreEnCours(courses, a(SAM, 9) + 2 * MIN));
ok('au bord exact de la fin, on deploie', fenetreEnCours(courses, a(SAM, 9) + APRES_MS) === null);
ok('au bord exact du debut, on attend', !!fenetreEnCours(courses, a(SAM, 9) - AVANT_MS));

const r = fenetreEnCours(courses, a(SAM, 17, 45));
ok('les trois repechages s\'enchainent : une seule fenetre, jusqu\'apres le dernier',
   !!r && r.course.cle === 'repechage-1950' && r.fin === a(SAM, 18, 30) + APRES_MS,
   r && new Date(r.fin).toISOString());
ok('entre deux repechages, on attend toujours', !!fenetreEnCours(courses, a(SAM, 18, 25)));

ok('la revelation de 19:00 ne bloque rien', fenetreEnCours(courses, a(SAM, 19)) === null);
ok('le dimanche 12:29 (10:29 UTC), la demie bloque',
   !!fenetreEnCours(courses, a(DIM, 10, 29)));
ok('la finale bloque jusqu\'a 19:15 UTC, le sacre ne prolonge rien',
   (fenetreEnCours(courses, a(DIM, 19, 5)) || {}).fin === a(DIM, 19, 15));

const p = prochaine(courses, a(SAM, 20));
ok('la prochaine course apres samedi soir est la demie 1', !!p && p.cle === 'demie-1');

console.log(echecs ? `\n   ${echecs} ECHEC(S)\n` : '\n   tout passe\n');
process.exit(echecs ? 1 : 0);
