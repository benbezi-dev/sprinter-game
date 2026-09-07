# Planches de sprites — Sprinter

Sept planches, une par athlète, rendues depuis `../../sprinteuse.blend` avec
`sheet_build.py`. Format WebP avec alpha, 1 Mo au total.

## Géométrie d'une planche

- Grille **12 colonnes × 8 lignes** = 12 poses du cycle × 8 orientations
- Tuile **96 × 112 px**, planche 1152 × 896 px
- Ancrage (position des pieds dans la tuile) : **x = 48, y = 98.82**
- Ligne `a` = azimut `a × 45°`, colonne `f` = phase `f / 12` du cycle

## Projection

La caméra Blender reproduit exactement la formule du moteur
(`sprinter-app.js`, `drawSegmentFacets`) :

```
x = ax + (Y - X) · ISO_COS · k
y = ay - (X + Y) · ISO_SIN · k - Z · k
```

Les deux axes écran sont orthogonaux mais **d'échelles différentes** : 1,2649
horizontalement contre 1,1832 verticalement. Le rendu est fait en pixels carrés,
donc le moteur doit **étirer la largeur du sprite de 1,069045** (`anisotropy`
dans `manifest.json`) pour retrouver la géométrie du décor.

Échelle de rendu : **53,3333 px par unité écran** (`pixelsPerUnit`). Les sept
athlètes sont rendus à la **même échelle** : leur différence de taille est déjà
contenue dans les sprites, le moteur ne doit donc **pas** réappliquer le
facteur `look.h / MODEL_H` qu'il utilise pour le rendu procédural.

## Contrôles passés

Sur les sept planches : aucun pixel opaque sur les bords de tuile (pas de
débordement d'une silhouette sur sa voisine), plus longue suite horizontale
opaque de 40 à 58 px pour une tuile de 96 (donc aucune traînée), aucune tuile
vide, et aucun membre rogné par la fenêtre de recadrage.

## Branchement dans le moteur

Fait. `sprinter/src/game/sprinter-sprites.js` charge les planches et dessine ;
`drawRunner` et `drawIcon` l'appellent en premier et **retombent sur le rendu
en capsules** si la planche manque, si l'athlète n'est pas un ZEZE, ou tant que
les images ne sont pas chargées. Le jeu reste donc jouable si les images
n'arrivent jamais. Les fichiers servis sont dans `sprinter/public/sprites/`.

Le service worker est en « réseau d'abord » sans liste de precache : les
planches se mettent en cache toutes seules au premier chargement.

### Calage mesuré, non deviné

`TUNE.angleOffset = 0` et `TUNE.phaseOffset = 0` sortent d'une corrélation
silhouette à silhouette entre le rendu en capsules et les 8 orientations × 12
phases, sur tout le cycle. Meilleur recouvrement : **IoU 0,627** sur la ligne 0
sans décalage ; les trois candidats suivants sont la même ligne à une image
près, ce qui confirme l'orientation. Un raisonnement analytique m'avait d'abord
donné 90° — c'était faux, la mesure l'a corrigé.

Échelle vérifiée sur le cycle complet : sommet de la tête à **79 px** pour le
sprite contre **78 px** pour le rendu procédural, et 76 px attendus
théoriquement pour 1,65 m à m = 46. Largeurs 49 contre 51 px.

## Reteinte du kit

Chaque planche `<nom>.webp` a un masque `<nom>_mask.webp` qui dit à quelle
pièce appartient chaque pixel : **rouge = maillot, vert = short, bleu =
chaussure**, noir pour tout ce qui n'est jamais reteint (peau, cheveux,
semelle). Les masques sont rendus sans anti-aliasing (`filter_size` 0,01,
1 échantillon) pour des frontières franches.

Au dessin, si les couleurs du coureur diffèrent de celles de la planche, le
moteur repeint les trois zones **en conservant l'ombrage** : il garde le
rapport de luminance entre le pixel et la couleur d'origine (`colors` dans le
manifeste) et l'applique à la couleur voulue. La tuile reteinte est mise en
cache (420 max, éviction FIFO).

Coût mesuré : **1,0 ms** pour reteindre 12 tuiles la première fois, **0,10 ms**
ensuite depuis le cache — pour un budget de 16,7 ms par image à 60 fps.

Réglages : `TUNE.tint = false` désactive la reteinte, `TUNE.morphFallback =
false` limite les sprites au roster ZEZE.

## Poids

7 planches (1,0 Mo) + 7 masques (0,47 Mo) = **1,5 Mo**, mis en cache par le
service worker au premier chargement.

## Limites connues

- Le `lean` de virage est appliqué comme une rotation 2D du sprite, alors que
  le rendu procédural incline le personnage en 3D : approximation visible aux
  forts dévers.
- Le `mirror` de `drawIcon` est rendu par un retournement horizontal, ce qui
  n'équivaut pas exactement à l'inversion d'axe des capsules.
- La **morphologie** reste celle de la planche prêtée : un coureur hors roster
  a la silhouette du ZEZE de gabarit le plus proche, seules les couleurs sont
  les siennes. Coiffure comprise.
- Les sprites sont un peu plus sombres que le rendu procédural (éclairage
  Blender contre shading du moteur).
