#!/bin/sh
# Le reel, encode depuis les images habillees et le son rendu hors ligne.
#
# Memes reglages que le film « nouveautes » du dossier promo — H.264 High,
# yuv420p, faststart — pour qu'Instagram, TikTok et YouTube Shorts avalent le
# fichier sans le reencoder deux fois. Le son est en AAC, la ou le film
# precedent etait muet : ici le son EST le sujet, c'est celui du jeu.
set -e
ICI="$(cd "$(dirname "$0")" && pwd)"
FF="${FF:-$ICI/../node_modules/ffmpeg-static/ffmpeg}"
"$FF" -y -loglevel error \
  -framerate 30 -i "$ICI/images-reel/f%05d.jpg" \
  -i "$ICI/son.wav" \
  -c:v libx264 -profile:v high -level 4.2 -pix_fmt yuv420p -preset slow -crf 18 \
  -x264-params "keyint=60:min-keyint=30:scenecut=0" \
  -c:a aac -b:a 160k -ar 48000 \
  -shortest -movflags +faststart \
  "$ICI/sprinter-reel-100m-1080x1920.mp4"
ls -lh "$ICI/sprinter-reel-100m-1080x1920.mp4"
