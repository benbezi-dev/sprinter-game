# Célébration vainqueur — les cartes

Fabriquées par `tools/carte-vainqueur.mjs`, au moment où la ligne est franchie.

```
node tools/carte-vainqueur.mjs --vainqueur "Pseudo" --temps 8,246 --pays FR \
     --titre "Champion de France" --evenement "Championnat de France" \
     --epreuve 100 --second 8,258 --accord
node tools/carte-vainqueur.mjs ... --voix jeu      # la voix du jeu, dans voix-du-jeu/
```

Deux formats : `-feed` (1080×1350) et `-story` (1080×1920). `--nom` change le
nom des fichiers (par défaut `carte-vainqueur`).

- **Sans `--accord`, rien ne sort.** La carte publie le pseudo en grand : on
  demande d'abord son accord au joueur (charte §5.4).
- `--second` est le chrono du deuxième. Donné, la carte dit l'écart
  (« 0,012 s d'avance. ») ; absent, elle dit « Personne n'est allé plus vite. ».
- `--pays` (code ISO à deux lettres) ajoute le drapeau.

`exemple-*` sont des aperçus avec un pseudo fictif, à ne pas publier.
