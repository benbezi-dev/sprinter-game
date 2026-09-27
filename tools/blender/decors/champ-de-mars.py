# -----------------------------------------------------------------------
# SPRINTER — les decors du Champ-de-Mars, rendus dans Blender.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b \
#       -P tools/blender/decors/champ-de-mars.py [-- --pieces tour,rideau]
#
# Meme principe que fabriquer.py — la piece est construite dans le repere du
# jeu, rendue sous la vue du jeu avec la matiere du jeu (matiere.py), son
# ombre rendue a part — avec UNE difference : ce lieu se regarde de 15° au
# lieu de 26,6° (voir `angle` dans le theme champdemars, sprinter-app.js).
# La camera de vue.py est ecrite pour l'angle du jeu ; on la generalise ici.
#
# La projection du jeu, a l'angle a :
#
#     ecran_x =  cos a (-X + Y)
#     ecran_y = -sin a ( X + Y) - Z
#
# Les deux axes de l'ecran restent orthogonaux (u = cos a (-1, 1, 0),
# v = (sin a, sin a, 1)), donc c'est une camera orthographique qui regarde
# le long de u x v, proportionnel a (1, 1, -2 sin a). Le pixel n'est pas
# carre : un metre le long de u vaut cos a racine 2 / racine (2 sin a² + 1)
# fois un metre le long de v. A 26,6° on retrouve les 1,069 de vue.py.
#
# Les images vont dans public/decors/champdemars/, et ce qu'il faut pour les
# poser (pied de la piece dans l'image, pixels par metre) dans
# src/game/champ-de-mars-manifeste.json.
# -----------------------------------------------------------------------

import bpy
import bmesh
import sys
import os
import math
import json
import numpy as np
from mathutils import Vector, Matrix, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vue
import matiere as M

RACINE_PROJET = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
DOSSIER = os.path.join(RACINE_PROJET, 'public', 'decors', 'champdemars')
F_MAN = os.path.join(RACINE_PROJET, 'src', 'game', 'champ-de-mars-manifeste.json')

ANGLE = 15.0
CA, SA = math.cos(math.radians(ANGLE)), math.sin(math.radians(ANGLE))
ETIREMENT = CA * math.sqrt(2) / math.sqrt(2 * SA * SA + 1)
# le liseret de matiere.py se calcule contre la direction de vue : a cet
# angle, elle n'est plus celle du jeu
_v = Vector((CA, CA, -2 * CA * SA)).normalized()
M.VUE = (_v.x, _v.y, _v.z)
L = M.LUMIERE

# Les couleurs du theme, APRES le gain de saturation que sprinter-app.js
# applique au chargement (aviver, x1,22) : une piece peinte avec la valeur
# brute du theme ressortirait terne a cote de la pelouse.
COUL = {
    'fer': (132, 100, 72), 'ferSombre': (92, 70, 54),
    # La lumiere du jeu vient de derriere les decors (LIGHT a une composante
    # +Y) : la face qu'on voit est a contre-jour, et la formule du jeu la
    # descend a 0,34 + 0,20 ciel. On eclaircit d'autant la matiere pour que
    # la face lue a l'ecran ait la valeur des photographies.
    'feuille': (80, 150, 50), 'feuilleClair': (120, 190, 70), 'tronc': (92, 76, 58),
    'if': (52, 132, 52),
    'pierre': (255, 246, 222), 'pierreOmbre': (246, 232, 204), 'zinc': (118, 138, 168),
    'zincSombre': (70, 84, 108), 'fenetre': (54, 62, 84), 'balcon': (34, 36, 44),
    'brique': (184, 104, 76), 'corniche': (246, 236, 214),
    'metal': (186, 192, 200), 'metalSombre': (120, 126, 136),
    'alu': (222, 226, 232), 'bleu': (8, 64, 170), 'blanc': (250, 250, 248), 'rouge': (226, 30, 44),
    'horloge': (18, 18, 24),
}


# -----------------------------------------------------------------------
# LA SCENE
# -----------------------------------------------------------------------

def vider():
    bpy.ops.wm.read_factory_settings(use_empty=True)


class Lot:
    """Des centaines de poutres dans UN seul maillage par matiere.

    Un objet Blender par barre de la tour, ce serait trois mille objets et
    de longues minutes pour rien : on accumule dans un bmesh.
    """

    def __init__(self):
        self.bm = bmesh.new()

    def _boite(self, coins):
        v = [self.bm.verts.new(c) for c in coins]
        for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            try:
                self.bm.faces.new([v[i] for i in f])
            except ValueError:
                pass

    def poutre(self, a, b, e, e2=None):
        a, b = Vector(a), Vector(b)
        d = b - a
        if d.length < 1e-5:
            return
        z = d.normalized()
        x = z.orthogonal().normalized()
        y = z.cross(x).normalized()
        e2 = e if e2 is None else e2
        coins = []
        for p in (a, b):
            for sx in (-1, 1):
                for sy in (-1, 1):
                    coins.append(p + x * (sx * e / 2) + y * (sy * e2 / 2))
        # ordre attendu par _boite : (a,-,-) (a,-,+) (a,+,-) (a,+,+) puis b
        self._boite(coins)

    def boite(self, x0, y0, z0, x1, y1, z1):
        c = []
        for x in (x0, x1):
            for y in (y0, y1):
                for z in (z0, z1):
                    c.append(Vector((x, y, z)))
        # reordonner vers (x,y) en premier pour _boite : on reprend l'ordre
        # a,b = x0,x1 ; puis y ; puis z
        self._boite([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]])

    def objet(self, nom, mat, racine, transfo=None, recalculer=True):
        if recalculer:
            bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        if transfo is not None:
            bmesh.ops.transform(self.bm, matrix=transfo, verts=self.bm.verts)
        me = bpy.data.meshes.new(nom)
        self.bm.to_mesh(me)
        self.bm.free()
        o = bpy.data.objects.new(nom, me)
        bpy.context.collection.objects.link(o)
        o.data.materials.append(mat)
        o.parent = racine
        for p in o.data.polygons:
            p.use_smooth = False
        return o


# LE CONTRE-JOUR, COMPENSE. La face qu'on voit d'un decor lointain regarde
# la camera, donc tourne le dos au soleil du jeu : la formule de matiere.py
# la descend a 0,47 de sa teinte. Pour la pierre d'un immeuble parisien,
# c'est un gris sale — les photographies la montrent creme. Une emission
# peut depasser 1 : on surexpose la matiere de ce facteur, et la face lue a
# l'ecran retrouve la valeur des photos (le dessus, deja au soleil, sature
# au blanc casse, ce qui est aussi ce qu'on voit).
ECLAT = {'pierre': 1.85, 'pierreOmbre': 1.85, 'corniche': 1.6, 'zinc': 1.25, 'zincSombre': 1.2,
         'feuille': 1.08, 'if': 1.2, 'brique': 1.4}


def peinture(nom, cle, liseret=1.0):
    k = ECLAT.get(cle, 1.0)
    return M.peinture(nom, tuple(v * k for v in COUL[cle]), liseret=liseret)


# -----------------------------------------------------------------------
# LA TOUR
# -----------------------------------------------------------------------
#
# Maquette au dixieme : 33 m de structure, 12,5 m de base. Le profil est la
# meme exponentielle que la tuile de secours du jeu (decor-champ-de-mars.js),
# 0,04 + 0,96·e^(-3,6 h). Les quatre piliers sont des poutres-caissons en
# treillis — quatre membrures, des traverses a chaque palier, des croix de
# saint Andre sur chaque face — qui se rejoignent au deuxieme etage ; au-dessus,
# un seul fut en treillis jusqu'au sommet.
#
# Elle est tournee de 45° : la camera du jeu regarde le long de la diagonale
# (1, 1), et c'est FACE a elle que la tour se reconnait, arche au milieu,
# comme depuis les parterres. De biais elle devient un losange.

H_TOUR, B_TOUR = 33.0, 6.25


def hw(f):
    return B_TOUR * (0.04 + 0.96 * math.exp(-3.6 * f))


def lw(f):
    """La largeur d'un pilier : 40 % de la demi-base au sol, tout au deuxieme etage."""
    t = min(1.0, f / 0.35)
    return hw(f) * (0.40 + 0.60 * t ** 1.6)


def tour(racine):
    fer, fer2 = peinture('fer', 'fer'), peinture('ferSombre', 'ferSombre', 0.6)
    L1, L2 = Lot(), Lot()
    E_M, E_T = 0.16, 0.07          # membrures, treillis

    # --- les quatre piliers, du sol au deuxieme etage
    niv = [0.0]
    while niv[-1] < 0.35:
        f = niv[-1]
        niv.append(min(0.35, f + 0.012 + 0.02 * f))
    for sx in (-1, 1):
        for sy in (-1, 1):
            def coins(f):
                o, i = hw(f), hw(f) - lw(f)
                xs = (sx * i, sx * o)
                ys = (sy * i, sy * o)
                z = f * H_TOUR
                return [Vector((xs[a], ys[b], z)) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))]
            prec = None
            for f in niv:
                cc = coins(f)
                for k in range(4):
                    L1.poutre(cc[k], cc[(k + 1) % 4], E_T)
                if prec:
                    for k in range(4):
                        L1.poutre(prec[k], cc[k], E_M)
                        # la croix de saint Andre de la face k
                        L2.poutre(prec[k], cc[(k + 1) % 4], E_T)
                        L2.poutre(prec[(k + 1) % 4], cc[k], E_T)
                prec = cc

    # --- le fut, du deuxieme etage au sommet
    niv = [0.35]
    while niv[-1] < 0.9:
        f = niv[-1]
        niv.append(min(0.9, f + 0.018))
    prec = None
    for f in niv:
        o = hw(f)
        z = f * H_TOUR
        cc = [Vector((x, y, z)) for x, y in ((-o, -o), (o, -o), (o, o), (-o, o))]
        for k in range(4):
            L1.poutre(cc[k], cc[(k + 1) % 4], E_T)
        if prec:
            for k in range(4):
                L1.poutre(prec[k], cc[k], E_M * 0.8)
                L2.poutre(prec[k], cc[(k + 1) % 4], E_T * 0.8)
                L2.poutre(prec[(k + 1) % 4], cc[k], E_T * 0.8)
        prec = cc

    # --- les arches, sur les quatre faces : deux arcs paralleles et la frise
    # ajouree qui les relie, des pieds des piliers a la cle
    def arche(face, dz, e):
        pts = []
        n = 28
        for k in range(n + 1):
            t = k / n                                 # 0 -> 1 d'un pilier a l'autre
            u = -1 + 2 * t
            f_pied = 0.035
            f = f_pied + (0.125 - f_pied) * math.sqrt(max(0.0, 1 - u * u))
            demi = (hw(f) - lw(f)) * 1.02
            x = u * demi
            y = -hw(f) + lw(f) * 0.05
            z = f * H_TOUR + dz
            p = Vector((x, y, z))
            # tourner vers la face voulue
            p = Matrix.Rotation(face * math.pi / 2, 3, 'Z') @ p
            pts.append(p)
        for a, b in zip(pts, pts[1:]):
            L1.poutre(a, b, e, e * 1.6)
        return pts
    for face in range(4):
        a1 = arche(face, 0.0, 0.42)
        a2 = arche(face, 1.1, 0.24)
        for k in range(1, len(a1) - 1, 2):
            L2.poutre(a1[k], a2[k], 0.07)

    # --- les etages
    def plateau(f0, f1, deb, lot):
        o = hw((f0 + f1) / 2) + deb
        lot.boite(-o, -o, f0 * H_TOUR, o, o, f1 * H_TOUR)
    plateau(0.160, 0.174, 0.35, L1)            # la galerie du premier
    plateau(0.178, 0.186, 0.55, L2)            # sa corniche
    # les arcades sous la galerie : des poteaux serres, qui donnent le feston
    o1 = hw(0.16) + 0.3
    for k in range(-12, 13):
        x = o1 * k / 12.5
        for face in range(4):
            R = Matrix.Rotation(face * math.pi / 2, 3, 'Z')
            L2.poutre(R @ Vector((x, -o1, 0.140 * H_TOUR)), R @ Vector((x, -o1, 0.156 * H_TOUR)), 0.06)
    plateau(0.345, 0.360, 0.30, L1)
    plateau(0.360, 0.365, 0.45, L2)
    plateau(0.835, 0.850, 0.25, L1)
    # la loge du sommet, la lanterne, l'antenne
    o = hw(0.9)
    L2.boite(-o * 0.9, -o * 0.9, 0.90 * H_TOUR, o * 0.9, o * 0.9, 0.935 * H_TOUR)
    L1.boite(-o * 0.45, -o * 0.45, 0.935 * H_TOUR, o * 0.45, o * 0.45, 0.965 * H_TOUR)
    L1.poutre((0, 0, 0.965 * H_TOUR), (0, 0, 1.03 * H_TOUR), 0.12)

    R45 = Matrix.Rotation(math.radians(45), 4, 'Z')
    L1.objet('tour_fer', fer, racine, R45)
    L2.objet('tour_treillis', fer2, racine, R45)


# -----------------------------------------------------------------------
# LES RIDEAUX DE TILLEULS
# -----------------------------------------------------------------------
#
# 31,5 m de rideau, soit le motif du jeu : un rideau et une rue de 4,5 m
# tous les trente-six metres (decor-champ-de-mars.js). A demi-hauteur, comme
# la version peinte, et pour la meme raison : ce qui est lointain doit rester
# bas, sinon le ciel — et la tour — disparaissent.
LONG_RIDEAU = 31.5
# 1,1 m d'epaisseur et non 1,6 : a quinze degres le dessus du rideau monte a
# l'ecran de la moitie de sa profondeur, et cachait les facades derriere lui.
Z0_R, Z1_R, PROF_R = 0.5, 1.9, 1.1


def feuillage(bm, x0, x1, y0, y1, z0, z1, graine, amp=0.16, pas=0.22):
    """Une boite de feuillage bosselee : subdivisee, puis poussee par un bruit."""
    nx = max(2, int((x1 - x0) / pas))
    ny = max(2, int((y1 - y0) / pas))
    nz = max(2, int((z1 - z0) / pas))
    # une grille reguliere de chaque face, construite a la main : plus sur
    # qu'une subdivision uniforme pour une boite si allongee
    def face(orig, du, dv, nu, nv):
        vs = [[bm.verts.new(orig + du * (i / nu) + dv * (j / nv)) for j in range(nv + 1)]
              for i in range(nu + 1)]
        for i in range(nu):
            for j in range(nv):
                bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
        return [v for row in vs for v in row]
    X, Y, Z = Vector((x1 - x0, 0, 0)), Vector((0, y1 - y0, 0)), Vector((0, 0, z1 - z0))
    o = Vector((x0, y0, z0))
    vs = []
    vs += face(o, X, Z, nx, nz)                          # devant (y0)
    vs += face(o + Y, Z, X, nz, nx)                      # derriere
    vs += face(o, Y, X, ny, nx)                          # dessous
    vs += face(o + Z, X, Y, nx, ny)                      # dessus
    vs += face(o, Z, Y, nz, ny)                          # bout gauche
    vs += face(o + X, Y, Z, ny, nz)                      # bout droit
    # SOUDER D'ABORD, POUSSER ENSUITE. Poussees face par face, les aretes
    # partageaient des sommets doubles qui partaient chacun de leur cote : la
    # boite s'ouvrait en fentes. Soudee, chaque bosse suit la normale du
    # sommet, et le volume reste ferme.
    bmesh.ops.remove_doubles(bm, verts=vs, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()
    for v in bm.verts:
        p = v.co.copy()
        n = noise.noise(p * 1.7 + Vector((graine, graine * 0.3, 0)))
        n2 = noise.noise(p * 4.1 + Vector((0, graine, 1.0)))
        v.co = p + v.normal * (amp * (0.55 * n + 0.45 * n2))


def rideau(racine):
    lotF, lotT = Lot(), Lot()
    feuillage(lotF.bm, 0.0, LONG_RIDEAU, 0.0, PROF_R, Z0_R, Z1_R, graine=3.1)
    for x in np.arange(0.9, LONG_RIDEAU, 3.2):
        for y in (0.3, PROF_R - 0.3):
            lotT.boite(x - 0.06, y - 0.06, 0.0, x + 0.06, y + 0.06, Z0_R + 0.2)
    lotF.objet('rideau_feuilles', peinture('feuille', 'feuille', 0.6), racine)
    lotT.objet('rideau_troncs', peinture('tronc', 'tronc', 0.3), racine)


# -----------------------------------------------------------------------
# L'IF TAILLE EN CONE
# -----------------------------------------------------------------------

def if_cone(racine):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=18, radius1=0.42, radius2=0.0, depth=1.25)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
    for v in bm.verts:
        p = v.co.copy()
        r = Vector((p.x, p.y, 0))
        if r.length > 1e-3:
            bosse = 0.05 * noise.noise(p * 6.0 + Vector((2.0, 0, 0)))
            v.co = p + r.normalized() * bosse
    bmesh.ops.translate(bm, vec=(0, 0, 0.625 + 0.12), verts=bm.verts)
    lot = Lot()
    lot.bm = bm
    lot.objet('if_feuilles', peinture('if', 'if', 0.5), racine)
    t = Lot()
    t.boite(-0.05, -0.05, 0.0, 0.05, 0.05, 0.14)
    t.objet('if_tronc', peinture('tronc', 'tronc', 0.3), racine)


# -----------------------------------------------------------------------
# L'ILOT HAUSSMANNIEN
# -----------------------------------------------------------------------
#
# 27 m de facade, soit le motif du jeu (une rue de 9 m tous les trente-six
# metres). Les memes demi-proportions que les rideaux : six etages de pierre
# creme, balcons filants au deuxieme et au cinquieme, corniche, toit a la
# Mansart en zinc perce de lucarnes, cheminees de brique.
LONG_ILOT = 27.0


def ilot(racine):
    Lp, Lo, Lz, Lzs, Lf, Lb, Lc, Lbr = (Lot() for _ in range(8))
    x = 0.0
    k = 0
    largeurs = [4.6, 4.2, 4.9, 4.4, 4.5, 4.4]
    for w in largeurs:
        # PEU PROFOND, UN PEU PLUS HAUT. A quinze degres, un ilot de 1,8 m de
        # profondeur ne montrait que son toit au-dessus des rideaux : une dalle
        # grise. A 0,9 m, c'est la pierre et ses fenetres qui depassent.
        h = 2.45 + 0.12 * ((k * 7) % 3)
        prof = 0.9
        x0, x1 = x, x + w
        # le mur, et une legere ombre de mitoyennete
        (Lp if k % 2 == 0 else Lo).boite(x0, 0.0, 0.0, x1, prof, h)
        # les fenetres : six etages, une travee tous les 0,62 m
        n = int((w - 0.3) / 0.62)
        m0 = x0 + (w - (n - 1) * 0.62) / 2
        for e in range(6):
            z = 0.12 + e * (h - 0.25) / 6.0
            hf = (h - 0.25) / 6.0 * 0.58
            for j in range(n):
                cx = m0 + j * 0.62
                Lf.boite(cx - 0.12, -0.012, z, cx + 0.12, 0.02, z + hf)
            if e in (1, 4):
                Lb.boite(x0 + 0.08, -0.07, z - 0.025, x1 - 0.08, 0.02, z + 0.012)
        # la corniche
        Lc.boite(x0 - 0.02, -0.06, h - 0.05, x1 + 0.02, prof, h + 0.02)
        # le toit a la Mansart : un brisis raide, puis le terrasson presque plat
        # Surfaces ouvertes : on oriente chaque pan a la main (la normale doit
        # regarder la rue, ou le ciel), un recalcul automatique pouvant les
        # retourner vers l'interieur — et la matiere du jeu les assombrir.
        bm = Lz.bm
        def pan(pts, vers):
            f = bm.faces.new([bm.verts.new(p) for p in pts])
            f.normal_update()
            if f.normal.dot(Vector(vers)) < 0:
                f.normal_flip()
        pan(((x0, 0.02, h + 0.02), (x1, 0.02, h + 0.02), (x1, 0.24, h + 0.40), (x0, 0.24, h + 0.40)),
            (0, -1, 0.6))
        pan(((x0, 0.24, h + 0.40), (x1, 0.24, h + 0.40), (x1, prof - 0.1, h + 0.44),
             (x0, prof - 0.1, h + 0.44)), (0, 0, 1))
        pan(((x0, 0.02, h + 0.02), (x0, 0.24, h + 0.40), (x0, prof - 0.1, h + 0.44), (x0, prof, h)),
            (-1, 0, 0))
        pan(((x1, 0.02, h + 0.02), (x1, prof, h), (x1, prof - 0.1, h + 0.44), (x1, 0.24, h + 0.40)),
            (1, 0, 0))
        # les lucarnes, une par travee sur deux
        for j in range(0, n, 2):
            cx = m0 + j * 0.62
            Lp.boite(cx - 0.11, 0.08, h + 0.06, cx + 0.11, 0.26, h + 0.30)
            Lf.boite(cx - 0.06, 0.07, h + 0.10, cx + 0.06, 0.10, h + 0.25)
            Lzs.boite(cx - 0.13, 0.06, h + 0.30, cx + 0.13, 0.28, h + 0.34)
        # les cheminees
        for cx in (x0 + 0.5, x1 - 0.6):
            Lbr.boite(cx - 0.12, prof * 0.5, h + 0.3, cx + 0.12, prof * 0.5 + 0.18, h + 0.72)
        x = x1
        k += 1
    Lp.objet('ilot_pierre', peinture('pierre', 'pierre', 0.5), racine)
    Lo.objet('ilot_pierre2', peinture('pierreOmbre', 'pierreOmbre', 0.5), racine)
    Lz.objet('ilot_zinc', peinture('zinc', 'zinc', 0.8), racine, recalculer=False)
    Lzs.objet('ilot_zinc2', peinture('zincSombre', 'zincSombre', 0.5), racine)
    Lf.objet('ilot_fenetres', peinture('fenetre', 'fenetre', 0.2), racine)
    Lb.objet('ilot_balcons', peinture('balcon', 'balcon', 0.2), racine)
    Lc.objet('ilot_corniche', peinture('corniche', 'corniche', 0.6), racine)
    Lbr.objet('ilot_cheminees', peinture('brique', 'brique', 0.4), racine)


# -----------------------------------------------------------------------
# LA BARRIERE VAUBAN
# -----------------------------------------------------------------------
#
# La barriere de police qu'on voit a chaque evenement parisien : un cadre de
# tube galvanise, des barreaux verticaux serres, deux pieds plats. 2,5 m.
LONG_VAUBAN = 2.5


def vauban(racine):
    L1, L2 = Lot(), Lot()
    h = 1.1
    L1.poutre((0.02, 0, 0.12), (0.02, 0, h), 0.045)
    L1.poutre((LONG_VAUBAN - 0.02, 0, 0.12), (LONG_VAUBAN - 0.02, 0, h), 0.045)
    L1.poutre((0.02, 0, h), (LONG_VAUBAN - 0.02, 0, h), 0.045)
    L1.poutre((0.02, 0, 0.2), (LONG_VAUBAN - 0.02, 0, 0.2), 0.04)
    x = 0.14
    while x < LONG_VAUBAN - 0.1:
        L2.poutre((x, 0, 0.2), (x, 0, h), 0.018)
        x += 0.12
    for xp in (0.1, LONG_VAUBAN - 0.1):
        L1.boite(xp - 0.03, -0.28, 0.0, xp + 0.03, 0.28, 0.02)
        L1.poutre((xp, 0, 0.02), (xp, 0, 0.14), 0.035)
    L1.objet('vauban_cadre', peinture('metal', 'metal', 1.0), racine)
    L2.objet('vauban_barreaux', peinture('metalSombre', 'metalSombre', 0.8), racine)


# -----------------------------------------------------------------------
# LE PORTIQUE D'ARRIVEE
# -----------------------------------------------------------------------
#
# Le portique des courses sur route : deux colonnes et une poutre en treillis
# d'aluminium qui enjambent les huit couloirs, une banniere « ARRIVEE », et
# au-dessus l'horloge de course. Il est pose soixante centimetres APRES la
# ligne, pour que le damier reste net sous les pieds.
#
# L'horloge est un caisson noir : les chiffres, eux, sont ecrits par le jeu
# a chaque image (decor-champ-de-mars.js), sur la face dont la position part
# dans le manifeste. Une horloge figee sur « 9.98 » serait fausse dix fois
# par seconde.
LARGEUR_PISTE = 9.76          # huit couloirs de 1,22 m
X_PORTIQUE = 0.6


def texte(bm, corps, taille, cy, cz, x, police=None):
    """Un texte a plat sur le plan X = x, lisible depuis la camera du jeu.

    L'ecran du jeu avance avec +Y et monte avec +Z (voir l'en-tete) : la
    ligne de texte suit +Y, le haut des lettres +Z. L'epaisseur part vers -X,
    du cote de la camera.
    """
    cu = bpy.data.curves.new('txt', 'FONT')
    cu.body = corps
    cu.size = taille
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = 0.012
    if police and os.path.exists(police):
        cu.font = bpy.data.fonts.load(police)
    ob = bpy.data.objects.new('txt', cu)
    bpy.context.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    tmp = bmesh.new()
    tmp.from_mesh(me)
    for v in tmp.verts:
        tx, ty, tz = v.co
        v.co = Vector((x - tz, cy + tx, cz + ty))
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)


def colonne(lot, x, y, z1, cote=0.36, pas=0.42, e=0.05):
    """Une colonne en treillis : quatre membrures et un zigzag sur chaque face."""
    h = cote / 2
    cc = [(x - h, y - h), (x + h, y - h), (x + h, y + h), (x - h, y + h)]
    for (cx, cy) in cc:
        lot.poutre((cx, cy, 0.0), (cx, cy, z1), e)
    z = 0.0
    k = 0
    while z < z1 - 1e-3:
        z2 = min(z1, z + pas)
        for i in range(4):
            a, b = cc[i], cc[(i + 1) % 4]
            if k % 2:
                a, b = b, a
            lot.poutre((a[0], a[1], z), (b[0], b[1], z2), e * 0.55)
        z = z2
        k += 1


def portique(racine, dessus=False):
    """Le portique entier — ou, avec `dessus`, ce qui passe DEVANT les coureurs.

    Le moteur le dessine en deux fois. Entier, ombre comprise, avant les
    coureurs : aucun ne peut alors disparaitre derriere lui. Puis, apres eux,
    la poutre, la banniere, l'horloge et la colonne cote camera : a l'ecran,
    seuls les coureurs qui ont PASSE la ligne les croisent, et ceux-la sont
    derriere. La colonne du fond n'y est pas — un coureur qui la croise est
    devant elle. Meme repere, meme camera : les deux images se superposent au
    pixel.
    """
    Lalu, Lbleu, Lblanc, Lrouge, Lnoir = (Lot() for _ in range(5))
    y0, y1 = -0.9, LARGEUR_PISTE + 0.9
    X = X_PORTIQUE
    zb0, zb1 = 3.35, 4.15                     # la poutre et sa banniere
    colonne(Lalu, X + 0.2, y0, zb1 + 0.1)
    if not dessus:
        colonne(Lalu, X + 0.2, y1, zb1 + 0.1)
    for i in range(2):
        L = (X + 0.02, X + 0.38)[i]
        for zz in (zb0, zb1):
            Lalu.poutre((L, y0, zz), (L, y1, zz), 0.05)
    y = y0
    k = 0
    while y < y1 - 1e-3:
        y2 = min(y1, y + 0.4)
        for L in (X + 0.02, X + 0.38):
            a, b = (y, zb0), (y2, zb1)
            if k % 2:
                a, b = (y, zb1), (y2, zb0)
            Lalu.poutre((L, a[0], a[1]), (L, b[0], b[1]), 0.03)
        y = y2
        k += 1
    # la banniere, devant la poutre : bleue, cerclee de blanc
    Lblanc.boite(X - 0.06, y0 + 0.25, zb0 - 0.04, X - 0.02, y1 - 0.25, zb1 + 0.04)
    Lbleu.boite(X - 0.09, y0 + 0.30, zb0, X - 0.05, y1 - 0.30, zb1)
    # le tricolore sous la banniere
    tiers = (y1 - y0 - 0.6) / 3
    for i, lot in enumerate((Lbleu, Lblanc, Lrouge)):
        lot.boite(X - 0.09, y0 + 0.30 + i * tiers, zb0 - 0.16, X - 0.05, y0 + 0.30 + (i + 1) * tiers,
                  zb0 - 0.05)
    police = '/System/Library/Fonts/Supplemental/Arial Black.ttf'
    cy = (y0 + y1) / 2
    texte(Lblanc.bm, 'ARRIVÉE', 0.52, cy, (zb0 + zb1) / 2, X - 0.095, police)
    for yy in (y0 + 0.30 + (cy - 1.9 - y0 - 0.30) / 2, cy + 1.9 + (y1 - 0.30 - cy - 1.9) / 2):
        texte(Lblanc.bm, 'CHAMPIONNAT\nDE FRANCE', 0.2, yy, (zb0 + zb1) / 2, X - 0.095, police)
    # l'horloge, posee sur la poutre
    Lnoir.boite(X - 0.10, cy - 1.3, zb1 + 0.06, X + 0.4, cy + 1.3, zb1 + 0.86)
    Lalu.boite(X - 0.12, cy - 1.36, zb1 + 0.02, X + 0.42, cy + 1.36, zb1 + 0.08)
    Lalu.objet('portique_alu', peinture('alu', 'alu', 0.8), racine)
    Lbleu.objet('portique_bleu', peinture('bleu', 'bleu', 0.4), racine)
    Lblanc.objet('portique_blanc', peinture('blanc', 'blanc', 0.3), racine)
    Lrouge.objet('portique_rouge', peinture('rouge', 'rouge', 0.3), racine)
    Lnoir.objet('portique_horloge', peinture('horloge', 'horloge', 0.2), racine)
    # la face de l'horloge ou le jeu ecrit le chrono, dans le repere de la piece
    return {'horloge': {'x': round(X - 0.105, 3), 'y0': round(cy - 1.18, 3), 'y1': round(cy + 1.18, 3),
                        'z0': round(zb1 + 0.16, 3), 'z1': round(zb1 + 0.76, 3)}}


PIECES = {
    # nom : (constructeur, pixels par metre, ombre au sol)
    'tour': (tour, 48.0, False),
    'rideau': (rideau, 64.0, True),
    'if': (if_cone, 96.0, True),
    'ilot': (ilot, 64.0, False),
    'vauban': (vauban, 96.0, True),
    'portique': (portique, 64.0, True),
    'portique_dessus': (lambda racine: portique(racine, dessus=True), 64.0, False),
}


# -----------------------------------------------------------------------
# LA VUE ET LE RENDU
# -----------------------------------------------------------------------

def racine_miroir():
    e = bpy.data.objects.new('REPERE_JEU', None)
    bpy.context.collection.objects.link(e)
    e.matrix_world = Matrix(((0, 1, 0, 0), (1, 0, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)))
    return e


def camera(px_par_m, largeur, hauteur, centre):
    sc = bpy.context.scene
    sc.render.resolution_x = largeur
    sc.render.resolution_y = hauteur
    sc.render.resolution_percentage = 100
    d = Vector((1, 1, -2 * SA)).normalized()
    haut = Vector((SA, SA, 1)).normalized()
    droite = d.cross(haut).normalized()
    rot = Matrix((droite, haut, -d)).transposed()
    cd = bpy.data.cameras.new('vue_cdm')
    cd.type = 'ORTHO'
    V = px_par_m * math.sqrt(2 * SA * SA + 1)
    cd.ortho_scale = largeur / (V * ETIREMENT)
    cd.sensor_fit = 'HORIZONTAL'
    sc.render.pixel_aspect_x = 1.0
    sc.render.pixel_aspect_y = ETIREMENT
    cd.clip_start = 0.01
    cd.clip_end = 600
    cam = bpy.data.objects.new('vue_cdm', cd)
    bpy.context.collection.objects.link(cam)
    c = vue.miroir(centre)
    cam.matrix_world = Matrix.Translation(c - d * 200) @ rot.to_4x4()
    sc.camera = cam
    return cam


def ecran(X, Y, Z):
    return (CA * (-X + Y), -(SA * (X + Y) + Z))


def points_jeu():
    pts = []
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.get('sol'):
            continue
        mw = o.matrix_world
        for v in o.data.vertices:
            w = mw @ v.co
            pts.append((w.y, w.x, w.z))
    return pts


def cadre(pts, avec_ombre):
    e = []
    for X, Y, Z in pts:
        e.append(ecran(X, Y, Z))
        if avec_ombre and Z > 0.02:
            e.append(ecran(X - L[0] / L[2] * Z, Y - L[1] / L[2] * Z, 0))
    xs, ys = [p[0] for p in e], [p[1] for p in e]
    return min(xs), min(ys), max(xs), max(ys)


def centre_jeu(sx, sy):
    return ((-sy / SA - sx / CA) / 2, (-sy / SA + sx / CA) / 2, 0.0)


def moteur(sc, nom):
    for n in ([nom] if nom == 'CYCLES' else ['BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE']):
        try:
            sc.render.engine = n
            return
        except TypeError:
            continue


def lire(f):
    img = bpy.data.images.load(f)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(img)
    return a[::-1]


def ecrire_webp(a, f, qualite=90):
    h, w = a.shape[:2]
    img = bpy.data.images.new('sortie', w, h, alpha=True)
    img.pixels = a[::-1].ravel().tolist()
    img.filepath_raw = f
    img.file_format = 'WEBP'
    bpy.context.scene.render.image_settings.quality = qualite
    img.save()
    bpy.data.images.remove(img)


def rendre(nom):
    fabrique, ppm, ombre = PIECES[nom]
    vider()
    racine = racine_miroir()
    extra = fabrique(racine) or {}
    bpy.context.view_layer.update()
    pts = points_jeu()
    x0, y0, x1, y1 = cadre(pts, ombre)
    marge = 0.3
    W = int(math.ceil((x1 - x0 + 2 * marge) * ppm))
    H = int(math.ceil((y1 - y0 + 2 * marge) * ppm))
    c = centre_jeu((x0 + x1) / 2, (y0 + y1) / 2)
    sc = bpy.context.scene
    sc.render.film_transparent = True
    try:
        sc.view_settings.view_transform = 'Raw'
    except TypeError:
        sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'
    cam = camera(ppm, W, H, c)
    moteur(sc, 'EEVEE')
    try:
        sc.eevee.taa_render_samples = 32
    except AttributeError:
        pass
    f_col = '/tmp/cdm-couleur.png'
    sc.render.filepath = f_col
    bpy.ops.render.render(write_still=True)
    from bpy_extras.object_utils import world_to_camera_view
    co = world_to_camera_view(sc, cam, vue.miroir((0, 0, 0)))
    ancre = (co.x * W, (1 - co.y) * H)
    col = lire(f_col)

    if ombre:
        for o in bpy.data.objects:
            if o.type == 'MESH':
                o.visible_camera = False
        bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 0, 0))
        sol = bpy.context.active_object
        sol.is_shadow_catcher = True
        s = bpy.data.lights.new('soleil', type='SUN')
        s.energy = 4.0
        s.angle = math.radians(3.5)
        so = bpy.data.objects.new('soleil', s)
        bpy.context.collection.objects.link(so)
        so.rotation_euler = vue.miroir(L).to_track_quat('Z', 'Y').to_euler()
        moteur(sc, 'CYCLES')
        sc.cycles.samples = 48
        sc.cycles.use_denoising = True
        sc.cycles.device = 'CPU'
        f_omb = '/tmp/cdm-ombre.png'
        sc.render.filepath = f_omb
        bpy.ops.render.render(write_still=True)
        omb = lire(f_omb)
        S = np.clip(omb[..., 3], 0, 1) * 0.34
        Ca = col[..., 3]
        teinte = np.array([0.02, 0.06, 0.04], dtype=np.float32)
        out_a = Ca + S * (1 - Ca)
        num = col[..., :3] * Ca[..., None] + teinte * (S * (1 - Ca))[..., None]
        out = np.zeros_like(col)
        ok = out_a > 1e-4
        out[..., :3][ok] = num[ok] / out_a[ok][:, None]
        out[..., 3] = out_a
    else:
        out = col

    if nom == 'tour':
        # la brume des huit cents metres : un voile de ciel sur le fer
        ciel = np.array([158, 204, 240], dtype=np.float32) / 255.0
        out[..., :3] = out[..., :3] * 0.86 + ciel * 0.14

    a = out[..., 3]
    ys, xs = np.nonzero(a > 0.004)
    ax0, ax1 = max(0, xs.min() - 2), min(out.shape[1], xs.max() + 3)
    ay0, ay1 = max(0, ys.min() - 2), min(out.shape[0], ys.max() + 3)
    out = out[ay0:ay1, ax0:ax1]
    os.makedirs(DOSSIER, exist_ok=True)
    f = os.path.join(DOSSIER, nom + '.webp')
    ecrire_webp(out, f)
    r = {'f': nom + '.webp', 'w': int(ax1 - ax0), 'h': int(ay1 - ay0),
         'ax': round(ancre[0] - ax0, 2), 'ay': round(ancre[1] - ay0, 2), 'ppm': ppm}
    r.update(extra)
    return r


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    seules = args[args.index('--pieces') + 1].split(',') if '--pieces' in args else list(PIECES)
    man = json.load(open(F_MAN)) if os.path.exists(F_MAN) else {}
    man['angle'] = ANGLE
    man.setdefault('pieces', {})
    man['longueurs'] = {'rideau': LONG_RIDEAU, 'ilot': LONG_ILOT, 'vauban': LONG_VAUBAN}
    for nom in seules:
        r = rendre(nom)
        man['pieces'][nom] = r
        json.dump(man, open(F_MAN, 'w'), indent=1, sort_keys=True)
        print('  champdemars %s : %dx%d' % (nom, r['w'], r['h']))
    print('manifeste : ' + F_MAN)


if __name__ == '__main__':
    main()
