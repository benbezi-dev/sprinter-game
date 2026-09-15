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


def image_a(rush, pos):
    """L'image du rush a la position `pos`, qui peut tomber ENTRE deux images.

    C'est ce qui fait un ralenti lisible : a 0,4 fois la vitesse, repeter
    chaque image deux ou trois fois donne un mouvement qui saute ; fondre les
    deux voisines au prorata donne un mouvement continu, legerement file —
    celui qu'on attend d'un ralenti. Rend None au-dela de la fin du rush."""
    import math
    k0 = int(math.floor(pos))
    a = rush / f'f{k0:06d}.jpg'
    if not a.exists():
        return None
    im = Image.open(a).convert('RGB')
    frac = pos - k0
    b = rush / f'f{k0 + 1:06d}.jpg'
    if frac > 0.01 and b.exists():
        im = Image.blend(im, Image.open(b).convert('RGB'), frac)
    return im


def composer(rush, sortie, plans, ips):
    rush, sortie = Path(rush), Path(sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    for vieux in sortie.glob('*.jpg'):
        vieux.unlink()
    k = 0
    for plan in plans:
        z0, z1 = plan.get('zoom', [1.0, 1.0])
        ax, ay = plan.get('ancre', [0.5, 0.5])
        # `vitesse` (1 par defaut) ralentit le plan — 0 le fige sur `de` — et
        # `duree` fixe sa longueur DANS LE FILM, qui n'est plus alors `a - de`.
        # Sans l'un ni l'autre, on reste sur le calcul d'origine, a l'image
        # pres : les montages deja livres doivent se refaire a l'identique.
        ralenti = 'vitesse' in plan or 'duree' in plan
        vitesse = float(plan.get('vitesse', 1.0))
        if ralenti:
            n = max(1, round(float(plan['duree'] if 'duree' in plan
                                   else (plan['a'] - plan['de']) / vitesse) * ips))
        else:
            n = max(1, round((plan['a'] - plan['de']) * ips))
        debut = round(plan['de'] * ips)
        for i in range(n):
            if ralenti:
                im = image_a(rush, plan['de'] * ips + i * vitesse)
                if im is None:
                    break
            else:
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
