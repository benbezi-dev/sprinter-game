# -----------------------------------------------------------------------
# AUREL MANGA POUR UNITY — maillage, textures PBR, rig Rigify, export FBX.
#
#   blender -b -P tools/blender/aurel_unity.py -- [--sortie unity/AurelManga]
#                                                 [--texture 2048] [--rapide]
#
#   ... et pour une ANIMATION faite sur le rig Rigify du fichier de travail :
#
#   blender -b -P tools/blender/aurel_unity.py -- --animation \
#           unity/AurelManga/Aurel_Manga.blend --clip Course
#     -> unity/AurelManga/Animations/Aurel_Course.fbx : la plage de la scene,
#        cuite image par image sur le squelette de jeu (ses contraintes Copy
#        Transforms lisent le rig Rigify), memes reglages Unity que le modele.
#
# Ce que la chaine produit, dans `--sortie` :
#
#   Aurel_Manga.fbx          le personnage pour Unity : UN maillage skinne et
#                            SON armature de jeu, rien d'autre (ni camera, ni
#                            lumiere, ni rig de controle).
#   Textures/                les cartes PBR, nommees pour URP/HDRP Lit :
#     Aurel_Body_BaseMap.png           couleur (sRGB)
#     Aurel_Body_Normal.png            normales, espace tangent, OpenGL (Y+),
#                                      c'est la convention d'Unity
#     Aurel_Body_MetallicSmoothness.png  R = metallique (0), A = lissage
#     Aurel_Eyes_BaseMap.png
#   Aurel_Manga.blend        le fichier de travail : le rig RIGIFY complet pour
#                            animer, le squelette de jeu qui le suit, le
#                            maillage et ses materiaux.
#
# LES QUATRE ETAPES.
#
#   1. LE MODELE, en A (portrait_vedette.py, pose='A') : le meme Aurel que son
#      portrait, bras ecartes a 45 degres — la pose de repos d'un rig.
#   2. LE MAILLAGE DE JEU. Le modele est fait de masses fondues, dense et en
#      plusieurs morceaux. On les fusionne par remaillage voxel (une seule
#      peau, fermee, sans morceaux qui s'interpenetrent), on decime vers un
#      budget de jeu, on deplie les UV, et on CUIT sur ce maillage ce que les
#      materiaux proceduraux peignaient : maillot, barbe, cheveux, relief de
#      la peau. Unity ne lit pas les noeuds de Blender ; il lit des images.
#   3. LE RIG. Un metarig humain Rigify, sans visage, doigts ni seins (le
#      modele n'a ni doigts separes ni visage anime), cale sur les
#      articulations du modele, puis genere : c'est le rig de CONTROLE, pour
#      animer dans Blender. Le maillage est pondere automatiquement sur ses os
#      de deformation (DEF-*).
#   4. LE SQUELETTE DE JEU ET L'EXPORT. Unity ne veut que les os qui
#      deforment, dans une hierarchie propre. Le rig Rigify, lui, en a des
#      centaines (ORG, MCH, controles) et ses os DEF ne s'enchainent pas
#      toujours entre eux. On construit donc une armature de jeu a partir des
#      seuls os DEF — memes positions, memes rolls —, en fusionnant les
#      segments de torsion (DEF-upper_arm.L.001...) dans leur os, avec les noms
#      de l'avatar Humanoid d'Unity (Hips, Spine, LeftUpperArm...), qu'Unity
#      reconnait tout seul. Chaque os de jeu COPIE son os DEF (contrainte Copy
#      Transforms) : on anime le rig Rigify, et l'export cuit le mouvement
#      sur le squelette de jeu. Les poids du maillage sont renommes et
#      fusionnes en consequence, et c'est ce squelette-la que le FBX emporte.
#
# L'EXPORT FBX (voir `exporter`) : selection seule (maillage + armature de
# jeu), types MESH et ARMATURE seulement, transformations appliquees (a la
# main : la case « Apply Transform » de Blender ne s'applique pas aux
# armatures, voir `exporter`), axes Unity (Y vers le haut, -Z vers l'avant),
# os de deformation seulement, pas d'os de bout (« leaf bones ») qu'Unity
# prendrait pour des os en trop.
# -----------------------------------------------------------------------

import bpy
import bmesh
import math
import os
import sys
import addon_utils
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import portrait_vedette as PV


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    val = lambda k, d: a[a.index(k) + 1] if k in a else d
    return dict(sortie=val('--sortie', 'unity/AurelManga'),
                texture=int(val('--texture', '2048')),
                rapide='--rapide' in a)


def activer(o, *autres):
    bpy.ops.object.mode_set(mode='OBJECT') if bpy.context.object and bpy.context.object.mode != 'OBJECT' else None
    bpy.ops.object.select_all(action='DESELECT')
    for x in autres:
        x.select_set(True)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


# -----------------------------------------------------------------------
# 2. LE MAILLAGE DE JEU
# -----------------------------------------------------------------------

def maillage_de_jeu(hauts, triangles, voxel):
    """Une seule peau, fermee, au budget de jeu, a partir des morceaux."""
    copies = []
    for o in hauts:
        c = o.copy()
        c.data = o.data.copy()
        c.data.materials.clear()
        bpy.context.collection.objects.link(c)
        copies.append(c)
    activer(copies[0], *copies[1:])
    bpy.ops.object.join()
    bas = bpy.context.view_layer.objects.active
    bas.name = 'Aurel_Body'
    # UNE PEAU, PAS DES MORCEAUX. Le tronc, les jambes et la tete sont des
    # volumes qui s'interpenetrent : en jeu, ils se deformeraient chacun de
    # leur cote et les joints s'ouvriraient au premier pas.
    m = bas.modifiers.new('voxel', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = voxel
    m.adaptivity = 0.0
    bpy.ops.object.modifier_apply(modifier=m.name)
    n = sum(len(p.vertices) - 2 for p in bas.data.polygons)
    d = bas.modifiers.new('budget', 'DECIMATE')
    d.ratio = min(1.0, triangles / max(1, n))
    d.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=d.name)
    bpy.ops.object.shade_smooth()
    print('maillage de jeu : %d triangles (voxel %.1f mm)' % (
        sum(len(p.vertices) - 2 for p in bas.data.polygons), voxel * 1000))
    return bas


def deplier(o, marge=0.004, cou=1.600, tete=1.6):
    """Les UV : la tete a part, et plus grande.

    Deplie d'un bloc, le corps prenait la texture et la tete — ce qu'on
    regarde — n'en recevait qu'une bande. On deplie donc la tete (au-dessus
    de `cou`) separement, on agrandit ses ilots de `tete` fois, puis on
    remballe le tout : l'emballage garde les tailles relatives, et le visage
    recoit 1,6 fois plus de pixels au centimetre que le reste (a 2,5, il
    prenait les deux tiers de la texture et le corps devenait flou).
    """
    activer(o)
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(o.data)
    haut = [f for f in bm.faces if f.calc_center_median().z > cou]
    for f in bm.faces:
        f.select_set(False)
    for f in haut:
        f.select_set(True)
    bmesh.update_edit_mesh(o.data)
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=marge,
                             area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.mesh.select_all(action='INVERT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=marge,
                             area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bm = bmesh.from_edit_mesh(o.data)
    uv = bm.loops.layers.uv.active
    for f in bm.faces:
        if f.calc_center_median().z > cou:
            for l in f.loops:
                l[uv].uv *= tete
    bmesh.update_edit_mesh(o.data)
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=marge)
    bpy.ops.object.mode_set(mode='OBJECT')


def image(nom, taille, donnees, alpha=False):
    im = bpy.data.images.new(nom, taille, taille, alpha=alpha, float_buffer=False)
    im.colorspace_settings.name = 'sRGB' if donnees == 'couleur' else 'Non-Color'
    return im


def cuire(bas, hauts, type_, im, marge_px=8, echantillons=1, **passe):
    """Cuire `type_` des objets hauts vers `bas`, dans l'image `im`."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = echantillons
    mat = bas.data.materials[0]
    nt = mat.node_tree
    for n in nt.nodes:
        n.select = False
    noeud = nt.nodes.new('ShaderNodeTexImage')
    noeud.image = im
    noeud.select = True
    nt.nodes.active = noeud
    activer(bas, *hauts)
    b = sc.render.bake
    b.use_selected_to_active = True
    # La peau de jeu s'ecarte de la peau d'origine la ou le remaillage et la
    # decimation ont arrondi (le haut des epaules, surtout) : a 1,2 cm de
    # portee, les rayons s'y perdaient et laissaient des taches noires.
    b.cage_extrusion = 0.02
    b.max_ray_distance = 0.06
    b.margin = marge_px
    b.target = 'IMAGE_TEXTURES'
    if type_ == 'DIFFUSE':
        b.use_pass_direct = False
        b.use_pass_indirect = False
        b.use_pass_color = True
    if type_ == 'NORMAL':
        b.normal_space = 'TANGENT'
    bpy.ops.object.bake(type=type_)
    nt.nodes.remove(noeud)
    print('cuit :', im.name)


def cuire_seul(o, type_, im, echantillons=1):
    """Cuire un objet sur lui-meme (les yeux : leur iris est procedural)."""
    sc = bpy.context.scene
    sc.cycles.samples = echantillons
    nt = o.data.materials[0].node_tree
    noeud = nt.nodes.new('ShaderNodeTexImage')
    noeud.image = im
    nt.nodes.active = noeud
    activer(o)
    b = sc.render.bake
    b.use_selected_to_active = False
    b.use_pass_direct = False
    b.use_pass_indirect = False
    b.use_pass_color = True
    bpy.ops.object.bake(type=type_)
    nt.nodes.remove(noeud)


def lissage_depuis_rugosite(rug, nom):
    """La carte MetallicSmoothness d'URP/HDRP : R = metallique, A = lissage.

    Unity range le lissage dans l'alpha de la carte metallique. Le lissage est
    le contraire de la rugosite de Blender : A = 1 - rugosite. Rien ici n'est
    du metal, R vaut 0.
    """
    t = rug.size[0]
    px = list(rug.pixels)
    out = [0.0] * (t * t * 4)
    for i in range(t * t):
        out[i * 4 + 3] = 1.0 - px[i * 4]
    im = bpy.data.images.new(nom, t, t, alpha=True)
    im.colorspace_settings.name = 'Non-Color'
    im.pixels = out
    return im


def materiau_pbr(nom, base, normale=None, rugosite=None):
    """Un Principled BSDF branche sur des images : ce que l'import FBX
    d'Unity sait relire (couleur, normales), et ce qu'on rebranche a la main
    sur un materiau URP/HDRP Lit (voir README.md)."""
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = base
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if normale is not None:
        tn = nt.nodes.new('ShaderNodeTexImage')
        tn.image = normale
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if rugosite is not None:
        tr = nt.nodes.new('ShaderNodeTexImage')
        tr.image = rugosite
        nt.links.new(tr.outputs['Color'], b.inputs['Roughness'])
    b.inputs['Metallic'].default_value = 0.0
    return m


# -----------------------------------------------------------------------
# 3. LE RIG RIGIFY
# -----------------------------------------------------------------------

# Ce que le modele n'a pas, et qu'on retire du metarig avant de generer.
A_RETIRER = ('face', 'breast', 'palm', 'thumb', 'f_index', 'f_middle', 'f_ring', 'f_pinky')


def metarig(H, A):
    """Le metarig humain de Rigify, cale sur les articulations du modele."""
    addon_utils.enable('rigify', default_set=True)
    bpy.ops.object.armature_human_metarig_add()
    mr = bpy.context.view_layer.objects.active
    mr.name = 'metarig'
    bpy.ops.object.mode_set(mode='EDIT')
    eb = mr.data.edit_bones
    # Tout ce qui descend de ce qu'on retire part avec.
    for b in list(eb):
        if b.name.split('.')[0] in A_RETIRER or any(p.name.split('.')[0] == 'face' for p in b.parent_recursive):
            eb.remove(b)

    def poser(nom, tete, queue):
        b = eb[nom]
        b.head = Vector(tete)
        b.tail = Vector(queue)

    # la colonne : bassin, lombaires, thorax, cou, tete
    Z = [0.965, 1.080, 1.200, 1.330, 1.555, 1.615, 1.675, 1.905]
    Y = [0.010, 0.000, -0.004, 0.000, 0.020, 0.018, 0.012, 0.004]
    for i, nom in enumerate(['spine', 'spine.001', 'spine.002', 'spine.003',
                             'spine.004', 'spine.005', 'spine.006']):
        poser(nom, (0, Y[i], Z[i]), (0, Y[i + 1], Z[i + 1]))
    for s, cote in ((1, 'L'), (-1, 'R')):
        a = A[s]
        e, c, w = a['epaule'], a['coude'], a['poignet']
        d = (w - c).normalized()
        poser('shoulder.' + cote, (s * 0.022, -0.008, 1.520), e + Vector((0, 0, 0.005)))
        poser('upper_arm.' + cote, e, c)
        poser('forearm.' + cote, c, w)
        poser('hand.' + cote, w, w + d * 0.17)
        g, k, ch = a['hanche'], a['genou'], a['cheville']
        poser('pelvis.' + cote, (0, 0.010, 0.965), (s * 0.120, -0.040, 1.070))
        poser('thigh.' + cote, g, k)
        poser('shin.' + cote, k, ch)
        pied = ch + Vector((s * 0.008, -0.105, -0.058))
        poser('foot.' + cote, ch, pied)
        poser('toe.' + cote, pied, pied + Vector((s * 0.004, -0.060, -0.002)))
        poser('heel.02.' + cote, ch + Vector((-s * 0.035, 0.050, -0.085)),
              ch + Vector((s * 0.035, 0.050, -0.085)))
    # LES ROLLS. Rigify en deduit le plan des chaines IK : le genou doit plier
    # vers l'avant, le coude vers l'arriere. On les recalcule sur les memes
    # reperes que le metarig d'origine.
    for b in eb:
        b.select = False
    for nom in ('upper_arm', 'forearm', 'hand'):
        for cote in 'LR':
            eb['%s.%s' % (nom, cote)].select = True
    bpy.ops.armature.calculate_roll(type='GLOBAL_POS_Y')
    for b in eb:
        b.select = False
    for nom in ('thigh', 'shin'):
        for cote in 'LR':
            eb['%s.%s' % (nom, cote)].select = True
    bpy.ops.armature.calculate_roll(type='GLOBAL_NEG_Y')
    bpy.ops.object.mode_set(mode='OBJECT')
    return mr


def generer(mr):
    activer(mr)
    bpy.ops.pose.rigify_generate()
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE' and o is not mr
               and o.name.startswith(('rig', 'RIG')))
    rig.name = 'Aurel_Rigify'
    return rig


# -----------------------------------------------------------------------
# 4. LE SQUELETTE DE JEU (Humanoid Mecanim)
# -----------------------------------------------------------------------

# os de jeu -> (os DEF de Rigify qu'il remplace, dans l'ordre de la chaine ;
# le premier donne la tete de l'os, le dernier sa queue ; les poids de tous
# y sont fusionnes), et son parent dans la hierarchie de jeu.
SQUELETTE = [
    ('Hips',          ['DEF-spine', 'DEF-pelvis.L', 'DEF-pelvis.R'], None),
    ('Spine',         ['DEF-spine.001'], 'Hips'),
    ('Chest',         ['DEF-spine.002'], 'Spine'),
    ('UpperChest',    ['DEF-spine.003'], 'Chest'),
    ('Neck',          ['DEF-spine.004', 'DEF-spine.005'], 'UpperChest'),
    ('Head',          ['DEF-spine.006'], 'Neck'),
]
for _c, _n in (('L', 'Left'), ('R', 'Right')):
    SQUELETTE += [
        (_n + 'Shoulder',  ['DEF-shoulder.' + _c], 'UpperChest'),
        (_n + 'UpperArm',  ['DEF-upper_arm.' + _c, 'DEF-upper_arm.%s.001' % _c], _n + 'Shoulder'),
        (_n + 'LowerArm',  ['DEF-forearm.' + _c, 'DEF-forearm.%s.001' % _c], _n + 'UpperArm'),
        (_n + 'Hand',      ['DEF-hand.' + _c], _n + 'LowerArm'),
        (_n + 'UpperLeg',  ['DEF-thigh.' + _c, 'DEF-thigh.%s.001' % _c], 'Hips'),
        (_n + 'LowerLeg',  ['DEF-shin.' + _c, 'DEF-shin.%s.001' % _c], _n + 'UpperLeg'),
        (_n + 'Foot',      ['DEF-foot.' + _c], _n + 'LowerLeg'),
        (_n + 'Toes',      ['DEF-toe.' + _c], _n + 'Foot'),
    ]


def squelette_de_jeu(rig):
    """L'armature Humanoid, construite sur les seuls os DEF du rig Rigify."""
    rest = {b.name: (b.head_local.copy(), b.tail_local.copy(), b) for b in rig.data.bones}
    arm = bpy.data.armatures.new('Aurel_Armature')
    jeu = bpy.data.objects.new('Aurel', arm)
    bpy.context.collection.objects.link(jeu)
    activer(jeu)
    bpy.ops.object.mode_set(mode='EDIT')
    # les rolls, lus sur les os DEF en mode edition du rig Rigify
    activer(rig)
    bpy.ops.object.mode_set(mode='EDIT')
    rolls = {b.name: b.roll for b in rig.data.edit_bones}
    bpy.ops.object.mode_set(mode='OBJECT')
    activer(jeu)
    bpy.ops.object.mode_set(mode='EDIT')
    manque = []
    for nom, sources, parent in SQUELETTE:
        presentes = [s for s in sources if s in rest]
        if not presentes:
            manque.append(nom)
            continue
        chaine = [s for s in sources if s in rest and not s.startswith('DEF-pelvis')]
        b = arm.edit_bones.new(nom)
        b.head = rest[chaine[0]][0]
        b.tail = rest[chaine[-1]][1]
        b.roll = rolls[chaine[0]]
        b.use_deform = True
        if parent:
            b.parent = arm.edit_bones[parent]
            b.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    if manque:
        raise RuntimeError('os DEF introuvables pour : %s' % ', '.join(manque))
    # CHAQUE OS DE JEU COPIE SON OS DEF : on anime le rig Rigify, le squelette
    # de jeu suit, et l'export cuit ce mouvement-la.
    for nom, sources, _p in SQUELETTE:
        pb = jeu.pose.bones[nom]
        c = pb.constraints.new('COPY_TRANSFORMS')
        c.target = rig
        c.subtarget = sources[0]
    return jeu


def reponderer(corps, jeu):
    """Les poids DEF-* du maillage, renommes et fusionnes vers les os de jeu."""
    vg = corps.vertex_groups
    cible = {}
    for nom, sources, _p in SQUELETTE:
        for s in sources:
            cible[s] = nom
    nouveaux = {nom: vg.new(name='__' + nom) for nom, _s, _p in SQUELETTE}
    index = {g.index: g.name for g in vg}
    for v in corps.data.vertices:
        somme = {}
        for g in v.groups:
            nomg = index.get(g.group, '')
            if nomg in cible:
                somme[cible[nomg]] = somme.get(cible[nomg], 0.0) + g.weight
        for nom, w in somme.items():
            nouveaux[nom].add([v.index], min(1.0, w), 'REPLACE')
    for g in list(vg):
        if not g.name.startswith('__'):
            vg.remove(g)
    for g in vg:
        g.name = g.name[2:]
    for m in list(corps.modifiers):
        if m.type == 'ARMATURE':
            corps.modifiers.remove(m)
    mod = corps.modifiers.new('Armature', 'ARMATURE')
    mod.object = jeu
    corps.parent = jeu
    corps.matrix_parent_inverse = jeu.matrix_world.inverted()


def rigide(o, os_nom):
    """Un morceau qui ne se deforme pas : tout son poids sur un seul os."""
    g = o.vertex_groups.new(name=os_nom)
    g.add([v.index for v in o.data.vertices], 1.0, 'REPLACE')


# -----------------------------------------------------------------------
# L'EXPORT
# -----------------------------------------------------------------------

def exporter(jeu, maillages, chemin, animation=False):
    """Le FBX pour Unity : maillage + armature de jeu, et rien d'autre.

    APPLIQUER LES TRANSFORMATIONS, POUR DE BON. La case « Apply Transform »
    de l'exporteur (bake_space_transform) cuit la conversion d'axes dans les
    MAILLAGES, pas dans les ARMATURES : relu octet par octet, le FBX portait
    alors -90 degres en X sur la racine de l'armature — Unity l'aurait
    affichee couchee, corrigee par un objet parent. Avec la case ET la
    correction ci-dessous, c'etait le maillage qui heritait de +90.

    On fait donc ce que la case promet, a la main, pour l'armature et son
    maillage ensemble : tourner de -90 en X et APPLIQUER (les os et les
    sommets sont maintenant exprimes dans le repere d'Unity), puis rendre +90
    en rotation d'objet, que la conversion d'axes de l'export (Y vers le
    haut, -Z vers l'avant) annule exactement. Resultat, verifie dans le
    fichier par aurel_unity_verifier.py : rotation (0, 0, 0) et echelle 1 sur
    la racine comme sur le maillage, la hauteur sur Y, le regard vers +Z
    d'Unity.
    """
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    activer(jeu, *maillages)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    jeu.rotation_euler = (-math.pi / 2, 0, 0)
    activer(jeu, *maillages)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    jeu.rotation_euler = (math.pi / 2, 0, 0)
    activer(jeu, *maillages)
    bpy.ops.export_scene.fbx(
        filepath=chemin,
        use_selection=True,
        object_types={'ARMATURE', 'MESH'},    # ni camera, ni lumiere
        apply_unit_scale=True,
        apply_scale_options='FBX_SCALE_ALL',  # echelle 1 dans Unity
        axis_forward='-Z', axis_up='Y',       # le repere d'Unity
        bake_space_transform=False,           # voir plus haut : fait a la main
        use_mesh_modifiers=False,             # l'armature reste un skin
        mesh_smooth_type='FACE',
        use_tspace=True,
        add_leaf_bones=False,
        use_armature_deform_only=True,        # les os de deformation seuls
        primary_bone_axis='Y', secondary_bone_axis='X',
        armature_nodetype='NULL',
        bake_anim=animation,
        # une seule prise : la ligne de temps de la scene, lue a travers les
        # contraintes. « Toutes les actions » aurait essaye de poser sur le
        # squelette de jeu des actions ecrites pour le rig Rigify.
        bake_anim_use_all_actions=False,
        bake_anim_use_nla_strips=False,
        bake_anim_force_startend_keying=True,
        bake_anim_simplify_factor=0.0,
        path_mode='RELATIVE', embed_textures=False)
    # et on remet le fichier de travail droit, pour qu'on continue d'y animer :
    # appliquer les +90 rend aux os et aux sommets leur repere d'origine
    activer(jeu, *maillages)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    print('exporte :', chemin)


# -----------------------------------------------------------------------

def exporter_animation(blend, clip):
    """L'animation du fichier de travail, pour Unity."""
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(blend))
    jeu = bpy.data.objects['Aurel']
    corps = bpy.data.objects['Aurel_Body']
    dossier = os.path.join(os.path.dirname(os.path.abspath(blend)), 'Animations')
    os.makedirs(dossier, exist_ok=True)
    exporter(jeu, [corps], os.path.join(dossier, 'Aurel_%s.fbx' % clip), animation=True)


def main():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if '--animation' in a:
        clip = a[a.index('--clip') + 1] if '--clip' in a else 'Clip'
        return exporter_animation(a[a.index('--animation') + 1], clip)
    o = args()
    sortie = os.path.abspath(o['sortie'])
    tex = os.path.join(sortie, 'Textures')
    os.makedirs(tex, exist_ok=True)
    t = 512 if o['rapide'] else o['texture']

    # 1. le modele, en A
    PV.vider()
    H, A, obj = PV.construire(pose='A')
    hauts = [obj['corps']] + obj['jambes'] + [obj['tete']]

    # 2. le maillage de jeu, ses UV, ses textures
    corps = maillage_de_jeu(hauts, 9000 if o['rapide'] else 36000,
                            0.008 if o['rapide'] else 0.0045)
    deplier(corps)
    corps.data.materials.append(bpy.data.materials.new('cuisson'))
    corps.data.materials[0].use_nodes = True
    base = image('Aurel_Body_BaseMap', t, 'couleur')
    norm = image('Aurel_Body_Normal', t, 'donnees')
    rug = image('Aurel_Body_Roughness', t, 'donnees')
    cuire(corps, hauts, 'DIFFUSE', base)
    cuire(corps, hauts, 'NORMAL', norm)
    cuire(corps, hauts, 'ROUGHNESS', rug)
    lisse = lissage_depuis_rugosite(rug, 'Aurel_Body_MetallicSmoothness')
    for im in (base, norm, lisse):
        im.filepath_raw = os.path.join(tex, im.name + '.png')
        im.file_format = 'PNG'
        im.save()
    corps.data.materials.clear()
    corps.data.materials.append(materiau_pbr('M_Aurel_Body', base, norm, rug))

    yeux_im = image('Aurel_Eyes_BaseMap', 256, 'couleur')
    for oe in obj['yeux']:
        cuire_seul(oe, 'DIFFUSE', yeux_im)
    yeux_im.filepath_raw = os.path.join(tex, yeux_im.name + '.png')
    yeux_im.file_format = 'PNG'
    yeux_im.save()
    m_yeux = materiau_pbr('M_Aurel_Eyes', yeux_im)
    for oe in obj['yeux']:
        oe.data.materials.clear()
        oe.data.materials.append(m_yeux)
    m_eponge = bpy.data.materials.new('M_Aurel_Terry')
    m_eponge.use_nodes = True
    bs = next(n for n in m_eponge.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value = PV.lin((246, 246, 244))
    bs.inputs['Roughness'].default_value = 0.95
    # Le bandeau et le poignet : un budget de jeu, pas celui d'un portrait.
    for a in (obj['bandeau'], obj['poignet']):
        a.modifiers['arrondi'].levels = 1
        activer(a)
        bpy.ops.object.convert(target='MESH')    # epaisseur et arrondi appliques
        a.data.materials.clear()
        a.data.materials.append(m_eponge)

    # le haut-poly n'a plus rien a donner
    for h in hauts:
        bpy.data.objects.remove(h, do_unlink=True)

    # 3. le rig Rigify, et les poids sur ses os DEF
    mr = metarig(H, A)
    rig = generer(mr)
    activer(rig, corps)
    corps.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for oe in obj['yeux']:
        rigide(oe, 'DEF-spine.006')
    rigide(obj['bandeau'], 'DEF-spine.006')
    rigide(obj['poignet'], 'DEF-forearm.L.001')
    # une seule peau pour Unity : un SkinnedMeshRenderer, trois materiaux
    activer(corps, *obj['yeux'], obj['bandeau'], obj['poignet'])
    bpy.ops.object.join()
    corps = bpy.context.view_layer.objects.active
    corps.name = 'Aurel_Body'

    # 4. le squelette de jeu, les poids renommes, l'export
    jeu = squelette_de_jeu(rig)
    reponderer(corps, jeu)
    mr.hide_set(True)
    exporter(jeu, [corps], os.path.join(sortie, 'Aurel_Manga.fbx'))

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(sortie, 'Aurel_Manga.blend'),
                                relative_remap=True)
    print('termine :', sortie)


if __name__ == '__main__':
    main()
