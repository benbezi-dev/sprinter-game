# La nuit du molosse — le teaser

Fabriqué le **16 octobre 2026**, pour une ouverture le **lundi 19 octobre à
minuit, heure de Paris** (`EDITION_HALLOWEEN`, `src/game/edition.ts`).

| Fichier | Pour | Format |
|---|---|---|
| `teaser-halloween-fr.mp4` · `-en.mp4` | **Reel, TikTok, story, Short** | 1080×1920, 30 i/s, **20,5 s**, H.264 + AAC, 4,7 Mo |
| `affiche-fr-story.jpg` · `-en-` | story fixe, vignette du reel | 1080×1920 |
| `affiche-fr-feed.jpg` · `-en-` | post Instagram, X, Facebook | 1080×1350 (4:5) |

Refaire tout (FR et EN, films et affiches, environ 1 min 30) :

    node tools/teaser-halloween.mjs
    node tools/teaser-halloween.mjs --fr        # une seule langue
    node tools/teaser-halloween.mjs --apercu    # douze images fixes, pas de film

Il faut Playwright (son Chromium) et ffmpeg dans le `PATH` (ou `FFMPEG=…`).

## Ce qu'il y a dans le film

**Aucune image fabriquée pour l'occasion.** Tout vient du mode tel qu'il
sort le 19 : les cartes des scénettes rendues dans Unity
(`src/assets/molosse-cartes/`), la tête de la bête et l'affiche de victoire.
**La musique est celle du mode** (`src/assets/molosse.mp3`), elle nous
appartient : pas de risque de son coupé par Instagram.

**Les mots sont ceux du jeu**, mot pour mot : la règle affichée à l'entrée
(`hw_regle`), la promesse de la banderole (`hw_sous`), le titre, et
l'avertissement « au casque, c'est pire ». Le teaser ne promet rien que le
jeu ne tienne.

**Le montage est calé sur la musique.** Le morceau (152 à la noire) n'a
qu'un seul creux, le break des mesures 17 à 20 ; le film part dedans et la
bête tombe sur la reprise :

| s | image | texte (FR) | texte (EN) |
|---|---|---|---|
| 0,0 | les empreintes dans la ruelle | Un molosse part derrière toi. | A hound starts behind you. |
| 1,9 | la silhouette au bout de la ruelle | Il franchira la ligne à la seconde près. | It will cross the line on the exact second. |
| 3,9 | la bête sous la fenêtre éclairée | Passe-la avant lui. | Get there first. |
| 5,4 | les yeux rouges dans le miroir, puis le noir | — | — |
| **6,3** | **la reprise : la tête, un éclair rouge, l'image qui tremble, un coup sourd** | — | — |
| 7,9 | les yeux sous le lit | TREIZE NUITS | THIRTEEN NIGHTS |
| 9,5 | le téléphone sur le lit | UNE BÊTE | ONE BEAST |
| 11,0 | la montre : 10.42 / 10.52 | ET LE TEMPS QU'IL TE RESTE | AND THE TIME YOU HAVE LEFT |
| 12,6 | les empreintes jusqu'au lit | UNE NUIT PAR JOUR | ONE NIGHT A DAY |
| 14,2 | l'affiche : lune rousse, cimetière | LA NUIT DU MOLOSSE · DU 19 AU 31 OCTOBRE · sprinter-game.com | THE HOUND'S NIGHT · 19 – 31 OCTOBER |

Chaque coupe après la reprise tombe sur une barre de mesure (1,579 s). Le
film se ferme sur un fondu au noir de 0,45 s : un reel boucle, et une
dernière image qui saute se lirait comme un accroc.

**Son** : −15,7 dB de moyenne, crête à −1,7 dB. La moyenne est un peu sous
les −14 d'Instagram parce que les six premières secondes sont le break,
volontairement calme (−19,4) ; à partir de la reprise, le film est à −14,7.

**Un seul éclair rouge**, sur la reprise, et pas de stroboscope : le mode
lui-même avertit des flashs rouges, le teaser n'en met qu'un.

---

## Les légendes, prêtes à copier

Lien : **sprinter-game.com**

### Instagram / TikTok (FR) — avec le film

> Un molosse part derrière toi. Il franchira la ligne à la seconde près.
> Passe-la avant lui.
>
> 🌕 **La nuit du molosse** — édition limitée d'Halloween
> 13 nuits, une par jour, du 19 au 31 octobre.
> Au casque, c'est pire.
>
> ▶ sprinter-game.com
>
> #halloween #jeuvideo #jeumobile #indiegame #sprint #SprinterGame

### Instagram / TikTok (EN)

> A hound starts behind you. It will cross the line on the exact second.
> Get there first.
>
> 🌕 **The Hound's Night** — limited Halloween edition
> 13 nights, one a day, 19 to 31 October.
> Headphones make it worse.
>
> ▶ sprinter-game.com
>
> #halloween #indiegame #mobilegame #horrorgame #sprint #SprinterGame

### X (FR) — avec le film ou l'affiche feed

> Lundi, minuit. Un molosse part derrière toi.
> 13 nuits, une par jour, jusqu'au 31 octobre.
> 🌕 sprinter-game.com

### X (EN)

> Monday, midnight. A hound starts behind you.
> 13 nights, one a day, until 31 October.
> 🌕 sprinter-game.com

## Quand poster

| Jour | Quoi |
|---|---|
| **sam. 17** | le film en Reel + TikTok ; l'affiche feed sur X |
| **dim. 18**, le soir | l'affiche story : « cette nuit, minuit » en autocollant compte à rebours Instagram |
| **lun. 19**, 0 h | le film en story : « c'est ouvert » |

« Lundi, minuit » ne vaut que **jusqu'au dimanche 18** : à partir du 19,
remplace-le par « c'est ouvert » ou retire la ligne.
