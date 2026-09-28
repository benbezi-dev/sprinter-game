# -----------------------------------------------------------------------
# SPRINTER — le portrait 3D d'un athlete reel, rendu dans Blender.
#
#   blender -b -P tools/blender/portrait_vedette.py -- [--rapide] [--sortie DOSSIER]
#
# Ecrit public/vedettes/manga-pied.webp et manga-buste.webp, que le jeu
# affiche tels quels (screens/DefiVedette.tsx). --rapide : demi-taille et
# peu d'echantillons, pour regler.
#
# POURQUOI UN SECOND CORPS. Le coureur du jeu est une pile de troncs de cone,
# dessinee a la main en deux dimensions : c'est ce qui lui permet de courir a
# huit dans un virage, et c'est aussi pourquoi il ne peut pas porter un visage.
# Un athlete reel doit pourtant se reconnaitre la ou on le regarde de pres —
# sa fiche, l'ecran de son skin, sa banniere. Ce corps-ci n'existe que pour
# ces images-la : lisse, muscle, avec une tete sculptee, rendu une fois dans
# Blender et embarque comme une image. En course, le jeu garde le sien.
#
# COMMENT IL EST FAIT. Comme les coureurs du jeu (coureur.py) : des masses
# qui se fondent, converties en maillage. Mais posees sur un squelette dans
# une vraie pose, en ellipsoides orientes le long des os, avec des masses
# NEGATIVES pour creuser les orbites. La peau, le maillot, la barbe et les
# cheveux ne sont pas des objets : ce sont des zones de la meme peau, peintes
# par le materiau selon la position (voir `zone`). Le bandeau et le poignet,
# eux, sont de vrais anneaux, ajustes sur la peau par lancer de rayons.
#
# Le repere : metres, z vers le haut, l'athlete regarde vers -y.
# -----------------------------------------------------------------------

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Quaternion

# Une ellipsoide metaball de raideur 2 et de rayon R, au seuil par defaut,
# a sa surface a 0,573 R x taille (mesure : voir l'historique de ce fichier).
SURFACE = 0.573


def vider():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for bloc in (bpy.data.meshes, bpy.data.metaballs, bpy.data.materials,
                 bpy.data.lights, bpy.data.cameras):
        for d in list(bloc):
            bloc.remove(d)


# -----------------------------------------------------------------------
# LES MASSES
# -----------------------------------------------------------------------

def orientation(d):
    """Le quaternion qui couche l'axe z local le long de `d`."""
    d = Vector(d).normalized()
    return d.to_track_quat('Z', 'Y')


def ell(mb, c, ext, q=None, neg=False, raideur=2.0):
    """Une masse ellipsoide de demi-axes `ext` a sa surface (seule)."""
    m = max(ext)
    R = m / SURFACE
    e = mb.elements.new(type='ELLIPSOID')
    e.co = c
    e.radius = R
    e.size_x, e.size_y, e.size_z = (ext[0] / m, ext[1] / m, ext[2] / m)
    e.stiffness = raideur
    if q is not None:
        e.rotation = q
    e.use_negative = neg
    return e


def os_(mb, a, b, profil, pas=0.022):
    """Un membre le long d'un os, de `a` a `b`.

    `profil` : [(t, demi-largeur, demi-profondeur), ...], t de 0 (a) a 1 (b).
    Les masses sont posees tous les `pas` metres, les rayons interpoles : un
    membre continu, ou le ventre du muscle tombe ou le profil le dit.
    """
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    q = orientation(d)
    n = max(2, int(L / pas))
    for i in range(n + 1):
        t = i / n
        for k in range(len(profil) - 1):
            if profil[k][0] <= t <= profil[k + 1][0]:
                t0, x0, y0 = profil[k]
                t1, x1, y1 = profil[k + 1]
                u = (t - t0) / max(1e-6, t1 - t0)
                rx, ry = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u
                break
        else:
            continue
        ell(mb, a + d * t, (rx, ry, max(rx, ry) * 0.9), q)


def sculpter(nom, remplir, resolution):
    mb = bpy.data.metaballs.new(nom)
    mb.resolution = resolution
    mb.render_resolution = resolution
    remplir(mb)
    o = bpy.data.objects.new(nom, mb)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.view_layer.objects.active
    lisser(o, 0.5, 3)
    bpy.ops.object.shade_smooth()
    return o


def lisser(o, facteur, iterations):
    m = o.modifiers.new('lissage', 'SMOOTH')
    m.factor = facteur
    m.iterations = iterations
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)


# -----------------------------------------------------------------------
# L'ATHLETE : squelette, pose, masses
# -----------------------------------------------------------------------

def athlete_manga(pose='hanches'):
    """Aurel Manga, 1,90 m, 89 kg, les mains sur les hanches.

    `pose='A'` : bras ecartes a 45 degres, mains dans l'axe des avant-bras.
    C'est la pose de repos d'un personnage qu'on rigge (aurel_unity.py) —
    Unity sait la redresser en T au moment de configurer l'avatar Humanoid.
    Seuls les bras changent : le reste du corps est le meme.

    La pose est celle de son portrait debout (couloir d'honneur, mains sur
    les hanches, coudes ouverts) : c'est celle ou l'on voit le mieux ce qui
    le fait reconnaitre — la carrure en V, les deltoides ronds, les bras
    pleins, et le visage de face.
    """
    H = Vector((0, 0.0, 1.765))       # centre de la tete
    A = {}
    for s in (1, -1):
        A[s] = dict(
            epaule=Vector((s * 0.205, 0.010, 1.535)),
            coude=Vector((s * 0.415, 0.080, 1.255)),
            poignet=Vector((s * 0.188, -0.005, 1.040)),
            main='hanche',
            hanche=Vector((s * 0.088, 0.0, 0.965)),
            genou=Vector((s * 0.118, -0.018, 0.520)),
            cheville=Vector((s * 0.124, 0.018, 0.090)),
        )
        if pose == 'A':
            A[s].update(coude=Vector((s * 0.438, 0.028, 1.302)),
                        poignet=Vector((s * 0.628, 0.004, 1.111)),
                        main='libre')
    return H, A


def tronc(mb):
    # Les hauteurs sont celles d'un homme de 1,90 m : hanche 0,97, nombril
    # 1,14, mamelons 1,40, acromion 1,55, menton 1,65.
    # bassin, fessiers
    ell(mb, (0, 0.008, 0.975), (0.158, 0.100, 0.085))
    for s in (1, -1):
        ell(mb, (s * 0.074, 0.058, 0.925), (0.076, 0.068, 0.078))
    # taille pincee, abdominaux
    ell(mb, (0, 0.006, 1.135), (0.132, 0.090, 0.110))
    ell(mb, (0, -0.045, 1.150), (0.088, 0.052, 0.115))
    # cage thoracique, grands dorsaux : le V
    ell(mb, (0, 0.010, 1.345), (0.162, 0.112, 0.150))
    for s in (1, -1):
        ell(mb, (s * 0.132, 0.032, 1.325), (0.072, 0.074, 0.140))
        # pectoraux : deux masses franches, larges
        ell(mb, (s * 0.074, -0.074, 1.425), (0.088, 0.046, 0.062))
        # trapezes, qui montent vers le cou
        ell(mb, (s * 0.080, 0.028, 1.572), (0.078, 0.050, 0.050))
    # le haut du dos, entre les omoplates, et les clavicules
    ell(mb, (0, 0.045, 1.500), (0.160, 0.068, 0.075))
    ell(mb, (0, -0.030, 1.530), (0.150, 0.040, 0.030))


def bras(s, A):
    def remplir(mb):
        a = A[s]
        # le deltoide : rond, et qui deborde de l'epaule
        ell(mb, a['epaule'] + Vector((s * 0.018, 0.0, -0.012)), (0.070, 0.072, 0.078))
        os_(mb, a['epaule'], a['coude'],
            [(0.00, 0.062, 0.064), (0.30, 0.060, 0.064), (0.55, 0.056, 0.060),
             (0.85, 0.044, 0.045), (1.00, 0.038, 0.038)])
        os_(mb, a['coude'], a['poignet'],
            [(0.00, 0.042, 0.040), (0.25, 0.050, 0.045), (0.55, 0.040, 0.036),
             (0.90, 0.029, 0.025), (1.00, 0.027, 0.023)])
        # LE RELIEF : le biceps devant, le triceps derriere, le brachio-radial
        # sous le coude. Un bras fait d'un seul tube se lit comme un bras de
        # poupee, aussi gros soit-il.
        e, c, w = a['epaule'], a['coude'], a['poignet']
        u = c - e
        av = Vector((0, -1, 0))
        ell(mb, e + u * 0.50 + av * 0.030, (0.036, 0.030, 0.070), orientation(u))
        ell(mb, e + u * 0.40 - av * 0.030, (0.040, 0.034, 0.085), orientation(u))
        f = w - c
        ell(mb, c + f * 0.22 + Vector((s * 0.012, -0.012, 0.010)), (0.030, 0.030, 0.060), orientation(f))
        w = a['poignet']
        if a.get('main') == 'libre':
            # la main dans l'axe de l'avant-bras, paume vers la cuisse, doigts
            # serres : la paume, puis les doigts
            d = f.normalized()
            ell(mb, w + d * 0.050, (0.020, 0.042, 0.052), orientation(d))
            ell(mb, w + d * 0.120, (0.016, 0.036, 0.040), orientation(d))
        else:
            # la main posee sur la hanche, doigts vers l'avant
            ell(mb, w + Vector((-s * 0.004, -0.040, -0.022)), (0.026, 0.048, 0.016),
                orientation((0, -1, -0.35)))
            ell(mb, w + Vector((s * 0.010, -0.010, -0.002)), (0.030, 0.028, 0.020))
    return remplir


def jambe(s, A):
    def remplir(mb):
        a = A[s]
        os_(mb, a['hanche'] + Vector((s * 0.008, 0, 0.0)), a['genou'],
            [(0.00, 0.072, 0.080), (0.25, 0.076, 0.084), (0.55, 0.068, 0.074),
             (0.80, 0.056, 0.060), (1.00, 0.048, 0.050)])
        os_(mb, a['genou'], a['cheville'],
            [(0.00, 0.050, 0.052), (0.22, 0.056, 0.064), (0.42, 0.050, 0.058),
             (0.70, 0.035, 0.037), (1.00, 0.028, 0.030)])
        # le relief : le vaste interne au-dessus du genou, le mollet haut et
        # en deux chefs derriere
        g, k, ch = a['hanche'], a['genou'], a['cheville']
        cu = k - g
        ell(mb, g + cu * 0.80 + Vector((-s * 0.028, -0.030, 0)), (0.040, 0.038, 0.060), orientation(cu))
        ell(mb, g + cu * 0.45 + Vector((0, -0.040, 0)), (0.050, 0.040, 0.110), orientation(cu))
        ja = ch - k
        for dx in (-0.018, 0.018):
            ell(mb, k + ja * 0.28 + Vector((dx, 0.032, 0)), (0.030, 0.034, 0.075), orientation(ja))
        # le pied, dans sa pointe : talon, voute, avant-pied
        c = a['cheville']
        for off, ext in (((0, 0.045, -0.040), (0.034, 0.040, 0.030)),
                         ((0.002, -0.030, -0.055), (0.040, 0.060, 0.026)),
                         ((0.006, -0.105, -0.064), (0.042, 0.045, 0.020))):
            ell(mb, c + Vector(off), ext)
    return remplir


def tete(H):
    def remplir(mb):
        h = lambda x, y, z: H + Vector((x, y, z))
        # le cou, epais, et la nuque
        os_(mb, (0, 0.020, 1.545), h(0, 0.012, -0.075),
            [(0, 0.068, 0.068), (0.6, 0.060, 0.060), (1, 0.056, 0.058)])
        # le crane
        ell(mb, h(0, 0.012, 0.028), (0.079, 0.096, 0.092))
        # la masse du visage, puis la machoire carree et le menton
        ell(mb, h(0, -0.030, -0.022), (0.071, 0.064, 0.070))
        ell(mb, h(0, -0.028, -0.082), (0.064, 0.054, 0.036))
        for s in (1, -1):
            ell(mb, h(s * 0.050, 0.004, -0.072), (0.024, 0.030, 0.028))
            # pommettes
            ell(mb, h(s * 0.046, -0.058, -0.010), (0.022, 0.018, 0.016))
            # oreilles
            ell(mb, h(s * 0.077, 0.006, -0.008), (0.010, 0.020, 0.030))
        ell(mb, h(0, -0.072, -0.108), (0.025, 0.020, 0.019))
        # l'arcade, droite et marquee
        ell(mb, h(0, -0.080, 0.030), (0.058, 0.014, 0.012))
        # le nez : arete, bout, ailes larges
        ell(mb, h(0, -0.088, -0.004), (0.009, 0.010, 0.024))
        ell(mb, h(0, -0.101, -0.033), (0.012, 0.011, 0.010))
        for s in (1, -1):
            ell(mb, h(s * 0.016, -0.093, -0.039), (0.011, 0.010, 0.009))
        # les levres, pleines
        ell(mb, h(0, -0.093, -0.062), (0.025, 0.009, 0.006))
        ell(mb, h(0, -0.090, -0.074), (0.023, 0.010, 0.007))
        # les orbites, creusees
        for s in (1, -1):
            ell(mb, h(s * 0.032, -0.086, 0.010), (0.017, 0.012, 0.010), neg=True)
        # les paupieres superieures : elles couvrent le haut de l'oeil et lui
        # donnent sa forme en amande, au lieu d'un regard ecarquille
        for s in (1, -1):
            ell(mb, h(s * 0.032, -0.084, 0.019), (0.017, 0.010, 0.006))
    return remplir


# -----------------------------------------------------------------------
# LES ANNEAUX : bandeau et poignet, ajustes sur la peau
# -----------------------------------------------------------------------

def anneau(nom, cible, centre, axe, largeur, marge, n=64, finesse=2):
    """Un anneau pose sur la peau de `cible`, autour de `axe`.

    On lance des rayons depuis l'axe, dans le plan perpendiculaire, et on
    pose l'anneau a `marge` au-dela de la peau rencontree : il epouse le
    front et la nuque, ou le poignet, au lieu d'etre un cylindre plaque.
    """
    axe = Vector(axe).normalized()
    u = axe.orthogonal().normalized()
    v = axe.cross(u).normalized()
    dg = bpy.context.evaluated_depsgraph_get()
    mw_inv = cible.matrix_world.inverted()
    anneaux = []
    for dz in (-largeur / 2, largeur / 2):
        boucle = []
        for i in range(n):
            a = 2 * math.pi * i / n
            dirn = (u * math.cos(a) + v * math.sin(a)).normalized()
            o = Vector(centre) + axe * dz
            # Depuis l'axe, VERS L'EXTERIEUR : c'est la peau du membre qu'on
            # rencontre d'abord. Lances de l'exterieur vers l'axe, les rayons
            # d'un poignet pose sur la hanche touchaient le torse avant lui.
            ok, loc, _nrm, _f = cible.ray_cast(mw_inv @ o, (mw_inv.to_3x3() @ dirn).normalized(),
                                               distance=0.2)
            r = ((cible.matrix_world @ loc) - o).length if ok else 0.04
            boucle.append(o + dirn * (r + marge))
        anneaux.append(boucle)
    bm = bmesh.new()
    vs = [[bm.verts.new(p) for p in b] for b in anneaux]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vs[0][i], vs[0][j], vs[1][j], vs[1][i]))
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    sol = o.modifiers.new('epaisseur', 'SOLIDIFY')
    sol.thickness = 0.006
    sol.offset = 1
    sub = o.modifiers.new('arrondi', 'SUBSURF')
    sub.levels = finesse
    sub.render_levels = finesse
    for p in me.polygons:
        p.use_smooth = True
    return o


def oeil(nom, c, r, vers):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=c, segments=32, ring_count=16)
    o = bpy.context.active_object
    o.name = nom
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector(vers).to_track_quat('Z', 'Y')
    bpy.ops.object.shade_smooth()
    return o


# -----------------------------------------------------------------------
# LES MATERIAUX
# -----------------------------------------------------------------------

def lin(c):
    """Une couleur sRGB 0-255 en lineaire, pour Blender."""
    def f(x):
        x = x / 255
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


class Peintre:
    """Un materiau par zones : une couleur de base, puis des couches.

    Chaque couche est un masque (0 a 1) calcule sur la position du point, et
    une couleur — plus, si besoin, sa propre rugosite. C'est ce qui peint le
    maillot sur le torse, la barbe sur la machoire et les cheveux sur le
    crane, sans decouper le maillage.
    """

    def __init__(self, nom, base, rugosite=0.45, sss=0.0, pores=0.0):
        self.m = bpy.data.materials.new(nom)
        self.m.use_nodes = True
        self.nt = self.m.node_tree
        self.bsdf = next(n for n in self.nt.nodes if n.type == 'BSDF_PRINCIPLED')
        geo = self.nt.nodes.new('ShaderNodeNewGeometry')
        self.xyz = self.nt.nodes.new('ShaderNodeSeparateXYZ')
        self.nt.links.new(geo.outputs['Position'], self.xyz.inputs[0])
        self.couleur = self._val_rgb(base)
        self.rug = self._val(rugosite)
        self.bsdf.inputs['Subsurface Weight'].default_value = sss
        # LE GRAIN DE LA PEAU : un relief de pores, a peine. Sans lui, la peau
        # d'une masse metaball est celle d'un jouet en plastique moule.
        if pores:
            n = self.nt.nodes.new('ShaderNodeTexNoise')
            n.inputs['Scale'].default_value = 2600
            n.inputs['Detail'].default_value = 8
            b = self.nt.nodes.new('ShaderNodeBump')
            b.inputs['Strength'].default_value = pores
            b.inputs['Distance'].default_value = 0.0006
            self.nt.links.new(n.outputs['Fac'], b.inputs['Height'])
            self.nt.links.new(b.outputs['Normal'], self.bsdf.inputs['Normal'])
        # Un athlete en tenue de course a la peau qui brille un peu.
        self.bsdf.inputs['Coat Weight'].default_value = 0.10 if sss else 0.0
        self.bsdf.inputs['Coat Roughness'].default_value = 0.25
        if sss:
            self.bsdf.inputs['Subsurface Radius'].default_value = (0.9, 0.35, 0.2)
            self.bsdf.inputs['Subsurface Scale'].default_value = 0.012

    def _val(self, v):
        n = self.nt.nodes.new('ShaderNodeValue')
        n.outputs[0].default_value = v
        return n.outputs[0]

    def _val_rgb(self, c):
        n = self.nt.nodes.new('ShaderNodeRGB')
        n.outputs[0].default_value = lin(c)
        return n.outputs[0]

    def axe(self, i):
        return self.xyz.outputs[i]

    def lisse(self, s, a, b):
        """0 sous a, 1 au-dessus de b, en douceur (a > b pour l'inverse)."""
        n = self.nt.nodes.new('ShaderNodeMapRange')
        n.interpolation_type = 'SMOOTHSTEP'
        n.clamp = True
        self.nt.links.new(s, n.inputs['Value'])
        if a > b:
            n.inputs['From Min'].default_value = b
            n.inputs['From Max'].default_value = a
            n.inputs['To Min'].default_value = 1
            n.inputs['To Max'].default_value = 0
        else:
            n.inputs['From Min'].default_value = a
            n.inputs['From Max'].default_value = b
        return n.outputs[0]

    def bande(self, i, a, b, flou=0.004):
        """1 entre a et b sur l'axe i, fondu sur `flou`."""
        return self.mul(self.lisse(self.axe(i), a - flou, a + flou),
                        self.lisse(self.axe(i), b + flou, b - flou))

    def absolu(self, i):
        n = self.nt.nodes.new('ShaderNodeMath')
        n.operation = 'ABSOLUTE'
        self.nt.links.new(self.axe(i), n.inputs[0])
        return n.outputs[0]

    def rayon(self, cx, cy):
        """Distance horizontale au point (cx, cy)."""
        v = self.nt.nodes.new('ShaderNodeVectorMath')
        v.operation = 'DISTANCE'
        geo = self.nt.nodes.new('ShaderNodeNewGeometry')
        c = self.nt.nodes.new('ShaderNodeCombineXYZ')
        c.inputs[0].default_value = cx
        c.inputs[1].default_value = cy
        cz = self.nt.nodes.new('ShaderNodeCombineXYZ')
        self.nt.links.new(self.axe(0), cz.inputs[0])
        self.nt.links.new(self.axe(1), cz.inputs[1])
        self.nt.links.new(cz.outputs[0], v.inputs[0])
        self.nt.links.new(c.outputs[0], v.inputs[1])
        return v.outputs['Value']

    def ovale(self, i, j, ci, cj, ri, rj, flou=0.12):
        """1 dans l'ellipse de centre (ci, cj) et de demi-axes (ri, rj), dans
        le plan des axes i et j ; fondu sur la bordure. Un axe peut etre donne
        par une prise (un |x|, par exemple) plutot que par son numero."""
        c = self.nt.nodes.new('ShaderNodeCombineXYZ')
        for k, (ax, cc, rr) in enumerate(((i, ci, ri), (j, cj, rj))):
            m = self.nt.nodes.new('ShaderNodeMath')
            m.operation = 'SUBTRACT'
            self.nt.links.new(self.axe(ax) if isinstance(ax, int) else ax, m.inputs[0])
            m.inputs[1].default_value = cc
            d = self.nt.nodes.new('ShaderNodeMath')
            d.operation = 'DIVIDE'
            self.nt.links.new(m.outputs[0], d.inputs[0])
            d.inputs[1].default_value = rr
            self.nt.links.new(d.outputs[0], c.inputs[k])
        L = self.nt.nodes.new('ShaderNodeVectorMath')
        L.operation = 'LENGTH'
        self.nt.links.new(c.outputs[0], L.inputs[0])
        return self.lisse(L.outputs['Value'], 1 + flou, 1 - flou)

    def mul(self, *ss):
        out = ss[0]
        for s in ss[1:]:
            n = self.nt.nodes.new('ShaderNodeMath')
            n.operation = 'MULTIPLY'
            self.nt.links.new(out, n.inputs[0])
            self.nt.links.new(s, n.inputs[1])
            out = n.outputs[0]
        return out

    def inv(self, s):
        n = self.nt.nodes.new('ShaderNodeMath')
        n.operation = 'SUBTRACT'
        n.inputs[0].default_value = 1
        self.nt.links.new(s, n.inputs[1])
        return n.outputs[0]

    def grain(self, echelle, contraste):
        """Un bruit fin : poil de barbe, cheveu ras, maille du maillot."""
        n = self.nt.nodes.new('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = echelle
        n.inputs['Detail'].default_value = 6
        r = self.nt.nodes.new('ShaderNodeMapRange')
        r.inputs['From Min'].default_value = 0.5 - 0.5 / contraste
        r.inputs['From Max'].default_value = 0.5 + 0.5 / contraste
        self.nt.links.new(n.outputs['Fac'], r.inputs['Value'])
        return r.outputs[0]

    def couche(self, masque, couleur, rugosite=None):
        m = self.nt.nodes.new('ShaderNodeMix')
        m.data_type = 'RGBA'
        self.nt.links.new(masque, m.inputs['Factor'])
        self.nt.links.new(self.couleur, m.inputs[6])
        if isinstance(couleur, tuple) or isinstance(couleur, list):
            m.inputs[7].default_value = lin(couleur)
        else:
            self.nt.links.new(couleur, m.inputs[7])
        self.couleur = m.outputs[2]
        if rugosite is not None:
            r = self.nt.nodes.new('ShaderNodeMix')
            r.data_type = 'FLOAT'
            self.nt.links.new(masque, r.inputs['Factor'])
            self.nt.links.new(self.rug, r.inputs[2])
            r.inputs[3].default_value = rugosite
            self.rug = r.outputs[0]

    def teinte(self, grain, a, b):
        """Une couleur qui varie entre a et b selon un grain."""
        m = self.nt.nodes.new('ShaderNodeMix')
        m.data_type = 'RGBA'
        self.nt.links.new(grain, m.inputs['Factor'])
        m.inputs[6].default_value = lin(a)
        m.inputs[7].default_value = lin(b)
        return m.outputs[2]

    def fin(self):
        self.nt.links.new(self.couleur, self.bsdf.inputs['Base Color'])
        self.nt.links.new(self.rug, self.bsdf.inputs['Roughness'])
        return self.m


def uni(nom, c, rugosite=0.5, metal=0.0):
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = lin(c)
    b.inputs['Roughness'].default_value = rugosite
    b.inputs['Metallic'].default_value = metal
    return m


# -----------------------------------------------------------------------
# LA SCENE
# -----------------------------------------------------------------------

def viser(o, cible):
    d = Vector(cible) - o.location
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('-Z', 'Y')


def lumieres():
    for nom, pos, energie, taille, couleur in (
            ('cle', (-1.6, -2.6, 2.9), 380, 2.2, (1.0, 0.96, 0.9)),
            ('remplissage', (2.4, -2.0, 1.6), 120, 3.0, (0.85, 0.9, 1.0)),
            ('contre_g', (-1.8, 2.0, 2.4), 420, 1.2, (0.75, 0.62, 1.0)),
            ('contre_d', (1.9, 1.8, 2.2), 380, 1.2, (0.75, 0.62, 1.0))):
        d = bpy.data.lights.new(nom, type='AREA')
        d.energy = energie
        d.size = taille
        d.color = couleur
        o = bpy.data.objects.new(nom, d)
        o.location = pos
        bpy.context.collection.objects.link(o)
        viser(o, (0, 0, 1.25))
    monde = bpy.data.worlds.new('fond')
    monde.use_nodes = True
    fond = next(n for n in monde.node_tree.nodes if n.type == 'BACKGROUND')
    fond.inputs[0].default_value = (0.05, 0.035, 0.09, 1)
    fond.inputs[1].default_value = 0.6
    bpy.context.scene.world = monde


def camera(nom, pos, cible, focale):
    c = bpy.data.cameras.new(nom)
    c.lens = focale
    c.sensor_fit = 'VERTICAL'
    c.sensor_height = 36
    o = bpy.data.objects.new(nom, c)
    o.location = pos
    bpy.context.collection.objects.link(o)
    viser(o, cible)
    return o


def rendre(cam, chemin, l, h, echantillons):
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = echantillons
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = l
    sc.render.resolution_y = h
    webp = chemin.endswith('.webp')
    sc.render.image_settings.file_format = 'WEBP' if webp else 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    if webp:
        sc.render.image_settings.quality = 88
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Punchy'
    sc.render.filepath = chemin
    bpy.ops.render.render(write_still=True)
    print('rendu :', chemin)


# -----------------------------------------------------------------------

VIOLET = (72, 30, 142)
VIOLET_FONCE = (36, 20, 72)
PEAU = (86, 48, 32)


def construire(pose='hanches'):
    """Le modele complet. Rend (H, A, objets) : le centre de la tete, les
    articulations, et les objets par role."""
    H, A = athlete_manga(pose)
    # LES BRAS SE FONDENT DANS LE TORSE : meme objet, memes masses. Sculptes
    # a part, le deltoide n'etait qu'une boule posee contre la cage, et
    # l'epaule se lisait comme une articulation de poupee.
    def haut_du_corps(mb):
        tronc(mb)
        for s in (1, -1):
            bras(s, A)(mb)
    corps = sculpter('TRONC', haut_du_corps, 0.0065)
    membres = [corps]
    jambes = [sculpter('JAMBE_%d' % s, jambe(s, A), 0.007) for s in (1, -1)]
    crane = sculpter('TETE', tete(H), 0.0032)

    # --- la peau, et ce qui s'y peint
    def peau(nom):
        P = Peintre(nom, PEAU, rugosite=0.48, sss=0.12, pores=0.35)
        return P

    # le tronc : maillot violet, echancrure, emmanchures ; short en bas
    P = peau('peau_tronc')
    # Un debardeur : l'encolure ronde descend sur le devant, les emmanchures
    # degagent les epaules, deux bretelles passent par-dessus.
    encolure = P.ovale(0, 2, 0.0, 1.600, 0.098, 0.088)
    emmanchure = P.mul(P.lisse(P.absolu(0), 0.138, 0.150),
                       P.lisse(P.axe(2), 1.425, 1.445))
    # le torse seul : les bras passent a cote, et les mains sur les hanches
    torse = P.mul(P.lisse(P.absolu(0), 0.200, 0.188),
                  P.inv(P.ovale(P.absolu(0), 2, 0.192, 1.030, 0.040, 0.050)))
    maillot = P.mul(P.bande(2, 0.955, 1.62, 0.004), P.inv(encolure), P.inv(emmanchure), torse)
    P.couche(maillot, P.teinte(P.grain(900, 2.5), VIOLET, (86, 38, 160)), 0.62)
    P.couche(P.mul(P.bande(2, 0.0, 0.985, 0.004), torse), VIOLET_FONCE, 0.55)
    corps.data.materials.append(P.fin())

    for j in jambes:
        P = peau('peau_jambe')
        P.couche(P.bande(2, 0.700, 1.2, 0.004), VIOLET_FONCE, 0.55)
        # la pointe : blanche, semelle orange
        P.couche(P.bande(2, -1, 0.115, 0.004), (240, 240, 244), 0.35)
        P.couche(P.bande(2, -1, 0.030, 0.003), (246, 108, 40), 0.5)
        j.data.materials.append(P.fin())


    # la tete : cheveux ras au-dessus du bandeau, barbe courte, moustache,
    # levres, sourcils
    P = peau('peau_tete')
    hz = H.z
    cheveux = P.lisse(P.axe(2), hz + 0.058, hz + 0.066)
    P.couche(cheveux, P.teinte(P.grain(1400, 3), (16, 12, 12), (40, 30, 26)), 0.85)
    devant = P.lisse(P.axe(1), -0.035, -0.055)
    barbe = P.mul(P.bande(2, hz - 0.125, hz - 0.066, 0.006), devant,
                  P.inv(P.mul(P.bande(2, hz - 0.082, hz - 0.058, 0.002),
                              P.lisse(P.absolu(0), 0.030, 0.022),
                              P.lisse(P.axe(1), -0.085, -0.090))))
    P.couche(P.mul(barbe, P.lisse(P.grain(1800, 2), 0.1, 0.4)), (16, 11, 10), 0.9)
    moustache = P.mul(P.bande(2, hz - 0.056, hz - 0.049, 0.002),
                      P.lisse(P.absolu(0), 0.028, 0.020), P.lisse(P.axe(1), -0.080, -0.092))
    P.couche(P.mul(moustache, P.grain(1800, 2)), (22, 16, 14), 0.9)
    levres = P.mul(P.bande(2, hz - 0.082, hz - 0.057, 0.002),
                   P.lisse(P.absolu(0), 0.026, 0.020), P.lisse(P.axe(1), -0.088, -0.094))
    P.couche(levres, (92, 44, 38), 0.35)
    sourcils = P.mul(P.bande(2, hz + 0.025, hz + 0.032, 0.0015),
                     P.bande(0, -0.052, 0.052, 0.003),
                     P.inv(P.bande(0, -0.010, 0.010, 0.003)),
                     P.lisse(P.axe(1), -0.070, -0.082))
    P.couche(sourcils, (8, 6, 6), 0.95)
    crane.data.materials.append(P.fin())

    # les yeux : blanc, iris brun sombre, pupille
    for s in (1, -1):
        o = oeil('OEIL_%d' % s, H + Vector((s * 0.032, -0.075, 0.010)), 0.0125, (0, -1, 0))
        E = Peintre('oeil', (232, 224, 214), rugosite=0.08)
        E.nt.nodes.remove(next(n for n in E.nt.nodes if n.type == 'NEW_GEOMETRY'))
        tc = E.nt.nodes.new('ShaderNodeTexCoord')
        E.nt.links.new(tc.outputs['Object'], E.xyz.inputs[0])
        iris = E.lisse(E.axe(2), 0.0085, 0.0095)
        E.couche(iris, (52, 30, 20))
        E.couche(E.lisse(E.axe(2), 0.0112, 0.0116), (6, 4, 4))
        o.data.materials.append(E.fin())

    # le bandeau blanc, haut sur le front ; le poignet blanc, bras gauche
    bandeau = anneau('BANDEAU', crane, H + Vector((0, 0.004, 0.047)), (0, 0.10, 1), 0.038, 0.002)
    eponge = uni('eponge', (246, 246, 244), 0.95)
    bandeau.data.materials.append(eponge)
    g = A[1]
    axe = g['poignet'] - g['coude']
    poignet = anneau('POIGNET', membres[0], g['poignet'] - axe.normalized() * 0.050,
                     axe, 0.070, 0.003)
    poignet.data.materials.append(eponge)
    yeux = [bpy.data.objects['OEIL_1'], bpy.data.objects['OEIL_-1']]
    return H, A, dict(corps=corps, jambes=jambes, tete=crane, yeux=yeux,
                      bandeau=bandeau, poignet=poignet)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    sortie = args[args.index('--sortie') + 1] if '--sortie' in args else 'public/vedettes'
    rapide = '--rapide' in args
    os.makedirs(sortie, exist_ok=True)
    vider()
    construire()
    lumieres()
    n = 24 if rapide else 160
    r = 0.5 if rapide else 1.0
    pied = camera('CAM_PIED', (1.9, -5.4, 1.25), (0, 0, 0.98), 85)
    ext = '.png' if rapide else '.webp'
    rendre(pied, os.path.join(sortie, 'manga-pied' + ext), int(900 * r), int(1200 * r), n)
    buste = camera('CAM_BUSTE', (0.55, -1.85, 1.70), (0, 0, 1.62), 85)
    rendre(buste, os.path.join(sortie, 'manga-buste' + ext), int(900 * r), int(1000 * r), n)


# Importe par aurel_unity.py pour reutiliser le modele : rien ne se rend alors.
if __name__ == '__main__':
    main()
