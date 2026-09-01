# La fiche Google Play — Sprinter

Tout ce qui se copie-colle dans la Play Console, plus les réponses aux
questionnaires. Les longueurs sont vérifiées par `tools/verifier-fiche.mjs`.

Identifiant de l'application : `dev.benbezi.sprinter` — **définitif**, il ne se
change plus après la première publication.

---

## Titre  · 30 caractères maximum

```
Sprinter - Jeu d'athlétisme
```

## Description courte · 80 caractères maximum

```
Six étapes, un seul chrono à battre. Cours, progresse, défie tes amis.
```

## Description longue · 4000 caractères maximum

```
Six étapes. Un seul chrono à battre. Le tien.

Sprinter est un jeu d'athlétisme qui tient dans le pouce. Tu tapes en rythme
pour lancer la foulée, tu tiens la cadence, et tu passes la ligne. C'est
simple à comprendre en une course, et long à maîtriser vraiment — parce
qu'entre un bon départ et un bon chrono, il y a tout le reste.

COURS
Le 100 m, le 200 m, le 400 m. Chaque épreuve a son rythme : le sprint pur ne
pardonne pas un départ manqué, le tour de piste ne pardonne pas de partir
trop vite. Un faux départ coûte la course, comme sur une vraie piste.

PROGRESSE
Une carrière qui monte division par division, des paliers à franchir, des
records personnels à battre. Le jeu garde tes courses : tu peux revoir ta
trajectoire, la comparer, et voir où tu as perdu les centièmes.

DÉFIE
Envoie un défi à quelqu'un. Il court exactement les mêmes épreuves, contre le
fantôme de ta course — ta vraie trajectoire, pas une moyenne. Le résultat
tombe des deux côtés, et le gagnant peut laisser un mot.

CLASSE-TOI
Un classement mondial, un drapeau à côté de ton nom, et un pseudo que tu peux
réserver pour qu'il reste le tien. Pas d'inscription, pas d'e-mail, pas de
mot de passe : tu choisis un nom et tu cours.

CE QUE LE JEU NE FAIT PAS
Pas de publicité. Aucun achat. Aucun traceur publicitaire, aucun outil
d'analyse d'audience. Le jeu ne demande ni ton e-mail, ni ton numéro, ni ton
identité. Ce qu'il enregistre est écrit noir sur blanc, et tient sur une page.

Bonne course.
```

---

## Catégorie et classement

| | |
|---|---|
| Type | Jeu |
| Catégorie | Sport |
| Tags | athlétisme, course, sprint, arcade |
| Audience cible | 13 ans et plus |
| Publicités | Non |
| Achats intégrés | Non |

**Ne pas déclarer une audience de moins de 13 ans.** Cela ferait basculer
l'application en politique Familles, où le message vocal entre joueurs devient
très difficile à faire passer.

---

## Contenu généré par les utilisateurs

À déclarer : **oui**, l'application permet aux utilisateurs de produire du
contenu vu par d'autres.

Ce qu'il faut pouvoir montrer, et qui existe :

| Exigence Play | Où |
|---|---|
| Signalement dans l'app | Fenêtre de lecture du mot — `LireLeMot`, `src/components/screens/MotDuel.tsx` |
| Blocage d'un joueur | Même endroit, effet immédiat |
| Conditions publiques | https://sprinter-game.com/conditions.html |
| Lien depuis l'app | Pied de l'écran-titre — `TitleScreen.tsx` |
| Traitement des signalements | Console de modération, `suivi/moderation.html` |
| Retrait d'un contenu / sanction | `/moderation/trancher`, `worker/src/moderation.js` |

Le cadre est étroit et c'est un argument : seul le vainqueur écrit, une seule
fois, à une seule personne, sans réponse possible. Il n'y a pas de chat libre.

---

## Sécurité des données

| Donnée | Collectée | Partagée | Pourquoi |
|---|---|---|---|
| Identifiant d'appareil | Oui | Non | Retrouver ses scores |
| Pseudo | Oui | Non | Classement |
| Pays approximatif | Oui | Non | Drapeau au classement |
| Pseudo Instagram | Optionnel | Non | Affiché au classement |
| Temps et tracés de course | Oui | Non | Classement, fantômes |
| Messages entre joueurs | Oui | Non | Le mot du vainqueur |
| Enregistrements vocaux | Oui | Non | Le mot du vainqueur |

- Aucune donnée n'est vendue ni partagée avec un tiers.
- Le transit est chiffré (HTTPS).
- Suppression sur demande à `contact@sprinter-game.com`.
- **Pas** d'identifiant publicitaire, **pas** d'analyse d'audience.

✅ **Fait le 1er septembre 2026.** La politique de confidentialité porte
désormais une section « Signalement et modération », en français et en
anglais, qui nomme l'exception et la borne : le contenu signalé — texte et
enregistrement — est copié dans le signalement au moment de l'envoi, lu par
le seul éditeur, supprimé une fois traité. Le blocage ne transporte aucun
contenu. Les deux déclarations, la page et le code, disent la même chose.

---

## Accès pour le testeur Google

Le jeu s'ouvre sans compte : rien à fournir. Note à joindre :

```
Aucun identifiant n'est nécessaire : le jeu se lance et se joue directement.
Le mode duel et le message entre joueurs ne sont ouverts qu'à un canal de
test ; ils n'apparaissent pas dans la version publique. Le signalement et le
blocage se trouvent sous chaque message reçu, dans la fenêtre de lecture.
```

---

## Visuels

| Élément | Fichier | État |
|---|---|---|
| Icône 512×512 | `assets-stores/play-icone-512.png` | prêt |
| Feature graphic 1024×500 | `assets-stores/play-feature-1024x500.png` | prêt |
| Captures téléphone | — | **à faire, 4 minimum** |
| Captures tablette 7" et 10" | — | à faire si distribution tablette |

Captures à prendre : l'écran-titre, une course en cours (HUD visible),
l'écran d'arrivée avec le chrono, le classement mondial.
