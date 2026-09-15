# -----------------------------------------------------------------------
# SPRINTER — la vue du jeu, reproduite dans Blender.
#
# Tout decor rendu ici sera colle dans une image que le jeu dessine lui-meme,
# a cote de la piste, des coureurs et des ombres qu'il trace a la main. Un
# decor vu d'un angle a peine different se remarque tout de suite : il
# « glisse » quand la camera suit le coureur, et ses aretes ne sont plus
# paralleles aux lignes de la piste. La vue ne s'approche donc pas, elle se
# DERIVE de la projection du jeu (ground/solid, sprinter-app.js) :
#
#     ecran_x =  cos (-X + Y)          cos = 2/sqrt5, sin = 1/sqrt5
#     ecran_y = -sin ( X + Y) - Z      (y vers le bas)
#
# Trois consequences, chacune verifiee par verifier-vue.py plutot que crue :
#
#   1. C'est une projection orthographique vue depuis -X-Y, direction
#      (1, 1, -2/sqrt5)…
#   2. …mais EN MIROIR : la droite de l'ecran y vaut (-1, 1, 0), la gauche
#      d'une camera reelle. On la reproduit en echangeant X et Y dans la
#      scene, ce qui retourne l'image sans toucher a la lumiere.
#   3. Le pixel n'est pas carre : un metre le long de la largeur de l'ecran
#      y occupe 1,069 fois ce qu'il occupe en hauteur. Le rendu est donc
#      etire d'autant.
# -----------------------------------------------------------------------

import bpy
import math
import mathutils

COS = 2 / math.sqrt(5)
SIN = 1 / math.sqrt(5)
# largeur ecran d'un metre le long de la droite de l'ecran, rapportee a sa
# hauteur le long du haut de l'ecran (voir en-tete, point 3)
ETIREMENT = (COS * math.sqrt(2)) / (math.sqrt(7) / math.sqrt(5))

# La lumiere du jeu (LIGHT, sprinter-core.js) : un vecteur VERS la source.
LUMIERE = mathutils.Vector((-0.42, 0.28, 0.86)).normalized()


def miroir(v):
    """Le point du jeu, dans la scene Blender (X et Y echanges)."""
    return mathutils.Vector((v[1], v[0], v[2]))


def racine_miroir():
    """L'objet vide sous lequel on range tout ce qui est dans le repere du jeu.

    Son echelle negative fait l'echange X/Y : une rotation de 90 degres suivie
    d'un retournement. Les objets modelises dessous le sont donc dans le
    repere du jeu, tel quel.
    """
    e = bpy.data.objects.new('REPERE_JEU', None)
    bpy.context.collection.objects.link(e)
    # matrice qui echange X et Y : determinant -1
    e.matrix_world = mathutils.Matrix(((0, 1, 0, 0),
                                       (1, 0, 0, 0),
                                       (0, 0, 1, 0),
                                       (0, 0, 0, 1)))
    return e


def camera(px_par_m, largeur, hauteur, centre=(0.0, 0.0, 0.0)):
    """La camera orthographique du jeu.

    `px_par_m` est l'echelle de l'IMAGE FINALE, dans l'unite du jeu : un
    point decale de (X, Y, Z) y tombe a px_par_m * (cos(-X+Y), -(sin(X+Y)+Z))
    pixels de l'ancre. Le moteur n'aura qu'a multiplier par scaleM()/px_par_m.
    """
    sc = bpy.context.scene
    sc.render.resolution_x = largeur
    sc.render.resolution_y = hauteur
    sc.render.resolution_percentage = 100

    d = mathutils.Vector((1, 1, -2 / math.sqrt(5))).normalized()
    haut = mathutils.Vector((1, 1, math.sqrt(5))).normalized()
    droite = d.cross(haut).normalized()
    # repere camera : X droite, Y haut, regarde vers -Z
    rot = mathutils.Matrix((droite, haut, -d)).transposed()

    cam_d = bpy.data.cameras.new('vue_jeu')
    cam_d.type = 'ORTHO'
    # verticalement, un metre le long de `haut` vaut sqrt7/sqrt5 metres-jeu
    # a l'ecran : V pixels Blender par unite doivent donc donner px_par_m.
    V = px_par_m * math.sqrt(7) / math.sqrt(5)
    # En orthographique, ortho_scale est la LARGEUR vue. L'image finale est
    # etiree horizontalement de ETIREMENT : on rend donc plus large que
    # l'image, a raison de largeur / (V * ETIREMENT) unites.
    cam_d.ortho_scale = largeur / (V * ETIREMENT)
    # ortho_scale mesure la LARGEUR vue, a condition de le dire. Laisse sur
    # « auto », Blender le rapporte a la plus grande des deux dimensions : une
    # image plus haute que large sortait alors a la mauvaise echelle, et la
    # piece debordait du cadre — une aiguille de roche y avait perdu sa
    # pointe. La verification d'origine, en paysage, ne pouvait pas le voir.
    cam_d.sensor_fit = 'HORIZONTAL'
    # Le pixel du jeu est plus large que haut : un pixel « haut » de
    # ETIREMENT dit a Blender de comprimer d'autant la hauteur vue, et l'image
    # carree finale ressort etiree comme le moteur la dessine. Mesure par
    # verifier-vue.py : 0,18 px d'ecart au pire.
    sc.render.pixel_aspect_x = 1.0
    sc.render.pixel_aspect_y = ETIREMENT
    cam_d.clip_start = 0.01
    cam_d.clip_end = 400
    cam = bpy.data.objects.new('vue_jeu', cam_d)
    bpy.context.collection.objects.link(cam)
    c = miroir(centre)
    cam.matrix_world = mathutils.Matrix.Translation(c - d * 120) @ rot.to_4x4()
    sc.camera = cam
    return cam


def ancre_pixel(cam, point_jeu=(0, 0, 0)):
    """Ou tombe un point du jeu dans l'image rendue, en pixels (y vers le bas)."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    co = world_to_camera_view(sc, cam, miroir(point_jeu))
    return (co.x * sc.render.resolution_x, (1 - co.y) * sc.render.resolution_y)


def soleil(force=3.2):
    """Le soleil du jeu. Dans la scene miroir, sa direction est miroitee aussi."""
    d = bpy.data.lights.new('soleil_jeu', type='SUN')
    d.energy = force
    d.angle = math.radians(2.0)
    o = bpy.data.objects.new('soleil_jeu', d)
    bpy.context.collection.objects.link(o)
    vers_source = miroir(LUMIERE)
    o.rotation_euler = vers_source.to_track_quat('Z', 'Y').to_euler()
    return o
