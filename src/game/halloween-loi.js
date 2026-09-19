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
 * CES NOMBRES SONT MESURES, PAS ESTIMES, et la difference a coute une
 * reecriture complete de la liste.
 *
 * La premiere version descendait regulierement de 13,00 a 8,80 s, ce qui
 * paraissait raisonnable sur le papier. Passee au harnais — un doigt parfait,
 * alterne, a cadence fixe, sur la piste du cimetiere — elle donnait ceci :
 * les SIX premieres nuits tombaient toutes a huit appuis par seconde, les
 * cinq suivantes toutes a neuf, et la treizieme sautait d'un coup a treize.
 * Onze paliers pour deux points de cadence, puis un mur. Le joueur aurait
 * traverse la moitie du mode sans rien changer a son geste.
 *
 * La cause tient a la forme de la courbe, qui n'a rien de lineaire : le jeu
 * rend 16,17 s a cinq appuis par seconde, 10,57 a huit, 9,16 a dix, 8,79 a
 * treize et 8,67 a quinze. Une seconde et demie se gagne entre cinq et six
 * appuis ; un dixieme entre treize et quinze. Des paliers reguliers EN TEMPS
 * donnent donc des paliers tres irreguliers EN GESTE — et c'est le geste que
 * le joueur sent.
 *
 * Les treize nuits ci-dessous sont donc posees sur la CADENCE, et leur temps
 * imparti se lit sur la courbe mesuree, juste au-dessus du chrono qu'elle
 * rend. Ce que chaque nuit demande au pouce, verifie par le harnais :
 *
 *     1 -> 5,50/s     5 -> 7,50/s     9  ->  9,50/s     13 -> 14,00/s
 *     2 -> 6,00/s     6 -> 8,00/s     10 -> 10,25/s
 *     3 -> 6,50/s     7 -> 8,50/s     11 -> 11,25/s
 *     4 -> 7,00/s     8 -> 9,00/s     12 -> 12,50/s
 *
 * Ces seuils sont ceux que rend `tools/molosse-test.mjs`, qui integre au pas
 * de la boucle de jeu. Le jeu reel en demande un quart d'appui de plus sur
 * les deux dernieres — la difference vient de l'accumulateur d'images, pas
 * de la regle, et elle va dans le bon sens : le harnais est un peu genereux.
 *
 * Un demi-appui par seconde de plus a chaque nuit jusqu'a la neuvieme, puis
 * davantage : c'est la seule facon de garder treize marches sur une courbe
 * qui s'aplatit. La derniere demande quatorze appuis par seconde, ce que
 * Sprinter exige de sa finale ZEZE — le geste d'un joueur qui s'entraine.
 * Le plancher du jeu est a 8,49 s, et la treizieme nuit laisse 8,72.
 *
 * Le jour ou la physique du jeu changera, c'est le harnais qu'il faudra
 * rejouer et cette table qu'il faudra reecrire. Ces nombres ne se deduisent
 * d'aucune formule.
 */
export const NUITS = [
  { n: 1,  imparti: 15.00, retard: 14, nom: ['La ruelle', 'The alley'] },
  { n: 2,  imparti: 13.80, retard: 13, nom: ['Le portail', 'The gate'] },
  { n: 3,  imparti: 12.80, retard: 12, nom: ['Les cyprès', 'The cypresses'] },
  { n: 4,  imparti: 12.00, retard: 12, nom: ['La lune rousse', 'The blood moon'] },
  { n: 5,  imparti: 11.30, retard: 11, nom: ['Le caveau', 'The vault'] },
  { n: 6,  imparti: 10.65, retard: 10, nom: ['Les corbeaux', 'The crows'] },
  { n: 7,  imparti: 10.10, retard: 10, nom: ['La terre remuée', 'Turned earth'] },
  { n: 8,  imparti: 9.60,  retard: 9,  nom: ['Le glas', 'The knell'] },
  { n: 9,  imparti: 9.35,  retard: 8,  nom: ['Les cendres', 'The ashes'] },
  { n: 10, imparti: 9.12,  retard: 7,  nom: ['Le souffle', 'The breath'] },
  { n: 11, imparti: 8.97,  retard: 7,  nom: ['La gueule', 'The jaws'] },
  { n: 12, imparti: 8.83,  retard: 6,  nom: ['Minuit', 'Midnight'] },
  { n: 13, imparti: 8.72,  retard: 5,  nom: ['La nuit du molosse', "The hound's night"] },
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
