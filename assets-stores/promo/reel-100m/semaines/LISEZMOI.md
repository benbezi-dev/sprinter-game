# Les semaines

Un dossier par semaine ISO, `AAAA-Snn`, et dedans tout ce qu'une publication
demande : la vidéo, sa couverture, sa légende, ses sous-titres, et un
`publication.json` qui dit ce que c'est.

```
2026-S37/
  publication.json            ce que c'est, où ça va, où ça en est
  reel-100m-1080x1920.mp4     la vidéo
  couverture-1080x1920.png    la vignette au fil
  legende.txt                 la légende et ses mots-dièse
  sous-titres.srt             déjà incrustés dans la vidéo, gardés pour l'archive
```

La semaine ISO et pas le mois : la charte publie trois fois par semaine, et
c'est donc la semaine qui est l'unité de décision. `2026-S37` va du lundi
7 septembre au dimanche 13.

`etat` vaut `a_valider`, `programme` ou `publie`. Rien ne part tout seul —
c'est la troisième règle de `worker/src/reseaux.js`, et elle vaut ici aussi :
ce dossier prépare, il ne publie pas.

## Ce dossier n'est pas au dépôt

Les médias sont lourds et refabricables : `assets-stores/promo/reel-100m/`
porte la chaîne complète qui refait la vidéo à l'identique. Ce qui vit ici est
une copie de travail, à poser à côté de l'atelier — `suivi/` — qui, lui, n'est
pas suivi non plus.
