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

## Deux règles à ne pas casser

**Le meilleur chrono sur une course ne redescend jamais.** Il survit à un
parcours au total plus lent : `bestSplit` prend toujours le minimum entre
l'ancien et le nouveau. Un `ON CONFLICT ... SET best_split_ms = excluded...`
sans ce minimum écrase un meilleur temps — le bug a déjà eu lieu.

**Les lignes à `best_split_ms = 0` sont exclues du classement.** Elles datent
d'avant la mesure du chrono par course ; sans exclusion elles prendraient la
première place avec un 0,00 s.
