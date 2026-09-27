#!/bin/bash
# Installe les dependances au demarrage de chaque session Claude Code — sur le
# web comme sur l'ordinateur — pour que `npm run typecheck`, `npm run build` et
# les harnais de tools/ tournent sans preparation. Quand tout est deja la,
# `npm install` ne fait que verifier, en quelques secondes. Sur le web, le
# conteneur est mis en cache une fois le hook termine : `npm install` (et non
# `npm ci`) profite de ce cache.
#
# La sortie de npm part sur stderr : ce que le hook ecrit sur stdout est verse
# dans le contexte de la session, et un « added 352 packages » n'y apprend rien.
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Le jeu : vite, typescript, react...
npm install --no-audit --no-fund >&2

# Le worker : wrangler, pour `wrangler dev --local`, dont ont besoin les
# harnais qui parlent au vrai serveur (championnat, tchat rapide, relais...).
npm install --prefix worker --no-audit --no-fund >&2
