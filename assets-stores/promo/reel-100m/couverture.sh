#!/bin/sh
# La couverture, refabriquee depuis sa source.
#
# Pas de node_modules ici, a la difference des films : une image fixe n'a
# besoin ni de puppeteer ni de ffmpeg, seulement d'un Chromium et de son
# option --screenshot. Les drapeaux sont ceux des autres rendus du dossier,
# pour que la vignette sorte avec le meme rendu de texte que les films.
#
#   CHROME=/chemin/vers/chrome ./couverture.sh
#
# Les fontes (Outfit 800, Space Mono 700) sont chargees depuis Google Fonts :
# soit la machine a le reseau, soit elle a les fontes installees.
set -e
ICI="$(cd "$(dirname "$0")" && pwd)"
CHROME="${CHROME:-$(command -v chromium || command -v google-chrome || echo /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome)}"
"$CHROME" --headless --no-sandbox --disable-gpu \
  --hide-scrollbars --force-color-profile=srgb \
  --font-render-hinting=none --disable-lcd-text \
  --window-size=1080,1920 --virtual-time-budget=6000 \
  --screenshot="$ICI/couverture-1080x1920.png" \
  "file://$ICI/couverture.html"
ls -lh "$ICI/couverture-1080x1920.png"
