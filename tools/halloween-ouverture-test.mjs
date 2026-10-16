// L'OUVERTURE DE L'EDITION HALLOWEEN — les pieges du lancement, un par un.
//
// L'audit du 16/10 a trouve cinq facons de rater l'ouverture du 19 octobre,
// et aucune ne se voyait dans les harnais existants : ils verifiaient tous le
// mode FERME. Celui-ci verifie ce qui compte le jour J, en relisant les
// fichiers tels qu'ils partiront — sans navigateur et sans build (le build,
// c'est tools/molosse-canal-test.mjs) :
//
//   1. la banniere s'ouvre le jour de la premiere nuit, pas cinq jours apres ;
//   2. le deploiement ne retire plus le decor de la ruelle ;
//   3. les fichiers du mode (musique, bete, cartes) suivent l'interrupteur ;
//   4. aucun bouton ne lance une nuit que le calendrier n'a pas ouverte ;
//   5. la progression des testeurs ne passe pas chez les joueurs ;
//   6. les decors ne se telechargent pas chez ceux qui ne jouent pas ;
//   7. le serveur sait compter les nuits et donner l'heure.
//
//   node tools/halloween-ouverture-test.mjs

import { readFileSync } from 'fs';
import { EDITION_HALLOWEEN, editionActive } from '../src/game/edition.ts';
import { PREMIER_JOUR_UTC, ouvertureDe, NB_NUITS } from '../src/game/halloween-calendrier.ts';
import { HALLOWEEN_PUBLIC } from '../src/game/halloween-ouverture.js';
import { etapeConnue, ETAPES_HALLOWEEN } from '../worker/src/tunnel.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);
const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

console.log(`\n   · interrupteur HALLOWEEN_PUBLIC = ${HALLOWEEN_PUBLIC}`);

/* ------------------------------------------------------------- 1. la porte */

titre('1. LA BANNIERE S OUVRE AVEC LA PREMIERE NUIT');
const iso = ms => new Date(ms).toISOString();
ok('elle s ouvre a l instant meme ou la nuit 1 s ouvre',
   EDITION_HALLOWEEN.debut === PREMIER_JOUR_UTC && EDITION_HALLOWEEN.debut === ouvertureDe(1),
   `banniere ${iso(EDITION_HALLOWEEN.debut)}, nuit 1 ${iso(PREMIER_JOUR_UTC)}`);
ok('elle est encore la le soir de la treizieme',
   editionActive(EDITION_HALLOWEEN, ouvertureDe(NB_NUITS) + 20 * 3600000));
ok('et la veille de la premiere, rien', !editionActive(EDITION_HALLOWEEN, PREMIER_JOUR_UTC - 1));

/* ------------------------------------------------------ 2. le deploiement */

titre('2. LE DEPLOIEMENT GARDE LA RUELLE');
const deploy = lire('.github/workflows/deploy.yml');
ok('aucune ligne ne retire le decor des nuits du build public',
   !/^\s*run:.*rm\s+-rf?\s+[^\n]*(halloween-a|materiel-a)/m.test(deploy));

/* -------------------------------------------- 3. les fichiers du mode */

titre('3. LES FICHIERS DU MODE SUIVENT L INTERRUPTEUR');
const vite = lire('vite.config.ts');
ok('vite.config.ts lit l interrupteur', /import \{ HALLOWEEN_PUBLIC \} from '\.\/src\/game\/halloween-ouverture\.js'/.test(vite));
ok('et ne retire la musique et la bete que si le mode est ferme',
   /\.\.\.\(HALLOWEEN_PUBLIC \? \[\] : FICHIERS_DU_MOLOSSE\)/.test(vite)
   && /FICHIERS_DU_MOLOSSE = \[[^\]]*molosse\.mp3[^\]]*molosse\.glb/.test(vite));
const canal = lire('src/game/canal.ts');
ok('canal.ts ouvre le mode sur l interrupteur', /HALLOWEEN_OUVERT = EST_TEST \|\| HALLOWEEN_PUBLIC;/.test(canal));
ok('et le calendrier avec lui, jamais l un sans l autre', /HALLOWEEN_2026_OUVERT = HALLOWEEN_OUVERT;/.test(canal));

/* --------------------------------------------- 4. aucune nuit avant l'heure */

titre('4. AUCUN BOUTON NE LANCE UNE NUIT FERMEE');
const ecran = lire('src/components/screens/Halloween.tsx');
const corpsDe = (src, debut) => {
  const i = src.indexOf(debut);
  if (i < 0) return '';
  return src.slice(i, src.indexOf('\n}\n', i));
};
const partir = corpsDe(ecran, 'function partir(');
ok('partir() refuse une nuit que le calendrier n a pas ouverte',
   /if \(!jouableMaintenant\(n\)\) return false;/.test(partir.split('\n').slice(0, 3).join('\n')));
ok('c est le seul chemin vers startOneShot dans l ecran du mode',
   (ecran.match(/startOneShot\(/g) || []).length === 1 && partir.includes('startOneShot('));
ok('le bouton NUIT SUIVANTE exige que la suivante soit ouverte',
   /passe && suivante && suivanteOuverte \? \(/.test(ecran));
ok('jouableMaintenant passe par le double verrou du calendrier',
   /return nuitsJouables\(carnet\(\)\.tenues, maintenant\(\), decalageDeLAppareil\(\)\);/.test(ecran));
ok('l heure est posee a l ouverture du panneau, avant tout calcul',
   /if \(v\) \{\s*horlogeImmediate\(\);/.test(ecran));
const horloge = lire('src/game/halloween-horloge.ts');
ok('la demande d heure au serveur a un delai', /AbortController/.test(horloge) && /signal:/.test(horloge));

/* ------------------------------------------------- 5. les deux espaces */

titre('5. LES TESTEURS NE CONTAMINENT PAS LES JOUEURS');
const regle = lire('src/game/halloween.ts');
ok('la regle range sa progression par le carnet versionne',
   /from '\.\/halloween-carnet'/.test(regle) && /lireLeCarnet\(RANGEMENT, EST_TEST\)/.test(regle));
ok('elle n ecrit plus jamais l ancienne clef commune a /test et au jeu',
   !/localStorage\.setItem\(\s*['"]sprinter_halloween/.test(regle) && !/const CLE = 'sprinter_halloween'/.test(regle));

/* ------------------------------------------------ 6. le decor a la demande */

titre('6. LE DECOR NE PART QUE CHEZ QUI JOUE');
const chargement = lire('src/game/chargement.ts');
ok('le telechargement de fond exclut toujours les nuits',
   /const servi = \(u: string\) => !halloween\(u\);/.test(chargement));
ok('et la nuit se demande a l ouverture du panneau', /prechargerLaNuit\(cameraDe\(prochaine\)\.deg\)/.test(ecran));

/* ------------------------------------------------------------ 7. le serveur */

titre('7. LE SERVEUR COMPTE LES NUITS ET DONNE L HEURE');
ok('vingt-sept marches : l entree, puis tentee et tenue pour chaque nuit',
   ETAPES_HALLOWEEN.length === 1 + 2 * NB_NUITS);
ok('le tunnel les accepte toutes', ETAPES_HALLOWEEN.every(etapeConnue));
ok('et refuse une nuit qui n existe pas', !etapeConnue('hw_nuit_14') && !etapeConnue('hw_tenue_0'));
const worker = lire('worker/src/index.js');
ok('la route /now existe', /url\.pathname === '\/now'/.test(worker));
ok('l en-tete Date est expose au navigateur (repli de /now)',
   /Access-Control-Expose-Headers', '[^']*\bDate\b/.test(worker));

console.log(e ? `\n${e} echec(s)` : '\nTout passe.');
process.exit(e ? 1 : 0);
