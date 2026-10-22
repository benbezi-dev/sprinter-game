# -----------------------------------------------------------------------
# SPRINTER — le public de la course 3D, en cartes.
#
#   Blender -b --factory-startup -P tools/blender/public_cartes.py
#
# QUINZE MILLE SPECTATEURS NE SE MODELISENT PAS. Un corps humain fait douze
# mille faces ; meme le spectateur en batons de tribune.py en fait deux mille
# cent : trente millions de triangles, aucun telephone. La course 3D pose donc
# des CARTES — deux triangles par spectateur —, comme les jeux de sport.
#
# LES CARTES VIENNENT DE VRAIS CORPS : les « Universal Base Characters » de
# Quaternius (CC0, assets-sources/), homme et femme, trois coiffures chacun,
# assis sur le siege de tribune.py, en trois gestes (assis, qui applaudit,
# debout les bras leves), sous cinq angles de part et d'autre de leur face
# (-60 a +60 degres) : le jeu tourne chaque carte vers la camera et prend
# l'angle le plus proche.
#
# LES COULEURS SONT POSEES PAR LE JEU, comme pour tribune.js. Chaque case
# porte, en une seule image :
#   R  la passe (base, peau, maillot, siege, cheveux, pantalon) : 0, 32, 64...
#   G  la lumiere, rendue en blanc sous un eclairage de studio
#   A  la silhouette
# Deux rendus Workbench sans lissage des bords (une passe melangee au bord
# donnerait une couleur qui n'existe pas), fondus par numpy. Les passes se
# lisent sur les os : chaque face prend celle de l'os qui la porte le plus
# (le buste et le haut des bras font le maillot, le bassin et les jambes le
# pantalon, les pieds les chaussures).
#
# Sortie : public/modeles/stades/public-cartes.png et public-cartes.json.
# -----------------------------------------------------------------------
import bpy
import json
import math
import os
import sys

import numpy as np
from mathutils import Matrix, Vector

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ICI, 'decors'))
import tribune

RACINE = os.path.abspath(os.path.join(ICI, '..', '..'))
SORTIE = os.path.join(RACINE, 'public', 'modeles', 'stades')
Q = os.path.join(os.path.dirname(RACINE), 'assets-sources', 'quaternius-base-characters',
                 'Universal Base Characters[Standard]')
CORPS = os.path.join(Q, 'Base Characters', 'Godot - UE', 'Superhero_%s_FullBody.gltf')
CHEVEUX = os.path.join(Q, 'Hairstyles', 'Origin at 0', 'glTF (Godot)', 'Hair_%s.gltf')
SILHOUETTES = [('Male', ['SimpleParted']), ('Male', ['Buzzed', 'Beard']), ('Male', ['Buzzed']),
               ('Female', ['Long']), ('Female', ['Buns']), ('Female', ['BuzzedFemale'])]
# pied : debout, bras le long du corps, sans siege (officiels) ; photo : un genou a terre,
# l'appareil a l'oeil (« les photographes n'ont pas d'attitude de photographe », 22/10).
# Pas plus de cinq : a six, l'atlas passerait 4 096 pixels de large, la limite des
# textures sur les telephones les plus faibles.
GESTES = ['assis', 'applaudit', 'debout', 'pied', 'photo']
ANGLES = [-60, -30, 0, 30, 60]
CW, CH = 128, 256                  # une case, en pixels
LARG, HAUT = 1.1, 2.2              # ce qu'elle couvre, en metres (le siege au bas, au milieu)
ELEVATION = 6.0                    # la camera, un rien au-dessus
PASSES = list(tribune.CATEGORIES)  # base, peau, maillot, siege, cheveux, pantalon
ASSISE = 0.45                      # la hauteur de l'assise du siege (tribune.siege)

PASSE_DE_L_OS = {}
for os_, p in (('spine', 'maillot'), ('clavicle', 'maillot'), ('upperarm', 'maillot'),
               ('neck', 'peau'), ('Head', 'peau'), ('lowerarm', 'peau'), ('hand', 'peau'),
               ('index', 'peau'), ('middle', 'peau'), ('pinky', 'peau'), ('ring', 'peau'),
               ('thumb', 'peau'), ('pelvis', 'pantalon'), ('thigh', 'pantalon'),
               ('calf', 'pantalon'), ('foot', 'base'), ('ball', 'base'), ('root', 'pantalon')):
    PASSE_DE_L_OS[os_] = p


def passe_de(nom_os):
    for k, p in PASSE_DE_L_OS.items():
        if nom_os.startswith(k):
            return p
    return 'maillot'


def scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.resolution_x, sc.render.resolution_y = CW, CH
    sc.render.film_transparent = True
    sc.display.render_aa = 'OFF'
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    return sc


def camera(sc):
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = HAUT
    sc.collection.objects.link(cam)
    sc.camera = cam
    return cam


def viser(cam, angle):
    """La camera face au spectateur (il regarde -Y), tournee de `angle` autour de lui."""
    a, e = math.radians(angle), math.radians(ELEVATION)
    d = 20.0
    cible = Vector((0.0, 0.0, HAUT / 2))
    cam.location = (d * math.sin(a) * math.cos(e), -d * math.cos(a) * math.cos(e), cible.z + d * math.sin(e))
    cam.rotation_euler = (cible - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()


def importer(chemin):
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=chemin)
    return [o for o in bpy.data.objects if o not in avant]


def viser_os(rig, nom, direction):
    """Tourne l'os pour que sa direction (tete -> queue) suive `direction`, dans le repere du rig."""
    pb = rig.pose.bones[nom]
    bpy.context.view_layer.update()
    m = pb.matrix.copy()
    cur = (m @ Vector((0, 1, 0, 0))).to_3d().normalized()
    q = cur.rotation_difference(Vector(direction).normalized())
    tete = m.to_translation()
    pb.matrix = Matrix.Translation(tete) @ q.to_matrix().to_4x4() @ Matrix.Translation(-tete) @ m
    bpy.context.view_layer.update()


def poser(rig, geste):
    """Il regarde -Y. Assis : cuisses vers l'avant, tibias vers le bas."""
    if geste == 'photo':
        # un genou a terre : la jambe gauche devant, le genou droit au sol, le pied derriere
        viser_os(rig, 'thigh_l', (0, -1, -0.15))
        viser_os(rig, 'calf_l', (0, -0.05, -1))
        viser_os(rig, 'foot_l', (0, -1, -0.3))
        viser_os(rig, 'thigh_r', (0, -0.25, -1))
        viser_os(rig, 'calf_r', (0, 1, -0.08))
        viser_os(rig, 'foot_r', (0, 1, 0.3))
    elif geste not in ('debout', 'pied'):
        for c in ('l', 'r'):
            viser_os(rig, 'thigh_' + c, (0, -1, -0.08))
            viser_os(rig, 'calf_' + c, (0, -0.12, -1))
            viser_os(rig, 'foot_' + c, (0, -1, -0.55))
    for c, s in (('l', 1), ('r', -1)):
        # le cote gauche du personnage est a +X quand il regarde -Y
        if geste == 'assis':
            viser_os(rig, 'upperarm_' + c, (s * 0.18, -0.35, -1))
            viser_os(rig, 'lowerarm_' + c, (s * 0.05, -1, -0.25))
        elif geste == 'applaudit':
            viser_os(rig, 'upperarm_' + c, (s * 0.35, -0.75, -0.55))
            viser_os(rig, 'lowerarm_' + c, (-s * 0.55, -0.55, 0.55))
        elif geste == 'photo':
            # les coudes ecartes, les mains devant le visage : elles tiennent l'appareil
            viser_os(rig, 'upperarm_' + c, (s * 0.45, -0.55, -0.35))
            viser_os(rig, 'lowerarm_' + c, (-s * 0.35, -0.85, 0.4))
        elif geste == 'pied':
            viser_os(rig, 'upperarm_' + c, (s * 0.16, 0.02, -1))
            viser_os(rig, 'lowerarm_' + c, (s * 0.05, -0.12, -1))
        else:
            viser_os(rig, 'upperarm_' + c, (s * 0.35, -0.12, 1))
            viser_os(rig, 'lowerarm_' + c, (s * 0.2, -0.1, 1))
        viser_os(rig, 'hand_' + c, (rig.pose.bones['lowerarm_' + c].matrix @ Vector((0, 1, 0, 0))).to_3d())


def zoner(corps, mats):
    """Chaque face prend la passe de l'os qui la porte le plus."""
    groupes = {g.index: g.name for g in corps.vertex_groups}
    me = corps.data
    meilleur = []
    for v in me.vertices:
        g = max(v.groups, key=lambda x: x.weight, default=None)
        meilleur.append(passe_de(groupes[g.group]) if g else 'maillot')
    me.materials.clear()
    for p in PASSES:
        me.materials.append(mats[p])
    for f in me.polygons:
        compte = {}
        for vi in f.vertices:
            compte[meilleur[vi]] = compte.get(meilleur[vi], 0) + 1
        f.material_index = PASSES.index(max(compte, key=compte.get))


def personne(silhouette, geste, mats):
    """Un corps pose, coiffe et zone, assis sur son siege a l'origine."""
    sexe, coiffures = silhouette
    objs = importer(CORPS % sexe)
    rig = next(o for o in objs if o.type == 'ARMATURE')
    for o in objs:
        if o.type == 'MESH' and o.name.startswith('Icosphere'):   # une sphere de reperage du paquet
            bpy.data.objects.remove(o)
    for nom in coiffures:
        for h in importer(CHEVEUX % nom):
            if h.type != 'MESH':
                continue
            mw = h.matrix_world.copy()
            h.parent, h.parent_type, h.parent_bone = rig, 'BONE', 'Head'
            bpy.context.view_layer.update()
            h.matrix_world = mw
            h.data.materials.clear()
            h.data.materials.append(mats['cheveux'])
    poser(rig, geste)
    for o in list(rig.children):
        if o.type != 'MESH' or o.parent_type == 'BONE':
            continue
        if o.name.startswith('Eye'):
            o.data.materials.clear()
            o.data.materials.append(mats['cheveux' if o.name.startswith('Eyebrow') else 'base'])
        elif o.vertex_groups:
            zoner(o, mats)
    # assis, le bassin se pose sur l'assise ; debout, les pieds au sol
    bpy.context.view_layer.update()
    pelvis = rig.matrix_world @ rig.pose.bones['pelvis'].head
    if geste in ('debout', 'pied'):
        rig.location.z -= min((rig.matrix_world @ rig.pose.bones['ball_' + c].head).z for c in 'lr') - 0.03
        rig.location.y += -0.18 - pelvis.y
    elif geste == 'photo':
        # le genou droit et le pied gauche au sol
        bas = min((rig.matrix_world @ rig.pose.bones['calf_r'].head).z, (rig.matrix_world @ rig.pose.bones['ball_l'].head).z)
        rig.location.z -= bas - 0.06
        rig.location.y -= pelvis.y
    else:
        rig.location.z += ASSISE + 0.10 - pelvis.z
        rig.location.y += 0.02 - pelvis.y
    rig.location.x -= pelvis.x
    if geste == 'photo':
        appareil(rig, mats)


def appareil(rig, mats):
    """Le boitier et son teleobjectif, devant l'oeil, pointes droit devant (-Y)."""
    bpy.context.view_layer.update()
    t = rig.matrix_world @ rig.pose.bones['Head'].head
    z = t.z + 0.09
    bpy.ops.mesh.primitive_cube_add(location=(t.x, t.y - 0.16, z))
    b = bpy.context.active_object
    b.scale = (0.075, 0.05, 0.055)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.048, depth=0.34, vertices=16,
                                        location=(t.x, t.y - 0.36, z + 0.005), rotation=(math.pi / 2, 0, 0))
    o = bpy.context.active_object
    for m in (b, o):
        m.data.materials.append(mats['base'])


def materiaux():
    mats = {}
    for i, p in enumerate(PASSES):
        m = bpy.data.materials.new(p)
        m.diffuse_color = (i * 32 / 255.0, i * 32 / 255.0, i * 32 / 255.0, 1.0)
        mats[p] = m
    return mats


def rendre(sc, chemin):
    sc.render.filepath = chemin
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(chemin)
    px = np.array(im.pixels[:]).reshape(CH, CW, 4)[::-1]
    bpy.data.images.remove(im)
    return px


def main():
    sc = scene()
    tmp = os.path.join(SORTIE, '_tmp.png')
    os.makedirs(SORTIE, exist_ok=True)
    variantes = [(s, g) for s in SILHOUETTES for g in GESTES]
    atlas = np.zeros((len(ANGLES) * CH, len(variantes) * CW, 4), dtype=np.uint8)
    # la passe relue en sRGB (vue « Standard ») : par la plus proche
    lin = np.array([i * 32 / 255.0 for i in range(len(PASSES))])
    enc = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)
    for vi, (s, g) in enumerate(variantes):
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o)
        for m in list(bpy.data.materials):
            bpy.data.materials.remove(m)
        mats = materiaux()
        cam = camera(sc)
        e = bpy.data.objects.new('siege', None)
        sc.collection.objects.link(e)
        if g not in ('pied', 'photo'):
            tribune.siege(e, releve=(g == 'debout'))
        for o in e.children:
            o.data.materials.append(mats['siege'])
        personne(s, g, mats)
        for ai, angle in enumerate(ANGLES):
            viser(cam, angle)
            sc.display.shading.light = 'FLAT'
            sc.display.shading.color_type = 'MATERIAL'
            zone = rendre(sc, tmp)
            sc.display.shading.light = 'STUDIO'
            sc.display.shading.color_type = 'SINGLE'
            sc.display.shading.single_color = (1.0, 1.0, 1.0)
            lum = rendre(sc, tmp)
            case = np.zeros((CH, CW, 4), dtype=np.uint8)
            idx = np.abs(zone[..., 0:1] - enc[None, None, :]).argmin(axis=2)
            case[..., 0] = idx * 32
            case[..., 1] = np.clip(np.round(lum[..., 0] * 255), 0, 255)
            case[..., 3] = np.where(zone[..., 3] > 0.5, 255, 0)
            atlas[ai * CH:(ai + 1) * CH, vi * CW:(vi + 1) * CW] = case
        print('CARTE', s, g)
    os.remove(tmp)
    img = bpy.data.images.new('atlas', atlas.shape[1], atlas.shape[0], alpha=True)
    img.pixels[:] = (atlas[::-1].astype(np.float32) / 255.0).ravel()
    img.filepath_raw = os.path.join(SORTIE, 'public-cartes.png')
    img.file_format = 'PNG'
    img.save()
    with open(os.path.join(SORTIE, 'public-cartes.json'), 'w') as f:
        json.dump(dict(silhouettes=len(SILHOUETTES), gestes=GESTES, angles=ANGLES, case=[CW, CH],
                       metres=[LARG, HAUT], passes=PASSES), f, indent=1)
    print('ECRIT public-cartes.png', atlas.shape)


main()
