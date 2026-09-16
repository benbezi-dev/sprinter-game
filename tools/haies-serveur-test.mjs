// Les haies cote serveur, et l'accord des deux cotes sur les cles.
//
// Le jeu et le worker nomment les epreuves chacun de leur cote : RaceKey et
// les listes des ecrans d'un bord, EPREUVES et ALLOWED_RACES de l'autre. Une
// cle qui manque d'un seul cote ne plante rien — le serveur repond 400, le jeu
// affiche un classement vide, et personne ne voit pourquoi. Ce harnais relit
// les deux et verifie qu'ils disent la meme chose.

import { readFileSync } from 'node:fs';
import {
  CLES, CLES_DU_JEU, EPREUVES, directionDe, PLUS_BAS, cleDiscipline, estDiscipline,
  DISCIPLINES_SIMPLES,
} from '../worker/src/epreuves.js';
import { verifierTrace, PAS_S } from '../worker/src/preuve.js';
import { EPREUVES_DEFI } from '../worker/src/objectif.js';
import { epreuvesDeSalle } from '../worker/src/salle.js';
import { HAIES, distanceDe } from '../src/game/haies.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);
const memes = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const SPRINT = ['100', '200', '400'];
const HAIES_CLES = ['100h', '110h', '400h'];

titre('LE SERVEUR CONNAIT LES SIX EPREUVES');

ok('six cles, le sprint puis les haies', memes(CLES, [...SPRINT, ...HAIES_CLES]), CLES.join(','));
ok('chaque jeu a ses trois epreuves',
   memes(CLES_DU_JEU.sprinter, SPRINT) && memes(CLES_DU_JEU.hurdlers, HAIES_CLES));
ok('les haies se gagnent au chrono le plus bas',
   HAIES_CLES.every(c => directionDe(c) === PLUS_BAS && EPREUVES[c].pas === 10));
ok('les ecrans de duel peuvent proposer les haies',
   HAIES_CLES.every(c => DISCIPLINES_SIMPLES.includes(c)));
ok('un combine de haies se range dans l\'ordre du programme',
   cleDiscipline(['400h', '100h']) === '100h+400h' && estDiscipline('100h+400h'));
ok('le defi du jour reste au sprint', memes(EPREUVES_DEFI, SPRINT), EPREUVES_DEFI.join(','));

titre('LA SALLE DU DIRECT NE MELANGE PAS LES JEUX');

ok('une salle de haies garde ses haies', memes(epreuvesDeSalle('110h,400h'), ['110h', '400h']));
ok('la premiere epreuve decide du jeu', memes(epreuvesDeSalle('110h,100,400h'), ['110h', '400h']));
ok('une salle de sprint reste au sprint', memes(epreuvesDeSalle('100,200,110h'), ['100', '200']));
ok('rien de reconnu : le 100 m', memes(epreuvesDeSalle('4x100,zz'), ['100']) &&
   memes(epreuvesDeSalle(null), ['100']));

titre('LA PREUVE DE COURSE MESURE LA BONNE DISTANCE');

/** Une trace reguliere qui franchit `metres` a `secondes`, en decimetres. */
function trace(metres, secondes, auDela = 6) {
  const out = [];
  const n = Math.round(secondes / PAS_S);
  for (let i = 0; i <= n + auDela; i++) out.push(Math.round(metres * 10 * i / n));
  return out;
}
for (const cle of HAIES_CLES) {
  const d = distanceDe(cle);
  const t = HAIES[cle].best * 1.2;
  ok(`${cle} : une course de ${d} m en ${t.toFixed(2)} s passe`,
     verifierTrace(trace(d, t), Math.round(t * 1000), cle).length === 0,
     verifierTrace(trace(d, t), Math.round(t * 1000), cle).join(' ; '));
}
{
  const griefs = verifierTrace(trace(100, 15), 15000, '110h');
  ok('un 110 m haies arrete a 100 m est refuse',
     griefs.some(g => g.includes('110 m')), griefs.join(' ; ') || 'accepte');
}

titre('LE JEU ET LE SERVEUR DISENT LA MEME CHOSE');

const lire = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const cles = (texte, motif) => {
  const m = texte.match(motif);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : null;
};

{
  const lb = lire('src/game/leaderboard.ts');
  const type = cles(lb, /export type RaceKey = ([^;]+);/);
  ok('RaceKey nomme les six epreuves du serveur', memes(type, CLES), String(type));
  const indiv = cles(lb, /EPREUVES_INDIVIDUELLES[^=]*= new Set<RaceKey>\(\[([^\]]+)\]/);
  ok('les six ont un classement individuel cote jeu', memes(indiv, CLES), String(indiv));
}
{
  const duel = cles(lire('src/game/duels.ts'), /export const EPREUVES_DUEL = \[([^\]]+)\]/);
  ok('les combines se rangent dans le meme ordre des deux cotes', memes(duel, CLES), String(duel));
}
{
  const j = lire('src/game/jeux.ts');
  const sp = cles(j, /sprinter: \[([^\]]+)\],\n\s*hurdlers/);
  const hu = cles(j, /hurdlers: \[([^\]]+)\],\n\};/);
  ok('les epreuves de chaque jeu sont les memes des deux cotes',
     memes(sp, CLES_DU_JEU.sprinter) && memes(hu, CLES_DU_JEU.hurdlers),
     `${sp} / ${hu}`);
  ok('les cles de haies sont celles du reglement', memes(Object.keys(HAIES), HAIES_CLES));
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
