# LA BETE VUE DE PROFIL — l'outil de diagnostic, et il a paye tout de suite.
#
#   /opt/bpyenv/bin/python tools/blender/molosse-profil.py
#   (ou : blender -b -P tools/blender/molosse-profil.py)
#
# POURQUOI UNE SECONDE VUE ALORS QUE LE JEU N'EN A QU'UNE.
#
# Le rendu du jeu (molosse.py) sort huit images sous l'angle isometrique de la
# course : de trois quarts arriere, et de haut. C'est le bon angle pour juger
# ce que le joueur verra — et c'est le pire pour juger une ANATOMIE. Sous cet
# angle, un quadrupede n'est qu'un dos : le cou est ecrase par la perspective,
# la hauteur de tete ne se lit pas, et deux pattes sur quatre sont derriere le
# corps.
#
# CE QUE CINQ RENDUS DU JEU N'ONT PAS MONTRE, ET QUE LE PREMIER PROFIL A DIT
# EN UNE IMAGE : la tete etait SOUS le niveau du dos, museau vers le sol — la
# bete reniflait la terre en courant. Les hauteurs de la table TETE allaient
# de 0,475 a 0,425 quand celles de la COLONNE vont de 0,48 a 0,66. C'est ce
# decrochement manquant, et lui seul, qui faisait lire une loutre : un corps
# qui continue tout droit et se termine en pointe vers le bas.
#
# Le profil a aussi montre que les pattes etaient des fils — 6 cm de rayon au
# coude sur une bete d'un metre trente au garrot — et que le corps paraissait
# long POUR CETTE RAISON, non parce qu'il l'etait : les nombres donnent un
# rapport longueur/hauteur de 1,17, soit une bete a peu pres carree.
#
# ON NE JUGE DONC PLUS UNE SILHOUETTE SOUS L'ANGLE DU JEU. On la corrige de
# profil, ou l'anatomie se lit, puis on verifie au jeu que la correction s'y
# voit encore. Deux vues, deux questions differentes.
#
# Ce fichier ne produit rien qui entre dans le jeu : une image, dans le
# dossier de travail, pour etre regardee.

import bpy
import sys
import os
import math

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
import molosse as M

SORTIE = os.environ.get('MOLOSSE_PROFIL') or os.path.join(
    ICI, '..', '..', '.rendus', 'molosse-profil.png')

# La phase 0,15 : les quatre membres y sont a des hauteurs differentes, ce qui
# permet de les juger tous les quatre sur une seule image. Une phase ou deux
# pattes se superposent cacherait precisement ce qu'on vient regarder.
PHASE = 0.15

M.nettoyer()
mat = M.matiere_bete()
for o in M.bete(PHASE):
    o.data.materials.append(mat)

sc = bpy.context.scene
cam_d = bpy.data.cameras.new('profil')
cam_d.type = 'ORTHO'
cam_d.ortho_scale = 3.6
cam = bpy.data.objects.new('profil', cam_d)
sc.collection.objects.link(cam)
# Plein cote, a hauteur de poitrail : aucune plongee, aucune perspective. Une
# vue de plan d'architecte, qui ne flatte rien et ne cache rien.
cam.location = (0.4, -6.0, 0.75)
cam.rotation_euler = (math.radians(90), 0, 0)
sc.camera = cam

sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.film_transparent = True
sc.render.resolution_x = 900
sc.render.resolution_y = 560
sc.render.image_settings.file_format = 'PNG'
os.makedirs(os.path.dirname(os.path.abspath(SORTIE)), exist_ok=True)
sc.render.filepath = os.path.abspath(SORTIE)
bpy.ops.render.render(write_still=True)
print('profil : %s' % os.path.abspath(SORTIE))
