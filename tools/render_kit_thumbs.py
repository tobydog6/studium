# Product shots of the lighting kit for the Lighting panel's kit strip: one transparent WEBP per fixture.
#   bl/bin/python tools/render_kit_thumbs.py assets/kit/lightkit.glb assets/kit/thumbs
import bpy, sys, math, os
from mathutils import Vector

GLB, OUT = sys.argv[-2], sys.argv[-1]
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
S = bpy.context.scene
S.render.engine = 'CYCLES'; S.cycles.samples = 64; S.cycles.use_denoising = True; S.render.film_transparent = True
S.render.resolution_x = S.render.resolution_y = 320
S.render.image_settings.file_format = 'PNG'; S.render.image_settings.color_mode = 'RGBA'
S.view_settings.view_transform = 'AgX'; S.view_settings.look = 'AgX - Medium High Contrast'
w = bpy.data.worlds.new('w'); S.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.5, 0.5, 0.52, 1); bg.inputs[1].default_value = 0.18

def light(name, kind, loc, energy, size, look=Vector((0, 0, 0))):
    L = bpy.data.lights.new(name, kind); L.energy = energy
    if kind == 'AREA': L.size = size
    o = bpy.data.objects.new(name, L); S.collection.objects.link(o); o.location = loc
    o.rotation_euler = (look - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); return o
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); S.collection.objects.link(cam); S.camera = cam; cam.data.lens = 70
key = light('key', 'AREA', (-2.5, -3, 2.5), 160, 2.5); rim = light('rim', 'AREA', (2.5, 2.5, 2), 140, 1.5); fill = light('fill', 'AREA', (3, -2, 0.3), 30, 3)

tops = [o for o in S.objects if o.parent is None and (o.name.startswith('fx_') or o.name == 'stand')]
def show(o, on):
    o.hide_render = not on
    for c in o.children_recursive: c.hide_render = not on
for o in tops:
    if not o.name.startswith('fx_'): show(o, False); continue
for o in [t for t in tops if t.name.startswith('fx_')]:
    for t in tops: show(t, False)
    show(o, True); o.location = (0, 0, 0)
    pts = [c.matrix_world @ Vector(v) for c in o.children_recursive if c.type == 'MESH' for v in c.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (mn + mx) / 2; r = (mx - mn).length / 2
    d = Vector((-0.9, -1.6, 0.55)).normalized(); cam.location = c + d * r * 4.4
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    for L in (key, rim, fill): L.location = c + (L.location - c).normalized() * max(2.5, r * 6); L.rotation_euler = (c - L.location).to_track_quat('-Z', 'Y').to_euler()
    S.render.filepath = os.path.join(OUT, o.name[3:] + '.png'); bpy.ops.render.render(write_still=True)
print('thumbs written', OUT)
