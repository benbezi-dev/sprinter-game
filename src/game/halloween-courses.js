/* ---------------------------------------------------------------------------
   LA NUIT DU MOLOSSE — les tracés que personne ne court ailleurs
   ---------------------------------------------------------------------------
   AUCUN IMPORT ICI NON PLUS. Comme halloween-loi.js, ce fichier ne contient
   que des nombres : un harnais doit pouvoir les charger sans navigateur.

   POURQUOI DES EPREUVES A NOUS.

   Treize nuits sur le meme cent metres, c'etait treize fois la meme course.
   Le chrono changeait, la piste non — et au bout de la quatrieme nuit le
   joueur ne decouvrait plus rien, il refaisait le meme geste un peu plus
   vite. Le mode avait une progression de difficulte et aucune progression
   tout court.

   Ces cinq traces n'existent nulle part ailleurs dans le jeu, et deux
   n'existent nulle part dans l'athletisme :

     - LE CENT METRES EN VIRAGE. On ne court jamais un cent metres en courbe :
       il n'y a pas de couloir pour ca. Ici la piste tourne des le premier
       appui, le coureur est incline tout du long, et la bete coupe la corde.
     - LE DEUX CENTS, LE TROIS CENTS ET LE QUATRE CENTS EN LIGNE DROITE. Une
       ligne droite de quatre cents metres n'entre dans aucun stade du monde.
       On la court ici parce qu'on n'est plus dans un stade : on fuit, et
       l'on fuit tout droit. Le regard porte jusqu'au bout, on VOIT la ligne
       d'arrivee des le depart, et on voit aussi qu'elle est tres loin.

   CE QUE LE MOTEUR EN SAIT : rien. `Track` prend un arc et une ligne droite,
   et fabrique la geometrie qu'on lui demande (voir sprinter-core.js) — un
   virage de cent metres sans ligne droite derriere lui est une piste
   parfaitement valide pour lui, meme si aucune federation ne l'homologuerait.

   LA VITESSE DE POINTE SUIT LA DISTANCE, PAS LE TRACE. Un coureur ne se
   depense pas de la meme facon sur cent et sur quatre cents metres, et c'est
   le moteur qui le traduit par un plafond : 12,435 m/s sur le cent metres,
   11,536 sur le tour. On reprend ces valeurs telles quelles et on interpole
   entre les deux — inventer un plafond ferait un jeu different, pas une
   epreuve de plus.
--------------------------------------------------------------------------- */

/** Le plafond de vitesse du jeu, par distance de reference. */
const POINTE_100 = 12.435;
const POINTE_400 = 11.536;

/**
 * Le plafond de vitesse pour une distance donnee.
 *
 * Interpolation lineaire entre les deux points connus du jeu. C'est grossier,
 * et c'est assume : ce qui compte est que le deux cents soit entre les deux,
 * pas qu'il tombe sur une courbe physiologique.
 */
function pointe(distance) {
  const f = Math.max(0, Math.min(1, (distance - 100) / 300));
  return POINTE_100 + (POINTE_400 - POINTE_100) * f;
}

/**
 * LES CINQ TRACES DE LA NUIT.
 *
 * `arc` est la part en courbe, `straight` la part en ligne droite, et leur
 * somme fait la distance. Les clefs sont prefixees `nuit-` : elles entrent
 * dans la table des courses du moteur a cote du 100, du 200 et des haies, et
 * rien ne doit pouvoir les confondre avec une epreuve du championnat — ni un
 * classement, ni un defi, ni un record.
 */
export const COURSES = {
  'nuit-100': {
    key: 'nuit-100', label: '100 M', sub: 'tout droit, dans le noir',
    arc: 0, straight: 100, maxSpeed: pointe(100), best: 9.58,
  },
  'nuit-100v': {
    key: 'nuit-100v', label: '100 M EN COURBE', sub: 'la piste tourne des le depart',
    arc: 100, straight: 0, maxSpeed: pointe(100), best: 9.80,
  },
  'nuit-200': {
    key: 'nuit-200', label: '200 M EN LIGNE', sub: 'une ligne droite de deux cents metres',
    arc: 0, straight: 200, maxSpeed: pointe(200), best: 19.19,
  },
  'nuit-300': {
    key: 'nuit-300', label: '300 M EN LIGNE', sub: 'on voit le bout, et il est loin',
    arc: 0, straight: 300, maxSpeed: pointe(300), best: 30.81,
  },
  'nuit-400': {
    key: 'nuit-400', label: '400 M EN LIGNE', sub: 'aucun stade au monde n\'est assez long',
    arc: 0, straight: 400, maxSpeed: pointe(400), best: 43.03,
  },
};

/** La distance d'un trace, en metres. */
export function distanceDe(cle) {
  const c = COURSES[cle];
  return c ? c.arc + c.straight : 100;
}

/** Les clefs, dans l'ordre ou les nuits les rencontrent. */
export const CLES = Object.keys(COURSES);
