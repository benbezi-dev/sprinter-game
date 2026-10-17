#!/bin/bash
# Verse les consignes de l'auteur dans le contexte des sessions Claude Code sur
# le web, qui ne lisent pas ~/.claude/CLAUDE.md. En local ce fichier les donne
# deja : on ne les repete pas (un CLAUDE.md a la racine serait lu deux fois).
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cat "$CLAUDE_PROJECT_DIR/.claude/consignes-auteur.md"
