# -----------------------------------------------------------------------
# SPRINTER — Meba-Mickael Zeze en VRAI MAILLAGE, d'un seul tenant.
#
#   blender -b -P tools/blender/meba_maillage.py -- [--glb public/vedettes/meba.glb]
#                                                   [--blend FICHIER.blend]
#
# (ou, dans un Blender ouvert : exec(open(".../meba_maillage.py").read()) ;
#  la scene « Meba » est reconstruite, les autres ne sont pas touchees.)
#
# POURQUOI UN MAILLAGE, ET PAS LES TUBES. Le moteur dessine chaque coureur en
# troncs de cone, un par morceau de membre : c'est ce qui en fait courir huit
# dans un virage, et c'est aussi pourquoi, de pres, un corps s'y lit comme un
# assemblage — epaulettes, genoux en deux cylindres, fessiers en tube. Le
# skin premium de l'evenement doit etre un corps : une seule peau, qui plie
# aux articulations. Il est rendu en WebGL par le jeu (game/vedette-3d.ts) et
# pose dans l'image a sa place ; les tubes restent sa doublure.
#
# LE CORPS EST CELUI DE MAKEHUMAN (MPFB, CC0), aux reglages d'un sprinteur
# noir de 25 ans, tres muscle et sec. Ses proportions tombent deja pres de
# celles du rig du jeu (cuisse 0,393 contre 0,392, bras 0,241 contre 0,250,
# hanche-epaule 0,454 contre 0,470). On le CALE quand meme exactement sur le
# rig : chaque os est oriente et allonge jusqu'aux articulations de pose(),
# puis cette pose devient sa pose de repos. Sans ce calage, les mains ne
# toucheraient plus la ligne dans les blocs, ni l'une l'autre au clap — pose()
# calcule ses gestes avec SES longueurs.
#
# LE REPERE EST CELUI DU JEU : x vers l'avant, y vers la GAUCHE du coureur,
# z en haut, en unites du rig (un coureur de C.MODEL_H = 1,72 m). Le jeu le
# met a la taille de l'athlete (1,77 m) au rendu.
# -----------------------------------------------------------------------

import bpy
import math
import os
import sys
from mathutils import Vector, Matrix, Quaternion

# --- LE RIG DU JEU (pose(), sprinter-core.js), au repos ------------------
HIP_Z = 0.87            # le bassin
LEGHIP_Z = 0.85         # pivot des cuisses (hanche - 0,02)
KNEE_Z = 0.458
ANKLE_Z = 0.078
SHOULDER_DZ = 0.470     # hanche -> epaule, le long du buste
UPPER = 0.250           # epaule -> coude
FORE = 0.200            # coude -> poignet (POIGNET)
FIST = 0.291            # coude -> bout du poing (DOIGTS)
NECK_DZ = 0.52          # hanche -> base du cou
CARRURE = 1.02          # morph.sh du look, et `carrure` d'anatomie.py
SH_Y = 0.154 * CARRURE  # demi-ecart des epaules
HIP_Y = 0.082           # demi-ecart des hanches

# Le corps : MakeHuman, en macro-reglages.
MACRO = {'gender': 1.0, 'age': 0.5, 'muscle': 1.0, 'weight': 0.48,
         'proportions': 0.9, 'height': 0.55, 'cupsize': 0.5, 'firmness': 0.5,
         'race': {'asian': 0.0, 'caucasian': 0.0, 'african': 1.0}}

# SA SILHOUETTE, par-dessus les macros : releve sur ses videos torse nu
# (mise en place dans les blocs, lignes droites). Un premier relayeur compact
# et tres sec : poitrine et dorsaux larges, epaules rondes, taille pincee, et
# la masse EN BAS — fessiers qui debordent, quadriceps pleins jusqu'au genou,
# mollet haut. Chaque cible est une cible officielle de MakeHuman (CC0), a
# son poids.
CIBLES = {
    'torso-muscle-pectoral-incr': 0.75, 'torso-muscle-dorsi-incr': 0.65,
    'torso-vshape-incr': 0.55, 'measure-waist-circ-decr': 0.45,
    'stomach-pregnant-decr': 0.35,
    'l-upperarm-muscle-incr': 0.70, 'r-upperarm-muscle-incr': 0.70,
    'l-upperarm-shoulder-muscle-incr': 0.80, 'r-upperarm-shoulder-muscle-incr': 0.80,
    'l-lowerarm-muscle-incr': 0.50, 'r-lowerarm-muscle-incr': 0.50,
    'l-upperleg-muscle-incr': 0.85, 'r-upperleg-muscle-incr': 0.85,
    'l-lowerleg-muscle-incr': 0.65, 'r-lowerleg-muscle-incr': 0.65,
    'buttocks-volume-incr': 0.60,
    'measure-neck-circ-incr': 0.45,
    'head-square': 0.40,
}

SCENE = "Meba"


def arguments():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    val = lambda k: a[a.index(k) + 1] if k in a else None
    return {'glb': val('--glb'), 'blend': val('--blend')}


def scene_neuve():
    sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    if bpy.context.window:
        bpy.context.window.scene = sc
    for o in list(sc.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    if hasattr(sc, 'blendermcp_use_polyhaven'):
        sc.blendermcp_use_polyhaven = True
    return sc


def humain():
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
    # PAS « PIEDS AU SOL ». MPFB poserait alors le corps 0,82 m plus haut que
    # le rig qu'il lui ajoute ensuite : au repos rien ne se voit, mais au
    # premier os tourne la peau pivote autour d'une articulation qui n'est
    # pas la sienne. Le sol, c'est mise_en_repere() qui le pose.
    h = HumanService.create_human(mask_helpers=True, detailed_helpers=False,
                                  extra_vertex_groups=True, feet_on_ground=False,
                                  scale=0.1, macro_detail_dict=MACRO)
    h.name = "Meba_corps"
    # LE RIG EST RECALE SUR LE CORPS QU'ON VOIT. Taille, muscle, proportions :
    # MakeHuman les pose en cles de forme par-dessus un corps de base, et MPFB
    # ajuste son rig sur ce corps de BASE — vingt centimetres sous la tete
    # reelle, les bras dans la poitrine. `refit` le recale sur la forme
    # courante ; ensuite seulement les cibles sont cuites dans le maillage.
    from bl_ext.blender_org.mpfb.services.targetservice import TargetService
    for nom, poids in CIBLES.items():
        TargetService.load_target(h, TargetService.target_full_path(nom), weight=poids)
    rig = HumanService.add_builtin_rig(h, "game_engine", import_weights=True)
    TargetService.bake_targets(h)
    recaler_repos(rig, h)
    rig.name = "Meba_rig"
    return h, rig


# --- LE REPOS DU RIG, LU SUR LA PEAU ---------------------------------------
# MPFB ajuste son rig sur le corps de BASE de MakeHuman ; ni `refit` ni
# `refit_existing_armature` ne voient la forme reglee (muscle, taille,
# proportions). Les os tombaient treize a vingt pour cent trop petits et trop
# bas : genou 8,5 cm sous le pli du genou, epaule 21 cm sous l'epaule. Une
# articulation se lit pourtant sur la peau : c'est la ou la ponderation passe
# d'un os a son parent, moitie-moitie. On la mesure la, pour chaque jointure.

JOINTURES = [('thigh', 'pelvis'), ('calf', 'thigh'), ('foot', 'calf'),
             ('clavicle', 'spine_03'), ('upperarm', 'clavicle'),
             ('lowerarm', 'upperarm'), ('hand', 'lowerarm'),
             ('spine_01', 'pelvis'), ('spine_02', 'spine_01'),
             ('spine_03', 'spine_02'), ('neck_01', 'spine_03'),
             ('head', 'neck_01')]


def jointures_de_la_peau(h):
    gi = {g.name: g.index for g in h.vertex_groups}
    poids = [{g.group: g.weight for g in v.groups} for v in h.data.vertices]
    out = {}
    for e, p in JOINTURES:
        cotes = ('_l', '_r') if e in ('thigh', 'calf', 'foot', 'clavicle', 'upperarm', 'lowerarm', 'hand') else ('',)
        for c in cotes:
            en, pa = e + c, (p + c if p not in ('pelvis', 'spine_03') else p)
            a, b = gi.get(en), gi.get(pa)
            if a is None or b is None:
                continue
            pts = [h.data.vertices[i].co for i, w in enumerate(poids)
                   if 0.25 < w.get(a, 0) < 0.75 and 0.25 < w.get(b, 0) < 0.75]
            if len(pts) >= 12:
                out[en] = sum(pts, Vector()) / len(pts)
    return out


def recaler_repos(rig, h):
    import numpy as np
    J = jointures_de_la_peau(h)
    bones = rig.data.bones
    src = np.array([list(bones[n].head_local) + [1.0] for n in J])
    dst = np.array([list(J[n]) for n in J])
    A, *_ = np.linalg.lstsq(src, dst, rcond=None)      # 4 x 3 : affine
    aff = lambda v: Vector(list(np.array(list(v) + [1.0]) @ A))
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    for b in eb:
        b.head, b.tail = aff(b.head), aff(b.tail)
    # puis chaque jointure mesuree exactement, la queue du parent avec elle
    for n, P in J.items():
        b = eb[n]
        d = b.tail - b.head
        b.head = P
        b.tail = P + d
    # et un os de chaine va jusqu'a la jointure suivante
    SUITE = {'thigh': 'calf', 'calf': 'foot', 'clavicle': 'upperarm',
             'upperarm': 'lowerarm', 'lowerarm': 'hand',
             'spine_01': 'spine_02', 'spine_02': 'spine_03', 'neck_01': 'head'}
    for n in J:
        base, c = (n[:-2], n[-2:]) if n[-2:] in ('_l', '_r') else (n, '')
        suite = SUITE.get(base)
        if suite and (suite + c) in J:
            eb[n].tail = J[suite + c]
    bpy.ops.object.mode_set(mode='OBJECT')
    return J


# --- LES CIBLES : ou chaque os doit aller, dans le repere du jeu ----------
def cibles(rig):
    """Tete et queue voulues de chaque os, au repos du jeu (membres droits).

    LE BUSTE GARDE SES VERTEBRES. Le dernier os du dos de MakeHuman ne couvre
    que le bas de la cage thoracique, mais sa peau monte jusqu'aux epaules :
    l'allonger jusqu'a la base du cou etirait le haut du corps d'une fois et
    demie. Le buste est donc mis a l'echelle d'UN SEUL facteur, autour de la
    hanche, pour que la base du cou tombe a celle du jeu ; la tete suit sans
    changer de taille. Seuls les membres et les epaules sont recales os par os.
    """
    b = rig.data.bones
    P0 = (b['thigh_l'].head_local + b['thigh_r'].head_local) / 2
    P0 = Vector((0, 0, P0.z))
    cou = b['neck_01'].head_local
    f = (HIP_Z + NECK_DZ - LEGHIP_Z) / (cou.z - P0.z)
    haut = lambda v: Vector((0, 0, LEGHIP_Z)) + (Vector((v.x * 0, v.y * 0, v.z)) - P0) * f
    C = {}
    for n in ('pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01'):
        C[n] = (haut(b[n].head_local), haut(b[n].tail_local))
    # LE BASSIN TOURNE SUR L'AXE DES HANCHES. Dans pose(), les pivots des
    # cuisses ne dependent pas du bassin : le coucher (dans les blocs, au-dessus
    # d'une haie) ne deplace aucune jambe. Ici les cuisses sont ses enfants ; sa
    # tete est donc posee exactement sur l'axe qui joint les deux hanches, et le
    # tourner autour de cet axe laisse les cuisses ou elles sont.
    C['pelvis'] = (Vector((0, 0, LEGHIP_Z)), C['pelvis'][1])
    hd = C['neck_01'][1]
    C['head'] = (hd, hd + (b['head'].tail_local - b['head'].head_local).length * Vector((0, 0, 1)))
    for s, cote in ((1, 'l'), (-1, 'r')):
        S = Vector((0, s * SH_Y, HIP_Z + SHOULDER_DZ))
        cl = b['clavicle_' + cote]
        # la clavicule part d'ou elle est, pres du sternum, et va a l'epaule du jeu
        C['clavicle_' + cote] = (haut(cl.head_local) + Vector((0, cl.head_local.y, 0)), S)
        E = S + Vector((0, 0, -UPPER))
        W = E + Vector((0, 0, -FORE))
        C['upperarm_' + cote] = (S, E)
        C['lowerarm_' + cote] = (E, W)
        C['hand_' + cote] = (W, E + Vector((0, 0, -FIST)))
        Hh = Vector((0, s * HIP_Y, LEGHIP_Z))
        K = Vector((0, s * HIP_Y, KNEE_Z))
        A = Vector((0, s * HIP_Y, ANKLE_Z))
        C['thigh_' + cote] = (Hh, K)
        C['calf_' + cote] = (K, A)
        # le pied, a plat vers l'avant, jusqu'aux metatarses
        C['foot_' + cote] = (A, A + Vector((0.13, 0, -0.05)))
    return C


def mise_en_repere(h, rig):
    """Le coureur regarde +x, sa gauche en +y, les pieds au sol, a l'echelle du rig."""
    # MakeHuman regarde -y, sa gauche en +x : un quart de tour autour de z.
    rot = Matrix.Rotation(math.radians(90), 4, 'Z')
    W = rot @ rig.matrix_world
    b = rig.data.bones
    hanche = (W @ b['thigh_l'].head_local + W @ b['thigh_r'].head_local) / 2
    cheville = (W @ b['calf_l'].tail_local + W @ b['calf_r'].tail_local) / 2
    k = (LEGHIP_Z - ANKLE_Z) / (hanche.z - cheville.z)
    M = Matrix.Scale(k, 4)
    # hanches a LEGHIP_Z, a l'aplomb de l'origine
    p = M @ hanche
    T = Matrix.Translation(Vector((-p.x, -p.y, LEGHIP_Z - p.z)))
    # LA MISE EN REPERE EST CUITE DANS LES DEUX OBJETS. MPFB fait du corps
    # l'enfant de son rig : deplacer le rig deplacait le corps par la parente
    # ET par le modificateur d'armature, et la peau se retrouvait a deux metres
    # soixante-dix quand les os, eux, etaient justes. On detache le corps, on
    # applique la meme transformation aux deux, et plus rien n'herite de rien.
    F = T @ M @ rot
    mw_h = h.matrix_world.copy()
    h.parent = None
    h.matrix_world = F @ mw_h
    rig.matrix_world = F @ rig.matrix_world
    bpy.context.view_layer.update()
    for o in (rig, h):
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for m in h.modifiers:
        if m.type == 'ARMATURE':
            m.object = rig
    bpy.context.view_layer.update()
    return k


def profondeur(b):
    n = 0
    while b.parent:
        b, n = b.parent, n + 1
    return n


def caler(rig, C):
    """Chaque os cale sur sa cible : tourne, s'allonge, et sa tete s'y pose.

    L'echelle ne descend pas aux enfants pendant le calage (inherit_scale), sans
    quoi l'avant-bras d'un bras allonge serait etire deux fois. Une fois la pose
    appliquee comme repos, l'heritage revient.
    """
    Winv = rig.matrix_world.inverted()
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    herite = {b.name: b.inherit_scale for b in rig.data.bones}
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    for b in rig.data.bones:
        b.inherit_scale = 'NONE'
    for pb in sorted(rig.pose.bones, key=lambda p: profondeur(p.bone)):
        if pb.name not in C:
            continue
        h_w, t_w = C[pb.name]
        h, t = Winv @ h_w, Winv @ t_w
        rest = pb.bone.matrix_local
        y0 = rest.col[1].xyz.normalized()
        d = t - h
        q = y0.rotation_difference(d.normalized())
        R = q.to_matrix() @ rest.to_3x3()
        # La main s'oriente sans s'allonger : chez MakeHuman, l'os « hand » est
        # la paume (trois centimetres), et les doigts en partent. L'allonger
        # jusqu'au bout du poing du jeu etirait les doigts jusqu'au sol.
        if not pb.name.startswith('hand_'):
            R = R @ Matrix.Diagonal((1.0, d.length / pb.bone.length, 1.0))
        M = R.to_4x4()
        M.translation = h
        pb.matrix = M
        bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')
    return herite


def figer(h, rig, herite):
    """La pose calee devient le repos : le maillage est cuit, le rig repart a zero."""
    bpy.context.view_layer.objects.active = h
    for m in list(h.modifiers):
        if m.type in ('MASK', 'ARMATURE'):
            bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    for b in rig.data.bones:
        b.inherit_scale = herite.get(b.name, 'FULL')
    mod = h.modifiers.new("Armature", 'ARMATURE')
    mod.object = rig


# --- UNE POSE DU JEU, APPLIQUEE AUX OS -------------------------------------
# La meme convention que pose() : un angle absolu dans le plan de course, 0 le
# membre vers le bas (le buste vers le haut), positif vers l'avant ; puis le
# roulis autour de l'axe de course, puis le lacet autour de la verticale.
# C'est exactement ce que fera game/vedette-3d.ts avec les angles du moteur.

def orientation_du_jeu(a, roule=0.0, lacet=0.0):
    return (Matrix.Rotation(lacet, 3, 'Z') @ Matrix.Rotation(roule, 3, 'X')
            @ Matrix.Rotation(-a, 3, 'Y'))


def poser(rig, angles, hanche=(0.0, 0.0, 0.0)):
    """angles : {os: (a, roule, lacet)} ; les autres gardent leur orientation de repos.

    Chaque os recoit une orientation MONDE (rotation du jeu x orientation de
    repos), convertie en rotation locale sous son parent : les positions
    suivent la hierarchie, avec les longueurs du jeu puisque le repos y est cale.
    """
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    for pb in sorted(rig.pose.bones, key=lambda p: profondeur(p.bone)):
        rest = pb.bone.matrix_local
        if pb.name in angles:
            a, r, y = angles[pb.name]
            R = orientation_du_jeu(a, r, y) @ rest.to_3x3()
        elif pb.parent is not None:
            # l'os suit son parent, comme au repos
            Rp = pb.parent.matrix.to_3x3() @ pb.parent.bone.matrix_local.to_3x3().inverted()
            R = Rp @ rest.to_3x3()
        else:
            continue
        M = R.to_4x4()
        if pb.parent is None or pb.name == 'pelvis':
            M.translation = rest.translation + Vector(hanche)
        else:
            M.translation = (pb.parent.matrix @ (pb.parent.bone.matrix_local.inverted() @ rest.translation.to_4d())).to_3d()
        pb.matrix = M
        bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')


def corps():
    """Toute la chaine du corps : humain, repere, calage, repos fige."""
    sc = scene_neuve()
    h, rig = humain()
    mise_en_repere(h, rig)
    herite = caler(rig, cibles(rig))
    figer(h, rig, {b.name: 'FULL' for b in rig.data.bones})
    return sc, h, rig


# --- LES COQUES : maillot, short, pointes, bandeau, barbe -----------------
# Pas des couleurs peintes sur la peau : des pieces a elles, decoupees dans le
# maillage du corps et decollees de quelques millimetres. Elles gardent les
# ponderations du corps (on duplique ses faces), donc elles plient avec lui ;
# et leurs bords sont de vrais ourlets, qu'on voit.

# Les groupes de MakeHuman (« Left », « Right », « Mid », « body »...) pesent 1
# partout ; seuls comptent ceux qui portent le nom d'un os.
GROUPES_HORS_OS = {'Left', 'Right', 'Mid', 'body', 'HelperGeometry', 'JointCubes',
                   'nippleTip', 'nipple', 'lips', 'fingernails', 'toenails',
                   'ears', 'scalp', 'genitals'}


def poids_dominant(h):
    noms = {g.index: g.name for g in h.vertex_groups}
    dom = []
    for v in h.data.vertices:
        gs = [g for g in v.groups if noms[g.group] not in GROUPES_HORS_OS]
        tous = {noms[x.group]: x.weight for x in v.groups}
        if gs:
            g = max(gs, key=lambda g: g.weight)
            dom.append((noms[g.group], g.weight, tous))
        else:
            dom.append((None, 0.0, tous))
    return dom


def coque(h, rig, nom, garder, epaisseur, couleur, rugosite=0.6, metal=0.0):
    """Une coque : les faces du corps que `garder(centre, normale, poids)` retient."""
    import bmesh
    dom = poids_dominant(h)
    me = h.data.copy()
    o = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(o)
    o.matrix_world = h.matrix_world.copy()
    for g in h.vertex_groups:
        o.vertex_groups.new(name=g.name)
    # les groupes sont portes par le maillage copie ; on les re-ecrit par nom
    bm = bmesh.new(); bm.from_mesh(me)
    bm.faces.ensure_lookup_table(); bm.verts.ensure_lookup_table()
    tuer = []
    for f in bm.faces:
        c = f.calc_center_median()
        poids = {}
        for v in f.verts:
            for k, w in dom[v.index][2].items():
                poids[k] = max(poids.get(k, 0.0), w)
        if not garder(c, f.normal, poids):
            tuer.append(f)
    bmesh.ops.delete(bm, geom=tuer, context='FACES')
    ilots(bm)
    ourlet(bm, h)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * epaisseur
    bm.to_mesh(me); bm.free()
    me.materials.clear()
    me.materials.append(materiau(nom, couleur, rugosite, metal))
    for p in me.polygons:
        p.use_smooth = True
    mod = o.modifiers.new("Armature", 'ARMATURE'); mod.object = rig
    return o


def ilots(bm, garde=0.12):
    """Retirer les franges : les morceaux detaches, plus petits que `garde`
    fois le plus grand. Une piece est d'un seul tenant — sauf les pointes et le
    short, qui en ont deux, d'ou la part relative plutot qu'un seul morceau."""
    import bmesh
    vus, parts = set(), []
    for f in bm.faces:
        if f in vus:
            continue
        pile, part = [f], []
        vus.add(f)
        while pile:
            g = pile.pop(); part.append(g)
            for e in g.edges:
                for k in e.link_faces:
                    if k not in vus:
                        vus.add(k); pile.append(k)
        parts.append(part)
    if not parts:
        return
    grand = max(len(x) for x in parts)
    tuer = [f for x in parts if len(x) < garde * grand for f in x]
    # et les faces qui ne tiennent que par un coin
    tuer += [f for f in bm.faces if all(e.is_boundary for e in f.edges)]
    bmesh.ops.delete(bm, geom=list(set(tuer)), context='FACES')


def ourlet(bm, h, passes=14):
    """Un bord de piece suit les faces du maillage : un escalier. On le lisse.

    Chaque sommet du bord glisse vers le milieu de ses deux voisins DE BORD
    (pas vers l'interieur de la piece), puis revient se poser sur la peau :
    l'escalier devient une courbe, et la courbe reste collee au corps.
    """
    from mathutils.bvhtree import BVHTree
    arbre = BVHTree.FromPolygons([v.co.copy() for v in h.data.vertices],
                                 [tuple(p.vertices) for p in h.data.polygons])
    bord = [v for v in bm.verts if v.is_boundary]
    voisins = {}
    for v in bord:
        voisins[v] = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
    for _ in range(passes):
        nouv = {}
        for v in bord:
            vs = voisins[v]
            if len(vs) == 2:
                nouv[v] = v.co * 0.4 + (vs[0].co + vs[1].co) * 0.3
        for v, c in nouv.items():
            loc = arbre.find_nearest(c)[0]
            v.co = loc if loc is not None else c


def materiau(nom, couleur, rugosite=0.6, metal=0.0):
    m = bpy.data.materials.get(nom) or bpy.data.materials.new(nom)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*[srgb_vers_lin(c / 255) for c in couleur], 1.0)
    bsdf.inputs['Roughness'].default_value = rugosite
    bsdf.inputs['Metallic'].default_value = metal
    return m


def srgb_vers_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


# Les couleurs sont celles du look du jeu (VEDETTES, sprinter-core.js).
PEAU = (96, 58, 44)
MAILLOT = (242, 244, 248)
SHORT = (30, 44, 110)
POINTES = (214, 240, 44)
SEMELLE = (236, 236, 232)
BANDEAU = (30, 30, 34)
BARBE = (36, 26, 24)
CHEVEU = (30, 24, 22)
MECHES = (196, 160, 104)
OR = (226, 184, 72)


def habiller(h, rig):
    """Les pieces de la tenue et du visage, chacune a sa coque."""
    p = lambda d, *n: max((d.get(k, 0.0) for k in n), default=0.0)
    bras = ('upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r')
    doigts = lambda d: any(k.split('_')[0] in ('thumb', 'index', 'middle', 'ring', 'pinky') and w > 0.2 for k, w in d.items())

    # LE DEBARDEUR DE L'EQUIPE DE FRANCE : du bas des cotes au haut des
    # epaules, echancre devant et derriere, emmanchures larges de sprinteur,
    # bretelles au ras du cou. Il descend sur le haut du short.
    def maillot(c, n, d):
        if not (0.942 < c.z < 1.405): return False
        if p(d, *bras) > 0.35 or p(d, 'neck_01', 'head') > 0.3: return False
        if c.x > 0.0 and c.z > 1.30 and abs(c.y) < 0.075: return False     # encolure
        if c.x < 0.0 and c.z > 1.355 and abs(c.y) < 0.06: return False     # dos
        # LES BRETELLES : une bande sur le trapeze, du cou vers l'epaule,
        # que rien d'autre n'echancre
        if c.z > 1.285 and 0.058 < abs(c.y) < 0.112 and p(d, *bras) < 0.3:
            return True
        # l'emmanchure suit l'epaule : ce que le bras ou la clavicule
        # entrainent, et le haut du flanc — pas le cote de la poitrine
        if p(d, *bras) > 0.12 or p(d, 'clavicle_l', 'clavicle_r') > 0.35: return False
        if abs(c.y) > 0.138 and c.z > 1.23: return False
        return True

    # LE SHORT : de la taille au tiers haut de la cuisse.
    def short(c, n, d):
        if p(d, *bras) > 0.3 or doigts(d): return False
        return 0.645 < c.z < 0.99

    # LES POINTES : le pied jusqu'a la malleole, semelle a part.
    def pointes(c, n, d):
        return c.z < 0.105 and p(d, 'foot_l', 'foot_r', 'ball_l', 'ball_r') > 0.2 and n.z > -0.55

    def semelle(c, n, d):
        return c.z < 0.03 and n.z <= -0.55

    # LE BANDEAU NOIR, haut sur le front, horizontal.
    def bandeau(c, n, d):
        return p(d, 'head') > 0.5 and 1.546 < c.z < 1.579 and d.get('ears', 0) < 0.2

    # LES CHEVEUX RAS : le cuir chevelu au-dessus du bandeau, et les cotes
    # et la nuque dessous, tres courts.
    def ras(c, n, d):
        if d.get('scalp', 0) < 0.3: return False
        return c.z >= 1.579 or (c.z < 1.546 and c.x < 0.055)

    # LA BARBE PLEINE : joues, menton, sous la machoire, moustache — pas les
    # levres.
    def barbe(c, n, d):
        if d.get('lips', 0) > 0.25: return False
        # le bas du visage, du menton a la moustache
        visage = p(d, 'head') > 0.4 and c.x > 0.045 and 1.405 < c.z < 1.476
        # les joues basses, jusqu'aux favoris, pas sous les yeux
        joues = (p(d, 'head') > 0.4 and c.x > 0.012 and abs(c.y) > 0.040
                 and 1.408 < c.z < (1.49 if abs(c.y) > 0.056 else 1.47))
        # sous la machoire seulement : pas en bavoir sur la gorge
        dessous = p(d, 'neck_01', 'head') > 0.4 and c.x > 0.05 and 1.392 < c.z < 1.41
        # la moustache reste ; seul le dessous du nez est epargne
        nez = c.z > 1.472 and abs(c.y) < 0.021 and c.x > 0.112
        return (visage or joues or dessous) and not nez

    pieces = [
        # le maillot passe PAR-DESSUS le short : plus bas et plus epais que
        # lui la ou ils se croisent, sans quoi le short ressortait en
        # languettes a travers l'ourlet
        ('Meba_maillot', maillot, 0.0068, MAILLOT, 0.55),
        ('Meba_short', short, 0.0045, SHORT, 0.45),
        ('Meba_pointes', pointes, 0.0060, POINTES, 0.35),
        ('Meba_semelle', semelle, 0.0080, SEMELLE, 0.5),
        ('Meba_bandeau', bandeau, 0.0035, BANDEAU, 0.7),
        ('Meba_ras', ras, 0.0015, CHEVEU, 0.9),
        ('Meba_barbe', barbe, 0.0042, BARBE, 0.95),
    ]
    out = []
    for nom, garder, e, col, r in pieces:
        out.append(coque(h, rig, nom, garder, e, col, r))
    # et la peau
    h.data.materials.clear()
    h.data.materials.append(materiau('Meba_peau', PEAU, 0.42))
    for poly in h.data.polygons:
        poly.use_smooth = True
    return out


# --- LES YEUX ----------------------------------------------------------------
# Les yeux de MakeHuman sont des aides qu'on a retirees : leurs orbites sont
# deux trous dans la peau. On les trouve comme des trous — les deux boucles de
# bord de la tete a hauteur des yeux —, et on y pose un globe : blanc, iris
# brun sombre, pupille, legerement humide.

def orbites(h):
    """L'ouverture de chaque oeil, et le plan des paupieres, par des rayons.

    Le corps de MakeHuman est ferme : l'oeil n'est pas un trou mais une cavite
    derriere la fente des paupieres. On balaie la zone de rayons tires de face :
    ceux qui passent la fente vont loin en arriere (x bas), les autres
    s'arretent sur les paupieres. Le centre de l'oeil est le milieu des rayons
    profonds ; le globe s'y pose, sa face avant au ras des paupieres — pose au
    fond de la cavite, il etait invisible, un centimetre et demi derriere elles.
    """
    from mathutils.bvhtree import BVHTree
    arbre = BVHTree.FromPolygons([v.co.copy() for v in h.data.vertices],
                                 [tuple(p.vertices) for p in h.data.polygons])
    out = []
    for s in (1, -1):
        hits = []
        for iy in range(-14, 15):
            for iz in range(-12, 13):
                y, z = s * (0.030 + iy * 0.001), 1.515 + iz * 0.001
                hit = arbre.ray_cast(Vector((0.4, y, z)), Vector((-1, 0, 0)))
                if hit[0] is not None:
                    hits.append(hit[0])
        paupieres = sorted(p.x for p in hits)[len(hits) * 3 // 4]
        fente = [p for p in hits if p.x < paupieres - 0.012]
        if not fente:
            continue
        c = sum(fente, Vector()) / len(fente)
        out.append((Vector((paupieres, c.y, c.z)), 0.0112))
    return out


def yeux(h, rig):
    objs = []
    blanc = materiau('Meba_oeil', (236, 232, 226), 0.08)
    iris = materiau('Meba_iris', (46, 28, 20), 0.15)
    pupille = materiau('Meba_pupille', (8, 8, 10), 0.05)
    for c, r in orbites(h):
        R = r
        # la cornee affleure les paupieres, un demi-millimetre derriere
        centre = c + Vector((-0.0005 - R, 0, 0))
        for nom, rr, dx, mat in (('globe', R, 0.0, blanc), ('iris', R * 0.46, R * 0.93, iris),
                                 ('pupille', R * 0.2, R * 1.0, pupille)):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=rr,
                                                 location=centre + Vector((dx, 0, 0)))
            o = bpy.context.active_object
            o.name = 'Meba_' + nom + ('_g' if c.y > 0 else '_d')
            if nom != 'globe':
                o.scale.x = 0.30
            o.data.materials.append(mat)
            for p in o.data.polygons:
                p.use_smooth = True
            objs.append(o)
    for o in objs:
        attacher(o, rig, 'head')
    return objs


def attacher(o, rig, os_):
    """Un objet rigide, porte tout entier par un os (yeux, cheveux, chaine)."""
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    g = o.vertex_groups.new(name=os_)
    g.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    m = o.modifiers.new('Armature', 'ARMATURE'); m.object = rig


# --- LES VANILLES --------------------------------------------------------------
# Sa coiffure : les cotes ras, et sur le dessus une touffe de vanilles
# decolorees — des meches torsadees a deux brins, brunes a la racine, blond
# miel a la pointe. Chacune est une vraie piece de geometrie, implantee sur le
# cuir chevelu au-dessus du bandeau : plus longue et plus droite au sommet,
# plus courte et couchee vers l'exterieur au bord, jamais alignee (tirage a
# graine fixe : le fichier sort identique a chaque fois).

def vanilles(h, rig, n=150, graine=7, courtes=110):
    import random
    import bmesh
    from mathutils.bvhtree import BVHTree
    rnd = random.Random(graine)
    V = [v.co.copy() for v in h.data.vertices]
    arbre = BVHTree.FromPolygons(V, [tuple(p.vertices) for p in h.data.polygons])
    dom = poids_dominant(h)
    cuir = [i for i, d in enumerate(dom) if d[2].get('scalp', 0) > 0.4 and V[i].z > 1.586]
    centre = sum((V[i] for i in cuir), Vector()) / len(cuir)
    def tirer(nb, ecart, deja):
        out, tentatives = [], 0
        while len(out) < nb and tentatives < 30000:
            tentatives += 1
            p = V[rnd.choice(cuir)] + Vector((rnd.uniform(-.004, .004), rnd.uniform(-.004, .004), 0))
            loc, nor, _, _ = arbre.find_nearest(p)
            if loc is None or any((loc - q).length < ecart for q, _ in out + deja):
                continue
            out.append((loc, nor))
        return out
    # DEUX COUCHES. Les longues font la touffe ; entre elles, des courtes,
    # serrees au ras du crane, bouchent les trous — sans elles on voyait le
    # cuir chevelu entre des chevilles.
    longues = tirer(n, 0.0080, [])
    basses = tirer(courtes, 0.0060, longues)
    brins = []
    for k, (loc, nor) in enumerate(longues + basses):
        courte = k >= len(longues)
        rad = Vector((loc.x - centre.x, loc.y - centre.y, 0))
        bord = min(1.0, rad.length / 0.075)
        # UNE TOUFFE QUI MONTE ET PART EN ARRIERE, pas un oursin : sur ses
        # photos, les vanilles du sommet se dressent en se couchant vers la
        # nuque, celles du bord retombent sur les cotes du bandeau.
        L = 0.047 - 0.017 * bord + rnd.uniform(-0.005, 0.005)
        if courte:
            L = rnd.uniform(0.012, 0.020)
        d = (nor * (1.0 - 0.30 * bord) + Vector((-0.32, 0, 0.18))
             + rad.normalized() * (0.10 + 0.30 * bord)
             + Vector((rnd.uniform(-.18, .18), rnd.uniform(-.18, .18), rnd.uniform(0, .12)))).normalized()
        # un axe qui s'incurve en retombant, d'autant plus qu'on est au bord
        axe = [loc + d * (L * t) + Vector((0, 0, -(0.006 + 0.016 * bord) * t * t)) for t in (0, .25, .5, .75, 1)]
        u = d.orthogonal().normalized(); w = d.cross(u).normalized()
        tours, rh = rnd.uniform(2.0, 3.0), 0.0026
        for phase in (0.0, math.pi):
            pts = []
            N = 18
            for k in range(N + 1):
                t = k / N
                seg = min(3, int(t * 4)); f = t * 4 - seg
                c = axe[seg].lerp(axe[seg + 1], f)
                a = phase + t * tours * 2 * math.pi
                r = rh * (1 - 0.35 * t)
                pts.append(c + (u * math.cos(a) + w * math.sin(a)) * r)
            brins.append(pts)
    # des tubes, en un seul maillage
    cu = bpy.data.curves.new('Meba_vanilles', 'CURVE')
    cu.dimensions = '3D'; cu.bevel_depth = 0.0040; cu.bevel_resolution = 1
    cu.use_fill_caps = True
    for pts in brins:
        sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
        for i, q in enumerate(pts):
            sp.points[i].co = (q.x, q.y, q.z, 1.0)
            sp.points[i].radius = 1.0 - 0.45 * i / (len(pts) - 1)
    o = bpy.data.objects.new('Meba_vanilles', cu)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.active_object
    # du brun a la racine au blond a la pointe : une couleur par sommet
    me = o.data
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    racine = Vector([srgb_vers_lin(c / 255) for c in CHEVEU])
    pointe = Vector([srgb_vers_lin(c / 255) for c in MECHES])
    for v in me.vertices:
        loc, _, _, dist = arbre.find_nearest(v.co)
        t = max(0.0, min(1.0, (dist - 0.004) / 0.02))
        c = racine.lerp(pointe, t * t * (3 - 2 * t))
        col.data[v.index].color = (c.x, c.y, c.z, 1.0)
    mat = bpy.data.materials.new('Meba_vanilles')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(nd for nd in nt.nodes if nd.type == 'BSDF_PRINCIPLED')
    ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'
    nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.7
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    attacher(o, rig, 'head')
    return o


# --- LA CHAINE EN OR ET LA BOUCLE D'OREILLE ------------------------------------
def chaine(h, rig):
    """Au ras du cou, un peu plus bas devant, un pendentif sur le sternum."""
    from mathutils.bvhtree import BVHTree
    V = [v.co.copy() for v in h.data.vertices]
    arbre = BVHTree.FromPolygons(V, [tuple(p.vertices) for p in h.data.polygons])
    pts = []
    for k in range(48):
        a = 2 * math.pi * k / 48
        # plus basse devant (a = 0 vers +x), posee sur la peau par un rayon
        z = 1.372 - 0.028 * max(0.0, math.cos(a)) ** 2
        orig = Vector((0.0, 0.0, z)); dirn = Vector((math.cos(a), math.sin(a), -0.15 * max(0.0, math.cos(a)))).normalized()
        hit = arbre.ray_cast(orig + dirn * 0.3, -dirn)
        if hit[0] is not None:
            pts.append(hit[0] + hit[1] * 0.0035)
    cu = bpy.data.curves.new('Meba_chaine', 'CURVE')
    cu.dimensions = '3D'; cu.bevel_depth = 0.0017; cu.bevel_resolution = 2
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1); sp.use_cyclic_u = True
    for i, q in enumerate(pts):
        sp.points[i].co = (q.x, q.y, q.z, 1.0)
    o = bpy.data.objects.new('Meba_chaine', cu)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.active_object
    o.data.materials.append(materiau('Meba_or', OR, 0.25, 1.0))
    # le pendentif : une petite plaque, au point le plus bas devant
    bas = min(pts, key=lambda q: q.z - 0.5 * q.x)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.0065, depth=0.0022,
                                        location=bas + Vector((0.004, 0, -0.008)),
                                        rotation=(0, math.radians(90), 0))
    pd = bpy.context.active_object
    pd.data.materials.append(bpy.data.materials['Meba_or'])
    bpy.ops.object.select_all(action='DESELECT'); pd.select_set(True); o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.join()
    for p in o.data.polygons:
        p.use_smooth = True
    # portee par le haut du buste : elle suit la poitrine et le cou
    attacher(o, rig, 'spine_03')
    return o


def boucle(h, rig):
    """Une petite creole a l'oreille droite (celle qu'on voit sur ses photos)."""
    dom = poids_dominant(h)
    V = [v.co for v in h.data.vertices]
    oreille = [V[i] for i, d in enumerate(dom) if d[2].get('ears', 0) > 0.5 and V[i].y < 0]
    lobe = min(oreille, key=lambda q: q.z)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.0055, minor_radius=0.0009,
                                     major_segments=32, minor_segments=8,
                                     location=lobe + Vector((0.002, -0.001, -0.004)),
                                     rotation=(math.radians(90), 0, 0))
    o = bpy.context.active_object; o.name = 'Meba_boucle'
    o.data.materials.append(bpy.data.materials.get('Meba_or') or materiau('Meba_or', OR, 0.25, 1.0))
    attacher(o, rig, 'head')
    return o
