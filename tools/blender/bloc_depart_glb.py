# Le bloc de depart du jeu (pieces.blocs, celui des images 2D), exporte en GLB pour la
# course 3D (src/game/course-3d.ts). Les couleurs ne passent pas l'export (matieres
# en noeuds) : course-3d.ts les reprend par nom de matiere.
#   Blender -b --factory-startup -P tools/blender/bloc_depart_glb.py -- public/modeles/bloc-depart.glb
# Repere du jeu (x vers la course, y vers les couloirs exterieurs, z en haut), sans miroir.
import sys, bpy
D = '/Volumes/MUSIQUE/BENBEZI/sprinter-course-3d/tools/blender/decors'
sys.path.insert(0, D)
import pieces, palettes
bpy.ops.wm.read_factory_settings(use_empty=True)
racine = bpy.data.objects.new('BLOC', None)
bpy.context.collection.objects.link(racine)
pieces.commencer(racine)
pieces.blocs(palettes.PALETTES['materiel'])
bpy.context.view_layer.update()
for o in bpy.data.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=sys.argv[-1], export_format='GLB', use_selection=True,
                          export_yup=False, export_apply=True, export_animations=False)
print('MATS', [m.name for m in bpy.data.materials], 'OBJ', len(bpy.data.objects))
