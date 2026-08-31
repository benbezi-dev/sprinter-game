# Sprinter — prise en main

Jeu d'athlétisme arcade bilingue (FR/EN) et son backend. Deux moitiés
indépendantes qui se déploient séparément :

| Dossier    | Quoi                          | Où ça tourne              |
|------------|-------------------------------|---------------------------|
| `src/`     | Le jeu (React + TypeScript)   | GitHub Pages              |
| `worker/`  | Classement, défis, salles     | Cloudflare Worker + D1    |
| `tools/`   | Tests, en Node pur            | En local                  |

## Démarrer

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck    # tsc --noEmit, sans build
```

Le backend, depuis `worker/` :

```bash
cd worker && npm install
npx wrangler dev --local     # Miniflare, aucun compte Cloudflare requis
```

Les tests sont des scripts Node autonomes, sans lanceur ni dépendance :

```bash
node tools/classement-test.mjs
```

## Les secrets du Worker

C'est l'endroit où l'on se trompe le plus souvent, alors la règle d'abord.

**`wrangler secret put` prend le NOM en argument. La VALEUR se tape à
l'invite, jamais sur la ligne de commande.**

```
npx wrangler secret put ADMIN_CLE     ← le NOM, fixe
   ✔ Enter a secret value: …          ← la VALEUR, tapée ici
```

Coller la clé en argument crée un secret dont le *nom* est la clé — elle
apparaît alors en clair dans `wrangler secret list`, dans l'historique du
shell et dans les journaux. Si ça arrive : `npx wrangler secret delete "<le
nom>"`, puis on considère la clé comme perdue et on en génère une autre.

Les noms en usage :

| Nom           | Lu par                        | Rôle                              |
|---------------|-------------------------------|-----------------------------------|
| `ADMIN_CLE`   | `worker/src/acces.js`         | En-tête `X-Sprinter-Admin` sur `/test/admin/*` |
| `TABLEAU_CLE` | *rien à ce jour*              | Prévu pour `/stats` — voir plus bas |

Sans `ADMIN_CLE` posée, `estAdmin()` renvoie `false` et l'administration
répond 403 : fermée par défaut plutôt qu'ouverte par oubli.

**Point ouvert :** `TABLEAU_CLE` existe côté Cloudflare mais aucune ligne du
Worker ne la lit. La route `/stats` (`worker/src/index.js`) n'a aucun contrôle
d'accès. Poser le secret ne protège donc rien aujourd'hui — à brancher, ou à
supprimer si ces chiffres n'ont pas à être protégés.

### Fabriquer une clé

```bash
openssl rand -base64 24 | tr -d '\n' | pbcopy   # macOS : dans le presse-papier
npx wrangler secret put TABLEAU_CLE             # Cmd+V à l'invite
```

Passer par le presse-papier évite que la clé s'affiche à l'écran. Une clé qui
a été lue — terminal, capture, message, conversation — n'est plus une clé :
on en génère une autre. `secret put` sur un nom existant écrase la valeur, il
n'y a pas besoin de supprimer d'abord, et l'effet est immédiat sans
redéploiement.

### Toujours lancer wrangler depuis `worker/`

```bash
cd worker && npx wrangler ...
```

Depuis ailleurs, `npx` télécharge la dernière version au vol (4.x) au lieu
d'utiliser celle du projet (3.114, épinglée dans `worker/package.json`). La
bannière au démarrage indique laquelle tourne — vérifiez-la en cas de
comportement inattendu.

## Deux canaux, un seul déploiement

`VITE_CANAL=test` au build produit la version de test, publiée sous
`/sprinter-game/test/`. Elle ouvre tout ce qui n'est pas encore public ; en
production, la même variable absente fait *disparaître du build* ce qui n'est
pas ouvert (`src/game/canal.ts`). Le workflow construit les deux à chaque
push sur `main` et réécrit le manifeste de la version de test, pour qu'elle
ne revendique pas l'identité de l'application réelle.

Côté Worker, le canal de test a sa propre base D1 (`DB_TEST`) : deux bases
plutôt qu'une colonne, parce qu'un seul filtre oublié suffirait à faire
remonter une partie de test au classement réel.

## Déployer

- **Le jeu** : automatique, `.github/workflows/deploy.yml` à chaque push sur `main`.
- **Le Worker** : manuel, `cd worker && npx wrangler deploy`.

`npx wrangler login` ouvre le navigateur et vaut environ 24 h. Sur une machine
sans navigateur, un jeton API Cloudflare (« Edit Cloudflare Workers » + D1)
dans `CLOUDFLARE_API_TOKEN` n'expire pas.

## Trois règles à ne pas casser

1. **Le meilleur chrono sur une course ne redescend jamais.** `best_split_ms`
   prend le minimum entre l'ancien et le nouveau, même si le parcours complet
   est plus lent. Un `ON CONFLICT ... SET best_split_ms = excluded...` sans ce
   minimum écrase un record — le bug a déjà eu lieu.
2. **Les lignes à `best_split_ms = 0` sont exclues du classement.** Elles
   datent d'avant la mesure par course ; sans exclusion elles prendraient la
   première place avec un 0,00 s.
3. **Aucun secret dans le dépôt.** Les clés vivent dans les secrets
   Cloudflare. `.env.test` ne contient qu'un nom de canal, rien de sensible.

## Conventions

Le code et les commentaires sont en français. Les commentaires expliquent
*pourquoi*, souvent en racontant le bug qui a mené à la règle — c'est
délibéré, et ça vaut la peine d'être lu avant de modifier une règle qui
semble arbitraire.
