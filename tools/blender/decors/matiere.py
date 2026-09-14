# -----------------------------------------------------------------------
# SPRINTER — la lumiere du jeu, en matiere Blender.
#
# Un decor eclaire par Blender — soleil physique, rebonds, reflets — serait
# plus beau pris seul, et faux une fois pose dans le stade : les coureurs, la
# piste et les gradins sont eclaires par une formule ecrite a la main
# (eclairer, sprinter-app.js), et c'est elle que l'oeil compare. Un objet qui
# prend la lumiere autrement se detache comme un autocollant.
#
# On reprend donc la formule elle-meme, terme a terme, et on la calcule dans
# le shader a partir de la normale de chaque facette :
#
#     teinte = couleur x (0,34 + 0,60 soleil + 0,20 ciel + 0,06 sol)
#            + liseret (ajoute, jamais multiplie)
#
# La matiere est une EMISSION, rendue sans aucune transformation de couleur
# (vue « Raw ») : ce qui sort dans l'image est exactement ce que le moteur
# aurait peint. Les facettes sont plates, comme celles des coureurs.
# -----------------------------------------------------------------------

import bpy
import math

LUMIERE = (-0.42, 0.28, 0.86)
_n = math.sqrt(sum(v * v for v in LUMIERE))
LUMIERE = tuple(v / _n for v in LUMIERE)
COS, SIN = 2 / math.sqrt(5), 1 / math.sqrt(5)
_v = (COS, COS, -2 * COS * SIN)
_n = math.sqrt(sum(v * v for v in _v))
VUE = tuple(v / _n for v in _v)


def _math(nt, op, a, b=None, x=0, y=0):
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = op
    n.location = (x, y)
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def _dot(nt, gx, gy, gz, vec, x=0, y=0):
    a = _math(nt, 'MULTIPLY', gx, vec[0], x, y)
    b = _math(nt, 'MULTIPLY', gy, vec[1], x, y - 60)
    c = _math(nt, 'MULTIPLY', gz, vec[2], x, y - 120)
    return _math(nt, 'ADD', _math(nt, 'ADD', a, b, x + 160, y), c, x + 320, y)


def rgb(c):
    """Une couleur du jeu, 0-255, en valeurs de shader 0-1 (sans conversion)."""
    return (c[0] / 255.0, c[1] / 255.0, c[2] / 255.0)


def peinture(nom, couleur, liseret=1.0, alpha=1.0, paliers=0):
    """La matiere a facettes du jeu.

    `paliers` quantifie la teinte : 0 garde la formule continue du moteur, 2
    ou 3 donne les aplats francs des stades peints (Riviera, Trois Soleils),
    ou chaque objet tient en deux ou trois valeurs.
    """
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)

    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Normal'], sep.inputs[0])
    # La scene est en miroir (X et Y echanges, voir vue.py) : la normale du
    # jeu se relit en echangeant a nouveau ses deux premieres composantes.
    gx, gy, gz = sep.outputs['Y'], sep.outputs['X'], sep.outputs['Z']

    nl = _dot(nt, gx, gy, gz, LUMIERE, 0, 0)
    cle = _math(nt, 'MAXIMUM', nl, 0.0, 500, 0)
    ciel = _math(nt, 'ADD', _math(nt, 'MULTIPLY', gz, 0.5, 500, -200), 0.5, 660, -200)
    sol = _math(nt, 'SUBTRACT', 0.5, _math(nt, 'MULTIPLY', gz, 0.5, 500, -300), 660, -300)
    t = _math(nt, 'ADD', 0.34, _math(nt, 'MULTIPLY', cle, 0.60, 820, 0), 980, 0)
    t = _math(nt, 'ADD', t, _math(nt, 'MULTIPLY', ciel, 0.20, 820, -200), 1140, 0)
    t = _math(nt, 'ADD', t, _math(nt, 'MULTIPLY', sol, 0.06, 820, -300), 1300, 0)
    if paliers:
        # des marches franches, centrees sur les valeurs les plus frequentes
        t = _math(nt, 'DIVIDE', _math(nt, 'SNAP', t, 1.0 / paliers, 1460, 0), 1.0, 1620, 0)

    # le liseret : ne prend que sur les faces rasantes
    vd = _dot(nt, gx, gy, gz, VUE, 0, -600)
    bord = _math(nt, 'ADD', 1.0, _math(nt, 'MINIMUM', vd, 0.0, 500, -600), 660, -600)
    rim = _math(nt, 'MULTIPLY', _math(nt, 'MULTIPLY', bord, bord, 820, -600),
                _math(nt, 'MULTIPLY', _math(nt, 'ADD', 0.26,
                      _math(nt, 'MULTIPLY', ciel, 0.74, 820, -760), 980, -760),
                      liseret * 42.0 / 255.0, 1140, -760), 1300, -600)

    col = nt.nodes.new('ShaderNodeRGB')
    col.outputs[0].default_value = (*rgb(couleur), 1)
    mul = nt.nodes.new('ShaderNodeVectorMath')
    mul.operation = 'SCALE'
    nt.links.new(col.outputs[0], mul.inputs[0])
    nt.links.new(t, mul.inputs['Scale'])
    add = nt.nodes.new('ShaderNodeVectorMath')
    add.operation = 'ADD'
    nt.links.new(mul.outputs[0], add.inputs[0])
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    for i in range(3):
        nt.links.new(rim, comb.inputs[i])
    nt.links.new(comb.outputs[0], add.inputs[1])

    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(add.outputs[0], em.inputs['Color'])
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    if alpha < 1.0:
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')
        mix.inputs[0].default_value = alpha
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(em.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
        m.surface_render_method = 'BLENDED'
    else:
        nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m


def aplat(nom, couleur):
    """Une couleur plate, sans lumiere : ce que le moteur peint au sol.

    La piste, la pelouse et les lignes du jeu ne sont pas eclairees — ce sont
    des aplats. Un marquage au sol qui prendrait la lumiere du soleil
    ressortirait plus clair que la pelouse autour de lui.
    """
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*rgb(couleur), 1)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m


def filet(nom, couleur, maille=0.14, epaisseur=0.10, alpha=0.9):
    """Un filet : des mailles opaques sur du vide, par coordonnees UV.

    Utilise pour la cage de lancer. Les mailles sont calculees et non
    modelisees : un filet de sept metres en fils de maillage, c'est des
    dizaines de milliers de faces pour une texture de trois pixels.
    """
    m = peinture(nom, couleur, liseret=0.0)
    nt = m.node_tree
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    em = next(n for n in nt.nodes if n.type == 'EMISSION')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['UV'], sep.inputs[0])

    def bande(sortie):
        # 1 sur le fil, 0 entre les fils
        f = _math(nt, 'FRACT', _math(nt, 'DIVIDE', sortie, maille))
        a = _math(nt, 'LESS_THAN', f, epaisseur)
        return a
    fil = _math(nt, 'MAXIMUM', bande(sep.outputs['X']), bande(sep.outputs['Y']))
    fac = _math(nt, 'MULTIPLY', fil, alpha)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(fac, mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    m.use_backface_culling = False
    return m
