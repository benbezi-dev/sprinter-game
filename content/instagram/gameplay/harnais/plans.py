#!/usr/bin/env python3
"""
Compose les plans d'un reel : recadrage et poussee, image par image.

POURQUOI PIL PLUTOT QUE FFMPEG. La poussee demande une fenetre de cadrage qui
retrecit d'une image a l'autre. Or `crop` n'evalue sa largeur qu'UNE FOIS, a la
configuration du filtre — une fenetre qui bouge lui est impossible — et
`zoompan`, qui est cense le faire, rend ici une image reduite au tiers dans un
coin, quelle que soit la formule de x/y. PIL, lui, accepte une fenetre en
NOMBRES A VIRGULE (`resize(..., box=)`) : la poussee avance donc au sous-pixel,
sans le tremblement d'un arrondi a l'entier, et ce que l'on demande est ce que
l'on obtient.

C'est aussi la chaine que le depot connait deja : `suivi/teaser/composer.py`
compose ses plans de la meme facon, pour les memes raisons.

    python3 plans.py conducteur.json
"""
import json, sys
from pathlib import Path
from PIL import Image

L, H = 1080, 1920


def douceur(a):
    """Une poussee qui demarre et s'arrete sans a-coup (cosinus)."""
    import math
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, a)))


def composer(rush, sortie, plans, ips):
    rush, sortie = Path(rush), Path(sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    for vieux in sortie.glob('*.jpg'):
        vieux.unlink()
    k = 0
    for plan in plans:
        debut = round(plan['de'] * ips)
        n = max(1, round((plan['a'] - plan['de']) * ips))
        z0, z1 = plan.get('zoom', [1.0, 1.0])
        ax, ay = plan.get('ancre', [0.5, 0.5])
        for i in range(n):
            src = rush / f'f{debut + i:06d}.jpg'
            if not src.exists():
                break
            im = Image.open(src).convert('RGB')
            w, h = im.size
            z = z0 + (z1 - z0) * douceur(i / max(1, n - 1))
            # La fenetre garde le rapport 9:16 du cadre livre ; l'ancre dit ce
            # qu'on retient quand elle est plus petite que l'image.
            fw, fh = w / z, h / z
            gauche = (w - fw) * ax
            haut = (h - fh) * ay
            im.resize((L, H), Image.LANCZOS,
                      box=(gauche, haut, gauche + fw, haut + fh)) \
              .save(sortie / f'p{k:06d}.jpg', quality=95, subsampling=0)
            k += 1
    return k


if __name__ == '__main__':
    c = json.load(open(sys.argv[1]))
    n = composer(c['rush'], c['sortie'], c['plans'], c.get('ips', 30))
    print(json.dumps({'images': n, 'duree': round(n / c.get('ips', 30), 3)}))
