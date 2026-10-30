// tools/npc-skeleton.mjs — reposiciona o esqueleto de personagens já riggados (assets/npcs/*.glb) sem tocar na malha:
//  - pescoço na base do pescoço (onde o trapézio termina), cabeça na base do crânio (altura do queixo) — antes a
//    cabeça girava do meio do pescoço;
//  - clavícula saindo do alto do peito, junto da base do pescoço (antes saía abaixo da linha do ombro);
//  - ombro (cabeça do úmero) no ápice da axila (antes, em corpos femininos, ficava no meio do deltoide);
//  - coluna, pescoço e cabeça numa linha reta;
//  - pesos de Spine2/pescoço/cabeça redistribuídos pela altura nas novas articulações (o resto fica como estava);
//  - limites anatômicos dos pesos (tools/rig-weights.mjs): braço não puxa o peito, coxa não puxa a barriga etc.
// A malha no repouso continua idêntica (as matrizes de bind são recalculadas p/ as novas articulações).
// Sempre parte dos GLBs gerados pelo tools/rig-npcs.mjs (--from, padrão: a versão do commit ORIGINAL abaixo, lida do
// git), então rodar de novo dá o mesmo resultado; p/ restaurar: git checkout <ORIGINAL> -- assets/npcs
//
// Uso: node tools/npc-skeleton.mjs <id> [<id>...] | --all   [--from <pasta com os GLBs do rig-npcs>]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { constrainWeights } from './rig-weights.mjs';
import { measureUpperBody } from './rig-anatomy.mjs';
import { measureHands, applyFingerWeights } from './rig-hands.mjs';

const DIR = 'assets/npcs/';
export const ORIGINAL = '3576b86';   // último rig gerado pelo tools/rig-npcs.mjs

const roster = JSON.parse(fs.readFileSync(DIR + 'roster.json', 'utf8'));
const argv = process.argv.slice(2), fi = argv.indexOf('--from'), FROM = fi >= 0 ? argv[fi + 1] : null;
const ids = argv.includes('--all') ? roster.characters.map(c => c.id) : argv.filter((a, i) => !a.startsWith('--') && !(fi >= 0 && i === fi + 1));
const readSource = f => FROM ? fs.readFileSync(FROM + '/' + f) : execFileSync('git', ['show', ORIGINAL + ':' + DIR + f], { maxBuffer: 1 << 28 });
if (!ids.length) { console.error('uso: node tools/npc-skeleton.mjs <id>... | --all'); process.exit(1); }

const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

for (const id of ids) {
  const meta = roster.characters.find(c => c.id === id); if (!meta) throw Error('personagem desconhecido: ' + id);
  const file = DIR + meta.file, b = readSource(meta.file);
  const jl = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jl).toString());
  const bin = Buffer.from(b.subarray(20 + jl + 8, 20 + jl + 8 + b.readUInt32LE(20 + jl)));
  const view = (i, Type) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView];
    if (v.byteStride && v.byteStride !== Type.BYTES_PER_ELEMENT * NC[a.type]) throw Error('stride inesperado');
    return new Type(bin.buffer, bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0), a.count * NC[a.type]); };
  const prim = json.meshes[0].primitives[0], skin = json.skins[0];
  const P = view(prim.attributes.POSITION, Float32Array), JI = view(prim.attributes.JOINTS_0, Uint8Array), WT = view(prim.attributes.WEIGHTS_0, Float32Array);
  const IBM = view(skin.inverseBindMatrices, Float32Array), nv = P.length / 3;
  const jointName = skin.joints.map(n => json.nodes[n].name.replace('mixamorig', '')), jIdx = Object.fromEntries(jointName.map((n, k) => [n, k]));
  const nodeOf = Object.fromEntries(skin.joints.map((n, k) => [jointName[k], n]));
  const parent = {}; json.nodes.forEach((n, i) => (n.children || []).forEach(c => parent[c] = i));

  // repouso atual (metros, espaço da cena) a partir das matrizes de bind
  const pos = {}, rot = {}, tmpS = new THREE.Vector3();
  jointName.forEach((n, k) => { const m = new THREE.Matrix4().fromArray(IBM, k * 16).invert(); pos[n] = new THREE.Vector3(); rot[n] = new THREE.Quaternion(); m.decompose(pos[n], rot[n], tmpS); });
  const SCALE = tmpS.x;   // Armature em centímetros (0,01)
  const H = pos.HeadTop_End.y;

  // ---------- articulações do tronco alto medidas na malha (tools/rig-anatomy.mjs) ----------
  const zSpine = pos.Spine2.z, A = measureUpperBody(P, H, { armY: (pos.LeftArm.y + pos.RightArm.y) / 2, spineZ: zSpine });
  const { chin, neckZ, throat } = A, J = {};
  for (const [k, v] of Object.entries(A.joints)) J[k] = new THREE.Vector3(v.x, v.y, v.z);
  // dedos medidos na malha (tools/rig-hands.mjs)
  const ia = json.accessors[prim.indices], idx = view(prim.indices, ia.componentType === 5125 ? Uint32Array : Uint16Array);
  const HANDS = measureHands({ P, idx, H, hands: { Left: pos.LeftHand, Right: pos.RightHand } });
  for (const [k, v] of Object.entries(HANDS.joints)) J[k] = new THREE.Vector3(v.x, v.y, v.z);

  // ---------- esqueleto: posições novas, eixo Y de cada osso realinhado ao filho (menor rotação) ----------
  const newPos = {}, newRot = {};
  for (const n of jointName) newPos[n] = (J[n] || pos[n]).clone();
  // filho que define o eixo do osso: a coluna segue p/ o pescoço (não p/ a clavícula), os demais p/ o primeiro filho
  const firstChild = n => { const kids = (json.nodes[nodeOf[n]].children || []).map(c => json.nodes[c].name.replace('mixamorig', '')); return kids.find(k => /^(Spine\d?|Neck|Head|HeadTop_End|(Left|Right)HandMiddle1)$/.test(k)) || kids[0]; };
  for (const n of jointName) {
    const kid = firstChild(n);
    if (kid && jIdx[kid] != null && (J[n] || J[kid])) {
      const yOld = new THREE.Vector3(0, 1, 0).applyQuaternion(rot[n]), dir = newPos[kid].clone().sub(newPos[n]).normalize();
      newRot[n] = new THREE.Quaternion().setFromUnitVectors(yOld, dir).multiply(rot[n]);
    } else newRot[n] = rot[n].clone();
  }
  // nós: translação/rotação locais (espaço do pai; Hips é filho da Armature em cm)
  const world = n => new THREE.Matrix4().compose(newPos[n], newRot[n], new THREE.Vector3(SCALE, SCALE, SCALE));
  const armM = (() => { const pIdx = parent[nodeOf.Hips], chain = []; for (let k = pIdx; k != null; k = parent[k]) chain.unshift(json.nodes[k]);
    const m = new THREE.Matrix4(); for (const nd of chain) { const l = new THREE.Matrix4(); if (nd.matrix) l.fromArray(nd.matrix); else l.compose(new THREE.Vector3(...(nd.translation || [0, 0, 0])), new THREE.Quaternion(...(nd.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(nd.scale || [1, 1, 1]))); m.multiply(l); } return m; })();
  for (const n of jointName) {
    const nd = json.nodes[nodeOf[n]], pn = json.nodes[parent[nodeOf[n]]].name.replace('mixamorig', '');
    const pw = jIdx[pn] != null ? world(pn) : armM, l = pw.clone().invert().multiply(world(n));
    const t = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); l.decompose(t, q, s);
    nd.translation = t.toArray().map(v => +v.toFixed(6)); nd.rotation = q.normalize().toArray().map(v => +v.toFixed(7)); delete nd.matrix; delete nd.scale;
  }
  jointName.forEach((n, k) => world(n).invert().toArray(IBM, k * 16));

  // ---------- pesos: tronco alto / pescoço / cabeça pela altura das novas articulações ----------
  const S2 = jIdx.Spine2, NK = jIdx.Neck, HD = jIdx.Head, lo = J.Neck.y - 0.035 * H, hi = J.Head.y + 0.02 * H;
  let changed = 0;
  for (let i = 0; i < nv; i++) {
    const y = P[i * 3 + 1]; if (y < lo || y > hi || Math.abs(P[i * 3]) > 0.1 * H) continue;
    const w = new Map(); for (let k = 0; k < 4; k++) { const v = WT[i * 4 + k]; if (v > 0) w.set(JI[i * 4 + k], (w.get(JI[i * 4 + k]) || 0) + v); }
    const t = (w.get(S2) || 0) + (w.get(NK) || 0) + (w.get(HD) || 0); if (t < 1e-4) continue;
    // divisa pescoço/cabeça: atrás, na base do crânio; na frente desce p/ debaixo do queixo (mandíbula inteira na cabeça)
    const front = smooth(neckZ, throat.zf, P[i * 3 + 2]), split = J.Head.y * (1 - front) + (chin - 0.012) * H * front;
    const s1 = smooth(J.Neck.y - 0.02 * H, J.Neck.y + 0.012 * H, y), s2 = smooth(split - 0.01 * H, split + 0.01 * H, y);
    w.set(S2, t * (1 - s1)); w.set(NK, t * s1 * (1 - s2)); w.set(HD, t * s1 * s2);
    const top = [...w].filter(([, v]) => v > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((a, [, v]) => a + v, 0);
    for (let k = 0; k < 4; k++) { JI[i * 4 + k] = top[k] ? top[k][0] : 0; WT[i * 4 + k] = top[k] ? top[k][1] / sum : 0; }
    changed++;
  }

  // ---------- limites anatômicos dos pesos ----------
  const DEFORM = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', ...['Left', 'Right'].flatMap(s => ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase'].map(b => s + b))];
  const seg = b => DEFORM.includes(b) && firstChild(b) && newPos[firstChild(b)] ? [newPos[b], newPos[firstChild(b)]] : null;
  const fix = constrainWeights({ P, idx, JI, WT, names: jointName, J: newPos, H, segments: seg });
  applyFingerWeights({ JI, WT, names: jointName, weights: HANDS.weights, weld: HANDS.weld });
  json.asset.generator = 'City of God rig-npcs + npc-skeleton (Mixamo 65, articulações na malha, pesos com limites anatômicos)';

  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc(((js.length + 3) & ~3) - js.length, 0x20)]);
  const head = Buffer.alloc(12), ch = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.write(type, 4); return c; };
  head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  fs.writeFileSync(file, Buffer.concat([head, ch(js.length, 'JSON'), js, ch(bin.length, 'BIN\0'), bin]));
  meta.skeleton = 'mixamo-reto'; meta.bytes = fs.statSync(file).size;
  const r = n => +(newPos[n].y / H).toFixed(3);
  console.log(id.padEnd(22), JSON.stringify({ neck: r('Neck'), head: r('Head'), clavicula: r('LeftShoulder'), ombro: r('LeftArm'), ombroX: +(newPos.LeftArm.x / H).toFixed(3), ombroXantes: +(pos.LeftArm.x / H).toFixed(3), pescoco_cabeca: changed, ...fix, dedos: HANDS.report }));
}
fs.writeFileSync(DIR + 'roster.json', JSON.stringify(roster, null, 1));
