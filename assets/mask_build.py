# -*- coding: utf-8 -*-
"""Rend, pour chaque planche, un masque de zones qui dit a quel vetement
appartient chaque pixel. Le jeu s'en sert pour reteindre le maillot, le short
et les chaussures aux couleurs reelles du coureur.

  rouge  = maillot      vert = short      bleu = chaussure
  noir   = peau, cheveux, semelle (jamais reteints)
"""
import bpy, math, os
import numpy as np

def zone_of(mat_name):
    n = (mat_name or "").lower()
    if n.endswith("_haut"):  return (1.0, 0.0, 0.0)
    if n.endswith("_short"): return (0.0, 1.0, 0.0)
    if n.endswith("_shoe"):  return (0.0, 0.0, 1.0)
    return (0.0, 0.0, 0.0)

def flat_mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
    em.inputs[1].default_value = 1.0
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs[0])
    return m

def render_mask(name, G, out_dir, tmp):
    """G = module sheet_build deja charge (meme camera, meme grille)."""
    scene = bpy.context.scene
    anchor, ppu = G["setup"](scene)
    G["show_only"](name)

    # aplats francs : pas de filtre de pixel, pas d'echantillonnage
    old_filter = scene.render.filter_size
    old_samples = getattr(scene.eevee, "taa_render_samples", None)
    scene.render.filter_size = 0.01
    try: scene.eevee.taa_render_samples = 1
    except Exception: pass

    body = bpy.data.objects[name]
    saved = [s.material for s in body.material_slots]
    for i, s in enumerate(body.material_slots):
        z = zone_of(saved[i].name if saved[i] else "")
        s.material = flat_mat("ZZMASK_%d_%d_%d" % (int(z[0]), int(z[1]), int(z[2])), z)

    rig = bpy.data.objects[name + "_rig"]
    nf = G["NF"][name]
    TILE, CW, CH = G["TILE"], G["CROP_W"], G["CROP_H"]
    FR, AN = G["FRAMES"], G["ANGLES"]
    W, H = CW * FR, CH * AN
    sheet = np.zeros((H, W, 4), dtype=np.float32)

    base = rig.rotation_euler.z
    for a in range(AN):
        rig.rotation_euler.z = base + (2 * math.pi) * a / AN
        for f in range(FR):
            t = f * nf / FR
            fi = int(t); scene.frame_set(1 + fi, subframe=t - fi)
            scene.render.filepath = tmp
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(tmp, check_existing=False)
            buf = np.empty(TILE * TILE * 4, dtype=np.float32)
            img.pixels.foreach_get(buf)
            bpy.data.images.remove(img)
            tile = buf.reshape(TILE, TILE, 4)[::-1]
            sheet[a*CH:(a+1)*CH, f*CW:(f+1)*CW] = \
                tile[G["CROP_Y"]:G["CROP_Y"]+CH, G["CROP_X"]:G["CROP_X"]+CW]
    rig.rotation_euler.z = base

    for i, s in enumerate(body.material_slots):
        s.material = saved[i]
    scene.render.filter_size = old_filter
    if old_samples is not None:
        try: scene.eevee.taa_render_samples = old_samples
        except Exception: pass

    out = bpy.data.images.new(name + "_mask", W, H, alpha=True)
    out.pixels.foreach_set(sheet[::-1].reshape(-1))
    fmt = scene.render.image_settings.file_format
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.quality = 100
    out.filepath_raw = os.path.join(out_dir, name.lower() + "_mask.webp")
    out.file_format = 'WEBP'
    out.save()
    bpy.data.images.remove(out)
    scene.render.image_settings.file_format = fmt

    op = sheet[..., 3] > 0.5
    r = int(((sheet[..., 0] > 0.5) & op).sum())
    g = int(((sheet[..., 1] > 0.5) & op).sum())
    b = int(((sheet[..., 2] > 0.5) & op).sum())
    tot = int(op.sum())
    return dict(name=name, total=tot, maillot=r, short=g, chaussure=b,
                autre=tot - r - g - b)
