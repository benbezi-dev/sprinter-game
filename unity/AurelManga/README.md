# Aurel Manga — personnage pour Unity

Produit par `tools/blender/aurel_unity.py` (Blender 5.0, Rigify), vérifié par
`tools/blender/aurel_unity_verifier.py`. Rien ici ne se retouche à la main :
on change le modèle ou le script, et on relance.

## Contenu

| Fichier | Rôle |
|---|---|
| `Aurel_Manga.fbx` | le personnage : **un** maillage skinné + **son** armature de jeu. Ni caméra, ni lumière, ni os de contrôle. |
| `Textures/Aurel_Body_BaseMap.png` | couleur (sRGB), 2048² |
| `Textures/Aurel_Body_Normal.png` | normales, espace tangent, convention OpenGL (Y+) = celle d'Unity |
| `Textures/Aurel_Body_MetallicSmoothness.png` | R = métallique (0), **A = lissage** (1 − rugosité) |
| `Textures/Aurel_Eyes_BaseMap.png` | les yeux |
| `Aurel_Manga.blend` | le fichier de travail : rig **Rigify** complet pour animer, squelette de jeu qui le suit |
| `Animations/` | les clips exportés depuis le `.blend` (voir plus bas) |

Budget : 42 000 triangles environ (corps 36 000, yeux, bandeau, poignet),
22 os, 3 matériaux sur un seul `SkinnedMeshRenderer`.

## Import dans Unity

1. Glisser le dossier `AurelManga` dans `Assets/`.
2. Sélectionner `Aurel_Manga.fbx` → onglet **Model** : *Scale Factor* 1,
   *Convert Units* coché. Le personnage arrive à l'échelle 1, rotation
   (0, 0, 0), debout sur Y, regard vers +Z : les transformations ont été
   appliquées dans Blender (voir « Pourquoi pas la case Apply Transform »).
3. Onglet **Rig** : *Animation Type* = **Humanoid**, *Avatar Definition* =
   *Create From This Model* → **Apply**. Les os portent les noms de l'avatar
   (`Hips`, `Spine`, `Chest`, `UpperChest`, `Neck`, `Head`,
   `LeftShoulder`, `LeftUpperArm`, `LeftLowerArm`, `LeftHand`,
   `LeftUpperLeg`, `LeftLowerLeg`, `LeftFoot`, `LeftToes`, et leurs `Right…`) :
   la correspondance se fait toute seule. Dans **Configure…**, le modèle est
   en **pose A** (bras à 45°) : *Pose → Enforce T-Pose*, puis *Done*.
   Pas de doigts ni de mâchoire : ces emplacements restent vides, c'est
   normal.
4. Onglet **Materials** : *Location* = *Use External Materials (Legacy)* ou
   *Extract Materials…*, puis régler les trois matériaux comme ci-dessous.

## Matériaux (URP / HDRP)

| Matériau | URP : shader `Universal Render Pipeline/Lit` | HDRP : shader `HDRP/Lit` |
|---|---|---|
| `M_Aurel_Body` | *Workflow* Metallic · *Base Map* = `Aurel_Body_BaseMap` · *Metallic Map* = `Aurel_Body_MetallicSmoothness`, *Source* = **Metallic Alpha** · *Normal Map* = `Aurel_Body_Normal` | *Base Map* = `Aurel_Body_BaseMap` · *Mask Map* : construire un masque (R métal 0, G occlusion 1, B 0, A lissage = alpha de `MetallicSmoothness`) · *Normal Map* = `Aurel_Body_Normal` |
| `M_Aurel_Eyes` | *Base Map* = `Aurel_Eyes_BaseMap` · *Smoothness* 0,9 | idem, *Smoothness* 0,9 |
| `M_Aurel_Terry` (bandeau, poignet) | couleur blanche, *Smoothness* 0,05 | idem |

Réglages d'import des textures : `BaseMap` en **sRGB** ; `Normal` en
*Texture Type* = **Normal map** ; `MetallicSmoothness` **sans** sRGB
(*sRGB (Color Texture)* décoché).

## Animer

On anime dans `Aurel_Manga.blend` avec les **contrôles Rigify**
(`Aurel_Rigify`). À l'ouverture, Blender demande d'autoriser les scripts :
il faut accepter (ou lancer `rig_ui.py` depuis l'éditeur de texte), sinon le
panneau Rigify (IK/FK, etc.) n'apparaît pas.

Le squelette de jeu `Aurel` ne s'anime **jamais** directement : chacun de
ses os copie son os `DEF-` de Rigify (contrainte *Copy Transforms*). Pour
sortir un clip :

```bash
blender -b -P tools/blender/aurel_unity.py -- \
        --animation unity/AurelManga/Aurel_Manga.blend --clip Course
```

→ `Animations/Aurel_Course.fbx` : la plage d'images de la scène, cuite image
par image sur le squelette de jeu, avec les mêmes réglages que le modèle.
Dans Unity : *Rig* = Humanoid, *Avatar* = *Copy From Other Avatar* (celui
d'`Aurel_Manga.fbx`).

## N'exporter que les os de déformation (Rigify)

Le rig Rigify compte des centaines d'os (ORG-, MCH-, contrôles) ; Unity ne
doit en voir aucun. Deux protections, et il faut les deux :

1. **Le squelette de jeu est une armature à part**, construite à partir des
   seuls os `DEF-`, fusionnés et renommés pour l'avatar Humanoid. Les os
   `DEF-` de Rigify ne s'enchaînent pas toujours entre eux (certains ont pour
   parent un os ORG ou MCH), et les segments de torsion
   (`DEF-upper_arm.L.001`…) seraient des os en trop : ils sont fusionnés dans
   leur os, poids compris.
2. **L'export ne sélectionne que ce squelette et le maillage**
   (`use_selection`, `object_types={'ARMATURE','MESH'}`), avec
   `use_armature_deform_only=True` et `add_leaf_bones=False`.

À la main dans Blender, c'est : sélectionner `Aurel` + `Aurel_Body`
(**pas** `Aurel_Rigify`, **pas** `metarig`), *File → Export → FBX*,
*Limit to: Selected Objects*, *Object Types* : Armature + Mesh,
*Armature → Only Deform Bones* coché, *Add Leaf Bones* décoché. Mais le script
fait en plus la correction d'orientation ci-dessous, qu'on oublie à la main.

## Pourquoi pas la case « Apply Transform »

La case *Apply Transform* de l'exporteur FBX (`bake_space_transform`) cuit la
conversion d'axes dans les **maillages**, pas dans les **armatures**. Relu
octet par octet, le FBX portait alors −90° en X sur la racine de l'armature :
Unity l'aurait affichée couchée, redressée par une rotation de parent. Avec
la case **et** la correction, c'est le maillage qui héritait de +90°.

Le script fait donc ce que la case promet, à la main : il tourne l'armature
et son maillage de −90° en X, **applique** la rotation (les os et les sommets
sont alors exprimés dans le repère d'Unity), puis rend +90° en rotation
d'objet, que la conversion *Y Up / −Z Forward* annule exactement.
`aurel_unity_verifier.py` relit le FBX sans Blender et exige rotation
(0, 0, 0) et échelle 1 sur la racine comme sur le maillage.

## Vérifier

```bash
blender -b -P tools/blender/aurel_unity_verifier.py -- \
        --fbx unity/AurelManga/Aurel_Manga.fbx --images /tmp/verif
```

Il vérifie : rien d'autre qu'une armature et un maillage ; les os
obligatoires de l'avatar Humanoid, dans la bonne hiérarchie, `Hips` seule
racine, aucun os Rigify ; rotation 0 / échelle 1 dans le fichier ; 1,90 m,
debout ; chaque sommet pondéré, seulement sur des os du squelette ; des UV.
Avec `--images`, il rend le personnage au repos et posé (bras, genou, buste,
tête) pour juger les poids.

## Limites connues

- **Pas de doigts** ni de visage animé : les mains sont des moufles, les
  yeux ne clignent pas. Le modèle n'a pas de doigts séparés.
- Les poids sont **automatiques** (chaleur des os) : propres aux coudes et
  aux genoux, à reprendre à la main si une animation extrême pince l'aisselle
  ou l'aine.
- Le visage est une **interprétation stylisée**, pas une copie photo.
