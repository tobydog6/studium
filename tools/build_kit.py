# Build the lighting kit (stands and fixtures) in Blender and export one GLB for the lighting rig.
#   uv venv -p 3.13 bl && uv pip install -p bl/bin/python bpy==5.2.3
#   bl/bin/python tools/build_kit.py assets/kit/lightkit.glb
# Blender is Z-up; the glTF export turns that into three's Y-up, and Blender -Y becomes three +Z, so every head here
# shines toward -Y (three's lookAt points +Z at the target). Each fixture is "fx_<id>" with children "<id>_head" (tilts
# and turns) and, if it has one, "<id>_yoke" (turns only). Both pivot on the origin, which sits on top of the stand.
# Materials named "Emit" glow in the light's colour at runtime; "Surf" is the reflector's face (white, silver, gold).
import bpy, bmesh, sys, math
from mathutils import Vector, Matrix

OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else 'lightkit.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
SC = bpy.context.scene
TAU = math.tau

def mat(name, col, metal=0.0, rough=0.5, emit=False):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*col, 1); b.inputs['Emission Strength'].default_value = 1.0
    return m

M = {'black': mat('Black', (0.018, 0.018, 0.02), 0.5, 0.42), 'alu': mat('Alu', (0.62, 0.62, 0.64), 1.0, 0.32),
     'fabric': mat('Fabric', (0.012, 0.012, 0.013), 0.0, 0.92), 'rubber': mat('Rubber', (0.01, 0.01, 0.01), 0.0, 0.8),
     'emit': mat('Emit', (0.95, 0.94, 0.9), 0.0, 0.6, True), 'surf': mat('Surf', (0.8, 0.82, 0.85), 1.0, 0.25),
     'silver': mat('Silver', (0.8, 0.8, 0.82), 1.0, 0.2), 'white': mat('WhiteIn', (0.9, 0.9, 0.88), 0.0, 0.7),
     'wax': mat('Wax', (0.86, 0.8, 0.66), 0.0, 0.55), 'brass': mat('Brass', (0.7, 0.55, 0.3), 1.0, 0.35),
     'green': mat('PostGreen', (0.03, 0.06, 0.05), 0.6, 0.45), 'knob': mat('Knob', (0.05, 0.05, 0.055), 0.2, 0.5)}

def link(ob, parent=None):
    SC.collection.objects.link(ob)
    if parent: ob.parent = parent
    return ob

def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None); e.location = loc; return link(e, parent)

def mesh_ob(name, bm, m, parent=None, smooth=True, bevel=0.0, segs=2):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); me.materials.append(M[m] if isinstance(m, str) else m); link(ob, parent)
    if bevel > 0:
        md = ob.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = segs; md.limit_method = 'ANGLE'
    if smooth:
        md = ob.modifiers.new('ws', 'WEIGHTED_NORMAL'); md.keep_sharp = True
    return ob

def cyl(name, r, a, b, m, parent=None, segs=32, r2=None, cap=True, bevel=0.0):
    """a cylinder (or cone, with r2) from point a to point b"""
    a, b = Vector(a), Vector(b); d = b - a; L = d.length
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=cap, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=L)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), verts=bm.verts)
    return mesh_ob(name, bm, m, parent, True, bevel)

def box(name, size, loc, m, parent=None, rot=None, bevel=0.004):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    mtx = Matrix.Translation(loc) @ (rot.to_4x4() if rot else Matrix.Identity(4))
    bmesh.ops.transform(bm, matrix=mtx, verts=bm.verts)
    return mesh_ob(name, bm, m, parent, False, bevel)

def torus(name, R, r, loc, axis, m, parent=None, segs=48, rsegs=10):
    bm = bmesh.new(); vs = []
    for i in range(segs):
        u = i / segs * TAU
        for j in range(rsegs):
            v = j / rsegs * TAU
            vs.append(bm.verts.new(((R + r * math.cos(v)) * math.cos(u), (R + r * math.cos(v)) * math.sin(u), r * math.sin(v))))
    for i in range(segs):
        for j in range(rsegs):
            a = vs[i * rsegs + j]; b = vs[((i + 1) % segs) * rsegs + j]; c = vs[((i + 1) % segs) * rsegs + (j + 1) % rsegs]; d = vs[i * rsegs + (j + 1) % rsegs]
            bm.faces.new((a, b, c, d))
    q = Vector((0, 0, 1)).rotation_difference(Vector(axis).normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation(loc) @ q.to_matrix().to_4x4(), verts=bm.verts)
    return mesh_ob(name, bm, m, parent)

def lathe(name, prof, m, parent=None, segs=48, axis=(0, -1, 0), loc=(0, 0, 0), close=False):
    """spin a (radius, along) profile round an axis"""
    bm = bmesh.new(); rings = []
    for i in range(segs):
        u = i / segs * TAU; ring = []
        for (r, h) in prof: ring.append(bm.verts.new((r * math.cos(u), r * math.sin(u), h)))
        rings.append(ring)
    n = len(prof)
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % segs]
        for j in range(n - 1): bm.faces.new((A[j], B[j], B[j + 1], A[j + 1]))
    if close:
        c = bm.verts.new((0, 0, prof[-1][1])); [bm.faces.new((rings[i][-1], rings[(i + 1) % segs][-1], c)) for i in range(segs)]
    q = Vector((0, 0, 1)).rotation_difference(Vector(axis).normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation(loc) @ q.to_matrix().to_4x4(), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_ob(name, bm, m, parent)
    md = ob.modifiers.new('solid', 'SOLIDIFY'); md.thickness = 0.003
    return ob

def frustum(name, front, back, y0, y1, m, parent=None, r=0.02):
    """a softbox shell: rectangle `back` (w, h) at y0 opening to rectangle `front` at y1, no ends"""
    bm = bmesh.new()
    def rect(w, h, y):
        return [bm.verts.new((sx * w / 2, y, sz * h / 2)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    B, F = rect(*back, y0), rect(*front, y1)
    for i in range(4): bm.faces.new((B[i], B[(i + 1) % 4], F[(i + 1) % 4], F[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_ob(name, bm, m, parent, False)
    md = ob.modifiers.new('solid', 'SOLIDIFY'); md.thickness = 0.006
    md = ob.modifiers.new('bev', 'BEVEL'); md.width = r; md.segments = 4; md.limit_method = 'ANGLE'
    return ob

def plane(name, w, h, y, m, parent=None):
    bm = bmesh.new(); vs = [bm.verts.new((sx * w / 2, y, sz * h / 2)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    bm.faces.new(vs[::-1]); return mesh_ob(name, bm, m, parent, False)

def disc(name, r, y, m, parent=None, segs=48):
    bm = bmesh.new(); vs = [bm.verts.new((r * math.cos(i / segs * TAU), y, r * math.sin(i / segs * TAU))) for i in range(segs)]
    bm.faces.new(vs); return mesh_ob(name, bm, m, parent, False)

def strobe(p, y0=0.0):
    """a monolight body behind a modifier: the head of most of the kit"""
    cyl('strobe', 0.062, (0, y0 + 0.03, 0), (0, y0 + 0.24, 0), 'black', p, bevel=0.006)
    cyl('strobe_cap', 0.055, (0, y0 + 0.24, 0), (0, y0 + 0.262, 0), 'knob', p, bevel=0.004)
    torus('strobe_ring', 0.064, 0.006, (0, y0 + 0.035, 0), (0, 1, 0), 'alu', p)
    box('strobe_handle', (0.014, 0.12, 0.012), (0, y0 + 0.15, 0.078), 'knob', p)
    for x in (-0.012, 0.012): cyl('strobe_hpost', 0.005, (x, y0 + 0.1, 0.062), (x, y0 + 0.1, 0.078), 'knob', p, segs=10)

def bracket(p, drop=0.12):
    """umbrella bracket: turns with the light, sits on the stand's spigot"""
    box('bracket', (0.05, 0.07, 0.03), (0, 0.06, -0.075), 'black', p)
    cyl('bracket_sock', 0.017, (0, 0.06, -0.09), (0, 0.06, -drop - 0.02), 'black', p, segs=20, bevel=0.003)
    cyl('bracket_knob', 0.012, (0.025, 0.06, -0.1), (0.055, 0.06, -0.1), 'knob', p, segs=16, bevel=0.003)
    cyl('bracket_tilt', 0.014, (-0.04, 0.06, -0.06), (0.04, 0.06, -0.06), 'alu', p, segs=20)

# ---------------- the stand ----------------
st = empty('stand')
base = empty('stand_base', st)
cyl('collar', 0.028, (0, 0, 0.5), (0, 0, 0.6), 'black', base, bevel=0.004)
cyl('lower_tube', 0.017, (0, 0, 0.2), (0, 0, 0.66), 'black', base)
cyl('lower_cap', 0.022, (0, 0, 0.64), (0, 0, 0.68), 'black', base, bevel=0.003)
cyl('lock_knob', 0.011, (0.02, 0, 0.66), (0.055, 0, 0.66), 'knob', base, segs=16, bevel=0.003)
cyl('brace_hub', 0.024, (0, 0, 0.28), (0, 0, 0.33), 'black', base, bevel=0.003)
for i in range(3):
    a = i * TAU / 3; c, s = math.cos(a), math.sin(a)
    foot = Vector((c * 0.46, s * 0.46, 0.015)); top = Vector((c * 0.03, s * 0.03, 0.55))
    cyl('leg', 0.011, top, foot, 'black', base, segs=14)
    mid = top.lerp(foot, 0.55); cyl('brace', 0.007, (c * 0.026, s * 0.026, 0.305), mid, 'alu', base, segs=10)
    cyl('foot', 0.016, foot + Vector((0, 0, -0.012)), foot + Vector((0, 0, 0.012)), 'rubber', base, segs=14, bevel=0.004)
pole = empty('stand_pole', st)
cyl('pole_tube', 0.012, (0, 0, 0), (0, 0, 1), 'alu', pole, segs=20, cap=True)
top = empty('stand_top', st)
cyl('top_collar', 0.016, (0, 0, -0.06), (0, 0, -0.02), 'black', top, bevel=0.003)
cyl('spigot', 0.008, (0, 0, -0.02), (0, 0, 0.03), 'alu', top, segs=16)
cyl('top_knob', 0.009, (0.015, 0, -0.04), (0.045, 0, -0.04), 'knob', top, segs=14, bevel=0.002)
post = empty('street_post', st)
cyl('post', 0.055, (0, 0, 0), (0, 0, 1), 'green', post, segs=24, r2=0.04)
cyl('post_flange', 0.12, (0, 0, 0), (0, 0, 0.05), 'green', post, segs=24, r2=0.08, bevel=0.01)

# ---------------- the fixtures ----------------
def fixture(fid):
    f = empty('fx_' + fid); return f, empty(fid + '_head', f), empty(fid + '_yoke', f)

# Fresnel: finned body, stepped lens, barn doors, a yoke round it
f, h, y = fixture('fresnel')
cyl('body', 0.1, (0, 0.11, 0), (0, -0.13, 0), 'black', h, segs=40, bevel=0.01)
for k in range(6): torus('fin', 0.102, 0.006, (0, 0.09 - k * 0.022, 0), (0, 1, 0), 'black', h, rsegs=8)
torus('bezel', 0.1, 0.014, (0, -0.135, 0), (0, 1, 0), 'black', h)
disc('lens', 0.088, -0.138, 'emit', h)
for rr in (0.03, 0.05, 0.07): torus('lens_step', rr, 0.0025, (0, -0.139, 0), (0, 1, 0), 'emit', h, segs=40, rsegs=6)
for side in ('t', 'b', 'l', 'r'):
    w, ln = (0.2, 0.13) if side in 'tb' else (0.15, 0.11)
    door = box('door_' + side, (w, ln, 0.003), (0, -ln / 2, 0), 'black', h, bevel=0.0015)
    sgn = 1 if side in 'tr' else -1
    if side in 'tb': door.rotation_euler = (math.radians(-28 * sgn), 0, 0); door.location = (0, -0.15, 0.108 * sgn)
    else:
        door.rotation_euler = (0, math.radians(90), math.radians(28 * sgn)); door.location = (0.108 * sgn, -0.15, 0)
cyl('rear', 0.08, (0, 0.11, 0), (0, 0.13, 0), 'black', h, bevel=0.005)
for x in (-0.125, 0.125): box('yoke_arm', (0.012, 0.05, 0.19), (x, 0, -0.04), 'black', y); cyl('yoke_knob', 0.016, (x, 0, 0), (x * 1.12, 0, 0), 'knob', y, segs=18, bevel=0.003)
box('yoke_bar', (0.262, 0.05, 0.014), (0, 0, -0.135), 'black', y)
cyl('yoke_sock', 0.017, (0, 0, -0.14), (0, 0, -0.18), 'black', y, segs=20)

# Speedlight on a cold-shoe bracket
f, h, y = fixture('speed')
box('flash_body', (0.07, 0.042, 0.105), (0, 0.01, -0.04), 'black', h, bevel=0.006)
box('flash_head', (0.08, 0.06, 0.046), (0, -0.01, 0.035), 'black', h, bevel=0.006)
plane('flash_face', 0.066, 0.034, -0.0405, 'emit', h).location = (0, 0, 0.035)
box('flash_screen', (0.05, 0.002, 0.04), (0, 0.032, -0.05), 'knob', h, bevel=0.001)
bracket(y, 0.1)

# Softbox 90 x 65
f, h, y = fixture('softbox')
strobe(h, 0.02)
box('speedring', (0.2, 0.025, 0.2), (0, 0.0, 0), 'black', h, bevel=0.006)
frustum('softbox_shell', (0.9, 0.65), (0.16, 0.16), -0.01, -0.48, 'fabric', h, 0.012)
plane('softbox_face', 0.87, 0.62, -0.47, 'emit', h)
for sx in (-1, 1):
    for sz in (-1, 1): cyl('rod', 0.004, (sx * 0.08, -0.01, sz * 0.08), (sx * 0.45, -0.48, sz * 0.325), 'alu', h, segs=8)
bracket(y)

# Stripbox 30 x 110
f, h, y = fixture('strip')
strobe(h, 0.02)
box('speedring', (0.2, 0.025, 0.2), (0, 0.0, 0), 'black', h, bevel=0.006)
frustum('strip_shell', (0.3, 1.1), (0.16, 0.16), -0.01, -0.32, 'fabric', h, 0.01)
plane('strip_face', 0.28, 1.08, -0.31, 'emit', h)
bracket(y)

# Shoot-through umbrella
f, h, y = fixture('umbrella')
strobe(h, 0.02)
cyl('shaft', 0.004, (0, 0.3, 0), (0, -0.6, 0), 'alu', h, segs=10)
R, D = 0.5, 0.22
prof = [(R * i / 16, 0.58 - D * (i / 16) ** 2) for i in range(17)]
lathe('canopy', prof, 'emit', h, segs=24, axis=(0, -1, 0))
for k in range(24):
    a = k / 24 * TAU
    pts = [Vector((r * math.cos(a), hh, r * math.sin(a))) for r, hh in [(R * i / 8, -0.58 + D * (i / 8) ** 2 + 0.004) for i in range(9)]]
    for i in range(8): cyl('rib', 0.0025, pts[i], pts[i + 1], 'black', h, segs=6, cap=False)
bracket(y)

# Beauty dish
f, h, y = fixture('dish')
strobe(h, 0.02)
lathe('dish_out', [(0.07, 0.0), (0.16, 0.035), (0.23, 0.08), (0.27, 0.13), (0.275, 0.14)], 'silver', h, axis=(0, -1, 0))
lathe('dish_in', [(0.069, 0.004), (0.158, 0.038), (0.227, 0.082), (0.266, 0.13)], 'white', h, axis=(0, -1, 0))
torus('dish_lip', 0.272, 0.006, (0, -0.14, 0), (0, 1, 0), 'silver', h)
disc('dish_glow', 0.12, -0.03, 'emit', h)
cyl('deflector', 0.07, (0, -0.09, 0), (0, -0.096, 0), 'silver', h, segs=40, bevel=0.002)
for k in range(3):
    a = k / 3 * TAU; cyl('defl_rod', 0.002, (0.03 * math.cos(a), -0.02, 0.03 * math.sin(a)), (0.06 * math.cos(a), -0.09, 0.06 * math.sin(a)), 'alu', h, segs=6)
bracket(y)

# 5-in-1 reflector on a holder arm (face is "Surf")
f, h, y = fixture('reflector')
disc('refl_face', 0.39, 0.0, 'surf', h, segs=64).modifiers.new('s', 'SOLIDIFY').thickness = 0.002
torus('refl_rim', 0.395, 0.007, (0, 0, 0), (0, 1, 0), 'black', h, segs=64)
cyl('refl_arm', 0.008, (0, 0.02, -0.39), (0, 0.02, 0.39), 'alu', h, segs=12)
box('refl_clamp', (0.04, 0.03, 0.05), (0, 0.03, -0.39), 'black', h)
box('refl_clamp2', (0.04, 0.03, 0.05), (0, 0.03, 0.39), 'black', h)
cyl('refl_sock', 0.017, (0, 0.03, -0.42), (0, 0.03, -0.46), 'black', y, segs=20)
cyl('refl_drop', 0.008, (0, 0.03, -0.46), (0, 0.03, -0.52), 'alu', y, segs=12)

# Black flag on a grip arm
f, h, y = fixture('flag')
plane('flag_cloth', 0.6, 0.9, 0.0, 'fabric', h).modifiers.new('s', 'SOLIDIFY').thickness = 0.004
for (a, b) in [((-0.3, 0, -0.45), (0.3, 0, -0.45)), ((0.3, 0, -0.45), (0.3, 0, 0.45)), ((0.3, 0, 0.45), (-0.3, 0, 0.45)), ((-0.3, 0, 0.45), (-0.3, 0, -0.45))]:
    cyl('flag_frame', 0.006, a, b, 'alu', h, segs=10)
cyl('flag_pin', 0.006, (-0.3, 0, -0.45), (-0.3, 0, -0.55), 'alu', h, segs=10)
cyl('grip_head', 0.03, (-0.33, 0, -0.56), (-0.27, 0, -0.56), 'black', h, segs=24, bevel=0.004)
cyl('grip_arm', 0.009, (-0.3, 0, -0.56), (0, 0, -0.56), 'alu', h, segs=12)

# Bare bulb in a clamp socket
f, h, y = fixture('bare')
# an A-shape bulb: round at the bottom, narrowing to the neck
bulb_prof = [(0.04 * math.sin(math.pi * k / 16), -0.045 - 0.035 * math.cos(math.pi * k / 16)) for k in range(0, 12)] + [(0.04 * math.sin(math.pi * 11 / 16) * (1 - u / 6) , -0.045 - 0.035 * math.cos(math.pi * 11 / 16) + 0.006 * u) for u in range(1, 7)]
lathe('bulb', [(0.0, -0.08)] + bulb_prof[1:] + [(0.015, -0.004)], 'emit', h, segs=40, axis=(0, 0, 1))
cyl('socket', 0.02, (0, 0, 0.0), (0, 0, 0.07), 'black', h, segs=24, bevel=0.003)
cyl('socket_ring', 0.023, (0, 0, 0.0), (0, 0, 0.012), 'brass', h, segs=24)
box('clamp', (0.03, 0.03, 0.05), (0, 0, 0.085), 'black', y)
cyl('clamp_sock', 0.017, (0, 0, 0.1), (0, 0, 0.06), 'black', y, segs=20)

# Candle on a dish (the origin is the flame)
f, h, y = fixture('candle')
lathe('flame', [(0.0, 0.03), (0.006, 0.02), (0.009, 0.005), (0.007, -0.008), (0.0, -0.012)], 'emit', h, segs=16, axis=(0, 0, 1))
cyl('wick', 0.0012, (0, 0, -0.022), (0, 0, -0.008), 'rubber', h, segs=6)
cyl('wax', 0.022, (0, 0, -0.145), (0, 0, -0.02), 'wax', h, segs=32, bevel=0.003)
lathe('holder', [(0.0, -0.152), (0.05, -0.152), (0.058, -0.145), (0.06, -0.14)], 'brass', h, segs=40, axis=(0, 0, 1))
cyl('holder_cup', 0.026, (0, 0, -0.15), (0, 0, -0.125), 'brass', h, segs=32, cap=False)

# Streetlight: a post-top lantern (the origin is the lamp)
f, h, y = fixture('sodium')
cyl('lamp_glass', 0.13, (0, 0, -0.12), (0, 0, 0.1), 'emit', h, segs=8, r2=0.16)
cyl('lamp_hat', 0.2, (0, 0, 0.1), (0, 0, 0.24), 'green', h, segs=8, r2=0.02, bevel=0.005)
cyl('lamp_base', 0.13, (0, 0, -0.16), (0, 0, -0.12), 'green', h, segs=8, bevel=0.004)
for k in range(8):
    a = (k + 0.5) / 8 * TAU; cyl('lamp_bar', 0.006, (0.135 * math.cos(a), 0.135 * math.sin(a), -0.12), (0.165 * math.cos(a), 0.165 * math.sin(a), 0.1), 'green', h, segs=6)
cyl('lamp_neck', 0.05, (0, 0, -0.3), (0, 0, -0.16), 'green', y, segs=16, r2=0.07)

# RGB tube on a clamp (the origin is the middle of the tube)
f, h, y = fixture('rgb')
cyl('tube', 0.018, (0, 0, -0.5), (0, 0, 0.5), 'emit', h, segs=20)
for zz in (-0.52, 0.52): cyl('tube_cap', 0.021, (0, 0, zz - 0.025), (0, 0, zz + 0.025), 'black', h, segs=20, bevel=0.004)
box('tube_clamp', (0.05, 0.03, 0.04), (0, 0.03, 0), 'black', y)
cyl('tube_arm', 0.008, (0, 0.045, 0), (0, 0.045, -0.06), 'alu', y, segs=12)

# ---------------- export ----------------
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True, export_texcoords=False,
                          export_normals=True, export_materials='EXPORT', export_extras=False, export_cameras=False, export_lights=False,
                          export_draco_mesh_compression_enable=False)
print('kit written', OUT)
