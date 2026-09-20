/* ---------------------------------------------------------------------------
   LES TREIZE CAMERAS — une par nuit
   ---------------------------------------------------------------------------
   AUCUN IMPORT ICI. Comme halloween-loi.js et halloween-courses.js, ce fichier
   ne contient que des nombres : un harnais doit pouvoir les charger sans
   navigateur, et la table doit se relire d'un coup d'oeil.

   POURQUOI LA CAMERA CHANGE D'UNE NUIT A L'AUTRE.

   Le sprint se court vu de 26,6° au-dessus de l'horizon — la projection
   isometrique 2:1 du jeu, ISO_COS = 2/racine(5). C'est un cadrage qui montre
   bien UNE COURSE : on lit les huit couloirs, on voit qui gagne, on juge un
   ecart. Il montre mal UNE FUITE, parce que la peur a besoin de proximite et
   que cette camera n'en a aucune : a 26,6° et a trente pixels le metre, la
   bete fait quarante-neuf pixels de long et le coureur en fait cinquante-
   quatre de haut. Deux figurines vues d'en haut.

   On descend donc la camera et on s'approche. Mesure sur la meme image :
   a 6,9° avec un zoom de 2,5, la bete fait cent vingt pixels, on la lit comme
   un quadrupede qui charge, et la piste n'est plus qu'une bande sous les
   pieds — ce qui est exactement ce qu'on veut d'un mode dont le brief dit
   « on quitte la piste d'athletisme au maximum ».

   CE QUE CA COUTE, ET IL FAUT LE SAVOIR AVANT DE RENDRE QUOI QUE CE SOIT.
   Les pieces de decor sont cuites dans Blender SOUS LA VUE DU JEU
   (tools/blender/decors/vue.py). Une piece rendue pour 26,6° se lit mal a 6° :
   les gradins s'ecrasent en bande plate, les cypres s'etirent en dalles. Une
   camera par nuit veut donc un jeu de pieces par nuit — c'est le prix de
   l'expressivite, il a ete pese et accepte.

   MAIS LES ANGLES SE RANGENT EN FAMILLES, ET LA PLANCHE L'A MONTRE.
   Un ou deux degres ne se voient pas : 5°, 6° et 8° donnent la meme image.
   Ce qui se voit, ce sont les paliers. Chaque nuit garde donc SA valeur —
   elle est ecrite ici, et on peut la bouger sans rien demander a personne —
   mais elle porte aussi le nom de sa FAMILLE, et c'est la famille qui decide
   quel jeu de pieces on rend. Quatre familles pour treize nuits : le meme
   resultat a l'oeil, un tiers du travail dans Blender, et des pieces qui se
   partagent entre nuits d'une meme famille.

   LA TREIZIEME EST LA SEULE A EN AVOIR TROIS. Sa finale se court en trois
   phases, et la camera DESCEND a chaque vague : le monde se referme
   litteralement sur le joueur. C'est la seule nuit ou l'angle bouge pendant
   qu'on court.
--------------------------------------------------------------------------- */

/** Les quatre familles, et ce que chacune montre. */
export const FAMILLES = {
  // Un couloir, un tunnel, une ruelle : les murs ecrasent, on ne voit pas loin.
  confine: { deg: 6, zoom: 2.5 },
  // On voit le sol juste devant et rien au-dela : maiS, foret, miroirs.
  resserre: { deg: 11, zoom: 2.0 },
  // Le cimetiere : il faut lire la terre d'ou sortent les mains.
  ouvert: { deg: 14, zoom: 1.9 },
  // Les trois lieux qui ont besoin d'espace : la piste, les toits, le champ.
  large: { deg: 20, zoom: 1.6 },
};

/**
 * La camera de chaque nuit.
 *
 * `deg` est l'angle au-dessus de l'horizon ; `zoom` multiplie l'echelle du
 * jeu. `famille` dit quel jeu de pieces Blender la nuit consomme.
 *
 * Les valeurs propres a une nuit s'ecartent un peu de leur famille quand le
 * lieu le demande — mais jamais assez pour qu'un autre jeu de pieces soit
 * necessaire. C'est la regle : on change `deg` librement DANS sa famille, et
 * on change de famille en sachant qu'on commande un rendu.
 */
export const CAMERAS = {
  1:  { deg: 7,  zoom: 2.4, famille: 'confine',  lieu: 'Ruelle du Croissant Noir' },
  2:  { deg: 14, zoom: 2.0, famille: 'ouvert',   lieu: 'Cimetiere Saint-Gall' },
  3:  { deg: 8,  zoom: 2.2, famille: 'confine',  lieu: 'Champ de mais' },
  4:  { deg: 6,  zoom: 2.5, famille: 'confine',  lieu: 'Parking souterrain' },
  5:  { deg: 22, zoom: 1.6, famille: 'large',    lieu: 'Piste abandonnee' },
  6:  { deg: 5,  zoom: 2.6, famille: 'confine',  lieu: 'Egouts, tunnel inonde' },
  7:  { deg: 11, zoom: 1.9, famille: 'resserre', lieu: 'Foret, faisceaux' },
  8:  { deg: 7,  zoom: 2.3, famille: 'confine',  lieu: 'Manoir, couloirs' },
  9:  { deg: 18, zoom: 1.7, famille: 'large',    lieu: 'Toits de la ville' },
  10: { deg: 13, zoom: 2.0, famille: 'resserre', lieu: 'Palais des glaces' },
  11: { deg: 6,  zoom: 2.5, famille: 'confine',  lieu: 'Morgue, hopital' },
  12: { deg: 20, zoom: 1.6, famille: 'large',    lieu: 'Champ de crash' },
  // LA FINALE DESCEND. Trois phases, trois cadrages, et le dernier est le plus
  // bas de toute l'edition : a la troisieme vague, on ne voit plus que ce qui
  // arrive.
  13: { deg: 20, zoom: 1.6, famille: 'large',    lieu: 'Le Grand Cimetiere',
        phases: [ { deg: 20, zoom: 1.6 }, { deg: 12, zoom: 2.0 }, { deg: 6, zoom: 2.6 } ] },
};

/** L'angle du sprint, celui qu'on remet en sortant du mode. */
export const CAMERA_DU_JEU = { deg: 26.565, zoom: 1 };

/** La camera d'une nuit, ou celle du jeu si la nuit n'existe pas. */
export function cameraDe(n) {
  return CAMERAS[n] || CAMERA_DU_JEU;
}

/**
 * Le couple (ISO_COS, ISO_SIN) d'un angle, en vecteur unitaire.
 *
 * IL DOIT RESTER UNITAIRE, sans quoi l'angle changerait aussi l'echelle. La
 * paire du jeu — 2/racine(5) et 1/racine(5) — en est une : c'est ce qui fait
 * qu'un metre parcouru dans l'axe de la piste vaut exactement `scaleM()`
 * pixels, et tout le reste du rendu en depend.
 */
export function isoDe(deg) {
  const r = deg * Math.PI / 180;
  return { cos: Math.cos(r), sin: Math.sin(r) };
}

/** Combien de jeux de pieces Blender il faudra rendre. */
export function famillesUtilisees() {
  const v = new Set();
  for (const n of Object.keys(CAMERAS)) v.add(CAMERAS[n].famille);
  return [...v];
}
