# -----------------------------------------------------------------------
# SPRINTER — Meba-Mickael Zeze en CARTOON, sur le corps de Quaternius.
#
#   blender -b -P tools/blender/meba_cartoon.py -- [--glb public/vedettes/meba.glb]
#                                                  [--portraits public/vedettes]
#                                                  [--blend FICHIER.blend]
#
# POURQUOI CE CORPS (02/10, a sa demande : « on part pour du cartoon sport low
# poly pour Mickael »). Le corps de MakeHuman, meme regle mesure par mesure,
# restait une poupee lisse. Celui-ci est le « Superhero » des Universal Base
# Characters de Quaternius (CC0, aucun credit requis), version gratuite : un
# corps cartoon d'environ 13 000 triangles, peau foncee peinte, cils et sourcils,
# coiffures et barbe a part, et un squelette AUX NOMS DU JEU (ceux du mannequin
# d'Unreal : pelvis, spine_01, thigh_l...), a la tete pres (« Head »).
#
# CE QUI EST REPRIS DE meba_maillage.py, sans copie : la mise en repere, le
# calage de chaque os sur le rig du jeu (cibles, caler, figer), les coques de
# tenue, les pointes, la chaine, l'export et les portraits. Ce qui ne l'est
# pas : tout ce qui lisait les groupes de MakeHuman (levres, cuir chevelu,
# oreilles) — barbe et cheveux sont ceux de Quaternius, teints et regles.
#
# CE QUI LE FAIT RECONNAITRE, en cartoon : sa peau foncee, ses cheveux noirs
# courts (du volume sur le dessus, les cotes ras), sa barbe pleine et noire, la
# chaine en or, la boucle d'oreille, le blanc de l'equipe de France et les
# pointes jaunes. Pas son visage photo : une tete realiste sur un corps cartoon
# jurerait.
# -----------------------------------------------------------------------

import bpy
import math
import os
import runpy
import sys
from mathutils import Vector

ICI = os.path.dirname(os.path.abspath(__file__))
M = runpy.run_path(os.path.join(ICI, 'meba_maillage.py'), run_name='meba_maillage')

QUAT = '/Volumes/MUSIQUE/BENBEZI/assets-sources/quaternius-base-characters/Universal Base Characters[Standard]'
CORPS = QUAT + '/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf'
POILS = QUAT + '/Hairstyles/Origin at 0/glTF (Godot)/'


# LES LARGEURS DE CE CORPS, que le jeu reprend (look.morph de Meba dans
# sprinter-core.js). Remis aux epaules et aux hanches du mannequin (0,154 et
# 0,082), ses bras rentraient de trois centimetres dans le buste et ses cuisses
# se croisaient : on garde ses jointures, et c'est le jeu qui s'y aligne.
CARRURE = 1.20          # morph.sh : epaules a 0,185
BASSIN = 1.22           # morph.hip : hanches a 0,100
G = M['cibles'].__globals__
G['CARRURE'] = CARRURE
G['SH_Y'] = 0.154 * CARRURE
G['HIP_Y'] = 0.082 * BASSIN

# LES PORTRAITS, LES BRAS ECARTES DU CORPS (02/10, a sa demande) : avec les
# poses de meba_maillage, ce buste large les gardait colles au maillot.
G['DEBOUT'] = dict(G['DEBOUT'], upperarm_l=(0.10, 0.26, 0.0), upperarm_r=(0.10, -0.26, 0.0),
                   lowerarm_l=(0.40, 0.14, 0.0), lowerarm_r=(0.40, -0.14, 0.0),
                   hand_l=(0.40, 0.14, 0.0), hand_r=(0.40, -0.14, 0.0))
G['EN_PIED'] = dict(G['EN_PIED'], upperarm_l=(0.04, 0.34, 0.0), upperarm_r=(0.04, -0.34, 0.0),
                    lowerarm_l=(0.16, 0.36, 0.0), lowerarm_r=(0.16, -0.36, 0.0),
                    hand_l=(0.16, 0.36, 0.0), hand_r=(0.16, -0.36, 0.0))

# Les couleurs : celles de meba_maillage (le look du jeu, les portraits).
# (02/10, « sa peau est trop claire ») : un brun profond, celui de ses photos
PEAU = (60, 37, 29)
# ses yeux : marron tres fonce (la texture de Quaternius les a noisette)
IRIS = (42, 26, 19)
# des poils NOIRS : a la teinte des cheveux de meba_maillage, la texture de
# Quaternius gardait des reflets clairs, et le tout se lisait brun
POIL = (12, 10, 9)


def importer(chemin):
    avant = set(bpy.data.objects)
    # LES SOMMETS SOUDES. Le glTF coupe le maillage le long de ses coutures
    # d'UV ; importe tel quel, chaque coque s'y fendait (les deux bords
    # s'ecartent chacun selon sa normale) : une fente au bas du short, un trait
    # sombre au flanc du maillot.
    bpy.ops.import_scene.gltf(filepath=chemin, merge_vertices=True)
    objs = [o for o in bpy.data.objects if o not in avant]
    # la sphere de deux metres, sans matiere, que le glTF de Quaternius emporte
    for o in [o for o in objs if o.type == 'MESH' and not o.data.materials]:
        objs.remove(o); bpy.data.objects.remove(o, do_unlink=True)
    return objs


def teindre(img, cible, taille=1024, seuil=0.10, sombre=None):
    """Une copie de `img` ramenee a la couleur moyenne `cible` (sRGB 0-255).

    Les textures de Quaternius sont peintes pour etre teintes par ses shaders
    (peau « Dark » caramel, poils gris clair) : on garde leur modele — les
    muscles, les meches — et on deplace leur moyenne, dans l'espace lineaire.
    Les zones presque noires (le slip peint, le fond) ne comptent pas dans la
    moyenne."""
    import numpy as np
    im = img.copy()
    im.scale(taille, taille)
    px = np.array(im.pixels[:], dtype=np.float32).reshape(-1, 4)
    lin = np.where(px[:, :3] <= 0.04045, px[:, :3] / 12.92, ((px[:, :3] + 0.055) / 1.055) ** 2.4)
    lum = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    # la peau est chaude (rouge > bleu) ; le slip peint, gris, ne l'est pas
    garde = (lum > seuil * seuil) & (px[:, 3] > 0.5)
    if sombre is not None:
        garde &= (px[:, 0] - px[:, 2]) > 0.10
    moy = lin[garde].mean(0) if garde.any() else lin.mean(0)
    voulu = np.array([M['srgb_vers_lin'](c / 255) for c in cible], dtype=np.float32)
    lin = np.clip(lin * (voulu / np.maximum(moy, 1e-4)), 0.0, 1.0)
    # (`sombre` : la couleur que prennent ces zones — le slip peint devient le
    # bleu du short, qui ne laisse alors aucune fente grise a sa lisiere)
    if sombre is not None:
        lin[~garde] = np.array([M['srgb_vers_lin'](c / 255) for c in sombre], dtype=np.float32)
    px[:, :3] = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)
    im.pixels[:] = px.ravel()
    im.name = img.name + '_teinte'
    im.pack()
    return im


def matiere_teinte(mat, nom, cible, brillant=None, sombre=None):
    """La matiere renommee, sa texture de couleur teinte.

    Quaternius teint ses matieres par la COULEUR DES SOMMETS (un melange
    « multiplier » entre la texture et l'attribut de couleur) : les poils
    sortaient de leur couleur de sommet, les sourcils blancs, la peau caramel.
    Le melange est retire — la texture teinte va seule a la couleur de base,
    et le glTF n'emporte pas d'attribut de couleur pour elles."""
    mat.name = nom
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    base = bsdf.inputs['Base Color']
    src = base.links[0].from_node if base.is_linked else None
    if src is not None and src.type == 'MIX':
        tex = next((l.from_node for s_ in src.inputs if s_.is_linked for l in s_.links
                    if l.from_node.type == 'TEX_IMAGE'), None)
        for n in [src] + [l.from_node for s_ in src.inputs if s_.is_linked for l in s_.links
                          if l.from_node.type == 'VERTEX_COLOR']:
            nt.nodes.remove(n)
        src = tex
        if tex is not None:
            nt.links.new(tex.outputs['Color'], base)
    if cible is not None and src is not None and src.type == 'TEX_IMAGE':
        src.image = teindre(src.image, cible, sombre=sombre)
    if brillant is not None and 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = brillant
    return mat


def volume_du_dessus(o, haut=0.016):
    """SES CHEVEUX : du volume sur le dessus, les cotes ras (ses photos).

    La coupe « Buzzed » de Quaternius est rase partout. Sur ses photos de face
    et de profil, le dessus monte de plusieurs centimetres, le plein au sommet
    et un peu vers l'arriere, et les cotes restent au ras. On gonfle donc la
    coque le long de ses normales, de rien aux tempes a `haut` au sommet ; ses
    bords restent poses sur le crane (le gonflement s'eteint sur trois rangs),
    sans quoi la lisiere se decollait et laissait voir la peau dessous."""
    import bmesh
    from mathutils import Matrix
    o.data.transform(o.matrix_world); o.matrix_world = Matrix.Identity(4)
    bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update()
    zs = [v.co.z for v in bm.verts]; z0, z1 = min(zs), max(zs)
    ys = [v.co.y for v in bm.verts]; y0, y1 = min(ys), max(ys)
    rang = {v: 0 for v in bm.verts if v.is_boundary}
    front, k = list(rang), 0
    while front and k < 3:
        k += 1; suite = []
        for v in front:
            for e in v.link_edges:
                w = e.other_vert(v)
                if w not in rang:
                    rang[w] = k; suite.append(w)
        front = suite
    lisse = lambda t: (lambda u: u * u * (3 - 2 * u))(max(0.0, min(1.0, t)))
    depl = {}
    for v in bm.verts:
        dessus = lisse(((v.co.z - z0) / max(1e-6, z1 - z0) - 0.40) / 0.60)
        # le personnage regarde -y : l'arriere du crane est vers +y
        arriere = lisse((v.co.y - (y0 + y1) / 2) / max(1e-6, (y1 - y0) / 2))
        depl[v] = v.normal * haut * dessus * (1.0 + 0.30 * arriere) * min(1.0, rang.get(v, 3) / 3)
    for v, d in depl.items():
        v.co += d
    bm.to_mesh(o.data); bm.free()


def corps():
    """Le corps de Quaternius, ses poils, un seul maillage pondere, cale sur le jeu."""
    sc = M['scene_neuve']()
    objs = importer(CORPS)
    rig = next(o for o in objs if o.type == 'ARMATURE')
    rig.name = 'Meba_rig'
    # la tete s'appelle « Head » chez Quaternius, « head » dans le jeu
    rig.data.bones['Head'].name = 'head'
    maillages = [o for o in objs if o.type == 'MESH']
    poils = []
    for nom in ('Hair_Buzzed', 'Hair_Beard'):
        for o in importer(POILS + nom + '.gltf'):
            if o.type == 'MESH':
                poils.append(o)
            else:
                bpy.data.objects.remove(o, do_unlink=True)
    # les poils sont poses a l'origine, a leur place sur la tete : portes par
    # l'os de la tete, entierement
    volume_du_dessus(next(o for o in poils if 'Buzzed' in o.name))
    for o in poils:
        bpy.context.view_layer.update()
        mw = o.matrix_world.copy()
        o.parent = None; o.matrix_world = mw
        g = o.vertex_groups.new(name='head')
        g.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    for o in maillages:
        g = o.vertex_groups.get('Head')
        if g: g.name = 'head'
    corps_ = next(o for o in maillages if o.name.startswith('SuperHero'))
    # SA PEAU ET SES POILS. La peau garde le nom du jeu (vedette-3d.ts l'eclaircit
    # pour le stade) ; cheveux, barbe et sourcils partagent une seule matiere,
    # mate (le reflet d'un Principled les grisait).
    matiere_teinte(corps_.data.materials[0], 'Meba_peau', PEAU, sombre=M['SHORT'])
    poil = None
    for o in maillages + poils:
        for k, m in enumerate(o.data.materials):
            if m and m.name.startswith('MI_Hair'):
                if poil is None:
                    poil = matiere_teinte(m.copy(), 'Meba_poils', POIL, 0.08)
                o.data.materials[k] = poil
            elif m and m.name.startswith('MI_Eyes'):
                matiere_teinte(m, 'Meba_yeux', None)
                assombrir_iris(m)
                # un reflet net et petit : large, le reflet du ciel voilait
                # l'iris d'un gris et le regard se vidait
                b_ = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
                b_.inputs['Roughness'].default_value = 0.12
                if 'Specular IOR Level' in b_.inputs:
                    b_.inputs['Specular IOR Level'].default_value = 0.30
    # un seul objet, enfant du rig, avec son modificateur d'armature
    bpy.ops.object.select_all(action='DESELECT')
    for o in maillages + poils:
        for m in list(o.modifiers):
            if m.type == 'ARMATURE' and o is not corps_:
                o.modifiers.remove(m)
        o.select_set(True)
    bpy.context.view_layer.objects.active = corps_
    bpy.ops.object.join()
    h = corps_
    h.name = 'Meba_corps'
    if not any(m.type == 'ARMATURE' for m in h.modifiers):
        mod = h.modifiers.new('Armature', 'ARMATURE')
    for m in h.modifiers:
        if m.type == 'ARMATURE':
            m.object = rig
    M['mise_en_repere'](h, rig)
    b_ = rig.data.bones
    print('epaule', tuple(round(x, 3) for x in b_['upperarm_l'].head_local),
          'hanche', tuple(round(x, 3) for x in b_['thigh_l'].head_local),
          '-> jeu', round(G['SH_Y'], 3), round(G['HIP_Y'], 3))
    adoucir_epaules(h)
    herite = M['caler'](rig, cibles(rig))
    figer(h, rig, herite)
    affiner_bras(h, rig)
    return sc, h, rig


# LES BRAS PLUS FINS (02/10, a sa demande : « rends les bras legerement plus
# fins », puis « affine les bras ») : le rayon du bras et de l'avant-bras
# autour de leur os, a 80 % (90 % la premiere fois). Le jeu affine d'autant
# ceux de sa doublure en tubes (morph.arm dans sprinter-core.js).
BRAS = 0.80


def affiner_bras(h, rig, k=BRAS):
    """Chaque sommet se rapproche de l'axe de son os (bras, avant-bras), au
    prorata de son poids : le coude et le poignet, partages avec l'os voisin,
    restent continus. Pres de l'epaule, l'effet s'efface sur le premier quart
    du bras : la carrure (morph.sh, le squelette du jeu) ne bouge pas ; et la
    peau que la clavicule ou le buste portent encore (l'aisselle) non plus."""
    lisse = lambda t: (lambda u: u * u * (3 - 2 * u))(max(0.0, min(1.0, t)))
    mi = h.matrix_world.inverted()
    rw = rig.matrix_world
    segs = {}
    for nom in ('upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r'):
        b = rig.data.bones[nom]
        segs[h.vertex_groups[nom].index] = (mi @ (rw @ b.head_local), mi @ (rw @ b.tail_local),
                                            nom.startswith('upper'))
    tronc = {h.vertex_groups[o].index for o in ('clavicle_l', 'clavicle_r', 'spine_03', 'spine_02')
             if o in h.vertex_groups}
    avant, apres, n = [], [], 0
    for v in h.data.vertices:
        d = Vector()
        # l'aisselle, que la clavicule ou le buste tiennent encore, reste ou
        # elle est : rapprochee du bras, elle sortait du maillot en eclat
        libre = max(0.0, 1.0 - 6.0 * sum(g.weight for g in v.groups if g.group in tronc))
        if libre <= 0:
            continue
        for g in v.groups:
            s = segs.get(g.group)
            if s is None or g.weight <= 0:
                continue
            a, b, haut = s
            ab = b - a
            t = (v.co - a).dot(ab) / ab.length_squared
            p = a + ab * max(0.0, min(1.0, t))
            f = lisse(t / 0.25) if haut else 1.0
            d += (p - v.co) * (1 - k) * g.weight * f * libre
            if haut and 0.45 < t < 0.55 and g.weight > 0.95:
                avant.append((v.co - p).length)
                apres.append((v.co + d - p).length)
        if d.length_squared > 0:
            v.co += d
            n += 1
    h.data.update()
    if avant:
        print('bras :', n, 'sommets ; rayon au milieu du bras',
              round(sum(avant) / len(avant) * 1000, 1), '->', round(sum(apres) / len(apres) * 1000, 1), 'mm')


def ilots(h, nom):
    """Les pieces detachees d'une matiere, en listes de sommets. Chez
    Quaternius, cheveux, barbe, sourcils et cils partagent la matiere des
    poils : seule leur piece les distingue."""
    mats = [m.name for m in h.data.materials]
    k = mats.index(nom)
    par = {}

    def racine(a):
        while par[a] != a:
            par[a] = par[par[a]]
            a = par[a]
        return a
    for p in h.data.polygons:
        if p.material_index != k:
            continue
        vs = list(p.vertices)
        for v in vs:
            par.setdefault(v, v)
        for v in vs[1:]:
            a, b = racine(vs[0]), racine(v)
            if a != b:
                par[a] = b
    out = {}
    for v in par:
        out.setdefault(racine(v), []).append(v)
    return list(out.values())


def visage(h):
    """SES TRAITS, sur le visage de Quaternius (02/10 : « le nez n'est pas le
    sien », « le regard, ce n'est pas la meme personne »).

    Releves sur ses photos de face (meba-visage-sources) : un nez large aux
    ailes ouvertes, court, le bout rond ; des yeux plus grands et plus ouverts
    que ceux, plisses, du modele ; une bouche large, la levre du bas pleine et
    rose ; des sourcils plus fins que ceux du modele, ecartes du nez, en arc.
    Chaque trait est un champ de deplacement doux autour de son repere (le
    centre des yeux, le bout du nez, la fente de la bouche), pose sur la peau
    et les poils au repos.

    LES MESURES (02/10) sont prises sur la photo neutre 2, ramenee a l'echelle
    du portrait de face : meme ecart des iris (117 px pour 59 mm), iris
    superposes. Les hauteurs sont comptees depuis le centre de l'oeil."""
    import numpy as np
    from mathutils.bvhtree import BVHTree
    lisse = lambda t: (lambda u: u * u * (3 - 2 * u))(max(0.0, min(1.0, t)))
    g = lambda u: math.exp(-u * u)
    mats = [m.name for m in h.data.materials]
    par = {}
    for p in h.data.polygons:
        par.setdefault(mats[p.material_index], set()).update(p.vertices)
    V = h.data.vertices
    yeux = {}
    for s_ in (1, -1):
        e = [V[i].co for i in par['Meba_yeux'] if V[i].co.y * s_ > 0]
        yeux[s_] = sum(e, Vector()) / len(e)
    zY = (yeux[1].z + yeux[-1].z) / 2
    peau = [i for i in par['Meba_peau'] if V[i].co.z > zY - 0.10]
    bout = max((V[i].co for i in peau if abs(V[i].co.y) < 0.01), key=lambda q: q.x).copy()
    # le visage au repos : les levres se peignent sur lui
    repos = [v.co.copy() for v in V]
    depl = {}
    for i in peau:
        q = V[i].co
        d = Vector()
        ay = abs(q.y); sy = 1.0 if q.y >= 0 else -1.0
        devant = lisse((q.x - (bout.x - 0.040)) / 0.015)
        # LE NEZ : les ailes s'ouvrent, le bout recule et s'arrondit, l'arete
        # s'abaisse un peu
        # (02/10, « toujours pas un nez epate ») : les ailes nettement plus
        # larges, le bout elargi et rentre, l'arete basse — un nez plat et
        # large, pas un nez droit elargi
        # (puis « retrecis le nez » : a 11 mm, les ailes debordaient ; 6 mm)
        ailes = g((q.z - (bout.z - 0.004)) / 0.012) * g((ay - 0.013) / 0.012) * devant
        d.y += sy * 0.0060 * ailes
        d.x += 0.0008 * ailes
        pointe = g((q.z - bout.z) / 0.010) * g(q.y / 0.012) * devant
        d.x -= 0.0050 * pointe
        d.y += q.y * 0.20 * pointe
        arete = lisse((q.z - (bout.z + 0.006)) / 0.010) * lisse((zY - q.z) / 0.010)
        d.x -= 0.0025 * arete * g(q.y / 0.010) * devant
        # LES YEUX EN AMANDE (02/10 : « trop ronds, les siens sont en
        # amande ») : la fente s'allonge vers les tempes et s'ouvre au milieu
        # seulement, les coins restent serres ; le coin exterieur descend un
        # peu, comme sur ses photos.
        for s_, E in yeux.items():
            r = math.hypot(q.y - E.y, (q.z - E.z) * 1.3)
            if q.x > E.x - 0.008 and r < 0.026:
                f = 1.0 - lisse((r - 0.011) / 0.013)
                u = max(-1.0, min(1.0, (q.y - E.y) / 0.016))
                d.z += (q.z - E.z) * 0.10 * f * (1.0 - u * u)
                d.y += (q.y - E.y) * 0.14 * f
                dehors = max(0.0, (abs(q.y) - abs(E.y)) / 0.016)
                d.z -= 0.0016 * f * min(1.0, dehors)
        if d.length_squared > 0:
            depl[i] = d
    # SA BOUCHE (« respecte la forme de ses levres »). Releve au rayon sur ce
    # visage : la fente est a 2,9 cm sous le bout du nez (et non 4,1 : la, c'est
    # le creux sous la levre du bas), les coins a 17,5 mm du milieu, la levre
    # du bas haute de 8,5 mm. Sur sa photo, a la meme echelle : une bouche de
    # 45 mm (35 ici), une levre du bas de 13 a 15 mm, la fente 2 mm plus bas.
    # Le champ porte la peau ET la barbe : la moustache et le dessous de la
    # levre suivent la bouche au lieu d'etre traverses par elle.
    zs = bout.z - 0.029
    LARGE = 1.28        # la bouche : 35 -> 45 mm
    PLEINE = 1.5        # la levre du bas : 8,5 -> 12,7 mm
    L = 0.0085

    def bouche(q):
        Z = q.z - zs
        ay = abs(q.y); sy = 1.0 if q.y >= 0 else -1.0
        fr = lisse((q.x - 0.045) / 0.020)
        if fr <= 0 or ay > 0.036 or not (-0.024 < Z < 0.015):
            return None
        wz = (1 - lisse((Z - 0.007) / 0.007)) if Z > 0 else (1 - lisse((-Z - 0.011) / 0.011))
        wy = 1 - lisse((ay - 0.016) / 0.018)
        d = Vector()
        # elargie : chaque point glisse vers le coin, et recule avec la joue
        # (la face fuit en x = -19 y^2 autour de la bouche)
        dy = (LARGE - 1) * ay * wy * wz * fr
        d.y = sy * dy
        d.x = -19.0 * ((ay + dy) ** 2 - ay ** 2)
        # la levre du bas, etiree vers le bas et avancee, pleine au milieu
        wl = (1 - lisse((ay - 0.008) / 0.012)) * fr
        if Z < 0:
            if Z > -L:
                d.z += (PLEINE - 1) * Z * wl
            else:
                d.z -= (PLEINE - 1) * L * (1 - lisse((-Z - L) / 0.012)) * wl
            d.x += 0.0025 * g((Z + 0.005) / 0.0045) * wl
        # et toute la bouche un peu plus bas
        d.z -= 0.002 * wz * wy * fr
        return d
    for i in set(peau) | par['Meba_poils']:
        d = bouche(V[i].co)
        if d is not None:
            depl[i] = depl.get(i, Vector()) + d
    for i, d in depl.items():
        V[i].co += d
    ip = mats.index('Meba_peau')
    arbre = BVHTree.FromPolygons([v.co.copy() for v in V],
                                 [tuple(p.vertices) for p in h.data.polygons if p.material_index == ip])

    def x_peau(y, z):
        hit = arbre.ray_cast(Vector((0.4, y, z)), Vector((-1.0, 0.0, 0.0)))
        return hit[0].x if hit[0] is not None else None
    # SES SOURCILS, A LEUR FORME (02/10 : « reprends la forme de ses
    # sourcils »). Sur sa photo de face : la tete, epaisse et carree, commence a
    # 14 mm du milieu (6,7 sur le modele) et a 11 mm au-dessus de l'oeil ;
    # l'arc monte en douceur jusqu'a 16,7 mm vers 40 mm du milieu ; la queue,
    # fine, redescend jusqu'a 51 mm. Epais de 6,5 mm a la tete, 5 a l'arc, 2,4 au
    # bout (a 4 mm a l'arc, ils se lisaient epiles).
    # Chaque sourcil est sa PIECE de poils : choisi par fenetre, il emportait
    # la lisiere des cheveux et les cils, et ses tranches se decalaient en
    # crans. Chaque sommet garde sa place dans l'epaisseur (u, de 0 en bas a 1
    # en haut) et sa hauteur au-dessus de la peau.
    courbe = M['courbe']
    HAUT = courbe([(14, 11.3), (20, 12.0), (25, 13.4), (30, 15.0), (35, 16.2),
                   (40, 16.7), (45, 15.8), (51, 12.8)])
    EPAIS = courbe([(14, 6.5), (22, 6.3), (30, 5.8), (40, 5.0), (47, 3.8), (51, 2.4)])
    Y0, Y1 = 0.014, 0.051
    sourcils = [vs for vs in ilots(h, 'Meba_poils') if len(vs) > 60
                and all(zY - 0.002 < V[i].co.z < zY + 0.035 for i in vs)
                and len({V[i].co.y > 0 for i in vs}) == 1]
    for vs in sourcils:
        s_ = 1 if V[vs[0]].co.y > 0 else -1
        E = yeux[s_]
        co = np.array([tuple(V[i].co) for i in vs])
        ay = np.abs(co[:, 1]); z = co[:, 2]
        t = (ay - ay.min()) / (ay.max() - ay.min())
        r = z - np.polyval(np.polyfit(t, z, 3), t)
        nb = 12
        k = np.minimum(nb - 1, (t * nb).astype(int))
        pleins = [j for j in range(nb) if (k == j).any()]
        cen = (np.array(pleins) + 0.5) / nb
        lo = np.interp(t, cen, [r[k == j].min() for j in pleins])
        hi = np.interp(t, cen, [r[k == j].max() for j in pleins])
        u = np.clip((r - lo) / np.maximum(hi - lo, 1e-5), 0.0, 1.0)
        for j, i in enumerate(vs):
            q = V[i].co
            yn = Y0 + t[j] * (Y1 - Y0)
            zn = E.z + (HAUT(yn * 1000) + (u[j] - 0.5) * EPAIS(yn * 1000)) / 1000
            xa, xb = x_peau(q.y, q.z), x_peau(s_ * yn, zn)
            xn = q.x + (xb - xa if xa is not None and xb is not None else 0.0)
            V[i].co = Vector((xn, s_ * yn, zn))
    h.data.update()
    piece = barbe_jusqu_a_la_levre(h, bouche, bout, arbre, x_peau)
    peindre_levres(h, repos, bout)
    lisiere_plus_basse(h, yeux)
    plus_de_cheveux(h, yeux)
    barbe_moins_pointue(h, yeux)
    poils_crepus(h, piece)
    print('visage :', len(depl), 'sommets,', len(sourcils), 'sourcils, bout du nez',
          tuple(round(c, 3) for c in bout))


def barbe_jusqu_a_la_levre(h, bouche, bout, arbre, x_peau):
    """SA BARBE MONTE JUSQU'A LA LEVRE (02/10, a sa demande). Celle de
    Quaternius laisse un U de peau nue sous la bouche : 1 mm sous la levre au
    milieu, 15 mm a 16 mm du milieu, et sous les coins jusqu'a la moustache,
    sur 34 mm de chaque cote. Sur ses photos, la barbe est pleine du bord de
    la levre du bas a la machoire, et rejoint la moustache aux coins.

    Colonne par colonne (tous les 0,5 mm en y), le trou est releve au rayon :
    le bas de la moustache, puis le haut de la barbe du menton. Il est bouche
    par une PIECE NEUVE : les faces de peau du trou, doublees, levees de
    2,5 mm sur leur normale, dans la matiere des poils, d'une seule teinte de
    la barbe. Son bord haut est pose sur le bord de la levre du bas (0,5 mm
    dessous) — tel que la bouche l'a deforme —, et au-dela des coins sous la
    moustache ; son bord bas passe derriere la barbe du menton.
    (Etirer la barbe de Quaternius ne marchait pas : sa coque n'a que deux
    rangs sur le devant du menton, puis le dessous de la barbe, qui remontait
    en auvent devant la bouche.)"""
    import bmesh
    import numpy as np
    from mathutils.bvhtree import BVHTree
    V = h.data.vertices
    mats = [m.name for m in h.data.materials]
    ip, ipo = mats.index('Meba_peau'), mats.index('Meba_poils')
    barbe = min(ilots(h, 'Meba_poils'), key=lambda vs: min(V[i].co.z for i in vs))
    bs = set(barbe)
    poly_b = [p for p in h.data.polygons if set(p.vertices) <= bs]
    arbre_b = BVHTree.FromPolygons([v.co.copy() for v in V], [tuple(p.vertices) for p in poly_b])

    def couvert(y, z):
        a = arbre.ray_cast(Vector((0.4, y, z)), Vector((-1.0, 0.0, 0.0)))
        b = arbre_b.ray_cast(Vector((0.4, y, z)), Vector((-1.0, 0.0, 0.0)))
        return b[0] is not None and (a[0] is None or b[0].x > a[0].x - 0.0005)
    # le bord de la levre du bas (celui que peindre_levres trace), deforme
    # comme la bouche
    bord = []
    for k in range(179):
        yo = k / 10000
        u = min(1.0, yo / 0.0178)
        zo = bout.z - 0.0290 - 0.0015 * u * u - 0.0085 * math.sqrt(max(0.0, 1 - u ** 4))
        d = bouche(Vector((0.09, yo, zo))) or Vector()
        bord.append((yo + d.y, zo + d.z))
    coin = bord[-1][0]
    PAS, FIN = 0.0005, bout.z - 0.090
    ys, mentons, hauts = [], [], []
    for k in range(80):
        y = k * PAS
        z = bout.z - 0.012
        while z > FIN and not couvert(y, z):
            z -= PAS
        while z > FIN and couvert(y, z):
            z -= PAS
        haut = z
        while z > FIN and not couvert(y, z):
            z -= PAS
        if z <= FIN:
            break
        haut = (float(np.interp(y, [b[0] for b in bord], [b[1] for b in bord])) - 0.0005
                if y < coin else haut + 0.0010)
        ys.append(y); mentons.append(z); hauts.append(max(haut, z))
    menton = lambda ay: float(np.interp(ay, ys, mentons))
    haut = lambda ay: float(np.interp(ay, ys, hauts))
    # une teinte de la barbe : le texel le plus sombre (2 %) sous les UV du
    # devant du menton. Les texels y vont de 0,021 a 0,041 ; a la mediane, la
    # piece, toute de face a la lumiere, sortait grise a cote de la coque.
    tex = next(n for n in h.data.materials[ipo].node_tree.nodes if n.type == 'TEX_IMAGE').image
    W, H = tex.size
    pxs = np.empty(W * H * 4, dtype=np.float32)
    tex.pixels.foreach_get(pxs)
    pxs = pxs.reshape(H, W, 4)
    uvd = h.data.uv_layers.active.data
    ech = []
    for p in poly_b:
        if p.center.x > 0.07 and p.center.z < bout.z - 0.035:
            for li in p.loop_indices:
                u, v = uvd[li].uv
                c = pxs[min(H - 1, int(v * H)) % H, min(W - 1, int(u * W)) % W, :3]
                ech.append((float(c @ np.array([0.2126, 0.7152, 0.0722])), (u, v)))
    ech.sort()
    uv_barbe = ech[len(ech) // 50][1]
    # la piece : les faces de peau du trou, et 9 mm sous la barbe du menton,
    # derriere sa coque (a 5 mm, deux points de peau restaient pres du bouc)
    bm = bmesh.new()
    bm.from_mesh(h.data)
    uvls = list(bm.loops.layers.uv.values())
    choix = []
    for f in bm.faces:
        if f.material_index != ip:
            continue
        c = f.calc_center_median()
        ay = abs(c.y)
        if c.x < 0.06 or ay > ys[-1] or c.z > bout.z - 0.020:
            continue
        if menton(ay) - 0.009 < c.z < haut(ay):
            choix.append(f)
    res = bmesh.ops.duplicate(bm, geom=choix)
    nf = [g for g in res['geom'] if isinstance(g, bmesh.types.BMFace)]
    nv = [g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)]
    bm.normal_update()
    libres = {v for f in nf for e in f.edges if len(e.link_faces) == 1 for v in e.verts}
    for v in nv:
        ay = abs(v.co.y)
        n = v.normal.copy()
        # le bord haut, pose sur la ligne de la levre (sur la peau)
        if v in libres and v.co.z > (menton(ay) + haut(ay)) / 2:
            zn = haut(ay)
            xn = x_peau(v.co.y, zn)
            if xn is not None:
                v.co.x, v.co.z = xn, zn
        # 2,5 mm sur la peau, 1 mm au ras de la levre
        pres = haut(ay) - v.co.z
        ep = 0.0010 + 0.0015 * min(1.0, max(0.0, pres / 0.002)) if ay < coin else 0.0025
        v.co += n * ep
    for f in nf:
        f.material_index = ipo
        for l in f.loops:
            for L_ in uvls:
                l[L_].uv = uv_barbe
    bm.to_mesh(h.data)
    bm.free()
    h.data.update()
    print('barbe :', len(nf), 'faces ajoutees, trou le plus haut',
          round(max(a - b for a, b in zip(hauts, mentons)) * 1000, 1), 'mm, coin a',
          round(coin * 1000, 1), 'mm')
    return len(nf)


# LE FRONT MOINS HAUT (02/10, a sa demande : « retrecis la hauteur du
# front ») : la lisiere descend de 11 mm au milieu — du sourcil a la lisiere,
# 40 mm deviennent 29.
LISIERE = 0.011


def lisiere_plus_basse(h, yeux, dz=None):
    """Les cheveux du devant glissent vers le bas sur le front : `dz` a la
    lisiere, rien 45 mm au-dessus ; autant sur toute la largeur du front, rien
    aux tempes (a 65 mm du milieu). Chaque sommet suit la peau (sa hauteur
    au-dessus du front est gardee)."""
    from mathutils.bvhtree import BVHTree
    dz = LISIERE if dz is None else dz
    lisse = lambda t: (lambda u: u * u * (3 - 2 * u))(max(0.0, min(1.0, t)))
    V = h.data.vertices
    mats = [m.name for m in h.data.materials]
    iy, ip = mats.index('Meba_yeux'), mats.index('Meba_peau')
    cx = max(V[i].co.x for p in h.data.polygons if p.material_index == iy for i in p.vertices)
    ez = (yeux[1].z + yeux[-1].z) / 2
    cheveux = max(ilots(h, 'Meba_poils'), key=lambda vs: max(V[i].co.z for i in vs))
    arbre = BVHTree.FromPolygons([v.co.copy() for v in V],
                                 [tuple(p.vertices) for p in h.data.polygons if p.material_index == ip])

    def x_peau(y, z):
        hit = arbre.ray_cast(Vector((0.4, y, z)), Vector((-1.0, 0.0, 0.0)))
        return hit[0].x if hit[0] is not None else None
    lis = min(V[i].co.z for i in cheveux if abs(V[i].co.y) < 0.01 and V[i].co.x > cx - 0.04)
    for i in cheveux:
        q = V[i].co
        w = lisse((q.x - cx + 0.060) / 0.030) * (1.0 - lisse((abs(q.y) - 0.045) / 0.020))
        d = dz * w * (1.0 - lisse((q.z - lis) / 0.045))
        if d <= 1e-5 or q.z < lis - 0.010:
            continue
        xa, xb = x_peau(q.y, q.z), x_peau(q.y, q.z - d)
        if xa is None or xb is None:
            continue
        q.x += xb - xa
        q.z -= d
    h.data.update()
    print('lisiere :', round((lis - ez) * 1000), '->',
          round((min(V[i].co.z for i in cheveux if abs(V[i].co.y) < 0.01 and V[i].co.x > cx - 0.04) - ez) * 1000),
          'mm au-dessus de l oeil')


# SES CHEVEUX : quelle part du chemin vers le contour de sa photo de profil.
# (02/10 : refaite tout entiere — front, lisiere, crane, machoire —, sa tete
# ne lui ressemblait plus ; il a garde la premiere, « avec plus de cheveux ».)
VOLUME = 0.6


def plus_de_cheveux(h, yeux, part=None):
    """PLUS DE CHEVEUX (02/10, a sa demande). La coque « Buzzed », meme gonflee
    dessus (volume_du_dessus), reste un casque ; sur ses photos, la masse est
    ronde et haute, se dresse devant et part en arriere, les cotes ras (sa
    coupe degradee).

    Son contour est releve sur sa photo de profil (neutre-profil-gauche, a
    3 px/mm : les yeux, la bouche et le bas de la barbe y tombent aux memes
    hauteurs que sur ce visage), cale sur l'OREILLE et la hauteur des yeux —
    pas sur l'oeil, 19 mm plus enfonce sur ce visage cartoon. En mm, x vers
    l'avant depuis l'avant de l'oeil, z depuis le centre de l'oeil : sommet
    +136 (ici +112), arriere -199 a z+58 (ici -169), devant -12 a z+112 (ici
    -63). Chaque sommet de la coque s'eloigne du centre de la masse (x-99,
    z+60), dans le plan de profil, de `part` du chemin jusqu'a ce contour, a
    son angle. Les cotes, dont la normale regarde de cote, n'en prennent
    presque rien ; le bord de la coque reste sur le crane (le gonflement
    s'eteint sur trois rangs)."""
    import numpy as np
    from collections import Counter
    part = VOLUME if part is None else part
    V = h.data.vertices
    mats = [m.name for m in h.data.materials]
    iy = mats.index('Meba_yeux')
    cx = max(V[i].co.x for p in h.data.polygons if p.material_index == iy for i in p.vertices)
    ez = (yeux[1].z + yeux[-1].z) / 2
    cheveux = max(ilots(h, 'Meba_poils'), key=lambda vs: max(V[i].co.z for i in vs))
    CONTOUR = [(-0.2, 78.3), (-6.8, 95.0), (-11.8, 111.7), (-16.8, 121.7), (-31.8, 130.0),
               (-61.8, 135.7), (-91.8, 135.0), (-118.5, 130.0), (-145.0, 125.0), (-171.8, 98.3),
               (-188.5, 81.7), (-198.5, 58.3), (-191.8, 41.7), (-188.5, 21.7), (-178.5, 5.0),
               (-165.0, -5.0), (-151.8, -25.0)]
    OX, OZ = -0.099, 0.060
    ang = []
    for X_, Z_ in CONTOUR:
        a_ = math.atan2(Z_ / 1000 - OZ, X_ / 1000 - OX)
        if ang and a_ < ang[-1][0] - 1e-9:
            a_ += 2 * math.pi
        ang.append((a_, math.hypot(X_ / 1000 - OX, Z_ / 1000 - OZ)))
    angles = np.array([a for a, _ in ang]); rayons = np.array([r for _, r in ang])
    cs = set(cheveux)
    nb = {}
    for e in h.data.edges:
        a_, b_ = e.vertices
        if a_ in cs and b_ in cs:
            nb.setdefault(a_, []).append(b_); nb.setdefault(b_, []).append(a_)
    nf = Counter()
    for p in h.data.polygons:
        if set(p.vertices) <= cs:
            for ek in p.edge_keys:
                nf[ek] += 1
    rang = {v: 0 for ek, n in nf.items() if n == 1 for v in ek}
    front, k = list(rang), 0
    while front and k < 3:
        k += 1; suite = []
        for v in front:
            for w in nb.get(v, ()):
                if w not in rang:
                    rang[w] = k; suite.append(w)
        front = suite
    gonfle = {}
    for i in cheveux:
        q, n = V[i].co, V[i].normal
        dx_, dz_ = q.x - cx - OX, q.z - ez - OZ
        a_ = math.atan2(dz_, dx_)
        if a_ < angles[0] - 0.15:
            a_ += 2 * math.pi
        if not (angles[0] - 0.15 <= a_ <= angles[-1] + 0.15):
            continue
        manque = float(np.interp(a_, angles, rayons)) - math.hypot(dx_, dz_)
        if manque <= 0:
            continue
        w = (1.0 - min(1.0, abs(n.y)) ** 2) * min(1.0, rang.get(i, 3) / 3)
        gonfle[i] = Vector((math.cos(a_), 0.0, math.sin(a_))) * manque * part * w
    for i, d in gonfle.items():
        V[i].co += d
    h.data.update()
    C = [V[i].co for i in cheveux]
    print('cheveux : sommet', round((max(q.z for q in C) - ez) * 1000), 'arriere',
          round((min(q.x for q in C) - cx) * 1000), '; sommets gonfles', len(gonfle))


def barbe_moins_pointue(h, yeux):
    """UNE BARBE MOINS POINTUE (02/10, a sa demande). Celle de Quaternius
    finit en pointe : vue de face, son bas descend de 1,1 mm par mm vers le
    milieu (-130 mm sous l'oeil au milieu, -103 a 30 mm, -92 a 38 mm). Sur sa
    photo de face, le bas est un U large : -127 au milieu, -114 encore a
    38 mm, et il remonte vers la machoire au-dela de 45 mm.

    Colonne par colonne (en |y|), les 25 derniers millimetres de la barbe
    s'etirent ou se tassent pour que son bas tombe sur ce U ; au-dela de
    56 mm du milieu, rien ne bouge."""
    import numpy as np
    V = h.data.vertices
    ez = (yeux[1].z + yeux[-1].z) / 2
    barbe = min(ilots(h, 'Meba_poils'), key=lambda vs: min(V[i].co.z for i in vs))
    # le bas actuel, par bandes de 2 mm
    bandes = {}
    for i in barbe:
        k = int(abs(V[i].co.y) / 0.002)
        z = V[i].co.z - ez
        bandes[k] = min(bandes.get(k, 0.0), z)
    ks = sorted(bandes)
    ys_b = np.array([(k + 0.5) * 0.002 for k in ks]); zb_b = np.array([bandes[k] for k in ks])
    U = [(0, -127), (10, -127), (20, -125), (30, -120), (38, -113), (44, -104), (48, -95),
         (52, -84), (56, -72)]
    ys_u = np.array([a / 1000 for a, _ in U]); zs_u = np.array([b / 1000 for _, b in U])
    bouges = 0
    for i in barbe:
        q = V[i].co
        ay = abs(q.y)
        if ay > 0.056:
            continue
        zb = float(np.interp(ay, ys_b, zb_b))
        zt = float(np.interp(ay, ys_u, zs_u))
        haut = zb + 0.025
        z = q.z - ez
        if z >= haut:
            continue
        zn = haut + (z - haut) * (haut - zt) / (haut - zb)
        q.z = ez + max(zn, zt - 0.002)
        bouges += 1
    h.data.update()
    print('barbe : bas en U,', bouges, 'sommets ; milieu', round(float(zb_b[0]) * 1000), '->',
          U[0][1], ', a 30 mm', round(float(np.interp(0.030, ys_b, zb_b)) * 1000), '-> -120')


# SES POILS SONT CREPUS (02/10, a sa demande : « la barbe est de style afro,
# pas la meme texture que caucasien »). La texture de Quaternius peint des
# meches droites, en longs traits clairs. Sur ses photos, barbe et cheveux sont
# des boucles serrees de 2 a 3 mm, mates, qui ne font aucune meche.
BOUCLE_MM = 60.0       # une tuile de la texture couvre 6 cm de barbe


def texture_crepue(taille=256, n=2200, graine=7):
    """Une tuile de boucles serrees, raccordable sur ses quatre bords : des
    anneaux de 1,8 a 3,2 px (1 a 1,5 mm de rayon sous BOUCLE_MM), ouverts par
    endroits — des spirales plus que des cercles —, un peu plus clairs que le
    fond, sur un fond presque noir."""
    import numpy as np
    rng = np.random.default_rng(graine)
    H = np.zeros((taille, taille), dtype=np.float32)
    yy, xx = np.mgrid[-7:8, -7:8]
    for _ in range(n):
        cx, cy = rng.uniform(0, taille, 2)
        r = rng.uniform(1.8, 3.2)
        ph, k = rng.uniform(0, 2 * math.pi), rng.integers(1, 3)
        ix, iy = int(cx), int(cy)
        dx, dy = xx - (cx - ix), yy - (cy - iy)
        dist = np.hypot(dx, dy)
        anneau = np.exp(-((dist - r) / 0.75) ** 2) * (0.55 + 0.45 * np.cos(k * np.arctan2(dy, dx) + ph))
        H[(iy + yy) % taille, (ix + xx) % taille] += anneau * rng.uniform(0.5, 1.0)
    H = np.clip(H / np.percentile(H, 99.5), 0.0, 1.0)
    fond = np.array([7, 6, 5], dtype=np.float32) / 255
    clair = np.array([40, 33, 30], dtype=np.float32) / 255
    rgb = fond + (clair - fond) * (H[..., None] ** 1.3)
    img = bpy.data.images.new('Meba_crepu', taille, taille)
    px = np.ones((taille, taille, 4), dtype=np.float32)
    px[..., :3] = rgb
    img.pixels.foreach_set(px.ravel())
    img.pack()
    return img


def poils_crepus(h, piece):
    """La barbe (et la piece sous la levre) et les cheveux passent a une
    matiere a eux, « Meba_crepu » : celle des poils (mate), sa texture
    remplacee par texture_crepue, repetee. Les sourcils et les cils gardent
    celle de Quaternius.

    Les UV sont refaites en PROJECTION SUR TROIS AXES, face par face (sur
    l'axe ou regarde la face) : celles de Quaternius, allongees dans le sens
    de ses meches, etiraient les boucles en taches. Une tuile couvre
    BOUCLE_MM ; les coutures entre faces ne se voient pas dans des boucles."""
    V = h.data.vertices
    me = h.data
    mats = [m.name for m in me.materials]
    ipo = mats.index('Meba_poils')
    mat = me.materials[ipo].copy()
    mat.name = 'Meba_crepu'
    tex = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE')
    tex.image = texture_crepue()
    tex.extension = 'REPEAT'
    me.materials.append(mat)
    icr = len(me.materials) - 1
    il = ilots(h, 'Meba_poils')
    garde = set(min(il, key=lambda vs: min(V[i].co.z for i in vs)))
    garde |= set(max(il, key=lambda vs: max(V[i].co.z for i in vs)))
    npoly = len(me.polygons)
    pieces = set(range(npoly - piece, npoly))
    couches = list(me.uv_layers)
    k = 1000.0 / BOUCLE_MM
    n = 0
    for p in me.polygons:
        if not (p.index in pieces or (p.material_index == ipo and set(p.vertices) <= garde)):
            continue
        p.material_index = icr
        nx, ny, nz = (abs(c) for c in p.normal)
        for li in p.loop_indices:
            co = V[me.loops[li].vertex_index].co
            uv = (co.y, co.z) if nx >= ny and nx >= nz else ((co.x, co.z) if ny >= nz else (co.x, co.y))
            for c in couches:
                c.data[li].uv = (uv[0] * k, uv[1] * k)
        n += 1
    me.update()
    print('crepu :', n, 'faces (barbe, piece sous la levre, cheveux)')


def peindre_levres(h, repos, bout):
    """SES LEVRES, PEINTES dans la texture de la peau (02/10). Sur sa photo
    neutre, la levre du bas est rose clair (208,116,111 pour une joue a
    126,81,61), celle du haut a peine plus rose que la peau (129,80,71) : de la
    couleur de la peau, la bouche ne se lisait pas. Le rapport est pris dans
    l'espace lineaire (adouci a la puissance 0,85) et applique a la texture,
    qui garde son modele ; la fente est soulignee.

    La forme est tracee sur le visage AU REPOS (mm depuis le bout du nez) : la
    fente a -29 (-30,5 aux coins), les coins a 17,8 mm, la levre du bas jusqu'a
    -37,5, celle du haut jusqu'a -21. Peinte sur les UV, elle suit ensuite la
    bouche elargie. La peau et ses levres restent une seule matiere : le jeu
    les eclaircit ensemble (vedette-3d.ts)."""
    import numpy as np
    mats = [m.name for m in h.data.materials]
    ip = mats.index('Meba_peau')
    bsdf = next(n for n in h.data.materials[ip].node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    img = bsdf.inputs['Base Color'].links[0].from_node.image
    W, H = img.size
    px = np.empty(W * H * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(H, W, 4)
    srgb = px[..., :3]
    lin0 = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
    lin = lin0.copy()
    R_BAS = np.array([3.02, 2.12, 3.40]) ** 0.85
    R_HAUT = np.array([1.05, 0.97, 1.35]) ** 0.85
    sm = lambda x: (lambda u: u * u * (3 - 2 * u))(np.clip(x + 0.5, 0.0, 1.0))
    uv = h.data.uv_layers.active.data
    for p in h.data.polygons:
        if p.material_index != ip:
            continue
        c = sum((repos[i] for i in p.vertices), Vector()) / len(p.vertices)
        if abs(c.y) > 0.026 or not (bout.z - 0.045 < c.z < bout.z - 0.015) or c.x < bout.x - 0.035:
            continue
        P3 = np.array([tuple(repos[i]) for i in p.vertices])
        T = np.array([tuple(uv[li].uv) for li in p.loop_indices]) * [W, H]
        # les triangles du polygone (ici, tous des triangles)
        for tri in [(0, k, k + 1) for k in range(1, len(P3) - 1)]:
            t2 = T[list(tri)]; p3 = P3[list(tri)]
            x0, y0 = np.floor(t2.min(0)).astype(int) - 1
            x1, y1 = np.ceil(t2.max(0)).astype(int) + 1
            x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W - 1, x1), min(H - 1, y1)
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            (ax, ay_), (bx, by), (cx, cy) = t2
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay_ - cy)
            if abs(den) < 1e-9:
                continue
            l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / den
            l2 = ((cy - ay_) * (gx - cx) + (ax - cx) * (gy - cy)) / den
            l3 = 1 - l1 - l2
            dedans = (l1 > -0.03) & (l2 > -0.03) & (l3 > -0.03)
            if not dedans.any():
                continue
            yy = np.abs(l1 * p3[0, 1] + l2 * p3[1, 1] + l3 * p3[2, 1]) * 1000
            zz = (l1 * p3[0, 2] + l2 * p3[1, 2] + l3 * p3[2, 2] - bout.z) * 1000
            u = np.minimum(1.0, yy / 17.8)
            fente = -29.0 - 1.5 * u * u
            bas = fente - 8.5 * np.sqrt(np.maximum(0.0, 1 - u ** 4))
            haut = fente + 8.0 * np.sqrt(np.maximum(0.0, 1 - u ** 3)) - 0.8 * np.exp(-(yy / 3.0) ** 2)
            dans = (yy < 17.8)
            mb = sm((fente - zz) / 0.8) * sm((zz - bas) / 0.8) * dans
            mh = sm((zz - fente) / 0.8) * sm((haut - zz) / 0.8) * dans
            trait = np.exp(-((zz - fente) / 0.45) ** 2) * (1 - u ** 6) * dans
            k_ = 1 + mb[..., None] * (R_BAS - 1) + mh[..., None] * (R_HAUT - 1)
            k_ = k_ * (1 - 0.45 * trait[..., None])
            ys_, xs_ = np.nonzero(dedans)
            lin[y0 + ys_, x0 + xs_] = np.clip(lin0[y0 + ys_, x0 + xs_] * k_[ys_, xs_], 0.0, 1.0)
    out = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.clip(lin, 0, 1) ** (1 / 2.4) - 0.055)
    px[..., :3] = out
    img.pixels.foreach_set(px.ravel())
    img.pack()

def cibles(rig, cou=0.74):
    """Les cibles du jeu, le cou raccourci (02/10, « le cou est moins long »,
    puis « remonte legerement le cou » : 0,62 etait trop court) :
    le buste de ce corps, etire jusqu'a la base du cou du jeu, emportait le cou
    avec lui ; la tete descend d'autant."""
    C = M['cibles'](rig)
    a, b = C['neck_01']
    b2 = a + (b - a) * cou
    C['neck_01'] = (a, b2)
    ha, hb = C['head']
    C['head'] = (b2, b2 + (hb - ha))
    return C


def assombrir_iris(mat, rayon=0.115):
    """L'iris, seul, ramene a IRIS : le blanc de l'oeil et la paupiere peinte
    autour ne bougent pas (un disque au centre de la texture)."""
    import numpy as np
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    base = bsdf.inputs['Base Color']
    if not base.is_linked or base.links[0].from_node.type != 'TEX_IMAGE':
        return
    noeud = base.links[0].from_node
    im = noeud.image.copy()
    w, h_ = im.size
    px = np.array(im.pixels[:], dtype=np.float32).reshape(h_, w, 4)
    yy, xx = np.mgrid[0:h_, 0:w]
    d = np.hypot((xx + 0.5) / w - 0.5, (yy + 0.5) / h_ - 0.5)
    dedans = d < rayon
    lin = np.where(px[..., :3] <= 0.04045, px[..., :3] / 12.92, ((px[..., :3] + 0.055) / 1.055) ** 2.4)
    moy = lin[dedans].mean(0)
    voulu = np.array([M['srgb_vers_lin'](c / 255) for c in IRIS], dtype=np.float32)
    # le bord de l'iris se fond sur un dixieme de son rayon
    t = np.clip((rayon - d) / (0.1 * rayon), 0.0, 1.0)[..., None]
    lin = lin * (1 - t) + np.clip(lin * (voulu / np.maximum(moy, 1e-4)), 0, 1) * t
    px[..., :3] = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)
    im.pixels[:] = px.ravel()
    im.name = 'T_Eye_Meba'
    im.pack()
    noeud.image = im


def adoucir_epaules(h, passes=10):
    """Les poids de l'epaule, adoucis avant de rabattre les bras.

    Quaternius passe de la clavicule au bras sur un ou deux rangs : en T, rien
    ne se voit ; bras baisses, le devant du deltoide se pliait sur ce passage
    en une arete nette, de l'aisselle au haut de l'epaule. Lisses sur plusieurs
    rangs (chaque sommet vers la moyenne de ses voisins), les poids repartissent
    la rotation, et le lissage correctif (figer) finit le travail. Seule la
    region des epaules est touchee."""
    import numpy as np
    me = h.data
    n = len(me.vertices)
    os_ = ('clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'spine_03', 'spine_02', 'neck_01')
    idx = {h.vertex_groups[o].index: o for o in os_ if o in h.vertex_groups}
    W = {o: np.zeros(n) for o in idx.values()}
    autres = np.zeros(n)
    for v in me.vertices:
        for g in v.groups:
            if g.group in idx:
                W[idx[g.group]][v.index] = g.weight
            else:
                autres[v.index] += g.weight
    co = np.array([v.co[:] for v in me.vertices])
    zone = (co[:, 2] > 1.10) & (np.abs(co[:, 1]) > 0.05) & (co[:, 2] < 1.45)
    zone &= autres < 0.5          # ni l'avant-bras, ni la tete
    ar = np.array([e.vertices[:] for e in me.edges])
    deg = np.bincount(ar.ravel(), minlength=n).astype(float)
    for _ in range(passes):
        for o in W:
            w = W[o]
            s_ = np.zeros(n)
            np.add.at(s_, ar[:, 0], w[ar[:, 1]]); np.add.at(s_, ar[:, 1], w[ar[:, 0]])
            moy = np.where(deg > 0, s_ / np.maximum(deg, 1), w)
            W[o] = np.where(zone, 0.5 * w + 0.5 * moy, w)
    # la part de ces os reste celle qu'ils avaient (les autres os n'y perdent rien)
    tot = sum(W.values())
    avant = np.zeros(n)
    for v in me.vertices:
        avant[v.index] = sum(g.weight for g in v.groups if g.group in idx)
    k = np.where(tot > 1e-6, avant / np.maximum(tot, 1e-6), 0.0)
    for o, w in W.items():
        g = h.vertex_groups[o]
        wn = w * k
        for i in np.nonzero(zone)[0]:
            if wn[i] > 1e-4:
                g.add([int(i)], float(wn[i]), 'REPLACE')
            else:
                g.remove([int(i)])


def figer(h, rig, herite):
    """Comme meba_maillage.figer, avec un LISSAGE CORRECTIF aux epaules.

    Quaternius pose son corps en T. Rabattre les bras le long du corps (le
    repos du jeu) pliait l'epaule de quatre-vingt-dix degres avec des poids
    faits pour ses gestes : un pli net en travers du deltoide, le bras sorti
    de l'aisselle comme celui d'un mannequin. Le lissage correctif de Blender
    compare la peau pliee a la peau en T et lisse ce qui s'en ecarte, sans
    toucher aux reliefs ; il est cuit avec le pli, en une fois."""
    poids = {g.index: g.name for g in h.vertex_groups}
    zone = h.vertex_groups.new(name='_epaules')
    for v in h.data.vertices:
        w = sum(g.weight for g in v.groups
                if poids[g.group].startswith(('clavicle', 'upperarm')))
        if w > 0.02:
            zone.add([v.index], min(1.0, 1.5 * w), 'REPLACE')
    cs = h.modifiers.new('Correctif', 'CORRECTIVE_SMOOTH')
    cs.rest_source = 'ORCO'; cs.smooth_type = 'LENGTH_WEIGHTED'
    cs.factor = 0.75; cs.iterations = 20; cs.vertex_group = zone.name
    cs.use_only_smooth = False
    bpy.ops.object.select_all(action='DESELECT')
    h.select_set(True); bpy.context.view_layer.objects.active = h
    bpy.ops.object.convert(target='MESH')
    h.vertex_groups.remove(h.vertex_groups['_epaules'])
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    for b in rig.data.bones:
        b.inherit_scale = herite.get(b.name, 'FULL')
    mod = h.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig


# --- LA TENUE : le blanc de l'equipe de France, le short, les pointes --------
# Les memes coques que meba_maillage.habiller (decoupees dans le corps, ses
# poids gardes), reglees au repere du jeu — les deux corps y ont les memes
# jointures.
def tenue(h, rig):
    p = lambda d, *n: max((d.get(k, 0.0) for k in n), default=0.0)
    domh = M['poids_dominant'](h)
    bras = ('upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r')
    doigts = lambda d: any(k.split('_')[0] in ('thumb', 'index', 'middle', 'ring', 'pinky') and w > 0.2
                           for k, w in d.items())
    peau = {i for i, m in enumerate(h.data.materials) if m and m.name == 'Meba_peau'}
    def sur_la_peau(garder):
        return garder

    def maillot(c, n, d):
        ay = abs(c.y)
        # LES BRETELLES PASSENT PAR-DESSUS L'EPAULE (02/10, « le maillot est
        # toujours pas ferme au niveau des epaules ») : sur ce corps, le haut
        # du trapeze monte a 1,407-1,424 m entre 8 et 11 cm du milieu ; coupee
        # a 1,405, chaque bretelle s'arretait net au sommet de l'epaule, son
        # devant sans son dos. Jusqu'a 1,44 dans sa bande, sans monter au cou.
        if 1.405 <= c.z < 1.440 and 0.075 < ay < 0.112:
            return p(d, 'neck_01') < 0.60 and p(d, 'head') < 0.20 and p(d, *bras) < 0.3
        if not (0.942 < c.z < 1.405): return False
        if p(d, *bras) > 0.55 or p(d, 'head') > 0.3: return False
        if c.z > 1.335:
            return 0.058 < ay < 0.112 and p(d, 'neck_01') < 0.65
        if p(d, 'neck_01') > 0.3: return False
        if c.x > 0.0 and c.z > 1.300 and ay < 0.072: return False
        if c.x <= 0.0 and c.z > 1.330 and ay < 0.060: return False
        if ay > 0.150 and c.z > 1.200: return False
        if ay > 0.136 and c.z > 1.280: return False
        return True

    V = h.data.vertices
    entrejambe = min((V[i].co for i, dd in enumerate(domh)
                      if abs(V[i].co.y) < 0.006 and 0.70 < V[i].co.z < 1.0
                      and dd[0] in ('pelvis', 'thigh_l', 'thigh_r')), key=lambda q: q.z)
    def epaisseur_short(co):
        d = co - entrejambe
        devant = max(0.0, min(1.0, (d.x + 0.010) / 0.030))
        devant = devant * devant * (3 - 2 * devant)
        g = math.exp(-((co.y / 0.042) ** 2 + ((d.z - 0.045) / 0.040) ** 2))
        serre = max(0.0, min(1.0, (co.z - 0.645) / 0.060))
        # le slip du corps est modele en relief : sous la ceinture, a 4,5 mm,
        # sa lisiere percait le short
        ceinture = max(0.0, min(1.0, (co.z - 0.880) / 0.030))
        return 0.0040 + 0.0005 * serre + 0.0045 * ceinture + 0.010 * g * devant

    def short(c, n, d):
        if p(d, *bras) > 0.3 or doigts(d): return False
        return 0.645 < c.z < 0.99

    # BLANC, LES BRETELLES BLEUES. Les epaules bleues et le filet rouge sous le
    # bras du corps de MakeHuman tombaient ici en taches sur le haut de la
    # poitrine : seules les bretelles, au-dessus de la poitrine, sont bleues.
    def teinte_france(co):
        if co.z > 1.345 and abs(co.y) > 0.050:
            return M['BLEU_FRANCE']
        return M['MAILLOT']
    # et il passe PAR-DESSUS le short : plus epais que sa ceinture, la ou ils
    # se croisent
    def epaisseur_maillot(co):
        return 0.0068 + 0.0090 * max(0.0, min(1.0, (1.010 - co.z) / 0.040))

    out = [M['chaussure'](h, rig, 1), M['chaussure'](h, rig, -1)]
    # le maillot affine d'une subdivision : ses faces sont grandes, et le bleu
    # des bretelles, le filet rouge s'y etalaient en flou
    out.append(couper_droit(M['coque'](h, rig, 'Meba_maillot', maillot, epaisseur_maillot, M['MAILLOT'], 0.55,
                                       teinte=teinte_france, affiner=1), 0.950))
    out.append(couper_droit(M['coque'](h, rig, 'Meba_short', short, epaisseur_short, M['SHORT'], 0.68,
                                       combler=(40, 0.74, 0.93)), 0.655))
    sortir(bpy.data.objects['Meba_short'], h, ('pelvis', 'thigh_l', 'thigh_r', 'spine_01'), 0.0040)
    sortir(bpy.data.objects['Meba_maillot'], h, ('pelvis', 'spine_01', 'spine_02', 'spine_03',
                                                 'clavicle_l', 'clavicle_r', 'neck_01'), 0.0050)
    print('pieds caches :', M['pieds_caches'](h), 'faces')
    return out


def sortir(o, h, os_, e_min):
    """Aucun sommet d'une coque sous la peau qu'elle couvre.

    Mesure (02/10) : 160 sommets du maillot etaient SOUS la peau, jusqu'a 8,6 mm
    (les bretelles dans les trapezes, d'ou leurs taches), et le short n'avait
    plus que 0,4 mm au cran de la cuisse. Le corps rabattu de la pose en T a des
    plis que la coque, decalee le long de ses propres normales, ne suit pas.
    Chaque sommet trop pres (ou dessous) est repousse le long de la normale de
    la peau la plus proche — celle des os que la piece habille seulement, pour
    que le maillot ne fuie pas la peau du bras."""
    from mathutils.bvhtree import BVHTree
    dom = M['poids_dominant'](h)
    peau = {i for i, m in enumerate(h.data.materials) if m and m.name == 'Meba_peau'}
    polys = [tuple(p.vertices) for p in h.data.polygons
             if p.material_index in peau and dom[p.vertices[0]][0] in os_]
    arbre = BVHTree.FromPolygons([v.co.copy() for v in h.data.vertices], polys)
    n = 0
    for v in o.data.vertices:
        loc, nor, _, d = arbre.find_nearest(v.co, 0.03)
        if loc is None:
            continue
        s_ = (v.co - loc).dot(nor)
        if s_ < e_min:
            v.co = loc + nor * e_min
            n += 1
    o.data.update()
    print('sortir', o.name, ':', n, 'sommets repousses')


def couper_droit(o, z):
    """L'ourlet du bas coupe a l'horizontale. Les faces de ce corps sont
    grandes : decoupe face par face, le bas du short et du maillot faisait des
    dents de scie que le lissage du bord n'effacait pas."""
    import bmesh
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
                           plane_co=(0, 0, z), plane_no=(0, 0, 1), clear_inner=True)
    # et ses fentes refermees : la ou deux bords de la coque se frolent a deux
    # millimetres, ils sont soudes
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.002)
    bm.to_mesh(o.data); bm.free()
    return o


def chaine(h, rig):
    """La chaine en or, au ras du cou, un pendentif sur le sternum.

    Celle de meba_maillage tire ses rayons d'un axe du cou fixe (x = 1,2 cm),
    juste sur celui de MakeHuman ; le cou de ce corps est plus en arriere, son
    devant passe sur cet axe, et la chaine se reduisait au pendentif. L'axe est
    donc lu sur le cou. Et la ou les bretelles du maillot passent au-dessus de
    la peau, c'est sur elles qu'elle se pose."""
    from mathutils.bvhtree import BVHTree
    ip = {i for i, m in enumerate(h.data.materials) if m and m.name == 'Meba_peau'}
    peau = set()
    for poly in h.data.polygons:
        if poly.material_index in ip:
            peau.update(poly.vertices)
    # (plus haut que sur MakeHuman : a 1,392, sur les cotes, ce corps a deja
    # les trapezes, et la chaine tombait sur les epaules)
    Z = rig.data.bones['neck_01'].head_local.z + 0.026
    cou = [h.data.vertices[i].co for i in peau
           if abs(h.data.vertices[i].co.z - Z) < 0.008 and abs(h.data.vertices[i].co.y) < 0.07]
    axe = Vector((sum(q.x for q in cou) / len(cou), 0.0, 0.0))
    surfaces = [BVHTree.FromPolygons([v.co.copy() for v in o.data.vertices],
                                     [tuple(p.vertices) for p in o.data.polygons])
                for o in (h, bpy.data.objects['Meba_maillot'])]
    pts = []
    for k in range(48):
        a = 2 * math.pi * k / 48
        devant = max(0.0, math.cos(a)) ** 2
        z = Z - 0.040 * devant
        dirn = Vector((math.cos(a), math.sin(a), -0.35 * devant)).normalized()
        depart = axe + Vector((0, 0, z))
        hits = [t.ray_cast(depart, dirn) for t in surfaces]
        hp = hits[0]
        if hp[0] is None:
            continue
        q = hp[0] + dirn * 0.0030
        hm = hits[1]
        # le maillot par-dessus, a moins de deux centimetres de la peau
        if hm[0] is not None and hp[3] < hm[3] < hp[3] + 0.020:
            q = hm[0] + dirn * 0.0025
        pts.append(q)
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
    o.data.materials.append(M['materiau']('Meba_or', M['OR'], 0.25, 1.0))
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
    M['attacher'](o, rig, 'spine_03')
    print('chaine :', len(pts), 'points, axe du cou x =', round(axe.x, 3))
    return o


def boucle(h, rig):
    """La boucle d'oreille, au lobe droit : le bas de l'oreille, la ou la tete
    est la plus large a hauteur des yeux (Quaternius n'a pas de groupe
    « oreilles »)."""
    ip = {i for i, m in enumerate(h.data.materials) if m and m.name == 'Meba_peau'}
    vs = set()
    for poly in h.data.polygons:
        if poly.material_index in ip:
            vs.update(poly.vertices)
    tete = [h.data.vertices[i].co for i in vs if h.data.vertices[i].co.z > 1.45]
    ymin = min(q.y for q in tete)
    oreille = [q for q in tete if q.y < ymin + 0.012]
    lobe = min(oreille, key=lambda q: q.z)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.0055, minor_radius=0.0009,
                                     major_segments=32, minor_segments=8,
                                     location=lobe + Vector((0.0, -0.002, -0.005)),
                                     rotation=(math.radians(90), 0, 0))
    o = bpy.context.active_object; o.name = 'Meba_boucle'
    o.data.materials.append(bpy.data.materials.get('Meba_or') or M['materiau']('Meba_or', M['OR'], 0.25, 1.0))
    M['attacher'](o, rig, 'head')
    return o


def alleger(h):
    """Le glTF allege. Voir alleger_textures ; et surtout les attributs : le
    corps de Quaternius porte cinq jeux d'UV et trois couleurs de sommets, que
    l'export ecrivait pour chaque sommet de chaque piece — 1 Mo sur 1,1 (les
    textures n'en faisaient que 68 ko). Seuls restent l'UV des textures et la
    couleur 'Col' (les teintes du maillot)."""
    me = h.data
    garde = me.uv_layers.active_render if hasattr(me.uv_layers, 'active_render') else None
    garde = next((u for u in me.uv_layers if u.active_render), me.uv_layers[0] if me.uv_layers else None)
    for u in [u for u in me.uv_layers if u != garde]:
        me.uv_layers.remove(u)
    for a_ in [a_ for a_ in me.color_attributes if a_.name != 'Col']:
        me.color_attributes.remove(a_)
    alleger_textures(h)


def alleger_textures(h):
    """Le glTF allege (1,6 Mo au premier export) : la couleur de la peau garde
    sa texture de 1024, celle des poils passe a 512, la carte de normales de la
    peau aussi ; la rugosite peinte et les normales des poils et des yeux,
    invisibles a la taille du jeu, sont remplacees par une valeur."""
    for m in h.data.materials:
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf is None:
            continue
        for nom, val in (('Roughness', 0.62), ('Metallic', 0.0)):
            entree = bsdf.inputs[nom]
            if entree.is_linked and m.name in ('Meba_peau',):
                nt.links.remove(entree.links[0]); entree.default_value = val
        nm = bsdf.inputs['Normal']
        if nm.is_linked:
            carte = nm.links[0].from_node
            tex = next((l.from_node for s_ in carte.inputs if s_.is_linked for l in s_.links
                        if l.from_node.type == 'TEX_IMAGE'), None)
            if m.name in ('Meba_peau',) and tex is not None and tex.image is not None:
                if tex.image.size[0] > 512:
                    im = tex.image.copy(); im.scale(512, 512); im.pack(); tex.image = im
            elif carte.type == 'NORMAL_MAP':
                nt.links.remove(nm.links[0])
        # les poils, noirs : leur meche ne se lit pas au-dela de 512
        if m.name == 'Meba_poils':
            base = bsdf.inputs['Base Color']
            if base.is_linked and base.links[0].from_node.type == 'TEX_IMAGE':
                t_ = base.links[0].from_node
                if t_.image.size[0] > 512:
                    im = t_.image.copy(); im.scale(512, 512); im.pack(); t_.image = im


def miroir_des_decors(h):
    """FRANCE et la boucle d'oreille, retournes pour le jeu.

    Le jeu dessine ses coureurs dans une projection isometrique qui est le
    miroir d'une vraie vue de dessus (vedette-3d.ts, la matrice P) : les tubes,
    symetriques, n'en montrent rien, mais sur le maillage FRANCE se lisait a
    l'envers et la boucle passait a l'autre oreille. Le temps de l'export, ces
    decors sont mis en miroir (y -> -y, faces retournees) ; les portraits, rendus
    dans Blender, les gardent a l'endroit."""
    import bmesh
    noms = {'Meba_france', 'Meba_or'}
    idx = {i for i, m in enumerate(h.data.materials) if m and m.name in noms}
    bm = bmesh.new(); bm.from_mesh(h.data)
    faces = [f for f in bm.faces if f.material_index in idx]
    verts = {v for f in faces for v in f.verts}
    for v in verts:
        v.co.y = -v.co.y
    bmesh.ops.reverse_faces(bm, faces=faces)
    bm.to_mesh(h.data); bm.free()
    h.data.update()


def exporter(h, rig, chemin):
    """Comme meba_maillage.exporter, les textures en JPEG (le corps et les poils
    en portent ; en PNG, le fichier triplait)."""
    from mathutils import Matrix
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    h.select_set(True); rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    os.makedirs(os.path.dirname(os.path.abspath(chemin)), exist_ok=True)
    mw = h.matrix_world.copy(); h.parent = rig; h.matrix_world = mw
    alleger(h)
    miroir_des_decors(h)
    bpy.ops.export_scene.gltf(filepath=chemin, export_format='GLB', use_selection=True,
                              use_active_scene=True, export_skins=True, export_animations=False,
                              export_morph=False, export_yup=True, export_apply=False,
                              export_attributes=True, export_def_bones=False,
                              export_image_format='JPEG', export_jpeg_quality=82,
                              export_meshopt_compression_enable=True)
    miroir_des_decors(h)
    return os.path.getsize(chemin)


def tout(glb=None, blend=None):
    sc, h, rig = corps()
    visage(h)
    tenue(h, rig)
    # FRANCE sur la poitrine. Pas de dossard : sur ce buste, sa feuille ne
    # trouvait qu'une face, et son nom flottait en deux lettres
    M['inscription'](bpy.data.objects['Meba_maillot'], rig, "FRANCE", 0.0, 1.150, 0.048,
                     M['BLEU_FRANCE'], 'Meba_france')
    chaine(h, rig)
    boucle(h, rig)
    h = M['reunir'](h, rig)
    if glb:
        print('GLB :', exporter(h, rig, glb), 'octets')
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=blend, copy=True)
    return h, rig


def arguments():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    val = lambda k: a[a.index(k) + 1] if k in a else None
    return {'glb': val('--glb'), 'blend': val('--blend'), 'portraits': val('--portraits')}


if __name__ == '__main__' and bpy.app.background:
    A = arguments()
    h, rig = tout(A['glb'], A['blend'])
    if A['portraits']:
        M['portraits'](rig, A['portraits'])
