/* ---------------------------------------------------------------------------
   LE DELAI AVANT LE COUP DE PISTOLET
   ---------------------------------------------------------------------------
   Les trois salles — le direct, le relais, la confrontation — annoncent leur
   depart de la meme facon : une DATE, jamais un signal, pour que chacun compte
   chez lui et que tout le monde parte ensemble. Ce qui suit ne decide que
   d'une chose : dans combien de temps tombe cette date.

   ELLE N'EST PLUS FIXE. Quatre secondes tous les depars, c'est un metronome :
   au bout de deux courses on part sur le rythme et non sur le signal, et le
   temps de reaction ne mesure plus rien. Le jeu a maintenant un starter — « a
   vos marques », « pret », le coup — et un starter ne dit jamais quand il va
   tirer. Entre trois et dix secondes, donc, comme sur une piste.

   POURQUOI ICI ET PAS CHEZ LE CLIENT. La date est le seul point commun des
   telephones d'une meme course ; la tirer de leur cote donnerait deux depars
   differents pour un seul pistolet. Le client, lui, ne tire au sort que les
   courses qu'il joue seul — voir `tirerLeDepart` dans src/game/sprinter-app.js,
   qui applique exactement la meme regle.

   Le tirage penche vers les depars courts : dix secondes existent, et c'est
   parce qu'elles sont rares qu'elles sont redoutables. Trois secondes restent
   le plancher — c'est aussi ce qu'il faut pour absorber une latence mediocre
   et laisser chacun monter sa piste.
--------------------------------------------------------------------------- */

export const DEPART_MIN_MS = 3000;
export const DEPART_MAX_MS = 10000;

/** Combien de temps avant le coup de pistolet, pour la course qui vient. */
export function avantDepart() {
  return Math.round(
    DEPART_MIN_MS + (DEPART_MAX_MS - DEPART_MIN_MS) * Math.pow(Math.random(), 1.5));
}
