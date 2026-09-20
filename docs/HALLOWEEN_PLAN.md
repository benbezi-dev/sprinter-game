# Halloween 2026 — plan d'implémentation

Phase 0 du brief « Édition limitée Halloween 2026 ». Exploration du dépôt, points
d'extension, plan en phases, risques — et ce qui ne tient pas dans le brief.

Branche : `feature/halloween-2026`, créée sur `main` (70de401).
Date de rédaction : 20 septembre 2026.

---

## 0. À lire avant tout le reste : un mode Halloween existe déjà

Le brief est écrit comme un projet neuf. Il ne l'est pas.

**« La nuit du molosse » est en ligne sur `sprinter-game.com/test/` depuis
aujourd'hui**, et représente 2 834 lignes :

| fichier | lignes | rôle |
|---|---|---|
| `src/game/halloween.ts` | 434 | la règle : armement, position de la bête, morsure, carnet |
| `src/game/halloween-loi.js` | 148 | les 13 nuits, leurs impartis, la loi de vitesse |
| `src/game/halloween-courses.js` | 95 | les 5 tracés (100, 100 en courbe, 200, 300, 400) |
| `src/game/halloween-molosse.js` | 653 | le dessin de la bête |
| `src/game/halloween-cinema.ts` | 638 | 14 scènettes narratives |
| `src/game/halloween-musique.ts` | 110 | la musique du mode |
| `src/game/halloween-mots.ts` | 88 | les traductions FR/EN |
| `src/components/screens/Halloween.tsx` | 493 | banderole d'accueil, panneau des nuits, fin de nuit |
| `src/components/screens/HalloweenHUD.tsx` | 175 | l'écart, la jauge, le voile de menace |

Ce qui existe déjà et que le brief redemande :

- **13 courses** (`NUITS`), nommées, avec un imparti mesuré chacune ;
- un **poursuivant** — le molosse — avec loi de vitesse, morsure, et tout ce
  qu'on lui a ajouté aujourd'hui : galop à cinq foulées/seconde, réaction à la
  proximité, sol qui tremble sous ses appuis, voile qui se referme ;
- un **stade dédié** (« Cimetière municipal ») avec thème de nuit, cyprès,
  gradins clairsemés ;
- des **cinématiques** (14 scènettes) et un **carnet de progression** sauvegardé ;
- un **verrou de victoire** : `nuitOuverte() = tenues + 1`. La nuit N+1 s'ouvre
  quand la N est tenue.
- une **édition datée** (`EDITION_HALLOWEEN`, `src/game/edition.ts`).

Ce que le brief ajoute réellement :

- le **verrou calendaire** (1 course par jour, 19→31 octobre) et l'anti-triche ;
- l'écran **« Le Calendrier »** en grille de 13 cartes ;
- **13 décors distincts** au lieu d'un seul cimetière ;
- **trois types de poursuivants** (molosses, zombies, martiens) au lieu d'un ;
- les **cinématiques en 3 temps + départ lancé** ;
- le **son réactif** (Web Audio, bus séparés, spatialisation) ;
- les **options de confort** et `prefers-reduced-motion` ;
- le **voyageur temporel** et les outils testeurs.

**Décision que j'attends : on étend l'existant, ou on repart à zéro ?**
Ma recommandation ferme : **on étend**. Repartir jetterait un poursuivant qui
vient d'être réglé au pouce, 14 scènettes écrites, une musique composée et un
stade rendu dans Blender — et recréerait les mêmes bugs (j'en ai corrigé quatre
aujourd'hui, dont deux invisibles).

Conséquence si on étend : le nom du mode change-t-il ? « La nuit du molosse »
devient inexact avec des zombies et des martiens. Deux options en §7.

---

## 1. Architecture existante

### 1.1 Boucle de jeu

`src/game/engine.ts` (≈650 lignes) tient la boucle. Points saillants :

- `updateLogic(dt)` fait avancer la logique ; le rendu est appelé séparément.
  **Les deux sont dissociés** — c'est ce qui permet de piloter une course au pas
  depuis un harnais sans navigateur, et j'ai utilisé ça toute la journée.
- `G` est l'état global du jeu (`SprinterApp.G`), mutable, non réactif.
- `gameStore` est un store maison (`getSnapshot` / `subscribe` / `setState`)
  qui publie un instantané de `G` vers React via `useSyncExternalStore`.
  **React ne lit jamais `G` directement.**
- `G.shake` : secousse de caméra, décroissance à 3,2/s, déjà utilisée par le
  faux pas et branchée sur la vibration Android.
- **Crochets d'extension par image** : `G.pasHaies` et `G.pasMolosse` sont des
  fonctions posées sur `G` par les modes, appelées à chaque image après
  `stepPlayer`. C'est le point d'entrée propre d'un mode, et il est déjà utilisé.

### 1.2 Moteur de rendu — **le point dur du brief**

`src/game/sprinter-app.js` (6 794 lignes). Projection isométrique :

```js
ISO_COS = 2/√5   ISO_SIN = 1/√5
ground(X, Y) → [originX - u·ISO_COS + v·ISO_COS,
                originY - u·ISO_SIN - v·ISO_SIN]     où u = (X-camX)·m, v = (Y-camY)·m
solid(X, Y, z) = ground(X, Y) - [0, z·scaleM()]
scaleM() = ui() · (courbe ? 44 : 30)
```

Trois faits mesurés aujourd'hui, qui contraignent tout le reste :

1. **`scaleM()` est une constante par course.** Aucun terme de distance. La
   caméra est un profil à échelle fixe : rien ne grandit en approchant.
   Le molosse fait **49 × 26 pixels du premier mètre au dernier** (30 px/m),
   72 × 38 en courbe (44 px/m).
2. **La hauteur ne se raccourcit jamais** (`z · scaleM()`), alors que les
   positions au sol, elles, se raccourcissent selon la direction. C'est ce qui
   fait paraître un quadrupède monté sur échasses en virage si on n'y prend pas
   garde.
3. **Le monde est une piste World Athletics.** `Track` (`sprinter-core.js:838`)
   est deux demi-cercles de 36,50 m reliés par deux droites de 84,39 m, et
   **tout** est paramétré en `(distance le long du couloir, couloir)` :
   `T.pos(s, lane)`, `T.posDemi(s, lane, écart)`. Les coureurs, les haies, les
   obstacles, le molosse — tous.

**Conséquence directe : « on quitte la piste d'athlétisme au maximum » est
faisable pour le DÉCOR, pas pour la GÉOMÉTRIE.** Voir §4.

### 1.3 Entrées

Centralisées et propres, aucune raison d'y toucher :

- `src/hooks/use-inputs.ts` (80 lignes) — clavier, avec un filtre pour ne pas
  piloter la course quand on tape dans un champ de texte ;
- `src/components/TouchControls.tsx` (338 lignes) — les deux pavés tactiles ;
- les deux appellent `padPress(side)` / `padRelease(side)` de `engine.ts`.

Un mode n'a rien à ajouter ici : il reçoit les mêmes appuis que le sprint.

### 1.4 Système d'épreuves

- `sprinter-core.js` tient `LEVELS` (6 étapes) et `STADES_HORS_SERIE`
  (danube, cimetière, riviera, namek…), chacun avec un `plateau` par clef
  d'épreuve. **Une clef d'épreuve manquante fait tomber la construction de la
  course** — c'est le piège que j'ai rencontré en ajoutant les tracés `nuit-*`.
- `App.startOneShot([epreuve], { levelIdx })` lance une course isolée.
- Les épreuves du mode (`nuit-100`, `nuit-100v`, `nuit-200/300/400`) sont
  déclarées dans `halloween-courses.js` et leur plateau dans `sprinter-core.js`.

### 1.5 Sauvegarde

`localStorage`, une clef par domaine, aucune abstraction commune :
`sprinter_halloween` (le carnet du mode), `sprinter_acces_test` (le code
testeur), etc. **Pas de versionnage, pas de migration, pas de somme de
contrôle** — le brief en demande, il faudra les écrire.

### 1.6 Build et déploiement

- Vite. `npm run build` → `dist/` (production, `BASE_PATH=/`).
- `VITE_CANAL=test npx vite build --outDir dist-test` → `dist-test/`
  (`BASE_PATH=/test/`), déployé sous `sprinter-game.com/test/`.
- GitHub Actions `.github/workflows/deploy.yml`. **Seul un push sur `main`
  déploie — `/test` compris.**
- `EST_TEST` se replie à la compilation ; tout ce qui est derrière est retiré du
  paquet public par Rollup.
- **Les harnais `tools/*.mjs` ne tournent PAS en CI.** Ils se lancent à la main.

### 1.7 Le serveur

Worker Cloudflare, `worker/` — 16 335 lignes, 30 modules, D1 en base.
Deux choses utiles au brief :

- `worker/src/acces.js` (222 lignes) : système complet de codes testeurs —
  `creerAcces`, `verifierAcces`, `revoquerAcces`, `listerAcces`, avec
  expiration et révocation. Côté client : `PorteTest.tsx` + `canal.ts`
  (`codeAcces`, `verifierCode`). **C'est exactement ce que demande le §9 bis :
  il n'y a rien à créer.**
- `worker/src/depart.js` pose déjà le principe dont le brief a besoin :
  *« POURQUOI LA DATE EST ICI ET PAS CHEZ LE CLIENT »*. Le serveur possède les
  dates. Il n'y a pas encore d'endpoint `/now`, mais la place est faite.

### 1.8 La chaîne Blender — elle existe

**Blender est installé** (`/Applications/Blender.app/Contents/MacOS/Blender`).

`tools/blender/` contient déjà : `vue.py` (la caméra calée sur la projection du
jeu), `matiere.py`, `palettes.py`, `pieces.py`, `rendu.py`, `decors/fabriquer.py`,
`decors/verifier-vue.py`, plus `coureur.py`, `anatomie.py`, `molosse.py`.

Sortie : `public/decors/<thème>/<pièce>.webp`, chargées par `decors-stades.js`.

**Mais le modèle n'est pas celui du brief.** Ce ne sont pas des couches de
parallaxe : ce sont des **pièces** (une lanterne, une meule, un pan de tribune)
rendues sous la vue du jeu, que le moteur **compose** et range dans sa pile de
profondeur. Voir §4.3.

Coût actuel : `public/` pèse **7,0 Mo** en tout, dont 5,9 Mo de décors. Le thème
le plus lourd (`day`) pèse 1,8 Mo ; le plus léger (`nuit`) 32 Ko.

---

## 2. Points d'extension identifiés

Par ordre de propreté :

1. **`G.pasMolosse`** — crochet par image posé par le mode, déjà en place.
   Tout ce qui est logique de poursuite passe par là.
2. **`G.obstacles`** — objet à `pieces(api)` / `dessiner(ctx, api, pc)` que le
   rendu range dans sa pile de profondeur. C'est ainsi que le molosse se peint
   entre les coureurs. **Un poursuivant supplémentaire s'ajoute ici sans toucher
   au moteur.**
3. **`STADES_HORS_SERIE` + `THEMES`** — un décor nouveau est une entrée de
   table, pas du code moteur.
4. **`halloween-courses.js`** — un tracé nouveau est une entrée de table (+ son
   plateau dans `sprinter-core.js`).
5. **`canal.ts`** — les drapeaux d'ouverture, avec une convention déjà établie.
6. **Le HUD** (`HalloweenHUD.tsx`) — tout ce qui se superpose à l'écran, au-dessus
   de la pile de profondeur.
7. **`worker/src/acces.js`** — les codes testeurs.

Ce qui **n'a pas** de point d'extension et qu'il faudra écrire :

- source de temps serveur (`/now`) ;
- sauvegarde versionnée avec migration et somme de contrôle ;
- harnais de temps simulé ;
- `prefers-reduced-motion` (**totalement absent du dépôt** — zéro occurrence) ;
- bus audio séparés et spatialisation (l'audio actuel est six effets et une
  musique : `beep`, `go`, `haie`, `lose`, `trip`, `win`) ;
- captures automatisées (pas de Playwright ; mais `tools/chrome.mjs` fait des
  captures headless par le protocole DevTools **sans aucune dépendance npm** —
  c'est la solution maison et elle marche).

---

## 3. Ce qui ne tient pas dans le brief

Tu as demandé que je le dise plutôt que de coder autour. Sept points, du plus
grave au plus bénin.

### 3.1 Le budget d'assets est irréalisable tel quel — **bloquant**

Le brief demande ≤ 8 Mo par course. Treize courses : **104 Mo**.

Aujourd'hui le site entier pèse 7 Mo d'assets. Et surtout :

> **`public/` est recopié tel quel dans les DEUX builds.** Aucun drapeau ne peut
> le retenir. Je l'ai vérifié aujourd'hui en découvrant que 68 Ko de sprites
> inutilisés partaient en production, et qu'un morceau de 21 Ko + une musique de
> 708 Ko du mode Halloween étaient **téléchargeables depuis le site public**, un
> mois avant l'ouverture. J'ai corrigé les deux — mais par un greffon Vite et une
> annotation `@__PURE__`, ce qui ne marche que pour ce qui passe par le graphe de
> modules. Ce qui est dans `public/` échappe à tout.

Donc 104 Mo de décors Halloween partiraient chez chaque joueur du vrai jeu,
et révéleraient l'édition limitée avant l'heure.

**Ce qu'il faut décider :** soit un budget réaliste (je propose **≤ 900 Ko par
course, ≤ 8 Mo pour les treize**, soit l'ordre de grandeur des décors actuels),
soit un hébergement séparé des assets Halloween (R2/CDN, chargés à la demande,
absents des deux builds). La seconde option est propre mais ajoute une
infrastructure.

### 3.2 Les sprite sheets de poursuivants sont une impasse — **mesurée aujourd'hui**

Le brief demande des feuilles de 8–12 images par poursuivant, rendues dans
Blender. **J'ai fait exactement ça aujourd'hui, et je l'ai annulé après mesure.**

À 30 px/m, le poursuivant fait 49 × 26 pixels, constamment. À cette taille un
rendu ne montre rien qu'un tracé ne montre — mais il coûte huit images par
phase, par type, et il ne peut pas réagir (la proximité, la gueule qui s'ouvre,
les braises, le sens de la course : tout cela est du dessin paramétré).

Le commentaire d'origine du fichier le disait ; je l'ai écarté sans vérifier, et
la mesure lui a donné raison. Les huit images rendues sont supprimées ;
`tools/blender/molosse.py` est gardé avec la mesure en tête.

**Ce que je propose :** Blender pour les **décors** (c'est ce pour quoi la chaîne
existe et elle est bonne), **tracé paramétré** pour les **poursuivants**.
Trois types de poursuivants = trois modules de dessin de ~400 lignes, comme
`halloween-molosse.js`. Je peux prouver le rendu sur un type avant d'écrire les
trois.

### 3.3 Cinq des treize décors demandent un autre moteur

Le moteur ne connaît qu'une piste : une distance le long d'un couloir, sur un
plan. Ce qui se re-décore sans problème (la piste devient une contrainte de
largeur, les couloirs deviennent l'allée) :

| # | lieu | verdict |
|---|---|---|
| 1 | ruelle, pluie, néons | ✅ ligne droite re-décorée |
| 2 | allée de cimetière | ✅ déjà fait (le cimetière existe) |
| 3 | champ de maïs, brouillard | ✅ ligne droite + voile de visibilité |
| 4 | parking souterrain | ✅ + stroboscope |
| 5 | piste abandonnée | ✅ c'est littéralement le moteur |
| 6 | égout / tunnel inondé | ✅ courbe + sol qui freine |
| 7 | forêt, faisceaux | ✅ + zones de ralentissement |
| 9 | toits | ⚠️ les haies deviennent des sauts de vide : le timing existe, mais « le vide » sous le coureur n'existe pas — il faudrait peindre un trou dans le sol, ce que le rendu de piste ne sait pas faire |
| 12 | champ de crash, gravité par zones | ⚠️ un multiplicateur de vitesse par zone est faisable ; « gravité altérée » visuellement, non |
| 8 | manoir, couloirs et **escaliers** | ❌ un escalier est un sol à hauteur variable. Le sol du jeu est plat par construction (`solid(X,Y,z)` élève un objet AU-DESSUS du sol, il ne déforme pas le sol) |
| 10 | palais des glaces, reflets qui mentent | ❌ en tant que reflets. ✅ en tant que **double qui te double** : le système de fantômes existe (`G.ghost`) et c'est la moitié la plus forte de l'idée |
| 11 | torche, cône de vision étroit | ✅ masque au-dessus du rendu |
| 13 | finale, changement de décor **en course** | ⚠️ trois phases = trois thèmes ; le thème est lu à la construction de la course, pas par image. Faisable mais c'est une vraie modification du moteur — donc à te proposer, pas à faire en silence |

**Ce que je propose :** garder les treize lieux, mais accepter que 8 (escaliers)
devienne un couloir de manoir **à plat** avec portes qui claquent et virages
serrés, et que 10 devienne le duel contre son propre double plutôt qu'un jeu de
miroirs. Si tu veux les vrais escaliers et les vrais reflets, c'est un second
moteur de rendu, et ce n'est pas une édition limitée : c'est un autre jeu.

### 3.4 Les couches de parallaxe ne correspondent pas au moteur

Le brief décrit `layer-sky / far / mid / near / ground` — une architecture de
jeu à défilement latéral. Le moteur est isométrique : il compose des **pièces**
rangées par profondeur, et la caméra suit le coureur dans un monde, pas un
décor qui défile.

Les deux ne se marient pas. La chaîne existante (`decors/fabriquer.py`) produit
déjà la bonne chose. **Je propose de garder la structure existante** et
d'adapter le brief sur ce point.

### 3.5 Les dates entrent en conflit avec l'édition déjà déclarée

`EDITION_HALLOWEEN` (`src/game/edition.ts`) est actuellement :
**24 octobre 22:00 UTC → 3 novembre 23:00 UTC**. Le brief demande
**19 → 31 octobre**.

Il faut trancher, et un seul des deux peut vivre. Le brief est plus cohérent
(13 jours, 13 courses, finale le soir d'Halloween) ; je recommande de recaler
`EDITION_HALLOWEEN` sur le brief. **Un harnais vérifie déjà qu'aucune fenêtre
d'édition n'en recouvre une autre** — l'édition du Danube se termine le
20 septembre, il n'y a donc pas de collision.

Note : aujourd'hui, 20 septembre, la première course est **à 29 jours**. Tout se
vérifiera par le voyageur temporel, jamais en conditions réelles avant l'heure.

### 3.6 Trois points de méthode où le brief s'écarte des conventions du dépôt

Aucun n'est grave, je les signale pour que tu choisisses :

- **Le drapeau.** Le brief dit `HALLOWEEN_2026_ENABLED`. Le dépôt met tous ses
  drapeaux dans `src/game/canal.ts`, en français, avec une forme établie
  (`HAIES_OUVERTES`, `POUSSEE_OUVERTE`, `HALLOWEEN_OUVERT`) et un commentaire qui
  dit comment refermer. Je propose **`HALLOWEEN_2026_OUVERT`** dans `canal.ts` —
  mêmes garanties, même endroit, et le repli à la compilation est déjà éprouvé.
- **Le chemin de config.** Le brief dit `src/modes/halloween/races.config.ts`.
  Le dépôt n'a pas de dossier `modes/` : tout est dans `src/game/` avec un
  préfixe (`halloween-*`, `haies-*`, `longueur-*`). Je propose de suivre la
  maison : `src/game/halloween-courses.js` existe déjà et c'est exactement ce
  fichier.
- **Les tests.** Le brief demande des tests unitaires. Le dépôt n'a ni Vitest ni
  Jest : il a des **harnais autonomes** `tools/*-test.mjs` qui se lancent à la
  main (`node tools/molosse-test.mjs`) et impriment des ✓/✗. J'en ai écrit un
  aujourd'hui. Je propose de suivre la maison plutôt que d'introduire un second
  système — sauf si tu veux justement l'introduire, auquel cas c'est un chantier
  à part entière qu'il faut décider explicitement.

### 3.7 « Chair de poule chaque jour » — ce que je peux et ne peux pas promettre

Je peux livrer : la tension qui monte, le son qui se rapproche, le sol qui
tremble, la nuit qui se referme, un poursuivant qui réagit. J'en ai livré une
partie aujourd'hui et c'est mesurable.

Je ne peux pas promettre la peur **à 49 × 26 pixels vu de trois quarts en
plongée**. Ce cadrage est celui d'un jeu de sprint : il montre bien une course,
il tient mal l'oppression, parce que la peur a besoin de proximité et que cette
caméra n'en a aucune. La cinématique d'ouverture en 3 temps (§3 du brief) est
la meilleure idée du document précisément pour ça : **elle donne le gros plan
que le gameplay ne peut pas donner.** Je propose de l'exploiter à fond et de
ne pas compter sur la course elle-même pour faire peur autrement que par la
tension.

Si tu veux de la peur **pendant** la course, il faut discuter du cadrage — une
caméra basse derrière le coureur pour ce mode, ce qui est un vrai chantier de
rendu, à décider maintenant et pas en phase 4.

---

## 3 bis. Décisions prises — 20 septembre 2026

| # | décision | réponse |
|---|---|---|
| 1 | étendre ou repartir | **étendre** |
| 2 | nom du mode | *non tranché — j'applique ma recommandation : renommer, « La nuit du molosse » devient le titre de la course 1* |
| 3 | budget d'assets | **la meilleure qualité** → hébergement séparé, voir §3 bis.1 |
| 4 | courses 8 et 10 | *non tranché — j'applique ma recommandation : à plat, et le double fantôme pour la 10* |
| 5 | caméra | **on ouvre le chantier** → sonde faite, voir §3 bis.2 |
| 6 | tests | *non tranché — j'applique ma recommandation : harnais maison `tools/*.mjs`* |
| 7 | dates | *non tranché — j'applique ma recommandation : `EDITION_HALLOWEEN` recalée sur 19 → 31 octobre* |

Les quatre non tranchées sont toutes réversibles à faible coût ; dis-le si l'une
ne te convient pas, je reviendrai dessus.

### 3 bis.1 — Qualité maximale : les assets sortent de `public/`

« La meilleure qualité » et `public/` sont incompatibles : ce dossier est recopié
tel quel dans les deux builds, sans qu'aucun drapeau puisse le retenir (§3.1).
Plus on met de qualité, plus on alourdit le site public et plus on éventre la
surprise.

**Donc : un magasin d'assets séparé.** R2 (Cloudflare, déjà dans l'écosystème du
worker) ou un dossier servi hors du build, avec :

- chargement **à la demande, course par course**, derrière un écran de
  préchargement diégétique ;
- `manifest.json` versionné, avec taille, nombre d'images, fps et empreinte,
  **validé au runtime** ;
- rien dans `dist/` ni `dist-test/` : le paquet public ne contient ni les images
  ni leurs noms ;
- plus de plafond arbitraire par course — le plafond devient le **temps de
  chargement** (≤ 3 s en 4G), qui est la vraie contrainte et qu'on mesure.

C'est un chantier d'infrastructure en plus, assumé, et c'est le prix de la
qualité maximale.

### 3 bis.2 — La caméra : sonde faite, et elle change tout

**Deux mesures avant de toucher à quoi que ce soit :**

1. Les ~111 appels à la projection (`ground` 30, `solid` 27, `ptOf` 29,
   `depthOf` 6, `scaleM` 19) sont **tous dans `sprinter-app.js`** — surface
   bornée, un seul fichier.
2. `C.ISO_COS` / `C.ISO_SIN` sont lus **13 fois, toujours via `C.`, jamais
   inscrits en dur**. L'angle de vue est donc **déjà un paramètre vivant**.
   Et `scaleM()` a déjà un crochet de zoom (`zoomDuGenerique()`), posé pour le
   générique de fin.

**La sonde :** même instant de course — la bête à 2,99 m — redessiné à quatre
réglages, en écrivant dans `C` puis en le remettant.

| réglage | angle au-dessus de l'horizon | ce qu'on voit |
|---|---|---|
| actuel | 26,6° | coureur et bête minuscules, vus de haut |
| basse | 12,7° | la piste s'aplatit, les cyprès se dressent |
| basse ×2 | 12,7° | **ça devient une poursuite** : la bête est une masse noire derrière l'homme |
| rasante ×2,5 | 6,9° | la bête est grande, quadrupède net, œil rouge — c'est une image de chasse |

**Conclusion : le chantier caméra est bon marché et il fonctionne.** Ce n'est pas
un moteur de perspective à écrire, c'est deux paramètres déjà branchés.

**Mais il invalide les décors déjà rendus, et c'est pour ça qu'il fallait le
trancher avant les assets.** Les pièces Blender sont cuites « sous la vue du
jeu » à 26,6° : à 6,9° les gradins s'écrasent en bande plate et les cyprès se
déforment. Il faut re-rendre. Comme on fabrique treize décors neufs de toute
façon, le surcoût se limite au cimetière existant.

**Ce que la sonde rouvre :** à ×2,5 la bête mesure ~120 × 65 pixels au lieu de
49 × 26. Mon verdict du §3.2 — « les sprite sheets sont une impasse » — a été
mesuré à 49 × 26 et **ne vaut plus automatiquement**. À 120 × 65 un rendu
commence à montrer quelque chose. Je maintiens ma préférence pour le tracé
paramétré (il réagit : proximité, gueule, sens de course, braises — une image
cuite ne réagit pas), mais je le re-mesurerai sur pièce en phase 2 au lieu de
le décréter.

**Ce qui reste à vérifier avant de figer l'angle :** le rendu des haies et des
obstacles suppose peut-être le rapport 2:1 ; `depthOf` n'en dépend pas
(`(ax+ay)·scaleM()`), donc le rangement en profondeur tient. À contrôler en
phase 2.

**Portée :** la caméra basse est **propre au mode Halloween**. Le sprint garde sa
vue. Concrètement, `C.ISO_*` et le zoom deviennent des valeurs posées à
l'armement du mode et remises au rangement — exactement comme `G.obstacles` et
`G.pasMolosse` le sont déjà.

---

## 4. Plan d'implémentation

Phases telles que le brief les ordonne, ajustées aux constats ci-dessus.

### Phase 1 — squelette, calendrier, verrous *(la plus sûre, aucun asset)*

1. `HALLOWEEN_2026_OUVERT` dans `canal.ts`.
2. Endpoint worker **`GET /now`** → `{ ms }`, plus la lecture du header `Date`
   en repli. Cache court côté client.
3. `src/game/halloween-calendrier.ts` : **source unique de vérité du temps**,
   avec les trois garde-fous du brief (temps serveur, cliquet monotone en
   localStorage, mode hors-ligne au dernier jour validé). **Le voyageur temporel
   du mode test et le harnais de test tapent dans CE module et nulle part
   ailleurs** — exigence explicite du §9 bis, et c'est la bonne.
4. Sauvegarde `halloween2026.v1` : versionnage, migration depuis
   `sprinter_halloween`, somme de contrôle. Namespace testeur séparé
   `halloween2026.tester.v1`.
5. Verrou double : date ET victoire. Le second existe (`tenues + 1`).
6. Écran **« Le Calendrier »** : 13 cartes, compte à rebours, sceau qui se brise.
7. Harnais `tools/halloween-calendrier-test.mjs` : les 13 jours, les fuseaux, le
   changement d'heure (**Paris passe à UTC+1 le 25 octobre, au milieu de la
   fenêtre** — le piège est déjà documenté dans `edition.ts`), l'ouverture de la
   13 à 18h, l'anti-triche, la migration.
8. Non-régression : drapeau fermé, le jeu de base est identique.

*Livrable : le calendrier fonctionne, aucune course nouvelle, rien ne peut casser.*

### Phase 2 — la caméra, puis une course de bout en bout

8 bis. **La caméra du mode** : angle et zoom posés à l'armement, remis au rangement ; vérification des haies et du rangement en profondeur ; re-rendu du cimetière au nouvel angle.
8 ter. **Le magasin d'assets séparé** et son manifeste, avec l'écran de préchargement.
9. Cinématique en 3 temps + **départ lancé** (vitesse initiale non nulle, pas de
   blocs). ⚠️ Le départ du jeu est câblé sur le décompte 3-2-1 partout ; un
   départ lancé est une variante à ajouter proprement, pas à bricoler.
10. Course 1 (« Ruelle du Croissant Noir ») : décor Blender, molosse existant,
    départ lancé, victoire/défaite, écrans de fin.
11. Budget d'assets vérifié par script qui échoue au dépassement.
12. Captures headless via `tools/chrome.mjs`.

*Livrable : une course jouable, belle, dans le budget. On juge sur pièce avant
d'en faire douze autres.*

### Phase 3 — les douze autres

13. Zombies et martiens : deux modules de dessin paramétré.
14. Les douze décors restants.
15. Les modificateurs : brouillard, stroboscope, sol qui freine, faisceau,
    torche, zones de gravité, double fantôme.
16. La finale en 3 phases — **après t'avoir proposé comment changer de thème en
    course**, puisque c'est une modification du moteur.
17. Courbe de difficulté réglée sur les journaux de testeurs.

### Phase 4 — son, peur, confort, perf

18. Bus Web Audio séparés, spatialisation derrière le joueur, mix réactif.
19. Souffle, battements, stingers placés différemment à chaque course, silence
    comme outil.
20. `prefers-reduced-motion`, « Frayeur réduite », avertissement à l'entrée,
    réglages séparés.
21. Perf : 60 fps milieu de gamme, budget de draw calls documenté.
    Le dépôt sait déjà compter les appels de dessin plutôt que les pixels.
22. Chargement ≤ 3 s en 4G.

### En parallèle dès la phase 1 — le mode testeur (§9 bis)

23. Branchement sur `acces.js` / `PorteTest.tsx` **existants** : rien à créer.
24. Voyageur temporel piloté par le module de la phase 1.
25. Bandeau « MODE TEST — jour simulé : 27 oct ».
26. Outils de debug, bouton « Signaler », journalisation.
27. Harnais qui **échoue** si le code testeur ou les outils sont joignables en
    production.

---

## 5. Risques de régression

| risque | gravité | parade |
|---|---|---|
| **Les haies du jeu de base** — le mode réutilise leur logique de timing | haute | harnais dédié avant/après, drapeau fermé et ouvert |
| **`sprinter-core.js`** — chaque tracé nouveau veut sa clef de plateau, sinon la course ne se construit pas | haute | le harnais construit les 13 courses et vérifie qu'aucune ne tombe |
| **`public/` part dans les deux canaux** | haute | script de budget + vérification que rien du mode n'est dans le build public |
| **Fuite du morceau JS** — `lazy()` sans `@__PURE__` republie le mode | moyenne | `molosse-canal-test.mjs` le vérifie déjà par deux vrais builds Vite |
| **Le store `gameStore`** — tout ajout au snapshot coûte à chaque image | moyenne | ne publier que ce que React lit |
| **La pile de profondeur** — un poursuivant mal rangé passe devant/derrière | moyenne | vérification visuelle par captures |
| **Le fuseau et l'heure d'été** — Paris change le 25 octobre, au milieu | moyenne | dates en UTC, harnais sur les frontières |
| **Deux implémentations du temps** (jeu / test) | haute | une seule source, exigée par le §9 bis, imposée dès la phase 1 |

---

## 6. Ce que je n'ai pas fait, volontairement

Conformément au §9 : aucun code de production écrit. La branche ne contient que
ce document. Aucun refactor du jeu de base n'est engagé.

---

## 7. Décisions que j'attends de toi

1. **Étendre « La nuit du molosse » ou repartir à zéro ?**
   *Ma recommandation : étendre.*
2. **Si on étend, le mode change-t-il de nom ?**
   (a) garder « La nuit du molosse » et accepter que le molosse ne soit que le
   premier des poursuivants ; (b) renommer, et le molosse devient la course 1.
   *Ma recommandation : (b), avec « La nuit du molosse » comme titre de la
   course 1 — le nom est trop bon pour le jeter et trop précis pour couvrir
   treize nuits.*
3. **Budget d'assets** : ≤ 900 Ko par course dans `public/`, ou hébergement
   séparé à construire ?
   *Ma recommandation : ≤ 900 Ko, quitte à revoir à la hausse après la course 1.*
4. **Courses 8 et 10** : version à plat (faisable) ou vrai moteur de niveaux
   (autre projet) ?
   *Ma recommandation : à plat, et le double fantôme pour la 10.*
5. **La peur pendant la course** : on s'en tient au cadrage actuel, ou on ouvre
   le chantier d'une caméra basse pour ce mode ?
   *À décider maintenant, pas en phase 4.*
6. **Tests** : harnais maison `tools/*.mjs` (convention du dépôt) ou
   introduction de Vitest ?
   *Ma recommandation : harnais maison.*
7. **Dates** : je recale `EDITION_HALLOWEEN` sur 19 → 31 octobre ?

---

*Fin de la phase 0. J'attends ta validation avant d'écrire la moindre ligne de
code de production.*
