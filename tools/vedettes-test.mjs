// Le defi Aurel Manga, verifie sans navigateur.
//
// Ce que ce harnais tient, et que l'oeil ne voit pas :
//
//   1. le stade de l'evenement est a sa place d'ouvert — juste apres les
//      stades ouverts, avant ceux du canal de test — et LEVEL_NAMES le nomme
//      au meme rang : l'ouvrir ne devra rien deplacer ;
//   2. Aurel court au couloir 5, a cote du joueur, et son plateau porte toutes
//      les epreuves (une clef manquante fait tomber la construction) ;
//   3. son corps sculpte est bien charge, et son look reprend la carrure de
//      sa sculpture ;
//   4. UN SKIN NE CHANGE PAS LA FOULEE : le coureur du joueur habille en Aurel
//      Manga pose exactement ses appuis au meme endroit qu'en maillot or.
//
//   node tools/vedettes-test.mjs

import '../src/game/sprinter-i18n.js';
import '../src/game/coureur-hd.js';
import '../src/game/coureur-vedettes.js';
import '../src/game/coureur-premium.js';
import '../src/game/sprinter-core.js';
import { HAIES } from '../src/game/haies.js';

const K = globalThis.SprinterCore;
const I = globalThis.SprinterI18N;
const PREM = globalThis.SprinterPremium;

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const stades = K.STADES_HORS_SERIE;
const i = stades.findIndex(s => s.cle === 'defi-manga');
const S = stades[i];

titre('LE STADE DE L EVENEMENT');
ok('il existe', i >= 0);
ok('c est un evenement, ferme pour l instant', S && S.evenement === true && S.ouvert === false);
ok('il vient juste apres les stades ouverts',
   stades.slice(0, i).every(s => s.ouvert) && stades.slice(i + 1).every(s => !s.ouvert),
   stades.map(s => `${s.cle}:${s.ouvert ? 'o' : 'f'}`).join(' '));
I.setLang('fr');
const rang = K.LEVELS.length + i;
ok('LEVEL_NAMES le nomme au meme rang', I.levelName(rang) === 'Stade Jean-Delbert',
   `rang ${rang} : « ${I.levelName(rang)} »`);
ok('et le stade d apres garde son nom', I.levelName(rang + 1) === 'Stade de la Riviera',
   `« ${I.levelName(rang + 1)} »`);
ok('il se court au Stade Jean-Delbert', S.theme === 'montreuil');

titre('AUREL MANGA SUR LA LIGNE');
const lane = (n) => (n < 3 ? n : n + 1);
ok('il court au couloir 5 (index 4), a droite du joueur (index 3)',
   lane(S.names.indexOf('Aurel MANGA')) === 4);
const epreuves = [...Object.keys(K.RACES), ...Object.keys(HAIES)];
const manque = epreuves.filter(k => !S.plateau[k]);
ok('le plateau porte toutes les epreuves', manque.length === 0, manque.join(', '));
const cible = S.cibles['110h']['Aurel MANGA'];
ok('son chrono est fixe au 110 m haies', typeof cible === 'number' && cible > 0);
ok('les autres courent derriere lui', S.plateau['110h'][0] > cible,
   `plateau ${S.plateau['110h']} contre ${cible}`);

titre('SON CORPS ET SON LOOK');
const L = K.lookFor('Aurel MANGA', 'divers');
ok('lookFor rend son look, pas un tirage', L === K.VEDETTES['Aurel MANGA']);
ok('son profil Blender est charge', PREM.sculpte(L.profil));
ok('bandeau, poignet gauche, barbe', !!L.bandeau && L.poignet && L.poignet.cote === 1 && !!L.barbe);
const carrure = 1.10;   // tools/blender/anatomie.py, ATHLETES.manga.carrure
ok('le look reprend la carrure de la sculpture', L.morph && L.morph.sh === carrure);
const parts = K.pose({ look: L, stride: 1.2, v: 11, maxSpeed: 12, fallAnim: 0, celebrate: 0 }, 0);
ok('il se pose sans erreur', parts.length > 60, `${parts.length} volumes`);
ok('le bandeau est colle aux cheveux (COLLE)',
   parts.some(p => p[0] === L.bandeau && (p[6] & PREM.COLLE)));

titre('UN SKIN NE CHANGE PAS LA FOULEE');
const R = K.RACES['100'];
const T = new K.Track(R);
const courir = (look) => {
  const r = new K.Runner('TOI', 3, { isPlayer: true, maxSpeed: R.maxSpeed, best: R.best, total: T.total });
  r.look = look;
  const pas = [];
  r.v = 0;
  for (let k = 0; k < 400; k++) {
    r.v = Math.min(r.maxSpeed, r.v + 0.08);
    pas.push(+r.strideLength().toFixed(6));
  }
  return pas.join(',');
};
ok('memes longueurs d appui en maillot or et en Aurel Manga',
   courir(K.PLAYER_LOOK) === courir(L));

console.log(`\n${'─'.repeat(62)}\n   ${e ? e + ' ECHEC(S).' : 'TOUT PASSE.'}`);
process.exit(e ? 1 : 0);
