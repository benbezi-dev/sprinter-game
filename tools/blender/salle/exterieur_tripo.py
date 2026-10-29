# -----------------------------------------------------------------------
# SPRINTER — L'EXTERIEUR DU STADE COUVERT JESSE OWENS, d'apres Tripo (26/10/2026).
#
#   Blender -b --factory-startup -P tools/blender/salle/exterieur_tripo.py -- <tripo.glb> <sortie.glb>
#
# Le modele Tripo (image -> 3D, d'apres la vue aerienne du ministere des Sports) fait
# 1,9 million de faces et 4 k de texture : on le reduit a ~60 000 faces et 1 024 px,
# on le pose a l'echelle de la halle (salle-3d.ts : 103,3 x 58 m au sol, 13,5 m de haut),
# sa longueur sur x, le pied a z = 0. Il ne se voit qu'au survol d'avant-course.
# -----------------------------------------------------------------------
import bpy, sys
from mathutils import Vector

src, out = sys.argv[sys.argv.index('--') + 1:][:2]
L, LARG, H = 103.34, 58.0, 13.5
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
# la reduction
d = h.modifiers.new('reduire', 'DECIMATE'); d.ratio = 60000 / max(1, len(h.data.polygons))
bpy.ops.object.modifier_apply(modifier=d.name)
# l'echelle et la pose : la plus grande dimension au sol sur x
bb = [Vector(c) for c in h.bound_box]
mn = Vector([min(v[i] for v in bb) for i in range(3)]); mx = Vector([max(v[i] for v in bb) for i in range(3)])
dim = mx - mn
if dim.y > dim.x:
    h.rotation_euler.z = 1.5707963; bpy.ops.object.transform_apply(rotation=True)
    bb = [Vector(c) for c in h.bound_box]
    mn = Vector([min(v[i] for v in bb) for i in range(3)]); mx = Vector([max(v[i] for v in bb) for i in range(3)]); dim = mx - mn
h.location = -(mn + mx) / 2; h.location.z = -mn.z
bpy.ops.object.transform_apply(location=True)
h.scale = (L / dim.x, LARG / dim.y, H / dim.z)
bpy.ops.object.transform_apply(scale=True)
# les textures a 1 024 px
for im in bpy.data.images:
    if im.size[0] > 1024: im.scale(1024, int(1024 * im.size[1] / im.size[0]))
print('FACES', len(h.data.polygons), 'DIM', [round(x, 2) for x in h.dimensions])
bpy.ops.object.select_all(action='DESELECT'); h.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=False,
                          export_image_format='JPEG', export_jpeg_quality=82, export_meshopt_compression_enable=True)
import os; print('GLB', out, os.path.getsize(out))
