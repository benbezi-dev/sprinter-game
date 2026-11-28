# Le Sprint de Noël — une autre histoire pour le calendrier de l'Avent

Deuxième proposition d'histoire pour Noël 2026, à côté de « La Course de
l'Étoile » (`docs/NOEL_HISTOIRE.md`). Celle-ci ne reprend pas le système
d'Halloween.

| | Halloween / La Course de l'Étoile | **Le Sprint de Noël** |
|---|---|---|
| Ce qui fait avancer | un chapitre-mystère débloqué **après** la victoire | **une lettre d'enfant lue avant** la course : on sait pour qui on court |
| Contre qui on court | un chrono (ou une bête) | **le Père Noël lui-même**, qui progresse chaque jour |
| Le héros | « tu », seul face à une énigme | **un duo** : toi et le Père Noël, sprinteur noir, qui parle, rit, doute |
| Le ton | murmuré, mélancolique | **frontal** : un problème chiffré, une crise, une nuit pour tout réussir |
| La fin | une étoile s'allume | **le monde entier court**, et le dernier cadeau est pour toi |

Ce document contient le texte français. La traduction anglaise reste à faire.

---

## L'histoire en une page

**Le 1er décembre, les rennes du Père Noël tombent malades.** Une grippe des
rennes : aucun vol possible cette année. Le traîneau restera au sol.

Le Père Noël, lui, ne panique pas. Il ouvre une vieille malle, en sort une paire
de pointes et un dossard rouge, numéro 1. Avant la barbe blanche, avant le
traîneau, **il était sprinteur** : le plus rapide de son époque, celui que
personne n'a jamais battu sur 100 mètres.

**« Alors cette année, je livrerai en courant. »**

Le problème tient en un chiffre : deux milliards de cadeaux, une seule nuit.
Il lui faut retrouver sa vitesse en vingt-quatre jours, et il a besoin de
quelqu'un qui le pousse. Les lutins ont cherché le coureur le plus têtu de la
planète. Ils t'ont trouvé.

**Chaque jour, une lettre arrive**, d'un enfant quelque part dans le monde. Le
Père Noël la lit, puis vous courez l'un contre l'autre sur la piste du Village
de l'Étoile. Bats-le, et il te remercie à sa façon. Perds, et il te le fera
payer en blagues.

Au milieu du mois, **il se blesse.** Le jour où tout semble perdu, les enfants
du monde entier décident de courir pour lui. Le soir du 24, la planète devient
un relais : chaque enfant court ses cent mètres et passe le cadeau au suivant.
**Tu cours le dernier relais**, jusqu'au lit d'un petit garçon qui ne peut pas
marcher. Et dans la hotte, il reste un dernier paquet. Il porte ton nom.

### Les personnages

- **Le Père Noël.** Un grand athlète noir sans âge, barbe blanche, épaules
  de lanceur de poids, rire qui fait trembler les vitres. Ancien sprinteur
  invaincu. Généreux, vantard, drôle, et plus fragile qu'il ne le montre. Il
  court en maillot rouge, dossard 1, bonnet compris. Dans le jeu, c'est le
  coureur du couloir 1 au Village de l'Étoile
  (`sprinter-core.js`, VEDETTES ; `course-3d/corps.ts`).
- **Toi.** Le partenaire d'entraînement. Le Père Noël t'appelle « champion »
  quand tu gagnes, « bonhomme de neige » quand tu perds.
- **Mère Noël (Adjoa).** Médecin du Pôle, pragmatique, la seule que le Père Noël
  écoute.
- **Comète.** La plus vieille des rennes, la plus malade. Le Père Noël lui
  rend visite chaque soir.
- **Les lutins.** Calculent tout, en chiffres de plus en plus affolants.
- **Les enfants des lettres**, de Dakar à Séoul, de Marseille à Nunavut.

### Les quatre semaines

| Jours | Acte | Ce qui se passe |
|---|---|---|
| 1 à 6 | **La grippe des rennes** | Le traîneau cloué au sol, le Père Noël ressort ses pointes, le calcul impossible |
| 7 à 12 | **Le tour du monde** | Une lettre de chaque continent, le Père Noël retrouve sa vitesse |
| 13 à 18 | **La blessure** | Il force trop, la cuisse lâche ; les enfants du monde décident de courir pour lui |
| 19 à 24 | **La nuit du relais** | Le plan, la dernière lettre, le dossard 1, la nuit du 24 |

### Ce qui tient l'histoire ensemble

- **Le chiffre** revient à chaque acte : « trois maisons par seconde », puis
  « deux milliards de relais de cent mètres ». Il donne l'urgence.
- **La lettre du jour 21** (Kofi, à l'hôpital) prépare le dernier relais du 24.
- **La lettre du jour 1** n'est lue qu'à la fin : c'est la tienne, écrite à sept
  ans. Le Père Noël l'a gardée. C'est pour ça que les lutins t'ont trouvé.
- **Comète** guérit à l'aube du 25, au son des rires du relais : les rennes
  volent à nouveau pour ramener le Père Noël chez lui.

---

## Les vingt-quatre jours

Chaque jour : **la lettre** (avant la course), **le mot du Père Noël** (la
consigne), **la course** (contre lui), **après la victoire** (sa réaction).
Les défaites piochent dans les répliques de la fin du document.

Les chronos du Père Noël sont des repères à mesurer au harnais
(`tools/avent-test.mjs`), comme ceux du calendrier actuel : il commence
rouillé et finit plus rapide que toi.

### Semaine 1 — La grippe des rennes

**Jour 1 — LE TRAÎNEAU AU SOL**
> *Lettre :* une enveloppe scellée, sans nom. Le Père Noël la range dans sa
> poche sans l'ouvrir. « Plus tard. »
>
> **Père Noël :** « Les rennes éternuent, le traîneau ne décolle pas. Bon.
> Il me reste deux jambes. Montre-moi les tiennes. »
>
> *Course :* 100 m contre le Père Noël, rouillé. Il n'a pas couru depuis
> des siècles.
>
> *Après la victoire :* « Ho ho… ho. Tu m'as battu. Ça n'était jamais
> arrivé. Reviens demain. »

**Jour 2 — LE CALCUL**
> *Lettre :* Lilou, 6 ans, Marseille. « Cher Père Noël, cette année je veux
> juste que tu viennes. Pas besoin de cadeau. »
>
> **Père Noël :** « Les lutins ont fait le calcul. Deux milliards de cadeaux.
> Une nuit. Trois maisons par seconde. » Il replie le papier. « Lilou n'a rien
> demandé. Raison de plus. »
>
> *Course :* 100 m.
>
> *Après la victoire :* « Trois maisons par seconde. Toi, tu en fais deux.
> On progresse. »

**Jour 3 — LA MALLE**
> *Lettre :* Amadou, 9 ans, Dakar. « Est-ce que tu as un vrai traîneau ou
> c'est des bêtises ? »
>
> **Père Noël :** Il ouvre la malle. Dedans : des pointes usées, une médaille,
> une photo si jaunie qu'on ne sait plus de quand elle date : un jeune
> homme qui franchit une ligne, bras levés. « Avant la barbe, Amadou, il y avait ça. »
>
> *Course :* 200 m.
>
> *Après la victoire :* « J'avais vingt ans sur cette photo. Personne ne
> m'avait jamais battu sur cent mètres avant toi. Sur deux cents… on n'en
> parle pas. »

**Jour 4 — LA PISTE DES LUTINS**
> *Lettre :* Mei, 7 ans, Séoul. « Je cours vite moi aussi. On fait la
> course ? »
>
> **Père Noël :** « En une nuit, les lutins m'ont construit un stade. Une
> piste rouge, des sucres d'orge, un sapin de trente mètres. Ils l'appellent
> le Village de l'Étoile. Mei, je relève le défi. »
>
> *Course :* 100 m.
>
> *Après la victoire :* « Mei a raison de courir vite. Toi aussi. Moi, je
> rouille un peu moins chaque soir. »

**Jour 5 — COMÈTE**
> *Lettre :* Noah, 8 ans, Montréal. « Comment vont les rennes ? »
>
> **Père Noël :** Ce soir, il est passé à l'étable avant de courir. Comète,
> la plus vieille, n'a pas levé la tête. « Elle a porté le traîneau pendant
> trois cents Noëls. Cette année, c'est moi qui la porte. »
>
> *Course :* 200 m.
>
> *Après la victoire :* « Je lui raconterai ta course. Elle aime les
> histoires de vitesse. »

**Jour 6 — LA PREMIÈRE VRAIE COURSE**
> *Lettre :* Inès, 10 ans, Casablanca. « Mon grand frère dit que tu
> n'existes pas. Prouve-lui. »
>
> **Père Noël :** « Ce soir, plus de cadeau. Je cours pour de vrai. »
>
> *Course :* 100 m. Le Père Noël a retrouvé ses jambes : il faut le battre
> d'un vrai chrono.
>
> *Après la victoire :* « Dis au frère d'Inès que le Père Noël vient de
> prendre une raclée. C'est bien la preuve qu'il existe. »

### Semaine 2 — Le tour du monde

**Jour 7 — RIO**
> *Lettre :* Davi, 8 ans, Rio de Janeiro. « Chez moi Noël c'est l'été. Tu
> vas avoir chaud avec ton bonnet. »
>
> **Père Noël :** « Je garde le bonnet. Un sprinteur a ses habitudes. »
>
> *Course :* 200 m.
>
> *Après la victoire :* « Davi, je cours en bonnet par trente-cinq degrés,
> et je me fais battre quand même. Noël est cruel. »

**Jour 8 — MUMBAI**
> *Lettre :* Priya, 7 ans, Mumbai. « Mon papa travaille la nuit de Noël.
> Est-ce que tu peux passer avant ? »
>
> **Père Noël :** « Avant minuit, Priya. Promis. » Il ajoute un trait sur sa
> carte. « Ça me fait commencer plus tôt. Il faut aller encore plus vite. »
>
> *Course :* 100 m.
>
> *Après la victoire :* « Priya aura son papa et son cadeau. Toi, tu as ta
> victoire. Tout le monde est content, sauf mes cuisses. »

**Jour 9 — NUNAVUT**
> *Lettre :* Siku, 9 ans, Iqaluit. « Ici il fait nuit tout le temps en
> décembre. Comme ça tu as plus de temps chez nous. »
>
> **Père Noël :** « Siku vient de m'offrir trois heures. Le plus beau cadeau
> de la semaine. »
>
> *Course :* 400 m. La première longue distance.
>
> *Après la victoire :* « Quatre cents mètres… Le Père Noël était un
> sprinteur, pas un marathonien. Mais Siku compte sur nous. »

**Jour 10 — LAGOS**
> *Lettre :* Chidi, 6 ans, Lagos. « Est-ce que le Père Noël peut être noir
> comme moi ? »
>
> **Père Noël :** Il pose la lettre. Il sourit, longtemps. « Chidi. Regarde
> bien la photo de la malle. »
>
> *Course :* 100 m.
>
> *Après la victoire :* « Je vais lui envoyer la photo. Avec un mot :
> "Le Père Noël te ressemble. Cours vite." »

**Jour 11 — KYOTO**
> *Lettre :* Haru, 8 ans, Kyoto. « Mamie dit que le Père Noël est trop vieux
> pour courir. »
>
> **Père Noël :** « Ta mamie a raison. Je suis trop vieux. Je cours quand
> même. C'est ça, Noël. »
>
> *Course :* 200 m.
>
> *Après la victoire :* « Dis à Haru que sa mamie a gagné un pari. Le vieux
> s'est fait doubler. »

**Jour 12 — LA MOITIÉ DU CHEMIN**
> *Lettre :* Jade, 11 ans, Lille. « Je t'ai vu courir à la télé. Tu étais
> beaucoup plus rapide que l'an dernier. »
>
> **Père Noël :** « Douze jours. J'ai repris deux secondes. Les lutins
> disent que ça suffit pour un pays sur deux. » Il serre son lacet. « Un
> pays sur deux, ça ne me suffit pas. »
>
> *Course :* 100 m. Il est rapide, maintenant.
>
> *Après la victoire :* « Tu m'as encore battu. Je commence à croire que
> c'est toi qui devrais livrer les cadeaux. »

### Semaine 3 — La blessure

**Jour 13 — TROP VITE**
> *Lettre :* Tom, 7 ans, Bruxelles. « Est-ce que tu dors un peu, des
> fois ? »
>
> **Père Noël :** Non, il ne dort plus. Il court la nuit, s'entraîne le jour.
> Adjoa, la Mère Noël, l'a regardé partir ce soir sans rien dire.
>
> *Course :* 200 m.
>
> *Après la victoire :* « Encore une ! » Il repart sur la piste. Seul.

**Jour 14 — LE CLAQUEMENT**
> *Lettre :* Awa, 8 ans, Abidjan. « Fais attention à toi. »
>
> **Père Noël :** Au soixantième mètre, il y a eu un bruit sec, comme une
> branche qui casse sous la neige. Le Père Noël s'est tenu la cuisse. Il
> est resté à genoux sur la piste.
>
> *Course :* 100 m. Tu cours seul. À l'arrivée, il t'attend, assis, la jambe
> tendue.
>
> *Après la victoire :* « Bien couru, champion. » Il essaie de se lever.
> Il n'y arrive pas.

**Jour 15 — TROIS SEMAINES**
> *Lettre :* aucune. Ce matin, il n'a pas eu le courage d'ouvrir le courrier.
>
> **Mère Noël :** « Trois semaines de repos. Minimum. » Le Père Noël a
> regardé le calendrier. Il reste neuf jours. Il n'a rien dit.
>
> *Course :* 400 m. Tu cours pour lui, ce soir. Il te regarde depuis le banc.
>
> *Après la victoire :* Il applaudit. Doucement. « Neuf jours. Il faudra un
> miracle. »

**Jour 16 — LA VIDÉO**
> *Lettre :* une vidéo, envoyée par la petite Mei de Séoul. Elle court
> cent mètres dans la cour de son école. Elle crie à la fin : « C'est pour
> le Père Noël ! »
>
> **Père Noël :** Il l'a regardée dix fois.
>
> *Course :* 200 m.
>
> *Après la victoire :* « Une enfant court cent mètres pour moi. Et moi qui
> croyais que c'était l'inverse. »

**Jour 17 — DEUX MILLIARDS DE CENT MÈTRES**
> *Lettre :* des milliers. Les lutins n'arrivent plus à les trier. Des
> vidéos d'enfants qui courent. Lagos, Rio, Lille, Iqaluit, Kyoto. Tous
> crient la même chose.
>
> **Les lutins :** « Si chaque enfant court cent mètres en se passant le
> cadeau… deux milliards de relais… on fait le tour de la Terre cinq mille
> fois en une nuit. » Silence. « Ça marche. »
>
> *Course :* 100 m.
>
> *Après la victoire :* Le Père Noël rit, pour la première fois depuis
> trois jours. « Le plus grand relais de l'histoire. Et c'est eux qui l'ont
> inventé. »

**Jour 18 — LE PLAN**
> *Lettre :* Amadou, de Dakar, réécrit : « Je m'entraîne tous les jours.
> Je serai prêt. »
>
> **Père Noël :** Sur la grande carte du monde, les lutins plantent deux
> milliards d'épingles. Il en reste une, tout au bout, sans nom. « Le
> dernier relais. Le plus important. C'est le tien. »
>
> *Course :* 400 m.
>
> *Après la victoire :* « Toi, tu cours la fin. Moi, je cours le début,
> avec ma jambe ou sans. »

### Semaine 4 — La nuit du relais

**Jour 19 — DEBOUT**
> *Lettre :* Noah, de Montréal : « Comète va mieux ? »
>
> **Père Noël :** Comète va moins bien. Mais lui, ce matin, s'est levé
> sans canne. Il a fait dix pas. Puis vingt. Puis il a trottiné jusqu'à
> l'étable.
>
> *Course :* 100 m. Il court à nouveau, à petite allure.
>
> *Après la victoire :* « Tu m'as battu, mais j'ai couru. Aujourd'hui, ça
> compte double. »

**Jour 20 — LES CLOCHES**
> *Lettre :* Davi, de Rio : « Toute ma rue va courir. Même ma grand-mère. »
>
> **Père Noël :** Les lutins ont accroché une cloche à chaque épingle de la
> carte. Quand un enfant s'inscrit au relais, sa cloche sonne. Ce soir,
> l'atelier entier carillonne.
>
> *Course :* 200 m.
>
> *Après la victoire :* « Écoute. Deux milliards de cloches. Comète a
> dressé une oreille. »

**Jour 21 — KOFI**
> *Lettre :* Kofi, 8 ans, hôpital pédiatrique d'Accra. « Je ne peux pas
> courir au relais. Mes jambes ne marchent pas. Est-ce que quelqu'un peut
> courir pour moi ? »
>
> **Père Noël :** Il a lu la lettre debout, puis il s'est assis. Puis il
> t'a regardé. « La dernière épingle de la carte. Elle a un nom,
> maintenant. »
>
> *Course :* 100 m. Le Père Noël n'est plus très loin de toi.
>
> *Après la victoire :* « Le dernier cadeau de la nuit, c'est pour Kofi.
> Et c'est toi qui le portes. »

**Jour 22 — LA VEILLE DE LA VEILLE**
> *Lettre :* Lilou, de Marseille : « J'ai changé d'avis. Je veux un cadeau
> quand même. Pour Kofi. »
>
> **Père Noël :** Le paquet de Lilou est arrivé à l'atelier. Une petite
> paire de baskets rouges, taille 30.
>
> *Course :* 200 m.
>
> *Après la victoire :* « Des baskets pour un garçon qui ne marche pas.
> Lilou a tout compris à Noël avant nous. »

**Jour 23 — LE DOSSARD**
> *Lettre :* Chidi, de Lagos : « Merci pour la photo. Je l'ai accrochée au
> mur. »
>
> **Père Noël :** Il détache le dossard rouge de son maillot, numéro 1, et
> l'épingle sur le tien. « Je l'ai porté toute ma vie. Demain soir, c'est
> toi le numéro 1. »
>
> *Course :* 400 m. Le Père Noël est guéri, et rapide.
>
> *Après la victoire :* « Avec ce dossard, personne ne m'avait jamais
> battu. Ça ne compte plus : il est à toi. »

**Jour 24 — LA NUIT DU RELAIS**
> *Lettre :* l'enveloppe sans nom, celle du 1er décembre. Le Père Noël
> l'ouvre enfin. C'est ton écriture, à sept ans : « Cher Père Noël, je
> voudrais courir aussi vite que toi. Une fois. »
>
> **Père Noël :** « Je l'ai gardée. C'est pour ça que les lutins t'ont
> trouvé. Ce soir, on vérifie. »
>
> *Course :* 400 m, contre le Père Noël au sommet de sa forme. La course de
> sa vie, et de la tienne.
>
> *Après la victoire :* voir l'épilogue.

---

## Épilogue — le matin du 25

> Toute la nuit, la Terre a couru. Deux milliards d'enfants, cent mètres
> chacun, un cadeau passé de main en main d'un fuseau à l'autre.
>
> À trois heures du matin, le relais est arrivé à Accra. Une infirmière t'a
> tendu le dernier paquet. Au bout du couloir de l'hôpital, cent mètres de
> lino, un petit garçon dans un fauteuil roulant.
>
> Tu as couru. Les infirmières applaudissaient. Derrière toi, en boitant à
> peine, un grand homme en rouge courait aussi.
>
> Kofi a ouvert le paquet : des baskets rouges, taille 30. Il a ri. Ce rire
> a traversé les fenêtres, la ville, l'océan, jusqu'au Pôle.
>
> Dans l'étable, Comète s'est levée.
>
> À l'aube, huit rennes ont traversé le ciel d'Accra pour ramener le Père
> Noël chez lui. Avant de monter, il t'a serré la main, longtemps.
>
> « Sur cent mètres, personne ne m'avait jamais battu. Merci de l'avoir
> fait. Rendez-vous l'an prochain, numéro 1. »
>
> **Joyeux Noël.**

---

## Les défaites — ce que dit le Père Noël quand tu perds

Tirées sans répétition. Il ne se moque jamais méchamment : il te pousse.

1. « Ho ho ho ! Le vieux t'a eu. Demain, je ne serai pas aussi gentil. »
2. « Tu as couru comme un bonhomme de neige. Fondu à mi-course. On recommence. »
3. « Deux milliards d'enfants comptent sur nous, et tu me laisses gagner ? Debout. »
4. « Pas mal. Pour un lutin. »
5. « Je t'ai entendu souffler derrière moi. C'est bien : ça veut dire que tu étais près. »
6. « Les rennes rient dans leur étable. Ne les laisse pas rire deux fois. »

---

## Ce que cette histoire demande au jeu

Rien n'est construit pour elle. Le calendrier en place (`src/game/avent.ts`,
`src/components/screens/Avent.tsx`) peut la porter avec trois changements :

1. **La lettre avant la course.** Dans le détail d'une case, la lettre et le
   mot du Père Noël remplacent l'accroche. Le chapitre après la victoire
   devient la réplique du Père Noël.
2. **Courir contre lui.** Le chrono à battre devient celui du Père Noël,
   affiché comme un adversaire (son nom et son temps), et le Père Noël du
   couloir 1 court à ce temps-là. Il faut une trace ou un réglage de vitesse
   pour lui.
3. **Les jours 14 à 18**, où il est blessé : il n'est pas au départ, tu cours
   seul contre son ancien chrono.

Les vingt-quatre chronos sont à mesurer au harnais, comme ceux du calendrier
actuel.
