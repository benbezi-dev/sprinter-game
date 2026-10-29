# -----------------------------------------------------------------------
# SPRINTER — LE CORPS REALISTE, MIS EN CROIX POUR LA CHAINE DU COUREUR (28/10/2026).
#
#   Blender -b <assets-sources/blender-studio-human-base-meshes/homme-realiste-rigge.blend> \
#       -P tools/blender/corps_realiste_T.py -- <sortie.glb> [faces]
#
# L'auteur, 28/10 : « des assets mieux travailles, ca reste faible en niveau » -> le corps realiste des Human
# Base Meshes de Blender Studio (CC0), rigge par rigger_corps.py, remplace le corps Quaternius. La chaine du
# coureur (coureur_generique.py, vedette_tripo.importer) attend un corps EN CROIX, regardant -y, bras le long
# de x : celui-ci est en A. On leve les bras par son squelette, on fige la pose, puis on reduit les 677 000
# faces a `faces` triangles (defaut 30 000 : huit coureurs a l'ecran sur un petit telephone).
# -----------------------------------------------------------------------
import bpy, sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
sortie, faces = args[0], int(args[1]) if len(args) > 1 else 30000
ecart = float(args[2]) if len(args) > 2 else 0.0   # degres : les cuisses qui se touchent (corps de femme) cachent l'entrejambe a la chaine
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
h = next(o for o in bpy.data.objects if o.type == 'MESH')

def aligner(nom, cible):
    """Tourne l'os `nom` (pose) pour que sa direction devienne `cible` (repere du rig)."""
    pb = rig.pose.bones[nom]
    bpy.context.view_layer.update()
    m = pb.matrix.copy()
    d = (m.to_3x3() @ Vector((0, 1, 0))).normalized()
    q = d.rotation_difference(cible.normalized())
    pose = (q.to_matrix() @ m.to_3x3()).to_4x4(); pose.translation = m.to_translation()
    pb.matrix = pose
    bpy.context.view_layer.update()

for c in ('l', 'r'):
    # le cote gauche du personnage est en +x (il regarde -y)
    gauche = rig.data.bones['upperarm_' + c].head_local.x > 0
    s = 1 if gauche else -1
    for os_ in ('upperarm_', 'lowerarm_', 'hand_'):
        aligner(os_ + c, Vector((s, 0, 0)))

if ecart:
    import math
    for c in ('l', 'r'):
        gauche = rig.data.bones['thigh_' + c].head_local.x > 0
        pb = rig.pose.bones['thigh_' + c]
        bpy.context.view_layer.update()
        d = (pb.matrix.to_3x3() @ Vector((0, 1, 0))).normalized()
        cible = d.copy(); cible.rotate(__import__('mathutils').Quaternion(Vector((0, 1, 0)), math.radians(ecart) * (-1 if gauche else 1)))
        aligner('thigh_' + c, cible)   # (le reste de la jambe suit la cuisse)

# figer la pose dans le maillage, sans le squelette (la chaine en pose un neuf)
bpy.context.view_layer.objects.active = h
for o in bpy.data.objects: o.select_set(o is h)
mod = next(md for md in h.modifiers if md.type == 'ARMATURE')
bpy.ops.object.modifier_apply(modifier=mod.name)
h.parent = None
bpy.data.objects.remove(rig, do_unlink=True)
avant = len(h.data.polygons)
d = h.modifiers.new('reduire', 'DECIMATE'); d.ratio = faces / (2 * avant);   # (des quads : deux triangles chacun) d.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=d.name)
# (un ombrage plat fait exporter chaque triangle a part : la chaine ne trouvait plus aucune coupe fermee — le corps de femme)
bm = __import__('bmesh').new(); bm.from_mesh(h.data)
__import__('bmesh').ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0001)
for f in bm.faces: f.smooth = True
bm.to_mesh(h.data); bm.free(); h.data.update()
print('FACES', avant, '->', len(h.data.polygons), 'dims', tuple(round(x, 3) for x in h.dimensions))
bpy.ops.export_scene.gltf(filepath=sortie, export_format='GLB', use_selection=True, export_skins=False,
                          export_animations=False, export_yup=True, export_apply=True)
print('ECRIT', sortie)
