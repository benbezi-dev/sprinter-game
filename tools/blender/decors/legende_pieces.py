# -----------------------------------------------------------------------
# SPRINTER — les pieces de premier plan de la Legende, modelisees ici.
#
#   blender -b --factory-startup -P tools/blender/decors/legende_pieces.py -- [--pieces torii,cabine,morris]
#
# Sans Tripo : des formes simples, a leur taille reelle, peintes de la
# formule de lumiere du jeu (celle de legende_monuments.py, en couleurs
# franches au lieu d'une texture), rendues sous le meme angle et ecrites a
# cote des monuments, dans le meme manifeste :
#
#   torii   — la porte vermillon de Fushimi Inari (Kyoto) : deux piliers a
#             socle noir, le nuki, le shimaki vermillon et le kasagi noir
#             releve aux deux bouts, la plaque au milieu.
#   cabine  — la cabine telephonique rouge de Londres (K6) : la boite, son
#             toit bombe, ses vitres a petits carreaux, le bandeau blanc.
#   morris  — la colonne Morris de Paris : le fut vert sombre, les affiches
#             tout autour, le dome et son epi.
# -----------------------------------------------------------------------

import bpy
import json
import math
import os
import sys

import bmesh
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import legende_monuments as LM  # noqa: E402


def couleur(nom, rgb):
    """La matiere du jeu, d'une couleur franche (0-255)."""
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    L = nt.links

    def math_(op, a, b=None):
        n = nt.nodes.new('ShaderNodeMath'); n.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L.new(v, n.inputs[i])
        return n.outputs[0]
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    L.new(geo.outputs['Normal'], sep.inputs[0])
    S = LM.SOLEIL
    nl = math_('ADD', math_('ADD', math_('MULTIPLY', sep.outputs['X'], S.x), math_('MULTIPLY', sep.outputs['Y'], S.y)),
               math_('MULTIPLY', sep.outputs['Z'], S.z))
    t = math_('ADD', 0.34, math_('MULTIPLY', math_('MAXIMUM', nl, 0.0), 0.60))
    t = math_('ADD', t, math_('MULTIPLY', math_('ADD', math_('MULTIPLY', sep.outputs['Z'], 0.5), 0.5), 0.20))
    t = math_('ADD', t, math_('MULTIPLY', math_('SUBTRACT', 0.5, math_('MULTIPLY', sep.outputs['Z'], 0.5)), 0.06))
    col = nt.nodes.new('ShaderNodeRGB')
    col.outputs[0].default_value = (rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1)
    mul = nt.nodes.new('ShaderNodeVectorMath'); mul.operation = 'SCALE'
    L.new(col.outputs[0], mul.inputs[0]); L.new(t, mul.inputs['Scale'])
    em = nt.nodes.new('ShaderNodeEmission')
    L.new(mul.outputs[0], em.inputs['Color'])
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    L.new(em.outputs[0], out.inputs['Surface'])
    return m


MATS = {}


def mat(nom, rgb):
    if nom not in MATS:
        MATS[nom] = couleur(nom, rgb)
    return MATS[nom]


def boite(c, taille, m, rot=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    o = bpy.context.active_object
    o.scale = taille
    o.rotation_euler = (0, rot, 0)
    o.data.materials.append(m)
    return o


def cylindre(c, r, h, m, n=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=h, location=(c[0], c[1], c[2] + h / 2))
    o = bpy.context.active_object
    o.data.materials.append(m)
    return o


def torii():
    vermillon, noir = mat('vermillon', (228, 66, 34)), mat('noir', (28, 24, 26))
    or_ = mat('or', (226, 182, 74))
    for x in (-1.9, 1.9):
        cylindre((x, 0, 0), 0.30, 0.55, noir)                 # le socle (kamaki)
        cylindre((x, 0, 0.5), 0.23, 4.0, vermillon)          # le pilier
    boite((0, 0, 3.55), (5.0, 0.22, 0.26), vermillon)         # le nuki
    boite((0, 0, 3.95), (0.26, 0.2, 0.6), vermillon)          # le gakuzuka
    boite((0, -0.13, 3.95), (0.7, 0.08, 0.5), noir)           # la plaque
    boite((0, -0.18, 3.95), (0.5, 0.04, 0.32), or_)
    boite((0, 0, 4.42), (5.6, 0.3, 0.3), vermillon)           # le shimaki
    # le kasagi, noir, releve aux deux bouts : trois troncons
    boite((0, 0, 4.72), (4.4, 0.36, 0.32), noir)
    # (une rotation positive autour de Y monte le bout -x : a gauche +, a droite -)
    boite((-2.75, 0, 4.82), (1.4, 0.36, 0.3), noir, rot=math.radians(9))
    boite((2.75, 0, 4.82), (1.4, 0.36, 0.3), noir, rot=math.radians(-9))


def cabine():
    rouge, blanc, vitre = mat('rouge_k6', (204, 32, 30)), mat('blanc', (240, 238, 232)), mat('vitre', (52, 66, 78))
    boite((0, 0, 0.08), (1.0, 1.0, 0.16), rouge)              # le socle
    boite((0, 0, 1.18), (0.9, 0.9, 2.1), rouge)               # la boite
    # les vitres a petits carreaux, sur les quatre faces
    for ax, sg in (('y', -1), ('y', 1), ('x', -1), ('x', 1)):
        for i in range(3):
            for j in range(6):
                u, z = (i - 1) * 0.2, 0.55 + j * 0.22
                c = (u, sg * 0.452, z) if ax == 'y' else (sg * 0.452, u, z)
                t = (0.16, 0.02, 0.18) if ax == 'y' else (0.02, 0.16, 0.18)
                boite(c, t, vitre)
        c = (0, sg * 0.455, 2.0) if ax == 'y' else (sg * 0.455, 0, 2.0)
        boite(c, (0.6, 0.02, 0.12) if ax == 'y' else (0.02, 0.6, 0.12), blanc)   # le bandeau
    boite((0, 0, 2.3), (0.98, 0.98, 0.14), rouge)             # la corniche
    # le toit bombe
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.52, location=(0, 0, 2.33))
    o = bpy.context.active_object
    o.scale = (1, 1, 0.36)
    o.data.materials.append(rouge)


def morris():
    vert, vert_clair = mat('vert_morris', (34, 72, 52)), mat('vert_clair', (58, 110, 80))
    affiches = [mat('affiche%d' % i, c) for i, c in enumerate(
        [(232, 196, 92), (214, 74, 62), (240, 236, 222), (44, 108, 186), (236, 150, 60), (120, 60, 140)])]
    cylindre((0, 0, 0), 0.62, 0.25, vert)                     # le socle
    cylindre((0, 0, 0.25), 0.56, 2.4, vert)                   # le fut
    # les affiches, en bandes verticales autour du fut
    n = 12
    for i in range(n):
        a = 2 * math.pi * i / n
        x, y = 0.575 * math.cos(a), 0.575 * math.sin(a)
        o = boite((x, y, 1.45), (0.27, 0.03, 1.7 - 0.2 * (i % 3)), affiches[i % len(affiches)])
        o.rotation_euler = (0, 0, a + math.pi / 2)
    cylindre((0, 0, 2.65), 0.66, 0.16, vert_clair)            # la corniche
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.6, location=(0, 0, 2.81))
    o = bpy.context.active_object
    o.scale = (1, 1, 0.55)
    o.data.materials.append(vert)
    cylindre((0, 0, 3.1), 0.05, 0.45, vert_clair)             # l'epi
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.09, location=(0, 0, 3.58))
    bpy.context.active_object.data.materials.append(vert_clair)


PIECES = {'torii': torii, 'cabine': cabine, 'morris': morris}


def rendre_piece(nom):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    PIECES[nom]()
    # tout en un objet, a sa taille reelle ; le rendu le ramene a une unite
    objs = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    hauteur = max(v.co.z for v in o.data.vertices)
    largeur = max(v.co.x for v in o.data.vertices) - min(v.co.x for v in o.data.vertices)
    LM.normaliser(o, 0)
    for p in o.data.polygons:
        p.use_smooth = False
    tmp = '/tmp/legende-piece-%d.png' % os.getpid()
    W, H, pied = LM.rendre(o, 12.0, 900, tmp)
    a = LM.lire(tmp)
    ys, xs = np.nonzero(a[..., 3] > 0.004)
    x0, x1 = max(0, xs.min() - 2), min(W, xs.max() + 3)
    y0, y1 = max(0, ys.min() - 2), min(H, ys.max() + 3)
    a = a[y0:y1, x0:x1]
    f = nom + '.webp'
    LM.ecrire(a, os.path.join(LM.DOSSIER, f))
    man = json.load(open(LM.F_MAN)) if os.path.exists(LM.F_MAN) else {'pieces': {}}
    man.setdefault('pieces', {})[nom] = {
        'f': f, 'w': int(x1 - x0), 'h': int(y1 - y0),
        'ax': round(pied[0] - x0, 2), 'ay': round(pied[1] - y0, 2),
        'largeur_m': round(largeur, 2), 'hauteur_m': round(hauteur, 2)}
    json.dump(man, open(LM.F_MAN, 'w'), indent=1, sort_keys=True)
    print('PIECE %s : %dx%d, %.2f m de large, %.2f m de haut' % (nom, x1 - x0, y1 - y0, largeur, hauteur))


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    seules = args[args.index('--pieces') + 1].split(',') if '--pieces' in args else list(PIECES)
    for nom in seules:
        rendre_piece(nom)
