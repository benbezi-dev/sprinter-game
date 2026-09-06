# Vidéo « nouveautés » — réseaux sociaux

`sprinter-nouveautes-1080x1920.mp4` — 9:16, 30 i/s, 61,5 s, H.264 High / yuv420p, faststart.
Muette : poser une musique ou un son tendance au montage.
`couverture-1080x1920.png` — image de couverture proposée pour le post.

## Refabriquer la vidéo

`source-video/video.html` est le film entier : une scène par plan, animée par
`window.renderFrame(t)` — tout est piloté par le temps, aucune animation CSS,
donc chaque image est reproductible à l'identique.

```
node source-video/render.mjs preview 12.3 21.4   # quelques images de contrôle
node source-video/render.mjs full                # les 1845 images
./source-video/encode.sh                         # encodage MP4
```

Le chapitrage vit dans la constante `S` en bas de `video.html` (scène → début, fin).

## Reel « 100 m »

`reel-100m/` — un autre film, court celui-là : dix secondes, une prise, une
coupe. Le dossier ne contient pas la vidéo — elle se capture dans le jeu —
mais de quoi la tourner et l'habiller : plan de tournage seconde par seconde,
cartons et leurs timecodes, sous-titres SRT, et la couverture avec sa source.

## Storyboard

`storyboard/` contient les 17 planches (`.dc.html`) et leur disposition
(`canvas.json`), régénérables par `python3 storyboard/gen.py`.
