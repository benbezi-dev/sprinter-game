/* -----------------------------------------------------------------------
   Des mesures Blender au module que le jeu embarque.

   Le jeu est un paquet statique : il ne va chercher aucun fichier de
   donnees au demarrage. Les profils releves dans Blender sont donc
   recopies ici en dur, dans un module que le bundler traite comme
   n'importe quel autre. Relancer coureur.py puis ce script est la seule
   facon de les changer — personne ne retouche coureur-hd.js a la main.

     node tools/blender/vers-js.mjs
     node tools/blender/vers-js.mjs --vedettes   (les athletes reels)
   ----------------------------------------------------------------------- */

import { readFileSync, writeFileSync } from 'node:fs';

const VEDETTES = process.argv.includes('--vedettes');
const src = VEDETTES ? 'tools/blender/sortie/vedettes-hd.json'
                     : 'tools/blender/sortie/coureur-hd.json';
const dst = VEDETTES ? 'src/game/coureur-vedettes.js' : 'src/game/coureur-hd.js';
const d = JSON.parse(readFileSync(src, 'utf8'));

// L'ultra en dernier : le jeu lit les niveaux par leur rang, et les trois
// premiers ne bougent pas (voir chaines() dans anatomie.py).
const NIVEAUX = ['pres', 'moyen', 'loin', 'ultra'];

function chaine(ch) {
  const n = ch.niveaux.map(tr =>
    '[' + tr.map(t => '[' + t.join(',') + ']').join(',') + ']');
  return `  ${ch.nom}: [\n   ${n.join(',\n   ')}\n  ]`;
}

function gabarit(cle) {
  return d[cle].map(chaine).join(',\n');
}

if (VEDETTES) {
  ecrireVedettes();
  process.exit(0);
}

/**
 * LES ATHLETES REELS, dans un module a part.
 *
 * Meme forme d'entree que coureur-hd.js, et meme chaine de mesure. Le module
 * se pose sur `SprinterHD.vedettes` : il doit donc etre charge APRES
 * coureur-hd.js (voir engine.ts), et coureur-premium.js va l'y chercher
 * quand un look porte un `profil`.
 */
function ecrireVedettes() {
  const cles = Object.keys(d).filter(k => Array.isArray(d[k]));
  const ecartsDe = cle => Object.entries(d[cle + '_ecarts_mm'])
    .map(([g, e]) => `${g} ${e}mm`).join(', ');
  const js = `/* -----------------------------------------------------------------------
   SPRINTER — les corps des athletes reels, releves dans Blender.

   FICHIER ENGENDRE. Ne pas le modifier a la main : il est reecrit par
   \`node tools/blender/vers-js.mjs --vedettes\` a partir des mesures de
   \`tools/blender/coureur.py -- --vedettes\`. Pour changer une silhouette, on
   change ses retouches (ATHLETES dans tools/blender/anatomie.py) et on relance
   la chaine.

   Meme forme d'entree que coureur-hd.js : [centre en z, demi-hauteur,
   cambrure, profondeur bas, largeur bas, profondeur haut, largeur haut], aux
   quatre niveaux de detail. Le rig ne change pas — un athlete reel court et
   tourne comme n'importe quel coureur du jeu ; seules ses epaisseurs sont
   les siennes, et l'ecart de ses epaules (\`carrure\`), que son look reprend
   dans \`morph.sh\`.

   Ecart residuel a l'anatomie visee, apres calibration :
${cles.map(c => `     ${c} — ${ecartsDe(c)}`).join('\n')}
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  var HD = root.SprinterHD || (root.SprinterHD = {});
  var V = HD.vedettes || (HD.vedettes = {});
${cles.map(c => `
  // ${c} : carrure ${d[c + '_fiche'].carrure}
  V[${JSON.stringify(c)}] = {
${gabarit(c)}
  };`).join('\n')}
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;
  writeFileSync(dst, js);
  console.log(`ecrit ${dst} : ${cles.join(', ')}`);
}

const ecarts = cle => Object.entries(d[cle + '_ecarts_mm'])
  .map(([g, e]) => `${g} ${e}mm`).join(', ');

const js = `/* -----------------------------------------------------------------------
   SPRINTER — profils de corps releves dans Blender.

   FICHIER ENGENDRE. Ne pas le modifier a la main : il est reecrit par
   tools/blender/vers-js.mjs a partir des mesures de tools/blender/coureur.py.
   Pour changer une silhouette, on change l'anatomie (tools/blender/anatomie.py)
   et on relance la chaine.

   CE QUE CONTIENNENT CES CHIFFRES. Un corps de sprinter a ete sculpte en
   metaballs dans Blender, converti en maillage, puis mesure : depuis l'axe
   de chaque os, vingt-quatre rayons partent a l'horizontale et rapportent
   la distance a la peau. De la sortent, hauteur par hauteur, une profondeur
   et une largeur reelles. Rien ici n'a ete choisi a vue.

   FORME D'UNE ENTREE : [centre en z, demi-hauteur, cambrure, profondeur
   bas, largeur bas, profondeur haut, largeur haut], dans le repere du pivot
   du rig — le meme que pose(). La CAMBRURE est de combien la chair deborde
   vers l'avant plutot que vers l'arriere : elle vaut -11 mm au fessier,
   -10 mm au mollet, +9 mm a la poitrine. Sans elle, un corps n'est qu'une
   pile de tubes centres sur l'os.

   Les longueurs de segment, les pivots et les angles ne changent pas : un
   coureur premium reste un coureur du jeu, il tourne donc dans le virage
   exactement comme les autres.

   QUATRE NIVEAUX DE DETAIL. Le meme corps, echantillonne en plus ou moins
   de troncs de cone. Huit coureurs a l'ecran ne peuvent pas tous payer
   soixante volumes ; celui qu'on regarde de pres, si. Un coureur lointain
   n'est pas un autre personnage, c'est le meme, mesure plus grossierement.
   Le quatrieme, l'ULTRA, coupe deux fois plus fin que le niveau pres : il
   ne sert qu'au palier ULTRA de la couche de finition (rendu-premium.js),
   sur l'appareil qui tient la cadence. Il vient en dernier pour que les
   trois autres gardent leur rang.

   Ecart residuel a l'anatomie visee, apres calibration :
     homme — ${ecarts('m')}
     femme — ${ecarts('f')}
   Le torse reste le plus loin du compte : deux masses voisines se fondent,
   et le creux de la taille se comble en partie. C'est une limite du
   sculptage en metaballs, pas une approximation de mesure.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  var NIVEAUX = ${JSON.stringify(NIVEAUX)};

  var M = {
${gabarit('m')}
  };

  var F = {
${gabarit('f')}
  };

  root.SprinterHD = { m: M, f: F, NIVEAUX: NIVEAUX };
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;

writeFileSync(dst, js);
const n = (g) => Object.values(g).reduce((a, ch) => a + ch[0].length, 0);
console.log(`ecrit ${dst}`);
for (const cle of ['m', 'f']) {
  const compte = n => d[cle].reduce((a, ch) => a + (ch.niveaux[n] || []).length, 0);
  console.log(`  ${cle} : ${NIVEAUX.map((nom, n) => `${compte(n)} ${nom}`).join(' / ')}` +
              ' troncs par chaine cumulee');
}
