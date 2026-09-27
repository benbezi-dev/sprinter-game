// Le triple saut, verifie par ce qu'il doit produire.
//
//   node tools/triple-test.mjs
//
// Comme pour la longueur, le reglement a des reponses exactes et le jeu des
// proprietes. Celles du triple saut tiennent en quatre phrases : les trois
// bonds partent aux angles des finales et se partagent le saut comme chez les
// meilleurs ; le record du monde se retrouve a la vitesse d'elan qui fait
// celui de la longueur ; un cloche-pied trop haut casse la suite ; et chaque
// plateau retombe dans la fosse qu'on lui donne.

import { PLANCHE_TRIPLE, plancheDe, BONDS, RECORDS } from '../src/game/triple.js';
import { FOSSE } from '../src/game/longueur.js';
import {
  bond, jugerPose, POSE, sauterTriple, ANGLES_VISES, PLATEAU_TRIPLE,
} from '../src/game/triple-jeu.js';
import { RAMENE_VISE } from '../src/game/longueur-jeu.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const parfait = (v, angles, extra = {}) => sauterTriple({
  vElan: v, ecart: 0, angles, poses: [0, 0], pieds: [true, true], avance: RAMENE_VISE, ...extra,
});
function optimum(v) {
  let best = { m: 0, a: null };
  for (let a1 = 8; a1 <= 26; a1++) for (let a2 = 8; a2 <= 26; a2++) for (let a3 = 12; a3 <= 30; a3++) {
    const r = parfait(v, [a1, a2, a3]);
    if (r.metres > best.m) best = { m: r.metres, a: [a1, a2, a3], r };
  }
  return best;
}

titre('le reglement');
ok('planche a 13 m aux grandes competitions, 11 m chez les femmes',
   PLANCHE_TRIPLE.hommes === 13 && PLANCHE_TRIPLE.femmes === 11);
ok('le fond de la fosse a 21 m au moins de la planche d\'elite',
   plancheDe(3) + (FOSSE.fond - FOSSE.debut) >= PLANCHE_TRIPLE.fondMin);
ok('cloche-pied sur le meme pied, foulee sur l\'autre, puis le saut',
   BONDS[0].pied === 'meme' && BONDS[1].pied === 'autre' && BONDS[2].cle === 'saut');
ok('records : 18,29 m (Edwards, 1995) et 15,74 m (Rojas, 2022)',
   RECORDS.hommes.m === 18.29 && RECORDS.hommes.an === 1995 && RECORDS.femmes.m === 15.74);

titre('les trois bonds, a 11,1 m/s d\'elan');
const o = optimum(11.1);
const [c, f, s] = o.r.bonds;
ok('le record du monde a moins de 25 cm', Math.abs(o.m - RECORDS.hommes.m) < 0.25, o.m.toFixed(2));
ok('le cloche-pied part entre 13 et 17°', o.a[0] >= 13 && o.a[0] <= 17, o.a[0] + '°');
ok('la foulee entre 12 et 18°', o.a[1] >= 12 && o.a[1] <= 18, o.a[1] + '°');
ok('le saut entre 18 et 23°', o.a[2] >= 18 && o.a[2] <= 23, o.a[2] + '°');
ok('les angles vises de la jauge sont les bons, a 1,5° pres',
   o.a.every((a, i) => Math.abs(a - ANGLES_VISES[i]) <= 1.5), o.a.join('/') + ' vs ' + ANGLES_VISES.join('/'));
const pc = x => 100 * x / (c + f + s);
ok('cloche-pied 34-39 %, foulee 27-32 %, saut 31-37 %',
   pc(c) >= 34 && pc(c) <= 39 && pc(f) >= 27 && pc(f) <= 32 && pc(s) >= 31 && pc(s) <= 37,
   [c, f, s].map(x => pc(x).toFixed(0)).join('/'));
ok('la vitesse baisse a chaque appui, d\'un demi a deux m/s',
   o.r.vitesses.slice(1).every((v, i) => o.r.vitesses[i] - v > 0.4 && o.r.vitesses[i] - v < 2.0),
   o.r.vitesses.map(v => v.toFixed(2)).join(' → '));

titre('un cloche-pied trop haut casse la suite');
{
  const bas = parfait(11.1, [15, 16, 20]), haut = parfait(11.1, [26, 16, 20]);
  ok('le cloche-pied haut est plus long', haut.bonds[0] > bas.bonds[0] - 0.3,
     `${haut.bonds[0].toFixed(2)} vs ${bas.bonds[0].toFixed(2)}`);
  ok('mais le saut entier est plus court', haut.metres < bas.metres - 0.3,
     `${haut.metres.toFixed(2)} vs ${bas.metres.toFixed(2)}`);
  ok('et ce sont les deux bonds suivants qui le paient',
     haut.bonds[1] + haut.bonds[2] < bas.bonds[1] + bas.bonds[2] - 0.5);
}

titre('les poses');
ok('un rien en avance : actif', jugerPose(-0.03).note === 'actif');
ok('un rien en retard : actif aussi', jugerPose(0.03).note === 'actif');
ok('un dixieme : bon', jugerPose(0.09).note === 'bon');
ok('deux dixiemes : ecrase', jugerPose(0.2).note === 'ecrase');
ok('passe trois dixiemes : le bond est casse', jugerPose(POSE.casse + 0.01).note === 'rompu');
ok('beaucoup trop tot : ce n\'est pas encore une pose', jugerPose(-0.2).note === 'tot');
{
  const a = parfait(11.1, ANGLES_VISES).metres;
  const b = parfait(11.1, ANGLES_VISES, { poses: [0.2, 0.2] }).metres;
  ok('deux poses ecrasees coutent plus d\'un metre', a - b > 1.0, (a - b).toFixed(2));
  const r = parfait(11.1, ANGLES_VISES, { poses: [0.4, 0] });
  ok('un bond casse : pas de marque', r.mordu && r.raison === 'rompu' && r.marque === null);
}

titre('les fautes');
{
  const p = parfait(11.1, ANGLES_VISES, { pieds: [false, true] });
  ok('mauvais pied au cloche-pied : nul', p.mordu && p.raison === 'pied');
  const q = parfait(11.1, ANGLES_VISES, { pieds: [true, false] });
  ok('mauvais pied a la foulee : nul', q.mordu && q.raison === 'pied');
  const m = parfait(11.1, ANGLES_VISES, { ecart: -0.03 });
  ok('pied au-dela de la ligne : mordu', m.mordu && m.raison === 'planche');
  const a = parfait(11.1, ANGLES_VISES, { ecart: 0 }).metres;
  const b = parfait(11.1, ANGLES_VISES, { ecart: 0.25 }).metres;
  ok('la mesure part de la ligne : 25 cm d\'appel manque coutent 25 cm', Math.abs(a - b - 0.25) < 1e-9);
}

titre('chaque plateau retombe dans sa fosse');
for (let et = 0; et < 6; et++) {
  const [lo, hi] = PLATEAU_TRIPLE[et];
  const pl = plancheDe(et), fond = pl + (FOSSE.fond - FOSSE.debut);
  ok(`etape ${et} : planche a ${pl} m, plateau ${lo.toFixed(2)}-${hi.toFixed(2)} dans le sable (${pl}-${fond} m)`,
     lo > pl + 0.5 && hi < fond - 0.3);
}
{
  const top = optimum(11.6 * 1.042).m;
  ok('au plafond du moteur, transition parfaite : le meilleur ZEZE se bat, et le sable suffit',
     top > PLATEAU_TRIPLE[5][1] && top < plancheDe(5) + FOSSE.fond - FOSSE.debut, top.toFixed(2));
  ok('sans la transition, il ne se bat pas', optimum(11.6).m < PLATEAU_TRIPLE[5][1], optimum(11.6).m.toFixed(2));
  ok('le championnat du monde reste sous le record', PLATEAU_TRIPLE[3][1] < RECORDS.hommes.m);
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
