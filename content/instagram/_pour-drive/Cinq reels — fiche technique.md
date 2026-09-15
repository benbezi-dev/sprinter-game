# Gameplay Instagram — cinq fonctionnalités, cinq reels

> Capturé et monté le **6 septembre 2026**.
> Format livré : **MP4 H.264, 1080 × 1920, 30 i/s, muet** — JPEG 1080 × 1920
> pour les photos.
>
> Les fichiers sont dans ce même dossier Drive. Sur le Mac, ils vivent dans
> `Sprinter/content/instagram/gameplay/`, et le harnais de tournage avec eux.

Tout ce qui est ici est du **vrai gameplay** : le jeu tourne, quatre
navigateurs le jouent, et c'est le serveur qui tranche les duels, distribue
les points de ligue, note les passages de témoin et sacre les champions. Rien
n'est maquetté, rien n'est rejoué à la main dans un logiciel de dessin.

---

## Les vingt fichiers

| Fonctionnalité | Reel monté | Durée | Rush brut | Photos |
|---|---|---|---|---|
| Classement des duels | `sprinter_classement-duels_reel_v1.mp4` | 19,2 s | `…_raw_v1.mp4` (73 s) | `…_cover_v1.jpg` · `…_moment_v1.jpg` |
| Course en direct | `sprinter_course-en-direct_reel_v1.mp4` | 14,9 s | `…_raw_v1.mp4` (37 s) | idem |
| Relais 4 × 100 | `sprinter_relais_reel_v1.mp4` | 20,0 s | `…_raw_v1.mp4` (162 s) | idem |
| Nationalité | `sprinter_nationalite_reel_v1.mp4` | 19,3 s | `…_raw_v1.mp4` (36 s) | idem |
| Championnats | `sprinter_championnats_reel_v1.mp4` | 24,1 s | `…_raw_v1.mp4` (48 s) | idem |

`cover` = la vignette du reel. `moment` = l'image forte, publiable seule.

Ce qu'elles portent, fonctionnalité par fonctionnalité :

| | cover | moment |
|---|---|---|
| Duels | le classement, KENZA 3e, flèche verte ↑3 | la fenêtre du duel : 9,22 s contre 9,70 s |
| Direct | l'arrivée EX AEQUO, 9,26 s des deux côtés | les deux coureuses épaule contre épaule, `−0,3 m`, ligne en vue |
| Relais | les quatre relayeurs dans l'ordre, sur la piste | le chrono commun, 42,91 s, et les trois passages notés |
| Nationalité | la carte d'identité : 🇫🇷 France, définitif, cadenas | sa ligne au classement, drapeau compris |
| Championnats | le podium, drapeaux et distance | le classement final de la finale |

---

## Ce que chaque reel montre, et ce qui s'y est réellement passé

**1 · Classement des duels** — KENZA est 6e. Elle prend OMAR (3e) à l'épée
depuis le classement, court son 100 m en **9,22 s**, lui envoie le défi. OMAR
le relève et le perd en **9,70 s**. Le serveur lui donne **+32 PL**, et le
tableau — resté ouvert à l'écran — fait **remonter sa ligne de la 6e à la 3e
place**, flèche verte comprise. C'est l'animation de l'interface, pas un
effet de montage.

**2 · Course en direct** — KENZA ouvre un couloir, NADIA le prend avec le
code, les deux partent au même coup de pistolet. Arrivée : **9,26 s contre
9,26 s, EX AEQUO**. Quatre prises ont été filmées et c'est la plus serrée qui
est montée (les trois autres se jouaient à 2 et 3 centièmes). Rien n'est
truqué : chaque prise est une vraie course, on a gardé la meilleure.

**3 · Relais 4 × 100** — l'équipe **COMÈTE** se monte sous la caméra : quatre
noms, trois invitations, trois acceptations, un ordre. Les quatre entrent sur
la piste, et la course se court : **les trois passages de témoin sont notés
« correct »**, l'équipe remonte de la 8e à la 2e place et boucle en
**42,91 s**.

**4 · Nationalité** — YANIS ouvre la bienvenue, fait défiler les 51 pays,
choisit la France. Le jeu demande confirmation en nommant le pays et rappelle
que le choix est définitif. Puis les conséquences, telles que le jeu les
produit : le drapeau posé et **fermé au cadenas**, la phrase « il décide de
ton championnat national », et sa ligne au classement des duels qui porte
désormais 🇫🇷 au milieu de sept autres pays.

**5 · Championnats** — huit championnats nationaux s'ouvrent le même samedi.
On filme celui de France pendant qu'il se déroule : séries, **révélation des
repêchés**, demi-finales, finale. **KENZA est sacrée en 9,255 s**, le podium
s'affiche avec les drapeaux, et la médaille reste accrochée à son nom dans le
classement des duels.

---

## Le traitement

Le même sur les cinq, et il suit la charte (`docs/instagram_charte.md`) :

- **une poussée sur chaque plan**, vers l'endroit qui compte — le chrono, le
  drapeau, la flèche du classement, la ligne d'arrivée ;
- **des coupes sèches**, aucun temps mort, aucun fondu enchaîné ;
- **un titre d'accroche dans les deux premières secondes**, en Outfit 900,
  capitales, sur le plan lui-même et non sur un carton noir ;
- **des légendes de mouvement de trois à cinq mots**, en bas, sur une plaque
  sombre pour rester lisibles sur une piste claire — le reel se comprend sans
  le son, et il n'y a pas de son ;
- **une signature de fin qui ne demande rien.** « Il reste de la place
  au-dessus », « Il reste un couloir », « Il y a un titre à prendre ». La
  charte bannit « abonnez-vous », « lien en bio » et le reste (§1.4) : la
  dernière ligne constate qu'une place est libre, elle ne réclame pas un
  geste.

Les chiffres des cartons ne sont pas recopiés à la main : ils sont lus dans
`faits.json`, écrit par le harnais à partir de ce que le serveur a enregistré.
Un carton ne peut donc pas annoncer un chrono que l'image ne montre pas.

---

## Les joueurs à l'écran

**Aucun pseudonyme réel n'apparaît.** KENZA, OMAR, NADIA, RAYAN, NINA, TIAGO,
AMARA, IMANE, ELIO, SOFIA et YANIS sont fabriqués pour l'occasion, comme les
288 coureurs de fond répartis sur huit pays. La charte interdit de publier le
pseudonyme de quelqu'un sans son accord, y compris dans une capture de
classement (§5.4) — c'est la question restée ouverte dans le pack du
5 septembre, et elle ne se pose plus ici.

Le jeu filmé tourne **en local**, sur le canal de **production** (aucun
bandeau « version de test », aucune porte à code — la charte interdit de
présenter le canal de test comme le jeu, §5.2), contre un
`wrangler dev --local`. Aucune de ces parties n'a touché le classement réel.

---

## Refaire, ou refilmer

Le harnais est dans `harnais/`. Il lui faut trois choses en marche :

```bash
# 1 · le serveur, en local
cd worker && npx wrangler dev --local --port 8787

# 2 · le jeu, branché dessus (canal de production, pas de bandeau)
API_LOCALE=http://127.0.0.1:8787 npx vite --port 5174

# 3 · Playwright, avec le Chrome de la machine
npm i playwright     # puis : chromium.launch({ channel: 'chrome' })
```

Ensuite, pour chaque fonctionnalité : `node semer.mjs` (le terrain), puis
`node fN-….mjs` (la capture), puis `node rN-….mjs` (le montage).

`_travail/` garde les suites d'images de chaque prise — 2,3 Go, exclus de git.
Elles servent à remonter un reel sans refilmer ; le rush livré porte la même
matière, donc le dossier se supprime sans rien perdre d'irremplaçable.

---

## Quatre pièges qui ont coûté une prise chacun

Ils sont documentés dans le code du harnais, à l'endroit exact où ils se
produisent. Résumé, parce que ce sont eux qui feront gagner du temps la
prochaine fois :

1. **`page.screenshot()` de Playwright efface l'émulation d'appareil.** Un
   seul appel pendant une capture, et toutes les images suivantes reviennent
   au tiers supérieur gauche, à la résolution CSS, dans un cadre de
   1080 × 1920. La taille du fichier ne bouge pas, rien n'échoue — et le rush
   entier est bon à jeter. La caméra le vérifie désormais toute seule à
   l'arrêt et le dit à voix haute.
2. **Le pointeur et la capture ne cohabitent pas.** Un `tap()` ou un `click()`
   de Playwright est perdu dès que `Page.captureScreenshot` boucle, à
   n'importe quelle cadence — 37 images par seconde comme 11, et même en
   arrêtant la capture le temps de l'appui. Les évènements de **clavier**, eux,
   passent sans faute. Le harnais appuie donc **depuis la page**
   (`element.click()`, plus la séquence `pointerdown`/`pointerup` pour le
   bouton du témoin, qui écoute le contact et non le relâchement).
3. **`zoompan` et `crop` ne savent pas faire une fenêtre qui rétrécit.**
   `crop` n'évalue sa largeur qu'une fois, à la configuration du filtre ;
   `zoompan` rend ici une image réduite au tiers dans un coin, quelle que soit
   la formule. La poussée est donc calculée par PIL (`plans.py`), au
   sous-pixel — la même chaîne que `suivi/teaser/composer.py`.
4. **Au relais, seul le porteur court.** Faire taper les quatre coureurs dès
   le pistolet élimine l'équipe à tous les coups (« sortie de zone sans le
   témoin ») : le receveur dispose de trente mètres pour se lancer et les a
   quittés bien avant que le témoin n'arrive. Le harnais lance le receveur
   seize mètres avant sa marque et déclenche la passe **sur la distance lue à
   l'écran**, dans la zone — c'est ce qui a permis de filmer, pour la première
   fois, un relais complet.
