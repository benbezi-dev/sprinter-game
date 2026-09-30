# -----------------------------------------------------------------------
# SPRINTER — l'athlete de la planche de style, entier et habille pour plier.
#
# athlete-entree.glb (le coureur 3D du jeu) a un corps CREUX : la peau sous
# son t-shirt et son short a ete retiree, et ces deux habits, laches, ne
# suivent pas le corps quand la hanche se ferme. A la reception d'un saut
# en longueur, le short se vrillait et laissait voir les fesses, et le col
# du t-shirt se dechirait sur les epaules.
#
# On repart donc de la base d'origine (unity/AurelManga/Sculpt/
# Aurel_Base.blend) : le corps ENTIER, et le debardeur et le cuissard
# moulants de l'athlete. On les accroche au squelette du glb (memes os, aux
# memes places) : le corps par poids automatiques, les habits en recopiant
# les poids de la peau qu'ils couvrent — ils plient donc exactement comme
# elle. Du glb on garde le squelette, la texture de peau (visage, cheveux),
# les yeux et les pointes. Ni bandeau ni poignet.
#
#   Blender -b --factory-startup -P fabriquer_athlete.py
#
# Sortie : athlete-complet.blend, a cote de ce script (planche.py le lit).
# -----------------------------------------------------------------------

import bpy
import os
from mathutils.bvhtree import BVHTree

ICI = os.path.dirname(os.path.abspath(__file__))
GLB = os.path.join(ICI, 'athlete-entree.glb')
BASE = os.path.normpath(os.path.join(ICI, '..', '..', '..', 'unity', 'AurelManga', 'Sculpt',
                                     'Aurel_Base.blend'))
SORTIE = os.path.join(ICI, 'athlete-complet.blend')

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=GLB)
arm = bpy.data.objects['Coureur']
peau = bpy.data.materials['peau']
for nom in ('Corps', 'Tshirt', 'Short', 'Bandeau', 'Poignet', 'Icosphere'):
    o = bpy.data.objects.get(nom)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)

with bpy.data.libraries.load(BASE, link=False) as (src, dst):
    dst.objects = ['Corps', 'Debardeur', 'Cuissard']
corps, debardeur, cuissard = dst.objects
for o in (corps, debardeur, cuissard):
    sc.collection.objects.link(o)

# LE CORPS : la peau du glb (memes UV : le glb vient de ce maillage), et
# des poids automatiques sur le squelette du glb.
for m in list(corps.modifiers):
    corps.modifiers.remove(m)          # un Multires a zero niveau
corps.data.materials.clear()
corps.data.materials.append(peau)
for o in bpy.context.view_layer.objects:
    o.select_set(False)
corps.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
assert corps.vertex_groups, 'poids automatiques : aucun groupe cree'

# LES HABITS : chaque sommet prend les poids de la peau la plus proche,
# interpoles sur la face qu'il couvre.
poids = [{corps.vertex_groups[g.group].name: g.weight for g in v.groups}
         for v in corps.data.vertices]
arbre = BVHTree.FromPolygons([v.co for v in corps.data.vertices],
                             [tuple(p.vertices) for p in corps.data.polygons])
for habit, nom_mat, couleur in ((debardeur, 'maillot', (0.87, 0.55, 0.06, 1)),
                                (cuissard, 'short', (0.012, 0.018, 0.06, 1))):
    for v in habit.data.vertices:
        co, _, i, _ = arbre.find_nearest(v.co)
        ids = corps.data.polygons[i].vertices
        dist = [max(1e-5, (corps.data.vertices[k].co - co).length) for k in ids]
        tot = sum(1 / d for d in dist)
        w = {}
        for k, d in zip(ids, dist):
            for g, x in poids[k].items():
                w[g] = w.get(g, 0.0) + x * (1 / d) / tot
        for g, x in w.items():
            if x > 0.001:
                vg = habit.vertex_groups.get(g) or habit.vertex_groups.new(name=g)
                vg.add([v.index], x, 'REPLACE')
    habit.parent = arm
    md = habit.modifiers.new('squelette', 'ARMATURE')
    md.object = arm
    # le tissu, un rien au-dessus de la peau qu'il suit
    ec = habit.modifiers.new('ecart', 'DISPLACE')
    ec.mid_level = 0.0
    ec.strength = 0.002
    # et jamais sous elle : ou la peau deformee passe par-dessus le tissu (le
    # deltoide sur la bretelle quand le bras monte), le tissu remonte a sa
    # surface. Sans cela, il n'en restait qu'une pastille sur l'epaule.
    sw = habit.modifiers.new('dessus', 'SHRINKWRAP')
    sw.target = corps
    sw.wrap_method = 'NEAREST_SURFACEPOINT'
    # OUTSIDE : seuls les sommets passes SOUS la peau remontent. Le mode
    # OUTSIDE_SURFACE colle TOUT le tissu sur la peau : il la laissait voir
    # a travers, en resille.
    sw.wrap_mode = 'OUTSIDE'
    sw.offset = 0.003
    # sa matiere d'origine (trame, relief), renommee pour que la planche
    # puisse la teindre
    m = habit.data.materials[0].copy()
    m.name = nom_mat
    habit.data.materials[0] = m

# LA PEAU SOUS LE TISSU, rentree d'un centimetre. Le tissu a beau plier
# comme elle, deux surfaces a deux millimetres l'une de l'autre se croisent
# des que les poids varient vite (l'epaule, quand le bras part devant) : la
# peau percait le debardeur autour de l'emmanchure, et il n'en restait
# qu'une pastille jaune. Un sommet est sous le tissu si un rayon tire depuis
# lui, vers l'exterieur, le rencontre a moins de 3 cm.
arbres = []
for habit in (debardeur, cuissard):
    arbres.append(BVHTree.FromPolygons([v.co for v in habit.data.vertices],
                                       [tuple(p.vertices) for p in habit.data.polygons]))
rentres = 0
for v in corps.data.vertices:
    n = v.normal
    if any(t.ray_cast(v.co + n * 0.0005, n, 0.03)[0] is not None for t in arbres):
        v.co = v.co - n * 0.01
        rentres += 1
corps.data.update()
print('PEAU RENTREE', rentres, 'sommets')

bpy.ops.wm.save_as_mainfile(filepath=SORTIE)
print('ATHLETE', SORTIE, len(corps.vertex_groups), 'groupes')
