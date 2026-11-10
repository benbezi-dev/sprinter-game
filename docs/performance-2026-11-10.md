# Vérification des optimisations du 10 novembre 2026

La comparaison porte sur la première version de la PR #96 (`7028318`), puis son complément pour l'ouverture, l'accueil et la présentation. Elle ne constitue pas une mesure sur téléphone réel.

Chromium headless, rendu logiciel SwiftShader, viewport mobile 390 × 844, densité 2, nouveau contexte navigateur à chaque lancement. L'application est construite en production et servie par `vite preview`. Les appels au service des classements sont bloqués. Une horloge `requestAnimationFrame` relève les intervalles par état ; la fenêtre de profilage à l'accueil dure environ cinq secondes. Chaque configuration a été observée une fois : les chiffres indiquent une tendance locale, sans garantie de cadence sur d'autres appareils.

| Mesure | Première version de la PR | Complément |
| --- | ---: | ---: |
| Intervalle moyen à l'accueil | 63,37 ms | 28,94 ms |
| Intervalle au 95e percentile à l'accueil | 66,80 ms | 49,90 ms |
| Images attendues avant l'accueil | 168 | 104 |

Les 64 fichiers reportés représentent environ 1 622 Kio compressés (décors des Mondiaux et de la nuit). Ils restent accessibles à la demande pour les courses concernées ; la préparation du stade avant le décompte est conservée. La durée minimale de l'animation d'ouverture reste inchangée.

La composition du public et la synthèse audio ne masquent plus indéfiniment les ralentissements à l'accueil au régulateur de qualité. Leurs budgets par image passent de 20 + 8 ms à l'ouverture et 4 + 4 ms à l'accueil, à respectivement 2 + 2 ms et 1 + 1 ms. Un travail individuel peut dépasser son budget : ces budgets ne garantissent pas un temps d'image maximal.

La 3D utilise désormais le temps réel entre deux rendus et s'adapte dès la présentation et le décompte. Le premier stade dispose d'une seconde de grâce pour la compilation ; le retour aux menus réinitialise la mesure. Le pas de simulation, les règles et les chronos restent inchangés.

## Validation

- `npm run typecheck`
- `npm run build` (avertissement existant sur les gros bundles)
- `node tools/performance-test.mjs` : concurrence réseau, pause/reprise, économie de données, ressources essentielles, cadence faible, grâce, présentation et audio fractionné.
- `node tools/coude-casse-test.mjs`
- Navigateur : course 2D démarrée, progression de 0 à 7,30 m après douze appuis alternés, sans erreur JavaScript.
- Navigateur : décompte 3D observé sans erreur JavaScript, baisse automatique du palier 2 au palier 1 avant le départ. SwiftShader reste très lent (environ 2 images/s dans cette vérification) : cette mesure ne valide pas la fluidité sur GPU matériel, ni une course 3D complète.

Le flou des panneaux a également été désactivé temporairement dans le navigateur pour comparer : environ 58,21 puis 57,62 ms par image. Cette différence isolée ne justifie pas une modification de l'habillage ; le flou est donc conservé.
