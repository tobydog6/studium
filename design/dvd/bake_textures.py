import bpy, sys, os
OUT = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 4
def plane(w, h):
    bpy.ops.mesh.primitive_plane_add(size=1); o = bpy.context.active_object; o.scale = (w, h, 1); return o
def mat_for(o, build):
    m = bpy.data.materials.new('m'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(bsdf.outputs[0], out.inputs[0])
    tc = nt.nodes.new('ShaderNodeTexCoord'); build(nt, bsdf, tc)
    o.data.materials.append(m); return m, nt
def bake(o, m, nt, name, kind, W, H):
    img = bpy.data.images.new(name, W, H, float_buffer=False)
    if kind != 'DIFFUSE_C': img.colorspace_settings.name = 'Non-Color'
    n = nt.nodes.new('ShaderNodeTexImage'); n.image = img; nt.nodes.active = n
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    if kind == 'DIFFUSE_C':
        sc.render.bake.use_pass_direct = False; sc.render.bake.use_pass_indirect = False; sc.render.bake.use_pass_color = True
        bpy.ops.object.bake(type='DIFFUSE')
    elif kind == 'NORMAL': bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT')
    else: bpy.ops.object.bake(type='ROUGHNESS')
    img.filepath_raw = os.path.join(OUT, name + '.png'); img.file_format = 'PNG'; img.save()
    nt.nodes.remove(n)

def L(nt, a, b, i=0): nt.links.new(a, b)
# ---- oak: long grain bands, warped, with pores ----
def oak(nt, bsdf, tc):
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1, 14, 1); L(nt, tc.outputs['UV'], mp.inputs[0])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3; nz.inputs['Detail'].default_value = 8; L(nt, mp.outputs[0], nz.inputs[0])
    wv = nt.nodes.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Y'; wv.inputs['Scale'].default_value = 2.2; wv.inputs['Distortion'].default_value = 9; wv.inputs['Detail'].default_value = 6; wv.inputs['Detail Roughness'].default_value = .7
    L(nt, mp.outputs[0], wv.inputs[0])
    pm = nt.nodes.new('ShaderNodeMapping'); pm.inputs['Scale'].default_value = (40, 900, 1); L(nt, tc.outputs['UV'], pm.inputs[0])
    pore = nt.nodes.new('ShaderNodeTexNoise'); pore.inputs['Scale'].default_value = 1.4; pore.inputs['Detail'].default_value = 2; L(nt, pm.outputs[0], pore.inputs[0])
    pr = nt.nodes.new('ShaderNodeValToRGB'); pr.color_ramp.elements[0].position = .55; pr.color_ramp.elements[1].position = .72; L(nt, pore.outputs[0], pr.inputs[0])
    mix = nt.nodes.new('ShaderNodeMath'); mix.operation = 'MULTIPLY_ADD'; mix.inputs[1].default_value = .6; L(nt, wv.outputs['Fac'], mix.inputs[0]); L(nt, nz.outputs['Fac'], mix.inputs[2])
    cr = nt.nodes.new('ShaderNodeValToRGB'); e = cr.color_ramp.elements; e[0].position = .25; e[0].color = (.09, .05, .025, 1); e[1].position = 1; e[1].color = (.33, .2, .11, 1); L(nt, mix.outputs[0], cr.inputs[0])
    dark = nt.nodes.new('ShaderNodeMix'); dark.data_type = 'RGBA'; dark.blend_type = 'MULTIPLY'; dark.inputs[0].default_value = .5
    L(nt, pr.outputs[0], dark.inputs[0]); L(nt, cr.outputs[0], dark.inputs[6]); dark.inputs[7].default_value = (.35, .3, .26, 1)
    L(nt, dark.outputs[2], bsdf.inputs['Base Color'])
    rr = nt.nodes.new('ShaderNodeMapRange'); rr.inputs[3].default_value = .32; rr.inputs[4].default_value = .62; L(nt, mix.outputs[0], rr.inputs[0]); L(nt, rr.outputs[0], bsdf.inputs['Roughness'])
    bm = nt.nodes.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = .5; bm.inputs['Distance'].default_value = .002
    h = nt.nodes.new('ShaderNodeMath'); h.operation = 'SUBTRACT'; L(nt, wv.outputs['Fac'], h.inputs[0]); L(nt, pr.outputs[0], h.inputs[1])
    L(nt, h.outputs[0], bm.inputs['Height']); L(nt, bm.outputs[0], bsdf.inputs['Normal'])
o = plane(4, 1); m, nt = mat_for(o, oak)
for nm, k in [('oak_col', 'DIFFUSE_C'), ('oak_rough', 'ROUGHNESS'), ('oak_nrm', 'NORMAL')]: bake(o, m, nt, nm, k, 2048, 512)
bpy.data.objects.remove(o)
# ---- plaster: soft lumps and fine grit ----
def plaster(nt, bsdf, tc):
    big = nt.nodes.new('ShaderNodeTexNoise'); big.inputs['Scale'].default_value = 4; big.inputs['Detail'].default_value = 10; big.inputs['Roughness'].default_value = .62; L(nt, tc.outputs['UV'], big.inputs[0])
    fine = nt.nodes.new('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value = 160; fine.inputs['Detail'].default_value = 4; L(nt, tc.outputs['UV'], fine.inputs[0])
    vo = nt.nodes.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 9; L(nt, tc.outputs['UV'], vo.inputs[0])
    cr = nt.nodes.new('ShaderNodeValToRGB'); e = cr.color_ramp.elements; e[0].position = .35; e[0].color = (.11, .095, .08, 1); e[1].position = .7; e[1].color = (.17, .15, .125, 1); L(nt, big.outputs['Fac'], cr.inputs[0])
    L(nt, cr.outputs[0], bsdf.inputs['Base Color'])
    rr = nt.nodes.new('ShaderNodeMapRange'); rr.inputs[3].default_value = .75; rr.inputs[4].default_value = .97; L(nt, fine.outputs['Fac'], rr.inputs[0]); L(nt, rr.outputs[0], bsdf.inputs['Roughness'])
    h = nt.nodes.new('ShaderNodeMath'); h.operation = 'MULTIPLY_ADD'; h.inputs[1].default_value = .35; L(nt, fine.outputs['Fac'], h.inputs[0])
    h2 = nt.nodes.new('ShaderNodeMath'); h2.operation = 'MULTIPLY_ADD'; h2.inputs[1].default_value = .5; L(nt, vo.outputs['Distance'], h2.inputs[0]); L(nt, big.outputs['Fac'], h2.inputs[2])
    L(nt, h2.outputs[0], h.inputs[2])
    bm = nt.nodes.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = .35; L(nt, h.outputs[0], bm.inputs['Height']); L(nt, bm.outputs[0], bsdf.inputs['Normal'])
o = plane(2, 2); m, nt = mat_for(o, plaster)
for nm, k in [('wall_col', 'DIFFUSE_C'), ('wall_nrm', 'NORMAL')]: bake(o, m, nt, nm, k, 1024, 1024)
bpy.data.objects.remove(o)
# ---- sleeve wear: smudges and hairline scuffs, as roughness ----
def wear(nt, bsdf, tc):
    sm = nt.nodes.new('ShaderNodeTexNoise'); sm.inputs['Scale'].default_value = 3; sm.inputs['Detail'].default_value = 6; L(nt, tc.outputs['UV'], sm.inputs[0])
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1, 60, 1); mp.inputs['Rotation'].default_value = (0, 0, .5); L(nt, tc.outputs['UV'], mp.inputs[0])
    sc_ = nt.nodes.new('ShaderNodeTexNoise'); sc_.inputs['Scale'].default_value = 6; sc_.inputs['Detail'].default_value = 3; L(nt, mp.outputs[0], sc_.inputs[0])
    sr = nt.nodes.new('ShaderNodeValToRGB'); sr.color_ramp.elements[0].position = .62; sr.color_ramp.elements[1].position = .66; L(nt, sc_.outputs['Fac'], sr.inputs[0])
    r1 = nt.nodes.new('ShaderNodeMapRange'); r1.inputs[1].default_value = .4; r1.inputs[2].default_value = .7; r1.inputs[3].default_value = .05; r1.inputs[4].default_value = .3; L(nt, sm.outputs['Fac'], r1.inputs[0])
    add = nt.nodes.new('ShaderNodeMath'); add.operation = 'MULTIPLY_ADD'; add.inputs[1].default_value = .35; add.use_clamp = True; L(nt, sr.outputs[0], add.inputs[0]); L(nt, r1.outputs[0], add.inputs[2])
    L(nt, add.outputs[0], bsdf.inputs['Roughness'])
o = plane(1, 1.4); m, nt = mat_for(o, wear)
bake(o, m, nt, 'sleeve_rough', 'ROUGHNESS', 1024, 1024)
print('done')
