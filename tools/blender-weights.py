# tools/blender-weights.py — pesos de skinning por difusão de calor (Automatic Weights do Blender) para o
# tools/rig-npcs.mjs. Entrada (JSON): vértices soldados, triângulos e ossos (cabeça/cauda/pai) na pose T.
# Saída (JSON): para cada vértice, até 4 pares [índice do osso, peso]. Só pesos: o esqueleto, a pose de repouso e o
# GLB continuam no conversor em Node (assim não há conversão de eixos de osso do Blender no meio).
# Uso: blender -b --factory-startup -P tools/blender-weights.py -- entrada.json saida.json
import bpy, json, sys

args = sys.argv[sys.argv.index('--') + 1:]
src, dst = args[0], args[1]
data = json.load(open(src))
bpy.ops.wm.read_factory_settings(use_empty=True)

mesh = bpy.data.meshes.new('body')
mesh.from_pydata([tuple(v) for v in data['verts']], [], [tuple(f) for f in data['faces']])
mesh.update()
body = bpy.data.objects.new('body', mesh)
bpy.context.scene.collection.objects.link(body)

arm_data = bpy.data.armatures.new('rig')
rig = bpy.data.objects.new('rig', arm_data)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
edit = {}
for b in data['bones']:
    eb = arm_data.edit_bones.new(b['name'])
    eb.head = b['head']; eb.tail = b['tail']
    edit[b['name']] = eb
for b in data['bones']:
    if b.get('parent') in edit: edit[b['name']].parent = edit[b['parent']]
bpy.ops.object.mode_set(mode='OBJECT')

# pesos automáticos (calor) — a malha vira filha da armadura
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

names = [b['name'] for b in data['bones']]
index = {n: i for i, n in enumerate(names)}
groups = {g.index: g.name for g in body.vertex_groups}
out = []
for v in mesh.vertices:
    ws = sorted(((index[groups[g.group]], g.weight) for g in v.groups if groups.get(g.group) in index and g.weight > 1e-4), key=lambda x: -x[1])[:4]
    out.append([[i, round(w, 5)] for i, w in ws])
# onde o calor não chega (pedaços soltos: cabelo, acessórios, dobras de roupa), copia os pesos do vértice pesado
# mais próximo — a transição continua a do calor, sem emenda com outro método
from mathutils import kdtree
done = [i for i, w in enumerate(out) if w]
empty = len(out) - len(done)
if done and empty:
    kd = kdtree.KDTree(len(done))
    for k, i in enumerate(done): kd.insert(mesh.vertices[i].co, i)
    kd.balance()
    for i, w in enumerate(out):
        if not w:
            near = kd.find_n(mesh.vertices[i].co, 4)
            acc = {}
            tot = 0.0
            for co, j, d in near:
                f = 1.0 / max(d, 1e-4)
                tot += f
                for bi, bw in out[j]: acc[bi] = acc.get(bi, 0) + bw * f
            out[i] = [[bi, round(bw / tot, 5)] for bi, bw in sorted(acc.items(), key=lambda x: -x[1])[:4]]
json.dump({'weights': out, 'empty': 0, 'copied': empty}, open(dst, 'w'))
print('PESOS OK', len(out), 'copiados do vizinho', empty)
