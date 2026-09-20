# Halloween 2026 — architecture, écarts, et plan d'implémentation

> **Phase 0.** Exploration du dépôt et plan, avant toute ligne de code nouvelle.
> Écrit le **20 septembre 2026**, sur la branche `claude/sprinter-halloween-2026-r68w39`.
>
> **À lire en premier, §3 :** une partie du mode demandé **existe déjà et
> tourne**, construite autrement que ce que décrit le brief. Le reste du
> document part de là.

---

## 1. Ce que ce document est

Le brief demande treize courses d'Halloween, une par jour du 19 au 31 octobre
2026, chacune dans un décor différent, chacune ouverte par une cinématique et
courue en départ lancé, avec un mode test pour les testeurs.

Le dépôt contient déjà **un mode Halloween de treize nuits, jouable, mesuré et
testé**, qui répond à une partie de cette demande — et qui répond
différemment à l'autre partie. Ce document sert donc à trois choses :

1. poser l'architecture du jeu telle qu'elle est (§2) ;
2. dire ce qui est déjà construit, et ce que le brief ne sait pas (§3) ;
3. dire franchement ce qui, dans le brief, **ne tient pas** contre ce moteur
   (§5) — plutôt que de coder autour, ce que le brief lui-même demande.

Les décisions qui vous reviennent sont rassemblées en §6, chacune avec deux
options tranchées et une recommandation. Le plan par phases est en §7.

---

## 2. L'architecture existante

### 2.1 La boucle de course

`src/game/sprinter-core.js` tient le modèle : `Track`, `Runner`, `RACES`,
`LEVELS`, `STADES_HORS_SERIE`. C'est du JavaScript nu, sans dépendance au
navigateur — ce qui est précisément ce qui permet aux harnais de le charger
sous node et de mesurer une course sans ouvrir un onglet.

- La logique avance à **pas fixe de 1/240 s** (`updateLogic`), découplée du
  rendu. Un harnais qui échantillonnerait plus grossièrement mesurerait un
  autre jeu que celui qu'on publie.
- `Runner.stepPlayer` intègre la foulée du joueur ; `stepAI` donne aux
  adversaires une montée en vitesse exponentielle calée pour couvrir leur
  distance en un temps visé.
- `src/game/engine.ts` expose `SprinterApp` et `useGameStore` (zustand-like)
  vers React. `G` est l'état de la course en cours.

### 2.2 Le rendu

Un **seul canvas**, `src/components/GameCanvas.tsx`, piloté par
`sprinter-app.js` (`requestAnimationFrame`). Tout le jeu est dessiné à la
main : piste, couloirs, coureurs, tribunes, décor. React ne dessine que
l'interface **par-dessus** — HUD, panneaux, écrans de fin — jamais la course.

C'est la propriété la plus utile du projet pour ce qu'on veut ajouter : un
effet de course (tremblement, vignette, halo, distorsion) se pose dans la
boucle canvas sans toucher à un seul composant React, et inversement.

### 2.3 Les entrées

`src/hooks/use-inputs.ts` pour le clavier, `src/components/TouchControls.tsx`
pour les deux pavés tactiles. Le contrat est simple et unique :
`Runner.press('left' | 'right', t)`. Les haies y ont ajouté l'appel
(`APPEL_JOUEUR`, `haies-pas.js`) sans le casser.

**Conséquence directe** : tout ce qu'on ajoute passe par ce même contrat, ou
ne passe pas. Aucune régression sur les haies ni sur le sprint classique n'est
acceptable, et c'est vérifiable (§8).

### 2.4 Les épreuves, les stades

- `RACES[cle]` est la table des épreuves. Elle se lit **à une quinzaine
  d'endroits** — libellé, record, plateau, partage, défi. Y ajouter une
  épreuve suffit à la faire exister partout.
- `LEVELS` / `STADES_HORS_SERIE` sont les lieux. Le **cimetière municipal**
  (`cle: 'cimetiere'`, `theme: 'halloween'`) y est déjà, ouvert pour toujours,
  avec son plateau de sept adversaires et sa foule clairsemée (`foule: 0.34`).
- `Track` prend **un arc et une ligne droite**, et fabrique la géométrie
  demandée. C'est tout ce qu'il sait faire. Retenir ce point : il commande
  toute la §5.1.

### 2.5 La sauvegarde

`localStorage`, par clés nommées, sans schéma versionné ni somme de contrôle.
Le mode Halloween utilise `sprinter_halloween` (`src/game/halloween.ts`,
`Carnet`). Le reste du jeu parle à un worker Cloudflare (`worker/`, base D1)
qui porte les classements, les duels, les championnats, le relais, les
notifications et leur journal — mais **le mode Halloween ne parle à aucun
serveur** : ni classement, ni duel.

### 2.6 Le build et les deux canaux

C'est le mécanisme le plus important du dépôt pour ce travail, et il est déjà
en place (`src/game/canal.ts`).

Deux versions sont publiées à la même adresse : le jeu, et **une version de
test** où tout est ouvert et qui reçoit les nouveautés en premier.

```
export const EST_TEST = import.meta.env.VITE_CANAL === 'test';
export const HALLOWEEN_OUVERT = EST_TEST;
```

La forme compte : `import.meta.env.VITE_CANAL` est remplacé **par sa valeur
littérale à la compilation**, si bien que `HALLOWEEN_OUVERT` devient `false`
en dur dans le build public et que le bundler **supprime tout ce qui en
dépend**. Les modes fermés ne sont pas cachés : ils ne sont pas embarqués.
Un drapeau lu au chargement n'aurait pas cette propriété.

Le canal de test est protégé par un **code d'accès** (`sprinter_acces_test`),
vérifié par le worker (`POST /test/entrer`), et porté par un `fetch` enveloppé
sur toutes les requêtes vers notre serveur. Sans code, rien ne part — une
requête non marquée atterrirait dans la base de production.

**C'est le mécanisme de mode test que le brief (§9 bis) demande d'identifier et
sur lequel se brancher.** Il existe, il est hors du bundle en clair, il est
validé par un endpoint. Il ne reste qu'à lui ajouter ce qui lui manque (§7,
phase 4).

### 2.7 Le pipeline Blender

Il existe, il est scripté, et il produit déjà les décors du jeu :

```
tools/blender/decors/fabriquer.py   # une pièce → WebP + entrée de manifeste
tools/blender/decors/{vue,matiere,palettes,pieces,tribune}.py
src/game/decors-manifeste.json      # ax/ay (le pied de la pièce), w, h, portée
public/decors/<stade>/*.webp        # 6 Mo pour LES HUIT STADES du jeu
```

Deux rendus par pièce (couleur en émission + ombre au sol par Cycles),
recoupés au plus juste, avec `pxParM: 96`. Le manifeste dit au moteur où est
le pied de la pièce et combien de pixels vaut un mètre.

Le cimetière, lui, n'a **aucune pièce bakée** : il est dessiné
procéduralement dans `sprinter-app.js` (cyprès, herbe éteinte, gradins
clairsemés, dégradé de ciel).

### 2.8 Les harnais de test

Une cinquantaine dans `tools/*.mjs`, lancés à la main par `node`. Deux
concernent ce mode et **passent tous les deux aujourd'hui** :

- `tools/molosse-test.mjs` — pose la loi de la bête sur le **vrai moteur** et
  vérifie la promesse du mode et l'échelle des treize nuits. 25 vérifications.
- `tools/molosse-canal-test.mjs` — compile le paquet **par canal** avec
  esbuild et vérifie ce qui arrive dans le build du joueur, pas ce que dit la
  source.

La discipline du projet, lisible partout : **ce qui se vérifie sans lancer une
course doit pouvoir se vérifier sans lancer une course.** D'où des fichiers
comme `halloween-loi.js` et `edition.ts` qui n'ont **aucun import**, pour être
chargeables nus sous node.

---

## 3. Ce qui est déjà construit — et que le brief ne sait pas

| Demande du brief | État réel |
| --- | --- |
| 13 courses | **Fait** — treize nuits, `halloween-loi.js` |
| Difficulté au-dessus du jeu de base, brutale à la 13 | **Fait et mesuré** — de 5,5 à 13,75 appuis/s |
| Une course jouable de bout en bout | **Fait** — le molosse, le HUD, les écrans de fin |
| Poursuivant incarné, pas un compteur | **Fait** — le molosse, galop en quatre temps |
| Décors variés | **Partiel** — un seul lieu, **cinq tracés** |
| Cinématique | **Fait, mais APRÈS la course** — quatorze scénettes |
| Départ lancé, sans blocks | **Non** — départ ordinaire du one shot |
| Déverrouillage 1/jour, 19→31 oct | **Non** — déverrouillage **par victoire** |
| Anti-triche sur la date | **Non** |
| Écran « Le Calendrier » | **Non** — un tableau de treize lignes |
| Son du poursuivant, spatialisé | **Non** — `halloween-son.ts` est cité dans un commentaire et **n'existe pas** |
| Musique | **Fait** — une pièce écrite, 50 s, chargée à la demande |
| Frayeur réduite, avertissement | **Non** |
| Mode test | **Partiel** — le canal de test et son code existent |

### Le cœur du mode, tel qu'il est

Une règle, et c'est sa qualité principale : **le molosse franchit la ligne
exactement au temps imparti.** « Passer dans les temps » et « ne pas se faire
rattraper » ne sont pas deux conditions, c'est la même écrite deux fois. Le
chrono dit ce que la bête fait ; la bête montre ce que le chrono compte.

Le compte à rebours a pris la place du chronomètre ordinaire. Il n'y a **pas
de barre de vie** : une jauge en bas d'écran n'apparaît qu'à douze mètres, et
le sol tremble sous les foulées de la bête (deux battements par foulée, le
postérieur plus lourd que l'antérieur), via `G.shake` et la vibration Android.

Cette règle a déjà coûté une réécriture : la première loi de position faisait
mordre à 2,5 s un joueur qui avait dix secondes au compteur. C'est le harnais
qui l'a dit. **Elle ne doit pas être cassée par ce qu'on ajoute**, et c'est le
premier risque de régression (§8).

---

## 4. Les points d'extension identifiés

Ce qu'on peut ajouter **sans toucher** au sprint classique ni aux haies :

1. **`RACES` par `Object.assign`** — déjà fait par `halloween-courses.js`.
   Toute épreuve nouvelle entre par là.
2. **`STADES_HORS_SERIE`** — un lieu nouveau est une entrée dans la table plus
   un `theme` traité dans le dessin de fond de `sprinter-app.js`.
3. **Les crochets posés sur `G`** — `G.pasMolosse`, `G.surRetourAccueil`,
   `G.obstacles`. C'est la boucle de course qui vient nous chercher, image
   après image, exactement comme elle va chercher les haies. Aucun mode n'a
   besoin de poser sa propre boucle.
4. **Le canal et ses drapeaux** (`canal.ts`) — un `&&` en tête, et le bundler
   suit. C'est l'interrupteur unique que demande le brief (§9 bis,
   garde-fous).
5. **Le calque React au-dessus du canvas** — HUD, panneaux, calendrier,
   bandeau testeur : rien de tout cela ne touche au rendu.
6. **Le manifeste de décors** (`decors-manifeste.json`) — une clé de stade
   nouvelle, et le moteur place les pièces sans rien savoir d'elles.
7. **Les harnais `tools/*.mjs`** — le voyageur temporel du brief (§9 bis) et
   les tests de déverrouillage (§8.1, §8.2) doivent partager **une seule
   source de vérité** ; le projet a déjà la discipline qu'il faut pour ça
   (fichiers sans import).

---

## 5. Ce qui ne tient pas dans le brief

Le brief demande de le dire franchement plutôt que de coder autour. Voici les
sept points, du plus lourd au plus léger.

### 5.1 Le manoir, les toits, les escaliers — le moteur ne sait pas faire

`Track` prend **un arc et une ligne droite**. C'est toute sa géométrie.

Sont donc hors de portée sans écrire un second moteur :

- course 8, « manoir : hall, couloirs, escaliers », *changements de
  direction, perte de repères* ;
- course 9, « toits de la ville », *les haies deviennent des sauts de vide* —
  le saut de vide demande une chute, donc un axe vertical que le jeu n'a pas ;
- course 12, *gravité altérée par zones, sol instable* ;
- course 6, *virages serrés* ;
- course 10, *ton propre double te double* — demande un second coureur piloté
  par l'historique du joueur.

Ce n'est pas « difficile », c'est **un autre jeu**. Sprinter est un jeu de
cadence sur une ligne : le joueur alterne deux appuis, et la seule variable
est le rythme. Un couloir de manoir avec des virages n'a pas de geste à
proposer au joueur — il n'y a rien à faire d'autre que taper plus vite, comme
partout ailleurs, avec un décor qui prétend le contraire.

**Ce qui se fait à la place, et qui est honnête** : le jeu a déjà prouvé qu'il
sait dépayser sans changer de geste. Le 100 m **en virage** et les lignes
droites de 200/300/400 m n'existent nulle part dans l'athlétisme, et suffisent
à ce que le joueur ne sache pas ce qui l'attend. Un décor nouveau + un tracé
nouveau + un effet de visibilité, c'est ce que le moteur rend bien.

### 5.2 Le budget d'assets est hors d'échelle

Le brief demande ≤ 8 Mo **par course**, soit jusqu'à 104 Mo pour treize.

Aujourd'hui, **tout le décor du jeu pèse 6 Mo**, pour huit stades. Le jeu est
une PWA installable qu'on ouvre sur un téléphone en 4G.

Pire, et c'est un piège dans lequel ce mode est **déjà tombé une fois** :
`public/` est **recopié tel quel dans les deux builds**. Huit images du
molosse y ont été posées, sont parties dans le build public — où le mode
n'existe pas — et ont dû être retirées, parce qu'aucun drapeau ne peut
retenir `public/`.

**Donc** : les assets d'Halloween ne peuvent pas aller dans `public/` tant que
le mode est fermé au public. Ils doivent passer par `src/assets` + import
dynamique (ce que fait déjà la musique, 700 Ko dans un morceau séparé chargé à
l'ouverture du tableau), ou attendre l'ouverture du mode à tout le monde.

**Proposition** : ≤ 900 Ko par course, ≤ 6 Mo pour les treize, chargés
course par course. Un script de budget qui échoue au-delà (le brief le demande
en §8.6, c'est la seule partie de son §4 qu'on peut tenir telle quelle).

### 5.3 Blender n'est pas disponible ici

Le brief demande de l'installer ou de le signaler immédiatement. **Il n'est
pas dans cet environnement d'exécution** (`command -v blender` ne rend rien),
et cette session tourne dans un conteneur éphémère sans accès réseau
arbitraire. Les scripts existent et sont versionnés ; **ils ne peuvent pas
être exécutés ici**.

Deux conséquences :
- les rendus doivent se faire sur une machine avec Blender (les scripts sont
  écrits pour ça : `blender -b -P tools/blender/decors/fabriquer.py -- --stade X`) ;
- ce que je peux produire ici, ce sont les **scripts** et le fallback
  procédural canvas — qui est, comme le dit le brief, un placeholder.

Et une remarque sur le molosse, parce qu'elle a déjà été payée : le rendu
Blender de la bête a été **condamné par la mesure**. À l'écran elle fait
49 × 26 pixels du premier mètre au dernier — `scaleM()` vaut `ui() * 30` en
ligne droite, sans terme de distance. À cette taille, un rendu ne montre rien
qu'un tracé ne montre déjà. Le script est gardé pour le jour où il faudra une
affiche. **Pour les décors, c'est l'inverse** : ils sont grands, ils sont
fixes, et le pipeline existe déjà pour eux.

### 5.4 Le ton : quatorze scénettes drôles sont déjà écrites

Le brief est catégorique : thriller, oppression, chair de poule, *pas de
Halloween mignon*.

`halloween-cinema.ts` contient quatorze scénettes d'après-course — six pour
les nuits tenues, huit pour les morsures — écrites sous deux règles explicites
et assumées : **la chute est toujours sur la dernière ligne**, et **on ne
montre jamais la blessure** (le molosse arrache un mollet, et la scénette
parle d'un rond-point et d'un règlement de compétition). Le héros n'est jamais
fier : il est promu, flashé, filmé, refusé par un club.

C'est délibéré, c'est bien écrit, c'est le contenu réel du mode (« la course
dure onze secondes, la scène reste ») — et c'est **l'inverse** de ce que le
brief demande. Il y a aussi une raison de fond : *« un jeu où l'on court se
joue aussi chez des gens de douze ans. »*

C'est une décision de direction artistique, pas une décision technique. Elle
est en §6, décision A.

### 5.5 Le double verrou de dates contre les treize nuits déjà ordonnées

Le brief veut : une course par jour calendaire, du 19 au 31 octobre, verrou de
date **et** verrou de victoire.

Ce qui existe : verrou de victoire seul (`nuitOuverte() = tenues + 1`), sans
date. L'édition (`edition.ts`) n'ouvre qu'une **bannière**, du 24 octobre au
3 novembre, et la règle du dépôt est nette : *« ce qui est daté, c'est la
bannière ; le lieu ne l'est pas »* — parce qu'un stade qui disparaît est un
chrono qu'on ne peut plus rejouer.

Ajouter le verrou de date est **faisable et propre** (c'est le gros de la
phase 1), mais il faut savoir ce qu'on achète :

- la fenêtre du brief est **13 jours** (19→31 oct) ; celle d'`edition.ts` est
  de 10 jours et commence le **24** ; il faut la reculer ;
- après le 31 octobre, le mode ne peut pas se refermer sans contredire la
  règle du dépôt. Les treize nuits doivent rester jouables en février.
  **Ce qui est daté, c'est l'ouverture progressive — pas l'accès.**
- il est **déjà arrivé** que deux verrous justes séparément aient une
  intersection vide, et que le mode soit déployé et injouable pendant des
  jours sans que personne ne le voie. Un troisième verrou demande un harnais
  qui calcule l'intersection, pas trois relectures.

### 5.6 Le départ lancé coûte plus cher qu'il n'en a l'air

Le mode **se pose sur le one shot**, il ne s'en fabrique pas un autre : une
nuit *est* un 100 m au cimetière lancé par `startOneShot`. C'est ce qui lui
donne gratuitement le faux départ, la pause, l'enregistrement de la trace, le
film de la course, les records et le retour arrière du téléphone.

Un départ lancé (vitesse initiale non nulle, pas de pistolet) demande de
toucher à la machine à états du départ dans le moteur — partagée avec le
sprint classique, les haies, le relais et la course en direct. **C'est le seul
point du brief qui demande de modifier le jeu de base**, ce que le brief
interdit par ailleurs.

Faisable : `Runner` accepte une vitesse initiale, et l'état `'countdown'` peut
être court-circuité pour une course marquée. Mais c'est du code dans le
chemin commun, et ça se paie en tests de non-régression sur quatre modes.

### 5.7 Deux contraintes de §7 sont en tension l'une avec l'autre

« 60 fps sur mobile milieu de gamme », « ≤ 3 s de chargement en 4G », et
« cinq couches de parallaxe par course, ≤ 250 Ko chacune » ne tiennent pas
ensemble sur un seul canvas 2D qui dessine déjà huit coureurs, une piste, des
tribunes et un HUD. Cinq couches en défilement, c'est cinq `drawImage`
plein écran par image, avant d'avoir dessiné quoi que ce soit du jeu.

Le fond actuel du cimetière est procédural et ne coûte presque rien. La
proposition en §7 est : **deux couches bakées** (lointain, médian) + le sol
procédural, ce que le moteur encaisse.

---

## 6. Les décisions à trancher

### Décision A — le ton des scénettes

> **Option A1 — on garde les quatorze scénettes, on durcit tout le reste.**
> La peur est dans la course (son, proximité, obscurité, stinger) ; le
> relâchement est après, quand c'est fini. C'est une structure connue et
> efficace : on respire une fois la porte fermée. Coût : zéro. Risque : le
> brief dit explicitement non.
>
> **Option A2 — on écrit quatorze scénettes de remplacement, noires.**
> Même dispositif (quatre lignes, servies une à une), ton de thriller. Les
> anciennes restent dans le dépôt derrière un drapeau. Coût : une journée
> d'écriture, aucun code. Risque : perdre le meilleur contenu du mode pour
> quelque chose de moins bon, et déplacer le curseur d'âge.

**Ma recommandation : A2**, parce que le brief est non négociable sur ce
point et que c'est votre appel, pas le mien — mais je vous dis que A1 est
meilleur en l'état, et que la peur d'un jeu de sprint se joue **pendant** les
onze secondes, pas après. Si vous prenez A2, la partie « chair de poule »
doit être gagnée en §7 phase 3 (le son), pas dans les scénettes.

### Décision B — treize décors, ou cinq lieux tenus

> **Option B1 — treize décors, un par nuit, comme le brief.**
> Treize séries de rendus Blender, treize ambiances, treize fonds. Coût réel :
> deux à trois semaines de production hors code, budget d'assets à négocier
> (§5.2), et cinq des treize mécaniques restent impossibles (§5.1) — donc
> treize décors dont cinq mentent sur ce qu'ils promettent.
>
> **Option B2 — cinq lieux, tenus, sur les cinq tracés existants.**
> Ruelle (100 m), cimetière (100 m en courbe), champ de maïs (200 m en
> ligne), tunnel (300 m), grand cimetière (400 m + finale). Chaque lieu est
> rendu correctement, avec sa brume, sa lumière et son poursuivant. Les
> treize nuits les parcourent en alternance — ce qu'elles font déjà.

**Ma recommandation : B2.** Le jeu vous a déjà dit ce qui marche : ce n'est
pas le nombre de décors, c'est de ne pas savoir ce qui vient. Cinq lieux
finis valent mieux que treize esquissés, et le budget tient.

### Décision C — le départ lancé

> **Option C1 — vrai départ lancé, dans le moteur.** Le brief à la lettre.
> Coût : modification du chemin commun, tests de non-régression sur quatre
> modes.
>
> **Option C2 — la cinématique se termine sur le pistolet.** Les trois temps
> du brief (poursuivants / visage / dézoom), puis « SURVIS », puis le départ
> ordinaire enchaîné sans coupure de caméra. Le joueur ne voit pas de blocks
> — le cadrage ne les montre pas — mais la machine à états ne bouge pas.

**Ma recommandation : C2 pour la phase 2, C1 en phase 5 si le ressenti
manque.** On ne touche pas au départ de quatre modes pour un effet qu'on n'a
pas encore mesuré.

### Décision D — les retours des testeurs (§9 bis)

Le brief demande deux options si le projet ne collecte pas déjà les retours.
Il n'a pas de route de retour utilisateur — mais il a **tout ce qu'il faut
pour en avoir une** : une base D1, et un motif déjà établi deux fois pour
noter ce qui échoue en silence (`worker/src/journal.js` pour les
notifications, `worker/src/refus.js` pour les noms refusés, écrit après
qu'un record du monde du jeu se soit perdu sans laisser de trace).

> **Option D1 — un endpoint sur le worker existant.** `POST /test/retour`,
> protégé par le code testeur déjà en place. Les retours arrivent dans D1 avec
> le reste. Coût : une route, une table, une migration.
>
> **Option D2 — export presse-papiers / JSON.** Le bouton « Signaler »
> capture l'état et le copie ; le testeur le colle où vous lisez déjà. Coût :
> quasi nul. Perte : rien n'est agrégé, et le journal par course que demande
> le brief (où les testeurs meurent le plus) n'existe pas.

**Ma recommandation : D1**, parce que le brief demande explicitement un
journal par course pour régler la courbe de difficulté, et que D2 ne le donne
pas. L'infrastructure d'accès testeur est déjà là.

---

## 7. Le plan par phases

Chaque phase finit par un résumé court, des captures, ce qui reste, ce qui
m'inquiète — comme demandé. Commits atomiques, branche
`claude/sprinter-halloween-2026-r68w39`, drapeau `HALLOWEEN_OUVERT`.

### Phase 1 — le calendrier et ses verrous *(la plus importante)*

- `src/game/halloween-calendrier.ts` — **sans aucun import**, comme
  `halloween-loi.js`, pour être chargeable nu par les harnais.
  - les treize dates, 19→31 octobre 2026, écrites en UTC et commentées en
    heure de Paris (le changement d'heure tombe le 25 octobre : UTC+2 avant,
    UTC+1 après — c'est déjà le piège documenté dans `edition.ts`) ;
  - la nuit 13 à **18 h 00 locales** le 31 octobre ;
  - le double verrou : `dateAtteinte(n, maintenant) && tenue(n-1)`.
- **L'heure, et à qui on la demande.** Source de vérité = en-tête `Date` d'un
  `HEAD` sur le site, en cache court ; garde-fou monotone en `localStorage`
  (on ne redescend jamais sous le plus haut jour atteint) ; hors ligne = le
  dernier jour validé, jamais un jour futur.
- **Le carnet versionné** `halloween2026.v1` avec migration depuis
  `sprinter_halloween` (le carnet actuel) et somme de contrôle simple.
  Migration, pas remplacement : des joueurs de `/test` ont déjà des nuits
  tenues.
- **Le voyageur temporel**, une seule implémentation, partagée par les tests
  et le mode testeur — c'est ce que le brief exige en §9 bis, et c'est la
  discipline du dépôt.
- Harnais : `tools/molosse-calendrier-test.mjs` — dates, fuseaux, changement
  d'heure, verrou de victoire, anti-triche, **et l'intersection des trois
  verrous** (canal × fenêtre × date), parce que c'est l'erreur qui a déjà
  coûté plusieurs jours.
- Écran **« Le Calendrier »** : treize cartes, teaser, compte à rebours,
  sceau qui se brise, marque sur les nuits tenues. Il remplace le tableau
  actuel de treize lignes.

### Phase 2 — la cinématique d'ouverture et le départ

- Trois temps (poursuivants / visage effrayé / dézoom), 6–8 s, variantes par
  type de poursuivant, **skippable après la première vision** — le carnet
  sait déjà retenir ce qui a été vu (`vues`).
- Enchaînement sans coupure de caméra vers le départ (décision C).
- Le canvas de cinématique réutilise `halloween-cinema.ts`, qui sait déjà
  peindre une scène.

### Phase 3 — le son *(là où se gagne la chair de poule)*

`src/game/halloween-son.ts` — **le fichier que les commentaires citent déjà et
qui n'existe pas.** Aujourd'hui, la bête est muette.

- Bus séparés : ambiance / poursuivant / joueur / interface / stinger.
- Le poursuivant **spatialisé derrière**, qui se rapproche : pas de barre de
  vie, la peur se mesure à l'oreille. Les données sont là (`c.ecart`, `c.v`,
  `proximite(c)`), rien à calculer de neuf.
- Souffle du coureur qui se dégrade ; battements de cœur sous 1,5 s d'écart.
- Sous 1 s : vignette rouge qui pulse, saturation qui tombe, distorsion — tout
  dans la boucle canvas, aucun composant React touché.
- Un stinger par nuit, à un endroit imprévisible ; silence 0,4 s avant.

### Phase 4 — le mode testeur *(§9 bis)*

- Branché sur `codeAcces()` / `verifierCode()` **existants** — pas de second
  système. Expiration au 1er novembre 2026.
- Les treize nuits ouvertes, verrou de victoire levé, voyageur temporel
  (même harnais que la phase 1).
- Bandeau permanent « MODE TEST — jour simulé : 27 oct ».
- **Progression isolée** : `halloween2026.tester.v1`, namespace séparé ;
  sortir du mode test restaure la progression réelle intacte.
- Outils : saut de cinématique, rejeu instantané, vitesse de la bête, écart en
  secondes, FPS, forcer victoire/défaite.
- Bouton « Signaler » (décision D).
- **Garde-fous** : `tools/molosse-testeur-canal-test.mjs` — compile le build
  public et **échoue** si le code testeur ou les outils de debug y sont
  joignables ; et un test qui vérifie qu'un joueur sans code voit bien douze
  cartes verrouillées avant le 19 octobre.

### Phase 5 — décors, confort, performance

- Décors selon la décision B, via le pipeline Blender existant, **hors de
  `public/`** tant que le mode est fermé (§5.2).
- Écran d'avertissement à l'entrée ; option **« Frayeur réduite »** ;
  `prefers-reduced-motion` (le jeu le respecte déjà ailleurs) ; volume des
  stingers séparé ; tremblement désactivable ; pas de stroboscope > 3 Hz.
- Budget d'assets vérifié par script qui échoue au-delà.
- Captures Playwright headless des treize nuits et des trois temps de
  cinématique, **que je regarde et critique avant de vous les montrer**.
- Non-régression du jeu de base, drapeau désactivé **et** activé.

---

## 8. Les risques de régression

1. **Casser la promesse du mode.** Toute retouche à la loi de position, aux
   temps impartis ou aux tracés doit rejouer `tools/molosse-test.mjs`. Cette
   promesse a déjà été fausse une fois, et seul le harnais l'a vue.
2. **L'intersection des verrous.** Trois verrous — canal, fenêtre, date — qui
   sont chacun justes et dont l'intersection est vide. C'est arrivé, le mode
   a été déployé et injouable plusieurs jours. Un harnais qui calcule
   l'intersection, pas trois relectures.
3. **`public/` part dans les deux builds.** Déjà payé une fois (les huit
   images du molosse). Aucun asset d'Halloween dans `public/` tant que le mode
   est fermé.
4. **Le départ lancé touche au chemin commun** (décision C). Si C1 est
   retenue : non-régression sur sprint, haies, relais et course en direct.
5. **La migration du carnet.** Des joueurs de `/test` ont des nuits tenues
   sous `sprinter_halloween`. `halloween2026.v1` doit migrer, pas remplacer.
6. **`G.obstacles` est partagé** avec les haies. `rangerLaNuit` ne rend la
   place que si c'est bien la bête qui l'occupe — cette précaution existe, ne
   pas la perdre.
7. **La perte du one shot.** Le mode hérite du faux départ, de la pause, du
   film, des records. Fabriquer une boucle à part les perdrait tous.
8. **Le poids du build public.** `HALLOWEEN_OUVERT` doit rester une constante
   en tête d'un `&&`. Un `as any` ou un `?.` casse le remplacement littéral et
   tout le mode part en production. C'est arrivé : 37 Ko de WebRTC.

---

## 9. Ce que je ne fais pas sans votre validation

- Réécrire les quatorze scénettes (décision A).
- Produire treize décors plutôt que cinq (décision B).
- Toucher à la machine à états du départ (décision C).
- Ajouter une route au worker (décision D).
- Reculer la fenêtre d'`EDITION_HALLOWEEN` du 24 au 19 octobre.
- Remplacer le tableau des treize nuits par l'écran « Le Calendrier ».

**Je m'arrête ici et j'attends votre retour**, comme le demande le brief
(§9, phase 0). Dites-moi A/B/C/D, et j'enchaîne sur la phase 1.
