// tools/rig-audit.mjs — auditoria do rig dos personagens (assets/npcs) sem navegador: hierarquia dos 65 ossos, bind,
// pesos, desvio da malha no repouso e deformação por região nas animações e em poses de teste.
//
//   node tools/rig-audit.mjs [ids...] [--all] [--dir <pasta dos GLBs>] [--orig <pasta com os GLBs originais>] [--json]
//
// Métricas de deformação: para cada aresta da malha, razão comprimento(pose)/comprimento(repouso). Movimento rígido
// não muda arestas; o que muda é deformação. Cada aresta pertence à região do osso dominante dos seus vértices.
// Relata p99 e máximo de |razão − 1| por região, e larguras/profundidades do tronco (silhueta) comparadas ao repouso.
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {retargetMixamo,restPose,MIXAMO_LIBRARY} from '../js/npc-roster.mjs';
import {TEST_POSES,applyTestPose} from '../js/rig-test-poses.mjs';

export const BONES_65 = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End',
  ...['Left', 'Right'].flatMap(s => [s + 'Shoulder', s + 'Arm', s + 'ForeArm', s + 'Hand',
    ...['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].flatMap(f => [1, 2, 3, 4].map(k => s + 'Hand' + f + k)),
    s + 'UpLeg', s + 'Leg', s + 'Foot', s + 'ToeBase', s + 'Toe_End'])];
// pontas: referência, nunca deformam
export const END_BONES = new Set(['HeadTop_End', 'LeftToe_End', 'RightToe_End', ...BONES_65.filter(b => /Hand\w+4$/.test(b))]);
const REGION = b => /Head|Neck/.test(b) ? (b === 'Neck' ? 'pescoço' : 'cabeça') : /Spine|Hips/.test(b) ? 'tronco' : /Shoulder/.test(b) ? 'ombro' :
  /Hand\w/.test(b) ? 'dedos' : /Hand$/.test(b) ? 'mão' : /ForeArm/.test(b) ? 'antebraço' : /Arm$/.test(b) ? 'braço' : /UpLeg/.test(b) ? 'coxa' : /Leg$/.test(b) ? 'perna' : 'pé';

// GLB sem imagens (o Node não decodifica texturas; o rig não precisa delas)
function glbBuffer(file) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString());
  delete j.images; delete j.textures; delete j.samplers; (j.materials || []).forEach(m => { for (const k of Object.keys(m)) if (k !== 'name') delete m[k]; });
  let js = Buffer.from(JSON.stringify(j)); js = Buffer.concat([js, Buffer.alloc(((js.length + 3) & ~3) - js.length, 0x20)]);
  const rest = b.subarray(20 + jl), head = Buffer.alloc(12), ch = Buffer.alloc(8);
  head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + rest.length, 8); ch.writeUInt32LE(js.length, 0); ch.write('JSON', 4);
  const out = Buffer.concat([head, ch, js, rest]); return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}
const loader = new GLTFLoader(), libs = {};
export const loadGLB = file => loader.parseAsync(glbBuffer(file), '');
export async function library(sex) { return libs[sex] ||= await loadGLB(MIXAMO_LIBRARY[sex]); }

const meshOf = root => { let m = null; root.traverse(o => { if (o.isSkinnedMesh && !m) m = o; }); return m; };
// posições finais (espaço da cena) de todos os vértices na pose atual do esqueleto
export function skinned(mesh) {
  mesh.parent?.updateMatrixWorld(true); mesh.skeleton.update();
  const n = mesh.geometry.attributes.position.count, out = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); v.toArray(out, i * 3); }
  return out;
}

// ---------- estrutura, bind e pesos ----------
export function auditStructure(root) {
  const mesh = meshOf(root), sk = mesh.skeleton, names = sk.bones.map(b => b.name.replace('mixamorig', '')), issues = [];
  const missing = BONES_65.filter(b => !names.includes(b)), extra = names.filter(b => !BONES_65.includes(b));
  if (sk.bones.length !== 65) issues.push(sk.bones.length + ' ossos (esperado 65)');
  if (missing.length) issues.push('faltando: ' + missing.join(','));
  if (extra.length) issues.push('sobrando: ' + extra.join(','));
  if (new Set(names).size !== names.length) issues.push('nomes repetidos');
  const hips = root.getObjectByName('mixamorigHips');
  for (const b of sk.bones) { let p = b; while (p && p !== hips) p = p.parent; if (!p) issues.push(b.name + ' fora da hierarquia do Hips'); }
  // escala: ossos sem escala própria (só a Armature em cm)
  for (const b of sk.bones) if (Math.abs(b.scale.x - 1) > 1e-4 || Math.abs(b.scale.y - 1) > 1e-4 || Math.abs(b.scale.z - 1) > 1e-4) issues.push(b.name + ' com escala');
  // bind: matriz de mundo do osso no repouso × inversa de bind = identidade
  root.updateMatrixWorld(true);
  let bindErr = 0; const m = new THREE.Matrix4();
  sk.bones.forEach((b, k) => { m.multiplyMatrices(b.matrixWorld, sk.boneInverses[k]).premultiply(mesh.bindMatrixInverse); const e = m.elements; for (let i = 0; i < 16; i++) bindErr = Math.max(bindErr, Math.abs(e[i] - (i % 5 === 0 ? 1 : 0))); });
  if (bindErr > 1e-4) issues.push('bind inconsistente (erro ' + bindErr.toExponential(2) + ')');
  // pesos
  const g = mesh.geometry, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, n = SI.count;
  let bad = 0, neg = 0, zero = 0, sumErr = 0, onEnd = 0; const perBone = new Float64Array(65);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < 4; k++) { const j = SI.getComponent(i, k), w = SW.getComponent(i, k); if (w < 0) neg++; if (w > 0 && (j < 0 || j >= 65)) bad++; s += w; if (w > 0) { perBone[j] += w; if (END_BONES.has(names[j])) onEnd++; } }
    if (s < 1e-6) zero++; sumErr = Math.max(sumErr, Math.abs(s - 1));
  }
  if (bad) issues.push(bad + ' índices fora do esqueleto'); if (neg) issues.push(neg + ' pesos negativos'); if (zero) issues.push(zero + ' vértices sem peso');
  if (sumErr > 1e-3) issues.push('pesos não normalizados (desvio ' + sumErr.toFixed(4) + ')'); if (onEnd) issues.push(onEnd + ' pesos em ossos de ponta');
  const fingers = Object.fromEntries(['Left', 'Right'].map(s => [s, names.reduce((a, nm, j) => a + (nm.startsWith(s + 'Hand') && nm !== s + 'Hand' ? perBone[j] : 0), 0)]));
  return { issues, bindErr, vertices: n, maxSumErr: sumErr, fingerWeight: fingers, deformBones: names.filter((_, j) => perBone[j] > 0).length };
}

// desvio da malha no repouso (sem animação) em relação à geometria original/armazenada, em mm
export function restDeviation(root, original) {
  const mesh = meshOf(root), P = skinned(mesh), ref = original || mesh.geometry.attributes.position.array;
  let max = 0, sum = 0; const n = P.length / 3;
  for (let i = 0; i < n; i++) { const d = Math.hypot(P[i * 3] - ref[i * 3], P[i * 3 + 1] - ref[i * 3 + 1], P[i * 3 + 2] - ref[i * 3 + 2]); max = Math.max(max, d); sum += d; }
  return { maxMm: +(max * 1000).toFixed(3), meanMm: +(sum / n * 1000).toFixed(4) };
}

// ---------- deformação ----------
export function edgeData(mesh) {
  const g = mesh.geometry, idx = g.index ? g.index.array : null, n = g.attributes.position.count, P = g.attributes.position.array;
  const SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, names = mesh.skeleton.bones.map(b => b.name.replace('mixamorig', ''));
  const dom = new Int16Array(n); for (let i = 0; i < n; i++) { let bw = -1; for (let k = 0; k < 4; k++) if (SW.getComponent(i, k) > bw) { bw = SW.getComponent(i, k); dom[i] = SI.getComponent(i, k); } }
  const seen = new Set(), A = [], B = [], R = [];
  const tri = idx ? idx.length / 3 : n / 3, at = t => idx ? idx[t] : t;
  for (let t = 0; t < tri; t++) for (const [u, v] of [[0, 1], [1, 2], [2, 0]]) {
    let a = at(t * 3 + u), b = at(t * 3 + v); if (a > b) [a, b] = [b, a]; const key = a * n + b; if (seen.has(key)) continue; seen.add(key);
    const len = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]); if (len < 1e-5) continue;
    A.push(a); B.push(b); R.push(REGION(names[dom[a]] === names[dom[b]] ? names[dom[a]] : (REGION(names[dom[a]]) === 'tronco' ? names[dom[b]] : names[dom[a]])));
  }
  return { A: Int32Array.from(A), B: Int32Array.from(B), R, rest: P };
}
export function strain(edges, P) {
  const by = {};
  for (let e = 0; e < edges.A.length; e++) {
    const a = edges.A[e], b = edges.B[e], r = edges.rest;
    const l0 = Math.hypot(r[a * 3] - r[b * 3], r[a * 3 + 1] - r[b * 3 + 1], r[a * 3 + 2] - r[b * 3 + 2]), l1 = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
    (by[edges.R[e]] ||= []).push(Math.abs(l1 / l0 - 1));
  }
  const out = {};
  for (const [k, v] of Object.entries(by)) { v.sort((a, b) => a - b); out[k] = { p99: +(v[Math.floor(v.length * 0.99)] * 100).toFixed(1), max: +(v[v.length - 1] * 100).toFixed(1) }; }
  return out;
}
// silhueta do tronco no referencial do quadril: largura e profundidade do peito, cintura e quadril, comprimento do pescoço
export function torsoShape(mesh, P) {
  const names = mesh.skeleton.bones.map(b => b.name.replace('mixamorig', '')), g = mesh.geometry, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, n = P.length / 3;
  const hips = mesh.skeleton.bones[names.indexOf('Hips')], inv = hips.matrixWorld.clone().invert(), v = new THREE.Vector3();
  const torsoW = i => { let w = 0; for (let k = 0; k < 4; k++) if (/^(Hips|Spine\d?|Neck)$/.test(names[SI.getComponent(i, k)])) w += SW.getComponent(i, k); return w; };
  const ref = g.attributes.position.array, H = Math.max(...Array.from({ length: n }, (_, i) => ref[i * 3 + 1]));
  const band = (f0, f1) => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < n; i++) { const y = ref[i * 3 + 1] / H; if (y < f0 || y > f1 || torsoW(i) < 0.95) continue; v.fromArray(P, i * 3).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
    return { w: x1 - x0, d: z1 - z0 }; };
  // pontos-guia: queixo (frente do rosto mais baixa) e incisura do esterno (frente do peito mais alta)
  return { peito: band(0.70, 0.73), cintura: band(0.60, 0.63), quadril: band(0.50, 0.53) };
}

export async function auditCharacter(file, sex, { original, clips = [['idle', 0], ['idle', 0.3], ['idle', 0.6], ['walk', 0.25], ['rifle_aim', 0.3], ['crouch', 0.3]] } = {}) {
  const gltf = await loadGLB(file), root = gltf.scene, mesh = meshOf(root);
  const report = { structure: auditStructure(root), rest: restDeviation(root, original) };
  const edges = edgeData(mesh), restP = skinned(mesh), restShape = torsoShape(mesh, restP);
  const shapeDelta = P => { const s = torsoShape(mesh, P), o = {}; for (const k in s) o[k] = { w: +((s[k].w / restShape[k].w - 1) * 100).toFixed(1), d: +((s[k].d / restShape[k].d - 1) * 100).toFixed(1) }; return o; };
  const lib = await library(sex);
  report.clips = {};
  for (const [name, t] of clips) {
    const src = lib.animations.find(c => c.name === name); if (!src) continue;
    const clip = retargetMixamo(src, lib.scene, root), mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play(); mixer.setTime(t * clip.duration); root.updateMatrixWorld(true);
    const P = skinned(mesh); report.clips[name + '@' + t] = { strain: strain(edges, P), shape: shapeDelta(P) };
    mixer.stopAllAction(); mixer.uncacheRoot(root);
  }
  // volta ao repouso e testa poses isoladas
  // repouso vem do bind (o clipe anterior deixou os ossos na última pose)
  const rest = restPose(root), toRest = () => { for (const r of rest.values()) { r.bone.quaternion.copy(r.q); r.bone.position.copy(r.p); } root.updateMatrixWorld(true); };
  report.poses = {};
  for (const pose of Object.values(TEST_POSES)) { toRest(); applyTestPose(root, pose); const P = skinned(mesh); report.poses[pose.label] = { strain: strain(edges, P), shape: shapeDelta(P) }; }
  toRest();
  return report;
}

// ---------- CLI ----------
if (process.argv[1]?.endsWith('rig-audit.mjs')) {
  const args = process.argv.slice(2), roster = JSON.parse(fs.readFileSync('assets/npcs/roster.json', 'utf8'));
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; }, origDir = opt('--orig'), dir = opt('--dir') || 'assets/npcs', asJson = args.includes('--json');
  const ids = args.includes('--all') ? roster.characters.map(c => c.id) : args.filter((a, i) => !a.startsWith('--') && !['--orig', '--dir'].includes(args[i - 1]));
  const all = {};
  for (const id of ids.length ? ids : ['character-principal-base', 'char-principal-base']) {
    const meta = roster.characters.find(c => c.id === id); if (!meta) { console.error('desconhecido: ' + id); continue; }
    let original = null;
    if (origDir) { const o = await loadGLB(origDir + '/' + meta.file); original = meshOf(o.scene).geometry.attributes.position.array; }
    const r = await auditCharacter(dir + '/' + meta.file, meta.sex, { original }); all[id] = r;
    if (asJson) continue;
    console.log('\n=== ' + id + ' (' + meta.sex + ')');
    console.log('estrutura:', r.structure.issues.length ? r.structure.issues.join(' | ') : 'ok', '· bind', r.structure.bindErr.toExponential(1), '· ossos que deformam', r.structure.deformBones, '· peso nos dedos', JSON.stringify(r.structure.fingerWeight, (k, v) => typeof v === 'number' ? +v.toFixed(1) : v));
    console.log('repouso: desvio máx', r.rest.maxMm, 'mm, médio', r.rest.meanMm, 'mm' + (origDir ? ' (vs. original)' : ''));
    for (const [k, v] of Object.entries({ ...r.clips, ...r.poses })) console.log(k.padEnd(26), Object.entries(v.strain).map(([g, s]) => g + ' ' + s.p99 + '/' + s.max + '%').join('  '), '| tronco', JSON.stringify(v.shape));
  }
  if (asJson) console.log(JSON.stringify(all, null, 1));
}
