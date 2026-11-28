# La Trêve des Quatre Clans — l'histoire de Noël 2026

L'histoire de l'événement de Noël par équipes (`worker/src/noel-equipes.js`,
`src/components/screens/NoelEquipes.tsx`). Elle remplace « La Course de
l'Étoile » comme histoire publique de Noël. Le calendrier de l'Avent
(`docs/NOEL_HISTOIRE.md`) reste sur le canal de test.

Les données (clans, légende, moments, bannières) sont dans
`src/game/noel-clans.ts`, en français et en anglais.

---

## L'idée en une phrase

**Comme la trêve olympique de la Grèce antique, mais en hiver :** quatre clans
qui se faisaient la guerre ont remplacé leurs armes par des courses, et le clan
vainqueur gagne le droit d'allumer l'Étoile la nuit de Noël… et le devoir d'en
**donner** la flamme aux trois autres.

C'est l'esprit de Noël au cœur de la compétition : on ne gagne pas pour
écraser les autres, on gagne pour avoir le droit de partager.

---

## La légende

> Il y a mille hivers, le Grand Nord appartenait à quatre clans. Les Braises,
> forgerons du feu. Les Sapins, enfants de la forêt. Les Étoiles, guides du
> ciel. Les Givres, peuple du bout du monde. Et chaque hiver, ils se faisaient
> la guerre pour le dernier feu.
>
> Une année, la guerre dura jusqu'à la nuit la plus longue. Il ne restait à
> chaque clan qu'une seule braise, et les enfants avaient froid. Chaque clan
> envoya son coureur le plus rapide voler le feu des autres. Les quatre
> coureurs se trouvèrent face à face, sur le lac gelé.
>
> Quatre braises, presque mortes. Seule, chacune allait s'éteindre. Alors ils
> les posèrent ensemble sur la glace, et le feu prit. Ils restèrent assis
> autour jusqu'à l'aube, sans un mot. Un vieil homme à barbe blanche, vêtu de
> rouge, veillait avec eux.
>
> Au matin, il leur dit : « Plus de guerre en hiver. De la première neige
> jusqu'à Noël, vos clans s'affronteront en courant. Le plus rapide allumera
> l'Étoile la nuit de Noël, et son honneur sera d'en donner la flamme aux trois
> autres. »
>
> Il découpa quatre bannières et cousit dans chacune un fil de son manteau
> rouge. Ce jour-là, les clans s'échangèrent leurs enfants : chacun grandirait
> dans un clan qui n'était pas le sien, pour que plus jamais personne ne puisse
> haïr l'autre.
>
> Depuis, chaque décembre, la Trêve revient. Les clans élisent leurs
> champions. La neige tire au sort leurs coureurs. On ne gagne pas Noël en
> écrasant les autres. On le gagne pour avoir le droit de partager le feu.

Le vieil homme en rouge, c'est le Père Noël, le sprinteur noir du Village de
l'Étoile : le Gardien de la Trêve.

---

## Les quatre clans

| | Les Braises | Les Sapins | Les Étoiles | Les Givres |
|---|---|---|---|---|
| Équipe serveur | 0 (Rouge) | 1 (Vert) | 2 (Or) | 3 (Glace) |
| Emblème | la flamme | le sapin | l'étoile | le flocon |
| Devise | « Le feu ne recule pas. » | « Toujours debout, toujours vert. » | « Nous montrons le chemin. » | « Le froid nous rend vifs. » |
| Le champion (chef) | Porte-Flamme | Gardien de la Forêt | Guide | Lame de Givre |
| Ce qu'il apporte | Les forgerons du foyer : ils partent les premiers et ne s'éteignent jamais. | Les enfants de la forêt : en plein hiver, ils ne perdent pas une aiguille. | Les guides du ciel : ils ont mené les voyageurs perdus à travers la neige. | Le peuple du bout du monde : silencieux, et rapides comme le vent polaire. |
| Le cri | « Braises, debout ! » | « Sapins, tenez ! » | « Étoiles, en avant ! » | « Givres, sur le vent ! » |

### Les bannières

Une bannière par clan, dessinée en SVG (`svgBanniere` dans
`src/game/noel-clans.ts`) : une hampe dorée, un étendard à deux pointes aux
couleurs du clan, l'emblème dans un médaillon, le nom du clan.

**Le fil rouge** en bas de chaque bannière est le même sur les quatre : c'est
le fil du manteau du Gardien. Il rappelle, d'un coup d'œil, que les quatre
clans viennent de la même Trêve.

Les fichiers sont dans `public/noel/bannieres/` (`braises.svg`, `sapins.svg`,
`etoiles.svg`, `givres.svg`, et leurs versions anglaises `-en.svg`), prêts pour
les réseaux. `node tools/noel-bannieres.mjs` les régénère depuis le code.

---

## Chaque règle a son récit

Les règles du serveur ne changent pas. Seule la façon de les dire change.

| Ce que fait le serveur | Ce que raconte l'histoire |
|---|---|
| Avant le 7/12 | **La Trêve des Quatre Clans** : la première neige tombe, les clans attendent. |
| Vote des 4 chefs parmi les 8 premiers du 60 m (7–9/12) | **L'Appel des Champions** : les plus rapides se présentent, le peuple élit un champion par clan. |
| Départage au 200 m en salle (9/12) | **Le Duel des Prétendants**. |
| Le joueur rejoint l'équipe la moins nombreuse | **Le Tirage de la Neige** : on ne choisit pas son clan, la neige le choisit, comme au premier jour de la Trêve où les clans s'échangèrent leurs enfants. |
| Manche 1 (10–15/12) | **Le Feu des Premières Neiges**. |
| L'équipe la plus faible est éliminée, ses joueurs répartis | **Un clan éteint sa torche** : son feu passe dans les trois autres foyers. |
| Manche 2 (15–22/12) | **La Longue Nuit**. |
| Pause du championnat de France (19–21/12) | **La Trêve du Solstice** : la nuit la plus longue, comme sur le lac gelé, plus personne ne court. |
| Finale (22–25/12) | **La Course de l'Étoile**. |
| Vainqueur | **L'Étoile s'allume** : le clan vainqueur partage la flamme. |
| Meilleur chrono du jour = points FFA pour l'équipe | **L'offrande** : ton meilleur chrono du jour est offert à ton clan. |
| Battre le fantôme d'un adversaire / défense | **Les duels de champions** ; même absent, ton ombre défend ton clan. |

---

## Ce qui est fait dans le jeu

Dans `NoelEquipes.tsx` :

- **La bannière d'accueil** montre les quatre bannières qui flottent, et le
  titre du moment.
- **L'écran** s'appelle « La Trêve des Quatre Clans ». En tête, les quatre
  bannières avec leur devise et le nom de leur champion ; celles des clans
  éteints passent en gris.
- **La légende** se lit page à page ; elle s'ouvre d'elle-même à la première
  visite, puis reste à un bouton.
- **Le moment** du calendrier est raconté en une ligne.
- **Les cartes de clan** portent la bannière, le nom du clan, le champion, le
  score et l'effectif.
- **« La neige t'a choisi »** : une carte pour ton clan, avec sa vertu et son
  cri. Le bouton pour rejoindre devient « La neige choisit mon clan ».
- **Le fil** raconte les éliminations (« Les Braises éteignent leur torche… »)
  et la victoire (« Les Sapins allument l'Étoile… »).
- **Le calendrier** porte les noms de l'histoire.

## Ce qui n'est pas fait

- **Choisir son clan.** Tu as demandé une histoire qui donne envie de
  *choisir* un clan. Le serveur, lui, place chaque nouvel arrivant dans
  l'équipe la moins nombreuse, pour garder des effectifs proches. L'histoire en
  fait un rite (le Tirage de la Neige), mais on ne choisit pas. Laisser le
  choix demanderait de changer la règle du serveur, par exemple un choix
  plafonné (« ce clan est complet, la neige t'envoie ailleurs »).
- Les noms des clans ne vivent que dans le jeu : le serveur garde ses équipes
  numérotées, et les notifications éventuelles disent encore « équipe ».
- Pas de traduction des textes du serveur (messages d'erreur).
