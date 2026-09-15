# Riposte Danube — les légendes, prêtes à copier

Comptes : Instagram **@SPRINTERGAME** · X **@SprinterGameFR** · TikTok **@sprinter_game**
Lien : **sprinter-game.com**

Diffusion France : **chaîne L'Équipe, en clair**, samedi et dimanche dès 18h.

Hashtags : `#UltimateChampionship #Budapest26 #athletisme #sprint #SprinterGame`
Ajoute `@lachainelequipe` quand tu postes pendant la diffusion.
(Je n'ai pas trouvé de source confirmant le hashtag officiel de l'épreuve —
`#UltimateChampionship` est l'usage évident, vérifie sur le compte World
Athletics avant de poster si tu veux en être sûr.)

---

## 0 · LE VRAI LEVIER — la chaîne L'Équipe

La compétition passe **en clair sur la chaîne L'Équipe**, samedi et dimanche
dès 18h, commentée par François-Xavier de Châteaufort et Maryse Éwanjé-Épée.
Ça change la tactique : le public francophone est devant, en direct, le
téléphone à la main. C'est du second écran, et c'est là qu'on se place.

**Poster sur son propre compte ne suffit pas** quand le compte est petit. Le
geste qui rapporte, c'est de **répondre au post de la chaîne** dans la minute
qui suit la course :

- X : **@lachainelequipe** (le compte de la chaîne) · **@lequipe** (le journal)
- Ils postent le clip de l'arrivée dans les minutes qui suivent la finale.
- Les premières réponses sous ce clip sont vues par des dizaines de milliers de
  personnes qui, elles, viennent de regarder la course.

**Le geste, à 19h50 :**
1. tu génères la carte (`tools/carte-riposte.mjs`, voir §3) ;
2. tu ouvres le post de @lachainelequipe sur le 100 m ;
3. tu réponds avec la carte + deux lignes, pas plus ;
4. **ensuite seulement** tu postes sur ton propre compte.

Réponse type sous leur clip :
> Le record du monde tient depuis 2009.
> Dans notre jeu il est à 8,246 s — et il a deux semaines.
> sprinter-game.com

Ne fais ça qu'une fois par soirée et sur la course la plus regardée. Répondre
sous chaque post de la chaîne, c'est du spam, et ça se voit.

**Le profil est prêt** : handle `@SprinterGameFR`, nom affiché « Sprinter
Game », avatar `assets-stores/icone-1024.png`, bannière
`profil-x/banniere-1500x500.png`, lien sprinter-game.com. C'est ce qui te fait
lire comme un vrai compte dans une réponse sous un gros post.

---

## 1 · MAINTENANT — avant la session de 18h

**Visuel** : `cartes/8-24-contre-9-58-feed.png` (Instagram) ·
`cartes/8-24-contre-9-58-story.png` (story, TikTok photo) ·
`stade/x-1600x900-ligne.png` (X, si tu préfères une image de jeu)

### X
> Vendredi à Budapest : 10 000 000 $ sur la table, les meilleurs de la planète, 0 record du monde.
> Duplantis a tenté 6,32 m. Barre tombée.
>
> Record du 100 m dans Sprinter Game : 8,246 s.
> Bolt : 9,58 s.
>
> Chez nous, on court plus vite que la réalité.
> sprinter-game.com

### Instagram (carte feed)
> **On court plus vite.**
>
> Trois soirées à Budapest, 10 millions de dollars de dotation, les champions olympiques et les champions du monde réunis. Vendredi soir : pas un seul record du monde.
>
> Le record du 100 m tient depuis 2009. Dix-sept ans.
> Celui de Sprinter Game est à 8,246 s, et il a deux semaines.
>
> Deux mondes, deux chronos. Lien en bio.
>
> #UltimateChampionship #Budapest26 #athletisme #sprint #SprinterGame

---

## 2 · 19h38 — finale du 100 m FEMMES

**À faire dans les 3 minutes.** Jefferson-Wooden / Alfred / Richardson.

    node tools/carte-riposte.mjs --epreuve 100 --femmes --vainqueur "NOM" --temps 10.XX

**Visuel** : `cartes/budapest-100m-f-story.png` (story) · `-feed.png` (post)

### X
> [NOM] — [TEMPS].
> Record du monde : 10.49. Debout depuis 1988. Trente-huit ans.
>
> Record Sprinter Game : 8.246 s. Deux semaines.
>
> sprinter-game.com

---

## 3 · 19h49 — finale du 100 m HOMMES · **le moment du week-end**

Seville / Ajayi / Eseme. C'est là que le hashtag tourne le plus vite.

    node tools/carte-riposte.mjs --epreuve 100 --vainqueur "NOM" --temps 9.XX

**Visuel** : `cartes/budapest-100m-h-story.png` puis `-feed.png`

### X — à poster en premier, c'est la plateforme du direct
> [NOM] — [TEMPS].
> Record du monde : 9.58. Debout depuis 2009. Dix-sept ans.
>
> Record Sprinter Game : 8.246 s.
> Il a deux semaines, et il tombera avant Noël.
>
> Viens le prendre 👉 sprinter-game.com

### Instagram (story d'abord, post ensuite)
> [NOM] vient de gagner le 100 m à Budapest en [TEMPS].
>
> Le record du monde n'a pas bougé. Il n'a pas bougé depuis 2009 — dix-sept ans que personne n'y touche, et ce soir il y avait 150 000 $ pour celui qui le ferait tomber.
>
> Dans Sprinter Game, le 100 m est à 8,246 s. Il a deux semaines. Le suivant tombera plus vite que ça.
>
> Tu veux ton nom dessus ? Lien en bio.
>
> #UltimateChampionship #Budapest26 #100m #athletisme #SprinterGame

### TikTok
**Visuel** : la séquence `video-1080x1920/` (18 i/s) montée avec, en plein écran :

- 0–3 s : *« Ils ont mis 10 millions de dollars pour battre un record. »*
- 3–5 s : *« Personne n'y est arrivé. »*
- 5–8 s : le gameplay + le chrono `8.246`
- 8–10 s : **9,58 s — le monde réel / 8,246 s — Sprinter Game**

> Budapest, ce soir. [TEMPS] pour [NOM]. Le record du monde tient depuis 2009.
> Le nôtre a deux semaines. 🏃‍♂️ #UltimateChampionship #sprint #jeuxmobile

---

## 4 · LE DÉFI — à lancer en même temps que le post 1

C'est le seul des quatre qui convertit. Les autres font de l'audience,
celui-là fait des joueurs.

**Visuel** : `cartes/100m-cinq-centiemes-feed.png` (le top 3 tient en cinq
centièmes — c'est ce qui donne envie de s'y mettre)

### Instagram / X
> 🔴 **DÉFI BUDAPEST — jusqu'à dimanche 21h**
>
> Eux ils ont trois soirées et 10 millions de dollars.
> Toi tu as trois disciplines et ton pouce.
>
> 100 m — 8.246 — Timooo & Nathan
> 200 m — 16.629 — 971'gee
> 400 m — 34.888 — Timooo & Nathan
>
> Bats-en un avant dimanche soir.
> 👉 sprinter-game.com

---

## 5 · DIMANCHE SOIR — le bilan

À écrire une fois la dernière soirée finie. Deux versions selon ce qui se passe :

**Si aucun record du monde des trois jours**
> Trois soirées. 10 millions de dollars. 28 finales. Les meilleurs de la planète.
> Zéro record du monde.
>
> Dans Sprinter Game ce week-end : [N] records battus.
> (Relever le vrai chiffre avant de poster — voir plus bas.)

**Si un record est tombé**
> Enfin un. Il aura fallu [X] ans et 10 millions de dollars.
> Chez nous, [N] records sont tombés pendant ces trois soirées. Gratuitement.

**Le chiffre [N] se relève, il ne s'invente pas :**

    node tools/records-weekend.mjs

Relevé dimanche soir, il donne le décompte exact des records personnels battus
depuis vendredi, épreuve par épreuve.

**Attention** : au samedi 18h, ce chiffre est à **9**. C'est petit, et tel quel
il déçoit. Si dimanche soir il n'a pas beaucoup bougé, ne le poste pas — dis-le
autrement. « Le top 3 du 100 m tient en cinq centièmes » est vrai, ne dépend
d'aucun volume, et donne plus envie de jouer qu'un décompte maigre.

---

## Ce qu'il ne faut PAS écrire

- **Le nombre de joueurs** (134 au total sur les trois épreuves). Tout le reste
  des chiffres joue pour toi, celui-là joue contre.
- **« Un record toutes les X heures »** tant que ce n'est pas vrai ce jour-là.
  Le classement dort parfois vingt-quatre heures d'affilée ; quelqu'un vérifie,
  et le post se retourne.
- **Se moquer des athlètes.** Duplantis qui rate 6,32 m est un fait, pas une
  vanne. La communauté athlé te descend si tu franchis la ligne, et c'est elle
  que tu cherches à atteindre.
