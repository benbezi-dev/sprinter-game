# iOS — ce que le portage a demandé

Le jeu tourne dans une `WKWebView` embarquée par Capacitor, comme sur Android.
Mais une `WKWebView` n'est pas une `WebView` Android, et l'essentiel du travail
tient dans quatre écarts qui ne se devinent pas : on ne les découvre qu'en
mesurant sur un appareil, parce qu'aucun d'eux ne lève d'erreur.

Chaque écart est documenté ici avec ce qui a été observé, pas ce qui était
supposé.

---

## 1. Le micro — une clé d'Info.plist qui décide qu'une API existe

**Mesuré, avant :** `navigator.mediaDevices.getUserMedia` — `false`.
**Mesuré, après :** `true`, permission accordée, piste audio obtenue.

Ce n'est pas une permission refusée. C'est l'API elle-même qui n'existe pas.
WebKit n'expose la capture média dans une `WKWebView` que si l'application
déclare `NSMicrophoneUsageDescription` dans son `Info.plist`. Sans cette clé, il
n'y a rien à refuser : `navigator.mediaDevices` est absent, et tout code qui
teste sa présence avant d'agir — c'est le cas de `voix.ts` — conclut poliment
que l'appareil ne sait pas faire.

Autrement dit, **toute la moitié « voix » du jeu était invisible sous iOS** :
la liaison audio en direct pendant un duel, et le mot de six secondes du
vainqueur. Pas cassée — absente, et silencieusement.

Le texte de la demande est localisé : anglais dans `Info.plist` et
`en.lproj/InfoPlist.strings`, français dans `fr.lproj/InfoPlist.strings`.
`CFBundleDevelopmentRegion` reste `en` volontairement — c'est le repli pour un
joueur qui n'est ni francophone ni anglophone, et l'anglais y sert mieux.

Aucune clé caméra n'a été ajoutée : le jeu filme son propre canvas
(`captureStream`), jamais l'objectif. Demander un accès inutilisé se paie à
l'examen d'Apple.

## 2. Le son — l'interrupteur de silence

`SessionAudio.swift`, posé au lancement depuis `AppDelegate`.

Sans catégorie déclarée, une application hérite de `soloAmbient`, qui se tait
dès que l'interrupteur sur la tranche du téléphone est poussé. Beaucoup de gens
vivent avec cet interrupteur sur silence en permanence : pour eux, Sprinter
aurait été un jeu muet — et personne ne conclut « mon téléphone est en
silencieux », on conclut « ce jeu n'a pas de son ».

Or le départ se joue au coup de pistolet. C'est un signal de chronométrie, au
même titre que la secousse du vibreur dont `engine.ts` explique qu'elle est une
boucle de retour et pas un ornement.

Deux décisions, séparables, expliquées en tête de `SessionAudio.swift` :

- `playback` — le jeu passe outre l'interrupteur de silence, comme un lecteur
  de musique. Le contre-pouvoir est à portée de pouce : le jeu a son propre
  bouton de son, et les touches de volume répondent.
- `mixWithOthers` — ouvrir Sprinter n'arrête pas la musique du joueur.

Pour revenir au comportement d'origine, remplacer `.playback` par `.ambient` :
rien d'autre ne change.

Le fichier gère aussi la fin d'interruption (appel, alarme, Siri). Le système
ne rend pas la session tout seul ; sans ce réveil, le jeu reste muet jusqu'au
prochain lancement — un scénario qu'on ne reproduit jamais en développement,
parce qu'on ne s'appelle pas soi-même.

**À vérifier sur appareil réel :** le simulateur n'a pas d'interrupteur de
silence. Et pendant la voix en direct, WebKit bascule la session en
`playAndRecord`, ce qui peut router le son vers l'écouteur plutôt que le
haut-parleur. Se coder à l'avance contre WebKit ferait plus de mal que de bien ;
c'est un test, pas un correctif à écrire d'avance.

## 3. La vidéo de la course — il n'y a pas de téléchargement dans une WKWebView

**Mesuré :** un `<a download>` cliqué ne produit rien. Pas d'erreur, pas de
feuille, pas de fichier.

C'était la pire des issues : le bouton s'allumait, le compte à rebours de dix
minutes s'écoulait, et il ne se passait rien. Indiscernable d'un jeu cassé.

`review.ts` passe désormais par la feuille de partage quand elle existe —
`navigator.share({ files })` fonctionne dans une `WKWebView`, vérifié, et
propose « Enregistrer dans Fichiers ». Le téléchargement reste le bon chemin là
où la feuille n'existe pas : l'ordinateur. C'est exactement la construction que
`affiche.ts` utilisait déjà pour l'image de fin de course.

La méthode s'appelait `telecharger()` ; elle s'appelle `partager()` et rend ce
qui s'est réellement produit, parce que « enregistré » et « envoyé » ne se
disent pas au même moment.

**Le piège gardé par le test.** `morceaux` est vidé dès la fin de
l'enregistrement : les données ne vivent plus qu'à travers l'URL d'objet. Un
partage qui rebâtirait le fichier depuis `morceaux` enverrait **zéro octet**,
sans lever la moindre erreur — la feuille s'ouvrirait, le joueur choisirait
« Enregistrer », et il rangerait un fichier vide. D'où le blob nommé
(`donnees`) et le test qui compte les octets :

    node tools/review-partage-test.mjs

## 4. Le clavier — il se pose par-dessus, il ne pousse rien

**Mesuré, avant :** clavier logiciel ouvert sur la fenêtre de bienvenue,
« CONTINUER » recouvert par la barre du clavier et « PLUS TARD » entièrement
caché dessous.
**Mesuré, après :** le panneau remonte, les deux boutons sont visibles.

Sur Android, la WebView se rétrécit quand le clavier monte, et ce qui était en
bas remonte. Une `WKWebView` ne fait rien de tel : elle garde sa taille, le
clavier se pose par-dessus, et le bas de l'écran disparaît dessous. On tapait
son nom, et le bouton pour le valider n'était plus là.

Le correctif est `@capacitor/keyboard` avec `resize: 'native'`, déclaré dans
`capacitor.config.ts`. La vue se redimensionne, `window.innerHeight` diminue,
et la variable `--app-height` que pose `App.tsx` suit toute seule — sans qu'une
seule ligne de React ait à changer.

Posé à ce niveau, il vaut pour **tous** les champs du jeu : le nom, le code
d'accès du canal de test, le code d'un défi, le mot de cent quarante
caractères. Pas seulement pour l'écran où on l'a remarqué.

## 5. Ce qui n'existe pas sous iOS, et ne peut pas exister ainsi

**Mesuré :** `serviceWorker` — `false`. `Notification` — `undefined`.
`PushManager` — `undefined`.

Une `WKWebView` n'a pas de service worker. `push.ts` s'en garde déjà en tête de
fonction et ne fait rien : aucun écran mort, aucune erreur. Mais il faut le
savoir — **les notifications push ne marchent pas dans l'application iOS**, et
aucune adaptation web ne les fera marcher.

Le chemin, si on les veut un jour, est natif : `@capacitor/push-notifications`,
un certificat APNs, et un envoi APNs à côté de l'envoi Web Push existant côté
Worker. C'est une fonctionnalité à ajouter, pas un portage à finir.

---

## Ce qui marchait déjà, sans rien toucher

Le mérite en revient au code existant, pas au portage :

- **Le vibreur.** `navigator.vibrate` est `undefined` sur iOS, mais `buzz()`
  dans `engine.ts` interroge d'abord `Capacitor.Plugins.Haptics` — présent.
  `HAS_VIBRATION` vaut donc vrai, et le signal visuel de remplacement reste
  éteint, ce qui est juste.
- **Le partage de l'image de fin de course.** `affiche.ts` demandait déjà la
  feuille de partage avant de retomber sur le téléchargement.
- **La bannière « installe le jeu ».** `InstallPrompt` se tait quand
  `EST_NATIF`, ce que la règle 4.2 d'Apple exige.
- **Les liens externes** (WhatsApp, SMS, contact). Capacitor les sort de la
  WebView et les ouvre dans Safari ; l'application reste vivante derrière.
  Vérifié.
- **Les zones sûres.** `env(safe-area-inset-*)` répond correctement —
  `62px / 0 / 34px / 0` sur un iPhone 17 Pro. L'encoche et la barre d'accueil
  sont respectées.
- **La vidéo elle-même.** `MediaRecorder` et `captureStream` fonctionnent, et
  `video/mp4;codecs=avc1` est accepté — le format qu'un iPhone sait relire.

## Construire et lancer

    npm run build
    npx cap sync ios
    xcodebuild -project ios/App/App.xcodeproj -scheme App \
      -sdk iphonesimulator -configuration Debug \
      -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
      CODE_SIGNING_ALLOWED=NO build

Ou `npx cap open ios` pour passer par Xcode.

## Ce qui reste avant l'App Store

- **La signature.** Aucun `DEVELOPMENT_TEAM` n'est posé dans le projet : il
  faut un compte Apple Developer Program et l'identifiant d'équipe. Sans lui on
  ne dépasse pas le simulateur.
- **Les captures d'écran** de la fiche, aux formats demandés.
- **Les étiquettes de confidentialité** dans App Store Connect, à recopier
  depuis `PrivacyInfo.xcprivacy` — les deux doivent dire la même chose.
- **Le test sur appareil réel** : l'interrupteur de silence, le vibreur, le
  micro pendant un duel, le routage du son pendant la voix en direct.
- **L'iPad.** L'application y tourne (famille d'appareils `1,2`), mais avec une
  mise en page de téléphone centrée dans beaucoup de vide. Apple l'accepte ;
  c'est un point de qualité, pas un blocage.
