# Sprinter

Jeu d'athlétisme arcade bilingue (FR/EN) — 100 m et 200 m, six étapes, de la rencontre scolaire à la finale intergalactique. Alternez deux touches (flèches gauche/droite) ou les deux zones tactiles pour sprinter.

Bilingual (FR/EN) arcade sprinting game — 100 m and 200 m, six stages. Alternate two keys (left/right arrows) or the two touch zones to sprint.

## Lancer en local / Run locally

```bash
npm install
npm run dev
```

Puis ouvrez http://localhost:5173

## Build de production / Production build

```bash
npm run build      # génère le site statique dans dist/
npm run preview    # prévisualise le build
```

## Héberger sur GitHub Pages

1. Créez un dépôt GitHub et poussez ce code sur la branche `main`.
2. Dans le dépôt : **Settings → Pages → Source → GitHub Actions**.
3. Le workflow fourni (`.github/workflows/deploy.yml`) construit et publie automatiquement le jeu à chaque push sur `main`. Il définit `BASE_PATH` sur `/<nom-du-repo>/` automatiquement.

Le jeu sera disponible sur `https://<votre-utilisateur>.github.io/<nom-du-repo>/`.

## Contrôles / Controls

- **Flèches gauche/droite** (ou zones tactiles) : courir en alternant
- **L** : changer de langue FR/EN
- Bouton son : couper/activer la musique

## Structure

- `src/game/` — moteur du jeu (physique, rendu low-poly, audio procédural, i18n)
- `src/components/` — interface React (écrans, HUD, contrôles tactiles)
- `public/` — icônes de l'application
- `worker/` — l'API (classements, duels, championnats) sur Cloudflare Workers
- `tools/` — harnais de test et outillage interne, hors du site publié

### L'atelier de publication

`tools/reseaux.html` prépare ce qui part sur les comptes du jeu : le worker
signale ses moments (un record en tête, un titre, un classement qui se
resserre), l'atelier les dessine aux trois formats et tient le registre de ce
qui est sorti. Il ne publie rien lui-même — c'est un second geste, humain.

```bash
npm run atelier    # puis http://localhost:4178/reseaux.html
```

Il lit une route fermée par `ADMIN_CLE` : la clé est demandée à l'ouverture et
reste dans le navigateur. Le build de production ne l'embarque pas.
