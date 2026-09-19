# Quiz des épreuves — fond de story 1080 × 1920

La story qui demande au compte quelle épreuve passe en vedette en semaine 3.
L'image porte les quatre noms ; le vote se pose dans Instagram, par-dessus.

| Fichier | Quoi |
|---|---|
| `atelier-story-quiz-epreuves.html` | l'atelier — dessine dans un `<canvas>` 1080 × 1920 et sort le PNG |
| `story-quiz-epreuves-1080x1920.png` | l'image, telle que l'atelier la produit |

## Ouvrir l'atelier

Les modules ES ne se chargent pas depuis `file://`, et la page importe le fond
de la charte depuis `src/game/trace-affiche.js`. Il faut donc un serveur :

```
npx vite
http://localhost:5173/communication/quiz-epreuves/atelier-story-quiz-epreuves.html
```

Un bouton sort le PNG. Une case affiche les repères — zones réservées, place du
sticker — qui restent hors du PNG : ils vivent sur un second canvas superposé.

La page retrouve `trace-affiche.js` depuis ce dossier comme depuis `suivi/` :
elle essaie les deux chemins. Si elle ne le trouve pas, elle le dit et ne
dessine rien, plutôt que de sortir une image avec une copie périmée de l'or.

## Où poser le sticker

Un sticker quiz à quatre réponses, centré dans la moitié basse du rectangle
utile. Le cadre en pointillé de l'aperçu est sa place exacte.

| | |
|---|---|
| Cadre | 902 × 470 px |
| Coin haut gauche | x 89 · y 960 |
| Coin bas droit | x 991 · y 1430 |
| Centre | x 540 · y 1195 |
| En proportion | de 50,0 % à 74,5 % de la hauteur |

Le bas du cadre s'arrête 32 px au-dessus du filet du pied : un sticker posé sur
`@sprintergame` couvre la seule ligne de l'image qui dise où retrouver le jeu.

À l'échelle par défaut d'Instagram, un sticker à quatre réponses est un peu plus
haut que 470 px. Pince-le légèrement, ou laisse-le monter : au-dessus, la
composition s'arrête à 960 et rien ne vient avant.

### Le texte

> On met quelle épreuve en avant ?

Les quatre réponses, dans l'ordre des bandes :

1. `100 m`
2. `200 m`
3. `400 m`
4. `Relais 4×100`

Deux choses à savoir avant de poser le sticker :

- **Le sticker quiz désigne une bonne réponse.** Il compte bien les quatre
  choix, mais il en marque un comme juste et affiche une croix aux autres. Pour
  un vote, le sticker **sondage** prend aussi quatre options et rend des
  pourcentages, sans bonne réponse. La place réservée vaut pour les deux : même
  largeur, même hauteur.
- **La lumière descendante incline le vote.** La première bande se lit à pleine
  lumière, la dernière presque éteinte — c'est ce qui fait descendre l'œil, et
  c'est aussi ce qui avantage le 100 m. Pour un vote que la mise en page
  n'incline pas, les quatre valeurs `lumiere` et `encre` sont en clair en haut
  du script de l'atelier : les mettre toutes à 1 aplatit la hiérarchie.

## Ce que l'image respecte

Fond, lueur dorée et traits de piste viennent de `poserFond`, dans
`src/game/trace-affiche.js` — importés, jamais recopiés.

| | |
|---|---|
| Format | 1080 × 1920 |
| Rectangle utile | 1080 × 1420, de 250 à 1670 |
| Bandes | 4 × 176 px, de 250 à 960 |
| Filets entre bandes | 2 px, or à 20 %, fondus aux extrémités |
| Noms | Outfit 800 capitales, une seule taille pour les quatre |
| Lumière des bandes | 1,00 · 0,50 · 0,22 · 0,08 |
| Filet du pied | 1 px, blanc à 10 %, y 1462 |
| Signature | `@sprintergame`, blanc à 30 %, y 1501 |

Deux points où l'image s'écarte de la lettre de la charte, et pourquoi :

- **La signature se mesure depuis le bas de la zone sûre, pas du cadre.** À
  8,8 % de 1920 elle tomberait à 1751, sous le pouce et sous le sticker.
  Mesurée depuis 1670 elle tombe à 1501 — à trois pixels de ce que donne déjà
  la story du jeu, qui translate son pied de la même façon.
- **Le lavis des bandes est faible : 0,085 pour la plus claire.** La lueur de la
  charte descend déjà toute seule — relevée sur le fond nu, au centre des
  quatre bandes, elle donne (44,40,27) · (35,32,25) · (26,25,23) · (16,17,21).
  Un lavis à 0,14 empilait son or sur celui de la lueur et virait la moitié
  haute à l'olive : l'or cessait d'être la couleur du sujet pour devenir celle
  du fond, l'inverse de la story du jeu où le chrono est seul à être doré.

Pas de coureur dessiné, pas de chrono. Les chiffres de l'image sont les
distances, et ce sont les plus gros éléments : 109 px contre 28 px pour la
signature.
