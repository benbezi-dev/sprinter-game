# -----------------------------------------------------------------------
# SPRINTER — les spectateurs et leurs sieges, rendus dans Blender.
#
#   blender -b -P tools/blender/decors/tribune.py
#
# LE PUBLIC ETAIT A LA MAUVAISE ECHELLE. Les gradins du jeu sont a la taille
# reelle ; les spectateurs, eux, etaient des figurines de onze pixels semees
# au hasard dans une tuile repetee — le tiers de la taille d'un coureur.
# Une foule de nains qui se chevauchent ne se lit pas : on voyait un semis
# de confettis, pas des gens.
#
# Ici chaque spectateur est a l'echelle des coureurs, ASSIS sur un siege,
# face a la piste. Il est rendu sous la vue du jeu (vue.py) avec sa lumiere
# (matiere.py), en trois poses — assis, qui applaudit, debout les bras
# leves — et sous vingt-huit caps, pour les lignes droites comme pour les
# virages.
#
# LES COULEURS NE SONT PAS RENDUES, ELLES SONT POSEES PAR LE JEU. Chaque
# image est rendue en quatre passes, dans la meme mise en page :
#
#   base     ce qui ne change pas de couleur : cheveux, pantalon, chaussures
#   peau     la peau, en blanc eclaire : le jeu la teinte a la carnation
#   maillot  le haut, en blanc eclaire : le jeu le teinte a la couleur
#   siege    le siege, en blanc eclaire : le jeu le teinte a celle du stade
#
# Chaque passe masque ce que les autres couvrent (un bras devant le maillot
# le cache vraiment), donc les quatre se superposent sans jamais se trahir.
# Quatre images pour tout le public de tous les stades, et des milliers de
# combinaisons de carnation et de couleur, sans un rendu de plus.
# -----------------------------------------------------------------------

import bpy
import bmesh
import sys
import os
import math
import json
import numpy as np
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vue
import matiere as M
import importlib
for mod in (vue, M):
    importlib.reload(mod)

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
PPM = 110.0                       # pixels par metre dans l'atlas
POSES = ['assis', 'applaudit', 'debout', 'vide']
# Vingt-quatre caps reguliers, et les quatre caps exacts des lignes droites
# (0 et 180, avec et sans la rotation de vue des courses en virage).
CAPS = sorted(set([15.0 * k for k in range(24)] + [346.0, 166.0]))
CELL_W, CELL_H = 1.7, 2.7         # la case de chaque image, en metres d'ecran
# Ou tombe le pied du siege dans la case. Assez bas pour que les bras leves
# d'un spectateur debout (deux metres) tiennent dans SA case : a 2,35 m de
# haut, ils mordaient sur la ligne du dessus.
ANCRE_Y = 0.86

CATEGORIES = ('base', 'peau', 'maillot', 'siege')


# -----------------------------------------------------------------------
# LA MODELISATION
# -----------------------------------------------------------------------

def _poser(o, cat, racine):
    o.parent = racine
    o['cat'] = cat
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def _mesh(nom, bm, cat, racine):
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    return _poser(o, cat, racine)


def boite(nom, cat, racine, c, t, rot_x=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=t, verts=bm.verts)
    if rot_x:
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rot_x, 3, 'X'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=c, verts=bm.verts)
    return _mesh(nom, bm, cat, racine)


def membre(nom, cat, racine, a, b, r0, r1=None, cotes=8):
    """Un tronc de cone de a a b, bouts arrondis par une petite sphere."""
    a, b = Vector(a), Vector(b)
    r1 = r0 if r1 is None else r1
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=cotes, radius1=r0, radius2=r1,
                          depth=(b - a).length)
    q = Vector((0, 0, 1)).rotation_difference((b - a).normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(),
                        verts=bm.verts)
    for centre, r in ((a, r0), (b, r1)):
        s = bmesh.new()
        bmesh.ops.create_uvsphere(s, u_segments=8, v_segments=5, radius=r)
        bmesh.ops.translate(s, vec=centre, verts=s.verts)
        me = bpy.data.meshes.new('tmp')
        s.to_mesh(me); s.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    return _mesh(nom, bm, cat, racine)


def boule(nom, cat, racine, c, r, sx=1.0, sy=1.0, sz=1.0, seg=12, demi=False):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2 + 1, radius=r)
    for v in bm.verts:
        if demi and v.co.z < 0:
            v.co.z *= 0.25
        v.co.x *= sx; v.co.y *= sy; v.co.z *= sz
    bmesh.ops.translate(bm, vec=c, verts=bm.verts)
    return _mesh(nom, bm, cat, racine)


def buste(nom, cat, racine, bas, haut, lb, lh, pb, ph):
    """Un tronc a section ovale : large aux epaules, plus etroit a la taille."""
    bm = bmesh.new()
    n = 10
    anneaux = []
    for (c, l, p) in ((bas, lb, pb), (haut, lh, ph)):
        anneaux.append([bm.verts.new((c[0] + l * math.cos(2 * math.pi * k / n),
                                      c[1] + p * math.sin(2 * math.pi * k / n), c[2]))
                        for k in range(n)])
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((anneaux[0][k], anneaux[0][j], anneaux[1][j], anneaux[1][k]))
    bm.faces.new(list(reversed(anneaux[0])))
    bm.faces.new(anneaux[1])
    return _mesh(nom, bm, cat, racine)


def siege(racine, releve=False):
    """Un siege coque de stade : l'assise, le dossier, et la patte au sol."""
    boite('patte', 'siege', racine, (0, 0.16, 0.22), (0.10, 0.10, 0.44))
    if releve:
        # un siege dont on s'est leve : l'assise se replie contre le dossier,
        # d'un seul tenant avec lui — replie a part, il flottait en l'air
        boite('assise', 'siege', racine, (0, 0.15, 0.62), (0.44, 0.06, 0.38))
    else:
        boite('assise', 'siege', racine, (0, 0.02, 0.43), (0.44, 0.40, 0.05))
    boite('dossier', 'siege', racine, (0, 0.21, 0.66), (0.44, 0.05, 0.46), rot_x=-0.12)


def spectateur(racine, pose):
    """Face a -Y (vers la piste), le siege a l'origine."""
    if pose == 'vide':
        siege(racine)
        return
    debout = pose == 'debout'
    siege(racine, releve=debout)
    if debout:
        zb, yb = 0.92, -0.18
    else:
        zb, yb = 0.50, 0.04
    # le bassin et les jambes
    boite('bassin', 'base', racine, (0, yb, zb), (0.34, 0.22, 0.16))
    for s in (-1, 1):
        x = s * 0.10
        if debout:
            genou, cheville = (x * 1.05, yb - 0.02, 0.48), (x * 1.1, yb, 0.08)
        else:
            genou, cheville = (x * 1.08, yb - 0.44, 0.52), (x * 1.1, yb - 0.50, 0.08)
        membre('cuisse', 'base', racine, (x, yb, zb), genou, 0.078, 0.062)
        membre('tibia', 'base', racine, genou, cheville, 0.056, 0.045)
        boite('chaussure', 'base', racine, (cheville[0], cheville[1] - 0.06, 0.04), (0.10, 0.24, 0.08))
    # le buste, le cou, la tete
    epaule = zb + 0.44
    buste('buste', 'maillot', racine, (0, yb + 0.01, zb + 0.04), (0, yb, epaule), 0.155, 0.19, 0.105, 0.115)
    membre('cou', 'peau', racine, (0, yb, epaule), (0, yb - 0.01, epaule + 0.10), 0.048)
    tete = (0, yb - 0.02, epaule + 0.22)
    boule('tete', 'peau', racine, tete, 0.105, sy=1.08, sz=1.1)
    # cheveux : une calotte a peine plus large que le crane, qui descend a
    # l'arriere — c'est elle qui dit « une tete » a quinze pixels de haut
    boule('cheveux', 'base', racine, (0, yb + 0.012, tete[2] + 0.025), 0.112, sy=1.1, sz=0.95, demi=True)
    # les bras
    for s in (-1, 1):
        sh = (s * 0.20, yb, epaule - 0.04)
        if pose == 'assis':
            coude, main = (s * 0.23, yb - 0.10, zb + 0.18), (s * 0.13, yb - 0.30, zb + 0.10)
        elif pose == 'applaudit':
            coude, main = (s * 0.24, yb - 0.22, zb + 0.30), (s * 0.04, yb - 0.36, zb + 0.50)
        else:
            coude, main = (s * 0.31, yb - 0.06, epaule + 0.28), (s * 0.27, yb - 0.10, epaule + 0.56)
        membre('bras', 'maillot', racine, sh, coude, 0.050, 0.044)
        membre('avant_bras', 'peau', racine, coude, main, 0.040, 0.034)
        boule('main', 'peau', racine, main, 0.045)


# -----------------------------------------------------------------------
# LA MISE EN PAGE ET LES PASSES
# -----------------------------------------------------------------------

def position(ligne, col):
    """Le pied du siege (ligne, colonne) dans le repere du jeu.

    Colonnes le long de la largeur de l'ecran, lignes le long de sa hauteur :
    X = -a·col + b·ligne et Y = a·col + b·ligne donnent un ecran en grille
    exacte (voir la projection en tete de vue.py).
    """
    a = CELL_W / (2 * vue.COS)
    b = CELL_H / (2 * vue.SIN)
    return (-a * col - b * ligne, a * col - b * ligne, 0.0)


def construire():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    racine = vue.racine_miroir()
    for li, pose in enumerate(POSES):
        for ci, cap in enumerate(CAPS):
            p = position(li, ci)
            e = bpy.data.objects.new('case', None)
            bpy.context.collection.objects.link(e)
            e.parent = racine
            e.location = p
            e.rotation_euler = (0, 0, math.radians(cap))
            spectateur(e, pose)
    bpy.context.view_layer.update()
    return racine


def materiaux():
    couleurs = {'base': None, 'peau': (255, 255, 255), 'maillot': (255, 255, 255), 'siege': (255, 255, 255)}
    base = {
        'bassin': (46, 52, 70), 'cuisse': (46, 52, 70), 'tibia': (46, 52, 70),
        'chaussure': (30, 30, 36), 'cheveux': (34, 26, 22),
    }
    mats = {}
    for nom, c in base.items():
        mats['base:' + nom] = M.peinture('base_' + nom, c, liseret=0.5)
    blanc = M.peinture('blanc', (255, 255, 255), liseret=0.5)
    trou = bpy.data.materials.new('trou')
    trou.use_nodes = True
    nt = trou.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    h = nt.nodes.new('ShaderNodeHoldout')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(h.outputs[0], out.inputs['Surface'])
    return mats, blanc, trou


def appliquer(passe, mats, blanc, trou):
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        cat = o.get('cat')
        nom = o.name.split('.')[0]
        o.data.materials.clear()
        if passe == 'base':
            m = mats.get('base:' + nom) if cat == 'base' else trou
            o.data.materials.append(m or trou)
        else:
            o.data.materials.append(blanc if cat == passe else trou)


def main():
    racine = construire()
    # le cadre : toutes les cases
    W = int(math.ceil(CELL_W * len(CAPS) * PPM))
    H = int(math.ceil(CELL_H * len(POSES) * PPM))
    # le centre de l'image tombe au centre de la grille
    cx = (len(CAPS) - 1) / 2.0
    cy = (len(POSES) - 1) / 2.0
    c0 = position(cy, cx)
    # decale d'une demi-case vers le bas pour que le pied tombe a ANCRE_Y
    dz = (ANCRE_Y - 0.5) * CELL_H
    centre = (c0[0] + dz / (2 * vue.SIN), c0[1] + dz / (2 * vue.SIN), 0.0)
    sc = bpy.context.scene
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Raw'
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 24
    # Rendu directement en WebP : l'atlas part tel quel dans le jeu.
    sc.render.image_settings.file_format = 'WEBP'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.quality = 94
    cam = vue.camera(PPM, W, H, centre=centre)
    mats, blanc, trou = materiaux()

    dossier = os.path.join(RACINE, 'public', 'decors', 'tribune')
    os.makedirs(dossier, exist_ok=True)
    for passe in CATEGORIES:
        appliquer(passe, mats, blanc, trou)
        sc.render.filepath = os.path.join(dossier, passe + '.webp')
        bpy.ops.render.render(write_still=True)
        print('  passe %s : %dx%d' % (passe, W, H))

    ancres = [[list(map(lambda v: round(v, 2), vue.ancre_pixel(cam, position(li, ci))))
               for ci in range(len(CAPS))] for li in range(len(POSES))]

    # LE CADRE UTILE DE CHAQUE IMAGE. Une case fait 1,7 x 2,7 m ; un
    # spectateur assis n'en occupe pas la moitie. Le jeu compose une image par
    # combinaison de pose, de carnation et de couleur : sans ce recadrage,
    # chacune pesait deux fois ce qu'elle montre. Mesure sur les quatre passes
    # a la fois, en pixels de l'atlas, par rapport au pied du siege.
    alpha = None
    for passe in CATEGORIES:
        im = bpy.data.images.load(os.path.join(dossier, passe + '.webp'))
        w, h = im.size
        a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, 3]
        bpy.data.images.remove(im)
        alpha = a if alpha is None else np.maximum(alpha, a)
    cadres = []
    for li in range(len(POSES)):
        rang = []
        for ci in range(len(CAPS)):
            ax, ay = ancres[li][ci]
            x0 = int(max(0, ax - CELL_W * PPM / 2)); x1 = int(min(W, ax + CELL_W * PPM / 2))
            y0 = int(max(0, ay - CELL_H * PPM * ANCRE_Y)); y1 = int(min(H, ay + CELL_H * PPM * (1 - ANCRE_Y)))
            ys, xs = np.nonzero(alpha[y0:y1, x0:x1] > 0.01)
            if len(xs) == 0:
                rang.append([0, 0, 1, 1])
                continue
            rang.append([round(x0 + xs.min() - 1 - ax, 1), round(y0 + ys.min() - 1 - ay, 1),
                         round(x0 + xs.max() + 2 - ax, 1), round(y0 + ys.max() + 2 - ay, 1)])
        cadres.append(rang)
    man = {'ppm': PPM, 'poses': POSES, 'caps': CAPS, 'cellW': round(CELL_W * PPM, 2),
           'cellH': round(CELL_H * PPM, 2), 'ancreY': ANCRE_Y, 'ancres': ancres,
           'passes': list(CATEGORIES), 'w': W, 'h': H, 'cadres': cadres}
    f_man = os.path.join(RACINE, 'src', 'game', 'tribune-manifeste.json')
    json.dump(man, open(f_man, 'w'), indent=1)
    print('manifeste : ' + f_man)


if __name__ == '__main__':
    main()
