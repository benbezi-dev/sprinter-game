/* ---------------------------------------------------------------------------
   JUMPER — le triple saut, tel que le reglement le pose
   ---------------------------------------------------------------------------
   Le triple saut partage presque tout avec le saut en longueur : la piste
   d'elan, la planche et sa plasticine, la fosse, la mesure, le vent, les
   essais. Tout cela est ecrit une fois, dans `longueur.js`, et lu d'ici. Ce
   fichier ne porte que ce qui lui appartient : ou se pose sa planche, l'ordre
   des trois bonds et les records.

   Le jeu des trois bonds — ce que coute un cloche-pied trop haut, un appui
   ecrase, un mauvais pied — vit dans `triple-jeu.js`.
--------------------------------------------------------------------------- */

/**
 * LA PLANCHE DU TRIPLE SAUT, en metres avant le debut du sable.
 *
 * Aux grandes competitions, 13 m chez les hommes, 11 m chez les femmes ; le
 * fond de la fosse a 21 m de la ligne au moins.
 *
 * LE CLOCHE-PIED ET LA FOULEE SE POSENT SUR LA PISTE, et seul le saut finit
 * dans le sable. C'est tout le sens de cette distance : elle est choisie pour
 * que les deux premiers bonds retombent avant la fosse. Le jeu avait une
 * planche par etape, de 7 m a l'ecole a 13 m au championnat du monde, comme
 * les stades en posent pour les enfants ; mais le joueur, lui, saute aussi
 * loin a toutes les etapes, et a sept metres son cloche-pied et sa foulee
 * finissaient dans le sable. La planche est donc celle des hommes, 13 m,
 * partout ou l'on saute sur Terre ; la station intergalactique, ou l'on va
 * bien plus loin, l'a reculee a 15 m. Voir triple-jeu.js, VITESSE_TRIPLE.
 *
 * Elle est sur la MEME piste d'elan que celle du saut en longueur, et vise la
 * MEME fosse — c'est ainsi dans tous les stades, et on voit les deux planches.
 */
export const PLANCHE_TRIPLE = {
  hommes: 13, femmes: 11, fondMin: 21,
  // par etape : scolaire, regional, national, monde, 0.Games, intergalactique
  etapes: [13, 13, 13, 13, 13, 15],
};

/** La planche d'une etape, en metres avant le sable. */
export function plancheDe(etape) {
  const l = PLANCHE_TRIPLE.etapes;
  return l[Math.max(0, Math.min(l.length - 1, etape | 0))];
}

/**
 * LES TROIS BONDS, dans leur ordre.
 *
 * Le cloche-pied retombe sur le pied d'appel ; la foulee bondissante, sur
 * l'autre ; le saut part de ce dernier et finit dans le sable. C'est la regle
 * elle-meme (TR 31), et c'est elle qui fait le geste du jeu : le pave qui
 * s'allume est le pied qui doit se poser. Un mauvais pied, et l'essai est nul.
 *
 * `pied` dit sur quel pied on retombe, par rapport au pied d'appel.
 */
export const BONDS = [
  { cle: 'cloche', pied: 'meme' },
  { cle: 'foulee', pied: 'autre' },
  { cle: 'saut', pied: null },
];

/**
 * La jambe « dormante » peut toucher le sol pendant le saut sans que
 * l'essai soit nul. Ecrit pour memoire : le jeu ne la fait jamais toucher.
 */
export const JAMBE_DORMANTE_PERMISE = true;

/**
 * Les records du monde, ecrits le 27 septembre 2026, a relire avant toute
 * communication publique qui les citerait.
 *
 * Celui des femmes a ete saute en salle : depuis que World Athletics ne tient
 * plus qu'une liste, une marque en salle est un record du monde a part
 * entiere.
 */
export const RECORDS = {
  hommes: { m: 18.29, qui: 'Jonathan Edwards', an: 1995, lieu: 'Göteborg', vent: 1.3 },
  femmes: { m: 15.74, qui: 'Yulimar Rojas', an: 2022, lieu: 'Belgrade', vent: 0 },
};
