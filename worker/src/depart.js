/* ---------------------------------------------------------------------------
   LE DELAI AVANT LE DEPART
   ---------------------------------------------------------------------------
   Les trois salles — le direct, le relais, la confrontation — annoncent leur
   depart de la meme facon : une DATE, jamais un signal, pour que chacun compte
   chez lui et que tout le monde parte ensemble. Ce qui suit ne decide que
   d'une chose : dans combien de temps tombe cette date.

   UNE SEULE REPONSE, SUR LES DEUX CANAUX.

   Chaque salle garde son delai FIXE — quatre secondes en direct, cinq au
   relais, six en confrontation — parce que le depart est un decompte : le
   joueur voit les secondes tomber, et un decompte dont on ignore la longueur
   n'est plus un decompte. Chaque salle passe donc le sien.

   Le canal de test tirait au sort entre trois et dix secondes, pour essayer un
   starter qui ne dit jamais quand il va tirer. L'essai est abandonne : le
   depart est toujours cale sur le 3, 2, 1, et le starter du canal de test ne
   fait plus que suivre le chiffre (voir DEPART_STARTER dans
   src/game/canal.ts). Tirer la longueur au sort n'aurait plus fait qu'ouvrir
   un decompte tantot a quatre, tantot a dix.

   POURQUOI LA DATE EST ICI ET PAS CHEZ LE CLIENT. Elle est le seul point
   commun des telephones d'une meme course ; la fixer de leur cote donnerait
   deux departs differents pour un seul pistolet.

   `test` reste dans la signature : les salles le passent toujours, et c'est
   ici, et nulle part ailleurs, qu'une regle propre au canal de test
   reviendrait si on en essayait une autre.
--------------------------------------------------------------------------- */

/**
 * Combien de temps avant le depart, pour la course qui vient.
 *
 * `test` dit sur quel canal tourne la salle — le worker le sait par le `canal`
 * de la requete, jamais par le client (voir `this.test` dans chaque salle).
 * `fixeMs` est le delai propre a chaque salle : il y a plus de monde a mettre
 * en place en confrontation qu'a deux en direct.
 */
export function avantDepart(test, fixeMs) {
  void test;
  return fixeMs;
}
