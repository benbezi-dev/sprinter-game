/* ---------------------------------------------------------------------------
   JUMPER — le saut en longueur, tel que le reglement le pose
   ---------------------------------------------------------------------------
   Ce fichier ne contient QUE les cotes de World Athletics et les records. Le
   jeu du saut — ce que coute une planche manquee, un angle trop rasant, un
   ramene trop tot — vit dans `longueur-jeu.js`, et la mise en piste dans
   `longueur-course.js`. C'est la separation de `haies.js` et `haies-jeu.js`,
   pour la meme raison : on doit pouvoir corriger une regle sans relire le
   rendu, et verifier le rendu sans relire la regle.

   Les cotes sont celles des Regles techniques (TR 29 et 30, Competition
   Rules C1.1 de World Athletics). Elles se retrouvent a l'ecran — la piste
   d'elan, la planche, la plasticine, la fosse — et c'est pour cela qu'elles
   vivent ici plutot que dans le dessin : une fosse dessinee trop courte
   serait un mensonge visible, a cote d'un athlete a la bonne taille.
--------------------------------------------------------------------------- */

/**
 * La piste d'elan, en metres.
 *
 * Quarante metres au moins depuis la ligne d'appel, quarante-cinq la ou le
 * stade le permet, et 1,22 m de large a un centimetre pres. Le jeu dessine la
 * piste recommandee et fait partir l'athlete a quarante metres : c'est ce que
 * prend un sauteur d'elite, vingt a vingt-deux foulees.
 */
export const PISTE_ELAN = { minimum: 40, recommandee: 45, largeur: 1.22, tolerance: 0.01 };

/** D'ou part l'athlete, en metres avant la ligne d'appel. */
export const ELAN = 40;

/**
 * La planche d'appel : bois ou matiere rigide, blanche, encastree au niveau
 * de la piste. 1,22 m de long, 20 cm de large, 10 cm d'epaisseur au plus.
 *
 * LA LIGNE D'APPEL EST SON BORD COTE FOSSE. C'est d'elle que tout se mesure,
 * et c'est elle qu'on ne doit pas franchir. La planche elle-meme n'est qu'une
 * aide : prendre son appel avant elle est permis, on le paie simplement de la
 * distance perdue, puisque la mesure part toujours de la ligne.
 */
export const PLANCHE = { longueur: 1.22, largeur: 0.20, profondeur: 0.10 };

/**
 * La bande de plasticine, posee juste apres la ligne : 10 cm de large, pour
 * recueillir l'empreinte d'une pointe qui a franchi le plan de la ligne. C'est
 * elle que le juge regarde avant de lever son drapeau.
 */
export const PLASTICINE = { largeur: 0.10, hauteur: 0.007 };

/**
 * La fosse de reception : du sable meuble, humide, a niveau de la planche.
 *
 * Entre 2,75 et 3 m de large. Sa bordure la plus proche se tient entre 1 et
 * 3 m de la ligne d'appel, et son fond a 10 m de la ligne au moins. Le jeu
 * prend 2 m et 11 m : ce qu'on trouve dans un grand stade.
 */
export const FOSSE = {
  largeurMin: 2.75, largeurMax: 3.00,
  debutMin: 1, debutMax: 3, fondMin: 10,
  largeur: 2.75, debut: 2.0, fond: 11.0,
};

/**
 * Les essais d'un concours.
 *
 * Le reglement en donne trois a tout le monde, puis trois de plus aux huit
 * meilleurs d'une finale. LE JEU S'ARRETE A TROIS, comme les qualifications
 * des grands championnats : trois essais pour tout le monde, pas de coupe.
 * Un concours de six essais demandait un quart d'heure au joueur, dont dix
 * minutes a regarder les autres ; trois tiennent en une course de Sprinter,
 * et chaque essai y pese deux fois plus.
 *
 * `derniers` et `qualifies` restent : a trois derniers et huit qualifies, le
 * jeu retrouve la finale du reglement — la coupe, et l'ordre inverse du
 * classement pour les trois derniers essais.
 */
export const ESSAIS = { premiers: 3, derniers: 0, qualifies: 8 };

/**
 * Le temps accorde pour un essai, en secondes, a partir de l'appel du juge.
 * Un athlete qui ne s'elance pas a temps voit son essai compte nul.
 */
export const TEMPS_ESSAI = 60;

/**
 * Le vent, mesure pendant cinq secondes a partir du passage de l'athlete a
 * quarante metres de la ligne. Au-dela de +2,0 m/s de vent favorable, la
 * marque compte pour le concours mais ne peut pas etre homologuee comme
 * record.
 */
export const VENT = { duree: 5, depuis: 40, homologation: 2.0 };

/**
 * Les records du monde, ecrits le 27 septembre 2026.
 *
 * Ils servent de point d'ancrage au plateau du championnat du monde, et a rien
 * d'autre. Les garder avec leur date, leur lieu et leur vent evite d'avoir un
 * jour a deviner sur quoi le jeu a ete cale ; ils sont a relire avant toute
 * communication publique qui les citerait.
 */
export const RECORDS = {
  hommes: { m: 8.95, qui: 'Mike Powell', an: 1991, lieu: 'Tokyo', vent: 0.3 },
  femmes: { m: 7.52, qui: 'Galina Chistyakova', an: 1988, lieu: 'Leningrad', vent: 1.4 },
};

/** L'acceleration de la pesanteur. */
export const G = 9.81;

/**
 * La marque, ecrite comme un juge l'ecrit : au centimetre, et jamais arrondie
 * vers le haut.
 *
 * 8,959 m se lit 8,95 m. Ce n'est pas un detail d'affichage : c'est la
 * difference entre egaler un record et le battre.
 */
export function marque(metres) {
  if (!(metres > 0)) return null;
  // Le petit epsilon rattrape la virgule flottante : 8,95 vaut 8,9499999…
  return Math.floor(metres * 100 + 1e-6) / 100;
}

/** Un vent se lit au dixieme, signe compris : « +1,2 », « -0,4 », « 0,0 ». */
export function lireVent(v) {
  const x = Math.round((Number(v) || 0) * 10) / 10;
  const s = Math.abs(x).toFixed(1);
  return x > 0 ? '+' + s : x < 0 ? '-' + s : s;
}

/** La marque peut-elle compter comme record ? */
export function homologable(vent) {
  return (Number(vent) || 0) <= VENT.homologation + 1e-9;
}
