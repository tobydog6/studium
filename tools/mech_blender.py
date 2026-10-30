# The mech for the dark side's computer (src/lighttable/secret/rig.js), modelled in Blender from code.
# Sam: a sleek, modern, dark Gundam to match the PC; less blocky, high fidelity. Our own design.
# Run:  <venv>/bin/python tools/mech_blender.py   (pip install bpy into a Python 3.13 venv first)
# Out:  src/lighttable/secret/mech.glb  — one mesh per joint, named v_<joint>, each modelled in its joint's own
#       space (the joint at the origin, three.js axes: y up, the robot facing +z), so rigmodel.js hangs each one on
#       the matching joint group and rig.js animates the joints exactly as before.
# Materials by name, which rigmodel.js swaps for its own: armor (gunmetal), armor2 (darker plates), frame (inner
# black frame), metal (pistons, bright metal), glow (cyan light lines), visor, red (sensors).
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix, Euler

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'lighttable', 'secret', 'mech.glb')
TW, TH, TD, WW, L1, L2 = 2.6, 3.3, 0.62, 2.5, 1.4, 1.5   # must match MECH in rigmodel.js

bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}
def mat(name, rgb, metal=0.5, rough=0.4, emit=None):
    m = bpy.data.materials.new(name); b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = 2.0
    MATS[name] = m; return m
mat('armor', (0.10, 0.11, 0.13), 0.6, 0.32); mat('armor2', (0.05, 0.055, 0.065), 0.5, 0.4); mat('frame', (0.02, 0.02, 0.025), 0.7, 0.45)
mat('metal', (0.6, 0.62, 0.66), 1.0, 0.2); mat('glow', (0.2, 0.8, 1.0), 0, 0.5, (0.3, 0.85, 1.0)); mat('visor', (0.3, 0.9, 1.0), 0, 0.3, (0.4, 0.9, 1.0)); mat('red', (1, 0.15, 0.1), 0, 0.3, (1, 0.2, 0.1))
ORDER = ['armor', 'armor2', 'frame', 'metal', 'glow', 'visor', 'red']

PARTS = {}
def three_to_bl(v): return Vector((v[0], -v[2], v[1]))
def xf(pos=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    """a transform in three.js axes: scale, then rotate (XYZ), then move"""
    R = Euler(rot, 'XYZ').to_matrix().to_4x4(); S = Matrix.Diagonal((*scale, 1)); return Matrix.Translation(pos) @ R @ S
def emit(part, bm, matname, M, bevel=0.022, seg=3):
    """bake bm (built in three.js axes) through M into a new object on the part, bevelled with crisp normals"""
    for v in bm.verts: v.co = three_to_bl(M @ v.co)
    me = bpy.data.meshes.new(part); bm.normal_update(); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(part, me); bpy.context.collection.objects.link(ob)
    for n in ORDER: ob.data.materials.append(MATS[n])
    idx = ORDER.index(matname)
    for p in ob.data.polygons: p.material_index = idx
    if bevel > 0:
        b = ob.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = seg; b.limit_method = 'ANGLE'; b.angle_limit = math.radians(35); b.harden_normals = True
    w = ob.modifiers.new('wn', 'WEIGHTED_NORMAL'); w.keep_sharp = True
    for p in ob.data.polygons: p.use_smooth = True
    PARTS.setdefault(part, []).append(ob); return ob

def box(part, w, h, d, matname, pos=(0, 0, 0), rot=(0, 0, 0), bevel=0.03, taper=None, seg=3):
    """a bevelled box; taper=(tx, tz) narrows the top (y+) face in x and z"""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        x, y, z = v.co.x * w, v.co.y * h, v.co.z * d
        if taper and v.co.y > 0: x *= taper[0]; z *= taper[1]
        v.co = Vector((x, y, z))
    return emit(part, bm, matname, xf(pos, rot), bevel, seg)

def plate(part, pts, d, matname, pos=(0, 0, 0), rot=(0, 0, 0), inset=0.05, raise_=0.035, groove=True, bevel=0.018, scale=(1, 1, 1)):
    """an armour plate: a 2D outline (x, y) extruded back by d (its face looks down +z); the face is inset into a
    raised panel with a groove round it, the way Gunpla armour is cut"""
    bm = bmesh.new(); vs = [bm.verts.new((x, y, 0)) for x, y in pts]; f = bm.faces.new(vs)
    if f.normal.z < 0: f.normal_flip()
    r = bmesh.ops.extrude_face_region(bm, geom=[f]); ex = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    for v in ex: v.co.z -= d
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    front = [g for g in bm.faces if g.normal.z > 0.9 and abs(sum(v.co.z for v in g.verts) / len(g.verts)) < 1e-4]
    if front and inset > 0:
        if groove:
            r1 = bmesh.ops.inset_region(bm, faces=front, thickness=inset, depth=-0.012)
            r2 = bmesh.ops.inset_region(bm, faces=front, thickness=0.012, depth=0.012 + raise_)
        else:
            bmesh.ops.inset_region(bm, faces=front, thickness=inset, depth=raise_)
    return emit(part, bm, matname, xf(pos, rot, scale), bevel, 2)

def cyl(part, r, h, matname, pos=(0, 0, 0), rot=(0, 0, 0), n=24, r2=None, bevel=0.012):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=n, radius1=r, radius2=r if r2 is None else r2, depth=h)
    for v in bm.verts: v.co = Vector((v.co.x, v.co.z, v.co.y))   # its axis along y
    return emit(part, bm, matname, xf(pos, rot), bevel, 2)

def vents(part, w, h, n, pos, rot=(0, 0, 0), matname='frame', depth=0.06):
    """a recessed vent: a dark frame with n slats across it"""
    box(part, w, h, depth, 'frame', pos, rot, 0.01)
    M = xf(pos, rot)
    for i in range(n):
        y = -h / 2 + (i + 0.5) * h / n
        p = M @ Vector((0, y, depth / 2 + 0.005))
        box(part, w * 0.86, h / n * 0.42, 0.03, 'armor2', tuple(p), (rot[0] - 0.5, rot[1], rot[2]), 0.006, seg=1)

def strip(part, w, h, pos, rot=(0, 0, 0)):   # a light line
    return box(part, w, h, 0.02, 'glow', pos, rot, 0.004, seg=1)

mirror = lambda pts: [(-x, y) for x, y in reversed(pts)]

# ---------------- pelvis ----------------
P = 'v_pelvis'
box(P, 1.5, 0.48, 0.86, 'frame', (0, 0, 0), bevel=0.06)
cyl(P, 0.38, 0.2, 'armor2', (0, 0.3, 0), n=8)
plate(P, [(-0.28, 0.3), (0.28, 0.3), (0.22, -0.2), (0, -0.42), (-0.22, -0.2)], 0.16, 'armor', (0, -0.05, 0.5))
strip(P, 0.04, 0.3, (0, -0.06, 0.6))
for s in (-1, 1):
    pts = [(-0.3, 0.32), (0.3, 0.32), (0.26, -0.4), (-0.18, -0.46)]
    plate(P, pts if s < 0 else mirror(pts), 0.1, 'armor', (s * 0.48, -0.28, 0.5), (-0.16, 0, 0))
    plate(P, [(-0.42, 0.3), (0.42, 0.3), (0.36, -0.38), (-0.36, -0.44)], 0.09, 'armor', (s * 0.86, -0.24, 0), (0, s * math.pi / 2, s * 0.1))
    strip(P, 0.02, 0.36, (s * 0.92, -0.25, 0.0), (0, s * math.pi / 2, 0))
plate(P, [(-0.7, 0.25), (0.7, 0.25), (0.6, -0.4), (-0.6, -0.4)], 0.1, 'armor', (0, -0.2, -0.48), (0.12, math.pi, 0))

# ---------------- legs ----------------
for s, n in ((-1, 'L'), (1, 'R')):
    H = 'v_hip' + n
    cyl(H, 0.26, 0.46, 'frame', (0, 0, 0), (0, 0, math.pi / 2))
    box(H, 0.46, 1.3, 0.5, 'frame', (0, -0.7, 0), bevel=0.05)
    for k in range(3): cyl(H, 0.035, 0.9, 'metal', (s * 0.12 * (k - 1), -0.7, -0.27), n=8)
    plate(H, [(-0.36, 0.42), (0.36, 0.42), (0.32, -0.5), (0, -0.62), (-0.32, -0.5)], 0.32, 'armor', (0, -0.55, 0.36))
    plate(H, [(-0.3, 0.4), (0.3, 0.4), (0.26, -0.45), (-0.26, -0.45)], 0.12, 'armor2', (s * 0.33, -0.68, 0.0), (0, s * math.pi / 2, 0))
    strip(H, 0.03, 0.5, (0, -0.42, 0.42))
    K = 'v_knee' + n
    cyl(K, 0.24, 0.56, 'frame', (0, 0, 0), (0, 0, math.pi / 2))
    plate(K, [(-0.3, 0.26), (0.3, 0.26), (0.22, -0.18), (0, -0.34), (-0.22, -0.18)], 0.2, 'armor', (0, 0.02, 0.42), (0.25, 0, 0))
    cyl(K, 0.05, 0.05, 'red', (0, 0.05, 0.6), (math.pi / 2, 0, 0), n=12)
    box(K, 0.58, 1.38, 0.66, 'frame', (0, -0.78, -0.02), bevel=0.05)
    plate(K, [(-0.42, 0.6), (0.42, 0.6), (0.38, -0.55), (0.2, -0.7), (-0.2, -0.7), (-0.38, -0.55)], 0.3, 'armor', (0, -0.82, 0.36))
    for sx in (-1, 1): plate(K, [(-0.5, 0.55), (0.5, 0.55), (0.42, -0.6), (-0.46, -0.66)], 0.1, 'armor', (sx * 0.38, -0.82, -0.02), (0, sx * math.pi / 2, 0))
    strip(K, 0.36, 0.025, (0, -0.42, 0.53)); strip(K, 0.025, 0.5, (s * 0.2, -0.95, 0.53))
    box(K, 0.62, 0.86, 0.34, 'armor2', (0, -0.62, -0.5), bevel=0.04, taper=(0.85, 0.7))
    for k in range(3): box(K, 0.06, 0.7, 0.24, 'frame', ((k - 1) * 0.18, -0.64, -0.7), bevel=0.012)
    cyl(K, 0.13, 0.12, 'glow', (0, -1.06, -0.62), (0.4, 0, 0), n=16)
    A = 'v_ankle' + n
    cyl(A, 0.2, 0.46, 'frame', (0, 0, 0), (0, 0, math.pi / 2))
    # the foot: a pointed sabaton seen from the side, extruded across its width
    side = [(-0.55, 0.06), (-0.4, 0.2), (0.25, 0.14), (0.85, -0.12), (0.92, -0.3), (-0.6, -0.3)]
    pr = plate(A, side, 0.82, 'armor', (0.41, -0.06, 0.2), (0, -math.pi / 2, 0), inset=0.04, raise_=0.02)
    box(A, 0.86, 0.06, 1.55, 'frame', (0, -0.35, 0.18), bevel=0.02)
    plate(A, [(-0.3, 0.12), (0.3, 0.12), (0.18, -0.12), (-0.18, -0.12)], 0.08, 'armor2', (0, -0.08, 0.86), (-0.9, 0, 0))
    box(A, 0.4, 0.18, 0.3, 'armor2', (0, -0.22, -0.45), bevel=0.03)

# ---------------- spine ----------------
S_ = 'v_spine'
box(S_, 0.72, 2.0, 0.44, 'frame', (0, 0.2, -0.08), bevel=0.05)
for s in (-1, 1): cyl(S_, 0.06, 1.8, 'metal', (s * 0.22, 0.2, 0.17), n=12); cyl(S_, 0.09, 0.3, 'frame', (s * 0.22, -0.6, 0.17), n=12)
for k in range(5): box(S_, 0.6, 0.06, 0.06, 'armor2', (0, -0.55 + k * 0.32, 0.17), bevel=0.01)

# ---------------- torso: the robot's back (the backpack); the front is the screen, built in rigmodel.js ----------------
B = 'v_torso'
plate(B, [(-1.1, 1.5), (1.1, 1.5), (1.2, 0.4), (0.9, -1.4), (-0.9, -1.4), (-1.2, 0.4)], 0.18, 'armor', (0, 0, -TD / 2 - 0.02), (0, math.pi, 0))
for s in (-1, 1):
    cyl(B, 0.26, 0.55, 'armor2', (s * 0.58, 0.55, -TD / 2 - 0.42), (math.pi / 2, 0, 0), n=20, r2=0.2)
    cyl(B, 0.18, 0.08, 'glow', (s * 0.58, 0.55, -TD / 2 - 0.7), (math.pi / 2, 0, 0), n=20)
    plate(B, [(-0.12, 1.2), (0.12, 1.2), (0.08, -0.9), (-0.08, -0.9)], 0.5, 'armor2', (s * 1.0, 0.3, -TD / 2 - 0.18), (0, math.pi, s * 0.12), inset=0.02)
vents(B, 1.0, 0.5, 5, (0, -0.65, -TD / 2 - 0.22), (0, math.pi, 0))

# ---------------- wings: their backs are the chest while it is a robot (the right one is on top) ----------------
for s, n in ((-1, 'L'), (1, 'R')):
    W = 'v_wing' + n; cx = s * WW / 2; z0 = -0.17
    # face down -z: build facing +z and turn round
    R = (0, math.pi, 0)
    plate(W, [(-1.18, 1.6), (1.18, 1.6), (1.18, -1.6), (-1.18, -1.6)], 0.08, 'armor2', (cx, 0, z0), R, inset=0.06, raise_=0.01)
    # the upper chest: a broad angular plate, a raised collar, intakes either side of the core
    plate(W, [(-1.05, 1.45), (1.05, 1.45), (1.12, 0.6), (0.7, 0.05), (-0.7, 0.05), (-1.12, 0.6)], 0.12, 'armor', (cx, 0, z0 - 0.08), R)
    for sx in (-1, 1): vents(W, 0.5, 0.42, 4, (cx + sx * 0.62, 0.62, z0 - 0.22), (0, math.pi, -sx * 0.18))
    plate(W, [(0, 0.34), (0.26, 0.0), (0, -0.34), (-0.26, 0.0)], 0.1, 'armor2', (cx, 0.62, z0 - 0.2), R, inset=0.04)
    cyl(W, 0.11, 0.06, 'glow', (cx, 0.62, z0 - 0.33), (math.pi / 2, 0, 0), n=6)
    # the abdomen: three chevron plates, a light line down the middle
    for k in range(3):
        y = -0.3 - k * 0.42
        plate(W, [(-0.62 + k * 0.06, 0.15), (0, 0.04), (0.62 - k * 0.06, 0.15), (0.56 - k * 0.06, -0.17), (0, -0.28), (-0.56 + k * 0.06, -0.17)], 0.1, 'armor', (cx, y, z0 - 0.1), R, inset=0.03)
    strip(W, 0.02, 1.2, (cx, -0.75, z0 - 0.21), R)
    for sx in (-1, 1): strip(W, 0.025, 2.6, (cx + sx * 1.1, 0, z0 - 0.15), R); plate(W, [(-0.14, 1.3), (0.14, 1.3), (0.14, -1.5), (-0.14, -1.3)], 0.08, 'armor2', (cx + sx * 1.0, -0.1, z0 - 0.1), R, inset=0.02)

# ---------------- shoulders and arms ----------------
for s, n in ((-1, 'L'), (1, 'R')):
    D = 'v_pad' + n   # the pauldron
    shield = [(-0.62, 0.55), (0.5, 0.62), (0.66, 0.1), (0.5, -0.5), (-0.1, -0.68), (-0.6, -0.3)]
    plate(D, shield if s > 0 else mirror(shield), 0.95, 'armor', (s * 0.12, 0.2, 0.48), scale=(1, 1, 1))
    plate(D, [(-0.5, 0.2), (0.5, 0.2), (0.44, -0.2), (-0.44, -0.2)], 0.9, 'armor2', (s * 0.12, 0.66, 0.45), (-0.35, 0, 0), inset=0.03)
    strip(D, 0.6, 0.025, (s * 0.12, 0.1, 0.52)); vents(D, 0.32, 0.3, 3, (s * 0.62, 0.15, 0), (0, s * math.pi / 2, 0))
    cyl('v_mount' + n, 0.3, 0.56, 'frame', (0, -0.12, 0), (0, 0, math.pi / 2))
    U = 'v_arm' + n
    cyl(U, 0.24, 1.15, 'frame', (0, -0.62, 0), n=12)
    plate(U, [(-0.28, 0.5), (0.28, 0.5), (0.24, -0.45), (-0.24, -0.45)], 0.5, 'armor', (0, -0.6, 0.27))
    strip(U, 0.02, 0.6, (s * 0.25, -0.62, 0.15), (0, s * 0.6, 0))
    E_ = 'v_elbow' + n
    cyl(E_, 0.22, 0.5, 'frame', (0, 0, 0), (0, 0, math.pi / 2))
    box(E_, 0.6, 1.1, 0.64, 'armor', (0, -0.68, 0.02), bevel=0.06, taper=(1.12, 1.1))
    plate(E_, [(-0.32, 0.5), (0.32, 0.5), (0.3, -0.45), (0, -0.55), (-0.3, -0.45)], 0.08, 'armor2', (0, -0.65, 0.36), inset=0.03)
    plate(E_, [(-0.3, 0.45), (0.3, 0.45), (0.2, -0.5), (-0.2, -0.5)], 0.08, 'armor2', (s * 0.33, -0.68, 0.02), (0, s * math.pi / 2, 0), inset=0.03)
    strip(E_, 0.02, 0.7, (s * 0.36, -0.7, 0.2), (0, s * 0.9, 0))
    box(E_, 0.42, 0.22, 0.42, 'frame', (0, -1.32, 0), bevel=0.04)
    box(E_, 0.46, 0.4, 0.5, 'armor2', (0, -1.62, 0.02), bevel=0.06)   # the fist
    for k in range(4): box(E_, 0.1, 0.18, 0.14, 'frame', (-0.16 + k * 0.105, -1.74, 0.24), bevel=0.02)
    box(E_, 0.12, 0.22, 0.14, 'frame', (-s * 0.25, -1.56, 0.16), (0, 0, -s * 0.4), bevel=0.02)

# ---------------- head ----------------
Hd = 'v_head'
cyl(Hd, 0.2, 0.36, 'frame', (0, 0.12, 0), n=12)
box(Hd, 0.68, 0.6, 0.72, 'armor', (0, 0.5, -0.02), bevel=0.07, taper=(0.82, 0.86))
plate(Hd, [(-0.3, 0.12), (0.3, 0.12), (0.22, -0.18), (0, -0.28), (-0.22, -0.18)], 0.2, 'armor2', (0, 0.32, 0.36), inset=0.02)   # the faceplate
box(Hd, 0.5, 0.07, 0.06, 'visor', (0, 0.56, 0.36), bevel=0.01)
for sx in (-1, 1):
    box(Hd, 0.1, 0.06, 0.06, 'visor', (sx * 0.17, 0.585, 0.37), (0, 0, sx * 0.25), bevel=0.01)
    plate(Hd, [(-0.06, 0.2), (0.06, 0.2), (0.03, -0.28), (-0.03, -0.24)], 0.4, 'armor2', (sx * 0.38, 0.45, 0.1), (0, sx * math.pi / 2, 0), inset=0.02)
    # the crest: a swept V, long blades with a light edge
    blade = [(0.0, 0.05), (0.05, 0.0), (0.66, 0.42), (0.6, 0.47)]
    plate(Hd, blade if sx > 0 else mirror(blade), 0.04, 'metal', (0, 0.78, 0.4), (0.15, 0, 0), inset=0, bevel=0.006)
    cyl(Hd, 0.025, 0.42, 'frame', (sx * 0.28, 0.98, -0.25), (-0.3, 0, -sx * 0.2), n=8)
plate(Hd, [(-0.08, 0.1), (0.08, 0.1), (0, -0.1)], 0.06, 'red', (0, 0.82, 0.42), inset=0, bevel=0.006)
box(Hd, 0.5, 0.12, 0.4, 'armor2', (0, 0.83, -0.1), bevel=0.04)

# ---------------- join each joint's pieces, apply, export ----------------
bpy.ops.object.select_all(action='DESELECT')
for name, obs in PARTS.items():
    for ob in obs:
        bpy.context.view_layer.objects.active = ob
        for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs: ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1: bpy.ops.object.join()
    obs[0].name = name; obs[0].data.name = name
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_materials='EXPORT', export_normals=True, export_yup=True)
print('mech:', len(PARTS), 'parts,', tris, 'triangles ->', OUT, os.path.getsize(OUT) // 1024, 'KB')
