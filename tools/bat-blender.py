# tools/bat-blender.py — taco de beisebol (modelo próprio, torneado) → assets/weapons/models/bat_1.glb + ícone PNG.
# Mesmo padrão das armas (tools/weapons-blender.py): eixo do taco em +Z do glTF, Y p/ cima, origem na empunhadura
# (onde fica a mão direita, logo acima do pomo). Nó "tip" na ponta (o jogo mede o alcance do golpe por ele).
# Uso: blender -b --factory-startup -P tools/bat-blender.py -- saida_dir   (depois: node tools/import-weapons.mjs --bat)
import bpy, sys, os, math
from mathutils import Vector, Matrix

OUT = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# perfil (x ao longo do taco, raio) em metros: pomo, cabo fino, cone e barril, ponta arredondada — 84 cm
PROFILE = [(0, 0), (0, .026), (.012, .028), (.022, .016), (.04, .0125), (.2, .013), (.33, .016), (.46, .024), (.56, .031),
           (.66, .0335), (.79, .0335), (.815, .031), (.832, .022), (.84, .0)]
SEG = 28

def lathe(profile, name):
    verts, faces = [], []
    for x, r in profile:
        for k in range(SEG):
            a = 2 * math.pi * k / SEG
            verts.append((x, r * math.cos(a), r * math.sin(a)))
    for i in range(len(profile) - 1):
        for k in range(SEG):
            a, b = i * SEG + k, i * SEG + (k + 1) % SEG
            faces.append((a, b, b + SEG, a + SEG))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    return ob

def mat(name, color, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    return m

bat = lathe(PROFILE, 'bat_1')
wood, tape = mat('wood', (.62, .42, .22), .45), mat('grip', (.04, .04, .045), .8)
bat.data.materials.append(wood); bat.data.materials.append(tape)
# fita no cabo (do pomo até 26 cm)
for p in bat.data.polygons:
    if p.center.x < .26: p.material_index = 1

def icon(ob, path, w=512, h=256):
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))); hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    c, size = (lo + hi) / 2, hi - lo
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.rotation_euler = (math.radians(84), 0, 0)
    cam.location = c + cam.rotation_euler.to_matrix() @ Vector((0, 0, 10))
    cam.data.ortho_scale = max(size.x, size.z * w / h) * 1.08; cam.data.clip_end = 100
    sc.render.resolution_x, sc.render.resolution_y = w, h; sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48; sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.55, .58, .64, 1); world.node_tree.nodes['Background'].inputs['Strength'].default_value = .7
    def light(name, d, power, color=(1, 1, 1), angle=12):
        L = bpy.data.lights.new(name, 'SUN'); L.energy = power; L.color = color; L.angle = math.radians(angle)
        o = bpy.data.objects.new(name, L); sc.collection.objects.link(o); o.rotation_euler = (-Vector(d)).to_track_quat('-Z', 'Y').to_euler()
    light('key', (-.5, -1, .9), 4.5); light('fill', (.8, -1, -.2), 1.6, (.8, .88, 1)); light('rim', (0, 1, .6), 3.5, (1, .88, .7)); light('top', (0, 0, 1), 1.2)
    sc.render.use_freestyle = True; sc.render.line_thickness_mode = 'ABSOLUTE'; sc.render.line_thickness = 1.6
    fs_ = sc.view_layers[0].freestyle_settings
    ls = fs_.linesets[0] if fs_.linesets else fs_.linesets.new('contorno')
    if not ls.linestyle: ls.linestyle = bpy.data.linestyles.new('contorno')
    ls.linestyle.color = (.06, .06, .07)
    sc.render.filepath = path; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    bpy.ops.render.render(write_still=True)
    for o in [o for o in sc.objects if o is not ob]: bpy.data.objects.remove(o, do_unlink=True)

# ícone deitado e um pouco inclinado (ponta p/ cima à direita)
bat.rotation_euler = (0, math.radians(-12), 0); bpy.context.view_layer.update()
os.makedirs(os.path.join(OUT, 'icons'), exist_ok=True); os.makedirs(os.path.join(OUT, 'models'), exist_ok=True)
icon(bat, os.path.join(OUT, 'icons', 'bat_1.png'))
bat.rotation_euler = (0, 0, 0); bpy.context.view_layer.update()
# origem na mão (9 cm do pomo); eixo +X do Blender → +Z do glTF (como nas armas)
grip = Vector((.09, 0, 0))
to = Matrix.Rotation(-math.pi / 2, 4, 'Z') @ Matrix.Translation(-grip)
bat.data.transform(to); bat.data.update()
tip = bpy.data.objects.new('tip', None); tip.location = to @ Vector((.84, 0, 0)); sc.collection.objects.link(tip); tip.parent = bat
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'models', 'bat_1.glb'), export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_extras=False)
print('TACO OK')
