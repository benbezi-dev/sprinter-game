# Piste d'athlétisme — dimensions et tracé

Fiche de référence pour dessiner une piste de 400 m conforme (norme World Athletics,
*Track and Field Facilities Manual*). Toutes les cotes sont en mètres.

> Note d'origine : la source demandée était un post Instagram
> (`instagram.com/p/DcAai7fCS3e`, image 8), inaccessible depuis l'environnement
> d'exécution (domaine bloqué par le proxy réseau). Les valeurs ci-dessous
> proviennent des références officielles publiques citées en fin de fiche.

## 1. Géométrie d'ensemble — la piste standard 400 m

La piste standard est un **stade** (deux demi-cercles + deux droites) :

| Élément | Valeur |
| --- | --- |
| Rayon intérieur (bord intérieur de la bordure / corde) | **36,50** |
| Rayon de la ligne de mesure du couloir 1 (corde + 0,30) | **36,80** |
| Longueur de chaque ligne droite | **84,39** |
| Périmètre à la corde (36,50) | 398,12 |
| Périmètre sur la ligne de mesure (36,80) | **400,00** |
| Largeur d'un couloir | **1,22 ± 0,01** |
| Nombre de couloirs | 8 (min. international) ; 6 à 9 selon l'installation |
| Encombrement total (8 couloirs) | env. **176,91 × 92,52** |

Vérification : `2 × 84,39 + 2π × 36,80 = 168,78 + 231,22 = 400,00`.

Longueur d'une demi-piste (un virage + une droite) = 200,00 : les 200 m, 400 m,
800 m… se déduisent donc directement de cette symétrie.

### Variante « anse de panier »

Certaines pistes remplacent le demi-cercle unique par un virage à plusieurs rayons
(arcs de **R1 = 51,843** et **R2 = 34,000**). Le développé reste 400,00 m, mais la
courbure est plus douce en entrée/sortie de virage. Le tracé standard (rayon unique
36,50) reste la référence.

## 2. Ligne de mesure — la règle des 30 cm / 20 cm

La distance d'un couloir n'est pas mesurée sur sa ligne intérieure mais sur une
**ligne de mesure** décalée vers l'extérieur :

- **Couloir 1** : 0,30 m depuis le bord intérieur (parce qu'une bordure physique
  éloigne le coureur du bord).
- **Couloirs 2 à 8** : 0,20 m depuis le bord extérieur de la ligne peinte
  intérieure du couloir.

Rayon de mesure du couloir *n* :

```
r(1) = 36,50 + 0,30                  = 36,80
r(n) = 36,50 + (n-1) × 1,22 + 0,20   pour n ≥ 2
```

## 3. Longueur des couloirs et décalage au départ (stagger)

Longueur d'un tour complet et décalage cumulé par rapport au couloir 1 :

| Couloir | Rayon de mesure | Longueur d'un tour | Décalage cumulé | Écart au couloir précédent |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 36,80 | 400,00 | 0,00 | — |
| 2 | 37,92 | 407,04 | 7,04 | 7,04 |
| 3 | 39,14 | 414,70 | 14,70 | 7,66 |
| 4 | 40,36 | 422,37 | 22,37 | 7,66 |
| 5 | 41,58 | 430,03 | 30,03 | 7,66 |
| 6 | 42,80 | 437,70 | 37,70 | 7,66 |
| 7 | 44,02 | 445,37 | 45,37 | 7,66 |
| 8 | 45,24 | 453,03 | 53,03 | 7,66 |

Formule : `longueur(n) = 168,78 + 2π × r(n)`.

Le décalage entre deux couloirs consécutifs vaut `2π × 1,22 = 7,665` m **pour un
tour complet** (deux virages). Le couloir 2 fait exception (7,04) à cause du
décalage de mesure 0,30 → 0,20.

Sur une course à **un seul virage** (200 m, 4 × 100 m), le décalage vaut la moitié :
`π × 1,22 = 3,833` m par couloir.

## 4. Lignes de départ / arrivée

- **Arrivée** : unique, à l'extrémité de la ligne droite d'arrivée, perpendiculaire
  aux couloirs, commune à toutes les courses. Les intersections des lignes de
  couloir avec la ligne d'arrivée sont peintes en noir sur 2 cm au-delà.
- **Départs en ligne droite** (non décalés) : 50 m, 60 m, 80 m, 100 m, 110 m haies.
- **Départs décalés par couloir** (courses courues entièrement en couloir) :
  200 m, 400 m, 4 × 100 m, 400 m haies, 4 × 400 m (1er relayeur).
- **Départs en ligne incurvée / groupée** (compensée, tous couloirs sur une même
  ligne courbe) : 800 m, 1 000 m, 1 500 m, mile, 2 000 m, 3 000 m, 5 000 m,
  10 000 m, steeple.
- Repères usuels sur la corde : le 1 500 m part au niveau du « 300 m » et les
  1 000 / 3 000 / 5 000 m au niveau du « 200 m » du couloir 1.

### Lignes de rabat

- **800 m, 4 × 200 m, 4 × 400 m** : ligne de rabat **verte** à la sortie du premier
  virage — les coureurs peuvent alors rejoindre la corde.
- Courses > 3 000 m à départ décalé : marque de rabat 5 × 5 cm verte à la sortie du
  deuxième virage.

## 5. Zones de transmission (relais)

- **4 × 100 m** : zone de transmission de **30 m** (repères en jaune, ligne
  « en crochet »), précédée d'une **zone d'élan de 10 m** pour le relayeur qui part.
  La ligne de repère (scratch line) est au milieu ; le début de zone est marqué
  20 m avant.
- **4 × 400 m** : zone de transmission de 20 m autour de la ligne d'arrivée
  (repères **bleus**) ; les relayeurs 2, 3 et 4 se placent selon l'ordre de course.

## 6. Marquage et matériaux

| Élément | Valeur |
| --- | --- |
| Largeur de toutes les lignes peintes | **0,05** (5 cm) |
| Appartenance de la ligne | La ligne intérieure d'un couloir appartient à ce couloir (la largeur du couloir inclut sa ligne de gauche) |
| Bordure (corde) — hauteur | 0,05 à 0,065 |
| Bordure (corde) — largeur | 0,05 à 0,25 |
| Couleur dominante de la surface | rouge brique (polyuréthane / EPDM) |
| Couleur des lignes | blanc ; repères de départ/rabat/relais en couleurs codées (vert, jaune, bleu) |
| Dévers latéral maximum | 1 % (1:100) vers l'intérieur |
| Pente maximale dans le sens de course | 0,1 % (1:1000) |
| Sens de course | sens inverse des aiguilles d'une montre (corde à gauche) |

Une zone de sécurité dégagée est prévue à l'extérieur du couloir extérieur
(usuellement ≥ 1 m) et à l'intérieur de la corde.

## 7. Tracé programmatique

Repère : origine au centre de la piste, axe X selon les lignes droites.

```
L  = 84.39          // longueur d'une droite
R  = 36.50          // rayon a la corde
W  = 1.22           // largeur d'un couloir
r(n) = (n === 1) ? R + 0.30 : R + (n - 1) * W + 0.20

// Bord interieur du couloir n :  rayon_int(n) = R + (n - 1) * W
// Centre des demi-cercles : (-L/2, 0) et (+L/2, 0)
// Un couloir se dessine comme :
//   droite du bas  : de (-L/2, -rayon) a (+L/2, -rayon)
//   demi-cercle droit : centre (+L/2, 0), de -90 deg a +90 deg
//   droite du haut : de (+L/2, +rayon) a (-L/2, +rayon)
//   demi-cercle gauche : centre (-L/2, 0), de +90 deg a +270 deg
```

Position curviligne → coordonnées, pour une distance `s` parcourue sur la ligne
de mesure du couloir *n* (départ à la ligne d'arrivée, sens antihoraire) :

```
r   = r(n)
Ld  = L                    // 84.39
Lv  = PI * r               // developpe d'un virage pour ce couloir
// segments successifs : droite (Ld), virage (Lv), droite (Ld), virage (Lv)
// total = 2 * Ld + 2 * Lv
```

## Sources

- World Athletics — *Track and Field Facilities Manual*, marking plan 400 m standard track
- Wikipédia FR — « Piste d'athlétisme »
- Dimensions.com — 400 m running track
- FFA — Règlement des installations et matériels fixes d'athlétisme
