# Films d'explication — une fonctionnalité par film

Cinq films courts, verticaux, muets, qui expliquent chacun une mécanique du jeu.
Ils sont faits pour tourner seuls : chacun se comprend sans avoir vu les autres,
et sans son.

| Film | Sujet | Durée | Accent |
|---|---|---|---|
| `01-classement-duels` | Le classement des duels : barème, échelle, points de ligue, mouvement | 28,4 s | or |
| `02-course-en-direct` | La salle, le départ à la date, la présentation, la course, le duel à deux | 32,6 s | cyan |
| `03-relais-4x100` | L'équipe, les invitations, l'ordre, la zone de 30 m, la transmission | 33,8 s | fuchsia |
| `04-nationalite` | Facultative, détectée ≠ choisie, définitive, et ce qu'elle ouvre | 30,2 s | argent |
| `05-championnats` | Trois échelons, la grille de 32, le format, le week-end, le titre | 34,2 s | ambre |

Chaque film sort en deux formes depuis **la même source** : la vidéo, et des
photos qui en sont des images exactes — pas des maquettes refaites à côté, qui
finiraient par ne plus dire la même chose que le film.

## Fabriquer

```
node rendu.mjs photos            # les images fixes de tous les films
node rendu.mjs film              # toutes les images de tous les films
./encoder.sh                     # les MP4
```

Chaque commande accepte un ou plusieurs noms de films pour n'en refaire qu'un :

```
node rendu.mjs film 03-relais-4x100
./encoder.sh 03-relais-4x100
```

Pour vérifier un instant précis pendant l'écriture — l'image atterrit dans
`controle/` :

```
node rendu.mjs voir 03-relais-4x100 21.6
```

## Ce qui sort où

- `videos/sprinter-<film>.mp4` — 1080×1920, 30 i/s, H.264 High, yuv420p,
  faststart. Muet : la musique se pose au montage.
- `photos/<film>/NN-<nom>.png` — les images fixes, dans l'ordre du film.
- `images/<film>/` et `controle/` — intermédiaires de rendu, non versionnés.

## Écrire un film

Un film est un seul fichier HTML. Il pose ses plans, puis appelle `monterFilm()`
avec sa timeline. Le moteur commun (`commun.js`) et la charte (`commun.css`)
font le reste — un film qui s'en écarte se verra à côté des autres.

Rien n'est animé par CSS : **tout dépend du temps**. `window.renderFrame(t)`
pose l'image de l'instant `t`, et deux appels avec le même `t` donnent la même
image. C'est ce qui rend le rendu reproductible, et c'est ce qui permet
d'extraire une photo à la milliseconde près sans rejouer le film.

La liste `photos` de `monterFilm()` déclare les instants à extraire, avec leur
nom de fichier.

## Ce que ces films promettent

Les chiffres viennent du code, pas d'une intention : barème `LP` et échelle dans
`worker/src/classement.js`, format et échelons dans
`worker/src/championnats-config.js`, zone et fenêtre de transmission dans
`worker/src/relais-course.js`, nationalité dans `src/game/identity.ts`.
Les changer dans le jeu sans les changer ici ferait mentir la promo.
