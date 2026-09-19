# Sprinter — plan de croissance organique

> Rédigé le 19 septembre 2026. Orienté growth, budget quasi nul, zéro achat média.
> Tout ce qui suit s'appuie sur ce que le jeu fait **déjà** et sur les assets
> **déjà produits** dans ce dépôt (`communication/`, `content/instagram/`,
> `tools/carte-riposte.mjs`). Rien n'y suppose une fonctionnalité qui n'existe pas,
> sauf la section 6 qui liste explicitement ce qu'il reste à coder.

---

## 0 · Le brief, rempli — et la correction stratégique

Le brief était à trous. Voici ce que le dépôt dit réellement du produit :

| | |
|---|---|
| **Nom** | Sprinter — `sprinter-game.com` |
| **Genre** | Athlétisme arcade compétitif en ligne (100 m, 200 m, 400 m, 400 m haies, relais 4 × 100) |
| **USP** | La mécanique la plus simple du jeu vidéo — **deux touches, alternées** — branchée sur une infrastructure compétitive complète : duels classés, courses en direct au même coup de pistolet, relais à quatre, 51 nationalités, championnats nationaux hebdomadaires, titres qui expirent |
| **DA** | 3D low-poly, stade de nuit, LED magenta/cyan, tartan, brume de distance, grain — couche « premium » qui s'adapte seule au framerate |
| **Cible** | 1. Gen Z mobile (TikTok, le jeu se joue à deux pouces) · 2. Nostalgiques *Track & Field / Hyper Sports* (30-45 ans, X) · 3. Communauté athlé francophone (la chaîne L'Équipe, les meetings) |
| **Plateformes** | **Navigateur** (PC + mobile, gratuit, sans compte) · **App Store / Play Store** via Capacitor (`dev.benbezi.sprinter`) · bilingue FR/EN |
| **Budget** | Proche de zéro — dev solo, guérilla |

### La correction, en deux phrases

**Le brief demande un plan « wishlists / préinscriptions ». Ce n'est pas votre jeu.**
Sprinter n'est pas un jeu Steam à réserver : il est **en ligne, gratuit, jouable en
quatre secondes depuis un lien, sans installation et sans compte**. Optimiser des
wishlists sur ce produit, c'est mettre une porte devant une porte ouverte.

La métrique de Phase 1 n'est donc pas « wishlists » mais :

> **le nombre de joueurs présents sur le classement le jour J** — parce qu'un
> nouveau qui arrive dans un jeu compétitif vide repart en huit secondes, et
> qu'un nouveau qui arrive dans un classement à 800 noms reste.

Et le **Jour J** n'est pas « la sortie du jeu » (il est sorti) mais un événement
que vous fabriquez et datez vous-même. Le meilleur candidat, parce qu'il cumule
trois nouveautés en une : **sortie App Store + Play Store le même jour que
l'ouverture de la Saison 1 et du premier week-end de championnats nationaux.**
Un seul Jour J, trois raisons d'en parler. Le reste du document tient cet ancrage.

---

## 1 · Ingénierie virale & hooks

### 1.1 — Les trois secondes qui décident

Rappel de la règle : sur TikTok, la rétention à 3 s pilote tout le reste. Un carton
noir, un logo, un « salut à tous » = vidéo morte. **Les trois angles ci-dessous
attaquent tous à l'image 1, sur du gameplay, avec un chiffre.**

#### Angle A — « Le record du monde » (le plus fort — c'est votre socle)

L'angle qui marche parce qu'il ne parle pas de votre jeu : il parle d'Usain Bolt.

| Temps | Image | Texte / son |
|---|---|---|
| 0,0 – 0,9 s | Plein cadre : le chrono du jeu, **8,246**, LED magenta derrière | « Le record du monde du 100 m tient depuis 2009. » |
| 0,9 – 1,6 s | Même plan, poussée sur le chrono | « Celui-là a treize jours. » |
| 1,6 – 4 s | Coupe sèche : la course, vue couloir, tribunes, flashs | *(son de piste, pas de musique)* |
| 4 – 9 s | Le classement des duels, la ligne qui remonte | « 9,58 s pour Bolt. 8,246 s ici. Quelqu'un ira plus vite cette nuit. » |
| 9 – 12 s | La ligne d'arrivée, plan fixe | « Il reste de la place au-dessus. » |

**Pourquoi ça marche :** les commentaires s'écrivent tout seuls (« c'est pas réaliste »,
« Bolt en vrai c'est autre chose », « 8 s c'est impossible »). Chaque objection est
un commentaire, chaque commentaire est de la portée. **Vous ne répondez jamais pour
vous défendre** : vous répondez « tu veux essayer ? » avec un code de défi.

L'asset existe déjà : `communication/riposte-danube/cartes/8-24-contre-9-58-*.png`.

#### Angle B — « Deux touches » (le hook produit)

| Temps | Image | Texte |
|---|---|---|
| 0,0 – 1,2 s | **Gros plan sur les pouces**, cadence absurde sur l'écran, filmé en vrai | « Deux touches. C'est tout le jeu. » |
| 1,2 – 2,0 s | Split : les pouces en haut, le coureur en bas | « Gauche, droite, gauche, droite. » |
| 2,0 – 3,0 s | Le chrono s'arrête sur un temps médiocre : **12,84** | « Personne n'y arrive du premier coup. » |
| 3 – 10 s | Montage de trois tentatives, chrono qui descend : 12,84 → 10,9 → 9,7 | |
| 10 – 13 s | Le classement : le joueur est **6 412e** | « Tu commences ici. » |

**Pourquoi ça marche :** c'est le format « je suis nul et ça se voit », le plus
partagé de tous. Vous montrez un échec avant de montrer une performance. Et « deux
touches » est la promesse de friction zéro : personne ne se dit « je n'ai pas le temps ».

#### Angle C — « Tu cours pour quel pays ? » (le hook communautaire)

| Temps | Image | Texte |
|---|---|---|
| 0,0 – 1,0 s | Le défilé des **51 drapeaux**, rapide | « Tu choisis ton pays une seule fois. » |
| 1,0 – 2,0 s | Le choix, la confirmation, **le cadenas qui se ferme** | « Après, c'est définitif. » |
| 2,0 – 3,5 s | Le classement des nations | « La France est 7e. » |
| 3,5 – 12 s | Le podium d'un championnat national, drapeaux | « Huit championnats s'ouvrent samedi. Le tien décide lequel tu cours. » |

**Pourquoi ça marche :** vous n'avez pas écrit la légende, vous avez ouvert une
guerre. « La France est 7e » est la phrase la plus rentable de tout le plan.
(Variante internationale : changez le pays cité selon le marché — « Italy is 7th »
sur le compte EN. Le jeu est déjà bilingue.)

### 1.2 — Les trois mécaniques virales

#### Mécanique 1 — **Le code au bout du film** (le moteur, à installer en priorité)

Le jeu sait déjà faire deux choses qui, mises bout à bout, forment une machine à
acquisition : il **exporte la vidéo de la course** (`src/game/review.ts` — MP4
encodé sur le canvas du joueur, feuille de partage native, périmé en 2 h) et il
sait créer un **défi différé par code** contre le fantôme d'une course
(`src/game/challenge.ts`).

Aujourd'hui les deux vivent séparément. **Soudez-les :**

> Chaque vidéo exportée se termine sur un carton d'une seconde :
> le code de la course (**K7M2QX**), le chrono, et `sprinter-game.com`.

Conséquence : **toute vidéo partagée par un joueur devient une publicité jouable.**
Celui qui la voit ne « découvre pas un jeu », il est **défié nommément** par
quelqu'un qu'il connaît. Le taux de clic d'un défi personnel n'a rien à voir avec
celui d'un trailer.

Hashtag de rattachement : **#SousLes9** (FR) / **#Under9** (EN) — « poste ton
100 m, mets ton code, on verra bien ».

#### Mécanique 2 — **La guerre des drapeaux**

Chaque lundi, un post unique, toujours le même format, toujours la même heure :
le **classement des nations de la semaine** (temps médian des 50 meilleurs de
chaque pays). Une carte, huit drapeaux, un titre factuel.

C'est un format de rente : il ne coûte rien à produire, il se lit en une seconde,
et il fabrique un conflit récurrent que la communauté entretient à votre place.
Les créateurs athlé s'en emparent seuls (« les Français, réveillez-vous »).

Levier : nommez chaque semaine le joueur qui a le plus fait gagner son pays. Un
nom cité publiquement, c'est un partage garanti.

#### Mécanique 3 — **La riposte** (newsjacking — votre avantage déloyal)

Vous avez déjà l'outil : `tools/carte-riposte.mjs` génère, en dix secondes après
une finale réelle, une carte qui confronte le chrono du vainqueur au record du
jeu, en lisant le classement en direct sur l'API. Aucun chiffre en dur.

Le geste, déjà documenté dans `communication/riposte-danube/legendes.md`, et qui
reste le meilleur ROI de tout ce plan :

1. Une finale d'athlétisme passe en clair (chaîne L'Équipe, Diamond League, Mondiaux).
2. Dans les **90 secondes** qui suivent l'arrivée, vous générez la carte.
3. Vous **répondez au post du diffuseur** (`@lachainelequipe`, `@lequipe`, World Athletics) — pas sur votre compte.
4. Deux lignes, la carte, le lien. Rien d'autre.
5. **Ensuite seulement** vous postez chez vous.

> Le record du monde tient depuis 2009.
> Dans notre jeu il est à 8,246 s — et il a deux semaines.
> sprinter-game.com

**Une seule riposte par soirée, sur la course la plus regardée.** Répondre sous
chaque post est du spam, ça se voit, et ça brûle le compte.

> ⚠️ Les dates exactes de la saison 2026-2027 (indoor, Diamond League, championnats)
> sont à vérifier sur le calendrier World Athletics avant de bloquer l'agenda. Ce
> document raisonne en **fenêtres**, pas en dates.

#### Bonus — le format « fail », gratuit et inépuisable

Le relais 4 × 100 élimine une équipe entière si le témoin sort de la zone. C'est
une machine à clips : **« 4 joueurs. 3 passages. 1 erreur. »** — plan fixe sur le
message d'élimination, plan sur les quatre joueurs. Compilation mensuelle.

---

## 2 · Stratégie de contenu par plateforme

### 2.1 — Le tableau de bataille

| Plateforme | Rôle dans le funnel | Formats qui marchent ici | Rythme | KPI unique |
|---|---|---|---|---|
| **TikTok** `@sprinter_game` | **Acquisition. 70 % de l'effort.** | Gameplay vertical brut avec chrono dans le cadre · duel en split · « je suis nul » · fails de relais · réponse-vidéo aux commentaires | **1 à 2 / jour, 7 j/7** | Rétention à 3 s (viser > 55 %) |
| **Instagram Reels** `@SPRINTERGAME` | Crédibilité + rétention. Le compte « vitrine » | Les 5 reels gameplay déjà produits · carrousels de cartes chiffrées · Stories avec sondage (« il ira sous 8,2 cette semaine ? ») | **1 reel / jour** + 3-5 stories | Partages en DM (le vrai signal IG) |
| **YouTube Shorts** | Longue traîne — un Short tourne encore 6 mois après | Les mêmes verticales, **titres tapés pour la recherche** : « jeu de sprint gratuit navigateur », « Track and Field 2026 » | **1 / jour** (repost) + 1 format long 60 s le dimanche (la finale du championnat) | Vues à J+30 |
| **X / Twitter** `@SprinterGameFR` | **Riposte + communauté athlé.** Le compte où vous répondez, pas où vous postez | Réponses sous les gros comptes pendant les diffusions · cartes chiffrées · journal du dev solo | 1-2 / jour hors événement · **5-8 le soir d'une finale** | Clics sur le lien |
| **Reddit** *(bonus, sous-estimé)* | Le meilleur canal pour un jeu navigateur gratuit | r/WebGames, r/incremental_games, r/trackandfield, r/playmygame, r/jeuxvideo | **1 post / semaine max, ciblé** | Trafic direct |
| **Discord** | Rétention + UGC | Salon `#chronos`, salon `#recrutement-relais` (il faut 4 joueurs — le serveur devient l'endroit où on les trouve) | Permanent | Joueurs actifs J+7 |

### 2.2 — La semaine type (à figer, ne plus réfléchir)

| Jour | TikTok | Instagram | X | YouTube |
|---|---|---|---|---|
| **Lundi** | Guerre des drapeaux (classement nations) | Carrousel du classement | Carte nations + nom du meilleur joueur FR | Repost |
| **Mardi** | Gameplay pur — un duel serré | Reel gameplay | Journal du dev (1 détail technique) | Repost |
| **Mercredi** | Format « je suis nul » / progression | Story sondage | Réponse à un gros compte athlé | Repost |
| **Jeudi** | Fail de relais | Reel relais | Chiffre du jour | Repost |
| **Vendredi** | Annonce du week-end de championnats | Story compte à rebours | Annonce + lien | Repost |
| **Samedi** | **Live du championnat** — la finale filmée | Stories en direct | Fil de résultats en direct | — |
| **Dimanche** | Le sacre : podium, drapeaux, chrono | Reel du sacre | Le champion nommé | **Format 60 s : la finale** |

### 2.3 — Les six règles de production (non négociables)

1. **Jamais de carton noir en ouverture.** Le gameplay à l'image 1.
2. **Le chrono toujours dans le cadre.** C'est lui le personnage principal.
3. **Coupes sèches, zéro fondu.** Une poussée par plan, vers le chiffre qui compte.
4. **Le reel se comprend sans le son.** (La charte le dit déjà, et les 5 reels livrés le respectent.)
5. **Jamais « abonnez-vous », « likez », « lien en bio ».** La dernière ligne **constate qu'une place est libre** : « Il reste un couloir. » « Il y a un titre à prendre. » Un CTA implicite convertit mieux et ne ressemble pas à une marque.
6. **Aucun pseudonyme réel sans accord.** Y compris dans une capture de classement (§5.4 de la charte). Sur un repost de joueur, l'accord se demande avant.

---

## 3 · Calendrier de déploiement

**Ancrage : Jour J = sortie App Store + Play Store, ouverture de la Saison 1,
premier week-end de championnats nationaux — le même jour.**

### Phase 1 — Teasing & build-up (M-3 → M-1)

**Objectif réel : remplir le classement.** Cible chiffrée : **800 joueurs classés
et 8 nations vivantes** au Jour J. Un jeu compétitif vide ne convertit pas, quel
que soit le trafic.

| Fenêtre | Action | Canal | Livrable | Comment on sait que ça marche |
|---|---|---|---|---|
| **M-3, sem. 1** | Ouverture des trois comptes avec une identité finie (avatar `assets-stores/icone-1024.png`, bannière `profil-x/banniere-1500x500.png`, lien). Un compte incomplet ne convertit pas en réponse sous un gros post. | Tous | Profils prêts | — |
| **M-3, sem. 1-2** | **Poser le socle « 8,246 contre 9,58 »** : 6 vidéos sur l'angle A, en variant l'accroche. On cherche la formulation qui retient. | TikTok | 6 vidéos | Une passe > 20 k vues → c'est votre format pilier |
| **M-3, sem. 3-4** | Publier les **5 reels gameplay déjà produits** (duels, direct, relais, nationalité, championnats) — un par semaine, le format qui a le mieux marché en premier | IG + TikTok + Shorts | `content/instagram/_pour-drive/` | Taux de partage |
| **M-2** | **Le journal du dev solo démarre.** 3 posts/semaine sur X, un détail technique par post, toujours avec une image du jeu. Exemples réels et déjà écrits : la piste dessinée aux cotes World Athletics (36,50 m de rayon, 84,39 m de ligne droite), pourquoi le relais élimine si le témoin sort de la zone, pourquoi la vidéo s'encode chez le joueur et pas sur le serveur. | X | 24 posts | Abonnés X (viser +500) |
| **M-2** | **Ouverture du Discord.** Salon `#recrutement-relais` — le relais exige 4 joueurs simultanés, ce besoin crée le serveur tout seul. | Discord | Serveur | 50 membres |
| **M-2 → M-1** | **Riposte sur chaque diffusion d'athlé en clair.** C'est la seule action qui vous met devant un public qui n'est pas le vôtre. Une par soirée, maximum. | X | 1 carte / événement | Clics vers le site |
| **M-1, sem. 1-2** | **Démarchage influenceurs, vague 1** : 40 contacts, ciblage < 5 000 viewers moyens (voir §4). Chacun reçoit **son code de défi personnel**. | DM / mail | 40 DM | 8 réponses, 3 diffusions |
| **M-1, sem. 3** | **Championnats de rodage, ouverts à tous.** On fait tourner un week-end complet avant le Jour J : séries, repêchages, demi-finales, finale. Ça remplit le classement, ça teste la charge, et ça vous donne des images de podium à réutiliser. | Tous | Un champion sacré, publiquement | 300 joueurs classés |
| **M-1, sem. 4** | **Compte à rebours 7 jours.** Un post/jour : « J-7, il reste sept couloirs. » Un couloir se ferme chaque jour. | TikTok + IG Stories | 7 visuels | Mentions « J-1 » par des tiers |

### Phase 2 — Lancement (Jour J → J+7)

**Objectif : concentrer tout le bruit sur 72 h.** Les stores classent à la vélocité :
1 000 téléchargements en deux jours pèsent infiniment plus que 3 000 en un mois.

| Quand | Action | Canal | Détail opérationnel |
|---|---|---|---|
| **J, 7 h** | Le post pivot : la vidéo d'annonce + les trois nouveautés en une phrase | Tous | « Sprinter est sur l'App Store. La Saison 1 est ouverte. Huit championnats se courent samedi. » |
| **J, 9 h** | **Les 40 influenceurs contactés en M-1 reçoivent le même message, la même heure** : « c'est aujourd'hui, ton code marche toujours » | DM | La simultanéité fabrique l'illusion d'un événement |
| **J, 12 h** | Post Reddit sur r/WebGames et r/playmygame — **titre honnête, pas de lien en premier commentaire, pas de faux « je viens de découvrir »** | Reddit | Reddit détecte le marketing en une minute |
| **J, 18 h** | Live Discord / TikTok Live : vous jouez, vous acceptez tous les défis | Live | Le dev qui perd en direct est un meilleur contenu que le dev qui gagne |
| **J+1 → J+3** | **3 vidéos/jour** — on passe en surrégime uniquement sur cette fenêtre | TikTok | 1 gameplay, 1 réaction à un commentaire, 1 chiffre du jour |
| **J+2** | **Réponse-vidéo aux commentaires.** Le commentaire le plus sceptique devient une vidéo. C'est le format le plus rentable de TikTok. | TikTok | « Il dit que 8,2 s c'est impossible. » |
| **J+4** | Première **carte « le record est tombé »** si quelqu'un a battu 8,246 s. Sinon : « le record tient depuis J+0 ». Les deux sont une histoire. | X + IG | Générée par `tools/carte-riposte.mjs` |
| **J+5** | **Le mur des moins de 9 secondes** : page publique listant tous ceux passés sous 9 s, avec carte partageable individuelle | Site + IG | Ceux qui y sont la partagent. Ceux qui n'y sont pas veulent y être. |
| **J+6 / J+7** | **Le premier week-end de championnats**, couvert comme un vrai événement : fil de résultats en direct sur X, stories IG toutes les heures, le sacre en reel le dimanche soir | Tous | Huit champions nationaux = huit histoires locales |

### Phase 3 — Post-lancement : rétention & UGC (J+15 → ∞)

**Objectif : que le contenu ne vienne plus de vous.** Un dev solo ne tient pas
2 vidéos/jour pendant six mois. Le plan n'est viable que si les joueurs prennent le relais.

| Quand | Action | Mécanisme | Pourquoi ça retient |
|---|---|---|---|
| **J+15** | **Lancement du classement des recruteurs** (voir §4.2) | Le jeu compte déjà les tentatives contre chaque défi (`challenge.attempts`) | Le partage devient une compétition notée |
| **J+15** | **Notifications push activées sur les trois nouvelles qui comptent** : un défi reçu, une invitation à courir en direct, un relais qui se forme | Déjà codé (`worker/src/push.js`, Web Push + FCM) | C'est le seul levier de retour qui ne coûte rien et ne demande aucun contenu |
| **Chaque lundi** | Guerre des drapeaux | Carte automatique | Rendez-vous hebdomadaire |
| **Chaque samedi** | Week-end de championnats | Déjà automatisé côté serveur | **Les titres expirent au bout de 3 mois** — un champion doit revenir le défendre. C'est le meilleur mécanisme de rétention du jeu, exploitez-le en communication : « Ton titre expire dans 12 jours. » |
| **Mensuel** | **L'Invitational** : les 8 meilleurs du mois + 1 créateur invité, une finale, diffusée | Course en direct existante | Fabrique des personnages. Un jeu compétitif sans figures ne tient pas. |
| **Mensuel** | Compilation de fails de relais, montée sur les clips envoyés par les joueurs | Discord `#fails` | Coût de production : zéro |
| **Continu** | **Repost systématique.** Toute vidéo de joueur est repostée, créditée, avec accord. | — | Le repost est la monnaie qui paye l'UGC |
| **J+60** | Ouverture du compte **EN** en miroir, avec l'angle C localisé par pays | Le jeu est déjà bilingue | Le marché FR plafonne vite, le marché athlé anglophone est 20× plus gros |

---

## 4 · Influence & effet levier

### 4.1 — Le démarchage

**Ciblage.** Pas les gros. Les **200 à 3 000 viewers moyens** — ils lisent leurs DM,
ils cherchent du format court, et leur communauté réagit encore. Trois viviers :

1. **Twitch FR jeux compétitifs courts** (party games, speedrun, *Fall Guys*-likes) — ils cherchent un jeu à faire jouer au chat.
2. **Créateurs athlétisme** (TikTok/IG athlé, coachs, clubs) — public déjà acquis au sujet, zéro concurrence sur ce créneau.
3. **Nostalgie rétro-arcade** (chaînes YouTube *Track & Field*, bornes d'arcade, Amiga/NES) — public 35-45 ans, très partageur.

**La règle qui change tout : on n'envoie pas un jeu, on envoie un chrono à battre.**
Un streamer reçoit vingt clés Steam par jour. Il ne reçoit jamais de défi nominatif.

#### Modèle DM (Twitch / Discord / Instagram) — 4 lignes, jamais plus

> Salut [Prénom], j'ai vu ta série de jeudi sur [titre précis — le prouver en trois mots].
>
> J'ai fait un jeu de sprint qui tourne dans le navigateur : deux touches, gratuit, rien à installer, ça démarre en quatre secondes.
>
> Je t'ai laissé un défi : code **K7M2QX** sur sprinter-game.com. Mon 100 m est à **9,12 s**. Je pense que tu me bats, mais pas du premier coup.
>
> Si c'est nul, dis-le-moi aussi — ça m'aide autant.

**Pourquoi ça passe :** aucune demande (pas de « tu peux tester ? »), une preuve
qu'on l'a regardé, un enjeu personnel, une sortie honorable. La dernière ligne
désamorce le réflexe « encore un dev qui veut de la promo gratuite ».

#### Modèle e-mail (contact pro, créateurs plus établis)

> **Objet :** un chrono à battre — 9,12 s, rien à installer
>
> Bonjour [Prénom],
>
> Sprinter est un jeu d'athlétisme qui se joue à deux touches, dans le navigateur, gratuitement. Pas de compte, pas de téléchargement : le lien s'ouvre, la course démarre.
>
> Ce n'est pas une démo. Le jeu tourne avec des duels classés, des courses en direct à huit, un relais 4 × 100 où le témoin peut tomber, 51 nationalités et des championnats nationaux chaque week-end. Le record du 100 m est à **8,246 s** et il change de main toutes les deux semaines.
>
> Je vous ai ouvert un défi : **sprinter-game.com** — code **K7M2QX**, mon temps est 9,12 s.
>
> Si le format vous intéresse, je peux ouvrir une course privée pour votre communauté (jusqu'à huit couloirs, même coup de pistolet) — dites-moi une date, je monte la salle.
>
> [Prénom], dev solo de Sprinter
> contact.pro@sprinter-game.com · sprinter-game.com

**L'offre finale est le vrai crochet** : « je monte une course privée pour ta
communauté » transforme un mail promo en proposition de contenu. Le streamer
n'essaye pas votre jeu — il l'utilise comme animation. La fonctionnalité existe
déjà (salon direct, code de couloir, huit couloirs).

**Cadence** : 40 contacts par vague, relance **une seule fois** à J+6, jamais deux.
Suivi dans un simple tableur : nom, plateforme, date, code envoyé, réponse, diffusion.

### 4.2 — L'idée UGC : **le classement des recruteurs**

Le problème universel de l'UGC : on demande aux joueurs de partager, et personne
ne partage, parce que partager ne rapporte rien **dans le jeu**.

**La solution — rendre le partage scorable, avec de la donnée que vous avez déjà.**

Le défi différé (`src/game/challenge.ts`) stocke, pour chaque code, la liste des
tentatives adverses : `attempts[]`. Donc le serveur sait déjà, pour chaque joueur,
**combien de personnes ont couru contre son fantôme.** Ce chiffre n'est affiché nulle part.

> **Affichez-le, classez-le, récompensez-le.**
>
> Un second classement, à côté du classement des chronos : **le classement des
> recruteurs** — non pas « qui court le plus vite », mais **« contre qui on court
> le plus »**.

Ce que ça produit, concrètement :

- Le joueur lent a enfin un classement où il peut gagner. **Vous venez de doubler votre population compétitive.**
- Chaque vidéo exportée porte un code (§1.2, mécanique 1) : partager n'est plus un service rendu au dev, **c'est un coup joué**.
- Récompenses **non monétaires, donc gratuites** : un insigne « Recruteur » (le système d'insignes existe — `src/components/Insignes.tsx`), et **un couloir garanti à l'Invitational mensuel**. Une place dans une finale diffusée vaut plus qu'un code promo.
- Le classement se raconte tout seul en contenu : « Cette semaine, 412 personnes ont couru contre le fantôme de KENZA. Elle est 2 300e au chrono. »

**Renfort — le mur des moins de 9 secondes.** Une page publique, une ligne par
joueur passé sous 9 s, et une carte partageable générée automatiquement à l'instant
où il passe la barre (le générateur de cartes existe : `tools/carte-riposte.mjs`).
Le seuil doit être **atteignable en une semaine de jeu, pas en un mois** : un mur
que personne n'atteint ne génère aucun partage.

---

## 5 · Le tableau de bord

Cinq chiffres, relevés chaque lundi. Pas six.

| Indicateur | Où | Cible J+30 | Ce qu'il dit |
|---|---|---|---|
| Rétention à 3 s sur TikTok | Analytics TikTok | > 55 % | Vos hooks tiennent, ou pas |
| Joueurs classés (total) | API classement | 5 000 | La seule mesure de succès réelle |
| **Retour à J+1** | Serveur | > 25 % | Si c'est bas, arrêtez le marketing et corrigez le jeu |
| Tentatives par défi partagé | `challenge.attempts` | > 3 | Le coefficient viral. **En dessous de 1, la boucle est cassée.** |
| Ripostes publiées / événements athlé | À la main | 100 % | L'action à plus fort levier du plan |

**La règle d'arbitrage :** si le retour à J+1 est sous 15 %, **tout ce plan est du
gaspillage** — vous remplissez un seau percé. Dans ce cas, on coupe la production
de contenu pendant deux semaines et on travaille la première minute de jeu.

---

## 6 · Ce qu'il faut coder pour que le plan tourne

Cinq chantiers, classés par rapport effort / impact. Rien d'autre n'est bloquant.

| # | Chantier | Où | Effort | Pourquoi c'est bloquant |
|---|---|---|---|---|
| 1 | ~~**Carton de fin sur la vidéo exportée**~~ — **fait.** Le film gagne 1,5 s : épreuve, chrono, nom, `sprinter-game.com`, et le code du défi quand il y en a un. Voir `src/game/carton-film.ts` | `review.ts`, `carton-film.ts`, `film-course.ts` | — | Sans lui, chaque partage de joueur était perdu. **Reste la moitié du levier : le code (voir 1 bis).** |
| 1 bis | ~~**Le code sur TOUS les cartons**~~ — **fait.** La caméra *ouvre* un défi à l'arrivée de chaque course filmée (`/challenge/ouvrir`), le carton lui garde sa place et l'affiche quand il arrive. Ouvrir n'est pas lancer : un défi ouvert se court mais ne vise personne, ne sonne nulle part et ne compte pas au tableau des défis lancés. Le bouton « DÉFIER UN AMI » lance celui-là — une course, un code | `defi-du-film.ts`, `carton-film.ts`, worker | — | Le levier est complet : la vidéo ne se contente plus d'inviter, elle défie |
| 2 | **Code de défi en lien cliquable** — `sprinter-game.com/d/K7M2QX` ouvre directement la course contre le fantôme | `src/game/challenge.ts` + routage `wouter` | Faible | Un code à recopier à la main perd 80 % des gens |
| 3 | **Classement des recruteurs** (nb de tentatives reçues par joueur) | `worker/src/classement.js`, `challenge.attempts` | Moyen | Le moteur d'UGC de la §4.2 |
| 4 | **Page publique du classement par nation**, partageable en image | worker + `tools/` | Moyen | Alimente la guerre des drapeaux chaque lundi, sans travail manuel |
| 5 | **Carte de partage automatique** au moment où un joueur bat son record ou passe sous 9 s | `tools/carte-riposte.mjs` (à réutiliser) | Faible | Le partage doit être proposé **à l'instant de la fierté**, pas plus tard |

---

## 7 · Les cinq erreurs qui tueraient ce plan

1. **Poster sur son propre compte pendant une finale d'athlé au lieu de répondre sous celui du diffuseur.** 300 vues contre 40 000.
2. **Attendre d'avoir un beau trailer.** Le gameplay brut avec le chrono dans le cadre surperforme un trailer monté, systématiquement, sur ces plateformes.
3. **Lancer sans classement rempli.** Un jeu compétitif vide ne convertit pas, même avec 100 000 vues. D'où les championnats de rodage en M-1.
4. **Répondre aux sceptiques pour se défendre.** « C'est pas réaliste » n'est pas une critique, c'est une invitation. On répond par un code de défi.
5. **Publier le pseudonyme d'un joueur sans son accord**, capture de classement comprise (charte §5.4). Un seul incident et la communauté se ferme.

---

## Le geste de demain matin

Les chantiers 1 et 1 bis sont faits : toute vidéo de course sortie du jeu porte son
chrono, l'adresse, et **un code de défi jouable**. La boucle de la mécanique n° 1
est fermée — partager n'est plus un service rendu au dev, c'est un coup joué.

Le suivant est **le 2** : rendre le code cliquable (`sprinter-game.com/d/K7M2QX`).
Un code à recopier à la main perd la plupart des gens sur mobile, et c'est
aujourd'hui la dernière marche entre une vidéo vue et une course courue.
