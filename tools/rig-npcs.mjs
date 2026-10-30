// tools/rig-npcs.mjs — transforma os personagens Tripo (malha única em pose T, sem esqueleto) em GLBs riggados no
// esqueleto Meshy-24 do jogo (o mesmo dos arquivos assets/characters/rigs/reborn), prontos p/ as animações Reborn.
//
// Para cada modelo:
//  1. lê a malha, aplica a transformação do nó e põe na escala real (altura por sexo, com pequena variação);
//  2. mede as articulações na pose T (ombro, cotovelo, punho, quadril, joelho, tornozelo, dedão, pescoço, cabeça);
//  3. monta o esqueleto com as ROTAÇÕES de repouso do esqueleto-modelo (masculino/feminino) e só os comprimentos
//     medidos — assim cada osso tem exatamente os mesmos eixos do modelo e as animações encaixam sem reajuste extra;
//  4. calcula pesos por proximidade aos ossos (com regiões: braço esquerdo só nos ossos do braço esquerdo etc.);
//  5. dobra braços e pernas da pose T para as direções do esqueleto-modelo (pose A) por skinning linear;
//  6. grava o GLB (malha inteira, sem reduzir triângulos — o rosto fica intacto) e o roster com nome e sobrenome.
//
// Uso: node tools/rig-npcs.mjs "<pasta com as subpastas dos NPCs>" [saída=assets/npcs]
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

const SRC = process.argv[2] || 'C:/Users/JyOr/Documents/NPCs City Of God';
const OUT = process.argv[3] || 'assets/npcs';
const MIXAMO = 'assets/characters/rigs/mixamo/';
const ONLY = process.env.ONLY;

// ---------- pastas → grupo, papel no jogo ----------
const GROUPS = {
  'Character Principal Base': { group: 'base', role: 'player' },
  'Gang Last Kings': { group: 'last-kings', role: 'gang' },
  "Gang Noveli's Crew": { group: 'novelis-crew', role: 'gang' },
  'NPCs Urbanos Female': { group: 'urbano', role: 'civil' },
  'NPCs Urbanos Male': { group: 'urbano', role: 'civil' },
  'NPCs Bombeiros': { group: 'bombeiros', role: 'service' },
  'NPCs Socorristas': { group: 'socorristas', role: 'service' },
  'Pilicia City Of God': { group: 'policia', role: 'service' },
  'NPCs Operarios': { group: 'operarios', role: 'worker' },
  'NPCs Motoboy': { group: 'motoboy', role: 'worker' },
};
// sexo conferido nas renderizações (as descrições dos arquivos às vezes erram, ex.: "Roseane ... male")
const FEMALE = new Set(['Char-Principal-Base', 'Debora-Justus', 'Flavia-Nisha', 'Rubia-Snyder', 'Ana-Paula-Novli', 'Carla-Green', 'Roseane-Alencar',
  'Laura-Lisboa', 'Clara-Migos', 'Jussara-Duarte']);
const DISPLAY = { 'Char-Principal-Base': 'Base Feminina', 'Character-Principal-Base': 'Base Masculina', 'Ana-Paula-Novli': 'Ana Paula Novli' };

// ---------- leitura de GLB ----------
const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function readGLB(file) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jl).toString());
  const binStart = 20 + jl + 8, bin = b.subarray(binStart, binStart + b.readUInt32LE(20 + jl));
  const view = i => { const v = json.bufferViews[i]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
  const accessor = i => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView], T = CT[a.componentType], n = NC[a.type];
    const stride = v.byteStride || T.BYTES_PER_ELEMENT * n, raw = view(a.bufferView), out = new T(a.count * n);
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const get = { 5126: (o) => dv.getFloat32(o, true), 5125: (o) => dv.getUint32(o, true), 5123: (o) => dv.getUint16(o, true), 5121: (o) => dv.getUint8(o) }[a.componentType];
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = get((a.byteOffset || 0) + k * stride + c * T.BYTES_PER_ELEMENT);
    return out;
  };
  return { json, view, accessor };
}
const nodeMatrix = n => {
  const m = new THREE.Matrix4();
  if (n.matrix) m.fromArray(n.matrix);
  else m.compose(new THREE.Vector3(...(n.translation || [0, 0, 0])), new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(n.scale || [1, 1, 1])));
  return m;
};

// ---------- esqueleto-modelo: Mixamo (David p/ homens, Megan p/ mulheres), pose T ----------
// O arquivo de rig traz, sob cada osso, nós vazios repetidos (sobras das malhas removidas): fica só a primeira
// ocorrência de cada nome. Internamente os ossos usam os nomes curtos abaixo; no GLB saem com o nome Mixamo original
// (mixamorig...), que é o que as animações de rifle/andar/correr do jogo procuram.
const SHORT = { Spine: 'Spine02', Spine1: 'Spine01', Spine2: 'Spine', Neck: 'neck', HeadTop_End: 'HeadTop', LeftToe_End: 'LeftToeTip', RightToe_End: 'RightToeTip' };
function loadTemplate(sex) {
  const { json } = readGLB(MIXAMO + (sex === 'female' ? 'megan' : 'david') + '.rig.glb'), src = json.nodes;
  const nodes = [], seen = new Set();
  const walk = (i, depth) => {
    const n = src[i], name = n.name;
    if (depth > 1 && (!name || seen.has(name))) return null;          // nó vazio repetido
    if (depth > 0 && name && !name.startsWith('mixamorig')) return null;   // sobras das malhas (Ch28_Body...)
    if (name) seen.add(name);
    const short = depth === 0 ? 'Armature' : name ? (SHORT[name.replace('mixamorig', '')] || name.replace('mixamorig', '')) : null;
    if (!short) { const kids = (n.children || []).map(c => walk(c, depth + 1)).filter(k => k != null); return kids.length === 1 ? kids[0] : null; }
    const k = nodes.push({ name: short, orig: depth === 0 ? 'Armature' : name, translation: n.translation, rotation: n.rotation, scale: n.scale }) - 1;
    const kids = (n.children || []).map(c => walk(c, depth + 1)).filter(c => c != null);
    if (kids.length) nodes[k].children = kids;
    return k;
  };
  const root = walk(json.scenes[0].nodes[0], 0);
  const byName = {}, parent = {};
  nodes.forEach((n, i) => { byName[n.name] = i; (n.children || []).forEach(c => parent[c] = i); });
  return { nodes, byName, parent, joints: nodes.filter((n, i) => i !== root).map(n => n.name), root };
}

// ---------- medição na pose T (metros, Y para cima, frente +Z, esquerda do personagem = +X) ----------
function measure(P, H, idx) {
  const n = P.length / 3, X = i => P[i * 3], Y = i => P[i * 3 + 1], Z = i => P[i * 3 + 2];
  const slice = (y0, y1, f) => { const out = []; for (let i = 0; i < n; i++) { const y = Y(i); if (y >= y0 && y <= y1 && (!f || f(i))) out.push(i); } return out; };
  const mean = (ids, g) => ids.reduce((a, i) => a + g(i), 0) / Math.max(1, ids.length);
  // linha dos braços: vértices bem afastados do tronco
  const armIds = []; for (let i = 0; i < n; i++) if (Math.abs(X(i)) > 0.3 * H) armIds.push(i);
  const armY = mean(armIds, Y), armZ = mean(armIds, Z);
  let tipL = 0, tipR = 0; for (const i of armIds) { tipL = Math.max(tipL, X(i)); tipR = Math.min(tipR, X(i)); }
  // largura do tronco logo abaixo das axilas
  const chest = slice(armY - 0.1 * H, armY - 0.07 * H, i => Math.abs(X(i)) < 0.28 * H);
  let torsoL = 0, torsoR = 0; for (const i of chest) { torsoL = Math.max(torsoL, X(i)); torsoR = Math.min(torsoR, X(i)); }
  // virilha: o vão entre as pernas na linha do meio
  // virilha: desce pela linha do meio (plano x = 0) a partir da cintura até a primeira altura que nenhum
  // triângulo atravessa — é o vão entre as pernas (calça larga ou joelhos juntos não enganam)
  const BIN = 0.003 * H, cover = new Uint8Array(Math.ceil(H / BIN) + 2);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2], xs = [X(a), X(b), X(c)];
    if (Math.min(...xs) > 0 || Math.max(...xs) < 0) continue;
    const y0 = Math.min(Y(a), Y(b), Y(c)), y1 = Math.max(Y(a), Y(b), Y(c));
    for (let k = Math.floor(y0 / BIN); k <= Math.floor(y1 / BIN); k++) cover[k] = 1;
  }
  let crotchY = 0.47 * H;
  for (let k = Math.floor(0.56 * H / BIN); k * BIN > 0.3 * H; k--) if (!cover[k]) { crotchY = (k + 1) * BIN; break; }
  crotchY = Math.min(0.5 * H, Math.max(0.43 * H, crotchY));
  const legX = (y, s) => { const ids = slice(y - 0.012 * H, y + 0.012 * H, i => X(i) * s > 0.01 * H); return [mean(ids, X), mean(ids, Z)]; };
  const midZ = (y) => { const ids = slice(y - 0.01 * H, y + 0.01 * H, i => Math.abs(X(i)) < 0.12 * H); return ids.length ? mean(ids, Z) : 0; };
  const footFront = s => { let z = -1e9; for (const i of slice(0, 0.05 * H, i => X(i) * s > 0)) z = Math.max(z, Z(i)); return z; };
  // axila: indo do meio p/ fora, a altura da seção cai de tronco (alta) p/ braço (fina) — manga larga não engana
  const armpit = s => {
    for (let x = 0.07 * H; x < 0.32 * H; x += 0.004 * H) {
      let lo = 1e9, hi = -1e9;
      for (let i = 0; i < n; i++) { const xx = X(i) * s; if (xx < x - 0.004 * H || xx > x + 0.004 * H) continue; const y = Y(i); if (y < armY - 0.32 * H || y > armY + 0.12 * H) continue; lo = Math.min(lo, y); hi = Math.max(hi, y); }
      if (hi - lo < 0.17 * H) return x;
    }
    return 0.13 * H;
  };
  const pitL = armpit(1), pitR = -armpit(-1);
  // linha do braço em cada ponto (braços em pose T às vezes vêm um pouco p/ frente ou p/ baixo)
  // (centro da seção pelo meio da extensão — a densidade de vértices da frente e das costas não puxa o ponto)
  const armAt = x => { let y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < n; i++) { if (Math.abs(X(i) - x) > 0.006 * H || Math.abs(Y(i) - armY) > 0.08 * H) continue; y0 = Math.min(y0, Y(i)); y1 = Math.max(y1, Y(i)); z0 = Math.min(z0, Z(i)); z1 = Math.max(z1, Z(i)); } return y1 > y0 ? [(y0 + y1) / 2, (z0 + z1) / 2] : [armY, armZ]; };
  return { armY, armZ, tipL, tipR, torsoL, torsoR, pitL, pitR, crotchY, legX, midZ, footFront, armAt };
}

// ---------- pesos por proximidade (pose T) ----------
function segDist(p, a, b) {
  const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

function rigOne(file, meta) {
  const glb = readGLB(file), json = glb.json;
  const meshNodeIdx = json.nodes.findIndex(n => n.mesh != null);
  // transformação acumulada do nó da malha (alguns arquivos vêm em centímetros sob um nó pai)
  const parentOf = {}; json.nodes.forEach((n, i) => (n.children || []).forEach(c => parentOf[c] = i));
  const world = new THREE.Matrix4(); for (let k = meshNodeIdx; k != null; k = parentOf[k]) world.premultiply(nodeMatrix(json.nodes[k]));
  const prim = json.meshes[json.nodes[meshNodeIdx].mesh].primitives[0];
  const P = Float32Array.from(glb.accessor(prim.attributes.POSITION)), N = Float32Array.from(glb.accessor(prim.attributes.NORMAL)), UV = glb.accessor(prim.attributes.TEXCOORD_0);
  const idx = prim.indices != null ? glb.accessor(prim.indices) : null;
  const nv = P.length / 3, v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(world);
  for (let i = 0; i < nv; i++) { v.fromArray(P, i * 3).applyMatrix4(world).toArray(P, i * 3); v.fromArray(N, i * 3).applyMatrix3(nm).normalize().toArray(N, i * 3); }
  // escala real: pés no chão, centrado, altura por sexo
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < nv; i++) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], P[i * 3 + c]); max[c] = Math.max(max[c], P[i * 3 + c]); }
  const H = meta.height, s = H / (max[1] - min[1]), cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
  for (let i = 0; i < nv; i++) { P[i * 3] = (P[i * 3] - cx) * s; P[i * 3 + 1] = (P[i * 3 + 1] - min[1]) * s; P[i * 3 + 2] = (P[i * 3 + 2] - cz) * s; }

  const T = loadTemplate(meta.sex), M = measure(P, H, idx);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  // ---------- articulações medidas (pose T) ----------
  const J = {};
  const upLegY = M.crotchY + 0.035 * H, hipsY = upLegY + 0.052 * H;
  J.Hips = V3(0, hipsY, M.midZ(hipsY));
  const spineY = M.armY - 0.019 * H;
  J.Spine02 = V3(0, hipsY + (spineY - hipsY) / 3, M.midZ(hipsY + (spineY - hipsY) / 3));
  J.Spine01 = V3(0, hipsY + 2 * (spineY - hipsY) / 3, M.midZ(hipsY + 2 * (spineY - hipsY) / 3));
  J.Spine = V3(0, spineY, M.midZ(spineY));
  J.neck = V3(0, M.armY + 0.028 * H, M.midZ(M.armY + 0.028 * H) - 0.005 * H);
  J.Head = V3(0, M.armY + 0.068 * H, J.neck.z + 0.002 * H);
  for (const [side, s, pit, tip] of [['Left', 1, M.pitL, M.tipL], ['Right', -1, M.pitR, M.tipR]]) {
    const sh = pit - s * 0.006 * H, wrist = tip - s * 0.105 * H;   // pivô do ombro: logo acima da axila
    J[side + 'Shoulder'] = V3(s * 0.022 * H, M.armAt(sh)[0] - 0.012 * H, M.midZ(M.armY));
    const at = x => V3(x, ...M.armAt(x)), elbow = sh + (wrist - sh) * 0.53;
    J[side + 'Arm'] = at(sh + s * 0.015 * H).setX(sh);
    J[side + 'ForeArm'] = at(elbow);
    J[side + 'Hand'] = at(wrist);
    J[side + 'HandTip'] = at(tip - s * 0.02 * H).setX(tip);
    const [hx, hz] = M.legX(upLegY - 0.04 * H, s), [kx, kz] = M.legX(0.29 * H, s), [ax, az] = M.legX(0.085 * H, s);
    J[side + 'UpLeg'] = V3(hx, upLegY, hz);
    J[side + 'Leg'] = V3(kx, 0.29 * H, kz);
    J[side + 'Foot'] = V3(ax, 0.082 * H, az - 0.01 * H);
    J[side + 'ToeBase'] = V3(ax + s * 0.008 * H, 0.025 * H, M.footFront(s) - 0.055 * H);
    J[side + 'ToeTip'] = V3(ax + s * 0.01 * H, 0.012 * H, M.footFront(s));
  }

  if (process.env.RIG_DEBUG === meta.id) console.log(JSON.stringify({ H, torsoL: M.torsoL, tipL: M.tipL, armY: M.armY, J: Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v.toArray().map(x => +x.toFixed(3))])) }));
  // ---------- esqueleto final: rotações do modelo, comprimentos medidos ----------
  // espaço da armadura em centímetros (o nó "Armature" do modelo tem escala 0,01)
  const CM = 100, nodes = T.nodes, out = {}, worldQ = {}, worldP = {};
  const childOf = { Hips: 'Spine02', Spine02: 'Spine01', Spine01: 'Spine', Spine: 'neck', neck: 'Head', Head: 'HeadTop',
    LeftShoulder: 'LeftArm', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', LeftHand: 'LeftHandTip',
    RightShoulder: 'RightArm', RightArm: 'RightForeArm', RightForeArm: 'RightHand', RightHand: 'RightHandTip',
    LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase', LeftToeBase: 'LeftToeTip',
    RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase', RightToeBase: 'RightToeTip' };
  J.HeadTop = V3(0, H, J.Head.z);
  const len = (a, b) => J[a].distanceTo(J[b]) * CM, sf = J.Hips.y * CM / T.nodes[T.byName.Hips].translation[1];
  const visit = (i, pq, pp) => {
    const nd = nodes[i], name = nd.name, q = pq.clone().multiply(new THREE.Quaternion(...(nd.rotation || [0, 0, 0, 1])));
    let t = nd.translation ? V3(...nd.translation) : V3(0, 1, 0), p;
    const par = nodes[T.parent[i]]?.name;
    if (name === 'Hips') p = J.Hips.clone().multiplyScalar(CM);
    else if (name === 'LeftShoulder' || name === 'RightShoulder' || name === 'LeftUpLeg' || name === 'RightUpLeg') p = J[name].clone().multiplyScalar(CM);
    // osso medido: mesma direção do modelo (no espaço do pai), comprimento medido nesta malha
    else if (J[par] && J[name]) p = pp.clone().add(t.clone().normalize().applyQuaternion(pq).multiplyScalar(len(par, name)));
    // dedos e pontas sem medida: proporção do modelo
    else p = pp.clone().add(t.clone().multiplyScalar(sf).applyQuaternion(pq));
    // translação local no espaço do pai
    t = p.clone().sub(pp).applyQuaternion(pq.clone().invert());
    out[name] = { t: [t.x, t.y, t.z], r: nd.rotation || [0, 0, 0, 1] };
    worldQ[name] = q; worldP[name] = p;
    for (const c of nd.children || []) visit(c, q, p);
  };
  visit(T.byName.Hips, new THREE.Quaternion(), V3(0, 0, 0));
  // Hips: a translação é a posição absoluta (pai = Armature, sem rotação)
  // posição final (metros) de cada articulação
  const F = {}; for (const k in worldP) F[k] = worldP[k].clone().divideScalar(CM);
  const dirY = name => V3(0, 1, 0).applyQuaternion(worldQ[name]);
  // pontas (filhos sem osso) na pose final: continuam o eixo Y do osso
  for (const [b, tip] of [['LeftHand', 'LeftHandTip'], ['RightHand', 'RightHandTip']]) F[tip] = F[b].clone().add(dirY(b).multiplyScalar(J[b].distanceTo(J[tip])));   // a mão termina nos dedos (sem osso de ponta)

  // ---------- pesos (na pose T) ----------
  const deform = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
    'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
  const seg = b => [J[b], J[childOf[b]]];
  const allowed = (p) => {
    const ax = Math.abs(p.x), side = p.x > 0 ? 'Left' : 'Right', sh = Math.abs(J[side + 'Arm'].x);
    const torsoEdge = side === 'Left' ? M.torsoL : -M.torsoR;
    // braço = tubo em volta da linha do braço (pose T), a partir do ombro: manga larga de terno/jaqueta não fica presa ao tronco
    const tube = Math.hypot(p.y - M.armY, p.z - M.armZ);
    if (ax > sh - 0.012 * H && tube < 0.085 * H) return [side + 'Shoulder', side + 'Arm', side + 'ForeArm', side + 'Hand', 'Spine'];
    if (p.y < M.crotchY) return [side + 'UpLeg', side + 'Leg', side + 'Foot', side + 'ToeBase', 'Hips'];
    if (p.y < upLegY + 0.04 * H) return [side + 'UpLeg', 'Hips', 'Spine02'];
    // tronco: clavícula só no alto do ombro (senão ela arrasta o peito ao mirar); braço só perto da axila
    const set = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head'];
    if (p.y > M.armY - 0.03 * H && ax > 0.04 * H) set.push(side + 'Shoulder');
    if (ax > torsoEdge - 0.03 * H) set.push(side + 'Arm');
    return set;
  };
  const jointIndex = Object.fromEntries(T.joints.map((n, i) => [n, i])), NJ = T.joints.length;
  const dense = new Float32Array(nv * NJ), p = new THREE.Vector3();
  for (let i = 0; i < nv; i++) {
    p.fromArray(P, i * 3);
    const cand = allowed(p).map(b => [b, Math.max(segDist(p, ...seg(b)), 0.006 * H)]).sort((a, b) => a[1] - b[1]).slice(0, 4);
    const ws = cand.map(([, d]) => 1 / d ** 4), sum = ws.reduce((a, b) => a + b, 0);
    cand.forEach(([b], k) => dense[i * NJ + jointIndex[b]] = ws[k] / sum);
  }
  // suavização pela malha (vértices soldados nas costuras de UV): transições macias, sem bordas serrilhadas
  const key = i => Math.round(P[i * 3] * 2000) + ',' + Math.round(P[i * 3 + 1] * 2000) + ',' + Math.round(P[i * 3 + 2] * 2000);
  const weld = new Int32Array(nv), keys = new Map(); for (let i = 0; i < nv; i++) { const k = key(i); if (!keys.has(k)) keys.set(k, keys.size); weld[i] = keys.get(k); }
  const nu = keys.size, nbr = Array.from({ length: nu }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) { const a = weld[idx[t]], b = weld[idx[t + 1]], c = weld[idx[t + 2]]; nbr[a].add(b).add(c); nbr[b].add(a).add(c); nbr[c].add(a).add(b); }
  let U = new Float32Array(nu * NJ), cnt = new Float32Array(nu);
  for (let i = 0; i < nv; i++) { cnt[weld[i]]++; for (let j = 0; j < NJ; j++) U[weld[i] * NJ + j] += dense[i * NJ + j]; }
  for (let u = 0; u < nu; u++) for (let j = 0; j < NJ; j++) U[u * NJ + j] /= cnt[u];
  for (let it = 0; it < 3; it++) {
    const Nn = new Float32Array(nu * NJ);
    for (let u = 0; u < nu; u++) { const ns = nbr[u]; if (!ns.size) { for (let j = 0; j < NJ; j++) Nn[u * NJ + j] = U[u * NJ + j]; continue; }
      for (const o of ns) for (let j = 0; j < NJ; j++) Nn[u * NJ + j] += U[o * NJ + j];
      for (let j = 0; j < NJ; j++) Nn[u * NJ + j] = 0.5 * U[u * NJ + j] + 0.5 * Nn[u * NJ + j] / ns.size; }
    U = Nn;
  }
  const W = new Float32Array(nv * 4), JI = new Uint8Array(nv * 4);
  for (let i = 0; i < nv; i++) {
    const u = weld[i], top = []; for (let j = 0; j < NJ; j++) { const w = U[u * NJ + j]; if (w > 0.02) top.push([j, w]); }
    top.sort((a, b) => b[1] - a[1]); const k4 = top.slice(0, 4), sum = k4.reduce((a, [, w]) => a + w, 0);
    k4.forEach(([j, w], k) => { JI[i * 4 + k] = j; W[i * 4 + k] = w / sum; });
  }

  // ---------- pose T → pose do modelo (A): transformação rígida por osso, misturada pelos pesos ----------
  const xf = {};
  for (const b of deform) {
    const a0 = J[b], a1 = F[b], c0 = J[childOf[b]], c1 = F[childOf[b]];
    const limb = /Arm|ForeArm|Hand|UpLeg|Leg|Foot|Toe/.test(b) && !/Shoulder/.test(b);
    const q = limb ? new THREE.Quaternion().setFromUnitVectors(c0.clone().sub(a0).normalize(), c1.clone().sub(a1).normalize()) : new THREE.Quaternion();
    xf[b] = new THREE.Matrix4().makeTranslation(a1.x, a1.y, a1.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-a0.x, -a0.y, -a0.z));
  }
  const names = T.joints, outP = new Float32Array(nv * 3), outN = new Float32Array(nv * 3), acc = new THREE.Vector3(), accN = new THREE.Vector3(), tmp = new THREE.Vector3(), n3 = new THREE.Vector3();
  for (let i = 0; i < nv; i++) {
    p.fromArray(P, i * 3); n3.fromArray(N, i * 3); acc.set(0, 0, 0); accN.set(0, 0, 0);
    for (let k = 0; k < 4; k++) { const w = W[i * 4 + k]; if (!w) continue; const m = xf[names[JI[i * 4 + k]]]; acc.addScaledVector(tmp.copy(p).applyMatrix4(m), w); accN.addScaledVector(tmp.copy(n3).transformDirection(m), w); }
    acc.toArray(outP, i * 3); accN.normalize().toArray(outN, i * 3);
  }
  // matrizes de bind inversas (espaço da cena: Armature com escala 0,01)
  const S = new THREE.Matrix4().makeScale(0.01, 0.01, 0.01), ibm = new Float32Array(names.length * 16);
  { const miss = names.filter(n => !worldQ[n]); if (miss.length) throw Error('ossos fora da hierarquia: ' + miss.join(','));}
  names.forEach((n, k) => { const m = S.clone().multiply(new THREE.Matrix4().compose(worldP[n], worldQ[n], V3(1, 1, 1))); m.invert().toArray(ibm, k * 16); });
  return { json, glb, prim, P: outP, N: outN, UV, idx, JI, W, out, T, ibm, stats: { tris: (idx ? idx.length : nv) / 3, verts: nv, crotch: +(M.crotchY / H).toFixed(3), arm: +(M.armY / H).toFixed(3) } };
}

// ---------- gravação do GLB ----------
function writeGLB(file, r, meta) {
  const parts = [], views = [], accessors = [];
  const pad4 = n => (n + 3) & ~3;
  let off = 0;
  const addView = (buf, target) => { const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength); views.push({ buffer: 0, byteOffset: off, byteLength: b.length, ...(target ? { target } : {}) }); parts.push(b); const p = pad4(b.length) - b.length; if (p) parts.push(Buffer.alloc(p)); off += pad4(b.length); return views.length - 1; };
  const addAcc = (arr, type, ct, target, minmax) => { const a = { bufferView: addView(arr, target), componentType: ct, count: arr.length / NC[type], type }; if (minmax) { const n = NC[type], mn = Array(n).fill(1e9), mx = Array(n).fill(-1e9); for (let i = 0; i < arr.length; i++) { mn[i % n] = Math.min(mn[i % n], arr[i]); mx[i % n] = Math.max(mx[i % n], arr[i]); } a.min = mn; a.max = mx; } accessors.push(a); return accessors.length - 1; };
  const attrs = { POSITION: addAcc(r.P, 'VEC3', 5126, 34962, true), NORMAL: addAcc(r.N, 'VEC3', 5126, 34962), TEXCOORD_0: addAcc(Float32Array.from(r.UV), 'VEC2', 5126, 34962), JOINTS_0: addAcc(r.JI, 'VEC4', 5121, 34962), WEIGHTS_0: addAcc(r.W, 'VEC4', 5126, 34962) };
  const indices = r.idx ? addAcc(r.P.length / 3 > 65535 ? Uint32Array.from(r.idx) : Uint16Array.from(r.idx), 'SCALAR', r.P.length / 3 > 65535 ? 5125 : 5123, 34963) : undefined;
  const ibmAcc = addAcc(r.ibm, 'MAT4', 5126);
  // imagens/texturas/material do original
  const src = r.json, images = (src.images || []).map(im => ({ mimeType: im.mimeType, bufferView: addView(r.glb.view(im.bufferView)) }));
  const mat = JSON.parse(JSON.stringify(src.materials[r.prim.material || 0]));
  if (mat.extensions) { delete mat.extensions.KHR_materials_volume; if (!Object.keys(mat.extensions).length) delete mat.extensions; }
  mat.name = meta.id;
  // nós: esqueleto (mesma ordem/hierarquia do modelo) + malha
  const T = r.T, nodes = T.nodes.map(n => {
    const o = { name: n.orig || n.name };
    if (r.out[n.name]) { o.translation = r.out[n.name].t; o.rotation = r.out[n.name].r; }
    else { if (n.translation) o.translation = n.translation; if (n.rotation) o.rotation = n.rotation; if (n.scale) o.scale = n.scale; }
    if (n.children) o.children = n.children.slice();
    return o;
  }).filter((_, i) => T.nodes[i].name !== 'char1');
  // índices mudam ao tirar "char1": remapeia
  const map = {}; let k = 0; T.nodes.forEach((n, i) => { if (n.name !== 'char1') map[i] = k++; });
  nodes.forEach(n => { if (n.children) n.children = n.children.map(c => map[c]); });
  const meshNode = nodes.push({ name: meta.id, mesh: 0, skin: 0 }) - 1;
  const rootIdx = map[T.root];
  const exts = new Set(); if (mat.extensions) Object.keys(mat.extensions).forEach(e => exts.add(e));
  const gltf = {
    asset: { version: '2.0', generator: 'City of God rig-npcs (Meshy-24 rest pose)' },
    scene: 0, scenes: [{ name: meta.name, nodes: [rootIdx, meshNode] }], nodes,
    meshes: [{ name: meta.id, primitives: [{ attributes: attrs, ...(indices != null ? { indices } : {}), material: 0 }] }],
    skins: [{ name: 'Armature', joints: T.joints.map(n => map[T.byName[n]]), inverseBindMatrices: ibmAcc, skeleton: map[T.byName.Hips] }],
    materials: [mat], textures: src.textures, samplers: src.samplers, images,
    accessors, bufferViews: views, buffers: [{ byteLength: off }],
    extras: { cityOfGod: { name: meta.name, group: meta.group, role: meta.role, sex: meta.sex, height: meta.height } },
  };
  if (exts.size) gltf.extensionsUsed = [...exts];
  if (!gltf.textures) delete gltf.textures; if (!gltf.samplers) delete gltf.samplers; if (!images.length) delete gltf.images;
  let js = Buffer.from(JSON.stringify(gltf)); js = Buffer.concat([js, Buffer.alloc(pad4(js.length) - js.length, 0x20)]);
  const bin = Buffer.concat(parts), total = 12 + 8 + js.length + 8 + bin.length, head = Buffer.alloc(12);
  head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.write(type, 4); return b; };
  fs.writeFileSync(file, Buffer.concat([head, ch(js.length, 'JSON'), js, ch(bin.length, 'BIN\0'), bin]));
}

// ---------- lote ----------
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
fs.mkdirSync(OUT, { recursive: true });
const roster = [];
for (const dir of fs.readdirSync(SRC)) {
  const g = GROUPS[dir]; if (!g) continue;
  for (const f of fs.readdirSync(path.join(SRC, dir)).filter(f => f.endsWith('.glb')).sort()) {
    const key = f.split(',')[0].trim();                          // "Nome-Sobrenome"
    if (ONLY && !ONLY.split(',').some(o => key.toLowerCase().startsWith(o))) continue;
    const name = DISPLAY[key] || key.replace(/-(?=[A-Z])/g, ' ').replace(/\s+/g, ' ').trim();   // 'Yuki-Soo-jin' → 'Yuki Soo-jin'
    const sex = FEMALE.has(key) || /Female/.test(dir) ? 'female' : 'male';
    const id = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const base = g.group === 'base';
    const height = +((sex === 'female' ? 1.66 : 1.78) + (base ? 0.02 : (hash(id) - 0.5) * 0.08)).toFixed(3);
    const meta = { id, name, group: g.group, role: g.role, sex, height, file: id + '.glb' };
    const r = rigOne(path.join(SRC, dir, f), meta);
    writeGLB(path.join(OUT, meta.file), r, meta);
    roster.push({ ...meta, triangles: Math.round(r.stats.tris), bytes: fs.statSync(path.join(OUT, meta.file)).size, source: dir + '/' + f });
    console.log(meta.id.padEnd(20), meta.sex.padEnd(6), meta.role.padEnd(7), String(height).padEnd(6), Math.round(r.stats.tris), 'tris', JSON.stringify({ crotch: r.stats.crotch, arm: r.stats.arm }));
  }
}
fs.writeFileSync(path.join(OUT, 'roster.json'), JSON.stringify({ schema: 1, rig: 'meshy-24', note: 'Gerado por tools/rig-npcs.mjs a partir dos modelos Tripo (pose T) do autor; triângulos originais preservados.', characters: roster }, null, 1));
console.log(roster.length, 'personagens');
