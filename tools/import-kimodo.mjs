// tools/import-kimodo.mjs — animações geradas no Kimodo (NVIDIA, text-to-motion; GLB só de esqueleto SOMA de 30 ossos)
// → biblioteca no esqueleto Mixamo do David (assets/characters/rigs/kimodo.rig.glb), que o jogo transfere p/ os 52
// personagens do mesmo jeito que as animações do Mixamo (js/npc-roster.mjs → retargetMixamo).
//
// Uso: node tools/import-kimodo.mjs PASTA [--once=acenar,...] [--out=assets/characters/rigs/kimodo.rig.glb]
//   Cada PASTA/<nome>.glb vira o clipe <nome> (o nome do arquivo é o nome da animação no jogo). Por padrão o clipe é
//   recortado num ciclo que fecha (andar, correr, parado...); os listados em --once ficam inteiros (acenar, pular...).
//
// Transferência: as duas poses de repouso são T, Y p/ cima, de frente p/ +Z. Cada osso Mixamo recebe a rotação de
// mundo que o osso SOMA correspondente fez a partir do repouso dele, depois de alinhar a direção de repouso dos dois
// ossos (braço→antebraço, coxa→joelho...):  mundo_mixamo(t) = Δsoma(t) · A · repouso_mixamo
// Ossos sem par (dedos, ponta da cabeça) ficam no repouso em relação ao pai — a mão leva os dedos junto.
// O quadril sai com a altura na escala do David; o jogo trava X/Z (no lugar). O primeiro quadro é girado p/ olhar +Z.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

const args = process.argv.slice(2), opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
const SRC = args.find(a => !a.startsWith('--'));
if (!SRC) throw Error('Uso: node tools/import-kimodo.mjs PASTA [--once=a,b] [--out=arquivo.glb]');
const OUT = opt.out || 'assets/characters/rigs/kimodo.rig.glb', ONCE = new Set((opt.once || '').split(',').filter(Boolean));
const LIB = 'assets/characters/rigs/mixamo/david.rig.glb';

// SOMA → Mixamo (Neck2 não tem par: a cabeça recebe a rotação de mundo da cabeça SOMA, que já inclui o pescoço)
const MAP = { Hips: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', Chest: 'Spine2', Neck1: 'Neck', Head: 'Head' };
for (const s of ['Left', 'Right']) Object.assign(MAP, { [s + 'Shoulder']: s + 'Shoulder', [s + 'Arm']: s + 'Arm', [s + 'ForeArm']: s + 'ForeArm', [s + 'Hand']: s + 'Hand',
  [s + 'Leg']: s + 'UpLeg', [s + 'Shin']: s + 'Leg', [s + 'Foot']: s + 'Foot', [s + 'ToeBase']: s + 'ToeBase' });
// filho usado p/ a direção de repouso de cada osso (SOMA, Mixamo)
const DIR = {};
for (const s of ['Left', 'Right']) Object.assign(DIR, { [s + 'Shoulder']: [s + 'Arm', s + 'Arm'], [s + 'Arm']: [s + 'ForeArm', s + 'ForeArm'], [s + 'ForeArm']: [s + 'Hand', s + 'Hand'],
  [s + 'Hand']: [s + 'HandMiddleEnd', s + 'HandMiddle1'], [s + 'Leg']: [s + 'Shin', s + 'Leg'], [s + 'Shin']: [s + 'Foot', s + 'Foot'], [s + 'Foot']: [s + 'ToeBase', s + 'ToeBase'] });

function readGLB(file) {
  const b = fs.readFileSync(file), len = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + len));
  const bin = b.subarray(28 + len);
  const read = i => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], n = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
    const off = bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0);
    return new Float32Array(bin.buffer.slice(off, off + a.count * n * 4)); };
  return { json, read };
}
const nodeTRS = n => {
  if (n.matrix) { const m = new THREE.Matrix4().fromArray(n.matrix), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return { p, q, s }; }
  return { p: new THREE.Vector3(...(n.translation || [0, 0, 0])), q: new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])), s: new THREE.Vector3(...(n.scale || [1, 1, 1])) };
};

// ---------- biblioteca (David): repouso de mundo de cada osso canônico (primeira ocorrência do nome) ----------
const lib = readGLB(LIB), LN = lib.json.nodes, parentOf = new Map();
LN.forEach((n, i) => (n.children || []).forEach(c => parentOf.set(c, i)));
const canon = new Map(); LN.forEach((n, i) => { if (n.name && !canon.has(n.name)) canon.set(n.name, i); });
const libWorld = new Map();   // índice → Matrix4 de mundo no repouso
const worldOf = i => { if (libWorld.has(i)) return libWorld.get(i); const { p, q, s } = nodeTRS(LN[i]); const m = new THREE.Matrix4().compose(p, q, s);
  const par = parentOf.get(i), w = par == null ? m : worldOf(par).clone().multiply(m); libWorld.set(i, w); return w; };
const decomp = m => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return { p, q, s }; };
// ossos Mixamo canônicos, em ordem de hierarquia (pai antes do filho)
const libBones = [];
(function walk(i) { const n = LN[i]; if (n.name?.startsWith('mixamorig') && canon.get(n.name) === i) libBones.push(i); (n.children || []).forEach(walk); })(lib.json.scenes[0].nodes[0]);
const libRest = new Map(libBones.map(i => [LN[i].name.replace('mixamorig', ''), { i, ...decomp(worldOf(i)), local: nodeTRS(LN[i]) }]));
const libParent = i => { let p = parentOf.get(i); while (p != null && !libBones.includes(p)) p = parentOf.get(p); return p; };
const lowest = Math.min(...[...libRest.values()].map(r => r.p.y)), libHipsH = libRest.get('Hips').p.y - lowest;

// ---------- um arquivo do Kimodo → quadros de rotação de mundo dos ossos Mixamo ----------
function convert(file, name, loop) {
  const { json, read } = readGLB(file), SN = json.nodes, spar = new Map();
  SN.forEach((n, i) => (n.children || []).forEach(c => spar.set(c, i)));
  const sidx = new Map(SN.map((n, i) => [n.name, i]));
  if (!sidx.has('LeftShin') || !sidx.has('Chest')) throw Error(file + ': não é o esqueleto SOMA do Kimodo');
  const anim = json.animations[0], times = read(anim.samplers[0].input), F = times.length;
  const rot = new Map(), hipsT = { v: null };
  for (const ch of anim.channels) { const v = read(anim.samplers[ch.sampler].output);
    if (ch.target.path === 'rotation') rot.set(ch.target.node, v); else if (ch.target.path === 'translation' && ch.target.node === sidx.get('Hips')) hipsT.v = v; }
  // repouso SOMA (rotações identidade): posições de mundo p/ direções e altura do quadril
  const sRestPos = new Map(); const sPos = i => { if (sRestPos.has(i)) return sRestPos.get(i); const p = new THREE.Vector3(...(SN[i].translation || [0, 0, 0]));
    const par = spar.get(i); if (par != null) p.add(sPos(par)); sRestPos.set(i, p); return p; };
  SN.forEach((_, i) => sPos(i));
  const sLowest = Math.min(...[...sRestPos.values()].map(p => p.y)), somaHipsH = sRestPos.get(sidx.get('Hips')).y - sLowest, k = libHipsH / somaHipsH;
  // alinhamento de repouso por osso: direção Mixamo → direção SOMA
  const align = new Map();
  for (const [s, m] of Object.entries(MAP)) { const d = DIR[s]; if (!d || !sidx.has(d[0]) || !libRest.has(d[1])) continue;
    const ds = sRestPos.get(sidx.get(d[0])).clone().sub(sRestPos.get(sidx.get(s))).normalize();
    const dm = libRest.get(d[1]).p.clone().sub(libRest.get(m).p).normalize();
    align.set(m, new THREE.Quaternion().setFromUnitVectors(dm, ds)); }
  // giro inicial: o quadril do primeiro quadro olha p/ +Z
  const q0 = new THREE.Quaternion().fromArray(rot.get(sidx.get('Hips')) || [0, 0, 0, 1], 0), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q0);
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(fwd.x, fwd.z));
  const frames = [];
  for (let f = 0; f < F; f++) {
    const sw = new Map(), q = new THREE.Quaternion();
    for (let i = 0; i < SN.length; i++) { const r = rot.get(i); q.set(0, 0, 0, 1); if (r) q.fromArray(r, f * 4);
      const par = spar.get(i); sw.set(i, par == null ? yaw.clone().multiply(q) : sw.get(par).clone().multiply(q)); }
    const world = new Map();
    for (const [s, m] of Object.entries(MAP)) { const R = libRest.get(m); if (!R || !sidx.has(s)) continue;
      world.set(m, sw.get(sidx.get(s)).clone().multiply(align.get(m) || new THREE.Quaternion()).multiply(R.q)); }
    const h = hipsT.v ? new THREE.Vector3().fromArray(hipsT.v, f * 3).applyQuaternion(yaw) : new THREE.Vector3(0, somaHipsH, 0);
    frames.push({ world, hips: new THREE.Vector3(libRest.get('Hips').p.x, lowest + h.y * k, libRest.get('Hips').p.z) });
  }
  // rotações locais na hierarquia do David (ossos sem par: repouso local)
  const local = frames.map(fr => { const w = new Map(), out = new Map();
    for (const i of libBones) { const n = LN[i].name.replace('mixamorig', ''), R = libRest.get(n), p = libParent(i), pw = p == null ? decomp(parentOf.has(i) ? worldOf(parentOf.get(i)) : new THREE.Matrix4()).q : w.get(LN[p].name.replace('mixamorig', ''));
      const ww = fr.world.get(n) || pw.clone().multiply(R.local.q); w.set(n, ww);
      out.set(n, pw.clone().invert().multiply(ww).normalize()); }
    return out; });
  let a = 0, b = F - 1;
  if (loop) {
    // ciclo: par de quadros com a pose mais parecida, começando depois da partida (o Kimodo costuma sair do parado:
    // o início vai de 25% a 60% do clipe) e com 0,6 a 2 s; trechos quase parados não contam (o parado no começo de um
    // "correndo" é o par mais parecido de todos)
    const names = ['Hips', 'Spine', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'];
    const dist = (x, y) => names.reduce((s, n) => s + local[x].get(n).angleTo(local[y].get(n)), 0) + Math.abs(frames[x].hips.y - frames[y].hips.y) / 5;
    const fps = (F - 1) / (times[F - 1] - times[0]), minLen = Math.round(0.6 * fps); let best = Infinity;
    const legs = ['LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftArm', 'RightArm'], speed = [0];
    for (let f = 1; f < F; f++) speed.push(legs.reduce((s, n) => s + local[f].get(n).angleTo(local[f - 1].get(n)), 0) + frames[f].hips.distanceTo(frames[f - 1].hips) / 20);
    const avg = (x, y) => speed.slice(x + 1, y + 1).reduce((s, v) => s + v, 0) / (y - x), whole = avg(0, F - 1), maxLen = Math.round(2 * fps);
    for (let x = Math.round(0.25 * F); x < Math.round(0.6 * F); x++)
      for (let y = x + minLen; y < Math.min(F, x + maxLen); y++) { if (avg(x, y) < 0.6 * whole) continue;
        const d = dist(x, y) - (y - x) * 1e-3; if (d < best) { best = d; a = x; b = y; } }
    if (best === Infinity) { a = 0; b = F - 1; }
  }
  const T = [], Q = new Map(), H = [];
  for (let f = a; f <= b; f++) {
    const t = times[f] - times[a]; T.push(t);
    // fecho do ciclo: os últimos quadros vão até a pose do primeiro
    const blend = loop ? Math.max(0, 1 - (b - f) / 6) : 0;
    for (const [n, q] of local[f]) { const v = blend ? q.clone().slerp(local[a].get(n), blend) : q; if (!Q.has(n)) Q.set(n, []);
      const arr = Q.get(n), prev = arr.length ? new THREE.Quaternion().fromArray(arr, arr.length - 4) : null;
      if (prev && prev.dot(v) < 0) v.set(-v.x, -v.y, -v.z, -v.w); arr.push(v.x, v.y, v.z, v.w); }
    const hp = frames[f].hips.clone().lerp(frames[a].hips, blend), par = parentOf.get(libRest.get('Hips').i);
    hp.applyMatrix4(worldOf(par).clone().invert()); H.push(hp.x, hp.y, hp.z);
  }
  console.log(name.padEnd(16), loop ? 'ciclo' : 'inteiro', 'quadros', a + '–' + b, (T[T.length - 1]).toFixed(2) + ' s', 'escala quadril', k.toFixed(1));
  return { name, T, Q, H };
}

// ---------- GLB: esqueleto do David (nós e skins) + os clipes convertidos ----------
const files = fs.readdirSync(SRC).filter(f => f.toLowerCase().endsWith('.glb')).sort();
if (!files.length) throw Error('Nenhum .glb em ' + SRC);
const clips = files.map(f => { const name = path.basename(f, path.extname(f)); return convert(path.join(SRC, f), name, !ONCE.has(name)); });
const json = { asset: { version: '2.0', generator: 'City of God tools/import-kimodo.mjs' }, scene: 0, scenes: lib.json.scenes, nodes: LN, skins: [], accessors: [], bufferViews: [], buffers: [], animations: [] };
const chunks = []; let offset = 0;
const push = (arr, type, extra = {}) => { const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); chunks.push(bytes); const pad = (4 - bytes.length % 4) % 4; if (pad) chunks.push(Buffer.alloc(pad));
  json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length }); offset += bytes.length + pad;
  json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType: 5126, count: arr.length / { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[type], type, ...extra }); return json.accessors.length - 1; };
for (const s of lib.json.skins) json.skins.push({ ...s, inverseBindMatrices: push(lib.read(s.inverseBindMatrices), 'MAT4') });
for (const c of clips) {
  const tIn = push(Float32Array.from(c.T), 'SCALAR', { min: [c.T[0]], max: [c.T[c.T.length - 1]] }), samplers = [], channels = [];
  for (const [n, arr] of c.Q) { samplers.push({ input: tIn, output: push(Float32Array.from(arr), 'VEC4'), interpolation: 'LINEAR' }); channels.push({ sampler: samplers.length - 1, target: { node: canon.get('mixamorig' + n), path: 'rotation' } }); }
  samplers.push({ input: tIn, output: push(Float32Array.from(c.H), 'VEC3'), interpolation: 'LINEAR' }); channels.push({ sampler: samplers.length - 1, target: { node: canon.get('mixamorigHips'), path: 'translation' } });
  json.animations.push({ name: c.name, samplers, channels });
}
const bin = Buffer.concat(chunks); json.buffers.push({ byteLength: bin.length });
let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]));
console.log(OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB', clips.length + ' clipes');
