# Course d'élan du saut en hauteur : la mesure face au jeu (27/11/2026)

## Sources

- **R17H et R17F** : rapports biomécaniques World Athletics de Londres 2017 (Nicholson, Bissas, Merlino), finales hommes et femmes.
- **NIC22** : Nicholson et al. 2022, *Frontiers in Sports and Active Living*, 29 sauteurs des finales 2017-2018.
- Le texte du rapport hommes est relu en partie dans `scratchpad/d/r17m.txt` (Tableau 8, Barshim : foulées 1,93 / 2,34 / 2,14 m, contact 0,14 s).

**Pas de source chiffrée trouvée** pour :
- le nombre de foulées ;
- la longueur totale de l'élan ;
- le rayon de la courbe en mètres ;
- l'inclinaison du corps vers l'intérieur à l'appel.

## La mesure face au jeu

| | Élites, Londres 2017 | Jeu (`hauteur-course.js`, `hauteur-jeu.js`) | Écart |
|---|---|---|---|
| Vitesse au contact d'appel | H : 7,0–8,0 (moy. ≈ 7,5 ; NIC22 7,61). F : 6,5–7,0 m/s | idéale 8,0, plafond 9,2 m/s | **un peu trop vite** |
| Ralentissement sur les 2 derniers appuis | 0 à 0,5 m/s | aucun | manque |
| Angle de course / barre au dernier pas | H : 23–43° (moy. ≈ 31°). F : 21–39° | 35° | dans la fourchette |
| Fin de l'élan | courbe jusqu'à l'appel : 65° → 53° → 31° sur les 3 derniers pas, et 7 à 34° de virage pendant le dernier | **3 m de ligne droite** après la courbe | **à corriger** |
| Rayon | se resserre vers la fin (Tan & Yeadon 2005, sans valeur en m) | 11 m constant | à resserrer |
| Distance d'appel au plan de la barre | H : 0,8–1,7 m (moy. 1,2). F : 0,5–1,1 m (moy. 0,9) | référence 1,35 m, fenêtre 0,3–2,0 m | correct |
| Abaissement du CM au dernier pas | 2 à 8 % de la taille chez la majorité (≈ 4–15 cm) | aucun | manque |
| Inclinaison latérale du tronc au contact | 4–13° vers l'intérieur | inclinaison du corps jusqu'à 24° dans la courbe, effacée pendant l'appel | plausible |
| Inclinaison du corps vers l'arrière au contact | H : 35–45°. F : 33–40° | non mesurée dans le jeu | à vérifier |
| Durée de l'appel | 0,14–0,19 s (moy. 0,17) | ≈ 0,12 s pour l'angle idéal (0,3 s réelles au ralenti 0,4) | un peu court |
| Angle d'envol | H : 44–53° (moy. 48,8). F : 41–48° | idéal 48° | juste |
| Vitesse verticale à l'envol | H : 4,5–5,0. F : 3,7–4,2 m/s | — | — |

## Appliqué le 27/11 (validé par l'auteur)

1. **Une courbe jusqu'au pied d'appel.**
   - On supprime les 3 m de ligne droite finale.
   - Le rayon se resserre de 11 m à environ 6 m sur les trois derniers pas : le virage passe de 65° à 31° par rapport à la barre.
   - L'angle final est ramené de 35° à 31°.
2. **Une vitesse idéale ramenée à 7,6 m/s**, avec un plafond à 8,6 m/s. Il faudra relancer les tests des plateaux.
3. **Un léger ralentissement et un abaissement du CM** (environ 8 cm) sur les deux derniers appuis, comme l'avant-dernier appui de la longueur.
4. **Un appel plus long**, d'environ 0,16 s en temps de jeu : un ralenti un peu plus fort, ou une pente d'angle plus douce.

### Ce qui a été fait

- **Le J** (`hauteur-course.js`) : 12,6 m de ligne droite, un arc de 11 m jusqu'à 53° de la barre (7,1 m), puis un arc de 6 m jusqu'à 31° (2,3 m). La longueur totale reste 22 m. Au-delà de l'appel de référence, la course file droit.
- **La vitesse** (`hauteur-jeu.js`) : la vitesse idéale passe à 7,6 m/s, le plafond à 8,6 m/s. FORCE passe de 1,6 à 1,756 pour que le saut parfait garde sa hauteur : 2,46 m, pour un record du monde à 2,45 m.
- **Les deux derniers appuis** : sur les 4,5 derniers mètres, l'athlète perd jusqu'à 4 % de sa vitesse, et son bassin descend de 8 cm.
- **L'appel** : le ralenti passe de 0,4 à 0,55. L'appel au bon angle dure donc 0,165 s en temps de jeu.

### Vérification

Toutes les suites de tests passent : hauteur, longueur, triple et profils.

Le film `elan-hauteur.mp4` montre un saut à 1,90 m franchi avec 43 cm de marge :
- vitesse moteur 8,15 m/s, 7,83 m/s à l'appel ;
- appel à 1,40 m de la barre ;
- course à 32° de la barre.
