# -----------------------------------------------------------------------
# SPRINTER — une vedette faite dans Tripo, rendue animable par le jeu.
#
#   blender -b --factory-startup -P tools/blender/vedette_tripo.py -- \
#       --source <tripo.glb> --nom meba|manga --taille 1.78 [--sh 1.20 --hip 1.22] \
#       [--glb public/vedettes/meba.glb] [--portraits public/vedettes] [--blend F.blend]
#
#   Meba : --source meba-tripo-lowpoly.glb --nom meba --taille 1.78 --sh 1.20 --hip 1.22
#   Boss de la Legende (06/10) : --nom kouassi --taille 1.60 [...] --glb
#           src/assets/legende/boss/kouassi.glb --portraits src/assets/legende/boss
#           (hors de public/ : la Legende ne vit que sur le canal de test)
#           --marque public/pubs/benbezi-logo-3d.webp [--marque-couleur 1,1,1]
#           [--marque-largeur 0.15] : BENBEZI floque sur la poitrine
#   Aurel : --source aurel-tripo-lowpoly.glb --nom manga --taille 1.90 --sh 1.14 --hip 1.0
#           --glb public/vedettes/manga-corps.glb (manga-* : hors de la production)
#
# POURQUOI (02/10, a la demande de l'utilisateur : « pour Aurel Manga il faut
# repartir de zero, pareil pour Mickael Zeze », « on ne garde pas ceux qui sont
# dans le jeu », « retire les marques »). Les deux corps sont generes dans
# Tripo Studio : une image en pose en T faite a partir de leurs photos, sans
# aucune marque, puis « Smart Mesh » (environ 5 000 quads) et sa texture. Les
# sources sont hors du depot : assets-sources/tripo-vedettes/.
#
# CE QUE TRIPO NE DONNE PAS : un squelette aux noms du jeu, et le repos du jeu
# (les membres droits, les bras le long du corps). Ce script les pose :
#   - chaque articulation est lue sur le corps, par des coupes exactes du
#     maillage (voir Coupes) : la hanche sous le point le plus en arriere du
#     fessier, le genou entre le plus etroit de la jambe et le creux du jarret,
#     l'epaule au-dessus de l'aisselle, le coude au plus mince du bras, le
#     poignet la ou le pouce s'en ecarte, la base du cou sur le trapeze ;
#   - chaque doigt a ses trois phalanges, le pouce aussi : le poing de la
#     course (vedette-3d.ts, COURBE) et les mains des portraits les plient ;
#   - les poids sont ceux de Blender (diffusion de chaleur), en pose en T ;
#   - puis tout le reste est celui de Meba (meba_maillage.py, meba_cartoon.py) :
#     la mise en repere, le calage de chaque os sur le rig du jeu, le lissage
#     des epaules quand les bras se rabattent, les portraits.
#
# LE MIROIR. La projection du jeu est le miroir d'une vraie vue (vedette-3d.ts,
# la matrice P) : FRANCE, peint dans la texture, s'y lirait a l'envers. Le
# temps de l'export, le maillage entier est donc mis en miroir (y -> -y) et ses
# groupes _l / _r echanges : les os ne bougent pas, et l'image du jeu redevient
# une vue vraie — FRANCE a l'endroit, le poignet d'Aurel a son bras gauche.
# -----------------------------------------------------------------------

import bpy
import bmesh
import os
import runpy
import shutil
import sys
from mathutils import Vector, Matrix

ICI = os.path.dirname(os.path.abspath(__file__))
CARTOON = runpy.run_path(os.path.join(ICI, 'meba_cartoon.py'), run_name='meba_cartoon')
M = CARTOON['M']
G = CARTOON['G']

# SA PEAU (02/10 : « la peau est plus claire que celle des vrais athletes »).
# Tripo la peint d'un brun moyen, presque le meme sur les deux (115, 65, 48 en
# sRGB). Elle est ramenee, dans la texture et la seulement ou la teinte est
# celle d'une peau (masque_peau), aux couleurs deja choisies pour Meba : celle
# de ses portraits (60, 37, 29, le brun de ses photos), et pour le jeu la meme
# eclaircie de 1,9 en lineaire — l'ecart que vedette-3d.ts comblait jusqu'ici
# pour le soleil de la piste (ECLAIRCIR_PEAU), cuit ici dans la texture.
# Aurel est un peu plus fonce et plus rouge, dans le rapport de leurs
# doublures en tubes (104, 62, 44 contre 112, 69, 53).
PEAU = {'meba': (60, 37, 29), 'manga': (55, 33, 24)}
ECLAIRCIR_JEU = 1.9


def arguments():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    val = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    return {'source': val('--source'), 'nom': val('--nom', 'meba'), 'taille': float(val('--taille', '1.78')),
            'sh': val('--sh'), 'hip': val('--hip'),
            'glb': val('--glb'), 'portraits': val('--portraits'), 'blend': val('--blend'),
            'marque': val('--marque'), 'marque_couleur': val('--marque-couleur', '1,1,1'),
            'marque_largeur': float(val('--marque-largeur', '0.15')),
            'marque_hauteur': float(val('--marque-hauteur', '0.15'))}


# --- LA MARQUE SUR LA TENUE -----------------------------------------------------

def poser_marque(h, J, H, logo, couleur=(1.0, 1.0, 1.0), largeur=0.15, hauteur=0.15):
    """BENBEZI SUR LA POITRINE (06/10, l'auteur : « mets ma marque sur les
    vetements »). Le logo du jeu (public/pubs/benbezi-logo-3d.webp) n'y est
    pas colle en relief : seule sa silhouette compte — sa transparence —, et
    elle est imprimee a plat, d'une couleur, comme un flocage. Blanc sur un
    maillot colore, sombre sur un maillot clair (`couleur`, lineaire 0-1).

    Le corps est encore celui de l'import : regard vers -y, z en haut, la
    gauche du personnage en +x — vu de face, +x est a droite, et le mot se lit
    donc dans le sens des x. Le rectangle est pose sur le haut de la poitrine,
    entre le dos3 et la base du cou, large de `largeur` x la taille ; seules
    les faces tournees vers l'avant le recoivent (sinon il traverserait le
    corps et s'imprimerait aussi dans le dos). Chaque triangle concerne est
    rasterise dans la texture, en UV : son point 3D dit ou il tombe dans le
    logo."""
    import numpy as np
    img = texture(h).image
    tw, th = img.size
    P = np.empty(tw * th * 4, dtype=np.float32)
    img.pixels.foreach_get(P)
    P = P.reshape(th, tw, 4)
    L = bpy.data.images.load(logo)
    lw, lh = L.size
    A = np.empty(lw * lh * 4, dtype=np.float32)
    L.pixels.foreach_get(A)
    A = A.reshape(lh, lw, 4)[:, :, 3]
    W = largeur * H
    Hl = W * lh / lw
    # `hauteur` : 0 au dos3, 1 a la base du cou. A 0,55 (premier essai, sur
    # Kouassi) le mot montait dans l'encolure, sous le collier : le milieu de
    # la poitrine est plus bas.
    zc = J['dos3'].z + hauteur * (J['cou'].z - J['dos3'].z)
    x0, z0 = -W / 2, zc - Hl / 2
    col = np.array(couleur, dtype=np.float32)
    me = h.data
    uv = me.uv_layers.active.data
    n_tri = 0
    for poly in me.polygons:
        if poly.normal.y > -0.30:
            continue
        li = list(poly.loop_indices)
        co = [me.vertices[me.loops[i].vertex_index].co for i in li]
        if (max(c.x for c in co) < x0 or min(c.x for c in co) > x0 + W
                or max(c.z for c in co) < z0 or min(c.z for c in co) > z0 + Hl):
            continue
        uvs = [uv[i].uv for i in li]
        for k in range(1, len(li) - 1):
            tri = (0, k, k + 1)
            U = np.array([[uvs[j].x * tw, uvs[j].y * th] for j in tri])
            X = np.array([[co[j].x, co[j].z] for j in tri])
            mn = np.floor(U.min(0)).astype(int); mx = np.ceil(U.max(0)).astype(int)
            mn = np.clip(mn, 0, [tw - 1, th - 1]); mx = np.clip(mx, 0, [tw - 1, th - 1])
            gx, gy = np.meshgrid(np.arange(mn[0], mx[0] + 1) + 0.5, np.arange(mn[1], mx[1] + 1) + 0.5)
            (ax, ay), (bx, by), (cx, cy) = U
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-9:
                continue
            w0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
            w1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
            w2 = 1 - w0 - w1
            dedans = (w0 >= -0.01) & (w1 >= -0.01) & (w2 >= -0.01)
            if not dedans.any():
                continue
            px = w0 * X[0, 0] + w1 * X[1, 0] + w2 * X[2, 0]
            pz = w0 * X[0, 1] + w1 * X[1, 1] + w2 * X[2, 1]
            s_ = (px - x0) / W
            t_ = (pz - z0) / Hl
            sur = dedans & (s_ >= 0) & (s_ < 1) & (t_ >= 0) & (t_ < 1)
            if not sur.any():
                continue
            a = np.zeros_like(px)
            a[sur] = A[(t_[sur] * (lh - 1)).astype(int), (s_[sur] * (lw - 1)).astype(int)]
            yy = (gy - 0.5).astype(int); xx = (gx - 0.5).astype(int)
            m = a > 0.01
            blk = P[yy[m], xx[m], :3]
            P[yy[m], xx[m], :3] = blk * (1 - a[m, None]) + col * a[m, None]
            n_tri += 1
    img.pixels.foreach_set(P.ravel())
    img.update()
    img.pack()
    print('MARQUE : %d triangles, logo %.0f x %.0f cm a z %.2f m' % (n_tri, W * 100, Hl * 100, zc))


# --- LE CORPS, A SA TAILLE ---------------------------------------------------

def importer(source, taille, nom):
    """Le glb de Tripo, sommets soudes, pieds a z = 0, a la taille de l'athlete.
    Tripo le pose regardant -y, sa gauche en +x, les bras en croix le long de x,
    paumes en bas."""
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=source, merge_vertices=True)
    neufs = [o for o in bpy.data.objects if o not in avant]
    h = next(o for o in neufs if o.type == 'MESH')
    for o in neufs:
        if o is not h:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    h.select_set(True); bpy.context.view_layer.objects.active = h
    h.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    co = [v.co for v in h.data.vertices]
    mn = Vector([min(c[i] for c in co) for i in range(3)])
    mx = Vector([max(c[i] for c in co) for i in range(3)])
    k = taille / (mx.z - mn.z)
    for v in h.data.vertices:
        v.co = Vector(((v.co.x - (mn.x + mx.x) / 2) * k, (v.co.y - (mn.y + mx.y) / 2) * k, (v.co.z - mn.z) * k))
    # (l'export glTF se plaignait d'un maillage « invalide » : aretes en double)
    h.data.validate(clean_customdata=False)
    h.data.update()
    # des normales recalculees : les normales propres du glb ne suivraient ni
    # la soudure ni le miroir de l'export
    if h.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for p in h.data.polygons:
        p.use_smooth = True
    h.name = nom.capitalize()
    for m in h.data.materials:
        if m:
            m.name = nom.capitalize() + '_tripo'
            b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            # une peau et un tissu mats : Tripo laisse le reflet par defaut
            b.inputs['Metallic'].default_value = 0.0
            b.inputs['Roughness'].default_value = 0.62
            if 'Specular IOR Level' in b.inputs:
                b.inputs['Specular IOR Level'].default_value = 0.30
    return h


# --- SES ARTICULATIONS, LUES SUR LUI ------------------------------------------

class Coupes:
    """Les coupes exactes d'un maillage par un plan : chaque face coupee donne
    un segment, et les segments relies par leurs aretes forment des boucles —
    une par membre traverse. Un maillage de cinq mille faces n'a que sept ou
    huit sommets par tranche de jambe : des tranches de sommets mentaient de
    deux centimetres, pas les coupes."""

    def __init__(self, h):
        me = h.data
        self.V = [v.co.copy() for v in me.vertices]
        self.A = [tuple(e.vertices) for e in me.edges]
        ek = {tuple(sorted(e.vertices)): i for i, e in enumerate(me.edges)}
        self.F = [[ek[tuple(sorted(k))] for k in p.edge_keys] for p in me.polygons]
        self.memo = {}

    def boucles(self, axe, val):
        cle = (axe, round(val, 5))
        if cle in self.memo:
            return self.memo[cle]
        P = {}

        def pt(e):
            if e not in P:
                i, j = self.A[e]
                a, b = self.V[i][axe], self.V[j][axe]
                P[e] = self.V[i].lerp(self.V[j], (val - a) / (b - a)) if (a - val) * (b - val) < 0 else None
            return P[e]
        voisins = {}
        for f in self.F:
            c = [e for e in f if pt(e) is not None]
            for e in c:
                voisins.setdefault(e, set()).update(x for x in c if x != e)
        vus, res = set(), []
        for e in voisins:
            if e in vus:
                continue
            pile, b = [e], []
            vus.add(e)
            while pile:
                x = pile.pop()
                b.append(P[x])
                for y in voisins[x]:
                    if y not in vus:
                        vus.add(y); pile.append(y)
            if len(b) > 4:
                res.append(b)
        self.memo[cle] = res
        return res


def bornes(b, i):
    return min(p[i] for p in b), max(p[i] for p in b)


def milieu(b):
    return Vector([(min(p[i] for p in b) + max(p[i] for p in b)) / 2 for i in range(3)])


def bande(a, b, pas):
    return [a + pas * k for k in range(int((b - a) / pas) + 1)]


def articulations(h, H):
    C = Coupes(h)
    J = {}
    pas = 0.005

    def jambe(z):
        """La jambe gauche a la hauteur z : None au-dessus de l'entrejambe."""
        bs = [b for b in C.boucles(2, z) if bornes(b, 0)[0] > 0]
        return max(bs, key=len) if bs else None

    def tronc(z):
        """La plus grande boucle qui traverse le plan median (en surface : sous le
        menton, la barbe fait une boucle a part, plus riche en points que le cou)."""
        bs = [b for b in C.boucles(2, z) if bornes(b, 0)[0] < 0 < bornes(b, 0)[1]]
        aire = lambda b: (bornes(b, 0)[1] - bornes(b, 0)[0]) * (bornes(b, 1)[1] - bornes(b, 1)[0])
        return max(bs, key=aire) if bs else None

    # L'ENTREJAMBE : la plus haute coupe ou la jambe gauche est encore seule
    z = 0.30 * H
    while z < 0.65 * H and jambe(z + pas) is not None:
        z += pas
    entrejambe = z
    # LA HANCHE, sous le point le plus en arriere du fessier : la tete du femur
    # et le grand trochanter sont a sa hauteur, ou a peine dessous. Pas aux
    # proportions de Drillis (0,530 H) : sur Meba, dessine avec une tete grande
    # (5,6 tetes de haut), elle tombait sept centimetres trop haut, a la
    # ceinture du short.
    fesses = [(bornes(tronc(z_), 1)[1], z_) for z_ in bande(entrejambe + pas, entrejambe + 0.12 * H, pas)
              if tronc(z_)]
    fesse = max(fesses)[1]
    hanche_z = max(fesse - 0.01, entrejambe + 0.035 * H)
    c = milieu(jambe(entrejambe - 0.02 * H))
    J['hanche'] = Vector((c.x, c.y, hanche_z))
    # LE GENOU : le milieu de trois lectures — le plus etroit de la jambe vue
    # de face, le bas du creux du jarret vu de profil (le premier point a trois
    # millimetres de son fond : derriere la cuisse d'Aurel, le profil est plat
    # sur dix centimetres) et les proportions de Drillis (0,285 H). Aucune ne
    # tient seule sur les deux corps ; deux sur trois s'accordent toujours.
    larg = min((bornes(jambe(z_), 0)[1] - bornes(jambe(z_), 0)[0], z_) for z_ in bande(0.20 * H, 0.34 * H, pas))[1]
    dos = [(bornes(jambe(z_), 1)[1], z_) for z_ in bande(0.24 * H, 0.36 * H, pas)]
    fond = min(dos)[0]
    creux = next(z_ for d_, z_ in dos if d_ < fond + 0.003)
    genou_z = sorted((larg, creux, 0.285 * H))[1]
    c = milieu(jambe(genou_z))
    J['genou'] = Vector((c.x, c.y, genou_z))
    # LA CHEVILLE, a 4,8 % de la taille (malleoles, semelle comprise), au
    # milieu de la jambe juste au-dessus de la chaussure
    c = milieu(jambe(0.085 * H))
    J['cheville'] = Vector((c.x, c.y, 0.048 * H))
    # LE PIED, jusqu'a la tete des metatarsiens : 72 % du talon a la pointe
    pied = jambe(0.017 * H)
    pointe, talon = bornes(pied, 1)
    J['orteil'] = Vector((milieu(pied).x, talon + 0.72 * (pointe - talon), 0.015 * H))

    # LE COU : son plus etroit, entre 0,78 et 0,93 H ; sa base la ou, en
    # descendant, la coupe s'elargit d'une fois et demie — le trapeze. La tete
    # pivote juste au-dessus du plus etroit, sous le crane.
    def demi(z_):
        t = tronc(z_)
        return max(-bornes(t, 0)[0], bornes(t, 0)[1]) if t else 1.0
    w = [(demi(z_), z_) for z_ in bande(0.78 * H, 0.93 * H, pas)]
    wmin = min(w)[0]
    col = [z_ for (l, z_) in w if l < wmin + 0.005]
    cou_mince = sum(col) / len(col)
    z_ = cou_mince
    while z_ > 0.70 * H and demi(z_) < 1.5 * wmin:
        z_ -= pas / 2
    cou = z_ + pas / 4
    crane = cou_mince + 0.017 * H
    for nom, zz in (('bassin', hanche_z), ('dos1', hanche_z + 0.07 * H), ('dos2', hanche_z + 0.15 * H),
                    ('dos3', hanche_z + 0.23 * H), ('cou', cou), ('crane', crane)):
        t = tronc(zz)
        J[nom] = Vector((0.0, milieu(t).y if t else 0.0, zz))
    J['sommet'] = Vector((0.0, J['crane'].y, H))

    # LES BRAS, EN CROIX : coupes en x, la boucle la plus haute est le bras
    # (on part au-dela de la tete, qui serait plus haute que lui)
    def bras(x_):
        bs = [b for b in C.boucles(0, x_) if bornes(b, 2)[1] > 0.66 * H]
        return max(bs, key=lambda b: bornes(b, 2)[1]) if bs else None
    bout = max(v.co.x for v in h.data.vertices)
    # L'EPAULE, au-dessus de l'aisselle : la ou le dessous du bras cesse de
    # descendre le long du buste
    dessous = [(x_, bornes(bras(x_), 2)[0]) for x_ in bande(0.07 * H, 0.26 * H, pas) if bras(x_)]
    stable = sorted(z_ for x_, z_ in dessous if 0.16 * H < x_ < 0.24 * H)
    u = stable[len(stable) // 2]
    aisselle = next(x_ for x_, z_ in dessous if z_ >= u - 0.012)
    ex = aisselle - 0.012
    # LE POIGNET : la ou le pouce s'ecarte de l'avant-bras (le bord avant de
    # la coupe, en -y, saute de plus d'un centimetre sur deux)
    av = [(x_, bornes(bras(x_), 1)[0]) for x_ in bande(ex + 0.20 * H, bout, pas)]
    poignet = next(x_ for (x_, y_), (xp, yp) in zip(av[4:], av) if y_ < yp - 0.012) - 0.02
    # LE COUDE, au plus mince du bras vu de face (son epaisseur en z) dans le
    # tiers du milieu, un centimetre au-dela : l'interligne passe sous les
    # epicondyles, que la peau ne marque pas
    L = poignet - ex
    coude = min((bornes(bras(x_), 2)[1] - bornes(bras(x_), 2)[0], x_)
                for x_ in bande(ex + 0.35 * L, ex + 0.65 * L, pas))[1] + 0.01
    # l'axe du bras : la droite des milieux de ses coupes, du coude au poignet,
    # prolongee jusqu'a l'epaule (le deltoide, au-dessus, ne compte pas)
    pts = [milieu(bras(x_)) for x_ in bande(coude - 0.06, poignet - 0.02, pas)]

    def ajuste(i):
        n = len(pts)
        mx_ = sum(p.x for p in pts) / n
        my = sum(p[i] for p in pts) / n
        sxx = sum((p.x - mx_) ** 2 for p in pts) or 1e-9
        pente = sum((p.x - mx_) * (p[i] - my) for p in pts) / sxx
        return lambda x_: my + pente * (x_ - mx_)
    fy, fz = ajuste(1), ajuste(2)
    axe = lambda x_: Vector((x_, fy(x_), fz(x_)))
    J['epaule'] = axe(ex)
    J['coude'] = axe(coude)
    J['poignet'] = axe(poignet)
    J['doigts'] = axe(bout)
    J['avant_poignet'] = bornes(bras(poignet - 0.01), 1)[0]
    J['sternum'] = Vector((0.02 * H, J['dos3'].y, J['epaule'].z - 0.01 * H))
    print('ARTICULATIONS H %.3f | entrejambe %.3f fesse %.3f hanche %.3f genou %.3f (face %.3f, jarret %.3f)'
          ' | cou %.3f crane %.3f | aisselle %.3f epaule %.3f coude %.3f poignet %.3f bout %.3f' % (
              H, entrejambe, fesse, hanche_z, genou_z, larg, creux, cou, crane, aisselle, ex, coude, poignet, bout))
    return J


def doigts(h, J, H):
    """Les quatre doigts et le pouce de la main gauche, en pose en T (paume en
    bas, pouce vers l'avant) : {nom: [base, jointure, jointure, bout]}."""
    me = h.data
    V = [v.co.copy() for v in me.vertices]
    voisins = [[] for _ in V]
    for e in me.edges:
        a, b = e.vertices
        voisins[a].append(b); voisins[b].append(a)

    def composantes(idx):
        reste, res = set(idx), []
        while reste:
            i = reste.pop()
            c, pile = [i], [i]
            while pile:
                x = pile.pop()
                for y in voisins[x]:
                    if y in reste:
                        reste.remove(y); c.append(y); pile.append(y)
            res.append(c)
        return res

    P = J['poignet']
    main = [i for i, v in enumerate(V) if v.x > P.x and v.z > 0.6 * H]
    # LE BOUT DU POUCE : le point le plus en avant de la main (la main deborde
    # en avant du poignet : le bord de l'avant-bras ne separe pas le pouce de
    # l'index)
    tp = min(main, key=lambda i: V[i].y)
    # LA FENTE DES DOIGTS : le premier plan au-dela duquel la main se separe
    # en quatre morceaux, le pouce mis a part
    x, fente, quatre = P.x + 0.06, None, None
    while x < J['doigts'].x:
        cs = [c for c in composantes([i for i in main if V[i].x > x]) if len(c) >= 6 and tp not in c]
        if len(cs) >= 4:
            fente, quatre = x, sorted(cs, key=len, reverse=True)[:4]
            break
        x += 0.002
    if fente is None:
        raise RuntimeError('les doigts ne se separent pas')
    # de l'avant (-y) vers l'arriere : index, majeur, annulaire, auriculaire
    quatre.sort(key=lambda c: sum(V[i].y for i in c) / len(c))
    D = {}
    for nom, c in zip(('index', 'middle', 'ring', 'pinky'), quatre):
        # sa racine : le premier anneau de sommets au-dela de la fente
        x0 = min(V[i].x for i in c)
        racine = [V[i] for i in c if V[i].x < x0 + 0.010]
        R = sum(racine, Vector()) / len(racine)
        T = max((V[i] for i in c), key=lambda v: v.x)
        d = (T - R).normalized()
        base, bout = R - d * 0.012, T - d * 0.004       # l'articulation est sous la jointure
        L = (bout - base).length
        D[nom] = [base, base + d * 0.44 * L, base + d * 0.74 * L, bout]
    # LE POUCE, de sa base (au bord avant du poignet, cote paume) a son bout
    T = V[tp]
    B = Vector((P.x + 0.015, J['avant_poignet'] + 0.015, P.z - 0.01))
    d = (T - B).normalized()
    bout = T - d * 0.004
    D['thumb'] = [B, B + (bout - B) * 0.45, B + (bout - B) * 0.75, bout]
    print('DOIGTS fente %.3f, bouts (x/y) %s' % (
        fente, ' '.join('%s %.3f/%.3f' % (n, D[n][3].x, D[n][3].y) for n in D)))
    return D


# SA CARRURE (03/10, pour Aurel : « remonte ses epaules, donne-lui un physique
# plus imposant »). 1,90 m pour 89 kg : un hurdleur lourd, large du haut, aux
# deltoides qui debordent de l'epaule (anatomie.py, ATHLETES). Le corps de
# Tripo l'avait fin ; le jeu le ramene a la taille du rig commun, et il y
# paraissait plus etroit que Meba (epaules a 1,05 contre 1,20). Elargi, son
# corps les a a 1,14 : son look les reprend (--sh 1.14, morph.sh).
CARRURE = {'manga': {'large': 1.10, 'bras': 1.14, 'avant_bras': 1.07}}


def carrure(h, J, large, bras, avant_bras):
    """Le haut du corps elargi, en pose en T, avant le squelette (qui est lu
    ensuite sur le corps elargi) :
      - le buste s'ecarte de `large` en x, de la taille (dos1) jusqu'au haut
        de la poitrine (dos3), et le garde jusqu'a la base du cou ; la tete
        n'y est pas ;
      - les bras s'en ecartent d'autant, sans s'allonger ;
      - autour de leur axe, ils s'epaississent : `bras` du deltoide au biceps,
        quatre pour cent au coude, `avant_bras` au milieu de l'avant-bras, rien
        au poignet ni a la main."""
    import numpy as np
    me = h.data
    co = np.array([v.co[:] for v in me.vertices])
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    ax, sg = np.abs(x), np.sign(x)

    def lisse(a, b, t):
        u = np.clip((t - a) / (b - a), 0.0, 1.0)
        return u * u * (3 - 2 * u)
    S, E, P = J['epaule'], J['coude'], J['poignet']
    ex, cou = S.x, J['cou'].z
    r = lisse(J['dos1'].z, J['dos3'].z, z)
    r = r * (1 - lisse(cou, cou + 0.02, z) * (1 - lisse(0.09, 0.12, ax)))
    # au-dela de l'epaule, les bras glissent du meme ecart ; pas le haut des
    # cuisses, qui deborde lui aussi de 19 cm (r y est nul)
    buste = ax <= ex
    nx = np.where(buste, x * (1 + (large - 1) * r), x + sg * (large - 1) * ex * r)
    # l'epaisseur des bras, le long de leur axe (u : distance a l'epaule), et
    # seulement pres de cet axe (d : distance a l'axe ; les cuisses sont a 50 cm)
    u = ax - ex
    L1, L2 = E.x - S.x, P.x - E.x
    k = 1 + (bras - 1) * lisse(0.0, 0.05, u)
    k = k + (1.04 - bras) * lisse(0.65 * L1, L1, u)
    k = k + (avant_bras - 1.04) * lisse(L1, L1 + 0.15 * L2, u)
    k = k + (1.0 - avant_bras) * lisse(L1 + 0.5 * L2, L1 + 0.9 * L2, u)
    t = (ax - S.x) / (P.x - S.x)
    Ay, Az = S.y + t * (P.y - S.y), S.z + t * (P.z - S.z)
    d = np.hypot(y - Ay, z - Az)
    k = np.where(buste, 1.0, 1 + (k - 1) * (1 - lisse(0.08, 0.12, d)))
    ny = Ay + k * (y - Ay)
    nz = Az + k * (z - Az)
    for v, a, b, c in zip(me.vertices, nx, ny, nz):
        v.co = (float(a), float(b), float(c))
    me.update()
    bouge = np.sqrt((nx - x) ** 2 + (ny - y) ** 2 + (nz - z) ** 2)
    print('CARRURE : buste x %.2f, epaule %.3f -> %.3f, bras x %.2f, avant-bras x %.2f ;'
          ' sous la taille, %.4f m au plus' % (large, ex, ex * large, bras, avant_bras,
                                              bouge[z < J['dos1'].z].max()))


DOIGTS = ('index', 'middle', 'ring', 'pinky', 'thumb')


def squelette(J, D, nom):
    """Les os aux noms du jeu (ceux du mannequin d'Unreal, comme le Quaternius).

    LES PHALANGES SE PLIENT VERS LA PAUME. vedette-3d.ts ferme le poing en
    tournant chaque phalange autour de son axe x local, d'un angle positif : un
    tel tour porte le bout de l'os vers son axe z. L'axe z de chaque phalange
    est donc tourne vers la paume (en bas en pose en T) — vers la paume et le
    petit doigt pour le pouce, qui se replie en travers."""
    arm = bpy.data.armatures.new(nom + '_rig')
    rig = bpy.data.objects.new(nom + '_rig', arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones

    def os_(n, t, q, parent=None):
        b = eb.new(n); b.head = t; b.tail = q
        if parent:
            b.parent = eb[parent]; b.use_connect = False
        return b
    os_('root', Vector((0, 0, 0)), Vector((0, 0.1, 0)))
    os_('pelvis', J['bassin'], J['dos1'], 'root')
    os_('spine_01', J['dos1'], J['dos2'], 'pelvis')
    os_('spine_02', J['dos2'], J['dos3'], 'spine_01')
    os_('spine_03', J['dos3'], J['cou'], 'spine_02')
    os_('neck_01', J['cou'], J['crane'], 'spine_03')
    os_('head', J['crane'], J['sommet'], 'neck_01')
    for s, c in ((1, 'l'), (-1, 'r')):
        m = lambda v: Vector((v.x * s, v.y, v.z))
        os_('clavicle_' + c, m(J['sternum']), m(J['epaule']), 'spine_03')
        os_('upperarm_' + c, m(J['epaule']), m(J['coude']), 'clavicle_' + c)
        os_('lowerarm_' + c, m(J['coude']), m(J['poignet']), 'upperarm_' + c)
        # la paume, du poignet a la jointure du majeur : les doigts en partent
        os_('hand_' + c, m(J['poignet']), m(D['middle'][0]), 'lowerarm_' + c)
        for doigt in DOIGTS:
            parent = 'hand_' + c
            for k in range(3):
                n = '%s_%02d_%s' % (doigt, k + 1, c)
                b = os_(n, m(D[doigt][k]), m(D[doigt][k + 1]), parent)
                b.align_roll(Vector((0, 0.6, -1)) if doigt == 'thumb' else Vector((0, 0, -1)))
                parent = n
        os_('thigh_' + c, m(J['hanche']), m(J['genou']), 'pelvis')
        os_('calf_' + c, m(J['genou']), m(J['cheville']), 'thigh_' + c)
        os_('foot_' + c, m(J['cheville']), m(J['orteil']), 'calf_' + c)
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.bones['root'].use_deform = False
    return rig


def poids_par_procuration(h, rig, voxel=0.010):
    """LA CHALEUR SUR UNE DOUBLURE ETANCHE (06/10, Kouassi, premier boss de la
    carriere Legende). Son corps Tripo est fait de 34 morceaux ouverts — les
    manches, le short, les membres, chacun a part — et la diffusion de chaleur
    de Blender n'y trouve aucune solution : pas un sommet ne recevait d'os.
    On la fait donc sur le meme corps remaille en voxels, d'un seul tenant et
    ferme, puis chaque sommet du vrai maillage reprend les poids de la face la
    plus proche de la doublure. Les doigts serres se soudent dans la doublure :
    leurs poids sont plus grossiers, ce que la course ne montre pas."""
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
    print('POIDS PAR PROCURATION : doublure de %d faces (voxel %.3f m)' % (len(p.data.polygons), voxel))
    bpy.data.objects.remove(p, do_unlink=True)


def ponderer(h, rig):
    """Les poids automatiques de Blender ; un sommet qu'ils laissent sans os
    prend celui de son voisin pondere le plus proche."""
    bpy.ops.object.select_all(action='DESELECT')
    h.select_set(True); rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    noms = {g.index: g.name for g in h.vertex_groups}
    os_ok = {b.name for b in rig.data.bones if b.use_deform}
    pese = lambda v: sum(g.weight for g in v.groups if noms.get(g.group) in os_ok)
    seuls = [v for v in h.data.vertices if pese(v) < 1e-4]
    # La chaleur a echoue sur un corps en morceaux : on la refait sur une
    # doublure etanche (voir poids_par_procuration).
    if len(seuls) > 0.10 * len(h.data.vertices):
        print('POIDS : la chaleur laisse %d sommets sur %d sans os' % (len(seuls), len(h.data.vertices)))
        poids_par_procuration(h, rig)
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
    # chaque doigt doit porter les siens, sinon le poing ne se ferme pas
    portes = {}
    for v in h.data.vertices:
        for g in v.groups:
            n = noms.get(g.group, '')
            if n.split('_')[0] in DOIGTS and g.weight > 0.5:
                portes[n] = portes.get(n, 0) + 1
    print('POIDS : %d sommets sans os, repris du voisin ; phalanges (sommets a plus de 0,5) : %s' % (
        len(seuls), ' '.join('%s %d' % (n, portes.get(n, 0)) for n in sorted(
            '%s_%02d_%s' % (d, k, c) for d in DOIGTS for k in (1, 2, 3) for c in 'lr'))))


def deplier(h, centres, rayon, passes, poids=True):
    """Deplier la peau autour de `centres` : chaque sommet a moins de `rayon`
    va vers la moyenne de ses voisins, d'autant plus qu'il est pres d'un
    centre — et ses poids d'os aussi, pour que la course ne refasse pas le pli.
    Rend le nombre de sommets touches."""
    import numpy as np
    me = h.data
    co = np.array([v.co[:] for v in me.vertices])
    n = len(co)
    ar = np.array([e.vertices[:] for e in me.edges])
    deg = np.maximum(np.bincount(ar.ravel(), minlength=n).astype(float), 1)
    w = np.zeros(n)
    for P in centres:
        w = np.maximum(w, np.clip(1 - np.linalg.norm(co - np.array(P), axis=1) / rayon, 0, 1) ** 2)
    zone = w > 0

    def lisser(x):
        s_ = np.zeros_like(x)
        np.add.at(s_, ar[:, 0], x[ar[:, 1]]); np.add.at(s_, ar[:, 1], x[ar[:, 0]])
        return s_ / (deg[:, None] if x.ndim == 2 else deg)
    for _ in range(passes):
        co = np.where(zone[:, None], co + 0.5 * w[:, None] * (lisser(co) - co), co)
    for i in np.nonzero(zone)[0]:
        me.vertices[int(i)].co = co[i]
    if poids:
        groupes = [g for g in h.vertex_groups if g.name.split('_')[0] in ('upperarm', 'clavicle', 'spine', 'neck')]
        pd = np.zeros((len(groupes), n))
        idx = {g.index: k for k, g in enumerate(groupes)}
        for v in me.vertices:
            for g in v.groups:
                if g.group in idx:
                    pd[idx[g.group], v.index] = g.weight
        total = pd.sum(0)
        for _ in range(passes // 2):
            for k in range(len(groupes)):
                pd[k] = np.where(zone, pd[k] + 0.5 * w * (lisser(pd[k]) - pd[k]), pd[k])
        norme = np.where(pd.sum(0) > 1e-6, total / np.maximum(pd.sum(0), 1e-6), 0)
        for k, g in enumerate(groupes):
            for i in np.nonzero(zone)[0]:
                p = float(pd[k, i] * norme[i])
                if p > 1e-4:
                    g.add([int(i)], p, 'REPLACE')
                else:
                    g.remove([int(i)])
    me.update()
    return int(zone.sum())


def deplier_aisselles(h, rig, rayon=0.10, passes=80):
    """L'AISSELLE DEPLIEE (03/10 : « le bras gauche fait des formes bizarres au
    niveau des pectoraux »). Rabattre les bras de la pose en T ecrase la peau
    du creux de l'aisselle entre le bras et le buste : des faces repliees l'une
    sur l'autre (175 degres, quatre centimetres sous l'epaule), qui faisaient
    une marche dans le pectoral et pincaient l'emmanchure du maillot. On les
    deplie (voir deplier) ; un rayon de dix centimetres et quatre-vingts passes
    font du raccord bras-pectoral une courbe (a 8,5 cm et 40 passes, le coin
    d'ombre restait)."""
    centres = []
    for cote in ('l', 'r'):
        S = rig.matrix_world @ rig.data.bones['upperarm_' + cote].head_local
        centres.append((S.x + 0.005, S.y * 0.94, S.z - 0.04))
    print('AISSELLES : %d sommets deplies' % deplier(h, centres, rayon, passes))


def sternum_au_buste(h, rig, large=0.045, net=0.025):
    """LE STERNUM SUIT LE BUSTE, PAS LES CLAVICULES. Les deux clavicules partent
    du milieu de la poitrine : les sommets du sternum, tires par l'une et par
    l'autre, se repliaient au creux du col quand les portraits les descendent
    (une arete blanche et un triangle noir dans le V d'Aurel). Pres du plan
    median, leur part de clavicule passe a spine_03 — entierement a moins de
    `net`, plus du tout au-dela de `large`."""
    S = rig.matrix_world @ rig.data.bones['upperarm_l'].head_local
    gs = {n: h.vertex_groups.get(n) for n in ('clavicle_l', 'clavicle_r', 'spine_03')}
    if not all(gs.values()):
        return
    idx = {gs['clavicle_l'].index: 'clavicle_l', gs['clavicle_r'].index: 'clavicle_r'}
    n = 0
    for v in h.data.vertices:
        if not (S.z - 0.16 < v.co.z < S.z + 0.08) or abs(v.co.y) >= large:
            continue
        part = min(1.0, (large - abs(v.co.y)) / (large - net))
        donne = 0.0
        for g in v.groups:
            if g.group in idx and g.weight > 0:
                ote = g.weight * part
                gs[idx[g.group]].add([v.index], g.weight - ote, 'REPLACE')
                donne += ote
        if donne > 0:
            ancien = next((g.weight for g in v.groups if g.group == gs['spine_03'].index), 0.0)
            gs['spine_03'].add([v.index], ancien + donne, 'REPLACE')
            n += 1
    print('STERNUM : %d sommets rendus au buste' % n)


# --- SA PEAU ---------------------------------------------------------------------

def srgb_lin(x):
    import numpy as np
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def lin_srgb(x):
    import numpy as np
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


def masque_peau(px):
    """La part de peau de chaque pixel (0 a 1), lue sur sa couleur : une teinte
    orangee, assez saturee, ni noire (cheveux, barbe) ni vive — les pointes
    orange d'Aurel ont la teinte de sa peau, mais deux fois sa clarte.
    (Saturee jusqu'a 0,86 : au bord du col d'Aurel, Tripo peint une peau plus
    orange, a 0,83 ; laissee claire, elle faisait une tache sur la combinaison.)"""
    import numpy as np
    mx, mn = px.max(1), px.min(1)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = px[:, 0], px[:, 1], px[:, 2]
    t = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    t = np.where(t > 300, t - 360, t)
    s = np.where(mx > 1e-4, d / np.maximum(mx, 1e-4), 0)

    def fenetre(x, a, b_, c, d_):
        return np.clip(np.minimum((x - a) / (b_ - a), (d_ - x) / (d_ - c)), 0, 1)
    return fenetre(t, -8, 0, 28, 38) * fenetre(s, 0.20, 0.32, 0.86, 0.94) * fenetre(mx, 0.08, 0.16, 0.62, 0.72)


def teinter_peau(img, cible, k=1.0, cote=None):
    """Une copie de `img` ou la peau a pour moyenne `cible` (sRGB 0-255),
    multipliee par k en lineaire. Les ombres et les reliefs peints restent :
    seule la moyenne se deplace, canal par canal. `cible` nulle (les boss de
    la carriere Legende, 06/10) : la peau garde sa teinte, et seul k joue."""
    import numpy as np
    im = img.copy()
    if cote and im.size[0] > cote:
        im.scale(cote, cote)
    px = np.array(im.pixels[:], dtype=np.float32).reshape(-1, 4)
    m = masque_peau(px[:, :3])
    lin = srgb_lin(px[:, :3])
    moy = (lin * m[:, None]).sum(0) / max(float(m.sum()), 1.0)
    voulu = (srgb_lin(np.array(cible, dtype=np.float32) / 255) if cible is not None else moy) * k
    f = voulu / np.maximum(moy, 1e-5)
    px[:, :3] = lin_srgb(lin * (1 + m[:, None] * (f - 1)))
    im.pixels[:] = px.ravel()
    im.pack()
    print('PEAU : moyenne %s -> %s x %.2f, %.0f %% de la texture' % (
        tuple(int(round(c)) for c in lin_srgb(moy) * 255), cible or 'la sienne', k, 100 * float(m.mean())))
    return im


def masque_vetements(px):
    """La part de tissu de chaque pixel (0 a 1) : le blanc du maillot, du
    bandeau et du poignet (sans teinte, clair), et le bleu du short et de la
    combinaison (marine). Rend (blanc, bleu)."""
    import numpy as np
    mx, mn = px.max(1), px.min(1)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = px[:, 0], px[:, 1], px[:, 2]
    t = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 1e-4, d / np.maximum(mx, 1e-4), 0)

    def fenetre(x, a, b_, c, d_):
        return np.clip(np.minimum((x - a) / (b_ - a), (d_ - x) / (d_ - c)), 0, 1)
    blanc = fenetre(s, -1, 0, 0.12, 0.2) * fenetre(mx, 0.55, 0.68, 2, 3)
    bleu = fenetre(t, 195, 210, 250, 262) * fenetre(s, 0.25, 0.35, 2, 3) * fenetre(mx, 0.08, 0.14, 0.85, 0.95)
    return blanc, bleu


def modeler_blanc(img, plafond=0.70):
    """LE BLANC QUI LAISSE VOIR L'OMBRE (03/10 : « les vetements manquent de
    forme de lumiere »). Tripo peint le maillot presque blanc pur (236) : sous
    le soleil de la piste comme sous la cle du studio, il saturait, et le
    maillot devenait un aplat sans pli ni volume. Les blancs sont ramenes a
    `plafond` en lineaire (218 en sRGB) : la lumiere y dessine de nouveau la
    forme du torse. Le bleu de FRANCE, dessus, ne bouge pas."""
    import numpy as np
    im = img.copy()
    px = np.array(im.pixels[:], dtype=np.float32).reshape(-1, 4)
    blanc, _ = masque_vetements(px[:, :3])
    lin = srgb_lin(px[:, :3])
    sel = blanc > 0.9
    haut = float(np.percentile(lin[sel].max(1), 97)) if sel.any() else 1.0
    f = min(1.0, plafond / max(haut, 1e-4))
    px[:, :3] = lin_srgb(lin * (1 + blanc[:, None] * (f - 1)))
    im.pixels[:] = px.ravel()
    im.pack()
    print('BLANC : %.0f %% de la texture, de %.2f a %.2f en lineaire' % (100 * float(sel.mean()), haut, haut * f))
    return im


def tissu(h, img):
    """LE TISSU SOUS LA LUMIERE DES PORTRAITS. Sur le maillot et le short
    seulement (masque_vetements, rendu en image) : un lustre de tissu (sheen),
    doux, qui allume les bords tournes vers la lumiere — 0,5 sur le blanc, 0,25
    sur le bleu. La peau et les cheveux n'en ont pas. (Un grain de maille en
    relief a ete essaye : sa normale basculait sur les faces tres inclinees du
    col en V d'Aurel — un rabat que Tripo modele replie —, un triangle noir que
    le lustre bordait de blanc. Plus fort sur le bleu, le lustre seul y
    laissait encore la trace ; deplier ce col deformait le mot FRANCE.)"""
    import numpy as np
    m = h.data.materials[0]
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    w, hh = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    blanc, bleu = masque_vetements(px[:, :3])
    masque = np.maximum(blanc, 0.5 * bleu)
    im = bpy.data.images.new('vetements', w, hh, alpha=False)
    im.colorspace_settings.name = 'Non-Color'
    mp = np.ones((masque.size, 4), dtype=np.float32)
    mp[:, 0] = mp[:, 1] = mp[:, 2] = masque
    im.pixels[:] = mp.ravel()
    im.pack()
    nm = nt.nodes.new('ShaderNodeTexImage'); nm.image = im
    lustre = nt.nodes.new('ShaderNodeMath'); lustre.operation = 'MULTIPLY'; lustre.inputs[1].default_value = 0.5
    nt.links.new(nm.outputs['Color'], lustre.inputs[0])
    nt.links.new(lustre.outputs[0], bsdf.inputs['Sheen Weight'])
    bsdf.inputs['Sheen Roughness'].default_value = 0.5
    rug = nt.nodes.new('ShaderNodeMath'); rug.operation = 'MULTIPLY_ADD'
    rug.inputs[1].default_value = 0.2; rug.inputs[2].default_value = 0.62
    nt.links.new(nm.outputs['Color'], rug.inputs[0])
    nt.links.new(rug.outputs[0], bsdf.inputs['Roughness'])


def dilater(h, img, cote, marge=24):
    """Une copie de `img`, a `cote` pixels, dont chaque ilot d'UV deborde de sa
    propre couleur sur `marge` pixels.

    L'ATLAS DE TRIPO EST EN MIETTES : des centaines d'ilots, separes de noir.
    De loin, le jeu lit la texture dans ses mipmaps, qui melangent chaque ilot
    a ce qui l'entoure — le noir des vides d'abord : le maillot blanc sortait
    gris et tache, la peau mouchetee. Recuite par Cycles avec une marge, chaque
    ilot borde ses vides de sa propre couleur."""
    sc = bpy.context.scene
    moteur = sc.render.engine
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 1
    sc.cycles.device = 'CPU'
    neuve = bpy.data.images.new(img.name + '_dilatee', cote, cote, alpha=False)
    m = h.data.materials[0]
    nt = m.node_tree
    sortie = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    tex = texture(h)
    avant, tex.image = tex.image, img
    surface = sortie.inputs['Surface'].links[0].from_socket
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], sortie.inputs['Surface'])
    cible = nt.nodes.new('ShaderNodeTexImage')
    cible.image = neuve
    nt.nodes.active = cible
    bpy.ops.object.select_all(action='DESELECT')
    h.select_set(True); bpy.context.view_layer.objects.active = h
    sc.render.bake.margin_type = 'EXTEND'
    try:
        bpy.ops.object.bake(type='EMIT', margin=marge, use_clear=True)
    finally:
        nt.links.new(surface, sortie.inputs['Surface'])
        nt.nodes.remove(em); nt.nodes.remove(cible)
        tex.image = avant
        sc.render.engine = moteur
    neuve.pack()
    return neuve


def texture(h):
    """Le noeud image branche a la couleur de base."""
    m = h.data.materials[0]
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    return b.inputs['Base Color'].links[0].from_node


# --- L'EXPORT, EN MIROIR -------------------------------------------------------

def miroir(h):
    bm = bmesh.new(); bm.from_mesh(h.data)
    for v in bm.verts:
        v.co.y = -v.co.y
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(h.data); bm.free()
    for g in h.vertex_groups:
        if g.name.endswith('_l'):
            g.name = g.name[:-2] + '_@'
    for g in h.vertex_groups:
        if g.name.endswith('_r'):
            g.name = g.name[:-2] + '_l'
    for g in h.vertex_groups:
        if g.name.endswith('_@'):
            g.name = g.name[:-2] + '_r'
    h.data.update()


def exporter(h, rig, chemin, peau_jeu):
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    h.select_set(True)
    bpy.context.view_layer.objects.active = h
    # quatre os au plus par sommet, comme le glTF les lit
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    os.makedirs(os.path.dirname(os.path.abspath(chemin)), exist_ok=True)
    mw = h.matrix_world.copy(); h.parent = rig; h.matrix_world = mw
    tex = texture(h)
    peau_portrait, tex.image = tex.image, peau_jeu
    miroir(h)
    try:
        bpy.ops.export_scene.gltf(filepath=chemin, export_format='GLB', use_selection=True,
                                  use_active_scene=True, export_skins=True, export_animations=False,
                                  export_morph=False, export_yup=True, export_apply=False,
                                  export_attributes=False, export_def_bones=False,
                                  export_image_format='JPEG', export_jpeg_quality=85,
                                  export_meshopt_compression_enable=True)
    finally:
        miroir(h)
        tex.image = peau_portrait
    return os.path.getsize(chemin)


DESCENTE_EPAULES = {'meba': 0.40, 'manga': 0.15}


def portraits(rig, dossier, nom):
    """Ceux de meba_maillage (studio, poses, cadrages), aux noms de la vedette.
    Rendus a part puis deplaces : rendus sur place, ceux d'Aurel passaient par
    les noms de Meba et emportaient ses portraits.

    LES EPAULES DESCENDUES (03/10 : « les epaules sont trop haut dans la fiche
    du defi »). Le rig du jeu met la base du cou cinq centimetres au-dessus de
    l'epaule ; le corps de Tripo en avait dix. Cale sur le jeu, le buste s'est
    tasse sous le cou, et les epaules remontaient vers les oreilles. Pour les
    portraits seulement — la course pose ses mains depuis l'epaule du jeu —, les
    clavicules descendent de 0,4 radian : six centimetres (a 0,25, quatre
    centimetres ne se voyaient presque pas sur le portrait en pied).
    Celles d'Aurel ne descendent que de 0,15 (03/10 : « remonte les epaules
    de Aurel ») : ses trapezes hauts sont son signe (anatomie.py) ; a zero,
    elles montaient jusqu'aux oreilles."""
    d = DESCENTE_EPAULES.get(nom, 0.40)
    for cle in ('DEBOUT', 'EN_PIED'):
        G[cle] = dict(G[cle], clavicle_l=(0.0, -d, 0.0), clavicle_r=(0.0, d, 0.0))
    tmp = os.path.join(dossier, '_rendu_' + nom)
    M['portraits'](rig, tmp)
    for k in ('buste', 'pied'):
        os.replace(os.path.join(tmp, 'meba-%s.webp' % k), os.path.join(dossier, '%s-%s.webp' % (nom, k)))
    shutil.rmtree(tmp, ignore_errors=True)


def tout(A):
    M['scene_neuve']()
    nom = A['nom'].capitalize()
    h = importer(A['source'], A['taille'], A['nom'])
    J = articulations(h, A['taille'])
    if A['marque']:
        poser_marque(h, J, A['taille'], A['marque'],
                     tuple(float(c) for c in A['marque_couleur'].split(',')), A['marque_largeur'],
                     A['marque_hauteur'])
    if A['nom'] in CARRURE:
        carrure(h, J, **CARRURE[A['nom']])
        J = articulations(h, A['taille'])
    D = doigts(h, J, A['taille'])
    rig = squelette(J, D, nom)
    ponderer(h, rig)
    M['mise_en_repere'](h, rig)
    b = rig.data.bones
    # L'ECART DES EPAULES ET DES HANCHES. Le jeu pose ses mains et ses pieds
    # avec celui de son look (morph sh et hip) : le maillage doit avoir le meme.
    # Lus sur les deux corps, ils tombent a un ou deux millimetres de ceux que
    # les looks portaient deja (Meba 1,19 / 1,18 pour 1,20 / 1,22 ; Aurel 1,05 /
    # 1,06 pour 1,06 / 1,00) : --sh et --hip gardent ceux du look, et les
    # doublures en tubes n'ont pas a changer. Sans eux, le maillage garde les
    # siens, et c'est au look de les reprendre.
    sh_y, hip_y = b['upperarm_l'].head_local.y, b['thigh_l'].head_local.y
    print('MORPH %s : sh %.2f hip %.2f lus (epaule %.3f, hanche %.3f), taille au repere du jeu %.3f' % (
        nom, sh_y / 0.154, hip_y / 0.082, sh_y, hip_y, max(v.co.z for v in h.data.vertices)))
    G['SH_Y'] = 0.154 * float(A['sh']) if A['sh'] else sh_y
    G['HIP_Y'] = 0.082 * float(A['hip']) if A['hip'] else hip_y
    CARTOON['adoucir_epaules'](h)
    herite = M['caler'](rig, CARTOON['cibles'](rig, cou=1.0))
    CARTOON['figer'](h, rig, herite)
    deplier_aisselles(h, rig)
    sternum_au_buste(h, rig)
    tex = texture(h)
    source = tex.image
    # Les boss de la Legende n'ont pas de teinte imposee : leur peau est celle
    # que Tripo a peinte d'apres leur image, eclaircie pour le jeu seulement.
    peau = PEAU.get(A['nom'])
    tex.image = modeler_blanc(teinter_peau(source, peau, cote=None))
    if A['glb']:
        jeu = dilater(h, modeler_blanc(teinter_peau(source, peau, k=ECLAIRCIR_JEU)), 1024)
        print('GLB :', exporter(h, rig, A['glb'], jeu), 'octets')
    if A['blend']:
        bpy.ops.wm.save_as_mainfile(filepath=A['blend'], copy=True)
    if A['portraits']:
        tissu(h, tex.image)
        portraits(rig, A['portraits'], A['nom'])
    return h, rig


if __name__ == '__main__' and bpy.app.background:
    tout(arguments())
