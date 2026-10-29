# Les epaules de Mickael (« trop haut, il parait au garde-a-vous », 24/10) : la clavicule
# Lance : Blender -b --factory-startup -P epaules_meba_plein.py -- <meba-plein.glb> <sortie.glb|-> <rendu.png> 13.5 5
# montait de 22 degres (l'epaule a 5 cm sous la base du cou) ; on la couche, l'epaule descend,
# et le bras s'ecarte un peu du flanc. Pose appliquee comme nouveau repos.
import bpy, sys, math
from mathutils import Matrix, Vector
a = sys.argv[sys.argv.index('--') + 1:]
src, out, rendu = a[0], a[1], a[2]
BAISSE, ECART = math.radians(float(a[3])), math.radians(float(a[4]))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]
corps = [o for o in sc.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
def tourne(pb, angle, centre):
    R = Matrix.Translation(centre) @ Matrix.Rotation(angle, 4, 'X') @ Matrix.Translation(-centre)
    pb.matrix = R @ pb.matrix
    bpy.context.view_layer.update()
for c, s in (('_l', 1), ('_r', -1)):
    cl, ua = arm.pose.bones['clavicle' + c], arm.pose.bones['upperarm' + c]
    avant = ua.matrix.copy()
    tourne(cl, -s * BAISSE, cl.head.copy())
    # le bras ne suit pas la clavicule : il descend avec elle, toujours pendant, puis s'ecarte
    ua.matrix = Matrix.Translation(ua.head - avant.translation) @ avant
    bpy.context.view_layer.update()
    tourne(ua, s * ECART, ua.head.copy())
for o in corps:
    bpy.context.view_layer.objects.active = o
    md = next(m for m in o.modifiers if m.type == 'ARMATURE')
    nom = md.name
    bpy.ops.object.modifier_apply(modifier=nom)
    n = o.modifiers.new(nom, 'ARMATURE'); n.object = arm
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
for n in ['clavicle_l', 'upperarm_l', 'hand_l']:
    b = arm.data.bones[n]; print('OS', n, tuple(round(v, 3) for v in b.head_local), tuple(round(v, 3) for v in b.tail_local))
if out != '-':
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_skins=True,
                              export_image_format='AUTO', export_draco_mesh_compression_enable=False)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.rotation_euler = (0.8, 0.2, 0.6)
sun.data.energy = 4
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 0.75
sc.render.resolution_x, sc.render.resolution_y = 700, 700
try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError: sc.render.engine = 'BLENDER_EEVEE'
for i, x in enumerate([-6, 6]):
    cam.location = (x, 0, 1.25)
    cam.rotation_euler = (Vector((0, 0, 1.25)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = rendu.replace('.png', f'-{i}.png'); bpy.ops.render.render(write_still=True)
