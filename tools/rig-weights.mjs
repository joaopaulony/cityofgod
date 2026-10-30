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
    if (/Shoulder$/.test(b)) f *= smooth(J[b].y - 0.13 * H, J[b].y - 0.07 * H, p.y);       // clavícula: só ombro/peito alto
    if (/(UpLeg|Leg|Foot|Toe)/.test(b)) f *= 1 - smooth(crotch + 0.02 * H, hipY + 0.01 * H, p.y);   // perna: do quadril p/ baixo
    if (b === 'Neck') f *= smooth(neck - 0.045 * H, neck - 0.015 * H, p.y);                // pescoço: não pega o peito
    if (b === 'Head') f *= smooth(neck - 0.005 * H, neck + 0.015 * H, p.y);
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
