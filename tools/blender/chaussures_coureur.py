# -----------------------------------------------------------------------
# SPRINTER — LES POINTES BENBEZI DU COUREUR (27/10/2026).
#
#   Blender -b --factory-startup -P tools/blender/chaussures_coureur.py -- public/modeles/coureur-homme.glb <logo.png> <sortie.glb>
#
# « Les assets du jeu sont pieds nus : cree-leur des chaussures avec la marque Benbezi ; reprends le logo du jeu »
# (l'auteur, 27/10). La zone `pointes` du corps generique (coureur_generique.py) n'etait que le pied coupe et teint :
# ni semelle ni forme de chaussure, on lisait un pied nu. On chausse le corps :
#   - la tige : un volume de chaussure mesure tranche par tranche sur le pied (6 mm d'aisance), fond plat, dessus bombe,
#     pointe fermee, col a 8 cm (matiere Coureur_chaussure, teinte look.shoe par course-3d.ts) ; le pied reste dedans ;
#   - la semelle : une plaque blanche de 12 mm sous le contour du pied, la pointe relevee, la plaque a pointes noire
#     sous l'avant-pied (Coureur_semelle, Coureur_plaque) ;
#   - le logo : le logo du jeu (public/pubs/benbezi-logo-3d.webp, passe en PNG) sur le flanc exterieur de chaque
#     chaussure (Coureur_logo, sa texture gardee par course-3d.ts).
# Semelle, plaque et logo sont lies a 100 % a l'os du pied (foot_l, foot_r). Export : les reglages de coureur_generique.py.
# -----------------------------------------------------------------------
import bpy, bmesh, sys, os, math
from mathutils import Vector

src, logo, out = sys.argv[sys.argv.index('--') + 1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
corps = next(o for o in bpy.data.objects if o.type == 'MESH' and o.name == 'Coureur')
noms = [m.name for m in corps.data.materials]
iP = noms.index('Coureur_pointes')

def matiere(nom, rgb, rugo=0.6, image=None):
    m = bpy.data.materials.new(nom); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rugo
    if image:
        t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(image)
        m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
        m.node_tree.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
        m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    return m

# --- la tige : un vrai volume de chaussure, pas le pied repousse (le premier essai suivait les orteils et la coupe
# dentelee de la cheville : on lisait encore un pied). Par tranche du pied, sa largeur et sa hauteur mesurees, 6 mm de
# plus ; une section a fond plat et dessus bombe ; la pointe fermee et arrondie ; le col a 8 cm a la cheville
chaussure = matiere('Coureur_chaussure', (0.9, 0.2, 0.2), 0.55)
lacets = matiere('Coureur_lacets', (0.95, 0.95, 0.95), 0.6)
talon = matiere('Coureur_talon', (0.1, 0.1, 0.1), 0.5)
sel = set()
for p in corps.data.polygons:
    if p.material_index == iP: sel.update(p.vertices)
tous = [corps.matrix_world @ corps.data.vertices[i].co for i in sel]
tiges, flancs, coques, galbes = [], {}, {}, {}
for os_nom in ('foot_l', 'foot_r'):
    cote = 1 if arm.data.bones[os_nom].head_local.y > 0 else -1
    vs = [v for v in tous if (v.y > 0) == (cote > 0)]
    # LA POINTE DESSINEE (28/10, 5e essai, d'apres les photos de l'auteur : Puma Nitro, adizero, Nike Air Zoom) : une
    # forme de pointe parametree — contour d'une forme de chaussure (talon etroit, avant-pied large a 70 %, bout
    # effile), profil bas (col 5,5 cm, cou-de-pied 6,2, bout a 1,2 cm), bout releve de 1,6 cm — ajustee a la longueur,
    # la largeur et l'axe du pied. Une grille reguliere : talon, lacage et flancs ont des bords nets.
    pied = [v for v in vs if v.z < 0.06]
    px0, px1 = min(v.x for v in pied) - 0.004, max(v.x for v in pied) + 0.008
    PL = px1 - px0
    def centre(u):
        tr = [v.y for v in pied if abs(v.x - (px0 + u * PL)) < 0.02] or [v.y for v in pied]
        return (max(tr) + min(tr)) / 2
    yA, yB = centre(0.15), centre(0.75)
    yc_ = lambda u: yA + (yB - yA) * (u - 0.15) / 0.6
    PW = max(abs(v.y - yc_((v.x - px0) / PL)) for v in pied) + 0.003      # demi-largeur a l'avant-pied
    def demi_larg(u):
        w = 0.66 + 0.34 * math.sin(min(1, u / 0.7) * math.pi / 2)            # le talon etroit, l'avant-pied large
        if u > 0.72: w *= math.sqrt(max(0.0, 1 - ((u - 0.72) / 0.28) ** 2.2))   # le bout effile
        if u < 0.06: w *= 0.75 + 0.25 * math.sqrt(u / 0.06)
        return PW * w
    releve = lambda u: 0.016 * max(0, (u - 0.7) / 0.3) ** 2
    # le dessus du pied mesure (sous la cheville), lisse : la ligne dessinee ne descend jamais sous lui + 3 mm
    haut_pied = []
    for i in range(25):
        x = px0 + i / 24 * PL
        haut_pied.append(max([v.z for v in pied if abs(v.x - x) < 0.012] or [0.0]))
    haut_pied = [max(haut_pied[max(0, i - 2):i + 3]) for i in range(25)]
    def dessus(u):
        if u < 0.22: h = 0.055 + 0.006 * (u / 0.22)                         # le col, le contrefort
        elif u < 0.42: h = 0.061 + 0.003 * (u - 0.22) / 0.2                 # le cou-de-pied
        else: h = 0.064 - (0.064 - 0.014) * ((u - 0.42) / 0.58) ** 1.15     # vers le bout
        hp = haut_pied[min(24, max(0, round(u * 24)))] + 0.003
        # (la languette, au cou-de-pied, monte 9 mm au-dessus du pied : elle couvre la coupe du pied ; devant, ce sont les
        #  orteils qui rentrent dans la forme, plus basse)
        return max(h, hp + 0.006) if 0.2 < u < 0.5 else h
    NU, NV = 30, 20
    bm = bmesh.new(); grille = []
    for i in range(NU):
        u = i / (NU - 1); x = px0 + u * PL
        d, z0, z1 = demi_larg(u), 0.003 + releve(u), dessus(u) + releve(u)
        rang = []
        for jv in range(NV):
            a = math.pi * jv / (NV - 1)                                       # de -y (0) a +y (pi), par le dessus
            ca, sa = -math.cos(a), math.sin(a)
            y = yc_(u) + max(d, 0.002) * math.copysign(abs(ca) ** 0.55, ca)
            z = z0 + (z1 - z0) * sa ** 0.7
            rang.append(bm.verts.new((x, y, z)))
        grille.append(rang)
    MAT = []
    for i in range(NU - 1):
        u = (i + 0.5) / (NU - 1)
        for jv in range(NV - 1):
            f = bm.faces.new((grille[i][jv], grille[i + 1][jv], grille[i + 1][jv + 1], grille[i][jv + 1]))
            milieu = abs((jv + 0.5) / (NV - 1) - 0.5)
            # le lacage : une bande etroite du cou-de-pied aux orteils, en barreaux alternes (les lacets croises)
            lac = 0.34 < u < 0.84 and milieu < 0.075 - 0.035 * max(0, (u - 0.4) / 0.44) and i % 2 == 0
            f.material_index = 1 if lac else 2 if u < 0.2 and milieu > 0.12 else 0
        bm.faces.new((grille[i][NV - 1], grille[i + 1][NV - 1], grille[i + 1][0], grille[i][0]))   # le dessous
    bm.faces.new(list(reversed(grille[0])))
    bm.faces.new(grille[-1])                                                                       # le bout se ferme
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    coques[os_nom] = [v.co.copy() for v in bm.verts]
    me = bpy.data.meshes.new('tige_' + os_nom); bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = True
    o = bpy.data.objects.new('Tige_' + os_nom, me); bpy.context.collection.objects.link(o)
    for m_ in (chaussure, lacets, talon): o.data.materials.append(m_)
    sections = [(px0 + (i / 24) * PL, yc_(i / 24), demi_larg(i / 24), dessus(i / 24) + releve(i / 24)) for i in range(25)]
    galbes[os_nom] = releve
    tiges.append((o, os_nom)); flancs[os_nom] = sections
    # LE PIED SOUS LA POINTE EST RETIRE (il ne peut plus la percer) : les faces du pied dont tous les sommets sont
    # sous le dessus de la chaussure, a cet endroit
    import bmesh as _b
    bmc = _b.new(); bmc.from_mesh(corps.data)
    def dedans(co, marge=-0.004):
        w = corps.matrix_world @ co
        if (w.y > 0) != (cote > 0): return False
        u = (w.x - px0) / PL
        return -0.02 < u < 1.02 and w.z < dessus(min(1, max(0, u))) + releve(min(1, max(0, u))) + marge
    # (devant, les orteils sont d'abord ramenes dans la forme : une pointe comprime le pied)
    formes_ = bmc.verts.layers.shape.values()   # (les physiques : chaque forme recoit le meme deplacement que le repos)
    for v in bmc.verts:
        avant = v.co.copy()
        w = corps.matrix_world @ v.co
        if (w.y > 0) != (cote > 0) or w.z > 0.065: continue
        u = (w.x - px0) / PL
        if not (0.45 < u < 1.05): continue
        uu = min(1, max(0, u))
        w.x = min(w.x, px1 - 0.004)
        w.z = min(w.z, dessus(uu) + releve(uu) - 0.003)
        d = max(demi_larg(uu) - 0.002, 0.001)
        w.y = yc_(uu) + max(-d, min(d, w.y - yc_(uu)))
        v.co = corps.matrix_world.inverted() @ w
        for l in formes_: v[l] += v.co - avant
    # (au talon, seulement les faces entierement dedans — sinon un jour s'ouvre au col ; devant, toute face qui touche)
    devant = lambda f: (corps.matrix_world @ f.calc_center_median()).x > px0 + 0.5 * PL   # (les orteils, ramenes dans la forme)
    morts = [f for f in bmc.faces if f.material_index == iP and
             (any(dedans(v.co, 0.008) for v in f.verts) if devant(f) else all(dedans(v.co) for v in f.verts))]
    _b.ops.delete(bmc, geom=morts, context='FACES')
    bmc.to_mesh(corps.data); bmc.free()

# --- semelle, plaque et logo, par pied
clous = matiere('Coureur_clous', (0.8, 0.8, 0.82), 0.25)
semelle, plaque, mlogo = matiere('Coureur_semelle', (0.95, 0.95, 0.93), 0.5), matiere('Coureur_plaque', (0.06, 0.06, 0.07), 0.4), \
    matiere('Coureur_logo', (1, 1, 1), 0.4, logo)
pieces = list(tiges)
for os_nom in ('foot_l', 'foot_r'):
    cote = 1 if arm.data.bones[os_nom].head_local.y > 0 else -1
    sel = set()
    for p in corps.data.polygons:
        if p.material_index == iP: sel.update(p.vertices)
    vs = [corps.matrix_world @ corps.data.vertices[i].co for i in sel]
    vs = [v for v in vs if (v.y > 0) == (cote > 0)]
    x0, x1 = min(v.x for v in vs) - 0.004, max(v.x for v in vs) + 0.012
    y0, y1 = min(v.y for v in vs) - 0.002, max(v.y for v in vs) + 0.002
    L = x1 - x0
    # la semelle : 5 mm, le contour de la pointe dessinee (1 mm de debord), relevee comme elle
    bm = bmesh.new()
    prof = []
    secs = flancs[os_nom]; x0, x1 = secs[0][0], secs[-1][0]; L = x1 - x0; n = len(secs)
    for i, (x, yc, dm, _) in enumerate(secs):
        u = i / (n - 1)
        dm = max(dm, 0.002) + 0.001
        z = galbes[os_nom](u)
        prof.append((x, yc - dm, yc + dm, z))
    bas, haut = [], []
    for (x, ya, yb, z) in prof:
        # (une pointe de sprint n'a presque pas de semelle : 5 mm, pas d'amorti au talon)
        bas.append((bm.verts.new((x, ya, z - 0.003)), bm.verts.new((x, yb, z - 0.003))))
        haut.append((bm.verts.new((x, ya, z + 0.002)), bm.verts.new((x, yb, z + 0.002))))
    for i in range(n - 1):
        a, b = bas[i], bas[i + 1]; c, d = haut[i], haut[i + 1]
        bm.faces.new((a[0], a[1], b[1], b[0])); bm.faces.new((c[0], d[0], d[1], c[1]))
        bm.faces.new((a[0], b[0], d[0], c[0])); bm.faces.new((a[1], c[1], d[1], b[1]))
    bm.faces.new((bas[0][0], haut[0][0], haut[0][1], bas[0][1])); bm.faces.new((bas[-1][0], bas[-1][1], haut[-1][1], haut[-1][0]))
    me = bpy.data.meshes.new('semelle_' + os_nom); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Semelle_' + os_nom, me); bpy.context.collection.objects.link(o); o.data.materials.append(semelle)
    pieces.append((o, os_nom))
    # la plaque a pointes : sous l'avant-pied, 2 mm sous la semelle
    bm = bmesh.new()
    # LA PLAQUE RIGIDE (les photos : elle couvre tout l'avant-pied, coloree, sept a huit clous) : sous la semelle, de 45 %
    # du pied jusqu'au bout, au contour de la semelle ; huit clous metal de 6 mm, la pointe relevee comme le reste
    zp = lambda x: galbes[os_nom](min(1, max(0, (x - x0) / L))) - 0.0034
    rangs = []
    for i in range(12):
        u = 0.45 + 0.53 * i / 11; x = x0 + 0.003 + u * (L - 0.006)
        j = min(range(n), key=lambda k: abs(prof[k][0] - x)); _, ya_, yb_, _ = prof[j]
        m_ = (ya_ + yb_) / 2; d_ = (yb_ - ya_) / 2 * 0.96
        rangs.append((bm.verts.new((x, m_ - d_, zp(x))), bm.verts.new((x, m_ + d_, zp(x)))))
    for i in range(11):
        a, b = rangs[i], rangs[i + 1]; bm.faces.new((a[1], b[1], b[0], a[0]))
    me = bpy.data.meshes.new('plaque_' + os_nom); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Plaque_' + os_nom, me); bpy.context.collection.objects.link(o); o.data.materials.append(plaque)
    pieces.append((o, os_nom))
    bm = bmesh.new()
    for px, py in ((0.58, -0.22), (0.58, 0.22), (0.70, -0.26), (0.70, 0.26), (0.82, -0.24), (0.82, 0.24), (0.92, -0.15), (0.92, 0.15)):
        cx = x0 + px * L
        j = min(range(n), key=lambda k: abs(prof[k][0] - cx)); _, ya_, yb_, _ = prof[j]
        cy = (ya_ + yb_) / 2 + (yb_ - ya_) * py
        z0 = zp(cx) - 0.0002; r = 0.0022
        base = [bm.verts.new((cx + r * math.cos(a), cy + r * math.sin(a), z0)) for a in (0, 1.05, 2.1, 3.14, 4.2, 5.25)]
        pic = bm.verts.new((cx, cy, z0 - 0.006))
        for i in range(6): bm.faces.new((base[i], base[(i + 1) % 6], pic))
    me = bpy.data.meshes.new('clous_' + os_nom); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Clous_' + os_nom, me); bpy.context.collection.objects.link(o); o.data.materials.append(clous)
    pieces.append((o, os_nom))
    # le logo : 10 cm x 1,3 cm sur le flanc exterieur, a mi-pied — une bande de 16 morceaux qui suit le flanc de la tige
    # (plat, il s'y enfoncait a l'avant : au 4e essai, « BEN » etait cache), a 1,5 mm au-dessus, lu a l'endroit
    lx, lz, xm, zm = 0.085, 0.085 * 162 / 1400 * 1.1, x0 + 0.45 * L, 0.024
    def flanc(x, z):
        # le flanc de la tige a (x, z), 1,5 mm dehors
        tr = [c.y for c in coques[os_nom] if abs(c.x - x) < 0.015 and abs(c.z - zm) < 0.012] or [c.y for c in coques[os_nom]]
        return (max(tr) if cote > 0 else min(tr)) + cote * 0.002
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    N = 16
    bas_, haut_ = [], []
    for i in range(N + 1):
        x = xm - lx / 2 + lx * i / N
        bas_.append(bm.verts.new((x, flanc(x, zm - lz / 2), zm - lz / 2)))
        haut_.append(bm.verts.new((x, flanc(x, zm + lz / 2), zm + lz / 2)))
    for i in range(N):
        quad = [bas_[i], bas_[i + 1], haut_[i + 1], haut_[i]]
        f = bm.faces.new(quad if cote > 0 else list(reversed(quad)))
        for l in f.loops:
            co = l.vert.co
            t = (co.x - (xm - lx / 2)) / lx
            l[uv].uv = (1 - t if cote > 0 else t, (co.z - (zm - lz / 2)) / lz)
    me = bpy.data.meshes.new('logo_' + os_nom); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Logo_' + os_nom, me); bpy.context.collection.objects.link(o); o.data.materials.append(mlogo)
    pieces.append((o, os_nom))

# --- tout ce qui est ajoute suit l'os du pied
for o, os_nom in pieces:
    g = o.vertex_groups.new(name=os_nom); g.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    o.parent = arm
    mod = o.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
print('PIECES', len(pieces))

bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects: o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True,
                          use_active_scene=True, export_skins=True, export_animations=False,
                          export_morph=True, export_yup=True, export_apply=False,
                          export_attributes=False, export_def_bones=False,
                          export_meshopt_compression_enable=True)
print('GLB :', os.path.getsize(out), 'octets')
