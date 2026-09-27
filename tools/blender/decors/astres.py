# -----------------------------------------------------------------------
# SPRINTER — les astres du fond de la piste arc-en-ciel.
#
#   python astres.py           (avec le module bpy)
#   blender -b -P tools/blender/decors/astres.py
#
# Les grandes planetes qui defilent sous la piste, en parallaxe, etaient des
# degrades peints par le moteur (decor-cosmos.js) : un disque, une lumiere,
# un anneau — lisibles, mais plats. Elles sont ici modelisees et rendues par
# Cycles, en eclairage reel (reel.py), puis posees par le moteur comme des
# images. Elles ne sont pas vues « sous la vue du jeu » : un astre a mille
# kilometres n'a pas de perspective isometrique, il a une face. On les rend
# donc de face, a peine vues d'en haut pour ouvrir leurs anneaux.
#
# Sortie : public/decors/arcenciel/astre-<nom>.webp, carrees, l'astre centre,
# son rayon valant RAYON_PX pixels (le moteur l'echelle d'apres ce rayon).
# -----------------------------------------------------------------------

import bpy
import bmesh
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reel as R
import fabriquer as F

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
DOSSIER = os.path.join(RACINE, 'public', 'decors', 'arcenciel')
RAYON_PX = 200
TAILLE = 720


def vider():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def sphere(nom, mat, r, subdiv=6):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def anneau(nom, mat, r0, r1, n=192):
    bm = bmesh.new()
    ext = [bm.verts.new((r1 * math.cos(2 * math.pi * k / n), r1 * math.sin(2 * math.pi * k / n), 0))
           for k in range(n)]
    inn = [bm.verts.new((r0 * math.cos(2 * math.pi * k / n), r0 * math.sin(2 * math.pi * k / n), 0))
           for k in range(n)]
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((ext[k], ext[j], inn[j], inn[k]))
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def _principled(nom):
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes['Principled BSDF']


def bandes(nom, couleurs, echelle=6.0, trouble=0.18, rugosite=0.55):
    """Des bandes de gaz qui ondulent : l'altitude, troublee par un bruit."""
    m, nt, p = _principled(nom)
    p.inputs['Roughness'].default_value = rugosite
    tc = nt.nodes.new('ShaderNodeTexCoord')
    br = nt.nodes.new('ShaderNodeTexNoise')
    br.inputs['Scale'].default_value = 3.0
    br.inputs['Detail'].default_value = 8.0
    nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    add = nt.nodes.new('ShaderNodeMath')
    add.operation = 'MULTIPLY_ADD'
    add.inputs[1].default_value = trouble
    nt.links.new(br.outputs['Fac'], add.inputs[0])
    nt.links.new(sep.outputs['Z'], add.inputs[2])
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = echelle
    nt.links.new(add.outputs[0], mul.inputs[0])
    fr = nt.nodes.new('ShaderNodeMath')
    fr.operation = 'PINGPONG'
    fr.inputs[1].default_value = 1.0
    nt.links.new(mul.outputs[0], fr.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.0, R.lin(couleurs[0])
    el[1].position, el[1].color = 1.0, R.lin(couleurs[-1])
    for i, c in enumerate(couleurs[1:-1]):
        e = el.new((i + 1) / (len(couleurs) - 1))
        e.color = R.lin(c)
    nt.links.new(fr.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    return m


def cratere(nom, couleur, sombre):
    """Une lune : du gris colore, des cratères en relief (Voronoi)."""
    m, nt, p = _principled(nom)
    p.inputs['Roughness'].default_value = 0.85
    tc = nt.nodes.new('ShaderNodeTexCoord')
    vo = nt.nodes.new('ShaderNodeTexVoronoi')
    vo.feature = 'DISTANCE_TO_EDGE'
    vo.inputs['Scale'].default_value = 5.0
    nt.links.new(tc.outputs['Object'], vo.inputs['Vector'])
    br = nt.nodes.new('ShaderNodeTexNoise')
    br.inputs['Scale'].default_value = 9.0
    br.inputs['Detail'].default_value = 10.0
    nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    bu = nt.nodes.new('ShaderNodeBump')
    bu.inputs['Strength'].default_value = 0.6
    nt.links.new(vo.outputs['Distance'], bu.inputs['Height'])
    nt.links.new(bu.outputs['Normal'], p.inputs['Normal'])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    # les entrees couleur du melange sont les 6e et 7e : les noms A et B
    # designent d'abord les entrees nombre
    mix.inputs[6].default_value = R.lin(sombre)
    mix.inputs[7].default_value = R.lin(couleur)
    nt.links.new(br.outputs['Fac'], mix.inputs[0])
    nt.links.new(mix.outputs[2], p.inputs['Base Color'])
    return m


def atmosphere(nom, couleur, force=4.0):
    import pieces_arcenciel as PA
    return PA._matiere_atmosphere(nom, couleur, force)


def anneaux_mat(nom, c0, c1):
    import pieces_arcenciel as PA
    m = PA._matiere_anneaux(nom)
    nt = m.node_tree
    # les memes bandes, recolorees et ramenees a ces rayons
    for n in nt.nodes:
        if n.type == 'MAP_RANGE':
            n.inputs['From Min'].default_value = 1.35
            n.inputs['From Max'].default_value = 2.25
    rampes = [n for n in nt.nodes if n.type == 'VALTORGB']
    rampes[-1].color_ramp.elements[0].color = R.lin(c0)
    rampes[-1].color_ramp.elements[1].color = R.lin(c1)
    return m


ASTRES = {
    # une geante gazeuse rose et or, et ses anneaux
    'geante': dict(bandes=[(120, 40, 150), (255, 110, 170), (255, 190, 120), (255, 120, 190),
                           (150, 60, 200)],
                   atmo=(255, 150, 220), anneaux=((255, 200, 140), (200, 120, 255)), inc=14),
    # une planete de glace, bleue, a l'atmosphere epaisse
    'glace': dict(bandes=[(40, 90, 200), (90, 190, 255), (220, 240, 255), (70, 150, 240),
                          (30, 70, 180)], trouble=0.45, echelle=3.0,
                  atmo=(120, 210, 255), atmo_force=6.0),
    # une lune cratérisee, lavande
    'lune': dict(cratere=((210, 196, 240), (110, 96, 150)), atmo=(200, 180, 255), atmo_force=1.5),
    # une planete emeraude a bandes fines, sans anneau
    'emeraude': dict(bandes=[(10, 90, 90), (40, 200, 160), (170, 255, 210), (30, 150, 140)],
                     echelle=9.0, trouble=0.12, atmo=(90, 255, 200), atmo_force=4.0),
}


def rendre(nom, cfg):
    vider()
    sc = bpy.context.scene
    if 'cratere' in cfg:
        mat = cratere(nom, *cfg['cratere'])
    else:
        mat = bandes(nom, cfg['bandes'], cfg.get('echelle', 6.0), cfg.get('trouble', 0.18))
    g = sphere('globe', mat, 1.0)
    g.rotation_euler = (math.radians(12), math.radians(-18), 0)
    sphere('atmo', atmosphere('atmo', cfg['atmo'], cfg.get('atmo_force', 4.0)), 1.04)
    if 'anneaux' in cfg:
        a = anneau('anneaux', anneaux_mat('anneaux', *cfg['anneaux']), 1.35, 2.25)
        a.rotation_euler = (math.radians(90 - cfg.get('inc', 14)), math.radians(-12), 0)
    # La camera : de face, a peine au-dessus de l'equateur.
    cd = bpy.data.cameras.new('cam')
    cd.type = 'ORTHO'
    cd.ortho_scale = 2.0 * TAILLE / (2 * RAYON_PX)
    cam = bpy.data.objects.new('cam', cd)
    bpy.context.collection.objects.link(cam)
    d = (0, -1, 0.18)
    from mathutils import Vector
    v = Vector(d).normalized()
    cam.location = v * 20
    cam.rotation_euler = (-v).to_track_quat('-Z', 'Z').to_euler()
    sc.camera = cam
    sc.render.resolution_x = sc.render.resolution_y = TAILLE
    sc.render.pixel_aspect_x = sc.render.pixel_aspect_y = 1.0
    R.reglages(sc, 160)
    R.monde_spatial(sc)
    # un soleil franc en haut a gauche : un astre se lit par son terminateur
    for nom_l, col, direc, force in (('soleil', (255, 244, 230), (-0.8, -0.6, 0.5), 5.5),
                                     ('contre', (255, 90, 200), (0.9, 0.6, 0.1), 2.0)):
        dl = bpy.data.lights.new(nom_l, type='SUN')
        dl.energy = force
        dl.color = R.lin(col)[:3]
        o = bpy.data.objects.new(nom_l, dl)
        bpy.context.collection.objects.link(o)
        o.rotation_euler = Vector(direc).normalized().to_track_quat('Z', 'Y').to_euler()
    bpy.context.scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.35
    f = '/tmp/astre-%s.png' % nom
    sc.render.filepath = f
    bpy.ops.render.render(write_still=True)
    out = R.halo_lumineux(F.lire(f), seuil=0.8, force=0.6)
    os.makedirs(DOSSIER, exist_ok=True)
    F.ecrire_webp(out, os.path.join(DOSSIER, 'astre-%s.webp' % nom))
    print('  astre %s' % nom)


if __name__ == '__main__':
    seuls = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(ASTRES)
    for n in seuls:
        rendre(n, ASTRES[n])
