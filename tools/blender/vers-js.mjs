/* -----------------------------------------------------------------------
   Des mesures Blender au module que le jeu embarque.

   Le jeu est un paquet statique : il ne va chercher aucun fichier de
   donnees au demarrage. Les profils releves dans Blender sont donc
   recopies ici en dur, dans un module que le bundler traite comme
   n'importe quel autre. Relancer coureur.py puis ce script est la seule
   facon de les changer — personne ne retouche coureur-hd.js a la main.

     node tools/blender/vers-js.mjs
   ----------------------------------------------------------------------- */

import { readFileSync, writeFileSync } from 'node:fs';

const src = 'tools/blender/sortie/coureur-hd.json';
const dst = 'src/game/coureur-hd.js';
const d = JSON.parse(readFileSync(src, 'utf8'));

const NIVEAUX = ['pres', 'moyen', 'loin'];

function chaine(ch) {
  const n = ch.niveaux.map(tr =>
    '[' + tr.map(t => '[' + t.join(',') + ']').join(',') + ']');
  return `  ${ch.nom}: [\n   ${n.join(',\n   ')}\n  ]`;
}

function gabarit(cle) {
  return d[cle].map(chaine).join(',\n');
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

   TROIS NIVEAUX DE DETAIL. Le meme corps, echantillonne en plus ou moins
   de troncs de cone. Huit coureurs a l'ecran ne peuvent pas tous payer
   soixante volumes ; celui qu'on regarde de pres, si. Un coureur lointain
   n'est pas un autre personnage, c'est le meme, mesure plus grossierement.

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
  const tot = d[cle].reduce((a, ch) => a + ch.niveaux[0].length, 0);
  const moy = d[cle].reduce((a, ch) => a + ch.niveaux[1].length, 0);
  const loin = d[cle].reduce((a, ch) => a + ch.niveaux[2].length, 0);
  console.log(`  ${cle} : ${tot} / ${moy} / ${loin} troncs par chaine cumulee`);
}
