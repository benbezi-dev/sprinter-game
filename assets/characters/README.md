# Assets personnages — Sprinter

Sept athlètes ZEZE modélisés, riggés et animés dans Blender, exportés en glTF 2.0
binaire (`.glb`). Source : `../../sprinteuse.blend` (collection `Roster`),
générateur : `roster_build.py`.

## Contenu de chaque `.glb`

- 1 mesh, 6 matériaux (peau, haut, short, cheveux, chaussure, semelle)
- Squelette de 22 os, nommage `.L` / `.R` (`hips`, `spine`, `chest`, `neck`,
  `head`, `shoulder`, `upper_arm`, `forearm`, `hand`, `thigh`, `shin`, `foot`,
  `toe`) — compatible mapping humanoïde Unity / Godot
- 1 animation `<Nom>_Sprint` : cycle de course **en boucle**, **sur place**
  (le déplacement se gère côté moteur), 60 fps, dernière pose = première
- 4 influences maximum par sommet, aucun sommet non pondéré
- Orientation Y-up, origine au sol entre les pieds, échelle 1 unité = 1 m
- Métadonnées dans `asset.extras` : `character`, `gait`, `build`, `heightM`,
  `cycleFrames`, `fps`, `loop`, `inPlace`

## Roster

| fichier | athlète | sexe | taille | foulée | cycle | durée |
|---|---|---|---|---|---|---|
| `benbezi.glb`  | Benbezi  | h | 1,86 m | `lyles`   | 24 f | 0,400 s |
| `ryan.glb`     | Ryan     | h | 1,78 m | `sharp`   | 23 f | 0,383 s |
| `mickeal.glb`  | Mickeal  | h | 1,85 m | `power`   | 26 f | 0,433 s |
| `herman.glb`   | Herman   | h | 2,00 m | `fluid`   | 26 f | 0,433 s |
| `greta.glb`    | Greta    | f | 1,70 m | `drive`   | 25 f | 0,417 s |
| `ervie.glb`    | Ervie    | f | 1,75 m | `glide`   | 27 f | 0,450 s |
| `victoire.glb` | Victoire | f | 1,63 m | `cadence` | 22 f | 0,367 s |

Les noms de foulée correspondent aux profils `GAITS` de
`sprinter/src/game/sprinter-core.js` : morphologie et biomécanique sont donc
alignées entre le rendu procédural du moteur et ces modèles 3D.

## Qualité de l'animation

Pour chaque personnage, la hauteur du bassin n'est pas une sinusoïde : elle est
calculée image par image à partir du contact réel de la semelle, puis raccordée
par une trajectoire balistique pendant la phase aérienne. Résultat mesuré :
pénétration du sol nulle, 45 à 50 % du cycle en vol, oscillation du bassin de
7 à 9 cm.

## Limite d'intégration

Le jeu web est rendu en **Canvas 2D** et n'embarque aucun chargeur glTF : ces
assets ne peuvent pas être affichés en l'état. Les brancher demande soit un
rendu en planches de sprites depuis Blender, soit un moteur de rendu 3D.

---

## Planches de sprites

`../sprites/` contient la version 2D de ces mêmes personnages, rendue depuis
Blender dans la projection isométrique exacte du jeu — c'est cette version qui
est destinée à remplacer le rendu procédural du moteur Canvas 2D.
