# Teaser — championnats nationaux · FR et EN

> Monté le **9 septembre 2026**, voix off ajoutée le **10 septembre**, pour un
> départ annoncé au **samedi 26 septembre**.
> Format livré : **MP4 H.264, 1080 × 1920, 30 i/s**, son **AAC 48 kHz stéréo** —
> JPEG 1080 × 1920 pour les images fixes.

| Fichier | Ce que c'est | Durée / poids |
|---|---|---|
| `…_teaser_fr_v2_voix.mp4` | **le teaser français, speaker + musique** | 17,5 s · 5,0 Mo |
| `…_teaser_en_v2_voix.mp4` | **le teaser anglais, speaker + musique** | 17,5 s · 5,0 Mo |
| `…_teaser_fr_v2.mp4` · `…_en_v2.mp4` | les mêmes, **musique seule** | 17,5 s · 5,0 Mo |
| `…_teaser_fr_v2_muet.mp4` · `…_en_v2_muet.mp4` | les mêmes, **sans aucun son** | 17,5 s · 5,0 Mo |
| `…_affiche_fr_v2.jpg` · `…_affiche_en_v2.jpg` | le podium, la date posée dessus | ~205 Ko |
| `…_cover_fr_v2.jpg` · `…_cover_en_v2.jpg` | le podium seul, vignette du reel | ~154 Ko |

Niveaux **mesurés sur les fichiers livrés**, après encodage AAC :

| | crête | RMS | saturation |
|---|---|---|---|
| avec voix, FR | −3,07 dB | −14,74 dB | 0 échantillon |
| avec voix, EN | −1,73 dB | −14,73 dB | 0 échantillon |
| musique seule, FR et EN | −3,10 dB | −14,73 dB | 0 échantillon |

Les quatre tombent sur la même sonie, et c'est une correction du 10 septembre :
`ecrire()` ne normalisait que la **crête**, ce qui rendait la sonie du film
otage d'un seul transitoire — la version anglaise sortait 1,3 dB plus bas que
la française pour la même musique, un coup de grosse caisse tombant sous une
syllabe d'un côté et pas de l'autre. Un gain de rattrapage vise désormais
−14,5 dB de RMS (la cible d'Instagram), plafonné pour que la crête reste sous
−1 dB.

Conducteur : [`../gameplay/harnais/t1-championnats-nationaux.mjs`](../gameplay/harnais/t1-championnats-nationaux.mjs).
Bande-son : [`../gameplay/harnais/musique.py`](../gameplay/harnais/musique.py).
Voix off : [`../gameplay/harnais/voix.py`](../gameplay/harnais/voix.py).

**Les trois versions ont exactement la même image.** Elle n'est encodée
qu'une fois ; les bandes-son sont collées dessus en recopiant la vidéo
(`-c:v copy`), sans réencoder. C'est pour cela que le film n'est pas passé en
v3 : son image est celle de la v2, au pixel — seule la piste change, et c'est
le suffixe qui le dit. La vignette et l'affiche n'ont pas eu à être revues.

**Pourquoi une version muette, et une version sans voix.** Les cinq reels de
septembre sont muets parce qu'Instagram pose sa propre musique au moment de
publier : la version muette est celle qu'on garde pour poser un morceau sous
licence, si tu en achètes un. La version **musique seule** est celle sur
laquelle on posera une vraie voix le jour où tu en enregistreras une, à la
place de la synthèse.

⚠️ **La version musique seule n'est plus celle du 9 septembre.** La nappe de
foule a été refaite le 10 (voir « Ce que la voix a fait remonter dans la
bande-son ») : elle grésillait, et le défaut était dans le lit, pas dans la
voix. Il fallait donc le corriger dans les deux versions. Si tu avais déjà
validé la piste du 9 septembre, réécoute-la.

---

## Ce qu'il y a dans l'image

**Du vrai gameplay, et aucune image fabriquée.** Deux rushes du 9 septembre
(`../gameplay/_travail/05-championnats` et `…-en`, 1 296 images chacun,
43,2 s) : deux vrais weekends de championnat de France courus par le serveur.
**Les chronos affichés sont ceux de ces courses-là** — VOLT sacré en 9,255 s
devant PLAYER 001 (9,359 s) et MACH (9,384 s). Seuls la date, la bande-son et
les cartons sont fabriqués.

Cinq plans, ~17,5 s, **cinq écrans différents** :

1. **le panneau du championnat** — 32 partants. Un seul titre.
2. **la carte de sélection** — « TU Y ES · SÉRIE 2 · la grille est gelée »
3. **les repêchés** — ils sortent du chrono, pas d'une victoire
4. **le sacre** — séries · demies · finale
5. **le podium** — 9,255 s, puis la date qui s'y dissout, puis la signature

**La fin n'a plus une seule coupe.** Le podium dure 5,8 s : le carton de la
date s'y dissout à 12,3 s, reste plein jusqu'à 14,8 s, puis se dissout dans la
signature — et le film se ferme sur un fondu au noir de 0,35 s, parce qu'un
reel boucle et qu'une dernière image qui saute au coup de pistolet se lit comme
un accroc. Voir la note « LE PODIUM DURE CINQ SECONDES HUIT » dans le
conducteur pour ce qui n'allait pas avant.

**Les pseudos.** Le haut du classement porte des pseudos de vitesse en un mot
— AXIOM, ZEPHYR, COMET, SURGE, BLITZ, **VOLT**, NITRO, EMBER, MACH, QUASAR,
plus NOVA sans pays — et les 288 autres sont des dossards, `PLAYER 001` à
`PLAYER 288`. Le répertoire est à un seul endroit,
[`../gameplay/harnais/noms.mjs`](../gameplay/harnais/noms.mjs), et il explique
les trois contraintes qui ont fermé des portes (dont : pas de PLAYER ONE/TWO en
tête du classement, ils se liraient comme des places sur un podium).

**La version anglaise est vraiment anglaise**, y compris ce que le jeu affiche :
FRANCE NATIONAL CHAMPIONSHIP, YOU ARE IN, HEAT 2, Heats · Semi-finals · Final,
THE FASTEST LOSERS, VIEW DUEL RANKING. Il a fallu pour cela **corriger le jeu**
— voir plus bas.

**La bande-son** est composée, pas choisie : aucun morceau sous licence n'était
disponible, et un teaser publié avec une musique qui ne t'appartient pas se
fait couper le son. Elle est **écrite à partir du montage** : coup de pistolet
sur la première image, pulsation à 132, un impact sur chaque coupe, la basse
qui change de note à chaque plan, une montée vers le carton de la date où tout
tombe sauf la basse, puis un accent plus doux sur la signature — sans lui, les
cinq dernières secondes s'écouleraient sans un événement et la fin
s'affaisserait. L'accord s'y revoice vers le haut : il se pose sans conclure,
ce qu'un teaser doit faire. Le détail des voix est dans `musique.py`.

## La voix off

**Un speaker de stade**, qui dit les cartons à l'oreille de qui fait défiler
sans regarder. Six phrases, accrochées non pas à des secondes mais **au carton
qu'elles accompagnent** (`T.voix`, champ `apres`) : le montage a déjà bougé une
fois sous des repères absolus, et une voix calée en dur se serait décalée de la
même façon, en silence.

| s | phrase (FR) | phrase (EN) |
|---|---|---|
| 0,40 | Trente-deux partants. Un seul titre. | Thirty-two starters. One title. |
| 2,90 | Les trente-deux premiers du pays sont pris. | The top thirty-two of your country are selected. |
| 7,05 | Séries, demies, finale. | Heats, semis, final. |
| 9,40 | VOLT est sacré en neuf secondes deux cent cinquante-cinq. | VOLT takes the title in nine point two five five. |
| 13,10 | Samedi vingt-six septembre. | Saturday, twenty-six September. |
| 15,50 · 15,60 | Es-tu dans les trente-deux ? | Are you in the thirty-two? |

**`voix.py` refuse de rendre deux phrases qui se chevauchent**, ou une phrase
qui dépasserait la fin du film. C'est lui qui a signalé que l'anglais, plus
long à syllabe égale, faisait annoncer la sélection par-dessus l'écran des
repêchés — pas une écoute. Les deux premières lignes anglaises montent donc à
208 et 212 de débit pour tenir dans leur fenêtre.

La quatrième phrase entre **avant** son carton (`apres: -0.15`) : le nom du
champion se dit sur le podium, le chiffre arrive à l'image pendant qu'on
prononce « est sacré », et le chrono est dit quand il est lisible. Une voix qui
précède l'image de deux dixièmes est du montage ordinaire — c'est l'image qui
vient confirmer ce qu'on vient d'entendre.

**Il dit les cartons, mot pour mot, et c'est voulu.** Un speaker qui
paraphraserait le texte à l'écran apprendrait deux formulations pour une seule
idée ; et ces mots-là viennent du dictionnaire du jeu, pas d'ici. Les deux
seules choses qu'il ajoute sont **le nom du champion** — que le podium montre
mais qu'aucun carton ne nomme, et qui est lu dans `faits.json`, pas écrit en
dur — et **le chrono**, dit à la française.

**Le plan 3 n'a pas de ligne.** Les repêchés gardent leur carton et rien à
l'oreille. Les six phrases font déjà **13,2 s de parole sur 17,5** (76 %) ;
une septième les porterait à 14,9 s, et une annonce qui ne s'arrête jamais ne
se retient pas. C'est aussi le seul silence assez long — 1,8 s — pour que la
musique reprenne le film à son compte entre deux phrases.

### L'intonation est écrite à la main

La première version se disait « trop robotique », et elle l'était : une seule
hauteur et un seul débit du premier au dernier mot. `say` accepte trois
commandes embarquées, et elles fonctionnent **au milieu** d'une phrase :

| | |
|---|---|
| `[[pbas n]]` | la hauteur. Plage utile **mesurée** : 40 à 50 pour Thomas (105 → 152 Hz), 45 à 57 pour Daniel (131 → 193 Hz — à 61 il replie à 178). Sous 40, la voix fabrique des octaves. |
| `[[rate n]]` | le débit, mot à mot |
| `[[slnc n]]` | un silence, en millisecondes |

`[[pmod]]`, la modulation de hauteur, est **ignorée** par ces deux voix :
essayée de 0 à 250, elle rend un fichier identique à l'octet. C'est donc `pbas`
qui porte toute l'intonation.

**La forme de chaque phrase.** Une annonce monte sur ce qu'elle appelle et
descend sur ce qu'elle acte : 47 → 41 sur l'accroche, 48 → 42 sur le sacre,
46 → 40 sur la date. La liste des étages monte d'un cran au milieu (44 → 46)
puis retombe plus bas qu'elle n'avait commencé (40), ce qui la fait atterrir au
lieu de s'arrêter. Et la question finale est la seule qui **monte** en
finissant — 42 → 50 en français, 45 → 55 en anglais — parce que c'est la seule
phrase du film adressée au spectateur.

*Ce qui est vérifié, et ce qui ne l'est pas.* Que `pbas` porte la hauteur dans
le sens écrit est mesuré sur un A/B propre : `[[pbas 47]]…[[pbas 41]]` rend
150 → 118 Hz, l'ordre inverse 112 → 150 Hz. En revanche **relire le contour
dans le fichier fini n'est pas fiable** — un détecteur de fondamental double
d'octave sur la consonne finale, et trois fenêtres de mesure ont donné trois
réponses. La forme des phrases se juge à l'oreille, pas au chiffre.

### Pourquoi elle passe dans une sono

La seule synthèse vocale disponible ici est celle du système (`say` : Thomas en
français, Daniel en anglais). Brute, elle s'entend pour ce qu'elle est. Mais un
speaker de stade n'est **jamais** entendu brut : sa voix sort d'un pavillon,
coupée dans le grave et dans l'aigu, écrasée par la compression de la sono, et
elle revient avec la réverbération du bol. Ce traitement — qu'il faut de toute
façon appliquer pour que la voix appartienne à l'image — est exactement celui
qui efface le timbre de synthèse. Le défaut de la source devient la couleur du
lieu.

    passe-haut 150 Hz     un pavillon n'a pas de corps
    + présence 2 kHz      la bosse qui fait porter une annonce
    compression 3:1       une sono ne laisse rien respirer
    saturation douce      l'ampli qui chauffe
    passe-bas 6,2 kHz     et il n'a pas d'aigu — EN DERNIER
    4 réflexions + queue  le bol, 0,9 s, sombre

**L'ordre des étages est une correction, et c'était une faute.** Le passe-bas
était placé avant la saturation. Or `tanh` fabrique des harmoniques, et rien
ne les rattrapait : mesure au FFT, la chaîne **ajoutait 17 dB à 12 kHz** par
rapport à ce que rendait `say` — elle refabriquait tout le haut du spectre que
le filtre venait d'enlever. C'est exactement ce qui rend une voix dure. Le
passe-bas passe donc en dernier, et c'est lui qui a le dernier mot sur la
bande. Le reste a été adouci du même coup : présence 0,55 → 0,30, saturation
2,3 → 1,4, passe-haut 190 → 150 Hz. Un traitement de mégaphone n'aide pas une
voix de synthèse à passer pour humaine — il la rend téléphonique.

La queue est tenue à 0,9 s là où un vrai stade en fait deux et plus : au-delà,
deux phrases séparées d'une seconde se superposent et l'annonce devient
illisible. On garde l'**indice** du lieu, pas sa mesure. Elle est faite de
**quatre** peignes récursifs et non deux : deux longueurs seules laissent
entendre leur propre période, ce qui donne le « boing » métallique qu'on prend
pour de la mauvaise réverbération.

### La musique baisse sous la voix, elle ne se bat pas avec

C'est la sono qui fait la place, pas le volume de la voix. La musique perd
**8,4 dB** au creux sous la parole, le stade **3,1 dB** seulement : le stade
est du bruit large, il ne masque pas les consonnes, et le faire plonger avec la
musique ferait respirer la foule au rythme des phrases — un défaut qu'on entend
tout de suite dans un lieu qu'on sait continu.

**Deux réglages ont dû être corrigés par la mesure, et pas à l'oreille de
l'esprit :**

- **Le gain de la voix.** À la première valeur essayée, la voix ressortait
  6,4 dB **sous** la musique, jusqu'à 8,4 dB sous elle : enterrée. Portée de
  0,72 à 1,55, elle passe à **+2,7 dB** au-dessus du lit en large bande,
  moyenne des douze phrases (+3,6 dB en français, +1,8 dB en anglais).
- **L'égalisation des phrases.** Ramenées à la même **crête**, les lignes
  n'avaient pas la même sonie : « Heats, semis, final. » sortait 6 dB sous son
  équivalent français, parce qu'une crête de parole est une plosive ou une
  sifflante et ne dit rien de ce que l'oreille entend. Elles sont maintenant
  ramenées au même **RMS**, la crête ne servant plus que de plafond.

Le chiffre qui compte est celui de la **bande 300–4000 Hz**, là où l'oreille
cherche la consonne : la voix y est de **+13,2 à +22,9 dB** au-dessus de la
musique, sur les douze phrases des deux langues. En large bande, une phrase
anglaise reste sous la musique — mais ce RMS-là est fait de grosse caisse et de
basse, sous 300 Hz, qui ne masquent aucun mot.

## Ce que la voix a fait remonter dans la bande-son

**Ça grésillait, et ce n'était pas la voix : c'était la foule.** L'atténuation
de la musique sous la parole creuse le lit de 8 dB, et ce creux a mis à nu un
défaut qui était là depuis le début.

La nappe de foule était du **bruit blanc** passé dans un
`passe_bande(1100, q=0.28)`. Un Q de 0,28 a des pentes de 6 dB par octave —
trop douces pour renverser la pente du bruit blanc, qui monte de 3 dB par
octave dès qu'on le mesure par bandes. Mesure au FFT, par rapport au 500 Hz :

| | 250 Hz | 500 Hz | 1 kHz | 2 kHz | 4 kHz | 8 kHz |
|---|---|---|---|---|---|---|
| la foule, **avant** | −4,6 | 0 | **+5,0** | **+6,3** | **+6,8** | **+5,4** |
| la foule, **après** | −1,8 | 0 | −1,3 | −18,1 | **−39,5** | −62,3 |
| le lit entier (musique + foule), avant | −0,3 | 0 | +4,2 | +8,1 | **+7,1** | +6,1 |
| le lit entier, après | −2,6 | 0 | −1,7 | −5,0 | **−10,8** | −9,8 |

Une foule plus brillante à 4 kHz qu'à 500 Hz n'est pas une foule, c'est du
souffle. Une foule lointaine dans un bol est **plate de 250 à 1000 Hz puis
tombe** : passe-haut à 150 Hz et **deux** passe-bas à 1000 Hz en cascade, soit
24 dB par octave dont 3 sont rendus au bruit blanc — une chute nette de 7 dB
par octave au-dessus du kilohertz. Sur le lit entier, 18 dB d'aigu en moins.

Le niveau est **normalisé en sortie** de `stade()` : deux passe-bas en cascade
emportent l'essentiel de l'énergie d'un bruit blanc, et sans cela la foule
aurait disparu du mélange au lieu de changer de couleur. Le facteur est un
scalaire, il ne touche donc pas la périodicité des houles — donc pas le point
de bouclage.

*Trois instruments, trois réponses.* Un banc de biquads à q=1,41 a d'abord
donné −15,6 dB à 4 kHz, puis une DFT sur signal décimé a donné n'importe quoi
(elle repliait l'aigu sur le grave). La vraie valeur est −39,5 dB, mesurée par
FFT radix-2. **Un banc de filtres à 6 dB/octave ne peut pas mesurer 40 dB
d'écart** : les bandes fortes lui fuient dedans. Si tu remesures ce lit un
jour, mesure-le par FFT.

L'atténuation descend en 25 ms — assez vite pour que le premier mot ne soit pas
mangé — et remonte en 280 ms, assez lentement pour ne pas pomper entre deux
mots d'une même phrase. Sa référence est le **75e centile** des échantillons
actifs du suiveur, et non son maximum : le maximum est une pointe, il est
2,6 dB au-dessus du niveau de parole ordinaire, et l'atténuation n'atteignait
sa pleine profondeur nulle part.

## La boucle

Un reel rejoue sans fin, et le raccord de la dernière image à la première fait
partie du montage. Trois choses le tiennent :

- **L'image se ferme au noir** (0,35 s) et rouvre en pleine lumière sur le coup
  de pistolet. Noir → détonation : la boucle se lit comme un recommencement.
- **La phrase boucle aussi.** Le film finit sur « Es-tu dans les 32 ? » et
  reprend sur « 32 partants. Un seul titre. » — la question, puis ce qui y
  répond.
- **Le stade traverse le raccord.** La nappe de foule est la seule voix qui le
  puisse : c'est du bruit, il n'a pas de phase à raccorder, seulement un
  niveau. Ses trois houles ont donc des périodes qui tiennent un nombre
  **entier** de fois dans le film (cycle/5, cycle/13, cycle/29) : elles valent
  exactement la même chose à la première et à la dernière image. Mesuré :
  0,0480 à l'ouverture contre 0,0442 à la fermeture, soit 9 % d'écart —
  inaudible. Avant, les périodes étaient 3,7 / 1,3 / 0,61 s et tombaient
  n'importe où : 0,0479 contre 0,0217, un facteur 2,2 que l'oreille prenait
  pour un marchepied à chaque tour.

**Ni la voix ni la remise en forme de la foule ne changent le raccord.** Mesuré
sur la nappe de foule, **sur 200 ms** : 0,0472 → 0,0443 sans voix (6 %),
→ 0,0432 en français avec voix (8 %), → 0,0431 en anglais (9 %). Le relevé du
9 septembre donnait 9 % : le raccord est donc aussi bon, ou meilleur.

La dernière phrase est finie 0,75 s avant la dernière image en français, 0,57 s
en anglais, et `voix.py` refuse de rendre une phrase qui dépasserait la fin du
film. Le fondu de sortie ne porte pas sur elle : ce qui resterait à fondre
serait la queue de réverbération, celle que le bus du stade a justement pour
rôle de laisser passer.

*Deux pièges de mesure, tous les deux tombés dedans.*

- Prise sur le **mélange** et non sur le bus du stade, la mesure donne un
  facteur 7 entre l'ouverture et la fermeture. C'est le contraste **voulu**
  entre une fin calme et un coup de pistolet, pas un défaut.
- Prise sur **une image** (33 ms) au lieu de 200, elle a annoncé 19 % d'écart
  quand la vraie valeur est 6 %. Depuis sa remise en forme, la foule est un
  bruit à **bande étroite** : sur 33 ms son RMS ne porte qu'une trentaine
  d'échantillons indépendants, soit 12 % d'incertitude. La fenêtre de 200 ms
  est celle du relevé du 9 septembre, et c'est elle qui fait référence.

Le fondu de sortie ne porte donc que sur la **musique**, pas sur le stade :
l'accord se pose quand l'image s'éteint, la foule reste. Seules les 25
dernières millisecondes du mélange sont adoucies, contre le clic — pas contre
le silence, qu'on ne cherche plus.

*Ce qui n'est pas traité, faute d'y gagner :* la pulsation s'arrête à 12,3 s
sur le carton de la date, si bien que les cinq dernières secondes n'ont plus
de grille rythmique. Caler la durée totale sur un nombre entier de mesures ne
changerait donc rien d'audible au point de bouclage.

## Ce que ce teaser a corrigé dans le jeu

Trois choses, toutes trouvées en essayant de filmer une version anglaise. Elles
ne concernent pas le teaser : **un joueur anglophone les voit aujourd'hui.**

1. **Les noms de phases étaient en français en anglais.** `FORMAT.phases` les
   envoie du serveur (« Séries », « Demi-finales », « Finale ») et le jeu les
   affichait tels quels. Traduits par leur **clé** — `champ_phase_series` etc.,
   la clé est stable, le libellé se réécrira — en Heats / Semi-finals / Final.
   « Heats » parce que c'est déjà le mot du jeu pour une série (`sel_ma_serie`).
2. **Le titre d'une édition était en français en anglais**, article et nom de
   pays compris — « Championnat de France » en haut du panneau, sur le podium
   **et** dans la banderole de sélection, au milieu d'un écran traduit.
   `PAYS_NOMS` et `CONTINENT_NOMS` portent désormais une troisième colonne (le
   nom anglais), et le client compose son titre avec `N.titreEdition()`.
3. **Une coquille dans la table des pays** : `AR: ['Argentine', "d'Argentine'"]`
   — une apostrophe en trop, qui affichait « Champion d'Argentine' », guillemet
   compris.

**Et une quatrième, trouvée mais non corrigée : le chrono du podium n'a pas de
virgule en français.** Le podium affiche `9.255 s`, `9.359 s`, `9.384 s`, point
compris, en français comme en anglais — parce que
[`src/components/screens/Championnat.tsx:37`](../../../src/components/screens/Championnat.tsx)
formate son chrono chez lui :

```ts
const chrono = (ms: number | null) => ms == null ? '—' : (ms / 1000).toFixed(3) + ' s';
```

Or le jeu a déjà tranché la question ailleurs : `s2()` de
`src/game/trace-affiche.js` pose la virgule, et le LISEZMOI du reel de
septembre compte les « chronos au point » parmi les défauts corrigés de sa v1.
Ce plan-là ne passe pas par `s2()`.

**Le carton du teaser a donc raison de recopier le point** (`CHRONO.ecrit`) :
il couvre cet écran, et une virgule sur le carton au-dessus d'un point à
l'image serait pire que le point. La voix, elle, dit « neuf secondes deux cent
cinquante-cinq », qui est correct dans les deux cas. **C'est le jeu qu'il faut
reprendre, pas le teaser** — et tant qu'il ne l'est pas, ne corrige pas le
carton seul. `Championnat.tsx` porte trois décimales là où `s2()` en donne
deux : reprendre ce chrono demande de choisir entre les deux précisions, ce
qui est une décision de jeu et non de montage. Non fait ici, hors du périmètre.

Et un garde-fou dans le harnais : `Camera.demarrer()` **effaçait** son dossier.
Elle range maintenant de côté tout rush qui porte un `marques.json`. Voir la
note « UN RUSH FINI NE S'EFFACE PAS » dans `base.mjs` — et le paragraphe suivant.

## Deux avertissements

**Le rush du 6 septembre est perdu.** Relancer la capture pour changer les noms
a effacé ses 1 444 images avant que le garde-fou existe. Les MP4 livrés du
6 septembre existent toujours ; leurs images sources, non — `reel 5` et le
teaser v1 ne peuvent plus être remontés, seulement rejoués. Le teaser v1 (avec
les prénoms) est rangé dans `_remplace-v1-prenoms/`.

**`r5-championnats.mjs` est à re-régler avant de servir.** Le nouveau rush n'a
pas le même minutage que celui du 6 septembre (les demies passent de 14,4 s à
10,6 s) : ses fenêtres de plans sont périmées et il rendrait un reel mal calé.
Le reel 5 livré porte encore les prénoms — si tu veux qu'il porte les pseudos,
il faut re-régler ce conducteur comme celui-ci l'a été.

## Trois choses à trancher avant de publier

**1 · La voix est de synthèse, et il reste une limite que le code ne franchit
pas.** L'intonation est écrite à la main et la chaîne de sono a été corrigée,
mais ce sont les voix **compactes** du système — les seules installées sur
cette machine, et les seules qui n'envoient pas le texte du teaser chez un
tiers. Vérifié : aucune autre voix n'est présente sur le disque
(`/System/Library/AssetsV2/…CombinedVocalizerVoices/` ne contient que son
catalogue).

**Le plus gros gain restant tient en trois clics, et il est à toi :** Réglages
Système → Accessibilité → Contenu énoncé → Voix système → *Gérer les voix*, et
télécharger la variante **Premium** de Thomas (ou une voix Siri française).
Elles sont d'une autre génération que les compactes. Dis-le-moi et je
re-rends : rien à recapturer, rien à re-régler — seul le nom dans `SPEAKER`
change, et les fenêtres se revérifient toutes seules.

**Écoute-la avant de publier.** C'est le seul jugement que la mesure ne
remplace pas, et j'ai montré ci-dessus trois cas où mes instruments m'ont
menti. Les trois versions sont livrées côte à côte, et poser une vraie voix
enregistrée sur la version musique seule ne demande aucun remontage.

Sur la licence : rien n'égale ici le risque d'un morceau sous licence (aucun
système de reconnaissance ne détecte une voix de synthèse), mais les conditions
d'Apple sur la réutilisation de ces voix ne sont pas quelque chose que je peux
te garantir.

**2 · Aucune édition n'est annoncée sur le serveur de production.**
`GET /champ/prochain?zone=FR` répond `{"edition":null}`. Ouvrir réellement
l'édition demande un appel admin :

```bash
curl -X POST "$API/champ/annoncer" -H "X-Sprinter-Admin: $ADMIN_CLE" \
  -d '{"cycle":true,"echelon":"national","debut":<samedi 26 sept 00:00 UTC en ms>}'
```

**3 · La France est à 22 joueurs sur 32 en production.** `GET /champ/pays` donne
`FR: 22, eligible: false` — il faut 32 joueurs classés et actifs sur 60 jours.
La date du 26 septembre n'est pas encore tenable, et c'est ce teaser qui doit
aller chercher les dix qui manquent. À revérifier avant la clôture du
mercredi 23.

## Rejouer le montage

```bash
cd /Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/harnais
node t1-championnats-nationaux.mjs            # français
LANGUE=en node t1-championnats-nationaux.mjs  # anglais
```

Rien à recapturer : les deux rushes sont sur le disque. La date se change en un
seul endroit du conducteur (`DATE`), le texte de la voix en un seul aussi
(`T.voix`), la bande-son se recalcule toute seule sur les nouvelles coupes, et
le montage se refait en deux minutes par langue. Chaque rendu laisse dans
`../gameplay/_travail/_montage/t1-<langue>/` de quoi le relire :

| | |
|---|---|
| `voix.json` · `voix-rapport.json` | ce qu'on a demandé au speaker, et où chaque phrase tombe réellement |
| `musique-voix.json` · `musique-sansvoix.json` | les deux specs de bande-son, chacune gardée |
| `voix.wav` · `bande-son.wav` · `bande-son-sansvoix.wav` | les trois pistes |

**Changer une phrase du speaker** ne demande pas de refilmer : `T.voix` dans le
conducteur, puis relancer. Si une phrase devient trop longue et empiète sur la
suivante, `voix.py` **s'arrête** en le disant plutôt que de rendre un speaker
qui se parle par-dessus — règle son `debit`, ou décale son `apres`.

**Ce qui n'est pas reproductible bit à bit :** l'encodage final. À entrées
identiques — mêmes images, mêmes WAV, vérifié au md5 — trois rendus successifs
ont donné trois fichiers différents (l'un d'eux a d'ailleurs reproduit la v2 du
9 septembre à l'octet, ce qui est la preuve que la version musique seule n'a
pas bougé). C'est `libx264 -preset slow` qui n'est pas déterministe ici : ne
compare pas deux montages par empreinte, compare-les par mesure.

Pour **refilmer** (nouveaux pseudos, autre pays, autre langue) :

```bash
cd /Volumes/MUSIQUE/BENBEZI/Sprinter/worker && npx wrangler dev --local --port 8787
cd /Volumes/MUSIQUE/BENBEZI/Sprinter && API_LOCALE=http://127.0.0.1:8787 npx vite --port 5174
cd content/instagram/gameplay/harnais && node semer.mjs && node f5-championnats.mjs
```

⚠️ `harnais/node_modules` est un **lien symbolique vers le cache npx**
(`caches/npm/_npx/…/node_modules`), posé le 9 septembre parce que `cartons.mjs`
importe `playwright` et qu'aucun `node_modules` du dépôt ne le contient — et
qu'un import ESM, contrairement à CommonJS, ignore `NODE_PATH`. Un vidage du
cache npm casse ce lien : dans ce cas, `npm i playwright` dans `harnais/`.

> Le dossier `../gameplay/_travail/05-championnats-en.remplace-20260909080857`
> est la première capture anglaise, celle où la banderole disait encore
> « Championnat de France ». Le garde-fou l'a rangée au lieu de l'effacer : elle
> ne sert plus à rien, tu peux la supprimer.
