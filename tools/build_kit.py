# Build the lighting kit (stands and fixtures) in Blender and export one GLB for the lighting rig.
#   uv venv -p 3.13 bl && uv pip install -p bl/bin/python bpy==5.2.3
#   bl/bin/python tools/build_kit.py assets/kit/lightkit.glb
# Blender is Z-up; the glTF export turns that into three's Y-up, and Blender -Y becomes three +Z, so every head here
# shines toward -Y (three's lookAt points +Z at the target). Each fixture is "fx_<id>" with children "<id>_head" (tilts
# and turns) and, if it has one, "<id>_yoke" (turns only). Both pivot on the origin, which sits on top of the stand.
# Materials named "Emit" glow in the light's colour at runtime; "Surf" is the reflector's face (white, silver, gold).
# Modelled after real kit: a Manfrotto-style air-cushioned light stand, a Bowens-mount monolight, a 650 W Fresnel.
import bpy, bmesh, sys, math
from mathutils import Vector, Matrix

OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else 'lightkit.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
SC = bpy.context.scene
TAU = math.tau

def mat(name, col, metal=0.0, rough=0.5, emit=False, sheen=0.0, coat=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*col, 1); b.inputs['Emission Strength'].default_value = 1.0
    if sheen: b.inputs['Sheen Weight'].default_value = sheen; b.inputs['Sheen Roughness'].default_value = 0.5
    if coat: b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = 0.15
    return m

M = {'black': mat('Black', (0.045, 0.045, 0.048), 0.0, 0.36, coat=0.35),            # powder-coated steel and plastics: dark grey, not ink
     'satin': mat('Satin', (0.07, 0.07, 0.075), 0.6, 0.42),                          # anodised dark aluminium
     'alu': mat('Alu', (0.7, 0.7, 0.72), 1.0, 0.34),                                  # brushed aluminium
     'chrome': mat('Chrome', (0.82, 0.82, 0.84), 1.0, 0.08),
     'fabric': mat('Fabric', (0.014, 0.014, 0.015), 0.0, 0.95, sheen=0.6),             # softbox nylon
     'rubber': mat('Rubber', (0.012, 0.012, 0.012), 0.0, 0.85),
     'emit': mat('Emit', (0.95, 0.94, 0.9), 0.0, 0.6, True), 'surf': mat('Surf', (0.8, 0.82, 0.85), 1.0, 0.25),
     'silver': mat('Silver', (0.8, 0.8, 0.82), 1.0, 0.2), 'white': mat('WhiteIn', (0.9, 0.9, 0.88), 0.0, 0.7, sheen=0.3),
     'screen': mat('Screen', (0.02, 0.05, 0.07), 0.0, 0.1, coat=1.0), 'glass': mat('Glass', (0.6, 0.62, 0.6), 0.0, 0.05),
     'green': mat('PostGreen', (0.03, 0.06, 0.05), 0.6, 0.45), 'knob': mat('Knob', (0.04, 0.04, 0.045), 0.0, 0.55),
     'red': mat('Accent', (0.5, 0.05, 0.03), 0.0, 0.4, coat=0.5), 'brass': mat('Brass', (0.7, 0.55, 0.3), 1.0, 0.35)}

def link(ob, parent=None):
    SC.collection.objects.link(ob)
    if parent: ob.parent = parent
    return ob

def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None); e.location = loc; return link(e, parent)

def finish(ob, smooth=True, bevel=0.0, segs=3):
    if bevel > 0:
        md = ob.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = segs; md.limit_method = 'ANGLE'; md.harden_normals = True
    if smooth:
        for p in ob.data.polygons: p.use_smooth = True
        md = ob.modifiers.new('ws', 'WEIGHTED_NORMAL'); md.keep_sharp = True
    return ob

def mesh_ob(name, bm, m, parent=None, smooth=True, bevel=0.0, segs=3):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); me.materials.append(M[m] if isinstance(m, str) else m); link(ob, parent)
    return finish(ob, smooth, bevel, segs)

def cyl(name, r, a, b, m, parent=None, segs=40, r2=None, cap=True, bevel=0.0):
    """a cylinder (or cone, with r2) from point a to point b"""
    a, b = Vector(a), Vector(b); d = b - a; L = d.length
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=cap, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=L)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), verts=bm.verts)
    return mesh_ob(name, bm, m, parent, True, bevel)

def knurl(name, r, a, b, m, parent=None, ridges=24):
    """a knurled knob: alternating radius round the rim"""
    a, b = Vector(a), Vector(b); d = b - a; L = d.length; n = ridges * 2
    bm = bmesh.new(); bot = []; top = []
    for i in range(n):
        u = i / n * TAU; rr = r * (1.0 if i % 2 == 0 else 0.9)
        bot.append(bm.verts.new((rr * math.cos(u), rr * math.sin(u), -L / 2))); top.append(bm.verts.new((rr * math.cos(u), rr * math.sin(u), L / 2)))
    for i in range(n): bm.faces.new((bot[i], bot[(i + 1) % n], top[(i + 1) % n], top[i]))
    bm.faces.new(top); bm.faces.new(bot[::-1])
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), verts=bm.verts)
    return mesh_ob(name, bm, m, parent, False, 0.002, 2)

def box(name, size, loc, m, parent=None, rot=None, bevel=0.004, segs=3):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    mtx = Matrix.Translation(loc) @ (rot.to_4x4() if rot else Matrix.Identity(4))
    bmesh.ops.transform(bm, matrix=mtx, verts=bm.verts)
    return mesh_ob(name, bm, m, parent, False, bevel, segs)

def torus(name, R, r, loc, axis, m, parent=None, segs=56, rsegs=12):
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

def lathe(name, prof, m, parent=None, segs=56, axis=(0, -1, 0), loc=(0, 0, 0), thick=0.003):
    """spin a (radius, along) profile round an axis"""
    bm = bmesh.new(); rings = []
    for i in range(segs):
        u = i / segs * TAU; rings.append([bm.verts.new((r * math.cos(u), r * math.sin(u), h)) for (r, h) in prof])
    n = len(prof)
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % segs]
        for j in range(n - 1): bm.faces.new((A[j], B[j], B[j + 1], A[j + 1]))
    q = Vector((0, 0, 1)).rotation_difference(Vector(axis).normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation(loc) @ q.to_matrix().to_4x4(), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_ob(name, bm, m, parent)
    if thick: md = ob.modifiers.new('solid', 'SOLIDIFY'); md.thickness = thick
    return ob

def grid_surface(name, fn, nu, nv, m, parent=None, thick=0.0, closed_u=False):
    """a surface from fn(u, v) -> Vector, u and v in 0..1"""
    bm = bmesh.new(); uu = nu if closed_u else nu + 1
    V = [[bm.verts.new(fn(i / nu, j / nv)) for j in range(nv + 1)] for i in range(uu)]
    for i in range(nu):
        i2 = (i + 1) % uu if closed_u else i + 1
        for j in range(nv): bm.faces.new((V[i][j], V[i2][j], V[i2][j + 1], V[i][j + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_ob(name, bm, m, parent)
    if thick: md = ob.modifiers.new('solid', 'SOLIDIFY'); md.thickness = thick
    return ob

def plane(name, w, h, y, m, parent=None, nx=1, nz=1, bow=0.0):
    """a w x h panel facing -Y at depth y, optionally bowed toward -Y in the middle (stretched fabric)"""
    return grid_surface(name, lambda u, v: Vector(((u - 0.5) * w, y - bow * math.sin(math.pi * u) * math.sin(math.pi * v), (v - 0.5) * h)), nx, nz, m, parent)

def disc(name, r, y, m, parent=None, segs=64):
    bm = bmesh.new(); vs = [bm.verts.new((r * math.cos(i / segs * TAU), y, r * math.sin(i / segs * TAU))) for i in range(segs)]
    bm.faces.new(vs); return mesh_ob(name, bm, m, parent, False)

def tknob(name, at, axis, parent):
    """a T-handle locking knob, the kind on every light stand collar"""
    at, ax = Vector(at), Vector(axis).normalized()
    cyl(name + '_stem', 0.005, at, at + ax * 0.03, 'chrome', parent, segs=16)
    side = ax.cross(Vector((0, 0, 1))); side = side.normalized() if side.length > 1e-4 else Vector((1, 0, 0))
    c = at + ax * 0.034; box(name + '_bar', (0.012, 0.012, 0.012), c, 'knob', parent, bevel=0.004)
    cyl(name + '_wing', 0.007, c - side * 0.022, c + side * 0.022, 'knob', parent, segs=16, bevel=0.003)

# ---------------- the stand: air-cushioned, three sections ----------------
st = empty('stand')
base = empty('stand_base', st)
cyl('lower_tube', 0.0175, (0, 0, 0.16), (0, 0, 0.7), 'alu', base, segs=32)
cyl('base_cap', 0.019, (0, 0, 0.145), (0, 0, 0.165), 'black', base, segs=32, bevel=0.003)
cyl('leg_collar', 0.027, (0, 0, 0.5), (0, 0, 0.6), 'black', base, segs=40, bevel=0.005)
tknob('leg_lock', (0, 0.026, 0.55), (0, 1, 0), base)
cyl('brace_hub', 0.024, (0, 0, 0.26), (0, 0, 0.31), 'black', base, segs=40, bevel=0.004)
tknob('hub_lock', (0, 0.024, 0.285), (0, 1, 0), base)
cyl('top_collar', 0.022, (0, 0, 0.68), (0, 0, 0.73), 'black', base, segs=40, bevel=0.004)
tknob('sect_lock', (0.021, 0, 0.705), (1, 0, 0), base)
for i in range(3):
    a = i * TAU / 3 + math.pi / 2; c, s = math.cos(a), math.sin(a); R = Vector((c, s, 0))
    hinge = R * 0.03 + Vector((0, 0, 0.56)); foot = R * 0.47 + Vector((0, 0, 0.02))
    box('leg_hinge', (0.022, 0.03, 0.04), hinge + R * 0.01, 'black', base, rot=Matrix.Rotation(a, 3, 'Z'), bevel=0.003)
    cyl('leg', 0.0105, hinge, foot, 'alu', base, segs=20)   # brushed aluminium legs, dark joints
    mid = hinge.lerp(foot, 0.52); hub = R * 0.026 + Vector((0, 0, 0.285))
    d = mid - hub; box('brace', (d.length, 0.012, 0.004), (hub + mid) / 2, 'alu', base, rot=Vector((1, 0, 0)).rotation_difference(d.normalized()).to_matrix(), bevel=0.0015)
    for p in (hub + d * 0.04, mid - d * 0.04): cyl('rivet', 0.0035, p + Vector((0, 0, -0.004)), p + Vector((0, 0, 0.004)), 'chrome', base, segs=12)
    lathe('foot', [(0.0, 0.0), (0.017, 0.0), (0.019, 0.006), (0.016, 0.022), (0.011, 0.03)], 'rubber', base, segs=24, axis=(0, 0, 1), loc=tuple(foot - Vector((0, 0, 0.02))), thick=0)
pole = empty('stand_pole', st)
cyl('pole_tube', 0.0135, (0, 0, 0), (0, 0, 1), 'alu', pole, segs=32, cap=True)
top = empty('stand_top', st)
cyl('top2_collar', 0.018, (0, 0, -0.1), (0, 0, -0.06), 'black', top, segs=36, bevel=0.003)
tknob('top_lock', (0.017, 0, -0.08), (1, 0, 0), top)
cyl('top3_tube', 0.0105, (0, 0, -0.06), (0, 0, -0.012), 'alu', top, segs=28)
cyl('spigot_base', 0.012, (0, 0, -0.016), (0, 0, -0.004), 'chrome', top, segs=28, bevel=0.002)
cyl('spigot', 0.008, (0, 0, -0.004), (0, 0, 0.03), 'chrome', top, segs=24)   # 5/8" stud
post = empty('street_post', st)
cyl('post', 0.055, (0, 0, 0), (0, 0, 1), 'green', post, segs=32, r2=0.04)
lathe('post_base', [(0.13, 0.0), (0.13, 0.03), (0.1, 0.06), (0.075, 0.12), (0.06, 0.2)], 'green', post, segs=40, axis=(0, 0, 1), thick=0)

# ---------------- shared pieces ----------------
def monolight(p, y0=0.02, front_emit=False):
    """a Bowens-mount studio flash: body, mount ring, flash tube, modelling lamp, vents, rear screen and dial"""
    lathe('mono_body', [(0.058, y0 + 0.02), (0.066, y0 + 0.035), (0.068, y0 + 0.12), (0.066, y0 + 0.2), (0.058, y0 + 0.235), (0.0, y0 + 0.24)], 'black', p, segs=56, axis=(0, 1, 0), thick=0)
    cyl('mount_ring', 0.07, (0, y0 + 0.006, 0), (0, y0 + 0.026, 0), 'satin', p, segs=56, bevel=0.003)
    for k in range(3):
        a = k / 3 * TAU + 0.4; box('bowens_lug', (0.02, 0.01, 0.008), (0.071 * math.cos(a), y0 + 0.012, 0.071 * math.sin(a)), 'satin', p, rot=Matrix.Rotation(-a, 3, 'Y'), bevel=0.002)
    torus('flash_tube', 0.032, 0.0045, (0, y0 + 0.0, 0), (0, 1, 0), 'emit', p, segs=40, rsegs=8)
    lathe('model_lamp', [(0.0, y0 - 0.035), (0.016, y0 - 0.03), (0.02, y0 - 0.015), (0.014, y0 + 0.005)], 'emit', p, segs=28, axis=(0, 1, 0), thick=0)
    for k in range(10):
        a = (k / 10) * math.pi + math.pi * 0.05
        box('vent', (0.004, 0.06, 0.012), (0.0675 * math.cos(a), y0 + 0.15, 0.0675 * math.sin(a)), 'knob', p, rot=Matrix.Rotation(-a + math.pi / 2, 3, 'Y'), bevel=0.0015, segs=2)
    box('rear_panel', (0.09, 0.006, 0.07), (0, y0 + 0.243, 0.005), 'satin', p, bevel=0.003)
    box('screen', (0.05, 0.002, 0.026), (0, y0 + 0.2465, 0.016), 'screen', p, bevel=0.001, segs=1)
    knurl('dial', 0.011, (0.028, y0 + 0.246, -0.018), (0.028, y0 + 0.256, -0.018), 'knob', p)
    for x in (-0.018, -0.004, 0.01): cyl('button', 0.004, (x, y0 + 0.246, -0.018), (x, y0 + 0.25, -0.018), 'knob', p, segs=14)
    cyl('ready_led', 0.0025, (-0.03, y0 + 0.246, 0.016), (-0.03, y0 + 0.248, 0.016), 'red', p, segs=10)
    box('handle', (0.014, 0.13, 0.012), (0, y0 + 0.14, 0.088), 'knob', p, bevel=0.005)
    for yy in (0.085, 0.195): cyl('handle_post', 0.005, (0, y0 + yy, 0.066), (0, y0 + yy, 0.084), 'knob', p, segs=12)

def bracket(p, drop=0.12):
    """the umbrella bracket under a monolight: turns with the light, sits on the stand's spigot"""
    box('bracket_block', (0.05, 0.07, 0.034), (0, 0.07, -0.08), 'black', p, bevel=0.005)
    cyl('bracket_sock', 0.017, (0, 0.07, -0.097), (0, 0.07, -drop - 0.02), 'black', p, segs=28, bevel=0.003)
    knurl('bracket_knob', 0.013, (0.025, 0.07, -0.11), (0.042, 0.07, -0.11), 'knob', p)
    cyl('tilt_axle', 0.015, (-0.036, 0.07, -0.065), (0.036, 0.07, -0.065), 'satin', p, segs=28, bevel=0.002)
    cyl('tilt_lever', 0.006, (-0.036, 0.07, -0.065), (-0.07, 0.11, -0.03), 'knob', p, segs=12)
    cyl('brolly_hole', 0.005, (0, 0.04, -0.065), (0, 0.1, -0.065), 'chrome', p, segs=12)

def speedring(p, w):
    cyl('speedring', 0.1, (0, -0.002, 0), (0, 0.018, 0), 'satin', p, segs=8, bevel=0.004)
    for k in range(4):
        a = k / 4 * TAU + math.pi / 4; cyl('rod_sock', 0.007, (0.085 * math.cos(a), -0.004, 0.085 * math.sin(a)), (0.1 * math.cos(a), -0.012, 0.1 * math.sin(a)), 'chrome', p, segs=10)

def softbox_shell(p, name, w, h, depth, ring=0.17):
    """fabric pulled over four rods: corners are the rods, the faces between them sag in a little"""
    yb, yf = -0.01, -depth
    corners_b = [Vector((sx * ring / 2, yb, sz * ring / 2)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    corners_f = [Vector((sx * w / 2, yf, sz * h / 2)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for i in range(4):
        b0, b1, f0, f1 = corners_b[i], corners_b[(i + 1) % 4], corners_f[i], corners_f[(i + 1) % 4]
        def fn(u, v, b0=b0, b1=b1, f0=f0, f1=f1):
            q = b0.lerp(b1, u).lerp(f0.lerp(f1, u), v)
            inward = -Vector((q.x, 0, q.z)).normalized() if (q.x or q.z) else Vector()
            return q + inward * 0.018 * math.sin(math.pi * u) * math.sin(math.pi * v)
        grid_surface(name + '_side', fn, 12, 10, 'fabric', p, thick=0.004)
        cyl(name + '_rod', 0.005, b0.lerp(f0, 0.03) * 1.0, f0 * 0.995 + Vector((0, 0.01, 0)), 'fabric', p, segs=10)   # the rod showing through the fabric
    # the front: a black lip, then the diffuser set back behind it
    lip = 0.022
    for (sx, sz, bw, bh) in ((0, 1, w, lip), (0, -1, w, lip), (1, 0, lip, h), (-1, 0, lip, h)):
        box(name + '_lip', (bw, 0.012, bh), (sx * (w - lip) / 2, yf - 0.002, sz * (h - lip) / 2), 'fabric', p, bevel=0.004)
    plane(name + '_face', w - lip * 2, h - lip * 2, yf + 0.03, 'emit', p, nx=10, nz=10, bow=-0.008)

# ---------------- the fixtures ----------------
def fixture(fid):
    f = empty('fx_' + fid); return f, empty(fid + '_head', f), empty(fid + '_yoke', f)

# Fresnel: finned body, stepped lens, four-leaf barn doors on a rotating ring, a yoke round it
f, h, y = fixture('fresnel')
lathe('fr_body', [(0.096, -0.12), (0.102, -0.11), (0.104, 0.06), (0.098, 0.1), (0.07, 0.125), (0.0, 0.13)], 'black', h, segs=64, axis=(0, 1, 0), thick=0)
for k in range(7): torus('fin', 0.104, 0.0055, (0, 0.07 - k * 0.022, 0), (0, 1, 0), 'black', h, rsegs=10)
for k in range(12):
    a = k / 12 * math.pi; box('top_vent', (0.004, 0.08, 0.01), (0.09 * math.cos(a), 0.06, 0.09 * math.sin(a) + 0.0), 'knob', h, rot=Matrix.Rotation(-a + math.pi / 2, 3, 'Y'), bevel=0.0015, segs=2)
torus('bezel', 0.1, 0.013, (0, -0.125, 0), (0, 1, 0), 'black', h)
torus('door_ring', 0.108, 0.008, (0, -0.142, 0), (0, 1, 0), 'satin', h)
disc('lens', 0.088, -0.131, 'emit', h)
for rr in (0.022, 0.038, 0.052, 0.065, 0.077): torus('lens_step', rr, 0.002, (0, -0.132, 0), (0, 1, 0), 'emit', h, segs=48, rsegs=6)
for side in ('t', 'b', 'l', 'r'):
    w, ln = (0.21, 0.135) if side in 'tb' else (0.15, 0.115)
    door = box('door_' + side, (w, ln, 0.0025), (0, -ln / 2, 0), 'satin', h, bevel=0.001, segs=2)
    cyl('hinge_' + side, 0.004, (-w / 2, 0, 0), (w / 2, 0, 0), 'satin', door, segs=12)
    sgn = 1 if side in 'tr' else -1
    if side in 'tb': door.rotation_euler = (math.radians(-30 * sgn), 0, 0); door.location = (0, -0.147, 0.112 * sgn)
    else: door.rotation_euler = (0, math.radians(90), math.radians(30 * sgn)); door.location = (0.112 * sgn, -0.147, 0)
knurl('focus_knob', 0.016, (0, 0.13, -0.05), (0, 0.15, -0.05), 'knob', h)
box('fr_handle', (0.016, 0.1, 0.014), (0, 0.02, 0.122), 'knob', h, bevel=0.006)
for yy in (-0.02, 0.06): cyl('fr_hpost', 0.005, (0, yy, 0.104), (0, yy, 0.118), 'knob', h, segs=12)
cyl('fr_cable', 0.006, (0.0, 0.13, -0.08), (0.0, 0.2, -0.25), 'rubber', h, segs=12)
for x in (-0.124, 0.124):
    box('yoke_arm', (0.012, 0.045, 0.2), (x, 0, -0.045), 'black', y, bevel=0.004)
    knurl('yoke_knob', 0.019, (x, 0, 0), (x * 1.16, 0, 0), 'knob', y)
box('yoke_bar', (0.26, 0.045, 0.014), (0, 0, -0.145), 'black', y, bevel=0.004)
cyl('yoke_sock', 0.017, (0, 0, -0.15), (0, 0, -0.19), 'black', y, segs=28, bevel=0.003)

# Speedlight on a cold-shoe umbrella bracket
f, h, y = fixture('speed')
box('flash_body', (0.072, 0.045, 0.1), (0, 0.012, -0.04), 'black', h, bevel=0.01)
box('flash_neck', (0.05, 0.035, 0.02), (0, 0.008, 0.016), 'black', h, bevel=0.006)
box('flash_head', (0.082, 0.062, 0.048), (0, -0.006, 0.048), 'black', h, bevel=0.009)
plane('flash_face', 0.068, 0.034, -0.0375, 'emit', h).location = (0, 0, 0.048)
box('af_panel', (0.04, 0.003, 0.018), (0, -0.0105, -0.02), 'red', h, bevel=0.002)
box('flash_lcd', (0.05, 0.002, 0.03), (0, 0.035, -0.035), 'screen', h, bevel=0.001, segs=1)
for x in (-0.02, 0.0, 0.02): cyl('fbutton', 0.004, (x, 0.035, -0.072), (x, 0.038, -0.072), 'knob', h, segs=12)
box('shoe', (0.03, 0.02, 0.012), (0, 0.012, -0.095), 'satin', h, bevel=0.002)
bracket(y, 0.1)

# Softbox 90 x 65 on a monolight
f, h, y = fixture('softbox')
monolight(h, 0.02); speedring(h, 0.9); softbox_shell(h, 'sb', 0.9, 0.65, 0.46)
bracket(y)

# Stripbox 30 x 110
f, h, y = fixture('strip')
monolight(h, 0.02); speedring(h, 0.3); softbox_shell(h, 'st', 0.3, 1.1, 0.32, ring=0.15)
bracket(y)

# Shoot-through umbrella: 16 panels that sag between their ribs
f, h, y = fixture('umbrella')
monolight(h, 0.02)
R, D, NR = 0.52, 0.2, 16
def canopy(u, v):
    a = u * TAU; r = R * v; ph = (u * NR) % 1.0
    sag = 0.016 * math.sin(math.pi * ph) * v ** 1.5
    return Vector((r * math.cos(a) * (1 - 0.02 * math.sin(math.pi * ph) * v), -(0.6 - D * v * v) + sag, r * math.sin(a) * (1 - 0.02 * math.sin(math.pi * ph) * v)))
grid_surface('canopy', canopy, NR * 6, 14, 'emit', h, thick=0.002, closed_u=True)
cyl('shaft', 0.004, (0, 0.32, 0), (0, -0.62, 0), 'chrome', h, segs=12)
cyl('shaft_grip', 0.008, (0, 0.3, 0), (0, 0.38, 0), 'rubber', h, segs=16, bevel=0.002)
cyl('crown', 0.012, (0, -0.585, 0), (0, -0.62, 0), 'black', h, segs=16, bevel=0.003)
for k in range(NR):
    u = k / NR; pts = [canopy(u, i / 10) + Vector((0, 0.016, 0)) for i in range(11)]   # ribs sit inside, on the strobe's side, clear of the fabric
    for i in range(10): cyl('rib', 0.003, pts[i] - (pts[i + 1] - pts[i]) * 0.08, pts[i + 1], 'black', h, segs=8)
    cyl('rib_tip', 0.004, pts[10], pts[10] + (pts[10] - pts[9]).normalized() * 0.018, 'black', h, segs=10, bevel=0.001)
bracket(y)

# 5-in-1 reflector on a holder arm (the face is "Surf"): a little ripple, a sprung rim
f, h, y = fixture('reflector')
grid_surface('refl_face', lambda u, v: Vector((0.39 * v * math.cos(u * TAU), 0.004 * math.sin(u * TAU * 5) * v * v + 0.002 * math.sin(u * TAU * 13 + 1) * v, 0.39 * v * math.sin(u * TAU))), 72, 12, 'surf', h, thick=0.002, closed_u=True)
torus('refl_rim', 0.394, 0.006, (0, 0, 0), (0, 1, 0), 'fabric', h, segs=72)
cyl('refl_arm', 0.008, (0, 0.025, -0.42), (0, 0.025, 0.42), 'alu', h, segs=16)
for zz in (-0.395, 0.395): box('refl_clip', (0.04, 0.03, 0.045), (0, 0.022, zz), 'black', h, bevel=0.005); knurl('refl_clipknob', 0.009, (0.02, 0.022, zz), (0.034, 0.022, zz), 'knob', h)
cyl('refl_sock', 0.017, (0, 0.03, -0.43), (0, 0.03, -0.47), 'black', y, segs=28, bevel=0.003)
box('refl_swivel', (0.04, 0.04, 0.04), (0, 0.03, -0.45), 'black', y, bevel=0.006)
cyl('refl_drop', 0.0085, (0, 0.03, -0.47), (0, 0.03, -0.53), 'alu', y, segs=16)

# Bare bulb in a clamp socket
f, h, y = fixture('bare')
bulb_prof = [(0.04 * math.sin(math.pi * k / 16), -0.045 - 0.035 * math.cos(math.pi * k / 16)) for k in range(0, 12)] + [(0.04 * math.sin(math.pi * 11 / 16) * (1 - u / 6), -0.045 - 0.035 * math.cos(math.pi * 11 / 16) + 0.006 * u) for u in range(1, 7)]
lathe('bulb', [(0.0, -0.08)] + bulb_prof[1:], 'emit', h, segs=48, axis=(0, 0, 1), thick=0)
for k in range(4): torus('thread', 0.0145, 0.0018, (0, 0, 0.002 + k * 0.004), (0, 0, 1), 'chrome', h, segs=28, rsegs=6)
cyl('socket', 0.02, (0, 0, 0.016), (0, 0, 0.075), 'black', h, segs=32, bevel=0.003)
cyl('socket_ring', 0.023, (0, 0, 0.014), (0, 0, 0.024), 'brass', h, segs=32, bevel=0.001)
box('clamp', (0.03, 0.03, 0.05), (0, 0, 0.1), 'black', y, bevel=0.005)
cyl('clamp_sock', 0.017, (0, 0, 0.075), (0, 0, 0.06), 'black', y, segs=24)

# Streetlight: a post-top lantern (the origin is the lamp)
f, h, y = fixture('sodium')
cyl('lamp_glass', 0.13, (0, 0, -0.12), (0, 0, 0.1), 'emit', h, segs=8, r2=0.16)
cyl('lamp_hat', 0.2, (0, 0, 0.1), (0, 0, 0.24), 'green', h, segs=8, r2=0.02, bevel=0.005)
cyl('lamp_finial', 0.012, (0, 0, 0.24), (0, 0, 0.29), 'green', h, segs=12, r2=0.004)
cyl('lamp_base', 0.13, (0, 0, -0.16), (0, 0, -0.12), 'green', h, segs=8, bevel=0.004)
for k in range(8):
    a = (k + 0.5) / 8 * TAU; cyl('lamp_bar', 0.006, (0.135 * math.cos(a), 0.135 * math.sin(a), -0.12), (0.165 * math.cos(a), 0.165 * math.sin(a), 0.1), 'green', h, segs=8)
cyl('lamp_neck', 0.05, (0, 0, -0.3), (0, 0, -0.16), 'green', y, segs=24, r2=0.07)

# RGB tube on a clamp (the origin is the middle of the tube)
f, h, y = fixture('rgb')
cyl('tube', 0.018, (0, 0, -0.5), (0, 0, 0.5), 'emit', h, segs=28)
for zz in (-0.52, 0.52): cyl('tube_cap', 0.021, (0, 0, zz - 0.025), (0, 0, zz + 0.025), 'black', h, segs=28, bevel=0.005)
box('tube_controls', (0.03, 0.012, 0.05), (0, 0.02, -0.5), 'black', h, bevel=0.003)
box('tube_clamp', (0.05, 0.03, 0.045), (0, 0.035, 0), 'black', y, bevel=0.005)
knurl('tube_knob', 0.01, (0.025, 0.035, 0), (0.04, 0.035, 0), 'knob', y)
cyl('tube_arm', 0.0085, (0, 0.045, 0), (0, 0.045, -0.06), 'alu', y, segs=16)

# ---------------- export ----------------
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True, export_texcoords=False,
                          export_normals=True, export_materials='EXPORT', export_extras=False, export_cameras=False, export_lights=False,
                          export_draco_mesh_compression_enable=False)
print('kit written', OUT)
