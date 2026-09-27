/* ---------------------------------------------------------------------------
   LA NUIT DU MOLOSSE — la loi du son
   ---------------------------------------------------------------------------
   AUCUN IMPORT DANS CE FICHIER, comme halloween-loi.js et pour la meme
   raison : ce qui se verifie sans lancer une course doit pouvoir se verifier
   sans lancer une course. Un harnais charge ces douze fonctions sous node,
   sans navigateur, sans contexte audio et sans piste
   (tools/halloween-son-test.mjs).

   Ce n'est pas une precaution de style. Un mix se regle a l'oreille, mais
   ses COURBES se verifient : qu'aucun gain ne depasse le plafond, qu'aucune
   ne soit discontinue, que le grondement ne s'entende pas avant sa portee,
   que le coeur ne parte pas au coup de pistolet. Tout cela se lit en nombres,
   et se lit mieux ici que dans un navigateur ouvert a minuit.

   POURQUOI LA BETE FAIT DU BRUIT, ET CE QUE CA CHANGE.

   Jusqu'ici le mode n'avait qu'un son : la musique. Le molosse arrivait
   derriere le joueur en silence. On le voyait dans un coin de l'ecran quand
   il etait deja trop tard, et on sentait ses foulees dans le chassis de
   l'appareil — c'etait tout.

   Or une poursuite se joue D'ABORD A L'OREILLE. Ce qui fait peur n'est pas ce
   qu'on voit : c'est ce qui arrive derriere soi, la ou l'on ne regarde pas, et
   qu'on doit evaluer sans se retourner. Le jeu demande deja au joueur de
   regarder devant — la ligne, les appuis, le chrono. Lui donner l'information
   qui compte par l'oreille, c'est lui laisser les yeux pour courir.

   QUATRE SOURCES, ET PAS UNE DE PLUS.

     LE GRONDEMENT  un lit grave et continu, qui dit « elle est la ».
     LES FOULEES    deux par foulee, calees sur la DISTANCE — c'est le son
                    qui porte toute l'information : sa cadence dit sa vitesse,
                    son volume dit sa distance.
     LE COEUR       celui du JOUEUR, pas celui de la bete, sous le seuil.
     LE STINGER     un par nuit, jamais au meme endroit.

   On a essaye d'y ajouter un halement et un claquement de machoire. Deux
   sources de trop : a cinq foulees par seconde, l'oreille ne separe plus, et
   tout devient une bouillie de bruit blanc ou l'on ne lit plus la distance.
   Ce qui rend la bete lisible, c'est le SILENCE ENTRE SES APPUIS.

   TOUT EST CALE SUR DOUZE METRES, comme le reste du mode : la jauge du HUD
   (HalloweenHUD.tsx) et le tremblement du sol (halloween.ts) s'allument a la
   meme distance. Une seule regle, trois facons de l'entendre — et le joueur
   qui apprend l'une apprend les trois.
--------------------------------------------------------------------------- */

/**
 * LA PORTEE, en metres.
 *
 * La meme que la jauge et que le tremblement, et il faut que ce soit la meme.
 * Un son qui commencerait a vingt metres et une jauge qui s'allumerait a douze
 * apprendraient au joueur deux distances differentes pour une seule menace :
 * il finirait par ne se fier ni a l'une ni a l'autre.
 */
export const PORTEE = 12;

/**
 * LE PLAFOND DE TOUT CE QUI SORT D'ICI.
 *
 * Aucune source du mode ne depasse cette valeur, et le harnais le verifie sur
 * toute la plage d'ecarts. C'est la traduction chiffree d'une regle du brief —
 * jamais de pic brutal au-dessus du mix — et la seule facon de tenir cette
 * promesse est de pouvoir la mesurer.
 *
 * La reference : la musique du jeu tourne a 0,34 (voir `Audio_.gain` dans
 * sprinter-app.js), les bruitages a 0,55. La bete a pleine proximite se tient
 * donc au niveau d'un bruitage ordinaire, jamais au-dessus.
 */
export const PLAFOND = 0.55;

/**
 * La proximite de la bete, de 0 (hors de portee) a 1 (sur le dos).
 *
 * Recopiee de `proximite` (halloween-molosse.js) plutot qu'importee : ce
 * fichier ne doit rien importer, et trois lignes coutent moins cher que la
 * dependance qui ferait tomber le harnais.
 */
export function proximite(ecart) {
  if (!(ecart > -Infinity)) return 0;
  return Math.max(0, Math.min(1, 1 - ecart / PORTEE));
}

/**
 * LE GRONDEMENT — le lit grave, continu, qui ne dit qu'une chose : elle est la.
 *
 * EN CARRE, ET NON LINEAIRE. C'est la decision la plus importante de ce
 * fichier. Une rampe lineaire commence a s'entendre des le premier metre de la
 * portee : a onze metres la bete gronde deja a un douzieme de son volume, ce
 * qui est parfaitement audible dans un casque et parfaitement inutile — le
 * joueur apprend qu'elle est loin, information dont il n'a rien a faire.
 *
 * Au carre, les quatre premiers metres de la portee ne rendent presque rien,
 * puis ca monte vite. Le grondement devient un evenement au lieu d'etre un
 * decor, et c'est exactement ce qu'on veut : on ne l'entend pas arriver, on
 * s'apercoit qu'il est la.
 *
 * Le facteur 0,42 le tient sous la musique : le grondement accompagne, il ne
 * couvre pas. Ce qui doit percer, ce sont les foulees.
 */
export function grondement(ecart) {
  const p = proximite(ecart);
  return PLAFOND * 0.42 * p * p;
}

/**
 * LA COUPURE DU FILTRE, en hertz — et c'est elle qui dit la distance.
 *
 * Un son lointain perd ses aigus avant de perdre son volume : l'air absorbe
 * les hautes frequences, et l'oreille s'en sert pour estimer une distance
 * depuis bien avant qu'on invente les haut-parleurs. C'est le seul indice de
 * distance qui fonctionne dans un casque sans spatialisation couteuse, et
 * c'est gratuit — un biquad par mode, pas un par source.
 *
 * DE 240 HZ A 5200 HZ. A la limite de portee on n'entend qu'une masse sourde,
 * sans rien d'identifiable ; sur le dos, les griffes sur le gravier passent.
 * Ce sont ces griffes qui font le saut au coeur, et elles n'existent qu'au
 * -dessus de trois kilohertz.
 *
 * L'interpolation est GEOMETRIQUE, parce que l'oreille entend les frequences
 * en octaves et non en hertz : une rampe lineaire passerait les trois quarts
 * de sa course dans les aigus, ou personne ne remarque plus rien, et
 * garderait la bete sourde jusqu'au dernier metre.
 */
export function coupure(ecart) {
  const BAS = 240, HAUT = 5200;
  const p = proximite(ecart);
  return BAS * Math.pow(HAUT / BAS, p);
}

/**
 * LE VOLUME D'UNE FOULEE.
 *
 * `lourde` distingue les deux temps du galop : les posterieurs poussent
 * ensemble, les anterieurs rattrapent. Le meme rapport que le tremblement du
 * sol (0,62 pour le temps leger, voir halloween.ts), et pour la meme raison —
 * deux battements egaux font un moteur, pas un galop.
 *
 * EN CARRE AUSSI, mais moins creuse que le grondement : les foulees doivent
 * s'entendre AVANT lui. Elles portent l'information (a quelle cadence elle
 * court, donc a quelle vitesse elle gagne), lui ne porte que la presence. Un
 * mode ou l'on entendrait la presence avant le mouvement dirait au joueur
 * qu'il est en danger sans lui dire a quel point.
 */
export function foulee(ecart, lourde) {
  const p = proximite(ecart);
  return PLAFOND * (lourde ? 1 : 0.62) * (0.22 * p + 0.78 * p * p);
}

/**
 * LE SEUIL DU COEUR, en secondes.
 *
 * Sous une seconde et demie de bete, le coeur du joueur se met a battre. Le
 * brief le demande, et le nombre est le sien.
 */
export const SEUIL_COEUR = 1.5;

/**
 * COMBIEN DE SECONDES DE BETE RESTENT DERRIERE SOI.
 *
 * Pas des metres : des SECONDES. C'est la seule unite qui veut dire quelque
 * chose ici — huit metres devant un chien lance a douze metres par seconde,
 * c'est deux tiers de seconde, et huit metres devant un chien qui demarre,
 * c'est une eternite. Le joueur ne compte pas en metres, il compte en « est-ce
 * que j'ai le temps ».
 *
 * La vitesse nulle rend l'infini plutot qu'une division par zero : au coup de
 * pistolet la bete est couchee derriere la ligne, et un coeur qui s'emballerait
 * la annoncerait une morsure qui n'a pas commence.
 */
export function secondesDeBete(ecart, vitesse) {
  if (!(vitesse > 0.01)) return Infinity;
  return Math.max(0, ecart) / vitesse;
}

/**
 * LE COEUR : bat-il, a quel tempo, et a quel volume.
 *
 * Rend `null` au-dessus du seuil — il n'y a alors rien a jouer, et rendre un
 * objet a volume nul aurait fait battre un coeur muet soixante fois par
 * seconde pour rien.
 *
 * LE TEMPO MONTE DE 88 A 168 BATTEMENTS PAR MINUTE. Le bas est un coeur au
 * repos qu'on commence tout juste a sentir ; le haut est un coeur de fin de
 * course, et au-dela on entre dans le bourdonnement, qui ne se lit plus comme
 * un coeur.
 *
 * ET IL NE S'ARRETE PAS A LA MORSURE — c'est l'appelant qui coupe. Ce fichier
 * ne connait que des nombres.
 */
export function coeur(secondes) {
  if (!(secondes < SEUIL_COEUR)) return null;
  // `serre` vaut 0 au seuil et 1 sur le dos de la bete.
  const serre = Math.max(0, Math.min(1, 1 - secondes / SEUIL_COEUR));
  return {
    bpm: 88 + 80 * serre,
    // Le volume monte plus vite que le tempo : un coeur qui accelere sans
    // gagner en presence se lit comme une horloge.
    gain: PLAFOND * 0.30 * (0.25 + 0.75 * serre * serre),
    serre,
  };
}

/**
 * L'INSTANT DU STINGER, en secondes depuis le depart.
 *
 * UN PAR NUIT, ET JAMAIS AU MEME ENDROIT. Le brief est precis la-dessus, et
 * il a raison : un stinger qui tombe deux fois au meme moment cesse d'etre un
 * stinger des la deuxieme fois — il devient un repere, et un repere rassure.
 *
 * `tirage` est un nombre de [0, 1[ tire a l'armement de la nuit. Le passer en
 * argument plutot que de tirer ici garde la fonction PURE, donc verifiable :
 * le harnais balaie mille tirages sur les treize nuits et verifie que l'instant
 * tombe toujours dans la fenetre, jamais avant, jamais apres.
 *
 * LA FENETRE VA DE 25 % A 75 % DU TEMPS IMPARTI, et les deux bornes sont
 * payees :
 *
 *   - AVANT 25 %, le joueur est encore dans son depart. Il regarde ses appuis,
 *     pas la piste, et un stinger la se perd — ou pire, le fait rater sa
 *     montee en cadence, ce qui transforme une mise en scene en punition.
 *   - APRES 75 %, il voit la ligne. Rien de ce qu'on jouera ne le detournera
 *     de la finir, et un stinger ignore est un stinger gaspille.
 *
 * Entre les deux, il est installe dans sa course et il a encore tout a perdre.
 * C'est la que ca fait mal.
 */
export function stinger(imparti, tirage) {
  const t = Math.max(0, Math.min(0.999999, tirage));
  return imparti * (0.25 + 0.50 * t);
}

/**
 * LE SILENCE QUI PRECEDE — en secondes, avant le stinger.
 *
 * On coupe le grondement quatre dixiemes de seconde avant. Le brief appelle
 * ca « le silence comme outil », et c'est la seule chose de ce fichier qui ne
 * s'explique pas par l'acoustique : une oreille qui vient de perdre un son
 * qu'elle suivait le CHERCHE, et une oreille qui cherche est une oreille
 * ouverte. Le stinger tombe dedans.
 *
 * Quatre dixiemes, et pas une seconde : au-dela, le joueur n'entend plus un
 * silence, il entend une panne de son.
 */
export const SILENCE = 0.4;

/**
 * LA FRAYEUR REDUITE, appliquee a un gain.
 *
 * L'option du brief (§7) retire les stroboscopes et les distorsions et
 * ATTENUE les stingers — elle ne coupe pas le son. Un mode muet n'est pas un
 * mode confortable, c'est un mode casse : le joueur qui active cette option
 * veut jouer sans se faire agresser, pas jouer sans savoir ou est le chien.
 *
 * On garde donc tout ce qui porte de l'information — grondement, foulees,
 * coeur — a un niveau reduit, et on ramene le stinger au niveau d'un bruitage
 * ordinaire, ou il surprend sans faire sursauter.
 */
export function attenue(gain, reduite, estStinger) {
  if (!reduite) return gain;
  return gain * (estStinger ? 0.28 : 0.70);
}
