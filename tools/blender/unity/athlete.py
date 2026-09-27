# -----------------------------------------------------------------------
# JUMPER — l'athlete articule, pour la scene Unity du saut.
#
#   blender -b -P tools/blender/unity/athlete.py -- \
#       --sortie unity/JumperSaut/Assets/Modeles/Athlete.fbx
#
# LE MEME CORPS QUE CELUI DU JEU, CETTE FOIS EN MAILLAGE. coureur.py sculpte
# un sprinter en metaballs pour en MESURER l'epaisseur ; le moteur 2D n'en
# garde que des troncs de cone. Unity, lui, sait afficher un maillage : on
# garde donc la sculpture elle-meme, on lui pose un squelette aux cotes
# exactes du rig de pose() (sprinter-core.js), et on l'exporte.
#
# LE SQUELETTE EST CELUI DU RIG, OS POUR OS. Hanche a 0,87, epaule a 1,34,
# coude a 1,09, poignet a 0,816, cuisse a 0,85, genou a 0,458, cheville a
# 0,078. La scene Unity recoit les angles du rig a chaque image et les pose
# sur ces os-la : pas de retargeting, pas d'animation a part — l'athlete
# fait exactement le geste que le jeu calcule.
#
# LES POIDS NE SONT PAS CALCULES PAR BLENDER. Son « automatic weights »
# (diffusion de chaleur) echoue sans bruit sur des volumes qui se
# chevauchent, et les cinq familles du corps se chevauchent a dessein (voir
# corps() plus bas). Chaque sommet appartient donc a sa famille — une jambe
# ne peut pas etre tiree par le buste — et, dans sa famille, il se partage
# entre deux os selon sa hauteur, en fondu autour de l'articulation.
# -----------------------------------------------------------------------

import bpy
import bmesh
import sys
import os
import math

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(ICI))
import anatomie
import coureur as C

# Les reperes du rig (voir anatomie.py).
HIP_Z, SHOULDER_Z, ELBOW_Z, HAND_Z = 0.87, 1.34, 1.09, 0.816
LEGHIP_Z, KNEE_Z, ANKLE_Z = 0.85, 0.458, 0.078
NECK_Z = HIP_Z + 0.52          # la tete tourne autour de la base du cou

# L'ourlet du short masculin : au tiers de la cuisse (ourlet = -0,156 sous
# le pivot, dans pose()).
OURLET_Z = LEGHIP_Z - 0.156


def pied(cote, hy):
    """Le pied chausse, aux cotes de celui du rig (voir rendu.py)."""
    z = ANKLE_Z - 0.030
    y = hy * cote
    return [
        (-0.030, y, z + 0.014, 0.031, 0.000, 0.014),
        (0.010, y, z + 0.004, 0.031, 0.000, 0.018),
        (0.056, y, z - 0.004, 0.029, 0.000, 0.019),
        (0.100, y, z - 0.008, 0.025, 0.000, 0.016),
        (0.138, y, z - 0.012, 0.018, 0.000, 0.010),
    ]


FAMILLES = {
    'TRONC': ('pelvis', 'torso', 'neck', 'head'),
    'BRAS_G': ('deltoid', 'upperarm', 'forearm'),
    'BRAS_D': ('deltoid', 'upperarm', 'forearm'),
    'JAMBE_G': ('thigh', 'shank'),
    'JAMBE_D': ('thigh', 'shank'),
}


def matiere(nom, couleur, rugosite=0.6):
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*couleur, 1.0)
    bsdf.inputs['Roughness'].default_value = rugosite
    return m


def sculpter_familles(groupes, rayons, hy, resolution):
    objets = {}
    for nom, gs in FAMILLES.items():
        cote = -1 if nom.endswith('_D') else 1
        masses, rs = [], []
        for g in gs:
            for masse, R in zip(groupes[g], rayons[g]):
                x, y, z, r0, dx, dy = masse
                masses.append((x, y * cote, z, r0, dx, dy))
                rs.append(R)
        if nom.startswith('JAMBE'):
            for m in pied(cote, hy):
                masses.append(m)
                rs.append(m[3] / C.SEUIL_BILLE)
        o = C.sculpter(nom, masses, rs, resolution)
        objets[nom] = o
    return objets


def decimer(o, ratio):
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    d = o.modifiers.new('decimer', 'DECIMATE')
    d.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=d.name)


# LES OURLETS SONT DES COUPES NETTES. Une matiere choisie face par face, sur
# un maillage decime, suit les grands triangles : l'ourlet du short sortait
# dechiquete. On coupe donc le maillage exactement sur chaque ligne de
# couture avant de choisir les matieres — chaque face tombe alors tout
# entiere d'un cote.
COUTURES = {
    'TRONC': [((0, 0, 0.935), (0, 0, 1)), ((0, 0, 1.358), (0, 0, 1)),
              ((0, 0, 1.545), (0, 0, 1)), ((0, 0, 1.600), (0, 0, 1)),
              ((0.028, 0, 1.57), (1, 0, 0))],
    'JAMBE': [((0, 0, OURLET_Z), (0, 0, 1)), ((0, 0, ANKLE_Z + 0.004), (0, 0, 1))],
}


def couper(o, famille):
    plans = COUTURES.get('TRONC' if famille == 'TRONC' else
                         'JAMBE' if famille.startswith('JAMBE') else '', [])
    if not plans:
        return
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for co, no in plans:
        geo = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geo, plane_co=co, plane_no=no)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(o.data)
    bm.free()


def squelette(sy, hy):
    """Le rig de pose(), en os Blender. x devant, y a gauche, z en haut."""
    arm = bpy.data.armatures.new('Rig')
    obj = bpy.data.objects.new('Athlete', arm)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones

    def os_(nom, tete, queue, parent=None):
        b = eb.new(nom)
        b.head = tete
        b.tail = queue
        b.roll = 0.0
        if parent:
            b.parent = eb[parent]
            b.use_connect = False
        return b

    os_('Hanches', (0, 0, HIP_Z), (0, 0, HIP_Z + 0.06))
    os_('Bassin', (0, 0, HIP_Z), (0, 0, HIP_Z - 0.10), 'Hanches')
    os_('Buste', (0, 0, HIP_Z), (0, 0, SHOULDER_Z), 'Hanches')
    os_('Tete', (0, 0, NECK_Z), (0, 0, 1.63), 'Buste')
    for cote, s in (('G', 1), ('D', -1)):
        os_('Bras.' + cote, (0, s * sy, SHOULDER_Z), (0, s * sy, ELBOW_Z), 'Buste')
        os_('AvantBras.' + cote, (0, s * sy, ELBOW_Z), (0, s * sy, HAND_Z), 'Bras.' + cote)
        os_('Cuisse.' + cote, (0, s * hy, LEGHIP_Z), (0, s * hy, KNEE_Z), 'Hanches')
        os_('Jambe.' + cote, (0, s * hy, KNEE_Z), (0, s * hy, ANKLE_Z), 'Cuisse.' + cote)
        os_('Pied.' + cote, (0, s * hy, ANKLE_Z), (0.15, s * hy, ANKLE_Z), 'Jambe.' + cote)
    bpy.ops.object.mode_set(mode='OBJECT')
    return obj


def fondu(z, z0, largeur):
    """0 sous z0 - largeur, 1 au-dessus de z0 + largeur, lisse entre."""
    t = (z - (z0 - largeur)) / (2 * largeur)
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def poids(famille, co):
    """Les os d'un sommet, dans sa famille, selon ou il est."""
    x, y, z = co
    if famille == 'TRONC':
        w_buste = fondu(z, 0.945, 0.035)
        w_tete = fondu(z, 1.455, 0.025)
        return {'Bassin': 1 - w_buste, 'Buste': w_buste * (1 - w_tete), 'Tete': w_tete}
    c = 'G' if famille.endswith('_G') else 'D'
    if famille.startswith('BRAS'):
        # Le deltoide appartient autant au buste qu'au bras : leve le bras,
        # et le haut de l'epaule reste accroche a la cage.
        w_bras = fondu(z, ELBOW_Z, 0.03)             # 1 = bras, 0 = avant-bras
        w_buste = fondu(z, 1.345, 0.03) * 0.55
        return {'AvantBras.' + c: 1 - w_bras, 'Bras.' + c: w_bras * (1 - w_buste),
                'Buste': w_bras * w_buste}
    # une jambe
    w_cuisse = fondu(z, KNEE_Z, 0.035)
    w_pied = 1 - fondu(z, ANKLE_Z + 0.012, 0.02)
    # le fessier suit un peu le bassin quand la cuisse monte
    w_bassin = fondu(z, 0.86, 0.04) * 0.5
    reste = 1 - w_pied
    return {'Pied.' + c: w_pied,
            'Jambe.' + c: reste * (1 - w_cuisse),
            'Cuisse.' + c: reste * w_cuisse * (1 - w_bassin),
            'Bassin': reste * w_cuisse * w_bassin}


def habiller(famille, co, nrm):
    """La matiere d'une face : peau, maillot, short, chaussure, cheveux."""
    x, y, z = co
    if famille == 'TRONC':
        if z > 1.545 and (x < 0.028 or z > 1.600) and not (x > 0 and z < 1.57):
            return 'Cheveux'
        if z < 0.935:
            return 'Short'
        if z < 1.358:
            return 'Maillot'
        return 'Peau'
    if famille.startswith('JAMBE'):
        if z < ANKLE_Z + 0.004:
            return 'Chaussure'
        if z > OURLET_Z:
            return 'Short'
    return 'Peau'


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    sortie = 'unity/JumperSaut/Assets/Modeles/Athlete.fbx'
    if '--sortie' in args:
        sortie = args[args.index('--sortie') + 1]
    resolution = 0.0075
    fem = False

    groupes = anatomie.masses(fem=fem)
    print('calibration du corps...')
    rayons, _ = C.calibrer(groupes, passes=8)
    C.vider()
    E = anatomie.ecarts(fem)
    sy, hy = E['sh'], E['hip']

    objets = sculpter_familles(groupes, rayons, hy, resolution)
    cibles = {'TRONC': 0.2, 'BRAS_G': 0.2, 'BRAS_D': 0.2, 'JAMBE_G': 0.17, 'JAMBE_D': 0.17}
    mats = {n: matiere(n, c) for n, c in (
        ('Peau', (0.45, 0.27, 0.17)), ('Maillot', (0.05, 0.25, 0.75)),
        ('Short', (0.04, 0.05, 0.1)), ('Chaussure', (0.95, 0.3, 0.1)),
        ('Cheveux', (0.03, 0.02, 0.02)))}
    ordre = list(mats)

    rig = squelette(sy, hy)
    for fam, o in objets.items():
        decimer(o, cibles[fam])
        couper(o, fam)
        me = o.data
        for n in ordre:
            me.materials.append(mats[n])
        for p in me.polygons:
            c = p.center
            p.material_index = ordre.index(habiller(fam, (c.x, c.y, c.z), p.normal))
            p.use_smooth = True
        # les poids
        groupes_v = {}
        for v in me.vertices:
            for os_nom, w in poids(fam, tuple(v.co)).items():
                if w < 1e-3:
                    continue
                g = groupes_v.get(os_nom) or o.vertex_groups.new(name=os_nom)
                groupes_v[os_nom] = g
                g.add([v.index], w, 'REPLACE')
        o.parent = rig
        mod = o.modifiers.new('rig', 'ARMATURE')
        mod.object = rig
        print('%s : %d sommets, %d faces' % (fam, len(me.vertices), len(me.polygons)))

    # Un seul maillage : un seul SkinnedMeshRenderer dans Unity, un seul
    # appel de dessin par matiere.
    bpy.ops.object.select_all(action='DESELECT')
    for o in objets.values():
        o.select_set(True)
    bpy.context.view_layer.objects.active = objets['TRONC']
    bpy.ops.object.join()
    corps = bpy.context.view_layer.objects.active
    corps.name = 'Corps'
    print('corps : %d sommets, %d triangles' % (
        len(corps.data.vertices), sum(len(p.vertices) - 2 for p in corps.data.polygons)))

    os.makedirs(os.path.dirname(os.path.abspath(sortie)), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.fbx(
        filepath=os.path.abspath(sortie), use_selection=True,
        object_types={'ARMATURE', 'MESH'}, add_leaf_bones=False,
        apply_unit_scale=True, apply_scale_options='FBX_SCALE_UNITS',
        bake_anim=False, mesh_smooth_type='FACE', use_armature_deform_only=True,
        primary_bone_axis='Y', secondary_bone_axis='X',
        axis_forward='-Z', axis_up='Y')
    blend = os.path.splitext(os.path.abspath(sortie))[0] + '.blend'
    print('ecrit : %s' % sortie)
    if '--blend' in args:
        bpy.ops.wm.save_as_mainfile(filepath=args[args.index('--blend') + 1])


main()
