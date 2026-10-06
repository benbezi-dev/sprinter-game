# -----------------------------------------------------------------------
# SPRINTER — les monuments de la Legende, rendus pour le lointain.
#
#   blender -b --factory-startup -P tools/blender/decors/legende_monuments.py -- \
#       --source <modele Tripo .glb|.fbx> --cle londres [--rot 0] [--elev 14] \
#       [--haut 1400] [--brume r,g,b,part] [--apercu4 vues.png]
#
# Un monument de la Legende ne se pose pas dans le stade : il se tient au
# loin, derriere la tribune, a une position d'ECRAN (game/legende/decors.ts),
# comme la tour du Champ-de-Mars. Il n'a donc pas a suivre la projection du
# jeu au metre pres (vue.py) ; il lui faut la meme LUMIERE que les coureurs
# et la piste, sinon il se detache comme un autocollant, et la brume de sa
# distance.
#
# Ce que fait ce script a un modele Tripo :
#   1. il le reduit (un modele HD fait pres d'un million de faces) ;
#   2. il le tourne de `rot` degres pour presenter sa face a la camera (le
#      mode --apercu4 rend les quatre faces cote a cote pour choisir), pose
#      son pied a l'origine et le ramene a une unite de haut ;
#   3. il le peint de la formule du jeu (matiere.py, en emission, vue Raw) :
#      teinte = texture x (0,34 + 0,60 soleil + 0,20 ciel + 0,06 sol), le
#      soleil venant du haut et de la droite de l'ecran, comme a l'image ;
#   4. il le voile de `brume` (la couleur du ciel du lieu, et sa part) ;
#   5. il le rend en orthographique, legerement d'en haut (`elev`), fond
#      transparent, et ecrit l'image et le pixel du pied dans le manifeste
#      src/assets/legende/decors/manifeste.json.
# -----------------------------------------------------------------------

import bpy
import json
import math
import os
import sys

import numpy as np
from mathutils import Matrix, Vector

ICI = os.path.dirname(os.path.abspath(__file__))
PROJET = os.path.abspath(os.path.join(ICI, '..', '..', '..'))
DOSSIER = os.path.join(PROJET, 'src', 'assets', 'legende', 'decors')
F_MAN = os.path.join(DOSSIER, 'manifeste.json')

# Le soleil du jeu, rapporte a l'ecran : il vient de la droite et du haut,
# un peu de face (LIGHT, sprinter-core.js, lu dans la vue du jeu).
SOLEIL = Vector((0.45, -0.35, 0.82)).normalized()
FACES_MAX = 220000


def arguments():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    def val(k, d=None):
        return a[a.index(k) + 1] if k in a else d
    return dict(source=val('--source'), cle=val('--cle'), rot=float(val('--rot', '0')),
                elev=float(val('--elev', '14')), haut=int(val('--haut', '1400')),
                brume=val('--brume', '0.62,0.78,0.92,0.10'), apercu4=val('--apercu4'))


def importer(src):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if src.lower().endswith('.fbx'):
        bpy.ops.import_scene.fbx(filepath=src)
    else:
        bpy.ops.import_scene.gltf(filepath=src)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in bpy.data.objects:
        o.select_set(o in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    for o in meshes:
        o.parent = None
    if len(meshes) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix.Identity(4)
    for x in list(bpy.data.objects):
        if x is not o:
            bpy.data.objects.remove(x, do_unlink=True)
    n = len(o.data.polygons)
    if n > FACES_MAX:
        dec = o.modifiers.new('reduction', 'DECIMATE')
        dec.ratio = FACES_MAX / n
        bpy.ops.object.modifier_apply(modifier=dec.name)
    return o


def texture(o):
    for m in o.data.materials:
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == 'BSDF_PRINCIPLED':
                    l = n.inputs['Base Color'].links
                    if l and l[0].from_node.type == 'TEX_IMAGE':
                        return l[0].from_node.image
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image:
                    return n.image
    return None


def normaliser(o, rot):
    me = o.data
    me.transform(Matrix.Rotation(math.radians(rot), 4, 'Z'))
    vs = [v.co for v in me.vertices]
    mn = Vector([min(v[i] for v in vs) for i in range(3)])
    mx = Vector([max(v[i] for v in vs) for i in range(3)])
    k = 1.0 / (mx.z - mn.z)
    c = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    me.transform(Matrix.Scale(k, 4) @ Matrix.Translation(-c))
    me.update()


def matiere(o, image, brume):
    m = bpy.data.materials.new('monument')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    L = nt.links
    def math_(op, a, b=None):
        n = nt.nodes.new('ShaderNodeMath'); n.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L.new(v, n.inputs[i])
        return n.outputs[0]
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    L.new(geo.outputs['Normal'], sep.inputs[0])
    nx, ny, nz = sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']
    nl = math_('ADD', math_('ADD', math_('MULTIPLY', nx, SOLEIL.x), math_('MULTIPLY', ny, SOLEIL.y)),
               math_('MULTIPLY', nz, SOLEIL.z))
    cle = math_('MAXIMUM', nl, 0.0)
    ciel = math_('ADD', math_('MULTIPLY', nz, 0.5), 0.5)
    sol = math_('SUBTRACT', 0.5, math_('MULTIPLY', nz, 0.5))
    t = math_('ADD', 0.34, math_('MULTIPLY', cle, 0.60))
    t = math_('ADD', t, math_('MULTIPLY', ciel, 0.20))
    t = math_('ADD', t, math_('MULTIPLY', sol, 0.06))
    tex = nt.nodes.new('ShaderNodeTexImage')
    image.colorspace_settings.name = 'Non-Color'
    tex.image = image
    mul = nt.nodes.new('ShaderNodeVectorMath'); mul.operation = 'SCALE'
    L.new(tex.outputs['Color'], mul.inputs[0]); L.new(t, mul.inputs['Scale'])
    # la brume de la distance : un voile de la couleur du ciel
    r, g, b, part = brume
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    mix.inputs['Factor'].default_value = part
    L.new(mul.outputs[0], mix.inputs['A'])
    mix.inputs['B'].default_value = (r, g, b, 1)
    em = nt.nodes.new('ShaderNodeEmission')
    L.new(mix.outputs['Result'], em.inputs['Color'])
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    L.new(em.outputs[0], out.inputs['Surface'])
    o.data.materials.clear()
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = False


def scene_de_rendu():
    sc = bpy.context.scene
    sc.render.film_transparent = True
    for n in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            sc.render.engine = n
            break
        except TypeError:
            continue
    try:
        sc.view_settings.view_transform = 'Raw'
    except TypeError:
        sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    try:
        sc.eevee.taa_render_samples = 32
    except AttributeError:
        pass
    return sc


def rendre(o, elev, H, fichier):
    """Rend o et rend (largeur, hauteur, pixel du pied)."""
    sc = scene_de_rendu()
    e = math.radians(elev)
    d = Vector((0, math.cos(e), -math.sin(e)))           # direction de vue
    droite = Vector((1, 0, 0))
    haut = droite.cross(d).normalized() * -1
    if haut.z < 0:
        haut = -haut
    pts = [o.matrix_world @ v.co for v in o.data.vertices]
    us = [p.dot(droite) for p in pts]
    vs = [p.dot(haut) for p in pts]
    marge = 0.02
    u0, u1 = min(us) - marge, max(us) + marge
    v0, v1 = min(vs) - marge, max(vs) + marge
    W = max(8, int(round(H * (u1 - u0) / (v1 - v0))))
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.resolution_percentage = 100
    cd = bpy.data.cameras.new('vue')
    cd.type = 'ORTHO'
    cd.sensor_fit = 'VERTICAL'
    cd.ortho_scale = v1 - v0
    cd.clip_start, cd.clip_end = 0.01, 100
    cam = bpy.data.objects.new('vue', cd)
    bpy.context.collection.objects.link(cam)
    centre = droite * ((u0 + u1) / 2) + haut * ((v0 + v1) / 2)
    rot = Matrix((droite, haut, -d)).transposed()
    cam.matrix_world = Matrix.Translation(centre - d * 20) @ rot.to_4x4()
    sc.camera = cam
    sc.render.filepath = fichier
    bpy.ops.render.render(write_still=True)
    pied = ((0 - u0) / (u1 - u0) * W, (v1 - 0) / (v1 - v0) * H)
    bpy.data.objects.remove(cam, do_unlink=True)
    return W, H, pied


def lire(f):
    img = bpy.data.images.load(f)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(h, w, 4)[::-1]


def ecrire(a, f, fmt='WEBP', qualite=88):
    h, w = a.shape[:2]
    img = bpy.data.images.new('sortie', w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(a[::-1], dtype=np.float32).ravel())
    img.filepath_raw = f
    img.file_format = fmt
    bpy.context.scene.render.image_settings.quality = qualite
    img.save()
    bpy.data.images.remove(img)


def main():
    A = arguments()
    brume = tuple(float(x) for x in A['brume'].split(','))
    tmp = '/tmp/legende-monument-%d.png' % os.getpid()
    if A['apercu4']:
        vues = []
        # un seul import (vingt megaoctets, une minute) : le modele tourne
        # ensuite sur place, son pied est deja a l'origine
        o = importer(A['source'])
        image = texture(o)
        normaliser(o, 0)
        matiere(o, image, (1, 1, 1, 0))
        for r in (0, 90, 180, 270):
            if r:
                o.data.transform(Matrix.Rotation(math.radians(90), 4, 'Z'))
                o.data.update()
            rendre(o, A['elev'], 360, tmp)
            a = lire(tmp)
            fond = np.ones_like(a); fond[..., :3] = 0.85
            a = a * a[..., 3:4] + fond * (1 - a[..., 3:4]); a[..., 3] = 1
            pad = np.ones((360, 40, 4), dtype=np.float32); pad[..., :3] = 1
            vues += [a, pad]
            print('VUE rot %d : %dx%d' % (r, a.shape[1], a.shape[0]))
        ecrire(np.concatenate(vues, axis=1), A['apercu4'], 'PNG')
        print('APERCU ' + A['apercu4'])
        return
    o = importer(A['source'])
    image = texture(o)
    if image is None:
        raise RuntimeError('pas de texture dans le modele')
    normaliser(o, A['rot'])
    matiere(o, image, brume)
    W, H, pied = rendre(o, A['elev'], A['haut'], tmp)
    a = lire(tmp)
    al = a[..., 3]
    ys, xs = np.nonzero(al > 0.004)
    x0, x1 = max(0, xs.min() - 2), min(W, xs.max() + 3)
    y0, y1 = max(0, ys.min() - 2), min(H, ys.max() + 3)
    a = a[y0:y1, x0:x1]
    os.makedirs(DOSSIER, exist_ok=True)
    nom = A['cle'] + '.webp'
    ecrire(a, os.path.join(DOSSIER, nom))
    man = json.load(open(F_MAN)) if os.path.exists(F_MAN) else {'pieces': {}}
    man.setdefault('pieces', {})[A['cle']] = {
        'f': nom, 'w': int(x1 - x0), 'h': int(y1 - y0),
        'ax': round(pied[0] - x0, 2), 'ay': round(pied[1] - y0, 2),
        'rot': A['rot'], 'elev': A['elev'], 'brume': list(brume)}
    json.dump(man, open(F_MAN, 'w'), indent=1, sort_keys=True)
    print('MONUMENT %s : %dx%d pied (%.0f, %.0f) -> %s' % (A['cle'], x1 - x0, y1 - y0,
          pied[0] - x0, pied[1] - y0, os.path.join(DOSSIER, nom)))


if __name__ == '__main__':
    main()
