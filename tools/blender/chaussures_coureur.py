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
sel = set()
for p in corps.data.polygons:
    if p.material_index == iP: sel.update(p.vertices)
tous = [corps.matrix_world @ corps.data.vertices[i].co for i in sel]
tiges, flancs = [], {}
for os_nom in ('foot_l', 'foot_r'):
    cote = 1 if arm.data.bones[os_nom].head_local.y > 0 else -1
    vs = [v for v in tous if (v.y > 0) == (cote > 0)]
    x0, x1 = min(v.x for v in vs) - 0.006, max(v.x for v in vs) + 0.016
    NU, NV = 26, 18
    # les mesures brutes par tranche (fenetre de 2,5 cm), puis le plus grand des voisins et une moyenne glissante :
    # la tige est lisse et couvre les orteils (au second essai, elle suivait les bosses du pied)
    brut = []
    for i in range(NU):
        u = i / (NU - 1); x = x0 + u * (x1 - x0)
        tr = [v for v in vs if abs(v.x - x) < 0.025] or vs
        yc = sum(v.y for v in tr) / len(tr)
        brut.append([x, yc, max(abs(v.y - yc) for v in tr), max(v.z for v in tr)])
    def lisser(k, maxi):
        col = [b[k] for b in brut]
        if maxi: col = [max(col[max(0, i - 2):i + 3]) for i in range(NU)]
        col = [sum(col[max(0, i - 3):i + 4]) / len(col[max(0, i - 3):i + 4]) for i in range(NU)]
        for i in range(NU): brut[i][k] = col[i]
    lisser(1, False); lisser(2, True); lisser(3, True)
    sections = []
    for i, (x, yc, dm, h) in enumerate(brut):
        u = i / (NU - 1)
        # (une pointe de sprint est fine : 4 mm d'aisance en largeur, 6 en hauteur, le col a 7 cm — au 3e essai, +8/+9 mm
        # faisaient un sabot)
        dm += 0.004; h = min(h + 0.006, 0.07)
        # la pointe se referme, le talon s'arrondit
        k = 1.0
        if u > 0.86: k = math.sqrt(max(0.02, 1 - ((u - 0.86) / 0.14) ** 2))
        if u < 0.08: k = 0.7 + 0.3 * math.sqrt(u / 0.08)
        if u > 0.86: h = 0.014 + (h - 0.014) * k
        sections.append((x, yc, dm * k, h))
    bm = bmesh.new(); rangs = []
    for (x, yc, dm, h) in sections:
        r = []
        for j in range(NV):
            a = math.pi * j / (NV - 1)                       # de -y (0) a +y (pi), par le dessus
            ca, sa = -math.cos(a), math.sin(a)
            y = yc + dm * math.copysign(abs(ca) ** 0.7, ca)
            z = 0.004 + (h - 0.004) * sa ** 0.8
            r.append(bm.verts.new((x, y, z)))
        rangs.append(r)
    for i in range(NU - 1):
        for j in range(NV - 1):
            bm.faces.new((rangs[i][j], rangs[i + 1][j], rangs[i + 1][j + 1], rangs[i][j + 1]))
        bm.faces.new((rangs[i][NV - 1], rangs[i + 1][NV - 1], rangs[i + 1][0], rangs[i][0]))   # le dessous
    bm.faces.new(list(reversed(rangs[0]))); bm.faces.new(rangs[-1])                           # talon et pointe
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('tige_' + os_nom); bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = True
    o = bpy.data.objects.new('Tige_' + os_nom, me); bpy.context.collection.objects.link(o); o.data.materials.append(chaussure)
    tiges.append((o, os_nom)); flancs[os_nom] = sections

# --- semelle, plaque et logo, par pied
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
    x0, x1 = min(v.x for v in vs) - 0.008, max(v.x for v in vs) + 0.01
    y0, y1 = min(v.y for v in vs) - 0.007, max(v.y for v in vs) + 0.007
    L = x1 - x0
    # la semelle : 12 mm, un contour de pied (talon arrondi, avant-pied plus large), la pointe relevee de 1 cm
    bm = bmesh.new()
    prof = []
    n = 24
    for i in range(n):
        u = i / (n - 1)
        x = x0 + u * L
        larg = (0.78 + 0.22 * math.sin(min(1, u * 1.4) * math.pi / 2)) * (1 - 0.55 * max(0, (u - 0.85) / 0.15) ** 2)
        if u < 0.12: larg *= 0.75 + 0.25 * math.sin(u / 0.12 * math.pi / 2)
        yc, dm = (y0 + y1) / 2 + cote * 0.004 * u, (y1 - y0) / 2 * larg
        z = 0.01 * max(0, (u - 0.8) / 0.2) ** 2
        prof.append((x, yc - dm, yc + dm, z))
    bas, haut = [], []
    for (x, ya, yb, z) in prof:
        bas.append((bm.verts.new((x, ya, z - 0.008)), bm.verts.new((x, yb, z - 0.008))))
        haut.append((bm.verts.new((x, ya, z + 0.006)), bm.verts.new((x, yb, z + 0.006))))
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
    xa, xb = x0 + 0.55 * L, x0 + 0.95 * L
    ya, yb = (y0 + y1) / 2 - (y1 - y0) * 0.38, (y0 + y1) / 2 + (y1 - y0) * 0.38
    vv = [bm.verts.new(p) for p in ((xa, ya, -0.0085), (xb, ya, -0.0085), (xb, yb, -0.0085), (xa, yb, -0.0085))]
    bm.faces.new((vv[3], vv[2], vv[1], vv[0]))
    me = bpy.data.meshes.new('plaque_' + os_nom); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Plaque_' + os_nom, me); bpy.context.collection.objects.link(o); o.data.materials.append(plaque)
    pieces.append((o, os_nom))
    # le logo : 10 cm x 1,3 cm sur le flanc exterieur, a mi-pied — une bande de 16 morceaux qui suit le flanc de la tige
    # (plat, il s'y enfoncait a l'avant : au 4e essai, « BEN » etait cache), a 1,5 mm au-dessus, lu a l'endroit
    lx, lz, xm, zm = 0.1, 0.1 * 162 / 1400 * 1.1, x0 + 0.48 * L, 0.03
    def flanc(x, z):
        q = min(flancs[os_nom], key=lambda q: abs(q[0] - x))
        _, yc_, dm_, h_ = q
        sa = min(1, max(0, (z - 0.004) / (h_ - 0.004))) ** (1 / 0.8)
        return yc_ + cote * dm_ * math.cos(math.asin(sa)) ** 0.7 + cote * 0.0015
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
                          export_morph=False, export_yup=True, export_apply=False,
                          export_attributes=False, export_def_bones=False,
                          export_meshopt_compression_enable=True)
print('GLB :', os.path.getsize(out), 'octets')
