# -----------------------------------------------------------------------
# SPRINTER — LE COUREUR REALISTE ET SES VRAIS VETEMENTS (28/10/2026).
#
#   Blender -b --factory-startup -P tools/blender/coureur_realiste.py -- \
#       --source <corps-realiste-T.glb (corps_realiste_T.py)> --taille 1.78 --glb public/modeles/coureur-homme.glb
#
# L'auteur, 28/10 : « il faut des vrais vetements de sport pour les assets, des vetements qui bougent lorsque la
# vitesse est importante, et des assets mieux travailles ». Le corps passe par la chaine du coureur generique
# (coureur_generique.py : squelette du jeu, poids, calage, zones teintes) ; on l'HABILLE ensuite de pieces a part,
# dans le meme maillage (une matiere chacune : course-3d.ts les montre ou les cache selon la tenue du coureur) :
#   - le debardeur (Coureur_debardeur) : le tronc du maillot, decolle de 6 mm, un ourlet libre de 5 cm en dessous ;
#   - le short fendu (Coureur_shortlarge) : decolle de 10 mm, les jambes evasees de 3,5 cm ;
#   - le dossard (Coureur_dossard), devant et dans le dos, epingle par le haut.
# Le bas de ces pieces pend a des OS DE TISSU (tissu_avant, tissu_dos, tissu_short_l/r, tissu_dossard,
# tissu_dossard_dos) que le jeu fait flotter avec la vitesse (course-3d.ts, LE TISSU). Sous les pieces, le corps
# garde ses zones teintes de la meme couleur : un genou qui traverse le short ne montre pas la peau.
# -----------------------------------------------------------------------
import bpy, bmesh, os, runpy, sys
from mathutils import Vector

ICI = os.path.dirname(os.path.abspath(__file__))
GEN = runpy.run_path(os.path.join(ICI, 'coureur_generique.py'), run_name='coureur_generique')
V, M, CARTOON, G = GEN['V'], GEN['M'], GEN['CARTOON'], GEN['G']
ZONE_GENERIQUE = GEN['zone_de_la_face']
_MIROIR = V['miroir']
V['miroir'] = lambda h: (_MIROIR(h), formes(h))   # les physiques, apres le miroir

PIECES = ['debardeur', 'shortlarge', 'brassiere', 'dossard']


def zone_du_debardeur(nom_os, c, H):
    """LE DEBARDEUR DE SPRINT : encolure en U (plus creusee devant), bretelles de 5 cm, emmanchures larges
    descendant sous l'aisselle. Le reste comme coureur_generique.zone_de_la_face."""
    z, y = c.z, abs(c.y)
    if z > H['ceinture'] and not nom_os.startswith(GEN['BRAS']) and not nom_os.startswith(('neck', 'head', 'Head', 'foot', 'ball')):
        u = min(1.0, y / H['col'])
        creux = (0.11 if c.x > 0 else 0.05) * (1 - u * u)          # le U : plus bas au milieu
        if y < H['col'] and z > H['cou'] - creux:
            return 'peau'
        if y > H['bretelle'] - 0.012 and z > H['aisselle'] - 0.03 * (1 if c.x > 0 else 0.5):
            return 'peau'
    return ZONE_GENERIQUE(nom_os, c, H)


def hauteurs(rig):
    b = rig.data.bones
    genou, hanche = b['calf_l'].head_local.z, b['thigh_l'].head_local.z
    return {'ceinture': hanche + 0.07, 'cuisse': genou + 0.17, 'aisselle': b['upperarm_l'].head_local.z - 0.07,
            'hanche_y': abs(b['thigh_l'].head_local.y)}


def os_de_tissu(rig, h, H):
    """Les os de tissu, enfants des os du corps, pointant vers le bas (le jeu les balance autour de leur axe x)."""
    devant = lambda z: max((v.co.x for v in h.data.vertices if abs(v.co.y) < 0.03 and abs(v.co.z - z) < 0.015), default=0.1)
    derriere = lambda z: min((v.co.x for v in h.data.vertices if abs(v.co.y) < 0.03 and abs(v.co.z - z) < 0.015), default=-0.1)
    zc, zd = H['ceinture'], H['aisselle'] - 0.10
    OS = {  # nom : parent, tete, longueur
        'tissu_avant': ('spine_01', Vector((devant(zc + 0.06) + 0.008, 0, zc + 0.06)), 0.11),
        'tissu_dos': ('spine_01', Vector((derriere(zc + 0.06) - 0.008, 0, zc + 0.06)), 0.11),
        'tissu_short_l': ('thigh_l', Vector((0, H['hanche_y'] + 0.02, H['cuisse'] + 0.10)), 0.12),
        'tissu_short_r': ('thigh_r', Vector((0, -H['hanche_y'] - 0.02, H['cuisse'] + 0.10)), 0.12),
        'tissu_dossard': ('spine_03', Vector((devant(zd) + 0.014, 0, zd + 0.08)), 0.16),
        'tissu_dossard_dos': ('spine_03', Vector((derriere(zd) - 0.014, 0, zd + 0.08)), 0.16),
    }
    bpy.context.view_layer.objects.active = rig
    for o in bpy.data.objects: o.select_set(o is rig)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    for nom, (parent, tete, lg) in OS.items():
        e = eb.new(nom); e.head = tete; e.tail = tete + Vector((0, 0, -lg)); e.parent = eb[parent]; e.use_deform = True
    bpy.ops.object.mode_set(mode='OBJECT')
    for nom in OS:
        if nom not in h.vertex_groups: h.vertex_groups.new(name=nom)
    return OS


def matiere(h, nom):
    m = bpy.data.materials.new('Coureur_' + nom); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); b.inputs['Roughness'].default_value = 0.7
    h.data.materials.append(m)
    return len(h.data.materials) - 1


def peser(bm, verts, defl, groupes, nom, w):
    """Donne au sommet le poids `w` vers l'os `nom`, les autres poids reduits d'autant."""
    gi = groupes[nom]
    for v, k in zip(verts, w):
        if k <= 0: continue
        d = v[defl]
        for g in list(d.keys()): d[g] *= (1 - k)
        d[gi] = d.get(gi, 0) + k


def piece(bm, defl, faces, idx, decal, ourlet, evase, cote_bas):
    """Double `faces` en une piece decollee de `decal` m, matiere `idx`, puis prolonge son bord bas
    (sommets du bord sous `cote_bas`) de `ourlet` m vers le bas, evase de `evase` m vers l'exterieur."""
    dup = bmesh.ops.duplicate(bm, geom=faces)
    nf = [g for g in dup['geom'] if isinstance(g, bmesh.types.BMFace)]
    nv = list({v for f in nf for v in f.verts})
    bm.normal_update()
    for f in nf: f.material_index = idx
    normales = {v: v.normal.copy() for v in nv}
    for v in nv: v.co += normales[v] * decal
    # LES BORDS NETS : la zone suit les faces du maillage reduit, le bord de la piece sortait en dents de scie
    # (encolure, emmanchures) ; on le lisse le long de lui-meme, ses voisins avec lui
    haut = {v for e in {e for f in nf for e in f.edges} if e.is_boundary for v in e.verts if v.co.z >= cote_bas}
    for _ in range(12):
        nouv = {}
        for v in haut:
            vb = [e.other_vert(v) for e in v.link_edges if e.is_boundary and e.other_vert(v) in haut]
            if len(vb) == 2: nouv[v] = v.co * 0.4 + (vb[0].co + vb[1].co) * 0.3
        for v, c in nouv.items(): v.co = c
    bord = [e for e in {e for f in nf for e in f.edges} if e.is_boundary and all(v.co.z < cote_bas for v in e.verts)]
    if not bord or ourlet <= 0:
        return nf, nv, []
    ext = bmesh.ops.extrude_edge_only(bm, edges=bord)
    bas = [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]
    for v in bas:
        n = normales.get(v, Vector((0, 0, 0)))
        horiz = Vector((n.x, n.y, 0)).normalized() if n.length > 0 else Vector((0, 0, 0))
        v.co += Vector((0, 0, -ourlet)) + horiz * evase
    for f in [g for g in ext['geom'] if isinstance(g, bmesh.types.BMFace)]: f.material_index = idx
    return nf, nv, bas


def draper(bm, verts, profil, axe, z_haut, marge, secteurs=48, tombe=0.6, lisser=14):
    """LE TISSU TOMBE : sous `z_haut`, un sommet de la piece est repousse au plus large du corps entre sa hauteur
    et `z_haut`, dans sa direction (autour de l'axe `axe(z)` -> (x, y)) : un debardeur pend de la poitrine au lieu
    d'epouser le ventre, une jambe de short tombe de la fesse. `profil` : les sommets du corps sous la piece."""
    import math
    tranche = 0.01
    R = {}
    for v in profil:
        cx, cy = axe(v.co.z)
        dx, dy = v.co.x - cx, v.co.y - cy
        k = (int(v.co.z / tranche), int((math.atan2(dy, dx) + math.pi) / (2 * math.pi) * secteurs) % secteurs)
        R[k] = max(R.get(k, 0), math.hypot(dx, dy))
    for v in verts:
        if v.co.z >= z_haut: continue
        cx, cy = axe(v.co.z)
        dx, dy = v.co.x - cx, v.co.y - cy
        r = math.hypot(dx, dy)
        if r < 1e-6: continue
        s = int((math.atan2(dy, dx) + math.pi) / (2 * math.pi) * secteurs) % secteurs
        haut = max((R.get((zi, s2), 0) for zi in range(int(v.co.z / tranche), int(z_haut / tranche) + 1)
                    for s2 in (s - 1, s, (s + 1) % secteurs)), default=0)
        ici = max((R.get((int(v.co.z / tranche), s2), 0) for s2 in (s - 1, s, (s + 1) % secteurs)), default=0)
        voulu = ici + (haut - ici) * tombe + marge      # (tombe : 0 colle, 1 tombe droit de la poitrine)
        if voulu > r:
            k = voulu / r
            v.co.x, v.co.y = cx + dx * k, cy + dy * k
    # LISSE : la chute calculee par tranches et secteurs sortait en escalier ; on lisse a plat (x, y),
    # puis on repousse hors du corps ce que le lissage a fait rentrer
    libres = [v for v in verts if v.co.z < z_haut]
    for _ in range(lisser):
        bmesh.ops.smooth_vert(bm, verts=libres, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=False)
    for v in libres:
        cx, cy = axe(v.co.z)
        dx, dy = v.co.x - cx, v.co.y - cy
        r = math.hypot(dx, dy)
        if r < 1e-6: continue
        s = int((math.atan2(dy, dx) + math.pi) / (2 * math.pi) * secteurs) % secteurs
        ici = max((R.get((int(v.co.z / tranche), s2), 0) for s2 in (s - 1, s, (s + 1) % secteurs)), default=0)
        if ici + marge * 0.6 > r:
            k = (ici + marge * 0.6) / r
            v.co.x, v.co.y = cx + dx * k, cy + dy * k


def axe_du_tronc(bm, idx, H):
    """Le milieu du tronc a chaque hauteur (x entre devant et dos ; y = 0)."""
    vs = [v.co for f in bm.faces if f.material_index in idx for v in f.verts if abs(v.co.y) < 0.05]
    def axe(z):
        xs = [c.x for c in vs if abs(c.z - z) < 0.02]
        return ((max(xs) + min(xs)) / 2 if xs else 0, 0)
    return axe


def axe_de_la_cuisse(bm, idx, cote):
    vs = [v.co for f in bm.faces if f.material_index in idx for v in f.verts if v.co.y * cote > 0.01]
    def axe(z):
        c = [p for p in vs if abs(p.z - z) < 0.02]
        if not c: return (0, cote * 0.09)
        return ((max(p.x for p in c) + min(p.x for p in c)) / 2, (max(p.y for p in c) + min(p.y for p in c)) / 2)
    return axe


def decouper_tenues(h, rig):
    """LES TENUES DES FEMMES (28/10, « ajoute des corps de femmes ») : brassiere ou debardeur, culotte ou cuissard.
    Le corps garde ses zones teintes sous les pieces ; on y separe donc le VENTRE (sous la poitrine : peau sous une
    brassiere, maillot sinon) et le BAS DU SHORT (sous la culotte : peau, ou short pour un cuissard). Chez les hommes
    ces deux zones prennent toujours la couleur du maillot et du short."""
    H = hauteurs(rig)
    sous_poitrine, culotte = H['aisselle'] - 0.15, H['ceinture'] - 0.115
    bm = bmesh.new(); bm.from_mesh(h.data)
    for z in (sous_poitrine, culotte):
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=Vector((0, 0, z)), plane_no=Vector((0, 0, 1)))
    noms = {m.name.replace('Coureur_', ''): i for i, m in enumerate(h.data.materials)}
    iV, iB = matiere(h, 'ventre'), matiere(h, 'shortbas')
    for f in bm.faces:
        zc = f.calc_center_median().z
        if f.material_index == noms['maillot'] and zc < sous_poitrine: f.material_index = iV
        elif f.material_index == noms['short'] and zc < culotte: f.material_index = iB
    bm.to_mesh(h.data); bm.free(); h.data.update()
    return sous_poitrine


def vetir(h, rig):
    H = hauteurs(rig)
    os_de_tissu(rig, h, H)
    noms = {m.name.replace('Coureur_', ''): i for i, m in enumerate(h.data.materials)}
    iD, iS, iB = matiere(h, 'debardeur'), matiere(h, 'shortlarge'), matiere(h, 'dossard')
    iR = matiere(h, 'brassiere')
    groupes = {g.name: g.index for g in h.vertex_groups}
    bm = bmesh.new(); bm.from_mesh(h.data)
    defl = bm.verts.layers.deform.verify()
    # LE DEBARDEUR : le maillot decolle, l'ourlet libre ; le bas suit tissu_avant / tissu_dos
    TRONC, SHORT = (noms['maillot'], noms['ventre']), (noms['short'], noms['shortbas'])
    # LA BRASSIERE : le haut du maillot (au-dessus du ventre), collee a 3 mm, sans ourlet
    piece(bm, defl, [f for f in bm.faces if f.material_index == noms['maillot']], iR, 0.003, 0, 0, 0)
    corps_tronc = list({v for f in bm.faces if f.material_index in TRONC + SHORT for v in f.verts})
    axe = axe_du_tronc(bm, TRONC + SHORT, H)
    # (le debardeur par-dessus le short : 10 mm de la peau contre 6 — au contraire, le haut du short le traversait)
    _, nv, bas = piece(bm, defl, [f for f in bm.faces if f.material_index in TRONC], iD, 0.010, 0.05, 0.014, H['ceinture'] + 0.02)
    # (28/10, « ils sont tous carres » : tombe a 0,3 depuis le dessous des pectoraux — a 0,6 depuis l'aisselle, le
    #  debardeur faisait un tronc rectangulaire)
    draper(bm, nv + bas, corps_tronc, axe, H['aisselle'] - 0.12, 0.011, tombe=0.3)
    # (la zone maillot du corps recule de deux rangs : sous le bord lisse du debardeur, pas de dent teinte qui depasse)
    for _ in range(2):
        bord_peau = [f for f in bm.faces if f.material_index in TRONC and any(g.material_index == noms['peau'] for e in f.edges for g in e.link_faces)]
        for f in bord_peau: f.material_index = noms['peau']
    zc = H['ceinture']
    tous = nv + bas
    for nom, cote in (('tissu_avant', 1), ('tissu_dos', -1)):
        vs = [v for v in tous if v.co.x * cote > 0 and v.co.z < zc + 0.12]
        peser(bm, vs, defl, groupes, nom, [min(0.9, (zc + 0.12 - v.co.z) / 0.17) for v in vs])
    # LE SHORT FENDU : decolle, les jambes evasees ; le bas de chaque jambe suit son os de tissu
    corps_short = list({v for f in bm.faces if f.material_index in SHORT for v in f.verts})
    _, nv, bas = piece(bm, defl, [f for f in bm.faces if f.material_index in SHORT], iS, 0.006, 0.035, 0.014, H['cuisse'] + 0.02)
    # le haut du short (bassin, entrejambe) tombe autour du tronc, a peine
    # (a peine : il ne doit pas sortir sous l'ourlet du debardeur, qui tombe a 0,3)
    draper(bm, [v for v in nv + bas if v.co.z > H['cuisse'] + 0.10], corps_short, axe, H['ceinture'] + 0.02, 0.005, tombe=0.08)
    # chaque jambe tombe de la fesse (sous l'entrejambe, la jambe est seule : son axe propre)
    for cote in (1, -1):
        jambe = [v for v in nv + bas if v.co.y * cote > 0.012]
        draper(bm, jambe, [v for v in corps_short if v.co.y * cote > 0.012], axe_de_la_cuisse(bm, SHORT, cote), H['ceinture'] - 0.06, 0.012)
    tous = nv + bas
    for nom, cote in (('tissu_short_l', 1), ('tissu_short_r', -1)):
        vs = [v for v in tous if v.co.y * cote > 0 and v.co.z < H['cuisse'] + 0.10]
        peser(bm, vs, defl, groupes, nom, [min(0.85, (H['cuisse'] + 0.10 - v.co.z) / 0.135) for v in vs])
    # LE DOSSARD, devant et dans le dos : 20 x 16 cm, epingle en haut (spine_03), le bas a tissu_dossard
    for nom, cote in (('tissu_dossard', 1), ('tissu_dossard_dos', -1)):
        b = rig.data.bones[nom]; t = b.head_local
        L, Ht, n = 0.20, 0.16, 5
        grille = [[bm.verts.new(Vector((t.x, (i / n - 0.5) * L, t.z + 0.02 - j / n * Ht))) for i in range(n + 1)] for j in range(n + 1)]
        for j in range(n):
            for i in range(n):
                q = [grille[j][i], grille[j][i + 1], grille[j + 1][i + 1], grille[j + 1][i]]
                f = bm.faces.new(q if cote > 0 else q[::-1]); f.material_index = iB
        # pose sur le debardeur, 5 mm devant le plus en avant de chaque rangee
        deb = [v.co for f in bm.faces if f.material_index == iD for v in f.verts]
        # (un dossard est un carton : plat en largeur, il ne suit le buste qu'en hauteur)
        for ligne in grille:
            col = [c.x for v in ligne for c in deb if abs(c.y - v.co.y) < 0.012 and abs(c.z - v.co.z) < 0.012]
            if not col: continue
            x = (max(col) + 0.005) if cote > 0 else (min(col) - 0.005)
            for v in ligne: v.co.x = x
        for j, ligne in enumerate(grille):
            for v in ligne:
                v[defl][groupes['spine_03']] = 1 - 0.8 * j / n
                v[defl][groupes[nom]] = 0.8 * j / n
        # les UV du dossard : toute l'image (le numero)
        uv = bm.loops.layers.uv.verify()
        for f in bm.faces:
            if f.material_index != iB: continue
            for lp in f.loops:
                lp[uv].uv = ((lp.vert.co.y / L + 0.5) if cote > 0 else (0.5 - lp.vert.co.y / L), (lp.vert.co.z - (t.z + 0.02 - Ht)) / Ht)
    for f in bm.faces:
        if f.material_index == iB:
            f.smooth = False
            if (f.normal.x > 0) != (f.calc_center_median().x > 0): f.normal_flip()
    bm.to_mesh(h.data); bm.free(); h.data.update()
    print('VETU', {n: sum(1 for p in h.data.polygons if p.material_index == i) for n, i in (('debardeur', iD), ('shortlarge', iS), ('dossard', iB))})


def formes(h):
    """LES PHYSIQUES (28/10, « fais des corpulences et des physiques differents d'athletes ») : quatre cibles de
    morphing, dosees coureur par coureur dans le jeu (course-3d.ts, PHYSIQUES) :
      muscle  : cuisses, mollets, fessiers, bras, pectoraux et epaules gonflent le long de la normale (14 mm au plus) ;
      sec     : tout le corps s'affine (8 mm), sauf la tete, les mains et les pieds ;
      epaules : le haut du buste et les bras s'ecartent (2,5 cm de chaque cote) ;
      bassin  : les hanches s'elargissent (2 cm de chaque cote).
    Les vetements et le dossard sont dans le meme maillage, avec les memes poids : ils suivent la forme.
    Appelee APRES le miroir de l'export (le miroir ne retournerait pas les cles)."""
    me = h.data
    noms = {g.index: g.name for g in h.vertex_groups}
    def poids(v, cle):
        return sum(g.weight * cle.get(noms[g.group].rsplit('_', 1)[0] if noms[g.group][-2:] in ('_l', '_r') else noms[g.group], 0) for g in v.groups)
    MUSCLE = {'thigh': 1.0, 'calf': 0.8, 'upperarm': 0.8, 'lowerarm': 0.45, 'spine_03': 0.7, 'clavicle': 0.6, 'pelvis': 0.55, 'spine_02': 0.25}
    SEC = {'thigh': 1, 'calf': 1, 'upperarm': 1, 'lowerarm': 1, 'spine_01': 1, 'spine_02': 1, 'spine_03': 1, 'pelvis': 1, 'clavicle': 0.8, 'neck_01': 0.5}
    EPAULES = {'clavicle': 1.0, 'upperarm': 1.0, 'lowerarm': 1.0, 'hand': 1.0, 'spine_03': 0.45}
    hanche = max((v.co.z for v in me.vertices), default=1) * 0.53
    if not me.shape_keys: h.shape_key_add(name='Basis', from_mix=False)
    cles = {n: h.shape_key_add(name=n, from_mix=False) for n in ('muscle', 'sec', 'epaules', 'bassin')}
    for v in me.vertices:
        n = v.normal; co = v.co; cote = 1 if co.y > 0 else -1
        cles['muscle'].data[v.index].co = co + n * 0.014 * min(1, poids(v, MUSCLE))
        cles['sec'].data[v.index].co = co - n * 0.008 * min(1, poids(v, SEC))
        cles['epaules'].data[v.index].co = co + Vector((0, cote * 0.025 * min(1, poids(v, EPAULES)), 0))
        pres = max(0.0, 1 - abs(co.z - hanche) / 0.22)
        cles['bassin'].data[v.index].co = co + Vector((0, cote * 0.02 * pres * min(1, poids(v, {'pelvis': 1, 'thigh': 0.8, 'spine_01': 0.4})), 0))
    print('FORMES', [k.name for k in me.shape_keys.key_blocks])


def tout(A):
    M['scene_neuve']()
    h = V['importer'](A['source'], A['taille'], 'coureur')
    J = V['articulations'](h, A['taille'])
    D = V['doigts'](h, J, A['taille'])
    rig = V['squelette'](J, D, 'Coureur')
    V['ponderer'](h, rig)
    M['mise_en_repere'](h, rig)
    b = rig.data.bones
    G['SH_Y'] = b['upperarm_l'].head_local.y
    G['HIP_Y'] = b['thigh_l'].head_local.y
    CARTOON['adoucir_epaules'](h)
    herite = M['caler'](rig, CARTOON['cibles'](rig, cou=1.0))
    CARTOON['figer'](h, rig, herite)
    V['deplier_aisselles'](h, rig)
    V['sternum_au_buste'](h, rig)
    GEN['zoner'].__globals__['zone_de_la_face'] = zone_du_debardeur   # (zoner la lit dans les globales de son module)
    GEN['zoner'](h, rig)
    decouper_tenues(h, rig)
    vetir(h, rig)
    GEN['exporter'](h, rig, A['glb'])


if __name__ == '__main__' and bpy.app.background:
    tout(GEN['arguments']())
