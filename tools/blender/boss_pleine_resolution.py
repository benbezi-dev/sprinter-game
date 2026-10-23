# -----------------------------------------------------------------------
# SPRINTER — LES BOSS DE LA LEGENDE EN PLEINE RESOLUTION (23/10/2026).
#
#   blender -b <assets-sources/legende/boss/NOM/NOM-rig.blend> --factory-startup \
#       -P tools/blender/boss_pleine_resolution.py -- --glb src/assets/legende/boss/NOM.glb
#
# « Mets les assets dans leur plein potentiel, sans les compresser ni reduire
# leur qualite. » Le rig enregistre par vedette_tripo.py (--blend) porte le corps
# deja cale, poids et marque compris, et la texture de Tripo a sa taille d'origine
# (blanc modele, peau a sa teinte). On en tire la peau du jeu comme vedette_tripo.py
# (eclaircie de ECLAIRCIR_JEU, ilots dilates) mais a la taille de la source au lieu
# de 1024, et on l'exporte en PNG, sans meshopt.
# -----------------------------------------------------------------------

import bpy
import os
import runpy
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
V = runpy.run_path(os.path.join(ICI, 'vedette_tripo.py'), run_name='vedette_tripo')

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
glb = argv[argv.index('--glb') + 1]

h = next(o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers))
rig = next(m.object for m in h.modifiers if m.type == 'ARMATURE')
tex = V['texture'](h)
img = tex.image
cote = max(img.size)
jeu = V['dilater'](h, V['modeler_blanc'](V['teinter_peau'](img, None, k=V['ECLAIRCIR_JEU'])), cote)
print('PLEIN : %s, texture %d px -> %s : %d octets' % (h.name, cote, glb, V['exporter'](h, rig, glb, jeu, plein=True)))
