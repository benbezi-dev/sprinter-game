# Riposte Danube — images et vidéo

Tout est capturé **dans le jeu tel qu'il est en ligne** (commit `a501a58`),
rendu en 2× (1080 px de large), le 12 septembre 2026.

## stade/ — les captures de jeu
| Fichier | Taille | Pour |
|---|---|---|
| `vertical-1080x1920-ligne.png` | 1080×1920 | TikTok, Reels, story — **la meilleure** : gradins, LED magenta/cyan, un projecteur |
| `vertical-1080x1920-virage.png` | 1080×1920 | story plus graphique, beaucoup de noir pour poser du texte |
| `vertical-1080x1920-depart.png` | 1080×1920 | la ligne de départ, huit couloirs numérotés |
| `insta-1080x1350-ligne.png` | 1080×1350 | post Instagram (4:5, le format qui prend le plus de place au fil) |
| `insta-1080x1350-virage.png` | 1080×1350 | idem, variante |
| `x-1600x900-ligne.png` | 1600×900 | X / Twitter |
| `x-1600x900-virage.png` | 1600×900 | X / Twitter, variante |

Le tiers bas des verticales est noir : c'est là que tu poses le texte.

## cartes/ — les chiffres
Deux formats chacune : `-feed` (1080×1350) et `-story` (1080×1920).

- `8-24-contre-9-58` — **le socle**, liseré orange. 8.246 contre 9.58.
- `100m-cinq-centiemes` — **voie A** (un record est tombé), liseré magenta.
  Le top 3 tient en cinq centièmes.
- `400m-quatre-milliemes` — **voie B** (aucun record), liseré cyan.
  34.888 contre 34.892.

Chiffres relevés sur l'API du classement le 12/09/2026 à 15:11.

## video-1080x1920/ — la séquence
72 images JPEG, `f000` à `f071`, 1080×1920, capturées à **17,7 images/s**
sur un 100 m au Stade du Danube (48,7 m parcourus).

**Il n'y a pas de MP4** : aucun encodeur vidéo sur cette machine. Importe la
séquence dans ton montage (Premiere : Fichier → Importer, coche « Séquence
d'images » sur `f000.jpg`) et règle la cadence sur **18 i/s**. Tu y ajoutes de
toute façon le texte d'accroche et le son — personne ne poste un rush brut.

`apercu-video.gif` (360×640) sert juste à voir le mouvement tout de suite.

Si tu veux un MP4 directement, installe l'encodeur puis dis-le moi :

    brew install ffmpeg

## La carte réactive — celle du soir même

`tools/carte-riposte.mjs` fabrique la carte qu'on ne peut pas préparer à
l'avance : celle qui porte le chrono du vainqueur d'une finale. Elle se lance
quand la ligne est franchie, sort en une dizaine de secondes, et relit le
record du jeu sur l'API à chaque appel — aucun chiffre n'y est écrit en dur.

    node tools/carte-riposte.mjs --epreuve 100 --vainqueur "Oblique Seville" --temps 9.79
    node tools/carte-riposte.mjs --epreuve 100 --femmes --vainqueur "Julien Alfred" --temps 10.75

Sort `budapest-100m-h-feed.png` (1080×1350) et `-story.png` (1080×1920).

Le titre s'adapte tout seul : « LE RECORD TIENT TOUJOURS » si le vainqueur
reste au-dessus du record du monde, « NOUVEAU RECORD DU MONDE » s'il passe
dessous. L'âge de notre record est lu sur le classement, jamais affirmé.
