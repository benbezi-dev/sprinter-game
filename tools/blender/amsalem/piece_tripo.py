# -----------------------------------------------------------------------
# SPRINTER — UNE PIECE DU STADE BERNARD AMSALEM, d'apres Tripo (27/10/2026).
#
#   Blender -b --factory-startup -P tools/blender/amsalem/piece_tripo.py -- <tripo.glb> <sortie.glb> <faces> <texture px> <haut|long> <metres>
#
# Mats d'eclairage, cage du marteau, arbre, troncon de haie (texte -> 3D dans Tripo ; sources dans
# assets-sources/tripo-stade-amsalem). Reduit a <faces> et <texture px>, mis a l'echelle par sa hauteur
# (`haut`) ou par sa longueur au sol, posee sur x (`long`), proportions gardees, centre au sol en (0, 0).
# -----------------------------------------------------------------------
import bpy, sys, os
from mathutils import Vector

src, out, faces, tex, mode, metres = sys.argv[sys.argv.index('--') + 1:][:6]
faces, tex, metres = int(faces), int(tex), float(metres)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
ms = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in ms: o.select_set(True)
bpy.context.view_layer.objects.active = ms[0]
if len(ms) > 1: bpy.ops.object.join()
h = bpy.context.view_layer.objects.active
for o in [o for o in bpy.data.objects if o.type != 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
h.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
d = h.modifiers.new('reduire', 'DECIMATE'); d.ratio = min(1, faces / max(1, len(h.data.polygons)))
bpy.ops.object.modifier_apply(modifier=d.name)

def boite():
    bpy.context.view_layer.update()
    bb = [h.matrix_world @ Vector(c) for c in h.bound_box]
    return Vector([min(v[i] for v in bb) for i in range(3)]), Vector([max(v[i] for v in bb) for i in range(3)])

mn, mx = boite()
if mode == 'long' and (mx - mn).y > (mx - mn).x:
    h.rotation_mode = 'XYZ'; h.rotation_euler.z = 1.5707963   # (un import glTF est en quaternion)
    bpy.ops.object.transform_apply(rotation=True); mn, mx = boite()
k = metres / ((mx - mn).z if mode == 'haut' else (mx - mn).x)
h.scale = (k, k, k); bpy.ops.object.transform_apply(scale=True)
mn, mx = boite()
h.location = Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z))
bpy.ops.object.transform_apply(location=True)
for im in bpy.data.images:
    if im.size[0] > tex: im.scale(tex, int(tex * im.size[1] / im.size[0]))
print('FACES', len(h.data.polygons), 'DIM', [round(x, 2) for x in h.dimensions])
bpy.ops.object.select_all(action='DESELECT'); h.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=False,
                          export_image_format='JPEG', export_jpeg_quality=88, export_meshopt_compression_enable=True)
print('GLB', out, os.path.getsize(out))
