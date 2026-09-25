# Spot « Partout » — le plan de hype

> Rédigé le 25 septembre 2026, à partir du storyboard **Spot E · Partout**
> (6 pages, 31 s, 10 plans, vertical 9:16).
> Ce plan complète `../plan-viral-lancement.md` et en garde les règles :
> **aucun chiffre inventé, aucun pseudonyme sans accord écrit, aucune date que
> le code ne tient pas.**

---

## 0 · L'idée en une phrase

Le spot raconte une **contagion** : le pote a contaminé le témoin, et le
témoin contaminera le spectateur (« Bienvenue »). Le plan de hype fait la même
chose en vrai. On ne « sort » pas un spot : **on le fait vivre pendant une
semaine, au rythme de son propre compteur de jours**, puis on le laisse passer
de main en main.

Trois temps, dans cet ordre :

1. **Le mystère** : cinq jours, cinq lieux, on ne montre jamais le jeu.
2. **La réplique** : « Je suis en train de laver tout le monde. »
3. **La contagion** : les gens refont le spot avec leur propre pote, code à la main.

**Révélation recommandée : dimanche 15 novembre, 18 h** (le calendrier et ses
raisons sont au §3).

---

## 1 · Ce que le storyboard contient déjà, et ce qu'on en fait

| Dans le spot | Ce que ça devient dans la campagne |
|---|---|
| **Le compteur de jours** (LUNDI · 8H12 · LA POSTE…) | **Le calendrier de publication.** Le plan 1 sort un vrai lundi à 8 h 12, le plan 2 le mardi à 17 h 40, etc. Le spot se déroule en temps réel sur le fil. |
| **Le ta-ta-ta**, identique dans chaque lieu | **La signature sonore.** C'est le bruit des pouces sur la vitre, au tempo réel du jeu (§2). On le publie comme son original sur TikTok et Reels, réutilisable par tout le monde. |
| **« Je suis en train de laver tout le monde. »** | **La réplique à mèmes.** Ambiguë, drôle, elle se cite sans contexte. Elle devient le son parlé et le hashtag : **#JeLaveToutLeMonde**. |
| **Le silence du vestiaire et la tentation** (plans 7-8) | **Le montage de 6 s pour la pub** : c'est le moment le plus tendu, et il tient sans le reste. |
| **Le compteur de rang** (plan 9) | **Un concours** : le vrai parcours d'un vrai joueur, avec son accord, remplace les chiffres d'exemple (§5.3). |
| **« Envoie-moi ton code. »** | **La mécanique qui existe déjà** : le défi par code, le lien `sprinter-game.com/d/CODE`, le classement des recruteurs. L'appel à l'action est dans l'histoire, pas plaqué. |
| **« Bienvenue. »** | **La suite.** Le témoin devient le pote. L'épisode 2 a un nouveau témoin (§3, phase 4). Le spot devient une série. |

---

## 2 · Avant de tourner : ce que le code répond aux « À valider »

Le storyboard demande de vérifier le rythme du jeu, l'orientation de l'écran,
le fonctionnement des codes et les chiffres du compteur de rang. Voici ce que
dit le code, et ce que ça change au storyboard.

| À valider | Ce que dit le code | Ce qu'on change au storyboard |
|---|---|---|
| **Paysage ou portrait ?** | Les deux marchent, rien n'est verrouillé (Android, iOS, PWA). Le jeu vise d'abord le paysage : « Le jeu se tient surtout en paysage » (`src/index.css:11`). | **Rien.** Le téléphone en paysage des plans 3 et 9 est juste. On le garde en paysage dans les dix plans. |
| **Le geste** | Deux zones tactiles sur toute la largeur du **bas** de l'écran, gauche et droite, qu'on **alterne**. Taper deux fois du même côté fait trébucher (`TouchControls.tsx`, `engine.ts`). | Les acteurs tapent **avec les deux pouces, en alternance, en bas de l'écran**, jamais avec un seul pouce. |
| **Le plan 2 (le bus)** | Impossible de jouer d'une seule main. | **Incohérence à corriger** : le storyboard dit « une main à la barre » *et* « les pouces à toute vitesse ». On le cale contre la barre, à l'épaule, les deux mains sur le téléphone. |
| **La cadence** | 10 appuis par seconde (les deux pouces ensemble) font environ 9,22 s au 100 m, 13 appuis par seconde environ 8,87 s. Il faut 13 à 14 appuis par seconde pour battre la meilleure IA en finale (`sprinter-core.js`). | **Le tempo du ta-ta-ta** : environ 10 appuis par seconde du lundi au jeudi, 12 à 13 à la salle (plan 5, « tempo plus rapide »), 13 à 14 dans la frénésie du plan 9. C'est le vrai rythme d'un bon 100 m. |
| **Le ta-ta-ta est-il un son du jeu ?** | **Non.** Le jeu ne joue aucun son à chaque appui, seulement une vibration légère (`engine.ts`). | **Le ta-ta-ta est un bruitage des pouces sur la vitre**, enregistré au tempo ci-dessus. C'est honnête, et tout le monde reconnaît ce bruit. (Ajouter un clic d'appui dans le jeu est possible, voir §10, mais pas nécessaire au spot.) |
| **Le « BIP » du carton final** | La version publiée fait un décompte 3-2-1 avec un bip à 660 Hz, puis un **son de départ montant** (de 1 050 à 1 365 Hz, 0,34 s). Le pistolet et la voix « à vos marques » n'existent que sur le canal de test (`sprinter-app.js`). | **On enregistre le vrai son de départ du jeu** et on le met sur le carton. Le spot finit sur le premier son qu'on entend en jouant. Si le pistolet passe en production avant le 15 novembre, on prend le pistolet. |
| **Les codes** | **Un code = une course**, pas un code personnel. Six caractères, sans 0, O, 1, I ni L (ils se dictent). Le bouton **DÉFIER UN AMI** à la fin d'une course donne le code, et le partage WhatsApp envoie « Je te défie sur Sprinter : 9,22 s sur 100 m. Code XXXXXX », suivi du lien. Pas d'expiration. Lien court : `sprinter-game.com/d/CODE`. | **« Envoie-moi ton code » est juste** : le pote envoie le code de sa course. Sur le carton, **un vrai code** : « Défie-moi avec mon code · `sprinter-game.com/d/XXXXXX` » (§5.2). Option : au plan 9, la notification WhatsApp du pote arrive sur l'écran du témoin avec le vrai texte de partage. Elle explique la mécanique sans montrer le jeu. |
| **Le compteur de rang** | Le jeu écrit **« TON RANG : 2 140 »** ou **« 2 140e »**, jamais « N° 2 140 ». `/rank` donne le rang exact, même hors du TOP 500. Aucune route publique ne donne le nombre total de joueurs. | **On prend la forme du jeu** (« 2 140e → 311e → 38e ») et **les chiffres d'un vrai joueur** (§5.3). Si le classement compte quelques milliers de noms, le compteur partira de quelques milliers, et c'est très bien : une vraie montée vaut mieux qu'un gros chiffre inventé. |
| **Le lien envoyé depuis l'app** | `challengeLink` construit le lien sur `window.location.origin` (`src/game/challenge.ts:293`). Dans l'app Capacitor, ce n'est pas `sprinter-game.com`. | **À corriger avant la révélation**, si l'app est entre les mains de joueurs. Sinon, un joueur de l'app envoie un lien qui ne marche pas (le code reste lisible dans le texte). |
| **La vidéo du replay** | Elle suit l'orientation de l'écran : horizontale si on joue en paysage (`src/game/review.ts`). Elle se termine sur un carton de 1,5 s avec le chrono, le nom, le code et `sprinter-game.com/d/CODE`. | Pour les remakes (§5.1) : **faire sa course en portrait** si on veut joindre son replay à une vidéo verticale. |

---

## 3 · Le calendrier

### Pourquoi le 15 novembre, et pas plus tôt

- **Le mode Halloween commence le lundi 19 octobre** : treize courses, une par
  jour, jusqu'au 31 (`src/game/halloween-calendrier.ts`). Le compte en parlera
  dès la semaine d'avant. Le bandeau de l'accueil reste affiché jusqu'au 3 novembre
  (`src/game/edition.ts`).
- **Révéler avant Halloween voudrait dire tourner dans les huit jours**, sans
  autorisation de lieux, sans casting, et le week-end de la finale du Championnat
  de France (26-27 septembre). Ce n'est pas tenable pour dix plans et sept lieux.
- **Deux énigmes en même temps sur le même compte s'annulent**, et le mystère
  de cinq jours du spot ressemble trop aux treize nuits d'Halloween pour les
  enchaîner sans pause.

D'où **une semaine de pause après Halloween** (2 → 8 novembre), puis le mystère
du **lundi 9 au vendredi 13 novembre**, et la révélation le **dimanche 15**.

> Les échelons continental et mondial des championnats ne sont pas datés dans
> le code (`worker/src/championnats-config.js`). Dès qu'ils le sont, vérifier
> qu'aucune finale ne tombe le dimanche 15 novembre au soir : la révélation et
> la finale se voleraient la vedette. Dans ce cas, tout décaler d'une semaine.

> Si la sortie sur l'App Store et le Play Store est prête pour mi-novembre, le
> 15 novembre peut devenir le « Jour J » du plan viral, et le spot sa vidéo
> d'annonce. Sinon, le spot renvoie au site, et c'est très bien : le jeu se
> lance en quatre secondes depuis un lien.

### Phase 0 · Préparation, en public (lundi 28 septembre → dimanche 1er novembre)

La préparation est déjà du contenu. Un dev solo qui tourne son premier spot,
c'est une histoire que le journal de dev sur X sait raconter.

| Quand | Action | Canal | Livrable |
|---|---|---|---|
| **Lun. 28 sept.** | Verrouiller le §2 : storyboard v2 (plan 2, tempo, carton, forme du rang). Demander les autorisations de lieux (§8). | — | Storyboard v2 |
| **Mer. 30 sept.** | **« On tourne notre premier spot. »** Une planche du storyboard (le vestiaire, plan 7), sans rien expliquer. | X, story IG | 1 post |
| **Ven. 2 oct.** | **Appel à figurants** parmi les joueurs : « On cherche des gens pour la file de la poste et le banc de la salle. » Les joueurs du classement passent en priorité. | Discord, IG, X | 1 post |
| **Semaine du 5 oct.** | **Sondage** : « Où est-ce que ton pote est TOUJOURS sur son téléphone ? » Les réponses nourrissent l'épisode 2. Repérages. **Enregistrement des sons** : le son de départ du jeu, et le ta-ta-ta des pouces aux trois tempos du §2. | Story IG, X | 1 sondage, les sons |
| **Sam. 10 et dim. 11 oct.** | **Tournage.** Samedi : les extérieurs (bus, parking, terrain, marches de la salle). Dimanche : les intérieurs (poste, salle, vestiaire). **Repli : 17 et 18 octobre.** | — | Rushes |
| **Sam. 10 et dim. 11 oct.** | Coulisses filmées au téléphone, **sans jamais montrer la réplique ni le vestiaire**. Elles serviront pendant la contagion. | — | 10-15 clips |
| **12 oct. → 1er nov.** | Montage : les 5 micro-teasers, la réplique, la version 31 s, puis les versions 15 s, 6 s et 2,39:1. | — | Voir §4 |
| **19 → 31 oct.** | **Halloween occupe le compte.** Le spot n'y apparaît pas, sauf dans le journal de dev sur X (une planche, un détail technique du tournage), sans rien dévoiler. | X | 2-3 posts |

### Semaine de pause (lundi 2 → dimanche 8 novembre)

| Quand | Action | Canal |
|---|---|---|
| **Lun. 2 nov.** | Le compte fait le bilan d'Halloween. **Annonce du concours « ton parcours dans le spot »** (§5.3). | Tous |
| **Sam. 7 nov.** | Relevé des rangs, accord écrit du gagnant, incrustation du compteur dans le plan 9. | — |
| **Sam. 7 nov.** | **Le code du carton** : le compte court un 100 m, touche DÉFIER UN AMI, garde le code. On le teste depuis un téléphone qui n'a jamais ouvert le jeu, en tapant `sprinter-game.com/d/CODE`. | Jeu |
| **Dim. 8 nov.** | Tout est programmé. Plus rien ne se fabrique pendant la semaine du mystère. | — |

### Phase 1 · Le mystère (lundi 9 → vendredi 13 novembre)

Chaque jour, **un seul plan du spot**, en boucle, à l'heure exacte de son
incrustation. Le jeu n'apparaît jamais. Le compte `@sprinter_game` est la seule
signature.

| Jour | Heure | Ce qui sort | Légende |
|---|---|---|---|
| **Lun. 9 nov.** | **8 h 12** | Plan 1 · la poste (3 s, en boucle) | « Lundi. Il fait quoi ? » |
| **Mar. 10 nov.** | **17 h 40** | Plan 2 · le bus | « Mardi. Il a pas levé la tête. » |
| **Mer. 11 nov.** | **12 h 05** | Plan 3 · le parking | « Mercredi. Moteur éteint. Pouces allumés. » |
| **Jeu. 12 nov.** | **18 h 30** | Plan 4 · le terrain | « Jeudi. Le match est juste là. » |
| **Ven. 13 nov.** | **19 h 15** | Plan 5 · la salle | « Vendredi. Il soulève même plus. » |

Le mercredi 11 novembre est férié : ce jour-là, le fil est lu toute la journée,
et le plan du parking reste crédible (on attend quelqu'un, on se pose dans sa voiture).

**Pourquoi ça marche :**

- **Le commentaire fait tout le travail.** « Il joue à quoi ? », « c'est Clash »,
  « il parie ». Chaque hypothèse est un commentaire, et chaque commentaire
  pousse la vidéo. **On ne répond pas, on ne confirme rien, on ne dément rien.**
- **Le son s'installe avant le produit.** Au troisième jour, le ta-ta-ta est reconnu.
- **La vidéo est courte et bouclée.** Trois secondes en boucle, on la regarde quatre
  fois pour comprendre, et la rétention monte d'autant.
- **Des lieux que tout le monde connaît.** On y tague son pote : « c'est toi ça ».
  C'est le partage le plus naturel qui existe.

**Stories du soir (21 h), les mêmes cinq jours :** un sondage à deux choix.
« Il joue ? / Il bosse ? », « Tu lui demandes ? / Tu le laisses ? ». Rien de plus.

### Phase 2 · La réplique, puis la révélation (samedi 14 et dimanche 15 novembre)

| Quand | Ce qui sort | Pourquoi |
|---|---|---|
| **Sam. 14 nov., 12 h** | **Plan 6 seul**, 5 s : la question, la réponse, le pote qui s'éloigne. On coupe **avant** le vestiaire. | La réplique vit seule une journée entière. C'est elle qu'on veut voir citée, et elle se cite mieux sans le jeu. |
| **Sam. 14 nov., 12 h** | Le **son de la réplique** publié comme son original (TikTok, Reels). | Les gens doivent pouvoir le réutiliser dès le premier jour. |
| **Dim. 15 nov., 18 h** | **La version complète, 31 s.** Épinglée sur les trois comptes. | La révélation. Le carton donne le code et l'adresse. |
| **Dim. 15 nov., 18 h 05** | **Le premier commentaire du compte, sous sa propre vidéo : le code.** « Envoie-moi ton code. Le mien : `XXXXXX`. » | Sur TikTok et Instagram, les liens ne se cliquent pas : **le code est le lien**. |
| **Dim. 15 nov., 21 h** | Story : les 5 teasers remis bout à bout, puis « Maintenant tu sais. » | Récompense ceux qui ont suivi la semaine. |
| **Dim. 15 nov.** | La **version 31 s** en tête de la chaîne YouTube, et la **version 2,39:1** en post sur X, avec le lien cliquable. | Longue traîne, et le format cinéma pour le public d'X. |

### Phase 3 · La contagion (lundi 16 novembre → dimanche 6 décembre)

**L'objectif : que les vidéos ne viennent plus du compte.** Voir §5 pour les
mécaniques.

| Quand | Action | Canal |
|---|---|---|
| **Lun. 16 nov.** | La **version 15 s** en Reels et Shorts. Le **format « refais-le »** est lancé (§5.1) : le compte publie la recette en 4 plans. | IG, YouTube, TikTok |
| **Lun. 16 → ven. 20 nov.** | **Chaque jour, une réponse-vidéo à un commentaire du mystère**, avec un code. « Il disait que c'était un jeu de foot. » | TikTok |
| **Mar. 17 nov.** | **Démarchage des créateurs, vague unique de 40** (§5.4). Chacun reçoit le spot, la recette, et le code du compte. | DM, mail |
| **Mer. 18 nov.** | Les **coulisses du tournage** : « 31 secondes, deux jours, un téléphone. » | X, TikTok |
| **Mer. 18 nov.** | La **carte du défi** relancée : « N ont essayé, M ont fait mieux », compteur lu au serveur (§5.2). | IG, X |
| **Ven. 20 nov.** | Le **classement des recruteurs** depuis la révélation : « Cette semaine, N personnes ont couru contre le fantôme de M••••• ». Chiffre lu au serveur, pseudonyme masqué sans accord. | IG, X |
| **Lun. 23 → dim. 29 nov.** | **Repost des remakes** des joueurs, un par jour, crédités, avec accord. La pub de 6 s démarre si le spot passe les seuils du §7 (§6). | Tous |
| **Lun. 30 nov. → dim. 6 déc.** | **Le bilan de la contagion** : les 5 meilleurs remakes, un par jour. Le meilleur est annoncé comme **le témoin de l'épisode 2**. | TikTok, IG |

### Phase 4 · L'épisode 2, « Bienvenue » (les vacances de Noël)

La dernière réplique du spot ouvre une suite toute faite : **le témoin est
devenu le pote.** Même dispositif, nouveau témoin, nouveaux lieux (ceux que
le sondage de la Phase 0 a fait remonter). Même ta-ta-ta, même compteur de jours.

- **Le moment s'impose : les fêtes.** Tout le monde a vu quelqu'un penché sur son
  téléphone au réveillon. Le repas de famille est le lieu que tout le monde reconnaît.
- **Le nouveau témoin est un joueur**, choisi parmi les meilleurs remakes de la
  Phase 3. C'est la récompense la plus forte qu'on puisse offrir, et elle ne
  coûte rien.
- **Le tournage est plus léger** : le dispositif est connu, le public aussi.
  Trois lieux suffisent. Tournage début décembre.
- **Ne rien promettre avant d'avoir tourné.** Une suite annoncée qui ne sort pas
  coûte plus cher que pas de suite du tout.

---

## 4 · Les pièces : quel montage, pour quel endroit

| Pièce | Contenu | Où | Rôle |
|---|---|---|---|
| **5 micro-teasers** (2-3 s, en boucle) | Plans 1 à 5, chacun seul, avec son incrustation | TikTok, Reels, Shorts | Le mystère |
| **La réplique** (5 s) | Plan 6 seul | TikTok, Reels, Shorts, X | La phrase à citer |
| **Son original** | Le ta-ta-ta, puis la réplique | TikTok, Reels | Le son que les autres réutilisent |
| **Version 31 s** | Le spot complet | Épinglée partout, YouTube, fiche Google Play | La révélation |
| **Version 15 s** | Plans 1, 2, 4, 6 raccourci, 8, 9, carton (storyboard) | Reels, Stories, créateurs | La contagion |
| **Version 6 s** | Plans 8, 9, carton (storyboard) | Pub TikTok et Meta, **bumper YouTube** (format de 6 s non désactivable) | La pub |
| **Version 2,39:1** | Recadrage du même tournage | X, YouTube, presse | Le côté cinéma |
| **Les planches du storyboard** | Les dessins crayonnés | X (journal de dev), coulisses | La préparation, en public |

**Deux endroits où le spot ne va pas :**

- **L'aperçu vidéo de l'App Store.** Apple demande que ces vidéos montrent l'app
  filmée à l'écran. Le spot ne montre jamais le jeu : il sera refusé. Google Play
  accepte en revanche une vidéo YouTube dans sa fiche, et la version 31 s y a
  sa place.
- **Une ouverture en carton noir.** La règle n° 1 du plan viral reste vraie. Le
  spot la respecte : le ta-ta-ta et la poste dès l'image 1, le carton à la fin.

---

## 5 · La contagion : faire tourner le spot sans nous

### 5.1 · Le format « refais-le avec ton pote »

La force du spot, c'est qu'il se **refait avec un téléphone et un ami**. Il ne
demande ni acteur ni décor : tout le monde a un pote toujours penché sur son écran.

**La recette publiée par le compte, en 4 plans :**

1. Ton pote sur son téléphone, dans un lieu du quotidien. Incrustation du jour et de l'heure.
2. Un deuxième lieu, le lendemain, même geste.
3. Tu lui demandes ce qu'il fait. Il répond la réplique (ou la sienne).
4. Le son du compte par-dessus, et ton code en légende. Si tu veux ajouter ton
   replay en vertical, fais ta course en portrait (§2).

**Le son est la clé.** Chaque remake qui utilise le son original renvoie vers la
vidéo d'origine, donc vers le compte. Sans son original publié le samedi 14,
cette mécanique n'existe pas.

### 5.2 · Le code, du spot jusqu'au joueur

Le spot dit « Défie-moi avec mon code ». Le jeu sait déjà le faire, et chaque
maillon existe :

- **Le compte a son code**, posé en premier commentaire sous le spot, sur les trois
  réseaux, et écrit sur le carton final. C'est un **défi ouvert**
  (`../defi-ouvert/LISEZ-MOI.md`) : il ne vise personne, tout le monde peut le
  prendre. Les codes n'expirent pas, il tient donc toute la vie du spot.
- **Le lien se dicte** : `sprinter-game.com/d/CODE` (`public/404.html`). Il s'écrit
  sur le carton, se prononce en vidéo, et l'alphabet exclut 0, O, 1, I et L.
- **La carte du défi se fabrique en une commande** et relit le compteur de
  tentatives au serveur : `node tools/carte-defi-ouvert.mjs --code XXXXXX`.
  Relancée quelques jours plus tard, elle dit « 14 ont essayé, 2 ont fait mieux ».
- **Chaque joueur qui exporte sa course repart avec son code sur le carton**
  (`src/game/carton-film.ts`). Chaque vidéo de joueur est déjà une pub jouable.
- **Donner son code fait monter au classement des recruteurs** (`GET /recruteurs`).
  C'est le tableau des scores de la contagion, et le seul classement qu'un
  joueur lent puisse gagner.

**Attention à ce que ça engage** : chaque personne qui relève le code du compte
crée un vrai duel, compté au classement. Le chrono du carton doit être un chrono
que le compte accepte de voir battu, en public, des centaines de fois. C'est
d'ailleurs ce qui rend le défi intéressant.

### 5.3 · Le concours « ton parcours dans le spot »

Le storyboard demande de remplacer les chiffres du compteur de rang
(N° 48 213 → N° 12 907 → N° 3 004) par **un vrai parcours de joueur**. Le jeu
connaît le rang exact de chacun au 100 m (`GET /rank`). On en fait un concours :

- **Annonce le lundi 2 novembre** : « Le compteur du spot sera le vrai parcours
  d'un joueur. Celui qui grimpe le plus au 100 m cette semaine est dans le spot. »
- **Relevé le samedi 7 novembre** : le rang de départ (le joueur doit être déjà
  classé le 2) et le rang d'arrivée, lus sur le serveur, jamais recopiés d'ailleurs.
  On garde aussi un rang intermédiaire : le compteur du plan 9 en affiche trois.
- **La forme du jeu** : « 2 140e → 311e → 38e », pas « N° ».
- **Accord écrit du joueur obligatoire**, pour le pseudonyme comme pour les
  chiffres. Sans accord, on passe au joueur suivant.
- **Le compteur est une incrustation** : il s'ajoute au montage, il n'oblige à
  rien retourner.

Résultat : le spot contient un vrai nom, ce nom le partage, et le compteur dit
une chose vraie.

### 5.4 · Les créateurs : une vague, pas une campagne

On reprend le ciblage et les modèles de message du plan viral (§4.1) :
**200 à 3 000 spectateurs moyens**, trois viviers (jeux compétitifs courts,
athlétisme, nostalgie arcade). Ce qui change avec le spot :

- **On n'envoie plus seulement un chrono, on envoie un sketch à refaire.** Le
  créateur a un format prêt, avec son propre pote, dans son propre décor.
- **Le message tient en quatre lignes** :

> Salut [Prénom], j'ai vu [sa vidéo précise, en trois mots].
>
> On a tourné un spot pour Sprinter, un jeu de sprint à deux pouces : [lien].
> Si tu as un pote toujours sur son téléphone, tu vois l'idée.
>
> Mon code : `XXXXXX`, sur sprinter-game.com/d/XXXXXX. Envoie-moi le tien.
>
> Si c'est nul, dis-le aussi, ça m'aide autant.

- **Une seule relance**, six jours plus tard. Jamais deux.
- **Transparence obligatoire** : si le créateur reçoit la moindre contrepartie
  (argent, cadeau, place réservée dans une course), la loi française sur
  l'influence commerciale (juin 2023) impose la mention « Publicité » ou
  « Collaboration commerciale » sur la vidéo.

---

## 6 · La pub payante, en option et sous condition

Le plan viral est bâti sans achat média, et il le reste. Le storyboard, lui,
prévoit un montage de 6 s « idéal pour les publicités ». La règle pour s'en servir :

1. **On ne paie que ce qui marche déjà sans payer.** On attend une semaine après
   la révélation. Si le spot passe les seuils du §7 en organique, on le pousse ;
   sinon, l'argent ne le sauvera pas.
2. **On pousse la vidéo d'origine**, avec ses commentaires et ses partages
   (Spark Ads sur TikTok, boost du Reel sur Instagram), plutôt qu'une pub neuve
   sans historique.
3. **Un test court, un budget plafonné** fixé à l'avance, et un critère d'arrêt
   écrit avant de lancer : le coût par nouveau joueur classé.
4. **La cible** : France, 16-30 ans, centres d'intérêt jeu mobile, basket, salle
   de sport (les lieux du spot).

---

## 7 · Les chiffres à relever

Cinq chiffres, comme dans le plan viral, relevés chaque lundi pendant la campagne.

| Indicateur | Où | Seuil | Ce qu'il dit |
|---|---|---|---|
| **Rétention à 3 s** des micro-teasers | Analytics TikTok | > 55 % | Le mystère accroche, ou pas |
| **Vidéos qui utilisent le son** | Page du son sur TikTok | À relever dès le 16 nov. | La contagion a lieu, ou pas. **C'est le chiffre de la campagne.** |
| **Tentatives sur le code du compte** | Carte du défi ouvert (compteur lu au serveur) | Chaque jour à partir du 15 nov. | Le carton final convertit, ou pas |
| **Nouveaux joueurs classés** | API du classement | Comparer la semaine du 16 nov. aux trois précédentes | La seule mesure de succès réelle |
| **Retour à J+1** des nouveaux | Serveur | > 25 % | Si c'est bas, la hype remplit un seau percé |

**La règle d'arbitrage du plan viral tient toujours :** si le retour à J+1 passe
sous 15 %, on coupe la pub payante et on travaille la première minute de jeu
avant de pousser quoi que ce soit.

---

## 8 · Les garde-fous du tournage et de la diffusion

1. **Mineurs à l'écran.** Les « gamins qui jouent au basket » du plan 4 : des
   figurants majeurs, ou des mineurs avec une autorisation écrite des parents.
   Jamais des enfants filmés au hasard sur un terrain.
2. **Passants et droit à l'image.** Le storyboard les garde flous et immobiles,
   c'est la bonne règle. Tout visage reconnaissable a signé une autorisation.
3. **Lieux privés.** Un bureau de poste, une salle de sport, un vestiaire, un bus
   en service : il faut l'autorisation de l'exploitant. Sans elle, on choisit un
   lieu équivalent qu'on peut obtenir (un commerce ami, la salle d'un club, un
   minibus loué).
4. **Marques à l'image.** Aucun logo lisible (La Poste, compagnie de bus, marque
   d'équipement) sans accord. On cadre ou on floute.
5. **Le parking.** Déjà dans le storyboard, on le garde tel quel : voiture garée,
   moteur éteint, jamais de scène de conduite.
6. **Le compteur de rang.** Des chiffres vrais, lus au serveur, avec l'accord du
   joueur (§5.3). Un chiffre d'exemple qui part en ligne est un chiffre inventé.
7. **Le code du carton final.** Un vrai code, qui marche, testé la veille de la
   révélation depuis un téléphone qui n'a jamais ouvert le jeu.

---

## 9 · La version anglaise (plus tard)

Le jeu est bilingue, et le plan viral ouvre le compte anglais à J+60. Le spot se
double sans retourner d'image, sauf une réplique : **« laver » ne se traduit pas**.
Pistes à faire tester à voix haute par des anglophones avant de doubler :
« I'm cooking everyone. », « Just smoking everybody. ». Le carton :
« How fast are you over 100 m? · Send me your code ».

---

## 10 · Ce qu'il faut coder (peu de chose)

| # | Chantier | Où | Priorité |
|---|---|---|---|
| 1 | **Le lien de défi envoyé depuis l'app** doit pointer vers `sprinter-game.com`, pas vers l'origine de la webview. | `src/game/challenge.ts:292` (`challengeLink`) | **Bloquant** si l'app est distribuée avant le 15 novembre |
| 2 | (Option) **Un clic d'appui discret**, désactivable, pour que le son du spot soit aussi celui du jeu. | `src/game/engine.ts` (le pas), `sprinter-app.js` (l'audio) | Confort. À ne faire que s'il ne gêne pas à 13 appuis par seconde. |
| 3 | (Option) **Un replay toujours vertical**, même quand on joue en paysage, pour que chaque replay entre tel quel dans un TikTok. | `src/game/review.ts` | Confort. La consigne « joue en portrait » suffit pour la campagne. |

---

## Le geste de demain matin

**Lundi 28 septembre** : corriger le plan 2 et le carton, fixer la forme du
compteur de rang, demander les autorisations de lieux, et bloquer le tournage
le week-end du 10-11 octobre. Tout le reste de ce plan en dépend. Si le tournage
tient, le mystère démarre le lundi 9 novembre à 8 h 12. S'il glisse au 17-18
octobre, le calendrier tient encore : le montage a trois semaines de marge.
