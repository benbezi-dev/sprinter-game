# Story — ouverture des défis des vedettes (samedi 3 octobre, 21 h 30)

Quatre écrans 1080 × 1920, à poster dans l'ordre. Fabriqués par
`tools/carte-defis-vedettes.mjs` : les chronos sont lus dans le moteur
(8,39 et 17,30 pour Méba-Mickaël, 11,80 pour Aurel), pas recopiés.

| Écran | Sticker à poser |
|---|---|
| `1-ce-soir-story.png` | **Compte à rebours** « Défis des vedettes », samedi 21 h 30 : ceux qui le suivent sont prévenus à l'ouverture. À poster **avant** 21 h 30. |
| `2-meba-story.png` | Mention **@** de Méba-Mickaël, en bas à gauche, sous les chronos |
| `3-aurel-story.png` | Mention **@** d'Aurel, même place |
| `4-une-semaine-story.png` | **Lien** → `https://sprinter-game.com`, texte du sticker : `RELEVER LE DÉFI`, dans le vide sous l'adresse |

Instagram mange 250 px en haut et en bas : rien n'y est écrit.

## L'écran 1 est en photo

Photo du 3 octobre (`20261003_181004`, dossier Drive « Aurel Mickeal »),
convertie de HEIC en JPEG, puis :

    node tools/carte-defis-vedettes.mjs --photo-duo 20261003_181004.jpg --cadre-duo 0.52,0.40,1240,760

La photo source n'est pas dans le dépôt : elle reste sur le Drive. Les
écrans 2 et 3 gardent les portraits 3D du jeu.

## Avec les vraies photos

Les portraits 3D du jeu sont en place. Pour mettre de vraies photos
(pas besoin qu'elles soient détourées, elles sont recadrées et fondues par
le bas) :

    node tools/carte-defis-vedettes.mjs --photo-meba meba.jpg --photo-manga aurel.jpg

Sans accès à Google Fonts depuis Chrome : `SPRINTER_POLICES=<dossier>` (voir
`tools/chrome.mjs`).
