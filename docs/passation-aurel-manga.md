# Passation — Défi Aurel Manga (Hurdlers) et personnage Unity

Branche : `claude/fervent-tesla-b0axe9`. Rédigé le 27 septembre 2026.

Aurel Manga (110 m haies, équipe de France) a donné son accord pour entrer
dans le jeu sous son nom. Il est au centre de l'événement qui annonce
Hurdlers, et il existe maintenant aussi comme personnage 3D pour Unity.

---

## 1. Dans le jeu web (canal de test uniquement)

### Ce qui marche

- **L'événement** : un 110 m haies au **Stade Jean-Delbert** (Montreuil).
  Aurel court au couloir 5, juste à droite du joueur, sur un **chrono fixe de
  12,45 s** (environ 10 frappes/s avec des haies bien prises, mesuré sur le
  vrai moteur). Les six autres courent 0,5 s derrière lui.
- **Les écrans** : bannière en tête des accueils de Sprinter et de Hurdlers,
  fiche avant la course (palmarès, règle, récompense), verdict en fin de
  course. Tous montrent son **portrait 3D** rendu dans Blender
  (`public/vedettes/manga-buste.webp`, `manga-pied.webp`).
- **Le skin** : gagné en battant Aurel, sélectionnable depuis la bannière ou
  l'écran de verdict. Il se porte **uniquement sur les courses de haies**, et
  jamais dans le défi lui-même. Il ne change que le dessin : la foulée du
  joueur reste mesurée sur son gabarit (test automatique).
- **En course**, Aurel est un coureur du moteur (troncs de cône) : corps
  sculpté à ses mesures, bandeau blanc, poignet éponge au bras **gauche**,
  barbe courte, tenue violette. **Pas de traits de visage** : en troncs de
  cône ils faisaient un masque ; on le reconnaît à sa silhouette.
- **Le stade** : relevé sur deux photos du lieu (piste rouge brique,
  gradins-bancs en béton clair, grand toit anthracite, panneaux blanc et
  bleu).

### Ouvrir au public

Deux interrupteurs, rien à déplacer :

1. `DEFI_VEDETTE_OUVERT = true` dans `src/game/canal.ts` ;
2. `ouvert: true` sur l'entrée `defi-manga` de `STADES_HORS_SERIE`
   (`src/game/sprinter-core.js`).

Fermé, l'interface de l'événement ne part pas dans le build public (vérifié
sur un vrai build).

### Fichiers

| Fichier | Rôle |
|---|---|
| `src/game/vedettes.ts` | l'événement : lancer, ranger, verdict, meilleur chrono |
| `src/game/vestiaire.ts` | skins gagnés et portés (localStorage), `habillerLeJoueur` |
| `src/game/vedettes-mots.ts` | les textes FR/EN de l'événement |
| `src/components/screens/DefiVedette.tsx` | bannière, fiche, verdict |
| `src/game/sprinter-core.js` | `VEDETTES` (son apparence), le stade `defi-manga`, bandeau/poignet/barbe dans `pose()` |
| `src/game/coureur-vedettes.js` | son corps de course (engendré par Blender) |
| `src/game/sprinter-app.js` | thème `montreuil`, chrono fixe (`cibles`) dans `buildLevel` |
| `tools/vedettes-test.mjs` | harnais : place du stade, couloir, chrono, skin neutre pour la foulée |
| `tools/apercu-vedette.html` | aperçu du coureur de course sous tous les angles |

### Corrigé au passage

- Un 110 m haies choisi dans un stade hors série plantait (plateau sans
  l'épreuve).
- Le repli « index de stade inconnu » visait un `OLYMPIC` jamais déclaré.
- Boucle React « Maximum update depth » pendant les courses de haies (le
  HUD relançait un rendu par image).

---

## 2. Le personnage pour Unity

Tout est dans `unity/AurelManga/` ; **le mode d'emploi Unity est dans
`unity/AurelManga/README.md`** (import Humanoid, matériaux URP/HDRP,
animation, vérification).

### La chaîne (`tools/blender/`)

| Script | Rôle |
|---|---|
| `portrait_vedette.py` | le modèle d'Aurel (masses fondues, tête sculptée, matériaux par zones) ; pose « hanches » pour le portrait, pose « A » pour le rig |
| `aurel_unity.py` | maillage de jeu, UV, cuisson PBR, rig Rigify, squelette de jeu, export FBX ; `--animation` pour exporter un clip |
| `aurel_unity_verifier.py` | relit le FBX comme Unity le lira et vérifie tout |

```bash
# le personnage
blender -b -P tools/blender/aurel_unity.py
# un clip animé avec Rigify dans le .blend
blender -b -P tools/blender/aurel_unity.py -- --animation unity/AurelManga/Aurel_Manga.blend --clip Course
# la vérification
blender -b -P tools/blender/aurel_unity_verifier.py -- --fbx unity/AurelManga/Aurel_Manga.fbx
```

(Sans Blender installé : `pip install bpy` dans un environnement Python 3.11
fait tourner les mêmes scripts avec `python script.py -- …`. Blender 5.0 y
reproduit à l'identique les corps du jeu.)

### Les quatre contraintes Unity, et comment elles sont tenues

1. **Rig compatible Humanoid Mecanim, via Rigify, os de déformation seuls.**
   Metarig humain Rigify (sans visage, doigts ni seins) calé sur le modèle,
   généré → rig de **contrôle** pour animer. Un **squelette de jeu** séparé
   est construit sur les seuls os `DEF-` (mêmes positions, mêmes rolls),
   segments de torsion fusionnés, **noms de l'avatar Humanoid** (`Hips`,
   `Spine`, `LeftUpperArm`…), `Hips` seule racine. Chaque os de jeu copie son
   os `DEF-` (Copy Transforms) : vérifié, écart nul quand on anime les
   contrôles Rigify.
2. **Export FBX** : sélection seule, types `ARMATURE` + `MESH` (ni caméra ni
   lumière), `use_armature_deform_only`, pas d'os de bout, *Y Up / −Z
   Forward*, **transformations appliquées**. La case « Apply Transform » de
   Blender ne s'applique pas aux armatures (la racine gardait −90°) : le
   script applique la rotation lui-même. Résultat vérifié dans le fichier :
   rotation (0,0,0) et échelle 1 sur la racine et le maillage.
3. **Matériaux PBR URP/HDRP** : les matériaux procéduraux (maillot, barbe,
   cheveux, relief de peau) sont **cuits** en `BaseMap` (sRGB), `Normal`
   (tangent, OpenGL = convention Unity) et `MetallicSmoothness` (lissage dans
   l'alpha, format URP). Tableau de réglage URP/HDRP dans le README.
4. **Pose de repos** : pose A (bras à 45°) ; Unity la redresse en T dans la
   configuration de l'avatar (*Enforce T-Pose*).

### Chiffres

42 000 triangles (corps 36 000), 22 os, 3 matériaux, 1 `SkinnedMeshRenderer`,
textures 2048², 1,90 m.

---

## 3. Points ouverts

- **Vidéos d'Aurel** : YouTube est bloqué par le réseau de l'environnement
  cloud. Sa foulée en course (`gait: 'sharp'`) et sa technique de haie sont
  **provisoires**. Il faut autoriser `youtube.com` dans les réglages réseau de
  l'environnement, ou fournir les vidéos en fichiers.
- **Ressemblance du visage** : le modèle 3D est une interprétation stylisée.
  Des photos de face et de profil (sans bandeau) permettraient de caler le
  crâne, le nez, les lèvres et la barbe.
- **Unity, non testé dans Unity** : tout est vérifié côté fichier (relecture
  du FBX, hiérarchie, poids, transformations, animation cuite), mais aucun
  import réel dans l'éditeur Unity n'a été fait ici. À faire en premier :
  import, avatar Humanoid, *Enforce T-Pose*, un clip Mixamo de test.
- **Doigts** : absents (mains en moufle) ; à ajouter au modèle si les
  animations Unity en ont besoin (le metarig Rigify les a, on les retire).
- **Stade** : il manque la cabine blanche sur pilotis et les mâts
  d'éclairage (pièces Blender à faire, comme la tour du Champ-de-Mars).
- **Harnais `haies-course-test`** : 2 échecs **préexistants** sur `main`
  (niveau ZEZE trop facile), sans lien avec ce travail.
- **Événement suivant** : Mickaël Méba-Zézé. Le système est générique : une
  entrée dans `VEDETTES` (moteur et `vedettes.ts`), un stade-événement, des
  retouches dans `anatomie.py`, un portrait et, si besoin, un export Unity.

## 4. Légal

Garder une autorisation **écrite** d'Aurel Manga couvrant son nom, son image
et l'usage commercial (stores, réseaux). Aucune photo de lui n'est dans le
jeu : les photographes en détiennent les droits.
