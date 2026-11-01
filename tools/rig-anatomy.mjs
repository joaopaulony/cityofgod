// tools/rig-anatomy.mjs — articulações do tronco alto medidas na própria malha (pose T), compartilhadas por
// tools/rig-npcs.mjs (gera os rigs) e tools/npc-skeleton.mjs (corrige rigs já gerados).
// P: posições (metros, pés em y = 0, Y p/ cima, frente +Z, esquerda do personagem = +X); H: altura.
//
//  - ombro (cabeça do úmero): 0,8% da altura p/ fora do ápice da axila — indo do tronco p/ fora, o ponto em que a borda de baixo da seção para
//    de subir e vira o tubo do braço; altura/profundidade no meio da seção ali. (A versão anterior procurava a queda da
//    altura da seção e, em corpos femininos, parava 5–6 cm p/ fora: o braço dobrava no meio do deltoide.)
//  - pescoço: onde o trapézio termina (a largura da seção cai); cabeça: na base do crânio, na altura do queixo;
//  - clavícula: sai do alto do peito, junto da base do pescoço.
export function measureUpperBody(P, H, { armY, spineZ, armHint }) {   // armHint: {Left, Right} x do ombro anterior (reserva)
  const n = P.length / 3;
  const section = (x0, x1, y0, y1) => { let lo = 1e9, hi = -1e9, z0 = 1e9, z1 = -1e9, c = 0;
    for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1]; if (x < x0 || x > x1 || y < y0 || y > y1) continue; c++; lo = Math.min(lo, y); hi = Math.max(hi, y); z0 = Math.min(z0, P[i * 3 + 2]); z1 = Math.max(z1, P[i * 3 + 2]); }
    return c >= 12 ? { lo, hi, z: (z0 + z1) / 2 } : null; };   // fatias quase vazias (peças soltas, buracos) não contam
  const band = (f0, f1) => { let w = 0, zf = -1e9, zb = 1e9; for (let i = 0; i < n; i++) { const y = P[i * 3 + 1] / H; if (y < f0 || y > f1) continue; const x = Math.abs(P[i * 3]); if (x > 0.13 * H) continue; w = Math.max(w, x); zf = Math.max(zf, P[i * 3 + 2]); zb = Math.min(zb, P[i * 3 + 2]); } return { w: w / H, zf, zb }; };

  const out = {};
  for (const [side, s] of [['Left', 1], ['Right', -1]]) {
    const W = 0.006 * H, at = x => { const a = s > 0 ? x : -x - W; return section(a, a + W, armY - 0.25 * H, armY + 0.1 * H); };
    // borda de baixo do tubo do braço (longe do tronco)
    const tube = []; for (let x = 0.16 * H; x <= 0.2 * H; x += 0.005 * H) { const c = at(x); if (c) tube.push(c.lo); }
    tube.sort((a, b) => a - b); const tubeLo = tube[Math.floor(tube.length / 2)] ?? armY - 0.03 * H;
    // ápice: a borda de baixo chega à do tubo e continua nela nas 3 fatias seguintes com vértices (fatias vazias são
    // puladas; uma fatia isolada não engana); procurado entre 7% e 16% da altura
    const slices = []; for (let x = 0.07 * H; x <= 0.17 * H; x += 0.004 * H) { const c = at(x); if (c) slices.push([x, c]); }
    let apex = null;
    for (let k = 0; k + 3 < slices.length && apex == null; k++) if ([0, 1, 2, 3].every(d => slices[k + d][1].lo >= tubeLo - 0.008 * H)) apex = slices[k][0];
    apex = apex != null && apex <= 0.16 * H ? apex + 0.008 * H : (armHint ? Math.abs(armHint[side]) : 0.12 * H);   // + a cabeça do úmero fica um pouco p/ fora do ápice
    const c = at(apex - 0.008 * H) || at(apex);
    out[side + 'Arm'] = { x: s * apex, y: c ? (c.lo + c.hi) / 2 : armY, z: c ? c.z : spineZ };
  }
  let neckBase = 0.835; for (let f = 0.8; f < 0.9; f += 0.0025) if (band(f, f + 0.005).w < 0.1) { neckBase = f; break; }   // fim do trapézio
  const throat = band(neckBase + 0.01, neckBase + 0.02);
  let chin = neckBase + 0.035; for (let f = neckBase + 0.01; f < 0.92; f += 0.0025) if (band(f, f + 0.005).zf > throat.zf + 0.015 * H) { chin = f; break; }   // queixo: a frente salta
  const neckZ = (throat.zf + throat.zb) / 2, shY = Math.max(out.LeftArm.y, out.RightArm.y);
  out.Neck = { x: 0, y: (neckBase - 0.004) * H, z: (spineZ + neckZ) / 2 };
  out.Head = { x: 0, y: (chin + 0.006) * H, z: neckZ };
  out.HeadTop_End = { x: 0, y: H, z: neckZ };
  for (const [side, s] of [['Left', 1], ['Right', -1]]) out[side + 'Shoulder'] = { x: s * 0.022 * H, y: Math.max(shY + 0.012 * H, out.Neck.y - 0.012 * H), z: (spineZ + neckZ) / 2 };
  return { joints: out, neckBase, chin, neckZ, throat };
}
