# -----------------------------------------------------------------------
# SPRINTER — les spectateurs et leurs sieges, rendus dans Blender.
#
#   blender -b -P tools/blender/decors/tribune.py
#
# LE PUBLIC ETAIT A LA MAUVAISE ECHELLE. Les gradins du jeu sont a la taille
# reelle ; les spectateurs, eux, etaient des figurines de onze pixels semees
# au hasard dans une tuile repetee — le tiers de la taille d'un coureur.
# Une foule de nains qui se chevauchent ne se lit pas : on voyait un semis
# de confettis, pas des gens.
#
# Ici chaque spectateur est a l'echelle des coureurs, ASSIS sur un siege,
# face a la piste. Il est rendu sous la vue du jeu (vue.py) avec sa lumiere
# (matiere.py), en trois gestes — assis, qui applaudit, debout les bras
# leves — et sous vingt-six caps, pour les lignes droites comme pour les
# virages.
#
# LES COULEURS NE SONT PAS RENDUES, ELLES SONT POSEES PAR LE JEU. Chaque
# image est rendue en six passes, dans la meme mise en page :
#
#   base      ce qui ne change pas de couleur : les chaussures
#   peau      la peau, en blanc eclaire : le jeu la teinte a la carnation
#   maillot   le haut, en blanc eclaire : le jeu le teinte a la couleur
#   siege     le siege, en blanc eclaire : le jeu le teinte a celle du stade
#   cheveux   la chevelure ou la casquette, en blanc eclaire
#   pantalon  le bas, en blanc eclaire
#
# Chaque passe masque ce que les autres couvrent (un bras devant le maillot
# le cache vraiment), donc les six se superposent sans jamais se trahir.
#
# LA FOULE ETAIT FAITE DE CLONES. Tout le monde portait le meme pantalon
# marine et les memes cheveux bruns coupes court : sur trois mille
# spectateurs, seuls le haut et la peau changeaient, et la tribune se lisait
# comme une equipe en survetement. Les cheveux et le pantalon ont donc leur
# passe, que le jeu teinte comme le reste, et la tete a trois silhouettes :
# cheveux courts, cheveux longs qui tombent sur la nuque, casquette.
#
# L'ATLAS EST SERRE, ET C'EST LUI QUI PAIE LE RESTE. Chaque image avait sa
# case de 1,7 x 2,7 m ; un spectateur assis n'en occupe pas le tiers, et les
# quatre planches pesaient 4 862 x 1 188 pixels chacune — quatre-vingt-douze
# megaoctets une fois decodees, sur un telephone. Ici chaque figure est
# mesuree AVANT le rendu (la projection du jeu est lineaire, ses sommets
# suffisent), les rectangles sont ranges en etageres, et chaque case est
# deplacee dans la scene pour tomber a sa place. Et l'atlas est rendu a
# quatre-vingts pixels par metre, la densite exacte a laquelle le jeu compose
# ses images (PPM_IMAGE, tribune.js) : il n'y a plus rien a reechantillonner.
# -----------------------------------------------------------------------

import bpy
import bmesh
import sys
import os
import math
import json
import numpy as np
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vue
import matiere as M
import importlib
for mod in (vue, M):
    importlib.reload(mod)

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
PPM = 80.0                        # pixels par metre dans l'atlas (= PPM_IMAGE)
# --ultra : l'atlas du palier ULTRA du jeu (voir tribune.js), pour une toile a
# trois pixels par point. Une fois et demie la densite — cent vingt pixels par
# metre, contre cent trente-deux pour un pixel d'atlas par pixel d'ecran : a
# deux fois, les six passes pesaient plus de trois cents megaoctets decodees
# sur un telephone —, et des formes rondes a soixante-quatre facettes au
# moins, la regle de l'ULTRA (voir pieces.FACETTES_MIN). Pose par main().
ULTRA = False
FACETTES_MIN = 64
SILHOUETTES = ['court', 'long', 'casquette']
GESTES = ['assis', 'applaudit', 'debout']
# Une ligne de l'atlas par silhouette et par geste, et une pour le siege vide.
LIGNES = ['%s-%s' % (s, g) for s in SILHOUETTES for g in GESTES] + ['vide']
# Vingt-quatre caps reguliers, et les quatre caps exacts des lignes droites
# (0 et 180, avec et sans la rotation de vue des courses en virage).
CAPS = sorted(set([15.0 * k for k in range(24)] + [346.0, 166.0]))
LARGEUR = 2048                    # la largeur de l'atlas, en pixels
MARGE = 3                         # le vide autour de chaque figure, en pixels

CATEGORIES = ('base', 'peau', 'maillot', 'siege', 'cheveux', 'pantalon')


# -----------------------------------------------------------------------
# LA MODELISATION
# -----------------------------------------------------------------------

def _poser(o, cat, racine):
    o.parent = racine
    o['cat'] = cat
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def _mesh(nom, bm, cat, racine):
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    return _poser(o, cat, racine)


def boite(nom, cat, racine, c, t, rot_x=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=t, verts=bm.verts)
    if rot_x:
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rot_x, 3, 'X'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=c, verts=bm.verts)
    return _mesh(nom, bm, cat, racine)


def membre(nom, cat, racine, a, b, r0, r1=None, cotes=8):
    """Un tronc de cone de a a b, bouts arrondis par une petite sphere."""
    a, b = Vector(a), Vector(b)
    r1 = r0 if r1 is None else r1
    if ULTRA:
        cotes = max(cotes, FACETTES_MIN)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=cotes, radius1=r0, radius2=r1,
                          depth=(b - a).length)
    q = Vector((0, 0, 1)).rotation_difference((b - a).normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(),
                        verts=bm.verts)
    for centre, r in ((a, r0), (b, r1)):
        s = bmesh.new()
        u, v = (FACETTES_MIN, FACETTES_MIN // 2) if ULTRA else (8, 5)
        bmesh.ops.create_uvsphere(s, u_segments=u, v_segments=v, radius=r)
        bmesh.ops.translate(s, vec=centre, verts=s.verts)
        me = bpy.data.meshes.new('tmp')
        s.to_mesh(me); s.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    return _mesh(nom, bm, cat, racine)


def boule(nom, cat, racine, c, r, sx=1.0, sy=1.0, sz=1.0, seg=12, demi=False):
    if ULTRA:
        seg = max(seg, FACETTES_MIN)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2 + 1, radius=r)
    for v in bm.verts:
        if demi and v.co.z < 0:
            v.co.z *= 0.25
        v.co.x *= sx; v.co.y *= sy; v.co.z *= sz
    bmesh.ops.translate(bm, vec=c, verts=bm.verts)
    return _mesh(nom, bm, cat, racine)


def buste(nom, cat, racine, bas, haut, lb, lh, pb, ph):
    """Un tronc a section ovale : large aux epaules, plus etroit a la taille."""
    bm = bmesh.new()
    n = 10
    anneaux = []
    for (c, l, p) in ((bas, lb, pb), (haut, lh, ph)):
        anneaux.append([bm.verts.new((c[0] + l * math.cos(2 * math.pi * k / n),
                                      c[1] + p * math.sin(2 * math.pi * k / n), c[2]))
                        for k in range(n)])
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((anneaux[0][k], anneaux[0][j], anneaux[1][j], anneaux[1][k]))
    bm.faces.new(list(reversed(anneaux[0])))
    bm.faces.new(anneaux[1])
    return _mesh(nom, bm, cat, racine)


def siege(racine, releve=False):
    """Un siege coque de stade : l'assise, le dossier, et la patte au sol."""
    boite('patte', 'siege', racine, (0, 0.16, 0.22), (0.10, 0.10, 0.44))
    if releve:
        # un siege dont on s'est leve : l'assise se replie contre le dossier,
        # d'un seul tenant avec lui — replie a part, il flottait en l'air
        boite('assise', 'siege', racine, (0, 0.15, 0.62), (0.44, 0.06, 0.38))
    else:
        boite('assise', 'siege', racine, (0, 0.02, 0.43), (0.44, 0.40, 0.05))
    boite('dossier', 'siege', racine, (0, 0.21, 0.66), (0.44, 0.05, 0.46), rot_x=-0.12)


def chevelure(racine, silhouette, yb, tete):
    """Ce que la tete porte, dans la passe `cheveux` : le jeu la teinte.

    A quinze pixels de haut, une tete se reconnait a sa masse, pas a ses
    traits. Trois masses suffisent a casser la foule de clones :

      court      une calotte a peine plus large que le crane, qui descend a
                 l'arriere — c'est elle qui dit « une tete » ;
      long       la meme, et une masse qui tombe sur la nuque et depasse de
                 part et d'autre du cou : le visage est ENCADRE ;
      casquette  une calotte plus ronde et une visiere qui avance au-dessus
                 des yeux. Teintee comme une casquette, pas comme des cheveux
                 (voir tribune.js).
    """
    if silhouette == 'long':
        boule('cheveux', 'cheveux', racine, (0, yb + 0.012, tete[2] + 0.03), 0.116,
              sy=1.12, sz=0.98, demi=True)
        # la masse de la nuque : derriere la tete, jusqu'aux epaules, et un
        # rien plus large qu'elle pour se voir de face
        boule('nuque', 'cheveux', racine, (0, yb + 0.05, tete[2] - 0.075), 0.12,
              sx=1.02, sy=0.72, sz=1.42)
    elif silhouette == 'casquette':
        boule('calotte', 'cheveux', racine, (0, yb + 0.004, tete[2] + 0.03), 0.116,
              sy=1.1, sz=0.92, demi=True)
        # la visiere : elle part du front et avance de huit centimetres
        boite('visiere', 'cheveux', racine, (0, yb - 0.02 - 0.162, tete[2] + 0.028),
              (0.17, 0.12, 0.018))
    else:
        boule('cheveux', 'cheveux', racine, (0, yb + 0.012, tete[2] + 0.025), 0.112,
              sy=1.1, sz=0.95, demi=True)


def spectateur(racine, silhouette, geste):
    """Face a -Y (vers la piste), le siege a l'origine."""
    if geste == 'vide':
        siege(racine)
        return
    debout = geste == 'debout'
    siege(racine, releve=debout)
    if debout:
        zb, yb = 0.92, -0.18
    else:
        zb, yb = 0.50, 0.04
    # le bassin et les jambes
    boite('bassin', 'pantalon', racine, (0, yb, zb), (0.34, 0.22, 0.16))
    for s in (-1, 1):
        x = s * 0.10
        if debout:
            genou, cheville = (x * 1.05, yb - 0.02, 0.48), (x * 1.1, yb, 0.08)
        else:
            genou, cheville = (x * 1.08, yb - 0.44, 0.52), (x * 1.1, yb - 0.50, 0.08)
        membre('cuisse', 'pantalon', racine, (x, yb, zb), genou, 0.078, 0.062)
        membre('tibia', 'pantalon', racine, genou, cheville, 0.056, 0.045)
        boite('chaussure', 'base', racine, (cheville[0], cheville[1] - 0.06, 0.04), (0.10, 0.24, 0.08))
    # le buste, le cou, la tete. Les cheveux longs vont a une carrure un peu
    # plus fine : deux gabarits valent mieux qu'un.
    epaule = zb + 0.44
    lh = 0.172 if silhouette == 'long' else 0.19
    buste('buste', 'maillot', racine, (0, yb + 0.01, zb + 0.04), (0, yb, epaule), 0.155, lh, 0.105, 0.115)
    membre('cou', 'peau', racine, (0, yb, epaule), (0, yb - 0.01, epaule + 0.10), 0.048)
    tete = (0, yb - 0.02, epaule + 0.22)
    boule('tete', 'peau', racine, tete, 0.105, sy=1.08, sz=1.1)
    chevelure(racine, silhouette, yb, tete)
    # les bras, attaches a la carrure
    ep = lh + 0.01
    for s in (-1, 1):
        sh = (s * ep, yb, epaule - 0.04)
        if geste == 'assis':
            coude, main = (s * (ep + 0.03), yb - 0.10, zb + 0.18), (s * 0.13, yb - 0.30, zb + 0.10)
        elif geste == 'applaudit':
            coude, main = (s * (ep + 0.04), yb - 0.22, zb + 0.30), (s * 0.04, yb - 0.36, zb + 0.50)
        else:
            coude, main = (s * (ep + 0.11), yb - 0.06, epaule + 0.28), (s * (ep + 0.07), yb - 0.10, epaule + 0.56)
        membre('bras', 'maillot', racine, sh, coude, 0.050, 0.044)
        membre('avant_bras', 'peau', racine, coude, main, 0.040, 0.034)
        boule('main', 'peau', racine, main, 0.045)


# -----------------------------------------------------------------------
# LA MISE EN PAGE : MESURER, RANGER, PLACER
# -----------------------------------------------------------------------

def construire():
    """Toutes les figures, chacune sous sa case, toutes a l'origine."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    racine = vue.racine_miroir()
    cases = []
    for li, ligne in enumerate(LIGNES):
        silhouette, geste = ligne.split('-') if ligne != 'vide' else (None, 'vide')
        for ci, cap in enumerate(CAPS):
            e = bpy.data.objects.new('case', None)
            bpy.context.collection.objects.link(e)
            e.parent = racine
            e.rotation_euler = (0, 0, math.radians(cap))
            spectateur(e, silhouette, geste)
            cases.append((li, ci, e))
    bpy.context.view_layer.update()
    return racine, cases


def emprise(e):
    """Le rectangle d'image d'une figure, en pixels, autour du pied du siege.

    La projection du jeu est lineaire (vue.py) : les sommets suffisent, sans
    rien rendre. Le pied du siege est a l'origine de la case.
    """
    x0 = y0 = 1e9
    x1 = y1 = -1e9
    for o in e.children:
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        for v in o.data.vertices:
            w = mw @ v.co
            X, Y, Z = w.y, w.x, w.z               # retour du miroir
            px = PPM * vue.COS * (-X + Y)
            py = -PPM * (vue.SIN * (X + Y) + Z)
            x0 = min(x0, px); x1 = max(x1, px)
            y0 = min(y0, py); y1 = max(y1, py)
    return x0, y0, x1, y1


def ranger(tailles, largeur):
    """Des etageres : les plus hautes d'abord, de gauche a droite."""
    ordre = sorted(range(len(tailles)), key=lambda i: (-tailles[i][1], -tailles[i][0]))
    x = y = haut = 0
    places = [None] * len(tailles)
    for i in ordre:
        w, h = tailles[i]
        if x + w > largeur:
            x, y, haut = 0, y + haut, 0
        places[i] = (x, y)
        x += w
        haut = max(haut, h)
    return places, y + haut


def point_du_pixel(px, py, W, H):
    """Le point au sol du jeu qui tombe au pixel (px, py) d'une image W x H
    centree sur l'origine du jeu (voir vue.camera)."""
    a = (px - W / 2.0) / (PPM * vue.COS)          # -X + Y
    b = -(py - H / 2.0) / (PPM * vue.SIN)         #  X + Y
    return ((b - a) / 2.0, (a + b) / 2.0, 0.0)


# -----------------------------------------------------------------------
# LES PASSES
# -----------------------------------------------------------------------

def materiaux():
    base = {'chaussure': (30, 30, 36)}
    mats = {}
    for nom, c in base.items():
        mats['base:' + nom] = M.peinture('base_' + nom, c, liseret=0.5)
    blanc = M.peinture('blanc', (255, 255, 255), liseret=0.5)
    trou = bpy.data.materials.new('trou')
    trou.use_nodes = True
    nt = trou.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    h = nt.nodes.new('ShaderNodeHoldout')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(h.outputs[0], out.inputs['Surface'])
    return mats, blanc, trou


def appliquer(passe, mats, blanc, trou):
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        cat = o.get('cat')
        nom = o.name.split('.')[0]
        o.data.materials.clear()
        if passe == 'base':
            m = mats.get('base:' + nom) if cat == 'base' else trou
            o.data.materials.append(m or trou)
        else:
            o.data.materials.append(blanc if cat == passe else trou)


def main():
    global ULTRA, PPM, LARGEUR
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ULTRA = '--ultra' in args
    if ULTRA:
        PPM, LARGEUR = PPM * 1.5, int(LARGEUR * 1.5)
    racine, cases = construire()

    # 1. mesurer chaque figure et ranger les rectangles
    emprises = [emprise(e) for (_, _, e) in cases]
    tailles = [(int(math.ceil(x1 - x0)) + 2 * MARGE + 1, int(math.ceil(y1 - y0)) + 2 * MARGE + 1)
               for (x0, y0, x1, y1) in emprises]
    places, H = ranger(tailles, LARGEUR)
    W = LARGEUR
    H = int(H) + (int(H) % 2)

    # 2. placer chaque case pour que sa figure tombe dans son rectangle
    for (li, ci, e), (x0, y0, _, _), (px, py) in zip(cases, emprises, places):
        ax, ay = px + MARGE - x0, py + MARGE - y0
        e.location = point_du_pixel(ax, ay, W, H)
    bpy.context.view_layer.update()

    sc = bpy.context.scene
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Raw'
    vue.eevee(sc)
    sc.eevee.taa_render_samples = 24
    # Rendu directement en WebP : l'atlas part tel quel dans le jeu.
    sc.render.image_settings.file_format = 'WEBP'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.quality = 94
    cam = vue.camera(PPM, W, H, centre=(0.0, 0.0, 0.0))
    mats, blanc, trou = materiaux()

    # 3. les six passes
    dossier = os.path.join(RACINE, 'public', 'decors-ultra' if ULTRA else 'decors', 'tribune')
    os.makedirs(dossier, exist_ok=True)
    for passe in CATEGORIES:
        appliquer(passe, mats, blanc, trou)
        sc.render.filepath = os.path.join(dossier, passe + '.webp')
        bpy.ops.render.render(write_still=True)
        print('  passe %s : %dx%d' % (passe, W, H))

    # 4. les ancres, relues sur la camera plutot que deduites : c'est ce que
    # le rendu a vraiment fait qui fait foi
    n_caps = len(CAPS)
    ancres = [[None] * n_caps for _ in LIGNES]
    for (li, ci, e) in cases:
        a = vue.ancre_pixel(cam, tuple(e.location))
        ancres[li][ci] = [round(a[0], 2), round(a[1], 2)]

    # LE CADRE UTILE DE CHAQUE IMAGE, mesure sur les six passes a la fois, en
    # pixels de l'atlas, par rapport au pied du siege. On le cherche dans le
    # rectangle de la figure et sa marge, pas au-dela : le voisin commence
    # juste apres.
    alpha = None
    for passe in CATEGORIES:
        im = bpy.data.images.load(os.path.join(dossier, passe + '.webp'))
        w, h = im.size
        a = np.empty(w * h * 4, dtype=np.float32)
        im.pixels.foreach_get(a)
        a = a.reshape(h, w, 4)[::-1, :, 3]
        bpy.data.images.remove(im)
        alpha = a if alpha is None else np.maximum(alpha, a)
    cadres = [[None] * n_caps for _ in LIGNES]
    for (li, ci, e), (tw, th), (px, py) in zip(cases, tailles, places):
        ax, ay = ancres[li][ci]
        ys, xs = np.nonzero(alpha[py:py + th, px:px + tw] > 0.01)
        if len(xs) == 0:
            cadres[li][ci] = [0, 0, 1, 1]
            continue
        cadres[li][ci] = [round(px + xs.min() - ax, 1), round(py + ys.min() - ay, 1),
                          round(px + xs.max() + 1 - ax, 1), round(py + ys.max() + 1 - ay, 1)]
    man = {'ppm': PPM, 'poses': LIGNES, 'silhouettes': SILHOUETTES, 'gestes': GESTES,
           'caps': CAPS, 'ancres': ancres, 'passes': list(CATEGORIES), 'w': W, 'h': H,
           'cadres': cadres}
    f_man = os.path.join(RACINE, 'src', 'game',
                         'tribune-manifeste-ultra.json' if ULTRA else 'tribune-manifeste.json')
    json.dump(man, open(f_man, 'w'), indent=1)
    print('manifeste : ' + f_man)


if __name__ == '__main__':
    main()
