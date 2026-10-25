# -----------------------------------------------------------------------
# SPRINTER — LES CORPS DE LA VILLE (carriere d'athlete, 25/10/2026), d'apres le
# coureur generique de la course en 3D (coureur_generique.py, branche course-3d).
#
#   blender -b --factory-startup -P tools/blender/corps_ville.py -- \
#       --source <corps en T.glb> --taille 1.68 --glb public/modeles/corps-femme.glb
#
# L'AUTEUR, 25/10 : « surtout pas un seul corps d'homme, fais femme et homme » et
# « augmente les tenues possibles ». Les memes zones que le coureur, plus celles
# qu'un vetement de ville couvre ou laisse voir : manches, avant-bras, ventre,
# cuisses, mollets. Une tenue (game/athlete/garde-robe.ts) est alors une facon de
# peindre ces zones : un t-shirt peint les manches, un jean les cuisses et les
# mollets, une robe descend jusqu'au genou — sans un maillage par vetement, donc
# leger pour le plus petit telephone.
#
# Le corps vient de « Universal Base Characters » de Quaternius (CC0), sans
# ses yeux ni ses sourcils (voir assets-sources/quaternius-base-characters).
# Il passe par la chaine des vedettes (vedette_tripo.py) : articulations lues
# sur lui, squelette aux noms du jeu, poids, calage sur le rig de pose() —
# c'est ce qui le fait courir exactement comme ses tubes.
#
# CE QUI CHANGE : pas de texture. Un coureur generique porte le look de
# n'importe qui ; le corps est donc decoupe en ZONES, une matiere chacune
# (peau, maillot, short, pointes, cheveux), que game/course-3d.ts teint aux
# couleurs du look a chaque coureur. Les zones se lisent sur l'os qui pese le
# plus sur chaque sommet, et sur sa hauteur au repos.
# -----------------------------------------------------------------------

import bpy
import os
import runpy
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
V = runpy.run_path(os.path.join(ICI, 'vedette_tripo.py'), run_name='vedette_tripo')
M, CARTOON, G = V['M'], V['CARTOON'], V['G']

ZONES = ['peau', 'maillot', 'short', 'pointes', 'cheveux', 'manches', 'avantbras', 'ventre', 'cuisses', 'mollets']


def arguments():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    val = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    return {'source': val('--source'), 'taille': float(val('--taille', '1.78')), 'glb': val('--glb')}


# LES OURLETS SONT DROITS. Lues sommet par sommet, les zones suivaient les
# faces du maillage et le bas du maillot comme celui du short sortaient en
# dents de scie. Le corps est donc coupe a la hauteur exacte de chaque ourlet
# (bisect, les poids des nouveaux sommets interpoles), puis chaque face prend
# sa zone d'apres sa hauteur et l'os qui la porte.
BRAS = ('upperarm', 'lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky')


def zone_de_la_face(nom_os, c, H):
    """UN DEBARDEUR D'ATHLETISME : tout le tronc jusqu'a la ceinture, deux
    bretelles par-dessus les epaules, l'encolure plus ouverte devant que
    derriere, les emmanchures sous l'aisselle. Le devant est en +x (repere du
    jeu)."""
    z, y = c.z, abs(c.y)
    if nom_os.startswith(('foot', 'ball')):
        return 'pointes'
    if nom_os in ('head', 'Head'):
        return 'cheveux' if z > H['tete'] - 0.075 else 'peau'
    if nom_os.startswith(('hand', 'thumb', 'index', 'middle', 'ring', 'pinky')) or nom_os.startswith('neck'):
        return 'peau'
    if nom_os.startswith(BRAS):
        return 'avantbras' if y > H['coude'] else 'manches'
    if z > H['ceinture']:
        if y < H['col'] and z > H['cou'] - (H['decollete'] if c.x > 0 else 0.02):
            return 'peau'                       # l'encolure
        if y > H['bretelle'] and z > H['aisselle']:
            return 'manches'                    # l'emmanchure : nue en debardeur, couverte en t-shirt
        if z < H['ceinture'] + H['ventre']:
            return 'ventre'                     # le nombril : nu sous un crop top
        return 'maillot'
    if z > H['cuisse']:
        return 'short'
    return 'cuisses' if z > H['genou'] else 'mollets'


def zoner(h, rig):
    import bmesh
    from mathutils import Vector
    genou = rig.data.bones['calf_l'].head_local.z
    hanche = rig.data.bones['thigh_l'].head_local.z
    epaule = rig.data.bones['upperarm_l'].head_local
    cou = rig.data.bones['neck_01'].head_local.z
    H = {'ceinture': hanche + 0.07, 'cuisse': genou + 0.17, 'aisselle': epaule.z - 0.07,
         'bretelle': abs(epaule.y) - 0.045, 'col': 0.062, 'cou': cou, 'decollete': 0.085,
         'genou': genou, 'coude': abs(rig.data.bones['lowerarm_l'].head_local.y), 'ventre': 0.12}
    bm = bmesh.new(); bm.from_mesh(h.data)
    plans = [((0, 0, z), (0, 0, 1)) for z in (H['ceinture'], H['cuisse'], H['aisselle'],
                                              H['cou'] - 0.02, H['cou'] - H['decollete'],
                                              H['genou'], H['ceinture'] + H['ventre'])]
    for k in ('bretelle', 'col', 'coude'):
        plans += [((0, H[k], 0), (0, 1, 0)), ((0, -H[k], 0), (0, 1, 0))]
    for co, no in plans:
        geo = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geo, plane_co=Vector(co), plane_no=Vector(no))
    bm.to_mesh(h.data); bm.free(); h.data.update()
    noms = {g.index: g.name for g in h.vertex_groups}
    H['tete'] = max(v.co.z for v in h.data.vertices)
    os_du_sommet = []
    for v in h.data.vertices:
        g = max(v.groups, key=lambda x: x.weight, default=None)
        os_du_sommet.append(noms.get(g.group, '') if g else '')
    h.data.materials.clear()
    for z in ZONES:
        m = bpy.data.materials.new('Coureur_' + z)
        m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Roughness'].default_value = 0.6
        h.data.materials.append(m)
    compte = {z: 0 for z in ZONES}
    for p in h.data.polygons:
        os_ = [os_du_sommet[i] for i in p.vertices]
        z = zone_de_la_face(max(set(os_), key=os_.count), p.center, H)
        p.material_index = ZONES.index(z)
        compte[z] += 1
    print('ZONES', compte)


def exporter(h, rig, chemin):
    for pb in rig.pose.bones:
        pb.matrix_basis = V['Matrix'].Identity(4)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    h.select_set(True)
    bpy.context.view_layer.objects.active = h
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    os.makedirs(os.path.dirname(os.path.abspath(chemin)), exist_ok=True)
    mw = h.matrix_world.copy(); h.parent = rig; h.matrix_world = mw
    V['miroir'](h)   # la meme convention que les vedettes (vedette_tripo.py, LE MIROIR)
    bpy.ops.export_scene.gltf(filepath=chemin, export_format='GLB', use_selection=True,
                              use_active_scene=True, export_skins=True, export_animations=False,
                              export_morph=False, export_yup=True, export_apply=False,
                              export_attributes=False, export_def_bones=False,
                              export_meshopt_compression_enable=True)
    print('GLB :', os.path.getsize(chemin), 'octets')


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
    zoner(h, rig)
    exporter(h, rig, A['glb'])


if __name__ == '__main__' and bpy.app.background:
    tout(arguments())
