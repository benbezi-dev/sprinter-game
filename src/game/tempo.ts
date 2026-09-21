/* ---------------------------------------------------------------------------
   A QUELLE VITESSE LE MONDE AVANCE
   ---------------------------------------------------------------------------
   Un seul nombre, lu par la boucle d'image avant qu'elle ne fasse avancer quoi
   que ce soit : le pas de temps du moteur est multiplie par lui. A 1 le jeu
   tourne comme il a toujours tourne, a 0,5 tout se passe deux fois moins vite,
   a 0 le monde se fige sans que personne n'ait a savoir qu'il est fige.

   POURQUOI CE FICHIER N'EST PAS DANS LE MOTEUR, ET SURTOUT PAS DANS LES HAIES.

   Le tutoriel des haies est ce qui l'a demande — montrer un geste de quatre
   dixiemes de seconde a quelqu'un qui ne l'a jamais vu — mais ralentir le
   monde n'est pas une notion de haies, et la boucle d'image ne doit pas
   importer le reglement des haies pour savoir a quelle vitesse tourner. La
   dependance va donc dans ce sens : la boucle lit ce nombre, et celui qui
   ralentit le pose. Ni l'un ni l'autre ne connait l'autre.

   CE QUI NE RALENTIT PAS AVEC LUI, et il faut le savoir avant de s'en servir :
   la musique et les bruits, qui vivent sur l'horloge du navigateur ; les
   animations de l'interface React, qui sont du CSS ; les minuteurs poses en
   millisecondes. Le monde simule ralentit, ce qu'on a colle par-dessus non.
   Un ralenti sert donc a REGARDER un geste, pas a rejouer une course entiere.
--------------------------------------------------------------------------- */

/**
 * Bornes. Au-dela de 1 on accelererait le jeu — personne n'en a besoin, et un
 * facteur qui derape passerait le plafond de `dt` dans la boucle d'image, ou
 * le moteur cesse d'etre stable. En dessous de 0, rien n'a de sens.
 */
const MINI = 0;
const MAXI = 1;

let tempo = 1;

/** Le facteur courant. La boucle d'image en multiplie son pas de temps. */
export function tempoDuMonde(): number {
  return tempo;
}

/** Ralentir le monde. 1 le rend a sa vitesse, 0 le fige. */
export function poserLeTempo(t: number): void {
  tempo = Number.isFinite(t) ? Math.max(MINI, Math.min(MAXI, t)) : 1;
}

/** Rendre au monde sa vitesse. A appeler en quittant ce qui l'a ralenti. */
export function rendreLeTempo(): void {
  tempo = 1;
}
