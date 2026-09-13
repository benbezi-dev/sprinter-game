#!/bin/bash
# Rendu des icones d'interface : assets/icones-source/*.svg -> public/icons/*.png
#
# Les icones sont dessinees en vectoriel et rasterisees ici. On ne retouche
# jamais le PNG : on modifie le SVG et on relance ce script.
#
#   bash tools/icones-rendu.sh [taille]   (defaut 256)
#
# Le rasteriseur est Chrome en mode headless — celui que Puppeteer a
# telecharge, ou l'application Chrome installee. Pas de dependance a
# installer tant que l'un des deux est la.
set -euo pipefail
cd "$(dirname "$0")/.."

TAILLE="${1:-256}"
SRC="assets/icones-source"
OUT="public/icons"

CHROME=""
for c in "$HOME"/.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-mac-arm64/chrome-headless-shell \
         "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
  [ -x "$c" ] && CHROME="$c" && break
done
if [ -z "$CHROME" ]; then
  echo "Aucun Chrome trouve pour rasteriser (ni puppeteer, ni /Applications)." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for svg in "$SRC"/*.svg; do
  nom="$(basename "$svg" .svg)"
  { echo "<style>html,body{margin:0;padding:0;background:transparent}"
    echo "svg{display:block;width:${TAILLE}px;height:${TAILLE}px}</style>"
    cat "$svg"
  } > "$TMP/$nom.html"

  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --default-background-color=00000000 --force-device-scale-factor=1 \
    --window-size="$TAILLE,$TAILLE" \
    --screenshot="$TMP/$nom.png" "$TMP/$nom.html" >/dev/null 2>&1

  [ -s "$TMP/$nom.png" ] || { echo "echec du rendu : $nom" >&2; exit 1; }
  cp "$TMP/$nom.png" "$OUT/$nom.png"
  printf '  %-14s %s\n' "$nom.png" "$(du -h "$OUT/$nom.png" | cut -f1)"
done
echo "Rendu ${TAILLE}x${TAILLE} termine dans $OUT/"
