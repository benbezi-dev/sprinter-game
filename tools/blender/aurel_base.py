# -----------------------------------------------------------------------
# BASE DE SCULPTURE — un corps humain propre, cale sur Aurel Manga.
#
#   blender -b -P tools/blender/aurel_base.py -- \
#           [--hauteur 1.90] [--refs ref] [--enregistrer FICHIER.blend]
#           [--apercu DOSSIER]
#
# Le point de depart n'est plus un assemblage de spheres : c'est le maillage
# de base de MakeHuman (CC0, publie par l'equipe MakeHuman en 2020), un corps
# humain realiste de 13 000 quads, avec UV et reperes d'articulations. Ses
# « cibles » officielles (CC0 elles aussi) le transforment en homme jeune,
# muscle et sec, morphologie africaine ; quelques cibles de detail donnent la
# carrure d'un hurdleur (dos en V, jambes longues, ventre plat).
#
# Le script ajoute la scene de l'atelier (atelier_athlete.py) : references
# aux trois vues, metarig Rigify — cale cette fois sur les articulations du
# corps —, et les materiaux, poses sur la peau, le debardeur, le cuissard et
# la chaine. Il ne remplace pas la sculpture : il donne une silhouette juste
# et une topologie saine sur lesquelles sculpter au Multiresolution.
#
# Les fichiers MakeHuman sont telecharges une fois dans tools/blender/.makehuman
# (depuis le depot makehumancommunity/makehuman sur GitHub).
# -----------------------------------------------------------------------

import bpy
import bmesh
import importlib.util
import math
import os
import sys
import urllib.request

import numpy as np
from mathutils import Vector

ICI = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ICI, '.makehuman')
SOURCE = ('https://raw.githubusercontent.com/makehumancommunity/makehuman/'
          'master/makehuman/data/')

_spec = importlib.util.spec_from_file_location(
    'atelier_athlete', os.path.join(ICI, 'atelier_athlete.py'))
A = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(A)

HAUTEUR = 1.90

# Les poids des cibles macro suivent le calcul de MakeHuman : pour un curseur
# c dans [0, 1], la cible « max » pese (c - 0,5) x 2 et la moyenne le reste.
# Muscle 0,9 : max 0,8 / moyen 0,2. Poids 0,35 : min 0,3 / moyen 0,7.
# (universal-male-young-averagemuscle-averageweight est vide : c'est la base.)
MUSCLE_MAX, POIDS_MIN = 0.8, 0.3
CIBLES = {
    'macrodetails/universal-male-young-maxmuscle-averageweight':
        MUSCLE_MAX * (1 - POIDS_MIN),
    'macrodetails/universal-male-young-maxmuscle-minweight':
        MUSCLE_MAX * POIDS_MIN,
    'macrodetails/universal-male-young-averagemuscle-minweight':
        (1 - MUSCLE_MAX) * POIDS_MIN,
    'macrodetails/african-male-young': 1.0,
    # la carrure d'un hurdleur de 110 m haies
    'torso/torso-vshape-incr': 0.55,
    'measure/measure-shoulder-dist-incr': 0.35,
    'torso/torso-muscle-dorsi-incr': 0.5,
    'torso/torso-muscle-pectoral-incr': 0.35,
    'stomach/stomach-pregnant-decr': 0.6,
    'measure/measure-hips-circ-decr': 0.3,
    'buttocks/buttocks-volume-incr': 0.35,
    'measure/measure-upperleg-height-incr': 0.45,
    'measure/measure-lowerleg-height-incr': 0.3,
    'armslegs/l-lowerleg-muscle-incr': 0.45,
    'armslegs/r-lowerleg-muscle-incr': 0.45,
    'neck/neck-scale-horiz-incr': 0.3,
}


def arguments():
    global HAUTEUR
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    val = lambda k, d: a[a.index(k) + 1] if k in a else d
    HAUTEUR = float(val('--hauteur', HAUTEUR))
    A.HAUTEUR = HAUTEUR
    refs = val('--refs', '')
    if refs:
        # chemin absolu : l'enregistrement le rend relatif au .blend
        refs = os.path.abspath(refs)
        A.VUE_FACE = os.path.join(refs, 'face.png')
        A.VUE_PROFIL = os.path.join(refs, 'profil_droit.png')
        A.VUE_DOS = os.path.join(refs, 'dos.png')
    return val('--enregistrer', ''), val('--apercu', '')


# -----------------------------------------------------------------------
# 1. MAKEHUMAN : le maillage de base et ses cibles
# -----------------------------------------------------------------------

def fichier(rel):
    chemin = os.path.join(CACHE, rel)
    if not os.path.exists(chemin):
        os.makedirs(os.path.dirname(chemin), exist_ok=True)
        print('telechargement', rel)
        urllib.request.urlretrieve(SOURCE + rel, chemin)
    return chemin


def lire_obj(chemin):
    """Sommets, UV, et faces rangees par groupe (body, helper-*, joint-*)."""
    v, vt, groupes, g = [], [], {}, None
    with open(chemin) as f:
        for ligne in f:
            if ligne.startswith('v '):
                v.append([float(x) for x in ligne.split()[1:4]])
            elif ligne.startswith('vt '):
                vt.append([float(x) for x in ligne.split()[1:3]])
            elif ligne.startswith('g '):
                g = ligne.split()[1]
                groupes.setdefault(g, [])
            elif ligne.startswith('f '):
                coins = [c.split('/') for c in ligne.split()[1:]]
                groupes[g].append([(int(c[0]) - 1,
                                    int(c[1]) - 1 if len(c) > 1 and c[1] else -1)
                                   for c in coins])
    return np.array(v), np.array(vt), groupes


def appliquer_cibles(v):
    for rel, poids in CIBLES.items():
        if not poids:
            continue
        with open(fichier('targets/%s.target' % rel)) as f:
            for ligne in f:
                if ligne[:1] in '#\n' or not ligne.strip():
                    continue
                i, dx, dy, dz = ligne.split()
                v[int(i)] += poids * np.array([float(dx), float(dy), float(dz)])
    return v


def vers_blender(v):
    """MakeHuman : decimetres, Y en haut, regard vers +Z.
    Blender : metres, Z en haut, regard vers -Y (vue de face = Numpad 1)."""
    return np.stack([v[:, 0], -v[:, 2], v[:, 1]], axis=1) * 0.1


# -----------------------------------------------------------------------
# 2. LES OBJETS
# -----------------------------------------------------------------------

def maillage(nom, v, vt, faces):
    """Un objet a partir de faces du .obj (indices globaux), UV comprises."""
    utiles = sorted({i for fa in faces for i, _ in fa})
    carte = {g: k for k, g in enumerate(utiles)}
    me = bpy.data.meshes.new(nom)
    me.from_pydata([tuple(v[g]) for g in utiles], [],
                   [[carte[i] for i, _ in fa] for fa in faces])
    uv = me.uv_layers.new(name='UVMap')
    k = 0
    for fa in faces:
        for _, t in fa:
            if t >= 0:
                uv.data[k].uv = vt[t]
            k += 1
    me.validate()
    me.shade_smooth()
    ob = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def centres(v, groupes):
    """Le centre de chaque repere d'articulation (groupes joint-*)."""
    return {g[6:]: Vector(v[[i for fa in fs for i, _ in fa]].mean(axis=0))
            for g, fs in groupes.items() if g.startswith('joint-')}


def caler_metarig(mr, J, haut_crane):
    """Poser les os du metarig « basic human » sur les articulations."""
    bpy.context.view_layer.objects.active = mr
    bpy.ops.object.mode_set(mode='EDIT')
    eb = mr.data.edit_bones
    colonne = sorted((J['spine-%d' % i] for i in range(1, 5)), key=lambda p: p.z)

    def poser(nom, tete=None, queue=None):
        if nom not in eb:
            return
        b = eb[nom]
        if tete is not None:
            b.head = tete
        if queue is not None:
            b.tail = queue

    # colonne : bassin -> lombaires -> dorsales -> cou -> tete -> crane.
    # Quatre os de tronc pour quatre reperes : on saute l'avant-dernier.
    poser('spine', J['pelvis'], colonne[0])
    poser('spine.001', colonne[0], colonne[2])
    poser('spine.002', colonne[2], colonne[3])
    poser('spine.003', colonne[3], J['neck'])
    poser('spine.004', J['neck'], (J['neck'] + J['head']) / 2)
    poser('spine.005', (J['neck'] + J['head']) / 2, J['head'])
    poser('spine.006', J['head'], Vector((J['head'].x, J['head'].y, haut_crane)))
    for c, s in (('l', 'L'), ('r', 'R')):
        j = lambda n: J['%s-%s' % (c, n)]
        poser('shoulder.' + s, j('clavicle'), j('shoulder'))
        poser('upper_arm.' + s, j('shoulder'), j('elbow'))
        poser('forearm.' + s, j('elbow'), j('hand'))
        poser('hand.' + s, j('hand'), j('hand') + (j('hand-3') - j('hand')) * 1.6)
        poser('pelvis.' + s, J['pelvis'],
              Vector((j('upper-leg').x, j('upper-leg').y + 0.05, J['pelvis'].z + 0.06)))
        poser('thigh.' + s, j('upper-leg'), j('knee'))
        poser('shin.' + s, j('knee'), j('ankle'))
        orteils = j('toe-3-3')
        poser('foot.' + s, j('ankle'), j('foot-2'))
        poser('toe.' + s, j('foot-2'), Vector((orteils.x, orteils.y - 0.03, j('foot-2').z)))
        if 'heel.02.' + s in eb:
            h = eb['heel.02.' + s]
            larg = (h.tail - h.head).length
            h.head = Vector((j('ankle').x - larg / 2, j('ankle').y + 0.05, 0.0))
            h.tail = Vector((j('ankle').x + larg / 2, j('ankle').y + 0.05, 0.0))
    bpy.ops.object.mode_set(mode='OBJECT')


def segments(J):
    """Les os comme segments, pour classer chaque sommet par zone du corps."""
    col = sorted((J['spine-%d' % i] for i in range(1, 5)), key=lambda p: p.z)
    seg = [('tronc', J['pelvis'], col[0]), ('tronc', col[0], col[1]),
           ('tronc', col[1], col[2]), ('tronc', col[2], J['neck']),
           ('cou', J['neck'], J['head']), ('tete', J['head'], J['head-2'])]
    for c in 'lr':
        j = lambda n: J['%s-%s' % (c, n)]
        seg += [('epaule', j('clavicle'), j('shoulder')),
                ('bras', j('shoulder'), j('elbow')),
                ('bras', j('elbow'), j('hand')),
                ('main', j('hand'), j('hand-3')),
                ('hanche', J['pelvis'], j('upper-leg')),
                ('cuisse', j('upper-leg'), j('knee')),
                ('jambe', j('knee'), j('ankle')),
                ('pied', j('ankle'), j('foot-2'))]
    return seg


def zone(p, seg):
    meilleur, nom = 1e9, ''
    for n, a, b in seg:
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
        d = (p - (a + ab * t)).length
        if d < meilleur:
            meilleur, nom = d, n
    return nom


def lisser_bords(bm, corps, passes=12):
    """Adoucir les bords decoupes (encolure, emmanchures, ourlets).

    La selection suit les sommets du corps : les bords sortent en marches
    d'escalier. Chaque sommet de bord glisse vers le milieu de ses deux
    voisins de bord, puis est reposé sur la peau."""
    from mathutils.bvhtree import BVHTree
    arbre = BVHTree.FromObject(corps, bpy.context.evaluated_depsgraph_get())
    for _ in range(passes):
        bord = {}
        for e in bm.edges:
            if e.is_boundary:
                a, b = e.verts
                bord.setdefault(a, []).append(b)
                bord.setdefault(b, []).append(a)
        nouveau = {v: (n[0].co + n[1].co) / 2 for v, n in bord.items() if len(n) == 2}
        for v, p in nouveau.items():
            proche = arbre.find_nearest(v.co * 0.5 + p * 0.5)[0]
            if proche is not None:
                v.co = proche


def vetement(corps, nom, garder, ecart, epaisseur, mat):
    """Une copie des faces choisies, decollee de la peau et epaissie."""
    ob = corps.copy()
    ob.data = corps.data.copy()
    ob.name = ob.data.name = nom
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    # une face reste si presque tous ses sommets sont dedans : le maillage
    # est trop large par endroits pour exiger les quatre
    a_jeter = [f for f in bm.faces
               if sum(garder[v.index] for v in f.verts) < len(f.verts) - 1]
    bmesh.ops.delete(bm, geom=a_jeter, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    lisser_bords(bm, corps)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * ecart
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    s = ob.modifiers.new('Epaisseur', 'SOLIDIFY')
    s.thickness = epaisseur
    s.offset = 1.0
    ob.modifiers.new('Lissage', 'SUBSURF').levels = 1
    return ob


def habiller(corps, J, mats):
    peau, debardeur, cuissard, chaine = mats
    seg = segments(J)
    v = [corps.matrix_world @ p.co for p in corps.data.vertices]
    z = lambda n: J[n].z
    taille = z('pelvis') + 0.10 * HAUTEUR          # le haut du cuissard
    bas_debardeur = taille - 0.035
    genou = (z('l-knee') + z('r-knee')) / 2
    hanche = (z('l-upper-leg') + z('r-upper-leg')) / 2
    bas_cuissard = genou + 0.42 * (hanche - genou)
    clav = max(abs(J['l-clavicle'].x), abs(J['r-clavicle'].x))
    epau = max(abs(J['l-shoulder'].x), abs(J['r-shoulder'].x))
    col_z, col_y = z('neck'), J['neck'].y
    # le corps est symetrique : on classe chaque sommet sur son reflet du cote
    # gauche, pour que les deux cotes des vetements soient identiques
    sg = 1.0 if J['l-shoulder'].x > 0 else -1.0
    seg_g = [(n, a, b) for n, a, b in seg if a.x * sg > -0.01 and b.x * sg > -0.01]
    zones = [zone(Vector((sg * abs(p.x), p.y, p.z)), seg_g) for p in v]

    zc = (z('l-clavicle') + z('r-clavicle')) / 2
    aisselle = (z('l-shoulder') + z('r-shoulder')) / 2 - 0.13
    bretelle = clav + 0.45 * (epau - clav)     # bord exterieur des bretelles
    emmanchure = epau - 0.035                  # au-dela, c'est le bras
    sommet = zc + 0.045                        # le haut des bretelles
    demi_cou = 0.05

    def haut(i):
        p, zn = v[i], zones[i]
        if p.z < bas_debardeur or p.z > sommet:
            return False
        if p.z < aisselle:
            return zn in ('tronc', 'epaule', 'hanche')
        if zn not in ('tronc', 'epaule', 'hanche', 'cou'):
            return False
        # l'emmanchure s'ouvre des bretelles (en haut) jusqu'a l'aisselle
        t = (sommet - p.z) / (sommet - aisselle)
        if abs(p.x) > bretelle + (emmanchure - bretelle) * t ** 0.6:
            return False
        # l'encolure, echancree devant, plus haute derriere
        if abs(p.x) < demi_cou:
            return p.z < zc - (0.075 if p.y < col_y else 0.015)
        return True

    def short(i):
        p, zn = v[i], zones[i]
        return zn in ('tronc', 'hanche', 'cuisse') and bas_cuissard < p.z < taille

    vetement(corps, 'Debardeur', [haut(i) for i in range(len(v))], 0.004, 0.0015, debardeur)
    vetement(corps, 'Cuissard', [short(i) for i in range(len(v))], 0.0025, 0.0012, cuissard)
    corps.data.materials.append(peau)

    # la chaine en or : un anneau a la base du cou, plus bas devant, pose
    # sur la peau par un Shrinkwrap
    bpy.ops.curve.primitive_bezier_circle_add(
        radius=0.05, location=(J['neck'].x, J['neck'].y - 0.01, zc + 0.03))
    c = bpy.context.active_object
    c.name = 'Chaine'
    c.rotation_euler = (math.radians(-32), 0, 0)
    c.data.resolution_u = 24
    c.data.bevel_depth = 0.0014
    c.data.bevel_resolution = 2
    c.data.materials.append(chaine)
    w = c.modifiers.new('Sur la peau', 'SHRINKWRAP')
    w.target = corps
    w.wrap_method = 'NEAREST_SURFACEPOINT'
    w.wrap_mode = 'OUTSIDE_SURFACE'
    w.offset = 0.0035


def yeux(v, vt, groupes, mat):
    ob = maillage('Yeux', v, vt, groupes['helper-l-eye'] + groupes['helper-r-eye'])
    ob.data.materials.append(mat)
    return ob


def materiau_yeux():
    m, _, b = A.nouveau('Eye_Material')
    b.inputs['Base Color'].default_value = (0.02, 0.012, 0.008, 1)
    b.inputs['Roughness'].default_value = 0.05
    b.inputs['Coat Weight'].default_value = 1.0
    return m


# -----------------------------------------------------------------------
# 3. APERCU
# -----------------------------------------------------------------------

def apercu(dossier):
    os.makedirs(dossier, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 720, 1080
    for o in bpy.data.collections['References'].objects:
        o.hide_render = True
    w = bpy.data.worlds.new('Studio')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.57, 0.6, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.5
    sc.world = w
    for nom, pos, e in (('Cle', (-2.5, -3.0, 3.2), 900), ('Contre', (2.8, 2.5, 2.8), 600),
                        ('Remplissage', (3.0, -2.0, 1.2), 250)):
        l = bpy.data.lights.new(nom, 'AREA')
        l.energy, l.size = e, 2.0
        lo = bpy.data.objects.new(nom, l)
        lo.location = pos
        lo.rotation_euler = (Vector((0, 0, 1.1)) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        sc.collection.objects.link(lo)
    cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
    cam.data.lens = 85
    sc.collection.objects.link(cam)
    sc.camera = cam
    cible = Vector((0, 0, HAUTEUR * 0.52))
    for nom, angle, dist, cib in (('face', 0, 7.6, cible), ('profil', 90, 7.6, cible),
                                  ('trois-quarts', 35, 7.6, cible), ('dos', 180, 7.6, cible),
                                  ('buste', 20, 2.6, Vector((0, 0, HAUTEUR * 0.84)))):
        a = math.radians(angle)
        cam.location = cib + Vector((math.sin(a) * dist, -math.cos(a) * dist, 0.1))
        cam.rotation_euler = (cib - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(os.path.abspath(dossier), nom + '.png')
        bpy.ops.render.render(write_still=True)
    # l'apercu ne reste pas dans le fichier de travail
    for o in [cam] + [o for o in sc.collection.objects if o.type == 'LIGHT']:
        bpy.data.objects.remove(o, do_unlink=True)


# -----------------------------------------------------------------------

def main():
    enregistrer, dossier_apercu = arguments()
    A.nettoyer()
    A.unites()
    A.references()

    v, vt, groupes = lire_obj(fichier('3dobjs/base.obj'))
    v = vers_blender(appliquer_cibles(v))
    corps_idx = sorted({i for fa in groupes['body'] for i, _ in fa})
    sol = v[corps_idx, 2].min()
    k = HAUTEUR / (v[corps_idx, 2].max() - sol)
    v = (v - np.array([0, 0, sol])) * k
    J = centres(v, groupes)

    corps = maillage('Corps', v, vt, groupes['body'])
    mats = [A.peau(), A.debardeur(), A.cuissard(), A.chaine()]
    habiller(corps, J, mats)
    yeux(v, vt, groupes, materiau_yeux())

    mr = A.armature()
    caler_metarig(mr, J, float(v[corps_idx, 2].max()))
    mr.hide_set(True)          # on sculpte sans lui ; il reservira au rig

    # pret a sculpter : Multiresolution sur le corps (subdiviser a la main)
    corps.modifiers.new('Multires', 'MULTIRES')
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = corps
    corps.select_set(True)
    corps.data.use_mirror_x = True

    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.view_settings.view_transform = 'AgX'
    print('base prete : %d sommets, %.2f m' % (len(corps.data.vertices), HAUTEUR))
    if dossier_apercu:
        apercu(dossier_apercu)
    if enregistrer:
        chemin = os.path.abspath(enregistrer)
        os.makedirs(os.path.dirname(chemin), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=chemin, relative_remap=True, compress=True)
        if os.path.exists(chemin + '1'):
            os.remove(chemin + '1')     # la copie de secours de Blender
        print('enregistre :', chemin)


if __name__ == '__main__':
    main()
