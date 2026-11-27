# Gestes de saut mesurés (MediaPipe Pose, 27/11/2026)

Les poses sont extraites image par image par `outils/poses.py` (dans le brouillon de session), avec le modèle `pose_landmarker_heavy`. Elles sont mesurées sur la vidéo vue de profil, en 2D : ce ne sont pas des angles 3D vrais.

Conventions :
- **cuisse** : angle de la cuisse par rapport à la verticale, + vers la droite de l'image. Il faut donc le retourner quand l'athlète court vers la gauche.
- **genou** : 180 = jambe tendue.
- **buste** : 0 = droit.

Les mesures sont bruitées. MediaPipe confond parfois la jambe gauche et la droite (la valeur saute de ±60 à 90° d'une image à l'autre) : il ne faut lire que les tendances sur 3 à 4 images.

## Ce qui est exploitable

| Vidéo | Épreuve | Vue | Partie suivie | Verdict |
|---|---|---|---|---|
| P5Sg_kACPRM, Carl Lewis | longueur | profil, ralenti 25 i/s | 8,2 à 12,4 s (élan, appel, vol) | bon jusqu'à 12,3 s. La réception est perdue (flou). |
| rjT_JwRi0oA, Edwards 18,29 | triple | profil, caméra mobile | 4,7 à 12,4 s (cloche, pas, saut, réception) | bon. Les angles de réception sont les plus nets. |
| 9PsvSQ9kCNg, Tokyo | longueur | profil, du haut des tribunes | 4 à 16 s (élan) | course d'élan seulement. Le saut sort du suivi. |
| GhoHU-HUvlQ, Echevarría | longueur | large, public au premier plan | — | athlète trop petit, le suivi accroche des têtes du public. |
| a-N1YBJG_nI, triple au ralenti | triple | de face | — | de face : inutilisable pour les angles de profil. |

## Valeurs relevées

**Lewis, appel puis début du vol (11,3 à 11,5 s)**
- Cuisse libre à +75 / +90° (au-dessus de l'horizontale), genou libre plié à 76–130°.
- Jambe d'appel en arrière (−20 / −25°), presque tendue (164–169°).
- Buste quasi droit (+3 / +6°).
- À l'appel, les deux bras sont bas, épaules à 1–19° (bras le long du corps), puis ils remontent.

**Lewis, en l'air (11,6 à 12,3 s)** : les cuisses s'échangent (+30 → −13 → +65 → +96) pendant que les genoux se plient et se tendent. C'est le ciseau, environ 1,5 cycle en 0,7 s de vidéo. Le buste passe de −2 à −22° : il recule, les jambes partent devant.

**Edwards, réception du triple (11,6 à 12,2 s)**
- Les deux cuisses ensemble, à 85–97° devant (presque horizontales).
- Genoux à 100–120°, qui se tendent à 150–180° juste avant le sable (12,0 à 12,1 s).
- Buste penché en avant de 40 à 49° sur les jambes.
- Les bras partent devant puis en arrière.

**Edwards, cloche et pas (9,8 à 10,3 s)** : la cuisse avant est tenue à ~85° (horizontale), genou à 85–90° (angle droit), buste droit (−5 / −11°). C'est la position « assise en l'air » du pas.

## Pour le jeu (étape 3)

Le code de `longueur-rendu.js` (`postureDe`) et de `triple` donne aujourd'hui des positions écrites à la main. Le plan est de les recaler sur ces valeurs :
- l'appel (cuisse libre ~85°, genou ~90°) ;
- le ciseau (amplitude des cuisses ±60–90°, 1,5 cycle) ;
- la réception (cuisses ~90°, genoux qui se tendent, buste à −45°).
