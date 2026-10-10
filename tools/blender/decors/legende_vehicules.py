# -----------------------------------------------------------------------
# SPRINTER — les vehicules de la Legende (10/10), rendus pour le globe et
# pour les voyages vers le stade.
#
#   planche (choisir le quart de tour) :
#   blender -b --factory-startup -P tools/blender/decors/legende_vehicules.py -- \
#       --source <modele Tripo .glb> --planche vues.png
#   rendu :
#   blender -b --factory-startup -P tools/blender/decors/legende_vehicules.py -- \
#       --source <glb> --nom avion --rot 90 --rot-dessus 0 --vues profil,dessus [--sat 1.3]
#
# Meme lumiere que les monuments et les pieces (legende_monuments.py) ; deux
# vues :
#   profil — legerement d'en haut (8 degres), le flanc a la camera, le nez
#            vers la DROITE : ce que montrent les voyages (LegendeCinematiques)
#   dessus — a la verticale, le nez vers le HAUT de l'image : le vehicule qui
#            suit son arc sur le globe (LegendeGlobe.tsx)
# Les images vont dans src/assets/legende/vehicules/ avec leur manifeste
# (taille, et pixel du centre pour le dessus, du pied pour le profil).
# -----------------------------------------------------------------------

import bpy
import json
import math
import os
import sys

import numpy as np
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import legende_monuments as LM  # noqa: E402

DOSSIER = os.path.join(LM.PROJET, 'src', 'assets', 'legende', 'vehicules')
F_MAN = os.path.join(DOSSIER, 'manifeste.json')


def arguments():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    def val(k, d=None):
        return a[a.index(k) + 1] if k in a else d
    return dict(source=val('--source'), nom=val('--nom'), rot=float(val('--rot', '0')),
                vues=(val('--vues', 'profil,dessus') or '').split(','), planche=val('--planche'),
                sat=float(val('--sat', '1')), haut=int(val('--haut', '640')),
                rot_dessus=float(val('--rot-dessus', val('--rot', '0'))))


def tourner(o, deg):
    o.data.transform(Matrix.Rotation(math.radians(deg), 4, 'Z'))
    o.data.update()


def rendre(o, elev, H):
    tmp = '/tmp/legende-vehicule-%d.png' % os.getpid()
    W, H, pied = LM.rendre(o, elev, H, tmp)
    a = LM.lire(tmp)
    ys, xs = np.nonzero(a[..., 3] > 0.004)
    x0, x1 = max(0, xs.min() - 2), min(W, xs.max() + 3)
    y0, y1 = max(0, ys.min() - 2), min(H, ys.max() + 3)
    return a[y0:y1, x0:x1], (pied[0] - x0, pied[1] - y0)


def saturer(a, sat):
    if sat != 1.0:
        gris = a[..., :3].mean(axis=2, keepdims=True)
        a[..., :3] = np.clip(gris + (a[..., :3] - gris) * sat, 0, 1)
    return a


def main():
    A = arguments()
    o = LM.importer(A['source'])
    image = LM.texture(o)
    if image is None:
        raise RuntimeError('pas de texture dans le modele')
    LM.normaliser(o, 0)
    LM.matiere(o, image, (1, 1, 1, 0))
    if A['planche']:
        vues = []
        for r in (0, 90, 180, 270):
            if r:
                tourner(o, 90)
            a, _ = rendre(o, 8, 300)
            vues.append(a)
        tourner(o, 90)                     # revenu a 0
        a, _ = rendre(o, 90, 300)
        vues.append(a)
        h = max(v.shape[0] for v in vues)
        cols = []
        for v in vues:
            f = np.ones((h, v.shape[1] + 30, 4), dtype=np.float32); f[..., :3] = 0.82
            f[:v.shape[0], :v.shape[1]] = v * v[..., 3:4] + f[:v.shape[0], :v.shape[1]] * (1 - v[..., 3:4])
            f[..., 3] = 1
            cols.append(f)
        LM.ecrire(np.concatenate(cols, axis=1), A['planche'], 'PNG')
        print('PLANCHE ' + A['planche'] + ' : profils 0/90/180/270 puis dessus (rot 0)')
        return
    tourner(o, A['rot'])
    os.makedirs(DOSSIER, exist_ok=True)
    man = json.load(open(F_MAN)) if os.path.exists(F_MAN) else {}
    for vue in A['vues']:
        elev = 8 if vue == 'profil' else 90
        # le dessus a son propre quart de tour : le nez vers le haut de l'image
        dr = (A['rot_dessus'] - A['rot']) if vue == 'dessus' else 0
        if dr:
            tourner(o, dr)
        a, pied = rendre(o, elev, A['haut'])
        if dr:
            tourner(o, -dr)
        a = saturer(a, A['sat'])
        nom = '%s-%s.webp' % (A['nom'], vue)
        LM.ecrire(a, os.path.join(DOSSIER, nom))
        h, w = a.shape[:2]
        man.setdefault(A['nom'], {})[vue] = {'f': nom, 'w': int(w), 'h': int(h),
                                              'ax': round(float(pied[0]), 1), 'ay': round(float(pied[1]), 1)}
        print('VEHICULE %s %s : %dx%d' % (A['nom'], vue, w, h))
    json.dump(man, open(F_MAN, 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main()
