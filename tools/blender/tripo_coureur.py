# -----------------------------------------------------------------------
# SPRINTER — UN CORPS TRIPO EN COUREUR DU JEU (08/11/2026).
#
#   Blender -b --factory-startup -P tools/blender/tripo_coureur.py -- \
#       --source assets-sources/tripo-coureurs-sprint/modeles/homme-tripo-hd.glb --taille 1.66 --glb <sortie.glb>
#   puis les pointes : chaussures_coureur.py <sortie.glb> <logo.png> public/modeles/coureur-homme.glb
#
# L'auteur, 08/11, sur les coureurs Rocketbox : « son torse est trop large son ventre trop gros ce n'est pas la
# morphologie d'un athlete type sprint », « pareil pour la femme ». Deux corps de sprinteurs faits dans Tripo
# (image en pose en T, modele HD ; sources et registre dans assets-sources/tripo-coureurs-sprint/).
#
# On recolle deux chaines qui existent :
#   - vedette_tripo.py pour ce que Tripo ne donne pas : les articulations lues sur le corps, les doigts, le
#     squelette aux noms du jeu, les poids ;
#   - rocketbox_coureur.py pour le reste du coureur GENERIQUE : le repere, le calage (bras le long du corps depuis
#     l'epaule du modele, jambes aux longueurs du jeu), les zones teintes, les vetements, l'export.
# Avant : le glb HD (environ 1,9 M triangles) est tourne face a -y, bras le long de x (le repere qu'attend
# vedette_tripo.importer), et reduit : la diffusion de chaleur des poids ne passe pas sur deux millions de faces.
# -----------------------------------------------------------------------
import bpy, os, sys, runpy, math, tempfile
from mathutils import Matrix

ICI = os.path.dirname(os.path.abspath(__file__))
V = runpy.run_path(os.path.join(ICI, 'vedette_tripo.py'), run_name='vedette_tripo')
RB = runpy.run_path(os.path.join(ICI, 'rocketbox_coureur.py'), run_name='rocketbox_coureur')
R, GEN, M, CARTOON = RB['R'], RB['GEN'], RB['M'], RB['CARTOON']

FACES = 60000


def arguments():
    a = sys.argv[sys.argv.index('--') + 1:]
    val = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    return {'source': val('--source'), 'taille': float(val('--taille', '1.66')), 'glb': val('--glb'),
            'tourner': float(val('--tourner', '-90')), 'faces': int(val('--faces', str(FACES))),
            'etapes': val('--etapes'), 'voxel': float(val('--voxel', '0.0018'))}


def preparer(source, tourner, faces, voxel):
    """Le glb de Tripo tourne (degres autour de z) et reduit, ecrit a cote pour vedette_tripo.importer."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    h = next(o for o in bpy.data.objects if o.type == 'MESH')
    for o in [o for o in bpy.data.objects if o is not h]: bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.objects.active = h; h.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    h.data.transform(Matrix.Rotation(math.radians(tourner), 4, 'Z'))
    # ETANCHE D'ABORD. Le HD de Tripo a des bords ouverts : les coupes de vedette_tripo.articulations ne trouvaient
    # aucune boucle fermee au tronc, et la hanche tombait a la poitrine. Un remaillage par voxels (la texture ne sert
    # pas : les zones du coureur la remplacent) rend une peau fermee, que la reduction garde fermee.
    haut = h.dimensions.z
    r = h.modifiers.new('etancher', 'REMESH')
    r.mode, r.voxel_size = 'VOXEL', haut * voxel   # (assez fin pour que les doigts restent separes)
    bpy.ops.object.modifier_apply(modifier=r.name)
    d = h.modifiers.new('reduire', 'DECIMATE')
    d.ratio = min(1.0, faces / max(1, len(h.data.polygons)))
    bpy.ops.object.modifier_apply(modifier=d.name)
    # (sans UV ni facettes : l'aller-retour en glTF delierait chaque sommet, et plus aucune coupe ne serait fermee)
    for uv in list(h.data.uv_layers): h.data.uv_layers.remove(uv)
    h.data.materials.clear()
    for p in h.data.polygons: p.use_smooth = True
    print('PREPARE', len(h.data.polygons), 'faces', flush=True)
    sortie = os.path.join(tempfile.gettempdir(), 'tripo_coureur_prepare.glb')
    bpy.ops.export_scene.gltf(filepath=sortie, use_selection=True, export_format='GLB')
    return sortie


def tout(A):
    def etape(n):
        print('ETAPE', n, flush=True)
        if A['etapes']:   # (pour chercher ce qui casse : le fichier Blender apres chaque etape)
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(A['etapes'], n + '.blend'), copy=True)
    src = preparer(A['source'], A['tourner'], A['faces'], A['voxel']); etape('prepare')
    V['M']['scene_neuve']()
    h = V['importer'](src, A['taille'], 'coureur'); etape('importe')
    J = V['articulations'](h, A['taille'], entrejambe_au_tronc=True)
    D = V['doigts'](h, J, A['taille'], soudes=True)
    rig = V['squelette'](J, D, 'Coureur')
    V['ponderer'](h, rig); etape('pondere')
    h.name, rig.name = 'Coureur', 'Coureur'   # (chaussures_coureur.py cherche « Coureur »)
    # le repere, le calage et le figeage des VEDETTES Tripo (vedette_tripo.tout, leur module et leur etat) : ceux du
    # coureur Rocketbox, appliques a ce squelette, etiraient le cou et le buste (essai du 08/11)
    VM, VC = V['M'], V['CARTOON']
    VM['mise_en_repere'](h, rig); etape('repere')
    b = rig.data.bones
    for G in (V['G'], R['G']):
        G['SH_Y'] = b['upperarm_l'].head_local.y
        G['HIP_Y'] = b['thigh_l'].head_local.y
    VC['adoucir_epaules'](h)
    herite = VM['caler'](rig, VC['cibles'](rig, cou=1.0)); etape('cale')
    VC['figer'](h, rig, herite); etape('fige')
    V['deplier_aisselles'](h, rig)
    V['sternum_au_buste'](h, rig)
    GEN['zoner'].__globals__['zone_de_la_face'] = R['zone_du_debardeur']
    GEN['zoner'](h, rig)
    R['decouper_tenues'](h, rig); etape('zone')
    R['vetir'](h, rig); etape('vetu')
    GEN['exporter'](h, rig, A['glb']); etape('exporte')


if __name__ == '__main__' and bpy.app.background:
    tout(arguments())
