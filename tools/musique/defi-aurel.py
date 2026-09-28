#!/usr/bin/env python3
# LE DEFI AUREL MANGA — la musique de course, du calcul au mp3 du jeu.
#
#   python3 tools/musique/defi-aurel.py      (numpy et ffmpeg requis)
#
# C'est la musique du teaser « les haies sont ouvertes », que Benbezi a voulue
# dans Hurdlers pour le defi : meme batterie, meme basse, meme tempo (150 BPM),
# remise en BOUCLE pour tenir toute la course et l'avant-course.
#
# LA BOUCLE : seize mesures, 25,6 s.
#   1-8   le groove du teaser (la, la, do, sol), pleine batterie ;
#   9-12  on retire la basse deux mesures, puis elle revient avec les
#         charlestons ouverts — une respiration au milieu de la course ;
#   13-16 roulement de caisse claire et montee de bruit, qui retombent sur
#         l'impact du premier temps — c'est-a-dire le debut de la boucle.
#
# POURQUOI TROIS TOURS PUIS UN DECOUPAGE, comme pour le molosse (voir
# refaire.sh) : les queues de l'impact et du dernier coup de grosse caisse
# debordent sur la mesure suivante. On calcule trois tours d'affilee et l'on
# garde celui du milieu — son debut contient la fin du tour precedent, et le
# raccord ne s'entend pas.
#
# Pas de hasard : la graine est fixe, le fichier sort identique a chaque fois.

import os, subprocess, tempfile, wave
import numpy as np

SR = 44100
BPM = 150
B = 60 / BPM                  # un temps
MESURES = 16
BOUCLE = MESURES * 4 * B      # 25,6 s
TOURS = 3
N = int(round(SR * BOUCLE * TOURS))
out = np.zeros(N)
rng = np.random.default_rng(7)

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, '..', '..', 'public', 'vedettes', 'defi-aurel.mp3')


def add(sig, t, gain=1.0):
    i = int(t * SR)
    j = min(N, i + len(sig))
    if 0 <= i < N:
        out[i:j] += sig[: j - i] * gain


def env(n, a=0.002, d=0.2):
    t = np.arange(n) / SR
    e = np.exp(-t / d)
    na = int(a * SR)
    if na:
        e[:na] *= np.linspace(0, 1, na)
    return e


def kick(gros=False):
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 45 + 160 * np.exp(-t / 0.035)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.22 if gros else 0.14)
    s += 0.3 * rng.standard_normal(n) * env(n, 0.0005, 0.004)
    return np.tanh(s * 2.2)


def caisse():
    n = int(0.3 * SR); t = np.arange(n) / SR
    b = rng.standard_normal(n)
    b = b - np.convolve(b, np.ones(8) / 8, 'same')
    return b * env(n, 0.001, 0.09) * 0.7 + np.sin(2 * np.pi * 190 * t) * env(n, 0.001, 0.05) * 0.6


def charleston(ouvert=False):
    n = int(0.12 * SR)
    x = rng.standard_normal(n); x = np.diff(x, prepend=0); x = np.diff(x, prepend=0)
    return x * env(n, 0.0005, 0.05 if ouvert else 0.012) * 0.12


def basse(freq, duree):
    n = int(duree * SR); t = np.arange(n) / SR
    scie = 2 * ((t * freq) % 1) - 1
    scie += 0.5 * (2 * ((t * freq * 1.005) % 1) - 1)
    scie = np.convolve(scie, np.ones(18) / 18, 'same')
    e = np.minimum(1, t / 0.005) * np.exp(-t / 0.25)
    return np.tanh(scie * e * 1.6) * 0.5


def montee(duree):
    n = int(duree * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    y = np.zeros(n)
    for i in range(0, n, 512):
        w = int(60 + (2 - 60) * i / n)
        a = max(0, i - w)
        c = np.convolve(x[a:i + 512 + w], np.ones(w) / w, 'same')
        y[i:i + 512] = c[i - a:i - a + len(y[i:i + 512])]
    f = 200 * (2 ** (t / duree * 3.5))
    ton = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    return (y * 0.6 + ton) * (t / duree) ** 2


def impact():
    n = int(1.6 * SR); t = np.arange(n) / SR
    boum = np.sin(2 * np.pi * np.cumsum(30 + 90 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.6)
    crash = rng.standard_normal(n) * np.exp(-t / 0.5) * 0.35
    crash = crash - np.convolve(crash, np.ones(4) / 4, 'same')
    return np.tanh((boum * 1.4 + crash) * 1.5)


FONDAMENTALES = [55, 55, 65.4, 49]   # la, la, do, sol — une par mesure

for tour in range(TOURS):
    t0 = tour * BOUCLE
    add(impact(), t0, 0.55)
    for m in range(MESURES):
        racine = FONDAMENTALES[m % 4]
        for temps in range(4):
            t = t0 + (m * 4 + temps) * B
            add(kick(), t, 1.0)
            if temps % 2:
                add(caisse(), t, 0.75)
            for h in range(2):
                ouvert = (9 <= m < 12 and h == 1) or (h == 1 and temps == 3 and m % 2)
                add(charleston(ouvert), t + h * B / 2, 1.0)
            if not (8 <= m < 10):          # la respiration : pas de basse
                for e in range(2):
                    add(basse(racine * (2 if e else 1), B / 2), t + e * B / 2, 0.8)
    # Mesures 13-16 : la montee, puis le roulement sur la derniere mesure.
    add(montee(4 * 4 * B), t0 + 12 * 4 * B, 0.35)
    fin = t0 + 15 * 4 * B
    for d in range(16):
        add(caisse(), fin + d * B / 4, 0.25 + 0.035 * d)

# Le tour du milieu, masterise sur l'ensemble pour que le raccord soit juste.
out = np.tanh(out * 0.9)
out = out / np.max(np.abs(out)) * 0.89
a, b = int(round(SR * BOUCLE)), int(round(SR * BOUCLE * 2))
boucle = out[a:b]

with tempfile.TemporaryDirectory() as tmp:
    wav = os.path.join(tmp, 'defi-aurel.wav')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((boucle * 32767).astype(np.int16).tobytes())
    # Mono : les deux canaux seraient identiques. 112 kb/s suffit a une
    # batterie synthetique, et garde le fichier sous les 400 Ko.
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '112k',
                    os.path.abspath(SORTIE)], check=True)
print('ecrit', os.path.relpath(SORTIE), f'{BOUCLE:.1f} s')
