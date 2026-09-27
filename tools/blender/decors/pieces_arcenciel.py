# -----------------------------------------------------------------------
# SPRINTER — les decors de la piste arc-en-ciel, en ECLAIRAGE REEL.
#
# Les pieces des autres stades sont des facettes plates, eclairees par la
# formule du jeu (matiere.py). Celles-ci sont faites pour briller : de l'or
# qui renvoie le ciel, de la laque qui accroche un reflet, du chrome, des
# tubes de neon, des aretes arrondies qui prennent la lumiere et des surfaces
# lissees. Elles sont rendues par Cycles (voir reel.py et fabriquer.py).
#
# Meme repere que pieces.py : +X le long de la piste, +Y vers elle, +Z en
# haut, pied a l'origine. Aucune ne reprend un objet d'un jeu existant : un
# arc-en-ciel, une etoile, un satellite, une fusee et une planete
# appartiennent a tout le monde.
# -----------------------------------------------------------------------

import bpy
import bmesh
import math
from mathutils import Vector, Matrix

import pieces as PC
import reel as R


ARC = [(255, 40, 64), (255, 136, 0), (255, 222, 0), (36, 222, 80),
       (0, 208, 255), (30, 96, 255), (140, 56, 255)]


def _objet(nom, mat, bm, lisse=True, angle=40.0):
    o = PC._mesh(nom, mat, bm)
    if lisse:
        R.lisser(o, angle)
    return o


def _sphere(nom, mat, x, y, z, r, subdiv=3, echelle=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    bmesh.ops.scale(bm, vec=echelle, verts=bm.verts)
    bmesh.ops.translate(bm, vec=(x, y, z), verts=bm.verts)
    return _objet(nom, mat, bm, angle=180)


def _cylindre(nom, mat, x, y, z0, z1, r, cotes=48, r_haut=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=cotes, radius1=r,
                          radius2=r if r_haut is None else r_haut, depth=z1 - z0)
    bmesh.ops.translate(bm, vec=(x, y, (z0 + z1) / 2), verts=bm.verts)
    return _objet(nom, mat, bm, angle=35)


def _tore_demi(nom, mat, Rg, r, z, cotes=96, tour=18):
    """Un demi-tore dans le plan XZ : un tube de neon courbe en arc."""
    bm = bmesh.new()
    rangs = []
    for k in range(cotes + 1):
        a = math.pi * k / cotes
        ca, sa = math.cos(a), math.sin(a)
        rangs.append([bm.verts.new(((Rg + r * math.cos(2 * math.pi * j / tour)) * ca,
                                    r * math.sin(2 * math.pi * j / tour),
                                    z + (Rg + r * math.cos(2 * math.pi * j / tour)) * sa))
                      for j in range(tour)])
    for k in range(cotes):
        for j in range(tour):
            i = (j + 1) % tour
            bm.faces.new((rangs[k][j], rangs[k][i], rangs[k + 1][i], rangs[k + 1][j]))
    for bout in (rangs[0], rangs[-1]):
        c = bm.verts.new(sum((v.co for v in bout), Vector()) / tour)
        for j in range(tour):
            bm.faces.new((c, bout[(j + 1) % tour], bout[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return _objet(nom, mat, bm, angle=180)


def _nuage(nom, x, y, z, s, graine):
    """Un nuage de boules lisses qui se chevauchent, le dessous aplati."""
    blanc = R.matiere_pbr(nom, (246, 242, 255), rugosite=0.85,
                          emission=0.25, couleur_emission=(255, 236, 250))
    boules = ((0, 0, 0.42, 0.66), (0.66, 0.08, 0.3, 0.5), (-0.64, -0.04, 0.28, 0.52),
              (0.22, 0.38, 0.66, 0.46), (-0.28, -0.3, 0.6, 0.44), (0.95, -0.2, 0.18, 0.34),
              (-0.98, 0.18, 0.16, 0.34))
    for k, (dx, dy, dz, r) in enumerate(boules):
        o = _sphere('%s%d' % (nom, k), blanc, x + dx * s, y + dy * s, z + dz * s, r * s,
                    subdiv=3, echelle=(1.0, 0.9, 0.82))
        # le dessous du nuage est plat, pose sur l'air
        for v in o.data.vertices:
            if v.co.z < z + 0.05 * s:
                v.co.z = z + 0.05 * s


# -----------------------------------------------------------------------

def arche(P):
    """Sept tubes de neon courbes en arc, poses sur deux nuages, bordes d'ampoules."""
    R0, pas, rt, z = 2.2, 0.31, 0.135, 0.5
    for k, col in enumerate(ARC):
        # rouge a l'exterieur, violet a l'interieur, comme dans le ciel
        Rg = R0 + pas * (len(ARC) - 1 - k)
        _tore_demi('tube%d' % k, R.neon('neon%d' % k, col, force=3.2), Rg, rt, z)
    # la monture : un fin rail de chrome derriere les tubes
    chrome = R.matiere_pbr('chrome', (220, 224, 236), metal=1.0, rugosite=0.12)
    _tore_demi('rail', chrome, R0 + pas * 3, 0.05, z, cotes=64, tour=10).location.y = 0.2
    # les ampoules du bord exterieur
    ampoule = R.neon('ampoule', (255, 244, 214), force=12.0)
    Rb = R0 + pas * len(ARC) - 0.02
    for k in range(21):
        a = math.pi * (k + 0.5) / 21
        _sphere('ampoule%d' % k, ampoule, Rb * math.cos(a), -0.05, z + Rb * math.sin(a), 0.075, subdiv=2)
    _nuage('nuage_g', -(R0 + pas * 3.2), 0, 0, 1.25, 1)
    _nuage('nuage_d', (R0 + pas * 3.2), 0, 0, 1.25, 4)
    PC.halo('lueur', (255, 150, 220), 0, 0, 0.02, 5.6, force=0.26)


def etoile(P):
    """Une grande etoile d'or poli qui flotte, et ses etincelles."""
    orM = R.matiere_pbr('or', (255, 222, 110), metal=1.0, rugosite=0.24,
                        emission=0.6, couleur_emission=(255, 190, 60))
    bm = bmesh.new()
    PC._etoile_maillage(bm, 1.1, 0.47, 0.34, 0.26)
    rot = Matrix.Rotation(math.radians(-16), 4, 'Z') @ Matrix.Rotation(math.radians(8), 4, 'Y')
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, 2.1)) @ rot, verts=bm.verts)
    o = _objet('etoile', orM, bm, lisse=False)
    R.biseau(o, 0.045, 4)
    etincelle = R.neon('etincelle', (255, 244, 200), force=10.0)
    for k, (x, y, z, t) in enumerate(((-1.3, 0.1, 3.0, 0.1), (1.25, -0.2, 1.35, 0.08),
                                      (1.0, 0.2, 3.1, 0.07), (-1.05, -0.1, 1.15, 0.07),
                                      (0.25, 0.0, 3.45, 0.06), (-0.4, 0.2, 0.9, 0.05))):
        PC._eclat('eclat%d' % k, etincelle, x, y, z, t)
    PC.aureole('aureole', (255, 200, 90), 0, 0, 2.1, 1.9, force=0.35)
    PC.halo('lueur', (255, 196, 60), 0, 0, 0.02, 2.6, force=0.40)


def satellite(P):
    """Un satellite : feuille d'or froissee, deux ailes de panneaux, une parabole."""
    feuille = R.matiere_pbr('feuille', (255, 206, 96), metal=1.0, rugosite=0.26, bosse=0.08,
                            echelle_bosse=7.0, emission=0.25, couleur_emission=(255, 180, 60))
    chrome = R.matiere_pbr('chrome', (214, 220, 232), metal=1.0, rugosite=0.15)
    blanc = R.matiere_pbr('blanc', (240, 240, 248), rugosite=0.3, vernis=0.6)
    panneau = R.matiere_pbr('panneau', (40, 80, 200), metal=0.3, rugosite=0.3, vernis=1.0,
                            emission=0.35, couleur_emission=(30, 70, 200))
    cellule = R.neon('cellule', (120, 200, 255), force=1.6)
    feu = R.neon('feu', (255, 40, 64), force=9.0)
    z0 = 2.3
    o = PC.boite('corps', feuille, -0.5, -0.45, z0 - 0.6, 0.5, 0.45, z0 + 0.6)
    R.biseau(o, 0.05, 3)
    o = PC.boite('ceinture', chrome, -0.54, -0.49, z0 - 0.07, 0.54, 0.49, z0 + 0.07)
    R.biseau(o, 0.02, 2)
    for s in (-1, 1):
        R.lisser(PC.tube('bras%d' % s, chrome, (s * 0.5, 0, z0), (s * 0.98, 0, z0), 0.05, 16))
        x0, x1 = (0.98, 3.4) if s > 0 else (-3.4, -0.98)
        o = PC.boite('aile%d' % s, panneau, x0, -0.04, z0 - 0.64, x1, 0.04, z0 + 0.64)
        R.biseau(o, 0.015, 2)
        for i in range(1, 7):
            x = x0 + (x1 - x0) * i / 7
            PC.boite('cel%d_%d' % (s, i), cellule, x - 0.01, -0.052, z0 - 0.62, x + 0.01, -0.041, z0 + 0.62)
        for zz in (z0 - 0.21, z0 + 0.21):
            PC.boite('celh%d_%.1f' % (s, zz), cellule, x0, -0.052, zz - 0.01, x1, -0.041, zz + 0.01)
    R.lisser(PC.tube('mat', chrome, (0, 0, z0 + 0.6), (0, 0, z0 + 1.0), 0.04, 16))
    bm = bmesh.new()
    n, Rp = 48, 0.46
    centre = bm.verts.new((0, 0, 0))
    anneaux = []
    for i in range(1, 5):
        rr = Rp * i / 4
        anneaux.append([bm.verts.new((rr * math.cos(2 * math.pi * k / n), rr * math.sin(2 * math.pi * k / n),
                                      0.2 * (rr / Rp) ** 2)) for k in range(n)])
    for k in range(n):
        bm.faces.new((centre, anneaux[0][k], anneaux[0][(k + 1) % n]))
    for i in range(3):
        for k in range(n):
            j = (k + 1) % n
            bm.faces.new((anneaux[i][k], anneaux[i + 1][k], anneaux[i + 1][j], anneaux[i][j]))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.03)
    rot = Matrix.Rotation(math.radians(35), 4, 'X')
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, z0 + 1.0)) @ rot, verts=bm.verts)
    _objet('parabole', blanc, bm, angle=60)
    _sphere('balise', feu, 0, 0, z0 - 0.7, 0.08, subdiv=2)
    PC.halo('lueur', (120, 200, 255), 0, 0, 0.02, 3.4, force=0.22)


def fusee(P):
    """Une fusee laquee sur son pas de tir, hublot allume, flamme au ralenti."""
    blanc = R.matiere_pbr('laque', (244, 244, 250), rugosite=0.28, vernis=1.0)
    rouge = R.matiere_pbr('rouge', (236, 34, 58), rugosite=0.3, vernis=1.0)
    chrome = R.matiere_pbr('chrome', (214, 220, 232), metal=1.0, rugosite=0.12)
    sombre = R.matiere_pbr('sombre', (40, 36, 70), metal=0.6, rugosite=0.35)
    hublot = R.neon('hublot', (0, 208, 255), force=4.0)
    flamme = R.neon('flamme', (255, 190, 60), force=10.0)
    anneauNeon = R.neon('rampe', (0, 208, 255), force=5.0)
    o = _cylindre('socle', sombre, 0, 0, 0, 0.2, 1.55, cotes=64)
    R.biseau(o, 0.04, 3)
    bm = bmesh.new()
    n = 96
    ext = [bm.verts.new((1.42 * math.cos(2 * math.pi * k / n), 1.42 * math.sin(2 * math.pi * k / n), 0.21))
           for k in range(n)]
    inn = [bm.verts.new((1.30 * math.cos(2 * math.pi * k / n), 1.30 * math.sin(2 * math.pi * k / n), 0.21))
           for k in range(n)]
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((inn[k], inn[j], ext[j], ext[k]))
    _objet('rampe', anneauNeon, bm)
    z = 0.72
    _cylindre('tuyere', chrome, 0, 0, z - 0.34, z, 0.44, cotes=48, r_haut=0.3)
    _cylindre('flamme', flamme, 0, 0, z - 0.72, z - 0.34, 0.05, cotes=32, r_haut=0.34)
    H, Rf = 3.0, 0.6
    # le fut : des anneaux laques, blancs et rouges ; le premier s'evase vers
    # la tuyere
    for i, (a, b, m) in enumerate(((0.0, 0.5, rouge), (0.5, 1.9, blanc), (1.9, 2.2, rouge),
                                   (2.2, H, blanc))):
        _cylindre('fut%d' % i, m, 0, 0, z + a, z + b, Rf if a > 0 else 0.52, cotes=64,
                  r_haut=Rf)
    bm = bmesh.new()
    prof = [(Rf, 0), (Rf * 0.95, 0.3), (Rf * 0.82, 0.65), (Rf * 0.6, 1.0), (Rf * 0.34, 1.3),
            (Rf * 0.12, 1.5), (0, 1.58)]
    rangs = []
    for r, h in prof:
        if r > 0:
            rangs.append([bm.verts.new((r * math.cos(2 * math.pi * k / 64), r * math.sin(2 * math.pi * k / 64), h))
                          for k in range(64)])
        else:
            rangs.append([bm.verts.new((0, 0, h))])
    for i in range(len(rangs) - 1):
        A, B = rangs[i], rangs[i + 1]
        for k in range(64):
            j = (k + 1) % 64
            if len(B) == 1:
                bm.faces.new((A[k], A[j], B[0]))
            else:
                bm.faces.new((A[k], A[j], B[j], B[k]))
    bmesh.ops.translate(bm, vec=(0, 0, z + H), verts=bm.verts)
    _objet('nez', rouge, bm, angle=180)
    # le hublot, tourne vers la camera (qui regarde depuis -X -Y)
    a = math.radians(225)
    d = Vector((math.cos(a), math.sin(a), 0))
    rot = Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
    for nom, m, r, e, dec in (('cerclage', chrome, 0.26, 0.07, 0.0), ('hublot', hublot, 0.18, 0.09, 0.01)):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=r, radius2=r, depth=e)
        c = d * (Rf + dec) + Vector((0, 0, z + 2.6))
        bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ rot, verts=bm.verts)
        _objet(nom, m, bm, angle=35)
    # quatre ailerons, aucun face a la camera
    for k in range(4):
        a = math.radians(90 * k)
        c, s = math.cos(a), math.sin(a)
        bm = bmesh.new()
        pts = [(Rf * 0.95, 0.0), (Rf + 0.8, -0.48), (Rf + 0.8, 0.22), (Rf * 0.95, 1.25)]
        vs = [bm.verts.new((r * c - 0.05 * s, r * s + 0.05 * c, z + h)) for r, h in pts]
        vs2 = [bm.verts.new((r * c + 0.05 * s, r * s - 0.05 * c, z + h)) for r, h in pts]
        bm.faces.new(vs)
        bm.faces.new(list(reversed(vs2)))
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((vs[i], vs2[i], vs2[j], vs[j]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        o = _objet('aileron%d' % k, rouge, bm, lisse=False)
        R.biseau(o, 0.025, 3)
    PC.halo('lueur', (255, 190, 60), 0, 0, 0.02, 2.4, force=0.32)


def _matiere_globe(nom):
    """Des bandes de gaz qui ondulent : un degrade en hauteur, trouble par un bruit."""
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value = 0.55
    p.inputs['Coat Weight'].default_value = 0.3
    tc = nt.nodes.new('ShaderNodeTexCoord')
    br = nt.nodes.new('ShaderNodeTexNoise')
    br.inputs['Scale'].default_value = 2.5
    br.inputs['Detail'].default_value = 4.0
    mel = nt.nodes.new('ShaderNodeMix')
    mel.data_type = 'VECTOR'
    mel.inputs['Factor'].default_value = 0.14
    nt.links.new(tc.outputs['Object'], mel.inputs[4])
    nt.links.new(br.outputs['Color'], mel.inputs[5])
    nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(mel.outputs[1], sep.inputs[0])
    onde = nt.nodes.new('ShaderNodeMath')
    onde.operation = 'SINE'
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = 7.0
    nt.links.new(sep.outputs['Z'], mul.inputs[0])
    nt.links.new(mul.outputs[0], onde.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.0, R.lin((110, 50, 210))
    el[1].position, el[1].color = 1.0, R.lin((255, 120, 210))
    e2 = el.new(0.5)
    e2.color = R.lin((70, 190, 240))
    rng = nt.nodes.new('ShaderNodeMapRange')
    rng.inputs['From Min'].default_value = -1.0
    nt.links.new(onde.outputs[0], rng.inputs['Value'])
    nt.links.new(rng.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    return m


def _matiere_atmosphere(nom, couleur, force=3.0):
    """Le liseret de l'atmosphere : lumineux sur le bord, transparent au centre."""
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.35
    pw = nt.nodes.new('ShaderNodeMath')
    pw.operation = 'POWER'
    pw.inputs[1].default_value = 2.0
    nt.links.new(lw.outputs['Facing'], pw.inputs[0])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = R.lin(couleur)
    em.inputs['Strength'].default_value = force
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(pw.outputs[0], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    return m


def _matiere_anneaux(nom):
    """Des anneaux de poussiere : des bandes plus ou moins denses, en rayon."""
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value = 0.6
    p.inputs['Emission Strength'].default_value = 0.6
    tc = nt.nodes.new('ShaderNodeTexCoord')
    ln = nt.nodes.new('ShaderNodeVectorMath')
    ln.operation = 'LENGTH'
    nt.links.new(tc.outputs['Object'], ln.inputs[0])
    rng = nt.nodes.new('ShaderNodeMapRange')
    rng.inputs['From Min'].default_value = 1.25
    rng.inputs['From Max'].default_value = 1.85
    nt.links.new(ln.outputs['Value'], rng.inputs['Value'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.0, (0, 0, 0, 0)
    el[1].position, el[1].color = 1.0, (0, 0, 0, 0)
    for pos, a in ((0.05, 0.9), (0.2, 0.35), (0.3, 0.95), (0.55, 0.85), (0.62, 0.2),
                   (0.72, 0.8), (0.95, 0.5)):
        e = el.new(pos)
        e.color = (a, a, a, 1)
    nt.links.new(rng.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], p.inputs['Alpha'])
    col = nt.nodes.new('ShaderNodeValToRGB')
    ce = col.color_ramp.elements
    ce[0].color = R.lin((120, 220, 255))
    ce[1].color = R.lin((200, 130, 255))
    nt.links.new(rng.outputs[0], col.inputs['Fac'])
    nt.links.new(col.outputs['Color'], p.inputs['Base Color'])
    nt.links.new(col.outputs['Color'], p.inputs['Emission Color'])
    m.surface_render_method = 'BLENDED'
    return m


def planete(P):
    """Une petite planete a bandes, son atmosphere et ses anneaux, qui flotte."""
    z = 2.05
    o = _sphere('globe', _matiere_globe('globe'), 0, 0, z, 0.95, subdiv=5)
    o.rotation_euler = (math.radians(14), math.radians(-10), 0)
    _sphere('atmosphere', _matiere_atmosphere('atmo', (140, 200, 255)), 0, 0, z, 1.02, subdiv=5)
    bm = bmesh.new()
    n = 128
    ext = [bm.verts.new((1.85 * math.cos(2 * math.pi * k / n), 1.85 * math.sin(2 * math.pi * k / n), 0))
           for k in range(n)]
    inn = [bm.verts.new((1.25 * math.cos(2 * math.pi * k / n), 1.25 * math.sin(2 * math.pi * k / n), 0))
           for k in range(n)]
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((ext[k], ext[j], inn[j], inn[k]))
    ring = _objet('anneaux', _matiere_anneaux('anneaux'), bm, angle=180)
    ring.location = (0, 0, z)
    ring.rotation_euler = (math.radians(-10), math.radians(-16), 0)
    PC.halo('lueur', (200, 120, 255), 0, 0, 0.02, 2.2, force=0.30)


def borne(P):
    """Une borne lumineuse : un fut de chrome, trois bagues de neon, un globe."""
    chrome = R.matiere_pbr('chrome', (214, 220, 232), metal=1.0, rugosite=0.12)
    sombre = R.matiere_pbr('sombre', (40, 36, 70), metal=0.5, rugosite=0.3, vernis=0.8)
    o = _cylindre('pied', sombre, 0, 0, 0, 0.12, 0.26, cotes=48)
    R.biseau(o, 0.02, 3)
    _cylindre('fut', chrome, 0, 0, 0.1, 1.32, 0.055, cotes=32)
    for k, col in enumerate((ARC[0], ARC[3], ARC[5])):
        _cylindre('bague%d' % k, R.neon('bague%d' % k, col, force=5.0), 0, 0,
                  0.62 + 0.18 * k, 0.70 + 0.18 * k, 0.085, cotes=32)
    _sphere('globe', R.neon('globe', (255, 250, 240), force=14.0), 0, 0, 1.48, 0.19, subdiv=3)
    PC.aureole('aureole', (255, 240, 255), 0, 0, 1.48, 0.62, force=0.45)
    PC.halo('lueur', (255, 240, 255), 0, 0, 0.02, 1.3, force=0.35)


PC.DEBOUT.update({'arche': arche, 'etoile': etoile, 'satellite': satellite, 'fusee': fusee,
                  'planete': planete, 'borne': borne})
