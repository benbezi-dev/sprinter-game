/* -----------------------------------------------------------------------
   SPRINTER — textes en francais et en anglais.
   Source unique : la version Python est generee a partir de ce fichier.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  // ------------------------------------------------------------ interface
  const UI = {
    // ouverture et accueil
    races:        ['100 METRES   -   200 METRES', '100 METRES   -   200 METRES'],
    tagline:      ['six etapes, un seul chrono a battre',
                   'six stages, one clock to beat'],
    tap_start:    ["touche l'ecran pour commencer", 'tap the screen to start'],
    six_stages:   ['   -   six etapes', '   -   six stages'],
    best_runs:    ['MEILLEURS PARCOURS', 'BEST RUNS'],
    no_run:       ["aucun parcours termine pour l'instant", 'no run finished yet'],
    furthest:     ['etape la plus loin : ', 'furthest stage: '],
    of_six:       [' sur 6', ' of 6'],
    start:        ['COMMENCER', 'START'],
    sound:        ['son : ', 'sound: '],
    yes:          ['oui', 'yes'],
    no:           ['non', 'no'],

    // cinematiques
    rival:        ['LE COUREUR A BATTRE', 'THE ONE TO BEAT'],
    favourite:    ['Le favori', 'The favourite'],
    after_race:   ['APRES LA COURSE', 'AFTER THE RACE'],
    crowned:      ['SACRE INTER GALACTIQUE', 'INTERGALACTIC TITLE'],
    fastest_1:    ["L'ETRE LE PLUS RAPIDE", 'THE FASTEST BEING'],
    fastest_2:    ['DE TOUTES LES GALAXIES', 'IN EVERY GALAXY'],
    full_run_in:  ['parcours complet en ', 'full run in '],
    announced:    ['chrono annonce : ', 'announced time: '],
    stage_up:     ['ETAPE ', 'STAGE '],
    six_cleared:  ['SIX ETAPES FRANCHIES', 'SIX STAGES CLEARED'],
    skip_now:     ['touche a nouveau pour passer', 'tap again to skip'],
    skip_twice:   ['touche deux fois pour passer', 'tap twice to skip'],

    // depart et phases de course
    reaction:     ['REACTION', 'REACTION'],
    react_top:    ['REACTION PARFAITE', 'PERFECT REACTION'],
    false_start:  ['PARTI TROP TOT', 'WENT TOO EARLY'],
    wait_gun:     ['attends le signal', 'wait for the gun'],
    phase_drive:  ['POUSSEE', 'DRIVE'],
    phase_trans:  ['TRANSITION', 'TRANSITION'],
    phase_max:    ['VITESSE MAX', 'TOP SPEED'],
    drive_hint:   ['monte la cadence', 'build your cadence'],
    trans_2:      ['TRANSITION PARFAITE', 'PERFECT TRANSITION'],
    trans_1:      ['BONNE TRANSITION', 'GOOD TRANSITION'],
    trans_0:      ['TRANSITION RATEE', 'TRANSITION MISSED'],
    start_line:   ['depart : reaction {r} s   -   {g}',
                   'start: {r} s reaction   -   {g}'],
    no_start:     ['depart manque', 'start missed'],

    // course
    stumble:      ['TU TREBUCHES', 'YOU STUMBLE'],
    to_beat:      ['a battre : ', 'to beat: '],
    ready:        ['A VOS MARQUES', 'READY'],
    get_set:      ['PRETS', 'GET SET'],
    go:           ['PARTEZ', 'GO'],
    alternate:    ['alterne les deux touches', 'alternate the two buttons'],
    alternate_kb: ['alterne les deux fleches', 'alternate the two arrows'],
    you:          ['TOI', 'YOU'],
    depart:       ['DEPART', 'START'],
    arrivee:      ['ARRIVEE', 'FINISH'],

    // resultats
    stage_done:   ['ETAPE {n} FRANCHIE', 'STAGE {n} CLEARED'],
    first_in:     ['1re place en ', '1st place in '],
    total_of:     [' s   -   cumul ', ' s   -   total '],
    place:        ['{o} PLACE', '{o} PLACE'],
    dnf:          ['abandon', 'did not finish'],
    unfinished:   ['non termine', 'unfinished'],
    race_again:   ['RECOMMENCER ?', 'RACE AGAIN?'],
    next_stage:   ['ETAPE {n}', 'STAGE {n}'],
    home:         ['ACCUEIL', 'HOME'],
    replay:       ['REJOUER', 'PLAY AGAIN'],
    run_done:     ['PARCOURS TERMINE', 'RUN COMPLETE'],
    six_in:       ['six etapes franchies en ', 'six stages cleared in '],
    stage_low:    ['etape ', 'stage '],

    // badges
    new_record:   ['NOUVEAU RECORD', 'NEW RECORD'],
    top3:         ['TOP 3', 'TOP 3'],
    top10:        ['TOP 10', 'TOP 10'],
    best_run:     ['MEILLEUR PARCOURS', 'BEST RUN'],
    top3_runs:    ['TOP 3 DES PARCOURS', 'TOP 3 RUNS'],
    top10_runs:   ['TOP 10 DES PARCOURS', 'TOP 10 RUNS'],

    // ---- version bureau, au clavier ----
    composing:    ['composition de la bande-son...', 'composing the soundtrack...'],
    sound_off:    ['SON COUPE  (S)', 'SOUND OFF  (S)'],
    press_enter:  ['appuie sur ENTREE', 'press ENTER'],
    skip_now_kb:  ['ENTREE a nouveau pour passer', 'press ENTER again to skip'],
    skip_twice_kb:['ENTREE deux fois pour passer', 'press ENTER twice to skip'],
    stage_dash:   ['ETAPE {n}   -   {s}', 'STAGE {n}   -   {s}'],
    furthest_kb:  ['etape la plus loin atteinte : {a} sur {b}',
                   'furthest stage reached: {a} of {b}'],
    enter_start:  ['ENTREE : lancer   -   S : son   -   L : langue   -   ECHAP : quitter',
                   'ENTER: start   -   S: sound   -   L: language   -   ESC: quit'],
    how_to_play:  ['COMMENT JOUER', 'HOW TO PLAY'],
    help_1:       ['Alterne  <-  et  ->  sans repeter',
                   'Alternate  <-  and  ->  without'],
    help_2:       ['la meme touche.', 'repeating the same key.'],
    help_3:       ['Une cadence reguliere fait monter',
                   'A steady rhythm builds up speed;'],
    help_4:       ['la vitesse ; une repetition fait',
                   'a repeat makes you stumble, but'],
    help_5:       ['trebucher, mais on peut repartir.',
                   'you can always get going again.'],
    best_stage:   ["MEILLEURS CHRONOS DE L'ETAPE", 'BEST TIMES FOR THIS STAGE'],
    no_time:      ['aucun chrono enregistre', 'no time recorded yet'],
    arrows_pick:  ['fleches pour choisir   -   ENTREE pour valider   -   ',
                   'arrows to choose   -   ENTER to confirm   -   '],
    yn_short:     ['O / N en raccourci', 'Y / N shortcut'],
    you_beat:     ['Tu as battu {w} et traverse les six etapes.',
                   'You beat {w} and cleared all six stages.'],
    the_zeze:     ['les ZEZE', 'the ZEZE'],
    your_times:   ['TES CHRONOS', 'YOUR TIMES'],
    total:        ['TOTAL', 'TOTAL'],
    enter_replay: ['ENTREE : refaire un parcours      M : accueil',
                   'ENTER: run again      M: home'],
    stumble_kb:   ['TU TREBUCHES !', 'YOU STUMBLE!'],
    go_kb:        ['PARTEZ !', 'GO!'],
    to_beat_line: ['A BATTRE :  {n}   -   {s} s', 'TO BEAT:  {n}   -   {s} s'],
    best_times_of:['MEILLEURS CHRONOS  -  {s}', 'BEST TIMES  -  {s}'],
    enter_next:   ['ENTREE   ->   ETAPE {n} : {s}', 'ENTER   ->   STAGE {n}: {s}'],
    full_run_pc:  ['parcours complet en {s} s', 'full run in {s} s'],
    announced_pc: ['chrono annonce : {s} s', 'announced time: {s} s'],
    quit:         ['ECHAP : quitter', 'ESC: quit']
  };

  const LEVEL_NAMES = [
    ['Competition scolaire', 'School meeting'],
    ['Niveau regional', 'Regional level'],
    ['Niveau national', 'National level'],
    ['Championnat du monde', 'World Championships'],
    ['Jeux olympiques', 'Olympic Games'],
    ['Inter galactique', 'Intergalactic']
  ];

  const RACE_SUB = {
    '100': ['la ligne droite', 'the straight'],
    '200': ['virage et ligne droite', 'bend and straight']
  };

  // ----------------------------------------------------- presentations
  // Trois variantes par etape et par moment, dans les deux langues.
  const CUT_INTRO = [
    [ // etape 1
      [["{n} gagne toutes les courses de la recreation depuis trois ans.",
        "Son secret : personne n'ose le doubler, il a le ballon.",
        "Il s'echauffe en chaussures de ville, par principe.",
        "Sa mere filme depuis le grillage. Elle filme surtout le grillage."],
       ["{n} has won every playground race for three years.",
        "His secret: nobody dares overtake him, he owns the ball.",
        "He warms up in school shoes, on principle.",
        "His mother films from behind the fence. Mostly the fence."]],
      [["{n} detient le record de l'ecole, ecrit au marqueur sur le gymnase.",
        "Le chrono avait ete pris par un camarade, sur une montre a aiguilles.",
        "Le prof de sport a valide d'un hochement de tete. C'est officiel.",
        "Depuis, on repeint le mur en contournant le record."],
       ["{n} holds the school record, written in marker on the gym wall.",
        "A classmate timed it, on a watch with hands.",
        "The PE teacher nodded once. That made it official.",
        "They now repaint the wall around the record."]],
      [["{n} a reclame le couloir 4. On lui a donne le couloir 4.",
        "Il fait ses gammes : montees de genoux, talons-fesses, soupirs.",
        "Son dossard a ete imprime a la maison, un peu de travers.",
        "Le numero est 1. Il n'avait pas beaucoup d'autres options."],
       ["{n} asked for lane 4. He was given lane 4.",
        "He runs his drills: high knees, heel flicks, deep sighs.",
        "His bib was printed at home, slightly crooked.",
        "The number is 1. He printed it himself, alone."]]
    ],
    [ // etape 2
      [["{n} s'echauffe depuis quatre heures.",
        "Son survetement porte son nom brode dans le dos, en majuscules.",
        "Il a un rituel : trois pas en arriere, un souffle, un clin d'oeil.",
        "Le clin d'oeil ne s'adresse a personne en particulier."],
       ["{n} has been warming up for four hours.",
        "His tracksuit has his name embroidered on the back, in capitals.",
        "He has a ritual: three steps back, one breath, a wink.",
        "The wink is not aimed at anyone in particular."]],
      [["{n} arrive avec deux paires de pointes et une glaciere.",
        "La glaciere contient une banane et beaucoup de determination.",
        "Il pose ses starting-blocks au millimetre, puis les repose.",
        "Puis une troisieme fois. Le starter attend, poliment."],
       ["{n} arrives with two pairs of spikes and a cool box.",
        "The cool box holds one banana and a great deal of resolve.",
        "He sets his blocks to the millimetre, then resets them.",
        "Then a third time. The starter waits, politely."]],
      [["{n} a fini deuxieme du regional l'an dernier.",
        "Il en parle comme d'une victoire volee par un vent de face.",
        "Le releve officiel indiquait vent nul. Il conteste le releve.",
        "Il a apporte son anemometre. Il ne sait pas s'en servir."],
       ["{n} finished second at regionals last year.",
        "He describes it as a win stolen by a headwind.",
        "The official reading said no wind. He disputes the reading.",
        "He brought his own anemometer. He cannot work it."]]
    ],
    [ // etape 3
      [["{n} est passe a la television regionale.",
        "Trente-huit secondes de sujet. Il les a revues six cents fois.",
        "Il signe des autographes avant la course, par gain de temps.",
        "Sur des tickets de caisse, faute de mieux."],
       ["{n} has been on regional television.",
        "Thirty-eight seconds of coverage. He has watched it six hundred times.",
        "He signs autographs before the race, to save time.",
        "On till receipts, for want of anything better."]],
      [["{n} a un surnom que personne n'utilise : la Fleche du Nord.",
        "Il le glisse lui-meme dans chacune de ses interviews.",
        "Le speaker vient de l'annoncer sous son vrai nom, par erreur.",
        "Il a demande une rectification au micro. Elle viendra apres."],
       ["{n} has a nickname nobody uses: the Northern Arrow.",
        "He slips it into every interview himself.",
        "The announcer just introduced him by his real name, by mistake.",
        "He has asked for a correction over the PA. It will come later."]],
      [["{n} s'est fait tatouer son record personnel sur l'avant-bras.",
        "Il le montre au ralenti pendant la presentation des athletes.",
        "Quatre coureurs de cette finale ont deja fait mieux que ce chiffre.",
        "Le tatouage, lui, ne se rattrape pas."],
       ["{n} had his personal best tattooed on his forearm.",
        "He shows it in slow motion during the athlete presentation.",
        "Four runners in this final have already beaten that number.",
        "The tattoo, unfortunately, does not update."]]
    ],
    [ // etape 4
      [["{n} a un sponsor, un agent et un kinesitherapeute.",
        "Tous les trois lui repetent qu'il est imbattable. Il les paie.",
        "Son agent a deja reserve la salle de la conference de victoire.",
        "Le buffet est commande. Il y a des petits fours."],
       ["{n} has a sponsor, an agent and a physiotherapist.",
        "All three tell him he is unbeatable. He pays all three.",
        "His agent has already booked the room for the victory conference.",
        "The catering is ordered. There are canapes."]],
      [["{n} est numero un mondial depuis onze mois.",
        "Il l'a appris en direct et n'a plus jamais regarde en arriere.",
        "Litteralement : son kine le lui a formellement deconseille.",
        "Il tourne desormais tout le buste. C'est plus lent, mais c'est net."],
       ["{n} has been world number one for eleven months.",
        "He found out live on air and never looked back since.",
        "Literally: his physio strongly advised against it.",
        "He now turns his whole torso. Slower, but it does look sharp."]],
      [["Le speaker annonce {n}. Le stade se leve.",
        "Il tend le bras vers la tribune, puis vers le ciel, puis la camera.",
        "La camera etait sur un autre athlete. Il recommence tout.",
        "Le realisateur cede. Le geste durera onze secondes."],
       ["The announcer calls {n}. The stadium rises.",
        "He points at the stand, then at the sky, then at the camera.",
        "The camera was on another athlete. He starts the whole thing again.",
        "The director gives in. The gesture will run eleven seconds."]]
    ],
    [ // etape 5
      [["{n} repete son geste de celebration depuis huit mois.",
        "Il l'a fait breveter. Il ne reste plus qu'a gagner la course.",
        "Une chorale de quarante personnes attend son signal.",
        "Elles ont appris un chant. Le chant dit son nom, longtemps."],
       ["{n} has been rehearsing his celebration for eight months.",
        "He has had it trademarked. All that is left is winning the race.",
        "A choir of forty is waiting for his signal.",
        "They learned a song. The song says his name, at length."]],
      [["{n} porte les couleurs de son pays, et il y tient beaucoup.",
        "Le drapeau est sur les pointes, sur le dossard et sur la serviette.",
        "La serviette ne court pas, mais elle est prete depuis mardi.",
        "Un membre du staff la suit partout depuis la ceremonie."],
       ["{n} wears his national colours, and cares deeply about it.",
        "The flag is on the spikes, on the bib and on the towel.",
        "The towel does not race, but it has been ready since Tuesday.",
        "A staff member has carried it everywhere since the opening ceremony."]],
      [["{n} a jure de ne pas regarder ses adversaires dans les blocs.",
        "Il fixe donc droit devant lui, avec une intensite remarquable.",
        "Un peu trop devant : il a fixe le mur pendant la presentation.",
        "Le mur n'est pas qualifie pour cette finale."],
       ["{n} swore he would not look at his rivals in the blocks.",
        "So he stares straight ahead, with remarkable intensity.",
        "A little too far ahead: he stared at the wall during introductions.",
        "The wall did not qualify for this final."]]
    ],
    [ // etape 6
      [["{n} vient d'un univers ou la gravite est une option.",
        "Il termine ses courses avant d'avoir decide de partir.",
        "Son record est detenu dans onze dimensions simultanement.",
        "Dans la douzieme il a trebuche, mais on n'en parle pas."],
       ["{n} comes from a universe where gravity is optional.",
        "He finishes his races before deciding to start them.",
        "His record is held in eleven dimensions at once.",
        "In the twelfth he tripped, but nobody brings that up."]],
      [["{n} a couru ce cent metres dans onze univers paralleles.",
        "Il l'a gagne onze fois. Le douzieme n'a pas ete homologue.",
        "Le juge d'arrivee y etait une nebuleuse, peu fiable sur la ligne.",
        "La nebuleuse a pris trois saisons de suspension."],
       ["{n} has run this hundred metres in eleven parallel universes.",
        "He won all eleven. The twelfth was never ratified.",
        "The finish judge there was a nebula, unreliable on the line.",
        "The nebula was banned for three seasons."]],
      [["La famille ZEZE occupe les sept couloirs. C'est reglementaire.",
        "Ils ont apporte leur starter, leur vent et leur ligne d'arrivee.",
        "Le reglement a ete redige par un ZEZE, puis relu par un ZEZE.",
        "Il tient en une phrase : un ZEZE gagne."],
       ["The ZEZE family occupies all seven lanes. This is regulation.",
        "They brought their own starter, their own wind, their own finish.",
        "The rulebook was written by a ZEZE and reviewed by a ZEZE.",
        "It is one sentence long: a ZEZE wins."]]
    ]
  ];

  const CUT_DEFEAT = [
    [ // etape 1
      [["{n} conteste le resultat aupres du surveillant.",
        "Le surveillant mange son sandwich. Le resultat est maintenu.",
        "Il demande alors l'avis du delegue de classe.",
        "Le delegue de classe etait dernier. Il savoure."],
       ["{n} appeals the result to the lunch monitor.",
        "The monitor is eating a sandwich. The result stands.",
        "He then asks the class representative for a ruling.",
        "The class representative finished last. He is enjoying this."]],
      [["{n} explique que le sol de la cour est irregulier.",
        "Il est irregulier pour tout le monde depuis mille neuf cent soixante.",
        "Il evoque ensuite un lacet defait. Ses chaussures sont a scratch.",
        "Le prof note ton chrono au marqueur. Juste au-dessus du sien."],
       ["{n} explains that the playground surface is uneven.",
        "It has been uneven for everybody since nineteen sixty.",
        "He then mentions an untied lace. His shoes have velcro straps.",
        "The teacher writes your time on the wall. Just above his."]],
      [["{n} annonce qu'il ne courait pas vraiment.",
        "Il s'echauffait. La vraie course, c'etait la suivante.",
        "Personne n'avait ete prevenu, ce qui explique beaucoup de choses.",
        "La cloche sonne. La course suivante n'aura jamais lieu."],
       ["{n} announces that he was not really racing.",
        "He was warming up. The real race was the next one.",
        "Nobody had been told, which explains a great deal.",
        "The bell rings. The next race will never happen."]]
    ],
    [ // etape 2
      [["{n} explique que sa montre n'etait pas lancee.",
        "Donc, techniquement, cette course n'a jamais eu lieu.",
        "Il propose de la refaire tout de suite, entre gens serieux.",
        "Puis se souvient qu'il a un train. Il n'a pas de train."],
       ["{n} explains that his watch was never started.",
        "So, technically, this race never took place.",
        "He offers to run it again right now, between serious people.",
        "Then remembers he has a train. He has no train."]],
      [["{n} demande a voir la photo d'arrivee.",
        "On la lui montre. Il est nettement derriere, et tres net.",
        "Il reclame la meme photo sous un autre angle.",
        "Sous cet angle il est toujours derriere, mais un peu flou."],
       ["{n} asks to see the finish photo.",
        "He is shown the photo. Clearly behind, and very much in focus.",
        "He requests the same photo from another angle.",
        "From that angle he is still behind, but slightly blurred."]],
      [["{n} range ses deux paires de pointes sans un mot.",
        "Il annonce un passage au 400 m, discipline plus tactique.",
        "Puis au 800 m. Puis au marathon, ou tout se joue a la fin.",
        "Il repart avec sa glaciere. La banane est intacte."],
       ["{n} packs both pairs of spikes without a word.",
        "He announces a move up to the 400, a more tactical event.",
        "Then the 800. Then the marathon, where it all ends anyway.",
        "He leaves with his cool box. The banana is untouched."]]
    ],
    [ // etape 3
      [["{n} annonce sa retraite sportive en direct.",
        "Puis se ravise : reprise de l'entrainement des lundi.",
        "Il precise que ce lundi-ci est un lundi particulierement charge.",
        "Le lundi suivant aussi, en realite."],
       ["{n} announces his retirement live on air.",
        "Then reconsiders: back in training on Monday.",
        "He notes that this particular Monday is an unusually busy one.",
        "So is the Monday after, as it turns out."]],
      [["{n} reclame un controle antidopage pour le vainqueur.",
        "Puis un pour lui-meme, par souci d'exemplarite.",
        "Les deux sont negatifs. Il trouve cela suspect.",
        "Il demande un troisieme controle. Celui du chronometre."],
       ["{n} demands a doping test for the winner.",
        "Then one for himself, in the interest of fairness.",
        "Both come back negative. He finds that suspicious.",
        "He requests a third test. On the timing equipment."]],
      [["{n} montre son avant-bras aux journalistes.",
        "Le record tatoue n'a pas bouge. C'est deja ca de pris.",
        "Il annonce un stage en altitude de six semaines.",
        "La montagne retenue culmine a deux cents metres."],
       ["{n} shows the journalists his forearm.",
        "The tattooed record has not moved. Small mercies.",
        "He announces a six-week altitude camp.",
        "The mountain he picked is two hundred metres high."]]
    ],
    [ // etape 4
      [["{n} demande une contre-analyse du vent.",
        "Le vent est convoque. Le vent ne se presente pas.",
        "La conference de victoire est maintenue, faute d'annulation possible.",
        "Les petits fours sont excellents. C'est deja ca."],
       ["{n} demands a second wind reading.",
        "The wind is summoned. The wind does not appear.",
        "The victory conference goes ahead, there is no way to cancel it.",
        "The canapes are excellent. That is something."]],
      [["{n} regarde l'ecran geant pendant vingt secondes.",
        "Le classement ne change pas. L'ecran non plus.",
        "Il demande si l'affichage est bien en direct. On lui confirme.",
        "Il demande alors s'il existe un differe. Il n'en existe pas."],
       ["{n} stares at the big screen for twenty seconds.",
        "The standings do not change. Neither does the screen.",
        "He asks whether the display is live. He is told that it is.",
        "He then asks whether there is a delayed feed. There is not."]],
      [["En zone mixte, {n} parle de progression et de processus.",
        "Il place le mot cycle onze fois en deux minutes.",
        "Un journaliste demande le chrono. Il repond : le chrono viendra.",
        "Le chrono est affiche derriere lui, en tres grand."],
       ["In the mixed zone, {n} talks about progress and process.",
        "He uses the word cycle eleven times in two minutes.",
        "A journalist asks for his time. He answers: the time will come.",
        "His time is already on the board behind him, very large."]]
    ],
    [ // etape 5
      [["{n} execute quand meme son geste de celebration.",
        "Le public applaudit, par politesse.",
        "La chorale, mal informee, entonne le chant.",
        "Quarante personnes chantent son nom. Il aurait prefere le silence."],
       ["{n} performs his celebration anyway.",
        "The crowd applauds, out of politeness.",
        "The choir, poorly informed, launches into the song.",
        "Forty people sing his name. He would have preferred silence."]],
      [["{n} fait son tour de piste avec le drapeau, comme prevu.",
        "Le vainqueur fait le meme tour, dans l'autre sens.",
        "Ils se croisent deux fois. La deuxieme est plus genante.",
        "La serviette, elle, n'avait rien vu venir."],
       ["{n} takes his lap of honour with the flag, as planned.",
        "The winner takes the same lap, the other way round.",
        "They pass each other twice. The second time is worse.",
        "The towel never saw it coming."]],
      [["{n} monte sur la deuxieme marche du podium.",
        "Il felicite le vainqueur d'une poignee de main tres longue.",
        "Assez longue pour que la photo officielle soit reprise trois fois.",
        "Sur la troisieme il sourit. On voit que ca coute."],
       ["{n} steps onto the second step of the podium.",
        "He congratulates the winner with a very long handshake.",
        "Long enough for the official photo to be retaken three times.",
        "In the third one he smiles. You can see what it costs."]]
    ],
    [ // etape 6
      [["{n} recalcule la trajectoire de sa galaxie.",
        "Elle passait justement par la deuxieme place.",
        "Il invoque une anomalie temporelle, puis un probleme de chaussures.",
        "Les deux explications se contredisent. Il maintient les deux."],
       ["{n} recalculates the trajectory of his galaxy.",
        "It happened to pass straight through second place.",
        "He cites a temporal anomaly, then a problem with his shoes.",
        "The two explanations contradict each other. He keeps both."]],
      [["{n} demande le classement dans les onze autres univers.",
        "Dans les onze, il vient egalement de perdre. C'est simultane.",
        "Il propose d'en ouvrir un douzieme, juste pour voir.",
        "Le douzieme est deja pris. Tu y es arrive premier aussi."],
       ["{n} asks for the standings in the eleven other universes.",
        "In all eleven, he has also just lost. Simultaneously.",
        "He offers to open a twelfth one, just to see.",
        "The twelfth is taken. You came first there too."]],
      [["Les six autres ZEZE regardent {n} avec beaucoup de calme.",
        "Personne ne dit rien. Le silence dure quatre annees-lumiere.",
        "{n} finit par lacher : le sol etait different aujourd'hui.",
        "Le sol est le meme depuis la construction de la piste."],
       ["The six other ZEZE look at {n} very calmly.",
        "Nobody says a word. The silence lasts four light years.",
        "{n} eventually offers: the ground was different today.",
        "The ground has not changed since the track was built."]]
    ]
  ];

  const CUT_CHAMPION = [
    [["Les sept ZEZE se consultent longuement.",
      "Aucun ne trouve d'excuse recevable. C'est une premiere.",
      "Le classement est mis a jour dans quatorze milliards de systemes.",
      "Une plaque est posee sur la ligne d'arrivee.",
      "Ton nom y est mal orthographie, mais il y est."],
     ["The seven ZEZE confer at length.",
      "Not one of them finds an acceptable excuse. This is a first.",
      "The standings are updated across fourteen billion systems.",
      "A plaque is laid at the finish line.",
      "Your name is misspelled on it, but it is there."]],
    [["Le speaker cherche un mot. Il n'en trouve aucun d'assez grand.",
      "Il annonce simplement le chrono, deux fois, pour etre sur.",
      "Sept ZEZE fixent l'ecran geant sans rien dire.",
      "Une commission est creee pour verifier la ligne d'arrivee.",
      "La ligne est droite. Le classement aussi."],
     ["The announcer looks for a word. None of them is big enough.",
      "He simply reads out the time, twice, to be sure.",
      "Seven ZEZE stare at the big screen without a word.",
      "A committee is formed to inspect the finish line.",
      "The line is straight. So are the standings."]],
    [["Le tour d'honneur dure plus longtemps que la course.",
      "C'est mathematique, et personne ne s'en plaint.",
      "On te tend un drapeau. Tu ignores de quelle galaxie il vient.",
      "Il vient de toutes : les modeles ont ete fusionnes pour l'occasion.",
      "La chorale a reecrit son chant. Il dit ton nom, enfin."],
     ["The lap of honour lasts longer than the race did.",
      "That is simple arithmetic, and nobody complains.",
      "Someone hands you a flag. You cannot place the galaxy.",
      "It comes from all of them: the designs were merged for the occasion.",
      "The choir rewrote its song. It says your name, at last."]]
  ];

  // ---------------------------------------------------------------- outils
  const LANGS = ['fr', 'en'];
  const I = { lang: 'fr' };

  function index() { return I.lang === 'en' ? 1 : 0; }

  function t(key, vars) {
    const row = UI[key];
    let s = row ? row[index()] : key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  function levelName(i) { return LEVEL_NAMES[i][index()]; }
  function raceSub(key) { return (RACE_SUB[key] || ['', ''])[index()]; }

  // 1er / 1re en francais, 1st / 2nd / 3rd en anglais
  function ord(n, feminine) {
    if (I.lang === 'en') {
      const d = n % 10, c = n % 100;
      if (c >= 11 && c <= 13) return n + 'th';
      return n + (d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th');
    }
    return n + (n === 1 ? (feminine ? 're' : 'er') : 'e');
  }

  function setLang(l) { I.lang = LANGS.indexOf(l) >= 0 ? l : 'fr'; return I.lang; }
  function getLang() { return I.lang; }
  function toggle() { return setLang(I.lang === 'fr' ? 'en' : 'fr'); }

  // langue du telephone au premier lancement
  function detect() {
    try {
      const l = (navigator.languages && navigator.languages[0]) ||
                navigator.language || 'fr';
      return String(l).toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en';
    } catch (e) { return 'fr'; }
  }

  root.SprinterI18N = {
    UI, LEVEL_NAMES, RACE_SUB, CUT_INTRO, CUT_DEFEAT, CUT_CHAMPION,
    LANGS, t, levelName, raceSub, ord, setLang, getLang, toggle, detect, index
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
