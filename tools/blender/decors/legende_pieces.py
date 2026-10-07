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
#
# Et le DEPAYSEMENT des stades 2 a 4 (l'auteur, 07/10 : « ajoute plus
# d'elements culturels, ca manque de depaysement » — sauf Menole, l'Olympe et
# l'apotheose) : deux ou trois objets typiques par lieu, poses dans la pelouse
# interieure (game/legende/decors.ts, CULTURE).
#   Kyoto      toro (lanterne de pierre), sakura (cerisier en fleurs)
#   Kingston   kiosque (cabane aux couleurs rasta), jerk (fut-barbecue)
#   Izmir      cesme (fontaine ottomane), simit (charrette du vendeur)
#   Barcelone  trencadis (banc de mosaique de Gaudi), drac (la salamandre
#              du parc Guell)
#   Casablanca fanous (lanterne sur son mat), zellige (fontaine murale)
#   Abuja      tambours (tambours parlants), etal (parasol en tissu ankara),
#              baobab
#   Paris      terrasse (gueridon et chaises de bistrot), wallace (fontaine
#              Wallace), reverbere
#   New York   taxi (le yellow cab), borne (bouche d'incendie), hotdog
#   Londres    boite (pillar box), bus (impériale), garde (guerite et garde)
# -----------------------------------------------------------------------

import bpy
import json
import math
import os
import sys

import random

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


def actif(m=None):
    o = bpy.context.active_object
    if m is not None:
        o.data.materials.append(m)
    return o


def bx(c, dims, m, rot=(0, 0, 0)):
    """Une boite de centre c, de dimensions dims."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=c, rotation=rot)
    o = actif(m)
    o.scale = dims
    return o


def cyl(c, r, h, m, n=24, rot=(0, 0, 0)):
    """Un cylindre de centre c."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=h, location=c, rotation=rot)
    return actif(m)


def cone(c, r1, r2, h, m, n=24, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r1, radius2=r2, depth=h, location=c, rotation=rot)
    return actif(m)


def boule(c, r, m, s=(1, 1, 1), seg=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(8, seg // 2), radius=r, location=c)
    o = actif(m)
    o.scale = s
    return o


def tore(c, R, r, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=c, rotation=rot,
                                     major_segments=24, minor_segments=10)
    return actif(m)


def mosaique(o, couleurs, graine, coupes=2):
    """Couvre o de tesselles : chaque face prend une couleur de la palette."""
    mats = [mat('tess_%d_%d_%d' % c, c) for c in couleurs]
    o.data.materials.clear()
    for mm in mats:
        o.data.materials.append(mm)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    if coupes:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=coupes, use_grid_fill=True)
    rng = random.Random(graine)
    for f in bm.faces:
        f.material_index = rng.randrange(len(mats))
    bm.to_mesh(o.data)
    bm.free()


TRENCADIS = [(250, 248, 240), (36, 84, 178), (244, 196, 48), (64, 150, 84), (232, 120, 48),
             (196, 48, 44), (70, 182, 196)]


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


# --- KYOTO ---------------------------------------------------------------
def toro():
    """La lanterne de pierre (kasuga-doro)."""
    pierre, mousse = mat('pierre', (156, 154, 148)), mat('mousse', (98, 124, 82))
    lumiere = mat('lumiere', (255, 214, 140))
    cyl((0, 0, 0.12), 0.46, 0.24, mousse, n=6)
    cyl((0, 0, 0.7), 0.12, 0.92, pierre, n=12)
    cyl((0, 0, 1.24), 0.38, 0.18, pierre, n=6)
    cyl((0, 0, 1.54), 0.28, 0.42, pierre, n=6)
    bx((0, -0.24, 1.55), (0.22, 0.04, 0.24), lumiere)
    cone((0, 0, 1.9), 0.56, 0.1, 0.3, pierre, n=6)
    boule((0, 0, 2.12), 0.1, pierre, s=(1, 1, 1.4))


def sakura():
    """Un cerisier en fleurs."""
    ecorce = mat('ecorce', (92, 64, 56))
    roses = [mat('rose%d' % i, c) for i, c in enumerate([(246, 184, 206), (240, 160, 190), (252, 212, 226), (236, 146, 180)])]
    cone((0, 0, 0.95), 0.24, 0.14, 1.9, ecorce, n=10)
    for a, d in ((0.5, 1.0), (2.4, 0.9), (4.2, 1.1)):
        cyl((math.cos(a) * 0.35, math.sin(a) * 0.35, 2.1), 0.07, 1.0, ecorce, n=8,
            rot=(math.sin(a) * 0.7, -math.cos(a) * 0.7, 0))
    rng = random.Random(7)
    for i in range(16):
        a = rng.uniform(0, 2 * math.pi); d = rng.uniform(0.2, 1.4)
        boule((math.cos(a) * d, math.sin(a) * d * 0.8, 2.5 + rng.uniform(-0.3, 0.8)),
              rng.uniform(0.45, 0.8), roses[i % 4], seg=12)


# --- KINGSTON ------------------------------------------------------------
def kiosque():
    """La cabane du vendeur, aux couleurs rasta."""
    rouge, or_, vert = mat('k_rouge', (206, 40, 40)), mat('k_or', (250, 200, 30)), mat('k_vert', (20, 140, 70))
    tole, sombre, bois = mat('tole', (130, 148, 156)), mat('k_sombre', (40, 34, 30)), mat('k_bois', (150, 100, 60))
    for i, m in enumerate((rouge, or_, vert)):
        bx((-0.73 + i * 0.73, 0, 1.1), (0.73, 1.8, 2.2), m)
    bx((0, -0.92, 1.25), (1.5, 0.06, 0.7), sombre)          # le guichet
    bx((0, -1.05, 0.88), (1.7, 0.3, 0.06), bois)            # le comptoir
    bx((0, 0, 2.32), (2.6, 2.3, 0.08), tole, rot=(math.radians(-8), 0, 0))
    bx((0, -0.96, 2.62), (1.6, 0.06, 0.42), or_)            # l'enseigne
    bx((0, -0.99, 2.62), (1.3, 0.02, 0.18), vert)


def jerk():
    """Le fut coupe en deux qui sert de barbecue."""
    noir, fer, braise = mat('fut', (44, 44, 48)), mat('fer', (90, 90, 96)), mat('braise', (240, 110, 40))
    cyl((0, 0, 0.82), 0.32, 0.95, noir, rot=(0, math.pi / 2, 0))
    bx((0, -0.18, 0.95), (0.9, 0.04, 0.12), braise)
    cyl((0, 0.18, 1.08), 0.32, 0.95, noir, n=24, rot=(0, math.pi / 2, 0)).scale = (1, 0.5, 1)
    for x in (-0.38, 0.38):
        for y in (-0.2, 0.2):
            cyl((x, y, 0.3), 0.025, 0.6, fer, n=6)
    cyl((0.36, 0.1, 1.3), 0.05, 0.35, fer, n=8)


# --- IZMIR ---------------------------------------------------------------
def cesme():
    """La fontaine ottomane : un bloc de marbre, sa niche, son robinet."""
    marbre, ombre = mat('marbre', (236, 230, 214)), mat('niche', (170, 160, 146))
    turq, laiton, plomb = mat('turq', (52, 150, 160)), mat('laiton', (214, 172, 70)), mat('plomb', (110, 116, 124))
    bx((0, 0, 1.1), (1.7, 0.7, 2.2), marbre)
    bx((0, -0.33, 1.05), (0.9, 0.06, 1.2), ombre)
    cyl((0, -0.33, 1.65), 0.45, 0.06, ombre, n=24, rot=(math.pi / 2, 0, 0))
    bx((0, -0.36, 1.95), (1.5, 0.04, 0.16), turq)
    bx((0, -0.42, 0.85), (0.08, 0.2, 0.06), laiton)
    bx((0, -0.5, 0.3), (1.3, 0.4, 0.3), marbre)            # l'auge
    bx((0, 0, 2.28), (2.0, 0.95, 0.12), plomb)              # l'avant-toit
    boule((0, 0, 2.34), 0.5, plomb, s=(1, 0.6, 0.6))


def simit():
    """La charrette rouge du vendeur de simit."""
    rouge, vitre, roue_ = mat('s_rouge', (196, 36, 40)), mat('s_vitre', (196, 222, 232)), mat('s_roue', (40, 40, 44))
    pain, fer = mat('simit', (196, 128, 64)), mat('s_fer', (180, 180, 186))
    bx((0, 0, 0.75), (1.2, 0.7, 0.7), rouge)
    bx((0, 0, 1.32), (1.1, 0.62, 0.44), vitre)
    for i in range(3):
        tore((-0.3 + i * 0.3, -0.12, 1.3), 0.11, 0.04, pain, rot=(math.pi / 2, 0, 0))
    for x in (-0.45, 0.45):
        cyl((x, -0.38, 0.3), 0.3, 0.06, roue_, n=20, rot=(math.pi / 2, 0, 0))
    bx((0, 0, 1.58), (1.25, 0.75, 0.05), rouge)
    cyl((0.7, 0, 0.9), 0.025, 0.6, fer, n=6, rot=(0, math.radians(70), 0))


# --- BARCELONE -----------------------------------------------------------
def trencadis():
    """Le banc ondulant du parc Guell, couvert de tesselles."""
    o = None
    parts = []
    for i in range(34):
        x = -2.4 + i * 0.145
        y = 0.35 * math.sin(x * 1.4)
        a = math.atan(0.35 * 1.4 * math.cos(x * 1.4))
        parts.append(bx((x, y, 0.38), (0.16, 0.55, 0.76), None, rot=(0, 0, a)))
        parts.append(bx((x, y + 0.24, 0.86), (0.16, 0.12, 0.24), None, rot=(0, 0, a)))
    for p_ in parts:
        p_.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    mosaique(o, TRENCADIS, 3, coupes=2)


def drac():
    """La salamandre de mosaique du parc Guell."""
    parts = []
    chaine = [(-1.1, 0, 0.55, 0.22), (-0.75, 0, 0.6, 0.32), (-0.3, 0, 0.6, 0.38), (0.15, 0, 0.55, 0.36),
              (0.55, 0.05, 0.45, 0.28), (0.85, 0.15, 0.36, 0.2), (1.05, 0.3, 0.28, 0.14), (1.15, 0.45, 0.22, 0.1)]
    for (x, y, z, r) in chaine:
        parts.append(boule((x, y, z), r, None, s=(1.25, 1, 0.8), seg=16))
    parts.append(boule((-1.38, 0, 0.6), 0.2, None, s=(1.4, 0.9, 0.7), seg=16))     # la tete
    for x in (-0.6, 0.2):
        for y in (-0.32, 0.32):
            parts.append(cyl((x, y, 0.22), 0.07, 0.45, None, n=8, rot=(math.copysign(0.4, y), 0, 0)))
    for p_ in parts:
        p_.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    mosaique(o, [(64, 150, 84), (244, 196, 48), (36, 84, 178), (232, 120, 48), (70, 182, 196), (250, 248, 240)], 11, coupes=1)
    noir = mat('oeil', (20, 20, 24))
    boule((-1.5, -0.12, 0.68), 0.04, noir); boule((-1.5, 0.12, 0.68), 0.04, noir)


# --- CASABLANCA ----------------------------------------------------------
def fanous():
    """La lanterne marocaine, sur son mat."""
    noir, laiton = mat('f_noir', (30, 30, 34)), mat('f_laiton', (206, 156, 62))
    verres = [mat('verre%d' % i, c) for i, c in enumerate([(220, 60, 60), (60, 110, 220), (60, 170, 100), (240, 170, 50)])]
    cyl((0, 0, 1.2), 0.05, 2.4, noir, n=10)
    cyl((0, 0, 0.05), 0.22, 0.1, noir, n=12)
    bx((0, 0, 2.38), (0.6, 0.06, 0.06), noir)
    cyl((0, 0, 2.06), 0.2, 0.46, laiton, n=8)
    for i in range(8):
        a = (i + 0.5) * math.pi / 4
        bx((math.cos(a) * 0.19, math.sin(a) * 0.19, 2.06), (0.12, 0.02, 0.36), verres[i % 4], rot=(0, 0, a + math.pi / 2))
    cone((0, 0, 2.42), 0.24, 0.02, 0.36, laiton, n=8)
    boule((0, 0, 2.64), 0.05, laiton)


def zellige():
    """La fontaine murale : une niche en arc outrepasse, tapissee de zellige,
    sous son petit toit de tuiles vertes."""
    chaux, niche, tuile = mat('chaux', (244, 238, 226)), mat('z_niche', (206, 192, 166)), mat('z_tuile', (32, 110, 80))
    laiton = mat('z_laiton', (206, 156, 62))
    bx((0, 0, 1.25), (2.2, 0.4, 2.5), chaux)
    # l'arc : un disque de niche au-dessus du panneau, qui en mange la moitie
    cyl((0, -0.205, 1.55), 0.62, 0.02, niche, n=32, rot=(math.pi / 2, 0, 0))
    bx((0, -0.205, 1.0), (1.24, 0.02, 1.1), niche)
    pan = bx((0, -0.22, 0.85), (1.1, 0.03, 0.9), None)
    mosaique(pan, [(30, 118, 88), (36, 84, 178), (250, 248, 240), (24, 24, 30), (214, 172, 70), (30, 118, 88)], 5, coupes=5)
    frise = bx((0, -0.22, 2.25), (2.0, 0.03, 0.18), None)
    mosaique(frise, [(30, 118, 88), (250, 248, 240), (36, 84, 178)], 8, coupes=4)
    bx((0, -0.36, 0.25), (1.6, 0.36, 0.5), chaux)
    bx((0, -0.26, 1.35), (0.06, 0.14, 0.06), laiton)
    bx((0, -0.05, 2.6), (2.5, 0.8, 0.12), tuile, rot=(math.radians(-14), 0, 0))


# --- ABUJA ---------------------------------------------------------------
def tambours():
    """Trois tambours parlants (dundun), en sablier, sur leur banc."""
    bois, peau, corde = mat('t_bois', (150, 98, 58)), mat('t_peau', (226, 206, 168)), mat('t_corde', (200, 60, 50))
    bx((0, 0, 0.25), (1.6, 0.5, 0.06), bois)
    for x in (-0.75, 0.75):
        bx((x, 0, 0.12), (0.08, 0.45, 0.24), bois)
    for i, (x, h) in enumerate(((-0.5, 0.6), (0.05, 0.75), (0.55, 0.55))):
        z = 0.28 + h / 2
        cone((x, 0, z - h / 4), 0.16, 0.08, h / 2, bois, n=16)
        cone((x, 0, z + h / 4), 0.08, 0.16, h / 2, bois, n=16)
        cyl((x, 0, z + h / 2), 0.17, 0.02, peau, n=16)
        for k in range(6):
            a = k * math.pi / 3
            cyl((x + math.cos(a) * 0.12, math.sin(a) * 0.12, z), 0.008, h, corde, n=4)


def etal():
    """L'etal du marche, sous un grand parasol en tissu ankara."""
    bois, perche = mat('e_bois', (140, 96, 60)), mat('e_perche', (60, 50, 44))
    bx((0, 0, 0.75), (1.6, 0.8, 0.06), bois)
    for x in (-0.7, 0.7):
        for y in (-0.32, 0.32):
            cyl((x, y, 0.37), 0.03, 0.74, bois, n=6)
    fruits = [mat('fruit%d' % i, c) for i, c in enumerate([(240, 140, 30), (220, 60, 40), (250, 210, 50), (90, 160, 60)])]
    rng = random.Random(4)
    for i in range(14):
        boule((rng.uniform(-0.7, 0.7), rng.uniform(-0.3, 0.3), 0.84), 0.07, fruits[i % 4], seg=10)
    cyl((0, 0, 1.5), 0.03, 1.5, perche, n=8)
    p_ = cone((0, 0, 2.3), 1.5, 0.05, 0.5, None, n=16)
    mosaique(p_, [(232, 108, 30), (24, 130, 140), (120, 50, 140), (250, 196, 40), (196, 40, 60)], 9, coupes=3)


def baobab():
    """Le baobab : un tronc enorme, des branches courtes, peu de feuilles."""
    ecorce, feuille = mat('b_ecorce', (156, 136, 116)), mat('b_feuille', (96, 140, 64))
    cone((0, 0, 1.7), 1.0, 0.72, 3.4, ecorce, n=16)
    rng = random.Random(2)
    for i in range(7):
        a = i * 2 * math.pi / 7 + rng.uniform(-0.2, 0.2)
        l = rng.uniform(1.0, 1.6)
        cx, cy = math.cos(a) * (0.5 + l * 0.35), math.sin(a) * (0.5 + l * 0.35)
        cyl((cx, cy, 3.6 + l * 0.3), 0.14, l, ecorce, n=8, rot=(-math.sin(a) * 0.9, math.cos(a) * 0.9, 0))
        boule((math.cos(a) * (0.5 + l * 0.75), math.sin(a) * (0.5 + l * 0.75), 3.9 + l * 0.6),
              rng.uniform(0.35, 0.55), feuille, s=(1.3, 1.3, 0.7), seg=10)


# --- PARIS ---------------------------------------------------------------
def terrasse():
    """Un gueridon de marbre et deux chaises de bistrot."""
    marbre, fonte, rotin = mat('p_marbre', (236, 232, 226)), mat('p_fonte', (30, 30, 34)), mat('p_rotin', (206, 160, 100))
    cyl((0, 0, 0.72), 0.32, 0.03, marbre, n=24)
    cyl((0, 0, 0.36), 0.03, 0.7, fonte, n=8)
    cyl((0, 0, 0.02), 0.2, 0.04, fonte, n=16)
    for x, a in ((-0.62, 0.5), (0.62, -0.5)):
        cyl((x, 0, 0.46), 0.2, 0.05, rotin, n=16)
        for dx in (-0.13, 0.13):
            for dy in (-0.13, 0.13):
                cyl((x + dx, dy, 0.23), 0.012, 0.46, fonte, n=6)
        tore((x + math.copysign(0.17, x), 0, 0.72), 0.2, 0.025, rotin, rot=(0, math.pi / 2, 0))


def wallace():
    """La fontaine Wallace : vert sombre, quatre caryatides, le dome."""
    vert = mat('w_vert', (34, 74, 52))
    cyl((0, 0, 0.12), 0.52, 0.24, vert, n=8)
    cyl((0, 0, 0.62), 0.36, 0.76, vert, n=8)
    cyl((0, 0, 1.05), 0.42, 0.1, vert, n=8)
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        cyl((math.cos(a) * 0.22, math.sin(a) * 0.22, 1.5), 0.07, 0.8, vert, n=10)
        boule((math.cos(a) * 0.22, math.sin(a) * 0.22, 1.95), 0.08, vert)
    cyl((0, 0, 2.06), 0.4, 0.1, vert, n=16)
    boule((0, 0, 2.12), 0.38, vert, s=(1, 1, 0.75))
    cyl((0, 0, 2.5), 0.03, 0.24, vert, n=8)


def reverbere():
    """Le reverbere parisien."""
    vert, verre = mat('r_vert', (30, 58, 44)), mat('r_verre', (255, 226, 160))
    cyl((0, 0, 0.3), 0.18, 0.6, vert, n=12)
    cyl((0, 0, 2.0), 0.06, 3.0, vert, n=10)
    bx((0, 0, 3.4), (0.7, 0.06, 0.06), vert)
    cone((0, 0, 3.72), 0.12, 0.22, 0.45, verre, n=6)
    cone((0, 0, 4.02), 0.26, 0.04, 0.18, vert, n=6)


# --- NEW YORK ------------------------------------------------------------
def taxi():
    """Le yellow cab."""
    jaune, vitre, pneu = mat('t_jaune', (248, 194, 28)), mat('t_vitre', (44, 58, 76)), mat('t_pneu', (30, 30, 32))
    damier, feu = mat('t_damier', (30, 30, 30)), mat('t_feu', (250, 246, 220))
    bx((0, 0, 0.62), (4.6, 1.8, 0.66), jaune)
    bx((-0.2, 0, 1.2), (2.4, 1.6, 0.56), jaune)
    bx((-0.2, -0.81, 1.2), (2.2, 0.02, 0.42), vitre)
    bx((1.0, 0, 1.2), (0.06, 1.5, 0.42), vitre, rot=(0, math.radians(28), 0))
    bx((0, -0.91, 0.66), (4.4, 0.02, 0.1), damier)
    bx((-0.2, 0, 1.55), (0.5, 0.25, 0.16), feu)
    for x in (-1.45, 1.45):
        cyl((x, -0.72, 0.35), 0.35, 0.3, pneu, n=20, rot=(math.pi / 2, 0, 0))


def borne():
    """La bouche d'incendie."""
    rouge, fer = mat('b_rouge', (196, 40, 40)), mat('b_fer', (150, 150, 156))
    cyl((0, 0, 0.04), 0.2, 0.08, rouge, n=12)
    cyl((0, 0, 0.36), 0.14, 0.6, rouge, n=16)
    boule((0, 0, 0.68), 0.15, rouge, s=(1, 1, 0.7))
    cyl((0, 0, 0.82), 0.03, 0.1, fer, n=6)
    for a in (0, math.pi):
        cyl((math.cos(a) * 0.17, 0, 0.5), 0.06, 0.12, rouge, n=10, rot=(0, math.pi / 2, 0))
    cyl((0, -0.18, 0.46), 0.08, 0.12, rouge, n=10, rot=(math.pi / 2, 0, 0))


def hotdog():
    """La charrette a hot-dogs, sous son parasol raye."""
    inox, pneu = mat('h_inox', (204, 208, 214)), mat('h_pneu', (30, 30, 32))
    bx((0, 0, 0.75), (1.5, 0.75, 0.7), inox)
    bx((0, -0.38, 0.75), (1.3, 0.02, 0.4), mat('h_enseigne', (230, 60, 40)))
    for x in (-0.55, 0.55):
        cyl((x, -0.3, 0.25), 0.25, 0.06, pneu, n=18, rot=(math.pi / 2, 0, 0))
    cyl((0, 0, 1.6), 0.025, 1.0, inox, n=8)
    p_ = cone((0, 0, 2.15), 1.1, 0.04, 0.35, None, n=12)
    bleu, jaune = mat('h_bleu', (40, 90, 180)), mat('h_jaune', (250, 206, 40))
    p_.data.materials.append(bleu); p_.data.materials.append(jaune)
    for i, f in enumerate(p_.data.polygons):
        f.material_index = i % 2


# --- LONDRES -------------------------------------------------------------
def boite():
    """La pillar box rouge."""
    rouge, noir = mat('l_rouge', (204, 32, 30)), mat('l_noir', (26, 26, 28))
    cyl((0, 0, 0.06), 0.34, 0.12, noir, n=24)
    cyl((0, 0, 0.75), 0.3, 1.3, rouge, n=24)
    cyl((0, 0, 1.43), 0.36, 0.08, rouge, n=24)
    boule((0, 0, 1.47), 0.32, rouge, s=(1, 1, 0.45))
    bx((0, -0.3, 1.15), (0.26, 0.02, 0.04), noir)
    bx((0, -0.3, 0.85), (0.2, 0.02, 0.14), mat('l_plaque', (240, 236, 226)))


def bus():
    """L'imperiale rouge."""
    rouge, vitre, blanc, pneu = mat('bus_rouge', (204, 32, 30)), mat('bus_vitre', (44, 56, 72)), mat('bus_blanc', (240, 236, 226)), mat('bus_pneu', (28, 28, 30))
    bx((0, 0, 2.3), (10.2, 2.5, 4.0), rouge)
    for z in (1.6, 3.4):
        for i in range(8):
            bx((-4.2 + i * 1.15, -1.26, z), (0.95, 0.02, 0.8), vitre)
    bx((0, -1.26, 2.5), (10.0, 0.02, 0.12), blanc)
    bx((5.11, 0, 2.7), (0.02, 2.2, 2.6), vitre)
    bx((0, 0, 4.32), (10.0, 2.4, 0.06), rouge)
    for x in (-3.3, 3.3):
        cyl((x, -1.1, 0.52), 0.52, 0.4, pneu, n=20, rot=(math.pi / 2, 0, 0))


def garde():
    """La guerite et son garde au bonnet a poil d'ours."""
    noir, rouge, peau = mat('g_noir', (26, 26, 30)), mat('g_rouge', (196, 30, 36)), mat('g_peau', (232, 190, 160))
    gris, or_ = mat('g_gris', (70, 74, 82)), mat('g_or', (226, 186, 80))
    bx((0, 0.25, 1.3), (1.1, 0.06, 2.6), gris)
    for x in (-0.53, 0.53):
        bx((x, 0, 1.3), (0.06, 0.5, 2.6), gris)
    bx((0, 0, 2.72), (1.3, 0.7, 0.12), gris)
    cone((0, 0, 2.95), 0.75, 0.0, 0.35, gris, n=4, rot=(0, 0, math.pi / 4))
    for x in (-0.11, 0.11):
        cyl((x, -0.05, 0.45), 0.07, 0.9, noir, n=10)
    cyl((0, -0.05, 1.25), 0.2, 0.75, rouge, n=14)
    bx((0, -0.25, 1.1), (0.4, 0.02, 0.05), or_)
    for x in (-0.24, 0.24):
        cyl((x, -0.05, 1.25), 0.05, 0.62, rouge, n=8)
    boule((0, -0.05, 1.75), 0.11, peau)
    boule((0, -0.05, 2.02), 0.15, noir, s=(1, 1, 1.9))


PIECES = {'torii': torii, 'cabine': cabine, 'morris': morris,
          'toro': toro, 'sakura': sakura, 'kiosque': kiosque, 'jerk': jerk,
          'cesme': cesme, 'simit': simit, 'trencadis': trencadis, 'drac': drac,
          'fanous': fanous, 'zellige': zellige, 'tambours': tambours, 'etal': etal,
          'baobab': baobab, 'terrasse': terrasse, 'wallace': wallace, 'reverbere': reverbere,
          'taxi': taxi, 'borne': borne, 'hotdog': hotdog, 'boite': boite, 'bus': bus,
          'garde': garde}


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
