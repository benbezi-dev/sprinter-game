# Sprinteur et sprinteuse : personnages pour Unity

Produits par `tools/blender/sprinteurs_makehuman.py` à partir des données CC0 de
MakeHuman (maillage de base, cibles de morphologie, squelette, poids), dans
Blender en ligne de commande. On ne retouche rien à la main : on change le
script et on relance (voir l'en-tête du script).

## Contenu

| Fichier | Rôle |
|---|---|
| `Sprinteur.fbx` | homme, 1,96 m : corps, tenue et pointes en **un** maillage (`Sprinteur_Corps`), 5 coupes de cheveux, clip `Sprint` |
| `Sprinteuse.fbx` | femme, 1,72 m : idem, 4 coupes de cheveux |
| `Textures/Pointes_*.png` | les textures des pointes (couleur, normales, ORM) : le FBX les reference en chemin relatif, garder le dossier a cote |

- **Squelette Humanoid** de 52 os, aux noms de l'avatar Unity (`Hips`,
  `Spine`, `Chest`, `UpperChest`, `Neck`, `Head`, `LeftShoulder`…
  `LeftHandIndex1`…, `LeftToes`). Les doigts sont présents.
- **4 influences au plus** par sommet, toutes normalisées.
- **Quatre matériaux** sur le corps : `M_Peau`, `M_Haut` (débardeur ou
  brassière), `M_Bas` (cuissard), `M_Pointes` (texturé). Les couleurs sont
  dans la *Base Color* du matériau : c'est elle qu'Unity importe.
- **Les pointes** sont celles du jeu (`public/modeles/pointes-*.glb`, faites
  dans Tripo, sans marque), ajustées à chaque pied : axe du pied, longueur et
  largeur, semelle sous la plante. Elles sont pondérées sur `…Foot` et
  `…Toes`, et plient donc à la tête des métatarsiens. Le pied caché dans la
  chaussure est retiré.
- **La tenue est faite de vrais vêtements**, pas de peinture sur la peau. Ce
  sont des maillages découpés (col, emmanchures, dos), avec un ourlet replié,
  décollés de la peau et tendus par-dessus les creux. Ils sont fusionnés au
  corps et pondérés comme la peau qu'ils couvrent. La peau cachée sous la
  tenue est retirée.
- **Les coupes de cheveux** sont des maillages séparés (`Cheveux_…`), rigides
  sur l'os `Head` :
  - homme : `Rase`, `Degrade`, `Court`, `FlatTop`, `Afro` ;
  - femme : `Chignon`, `Queue`, `Tresses`, `Court`.

  `Rase`, `Degrade` et `FlatTop` ont un second matériau `…_Ras` pour les
  parties rasées.
- **Le clip `Sprint`** est une boucle de 16 images à 30 i/s (0,53 s, deux
  foulées), qui court sur place. Ses poses clés :
  - image 0 : genou gauche haut, jambe droite en poussée ;
  - image 4 : passage, appui gauche ;
  - image 8 : symétrique de l'image 0 ;
  - image 12 : passage, appui droit.

  Le bassin s'élève de 5 cm pendant la phase aérienne. Le corps est penché
  vers l'avant (ligne du sprinteur), les bras restent dans le plan de la
  course, les poings sont fermés.

## Import dans Unity

1. Glisser le dossier `Sprinteurs` dans `Assets/`.
2. Pour chaque `.fbx`, régler les onglets suivants.
   - **Model** : *Scale Factor* 1, *Convert Units* coché.
   - **Rig** : *Animation Type* = **Humanoid**, *Avatar Definition* =
     *Create From This Model* → **Apply**. Le modèle est en pose A, donc dans
     *Configure…*, faire *Pose → Enforce T-Pose*, puis *Done*.
   - **Animation** : sélectionner le clip `Sprint`, cocher **Loop Time** (et
     *Loop Pose*), puis *Apply*.
3. Poser le personnage dans la scène et lui donner un *Animator* dont le
   contrôleur joue `Sprint`. Le personnage court.
4. **Choisir une coupe** : n'activer qu'un seul des enfants `Cheveux_…` et
   désactiver les autres.
5. **Changer la peau** : régler la couleur de base de `M_Peau`. Il faut une
   instance de matériau par coureur. Pour un crâne rasé, mélanger la couleur
   des cheveux et celle de la peau à environ 55 % / 45 % dans `…_Ras`.

### Carnations du jeu (`SKIN`, `src/game/sprinter-core.js`)

| ébène | cacao | acajou | noisette | bronze | ambre | miel | olive | sable | clair | porcelaine |
|---|---|---|---|---|---|---|---|---|---|---|
| 74,46,32 | 96,60,40 | 108,66,42 | 120,76,50 | 142,92,58 | 176,122,78 | 198,150,104 | 206,166,118 | 224,186,142 | 238,204,166 | 246,220,190 |

### Couleurs de cheveux du jeu (`CHEVEUX`, `src/game/vestiaire.ts`)

| noir | brun | châtain | blond | roux | gris |
|---|---|---|---|---|---|
| 28,22,22 | 56,36,24 | 92,62,36 | 188,154,88 | 148,74,38 | 176,176,182 |

## Vérifier

```bash
python tools/blender/aurel_unity_verifier.py -- --fbx unity/Sprinteurs/Sprinteur.fbx
```

Tout passe, sauf « 1,90 m de haut ». Ce test est propre à Aurel, et les
sprinteurs n'ont pas sa taille.

## Limites connues

- **Ni textures ni yeux** : couleurs unies. Les cheveux sont des volumes lisses,
  sans mèches. Une texture ou un shader de cheveux dans Unity les rendrait
  plus crédibles.
- **Les pointes sont étirées** : elles sont allongées de 41 % chez l'homme
  (22 % chez la femme), mais élargies d'à peine 4 % (9 % chez la femme),
  parce que le pied MakeHuman est plus long et plus fin que celui des coureurs
  du jeu. Elles gardent la couleur verte de leur texture.
- **Petits défauts en course** : au bas du cuissard, la jambe tendue peut
  laisser percer un peu de peau. Chez l'homme, les tétons se devinent encore
  sous le débardeur.
- **Animation de démonstration** : elle est cuite à partir de quatre poses
  clés, et ce n'est pas une capture de mouvement. Pour un rendu de jeu, il
  faut la retravailler ou la remplacer par un clip Humanoid du commerce,
  puisque l'avatar est standard.
- **Pas encore branché sur le jeu web** (three.js) : ces personnages sont pour
  Unity.
