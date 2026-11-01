# tools/weapons-blender.py — armas e acessórios do "Ultimate Gun Pack" (Quaternius, CC0) → GLB do jogo + ícone.
# Chamado por tools/import-weapons.mjs (que monta a lista e grava o catálogo). Para cada item:
#  - arma: cano em +Z do glTF, Y p/ cima, origem na empunhadura (onde fica a mão direita), escala real da categoria;
#    nós vazios "muzzle" (boca do cano), "rail" (trilho em cima, p/ mira), "under" (embaixo do cano, p/ lanterna/empunhadura);
#  - acessório: origem no ponto de encaixe (boca do silenciador, base da mira...), unidades do pack (o jogo usa a escala
#    da arma em que for montado);
#  - ícone: perfil da arma, fundo transparente, luz de estúdio e contorno (Freestyle), PNG.
# Uso: blender -b --factory-startup -P tools/weapons-blender.py -- lista.json saida_dir
import bpy, json, sys, os, math
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
items = json.load(open(args[0])); OUT = args[1]
report = []

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def load(path):
    bpy.ops.import_scene.fbx(filepath=path)
    ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in ms: o.select_set(True)
    bpy.context.view_layer.objects.active = ms[0]
    if len(ms) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.context.scene.objects):
        if o is not ob: bpy.data.objects.remove(o, do_unlink=True)
    return ob

def bbox(ob):
    vs = [v.co for v in ob.data.vertices]
    return Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))), Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))

def xform(ob, m):
    ob.data.transform(m); ob.data.update()

def empty(name, p):
    e = bpy.data.objects.new(name, None); e.location = p; bpy.context.scene.collection.objects.link(e); return e

def materials(ob):
    # cores do pack, um pouco mais "de produto": metal acetinado, polímero fosco, madeira
    for s in ob.material_slots:
        m = s.material
        if not m or not m.use_nodes: continue
        b = m.node_tree.nodes.get('Principled BSDF')
        if not b: continue
        n = m.name.lower()
        bc = b.inputs['Base Color'].default_value   # cores do FBX bem mais escuras que as do preview do autor
        for k in range(3): bc[k] = min(.8, bc[k] * 2.2)
        b.inputs['Alpha'].default_value = 1   # o FBX do pack vem com alpha 0 (ficaria invisível no jogo)
        if hasattr(m, 'surface_render_method'): m.surface_render_method = 'DITHERED'
        b.inputs['Roughness'].default_value = .38 if 'metal' in n else .62 if 'wood' in n else .5
        b.inputs['Metallic'].default_value = .55 if 'metal' in n else 0

def icon(ob, path, w=512, h=256):
    sc = bpy.context.scene
    lo, hi = bbox(ob); c = (lo + hi) / 2; size = hi - lo
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'
    # perfil: câmera em -Y (lado direito da arma), um pouco de cima
    cam.rotation_euler = (math.radians(84), 0, 0)
    cam.location = c - Vector((0, 1, 0)).normalized() * 0 + cam.rotation_euler.to_matrix() @ Vector((0, 0, 10))
    cam.data.ortho_scale = max(size.x, size.z * w / h) * 1.08; cam.data.clip_end = 100
    print('ICONE', path, tuple(round(v, 3) for v in c), tuple(round(v, 3) for v in size), round(cam.data.ortho_scale, 3))
    sc.render.resolution_x, sc.render.resolution_y = w, h; sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48; sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.55, .58, .64, 1); world.node_tree.nodes['Background'].inputs['Strength'].default_value = .7
    # luz de estúdio com sóis (a intensidade não depende do tamanho da arma)
    def light(name, d, power, color=(1, 1, 1), angle=12):
        L = bpy.data.lights.new(name, 'SUN'); L.energy = power; L.color = color; L.angle = math.radians(angle)
        o = bpy.data.objects.new(name, L); sc.collection.objects.link(o); o.rotation_euler = (-Vector(d)).to_track_quat('-Z', 'Y').to_euler()
    light('key', (-.5, -1, .9), 4.5)
    light('fill', (.8, -1, -.2), 1.6, (.8, .88, 1))
    light('rim', (0, 1, .6), 3.5, (1, .88, .7))
    light('top', (0, 0, 1), 1.2)
    sc.render.use_freestyle = True; sc.render.line_thickness_mode = 'ABSOLUTE'; sc.render.line_thickness = 1.6
    fs_ = sc.view_layers[0].freestyle_settings
    ls = fs_.linesets[0] if fs_.linesets else fs_.linesets.new('contorno')
    if not ls.linestyle: ls.linestyle = bpy.data.linestyles.new('contorno')
    ls.linestyle.color = (.06, .06, .07)
    sc.render.filepath = path; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    bpy.ops.render.render(write_still=True)

for it in items:
    reset()
    ob = load(it['fbx']); ob.name = it['id']; materials(ob)
    lo, hi = bbox(ob)
    if it['kind'] == 'weapon':
        L = hi.x - lo.x
        # cano p/ +X: a parte mais baixa (empunhadura/carregador/coronha) fica sempre na metade de trás
        low = [v.co for v in ob.data.vertices if v.co.z < lo.z + .12 * (hi.z - lo.z)]
        lx = sum(p.x for p in low) / len(low)
        if (lx > (lo.x + hi.x) / 2) != bool(it.get('flip')): xform(ob, Matrix.Rotation(math.pi, 4, 'Z')); lo, hi = bbox(ob)
        s = it['scale']; xform(ob, Matrix.Scale(s, 4)); lo, hi = bbox(ob); L = hi.x - lo.x; Hh = hi.z - lo.z
        # boca do cano: centro dos vértices da ponta da frente
        tip = [v.co for v in ob.data.vertices if v.co.x > hi.x - .02 * L]
        muzzle = Vector((hi.x, sum(p.y for p in tip) / len(tip), sum(p.z for p in tip) / len(tip)))
        gx, gz = it['grip']
        grip = Vector((lo.x + gx * L, 0, lo.z + gz * Hh))
        top = max((v.co.z for v in ob.data.vertices if abs(v.co.x - (lo.x + it['rail'] * L)) < .06 * L), default=hi.z)
        under = min((v.co.z for v in ob.data.vertices if abs(v.co.x - (lo.x + it['under'] * L)) < .04 * L), default=muzzle.z)
        rail = Vector((lo.x + it['rail'] * L, 0, top)); und = Vector((lo.x + it['under'] * L, 0, under))
        # ícone antes de mover a origem (perfil, cano p/ a direita)
        icon(ob, os.path.join(OUT, 'icons', it['id'] + '.png'))
        for o in [o for o in bpy.context.scene.objects if o is not ob]: bpy.data.objects.remove(o, do_unlink=True)
        # origem na mão; cano +X do Blender → +Z do glTF: gira -90° em Z (X→-Y) e o exportador leva -Y p/ +Z
        to = Matrix.Rotation(-math.pi / 2, 4, 'Z') @ Matrix.Translation(-grip)
        xform(ob, to)
        for name, p in (('muzzle', muzzle), ('rail', rail), ('under', und)):
            e = empty(name, to @ p); e.parent = ob
        out = dict(id=it['id'], length=round(L, 4), height=round(Hh, 4), scale=s,
                   muzzle=[round(v, 4) for v in (to @ muzzle)], rail=[round(v, 4) for v in (to @ rail)], under=[round(v, 4) for v in (to @ und)])
    else:
        # acessório: comprimento no X; encaixe conforme o tipo
        a = it['mount']; c = (lo + hi) / 2
        if hi.x - lo.x < max(hi.y - lo.y, hi.z - lo.z) and a in ('muzzle',): pass
        icon(ob, os.path.join(OUT, 'icons', it['id'] + '.png'))
        for o in [o for o in bpy.context.scene.objects if o is not ob]: bpy.data.objects.remove(o, do_unlink=True)
        p = {'muzzle': Vector((lo.x, c.y, c.z)), 'rail': Vector((c.x, c.y, lo.z)), 'under': Vector((c.x, c.y, hi.z))}[a]
        to = Matrix.Rotation(-math.pi / 2, 4, 'Z') @ Matrix.Translation(-p)
        xform(ob, to)
        out = dict(id=it['id'], length=round(hi.x - lo.x, 4), mount=a)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'models', it['id'] + '.glb'), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_extras=False)
    report.append(out); print('ARMA', json.dumps(out))
json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'))
