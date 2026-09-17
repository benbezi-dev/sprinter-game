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
  '110h': { avant: 2.15, apres: 1.40 },
  '400h': { avant: 2.15, apres: 1.20 },
};

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

/** Combien de temps le coureur reste en l'air, a cette vitesse. */
export function volDe(cle, v) {
  const c = COUT[cle];
  if (c.vol === 'duree') return c.duree;
  return (APPEL[cle].avant + APPEL[cle].apres) / Math.max(VITESSE_VOL_MIN, v);
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
 * Ce que garde un coureur qui attaque de la mauvaise jambe.
 *
 * Un peu moins qu'un rythme rompu (0,94), et pour une raison physique : un
 * rythme casse, on le passe quand meme ; la mauvaise jambe devant, on ne
 * ciseaute pas du tout — on enjambe des deux pieds.
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
 * CE QUE REND UN APPEL REUSSI, en m/s — et c'est le correctif le plus
 * important de tout le prototype.
 *
 * LE DEFAUT, mesure a l'ecran puis au harnais. Rendre l'appel au joueur ne
 * rendait pas le jeu plus exigeant, il le rendait plus LENT, et pour une
 * raison qui n'avait rien a voir avec les haies : le pouce qui monte vers la
 * touche d'attaque est un pouce qui ne martele plus. Deux frappes perdues par
 * haie, dix haies. A dix frappes par seconde sur le 110 m haies, un joueur qui
 * passait les DIX haies en « parfait » bouclait en 14,12 s la ou l'appel
 * automatique donnait 12,52 — une seconde et demie payee pour avoir bien joue.
 * Le jeu punissait le geste qu'il demandait.
 *
 * On ne corrige pas cela en baissant les penalites : elles n'y sont pour rien.
 * Ce qui manquait etait a l'endroit exact du trou. UN HURDLEUR POUSSE A
 * L'APPEL — c'est la foulee la plus puissante de l'intervalle, celle qui
 * l'arrache du sol. Le pouce qui quitte les paves ne cesse donc pas de courir :
 * il donne son appui ailleurs.
 *
 * ELLE SE MERITE, et c'est ce qui la rend interessante. Un appel parfait rend
 * la poussee entiere, un appel correct en rend la moitie, un appel plane ou
 * hache ne rend rien, et la mauvaise jambe non plus — on ne s'arrache pas du
 * sol en enjambant des deux pieds. Viser juste cesse ainsi d'etre seulement
 * une facon d'eviter une punition pour devenir une facon de gagner du temps,
 * ce qui n'est pas la meme chose a jouer.
 *
 * LA VALEUR EST CALEE, PAS CHOISIE, et le calage tient en une phrase : rendre
 * l'appel au joueur ne doit changer ni le bareme ni les plateaux. Ils ont ete
 * cales sur l'appel automatique (haies.js) apres beaucoup de mesures, et une
 * commande qui change n'est pas une raison de les refaire.
 *
 * On a donc balaye la poussee et garde celle qui rapproche le plus le chrono
 * d'un joueur — dix haies parfaites, voyage de pouce de 160 ms — de celui que
 * l'appel automatique donnait a la meme cadence, sur les TROIS courses et de
 * huit a douze frappes par seconde :
 *
 *     poussee   0     0,50   0,70   0,90   1,10   1,30
 *     ecart max 1,87  0,70   0,95   1,05   1,91   3,21   (secondes)
 *
 * 0,50 double donc la precision de tout le reste du balayage. Au-dela, la
 * poussee cesse d'etre une compensation et devient le levier principal : a
 * 1,30 un joueur a huit frappes par seconde gagnait trois secondes sur la
 * machine, et la cadence — qui est le coeur de Sprinter — ne comptait plus.
 *
 * Verrouille par tools/haies-appel-test.mjs, qui refait la mesure.
 */
export const POUSSEE_APPEL = { parfait: 0.50, bon: 0.25, plane: 0, hache: 0 };

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
