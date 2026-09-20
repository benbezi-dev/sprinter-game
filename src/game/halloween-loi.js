/* ---------------------------------------------------------------------------
   LA NUIT DU MOLOSSE — les treize nuits, et la loi de la bete
   ---------------------------------------------------------------------------
   AUCUN IMPORT DANS CE FICHIER, ET C'EST TOUT SON INTERET.

   La regle du mode (game/halloween.ts) a besoin du moteur : elle lit le
   chrono de la course, gele le coureur, pose des crochets. Ce qui suit n'a
   besoin de rien — treize nombres et une fonction — et peut donc etre charge
   seul par un harnais, sans navigateur, sans React et sans piste
   (tools/molosse-test.mjs). C'est la meme discipline que canal.ts : ce qui
   se verifie sans lancer une course doit pouvoir se verifier sans lancer une
   course.

   Ce n'est pas une precaution theorique. Les treize temps impartis
   ci-dessous ont ete reecrits une fois deja, parce que mesures : la premiere
   echelle, qui paraissait raisonnable, faisait tomber six nuits d'affilee a
   la meme cadence de doigt. On ne les fixe pas, on les mesure — et pour les
   mesurer, il faut pouvoir les charger.
--------------------------------------------------------------------------- */

/**
 * LES TREIZE NUITS.
 *
 * Treize, parce que c'est le nombre de la fete, et parce que treize paliers
 * suffisent a aller de « tout le monde y arrive » a « presque personne ».
 *
 * CHAQUE NUIT A SON TRACE, et c'est ce qui a change en dernier. Les treize se
 * couraient toutes sur le meme cent metres : le chrono descendait, la piste
 * non, et au bout de la quatrieme nuit le joueur ne decouvrait plus rien — il
 * refaisait le meme geste un peu plus vite. Le mode avait une progression de
 * difficulte et aucune progression tout court.
 *
 * Elles alternent maintenant cinq traces (voir halloween-courses.js), dont
 * deux qui n'existent nulle part dans l'athletisme : le cent metres EN COURBE
 * et les lignes droites de deux, trois et quatre cents metres. Le joueur ne
 * sait pas ce qui l'attend a la nuit suivante, et c'est la moitie de l'envie
 * d'y aller.
 *
 * LE VIRAGE NE COUTE RIEN AU CHRONO, et il faut le savoir : le moteur incline
 * le coureur dans la courbe mais ne le ralentit pas — un cent metres en
 * virage rend exactement le meme temps qu'un cent metres en ligne. C'est donc
 * un changement de VUE, pas de difficulte, et les impartis en tiennent
 * compte : la nuit 3 et la nuit 8 sont calees comme des cent metres.
 *
 * CES NOMBRES SONT MESURES, PAS ESTIMES, et la difference a deja coute une
 * reecriture complete de la liste. La courbe chrono/cadence du jeu n'a rien
 * de lineaire : elle s'aplatit fortement au-dela de neuf appuis par seconde
 * — sur le cent metres, une seconde et demie se gagne entre cinq et six
 * appuis, un dixieme entre treize et quinze. Des paliers reguliers EN TEMPS
 * donnent donc des paliers tres irreguliers EN GESTE, et c'est le geste que
 * le joueur sent.
 *
 * Les impartis sont donc poses sur la CADENCE, qui monte d'un demi-appui par
 * nuit jusqu'a la dixieme puis davantage, et chacun se lit sur la courbe
 * mesuree, deux centiemes au-dessus du chrono que cette cadence rend :
 *
 *     1 -> 5,5/s   100 m        8  ->  9,0/s   100 m en courbe
 *     2 -> 6,0/s   200 m ligne  9  ->  9,5/s   300 m ligne
 *     3 -> 6,5/s   100 m courbe 10 -> 10,0/s   200 m ligne
 *     4 -> 7,0/s   300 m ligne  11 -> 11,0/s   100 m
 *     5 -> 7,5/s   100 m        12 -> 12,0/s   400 m ligne
 *     6 -> 8,0/s   400 m ligne  13 -> 14,0/s   100 m en courbe
 *     7 -> 8,5/s   200 m ligne
 *
 * Le jour ou la physique du jeu changera, c'est le harnais qu'il faudra
 * rejouer (tools/molosse-test.mjs) et cette table qu'il faudra reecrire. Ces
 * nombres ne se deduisent d'aucune formule.
 */
export const NUITS = [
  { n: 1,  epreuve: 'nuit-100',  imparti: 14.83, retard: 14, nom: ['La ruelle', 'The alley'] },
  { n: 2,  epreuve: 'nuit-200',  imparti: 26.42, retard: 16, nom: ['Le portail', 'The gate'] },
  { n: 3,  epreuve: 'nuit-100v', imparti: 12.75, retard: 12, nom: ['Les cyprès', 'The cypresses'] },
  { n: 4,  epreuve: 'nuit-300',  imparti: 33.73, retard: 18, nom: ['La lune rousse', 'The blood moon'] },
  { n: 5,  epreuve: 'nuit-100',  imparti: 11.22, retard: 11, nom: ['Le caveau', 'The vault'] },
  { n: 6,  epreuve: 'nuit-400',  imparti: 39.21, retard: 20, nom: ['Les corbeaux', 'The crows'] },
  { n: 7,  epreuve: 'nuit-200',  imparti: 19.02, retard: 13, nom: ['La terre remuée', 'Turned earth'] },
  { n: 8,  epreuve: 'nuit-100v', imparti: 9.56,  retard: 9,  nom: ['Le glas', 'The knell'] },
  { n: 9,  epreuve: 'nuit-300',  imparti: 27.27, retard: 14, nom: ['Les cendres', 'The ashes'] },
  { n: 10, epreuve: 'nuit-200',  imparti: 17.94, retard: 10, nom: ['Le souffle', 'The breath'] },
  { n: 11, epreuve: 'nuit-100',  imparti: 9.02,  retard: 7,  nom: ['La gueule', 'The jaws'] },
  { n: 12, epreuve: 'nuit-400',  imparti: 36.40, retard: 12, nom: ['Minuit', 'Midnight'] },
  { n: 13, epreuve: 'nuit-100v', imparti: 8.75,  retard: 5,  nom: ['La nuit du molosse', "The hound's night"] },
];

/** La nuit de ce rang, ou la derniere si le rang deborde. */
export function nuitDe(n) {
  return NUITS[Math.max(0, Math.min(NUITS.length - 1, n - 1))];
}

/**
 * LES DEUX CONSTANTES DE LA COURSE DE LA BETE, pour une nuit et une distance.
 *
 * Recopiees de `stepAI` dans sprinter-core.js : `tau` est le temps de montee
 * en vitesse, borne comme dans le moteur, et `vmax` s'en deduit pour que la
 * distance soit couverte exactement au temps vise.
 *
 * Recopiees plutot qu'empruntees, et c'est delibere : `stepAI` vit sur un
 * Runner — un corps, un couloir, un chrono d'arrivee, un classement. Le
 * molosse n'est rien de tout cela, et lui donner un Runner l'aurait fait
 * entrer dans les resultats et le photo-finish, ou il n'a rien a faire.
 */
export function constantes(imparti, distance) {
  const tau = Math.max(0.35, Math.min(1.10, imparti * 0.16));
  const den = imparti - tau * (1 - Math.exp(-imparti / tau));
  return { tau, vmax: distance / Math.max(0.01, den) };
}

/**
 * OU EST LA BETE A L'INSTANT `t`, en metres depuis la ligne de depart.
 *
 *   d(t) = COURSE DE REFERENCE - CE QU'IL LUI RESTE A COMBLER
 *        = vmax x (t - tau x (1 - exp(-t / tau))) - retard x (1 - t / T)
 *
 * LE SECOND TERME EST LA CORRECTION QUI TIENT LA PROMESSE DU MODE, et il a
 * ete ajoute apres coup, parce que sans lui elle etait fausse.
 *
 * Une premiere version faisait couvrir a la bete « cent metres plus son
 * retard » dans le temps imparti. Elle arrivait bien a la ligne a la seconde
 * pres — mais elle accelerait plus fort qu'un coureur au depart, puisqu'elle
 * avait plus de chemin a faire dans le meme temps. Resultat mesure au
 * harnais : a six appuis par seconde, sur la nuit la plus large, le joueur
 * se faisait mordre a deux secondes et demie alors qu'il restait dix
 * secondes au compteur et qu'il aurait franchi la ligne dans les temps. Le
 * chrono et la bete disaient deux choses differentes, ce qui est exactement
 * le defaut que ce mode s'interdit.
 *
 * Le retard se comble donc LINEAIREMENT sur la duree de la nuit, en plus de
 * la course de reference. Trois proprietes en decoulent, et ce sont les trois
 * qu'on voulait :
 *
 *   - a t = 0, la bete est a `-retard` : elle part bien derriere ;
 *   - a t = T, le terme de retard s'annule : elle est sur la ligne, a zero
 *     metre pres, quelle que soit la nuit ;
 *   - entre les deux, elle reste TOUJOURS derriere le coureur de reference.
 *     Un joueur qui tient le rythme du temps imparti n'est donc jamais
 *     rattrape avant la ligne, et un joueur plus lent l'est forcement.
 *
 * Le retard redevient ainsi ce que son commentaire annonce : de la mise en
 * scene, et rien d'autre.
 *
 * Le `max(0, ...)` compte : passe le temps imparti, un retard devenu negatif
 * aurait pousse la bete en avant au lieu de la laisser courir. Elle suit
 * alors la course de reference, tout simplement.
 */
export function positionDe(nuit, t, tau, vmax) {
  return vmax * (t - tau * (1 - Math.exp(-t / tau)))
       - nuit.retard * Math.max(0, 1 - t / nuit.imparti);
}
