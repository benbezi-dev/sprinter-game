# -----------------------------------------------------------------------
# JUMPER — le sable du saut en longueur, rendu dans Blender.
#
#   blender -b -P tools/blender/longueur/sable.py
#   python tools/blender/longueur/sable.py        (avec le module `bpy`)
#
# Trois choses, et chacune est une MATIERE avant d'etre une image :
#
#   - LA FOSSE, ratissee. Un sable qu'on vient de passer au rateau n'est pas
#     une couleur : ce sont des sillons de quatre centimetres, tires par
#     bandes de soixante, qui accrochent le soleil. Un aplat beige ne dit pas
#     « sable », il dit « rectangle ».
#
#   - LES EMPREINTES. Le juge mesure la trace la plus proche de la ligne : il
#     faut donc qu'on la VOIE, et qu'on voie la difference entre deux talons
#     plantes loin devant et des fesses tombees en arriere. Le sable remue est
#     plus sombre — celui du dessous est humide — et ses bords remontent en
#     bourrelet.
#
#   - LA GERBE. A la reception, le sable part en avant, en grains et en
#     mottes. Elle est rendue sous la vue du jeu, image par image, comme un
#     decor debout : c'est une chose qui vole, pas une chose posee.
#
# LA LUMIERE EST CELLE DU JEU, ET PAS CELLE DE BLENDER. Le moteur eclaire tout
# par une formule ecrite a la main (eclairer, sprinter-app.js ; reprise dans
# decors/matiere.py) :
#
#     teinte = couleur x (0,34 + 0,60 soleil + 0,20 ciel + 0,06 sol)
#
# On la garde terme a terme, avec deux choses de plus que seule une vraie
# scene peut donner, et c'est pour elles qu'on passe par Blender : le terme
# de SOLEIL devient un vrai soleil, qui projette l'ombre d'un bourrelet dans
# son sillon ; le terme AMBIANT est attenue par l'occlusion, qui assombrit le
# fond d'une empreinte. Sur un sol plat, le resultat est exactement la
# formule du jeu — calibre : un soleil de force pi rend 1 sur un blanc face a
# lui, donc 0,60 pi rend le 0,60 de la formule.
#
# Les heightfields sont calcules ici, dans numpy : c'est ce qui permet de
# savoir, au pixel pres, ou est la trace la plus proche de la ligne, et de
# l'ecrire dans le manifeste pour que le moteur la pose sur la marque.
# -----------------------------------------------------------------------

import bpy
import sys
import os
import math
import json
import numpy as np

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ICI, '..', 'decors'))
import vue  # noqa: E402

RACINE = os.path.abspath(os.path.join(ICI, '..', '..', '..'))
SORTIE = os.path.join(RACINE, 'src', 'assets', 'longueur')
MANIFESTE = os.path.join(RACINE, 'src', 'game', 'longueur-manifeste.json')

# Pixels de texture par metre. Au plus pres, le jeu montre la fosse a une
# cinquantaine de pixels CSS le metre, cent sur un ecran retina : 128 garde
# le grain du sable sans peser.
PPM_SOL = 128.0
# La gerbe se rend a l'echelle des decors debout (decors-manifeste.json).
PPM_DEBOUT = 96.0

# Les couleurs, en valeurs du jeu (0-255, sans conversion : la vue est Raw).
SABLES = {
    # le sable de tous les stades de la Terre
    'terre': dict(sable=(222, 190, 138), bord=(196, 194, 188)),
    # le stade intergalactique : une poussiere d'etoiles, lavande
    'cosmos': dict(sable=(184, 170, 206), bord=(96, 84, 128)),
}

# La fosse, en metres depuis la ligne d'appel (voir game/longueur.js, FOSSE).
FOSSE = dict(debut=2.0, fond=11.0, largeur=2.75, bord=0.12)

rng = np.random.default_rng(20260927)


# -------------------------------------------------------------- outils

def vider():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = False
    # Pas de rebond : la formule du jeu n'en a pas.
    sc.cycles.max_bounces = 0
    sc.cycles.diffuse_bounces = 0
    sc.view_settings.view_transform = 'Raw'
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'
    w = bpy.data.worlds.new('noir')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.0


def lire(f):
    img = bpy.data.images.load(f)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(img)
    return a[::-1].copy()          # ligne 0 en haut


def ecrire_webp(a, f, qualite=90):
    h, w = a.shape[:2]
    img = bpy.data.images.new('sortie', w, h, alpha=True)
    img.pixels = np.clip(a[::-1], 0, 1).ravel().tolist()
    img.filepath_raw = f
    img.file_format = 'WEBP'
    bpy.context.scene.render.image_settings.quality = qualite
    img.save()
    bpy.data.images.remove(img)


def _n(nt, typ, **kw):
    n = nt.nodes.new(typ)
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def _m(nt, op, a, b=None):
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = op
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def matiere_sable(nom, attribut=True, couleur=None, ao=0.10):
    """La formule du jeu, avec un vrai soleil et une occlusion ambiante.

    La couleur vient de l'attribut `Col` des sommets (le grain, l'humidite du
    sable remue) ou d'une teinte fixe.
    """
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    if attribut:
        col = _n(nt, 'ShaderNodeAttribute', attribute_name='Col').outputs['Color']
    else:
        c = _n(nt, 'ShaderNodeRGB')
        c.outputs[0].default_value = (couleur[0] / 255, couleur[1] / 255, couleur[2] / 255, 1)
        col = c.outputs[0]
    geo = _n(nt, 'ShaderNodeNewGeometry')
    sep = _n(nt, 'ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Normal'], sep.inputs[0])
    nz = sep.outputs['Z']
    ciel = _m(nt, 'ADD', _m(nt, 'MULTIPLY', nz, 0.5), 0.5)
    sol = _m(nt, 'SUBTRACT', 0.5, _m(nt, 'MULTIPLY', nz, 0.5))
    occ = _n(nt, 'ShaderNodeAmbientOcclusion', samples=16)
    occ.inputs['Distance'].default_value = ao
    amb = _m(nt, 'MULTIPLY', occ.outputs['AO'], 0.34)
    t = _m(nt, 'ADD', amb, _m(nt, 'MULTIPLY', ciel, 0.20))
    t = _m(nt, 'ADD', t, _m(nt, 'MULTIPLY', sol, 0.06))
    mul = _n(nt, 'ShaderNodeVectorMath', operation='SCALE')
    nt.links.new(col, mul.inputs[0])
    nt.links.new(t, mul.inputs['Scale'])
    em = _n(nt, 'ShaderNodeEmission')
    nt.links.new(mul.outputs[0], em.inputs['Color'])
    dif = _n(nt, 'ShaderNodeBsdfDiffuse')
    nt.links.new(col, dif.inputs['Color'])
    add = _n(nt, 'ShaderNodeAddShader')
    nt.links.new(em.outputs[0], add.inputs[0])
    nt.links.new(dif.outputs[0], add.inputs[1])
    out = _n(nt, 'ShaderNodeOutputMaterial')
    nt.links.new(add.outputs[0], out.inputs['Surface'])
    return m


def soleil():
    s = vue.soleil(force=0.60 * math.pi)
    # un soleil net : l'ombre d'un bourrelet de deux centimetres doit rester
    # un trait, pas un halo
    s.data.angle = math.radians(1.5)
    return s


def maillage(nom, X, Y, H, C, racine, mat):
    """Une grille de hauteurs, dans le repere du jeu, sous la racine miroir."""
    ny, nx = H.shape
    xs, ys = np.meshgrid(X, Y)
    co = np.stack([xs.ravel(), ys.ravel(), H.ravel()], 1).astype(np.float32)
    me = bpy.data.meshes.new(nom)
    me.vertices.add(nx * ny)
    me.vertices.foreach_set('co', co.ravel())
    i = np.arange(nx * ny).reshape(ny, nx)
    q = np.stack([i[:-1, :-1], i[:-1, 1:], i[1:, 1:], i[1:, :-1]], -1).reshape(-1, 4)
    nq = len(q)
    me.loops.add(nq * 4)
    me.loops.foreach_set('vertex_index', q.ravel().astype(np.int32))
    me.polygons.add(nq)
    me.polygons.foreach_set('loop_start', (np.arange(nq) * 4).astype(np.int32))
    me.polygons.foreach_set('loop_total', np.full(nq, 4, np.int32))
    me.update(calc_edges=True)
    me.validate()
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    rgba = np.concatenate([C.reshape(-1, 3), np.ones((nx * ny, 1), np.float32)], 1)
    ca.data.foreach_set('color', rgba.astype(np.float32).ravel())
    me.polygons.foreach_set('use_smooth', np.ones(nq, bool))
    me.materials.append(mat)
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    o.parent = racine
    return o


def camera_dessus(X0, X1, Y0, Y1, ppm):
    """La vue d'aplomb de decors/fabriquer.py : droite = +X du jeu, bas = +Y."""
    import mathutils
    W = int(round((X1 - X0) * ppm))
    H = int(round((Y1 - Y0) * ppm))
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.pixel_aspect_x = sc.render.pixel_aspect_y = 1.0
    cd = bpy.data.cameras.new('dessus')
    cd.type = 'ORTHO'
    cd.ortho_scale = max(X1 - X0, Y1 - Y0)
    cd.sensor_fit = 'AUTO'
    cam = bpy.data.objects.new('dessus', cd)
    bpy.context.collection.objects.link(cam)
    sc.camera = cam
    loc = mathutils.Vector(((Y0 + Y1) / 2, (X0 + X1) / 2, 50))
    droite = mathutils.Vector((0, 1, 0))
    haut = mathutils.Vector((-1, 0, 0))
    regard = mathutils.Vector((0, 0, -1))
    cam.matrix_world = mathutils.Matrix.Translation(loc) @ \
        mathutils.Matrix((droite, haut, -regard)).transposed().to_4x4()
    return W, H


def rendre(f):
    sc = bpy.context.scene
    sc.render.filepath = f
    bpy.ops.render.render(write_still=True)
    return lire(f)


def bruit(shape, echelle_px, amp=1.0):
    """Un bruit doux : du blanc, lisse par une gaussienne separable."""
    b = rng.standard_normal(shape).astype(np.float32)
    s = max(1.0, echelle_px)
    r = int(3 * s)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / s) ** 2)
    k /= k.sum()
    # bords en miroir, puis convolution « valide » : la taille ne bouge pas,
    # meme quand le noyau est plus long que la grille
    for ax in (0, 1):
        b = np.apply_along_axis(
            lambda v: np.convolve(np.pad(v, r, mode='wrap'), k, mode='valid'), ax, b)
    b /= (b.std() + 1e-9)
    return b * amp


def lisse(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


# ------------------------------------------------------------- la fosse

def fosse(nom_sable):
    """Le bac ratisse, sa bordure. Une texture vue d'aplomb, en metres."""
    vider()
    P = SABLES[nom_sable]
    b = FOSSE['bord']
    X0, X1 = FOSSE['debut'] - b, FOSSE['fond'] + b
    Y0, Y1 = -FOSSE['largeur'] / 2 - b, FOSSE['largeur'] / 2 + b
    pas = 1 / 125.0
    X = np.arange(X0, X1 + pas / 2, pas, dtype=np.float32)
    Y = np.arange(Y0, Y1 + pas / 2, pas, dtype=np.float32)
    xs, ys = np.meshgrid(X, Y)
    dedans = (xs > X0 + b) & (xs < X1 - b) & (ys > Y0 + b) & (ys < Y1 - b)

    # LE RATEAU. Tire dans le sens du saut, par bandes de soixante
    # centimetres : chaque passe a ses dents a elle, un peu decalees et un peu
    # ondulees — c'est ce qui fait qu'on lit un geste et pas une trame.
    H = np.zeros_like(xs)
    bande = 0.60
    k = np.floor((ys - Y0) / bande).astype(int)
    phases = rng.uniform(0, 1, 16)
    ondes = rng.uniform(0.004, 0.012, 16)
    freqs = rng.uniform(0.5, 1.2, 16)
    decal = ys + ondes[k] * np.sin(2 * math.pi * freqs[k] * xs / 3.0 + phases[k] * 6)
    dent = 0.043
    sillon = 0.5 + 0.5 * np.cos(2 * math.pi * (decal / dent + phases[k]))
    H += 0.0055 * sillon ** 2
    # la fin de chaque passe : le rateau souleve, les sillons s'estompent
    H *= 0.55 + 0.45 * lisse((xs - (X0 + b)) / 0.4) * lisse(((X1 - b) - xs) / 0.6)
    # le sable n'est jamais plan
    H += bruit(xs.shape, 70, 0.0022)
    H += rng.standard_normal(xs.shape).astype(np.float32) * 0.0006
    H = np.where(dedans, H, 0.0)

    # la bordure : un rebord de caoutchouc a peine plus haut que le sable
    bordure = ~dedans
    H = np.where(bordure, 0.010, H)

    # LA COULEUR. Le fond d'un sillon est un rien plus sombre — le sable du
    # dessous garde l'humidite —, et le grain varie d'un point a l'autre.
    s = np.array(P['sable'], np.float32) / 255
    base = s[None, None, :] * (1 + 0.02 * bruit(xs.shape, 45)[..., None])
    base *= (1 - 0.06 * (1 - sillon))[..., None]
    base *= (1 + 0.05 * rng.standard_normal(xs.shape).astype(np.float32))[..., None]
    bo = np.array(P['bord'], np.float32) / 255
    C = np.where(bordure[..., None], bo[None, None, :], base)

    racine = vue.racine_miroir()
    maillage('fosse', X, Y, H, C, racine, matiere_sable('sable'))
    soleil()
    W, Hpx = camera_dessus(X0, X1, Y0, Y1, PPM_SOL)
    a = rendre('/tmp/longueur-fosse.png')
    nomf = 'fosse-%s.webp' % nom_sable
    ecrire_webp(a, os.path.join(SORTIE, nomf), 88)
    return {'f': nomf, 'x0': round(X0, 3), 'y0': round(Y0, 3),
            'mw': round(W / PPM_SOL, 4), 'mh': round(Hpx / PPM_SOL, 4)}


# ------------------------------------------------------- les empreintes

def sillon(xs, ys, x0, y0, long, larg, prof, bourrelet=0.35):
    """Un talon qui laboure : entre en biais, s'enfonce, repousse le sable."""
    u = (xs - x0) / long
    v = (ys - y0) / (larg / 2)
    # le profil en long : entree douce, fond vers les deux tiers, fin ronde
    along = np.where(u < 0.65, lisse(u / 0.65) ** 0.7, lisse((1.12 - u) / 0.47))
    along = np.where((u < 0) | (u > 1.12), 0, along)
    across = np.clip(1 - v ** 2, 0, 1) ** 0.8
    creux = -prof * along * across
    # le sable repousse en avant et sur les cotes
    front = np.exp(-((u - 1.18) / 0.16) ** 2) * np.exp(-(v / 1.3) ** 2)
    cotes = np.exp(-((np.abs(v) - 1.25) / 0.35) ** 2) * lisse(u / 0.3) * lisse((1.15 - u) / 0.3)
    return creux + prof * bourrelet * (front + 0.35 * cotes)


def cuvette(xs, ys, x0, y0, rx, ry, prof, bourrelet=0.25):
    """Une depression ovale — fesses, genoux, mains — et son bourrelet."""
    d = np.sqrt(((xs - x0) / rx) ** 2 + ((ys - y0) / ry) ** 2)
    creux = -prof * np.clip(1 - d ** 2, 0, 1) ** 0.9
    bord = prof * bourrelet * np.exp(-((d - 1.12) / 0.22) ** 2)
    return creux + bord


def mottes(xs, ys, x0, x1, y0, y1, n, hauteur):
    """Le sable projete qui retombe : des petites mottes eparses."""
    H = np.zeros_like(xs)
    for _ in range(n):
        cx, cy = rng.uniform(x0, x1), rng.uniform(y0, y1) * rng.uniform(0.3, 1)
        r = rng.uniform(0.012, 0.035)
        H += hauteur * rng.uniform(0.4, 1) * np.exp(-(((xs - cx) ** 2 + (ys - cy) ** 2) / r ** 2))
    return H


EMPREINTES = {
    # Talons plantes loin devant, bassin qui passe au-dessus et retombe sur
    # le cote, mains devant : la reception d'un finaliste. La trace la plus
    # proche de la ligne est l'arriere des talons.
    'avant': lambda xs, ys: (
        sillon(xs, ys, 0.00, -0.10, 0.34, 0.095, 0.070)
        + sillon(xs, ys, 0.02, 0.10, 0.32, 0.095, 0.065)
        + cuvette(xs, ys, 0.62, -0.16, 0.24, 0.18, 0.045)
        + cuvette(xs, ys, 1.02, -0.30, 0.07, 0.05, 0.025)
        + cuvette(xs, ys, 1.00, 0.06, 0.07, 0.05, 0.022)
        + mottes(xs, ys, 0.35, 1.35, -0.45, 0.45, 26, 0.012)),
    # Le bassin tombe a cote des talons, pas au-dela : le ramene etait un
    # peu tot, le corps n'a pas tout a fait passe.
    'cote': lambda xs, ys: (
        sillon(xs, ys, 0.00, -0.08, 0.30, 0.095, 0.065)
        + sillon(xs, ys, 0.03, 0.12, 0.28, 0.095, 0.060)
        + cuvette(xs, ys, 0.30, 0.33, 0.22, 0.17, 0.050)
        + cuvette(xs, ys, 0.62, 0.50, 0.07, 0.05, 0.022)
        + mottes(xs, ys, 0.30, 1.10, -0.40, 0.55, 20, 0.010)),
    # Assis en arriere : les talons devant, les fesses derriere eux, et une
    # main encore derriere. C'est ELLE que le juge mesure.
    'assis': lambda xs, ys: (
        sillon(xs, ys, 0.42, -0.10, 0.26, 0.095, 0.055)
        + sillon(xs, ys, 0.44, 0.10, 0.25, 0.095, 0.050)
        + cuvette(xs, ys, 0.26, 0.00, 0.20, 0.19, 0.070, 0.30)
        + cuvette(xs, ys, 0.04, -0.27, 0.065, 0.05, 0.030)
        + cuvette(xs, ys, 0.05, 0.27, 0.065, 0.05, 0.028)
        + mottes(xs, ys, 0.55, 1.05, -0.35, 0.35, 14, 0.010)),
    # Les pieds sous le bassin : deux appuis courts, les genoux, les mains
    # loin devant — l'athlete a plonge par-dessus ses jambes.
    'pieds': lambda xs, ys: (
        sillon(xs, ys, 0.00, -0.09, 0.19, 0.10, 0.060, 0.5)
        + sillon(xs, ys, 0.01, 0.09, 0.18, 0.10, 0.058, 0.5)
        + cuvette(xs, ys, 0.42, -0.11, 0.08, 0.06, 0.040)
        + cuvette(xs, ys, 0.43, 0.11, 0.08, 0.06, 0.040)
        + cuvette(xs, ys, 0.88, -0.22, 0.075, 0.05, 0.028)
        + cuvette(xs, ys, 0.90, 0.20, 0.075, 0.05, 0.028)
        + mottes(xs, ys, 0.30, 1.20, -0.40, 0.40, 18, 0.010)),
    # Couru a travers la planche : trois appuis de pointes qui s'enfoncent,
    # l'athlete qui freine. Rien ne se mesure, mais le sable le raconte.
    'course': lambda xs, ys: (
        cuvette(xs, ys, 0.10, 0.07, 0.10, 0.045, 0.030, 0.45)
        + cuvette(xs, ys, 1.05, -0.08, 0.11, 0.046, 0.040, 0.45)
        + cuvette(xs, ys, 1.80, 0.06, 0.12, 0.048, 0.050, 0.55)
        + cuvette(xs, ys, 2.25, -0.05, 0.13, 0.050, 0.055, 0.65)),
}
ETENDUE = {
    'avant': (-0.25, 1.50, -0.60, 0.60), 'cote': (-0.25, 1.30, -0.55, 0.75),
    'assis': (-0.30, 1.20, -0.55, 0.55), 'pieds': (-0.25, 1.35, -0.55, 0.55),
    'course': (-0.25, 2.55, -0.35, 0.35),
}


def empreinte(nom, nom_sable):
    vider()
    P = SABLES[nom_sable]
    X0, X1, Y0, Y1 = ETENDUE[nom]
    pas = 1 / 250.0
    X = np.arange(X0, X1 + pas / 2, pas, dtype=np.float32)
    Y = np.arange(Y0, Y1 + pas / 2, pas, dtype=np.float32)
    xs, ys = np.meshgrid(X, Y)
    H = EMPREINTES[nom](xs, ys).astype(np.float32)
    # le sable remue : plus de grain, et le masque de ce qui a bouge
    remue = lisse(np.abs(H) / 0.006)
    zone = remue.copy()
    # le masque s'etend un peu au-dela de ce qui a bouge : c'est la que les
    # sillons du rateau disparaissent sous le sable projete
    for _ in range(2):
        zone = np.maximum(zone, 0.92 * np.maximum.reduce([
            np.roll(zone, 3, 0), np.roll(zone, -3, 0), np.roll(zone, 3, 1), np.roll(zone, -3, 1)]))
    zone = lisse(zone * 1.15)
    H = H + zone * rng.standard_normal(xs.shape).astype(np.float32) * 0.0009
    s = np.array(P['sable'], np.float32) / 255
    # Le sable du dessous est humide : plus sombre, un rien plus sature. Plus
    # le creux est profond, plus on le voit.
    fond = lisse(-H / 0.05)
    C = s[None, None, :] * (1 + 0.04 * rng.standard_normal(xs.shape).astype(np.float32))[..., None]
    humide = np.array([0.80, 0.76, 0.70], np.float32)
    C = C * (1 - (zone * 0.10 + fond * 0.22))[..., None] + \
        (s * humide - s)[None, None, :] * (fond * 0.25)[..., None]

    racine = vue.racine_miroir()
    maillage('empreinte', X, Y, H, C, racine, matiere_sable('sable', ao=0.06))
    soleil()
    W, Hpx = camera_dessus(X0, X1, Y0, Y1, PPM_SOL)
    a = rendre('/tmp/longueur-empreinte.png')
    # L'ALPHA EST LE MASQUE DU SABLE REMUE, reechantillonne a l'image : au
    # bord, le sable ratisse de la fosse reapparait en fondu.
    iy = np.clip(((np.arange(Hpx) + 0.5) / PPM_SOL / pas).astype(int), 0, len(Y) - 1)
    ix = np.clip(((np.arange(W) + 0.5) / PPM_SOL / pas).astype(int), 0, len(X) - 1)
    alpha = zone[np.ix_(iy, ix)]
    a[..., 3] = np.clip(alpha, 0, 1) * a[..., 3]
    nomf = 'empreinte-%s-%s.webp' % (nom, nom_sable)
    ecrire_webp(a, os.path.join(SORTIE, nomf), 90)
    # LA TRACE LA PLUS PROCHE DE LA LIGNE : le premier point, en venant de la
    # planche, ou le sable s'est enfonce de plus de cinq millimetres.
    creux = np.nonzero((H < -0.005).any(axis=0))[0]
    trace = float(X[creux[0]]) if len(creux) else 0.0
    return {'f': nomf, 'x0': round(X0, 3), 'y0': round(Y0, 3),
            'mw': round(W / PPM_SOL, 4), 'mh': round(Hpx / PPM_SOL, 4),
            'trace': round(trace, 3)}


# ----------------------------------------------------------- la gerbe

def ecran(P):
    """Le point du jeu a l'ecran, en metres-ecran (voir vue.py)."""
    X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
    return np.stack([vue.COS * (-X + Y), -vue.SIN * (X + Y) - Z], -1)


def centre_jeu(sx, sy):
    return ((-sy / vue.SIN - sx / vue.COS) / 2, (-sy / vue.SIN + sx / vue.COS) / 2, 0.0)


# LE SAUTOIR EST VU DE PROFIL (src/game/sauts-vue.js) : dans le monde, la
# fosse est tournee de 135 degres, sur la diagonale que l'isometrie met a
# l'horizontale de l'ecran. La gerbe part vers l'avant du saut : on la tourne
# comme la fosse, et le sable vole vers la droite de l'image.
ROT_SAUTOIR = 135.0


def gerbe(nom_sable, images=16, fps=30.0):
    """Le sable qui part a la reception, image par image, sous la vue du jeu."""
    P = SABLES[nom_sable]
    n_grains, n_mottes, n_poudre = 950, 90, 1500
    N = n_grains + n_mottes + n_poudre
    # d'ou ils partent : sous et devant les talons
    p0 = np.stack([rng.normal(0.06, 0.08, N), rng.normal(0, 0.11, N),
                   np.full(N, 0.01)], 1)
    # vers ou : en avant surtout, en eventail, et vers le haut
    ang = rng.normal(0, 0.55, N)
    vit = rng.gamma(2.5, 0.7, N) + 0.5
    elev = np.clip(rng.normal(0.95, 0.28, N), 0.25, 1.40)
    v0 = np.stack([vit * np.cos(elev) * np.cos(ang), vit * np.cos(elev) * np.sin(ang),
                   vit * np.sin(elev)], 1)
    rayon = np.concatenate([rng.uniform(0.005, 0.011, n_grains),
                            rng.uniform(0.020, 0.045, n_mottes),
                            rng.uniform(0.0025, 0.004, n_poudre)])
    # les mottes sont lourdes : elles partent moins vite et moins haut
    v0[n_grains:n_grains + n_mottes] *= 0.55
    # la poudre ralentit dans l'air et reste en nuage
    frein = np.concatenate([np.full(n_grains + n_mottes, 0.25), np.full(n_poudre, 3.5)])
    g = np.array([0, 0, -9.81])

    cr, sr = math.cos(math.radians(ROT_SAUTOIR)), math.sin(math.radians(ROT_SAUTOIR))

    def pos(t):
        k = frein[:, None]
        # vitesse freinee par l'air, v = v0 e^-kt, et la pesanteur par-dessus
        x = p0 + v0 * (1 - np.exp(-k * t)) / k + 0.5 * g * t * t * (1 / (1 + 0.6 * k))
        au_sol = x[:, 2] < 0
        x[au_sol, 2] = 0.0
        # dans le monde, comme le sautoir
        x = np.stack([x[:, 0] * cr - x[:, 1] * sr, x[:, 0] * sr + x[:, 1] * cr, x[:, 2]], 1)
        return x, au_sol

    ts = [i / fps for i in range(images)]
    tous = np.concatenate([pos(t)[0] for t in ts] + [pos(0)[0]], 0)
    e = ecran(tous)
    # LE CADRE SUIT LA GERBE, PAS SES GRAINS PERDUS. Quelques grains partent
    # tres loin et tres vite ; cadrer sur eux reduisait la gerbe a une
    # poussiere au milieu d'une image vide. Ceux qui sortent du cadre sortent
    # de l'image, comme ils sortiraient du champ d'une camera.
    marge = 0.06
    sx0, sy0 = np.percentile(e, 1.5, axis=0) - marge
    sx1, sy1 = np.percentile(e, 98.5, axis=0) + marge
    W = int(math.ceil((sx1 - sx0) * PPM_DEBOUT))
    Hh = int(math.ceil((sy1 - sy0) * PPM_DEBOUT))
    W += W % 2
    Hh += Hh % 2
    c = centre_jeu((sx0 + sx1) / 2, (sy0 + sy1) / 2)

    cadres = []
    ancre = None
    s = np.array(P['sable'], np.float32)
    for i, t in enumerate(ts):
        vider()
        sc = bpy.context.scene
        sc.cycles.samples = 64
        racine = vue.racine_miroir()
        x, au_sol = pos(t)
        # une matiere par famille : le grain sec est clair, la motte humide
        m_grain = matiere_sable('grain', attribut=False, couleur=s * 1.02, ao=0.02)
        m_motte = matiere_sable('motte', attribut=False, couleur=s * 0.80, ao=0.02)
        m_poudre = matiere_sable('poudre', attribut=False, couleur=s * 1.06, ao=0.02)
        # UN SEUL MAILLAGE PAR FAMILLE, des icospheres instanciees par
        # sommets : cinq cents objets separes feraient une scene de cinq
        # cents objets pour quelques pixels chacun.
        for fam, (a0, a1), mat in (('grain', (0, n_grains), m_grain),
                                    ('motte', (n_grains, n_grains + n_mottes), m_motte),
                                    ('poudre', (n_grains + n_mottes, N), m_poudre)):
            idx = np.arange(a0, a1)
            # ce qui est retombe se fond dans le sable, sauf les mottes
            if fam != 'motte':
                idx = idx[~au_sol[idx]]
            if len(idx) == 0:
                continue
            import bmesh
            bm = bmesh.new()
            for j in idx:
                r = rayon[j] * (0.75 if fam == 'motte' and au_sol[j] else 1.0)
                m = bmesh.ops.create_icosphere(bm, subdivisions=1 if fam != 'motte' else 2, radius=r)
                dz = r * 0.4 if au_sol[j] else 0
                for v in m['verts']:
                    v.co.x += x[j, 0]
                    v.co.y += x[j, 1]
                    v.co.z += x[j, 2] + dz
            me = bpy.data.meshes.new(fam)
            bm.to_mesh(me)
            bm.free()
            me.materials.append(mat)
            o = bpy.data.objects.new(fam, me)
            bpy.context.collection.objects.link(o)
            o.parent = racine
        soleil()
        cam = vue.camera(PPM_DEBOUT, W, Hh, centre=c)
        a = rendre('/tmp/longueur-gerbe.png')
        # la poudre est un voile, pas des billes : on adoucit
        cadres.append(a)
        if ancre is None:
            ancre = vue.ancre_pixel(cam, (0, 0, 0))

    # la planche d'images, en une ligne
    feuille = np.concatenate(cadres, 1)
    nomf = 'gerbe-%s.webp' % nom_sable
    ecrire_webp(feuille, os.path.join(SORTIE, nomf), 90)
    return {'f': nomf, 'images': images, 'fps': fps, 'w': W, 'h': Hh,
            'ax': round(ancre[0], 2), 'ay': round(ancre[1], 2), 'ppm': PPM_DEBOUT}


# ---------------------------------------------------------------- tout

def main():
    os.makedirs(SORTIE, exist_ok=True)
    seuls = None
    if '--' in sys.argv:
        seuls = sys.argv[sys.argv.index('--') + 1:] or None
    man = {'ppm': PPM_SOL, 'fosse': {}, 'empreintes': {}, 'gerbe': {}}
    if os.path.exists(MANIFESTE):
        with open(MANIFESTE) as f:
            man.update(json.load(f))
    for nom_sable in SABLES:
        if not seuls or 'fosse' in seuls:
            man['fosse'][nom_sable] = fosse(nom_sable)
            print('fosse', nom_sable)
        if not seuls or 'empreintes' in seuls:
            man['empreintes'].setdefault(nom_sable, {})
            for nom in EMPREINTES:
                man['empreintes'][nom_sable][nom] = empreinte(nom, nom_sable)
                print('empreinte', nom, nom_sable)
        if not seuls or 'gerbe' in seuls:
            man['gerbe'][nom_sable] = gerbe(nom_sable)
            print('gerbe', nom_sable)
    with open(MANIFESTE, 'w') as f:
        json.dump(man, f, indent=1, sort_keys=True)
    print('manifeste', MANIFESTE)


if __name__ == '__main__':
    main()
