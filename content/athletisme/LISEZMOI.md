# Le calendrier de l'athlétisme réel

Le tableau de bord avait un calendrier : **celui de nos publications**. Il ne
disait rien de ce qui se court pendant ce temps-là sur les vraies pistes. C'est
ce trou que ce dossier remplit — la liste des compétitions de World Athletics,
d'European Athletics et de la FFA, avec pour chacune ce qu'elle vaut pour un
compte qui parle de sprint.

## Les trois fichiers

| Fichier | Ce qu'il est |
|---|---|
| `content/athletisme/calendrier.mjs` | **La source de vérité.** Les dates, les lieux, les sources, les trous connus. C'est le seul fichier qu'on modifie à la main. |
| `tools/calendrier-athletisme.mjs` | Ce qui en sort : la page du tableau de bord, la fiche Markdown, le rappel au terminal. |
| `tools/calendrier-athletisme-test.mjs` | Ce qui vérifie la liste. À lancer après chaque ajout. |

`calendrier-athletisme.md`, à côté, est **fabriqué** : il se refait, on ne
l'édite pas.

## S'en servir

```sh
node tools/calendrier-athletisme.mjs          # les prochains rendez-vous, au terminal
npm run calendrier                            # la page + la fiche, refaites toutes les deux
node tools/calendrier-athletisme-test.mjs     # la liste, vérifiée
```

`npm run calendrier` pose `suivi/calendrier-athletisme.html` juste à côté de
`suivi/calendrier-instagram.html`. Le tableau de bord sert ce dossier en
statique : la page est donc visible **sans rien changer au tableau** —
`npm run tableau`, puis <http://localhost:4178/calendrier-athletisme.html>.

Pour lui donner son propre onglet entre « Calendrier » et « Championnats », il
faut ajouter un lien dans la barre du tableau, qui vit sur le Mac : `suivi/`
n'est pas dans le dépôt (voir `.gitignore` — le dépôt est public, le suivi ne
l'est pas). Le tableau peut aussi importer la page à chaud plutôt que le fichier
posé :

```js
import { rendreHTML } from '../tools/calendrier-athletisme.mjs';
// … puis servir rendreHTML() sur la route de l'onglet.
```

## Les trois règles de la liste

1. **Aucune date sans source.** Chaque entrée porte le lien d'où elle vient.
   Une date d'athlétisme se déplace, et sans la source on ne sait pas quoi
   relire pour le vérifier.
2. **Le doute se dit.** `statut: 'a-confirmer'` pour tout ce qui n'est pas tenu
   par une fédération ou un organisateur. La page l'affiche en clair : mélanger
   une date annoncée par un communiqué à un an et un mondial affiché par World
   Athletics, ce serait mentir par mise en page.
3. **Ce calendrier ne promet rien du jeu.** La charte est nette : on ne publie
   pas une date que le code ne tient pas (§5.3). Le championnat du jeu s'ouvre
   quand son moteur l'ouvre — jamais parce qu'un mondial tombe cette
   semaine-là. Le champ `jeu` de chaque entrée décrit une **fenêtre
   d'attention**, c'est-à-dire une matière. Jamais un rendez-vous.

## Ajouter une compétition

Une entrée dans `COMPETITIONS`, **rangée dans l'ordre du temps** (le test le
vérifie) :

```js
{
  cle: 'dl-paris-2027',                 // stable : c'est l'ancre dans la page
  nom: 'Wanda Diamond League — Paris',
  lieu: 'Paris', pays: 'France',
  debut: '2027-06-26', fin: '2027-06-26',   // ISO. Une journée : debut === fin
  rang: 'circuit',                      // mondial | continental | national | circuit
  salle: false,
  sprint: ['100', '200', '400'],        // vide si l'épreuve n'y court pas
  statut: 'a-confirmer',
  source: 'https://…',                  // obligatoire
  quoi: 'Une phrase, pour qui ne suit pas l’athlétisme.',
  jeu: 'Ce que ça vaut pour nous — une matière, pas une promesse.',
},
```

Puis `node tools/calendrier-athletisme-test.mjs`, puis `npm run calendrier`.

Un rendez-vous qu'on connaît **sans sa date** ne s'invente pas : il va dans
`TROUS`, que la page affiche sous le calendrier. Un trou écrit se comble ; un
trou tu ressemble à une absence de compétition.

## Le périmètre

Le sprint : 100, 200, 400 et les relais — les trois épreuves du jeu
(`worker/src/epreuves.js`). Les rendez-vous sans sprint (cross, route) n'entrent
ici que s'ils occupent tout l'espace médiatique : les savoir, c'est savoir qu'on
publierait dans le vide ce week-end-là. Ils portent `sprint: []` et la page les
marque « pas de sprint ».

## La fraîcheur

`FENETRE.releve` porte la date du dernier relevé. Passé six mois, la page
l'affiche d'elle-même en pied de page et demande de rouvrir les sources — à cet
âge-là, une date a forcément bougé quelque part. Le moment naturel pour reprendre
la liste : **l'automne**, quand la Diamond League publie son calendrier définitif
et que la FFA sort le sien.
