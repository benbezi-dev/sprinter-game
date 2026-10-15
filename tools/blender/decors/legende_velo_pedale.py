# -----------------------------------------------------------------------
# SPRINTER — le cycliste qui PEDALE (15/10, l'auteur : « il ne pedale pas »).
#
#   blender -b --factory-startup -P tools/blender/decors/legende_velo_pedale.py -- \
#       --source <velo-tripo.glb> [--images 8] [--diag diag.png]
#
# Le modele Tripo du velo et de son cycliste est un seul maillage, sans
# squelette. On isole les deux jambes par leur PROFONDEUR : le cadre est fin
# et pose dans le plan du velo, les jambes s'en ecartent de part et d'autre.
# Chaque jambe est ensuite tiree vers sa pedale : un deplacement qui vaut le
# vecteur de la manivelle au pied et s'efface en remontant vers la hanche
# (le genou suit a moitie, la cuisse a peine). Les deux pedales sont
# opposees. On rend `images` vues de profil sur un tour de pedalier, qui vont
# dans src/assets/legende/vehicules/ (velo-pedale-0.webp ...) avec leur
# manifeste ; le voyage choisit l'image selon l'angle du pedalier.
# --diag : une seule image ou les jambes retenues sont peintes en rouge.
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


def arguments():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    def val(k, d=None):
        return a[a.index(k) + 1] if k in a else d
    return dict(source=val('--source'), images=int(val('--images', '8')), diag=val('--diag'),
                haut=int(val('--haut', '640')))


def main():
    A = arguments()
    o = LM.importer(A['source'])
    image = LM.texture(o)
    LM.normaliser(o, 270)                  # de profil, le nez vers la droite (comme velo-profil)
    me = o.data
    co = np.array([v.co[:] for v in me.vertices])
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    xmin, xmax = x.min(), x.max()
    L = xmax - xmin
    # les roues : leurs moyeux, aux reperes de velo-profil.webp (637 px de
    # large pour le velo entier ; roues a 127 et 510 px, moyeu a 493/622 du haut)
    def px(u):
        return xmin + (u / 637.0) * L
    hz = 1.0 - 493.0 / 622.0                # hauteur des moyeux (le modele fait 1 de haut)
    R = 118.0 / 622.0
    roues = [(px(127), hz), (px(510), hz)]
    pedalier = Vector((px(301), 0, 1.0 - 508.0 / 622.0))
    manivelle = 34.0 / 622.0
    # le plan du cadre : la profondeur mediane des points du cadre (sous la selle, hors roues)
    dans_roue = np.zeros(len(co), bool)
    for (cx, cz) in roues:
        dans_roue |= (x - cx) ** 2 + (z - cz) ** 2 < (R * 1.04) ** 2
    hanche_z = 1.0 - 300.0 / 622.0          # le haut des cuisses
    yc = float(np.median(y[(~dans_roue) & (z < hanche_z) & (z > hz)]))
    ecart = np.abs(y - yc)
    # une jambe : sous la hanche, hors des roues, ecartee du plan du cadre
    region = (z < hanche_z + 0.02) & (~dans_roue) & (x > px(200)) & (x < px(380))
    # (le plateau du pedalier s'ecarte aussi du cadre : il reste en place)
    plateau = (x - pedalier.x) ** 2 + (z - pedalier.z) ** 2 < 0.046 ** 2
    pres = region & (ecart > 0.035) & (y < yc) & (~plateau)
    loin = region & (ecart > 0.035) & (y > yc) & (~plateau)
    print('JAMBES : pres %d, loin %d sommets sur %d (plan du cadre y=%.3f)' % (pres.sum(), loin.sum(), len(co), yc))

    if A['diag']:
        # les jambes retenues, en rouge vif sur le rendu
        m = bpy.data.materials.new('diag'); m.use_nodes = True
        nt = m.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        att = nt.nodes.new('ShaderNodeAttribute'); att.attribute_name = 'jambe'; att.attribute_type = 'GEOMETRY'
        em = nt.nodes.new('ShaderNodeEmission')
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
        mix.inputs['A'].default_value = (0.75, 0.75, 0.75, 1); mix.inputs['B'].default_value = (1, 0, 0, 1)
        nt.links.new(att.outputs['Fac'], mix.inputs['Factor'])
        nt.links.new(mix.outputs['Result'], em.inputs['Color'])
        out = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], out.inputs['Surface'])
        at = me.attributes.new('jambe', 'FLOAT', 'POINT')
        at.data.foreach_set('value', (pres | loin).astype(np.float32))
        o.data.materials.clear(); o.data.materials.append(m)
        tmp = '/tmp/velo-diag-%d.png' % os.getpid()
        LM.rendre(o, 8, 700, tmp)
        a = LM.lire(tmp)
        LM.ecrire(a, A['diag'], 'PNG')
        print('DIAG ' + A['diag'])
        return

    LM.matiere(o, image, (1, 1, 1, 0))
    # le poids du deplacement : 1 au pied, 0 a la hanche (lisse)
    pied_z = 1.0 - 560.0 / 622.0
    w = np.clip((hanche_z - z) / (hanche_z - pied_z), 0, 1) ** 1.6
    # des bords doux : un seuil net etirait des faces en plaques entre les
    # sommets tires et leurs voisins restes en place (pedale, semelle)
    d_plat = np.sqrt((x - pedalier.x) ** 2 + (z - pedalier.z) ** 2)
    w = w * np.clip((ecart - 0.012) / 0.03, 0, 1) * np.clip((d_plat - 0.03) / 0.025, 0, 1)
    pres = region & (y < yc) & (w > 0)
    loin = region & (y > yc) & (w > 0)
    base = co.copy()
    # le pied repose sur sa pedale dans la pose d'origine : on deplace la jambe
    # du vecteur (pedale a l'angle a) - (pedale a l'angle du modele)
    a0_pres = math.atan2((1.0 - 548.0 / 622.0) - pedalier.z, px(292) - pedalier.x)
    os.makedirs(DOSSIER, exist_ok=True)
    man = json.load(open(F_MAN)) if os.path.exists(F_MAN) else {}
    entree = man.setdefault('velo', {})
    images = []
    for i in range(A['images']):
        # en avant, les pedales tournent comme les roues : dans le sens des
        # aiguilles d'une montre a l'ecran, donc l'angle (z vers le haut) decroit
        a = a0_pres - 2 * math.pi * i / A['images']
        nouv = base.copy()
        for masque, phase in ((pres, 0.0), (loin, math.pi)):
            dx = manivelle * (math.cos(a + phase) - math.cos(a0_pres + phase))
            dz = manivelle * (math.sin(a + phase) - math.sin(a0_pres + phase))
            nouv[masque, 0] += dx * w[masque]
            nouv[masque, 2] += dz * w[masque]
        me.vertices.foreach_set('co', nouv.ravel())
        me.update()
        tmp = '/tmp/velo-pedale-%d.png' % os.getpid()
        W, H, pied = LM.rendre(o, 8, A['haut'], tmp)
        images.append(LM.lire(tmp))
    # un seul recadrage pour toutes les images (l'union de leurs silhouettes),
    # comme velo-profil : les reperes des roues et du pedalier restent valables
    al = np.max([a_[..., 3] for a_ in images], axis=0)
    ys, xs = np.nonzero(al > 0.004)
    x0, x1 = max(0, xs.min() - 2), min(W, xs.max() + 3)
    y0, y1 = max(0, ys.min() - 2), min(H, ys.max() + 3)
    noms = []
    for i, arr in enumerate(images):
        nom = 'velo-pedale-%d.webp' % i
        LM.ecrire(arr[y0:y1, x0:x1], os.path.join(DOSSIER, nom))
        noms.append(nom)
    print('IMAGES %d : %dx%d' % (len(noms), x1 - x0, y1 - y0))
    entree['pedale'] = {'f': noms, 'w': int(x1 - x0), 'h': int(y1 - y0), 'ax': round(float(pied[0] - x0), 1),
                        'ay': round(float(pied[1] - y0), 1), 'a0': round(a0_pres, 4)}
    json.dump(man, open(F_MAN, 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main()
