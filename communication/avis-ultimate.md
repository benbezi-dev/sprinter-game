# L'avis d'un créateur sur l'Ultimate Championship — ce que le jeu peut y répondre

Source : vidéo WhatsApp du 14/09/2026, 08h38. Transcrite en local
(Speech framework macOS, modèle fr-FR). Le texte intégral n'est pas archivé ici :
seuls les six points qu'il énonce le sont.

---

## 1 · La grille : ce qu'il reproche, ce que le jeu a déjà

| Ce qu'il reproche à Budapest | État dans Sprinter | Où |
|---|---|---|
| Pas de podium, pas de médailles | **existe** — écran Podium en fin d'édition, cérémonie de sacre | `src/components/screens/Championnat.tsx:342` |
| — | **existe** — médailles portées par l'athlète dans les classements | `src/components/Insignes.tsx:65` |
| Pas d'esprit pays | **existe** — nationalité posée une fois, drapeau, échelons national → continental → mondial | `src/game/identity.ts:445`, `src/game/championnats.ts:77` |
| Pas d'esprit d'équipe | **existe** — relais 4×100 : l'équipe EST sa composition, les quatre doivent accepter | `src/game/relais.ts` |
| Les lancers sacrifiés | **annoncé, pas jouable** — le monde THROWER est sur la carte avec ses 4 disciplines, `jouable: false` | `src/game/mondes.ts:97` |
| Épreuves hommes-seulement / femmes-seulement | **non traité** — le jeu n'a pas de catégorie de genre | — |
| Pas de mascotte, pas d'animation | **non traité** | — |

**Attention en communication :** les lancers et les sauts ne sont PAS jouables
aujourd'hui. `jouable: false` est un choix assumé du fichier (« une discipline
annoncée et injouable vaut mieux qu'une discipline cachée »), mais ça interdit
d'écrire « toutes les épreuves sont là ». Ce qu'on peut écrire : *« les lancers
sont sur la carte du jeu, pas au placard »*.

---

## 2 · Les six chantiers, par rapport rendu/coût

### A. Le tableau des médailles par nation — *le plus gros levier, le moins cher*
Son point 3 (« l'esprit d'équipe par pays, les clans dans les tribunes ») est
le seul de ses reproches auquel le jeu répond déjà à moitié : il a les pays, il
a les médailles, il n'a **pas** l'écran qui additionne les deux.

Un tableau `pays / or / argent / bronze`, alimenté par les podiums d'édition
déjà stockés côté worker. Aucun nouveau concept, aucun nouvel asset : une
requête d'agrégation et un écran. C'est exactement l'objet qui fait dire
« mon pays est 4e » — et c'est ce qui déclenche le partage.

Suite naturelle : l'athlète qui monte sur le podium fait **monter son drapeau**
dans ce tableau, et l'écran le lui montre.

### B. Les clans dans les tribunes — *rendre visible ce qui existe déjà*
La densité du public est déjà pilotée par étape (`CROWD_DENSITY`, de 0,25 à
1,00 — `src/game/sprinter-app.js:324`) et un motif de foule est tuilé
(`getCrowdPattern`). Il manque la couleur : teinter des **paquets** de gradins
aux couleurs du drapeau des finalistes plutôt qu'un public uniforme.

Le coût est faible parce que `crowdLo`/`crowdHi` sont déjà deux teintes par
stade : il s'agit d'en dériver des îlots, pas de repeindre le rendu.

### C. Les lancers, une discipline d'abord — *répondre frontalement au reproche n°1*
« Les sacrifiés c'est les lancers comme d'habitude » est la phrase qui revient
chez tous les commentateurs. Ouvrir **une** discipline de THROWER (le poids : un
seul geste, pas de course d'élan, pas de rotation à simuler) suffit à retourner
l'argument. Les trois autres restent `jouable: false`.

C'est le chantier le plus long des six. Ne pas le promettre avant de l'avoir.

### D. L'animation d'entre-deux-courses — *son point 4*
Il ne demande pas une mascotte, il demande qu'il se passe quelque chose entre
les courses. Le jeu a déjà de quoi remplir ce temps sans rien inventer : le
fil d'annonces du championnat (`championnats.ts`), la révélation du tenant du
titre, la cinématique de boss. Ce qui manque, c'est de les **jouer pendant
l'attente** plutôt qu'à la place de l'écran.

### E. Les sessions courtes — *son point fort n°2, à défendre*
C'est déjà la forme du jeu : une course dure une dizaine de secondes. Rien à
construire ; tout à dire en communication. C'est l'angle le plus honnête qu'on
ait sur lui.

### F. La DA — *son point fort n°3, à amplifier*
Il a aimé « l'herbe noire, le sable rose, la couleur des haies ». Le jeu a sept
thèmes de stade avec leurs propres teintes (`sprinter-app.js:21-216`) et une
couche de finition dédiée (`rendu-premium.js`). C'est le point sur lequel on
soutient la comparaison le mieux — et le plus facile à montrer en image.

**Ordre proposé : A → B → D → F → C.** E n'a pas de travail.

---

## 3 · Les réponses à poster

Comptes : Instagram **@SPRINTERGAME** · X **@SprinterGameFR** · TikTok **@sprinter_game**
Lien : **sprinter-game.com**

Règle qui vaut pour toutes : **on lui donne raison d'abord.** Il a fait une
critique construite, pas un tacle. Une réponse qui commence par « justement,
nous on… » se lit comme une pub et se fait scroller.

### 3.1 — Le commentaire sous sa vidéo (le principal)

> Le point sur les médailles, c'est exactement ce qu'on s'est dit en le
> développant. Un trophée au premier, ça termine une course ; un podium, ça
> termine un championnat. C'est pour ça qu'on a mis les trois marches et la
> cérémonie dans notre jeu — et les drapeaux, parce que sans le pays un
> classement n'est qu'une liste de chronos.
> Sur les lancers en revanche tu as raison partout, y compris chez nous : ils
> sont sur la carte du jeu, pas encore jouables. On s'y met.

*Pourquoi celle-là : elle valide deux de ses points, en revendique un, et
concède le troisième. La concession est ce qui la rend crédible — et c'est
vrai.*

### 3.2 — Variante courte (si tu commentes vite, ou sur TikTok)

> « On dirait un gros meeting » — c'est la phrase juste. Le podium et les
> drapeaux ne coûtent rien et changent tout. On les a mis dans notre jeu pour
> exactement cette raison.

### 3.3 — S'il te répond (la suite de conversation)

> Le truc qu'on n'a toujours pas résolu non plus, c'est le tien : l'esprit
> d'équipe par pays. On a les nationalités et les podiums, il nous manque le
> tableau qui les additionne. Ça arrive. Si tu veux jeter un œil avant :
> sprinter-game.com

*Ne poste ça que s'il a répondu. Posté d'office, c'est du spam.*

### 3.4 — Ton propre post, en rebond (à publier après, pas avant)

> Un créateur résume l'Ultimate Championship comme ça : ambiance énorme,
> sessions courtes, DA magnifique — mais pas de podium, pas de médaille, pas de
> pays, et les lancers encore sacrifiés.
> Les trois premiers reproches, on les avait déjà en tête : le podium, la
> cérémonie et le drapeau sont dans le jeu depuis le début.
> Le quatrième est pour nous aussi. Les lancers arrivent.
> sprinter-game.com

Images : `communication/riposte-danube/stade/` — `vertical-1080x1920-ligne.png`
pour la story, `insta-1080x1350-ligne.png` pour le fil. Le tiers bas est noir,
c'est là que va le texte.

### 3.5 — Ce qu'il ne faut PAS écrire

- « Toutes les épreuves sont jouables » → faux, lancers et sauts ne le sont pas.
- « On a une mascotte » → il n'y en a pas.
- « Classement par nation » → l'écran n'existe pas encore (chantier A).
- Toute réponse qui attaque la compétition. Il l'a défendue en conclusion
  (« ça fait du bien de voir l'athlé se renouveler ») : la taper, c'est le
  contredire lui.
