/* -----------------------------------------------------------------------
   SPRINTER — noyau commun (aucune dependance au navigateur)

   Constantes, cycle de foulee, geometrie de piste, physique et donnees des
   athletes. Ce fichier ne touche ni au DOM ni au canvas : il peut donc etre
   charge tel quel dans une page ou dans Node pour etre teste.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;

  /* -----------------------------------------------------------------------
     LE TIRAGE, ET QUAND IL CESSE D'ETRE UN HASARD

     Trois choses etaient tirees au sort a chaque course : le temps vise par
     chaque adversaire, la phase de sa foulee, et le risque de chute quand le
     joueur repete la meme touche. Trois `Math.random()`, et c'est tres bien
     pour une course ordinaire — le plateau change, la course respire.

     Pour un DEFI, c'est exactement ce qu'il ne faut pas. Deux joueurs qui
     courent « le defi du midi » n'ont alors couru ni la meme piste ni contre
     les memes adversaires : comparer leurs chronos ne compare rien, et le
     classement du defi devient une loterie ou l'on peut tomber sur un plateau
     lent. On seme donc le tirage avec la graine du defi, la meme pour tout le
     monde ce jour-la, et le terrain devient identique.

     `semer()` prend la main, `desemer()` la rend. Hors defi, `alea()` EST
     `Math.random` — pas une reimplementation qui lui ressemble : le jeu
     ordinaire ne doit rien changer du tout.

     L'algorithme est mulberry32 : trente-deux bits d'etat, une multiplication
     et trois decalages. Il ne vaut rien en cryptographie et ce n'est pas ce
     qu'on lui demande — il faut qu'il rende la meme suite partout, ce que
     `Math.random` ne garantit precisement pas d'un navigateur a l'autre.
     ----------------------------------------------------------------------- */

  let etatAlea = null;

  /** Le tirage courant : seme si un defi est en cours, sinon celui du systeme. */
  function alea() {
    if (etatAlea === null) return Math.random();
    // mulberry32
    etatAlea = (etatAlea + 0x6D2B79F5) >>> 0;
    let t = etatAlea;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Fixe le tirage. Deux courses semees pareil se ressemblent trait pour trait. */
  function semer(graine) {
    etatAlea = (Number(graine) >>> 0);
  }

  /** Rend la main au hasard du systeme. A appeler EN SORTANT du defi : une
   *  graine oubliee ferait rejouer la meme course a l'infini. */
  function desemer() {
    etatAlea = null;
  }

  /** Le tirage est-il seme en ce moment ? Sert au jeu pour le dire a l'ecran. */
  function estSeme() {
    return etatAlea !== null;
  }

  const C = {
    // --- projection isometrique 2:1 -----------------------------------
    ISO_COS: 2 / Math.sqrt(5),
    ISO_SIN: 1 / Math.sqrt(5),

    // --- physique ------------------------------------------------------
    // vitesse moyenne tenue = BOOST * cadence / DRAG, plafonnee
    BOOST: 1.05,
    DRAG: 0.80,
    STUMBLE_BASE: 0.48,
    STUMBLE_SPEED: 0.42,
    STUMBLE_KEEP: 0.20,
    STUMBLE_TIME: 0.62,
    // Au doigt on n'a ni le relief des touches ni leur precision : le pouce
    // part legerement a cote, se pose deux fois, ou arrive en retard. La
    // meme rigueur qu'au clavier se paie donc bien plus cher sur telephone.
    // On attenue le risque de chute quand on joue au toucher. 1 = clavier.
    STUMBLE_INPUT_SCALE: 1,
    STUMBLE_TOUCH_SCALE: 0.55,
    // iOS perd nettement plus d'appuis qu'Android a cadence de course. La
    // cause n'a pas pu etre isolee — un appui physique y produit pourtant
    // bien un evenement et un seul — mais l'ecart de chutes entre les deux
    // plateformes est net. Compensation assumee, a retirer le jour ou la
    // cause reelle sera trouvee.
    STUMBLE_IOS_SCALE: 0.35,
    // Duree de l'ANIMATION de chute, volontairement plus longue que la
    // penalite de vitesse (STUMBLE_TIME) : le coureur a le temps de
    // partir de travers, mouliner des bras et se retablir en titubant,
    // sans pour autant etre penalise plus longtemps qu'avant.
    FALL_TIME: 1.15,

    // --- depart : mise en action, transition, vitesse maximale ----------
    // Un sprinteur sort des blocs corps tres incline, pousse en foulees
    // courtes et frequentes, puis se redresse progressivement. Le
    // redressement s'acheve vers quarante metres, quand la vitesse maximale
    // est atteinte.
    DRIVE_END: 15.0,          // fin de la phase de poussee, en metres
    TRANS_END: 40.0,          // corps entierement redresse
    DRIVE_PITCH: 0.62,        // inclinaison du corps a la sortie des blocs
    // LA MECANIQUE DE DEPART, et pourquoi elle ne peut pas venir de la vitesse.
    //
    // L'amplitude des membres suit `A`, qui suit la vitesse : 0,34 a l'arret,
    // 1 a pleine vitesse. C'est juste en course — un coureur qui ralentit leve
    // moins haut — et c'est FAUX a la sortie des blocs, ou la vitesse est
    // presque nulle et la mecanique a son maximum. Le jeu jouait donc
    // exactement l'inverse de ce qu'on voit sur une piste : trois petits pas
    // timides, la ou un sprinteur projette son genou le plus loin devant de
    // toute sa course.
    //
    // Ces trois nombres RENDENT l'amplitude pendant la sortie, et un peu plus
    // que la pleine course : cuisse a 1,14 au premier appui contre 1,00 lance,
    // genou a 1,07, bras a 1,05. Ils s'eteignent sur la meme courbe que
    // l'inclinaison du buste (pitchAt, jusqu'a TRANS_END) — c'est la meme
    // phase, et elle doit se lire dans la jambe comme elle se lit dans le dos.
    DRIVE_THIGH: 0.80,        // amplitude de cuisse rendue a la sortie
    DRIVE_KNEE: 0.45,         // flexion de genou, idem
    DRIVE_ARM: 0.35,          // amplitude des bras, idem
    // temps de reaction : 0,100 s est le plancher legal, l'elite tourne
    // autour de 0,13 s, au-dela de 0,30 s il n'y a plus rien a gagner
    REACT_BEST: 0.12,
    REACT_WINDOW: 0.32,
    REACT_BONUS: 1.35,        // m/s offerts sur une reaction parfaite
    FALSE_START_FREEZE: 0.28, // blocage si on part avant le signal
    // Transition : la cadence doit monter pendant la poussee. On compare les
    // MEDIANES des deux moities de la phase, pas trois appuis contre trois.
    //
    // Mesure a l'appui : avec trois contre trois, vingt millisecondes d'ecart
    // sur le depart faisaient passer la reussite de 227/300 a 39/300 — le
    // bruit du doigt decidait a la place du joueur. Sur les medianes de
    // moities, taper a fond plafonne a 1,082 et la moindre montee demarre a
    // 1,094 : la separation est franche, la note cesse d'etre un pile ou face.
    TRANS_GOOD: 1.09,
    TRANS_PERFECT: 1.20,
    // Plancher de cadence sur la seconde moitie. Sans lui, le chemin le plus
    // facile vers la note parfaite etait de trainer expres sur les premiers
    // appuis — ratio 3,76, le double d'une vraie montee en puissance.
    // --- relais : la zone de lancement et le passage de temoin ----------
    // Le receveur ne part pas arrete : il dispose de 30 metres pour se lancer,
    // et le temoin change de main quelque part dans cette zone. C'est ce qui
    // rend un relais plus rapide que quatre 100 m mis bout a bout — un depart
    // arrete coute 1,11 s, mesure sur cette physique.
    RELAY_LAUNCH: 30.0,
    // Le passage se joue a deux : le donneur et le receveur touchent au meme
    // instant. L'ecart entre les deux touches, mesure sur l'horloge commune de
    // la salle, donne la note. Les fenetres tiennent compte de ce que la
    // synchronisation d'horloge laisse d'incertitude — moins de 15 ms mesures
    // sur l'infrastructure reelle — et de la variabilite humaine, qui est
    // l'ordre de grandeur dominant.
    RELAY_SYNC_PERFECT: 0.070,
    RELAY_SYNC_GOOD: 0.180,
    // Effets, dans l'ordre rate / bon / parfait.
    //
    // Ils portent A LA FOIS sur le plafond de vitesse et sur le freinage, et
    // pour toute la duree du relais. C'est la mesure qui l'impose : la vitesse
    // tenue vaut BOOST / (1 - exp(-DRAG x cadence)), plafonnee par maxSpeed.
    // Un joueur a cadence lente est limite par le freinage et ne sent pas le
    // plafond ; un joueur rapide tape dans le plafond et ne sent pas le
    // freinage. N'agir que sur l'un des deux ne toucherait que la moitie des
    // joueurs. Agir seulement au moment de la passe ne toucherait personne :
    // sur 100 m le coureur reaccelere, et toute correction ponctuelle se
    // dissout — c'est la raison pour laquelle l'effet dure.
    RELAY_PASS_VMAX: [0.940, 1.000, 1.045],
    RELAY_PASS_DRAG: [1.080, 1.000, 0.930],
    RELAY_PASS_BOOST: [0, 0.20, 0.45],
    RELAY_PASS_KEEP: [0.60, 1.00, 1.00],   // part de la vitesse de lancement gardee
    RELAY_PASS_FREEZE: [0.15, 0, 0],       // le temoin echappe des mains
    // Le lieu du passage ne se negocie pas : hors de la zone, avant la zone,
    // ou temoin lache — l'equipe est eliminee. Il n'y a donc pas de bareme
    // pour un passage mal place, seulement pour un passage mal synchronise.
    // C'est la regle de l'athletisme, et elle change la nature du mode : on
    // n'y perd pas des secondes, on y perd la course.
    // L'effet couvre tout le relais : au-dela de la duree d'une portion, la
    // valeur exacte n'a plus d'importance.
    RELAY_EFFECT_TIME: 30.0,

    TRANS_FLOOR: 0.125,
    TRANS_MIN_PRESS: 8,
    TRANS_BOOST: [0, 0.26, 0.55],   // impulsion immediate, selon la note
    TRANS_DRAG: [1.0, 0.88, 0.78],  // freinage allege pendant TRANS_TIME
    TRANS_TIME: [0, 2.2, 3.0],
    // Une transition reussie ne donne pas seulement un coup d'accelerateur :
    // elle fixe la vitesse maximale tenue jusqu'a l'arrivee. C'est la que se
    // joue l'essentiel du gain, de l'ordre du dixieme de seconde.
    //
    // Releve juste assez pour que jouer la transition rapporte vraiment :
    // avec l'imprecision reelle du doigt, l'ancienne valeur la rendait
    // legerement perdante (-0,025 s), donc decorative.
    TRANS_VMAX: [1.0, 1.018, 1.042],

    // --- morphologie ---------------------------------------------------
    MODEL_H: 1.72,
    MIN_H: 1.60,
    MAX_H: 2.00,

    // --- piste ----------------------------------------------------------
    // Cotes officielles World Athletics, piste standard de 400 m. Le detail
    // et les sources sont dans docs/piste-athletisme.md.
    LANE_W: 1.22,
    LANE_COUNT: 8,
    // La corde : le bord interieur de la piste, la ou se pose la bordure.
    // Ce n'est PAS la ligne sur laquelle on mesure les 400 m — celle-la
    // passe trente centimetres plus loin, et c'est elle qui vaut 400,00 m
    // (2 x 84,39 + 2 pi x 36,80 = 400,00).
    R1: 36.50,
    // Ligne de mesure. Trente centimetres de la corde au couloir 1, parce
    // qu'une bordure physique ecarte le coureur ; vingt centimetres de la
    // ligne peinte pour les autres couloirs, ou il n'y a rien a eviter.
    // C'est la trajectoire qu'un coureur suit reellement, donc celle que
    // l'on fait suivre a nos coureurs.
    MES_1: 0.30,
    MES_N: 0.20,
    RUNOUT: 26.0
  };

  // Trois epreuves. Le 100 m est le cas particulier sans virage ; le 400 m
  // est un tour complet de piste (deux virages, deux lignes droites).
  const RACES = {
    '100': {
      key: '100', label: '100 METRES', sub: 'la ligne droite',
      arc: 0, straight: 100, maxSpeed: 12.435, best: 9.10,
      // Le dernier rang est la finale ZEZE. Il ne se lit pas comme les
      // autres : c'est le seul ou l'adversaire court plus vite que le joueur
      // ne peut le faire en tapant a dix appuis par seconde. Mesure sur cette
      // physique, avec une alternance parfaite et sans faux pas : 10,25 s a
      // huit appuis par seconde, 9,22 s a dix, 8,87 s a treize, 8,61 s a
      // dix-sept. Battre le meilleur ZEZE demande donc d'y tenir treize a
      // quatorze appuis, ce qui est le geste d'un joueur qui s'entraine.
      ranges: [[12.50, 15.00], [11.20, 12.50], [10.00, 10.50],
               [9.58, 10.00], [9.58, 9.85], [8.75, 9.00]]
    },
    '200': {
      key: '200', label: '200 METRES', sub: 'virage et ligne droite',
      arc: 115.61, straight: 84.39, maxSpeed: 12.021, best: 18.20,
      // Meme mesure sur le tour partiel : 19,47 s a huit appuis par seconde,
      // 18,13 s a dix, 17,74 s a treize. Le meilleur ZEZE passe donc d'un
      // cheveu sous ce que treize appuis donnent.
      ranges: [[25.00, 30.00], [22.40, 25.00], [20.00, 21.00],
               [19.16, 20.00], [19.16, 19.70], [17.75, 18.00]]
    },
    // Le relais emprunte la geometrie du 400 m — un tour de piste — mais se
    // court en quatre portions de cent metres. La vitesse de pointe est celle
    // du 100 m : un relayeur sprinte, il ne gere pas un tour.
    '4x100': {
      key: '4x100', label: '4 x 100 METRES', sub: 'le relais',
      fullLap: true, relay: true, legs: 4, legLength: 100,
      arc: 115.61, straight: 84.39, maxSpeed: 12.435, best: 36.84,
      ranges: [[50.00, 60.00], [45.00, 50.00], [40.00, 44.00],
               [38.00, 40.00], [37.20, 38.00], [36.84, 37.60]]
    },
    '400': {
      key: '400', label: '400 METRES', sub: 'un tour de piste', fullLap: true,
      arc: 115.61, straight: 84.39, maxSpeed: 11.536, best: 36.90,
      // Le tour complet pardonne davantage : 37,92 s a huit appuis par
      // seconde, 36,88 s a dix, 36,37 s a treize. Le meilleur ZEZE reste
      // devant un joueur a dix appuis, et derriere un joueur a treize.
      ranges: [[55.00, 60.00], [49.00, 55.00], [44.50, 49.00],
               [43.50, 44.50], [43.18, 43.50], [36.70, 37.00]]
    }
  };

  // pool : carnation du plateau. 'divers' pour les etapes locales,
  // 'sprint' pour le mondial, les Jeux mondiaux et la finale ZEZE.
  // CHAQUE ETAPE GARDE SON STADE.
  //
  // Les quatre premieres sont passees un temps sur `mondiaux`, le stade du
  // one shot, pour que la carriere ne commence pas dans le decor le plus
  // pauvre. Le resultat n'etait pas celui qu'on cherchait : cinq etapes sur
  // six dans le meme stade bleu, et la traversee du championnat ne racontait
  // plus rien. On revient donc a l'echelle d'origine — la qualite d'un stade
  // se travaille dans son theme, pas en les remplacant les uns par les
  // autres.
  const LEVELS = [
    { name: 'Competition scolaire', theme: 'day', pool: 'divers',
      names: ['Paul Martin', 'Leo Dubois', 'Noah Petit', 'Enzo Roy',
              'Nathan Blanc', 'Lina Fontaine', 'Rayan Girard'] },
    { name: 'Niveau regional', theme: 'day', pool: 'divers',
      names: ['Karim Faure', 'Yanis Perrin', 'Bilal Moreau', 'Malik Simon',
              'Idris Laurent', 'Ana Ferreira', 'Souleymane Garcia'] },
    { name: 'Niveau national', theme: 'day', pool: 'divers',
      names: ['Vince Rapido', 'Max Eclair', 'Eddie Foudre', 'Timo Flash',
              'Ken Turbo', 'Dan Sonic', 'Lea Comet'] },
    { name: 'Championnat du monde', theme: 'day', pool: 'sprint',
      names: ['Erik Rocket', 'Ivan Blitz', 'Otto Rush', 'Sven Dash',
              'Lars Zoom', 'Nils Storm', 'Freya Comet'] },
    // « 0.Games » : le nom de l'etape, dans les deux langues. Il ne traduit
    // rien et ne se traduit pas — c'est un nom propre, pose la ou le terme
    // olympique ne peut pas l'etre (article L141-5 du code du sport, voir
    // juridique/lettre-scellee.html annexe E). La cle du theme reste
    // `mondiaux` : elle est interne au moteur et ne s'affiche nulle part.
    { name: '0.Games', theme: 'mondiaux', pool: 'sprint',
      names: ['Blaze Kade', 'Jett Cruz', 'Rex Solar', 'Kai Volt',
              'Ash Comet', 'Neo Flash', 'Ray Quick'] },
    { name: 'Inter galactique', theme: 'cosmos', pool: 'sprint',
      names: ['Benbezi ZEZE', 'Ryan ZEZE', 'Mickeal ZEZE', 'Greta ZEZE',
              'Herman ZEZE', 'Ervie ZEZE', 'Victoire ZEZE'] }
  ];

  // ------------------------------------------------------- stades hors serie
  //
  // Un stade qui n'est pas une etape du championnat. La difference n'est pas
  // cosmetique : les six etapes ci-dessus forment une echelle — on monte de la
  // cour d'ecole a l'intergalactique — et y accrocher un septieme barreau
  // reviendrait a dire que la finale ZEZE n'est plus la fin. Celui-ci est un
  // LIEU, qu'on choisit pour y courir une epreuve, et le championnat l'ignore.
  //
  // Il porte donc son plateau avec lui, au lieu d'ajouter une septieme entree
  // aux `ranges` de chaque epreuve : ces tableaux-la sont alignes sur les six
  // etapes, et une entree de plus y ferait croire a une etape de plus.
  //
  // La Riviera est un meeting d'ete au bord de l'eau : le plateau est fort,
  // d'un cheveu sous la finale olympique, mais on n'y elimine personne.
  const STADES_HORS_SERIE = [
    // LE STADE DU DANUBE — l'edition speciale, ouverte a tout le monde.
    //
    // Elle sort pendant qu'une grande reunion d'athletisme se court pour de
    // vrai au bord de ce fleuve. Ce stade-ci en prend les COULEURS, et rien
    // d'autre : la piste terre cuite, le liseret d'ocre qui l'entoure, la
    // couronne d'acier blanc posee au-dessus des gradins, et le
    // rouge-blanc-vert du pays sur les panneaux.
    //
    // CE QU'IL NE PREND PAS, ET POURQUOI C'EST ECRIT ICI. Ni le nom de la
    // competition, ni celui du stade, ni son embleme, ni un seul athlete reel
    // sur la ligne de depart. Une teinte ne s'accapare pas ; un nom depose,
    // si — et une reprise de nom est la seule chose, dans tout ce fichier,
    // qui puisse valoir une lettre d'avocat. Les sept noms ci-dessous sont
    // inventes, comme partout ailleurs dans le jeu. Voir
    // juridique/edition-danube.md, qui tient la liste de ce qu'on s'interdit.
    //
    // `ouvert` LE DISTINGUE DES DEUX AUTRES. La Riviera et les Trois Soleils
    // n'existent que sur le canal de test ; celui-ci part dans la version
    // publique, sinon il n'y a pas d'edition speciale — juste un stade que
    // personne ne peut atteindre.
    //
    // LE PLATEAU EST CELUI D'UNE FINALE SUR INVITATION : sept coureurs entre
    // 9,55 et 9,88 au 100 m. Au-dessus du championnat du monde, sous la
    // finale olympique, et tres loin sous les ZEZE — l'echelle du
    // championnat reste ce qu'elle etait.
    { cle: 'danube', name: 'Stade du Danube', theme: 'danube',
      pool: 'sprint',
      horsSerie: true,
      ouvert: true,
      // Une finale sur invitation remplit un stade : les gradins sont pleins,
      // juste sous la finale intergalactique.
      foule: 0.97,
      plateau: { '100': [9.55, 9.88], '200': [19.25, 19.92],
                 '400': [43.15, 44.10], '4x100': [37.35, 38.30] },
      names: ['Zoltan Arrow', 'Bela Volt', 'Marko Surge', 'Gabor Onyx',
              'Levente Spark', 'Emese Vega', 'Dorka Swift'] },

    // LE CIMETIERE MUNICIPAL — la nuit du molosse.
    //
    // L'edition limitee d'Halloween. Elle vient APRES le Danube et AVANT les
    // deux stades du canal de test, parce que l'ordre de cette liste est un
    // contrat : un stade ouvert qui passerait derriere un stade ferme prendrait
    // un index different selon le canal, et le classement public annoncerait
    // un lieu que personne n'a couru (voir le commentaire de la boucle qui
    // remplit LEVELS, dans sprinter-app.js).
    //
    // CE STADE NE SE COURT PAS COMME LES AUTRES, ET POURTANT IL EST ORDINAIRE
    // ICI. Le molosse, le compte a rebours, la morsure : rien de tout cela
    // n'est dans cette entree, et c'est voulu — le moteur pose une piste et
    // sept adversaires, le reste se greffe par-dessus (game/halloween.ts),
    // exactement comme les haies se greffent sur une course plate. Un stade qui
    // porterait sa propre regle serait un stade qu'on ne peut plus ouvrir sans
    // relire le moteur.
    //
    // LE PLATEAU EST CELUI D'UNE COURSE QU'ON NE REGARDE PAS. Sept coureurs
    // entre 10,40 et 11,60 au 100 m — le niveau national, pas davantage. Ils
    // sont la pour peupler les couloirs, et la nuit se joue contre le chien :
    // un plateau mondial aurait mis un second enjeu dans une course qui n'en
    // supporte qu'un, et le joueur aurait perdu contre le chien en croyant
    // avoir perdu contre eux.
    //
    // Les sept noms sont ceux d'un cortege, et ils sont inventes comme partout
    // ailleurs dans le jeu.
    { cle: 'cimetiere', name: 'Cimetiere municipal', theme: 'halloween',
      pool: 'divers',
      horsSerie: true,
      ouvert: true,
      // Un cimetiere la nuit n'est pas un stade plein. Les gradins sont
      // clairsemes, et ce qui s'y tient n'est pas venu pour applaudir.
      foule: 0.34,
      // Les cinq traces de la nuit ont leur plateau ici : `buildLevel` lit
      // `lvl.plateau[R.key]` pour un stade hors serie, et une clef manquante
      // fait tomber la construction de la course. Les sept du cortege courent
      // au niveau national, pas plus : la nuit se joue contre le chien, et un
      // plateau mondial aurait mis un second enjeu dans une course qui n'en
      // supporte qu'un.
      plateau: { '100': [10.40, 11.60], '200': [21.00, 23.00],
                 '400': [47.00, 52.00], '4x100': [41.00, 45.00],
                 'nuit-100': [10.40, 11.60], 'nuit-100v': [10.60, 11.80],
                 'nuit-200': [21.00, 23.00], 'nuit-300': [32.00, 35.00],
                 'nuit-400': [47.00, 52.00] },
      names: ['Igor Tombal', 'Vlad Crampon', 'Morgue Belfort', 'Cyprien Caveau',
              'Osselet Marchand', 'Lilith Corbeau', 'Nosfera Toussaint'] },

    { cle: 'riviera', name: 'Stade de la Riviera', theme: 'riviera',
      pool: 'divers',
      // Ce que les ecrans lisent pour ne pas le numeroter comme une etape.
      horsSerie: true,
      // Un meeting d'ete au bord de l'eau : gradins bien garnis, sans
      // l'affluence d'une finale mondiale.
      foule: 0.72,
      plateau: { '100': [9.62, 9.92], '200': [19.30, 19.90],
                 '400': [43.30, 44.00], '4x100': [37.60, 38.60] },
      names: ['Rick Palma', 'Sunny Marino', 'Kenji Aoyama', 'Milo Cabana',
              'Vince Corsair', 'Lisa Miramar', 'Nina Solaris'] },

    // LE STADE DES TROIS SOLEILS — la planete verte des mangas de combat.
    //
    // Trois soleils, donc jamais de nuit : c'est le detail qui fait toute la
    // planete, et c'est pour lui que le ciel de ce stade est jaune-vert au
    // lieu d'etre bleu. Le reste suit — une mer d'emeraude, des aiguilles de
    // roche et leurs arches au fond, des arbres a chapeau, et un plateau de
    // sept coureurs a la peau verte et au crane nu (pool 'namek').
    //
    // Le nom affiche vit dans les traductions, pas ici (voir LEVEL_NAMES) :
    // c'est la un seul endroit a changer si l'on veut le rapprocher — ou
    // l'eloigner — de l'oeuvre qui l'inspire, ce qui, pour un jeu publie sur
    // les magasins, n'est pas une question de gout mais de droit.
    //
    // LE PLATEAU EST FORT, ET IL S'ARRETE SOUS LES ZEZE. Ces sept-la sortent
    // du 100 m entre 9,28 et 9,66 — au-dessus de la finale olympique, sous
    // la finale intergalactique. Les faire courir plus vite que les ZEZE
    // aurait donne la meme chose qu'une septieme etape : la fin du
    // championnat n'aurait plus ete la fin.
    { cle: 'namek', name: 'Stade des Trois Soleils', theme: 'namek',
      pool: 'namek',
      horsSerie: true,
      // Un tournoi qui deplace une planete entiere : gradins pleins, juste
      // sous la finale ZEZE.
      foule: 0.94,
      plateau: { '100': [9.28, 9.66], '200': [18.60, 19.20],
                 '400': [41.80, 43.00], '4x100': [37.05, 37.85] },
      // Sept noms tires des instruments de musique, comme le veut la
      // coutume de ce peuple. Ils sont inventes : aucun ne sort de l'oeuvre.
      names: ['Ocarina Kess', 'Tamtam Solo', 'Gong Mirai', 'Cymba Loro',
              'Fifre Nahon', 'Rebec Tanou', 'Sitara Vale'] },
  ];

  // ---------------------------------------------------------------------
  // CYCLE DE FOULEE
  // ---------------------------------------------------------------------
  // Points cles d'un cycle de sprint (deux appuis), interpoles par une
  // spline de Catmull-Rom : la vitesse angulaire reste continue d'un point
  // au suivant, ce qu'une sinusoide ne donne pas.
  //   q = 0.00 pose du pied      q = 1.50 poussee
  //   q = 2.70 talon-fesse       q = 4.85 genou haut

  function catmull(keys, n) {
    n = n || 192;
    const m = keys.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const q = TAU * i / n;
      let j = 0;
      for (let t = 0; t < m; t++) {
        let q0 = keys[t][0], q1 = keys[(t + 1) % m][0];
        if (q1 < q0) q1 += TAU;
        const qq = q >= q0 ? q : q + TAU;
        if (qq >= q0 && qq <= q1) { j = t; break; }
      }
      const p0 = keys[(j - 1 + m) % m][1], p1 = keys[j][1];
      const p2 = keys[(j + 1) % m][1], p3 = keys[(j + 2) % m][1];
      let a0 = keys[j][0], a1 = keys[(j + 1) % m][0];
      if (a1 < a0) a1 += TAU;
      const qq = q >= a0 ? q : q + TAU;
      const t = (qq - a0) / Math.max(1e-6, a1 - a0), t2 = t * t;
      out[i] = 0.5 * (2 * p1 + (-p0 + p2) * t +
                      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                      (-p0 + 3 * p1 - 3 * p2 + p3) * t2 * t);
    }
    return out;
  }

  function gait(table, q) {
    const n = table.length;
    let x = ((q % TAU) + TAU) % TAU / TAU * n;
    const i = Math.floor(x), f = x - i;
    return table[i % n] + (table[(i + 1) % n] - table[i % n]) * f;
  }

  const GAIT = {
    thigh: catmull([[0, 0.38], [0.75, -0.02], [1.50, -0.50], [2.20, -0.30],
                    [3.10, 0.20], [4.10, 0.68], [4.85, 0.80], [5.55, 0.66]]),
    knee: catmull([[0, -0.28], [0.50, -0.60], [1.10, -0.30], [1.50, -0.16],
                   [2.10, -1.20], [2.70, -2.00], [3.40, -2.05], [4.20, -1.55],
                   [5.00, -0.90], [5.60, -0.42]]),
    ankle: catmull([[0, 0.12], [0.60, 0.02], [1.45, -0.52], [2.10, -0.30],
                    [3.20, 0.16], [4.60, 0.20], [5.60, 0.14]]),
    arm: catmull([[0, 0.42], [1.10, 0.10], [2.20, -0.46], [3.14, -0.95],
                  [4.10, -0.60], [5.10, 0.05], [5.70, 0.30]]),
    elbow: catmull([[0, 1.60], [1.10, 1.34], [2.20, 0.98], [3.14, 0.78],
                    [4.10, 1.04], [5.10, 1.44], [5.70, 1.56]])
  };

  // Couplage bras / jambes (biomecanique du sprint) : le bras doit etre au
  // plus loin en arriere quand la cuisse du MEME cote est au plus haut
  // devant, et inversement. Les deux courbes n'ayant pas leurs extremes au
  // meme endroit du cycle (cuisse avant vers 4,81 rad, bras arriere vers
  // 3,18 rad), un simple dephasage de PI ne les met PAS en opposition : on
  // obtenait un bras et un genou qui montaient du meme cote, ce qui ne
  // ressemble a rien d'athletique. On cale donc le bras sur la cuisse a
  // partir des extremes reels des tables, plutot qu'en supposant qu'elles
  // sont alignees.
  // ---- profils de foulee -------------------------------------------------
  // Chaque athlete court avec SA biomecanique. Les tables donnent la forme du
  // cycle (angles au fil de la foulee) ; les scalaires donnent le caractere :
  // amplitude des membres, inclinaison du buste, rebond vertical, et longueur
  // d'appui (stride) qui arbitre entre foulee longue et haute frequence.
  // 'base' reprend a l'identique la foulee historique : tout athlete sans
  // profil declare court exactement comme avant.
  const GAITS = {
    base: Object.assign({}, GAIT, {
      boost: 1.18, armAmp: 1.00, lean: 1.00, bob: 1.00, stride: 1.00
    }),

    // Cadence tres elevee plutot que foulee longue, recuperation talon-fessier
    // tres compacte et maintenue tard, buste haut, bras relaches.
    cadence: {
      thigh: catmull([[0, 0.34], [0.75, -0.02], [1.50, -0.44], [2.20, -0.26],
                      [3.10, 0.18], [4.10, 0.62], [4.85, 0.74], [5.55, 0.60]]),
      knee: catmull([[0, -0.26], [0.50, -0.58], [1.10, -0.30], [1.50, -0.18],
                     [2.10, -1.44], [2.70, -2.28], [3.40, -2.34], [4.20, -1.86],
                     [5.00, -1.02], [5.60, -0.40]]),
      ankle: catmull([[0, 0.14], [0.60, 0.04], [1.45, -0.48], [2.10, -0.28],
                      [3.20, 0.18], [4.60, 0.22], [5.60, 0.15]]),
      arm: catmull([[0, 0.36], [1.10, 0.08], [2.20, -0.40], [3.14, -0.82],
                    [4.10, -0.52], [5.10, 0.04], [5.70, 0.26]]),
      elbow: catmull([[0, 1.72], [1.10, 1.48], [2.20, 1.12], [3.14, 0.92],
                      [4.10, 1.18], [5.10, 1.58], [5.70, 1.68]]),
      boost: 1.14, armAmp: 0.90, lean: 0.82, bob: 0.88, stride: 0.97
    },

    // Sprinteur vif : appuis brefs, genou avant qui remonte tot et vite,
    // bras nerveux. Amplitude contenue, tout est dans la frequence.
    sharp: {
      thigh: catmull([[0, 0.42], [0.75, 0.00], [1.50, -0.46], [2.20, -0.24],
                      [3.10, 0.28], [4.10, 0.76], [4.85, 0.84], [5.55, 0.66]]),
      knee: catmull([[0, -0.30], [0.50, -0.64], [1.10, -0.32], [1.50, -0.14],
                     [2.10, -1.34], [2.70, -2.12], [3.40, -2.08], [4.20, -1.44],
                     [5.00, -0.78], [5.60, -0.38]]),
      ankle: catmull([[0, 0.16], [0.60, 0.02], [1.45, -0.56], [2.10, -0.32],
                      [3.20, 0.20], [4.60, 0.24], [5.60, 0.16]]),
      arm: catmull([[0, 0.48], [1.10, 0.12], [2.20, -0.50], [3.14, -1.02],
                    [4.10, -0.64], [5.10, 0.06], [5.70, 0.34]]),
      elbow: catmull([[0, 1.62], [1.10, 1.32], [2.20, 0.94], [3.14, 0.72],
                      [4.10, 1.00], [5.10, 1.46], [5.70, 1.58]]),
      boost: 1.20, armAmp: 1.08, lean: 1.06, bob: 0.94, stride: 0.94
    },

    // Puissance : poussee longue, forte extension derriere, jambe plus
    // tendue a l'appui, bras amples. Frequence plus basse, foulee qui avale.
    power: {
      thigh: catmull([[0, 0.40], [0.75, -0.06], [1.50, -0.64], [2.20, -0.40],
                      [3.10, 0.18], [4.10, 0.72], [4.85, 0.86], [5.55, 0.72]]),
      knee: catmull([[0, -0.22], [0.50, -0.50], [1.10, -0.26], [1.50, -0.12],
                     [2.10, -1.02], [2.70, -1.74], [3.40, -1.80], [4.20, -1.40],
                     [5.00, -0.84], [5.60, -0.38]]),
      ankle: catmull([[0, 0.10], [0.60, 0.00], [1.45, -0.62], [2.10, -0.34],
                      [3.20, 0.14], [4.60, 0.18], [5.60, 0.12]]),
      arm: catmull([[0, 0.50], [1.10, 0.12], [2.20, -0.54], [3.14, -1.08],
                    [4.10, -0.68], [5.10, 0.06], [5.70, 0.36]]),
      elbow: catmull([[0, 1.52], [1.10, 1.26], [2.20, 0.90], [3.14, 0.70],
                      [4.10, 0.96], [5.10, 1.36], [5.70, 1.48]]),
      boost: 1.26, armAmp: 1.12, lean: 1.14, bob: 1.10, stride: 1.03
    },

    // Foulee huilee : aucune cassure, extremes adoucis, tres peu de rebond.
    // Amplitude large mais posee - l'impression de glisser sans forcer.
    fluid: {
      thigh: catmull([[0, 0.36], [0.75, -0.04], [1.50, -0.54], [2.20, -0.34],
                      [3.10, 0.16], [4.10, 0.64], [4.85, 0.76], [5.55, 0.64]]),
      knee: catmull([[0, -0.26], [0.50, -0.54], [1.10, -0.32], [1.50, -0.20],
                     [2.10, -1.10], [2.70, -1.80], [3.40, -1.88], [4.20, -1.50],
                     [5.00, -0.92], [5.60, -0.44]]),
      ankle: catmull([[0, 0.11], [0.60, 0.02], [1.45, -0.46], [2.10, -0.28],
                      [3.20, 0.14], [4.60, 0.17], [5.60, 0.12]]),
      arm: catmull([[0, 0.38], [1.10, 0.10], [2.20, -0.42], [3.14, -0.86],
                    [4.10, -0.56], [5.10, 0.04], [5.70, 0.28]]),
      elbow: catmull([[0, 1.56], [1.10, 1.34], [2.20, 1.02], [3.14, 0.84],
                      [4.10, 1.08], [5.10, 1.42], [5.70, 1.52]]),
      boost: 1.16, armAmp: 0.96, lean: 0.88, bob: 0.72, stride: 0.98
    },

    // Frequence elevee ET grande amplitude, talon qui claque tres haut sous
    // la fesse, buste redresse jusqu'a paraitre en arriere, epaules relachees.
    //
    // Ce profil portait le nom d'un sprinteur reel. Les six autres decrivent
    // un geste — cadence, sharp, power, fluid, drive, glide — et celui-ci
    // designait une personne. Il ne s'affichait nulle part, mais il partait
    // dans le build public, lisible par qui ouvre le fichier : le nom d'un
    // athlete vivant accroche a la foulee d'un personnage de jeu. On decrit
    // donc le geste, comme partout ailleurs. Voir juridique/edition-danube.md.
    whip: {
      thigh: catmull([[0, 0.38], [0.75, -0.04], [1.50, -0.58], [2.20, -0.32],
                      [3.10, 0.24], [4.10, 0.78], [4.85, 0.92], [5.55, 0.74]]),
      knee: catmull([[0, -0.28], [0.50, -0.62], [1.10, -0.34], [1.50, -0.18],
                     [2.10, -1.50], [2.70, -2.34], [3.40, -2.42], [4.20, -1.92],
                     [5.00, -1.06], [5.60, -0.44]]),
      ankle: catmull([[0, 0.14], [0.60, 0.02], [1.45, -0.58], [2.10, -0.32],
                      [3.20, 0.18], [4.60, 0.22], [5.60, 0.14]]),
      arm: catmull([[0, 0.44], [1.10, 0.10], [2.20, -0.48], [3.14, -0.92],
                    [4.10, -0.58], [5.10, 0.05], [5.70, 0.32]]),
      elbow: catmull([[0, 1.66], [1.10, 1.40], [2.20, 1.06], [3.14, 0.86],
                      [4.10, 1.12], [5.10, 1.50], [5.70, 1.62]]),
      boost: 1.22, armAmp: 0.98, lean: 0.70, bob: 0.92, stride: 1.00
    },

    // Puissance appuyee : buste plus engage, poussee qui dure, rebond franc.
    // Une foulee qui laboure plutot qu'elle ne caresse.
    drive: {
      thigh: catmull([[0, 0.44], [0.75, -0.02], [1.50, -0.60], [2.20, -0.38],
                      [3.10, 0.22], [4.10, 0.70], [4.85, 0.82], [5.55, 0.70]]),
      knee: catmull([[0, -0.24], [0.50, -0.56], [1.10, -0.28], [1.50, -0.14],
                     [2.10, -1.16], [2.70, -1.90], [3.40, -1.96], [4.20, -1.52],
                     [5.00, -0.88], [5.60, -0.40]]),
      ankle: catmull([[0, 0.13], [0.60, 0.00], [1.45, -0.60], [2.10, -0.34],
                      [3.20, 0.17], [4.60, 0.21], [5.60, 0.13]]),
      arm: catmull([[0, 0.52], [1.10, 0.14], [2.20, -0.52], [3.14, -1.04],
                    [4.10, -0.66], [5.10, 0.07], [5.70, 0.36]]),
      elbow: catmull([[0, 1.50], [1.10, 1.24], [2.20, 0.88], [3.14, 0.68],
                      [4.10, 0.94], [5.10, 1.34], [5.70, 1.46]]),
      boost: 1.24, armAmp: 1.10, lean: 1.20, bob: 1.14, stride: 1.04
    },

    // Foulee aerienne : suspension longue, genou qui monte haut et retombe
    // lentement, peu d'appuis. Silhouette longiligne qui semble planer.
    glide: {
      thigh: catmull([[0, 0.34], [0.75, -0.06], [1.50, -0.56], [2.20, -0.36],
                      [3.10, 0.14], [4.10, 0.66], [4.85, 0.84], [5.55, 0.68]]),
      knee: catmull([[0, -0.28], [0.50, -0.52], [1.10, -0.34], [1.50, -0.22],
                     [2.10, -1.06], [2.70, -1.72], [3.40, -1.84], [4.20, -1.56],
                     [5.00, -0.98], [5.60, -0.46]]),
      ankle: catmull([[0, 0.10], [0.60, 0.03], [1.45, -0.44], [2.10, -0.26],
                      [3.20, 0.13], [4.60, 0.16], [5.60, 0.11]]),
      arm: catmull([[0, 0.34], [1.10, 0.09], [2.20, -0.38], [3.14, -0.80],
                    [4.10, -0.52], [5.10, 0.03], [5.70, 0.24]]),
      elbow: catmull([[0, 1.58], [1.10, 1.38], [2.20, 1.08], [3.14, 0.90],
                      [4.10, 1.14], [5.10, 1.46], [5.70, 1.54]]),
      boost: 1.20, armAmp: 0.92, lean: 0.78, bob: 1.06, stride: 1.06
    }
  };

  // Couplage bras / jambes (biomecanique du sprint) : le bras doit etre au
  // plus loin en arriere quand la cuisse du MEME cote est au plus haut
  // devant, et inversement. Les deux courbes n'ayant pas leurs extremes au
  // meme endroit du cycle, un simple dephasage de PI ne les met PAS en
  // opposition : on obtenait un bras et un genou qui montaient du meme cote,
  // ce qui ne ressemble a rien d'athletique. On cale donc le bras sur la
  // cuisse a partir des extremes reels des tables, plutot qu'en supposant
  // qu'elles sont alignees. Chaque profil ayant ses propres tables, le
  // dephasage se calcule par profil (et se retient, c'est un balayage).
  function peakAt(table, sign) {
    let best = -Infinity, at = 0;
    for (let i = 0; i < 720; i++) {
      const q = TAU * i / 720, v = sign * gait(table, q);
      if (v > best) { best = v; at = q; }
    }
    return at;
  }

  const armPhaseCache = new Map();
  function armPhaseOf(P) {
    let v = armPhaseCache.get(P);
    if (v === undefined) {
      v = ((peakAt(P.arm, -1) - peakAt(P.thigh, 1)) % TAU + TAU) % TAU;
      armPhaseCache.set(P, v);
    }
    return v;
  }

  const EMPTY_MORPH = {};

  function gaitOf(look) {
    return (look && GAITS[look.gait]) || GAITS.base;
  }

  const ARM_PHASE = armPhaseOf(GAITS.base);

  // ---------------------------------------------------------------------
  // ATHLETES
  // ---------------------------------------------------------------------
  const SKIN = {
    ebene: [74, 46, 32], cacao: [96, 60, 40], acajou: [108, 66, 42],
    noisette: [120, 76, 50], bronze: [142, 92, 58],
    ambre: [176, 122, 78], miel: [198, 150, 104],
    olive: [206, 166, 118], sable: [224, 186, 142],
    clair: [238, 204, 166], porcelaine: [246, 220, 190],
    // La onzieme n'est pas une carnation humaine, et n'entre dans aucun
    // tirage : elle n'existe que pour le plateau du stade des trois soleils
    // (voir SKIN_POOL.namek). Rangee ici quand meme, parce que c'est le seul
    // endroit ou le moteur sait traduire un nom de peau en trois octets.
    vert: [104, 176, 96]
  };
  // Les etapes locales reunissent un plateau tire au hasard parmi toutes
  // les carnations (rien n'empeche deux ou six coureurs de sortir avec la
  // meme couleur, c'est un vrai tirage). A partir du championnat du monde,
  // le plateau est exclusivement noir, comme les vraies finales du 100 m.
  const SKIN_POOL = {
    divers: ['ebene', 'cacao', 'acajou', 'noisette', 'bronze', 'ambre',
             'miel', 'olive', 'sable', 'clair', 'porcelaine'],
    sprint: ['ebene'],
    namek: ['vert']
  };
  // Un plateau peut imposer sa coiffure.
  //
  // Le peuple du stade des trois soleils est CHAUVE, tous autant qu'ils sont,
  // et c'est la moitie de ce qui le rend reconnaissable : la peau verte sous
  // une natte ou une queue de cheval ne dit plus rien du tout. Le tirage de
  // `lookFor` reste fait quand meme, puis on ecrase le resultat — retirer le
  // tirage decalerait la suite aleatoire, et les huit athletes des deux autres
  // plateaux changeraient tous de visage pour une raison qui ne les concerne
  // pas.
  const POOL_CRANE = { namek: 'shaved' };
  const crane = (pool, tire) => POOL_CRANE[pool] || tire;
  // Et sa tenue.
  //
  // Les sept maillots ordinaires sont vifs et melanges, ce qui va bien a une
  // carnation humaine. Sur une peau verte, un tirage sur deux sortait un
  // maillot vert ou turquoise : l'athlete devenait une silhouette d'une seule
  // couleur, et on ne distinguait plus le torse des bras a trois couloirs de
  // distance. Blanc et violet, la tenue de ce peuple, redonnent le contraste
  // que la peau ne donne plus.
  const POOL_TENUE = {
    namek: [[240, 240, 246], [152, 112, 210], [232, 232, 238], [126, 94, 190]]
  };
  const HAIR_COLS = {
    noir: [28, 22, 22], brun: [56, 36, 24], chatain: [92, 62, 36],
    blond: [188, 154, 88], roux: [148, 74, 38], gris: [176, 176, 182]
  };
  const HAIR = HAIR_COLS.noir;

  function look(o) {
    return {
      build: o.build || 'm',
      skin: SKIN[o.skin] || SKIN.cacao,
      jersey: o.jersey,
      shorts: o.shorts || [28, 28, 42],
      shoe: o.shoe || [250, 250, 255],
      hair: o.hair || 'crop',
      hairCol: o.hairCol || HAIR,
      h: Math.max(C.MIN_H, Math.min(C.MAX_H, o.h || 1.80)),
      // Profil de foulee (voir GAITS) et retouches de gabarit : deux athletes
      // de meme taille doivent pouvoir avoir une silhouette et une gestuelle
      // reconnaissables. Absents => foulee historique et gabarit standard.
      gait: o.gait || 'base',
      morph: o.morph || null,
      // UNE TENUE DE VILLE, pour ceux qui ne courent pas. Des manches et un
      // pantalon a la couleur donnee au lieu de bras et de jambes nus, des
      // lunettes, et `civil` : ni dossard ni bandes de kit sur le buste — un
      // starter en dossard avait l'air d'un coureur qui s'est trompe de place.
      manches: o.manches || null,
      pantalon: o.pantalon || null,
      lunettes: o.lunettes || null,
      civil: !!o.civil
    };
  }

  // Meme regle que le reste du plateau "sprint" a partir du mondial :
  // que des carnations noires (ebene) pour la finale ZEZE.
  const ZEZE = {
    // Sept athletes, sept foulees et sept gabarits : chacun doit etre
    // reconnaissable de loin a sa silhouette, et de pres a sa gestuelle.
    // Le profil (voir GAITS) porte la biomecanique, morph le gabarit.
    'Benbezi ZEZE': look({ build: 'm', skin: 'ebene', jersey: [214, 48, 62],
      shorts: [26, 26, 40], hair: 'fade', h: 1.86,
      gait: 'whip', morph: { sh: 1.06, hip: 0.98, arm: 1.04, leg: 1.04 } }),
    'Ryan ZEZE': look({ build: 'm', skin: 'ebene', jersey: [48, 132, 232],
      shorts: [24, 30, 52], shoe: [250, 224, 70], hair: 'crop', h: 1.78,
      gait: 'sharp', morph: { sh: 1.02, hip: 0.98, arm: 1.02, leg: 1.06 } }),
    'Mickeal ZEZE': look({ build: 'm', skin: 'ebene', jersey: [44, 190, 128],
      shorts: [22, 34, 32], shoe: [246, 126, 46], hair: 'flattop', h: 1.85,
      gait: 'power', morph: { sh: 1.14, hip: 1.02, arm: 1.16, leg: 1.12 } }),
    'Herman ZEZE': look({ build: 'm', skin: 'ebene', jersey: [246, 150, 40],
      shorts: [34, 26, 22], shoe: [126, 226, 250], hair: 'shaved', h: 2.00,
      gait: 'fluid', morph: { sh: 0.96, hip: 0.94, arm: 0.92, leg: 0.94 } }),
    'Greta ZEZE': look({ build: 'f', skin: 'ebene', jersey: [162, 92, 232],
      shorts: [28, 22, 44], hair: 'bun', h: 1.70,
      gait: 'drive', morph: { sh: 1.12, hip: 1.06, arm: 1.10, leg: 1.14 } }),
    'Ervie ZEZE': look({ build: 'f', skin: 'ebene', jersey: [36, 198, 196],
      shorts: [20, 34, 36], shoe: [250, 224, 70], hair: 'braids', h: 1.75,
      gait: 'glide', morph: { sh: 0.92, hip: 0.94, arm: 0.88, leg: 0.92 } }),
    'Victoire ZEZE': look({ build: 'f', skin: 'ebene', jersey: [236, 96, 178],
      shorts: [36, 22, 36], shoe: [246, 126, 46], hair: 'ponytail', h: 1.63,
      gait: 'cadence', morph: { sh: 0.98, hip: 1.02, arm: 0.96, leg: 1.12 } })
  };

  const PLAYER_LOOK = look({ build: 'm', skin: 'ebene', jersey: [248, 205, 74],
    shorts: [38, 40, 68], hair: 'crop', h: 1.82 });

  const JERSEYS = [[64, 178, 235], [72, 214, 132], [236, 92, 88],
                   [176, 108, 235], [46, 206, 190], [246, 166, 52],
                   [226, 96, 168]];
  const SHOES = [[250, 250, 255], [250, 224, 70], [246, 126, 46],
                 [126, 226, 250]];
  const HAIRS = ['crop', 'fade', 'shaved', 'bun', 'ponytail', 'braids',
                 'flattop'];

  // Generateur deterministe : un meme nom donne toujours le meme athlete.
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0);
  }

  function lookFor(name, pool) {
    if (ZEZE[name]) return ZEZE[name];
    let s = hashSeed(name + '|' + (pool || 'divers'));
    const nx = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
    const skins = SKIN_POOL[pool] || SKIN_POOL.divers;
    const skin = skins[Math.floor(nx() * skins.length)];
    // Les cheveux clairs ne vont qu'avec les carnations claires.
    const pale = ['sable', 'clair', 'porcelaine', 'olive'].indexOf(skin) >= 0;
    const hairs = pale ? ['noir', 'brun', 'chatain', 'blond', 'roux']
                       : ['noir', 'noir', 'brun'];
    return look({
      build: nx() < 0.34 ? 'f' : 'm',
      skin: skin,
      jersey: (POOL_TENUE[pool] || JERSEYS)[
        Math.floor(nx() * (POOL_TENUE[pool] || JERSEYS).length)],
      shorts: [26 + Math.floor(nx() * 14), 26 + Math.floor(nx() * 10),
               36 + Math.floor(nx() * 16)],
      shoe: SHOES[Math.floor(nx() * SHOES.length)],
      hair: crane(pool, HAIRS[Math.floor(nx() * HAIRS.length)]),
      hairCol: HAIR_COLS[hairs[Math.floor(nx() * hairs.length)]],
      h: C.MIN_H + nx() * (C.MAX_H - C.MIN_H)
    });
  }

  // ---------------------------------------------------------------------
  // PISTE
  // ---------------------------------------------------------------------
  // La piste est celle de World Athletics : deux demi-cercles de 36,50 m de
  // rayon a la corde, relies par deux lignes droites de 84,39 m. Le detail
  // des cotes est dans docs/piste-athletisme.md.
  //
  // Le 200 m enchaine un virage puis une ligne droite ; le 100 m est le meme
  // trace avec un virage de longueur nulle. Le 400 m et le relais sont un
  // tour complet : ce meme virage + ligne droite, suivis d'un second
  // demi-tour tourne de 180 degres.
  //
  // Tout le monde court la meme distance — c'est la regle de l'athletisme,
  // et c'est aussi ce qui rend le jeu juste : le couloir ne change pas le
  // chrono possible. Ce qui change d'un couloir a l'autre, c'est OU l'on
  // demarre : voir bend1(), qui fabrique le depart en quinconce a partir du
  // seul rayon.
  function Track(race) {
    this.arc = race.arc;
    this.straight = race.straight;
    this.fullLap = !!race.fullLap;
    this.total = this.fullLap ? 2 * (race.arc + race.straight) : race.arc + race.straight;
    this.curved = race.arc > 0;
    this.relay = !!race.relay;
    this.legs = race.legs || 0;
    this.legLength = race.legLength || 0;
  }
  // Rayon de la ligne de mesure du couloir (lane compte a partir de zero) :
  // la trajectoire du coureur, pas le milieu du couloir.
  Track.prototype.radius = function (lane) {
    return lane === 0 ? C.R1 + C.MES_1 : C.R1 + lane * C.LANE_W + C.MES_N;
  };
  // Rayon d'une ligne peinte : edge(0) est la corde, edge(8) le bord
  // exterieur du huitieme couloir.
  Track.prototype.edge = function (e) { return C.R1 + e * C.LANE_W; };
  // Longueur du PREMIER virage, pour un rayon donne — et c'est la que se
  // fabrique le depart en quinconce.
  //
  // Sur un tour complet, le second virage est un demi-tour entier : le
  // coureur du couloir 8 y parcourt pi x 45,24 = 142,13 m la ou celui du
  // couloir 1 en parcourt 115,61. Comme tout le monde court 400 m et finit
  // sur la meme ligne, ce que le couloir exterieur prend au second virage,
  // il ne l'a pas au premier : il n'en fait que 400 - 2 x 84,39 - 142,13 =
  // 89,09 m, donc il demarre plus loin dans la courbe. C'est exactement le
  // decalage de 53,03 m qu'on lit sur une vraie piste.
  //
  // Sur un demi-tour (200 m), le virage vaut 115,61 m pour tous les
  // couloirs — 200 moins la ligne droite — et c'est l'angle balaye qui
  // diminue vers l'exterieur.
  Track.prototype.bend1 = function (r) {
    return this.fullLap ? this.total - 2 * this.straight - Math.PI * r : this.arc;
  };
  Track.prototype.posR = function (v, r, onBend) {
    if (this.curved && onBend) return [-r * Math.sin(v), r * Math.cos(v)];
    return [v, this.curved ? r : r];
  };
  // Second demi-tour : meme forme que le premier, tournee de 180 degres et
  // translatee pour raccorder au bout de la premiere ligne droite. Ici le
  // virage est toujours un demi-tour complet, quel que soit le rayon.
  Track.prototype.posLap2 = function (s2, r) {
    const B = Math.PI * r, S = this.straight;
    if (s2 < B) {
      const phi = (B - s2) / r;
      return [S + r * Math.sin(phi), -r * Math.cos(phi)];
    }
    return [S - (s2 - B), -r];
  };
  // Position a la distance s, pour un rayon donne directement (pas
  // necessairement une ligne de mesure : sert aussi au rendu, qui dessine
  // des reperes a des rayons arbitraires comme les bords de piste).
  //
  // Le trace boucle exactement : a s = total, tous les rayons tombent sur
  // [0, -r], c'est-a-dire sur une meme ligne d'arrivee radiale. Et pour le
  // couloir 1 d'un tour complet, bend1 vaut pi x 36,80, donc le depart
  // tombe lui aussi sur cette ligne — le tour est parfait, comme sur une
  // vraie piste.
  Track.prototype.posAtR = function (s, r) {
    const A = this.bend1(r);
    if (this.fullLap && s >= A + this.straight) {
      return this.posLap2(s - A - this.straight, r);
    }
    if (s < A) {
      const phi = (A - s) / r;
      return [-r * Math.sin(phi), r * Math.cos(phi)];
    }
    return [s - A, r];
  };
  Track.prototype.pos = function (s, lane) {
    if (!this.curved) return [s, C.LANE_W * (lane + 0.5)];
    return this.posAtR(s, this.radius(lane));
  };

  /**
   * LE MEME POINT, DECALE LATERALEMENT DANS LE COULOIR.
   *
   * `dr` est un ecart en metres par rapport a la ligne de mesure du couloir.
   * Il sert au relais, ou deux coequipiers partagent un couloir : l'un serre
   * la corde, l'autre court a l'exterieur.
   *
   * POURQUOI UNE FONCTION A PART, ET NON UN COULOIR FRACTIONNAIRE. `pos()`
   * tire l'abscisse curviligne du rayon : `bend1(r)` raccourcit quand le
   * rayon grandit, ce qui est exactement le depart en quinconce. Pour deux
   * couloirs voisins c'est juste — chacun court sa propre distance. Pour deux
   * coureurs du MEME couloir, c'est faux : places tous les deux a 112 m, ils
   * se retrouvaient a **1,9 m l'un de l'autre** a l'ecran, le plus a
   * l'exterieur en avant. Une transmission que le serveur declare au contact
   * s'affichait donc a deux bonnes foulees d'ecart.
   *
   * On garde donc l'abscisse du couloir — le meme angle pour les deux — et on
   * ne bouge que le rayon.
   */
  Track.prototype.posDemi = function (s, lane, dr) {
    if (!dr) return this.pos(s, lane);
    if (!this.curved) return [s, C.LANE_W * (lane + 0.5) + dr];
    const rRef = this.radius(lane), r = rRef + dr;
    const A = this.bend1(rRef);
    if (this.fullLap && s >= A + this.straight) {
      const s2 = s - A - this.straight, B = Math.PI * rRef;
      if (s2 < B) {
        const phi = (B - s2) / rRef;
        return [this.straight + r * Math.sin(phi), -r * Math.cos(phi)];
      }
      return [this.straight - (s2 - B), -r];
    }
    if (s < A) {
      const phi = (A - s) / rRef;
      return [-r * Math.sin(phi), r * Math.cos(phi)];
    }
    return [s - A, r];
  };
  // Le meme point, mais exprime comme un echantillon du rendu :
  // [surVirage, v, moitie]. Sur un virage v est l'angle, sur une ligne
  // droite c'est l'abscisse depuis le debut de cette droite. Cela permet de
  // tracer un repere RADIAL — un trait qui traverse le couloir a angle
  // constant — au lieu de relier deux points pris a la meme distance
  // parcourue, qui sur un virage ne sont pas alignes sur le meme rayon.
  Track.prototype.markAt = function (s, lane) {
    if (!this.curved) return [false, s, 0];
    const r = this.radius(lane), A = this.bend1(r), S = this.straight;
    if (this.fullLap && s >= A + S) {
      const s2 = s - A - S, B = Math.PI * r;
      if (s2 < B) return [true, (B - s2) / r, 1];
      return [false, s2 - B, 1];
    }
    if (s < A) return [true, (A - s) / r, 0];
    return [false, s - A, 0];
  };
  Track.prototype.heading = function (s, lane) {
    if (!this.curved) return 0;
    const r = this.radius(lane), A = this.bend1(r);
    if (this.fullLap && s >= A + this.straight) {
      const s2 = s - A - this.straight, B = Math.PI * r;
      if (s2 < B) return (B - s2) / r - Math.PI;
      return -Math.PI;
    }
    if (s >= A) return 0;
    return (A - s) / r;
  };
  Track.prototype.lean = function (s, lane, v) {
    if (!this.curved) return 0;
    const r = this.radius(lane), A = this.bend1(r);
    // Distance restant a courir dans le virage, ou null hors virage.
    let rem = null;
    if (this.fullLap && s >= A + this.straight) {
      const s2 = s - A - this.straight, B = Math.PI * r;
      if (s2 < B) rem = B - s2;
    } else if (s < A) {
      rem = A - s;
    }
    if (rem === null) return 0;
    const a = Math.atan((v * v) / (9.81 * r));
    const fade = Math.max(0, Math.min(1, rem / 9));
    // En debut de courbe (depart en quinconce, ou en sortie du second
    // virage), l'orientation (headAng) peut depasser 90 degres : combinee
    // a l'inclinaison laterale, la projection isometrique ecrasait
    // visuellement le coureur. On attenue donc l'inclinaison quand le cap
    // s'ecarte trop de l'axe de course, pour ne la laisser pleinement
    // visible qu'une fois le coureur revenu vers cet axe.
    const heading = Math.abs(this.heading(s, lane));
    const tempered = Math.max(0.4, 1 - heading / (Math.PI * 0.85));
    return Math.min(a, 0.38) * fade * tempered;
  };

  // ---------------------------------------------------------------------
  // COUREUR
  // ---------------------------------------------------------------------
  function Runner(name, lane, opts) {
    opts = opts || {};
    this.name = name;
    this.lane = lane;
    this.isPlayer = !!opts.isPlayer;
    this.look = this.isPlayer ? PLAYER_LOOK : lookFor(name, opts.pool);
    this.d = 0; this.v = 0;
    this.finished = false; this.finishTime = null;
    this.stride = alea() * TAU;
    this.lastStep = 0;
    this.stumbleTimer = 0; this.fallAnim = 0; this.lastKey = null;
    // depart : reaction, cadence de poussee, note de transition
    this.reaction = null; this.reactBonus = 0; this.jumped = false;
    this.freeze = 0; this.pressTimes = []; this.stumbledInDrive = false;
    // Relais : note du passage recu, et ecart entre les deux touches.
    this.passGrade = null; this.passGap = 0;
    // Ou commence la portion de ce coureur, et sur quelle longueur il se met
    // en action. Zero et DRIVE_END pour une course ordinaire — un relayeur,
    // lui, demarre a 100, 200 ou 300 metres du depart, et dispose de trente
    // metres de lancement au lieu de quinze de poussee. Sans ces deux
    // reperes, la transition serait notee au mauvais endroit et le troisieme
    // relayeur serait juge sur une phase qu'il a franchie depuis longtemps.
    this.legStart = 0;
    /**
     * OU S'ARRETE CE RELAYEUR, en metres absolus.
     *
     * Un relayeur ne court pas jusqu'a l'arrivee : sa course finit au bout de
     * SA zone de transmission. Sans cette borne, le donneur continuait tout
     * droit apres avoir lache le temoin — on le voyait a trois cents metres
     * du depart, courant une portion qui n'etait pas la sienne, pendant que
     * son coequipier courait la vraie. `null` pour une course ordinaire et
     * pour le quatrieme, que la ligne d'arrivee arrete deja.
     */
    this.relaisFin = null;
    /**
     * Ma moitie de couloir, en metres depuis la ligne de mesure.
     * Zero pour une course ordinaire : on court sur sa ligne.
     */
    this.demi = 0;
    /**
     * Le temoin, et dans quelle main : 1 ou -1, `null` s'il ne l'a pas.
     * Un seul coureur le porte a un instant donne. Voir `pose`.
     */
    this.temoin = null;
    this.driveEnd = C.DRIVE_END;
    this.transGrade = null; this.transRatio = 0;
    this.boostT = 0; this.boostDrag = 1; this.drivePitch = C.DRIVE_PITCH;
    this.target = opts.target || null;
    this.maxSpeed = opts.maxSpeed || 12;
    this.best = opts.best || 9.1;
    this.total = opts.total || 100;
    /**
     * LA FOULEE DU HURDLEUR, en part de celle du sprinteur. 1 partout ailleurs.
     *
     * Un hurdleur ne court pas comme un sprinteur a la meme vitesse : entre
     * deux haies du 110 m il couvre 5,59 m en trois foulees, 1,86 m chacune,
     * la ou un sprinteur lance en met 2,2 a 2,5. Il court plus serre et plus
     * vite en frequence. Sans ce facteur, le nombre d'appuis que le reglement
     * attend d'un intervalle ne tombait qu'a une vitesse de footing.
     *
     * C'est une propriete du coureur, posee par le jeu des haies a l'armement
     * et retiree au rangement : le moteur n'a pas a savoir pourquoi elle
     * change, et une course plate ne la voit jamais bouger.
     */
    this.foulee = 1;
    if (this.target) this.setPace(this.target);
  }

  Runner.prototype.setPace = function (T) {
    // v(t) = vmax (1 - e^-t/tau) : montee en vitesse puis allure tenue.
    // Une courbe en S ferait ralentir le coureur jusqu'a l'arret sur la
    // ligne, ce qui donne l'illusion d'etre double au dernier metre.
    this.target = T;
    this.tau = Math.max(0.35, Math.min(1.10, T * 0.16));
    const den = T - this.tau * (1 - Math.exp(-T / this.tau));
    this.vmax = this.total / Math.max(0.01, den);
  };

  // Distance couverte par UN appui (un pied), pas par le cycle complet :
  // un sprinteur d'elite pose le pied environ tous les 2,2 a 2,5 m a pleine
  // vitesse (~41 a 48 appuis sur 100 m). r.stride avance de PI (demi-tour)
  // par appui, donc de TAU (le cycle complet, 2 appuis) pour deux fois
  // cette distance - c'est ce qui fixe le bon nombre de foulees vs le
  // chrono, plutot qu'un cycle deux fois trop rapide.
  Runner.prototype.strideLength = function () {
    const amp = 0.34 + 0.66 * Math.min(1, this.v / this.maxSpeed);
    const leg = 0.87 * (this.look.h / C.MODEL_H);
    // stride > 1 : foulee qui avale, moins d'appuis. stride < 1 : haute
    // frequence. La vitesse ne change pas, seul le nombre d'appuis pour la
    // couvrir - c'est la difference entre un finisseur et un frequenciel.
    const P = gaitOf(this.look);
    return Math.max(0.85, 4 * leg * P.stride * (this.foulee || 1) *
                    Math.sin(Math.min(1.15, 0.70 * amp)));
  };

  // Inclinaison du corps entier, en radians, d'apres la distance parcourue.
  // Maximale a la sortie des blocs, nulle une fois la vitesse maximale
  // atteinte. La decroissance est en puissance 1,6 : le redressement est
  // rapide sur les premiers metres puis s'adoucit, comme chez un sprinteur.
  Runner.prototype.pitchAt = function () {
    const q = Math.min(1, Math.max(0, (this.d - this.legStart) / C.TRANS_END));
    return C.DRIVE_PITCH * Math.pow(1 - q, 1.6);
  };

  // Phase courante : 0 poussee, 1 transition, 2 vitesse maximale.
  Runner.prototype.phase = function () {
    const p = this.d - this.legStart;
    if (p < this.driveEnd) return 0;
    return p < C.TRANS_END ? 1 : 2;
  };

  // Note de transition : on compare la cadence de la premiere moitie de la
  // poussee a celle de la seconde. Un bon depart monte en frequence sans
  // a-coup ; trebucher annule la note.
  //
  // Deux precautions, chacune corrigeant un defaut mesure. On prend les
  // MEDIANES de chaque moitie, et non la moyenne de trois appuis : sur si peu
  // d'echantillons, l'imprecision du doigt pesait plus lourd que l'intention,
  // et la note basculait sur vingt millisecondes. Et la seconde moitie doit
  // atteindre une cadence reelle : autrement le moyen le plus sur d'obtenir la
  // note parfaite etait de trainer expres au depart, ce qui recompensait
  // exactement le contraire d'un bon demarrage.
  function mediane(a) {
    const s = a.slice().sort((x, y) => x - y), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  /**
   * Note un passage de temoin et en applique les effets.
   *
   * `ecart` est le decalage entre les deux touches, en secondes, mesure sur
   * l'horloge commune de la salle — pas sur celle d'un telephone.
   *
   * Cette note ne juge que la SYNCHRONISATION. Le lieu du passage, lui, ne se
   * note pas : hors zone, l'equipe est eliminee, et la question du bareme ne
   * se pose plus.
   *
   * La vitesse de lancement acquise dans la zone n'est pas remplacee : elle
   * est conservee, entierement sur un bon passage, amputee sur un mauvais.
   * C'est le sens du geste — on ne redonne pas de la vitesse a celui qui rate,
   * on lui retire celle qu'il avait construite.
   */
  Runner.prototype.gradeHandoff = function (ecart) {
    const e = Math.abs(Number(ecart) || 0);
    const g = e <= C.RELAY_SYNC_PERFECT ? 2 : e <= C.RELAY_SYNC_GOOD ? 1 : 0;
    this.passGrade = g;
    this.passGap = e;
    this.v = Math.min(this.maxSpeed,
                      this.v * C.RELAY_PASS_KEEP[g] + C.RELAY_PASS_BOOST[g]);
    this.maxSpeed *= C.RELAY_PASS_VMAX[g];
    this.boostT = C.RELAY_EFFECT_TIME;
    this.boostDrag = C.RELAY_PASS_DRAG[g];
    if (C.RELAY_PASS_FREEZE[g] > 0) this.stumbleTimer = C.RELAY_PASS_FREEZE[g];
    return g;
  };

  Runner.prototype.gradeTransition = function () {
    const p = this.pressTimes;
    if (this.stumbledInDrive || p.length < C.TRANS_MIN_PRESS) {
      this.transGrade = 0; return;
    }
    const gap = [];
    for (let i = 1; i < p.length; i++) gap.push(p[i] - p[i - 1]);
    const moitie = Math.floor(gap.length / 2);
    const late = mediane(gap.slice(moitie));
    const ratio = late > 0.0001 ? mediane(gap.slice(0, moitie)) / late : 0;
    this.transRatio = ratio;
    // Une montee qui n'aboutit pas a une vraie cadence ne vaut rien : c'est
    // ce qui distingue un demarrage maitrise d'un depart simplement lent.
    const abouti = late <= C.TRANS_FLOOR;
    this.transGrade = !abouti ? 0
      : (ratio >= C.TRANS_PERFECT ? 2 : (ratio >= C.TRANS_GOOD ? 1 : 0));
    const g = this.transGrade;
    this.maxSpeed *= C.TRANS_VMAX[g];
    this.v = Math.min(this.maxSpeed, this.v + C.TRANS_BOOST[g]);
    this.boostT = C.TRANS_TIME[g];
    this.boostDrag = C.TRANS_DRAG[g];
  };

  Runner.prototype.press = function (key, elapsed) {
    if (this.finished || this.stumbleTimer > 0 || this.freeze > 0) return false;
    // premier appui : on mesure le temps de reaction et on en fait un gain
    if (this.reaction === null && elapsed !== undefined) {
      this.reaction = Math.max(0, elapsed);
      if (!this.jumped) {
        const w = C.REACT_WINDOW - C.REACT_BEST;
        this.reactBonus = C.REACT_BONUS *
          Math.min(1, Math.max(0, (C.REACT_WINDOW - this.reaction) / w));
        this.v += this.reactBonus;
      }
    }
    if (elapsed !== undefined && this.d - this.legStart < this.driveEnd)
      this.pressTimes.push(elapsed);
    let stumbled = false;
    if (this.lastKey === key) {
      const risk = (C.STUMBLE_BASE +
        C.STUMBLE_SPEED * Math.min(1, this.v / this.maxSpeed)) *
        C.STUMBLE_INPUT_SCALE;
      if (alea() < risk) {
        this.v *= C.STUMBLE_KEEP;
        this.stumbleTimer = C.STUMBLE_TIME;
        this.fallAnim = 1;
        if (this.d - this.legStart < this.driveEnd) this.stumbledInDrive = true;
        stumbled = true;
      } else {
        this.v = Math.min(this.maxSpeed, this.v + C.BOOST * 0.3);
      }
    } else {
      this.v = Math.min(this.maxSpeed, this.v + C.BOOST);
    }
    this.lastKey = key;
    return stumbled;
  };

  Runner.prototype.stepPlayer = function (dt, elapsed) {
    if (this.fallAnim > 0) {
      this.fallAnim = Math.max(0, this.fallAnim - dt / C.FALL_TIME);
    }
    if (this.freeze > 0) this.freeze = Math.max(0, this.freeze - dt);
    if (this.boostT > 0) this.boostT = Math.max(0, this.boostT - dt);
    if (this.finished) {
      this.v *= Math.exp(-1.15 * dt);
      this.d += this.v * dt;
      this.stride += this.v * dt * (Math.PI / this.strideLength());
      this.drivePitch = 0;
      return;
    }
    if (this.stumbleTimer > 0) {
      this.stumbleTimer -= dt;
      this.v *= Math.exp(-6 * dt);
    } else {
      // le freinage est allege quelques secondes apres une bonne transition
      const drag = C.DRAG * (this.boostT > 0 ? this.boostDrag : 1);
      this.v *= Math.exp(-drag * dt);
    }
    const before = this.d;
    this.d += this.v * dt;
    // LE BOUT DE LA ZONE EST UN MUR, PAS UNE LIGNE D'ARRIVEE.
    //
    // On ne le « termine » pas — un relayeur qui passe son temoin n'a pas
    // fini une course, il a fini SA portion, et le chrono de l'equipe
    // continue sans lui. On le retient donc sur place, et il s'arrete comme
    // on s'arrete apres une transmission : en deceleration, pas net.
    if (this.relaisFin != null && this.d >= this.relaisFin) {
      this.d = this.relaisFin;
      this.v *= Math.exp(-7 * dt);
    }
    this.stride += this.v * dt * (Math.PI / this.strideLength());
    this.drivePitch = this.pitchAt();
    const fin = this.legStart + this.driveEnd;
    if (this.transGrade === null && before < fin && this.d >= fin) {
      this.gradeTransition();
    }
    if (this.d >= this.total) {
      this.finished = true;
      // Le chrono affiche doit toujours etre le temps reellement couru : le
      // plancher a `this.best` cachait les performances qui le battaient
      // (rendait par exemple un 37 s affiche comme 40,50 s sur le 400 m).
      this.finishTime = elapsed;
    }
  };

  Runner.prototype.stepAI = function (dt, elapsed) {
    this.drivePitch = this.finished ? 0 : this.pitchAt();
    if (this.finished) {
      this.v *= Math.exp(-1.05 * dt);
      this.d += this.v * dt;
      this.stride += this.v * dt * (Math.PI / this.strideLength());
      return;
    }
    if (elapsed >= this.target) {
      this.d = this.total;
      this.v = this.vmax * (1 - Math.exp(-this.target / this.tau));
      this.finished = true;
      this.finishTime = this.target;
      return;
    }
    const t = elapsed;
    let d = this.vmax * (t - this.tau * (1 - Math.exp(-t / this.tau)));
    d = Math.max(0, Math.min(this.total, d));
    if (dt > 0) this.v = Math.max(0, (d - this.d) / dt);
    this.d = Math.max(this.d, d);
    this.stride += this.v * dt * (Math.PI / this.strideLength());
  };

  Runner.prototype.tookStep = function () {
    const s = Math.floor(this.stride / Math.PI);
    if (s !== this.lastStep) { this.lastStep = s; return true; }
    return false;
  };

  // Forme de la chute, a partir de fallAnim (1 au faux pas -> 0 a la fin).
  // L'ancienne version basculait le corps d'un coup a 1,25 rad puis le
  // redressait lineairement : ca partait raide et ca se terminait mou.
  // Ici tout passe par une enveloppe qui part de zero, culmine, puis
  // retombe, avec des oscillations amorties par dessus : le coureur pique
  // du nez, part de travers, mouline des bras et se retablit en titubant.
  function fallShape(fallAnim) {
    if (!fallAnim || fallAnim <= 0) return null;
    const p = 1 - Math.max(0, Math.min(1, fallAnim));   // 0 -> 1
    // montee rapide (p^0.45), retour plus lent : le desequilibre est
    // brutal, le retablissement laborieux — c'est ce qui fait le comique.
    const env = Math.sin(Math.PI * Math.pow(p, 0.45));
    const damp = 1 - p;                                  // oscillations qui s'eteignent
    return {
      // piqué du nez + rebonds de redressement
      pitch: env * (0.92 + 0.34 * Math.sin(p * Math.PI * 4.6) * damp),
      // deport lateral : on titube d'un cote puis de l'autre
      roll: env * 0.46 * Math.sin(p * Math.PI * 2.4),
      // moulinets de bras, a fond au plus fort du desequilibre
      flail: env
    };
  }

  // ---------------------------------------------------------------------
  // LE DEPART DANS LES BLOCS
  // ---------------------------------------------------------------------
  //
  // Un sprinteur ne part pas debout. A « a vos marques », il est dans ses
  // blocs : genou arriere au sol, mains posees juste derriere la ligne,
  // epaules a l'aplomb des mains, pieds calés contre les pedales. A « prets »,
  // le bassin monte au-dessus des epaules, le genou avant se ferme a angle
  // droit, le poids passe sur les mains. Au coup de feu, il pousse.
  //
  // Les deux postures se donnent par ce qui TOUCHE : ou sont les chevilles
  // (sur les pedales, voir le bloc de tools/blender/decors), ou sont les
  // mains (sur la ligne), ou est le bassin. Les angles des membres ne sont
  // pas ecrits a la main — ils se deduisent par une cinematique inverse a deux
  // segments, avec les longueurs memes du rig. Changer la hauteur du bassin
  // ne peut donc pas decoller un pied de sa pedale ni une main du sol.
  //
  // Reperes en metres, x vers l'avant, 0 sur la ligne de depart, z en haut.
  const BLOC = {
    marques: { hanche: [-0.55, 0.45], buste: -1.42 },
    prets:   { hanche: [-0.46, 0.70], buste: -1.96 },
    // Les chevilles sur les pedales, les bouts des doigts sur la piste. La
    // cible de la main est le bout de l'OS, et la main depasse de l'os : elle
    // vise donc trois centimetres plus haut que la piste, pour que ce soit la
    // pulpe des doigts qui la touche et non le dos de la main qui s'y enfonce.
    piedAvant: [-0.56, 0.16], piedArriere: [-0.86, 0.19], main: [-0.03, 0.04],
    // le pied sur la pedale inclinee : pointe en bas, talon contre la plaque
    cheville: -0.80,
  };

  /**
   * Deux segments de longueurs a et b, du pivot (px, pz) jusqu'a (tx, tz).
   * Rend les deux angles absolus du rig (0 = vers le bas, positif = vers
   * l'avant). `devant` choisit le coude — ou le genou — qui pointe vers
   * l'avant.
   */
  function deuxSegments(px, pz, tx, tz, a, b, devant) {
    const dx = tx - px, dz = tz - pz;
    const d = Math.min(Math.max(Math.hypot(dx, dz), Math.abs(a - b) + 1e-4), a + b - 1e-4);
    const base = Math.atan2(dx, -dz);
    const c = (a * a + d * d - b * b) / (2 * a * d);
    const ouv = Math.acos(Math.max(-1, Math.min(1, c)));
    const t1 = devant ? base + ouv : base - ouv;
    const kx = px + a * Math.sin(t1), kz = pz - a * Math.cos(t1);
    return [t1, Math.atan2(tx - kx, -(tz - kz))];
  }

  const melange = (x, y, t) => x + (y - x) * t;

  // Jusqu'ou le buste penche sans emporter le bassin — en radians. La
  // course n'y arrive jamais (un quart de radian au plus), les blocs et les
  // haies le depassent largement. Voir pose().
  const PLI_TAILLE = 0.3;

  // ---------------------------------------------------------------------
  // PAR-DESSUS UNE HAIE
  // ---------------------------------------------------------------------
  // La posture du franchissement, du pied d'appel (t = 0) a la reception
  // (t = 1). Memes angles que le rig : 0 vers le bas, positif vers l'avant,
  // absolus. Chaque ligne : [t, valeurs...].
  //
  // LA JAMBE D'ATTAQUE part genou en avant, se tend au-dessus de la barre,
  // talon devant, pied releve, puis redescend tendue sous le bassin : c'est
  // elle qui se pose la premiere.
  //
  // LA JAMBE D'ESQUIVE est la seule qui sorte du plan de course. Poussee en
  // arriere a l'appel, elle s'ouvre ensuite sur le cote, cuisse a
  // l'horizontale et jambe repliee vers l'arriere, et revient genou haut
  // devant pour la foulee suivante. Le rig ne sait tourner un segment que
  // dans son plan ; l'ouverture passe donc par le LACET de chaque segment
  // (valeurs impaires ci-dessous : cuisse, jambe, pied), compte vers
  // l'exterieur de la hanche. Elle reste repliee a l'horizontale tant que le
  // pied n'a pas franchi le plan de la haie : la hanche passe a t = 0,6, le
  // pied, trente centimetres derriere elle, vers t = 0,75.
  //
  // LES BRAS croisent : celui qui est du cote de la jambe d'esquive part
  // loin devant et balaie vers l'arriere, l'autre reste replie. Le buste
  // plonge sur la haie — franchement : la vue du jeu raccourcit tout ce qui
  // penche vers l'avant, et a quarante degres il paraissait droit — puis se
  // redresse a la reception.
  const SAUT = {
    attaque: [[0, 0.95, -0.25, -0.10], [0.25, 1.60, 1.25, 1.40],
              [0.50, 1.45, 1.40, 1.55], [0.75, 0.75, 0.55, 0.70],
              [1, 0.12, 0.02, -0.20]],
    esquive: [[0, -0.40, 0, -0.50, 0, -0.90, 0],
              [0.30, -0.20, 0.40, -1.50, 0.10, -1.20, 0.10],
              [0.55, 1.45, 1.35, -1.57, 0, 0.30, 1.40],
              [0.74, 1.50, 1.05, -1.50, 0.15, 0.25, 1.10],
              [0.90, 1.25, 0.45, -0.55, 0.25, 0, 0.30],
              [1, 1.05, 0, -0.35, 0, -0.20, 0]],
    brasAvant: [[0, 1.20, 1.50], [0.40, 1.55, 1.65], [0.80, 0.60, 1.20], [1, 0.10, 1.00]],
    brasReplie: [[0, -0.55, 0.50], [0.50, -0.60, 0.40], [1, 0.30, 1.40]],
    buste: [[0, -0.40], [0.30, -0.95], [0.60, -0.90], [1, -0.35]],
  };

  /** Une ligne de SAUT a l'instant t, adoucie entre deux reperes. */
  function sautA(table, t) {
    let j = 0;
    while (j < table.length - 2 && t > table[j + 1][0]) j++;
    const a = table[j], b = table[j + 1];
    const f = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
    const e = f * f * (3 - 2 * f);
    const out = [];
    for (let i = 1; i < a.length; i++) out.push(melange(a[i], b[i], e));
    return out;
  }

  /** Un point du corps tourne autour de la verticale du coureur. */
  const lacer = (P, a) => [P[0] * Math.cos(a) - P[1] * Math.sin(a),
                           P[0] * Math.sin(a) + P[1] * Math.cos(a), P[2]];

  // ---------------------------------------------------------------------
  // SQUELETTE
  // ---------------------------------------------------------------------
  // Deux couleurs fixes, sorties de pose() : le rendu garde ses teintes en
  // cache par couleur, et un tableau recree a chaque image n'aurait jamais
  // ete retrouve dans ce cache — un dossard et un temoin repeints a chaque
  // frame pour rien, huit fois par course.
  // Chaque element : [couleur, pivot, angle, decalage, dimensions, lacet]
  // dimensions = [demi-x bas, demi-y bas, demi-x haut, demi-y haut, demi-h]
  const DOSSARD = [242, 242, 238];
  const SEMELLE = [236, 236, 232];
  const TEMOIN = [250, 206, 62];

  // ---------------------------------------------------------------------
  // DES MAINS
  // ---------------------------------------------------------------------
  //
  // Le rig s'arrete au bout des doigts — c'est la que les blocs posent la
  // main sur la piste, voir BLOC.main — mais l'avant-bras s'y terminait en
  // cone : un bras nu finissait en pointe de quille, et il fallait une
  // manche pour qu'une main soit dessinee du tout. En gros plan, un athlete
  // n'avait pas de mains.
  //
  // OU COMMENCE LA MAIN. L'os mesure porte le poignet a -20,6 cm du coude et
  // la main dans ce qui reste (tools/blender/anatomie.py). On coupe donc la
  // chaine mesuree au poignet, exactement comme la cuisse se coupe a
  // l'ourlet du short : l'avant-bras garde ses troncs, la main prend la
  // suite, et pas un volume ne se pose sur un autre — deux volumes coaxiaux
  // a la meme profondeur se departagent au millimetre, et une main enfilee
  // par-dessus le bout du bras en serait ressortie en manchon.
  //
  // LA MAIN D'UN SPRINTER EST PLATE, ET DE CHAMP. Paume tournee vers le
  // corps, pouce en l'air, doigts a peine fermes : ce qu'on voit d'elle,
  // c'est le dos de la main, large de huit centimetres dans le sens de la
  // course et epais de cinq. C'est aussi ce qui la distingue de tout le
  // reste du corps a cette taille-la — une section RELEVEE (MESURE), donc,
  // et non arrondie en moyenne comme les pieces ecrites a la main.
  //
  // Ce que la main et la chaussure donnent — au poignet, dans les blocs, en
  // tenue de ville, par-dessus une haie et aux trois niveaux de detail — se
  // regarde dans tools/apercu-mains-pieds.html.
  //
  // COMBIEN ELLE MESURE. Le dos de la main fait neuf centimetres et demi
  // dans le sens de la course et six d'epaisseur — une main de sprinter,
  // pas une main de mannequin. Elle depasse d'un centimetre et demi le bout
  // de l'os : l'os s'arrete a la derniere phalange PLIEE, les doigts fermes
  // vont un peu au-dela, et a la taille ou le jeu montre un coureur presente
  // ou une scenette, une main juste anatomique se lisait comme un moignon.
  const POIGNET = -0.20;     // hauteur de coupe, dans le repere du coude
  const DOIGTS = -0.291;     // le bout des doigts, un peu au-dela de l'os

  /**
   * La main au bout d'un avant-bras coupe au poignet.
   *
   * @param add  la fonction d'ajout de pose()
   * @param PREM le module des corps mesures, pour ses drapeaux de bout
   * @param niv  niveau de detail
   * @param E    le pivot du coude, dans le repere du corps
   * @param aF   l'angle de l'avant-bras — la main reste dans son axe
   * @param zPo  la hauteur locale ou la chaine s'est vraiment arretee
   * @param sec  la section mesuree de l'avant-bras a cette hauteur
   * @param peau la couleur de la peau, qui n'est pas celle d'une manche
   * @param k    le gabarit de bras de l'athlete
   * @param yaw  le lacet du buste
   */
  function mainDe(add, PREM, niv, E, aF, zPo, sec, peau, k, yaw) {
    const MESURE = PREM.MESURE, LIBRE = PREM.LIBRE;
    const SOUS_BAS = PREM.ENFOUI_BAS, SOUS_HAUT = PREM.ENFOUI_HAUT;
    const cb = sec[0];
    if (niv >= PREM.MOYEN) {
      // DES QUE LE COUREUR S'ELOIGNE, UN SEUL VOLUME : LE POING.
      //
      // Il coute exactement ce que coutait le tronc de chaine qu'il
      // remplace, et a quarante pixels le metre — l'echelle d'une course —
      // une main entiere mesure deux pixels : le pouce et les phalanges n'y
      // seraient qu'un supplement de calcul, huit fois par image.
      add(peau, E, aF, [cb + 0.008, 0, (zPo + DOIGTS) * 0.5, cb],
          [0.039 * k, 0.027 * k], [sec[1], sec[2]], (zPo - DOIGTS) * 0.5, yaw,
          MESURE | LIBRE | SOUS_HAUT);
      return;
    }
    // LES PHALANGES tombent aux trois cinquiemes de la main : au-dessus, le
    // dos de la main s'elargit depuis le poignet ; en dessous, les doigts se
    // referment. La main se creuse vers l'avant a mesure qu'on descend —
    // c'est le galbe d'une main qui se ferme, et il prolonge la cambrure de
    // l'avant-bras au lieu de repartir droit.
    const zK = zPo + (DOIGTS - zPo) * 0.48;
    add(peau, E, aF, [cb + 0.006, 0, (zPo + zK) * 0.5, cb],
        [0.048 * k, 0.031 * k], [sec[1], sec[2]], (zPo - zK) * 0.5, yaw,
        MESURE | SOUS_BAS | SOUS_HAUT);
    // ET LES DOIGTS SE COMPTENT.
    //
    // Un seul volume au bout de la paume donnait une moufle : le poing avait
    // la bonne taille et la bonne forme, mais rien ne disait qu'il etait fait
    // de doigts. Ils sont donc trois — pas quatre : a trois, chacun fait deux
    // centimetres et demi de large, ce qui est la largeur d'un vrai doigt, et
    // le quatrieme n'ajouterait qu'un volume de plus a payer huit fois par
    // image.
    //
    // Ils SE CHEVAUCHENT de deux millimetres : trois volumes poses cote a cote
    // sans se toucher laisseraient voir la piste entre eux des que la main
    // passe devant le vide, et un trait de stade en travers d'une main se voit
    // de loin. Ce qui les separe, ce n'est pas un jour, c'est la calotte de
    // chacun : trois bosses au bout, deux creux entre elles, et la main se lit
    // comme une main fermee plutot que comme un gant.
    // ILS NE FINISSENT PAS TOUS AU MEME ENDROIT. Trois doigts de meme
    // longueur font un rateau ; sur une main, le majeur depasse et les deux
    // autres suivent en arc. Sept millimetres suffisent — a cette taille,
    // c'est ce decalage qu'on lit, bien avant le jour entre deux doigts.
    const ecart = 0.026 * k, large = 0.018 * k;
    for (const [dx, court] of [[-ecart, 0.007], [0, 0], [ecart, 0.007]]) {
      const bout = DOIGTS + court;
      add(peau, E, aF, [cb + 0.014 + dx, 0, (zK + bout) * 0.5 + 0.003,
                        cb + 0.006 + dx * 0.92],
          [large, 0.026 * k], [large * 1.04, 0.030 * k],
          (zK - bout) * 0.5 + 0.003, yaw, MESURE | LIBRE | SOUS_HAUT);
    }
    // LE POUCE, ET POURQUOI IL EST LE MEME DES DEUX COTES. Paume vers le
    // corps, les deux pouces pointent vers l'AVANT, pas vers l'interieur :
    // ils n'ont donc pas de cote, et une seule piece sert aux deux mains.
    // Sans lui la main reste un galet ; avec lui, elle se lit comme une
    // main a la premiere image.
    const Po = [E[0] - zPo * Math.sin(aF), E[1], E[2] + zPo * Math.cos(aF)];
    add(peau, Po, aF + 0.42, [0.015, 0, -0.030], [0.015 * k, 0.014 * k],
        [0.020 * k, 0.018 * k], 0.030, yaw, MESURE | LIBRE | SOUS_HAUT);
  }

  // ---------------------------------------------------------------------
  // ET DES PIEDS
  // ---------------------------------------------------------------------
  //
  // La chaussure etait deux troncs ecrases, poses a plat sous la cheville,
  // et ecrits comme des ellipses de vingt centimetres sur neuf. Mais une
  // piece ecrite a la main sans le drapeau MESURE, le rendu l'arrondit en
  // MOYENNE : ces ellipses-la se dessinaient en disques de quatorze
  // centimetres. Les coureurs couraient sur deux boules.
  //
  // Un pied se construit donc dans SON axe, du talon vers la pointe, et non
  // dans celui de la jambe : le tronc va de l'arriere vers l'avant, sa
  // section porte l'epaisseur et la largeur, et il s'affine vers l'avant
  // comme un pied s'affine. La semelle claire porte, la tige colore ;
  // chacune est coupee au niveau de la plante, la ou un pied est le plus
  // large, parce qu'un seul cone ne peut pas etre etroit au talon, large a
  // la plante et etroit a la pointe.
  //
  // COMBIEN ELLE MESURE. Vingt-quatre centimetres du talon a la pointe et dix
  // de large a la plante, sur un corps d'un metre soixante-douze : la
  // proportion d'un vrai pied, et de quoi porter le coureur. Vingt-deux
  // centimetres, sa premiere taille, le faisaient courir en chaussons.
  //
  // REPERE LOCAL, une fois la piece tournee d'un quart de tour sur l'angle
  // de cheville : z va vers la POINTE, x va vers le BAS. La cheville du rig
  // est a 7,8 cm du sol, la semelle passe donc a 6,2 cm sous elle et touche
  // la piste. Tout le reste tourne avec l'angle de cheville — orteils
  // pointes sur les cales de depart, pied a plat a l'appui — sans que rien
  // ici n'ait a le savoir.
  const PIED = {
    talon: -0.068, plante: 0.058, pointe: 0.174,   // le long du pied
    sol: 0.062, releve: 0.057,                     // la semelle sous la cheville
  };

  /**
   * Chausser un pied.
   *
   * @param add  la fonction d'ajout de pose()
   * @param PREM le module des corps mesures, pour ses drapeaux de bout
   * @param An   la cheville, dans le repere du corps
   * @param ft   l'angle de cheville du rig (0 = jambe tendue, pied a plat)
   * @param yaw  le lacet de la jambe
   * @param col  la couleur de la chaussure
   * @param niv  niveau de detail
   */
  function chausser(add, PREM, An, ft, yaw, col, niv) {
    const MESURE = PREM.MESURE, LIBRE = PREM.LIBRE;
    const SOUS_BAS = PREM.ENFOUI_BAS, SOUS_HAUT = PREM.ENFOUI_HAUT;
    const a = ft - Math.PI / 2;
    const P = PIED, mi = (u, v) => (u + v) * 0.5, dm = (u, v) => (v - u) * 0.5;
    // UNE CALOTTE DEPASSE, ET IL FAUT LUI FAIRE LA PLACE.
    //
    // Le bout LIBRE d'un volume s'arrondit, et cet arrondi sort du volume :
    // d'un peu plus d'un demi-rayon (voir le rendu, `rond`). Un talon ecrit
    // a sa vraie place se terminait donc un centimetre et demi plus loin, en
    // bulbe, comme une chaussure a bout ferre ; et la semelle, finie a la
    // meme abscisse que la tige, ressortait devant elle en museau blanc.
    //
    // Chaque bout est donc RECULE de ce que sa calotte va rendre. La
    // chaussure occupe alors exactement la longueur qu'on lui a donnee, et la
    // semelle reste dessous : on ne la voit que par son liseret, comme sur
    // une vraie pointe d'athletisme.
    const avance = (hx, hy) => 0.275 * (hx + hy);
    // les sections des quatre bouts : talon et pointe, tige puis semelle
    const tT = [0.025, 0.028], tP = [0.013, 0.032];
    const sT = [0.012, 0.031], sP = [0.010, 0.037];
    const zTt = P.talon + avance(tT[0], tT[1]), zTp = P.pointe - avance(tP[0], tP[1]);
    const zSt = P.talon + 0.008 + avance(sT[0], sT[1]);
    const zSp = P.pointe - 0.014 - avance(sP[0], sP[1]);
    if (niv > PREM.PRES) {
      // De loin, une semelle et une tige, d'un seul tenant chacune : le pied
      // garde sa longueur et son profil de coin, il perd le galbe de la
      // plante. C'est le meme nombre de volumes qu'avant.
      add(SEMELLE, An, a, [P.sol, 0, mi(zSt, zSp), P.releve],
          sT, [0.011, 0.041], dm(zSt, zSp), yaw, MESURE | LIBRE);
      add(col, An, a, [0.031, 0, mi(zTt, zTp), 0.045],
          tT, [0.015, 0.035], dm(zTt, zTp), yaw, MESURE | LIBRE);
      return;
    }
    // LA SEMELLE. Elle deborde de deux millimetres sous la tige, tout du
    // long : c'est ce liseret clair qui fait une basket et non un chausson.
    // Et elle se releve a la pointe — un pied qui deroule ne pose jamais le
    // bout de sa semelle a plat.
    add(SEMELLE, An, a, [P.sol, 0, mi(zSt, P.plante), P.sol],
        sT, [0.013, 0.051], dm(zSt, P.plante), yaw,
        MESURE | LIBRE | SOUS_HAUT);
    add(SEMELLE, An, a, [P.sol, 0, mi(P.plante, zSp), P.releve],
        [0.013, 0.051], sP, dm(P.plante, zSp), yaw,
        MESURE | SOUS_BAS | LIBRE);
    // LA TIGE. Haute au talon — le contrefort remonte jusque sous la
    // cheville et cache le joint du mollet — basse sur les orteils.
    add(col, An, a, [0.030, 0, mi(zTt, P.plante), 0.036],
        tT, [0.022, 0.049], dm(zTt, P.plante), yaw,
        MESURE | LIBRE | SOUS_HAUT);
    add(col, An, a, [0.036, 0, mi(P.plante, zTp), 0.046],
        [0.022, 0.049], tP, dm(P.plante, zTp), yaw,
        MESURE | SOUS_BAS | LIBRE);
  }

  function pose(r, lod) {
    const L = r.look, fem = L.build === 'f';
    // `decalePas` n'avance que l'image, jamais le compte : voir haies-rendu.js.
    const p = r.stride + (r.decalePas || 0);
    const sp = Math.max(0, Math.min(1, r.v / (r.maxSpeed || 12)));
    const P = gaitOf(L);
    const A = 0.34 + 0.66 * sp;
    // OU L'ON EN EST DE LA SORTIE DES BLOCS : 1 au premier appui hors des
    // blocs, 0 une fois le corps redresse (TRANS_END). On le lit sur
    // l'inclinaison que le moteur tient deja plutot que de recalculer une
    // distance : les deux doivent s'eteindre ensemble, sans quoi le buste se
    // redresserait avant la jambe, ou l'inverse.
    //
    // DANS les blocs, rien : on n'y court pas, et la posture posee
    // (BLOC, plus bas) doit rester exactement ce qu'elle est.
    const wBloc = Math.max(0, Math.min(1, r.enBloc || 0));
    const sortie = Math.max(0, Math.min(1, (r.drivePitch || 0) / C.DRIVE_PITCH)) * (1 - wBloc);
    // `buste` penche le haut du corps a la demande (positif = en arriere) :
    // un prof qui attend, les reins cales, ne se tient pas comme un coureur.
    let lean = -(0.05 + 0.16 * sp) * P.lean + (r.buste || 0);
    const rot = (x, z, a) => [x * Math.cos(a) - z * Math.sin(a),
                              x * Math.sin(a) + z * Math.cos(a)];

    // Foulee plus marquee (genou plus haut, bras plus amples, buste plus
    // vivant). Le meme facteur s'applique a toute la chaine (cuisse ET
    // mollet, bras ET avant-bras) : amplifier seulement le premier
    // segment sans le second cassait l'effet d'entrainement naturel d'un
    // membre (le bout semblait trainer derriere le haut), ce qui donnait
    // une impression de mouvement disloque plutot que coordonne.
    const LIMB_BOOST = P.boost;
    function leg(q) {
      const th = gait(P.thigh, q) * (A + C.DRIVE_THIGH * sortie) * LIMB_BOOST;
      const kn = gait(P.knee, q) * (0.42 + 0.58 * A + C.DRIVE_KNEE * sortie) * LIMB_BOOST;
      // La cheville ne recoit pas la sortie : au depart le pied reste arme,
      // il ne fouette pas. L'amplifier donnait un coup de talon de patineur.
      const an = gait(P.ankle, q) * (0.50 + 0.50 * A) * LIMB_BOOST;
      return [th, th + kn, th + kn + an];
    }
    function arm(q) {
      const ua = gait(P.arm, q) * (0.55 + 0.45 * A + C.DRIVE_ARM * sortie)
                 * LIMB_BOOST * P.armAmp;
      const ef = gait(P.elbow, q) * (0.62 + 0.38 * A) * LIMB_BOOST;
      return [ua, ua + ef];
    }

    // cote +1 : jambe en phase p, donc bras cale en opposition sur cette
    // meme phase ; cote -1 : tout est decale d'un demi-cycle.
    const AP = armPhaseOf(P);
    let l = leg(p), rr = leg(p + Math.PI);
    let al = arm(p + AP), ar = arm(p + Math.PI + AP);
    const cel = r.celebrate || 0;
    if (cel > 0) {
      const ul = 2.55 + 0.22 * Math.sin(p * 0.8);
      const ur = 2.55 + 0.22 * Math.sin(p * 0.8 + 1.1);
      al = [al[0] * (1 - cel) + ul * cel, al[1] * (1 - cel) + (ul + 0.3) * cel];
      ar = [ar[0] * (1 - cel) + ur * cel, ar[1] * (1 - cel) + (ur + 0.3) * cel];
    }
    // DES BRAS QU'ON TIENT, PLUTOT QUE DES BRAS QUI COURENT.
    //
    // Le starter n'est pas un athlete : il se tient debout, le pistolet le
    // long du corps, puis le bras bien haut. `bras` impose donc l'angle des
    // deux bras — [gauche, droit, coude gauche, coude droit] — la ou
    // `celebrate` se contente de les lever ensemble.
    if (r.bras) {
      al = [r.bras[0], r.bras[0] + (r.bras[2] || 0.18)];
      ar = [r.bras[1], r.bras[1] + (r.bras[3] || 0.18)];
    }
    // PAR-DESSUS UNE HAIE. `saut` est pose par le rendu des haies, et par
    // lui seul (haies-rendu.js) : `t` va de l'appel a la reception, `w` est
    // le poids de la posture — il monte avant l'appel et redescend apres la
    // reception, pour que la foulee y entre et en sorte sans a-coup — et
    // `pied` est le cote de la jambe d'attaque. `haut` leve le bassin au
    // sommet du vol, en unites du rig.
    const saut = r.saut;
    const wS = saut ? Math.max(0, Math.min(1, saut.w)) : 0;
    let lacets = null, leve = 0;
    if (wS > 0) {
      const t = Math.max(0, Math.min(1, saut.t));
      const at = sautA(SAUT.attaque, t), es = sautA(SAUT.esquive, t);
      const ba = sautA(SAUT.brasAvant, t), bp = sautA(SAUT.brasReplie, t);
      const vers3 = (x, y) => [melange(x[0], y[0], wS), melange(x[1], y[1], wS),
                               melange(x[2], y[2], wS)];
      const vers2 = (x, y) => [melange(x[0], y[0], wS), melange(x[1], y[1], wS)];
      const jA = [at[0], at[1], at[2]], jE = [es[0], es[2], es[4]];
      const cA = saut.pied > 0 ? 1 : -1, cE = -cA;
      if (cA > 0) { l = vers3(l, jA); rr = vers3(rr, jE); al = vers2(al, bp); ar = vers2(ar, ba); }
      else { rr = vers3(rr, jA); l = vers3(l, jE); ar = vers2(ar, bp); al = vers2(al, ba); }
      lacets = { cote: cE, cuisse: cE * es[1] * wS, jambe: cE * es[3] * wS, pied: cE * es[5] * wS };
      lean = melange(lean, sautA(SAUT.buste, t)[0], wS);
      leve = (saut.haut || 0) * 4 * t * (1 - t);
    }

    // Moulinets de bras pendant la chute : les deux bras tournent en
    // opposition, bien plus vite que la foulee, comme quelqu'un qui essaie
    // de rattraper son equilibre.
    const fsh = fallShape(r.fallAnim);
    if (fsh && fsh.flail > 0.01) {
      const f = fsh.flail, w = (1 - r.fallAnim) * Math.PI * 5.4;
      const wl = 1.9 + 1.5 * Math.sin(w);
      const wr = 1.9 + 1.5 * Math.sin(w + 2.4);
      al = [al[0] * (1 - f) + wl * f, al[1] * (1 - f) + (wl + 0.55) * f];
      ar = [ar[0] * (1 - f) + wr * f, ar[1] * (1 - f) + (wr + 0.55) * f];
    }

    // DANS LES BLOCS. `enBloc` va de 0 (en course) a 1 (pose dans les blocs),
    // `prets` de 0 (a vos marques) a 1 (prets) ; le rendu les tient a jour
    // pendant le decompte et pendant la sortie des blocs (phaseBlocs,
    // sprinter-app.js). Tout ce qui balance en course — rebond, lacet,
    // roulis — s'efface a mesure qu'on est dans les blocs : on n'y bouge pas.
    const wB = Math.max(0, Math.min(1, r.enBloc || 0));
    const calme = (1 - wB) * (1 - wS);
    let hipX = 0, hipZ = null;
    if (wB > 0) {
      const t = Math.max(0, Math.min(1, r.prets || 0));
      const hx = melange(BLOC.marques.hanche[0], BLOC.prets.hanche[0], t);
      const hz = melange(BLOC.marques.hanche[1], BLOC.prets.hanche[1], t);
      const bu = melange(BLOC.marques.buste, BLOC.prets.buste, t);
      // les jambes : genou vers l'avant, cheville sur sa pedale
      const jA = deuxSegments(hx, hz - 0.02, BLOC.piedAvant[0], BLOC.piedAvant[1], 0.392, 0.380, true);
      const jR = deuxSegments(hx, hz - 0.02, BLOC.piedArriere[0], BLOC.piedArriere[1], 0.392, 0.380, true);
      // les bras : de l'epaule aux doigts poses sur la piste, coude en arriere
      const sx = hx - 0.470 * Math.sin(bu), sz = hz + 0.470 * Math.cos(bu);
      const br = deuxSegments(sx, sz, BLOC.main[0], BLOC.main[1], 0.25, 0.274, false);
      l = [melange(l[0], jA[0], wB), melange(l[1], jA[1], wB), melange(l[2], BLOC.cheville, wB)];
      rr = [melange(rr[0], jR[0], wB), melange(rr[1], jR[1], wB), melange(rr[2], BLOC.cheville, wB)];
      al = [melange(al[0], br[0], wB), melange(al[1], br[1], wB)];
      ar = [melange(ar[0], br[0], wB), melange(ar[1], br[1], wB)];
      lean = melange(lean, bu, wB);
      hipX = hx * wB;
      hipZ = hz;
    }

    const bob = -0.036 * A * Math.cos(2 * (p - 0.75)) * P.bob * calme;
    const yawHip = -0.16 * A * Math.sin(p) * calme;
    const yawTop = 0.21 * A * Math.sin(p) * calme;
    const sway = 0.016 * A * Math.sin(p) * calme;

    // Gabarit plus athletique qu'un mannequin filiforme : torse et epaules
    // elargis, cuisses epaisses qui s'affinent vers le mollet, bras avec
    // un vrai galbe biceps/avant-bras. Seules les largeurs changent, pas
    // les longueurs de segment (deja calees sur la taille du personnage).
    // Gabarit de base selon le sexe, puis retouches par athlete : epaules,
    // bassin, bras et cuisses se reglent independamment pour que chaque
    // silhouette soit reconnaissable de loin, avant meme la gestuelle.
    const MO = L.morph || EMPTY_MORPH;
    const shY = (fem ? 0.130 : 0.154) * (MO.sh || 1);
    const hipY = (fem ? 0.094 : 0.082) * (MO.hip || 1);
    const hip = [hipX, sway, (hipZ === null ? 0.87 + bob : melange(0.87 + bob, hipZ, wB)) + leve];
    const out = [];
    // LE DERNIER ARGUMENT DIT CE QUE DEVIENNENT LES BOUTS.
    //
    // Le rendu arrondit le bout d'un segment quand on le lui demande, et
    // seulement alors. Le squelette est le seul a savoir lequel merite de
    // l'etre : un crane, une main, une pointe de chaussure se terminent
    // dans le vide, tandis qu'une cuisse ou un buste s'emboitent dans le
    // segment suivant. Arrondir ces derniers leur ajoutait une calotte qui
    // sortait du corps — le buste portait une collerette au-dessus des
    // epaules, parfaitement visible sur l'ecran de presentation.
    //
    // `true` reste le bout libre d'autrefois. Les corps mesures y ajoutent
    // les bouts ENFOUIS, qui ne recoivent aucun disque : voir
    // coureur-premium.js.
    const add = (c, pv, a, o, hb, ht, hz, yaw, bout) =>
      out.push([c, pv, a, o, [hb[0], hb[1], ht[0], ht[1], hz], yaw || 0,
                bout === true ? 1 : (bout | 0)]);

    // LE CORPS VIENT DE BLENDER. Chaque os porte une suite de troncs de
    // cone dont l'epaisseur a ete relevee sur un maillage sculpte — un
    // sprinter en metaballs, converti en maillage, puis sonde par vingt-
    // quatre rayons a chaque hauteur — et non choisie a vue. La ou il y
    // avait deux ou trois troncs par membre, il y en a jusqu'a sept : le
    // ventre du biceps tombe au tiers superieur, la taille se pince sous les
    // cotes, le mollet est haut et court, la cheville fine, et le fessier
    // comme la poitrine debordent de l'os. Voir coureur-hd.js et
    // tools/blender/.
    //
    // Rien d'autre ne change : memes pivots, memes longueurs, memes angles.
    // C'est la seule raison pour laquelle ces coureurs-la courent dans le
    // virage comme les autres — personCapsules fait tourner des segments, et
    // un coureur mesure n'est fait que de segments.
    const PREM = root.SprinterPremium;
    const LIBRE = PREM.LIBRE, SOUS_BAS = PREM.ENFOUI_BAS, SOUS_HAUT = PREM.ENFOUI_HAUT;
    const PR = PREM.profils(fem);
    const niv = lod === undefined ? PREM.PRES : lod;
    const kSh = MO.sh || 1, kHip = MO.hip || 1;
    const kArm = MO.arm || 1, kLeg = MO.leg || 1;

    // LE BASSIN SUIT LE BUSTE QUAND CELUI-CI SE COUCHE.
    //
    // Le buste tourne autour de la hanche ; le bassin, lui, restait droit.
    // En course, le maillot descend assez bas sur le short pour que ce pli
    // ne se voie pas. Mais a vos marques, prets, ou par-dessus une haie, le
    // buste se couche et emporte le bas du maillot a vingt centimetres du
    // haut du short. Les deux bouts sont enfouis — sans disque — et le rendu
    // ne dessine pas l'interieur d'un tube : c'est la piste qu'on voyait au
    // creux des reins, et, de face, par tout le haut du short.
    //
    // Aucune piece posee dans ce pli ne le bouchait vraiment. Un raccord qui
    // tourne vers l'avant n'atteint jamais le bord arriere du short : on
    // continuait de voir la piste de face. Un dome referme sur le short la
    // cachait, mais se lisait comme un couvercle pose sur les fesses. Or
    // c'est l'anatomie qui etait fausse : un sprinteur dans ses blocs a le
    // bassin bascule avec le dos, et la cuisse plie a la hanche. Les pivots
    // des cuisses ne dependent pas du bassin : le tourner ne deplace aucune
    // jambe.
    //
    // En course, rien ne bouge : tant que le buste ne penche pas plus que
    // PLI_TAILLE, le bassin reste droit, comme avant. Au-dela, il suit
    // l'excedent. Dans les blocs et par-dessus une haie, il suit tout, et le
    // maillot recouvre le short comme buste droit. Entre les deux — l'entree
    // dans les blocs, la sortie, l'approche de la haie — il suit tout des le
    // premier tiers de la posture : couche aux deux tiers mais pas tout a
    // fait aligne, le bassin montrait deja un filet de piste de face. Le pli
    // ne depasse donc jamais PLI_TAILLE, et il est nul des que le buste
    // plonge vraiment.
    const wP = Math.min(1, 3 * Math.max(wB, wS));
    const angB = lean - Math.max(-PLI_TAILLE, Math.min(PLI_TAILLE, lean)) * (1 - wP);
    // L'ourlet du short se voit ; sa ceinture disparait sous le maillot.
    //
    // Couche, le bassin presente son fond a la camera. Un disque l'y
    // coupait net, en boite de conserve : il y prend une calotte, le
    // fessier. Droit, il garde son disque, comme avant — une chute, qui
    // pique tout le corps, le montre tel qu'il a toujours ete.
    PREM.chaine(add, PR, 'pelvis', niv, L.shorts, hip, angB, 0, yawHip, kHip,
                0, angB !== 0 ? LIBRE : 0, SOUS_HAUT);
    // Le maillot descend par-dessus la ceinture du short. Sans ce
    // recouvrement, le buste bascule en course et decouvre le haut du short
    // par l'arriere. Son bas est donc enfoui ; son haut garde un disque nu,
    // sans calotte — c'est elle qui faisait la collerette.
    PREM.chaine(add, PR, 'torso', niv, L.jersey, hip, lean, 0, yawTop, kSh,
                0, SOUS_BAS, 0);
    // LE MAILLOT S'EVASE SUR UN BASSIN PLUS LARGE QUE LUI.
    //
    // Chez les femmes, le haut du cuissard est plus large que le bas du
    // maillot, d'un centimetre de chaque cote. Buste droit, ce rebord
    // regarde le ciel et le buste le masque presque. Bassin couche, il
    // regarde la camera, et depuis l'avant on voyait la piste en croissant
    // entre le maillot et le cuissard.
    //
    // Le bas du maillot s'evase donc jusqu'a la section MESUREE du haut du
    // bassin, un rien plus large, sur le modele du raccord de genou : un
    // tronc dans l'axe du buste, dont le bas s'enfonce de deux centimetres
    // dans le cuissard et le haut se perd dans le buste. Pas de disque : les
    // deux bouts sont enfouis. Il n'apparait qu'a mesure que le bassin se
    // couche, et pas du tout quand le buste recouvre deja le bassin — chez
    // les hommes, c'est toujours le cas.
    const trP = PR.pelvis[niv], hautP = trP[trP.length - 1];
    const zP = hautP[0] + hautP[1];
    const [cP, pP, lP] = PREM.section(PR, 'pelvis', niv, zP, kHip);
    const [cT0, pT0, lT0] = PREM.section(PR, 'torso', niv, zP, kSh);
    const evase = Math.min(1, Math.abs(angB) / 0.5);
    if (evase > 0 && (pP > pT0 || lP > lT0)) {
      const [cT1, pT1, lT1] = PREM.section(PR, 'torso', niv, 0.14, kSh);
      const z0 = zP - 0.02;
      const pb = pT0 + (Math.max(pP, pT0) * 1.03 - pT0) * evase;
      const lb = lT0 + (Math.max(lP, lT0) * 1.03 - lT0) * evase;
      const cb = cT0 + (cP - cT0) * evase;
      add(L.jersey, hip, lean, [(cb + cT1) * 0.5, 0, (z0 + 0.14) * 0.5],
          [pb, lb], [pT1 * 0.97, lT1 * 0.97], (0.14 - z0) * 0.5,
          (yawHip + yawTop) * 0.5, PREM.MESURE | SOUS_BAS | SOUS_HAUT);
    }
    // Le dossard : un vrai kit d'athletisme plutot qu'un aplat uniforme. Il se
    // pose sur la peau MESUREE et non a une abscisse fixe — sinon il
    // s'enfonce dans un torse epais et flotte devant un torse mince.
    if (!L.civil) {
      // LE DOSSARD EST UNE FEUILLE, PAS UNE BOITE DE CONSERVE.
      //
      // Il etait decrit mince et large (1 cm sur 14), mais sans le drapeau
      // MESURE : le rendu arrondissait donc sa section en moyenne, et posait
      // devant la poitrine un cylindre blanc de dix centimetres de diametre.
      // En course, a trente pixels le metre, cela passait pour un dossard ; en
      // gros plan dans les scenettes, le coureur tenait une canette.
      //
      // La feuille garde maintenant sa section, et une section qui a la MEME
      // COURBURE que le torse sur le devant (demi-profondeur = largeur² x
      // profondeur du torse / largeur du torse²) : elle suit la poitrine a six
      // millimetres de la peau, et ses bords rentrent dans le corps au lieu de
      // flotter devant.
      const [cT, pT, lT] = PREM.section(PR, 'torso', niv, 0.352, kSh);
      const lB = Math.min(lT * 0.60, shY * 0.55);
      const pB = lT > 0 ? lB * lB * pT / (lT * lT) : 0.01;
      add(DOSSARD, hip, lean, [cT + pT + 0.006 - pB, 0, 0.352],
          [pB, lB], [pB, lB], 0.066, yawTop, PREM.MESURE);
      // LES DEUX BANDES VERTICALES NE SONT PLUS LA. Un trait de la couleur des
      // chaussures descendait au milieu du maillot, un autre au milieu du
      // short. A l'echelle de la course, un pixel d'accent ; en gros plan, la
      // premiere passait sous la feuille et en faisait un panneau plante sur
      // un piquet, la seconde un baton pendu a la ceinture.
    }
    const peauBras = L.manches || L.skin;
    const peauJambes = L.pantalon || L.skin;

    // Le deltoide : c'est lui qui fait la carrure. Son sommet garde un
    // disque nu — une calotte y posait un bouton clair sur l'epaule.
    for (const side of [1, -1]) {
      PREM.chaine(add, PR, 'deltoid', niv, peauBras, hip, lean, side * shY,
                  yawTop, kSh, 0, SOUS_BAS, 0);
    }
    PREM.chaine(add, PR, 'neck', niv, L.skin, hip, lean, 0, yawTop * 0.5, 1,
                0, SOUS_BAS, SOUS_HAUT);
    // LA TETE SE PENCHE AUTOUR DU COU, PAS DU BASSIN. `tete` l'incline
    // (negatif = vers l'avant, le nez dans un livre) : la tete, les cheveux,
    // les lunettes et les antennes tournent alors autour de la base du cou.
    // Sans ce pivot, incliner la tete revenait a pencher tout le haut du
    // corps depuis les hanches.
    const tete = r.tete || 0;
    const cou = rot(0, 0.52, lean);
    const pvT = tete ? [hip[0] + cou[0], hip[1], hip[2] + cou[1]] : hip;
    const angT = lean + tete, dzT = tete ? -0.52 : 0;
    const addT = (c, da, o, hb, ht, hz, yaw, bout) =>
      add(c, pvT, angT + da, [o[0], o[1], o[2] + dzT], hb, ht, hz, yaw, bout);
    // Le sommet du crane ne s'arrondit pas : les cheveux s'en chargent. Arrondi
    // lui aussi, il depassait de la calotte de cheveux, et la chevelure ne
    // formait plus qu'un anneau autour d'un crane nu.
    PREM.chaine(add, PR, 'head', niv, L.skin, pvT, angT, 0, yawTop * 0.2, 1,
                -bob * 0.55 + dzT, SOUS_BAS, 0);
    // des lunettes : deux verres minces devant les yeux
    if (L.lunettes) {
      for (const side of [1, -1]) {
        addT(L.lunettes, 0, [0.090, side * 0.036, 0.690], [0.005, 0.020],
             [0.005, 0.020], 0.016, yawTop * 0.2, PREM.MESURE);
      }
    }

    const hy = yawTop * 0.2, hc = L.hairCol;
    // LES CHEVEUX COIFFENT LE CRANE MESURE. Leurs rayons avaient ete regles
    // sur l'ancienne tete, plus etroite : sur le crane releve dans Blender,
    // la calotte ne le couvrait plus et la peau ressortait entre deux
    // bandes de cheveux. Dix pour cent de plus, et elle le coiffe.
    const addH = (da, o, hb, ht, hz, yaw, bout) =>
      addT(hc, da, o, [hb[0] * 1.10, hb[1] * 1.10], [ht[0] * 1.10, ht[1] * 1.10], hz, yaw, bout);
    switch (L.hair) {
      case 'shaved':
        addH(0, [-0.004, 0, 0.744], [0.076, 0.075], [0.070, 0.069],
            0.016, hy, true); break;
      case 'flattop':
        addH(0, [-0.004, 0, 0.772], [0.074, 0.074], [0.072, 0.072],
            0.048, hy, true); break;
      case 'fade':
        addH(0, [-0.006, 0, 0.752], [0.077, 0.077], [0.070, 0.070],
            0.030, hy, true);
        addH(0, [-0.058, 0, 0.690], [0.020, 0.070], [0.022, 0.072],
            0.046, hy, true); break;
      case 'bun':
        addH(0, [-0.006, 0, 0.756], [0.078, 0.078], [0.072, 0.072],
            0.034, hy, true);
        addH(0, [-0.084, 0, 0.742], [0.040, 0.044], [0.044, 0.048],
            0.044, hy, true); break;
      case 'ponytail':
        addH(0, [-0.006, 0, 0.754], [0.078, 0.078], [0.072, 0.072],
            0.032, hy, true);
        addH(0.22 * Math.sin(p) * A, [-0.104, 0, 0.674],
            [0.058, 0.032], [0.036, 0.022], 0.028, hy, true); break;
      case 'braids':
        addH(0, [-0.006, 0, 0.756], [0.078, 0.078], [0.072, 0.072],
            0.034, hy, true);
        for (const dy of [-0.044, 0, 0.044]) {
          addH(0.18 * Math.sin(p) * A, [-0.092, dy, 0.662],
              [0.046, 0.015], [0.030, 0.012], 0.018, hy, true);
        }
        break;
      default:
        addH(0, [-0.004, 0, 0.750], [0.077, 0.076], [0.072, 0.071],
            0.026, hy, true);
    }

    const sh = rot(0, 0.470, lean);
    /** Le poing du bras armé, garde pour y accrocher le pistolet. */
    let poing = null;
    /** Le poing qui porte le temoin, quand ce coureur l'a en main. */
    let main = null;
    /** La main qui tient le livre du prof. */
    let livre = null;
    for (const [side, aArm, aFore] of [[1, al[0], al[1]], [-1, ar[0], ar[1]]]) {
      const S = [hip[0] + sh[0], side * shY, hip[2] + sh[1]];
      // LE HAUT DU BRAS SE FERME, LUI AUSSI.
      //
      // Il entre dans le deltoide, et c'est le deltoide qui le cachait —
      // tant que le bras pend. Bras leve, ou ramene devant la poitrine,
      // l'epaule sortait du deltoide, et le tube ouvert montrait le fond du
      // stade par le haut du bras. Une calotte le referme : elle est de la
      // couleur du bras, donc de celle du deltoide qui l'entoure, et le
      // rendu ne la dessine que quand ce bout-la regarde la camera.
      PREM.chaine(add, PR, 'upperarm', niv, peauBras, S, aArm, 0, yawTop,
                  kArm * (L.manches ? 1.10 : 1), 0, 0, LIBRE);
      const e = rot(0, -0.250, aArm);
      const E = [S[0] + e[0], S[1], S[2] + e[1]];
      // LES ARTICULATIONS SE VOYAIENT.
      //
      // Deux troncs qui se rencontrent a un angle laissent une marche : le
      // bras finit a un rayon, l'avant-bras repart a un autre, dans une autre
      // direction. Une rotule sur le pivot avale les deux bouts. Elle prend
      // le plus epais des deux rayons MESURES a la jonction, un rien au-dela,
      // pour couvrir sans faire de bosse. Elle s'arrondit : un disque plat en
      // travers d'un coude ou d'un genou plie se lisait comme un coup de scie.
      const rCoude = Math.max(PREM.rayon(PR, 'upperarm', niv, 'bas', kArm),
                              PREM.rayon(PR, 'forearm', niv, 'haut', kArm)) * 1.06;
      add(peauBras, E, aFore, [0, 0, -0.012], [rCoude, rCoude], [rCoude, rCoude],
          0.026, yawTop, LIBRE);
      // L'AVANT-BRAS S'ARRETE AU POIGNET, ET LA MAIN PREND LA SUITE.
      //
      // Le bord de coupe se lit sur la chaine (voir `bord`) : il tombe plus
      // bas quand le corps est echantillonne grossierement, et la main le
      // rejoint la ou il est plutot que la ou on l'aurait cru. Son bout bas
      // n'est donc plus LIBRE — il ne s'arrondit plus en pointe de quille,
      // il est ENFOUI sous la main.
      //
      // Une manche s'arrete au meme endroit, et c'en est une vraie : le
      // poignet fait la fin de la manche, la main repart en peau. C'est ce
      // qui remplace la main-bouchon qu'on ne posait qu'aux habilles.
      const kAv = kArm * (L.manches ? 1.12 : 1);
      const zPo = PREM.bord(PR, 'forearm', niv, POIGNET);
      PREM.chaine(add, PR, 'forearm', niv, peauBras, E, aFore, 0, yawTop,
                  kAv, 0, SOUS_BAS, SOUS_HAUT, POIGNET);
      mainDe(add, PREM, niv, E, aFore, zPo,
             PREM.section(PR, 'forearm', niv, zPo, kAv), L.skin, kArm, yawTop);
      if (r.livre === side) livre = [E, aFore];
      if (r.pistolet === side) poing = [E, aFore];
      if (r.temoin === side) main = [E, aFore];
    }

    // LES ANTENNES.
    //
    // Deux tiges et deux bulbes au-dessus du crane, et c'est tout ce qu'il
    // faut : le reste de la silhouette est celle de n'importe qui, et c'est
    // justement ce qui rend la difference lisible d'un coup d'oeil. Sert au
    // starter du stade des ZEZE, qui n'est pas d'ici.
    if (r.antennes) {
      for (const dy of [-0.042, 0.042]) {
        addT(L.skin, 0, [-0.012, dy, 0.806], [0.011, 0.011],
             [0.008, 0.008], 0.058, hy);
        addT(r.antennes, 0, [-0.018, dy, 0.884], [0.026, 0.026],
             [0.024, 0.024], 0.016, hy, true);
      }
    }

    for (const [side, th, sk, ft] of [[1, l[0], l[1], l[2]],
                                      [-1, rr[0], rr[1], rr[2]]]) {
      let H = [hip[0], side * hipY, hip[2] - 0.02];
      // UNE JAMBE QUI S'OUVRE SUR LE COTE. Le rendu tourne chaque segment
      // autour de la verticale DU COUREUR, pas de sa propre articulation : un
      // segment tourne de son lacet emporte donc son pivot avec lui. On le
      // lui rend en le tournant d'avance en sens inverse, apres avoir place
      // le genou et la cheville la ou le lacet de la cuisse et de la jambe
      // les mettent. Sans ouverture, cette branche ne sert pas, et la jambe
      // est construite comme elle l'a toujours ete.
      let yT = yawHip, yS = yawHip, yF = yawHip, Kp = null, Ap = null;
      if (lacets && lacets.cote === side) {
        yT = yawHip + lacets.cuisse;
        yS = yawHip + lacets.jambe;
        yF = yawHip + lacets.pied;
        const Hw = lacer(H, yawHip);
        const kv0 = rot(0, -0.392, th), a0 = rot(0, -0.380, sk);
        const dk = lacer([kv0[0], 0, kv0[1]], yT);
        const Kw = [Hw[0] + dk[0], Hw[1] + dk[1], Hw[2] + dk[2]];
        const da = lacer([a0[0], 0, a0[1]], yS);
        const Aw = [Kw[0] + da[0], Kw[1] + da[1], Kw[2] + da[2]];
        H = lacer(Hw, -yT);
        Kp = lacer(Kw, -yS);
        Ap = lacer(Aw, -yF);
      }
      // un pantalon tombe plus large que la jambe qu'il habille
      const kPant = L.pantalon ? 1.10 : 1;
      // LE VETEMENT EST LE HAUT DE LA CUISSE, IL N'EST PAS POSE DESSUS.
      //
      // Un short d'athletisme masculin a des jambes, et elles se levent avec
      // le genou : la jambe de short est donc accrochee au pivot de la
      // cuisse et suit son angle, comme un vetement porte et non comme un
      // anneau pose sur le bassin. Mais elle ne peut pas etre un SECOND cone
      // un peu plus large autour du premier : deux volumes coaxiaux a la
      // meme profondeur se departagent au millimetre, et le short
      // ressortait en travers de la cuisse — deux lanieres noires et un
      // eperon a la hanche des que le genou montait.
      //
      // La cuisse est donc COUPEE a l'ourlet : les troncs du haut sont
      // dessines en couleur de short, ceux du bas en couleur de peau. Meme
      // os, memes mesures, un seul volume — la couleur change en cours de
      // route, et l'ourlet est exactement le joint entre deux troncs. Rien
      // ne se recouvre, donc rien ne peut ressortir.
      //
      // OU TOMBE L'OURLET. Au tiers de la cuisse pour un short d'homme. Pour
      // un cuissard de femme, au premier joint sous la hanche : le vetement
      // reste le volume du bassin, comme avant, et cette bande-la ne sert
      // qu'a fermer le haut de la cuisse. Un pantalon habille toute la
      // jambe, de la meme couleur que la ceinture : la coupure ne se voit
      // pas.
      const ourlet = (!fem && !L.pantalon) ? -0.156 : 0;
      // ET LES DEUX BOUTS DE LA CUISSE SE FERMENT.
      //
      // Le haut de la cuisse mesuree est le fessier : une ellipse de vingt-
      // quatre centimetres, ouverte, que le bassin cachait tant que la jambe
      // restait sous lui. Des que la hanche s'ouvre ou que le genou monte,
      // cette ouverture sortait du short — et le rendu ne dessine pas
      // l'interieur d'un tube : c'est la piste qu'on voyait en pleine
      // cuisse, en coin, entre le short et la jambe. En bas, meme histoire au
      // genou : la rotule couvre le joint quand la jambe est tendue, pas
      // quand elle se replie au point d'ecarter les deux os.
      //
      // Une calotte ferme chaque bout. Elle se dessine a la couleur de sa
      // chaine, et c'est tout l'interet d'avoir coupe la cuisse a l'ourlet :
      // celle du haut est de la couleur du short, qui l'entoure de partout,
      // celle du bas de la couleur de la peau, comme la rotule du genou. Un
      // simple disque suffisait a boucher, mais un disque est plat : il
      // prenait la lumiere d'un seul coup et se lisait comme un couvercle
      // pose sur la hanche.
      PREM.chaine(add, PR, 'thigh', niv, L.shorts, H, th, 0, yT, kLeg * kPant,
                  0, SOUS_BAS, LIBRE, ourlet);
      PREM.chaine(add, PR, 'thigh', niv, peauJambes, H, th, 0, yT, kLeg * kPant,
                  0, LIBRE, SOUS_HAUT, undefined, ourlet);
      const kv = rot(0, -0.392, th);
      const K = Kp || [H[0] + kv[0], H[1], H[2] + kv[1]];
      const rGenou = Math.max(PREM.rayon(PR, 'thigh', niv, 'bas', kLeg),
                              PREM.rayon(PR, 'shank', niv, 'haut', kLeg)) * 1.04;
      add(peauJambes, K, sk, [0, 0, -0.020], [rGenou * kPant, rGenou * kPant],
          [rGenou * kPant, rGenou * kPant], 0.034, yS, LIBRE);
      PREM.chaine(add, PR, 'shank', niv, peauJambes, K, sk, 0, yS,
                  kLeg * (L.pantalon ? 1.18 : 1), 0, 0, SOUS_HAUT);
      const a = rot(0, -0.380, sk);
      const An = Ap || [K[0] + a[0], K[1], K[2] + a[1]];
      chausser(add, PREM, An, ft, yF, L.shoe, niv);
    }

    // LE LIVRE DU PROF, OUVERT DANS SA MAIN.
    //
    // Il part de la main et monte, incline d'une trentaine de degres : c'est
    // l'angle d'un livre qu'on lit debout. Tenu dans le prolongement de
    // l'avant-bras, il se couchait a plat comme un plateau. La couverture
    // regarde la camera, les pages le lecteur — deux plaques minces, dont la
    // section aplatie (MESURE) fait un livre et non un rouleau. Pose AVANT le
    // pistolet, qui doit rester la derniere capsule.
    if (livre) {
      const [E, aF] = livre;
      const h = rot(0, -0.262, aF);
      const main = [E[0] + h[0], E[1], E[2] + h[1]];
      const aL = Math.PI - 0.55;                 // vers le haut, le haut du livre en avant
      const COUV = r.livreCol || [168, 44, 52], PAGES = [244, 238, 222];
      // Un grand livre, a dessein : a la taille ou le jeu montre le prof, un
      // livre de poche ne se lisait pas.
      add(PAGES, main, aL, [0.008, 0, -0.120], [0.016, 0.094], [0.016, 0.094],
          0.118, yawTop, PREM.MESURE);
      add(COUV, main, aL, [-0.012, 0, -0.120], [0.007, 0.102], [0.007, 0.102],
          0.126, yawTop, PREM.MESURE);
    }

    // LE PISTOLET DU STARTER, DANS LE PROLONGEMENT DE L'AVANT-BRAS.
    //
    // C'est ce qui lui donne son geste sans qu'on ait rien a animer de plus :
    // bras le long du corps, l'arme pend vers le sol ; bras leve, elle vise le
    // ciel. Un vrai starter ne fait pas autre chose.
    //
    // ELLE EST AJOUTEE EN DERNIER, ET C'EST UN CONTRAT : le rendu prend la
    // derniere capsule pour savoir ou allumer l'eclair du coup de feu — voir
    // `drawStarter` dans sprinter-app.js.
    if (poing) {
      const [M, a] = poing;
      // Une crosse sombre et un canon d'acier : sur un short bleu nuit, une
      // arme entierement noire ne se voit pas, et c'est pourtant la seule
      // chose que le joueur doit repérer dans la main du starter.
      const CROSSE = [38, 40, 50], CANON = [176, 182, 196];
      add(CROSSE, M, a, [0.030, 0, -0.300], [0.022, 0.018], [0.026, 0.020],
          0.034, yawTop);
      add(CANON, M, a, [-0.004, 0, -0.378], [0.015, 0.014], [0.018, 0.016],
          0.066, yawTop);
    }

    // LE TEMOIN, DANS LA MAIN DU PORTEUR.
    //
    // Il n'existait pas. Le relais se jouait sur un objet qu'on ne voyait
    // jamais : deux coureurs se croisaient, un chiffre changeait de ligne, et
    // rien a l'ecran ne disait que quelque chose etait passe d'une main a
    // l'autre. C'est pourtant la seule piece du mode.
    //
    // Il chevauche le poing — trente centimetres, comme le vrai — plutot que
    // de prolonger l'avant-bras comme le pistolet du starter : un baton tenu
    // par son milieu se lit tout de suite comme un baton, et non comme une
    // rallonge du bras. Jaune vif : sur une piste bleue et un maillot sombre,
    // c'est la couleur qui accroche l'oeil de loin.
    if (main) {
      const [M, a] = main;
      add(TEMOIN, M, a, [0.010, 0, -0.300], [0.019, 0.019], [0.019, 0.019],
          0.085, yawTop, true);
    }
    return out;
  }

  const CUBE = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
                [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const FACES = [[[0, 3, 2, 1], [0, 0, -1]], [[4, 5, 6, 7], [0, 0, 1]],
                 [[0, 4, 7, 3], [-1, 0, 0]], [[1, 2, 6, 5], [1, 0, 0]],
                 [[0, 1, 5, 4], [0, -1, 0]], [[3, 7, 6, 2], [0, 1, 0]]];
  const LIGHT = (function () {
    const v = [-0.42, 0.28, 0.86];
    const n = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / n, v[1] / n, v[2] / n];
  })();

  root.SprinterCore = {
    TAU, C, RACES, LEVELS, STADES_HORS_SERIE,
    GAIT, GAITS, gaitOf, gait, catmull, Track, Runner,
    pose, fallShape, alea, semer, desemer, estSeme,
    ZEZE, PLAYER_LOOK, lookFor, look, CUBE, FACES, LIGHT, SKIN, SKIN_POOL
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
