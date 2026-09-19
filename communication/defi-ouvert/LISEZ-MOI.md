# Le défi ouvert — un code, posté en public

Un défi normal s'adresse à quelqu'un : on vise une ligne du TOP 500, le jeu
sonne chez cette personne, elle répond. **Le défi ouvert ne vise personne.** On
court, on récupère le code, et on l'affiche. Qui veut le prend.

C'est le seul format qui marche sur Instagram, X et TikTok en même temps, et
c'est le seul qui touche l'ego du passant : il ne lui demande pas d'installer
un jeu, il lui demande **s'il tient le chrono**.

---

## 1 · Le geste, en quatre minutes

1. **Tu cours.** Une course, sur la distance que tu veux. Pas la peine de
   sortir ton record : un chrono moyen se fait battre, et un défi battu est un
   défi qui circule.
2. **Tu lances le défi** à la fin de la course. Le jeu te donne un code de six
   caractères — `ZEZE42`, `K7PQMR`. L'alphabet exclut le 0, le O, le 1, le I et
   le L : **il se dicte à voix haute sans ambiguïté**, ce qui compte quand on
   le met dans une vidéo.
3. **Tu fabriques la carte** :

   ```bash
   node tools/carte-defi-ouvert.mjs --code ZEZE42
   ```

   Trois images sortent dans `cartes/` : `-feed` (Instagram), `-story` (story,
   Reels, TikTok), `-x` (X). Le chrono, le nom et le **compteur de tentatives**
   sont relus sur le serveur au moment du rendu — rien n'est recopié à la main,
   donc rien ne peut être périmé.

   **Le style est celui du jeu, et c'est le défaut.** Fond `#060913`, lueur
   dorée, Outfit 900, chrono en Space Mono : exactement ce que le jeu dessine
   déjà quand un joueur partage sa course. Les proportions sont recopiées de
   `src/game/trace-affiche.js`, pas approchées à l'œil. Un joueur qui voit le
   post puis l'écran de fin doit reconnaître la même main.

   **Le bleu nuit et l'orange ne servent qu'aux jours de compétition** —
   `--style carte`, la maquette de `carte-defi.mjs` et `carte-riposte.mjs`.
   Ces jours-là le compte parle d'autre chose que de lui : un record du monde,
   une finale, un chrono d'ailleurs. Deux voix, deux occasions, et pas les deux
   dans la même semaine. Les fichiers portent le style dans leur nom
   (`zeze42-affiche-feed.png`), donc rien ne se recouvre.
4. **Tu postes**, en prenant la légende dans `legendes.md`.

Relance la commande deux jours plus tard : la carte dit alors « 14 ont essayé,
2 ont fait mieux ». C'est la même carte, et ce n'est plus le même post.

---

## 2 · Trois faits qui décident de la forme du post

**Le lien ne sert que sur X.** Instagram et TikTok ne rendent pas les liens
cliquables, ni en légende ni en commentaire. Sur ces deux-là, **le code EST le
lien** : il doit être lisible sur l'image, écrit en toutes lettres dans la
légende, et prononcé dans la vidéo. Le lien, lui, vit dans la bio.

**Le lien ouvre le défi, pas l'accueil.** `sprinter-game.com/?defi=ZEZE42`
ouvre le jeu avec le panneau DÉFI déjà déplié et le code déjà rempli : il reste
un bouton à toucher. Sur iPhone, si le jeu est installé, le lien s'ouvre dans
Safari — le jeu propose alors le code à copier, pour qu'on n'ait pas à revenir
le chercher.

**Chaque personne qui relève ton code te crée un vrai duel.** Pas une
simulation : une rencontre, comptée dans le classement des duels, avec des
points de ligue à la clé. Le même joueur ne peut pas la rejouer — son premier
résultat est définitif — mais **cent personnes font cent duels**. Poster un
code en public, c'est donc mettre son classement en jeu devant tout le monde.
C'est exactement ce qui rend le post intéressant, et c'est aussi ce qu'il faut
savoir avant de poster le chrono d'une soirée de chance : ce qui se perd là se
perd pour de bon.

---

## 3 · Ce sur quoi on appuie (et pourquoi ça marche)

| Le levier | Ce que le jeu fait vraiment |
|---|---|
| **Le fantôme** | On ne court pas contre un nombre : la course de l'autre rejoue dans le couloir d'à côté, et l'écart se voit mètre par mètre. |
| **Le compteur** | « 23 ont essayé, 3 ont fait mieux » — un chiffre public qui grandit tout seul et qui dit *ce n'est pas si facile*. |
| **Le classement des duels** | Départemental, régional, national, élite, légende. Chaque défi relevé déplace quelque chose. |
| **Le TOP 500** | Le nom reste affiché au classement mondial, par distance. |
| **La pique** | Quand on perd, le jeu met une phrase dans la bouche du vainqueur. Seize versions, jamais la même deux fois. |
| **La revanche** | On ne peut relancer quelqu'un **qu'après avoir battu son chrono**. Le serveur le vérifie. Ça se raconte très bien en légende. |

---

## 4 · Ce qu'on ne fait pas

- **Pas de chiffre inventé.** Ni « des milliers de joueurs », ni un taux de
  réussite qu'on n'a pas mesuré. Le compteur de la carte est lu sur le serveur ;
  tout le reste se vérifie dans le classement, que n'importe qui peut ouvrir.
- **Pas de code recyclé.** Un code posté deux semaines de suite, c'est un post
  qui se répète. Une course, un code, un post.
- **Pas de défi adressé en public.** Si tu vises quelqu'un depuis le TOP 500,
  son jeu sonne : c'est une affaire entre vous deux, pas un contenu.

---

## 5 · Les fichiers

| Fichier | À quoi il sert |
|---|---|
| `legendes.md` | Les légendes prêtes à coller, par réseau, et les accroches à faire tourner. |
| `cartes/` | Ce que produit l'outil. Un jeu de trois images par code. |
| `../../tools/carte-defi-ouvert.mjs` | L'outil. Lit le défi sur l'API, rend les trois formats, dans l'un des deux styles. |
| `../../tools/chrome.mjs` | La capture et les polices de la charte. Sans réseau, pose les woff2 dans un dossier et donne-le par `SPRINTER_POLICES`. |
| `../../tools/carte-og.mjs` | L'aperçu permanent du lien (`public/og-1200x630.png`). |
| `../riposte-danube/` | L'autre campagne : l'actualité de l'athlétisme, pas le défi. Le style des cartes vient de là. |
