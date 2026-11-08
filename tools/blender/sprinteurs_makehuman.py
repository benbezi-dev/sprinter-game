# -----------------------------------------------------------------------
# SPRINTER — sprinteur et sprinteuse pour Unity, faits avec les donnees CC0 de MakeHuman (08/11/2026).
#
# L'auteur, 08/11 : « il nous faut des assets d'athlete », « je veux une attitude de sprinteur »,
# « les tenues sont mal faites, ce ne sont pas de vrais maillots ou brassieres », « utilise Unity pour le
# mettre en action ». Ni Unity ni l'interface de MakeHuman ne tournent ici : ce script fait tout dans Blender
# (module Python bpy) et sort un FBX pret pour Unity, sur le modele d'Aurel (tools/blender/aurel_unity.py).
#
#   pip install bpy==5.2.3            (Python 3.13)
#   git clone --depth 1 https://github.com/makehumancommunity/makehuman
#   MH_DATA=makehuman/makehuman/data python tools/blender/sprinteurs_makehuman.py male   unity/Sprinteurs/Sprinteur
#   MH_DATA=makehuman/makehuman/data python tools/blender/sprinteurs_makehuman.py female unity/Sprinteurs/Sprinteuse
#
# Donnees reprises de MakeHuman : maillage de base, cibles de morphologie, squelette et poids — tous CC0
# (LICENSE.ASSETS.md du depot MakeHuman). Aucun code MakeHuman (AGPL) n'est repris.
# -----------------------------------------------------------------------
# Corps de sprinteur fabriqué à partir des données CC0 de MakeHuman (sans son interface), dans Blender (bpy).
#   python mh_unity.py <male|female> <sortie_prefix>
# Sortie : <prefix>.fbx pour Unity (squelette Humanoid, tenue, clip de sprint en boucle) + rendus de controle.
import bpy, sys, os, json, math
from mathutils import Vector, Matrix, Quaternion

GENRE, SORTIE = sys.argv[-2], sys.argv[-1]
D = os.environ.get('MH_DATA', 'makehuman/makehuman/data')   # git clone --depth 1 https://github.com/makehumancommunity/makehuman
ECH = 0.1                                   # decimetres -> metres

# ---------- 1. base.obj ----------
V, VT, FACES, GROUPE = [], [], [], None
for l in open(f'{D}/3dobjs/base.obj'):
    if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
    elif l.startswith('vt '): VT.append([float(x) for x in l.split()[1:3]])
    elif l.startswith('g '): GROUPE = l.split()[1]
    elif l.startswith('f ') and GROUPE == 'body':
        FACES.append([tuple(int(i) - 1 for i in p.split('/')[:2]) for p in l.split()[1:]])
N = len(V)

# ---------- 2. cibles de morphologie ----------
def appliquer_cible(chemin, poids):
    if poids == 0 or not os.path.exists(chemin): return 0
    n = 0
    for l in open(chemin):
        if l.startswith('#') or not l.strip(): continue
        a = l.split()
        i = int(a[0]); V[i][0] += float(a[1]) * poids; V[i][1] += float(a[2]) * poids; V[i][2] += float(a[3]) * poids; n += 1
    return n

def macro(genre_m, age, muscle, poids, taille, ethn=(1/3, 1/3, 1/3), prop=0.5):
    g = {'male': genre_m, 'female': 1 - genre_m}
    # age (comme human.py _setAgeVals)
    if age < 0.5:
        old = 0.0; baby = max(0.0, 1 - age * 5.333); young = max(0.0, (age - 0.1875) * 3.2); child = max(0.0, min(1.0, 5.333 * age) - young)
    else:
        child = baby = 0.0; old = max(0.0, age * 2 - 1); young = 1 - old
    A = {'baby': baby, 'child': child, 'young': young, 'old': old}
    mx = max(0.0, muscle * 2 - 1); mn = max(0.0, 1 - muscle * 2); M = {'maxmuscle': mx, 'minmuscle': mn, 'averagemuscle': 1 - mx - mn}
    wx = max(0.0, poids * 2 - 1); wn = max(0.0, 1 - poids * 2); W = {'maxweight': wx, 'minweight': wn, 'averageweight': 1 - wx - wn}
    hx = max(0.0, taille * 2 - 1); hn = max(0.0, 1 - taille * 2); H = {'maxheight': hx, 'minheight': hn}
    px = max(0.0, prop * 2 - 1); pn = max(0.0, 1 - prop * 2); P = {'idealproportions': px, 'uncommonproportions': pn}
    R = dict(zip(('african', 'asian', 'caucasian'), ethn))
    t = f'{D}/targets/macrodetails'
    for r, rv in R.items():
        for gn, gv in g.items():
            for an, av in A.items():
                appliquer_cible(f'{t}/{r}-{gn}-{an}.target', rv * gv * av)
    for gn, gv in g.items():
        for an, av in A.items():
            for mn_, mv in M.items():
                for wn_, wv in W.items():
                    w = gv * av * mv * wv
                    appliquer_cible(f'{t}/universal-{gn}-{an}-{mn_}-{wn_}.target', w)
                    for hn_, hv in H.items():
                        appliquer_cible(f'{t}/height/{gn}-{an}-{mn_}-{wn_}-{hn_}.target', w * hv)
                    for pn_, pv in P.items():
                        appliquer_cible(f'{t}/proportions/{gn}-{an}-{mn_}-{wn_}-{pn_}.target', w * pv)

def detail(groupe, nom, valeur):
    suf = 'incr' if valeur > 0 else 'decr'
    return appliquer_cible(f'{D}/targets/{groupe}/{nom}-{suf}.target', abs(valeur))

male = GENRE == 'male'
# SPRINTEUR : jeune adulte, muscle marque, peu de graisse, grand
macro(1.0 if male else 0.0, 0.5, 1.0 if male else 0.9, 0.45, 0.62 if male else 0.55)
detail('torso', 'torso-vshape', 0.8 if male else 0.3)
detail('torso', 'torso-scale-horiz', -0.15 if male else -0.1)
detail('torso', 'torso-muscle-dorsi', 0.9); detail('torso', 'torso-muscle-pectoral', 0.0 if not male else 0.6)
detail('stomach', 'stomach-pregnant', -0.8); detail('stomach', 'stomach-tone', 1.0) if False else None
detail('hip', 'hip-scale-horiz', -0.25 if male else 0.0)
detail('hip', 'hip-waist', 0.0)
detail('buttocks', 'buttocks-volume', 0.3)
# brassiere / debardeur moulant : le relief des tetons ne doit pas se voir sous la tenue
detail('breast', 'nipple-size', -1.0); detail('breast', 'nipple-point', -1.0)
detail('breast', 'breast-point', -0.6)   # la brassiere comprime
if not male:
    _mu, _po = 0.9, 0.45
    _M = {'maxmuscle': max(0, _mu*2-1), 'minmuscle': max(0, 1-_mu*2)}; _M['averagemuscle'] = 1 - sum(_M.values())
    _W = {'maxweight': max(0, _po*2-1), 'minweight': max(0, 1-_po*2)}; _W['averageweight'] = 1 - sum(_W.values())
    for _m, _mv in _M.items():
        for _w, _wv in _W.items():
            appliquer_cible(f'{D}/targets/breast/female-young-{_m}-{_w}-mincup-averagefirmness.target', _mv * _wv * 0.7)
for c in ('l', 'r'):
    detail('armslegs', f'{c}-upperleg-muscle', 1.0); detail('armslegs', f'{c}-lowerleg-muscle', 1.0)
    detail('armslegs', f'{c}-upperleg-fat', -0.8); detail('armslegs', f'{c}-lowerleg-fat', -0.8)
    detail('armslegs', f'{c}-upperarm-fat', -0.8); detail('armslegs', f'{c}-lowerarm-fat', -0.8)
    detail('armslegs', f'{c}-upperarm-muscle', 0.9); detail('armslegs', f'{c}-upperarm-shoulder-muscle', 1.0)
    detail('armslegs', f'{c}-lowerarm-muscle', 0.8)
detail('armslegs', 'lowerlegs-height', 0.3); detail('armslegs', 'upperlegs-height', 0.3)

# ---------- 2b. lissage local de la pointe des seins (le haut est moulant : aucun relief de teton) ----------
_sk0 = json.load(open(f'{D}/rigs/default.mhskel'))
voisins = {}
for f in FACES:
    ids = [v for v, _ in f]
    for k in range(len(ids)):
        a_, b_ = ids[k], ids[(k + 1) % len(ids)]
        voisins.setdefault(a_, set()).add(b_); voisins.setdefault(b_, set()).add(a_)
import numpy as np
for cote in (('L', 'R') if GENRE == 'female' else ()):
    repere = V[_sk0['joints'][f'breast.{cote}____tail'][0]]
    proches = [i for i in voisins if sum((V[i][k] - repere[k]) ** 2 for k in range(3)) < 1.5 ** 2]
    pointe = max(proches, key=lambda i: V[i][2])          # le sommet le plus en avant (z MakeHuman = devant)
    P = V[pointe]
    def r2(i): return (V[i][0] - P[0]) ** 2 + (V[i][1] - P[1]) ** 2
    RI, RA = (0.45, 0.85) if not male else (0.22, 0.45)
    dedans = [i for i in voisins if r2(i) < RI ** 2 and V[i][2] > P[2] - 0.7]
    anneau = [i for i in voisins if RI ** 2 <= r2(i) < RA ** 2 and V[i][2] > P[2] - 0.9]
    # hauteur (vers l'avant) = surface quadratique ajustee sur l'anneau : un dome lisse, sans pointe
    A = np.array([[1, V[i][0] - P[0], V[i][1] - P[1], (V[i][0] - P[0]) ** 2, (V[i][0] - P[0]) * (V[i][1] - P[1]), (V[i][1] - P[1]) ** 2] for i in anneau])
    zc, *_ = np.linalg.lstsq(A, np.array([V[i][2] for i in anneau]), rcond=None)
    avant_max = max(V[i][2] for i in dedans)
    for i in dedans:
        x, y = V[i][0] - P[0], V[i][1] - P[1]
        V[i][2] = min(V[i][2], float(zc @ np.array([1, x, y, x * x, x * y, y * y])))
    # raccord doux
    zone = dedans + anneau
    for _ in range(8):
        nv = {i: [sum(V[j][k] for j in voisins[i]) / len(voisins[i]) for k in range(3)] for i in zone}
        for i in zone:
            w = 0.35 if i in dedans else 0.15
            V[i] = [V[i][k] * (1 - w) + nv[i][k] * w for k in range(3)]
    print('poitrine', cote, ': pointe abaissee de %.1f mm' % ((avant_max - max(V[i][2] for i in dedans)) * 100))

# ---------- 3. maillage Blender ----------
def monde(p):   # MakeHuman (x droite, y haut, z devant, dm) -> Blender (x, -z, y), m
    return Vector((p[0] * ECH, -p[2] * ECH, p[1] * ECH))
bpy.ops.wm.read_factory_settings(use_empty=True)
utilises = sorted({v for f in FACES for v, _ in f}); remap = {v: i for i, v in enumerate(utilises)}
me = bpy.data.meshes.new('Corps')
me.from_pydata([monde(V[v]) for v in utilises], [], [[remap[v] for v, _ in f] for f in FACES])
me.update()
uv = me.uv_layers.new(name='UV'); k = 0
for f in FACES:
    for _, t in f: uv.data[k].uv = VT[t]; k += 1
corps = bpy.data.objects.new('Corps', me); bpy.context.scene.collection.objects.link(corps)
for p in me.polygons: p.use_smooth = True
hauteur = max(v.co.z for v in me.vertices) - min(v.co.z for v in me.vertices)
print('hauteur du corps: %.2f m, sommets %d' % (hauteur, len(me.vertices)))

# ---------- 4. squelette HUMANOID (noms de l'avatar Unity) et poids ----------
import bmesh
from mathutils.bvhtree import BVHTree
sk = json.load(open(f'{D}/rigs/default.mhskel')); mhw = json.load(open(f'{D}/rigs/default_weights.mhw'))
def joint(nom):
    idx = sk['joints'][nom]; s_ = Vector()
    for i in idx: s_ += monde(V[i])
    return s_ / len(idx)
def H(b): return joint(sk['bones'][b]['head'])
def T(b): return joint(sk['bones'][b]['tail'])
COTES = {'L': 'Left', 'R': 'Right'}
DOIGTS = {1: 'Thumb', 2: 'Index', 3: 'Middle', 4: 'Ring', 5: 'Pinky'}
HMAP = {'root': 'Hips', 'spine05': 'Hips', 'spine04': 'Spine', 'spine03': 'Spine', 'spine02': 'Chest', 'spine01': 'UpperChest',
        'neck01': 'Neck', 'neck02': 'Neck', 'neck03': 'Neck', 'head': 'Head'}
for c, n in COTES.items():
    HMAP.update({f'clavicle.{c}': n + 'Shoulder', f'shoulder01.{c}': n + 'Shoulder',
                 f'upperarm01.{c}': n + 'UpperArm', f'upperarm02.{c}': n + 'UpperArm',
                 f'lowerarm01.{c}': n + 'LowerArm', f'lowerarm02.{c}': n + 'LowerArm', f'wrist.{c}': n + 'Hand',
                 f'upperleg01.{c}': n + 'UpperLeg', f'upperleg02.{c}': n + 'UpperLeg',
                 f'lowerleg01.{c}': n + 'LowerLeg', f'lowerleg02.{c}': n + 'LowerLeg', f'foot.{c}': n + 'Foot'})
    for d, dn in DOIGTS.items():
        for i in (1, 2, 3): HMAP[f'finger{d}-{i}.{c}'] = f'{n}Hand{dn}{i}'
    for t in range(1, 6):
        for i in (1, 2, 3): HMAP[f'toe{t}-{i}.{c}'] = n + 'Toes'
def hnom(b):
    while b and b not in HMAP: b = sk['bones'][b]['parent']
    return HMAP.get(b, 'Head')
# geometrie des os : (tete, queue, parent)
OS = {'Hips': (H('spine05'), T('spine05'), None), 'Spine': (H('spine04'), T('spine03'), 'Hips'),
      'Chest': (H('spine02'), T('spine02'), 'Spine'), 'UpperChest': (H('spine01'), T('spine01'), 'Chest'),
      'Neck': (H('neck01'), T('neck03'), 'UpperChest'), 'Head': (H('head'), T('head'), 'Neck')}
for c, n in COTES.items():
    OS[n + 'Shoulder'] = (H(f'clavicle.{c}'), H(f'upperarm01.{c}'), 'UpperChest')
    OS[n + 'UpperArm'] = (H(f'upperarm01.{c}'), T(f'upperarm02.{c}'), n + 'Shoulder')
    OS[n + 'LowerArm'] = (H(f'lowerarm01.{c}'), T(f'lowerarm02.{c}'), n + 'UpperArm')
    OS[n + 'Hand'] = (H(f'wrist.{c}'), T(f'wrist.{c}'), n + 'LowerArm')
    for d, dn in DOIGTS.items():
        for i in (1, 2, 3):
            OS[f'{n}Hand{dn}{i}'] = (H(f'finger{d}-{i}.{c}'), T(f'finger{d}-{i}.{c}'), f'{n}Hand' if i == 1 else f'{n}Hand{dn}{i-1}')
    OS[n + 'UpperLeg'] = (H(f'upperleg01.{c}'), T(f'upperleg02.{c}'), 'Hips')
    OS[n + 'LowerLeg'] = (H(f'lowerleg01.{c}'), T(f'lowerleg02.{c}'), n + 'UpperLeg')
    OS[n + 'Foot'] = (H(f'foot.{c}'), T(f'foot.{c}'), n + 'LowerLeg')
    pied = T(f'foot.{c}'); OS[n + 'Toes'] = (pied, T(f'toe3-3.{c}'), n + 'Foot')
print('cote gauche (.L) en x =', round(H('upperleg01.L').x, 3), '(doit etre > 0 : gauche du personnage, qui regarde vers -Y)')
arm_d = bpy.data.armatures.new('Sprinteur'); arm = bpy.data.objects.new('Sprinteur', arm_d); bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
eb = {}
for nom, (h, t, p) in OS.items():
    e = arm_d.edit_bones.new(nom); e.head = h; e.tail = t if (t - h).length > 1e-3 else h + Vector((0, 0, 0.03)); eb[nom] = e
for nom, (h, t, p) in OS.items():
    if p: eb[nom].parent = eb[p]
bpy.ops.object.mode_set(mode='OBJECT')
acc = {}
for nom, lst in mhw['weights'].items():
    cible = hnom(nom)
    for i, w in lst:
        if i in remap: acc.setdefault(remap[i], {}); acc[remap[i]][cible] = acc[remap[i]].get(cible, 0) + w
vg = {nom: corps.vertex_groups.new(name=nom) for nom in OS}
for i, d in acc.items():
    best = sorted(d.items(), key=lambda kv: -kv[1])[:4]            # 4 influences au plus (Unity)
    s_ = sum(w for _, w in best)
    for b, w in best: vg[b].add([i], w / s_, 'REPLACE')
mod = corps.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
corps.parent = arm
dom = {i: max(d.items(), key=lambda kv: kv[1])[0] for i, d in acc.items()}
print('os:', len(OS), '| sommets sans poids:', sum(1 for v in me.vertices if not v.groups))

# ---------- 4b. LES COUPES DE CHEVEUX : de vrais maillages sur le cuir chevelu, accroches a l'os Head ----------
COULEURS_CHEVEUX = {'noir': (28, 22, 22), 'brun': (56, 36, 24), 'chatain': (92, 62, 36), 'blond': (188, 154, 88), 'roux': (148, 74, 38), 'gris': (176, 176, 182)}
def srgb(c): return tuple(((x / 255) ** 2.2) for x in c)
oeil_z = H('eye.L').z
tete_v = [v for v in me.vertices if dom.get(v.index) == 'Head']
haut_tete = max(v.co.z for v in tete_v)
cy = sum(v.co.y for v in tete_v) / len(tete_v)
centre_tete = Vector((0, cy, oeil_z + 0.035))
def cuir(p):
    """> 0 sur le cuir chevelu : ligne du front, des tempes (au-dessus des oreilles) et de la nuque"""
    th = math.atan2(p.x, -(p.y - cy)); f = abs(th) / math.pi            # 0 devant, 1 derriere
    h = 0.072 - 0.19 * f + 0.048 * f * f
    oreille = abs(p.x) > 0.06 and oeil_z - 0.045 < p.z < oeil_z + 0.03 and abs(p.y - cy) < 0.035
    return (p.z - (oeil_z + h)) if not oreille else -1
def ss(a, b, x): t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
_bt = bmesh.new(); _bt.from_mesh(me); ARBRE_TETE = BVHTree.FromBMesh(_bt)
COUPES = {}
def coupe(nom, depl, lisse=0, ajouts=(), cotes_ras=None):
    ob = bpy.data.objects.new('Cheveux_' + nom, bpy.data.meshes.new('Cheveux_' + nom)); bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); bm.verts.ensure_lookup_table()
    garde = [f for f in bm.faces if all(dom.get(v.index) == 'Head' for v in f.verts) and cuir(f.calc_center_median()) > 0]
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in set(garde)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bord = [v for v in bm.verts if any(e.is_boundary for e in v.link_edges)]
    for it in range(50):
        nouv = {}
        for v in bord:
            vs = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(vs) == 2: nouv[v] = v.co * 0.3 + (vs[0].co + vs[1].co) * 0.35
        for v, c in nouv.items(): v.co = ARBRE_TETE.find_nearest(c)[0] if it % 4 == 3 else c
    for v in bord: v.co = ARBRE_TETE.find_nearest(v.co)[0]
    for _ in range(4):
        for v in {e.other_vert(b) for b in bord for e in b.link_edges} - set(bord):
            m2 = sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges)
            v.co = ARBRE_TETE.find_nearest(v.co * 0.5 + m2 * 0.5)[0]
    if cotes_ras is not None:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, cotes_ras), plane_no=(0, 0, 1))
    bm.normal_update()
    # la ligne de cheveux s'amincit sur 3 rangs (pas de marche au bord)
    rang = {v: 0 for v in bm.verts if any(e.is_boundary for e in v.link_edges)}
    front = list(rang)
    for r in (1, 2, 3):
        nv = []
        for v in front:
            for e in v.link_edges:
                u = e.other_vert(v)
                if u not in rang: rang[u] = r; nv.append(u)
        front = nv
    base = {v: (v.co.copy(), v.normal.copy()) for v in bm.verts}
    bm.faces.index_update(); zrepos = {f.index: f.calc_center_median().z for f in bm.faces}
    for v in bm.verts:
        p, n = base[v]; k = (rang.get(v, 4) + 1) / 5
        v.co = p + depl(p, n) * k + n * 0.0025
    for _ in range(lisse):
        nouv = {v: sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges) for v in bm.verts if v not in rang}
        for v, c in nouv.items(): v.co = v.co * 0.5 + c * 0.5
    bm.to_mesh(ob.data); bm.free()
    for (forme, args) in ajouts:                                   # chignon, queue : des volumes en plus
        b2 = bmesh.new()
        if forme == 'boule':
            ctr, r = args; bmesh.ops.create_uvsphere(b2, u_segments=16, v_segments=10, radius=r)
            bmesh.ops.translate(b2, vec=ctr, verts=b2.verts)
        elif forme == 'chapelet':                                  # une meche : des boules qui se chevauchent le long d'un chemin
            pts_, r1, r2 = args; n_ = 30
            for i in range(n_):
                t = i / (n_ - 1); seg = t * (len(pts_) - 1); j = min(int(seg), len(pts_) - 2); u = seg - j
                c = pts_[j].lerp(pts_[j + 1], u); r = r1 + (r2 - r1) * t
                tmpb = bmesh.new(); bmesh.ops.create_uvsphere(tmpb, u_segments=12, v_segments=8, radius=r)
                bmesh.ops.translate(tmpb, vec=c, verts=tmpb.verts)
                mm = bpy.data.meshes.new('t'); tmpb.to_mesh(mm); tmpb.free(); b2.from_mesh(mm); bpy.data.meshes.remove(mm)
        else:
            a_, b_, r1, r2 = args
            ret = bmesh.ops.create_cone(b2, cap_ends=True, segments=12, radius1=r1, radius2=r2, depth=(b_ - a_).length)
            q = Vector((0, 0, 1)).rotation_difference((b_ - a_).normalized())
            bmesh.ops.rotate(b2, cent=Vector(), matrix=q.to_matrix(), verts=b2.verts)
            bmesh.ops.translate(b2, vec=(a_ + b_) / 2, verts=b2.verts)
        tmp = bpy.data.meshes.new('tmp'); b2.to_mesh(tmp); b2.free()
        o2 = bpy.data.objects.new('tmp', tmp); bpy.context.scene.collection.objects.link(o2)
        for o in bpy.context.scene.objects: o.select_set(False)
        ob.select_set(True); o2.select_set(True); bpy.context.view_layer.objects.active = ob; bpy.ops.object.join()
    for p in ob.data.polygons: p.use_smooth = True
    g = ob.vertex_groups.new(name='Head'); g.add([v.index for v in ob.data.vertices], 1.0, 'REPLACE')
    m_ = ob.modifiers.new('Armature', 'ARMATURE'); m_.object = arm; ob.parent = arm
    mat_ = bpy.data.materials.new('M_Cheveux_' + nom); mat_.diffuse_color = (*srgb(COULEURS_CHEVEUX['noir']), 1); mat_.roughness = 0.85
    ob.data.materials.append(mat_)
    if cotes_ras is not None or nom == 'Rase':
        ras = bpy.data.materials.new('M_Cheveux_' + nom + '_Ras'); ras.roughness = 0.95; ob.data.materials.append(ras)
        ras.diffuse_color = (*srgb(tuple(a * 0.55 + b * 0.45 for a, b in zip(COULEURS_CHEVEUX['noir'], (120, 76, 50)))), 1)
        for p in ob.data.polygons:
            if nom == 'Rase' or zrepos.get(p.index, 9) < cotes_ras - 1e-4: p.material_index = 1
    COUPES[nom] = ob
    print('coupe', nom, ':', len(ob.data.polygons), 'faces')
haut_z = haut_tete
dos = Vector((0, 1.0, 0))      # le dos est vers +Y (le personnage regarde vers -Y)
if male:
    coupe('Rase', lambda p, n: n * 0.0012)
    coupe('Degrade', lambda p, n: n * (0.0012 + 0.017 * ss(oeil_z + 0.035, oeil_z + 0.075, p.z)), lisse=4, cotes_ras=oeil_z + 0.04)
    coupe('Court', lambda p, n: n * (0.005 + 0.007 * ss(oeil_z + 0.02, oeil_z + 0.1, p.z)), lisse=4)
    zf = haut_z + 0.02
    coupe('FlatTop', lambda p, n: n * (0.0012 + 0.012 * ss(oeil_z + 0.035, oeil_z + 0.07, p.z))
          + Vector((0, 0, 1)) * (ss(haut_z - 0.035, haut_z - 0.015, p.z) * max(0.0, zf - p.z)), lisse=3, cotes_ras=oeil_z + 0.035)
    ca = centre_tete + Vector((0, 0.01, 0.025))
    R_ = max((v.co - ca).length for v in tete_v if cuir(v.co) > 0) + 0.025
    coupe('Afro', lambda p, n: (p - ca).normalized() * max(0.0, R_ - (p - ca).length) * ss(0.0, 0.06, cuir(p)) + n * 0.01, lisse=12)
else:
    serre = lambda p, n: n * (0.004 + 0.007 * ss(oeil_z + 0.02, oeil_z + 0.11, p.z))
    attache = centre_tete + dos * 0.10 + Vector((0, 0, 0.02))
    coupe('Chignon', serre, lisse=3, ajouts=[('boule', (centre_tete + dos * 0.105 + Vector((0, 0, 0.055)), 0.04))])
    coupe('Queue', serre, lisse=3, ajouts=[('boule', (attache, 0.02)),
          ('chapelet', ([attache + dos * 0.02, attache + dos * 0.06 + Vector((0, 0, -0.06)), attache + dos * 0.06 + Vector((0, 0, -0.17)), attache + dos * 0.04 + Vector((0, 0, -0.27))], 0.03, 0.012))])
    coupe('Tresses', lambda p, n: n * (0.004 + 0.008 * max(0.0, math.sin(p.x * 2 * math.pi / 0.03)) ** 0.6),
          ajouts=[('chapelet', ([centre_tete + dos * 0.09 + Vector((s_ * 0.035, 0, 0.0)), centre_tete + dos * 0.10 + Vector((s_ * 0.045, 0, -0.12)),
                                 centre_tete + dos * 0.08 + Vector((s_ * 0.05, 0, -0.25))], 0.014, 0.009)) for s_ in (-1, 1)])
    coupe('Court', lambda p, n: n * (0.005 + 0.007 * ss(oeil_z + 0.02, oeil_z + 0.1, p.z)), lisse=4)

# ---------- 5. LA TENUE : de vrais vetements (maillages a part), pas de la peinture ----------
def matiere(nom, rgb, rugo=0.7):
    m = bpy.data.materials.new(nom); m.diffuse_color = (*rgb, 1); m.roughness = rugo; return m
PEAU = matiere('M_Peau', srgb((120, 76, 50)), 0.55)
HAUT = matiere('M_Haut', (0.97, 0.76, 0.10), 0.8)
BAS = matiere('M_Bas', (0.07, 0.10, 0.32), 0.45)
corps.data.materials.append(PEAU)
AV = -1.0                                   # le personnage regarde vers -Y
def devant(p): return p.y * AV > 0
hanche = H('upperleg01.L').z; genou = H('lowerleg01.L').z; cou = H('neck01').z
epx, epz = abs(H('upperarm01.L').x), H('upperarm01.L').z
sein_z = T('breast.L').z
BRAS = ('UpperArm', 'LowerArm', 'Hand')
def face_bras(f): return sum(1 for v in f.verts if any(k in dom.get(v.index, '') for k in BRAS)) * 2 > len(f.verts)
def region_haut(p, f):
    """> 0 dans le debardeur (homme) ou la brassiere (femme), en metres environ"""
    x = abs(p.x); av = devant(p)
    if male:
        bas_ = p.z - (hanche + 0.06)
        col = (cou - 0.075 + 3.0 * x * x if av else cou - 0.03 + 2.0 * x * x) - p.z
        rx = 0.072 if av else 0.11
    else:
        bas_ = p.z - (sein_z - 0.075)
        # col en U (profond au milieu, il remonte vite : il laisse des bretelles de 3 cm) ; dos nageur
        col = (cou - 0.11 + 22.0 * x * x if av else cou - 0.085 + 22.0 * x * x) - p.z
        rx = 0.06
    # EMMANCHURE : un ovale qui s'arrete a l'aisselle (en dessous, les cotes du vetement restent)
    aisselle = epz - (0.115 if male else 0.10)
    rz = 0.11; cx, cz = epx - 0.004, aisselle + rz
    e = math.sqrt(((x - cx) / rx) ** 2 + ((p.z - cz) / rz) ** 2)
    emman = (e - 1) * 0.05 if (x < cx or p.z < aisselle) else -0.05
    if p.z < aisselle: emman = 1
    return min(bas_, col, emman, -1 if face_bras(f) else 1)
HEM_HAUT = (hanche + 0.06) if male else (sein_z - 0.075)
TAILLE = hanche + (0.09 if male else 0.10)
CUISSE = genou + (0.55 if male else 0.62) * (hanche - genou)
def region_haut_c(p, f):
    return region_haut(Vector((p.x, p.y, max(p.z, HEM_HAUT + 0.05))), f)   # le bas se coupe au plan
def region_bas_c(p, f):
    return -1 if face_bras(f) else 1
def region_bas(p, f):
    taille = hanche + (0.12 if male else 0.10)
    cuisse = genou + (0.55 if male else 0.62) * (hanche - genou)
    return min(taille - p.z, p.z - cuisse, -1 if face_bras(f) else 1)
arbre_corps = None
def vetement(nom, region, plans, decalage, mat_, gonfle, lisse):
    global arbre_corps, bmc, dl_c
    ob = corps.copy(); ob.data = corps.data.copy(); ob.name = nom; bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.clear(); ob.data.materials.append(mat_)
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.faces.ensure_lookup_table()
    def dans_plans(z, marge):
        return all((z > z0 - marge) if dessus else (z < z0 + marge) for z0, dessus in plans)
    garder = {f for f in bm.faces if region(f.calc_center_median(), f) > 0 and dans_plans(f.calc_center_median().z, 0.03)}
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in garder], context='FACES')
    # LES COUPES DROITES (taille, cuisses, bas du haut) : au plan, exactes
    for z0, dessus in plans:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, z0), plane_no=(0, 0, 1))
        hors = [v for v in bm.verts if (v.co.z < z0 - 1e-5 if dessus else v.co.z > z0 + 1e-5)]
        bmesh.ops.delete(bm, geom=hors, context='VERTS')
    # on ne garde que les grands morceaux (pas d'ilots perdus)
    vus, morceaux = set(), []
    for f in bm.faces:
        if f in vus: continue
        pile, m_ = [f], []
        while pile:
            g = pile.pop()
            if g in vus: continue
            vus.add(g); m_.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in vus: pile.append(h)
        morceaux.append(m_)
    for m_ in morceaux:
        if len(m_) < 60: bmesh.ops.delete(bm, geom=m_, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # bords nets : chaque ourlet est detendu le long de lui-meme puis recolle sur la peau
    if arbre_corps is None:
        bmc = bmesh.new(); bmc.from_mesh(corps.data); bmc.faces.ensure_lookup_table(); arbre_corps = BVHTree.FromBMesh(bmc)
        globals()['bmc'] = bmc; globals()['dl_c'] = bmc.verts.layers.deform.verify()
    bord_tout = [v for v in bm.verts if any(e.is_boundary for e in v.link_edges)]
    bord = [v for v in bord_tout if all(abs(v.co.z - z0) > 1e-4 for z0, _ in plans)]   # les coupes au plan restent droites
    for it in range(60):
        nouv = {}
        for v in bord:
            vs = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(vs) == 2 and v in bord: nouv[v] = v.co * 0.3 + (vs[0].co + vs[1].co) * 0.35
        for v, c in nouv.items(): v.co = arbre_corps.find_nearest(c)[0] if it % 4 == 3 else c
    for v in bord: v.co = arbre_corps.find_nearest(v.co)[0]
    # anneau suivant : on lisse pour que la toile ne se plisse pas pres de l'ourlet
    anneau = {e.other_vert(v) for v in bord for e in v.link_edges} - set(bord_tout)
    for _ in range(6):
        for v in anneau:
            m_ = sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges)
            v.co = arbre_corps.find_nearest(v.co * 0.5 + m_ * 0.5)[0]
    # le tissu decolle de la peau
    for v in bm.verts:
        loc, nrm, _, _ = arbre_corps.find_nearest(v.co); v.co = loc + nrm * decalage
    # LA TOILE TENDUE : elle passe par-dessus les creux (sillon du dos, entre les seins), sans rentrer dans les bosses
    for _ in range(gonfle):
        bm.normal_update(); nouv = {}
        for v in bm.verts:
            if v in bord_tout: continue
            m_ = sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges)
            d = m_ - v.co
            if d.dot(v.normal) > 0: nouv[v] = v.co + d * 0.6
        for v, c in nouv.items(): v.co = c
    # LA TOILE LISSE : on lisse, sans jamais laisser le tissu approcher la peau a moins de 70 % du decalage
    for _ in range(lisse):
        nouv = {}
        for v in bm.verts:
            m_ = sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges)
            c = v.co * 0.5 + m_ * 0.5 if v not in bord_tout else v.co
            loc, nrm, _, _ = arbre_corps.find_nearest(c)
            if (c - loc).dot(nrm) < decalage * 0.7: c = loc + nrm * decalage * 0.7
            nouv[v] = c
        for v, c in nouv.items(): v.co = c
    # l'epaisseur de l'ourlet : le bord se replie vers la peau
    bm.normal_update()
    bords_e = [e for e in bm.edges if e.is_boundary]
    r = bmesh.ops.extrude_edge_only(bm, edges=bords_e)
    for v in [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]:
        loc, nrm, _, _ = arbre_corps.find_nearest(v.co); v.co = loc + nrm * (decalage * 0.6)
    # LES POIDS DU TISSU = ceux de la peau juste dessous (interpoles sur la face, 4 os au plus, normalises)
    dl = bm.verts.layers.deform.verify()
    for v in bm.verts:
        loc, nrm, fi, _ = arbre_corps.find_nearest(v.co)
        f = bmc.faces[fi]; cs = [u.co for u in f.verts]
        # poids barycentriques approches : inverse de la distance aux sommets de la face
        ws = [1.0 / max((loc - c).length, 1e-5) for c in cs]; sw = sum(ws)
        tot = {}
        for u, w in zip(f.verts, ws):
            for g, x in u[dl_c].items(): tot[g] = tot.get(g, 0) + x * w / sw
        best = sorted(tot.items(), key=lambda kv: -kv[1])[:4]; s_ = sum(x for _, x in best)
        v[dl].clear()
        for g, x in best: v[dl][g] = x / s_
    bm.to_mesh(ob.data); bm.free()
    for p in ob.data.polygons: p.use_smooth = True
    print('vetement', nom, ':', len(ob.data.polygons), 'faces')
    return ob
haut = vetement('Debardeur' if male else 'Brassiere', region_haut_c, [(HEM_HAUT, True)], 0.0075 if male else 0.0055, HAUT, 30, 40)
bas = vetement('Cuissard', region_bas_c, [(TAILLE, False), (CUISSE, True)], 0.0045, BAS, 6, 12)
# ---------- 5b. LES POINTES : celles du jeu (public/modeles/pointes-*.glb, Tripo sans marque), ajustees a chaque pied ----------
REPO = os.environ.get('SPRINTER_REPO', '.')                  # la racine du depot (pour public/modeles/pointes-*.glb)
avant_import = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=f'{REPO}/public/modeles/pointes-{"homme" if male else "femme"}.glb')
importes = [o for o in bpy.data.objects if o not in avant_import]
POINTES = []
M_POINTES = None
for c, n in (('l', 'Left'), ('r', 'Right')):
    src = bpy.data.objects['pointe_' + c]
    sv = [src.matrix_world @ v.co for v in src.data.vertices]
    sx0, sx1 = min(p.x for p in sv), max(p.x for p in sv); sy0, sy1 = min(p.y for p in sv), max(p.y for p in sv); sz0 = min(p.z for p in sv)
    pied = [v.co.copy() for v in me.vertices if dom.get(v.index) in (n + 'Foot', n + 'Toes')]
    cheville = OS[n + 'Foot'][0].z
    pied = [p for p in pied if p.z < cheville + 0.01]
    # l'axe du pied : direction principale (horizontale) des sommets du pied, tournee vers l'avant (-Y)
    mx = sum(p.x for p in pied) / len(pied); my = sum(p.y for p in pied) / len(pied)
    cxx = sum((p.x - mx) ** 2 for p in pied); cyy = sum((p.y - my) ** 2 for p in pied); cxy = sum((p.x - mx) * (p.y - my) for p in pied)
    ang = 0.5 * math.atan2(2 * cxy, cxx - cyy); F = Vector((math.cos(ang), math.sin(ang), 0))
    if F.y > 0: F = -F
    L = Vector((-F.y, F.x, 0))                                 # la gauche du pied
    fu = [p.dot(F) for p in pied]; lv = [p.dot(L) for p in pied]; zmin = min(p.z for p in pied)
    fmin, fmax, lmin, lmax = min(fu), max(fu), min(lv), max(lv)
    kx = (fmax - fmin + 0.018) / (sx1 - sx0); ky = (lmax - lmin + 0.012) / (sy1 - sy0); kz = (kx + ky) / 2
    ob = src.copy(); ob.data = src.data.copy(); ob.name = 'Pointes_' + n; bpy.context.scene.collection.objects.link(ob)
    ob.parent = None; ob.matrix_world = Matrix.Identity(4)
    for v, p in zip(ob.data.vertices, sv):
        u = (p.x - sx0) * kx + fmin - 0.01
        w_ = (p.y - (sy0 + sy1) / 2) * ky + (lmin + lmax) / 2
        h = (p.z - sz0) * kz + zmin - 0.009                   # la semelle passe sous la plante
        v.co = F * u + L * w_ + Vector((0, 0, h))
    ob.data.update()
    # poids : le pied, et les orteils en avant de la tete des metatarsiens (la chaussure plie au bon endroit)
    for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)
    gp = ob.vertex_groups.new(name=n + 'Foot'); go = ob.vertex_groups.new(name=n + 'Toes')
    ub = OS[n + 'Toes'][0].dot(F)
    for v in ob.data.vertices:
        t = ss(ub - 0.015, ub + 0.02, v.co.dot(F))
        if t < 1: gp.add([v.index], 1 - t, 'REPLACE')
        if t > 0: go.add([v.index], t, 'REPLACE')
    for m_ in list(ob.modifiers): ob.modifiers.remove(m_)
    mm = ob.modifiers.new('Armature', 'ARMATURE'); mm.object = arm; ob.parent = arm
    if M_POINTES is None:
        M_POINTES = ob.data.materials[0]; M_POINTES.name = 'M_Pointes'
        os.makedirs(os.path.join(os.path.dirname(SORTIE) or '.', 'Textures'), exist_ok=True)
        for nd in M_POINTES.node_tree.nodes:
            if nd.type == 'TEX_IMAGE' and nd.image:
                nom_img = 'Pointes_' + ('BaseMap' if nd.image.name.startswith('Color') else 'Normal' if 'Normal' in nd.image.name else 'ORM') + '.png'
                chemin = os.path.join(os.path.dirname(SORTIE) or '.', 'Textures', nom_img)
                nd.image.filepath_raw = chemin; nd.image.file_format = 'PNG'; nd.image.save(); nd.image.name = nom_img[:-4]
                if nom_img.endswith('BaseMap.png'):
                    px = list(nd.image.pixels[:4096 * 4:16]); 
    ob.data.materials.clear(); ob.data.materials.append(M_POINTES)
    for p in ob.data.polygons: p.use_smooth = True
    POINTES.append(ob)
    print('pointe', n, ': pied %.3f x %.3f m, echelle %.2f / %.2f' % (fmax - fmin, lmax - lmin, kx, ky))
for o in importes:
    if o.name in bpy.data.objects and o not in POINTES: bpy.data.objects.remove(o)
# la peau cachee sous la tenue est retiree (aucune peau ne traverse le tissu en course)
bm = bmesh.new(); bm.from_mesh(corps.data); bm.faces.ensure_lookup_table()
arbres_v = []
for o in (haut, bas, *POINTES):
    b2 = bmesh.new(); b2.from_mesh(o.data); arbres_v.append(BVHTree.FromBMesh(b2))
def couverte(f):
    c = f.calc_center_median()
    if any(dom.get(v.index, '').endswith(('Foot', 'Toes')) for v in f.verts) and all(dom.get(v.index, '').endswith(('Foot', 'Toes', 'LowerLeg')) for v in f.verts):
        if c.z < min(OS['LeftFoot'][0].z, OS['RightFoot'][0].z) - 0.004: return True
    if max(region_haut(c, f), region_bas(c, f)) <= 0.006: return False
    return any(t.find_nearest(c)[3] is not None and t.find_nearest(c)[3] < 0.012 for t in arbres_v)
cache = [f for f in bm.faces if couverte(f)]
# la peau qui reste sous le bord du vetement s'enfonce un peu : elle ne perce plus le tissu en course
sous_bord = set()
for f in bm.faces:
    c = f.calc_center_median()
    if max(region_haut(c, f), region_bas(c, f)) > -0.004 and f not in cache: sous_bord.update(f.verts)
bm.normal_update()
for v in sous_bord: v.co -= v.normal * 0.0025
bmesh.ops.delete(bm, geom=cache, context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(corps.data); bm.free()
# UN SEUL MAILLAGE (un SkinnedMeshRenderer dans Unity), trois matieres
for o in bpy.context.scene.objects: o.select_set(False)
corps.select_set(True); haut.select_set(True); bas.select_set(True)
for o in POINTES: o.select_set(True)
bpy.context.view_layer.objects.active = corps; bpy.ops.object.join()
corps.name = 'Sprinteur_Corps' if male else 'Sprinteuse_Corps'
for o in list(bpy.context.scene.objects):
    if o.type == 'MESH' and o is not corps and o not in COUPES.values(): bpy.data.objects.remove(o)
me = corps.data
print('maillage final :', len(me.vertices), 'sommets,', len(me.polygons), 'faces, matieres', [m.name for m in me.materials if m],
      '| sans poids:', sum(1 for v in me.vertices if not v.groups))

# ---------- 6. LE CLIP DE SPRINT (boucle de 16 images, 30 i/s) ----------
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
pb = arm.pose.bones
def pts():
    m_ = corps.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh(); return [corps.matrix_world @ v.co for v in m_.vertices]
def tete(n): return arm.matrix_world @ pb[n].head
def queue(n): return arm.matrix_world @ pb[n].tail
def remise():
    for b in pb: b.rotation_mode = 'QUATERNION'; b.rotation_quaternion = (1, 0, 0, 0); b.location = (0, 0, 0)
    bpy.context.view_layer.update()
def tourner(nom, axe, angle):
    b = pb[nom]; R = Quaternion(axe.normalized(), angle).to_matrix().to_4x4(); T_ = Matrix.Translation(tete(nom))
    b.matrix = arm.matrix_world.inverted() @ (T_ @ R @ T_.inverted() @ (arm.matrix_world @ b.matrix)); bpy.context.view_layer.update()
def deplacer(nom, dv):
    b = pb[nom]; b.matrix = arm.matrix_world.inverted() @ (Matrix.Translation(dv) @ (arm.matrix_world @ b.matrix)); bpy.context.view_layer.update()
remise()
Lat = (tete('LeftUpperLeg') - tete('RightUpperLeg')).normalized()
Av = Vector((0, AV, 0))
# test : chaque os deforme-t-il le maillage ?
base = pts(); sans_effet = []
for b in pb:
    remise(); tourner(b.name, Vector((1, 0, 0)), 0.6); a1 = sum(1 for x, y in zip(base, pts()) if (x - y).length > 0.003)
    if a1 == 0:
        remise(); tourner(b.name, Vector((0, 0, 1)), 0.6); a1 = sum(1 for x, y in zip(base, pts()) if (x - y).length > 0.003)
    if a1 == 0: sans_effet.append(b.name)
remise(); print('OS TESTES:', len(pb), '| sans effet:', sans_effet)
def axes_os(nom):
    M = (arm.matrix_world @ pb[nom].matrix).to_3x3(); return [M.col[0], M.col[1], M.col[2]]
def appliquer(nom, mesure, angle):
    best = None; m0 = mesure()
    for ax in axes_os(nom):
        for sg in (1, -1):
            tourner(nom, ax, sg * 0.3); m1 = mesure(); tourner(nom, ax, -sg * 0.3)
            if best is None or m0 - m1 > best[0]: best = (m0 - m1, ax.copy(), sg)
    tourner(nom, best[1], best[2] * angle)
def sag(nom, angle, point, sens, sur_queue=False):
    pos = (lambda: queue(point)) if sur_queue else (lambda: tete(point))
    d0 = (pos() - tete(nom)).dot(Av); tourner(nom, Lat, 0.05); d1 = (pos() - tete(nom)).dot(Av); tourner(nom, Lat, -0.05)
    tourner(nom, Lat, (1 if (d1 > d0) == (sens > 0) else -1) * angle)
def releve(nom, angle, haut_=True):
    z0 = queue(nom).z; tourner(nom, Lat, 0.05); z1 = queue(nom).z; tourner(nom, Lat, -0.05)
    tourner(nom, Lat, (1 if (z1 > z0) == haut_ else -1) * angle)
# charniere du coude, prise au repos
CHARN = {}
for n in ('Left', 'Right'):
    lo, ha = n + 'LowerArm', n + 'Hand'
    u = (tete(ha) - tete(lo)).normalized(); ax = u.cross(Av).normalized()
    h0 = (tete(ha) - tete(lo)).dot(Av); tourner(lo, ax, 0.2); h1 = (tete(ha) - tete(lo)).dot(Av); tourner(lo, ax, -0.2)
    if h1 < h0: ax = -ax
    CHARN[n] = (arm.matrix_world @ pb[lo].parent.matrix).to_3x3().inverted() @ ax
JAMBE = {'genou_haut': (+1.35, 1.50, 0.25, True), 'poussee': (-0.42, 0.15, 0.65, False),
         'appui': (-0.05, 0.30, 0.05, True), 'retour': (+0.65, 2.05, 0.15, True)}
BRAS_ = {'avant': (0.18, 0.60, 1.40), 'arriere': (-0.25, -0.95, 1.15), 'milieu': (0.0, 0.0, 1.45)}
def jambe(n, role):
    cuisse, gen, chev, haut_ = JAMBE[role]
    sag(n + 'UpperLeg', abs(cuisse), n + 'LowerLeg', 1 if cuisse > 0 else -1)
    sag(n + 'LowerLeg', gen, n + 'Foot', -1)
    releve(n + 'Foot', chev, haut_)
def bras(n, role):
    sh, up, lo, ha = n + 'Shoulder', n + 'UpperArm', n + 'LowerArm', n + 'Hand'
    appliquer(sh, lambda: tete(lo).z, 0.3)
    for _ in range(14):
        if (tete(lo) - tete(up)).normalized().z < -0.95: break
        appliquer(up, lambda: tete(lo).z, 0.12)
    a_sh, a_up, coude = BRAS_[role]
    for nom, a in ((sh, a_sh), (up, a_up)):
        if a: sag(nom, abs(a), lo, 1 if a > 0 else -1)
    tourner(lo, (arm.matrix_world @ pb[lo].parent.matrix).to_3x3() @ CHARN[n], coude)
def poing(n):
    w = tete(n + 'Hand')
    nrm = (tete(n + 'HandIndex1') - w).cross(tete(n + 'HandPinky1') - tete(n + 'HandIndex1')).normalized()
    for nom, ang in ((n + 'HandThumb1', 0.35), (n + 'HandThumb2', 0.35), (n + 'HandThumb3', 0.3)):
        appliquer(nom, lambda: (queue(n + 'HandThumb3') - tete(n + 'HandIndex2')).length, ang)
    for dn in ('Index', 'Middle', 'Ring', 'Pinky'):
        for i, ang in ((1, 0.8), (2, 1.0), (3, 0.7)):
            nom = f'{n}Hand{dn}{i}'; bout = f'{n}Hand{dn}3'
            ax = (queue(nom) - tete(nom)).normalized().cross(nrm)
            d0 = (queue(bout) - w).length; tourner(nom, ax, 0.2); d1 = (queue(bout) - w).length; tourner(nom, ax, -0.2)
            tourner(nom, ax, ang if d1 < d0 else -ang)
def pose(jg, jd, bg, bd, envol):
    remise()
    sag('Hips', 0.2, 'Head', +1)                          # la ligne du sprinteur
    for nom, a in (('Spine', 0.12), ('Chest', 0.09), ('UpperChest', 0.07)): sag(nom, a, 'Head', +1)
    sag('Neck', 0.12, 'Head', -1)                          # regard devant
    jambe('Left', jg); jambe('Right', jd)
    milieu = (tete('LeftUpperLeg') + tete('RightUpperLeg')) / 2
    for n in ('Left', 'Right'):                            # appuis sous le corps
        cible = (tete(n + 'UpperLeg') - milieu).dot(Lat) * 0.3; best = (1e9, 0)
        for k in range(-15, 16):
            a = k * 0.02; tourner(n + 'UpperLeg', Av, a); e = abs((tete(n + 'Foot') - milieu).dot(Lat) - cible); tourner(n + 'UpperLeg', Av, -a)
            if e < best[0]: best = (e, a)
        tourner(n + 'UpperLeg', Av, best[1])
    bras('Left', bg); bras('Right', bd); poing('Left'); poing('Right')
    z = min(v.z for v in pts()); deplacer('Hips', Vector((0, 0, -z + envol)))
    return {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in pb}
CLES = [(0, ('genou_haut', 'poussee', 'arriere', 'avant', 0.05)), (4, ('appui', 'retour', 'milieu', 'milieu', 0.0)),
        (8, ('poussee', 'genou_haut', 'avant', 'arriere', 0.05)), (12, ('retour', 'appui', 'milieu', 'milieu', 0.0))]
poses = {f: pose(*args) for f, args in CLES}; poses[16] = poses[0]
arm.animation_data_create(); act = bpy.data.actions.new('Sprint'); arm.animation_data.action = act
for f, P_ in sorted(poses.items()):
    for b in pb:
        q, l = P_[b.name]; b.rotation_quaternion = q; b.location = l
        b.keyframe_insert('rotation_quaternion', frame=f); b.keyframe_insert('location', frame=f)
sc = bpy.context.scene; sc.frame_start, sc.frame_end = 0, 15; sc.render.fps = 30
bpy.ops.object.mode_set(mode='OBJECT')

def sync_couleurs():
    """la couleur affichee (diffuse_color) devient la Base Color du Principled BSDF : c'est elle que lit l'export FBX, donc Unity"""
    for m in bpy.data.materials:
        if m.name.startswith('M_Pointes') or not m.use_nodes: 
            if not m.use_nodes and not m.name.startswith('M_Pointes'):
                m.use_nodes = True
            else: continue
        for nd in m.node_tree.nodes:
            if nd.type == 'BSDF_PRINCIPLED':
                nd.inputs['Base Color'].default_value = m.diffuse_color; nd.inputs['Roughness'].default_value = m.roughness
sync_couleurs()
# ---------- 7. EXPORT UNITY (memes reglages qu'Aurel : tools/blender/aurel_unity.py) ----------
def activer(*obs):
    for o in bpy.context.scene.objects: o.select_set(False)
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
TOUT = (arm, corps, *COUPES.values())
activer(*TOUT); bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
arm.rotation_euler = (-math.pi / 2, 0, 0); activer(*TOUT); bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
arm.rotation_euler = (math.pi / 2, 0, 0); activer(*TOUT)
bpy.ops.export_scene.fbx(filepath=SORTIE + '.fbx', use_selection=True, object_types={'ARMATURE', 'MESH'},
    apply_unit_scale=True, apply_scale_options='FBX_SCALE_ALL', axis_forward='-Z', axis_up='Y', bake_space_transform=False,
    use_mesh_modifiers=False, mesh_smooth_type='FACE', use_tspace=False, add_leaf_bones=False, use_armature_deform_only=True,
    primary_bone_axis='Y', secondary_bone_axis='X', armature_nodetype='NULL', bake_anim=True,
    bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False, bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0.0, path_mode='RELATIVE', embed_textures=False)
activer(*TOUT); bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
print('fbx ecrit:', os.path.getsize(SORTIE + '.fbx') // 1024, 'Ko')

for i, o in enumerate(COUPES.values()): o.hide_render = i != 0
# ---------- 8. RENDUS : le cycle en images, et la tenue de pres ----------
sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
sc.display.shading.show_cavity = True
sc.world = bpy.data.worlds.new('w'); sc.world.color = (0.80, 0.89, 0.95)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'
def viser(centre, direction, echelle, res):
    cam.data.ortho_scale = echelle; sc.render.resolution_x, sc.render.resolution_y = res
    cam.location = centre + direction * 6
    cam.rotation_euler = (centre - cam.location).normalized().to_track_quat('-Z', 'Y').to_euler()
os.makedirs(SORTIE + '_images', exist_ok=True)
for f in range(16):
    sc.frame_set(f)
    for nom, d in (('cote', Lat), ('trois_quarts', (Lat * 0.8 + Av * 0.7).normalized())):
        viser(Vector((0, 0, 0.95)), d, 2.3, (460, 600)); sc.render.filepath = f'{SORTIE}_images/{nom}_{f:02d}.png'
        bpy.ops.render.render(write_still=True)
act_ = arm.animation_data.action; arm.animation_data.action = None
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE'); remise(); bpy.ops.object.mode_set(mode='OBJECT')
for nom, d in (('repos_face', Av), ('repos_dos', -Av)):
    viser(Vector((0, 0, 1.0)), d, 2.1, (600, 700)); sc.render.filepath = f'{SORTIE}_images/{nom}.png'; bpy.ops.render.render(write_still=True)
arm.animation_data.action = act_
sc.frame_set(0)
for nom, d, ctr in (('tenue_face', Av, Vector((0, 0, 1.15))), ('tenue_dos', -Av, Vector((0, 0, 1.15))), ('tenue_cote', Lat, Vector((0, 0, 1.15))), ('zoom_taille_dos', -Av, Vector((0, 0, 0.95))), ('zoom_poitrine', Av, Vector((0, 0, 1.3))), ('pieds', (Lat * 0.8 + Av * 0.7).normalized(), Vector((0, 0, 0.25))), ('pieds_cote', Lat, Vector((0, 0, 0.25)))):
    viser(ctr, d, 1.1, (600, 700)); sc.render.filepath = f'{SORTIE}_images/{nom}.png'; bpy.ops.render.render(write_still=True)
PEAUX = {'ebene': (74, 46, 32), 'cacao': (96, 60, 40), 'acajou': (108, 66, 42), 'noisette': (120, 76, 50), 'bronze': (142, 92, 58),
         'ambre': (176, 122, 78), 'miel': (198, 150, 104), 'olive': (206, 166, 118), 'sable': (224, 186, 142), 'clair': (238, 204, 166), 'porcelaine': (246, 220, 190)}
choix = list(PEAUX)[::2] if male else list(PEAUX)[1::2]
teintes = ['noir', 'brun', 'noir', 'blond', 'noir'] if male else ['roux', 'noir', 'noir', 'chatain']
sc.frame_set(0)
tete_c = (arm.matrix_world @ arm.pose.bones['Head'].head) + Vector((0, 0, 0.08))
for i, (nom, o) in enumerate(COUPES.items()):
    for o2 in COUPES.values(): o2.hide_render = o2 is not o
    PEAU.diffuse_color = (*srgb(PEAUX[choix[i % len(choix)]]), 1)
    ch = COULEURS_CHEVEUX[teintes[i % len(teintes)]]; pe = PEAUX[choix[i % len(choix)]]
    o.data.materials[0].diffuse_color = (*srgb(ch), 1)
    if len(o.data.materials) > 1: o.data.materials[1].diffuse_color = (*srgb(tuple(a * 0.55 + b * 0.45 for a, b in zip(ch, pe))), 1)
    sync_couleurs()
    viser(tete_c, (Av * 0.85 + Lat * 0.5).normalized(), 0.42, (420, 460)); sc.render.filepath = f'{SORTIE}_images/coupe_{i}_{nom}.png'; bpy.ops.render.render(write_still=True)
    viser(tete_c, (-Av * 0.85 + Lat * 0.5).normalized(), 0.42, (420, 460)); sc.render.filepath = f'{SORTIE}_images/coupe_{i}_{nom}_dos.png'; bpy.ops.render.render(write_still=True)
for i, o in enumerate(COUPES.values()): o.hide_render = i != 0
PEAU.diffuse_color = (*srgb((120, 76, 50)), 1)
print('rendus ok')
