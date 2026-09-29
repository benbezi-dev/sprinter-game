# -----------------------------------------------------------------------
# SPRINTER — l'eclairage REEL, pour les stades qui le demandent.
#
# Les decors des autres stades sont des EMISSIONS qui recopient la formule
# de lumiere du moteur (matiere.py) : c'est ce qui les colle aux coureurs et
# aux gradins, peints par cette formule. Mais c'est aussi ce qui les rend
# plats — une facette n'y a qu'une valeur, aucun reflet, aucun eclat.
#
# La piste arc-en-ciel n'a ni pelouse ni tartan a qui ressembler : elle est
# faite de lumiere et flotte dans le noir. Ses decors peuvent donc etre
# eclaires pour de bon — Cycles, matieres physiques (or metallique, laque,
# chrome), neons emissifs — et c'est ce qui les fait briller. Le soleil garde
# la direction de celui du jeu, pour que les ombres propres tombent du meme
# cote que celles des coureurs.
#
# Et parce qu'un neon sans halo n'est qu'une couleur vive, l'image recoit un
# HALO (voir `halo_lumineux`) : ce qui est tres clair deborde sur le fond
# transparent, et l'alpha avec, sans quoi la lueur serait coupee au bord de
# la piece.
# -----------------------------------------------------------------------

import bpy
import math
import numpy as np

import vue
import matiere


def lin(c):
    """Une couleur du jeu (sRGB 0-255) en valeur lineaire pour le shader."""
    def un(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (un(c[0]), un(c[1]), un(c[2]), 1.0)


def matiere_pbr(nom, couleur, metal=0.0, rugosite=0.45, vernis=0.0, emission=0.0,
                couleur_emission=None, alpha=1.0, bosse=0.0, echelle_bosse=18.0):
    """Une matiere physique : Principled BSDF, avec emission et bosselage optionnels."""
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = lin(couleur)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rugosite
    p.inputs['Coat Weight'].default_value = vernis
    p.inputs['Coat Roughness'].default_value = 0.08
    if emission > 0:
        p.inputs['Emission Color'].default_value = lin(couleur_emission or couleur)
        p.inputs['Emission Strength'].default_value = emission
    if alpha < 1.0:
        p.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    if bosse > 0:
        # Une feuille froissee : un bruit fin qui casse les reflets d'une
        # surface metallique, comme la feuille d'or d'un satellite.
        tc = nt.nodes.new('ShaderNodeTexCoord')
        br = nt.nodes.new('ShaderNodeTexNoise')
        br.inputs['Scale'].default_value = echelle_bosse
        br.inputs['Detail'].default_value = 6.0
        bu = nt.nodes.new('ShaderNodeBump')
        bu.inputs['Strength'].default_value = bosse
        nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
        nt.links.new(br.outputs['Fac'], bu.inputs['Height'])
        nt.links.new(bu.outputs['Normal'], p.inputs['Normal'])
    return m


def neon(nom, couleur, force=5.0):
    """Un tube de lumiere : sa couleur, et beaucoup d'emission."""
    return matiere_pbr(nom, couleur, rugosite=0.25, emission=force)


def lisser(o, angle=40.0):
    """Des faces lissees, sauf les aretes plus vives que `angle` degres."""
    for p in o.data.polygons:
        p.use_smooth = True
    try:
        o.data.set_sharp_from_angle(angle=math.radians(angle))
    except AttributeError:
        pass
    return o


def biseau(o, largeur=0.03, segments=3):
    """Des aretes arrondies : c'est ce qui accroche la lumiere sur un objet dur."""
    b = o.modifiers.new('biseau', 'BEVEL')
    b.width = largeur
    b.segments = segments
    b.limit_method = 'ANGLE'
    return o


def subdiviser(o, niveaux=2):
    s = o.modifiers.new('subdiv', 'SUBSURF')
    s.levels = s.render_levels = niveaux
    return o


def monde_spatial(sc):
    """Le ciel qui eclaire sans se voir : rose en haut, bleu nuit en bas.

    Le film est transparent, ce ciel n'apparait donc jamais a l'image ; il
    n'existe que dans les reflets — c'est lui que l'or et le chrome renvoient.
    """
    w = bpy.data.worlds.new('espace')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes['Background']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    # Trois bandes : un sol bleu nuit, un horizon rose vif — c'est lui que
    # l'or et le chrome renvoient le plus —, un zenith lavande. Un ciel trop
    # sombre rendait l'or cuivre : un metal n'a d'autre couleur que ce qu'il
    # reflete.
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.30, lin((40, 50, 140))
    el[1].position, el[1].color = 0.80, lin((230, 210, 255))
    mid = el.new(0.55)
    mid.color = lin((255, 150, 210))
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.5


def lumieres(sc):
    """Le soleil du jeu, et deux contre-jours colores qui dessinent les bords."""
    s = vue.soleil(force=4.5)
    s.data.angle = math.radians(6)
    for nom, col, direc, force in (('contre_rose', (255, 90, 200), (0.7, -0.5, 0.35), 2.2),
                                   ('contre_bleu', (60, 170, 255), (0.5, 0.8, 0.3), 1.8)):
        d = bpy.data.lights.new(nom, type='SUN')
        d.energy = force
        d.color = lin(col)[:3]
        d.angle = math.radians(10)
        o = bpy.data.objects.new(nom, d)
        bpy.context.collection.objects.link(o)
        o.rotation_euler = vue.miroir(direc).to_track_quat('Z', 'Y').to_euler()


def reglages(sc, echantillons):
    sc.render.engine = 'CYCLES'
    vue.cycles_gpu(sc)
    sc.cycles.samples = echantillons
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 6
    sc.cycles.transparent_max_bounces = 16
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0.0
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '16'


def _flou(a, sigma):
    """Un flou gaussien separable, en numpy (l'image est deja en memoire)."""
    r = int(math.ceil(sigma * 3))
    x = np.arange(-r, r + 1, dtype=np.float32)
    k = np.exp(-(x * x) / (2 * sigma * sigma))
    k /= k.sum()
    out = a
    for axe in (0, 1):
        pad = [(0, 0)] * out.ndim
        pad[axe] = (r, r)
        p = np.pad(out, pad, mode='constant')
        acc = np.zeros_like(out)
        for i, w in enumerate(k):
            sl = [slice(None)] * out.ndim
            sl[axe] = slice(i, i + out.shape[axe])
            acc += w * p[tuple(sl)]
        out = acc
    return out


def halo_lumineux(img, seuil=0.72, force=0.9, marge=0):
    """Le halo des parties lumineuses, debordant sur le fond transparent.

    `img` : RGBA non premultiplie, 0-1 (ligne 0 en haut). On isole ce qui est
    plus clair que `seuil`, on le floute a deux echelles, et on l'ajoute —
    a la couleur comme a l'alpha, en composition « par-dessus ».
    """
    rgb, a = img[..., :3], img[..., 3:4]
    pre = rgb * a
    lum = pre.max(axis=2, keepdims=True)
    clair = pre * np.clip((lum - seuil) / (1 - seuil), 0, 1)
    if marge:
        clair = np.pad(clair, ((marge, marge), (marge, marge), (0, 0)))
        pre = np.pad(pre, ((marge, marge), (marge, marge), (0, 0)))
        a = np.pad(a, ((marge, marge), (marge, marge), (0, 0)))
    h = 0.6 * _flou(clair, 4.0) + 0.55 * _flou(clair, 14.0)
    h *= force
    ha = np.clip(h.max(axis=2, keepdims=True), 0, 1)
    out_pre = pre + h * (1 - a)
    out_a = a + ha * (1 - a)
    out = np.zeros(out_pre.shape[:2] + (4,), dtype=np.float32)
    ok = out_a[..., 0] > 1e-4
    out[..., :3][ok] = np.clip(out_pre[ok] / out_a[ok], 0, 1)
    out[..., 3] = np.clip(out_a[..., 0], 0, 1)
    return out
