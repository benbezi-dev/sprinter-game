/* ---------------------------------------------------------------------------
   LE DELAI AVANT LE DEPART
   ---------------------------------------------------------------------------
   Les trois salles — le direct, le relais, la confrontation — annoncent leur
   depart de la meme facon : une DATE, jamais un signal, pour que chacun compte
   chez lui et que tout le monde parte ensemble. Ce qui suit ne decide que
   d'une chose : dans combien de temps tombe cette date.

   ET IL Y A DEUX REPONSES, UNE PAR CANAL.

   Le jeu publie garde son delai FIXE — quatre secondes en direct, cinq au
   relais, six en confrontation — parce que son depart est un decompte : le
   joueur voit les secondes tomber, et un decompte dont on ignore la longueur
   n'est plus un decompte. Chaque salle passe donc le sien.

   Le canal de test essaie un starter, et un starter ne dit jamais quand il va
   tirer : entre trois et dix secondes, comme sur une piste. Quatre secondes
   toutes les courses y seraient un metronome — au bout de deux departs on part
   sur le rythme et non sur le signal, et le temps de reaction ne mesure plus
   rien. Le tirage penche vers les departs courts : dix secondes existent, et
   c'est parce qu'elles sont rares qu'elles sont redoutables. Trois secondes
   restent le plancher — c'est aussi ce qu'il faut pour absorber une latence
   mediocre et laisser chacun monter sa piste.

   POURQUOI LE TIRAGE EST ICI ET PAS CHEZ LE CLIENT. La date est le seul point
   commun des telephones d'une meme course ; la tirer de leur cote donnerait
   deux departs differents pour un seul pistolet. Le client, lui, ne tire au
   sort que les courses qu'il joue seul — voir `tirerLeDepart` dans
   src/game/sprinter-app.js, qui applique exactement la meme regle, et
   DEPART_STARTER dans src/game/canal.ts pour le partage entre les deux canaux.
--------------------------------------------------------------------------- */

export const DEPART_MIN_MS = 3000;
export const DEPART_MAX_MS = 10000;

/**
 * Combien de temps avant le depart, pour la course qui vient.
 *
 * `test` dit sur quel canal tourne la salle — le worker le sait par le `canal`
 * de la requete, jamais par le client (voir `this.test` dans chaque salle).
 * `fixeMs` est le delai du jeu publie, propre a chaque salle : il y a plus de
 * monde a mettre en place en confrontation qu'a deux en direct.
 */
export function avantDepart(test, fixeMs) {
  if (!test) return fixeMs;
  return Math.round(
    DEPART_MIN_MS + (DEPART_MAX_MS - DEPART_MIN_MS) * Math.pow(Math.random(), 1.5));
}
