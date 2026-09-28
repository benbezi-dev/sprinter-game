# -----------------------------------------------------------------------
# Decouper la planche « Asset de personnage 3D : Athlete elite » en vues.
#
#   python3 tools/blender/decouper_planche.py planche.jpg [--sortie ref/]
#
# Une Empty Image de Blender n'affiche qu'une image entiere : chaque vue doit
# donc etre un fichier. Les cadres sont en FRACTIONS de la planche (elle a
# ete relevee en 1334 x 2000) : ils tiennent si la planche est redimensionnee.
# Chaque vue en pied est coupee du sommet du crane a la plante des pieds, sans
# marge : atelier_athlete.py la cale alors a la hauteur du personnage.
#
# Sortie : face.png, profil_gauche.png, profil_droit.png, dos.png, puis les
# gros plans visage.png, texture.png, nuque.png.
# -----------------------------------------------------------------------

import os
import sys
from PIL import Image

# nom -> (gauche, haut, droite, bas), en fractions de la planche
CADRES = {
    # le profil qui regarde a droite de l'image : son cote gauche
    'profil_gauche': (0.075, 0.085, 0.265, 0.700),
    # le profil qui regarde a gauche : c'est la vue « Right » de Blender
    'profil_droit':  (0.735, 0.085, 0.925, 0.700),
    # la face, mains sur les hanches (pose source, pas une vue orthogonale)
    'face':          (0.340, 0.252, 0.672, 0.750),
    # le dos : seul le haut est visible, la face le cache sous la taille
    'dos':           (0.365, 0.068, 0.640, 0.330),
    'visage':        (0.034, 0.768, 0.330, 0.962),
    'texture':       (0.355, 0.768, 0.652, 0.962),
    'nuque':         (0.677, 0.768, 0.974, 0.962),
}


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__ or 'usage : decouper_planche.py planche.jpg [--sortie DOSSIER]')
        sys.exit(1)
    planche = a[0]
    sortie = a[a.index('--sortie') + 1] if '--sortie' in a else 'ref'
    os.makedirs(sortie, exist_ok=True)
    im = Image.open(planche).convert('RGB')
    L, H = im.size
    for nom, (g, h, d, b) in CADRES.items():
        c = im.crop((round(g * L), round(h * H), round(d * L), round(b * H)))
        chemin = os.path.join(sortie, nom + '.png')
        c.save(chemin)
        print('%-14s %4d x %4d  %s' % (nom, c.width, c.height, chemin))


if __name__ == '__main__':
    main()
