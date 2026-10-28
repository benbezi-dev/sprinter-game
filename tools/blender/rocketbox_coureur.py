# -----------------------------------------------------------------------
# SPRINTER — UN CORPS ROCKETBOX EN COUREUR DU JEU (28/10/2026).
#
#   Blender -b --factory-startup -P tools/blender/rocketbox_coureur.py -- \
#       --fbx assets-sources/rocketbox/Sports_Male_01/Sports_Male_01.fbx --glb <sortie.glb>
#
# L'auteur, 28/10 : « les formes ne sont pas respectees, ils sont tous carres, recupere des assets de sportif sur
# internet gratuit ». Microsoft Rocketbox (licence MIT, assets-sources/rocketbox/LICENSE-MIT.txt) : des corps
# realistes, en pose A, riggés (squelette Biped « Bip01 ») avec des poids faits a la main. Les corps de Blender
# Studio passaient par la chaine des vedettes (pose en croix, squelette pose par nous, epaules calees sur la carrure
# du jeu) et en sortaient carres. Ici on garde LEUR squelette et LEURS poids :
#   - les os prennent les noms du jeu (pelvis, spine_01..., clavicle_l, upperarm_l, thigh_l...) ;
#   - le calage ne touche qu'aux ORIENTATIONS du haut du corps (le repos du jeu : bras le long du corps, depuis la
#     pose A, 45° au lieu de 90°) et garde les epaules, les bras et le buste du modele ; seules les jambes prennent
#     les longueurs du jeu (les pieds doivent toucher le sol que le moteur calcule) ;
#   - puis les zones teintes, les vetements et les os de tissu de coureur_realiste.py, et la meme exportation.
# -----------------------------------------------------------------------
import bpy, os, runpy, sys, math
from mathutils import Vector, Matrix

ICI = os.path.dirname(os.path.abspath(__file__))
R = runpy.run_path(os.path.join(ICI, 'coureur_realiste.py'), run_name='coureur_realiste')
GEN, M, CARTOON = R['GEN'], R['M'], R['CARTOON']

NOMS = {'Pelvis': 'pelvis', 'Spine': 'spine_01', 'Spine1': 'spine_02', 'Spine2': 'spine_03', 'Neck': 'neck_01', 'Head': 'head'}
for c in ('L', 'R'):
    s = c.lower()
    NOMS.update({f'{c} Clavicle': f'clavicle_{s}', f'{c} UpperArm': f'upperarm_{s}', f'{c} Forearm': f'lowerarm_{s}',
                 f'{c} Hand': f'hand_{s}', f'{c} Thigh': f'thigh_{s}', f'{c} Calf': f'calf_{s}', f'{c} Foot': f'foot_{s}',
                 f'{c} Toe0': f'ball_{s}'})
    for k, doigt in enumerate(('thumb', 'index', 'middle', 'ring', 'pinky')):
        for j, suffixe in enumerate(('', '1', '2')):
            NOMS[f'{c} Finger{k}{suffixe}'] = f'{doigt}_0{j + 1}_{s}'


def arguments():
    a = sys.argv[sys.argv.index('--') + 1:]
    val = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    return {'fbx': val('--fbx'), 'glb': val('--glb')}


def importer(fbx):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # (sans animation : l'import cle sinon la transformation des objets)
    bpy.ops.import_scene.fbx(filepath=fbx, use_anim=False, automatic_bone_orientation=True, ignore_leaf_bones=True)
    rig = next(o for o in bpy.context.view_layer.objects if o.type == 'ARMATURE')
    h = next(o for o in bpy.context.view_layer.objects if o.type == 'MESH')
    # L'ECHELLE DU FBX. Rocketbox range sa peau en metres sous un objet a l'echelle 1/100, et ses os en centimetres :
    # seul le resultat evalue est juste. La peau prend donc ses coordonnees monde evaluees (au repos), detachee du
    # rig ; le rig, lui, se laisse appliquer (sans animation cle, l'operateur fonctionne).
    for o in [o for o in bpy.context.view_layer.objects if o.type == 'EMPTY']: bpy.data.objects.remove(o)
    ev = h.evaluated_get(bpy.context.evaluated_depsgraph_get())
    monde = [h.matrix_world @ v.co for v in ev.data.vertices]
    h.parent = None
    for v, c in zip(h.data.vertices, monde): v.co = c
    h.matrix_world = Matrix.Identity(4)
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.view_layer.update()
    # les noms du jeu, os et groupes de sommets
    for b in rig.data.bones:
        court = b.name.replace('Bip01 ', '')
        if court in NOMS: b.name = NOMS[court]
    for g in h.vertex_groups:
        court = g.name.replace('Bip01 ', '')
        if court in NOMS: g.name = NOMS[court]
    for m in h.modifiers:
        if m.type == 'ARMATURE': m.object = rig
    # LES OS VONT D'ARTICULATION EN ARTICULATION. L'import FBX donne aux os Biped une longueur arbitraire : le mollet ne
    # finissait pas a la cheville, et la mise en repere (hanche -> cheville) mettait le corps a 3,30 m. Chaque os du
    # jeu est rabattu sur la tete de son enfant (le maillage, au repos, ne bouge pas).
    SUITE = {'pelvis': 'spine_01', 'spine_01': 'spine_02', 'spine_02': 'spine_03', 'spine_03': 'neck_01', 'neck_01': 'head'}
    for c in ('l', 'r'):
        SUITE.update({f'clavicle_{c}': f'upperarm_{c}', f'upperarm_{c}': f'lowerarm_{c}', f'lowerarm_{c}': f'hand_{c}',
                      f'hand_{c}': f'middle_01_{c}', f'thigh_{c}': f'calf_{c}', f'calf_{c}': f'foot_{c}', f'foot_{c}': f'ball_{c}'})
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    for e in eb: e.use_connect = False
    for a_, b_ in SUITE.items():
        if a_ in eb and b_ in eb and (eb[b_].head - eb[a_].head).length > 0.01: eb[a_].tail = eb[b_].head.copy()
    if 'head' in eb: eb['head'].tail = eb['head'].head + Vector((0, 0, 0.2))
    if 'ball_l' in eb:
        for c in ('l', 'r'): eb[f'ball_{c}'].tail = eb[f'ball_{c}'].head + (eb[f'ball_{c}'].head - eb[f'foot_{c}'].head).normalized() * 0.04
    bpy.ops.object.mode_set(mode='OBJECT')
    # (une subdivision : 7 500 triangles faisaient des bords de zones en dents de scie ; 30 000, comme les autres corps)
    bpy.ops.object.select_all(action='DESELECT'); h.select_set(True); bpy.context.view_layer.objects.active = h
    sd = h.modifiers.new('subdiviser', 'SUBSURF'); sd.levels = 1; sd.render_levels = 1
    bpy.ops.object.modifier_move_to_index(modifier=sd.name, index=0)
    bpy.ops.object.modifier_apply(modifier=sd.name)
    # (soude : les coutures UV du FBX coupaient le maillage, la chaine a besoin de coupes fermees)
    import bmesh
    bm = bmesh.new(); bm.from_mesh(h.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0002)
    bm.to_mesh(h.data); bm.free(); h.data.update()
    return h, rig


def cibles(rig):
    """Les cibles du jeu (meba_maillage.cibles) pour le tronc et les jambes ; pour les bras, la DIRECTION du jeu
    (le long du corps) depuis l'epaule du modele, avec ses longueurs."""
    C = CARTOON['cibles'](rig, cou=1.0)
    b = rig.data.bones
    P0z = (b['thigh_l'].head_local.z + b['thigh_r'].head_local.z) / 2
    f = (C['neck_01'][0].z - M['LEGHIP_Z']) / (b['neck_01'].head_local.z - P0z)
    haut_z = lambda z: M['LEGHIP_Z'] + (z - P0z) * f
    for cote in ('l', 'r'):
        cl, ua, la = b['clavicle_' + cote], b['upperarm_' + cote], b['lowerarm_' + cote]
        S = Vector((0, ua.head_local.y * f, haut_z(ua.head_local.z)))        # l'epaule DU MODELE
        C['clavicle_' + cote] = (Vector((0, cl.head_local.y * f, haut_z(cl.head_local.z))), S)
        E = S + Vector((0, 0, -ua.length * f))
        W = E + Vector((0, 0, -la.length * f))
        C['upperarm_' + cote], C['lowerarm_' + cote] = (S, E), (E, W)
        C['hand_' + cote] = (W, W + Vector((0, 0, -b['hand_' + cote].length * f)))
    return C


def tout(A):
    etape = lambda n: print('ETAPE', n, flush=True)
    h, rig = importer(A['fbx']); etape('importe')
    h.name, rig.name = 'Coureur', 'Coureur'   # (les noms de la chaine : chaussures_coureur.py cherche « Coureur »)
    M['mise_en_repere'](h, rig); etape('repere')
    b = rig.data.bones
    R['G']['SH_Y'] = b['upperarm_l'].head_local.y
    R['G']['HIP_Y'] = b['thigh_l'].head_local.y
    herite = M['caler'](rig, cibles(rig)); etape('cale')
    CARTOON['figer'](h, rig, herite); etape('fige')
    GEN['zoner'].__globals__['zone_de_la_face'] = R['zone_du_debardeur']
    GEN['zoner'](h, rig)
    R['decouper_tenues'](h, rig)
    etape('zone')
    R['vetir'](h, rig); etape('vetu')
    GEN['exporter'](h, rig, A['glb'])


if __name__ == '__main__' and bpy.app.background:
    tout(arguments())
