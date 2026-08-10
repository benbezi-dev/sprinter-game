/* -----------------------------------------------------------------------
   SPRINTER — textes en français et en anglais.
   Source unique : la version Python est générée à partir de ce fichier.
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  // ------------------------------------------------------------ interface
  const UI = {
    // ouverture et accueil
    races:        ['100 METRES   -   200 METRES', '100 METRES   -   200 METRES'],
    tagline:      ['six étapes, un seul chrono à battre',
                   'six stages, one clock to beat'],
    tap_start:    ["touche l'écran pour commencer", 'tap the screen to start'],
    six_stages:   ['   -   six étapes', '   -   six stages'],
    best_runs:    ['MEILLEURS PARCOURS', 'BEST RUNS'],
    no_run:       ["aucun parcours terminé pour l'instant", 'no run finished yet'],
    furthest:     ['étape la plus loin : ', 'furthest stage: '],
    of_six:       [' sur 6', ' of 6'],
    start:        ['COMMENCER', 'START'],
    sound:        ['son : ', 'sound: '],
    yes:          ['oui', 'yes'],
    no:           ['non', 'no'],

    // cinématiques
    rival:        ['LE COUREUR À BATTRE', 'THE ONE TO BEAT'],
    favourite:    ['Le favori', 'The favourite'],
    after_race:   ['APRÈS LA COURSE', 'AFTER THE RACE'],
    crowned:      ['SACRÉ INTERGALACTIQUE', 'INTERGALACTIC TITLE'],
    fastest_1:    ["L'ÊTRE LE PLUS RAPIDE", 'THE FASTEST BEING'],
    fastest_2:    ['DE TOUTES LES GALAXIES', 'IN EVERY GALAXY'],
    full_run_in:  ['parcours complet en ', 'full run in '],
    announced:    ['chrono annoncé : ', 'announced time: '],
    stage_up:     ['ÉTAPE ', 'STAGE '],
    six_cleared:  ['SIX ÉTAPES FRANCHIES', 'SIX STAGES CLEARED'],
    skip_now:     ['touche à nouveau pour passer', 'tap again to skip'],
    skip_twice:   ['touche deux fois pour passer', 'tap twice to skip'],

    // départ et phases de course
    reaction:     ['RÉACTION', 'REACTION'],
    react_top:    ['RÉACTION PARFAITE', 'PERFECT REACTION'],
    false_start:  ['PARTI TROP TÔT', 'WENT TOO EARLY'],
    wait_gun:     ['attends le signal', 'wait for the gun'],
    phase_drive:  ['POUSSÉE', 'DRIVE'],
    phase_trans:  ['TRANSITION', 'TRANSITION'],
    phase_max:    ['VITESSE MAX', 'TOP SPEED'],
    drive_hint:   ['monte la cadence', 'build your cadence'],
    trans_2:      ['TRANSITION PARFAITE', 'PERFECT TRANSITION'],
    trans_1:      ['BONNE TRANSITION', 'GOOD TRANSITION'],
    trans_0:      ['TRANSITION RATÉE', 'TRANSITION MISSED'],
    start_line:   ['départ : réaction {r} s   -   {g}',
                   'start: {r} s reaction   -   {g}'],
    no_start:     ['départ manqué', 'start missed'],

    // course
    stumble:      ['TU TRÉBUCHES', 'YOU STUMBLE'],
    to_beat:      ['à battre : ', 'to beat: '],
    ready:        ['À VOS MARQUES', 'READY'],
    get_set:      ['PRÊTS', 'GET SET'],
    go:           ['PARTEZ', 'GO'],
    alternate:    ['alterne les deux touches', 'alternate the two buttons'],
    alternate_kb: ['alterne les deux flèches', 'alternate the two arrows'],
    you:          ['TOI', 'YOU'],
    depart:       ['DÉPART', 'START'],
    arrivee:      ['ARRIVÉE', 'FINISH'],

    // résultats
    stage_done:   ['ÉTAPE {n} FRANCHIE', 'STAGE {n} CLEARED'],
    first_in:     ['1re place en ', '1st place in '],
    total_of:     [' s   -   cumul ', ' s   -   total '],
    place:        ['{o} PLACE', '{o} PLACE'],
    dnf:          ['abandon', 'did not finish'],
    unfinished:   ['non terminé', 'unfinished'],
    race_again:   ['RECOMMENCER ?', 'RACE AGAIN?'],
    next_stage:   ['ÉTAPE {n}', 'STAGE {n}'],
    home:         ['ACCUEIL', 'HOME'],
    replay:       ['REJOUER', 'PLAY AGAIN'],
    run_done:     ['PARCOURS TERMINÉ', 'RUN COMPLETE'],
    six_in:       ['six étapes franchies en ', 'six stages cleared in '],
    stage_low:    ['étape ', 'stage '],

    // badges
    new_record:   ['NOUVEAU RECORD', 'NEW RECORD'],
    top3:         ['TOP 3', 'TOP 3'],
    top10:        ['TOP 10', 'TOP 10'],
    best_run:     ['MEILLEUR PARCOURS', 'BEST RUN'],
    top3_runs:    ['TOP 3 DES PARCOURS', 'TOP 3 RUNS'],
    top10_runs:   ['TOP 10 DES PARCOURS', 'TOP 10 RUNS'],

    // classement mondial
    top500:          ['TOP 500 - ALL TIME', 'TOP 500 - ALL TIME'],
    your_name:       ['ton nom', 'your name'],
    save_score:      ['ENREGISTRER MON CHRONO', 'SAVE MY TIME'],
    saving_score:    ['envoi en cours...', 'sending...'],
    score_saved:     ['classé {r}e sur le TOP 500 mondial', 'ranked {r} on the world TOP 500'],
    score_save_fail: ["échec de l'envoi, réessaie plus tard", 'failed to send, try again later'],
    view_top500:     ['VOIR LE TOP 500', 'VIEW TOP 500'],
    close:           ['FERMER', 'CLOSE'],
    loading_ranks:   ['chargement du classement...', 'loading rankings...'],
    empty_top500:    ['aucun chrono enregistré pour le moment', 'no times recorded yet'],
    your_rank:       ['TON RANG : {r}', 'YOUR RANK: {r}'],
    outside_top500:  ['hors du top 500', 'outside the top 500'],
    edit_name:       ['MODIFIER LE NOM', 'EDIT NAME'],
    best_split_short:['meilleure étape :', 'best stage:'],

    // ---- version bureau, au clavier ----
    composing:    ['composition de la bande-son...', 'composing the soundtrack...'],
    sound_off:    ['SON COUPÉ  (S)', 'SOUND OFF  (S)'],
    press_enter:  ['appuie sur ENTRÉE', 'press ENTER'],
    skip_now_kb:  ['ENTRÉE à nouveau pour passer', 'press ENTER again to skip'],
    skip_twice_kb:['ENTRÉE deux fois pour passer', 'press ENTER twice to skip'],
    stage_dash:   ['ÉTAPE {n}   -   {s}', 'STAGE {n}   -   {s}'],
    furthest_kb:  ['étape la plus loin atteinte : {a} sur {b}',
                   'furthest stage reached: {a} of {b}'],
    enter_start:  ['ENTRÉE : lancer   -   S : son   -   L : langue   -   ÉCHAP : quitter',
                   'ENTER: start   -   S: sound   -   L: language   -   ESC: quit'],
    how_to_play:  ['COMMENT JOUER', 'HOW TO PLAY'],
    help_1:       ['Alterne  <-  et  ->  sans répéter',
                   'Alternate  <-  and  ->  without'],
    help_2:       ['la même touche.', 'repeating the same key.'],
    help_3:       ['Une cadence régulière fait monter',
                   'A steady rhythm builds up speed;'],
    help_4:       ['la vitesse ; une répétition fait',
                   'a repeat makes you stumble, but'],
    help_5:       ['trébucher, mais on peut repartir.',
                   'you can always get going again.'],
    best_stage:   ["MEILLEURS CHRONOS DE L'ÉTAPE", 'BEST TIMES FOR THIS STAGE'],
    no_time:      ['aucun chrono enregistré', 'no time recorded yet'],
    arrows_pick:  ['flèches pour choisir   -   ENTRÉE pour valider   -   ',
                   'arrows to choose   -   ENTER to confirm   -   '],
    yn_short:     ['O / N en raccourci', 'Y / N shortcut'],
    you_beat:     ['Tu as battu {w} et traversé les six étapes.',
                   'You beat {w} and cleared all six stages.'],
    the_zeze:     ['les ZEZE', 'the ZEZE'],
    your_times:   ['TES CHRONOS', 'YOUR TIMES'],
    total:        ['TOTAL', 'TOTAL'],
    enter_replay: ['ENTRÉE : refaire un parcours      M : accueil',
                   'ENTER: run again      M: home'],
    stumble_kb:   ['TU TRÉBUCHES !', 'YOU STUMBLE!'],
    go_kb:        ['PARTEZ !', 'GO!'],
    to_beat_line: ['À BATTRE :  {n}   -   {s} s', 'TO BEAT:  {n}   -   {s} s'],
    best_times_of:['MEILLEURS CHRONOS  -  {s}', 'BEST TIMES  -  {s}'],
    enter_next:   ['ENTRÉE   ->   ÉTAPE {n} : {s}', 'ENTER   ->   STAGE {n}: {s}'],
    full_run_pc:  ['parcours complet en {s} s', 'full run in {s} s'],
    announced_pc: ['chrono annoncé : {s} s', 'announced time: {s} s'],
    quit:         ['ÉCHAP : quitter', 'ESC: quit']
  };

  const LEVEL_NAMES = [
    ['Compétition scolaire', 'School meeting'],
    ['Niveau régional', 'Regional level'],
    ['Niveau national', 'National level'],
    ['Championnat du monde', 'World Championships'],
    ['Jeux olympiques', 'Olympic Games'],
    ['Intergalactique', 'Intergalactic']
  ];

  const RACE_SUB = {
    '100': ['la ligne droite', 'the straight'],
    '200': ['virage et ligne droite', 'bend and straight']
  };

  // ----------------------------------------------------- présentations
  // Trois variantes par étape et par moment, dans les deux langues.
  const CUT_INTRO = [
    [ // étape 1
      [["{n} gagne toutes les courses de la récréation depuis trois ans.",
        "Son secret : personne n'ose le doubler, il a le ballon.",
        "Il s'échauffe en chaussures de ville, par principe.",
        "Sa mère filme depuis le grillage. Elle filme surtout le grillage."],
       ["{n} has won every playground race for three years.",
        "His secret: nobody dares overtake him, he owns the ball.",
        "He warms up in school shoes, on principle.",
        "His mother films from behind the fence. Mostly the fence."]],
      [["{n} détient le record de l'école, écrit au marqueur sur le gymnase.",
        "Le chrono avait été pris par un camarade, sur une montre à aiguilles.",
        "Le prof de sport a validé d'un hochement de tête. C'est officiel.",
        "Depuis, on repeint le mur en contournant le record."],
       ["{n} holds the school record, written in marker on the gym wall.",
        "A classmate timed it, on a watch with hands.",
        "The PE teacher nodded once. That made it official.",
        "They now repaint the wall around the record."]],
      [["{n} a réclamé le couloir 4. On lui a donné le couloir 4.",
        "Il fait ses gammes : montées de genoux, talons-fesses, soupirs.",
        "Son dossard a été imprimé à la maison, un peu de travers.",
        "Le numéro est 1. Il n'avait pas beaucoup d'autres options."],
       ["{n} asked for lane 4. He was given lane 4.",
        "He runs his drills: high knees, heel flicks, deep sighs.",
        "His bib was printed at home, slightly crooked.",
        "The number is 1. He printed it himself, alone."]]
    ],
    [ // étape 2
      [["{n} s'échauffe depuis quatre heures.",
        "Son survêtement porte son nom brodé dans le dos, en majuscules.",
        "Il a un rituel : trois pas en arrière, un souffle, un clin d'œil.",
        "Le clin d'œil ne s'adresse à personne en particulier."],
       ["{n} has been warming up for four hours.",
        "His tracksuit has his name embroidered on the back, in capitals.",
        "He has a ritual: three steps back, one breath, a wink.",
        "The wink is not aimed at anyone in particular."]],
      [["{n} arrive avec deux paires de pointes et une glacière.",
        "La glacière contient une banane et beaucoup de détermination.",
        "Il pose ses starting-blocks au millimètre, puis les repose.",
        "Puis une troisième fois. Le starter attend, poliment."],
       ["{n} arrives with two pairs of spikes and a cool box.",
        "The cool box holds one banana and a great deal of resolve.",
        "He sets his blocks to the millimetre, then resets them.",
        "Then a third time. The starter waits, politely."]],
      [["{n} a fini deuxième du régional l'an dernier.",
        "Il en parle comme d'une victoire volée par un vent de face.",
        "Le relevé officiel indiquait vent nul. Il conteste le relevé.",
        "Il a apporté son anémomètre. Il ne sait pas s'en servir."],
       ["{n} finished second at regionals last year.",
        "He describes it as a win stolen by a headwind.",
        "The official reading said no wind. He disputes the reading.",
        "He brought his own anemometer. He cannot work it."]]
    ],
    [ // étape 3
      [["{n} est passé à la télévision régionale.",
        "Trente-huit secondes de sujet. Il les a revues six cents fois.",
        "Il signe des autographes avant la course, par gain de temps.",
        "Sur des tickets de caisse, faute de mieux."],
       ["{n} has been on regional television.",
        "Thirty-eight seconds of coverage. He has watched it six hundred times.",
        "He signs autographs before the race, to save time.",
        "On till receipts, for want of anything better."]],
      [["{n} a un surnom que personne n'utilise : la Flèche du Nord.",
        "Il le glisse lui-même dans chacune de ses interviews.",
        "Le speaker vient de l'annoncer sous son vrai nom, par erreur.",
        "Il a demandé une rectification au micro. Elle viendra après."],
       ["{n} has a nickname nobody uses: the Northern Arrow.",
        "He slips it into every interview himself.",
        "The announcer just introduced him by his real name, by mistake.",
        "He has asked for a correction over the PA. It will come later."]],
      [["{n} s'est fait tatouer son record personnel sur l'avant-bras.",
        "Il le montre au ralenti pendant la présentation des athlètes.",
        "Quatre coureurs de cette finale ont déjà fait mieux que ce chiffre.",
        "Le tatouage, lui, ne se rattrape pas."],
       ["{n} had his personal best tattooed on his forearm.",
        "He shows it in slow motion during the athlete presentation.",
        "Four runners in this final have already beaten that number.",
        "The tattoo, unfortunately, does not update."]]
    ],
    [ // étape 4
      [["{n} a un sponsor, un agent et un kinésithérapeute.",
        "Tous les trois lui répètent qu'il est imbattable. Il les paie.",
        "Son agent a déjà réservé la salle de la conférence de victoire.",
        "Le buffet est commandé. Il y a des petits fours."],
       ["{n} has a sponsor, an agent and a physiotherapist.",
        "All three tell him he is unbeatable. He pays all three.",
        "His agent has already booked the room for the victory conference.",
        "The catering is ordered. There are canapes."]],
      [["{n} est numéro un mondial depuis onze mois.",
        "Il l'a appris en direct et n'a plus jamais regardé en arrière.",
        "Littéralement : son kiné le lui a formellement déconseillé.",
        "Il tourne désormais tout le buste. C'est plus lent, mais c'est net."],
       ["{n} has been world number one for eleven months.",
        "He found out live on air and never looked back since.",
        "Literally: his physio strongly advised against it.",
        "He now turns his whole torso. Slower, but it does look sharp."]],
      [["Le speaker annonce {n}. Le stade se lève.",
        "Il tend le bras vers la tribune, puis vers le ciel, puis la caméra.",
        "La caméra était sur un autre athlète. Il recommence tout.",
        "Le réalisateur cède. Le geste durera onze secondes."],
       ["The announcer calls {n}. The stadium rises.",
        "He points at the stand, then at the sky, then at the camera.",
        "The camera was on another athlete. He starts the whole thing again.",
        "The director gives in. The gesture will run eleven seconds."]]
    ],
    [ // étape 5
      [["{n} répète son geste de célébration depuis huit mois.",
        "Il l'a fait breveter. Il ne reste plus qu'à gagner la course.",
        "Une chorale de quarante personnes attend son signal.",
        "Elles ont appris un chant. Le chant dit son nom, longtemps."],
       ["{n} has been rehearsing his celebration for eight months.",
        "He has had it trademarked. All that is left is winning the race.",
        "A choir of forty is waiting for his signal.",
        "They learned a song. The song says his name, at length."]],
      [["{n} porte les couleurs de son pays, et il y tient beaucoup.",
        "Le drapeau est sur les pointes, sur le dossard et sur la serviette.",
        "La serviette ne court pas, mais elle est prête depuis mardi.",
        "Un membre du staff la suit partout depuis la cérémonie."],
       ["{n} wears his national colours, and cares deeply about it.",
        "The flag is on the spikes, on the bib and on the towel.",
        "The towel does not race, but it has been ready since Tuesday.",
        "A staff member has carried it everywhere since the opening ceremony."]],
      [["{n} a juré de ne pas regarder ses adversaires dans les blocs.",
        "Il fixe donc droit devant lui, avec une intensité remarquable.",
        "Un peu trop devant : il a fixé le mur pendant la présentation.",
        "Le mur n'est pas qualifié pour cette finale."],
       ["{n} swore he would not look at his rivals in the blocks.",
        "So he stares straight ahead, with remarkable intensity.",
        "A little too far ahead: he stared at the wall during introductions.",
        "The wall did not qualify for this final."]]
    ],
    [ // étape 6
      [["{n} vient d'un univers où la gravité est une option.",
        "Il termine ses courses avant d'avoir décidé de partir.",
        "Son record est détenu dans onze dimensions simultanément.",
        "Dans la douzième il a trébuché, mais on n'en parle pas."],
       ["{n} comes from a universe where gravity is optional.",
        "He finishes his races before deciding to start them.",
        "His record is held in eleven dimensions at once.",
        "In the twelfth he tripped, but nobody brings that up."]],
      [["{n} a couru ce cent mètres dans onze univers parallèles.",
        "Il l'a gagné onze fois. Le douzième n'a pas été homologué.",
        "Le juge d'arrivée y était une nébuleuse, peu fiable sur la ligne.",
        "La nébuleuse a pris trois saisons de suspension."],
       ["{n} has run this hundred metres in eleven parallel universes.",
        "He won all eleven. The twelfth was never ratified.",
        "The finish judge there was a nebula, unreliable on the line.",
        "The nebula was banned for three seasons."]],
      [["La famille ZEZE occupe les sept couloirs. C'est réglementaire.",
        "Ils ont apporté leur starter, leur vent et leur ligne d'arrivée.",
        "Le règlement a été rédigé par un ZEZE, puis relu par un ZEZE.",
        "Il tient en une phrase : un ZEZE gagne."],
       ["The ZEZE family occupies all seven lanes. This is regulation.",
        "They brought their own starter, their own wind, their own finish.",
        "The rulebook was written by a ZEZE and reviewed by a ZEZE.",
        "It is one sentence long: a ZEZE wins."]]
    ]
  ];

  const CUT_DEFEAT = [
    [ // étape 1
      [["{n} conteste le résultat auprès du surveillant.",
        "Le surveillant mange son sandwich. Le résultat est maintenu.",
        "Il demande alors l'avis du délégué de classe.",
        "Le délégué de classe était dernier. Il savoure."],
       ["{n} appeals the result to the lunch monitor.",
        "The monitor is eating a sandwich. The result stands.",
        "He then asks the class representative for a ruling.",
        "The class representative finished last. He is enjoying this."]],
      [["{n} explique que le sol de la cour est irrégulier.",
        "Il est irrégulier pour tout le monde depuis mille neuf cent soixante.",
        "Il évoque ensuite un lacet défait. Ses chaussures sont à scratch.",
        "Le prof note ton chrono au marqueur. Juste au-dessus du sien."],
       ["{n} explains that the playground surface is uneven.",
        "It has been uneven for everybody since nineteen sixty.",
        "He then mentions an untied lace. His shoes have velcro straps.",
        "The teacher writes your time on the wall. Just above his."]],
      [["{n} annonce qu'il ne courait pas vraiment.",
        "Il s'échauffait. La vraie course, c'était la suivante.",
        "Personne n'avait été prévenu, ce qui explique beaucoup de choses.",
        "La cloche sonne. La course suivante n'aura jamais lieu."],
       ["{n} announces that he was not really racing.",
        "He was warming up. The real race was the next one.",
        "Nobody had been told, which explains a great deal.",
        "The bell rings. The next race will never happen."]]
    ],
    [ // étape 2
      [["{n} explique que sa montre n'était pas lancée.",
        "Donc, techniquement, cette course n'a jamais eu lieu.",
        "Il propose de la refaire tout de suite, entre gens sérieux.",
        "Puis se souvient qu'il a un train. Il n'a pas de train."],
       ["{n} explains that his watch was never started.",
        "So, technically, this race never took place.",
        "He offers to run it again right now, between serious people.",
        "Then remembers he has a train. He has no train."]],
      [["{n} demande à voir la photo d'arrivée.",
        "On la lui montre. Il est nettement derrière, et très net.",
        "Il réclame la même photo sous un autre angle.",
        "Sous cet angle il est toujours derrière, mais un peu flou."],
       ["{n} asks to see the finish photo.",
        "He is shown the photo. Clearly behind, and very much in focus.",
        "He requests the same photo from another angle.",
        "From that angle he is still behind, but slightly blurred."]],
      [["{n} range ses deux paires de pointes sans un mot.",
        "Il annonce un passage au 400 m, discipline plus tactique.",
        "Puis au 800 m. Puis au marathon, où tout se joue à la fin.",
        "Il repart avec sa glacière. La banane est intacte."],
       ["{n} packs both pairs of spikes without a word.",
        "He announces a move up to the 400, a more tactical event.",
        "Then the 800. Then the marathon, where it all ends anyway.",
        "He leaves with his cool box. The banana is untouched."]]
    ],
    [ // étape 3
      [["{n} annonce sa retraite sportive en direct.",
        "Puis se ravise : reprise de l'entraînement dès lundi.",
        "Il précise que ce lundi-ci est un lundi particulièrement chargé.",
        "Le lundi suivant aussi, en réalité."],
       ["{n} announces his retirement live on air.",
        "Then reconsiders: back in training on Monday.",
        "He notes that this particular Monday is an unusually busy one.",
        "So is the Monday after, as it turns out."]],
      [["{n} réclame un contrôle antidopage pour le vainqueur.",
        "Puis un pour lui-même, par souci d'exemplarité.",
        "Les deux sont négatifs. Il trouve cela suspect.",
        "Il demande un troisième contrôle. Celui du chronomètre."],
       ["{n} demands a doping test for the winner.",
        "Then one for himself, in the interest of fairness.",
        "Both come back negative. He finds that suspicious.",
        "He requests a third test. On the timing equipment."]],
      [["{n} montre son avant-bras aux journalistes.",
        "Le record tatoué n'a pas bougé. C'est déjà ça de pris.",
        "Il annonce un stage en altitude de six semaines.",
        "La montagne retenue culmine à deux cents mètres."],
       ["{n} shows the journalists his forearm.",
        "The tattooed record has not moved. Small mercies.",
        "He announces a six-week altitude camp.",
        "The mountain he picked is two hundred metres high."]]
    ],
    [ // étape 4
      [["{n} demande une contre-analyse du vent.",
        "Le vent est convoqué. Le vent ne se présente pas.",
        "La conférence de victoire est maintenue, faute d'annulation possible.",
        "Les petits fours sont excellents. C'est déjà ça."],
       ["{n} demands a second wind reading.",
        "The wind is summoned. The wind does not appear.",
        "The victory conference goes ahead, there is no way to cancel it.",
        "The canapes are excellent. That is something."]],
      [["{n} regarde l'écran géant pendant vingt secondes.",
        "Le classement ne change pas. L'écran non plus.",
        "Il demande si l'affichage est bien en direct. On lui confirme.",
        "Il demande alors s'il existe un différé. Il n'en existe pas."],
       ["{n} stares at the big screen for twenty seconds.",
        "The standings do not change. Neither does the screen.",
        "He asks whether the display is live. He is told that it is.",
        "He then asks whether there is a delayed feed. There is not."]],
      [["En zone mixte, {n} parle de progression et de processus.",
        "Il place le mot cycle onze fois en deux minutes.",
        "Un journaliste demande le chrono. Il répond : le chrono viendra.",
        "Le chrono est affiché derrière lui, en très grand."],
       ["In the mixed zone, {n} talks about progress and process.",
        "He uses the word cycle eleven times in two minutes.",
        "A journalist asks for his time. He answers: the time will come.",
        "His time is already on the board behind him, very large."]]
    ],
    [ // étape 5
      [["{n} exécute quand même son geste de célébration.",
        "Le public applaudit, par politesse.",
        "La chorale, mal informée, entonne le chant.",
        "Quarante personnes chantent son nom. Il aurait préféré le silence."],
       ["{n} performs his celebration anyway.",
        "The crowd applauds, out of politeness.",
        "The choir, poorly informed, launches into the song.",
        "Forty people sing his name. He would have preferred silence."]],
      [["{n} fait son tour de piste avec le drapeau, comme prévu.",
        "Le vainqueur fait le même tour, dans l'autre sens.",
        "Ils se croisent deux fois. La deuxième est plus gênante.",
        "La serviette, elle, n'avait rien vu venir."],
       ["{n} takes his lap of honour with the flag, as planned.",
        "The winner takes the same lap, the other way round.",
        "They pass each other twice. The second time is worse.",
        "The towel never saw it coming."]],
      [["{n} monte sur la deuxième marche du podium.",
        "Il félicite le vainqueur d'une poignée de main très longue.",
        "Assez longue pour que la photo officielle soit reprise trois fois.",
        "Sur la troisième il sourit. On voit que ça coûte."],
       ["{n} steps onto the second step of the podium.",
        "He congratulates the winner with a very long handshake.",
        "Long enough for the official photo to be retaken three times.",
        "In the third one he smiles. You can see what it costs."]]
    ],
    [ // étape 6
      [["{n} recalcule la trajectoire de sa galaxie.",
        "Elle passait justement par la deuxième place.",
        "Il invoque une anomalie temporelle, puis un problème de chaussures.",
        "Les deux explications se contredisent. Il maintient les deux."],
       ["{n} recalculates the trajectory of his galaxy.",
        "It happened to pass straight through second place.",
        "He cites a temporal anomaly, then a problem with his shoes.",
        "The two explanations contradict each other. He keeps both."]],
      [["{n} demande le classement dans les onze autres univers.",
        "Dans les onze, il vient également de perdre. C'est simultané.",
        "Il propose d'en ouvrir un douzième, juste pour voir.",
        "Le douzième est déjà pris. Tu y es arrivé premier aussi."],
       ["{n} asks for the standings in the eleven other universes.",
        "In all eleven, he has also just lost. Simultaneously.",
        "He offers to open a twelfth one, just to see.",
        "The twelfth is taken. You came first there too."]],
      [["Les six autres ZEZE regardent {n} avec beaucoup de calme.",
        "Personne ne dit rien. Le silence dure quatre années-lumière.",
        "{n} finit par lâcher : le sol était différent aujourd'hui.",
        "Le sol est le même depuis la construction de la piste."],
       ["The six other ZEZE look at {n} very calmly.",
        "Nobody says a word. The silence lasts four light years.",
        "{n} eventually offers: the ground was different today.",
        "The ground has not changed since the track was built."]]
    ]
  ];

  const CUT_CHAMPION = [
    [["Les sept ZEZE se consultent longuement.",
      "Aucun ne trouve d'excuse recevable. C'est une première.",
      "Le classement est mis à jour dans quatorze milliards de systèmes.",
      "Une plaque est posée sur la ligne d'arrivée.",
      "Ton nom y est mal orthographié, mais il y est."],
     ["The seven ZEZE confer at length.",
      "Not one of them finds an acceptable excuse. This is a first.",
      "The standings are updated across fourteen billion systems.",
      "A plaque is laid at the finish line.",
      "Your name is misspelled on it, but it is there."]],
    [["Le speaker cherche un mot. Il n'en trouve aucun d'assez grand.",
      "Il annonce simplement le chrono, deux fois, pour être sûr.",
      "Sept ZEZE fixent l'écran géant sans rien dire.",
      "Une commission est créée pour vérifier la ligne d'arrivée.",
      "La ligne est droite. Le classement aussi."],
     ["The announcer looks for a word. None of them is big enough.",
      "He simply reads out the time, twice, to be sure.",
      "Seven ZEZE stare at the big screen without a word.",
      "A committee is formed to inspect the finish line.",
      "The line is straight. So are the standings."]],
    [["Le tour d'honneur dure plus longtemps que la course.",
      "C'est mathématique, et personne ne s'en plaint.",
      "On te tend un drapeau. Tu ignores de quelle galaxie il vient.",
      "Il vient de toutes : les modèles ont été fusionnés pour l'occasion.",
      "La chorale a réécrit son chant. Il dit ton nom, enfin."],
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

  // 1er / 1re en français, 1st / 2nd / 3rd en anglais
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

  // langue du téléphone au premier lancement
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
