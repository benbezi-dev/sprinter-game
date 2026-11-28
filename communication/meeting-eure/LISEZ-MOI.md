# Meeting de l'Eure — le kit Sprinter

> Samedi **30 janvier 2027**, 18 h, salle Jesse Owens, Val-de-Reuil.
> Le meeting a publié son affiche le 28/11/2026 avec la question « tu en
> penses quoi ? ». Ce dossier sert à y répondre : un commentaire public, un
> message privé avec la proposition, un Reel et des cartes.

Tout est capturé **dans le jeu tel qu'il est en ligne** : la salle Jesse Owens
en 3D (ouverte depuis le 31/10/2026), le 60 m en salle, le vrai moteur de
course. Rien n'est maquetté.

## ⚠️ Avant de publier

- **Aucun logo ni nom du Meeting ou de ses partenaires** (Crédit Mutuel,
  Département, FFA…) dans ce qui se publie. Les cartes publiques parlent de
  la salle et de la date, pas de l'événement. Le nom et les logos attendent
  l'accord écrit des organisateurs, comme le demande déjà
  `communication/offre-panneaux.md`.
- La carte **`proposition`** nomme le meeting : elle se joint au **message
  privé**, elle ne se publie pas.
- Le **« Défi du Meeting »** (la semaine de 60 m avec classement) est une
  **proposition** : il n'existe pas encore dans le jeu. On le construit
  seulement si le meeting dit oui.
- Remplacer `[lien App Store]` et `[lien Play Store]` par les vrais liens.

---

## 1 · Le commentaire, sous l'affiche

Un commentaire Instagram n'accepte ni lien cliquable, ni image, ni vidéo :
tout le reste passe par le message privé. Depuis le compte @sprintergame, ne
pas se mentionner soi-même.

> Très belle affiche 🔥
> Et si cette année, le public ne venait pas seulement voir les sprinteurs courir… mais pouvait lui aussi prendre le départ dans la salle Jesse Owens ? 👀🏟️
> On a une idée, on vous écrit en DM 😉

(Depuis un compte personnel : remplacer la dernière ligne par « On a une idée avec @sprintergame. »)

## 2 · Le message privé à @meetingdeleure

À joindre : `video/sprinter-salle-jesse-owens-vertical.mp4`,
`cartes/proposition-feed.png` et une ou deux cartes publiques (`teaser`, `depart`).

> Bonjour l'équipe du Meeting de l'Eure 👋
>
> Je viens de voir votre affiche pour le 30 janvier : elle est superbe. Elle m'a donné envie de vous proposer une idée pour faire vivre le meeting autrement au public.
>
> Je suis le créateur de **Sprinter**, un jeu de sprint gratuit (iOS, Android, navigateur) : on réagit au coup de pistolet, on court et on se défie pour le meilleur chrono. Et surtout : **la salle Jesse Owens est déjà reconstruite en 3D dans le jeu**, avec le 60 m sur la ligne droite et l'anneau relevé.
>
> J'imagine un défi autour du Meeting de l'Eure, pour que les spectateurs courent dans la salle avant ou pendant l'événement et se mesurent les uns aux autres :
>
> 🏟️ Un défi sur la piste du meeting
> ⏱️ Un classement des meilleurs chronos
> ⚔️ Des duels entre spectateurs
> 🤝 Vos logos et ceux de vos partenaires sur les panneaux de la piste virtuelle, avec un bilan chiffré à la fin
> 📱 Une animation à partager sur les réseaux pour faire monter l'attente avant le jour J
>
> L'idée : rendre le public acteur du meeting et prolonger son expérience autour des courses.
>
> Je vous joins une vidéo et quelques images du jeu dans la salle. Si l'idée vous parle, je peux vous la présenter en 10 minutes par téléphone, quand ça vous arrange !
>
> 🌐 sprinter-game.com · 📱 @sprintergame

## 3 · Le Reel, sur le compte Sprinter

Vidéo : `video/sprinter-salle-jesse-owens-vertical.mp4` (muette : choisir un
son tendance dans Instagram). Couverture : `cartes/teaser-story.png`.
Localisation **Val-de-Reuil**, identifier @meetingdeleure **uniquement après
leur réponse** (sinon, juste le lieu et le hashtag).

> Cette année, le public prend le départ 🏃‍♂️💨
> La salle Jesse Owens reconstruite en 3D : 60 m sur la ligne droite, 200 et 400 sur l'anneau relevé. Rendez-vous le 30 janvier… 👀
> Gratuit, lien en bio.
>
> 📍 Val-de-Reuil #Athlétisme #ValDeReuil #Sprint #Sprinter

Une fois l'accord obtenu : proposer une **collaboration Instagram** (post
co-signé, visible sur les deux comptes) et ajouter #MeetingdeLEure.

---

## Les fichiers

### video/
| Fichier | Format | Pour |
|---|---|---|
| `sprinter-salle-jesse-owens-vertical.mp4` | 1440 × 2560, 30 i/s, muet | Reel, TikTok, story, message privé |
| `sprinter-salle-jesse-owens-paysage.mp4` | 2560 × 1440, 30 i/s, muet | écran de la salle, YouTube, présentation |

Le montage : la salle (le panoramique d'ouverture du jeu) avec l'accroche
« Cette année, le public prend le départ »,
le décompte, le 60 m entier jusqu'à l'arrivée, puis la carte de fin.

### cartes/
Chaque carte existe en `-feed` (1440 × 1800, 4:5) et `-story` (1440 × 2560, 9:16).

| Carte | Dit | Publiable |
|---|---|---|
| `teaser` | « Cette année, le public prend le départ. » · 30.01.2027 | oui |
| `depart` | « Tu ne regardes plus. Tu cours. » | oui |
| `anneau` | « Des tribunes aux couloirs. » | oui |
| `rendez-vous` | « Le 30 janvier, et si c'était toi au départ ? » + J-x du jour | oui (à refaire le jour du post) |
| `proposition` | « Le public du Meeting prend le départ. » : défi, duels, partenaires, réseaux | **non : message privé seulement** |

### images/
Les photogrammes 2K qui servent de fond aux cartes, publiables seuls.

---

## Refaire

Le serveur du jeu doit tourner (`npx vite --port 5174 --host 127.0.0.1`).

    # 1. tourner (≈ 20 min par format sans carte graphique : horloge virtuelle)
    node tools/meeting-eure/tourner.mjs --w=480 --h=854 --dsf=3 --passer=0 --out=/tmp/rush-vertical
    node tools/meeting-eure/tourner.mjs --w=854 --h=480 --dsf=3 --passer=0 --out=/tmp/rush-paysage
    # 2. les cartes (la « rendez-vous » recalcule son J-x le jour même)
    node tools/meeting-eure/cartes.mjs
    node tools/meeting-eure/cartes.mjs rendez-vous
    # 3. monter
    node tools/meeting-eure/monter.mjs --rush=/tmp/rush-vertical --format=vertical
    node tools/meeting-eure/monter.mjs --rush=/tmp/rush-paysage --format=paysage

`tourner.mjs` pilote le jeu avec une horloge virtuelle (`horloge.js`) : sans
carte graphique, la salle se dessine à moins de dix images par seconde. Chaque
image avance donc le temps du jeu d'exactement 1/30 s avant d'être
photographiée. La course est la vraie, filmée au ralenti et rendue à vitesse
normale.
