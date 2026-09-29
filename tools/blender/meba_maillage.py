# -----------------------------------------------------------------------
# SPRINTER — Meba-Mickael Zeze en VRAI MAILLAGE, d'un seul tenant.
#
#   blender -b -P tools/blender/meba_maillage.py -- [--glb public/vedettes/meba.glb]
#                                                   [--portraits public/vedettes]
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
    'torso-vshape-incr': 0.55, 'measure-waist-circ-decr': 0.15,
    'stomach-pregnant-decr': 0.35,
    'l-upperarm-muscle-incr': 0.70, 'r-upperarm-muscle-incr': 0.70,
    'l-upperarm-shoulder-muscle-incr': 0.80, 'r-upperarm-shoulder-muscle-incr': 0.80,
    'l-lowerarm-muscle-incr': 0.50, 'r-lowerarm-muscle-incr': 0.50,
    'l-upperleg-muscle-incr': 1.0, 'r-upperleg-muscle-incr': 1.0,
    'l-lowerleg-muscle-incr': 0.85, 'r-lowerleg-muscle-incr': 0.85,
    'buttocks-volume-incr': 0.35,
    # UN BASSIN D'HOMME. Taille pincee, fesses larges, hanches evasees et
    # genoux qui se rapprochent : le bas du corps se lisait en femme. Un
    # sprinteur a le bassin etroit, la cuisse droite du flanc au genou, le
    # genou et le mollet solides, pas de graisse sur la cuisse.
    'measure-hips-circ-decr': 0.45, 'hip-scale-horiz-decr': 0.35,
    'pelvis-tone-incr': 0.50,
    'l-upperleg-fat-decr': 0.70, 'r-upperleg-fat-decr': 0.70,
    'l-leg-valgus-decr': 0.45, 'r-leg-valgus-decr': 0.45,
    'measure-knee-circ-incr': 0.30, 'measure-calf-circ-incr': 0.40,
    # la masse de la cuisse en PROFONDEUR (quadriceps devant, ischios
    # derriere), pas en largeur : sans graisse ni hanches, la cuisse maigrissait
    'measure-thigh-circ-incr': 0.35,
    'l-upperleg-scale-depth-incr': 0.35, 'r-upperleg-scale-depth-incr': 0.35,
    'measure-neck-circ-incr': 0.45,
    'measure-neck-height-incr': 0.20,
}

# SON VISAGE, releve sur l'interview de Lievin (2018, de face, en 1080p) et sa
# photo de trois quarts. Ce qui le fait reconnaitre : un visage long et ovale,
# le front haut et bombe, des pommettes larges ; des yeux en amande sous une
# paupiere lourde, le coin exterieur qui tombe ; un nez large aux ailes
# ouvertes et au bout rond ; une bouche large, la levre du bas pleine ; un
# menton que la barbe allonge. Les cibles « l-/r- » sont posees des deux cotes.
VISAGE = {
    'head-oval': 0.65, 'head-scale-vert-incr': 0.22, 'head-scale-horiz-decr': 0.08,
    'forehead-scale-vert-incr': 0.35, 'forehead-nubian-incr': 0.30,
    '*-cheek-bones-incr': 0.55, '*-cheek-volume-decr': 0.20,
    'chin-height-incr': 0.45, 'chin-width-decr': 0.18, 'chin-prominent-incr': 0.20,
    # LE BAS DU VISAGE AVANCAIT EN MUSEAU : la base « african » de MakeHuman
    # est prognathe, pas lui — de trois quarts, sa bouche reste dans le plan
    # des pommettes. Et un visage sec, de sprinteur, pas les joues pleines.
    'chin-prognathism-decr': 0.70, 'head-fat-decr': 0.45,
    '*-eye-height2-decr': 0.45, '*-eye-eyefold-down': 0.40, '*-eye-corner2-down': 0.25,
    '*-eye-scale-decr': 0.10, '*-eye-bag-incr': 0.15,
    # mesure (tools/biomeca/visage.py) : ses sourcils sont hauts sur l'oeil
    'eyebrows-trans-up': 0.35,
    'nose-width1-incr': 0.45, 'nose-width2-incr': 0.55, 'nose-width3-incr': 0.60,
    'nose-flaring-incr': 0.55, 'nose-nostrils-width-incr': 0.50,
    'nose-point-width-incr': 0.45, 'nose-hump-decr': 0.30, 'nose-volume-incr': 0.15,
    # mesure : de l'oeil au bout du nez, 0,255 de la largeur du visage chez
    # lui, 0,324 sur le modele — un nez court, releve
    'nose-scale-vert-decr': 0.95, 'nose-trans-up': 0.60, 'nose-point-up': 0.45,
    'mouth-scale-horiz-incr': 0.30,
    # mesure : ses levres sont pleines mais pas projetees — la bouche du
    # modele avancait et s'epaississait (+43 % en haut, +59 % en bas)
    'mouth-scale-depth-decr': 0.85, 'mouth-trans-backward': 0.80,
    'mouth-lowerlip-volume-decr': 0.45, 'mouth-upperlip-volume-decr': 0.60,
    'mouth-lowerlip-height-decr': 0.25, 'mouth-upperlip-height-decr': 0.30,
    '*-ear-flap-decr': 0.35,
}


def cibles_du_visage():
    out = {}
    for nom, poids in VISAGE.items():
        if nom.startswith('*-'):
            for c in ('l-', 'r-'):
                out[c + nom[2:]] = poids
        else:
            out[nom] = poids
    return out

SCENE = "Meba"


def arguments():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    val = lambda k: a[a.index(k) + 1] if k in a else None
    return {'glb': val('--glb'), 'blend': val('--blend'), 'portraits': val('--portraits'),
            'visage': val('--visage')}


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
    for nom, poids in list(CIBLES.items()) + list(cibles_du_visage().items()):
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


# --- SON VISAGE, RELEVE SUR SES PHOTOS -----------------------------------------
# Les cibles de MakeHuman (VISAGE) reglent des proportions — largeur du nez,
# hauteur du front — pas la forme des volumes : a ±10 % de ses mesures, le
# visage ne lui ressemblait toujours pas. La forme vient donc de ses photos
# (29/09/2026 : deux de face, un selfie, un profil gauche, deux en pied),
# ajustees dans KeenTools FaceBuilder et figees, en expression neutre, dans
# tools/blender/meba/visage-facebuilder.ply. Les photos ne sont pas dans le
# depot : seul le maillage l'est.
#
# Le transfert : la tete FaceBuilder est calee sur celle de MakeHuman (meme
# orientation, puis un recalage iteratif rotation-echelle-translation sur la
# face), puis chaque sommet du visage est tire vers sa surface. Le poids du
# tirage s'eteint vers les oreilles, sous le menton et vers le crane — la ou
# les photos ne disent rien et ou la coiffure et le cou prennent le relais.

VISAGE_FB = 'tools/blender/meba/visage-facebuilder.ply'
FACE_PLEINE, FACE_NULLE = math.radians(62), math.radians(88)   # du nez vers l'oreille
TIRAGE_MAX = 0.03                                              # m : au-dela, c'est une erreur


def _lisse(x, a, b):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def _similarite(Q, P):
    """s, R, t minimisant |s R q + t - p| (Umeyama)."""
    import numpy as np
    mq, mp = Q.mean(0), P.mean(0)
    A, B = Q - mq, P - mp
    U, S, Vt = np.linalg.svd(B.T @ A / len(Q))
    D = np.diag([1.0, 1.0, np.sign(np.linalg.det(U @ Vt))])
    R = U @ D @ Vt
    s = float(np.trace(np.diag(S) @ D) / ((A ** 2).sum() / len(Q)))
    return s, R, mp - s * R @ mq


def visage_photo(h, chemin=None, iterations=25):
    """Tire le visage de MakeHuman vers celui des photos. Renvoie l'ecart moyen (m).

    MEBA_VISAGE_FB=... remplace le chemin (un chemin absent : visage MakeHuman,
    pour un rendu « avant »)."""
    import numpy as np
    from mathutils.bvhtree import BVHTree
    chemin = chemin or os.environ.get('MEBA_VISAGE_FB', VISAGE_FB)
    if not os.path.exists(chemin):
        print('visage_photo : pas de', chemin, '— visage MakeHuman garde')
        return None
    avant = set(bpy.data.objects)
    bpy.ops.wm.ply_import(filepath=chemin)
    F = next(o for o in bpy.data.objects if o not in avant)
    n = len(F.data.vertices)
    VF = np.empty(n * 3); F.data.vertices.foreach_get('co', VF); VF = VF.reshape(-1, 3)
    polys = [tuple(p.vertices) for p in F.data.polygons]
    bpy.data.objects.remove(F, do_unlink=True)
    # FaceBuilder regarde -y, le coureur +x : un quart de tour autour de z
    VF = VF @ np.array([[0.0, 1.0, 0.0], [-1.0, 0.0, 0.0], [0.0, 0.0, 1.0]])

    me = h.data
    VM = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', VM); VM = VM.reshape(-1, 3)
    gi = h.vertex_groups['head'].index
    tete = np.array([any(g.group == gi and g.weight > 0.5 for g in v.groups) for v in me.vertices])
    T = VM[tete]
    c = np.array([(T[:, 0].min() + T[:, 0].max()) / 2, T[:, 1].mean(), 0.0])
    ang = np.abs(np.arctan2(VM[:, 1] - c[1], VM[:, 0] - c[0]))
    nez_m = VM[np.where(tete & (ang < 0.35))[0][np.argmax(VM[tete & (ang < 0.35), 0])]]
    haut_m = T[:, 2].max()
    menton_m = VM[tete & (ang < 0.45), 2].min()
    gl = h.vertex_groups.get('lips')
    li = gl.index if gl else -1
    levres = np.array([max([g.weight for g in v.groups if g.group == li] or [0.0]) for v in me.vertices])
    bouche = VM[levres > 0.5].mean(0) if (levres > 0.5).any() else nez_m - np.array([0.0, 0.0, 0.035])

    # premier calage : les nez ensemble, la hauteur nez-sommet du crane egale
    nez_f = VF[np.argmax(VF[:, 0])]
    s0 = (haut_m - nez_m[2]) / (VF[:, 2].max() - nez_f[2])
    VF = (VF - nez_f) * s0 + nez_m

    # la face de MakeHuman, du menton au front, qui sert de cible au recalage
    # (sans la barbe : son contour n'est pas celui de la machoire, voir poids())
    zone = tete & (ang < FACE_PLEINE) & (VM[:, 2] > bouche[2] - 0.005) & (VM[:, 2] < haut_m - 0.045)
    P = VM[zone]
    for _ in range(iterations):
        bvh = BVHTree.FromPolygons([tuple(v) for v in VF], polys)
        Q = np.array([bvh.find_nearest(Vector(p))[0] for p in P])
        d = np.linalg.norm(Q - P, axis=1)
        garde = d < 3 * np.median(d) + 1e-4
        s, R, t = _similarite(Q[garde], P[garde])
        VF = (s * (R @ VF.T)).T + t
    print(f'visage_photo : recalage, ecart median {np.median(d) * 1000:.1f} mm sur {int(garde.sum())} points')
    bvh = BVHTree.FromPolygons([tuple(v) for v in VF], polys)

    # LE POIDS DU TIRAGE. Plein sur la face, du front a la bouche ; il s'eteint
    # vers les oreilles, vers le sommet du crane (bandeau et cheveux), et SOUS
    # LA BOUCHE : sur ses photos, le contour du bas du visage est celui de sa
    # barbe, pas celui de sa machoire — le tirer la ferait porter deux fois,
    # par la peau puis par la coque de la barbe. Les levres, elles, suivent.
    def poids(i):
        p = VM[i]
        wi = (1 - _lisse(ang[i], FACE_PLEINE, FACE_NULLE))
        wi *= 1 - _lisse(p[2], haut_m - 0.05, haut_m - 0.02)
        bas = _lisse(p[2], bouche[2] - 0.022, bouche[2] + 0.004)
        joue = 1 - _lisse(abs(p[1] - c[1]), 0.035, 0.050) * (1 - _lisse(p[2], bouche[2] + 0.005, bouche[2] + 0.030))
        wi *= min(bas, joue)
        return max(wi, levres[i] * (1 - _lisse(ang[i], FACE_PLEINE, FACE_NULLE)))

    # LES ZONES QUI NE VONT PAS CHERCHER LA SURFACE : les yeux (la tete de
    # FaceBuilder est pleine devant le globe — la paupiere s'y collait et l'oeil
    # disparaissait) et tout ce qui regarde vers l'interieur (bouche, narines :
    # tires vers la surface la plus proche, ils sortaient en crocs). Elles
    # suivent le deplacement de leur voisinage, interpole.
    yeux_c = [e for e, _r in orbites(h)]
    nrm = np.empty(len(VM) * 3); me.vertices.foreach_get('normal', nrm); nrm = nrm.reshape(-1, 3)
    centre = np.array([c[0], c[1], nez_m[2]])
    idx = np.where(tete)[0]
    dep = np.zeros_like(VM)
    w = np.zeros(len(VM))
    libre = np.zeros(len(VM), bool)
    for i in idx:
        wi = poids(i)
        if wi <= 0:
            continue
        p = VM[i]
        r = p - centre
        dedans = float(np.dot(nrm[i], r / (np.linalg.norm(r) + 1e-9))) < 0.3
        oeil = any(np.hypot(p[1] - e.y, p[2] - e.z) < 0.021 and p[0] > e.x - 0.03 for e in yeux_c)
        w[i] = wi
        if dedans or oeil:
            libre[i] = True
            continue
        q = bvh.find_nearest(Vector(p))[0]
        v = np.array(q) - p if q is not None else None
        if v is None or np.linalg.norm(v) > TIRAGE_MAX:
            libre[i] = True
            continue
        dep[i] = v
    voisins = [[] for _ in range(len(VM))]
    for e in me.edges:
        a, b = e.vertices
        voisins[a].append(b); voisins[b].append(a)
    # les zones libres, par moyenne de leurs voisins, jusqu'a l'equilibre
    L = [i for i in idx if libre[i] and voisins[i]]
    for _ in range(60):
        for i in L:
            dep[i] = dep[voisins[i]].mean(0)
    # trois passes de lissage sur le reste : un sommet ne part pas seul
    for _ in range(3):
        nv = dep.copy()
        for i in idx:
            if w[i] > 0 and voisins[i]:
                nv[i] = 0.5 * dep[i] + 0.5 * dep[voisins[i]].mean(0)
        dep = nv
    VM2 = VM + dep * w[:, None]
    me.vertices.foreach_set('co', VM2.ravel())
    me.update()
    ecart = float(np.mean(np.linalg.norm(dep[w > 0.5], axis=1))) if (w > 0.5).any() else 0.0
    print(f'visage_photo : echelle {s0:.4f}, {int((w > 0).sum())} sommets tires, '
          f'ecart moyen {ecart * 1000:.1f} mm')
    return ecart


def corps():
    """Toute la chaine du corps : humain, repere, calage, repos fige, visage."""
    sc = scene_neuve()
    h, rig = humain()
    mise_en_repere(h, rig)
    herite = caler(rig, cibles(rig))
    figer(h, rig, {b.name: 'FULL' for b in rig.data.bones})
    visage_photo(h)
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


def coque(h, rig, nom, garder, epaisseur, couleur, rugosite=0.6, metal=0.0, lisser=0, fondu=0,
          teinte=None):
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
    # UNE CHAUSSURE N'A PAS D'ORTEILS. La coque du pied copiait les cinq doigts
    # de pied, et la pointe se lisait en chaussette : lissee, elle devient un
    # chausson rond, puis on la regonfle de ce que le lissage lui a pris.
    if lisser:
        import bmesh as _bm
        dedans = [v for v in bm.verts if not v.is_boundary]
        avant = {v: v.co.copy() for v in dedans}
        for _ in range(lisser):
            _bm.ops.smooth_vert(bm, verts=dedans, factor=0.6,
                                use_axis_x=True, use_axis_y=True, use_axis_z=True)
        bm.normal_update()
        perte = sum((avant[v] - v.co).length for v in dedans) / max(1, len(dedans))
        for v in dedans:
            v.co += v.normal * perte * 0.8
    bm.normal_update()
    # UN BORD QUI SE FOND (`fondu` anneaux). Une barbe a bord franc se lit en
    # masque colle sur le visage ; la vraie s'eclaircit et s'amincit vers ses
    # limites. L'epaisseur monte donc de zero au bord jusqu'a la pleine
    # epaisseur `fondu` anneaux plus loin.
    anneau = {}
    if fondu:
        front = [v for v in bm.verts if v.is_boundary]
        for v in front:
            anneau[v] = 0
        k = 0
        while front and k < fondu:
            k += 1
            suite = []
            for v in front:
                for e in v.link_edges:
                    w = e.other_vert(v)
                    if w not in anneau:
                        anneau[w] = k; suite.append(w)
            front = suite
    parts = {}
    for v in bm.verts:
        part = min(1.0, (anneau.get(v, fondu) + 0.35) / (fondu + 0.35)) if fondu else 1.0
        parts[v.index] = part
        e = epaisseur(v.co) if callable(epaisseur) else epaisseur
        v.co += v.normal * e * part
    bm.to_mesh(me); bm.free()
    # une piece a plusieurs couleurs (`teinte(co)` rend une couleur 0-255)
    if teinte is not None and not fondu:
        col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        for v in me.vertices:
            c = [srgb_vers_lin(x / 255) for x in teinte(v.co)]
            col.data[v.index].color = (c[0], c[1], c[2], 1.0)
    # et la couleur se fond aussi : de la peau au bord a la sienne au coeur
    if fondu:
        col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        a = Vector([srgb_vers_lin(c / 255) for c in PEAU])
        b = Vector([srgb_vers_lin(c / 255) for c in couleur])
        for i, part in parts.items():
            # le coeur a sa couleur pleine, le bord seul se fond : sur un
            # maillage grossier, un fondu lent rendait toute la barbe brune
            c = a.lerp(b, min(1.0, part * 2.2))
            col.data[i].color = (c.x, c.y, c.z, 1.0)
    me.materials.clear()
    mat = materiau(nom, couleur, rugosite, metal)
    if fondu or teinte is not None:
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        ca = next((n for n in nt.nodes if n.type == 'VERTEX_COLOR'), None) or nt.nodes.new('ShaderNodeVertexColor')
        ca.layer_name = 'Col'
        nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
    me.materials.append(mat)
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


# Les matieres MATES — poils, tissu eponge — ne renvoient presque rien : avec
# le reflet d'un Principled par defaut, la barbe et le bandeau noirs sortaient
# gris clair sous les lampes.
MATES = {'Meba_barbe', 'Meba_bandeau', 'Meba_ras', 'Meba_sourcils', 'Meba_levres'}


def materiau(nom, couleur, rugosite=0.6, metal=0.0):
    m = bpy.data.materials.get(nom) or bpy.data.materials.new(nom)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    if nom in MATES and 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.04
    bsdf.inputs['Base Color'].default_value = (*[srgb_vers_lin(c / 255) for c in couleur], 1.0)
    bsdf.inputs['Roughness'].default_value = rugosite
    bsdf.inputs['Metallic'].default_value = metal
    return m


def srgb_vers_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


# Les couleurs sont celles du look du jeu (VEDETTES, sprinter-core.js).
# la carnation de ses photos a l'exterieur : un brun fonce, chaud — la
# premiere (96, 58, 44), eclairee au studio, sortait caramel
PEAU = (74, 44, 34)
MAILLOT = (242, 244, 248)
SHORT = (30, 44, 110)
POINTES = (214, 240, 44)
SEMELLE = (236, 236, 232)
BANDEAU = (30, 30, 34)
BARBE = (20, 15, 14)
CHEVEU = (30, 24, 22)
# un blond decolore, dore : plus sombre, il se perdait a la taille du jeu
MECHES = (230, 192, 118)
OR = (226, 184, 72)
SOURCIL = (18, 13, 12)
BLEU_FRANCE = (38, 64, 168)
ROUGE_FRANCE = (214, 40, 52)
# ses levres sont sombres, proches de sa barbe : claires, cernees de noir,
# elles se lisaient comme une bouche ouverte au fond d'un museau
LEVRES = (40, 23, 21)


def chaussure(h, rig, cote):
    """Une pointe de sprint : l'enveloppe du pied, pas sa copie.

    Une coque decoupee dans le pied en gardait les cinq orteils, et la pointe se
    lisait en chaussette. On prend l'enveloppe CONVEXE du pied — elle passe
    par-dessus les creux entre les orteils —, on la remaille en voxels de quatre
    millimetres et on la lisse : une chaussure fermee, arrondie au bout. Le
    dessus, dans la cheville, est ouvert ; le dessous est la semelle, blanche.
    Ses poids viennent du pied le plus proche.
    """
    import bmesh
    V = [v.co.copy() for v in h.data.vertices]
    dom = poids_dominant(h)
    pied = [V[i] for i, d in enumerate(dom)
            if V[i].z < 0.108 and V[i].y * cote > 0 and d[0] in ('foot_l', 'foot_r', 'ball_l', 'ball_r', 'calf_l', 'calf_r')]
    bm = bmesh.new()
    for q in pied:
        bm.verts.new(q)
    bmesh.ops.convex_hull(bm, input=bm.verts)
    me = bpy.data.meshes.new('Meba_pointe'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Meba_pointe_' + ('g' if cote > 0 else 'd'), me)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    rm = o.modifiers.new('Remaillage', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = 0.004
    bpy.ops.object.modifier_apply(modifier=rm.name)
    sm = o.modifiers.new('Lissage', 'SMOOTH'); sm.factor = 0.8; sm.iterations = 6
    bpy.ops.object.modifier_apply(modifier=sm.name)
    dc = o.modifiers.new('Allegement', 'DECIMATE'); dc.ratio = 0.3
    bpy.ops.object.modifier_apply(modifier=dc.name)
    # un peu de gonflant : la pointe entoure le pied, elle ne le moule pas
    bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * 0.003
    # le col, dans la cheville, s'ouvre
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z > 0.100], context='FACES')
    bm.to_mesh(o.data); bm.free()
    o.data.materials.append(materiau('Meba_pointes', POINTES, 0.35))
    o.data.materials.append(materiau('Meba_semelle', SEMELLE, 0.5))
    for p in o.data.polygons:
        p.use_smooth = True
        c = sum((o.data.vertices[i].co for i in p.vertices), Vector()) / len(p.vertices)
        p.material_index = 1 if (p.normal.z < -0.45 or c.z < 0.012) else 0
    transferer_poids(o, h, rig)
    return o


def transferer_poids(o, source, rig):
    """Les poids d'un objet pris sur la surface la plus proche de `source`."""
    for g in source.vertex_groups:
        if g.name not in o.vertex_groups:
            o.vertex_groups.new(name=g.name)
    mod = o.modifiers.new('Poids', 'DATA_TRANSFER')
    mod.object = source
    mod.use_vert_data = True
    mod.data_types_verts = {'VGROUP_WEIGHTS'}
    mod.vert_mapping = 'POLYINTERP_NEAREST'
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.datalayout_transfer(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    arm = o.modifiers.new('Armature', 'ARMATURE'); arm.object = rig


def habiller(h, rig):
    """Les pieces de la tenue et du visage, chacune a sa coque."""
    p = lambda d, *n: max((d.get(k, 0.0) for k in n), default=0.0)
    # les yeux d'abord : le bandeau, les sourcils et les cheveux s'y reperent
    yeux_c = orbites(h)
    # et le menton : la barbe s'y epaissit
    domh = poids_dominant(h)
    menton = min((h.data.vertices[i].co for i, dd in enumerate(domh)
                  if dd[0] == 'head' and h.data.vertices[i].co.x > 0.05
                  and abs(h.data.vertices[i].co.y) < 0.015), key=lambda q: q.z)

    # SA BARBE A UN VOLUME. Une coque de quatre millimetres se lisait en ombre
    # sur la peau ; la sienne, sur ses photos, est epaisse et descend de quatre
    # ou cinq centimetres sous le menton, en pointe. L'epaisseur depend donc de
    # la place : 3,5 cm au menton, pleine sur la machoire, fine sur les joues
    # et la moustache.
    # PRES DES LEVRES, ELLE EST COURTE. Epaisse partout, elle se soulevait
    # autour de la bouche et les levres paraissaient enfoncees dans un trou —
    # un museau. La moustache et le dessous de la levre restent a trois
    # millimetres ; l'epaisseur ne vient qu'au menton et sur la machoire.
    # LA DISTANCE A LA LEVRE LA PLUS PROCHE, pas au centre de la bouche : aux
    # commissures, a 2,5 cm du centre, la barbe reprenait toute son epaisseur
    # et faisait un bourrelet autour des levres.
    from mathutils.kdtree import KDTree
    levres_c = [h.data.vertices[i].co.copy() for i, dd in enumerate(domh) if dd[2].get('lips', 0) > 0.5]
    arbre = KDTree(max(1, len(levres_c)))
    for i, q in enumerate(levres_c or [menton + Vector((0.05, 0, 0.05))]):
        arbre.insert(q, i)
    arbre.balance()
    def epaisseur_barbe(co):
        dm = (co - menton).length
        machoire = max(0.0, min(1.0, (menton.z + 0.045 - co.z) / 0.045))
        # au-dessous du menton, la gorge : l'epaisseur s'y eteint
        gorge = max(0.0, min(1.0, (co.z - (menton.z - 0.022)) / 0.018))
        # EN POINTE, PAS EN BLOC : pleine au centre du menton, elle s'affine
        # vers les cotes de la machoire (une bosse etroite en largeur).
        d = co - menton
        cote = max(0.0, 1.0 - abs(co.y) / 0.075)
        pointe = math.exp(-((d.x / 0.032) ** 2 + (d.y / 0.019) ** 2 + (d.z / 0.030) ** 2))
        # ELLE DESCEND, ELLE N'AVANCE PAS. Sur ses photos de course, elle pend
        # de trois centimetres sous le menton, en pointe ; devant, elle reste
        # courte. Epaisse partout, elle avancait en bloc devant la bouche.
        haut = 1.0 if d.z < 0.004 else math.exp(-((d.z - 0.004) / 0.012) ** 2)
        pend = math.exp(-((d.x / 0.030) ** 2 + (d.y / 0.020) ** 2)) * haut
        e = (0.004 + 0.007 * machoire * cote + 0.010 * pointe + 0.026 * pend) * gorge
        db = arbre.find(co)[2]
        pres = max(0.0, min(1.0, (db - 0.003) / 0.020))
        pres = pres * pres * (3 - 2 * pres)
        return 0.003 + (e - 0.003) * pres
    bras = ('upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r')
    doigts = lambda d: any(k.split('_')[0] in ('thumb', 'index', 'middle', 'ring', 'pinky') and w > 0.2 for k, w in d.items())

    # LE DEBARDEUR DE L'EQUIPE DE FRANCE : du bas des cotes au haut des
    # epaules, echancre devant et derriere, emmanchures larges de sprinteur,
    # bretelles au ras du cou. Il descend sur le haut du short.
    def maillot(c, n, d):
        if not (0.942 < c.z < 1.405): return False
        # les poids du bras debordent sur les pectoraux, ceux du cou sur les
        # trapezes : seuls les franchement pris par eux sont exclus
        if p(d, *bras) > 0.55 or p(d, 'head') > 0.3: return False
        ay = abs(c.y)
        # au-dessus de la poitrine, seulement les bretelles, sur le trapeze
        if c.z > 1.335:
            return 0.058 < ay < 0.112 and p(d, 'neck_01') < 0.65
        if p(d, 'neck_01') > 0.3: return False
        # l'encolure, arrondie devant, plus haute derriere
        if c.x > 0.0 and c.z > 1.300 and ay < 0.072: return False
        if c.x <= 0.0 and c.z > 1.330 and ay < 0.060: return False
        # les emmanchures d'un debardeur de sprint : profondes, sur le cote
        if ay > 0.132 and c.z > 1.200: return False
        if ay > 0.118 and c.z > 1.280: return False
        return True

    # UN SHORT D'HOMME. Le corps de MakeHuman n'a rien a l'entrejambe (la
    # cible « bulge » n'y change rien de visible) : la coque suivait le creux
    # entre les cuisses et dessinait un V — un bas de corps de femme. Le tissu
    # se bombe donc devant l'entrejambe, au milieu, sur trois centimetres de
    # large, et comble le creux au lieu de le suivre.
    entrejambe = min((h.data.vertices[i].co for i, dd in enumerate(domh)
                      if abs(h.data.vertices[i].co.y) < 0.004 and 0.70 < h.data.vertices[i].co.z < 1.0
                      and dd[0] in ('pelvis', 'thigh_l', 'thigh_r')), key=lambda q: q.z)
    def epaisseur_short(co):
        d = co - entrejambe
        devant = max(0.0, min(1.0, (d.x + 0.010) / 0.030))
        devant = devant * devant * (3 - 2 * devant)
        g = math.exp(-((co.y / 0.030) ** 2 + ((d.z - 0.040) / 0.032) ** 2))
        return 0.0045 + 0.016 * g * devant

    # LE SHORT : de la taille au tiers haut de la cuisse.
    def short(c, n, d):
        if p(d, *bras) > 0.3 or doigts(d): return False
        return 0.645 < c.z < 0.99

    # LES POINTES : le pied jusqu'a la malleole, semelle a part.
    def pointes(c, n, d):
        return c.z < 0.105 and p(d, 'foot_l', 'foot_r', 'ball_l', 'ball_r') > 0.2 and n.z > -0.55

    def semelle(c, n, d):
        return c.z < 0.03 and n.z <= -0.55

    # LE BANDEAU NOIR, HAUT sur le front, au-dessus des sourcils : pose trop
    # bas, il les cachait et le visage n'avait plus de front. Il se place donc
    # par rapport aux yeux, pas a une hauteur fixe.
    zY = sum(e.z for e, _ in yeux_c) / max(1, len(yeux_c)) if yeux_c else 1.5185
    # ET INCLINE, comme il le porte : haut sur le front, il descend vers la
    # nuque (deux centimetres et demi plus bas derriere).
    bas_bandeau = lambda x: zY + 0.050 + 0.20 * (x - 0.09)
    def bandeau(c, n, d):
        b = bas_bandeau(c.x)
        return p(d, 'head') > 0.5 and b < c.z < b + 0.031 and d.get('ears', 0) < 0.2

    # LES CHEVEUX RAS : le cuir chevelu au-dessus du bandeau, et les cotes
    # et la nuque dessous, tres courts.
    def ras(c, n, d):
        if d.get('scalp', 0) < 0.3: return False
        b = bas_bandeau(c.x)
        return c.z >= b + 0.031 or (c.z < b and c.x < 0.055)

    # LA BARBE PLEINE : joues, menton, sous la machoire, moustache — pas les
    # levres.
    def barbe(c, n, d):
        if d.get('lips', 0) > 0.25: return False
        # le bas du visage, du menton a la moustache
        visage = p(d, 'head') > 0.4 and c.x > 0.045 and 1.405 < c.z < 1.476
        # les joues basses, jusqu'aux favoris, pas sous les yeux
        joues = (p(d, 'head') > 0.4 and c.x > 0.012 and abs(c.y) > 0.040
                 and 1.408 < c.z < (1.49 if abs(c.y) > 0.056 else 1.47))
        # sous la machoire et sous le menton : c'est de la que sa barbe
        # descend (pas en bavoir sur toute la gorge)
        # Elle chevauche le bas du visage de trois centimetres : separee de
        # lui par un rang de faces, elle partait comme un ilot de franges.
        # Seules les faces TOURNEES VERS LE BAS : le devant du cou regarde en
        # avant, et epaissi, il faisait un col autour de la gorge.
        dessous = (p(d, 'neck_01', 'head') > 0.4 and c.x > 0.02 and n.z < -0.25
                   and menton.z - 0.025 < c.z < menton.z + 0.030 and abs(c.y) < 0.070)
        # la moustache reste ; seul le dessous du nez est epargne
        nez = c.z > zY - 0.030 and abs(c.y) < 0.021 and c.x > 0.112
        # la moustache : entre le nez et la levre, sur toute la largeur de la bouche
        moustache = p(d, 'head') > 0.4 and c.x > 0.09 and abs(c.y) < 0.026 and zY - 0.052 < c.z < zY - 0.036
        if moustache and d.get('lips', 0) < 0.25:
            return True
        return (visage or joues or dessous) and not nez

    # LES SOURCILS, que le corps de MakeHuman n'a pas : sans eux le visage se
    # lisait en mannequin. Un arc au-dessus de chaque oeil, trouve depuis
    # l'oeil lui-meme : epais pres du nez, fin vers la tempe, a peine arque —
    # les siens sont sombres, nets, poses bas.
    def sourcils(c, n, d):
        if p(d, 'head') < 0.5 or c.x < 0.04:
            return False
        for e, _r in yeux_c:
            if e.y * c.y <= 0:
                continue
            dy = (abs(c.y) - abs(e.y))          # vers la tempe, positif
            if not (-0.017 < dy < 0.029):
                continue
            # mesure : du coin de l'oeil au sourcil, 0,265 de la largeur du
            # visage — plus haut qu'on ne le dessinait
            zc = e.z + 0.0280 - 7.0 * (dy - 0.004) ** 2
            demi = 0.0058 - 0.070 * max(0.0, dy)
            if abs(c.z - zc) < max(0.0016, demi):
                return True
        return False

    # LES LEVRES, de leur couleur : plus sombres que la peau, satinees.
    def levres(c, n, d):
        return d.get('lips', 0) > 0.62

    # LE MAILLOT DE L'EQUIPE DE FRANCE, sans la marque : blanc, les epaules et
    # les bretelles bleues, un filet rouge sous le bras.
    def teinte_france(co):
        ay = abs(co.y)
        if co.z > 1.300 and ay > 0.050:
            return BLEU_FRANCE
        if 0.118 < ay < 0.136 and 1.205 < co.z < 1.300:
            return ROUGE_FRANCE
        return MAILLOT

    pieces = [
        # sans fondu : sur un arc de un centimetre, un anneau fondu vers la
        # peau le rendait brun, dessine au crayon
        ('Meba_sourcils', sourcils, 0.0016, SOURCIL, 0.9, 0, 0),
        ('Meba_levres', levres, 0.0002, LEVRES, 0.62, 0, 3),
        # le maillot passe PAR-DESSUS le short : plus bas et plus epais que
        # lui la ou ils se croisent, sans quoi le short ressortait en
        # languettes a travers l'ourlet
        ('Meba_maillot', maillot, 0.0068, MAILLOT, 0.55, 0, 0, teinte_france),
        # du lycra mat : brillant, il soulignait chaque courbe de la hanche
        ('Meba_short', short, epaisseur_short, SHORT, 0.68),
        ('Meba_bandeau', bandeau, 0.0035, BANDEAU, 0.7),
        ('Meba_ras', ras, 0.0015, CHEVEU, 0.9),
        # un fondu de deux rangs : le visage de MakeHuman est grossier, et sur
        # quatre, le menton n'atteignait jamais sa pleine epaisseur
        ('Meba_barbe', barbe, epaisseur_barbe, BARBE, 0.95, 0, 2),
    ]
    out = [chaussure(h, rig, 1), chaussure(h, rig, -1)]
    for piece in pieces:
        nom, garder, e, col, r = piece[:5]
        out.append(coque(h, rig, nom, garder, e, col, r,
                         lisser=piece[5] if len(piece) > 5 else 0,
                         fondu=piece[6] if len(piece) > 6 else 0,
                         teinte=piece[7] if len(piece) > 7 else None))
    # et la peau
    h.data.materials.clear()
    peau = materiau('Meba_peau', PEAU, 0.58)
    bsdf = next(n for n in peau.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.08
        bsdf.inputs['Subsurface Radius'].default_value = (0.9, 0.35, 0.2)
        bsdf.inputs['Subsurface Scale'].default_value = 0.01
    # LE GRAIN DE LA PEAU, pour les portraits : un bruit fin en relief (des
    # pores), que Cycles rend et que l'export glTF ignore — le jeu n'en a
    # pas besoin a sa distance.
    nt = peau.node_tree
    if not any(n.type == 'BUMP' for n in nt.nodes):
        bruit = nt.nodes.new('ShaderNodeTexNoise')
        bruit.inputs['Scale'].default_value = 900.0
        bruit.inputs['Detail'].default_value = 3.0
        relief = nt.nodes.new('ShaderNodeBump')
        relief.inputs['Strength'].default_value = 0.10
        relief.inputs['Distance'].default_value = 0.0004
        nt.links.new(bruit.outputs['Fac'], relief.inputs['Height'])
        nt.links.new(relief.outputs['Normal'], bsdf.inputs['Normal'])
    h.data.materials.append(peau)
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
    blanc = materiau('Meba_oeil', (212, 200, 184), 0.10)
    iris = materiau('Meba_iris', (38, 22, 15), 0.15)
    pupille = materiau('Meba_pupille', (8, 8, 10), 0.05)
    for c, r in orbites(h):
        R = r
        # la cornee affleure les paupieres, un demi-millimetre derriere
        centre = c + Vector((-0.0005 - R, 0, 0))
        for nom, rr, dx, mat in (('globe', R, 0.0, blanc), ('iris', R * 0.56, R * 0.90, iris),
                                 ('pupille', R * 0.24, R * 0.99, pupille)):
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
    # les racines au-dessus du bandeau, qu'il porte incline (voir habiller)
    yc = orbites(h)
    zY = sum(e.z for e, _ in yc) / max(1, len(yc)) if yc else 1.5185
    haut_bandeau = lambda x: zY + 0.050 + 0.20 * (x - 0.09) + 0.031
    cuir = [i for i, d in enumerate(dom) if d[2].get('scalp', 0) > 0.4 and V[i].z > haut_bandeau(V[i].x) + 0.002]
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
        L = 0.055 - 0.017 * bord + rnd.uniform(-0.005, 0.005)
        if courte:
            L = rnd.uniform(0.012, 0.020)
        d = (nor * (1.0 - 0.30 * bord) + Vector((-0.55, 0, 0.10))
             + rad.normalized() * (0.10 + 0.30 * bord)
             + Vector((rnd.uniform(-.18, .18), rnd.uniform(-.18, .18), rnd.uniform(0, .12)))).normalized()
        # un axe qui s'incurve en retombant, d'autant plus qu'on est au bord
        axe = [loc + d * (L * t) + Vector((-0.004 * t, 0, -(0.010 + 0.022 * bord) * t * t)) for t in (0, .25, .5, .75, 1)]
        u = d.orthogonal().normalized(); w = d.cross(u).normalized()
        tours, rh = rnd.uniform(2.0, 3.0), 0.0026
        for phase in (0.0, math.pi):
            pts = []
            N = 12
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
    cu.dimensions = '3D'; cu.bevel_depth = 0.0047; cu.bevel_resolution = 1
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
    # LE BRUN NE TIENT QUE LA RACINE. Fondu sur deux centimetres, il couvrait
    # presque toute la vanille — les courtes restaient brunes d'un bout a
    # l'autre — et, a soixante pixels de haut, le blond ne se voyait plus :
    # il vire au blond des six premiers millimetres.
    me = o.data
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    racine = Vector([srgb_vers_lin(c / 255) for c in CHEVEU])
    pointe = Vector([srgb_vers_lin(c / 255) for c in MECHES])
    for v in me.vertices:
        loc, _, _, dist = arbre.find_nearest(v.co)
        t = max(0.0, min(1.0, (dist - 0.002) / 0.006))
        c = racine.lerp(pointe, t * t * (3 - 2 * t))
        col.data[v.index].color = (c.x, c.y, c.z, 1.0)
    mat = bpy.data.materials.new('Meba_vanilles')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(nd for nd in nt.nodes if nd.type == 'BSDF_PRINCIPLED')
    ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'
    nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.55
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
    # LES RAYONS PARTENT DE L'AXE DU COU, vers l'exterieur : tires de dehors,
    # ils touchaient d'abord les trapezes, et la chaine passait sur les
    # epaules. Du dedans, le premier contact est la peau du cou.
    axe = Vector((0.012, 0.0, 0.0))
    pts = []
    for k in range(48):
        a = 2 * math.pi * k / 48
        devant = max(0.0, math.cos(a)) ** 2
        z = 1.392 - 0.034 * devant
        dirn = Vector((math.cos(a), math.sin(a), -0.35 * devant)).normalized()
        hit = arbre.ray_cast(axe + Vector((0, 0, z)), dirn)
        if hit[0] is not None:
            pts.append(hit[0] + hit[1].normalized() * 0.0030 * (1 if hit[1].dot(dirn) > 0 else -1))
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


# --- LE DOSSARD ------------------------------------------------------------------
# Une vraie feuille sur le maillot, pas une boite : un morceau de la poitrine,
# decolle d'un millimetre et demi du maillot, qui en epouse donc la courbure ;
# et son nom en lettres, modelees, posees sur la feuille. C'est ce qui manquait
# au dossard des tubes : il n'avait ni courbure ni inscription, on n'en voyait
# que la tranche.

# Un papier creme, a peine plus chaud que le maillot : sur un maillot blanc,
# c'est son nom et son bandeau qui le font lire, pas son epaisseur.
DOSSARD = (240, 236, 222)
ENCRE = (26, 30, 58)


def inscription(support, rig, texte, y, z, taille, couleur, nom):
    """Des lettres modelees, posees sur `support` (une coque), qui en suivent
    la courbure et les os."""
    from mathutils.bvhtree import BVHTree
    arbre = BVHTree.FromPolygons([v.co.copy() for v in support.data.vertices],
                                 [tuple(p.vertices) for p in support.data.polygons])
    cu = bpy.data.curves.new(nom, 'FONT')
    cu.body = texte
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    cu.size = taille
    cu.extrude = 0.0006
    try:
        cu.font = bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Black.ttf', check_existing=True)
    except Exception:
        pass
    o = bpy.data.objects.new(nom, cu)
    bpy.context.scene.collection.objects.link(o)
    # le texte est ecrit dans le plan xy : on le dresse face a l'avant (+x)
    o.rotation_euler = (math.radians(90), 0, math.radians(90))
    o.location = (0.3, y, z)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.active_object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for v in o.data.vertices:
        hit = arbre.ray_cast(Vector((0.4, v.co.y, v.co.z)), Vector((-1, 0, 0)))
        if hit[0] is not None:
            devant = 0.0006 + (v.co.x - 0.3)
            v.co = hit[0] + hit[1].normalized() * max(0.0004, devant + 0.0005)
    o.data.materials.append(materiau(nom, couleur, 0.6))
    transferer_poids(o, support, rig)
    return o


def dossard(h, rig):
    """Le maillot porte FRANCE sur la poitrine, et le dossard, petit, sur le
    cote — comme sur ses photos de championnat."""
    maillot = bpy.data.objects['Meba_maillot']
    inscription(maillot, rig, "FRANCE", 0.0, 1.150, 0.048, BLEU_FRANCE, 'Meba_france')
    def feuille(c, n, d):
        return c.x > 0.02 and n.x > 0.3 and 1.215 < c.z < 1.275 and 0.035 < c.y < 0.105
    f = coque(h, rig, 'Meba_dossard', feuille, 0.0083, DOSSARD, 0.8)
    inscription(f, rig, "ZÉZÉ", 0.070, 1.245, 0.014, ENCRE, 'Meba_nom')
    return f


# --- L'EXPORT ----------------------------------------------------------------
def reunir(h, rig):
    """Toutes les pieces en UN maillage pondere : un seul objet a animer dans le
    jeu, un appel de dessin par matiere."""
    pieces = [o for o in bpy.context.scene.objects
              if o.type == 'MESH' and o.name.startswith('Meba_') and o is not h]
    bpy.ops.object.select_all(action='DESELECT')
    for o in pieces + [h]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = h
    bpy.ops.object.join()
    h.name = 'Meba'
    # les groupes de MakeHuman ne portent aucun os : ils ne partent pas
    for g in list(h.vertex_groups):
        if g.name not in rig.data.bones:
            h.vertex_groups.remove(g)
    return h


def exporter(h, rig, chemin):
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    h.select_set(True); rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    os.makedirs(os.path.dirname(os.path.abspath(chemin)), exist_ok=True)
    # le rig est le parent du maillage pondere (la regle du glTF), et seule la
    # scene « Meba » part : sans `use_active_scene`, le cube de la scene de
    # demarrage partait avec lui.
    mw = h.matrix_world.copy(); h.parent = rig; h.matrix_world = mw
    bpy.ops.export_scene.gltf(filepath=chemin, export_format='GLB', use_selection=True,
                              use_active_scene=True,
                              export_skins=True, export_animations=False,
                              export_morph=False, export_yup=True, export_apply=False,
                              export_attributes=True, export_def_bones=False,
                              export_meshopt_compression_enable=True)
    return os.path.getsize(chemin)


def tout(glb=None, blend=None):
    sc, h, rig = corps()
    habiller(h, rig)
    dossard(h, rig)
    yeux(h, rig)
    vanilles(h, rig)
    chaine(h, rig)
    boucle(h, rig)
    h = reunir(h, rig)
    if glb:
        print('GLB :', exporter(h, rig, glb), 'octets')
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=blend, copy=True)
    return h, rig




# --- LES PORTRAITS -------------------------------------------------------------
# Ceux de sa fiche, de sa banniere et de l'ecran du skin (DefiVedette.tsx) :
# le meme maillage que dans la course, rendu dans Cycles. En buste de trois
# quarts, et en pied, debout, les bras le long du corps (le clap au-dessus
# de la tete cachait le visage et ouvrait les emmanchures). Fond
# transparent : l'interface pose ses propres couleurs derriere.

CLAP = {'upperarm_l': (2.62, -0.55, 0.0), 'upperarm_r': (2.62, 0.55, 0.0),
        'lowerarm_l': (3.12, 1.05, 0.0), 'lowerarm_r': (3.12, -1.05, 0.0),
        'hand_l': (3.12, 1.05, 0.0), 'hand_r': (3.12, -1.05, 0.0),
        'thigh_l': (0.05, 0.0, 0.10), 'thigh_r': (-0.02, 0.0, -0.10),
        'calf_l': (0.0, 0.0, 0.10), 'calf_r': (-0.04, 0.0, -0.10),
        'foot_l': (0.0, 0.0, 0.25), 'foot_r': (0.0, 0.0, -0.25),
        'head': (-0.12, 0.0, 0.0), 'neck_01': (-0.05, 0.0, 0.0)}
# EN PIED : les bras tombent le long du corps, le coude a peine plie, les
# pieds un peu ouverts ; la tete droite, tournee vers l'objectif.
# Le repos du rig a les bras DANS les hanches (main a y 0,157, flanc a
# 0,168) : il faut les ecarter un peu (roule positive a gauche = dehors),
# sinon les mains passent devant le short ou disparaissent derriere.
# Mesure : main a y 0,243, x 0,043, le flanc a 0,149 — la main detachee de
# la cuisse de huit centimetres (a quatre, on la voyait collee au short).
EN_PIED = {'upperarm_l': (0.04, 0.16, 0.0), 'upperarm_r': (0.04, -0.16, 0.0),
           'lowerarm_l': (0.14, 0.20, 0.0), 'lowerarm_r': (0.14, -0.20, 0.0),
           'hand_l': (0.14, 0.20, 0.0), 'hand_r': (0.14, -0.20, 0.0),
           'thigh_l': (0.03, 0.0, 0.10), 'thigh_r': (0.0, 0.0, -0.10),
           'calf_l': (0.0, 0.0, 0.10), 'calf_r': (-0.02, 0.0, -0.10),
           'foot_l': (0.0, 0.0, 0.25), 'foot_r': (0.0, 0.0, -0.25),
           'head': (0.02, 0.0, 0.16), 'neck_01': (0.0, 0.0, 0.06)}
DEBOUT = {'upperarm_l': (0.10, -0.12, 0.0), 'upperarm_r': (0.10, 0.12, 0.0),
          'lowerarm_l': (0.45, -0.08, 0.0), 'lowerarm_r': (0.45, 0.08, 0.0),
          'hand_l': (0.45, -0.08, 0.0), 'hand_r': (0.45, 0.08, 0.0),
          'head': (0.04, 0.0, 0.18), 'neck_01': (0.0, 0.0, 0.08)}


def studio():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 160
    sc.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception:
        pass
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'WEBP'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.quality = 90
    # LES COULEURS DU JEU, PAS CELLES D'UN FILM. AgX eclaircit les noirs et
    # desature les vifs : le bandeau sortait gris, les pointes jaune pale.
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    w = sc.world or bpy.data.worlds.new('Studio')
    sc.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.08, 0.09, 0.12, 1)
    bg.inputs['Strength'].default_value = 0.6
    for n in [o for o in sc.objects if o.name.startswith('Studio_')]:
        bpy.data.objects.remove(n, do_unlink=True)
    def lampe(nom, loc, energie, taille, couleur=(1, 1, 1)):
        l = bpy.data.lights.new(nom, 'AREA'); l.energy = energie; l.size = taille; l.color = couleur
        o = bpy.data.objects.new('Studio_' + nom, l); sc.collection.objects.link(o)
        o.location = loc
        d = Vector((0, 0, 1.2)) - Vector(loc)
        o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    # un eclairage qui garde sa peau BRUN FONCE : plus fort, il la rendait
    # caramel, et il ne ressemblait plus a ses photos
    lampe('cle', (2.4, -1.6, 2.4), 270, 1.6, (1.0, 0.96, 0.9))
    lampe('fill', (2.0, 2.2, 1.4), 85, 2.0, (0.85, 0.9, 1.0))
    lampe('decoupe', (-2.2, 0.3, 2.2), 300, 1.0, (0.8, 0.88, 1.0))


def camera_portrait(loc, cible, focale):
    sc = bpy.context.scene
    cam = bpy.data.objects.get('Studio_camera')
    if cam is None:
        cam = bpy.data.objects.new('Studio_camera', bpy.data.cameras.new('Studio_camera'))
        sc.collection.objects.link(cam)
    cam.data.lens = focale
    cam.location = loc
    cam.rotation_euler = (Vector(cible) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    return cam


def visage_rendu(rig, dossier, echantillons=64):
    """Le visage seul, de face et de trois quarts : pour le comparer a ses
    photos, passe apres passe."""
    sc = bpy.context.scene
    studio()
    sc.cycles.samples = echantillons
    os.makedirs(dossier, exist_ok=True)
    poser(rig, {'head': (0.0, 0.0, 0.0), 'neck_01': (0.0, 0.0, 0.0),
                'upperarm_l': (0.1, -0.1, 0.0), 'upperarm_r': (0.1, 0.1, 0.0)})
    sc.render.resolution_x, sc.render.resolution_y = 640, 720
    sc.render.image_settings.file_format = 'PNG'
    # la camera a hauteur des yeux, comme celle de l'interview : plus haute,
    # elle regardait le visage de haut et allongeait le nez a l'ecran
    for nom, loc in (('face', (0.95, 0.0, 1.515)), ('34', (0.80, -0.52, 1.52))):
        camera_portrait(loc, (0.03, 0.0, 1.505), 95)
        sc.render.filepath = os.path.join(dossier, 'visage-' + nom + '.png')
        bpy.ops.render.render(write_still=True)
    sc.render.image_settings.file_format = 'WEBP'


def portraits(rig, dossier):
    sc = bpy.context.scene
    studio()
    os.makedirs(dossier, exist_ok=True)
    poser(rig, DEBOUT)
    sc.render.resolution_x, sc.render.resolution_y = 900, 1000
    camera_portrait((1.35, -0.75, 1.42), (0.02, 0.0, 1.36), 70)
    sc.render.filepath = os.path.join(dossier, 'meba-buste.webp')
    bpy.ops.render.render(write_still=True)
    poser(rig, EN_PIED)
    sc.render.resolution_x, sc.render.resolution_y = 900, 1200
    # cadre sur le corps entier : les bras baisses, le haut de l'image
    # restait vide et les pieds touchaient le bord
    camera_portrait((2.55, -1.35, 0.98), (0.0, 0.0, 0.85), 54)
    sc.render.filepath = os.path.join(dossier, 'meba-pied.webp')
    bpy.ops.render.render(write_still=True)


# Le lancement, en dernier : tout ce qu'il appelle est defini au-dessus.
if __name__ == '__main__' and bpy.app.background:
    A = arguments()
    h, rig = tout(A['glb'], A['blend'])
    if A['visage']:
        visage_rendu(rig, A['visage'])
    if A['portraits']:
        portraits(rig, A['portraits'])
