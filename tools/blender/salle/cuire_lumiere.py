# -----------------------------------------------------------------------
# SPRINTER — LA LUMIERE CUITE DU STADE COUVERT JESSE OWENS (26/10/2026).
#
#   1. le jeu exporte la salle qu'il construit : ouvrir la course 3D avec ?exporterSalle=1
#      (salle-3d.ts, exporterPourBlender) -> salle-source.glb
#   2. Blender -b --factory-startup -P tools/blender/salle/cuire_lumiere.py -- salle-source.glb public/modeles/salle
#
# L'auteur, 26/10 : « enchaine sur le realisme de la salle : eclairage cuit dans Blender ».
# Cycles eclaire la salle telle qu'elle est dans le jeu — les plafonniers sous les fermes, le
# jour par les grands vitrages, les rebonds sur le bois et le plateau, les ombres douces sous la
# coursive — et cuit cette lumiere (l'eclairement seul, sans la couleur des matieres) dans :
#   lumiere-coque.jpg : l'atlas de la coque (murs, bandeau de bois, coursive, plafond), sur les
#                       cartes uv1 que salle-3d.ts a calculees (cartesDeLumiere) ;
#   lumiere-sol.jpg   : le sol et la piste vus de dessus, dans le rectangle de la halle.
# Le jeu multiplie ses matieres de detail par ces images (lightMap, uv1).
# -----------------------------------------------------------------------
import bpy, sys, os, math
import numpy as np

src, dossier = sys.argv[sys.argv.index('--') + 1:][:2]
# NUIT=1 : les vitres eteintes, le dehors noir, les plafonniers seuls -> lumiere-*-nuit.jpg (28/10)
NUIT = os.environ.get('NUIT') == '1'
SUFFIXE = '-nuit' if NUIT else ''
# les cotes de salle-3d.ts (piste-salle.js)
# (les virages allonges, 26/10 : 35 m de ligne droite ; demi-longueur des virages 23,534 m, piste-salle.js)
RS, S = 17.2, 35.0
LONG, LARGE, LARGE_T = 23.534 + 8.75, 29.0, 35.0
H_TOIT = 12.5
X0, X1, Y0, Y1 = -S - LONG, LONG, -RS - LARGE, -RS + LARGE_T
L, LY = X1 - X0, Y1 - Y0
ATLAS = 2048
SOL_L, SOL_H = 2048, int(2048 * LY / L)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
# le jeu est en z haut ; l'import glTF a tourne y vers le haut : on revient au repere du jeu
# (sans appliquer : les objets instancies partagent leur maillage, Blender refuserait)
for o in [o for o in bpy.data.objects if o.parent is None]:
    o.rotation_mode = 'XYZ'      # (l'import pose des quaternions : sans cela, la rotation ne fait rien)
    o.rotation_euler.x -= math.pi / 2
bpy.context.view_layer.update()

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = 'GPU'
except Exception as e:
    print('GPU indisponible :', e)
sc.cycles.samples = int(os.environ.get('ECHANTILLONS', '160'))
sc.cycles.max_bounces = 4
w = bpy.data.worlds.new('dehors'); w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.62, 0.72, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 0.005 if NUIT else 0.15
sc.world = w

# LE JOUR PAR LES VITRAGES : les vitres emettent une lumiere d'hiver, blanc bleute
for m in bpy.data.materials:
    if m.name.startswith('vitrage') and m.use_nodes:
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Emission Color'].default_value = (0.82, 0.9, 1.0, 1)
        b.inputs['Emission Strength'].default_value = 0.0 if NUIT else 9.0
# LES PLAFONNIERS : une source carree sous chaque ferme (la grille de salle-3d.ts)
x = X0 + 7.5
while x < X1:
    y = Y0 + 6
    while y < Y1 - 3:
        d = bpy.data.lights.new('plafonnier', 'AREA'); d.size = 1.2; d.energy = 1400; d.color = (1.0, 0.97, 0.9)
        o = bpy.data.objects.new('plafonnier', d); o.location = (x, y, H_TOIT - 2.35); sc.collection.objects.link(o)
        y += 8
    x += 7.5

def objets(tag):
    return [o for o in bpy.data.objects if o.type == 'MESH' and o.get('lumiere') == tag]

def cuire(cibles, image):
    """Cuit l'eclairement (direct + rebonds, sans la couleur) des `cibles` dans `image`, sur leur 2e carte UV."""
    for o in cibles:
        if len(o.data.uv_layers) > 1: o.data.uv_layers.active = o.data.uv_layers[1]
        for s in o.material_slots:
            m = s.material
            if not m: continue
            m.use_nodes = True
            n = next((n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image == image), None)
            if not n:
                n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.image = image
            m.node_tree.nodes.active = n
    bpy.ops.object.select_all(action='DESELECT')
    for o in cibles: o.select_set(True)
    bpy.context.view_layer.objects.active = cibles[0]
    sc.render.bake.use_pass_direct = True; sc.render.bake.use_pass_indirect = True; sc.render.bake.use_pass_color = False
    sc.render.bake.margin = 4; sc.render.bake.use_clear = True
    bpy.ops.object.bake(type='DIFFUSE')

def enregistrer(image, chemin, cible_p95=0.7 if NUIT else 0.85):
    """Floute un peu le bruit, cale l'exposition (le 95e centile a cible_p95), passe en sRGB, ecrit un JPEG."""
    w_, h_ = image.size
    px = np.array(image.pixels[:], dtype=np.float32).reshape(h_, w_, 4)[..., :3]
    for _ in range(2):   # un flou 3x3, deux fois : la lumiere est douce, le bruit de Cycles ne l'est pas
        px = (np.roll(px, 1, 0) + px + np.roll(px, -1, 0)) / 3
        px = (np.roll(px, 1, 1) + px + np.roll(px, -1, 1)) / 3
    lum = px.mean(axis=2)
    p95 = float(np.percentile(lum[lum > 1e-4], 95)) if (lum > 1e-4).any() else 1.0
    px = np.clip(px * (cible_p95 / max(p95, 1e-6)), 0, 1) ** (1 / 2.2)
    out = bpy.data.images.new(os.path.basename(chemin), w_, h_)
    out.colorspace_settings.name = 'Non-Color'
    out.pixels = np.concatenate([px, np.ones((h_, w_, 1), np.float32)], axis=2).ravel().tolist()
    out.filepath_raw = chemin; out.file_format = 'JPEG'
    sc.render.image_settings.quality = 90
    out.save()
    print('ECRIT', chemin, w_, 'x', h_, 'p95', round(p95, 3))

os.makedirs(dossier, exist_ok=True)

# 1. LA COQUE
coque = objets('coque')
img = bpy.data.images.new('coque', ATLAS, ATLAS, float_buffer=True)
cuire(coque, img)
enregistrer(img, os.path.join(dossier, f'lumiere-coque{SUFFIXE}.jpg'))

# 2. LE SOL ET LA PISTE, vus de dessus : sur une doublure plate (le sol du jeu, cache pendant la cuisson)
sol = objets('sol')
for o in sol: o.hide_render = True
me = bpy.data.meshes.new('doublure')
me.from_pydata([(X0, Y0, 0.03), (X1, Y0, 0.03), (X1, Y1, 0.03), (X0, Y1, 0.03)], [], [(0, 1, 2, 3)])
uv = me.uv_layers.new(name='UVMap'); uv2 = me.uv_layers.new(name='lumiere')
# comme a l'import d'un glTF, v est retourne (voir salle-3d.ts : flipY a faux)
for i, (u, v) in enumerate([(0, 1), (1, 1), (1, 0), (0, 0)]):
    uv.data[i].uv = (u, v); uv2.data[i].uv = (u, v)
d = bpy.data.objects.new('doublure', me); sc.collection.objects.link(d)
mat = bpy.data.materials.new('doublure'); mat.use_nodes = True; me.materials.append(mat)
# assez de faces pour que la cuisson voie le relevement de l'anneau ? non : le sol du jeu est plat
# hors de l'anneau ; l'anneau prend la lumiere du sol au meme endroit
img2 = bpy.data.images.new('sol', SOL_L, SOL_H, float_buffer=True)
cuire([d], img2)
enregistrer(img2, os.path.join(dossier, f'lumiere-sol{SUFFIXE}.jpg'))
print('FINI')
