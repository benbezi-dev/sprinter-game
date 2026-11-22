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

PUBS, ACHAT ET DONNÉES
Aucune vidéo publicitaire ne se lance sans que tu la choisisses : tu peux en
regarder une pour reprendre une course ou doubler des pièces. Un achat
facultatif, « Sans pubs », donne ces récompenses sans vidéo. Les pubs passent
par Google AdMob, qui utilise des identifiants de l'appareil. Le jeu ne demande
ni ton e-mail, ni ton numéro. Ce qu'il enregistre est écrit dans sa politique
de confidentialité.

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
| Publicités | Oui : vidéos récompensées Google AdMob |
| Achats intégrés | Oui : « Sans pubs » (`sans_pubs`), achat unique |
| Identifiant publicitaire | Oui : publicité, analyse, lutte contre la fraude |

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
| Signalement dans l'app | Mot d'un duel : `LireLeMot`, `src/components/screens/MotDuel.tsx`. Tchat : toucher le nom, `TchatMarques.tsx` |
| Blocage d'un joueur | Mot d'un duel et tchat, effet immédiat. Ne masque pas les contenus publics du championnat |
| Bulles et mots de championnat | « Signaler un message » sous le tableau d'arrivée : `SignalerChampionnat.tsx`. Absent de l'appli jusqu'à la 1.0.18 (36) comprise : site ou e-mail. Retrait depuis la console |
| Conditions publiques | https://sprinter-game.com/conditions.html |
| Lien depuis l'app | Pied de l'écran-titre — `TitleScreen.tsx` |
| Traitement des signalements | Console de modération, `suivi/moderation.html` |
| Retrait d'un contenu / sanction | `/moderation/trancher`, `worker/src/moderation.js` |

Il y a un tchat en texte libre, à déclarer : fil commun et messages privés
entre pseudos réservés, 140 caractères, filtrés. Il y a aussi des contenus
publics au championnat : bulles, mots écrits ou vocaux du vainqueur. Le mot
d'un duel, lui, ne va qu'au perdant, qui répond par une phrase toute faite.

---

## Sécurité des données

« Partagée » s'entend au sens de Play : les prestataires qui traitent pour le
compte du jeu (Cloudflare, Firebase, Resend) n'en sont pas.

| Donnée | Collectée | Partagée | Pourquoi |
|---|---|---|---|
| Identifiants de l'appareil ou autres (identifiant du jeu, jeton de notification ; par AdMob : identifiant publicitaire, app set ID) | Oui | Oui, ceux d'AdMob | Fonctionnement, publicité, analyse, lutte contre la fraude |
| Pseudo | Oui | Non | Classement |
| Position approximative (pays ; adresse IP lue par AdMob) | Oui | Oui, par AdMob | Drapeau, publicité, analyse, lutte contre la fraude |
| Pseudo Instagram | Optionnel | Non | Affiché au classement, récupération du pseudo |
| Temps et tracés de course | Oui | Non | Classement, fantômes |
| Progression sauvegardée, solde de pièces | Oui | Non | Retrouver sa partie |
| Messages entre joueurs | Oui | Non | Mot du vainqueur, tchat commun et privé |
| Enregistrements vocaux | Oui | Non | Mots du vainqueur, duel et championnat |
| Autre contenu des utilisateurs (bulles, texte de récupération) | Optionnel | Non | Championnat, assistance |
| Interactions dans l'appli (étapes, jours d'ouverture ; par AdMob : lancement, appuis, vidéos vues) | Oui | Oui, par AdMob | Analyse, publicité, lutte contre la fraude |
| Diagnostics et performances (temps de chargement ; par AdMob : blocages, énergie) | Oui | Oui, par AdMob | Analyse, publicité, lutte contre la fraude |

- Aucune donnée n'est vendue. Le SDK AdMob collecte et partage avec Google dès
  le lancement, même sans vidéo regardée :
  https://developers.google.com/admob/android/privacy/play-data-disclosure
- Le paiement passe par Google Play : le serveur du jeu ne reçoit rien de l'achat.
- Le transit est chiffré (HTTPS, WSS, WebRTC).
- Suppression sur demande à `contact@sprinter-game.com`.
- Hors AdMob, pas d'outil d'analyse tiers : le jeu mesure lui-même ses
  nouveaux joueurs.
- ⚠️ Corrigé dans ce fichier le 22 novembre 2026. La Play Console n'a pas été
  consultée : y vérifier Publicités, Identifiant publicitaire, Sécurité des
  données, la description longue et la classification du contenu
  (interactions entre utilisateurs, achats).

**Signalements.** La politique de confidentialité porte
désormais une section « Signalement et modération », en français et en
anglais, qui nomme l'exception et la borne : le contenu signalé — texte et
enregistrement — est copié dans le signalement au moment de l'envoi, lu par
le seul éditeur, et gardé après traitement jusqu'à demande de suppression.
Le blocage ne transporte aucun contenu.

---

## Accès pour le testeur Google

Le jeu s'ouvre sans compte : rien à fournir. Note à joindre :

```
Aucun identifiant n'est nécessaire : le jeu se lance et se joue directement.
Cette application contient le jeu entier : le duel, la course en direct et le
mot du vainqueur y sont ouverts, ainsi qu'un tchat pour les pseudos réservés :
y toucher un nom permet de signaler ou bloquer. Pour un mot de duel, les deux
boutons sont dans la fenêtre de lecture — pour y arriver : accueil ▸
DÉFIER, lancer un défi, et ouvrir le message annoncé au retour. Deux appareils
sont nécessaires pour recevoir un mot, l'expéditeur et le destinataire étant
forcément deux joueurs distincts.
```

À ajouter à cette note au premier build qui suit la 1.0.18 (36), pas avant :

```
Au championnat, « Signaler un message » est sous le tableau d'arrivée d'une
course, dès qu'elle porte une bulle ou un mot d'un autre joueur.
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
