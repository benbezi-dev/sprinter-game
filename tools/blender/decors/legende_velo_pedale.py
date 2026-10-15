# -----------------------------------------------------------------------
# SPRINTER — le cycliste qui PEDALE (15/10, l'auteur : « il ne pedale pas »,
# puis « les deux jambes ne pedalent pas correctement »).
#
#   blender -b --factory-startup -P tools/blender/decors/legende_velo_pedale.py -- \
#       --source <velo-tripo.glb> [--images 12] [--diag diag.png]
#
# Le modele Tripo du velo et de son cycliste est un seul maillage, sans
# squelette. On lui pose un squelette a la main, jambe par jambe :
#   hanche -> genou -> pied (le point d'appui sur la pedale),
# les deux jambes separees par leur PROFONDEUR (le cadre est dans le plan
# du velo, une jambe de chaque cote). Pour chaque image, chaque pied va a sa
# pedale sur le cercle du pedalier (les deux pedales opposees) ; le genou se
# place par une IK a deux os (cuisse et tibia gardent leur longueur, le genou
# reste en avant), la cuisse tourne autour de la hanche, le tibia suit le
# genou, la chaussure garde son assiette. Les manivelles et les pedales du
# modele tournent avec le pedalier. Un seul deplacement de translation (la
# premiere version) etirait le tibia et ne pliait pas le genou.
# --diag : l'image de repos, jambes en couleur et articulations marquees.
# -----------------------------------------------------------------------

import bpy
import json
import math
import os
import sys

import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import legende_monuments as LM  # noqa: E402

DOSSIER = os.path.join(LM.PROJET, 'src', 'assets', 'legende', 'vehicules')
F_MAN = os.path.join(DOSSIER, 'manifeste.json')

# Les articulations, mesurees sur le modele normalise (LM.normaliser, 270) :
# x en « pixels de velo-profil » (0..637 sur la longueur du velo), z en
# hauteur du modele (0 au sol, 1 en haut de la tete).
ART = {
    'hanche':   (262, 0.515),
    'pres':  {'genou': (326, 0.385), 'pied': (306, 0.080)},   # jambe tendue, pedale en bas
    'loin':  {'genou': (366, 0.468), 'pied': (297, 0.236)},   # jambe pliee, pedale en haut
    'pedalier': (297, 0.170),   # l'axe : un cercle ajuste sur les dents du plateau
}


def arguments():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    def val(k, d=None):
        return a[a.index(k) + 1] if k in a else d
    return dict(source=val('--source'), images=int(val('--images', '12')), diag=val('--diag'),
                haut=int(val('--haut', '640')))


def smooth(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def dist_segment(px, pz, a, b):
    """Distance des points (px, pz) au segment a-b, et le parametre t le long."""
    dx, dz = b[0] - a[0], b[1] - a[1]
    l2 = dx * dx + dz * dz
    t = ((px - a[0]) * dx + (pz - a[1]) * dz) / l2
    tc = np.clip(t, 0, 1)
    return np.hypot(px - (a[0] + tc * dx), pz - (a[1] + tc * dz)), t


def rot(px, pz, cx, cz, ang):
    c, s = math.cos(ang), math.sin(ang)
    return cx + c * (px - cx) - s * (pz - cz), cz + s * (px - cx) + c * (pz - cz)


def ik(H, T, S, F, avant=1.0):
    """Le genou pour un pied en F : cuisse T depuis la hanche H, tibia S."""
    dx, dz = F[0] - H[0], F[1] - H[1]
    D = math.hypot(dx, dz)
    D = min(max(D, abs(T - S) + 1e-4), T + S - 1e-4)
    a = math.acos((T * T + D * D - S * S) / (2 * T * D))
    base = math.atan2(dz, dx)
    cands = [base + a, base - a]
    # le genou en avant (vers le nez du velo, +x)
    k = max(cands, key=lambda b: avant * math.cos(b))
    return (H[0] + T * math.cos(k), H[1] + T * math.sin(k))


def main():
    A = arguments()
    o = LM.importer(A['source'])
    image = LM.texture(o)
    LM.normaliser(o, 270)
    me = o.data
    co = np.array([v.co[:] for v in me.vertices])
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    xmin, L = x.min(), x.max() - x.min()

    def px(u):
        return xmin + (u / 637.0) * L

    def pt(p):
        return (px(p[0]), p[1])

    H = pt(ART['hanche'])
    C = pt(ART['pedalier'])
    hz = 1.0 - 493.0 / 622.0
    R = 118.0 / 622.0
    roues = [(px(127), hz), (px(510), hz)]
    dans_roue = np.zeros(len(co), bool)
    for (cx, cz) in roues:
        dans_roue |= (x - cx) ** 2 + (z - cz) ** 2 < (R * 1.02) ** 2
    yc = float(np.median(y[(~dans_roue) & (z < H[1]) & (z > hz)]))
    ecart = np.abs(y - yc)
    cote = {'pres': y < yc, 'loin': y > yc}
    hors_cadre = smooth(0.022, 0.040, ecart)          # 0 dans le plan du cadre, 1 sur les jambes
    # le plateau et le carter de chaine, dans le plan du cadre autour du
    # pedalier : ils restent en place (le tibia les etirait en une tache noire)
    d_ped = np.hypot(x - C[0], z - C[1])
    hors_plateau = 1 - (1 - smooth(0.045, 0.060, ecart)) * (1 - smooth(0.060, 0.075, d_ped))
    # sous le haut du plateau, la chaine et le carter s'ecartent du cadre
    # jusqu'a 0,045 : les jambes commencent au-dela
    hors_plateau = hors_plateau * (1 - (1 - smooth(0.040, 0.052, ecart)) * (1 - smooth(0.27, 0.30, z)))

    jambes = {}
    for nom in ('pres', 'loin'):
        K = pt(ART[nom]['genou'])
        F = pt(ART[nom]['pied'])
        T = math.hypot(K[0] - H[0], K[1] - H[1])
        S = math.hypot(F[0] - K[0], F[1] - K[1])
        d1, t1 = dist_segment(x, z, H, K)
        d2, t2 = dist_segment(x, z, K, F)
        # la jambe : pres de l'un des deux os, du bon cote du cadre, hors roues
        dmax = 0.095
        dans = cote[nom] & (~dans_roue) & (np.minimum(d1, d2) < dmax)
        # le haut de la cuisse levee depasse la hanche : on s'arrete au
        # bassin en fondu (une coupe nette dechirait le short)
        poids = dans * hors_cadre * hors_plateau * smooth(dmax, dmax * 0.7, np.minimum(d1, d2)) * smooth(H[1] + 0.11, H[1] + 0.06, z)
        # la chaussure entiere suit le pied, meme son bord interieur pres du
        # plateau (sinon la semelle restait en place, etiree en trainee grise)
        dc, tc = dist_segment(x, z, C, F)
        barre = (dc < 0.012) & (tc > 0.18) & (tc < 0.72)
        # la chaussure : une boite du talon a la pointe et de la semelle a la
        # cheville, deplacee d'un bloc (hors du plateau et du cadre)
        boite = (smooth(F[0] - 0.115, F[0] - 0.100, x) * smooth(F[0] + 0.095, F[0] + 0.080, x)
                 * smooth(F[1] - 0.050, F[1] - 0.035, z) * smooth(F[1] + 0.125, F[1] + 0.100, z))
        chaussure = cote[nom] & (~barre) & ((ecart > 0.045) | ((ecart > 0.038) & (d_ped > 0.072)))
        boite = boite * chaussure
        poids = np.maximum(poids, boite)
        # la fesse et le haut de la cuisse restent sur la selle
        poids = poids * smooth(-0.02, 0.22, t1 * (d1 <= d2) + 1.0 * (d1 > d2))
        # tibia (1) ou cuisse (0), fondus autour du genou
        w_tibia = smooth(-0.025, 0.025, d1 - d2)
        # la chaussure (au-dela du pied le long du tibia) garde son assiette
        w_pied = smooth(0.80, 0.97, t2) * w_tibia
        w_tibia = np.maximum(w_tibia, boite)
        w_pied = np.maximum(w_pied, boite)
        jambes[nom] = dict(K=K, F=F, T=T, S=S, poids=poids, w_tibia=w_tibia, w_pied=w_pied)
        print('JAMBE %s : cuisse %.3f tibia %.3f, %d sommets' % (nom, T, S, int((poids > 0.01).sum())))

    # les manivelles et les pedales : une barre du pedalier a chaque pied
    r_pres = math.hypot(jambes['pres']['F'][0] - C[0], jambes['pres']['F'][1] - C[1])
    r_loin = math.hypot(jambes['loin']['F'][0] - C[0], jambes['loin']['F'][1] - C[1])
    r = 0.5 * (r_pres + r_loin)
    # les deux pedales sur le meme cercle autour de l'axe, opposees (les pieds
    # du modele Tripo n'y sont pas tout a fait : 1 a 2 cm d'ecart au repos)
    a0 = {'pres': math.atan2(jambes['pres']['F'][1] - C[1], jambes['pres']['F'][0] - C[0])}
    a0['loin'] = a0['pres'] + math.pi
    manivelle = {}
    for nom in jambes:
        F = jambes[nom]['F']
        d, t = dist_segment(x, z, C, F)
        # la manivelle et sa pedale (une barre large du pedalier au pied,
        # soudee a la semelle dans le maillage Tripo) tournent ; le cadre, dans
        # son plan, reste en place ; la pedale, au bout, garde son assiette.
        m = cote[nom] & (ecart > 0.040) & (d < 0.024) & (t > 0.12) & (t < 1.25) & (jambes[nom]['poids'] < 0.5)
        manivelle[nom] = (m, smooth(0.70, 0.88, t))
        print('MANIVELLE %s : %d sommets, rayon %.3f, angle %.1f deg' % (nom, int(m.sum()), math.hypot(F[0]-C[0], F[1]-C[1]), math.degrees(a0[nom])))

    if A['diag']:
        LM.matiere(o, image, (1, 1, 1, 0))
        tmp = '/tmp/velo-diag-%d.png' % os.getpid()
        W, Hh, pied = LM.rendre(o, 8, A['haut'], tmp)
        a = LM.lire(tmp)
        # repere ecran (comme LM.rendre) pour poser les marques
        e = math.radians(8)
        s_, c_ = math.sin(e), math.cos(e)
        us = x; vs = s_ * y + c_ * z
        u0, u1 = us.min() - 0.02, us.max() + 0.02
        v0, v1 = vs.min() - 0.02, vs.max() + 0.02
        def ecran(p, yy=0.0):
            return (int((p[0] - u0) / (u1 - u0) * W), int((v1 - (s_ * yy + c_ * p[1])) / (v1 - v0) * Hh))
        teintes = {'pres': (1, 0.1, 0.1, 1), 'loin': (0.1, 0.4, 1, 1)}
        # les sommets des jambes, en points de couleur
        for nom in jambes:
            sel = np.nonzero(jambes[nom]['poids'] > 0.5)[0][::3]
            for i in sel:
                u, v = ecran((x[i], z[i]), y[i])
                if 0 <= v < Hh and 0 <= u < W:
                    a[v, u] = teintes[nom]
            sel = np.nonzero(manivelle[nom][0])[0]
            for i in sel:
                u, v = ecran((x[i], z[i]), y[i])
                if 0 <= v < Hh and 0 <= u < W:
                    a[v, u] = (0, 1, 0, 1)
        def croix(p, coul, yy=0.0):
            u, v = ecran(p, yy)
            a[max(0, v - 5):v + 6, max(0, u - 1):u + 2] = coul
            a[max(0, v - 1):v + 2, max(0, u - 5):u + 6] = coul
        croix(H, (1, 1, 0, 1))
        croix(C, (0, 1, 0, 1))
        for nom in jambes:
            yy = -0.08 if nom == 'pres' else 0.08
            croix(jambes[nom]['K'], teintes[nom], yy)
            croix(jambes[nom]['F'], teintes[nom], yy)
        LM.ecrire(a, A['diag'], 'PNG')
        print('DIAG ' + A['diag'])
        return

    # la pedale et le bout de manivelle du modele, sous le plateau, sont
    # soudes au plan du plateau (on ne peut pas les faire tourner sans le
    # dechirer) : on les retire, et le jeu dessine des manivelles qui tournent
    Fp = jambes['pres']['F']
    dl, tl = dist_segment(x, z, C, Fp)
    pedale_fixe = (cote['pres'] & (d_ped > 0.064) & (d_ped < 0.105) & (dl < 0.026) & (tl > 0.6)
                   & (jambes['pres']['poids'] < 0.3))
    import bmesh
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    faces = {f for v in np.nonzero(pedale_fixe)[0] for f in bm.verts[int(v)].link_faces}
    bmesh.ops.delete(bm, geom=list(faces), context='FACES_ONLY')
    bm.to_mesh(me); bm.free(); me.update()
    print('PEDALE DU MODELE : %d sommets, %d faces retirees' % (int(pedale_fixe.sum()), len(faces)))

    LM.matiere(o, image, (1, 1, 1, 0))
    base = co.copy()
    os.makedirs(DOSSIER, exist_ok=True)
    man = json.load(open(F_MAN)) if os.path.exists(F_MAN) else {}
    entree = man.setdefault('velo', {})
    images, poses = [], []
    n = A['images']
    for i in range(n):
        # en avant, le pedalier tourne dans le sens des aiguilles d'une
        # montre a l'ecran (nez a droite) : l'angle (z vers le haut) decroit
        da = -2 * math.pi * i / n
        nx, nz = base[:, 0].copy(), base[:, 2].copy()
        for nom, J in jambes.items():
            Fn = (C[0] + r * math.cos(a0[nom] + da), C[1] + r * math.sin(a0[nom] + da))
            Kn = ik(H, J['T'], J['S'], Fn)
            th1 = math.atan2(Kn[1] - H[1], Kn[0] - H[0]) - math.atan2(J['K'][1] - H[1], J['K'][0] - H[0])
            th2 = math.atan2(Fn[1] - Kn[1], Fn[0] - Kn[0]) - math.atan2(J['F'][1] - J['K'][1], J['F'][0] - J['K'][0])
            m = J['poids'] > 0
            bx, bz = base[m, 0], base[m, 2]
            # cuisse : rotation autour de la hanche
            cx_, cz_ = rot(bx, bz, H[0], H[1], th1)
            # tibia : rotation autour du genou, puis le genou a sa place
            tx, tz = rot(bx, bz, J['K'][0], J['K'][1], th2)
            tx, tz = tx + Kn[0] - J['K'][0], tz + Kn[1] - J['K'][1]
            # chaussure : suit le pied sans tourner
            fx, fz = bx + Fn[0] - J['F'][0], bz + Fn[1] - J['F'][1]
            wt, wf = J['w_tibia'][m], J['w_pied'][m]
            jx = (1 - wt) * cx_ + (wt - wf) * tx + wf * fx
            jz = (1 - wt) * cz_ + (wt - wf) * tz + wf * fz
            w = J['poids'][m]
            nx[m] = bx + w * (jx - bx)
            nz[m] = bz + w * (jz - bz)
            # la manivelle et sa pedale tournent autour du pedalier
            mm, wp = manivelle[nom]
            rx, rz = rot(base[mm, 0], base[mm, 2], C[0], C[1], da)
            px_, pz_ = base[mm, 0] + Fn[0] - J['F'][0], base[mm, 2] + Fn[1] - J['F'][1]
            nx[mm] = (1 - wp[mm]) * rx + wp[mm] * px_
            nz[mm] = (1 - wp[mm]) * rz + wp[mm] * pz_
        nouv = base.copy()
        nouv[:, 0], nouv[:, 2] = nx, nz
        poses.append(nouv)
    if os.environ.get('ETIRE'):
        ed = np.array([e.vertices[:] for e in me.edges])
        l0 = np.linalg.norm(base[ed[:, 0]] - base[ed[:, 1]], axis=1)
        p = poses[n // 2]
        dl = np.linalg.norm(p[ed[:, 0]] - p[ed[:, 1]], axis=1) - l0
        def qui(v):
            r = []
            for nm, J in jambes.items():
                if J['poids'][v] > 0.01:
                    r.append('%s p%.2f t%.2f f%.2f' % (nm, J['poids'][v], J['w_tibia'][v], J['w_pied'][v]))
                if manivelle[nm][0][v]:
                    r.append('man-%s %.2f' % (nm, manivelle[nm][1][v]))
            return ','.join(r) or 'fixe'
        for k in np.argsort(-dl)[:40:2]:
            a_, b_ = ed[k]
            print('ETIRE %.3f | X %.0f z %.3f y %.3f [%s] -- X %.0f z %.3f y %.3f [%s]' % (dl[k],
                  (base[a_, 0] - xmin) / L * 637, base[a_, 2], base[a_, 1], qui(a_),
                  (base[b_, 0] - xmin) / L * 637, base[b_, 2], base[b_, 1], qui(b_)))
    for nouv in poses:
        me.vertices.foreach_set('co', nouv.ravel())
        me.update()
        tmp = '/tmp/velo-pedale-%d.png' % os.getpid()
        W, Hh, pied = LM.rendre(o, 8, A['haut'], tmp)
        images.append(LM.lire(tmp))
    # un seul recadrage pour toutes les images (l'union de leurs silhouettes),
    # comme velo-profil : les reperes des roues et du pedalier restent valables
    al = np.max([a_[..., 3] for a_ in images], axis=0)
    ys, xs = np.nonzero(al > 0.004)
    x0, x1 = max(0, xs.min() - 2), min(W, xs.max() + 3)
    y0, y1 = max(0, ys.min() - 2), min(Hh, ys.max() + 3)
    for f in os.listdir(DOSSIER):
        if f.startswith('velo-pedale-'):
            os.remove(os.path.join(DOSSIER, f))
    noms = []
    for i, arr in enumerate(images):
        nom = 'velo-pedale-%d.webp' % i
        LM.ecrire(arr[y0:y1, x0:x1], os.path.join(DOSSIER, nom))
        noms.append(nom)
    print('IMAGES %d : %dx%d' % (len(noms), x1 - x0, y1 - y0))
    # les manivelles du modele sont soudees au plateau : le jeu les dessine,
    # au pedalier (pixels de l'image), de cette longueur, la pedale proche a
    # l'angle a0 (radians, z vers le haut) dans l'image 0
    e = math.radians(8)
    vs = math.sin(e) * y + math.cos(e) * z
    u0, u1 = x.min() - 0.02, x.max() + 0.02
    v0, v1 = vs.min() - 0.02, vs.max() + 0.02
    k = Hh / (v1 - v0)
    ped = ((C[0] - u0) * k - x0, (v1 - math.cos(e) * C[1] - math.sin(e) * yc) * k - y0)
    entree['pedale'] = {'f': noms, 'w': int(x1 - x0), 'h': int(y1 - y0), 'ax': round(float(pied[0] - x0), 1),
                        'ay': round(float(pied[1] - y0), 1), 'a0': round(a0['pres'], 4),
                        'manivelle': round(r * k, 1), 'pedalier': [round(ped[0], 1), round(ped[1], 1)]}
    print('MANIFESTE', entree['pedale'])
    json.dump(man, open(F_MAN, 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main()
