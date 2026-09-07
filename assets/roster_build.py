# -*- coding: utf-8 -*-
"""Generateur des sept athletes ZEZE : morphologie, rig et cycle de course
propres a chacun. Reprend le pipeline valide sur la sprinteuse, parametre."""
import bpy, bmesh, math
from math import radians, degrees, cos, acos, pi
from mathutils import Vector

# --------------------------------------------------------------------------
# ROSTER  (aligne sur src/game/sprinter-core.js)
# --------------------------------------------------------------------------
def _lin(u):
    """Les couleurs du roster sont en sRGB (0-255) ; Blender attend du lineaire.
    Sans cette conversion tout ressort delave d'un cran."""
    u = u / 255.0
    return u / 12.92 if u <= 0.04045 else ((u + 0.055) / 1.055) ** 2.4

def c8(r, g, b): return (_lin(r), _lin(g), _lin(b))

EBENE = c8(74, 46, 32)

ROSTER = [
 dict(name="Benbezi", build='m', h=1.86, gait='lyles',   hair='fade',
      morph=dict(sh=1.06, hip=0.98, arm=1.04, leg=1.04),
      jersey=c8(214,48,62),  shorts=c8(26,26,40), shoe=c8(250,250,255)),
 dict(name="Ryan",    build='m', h=1.78, gait='sharp',   hair='crop',
      morph=dict(sh=1.02, hip=0.98, arm=1.02, leg=1.06),
      jersey=c8(48,132,232), shorts=c8(24,30,52), shoe=c8(250,224,70)),
 dict(name="Mickeal", build='m', h=1.85, gait='power',   hair='flattop',
      morph=dict(sh=1.14, hip=1.02, arm=1.16, leg=1.12),
      jersey=c8(44,190,128), shorts=c8(22,34,32), shoe=c8(246,126,46)),
 dict(name="Herman",  build='m', h=2.00, gait='fluid',   hair='shaved',
      morph=dict(sh=0.96, hip=0.94, arm=0.92, leg=0.94),
      jersey=c8(246,150,40), shorts=c8(34,26,22), shoe=c8(126,226,250)),
 dict(name="Greta",   build='f', h=1.70, gait='drive',   hair='bun',
      morph=dict(sh=1.12, hip=1.06, arm=1.10, leg=1.14),
      jersey=c8(162,92,232), shorts=c8(28,22,44), shoe=c8(250,250,255)),
 dict(name="Ervie",   build='f', h=1.75, gait='glide',   hair='braids',
      morph=dict(sh=0.92, hip=0.94, arm=0.88, leg=0.92),
      jersey=c8(36,198,196), shorts=c8(20,34,36), shoe=c8(250,224,70)),
 dict(name="Victoire",build='f', h=1.63, gait='cadence', hair='ponytail',
      morph=dict(sh=0.98, hip=1.02, arm=0.96, leg=1.12),
      jersey=c8(236,96,178), shorts=c8(36,22,36), shoe=c8(246,126,46)),
]

# --------------------------------------------------------------------------
# PROPORTIONS  (fractions de la taille, relevees sur le modele de reference)
# --------------------------------------------------------------------------
Z = dict(pelvis=.5292, waist=.6175, chest=.7143, neckbase=.8054, neck=.8663,
         hip=.5151, knee=.2817, ankle=.0598, shoulder=.7883, elbow=.6375,
         wrist=.5009, hand=.4542, head=.9363)
X = dict(hip=.0598, knee=.0558, ankle=.0524, shoulder=.1002, elbow=.1229,
         wrist=.1383, hand=.1423)
R = dict(pelvis=(.0694,.0558), waist=(.0535,.0450), chest=(.0728,.0569),
         neckbase=(.0450,.0415), neck=(.0285,.0285), hip=(.0575,.0529),
         knee=(.0404,.0393), ankle=(.0262,.0290), shoulder=(.0410,.0398),
         elbow=(.0285,.0273), wrist=(.0194,.0182), hand=(.0211,.0171))
HEAD_R = .0569

# --------------------------------------------------------------------------
# PROFILS DE FOULEE  (memes caracteres que GAITS cote moteur)
# --------------------------------------------------------------------------
# nf = frames par cycle @60fps (petit = cadence elevee)
PROFILES = {
 'cadence': dict(nf=22, thigh=0.92, knee=1.10, arm=0.90, lean=0.82, fly=0.086),
 'sharp':   dict(nf=23, thigh=1.02, knee=1.02, arm=1.08, lean=1.06, fly=0.072),
 'power':   dict(nf=26, thigh=1.06, knee=0.88, arm=1.12, lean=1.14, fly=0.082),
 'fluid':   dict(nf=26, thigh=0.98, knee=0.92, arm=0.96, lean=0.88, fly=0.064),
 'lyles':   dict(nf=24, thigh=1.04, knee=1.12, arm=0.98, lean=0.70, fly=0.076),
 'drive':   dict(nf=25, thigh=1.04, knee=0.95, arm=1.10, lean=1.20, fly=0.084),
 'glide':   dict(nf=27, thigh=1.00, knee=0.90, arm=0.92, lean=0.78, fly=0.088),
}
THIGH = [(0.00,-24),(0.06,-10),(0.12,  2),(0.20, 14),(0.27, 24),(0.34, 14),
         (0.42, -6),(0.50,-28),(0.60,-48),(0.72,-56),(0.84,-50),(0.93,-34)]
SHIN  = [(0.00, 18),(0.06, 32),(0.12, 38),(0.20, 26),(0.27, 16),(0.34, 95),
         (0.42,138),(0.50,128),(0.60,112),(0.72, 98),(0.84, 62),(0.93, 30)]
FOOT  = [(0.00,  2),(0.06, -6),(0.12, -8),(0.20, 10),(0.27, 30),(0.34, 16),
         (0.42,  8),(0.50,  2),(0.60, -2),(0.72, -4),(0.84, -2),(0.93,  0)]

def cr(keys, p):
    p %= 1.0
    n = len(keys)
    i = max(k for k in range(n) if keys[k][0] <= p)
    a = keys[i][0]; b = keys[i+1][0] if i+1 < n else keys[0][0] + 1.0
    t = (p - a) / (b - a)
    v0 = keys[(i-1) % n][1]; v1 = keys[i][1]
    v2 = keys[(i+1) % n][1]; v3 = keys[(i+2) % n][1]
    return 0.5*(2*v1 + (-v0+v2)*t + (2*v0-5*v1+4*v2-v3)*t*t + (-v0+3*v1-3*v2+v3)*t**3)

def lin(keys, p):
    if p <= keys[0][0]: return keys[0][1]
    if p >= keys[-1][0]: return keys[-1][1]
    for (a,va),(b,vb) in zip(keys, keys[1:]):
        if a <= p <= b: return va + (vb-va)*(p-a)/(b-a)
    return keys[-1][1]

# --------------------------------------------------------------------------
def mat(name, rgb, rough=0.55):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*rgb, 1.0)
    b.inputs["Roughness"].default_value = rough
    return m

def bake():
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def only(ob):
    for o in bpy.context.selected_objects: o.select_set(False)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob

def build_character(spec, coll):
    nm, h, mo = spec["name"], spec["h"], spec["morph"]
    male = spec["build"] == 'm'
    # gabarit de base selon le sexe, puis retouches de l'athlete
    wsh = (1.10 if male else 1.0) * mo["sh"]
    whip= (0.90 if male else 1.0) * mo["hip"]
    war = (1.12 if male else 1.0) * mo["arm"]
    wlg = (1.04 if male else 1.0) * mo["leg"]

    def z(k): return Z[k] * h
    def x(k): return X[k] * h
    def r(k, w): return (R[k][0]*h*w, R[k][1]*h*w)

    P = [ (0.0, 0.0,      z('pelvis'),   *r('pelvis',  whip)),
          (0.0, 0.0,      z('waist'),    *r('waist',   whip)),
          (0.0, 0.0045*h, z('chest'),    *r('chest',   wsh)),
          (0.0, 0.0,      z('neckbase'), *r('neckbase',wsh)),
          (0.0, 0.0,      z('neck'),     *r('neck',    1.0)),
          (x('hip'),   0.0,      z('hip'),      *r('hip',   wlg)),
          (x('knee'),  0.008*h,  z('knee'),     *r('knee',  wlg)),
          (x('ankle'), 0.0,      z('ankle'),    *r('ankle', wlg)),
          (x('shoulder'),0.0,    z('shoulder'), *r('shoulder',war)),
          (x('elbow'), 0.0,      z('elbow'),    *r('elbow', war)),
          (x('wrist'), 0.0,      z('wrist'),    *r('wrist', war)),
          (x('hand'), -0.007*h,  z('hand'),     *r('hand',  war)) ]
    E = [(0,1),(1,2),(2,3),(3,4),(0,5),(5,6),(6,7),(3,8),(8,9),(9,10),(10,11)]

    me = bpy.data.meshes.new(nm + "_M")
    me.from_pydata([(p[0],p[1],p[2]) for p in P], E, []); me.update()
    body = bpy.data.objects.new(nm, me)
    coll.objects.link(body); only(body)
    m = body.modifiers.new("Mirror","MIRROR"); m.use_clip = True
    sk = body.modifiers.new("Skin","SKIN"); sk.use_smooth_shade = True
    sb = body.modifiers.new("Subdivision","SUBSURF"); sb.levels = 2; sb.render_levels = 2
    sd = me.skin_vertices[0].data
    for i, p in enumerate(P): sd[i].radius = (p[3], p[4])
    sd[0].use_root = True
    for k in ("Mirror","Skin","Subdivision"): bpy.ops.object.modifier_apply(modifier=k)

    # ---- tete ----
    hz = z('head')
    bpy.ops.mesh.primitive_uv_sphere_add(radius=HEAD_R*h, segments=28, ring_count=18,
                                         location=(0,0,hz))
    head = bpy.context.active_object; head.name = nm + "_head"
    head.scale = (0.92*(1.04 if male else 1.0), 1.0, 1.17); bake()
    for v in head.data.vertices:
        dz = v.co.z - hz
        if dz < 0:
            t = min(1.0, -dz/(0.115*h))
            v.co.x *= 1 - 0.24*t*t; v.co.y *= 1 - 0.13*t*t
        if v.co.y > 0: v.co.y *= 0.93
    head.data.update()
    for o in bpy.context.selected_objects: o.select_set(False)
    body.select_set(True); head.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    for p in body.data.polygons: p.use_smooth = True
    return body, dict(h=h, hz=hz, male=male, wlg=wlg, x=x, z=z)

# --------------------------------------------------------------------------
def build_hair(spec, G, coll, M_HAIR):
    """Sept coiffures distinctes, calees sur le champ `hair` du roster."""
    nm, h, hz = spec["name"], G["h"], G["hz"]
    style = spec["hair"]
    pieces = []
    THICK = {'shaved':0.006, 'crop':0.011, 'fade':0.013, 'flattop':0.016,
             'bun':0.014, 'ponytail':0.014, 'braids':0.015}[style]
    # calotte commune, plus ou moins descendante selon la coupe
    drop = {'shaved':0.010, 'crop':0.016, 'fade':0.020, 'flattop':0.008,
            'bun':0.026, 'ponytail':0.028, 'braids':0.030}[style]
    bpy.ops.mesh.primitive_uv_sphere_add(radius=(HEAD_R+0.004)*h, segments=28,
                                         ring_count=18, location=(0, 0.006*h, hz))
    cap = bpy.context.active_object; cap.name = nm + "_hair"
    coll.objects.link(cap)
    for c in cap.users_collection:
        if c is not coll: c.objects.unlink(cap)
    cap.scale = (0.95, 1.03, 1.15); bake()
    top = hz + (0.010 - drop) * h * 4.0
    bm = bmesh.new(); bm.from_mesh(cap.data)
    kill = [v for v in bm.verts
            if not (v.co.z > top or (v.co.y > 0.020*h and v.co.z > hz - 0.055*h))]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(cap.data); bm.free()
    if len(cap.data.polygons) == 0:
        bpy.data.objects.remove(cap, do_unlink=True); return None
    sol = cap.modifiers.new("Solidify","SOLIDIFY")
    sol.thickness = THICK * (h/1.75); sol.offset = 1.0
    only(cap); bpy.ops.object.modifier_apply(modifier="Solidify")
    if style == 'flattop':                       # bloc plat sur le dessus
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.004*h, hz + 0.048*h))
        b = bpy.context.active_object
        b.scale = (0.098*h, 0.112*h, 0.036*h); bake()
        bv = b.modifiers.new("Bevel","BEVEL"); bv.width = 0.012*h; bv.segments = 3
        only(b); bpy.ops.object.modifier_apply(modifier="Bevel")
        pieces.append(b)
    elif style == 'bun':                          # chignon haut a l'arriere
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.034*h, segments=18,
            ring_count=12, location=(0, 0.072*h, hz + 0.042*h))
        pieces.append(bpy.context.active_object)
    elif style == 'ponytail':
        bpy.ops.mesh.primitive_cone_add(vertices=18, radius1=0.027*h,
            radius2=0.008*h, depth=0.177*h, location=(0, 0.097*h, hz - 0.052*h))
        t = bpy.context.active_object
        t.rotation_euler = (radians(26.6), 0, 0); bake()
        sm = t.modifiers.new("S","SUBSURF"); sm.levels = 2
        only(t); bpy.ops.object.modifier_apply(modifier="S")
        pieces.append(t)
    elif style == 'braids':                       # tresses plaquees vers l'arriere
        for k in range(5):
            a = radians(-52 + k * 26)
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.011*h,
                depth=0.150*h, location=(math.sin(a)*0.052*h,
                                         0.070*h + math.cos(a)*0.012*h,
                                         hz - 0.030*h))
            t = bpy.context.active_object
            t.rotation_euler = (radians(34), 0, a * 0.35); bake()
            pieces.append(t)
    for p in pieces:
        coll.objects.link(p)
        for c in p.users_collection:
            if c is not coll: c.objects.unlink(p)
    if pieces:
        for o in bpy.context.selected_objects: o.select_set(False)
        cap.select_set(True)
        for p in pieces: p.select_set(True)
        bpy.context.view_layer.objects.active = cap
        bpy.ops.object.join()
    cap.data.materials.clear(); cap.data.materials.append(M_HAIR)
    for p in cap.data.polygons: p.use_smooth = True; p.material_index = 0
    return cap

def build_shoe(spec, G, sx, coll, M_SHOE, M_SOLE):
    nm, h = spec["name"], G["h"]
    sc = h / 1.757
    cx, cy, cz = sx * G["x"]('ankle'), -0.030*sc, 0.055*sc
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx, cy, cz))
    s = bpy.context.active_object
    s.name = "%s_shoe_%s" % (nm, "R" if sx > 0 else "L")
    coll.objects.link(s)
    for c in s.users_collection:
        if c is not coll: c.objects.unlink(s)
    s.scale = (0.105*sc, 0.265*sc, 0.110*sc); bake()
    bm = bmesh.new(); bm.from_mesh(s.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=4, use_grid_fill=True)
    for v in bm.verts:
        t = max(-1.0, min(1.0, (v.co.y - cy) / (0.1325*sc)))
        av = max(0.0, -t)
        v.co.x = cx + (v.co.x - cx) * (1.0 - 0.34*av**2)
        if v.co.z > cz:
            v.co.z -= 0.050*sc*av**1.6
            v.co.z += 0.012*sc*(1.0 - abs(t))
        else:
            v.co.z = max(v.co.z, 0.0)
    bm.to_mesh(s.data); bm.free()
    sb = s.modifiers.new("S","SUBSURF"); sb.levels = 2
    only(s); bpy.ops.object.modifier_apply(modifier="S")
    s.data.materials.clear()
    s.data.materials.append(M_SHOE); s.data.materials.append(M_SOLE)
    for p in s.data.polygons:
        p.use_smooth = True
        p.material_index = 1 if p.center.z < 0.030*sc else 0
    return s

# --------------------------------------------------------------------------
def paint_body(body, spec, G, M_SKIN, M_TOP, M_SHORT):
    """Tenue peinte par zone, avec exclusion des bras par distance a leur axe."""
    h = G["h"]; x = G["x"]; z = G["z"]
    body.data.materials.clear()
    for m in (M_SKIN, M_TOP, M_SHORT): body.data.materials.append(m)
    ARM = [(x('hand'),-0.007*h, z('hand')), (x('wrist'),0,z('wrist')),
           (x('elbow'),0,z('elbow')), (x('shoulder'),0,z('shoulder'))]
    LEG = [(x('ankle'),0,z('ankle')), (x('knee'),0.008*h,z('knee')),
           (x('hip'),0,z('hip'))]
    male = G["male"]

    def ax(chain, zz):
        if zz <= chain[0][2]: return Vector(chain[0])
        if zz >= chain[-1][2]: return Vector(chain[-1])
        for a, b in zip(chain, chain[1:]):
            if a[2] <= zz <= b[2]:
                return Vector(a).lerp(Vector(b), (zz-a[2])/(b[2]-a[2]))
        return Vector(chain[-1])
    male = G["male"]
    # brassiere courte pour les femmes, debardeur descendant jusqu'au short
    # pour les hommes : comme le kit dessine par le moteur, pas de torse nu.
    top_lo = (z('waist') + 0.055*h) if not male else (z('pelvis') + 0.055*h)
    top_hi = z('chest') + 0.062*h
    sh_lo, sh_hi = (z('hand')-0.010*h, z('pelvis')+0.062*h)
    for p in body.data.polygons:
        c = p.center
        aa = ax(ARM, c.z); aa.x *= (1 if c.x >= 0 else -1)
        near_arm = (Vector((c.x,c.y,0)) - Vector((aa.x,aa.y,0))).length < 0.045*h
        la = ax(LEG, c.z); la.x *= (1 if c.x >= 0 else -1)
        near_leg = (Vector((c.x,c.y,0)) - Vector((la.x,la.y,0))).length < 0.085*h
        if sh_lo < c.z < sh_hi and not near_arm and (near_leg or abs(c.x) < 0.075*h):
            p.material_index = 2                       # short
        elif top_lo < c.z < top_hi and not near_arm:
            p.material_index = 1
        else:
            p.material_index = 0

def build_rig(spec, G, coll):
    nm, h, x, z = spec["name"], G["h"], G["x"], G["z"]
    arm = bpy.data.armatures.new(nm + "_A")
    rig = bpy.data.objects.new(nm + "_rig", arm)
    coll.objects.link(rig)
    only(rig)
    bpy.ops.object.mode_set(mode='EDIT')
    B = {}
    def bone(n, hd, tl, par=None, con=False):
        b = arm.edit_bones.new(n); b.head, b.tail = hd, tl
        if par: b.parent = B[par]; b.use_connect = con
        B[n] = b
    zp, zw, zc, zn = z('pelvis'), z('waist'), z('chest'), z('neckbase')
    bone("root",  (0,0,0), (0,-0.14*h,0))
    bone("hips",  (0,0,zp), (0,0,zw), "root")
    bone("spine", (0,0,zw), (0,0,zc), "hips", True)
    bone("chest", (0,0,zc), (0,0,zn), "spine", True)
    bone("neck",  (0,0,zn), (0,0,z('neck')), "chest", True)
    bone("head",  (0,0,z('neck')), (0,0,z('head')+0.075*h), "neck", True)
    for s, sx in (("L",1.0), ("R",-1.0)):
        bone("shoulder."+s,(sx*0.012*h,0,zn),(sx*x('shoulder'),0,z('shoulder')),"chest")
        bone("upper_arm."+s,(sx*x('shoulder'),0,z('shoulder')),
                            (sx*x('elbow'),0,z('elbow')), "shoulder."+s, True)
        bone("forearm."+s,(sx*x('elbow'),0,z('elbow')),
                          (sx*x('wrist'),0,z('wrist')), "upper_arm."+s, True)
        bone("hand."+s,(sx*x('wrist'),0,z('wrist')),
                       (sx*x('hand'),-0.007*h,z('hand')), "forearm."+s, True)
        bone("thigh."+s,(sx*x('hip'),0,z('hip')),
                        (sx*x('knee'),0.008*h,z('knee')), "hips")
        bone("shin."+s,(sx*x('knee'),0.008*h,z('knee')),
                       (sx*x('ankle'),0,z('ankle')), "thigh."+s, True)
        bone("foot."+s,(sx*x('ankle'),0,z('ankle')),
                       (sx*x('ankle'),-0.065*h,0.017*h), "shin."+s, True)
        bone("toe."+s,(sx*x('ankle'),-0.065*h,0.017*h),
                      (sx*x('ankle'),-0.105*h,0.012*h), "foot."+s, True)
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.data.bones["root"].use_deform = False
    return rig

# --------------------------------------------------------------------------
def animate(rig, body, spec, G):
    """Cycle de course : rotations d'abord, puis hauteur du bassin deduite du
    contact reel de la semelle - jamais d'oscillation sinusoidale arbitraire."""
    pr = PROFILES[spec["gait"]]
    NF = pr["nf"]
    h = G["h"]; sc = h / 1.757
    L1 = (G['z']('hip') - G['z']('knee'))
    L2 = (G['z']('knee') - G['z']('ankle'))
    LEGLEN = [(0.00,0.762),(0.06,0.745),(0.12,0.735),(0.18,0.752),(0.27,0.790)]
    LEGLEN = [(a, v * (L1+L2) / 0.800) for a, v in LEGLEN]

    sc_ = bpy.context.scene
    only(rig)
    if rig.animation_data: rig.animation_data_clear()
    bpy.ops.object.mode_set(mode='POSE')
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'; pb.rotation_euler = (0,0,0); pb.location = (0,0,0)

    def shin_for(ph):
        tab = cr(SHIN, ph) * pr["knee"]
        ph %= 1.0
        if ph > 0.30: return tab
        th = radians(cr(THIGH, ph) * pr["thigh"])
        c = (lin(LEGLEN, min(ph,0.27)) - L1*cos(th)) / L2
        c = max(-1.0, min(1.0, c))
        ik = degrees(-acos(c) - th)
        if ph <= 0.22: return ik
        w = (ph - 0.22) / 0.08
        return ik*(1-w) + tab*w

    def R(n, x=None, y=None):
        e = rig.pose.bones[n].rotation_euler
        if x is not None: e.x = radians(x)
        if y is not None: e.y = radians(y)

    TWIST = 7.0
    for f in range(1, NF + 2):
        sc_.frame_set(f)
        p = (f - 1) / NF
        for s, ph in (("R", p), ("L", p + 0.5)):
            R("thigh."+s, x=cr(THIGH, ph) * pr["thigh"])
            R("shin."+s,  x=shin_for(ph))
            R("foot."+s,  x=cr(FOOT, ph))
            R("toe."+s,   x=max(0.0, cr(FOOT, ph)) * 0.35)
            R("upper_arm."+s, x=46.0 * pr["arm"] * cos(2*pi*ph))
            R("forearm."+s,   x=-80.0 + 15.0 * cos(2*pi*ph))
        R("hips",  x=5.0*pr["lean"], y=TWIST*cos(2*pi*p))
        R("spine", x=4.0*pr["lean"])
        R("chest", x=3.0*pr["lean"], y=-0.6*TWIST*cos(2*pi*p))
        R("neck",  x=-3.0*pr["lean"])
        R("head",  x=-2.0, y=-0.25*TWIST*cos(2*pi*p))
        rig.pose.bones["hips"].location = (0,0,0)
        for pb in rig.pose.bones:
            if pb.name != "root": pb.keyframe_insert("rotation_euler", frame=f)
    bpy.ops.object.mode_set(mode='OBJECT')

    # --- hauteur du bassin : mesure du point le plus bas de chaque semelle ---
    gi = {g.name: g.index for g in body.vertex_groups}
    shoe = {}
    for s in ("R","L"):
        ids = (gi.get("foot."+s), gi.get("toe."+s))
        shoe[s] = [v.index for v in body.data.vertices
                   if sum(g.weight for g in v.groups if g.group in ids) > 0.5]
    low = {}
    for f in range(1, NF + 2):
        sc_.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = body.evaluated_get(dg); m = ev.to_mesh(); mw = body.matrix_world
        for s in ("R","L"):
            low[(f,s)] = min((mw @ m.vertices[i].co).z for i in shoe[s]) if shoe[s] else 0.0
        ev.to_mesh_clear()

    end_R = max(2, int(round(NF * 0.22)))          # ~22% du cycle en appui
    SUP_R = range(1, end_R + 1)
    half = NF // 2
    SUP_L = range(1 + half, 1 + half + end_R)
    z = {}
    for f in SUP_R: z[f] = -low[(f,"R")]
    for f in SUP_L: z[f] = -low[(f,"L")]
    z[NF + 1] = z[1]
    H = pr["fly"] * sc
    def flight(f0, f1):
        for f in range(f0 + 1, f1):
            t = (f - f0) / (f1 - f0)
            z[f] = (1-t)*z[f0] + t*z[f1] + 4*H*t*(1-t)
    flight(end_R, 1 + half)
    flight(half + end_R, NF + 1)
    zs = {}
    for f in range(1, NF + 1):
        a = z.get(f-1, z[NF]) if f > 1 else z[NF]
        c = z.get(f+1, z[1])
        sm = 0.25*a + 0.5*z[f] + 0.25*c
        # le lissage adoucit la courbe mais ne doit jamais faire passer la
        # semelle sous la piste : on plafonne par la hauteur de contact reelle.
        floor = max(-low[(f,"R")], -low[(f,"L")])
        zs[f] = max(sm, floor)
    zs[NF + 1] = zs[1]

    only(rig); bpy.ops.object.mode_set(mode='POSE')
    hips = rig.pose.bones["hips"]
    # pose_bone.location s'exprime dans le repere de l'os au repos : pour un os
    # de bassin qui pointe vers le haut, l'axe Z local est horizontal. On
    # convertit donc le "monter de dz" en coordonnees de l'os, sinon la
    # compensation pousse le bassin en avant au lieu de le lever.
    up = rig.data.bones["hips"].matrix_local.to_3x3().inverted() @ Vector((0,0,1))
    for f in range(1, NF + 2):
        sc_.frame_set(f)
        hips.location = up * zs[f]
        hips.keyframe_insert("location", frame=f)
    bpy.ops.object.mode_set(mode='OBJECT')

    act = rig.animation_data.action
    act.name = "%s_Sprint" % spec["name"]
    act.use_fake_user = True
    fcs = []
    for lay in act.layers:
        for st in lay.strips:
            for cb in st.channelbags: fcs.extend(cb.fcurves)
    for fc in fcs:
        if not any(mm.type == 'CYCLES' for mm in fc.modifiers):
            fc.modifiers.new('CYCLES')

    pen = 0.0; fly = 0
    for f in range(1, NF + 1):
        sc_.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = body.evaluated_get(dg); m = ev.to_mesh(); mw = body.matrix_world
        hh = {s: (min((mw @ m.vertices[i].co).z for i in shoe[s]) if shoe[s] else 9)
              for s in ("R","L")}
        ev.to_mesh_clear()
        pen = min(pen, hh["R"], hh["L"])
        if hh["R"] > 0.025*sc and hh["L"] > 0.025*sc: fly += 1
    return dict(nf=NF, pen=pen, fly=fly, amp=max(zs.values())-min(zs.values()))

# --------------------------------------------------------------------------
# BOUCLE PRINCIPALE
# --------------------------------------------------------------------------
def run(export_dir=None):
    scene = bpy.context.scene
    scene.render.fps = 60
    bpy.ops.object.mode_set(mode='OBJECT')
    report = []

    root = bpy.data.collections.get("Roster")
    if root is None:
        root = bpy.data.collections.new("Roster")
        scene.collection.children.link(root)

    M_SKIN = mat("ZZ_Peau", EBENE, 0.62)
    for spec in ROSTER:
        nm = spec["name"]
        # on repart d'une collection propre pour CE personnage uniquement :
        # rien d'autre dans le fichier n'est touche.
        old = bpy.data.collections.get("ZZ_" + nm)
        if old:
            for ob in list(old.objects): bpy.data.objects.remove(ob, do_unlink=True)
            bpy.data.collections.remove(old)
        coll = bpy.data.collections.new("ZZ_" + nm)
        root.children.link(coll)

        M_TOP  = mat("ZZ_%s_haut"  % nm, spec["jersey"], 0.70)
        M_SHO  = mat("ZZ_%s_short" % nm, spec["shorts"], 0.75)
        M_SHOE = mat("ZZ_%s_shoe"  % nm, spec["shoe"],   0.45)
        M_SOLE = mat("ZZ_%s_sole"  % nm, tuple(min(1.0, c*0.35 + 0.55) for c in spec["jersey"]), 0.55)
        M_HAIR = mat("ZZ_Cheveux", (0.028, 0.020, 0.018), 0.42)

        body, G = build_character(spec, coll)
        paint_body(body, spec, G, M_SKIN, M_TOP, M_SHO)
        hair = build_hair(spec, G, coll, M_HAIR)
        sl = build_shoe(spec, G, -1, coll, M_SHOE, M_SOLE)
        sr = build_shoe(spec, G,  1, coll, M_SHOE, M_SOLE)

        for o in bpy.context.selected_objects: o.select_set(False)
        parts = [body] + ([hair] if hair else []) + [sl, sr]
        for o in parts: o.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.join()
        body.name = nm

        only(body)
        bm = bmesh.new(); bm.from_mesh(body.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0001)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bm.to_mesh(body.data); bm.free(); body.data.update()
        body.location = (0,0,0)
        scene.cursor.location = (0,0,0)
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

        rig = build_rig(spec, G, coll)
        for o in bpy.context.selected_objects: o.select_set(False)
        body.select_set(True); rig.select_set(True)
        bpy.context.view_layer.objects.active = rig
        try:
            bpy.ops.object.parent_set(type='ARMATURE_AUTO'); mode = "auto"
        except Exception:
            bpy.ops.object.parent_set(type='ARMATURE_ENVELOPE'); mode = "envelope"

        st = animate(rig, body, spec, G)
        hgt = max(v.co.z for v in body.data.vertices)
        report.append("%-9s %s  h=%.2f (mesh %.2f)  %-8s nf=%2d  vol=%2d/%2d  "
                      "bassin=%.3f  penetration=%.4f  %d verts [%s]" %
                      (nm, spec["build"], spec["h"], hgt, spec["gait"], st["nf"],
                       st["fly"], st["nf"], st["amp"], st["pen"],
                       len(body.data.vertices), mode))

        if export_dir:
            for o in bpy.context.selected_objects: o.select_set(False)
            body.select_set(True); rig.select_set(True)
            bpy.context.view_layer.objects.active = rig
            scene.frame_start, scene.frame_end = 1, st["nf"]
            bpy.ops.export_scene.gltf(
                filepath="%s/%s.glb" % (export_dir, nm.lower()),
                export_format='GLB', use_selection=True,
                export_animations=True, export_frame_range=True,
                export_yup=True, export_apply=True)
    return report
