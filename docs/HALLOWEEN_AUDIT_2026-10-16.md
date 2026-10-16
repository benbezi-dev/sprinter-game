# Audit de l'édition Halloween — « La nuit du molosse »

16 octobre 2026, J-3 avant la première nuit (lundi 19 octobre, 00 h 00 à Paris).
Branche auditée : `claude/loving-bell-bfn4s7` (e88eac3).

## État des vérifications

| contrôle | résultat |
|---|---|
| `node tools/halloween-calendrier-test.mjs` | ✓ tout passe |
| `node tools/halloween-carnet-test.mjs` | ✓ tout passe |
| `node tools/halloween-camera-test.mjs` | ✓ tout passe |
| `node tools/molosse-test.mjs` | ✓ tout passe |
| `node tools/molosse-canal-test.mjs` (fuite dans le paquet public) | ✓ tout passe |
| `npm run typecheck` | ✓ |

Les harnais passent, mais **aucun ne teste l'état « ouvert en production »**.
C'est justement là que se trouvent les bogues les plus graves ci-dessous.

---

## 1. BLOQUANTS — à corriger avant le 19 octobre

### 1.1 Ouvrir l'édition demande cinq changements, pas deux

`canal.ts` dit « `true` en dur, et rien d'autre à toucher ». C'est faux. Si on
ne passe que les deux drapeaux à `true`, voici ce qui arrive en production :

| # | fichier | état actuel | conséquence si on l'oublie |
|---|---|---|---|
| a | `src/game/canal.ts:347` `HALLOWEEN_OUVERT` | `EST_TEST` | mode absent |
| b | `src/game/canal.ts:377` `HALLOWEEN_2026_OUVERT` | `EST_TEST` | pas de calendrier : les 13 nuits s'enchaînent dès le premier jour |
| c | `src/game/edition.ts:103` `EDITION_HALLOWEEN.debut` | **24 octobre** | **aucune bannière du 19 au 23** — c'est la seule porte du mode, donc les nuits 1 à 5 sont inaccessibles pour un nouveau joueur. La décision n°7 du plan (recaler au 19) n'a jamais été appliquée. |
| d | `vite.config.ts:72-73` `HORS_PRODUCTION` | dépend du canal, **pas** de `HALLOWEEN_OUVERT` | en production, `molosse.mp3`, `molosse.glb`, `molosse-tete.webp`, `molosse-victoire.webp` et `molosse-cartes/` sont remplacés par un module vide → pas de musique, pas de bête 3D, pas de tête sur la bannière, pas de cartes illustrées. Tout se dégrade **sans erreur visible**. |
| e | `.github/workflows/deploy.yml:52` | `rm -rf dist/decors/halloween-a* …` | la ruelle (maisons, portes, poubelles, réverbères) et les blocs `materiel-a*` sont **supprimés du site** → nuits sur des pavés vides |

À prévoir en plus :
- `tools/molosse-canal-test.mjs` vérifie que la musique n'est **pas** dans le paquet public : il échouera après l'ouverture, il faut l'inverser ;
- l'application native (versionCode 12 / build 12) est compilée sans `VITE_CANAL=test`, donc **sans Halloween**. Si l'app doit l'avoir le 19, il faut soumettre un build **maintenant** (délai de revue iOS) ;
- vérifier que la route `/now` du worker est bien déployée (`worker/src/index.js:1792`).

**Recommandation :** remplacer le commentaire de `canal.ts` par une checklist,
et écrire un harnais « ouverture » qui construit la production avec les
drapeaux ouverts et vérifie la bannière le 19, la présence des assets et le
verrou de date.

### 1.2 Le bouton « NUIT SUIVANTE » contourne le calendrier

`src/components/screens/Halloween.tsx:924` → `rejouer(suivante)` → `partir(n)`
(ligne 79), qui ne consulte **aucun** verrou. Le 19 octobre, un joueur qui
gagne la nuit 1 touche « NUIT SUIVANTE » et court la nuit 2, puis la 3… Il peut
finir les treize nuits le premier soir. Tout le calendrier tombe.

**Correction :** `partir()` doit refuser une nuit non jouable
(`nuitJouable(n, tenues, maintenant(), decalage)`), et l'écran de fin doit
afficher « NUIT 2 — ouvre dans 14 h » ou « Reviens demain » au lieu du bouton.
C'est aussi un meilleur moment de rétention.

### 1.3 L'horloge du calendrier est figée, et le premier affichage ne la respecte pas

- `maintenant()` (`halloween-calendrier.ts:281`) rend `horlogeVraie.ms`, un
  instant **posé une fois** à l'ouverture du panneau et jamais avancé. Le
  rafraîchissement toutes les 30 s redessine avec la même heure : le « ouvre
  dans 14 h 20 min » ne bouge pas, et **à minuit (ou à 18 h pour la finale) la
  nuit ne s'ouvre pas** tant qu'on ne ferme pas puis ne rouvre pas le panneau.
  → Garder un décalage `serveur − Date.now()` (ou une ancre `performance.now()`)
  et calculer l'heure à chaque lecture.
- `horlogeImmediate()` est appelée dans un `useEffect` (`Halloween.tsx:539`),
  donc **après** le premier rendu, qui calcule les verrous sur `Date.now()`
  (ligne 571). Le commentaire dit l'inverse. Et `tempsDuServeur()`
  (`halloween-horloge.ts:52`) n'a **pas de délai maximal** : sur un réseau qui
  ne répond pas, le panneau reste sur l'horloge de l'appareil. Un joueur qui a
  avancé sa montre voit les 13 nuits ouvertes et peut en lancer une.
  → Poser l'horloge immédiate avant de calculer (dans l'initialiseur du
  `useState`) et ajouter un `AbortController` de ~3 s.

### 1.4 La progression des testeurs contamine celle des joueurs

`/test` et `/` sont servis par la **même origine** (`sprinter-game.com`), donc
ils partagent `localStorage`. Le jeu écrit toujours dans l'ancienne clé
`sprinter_halloween` (`halloween.ts:454`), et sur `/test` les 13 nuits sont
ouvertes sans ordre : gagner la nuit 11 fait `tenues = max(tenues, 11)`
(`halloween.ts:510`). Le 19, tous ceux qui ont testé arrivent en production
avec une édition déjà finie ou presque.

Le module qui règle exactement ce problème existe : `src/game/halloween-carnet.ts`
(schéma versionné, migration, sceau, espace testeur séparé, `tenues` qui ne
monte que d'un cran). Il est testé… et **importé par personne**. C'est du code
mort.

**Correction :** brancher `halloween-carnet.ts` dans `halloween.ts`
(`CLE_TESTEUR` quand `EST_TEST`), ou au minimum vider la progression Halloween
des comptes testeurs avant l'ouverture.

---

## 2. IMPORTANT — à traiter cette semaine

### 2.1 Tous les joueurs téléchargeront 30 Mo (voire 105 Mo) de décor Halloween

Dès que `HALLOWEEN_OUVERT` passe à `true`, `chargement.ts:99/167` ajoute les
605 images Halloween (~30 Mo) au téléchargement de fond, **pour tout le
monde**, même ceux qui n'ouvriront jamais le mode. Sur un écran dense, l'ultra
ajoute ~75 Mo. En 4G, c'est un vrai coût en données et en batterie, et ça
continuera après l'événement tant que le drapeau reste ouvert.

→ Ne télécharger que la série d'angle de la **prochaine nuit** (~2,6 Mo, ~6,6 Mo
en ultra), à l'ouverture du panneau.

### 2.2 107 Mo de décor pour quatre pièces

`public/` pèse 142 Mo, dont **107 Mo de ruelle** : maison, porte, poubelles,
réverbère × 18 rotations × **11 angles** × 2 qualités. `halloween-cameras.js`
prévoit quatre familles d'angles (6°, 11°, 14°, 20°) justement pour ne rendre
que quatre séries (« 5°, 6° et 8° donnent la même image »), mais une série a
été rendue par angle de nuit. `decors-stades.js` prend déjà la série la plus
proche : caler chaque nuit sur l'angle de sa famille et supprimer les autres
dossiers ramène l'ensemble à **~38 Mo**, sans toucher au code.
`halloween-a12` ne sert qu'à la phase 2 de la finale, qui n'est jamais appelée
(voir §5).

### 2.3 Difficulté : la majorité des joueurs risque de ne pas voir la seconde moitié

D'après le harnais, avec un automate parfaitement alterné (un vrai doigt fait
moins bien) :

| nuit | 1 | 2 | 3 | 4 | 5 | **6** | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| appuis/s | 10,5 | 9 | 11 | 11,5 | 11,5 | **13,25** (36 s) | 10,25 | 12 | 12,5 | 13 | 13 | 14,25 (36 s) | 14,5 |

- **La nuit 1 demande déjà 10,5 appuis/s parfaits.** Le commentaire de
  `halloween-loi.js` promet « tout le monde y arrive » ; à ce rythme, ce n'est
  pas sûr. Si la nuit 1 échoue, le joueur ne voit **rien** de l'édition.
- **La nuit 6 est un mur** : +1,75 appui/s d'un coup, pendant 36 secondes, puis
  retour à 10,25 sur la 7. Avec le verrou de victoire, un joueur bloqué le
  24 octobre ne voit jamais les nuits 7 à 13.

Pistes : nuit 1 vers 8,5–9/s (une vraie nuit d'apprentissage) ; échanger les
nuits 6 et 7, ou alléger la 6 ; prévoir un filet (par exemple, après N
morsures sur une nuit, la suivante s'ouvre quand même, avec une mention
« passée de justesse »).

### 2.4 Aucune mesure par nuit

Le serveur compte les courses avec le contexte `halloween`, mais ni le numéro
de la nuit, ni le verdict, ni l'écart. Impossible de voir pendant l'événement
qu'une nuit bloque 80 % des joueurs. → Un événement léger
`{ nuit, verdict, chrono, écart minimal, tentative n° }` vers `comptage.js`
permettrait de régler les impartis en cours de route (ils sont dans un fichier
de constantes, c'est un déploiement de cinq minutes).

### 2.5 Petits bogues

- **Bannière** : « NUIT n » vient de `nuitOuverte()`, c'est-à-dire de la
  victoire seule (`Halloween.tsx:328`). Elle annonce la nuit 2 alors que la
  date ne l'a pas encore ouverte.
- **Anglais** : `resteAvant()` (`Halloween.tsx:446`) écrit « 2 j 3 h » en dur ;
  le bandeau de test écrit « oct » (ligne 477).
- **Repli de l'heure** : quand `/now` échoue, le client lit l'en-tête `Date`,
  mais le worker ne l'expose pas en CORS (`Access-Control-Expose-Headers` ne
  contient que `X-D1-Bookmark`), donc le navigateur rend `null`. Le repli ne
  fonctionne pas. → Ajouter `Date` à la liste.
- **Finale** : le panneau affiche « ouvre à 18 h » mais pas de compte à rebours
  jusqu'à 18 h.

---

## 3. CE QUI POURRAIT ÊTRE AMÉLIORÉ

### 3.1 Le son : le levier de peur qui manque le plus

Pendant la poursuite, **la bête ne fait aucun bruit**. Le seul son du mode est
le grognement du départ surpris (`halloween-son.ts`). Le plan promettait « le
son qui se rapproche ». Avec `c.ecart` et `c.v`, déjà calculés à chaque image :
halètement et pattes dont le volume et le rythme suivent l'écart, grognement
sous 3 m, battement de cœur, musique qui baisse quand elle approche, et un
silence d'une seconde juste avant la morsure. C'est le meilleur rapport
effort/peur de toute la liste, et ça fonctionne même à 49 × 26 pixels.

### 3.2 Accessibilité et confort

- La secousse en course (`halloween.ts:247` et `:412`) ignore
  `prefers-reduced-motion`, alors que les cartes animées la respectent.
- Pas d'avertissement à l'entrée (flash rouge, secousse, vibration) et pas
  d'option « frayeur réduite », pourtant prévus en phase 4 du plan.

### 3.3 Narration

- Les 14 scènettes sont tirées au hasard, **sans lien avec la nuit**. Il n'y a
  pas d'arc sur 13 jours, et **pas de fin propre à la nuit 13** : on obtient
  une scène quelconque plus la ligne « Les treize nuits sont tombées ». Une
  scène d'ouverture (nuit 1) et une vraie fin (nuit 13) changeraient beaucoup.
- L'écart minimal n'est pas enregistré. « Elle était à 0,4 m de toi » est la
  phrase la plus forte que le mode puisse dire après une victoire.
  (`halloween-carnet.ts` avait prévu le champ `ecarts`.)

### 3.4 Cohérence du thème

Le stade s'appelle « Cimetière municipal », les nuits s'appellent *Les cyprès*,
*Le caveau*, *Le glas*, *La terre remuée*, les scènettes peignent des tombes,
la musique est un orgue d'église… mais le décor unique des 13 nuits est une
**ruelle pavée** (les cyprès ont été retirés le 09/10). Il faut choisir :
renommer les nuits pour la ruelle, ou réintroduire le cimetière sur une partie
des nuits (le thème existait).

### 3.5 Le Calendrier

C'est une liste de 13 lignes, pas la grille de 13 cartes avec un sceau qui se
brise prévue au plan. Les textes `hw_scelle`, `hw_cal_sous`, `hw_ouvre_le`,
`hw_aujourdhui`, `hw_reste` et `hw_suite` ne sont jamais affichés. Une
« carte du jour » mise en avant en haut du panneau (avec le compte à rebours
de la suivante) suffirait.

---

## 4. CE QUI POURRAIT ÊTRE AJOUTÉ

Par ordre d'impact sur un événement d'une nuit par jour :

1. **Notification push quotidienne** « La nuit 4 est ouverte » (l'infrastructure
   existe : `worker/src/push.js`, Firebase). C'est le mécanisme de retour
   naturel d'un calendrier, et il n'est pas branché.
2. **Partager son résultat** : une carte image « J'ai tenu la nuit 7 — 0,3 m
   d'avance » avec la tête du molosse. `@capacitor/share` est déjà installé,
   et le partage du one-shot a été retiré de l'écran de fin de nuit.
3. **Une preuve sociale** : « 38 % des joueurs ont tenu la nuit 6 » (dès que
   la mesure du §2.4 existe).
4. **Une récompense qui reste** : un maillot ou un skin « molosse » dans le
   vestiaire pour 13/13. Une raison de finir, et une trace après l'événement.
5. **La quatorzième nuit** : `hw_toutes_sous` promet « La quatorzième n'est
   pas sur le calendrier. Elle viendra quand même. » Soit on la fait (une nuit
   secrète le 1er novembre, ou une survie sans fin), soit on retire la phrase.

---

## 5. CE QUI DEVRAIT ÊTRE RETIRÉ OU NETTOYÉ

- **`halloween-carnet.ts`** : à brancher (recommandé, voir §1.4), sinon à
  supprimer.
- **`poserLaPhase()`** et les `phases` de la nuit 13 (`halloween.ts:319`,
  `halloween-cameras.js`) : jamais appelés. La finale en trois phases n'existe
  pas. On la fait ou on la retire, ainsi que `halloween-a12`.
- **Les champs `lieu` des 13 caméras** (Palais des glaces, Morgue, Toits,
  Champ de crash…) : ces lieux n'existent pas. Le harnais les affiche comme
  s'ils étaient là, ce qui est trompeur.
- **Le reste du plan qui ne sortira pas en 2026** : 13 décors, zombies et
  martiens, modificateurs (brouillard, stroboscope, torche, double fantôme),
  cinématique d'ouverture en 3 temps, magasin d'assets séparé. Le dire dans
  `docs/HALLOWEEN_PLAN.md` pour que le plan reflète ce qui est livré.
- **Les commentaires faux** : « `true` en dur, et rien d'autre à toucher »
  (`canal.ts`), « fermé au public jusqu'au 24 octobre » (`vite.config.ts:34`),
  « elles restent servies par le site : rien à déplacer le jour de
  l'ouverture » (`chargement.ts`, contredit par `deploy.yml`).

---

## 6. CE QUI EST BIEN, ET À GARDER

- La règle unique « le chrono et la bête disent la même chose », démontrée
  au millimètre par le harnais sur les 13 nuits.
- Le calendrier : fuseaux, changement d'heure du 25 octobre, cliquet
  anti-recul, finale à 18 h locale avec un décalage borné. Tout est testé.
- Les replis partout : bête 3D → tracé, musique absente → musique ordinaire,
  image absente → les yeux seuls.
- Les trois départs (blocs, surpris, élan), le HUD sobre (jauge, voile et
  secousse qui démarrent ensemble à 12 m), les cartes animées qui respectent
  `prefers-reduced-motion`.
- La vérification de fuite dans le paquet public, par deux vrais builds.

---

## Ordre d'action proposé

| quand | quoi |
|---|---|
| **avant le 19** | §1.1 (les cinq changements + test inversé + build natif si voulu) · §1.2 · §1.3 · §1.4 · un harnais « ouverture » |
| **avant le 19 si possible** | §2.1 (téléchargement à la demande) · §2.3 (nuit 1 et nuit 6) · §2.4 (mesure par nuit) · bannière et anglais (§2.5) |
| **semaine 1** | push quotidien · partage · son de proximité · réduction des décors (§2.2) |
| **semaine 2** | scène de fin de la nuit 13 · récompense 13/13 · décision sur la 14e nuit |
| **après** | nettoyage §5 et mise à jour du plan |
