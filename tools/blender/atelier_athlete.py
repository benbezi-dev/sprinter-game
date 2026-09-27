# -----------------------------------------------------------------------
# ATELIER — mise en place d'une scene Blender pour sculpter un athlete elite.
#
# Ce script NE MODELISE PAS le personnage : un humain realiste se sculpte a
# la main. Il prepare tout ce qui vient avant : scene propre, unites, planches
# de reference aux trois vues, metarig Rigify a la bonne taille, et les
# materiaux (peau, debardeur a points, cuissard, chaine en or).
#
# DEUX FACONS DE LE LANCER
#
#   Dans Blender : onglet Scripting > Open > ce fichier > modifier la section
#   REGLAGES ci-dessous (chemins des vues) > Run Script.
#
#   En ligne de commande :
#     blender -P tools/blender/atelier_athlete.py -- \
#             --face ref/face.png --profil ref/profil.png --dos ref/dos.png \
#             [--hauteur 1.90] [--enregistrer atelier.blend]
#
# Une planche unique (les vues cote a cote) se decoupe d'abord en trois
# images, une par vue : une Empty Image n'affiche qu'une image entiere.
# -----------------------------------------------------------------------

import bpy
import math
import os
import sys
import addon_utils

# ============================ REGLAGES =================================
# La hauteur du personnage, en metres. Le prompt dit « environ 1,85 m » ;
# Aurel Manga mesure 1,90 m.
HAUTEUR = 1.85
# Les vues de reference (chemins absolus, ou relatifs au .blend). Laisser
# vide une vue qu'on n'a pas : son Empty est cree quand meme, sans image.
VUE_FACE = ''
VUE_PROFIL = ''
VUE_DOS = ''
# Opacite des planches dans la vue 3D (0 = invisible, 1 = opaque).
OPACITE = 0.5
# ========================================================================


def arguments():
    """Les reglages, surcharges par la ligne de commande si on en passe."""
    global HAUTEUR, VUE_FACE, VUE_PROFIL, VUE_DOS
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    val = lambda k, d: a[a.index(k) + 1] if k in a else d
    HAUTEUR = float(val('--hauteur', HAUTEUR))
    VUE_FACE = val('--face', VUE_FACE)
    VUE_PROFIL = val('--profil', VUE_PROFIL)
    VUE_DOS = val('--dos', VUE_DOS)
    return val('--enregistrer', '')


# -----------------------------------------------------------------------
# 1. NETTOYAGE ET UNITES
# -----------------------------------------------------------------------

def nettoyer():
    """Retirer le cube, la camera et la lumiere par defaut (et tout le reste)."""
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for bloc in (bpy.data.meshes, bpy.data.cameras, bpy.data.lights,
                 bpy.data.materials, bpy.data.armatures):
        for d in list(bloc):
            if d.users == 0:
                bloc.remove(d)


def unites():
    """Metres, echelle 1 : 1 unite Blender = 1 m, comme dans Unity."""
    u = bpy.context.scene.unit_settings
    u.system = 'METRIC'
    u.scale_length = 1.0
    u.length_unit = 'METERS'
    u.mass_unit = 'KILOGRAMS'


# -----------------------------------------------------------------------
# 2. LES PLANCHES DE REFERENCE (Empty de type Image)
# -----------------------------------------------------------------------

def planche(nom, chemin, rot_z, position):
    """Une vue de reference, debout, les pieds au sol.

    Rotation X 90 degres pour la dresser a la verticale, puis Z pour la
    tourner vers sa vue (0 face, 90 profil, 180 dos). Elle est reculee
    derriere le personnage pour ne pas le traverser, et n'apparait que dans
    la vue orthographique qui lui correspond (Numpad 1, 3, Ctrl+1).
    """
    e = bpy.data.objects.new(nom, None)
    e.empty_display_type = 'IMAGE'
    if chemin and os.path.exists(bpy.path.abspath(chemin)):
        e.data = bpy.data.images.load(bpy.path.abspath(chemin), check_existing=True)
    elif chemin:
        print('reference introuvable, Empty cree sans image :', chemin)
    e.rotation_euler = (math.radians(90), 0, math.radians(rot_z))
    e.location = position
    # La taille de l'image = sa plus grande dimension. On la cale sur un peu
    # plus que la hauteur du personnage ; l'ancrage en bas (offset y = 0)
    # pose le bas de l'image au sol. A ajuster a l'oeil selon la planche.
    e.empty_display_size = HAUTEUR * 1.08
    e.empty_image_offset = (-0.5, 0.0)
    e.use_empty_image_alpha = True
    e.color[3] = OPACITE
    e.empty_image_depth = 'BACK'
    e.show_empty_image_only_axis_aligned = True
    e.show_empty_image_perspective = False
    bpy.context.collection.objects.link(e)
    e.hide_select = True          # on ne l'attrape pas en sculptant
    return e


def references():
    col = bpy.data.collections.new('References')
    bpy.context.scene.collection.children.link(col)
    recul = 1.2
    vues = [planche('REF_Face', VUE_FACE, 0, (0, recul, 0)),
            planche('REF_Profil', VUE_PROFIL, 90, (-recul, 0, 0)),
            planche('REF_Dos', VUE_DOS, 180, (0, -recul, 0))]
    for v in vues:
        for c in v.users_collection:
            c.objects.unlink(v)
        col.objects.link(v)
    return vues


# -----------------------------------------------------------------------
# 3. L'ARMATURE DE BASE (metarig Rigify)
# -----------------------------------------------------------------------

def armature():
    """Le metarig « basic human » de Rigify, a la hauteur du personnage.

    Le basic human n'a ni visage ni doigts detailles : c'est le bon point de
    depart pour un athlete de jeu. On l'ajuste ensuite a la sculpture (Edit
    Mode), puis Rigify genere le rig de controle (Armature > Generate Rig).
    """
    ok = addon_utils.enable('rigify', default_set=True)
    if ok is None and not any(m.__name__ == 'rigify' for m in addon_utils.modules()):
        print('Rigify indisponible : armature simple a la place')
        bpy.ops.object.armature_add()
        return bpy.context.active_object
    bpy.ops.object.armature_basic_human_metarig_add()
    mr = bpy.context.active_object
    mr.name = 'metarig'
    # sa hauteur actuelle : du sol au bout du dernier os de la tete
    haut = max(max(b.head_local.z, b.tail_local.z) for b in mr.data.bones)
    bas = min(min(b.head_local.z, b.tail_local.z) for b in mr.data.bones)
    k = HAUTEUR / (haut - bas)
    mr.scale = (k, k, k)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Carrure d'athlete : les epaules un peu plus larges que le metarig
    # moyen. Uniquement sur la largeur (x), pour ne rien fausser en hauteur.
    bpy.ops.object.mode_set(mode='EDIT')
    for b in mr.data.edit_bones:
        if b.name.startswith(('shoulder', 'upper_arm', 'forearm', 'hand')):
            for p in (b.head, b.tail):
                if abs(p.x) > 0.02:
                    p.x *= 1.06
    bpy.ops.object.mode_set(mode='OBJECT')
    mr.show_in_front = True
    mr.data.display_type = 'OCTAHEDRAL'
    print('metarig : %.3f m (facteur %.3f)' % (HAUTEUR, k))
    return mr


# -----------------------------------------------------------------------
# 4. LES MATERIAUX
# -----------------------------------------------------------------------

def nouveau(nom):
    m = bpy.data.materials.get(nom) or bpy.data.materials.new(nom)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    sortie = nt.nodes.new('ShaderNodeOutputMaterial')
    sortie.location = (700, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (350, 0)
    nt.links.new(bsdf.outputs['BSDF'], sortie.inputs['Surface'])
    return m, nt, bsdf


def relief(nt, bsdf, echelle, force, distance=0.0005, x=0):
    """Un relief fin (pores, maille) branche sur la normale."""
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = echelle
    n.inputs['Detail'].default_value = 8
    n.location = (x - 300, -400)
    b = nt.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = force
    b.inputs['Distance'].default_value = distance
    b.location = (x, -400)
    nt.links.new(n.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], bsdf.inputs['Normal'])


def peau():
    """Peau noire : diffusion sous la surface courte et chaude, un film de sueur.

    Sur une peau foncee, la lumiere diffusee se voit surtout dans les
    oreilles, les narines et les bords d'ombre : un rayon court et rouge,
    un poids modere. Trop fort, la peau devient cireuse et grisatre.
    """
    m, nt, b = nouveau('Skin_Material')
    b.inputs['Base Color'].default_value = (0.068, 0.032, 0.018, 1)
    b.inputs['Roughness'].default_value = 0.42
    b.inputs['Subsurface Weight'].default_value = 0.22
    b.inputs['Subsurface Radius'].default_value = (1.0, 0.38, 0.18)
    b.inputs['Subsurface Scale'].default_value = 0.008
    b.inputs['Specular IOR Level'].default_value = 0.5
    # la sueur d'un athlete : un vernis tres fin
    b.inputs['Coat Weight'].default_value = 0.12
    b.inputs['Coat Roughness'].default_value = 0.2
    relief(nt, b, 1800, 0.25)
    return m


def debardeur():
    """Debardeur noir, motif degrade de petits points jaune/vert fluo.

    Les points viennent d'une Voronoi (F1 : distance au centre le plus
    proche), passee dans un ColorRamp en CONSTANT : sous le seuil, un point ;
    au-dessus, le tissu. Le seuil grandit vers le BAS du torse — les points
    y sont gros et serres, puis s'amenuisent en montant jusqu'a disparaitre :
    le degrade. Leur couleur glisse du vert (bas) au jaune (haut) par un
    second ColorRamp sur la hauteur.

    La hauteur est lue en coordonnees « Generated » (0 en bas de l'objet, 1
    en haut) : sur un debardeur modelise seul, 0 est l'ourlet, 1 les
    bretelles. Regler `bas` et `haut` du Map Range si le degrade doit
    commencer plus haut ou finir plus bas.
    """
    m, nt, b = nouveau('TankTop_Material')
    b.inputs['Roughness'].default_value = 0.55
    b.inputs['Sheen Weight'].default_value = 0.25       # tissu technique
    b.inputs['Sheen Roughness'].default_value = 0.4

    coord = nt.nodes.new('ShaderNodeTexCoord'); coord.location = (-1500, 0)
    xyz = nt.nodes.new('ShaderNodeSeparateXYZ'); xyz.location = (-1300, 200)
    nt.links.new(coord.outputs['Generated'], xyz.inputs[0])

    # LA TRAME DES POINTS : une Voronoi 2D, posee sur les UV du debardeur.
    # En 3D (coordonnees objet), la trame recoupait la surface en biais et
    # les points s'etiraient en stries verticales. `Scale` = nombre de points
    # sur la largeur des UV : a regler une fois le debardeur deplie (viser
    # 6 a 8 mm entre deux points).
    vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.location = (-1100, -100)
    vor.voronoi_dimensions = '2D'
    vor.feature = 'F1'
    vor.distance = 'EUCLIDEAN'
    vor.inputs['Scale'].default_value = 140.0
    vor.inputs['Randomness'].default_value = 0.0      # une trame reguliere
    nt.links.new(coord.outputs['UV'], vor.inputs['Vector'])

    # le degrade : rayon des points selon la hauteur (gros en bas, nuls en haut)
    rayon = nt.nodes.new('ShaderNodeMapRange'); rayon.location = (-1100, 250)
    rayon.inputs['From Min'].default_value = 0.05     # bas
    rayon.inputs['From Max'].default_value = 0.60     # haut : plus de points
    rayon.inputs['To Min'].default_value = 0.30       # gros points, sans se toucher
    rayon.inputs['To Max'].default_value = 0.06       # de fines piqures en haut
    nt.links.new(xyz.outputs['Z'], rayon.inputs['Value'])

    # distance au centre du point, moins le rayon : negatif = dans le point
    ecart = nt.nodes.new('ShaderNodeMath'); ecart.location = (-850, 0)
    ecart.operation = 'SUBTRACT'
    nt.links.new(vor.outputs['Distance'], ecart.inputs[0])
    nt.links.new(rayon.outputs['Result'], ecart.inputs[1])

    # le ColorRamp en CONSTANT fait le point net : 1 dedans, 0 dehors
    net = nt.nodes.new('ShaderNodeValToRGB'); net.location = (-650, 0)
    net.color_ramp.interpolation = 'CONSTANT'
    net.color_ramp.elements[0].position = 0.0
    net.color_ramp.elements[0].color = (1, 1, 1, 1)
    net.color_ramp.elements[1].position = 0.5
    net.color_ramp.elements[1].color = (0, 0, 0, 1)
    decal = nt.nodes.new('ShaderNodeMath'); decal.location = (-800, -150)
    decal.operation = 'ADD'
    decal.inputs[1].default_value = 0.5
    nt.links.new(ecart.outputs[0], decal.inputs[0])
    nt.links.new(decal.outputs[0], net.inputs['Fac'])

    # la couleur des points : vert fluo en bas, jaune fluo en haut
    teinte = nt.nodes.new('ShaderNodeValToRGB'); teinte.location = (-650, 300)
    teinte.color_ramp.elements[0].position = 0.05
    teinte.color_ramp.elements[0].color = (0.25, 0.9, 0.05, 1)   # vert fluo
    teinte.color_ramp.elements[1].position = 0.55
    teinte.color_ramp.elements[1].color = (1.0, 0.88, 0.0, 1)    # jaune fluo
    nt.links.new(xyz.outputs['Z'], teinte.inputs['Fac'])

    # LE HALO : sous les points, le noir se teinte d'un vert-jaune diffus,
    # par grandes taches, surtout vers le bas du torse — c'est ce qui donne
    # au motif sa lueur sur la planche de reference.
    tache = nt.nodes.new('ShaderNodeTexNoise'); tache.location = (-1100, 550)
    tache.inputs['Scale'].default_value = 2.5
    tache.inputs['Detail'].default_value = 2
    nt.links.new(coord.outputs['Generated'], tache.inputs['Vector'])
    lueur = nt.nodes.new('ShaderNodeMapRange'); lueur.location = (-850, 550)
    lueur.inputs['From Min'].default_value = 0.45
    lueur.inputs['From Max'].default_value = 0.70
    nt.links.new(tache.outputs['Fac'], lueur.inputs['Value'])
    bas_torse = nt.nodes.new('ShaderNodeMapRange'); bas_torse.location = (-850, 400)
    bas_torse.inputs['From Min'].default_value = 0.75
    bas_torse.inputs['From Max'].default_value = 0.10
    nt.links.new(xyz.outputs['Z'], bas_torse.inputs['Value'])
    halo = nt.nodes.new('ShaderNodeMath'); halo.location = (-650, 500)
    halo.operation = 'MULTIPLY'
    nt.links.new(lueur.outputs['Result'], halo.inputs[0])
    nt.links.new(bas_torse.outputs['Result'], halo.inputs[1])
    fond = nt.nodes.new('ShaderNodeMix'); fond.location = (-450, 450)
    fond.data_type = 'RGBA'
    fond.inputs[6].default_value = (0.012, 0.012, 0.014, 1)      # noir tissu
    fond.inputs[7].default_value = (0.10, 0.16, 0.01, 1)         # vert olive sombre
    nt.links.new(halo.outputs[0], fond.inputs['Factor'])

    mel = nt.nodes.new('ShaderNodeMix'); mel.location = (-300, 150)
    mel.data_type = 'RGBA'
    nt.links.new(fond.outputs[2], mel.inputs[6])
    nt.links.new(net.outputs['Color'], mel.inputs['Factor'])
    nt.links.new(teinte.outputs['Color'], mel.inputs[7])
    nt.links.new(mel.outputs[2], b.inputs['Base Color'])
    # les points sont imprimes : un rien plus lisses que le tissu
    rug = nt.nodes.new('ShaderNodeMapRange'); rug.location = (-300, -100)
    rug.inputs['To Min'].default_value = 0.55
    rug.inputs['To Max'].default_value = 0.35
    nt.links.new(net.outputs['Color'], rug.inputs['Value'])
    nt.links.new(rug.outputs['Result'], b.inputs['Roughness'])
    relief(nt, b, 900, 0.15)
    return m


def cuissard():
    """Cuissard noir mat : lycra/elasthanne, peu rugueux, un leger lustre."""
    m, nt, b = nouveau('Shorts_Material')
    b.inputs['Base Color'].default_value = (0.010, 0.010, 0.011, 1)
    # Un lustre a peine : plus fort, le noir virait au gris brillant sous
    # une lumiere franche, et le cuissard se lisait comme du vinyle.
    b.inputs['Roughness'].default_value = 0.5
    b.inputs['Specular IOR Level'].default_value = 0.35
    b.inputs['Sheen Weight'].default_value = 0.12
    b.inputs['Sheen Roughness'].default_value = 0.35
    b.inputs['Sheen Tint'].default_value = (0.6, 0.6, 0.65, 1)
    relief(nt, b, 1400, 0.08)
    return m


def chaine():
    """La fine chaine en or."""
    m, nt, b = nouveau('GoldChain_Material')
    b.inputs['Base Color'].default_value = (1.0, 0.72, 0.30, 1)
    b.inputs['Metallic'].default_value = 1.0
    b.inputs['Roughness'].default_value = 0.22
    return m


# -----------------------------------------------------------------------

def main():
    enregistrer = arguments()
    nettoyer()
    unites()
    references()
    mr = armature()
    mats = [peau(), debardeur(), cuissard(), chaine()]
    # Un faux utilisateur garde les materiaux dans le fichier tant qu'aucun
    # objet ne les porte : sans lui, Blender les jette a l'enregistrement.
    for m in mats:
        m.use_fake_user = True
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.view_settings.view_transform = 'AgX'
    bpy.context.view_layer.objects.active = mr
    print('atelier pret : references, metarig %.2f m, materiaux %s'
          % (HAUTEUR, ', '.join(m.name for m in mats)))
    if enregistrer:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(enregistrer))
        print('enregistre :', enregistrer)


main()
