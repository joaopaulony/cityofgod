// tools/rig-hands.mjs — dedos medidos na malha (pose T) e pesos por falange, compartilhado por tools/rig-npcs.mjs e
// tools/npc-skeleton.mjs. Antes os 40 ossos dos dedos vinham das proporções do esqueleto-modelo (a ponta do dedo médio
// ficava fora da malha) e não pesavam nada: a mão inteira se movia como um bloco.
//
// Como mede, por mão:
//  1. distância geodésica (pela malha) de cada vértice da mão até o punho;
//  2. árvore de junção: varrendo da maior distância p/ a menor, cada ponta de dedo forma um ramo que só se junta ao
//     resto na membrana entre os dedos; o polegar é o ramo que se junta mais cedo (mais perto do punho);
//  3. em cada dedo: eixo da base (membrana) à ponta; articulações nas proporções das falanges, com a primeira (MCP) um
//     pouco p/ dentro da palma; polegar com a CMC perto do punho;
//  4. pesos: cada vértice do ramo vai p/ a falange em que está (transições suaves); a parte da palma em frente a cada
//     dedo passa aos poucos p/ a 1ª falange; o resto continua na mão.
import { weldMap } from './rig-weights.mjs';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];

export function measureHands({ P, idx, H, hands }) {
  const { weld, count } = weldMap(P), nv = P.length / 3;
  const pos = new Float32Array(count * 3), seen = new Uint8Array(count);
  for (let i = 0; i < nv; i++) { const u = weld[i]; if (seen[u]) continue; seen[u] = 1; pos.set(P.subarray(i * 3, i * 3 + 3), u * 3); }
  const nb = Array.from({ length: count }, () => []);
  for (let t = 0; t < idx.length; t += 3) for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) { const u = weld[idx[t + a]], v = weld[idx[t + b]]; if (u !== v) { nb[u].push(v); nb[v].push(u); } }
  const dist = (u, v) => Math.hypot(pos[u * 3] - pos[v * 3], pos[u * 3 + 1] - pos[v * 3 + 1], pos[u * 3 + 2] - pos[v * 3 + 2]);
  const out = { joints: {}, weights: new Map(), report: {}, specs: {}, dist: {}, hand: {} };   // weights: vértice soldado → {osso: peso do dedo}
  const tp = u => [pos[u * 3], pos[u * 3 + 1], pos[u * 3 + 2]];

  for (const [side, s] of [['Left', 1], ['Right', -1]]) {
    const wrist = hands[side];
    const inHand = u => (pos[u * 3] - wrist.x) * s > -0.005 * H;
    // 1. geodésica a partir do anel do punho
    const d = new Float64Array(count).fill(Infinity), heap = [];
    const push = (u, v) => { d[u] = v; heap.push([v, u]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    for (let u = 0; u < count; u++) if (inHand(u) && Math.abs((pos[u * 3] - wrist.x) * s) < 0.004 * H) push(u, 0);
    while (heap.length) { const [v, u] = pop(); if (v > d[u]) continue; for (const w of nb[u]) { if (!inHand(w)) continue; const nd = v + dist(u, w); if (nd < d[w]) push(w, nd); } }
    const hand = []; for (let u = 0; u < count; u++) if (inHand(u) && d[u] < Infinity) hand.push(u);
    if (hand.length < 200) { out.report[side] = 'mão sem malha suficiente'; continue; }
    // 2. árvore de junção (maior distância primeiro)
    hand.sort((a, b) => d[b] - d[a]);
    const parent = new Map(), tip = new Map(), base = new Map(), members = new Map();
    const find = u => { while (parent.get(u) !== u) { parent.set(u, parent.get(parent.get(u))); u = parent.get(u); } return u; };
    const minLen = 0.012 * H;   // ramos mais curtos que isso são dobras/unhas, não dedos
    const branches = [], taken = new Set();
    for (const u of hand) {
      parent.set(u, u); tip.set(u, u); members.set(u, [u]);
      for (const v of nb[u]) {
        if (!parent.has(v)) continue; const a = find(u), b = find(v); if (a === b) continue;
        // junção de dois ramos: o mais curto (ponta mais perto) termina aqui, se for comprido o bastante
        const ta = tip.get(a), tb = tip.get(b), [keep, end] = d[ta] >= d[tb] ? [a, b] : [b, a];
        const len = d[tip.get(end)] - d[u];
        // só os vértices que ainda não são de outro dedo (um ramo pode carregar dedos que se juntaram a ele antes)
        const own = members.get(end).filter(x => !taken.has(x));
        if (len > minLen && own.length > 30) { branches.push({ tip: tip.get(end), base: d[u], len, verts: own }); own.forEach(x => taken.add(x)); }
        parent.set(end, keep); members.get(keep).push(...members.get(end)); members.delete(end);
      }
    }
    const all = branches.sort((a, b) => b.len - a.len);
    if (all.length < 4) { out.report[side] = 'só ' + all.length + ' dedos separados na malha'; continue; }
    // a ponta mais distante do punho é o dedo médio e ela não forma ramo próprio (é o tronco da árvore): reconstrói
    const mainTip = hand[0], mainVerts = [], branchSet = taken;
    // 5 dedos: os 4 ramos mais compridos + o tronco (se o tronco não estiver entre eles)
    let fingers = all.slice(0, 5);
    if (!fingers.some(b => b.tip === mainTip)) {
      // base do tronco: a maior junção entre os ramos dos dedos
      const b0 = Math.max(...all.slice(0, 4).map(b => b.base));
      for (const u of hand) if (d[u] > b0 && !branchSet.has(u)) mainVerts.push(u);
      fingers = [...all.slice(0, 4), { tip: mainTip, base: b0, len: d[mainTip] - b0, verts: mainVerts }];
    }
    if (fingers.length < 5) { out.report[side] = 'só ' + fingers.length + ' dedos'; continue; }
    // polegar: o ramo que se junta mais cedo (base mais perto do punho)
    fingers.sort((a, b) => a.base - b.base);
    const thumb = fingers[0], rest = fingers.slice(1);
    const centroid = vs => { const c = [0, 0, 0]; for (const u of vs) for (let k = 0; k < 3; k++) c[k] += pos[u * 3 + k]; return c.map(v => v / Math.max(1, vs.length)); };
    // indicador = dedo cuja base fica mais perto da base do polegar; os demais em sequência
    const baseC = f => centroid(f.verts.filter(u => d[u] < f.base + 0.25 * f.len));
    const tb = baseC(thumb), order = [];
    let pool = rest.slice(), cur = tb;
    while (pool.length) { pool.sort((a, b) => { const ca = baseC(a), cb = baseC(b); return Math.hypot(ca[0] - cur[0], ca[1] - cur[1], ca[2] - cur[2]) - Math.hypot(cb[0] - cur[0], cb[1] - cur[1], cb[2] - cur[2]); }); const f = pool.shift(); order.push(f); cur = baseC(f); }
    const named = { Thumb: thumb }; FINGERS.forEach((n, k) => named[n] = order[k]);
    // 3. eixo de cada dedo (da base à ponta) e articulações nas proporções das falanges; a MCP fica dentro da palma
    out.specs[side] = Object.entries(named).map(([name, f]) => {
      const c0 = baseC(f), ct = tp(f.tip), dir = ct.map((v, k) => v - c0[k]), Ln = Math.hypot(...dir), un = dir.map(v => v / Ln);
      const thumbF = name === 'Thumb', back = thumbF ? 0.9 * Ln : 0.3 * Ln;
      out.report[side + name] = { len: +((Ln + back) * 100).toFixed(1), verts: f.verts.length };
      return { name, start: c0.map((v, k) => v - un[k] * back), un, total: Ln + back, fr: thumbF ? [0, 0.4, 0.72, 1] : [0, 0.45, 0.75, 1], verts: f.verts, base: f.base };
    });
    out.dist[side] = d; out.hand[side] = hand;
  }
  // mão em que os dedos não se separam na malha (pontas encostadas): eixos espelhados da outra mão
  for (const [side, other] of [['Left', 'Right'], ['Right', 'Left']]) {
    if (out.specs[side] || !out.specs[other]) continue;
    out.specs[side] = out.specs[other].map(f => ({ ...f, start: [-f.start[0], f.start[1], f.start[2]], un: [-f.un[0], f.un[1], f.un[2]], verts: null }));
    const s = side === 'Left' ? 1 : -1, w = hands[side], hand = [];
    for (let u = 0; u < count; u++) if ((pos[u * 3] - w.x) * s > -0.005 * H) hand.push(u);
    out.hand[side] = hand; out.report[side] = 'eixos espelhados da mão ' + (other === 'Left' ? 'esquerda' : 'direita');
  }
  // articulações e pesos
  for (const [side, specs] of Object.entries(out.specs)) {
    const at = (f, t) => f.start.map((v, k) => v + f.un[k] * f.total * t);
    const tOf = (f, u) => { const p = tp(u); return ((p[0] - f.start[0]) * f.un[0] + (p[1] - f.start[1]) * f.un[1] + (p[2] - f.start[2]) * f.un[2]) / f.total; };
    const offOf = (f, u, t) => { const p = tp(u), a = at(f, Math.min(1, Math.max(0, t))); return Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]); };
    for (const f of specs) f.fr.forEach((t, k) => { const p = at(f, t); out.joints[side + 'Hand' + f.name + (k + 1)] = { x: p[0], y: p[1], z: p[2] }; });
    const member = new Map(); for (const f of specs) if (f.verts) for (const u of f.verts) member.set(u, f);
    const d = out.dist[side], bl = 0.04;
    for (const u of out.hand[side]) {
      // dedo do vértice: o ramo dele; fora de ramo, o eixo mais próximo
      let f = member.get(u), share;
      if (!f) { let best = 1e9; for (const g of specs) { const t = tOf(g, u); if (t < -0.05 || t > 1.05) continue; const o = offOf(g, u, t); if (o < best) { best = o; f = g; } } if (!f) continue;
        const t = tOf(f, u), thumbF = f.name === 'Thumb', r = thumbF ? 0.03 * H : 0.012 * H, o = offOf(f, u, t);
        if (o > r) continue;
        // palma em frente ao dedo: entra aos poucos na 1ª falange; sem ramos medidos (espelhado), o dedo inteiro pelo eixo
        share = (specs[0].verts ? smooth(0, thumbF ? 0.35 : 0.25, t) : smooth(0.05, thumbF ? 0.35 : 0.3, t)) * (1 - smooth(r * 0.6, r, o));
      } else share = d ? smooth(f.base - 0.004 * H, f.base + 0.006 * H, d[u]) * 0.999 + 0.001 : 1;
      const t = tOf(f, u), w2 = smooth(f.fr[1] - bl, f.fr[1] + bl, t), w3 = smooth(f.fr[2] - bl, f.fr[2] + bl, t), bones = [1, 2, 3].map(k => side + 'Hand' + f.name + k);
      const m = out.weights.get(u) || {}; m[bones[0]] = (m[bones[0]] || 0) + share * (1 - w2); m[bones[1]] = (m[bones[1]] || 0) + share * (w2 - w3); m[bones[2]] = (m[bones[2]] || 0) + share * w3; out.weights.set(u, m);
    }
  }
  // limita a soma dos dedos a 1 por vértice
  for (const [u, m] of out.weights) { const s = Object.values(m).reduce((a, b) => a + b, 0); if (s > 1) for (const k in m) m[k] /= s; }
  return { ...out, weld };
}

// aplica os pesos dos dedos sobre os pesos existentes (JI/WT, 4 por vértice): a fração do dedo sai do resto
export function applyFingerWeights({ JI, WT, names, weights, weld }) {
  const jIdx = Object.fromEntries(names.map((n, k) => [n, k])), nv = JI.length / 4;
  for (let i = 0; i < nv; i++) {
    const m = weights.get(weld[i]); if (!m) continue;
    const f = Object.values(m).reduce((a, b) => a + b, 0); if (f < 1e-3) continue;
    const w = new Map(); for (let k = 0; k < 4; k++) if (WT[i * 4 + k] > 0) w.set(JI[i * 4 + k], (w.get(JI[i * 4 + k]) || 0) + WT[i * 4 + k] * (1 - f));
    for (const [b, v] of Object.entries(m)) if (v > 0 && jIdx[b] != null) w.set(jIdx[b], (w.get(jIdx[b]) || 0) + v);
    const top = [...w].filter(([, v]) => v > 0.01).sort((a, b) => b[1] - a[1]).slice(0, 4), s = top.reduce((a, [, v]) => a + v, 0);
    for (let k = 0; k < 4; k++) { JI[i * 4 + k] = top[k] ? top[k][0] : 0; WT[i * 4 + k] = top[k] ? top[k][1] / s : 0; }
  }
}
