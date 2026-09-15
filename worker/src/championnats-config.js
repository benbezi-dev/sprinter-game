/* ---------------------------------------------------------------------------
   CHAMPIONNATS — tous les nombres au meme endroit
   ---------------------------------------------------------------------------
   Ces valeurs sont des leviers d'equilibrage, pas des constantes de nature.
   Elles bougeront apres les premiers cycles : duree du titre, delais entre
   echelons, seuil d'ouverture d'un pays. Les avoir ici plutot que disperses
   dans le code est ce qui rendra ces reglages possibles sans relire le moteur.
--------------------------------------------------------------------------- */

/**
 * L'epreuve sur laquelle un championnat se court.
 *
 * Elle manquait, et son absence ne se voyait pas : une edition portait un
 * echelon, une zone et un weekend, mais aucune distance — si bien qu'on ne
 * pouvait pas dire de quoi son champion etait champion. Les chronos etaient
 * ranges dans `champ_resultats` sans qu'on sache sur quelle distance les lire.
 *
 * Le 100 m par defaut, et une seule epreuve par edition.
 *
 * Attention a ce que cette colonne ne dit PAS : elle n'ouvre pas trois
 * championnats en parallele. La regle « une zone ne tient qu'un championnat a
 * la fois » (voir `ouvrirEchelon`) est inchangee, et elle est volontaire. La
 * lever demanderait de decider si « champion de France » sans autre precision
 * veut encore dire quelque chose quand il y en a trois — et, plus
 * prosaiquement, trois grilles de trente-deux partants tirees du meme pays.
 * Cette colonne dit seulement sur quelle distance se court l'edition en cours,
 * ce que personne ne savait jusqu'ici.
 */
export const EPREUVES = ['100', '200', '400'];
export const EPREUVE_DEFAUT = '100';

/** Le format d'une competition : combien on part, comment on se qualifie. */
export const FORMAT = {
  // 32 partants, quatre series de huit, deux demies de huit, une finale.
  partants: 32,
  phases: [
    {
      cle: 'series', nom: 'Séries',
      courses: 4, parCourse: 8,
      // Les deux premiers de chaque course passent, puis on repeche au chrono.
      directsParCourse: 2,
      repechages: 8,
    },
    {
      cle: 'demies', nom: 'Demi-finales',
      courses: 2, parCourse: 8,
      directsParCourse: 2,
      repechages: 4,
    },
    {
      cle: 'finale', nom: 'Finale',
      courses: 1, parCourse: 8,
      directsParCourse: 0,     // la finale ne qualifie pour rien
      repechages: 0,
      podium: 3,
    },
  ],
};

/** Les trois echelons, et ce qui remplit leur grille de depart. */
export const ECHELONS = {
  national: {
    // « Championnat de France », et non « Championnat national de France ».
    //
    // Le nom se compose avec la zone accordee (`nomZone().avec`), si bien que
    // le mot « national » venait s'intercaler dans une phrase qui le disait
    // deja : nommer le pays suffit a dire de quel echelon il s'agit. On le
    // retire ici plutot qu'aux quatre endroits qui composent le titre, pour
    // que les quatre continuent de dire la meme chose.
    cle: 'national', nom: 'Championnat',
    // Un pays doit avoir au moins ce nombre de joueurs classes et actifs pour
    // tenir son propre championnat. En dessous, voir `replis`.
    minJoueurs: 32,
    // « Actif » veut dire : au moins un duel classe dans cette fenetre.
    fenetreActiviteJours: 60,
    titre: 'Champion de {zone}',
  },
  continental: {
    cle: 'continental', nom: 'Championnat continental',
    // Chaque champion national du continent est qualifie d'office ; on complete
    // jusqu'a 32 par les mieux classes du continent au classement des duels.
    qualifiesDOffice: 'champions_nationaux',
    complementPar: 'classement_continental',
    semainesApresPrecedent: 3,
    titre: 'Champion d’{zone}',
  },
  mondial: {
    cle: 'mondial', nom: 'Championnat du monde',
    qualifiesDOffice: 'champions_continentaux',
    complementPar: 'classement_mondial',
    semainesApresPrecedent: 4,
    titre: 'Champion du monde',
  },
};

/**
 * Ce qu'on exige d'un pool de qualification avant d'ouvrir une edition.
 *
 * Un continental a besoin de champions nationaux pour exister : ouvrir un
 * continental sans aucun champion sacre produirait une competition qui porte
 * le nom d'un continent et n'en represente rien. On demande donc un minimum de
 * qualifies d'office, faute de quoi l'edition attend le cycle suivant.
 */
export const MIN_DOFFICE = { continental: 2, mondial: 2 };

/**
 * LE CHAMPION EN TITRE — ce que porter un titre donne dans l'edition suivante.
 *
 * Un titre ne servait a rien. Il se gagnait, il s'affichait trois mois, et le
 * championnat suivant repartait comme si personne ne l'avait remporte : le
 * champion de France reprenait sa place au classement des duels, exactement
 * comme le trente-deuxieme. Ces quatre leviers font du titre un statut avec
 * des consequences — et, ce qui compte autant, avec un statut a defendre.
 *
 * L'ETANCHEITE EST LA REGLE QUI PORTE TOUTES LES AUTRES. Les privileges ci-
 * dessous ne valent que pour le titre EXACTEMENT remporte, c'est-a-dire pour le
 * couple (echelon, zone). Le champion de France arrive au continental sans
 * aucun d'eux, et le champion de France arrive au championnat d'Espagne sans
 * aucun d'eux non plus — le second cas est celui qu'un test qui ne regarde que
 * l'echelon laisserait passer, puisque les deux editions y sont 'national'.
 *
 * Ce que ces leviers ne touchent PAS : la qualification d'office des champions
 * NATIONAUX vers le continental, et des champions CONTINENTAUX vers le mondial
 * (`ECHELONS[…].qualifiesDOffice`, lue par `pool`). Celle-la est une regle
 * d'entree qui existait avant, et sans elle aucun continental ne peut s'ouvrir
 * — `MIN_DOFFICE` refuse d'en ouvrir un sans deux champions nationaux sacres.
 * Elle donne une place sur la grille de depart ; elle ne donne ni la finale ni
 * la cinematique, qui restent etanches.
 */
export const TENANT = {
  /**
   * Le tenant est en finale, quoi qu'il fasse de son weekend.
   *
   * Il court quand meme ses series et ses demies — c'est le choix qui garde la
   * grille a trente-deux et le tenant a l'ecran les deux jours. Un bye complet
   * l'aurait fait disparaitre jusqu'au dimanche soir, ce qui est exactement le
   * contraire de ce qu'on cherche : on veut qu'il soit la, visible, et qu'on
   * compte les centiemes qui separent chacun de lui.
   *
   * Ce qui change, c'est qu'aucun resultat ne l'elimine. Ses chronos comptent
   * pour le classement de sa course et pour le spectacle, jamais pour sa
   * survie.
   */
  finaleDOffice: true,

  /**
   * Ce que le passe-droit coute, et a qui.
   *
   * La finale a huit couloirs, et quatre qualifies directs plus quatre
   * repeches la remplissent exactement. Verser un tenant dedans prend donc une
   * place a quelqu'un ; la seule question est laquelle.
   *
   * On la prend au repechage, jamais a une qualification directe. Un premier
   * de demi-finale a gagne sa course devant tout le monde : lui retirer sa
   * place parce qu'un absent de sa course porte un titre serait la seule chose
   * qu'un spectateur ne pardonnerait pas. Le repechage, lui, est la porte
   * douce — celle qu'on franchit sans avoir battu personne.
   *
   * UN, et pas autre chose : c'est la conservation des couloirs. Un tenant
   * verse d'office occupe un couloir, donc un couloir de moins s'ouvre au
   * chrono. Changer ce nombre ne change pas une regle, cela casse le compte —
   * la valeur est ici pour etre lue, pas pour etre reglee.
   */
  repechagesCedes: 1,

  /**
   * Le titre ouvre aussi la grille de depart de son propre echelon.
   *
   * Sans cela, `finaleDOffice` se fait annuler par le calendrier : un champion
   * qui joue peu sort du classement des duels, n'est pas selectionne, et son
   * privilege de finale ne s'applique a rien. Le titre donne donc la 32e place
   * — les trente-et-une autres restant au classement.
   */
  entreeDOffice: true,

  /**
   * L'exception, et c'est elle qui empeche un titre de devenir une rente.
   *
   * Le tenant doit avoir joue au moins un duel classe DEPUIS SON SACRE. S'il
   * n'a plus rien joue depuis qu'il a gagne, il n'a ni entree d'office, ni
   * finale d'office, ni cinematique : il redevient un joueur comme les autres
   * et repasse par le classement.
   *
   * La mesure se prend a la CLOTURE, c'est-a-dire a J-3 du premier depart
   * (`CLOTURE_JOURS_AVANT`). Ce n'est pas un choix d'implementation : c'est le
   * seul instant ou la question a une reponse stable. Apres la cloture la
   * grille ne bouge plus, et un tenant qui rejouerait le samedi matin ne peut
   * pas entrer dans une competition dont les couloirs sont attribues.
   */
  actifDepuisLeSacre: true,

  /**
   * La cinematique d'entree en lice du tenant.
   *
   * Le nom est publie tel quel au client, qui decide de la mise en scene : le
   * serveur dit QUI est le boss et QUAND, jamais comment on le montre. C'est la
   * meme frontiere que partout ailleurs ici — le format est une regle de
   * competition, la mise en scene n'en est pas une.
   */
  cinematique: 'boss',
};

/**
 * Combien de temps un titre se porte.
 *
 * Trois mois : assez long pour que le titre vaille quelque chose et que son
 * porteur soit identifiable une vraie saison, assez court pour que les
 * pretendants aient une echeance reguliere et que le classement des duels
 * reste vivant entre deux sacres. Quatre championnats nationaux par an.
 */
export const TITRE_MOIS = 3;

/**
 * Ce qu'on fait d'un pays qui n'a pas assez de joueurs.
 *
 * 'attendre' est le repli par defaut : le pays ne tient pas de championnat ce
 * cycle-ci, et ses joueurs restent eligibles au repechage continental. C'est
 * moins brutal qu'une exclusion definitive et plus simple qu'un regroupement
 * regional, qui demanderait de decider quels pays vont ensemble.
 */
export const REPLI_PAYS_TROP_PETIT = 'attendre';

/**
 * Combien de jours separent la cloture de la selection du premier depart.
 *
 * Trois jours : la selection ferme le mercredi soir, les series partent le
 * samedi matin. Ce delai n'est pas du confort d'exploitation, c'est ce qui
 * rend la selection juste.
 *
 * Une selection arretee le jour meme semble plus juste — « les trente-deux
 * meilleurs le jour de la course » — et l'est moins : un joueur ne peut alors
 * savoir s'il est pris qu'au moment ou il est trop tard pour y changer quoi
 * que ce soit. Un decompte vers une echeance sur laquelle on peut encore agir
 * est une pression ; un decompte vers un resultat deja ecrit est une attente.
 *
 * Ces trois jours achetent aussi la seule chose qu'une grille gelee permet :
 * l'annoncer. « Tu y es, serie 3, couloir 5 » ne peut se dire que si la grille
 * existe avant le coup de pistolet.
 */
export const CLOTURE_JOURS_AVANT = 3;

/**
 * Combien de suivants on garde en memoire au moment de la cloture.
 *
 * Les trente-deux retenus sont dans `champ_partants`. Ceux-la sont ceux
 * d'apres, et ils ne courront pas : on les garde pour pouvoir repondre. « Je
 * n'etais pas 33e » est une phrase qui sera prononcee, et une selection qu'on
 * ne peut pas relire sera contestee — avoir eu raison ne suffit pas si l'on ne
 * peut pas le montrer.
 */
export const SUIVANTS_GARDES = 8;

/**
 * Departage des joueurs a egalite pour la derniere place qualificative.
 *
 * `DEPARTAGE`, plus bas, tranche deux chronos identiques a l'arrivee. Celui-ci
 * tranche deux joueurs identiques au depart, ce qui n'est pas la meme question
 * et arrivera bien plus souvent : deux joueurs de la meme division au meme
 * nombre de points de ligue, c'est un cas ordinaire, pas une coincidence.
 *
 * Le MMR y figure comme departage et non comme critere : il tranche une
 * egalite sans jamais decider d'un rang. C'est ce qui permet de continuer a ne
 * pas le montrer — on n'a pas a publier un nombre qui ne fait que separer deux
 * joueurs que le classement visible declare a egalite.
 */
export const DEPARTAGE_SELECTION = ['palier', 'lp', 'mmr', 'victoires', 'nom'];

/**
 * Le calendrier d'un weekend, en minutes depuis minuit UTC.
 *
 * Tout est en UTC parce que « le meme weekend, partout » n'a de sens que sur
 * une horloge commune : c'est l'heure d'affichage qui se traduit chez le
 * joueur, pas l'heure de la course. Le samedi porte les series, le dimanche
 * les demies et la finale.
 *
 * Les espacements ne sont pas decoratifs : une heure et demie entre deux
 * series laisse le temps aux resumes, et surtout empeche de tout consommer
 * d'un coup. Les huit repeches ne sont reveles qu'apres la derniere serie —
 * c'est le seul moment de la competition ou le suspense est fabrique plutot
 * que couru.
 */
export const CALENDRIER = {
  jour1: [
    { cle: 'serie-1',      phase: 'series', course: 1, minute: 9 * 60 },
    { cle: 'serie-2',      phase: 'series', course: 2, minute: 10 * 60 + 30 },
    { cle: 'serie-3',      phase: 'series', course: 3, minute: 14 * 60 },
    { cle: 'serie-4',      phase: 'series', course: 4, minute: 15 * 60 + 30 },
    { cle: 'reveal-demies', phase: 'series', reveal: true, minute: 19 * 60 },
  ],
  jour2: [
    { cle: 'demie-1',      phase: 'demies', course: 1, minute: 10 * 60 + 30 },
    { cle: 'demie-2',      phase: 'demies', course: 2, minute: 13 * 60 + 30 },
    { cle: 'reveal-finale', phase: 'demies', reveal: true, minute: 14 * 60 + 30 },
    { cle: 'finale',       phase: 'finale', course: 1, minute: 19 * 60 },
    { cle: 'sacre',        phase: 'finale', ceremonie: true, minute: 19 * 60 + 20 },
  ],
};

/**
 * Les moments qui meritent de sortir une notification.
 *
 * `annonce` ouvre la liste parce qu'elle ouvre la competition : c'est le seul
 * moment ou l'on parle a tout un pays, dont les joueurs qui ne seront pas
 * selectionnes — et ce sont eux qu'on cherche a faire jouer. Les autres
 * s'adressent a trente-deux personnes.
 *
 * `annulation` n'y est pas, volontairement. Faire vibrer tout un pays pour lui
 * dire qu'il n'aura pas de championnat coute une desinstallation et ne rapporte
 * rien ; l'information reste lisible dans le fil, ou ceux qui suivaient
 * l'edition la trouveront.
 */
export const ANNONCES = new Set([
  'annonce', 'ouverture', 'boss', 'serie-depart', 'qualification-directe',
  'reveal-demies', 'demie-depart', 'reveal-finale', 'finale-depart', 'sacre',
]);

/**
 * Departage de deux chronos rigoureusement egaux.
 *
 * Sur des millisemes l'egalite est rare mais pas impossible, et un classement
 * qui depend de l'ordre d'insertion en base serait arbitraire sans le dire.
 * On tranche donc explicitement, dans cet ordre :
 *   1. le meilleur chrono de la phase precedente (celui qui arrive de plus loin) ;
 *   2. le meilleur rang au classement des duels a la cloture ;
 *   3. la cle du joueur, pour que le resultat soit au moins reproductible.
 */
export const DEPARTAGE = ['chrono_precedent', 'rang_duel', 'cle'];
