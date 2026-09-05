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
| POST    | `/push/subscribe`     | Enregistre un abonnement Web Push |
| POST    | `/push/unsubscribe`   | Oublie les abonnements web d'un appareil |
| POST    | `/push/natif/abonner`   | Enregistre un jeton Firebase (iOS, Android) |
| POST    | `/push/natif/desabonner` | Oublie les jetons d'un appareil |

## Les notifications

Deux transports, parce qu'une WebView n'a pas d'API Push et que le Web Push ne
franchit donc pas la porte des magasins : VAPID pour le navigateur, Firebase
Cloud Messaging pour l'application. Trois secrets les commandent —
`VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `FCM_COMPTE_SERVICE` — et chacun peut
manquer sans rien casser : le transport correspondant est saute, le reste
continue.

```bash
npx wrangler secret put FCM_COMPTE_SERVICE < le-compte-de-service.json
```

La mise en place complete — projet Firebase, cle APNs, capacite Xcode — est
dans [`docs/notifications.md`](../docs/notifications.md).

## L'alerte des récupérations de compte

Quand un joueur qui a perdu son code dépose une demande (`POST /recuperation`),
la boîte du jeu reçoit un mot : le nom, le mot de passage attendu, le compte
Instagram d'où le message doit venir, et ce que le joueur a dit de lui.

Sans ça, la demande n'existait que dans le tableau d'activité — et le tableau ne
s'ouvre que quand on pense à l'ouvrir.

```bash
npx wrangler secret put RESEND_CLE
```

C'est une clé [Resend](https://resend.com). Le domaine de l'expéditeur doit y
être vérifié (SPF/DKIM) ; `onboarding@resend.dev` fait l'affaire le temps d'un
essai. Deux variables facultatives, dans `wrangler.toml`, si l'on veut autre
chose que les valeurs par défaut :

| Variable          | Défaut                                        |
|-------------------|-----------------------------------------------|
| `MAIL_DEST`       | `contact@sprinter-game.com`                   |
| `MAIL_EXPEDITEUR` | `Sprinter <recuperations@sprinter-game.com>`  |

Trois choses que ce courriel ne fait pas, volontairement :

- **il ne part pas au joueur.** Le jeu ne connaît aucune adresse et n'en
  demandera pas : l'identité tient dans un nom et un code court, sans tiers ni
  e-mail (`src/identite.js`). Ce mot prévient l'arbitre, il ne remplace pas la
  preuve — qui reste le message envoyé *depuis* le compte Instagram lié ;
- **il ne part qu'une fois par demande.** Un appareil encore relié n'a rien à
  arbitrer, et un second appui sur le bouton rend le même mot de passage : ni
  l'un ni l'autre ne fait sonner la boîte. Le canal de test n'écrit jamais ;
- **il ne peut pas faire échouer une demande.** L'envoi part dans un
  `waitUntil` : sans clé, sur un refus de Resend ou sur une coupure, le joueur
  a quand même déposé sa demande. `wrangler tail` dit lequel des trois.

## Deux règles à ne pas casser

**Le meilleur chrono sur une course ne redescend jamais.** Il survit à un
parcours au total plus lent : `bestSplit` prend toujours le minimum entre
l'ancien et le nouveau. Un `ON CONFLICT ... SET best_split_ms = excluded...`
sans ce minimum écrase un meilleur temps — le bug a déjà eu lieu.

**Les lignes à `best_split_ms = 0` sont exclues du classement.** Elles datent
d'avant la mesure du chrono par course ; sans exclusion elles prendraient la
première place avec un 0,00 s.
