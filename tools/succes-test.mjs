// Les succes (src/game/succes.js), sans navigateur.
//   node tools/succes-test.mjs
import { succesDu } from '../src/game/succes.js';

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};
const J = JSON.stringify;
const avec = stock => succesDu(k => stock[k] ?? null);
const gagnes = stock => avec(stock).filter(s => s.gagne).map(s => s.cle);

ok('profil vide : rien de gagne', gagnes({}).length === 0);
ok('profil illisible : rien ne casse', gagnes({ sprinter_history: '{', sprinter_vestiaire: 'null' }).length === 0);

const histo = [...Array(12)].map((_, i) => ({ r: ['100', '200', '60h'][i % 3], t: 10, d: i }));
const g = gagnes({
  sprinter_history: J(histo),
  sprinter_carrieres_gagnees_v1: J({ total: 7, avant: 4 }),
  sprinter_defis_vedettes_battus: J({ 'meba:100': true, 'meba:200': true, 'aurel:100': true, 'x:100': false }),
  'sprinter.hauteur.v1': J({ pb: { m: 1.8 } }),
  sprinter_vestiaire: J({ gagnes: ['riviera'] }),
});
ok('10 courses, pas 50', g.includes('course_10') && !g.includes('course_50'));
ok('3 epreuves dont haies et salle', g.includes('epreuves_3') && g.includes('haies') && g.includes('salle'));
ok('carrieres = total + avant (11)', g.includes('carriere_10') && !g.includes('carriere_30'));
ok('vedettes comptees une fois chacune (2)', g.includes('vedette_1') && !g.includes('vedette_3'));
ok('saut et tenue', g.includes('saut') && g.includes('tenue'));

const pieces = Object.fromEntries([...Array(12)].map((_, i) => [`sprinter_halloween_piece_${i + 1}_vue`, '1']));
const m = avec(pieces).find(s => s.cle === 'marchal');
ok('12 pieces sur 13 : progression sans victoire', m.fait === 12 && !m.gagne, J(m));
const c = avec({ sprinter_history: J(histo) }).find(s => s.cle === 'course_1');
ok('progression plafonnee au but', c.fait === 1);

console.log(echecs ? `\n${echecs} echec(s)` : '\ntout est bon');
process.exit(echecs ? 1 : 0);
