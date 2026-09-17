/* ---------------------------------------------------------------------------
   HURDLERS — ce qui se joue entre deux haies
   ---------------------------------------------------------------------------
   La geometrie vit dans haies.js. Ici vivent les regles : combien d'appuis
   tient un intervalle, d'ou l'on doit attaquer la haie, et ce que coute une
   attaque manquee.

   LE RYTHME EST CELUI QUE COMPTE L'ENTRAINEUR (haies.js, APPUIS) :

       100 m et 110 m haies : 7 appuis jusqu'a la premiere, puis 4 par
                              intervalle, libre apres la dixieme.
       400 m haies          : 21 a 23 appuis jusqu'a la premiere, puis 13 a 17
                              par intervalle selon la vitesse, libre apres.

   Il remplace deux regles qui vivaient ici et qui jugeaient autre chose : la
   PARITE sur les courtes (quatre ou six appuis tenaient, cinq cassaient) et
   la CONSTANCE sur le tour (c'etait le changement de nombre qui coutait, pas
   le nombre). Toutes deux se deduisaient du moteur ; le reglement, lui, se
   compte. Ce que la constance avait appris reste vrai : une regle qui punit
   le progres est un defaut. C'est pourquoi le tour tient une FOURCHETTE, et
   que le harnais verifie qu'accelerer ne fait jamais sortir du rythme.

   Le joueur ne pose pas ses pieds : il tape, et c'est sa vitesse qui decide
   de sa foulee, donc du nombre d'appuis. Le rythme se gagne donc a la cadence
   du doigt, et c'est la foulee du hurdleur (Runner.foulee) qui fait tomber le
   compte juste a une cadence soutenue — voir haies-pas.js pour la facon dont
   le pied d'appel se cale sur la haie.
--------------------------------------------------------------------------- */

import { HAIES, APPUIS, positionsDes } from './haies.js';

/**
 * Ou l'on quitte le sol devant la haie, et ou l'on retombe derriere.
 *
 * Ces distances ne sont pas des reglages : ce sont les valeurs mesurees sur
 * des hurdleurs. Elles expliquent pourquoi la foulee entre les haies est si
 * courte — sur un intervalle de 9,14 m, l'appel et la reception en mangent
 * 3,55 a eux seuls, et il reste 5,6 m pour trois foulees. Un hurdleur ne
 * court pas comme un sprinteur : il court plus serre et plus vite en
 * frequence, et c'est tout le jeu.
 */
export const APPEL = {
  '100h': { avant: 2.00, apres: 1.05 },
  // MESURE SUR COLIN JACKSON, 4e haie (Coh 2003, New Studies in Athletics
  // 18:1, analyse cinematique 3-D a 50 Hz). Foulee de haie totale 3,67 m :
  // appel a 2,09 m, reception a 1,58 m, soit un rapport de 56,9/43,1.
  //
  // Le jeu portait 2,15/1,40, c'est-a-dire 60,6/39,4 — exactement le rapport
  // 60/40 que la litterature donne pour optimal, mais avec une foulee totale
  // trop courte de 12 cm. On prend le mesure plutot que le theorique : c'est un
  // hurdleur reel, chronometre, et c'est a des hurdleurs que ce jeu doit
  // ressembler. Si une moyenne sur plusieurs athletes arrive un jour, c'est
  // ici qu'elle remplacera Jackson.
  '110h': { avant: 2.09, apres: 1.58 },
  '400h': { avant: 2.15, apres: 1.20 },
};

/**
 * DE COMBIEN LE CORPS EST DEJA DEVANT LE PIED QUAND ON QUITTE LE SOL, en metres.
 *
 * La foulee de haie se mesure d'un pied a l'autre — 3,67 m chez Jackson. Mais
 * ce n'est pas cette distance-la qui decide du TEMPS passe en l'air : le corps
 * a deja depasse le pied d'appel au moment du decollage, et il retombe
 * pratiquement a l'aplomb du pied de reception. Chez Jackson, le centre de
 * masse est 0,38 m devant le pied dans la phase de poussee, et 0,05 m derriere
 * le pied a la reception. Son centre de masse ne parcourt donc que 3,30 m — et
 * 3,30 / 9,11 donne 0,362 s, soit exactement le vol de 0,36 s mesure.
 *
 * LE DECALAGE EST A L'APPEL, PAS A LA RECEPTION, et l'avoir mis au mauvais bout
 * a coute un harnais : les dix receptions tombaient alors a 1,25 m derriere la
 * haie au lieu de 1,58. Le coureur quitte donc le sol quand SON CORPS atteint
 * `haie - avant + AVANCE_CM`, et il se recoit ou le reglement le dit.
 *
 * Sans cette correction, le vol se chronometrait sur 3,67 m et durait 0,42 s a
 * la vitesse reelle de Jackson : cinq centiemes de trop par haie, une
 * demi-seconde sur la course.
 */
export const AVANCE_CM = 0.38;

/**
 * CE QUE COUTE UNE HAIE, et pourquoi les deux epreuves ne le paient pas pareil.
 *
 * C'est la partie qui a demande le plus de mesures, et la seule qu'aucun
 * raisonnement ne donnait d'avance.
 *
 * Le premier modele ne retirait qu'un peu de vitesse au passage. L'automate
 * bouclait alors un 110 m haies en 10,37 s quand le record du monde est a
 * 12,80 : il courait un 110 m plat avec des egratignures. Descendre la vitesse
 * gardee jusqu'a 0,84 ne rendait que quatre dixiemes sur la course entiere,
 * parce que le moteur reaccelere plus vite qu'une haie ne coute.
 *
 * Ce qui manquait n'etait pas une penalite mais LE VOL — le temps ou l'on ne
 * pousse plus. Le moteur savait deja le faire : `freeze` laisse le coureur
 * avancer et freiner mais lui interdit de reprendre de la vitesse.
 *
 * SUR LES COURTES, le vol est une DISTANCE, pas une duree. Le reglement la
 * donne : on quitte le sol 2,15 m avant la haie et on retombe 1,40 m apres,
 * soit 3,55 m des 9,14 de l'intervalle. Une duree fixe donnait 4,7 m a pleine
 * vitesse — plus de la moitie de l'intervalle — et le rythme alternait alors
 * 5,4,5,4 sans jamais se poser, ce qu'aucun joueur n'aurait pu tenir. Rapporte
 * a la vitesse du moment, le vol laisse toujours 5,59 m au sol, soit les trois
 * foulees d'un hurdleur.
 *
 * SUR LE TOUR, c'est une duree, et plus longue. L'intervalle y fait 35 m : le
 * vol n'en represente qu'un dixieme, et un 400 m haies calcule ainsi ne se
 * distinguait plus d'un 400 m plat — entre taper a neuf et taper a treize, le
 * chrono ne bougeait que d'une demi-seconde. Ce qui coute sur le tour n'est pas
 * le saut, c'est de courir POUR la haie sur trente-cinq metres : on regle sa
 * foulee bien avant, on ne court jamais librement. La seconde represente cela.
 * Elle ne coute d'ailleurs pas une seconde au chrono — le coureur reprend sa
 * vitesse ensuite, et la perte nette tourne autour de quatre dixiemes, ce qui
 * est l'ecart reel entre le tour plat et le tour de haies.
 */
export const COUT = {
  '100h': { vol: 'distance' },
  '110h': { vol: 'distance' },
  '400h': { vol: 'duree', duree: 1.00 },
};

/**
 * La vitesse la plus basse a laquelle on passe une haie, en m/s. Un coureur
 * arrive presque arrete sur son appel resterait sinon en l'air des secondes
 * durant pour couvrir ses 3,55 m.
 */
export const VITESSE_VOL_MIN = 1;

/**
 * Combien de temps le coureur reste en l'air, a cette vitesse.
 *
 * Sur le chemin du CENTRE DE MASSE, pas sur la foulee d'un pied a l'autre —
 * voir AVANCE_CM, qui dit pourquoi et ce que l'erreur coutait.
 */
export function volDe(cle, v) {
  const c = COUT[cle];
  if (c.vol === 'duree') return c.duree;
  const a = APPEL[cle];
  return Math.max(0.05, a.avant + a.apres - AVANCE_CM) / Math.max(VITESSE_VOL_MIN, v);
}

/**
 * CE QU'UN CORPS EN L'AIR PERD VRAIMENT, en freinage par seconde.
 *
 * C'est la correction la plus lourde de tout ce travail, et elle vient d'une
 * mesure : Jackson passe sa 4e haie en perdant 0,34 m/s sur 9,11, soit 3,7 %.
 * Le jeu en perdait 26.
 *
 * LA CAUSE ETAIT IDENTIFIEE A LA LIGNE PRES. Pendant le vol, le moteur
 * continuait d'appliquer le freinage du coureur, C.DRAG = 0,8 : sur 0,36 s de
 * vol, exp(-0,8 x 0,36) = 0,75, et le coureur se recevait a trois quarts de sa
 * vitesse. Mais UN CORPS EN L'AIR NE FREINE PAS COMME UN COUREUR QUI A CESSE
 * DE POUSSER : il n'y a plus de contact au sol, il ne reste que l'air.
 *
 * 0,105 par seconde rend exactement les 3,7 % de Jackson sur ses 0,36 s de vol,
 * et c'est le huitieme du freinage au sol. Le vol garde ainsi son cout — on n'y
 * pousse pas, et c'est ce que `freeze` represente — sans plus faire du
 * franchissement une punition. Toute la doctrine du hurdling tient dans cette
 * phrase : on ne perd pas de vitesse sur la haie.
 *
 * Le cout reste proportionnel a la duree : un appel donne de trop loin fait
 * planer plus longtemps, et se paie donc davantage, sans qu'aucune penalite
 * n'ait besoin d'etre inventee.
 */
export const DRAG_VOL = 0.105;

/**
 * OU TOMBE LE CISEAU DANS LE VOL, en part de sa duree.
 *
 * Le ciseau est le geste qui definit le hurdling : la jambe d'attaque griffe
 * vers le bas pendant que la jambe arriere passe, genou vers l'aisselle. C'est
 * lui qui remet le coureur en course au lieu de le faire retomber en arriere.
 *
 * CE NOMBRE EST UNE HYPOTHESE, ET IL FAUT LE DIRE. Coh (2003) chronometre tout
 * le reste du franchissement de Jackson — vol 0,36 s, contact d'appel 0,100 s,
 * contact de reception 0,080 s, genou de la jambe d'attaque a 13,8 m/s, pied a
 * 18,2 — mais pas l'instant ou la jambe arriere passe. La moitie du vol est le
 * point le plus defendable a defaut de mesure : c'est a peu pres le sommet de
 * la trajectoire, la ou la jambe d'attaque est tendue et ou il faut commencer
 * a l'abattre. Le jour ou une mesure arrive, elle remplace ce 0,50.
 *
 * LA CIBLE SUIT LE VOL, DONC ELLE SE RESSERRE AVEC LA VITESSE — et c'est toute
 * la lecon de dynamisme. A 9,2 m/s le vol dure 0,37 s et le ciseau se place a
 * 185 ms ; a 11 il dure 0,32 et il faut couper a 160. Un hurdleur rapide n'a
 * pas le loisir de trainer sa jambe arriere.
 */
export const CISEAU_VISE = 0.50;

/**
 * La tolerance autour du ciseau, en secondes.
 *
 * CONSTANTE, elle, et pas une part du vol : la cible se resserre avec la
 * vitesse, la precision exigee non. C'est la meme regle que pour l'appel
 * (TOLERANCE_T) et pour la meme raison — une fenetre qui retrecit quand le
 * joueur progresse est une regle qui punit le progres.
 *
 * LE COTE TOT A ETE ELARGI, et c'etait un piege, pas une difficulte. A 85 ms,
 * « accroche » se declenchait des qu'on relachait avant 65 a 98 ms selon la
 * vitesse — or UNE FRAPPE ORDINAIRE SUR UN PAVE DURE 50 A 80 ms. Le reflexe
 * qu'un joueur apporte de Sprinter tombait donc exactement dans l'accrochage,
 * a chaque haie, sans qu'il puisse comprendre pourquoi. C'est ce que l'essai
 * au pouce a remonte : « l'accrochage a la haie revient trop souvent ».
 *
 * A 135 ms, la frontiere descend sous 50 ms a toute vitesse de jeu : une
 * frappe reflexe devient un
 * ciseau moyen — on passe, on gratte — et TENIR le pave devient ce qui paie.
 * Le joueur apprend en etant recompense d'avoir tenu plutot que puni d'avoir
 * tape, ce qui n'est pas la meme chose a vivre.
 */
export const TOLERANCE_CISEAU = { parfait: 0.045, bon: 0.135 };

/**
 * ET ELLE NE PEUT PAS AVALER LE VOL, en part de sa duree.
 *
 * L'elargissement du cote tot a eu une consequence qu'on n'attendait pas sur
 * la plus courte des trois courses : le vol du 100 m haies dure 243 ms, et une
 * tolerance de 135 ms de part et d'autre d'une cible a 121 ms couvrait
 * l'integralite du vol. Plus aucun relache n'y etait faux — ni trop tot, ni
 * trop tard. Le geste existait encore, il ne se jugeait plus.
 *
 * La tolerance est donc bornee a ces parts du vol. Sur les longues elle ne
 * mord pas ; sur les courtes elle se resserre juste assez pour qu'il reste, de
 * chaque cote, de quoi se tromper.
 */
export const PART_TOLERANCE_CISEAU = { parfait: 0.18, bon: 0.40 };

/**
 * SOUS QUELLE PART DU VOL UN RELACHE N'EST PAS UN CISEAU DU TOUT.
 *
 * LE DEFAUT QUE CE NOMBRE FERME, et il etait grave : « quand j'appuie comme
 * sur le 100 m je fais 11 secondes sur le 110 m haies ». Marteler les paves
 * comme sur le plat passait les dix haies.
 *
 * C'est une sur-correction de ma part. La fenetre du cote tot avait ete
 * elargie pour qu'une frappe reflexe ne soit plus un ACCROCHAGE — elle ne
 * l'etait plus, mais elle devenait un ciseau MOYEN, qui ne coute que trois
 * centiemes et demi. Le geste cessait d'etre obligatoire : on pouvait jouer
 * Hurdlers avec les doigts de Sprinter.
 *
 * Le bon decoupage est en trois, pas en deux :
 *
 *   sous ce plancher   ON N'A PAS CISEAUTE. On a tape, on n'a pas tenu. Le
 *                      coureur franchit a plat, et cela coute le prix entier
 *                      (GARDE_CISEAU.absent) — le meme que si l'on n'avait
 *                      jamais leve le pouce, parce que c'est la meme chose.
 *   entre les deux     on a ciseaute trop tot : la jambe d'attaque n'etait pas
 *                      tendue, on accroche la barre. C'est une faute de
 *                      technique, pas une absence de geste.
 *   dans la fenetre    le ciseau.
 *
 * 30 % du vol, soit 90 ms sur le 110 m haies a pleine vitesse. Une frappe
 * ordinaire dure 50 a 80 ms : elle tombe donc sous le plancher, et le joueur
 * lit « PAS DE CISEAU » — ce qui est exactement ce qu'il a fait, et ce qui lui
 * dit quoi faire. L'ancien « ACCROCHEE » ne le lui disait pas.
 */
export const CISEAU_PLANCHER = 0.30;

/**
 * CE QUE LE CISEAU GARDE DE LA VITESSE, et c'est ici que le jeu cesse d'etre
 * Sprinter avec des haies dessinees dessus.
 *
 * Le freinage de l'air (DRAG_VOL) est de la physique : on le subit, on n'y peut
 * rien. Ce qui suit est de la TECHNIQUE, et c'est ce que le joueur decide.
 *
 * Jackson perd 3,7 % en passant sa haie. Un hurdleur de club en perd le triple,
 * et pas parce qu'il vole plus longtemps : parce qu'il retombe DERRIERE son
 * appui, jambe arriere en retard, et qu'il passe sa premiere foulee a se
 * remettre sous lui. C'est exactement ce que ces cinq nombres representent.
 *
 *   ciseau     le relache tombe dans la fenetre : on repart en courant
 *   bon        un peu tot ou un peu tard, on gratte
 *   accroche   relache trop tot : la jambe d'attaque n'est pas tendue, on
 *              touche la barre
 *   traine     relache trop tard : la jambe arriere suit, on se recoit assis
 *   absent     jamais relache : on franchit a plat, pieds joints, et l'on
 *              retombe sans avoir couru
 *
 * LES VALEURS SONT CALEES SUR CE QUE LE GESTE DOIT PESER, mesure au harnais
 * sur le 110 m haies a dix frappes par seconde, appel juste a chaque haie :
 *
 *     ciseau net   12,75 s      un ciseau mal place coute trois dixiemes,
 *     un peu tot   13,10 s      ne jamais ciseauter en coute pres d'un et
 *     un peu tard  13,08 s      demi. C'est l'ordre de grandeur voulu : la
 *     jamais       14,15 s      faute se sent sans que la course soit finie.
 *
 * Un premier jeu de valeurs (absent a 0,86) ne donnait que trois dixiemes entre
 * le meilleur et le pire ciseau de la course entiere — le geste existait, il ne
 * pesait rien, et le moteur reprenait la vitesse plus vite que la haie ne la
 * retirait. C'est le piege que COUT nomme deja, et il ressort a chaque fois
 * qu'on ajoute un cout ponctuel dans ce jeu.
 */
export const GARDE_CISEAU = {
  ciseau: 1, bon: 0.965, accroche: 0.85, traine: 0.88, absent: 0.70,
};

/**
 * Juger un ciseau : le relache est-il tombe au bon moment du vol ?
 *
 * `part` est l'instant du relache rapporte a la duree du vol, de 0 (a l'appel)
 * a 1 (a la reception). `vol` est cette duree, en secondes — elle sert a
 * ramener la tolerance, qui est en temps, sur la meme echelle.
 */
export function jugerCiseau(part, vol) {
  if (part === null || part === undefined) return { note: 'absent', garde: GARDE_CISEAU.absent, ecart: null };
  const v = Math.max(0.05, vol);
  const ecart = (part - CISEAU_VISE) * v;
  const e = Math.abs(ecart);
  // La tolerance est en temps, mais bornee a une part du vol : voir
  // PART_TOLERANCE_CISEAU, qui dit ce que l'oubli coutait sur le 100 m haies.
  // RELACHE TROP TOT POUR ETRE UN CISEAU : on a tape, on n'a pas tenu. Voir
  // CISEAU_PLANCHER — c'est ce qui empeche de jouer les haies au martelement.
  if (part < CISEAU_PLANCHER) return { note: 'absent', garde: GARDE_CISEAU.absent, ecart };
  const seuil = k => Math.min(TOLERANCE_CISEAU[k], PART_TOLERANCE_CISEAU[k] * v);
  if (e <= seuil('parfait')) return { note: 'ciseau', garde: GARDE_CISEAU.ciseau, ecart };
  if (e <= seuil('bon')) return { note: 'bon', garde: GARDE_CISEAU.bon, ecart };
  return ecart < 0
    ? { note: 'accroche', garde: GARDE_CISEAU.accroche, ecart }
    : { note: 'traine', garde: GARDE_CISEAU.traine, ecart };
}

/**
 * La tolerance autour du point d'appel, en metres.
 *
 * PARFAIT : on passe sans rien perdre. La zone est etroite — c'est ce qui
 * fait qu'un bon intervalle se sent.
 * BON : on passe, on gratte. La zone est large exprès : un jeu ou seul le
 * parfait paie est un jeu ou l'on subit, pas un jeu ou l'on court.
 * Au-dela : trop pres on hache la foulee, trop loin on plane. Les deux
 * coutent, et pas de la meme facon.
 */
export const TOLERANCE = { parfait: 0.30, bon: 0.75 };

/**
 * Ce que garde un coureur selon son appel, en part de sa vitesse.
 *
 * Le hache (trop pres) coute plus que le plane (trop loin) : arriver sur la
 * haie est un mur, l'aborder de loin n'est qu'un temps perdu en l'air. Un
 * hurdleur le dirait autrement — on se releve d'un appel long, on ne se releve
 * pas d'un appel court.
 */
export const GARDE = { parfait: 1, bon: 0.985, plane: 0.945, hache: 0.90 };

/**
 * Ce que coute un rythme rompu, en part de vitesse gardee.
 *
 * Un compte d'appuis hors du reglement, sur la premiere ligne droite comme
 * dans un intervalle, sur les courtes comme sur le tour : un seul cout, parce
 * que c'est la meme chose qui arrive au coureur — il arrive sur la haie sans
 * savoir comment il va la passer.
 *
 * IL SE PAIE ENTRE DEUX BORNES, toutes deux mesurees par les harnais.
 *
 * Par le haut : un rythme rompu doit couter assez pour qu'un coureur lance ne
 * prefere pas le casser plutot que de hacher sa foulee. Entre sept appuis
 * haches (0,90) et six appuis planes (0,945 x ce cout), il doit choisir sept :
 * le cout doit rester sous 0,952. A 0,955, il prenait six.
 *
 * Par le bas : trop cher, le rythme creuse un fosse entre le coureur qui le
 * tient et celui qui le manque, et un plateau tombe dedans. A 0,93 plus aucune
 * cadence de doigt ne donnait le niveau national du 110 m haies : on passait
 * de quinze secondes a treize sans s'y arreter.
 */
export const GARDE_RYTHME_ROMPU = 0.94;

/* ---------------------------------------------------------------------------
   CE QUI NE SERT QU'A L'APPEL DECLENCHE PAR LE JOUEUR (canal.ts, APPEL_JOUEUR)
   ---------------------------------------------------------------------------
   Tant que la machine vise, rien de ce qui suit ne s'applique : viser() choisit
   l'appui qui coute le moins, et le joueur ne peut ni rater sa jambe, ni
   percuter, ni marteler en l'air puisque ses frappes y sont ignorees. Des que
   c'est lui qui quitte le sol, les trois arrivent.
--------------------------------------------------------------------------- */

/**
 * LA TOLERANCE, EN SECONDES — et pourquoi elle ne pouvait pas rester en metres.
 *
 * TOLERANCE est une distance. Rapportee au temps, elle donne ±32 ms a 9,5 m/s
 * mais ±27 ms a 11 : PLUS LE JOUEUR VA VITE, PLUS SA FENETRE RETRECIT. Tant que
 * la machine vise, c'est sans effet — elle tombe au centimetre quelle que soit
 * la vitesse. Sous un pouce, c'est une regle qui punit le progres, et ce
 * fichier dit deja en toutes lettres qu'une regle qui punit le progres est un
 * defaut (voir le rythme du tour, plus haut).
 *
 * La fenetre se mesure donc en temps, et la distance ne sert plus que de
 * PLANCHER : un coureur presque arrete garde la tolerance en metres, sans quoi
 * elle se refermerait sur lui.
 *
 * CES DEUX NOMBRES NE SONT PAS MESURES, ils sont un point de depart. 65 ms
 * vient des jeux de rythme, ou le « parfait » tient entre 40 et 50 ms — on
 * l'ouvre parce qu'ici le pouce doit quitter un pave qu'il martele, ce qu'aucun
 * jeu de rythme ne demande. Ils se calent a la main, sur telephone, et nulle
 * part ailleurs : aucun harnais ne sait dire si une fenetre se sent.
 */
export const TOLERANCE_T = { parfait: 0.065, bon: 0.110 };

/**
 * A quelle distance de la haie il est trop tard pour s'appeler, en metres.
 *
 * Le joueur qui arrive la sans avoir appuye ne saute plus : il PERCUTE. C'est
 * la seule faute de la course qui vienne entierement de lui, et c'est ce qui
 * rend le reste honnete — sans elle, ne rien faire reviendrait a franchir.
 *
 * 50 cm. Il y avait 80, et la video d'essai a montre que c'etait trop haut :
 * entre « trop pres mais passe » et « percutee » il ne restait que 36 ms a dix
 * metres par seconde. Un joueur en retard ne glissait pas d'un cran, il tombait
 * du mur — sept « trop pres » et trois percussions sur la meme course.
 *
 * A 50 cm, la zone « trop pres » fait 66 ms au lieu de 36 : on peut etre en
 * retard et passer laid, ce qui est une facon de rater dont on apprend quelque
 * chose. La percussion reste ce qu'elle etait, elle arrive juste plus tard.
 *
 * La borne basse ne bouge pas : il faut rester sous la fenetre « bon » a toute
 * vitesse de jeu (elle se referme a 1,10 m a 9,5 m/s, a 0,94 m a 11), sans quoi
 * « trop pres » n'existerait plus du tout.
 */
export const APPEL_MINI = 0.50;

/**
 * A QUELLE DISTANCE DE LA HAIE UN APPUI DEVIENT L'APPEL, en metres devant elle.
 *
 * LE DEFAUT QU'ELLE CORRIGE, et c'en etait un gros. Depuis que le geste vit sur
 * le pave, n'importe quel appui donne dans la fenetre d'approche declenchait
 * l'appel — or cette fenetre couvre les DEUX dernieres foulees. Le joueur ne
 * pouvait donc plus courir pendant deux foulees : sa premiere frappe le faisait
 * decoller trois metres trop tot, a chaque haie.
 *
 * LA CORRECTION RECONNECTE LA CADENCE A LA HAIE, et c'est ce qui manquait le
 * plus au jeu. Un appui ne devient l'appel que dans cette derniere fenetre ;
 * avant, c'est une foulee comme une autre. Or le joueur ne choisit pas ou
 * tombent ses appuis — c'est sa cadence qui en decide. LE RYTHME DOIT DONC
 * POSER UN APPUI ICI, faute de quoi on arrive sur la haie sans pied pour
 * s'appeler, et on la percute.
 *
 * C'est exactement ce qu'un entraineur demande, et ce que le jeu ne demandait
 * plus : la derniere foulee ne se choisit pas, elle se prepare.
 *
 * UN METRE DEVANT LE POINT D'APPEL. Avec APPEL_MINI, la fenetre fait 2,59 m sur
 * le 110 m haies, soit un peu plus d'une foulee de hurdleur (1,9 m) : une
 * cadence juste y pose un appui, une cadence fausse le pose a cote. Plus large,
 * la cadence cesserait de compter ; plus etroite, elle deviendrait une loterie.
 */
export const APPEL_MAXI = 1.00;

/**
 * LA FORME DES TROIS FOULEES DE L'INTERVALLE, en part de la foulee moyenne.
 *
 * Elles ne sont pas egales, et c'est enseigne. Coh (2003) les mesure chez
 * Jackson entre sa 4e et sa 5e haie : 1,51 m, puis 2,01, puis 1,98, pour une
 * moyenne de 1,83. Leurs vitesses suivent la meme courbe — 8,81 puis 9,17 puis
 * 8,53 m/s.
 *
 *   LA PREMIERE EST COURTE. On sort du vol, on doit se remettre SOUS soi. Un
 *   hurdleur qui l'allonge retombe derriere son appui et perd l'intervalle.
 *   LA DEUXIEME EST LA PLUS LONGUE. C'est la seule ou l'on court vraiment, et
 *   c'est la qu'on reprend la vitesse laissee sur la haie.
 *   LA TROISIEME SE RACCOURCIT UN PEU. On se rassemble pour poser le pied
 *   d'appel au bon endroit — « a part of the horizontal velocity of the CM
 *   transforms into the vertical velocity ».
 *
 * Le jeu faisait trois foulees presque egales (1,79 / 1,87 / 2,02). La somme
 * etait bonne, la forme absente — et c'est la forme qui fait qu'un intervalle
 * de haies ne ressemble pas a trois foulees de sprint.
 *
 * Au-dela de la troisieme, on rend 1 : le rythme est deja rompu, la forme n'a
 * plus de sens a imposer.
 */
export const FORME_INTERVALLE = [0.825, 1.098, 1.082];

/**
 * Ce que garde un coureur qui attaque de SA MAUVAISE JAMBE.
 *
 * CE QUE CETTE REGLE A ETE, ET POURQUOI ELLE A CHANGE. Elle jugeait d'abord la
 * jambe ANNONCEE : le jeu calculait le pied d'appel a l'ouverture de la
 * fenetre, l'affichait, et punissait qui pressait l'autre pave. C'etait
 * injouable, et la mesure l'a montre — obeir a l'annonce obligeait a doubler un
 * pouce quatre a neuf fois par course.
 *
 * LA CAUSE EST PROFONDE ET ON NE LA CORRIGERA PAS : UNE FRAPPE N'EST PAS UN
 * APPUI. Les pieds du coureur avancent a la DISTANCE — le moteur fait tourner
 * `stride` avec les metres — tandis que les pouces du joueur alternent dans le
 * TEMPS, a neuf frappes par seconde pour quatre appuis. Les deux horloges
 * derivent l'une par rapport a l'autre, et aucune annonce absolue ne peut donc
 * tomber sur le pouce dont c'est le tour.
 *
 * ON PREND DONC LA REGLE DU SPORT PLUTOT QUE CELLE DE LA GEOMETRIE. Un hurdleur
 * a UNE jambe d'attaque. C'est la sienne, il la garde toute sa carriere, et
 * attaquer de l'autre le rend mediocre d'un coup — c'est vrai au point que
 * beaucoup ne savent pas le faire du tout. Le jeu ne dit donc plus de quel cote
 * appeler : le pave sur lequel on appelle EST la jambe d'attaque, la premiere
 * haie fixe celle du coureur pour la course, et en changer coute.
 *
 * Ce que le compte d'appuis devait enseigner reste enseigne, et par la fonction
 * qui est faite pour : rythmeDe(). Deux regles pour la meme chose en faisaient
 * une de trop.
 */
export const GARDE_MAUVAISE_JAMBE = 0.93;

/**
 * Ce que garde un coureur qui percute la haie.
 *
 * Severe, et pas une chute. La chute avait ete retiree parce que le joueur ne
 * choisissait rien (haies-pas.js) ; maintenant il choisit, et une faute qui
 * vient de lui peut couter. Mais une haie arrive a peu pres chaque seconde :
 * une chute par haie manquee rendrait la course inracontable des la deuxieme.
 * On perd donc quatre dixiemes de sa vitesse, la haie tombe, et l'on court
 * encore — « une course perdue reste une course », comme le dit franchir().
 */
export const GARDE_PERCUTE = 0.60;

/**
 * Ce que coute CHAQUE frappe donnee pendant le vol.
 *
 * Aujourd'hui elles ne coutent rien : press() sort a la premiere ligne quand
 * le coureur est gele (sprinter-core.js), si bien qu'on peut marteler a
 * travers les dix haies sans jamais lever les pouces. C'est la deuxieme raison
 * pour laquelle le jeu se joue comme Sprinter.
 *
 * A 0,97 par frappe et neuf frappes par seconde, un vol de 0,37 s en encaisse
 * trois : le coureur se recoit a 91 % de sa vitesse. Assez pour que lever les
 * pouces se sente, pas assez pour qu'une frappe de trop ruine la course. C'est
 * ce qui donne le rythme « tap-tap-tap-HOP-silence » — celui de la musique.
 */
export const GARDE_FRAPPE_VOL = 0.97;

/** Le plancher des frappes en vol : un vol ne peut pas tout prendre. */
export const GARDE_VOL_MINI = 0.70;

/**
 * CE QUE REND UN APPEL REUSSI, en part de la vitesse — et c'est une MESURE.
 *
 * LE DEFAUT QU'ELLE CORRIGE, trouve au pouce. Rendre l'appel au joueur ne
 * rendait pas le jeu plus exigeant, il le rendait plus LENT, parce que le pouce
 * qui monte vers la touche d'attaque ne martele plus. A dix frappes par seconde
 * sur le 110 m haies, un joueur qui passait les DIX haies en « parfait »
 * bouclait en 14,12 s la ou l'appel automatique donnait 12,52. Le jeu punissait
 * le geste qu'il demandait.
 *
 * On ne corrige pas cela en baissant les penalites : elles n'y sont pour rien.
 * Ce qui manquait etait a l'endroit exact du trou, et le papier de Coh le
 * chiffre : CHEZ JACKSON, L'APPEL ACCELERE. Sa vitesse horizontale passe de
 * 8,81 m/s dans la phase d'amortissement a 9,11 dans la phase de poussee, soit
 * +3,3 %. Un hurdleur ne subit pas sa haie, il pousse dedans — « the take-off
 * leg actively placed on the ground and the shoulders aggressively pushed
 * towards the hurdle ». Le pouce qui quitte les paves ne cesse donc pas de
 * courir : il donne son appui ailleurs.
 *
 * CETTE VALEUR AVAIT ETE CALEE A L'AVEUGLE AVANT D'ETRE MESUREE, et les deux
 * se sont rejointes. Un balayage sur le seul chrono avait donne 0,50 m/s ; la
 * mesure biomecanique donne 3,3 % de 8,81, soit 0,30 m/s. On garde la mesure —
 * elle vaut mieux qu'un reglage, et elle suit la vitesse au lieu d'etre un
 * forfait.
 *
 * ELLE SE MERITE. Un appel parfait la rend entiere, un appel correct la moitie,
 * un appel plane ou hache rien, et la mauvaise jambe non plus — on ne s'arrache
 * pas du sol en enjambant des deux pieds. Viser juste cesse ainsi d'etre
 * seulement une facon d'eviter une punition pour devenir une facon de gagner du
 * temps, ce qui n'est pas la meme chose a jouer.
 */
export const POUSSEE_APPEL = { parfait: 0.033, bon: 0.017, plane: 0, hache: 0 };

/**
 * Combien d'appuis pour couvrir un intervalle, a cette longueur de foulee.
 *
 * Le calcul porte sur la partie COURUE de l'intervalle, entre la reception et
 * l'appel. Les deux sont des appuis ; ce qui les separe se couvre en foulees,
 * chacune finissant sur un appui : quatre appuis font trois foulees.
 *
 * L'ARRONDI EST AU PLUS PROCHE, et plus a l'entier superieur. Un hurdleur ne
 * pose pas le pied la ou sa foulee naturelle tomberait : il l'allonge ou la
 * raccourcit pour arriver sur son point d'appel, et c'est ce reglage que
 * l'appel note. C'est la regle que haies-pas.js applique en course ; les deux
 * doivent rester la meme, sans quoi la simulation calerait un plateau sur un
 * rythme que le jeu ne produit pas.
 */
export function appuisPour(cle, foulee) {
  const h = HAIES[cle].haies;
  const a = APPEL[cle];
  const courue = h.ecart - a.avant - a.apres;
  return 1 + Math.max(1, Math.round(courue / Math.max(0.85, foulee)));
}

/**
 * Le rythme est-il celui du reglement ?
 *
 * `troncon` : 'premiere' (du depart a l'appel de la premiere haie) ou
 * 'intervalle' (de la reception a l'appel suivant). Le compte tient s'il tombe
 * dans la fourchette d'APPUIS, bornes comprises. `ecart` dit de combien il en
 * sort : negatif trop peu d'appuis, positif trop.
 */
export function rythmeDe(cle, appuis, troncon = 'intervalle') {
  const [min, max] = APPUIS[cle][troncon];
  const tenu = appuis >= min && appuis <= max;
  const ecart = appuis < min ? appuis - min : appuis > max ? appuis - max : 0;
  return { appuis, min, max, tenu, ecart, troncon };
}

/**
 * Juger un appel : a quelle distance de la haie le dernier appui est-il tombe ?
 *
 * `avant` est la distance restante devant la haie au moment de quitter le sol.
 * Positif toujours : on n'attaque pas une haie depuis derriere.
 */
export function jugerAppel(cle, avant, v) {
  const vise = APPEL[cle].avant;
  const ecart = avant - vise;
  const e = Math.abs(ecart);
  // `v` absente : la machine vise, la tolerance reste celle du reglage, en
  // metres. `v` donnee : c'est un pouce qui a appuye, et la fenetre se mesure
  // en temps, jamais plus etroite que celle en metres (voir TOLERANCE_T).
  const seuil = k => v > 0 ? Math.max(TOLERANCE[k], TOLERANCE_T[k] * v) : TOLERANCE[k];
  if (e <= seuil('parfait')) return { note: 'parfait', garde: GARDE.parfait, ecart };
  if (e <= seuil('bon')) return { note: 'bon', garde: GARDE.bon, ecart };
  return ecart > 0
    ? { note: 'plane', garde: GARDE.plane, ecart }
    : { note: 'hache', garde: GARDE.hache, ecart };
}

/**
 * Ce que devient la vitesse au franchissement.
 *
 * Deux causes se multiplient plutot que de s'ajouter : un mauvais pied sur un
 * appel deja hache doit couter plus que la somme des deux, parce que c'est
 * exactement la haie ou l'on tombe. Le plancher evite qu'une serie noire
 * arrete le coureur net — une course perdue reste une course.
 */
export function franchir(cle, v, avant, rythmeTenu, opt = {}) {
  // `jambe` n'existe que sous l'appel du joueur : `undefined` veut dire « la
  // question ne se pose pas », et se lit donc comme une bonne jambe. Ecrire
  // `opt.jambe !== false` plutot que `opt.jambe === true` garde les deux
  // appelants d'origine (viser(), simuler()) exactement ou ils etaient.
  const bonneJambe = opt.jambe !== false;
  const j = jugerAppel(cle, avant, opt.v);
  const garde = j.garde
    * (rythmeTenu ? 1 : GARDE_RYTHME_ROMPU)
    * (bonneJambe ? 1 : GARDE_MAUVAISE_JAMBE);
  return { ...j, rythmeTenu, bonneJambe, v: Math.max(v * 0.55, v * garde) };
}

/**
 * De quelle part la foulee raccourcit quand la vitesse baisse.
 *
 * Recopie de strideLength() du moteur : meme amplitude, meme sinus, meme
 * plancher a 34 %. Deux modeles de foulee dans un meme jeu finiraient par
 * diverger, et c'est la course simulee qui aurait tort au moment de caler un
 * plateau.
 */
export function fouleeRelative(part) {
  const amp = a => Math.sin(Math.min(1.15, 0.70 * (0.34 + 0.66 * a)));
  return amp(Math.max(0, Math.min(1, part))) / amp(1);
}

/**
 * La course entiere, jouee par un coureur qui tient une vitesse donnee.
 *
 * Sert au calibrage : c'est ce qui dit si un plateau est atteignable avant
 * qu'un joueur y passe une soiree. La simulation ne remplace pas le jeu, mais
 * elle repond a la seule question qui compte ici — un coureur a 9,3 m/s
 * finit-il dans le plateau mondial ?
 *
 * `reprise` est la part de l'ecart a la vitesse nominale que le coureur
 * reprend dans l'intervalle suivant. C'est elle qui empeche une faute de
 * peser sur toute la course.
 *
 * `usure` est la part de vitesse perdue de la premiere haie a la derniere.
 * Sur le tour elle n'est pas un detail : c'est elle qui raccourcit la foulee
 * et fait monter le compte d'appuis d'un intervalle a l'autre, jusqu'a sortir
 * de la fourchette du reglement si le coureur s'effondre. Sur les courses
 * courtes elle est presque nulle — on ne fatigue pas en treize secondes.
 *
 * LE PREMIER TRONCON EST SUPPOSE TENU. Il se court en accelerant depuis les
 * blocs, ce qu'un modele a vitesse tenue ne sait pas compter. C'est le harnais
 * sur le vrai moteur (tools/haies-course-test.mjs) qui le verifie.
 */
export function simuler(cle, { vitesse, foulee, precision = 1, usure = 0, reprise = 0.55 }) {
  const positions = positionsDes(cle);
  const a = APPEL[cle];

  let v = vitesse, t = 0, d = 0, tenues = 0;
  const detail = [];

  for (let i = 0; i < positions.length; i++) {
    const haie = positions[i];

    // La foulee suit la vitesse SELON LA COURBE DU MOTEUR, et pas
    // proportionnellement. La difference n'est pas cosmetique : en
    // proportionnel, perdre 20 % de vitesse coutait 20 % de foulee, donc deux
    // appuis de plus, donc un rythme rompu, donc encore de la vitesse — un
    // tour de piste finissait a 68 secondes par emballement. La vraie courbe
    // rend 11 % de foulee pour 20 % de vitesse : on ralentit, on ne s'ecroule
    // pas.
    const f = foulee * fouleeRelative(v / vitesse);
    const appuis = i === 0 ? null : appuisPour(cle, f);
    const tenu = i === 0 ? true : rythmeDe(cle, appuis, 'intervalle').tenu;

    // L'ecart d'appel : parfait au centre, degrade quand la precision baisse.
    // Le signe alterne pour ne pas simuler un joueur qui se trompe toujours
    // dans le meme sens — ce joueur-la n'existe pas.
    const dev = (1 - precision) * TOLERANCE.bon * 2 * (i % 2 ? 1 : -1);
    const avant = a.avant + dev;

    t += (haie - avant - d) / v;
    d = haie - avant;

    const p = franchir(cle, v, avant, tenu);
    if (p.note === 'parfait' && tenu) tenues++;
    v = p.v;

    // Le vol par-dessus la haie, a la vitesse de sortie.
    t += (a.avant + a.apres) / v;
    d = haie + a.apres;

    // LA REPRISE. Sans elle, chaque haie manquee retirait de la vitesse pour
    // toujours et les pertes se multipliaient : un coureur a cinq appuis
    // perdait un cinquieme de sa vitesse sur la course entiere, et deux
    // plateaux du 110 m devenaient inatteignables — il y avait un trou de
    // deux secondes entre les Jeux mondiaux et le regional, ou aucun chrono
    // ne pouvait tomber.
    //
    // C'etait faux, et pas seulement pour le jeu : un hurdleur qui accroche
    // une haie reaccelere derriere. Ce qu'il paie, il le paie sur cet
    // intervalle-la. La faute coute donc a chaque haie, mais elle ne
    // s'installe pas.
    const nominal = vitesse * (1 - usure * (i + 1) / positions.length);
    v += (nominal - v) * reprise;

    detail.push({ haie: i + 1, appuis, note: p.note, tenu, v: +v.toFixed(2) });
  }

  const ligne = HAIES[cle].fullLap ? 400 : HAIES[cle].straight;
  t += (ligne - d) / v;
  return {
    temps: +t.toFixed(2), tenues, vFin: +v.toFixed(2),
    appuis: detail.map(x => x.appuis), detail,
  };
}
