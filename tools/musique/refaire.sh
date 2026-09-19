#!/bin/bash
# LA NUIT DU MOLOSSE — refaire le morceau, de la partition au mp3 du jeu.
#
#   ./refaire.sh
#
# Trois outils s'enchainent, et aucun n'est une station de travail :
#
#   1. molosse-partition.py  ecrit le MIDI. C'est la que vivent les notes.
#   2. molosse-rendu.swift   le joue avec le synthetiseur General MIDI de
#                            macOS, hors ligne, et rend un WAV.
#   3. ffmpeg                masterise, decoupe la boucle et encode.
#
# POURQUOI TROIS TOURS PUIS UN DECOUPAGE. Un morceau rendu une seule fois se
# termine sur une queue de reverberation et des cloches qui sonnent encore :
# recolle bout a bout, il ferait entendre un blanc puis une attaque seche a
# chaque tour. On en rend donc trois et l'on garde celui du milieu — il a des
# voisins des deux cotes, et le raccord porte ce qu'il doit porter.
#
# POURQUOI MASTERISER AVANT DE DECOUPER. Les filtres de ffmpeg introduisent
# une latence, qui laissait cinquante millisecondes de silence a la fin du
# morceau decoupe. Masteriser les trois tours d'abord, couper ensuite :
# la latence est absorbee au milieu du fichier, la ou personne ne l'entend.
#
# CE QUE CE SCRIPT NE FAIT PAS. Il ne produit qu'une MAQUETTE : le son est
# celui d'une banque General MIDI de 1998. Pour la version finale, on ouvre
# molosse.mid dans Logic Pro ou FL Studio, on prete de vrais instruments aux
# huit pistes — elles arrivent nommees — et l'on exporte par-dessus
# ../../src/assets/molosse.mp3. Aucune des deux stations n'expose de
# dictionnaire AppleScript : ce dernier pas se fait a la main, et c'est la
# seule raison d'etre de cette chaine.

set -euo pipefail
cd "$(dirname "$0")"

# 32 mesures de 4 temps a 152 a la noire. Ecrit en clair : c'est le nombre
# qui doit changer en meme temps que TEMPO_BPM ou MESURES dans la partition.
TOUR=$(python3 -c "print(32 * 4 * 60 / 152)")
TROIS=$(python3 -c "print(3 * $TOUR + 4)")

echo "1/4  la partition"
python3 molosse-partition.py        # molosse.mid, le livrable pour la station
python3 molosse-partition.py 3      # molosse-x3.mid, pour le rendu

echo "2/4  le rendu"
xcrun swiftc -O -o molosse-rendu molosse-rendu.swift
./molosse-rendu molosse-x3.mid molosse-brut.wav "$TROIS"

echo "3/4  le mastering"
# Le compresseur resserre, le limiteur protege la crete, `loudnorm` amene le
# tout a -12 LUFS : fort, mais avec assez de marge pour que le break creuse
# encore. Sans cette chaine, le morceau sortait a -23 dB de moyenne et se
# faisait couvrir par les pas du coureur.
ffmpeg -hide_banner -loglevel error -y -i molosse-brut.wav \
  -af "highpass=f=28,\
acompressor=threshold=-20dB:ratio=3:attack=8:release=140:makeup=4,\
alimiter=level_in=1:level_out=0.94:limit=0.94:attack=4:release=60,\
loudnorm=I=-12:TP=-1.2:LRA=9" \
  -ar 44100 -ac 2 molosse-master-long.wav

echo "4/4  la boucle, et le mp3"
ffmpeg -hide_banner -loglevel error -y -ss "$TOUR" -t "$TOUR" \
  -i molosse-master-long.wav -c copy molosse-master.wav
# 112 kbit/s : au-dessus, le gain ne s'entend pas sur un haut-parleur de
# telephone ; en dessous, les cymbales se mettent a siffler.
ffmpeg -hide_banner -loglevel error -y -i molosse-master.wav \
  -codec:a libmp3lame -b:a 112k ../../src/assets/molosse.mp3

echo
echo "fait : src/assets/molosse.mp3"
ls -lh ../../src/assets/molosse.mp3
python3 - <<'EOF'
import wave
w = wave.open('molosse-master.wav')
print('boucle : %.4f s' % (w.getnframes() / w.getframerate()))
EOF
