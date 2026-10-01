#!/usr/bin/env python3
# LES PROPORTIONS D'UN VISAGE, MESUREES : pour qu'un modele ressemble.
#
#   python visage.py PHOTO.png [RENDU.png ...]
#
# (Python 3.12 + mediapipe 0.10.14 : Face Mesh, 468 points, iris compris.)
#
# Un visage se reconnait a des rapports, pas a des centimetres : l'ecart des
# yeux rapporte a la largeur du visage, la largeur du nez rapportee a l'ecart
# des yeux, la bouche, les levres, la hauteur du bas du visage. On les mesure
# sur sa photo et sur le rendu du modele, cote a cote ; le reglage des cibles
# MakeHuman (tools/blender/meba_maillage.py, VISAGE) se fait sur l'ecart, pas a
# l'oeil.

import sys, math
import cv2
import mediapipe as mp

# points de Face Mesh
JOUE_G, JOUE_D = 234, 454           # largeur du visage, aux pommettes
MACH_G, MACH_D = 172, 397           # machoire
OEIL_G_EXT, OEIL_G_INT = 33, 133
OEIL_D_INT, OEIL_D_EXT = 362, 263
PAUP_G_H, PAUP_G_B = 159, 145
AILE_G, AILE_D = 64, 294            # ailes du nez
BOUCHE_G, BOUCHE_D = 61, 291
LEVRE_H_HAUT, LEVRE_H_BAS = 0, 13   # levre du haut
LEVRE_B_HAUT, LEVRE_B_BAS = 14, 17  # levre du bas
BOUT_NEZ, MENTON, FRONT = 1, 152, 10
SOURCIL_G, SOURCIL_D = 105, 334


def mesurer(chemin):
    im = cv2.imread(chemin)
    if im is None:
        return None
    h, w = im.shape[:2]
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1,
                                         refine_landmarks=True) as fm:
        r = fm.process(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
    if not r.multi_face_landmarks:
        return None
    L = r.multi_face_landmarks[0].landmark
    P = lambda i: (L[i].x * w, L[i].y * h)
    d = lambda a, b: math.dist(P(a), P(b))
    visage = d(JOUE_G, JOUE_D)
    yeux = math.dist(((P(OEIL_G_EXT)[0] + P(OEIL_G_INT)[0]) / 2, (P(OEIL_G_EXT)[1] + P(OEIL_G_INT)[1]) / 2),
                     ((P(OEIL_D_EXT)[0] + P(OEIL_D_INT)[0]) / 2, (P(OEIL_D_EXT)[1] + P(OEIL_D_INT)[1]) / 2))
    ligne_yeux = (P(OEIL_G_INT)[1] + P(OEIL_D_INT)[1]) / 2
    return {
        'yeux/visage': yeux / visage,
        'oeil/visage': (d(OEIL_G_EXT, OEIL_G_INT) + d(OEIL_D_EXT, OEIL_D_INT)) / 2 / visage,
        'ouverture/oeil': (d(PAUP_G_H, PAUP_G_B)) / d(OEIL_G_EXT, OEIL_G_INT),
        'nez/visage': d(AILE_G, AILE_D) / visage,
        'bouche/visage': d(BOUCHE_G, BOUCHE_D) / visage,
        'machoire/visage': d(MACH_G, MACH_D) / visage,
        'levre_h/bouche': d(LEVRE_H_HAUT, LEVRE_H_BAS) / d(BOUCHE_G, BOUCHE_D),
        'levre_b/bouche': d(LEVRE_B_HAUT, LEVRE_B_BAS) / d(BOUCHE_G, BOUCHE_D),
        'yeux-nez/visage': (P(BOUT_NEZ)[1] - ligne_yeux) / visage,
        'nez-menton/visage': (P(MENTON)[1] - P(BOUT_NEZ)[1]) / visage,
        'sourcil-oeil/visage': ((P(OEIL_G_INT)[1] - P(SOURCIL_G)[1]) + (P(OEIL_D_INT)[1] - P(SOURCIL_D)[1])) / 2 / visage,
    }


def main():
    res = [(c, mesurer(c)) for c in sys.argv[1:]]
    cles = next((list(m.keys()) for _, m in res if m), [])
    ref = res[0][1]
    print(f"{'':22s}" + ''.join(f"{c.split('/')[-1][:14]:>16s}" for c, _ in res))
    for k in cles:
        ligne = f"{k:22s}"
        for c, m in res:
            if m is None:
                ligne += f"{'(rien)':>16s}"
            else:
                e = '' if m is ref or ref is None else f" {100 * (m[k] / ref[k] - 1):+.0f}%"
                ligne += f"{m[k]:>10.3f}{e:>6s}"
        print(ligne)


if __name__ == '__main__':
    main()
