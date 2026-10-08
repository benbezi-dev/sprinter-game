# -----------------------------------------------------------------------
# LA NUIT DU MOLOSSE — la bete en vrai maillage, faite dans TRELLIS.2.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
#       -P tools/blender/molosse_trellis.py -- --source <trellis.glb> \
#       [--glb src/assets/molosse.glb] [--planche planche.png] [--blend F.blend] \
#       [--garrot 1.3] [--faces 9000] [--texture 512] [--sens 1|-1]
#
# D'OU VIENT LA BETE (07/10, « refait le molosse avec TRELLIS.2 »). Une image
# FLUX.1-schnell (graine 637403160, invite dans assets-sources/molosse-trellis/)
# passee dans TRELLIS.2 (Microsoft, MIT) : un maillage texture d'un seul
# tenant, debout, sans squelette. Les sources sont hors du depot :
# assets-sources/molosse-trellis/.
#
# CE QUE TRELLIS NE DONNE PAS, ce script le pose :
#   - le sens et l'echelle : la bete arrive tournee n'importe comment, a une
#     taille arbitraire. Son grand axe est lu sur le maillage (axes
#     principaux) ; la tete est le bout le plus massif (la queue est mince) ;
#     le garrot est pose a GARROT (voir plus bas) ;
#   - un squelette de quadrupede : les quatre pieds sont les quatre amas de
#     sommets au ras du sol, et chaque articulation de patte est recentree sur
#     la coupe du maillage a sa hauteur — un os hors de la peau ne recoit
#     aucun poids ;
#   - un galop, en une boucle : les pieds suivent la loi du trace (`pied`),
#     posee par cinematique inverse, puis cuite os par os.
#
# LE JEU N'EN FAIT PAS UNE VRAIE VUE, ET C'EST VOULU. La camera du jeu regarde
# la bete de trois quarts ARRIERE : en vraie projection on verrait sa croupe,
# jamais sa gueule ni ses yeux. Le trace trichait deja — un profil couche sur
# l'axe de la piste — et le maillage triche de meme (halloween-molosse-3d.ts) :
# il est rendu de profil, puis pose sur cet axe. La planche de ce script montre
# la bete sous ce profil-la.
# -----------------------------------------------------------------------

import bpy
import math
import os
import sys
from mathutils import Vector, Matrix

import numpy as np

# LA TAILLE AU GARROT. C'etait celle du trace (halloween-molosse.js, 1,00 m) ;
# depuis le 08/10 (« plus grand la bete ») le maillage en fait 1,30. Le jeu
# l'apprend par GARROT_DU_MAILLAGE (halloween-molosse-3d.ts) : changer l'un
# sans l'autre fausse le cadre du rendu et l'ombre.
GARROT = 1.30
# LA FOULEE DU TRACE : 0,45 foulee par metre, une tous les 2,22 m. Le jeu
# cale la boucle sur la distance (cycle = d * FOULEE) : un pied au contact
# recule de ce que le sol offre pendant ce temps, et ne patine pas.
FOULEE = 0.45
# Le temps de contact, en part de foulee. Un galop en a moins que la moitie ;
# le reste, la patte se replie et revient devant.
CONTACT = 0.34
# CE QUE LE PIED PEUT PATINER. Sans glissement, il devrait reculer de
# CONTACT / FOULEE = 0,76 m sous le corps : plus que la patte n'en couvre
# (premiere planche, le posterieur ne touchait plus le sol devant). On lui en
# laisse un cinquieme — invisible a cent pixels, quand le trace en patinait
# cinq fois et demie.
GLISSE = 0.80
# LA BETE COURT PLUS BAS QU'ELLE NE SE TIENT. Debout, ses pattes sont presque
# droites et la cinematique inverse n'a plus de quoi plier : en course, le
# corps descend de ce qu'il faut pour que les pattes se ramassent.
ACCROUPI = 0.07
# Le galop transverse du trace : posterieur gauche, posterieur droit,
# anterieur gauche, anterieur droit (PATTES, halloween-molosse.js).
PHASES = {('ar', 'g'): 0.00, ('ar', 'd'): 0.20, ('av', 'g'): 0.45, ('av', 'd'): 0.65}
IMAGES = 24


def arguments():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    val = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    return {'source': val('--source'), 'glb': val('--glb'), 'planche': val('--planche'),
            'blend': val('--blend'), 'garrot': float(val('--garrot', str(GARROT))),
            'faces': int(val('--faces', '9000')), 'texture': int(val('--texture', '512')),
            'sens': val('--sens')}


# --- LE MAILLAGE --------------------------------------------------------------

def importer(source):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    maillages = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in maillages:
        o.select_set(True)
    bpy.context.view_layer.objects.active = maillages[0]
    if len(maillages) > 1:
        bpy.ops.object.join()
    h = bpy.context.view_layer.objects.active
    h.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    h.name = 'molosse'
    return h


def sommets(h):
    co = np.empty(len(h.data.vertices) * 3)
    h.data.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)


def garder_le_corps(h, part=0.03):
    """Les miettes qui flottent autour d'une generation (petits amas detaches)
    s'en vont. Une miette se juge a sa TAILLE, pas a ses sommets : une crete
    detachee du dos en a peu, et doit rester. Tout morceau plus grand que
    `part` de la bete reste."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(h.data)
    # LE GLTF ARRIVE EN MIETTES : chaque coupure d'UV et chaque arete vive y
    # dedouble ses sommets. Soudes, ils redonnent les vrais morceaux (les UV,
    # portees par les coins de face, n'y perdent rien).
    taille = max(h.dimensions)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5 * taille)
    bm.verts.ensure_lookup_table()
    vus, morceaux = set(), []
    for v in bm.verts:
        if v.index in vus:
            continue
        pile, m = [v], []
        vus.add(v.index)
        while pile:
            u = pile.pop()
            m.append(u)
            for e in u.link_edges:
                w = e.other_vert(u)
                if w.index not in vus:
                    vus.add(w.index)
                    pile.append(w)
        morceaux.append(m)
    def etendue(m):
        c = np.array([v.co[:] for v in m])
        return np.linalg.norm(c.max(0) - c.min(0))
    jetes = [v for m in morceaux if etendue(m) < part * taille for v in m]
    bmesh.ops.delete(bm, geom=jetes, context='VERTS')
    bm.to_mesh(h.data)
    bm.free()
    print('MAILLAGE : %d morceaux, %d sommets jetes (miettes)' % (len(morceaux), len(jetes)))


def decimer(h, faces):
    n = len(h.data.polygons)
    if n <= faces:
        return
    d = h.modifiers.new('decimer', 'DECIMATE')
    d.ratio = faces / n
    bpy.context.view_layer.objects.active = h
    bpy.ops.object.modifier_apply(modifier=d.name)
    print('MAILLAGE : %d faces -> %d' % (n, len(h.data.polygons)))


def poser(h, M):
    h.data.transform(M)
    h.data.update()


def orienter(h, sens=None):
    """La bete sur +x, le sol a z = 0, son centre au-dessus de l'origine."""
    co = sommets(h)
    # LE HAUT. TRELLIS rend en glTF (y en haut), l'import le remet en z : on
    # le suppose, et la planche le montre.
    xy = co[:, :2] - co[:, :2].mean(axis=0)
    _, vecs = np.linalg.eigh(np.cov(xy.T))
    a = vecs[:, -1]
    ang = math.atan2(a[1], a[0])
    poser(h, Matrix.Rotation(-ang, 4, 'Z'))
    co = sommets(h)
    # LA TETE EST LE BOUT QUI A LE PLUS DE VOLUME AU-DESSUS DES PATTES. Aux
    # deux bouts du grand axe, la section moyenne (largeur x hauteur) de ce
    # qui depasse le tiers de la hauteur : la tete et le cou d'un cote, une
    # queue de quelques centimetres de l'autre. Pas la plus grande section, ni
    # en comptant les pattes : la croupe et les posterieurs, pris dans la
    # tranche de la queue, la faisaient passer pour une tete (premier essai,
    # la bete courait a reculons).
    x0, x1 = co[:, 0].min(), co[:, 0].max()
    L = x1 - x0
    haut = co[co[:, 2] > 0.35 * co[:, 2].max()]

    def section(xa, xb):
        v = []
        for t in np.linspace(0, 1, 8):
            xm = xa + (xb - xa) * t
            s = haut[np.abs(haut[:, 0] - xm) < L * 0.015]
            v.append(np.ptp(s[:, 1]) * np.ptp(s[:, 2]) if len(s) > 3 else 0.0)
        return float(np.mean(v))
    avant, arriere = section(x1 - 0.20 * L, x1), section(x0, x0 + 0.20 * L)
    s = 1 if avant >= arriere else -1
    if sens:
        s *= int(sens)
    if s < 0:
        poser(h, Matrix.Rotation(math.pi, 4, 'Z'))
    print('ORIENTATION : grand axe a %.0f deg, sections avant %.3f / arriere %.3f -> %s' % (
        math.degrees(ang), avant, arriere, 'tete en +x' if s > 0 else 'retournee'))
    co = sommets(h)
    c = Vector(((co[:, 0].min() + co[:, 0].max()) / 2, (co[:, 1].min() + co[:, 1].max()) / 2, co[:, 2].min()))
    poser(h, Matrix.Translation(-c))


def pieds(co):
    """Les quatre pieds : les amas de sommets au ras du sol (k-moyennes a
    quatre, parties des quatre coins)."""
    H = co[:, 2].max()
    bas = co[co[:, 2] < 0.07 * H][:, :2]
    xs = np.percentile(bas[:, 0], [15, 85])
    ys = np.percentile(bas[:, 1], [15, 85])
    c = np.array([[xs[1], ys[1]], [xs[1], ys[0]], [xs[0], ys[1]], [xs[0], ys[0]]])
    for _ in range(20):
        d = ((bas[:, None, :] - c[None, :, :]) ** 2).sum(-1)
        k = d.argmin(1)
        c = np.array([bas[k == i].mean(0) if (k == i).any() else c[i] for i in range(4)])
    av = c[np.argsort(-c[:, 0])[:2]]
    ar = c[np.argsort(c[:, 0])[:2]]
    res = {}
    for nom, paire in (('av', av), ('ar', ar)):
        g, d = (paire[0], paire[1]) if paire[0][1] > paire[1][1] else (paire[1], paire[0])
        res[(nom, 'g')], res[(nom, 'd')] = g, d
    return res


def bande(co, x, y, z, r, dz):
    """Le centre de la coupe du maillage a la hauteur z, pres de (x, y)."""
    m = (np.abs(co[:, 2] - z) < dz) & (np.hypot(co[:, 0] - x, co[:, 1] - y) < r)
    if m.sum() < 3:
        return np.array([x, y])
    return co[m][:, :2].mean(0)


def dos_a(co, x, L):
    """Le dessus et le dessous du tronc a l'abscisse x.

    LE DESSUS EST LE PLUS HAUT NIVEAU OU LA COUPE EST ENCORE LARGE. Un centile
    de hauteur ne le donne pas : la coupe prend aussi les pattes, qui tirent
    tout vers le bas, et les cretes, qui tirent vers le haut. Une crete est
    etroite ; le dos, lui, garde plus du tiers de la largeur du tronc.
    Le ventre est le plus bas du plan median, au-dessus des pattes."""
    s = co[np.abs(co[:, 0] - x) < 0.03 * L]
    zmax = s[:, 2].max()
    dz = 0.015 * zmax
    niveaux = np.arange(zmax, 0.3 * zmax, -dz)
    larg = np.array([np.ptp(s[np.abs(s[:, 2] - z) < dz][:, 1]) if (np.abs(s[:, 2] - z) < dz).sum() > 2 else 0.0
                     for z in niveaux])
    # la largeur du tronc : celle de la moitie haute (les pattes, ecartees,
    # feraient une fausse largeur plus bas)
    tronc = larg[niveaux > 0.55 * zmax].max()
    haut = next(z for z, l in zip(niveaux, larg) if l > 0.35 * tronc)
    mil = s[np.abs(s[:, 1]) < 0.05 * L]
    mil = mil[mil[:, 2] > 0.25 * haut] if len(mil) else mil
    bas = mil[:, 2].min() if len(mil) else 0.5 * haut
    return haut, bas


def mettre_a_l_echelle(h, garrot):
    co = sommets(h)
    P = pieds(co)
    L = np.ptp(co[:, 0])
    xa = (P[('av', 'g')][0] + P[('av', 'd')][0]) / 2
    haut, _ = dos_a(co, xa, L)
    k = garrot / haut
    poser(h, Matrix.Scale(k, 4))
    # le centre de la bete entre ses pieds, comme l'origine du trace
    co = sommets(h)
    P = pieds(co)
    cx = np.mean([p[0] for p in P.values()])
    poser(h, Matrix.Translation((-cx, 0, 0)))
    print('ECHELLE : garrot mesure %.3f (unites TRELLIS) -> %.2f m, x %.3f' % (haut, garrot, k))


# --- LE SQUELETTE -------------------------------------------------------------

def mesurer(h):
    co = sommets(h)
    P = pieds(co)
    L = np.ptp(co[:, 0])
    H = co[:, 2].max()
    xa = (P[('av', 'g')][0] + P[('av', 'd')][0]) / 2
    xr = (P[('ar', 'g')][0] + P[('ar', 'd')][0]) / 2
    Hw, ventre_av = dos_a(co, xa, L)
    Hc, ventre_ar = dos_a(co, xr, L)
    J = {}
    for (bout, cote), p in P.items():
        px, py = float(p[0]), float(p[1])
        if bout == 'av':
            # l'epaule dans le tronc, le coude sous le poitrail et vers
            # l'arriere, le carpe au-dessus du pied
            ep = Vector((px + 0.04 * Hw, py * 0.70, ventre_av + 0.45 * (Hw - ventre_av)))
            zc = min(ventre_av, 0.52 * Hw)
            c = bande(co, px - 0.05 * Hw, py, zc, 0.18 * Hw, 0.03 * Hw)
            coude = Vector((c[0], c[1], zc))
            c = bande(co, px, py, 0.18 * Hw, 0.12 * Hw, 0.03 * Hw)
            carpe = Vector((c[0], c[1], 0.18 * Hw))
            c = bande(co, px, py, 0.05 * Hw, 0.12 * Hw, 0.03 * Hw)
            boulet = Vector((c[0], c[1], 0.05 * Hw))
            bout_pied = Vector((c[0] + 0.10 * Hw, c[1], 0.02 * Hw))
            haut = Vector((ep.x - 0.10 * Hw, ep.y * 0.6, 0.90 * Hw))
            J[(bout, cote)] = [haut, ep, coude, carpe, boulet, bout_pied]
        else:
            hanche = Vector((px + 0.12 * Hc, py * 0.70, ventre_ar + 0.50 * (Hc - ventre_ar)))
            c = bande(co, px + 0.14 * Hc, py, 0.42 * Hc, 0.20 * Hc, 0.03 * Hc)
            grasset = Vector((c[0], c[1], 0.42 * Hc))
            c = bande(co, px - 0.10 * Hc, py, 0.22 * Hc, 0.14 * Hc, 0.03 * Hc)
            jarret = Vector((c[0], c[1], 0.22 * Hc))
            c = bande(co, px, py, 0.05 * Hc, 0.12 * Hc, 0.03 * Hc)
            boulet = Vector((c[0], c[1], 0.05 * Hc))
            bout_pied = Vector((c[0] + 0.10 * Hc, c[1], 0.02 * Hc))
            J[(bout, cote)] = [hanche, grasset, jarret, boulet, bout_pied]
    # l'echine : de la hanche au garrot, au milieu de l'epaisseur
    bassin = Vector((xr + 0.12 * Hc, 0, (Hc + ventre_ar) / 2 + 0.05 * Hc))
    garrot = Vector((xa + 0.02 * Hw, 0, (Hw + ventre_av) / 2 + 0.08 * Hw))
    milieu = (bassin + garrot) / 2
    # LA TETE : le bout du museau est le sommet le plus en avant au-dessus du
    # tiers de la hauteur ; le crane, le centre de ce qui est a moins d'une
    # demi-longueur de tete derriere lui.
    tete = co[co[:, 2] > 0.30 * Hw]
    i = tete[:, 0].argmax()
    museau = Vector(tete[i])
    museau.y = 0
    lt = 0.45 * Hw
    cr = tete[tete[:, 0] > museau.x - lt]
    crane_c = Vector(cr.mean(0))
    crane_c.y = 0
    nuque = Vector((museau.x - lt, 0, crane_c.z + 0.05 * Hw))
    haut_tete = cr[:, 2].max()
    bas_tete = cr[:, 2].min()
    large = np.ptp(cr[:, 1])
    oeil = Vector((museau.x - 0.30 * lt, 0.22 * large, bas_tete + 0.68 * (haut_tete - bas_tete)))
    # LA QUEUE : du bout de la croupe a son sommet le plus en arriere, en
    # suivant le centre des coupes
    q = co[co[:, 2] > 0.25 * Hc]
    j = q[:, 0].argmin()
    bout_q = Vector(q[j])
    base_q = Vector((xr - 0.10 * Hc, 0, 0.80 * Hc))
    pts = [base_q]
    for t in (1 / 3, 2 / 3):
        x = base_q.x + (bout_q.x - base_q.x) * t
        z = base_q.z + (bout_q.z - base_q.z) * t
        s = q[(np.abs(q[:, 0] - x) < 0.04 * Hc) & (np.abs(q[:, 1]) < 0.15 * Hc)]
        if len(s):
            z = float(np.median(s[:, 2]))
        pts.append(Vector((x, 0, z)))
    pts.append(Vector((bout_q.x, 0, bout_q.z)))
    print('MESURES : garrot %.2f, croupe %.2f, ventre %.2f/%.2f, longueur %.2f, hauteur %.2f' % (
        Hw, Hc, ventre_av, ventre_ar, L, H))
    return {'J': J, 'bassin': bassin, 'milieu': milieu, 'garrot': garrot, 'nuque': nuque,
            'museau': museau, 'oeil': oeil, 'queue': pts, 'Hw': Hw}


NOMS_AV = ['omoplate', 'bras', 'avantbras', 'canon', 'doigts']
NOMS_AR = ['cuisse', 'jambe', 'canon', 'doigts']


def squelette(mesure):
    arm = bpy.data.armatures.new('molosse_rig')
    rig = bpy.data.objects.new('molosse_rig', arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones

    def os_(nom, a, b, parent=None, deforme=True):
        e = eb.new(nom)
        e.head, e.tail = a, b
        # LE PLI DANS LE PLAN DU CORPS : l'axe x de chaque os sur le travers.
        # Plier une patte, cabrer l'echine, c'est tourner autour de x, et la
        # cinematique inverse n'a que cet axe-la (galop). Un os qui descend a
        # son axe z vers l'avant ; un os couche, vers le haut.
        d = (b - a).normalized()
        e.align_roll(Vector((0, 0, 1)) if abs(d.z) < 0.7 else Vector((1, 0, 0)))
        if parent:
            e.parent = eb[parent]
        e.use_deform = deforme
        return e
    os_('racine', Vector((0, 0, 0)), Vector((0, 0, 0.3)), deforme=False)
    os_('bassin', mesure['bassin'], mesure['milieu'], 'racine')
    os_('dos', mesure['milieu'], mesure['garrot'], 'bassin')
    os_('cou', mesure['garrot'], mesure['nuque'], 'dos')
    os_('tete', mesure['nuque'], mesure['museau'], 'cou')
    for c, s in (('g', 1), ('d', -1)):
        o = mesure['oeil'].copy(); o.y *= s
        os_('oeil_' + c, o, o + Vector((0.05, 0, 0)), 'tete', deforme=False)
    q = mesure['queue']
    for i in range(3):
        os_('queue_%d' % (i + 1), q[i], q[i + 1], 'bassin' if i == 0 else 'queue_%d' % i)
    for (bout, c), pts in mesure['J'].items():
        noms = NOMS_AV if bout == 'av' else NOMS_AR
        parent = 'dos' if bout == 'av' else 'bassin'
        for i, n in enumerate(noms):
            nom = '%s_%s_%s' % (n, bout, c)
            os_(nom, pts[i], pts[i + 1], parent)
            parent = nom
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def ponderer(h, rig, voxel=0.015):
    """La chaleur de Blender ; si elle echoue (un maillage en morceaux), sur
    une doublure etanche en voxels, comme les vedettes (vedette_tripo.py,
    poids_par_procuration)."""
    bpy.ops.object.select_all(action='DESELECT')
    h.select_set(True); rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    noms = {g.index: g.name for g in h.vertex_groups}
    defo = {b.name for b in rig.data.bones if b.use_deform}
    pese = lambda v: sum(g.weight for g in v.groups if noms.get(g.group) in defo)
    seuls = [v for v in h.data.vertices if pese(v) < 1e-4]
    if len(seuls) > 0.10 * len(h.data.vertices):
        print('POIDS : la chaleur laisse %d sommets sur %d sans os : doublure' % (len(seuls), len(h.data.vertices)))
        p = h.copy(); p.data = h.data.copy()
        bpy.context.scene.collection.objects.link(p)
        p.parent = None; p.matrix_world = h.matrix_world.copy()
        p.vertex_groups.clear()
        for m in list(p.modifiers):
            p.modifiers.remove(m)
        bpy.ops.object.select_all(action='DESELECT')
        p.select_set(True); bpy.context.view_layer.objects.active = p
        r = p.modifiers.new('remaille', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = voxel
        bpy.ops.object.modifier_apply(modifier=r.name)
        bpy.ops.object.select_all(action='DESELECT')
        p.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        h.vertex_groups.clear()
        for g in p.vertex_groups:
            h.vertex_groups.new(name=g.name)
        bpy.ops.object.select_all(action='DESELECT')
        h.select_set(True); bpy.context.view_layer.objects.active = h
        t = h.modifiers.new('report', 'DATA_TRANSFER'); t.object = p
        t.use_vert_data = True; t.data_types_verts = {'VGROUP_WEIGHTS'}; t.vert_mapping = 'POLYINTERP_NEAREST'
        t.layers_vgroup_select_src = 'ALL'; t.layers_vgroup_select_dst = 'NAME'
        bpy.ops.object.modifier_move_to_index(modifier=t.name, index=0)
        bpy.ops.object.modifier_apply(modifier=t.name)
        bpy.data.objects.remove(p, do_unlink=True)
        noms = {g.index: g.name for g in h.vertex_groups}
        seuls = [v for v in h.data.vertices if pese(v) < 1e-4]
    if seuls:
        from mathutils.kdtree import KDTree
        bons = [v for v in h.data.vertices if pese(v) >= 1e-4]
        kd = KDTree(len(bons))
        for i, v in enumerate(bons):
            kd.insert(v.co, i)
        kd.balance()
        for v in seuls:
            _, i, _ = kd.find(v.co)
            for g in bons[i].groups:
                h.vertex_groups[g.group].add([v.index], g.weight, 'REPLACE')
    print('POIDS : %d sommets sans os, repris du voisin' % len(seuls))


# --- LE GALOP -----------------------------------------------------------------

def pied(u, amplitude, levee):
    """La loi du trace (halloween-molosse.js, `pied`), au temps de contact
    CONTACT : au sol, le pied recule sous le corps ; en l'air, il se replie,
    haut et court, et revient devant. Rend (dx, dz) en metres."""
    if u < CONTACT:
        k = u / CONTACT
        return amplitude * (0.5 - k), 0.0
    k = (u - CONTACT) / (1 - CONTACT)
    k = 0.5 - 0.5 * math.cos(k * math.pi)   # il repart lentement, se pose lentement
    return amplitude * (-0.5 + k), math.sin(k * math.pi) * levee


def galop(rig, mesure):
    """Une foulee en IMAGES images, posee par cinematique inverse puis cuite."""
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, IMAGES
    Hw = mesure['Hw']
    # La course d'un pied au contact : ce que le corps avance pendant ce
    # temps-la, pour que rien ne patine.
    amplitude = CONTACT / FOULEE * GLISSE
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    cibles = {}
    for (bout, c), pts in mesure['J'].items():
        noms = NOMS_AV if bout == 'av' else NOMS_AR
        canon = rig.pose.bones['canon_%s_%s' % (bout, c)]
        # le pied balaie sous l'epaule et sous la hanche, pas sous sa place
        # au repos : c'est la que la patte porte le plus loin des deux cotes
        boulet = pts[-2].copy()
        boulet.x = pts[1].x if bout == 'av' else pts[0].x
        t = bpy.data.objects.new('cible_%s_%s' % (bout, c), None)
        sc.collection.objects.link(t); t.location = boulet
        # LA PATTE NE PLIE QUE DANS UN SENS A CHAQUE ARTICULATION, et c'est ce
        # qui la fait tenir. Sans ces butees, la cinematique inverse prenait
        # le chemin le plus court : le jarret pliait vers l'avant, le
        # posterieur se nouait (premiere planche). Le coude et le jarret
        # ferment vers l'avant, le carpe et le grasset vers l'arriere — le
        # zigzag d'une patte de chien.
        k = canon.constraints.new('IK')
        k.target = t
        k.chain_count = 3
        k.use_stretch = False
        haut_, milieu_, bas_ = (('bras', 'avantbras', 'canon') if bout == 'av' else ('cuisse', 'jambe', 'canon'))
        butees = {'bras': (-80, 80), 'avantbras': (-10, 130), 'canon_av': (-130, 10),
                  'cuisse': (-80, 80), 'jambe': (-120, 10), 'canon_ar': (-10, 120)}
        for n in (haut_, milieu_, bas_):
            pb = rig.pose.bones['%s_%s_%s' % (n, bout, c)]
            pb.lock_ik_y = pb.lock_ik_z = True
            lo, hi = butees[n if n != 'canon' else 'canon_' + bout]
            pb.use_ik_limit_x = True
            pb.ik_min_x, pb.ik_max_x = math.radians(lo), math.radians(hi)
        cibles[(bout, c)] = (t, boulet)
    bassin = rig.pose.bones['bassin']
    dos = rig.pose.bones['dos']
    cou = rig.pose.bones['cou']
    tete = rig.pose.bones['tete']
    queue = [rig.pose.bones['queue_%d' % i] for i in (1, 2, 3)]
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
    for f in range(IMAGES + 1):
        cy = f / IMAGES
        for (bout, c), (t, boulet) in cibles.items():
            u = (cy + PHASES[(bout, c)]) % 1.0
            dx, dz = pied(u, amplitude, (0.30 if bout == 'av' else 0.24) * Hw)
            t.location = boulet + Vector((dx, 0, dz))
            t.keyframe_insert('location', frame=f + 1)
        # L'ECHINE SE RAMASSE ET SE DETEND, une fois par foulee : ramassee
        # quand les posterieurs reviennent sous le ventre, detendue quand les
        # anterieurs se lancent. Le corps monte au temps de suspension.
        w = 2 * math.pi * cy
        bassin.rotation_euler = (math.radians(5) * math.sin(w), 0, 0)
        # (en coordonnees de l'os : son axe y suit l'echine, z monte)
        bassin.location = (0, 0, (0.035 * math.sin(w - 0.8) - ACCROUPI) * Hw)
        dos.rotation_euler = (-math.radians(9) * math.cos(w), 0, 0)
        cou.rotation_euler = (math.radians(6) * math.cos(w + 0.6), 0, 0)
        tete.rotation_euler = (-math.radians(5) * math.cos(w + 0.6), 0, 0)
        for i, b in enumerate(queue):
            b.rotation_euler = (math.radians(10 + 4 * i) * math.sin(w - 0.9 - 0.6 * i), 0,
                                math.radians(6) * math.sin(w - 0.6 * i))
        for b in [bassin, dos, cou, tete] + queue:
            b.keyframe_insert('rotation_euler', frame=f + 1)
        bassin.keyframe_insert('location', frame=f + 1)
    # LA CUISSON : chaque os recoit sa pose vue, image par image, et les
    # contraintes partent avec les cibles. Le glTF ne lit que des os.
    for pb in rig.pose.bones:
        # (Blender 5 a pose la selection sur l'os de pose)
        if hasattr(pb, 'select'):
            pb.select = True
        else:
            pb.bone.select = True
    bpy.ops.nla.bake(frame_start=1, frame_end=IMAGES + 1, only_selected=True, visual_keying=True,
                     clear_constraints=True, use_current_action=True, bake_types={'POSE'})
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(sc.objects):
        if o.type == 'EMPTY':
            bpy.data.objects.remove(o, do_unlink=True)
    act = rig.animation_data.action
    act.name = 'galop'
    print('GALOP : %d images, amplitude %.2f m au contact' % (IMAGES, amplitude))


# --- LA TEXTURE ET L'EXPORT ---------------------------------------------------

def reduire_textures(h, cote):
    for m in h.data.materials:
        if not m or not m.use_nodes:
            continue
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and max(n.image.size) > cote:
                n.image.scale(cote, cote)


def exporter(h, rig, chemin):
    bpy.ops.object.select_all(action='DESELECT')
    h.select_set(True)
    bpy.context.view_layer.objects.active = h
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    os.makedirs(os.path.dirname(os.path.abspath(chemin)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=chemin, export_format='GLB', use_selection=True,
                              use_active_scene=True, export_skins=True, export_animations=True,
                              export_frame_range=True, export_force_sampling=True,
                              export_morph=False, export_yup=True, export_apply=False,
                              export_attributes=False, export_def_bones=False,
                              export_image_format='JPEG', export_jpeg_quality=85,
                              export_meshopt_compression_enable=True)
    return os.path.getsize(chemin)


def planche(h, rig, chemin, mesure):
    """Six images du galop sous le profil du jeu (une plongee de 20 deg), et
    une silhouette de coureur de 1,80 m a cote pour juger la taille."""
    sc = bpy.context.scene
    for moteur in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = moteur
            break
        except TypeError:
            pass
    sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new('nuit')
    sc.world.use_nodes = True
    fond = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND')
    fond.inputs[0].default_value = (0.05, 0.05, 0.08, 1)
    fond.inputs[1].default_value = 1.0
    soleil = bpy.data.objects.new('soleil', bpy.data.lights.new('soleil', 'SUN'))
    soleil.data.energy = 3.0
    soleil.rotation_euler = (math.radians(50), 0, math.radians(-30))
    sc.collection.objects.link(soleil)
    braise = bpy.data.objects.new('braise', bpy.data.lights.new('braise', 'SUN'))
    braise.data.energy = 4.0; braise.data.color = (1.0, 0.55, 0.15)
    braise.rotation_euler = (math.radians(-60), 0, math.radians(180))
    sc.collection.objects.link(braise)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=1.80, location=(0, 1.2, 0.90))
    bpy.context.active_object.name = 'coureur'
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    sol = bpy.context.active_object
    ms = bpy.data.materials.new('sol'); ms.use_nodes = True
    next(n for n in ms.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (0.12, 0.10, 0.09, 1)
    sol.data.materials.append(ms)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 4.2
    e = math.radians(20)
    cam.location = (0, -10 * math.cos(e), 0.7 + 10 * math.sin(e))
    cam.rotation_euler = (math.pi / 2 - e, 0, 0)
    sc.collection.objects.link(cam); sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 640, 480
    import tempfile
    tmp = tempfile.mkdtemp()
    images = []
    for i, f in enumerate((1, 5, 9, 13, 17, 21)):
        sc.frame_set(f)
        sc.render.filepath = os.path.join(tmp, 'p%d.png' % i)
        bpy.ops.render.render(write_still=True)
        images.append(bpy.data.images.load(sc.render.filepath))
    W, Hh = 640, 480
    out = bpy.data.images.new('planche', 3 * W, 2 * Hh)
    px = np.zeros((2 * Hh, 3 * W, 4), dtype=np.float32)
    for i, im in enumerate(images):
        a = np.array(im.pixels[:], dtype=np.float32).reshape(Hh, W, 4)
        r, c = 1 - i // 3, i % 3
        px[r * Hh:(r + 1) * Hh, c * W:(c + 1) * W] = a
    out.pixels = px.ravel()
    out.filepath_raw = chemin
    out.file_format = 'PNG'
    out.save()
    print('PLANCHE : %s' % chemin)


def main():
    a = arguments()
    h = importer(a['source'])
    garder_le_corps(h)
    orienter(h, a['sens'])
    mettre_a_l_echelle(h, a['garrot'])
    decimer(h, a['faces'])
    mesure = mesurer(h)
    rig = squelette(mesure)
    ponderer(h, rig)
    galop(rig, mesure)
    reduire_textures(h, a['texture'])
    if a['glb']:
        print('GLB : %s (%d Ko)' % (a['glb'], exporter(h, rig, a['glb']) // 1024))
    if a['blend']:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a['blend']))
    if a['planche']:
        planche(h, rig, a['planche'], mesure)


if __name__ == '__main__':
    main()
