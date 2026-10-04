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

# Publication du fil — le lendemain, l'événement est ouvert

La même annonce en carrousel de quatre images 1080 × 1350 (4:5), à poster
dans l'ordre. Plus de « ce soir » : c'est ouvert jusqu'au samedi 10 octobre
à 21 h 30.

| Image | Ce qu'elle montre |
|---|---|
| `1-ouvert-feed.png` | La couverture : eux deux en photo (`20261003_181004`, la même que la story), « ILS ENTRENT DANS LE JEU », leurs épreuves |
| `2-meba-feed.png` | Sa fiche : 8,39 au 100 m, 17,30 au 200 m, ce qu'on gagne |
| `3-aurel-feed.png` | La sienne : 11,80 au 110 m haies, ce qu'on gagne |
| `4-sept-jours-feed.png` | « 7 JOURS », l'ouverture et la fermeture, « lien en bio » — sans photo |

    node tools/carte-defis-vedettes.mjs --fil --photo-duo 20261003_181004.jpg --cadre-duo 0.52,0.40,1120,500

**Avant de publier :**
- **Identifie-les tous les deux** sur l'image 1 (« Identifier des personnes »).
- **Invite-les en collaborateurs** (« Inviter un collaborateur ») : s'ils
  acceptent, la publication s'affiche aussi sur leurs profils, devant leurs
  abonnés.
- Le lien de la bio doit pointer sur `https://sprinter-game.com` : sur le fil,
  un lien n'est pas cliquable.

**Légende**

> Ils entrent dans le jeu. Tu as jusqu'à samedi pour les battre.
>
> 🔵 Méba-Mickaël Zézé : 100 m et 200 m, sur Sprinter
> 🟣 Aurel Manga : 110 m haies, sur Hurdlers
>
> Bats-les et leur skin est à toi, à vie. Samedi 10 octobre à 21 h 30, ils repartent.
>
> 🔗 Lien en bio · sprinter-game.com
>
> #sprint #athletisme #100m #110mhaies #SprinterGame

Aucun chrono dans la légende : les images en portent déjà trois, et un
chiffre en légende suffit (voir `../defi-ouvert/legendes.md`).

## Avec les vraies photos

Les portraits 3D du jeu sont en place sur les fiches (story et fil). Pour
mettre de vraies photos (pas besoin qu'elles soient détourées, elles sont
recadrées et fondues par le bas) :

    node tools/carte-defis-vedettes.mjs --photo-meba meba.jpg --photo-manga aurel.jpg

Les photos du Drive les montrent toujours ensemble : il faut savoir qui est
qui avant d'en recadrer une sur une fiche.

Sans accès à Google Fonts depuis Chrome : `SPRINTER_POLICES=<dossier>` (voir
`tools/chrome.mjs`).
