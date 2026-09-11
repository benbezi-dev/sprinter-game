#!/bin/zsh
set -e
# $SP = assets-stores/promo. `render.mjs` ecrit ses images dans
# source-video/frames ; les chemins d'avant pointaient vers un
# promo/frames et un promo/out qui n'ont jamais existe ici.
SP="$(cd "$(dirname "$0")/.." && pwd)"
FF="$SP/node_modules/ffmpeg-static/ffmpeg"
OUT="$SP/out"
mkdir -p "$OUT"
# master 9:16 — H.264 High, yuv420p, faststart (compatible Instagram / TikTok / YouTube Shorts)
"$FF" -y -loglevel error -framerate 30 -i "$SP/source-video/frames/f%05d.jpg" \
  -c:v libx264 -profile:v high -level 4.2 -pix_fmt yuv420p -preset slow -crf 18 \
  -x264-params "keyint=60:min-keyint=30:scenecut=0" -movflags +faststart \
  "$OUT/sprinter-nouveautes-1080x1920.mp4"
ls -lh "$OUT"
