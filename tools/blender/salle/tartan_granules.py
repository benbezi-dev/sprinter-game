# -----------------------------------------------------------------------
# SPRINTER — LE TARTAN DE LA SALLE, EN GRANULES (27/10/2026).
#
#   Blender -b --factory-startup -P tools/blender/salle/tartan_granules.py -- public/modeles/salle/textures
#
# L'auteur, 27/10 : « la texture donne une mauvaise qualite, ce n'est pas de la texture tartan ». Le
# Rubber004 d'ambientCG etait un bruit gris pique de blanc (du « sel et poivre ») : rien d'un tartan.
# Le vrai (la coupe Polytan en gros plan, assets-sources/stade-bernard-amsalem-polytan/img-2) : des
# granules de caoutchouc anguleux, de la couleur du couloir, serres les uns contre les autres, a
# peine plus clairs ou plus sombres l'un que l'autre, des interstices dans l'ombre entre eux.
#
# Ici : un pavage de Voronoi raccordable (une graine par case de 10 px, ecartee au hasard), chaque
# cellule un granule — sa teinte propre, une facette inclinee au hasard (l'arete vive), l'interstice
# assombri ; le relief (normale) et la rugosite en sortent. 1024 px pour 0,32 m : un granule fait
# ~3 mm, comme sur la coupe. La couleur est un multiplicateur de moyenne 0,82 (salle-3d.ts divise la
# couleur du couloir par 0,82).
# -----------------------------------------------------------------------
import bpy, sys, os
import numpy as np

dossier = sys.argv[sys.argv.index('--') + 1:][0]
N, C = 1024, 10                      # la tuile, la case d'une graine (px)
rng = np.random.default_rng(27102026)
G = N // C                           # (1024 / 10 n'est pas entier : la case fait N / G px)
c = N / G
gx = (np.arange(G)[None, :] + rng.uniform(0.1, 0.9, (G, G))) * c
gy = (np.arange(G)[:, None] + rng.uniform(0.1, 0.9, (G, G))) * c
teinte = rng.normal(1.0, 0.07, (G, G))                       # chaque granule, sa teinte
fond = rng.uniform(0.0, 1.0, (G, G))                         # sa profondeur : les granules du dessous sont dans l'ombre
poids = rng.uniform(0, 0.38, (G, G)) * c                     # sa taille : des gros et des petits (diagramme de puissance)
pente = rng.normal(0, 0.10, (G, G, 2))                       # sa facette

y, x = np.mgrid[0:N, 0:N].astype(np.float32) + 0.5
ci, cj = (y // c).astype(int), (x // c).astype(int)
d1 = np.full((N, N), 1e9, np.float32); d2 = np.full((N, N), 1e9, np.float32)
qi = np.zeros((N, N), int); qj = np.zeros((N, N), int); dx1 = np.zeros((N, N), np.float32); dy1 = np.zeros((N, N), np.float32)
for di in (-2, -1, 0, 1, 2):
    for dj in (-2, -1, 0, 1, 2):
        i, j = ci + di, cj + dj
        im, jm = i % G, j % G                                   # raccordable : le tore
        sx = gx[im, jm] + (j - jm) * c
        sy = gy[im, jm] + (i - im) * c
        ddx, ddy = x - sx, y - sy
        d = np.sqrt(ddx * ddx + ddy * ddy) - poids[im, jm]
        plus_pres = d < d1
        d2 = np.where(plus_pres, d1, np.minimum(d2, d))
        d1 = np.where(plus_pres, d, d1)
        qi = np.where(plus_pres, im, qi); qj = np.where(plus_pres, jm, qj)
        dx1 = np.where(plus_pres, ddx, dx1); dy1 = np.where(plus_pres, ddy, dy1)

bord = np.clip((d2 - d1) / 1.8, 0, 1)                         # 0 a l'interstice, 1 au coeur
bord = bord * bord * (3 - 2 * bord)
# les granules se touchent par endroits : l'interstice ne fait pas un trait continu (bruit lisse, raccordable)
def lisse(n, ech):
    b = rng.normal(0, 1, (n // ech, n // ech))
    b = np.repeat(np.repeat(b, ech, 0), ech, 1)
    for _ in range(3): b = (b + np.roll(b, ech // 2, 0) + np.roll(b, ech // 2, 1) + np.roll(np.roll(b, ech // 2, 0), ech // 2, 1)) / 4
    return (b - b.mean()) / b.std()
ouvert = np.clip(0.55 + 0.45 * lisse(N, 8), 0, 1)
bord = 1 - ouvert * (1 - bord)
prof = fond[qi, qj]
grain = lisse(N, 2) * 0.05                                    # la matiere du granule, mate et rugueuse
facette = (pente[qi, qj, 0] * dx1 + pente[qi, qj, 1] * dy1) / c
haut = bord * (0.7 + 0.3 * prof + facette) + grain            # le relief : granule bombe, facette
coul = teinte[qi, qj] * (0.5 + 0.5 * bord) * (0.8 + 0.2 * prof) * (1 + 0.6 * facette + grain)
coul *= 0.82 / coul.mean()
rug = 0.92 - 0.18 * bord                                      # le dessus des granules, un rien moins mat

# la normale (OpenGL, comme les autres textures du jeu), depuis le relief, raccordable
k = 2.0
hx = (np.roll(haut, -1, 1) - np.roll(haut, 1, 1)) * k
hy = (np.roll(haut, -1, 0) - np.roll(haut, 1, 0)) * k
nz = 1 / np.sqrt(hx * hx + hy * hy + 1)
nrm = np.stack([-hx * nz, hy * nz, nz], -1) * 0.5 + 0.5

def ecrire(nom, rgb):
    img = bpy.data.images.new(nom, N, N, alpha=False, float_buffer=False)
    a = np.ones((N, N, 4), np.float32); a[..., :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(a[::-1].ravel())                   # (Blender range les lignes de bas en haut)
    img.filepath_raw = os.path.join(dossier, nom); img.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = 88
    img.save()
    print('ecrit', nom, float(rgb.mean()))

g = lambda v: np.repeat(v[..., None], 3, -1)
ecrire('tartan.jpg', g(coul))
ecrire('tartan-relief.jpg', nrm)
ecrire('tartan-rugosite.jpg', g(rug))
