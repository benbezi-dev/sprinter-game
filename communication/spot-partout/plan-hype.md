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

---

## 1 · Ce que le storyboard contient déjà, et ce qu'on en fait

| Dans le spot | Ce que ça devient dans la campagne |
|---|---|
| **Le compteur de jours** (LUNDI · 8H12 · LA POSTE…) | **Le calendrier de publication.** Le plan 1 sort un vrai lundi à 8 h 12, le plan 2 le mardi à 17 h 40, etc. Le spot se déroule en temps réel sur le fil. |
| **Le ta-ta-ta**, identique dans chaque lieu | **La signature sonore.** On le publie comme son original TikTok et Reels, réutilisable par tout le monde. Il doit être le vrai son du jeu (§2). |
| **« Je suis en train de laver tout le monde. »** | **La réplique à mèmes.** Ambiguë, drôle, elle se cite sans contexte. C'est le hashtag et le son parlé : **#JeLaveToutLeMonde**. |
| **Le silence du vestiaire et la tentation** (plans 7-8) | **Le montage de 6 s pour la pub** : c'est le moment le plus tendu, et il tient sans le reste. |
| **Le compteur de rang** (plan 9) | **Un concours** : le vrai parcours d'un vrai joueur, avec son accord, remplace les chiffres d'exemple (§5.3). |
| **« Envoie-moi ton code. »** | **La mécanique qui existe déjà** : le défi par code, le lien `sprinter-game.com/d/CODE`, le classement des recruteurs. L'appel à l'action est dans l'histoire, pas plaqué. |
| **« Bienvenue. »** | **La suite.** Le témoin devient le pote. L'épisode 2 a un nouveau témoin (§3, phase 4). Le spot devient une série. |

---

## 2 · Avant de tourner : ce que le code répond aux « À valider »

_(section complétée à partir du code, voir plus bas)_

---

## 3 · Le calendrier

**Contraintes tenues par le code et par les plans existants :**

- le calendrier Instagram en cours s'arrête le **dimanche 4 octobre** ;
- l'édition **Halloween** (« la nuit du molosse ») s'affiche du **samedi 24 octobre
  au mardi 3 novembre**, heure de Paris (`EDITION_HALLOWEEN`, `src/game/edition.ts`).

**Le choix recommandé : révéler le spot le dimanche 18 octobre, six jours avant
Halloween.** Le spot fait venir les nouveaux joueurs ; l'édition Halloween leur
donne une raison de revenir chaque soir. On acquiert, puis le jeu retient tout
seul.

**La règle : la semaine du mystère ne chevauche jamais Halloween.** Deux énigmes
en même temps sur le même compte s'annulent. Si le tournage glisse après le
4 octobre, **toute la campagne se décale de trois semaines** : mystère du lundi
2 au vendredi 6 novembre, révélation le dimanche 8 novembre.

### Phase 0 · Préparation, en public (lundi 28 septembre → dimanche 11 octobre)

La préparation est déjà du contenu. Un dev solo qui tourne son premier spot,
c'est une histoire que le journal de dev sur X sait raconter.

| Quand | Action | Canal | Livrable |
|---|---|---|---|
| **Lun. 28 sept.** | Verrouiller les réponses du §2 (son, orientation, code, rang). Rien ne se tourne avant. | — | Storyboard v2 |
| **Mar. 29 sept.** | **« On tourne notre premier spot. »** Une planche du storyboard (le vestiaire, plan 7), sans rien expliquer. | X, story IG | 1 post |
| **Mer. 30 sept.** | **Appel à figurants** parmi les joueurs : « On cherche des gens pour la file de la poste et le banc de la salle. » Les joueurs du classement passent en priorité. | Discord, IG, X | 1 post |
| **Jeu. 1er oct.** | **Sondage** : « Où est-ce que ton pote est TOUJOURS sur son téléphone ? » Les réponses nourrissent l'épisode 2. | Story IG, X | 1 sondage |
| **Sam. 3 et dim. 4 oct.** | **Tournage.** Samedi : les extérieurs (bus, parking, terrain, marches de la salle). Dimanche : les intérieurs (poste, salle, vestiaire). | — | Rushes |
| **Sam. 3 et dim. 4 oct.** | Coulisses filmées au téléphone, **sans jamais montrer le plan de la réplique ni le vestiaire**. Elles serviront pendant la contagion. | — | 10-15 clips |
| **Lun. 5 → ven. 9 oct.** | Montage : les 5 micro-teasers, la réplique, la version 31 s. Les versions 15 s et 6 s après. | — | Voir §4 |
| **Sam. 10 oct.** | **Les codes existent avant la révélation** : le compte court, lance un défi ouvert, et garde le code pour le carton final (§5.2). | Jeu | 1 code |
| **Dim. 11 oct.** | Tout est programmé. Plus rien ne se fabrique pendant la semaine du mystère. | — | — |

### Phase 1 · Le mystère (lundi 12 → vendredi 16 octobre)

Chaque jour, **un seul plan du spot**, en boucle, à l'heure exacte de son
incrustation. Le jeu n'apparaît jamais. Le compte `@sprinter_game` est la seule
signature.

| Jour | Heure | Ce qui sort | Légende |
|---|---|---|---|
| **Lun. 12 oct.** | **8 h 12** | Plan 1 · la poste (3 s, en boucle) | « Lundi. Il fait quoi ? » |
| **Mar. 13 oct.** | **17 h 40** | Plan 2 · le bus | « Mardi. Il a pas levé la tête. » |
| **Mer. 14 oct.** | **12 h 05** | Plan 3 · le parking | « Mercredi. Moteur éteint. Pouces allumés. » |
| **Jeu. 15 oct.** | **18 h 30** | Plan 4 · le terrain | « Jeudi. Le match est juste là. » |
| **Ven. 16 oct.** | **19 h 15** | Plan 5 · la salle | « Vendredi. Il soulève même plus. » |

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

### Phase 2 · La réplique, puis la révélation (samedi 17 et dimanche 18 octobre)

| Quand | Ce qui sort | Pourquoi |
|---|---|---|
| **Sam. 17 oct., 12 h** | **Plan 6 seul**, 5 s : la question, la réponse, le pote qui s'éloigne. On coupe **avant** le vestiaire. | La réplique vit seule une journée entière. C'est elle qu'on veut voir citée, et elle se cite mieux sans le jeu. |
| **Sam. 17 oct., 12 h** | Le **son de la réplique** publié comme son original (TikTok, Reels). | Les gens doivent pouvoir le réutiliser dès le premier jour. |
| **Dim. 18 oct., 18 h** | **La version complète, 31 s.** Épinglée sur les trois comptes. | La révélation. Le carton donne le code et l'adresse. |
| **Dim. 18 oct., 18 h 05** | **Le premier commentaire du compte, sous sa propre vidéo : le code.** « Envoie-moi ton code. Le mien : `XXXXXX`. » | Sur TikTok et Instagram, les liens ne se cliquent pas : **le code est le lien**. |
| **Dim. 18 oct., 21 h** | Story : les 5 teasers remis bout à bout, puis « Maintenant tu sais. » | Récompense ceux qui ont suivi la semaine. |
| **Dim. 18 oct.** | La **version 31 s** en tête de la chaîne YouTube, et la **version 2,39:1** en post de X. | Longue traîne, et le format cinéma pour le public d'X. |

### Phase 3 · La contagion (lundi 19 octobre → dimanche 8 novembre)

**L'objectif : que les vidéos ne viennent plus du compte.** Voir §5 pour les
mécaniques.

| Quand | Action | Canal |
|---|---|---|
| **Lun. 19 oct.** | La **version 15 s** en Reels et Shorts. Le **format « refais-le »** est lancé (§5.1) : le compte publie la recette en 4 plans. | IG, YouTube, TikTok |
| **Lun. 19 → ven. 23 oct.** | **Chaque jour, une réponse-vidéo à un commentaire**, avec un code. « Il dit que c'est un jeu de foot. » | TikTok |
| **Mar. 20 oct.** | **Démarchage des créateurs, vague unique de 40** (§5.4). Chacun reçoit le spot, la recette, et **son code**. | DM, mail |
| **Mer. 21 oct.** | Les **coulisses du tournage** (Phase 0) : « 31 secondes, deux jours, un téléphone. » | X, TikTok |
| **Ven. 23 oct.** | Premier **classement des recruteurs** rendu public depuis la révélation : « Cette semaine, N personnes ont couru contre le fantôme de M••••• ». Chiffre lu au serveur, pseudonyme masqué sans accord. | IG, X |
| **Sam. 24 oct. → mar. 3 nov.** | **Halloween prend le compte.** Le spot ne sort plus de nouveau contenu ; on ne fait que **reposter les remakes** des joueurs, avec leur accord. La pub de 6 s continue de tourner si elle tourne (§6). | Tous |
| **Mer. 4 → dim. 8 nov.** | **Le bilan de la contagion** : les 5 meilleurs remakes, un par jour, crédités. | TikTok, IG |

### Phase 4 · L'épisode 2, « Bienvenue » (à partir de mi-novembre)

La dernière réplique du spot ouvre une suite toute faite : **le témoin est
devenu le pote.** Même dispositif, nouveau témoin, nouveaux lieux, ceux que le
sondage de la Phase 0 a fait remonter. Même ta-ta-ta, même compteur de jours.

- **Le nouveau témoin peut être un joueur**, choisi parmi les meilleurs remakes
  de la Phase 3. C'est la récompense la plus forte qu'on puisse offrir, et elle
  ne coûte rien.
- **Le tournage est plus léger** : le dispositif est connu, le public aussi.
  On peut ne tourner que trois lieux.
- **Ne rien promettre avant d'avoir tourné.** Une suite annoncée qui ne sort pas
  coûte plus cher que pas de suite.

---

## 4 · Les pièces : quel montage, pour quel endroit

| Pièce | Contenu | Où | Rôle |
|---|---|---|---|
| **5 micro-teasers** (2-3 s, en boucle) | Plans 1 à 5, chacun seul, avec son incrustation | TikTok, Reels, Shorts | Le mystère |
| **La réplique** (5 s) | Plan 6 seul | TikTok, Reels, Shorts, X | La phrase à citer |
| **Son original** | Le ta-ta-ta, puis la réplique | TikTok, Reels | Le son que les autres réutilisent |
| **Version 31 s** | Le spot complet | Épinglée partout, YouTube, page du jeu | La révélation |
| **Version 15 s** | Plans 1, 2, 4, 6 raccourci, 8, 9, carton (storyboard) | Reels, Stories, créateurs | La contagion |
| **Version 6 s** | Plans 8, 9, carton (storyboard) | Pub TikTok et Meta, **bumper YouTube** (format de 6 s non désactivable) | La pub |
| **Version 2,39:1** | Recadrage du même tournage | X, YouTube, presse | Le côté cinéma |
| **Les planches du storyboard** | Les dessins crayonnés | X (journal de dev), coulisses | La préparation, en public |

**Deux endroits où le spot ne va pas :**

- **L'aperçu vidéo de l'App Store.** Apple demande que ces vidéos montrent l'app
  filmée à l'écran. Le spot ne montre jamais le jeu : il sera refusé.
  Google Play accepte en revanche une vidéo YouTube dans sa fiche : la version
  31 s y a sa place.
- **L'ouverture du fil.** La règle n° 1 du plan viral reste vraie : pas de carton
  noir en ouverture. Le spot la respecte (le ta-ta-ta et la poste dès l'image 1).
  Le carton final est à la fin, c'est ce qui compte.

---

## 5 · La contagion : faire tourner le spot sans nous

### 5.1 · Le format « refais-le avec ton pote »

La force du spot, c'est qu'il se **refait avec un téléphone et un ami**. Il ne
demande ni acteur ni décor : tout le monde a un pote toujours penché sur son écran.

**La recette publiée par le compte, en 4 plans :**

1. Ton pote sur son téléphone, dans un lieu du quotidien. Incrustation du jour et de l'heure.
2. Un deuxième lieu, le lendemain, même geste.
3. Tu lui demandes ce qu'il fait. Il répond la réplique (ou la sienne).
4. Le son du compte par-dessus. Ton code en légende.

**Le son est la clé.** Chaque remake qui utilise le son original renvoie vers la
vidéo d'origine, et donc vers le compte. Sans son original publié le samedi 17,
cette mécanique n'existe pas.

### 5.2 · Le code, du spot jusqu'au joueur

Le spot dit « Défie-moi avec mon code ». Le jeu sait déjà le faire, et chaque
maillon existe :

- **Le compte a son code**, posé en premier commentaire sous le spot, sur les trois réseaux.
  C'est un **défi ouvert** (`../defi-ouvert/LISEZ-MOI.md`) : il ne vise personne,
  tout le monde peut le prendre.
- **Le lien se dicte** : `sprinter-game.com/d/CODE` (`public/404.html`). Il s'écrit
  sur le carton, se prononce en vidéo, et l'alphabet exclut 0, O, 1, I et L.
- **La carte du défi se fabrique en une commande** et relit le compteur de
  tentatives au serveur : `node tools/carte-defi-ouvert.mjs --code XXXXXX`.
  Relancée deux jours plus tard, elle dit « 14 ont essayé, 2 ont fait mieux ».
- **Chaque joueur qui exporte sa course repart avec son code sur le carton**
  (`src/game/carton-film.ts`). Chaque vidéo de joueur est déjà une pub jouable.
- **Donner son code fait monter au classement des recruteurs** (`GET /recruteurs`).
  C'est le tableau des scores de la contagion.

**Un code, un post** : le compte ne recycle pas un code d'une semaine sur l'autre.

### 5.3 · Le concours « ton parcours dans le spot »

Le storyboard demande de remplacer les chiffres du compteur de rang
(N° 48 213 → N° 12 907 → N° 3 004) par **un vrai parcours de joueur**. Le jeu
connaît le rang exact de chacun (`GET /rank`, calculé sur le classement du
100 m). On en fait un concours :

- **Annonce le lundi 5 octobre** : « Le compteur du spot sera le vrai parcours
  d'un joueur. Celui qui grimpe le plus cette semaine est dans le spot. »
- **Relevé le samedi 10 octobre** : le rang de départ (le joueur doit être
  déjà classé le 5) et le rang d'arrivée, lus sur le serveur, jamais recopiés
  d'ailleurs. On garde aussi deux ou trois rangs intermédiaires : le compteur
  du plan 9 en affiche trois.
- **Accord écrit du joueur obligatoire**, pour le pseudonyme comme pour les
  chiffres. Sans accord, le joueur suivant.
- **Le compteur est une incrustation** : il s'ajoute au montage, il n'oblige pas
  à retourner quoi que ce soit.

Résultat : le spot contient un vrai nom, ce nom le partage, et le compteur dit
une chose vraie.

### 5.4 · Les créateurs : une vague, pas une campagne

On reprend le ciblage et les modèles de message du plan viral (§4.1) :
**200 à 3 000 spectateurs moyens**, trois viviers (jeux compétitifs courts,
athlétisme, nostalgie arcade). Ce qui change avec le spot :

- **On n'envoie plus seulement un chrono, on envoie un sketch à refaire.** Le créateur
  a un format prêt, avec son propre pote, dans son propre décor.
- **Le message tient en quatre lignes** :

> Salut [Prénom], j'ai vu [sa vidéo précise, en trois mots].
>
> On a tourné un spot pour Sprinter, un jeu de sprint à deux pouces : [lien].
> Si tu as un pote toujours sur son téléphone, tu vois l'idée.
>
> Mon code : `XXXXXX` sur sprinter-game.com. Envoie-moi le tien.
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

1. **On ne paie que ce qui marche déjà sans payer.** On attend 72 h après la
   révélation. Si le spot passe les seuils du §7 en organique, on le pousse ;
   sinon, l'argent ne le sauvera pas.
2. **On pousse la vidéo d'origine**, avec ses commentaires et ses partages
   (Spark Ads sur TikTok, boost du Reel sur Instagram), plutôt qu'une pub neuve sans historique.
3. **Un test court, un budget plafonné**, fixé à l'avance, et un critère d'arrêt
   écrit avant de lancer : coût par joueur classé.
4. **La cible** : France, 16-30 ans, centres d'intérêt jeu mobile, basket, salle de
   sport (les lieux du spot).

---

## 7 · Les chiffres à relever

Cinq chiffres, comme dans le plan viral, relevés chaque lundi pendant la campagne.

| Indicateur | Où | Seuil | Ce qu'il dit |
|---|---|---|---|
| **Rétention à 3 s** des micro-teasers | Analytics TikTok | > 55 % | Le mystère accroche, ou pas |
| **Vidéos qui utilisent le son** | Page du son sur TikTok | À relever dès le 19 oct. | La contagion a lieu, ou pas. **C'est le chiffre de la campagne.** |
| **Tentatives sur le code du compte** | Carte du défi ouvert (compteur lu au serveur) | À relever chaque jour à partir du 18 oct. | Le carton final convertit, ou pas |
| **Nouveaux joueurs classés** | API du classement | Comparer la semaine du 19 oct. aux trois précédentes | La seule mesure de succès réelle |
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
3. **Lieux privés.** Un bureau de poste, une salle de sport, un vestiaire, un
   bus en service : il faut l'autorisation de l'exploitant. Sans elle, on
   choisit un lieu équivalent qu'on peut obtenir (un commerce ami, la salle
   d'un club, un minibus loué).
4. **Marques à l'image.** Aucun logo lisible (La Poste, compagnie de bus, marque
   d'équipement), sauf accord. On cadre ou on floute.
5. **Le parking.** Déjà dans le storyboard, on le garde tel quel : voiture garée,
   moteur éteint, jamais de scène de conduite.
6. **Le compteur de rang.** Des chiffres vrais, lus au serveur, avec l'accord du
   joueur (§5.3). Un chiffre d'exemple qui part en ligne est un chiffre inventé.
7. **Le code sur le carton final.** Un vrai code, qui marche, testé la veille de
   la révélation depuis un téléphone qui n'a jamais ouvert le jeu.

---

## 9 · La version anglaise (plus tard)

Le jeu est bilingue, le plan viral ouvre le compte anglais à J+60. Le spot se
double sans retourner d'image, sauf une réplique : **« laver » ne se traduit pas**.
Pistes à tester à l'oral avec des anglophones avant de doubler :
« I'm cooking everyone. », « I'm washing everybody. » (trop littéral), « Just smoking
everyone. ». Le carton : « How fast are you over 100 m? · Send me your code ».

---

## Le geste de demain matin

**Lundi 28 septembre** : verrouiller les réponses du §2 et fixer le tournage au
week-end du 3-4 octobre. Tout le reste de ce plan en dépend : si le tournage
tient, le spot se révèle le 18 octobre et laisse ses nouveaux joueurs à
l'édition Halloween ; s'il glisse, la campagne entière part trois semaines plus
tard, et rien d'autre ne change.
