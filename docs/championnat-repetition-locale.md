# Championnat — la répétition générale en local

> Test couru le **9 septembre 2026**. Édition `69FAGXUQ` — Championnat de
> France, 100 m, weekend du samedi 5 septembre 2026 (UTC).
> Serveur : `wrangler dev --local --port 8788` (base `sprinter-leaderboard-test`).

Ce document est le mode d'emploi de ce qui vient d'être fait, écrit parce que la
moitié des gestes ne se devinent pas et que chacun d'eux, oublié, fait
ressembler la fonctionnalité à une panne.

---

## 1. Le résultat

Un weekend entier couru par le serveur : 32 partants, quatre séries, huit
repêchés au chrono, deux demi-finales, une finale, un sacre.

| | | |
|---|---|---|
| 1 | Hugo Lefèvre | **9,338 s** |
| 2 | Léo Marchand | 9,445 s |
| 3 | Adam Girard | 9,462 s |

Titre « Champion de France » porté jusqu'au **9 décembre 2026** (`TITRE_MOIS = 3`),
vérifié en base dans `champ_titres` :

```json
{"echelon":"national","zone":"FR","libelle":"Champion de France",
 "sacre_le":1788939843496,"expire_le":1796805843496}
```

Les chronos sont reproductibles : la graine du harnais est fixe (`graine = 12345`).

---

## 2. Les quatre commandes

```bash
# 1. le serveur — depuis Sprinter/worker
npx wrangler dev --local --port 8788

# 2. peupler la base de test locale : 288 joueurs, 8 pays × 36
node tools/championnat-peupler.mjs

# 3. rejouer le même weekend autant de fois qu'on veut
node tools/championnat-peupler.mjs --vider-editions

# 4. courir l'édition
node tools/championnat-france-test.mjs
```

**« edition deja ouverte » n'est pas une panne** : c'est le harnais précédent
qui a laissé la sienne. `--vider-editions` vide `champ_editions`,
`champ_resultats`, `champ_partants`, `champ_selection`, `champ_annonces`,
`champ_medailles` et `champ_titres`. Sans ce vidage, l'ouverture refuse et le
message ressemble à un refus de droits.

**« pays trop petit » non plus** : c'est une base vide. Les harnais convoquent
des joueurs déjà classés et n'en créent aucun — d'où l'étape 2. Les huit pays
(FR ES DE US CA MA CI SN, trois continents) sont le plus petit monde où le
cycle national → continental → mondial a le droit d'exister : `MIN_DOFFICE`
exige deux champions nationaux pour un continental.

---

## 3. Le voir dans le jeu, et non en console

Le serveur suffit à courir le championnat ; il ne montre aucune mise en page.
Pour ouvrir l'écran :

```bash
# le jeu, canal de test, branché sur le worker local
API_LOCALE=http://127.0.0.1:8788 vite --mode test --port 5175
```

(c'est la configuration **« Sprinter test local »** de `.claude/launch.json`.)

Puis quatre choses à poser dans le navigateur, dans cet ordre :

**a. Le code d'accès.** Le canal de test a une porte. On s'en procure un comme
n'importe quel appelant, avec la clé locale de `worker/.dev.vars` :

```bash
curl -X POST http://127.0.0.1:8788/test/admin/creer \
  -H 'Content-Type: application/json' \
  -H "X-Sprinter-Admin: <ADMIN_CLE de worker/.dev.vars>" \
  -d '{"nom":"navigateur"}'
```

**b. Le `localStorage`.** Le nom du joueur **doit être celui d'un partant** :
`ChampPanel` cherche « mon championnat » par le nom (`/champ/mien?name=…`), et
rien ne s'affiche à qui n'y court pas. C'est voulu — un championnat auquel on
n'est pas engagé n'est pas une fonctionnalité, c'est du bruit sur l'accueil.

```js
localStorage.setItem('sprinter_acces_test',   '<le code>');
localStorage.setItem('sprinter_player_name',  'Hugo Lefèvre');
// et de quoi ne pas traverser l'accueil à la main
for (const k of ['sprinter_bienvenue_vue','sprinter_tuto_vu',
                 'sprinter_tuto_oneshot_vu','sprinter_tour_vu',
                 'sprinter_install_refuse']) localStorage.setItem(k,'1');
```

**c. L'onglet DÉFI.** Le panneau du championnat vit dans `ModePanels`, à côté de
la course en direct et du relais — **pas** sur CARRIÈRE. Sur l'accueil par
défaut, il n'est pas dans le DOM et on croit à une panne.

**d. L'intro.** `G.state` reste sur `'open'` tant que la boucle
`requestAnimationFrame` ne tourne pas, et elle ne tourne pas quand le volet du
navigateur est caché. On force :

```js
SprinterApp.G.openT = 7; SprinterApp.G.state = 'title';
```

Chaque capture d'écran repompe une image : c'est ce qui débloque une séquence
figée, et c'est aussi ce qui termine les transitions CSS. **Une carte mesurée
pendant une transition gelée mentira** — la carte du championnat a été relevée
à `opacity: 0.717` avant d'être à 1, ce qui ressemblait à une transparence de
trop et n'était qu'un fondu à l'arrêt.

### Le piège qui a coûté un tour

Cliquer en aveugle les boutons sans texte d'un conteneur `fixed` pour fermer une
modale : l'un d'eux est **« quitter la version de test »**, qui efface le code
d'accès et renvoie à la porte. Fermer une modale par son drapeau de
`localStorage`, jamais par un clic deviné.

---

## 4. Ce que le test a trouvé

**L'étiquette du vainqueur chevauche le nom du champion, de 15 px.**

Relevé sur l'écran du sacre, viewport 375 × 812 :

| élément | haut | bas |
|---|---|---|
| le titre `🇫🇷 Hugo Lefèvre` (30 px) | 306 | 342 |
| l'étiquette de la marche 1 | **327** | 373 |

La médaille d'or est dessinée par-dessus le « L » de *Lefèvre*, et l'étiquette
est entièrement dans la largeur du titre (x 137→238 contre x 61→314).

Cause, à [`src/components/screens/Championnat.tsx:257`](../src/components/screens/Championnat.tsx) :
l'étiquette est en `absolute -top-11`, soit 44 px au-dessus de sa marche, et la
pile qu'elle contient (médaille + drapeau/nom + chrono) en mesure ~46. Or il n'y
a que 28 px entre le bloc du titre et la rangée des marches (`gap-5` du parent,
plus `mt-2` sur la rangée). Les marches 2 et 3 étant plus basses, seule celle du
vainqueur remonte assez haut pour toucher le titre — le défaut ne se voit donc
que sur le sacre, jamais sur les deux autres.

Le reste de l'écran est juste : les marches ne sont pas rognées (aucun
`overflow: hidden` dans la chaîne, la rangée s'arrête à 466 comme ses trois
blocs), le bord plat du bas est le sol du podium et il est voulu.

**Piste de correction** — donner à la rangée la place que ses étiquettes
prennent déjà : une marge haute d'au moins 46 px sur
`flex items-end justify-center gap-2 w-full mt-2`. Les trois étiquettes
descendent alors ensemble, sans toucher au `-top-11` qui les aligne entre elles.
