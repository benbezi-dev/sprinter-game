// LA COURSE DE L'ETOILE — les vingt-quatre chapitres du calendrier de l'Avent.
//
// Le texte de docs/NOEL_HISTOIRE.md, mis en donnees : une case par jour, du 1er au
// 24 decembre. Meme forme que les chapitres d'Halloween (halloween-cinema.ts) :
// un titre, une accroche (ce qu'on sait AVANT d'avoir gagne) et trois pages de
// trois ou quatre lignes, chacune en [francais, anglais]. On tutoie le joueur.
//
// AUCUN IMPORT ICI : ce sont des donnees, chargeables seules par un harnais.

export type Ligne = [string, string];
export type Chapitre = {
  n: number;
  titre: Ligne;
  accroche: Ligne;
  pages: Ligne[][];
};

export const CHAPITRES: readonly Chapitre[] = [
  { n: 1, titre: ['LES TRACES', 'THE TRACKS'],
    accroche: ['La première neige est tombée. Tu n’es pas seul dedans.', 'The first snow has fallen. You are not alone in it.'],
    pages: [[
      ['Chaque soir, tu cours dans les rues de la ville.', 'Every evening you run through the streets of the town.'],
      ['Ce matin, la première neige de l’hiver est tombée.', 'This morning the first snow of winter fell.'],
      ['Et depuis quelques jours, tu as l’impression d’être suivi.', 'And for a few days now you have felt followed.'],
    ], [
      ['Sur le trottoir, à côté de tes pas, d’autres traces.', 'On the pavement, next to your steps, other tracks.'],
      ['Petites, fendues en deux. Des sabots.', 'Small, split in two. Hooves.'],
      ['Elles te suivent depuis le coin de la rue.', 'They follow you from the corner of the street.'],
      ['Et elles s’arrêtent net devant ta porte.', 'And they stop dead at your door.'],
    ], [
      ['Tu as regardé partout. Personne.', 'You looked everywhere. Nobody.'],
      ['Juste, très loin, un tintement… qui n’a pas sonné.', 'Just, far away, a jingle… that made no sound.'],
      ['Comme un grelot qu’on agite et qui reste muet.', 'Like a bell being shaken that stays silent.'],
      ['Ce soir, tu laisseras la lumière de l’entrée allumée.', 'Tonight you will leave the porch light on.'],
    ]] },
  { n: 2, titre: ['LE GRELOT', 'THE BELL'],
    accroche: ['Sous le réverbère, quelqu’un t’attendait.', 'Under the street lamp, someone was waiting for you.'],
    pages: [[
      ['Ce soir, tu es sorti courir. Il était là.', 'Tonight you went out running. He was there.'],
      ['Sous le réverbère, dans la neige qui tombait.', 'Under the street lamp, in the falling snow.'],
      ['Un petit renne. Blanc. Pas plus haut que ta taille.', 'A little reindeer. White. No taller than your waist.'],
    ], [
      ['Ses bois étaient encore couverts de velours.', 'His antlers were still covered in velvet.'],
      ['À son cou, un grelot d’argent, terni par le temps.', 'Around his neck, a silver bell, tarnished by time.'],
      ['Il bougeait la tête. Le grelot ne faisait aucun bruit.', 'He moved his head. The bell made no sound at all.'],
    ], [
      ['Tu as fait un pas. Il a reculé.', 'You took a step. He stepped back.'],
      ['Tu t’es mis à courir. Il a couru derrière toi.', 'You started to run. He ran behind you.'],
      ['Pas pour te chasser. Pour te suivre.', 'Not to chase you. To follow you.'],
      ['Tu l’as appelé Givre. Il a eu l’air d’accord.', 'You called him Frost. He seemed to agree.'],
    ]] },
  { n: 3, titre: ['LE SAPIN ÉTEINT', 'THE DARK TREE'],
    accroche: ['Givre veut te montrer quelque chose.', 'Frost wants to show you something.'],
    pages: [[
      ['Ce soir, Givre ne t’a pas suivi. Il t’a précédé.', 'Tonight Frost didn’t follow you. He led the way.'],
      ['Par les petites rues, jusqu’à la place du Marché.', 'Through the narrow streets, to the Market Square.'],
      ['Au milieu de la place, le grand sapin.', 'In the middle of the square, the great tree.'],
    ], [
      ['Trente mètres de branches, et des guirlandes partout.', 'Thirty metres of branches, and lights everywhere.'],
      ['Toute la ville en a les yeux qui brillent.', 'The whole town’s eyes shine at it.'],
      ['Sauf tout en haut.', 'Except at the very top.'],
    ], [
      ['L’étoile, au sommet, est éteinte.', 'The star at the top is dark.'],
      ['Givre l’a regardée longtemps, sans bouger.', 'Frost looked at it for a long time, without moving.'],
      ['Puis il a baissé la tête, comme quand on a froid.', 'Then he lowered his head, the way you do when you are cold.'],
    ]] },
  { n: 4, titre: ['LA FENÊTRE', 'THE WINDOW'],
    accroche: ['Quelqu’un d’autre regarde l’étoile.', 'Someone else is watching the star.'],
    pages: [[
      ['Sur la place, face au sapin, il y a une boulangerie.', 'On the square, facing the tree, there is a bakery.'],
      ['Au-dessus, une fenêtre aux rideaux toujours fermés.', 'Above it, a window whose curtains are always closed.'],
      ['Ce soir, un rideau a bougé.', 'Tonight, a curtain moved.'],
    ], [
      ['Une vieille dame regardait dehors.', 'An old lady was looking out.'],
      ['Pas l’étoile. Givre.', 'Not at the star. At Frost.'],
      ['Sa main s’est posée à plat contre la vitre.', 'Her hand pressed flat against the glass.'],
    ], [
      ['Tu lui as fait un signe. Elle a refermé le rideau.', 'You waved at her. She closed the curtain.'],
      ['Mais avant, tu l’as vue.', 'But before that, you saw her.'],
      ['Elle pleurait. Et elle souriait.', 'She was crying. And she was smiling.'],
    ]] },
  { n: 5, titre: ['LA PREMIÈRE LUEUR', 'THE FIRST GLOW'],
    accroche: ['Ce soir, la neige s’est allumée.', 'Tonight, the snow lit up.'],
    pages: [[
      ['Tu as couru plus vite que jamais. Givre aussi.', 'You ran faster than ever. So did Frost.'],
      ['Au bout de ta course, tu t’es retourné.', 'At the end of your run, you turned around.'],
      ['Une de ses empreintes brillait dans la neige.', 'One of his hoofprints was glowing in the snow.'],
    ], [
      ['Une lueur bleue, douce, comme un lampion.', 'A soft blue glow, like a paper lantern.'],
      ['Elle n’a pas fondu. Elle n’a pas pâli.', 'It didn’t melt. It didn’t fade.'],
      ['Elle était encore là au matin.', 'It was still there in the morning.'],
    ], [
      ['Le boulanger l’a vue en ouvrant sa boutique.', 'The baker saw it as he opened his shop.'],
      ['Il n’a rien dit. Il a juste levé les yeux', 'He said nothing. He just looked up'],
      ['vers la fenêtre du dessus.', 'at the window above.'],
    ]] },
  { n: 6, titre: ['CE QU’IL VEUT', 'WHAT HE WANTS'],
    accroche: ['Givre essaie quelque chose. Et il tombe.', 'Frost tries something. And he falls.'],
    pages: [[
      ['Ce soir, au milieu de la place, Givre a pris son élan.', 'Tonight, in the middle of the square, Frost took a run-up.'],
      ['Il a couru, couru, et il a sauté.', 'He ran and ran, and he jumped.'],
      ['Vers le haut. Vers l’étoile.', 'Upwards. Towards the star.'],
    ], [
      ['Il est retombé dans la neige, sur le flanc.', 'He fell back into the snow, on his side.'],
      ['Il s’est relevé. Il a recommencé. Trois fois.', 'He got up. He tried again. Three times.'],
      ['Trois fois, la neige l’a rattrapé.', 'Three times, the snow caught him.'],
    ], [
      ['Tu t’es assis à côté de lui.', 'You sat down next to him.'],
      ['Il a posé sa tête contre ton épaule.', 'He rested his head against your shoulder.'],
      ['Il ne pleurait pas. Les rennes ne pleurent pas.', 'He wasn’t crying. Reindeer don’t cry.'],
      ['Mais son grelot tremblait.', 'But his bell was trembling.'],
    ]] },
  { n: 7, titre: ['LE CHOCOLAT', 'THE HOT CHOCOLATE'],
    accroche: ['La porte au-dessus de la boulangerie s’est ouverte.', 'The door above the bakery opened.'],
    pages: [[
      ['En rentrant, une porte s’est ouverte sur la place.', 'On your way home, a door opened onto the square.'],
      ['« Entre. Tu vas attraper la mort. »', '“Come in. You’ll catch your death.”'],
      ['C’était la dame de la fenêtre. Elle s’appelle Marthe.', 'It was the lady from the window. Her name is Marthe.'],
    ], [
      ['Chez elle, ça sent le pain chaud et le bois ciré.', 'Her home smells of warm bread and polished wood.'],
      ['Sur la table, deux tasses de chocolat.', 'On the table, two cups of hot chocolate.'],
      ['Deux. Comme si elle attendait quelqu’un.', 'Two. As if she were expecting someone.'],
    ], [
      ['« J’ai vu les lueurs, a-t-elle dit. Toutes. »', '“I saw the glows,” she said. “All of them.”'],
      ['Elle a regardé Givre, couché sur le paillasson.', 'She looked at Frost, lying on the doormat.'],
      ['« Il y avait longtemps qu’il n’était pas descendu. »', '“It’s been a long time since he came down.”'],
    ]] },
  { n: 8, titre: ['LA COURSE DE L’ÉTOILE', 'THE STAR RACE'],
    accroche: ['Marthe connaît une très vieille course.', 'Marthe knows a very old race.'],
    pages: [[
      ['« Autrefois, chaque 24 décembre, quelqu’un courait.', '“Long ago, every 24th of December, someone would run.'],
      ['Il montait à la chapelle, en haut de la colline.', 'He climbed to the chapel at the top of the hill.'],
      ['Là-haut brûle un cierge qui ne s’éteint jamais. »', 'Up there burns a candle that never goes out.”'],
    ], [
      ['« Il allumait sa lanterne à la flamme du cierge.', '“He lit his lantern from the candle’s flame.'],
      ['Puis il redescendait en courant jusqu’au sapin.', 'Then he ran all the way down to the tree.'],
      ['Et l’étoile s’allumait. Pour toute la ville. »', 'And the star lit up. For the whole town.”'],
    ], [
      ['Elle a souri à Givre.', 'She smiled at Frost.'],
      ['« Tu sais ce qu’on disait, dans le temps ?', '“Do you know what they used to say?'],
      ['Un renne ne vole que derrière quelqu’un qui court. »', 'A reindeer only flies behind someone who runs.”'],
    ]] },
  { n: 9, titre: ['ÉMILE', 'ÉMILE'],
    accroche: ['Une photo, sur le buffet de Marthe.', 'A photo, on Marthe’s sideboard.'],
    pages: [[
      ['Sur le buffet, une photo aux couleurs passées.', 'On the sideboard, a photo with faded colours.'],
      ['Un homme en maillot de laine, une écharpe autour du cou.', 'A man in a wool vest, a scarf around his neck.'],
      ['Il rit, une lanterne à la main.', 'He is laughing, a lantern in his hand.'],
    ], [
      ['À ses pieds, dans la neige, un petit renne blanc.', 'At his feet, in the snow, a little white reindeer.'],
      ['Des bois en velours. Un grelot au cou.', 'Velvet antlers. A bell around his neck.'],
      ['Tu as regardé Givre. Puis la photo. Puis Givre.', 'You looked at Frost. Then the photo. Then Frost.'],
    ], [
      ['Au dos, d’une écriture penchée :', 'On the back, in slanted handwriting:'],
      ['« Émile. 24 décembre 1995. Le petit est né cette nuit. »', '“Émile. 24 December 1995. The little one was born tonight.”'],
      ['Trente et un ans. Et Givre n’a pas grandi d’un poil.', 'Thirty-one years. And Frost hasn’t grown a single hair.'],
    ]] },
  { n: 10, titre: ['LA COLLINE', 'THE HILL'],
    accroche: ['La chapelle existe. Tu es allé voir.', 'The chapel is real. You went to see.'],
    pages: [[
      ['Ce soir, tu as couru jusqu’au pied de la colline.', 'Tonight you ran to the foot of the hill.'],
      ['Le chemin monte entre les sapins noirs.', 'The path climbs between the black fir trees.'],
      ['Tout en haut, une petite chapelle de pierre.', 'At the very top, a little stone chapel.'],
    ], [
      ['La porte était fermée. Une grosse serrure rouillée.', 'The door was shut. A big rusty lock.'],
      ['Mais par le trou de la serrure, une lumière.', 'But through the keyhole, a light.'],
      ['Une flamme. Droite, tranquille.', 'A flame. Straight, calm.'],
    ], [
      ['Trente et un ans sans personne. Et le cierge brûle.', 'Thirty-one years with nobody. And the candle burns.'],
      ['Givre n’a pas voulu monter.', 'Frost would not climb.'],
      ['Il te regardait, en bas, comme on attend son tour.', 'He watched you from below, like someone waiting their turn.'],
    ]] },
  { n: 11, titre: ['LE GRELOT MUET', 'THE SILENT BELL'],
    accroche: ['Marthe sait pourquoi le grelot ne sonne pas.', 'Marthe knows why the bell doesn’t ring.'],
    pages: [[
      ['« Ce grelot, c’est moi qui l’ai offert à Émile.', '“I gave that bell to Émile.'],
      ['Pour Noël 1962. Notre premier Noël mariés. »', 'For Christmas 1962. Our first Christmas married.”'],
      ['Elle l’a effleuré du bout des doigts.', 'She brushed it with her fingertips.'],
    ], [
      ['« Il sonnait chaque fois qu’Émile passait la ligne.', '“It rang every time Émile crossed the line.'],
      ['Toute la ville l’entendait, et tout le monde applaudissait.', 'The whole town heard it, and everyone clapped.'],
      ['Moi, je l’entendais de ma fenêtre. »', 'I heard it from my window.”'],
    ], [
      ['« Il s’est tu l’hiver où Émile est parti.', '“It went silent the winter Émile left.'],
      ['Je croyais que c’était le grelot qui était cassé. »', 'I thought the bell was broken.”'],
      ['Elle a regardé Givre. « Ce n’est pas le grelot. »', 'She looked at Frost. “It isn’t the bell.”'],
    ]] },
  { n: 12, titre: ['DOUZE LUEURS', 'TWELVE GLOWS'],
    accroche: ['La moitié du chemin.', 'Halfway there.'],
    pages: [[
      ['Ce matin, la ville s’est réveillée en silence.', 'This morning the town woke up in silence.'],
      ['De ta porte jusqu’à la place, douze lueurs bleues.', 'From your door to the square, twelve blue glows.'],
      ['Douze empreintes. La moitié d’un chemin.', 'Twelve hoofprints. Half a path.'],
    ], [
      ['Une petite fille s’est arrêtée devant la troisième.', 'A little girl stopped in front of the third one.'],
      ['Elle a posé sa moufle dessus. La lueur a grandi.', 'She put her mitten on it. The glow grew.'],
      ['« Maman, c’est chaud ! »', '“Mum, it’s warm!”'],
    ], [
      ['Le soir, quand tu es parti courir,', 'That evening, when you went out running,'],
      ['tu as entendu des pas derrière toi. Pas des sabots.', 'you heard footsteps behind you. Not hooves.'],
      ['Elle courait. Avec son bonnet trop grand.', 'She was running. In her too-big woolly hat.'],
    ]] },
  { n: 13, titre: ['LES ENFANTS', 'THE CHILDREN'],
    accroche: ['Tu ne cours plus seul.', 'You no longer run alone.'],
    pages: [[
      ['Ce soir, ils étaient cinq. Demain, ils seront dix.', 'Tonight there were five. Tomorrow there will be ten.'],
      ['Les enfants du quartier courent derrière toi,', 'The children of the neighbourhood run behind you,'],
      ['et Givre court au milieu d’eux, la tête haute.', 'and Frost runs among them, head held high.'],
    ], [
      ['Ils ne savent pas pourquoi ils courent.', 'They don’t know why they are running.'],
      ['Ils savent juste que c’est le bon moment.', 'They just know it is the right time.'],
      ['Que la neige brille quand on court.', 'That the snow shines when you run.'],
    ], [
      ['À la fenêtre, le rideau de Marthe est resté ouvert.', 'At the window, Marthe’s curtain stayed open.'],
      ['Un tout petit peu. Juste assez pour voir.', 'Just a little. Just enough to see.'],
    ]] },
  { n: 14, titre: ['LA LETTRE', 'THE LETTER'],
    accroche: ['Une enveloppe qui attend depuis 1996.', 'An envelope that has been waiting since 1996.'],
    pages: [[
      ['Marthe t’a montré une enveloppe jaunie.', 'Marthe showed you a yellowed envelope.'],
      ['« Émile l’a écrite à l’hôpital. Je ne l’ai jamais ouverte.', '“Émile wrote it in hospital. I never opened it.'],
      ['J’avais peur que ce soit un au revoir. »', 'I was afraid it was a goodbye.”'],
    ], [
      ['Ce soir, elle a voulu que tu sois là.', 'Tonight she wanted you to be there.'],
      ['Ses mains tremblaient. Le papier a craqué.', 'Her hands were shaking. The paper crackled.'],
      ['Elle a lu tout bas, puis à voix haute.', 'She read it under her breath, then out loud.'],
    ], [
      ['« Ma Marthe. Si un jour je ne peux plus courir,', '“My Marthe. If one day I can no longer run,'],
      ['quelqu’un courra. Il viendra avec le petit.', 'someone else will. They will come with the little one.'],
      ['Ce jour-là, ouvre les rideaux. Je serai là. »', 'That day, open the curtains. I will be there.”'],
    ]] },
  { n: 15, titre: ['LE FROID', 'THE COLD'],
    accroche: ['Cette nuit, il a fait moins quinze.', 'Last night it was minus fifteen.'],
    pages: [[
      ['Le froid est tombé d’un coup sur la ville.', 'The cold fell on the town all at once.'],
      ['Les fontaines ont gelé. Les vitres se sont givrées.', 'The fountains froze. The windows frosted over.'],
      ['Et les lueurs, dans la neige, ont pâli.', 'And the glows in the snow grew pale.'],
    ], [
      ['Givre a couru avec toi, mais moins vite.', 'Frost ran with you, but more slowly.'],
      ['Son pelage, si blanc, avait la couleur de la cendre.', 'His coat, so white, had turned the colour of ash.'],
      ['Il s’arrêtait souvent pour souffler.', 'He kept stopping to catch his breath.'],
    ], [
      ['Marthe l’a regardé longtemps, ce soir.', 'Marthe looked at him for a long time tonight.'],
      ['« Il a attendu trente et un ans. Il est fatigué. »', '“He has waited thirty-one years. He is tired.”'],
      ['« Il faut qu’on se dépêche. »', '“We have to hurry.”'],
    ]] },
  { n: 16, titre: ['LA TEMPÊTE', 'THE STORM'],
    accroche: ['On n’y voit plus à deux mètres.', 'You can’t see two metres ahead.'],
    pages: [[
      ['La tempête est arrivée par le nord, à la nuit.', 'The storm came from the north at nightfall.'],
      ['Le vent hurlait plus fort qu’une meute.', 'The wind howled louder than a pack.'],
      ['Tu es sorti quand même. Tu avais promis.', 'You went out anyway. You had promised.'],
    ], [
      ['Au milieu de la place, tu as perdu Givre.', 'In the middle of the square, you lost Frost.'],
      ['Plus de sabots, plus de souffle, plus rien.', 'No more hooves, no more breath, nothing.'],
      ['Juste la neige qui te fouettait la figure.', 'Just the snow whipping your face.'],
    ], [
      ['Tu l’as retrouvé à la toute dernière lueur.', 'You found him at the very last glow.'],
      ['Celle de la nuit dernière, presque éteinte.', 'Last night’s, almost gone.'],
      ['Il s’était couché dessus. Pour avoir chaud.', 'He had lain down on it. To keep warm.'],
    ]] },
  { n: 17, titre: ['LE MUR DE NEIGE', 'THE WALL OF SNOW'],
    accroche: ['Le chemin de la colline a disparu.', 'The path up the hill has disappeared.'],
    pages: [[
      ['Au matin, la tempête avait tout recouvert.', 'By morning, the storm had covered everything.'],
      ['Le chemin de la chapelle était fermé', 'The path to the chapel was blocked'],
      ['par un mur de neige plus haut qu’un homme.', 'by a wall of snow taller than a man.'],
    ], [
      ['Tu as pris une pelle. Seul, au début.', 'You took a shovel. Alone, at first.'],
      ['Puis le boulanger est venu. Puis les parents des enfants.', 'Then the baker came. Then the children’s parents.'],
      ['Puis des gens que tu n’avais jamais vus.', 'Then people you had never seen before.'],
    ], [
      ['À midi, toute la ville pelletait en chantant.', 'By noon, the whole town was shovelling and singing.'],
      ['À la nuit, le chemin était ouvert.', 'By nightfall, the path was open.'],
      ['Personne n’a demandé pourquoi. Tout le monde savait.', 'Nobody asked why. Everybody knew.'],
    ]] },
  { n: 18, titre: ['GIVRE TOMBE', 'FROST FALLS'],
    accroche: ['La nuit la plus longue.', 'The longest night.'],
    pages: [[
      ['Ce soir, Givre a fait trois foulées. Puis il est tombé.', 'Tonight Frost took three strides. Then he fell.'],
      ['Il ne s’est pas relevé.', 'He didn’t get up.'],
      ['Sa lueur, autour de lui, tenait dans une main.', 'The glow around him would have fitted in one hand.'],
    ], [
      ['Tu l’as pris dans tes bras. Il ne pesait presque rien.', 'You took him in your arms. He weighed almost nothing.'],
      ['Tu as couru jusqu’à la boulangerie', 'You ran to the bakery'],
      ['comme tu n’as jamais couru de ta vie.', 'like you had never run in your life.'],
    ], [
      ['Marthe a ouvert avant que tu frappes.', 'Marthe opened before you knocked.'],
      ['Elle a posé Givre près du poêle, sur une couverture.', 'She laid Frost by the stove, on a blanket.'],
      ['Puis elle a ouvert l’armoire d’Émile.', 'Then she opened Émile’s wardrobe.'],
    ]] },
  { n: 19, titre: ['L’ÉCHARPE ROUGE', 'THE RED SCARF'],
    accroche: ['Ce qu’il y avait dans l’armoire.', 'What was in the wardrobe.'],
    pages: [[
      ['Une écharpe rouge, en laine épaisse, mille fois reprisée.', 'A red scarf, thick wool, mended a thousand times.'],
      ['Marthe en a enveloppé Givre, tout doucement.', 'Marthe wrapped Frost in it, very gently.'],
      ['Il a ouvert un œil. Il a respiré plus fort.', 'He opened one eye. He breathed more strongly.'],
    ], [
      ['Puis elle l’a dénouée, et elle te l’a tendue.', 'Then she untied it, and held it out to you.'],
      ['« Il courait toujours avec. Elle sait le chemin. »', '“He always ran with it. It knows the way.”'],
      ['« Maintenant, elle est à toi. »', '“Now it is yours.”'],
    ], [
      ['Tu es sorti avec l’écharpe, et tu as couru.', 'You went out with the scarf, and you ran.'],
      ['Derrière toi, une lueur s’est allumée. Puis une autre.', 'Behind you, a glow lit up. Then another.'],
      ['Givre courait. Faiblement. Mais il courait.', 'Frost was running. Weakly. But he was running.'],
    ]] },
  { n: 20, titre: ['LES BOUGIES', 'THE CANDLES'],
    accroche: ['Marthe a un service à demander à la ville.', 'Marthe has a favour to ask the town.'],
    pages: [[
      ['Marthe est descendue sur la place. La première fois depuis 1996.', 'Marthe came down to the square. The first time since 1996.'],
      ['Le boulanger lui a pris le bras.', 'The baker took her arm.'],
      ['Les enfants ont fait cercle autour d’elle.', 'The children gathered round her.'],
    ], [
      ['« Le soir du 24, mettez une bougie à vos fenêtres.', '“On the evening of the 24th, put a candle in your windows.'],
      ['Toutes. De la colline jusqu’au sapin.', 'All of them. From the hill to the tree.'],
      ['Il faut qu’il voie le chemin. »', 'He has to see the way.”'],
    ], [
      ['Personne n’a demandé qui. Tout le monde a dit oui.', 'Nobody asked who. Everybody said yes.'],
      ['Ce soir-là, en rentrant, tu as compté les fenêtres.', 'That evening, on your way home, you counted the windows.'],
      ['Il y en avait plus de mille.', 'There were more than a thousand.'],
    ]] },
  { n: 21, titre: ['POURQUOI IL COURAIT', 'WHY HE RAN'],
    accroche: ['Le secret d’Émile.', 'Émile’s secret.'],
    pages: [[
      ['« En 1962, Émile est parti travailler au barrage, très loin.', '“In 1962, Émile went far away to work on the dam.'],
      ['Six mois sans nouvelles. Le courrier n’arrivait pas.', 'Six months without news. The post never came.'],
      ['Je ne savais pas s’il reviendrait. »', 'I didn’t know if he would come back.”'],
    ], [
      ['« Le 24 décembre, j’étais à ma fenêtre. Il neigeait.', '“On the 24th of December I was at my window. It was snowing.'],
      ['Tout à coup, une lumière est descendue de la colline.', 'Suddenly, a light came down from the hill.'],
      ['Quelqu’un courait. Avec une lanterne. »', 'Someone was running. With a lantern.”'],
    ], [
      ['« Il ne pouvait pas me prévenir. Alors il a couru.', '“He had no way to tell me. So he ran.'],
      ['Il a allumé l’étoile pour me dire : je suis rentré. »', 'He lit the star to tell me: I’m home.”'],
      ['« Et il l’a rallumée tous les ans. Pour me redire. »', '“And he lit it again every year. To tell me again.”'],
    ]] },
  { n: 22, titre: ['LA DERNIÈRE VEILLE', 'THE LAST VIGIL'],
    accroche: ['Marthe ne descendra pas, cette fois.', 'Marthe won’t come down this time.'],
    pages: [[
      ['Ce matin, les rideaux de Marthe sont restés fermés.', 'This morning, Marthe’s curtains stayed closed.'],
      ['Le médecin est venu. Il est reparti sans rien dire.', 'The doctor came. He left without a word.'],
      ['Elle était dans son fauteuil, face à la fenêtre.', 'She was in her armchair, facing the window.'],
    ], [
      ['Elle t’a pris la main. Ses doigts étaient froids.', 'She took your hand. Her fingers were cold.'],
      ['« Je ne pourrai pas venir sur la place.', '“I won’t be able to come to the square.'],
      ['Mais d’ici, je verrai l’étoile. Je l’ai toujours vue. »', 'But from here, I’ll see the star. I always have.”'],
    ], [
      ['« Allume-la. S’il te plaît. »', '“Light it. Please.”'],
      ['Givre, couché à ses pieds, a levé la tête.', 'Frost, lying at her feet, raised his head.'],
      ['Son grelot a tremblé. Presque un son.', 'His bell trembled. Almost a sound.'],
    ]] },
  { n: 23, titre: ['LA CHAPELLE', 'THE CHAPEL'],
    accroche: ['La veille de la veille.', 'The eve of Christmas Eve.'],
    pages: [[
      ['Ce soir, tu es monté à la chapelle avec Givre.', 'Tonight you climbed to the chapel with Frost.'],
      ['Le chemin pelleté par toute la ville. Les sapins noirs.', 'The path the whole town had shovelled. The black firs.'],
      ['Et tout en haut, la porte de pierre.', 'And at the very top, the stone door.'],
    ], [
      ['La serrure rouillée avait disparu.', 'The rusty lock was gone.'],
      ['La porte s’est ouverte toute seule, sans un bruit.', 'The door opened by itself, without a sound.'],
      ['Le cierge brûlait, droit, comme il y a trente et un ans.', 'The candle burned, straight, as it did thirty-one years ago.'],
    ], [
      ['Sur l’autel, une lanterne en cuivre. Celle de la photo.', 'On the altar, a copper lantern. The one in the photo.'],
      ['Givre a franchi le seuil.', 'Frost stepped over the threshold.'],
      ['Et pour la première fois, le grelot a sonné.', 'And for the first time, the bell rang.'],
    ]] },
  { n: 24, titre: ['L’ÉTOILE', 'THE STAR'],
    accroche: ['Le soir du 24 décembre. La Course de l’Étoile.', 'The evening of the 24th of December. The Star Race.'],
    pages: [[
      ['Tu as allumé la lanterne au cierge. L’écharpe d’Émile au cou.', 'You lit the lantern from the candle. Émile’s scarf around your neck.'],
      ['En bas, la ville entière : mille bougies aux fenêtres.', 'Below, the whole town: a thousand candles in the windows.'],
      ['Tu as couru. Et derrière toi, tout le monde a couru.', 'You ran. And behind you, everyone ran.'],
      ['Même un vieil athlète à barbe blanche, en maillot rouge. Il allait très vite.', 'Even an old athlete with a white beard, in a red vest. He was very fast.'],
    ], [
      ['À chaque foulée, une lueur. Le grelot sonnait, sonnait.', 'With every stride, a glow. The bell rang and rang.'],
      ['Au pied du sapin, tu as levé la lanterne.', 'At the foot of the tree, you raised the lantern.'],
      ['L’étoile s’est allumée. Toute la place est devenue d’or.', 'The star lit up. The whole square turned to gold.'],
      ['Et Givre a quitté le sol.', 'And Frost left the ground.'],
    ], [
      ['Il est monté, tout droit, vers l’étoile. Il volait.', 'He rose, straight up, towards the star. He was flying.'],
      ['À sa fenêtre, Marthe avait ouvert les rideaux.', 'At her window, Marthe had opened the curtains.'],
      ['Sur la colline, un homme en écharpe rouge lui faisait signe.', 'On the hill, a man in a red scarf was waving to her.'],
      ['Elle a posé sa main sur la vitre. Il était là.', 'She put her hand on the glass. He was there.'],
    ]] },
];

/** L'epilogue, apres la case 24 gagnee : le matin de Noel. */
export const EPILOGUE: { titre: Ligne; lignes: Ligne[] } = {
  titre: ['LE MATIN DE NOËL', 'CHRISTMAS MORNING'],
  lignes: [
    ['Au matin, sur ton paillasson, un grelot d’argent.', 'In the morning, on your doormat, a silver bell.'],
    ['Tu l’as ramassé. Il a sonné, clair, joyeux.', 'You picked it up. It rang, clear and joyful.'],
    ['À côté, un dossard rouge, numéro 1. Au dos :', 'Next to it, a red race bib, number 1. On the back:'],
    ['« Merci d’avoir couru avec moi. Rendez-vous l’an prochain. — P. N. »', '“Thank you for running with me. See you next year. — S. C.”'],
    ['Un renne ne vole que derrière quelqu’un qui court.', 'A reindeer only flies behind someone who runs.'],
    ['Joyeux Noël.', 'Merry Christmas.'],
  ],
};

/** Les soirs perdus : une course perdue n'avance pas l'histoire. Aucun ne nomme Marthe. */
export const SOIRS_PERDUS: readonly { titre: Ligne; lignes: Ligne[] }[] = [
  { titre: ['LA LUEUR QUI PÂLIT', 'THE FADING GLOW'], lignes: [
    ['Tu n’as pas tenu. Derrière toi, pas de lueur.', 'You didn’t make it. Behind you, no glow.'],
    ['Givre s’est arrêté au milieu de la rue.', 'Frost stopped in the middle of the street.'],
    ['Il t’a regardé, et il a attendu. Il sait attendre.', 'He looked at you, and he waited. He knows how to wait.'],
    ['Demain, il sera encore là.', 'Tomorrow he will still be there.'],
  ] },
  { titre: ['LE FROID', 'THE COLD'], lignes: [
    ['La neige a tout recouvert, ce soir.', 'The snow has covered everything tonight.'],
    ['Les empreintes d’hier ne brillent plus qu’à peine.', 'Yesterday’s hoofprints barely glow any more.'],
    ['Le grelot pend au cou de Givre, plus muet que jamais.', 'The bell hangs from Frost’s neck, more silent than ever.'],
    ['Il faut recourir. Avant qu’elles s’éteignent.', 'You must run again. Before they go out.'],
  ] },
  { titre: ['LA FENÊTRE FERMÉE', 'THE CLOSED WINDOW'], lignes: [
    ['Ce soir, sur la place, l’étoile est restée noire.', 'Tonight, on the square, the star stayed dark.'],
    ['Au-dessus de la boulangerie, le rideau n’a pas bougé.', 'Above the bakery, the curtain didn’t move.'],
    ['Givre s’est couché sous la fenêtre, en boule.', 'Frost curled up under the window.'],
    ['Il a dormi là. Il t’attend.', 'He slept there. He is waiting for you.'],
  ] },
];

/** Le chapitre de la case `n` (borne a 1..24). */
export function chapitreDe(n: number): Chapitre {
  return CHAPITRES[Math.max(0, Math.min(CHAPITRES.length - 1, n - 1))];
}
