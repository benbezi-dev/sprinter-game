# -----------------------------------------------------------------------
# SPRINTER — rendre le coureur sculpte, pour le regarder.
#
#   blender -b -P tools/blender/rendu.py -- --images tools/blender/sortie/tour
#
# Le jeu n'affichera jamais ce maillage : il ne sait pas les lire, et c'est
# tres bien ainsi. Ce rendu sert a VERIFIER — un corps qu'on ne voit qu'a
# travers soixante-douze troncs de cone en vue isometrique cache ses
# defauts. Ici on tourne autour, en pleine lumiere.
#
# C'est le meme corps, aux memes cotes, sculpte par les memes masses : ce
# qu'on voit tourner est bien ce qui a ete mesure.
# -----------------------------------------------------------------------

import bpy
import sys
import os
import math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anatomie
import coureur as C
import importlib
importlib.reload(anatomie)


# Les groupes qui vont par paire : un bras, une jambe, une epaule.
LATERAUX = ('deltoid', 'upperarm', 'forearm', 'thigh', 'shank')

# Un mannequin d'atelier, d'une seule matiere.
#
# On ne l'habille pas, et ce n'est pas un renoncement : ce rendu sert a
# juger un galbe — ou tombe le ventre du biceps, comment la taille se
# pince, ou le mollet culmine. Un maillot et un short cacheraient
# precisement ce qu'on est venu regarder.
ARGILE = (0.66, 0.60, 0.55)


def matiere(nom, couleur, rugosite=0.62):
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    # Le noeud se cherche par type : son nom change avec la langue de
    # l'interface et avec les versions.
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*couleur, 1.0)
    bsdf.inputs['Roughness'].default_value = rugosite
    return m


# LES PIEDS, POUR LE RENDU SEULEMENT.
#
# Dans le jeu, la chaussure n'est pas de la chair : c'est une piece a part,
# de la couleur du kit, posee au bout de la cheville — elle n'a donc rien a
# faire dans l'anatomie mesuree. Mais un mannequin sans pieds, qui se
# termine en pointe au-dessus du sol, ne donne pas une idee juste du
# personnage. On en pose donc ici, aux cotes exactes de celle du rig :
# vingt centimetres de long, neuf de large, centree devant la cheville.
def pied(cote):
    z = anatomie.ANKLE_Z - 0.030
    hy = anatomie.ecarts(False)['hip'] * cote
    return [
        (-0.022, hy, z + 0.012, 0.030, 0.000, 0.014),
        (0.020, hy, z + 0.004, 0.030, 0.000, 0.018),
        (0.062, hy, z - 0.002, 0.028, 0.000, 0.018),
        (0.104, hy, z - 0.004, 0.024, 0.000, 0.014),
    ]


def corps(groupes, rayons, resolution=0.004):
    """Le corps, en trois volumes qui s'interpenetrent.

    Pas en un seul : dans le rig du jeu, l'axe d'une cuisse passe a huit
    centimetres du milieu pour un rayon de dix. Les deux cuisses se
    CHEVAUCHENT, et le moteur s'en accommode tres bien — il empile des
    troncs de cone independants, celui de devant cache celui de derriere.
    Fondues en une seule metaball, en revanche, elles se soudent en un
    bloc et l'entrejambe disparait.

    On sculpte donc trois familles separees, qui ne se fondent pas entre
    elles : le tronc avec la tete et les bras, puis chaque jambe. C'est
    exactement ce que fait le jeu, et non un arrangement pour la photo.
    """
    familles = {
        'TRONC': ('pelvis', 'torso', 'neck', 'head'),
        'BRAS_G': ('deltoid', 'upperarm', 'forearm'),
        'BRAS_D': ('deltoid', 'upperarm', 'forearm'),
        'JAMBE_G': ('thigh', 'shank'),
        'JAMBE_D': ('thigh', 'shank'),
    }
    mat = matiere('argile', ARGILE, 0.58)
    objets = []
    for nom, gs in familles.items():
        cote = -1 if nom.endswith('_D') else 1
        masses, rs = [], []
        for g in gs:
            for masse, R in zip(groupes[g], rayons[g]):
                x, y, z, r0, dx, dy = masse
                masses.append((x, y * cote, z, r0, dx, dy))
                rs.append(R)
        if nom.startswith('JAMBE'):
            for m in pied(cote):
                masses.append(m)
                rs.append(m[3] / C.SEUIL_BILLE)
        o = C.sculpter(nom, masses, rs, resolution)
        o.data.materials.append(mat)
        bpy.ops.object.shade_smooth()
        objets.append(o)
    return objets


def scene(largeur=1280, hauteur=720, images=180):
    sc = bpy.context.scene
    sc.render.resolution_x = largeur
    sc.render.resolution_y = hauteur
    sc.render.fps = 30
    sc.frame_start = 1
    sc.frame_end = images
    sc.render.image_settings.file_format = 'PNG'

    # Un sol discret, juste pour que le corps ne flotte pas dans le vide.
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    sol = bpy.context.active_object
    sol.data.materials.append(matiere('sol', (0.055, 0.060, 0.082), 0.9))

    monde = bpy.data.worlds.new('fond')
    monde.use_nodes = True
    fond = next(n for n in monde.node_tree.nodes if n.type == 'BACKGROUND')
    fond.inputs[0].default_value = (0.055, 0.062, 0.09, 1)
    fond.inputs[1].default_value = 0.9
    sc.world = monde

    # Trois lumieres : une principale de trois quarts, une de remplissage
    # cote ombre, une de contre-jour qui detache la silhouette du fond.
    for nom, pos, energie, taille in (
            ('cle', (2.6, -2.8, 3.4), 900, 2.2),
            ('remplissage', (-3.0, -1.6, 1.9), 260, 3.0),
            ('contre', (-1.4, 3.4, 2.8), 520, 1.8)):
        d = bpy.data.lights.new(nom, type='AREA')
        d.energy = energie
        d.size = taille
        o = bpy.data.objects.new(nom, d)
        o.location = pos
        bpy.context.collection.objects.link(o)
        direction = (-pos[0], -pos[1], 0.95 - pos[2])
        o.rotation_euler = _viser(direction)

    cam_d = bpy.data.cameras.new('cam')
    # 40 mm a 4,5 m : le corps entier tient dans le cadre, de la plante des
    # pieds au sommet du crane, sans que la perspective ne le deforme.
    cam_d.lens = 40
    cam = bpy.data.objects.new('cam', cam_d)
    bpy.context.collection.objects.link(cam)
    sc.camera = cam

    # La camera fait le tour, legerement en plongee, en fixant la poitrine.
    cible = bpy.data.objects.new('cible', None)
    cible.location = (0, 0, 0.88)
    bpy.context.collection.objects.link(cible)
    c = cam.constraints.new('TRACK_TO')
    c.target = cible
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'

    for f in range(1, images + 1):
        a = 2 * math.pi * (f - 1) / images
        r = 4.5
        # depart de face : le coureur avance vers +x, la camera l'attend la.
        cam.location = (r * math.cos(a), r * math.sin(a), 1.15)
        cam.keyframe_insert('location', frame=f)
    for fc in cam.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'

    # EEVEE si la machine le permet, Cycles sinon : un rendu qui ne sort
    # pas ne sert a rien, meme s'il aurait ete plus beau.
    try:
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        sc.render.engine = 'CYCLES'
        sc.cycles.samples = 24


def _viser(d):
    """Les angles d'Euler pour qu'un objet regarde dans une direction."""
    import mathutils
    v = mathutils.Vector(d)
    return v.to_track_quat('-Z', 'Y').to_euler()


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    dossier = 'tools/blender/sortie/tour'
    images = 180
    fem = '--femme' in args
    if '--images' in args:
        dossier = args[args.index('--images') + 1]
    if '--nb' in args:
        images = int(args[args.index('--nb') + 1])

    groupes = anatomie.masses(fem=fem)
    print('calibration du corps...')
    rayons, _ = C.calibrer(groupes, passes=12)
    C.vider()
    corps(groupes, rayons)
    scene(images=images)
    os.makedirs(dossier, exist_ok=True)
    bpy.context.scene.render.filepath = os.path.join(dossier, 'f')
    print('rendu de %d images dans %s' % (images, dossier))
    bpy.ops.render.render(animation=True)


main()
