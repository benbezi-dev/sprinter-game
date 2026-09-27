#!/bin/bash
# Installe les dependances au demarrage d'une session Claude Code sur le web,
# pour que `npm run typecheck`, `npm run build` et les harnais de tools/
# tournent sans preparation. Le conteneur est mis en cache une fois le hook
# termine : `npm install` (et non `npm ci`) profite de ce cache.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Le jeu : vite, typescript, react...
npm install --no-audit --no-fund

# Le worker : wrangler, pour `wrangler dev --local`, dont ont besoin les
# harnais qui parlent au vrai serveur (championnat, tchat rapide, relais...).
npm install --prefix worker --no-audit --no-fund
