// L'edition speciale du Danube — ce qu'elle promet, et ce qu'elle s'interdit.
//
// Deux moities, et la seconde est la plus importante.
//
// La premiere verifie le stade : qu'il existe, qu'il est ouvert a la version
// publique, que son plateau tombe ou il doit tomber sur l'echelle du jeu, et
// que l'index sous lequel il voyage veut dire la meme chose sur les deux
// canaux. Ce sont des regles de jeu, elles se cassent en silence.
//
// La seconde verifie qu'AUCUN NOM REEL n'entre dans le jeu. Une competition
// deposee, un stade qui porte le nom d'un homme, sept athletes vivants : rien
// de tout cela ne doit se retrouver dans ce qui part chez le joueur. C'est le
// genre de chose qui se reintroduit six mois plus tard, dans une ligne ajoutee
// de bonne foi par quelqu'un qui trouvait ca plus vivant — d'ou ce test, qui
// relit les fichiers eux-memes plutot que de faire confiance a la memoire.
//
//   node tools/edition-danube-test.mjs

import { readFileSync } from 'fs';
import { EDITION_DANUBE, EDITIONS, editionEnCours, editionActive, joursRestants }
  from '../src/game/edition.ts';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// Le moteur se charge comme le font les autres harnais : evalue tel quel,
// sans passer par Vite, qui n'existe pas ici.
const g = {};
new Function('globalThis', lire('src/game/sprinter-core.js')).call(g, g);
const K = g.SprinterCore;
const STADES = K.STADES_HORS_SERIE;
const danube = STADES.find(s => s.cle === 'danube');

titre('LE STADE EXISTE, ET IL EST OUVERT');

ok('le stade du Danube est declare', !!danube);
ok('il est hors serie', !!danube && danube.horsSerie === true);
ok('il est ouvert a la version publique', !!danube && danube.ouvert === true);
ok('il porte son propre remplissage de gradins',
   !!danube && typeof danube.foule === 'number' && danube.foule > 0 && danube.foule <= 1,
   String(danube && danube.foule));
ok('les trois stades hors serie portent tous une foule',
   STADES.every(s => typeof s.foule === 'number'),
   STADES.filter(s => typeof s.foule !== 'number').map(s => s.cle).join(', '));

titre("L'ORDRE DES STADES EST UN CONTRAT");

// Les stades ouverts d'abord. Sans cette regle, l'index 6 designe un stade
// sur le canal de test et un autre en production — et le classement affiche
// le nom du mauvais.
const rangs = STADES.map(s => (s.ouvert ? 0 : 1));
ok('les stades ouverts viennent avant les stades fermes',
   rangs.every((r, i) => i === 0 || rangs[i - 1] <= r),
   STADES.map(s => s.cle + (s.ouvert ? '(ouvert)' : '')).join(' → '));

// Les noms affiches vivent dans les traductions, a la suite des six etapes,
// et DANS LE MEME ORDRE. Une seule ligne decalee et chaque stade prend le nom
// du suivant.
const i18n = lire('src/game/sprinter-i18n.js');
const bloc = i18n.slice(i18n.indexOf('const LEVEL_NAMES = ['));
const noms = [...bloc.slice(0, bloc.indexOf('];')).matchAll(/\['([^']+)',\s*'([^']+)'\]/g)]
  .map(m => [m[1], m[2]]);
ok('six etapes plus un nom par stade hors serie',
   noms.length === 6 + STADES.length, `${noms.length} noms pour ${6 + STADES.length} attendus`);
STADES.forEach((s, i) => {
  const attendu = s.name;
  const trouve = noms[6 + i] && noms[6 + i][0];
  ok(`rang ${6 + i} : « ${attendu} »`, trouve === attendu, String(trouve));
});

titre('LE PLATEAU TOMBE OU IL DOIT TOMBER');

// Les six etapes du championnat, pour situer le plateau du Danube.
const monde = K.RACES['100'].ranges[3];   // championnat du monde
const jo = K.RACES['100'].ranges[4];      // finale olympique
const zeze = K.RACES['100'].ranges[5];    // finale intergalactique
const d100 = danube.plateau['100'];

ok('quatre epreuves au plateau (100 / 200 / 400 / 4x100)',
   ['100', '200', '400', '4x100'].every(c => Array.isArray(danube.plateau[c])),
   Object.keys(danube.plateau).join(', '));
ok('chaque fourchette est croissante',
   Object.values(danube.plateau).every(([a, b]) => b > a));
ok(`plus rapide que le championnat du monde (${monde[1]} s)`, d100[1] < monde[1],
   `${d100[1]} contre ${monde[1]}`);
ok(`sous la finale olympique par le haut (${jo[1]} s)`, d100[1] > jo[0],
   `${d100[1]} contre ${jo[0]}`);
ok(`tres loin au-dessus des ZEZE (${zeze[1]} s)`, d100[0] > zeze[1],
   `${d100[0]} contre ${zeze[1]}`);

titre('SEPT ADVERSAIRES, TOUS INVENTES');

ok('sept noms sur la ligne', danube.names.length === 7, String(danube.names.length));
ok('aucun doublon avec un autre plateau du jeu', (() => {
  const ailleurs = new Set();
  for (const l of K.LEVELS) for (const n of l.names) ailleurs.add(n);
  for (const s of STADES) if (s !== danube) for (const n of s.names) ailleurs.add(n);
  return danube.names.every(n => !ailleurs.has(n));
})());

titre("LA FENETRE DE L'EDITION");

ok('une seule edition declaree pour l instant', EDITIONS.length === 1);
ok('elle pointe le stade du Danube', EDITION_DANUBE.stade === 'danube');
ok('la fin vient apres le debut', EDITION_DANUBE.fin > EDITION_DANUBE.debut);
ok('elle dure au moins trois jours',
   EDITION_DANUBE.fin - EDITION_DANUBE.debut >= 3 * 86400000,
   ((EDITION_DANUBE.fin - EDITION_DANUBE.debut) / 86400000).toFixed(1) + ' jours');

// Les bornes, a la milliseconde. Une edition « en cours » la milliseconde qui
// suit sa fin est une banniere qui ne s'eteint jamais.
ok('fermee une milliseconde avant le debut',
   editionEnCours(EDITION_DANUBE.debut - 1) === null);
ok('ouverte a la milliseconde du debut',
   editionEnCours(EDITION_DANUBE.debut) === EDITION_DANUBE);
ok('ouverte une milliseconde avant la fin',
   editionEnCours(EDITION_DANUBE.fin - 1) === EDITION_DANUBE);
ok('fermee a la milliseconde de la fin',
   editionEnCours(EDITION_DANUBE.fin) === null);
ok('editionActive dit la meme chose que editionEnCours',
   [-1, 0, 1000, EDITION_DANUBE.fin - EDITION_DANUBE.debut].every(d => {
     const t = EDITION_DANUBE.debut + d;
     return editionActive(EDITION_DANUBE, t) === (editionEnCours(t) !== null);
   }));
ok('le decompte tombe a zero le dernier jour',
   joursRestants(EDITION_DANUBE, EDITION_DANUBE.fin - 1000) === 0);
ok('le decompte ne devient jamais negatif',
   joursRestants(EDITION_DANUBE, EDITION_DANUBE.fin + 86400000 * 30) === 0);

titre('AUCUN NOM REEL DANS CE QUI PART CHEZ LE JOUEUR');

// Ce que l'edition s'interdit de nommer. Trois familles : la competition et
// son organisateur, le stade reel, et les athletes qui y courent.
//
// Pourquoi « Budapest » et « Hongrie » sont dans la liste alors qu'un nom de
// ville ne se depose pas : parce que la ligne qu'on tient est plus simple a
// defendre que le droit des marques — LE JEU NE NOMME RIEN DE REEL. Un stade
// qui porte le nom d'un fleuve et des couleurs relevees sur photo, voila tout.
// La communication, elle, a le droit de citer des faits ; ce test ne parle que
// du jeu.
const INTERDITS = [
  'World Athletics', 'Ultimate Championship', 'Ultimate Champion', 'WAUC',
  'Nemzeti', 'Atletikai', 'Atlétikai', 'Kozpont', 'Zsivotzky', 'Mondotrack',
  'Budapest', 'Hongrie', 'Hungary', 'Magyar',
  'Duplantis', 'Lyles', 'Seville', 'Richardson', 'Ingebrigtsen', 'Mahuchikh',
  'Iapichino', 'Niekerk', 'Tharp', 'Ajayi', 'Eseme', 'Jefferson-Wooden',
];

// On relit les fichiers que le joueur recoit, en retirant les commentaires :
// une note de code qui cite la federation pour justifier une cote de piste
// n'est pas un nom affiche, et elle ne part pas dans le build.
function sansCommentaires(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map(l => {
      const i = l.indexOf('//');
      if (i < 0) return l;
      // On ne coupe pas a l'interieur d'une chaine — 'http://' n'est pas un
      // commentaire, et il y en a dans ces fichiers.
      const avant = l.slice(0, i);
      const guillemets = (avant.match(/'/g) || []).length + (avant.match(/"/g) || []).length;
      return guillemets % 2 === 0 ? avant : l;
    })
    .join('\n');
}

const FICHIERS = [
  'src/game/sprinter-core.js',
  'src/game/sprinter-app.js',
  'src/game/sprinter-i18n.js',
  'src/game/edition.ts',
  'src/components/screens/BanderoleEdition.tsx',
];

// Le nom doit etre un MOT, pas une suite de lettres. Sans bornes, « Eseme »
// se trouvait dans `desemer()` et le test refusait une fonction du moteur qui
// n'a rien a voir avec un sprinteur.
const enMot = m => new RegExp('\\b' + m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');

for (const f of FICHIERS) {
  const code = sansCommentaires(lire(f));
  const touches = INTERDITS.filter(m => enMot(m).test(code));
  ok(`${f} ne nomme rien de reel`, touches.length === 0, touches.join(', '));
}

// Le theme lui-meme : des couleurs, et rien qui ressemble a un logo.
const app = lire('src/game/sprinter-app.js');
const theme = app.slice(app.indexOf('    danube: {'));
ok('le theme du Danube ne porte que des couleurs et des drapeaux de rendu',
   !/logo|embleme|emblem|sponsor|marque/i.test(theme.slice(0, theme.indexOf('\n    }'))));

console.log(e ? `\n${e} echec(s)\n` : '\nTout passe.\n');
process.exit(e ? 1 : 0);
