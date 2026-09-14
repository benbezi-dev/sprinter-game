# -----------------------------------------------------------------------
# SPRINTER — les pieces de decor, modelisees dans le repere du jeu.
#
# Chaque piece est une fonction qui construit l'objet sous la racine miroir
# (voir vue.py) avec son pied a l'origine :
#
#     +X  le long de la piste, dans le sens de la course
#     +Y  vers la piste (la piece est posee dans la pelouse interieure)
#     +Z  vers le haut
#
# Les dimensions sont celles du materiel reel quand il existe — une fosse de
# saut en longueur fait 2,75 m de large, un cercle de poids 2,135 m de
# diametre. Un decor de stade faux de vingt pour cent se voit a cote de huit
# coureurs a la bonne taille, meme si personne ne saurait dire pourquoi.
#
# Aucune piece ne porte de texte, de logo ni de marque.
# -----------------------------------------------------------------------

import bpy
import bmesh
import math
from mathutils import Vector, Matrix

import matiere as M

_racine = None


def commencer(racine):
    global _racine
    _racine = racine


def _poser(obj, mat):
    obj.data.materials.append(mat)
    obj.parent = _racine
    for p in obj.data.polygons:
        p.use_smooth = False
    return obj


def boite(nom, mat, x0, y0, z0, x1, y1, z1):
    me = bpy.data.meshes.new(nom)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 + (v.co.x + 0.5) * (x1 - x0)
        v.co.y = y0 + (v.co.y + 0.5) * (y1 - y0)
        v.co.z = z0 + (v.co.z + 0.5) * (z1 - z0)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    return _poser(o, mat)


def tube(nom, mat, a, b, r, cotes=10):
    """Un cylindre de a a b (points du jeu)."""
    a, b = Vector(a), Vector(b)
    axe = b - a
    me = bpy.data.meshes.new(nom)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=cotes, radius1=r, radius2=r,
                          depth=axe.length)
    q = Vector((0, 0, 1)).rotation_difference(axe.normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(),
                        verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    return _poser(o, mat)


def disque(nom, mat, cx, cy, z0, z1, r, cotes=40, r_in=0.0):
    me = bpy.data.meshes.new(nom)
    bm = bmesh.new()
    if r_in <= 0:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=cotes, radius1=r, radius2=r,
                              depth=z1 - z0)
    else:
        # un anneau : deux cercles relies
        top_o = [bm.verts.new((r * math.cos(2 * math.pi * k / cotes),
                               r * math.sin(2 * math.pi * k / cotes), (z1 - z0) / 2))
                 for k in range(cotes)]
        top_i = [bm.verts.new((r_in * math.cos(2 * math.pi * k / cotes),
                               r_in * math.sin(2 * math.pi * k / cotes), (z1 - z0) / 2))
                 for k in range(cotes)]
        for k in range(cotes):
            j = (k + 1) % cotes
            bm.faces.new((top_o[k], top_o[j], top_i[j], top_i[k]))
        bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=(z1 - z0))
    bmesh.ops.translate(bm, vec=(cx, cy, (z0 + z1) / 2), verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    return _poser(o, mat)


def quad(nom, mat, pts, uv_m=True):
    """Une face a quatre coins, UV en metres (pour les filets)."""
    me = bpy.data.meshes.new(nom)
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]
    f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.new('UVMap')
    la = (Vector(pts[1]) - Vector(pts[0])).length
    hb = (Vector(pts[3]) - Vector(pts[0])).length
    for lp, (u, v) in zip(f.loops, ((0, 0), (la, 0), (la, hb), (0, hb))):
        lp[uv].uv = (u, v)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    return _poser(o, mat)


# -----------------------------------------------------------------------
# LE STADE D'ATHLETISME
# -----------------------------------------------------------------------

def cage(P):
    """La cage de lancer du marteau et du disque.

    L'objet le plus haut de la pelouse, et le plus reconnaissable : un C de
    filet tendu entre des mats, ouvert vers le secteur de chute. On l'ouvre
    vers l'interieur du stade, donc de trois quarts face a la camera — on
    voit le cercle dedans a travers l'ouverture.
    """
    beton = M.peinture('beton', P['beton'])
    cercle = M.peinture('cercle', P['cercle'])
    mat_ = M.peinture('mat', P['metal'])
    filet = M.filet('filet', P['filet'], maille=0.16, epaisseur=0.12, alpha=0.85)
    disque('socle', beton, 0, 0, 0.0, 0.06, 3.6, cotes=48)
    disque('cercle_lancer', cercle, 0, 0, 0.06, 0.08, 1.25, cotes=40, r_in=1.05)
    R, H = 3.4, 6.6
    ouv = math.radians(96)            # l'ouverture, centree sur -Y
    n = 11
    a0 = -math.pi / 2 + ouv / 2
    a1 = -math.pi / 2 - ouv / 2 + 2 * math.pi
    pts = []
    for k in range(n):
        a = a0 + (a1 - a0) * k / (n - 1)
        pts.append((R * math.cos(a), R * math.sin(a)))
        tube('mat%d' % k, mat_, (pts[-1][0], pts[-1][1], 0), (pts[-1][0], pts[-1][1], H), 0.055, 8)
    for k in range(n - 1):
        (x0, y0), (x1, y1) = pts[k], pts[k + 1]
        quad('filet%d' % k, filet, [(x0, y0, 0.05), (x1, y1, 0.05), (x1, y1, H), (x0, y0, H)])
        tube('cable%d' % k, mat_, (x0, y0, H), (x1, y1, H), 0.03, 6)
    # les deux portes, en prolongement des bouts du C
    for (x, y), s in ((pts[0], 1), (pts[-1], -1)):
        d = Vector((x, y)).normalized()
        t = Vector((-d.y, d.x)) * s
        bx, by = x + t.x * 0.2 - d.x * 1.6, y + t.y * 0.2 - d.y * 1.6
        tube('porte_mat', mat_, (bx, by, 0), (bx, by, H * 0.92), 0.05, 8)
        quad('porte', filet, [(x, y, 0.05), (bx, by, 0.05), (bx, by, H * 0.92), (x, y, H * 0.92)])


def hauteur(P):
    """Le sautoir en hauteur : le tapis, deux poteaux, la barre."""
    tapis = M.peinture('tapis', P['tapis'])
    dessus = M.peinture('tapis_dessus', P['tapisDessus'])
    metal = M.peinture('poteau', P['blanc'])
    barre = M.peinture('barre', P['barre'])
    sombre = M.peinture('socle_poteau', P['sombre'])
    boite('tapis', tapis, -3.0, 0.6, 0.0, 3.0, 3.6, 0.62)
    boite('housse', dessus, -2.95, 0.65, 0.62, 2.95, 3.55, 0.70)
    boite('tapis_avant', tapis, -2.5, 0.05, 0.0, 2.5, 0.6, 0.38)
    for x in (-2.2, 2.2):
        boite('pied', sombre, x - 0.3, -0.25, 0.0, x + 0.3, 0.25, 0.05)
        tube('poteau', metal, (x, 0.0, 0.05), (x, 0.0, 2.45), 0.035, 10)
        boite('taquet', sombre, x - 0.06, -0.05, 1.96, x + 0.06, 0.05, 2.02)
    tube('barre', barre, (-2.2, 0.0, 2.02), (2.2, 0.0, 2.02), 0.022, 8)


def perche(P):
    """L'aire de saut a la perche : un grand tapis a pans, deux chandeliers."""
    tapis = M.peinture('tapis', P['tapis'])
    dessus = M.peinture('tapis_dessus', P['tapisDessus'])
    metal = M.peinture('chandelier', P['blanc'])
    barre = M.peinture('barre', P['barre'])
    sombre = M.peinture('butoir', P['sombre'])
    boite('tapis', tapis, -3.2, 0.5, 0.0, 3.2, 6.0, 0.82)
    boite('housse', dessus, -3.15, 0.55, 0.82, 3.15, 5.95, 0.90)
    for x0, x1 in ((-3.2, -1.3), (1.3, 3.2)):
        boite('pan', tapis, x0, -1.2, 0.0, x1, 0.5, 0.72)
        boite('pan_dessus', dessus, x0 + 0.05, -1.15, 0.72, x1 - 0.05, 0.45, 0.78)
    boite('butoir', sombre, -0.4, -0.9, 0.0, 0.4, 0.2, 0.06)
    for x in (-2.6, 2.6):
        boite('base', sombre, x - 0.45, -0.7, 0.0, x + 0.45, 0.7, 0.14)
        tube('chandelier', metal, (x, 0.0, 0.14), (x, 0.0, 5.6), 0.06, 10)
        tube('bras', metal, (x, 0.0, 4.9), (x * 0.96, 0.35, 4.9), 0.03, 8)
    tube('barre', barre, (-2.5, 0.35, 4.9), (2.5, 0.35, 4.9), 0.022, 8)


def haies(P):
    """Le chariot de haies, rangees les unes dans les autres au bord de la pelouse."""
    blanc = M.peinture('planche', P['blanc'])
    raie = M.peinture('raie', P['sombre'])
    metal = M.peinture('pieds', P['metal'])
    roue = M.peinture('roue', P['sombre'])
    boite('chassis', metal, -1.3, -0.45, 0.18, 1.3, 0.45, 0.24)
    for x in (-1.1, 1.1):
        for y in (-0.38, 0.38):
            tube('roue', roue, (x, y - 0.04, 0.12), (x, y + 0.04, 0.12), 0.12, 12)
    for k in range(9):
        z = 0.24 + k * 0.075
        xs = -0.2 + k * 0.03
        for x in (-0.62, 0.62):
            tube('montant', metal, (x + xs, 0.0, z), (x + xs, 0.0, z + 0.62), 0.016, 6)
            boite('patin', metal, x + xs - 0.03, -0.35, z, x + xs + 0.03, 0.05, z + 0.03)
        boite('planche', blanc, -0.62 + xs, -0.03, z + 0.52, 0.62 + xs, 0.03, z + 0.66)
        for xr in (-0.4, 0.0, 0.4):
            boite('raie', raie, xr + xs - 0.07, -0.032, z + 0.52, xr + xs + 0.07, 0.032, z + 0.66)


def drapeaux(P):
    """Trois mats et leurs pavillons, aux couleurs du stade."""
    metal = M.peinture('mat', P['blanc'])
    for k, couleur in enumerate(P['pavillons'][:3]):
        x = (k - 1) * 1.9
        H = 8.0 - abs(k - 1) * 0.6
        tube('mat', metal, (x, 0, 0), (x, 0, H), 0.05, 10)
        disque('pomme', metal, x, 0, H, H + 0.1, 0.08, cotes=10)
        # le pavillon ondule : une grille pliee en sinus, flottant vers +X
        tissu = M.peinture('pavillon%d' % k, couleur)
        me = bpy.data.meshes.new('pavillon')
        bm = bmesh.new()
        nx, nz = 10, 4
        L, Hf = 1.7, 1.05
        grille = [[bm.verts.new((x + L * i / nx,
                                 0.10 * math.sin(i / nx * math.pi * 2.2 + k) * (i / nx),
                                 H - 0.15 - Hf * j / nz - 0.12 * (i / nx) ** 2))
                   for j in range(nz + 1)] for i in range(nx + 1)]
        for i in range(nx):
            for j in range(nz):
                bm.faces.new((grille[i][j], grille[i + 1][j], grille[i + 1][j + 1], grille[i][j + 1]))
        bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.02)
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new('pavillon', me)
        bpy.context.collection.objects.link(o)
        _poser(o, tissu)


def tente(P):
    """La tente des officiels : un toit a quatre pans, la table du chrono."""
    toile = M.peinture('toile', P['toile'])
    bande = M.peinture('lambrequin', P['accent'])
    metal = M.peinture('pieds', P['metal'])
    nappe = M.peinture('nappe', P['blanc'])
    sombre = M.peinture('chaise', P['sombre'])
    c = 1.6
    for x in (-c, c):
        for y in (-c, c):
            tube('pied', metal, (x, y, 0), (x, y, 2.25), 0.035, 8)
    me = bpy.data.meshes.new('toit')
    bm = bmesh.new()
    coins = [bm.verts.new((x, y, 2.25)) for x, y in ((-c, -c), (c, -c), (c, c), (-c, c))]
    som = bm.verts.new((0, 0, 3.15))
    for k in range(4):
        bm.faces.new((coins[k], coins[(k + 1) % 4], som))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.04)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('toit', me)
    bpy.context.collection.objects.link(o)
    _poser(o, toile)
    for (x0, y0), (x1, y1) in (((-c, -c), (c, -c)), ((c, -c), (c, c)),
                               ((c, c), (-c, c)), ((-c, c), (-c, -c))):
        dx, dy = x1 - x0, y1 - y0
        nx, ny = dy / (2 * c) * 0.02, -dx / (2 * c) * 0.02
        boite('lambrequin', bande, min(x0, x1) - abs(nx), min(y0, y1) - abs(ny), 1.98,
              max(x0, x1) + abs(nx), max(y0, y1) + abs(ny), 2.26)
    boite('table', nappe, -1.0, 0.2, 0.0, 1.0, 0.95, 0.76)
    for x in (-0.6, 0.6):
        boite('assise', sombre, x - 0.22, -0.5, 0.42, x + 0.22, -0.08, 0.47)
        boite('dossier', sombre, x - 0.22, -0.55, 0.47, x + 0.22, -0.5, 0.92)
        for dx in (-0.18, 0.18):
            boite('pied_chaise', sombre, x + dx - 0.02, -0.5, 0.0, x + dx + 0.02, -0.46, 0.42)


# -----------------------------------------------------------------------
# LES MARQUAGES AU SOL (vus de dessus, plaques par le moteur)
# -----------------------------------------------------------------------

def arc(nom, mat, r0, r1, a0, a1, z0, z1, cotes=24):
    """Un secteur d'anneau plat, de l'angle a0 a a1 (radians)."""
    me = bpy.data.meshes.new(nom)
    bm = bmesh.new()
    ext, intr = [], []
    for k in range(cotes + 1):
        a = a0 + (a1 - a0) * k / cotes
        ext.append(bm.verts.new((r1 * math.cos(a), r1 * math.sin(a), z1)))
        intr.append(bm.verts.new((r0 * math.cos(a), r0 * math.sin(a), z1)))
    for k in range(cotes):
        bm.faces.new((intr[k], ext[k], ext[k + 1], intr[k + 1]))
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    return _poser(o, mat)


def longueur(P):
    """La piste d'elan et la fosse du saut en longueur.

    Posee le long de la ligne droite, comme dans tous les stades : l'elan
    court parallele aux couloirs, et la fosse de sable l'acheve.
    """
    elan = M.aplat('elan', P['elan'])
    ligne = M.aplat('ligne', P['blanc'])
    sable = M.aplat('sable', P['sable'])
    sable_fonce = M.aplat('sable_ratisse', tuple(int(c * 0.9) for c in P['sable']))
    bord = M.aplat('bordure', P['beton'])
    planche = M.aplat('planche', P['blanc'])
    pate = M.aplat('plasticine', (236, 220, 160))
    boite('elan', elan, -34.0, -0.61, 0, 0.0, 0.61, 0.01)
    for y in (-0.63, 0.61):
        boite('ligne', ligne, -34.0, y, 0.01, 0.0, y + 0.02, 0.012)
    boite('bordure', bord, 1.0, -1.5, 0, 10.2, 1.5, 0.01)
    boite('fosse', sable, 1.1, -1.375, 0.01, 10.1, 1.375, 0.02)
    # les traces du rateau : des bandes a peine plus sombres, en travers
    for k in range(9):
        x = 1.6 + k * 0.95
        boite('rateau', sable_fonce, x, -1.3, 0.02, x + 0.22, 1.3, 0.021)
    boite('planche', planche, -1.2, -0.61, 0.012, -1.0, 0.61, 0.015)
    boite('plasticine', pate, -1.0, -0.61, 0.012, -0.9, 0.61, 0.015)


def poids(P):
    """Le cercle du lancer du poids, son butoir et le depart du secteur."""
    beton = M.aplat('beton', P['beton'])
    ligne = M.aplat('ligne', P['blanc'])
    disque('dalle', beton, 0, 0, 0, 0.01, 1.35, cotes=64)
    disque('cercle', ligne, 0, 0, 0.01, 0.012, 1.0675, cotes=64, r_in=1.0175)
    arc('butoir', ligne, 1.07, 1.19, math.radians(-38), math.radians(38), 0.01, 0.013)
    demi = math.radians(34.92 / 2)
    for sgn in (-1, 1):
        a = sgn * demi
        x0, y0 = 1.2 * math.cos(a), 1.2 * math.sin(a)
        x1, y1 = 9.0 * math.cos(a), 9.0 * math.sin(a)
        n = Vector((-(y1 - y0), x1 - x0)).normalized() * 0.025
        quad('secteur', ligne, [(x0 - n.x, y0 - n.y, 0.012), (x1 - n.x, y1 - n.y, 0.012),
                                (x1 + n.x, y1 + n.y, 0.012), (x0 + n.x, y0 + n.y, 0.012)])


DEBOUT = {'cage': cage, 'hauteur': hauteur, 'perche': perche, 'haies': haies,
          'drapeaux': drapeaux, 'tente': tente}
AU_SOL = {'longueur': longueur, 'poids': poids}


# -----------------------------------------------------------------------
# OUTILS COMMUNS AUX STADES PEINTS
# -----------------------------------------------------------------------

def _mesh(nom, mat, bm):
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    return _poser(o, mat)


def prisme(nom, mat, x, y, z, rayon, hauteur, pointe, cotes=6, incl=(0, 0), tourne=0.0):
    """Un prisme a pointe : un cristal, une aiguille de roche."""
    bm = bmesh.new()
    bas = [bm.verts.new((rayon * math.cos(tourne + 2 * math.pi * k / cotes),
                         rayon * math.sin(tourne + 2 * math.pi * k / cotes), 0))
           for k in range(cotes)]
    haut = [bm.verts.new((rayon * 0.92 * math.cos(tourne + 2 * math.pi * k / cotes),
                          rayon * 0.92 * math.sin(tourne + 2 * math.pi * k / cotes), hauteur))
            for k in range(cotes)]
    sommet = bm.verts.new((0, 0, hauteur + pointe))
    bm.faces.new(list(reversed(bas)))
    for k in range(cotes):
        j = (k + 1) % cotes
        bm.faces.new((bas[k], bas[j], haut[j], haut[k]))
        bm.faces.new((haut[k], haut[j], sommet))
    rot = Matrix.Rotation(incl[0], 4, 'X') @ Matrix.Rotation(incl[1], 4, 'Y')
    bmesh.ops.transform(bm, matrix=Matrix.Translation((x, y, z)) @ rot, verts=bm.verts)
    return _mesh(nom, mat, bm)


def caillou(nom, mat, x, y, z, rx, ry, rz, graine=0, subdiv=2):
    """Un rocher a facettes : une icosphere bosselee de facon reproductible."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    for v in bm.verts:
        n = v.co.normalized()
        bosse = 1.0 + 0.16 * math.sin(n.x * 5.1 + graine) * math.cos(n.y * 4.3 + graine * 0.7) \
            + 0.08 * math.sin(n.z * 7.7 + graine * 1.3)
        v.co = Vector((n.x * rx * bosse, n.y * ry * bosse, max(n.z, -0.35) * rz * bosse))
    bmesh.ops.translate(bm, vec=(x, y, z), verts=bm.verts)
    return _mesh(nom, mat, bm)


def halo(nom, couleur, x, y, z, rayon, force=0.55):
    """Une lueur au sol : un disque dont l'opacite tombe vers le bord.

    C'est ce qui fait qu'une lampe ou un cristal eclaire quelque chose au lieu
    d'etre simplement une couleur vive posee sur du noir.
    """
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    grad = nt.nodes.new('ShaderNodeTexGradient')
    grad.gradient_type = 'SPHERICAL'
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0, 1.0, 1.0)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs[0], grad.inputs['Vector'])
    pw = nt.nodes.new('ShaderNodeMath')
    pw.operation = 'POWER'
    pw.inputs[1].default_value = 2.2
    nt.links.new(grad.outputs['Fac'], pw.inputs[0])
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = force
    nt.links.new(pw.outputs[0], mul.inputs[0])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*M.rgb(couleur), 1)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(mul.outputs[0], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=48, radius=1.0)
    bmesh.ops.scale(bm, vec=(rayon, rayon, 1), verts=bm.verts)
    o = _mesh(nom, m, bm)
    o.location = (x, y, z)
    # la lueur ne jette pas d'ombre
    o.visible_shadow = False
    o['sans_ombre'] = True
    return o


def pastel(P, cle, fallback=(200, 200, 200)):
    return P.get(cle, fallback)


def peint(P, nom, couleur, **kw):
    """La matiere du stade : continue, ou en aplats si le stade est peint."""
    kw.setdefault('paliers', P.get('paliers', 0))
    kw.setdefault('liseret', P.get('liseret', 1.0))
    return M.peinture(nom, couleur, **kw)


# -----------------------------------------------------------------------
# INTER GALACTIQUE
# -----------------------------------------------------------------------

def cristaux(P):
    """Un amas de cristaux sortant d'un socle de roche sombre."""
    roche = peint(P, 'roche', P['roche'])
    c1 = peint(P, 'cristal_a', P['cristalA'], liseret=1.6)
    c2 = peint(P, 'cristal_b', P['cristalB'], liseret=1.6)
    for k, (dx, dy, rr) in enumerate(((0, 0, 0.9), (0.8, 0.5, 0.6), (-0.7, 0.4, 0.55), (0.2, -0.7, 0.5))):
        caillou('socle%d' % k, roche, dx, dy, 0, rr, rr * 0.9, rr * 0.45, graine=k * 1.9)
    pousses = [(0, 0, 0.30, 2.4, 0.5, (0.05, -0.08)), (0.55, 0.35, 0.22, 1.6, 0.35, (0.35, 0.25)),
               (-0.5, 0.3, 0.20, 1.4, 0.3, (0.25, -0.40)), (0.1, -0.5, 0.18, 1.1, 0.3, (-0.45, 0.15)),
               (0.75, -0.15, 0.14, 0.9, 0.22, (-0.2, 0.55)), (-0.2, 0.65, 0.12, 0.8, 0.2, (0.6, -0.1))]
    for k, (x, y, r, h, pt, inc) in enumerate(pousses):
        prisme('cristal%d' % k, c1 if k % 2 == 0 else c2, x, y, 0.15, r, h, pt, incl=inc, tourne=k)
    halo('lueur', P['cristalA'], 0, 0, 0.02, 3.2, force=0.35)


def obelisque(P):
    """Un monolithe noir, strie de lumiere, sous un anneau qui flotte."""
    noir = peint(P, 'monolithe', P['monolithe'])
    trait = peint(P, 'strie', P['cristalB'], liseret=0.4)
    anneau = peint(P, 'anneau', P['cristalA'], liseret=1.4)
    bm = bmesh.new()
    b, t, H = 0.55, 0.38, 5.0
    bas = [bm.verts.new((sx * b, sy * b, 0)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    haut = [bm.verts.new((sx * t, sy * t, H)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    pic = bm.verts.new((0, 0, H + 0.6))
    for k in range(4):
        j = (k + 1) % 4
        bm.faces.new((bas[k], bas[j], haut[j], haut[k]))
        bm.faces.new((haut[k], haut[j], pic))
    _mesh('monolithe', noir, bm)
    for z in (1.1, 2.3, 3.5):
        w = b - (b - t) * z / H + 0.012
        boite('strie', trait, -w, -w, z, w, w, z + 0.07)
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, segments=40, radius=1.0)
    ring = bmesh.ops.extrude_edge_only(bm, edges=bm.edges[:])
    for v in [e for e in ring['geom'] if isinstance(e, bmesh.types.BMVert)]:
        v.co *= 1.22
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.12)
    bmesh.ops.translate(bm, vec=(0, 0, 4.2), verts=bm.verts)
    _mesh('anneau', anneau, bm)
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.4
        caillou('eclat%d' % k, noir, 1.5 * math.cos(a), 1.5 * math.sin(a), 0, 0.35, 0.3, 0.25, graine=k)
    halo('lueur', P['cristalB'], 0, 0, 0.02, 2.6, force=0.3)


def antenne(P):
    """Une parabole tournee vers le ciel, sur son trepied."""
    metal = peint(P, 'metal', P['metalCosmos'])
    sombre = peint(P, 'sombre', P['monolithe'])
    feu = peint(P, 'feu', P['cristalA'], liseret=1.8)
    for k in range(3):
        a = 2 * math.pi * k / 3
        tube('pied%d' % k, metal, (1.1 * math.cos(a), 1.1 * math.sin(a), 0), (0, 0, 2.2), 0.05, 8)
    tube('mat', metal, (0, 0, 0), (0, 0, 2.6), 0.08, 10)
    bm = bmesh.new()
    n, R, prof = 28, 1.5, 0.45
    centre = bm.verts.new((0, 0, 0))
    anneaux = []
    for i in range(1, 5):
        rr = R * i / 4
        anneaux.append([bm.verts.new((rr * math.cos(2 * math.pi * k / n), rr * math.sin(2 * math.pi * k / n),
                                      prof * (rr / R) ** 2)) for k in range(n)])
    for k in range(n):
        bm.faces.new((centre, anneaux[0][k], anneaux[0][(k + 1) % n]))
    for i in range(3):
        for k in range(n):
            j = (k + 1) % n
            bm.faces.new((anneaux[i][k], anneaux[i + 1][k], anneaux[i + 1][j], anneaux[i][j]))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.05)
    rot = Matrix.Rotation(math.radians(-38), 4, 'X') @ Matrix.Rotation(math.radians(20), 4, 'Z')
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, 2.7)) @ rot, verts=bm.verts)
    _mesh('parabole', metal, bm)
    tube('bras', sombre, (0, 0, 2.7), (0.0, 0.75, 3.75), 0.03, 6)
    disque('source', feu, 0.0, 0.78, 3.72, 3.86, 0.1, cotes=12)
    halo('lueur', P['cristalA'], 0, 0, 0.02, 1.8, force=0.22)


def rocher_flottant(P):
    """Un eclat de roche qui ne touche pas le sol. Son ombre, decalee, le dit."""
    roche = peint(P, 'roche', P['roche'])
    veine = peint(P, 'veine', P['cristalB'], liseret=1.5)
    caillou('bloc', roche, 0, 0, 2.1, 1.1, 0.9, 0.75, graine=3.3)
    caillou('queue', roche, 0.1, -0.1, 1.45, 0.55, 0.5, 0.45, graine=7.1)
    prisme('pointe', veine, 0.2, 0.1, 2.5, 0.16, 0.9, 0.3, incl=(0.2, 0.3))
    prisme('pointe2', veine, -0.4, -0.2, 2.35, 0.12, 0.6, 0.22, incl=(-0.4, -0.2), tourne=1)
    halo('lueur', P['cristalB'], 0, 0, 0.02, 1.6, force=0.25)


# -----------------------------------------------------------------------
# DANUBE — la nuit television, sans un nom ni une marque
# -----------------------------------------------------------------------

def tour_lumiere(P):
    """La tour d'eclairage mobile : remorque, mat telescopique, quatre lampes."""
    remorque = peint(P, 'remorque', P['remorque'])
    metal = peint(P, 'metal', P['metal'])
    sombre = peint(P, 'sombre', P['sombre'])
    lampe = M.aplat('lampe', (255, 252, 240))
    boite('caisson', remorque, -1.0, -0.6, 0.35, 1.0, 0.6, 1.25)
    for x in (-0.6, 0.6):
        tube('roue', sombre, (x, -0.66, 0.3), (x, -0.56, 0.3), 0.3, 12)
        tube('roue', sombre, (x, 0.56, 0.3), (x, 0.66, 0.3), 0.3, 12)
    for (x, y) in ((-1.6, -1.1), (1.6, -1.1), (-1.6, 1.1), (1.6, 1.1)):
        tube('stabilisateur', metal, (x * 0.55, y * 0.5, 0.6), (x, y, 0.05), 0.035, 6)
    tube('mat_bas', metal, (0, 0, 1.25), (0, 0, 4.5), 0.09, 10)
    tube('mat_haut', metal, (0, 0, 4.5), (0, 0, 7.2), 0.06, 10)
    boite('barre', metal, -1.1, -0.06, 7.1, 1.1, 0.06, 7.2)
    for x in (-0.8, -0.27, 0.27, 0.8):
        boite('projecteur', sombre, x - 0.24, -0.1, 6.7, x + 0.24, 0.12, 7.1)
        boite('vitre', lampe, x - 0.2, -0.13, 6.74, x + 0.2, -0.1, 7.06)
    halo('nappe', (255, 244, 220), 0, -3.0, 0.02, 5.5, force=0.18)


def camera_tv(P):
    """La camera de bord de piste, sur son trepied, et son touret de cable."""
    metal = peint(P, 'metal', P['metal'])
    sombre = peint(P, 'boitier', P['sombre'])
    gris = peint(P, 'gris', (118, 122, 136))
    verre = peint(P, 'objectif', (26, 30, 42), liseret=1.4)
    rouge = M.aplat('tally', (255, 48, 72))
    for k in range(3):
        a = 2 * math.pi * k / 3 + math.pi / 2
        tube('jambe%d' % k, metal, (0.55 * math.cos(a), 0.55 * math.sin(a), 0), (0, 0, 1.25), 0.025, 6)
    tube('colonne', metal, (0, 0, 1.0), (0, 0, 1.45), 0.05, 8)
    boite('corps', sombre, -0.22, -0.35, 1.45, 0.22, 0.25, 1.78)
    boite('viseur', gris, -0.12, -0.42, 1.78, 0.12, -0.14, 1.9)
    tube('fut', gris, (0, 0.25, 1.6), (0, 0.75, 1.6), 0.11, 14)
    tube('lentille', verre, (0, 0.75, 1.6), (0, 0.79, 1.6), 0.09, 14)
    boite('tally', rouge, -0.05, -0.36, 1.8, 0.05, -0.33, 1.86)
    tube('poignee', metal, (0.22, -0.3, 1.62), (0.6, -0.8, 1.45), 0.02, 6)
    tube('touret', gris, (-0.9, -0.5, 0.28), (-0.9, -0.1, 0.28), 0.28, 16)
    tube('moyeu', sombre, (-0.9, -0.52, 0.28), (-0.9, -0.08, 0.28), 0.12, 10)


def grue(P):
    """La grue camera : un trepied lourd, un bras qui s'avance vers la piste."""
    metal = peint(P, 'metal', P['metal'])
    sombre = peint(P, 'sombre', P['sombre'])
    accent = peint(P, 'accent', P['accent'])
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.3
        tube('jambe%d' % k, metal, (0.9 * math.cos(a), 0.9 * math.sin(a), 0), (0, 0, 1.6), 0.045, 8)
    tube('colonne', metal, (0, 0, 1.2), (0, 0, 1.95), 0.08, 10)
    boite('rotule', sombre, -0.18, -0.18, 1.9, 0.18, 0.18, 2.1)
    a = math.radians(24)
    arr = Vector((0, -1.4 * math.cos(a), 2.0 - 1.4 * math.sin(a)))
    avant = Vector((0, 3.6 * math.cos(a), 2.0 + 3.6 * math.sin(a)))
    tube('bras', accent, tuple(arr), tuple(avant), 0.07, 8)
    tube('bras2', metal, tuple(arr + Vector((0, 0, -0.12))), tuple(avant + Vector((0, 0, -0.12))), 0.03, 6)
    for dz in (0.0, -0.26):
        boite('contrepoids', sombre, -0.18, arr.y - 0.22, arr.z - 0.2 + dz, 0.18, arr.y + 0.12, arr.z + 0.02 + dz)
    boite('tete', sombre, -0.16, avant.y - 0.05, avant.z - 0.5, 0.16, avant.y + 0.4, avant.z - 0.2)
    tube('objectif', metal, (0, avant.y + 0.4, avant.z - 0.35), (0, avant.y + 0.7, avant.z - 0.35), 0.08, 12)


def ecran_retour(P):
    """L'ecran de retour tourne vers les athletes, sur son pied.

    Il ne montre ni chiffre ni nom : un degrade des couleurs de la soiree,
    comme un ecran pris entre deux images.
    """
    metal = peint(P, 'metal', P['metal'])
    sombre = peint(P, 'cadre', P['sombre'])
    for x in (-1.3, 1.3):
        tube('pied', metal, (x, 0, 0), (x, 0, 2.0), 0.06, 8)
        boite('semelle', sombre, x - 0.35, -0.5, 0, x + 0.35, 0.5, 0.08)
    boite('cadre', sombre, -1.75, -0.12, 1.9, 1.75, 0.12, 3.9)
    bm = bmesh.new()
    nx, nz = 12, 6
    vs = [[bm.verts.new((-1.62 + 3.24 * i / nx, -0.13, 2.02 + 1.76 * j / nz)) for j in range(nz + 1)]
          for i in range(nx + 1)]
    cols = [P['panneaux'][0], P['panneaux'][2], P['panneaux'][1]]
    me_objs = []
    for i in range(nx):
        for j in range(nz):
            f = bm.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j]))
            f.material_index = (i // 4 + (1 if j > nz // 2 else 0)) % 3
    me = bpy.data.meshes.new('dalle')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('dalle', me)
    bpy.context.collection.objects.link(o)
    for k, c in enumerate(cols):
        o.data.materials.append(M.aplat('led%d' % k, c))
    o.parent = _racine


# -----------------------------------------------------------------------
# RIVIERA — des aplats, comme sur une affiche
# -----------------------------------------------------------------------

def vigie(P):
    """La chaise haute du maitre-nageur, a rayures, et sa bouee."""
    blanc = peint(P, 'blanc', P['creme'])
    corail = peint(P, 'corail', P['corail'])
    toit = peint(P, 'toit', P['turquoise'])
    bouee = peint(P, 'bouee', (242, 80, 70))
    for x in (-0.7, 0.7):
        for y in (-0.7, 0.7):
            tube('pied', blanc, (x * 1.25, y * 1.25, 0), (x, y, 2.2), 0.06, 8)
    for z in (0.8, 1.5):
        k = 1.25 - 0.55 * z / 2.2
        for (a, b) in (((-k, -k), (k, -k)), ((k, -k), (k, k)), ((k, k), (-k, k)), ((-k, k), (-k, -k))):
            tube('traverse', blanc, (a[0], a[1], z), (b[0], b[1], z), 0.035, 6)
    boite('plancher', blanc, -0.85, -0.85, 2.2, 0.85, 0.85, 2.32)
    for k in range(5):
        x0 = -0.85 + k * 0.34
        boite('rayure', corail if k % 2 == 0 else blanc, x0, 0.72, 2.32, x0 + 0.34, 0.85, 3.0)
        boite('rayure', corail if k % 2 == 0 else blanc, x0, -0.85, 2.32, x0 + 0.34, -0.72, 3.0)
    boite('flanc', blanc, -0.85, -0.72, 2.32, -0.72, 0.72, 3.0)
    boite('flanc', blanc, 0.72, -0.72, 2.32, 0.85, 0.72, 3.0)
    bm = bmesh.new()
    c = 1.15
    coins = [bm.verts.new((x, y, 3.35)) for x, y in ((-c, -c), (c, -c), (c, c), (-c, c))]
    som = bm.verts.new((0, 0, 4.15))
    for k in range(4):
        bm.faces.new((coins[k], coins[(k + 1) % 4], som))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.05)
    _mesh('toit', toit, bm)
    for x in (-0.8, 0.8):
        for y in (-0.8, 0.8):
            tube('poteau', blanc, (x, y, 3.0), (x, y, 3.35), 0.04, 6)
    for k in range(6):
        z = 0.35 + k * 0.33
        tube('echelon', blanc, (-0.4, -1.25 + 0.1 * k, z), (0.4, -1.25 + 0.1 * k, z), 0.03, 6)
    tube('limon', blanc, (-0.42, -1.4, 0), (-0.42, -0.85, 2.2), 0.04, 6)
    tube('limon', blanc, (0.42, -1.4, 0), (0.42, -0.85, 2.2), 0.04, 6)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.32, radius2=0.32, depth=0.1)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, 'X'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0.3, 0.9, 2.65), verts=bm.verts)
    _mesh('bouee', bouee, bm)


def cabines(P):
    """Trois cabines de plage a rayures, cote a cote."""
    creme = peint(P, 'creme', P['creme'])
    toits = [peint(P, 'toit%d' % k, c) for k, c in enumerate(P['cabinesToit'])]
    rayures = [peint(P, 'rayure%d' % k, c) for k, c in enumerate(P['cabinesRayure'])]
    for k in range(3):
        x0 = -2.4 + k * 1.65
        w, d, h = 1.45, 1.4, 2.1
        boite('socle', creme, x0 - 0.05, -0.05, 0, x0 + w + 0.05, d + 0.05, 0.12)
        for i in range(7):
            xi = x0 + i * w / 7
            mat = rayures[k] if i % 2 == 0 else creme
            boite('planche', mat, xi, -0.02, 0.12, xi + w / 7, 0.06, h)
        boite('dos', creme, x0, d - 0.06, 0.12, x0 + w, d, h)
        boite('cote', creme, x0, 0, 0.12, x0 + 0.06, d, h)
        boite('cote', creme, x0 + w - 0.06, 0, 0.12, x0 + w, d, h)
        bm = bmesh.new()
        a = [bm.verts.new(p) for p in ((x0 - 0.1, -0.15, h), (x0 + w + 0.1, -0.15, h),
                                       (x0 + w + 0.1, d + 0.15, h), (x0 - 0.1, d + 0.15, h))]
        r1 = bm.verts.new((x0 - 0.1, d / 2, h + 0.55))
        r2 = bm.verts.new((x0 + w + 0.1, d / 2, h + 0.55))
        bm.faces.new((a[0], a[1], r2, r1))
        bm.faces.new((a[2], a[3], r1, r2))
        bm.faces.new((a[1], a[2], r2))
        bm.faces.new((a[3], a[0], r1))
        bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.05)
        _mesh('toit', toits[k], bm)


# -----------------------------------------------------------------------
# NUIT ETOILEE
# -----------------------------------------------------------------------

def meule(P):
    """La meule de foin des toiles d'Arles : un dome de paille, strie de touches.

    Une premiere version empilait des ecailles decalees d'un rang a l'autre,
    et la meule tournait a la pomme de pin. Chez Van Gogh la paille tombe :
    des touches VERTICALES, longues, serrees, de trois ors voisins, qui
    suivent la courbe du dome du pied au sommet. Le dome est plus large que
    haut, tasse par son propre poids, et une ceinture plus sombre marque le
    pied la ou la paille touche l'herbe.
    """
    ors = [peint(P, 'or%d' % k, c) for k, c in enumerate(P['ors'])]
    pied = peint(P, 'pied', tuple(int(c * 0.72) for c in P['ors'][2]))
    n, rangs = 40, 7
    R, H = 1.75, 2.35

    def profil(t):
        # t de 0 (pied) a 1 (sommet) : un dome tasse, legerement renfle
        return R * (1.0 - t ** 2.1) ** 0.62, H * t

    # L'ondulation se donne par BORD et non par touche : deux touches voisines
    # partagent alors exactement le meme bord, a la meme hauteur et au meme
    # rayon. Donnee par touche, chacune avait son rayon a elle, et le dome se
    # fendait entre elles comme un panier d'osier.
    def bord(e, i):
        t = i / rangs
        r, z = profil(min(t, 0.985))
        dr = 1.0 + 0.03 * math.sin(e * 1.7 + i * 0.9) * (1 - t)
        a = 2 * math.pi * e / n
        return (r * dr * math.cos(a), r * dr * math.sin(a), z)

    for k in range(n):
        mat = ors[(k * 7 + (k // 3)) % len(ors)]
        bm = bmesh.new()
        g = [bm.verts.new(bord(k, i)) for i in range(rangs + 1)]
        d = [bm.verts.new(bord(k + 1, i)) for i in range(rangs + 1)]
        for i in range(rangs):
            bm.faces.new((g[i], d[i], d[i + 1], g[i + 1]))
        _mesh('touche', mat, bm)
    # un dome plein, juste en dessous des touches : rien ne se voit a travers
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=10, radius=1.0)
    for v in bm.verts:
        v.co.z = max(v.co.z, 0.0)
        v.co.x *= R * 0.965; v.co.y *= R * 0.965; v.co.z *= H * 0.955
    _mesh('coeur', pied, bm)
    # la ceinture du pied, et la petite coiffe du sommet
    disque('ceinture', pied, 0, 0, 0.0, 0.18, R * 1.02, cotes=40)
    prisme('coiffe', ors[1], 0, 0, H * 0.96, 0.22, 0.08, 0.30, cotes=10)


def lanterne(P):
    """La lanterne de la terrasse, et la flaque de lumiere qu'elle pose."""
    fer = peint(P, 'fer', P['fer'])
    jaune = M.aplat('verre', P['lueur'])
    tube('mat', fer, (0, 0, 0), (0, 0, 3.3), 0.06, 8)
    disque('pied', fer, 0, 0, 0, 0.18, 0.22, cotes=12)
    tube('crosse', fer, (0, 0, 3.3), (0, 0.45, 3.55), 0.04, 6)
    boite('lanterne', jaune, -0.2, 0.3, 3.0, 0.2, 0.7, 3.5)
    for (x, y) in ((-0.2, 0.3), (0.2, 0.3), (0.2, 0.7), (-0.2, 0.7)):
        tube('montant', fer, (x, y, 3.0), (x, y, 3.5), 0.018, 5)
    prisme('capot', fer, 0, 0.5, 3.5, 0.3, 0.05, 0.25, cotes=4, tourne=math.pi / 4)
    halo('flaque', P['lueur'], 0, 0.5, 0.02, 3.4, force=0.42)
    table = peint(P, 'table', P['table'])
    disque('plateau', table, 1.3, -0.6, 0.72, 0.76, 0.42, cotes=18)
    tube('pied_table', fer, (1.3, -0.6, 0), (1.3, -0.6, 0.72), 0.03, 6)
    for (x, y) in ((0.7, -0.9), (1.9, -0.3)):
        boite('assise', table, x - 0.2, y - 0.2, 0.44, x + 0.2, y + 0.2, 0.48)
        boite('dossier', fer, x - 0.2, y + 0.16, 0.48, x + 0.2, y + 0.2, 0.9)


# -----------------------------------------------------------------------
# TROIS SOLEILS — des aplats cernes
# -----------------------------------------------------------------------

def rocs(P):
    """Trois rochers ronds, bleu-vert, poses l'un contre l'autre."""
    roche = peint(P, 'roche', P['roche'])
    ombre = peint(P, 'roche_sombre', P['rocheSombre'])
    caillou('gros', roche, 0, 0, 0, 1.3, 1.1, 1.0, graine=1.2, subdiv=2)
    caillou('moyen', ombre, 1.4, 0.4, 0, 0.8, 0.7, 0.62, graine=4.4, subdiv=2)
    caillou('petit', roche, -1.1, 0.8, 0, 0.55, 0.5, 0.42, graine=8.8, subdiv=1)


def bulbes(P):
    """Des arbustes a tete ronde, comme de jeunes arbres a chapeau."""
    tige = peint(P, 'tige', P['tronc'])
    tete = peint(P, 'tete', P['chapeau'])
    clair = peint(P, 'tete_claire', tuple(min(255, int(c * 1.25)) for c in P['chapeau']))
    for k, (x, y, h, r) in enumerate(((0, 0, 1.9, 0.7), (1.0, 0.6, 1.3, 0.5), (-0.8, 0.7, 1.0, 0.42))):
        tube('tige%d' % k, tige, (x, y, 0), (x, y, h), 0.09, 8)
        caillou('tete%d' % k, tete if k else clair, x, y, h + r * 0.4, r, r, r * 0.8, graine=k * 3.1, subdiv=2)


def aiguille(P):
    """Une aiguille de roche baguee, la petite soeur de celles de l'horizon."""
    roche = peint(P, 'roche', P['roche'])
    bague = peint(P, 'bague', P['rocheSombre'])
    prisme('fut', roche, 0, 0, 0, 0.55, 3.6, 0.9, cotes=7)
    for z in (1.0, 2.2):
        disque('bague', bague, 0, 0, z, z + 0.22, 0.6, cotes=14)
    caillou('pied', bague, 0, 0, 0, 0.9, 0.8, 0.4, graine=2.0)


DEBOUT.update({
    'cristaux': cristaux, 'obelisque': obelisque, 'antenne': antenne,
    'rocher_flottant': rocher_flottant,
    'tour_lumiere': tour_lumiere, 'camera_tv': camera_tv, 'grue': grue,
    'ecran_retour': ecran_retour,
    'vigie': vigie, 'cabines': cabines,
    'meule': meule, 'lanterne': lanterne,
    'rocs': rocs, 'bulbes': bulbes, 'aiguille': aiguille,
})


def caisses(P):
    """Des caisses de transport empilees, ruban de couleur aux aretes.

    Basses a dessein : c'est ce qu'on peut poser le long d'une ligne droite
    sans jamais se dresser devant les coureurs.
    """
    noir = peint(P, 'caisse', (40, 38, 50))
    coin = peint(P, 'coin', P['metal'])
    ruban = [M.aplat('ruban%d' % k, c) for k, c in enumerate(P['panneaux'])]
    empile = [(-0.7, -0.2, 0.0, 1.2, 0.8, 0.62, 0), (0.62, 0.05, 0.0, 0.9, 0.7, 0.55, 1),
              (-0.55, -0.1, 0.62, 0.9, 0.62, 0.5, 2)]
    for k, (x, y, z, L, l, h, c) in enumerate(empile):
        boite('caisse%d' % k, noir, x - L / 2, y - l / 2, z, x + L / 2, y + l / 2, z + h)
        boite('ruban%d' % k, ruban[c], x - L / 2 - 0.005, y - l / 2 - 0.005, z + h * 0.42,
              x + L / 2 + 0.005, y + l / 2 + 0.005, z + h * 0.56)
        for sx in (-1, 1):
            for sy in (-1, 1):
                boite('coin', coin, x + sx * L / 2 - (0.06 if sx > 0 else 0), y + sy * l / 2 - (0.06 if sy > 0 else 0),
                      z + h - 0.06, x + sx * L / 2 + (0.0 if sx > 0 else 0.06), y + sy * l / 2 + (0.0 if sy > 0 else 0.06), z + h)
    tube('cable', coin, (0.9, 0.5, 0.03), (2.1, 1.1, 0.03), 0.025, 6)


def projecteur_sol(P):
    """Un projecteur de scene pose au sol, tourne vers le ciel, et son faisceau."""
    noir = peint(P, 'corps', (34, 32, 44))
    metal = peint(P, 'etrier', P['metal'])
    lentille = M.aplat('lentille', (250, 246, 255))
    boite('socle', noir, -0.35, -0.3, 0.0, 0.35, 0.3, 0.12)
    for x in (-0.32, 0.32):
        boite('etrier', metal, x - 0.03, -0.04, 0.12, x + 0.03, 0.04, 0.7)
    tube('corps', noir, (0, -0.15, 0.62), (0, 0.18, 1.02), 0.24, 16)
    tube('verre', lentille, (0, 0.18, 1.02), (0, 0.2, 1.05), 0.2, 16)
    halo('flaque', P['panneaux'][1], 0, 0.6, 0.02, 1.6, force=0.3)


DEBOUT.update({'caisses': caisses, 'projecteur_sol': projecteur_sol})


# -----------------------------------------------------------------------
# LE MATERIEL DE PISTE
# -----------------------------------------------------------------------

def blocs(P):
    """Un bloc de depart : le rail cranté, deux pedales inclinees, decalees.

    Il ne ressemblait a rien : trois quadrilateres plats en travers du
    couloir. Un vrai bloc est un rail d'aluminium etroit, dans l'axe du
    couloir, sur lequel coulissent deux pedales — l'une a gauche, l'autre a
    droite, la gauche plus en avant — chacune une plaque inclinee garnie de
    caoutchouc, tenue par un etrier sur son chariot.

    LES PEDALES SONT OU SONT LES PIEDS. Leur position ne se choisit pas a
    l'oeil : elle se deduit de la posture de depart du rig (BLOC dans
    sprinter-core.js) — chevilles a -0,56 et -0,86 m de la ligne, pied incline
    a -0,80 rad. Chaque plaque est posee sous la semelle, dans son plan.

    Origine : sur la ligne de depart, au milieu du couloir. +X vers la course.
    """
    alu = peint(P, 'aluminium', (190, 196, 208))
    fonce = peint(P, 'fonte', (58, 62, 76))
    gomme = peint(P, 'caoutchouc', (40, 42, 52))
    rouge = peint(P, 'chariot', (204, 48, 54))
    # le rail : long, etroit, cranté sur le dessus
    boite('rail', alu, -1.06, -0.04, 0.0, -0.26, 0.04, 0.045)
    for k in range(22):
        x = -1.02 + k * 0.034
        boite('cran', fonce, x, -0.03, 0.045, x + 0.012, 0.03, 0.055)
    # la plaque d'ancrage a l'avant, et ses pointes
    boite('nez', fonce, -0.30, -0.07, 0.0, -0.22, 0.07, 0.03)
    boite('queue', fonce, -1.10, -0.07, 0.0, -1.02, 0.07, 0.03)

    cheville = -0.80
    ax_pied = Vector((math.cos(cheville), 0, math.sin(cheville)))      # talon -> pointe
    normale = Vector((-math.sin(cheville), 0, math.cos(cheville)))     # vers le pied
    for (ax, az), cote in (((-0.56, 0.16), 1), ((-0.86, 0.19), -1)):
        y = cote * 0.085
        # la semelle, dans le repere du rig : centre du pied puis sa face basse
        centre = Vector((ax, 0, az)) + Vector((0.036 * math.cos(cheville) + 0.030 * math.sin(cheville), 0,
                                                0.036 * math.sin(cheville) - 0.030 * math.cos(cheville)))
        semelle = centre - normale * 0.030
        L, l, e = 0.24, 0.13, 0.03
        # la plaque : un pave dans le plan de la semelle
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(L, l, e), verts=bm.verts)
        rot = Matrix.Rotation(-cheville, 4, 'Y')
        bmesh.ops.transform(bm, matrix=Matrix.Translation(tuple(semelle - normale * (e / 2))) @ rot,
                            verts=bm.verts)
        for v in bm.verts:
            v.co.y += y
        _mesh('plaque', fonce, bm)
        # la garniture de caoutchouc, sur la face qui prend le pied
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(L * 0.9, l * 0.86, 0.008), verts=bm.verts)
        bmesh.ops.transform(bm, matrix=Matrix.Translation(tuple(semelle - normale * 0.002)) @ rot,
                            verts=bm.verts)
        for v in bm.verts:
            v.co.y += y
        _mesh('gomme', gomme, bm)
        # le chariot sur le rail, et l'etrier qui porte la plaque
        cx = semelle.x - 0.05
        boite('chariot', rouge, cx - 0.07, -0.05, 0.03, cx + 0.07, 0.05, 0.075)
        bas = semelle - normale * 0.03 - ax_pied * (L * 0.30)
        tube('etrier', alu, (cx, cote * 0.03, 0.07), (bas.x, y, bas.z), 0.012, 6)
        haut = semelle - normale * 0.03 - ax_pied * (-L * 0.40)
        tube('jambe', alu, (cx - 0.05, cote * 0.03, 0.06), (haut.x, y, haut.z), 0.012, 6)


DEBOUT.update({'blocs': blocs})
