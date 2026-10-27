# -----------------------------------------------------------------------
# SPRINTER — LA TRIBUNE DU STADE BERNARD AMSALEM, d'apres Tripo (27/10/2026).
#
#   Blender -b --factory-startup -P tools/blender/amsalem/tribune_tripo.py -- <tripo.glb> <sortie.glb> <faces> <texture px>
#
# Le modele Tripo (image -> 3D, d'apres img-3 des vues Polytan ; H3.1 Ultra, texture 8K, 2 M de faces,
# assets-sources/tripo-stade-amsalem) est reduit a <faces> et <texture px>, pose a l'echelle de la
# tribune OSM (25,3 m de long, sa longueur sur x, proportions gardees), le pied a z = 0, la facade vers -y
# (la piste). Deux sorties : public/modeles/amsalem/tribune.glb (tous les telephones) et tribune-ultra.glb.
# -----------------------------------------------------------------------
import bpy, sys, os
from mathutils import Vector

src, out, faces, tex = sys.argv[sys.argv.index('--') + 1:][:4]
faces, tex, LONG = int(faces), int(tex), 25.3
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
    mn = Vector([min(v[i] for v in bb) for i in range(3)]); mx = Vector([max(v[i] for v in bb) for i in range(3)])
    return mn, mx

mn, mx = boite()
print('BRUT', [round(v, 3) for v in (mx - mn)])
# la longueur sur x (Tripo rend la facade vers -y, la longueur deja sur x ; on le garantit)
if (mx - mn).y > (mx - mn).x:
    h.rotation_mode = 'XYZ'; h.rotation_euler.z = 1.5707963;   # (un import glTF est en quaternion)
    bpy.ops.object.transform_apply(rotation=True); mn, mx = boite()
k = LONG / (mx - mn).x
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
