# Sauts — dossier de conception et calibration (27/11/2026, à valider)

Le moteur est Sprinter : JavaScript et TypeScript, three.js, vue de côté en 3D. Ce dossier ne remplace rien de ce qui existe, il l'étend.

## 1. Ce qui existe déjà (audit)

| Brique | Fichier | Ce qu'elle fait |
|---|---|---|
| Physique de la longueur | `longueur-jeu.js` | Vol balistique du centre de masse (CM) : 1,25 m à l'envol, 0,55 m à la réception. La planche freine la vitesse horizontale, d'autant plus que l'angle est grand : `perte = 4 % + 0,35 % × (angle − 10)^1,5`. Le meilleur angle tombe tout seul vers 21°. Calcule aussi le mordu, la note du ramené, le vent et la marque. |
| Physique du triple | `triple-jeu.js` | Les trois bonds s'enchaînent : chacun repart avec la vitesse laissée par le précédent. Chaque appui est jugé « actif », « bon », « écrasé » ou « rompu », et garde 98,5 % à 86 % de la vitesse. Angles visés : 15, 16 et 20,5°. |
| Machine à états | `longueur-course.js` | attente → élan → appel → vol (→ pose, au triple) → réception → mesure. |
| Gestes | `longueur-rendu.js` | Postures calculées avec cinématique inverse (IK) : appel, ciseau, ramené (recalé sur les mesures d'Edwards le 27/11), réception. |
| 3D | `course-3d/sautoir.ts`, `camera.ts` | Sautoir et caméra de côté (étapes 1 et 2). |
| Tests | `tools/longueur-test.mjs`, `tools/triple-test.mjs` | Tous passent. |

Ce qui manque :
- les profils d'athlètes ;
- l'avant-dernier appui (CM qui descend, foulées qui changent de longueur) ;
- le temps de contact et la raideur de jambe ;
- la télémétrie ;
- les tests calés sur les records.

## 2. Architecture proposée

Rien n'est réécrit : on paramètre ce qui existe.

1. **`sauts-profils.js`** : les profils, de simples objets JSON. Chaque champ manquant prend la valeur actuelle du jeu. Un saut sans profil donne donc exactement le même résultat qu'aujourd'hui.
2. **`longueur-jeu.js` et `triple-jeu.js`** : `vol()`, `sauter()`, `bond()` et `sauterTriple()` prennent un `profil` en option : vitesse d'approche, courbe de perte, hauteurs du CM, angles visés, contacts.
3. **L'avant-dernier appui** (`longueur-course.js`, phase élan) :
   - les 3 dernières foulées font +6 % puis −9 % (rapport WA 2017) ;
   - le CM descend de 3 à 5 cm sur l'avant-dernier appui ;
   - un rythme juste sur ces deux appuis donne un léger gain de vitesse verticale (Vy) ; un rythme cassé coûte de la vitesse horizontale (Vx).
4. **Le contact** : l'appel garde son geste de jeu (on tient le pavé pour régler l'angle). Le corps, lui, montre un freinage puis une poussée, dans les temps réels du profil (0,11 à 0,14 s), ralentis comme le reste.
5. **La raideur au triple** : la note de chaque appui pilote aussi l'écrasement du bassin. Pour Rojas, il est de 5, 18 et 13 cm. Un appui « écrasé » montre un bassin qui s'effondre, et sa vitesse chute déjà (c'est le cas aujourd'hui).
6. **Télémétrie** : `?telemetrie=1` affiche dans la console un tableau par essai : vitesse d'approche, Vx et Vy à l'envol, angle, perte de Vx par appui, répartition des bonds, marque.
7. **Tests** : on ajoute des cas par profil dans `tools/*-test.mjs` (voir §4).

## 3. Table de calibration

Statut :
- **Sourcé** : lu dans le document cité.
- **Partiel** : vu dans un résumé ou lu sur un graphique.
- **Cahier des charges** : vient de ta demande, sans source trouvée.

### Longueur

| Profil (calibration) | Valeur | Chiffre | Statut / source |
|---|---|---|---|
| Lewis, Tokyo 1991 | vitesse d'approche | 11,06 m/s | sourcé : Koyama, ISBS 2008, citant Fukashiro 1994 |
| | angle d'envol | ~20,3° | partiel : résumé Ariel/Vorobiev, non ouvert |
| | contact à l'appel | ~0,11 s | cahier des charges. Fourchette élite sourcée : 0,112–0,144 s |
| | vol | ciseau, 3½ foulées | cahier des charges |
| Powell, Tokyo 1991 (8,95 m) | vitesse d'approche | 11,00 m/s | sourcé : Koyama 2008 |
| | angle d'envol | 24–24,6° | partiel : résumé Ariel/Vorobiev |
| | CM à l'avant-dernier appui | −5 à −8 cm | cahier des charges. Sur la planche, mesuré −3 cm en moyenne et −5 cm pour Manyonga (WA 2017) |
| Tentoglou | précision à la planche | 2–3 cm | cahier des charges. Aucun rapport biomécanique public trouvé |
| Élite (étalon) | perte de Vx à l'appel | −1,81 m/s en moyenne (−0,53 à −2,80) | sourcé : rapport WA, Londres 2017 |
| | Vx / Vy à l'envol | 8,61 / 3,85 m/s, angle 24,2° | sourcé : WA 2017 |
| | foulées finales | +6 % puis −9 % | sourcé : WA 2017 |
| | genou d'appel | 173,5° au contact, 139,3° au plus plié | sourcé : WA 2017 |

### Triple

| Profil (calibration) | Valeur | Chiffre | Statut / source |
|---|---|---|---|
| Edwards, Göteborg 1995 (18,29 m) | bonds | 6,05 / 5,22 / 7,02 m (33,1 / 28,5 / 38,4 %) | partiel : Guinness, page non ouverte. Chiffres très repris ailleurs |
| | Vx / Vy à l'envol | 9,60 / 2,75 ; 9,10 / 2,07 ; 7,80 / 2,44 m/s | sourcé : Lu & Wang, ISBS 2005 |
| | angles d'envol déduits | ≈ 16° / 13° / 17° | calculé à partir des Vx/Vy ci-dessus |
| | contacts | 0,099 / 0,099 / 0,141 s | sourcé : Lu & Wang 2005 |
| | vitesse d'approche | 10,5–10,7 m/s | cahier des charges. Non trouvé, cohérent avec Vx hop = 9,60 |
| | bras | double balancier | cahier des charges. Source secondaire non ouverte |
| Rojas, Londres 2017 (14,91 m) | bonds | 5,21 / 3,95 / 5,86 m (34,7 / 26,3 / 39 %) | sourcé : rapport WA 2017 |
| | angles | 16,6° / 11,7° / 26,6° | sourcé : WA 2017 |
| | contacts | 0,120 / 0,150 / 0,150 s | partiel : lu sur graphique |
| | CM qui s'écrase | 5 / 18 / 13 cm | sourcé : WA 2017 |
| | 15,74 m (Belgrade 2022) | — | aucun rapport biomécanique trouvé. On extrapole depuis 2017 |

Les gestes viennent des mesures MediaPipe (`MESURES.md`) :
- Lewis à l'appel : cuisse libre à 75–90°.
- Edwards à la réception : cuisses à 85–97°, genoux qui se tendent au dernier moment, buste à −40/−49°.

## 4. Tests de réalisme proposés

- Profil Powell, vitesse optimale, appel parfait : 8,50 à 8,95 m. L'angle optimal du modèle doit être de 23 à 25°.
- Profil Lewis : 8,60 à 8,91 m, angle optimal de 19 à 21°.
- Profil Edwards : 17,50 à 18,29 m, répartition 33 / 28,5 / 38,5 % à ±3 points, contacts 0,10 / 0,10 / 0,14 s.
- Profil Rojas : 14,9 à 15,74 m, saut dominant (le troisième bond est le plus long).
- Non-régression : sans profil, les tests actuels donnent les mêmes résultats.
- Pertes plausibles : la perte de Vx à l'appel reste entre −0,5 et −2,8 m/s pour tout angle de 15 à 30°.

## 5. Décisions à prendre

1. **Les noms à l'écran.** Les vrais noms servent de clés de calibration dans le code. À l'écran, je propose des noms de styles (« Vitesse », « Envol », « Précision », « Élastique », « Amplitude »), pour éviter un problème de droit à l'image.
2. **Qui utilise les profils ?**
   - (a) le joueur choisit son style ;
   - (b) seulement les adversaires ;
   - (c) les deux.
3. **La source des chiffres.** Les chiffres « cahier des charges » non sourcés (contact 0,11 s de Lewis, −5 à −8 cm de Powell, 2–3 cm de Tentoglou, 3½ foulées) restent-ils tels quels, ou les remplace-t-on par les fourchettes élites sourcées ?
