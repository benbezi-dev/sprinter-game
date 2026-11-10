# Audit et chiffrage — refonte 3D mobile (10 novembre 2026)

Estimation faite à partir du dépôt (branche `ccr-86bef5e9-ea68ew`) et des mesures
déjà présentes dans `docs/`. Aucune nouvelle mesure sur téléphone n'a été faite
pour ce document.

## 1. État actuel (vérifié dans le code)

| Constat | Où | Conséquence |
|---|---|---|
| Three.js 0.180 + React 19, ~133 000 lignes dans `src/` (97 000 TS/TSX, 36 000 JS) | `src/` | La 3D n'est qu'une partie : l'interface React pèse plus que le moteur |
| Moteur 3D de course monolithique : 3 873 lignes | `src/game/course-3d.ts` | Toute évolution du rendu touche ce fichier |
| Ancien jeu 2D encore là : 9 661 + 4 369 lignes | `src/game/sprinter-app.js`, `sprinter-core.js` | À garder en secours ou à retirer |
| Les téléphones sont plafonnés au palier 2, l'ULTRA n'y est jamais choisi | `course-3d.ts:110` (`TELEPHONE ? 2 : 3`) | Un téléphone haut de gamme n'a pas la meilleure qualité |
| Géométrie compressée meshopt : oui. Textures compressées pour le GPU (KTX2/Basis) : non | `grep` dans `src/` | Les 2 045 images webp de `public/` sont décompressées en RGBA dans la mémoire vidéo : risque de saturation et de plantage sur un petit téléphone |
| Modèles très lourds : 349 Mo dans `public/modeles`, accessoires « ultra » de 23-24 Mo pièce (réverbère, poubelles, cabine), boss de 12-17 Mo | `public/modeles/stades-ultra/`, `boss-plein/` | Chargements longs et pics de mémoire |
| Ombres PCFSoft à tous les paliers, carte de 512 à 2 048 px | `course-3d.ts:136`, `:2321` | Coût GPU notable sur mobile |
| Palier adaptatif avec mémoire par appareil | `course-3d.ts:95-177` | Base saine, à conserver |
| `InstancedMesh` déjà utilisé (36 occurrences) | `src/game/` | Public et décors déjà en partie optimisés |

Mesures réelles disponibles : Galaxy Z Flip6 (Adreno 750, haut de gamme), ville
du mode carrière, 59,7 images/s, p95 16,7 ms (`docs/mesures/`). **Aucune mesure
sur un téléphone d'entrée ou de milieu de gamme, ni sur iPhone.** Le dernier
test de course 3D (`docs/performance-2026-11-10.md`) tournait en rendu logiciel
et ne dit rien de la fluidité réelle.

## 2. Lots proposés

Coût estimé avec Fable 5.2 au tarif API (8 $ / 40 $ par million de tokens,
lecture de cache 0,20 $), en comptant environ 0,25 à 0,40 $ par tour d'agent
avec cache. Le nombre de tours est l'hypothèse la plus incertaine.

| # | Lot | Contenu | Tours estimés | Coût estimé |
|---|---|---|---:|---:|
| 1 | Chaîne d'assets | Script `gltf-transform` : textures en KTX2/Basis, simplification et niveaux de détail automatiques, version mobile de chaque accessoire ultra (objectif < 1-2 Mo), budget mémoire par stade | 300-600 | 100-250 $ |
| 2 | Moteur de rendu | Découper `course-3d.ts` en modules ; paliers selon le GPU détecté (ULTRA possible sur téléphone haut de gamme) ; éclairage PBR + carte d'environnement ; ombres moins coûteuses (une cascade, ombres précalculées pour le décor fixe) ; post-traitement léger (bloom, AO bon marché) | 1 500-3 000 | 500-1 200 $ |
| 3 | Athlètes et animation | Mélange des cycles de course, foulée liée à la vitesse, corps optimisés (squelette et polygones), public en imposteurs au-delà d'une distance | 800-1 500 | 250-600 $ |
| 4 | Stades et décors (9 thèmes) | Passer chaque stade (jour, nuit, Montreuil, Danube, Riviera, Mondiaux, Namek, Cosmos, Arc-en-ciel, Halloween) sur la nouvelle chaîne et le nouveau rendu | 1 500-3 000 | 450-1 200 $ |
| 5 | Mesure et chargement | Banc de mesure automatique par appareil, chargement progressif par stade, contrôle des budgets en CI | 400-800 | 120-300 $ |
| | **Total** | | **4 500-8 900** | **≈ 1 400-3 550 $** |

Le mode rapide (16 $ / 80 $) double ces montants. Avec Opus 5.5 (4 $ / 20 $),
ils sont environ divisés par deux ; on peut lui confier les lots 1, 4 et 5 et
garder Fable 5.2 pour les lots 2 et 3.

## 3. Hors chiffrage

- **Modèles, textures et animations de qualité professionnelle.** Le code peut
  optimiser et mettre en valeur les modèles existants, pas en créer de
  meilleurs. Pour un vrai saut visuel (personnages, capture de mouvement,
  stades détaillés), il faut un artiste 3D ou des modèles achetés. C'est
  probablement le poste le plus cher.
- **Tests sur appareils réels.** Il faut au minimum un Android d'entrée de
  gamme, un de milieu de gamme et un iPhone, branchés en débogage USB comme
  pour les mesures du Z Flip6.
- **L'interface React** (écrans, HUD, ~60 000 lignes) : non concernée par la
  3D, à garder telle quelle.

## 4. Ordre conseillé

1. Lot 5 (partie mesure) d'abord : sans chiffres sur un téléphone modeste, on
   ne peut pas juger les autres lots.
2. Lot 1 : c'est le gain le plus fort pour le coût le plus faible (mémoire,
   chargement, stabilité).
3. Lot 2, puis 3 et 4 stade par stade, en vérifiant la cadence à chaque étape.

## 5. Avancement

### Lot 1, étape 1 — compression sans perte des pièces ultra (10/11)

- `public/modeles/stades-ultra/` : **148 → 74 Mo** (45 pièces). Les quatre pièces de
  la ruelle d'Halloween, que tous les appareils chargent (`course-3d.ts:630`), passent
  de 98 à environ 49 Mo.
- Méthode : `tools/assets/optimiser-glb.mjs` (`npm run assets:optimiser`). Retire les
  coordonnées de texture des matériaux sans texture, réordonne pour le cache de sommets,
  compresse en `EXT_meshopt_compression` **sans quantification** (Float32 conservé,
  comme les pièces légères déjà publiées : le jeu fusionne des matrices dans la
  géométrie, `ruelle-3d.ts:180`).
- Preuve : `tools/assets/verifier-identique.mjs` compare l'ensemble des triangles
  (positions, normales, sens) : 45/45 identiques à l'original. Le même outil signale
  bien une version quantifiée comme différente. Les 45 pièces ont aussi été chargées
  avec le GLTFLoader + MeshoptDecoder du jeu, en refaisant le chemin `applyMatrix4`
  de la ruelle : mêmes triangles, mêmes boîtes.
- `tools/assets/comparer.mjs` : capture côte à côte de deux GLB.
- Non fait : course 3D complète dans le navigateur, mesure sur téléphone.
- Écart avec une consigne : l'export Blender `--ultra` disait « sans compression »
  (`tools/blender/stades_3d_glb.py`). La compression appliquée est sans perte ; si la
  consigne visait aussi la compression sans perte, `git revert` du commit rétablit les
  fichiers d'origine.
- Non touchés : `boss-plein/` et `vedettes/meba-plein.glb` (le choix « sans la
  compression qui les arrondit » y est explicite, et leur poids vient des textures
  PNG 4096, que les téléphones ne chargent pas).
