# -*- coding: utf-8 -*-
"""Rend une planche de sprites par athlete : ANGLES orientations x FRAMES
poses du cycle, sur fond transparent, dans la projection isometrique du jeu."""
import bpy, math, os
import numpy as np
from mathutils import Vector, Matrix

TILE   = 128    # taille de rendu, avant recadrage
# Fenetre utile commune aux sept athletes : mesuree sur la planche complete,
# elle enleve les marges vides sans jamais rogner un membre.
CROP_X, CROP_Y, CROP_W, CROP_H = 16, 8, 96, 112
ANGLES = 8      # azimuts, tous les 45 deg
FRAMES = 12     # poses echantillonnees regulierement dans le cycle
SCALE  = 2.40
AZ     = 0.95

NF = {"Benbezi":24,"Ryan":23,"Mickeal":26,"Herman":26,
      "Greta":25,"Ervie":27,"Victoire":22}
NAMES = list(NF)

ISO_COS, ISO_SIN = 2/math.sqrt(5), 1/math.sqrt(5)
_R = Vector((-ISO_COS, ISO_COS, 0.0)); _U = Vector((-ISO_SIN, -ISO_SIN, 1.0))
Rn, Un = _R.normalized(), _U.normalized(); Nn = Rn.cross(Un)
ANISO = _R.length / _U.length          # le jeu etirera de ce facteur

def setup(scene):
    cam = bpy.data.objects["IsoCam"]
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = SCALE
    A = Vector((0.0, 0.0, AZ))
    cam.matrix_world = Matrix(((Rn.x, Un.x, Nn.x, 0.0), (Rn.y, Un.y, Nn.y, 0.0),
                               (Rn.z, Un.z, Nn.z, 0.0), (0.0, 0.0, 0.0, 1.0)))
    cam.location = A + Nn * 14.0
    scene.camera = cam
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = TILE
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 100
    scene.view_settings.view_transform = 'Standard'
    ppu = TILE / SCALE
    anchor = (TILE*0.5 + (Vector((0,0,0)) - A).dot(Rn) * ppu,
              TILE*0.5 - (Vector((0,0,0)) - A).dot(Un) * ppu)
    return anchor, ppu

def show_only(name):
    for n in NAMES:
        vis = (n == name)
        for sfx in ("", "_rig"):
            o = bpy.data.objects.get(n + sfx)
            if o: o.hide_render = not vis
    for n in ("Sprinteuse", "Rig", "Sol"):
        o = bpy.data.objects.get(n)
        if o: o.hide_render = True

def render_sheet(name, out_dir, tmp):
    scene = bpy.context.scene
    anchor, ppu = setup(scene)
    show_only(name)
    rig = bpy.data.objects[name + "_rig"]
    nf = NF[name]
    W, H = CROP_W * FRAMES, CROP_H * ANGLES
    sheet = np.zeros((H, W, 4), dtype=np.float32)
    bounds = [TILE, -1, TILE, -1]      # boite reellement occupee, pour controle

    base_rot = rig.rotation_euler.z
    for a in range(ANGLES):
        rig.rotation_euler.z = base_rot + (2*math.pi) * a / ANGLES
        for f in range(FRAMES):
            t = f * nf / FRAMES
            fi = int(t); scene.frame_set(1 + fi, subframe=t - fi)
            scene.render.filepath = tmp
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(tmp, check_existing=False)
            buf = np.empty(TILE*TILE*4, dtype=np.float32)
            img.pixels.foreach_get(buf)
            bpy.data.images.remove(img)
            # Blender stocke de bas en haut : on retourne pour l'ordre image
            tile = buf.reshape(TILE, TILE, 4)[::-1]
            ys, xs = np.nonzero(tile[..., 3] > 0.02)
            if len(xs):
                bounds[0] = min(bounds[0], int(xs.min()))
                bounds[1] = max(bounds[1], int(xs.max()))
                bounds[2] = min(bounds[2], int(ys.min()))
                bounds[3] = max(bounds[3], int(ys.max()))
            sheet[a*CROP_H:(a+1)*CROP_H, f*CROP_W:(f+1)*CROP_W] = \
                tile[CROP_Y:CROP_Y+CROP_H, CROP_X:CROP_X+CROP_W]
    rig.rotation_euler.z = base_rot

    out = bpy.data.images.new(name + "_sheet", W, H, alpha=True)
    out.pixels.foreach_set(sheet[::-1].reshape(-1))
    # WebP : meme rendu, mais l'alpha compresse bien mieux qu'en PNG sur une
    # planche a 85 % transparente.
    fmt = bpy.context.scene.render.image_settings.file_format
    bpy.context.scene.render.image_settings.file_format = 'WEBP'
    # quality 100 = WebP sans perte : a 92 le canal alpha etait degrade et
    # laissait des trainees entre les tuiles.
    bpy.context.scene.render.image_settings.quality = 100
    out.filepath_raw = os.path.join(out_dir, name.lower() + ".webp")
    out.file_format = 'WEBP'
    out.save()
    bpy.context.scene.render.image_settings.file_format = fmt
    bpy.data.images.remove(out)
    used = int((sheet[..., 3] > 0.02).sum())
    # rogne-t-on un membre ? la boite occupee doit tenir dans la fenetre
    clipped = (bounds[0] < CROP_X or bounds[1] >= CROP_X + CROP_W or
               bounds[2] < CROP_Y or bounds[3] >= CROP_Y + CROP_H)
    return dict(name=name, w=W, h=H, nf=nf,
                anchor=(anchor[0] - CROP_X, anchor[1] - CROP_Y),
                bounds=tuple(bounds), clipped=clipped,
                fill=round(100.0*used/(W*H), 1))
