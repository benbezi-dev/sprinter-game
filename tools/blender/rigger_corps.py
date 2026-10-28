# -----------------------------------------------------------------------
# SPRINTER — poser un squelette sur un corps qui n'en a pas.
#
#   blender -b <source.blend> -P tools/blender/rigger_corps.py -- \
#       --objet GEO-body_male_realistic --sortie <corps-rigge.blend> \
#       [--niveau 3] [--controle dossier/]
#
# mesurer_maillage.py lit un corps par ses os : il baisse les bras dans le
# rig, puis decoupe la peau selon l'os qui pese le plus sur chaque sommet.
# Un maillage sculpte sans squelette (les Human Base Meshes de Blender
# Studio, CC0) ne s'y mesure donc pas tel quel. Ce script lui en pose un,
# aux noms du Quaternius (et de l'UE) que mesurer_maillage.py connait :
# pelvis, spine_01..03, neck_01, Head, clavicle/upperarm/lowerarm/hand,
# thigh/calf/foot, en _l et _r.
#
# OU VONT LES ARTICULATIONS. Rien n'est place a la main :
#   - les membres suivent l'axe releve sur le corps lui-meme — le centre de
#     chaque coupe horizontale d'un bras ou d'une jambe, la ou il est separe
#     du reste ;
#   - leurs articulations se placent sur cet axe aux proportions de Drillis
#     et Contini (hanche 0,530 H, genou 0,285 H, cheville 0,039 H ; bras,
#     avant-bras et main dans le rapport 0,186 / 0,146 / 0,108, rapportes a
#     la longueur de bras mesuree jusqu'au bout des doigts) ;
#   - le tronc, le cou et la tete aux hauteurs du rig Quaternius (epaule
#     0,805 H, cou 0,841 H, base du crane 0,884 H), au milieu de la coupe.
# Une articulation fausse de deux centimetres deplace la ou se lit un
# profil, pas son epaisseur : c'est la marge qu'on accepte.
#
# LES POIDS. La diffusion de chaleur de Blender (« poids automatiques »)
# sur le maillage de base, fermé et en quads — elle echoue sur des
# centaines de milliers de sommets —, puis recopiee sur la version detaillee
# (multires applique au niveau demande) par le modificateur de transfert de
# donnees, face la plus proche, interpolee.
# -----------------------------------------------------------------------

import bpy
import sys
import os
from mathutils import Vector


def arg(args, nom, defaut=None):
    return args[args.index(nom) + 1] if nom in args else defaut


def grappes(xs, ecart):
    """Des valeurs triees, regroupees la ou elles se touchent."""
    g = []
    for x in xs:
        if g and x[0] - g[-1][-1][0] <= ecart:
            g[-1].append(x)
        else:
            g.append([x])
    return g


def centre(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return ((min(xs) + max(xs)) * 0.5, (min(ys) + max(ys)) * 0.5)


def coupe(P, z, ep=0.003):
    return [p for p in P if abs(p[2] - z) < ep]


# Deux grappes d'une coupe sont distinctes au-dela de 3 cm d'ecart en x.
# Plus serre, une coupe de cuisse se fragmente la ou ses sommets sont
# clairsemes, et l'axe saute d'un morceau a l'autre.
ECART_GRAPPES = 0.03


def axe_membre(P, z0, z1, pas, garder, separe):
    """Le centre des coupes d'un membre gauche (x > 0), de z0 a z1.

    Une coupe regroupe ses sommets la ou ils se touchent et retient la
    grappe choisie par `garder`. `separe` : seulement si la coupe en compte
    deux au moins — un bras n'a d'axe a lui que sous l'aisselle."""
    axe = []
    z = z0
    while z <= z1:
        c = sorted((p[0], p[1]) for p in coupe(P, z, 0.004) if p[0] > 0.0)
        g = grappes(c, ECART_GRAPPES)
        if g and (len(g) >= 2 or not separe):
            axe.append((z,) + centre(garder(g)))
        z += pas
    return axe


def droite(axe, za, zb):
    """x(z) et y(z) par moindres carres sur une portion d'axe."""
    pts = [a for a in axe if za <= a[0] <= zb]
    n = len(pts)
    if n < 3:
        raise SystemExit('axe trop court entre %.3f et %.3f (%d coupes)' % (za, zb, n))
    mz = sum(a[0] for a in pts) / n
    def ajuste(k):
        m = sum(a[k] for a in pts) / n
        num = sum((a[0] - mz) * (a[k] - m) for a in pts)
        den = sum((a[0] - mz) ** 2 for a in pts)
        b = num / den
        return lambda z: m + b * (z - mz)
    fx, fy = ajuste(1), ajuste(2)
    return lambda z: Vector((fx(z), fy(z), z))


def le_long(polyligne, longueur):
    """Le point d'une polyligne a une longueur donnee depuis son debut."""
    fait = 0.0
    for a, b in zip(polyligne, polyligne[1:]):
        d = (b - a).length
        if fait + d >= longueur:
            return a.lerp(b, (longueur - fait) / d)
        fait += d
    return polyligne[-1]


def articulations(P):
    """Les jointures du cote gauche (+x), dans le repere du corps centre."""
    H = max(p[2] for p in P)
    J = {'H': H}

    # --- jambe ---------------------------------------------------------
    # l'entrejambe : la plus haute coupe ou les deux jambes sont separees
    entre = 0.0
    z = 0.30 * H
    while z < 0.60 * H:
        c = sorted((p[0], p[1]) for p in coupe(P, z) if abs(p[0]) < 0.06)
        if not c or min(abs(x) for x, _ in c) > 0.012:
            entre = z
        z += 0.004
    jambe = axe_membre(P, 0.02, entre - 0.01, 0.006,
                       lambda g: min(g, key=lambda gg: abs(centre(gg)[0] - 0.09)), False)
    cuisse = droite(jambe, entre - 0.25, entre - 0.03)
    # le bas du tibia : au-dessous, la coupe prend le talon et le cou-de-pied
    tibia = droite(jambe, 0.10, 0.30)
    J['hanche'] = cuisse(0.530 * H)
    # Le genou au centre de sa coupe : prolonger les droites de la cuisse
    # et du tibia le mettait 2 cm trop en arriere (le mollet tire l'axe du
    # tibia vers l'arriere), et la cuisse se mesurait decentree d'autant.
    zg = 0.285 * H
    a, b = max((a for a in jambe if a[0] <= zg), key=lambda a: a[0]), \
        min((a for a in jambe if a[0] >= zg), key=lambda a: a[0])
    t = (zg - a[0]) / (b[0] - a[0]) if b[0] > a[0] else 0.0
    J['genou'] = Vector((a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, zg))
    J['cheville'] = tibia(0.039 * H)
    pied = [p for p in P if p[2] < 0.04 and p[0] > 0.0]
    bout = min(pied, key=lambda p: p[1])
    J['orteils'] = Vector((J['cheville'].x, bout[1], 0.02))
    J['entrejambe'] = entre

    # --- bras ----------------------------------------------------------
    # La grappe la plus a l'exterieur de chaque coupe, tant qu'elle est
    # separee du flanc, en descendant depuis l'aisselle. Sous le bout des
    # doigts, la grappe la plus a l'exterieur devient la cuisse : l'axe
    # s'arrete au premier saut.
    tout = axe_membre(P, 0.40 * H, 0.80 * H, 0.004,
                      lambda g: max(g, key=lambda gg: gg[-1][0]), True)
    tout.sort(key=lambda a: -a[0])
    bras = [tout[0]]
    for a in tout[1:]:
        if abs(a[1] - bras[-1][1]) > 0.05 or bras[-1][0] - a[0] > 0.02:
            break
        bras.append(a)
    aisselle = bras[0][0]
    bas = bras[-1]
    main = [p for p in P if abs(p[2] - (bas[0] - 0.02)) < 0.03 and p[0] > bas[1] - 0.08]
    J['doigts'] = Vector(min(main, key=lambda p: p[2]))
    # L'epaule : a la hauteur du rig Quaternius (0,805 H), 4,5 cm en dedans
    # du galbe du deltoide. Prolonger la ligne du bras jusque-la la mettait
    # 7 cm en dedans : le deltoide bombe, l'axe du bras n'est pas droit.
    ze = 0.805 * H
    galbe = [p for p in coupe(P, ze, 0.004) if p[0] > 0.0]
    xe = max(p[0] for p in galbe) - 0.045
    ye = centre([p for p in galbe if p[0] > xe - 0.02])[1]
    J['epaule'] = Vector((xe, ye, ze))
    poly = ([J['epaule']] +
            [Vector((a[1], a[2], a[0])) for a in bras] +
            [J['doigts']])
    L = sum((b - a).length for a, b in zip(poly, poly[1:]))
    J['coude'] = le_long(poly, L * 0.186 / 0.440)
    J['poignet'] = le_long(poly, L * (0.186 + 0.146) / 0.440)
    J['aisselle'] = aisselle
    J['bras_long'] = L

    # --- tronc ---------------------------------------------------------
    def milieu(z):
        c = [p for p in coupe(P, z, 0.004) if abs(p[0]) < 0.05]
        ys = [p[1] for p in c]
        return Vector((0.0, (min(ys) + max(ys)) * 0.5, z))
    for nom, k in (('bassin', 0.530), ('lombaire', 0.590), ('dos', 0.650),
                   ('thorax', 0.730), ('cou', 0.841), ('crane', 0.884)):
        J[nom] = milieu(k * H)
    J['sommet'] = Vector((0.0, J['crane'].y, H))
    J['sternum'] = milieu(0.805 * H)
    return J


def armature(J):
    arm_data = bpy.data.armatures.new('Squelette')
    arm = bpy.data.objects.new('Armature', arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    def os_(nom, tete, queue, parent=None):
        b = eb.new(nom)
        b.head, b.tail = tete, queue
        if parent:
            b.parent = eb[parent]
        return b

    os_('pelvis', J['bassin'], J['lombaire'])
    os_('spine_01', J['lombaire'], J['dos'], 'pelvis')
    os_('spine_02', J['dos'], J['thorax'], 'spine_01')
    os_('spine_03', J['thorax'], J['cou'], 'spine_02')
    os_('neck_01', J['cou'], J['crane'], 'spine_03')
    os_('Head', J['crane'], J['sommet'], 'neck_01')
    for cote, s in (('l', 1.0), ('r', -1.0)):
        m = lambda v: Vector((v.x * s, v.y, v.z))
        cl = Vector((0.02 * s, J['sternum'].y, J['sternum'].z))
        os_('clavicle_' + cote, cl, m(J['epaule']), 'spine_03')
        os_('upperarm_' + cote, m(J['epaule']), m(J['coude']), 'clavicle_' + cote)
        os_('lowerarm_' + cote, m(J['coude']), m(J['poignet']), 'upperarm_' + cote)
        os_('hand_' + cote, m(J['poignet']), m(J['doigts']), 'lowerarm_' + cote)
        os_('thigh_' + cote, m(J['hanche']), m(J['genou']), 'pelvis')
        os_('calf_' + cote, m(J['genou']), m(J['cheville']), 'thigh_' + cote)
        os_('foot_' + cote, m(J['cheville']), m(J['orteils']), 'calf_' + cote)
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    nom = arg(args, '--objet', 'GEO-body_male_realistic')
    sortie = arg(args, '--sortie')
    niveau = int(arg(args, '--niveau', 3))
    if not sortie:
        raise SystemExit('--sortie manquant')

    corps = bpy.data.objects[nom]
    # Le seul corps, centre en x, pieds au sol : le reste du paquet part.
    scene = bpy.context.scene
    if corps.name not in scene.collection.objects:
        scene.collection.objects.link(corps)
    for o in list(bpy.data.objects):
        if o is not corps:
            bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    corps.matrix_world.translation.x = 0.0
    bpy.context.view_layer.update()
    me = corps.data
    me.transform(corps.matrix_world)
    corps.matrix_world.identity()
    dx = sum(v.co.x for v in me.vertices) / len(me.vertices)
    for v in me.vertices:
        v.co.x -= dx

    mr = next(m for m in corps.modifiers if m.type == 'MULTIRES')

    # Les reperes se prennent sur la surface detaillee (niveau 2, assez
    # dense pour qu'une coupe de 6 mm y trouve sa peau).
    mr.levels = min(2, mr.total_levels)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = corps.evaluated_get(dg)
    tmp = ev.to_mesh()
    P = [tuple(v.co) for v in tmp.vertices]
    ev.to_mesh_clear()
    J = articulations(P)
    for k, v in J.items():
        print('  %-11s %s' % (k, tuple(round(c, 3) for c in v) if isinstance(v, Vector) else round(v, 3)))

    # Le detail : une copie, multires applique au niveau demande.
    detail = corps.copy()
    detail.data = corps.data.copy()
    corps.name = nom + '_cage'
    detail.name = nom
    bpy.context.collection.objects.link(detail)
    bpy.context.view_layer.objects.active = detail
    for o in bpy.context.view_layer.objects:
        o.select_set(o is detail)
    md = next(m for m in detail.modifiers if m.type == 'MULTIRES')
    md.levels = niveau
    bpy.ops.object.modifier_apply(modifier=md.name)

    # La cage : niveau 0, poids par diffusion de chaleur.
    corps.modifiers.remove(mr)
    arm = armature(J)
    for o in bpy.context.view_layer.objects:
        o.select_set(o in (corps, arm))
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    noms = {g.index: g.name for g in corps.vertex_groups}
    compte = {}
    for v in corps.data.vertices:
        if v.groups:
            g = noms[max(v.groups, key=lambda e: e.weight).group]
            compte[g] = compte.get(g, 0) + 1
    print('  sommets de la cage par os dominant : ' + ', '.join(
        '%s %d' % (g, compte.get(g, 0)) for g in noms.values()))

    # Les poids de la cage sur le detail.
    for g in corps.vertex_groups:
        detail.vertex_groups.new(name=g.name)
    dt = detail.modifiers.new('poids', 'DATA_TRANSFER')
    dt.object = corps
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = detail
    for o in bpy.context.view_layer.objects:
        o.select_set(o is detail)
    bpy.ops.object.modifier_apply(modifier=dt.name)
    am = detail.modifiers.new('Armature', 'ARMATURE')
    am.object = arm
    detail.parent = arm
    bpy.data.objects.remove(corps, do_unlink=True)

    n = len(detail.data.vertices)
    sans = sum(1 for v in detail.data.vertices if not any(e.weight > 0.0 for e in v.groups))
    print('  detail : %d sommets, %d faces, %d sans poids' % (
        n, len(detail.data.polygons), sans))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(sortie))
    print('ecrit : %s' % sortie)


if __name__ == '__main__':
    main()
