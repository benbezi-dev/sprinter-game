# -----------------------------------------------------------------------
# SPRINTER — les cumulus de l'Olympe (Legende, etape de Karman).
#
#   "<python de Blender>" tools/blender/decors/legende_nuages.py [dossier]
#
# Le python de Blender suffit : il porte numpy, et rien d'autre n'est requis
# (le PNG s'ecrit a la main, cwebp le convertit).
#
# Pourquoi pas des ronds degrades : poses par dizaines, ils se lisent comme
# un meme tampon repete — l'auteur, 07/10 : « tu peux mieux faire pour les
# nuages ». Un cumulus est un chou-fleur : de grosses boules, des boules sur
# leurs flancs, et encore des boules sur celles-ci. On en tire un relief (la
# hauteur de la surface vers la camera), et de ce relief une normale, une
# lumiere qui vient d'en haut, les creux entre les bourgeons plus sombres, un
# bas lavande, un liseré clair aux bords, un bord effiloche par du bruit. Le
# bas du nuage s'efface : il se fond dans la mer de nuages ou il est pose.
# -----------------------------------------------------------------------

import os
import struct
import subprocess
import sys
import zlib

import numpy as np

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(
    os.path.join(ICI, '../../../src/assets/legende/decors/nuages'))


def png(chemin, rgba):
    h, w, _ = rgba.shape
    brut = b''.join(b'\x00' + rgba[y].tobytes() for y in range(h))

    def bloc(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(chemin, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(bloc(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)))
        f.write(bloc(b'IDAT', zlib.compress(brut, 9)))
        f.write(bloc(b'IEND', b''))


def flou(a, r):
    """Flou en boite (deux passes), par sommes cumulees."""
    for _ in range(2):
        for ax in (0, 1):
            p = np.pad(a, [(r + 1, r) if i == ax else (0, 0) for i in range(2)], mode='edge')
            c = np.cumsum(p, axis=ax)
            if ax == 0:
                a = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)
            else:
                a = (c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)
    return a


def bruit(w, h, rng, octaves=5, base=6):
    """Bruit fractal (valeurs interpolees), entre 0 et 1."""
    tot = np.zeros((h, w)); amp, somme = 1.0, 0.0
    for o in range(octaves):
        n = base * 2 ** o
        g = rng.random((n + 1, n * w // h + 2))
        ys = np.linspace(0, n, h, endpoint=False); xs = np.linspace(0, n * w / h, w, endpoint=False)
        y0, x0 = ys.astype(int), xs.astype(int)
        fy, fx = ys - y0, xs - x0
        fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
        a = g[y0][:, x0]; b = g[y0][:, x0 + 1]; c = g[y0 + 1][:, x0]; d = g[y0 + 1][:, x0 + 1]
        v = (a * (1 - fx) + b * fx) * (1 - fy)[:, None] + (c * (1 - fx) + d * fx) * fy[:, None]
        tot += v * amp; somme += amp; amp *= 0.5
    return tot / somme


def cumulus(graine, W=640, H=320, larges=4, tour=1.0):
    rng = np.random.default_rng(graine)
    base = H * 0.84
    boules = []          # (x, y, z, r)
    xs = np.linspace(W * 0.2, W * 0.8, larges) + rng.normal(0, W * 0.025, larges)
    for i, x in enumerate(xs):
        milieu = 1 - abs(i - (larges - 1) / 2) / max(1, (larges - 1) / 2)
        r = H * (0.2 + 0.12 * milieu * tour + rng.random() * 0.06)
        boules.append((x, base - r * 0.45, 0.0, r))
    # les bourgeons, puis les bourgeons des bourgeons, sur le haut de chaque boule
    for niveau, (nb, k) in enumerate(((9, 0.46), (5, 0.48))):
        nouvelles = []
        for (x, y, z, r) in boules if niveau == 0 else enfants:
            for _ in range(nb):
                a = rng.uniform(-np.pi * 0.95, -np.pi * 0.05)
                rr = r * k * rng.uniform(0.75, 1.15)
                d = r * rng.uniform(0.62, 0.86)
                cy = y + np.sin(a) * d
                if cy + rr * 0.3 > base:
                    continue
                nouvelles.append((x + np.cos(a) * d, cy, z + r * 0.18, rr))
        enfants = nouvelles
        boules += nouvelles

    Y, X = np.mgrid[0:H, 0:W].astype(float)
    # union LISSEE des boules (somme d'exponentielles) : une union franche
    # laisse une couture droite la ou deux boules se coupent
    k = H * 0.025
    somme = np.zeros((H, W))
    couv = np.zeros((H, W))
    for (x, y, z, r) in boules:
        x0, x1 = int(max(0, x - r - 1)), int(min(W, x + r + 2))
        y0, y1 = int(max(0, y - r - 1)), int(min(H, y + r + 2))
        if x0 >= x1 or y0 >= y1:
            continue
        dx, dy = X[y0:y1, x0:x1] - x, Y[y0:y1, x0:x1] - y
        d2 = dx * dx + dy * dy
        dedans = d2 < r * r
        hz = z + np.sqrt(np.maximum(r * r - d2, 0))
        somme[y0:y1, x0:x1] += np.where(dedans, np.exp(hz / k), 0)
        couv[y0:y1, x0:x1] = np.maximum(couv[y0:y1, x0:x1], np.where(dedans, 1 - np.sqrt(d2) / r, 0))

    n1 = bruit(W, H, rng, 5, 5)
    n2 = bruit(W, H, rng, 4, 14)
    plein = somme > 0
    h = np.where(plein, k * np.log(np.maximum(somme, 1e-300)), 0)
    h = h + (n2 - 0.5) * H * 0.015 * plein
    hs = flou(h, 2)
    gy, gx = np.gradient(hs)
    nz = 1.0 / np.sqrt(gx * gx + gy * gy + 1)
    nx, ny = -gx * nz, -gy * nz
    L = np.array([-0.45, -0.72, 0.53]); L /= np.linalg.norm(L)
    nl = nx * L[0] + ny * L[1] + nz * L[2]
    diffus = np.clip((nl + 0.15) / 1.15, 0, 1) ** 1.6
    # les creux entre les bourgeons
    ao = np.clip(1 - np.maximum(flou(h, 8) - h, 0) / (H * 0.06), 0.35, 1)
    # le bas du nuage est dans son ombre
    v = np.clip((base - Y) / (H * 0.62), 0, 1)
    s = np.clip(diffus * ao * (0.55 + 0.45 * v) + 0.08 * (n1 - 0.5), 0, 1)

    ombre = np.array([140, 134, 198.0])
    milieu = np.array([226, 224, 246.0])
    lumiere = np.array([255, 251, 244.0])
    t1 = np.clip(s / 0.55, 0, 1)[..., None]
    t2 = np.clip((s - 0.55) / 0.45, 0, 1)[..., None]
    col = ombre * (1 - t1) + milieu * t1
    col = col * (1 - t2) + lumiere * t2
    # une pointe d'or ou la lumiere tombe en plein, en haut
    or_ = np.clip((nl - 0.6) / 0.4, 0, 1) * np.clip(v * 1.2, 0, 1)
    col += (np.array([255, 214, 146.0]) - col) * (or_ * 0.5)[..., None]
    # le liseré : le bord d'un nuage laisse passer la lumiere
    lis = np.clip((1 - nz) ** 2.5, 0, 1) * np.clip(v * 1.5, 0, 1)
    col += (np.array([255, 252, 248.0]) - col) * (lis * 0.6)[..., None]

    # le bord effiloche, et le bas qui s'efface dans la mer
    # (le bruit n'effiloche que le dedans : hors des boules, rien)
    bord = couv + (n1 - 0.5) * 0.16 + (n2 - 0.5) * 0.08
    alpha = np.clip(bord / 0.1, 0, 1) * np.clip(couv / 0.04, 0, 1)
    alpha *= np.clip((base + H * 0.02 - Y) / (H * 0.16), 0, 1)
    alpha = flou(alpha, 1)

    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    # recadre au contenu
    ys, xs = np.nonzero(rgba[..., 3] > 2)
    rgba = rgba[max(0, ys.min() - 2):ys.max() + 3, max(0, xs.min() - 2):xs.max() + 3]
    return rgba


# (graine, largeur, hauteur, grosses boules, elan vers le haut)
NUAGES = [
    (11, 640, 320, 4, 1.0),
    (23, 640, 300, 5, 0.6),
    (37, 560, 340, 3, 1.5),
    (41, 720, 260, 6, 0.3),
    (53, 600, 320, 4, 1.2),
    (67, 680, 280, 5, 0.8),
]

if __name__ == '__main__':
    os.makedirs(SORTIE, exist_ok=True)
    for i, (g, w, h, n, t) in enumerate(NUAGES):
        a = cumulus(g, w, h, n, t)
        p = os.path.join(SORTIE, 'cumulus%d.png' % i)
        png(p, a)
        subprocess.run(['cwebp', '-quiet', '-q', '88', '-alpha_q', '90', p, '-o', p[:-4] + '.webp'], check=True)
        os.remove(p)
        print('cumulus%d.webp %dx%d' % (i, a.shape[1], a.shape[0]))
