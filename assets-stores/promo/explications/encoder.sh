#!/bin/zsh
# Encode les films d'explication rendus par `node rendu.mjs film`.
#   ./encoder.sh                 tous les films dont les images existent
#   ./encoder.sh 03-relais-4x100 un seul
#
# Meme reglage que la video « nouveautes » : H.264 High / yuv420p / faststart,
# lisible tel quel par Instagram, TikTok et YouTube Shorts. Muet : la musique se
# pose au montage.
set -e
ICI="$(cd "$(dirname "$0")" && pwd)"
# ffmpeg vit desormais dans l'outillage promo, et non plus a la racine du
# jeu : la CI de sprinter-game.com n'a aucune raison de le telecharger.
FF="$ICI/../node_modules/ffmpeg-static/ffmpeg"
OUT="$ICI/videos"
mkdir -p "$OUT"

films=("$@")
if [[ ${#films[@]} -eq 0 ]]; then
  films=("${(@f)$(ls "$ICI/images")}")
fi

for f in $films; do
  src="$ICI/images/$f"
  [[ -d "$src" ]] || { echo "✗ $f : aucune image (lance d'abord : node rendu.mjs film $f)"; continue; }
  "$FF" -y -loglevel error -framerate 30 -i "$src/f%05d.jpg" \
    -c:v libx264 -profile:v high -level 4.2 -pix_fmt yuv420p -preset slow -crf 18 \
    -x264-params "keyint=60:min-keyint=30:scenecut=0" -movflags +faststart \
    "$OUT/sprinter-$f.mp4"
  echo "✓ $OUT/sprinter-$f.mp4"
done
ls -lh "$OUT"
