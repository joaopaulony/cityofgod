// tools/rig-weights.mjs — limites anatômicos dos pesos de skinning (usado por tools/rig-npcs.mjs e tools/npc-skeleton.mjs).
// Os pesos por difusão de calor (Blender) vazam: o braço puxa o peito/seio, a coxa puxa a barriga, a clavícula chega à
// cintura, o pescoço pega o peito, e um lado do corpo puxa vértices do outro. Aqui cada osso só pode pesar a região
// anatômica dele (com rampas suaves nas bordas); o peso retirado fica com os ossos que restam no vértice e, se não
// sobrar nenhum, com o osso permitido mais próximo. Depois, suavização pela malha só onde houve correção.
//
// Entrada: P (posições na pose T, metros, Y p/ cima, frente +Z, esquerda do personagem = +X), idx (triângulos),
// JI/WT (4 influências por vértice), names (nome curto de cada junta: 'Hips', 'LeftArm'...), J (posição de cada junta).
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function anatomicalMask(J, H) {
  const hipY = J.Hips.y, crotch = Math.min(J.LeftUpLeg.y, J.RightUpLeg.y), neck = J.Neck.y;
  const arm = s => J[s + 'Arm'], sideOf = b => b.startsWith('Left') ? 1 : b.startsWith('Right') ? -1 : 0;
  // fator 0..1 de quanto o osso b pode pesar um vértice em p
  return (b, p) => {
    const s = sideOf(b), ax = Math.abs(p.x);
    let f = 1;
    if (s) f *= smooth(-0.012 * H, 0.004 * H, p.x * s);                                   // nunca o outro lado
    if (/^(Left|Right)(Arm|ForeArm|Hand)/.test(b)) {                                       // braço: do ombro p/ fora
      const A = arm(s > 0 ? 'Left' : 'Right'), top = p.y > A.y - 0.02 * H;
      f *= top ? smooth(Math.abs(A.x) - 0.075 * H, Math.abs(A.x) - 0.03 * H, ax) : smooth(Math.abs(A.x) - 0.045 * H, Math.abs(A.x) - 0.01 * H, ax);
      f *= smooth(A.y - 0.2 * H, A.y - 0.12 * H, p.y);                                      // nada na cintura
    }
    if (/Shoulder$/.test(b)) f *= smooth(J[b].y - 0.13 * H, J[b].y - 0.07 * H, p.y) * (1 - smooth(neck + 0.01 * H, neck + 0.035 * H, p.y));   // clavícula: ombro/peito alto, nunca o pescoço alto nem o rosto
    if (/(UpLeg|Leg|Foot|Toe)/.test(b)) f *= 1 - smooth(crotch + 0.02 * H, hipY + 0.01 * H, p.y);   // perna: do quadril p/ baixo
    if (b === 'Neck') f *= smooth(neck - 0.045 * H, neck - 0.015 * H, p.y);                // pescoço: não pega o peito
    if (b === 'Head') f *= smooth(neck - 0.005 * H, neck + 0.015 * H, p.y);
    if (/^(Hips|Spine|Spine1)$/.test(b)) f *= 1 - smooth(neck - 0.02 * H, neck + 0.01 * H, p.y);   // coluna baixa não puxa pescoço nem rosto
    return f;
  };
}

// welded: índice do vértice soldado (mesma posição) de cada vértice — costuras de UV não viram bordas de peso
export function weldMap(P) {
  const map = new Map(), weld = new Int32Array(P.length / 3);
  for (let i = 0; i < weld.length; i++) { const k = Math.round(P[i * 3] * 5000) + ',' + Math.round(P[i * 3 + 1] * 5000) + ',' + Math.round(P[i * 3 + 2] * 5000); if (!map.has(k)) map.set(k, map.size); weld[i] = map.get(k); }
  return { weld, count: map.size };
}

export function constrainWeights({ P, idx, JI, WT, names, J, H, segments }) {
  const nv = P.length / 3, NJ = names.length, mask = anatomicalMask(J, H), p = { x: 0, y: 0, z: 0 };
  const { weld, count } = weldMap(P);
  // pesos densos por vértice soldado
  const U = new Float32Array(count * NJ), seen = new Uint8Array(count), rep = new Int32Array(count);
  for (let i = 0; i < nv; i++) { const u = weld[i]; if (seen[u]) continue; seen[u] = 1; rep[u] = i; for (let k = 0; k < 4; k++) U[u * NJ + JI[i * 4 + k]] += WT[i * 4 + k]; }
  const F = new Float32Array(count * NJ);   // fator permitido
  const jIdx = Object.fromEntries(names.map((n, k) => [n, k])), hipY = J.Hips.y, crotch = Math.min(J.LeftUpLeg.y, J.RightUpLeg.y) - 0.035 * H;
  const touched = new Uint8Array(count); let moved = 0;
  const segDist = (b) => { const [a, c] = segments(b); const abx = c.x - a.x, aby = c.y - a.y, abz = c.z - a.z, l = abx * abx + aby * aby + abz * abz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l)); return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t, p.z - a.z - abz * t); };
  for (let u = 0; u < count; u++) {
    const i = rep[u]; p.x = P[i * 3]; p.y = P[i * 3 + 1]; p.z = P[i * 3 + 2];
    let before = 0, after = 0;
    for (let j = 0; j < NJ; j++) { const f = mask(names[j], p); F[u * NJ + j] = f; const w = U[u * NJ + j]; if (!w) continue; before += w; U[u * NJ + j] = w * f; after += w * f; }
    if (before - after > 1e-3) { touched[u] = 1; moved += before - after; }
    if (after < 1e-4) {   // nada sobrou: osso permitido mais próximo
      let best = -1, bd = 1e9; for (let j = 0; j < NJ; j++) { if (F[u * NJ + j] < 0.5 || !segments(names[j])) continue; const d = segDist(names[j]); if (d < bd) { bd = d; best = j; } }
      if (best >= 0) U[u * NJ + best] = 1;
    } else if (after < before) for (let j = 0; j < NJ; j++) U[u * NJ + j] /= after;
    // quadril ↔ coxa ao longo da dobra do quadril (na frente, a virilha; atrás, a dobra do glúteo, mais baixa). Substitui
    // o antigo limite fixo de 35% da coxa acima da virilha, que deixava a roupa p/ trás e abria a barra ao dobrar a perna.
    const jH = jIdx.Hips, jL = jIdx.LeftUpLeg, jR = jIdx.RightUpLeg;
    if (jH != null && jL != null && jR != null && p.y > crotch - 0.06 * H && p.y < hipY + 0.03 * H) {
      const t = U[u * NJ + jH] + U[u * NJ + jL] + U[u * NJ + jR];
      if (t > 1e-4) {
        const front = smooth(-0.03 * H, 0.03 * H, p.z - J.Hips.z), top = hipY + (0.012 * front - 0.012 * (1 - front)) * H, bottom = crotch - (0.01 * front + 0.035 * (1 - front)) * H;
        const leg = 1 - smooth(bottom, top, p.y), left = smooth(-0.015 * H, 0.015 * H, p.x);
        U[u * NJ + jH] = t * (1 - leg); U[u * NJ + jL] = t * leg * left; U[u * NJ + jR] = t * leg * (1 - left); touched[u] = 1;
      }
    }
  }
  // vizinhança pela malha (soldada)
  const nb = Array.from({ length: count }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) { const a = weld[idx[t]], b = weld[idx[t + 1]], c = weld[idx[t + 2]]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  // suavização só em volta do que foi corrigido (2 anéis), respeitando a máscara
  let region = new Uint8Array(touched); for (let r = 0; r < 2; r++) { const nx = new Uint8Array(region); for (let u = 0; u < count; u++) if (region[u]) for (const v of nb[u]) nx[v] = 1; region = nx; }
  for (let it = 0; it < 4; it++) {
    const N = new Float32Array(U);
    for (let u = 0; u < count; u++) {
      if (!region[u] || !nb[u].size) continue; let s = 0;
      for (let j = 0; j < NJ; j++) { let a = 0; for (const v of nb[u]) a += U[v * NJ + j]; const w = (0.5 * U[u * NJ + j] + 0.5 * a / nb[u].size) * F[u * NJ + j]; N[u * NJ + j] = w; s += w; }
      if (s > 1e-6) for (let j = 0; j < NJ; j++) N[u * NJ + j] /= s;
      else for (let j = 0; j < NJ; j++) N[u * NJ + j] = U[u * NJ + j];
    }
    U.set(N);
  }
  // de volta às 4 maiores influências, normalizadas
  for (let i = 0; i < nv; i++) {
    const u = weld[i], top = [];
    for (let j = 0; j < NJ; j++) { const w = U[u * NJ + j]; if (w > 0.01) top.push([j, w]); }
    top.sort((a, b) => b[1] - a[1]); top.length = Math.min(4, top.length); const s = top.reduce((a, [, w]) => a + w, 0);
    for (let k = 0; k < 4; k++) { JI[i * 4 + k] = top[k] ? top[k][0] : 0; WT[i * 4 + k] = top[k] ? top[k][1] / s : 0; }
  }
  return { corrected: touched.reduce((a, b) => a + b, 0), movedWeight: +moved.toFixed(1) };
}

// Spine2 / pescoço / cabeça pela altura das articulações medidas (tools/rig-anatomy.mjs). O rosto tem de girar como um
// bloco só com a cabeça — se boca/queixo ficam presos ao pescoço, o rosto "entorta" quando cabeça e pescoço giram
// diferente (caminhada). Então:
//  - acima do pivô da cabeça (que fica na altura do queixo) tudo é cabeça, inclusive o que os pesos de calor tinham
//    deixado no pescoço/peito (bochecha, boca);
//  - logo abaixo, na frente do pescoço, a cabeça desce até debaixo da mandíbula (2–4% da altura abaixo do pivô); atrás
//    (nuca) a divisa fica no pivô — o pescoço continua dobrando;
//  - Spine2 ↔ pescoço na base do pescoço.
// Não depende da medida do queixo (cabelo comprido na frente do pescoço a confundia). anatomy = { neckZ } de measureUpperBody.
export function splitNeckHead({ P, JI, WT, names, J, H, anatomy: { neckZ } }) {
  const jIdx = Object.fromEntries(names.map((n, k) => [n, k])), S2 = jIdx.Spine2, NK = jIdx.Neck, HD = jIdx.Head;
  const lo = J.Neck.y - 0.035 * H, nv = P.length / 3;
  let changed = 0;
  for (let i = 0; i < nv; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; if (y < lo || Math.abs(x) > 0.1 * H) continue;
    const w = new Map(); for (let k = 0; k < 4; k++) { const v = WT[i * 4 + k]; if (v > 0) w.set(JI[i * 4 + k], (w.get(JI[i * 4 + k]) || 0) + v); }
    const front = smooth(neckZ - 0.01 * H, neckZ + 0.01 * H, z), split = J.Head.y - 0.03 * H * front;
    const s2 = smooth(split - 0.01 * H, split + 0.01 * H, y);
    if (y > J.Head.y + 0.01 * H) {   // cabeça: tudo vai p/ ela (inclusive clavícula/coluna que o calor espalhou até aqui)
      w.clear(); w.set(HD, 1);
    } else {
      const t = (w.get(S2) || 0) + (w.get(NK) || 0) + (w.get(HD) || 0); if (t < 1e-4) continue;
      const s1 = smooth(J.Neck.y - 0.02 * H, J.Neck.y + 0.012 * H, y);
      w.set(S2, t * (1 - s1) * (1 - s2)); w.set(NK, t * s1 * (1 - s2)); w.set(HD, t * s2);
    }
    const top = [...w].filter(([, v]) => v > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((a, [, v]) => a + v, 0);
    for (let k = 0; k < 4; k++) { JI[i * 4 + k] = top[k] ? top[k][0] : 0; WT[i * 4 + k] = top[k] ? top[k][1] / sum : 0; }
    changed++;
  }
  return changed;
}

// Ombro: pesos de Spine2 / clavícula (Shoulder) / braço (Arm) refeitos na região do ombro a partir das articulações
// MEDIDAS de cada personagem. Os pesos de calor vieram de um esqueleto em que a clavícula nascia dentro do peito: ela
// ficava com 60–90% da capa do ombro, do peitoral e da axila, e a passagem p/ o braço era uma faixa estreita — o ombro
// virava uma "bola" rígida e o peito acompanhava a clavícula. Aqui:
//  - braço: a capa do deltoide e o tubo do braço, com transição larga em volta da articulação; abaixo dela a divisa
//    vai p/ fora (a lateral do tronco e a axila ficam no tronco);
//  - clavícula: só a faixa de cima (trapézio/acrômio) entre o pescoço e o braço; no peito da frente, só bem no alto
//    (peitoral e seios ficam no tronco);
//  - tronco (Spine2): o resto.
// Fora da região (pescoço, braço adiante, cintura) os pesos não mudam; na borda, mistura gradual; depois suavização
// pela malha. Retorna quantos vértices foram refeitos.
export function shoulderWeights({ P, idx, JI, WT, names, J, H }) {
  const nv = P.length / 3, jIdx = Object.fromEntries(names.map((n, k) => [n, k]));
  const { weld, count } = weldMap(P), rep = new Int32Array(count).fill(-1);
  for (let i = 0; i < nv; i++) if (rep[weld[i]] < 0) rep[weld[i]] = i;
  const target = new Map();   // vértice soldado → {fator da região, pesos novos}
  for (const [side, s] of [['Left', 1], ['Right', -1]]) {
    const A = J[side + 'Arm'], C = J[side + 'Shoulder'], jS2 = jIdx.Spine2, jC = jIdx[side + 'Shoulder'], jA = jIdx[side + 'Arm'];
    if (!A || !C || jS2 == null || jC == null || jA == null) continue;
    const AX = Math.abs(A.x), CX = Math.abs(C.x);
    for (let u = 0; u < count; u++) {
      const i = rep[u], x = P[i * 3] * s, y = P[i * 3 + 1], z = P[i * 3 + 2];
      if (x < 0) continue;
      const du = x - AX, dv = y - A.y;
      // região: do lado de fora do pescoço até um pouco depois da articulação, do peito alto ao alto do ombro
      const f = smooth(CX + 0.01 * H, CX + 0.035 * H, x) * (1 - smooth(AX + 0.045 * H, AX + 0.07 * H, x)) * smooth(-0.14 * H, -0.1 * H, dv) * (1 - smooth(0.05 * H, 0.08 * H, dv));
      if (f < 1e-3) continue;
      const arm = smooth(-0.035 * H, 0.015 * H, du + 0.45 * dv);
      const frontChest = smooth(0.02 * H, 0.05 * H, z - A.z);          // frente do peito (peitoral/seio)
      const top = smooth(-0.06 * H, -0.015 * H, dv) * (1 - frontChest) + smooth(-0.025 * H, 0.005 * H, dv) * frontChest;
      const clav = (1 - arm) * top * smooth(CX + 0.005 * H, CX + 0.035 * H, x);
      const w = {}; w[jA] = arm; w[jC] = clav; w[jS2] = Math.max(0, 1 - arm - clav);
      target.set(u, { f, w });
    }
  }
  // dense das linhas da região: mistura com os pesos atuais na borda
  const rows = new Map();
  for (const [u, { f, w }] of target) {
    const i = rep[u], old = {}; for (let k = 0; k < 4; k++) if (WT[i * 4 + k] > 0) old[JI[i * 4 + k]] = (old[JI[i * 4 + k]] || 0) + WT[i * 4 + k];
    // o que o vértice tinha de braço adiante (antebraço/mão) ou de pescoço/cabeça fica como estava
    const keep = {}; let kept = 0; for (const [j, v] of Object.entries(old)) if (![jIdx.Spine2, jIdx.Spine1, jIdx.LeftShoulder, jIdx.RightShoulder, jIdx.LeftArm, jIdx.RightArm].includes(+j)) { keep[j] = v; kept += v; }
    const row = {}; for (const [j, v] of Object.entries(old)) row[j] = (1 - f) * v;
    for (const [j, v] of Object.entries(w)) row[j] = (row[j] || 0) + f * v * (1 - kept);
    for (const [j, v] of Object.entries(keep)) row[j] = (row[j] || 0) + f * v;
    rows.set(u, row);
  }
  // suavização pela malha (3 passadas) só dentro da região
  const nb = new Map(); for (const u of rows.keys()) nb.set(u, new Set());
  for (let t = 0; t < idx.length; t += 3) { const a = weld[idx[t]], b = weld[idx[t + 1]], c = weld[idx[t + 2]]; for (const [p, q] of [[a, b], [b, c], [c, a]]) { if (nb.has(p) && rows.has(q)) nb.get(p).add(q); if (nb.has(q) && rows.has(p)) nb.get(q).add(p); } }
  for (let it = 0; it < 3; it++) {
    const next = new Map();
    for (const [u, row] of rows) { const ns = nb.get(u); if (!ns.size) { next.set(u, row); continue; } const acc = {}; for (const v of ns) for (const [j, w] of Object.entries(rows.get(v))) acc[j] = (acc[j] || 0) + w / ns.size;
      const r = {}; for (const j of new Set([...Object.keys(row), ...Object.keys(acc)])) r[j] = 0.5 * (row[j] || 0) + 0.5 * (acc[j] || 0); next.set(u, r); }
    for (const [u, r] of next) rows.set(u, r);
  }
  for (let i = 0; i < nv; i++) {
    const row = rows.get(weld[i]); if (!row) continue;
    const top = Object.entries(row).map(([j, v]) => [+j, v]).filter(([, v]) => v > 0.01).sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((a, [, v]) => a + v, 0);
    for (let k = 0; k < 4; k++) { JI[i * 4 + k] = top[k] ? top[k][0] : 0; WT[i * 4 + k] = top[k] ? top[k][1] / sum : 0; }
  }
  return rows.size;
}
