# -----------------------------------------------------------------------
# SPRINTER — LES CORPS ABOUTIS DE LA VILLE, D'APRES MAKEHUMAN (26/10/2026).
#
#   blender -b -P tools/blender/corps_mpfb.py -- --variante femme-tshirt-jean --glb public/modeles/gens/femme-tshirt-jean.glb
#   (ou --toutes --dossier public/modeles/gens)
#
# L'AUTEUR, 26/10 : « pourquoi je ne peux pas avoir un personnage aussi abouti ? »
# (Lagos Life), puis « fais de ce prototype les corps du jeu, femmes et hommes,
# plusieurs tenues ». MakeHuman (extension MPFB2, deja installee) et ses assets
# CC0 (assets-sources/makehuman/, installes dans le dossier de donnees de MPFB) :
# un vrai visage (yeux, sourcils, cils), de vraies coiffures, des vetements qui ont
# leur forme et leur texture, des peaux noires bien rendues.
#
# DEUX TEMPS DANS UN SEUL BLENDER :
# 1. MPFB assemble le personnage avec son squelette « game_engine » et SES poids, et
#    fond toutes les pieces en un maillage. Les textures de chaque piece sont rangees
#    dans une seule image (une case par matiere) : on deplace les UV, on ne recalcule
#    rien — un appel de dessin.
# 2. Le calage de Meba (meba_maillage.py, fait pour les squelettes MPFB, dont les os
#    portent deja les noms du jeu) : mise en repere, calage sur pose(), repos fige.
#    La chaleur de Blender, elle, ne trouvait aucune solution sur ce maillage en
#    pieces (cils, yeux, cheveux, habits) : 26/10, pas un sommet pondere.
# -----------------------------------------------------------------------

import bpy
import json
import math
import os
import runpy
import sys
import addon_utils
import numpy as np

ICI = os.path.dirname(os.path.abspath(__file__))
V = runpy.run_path(os.path.join(ICI, 'vedette_tripo.py'), run_name='vedette_tripo')
M, CARTOON, G = V['M'], V['CARTOON'], V['G']

# LES DEUX CORPS (macros MPFB), et leur coiffure
FEMME = ({"gender": 0.0, "age": 0.42, "muscle": 0.68, "weight": 0.42, "proportions": 0.75, "height": 0.55,
          "cupsize": 0.5, "firmness": 0.6}, 'young_african_female', 'ponytail01')
HOMME = ({"gender": 1.0, "age": 0.42, "muscle": 0.72, "weight": 0.45, "proportions": 0.75, "height": 0.6,
          "cupsize": 0.5, "firmness": 0.5}, 'young_african_male', 'short02')
# LES SILHOUETTES, pas les tenues : garde-robe.ts a seize tenues, qui ne different que par
# leurs couleurs et ce qu'elles couvrent (manches, jambes). Chaque silhouette porte de
# vrais vetements MakeHuman, que le jeu teint aux couleurs de la tenue (ville.ts).
SILHOUETTES = {
    'debardeur-short': (['toigo_keyhole_tank_top', 'cortu_jeans_shorts', 'shoes02'],) * 2,
    'tshirt-short': (['joepal_crude_t-shirt_female', 'cortu_jeans_shorts', 'shoes02'],
                     ['elvs_crude_t-shirt_male', 'cortu_jeans_shorts', 'shoes02']),
    'tshirt-pantalon': (['joepal_crude_t-shirt_female', 'cortu_cargo_pants', 'shoes01'],
                        ['elvs_crude_t-shirt_male', 'cortu_cargo_pants', 'shoes03']),
    'pull-pantalon': (['toigo_fisherman_sweater', 'toigo_wool_pants', 'shoes01'],
                      ['toigo_fisherman_sweater', 'toigo_wool_pants', 'shoes03']),
    'robe': (['toigo_shift_dress', 'toigo_flats'], None),
}
VARIANTES = {f'{c}-{s}': (corps, habits[k]) for s, habits in SILHOUETTES.items()
             for k, (c, corps) in enumerate((('femme', FEMME), ('homme', HOMME))) if habits[k]}
# LES ORIGINES (« propose des noirs, des blancs, des asiatiques, des indiens », l'auteur, 26/10) : le
# corps de base est africain ; les deux autres races de MakeHuman sont des cles de forme, que le jeu
# melange (ville.ts : indien, metis, maghrebin... sont des dosages). La peau, elle, est teinte a part.
ORIGINES = {'europe': {"african": 0.0, "asian": 0.0, "caucasian": 1.0}, 'asie': {"african": 0.0, "asian": 1.0, "caucasian": 0.0}}
# LES ZONES que le jeu teint : l'indice est range dans la deuxieme carte UV (u), lu par ville.ts.
PEAU, HAUT, BAS, CHAUSSURES, CHEVEUX, FIXE = range(6)
def zone_de(habit):
    if habit.startswith(('shoes', 'toigo_flats')): return CHAUSSURES
    if any(k in habit for k in ('pants', 'shorts')): return BAS
    return HAUT
ATLAS = 1024
# le gris moyen d'une piece teinte (ville.ts multiplie par la couleur / GRIS) : de la marge pour les reflets
GRIS = 0.6
RELIEF = 0.5


def arguments():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    val = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    return {'variante': val('--variante'), 'glb': val('--glb'), 'toutes': '--toutes' in a,
            'dossier': val('--dossier', 'public/modeles/gens'), 'apercu': val('--apercu')}


def mpfb():
    addon_utils.enable('bl_ext.blender_org.mpfb', default_set=True)
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
    from bl_ext.blender_org.mpfb.services.locationservice import LocationService
    from bl_ext.blender_org.mpfb.services.rigservice import RigService
    return HumanService, LocationService, RigService


def image_diffuse(mat):
    """La texture de couleur d'une matiere MPFB (ni normale, ni rugosite, ni AO)."""
    if not mat or not mat.use_nodes:
        return None
    for n in mat.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            nom = n.image.name.lower()
            if not any(k in nom for k in ('normal', 'nrm', '_ao', 'rough', 'bump', 'spec', 'displac')):
                return n.image
    return None


def assembler(cle, race=None):
    """Temps 1 : le personnage MPFB, en T, fondu en un maillage a une seule texture."""
    HumanService, LocationService, RigService = mpfb()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    (corps, peau, coiffure), habits = VARIANTES[cle]
    D = LocationService.get_user_data()
    p = lambda *a: os.path.join(D, *a)
    macros = dict(corps, race=race or {"african": 1.0, "asian": 0.0, "caucasian": 0.0})
    h = HumanService.create_human(macro_detail_dict=macros)
    rig = HumanService.add_builtin_rig(h, 'game_engine', import_weights=True)
    HumanService.set_character_skin(p('skins', peau, peau + '.mhmat'), h, skin_type="GAMEENGINE")
    pieces = [("Eyes", p('eyes', 'low-poly', 'low-poly.mhclo')), ("Eyebrows", p('eyebrows', 'eyebrow001', 'eyebrow001.mhclo')),
              ("Eyelashes", p('eyelashes', 'eyelashes01', 'eyelashes01.mhclo')), ("Hair", p('hair', coiffure, coiffure + '.mhclo'))]
    pieces += [("Clothes", p('clothes', c, c + '.mhclo')) for c in habits]
    zones = {h.name: PEAU}
    for (typ, f), z in zip(pieces, [FIXE, FIXE, FIXE, CHEVEUX] + [zone_de(c) for c in habits]):
        avant = set(bpy.data.objects)
        HumanService.add_mhclo_asset(f, h, asset_type=typ, subdiv_levels=0, material_type="MAKESKIN", set_up_rigging=True)
        for o in set(bpy.data.objects) - avant: zones[o.name] = z
    mailles = [o for o in bpy.data.objects if o.type == 'MESH']
    # les masques appliques (geometries d'aide, peau cachee sous les habits), l'armature coupee :
    # le maillage au repos tel que Blender l'evalue, ses groupes de poids gardes
    for o in mailles:
        for m in o.modifiers:
            if m.type == 'ARMATURE': m.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    for o in mailles:
        neuf = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        mw = o.matrix_world.copy()
        o.modifiers.clear(); o.data = neuf; o.parent = None; o.matrix_world = mw
    # la zone de chaque piece, dans une deuxieme carte UV (les noms unifies pour que la fusion les garde)
    teinte = {}
    for o in mailles:
        z = zones.get(o.name, FIXE)
        for s in o.material_slots:
            if s.material: teinte[s.material.name] = z != FIXE
        while len(o.data.uv_layers) > 1: o.data.uv_layers.remove(o.data.uv_layers[-1])
        o.data.uv_layers[0].name = 'UVMap'
        zl = o.data.uv_layers.new(name='zone')
        for d in zl.data: d.uv = (z, 0)
    # l'atlas : une case par matiere (sa texture reduite), les UV deplaces dans leur case
    mats = []
    for o in mailles:
        for s in o.material_slots:
            if s.material and s.material not in mats: mats.append(s.material)
    n = max(1, math.ceil(math.sqrt(len(mats)))); case = ATLAS // n
    import numpy as np
    atlas = np.zeros((ATLAS, ATLAS, 4), dtype=np.float32); atlas[..., 3] = 1
    place = {}
    for k, m in enumerate(mats):
        cx, cy = k % n, k // n
        place[m.name] = (cx, cy)
        img = image_diffuse(m)
        if img is None:
            c = [GRIS] * 3 + [1] if teinte.get(m.name) else list(m.diffuse_color)
            atlas[cy * case:(cy + 1) * case, cx * case:(cx + 1) * case] = c; continue
        im = img.copy(); im.scale(case, case)
        px = np.array(im.pixels[:], dtype=np.float32).reshape(case, case, 4)
        if teinte.get(m.name):
            # une piece teinte par le jeu : son relief seul (gris, moyenne a GRIS), la couleur viendra de la tenue
            lum = px[..., :3] @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
            # la moyenne sur le tissu seul (ni le fond noir ni le transparent), et le relief adouci de moitie :
            # les motifs imprimes, devenus gris, faisaient des plaques claires sous la couleur de la tenue
            vu = (px[..., 3] > 0.5) & (lum > 0.03)
            moy = max(1e-3, float(lum[vu].mean() if vu.any() else lum.mean()))
            px[..., :3] = np.clip(GRIS * (1 + RELIEF * (lum / moy - 1)), 0, 1)[..., None]
        atlas[cy * case:(cy + 1) * case, cx * case:(cx + 1) * case] = px
        bpy.data.images.remove(im)
    for o in mailles:
        uv = o.data.uv_layers['UVMap']; uv.active = uv.active_render = True
        if not uv: continue
        for poly in o.data.polygons:
            m = o.material_slots[poly.material_index].material if o.material_slots else None
            cx, cy = place.get(m.name, (0, 0)) if m else (0, 0)
            for li in poly.loop_indices:
                u, v = uv.data[li].uv
                u = u % 1.0 if (u < 0 or u > 1) else u; v = v % 1.0 if (v < 0 or v > 1) else v
                uv.data[li].uv = ((cx + u) / n, (cy + v) / n)
    image = bpy.data.images.new('atlas', ATLAS, ATLAS, alpha=True)
    image.pixels = atlas.ravel().tolist()
    mat = bpy.data.materials.new('Gens_atlas'); mat.use_nodes = True
    bsdf = next(x for x in mat.node_tree.nodes if x.type == 'BSDF_PRINCIPLED')
    t = mat.node_tree.nodes.new('ShaderNodeTexImage'); t.image = image
    mat.node_tree.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    mat.node_tree.links.new(t.outputs['Alpha'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.7
    for o in mailles:
        o.data.materials.clear(); o.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    for o in mailles: o.select_set(True)
    bpy.context.view_layer.objects.active = mailles[0]
    bpy.ops.object.join()
    h = bpy.context.view_layer.objects.active
    h.name = 'Corps'
    h.modifiers.new('Armature', 'ARMATURE').object = rig
    rig.data.bones['Root'].name = 'root'
    tris = sum(len(pp.vertices) - 2 for pp in h.data.polygons)
    print('ASSEMBLE', cle, 'triangles', tris, 'matieres', len(mats), 'case', case, 'groupes', len(h.vertex_groups))
    return h, rig


def finir(h, rig):
    """Comme corps_ville.exporter jusqu'a l'ecriture : le rig au repos, quatre os par sommet, le miroir du jeu."""
    for pb in rig.pose.bones:
        pb.matrix_basis = V['Matrix'].Identity(4)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    h.select_set(True); bpy.context.view_layer.objects.active = h
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    rig.select_set(True); bpy.context.view_layer.objects.active = rig
    mw = h.matrix_world.copy(); h.parent = rig; h.matrix_world = mw
    for m in h.data.materials:
        m.blend_method = 'CLIP' if hasattr(m, 'blend_method') else None
    V['miroir'](h)


def exporter(h, rig, chemin, morphes):
    """Les origines en cles de forme (morph targets du glTF), puis le fichier."""
    if morphes:
        h.shape_key_add(name='Basis', from_mix=False)
        for nom, co in morphes.items():
            assert len(co) == len(h.data.vertices) * 3, (nom, len(co) // 3, len(h.data.vertices))
            h.shape_key_add(name=nom, from_mix=False).data.foreach_set('co', co)
    bpy.ops.object.select_all(action='DESELECT')
    h.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    os.makedirs(os.path.dirname(os.path.abspath(chemin)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=chemin, export_format='GLB', use_selection=True,
                              use_active_scene=True, export_skins=True, export_animations=False,
                              export_morph=True, export_morph_normal=False, export_yup=True, export_apply=False,
                              export_attributes=False, export_def_bones=False,
                              export_image_format='AUTO', export_meshopt_compression_enable=True)
    print('GLB :', chemin, os.path.getsize(chemin), 'octets')


def rigger(h, rig):
    """Temps 2 : le calage de Meba et des vedettes, sur les poids de MPFB."""
    M['mise_en_repere'](h, rig)
    b = rig.data.bones
    G['SH_Y'] = b['upperarm_l'].head_local.y
    G['HIP_Y'] = b['thigh_l'].head_local.y
    herite = M['caler'](rig, CARTOON['cibles'](rig, cou=1.0))
    CARTOON['figer'](h, rig, herite)
    V['deplier_aisselles'](h, rig)
    V['sternum_au_buste'](h, rig)
    finir(h, rig)
    return h, rig


if __name__ == '__main__' and bpy.app.background:
    A = arguments()
    cles = list(VARIANTES) if A['toutes'] else [A['variante']]
    for cle in cles:
        glb = A['glb'] if not A['toutes'] else os.path.join(A['dossier'], cle + '.glb')
        # chaque origine est construite a part (memes pieces, meme topologie) ; on n'en garde que la forme
        morphes = {}
        for nom, race in ORIGINES.items():
            h, rig = rigger(*assembler(cle, race))
            co = np.zeros(len(h.data.vertices) * 3, dtype=np.float32); h.data.vertices.foreach_get('co', co)
            morphes[nom] = co
        exporter(*rigger(*assembler(cle)), glb, morphes)
