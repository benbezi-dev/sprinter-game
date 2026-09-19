# Reel « Le temps de lire cette phrase, la course est déjà finie »

> 1080 × 1920 · un seul plan, jamais coupé · durée visée 18–25 s
> Dossier préparé le **19 septembre 2026**.

---

## Ce que ce dossier contient, et ce qu'il ne contient pas

**Il n'y a pas de `video.mp4` ici, et c'est la seule réponse honnête.**

Ce reel est une démonstration filmée : un écran de téléphone vu de haut, une
main qui tape `sprinter-game.com` dans la barre d'adresse, la page qui s'ouvre,
JOUER, la course, la ligne. Le conducteur le dit en toutes lettres — *ce reel se
tourne, et il ne se monte pas*. Cette prise demande une caméra, un téléphone et
une main, et elle n'existe nulle part : le dépôt ne contient aucune image
d'appareil filmé de l'extérieur, et rien dans la machine de montage ne peut en
fabriquer une. Une prise reconstituée à partir d'une capture d'écran du jeu
serait pire qu'une coupe : la coupe abîme la preuve, la reconstitution la
supprime.

Tout le reste est fait, et vérifié :

| Fichier | Ce que c'est |
|---|---|
| `monteur-barre-adresse.html` | **la page de montage**, prête. Charge la prise, relève les deux repères image par image, incruste le chronomètre, pose les deux cartons, garde le son, enregistre, et écrit la vidéo, la couverture, le SRT et la légende |
| `verifier-monteur.mjs` | le pilote qui prouve la chaîne sans prise : `node verifier-monteur.mjs` |
| `banc-essai.mjs` | la mire de substitution et les relevés, appelée par le pilote |
| `legende-modele.txt` | la légende, ses deux trous et les mots bannis |
| `sous-titres-modele.srt` | la structure du SRT — le monteur écrit le vrai |

Le jour où la prise existe, une seule passe dans la page produit `video.mp4`,
`couverture.png`, `sous-titres.srt` et `legende.txt`, et il ne reste qu'à les
déposer ici.

## Où ce dossier devrait vivre

Le conducteur demande `suivi/publications/2026-09-14-reel-barre-adresse/`.
**`suivi/` est dans `.gitignore`** — le dépôt est public, et le suivi interne
n'a pas à l'être. Rien d'écrit là ne peut être poussé, et la machine de cette
session est éphémère : le travail aurait disparu avec elle.

Il est donc posé dans `content/instagram/`, qui est versionné et qui héberge
déjà les reels, les vignettes et les légendes. Les noms de fichiers sont ceux
du conducteur : un `cp -r` vers `suivi/publications/2026-09-14-reel-barre-adresse/`
remet tout à sa place sur la machine de montage.

---

## Le tournage

### Le chemin, à répéter trois fois avant de filmer

1. barre d'adresse vide, on tape `sprinter-game.com` **en entier** ;
2. la page s'ouvre — logo, puis écran titre
   (`01-ouverture-02-ecran-titre.png`) ;
3. l'accueil (`-03-accueil.png`) ;
4. JOUER, puis la première course (`-04-premiere-course.png`) ;
5. À VOS MARQUES, le coup de pistolet, les deux touches, la ligne.

### Laquelle des deux ouvertures on montre

Au premier lancement, le jeu ouvre une visite guidée ; sur un navigateur déjà
venu, non. **On tourne sur un navigateur déjà venu, sans visite guidée.** Deux
raisons : le chemin de référence ci-dessus est celui-là, et la visite coûte des
secondes à une démonstration dont le sujet est le temps.

Conséquence à tenir : un navigateur déjà venu **complète l'adresse** au bout de
deux caractères. On tape quand même les dix-sept caractères sans toucher la
suggestion. Le chronomètre part au premier caractère : accepter la complétion
ferait gagner deux secondes et perdre la démonstration.

### Le cadre

Téléphone posé, à plat, immobile. Caméra au-dessus, à la verticale, lumière
égale. La main entre par le côté et ressort — **jamais au-dessus de l'écran au
moment du départ**, un doigt qui masque la ligne de départ fait refaire la
prise. Le cadre ne bouge pas : pas de zoom, pas de poussée, aucun recadrage.
Un mouvement d'appareil suggère un montage, et c'est exactement ce que ce reel
ne doit pas suggérer.

### Le son

**Le son de la prise est gardé.** Une respiration suffit à dire que c'est vrai.
La page branche la piste audio du fichier dans le flux enregistré ; c'est le
seul reel du lot qui ne soit pas muet.

### Si le total dépasse 25 s

On refait la prise sur une connexion normale. **On ne coupe pas.** La page
affiche un avertissement rouge dès que l'écart entre les deux repères passe
25 s.

---

## Le repérage : deux images, et tout en dépend

Le chronomètre incrusté n'est pas un effet : il mesure ce que la vidéo montre.
Il lui faut deux images relevées dans le rush, et elles se relèvent dans la page
de montage, à la touche, une image à la fois :

| Repère | Ce que c'est | Relevé |
|---|---|---|
| **A** | l'image où le **premier caractère** apparaît dans la barre d'adresse | `__,___ s` |
| **B** | l'image où le coureur **franchit la ligne** | `__,___ s` |

Le total affiché est `B − A`, et c'est le chiffre de la légende et de la
couverture. S'il affiche 19 s, la légende dit 19 s.

À noter aussi, sans l'incruster : **le chrono de la course**, lu à l'écran du
jeu à l'arrivée. Il est déjà à l'image ; le redoubler serait une faute. Il va
dans la légende.

---

## La ligne de temps

| De | À | Ce qui est à l'image |
|---|---|---|
| 0,0 s | fin | **la prise, entière** — un plan, cadre fixe, aucune coupe |
| 0,2 s | 2,5 s | carton « LE TEMPS DE LIRE CETTE PHRASE », Outfit 800, or, sous le chronomètre |
| A | B | le chronomètre court |
| B | B + 2 s | carton « … LA COURSE EST DÉJÀ FINIE. », même place |
| B | fin | le chronomètre est figé sur le total |

Rien d'autre. Le chronomètre parle tout seul pendant tout le reste.

### Les places tenues dans le cadre

| Élément | Position |
|---|---|
| chronomètre | milieu des chiffres à **480 px** du haut, Space Mono 700, `#F8CD4A`, 156 px |
| cartons | bloc à partir de **660 px**, Outfit 800, capitales, deux lignes au plus |
| signature | `@sprintergame`, blanc 30 %, filet 1 px au-dessus, à **1640 px** |
| zone sûre | tout tient entre **250 et 1670 px** |

### Où poser les stickers Instagram

Ils se posent **dans Instagram, pas dans l'image**. La bande **1670 → 1920 px**
est laissée entièrement libre pour eux : c'est là que va le sticker (une
question — « tu fais mieux ? » — marche bien avec ce reel). La bande **0 →
250 px** reste vide aussi, mais elle appartient à la barre de progression et à
l'avatar : rien n'y va.

---

## La coupe est interdite, et la page ne sait pas couper

Le montage tient en un plan qui part à zéro et va jusqu'au bout du fichier.
`verifierCoupe()` refuse d'enregistrer si le montage porte plus d'un plan, si le
plan ne part pas à zéro, ou s'il ne va pas jusqu'à la fin. Ce n'est pas une
convention à respecter à la main : c'est un refus.

---

## Ce qui a été vérifié, et avec quels chiffres

`node content/instagram/2026-09-14-reel-barre-adresse/verifier-monteur.mjs`
fabrique une mire de 22 s, la passe dans la chaîne entière et relève. Passe de
référence du **19 septembre 2026**, Chromium 1194 sans tête :

| Relevé | Valeur |
|---|---|
| polices | **Outfit + Space Mono**, les vraies — pas de repli |
| prise chargée | 21,484 s |
| repli à 16× (visé 5 s) | écart **0,007 s** |
| chronomètre final affiché | **18,48 s** — exactement `B − A` |
| écart de calage max. au démarrage | **0,000 s** |
| format d'encodage retenu | `video/mp4` |
| poids du fichier | 1,58 Mo |
| durée réelle du fichier, relue après coup | 9,035 s |
| écart entre le temps au mur et le fichier | 0,536 s |
| couverture | 1080 × 1920, 259 Ko |

Sept verdicts sur sept. Les images `banc-essai/apercu-plan.png` et
`banc-essai/apercu-carton.png` montrent la composition réelle : le chronomètre à
sa hauteur, le carton sous lui, la signature dans la zone sûre.

### Trois choses que le banc a apprises, et qui sont maintenant dans la page

1. **Le repli à 16× dépassait de 274 ms.** À seize fois la vitesse, une image de
   retard à la décision vaut plus d'une demi-seconde, et un dépassement ne se
   rattrape pas sur un fichier qui refuse de reculer. La lecture ralentit
   maintenant par paliers — 16×, puis 4×, puis 1× — et tombe à **7 ms**.
2. **`requestVideoFrameCallback` ne bat que si des images sont présentées à un
   écran.** Sans tête, aucune ne l'est : l'attente y restait suspendue pour
   toujours. La page s'en tient à `requestAnimationFrame`, avec un filet qui
   relâche l'attente si la vidéo se termine ou cale.
3. **Le montage se déroule en temps réel, et la page le vérifie maintenant.**
   Elle mesure la cadence entre ce que la prise a défilé et ce que la pendule a
   compté, et refuse de se taire si l'écart dépasse 3 %.

### Ce que ce conteneur ne peut pas prouver

Cette machine **n'a pas de sortie audio**. La lecture ne s'y clocke donc sur
rien qui freine, et la prise défile 2,2 × trop vite. La cadence mesurée le dit
(`2,245 × le temps réel`) et l'avertissement se déclenche — c'est le garde-fou
qui fonctionne, pas la chaîne qui échoue. Conséquence : **la durée et le poids
relevés ci-dessus ne valent pas pour un vrai montage.** Ce qui est prouvé, c'est
que le fichier écrit suit la pendule (0,536 s d'écart), que le chronomètre suit
la prise, et que la dérive est détectée. Le montage se fait sur une machine qui
a une carte son.

Deux autres limites du même ordre :

- `video/mp4;codecs=avc1` n'est pas disponible dans le Chromium de test, qui se
  rabat sur `video/mp4`. Sur la machine de montage, la page essaie `avc1`
  d'abord — le seul qu'un appareil Apple relit une fois téléchargé — et **écrit
  le format retenu dans son journal**. C'est cette ligne-là qu'il faut lire le
  jour du montage, pas celle-ci.
- Le `ffmpeg` livré avec le navigateur de test est compilé `--disable-everything`
  et ne démuxe que du matroska : il ne peut pas relire un MP4. Son silence ne dit
  rien du fichier. La relecture est faite par le navigateur, après coup.

---

## Ce qui reste à relire le jour du dépôt

### Le classement — non lu ici, et il doit l'être

La règle est de relire les chiffres le jour du montage, et de coller les
réponses JSON brutes ici avec l'heure de la requête. **Ça n'a pas pu être fait :
le proxy de cette session refuse le domaine.**

```
$ curl "https://sprinter-leaderboard.benbezi-sprinter.workers.dev/leaderboard?race=100"
curl: (56) CONNECT tunnel failed, response 403     # 2026-09-19T16:53:46Z
```

`sprinter-game.com` est refusé de la même façon. À relancer depuis la machine de
montage, et à coller ici :

```bash
curl -s "https://sprinter-leaderboard.benbezi-sprinter.workers.dev/leaderboard?race=100"
```

Pour **ce** reel, aucun des deux chiffres n'en vient — le conducteur l'interdit,
et il a raison : la vidéo est la preuve, elle ne peut pas s'appuyer sur un
chiffre venu d'ailleurs. Le total se mesure sur le rush, le chrono de la course
se lit à l'écran du jeu. Le classement sert seulement à savoir si la course
jouée dans le plan vaut quelque chose au TOP 500, et à ne pas écrire une bêtise
à côté.

Attention au piège de cette route : **`best_split_ms` est le chrono de
l'épreuve** — 8246 s'écrit « 8,25 s ». `time_ms` est le cumul de carrière et
vaut plusieurs dizaines de secondes. Les confondre donne un record de 51
secondes sur 100 mètres.

### Le reste

- [ ] la prise tournée, entre 18 et 25 s, sans coupe
- [ ] A et B relevés image par image, notés dans ce fichier
- [ ] le journal de la page relu : format retenu, cadence, calage
- [ ] le chrono de la course reporté dans la légende
- [ ] aucun pseudonyme lisible à l'image — sur cette prise il ne devrait y en
      avoir aucun, mais l'écran d'arrivée en affiche parfois : à vérifier, et à
      masquer en `M•••••` à défaut d'accord écrit
- [ ] aucun bandeau `VERSION DE TEST · CAPTURES2` dans le cadre — on tourne sur
      le site en production, donc il ne devrait pas y en avoir

---

## Les deux écarts assumés par rapport à la charte

1. **La signature n'est pas à 8,8 % du bas.** 8,8 % de 1920 tombe à 1751 px,
   hors du rectangle central 1080 × 1420 — c'est la bande que le sticker et le
   pouce recouvrent, et un texte posé là fait refuser le montage. Elle est
   remontée à 1640 px, au bas de la zone sûre. Tout le reste est intact : le nom
   du compte et non l'adresse, le blanc à 30 %, le filet de 1 px au-dessus.
2. **La couverture ne porte pas de carton.** La charte y demande un chiffre qui
   soit le plus gros élément de l'image ; il l'est d'autant mieux qu'il est
   seul. La phrase est dans le film et dans la légende.

Un troisième point, qui n'est pas un écart mais un ajout : un **voile sombre**
est posé entre 240 et 900 px, sous le chronomètre et le carton. Sans lui, de
l'or sur le blanc d'une barre d'adresse disparaît — et le chronomètre est le
sujet.

---

## Les sources

| Quoi | Où |
|---|---|
| le langage visuel, `s2`, `morceauxChrono`, `poserMorceaux` | `src/game/trace-affiche.js` |
| la recherche du binaire de Chrome | `tools/chrome.mjs` |
| le chemin d'ouverture, écran par écran | captures `01-ouverture-02…-04` (dossier `suivi/`, hors dépôt) |

Rien de ce qui se dessine ne vient d'ailleurs que de `trace-affiche.js` : la
composition est locale — les internes de la charte ne sont pas exportés — mais
les trois primitives qui écrivent un chrono en viennent, et elles seules.
