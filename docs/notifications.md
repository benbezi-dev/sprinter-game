# Les notifications sur le telephone

Un defi lance, une invitation a courir en direct, un relais qui se forme : ces
trois nouvelles ne valent que si elles arrivent tout de suite. Tant qu'elles
n'existaient que dans la boite WebSocket, elles n'arrivaient qu'aux joueurs qui
avaient deja le jeu ouvert — c'est-a-dire aux gens qu'on n'avait pas besoin de
prevenir.

## Deux transports, et pourquoi

| La ou le jeu tourne | Transport | Ce qu'il faut |
|---|---|---|
| Navigateur, ou jeu ajoute a l'ecran d'accueil | Web Push (VAPID) | `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` — **deja en place** |
| Application App Store / Play Store | Firebase Cloud Messaging | `FCM_COMPTE_SERVICE` |

Le second n'est pas un doublon du premier. **Une WebView n'a pas d'API Push** :
`PushManager` est absent de WKWebView comme de la WebView d'Android. Le code
Web Push sortait donc immediatement dans l'application des magasins, sans
erreur et sans rien faire — tous ceux qui avaient installe Sprinter depuis un
magasin etaient injoignables, et rien dans les journaux ne le disait.

Le jeu choisit son transport une fois, au premier appel, sur `EST_NATIF`
(`src/game/canal.ts`). Les deux ne se croisent jamais. Un joueur qui a le site
ET l'application recoit par les deux : on ignore lequel il a en main.

## Ce que porte une notification

Le genre de la nouvelle, et rien de plus. Pas de nom d'adversaire, pas de
chrono, pas de code de salle. Le texte affiche est generique — « Un defi pour
toi », « On te veut dans une equipe » — et c'est l'ouverture du jeu qui charge
le reel par les routes ordinaires.

Deux raisons, et la seconde compte autant que la premiere :

- **un seul endroit dit ce qui s'est passe**, et c'est le serveur qu'on
  interroge apres. Une notification qui porterait le detail serait une seconde
  verite a reconcilier le jour ou elle diverge ;
- **une notification s'affiche sur un ecran verrouille**, que n'importe qui
  peut lire par-dessus l'epaule.

Les textes vivent tous dans `MESSAGES`, en tete de `worker/src/push.js`, dans
les deux langues. La langue retenue est celle que le joueur avait au moment de
son abonnement : elle est rangee a cote du jeton, on ne la devine pas a
l'envoi.

## Mettre en place Firebase

**Rien de ce qui suit n'est necessaire pour que le web fonctionne.** Les cles
VAPID sont deja posees, et le serveur saute simplement le transport natif tant
que `FCM_COMPTE_SERVICE` n'existe pas. Cette section ne concerne que le jour ou
l'on veut joindre aussi ceux qui ont installe le jeu depuis un magasin.

Rien de tout cela n'est dans le depot : ce sont des cles, et le depot est
public.

### 1. Le projet Firebase

1. Creer un projet sur [console.firebase.google.com](https://console.firebase.google.com).
2. Y ajouter **une application Android** avec le nom de paquet
   `dev.benbezi.sprinter`, telecharger `google-services.json`, le poser dans
   `android/app/`.
   Le greffon Gradle est deja branche : `android/app/build.gradle` applique
   `com.google.gms.google-services` **si le fichier existe**, et se tait
   sinon. Rien a modifier.
3. Y ajouter **une application iOS** avec le meme identifiant
   `dev.benbezi.sprinter`, telecharger `GoogleService-Info.plist`, et
   l'ajouter au projet Xcode (glisser dans le dossier `App`, cocher « Copy
   items if needed » et la cible `App`). Le poser dans le dossier sans le
   declarer dans Xcode ne suffit pas : il ne serait pas embarque, et
   `FirebaseApp.configure()` echouerait au lancement.

### 2. La cle APNs, pour iOS

Firebase ne parle pas aux iPhone tout seul : il passe par APNs, et il lui faut
pour cela une cle d'Apple.

1. Sur [developer.apple.com](https://developer.apple.com/account/resources/authkeys/list),
   creer une **cle d'authentification APNs** (`.p8`). Elle ne se telecharge
   qu'une fois.
2. Dans Firebase : *Parametres du projet → Cloud Messaging → Configuration de
   l'application Apple → Cle d'authentification APNs*, deposer le `.p8` avec
   son *Key ID* et le *Team ID*.
3. Dans Xcode, sur la cible `App` : *Signing & Capabilities → + Capability →
   **Push Notifications***. C'est ce clic qui cree le fichier
   `App.entitlements` et active la fonction sur l'App ID. Le faire a la main
   dans le `.pbxproj` marche aussi, mais l'App ID reste sans la capacite et la
   signature echoue au moment ou l'on ne s'y attend plus.

`AppDelegate.swift` porte deja les trois methodes qui font passer le jeton
d'APNs a Firebase. Sans elles, `getToken()` attend pour toujours — sans
erreur, sans message, sans rien.

### 3. Le compte de service, pour le serveur

Le Worker doit prouver a Google qu'il a le droit d'envoyer.

1. Firebase : *Parametres du projet → Comptes de service → Generer une nouvelle
   cle privee*. Un fichier JSON est telecharge.
2. Le donner au Worker, en une fois :

```bash
npx wrangler secret put FCM_COMPTE_SERVICE < ~/Downloads/le-fichier.json
```

Le secret contient le JSON entier. Le Worker en lit `client_email`,
`private_key` et `project_id`, signe un JWT RS256, l'echange contre un jeton
d'acces d'une heure et le garde en memoire tant qu'il vaut.

**Ce fichier ne rentre jamais dans le depot.** Il autorise a notifier
n'importe quel telephone du parc, et une cle publiee ne se retire pas : elle se
revoque, et il faut la remplacer partout. `.gitignore` ecarte les deux noms
sous lesquels Google le livre.

### 4. Verifier

Sans `FCM_COMPTE_SERVICE`, le serveur saute simplement le transport natif :
tout le reste continue de marcher, et c'est voulu — on peut deployer avant
d'avoir les cles.

```bash
npx wrangler tail
```

Puis, depuis un telephone ou le jeu est installe : finir une course (c'est ce
qui declenche la demande de permission), accepter, et se faire defier depuis un
autre appareil. La ligne `/push/natif/abonner` doit passer, puis l'envoi.

## Les routes

| Methode | Chemin | Role |
|---|---|---|
| POST | `/push/subscribe` | Enregistre un abonnement Web Push |
| POST | `/push/unsubscribe` | Oublie les abonnements web d'un appareil |
| POST | `/push/natif/abonner` | Enregistre un jeton Firebase |
| POST | `/push/natif/desabonner` | Oublie les jetons d'un appareil |

Deux tables, et pas une seule a deux colonnes : un abonnement web est un objet
qu'on rejoue tel quel, un jeton FCM est une chaine opaque, et un meme appareil
peut porter les deux. Les jetons morts — application desinstallee, donnees
effacees — sont ramasses a l'envoi, quand Google repond qu'il ne les connait
plus.

## Ce qui sonne, et ou

| Genre | Quand | Ou c'est declenche |
|---|---|---|
| `defi` | Quelqu'un est vise par un defi differe | `POST /challenge` |
| `direct` | Quelqu'un est invite a courir maintenant | `POST /direct/inviter` |
| `relais` | Une equipe se forme et attend une reponse | `POST /relay/team` |
| `duel` | Un defi lance vient d'etre releve | `POST /challenge/attempt` |

`mot` — le mot laisse par le vainqueur — passe encore par la seule boite
WebSocket. Son texte existe deja dans `MESSAGES` : le jour ou on veut qu'il
sonne aussi, il suffit de remplacer `sonner` par `sonnerEtPush` a ses deux
points d'appel.

## Ce que la politique de confidentialite doit dire

`public/confidentialite.html` promettait qu'aucune donnee ne part chez un tiers
au-dela de Cloudflare et de Google Fonts. Ce n'est plus exact des que
l'application native notifie : Firebase recoit un identifiant technique propre
a l'installation, et le texte affiche. Les deux versions de la page — francaise
et anglaise — le disent maintenant, dans « Prestataires techniques ».

Trois choses que ce texte affirme, et qu'il faut donc continuer de tenir :

- **le texte affiche ne nomme personne** et ne dit rien de la partie. C'est ce
  que garantit `MESSAGES` dans `worker/src/push.js` — y glisser un nom
  d'adversaire rendrait la page fausse ;
- **Firebase n'est sollicite qu'apres acceptation.** Cela ne va pas de soi : le
  SDK depose sinon un jeton d'inscription chez Google des le premier lancement,
  avant toute question et meme si le joueur refuse ensuite. L'initialisation
  automatique est donc coupee des deux cotes —
  `firebase_messaging_auto_init_enabled` dans le manifeste Android,
  `FirebaseMessagingAutoInitEnabled` dans `Info.plist` — et le greffon la
  rallume lui-meme au premier `getToken()`, qui n'arrive qu'une fois la
  permission accordee ;
- **le refus n'enleve rien au jeu.** La boite WebSocket et le sondage restent
  derriere, exactement comme avant.

## Ce qui reste, cote web

Le contenu est chiffre de bout en bout (RFC 8291, encodage `aes128gcm` de la
RFC 8188) : il transite par le service de push du navigateur — Google, Mozilla,
Apple — qui n'a aucune raison de pouvoir le lire. La cle se derive d'un echange
Diffie-Hellman entre une paire ephemere et la cle publique donnee par le
navigateur avec son abonnement.

Un point est fragile, et une seule ligne le dit : **l'ordre des octets dans les
« info » de derivation**. `WebPush: info`, puis la cle du navigateur, puis la
notre. L'inverser ne fait rien planter — le service de push accepte le message,
et le navigateur echoue silencieusement a le dechiffrer. Aucune erreur nulle
part, aucune notification jamais.

Deux limites subsistent :

- **le repli muet reste, pour un abonnement sans cles.** Les abonnements deja
  enregistres en ont : `PushSubscription.toJSON()` a toujours porte `p256dh` et
  `auth`, et ils recoivent donc le texte des le deploiement. Le repli couvre
  l'abonnement malforme ou tronque — le service worker affiche alors
  « Sprinter — Il y a du nouveau. » plutot que rien ;
- **sur iPhone, le Web Push exige que le jeu soit ajoute a l'ecran d'accueil**
  depuis Safari (iOS 16.4 et plus). Dans un onglet Safari ordinaire,
  `PushManager` n'existe pas et le jeu ne demande donc rien. C'est une regle
  d'Apple, pas un manque du jeu — et c'est la raison d'etre du chemin natif.
