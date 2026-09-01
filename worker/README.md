# Backend Sprinter — Cloudflare Worker + D1

Classement mondial TOP 500 et défis différés. Déployé sur
`https://sprinter-leaderboard.benbezi-sprinter.workers.dev`.

Ce dossier vit dans le dépôt volontairement : la source a été perdue trois
fois quand elle n'existait que dans un dossier temporaire.

## Déployer

Depuis ce dossier :

```bash
npm install
npx wrangler login
npx wrangler deploy
```

`wrangler login` ouvre le navigateur et n'est à refaire que lorsque la session
expire (le jeton OAuth dure environ 24 h).

Pour une machine qui ne peut pas ouvrir de navigateur, créer un jeton API
depuis le tableau de bord Cloudflare (« Edit Cloudflare Workers », plus la
permission D1) et l'exposer dans l'environnement — il n'expire pas :

```bash
export CLOUDFLARE_API_TOKEN=...
npx wrangler deploy
```

## Essayer en local, sans compte Cloudflare

```bash
npx wrangler dev --local
```

Miniflare démarre une base D1 locale. Créer le schéma une première fois :

```bash
npx wrangler d1 execute sprinter-leaderboard --local --command "
CREATE TABLE IF NOT EXISTS scores (
  device_id TEXT NOT NULL, race_key TEXT NOT NULL, name TEXT NOT NULL,
  time_ms INTEGER NOT NULL, best_split_ms INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL, UNIQUE(device_id, race_key));"
```

Les tables des défis et les colonnes du fantôme sont créées toutes seules au
premier appel (voir `ensureChallengeTables` et `ensureScoreGhost`).

## Points d'entrée

| Méthode | Chemin                | Rôle |
|---------|-----------------------|------|
| GET     | `/leaderboard?race=`  | TOP 500, trié sur le meilleur chrono d'une course |
| POST    | `/submit`             | Enregistre un parcours, renvoie le rang |
| GET     | `/rank?race=&device_id=` | Rang de cet appareil |
| GET     | `/ghost?id=`          | Trace fantôme d'une ligne du classement |
| POST    | `/challenge`          | Crée un défi, renvoie un code court |
| GET     | `/challenge?id=`      | Lit un défi et ses tentatives |
| POST    | `/challenge/attempt`  | Enregistre une tentative |
| POST    | `/claim`              | Réserve un nom, renvoie son code de récupération |
| POST    | `/link`               | Relie cet appareil à un nom, code à l'appui |
| POST    | `/transfert/nouveau`  | Depuis un appareil relié : un jeton de liaison |
| POST    | `/transfert/utiliser` | Depuis le nouvel appareil : consomme le jeton |
| POST    | `/recuperation`       | Dépose une demande de récupération de code |
| GET     | `/recuperation?device_id=&name=` | Où en est ma demande |
| GET     | `/recuperations`      | La file — clé d'administration |
| POST    | `/recuperation/trancher` | Accepte ou refuse — clé d'administration |

## Retrouver son nom

`identite.js` porte les deux chemins, et ils ne répondent pas à la même
question. Le **transfert** vaut pour « j'ai un appareil qui me connaît
déjà » : cet appareil tire un jeton, le jeu l'affiche en QR code, le
téléphone le vise, et la liaison se fait sans rien retaper. Le jeton vit dix
minutes et ne sert qu'une fois ; le code permanent, lui, ne traverse jamais
une URL.

La **récupération** vaut pour « je n'ai plus rien », et elle ne peut pas se
résoudre toute seule : sans e-mail ni mot de passe, aucune vérification
automatique ne distingue le propriétaire d'un nom de quelqu'un qui le
convoite — le chrono, le rang et le pseudo Instagram sont tous affichés au
TOP 500. La demande est donc déposée, et tranchée à la main depuis le tableau
de bord.

Quand un compte Instagram est lié au nom, la décision cesse d'être une
impression. Le serveur tire un mot de passage ; le joueur l'envoie en message
privé à **@sprintergame** *depuis ce compte* ; celui qui tranche voit les deux
choses ensemble — le message vient bien de ce compte-là, et il porte bien ce
mot-là. Écrire depuis un compte est la seule chose que son titulaire seul
puisse faire, et c'est ce qui fait la preuve. Déclarer un pseudo, lui, ne
prouve rien.

## Deux règles à ne pas casser

**Le meilleur chrono sur une course ne redescend jamais.** Il survit à un
parcours au total plus lent : `bestSplit` prend toujours le minimum entre
l'ancien et le nouveau. Un `ON CONFLICT ... SET best_split_ms = excluded...`
sans ce minimum écrase un meilleur temps — le bug a déjà eu lieu.

**Les lignes à `best_split_ms = 0` sont exclues du classement.** Elles datent
d'avant la mesure du chrono par course ; sans exclusion elles prendraient la
première place avec un 0,00 s.
