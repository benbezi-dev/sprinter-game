#!/bin/sh
# Recompresse en WebP qualite 80 les images d'un ou plusieurs dossiers de
# decor rendus par fabriquer.py.
#
#   tools/blender/decors/recompresser-webp.sh public/decors/halloween-a* public/decors-ultra/halloween-a*
#
# Blender ecrit ses WebP a sa propre compression (la qualite de la scene
# n'y change rien) : 158 Ko pour une maison de la ruelle du molosse. Passees
# par cwebp -q 80, 88 Ko, et la difference ne se voit pas sur des facades
# que le jeu assombrit pour la nuit. Il faut dwebp et cwebp (Homebrew : webp).
set -e
TMP=$(mktemp -d)
find "$@" -name '*.webp' | while read -r f; do
  t="$TMP/$(basename "$f").png"
  dwebp -quiet "$f" -o "$t"
  cwebp -quiet -q 80 -alpha_q 85 -m 6 "$t" -o "$f.neuf"
  mv "$f.neuf" "$f"
  rm -f "$t"
done
rmdir "$TMP"
