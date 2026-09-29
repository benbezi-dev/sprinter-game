# -----------------------------------------------------------------------
# SPRINTER — fabriquer les decors des stades.
#
#   blender -b --factory-startup -P tools/blender/decors/fabriquer.py -- --stade day
#   ... -- --stade day --ultra          la serie du palier ULTRA
#
# --factory-startup : sans lui, Blender charge aussi en arriere-plan les
# extensions de l'utilisateur (une trentaine installees le 29/09/2026), qui
# peuvent toucher a la scene. Aucun de ces scripts n'en a besoin.
#
# Pour chaque piece : on la construit dans le repere du jeu, on la rend sous
# la vue du jeu avec la lumiere du jeu, on rend a part l'ombre qu'elle jette
# au sol, on assemble les deux, on recoupe au plus juste et on ecrit une
# image WebP dans public/decors/<stade>/. Le manifeste dit au moteur ou est
# le pied de la piece dans l'image et combien de pixels vaut un metre.
#
# DEUX RENDUS, ET NON UN. La couleur vient d'une emission (voir matiere.py) :
# elle ne recoit donc aucune ombre, et c'est voulu, puisque le jeu n'en
# calcule pas non plus sur ses personnages. L'ombre au sol, elle, est une
# vraie ombre de soleil, rendue par Cycles sur un attrape-ombre invisible :
# c'est elle qui pose un objet de sept metres sur la pelouse au lieu de le
# faire flotter.
# -----------------------------------------------------------------------

import bpy
import sys
import os
import math
import json
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vue
import matiere
import palettes
import pieces
import importlib
import reel
for mod in (vue, matiere, palettes, pieces, reel):
    importlib.reload(mod)
# Les pieces en eclairage reel s'inscrivent dans pieces.DEBOUT : apres le
# rechargement de `pieces`, sans quoi elles en seraient effacees.
import pieces_arcenciel
importlib.reload(pieces_arcenciel)

RACINE_PROJET = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
PX_PAR_M = 96.0
# Les pieces orientees sont rendues aux caps ou le moteur les pose : le long
# d'une ligne droite, dans un sens ou dans l'autre, et avec ou sans la
# rotation de vue que le moteur applique aux courses en virage (WROT, -14
# degres). Une cage ou un mat se regarde pareil de partout et n'a qu'un cap.
WROT = -14.0
CAPS = [0.0, 180.0, WROT, 180.0 + WROT]
# DANS LE VIRAGE, UNE PIECE ORIENTEE PREND TOUS LES CAPS. Elle suit la courbe
# de la piste : a mi-virage, un tapis de saut rendu sous les quatre caps des
# lignes droites s'affichait encore aligne sur l'une d'elles, a cinquante
# degres de ce qu'il aurait du etre. Seize caps reguliers ramenent l'erreur a
# onze degres au pire ; les quatre caps exacts des lignes droites restent, car
# c'est la qu'un tapis se lit contre les lignes de couloir.
CAPS_VIRAGE = sorted(set(CAPS + [22.5 * k for k in range(16)]))
CONTOURS = False
# Les rendus intermediaires, un jeu par processus : deux Blender qui tournaient
# en meme temps s'echangeaient leur couleur et leur ombre par /tmp, et
# l'assemblage melait deux pieces (ou plantait, quand leurs tailles
# differaient).
TMP = '/tmp/decor-%s-' + str(os.getpid()) + '.png'
# A l'ULTRA, l'ombre au sol se rend a demi-densite puis s'agrandit : c'est le
# rendu Cycles, de loin le plus long — deux minutes pour une grande piece a
# 192 px/m —, et une ombre de soleil a 3,5 degres est floue de toute facon.
# La piece elle-meme reste a pleine densite. Pose par main().
OMBRE_DEMI = False
# Echantillons d'anticrenelage du rendu couleur, et ombre au sol ou non :
# reglages de stade (voir palettes.STADES).
ECHANTILLONS = 32
SANS_OMBRE = False
# 'jeu' : la formule de lumiere du moteur, en emission (matiere.py).
# 'reel' : Cycles, matieres physiques et halo des neons (reel.py).
ECLAIRAGE = 'jeu'


def cle_cap(cap):
    """Le cap en texte : entier quand il l'est, au dixieme sinon (11,25 -> 11.3)."""
    c = cap % 360.0
    return str(int(round(c))) if abs(c - round(c)) < 0.05 else ('%.1f' % c)


def vider():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def construire(stade, nom, cap):
    vider()
    racine = vue.racine_miroir()
    tourne = bpy.data.objects.new('CAP', None)
    bpy.context.collection.objects.link(tourne)
    tourne.parent = racine
    tourne.rotation_euler = (0, 0, math.radians(cap))
    pieces.commencer(tourne)
    P = palettes.PALETTES[stade]
    (pieces.DEBOUT.get(nom) or pieces.AU_SOL.get(nom))(P)
    bpy.context.view_layer.update()
    return racine


def points_jeu(avec_ombre_seul=False):
    """Tous les sommets de la piece, dans le repere du jeu."""
    pts = []
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        if o.get('sans_ombre') and avec_ombre_seul:
            continue
        mw = o.matrix_world
        for v in o.data.vertices:
            w = mw @ v.co
            pts.append((w.y, w.x, w.z))       # retour du miroir
    return pts


def portee(pts):
    """Jusqu'ou la piece semble avancer vers la piste, a l'ecran, en metres.

    Un point a la hauteur z se dessine la ou se dessinerait un point du sol
    decale de z / sin vers l'exterieur du stade (voir ground/solid). Le long
    d'une ligne droite, la pelouse est SOUS la piste a l'image : tout ce qui
    monte avance vers les couloirs. C'est ce chiffre que le moteur compare a
    la distance au bord de piste pour ne jamais poser une piece par-dessus la
    course.
    """
    return round(max(Y + Z / vue.SIN for X, Y, Z in pts), 2)


def cadre(pts, avec_ombre):
    """Le rectangle d'image qui contient la piece et son ombre, en unites ecran."""
    L = matiere.LUMIERE
    ecr = []
    for X, Y, Z in pts:
        ecr.append((vue.COS * (-X + Y), -(vue.SIN * (X + Y) + Z)))
        if avec_ombre and Z > 0.02:
            # le point d'ombre au sol, le long du rayon de soleil
            sx, sy = X - L[0] / L[2] * Z, Y - L[1] / L[2] * Z
            ecr.append((vue.COS * (-sx + sy), -(vue.SIN * (sx + sy))))
    xs = [p[0] for p in ecr]
    ys = [p[1] for p in ecr]
    return min(xs), min(ys), max(xs), max(ys)


def centre_jeu(sx, sy):
    """Le point au sol du jeu qui tombe au milieu de l'ecran (sx, sy)."""
    return ((-sy / vue.SIN - sx / vue.COS) / 2, (-sy / vue.SIN + sx / vue.COS) / 2, 0.0)


def _pixels(img, w, h):
    """Les pixels d'une image, en un seul appel. `img.pixels[:]` passait par une
    liste Python de w x h x 4 nombres : a la densite de la serie ULTRA, trente
    millions par passe, et plus de temps que le rendu lui-meme."""
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(h, w, 4)


def lire(f, taille=None):
    img = bpy.data.images.load(f)
    if taille and tuple(img.size) != tuple(taille):
        img.scale(*taille)
    w, h = img.size
    a = _pixels(img, w, h)
    bpy.data.images.remove(img)
    return a[::-1]          # ligne 0 en haut


def ecrire_webp(a, f, qualite=92):
    h, w = a.shape[:2]
    img = bpy.data.images.new('sortie', w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(a[::-1], dtype=np.float32).ravel())
    img.filepath_raw = f
    img.file_format = 'WEBP'
    sc = bpy.context.scene
    sc.render.image_settings.quality = qualite
    img.save()
    bpy.data.images.remove(img)


def rendre_reel(stade, nom, cap, dossier):
    """Une piece en eclairage reel : Cycles, puis le halo de ce qui brille."""
    construire(stade, nom, cap)
    pts = points_jeu()
    x0, y0, x1, y1 = cadre(pts, False)
    marge = 0.3
    W = int(math.ceil((x1 - x0 + 2 * marge) * PX_PAR_M))
    H = int(math.ceil((y1 - y0 + 2 * marge) * PX_PAR_M))
    c = centre_jeu((x0 + x1) / 2, (y0 + y1) / 2)
    sc = bpy.context.scene
    cam = vue.camera(PX_PAR_M, W, H, centre=c)
    reel.reglages(sc, ECHANTILLONS)
    reel.monde_spatial(sc)
    reel.lumieres(sc)
    f_col = TMP % 'reel'
    sc.render.filepath = f_col
    bpy.ops.render.render(write_still=True)
    ancre = vue.ancre_pixel(cam, (0, 0, 0))
    # Le halo deborde du cadre : on l'agrandit d'autant, et l'ancre suit.
    bord = int(round(0.35 * PX_PAR_M))
    out = reel.halo_lumineux(lire(f_col), marge=bord)
    return recouper_et_ecrire(out, (ancre[0] + bord, ancre[1] + bord),
                              os.path.join(dossier, '%s-%s.webp' % (nom, cle_cap(cap))))


def rendre_debout(stade, nom, cap, dossier):
    if ECLAIRAGE == 'reel':
        return rendre_reel(stade, nom, cap, dossier)
    construire(stade, nom, cap)
    pts = points_jeu()
    x0, y0, x1, y1 = cadre(pts, True)
    marge = 0.25
    W = int(math.ceil((x1 - x0 + 2 * marge) * PX_PAR_M))
    H = int(math.ceil((y1 - y0 + 2 * marge) * PX_PAR_M))
    c = centre_jeu((x0 + x1) / 2, (y0 + y1) / 2)
    sc = bpy.context.scene
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Raw'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'

    # --- la couleur : EEVEE, emission, aucune correction
    cam = vue.camera(PX_PAR_M, W, H, centre=c)
    if CONTOURS:
        # Le trait des dessins animes : silhouettes et aretes vives, a
        # epaisseur fixe en pixels, comme un cerne a l'encre.
        sc.render.use_freestyle = True
        sc.render.line_thickness_mode = 'ABSOLUTE'
        sc.render.line_thickness = 2.6
        vl = bpy.context.view_layer
        vl.use_freestyle = True
        fs = vl.freestyle_settings
        ls = fs.linesets[0] if fs.linesets else fs.linesets.new('trait')
        ls.select_by_visibility = True
        ls.select_silhouette = True
        ls.select_border = True
        ls.select_crease = True
        # une scene repartie de zero n'a pas de style de trait : on le cree
        if ls.linestyle is None:
            ls.linestyle = bpy.data.linestyles.new('encre')
        ls.linestyle.color = (0.04, 0.10, 0.10)
        ls.linestyle.thickness = 2.6
    vue.eevee(sc)
    sc.eevee.taa_render_samples = ECHANTILLONS
    f_col = TMP % 'couleur'
    sc.render.filepath = f_col
    bpy.ops.render.render(write_still=True)
    ancre = vue.ancre_pixel(cam, (0, 0, 0))
    if SANS_OMBRE:
        # Un stade sans sol : la couleur seule, sa lueur tient lieu d'ombre.
        return recouper_et_ecrire(lire(f_col), ancre,
                                  os.path.join(dossier, '%s-%s.webp' % (nom, cle_cap(cap))))

    # --- l'ombre : Cycles, la piece invisible a la camera mais pas au soleil
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.visible_camera = False
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
    sol = bpy.context.active_object
    sol.is_shadow_catcher = True
    vue.soleil(force=4.0).data.angle = math.radians(3.5)
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 32
    sc.cycles.use_denoising = True
    vue.cycles_gpu(sc)
    f_omb = TMP % 'ombre'
    sc.render.filepath = f_omb
    sc.render.resolution_percentage = 50 if OMBRE_DEMI else 100
    bpy.ops.render.render(write_still=True)
    sc.render.resolution_percentage = 100

    col = lire(f_col)
    omb = lire(f_omb, (W, H))
    # l'attrape-ombre rend du noir ou l'ombre tombe, sa densite dans l'alpha
    S = np.clip(omb[..., 3], 0, 1) * 0.34
    Ca = col[..., 3:4]
    teinte = np.array([0.02, 0.06, 0.04], dtype=np.float32)
    out_a = Ca[..., 0] + S * (1 - Ca[..., 0])
    num = col[..., :3] * Ca + teinte * (S * (1 - Ca[..., 0]))[..., None]
    out = np.zeros_like(col)
    ok = out_a > 1e-4
    out[..., :3][ok] = num[ok] / out_a[ok][:, None]
    out[..., 3] = out_a
    r = recouper_et_ecrire(out, ancre, os.path.join(dossier, '%s-%s.webp' % (nom, cle_cap(cap))))
    # la portee se mesure sur la piece a plat, cap 0 : c'est dans ce repere
    # que le moteur la pose le long de la piste
    return r


def recouper_et_ecrire(out, ancre, f):
    alpha = out[..., 3]
    ys, xs = np.nonzero(alpha > 0.004)
    if len(xs) == 0:
        raise RuntimeError('rendu vide : ' + f)
    ax0, ax1 = max(0, xs.min() - 2), min(out.shape[1], xs.max() + 3)
    ay0, ay1 = max(0, ys.min() - 2), min(out.shape[0], ys.max() + 3)
    out = out[ay0:ay1, ax0:ax1]
    ecrire_webp(out, f)
    return {'f': os.path.basename(f), 'w': int(ax1 - ax0), 'h': int(ay1 - ay0),
            'ax': round(ancre[0] - ax0, 2), 'ay': round(ancre[1] - ay0, 2)}


def rendre_sol(stade, nom, dossier, px_par_m=48.0):
    """Un marquage au sol, vu d'aplomb : une texture en metres du jeu."""
    construire(stade, nom, 0.0)
    pts = points_jeu()
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    X0, X1, Y0, Y1 = min(xs) - 0.1, max(xs) + 0.1, min(ys) - 0.1, max(ys) + 0.1
    W = int(math.ceil((X1 - X0) * px_par_m))
    H = int(math.ceil((Y1 - Y0) * px_par_m))
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.pixel_aspect_x = sc.render.pixel_aspect_y = 1.0
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Raw'
    vue.eevee(sc)
    sc.eevee.taa_render_samples = 16
    cd = bpy.data.cameras.new('dessus')
    cd.type = 'ORTHO'
    cd.ortho_scale = max(X1 - X0, Y1 - Y0)
    cam = bpy.data.objects.new('dessus', cd)
    bpy.context.collection.objects.link(cam)
    sc.camera = cam
    # Vue d'aplomb dans la scene miroir : l'axe X du jeu y est Y. On oriente
    # la camera pour que la droite de l'image soit +X du jeu et le BAS de
    # l'image +Y du jeu — le moteur plaque la texture dans ce sens-la.
    import mathutils
    cam.location = ((Y0 + Y1) / 2, (X0 + X1) / 2, 50)
    droite = mathutils.Vector((0, 1, 0))        # +X jeu
    haut = mathutils.Vector((-1, 0, 0))         # -Y jeu
    regard = mathutils.Vector((0, 0, -1))
    cam.matrix_world = mathutils.Matrix.Translation(cam.location) @ \
        mathutils.Matrix((droite, haut, -regard)).transposed().to_4x4()
    f = TMP % 'sol'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.filepath = f
    bpy.ops.render.render(write_still=True)
    a = lire(f)
    sortie = os.path.join(dossier, '%s.webp' % nom)
    ecrire_webp(a, sortie)
    return {'f': os.path.basename(sortie), 'x0': round(X0, 3), 'y0': round(Y0, 3),
            'mw': round(W / px_par_m, 4), 'mh': round(H / px_par_m, 4)}


def main():
    global PX_PAR_M, CONTOURS, ECHANTILLONS, SANS_OMBRE, ECLAIRAGE, OMBRE_DEMI
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    stade = args[args.index('--stade') + 1] if '--stade' in args else 'day'
    seules = args[args.index('--pieces') + 1].split(',') if '--pieces' in args else None
    # --ultra : la serie du palier ULTRA du jeu (voir decors-stades.js). Deux
    # fois la densite, des formes rondes trois fois plus fines (pieces.FINESSE),
    # dans son propre dossier et son propre manifeste : le jeu ne la charge
    # qu'a trois pixels par point, et garde la serie ordinaire en secours.
    ultra = '--ultra' in args
    dossier = os.path.join(RACINE_PROJET, 'public', 'decors-ultra' if ultra else 'decors', stade)
    os.makedirs(dossier, exist_ok=True)
    f_man = os.path.join(RACINE_PROJET, 'src', 'game',
                         'decors-manifeste-ultra.json' if ultra else 'decors-manifeste.json')
    man = json.load(open(f_man)) if os.path.exists(f_man) else \
        {'pxParM': 192.0 if ultra else 96.0, 'stades': {}}
    entree = man['stades'].setdefault(stade, {'debout': {}, 'sol': {}})

    cfg = palettes.STADES[stade]
    PX_PAR_M = float(cfg.get('pxParM', 96.0)) * (2 if ultra else 1)
    pieces.FINESSE = 3 if ultra else 1
    OMBRE_DEMI = ultra
    SYMETRIQUES = set(cfg.get('symetriques', []))
    CONTOURS = bool(cfg.get('contours'))
    ECHANTILLONS = int(cfg.get('echantillons', 32))
    SANS_OMBRE = bool(cfg.get('sansOmbre'))
    ECLAIRAGE = cfg.get('eclairage', 'jeu')
    for nom in cfg['debout']:
        if seules and nom not in seules:
            continue
        if cfg.get('caps'):
            caps = [360.0 * k / cfg['caps'] for k in range(cfg['caps'])]
        else:
            caps = [0.0] if nom in SYMETRIQUES else \
                (CAPS_VIRAGE if nom in cfg.get('virage', []) else CAPS)
        # --apercu : un seul cap, pour juger une piece avant sa serie complete.
        if '--apercu' in args:
            caps = caps[:1]
        deja = entree['debout'].get(nom, {}) if '--completer' in args else {}
        entree['debout'][nom] = deja
        construire(stade, nom, 0.0)
        port = portee(points_jeu(avec_ombre_seul=True))
        for cap in caps:
            cle = cle_cap(cap)
            if cle in deja:
                continue
            r = rendre_debout(stade, nom, cap, dossier)
            r['portee'] = port
            if ultra or PX_PAR_M != man.get('pxParM', 96.0):
                r['ppm'] = PX_PAR_M
            entree['debout'][nom][cle] = r
            # ecrit a chaque rendu : une serie longue interrompue ne perd rien
            json.dump(man, open(f_man, 'w'), indent=1, sort_keys=True)
            print('  %s %s cap %d : %dx%d' % (stade, nom, cap, r['w'], r['h']))
    for nom in cfg['sol']:
        if seules and nom not in seules:
            continue
        entree['sol'][nom] = rendre_sol(stade, nom, dossier)
        print('  %s %s (sol)' % (stade, nom))
    json.dump(man, open(f_man, 'w'), indent=1, sort_keys=True)
    print('manifeste : ' + f_man)


if __name__ == '__main__':
    main()
