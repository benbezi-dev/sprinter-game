# -----------------------------------------------------------------------
# Verifier la vue au pixel, au lieu de la croire juste.
#
#   blender -b -P tools/blender/decors/verifier-vue.py
#
# Des billes de couleur a des positions connues du jeu. On rend, on relit
# l'image, on retrouve le centre de chaque bille et on le compare a la
# formule du moteur. Un ecart de plus d'un pixel et le script echoue.
# -----------------------------------------------------------------------
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vue

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.film_transparent = True

PX = 40.0
# Une image PLUS HAUTE QUE LARGE avec ?portrait : c'est dans ce format que la
# camera s'etait trompee d'echelle, et le test d'origine, en paysage, ne
# pouvait pas le voir.
W, H = (560, 900) if '--portrait' in sys.argv else (960, 720)
cam = vue.camera(PX, W, H, centre=(1.5, 1.5, 1.0))
racine = vue.racine_miroir()

POINTS = {
    'rouge': ((0, 0, 0), (1, 0, 0)),
    'vert': ((4, 0, 0), (0, 1, 0)),
    'bleu': ((0, 4, 0), (0, 0, 1)),
    'jaune': ((0, 0, 3), (1, 1, 0)),
    'cyan': ((3, 2, 1.5), (0, 1, 1)),
}
for nom, (p, col) in POINTS.items():
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs[0].default_value = (*col, 1)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs[0], out.inputs[0])
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(0, 0, 0))
    o = bpy.context.active_object
    o.data.materials.append(m)
    o.parent = racine
    o.location = p            # dans le repere du jeu, sous la racine miroir

sc.view_settings.view_transform = 'Standard'
f = '/tmp/verif-vue-%dx%d.png' % (W, H)
sc.render.filepath = f
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
bpy.ops.render.render(write_still=True)

img = bpy.data.images.load(f)
w, h = img.size
px = list(img.pixels)
ax, ay = vue.ancre_pixel(cam, (0, 0, 0))
pire = 0
for nom, (p, col) in POINTS.items():
    sx = sy = n = 0
    for j in range(h):
        for i in range(w):
            k = (j * w + i) * 4
            r, g, b, a = px[k:k + 4]
            if a < 0.5:
                continue
            if abs(r - col[0]) < 0.25 and abs(g - col[1]) < 0.25 and abs(b - col[2]) < 0.25:
                sx += i; sy += (h - 1 - j); n += 1
    if not n:
        print('  %-6s introuvable' % nom); pire = 99; continue
    mx, my = sx / n + 0.5, sy / n + 0.5
    X, Y, Z = p
    ex = ax + PX * vue.COS * (-X + Y)
    ey = ay + PX * -(vue.SIN * (X + Y) + Z)
    e = math.hypot(mx - ex, my - ey)
    pire = max(pire, e)
    print('  %-6s mesure (%.1f, %.1f)  attendu (%.1f, %.1f)  ecart %.2f px' % (nom, mx, my, ex, ey, e))
print('ECART MAX %.2f px -> %s' % (pire, 'OK' if pire <= 1.0 else 'ECHEC'))
