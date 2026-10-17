# Reel « Un seul coureur en Régional. » — 17 octobre 2026

Reel de 11,0 s, muet, entièrement dessiné à partir du classement des duels du
jour. Sortie en **1440 × 2560, 60 i/s** (2K, à la demande du propriétaire), au
lieu du 1080 × 1920 du conducteur.

## État à la livraison — à lire en premier

**La page de montage est écrite et vérifiée. La vidéo du jour n'est pas encore
produite.** Elle a été préparée dans un conteneur distant, d'où l'API du
classement (`sprinter-leaderboard.benbezi-sprinter.workers.dev`) n'était pas
joignable : la politique réseau refuse l'hôte. La lecture directe de la base
D1 de production a été refusée elle aussi. Aucun chiffre n'a donc été lu, et
aucun n'a été écrit à la main : le titre, les points, le bilan, la légende,
les sous-titres et ce LISEZMOI sortent tous de la lecture que la page fait
elle-même au moment du montage.

Fichiers présents dans ce dossier :

| fichier | rôle |
|---|---|
| `monteur-seul-en-regional.html` | la page de montage : lit `/duels`, dessine, contrôle, sort tous les fichiers |
| `servir.mjs` | sert le dépôt sur `localhost:8765` (Node 22, aucune dépendance) |
| `assembler-ae.jsx` | monte la séquence PNG dans After Effects et la met en file de rendu |
| `LISEZMOI.md` | ce fichier ; le bloc « lecture du jour » se remplit depuis la page |

Fichiers que la page produit, à déposer ici après le montage :
`video.mp4`, `couverture.png`, `sous-titres.srt`, `legende.txt`,
`lecture-duels.json`, et ce `LISEZMOI.md` rempli.

## Mode d'emploi, samedi matin

1. `node suivi/publications/2026-10-17-reel-seul-en-regional/servir.mjs`, puis
   ouvrir l'adresse affichée dans **Chrome** (WebCodecs H.264 et
   `showDirectoryPicker` : pas Safari ni Firefox).
2. La page lit `GET /duels`, `GET /duels?epreuve=200` et `GET /duels?epreuve=400`,
   heure par heure, et affiche le classement lu.
3. **Trancher le n° 1** dans le menu « Le n° 1 du 100 m est » : un joueur, le
   compte du créateur qu'on nomme à l'écran, ou un compte du créateur ou de
   test qu'on retire. Tant que ce n'est pas fait, aucun bouton de sortie ne
   s'active.
4. Lire les contrôles (tous verts) et l'aperçu.
5. Sortir les fichiers :
   - **Encoder video.mp4 (image par image)** — le chemin principal, voir plus
     bas. Le compte rendu donne la durée relue dans le fichier, le codec et le
     poids.
   - ou **Séquence PNG pour After Effects** → choisir ce dossier ; la page
     écrit `sequence-png/` (660 images), puis dans After Effects : Fichier →
     Scripts → Exécuter le fichier de script → `assembler-ae.jsx`.
   - `couverture.png`, `legende.txt`, `sous-titres.srt`, `lecture-duels.json`.
   - **LISEZMOI.md** en dernier : il reprend ce fichier et y écrit la lecture du
     jour, les décisions et le compte rendu du rendu.
6. Coller dans la section « Accord écrit » le message de chaque joueur nommé.

Pour republier dans six mois à l'identique :
`monteur-seul-en-regional.html?lecture=lecture-duels.json` rejoue la lecture
archivée au lieu d'interroger l'API.

## La ligne de temps — 11,000 s, 660 images à 60 i/s

| de → à | caméra | à l'écran |
|---|---|---|
| 0,0 → 2,5 s | plan large fixe, échelle entière 450 → 1350 px | |
| 0,2 → 2,4 s | | surtitre « DUELS SUR 100 M · AU 17 OCTOBRE » à 272 px ; titre Outfit 800 or centré à 376 px |
| 2,5 → 6,0 s | poussée 1,00 → 1,60, de la pile vers la case du plus haut, interpolation cubique douce recalculée à chaque image | |
| 6,0 → 9,0 s | arrêt sur la case ; anneau or autour du point | |
| 6,2 → 9,0 s | | bilan à côté du point : pseudonyme, « V · D » en Space Mono 700 or, « RÉGIONAL I · 6 PL » en Outfit 700 |
| 9,0 → 9,8 s | retour 1,60 → 1,00, même interpolation | |
| 9,6 → 11,0 s | | « LE TROISIÈME ÉTAGE N'A ENCORE PERSONNE. » en haut, l'étage libre cerné d'or ; à 1450 px « DE DÉPARTEMENTAL IV À RÉGIONAL IV : 400 POINTS DE LIGUE » |

Les valeurs ci-dessus sont celles du repère du 23 septembre. Celles du jour sont
dans le bloc « lecture du jour » en bas, et ce sont elles qui sont à l'écran.

## Les sources

Aucun rush, aucune capture. Pas une image de `04-classement-duels.webm`.
L'unique matière est la réponse de `GET /duels` : un point par ligne de
`classement`, placé dans la case de son `etage` et de sa `division`, vérifiés
contre son `palier` par la règle de `worker/src/classement.js` (`rangDe`).
L'échelle (étages, divisions, PL par division) est lue dans le champ `echelle`
du même JSON : si elle change, le dessin et le carton des points changent avec.

Le fond, la lueur et les trois traits de piste viennent de `poserFond()` de
`src/game/trace-affiche.js`, importé tel quel.

## Ce que la page décide seule, depuis la lecture

- **La variante.** Un seul au-dessus de Départemental → « UN SEUL COUREUR EN
  RÉGIONAL. » ; plusieurs → « N COUREURS EN RÉGIONAL. » (ou « AU-DESSUS DE
  DÉPARTEMENTAL » si leurs étages diffèrent), le bilan en colonne ; personne →
  « PERSONNE EN RÉGIONAL. », arrêt sur la case vide de Régional IV cernée d'or,
  avec le plus proche à côté ; n° 1 du créateur nommé → « UN SEUL COMPTE EN
  RÉGIONAL : CELUI QUI A ÉCRIT LE JEU » ; n° 1 retiré → son point sort du
  dessin et du décompte, et la légende le dit.
- **« Sur 100 m ».** Si personne ne dépasse Départemental sur 200 ni sur 400 m,
  le surtitre dit « DUELS SUR 100 M » ; sinon « DUELS DU 100 M », et la légende
  donne le nombre sur chaque autre distance.
- **L'étage libre.** Celui qui est juste au-dessus du plus haut étage occupé :
  « troisième » s'il y a quelqu'un en Régional, « deuxième » sinon.
- **La date** du surtitre est celle de la requête, pas une date écrite.

## Les écarts au conducteur, et pourquoi

- **2K à 60 i/s.** Demandé par le propriétaire le 17 octobre. Toutes les cotes
  du conducteur (450, 1350, 380, 1450, la zone sûre 250 → 1670) se lisent
  telles quelles dans l'espace de dessin 1080 × 1920 ; un seul facteur 4/3
  passe à 1440 × 2560 à la racine.
- **Le chemin d'encodage.** MediaRecorder horodate à l'heure du mur, et le
  monteur déroule en temps réel parce que des `<video>` jouent sous le canvas.
  Ici, aucune vidéo ne joue. Essayé dans un Chromium sans GPU, MediaRecorder a
  sorti 10,65 s à 12,66 s pour un montage de 11,00 s selon la façon de démarrer :
  l'encodeur met du temps à démarrer, et ce temps devient une première image
  figée ou un début amputé. Le chemin principal est donc **WebCodecs, image par
  image** : chaque image porte son horodatage exact (f / 60), le fichier dure
  11,000 s par construction, à 60 i/s constants, H.264 High 5.1 à 40 Mb/s visés,
  multiplexé en MP4 par la page sans aucune bibliothèque. MediaRecorder reste
  dans la page en secours, avec sa durée relue affichée en rouge si elle
  s'écarte de plus de 0,1 s. Aucune commande ffmpeg nulle part.
- **After Effects.** La séquence PNG garde le dessin de la page au pixel près
  (mêmes fontes, même code) ; After Effects ne fait qu'encoder, au débit choisi.
  C'est le chemin à prendre si l'on veut un master ProRes ou un débit plus haut.
- **La signature.** « @sprintergame » est à 1638 px, avec le filet à 1606 px,
  et non à 8,8 % du bas (1751 px) : sur un reel, ce bas est sous le pouce et la
  légende, et le conducteur refuse tout texte hors du rectangle central.
- **Le chiffre le plus gros.** Dans le carton final, « 400 » est composé plus
  grand que le reste de la ligne (même police, même blanc) : la règle 1 veut
  que le chiffre soit l'élément le plus gros de l'image.
- **ORGUEIL.** La phrase « Le troisième étage n'a encore personne. » prend la
  place du titre à 9,6 s, et l'étage vide s'allume en or : la place libre est la
  provocation du reel.

## Pseudonymes

Le propriétaire a demandé les noms en entier le 17 octobre : c'est le réglage
par défaut de la page. La règle 2 de la charte veut en plus l'accord écrit de
chaque joueur nommé ; la section « Accord écrit » du bloc ci-dessous est là
pour le recevoir. Si l'accord manque au moment du dépôt, le menu
« Pseudonymes » passe tout en première lettre et points (« R••••• ») et la page
régénère vidéo, couverture, légende et sous-titres d'un coup.

## Le son

Voie a : muet. Les cartons sont les sous-titres brûlés ; `sous-titres.srt`
reprend les trois cartons, avec les valeurs du jour, aux mêmes instants.

## Stickers

Un reel ne porte pas de sticker. S'il est repartagé en story, la bande
1670 → 1920 px (espace 1080 × 1920) est libre : un sticker lien ou question s'y
pose sans rien couvrir.

## La couverture

1440 × 2560 comme la vidéo. L'échelle à un tiers de son intensité, les autres
points presque éteints, le point du plus haut en or avec un halo ; le bilan
« V–D » en Space Mono 700 or au tiers de la hauteur (640 px), l'étage au-dessus
en Outfit 800, petit. Le recadrage 3:4 de la grille du profil (240 → 1680 px)
garde l'étage, le bilan et le point.

## Ce qui a été vérifié — sur des données d'essai

Les données d'essai reprennent le repère du 23 septembre avec des noms
fictifs (ESSAI-01…), et la page les marque d'un filigrane rouge « DONNÉES
D'ESSAI — NE PAS PUBLIER » : aucune de ces images n'est publiable.

- Les quatre variantes (joueur, créateur nommé, créateur retiré, plusieurs)
  dessinées et regardées image par image.
- Les points comptés sur des images réellement dessinées (1,3 · 4,2 · 7,5 ·
  10,6 s et la couverture) : 39 sur 39, 38 sur 38 quand le n° 1 est retiré.
- Tout le texte à l'écran tient dans le rectangle central 1080 × 1420, aux
  mêmes instants et sur la couverture.
- Fontes chargées et vérifiées avant tout rendu : Outfit 500, 700, 800 et
  Space Mono 700.
- Le multiplexeur MP4 : fichier relu dans Chromium, 11,000 s, 1440 × 2560,
  660 images, 11 images clés ; quatre images décodées à 0,5 · 4,2 · 7,5 ·
  10,9 s comparées au dessin du même instant, écart moyen de 1,3 à 1,4 sur
  255 (bruit de compression). L'essai a tourné en VP9 : ce Chromium n'a pas
  d'encodeur H.264. Le chemin H.264 ne diffère que par la boîte `avc1/avcC`,
  et il reste à confirmer une fois dans Chrome sur le Mac : le compte rendu
  doit dire « H.264 avc1.640033 » en vert.

## À relire le jour du dépôt

- [ ] La lecture date du jour même (bloc ci-dessous), et les trois réponses
      sont HTTP 200.
- [ ] Le statut du n° 1 est tranché par le propriétaire.
- [ ] L'accord écrit de chaque joueur nommé est collé, ou les noms sont
      masqués.
- [ ] Le compte rendu donne 11,000 s, H.264, 1440 × 2560, 60 i/s.
- [ ] `legende.txt` relue : un seul point d'exclamation au plus (il n'y en a
      aucun), aucun mot banni, le présent.
- [ ] Si le classement a bougé entre le montage et le dépôt : remonter. C'est
      le texte qui suit le chiffre, jamais l'inverse.

<!-- LECTURE:DEBUT -->
## La lecture du jour

Pas encore lue. Ce bloc est remplacé par le bouton « LISEZMOI.md » de la page
de montage : les trois réponses JSON brutes avec leur heure, les décisions, le
compte rendu du rendu.
<!-- LECTURE:FIN -->
