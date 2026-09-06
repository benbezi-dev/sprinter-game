# Reel « 100 m » — 10 secondes, une prise, une coupe

`sprinter-reel-100m-1080x1920.mp4` — 9:16, 30 i/s, **10,00 s pile**, H.264 High /
yuv420p, faststart, son AAC.

La course n'est pas une maquette : elle est **jouée dans le jeu**, capturée
image par image, et le son est celui du jeu, rendu depuis ses propres
synthétiseurs. Rien de ce qui est à l'écran n'a été redessiné à côté.

| | |
|---|---|
| Chrono | **8,75 s** — 1re place, 10,3 m d'avance |
| Réaction | 0.167 s, +1.03 m/s — le jeu affiche `RÉACTION` |
| Transition | **PARFAITE** — +0.55 m/s, 78 % de freinage |
| Niveau | Jeux olympiques ; le favori annoncé, Blaze Kade, court en 9.63 s |
| Prises | une seule |
| Coupes | une seule, à 00:09,00 |
| Couverture | `couverture-1080x1920.png` |
| Sous-titres | `sous-titres.srt` — incrustés dans la vidéo |

**L'horloge du reel et celle de la course ne sont pas la même.** Le pistolet
part à 00:00,27, jamais sur la première image : il faut avoir vu l'instant
d'avant pour qu'un départ en soit un. La course dure 8,75 s, **la ligne tombe
donc à 00:09,00 pile**, et il reste exactement une seconde de chrono figé.

```
0,25 s d'avant-départ  +  8,75 s de course  +  1,00 s figée  =  10,00 s
```

---

## 1. Le plan de tournage

Tous les instants ci-dessous sont **relevés sur la capture**, pas estimés :
`chronologie.json` porte l'état du jeu à chacune des 271 images.

| Temps | Course | Ce qu'on voit | Ce qu'on entend | Coupe |
|---|---|---|---|---|
| **00:00 → 00:01** | −0,27 → 0,73 | Cadre serré ×1,5. L'anneau du compte à rebours tient sur « 1 », le bandeau dit PRÊTS, la pastille annonce `à battre : Blaze Kade — 9.63 s`. **00:00,27 — le pistolet** : l'anneau disparaît, le voile se lève, le chrono part. **00:00,43** : la carte `RÉACTION — 0.167 s +1.03 m/s`. Le carton d'accroche est déjà en place depuis 00:00,15. | La boucle de course (Jeux olympiques, 140 bpm) tourne déjà. Le bip du pistolet à 00:00,27, montant, 0,34 s. Un second bip, court, à 00:00,43 : le jeu accuse réception de la réaction. | — |
| **00:01 → 00:02** | 0,73 → 1,73 | Mise en action, buste incliné, phase POUSSÉE. **00:01,60 — le joueur passe 8e à 1er.** **10 m à 00:01,90.** | La boucle, seule. | — |
| **00:02 → 00:03** | 1,73 → 2,73 | **00:02,30 — 15 m** : le buste se redresse, la phase passe à TRANSITION, le jeu affiche **TRANSITION PARFAITE** `+0.55 m/s — 78% drag` et **un éclair blanc** qui dure jusqu'à 00:02,70. La carte RÉACTION s'efface à 00:02,63. **20 m à 00:02,70.** **00:02,60 → 00:03,00 : le cadre s'ouvre** du ×1,5 au plein cadre, en 400 ms, ralenti sur la fin. | Le bip de réussite à 00:02,30, sur la boucle. | — · l'ouverture est un recadrage sur la même prise, pas une coupe |
| **00:03 → 00:04** | 2,73 → 3,73 | Plein cadre, et il n'en bougera plus. Le carton **À BATTRE 8,75 s** entre à 00:03,00, à l'instant où le cadre s'ouvre. **30 m à 00:03,47.** Chrono en haut à droite, doré, lisible en permanence. | La boucle, seule. | — |
| **00:04 → 00:05** | 3,73 → 4,73 | **00:04,27 — 40 m** : le corps est entièrement redressé, la phase passe à VITESSE MAX. Le carton sort à 00:04,60, la carte TRANSITION à 00:04,70. | La boucle, seule. | — |
| **00:05 → 00:06** | 4,73 → 5,73 | **50 m à 00:05,07.** Le cadre est net : la course, le chrono, un sous-titre. C'est la seconde où l'on tient, ou bien on perd le spectateur. | La boucle, seule. | — |
| **00:06 → 00:07** | 5,73 → 6,73 | **60 m à 00:05,83, 70 m à 00:06,63.** L'écart sur Blaze Kade se creuse, la pastille de droite le compte. | La boucle, seule. | — |
| **00:07 → 00:08** | 6,73 → 7,73 | **80 m à 00:07,43.** La ligne d'arrivée entre par la droite. | La boucle, seule. | — |
| **00:08 → 00:09** | 7,73 → 8,73 | **90 m à 00:08,23.** Puis, à **00:09,00 — le buste passe la ligne, le HUD affiche 8.75. LA COUPE.** Arrêt sur cette image. | **La musique s'arrête net sur la coupe.** Le jeu ne donne aucun son au passage de la ligne — sa fanfare arrive trois secondes plus tard, sur l'écran de résultat, bien après la fin du reel. Le silence est donc la seule ponctuation disponible, et c'est la bonne. | **✂ 00:09,00 — la seule coupe du reel** |
| **00:09 → 00:10** | — | L'image reste figée, chrono bloqué sur 8.75, 1re place, 10,3 m d'avance. Le carton **TON TOUR** entre avec la coupe et tient la seconde entière. | Silence. | — |

Le reel boucle proprement : il finit sur un silence et repart sur une boucle
qui tourne déjà.

### Les passages, relevés sur la capture

| Passage | Image | Reel | Chrono |
|---|---|---|---|
| 10 m | 57 | 00:01,90 | 1.65 |
| 20 m | 81 | 00:02,70 | 2.45 |
| 30 m | 104 | 00:03,47 | 3.22 |
| 40 m | 128 | 00:04,27 | 4.02 |
| 50 m | 152 | 00:05,07 | 4.82 |
| 60 m | 175 | 00:05,83 | 5.58 |
| 70 m | 199 | 00:06,63 | 6.38 |
| 80 m | 223 | 00:07,43 | 7.18 |
| 90 m | 247 | 00:08,23 | 7.98 |
| **100 m** | **270** | **00:09,00** | **8.75** |

### Le cadre serré des trois premières secondes

`scale(1.5)` ancré en haut à droite de l'image. Ce coin-là et pas un autre :
c'est le seul qui garde à la fois le chrono du HUD et la carte RÉACTION.

De 00:02,60 à 00:03,00, retour à l'échelle 1, en `ease-out` cubique. Une seule
prise du début à la fin : ce mouvement est un recadrage, il ne coupe rien.

### Les bandes de l'image

| Bande | Ce qui s'y trouve |
|---|---|
| 0 → 250 | HUD du jeu : étape, place, phase, chrono, barre de progression. |
| 250 → 560 | Les cartes du jeu : RÉACTION, puis TRANSITION PARFAITE. |
| 560 → 980 | **Les cartons**, sur un voile sombre en dégradé. |
| 980 → 1290 | La course. |
| 1290 → 1500 | **Les sous-titres**, sur le même voile. |
| 1500 → 1920 | Zones tactiles du jeu et interface Instagram. |

**Le voile n'est pas décoratif.** La piste est bleue et verte en plein jour :
un texte blanc posé dessus se lit une image sur deux, selon ce qui passe
derrière. Un dégradé sombre sans bord visible rend le fond prévisible sans
poser de cadre.

---

## 2. Les cartons

Trois, jamais deux à la fois. Outfit 800 en capitales pour ce qui se lit,
Space Mono 700 pour ce qui se mesure — la charte du dossier `promo`. Entrées
et sorties en 120 ms d'opacité, sans glissement : à cette vitesse un mouvement
ne se lit pas, il salit.

### C1 — l'accroche · 00:00,15 → 00:02,90

> **TU PENSES AVOIR DES RÉFLEXES ?**
> **PROUVE-LE EN 10 SECONDES.**

Outfit 800, 72 px. Deux lignes blanches, deux lignes dorées. En place à
00:00,15, **avant le pistolet** : on ne lit pas une accroche pendant qu'on
regarde un départ.

### C2 — le chrono à battre · 00:03,00 → 00:04,60

> À BATTRE
> **8,75 s**

Le libellé en Space Mono 700, 30 px, interlettrage 0,42 em. Le chiffre en
Space Mono 700, 132 px, doré. Il entre à l'instant exact où le cadre s'ouvre :
la course prend sa taille réelle et le chiffre à battre arrive avec elle.

### C3 — ton tour · 00:09,00 → 00:10,00

> **TON TOUR**
> sprinter-game.com

Il entre **avec** la coupe, pas après : la seconde qui reste est courte, et le
chrono figé vit en haut à droite pendant que le carton vit au milieu — ils ne
se disputent rien. L'adresse ne figurait pas dans la commande ; un reel qui
accroche sans dire où jouer se termine sur rien.

---

## 3. Les sous-titres

`sous-titres.srt` — quatre répliques, incrustées dans la vidéo.

Personne ne parle dans ce reel : les sous-titres **sont** le commentaire. Ils
tiennent le rôle de l'homme au bord de la piste, et sans eux le reel ne
raconte rien à qui regarde sans le son, c'est-à-dire à presque tout le monde.

Ils sont incrustés, et pas déposés en piste : Instagram génère ses sous-titres
depuis la parole, et il n'y en a pas — la piste automatique resterait vide.

**Rien entre 00:02,50 et 00:04,80.** Le jeu y affiche sa propre carte
TRANSITION PARFAITE et le carton du chrono à battre y passe : une troisième
ligne de texte au même instant ne se lirait pas, elle salirait les deux
autres. Plus de 20 caractères par seconde ne se lit pas non plus ; la réplique
la plus dense est à 17.

---

## 4. La couverture

`couverture-1080x1920.png`, et sa source `couverture.html`.

```sh
CHROME=/chemin/vers/chrome ./couverture.sh
```

Deux choses dessus, rien d'autre : « 100 M » en Outfit 800 capitales, petit et
gris ; « 8,75 s » en Space Mono 700, doré, sur le fond de nuit de la charte.
L'or n'est porté que par le chiffre — deux ors se disputeraient l'œil à la
taille d'un ongle, et c'est le chiffre qui doit gagner.

**Le chiffre est aussi grand que la largeur le permet, et c'est la bande qui
lui donne son tiers de hauteur.** Space Mono a une chasse de 0,612 em pour une
hauteur de chiffre de 0,72 em : « 8,75 » vaut donc 2,448 em de large pour
0,72 em de haut, un rapport de 3,4 pour 1. Porter le chiffre à 640 px de haut
— le tiers de 1920 — demanderait 889 px de corps, soit **2 176 px de large, le
double du cadre**. À 400 px de corps, virgule resserrée, il mesure 859 px de
large sur 288 px de haut et occupe toute la largeur utile ; le tiers médian de
l'image (y 640 → 1280) lui est réservé, vide de tout le reste.

Vérifié à 126 px de large, et sous les deux recadrages de la grille de profil
(1:1 et 4:5) — le chiffre tient dans les trois.

---

## Refabriquer le reel

Le jeu doit être construit et servi ; le reste s'enchaîne.

```sh
npm install && npm run build && npx vite preview --port 4173   # a la racine
cd assets-stores/promo && npm install                          # puppeteer + ffmpeg
cd reel-100m
node calibrer.mjs      # trouve la sequence d'appuis qui donne 8,75 s
node tournage.mjs      # joue la course et capture 271 images + la telemetrie
node habillage.mjs     # recadrage, cartons, sous-titres, gel -> 300 images
node son.mjs           # rend la bande son depuis les synthetiseurs du jeu
./encoder.sh           # MP4
```

La vidéo, son son et les images intermédiaires ne sont pas au dépôt : ils s'y
refabriquent à l'identique, et le dépôt garde la recette plutôt que le plat —
comme le film « nouveautés » à côté.

### L'horloge posée, et pourquoi tout en dépend

Le jeu tourne dans un navigateur sans tête, mais **pas en temps réel**.
`requestAnimationFrame`, `performance.now` et `Date.now` sont remplacés avant
que le premier script de l'application ne s'exécute : le moteur avance
exactement d'un pas de physique (1/240 s) quand on le lui demande, et pas d'un
iota de plus.

Trois conséquences, et ce sont elles qui justifient le détour.

1. **La course est reproductible.** Même séquence d'appuis, même chrono, à la
   milliseconde. On peut donc *viser* 8,75 s et les obtenir, au lieu de
   relancer une capture en temps réel jusqu'à ce que le hasard tombe juste.
   Le plateau est semé par-dessus (`G.graineCourse`) : mêmes adversaires,
   même tirage, à chaque tournage.
2. **Les images sont propres.** Aucune n'est sautée, aucune n'est doublée : la
   capture ne court pas après le jeu, c'est le jeu qui attend la capture.
3. **C'est le vrai rendu.** Le canevas du jeu et le HUD React, tels que les
   voit un joueur.

Deux réglages ont demandé une mesure plutôt qu'une hypothèse, et les deux se
voyaient à l'image :

- **La fenêtre fait 540 × 960 points à l'échelle 2**, pas 1080 × 1920 points.
  C'est la largeur en points qui choisit la mise en page : à 1080, on passe
  au-dessus du palier `md` de Tailwind et le HUD ouvre un classement latéral
  que personne ne voit sur un téléphone.
- **Le pistolet est mesuré, pas supposé.** Le compte à rebours dure trois
  secondes de jeu, soit 720 sous-pas — en théorie. En pratique l'horloge du
  moteur accumule ses pas un à un et dérive d'un sous-pas ou deux ; la capture
  se décalait d'autant, et l'image de l'arrivée tombait à cinq centimètres de
  la ligne. On joue donc le compte à rebours une première fois pour savoir où
  tombe le départ, puis on rejoue la course en se calant dessus.

### La calibration

`calibrer.mjs` cherche la séquence d'appuis **dans le navigateur**, pas dans
une simulation. Une simulation hors ligne du même moteur donne la bonne forme
— montée de cadence sur les quinze premiers mètres, puis cadence tenue — mais
pas le bon chiffre au centième : le jeu quantifie chaque appui sur son pas de
physique, et ce décalage d'un sous-pas suffisait à faire tomber la note de
transition de PARFAITE à bonne. La simulation était pile sur le seuil de 1,20.

Deux conditions, et la seconde est facile à manquer :

- le chrono doit **afficher** 8,75 ;
- il doit tomber **avant** l'image 270, pas après. Cette image-là est prise à
  8,75 s pile de chrono ; si l'arrivée se joue un sous-pas plus tard, le HUD
  affiche bien 8.75 mais le buste n'a pas encore coupé.

La séquence retenue : premier appui à 0,167 s, dix appuis de montée de 0,130 s
à 0,060 s d'écart, puis **16,8 appuis par seconde** tenus jusqu'à la ligne.
139 appuis en tout.

### Le son

Le jeu ne joue aucun fichier : sa musique et ses bruitages sont synthétisés à
l'exécution. `son.mjs` échange le contexte audio du jeu contre un
`OfflineAudioContext`, lui demande de rebâtir ses buffers dedans, et rejoue la
séquence exacte du reel — la boucle de course prise à l'endroit où elle en
est, le coup de pistolet, le bip de la réaction, le bip de la transition, puis
le silence à la coupe. Ce sont les mêmes ondes que celles qu'entend un joueur,
aux mêmes instants.

---

## D'où vient 8,75 s

Le chiffre n'est pas choisi pour sonner bien : c'est le seuil que le jeu
lui-même désigne. En finale, les ZEZE courent le 100 m entre 8,75 et 9,00 s —
`RACES['100']`, dernier rang de `ranges`. Descendre sous 8,75 s, c'est battre
le meilleur adversaire du jeu.

La commande demandait 8,25 s. Ce chrono-là tombe sous tout ce que le code
documente comme atteignable, y compris sous le plancher mesuré à dix-sept
appuis par seconde : le reel aurait affiché une marque que le jeu ne rend pas.

**Ce qu'il faut pour 8,75 s, mesuré sur le moteur.** Les chiffres inscrits
dans `RACES['100']` — 8,87 s à treize appuis par seconde, 8,61 s à dix-sept —
datent d'un départ plat : cadence constante, donc aucune montée, donc **note
de transition ratée** et 4,2 % de vitesse maximale en moins. Ils disent ce que
coûte une course mal partie, pas ce qu'un bon départ rapporte.

`cadences.mjs` refait la mesure avec, pour chaque cadence, la meilleure montée
trouvée. Réaction et transition parfaite comprises :

| Cadence tenue | Meilleur chrono |
|---|---|
| 10 appuis/s | 9,258 s |
| 12 appuis/s | 8,921 s |
| 13 appuis/s | 8,854 s |
| 14 appuis/s | 8,804 s |
| **15 appuis/s** | **8,679 s** |
| 17 appuis/s | 8,633 s |

**Il faut donc environ quinze appuis par seconde pour passer sous 8,75 s**, et
non treize à quatorze. Le commentaire du code parle de « treize à quatorze
appuis » pour battre le meilleur ZEZE — c'est juste en moyenne, puisque son
chrono est tiré entre 8,75 et 9,00 s, mais il en faut quinze pour battre le
plus rapide d'entre eux. La course de ce reel en tient 16,8, ce qui lui laisse
la marge dont une capture a besoin.

Le plancher de cette physique, aux cadences que seul un script peut tenir, se
mesure avec la même commande : `node cadences.mjs 20 25 30 40 50`. La grille
de montée doit y être resserrée — à cinquante appuis par seconde, la bonne
montée part de 0,03 s d'écart, pas de 0,09 — faute de quoi le tableau annonce
un plancher plus haut que la physique n'en donne.
