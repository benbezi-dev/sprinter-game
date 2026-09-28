# -----------------------------------------------------------------------
# AUREL MANGA POUR UNITY — le FBX, relu comme Unity le lira.
#
#   blender -b -P tools/blender/aurel_unity_verifier.py -- \
#           --fbx unity/AurelManga/Aurel_Manga.fbx [--images DOSSIER]
#
# On ne fait pas confiance a l'export : on RELIT le fichier dans une scene
# vide, et on verifie ce qu'un avatar Humanoid d'Unity exige.
#
#   - rien d'autre qu'une armature et des maillages (ni camera, ni lumiere) ;
#   - les os obligatoires de l'avatar Humanoid, sous ces noms, dans la bonne
#     hierarchie (Hips a la racine, Spine sous Hips, les bras sous les
#     epaules, les jambes sous Hips) — et AUCUN os de controle Rigify ;
#   - chaque sommet est pondere, et seulement sur des os du squelette ;
#   - les transformations sont appliquees (echelle 1, pas de rotation) ;
#   - le personnage se tient debout, tete en haut, et fait 1,90 m.
#
# Avec --images, il pose aussi le personnage (bras leves, genou monte) et le
# rend de face : c'est la que se voit un poids mal pose.
# -----------------------------------------------------------------------

import bpy
import math
import os
import sys
from mathutils import Euler

a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
FBX = a[a.index('--fbx') + 1]
IMAGES = a[a.index('--images') + 1] if '--images' in a else None

OBLIGATOIRES = ['Hips', 'Spine', 'Head',
                'LeftUpperArm', 'LeftLowerArm', 'LeftHand',
                'RightUpperArm', 'RightLowerArm', 'RightHand',
                'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot',
                'RightUpperLeg', 'RightLowerLeg', 'RightFoot']
PARENTS = {'Spine': 'Hips', 'Chest': 'Spine', 'UpperChest': 'Chest', 'Neck': 'UpperChest',
           'Head': 'Neck', 'LeftShoulder': 'UpperChest', 'LeftUpperArm': 'LeftShoulder',
           'LeftLowerArm': 'LeftUpperArm', 'LeftHand': 'LeftLowerArm',
           'LeftUpperLeg': 'Hips', 'LeftLowerLeg': 'LeftUpperLeg', 'LeftFoot': 'LeftLowerLeg',
           'LeftToes': 'LeftFoot'}
PARENTS.update({k.replace('Left', 'Right'): v.replace('Left', 'Right') for k, v in PARENTS.items()})

echecs = 0


def noeuds_fbx(chemin):
    """Les noeuds Model du FBX binaire, lus sans Blender : nom, type, et
    leurs transformations locales telles qu'Unity les lira."""
    import struct
    data = open(chemin, 'rb').read()
    ver = struct.unpack('<I', data[23:27])[0]

    def lire(off):
        if ver >= 7500:
            end, nprops, _ = struct.unpack('<QQQ', data[off:off + 24]); off += 24
        else:
            end, nprops, _ = struct.unpack('<III', data[off:off + 12]); off += 12
        nl = data[off]; name = data[off + 1:off + 1 + nl].decode(); off += 1 + nl
        props, p = [], off
        tailles = {'D': ('<d', 8), 'I': ('<i', 4), 'L': ('<q', 8), 'F': ('<f', 4), 'Y': ('<h', 2)}
        for _ in range(nprops):
            t = chr(data[p]); p += 1
            if t in 'SR':
                n = struct.unpack('<I', data[p:p + 4])[0]; props.append(data[p + 4:p + 4 + n]); p += 4 + n
            elif t in tailles:
                f, n = tailles[t]; props.append(struct.unpack(f, data[p:p + n])[0]); p += n
            elif t == 'C':
                props.append(data[p]); p += 1
            else:
                _n, _e, cl = struct.unpack('<III', data[p:p + 12]); p += 12 + cl; props.append(None)
        off, enfants = p, []
        nul = 25 if ver >= 7500 else 13
        while off < end - nul:
            c, off = lire(off); enfants.append(c)
        return (name, props, enfants), end

    off, out = 27, []
    while off < len(data) - 200:
        n, off2 = lire(off)
        if not n[0]:
            break
        off = off2
        if n[0] != 'Objects':
            continue
        for c in n[2]:
            if c[0] != 'Model':
                continue
            nom = c[1][1].split(b'\x00')[0].decode()
            pr = {}
            for p70 in c[2]:
                if p70[0] == 'Properties70':
                    for P in p70[2]:
                        k = P[1][0].decode()
                        if k in ('Lcl Rotation', 'Lcl Scaling', 'PreRotation'):
                            pr[k] = tuple(P[1][4:7])
            out.append((nom, c[1][2].decode(), pr))
    return out


def ok(nom, cond, detail=''):
    global echecs
    print('   %s %s%s' % ('✓' if cond else '✗', nom, '' if cond or not detail else ' — ' + detail))
    if not cond:
        echecs += 1


for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.fbx(filepath=FBX, automatic_bone_orientation=False)
objs = list(bpy.data.objects)
types = sorted({o.type for o in objs})
arms = [o for o in objs if o.type == 'ARMATURE']
meshes = [o for o in objs if o.type == 'MESH']

print('\n── CE QUE LE FICHIER CONTIENT')
ok('une armature et des maillages, rien d autre', types == ['ARMATURE', 'MESH'], str(types))
ok('une seule armature', len(arms) == 1, str(len(arms)))
arm = arms[0]
os_ = {b.name: b for b in arm.data.bones}
print('   os :', len(os_), '·', ', '.join(sorted(os_)))

print('\n── LE SQUELETTE HUMANOID')
manque = [n for n in OBLIGATOIRES if n not in os_]
ok('les os obligatoires de l avatar Humanoid', not manque, ', '.join(manque))
controle = [n for n in os_ if n.startswith(('DEF-', 'ORG-', 'MCH-', 'root')) or '_fk' in n or '_ik' in n]
ok('aucun os de controle Rigify', not controle, ', '.join(controle[:8]))
racines = [b.name for b in arm.data.bones if b.parent is None]
ok('Hips est la seule racine', racines == ['Hips'], str(racines))
faux = [n for n, p in PARENTS.items() if n in os_ and (os_[n].parent is None or os_[n].parent.name != p)]
ok('la hierarchie est celle de l avatar', not faux,
   ', '.join('%s<-%s' % (n, os_[n].parent.name if os_[n].parent else None) for n in faux))

print('\n── LES TRANSFORMATIONS, LUES DANS LE FICHIER (ce qu Unity recevra)')
for nom, typ, pr in noeuds_fbx(FBX):
    if typ not in ('Null', 'Mesh'):
        continue
    rot = pr.get('Lcl Rotation', (0, 0, 0))
    ech = pr.get('Lcl Scaling', (1, 1, 1))
    ok('%s (%s) : rotation 0, echelle 1' % (nom, typ),
       all(abs(r) < 1e-3 for r in rot) and all(abs(e - 1) < 1e-3 for e in ech)
       and 'PreRotation' not in pr,
       'rotation %s echelle %s' % (tuple(round(r, 2) for r in rot), tuple(round(e, 3) for e in ech)))
tete = (arm.matrix_world @ os_['Head'].head_local)
hanches = (arm.matrix_world @ os_['Hips'].head_local)
ok('debout : la tete au-dessus des hanches (z)', tete.z > hanches.z + 0.5, '%s / %s' % (tete, hanches))
zs = [(m.matrix_world @ v.co).z for m in meshes for v in m.data.vertices]
haut = max(zs) - min(zs)
ok('1,90 m de haut', 1.85 < haut < 1.95, '%.3f m' % haut)

print('\n── LA PEAU')
for m in meshes:
    noms = {g.index: g.name for g in m.vertex_groups}
    sans = 0
    hors = set()
    for v in m.data.vertices:
        w = [(noms[g.group], g.weight) for g in v.groups if g.weight > 1e-4]
        if not w:
            sans += 1
        for n, _ in w:
            if n not in os_:
                hors.add(n)
    ok('%s : chaque sommet est pondere' % m.name, sans == 0, '%d sommets sans poids' % sans)
    ok('%s : seulement sur des os du squelette' % m.name, not hors, ', '.join(sorted(hors)))
    tri = sum(len(p.vertices) - 2 for p in m.data.polygons)
    print('   %s : %d sommets, %d triangles, materiaux %s' % (
        m.name, len(m.data.vertices), tri, [s.material.name for s in m.material_slots if s.material]))
    ok('%s : des UV' % m.name, len(m.data.uv_layers) > 0)
    ok('%s : skinne sur l armature' % m.name,
       any(md.type == 'ARMATURE' and md.object == arm for md in m.modifiers) or m.parent == arm)

if IMAGES:
    os.makedirs(IMAGES, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 16
    sc.cycles.use_denoising = True
    monde = bpy.data.worlds.new('fond')
    sc.world = monde
    monde.use_nodes = True
    monde.node_tree.nodes['Background'].inputs[1].default_value = 1.2
    soleil = bpy.data.objects.new('soleil', bpy.data.lights.new('soleil', 'SUN'))
    soleil.rotation_euler = Euler((math.radians(50), 0, math.radians(-30)))
    bpy.context.collection.objects.link(soleil)
    sc.render.resolution_x, sc.render.resolution_y = 700, 900
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    bpy.context.collection.objects.link(cam)
    cam.data.lens = 50
    cam.location = (0, -5.2, 1.0)
    cam.rotation_euler = Euler((math.radians(90), 0, 0))
    sc.camera = cam
    sc.render.filepath = os.path.join(IMAGES, 'repos.png')
    bpy.ops.render.render(write_still=True)
    pb = arm.pose.bones
    arm.rotation_mode = 'XYZ'
    for n, rot in (('LeftUpperArm', (0, 0, -1.0)), ('RightUpperArm', (0, 0, 1.0)),
                   ('LeftLowerArm', (0, 0, -0.9)), ('LeftUpperLeg', (-1.2, 0, 0)),
                   ('LeftLowerLeg', (1.5, 0, 0)), ('Spine', (0.2, 0, 0)), ('Head', (0, 0.4, 0))):
        if n in pb:
            pb[n].rotation_mode = 'XYZ'
            pb[n].rotation_euler = rot
    sc.render.filepath = os.path.join(IMAGES, 'pose.png')
    bpy.ops.render.render(write_still=True)
    print('   images :', IMAGES)

print('\n' + ('TOUT PASSE.' if not echecs else '%d ECHEC(S).' % echecs))
sys.exit(1 if echecs else 0)
