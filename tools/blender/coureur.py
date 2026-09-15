# -----------------------------------------------------------------------
# SPRINTER — sculpter les coureurs dans Blender, puis les mesurer.
#
#   blender -b -P tools/blender/coureur.py -- --sortie src/game/coureur-hd.json
#
# POURQUOI PASSER PAR BLENDER POUR UN JEU QUI NE CHARGE AUCUN MAILLAGE.
# Le moteur ne sait pas afficher un .glb : un coureur y est une liste de
# troncs de cone, rasterises a la main en 2D (drawSegmentFacets). C'est ce
# qui lui permet de tourner dans le virage, de s'eclairer face par face et
# de tenir a huit a l'ecran. Un maillage importe casserait tout cela.
#
# Ce que Blender apporte n'est donc pas un format, c'est une MESURE. On
# sculpte un vrai corps de sprinter avec des metaballs — des masses qui se
# fondent les unes dans les autres, exactement comme des muscles — on le
# convertit en maillage, puis on lance des rayons depuis l'axe de chaque os
# pour relever son epaisseur reelle, hauteur par hauteur. Les chiffres qui
# sortent d'ici ne sont pas devines a la main : ils sont releves sur une
# geometrie qui existe.
#
# LE RIG NE BOUGE PAS. Longueurs de segment, pivots, angles, chute,
# celebration, rotation de virage : tout reste celui de pose(). Seules les
# epaisseurs changent, et leur nombre — la ou il y avait deux troncs par
# membre, il y en a jusqu'a six, mesures. Un coureur premium reste donc un
# coureur du jeu : il court en virage sans qu'une ligne du moteur ait a le
# savoir.
# -----------------------------------------------------------------------

import bpy
import sys
import os
import json
import math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anatomie
import importlib
importlib.reload(anatomie)


# Rayon d'une metaball isolee, rapporte a son rayon de reglage : avec une
# raideur de 2 et le seuil par defaut de 0,6, la surface tombe a 0,6725 du
# rayon. C'est le point de depart de la calibration — il ne vaut que pour
# une bille seule, et deux billes voisines se gonflent l'une l'autre.
SEUIL_BILLE = 0.6725
RAIDEUR = 2.0


def vider():
    """Repartir d'une scene nue."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for bloc in (bpy.data.meshes, bpy.data.metaballs, bpy.data.objects):
        for d in list(bloc):
            if d.users == 0:
                bloc.remove(d)


def eclater(masse):
    """Les positions de billes d'une masse.

    Une masse decalee en profondeur ou en largeur se dedouble : c'est la
    fusion des deux billes qui fabrique l'ovale. Une masse sans ecart reste
    une seule bille.
    """
    x, y, z, _r, dx, dy = masse
    xs = (x - dx, x + dx) if dx > 1e-6 else (x,)
    ys = (y - dy, y + dy) if dy > 1e-6 else (y,)
    return [(px, py, z) for px in xs for py in ys]


# Combien de billes intercalees entre deux masses voisines.
#
# Une masse tous les cinq ou six centimetres sur un bras qui en fait trois
# de rayon, et la surface ondule comme un chapelet — le lissage n'y suffit
# pas, il arrondit les bosses sans les supprimer. On intercale donc des
# billes par interpolation : meme anatomie decrite, memes rayons calibres,
# mais une peau continue. Ce ne sont pas des masses de plus a regler, ce
# sont les memes, echantillonnees plus finement.
DENSITE = 3


def enfiler(masses, rayons):
    """Les masses d'un groupe, avec leurs intercalaires."""
    out = []
    for i in range(len(masses)):
        out.append((masses[i], rayons[i]))
        if i + 1 >= len(masses):
            break
        a, b = masses[i], masses[i + 1]
        ra, rb = rayons[i], rayons[i + 1]
        for j in range(1, DENSITE):
            t = j / DENSITE
            out.append((tuple(a[k] + (b[k] - a[k]) * t for k in range(6)),
                        ra + (rb - ra) * t))
    return out


def sculpter(nom, masses, rayons, resolution=0.006):
    """Une metaball par groupe, convertie en maillage.

    Les groupes portent des noms de base distincts : dans Blender, deux
    objets metaball ne se fondent que s'ils partagent leur nom de base. On
    veut justement l'inverse ici — une cuisse mesuree seule, sans que le
    rayon aille traverser l'entrejambe et taper dans l'autre cuisse.
    """
    mb = bpy.data.metaballs.new(nom)
    mb.resolution = resolution
    mb.render_resolution = resolution
    for masse, R in enfiler(masses, rayons):
        for co in eclater(masse):
            el = mb.elements.new(type='BALL')
            el.co = co
            el.radius = R
            el.stiffness = RAIDEUR
    obj = bpy.data.objects.new(nom, mb)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.view_layer.objects.active

    # DEBOSSELER. Deux billes voisines ne se fondent jamais tout a fait :
    # il reste un leger bourrelet entre elles, et une suite de masses le
    # long d'un bras donne une surface qui ondule comme un chapelet. Aucun
    # muscle ne fait cela. On passe donc un lissage avant toute mesure —
    # et non apres, sans quoi on releverait des epaisseurs que le corps
    # n'a pas. Le lissage retrecit un peu le volume ; la calibration le
    # rattrape toute seule, puisqu'elle mesure ce qui sort d'ici.
    mod = obj.modifiers.new('lissage', 'SMOOTH')
    mod.factor = 0.55
    mod.iterations = 5
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


N_RAYONS = 24


def relever(obj, ax, ay, z, portee=0.45):
    """L'epaisseur du corps a une hauteur donnee, autour d'un axe.

    On part de l'axe de l'os et on tire dans toutes les directions du plan
    horizontal. Chaque rayon rapporte la distance a la peau. De la sortent
    quatre chiffres : la profondeur (hx), la largeur (hy), le rayon moyen,
    et le DECENTRAGE — de combien la chair deborde d'un cote plutot que de
    l'autre. C'est lui qui donne la cambrure : un fessier part en arriere,
    un mollet aussi, une poitrine part en avant. Sans lui, un corps reste
    une pile de tubes centres sur l'os.
    """
    org = (ax, ay, z)
    rs = []
    r0 = r90 = r180 = r270 = None
    for i in range(N_RAYONS):
        a = 2.0 * math.pi * i / N_RAYONS
        d = (math.cos(a), math.sin(a), 0.0)
        ok, loc, _n, _i = obj.ray_cast(org, d, distance=portee)
        if not ok:
            continue
        r = math.dist(loc, org)
        if r < 1e-4:
            continue
        rs.append(r)
        if i == 0:
            r0 = r
        elif i == N_RAYONS // 4:
            r90 = r
        elif i == N_RAYONS // 2:
            r180 = r
        elif i == 3 * N_RAYONS // 4:
            r270 = r
    if len(rs) < N_RAYONS * 0.6:
        return None
    moy = sum(rs) / len(rs)
    hx = (r0 + r180) * 0.5 if (r0 and r180) else moy
    hy = (r90 + r270) * 0.5 if (r90 and r270) else moy
    # On garde la forme relevee (un torse est plus large que profond, une
    # cuisse l'inverse) mais on recale la moyenne sur le rayon reel : c'est
    # (hx + hy) / 2 que le moteur utilise pour epaissir le tronc de cone.
    s = (hx + hy) * 0.5
    if s > 1e-6:
        k = moy / s
        hx *= k
        hy *= k
    cx = (r0 - r180) * 0.5 if (r0 and r180) else 0.0
    return (hx, hy, moy, cx)


def calibrer(groupes, passes=12, resolution=0.007):
    """Amener la peau sculptee sur les rayons vises, bille par bille.

    Une metaball ne fait pas le rayon qu'on lui donne : sa voisine la
    gonfle. Plutot que de corriger a la main des dizaines de valeurs — ce
    qui se deregle des qu'on touche a une seule —, on sculpte, on mesure,
    on corrige, et on recommence. Quatre ou cinq passes suffisent a tomber
    a moins d'un millimetre de la cible.
    """
    rayons = {g: [m[3] / SEUIL_BILLE for m in masses]
              for g, masses in groupes.items()}
    ecarts = {}
    for p in range(passes):
        vider()
        ecarts = {}
        for g, masses in groupes.items():
            obj = sculpter('MG_' + g, masses, rayons[g], resolution)
            zs = [m[2] for m in masses]
            zmin, zmax = min(zs), max(zs)
            ay = masses[0][1]
            pires = 0.0
            for i, (bx, by, bz, cible, dx, dy) in enumerate(masses):
                # Les masses du bout ferment le volume — un sommet de crane
                # n'a pas de section a mesurer, et vouloir l'y forcer fait
                # diverger la calibration sans rien ameliorer. On les laisse
                # ou elles sont et on ne juge que ce qui a une epaisseur.
                if bz - zmin < 0.008 or zmax - bz < 0.008:
                    continue
                m = relever(obj, 0.0, ay, bz)
                if not m:
                    continue
                obtenu = m[2]
                if obtenu < 1e-5:
                    continue
                e = abs(obtenu - cible)
                pires = max(pires, e)
                if p < passes - 1:
                    # correction amortie : une bille tire sur ses voisines,
                    # corriger a fond les fait osciller sans converger.
                    rayons[g][i] *= (cible / obtenu) ** 0.62
            ecarts[g] = pires
        pire = max(ecarts.values()) if ecarts else 0.0
        print('  passe %d : ecart max %.4f m' % (p + 1, pire))
    return rayons, ecarts


def mesurer(groupes, rayons, fem, resolution=0.0045):
    """Relever les profils definitifs, aux trois niveaux de detail."""
    vider()
    objets = {}
    for g, masses in groupes.items():
        objets[g] = sculpter('MG_' + g, masses, rayons[g], resolution)

    sortie = []
    for nom, groupe, (zw0, zw1), zl0, (ax, ay), ns in anatomie.chaines(fem):
        obj = objets[groupe]
        h = zw1 - zw0
        niveaux = []
        for n in ns:
            bornes = []
            for k in range(n + 1):
                t = k / n
                zw = zw0 + t * h
                # jamais pile sur le bord : la peau s'y referme.
                zm = min(max(zw, zw0 + 0.004), zw1 - 0.004)
                m = relever(obj, ax, ay, zm)
                if not m:
                    m = bornes[-1][1] if bornes else (0.02, 0.02, 0.02, 0.0)
                bornes.append((zl0 + t * h, m))
            troncs = []
            for k in range(n):
                za, (hxa, hya, _, cxa) = bornes[k]
                zb, (hxb, hyb, _, cxb) = bornes[k + 1]
                troncs.append([round((za + zb) * 0.5, 5), round((zb - za) * 0.5, 5),
                               round((cxa + cxb) * 0.5, 5),
                               round(hxa, 5), round(hya, 5),
                               round(hxb, 5), round(hyb, 5)])
            niveaux.append(troncs)
        sortie.append({'nom': nom, 'axe': [round(ax, 5), round(ay, 5)],
                       'niveaux': niveaux})
    return sortie


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    sortie = 'src/game/coureur-hd.json'
    if '--sortie' in args:
        sortie = args[args.index('--sortie') + 1]

    data = {}
    for cle, fem in (('m', False), ('f', True)):
        print('== gabarit %s ==' % cle)
        groupes = anatomie.masses(fem=fem)
        rayons, ecarts = calibrer(groupes)
        print('  ecarts finaux : ' + ', '.join(
            '%s %.1fmm' % (g, e * 1000) for g, e in sorted(ecarts.items())))
        data[cle] = mesurer(groupes, rayons, fem)
        data[cle + '_ecarts_mm'] = {g: round(e * 1000, 2) for g, e in ecarts.items()}
        # les rayons calibres servent au rendu du corps entier
        data[cle + '_rayons'] = {g: [round(v, 5) for v in rs]
                                 for g, rs in rayons.items()}

    os.makedirs(os.path.dirname(sortie) or '.', exist_ok=True)
    with open(sortie, 'w') as f:
        json.dump(data, f, indent=1)
    print('ecrit : %s' % sortie)


# Importe par rendu.py pour reutiliser le sculpteur : dans ce cas-la, rien
# ne doit se mesurer ni s'ecrire.
if __name__ == '__main__':
    main()
