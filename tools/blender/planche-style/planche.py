# -----------------------------------------------------------------------
# SPRINTER — la planche de style.
#
# Une image fixe, pas un decor du jeu : elle dit a quoi Sprinter doit
# ressembler une fois eclaire pour de vrai. Tout ce qu'on y voit vient du
# jeu tel qu'il est — la piste rouge sang et la pelouse du stade `day`
# (THEMES, sprinter-app.js), les bannieres SPRINTER / BENBEZI / JUMPER, les
# sieges bleus, les plots de distance, le juge et le cameraman, la zone
# d'appel peinte avant la planche, la ligne du meneur dans le sable, les
# images remanentes du coureur. On n'y ajoute que ce qui manque au jeu : une
# lumiere, des ombres, de la matiere, de la profondeur.
#
# Deux plans :
#   base    le cadrage de l'ecran Jumper : l'azimut et la plongee de la vue
#           du jeu (voir tools/blender/decors/vue.py), mais en perspective.
#   proche  le moment « RAMENE PARFAIT · CISEAU » : camera basse au bord du
#           bac, reception a 8,08 m.
#
# Usage (Blender 5.2, en arriere-plan, sans toucher au Blender ouvert) :
#   Blender -b --factory-startup -P planche.py -- base apercu sortie.png
#
# Repere de la scene : la piste d'elan court vers +Y en x = 0, la planche
# est en y = 0. Les bannieres et la tribune sont du cote +X, la piste de
# course du cote -X. L'athlete (athlete-entree.glb) regarde vers -Y au repos.
# -----------------------------------------------------------------------

import bpy
import bmesh
import math
import os
import random
import sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ICI = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PLAN = ARGS[0] if len(ARGS) > 0 else 'base'
QUALITE = ARGS[1] if len(ARGS) > 1 else 'apercu'
SORTIE = ARGS[2] if len(ARGS) > 2 else os.path.join(ICI, 'rendus', f'{PLAN}-{QUALITE}.png')
# l'athlete entier, habille pour plier : voir fabriquer_athlete.py
ATHLETE = os.path.join(ICI, 'athlete-complet.blend')
# le logo de la marque, en relief, construit depuis son SVG (dossier logo-3d)
LOGO = '/Volumes/MUSIQUE/BENBEZI/logo-3d/benbezi-logo-3d.blend'
POLICE = '/System/Library/Fonts/Supplemental/Arial Black.ttf'
APERCU = QUALITE == 'apercu'

random.seed(7)

# Le stade `day` (THEMES, sprinter-app.js). On ne s'en ecarte pas : c'est
# la couleur de Sprinter. La lumiere fera le reste.
DAY = dict(
    ciel_haut=(68, 81, 167), ciel_bas=(82, 95, 181),
    pelouse=(36, 106, 26), pelouse_bord=(24, 84, 16),
    piste_a=(138, 10, 10), piste_b=(122, 6, 8),
    ligne=(246, 242, 234), bordure=(252, 252, 252),
    marche=(176, 178, 186), contremarche=(132, 136, 148), toit=(78, 82, 98),
    barriere=(232, 234, 238),
    panneaux=[(214, 74, 62), (44, 108, 186), (240, 196, 70), (60, 152, 118)],
    accent=(240, 158, 46), poussiere=(226, 190, 160),
)
SABLE = (222, 190, 138)
SABLE_SOMBRE = (196, 160, 110)
BETON = (196, 194, 188)
SIEGE = (36, 92, 200)
SARCELLE = (18, 62, 70)
SARCELLE_CLAIR = (28, 84, 92)
OR = (242, 184, 52)
NOIR = (22, 22, 28)
ROSE = (236, 46, 150)


def lin(c, a=1.0):
    """Une couleur du jeu (sRGB 0-255) en lineaire, pour Blender."""
    def f(u):
        u = u / 255.0
        return u / 12.92 if u <= 0.04045 else ((u + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), a)


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
COL = sc.collection


def lier(o):
    COL.objects.link(o)
    return o


# -----------------------------------------------------------------------
# MATIERES
# -----------------------------------------------------------------------

def noeuds(m):
    m.use_nodes = True
    return m.node_tree.nodes, m.node_tree.links


def bsdf_de(m):
    return next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def entree(noeud, nom, typ):
    return next(s for s in noeud.inputs if s.name == nom and s.type == typ)


def sortie(noeud, nom, typ):
    return next(s for s in noeud.outputs if s.name == nom and s.type == typ)


def melange(N, L, fac, a, b):
    """Melange de deux couleurs ; `fac`, `a`, `b` sont des sockets ou des valeurs."""
    mx = N.new('ShaderNodeMix')
    mx.data_type = 'RGBA'
    for s, v in ((entree(mx, 'Factor', 'VALUE'), fac), (entree(mx, 'A', 'RGBA'), a),
                 (entree(mx, 'B', 'RGBA'), b)):
        if isinstance(v, bpy.types.NodeSocket):
            L.new(v, s)
        else:
            s.default_value = v
    return sortie(mx, 'Result', 'RGBA')


def math_n(N, L, op, a, b=0.0, c=0.0):
    n = N.new('ShaderNodeMath')
    n.operation = op
    for i, v in enumerate((a, b, c)):
        if isinstance(v, bpy.types.NodeSocket):
            L.new(v, n.inputs[i])
        else:
            n.inputs[i].default_value = v
    return n.outputs[0]


def relief(N, L, b, vecteur, echelle, force, distance=0.01):
    g = N.new('ShaderNodeTexNoise')
    g.inputs['Scale'].default_value = echelle
    g.inputs['Detail'].default_value = 2.0
    L.new(vecteur, g.inputs['Vector'])
    bp = N.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = force
    bp.inputs['Distance'].default_value = distance
    L.new(g.outputs['Fac'], bp.inputs['Height'])
    L.new(bp.outputs['Normal'], b.inputs['Normal'])


def matiere(nom, c, c2=None, rugo=0.7, spec=0.4, metal=0.0, echelle=6.0,
            grain=0.0, grain_echelle=80.0):
    m = bpy.data.materials.new(nom)
    N, L = noeuds(m)
    b = bsdf_de(m)
    b.inputs['Roughness'].default_value = rugo
    b.inputs['Specular IOR Level'].default_value = spec
    b.inputs['Metallic'].default_value = metal
    tc = N.new('ShaderNodeTexCoord')
    if c2 is None:
        b.inputs['Base Color'].default_value = lin(c)
    else:
        nz = N.new('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = echelle
        nz.inputs['Detail'].default_value = 5.0
        L.new(tc.outputs['Object'], nz.inputs['Vector'])
        r = N.new('ShaderNodeValToRGB')
        r.color_ramp.elements[0].position = 0.3
        r.color_ramp.elements[0].color = lin(c)
        r.color_ramp.elements[1].position = 0.7
        r.color_ramp.elements[1].color = lin(c2)
        L.new(nz.outputs['Fac'], r.inputs['Fac'])
        L.new(r.outputs['Color'], b.inputs['Base Color'])
    if grain > 0:
        relief(N, L, b, tc.outputs['Object'], grain_echelle, grain)
    return m


def matiere_pelouse():
    """La pelouse du jeu, tondue en bandes de 5 m en travers de la piste."""
    m = bpy.data.materials.new('pelouse')
    N, L = noeuds(m)
    b = bsdf_de(m)
    b.inputs['Roughness'].default_value = 0.92
    b.inputs['Specular IOR Level'].default_value = 0.2
    tc = N.new('ShaderNodeTexCoord')
    obj = tc.outputs['Object']
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(obj, sep.inputs['Vector'])
    bande = math_n(N, L, 'GREATER_THAN',
                   math_n(N, L, 'FRACT', math_n(N, L, 'MULTIPLY', sep.outputs['Y'], 0.1)), 0.5)
    nz = N.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 0.35
    nz.inputs['Detail'].default_value = 8.0
    L.new(obj, nz.inputs['Vector'])
    r = N.new('ShaderNodeValToRGB')
    r.color_ramp.elements[0].position = 0.25
    r.color_ramp.elements[0].color = lin(DAY['pelouse_bord'])
    r.color_ramp.elements[1].position = 0.75
    r.color_ramp.elements[1].color = lin((44, 120, 32))
    L.new(nz.outputs['Fac'], r.inputs['Fac'])
    # touffes : un bruit fin qui eclaircit ou fonce d'un rien
    tf = N.new('ShaderNodeTexNoise')
    tf.inputs['Scale'].default_value = 45.0
    tf.inputs['Detail'].default_value = 3.0
    L.new(obj, tf.inputs['Vector'])
    hsv = N.new('ShaderNodeHueSaturation')
    L.new(r.outputs['Color'], hsv.inputs['Color'])
    val = math_n(N, L, 'ADD', math_n(N, L, 'MULTIPLY', bande, 0.16),
                 math_n(N, L, 'MULTIPLY_ADD', tf.outputs['Fac'], 0.3, 0.78))
    L.new(val, hsv.inputs['Value'])
    L.new(hsv.outputs['Color'], b.inputs['Base Color'])
    relief(N, L, b, obj, 260.0, 0.35)
    return m


def matiere_banniere():
    """Les bannieres du jeu : sarcelle raye en biais, confettis dores."""
    m = bpy.data.materials.new('banniere')
    N, L = noeuds(m)
    b = bsdf_de(m)
    b.inputs['Roughness'].default_value = 0.42
    b.inputs['Specular IOR Level'].default_value = 0.5
    tc = N.new('ShaderNodeTexCoord')
    w = N.new('ShaderNodeTexWave')
    w.wave_type = 'BANDS'
    w.bands_direction = 'DIAGONAL'
    w.inputs['Scale'].default_value = 2.2
    L.new(tc.outputs['Object'], w.inputs['Vector'])
    raie = math_n(N, L, 'GREATER_THAN', w.outputs['Fac'], 0.5)
    fond = melange(N, L, raie, lin(SARCELLE), lin(SARCELLE_CLAIR))
    v = N.new('ShaderNodeTexVoronoi')
    v.inputs['Scale'].default_value = 26.0
    L.new(tc.outputs['Object'], v.inputs['Vector'])
    point = math_n(N, L, 'LESS_THAN', v.outputs['Distance'], 0.09)
    sep = N.new('ShaderNodeSeparateColor')
    L.new(v.outputs['Color'], sep.inputs['Color'])
    garde = math_n(N, L, 'GREATER_THAN', sep.outputs[0], 0.6)
    conf = math_n(N, L, 'MULTIPLY', point, garde)
    L.new(melange(N, L, conf, fond, lin(OR)), b.inputs['Base Color'])
    return m


def matiere_attribut(nom, attribut, couleurs, rugo=0.8):
    """Une couleur tiree au sort par attribut de face (le public, les tenues)."""
    m = bpy.data.materials.new(nom)
    N, L = noeuds(m)
    b = bsdf_de(m)
    b.inputs['Roughness'].default_value = rugo
    at = N.new('ShaderNodeAttribute')
    at.attribute_name = attribut
    at.attribute_type = 'GEOMETRY'
    r = N.new('ShaderNodeValToRGB')
    r.color_ramp.interpolation = 'CONSTANT'
    els = r.color_ramp.elements
    n = len(couleurs)
    els[0].position = 0.0
    els[0].color = lin(couleurs[0])
    els[1].position = 1 / n
    els[1].color = lin(couleurs[1])
    for i in range(2, n):
        els.new(i / n).color = lin(couleurs[i])
    L.new(at.outputs['Fac'], r.inputs['Fac'])
    L.new(r.outputs['Color'], b.inputs['Base Color'])
    return m


def matiere_zone_appel():
    """La zone d'appel peinte avant la planche, du rouge (trop tot) au vert."""
    m = bpy.data.materials.new('zone_appel')
    N, L = noeuds(m)
    b = bsdf_de(m)
    tc = N.new('ShaderNodeTexCoord')
    g = N.new('ShaderNodeTexGradient')
    L.new(tc.outputs['Generated'], g.inputs['Vector'])
    # Generated va de 0 a 1 sur la boite de l'objet ; on veut Y
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(tc.outputs['Generated'], sep.inputs['Vector'])
    r = N.new('ShaderNodeValToRGB')
    els = r.color_ramp.elements
    els[0].position = 0.0
    els[0].color = lin((214, 60, 48))
    els[1].position = 1.0
    els[1].color = lin((70, 214, 96))
    els.new(0.45).color = lin(OR)
    L.new(sep.outputs['Y'], r.inputs['Fac'])
    L.new(r.outputs['Color'], b.inputs['Base Color'])
    L.new(r.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 0.5
    b.inputs['Alpha'].default_value = 0.72
    b.inputs['Roughness'].default_value = 0.5
    return m


def translucide(m, alpha):
    """La meme matiere, vue a travers : ce que fait globalAlpha dans le jeu."""
    m = m.copy()
    N, L = m.node_tree.nodes, m.node_tree.links
    out = next(n for n in N if n.type == 'OUTPUT_MATERIAL')
    lien = out.inputs['Surface'].links[0]
    shader = lien.from_socket
    L.remove(lien)
    tr = N.new('ShaderNodeBsdfTransparent')
    mx = N.new('ShaderNodeMixShader')
    mx.inputs['Fac'].default_value = alpha
    L.new(tr.outputs['BSDF'], mx.inputs[1])
    L.new(shader, mx.inputs[2])
    L.new(mx.outputs['Shader'], out.inputs['Surface'])
    return m


def matiere_volume(nom, c, densite):
    m = bpy.data.materials.new(nom)
    N, L = noeuds(m)
    out = next(n for n in N if n.type == 'OUTPUT_MATERIAL')
    for n in list(N):
        if n.type == 'BSDF_PRINCIPLED':
            N.remove(n)
    v = N.new('ShaderNodeVolumePrincipled')
    v.inputs['Color'].default_value = lin(c)
    v.inputs['Density'].default_value = densite
    # un nuage qui s'eteint vers ses bords
    tc = N.new('ShaderNodeTexCoord')
    g = N.new('ShaderNodeTexGradient')
    g.gradient_type = 'SPHERICAL'
    L.new(tc.outputs['Object'], g.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 3.0
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    d = math_n(N, L, 'MULTIPLY', math_n(N, L, 'MULTIPLY', g.outputs['Fac'], nz.outputs['Fac']), densite * 2.5)
    L.new(d, v.inputs['Density'])
    L.new(v.outputs['Volume'], out.inputs['Volume'])
    return m


M = dict(
    pelouse=matiere_pelouse(),
    piste=matiere('piste', DAY['piste_a'], DAY['piste_b'], rugo=0.88, spec=0.3, echelle=2.5,
                  grain=0.3, grain_echelle=420.0),
    ligne=matiere('ligne', DAY['ligne'], rugo=0.6, spec=0.3),
    sable=matiere('sable', SABLE, SABLE_SOMBRE, rugo=0.97, spec=0.15, echelle=3.0,
                  grain=0.5, grain_echelle=180.0),
    beton=matiere('beton', BETON, (176, 174, 168), rugo=0.85, echelle=8.0, grain=0.2, grain_echelle=90.0),
    planche=matiere('planche', DAY['bordure'], rugo=0.45, spec=0.5),
    noir=matiere('noir', NOIR, rugo=0.5, spec=0.4),
    or_=matiere('or', OR, rugo=0.32, spec=0.7, metal=0.35),
    blanc=matiere('blanc', DAY['ligne'], rugo=0.5),
    rose=matiere('rose', ROSE, rugo=0.4, spec=0.5),
    banniere=matiere_banniere(),
    marche=matiere('marche', DAY['marche'], (162, 164, 172), rugo=0.85, echelle=5.0),
    contremarche=matiere('contremarche', DAY['contremarche'], rugo=0.85),
    barriere=matiere('barriere', DAY['barriere'], rugo=0.55),
    toit=matiere('toit', DAY['toit'], rugo=0.6),
    siege=matiere('siege', SIEGE, rugo=0.4, spec=0.55),
    metal=matiere('metal', (168, 174, 184), rugo=0.35, metal=0.8),
    accent=matiere('accent', DAY['accent'], rugo=0.5),
    feuillage=matiere('feuillage', (30, 88, 30), (52, 118, 40), rugo=0.9, echelle=4.0,
                      grain=0.6, grain_echelle=30.0),
    tronc=matiere('tronc', (84, 62, 44), rugo=0.9),
    zone=matiere_zone_appel(),
    toile=matiere('toile', (44, 108, 186), rugo=0.8),
    public_haut=matiere_attribut('public_haut', 'hasard', [
        DAY['panneaux'][0], (250, 242, 232), DAY['panneaux'][1], (44, 40, 54), DAY['panneaux'][2],
        DAY['accent'], (236, 110, 160), DAY['panneaux'][3], (250, 242, 232), (90, 60, 140)]),
    public_peau=matiere_attribut('public_peau', 'peau', [
        (236, 196, 164), (198, 144, 104), (140, 92, 62), (92, 58, 38), (224, 176, 140)], rugo=0.6),
    public_bas=matiere_attribut('public_bas', 'hasard', [
        (40, 52, 84), (30, 30, 36), (70, 74, 86), (46, 60, 96), (120, 110, 96)]),
)


# -----------------------------------------------------------------------
# GEOMETRIE
# -----------------------------------------------------------------------

def objet(nom, bm, mats, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, lisse=False):
    if lisse:
        for f in bm.faces:
            f.smooth = True
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    o = lier(bpy.data.objects.new(nom, me))
    o.location = loc
    o.rotation_euler = rot
    if parent:
        o.parent = parent
    return o


class Lot:
    """Des milliers de petites formes dans un seul maillage (sieges, public,
    grains de sable), en listes brutes. Chaque operateur bmesh reparcourt
    tout le maillage qu'on lui donne : ajouter mille spectateurs un a un
    dans le meme bmesh ne finissait pas en trois quarts d'heure."""

    FACES_BOITE = ((0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5))

    def __init__(self, attributs=()):
        self.v, self.f, self.mat, self.lisse = [], [], [], []
        self.attrs = {a: [] for a in attributs}

    def _faces(self, faces, mat, lisse, valeurs):
        self.f.extend(faces)
        self.mat.extend([mat] * len(faces))
        self.lisse.extend([lisse] * len(faces))
        for a, l in self.attrs.items():
            l.extend([valeurs.get(a, 0.0) if valeurs else 0.0] * len(faces))

    def boite(self, dims, centre, mat=0, valeurs=None):
        b = len(self.v)
        hx, hy, hz = dims[0] / 2, dims[1] / 2, dims[2] / 2
        for i in range(8):
            self.v.append((centre[0] + (hx if i & 1 else -hx), centre[1] + (hy if i & 2 else -hy),
                           centre[2] + (hz if i & 4 else -hz)))
        self._faces([tuple(b + k for k in f) for f in self.FACES_BOITE], mat, False, valeurs)

    def ellipsoide(self, rayons, centre, mat=0, u=10, v=7, valeurs=None):
        b = len(self.v)
        self.v.append((centre[0], centre[1], centre[2] + rayons[2]))
        for k in range(1, v):
            t = math.pi * k / v
            for j in range(u):
                p = 2 * math.pi * j / u
                self.v.append((centre[0] + rayons[0] * math.sin(t) * math.cos(p),
                               centre[1] + rayons[1] * math.sin(t) * math.sin(p),
                               centre[2] + rayons[2] * math.cos(t)))
        self.v.append((centre[0], centre[1], centre[2] - rayons[2]))
        bas = len(self.v) - 1

        def a(k, j):
            return b + 1 + (k - 1) * u + (j % u)
        faces = [(b, a(1, j), a(1, j + 1)) for j in range(u)]
        for k in range(1, v - 1):
            faces += [(a(k, j), a(k + 1, j), a(k + 1, j + 1), a(k, j + 1)) for j in range(u)]
        faces += [(a(v - 1, j), bas, a(v - 1, j + 1)) for j in range(u)]
        self._faces(faces, mat, True, valeurs)

    def objet(self, nom, mats, loc=(0, 0, 0)):
        me = bpy.data.meshes.new(nom)
        me.from_pydata(self.v, [], self.f)
        me.polygons.foreach_set('material_index', self.mat)
        me.polygons.foreach_set('use_smooth', self.lisse)
        for a, l in self.attrs.items():
            me.attributes.new(a, 'FLOAT', 'FACE').data.foreach_set('value', l)
        me.update()
        for m in mats:
            me.materials.append(m)
        o = lier(bpy.data.objects.new(nom, me))
        o.location = loc
        return o


def bm_boite(bm, dims, centre=(0, 0, 0), mat=0):
    r = bmesh.ops.create_cube(bm, size=1.0)
    for v in r['verts']:
        v.co = Vector((v.co.x * dims[0] + centre[0], v.co.y * dims[1] + centre[1],
                       v.co.z * dims[2] + centre[2]))
    faces = {f for v in r['verts'] for f in v.link_faces}
    for f in faces:
        f.material_index = mat
    return faces


def bm_ellipsoide(bm, rayons, centre, mat=0, u=10, v=7):
    r = bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1.0)
    for p in r['verts']:
        p.co = Vector((p.co.x * rayons[0] + centre[0], p.co.y * rayons[1] + centre[1],
                       p.co.z * rayons[2] + centre[2]))
    faces = {f for p in r['verts'] for f in p.link_faces}
    for f in faces:
        f.material_index = mat
        f.smooth = True
    return faces


def boite(nom, dims, loc, mat, rot=(0, 0, 0), biseau=0.0, parent=None):
    bm = bmesh.new()
    bm_boite(bm, dims)
    o = objet(nom, bm, [mat], loc, rot, parent)
    if biseau > 0:
        md = o.modifiers.new('biseau', 'BEVEL')
        md.width = biseau
        md.segments = 2
        md.limit_method = 'ANGLE'
    return o


def cylindre(nom, r1, r2, h, loc, mat, rot=(0, 0, 0), seg=16, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                          radius1=r1, radius2=r2, depth=h)
    bm.normal_update()
    for f in bm.faces:
        f.smooth = abs(f.normal.z) < 0.9
    return objet(nom, bm, [mat], loc, rot, parent)


def entre(nom, a, b, r, mat, seg=10):
    """Un cylindre de a a b (pieds de trepied, hampes)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    o = cylindre(nom, r, r, d.length, (a + b) / 2, mat, seg=seg)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.normalized().to_track_quat('Z', 'Y')
    return o


LOGO_PIECES = []


def logo_source():
    """Les pieces du logo BENBEZI (les deux B en miroir, la barre, les
    points), ajoutees une fois a la scene, cachees : on en pose des copies.
    Le logo mesure 3,91 m sur 0,44 m, debout face a -Y sous son vide."""
    if not LOGO_PIECES:
        with bpy.data.libraries.load(LOGO, link=False) as (src, dst):
            dst.objects = [n for n in src.objects if n.startswith('BENBEZI')]
        for o in dst.objects:
            if o.type == 'MESH':
                LOGO_PIECES.append(o)
    return LOGO_PIECES


LARGEUR_LOGO = 3.91


def logo(loc, rot, echelle, couleur, parent=None, relief=1.0, lueur=0.0):
    """Une copie du logo, de la couleur voulue, le relief et l'arrondi
    d'origine. `relief` aplatit son epaisseur ; `lueur` l'allume comme un
    ecran LED (le panneau de la tribune)."""
    e = vide('logo', loc, rot)
    e.scale = (echelle, echelle, echelle * relief)
    if parent:
        e.parent = parent
    mats = {}
    for piece in logo_source():
        o = piece.copy()
        lier(o)
        o.parent = e
        o.matrix_parent_inverse.identity()
        for sl in o.material_slots:
            m = sl.material
            if m.name not in mats:
                c = m.copy()
                b = bsdf_de(c)
                for l in list(b.inputs['Base Color'].links):
                    c.node_tree.links.remove(l)
                b.inputs['Base Color'].default_value = lin(couleur)
                if lueur > 0:
                    b.inputs['Emission Color'].default_value = lin(couleur)
                    b.inputs['Emission Strength'].default_value = lueur
                mats[m.name] = c
            sl.link = 'OBJECT'
            sl.material = mats[m.name]
    return e


FONTE = []


def largeur(o):
    bpy.context.view_layer.update()
    return o.dimensions.x / (o.parent.scale.x if o.parent else 1.0)


def texte(corps, taille, loc, rot, mat, parent=None, cisaille=0.0, epaisseur=0.004, espace=1.0):
    if not FONTE:
        FONTE.append(bpy.data.fonts.load(POLICE))
    cu = bpy.data.curves.new('texte', 'FONT')
    cu.body = corps
    cu.font = FONTE[0]
    cu.size = taille
    cu.shear = cisaille
    cu.extrude = epaisseur
    cu.space_character = espace
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.materials.append(mat)
    o = lier(bpy.data.objects.new('texte', cu))
    o.location = loc
    o.rotation_euler = rot
    if parent:
        o.parent = parent
    return o


# face tournee vers -X (la piste d'elan), lecture vers -Y (la droite de qui
# regarde depuis la piste)
FACE_MOINS_X = (math.pi / 2, 0, -math.pi / 2)


def vide(nom, loc, rot=(0, 0, 0)):
    e = lier(bpy.data.objects.new(nom, None))
    e.location = loc
    e.rotation_euler = rot
    return e


# -----------------------------------------------------------------------
# LE STADE
# -----------------------------------------------------------------------

def sol():
    # la pelouse, trouee sous le bac : le sable creuse plus bas qu'elle
    bm = bmesh.new()
    for (x0, x1, y0, y1) in ((-200, -1.5, -200, 200), (1.5, 200, -200, 200),
                             (-1.5, 1.5, -200, 0.9), (-1.5, 1.5, 10.1, 200)):
        bm_boite(bm, (x1 - x0, y1 - y0, 0.01), ((x0 + x1) / 2, (y0 + y1) / 2, -0.012))
    objet('pelouse', bm, [M['pelouse']])

    # la piste d'elan et ses deux lignes, jusqu'au bord du bac
    boite('elan', (1.22, 46.0, 0.01), (0, -22.0, -0.001), M['piste'])
    for x in (-0.635, 0.635):
        boite('ligne_elan', (0.05, 46.0, 0.004), (x, -22.0, 0.005), M['ligne'])
    # la planche, puis la zone d'appel qui la precede
    boite('planche', (1.22, 0.2, 0.012), (0, -0.1, 0.004), M['planche'], biseau=0.003)
    z = boite('zone_appel', (1.1, 2.4, 0.002), (0, -1.45, 0.006), M['zone'])
    z.visible_shadow = False

    # la piste de course, cote camera : huit couloirs
    boite('piste', (9.9, 160.0, 0.01), (-2.4 - 4.95, 0, -0.001), M['piste'])
    for k in range(9):
        boite('couloir', (0.05, 160.0, 0.004), (-2.4 - k * 1.22, 0, 0.005), M['ligne'])
    boite('bordure', (0.12, 160.0, 0.05), (-12.4, 0, 0.02), M['barriere'], biseau=0.01)


def hauteur_sable(x, y, crateres):
    z = 0.004 * math.sin(x * 7.1 + y * 2.3) + 0.003 * math.sin(y * 11.7 - x * 3.1)
    for (cx, cy, prof, rx, ry) in crateres:
        d2 = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
        z -= prof * math.exp(-d2 * 2.2)
        # le bourrelet repousse en avant du creux
        d3 = ((x - cx) / (rx * 1.3)) ** 2 + ((y - cy - ry * 0.9) / (ry * 0.7)) ** 2
        z += prof * 0.45 * math.exp(-d3 * 2.0)
    return z


def bac(crateres):
    nx, ny = 84, 270
    x0, x1, y0, y1 = -1.4, 1.4, 1.0, 10.0
    verts, faces = [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            y = y0 + (y1 - y0) * j / ny
            verts.append((x, y, hauteur_sable(x, y, crateres) - 0.004))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    me = bpy.data.meshes.new('sable')
    me.from_pydata(verts, [], faces)
    me.materials.append(M['sable'])
    me.shade_smooth()
    lier(bpy.data.objects.new('sable', me))
    # la margelle
    for (dims, c) in (((3.0, 0.1, 0.06), (0, 0.95, 0.0)), ((3.0, 0.1, 0.06), (0, 10.05, 0.0)),
                      ((0.1, 9.2, 0.06), (-1.45, 5.5, 0.0)), ((0.1, 9.2, 0.06), (1.45, 5.5, 0.0))):
        boite('margelle', dims, c, M['beton'], biseau=0.012)


def ligne_meneur(y, marque):
    """La marque du meneur, tracee en pointille dans le sable (comme en jeu)."""
    for k in range(9):
        x = -1.25 + k * 0.31
        o = boite('pointille', (0.16, 0.035, 0.002), (x, y, 0.004), M['blanc'])
        o.visible_shadow = False
    texte(marque, 0.28, (0.55, y + 0.3, 0.006), (0, 0, math.pi / 2 + 0.0), M['blanc'],
          epaisseur=0.0).visible_shadow = False


def plots():
    for d in range(3, 11):
        p = vide('plot', (1.85, float(d), 0), (0, 0, math.radians(35)))
        cylindre('piquet', 0.012, 0.012, 0.36, (0.02, 0, 0.18), M['noir'], parent=p)
        boite('plot', (0.03, 0.34, 0.3), (0, 0, 0.46), M['noir'], biseau=0.006, parent=p)
        texte(str(d), 0.22, (-0.02, 0, 0.46), FACE_MOINS_X, M['blanc'], parent=p, epaisseur=0.002)


def bannieres():
    for k in range(-6, 5):
        yc = k * 7.5
        p = vide('banniere', (3.2, yc, 0), (0, math.radians(12), 0))
        boite('toile', (0.04, 7.4, 1.0), (0, 0, 0.56), M['banniere'], parent=p, biseau=0.008)
        for zz in (0.07, 1.05):
            boite('lisere', (0.046, 7.4, 0.03), (0, 0, zz), M['or_'], parent=p)
        # SPRINTER, le logo, JUMPER : comme sur les bannieres du jeu, a
        # intervalles egaux sur la toile (la lecture va vers -Y)
        t1 = texte('SPRINTER', 0.5, (-0.028, 0, 0.56), FACE_MOINS_X, M['or_'], parent=p, cisaille=0.2)
        t3 = texte('JUMPER', 0.5, (-0.028, 0, 0.56), FACE_MOINS_X, M['or_'], parent=p, cisaille=0.2)
        el = 0.52
        ws = [largeur(t1), LARGEUR_LOGO * el, largeur(t3)]
        jeu = (7.1 - sum(ws)) / 4
        y = 3.55 - jeu
        centres = []
        for w in ws:
            centres.append(y - w / 2)
            y -= w + jeu
        t1.location.y = centres[0]
        t3.location.y = centres[2]
        logo((-0.03, centres[1], 0.56), FACE_MOINS_X, el, OR, parent=p)
        # les jambes de force, derriere
        for dy in (-3.2, 0, 3.2):
            boite('force', (0.6, 0.04, 0.04), (0.28, dy, 0.3), M['metal'], parent=p,
                  rot=(0, math.radians(-40), 0))


RANGS = 12
Y0, Y1 = -38.0, 32.0


def rang(i):
    """Le devant et le dessus de la marche i de la tribune."""
    return 5.0 + i * 0.85, 0.55 + i * 0.42


def tribune():
    L_ = Y1 - Y0
    yc = (Y0 + Y1) / 2
    boite('barriere', (0.15, L_, 1.15), (4.72, yc, 0.575), M['barriere'], biseau=0.01)
    # un panneau noir BENBEZI rose au milieu de la barriere, comme au niveau national
    boite('pub', (0.03, 9.0, 0.8), (4.63, -2.0, 0.6), M['noir'], biseau=0.005)
    logo((4.605, -2.0, 0.6), FACE_MOINS_X, 1.0, ROSE, relief=0.15, lueur=2.5)

    bm = bmesh.new()
    for i in range(RANGS):
        x, z = rang(i)
        faces = bm_boite(bm, (0.85, L_, z), (x + 0.425, yc, z / 2))
        for f in faces:
            f.material_index = 0
    bm.normal_update()
    for f in bm.faces:
        f.material_index = 0 if f.normal.z > 0.5 else 1
    objet('gradins', bm, [M['marche'], M['contremarche']])

    sieges = Lot()
    public = Lot(('hasard', 'peau'))
    pas = 0.55
    n = int(L_ / pas)
    for i in range(RANGS):
        x, z = rang(i)
        for j in range(n):
            y = Y0 + 0.3 + j * pas
            sieges.boite((0.40, 0.44, 0.06), (x + 0.42, y, z + 0.40))
            sieges.boite((0.06, 0.44, 0.38), (x + 0.64, y, z + 0.60))
            sieges.boite((0.18, 0.18, 0.38), (x + 0.45, y, z + 0.19))
            if random.random() < 0.68:
                spectateur(public, Vector((x + 0.42, y, z + 0.43)))
    sieges.objet('sieges', [M['siege']])
    public.objet('public', [M['public_haut'], M['public_peau'], M['public_bas']])

    # le toit, au fond, sur ses poteaux
    xt, zt = rang(RANGS - 1)
    boite('toit', (8.5, L_ + 2, 0.25), (xt - 2.6, yc, zt + 3.4), M['toit'], rot=(0, math.radians(-6), 0))
    for y in range(int(Y0), int(Y1) + 1, 10):
        cylindre('poteau', 0.12, 0.12, zt + 3.6, (xt + 1.0, y, (zt + 3.6) / 2), M['metal'])
    # des pavillons aux couleurs des panneaux du jeu, sur le bord du toit
    for k, y in enumerate(range(int(Y0) + 2, int(Y1), 6)):
        c = [M['accent'], M['toile'], M['or_'], M['rose']][k % 4]
        base = Vector((xt - 6.6, y, zt + 3.9))
        entre('hampe', base, base + Vector((0, 0, 2.2)), 0.025, M['metal'])
        boite('fanion', (0.02, 0.9, 0.55), base + Vector((0, 0.47, 1.9)), c)


def spectateur(lot, s):
    """Un spectateur assis face au terrain (-X), origine sur l'assise."""
    val = {'hasard': random.random(), 'peau': random.random()}
    leve = random.random() < 0.14
    lot.boite((0.44, 0.30, 0.14), s + Vector((-0.10, 0, 0.09)), mat=2, valeurs=val)
    lot.boite((0.13, 0.26, 0.46), s + Vector((-0.30, 0, -0.18)), mat=2, valeurs=val)
    lot.ellipsoide((0.13, 0.19, 0.30), s + Vector((0.10, 0, 0.44)), mat=0, valeurs=val)
    lot.ellipsoide((0.105, 0.1, 0.12), s + Vector((0.06, 0, 0.86)), mat=1, valeurs=val)
    for cote in (-1, 1):
        if leve:
            lot.ellipsoide((0.05, 0.05, 0.27), s + Vector((0.05, cote * 0.22, 0.98)), mat=0, u=6, v=5,
                           valeurs=val)
        else:
            lot.ellipsoide((0.05, 0.05, 0.24), s + Vector((0.02, cote * 0.22, 0.44)), mat=0, u=6, v=5,
                           valeurs=val)


def mats_projecteurs():
    for y in (-30.0, 26.0):
        base = Vector((22.0, y, 0))
        cylindre('mat', 0.35, 0.22, 30.0, base + Vector((0, 0, 15.0)), M['metal'])
        boite('rampe', (0.4, 5.0, 2.6), base + Vector((-0.4, 0, 30.5)), M['toit'],
              rot=(0, math.radians(-20), 0), biseau=0.05)


def arbres():
    rnd = random.Random(3)
    feuilles = Lot()
    for k in range(26):
        x = 21.0 + rnd.random() * 10.0
        y = -45.0 + k * 3.8 + rnd.random() * 2.0
        h = 7.0 + rnd.random() * 5.0
        cylindre('tronc', 0.25, 0.18, h * 0.5, (x, y, h * 0.25), M['tronc'], seg=8)
        for _ in range(4):
            r = 1.8 + rnd.random() * 1.6
            feuilles.ellipsoide((r, r, r * 0.9), (x + rnd.uniform(-1.2, 1.2), y + rnd.uniform(-1.2, 1.2),
                                                  h * 0.62 + rnd.uniform(0, 2.0)), u=12, v=8)
    feuilles.objet('feuillage', [M['feuillage']])


# -----------------------------------------------------------------------
# L'ATHLETE, SES ECHOS, LE JUGE, LE CAMERAMAN
# -----------------------------------------------------------------------
# Le maillage vient de athlete-entree.glb, sans animation : on le pose en
# ORIENTANT chaque os vers une direction du repere du personnage (il regarde
# -Y au repos, sa gauche est +X). Plus sur que des angles : les axes locaux
# des os du metarig ne se devinent pas.

AV = Vector((0, -1, 0))
HAUT = Vector((0, 0, 1))
GAUCHE = Vector((1, 0, 0))


def dirp(f, u, g=0.0):
    return (AV * f + HAUT * u + GAUCHE * g).normalized()


ORDRE = ['spine', 'spine.001', 'spine.002', 'spine.003', 'spine.004', 'spine.005', 'spine.006',
         'thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R',
         'shoulder.L', 'upper_arm.L', 'forearm.L', 'hand.L',
         'shoulder.R', 'upper_arm.R', 'forearm.R', 'hand.R']

TRONC_COURSE = {'spine': (0.2, 1, 0), 'spine.001': (0.2, 1, 0), 'spine.002': (0.18, 1, 0),
                'spine.003': (0.14, 1, 0), 'spine.004': (0.06, 1, 0), 'spine.005': (0.03, 1, 0),
                'spine.006': (0, 1, 0)}

COURSE = dict(TRONC_COURSE, **{
    'thigh.R': (0.85, -0.55, -0.03), 'shin.R': (-0.35, -1, 0), 'foot.R': (1, -0.35, 0),
    'thigh.L': (-0.45, -0.9, 0.03), 'shin.L': (-0.95, 0.05, 0), 'foot.L': (-0.35, -1, 0),
    'upper_arm.L': (0.5, -0.86, -0.08), 'forearm.L': (0.95, 0.22, -0.15), 'hand.L': (0.95, 0.22, -0.15),
    'upper_arm.R': (-0.65, -0.75, 0), 'forearm.R': (0.3, -0.95, 0), 'hand.R': (0.3, -0.95, 0),
})

# la foulee d'avant : l'autre jambe en avant
COURSE_B = dict(TRONC_COURSE, **{
    'thigh.L': (0.7, -0.7, 0.03), 'shin.L': (-0.2, -1, 0), 'foot.L': (1, -0.3, 0),
    'thigh.R': (-0.3, -0.95, -0.03), 'shin.R': (-0.85, -0.3, 0), 'foot.R': (-0.3, -1, 0),
    'upper_arm.R': (0.45, -0.89, 0.08), 'forearm.R': (0.95, 0.22, 0.15), 'hand.R': (0.95, 0.22, 0.15),
    'upper_arm.L': (-0.55, -0.83, 0), 'forearm.L': (0.3, -0.95, 0), 'hand.L': (0.3, -0.95, 0),
})

# LA RECEPTION, au contact des talons — d'apres « The Phases of the Long
# Jump » (Jumpers University, chapitre de la reception : Fabrice Lapierre a
# 9:16, Tianna Bartoletta a 9:00). Les pieds hauts et loin devant : jambes
# serrees, presque a l'horizontale (la cuisse a 14 degres dessous), genoux a
# peine flechis, pointes relevees ; le bassin a ~30 cm du sable. Le
# buste replie a fond sur les cuisses (la hanche fermee a ~50 degres), la
# tete devant ; les bras tendus devant, mains au-dessus des tibias, juste
# avant de balayer vers l'arriere pour faire passer le corps par-dessus les
# pieds.
RECEPTION = {
    'spine': (0.55, 0.83, 0), 'spine.001': (0.65, 0.76, 0), 'spine.002': (0.72, 0.69, 0),
    'spine.003': (0.76, 0.65, 0), 'spine.004': (0.6, 0.8, 0), 'spine.005': (0.5, 0.87, 0),
    'spine.006': (0.4, 0.92, 0),
    'thigh.L': (0.97, -0.24, 0.02), 'thigh.R': (0.97, -0.24, -0.02),
    'shin.L': (0.95, -0.31, 0.0), 'shin.R': (0.95, -0.31, 0.0),
    'foot.L': (0.35, 0.94, 0), 'foot.R': (0.35, 0.94, 0),
    # Bras tendus devant : l'epaule avance et monte avec eux. Sans elle, le
    # bras tournait seul, le deltoide passait par-dessus la bretelle du
    # debardeur et il n'en restait qu'une pastille jaune.
    'shoulder.L': (0.35, 0.15, 0.92), 'shoulder.R': (0.35, 0.15, -0.92),
    # les bras un peu ecartes : serres, le haut du bras rentrait dans le buste
    'upper_arm.L': (0.93, -0.3, 0.2), 'upper_arm.R': (0.93, -0.3, -0.2),
    'forearm.L': (0.97, -0.2, 0.05), 'forearm.R': (0.97, -0.2, -0.05),
    'hand.L': (0.97, -0.2, 0.0), 'hand.R': (0.97, -0.2, 0.0),
}

ASSIS = {
    'spine': (-0.05, 1, 0), 'spine.001': (-0.05, 1, 0), 'spine.002': (-0.03, 1, 0),
    'spine.003': (0, 1, 0), 'spine.004': (0.08, 1, 0), 'spine.005': (0.1, 1, 0), 'spine.006': (0.1, 1, 0),
    'thigh.L': (1, -0.05, 0.12), 'thigh.R': (1, -0.05, -0.12),
    'shin.L': (0.1, -1, 0.03), 'shin.R': (0.1, -1, -0.03),
    'foot.L': (1, -0.3, 0), 'foot.R': (1, -0.3, 0),
    'upper_arm.L': (0.2, -0.95, 0.15), 'forearm.L': (0.95, -0.15, -0.3), 'hand.L': (0.95, -0.15, -0.3),
    # le bras droit leve : drapeau blanc, l'essai est valable
    'upper_arm.R': (0.1, 0.55, -0.83), 'forearm.R': (0.15, 0.98, -0.12), 'hand.R': (0.15, 0.98, -0.12),
}

FILME = {
    'spine': (0.08, 1, 0), 'spine.001': (0.08, 1, 0), 'spine.002': (0.08, 1, 0),
    'spine.003': (0.1, 1, 0), 'spine.004': (0.12, 1, 0), 'spine.005': (0.12, 1, 0), 'spine.006': (0.12, 1, 0),
    'thigh.L': (0.02, -1, 0.08), 'shin.L': (0, -1, 0.04), 'foot.L': (1, -0.3, 0.1),
    'thigh.R': (-0.02, -1, -0.08), 'shin.R': (0, -1, -0.04), 'foot.R': (1, -0.3, -0.1),
    'upper_arm.L': (0.55, -0.7, 0.3), 'forearm.L': (0.75, 0.6, -0.3), 'hand.L': (0.75, 0.6, -0.3),
    'upper_arm.R': (0.55, -0.7, -0.3), 'forearm.R': (0.75, 0.6, 0.3), 'hand.R': (0.75, 0.6, 0.3),
}


def entre_poses(a, b, t):
    """La pose a la fraction t de a vers b (directions melangees, normees)."""
    return {k: tuple(Vector(a[k]).normalized().lerp(Vector(b[k]).normalized(), t))
            for k in a if k in b}


def importer_athlete():
    with bpy.data.libraries.load(ATHLETE, link=False) as (src, dst):
        dst.objects = list(src.objects)
    for o in dst.objects:
        lier(o)
    arm = next(o for o in dst.objects if o.type == 'ARMATURE')
    maillages = [o for o in dst.objects if o.type == 'MESH']
    return arm, maillages


def poser(arm, pose):
    bpy.context.view_layer.update()
    for nom in ORDRE:
        if nom not in pose:
            continue
        pb = arm.pose.bones[nom]
        cible = dirp(*pose[nom])
        Mx = pb.matrix.copy()
        y = Mx.to_3x3().col[1].normalized()
        R = y.rotation_difference(cible).to_matrix() @ Mx.to_3x3()
        Nx = R.to_4x4()
        Nx.translation = Mx.translation
        pb.matrix = Nx
        bpy.context.view_layer.update()


def habiller(maillages, couleurs):
    for o in maillages:
        for s in o.material_slots:
            if not s.material:
                continue
            base = s.material.name.split('.')[0]
            if base in couleurs:
                m = s.material.copy()
                b = bsdf_de(m)
                for l in list(b.inputs['Base Color'].links):
                    m.node_tree.links.remove(l)
                b.inputs['Base Color'].default_value = lin(couleurs[base])
                s.material = m


def voiler(maillages, alpha):
    for o in maillages:
        for s in o.material_slots:
            if s.material:
                s.material = translucide(s.material, alpha)
        o.visible_shadow = False


def point_bas(maillages):
    dg = bpy.context.evaluated_depsgraph_get()
    bas = None
    for o in maillages:
        oe = o.evaluated_get(dg)
        me = oe.to_mesh()
        mw = oe.matrix_world
        for v in me.vertices:
            w = mw @ v.co
            if bas is None or w.z < bas.z:
                bas = w.copy()
        oe.to_mesh_clear()
    return bas


def cap_vers(dx, dy):
    """La rotation Z qui tourne le regard du personnage (-Y) vers (dx, dy)."""
    return math.atan2(dx, -dy)


def athlete(pose, pos, cap, couleurs=None, voile=None, sol_z=0.0, ancre_basse=None):
    arm, maillages = importer_athlete()
    poser(arm, pose)
    # L'import glTF met l'objet en quaternion : sans ce retour aux angles,
    # rotation_euler est ignore et l'athlete courait vers la planche.
    arm.rotation_mode = 'XYZ'
    arm.rotation_euler = (0, 0, cap)
    arm.location = (pos[0], pos[1], 0)
    bpy.context.view_layer.update()
    corps = [o for o in maillages if o.name.split('.')[0] in ('Corps', 'Chaussures')]
    bas = point_bas(corps)
    if ancre_basse is not None:
        # le point le plus bas (un talon) pose exactement la
        arm.location = arm.location + (Vector(ancre_basse) - bas)
    else:
        arm.location.z -= bas.z - sol_z
    bpy.context.view_layer.update()
    if couleurs:
        habiller(maillages, couleurs)
    if voile:
        voiler(maillages, voile)
    return arm, maillages


def os_monde(arm, nom, bout='tail'):
    pb = arm.pose.bones[nom]
    return arm.matrix_world @ (pb.tail if bout == 'tail' else pb.head)


# semelle foncee : blanche, la chaussure vue de dessous ne se lisait plus
TENUE_JOUEUR = {'maillot': (240, 196, 70), 'short': (30, 36, 70), 'semelle': (70, 72, 80)}
TENUE_JUGE = {'maillot': (44, 108, 186), 'short': (36, 40, 52)}
TENUE_CAMERA = {'maillot': (30, 30, 34), 'short': (30, 30, 34), 'pointes': (40, 40, 44)}


def chaise(x, y, cap, hauteur):
    p = vide('chaise', (x, y, 0), (0, 0, cap))
    boite('assise', (0.46, 0.44, 0.03), (0, 0.05, hauteur), M['toile'], parent=p)
    boite('dossier', (0.46, 0.03, 0.4), (0, 0.29, hauteur + 0.24), M['toile'], parent=p,
          rot=(math.radians(-8), 0, 0))
    for sx in (-0.21, 0.21):
        for sy in (-0.15, 0.27):
            cylindre('pied', 0.012, 0.012, hauteur, (sx, sy, hauteur / 2), M['metal'], parent=p, seg=6)


def juge(x, y, regard):
    cap = cap_vers(*regard)
    arm, _ = athlete(ASSIS, (x, y), cap, TENUE_JUGE)
    hanche = os_monde(arm, 'thigh.L', 'head')
    dos = Vector((-math.sin(cap), math.cos(cap), 0)) * 0.12
    chaise(hanche.x + dos.x, hanche.y + dos.y, cap, hanche.z - 0.1)
    main = os_monde(arm, 'hand.R')
    entre('hampe', main - Vector((0, 0, 0.1)), main + Vector((0, 0, 0.55)), 0.01, M['metal'])
    boite('drapeau', (0.02, 0.42, 0.3), main + Vector((0, 0, 0.38)) + Vector((0.0, 0.22, 0.0)),
          M['blanc'], rot=(0, 0, cap))


def cameraman(x, y, regard):
    cap = cap_vers(*regard)
    arm, _ = athlete(FILME, (x, y), cap, TENUE_CAMERA)
    tete = os_monde(arm, 'spine.006', 'head')
    av = Vector((math.sin(cap), -math.cos(cap), 0))
    c = tete + av * 0.42 + Vector((0, 0, -0.08))
    p = vide('camera_tv', c, (0, 0, cap))
    boite('boitier', (0.2, 0.42, 0.22), (0, 0, 0), M['noir'], parent=p, biseau=0.02)
    cylindre('objectif', 0.07, 0.08, 0.16, (0, -0.28, 0), M['noir'], parent=p, rot=(math.pi / 2, 0, 0))
    boite('voyant', (0.03, 0.03, 0.03), (0.08, 0.1, 0.12), M['rose'], parent=p)
    for k in range(3):
        a = cap + k * 2 * math.pi / 3
        pied = Vector((c.x + 0.45 * math.cos(a), c.y + 0.45 * math.sin(a), 0))
        entre('trepied', c - Vector((0, 0, 0.12)), pied, 0.012, M['metal'], seg=6)


def cones():
    for y, m in ((-11.0, M['accent']), (-16.5, M['toile'])):
        cylindre('cone', 0.09, 0.015, 0.22, (-0.95, y, 0.11), m, seg=14)


def gerbe(talon):
    """Le sable projete par les talons : des grains, et un nuage de poussiere."""
    rnd = random.Random(11)
    grains = Lot()
    for _ in range(1600):
        az = rnd.gauss(0, 0.6)
        el = rnd.uniform(0.15, 1.2)
        t = rnd.random() ** 0.6 * 0.95
        d = Vector((math.sin(az), math.cos(az), 0)) * math.cos(el) * t
        z = math.sin(el) * t - 1.4 * t * t
        if z < -0.01:
            continue
        r = rnd.uniform(0.0025, 0.0075)
        p = talon + d + Vector((rnd.gauss(0, 0.08), rnd.gauss(0, 0.05), z + 0.01))
        grains.ellipsoide((r, r, r), p, u=5, v=4)
    grains.objet('grains', [M['sable']])
    # Chaque nuage est une sphere UNITE mise a l'echelle : le degrade
    # spherique de sa matiere va alors de 1 au centre a 0 au bord, et le
    # nuage s'eteint. Modelee a sa taille, la sphere gardait une densite
    # pleine jusqu'a son bord net : on aurait dit des bulles de verre.
    vol = matiere_volume('poussiere', DAY['poussiere'], 0.3)
    for k in range(4):
        r = rnd.uniform(0.12, 0.25)
        c = talon + Vector((rnd.uniform(-0.3, 0.3), rnd.uniform(0.05, 0.55), r * 0.5))
        bm = bmesh.new()
        bm_ellipsoide(bm, (1.0, 1.0, 1.0), (0, 0, 0), u=16, v=10)
        o = objet('nuage', bm, [vol], loc=c)
        o.scale = (r * 1.4, r, r * 0.7)


# -----------------------------------------------------------------------
# LUMIERE, CIEL, RENDU
# -----------------------------------------------------------------------

def ciel():
    w = bpy.data.worlds.new('ciel')
    sc.world = w
    w.use_nodes = True
    N, L = w.node_tree.nodes, w.node_tree.links
    N.clear()
    out = N.new('ShaderNodeOutputWorld')
    tc = N.new('ShaderNodeTexCoord')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(tc.outputs['Generated'], sep.inputs['Vector'])
    r = N.new('ShaderNodeValToRGB')
    e = r.color_ramp.elements
    e[0].position = 0.0
    e[0].color = lin((150, 162, 214))
    e[1].position = 0.22
    e[1].color = lin(DAY['ciel_bas'])
    e.new(0.7).color = lin(DAY['ciel_haut'])
    L.new(sep.outputs['Z'], r.inputs['Fac'])
    vu = N.new('ShaderNodeBackground')
    L.new(r.outputs['Color'], vu.inputs['Color'])
    vu.inputs['Strength'].default_value = 1.5
    eclaire = N.new('ShaderNodeBackground')
    eclaire.inputs['Color'].default_value = lin((150, 172, 222))
    eclaire.inputs['Strength'].default_value = 0.5
    lp = N.new('ShaderNodeLightPath')
    mx = N.new('ShaderNodeMixShader')
    L.new(lp.outputs['Is Camera Ray'], mx.inputs['Fac'])
    L.new(eclaire.outputs['Background'], mx.inputs[1])
    L.new(vu.outputs['Background'], mx.inputs[2])
    L.new(mx.outputs['Shader'], out.inputs['Surface'])


def soleil():
    # Venu de la gauche de l'ecran et de l'arriere de la scene, a 35 degres :
    # une lumiere rasante qui modele les corps et couche les ombres vers la
    # camera. De face (premier essai), tout etait plat et les ombres
    # disparaissaient sous les objets.
    d = bpy.data.lights.new('soleil', type='SUN')
    d.energy = 5.0
    d.angle = math.radians(1.8)
    d.color = (1.0, 0.92, 0.8)
    o = lier(bpy.data.objects.new('soleil', d))
    vers_source = Vector((-0.259, 0.777, 0.574)).normalized()
    o.rotation_euler = vers_source.to_track_quat('Z', 'Y').to_euler()


def camera(loc, cible, focale, dof=None):
    cd = bpy.data.cameras.new('camera')
    cd.lens = focale
    cd.sensor_width = 36
    cd.sensor_fit = 'HORIZONTAL'
    cd.clip_start = 0.05
    cd.clip_end = 1000
    o = lier(bpy.data.objects.new('camera', cd))
    o.location = loc
    o.rotation_euler = (Vector(cible) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    if dof:
        cd.dof.use_dof = True
        cd.dof.focus_distance = (Vector(cible) - Vector(loc)).length
        cd.dof.aperture_fstop = dof
    sc.camera = o
    return o


def rendu():
    try:
        sc.render.engine = 'CYCLES'
    except TypeError as e:
        print('MOTEUR', e)
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for dv in prefs.devices:
            dv.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:
        print('GPU', e)
    sc.cycles.samples = 24 if APERCU else 160
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8
    sc.render.resolution_x = 2340
    sc.render.resolution_y = 1080
    sc.render.resolution_percentage = 50 if APERCU else 100
    try:
        sc.view_settings.view_transform = 'AgX'
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError as e:
        print('COULEUR', e)
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = SORTIE
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print('RENDU', SORTIE)


# -----------------------------------------------------------------------
# LA SCENE
# -----------------------------------------------------------------------

if PLAN == 'pose':
    # CONTROLE : l'athlete seul dans sa reception, sous trois angles
    sol()
    bac([(0.0, 8.3, 0.06, 0.38, 0.35)])
    ciel()
    soleil()
    athlete(RECEPTION, (0.0, 8.0), cap_vers(0, 1), TENUE_JOUEUR, ancre_basse=(0.0, 8.08, -0.03))
    base_sortie = SORTIE[:-4]
    for nom, loc in (('profil', (-4.2, 7.75, 0.6)), ('face', (-2.4, 11.2, 0.9)),
                     ('dos', (2.6, 5.0, 1.2))):
        camera(loc, (0.0, 7.75, 0.5), 50)
        SORTIE = f'{base_sortie}-{nom}.png'
        rendu()
    sys.exit(0)

sol()
if PLAN == 'proche':
    bac([(0.15, 5.9, 0.04, 0.35, 0.4), (-0.3, 7.3, 0.05, 0.4, 0.45), (0.0, 8.3, 0.06, 0.38, 0.35)])
else:
    bac([(0.15, 5.9, 0.04, 0.35, 0.4), (-0.3, 7.3, 0.05, 0.4, 0.45)])
ligne_meneur(7.73, '7,73')
plots()
bannieres()
tribune()
mats_projecteurs()
arbres()
cones()
juge(2.25, 0.35, (-1, 0))
juge(2.45, 9.4, (-1, -0.2))
ciel()
soleil()

if PLAN == 'proche':
    # hors champ : dans l'axe, son trepied barrait l'athlete
    cameraman(2.8, 11.2, (-0.8, -0.6))
    arm, _ = athlete(RECEPTION, (0.0, 8.0), cap_vers(0, 1), TENUE_JOUEUR, ancre_basse=(0.0, 8.08, -0.03))
    gerbe(Vector((0.0, 8.12, 0.0)))
    # de profil, un peu devant lui pour voir son visage : c'est l'angle ou le
    # geste d'une reception se lit (jambes, buste, bras). Au 70 mm, le fond
    # flou et rapproche. L'athlete est cadre dans les deux tiers gauches : le
    # tiers droit, derriere lui, porte l'habillage (verdict, marque, record),
    # qui ne doit rien cacher du geste.
    camera((-6.2, 8.55, 0.55), (0.0, 7.15, 0.5), 70, dof=1.4)
else:
    cameraman(2.6, -4.6, (-0.8, -0.6))
    athlete(COURSE, (0.0, -4.2), cap_vers(0, 1), TENUE_JOUEUR, sol_z=0.03)
    # L'image remanente du jeu (drawPousseeTrail, sprinter-app.js) : trois
    # copies du coureur, dans SES couleurs, reculees de max(0,35 ; v x 0,055)
    # metre chacune sur sa propre foulee — 0,6 m a 10,9 m/s — a 30, 20 et
    # 10 % d'opacite. Un pas fait ~2,3 m : chaque copie recule d'un quart de
    # pas dans la foulee.
    for k in (1, 2, 3):
        pose = entre_poses(COURSE, COURSE_B, min(1.0, 0.6 * k / 2.3))
        athlete(pose, (0.0, -4.2 - 0.6 * k), cap_vers(0, 1), TENUE_JOUEUR,
                voile=0.30 * (4 - k) / 3, sol_z=0.03)
    d = Vector((1, 1, -0.6325)).normalized()
    cible = Vector((0.3, -2.4, 0.5))
    camera(cible - d * 21.0, cible, 50)

rendu()
