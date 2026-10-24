// garages.js — garagens anexas às casas do mundo aberto. A garagem é uma ala do mesmo plano arquitetônico da
// casa (architecture-world.js): fica ao lado, com a frente um pouco recuada da fachada, e o architecture-3d.mjs a
// constrói com as mesmas paredes, rodapé, telhado, calhas e cores. Aqui: escolher um lado livre (sem vizinho,
// água, calçada ou lote alheio), traçar a entrada de carro até a rua, criar as paredes de colisão e o portão
// basculante (abre quando o jogador ou o carro chega perto) e marcar o rebaixo do meio-fio.
'use strict';

const GARAGE = { single: [3.7, 6.3], double: [6.5, 6.4], h: 2.75 };
function garageLocal(g, x, y) { return g.house.architecture.toLocal(x, y); }
// (x,y) dentro da garagem ou do corredor da entrada de carro (pad em metros)
function inGarageZone(g, x, y, pad = 0.3) {
  const [u, v] = garageLocal(g, x, y);
  if (u > g.x0 - pad && u < g.x1 + pad && v > g.y0 - pad && v < g.y1 + pad) return true;
  return Math.abs(u - g.cu) < g.driveW / 2 + pad && v >= g.y1 - pad && v <= g.y1 + g.len + pad;
}
function planGarage(H, opt = {}) {
  const A = H.architecture; if (!A || H.garage) return null;
  const cars = opt.cars || 1, [gw, gd] = cars > 1 ? GARAGE.double : GARAGE.single;
  const W = A.width, D = A.depth, P = A.toWorld;
  const cx = (H.x0 + H.x1) / 2, cy = (H.y0 + H.y1) / 2, bounds = opt.bounds, rects = opt.rects || [];
  const others = houses.filter(o => o !== H && Math.abs((o.x0 + o.x1) / 2 - cx) < 50 && Math.abs((o.y0 + o.y1) / 2 - cy) < 50);
  const ownRect = b => cx >= b[0] && cx <= b[2] && cy >= b[1] && cy <= b[3];
  const lots = rects.filter(b => !ownRect(b));
  const inside = (b, x, y, pad) => x > b[0] - pad && x < b[2] + pad && y > b[1] - pad && y < b[3] + pad;
  const blocked = (x, y, pad) => {
    if (bounds && (x < bounds[0] + 0.6 || y < bounds[1] + 0.6 || x > bounds[2] - 0.6 || y > bounds[3] - 0.6)) return true;
    if (pondVal(x, y) < 1.35) return true;
    for (const o of others) { if (inside(o.drawBounds || [o.x0, o.y0, o.x1, o.y1], x, y, pad)) return true; if (o.garage && inside(o.garage.bb, x, y, pad)) return true; }
    return lots.some(b => inside(b, x, y, pad * 0.5 - 0.3));
  };
  const ex = [P(1, 0)[0] - P(0, 0)[0], P(1, 0)[1] - P(0, 0)[1]], ey = [P(0, 1)[0] - P(0, 0)[0], P(0, 1)[1] - P(0, 0)[1]];
  for (const side of (H.seed & 1) ? ['R', 'L'] : ['L', 'R']) {
    const x0 = side === 'L' ? -gw : W, x1 = x0 + gw, cu0 = (x0 + x1) / 2;
    // recua a garagem até sobrar uma vaga inteira (5,6 m) entre o portão e a calçada
    let walk0 = 0; while (walk0 < 20) { const p = P(cu0, D - 0.45 + walk0); if (roadDist(p[0], p[1]) <= ROAD_W + SIDE) break; walk0 += 0.25; }
    const front = D - 0.45 - Math.min(Math.max(0, 5.6 - walk0), D * 0.75), gy0 = front - gd;
    let ok = true;
    for (let i = 0; i <= 5 && ok; i++) for (let j = 0; j <= 6 && ok; j++) {
      const p = P(x0 + (x1 - x0) * i / 5, gy0 + gd * j / 6);
      if (blocked(p[0], p[1], 0.7) || roadDist(p[0], p[1]) < ROAD_W + SIDE + 0.6) ok = false;
    }
    if (!ok) continue;
    // entrada de carro: da porta da garagem reto até a borda do asfalto
    const cu = (x0 + x1) / 2, driveW = gw - 0.5;
    let len = 0, walk = 0, reached = false;
    for (len = 0.5; len < 26; len += 0.25) {
      const p = P(cu, front + len), rd = roadDist(p[0], p[1]);
      if (!walk && rd <= ROAD_W + SIDE) walk = len;
      if (rd <= ROAD_W + 0.05) { reached = true; break; }
      if (rd > ROAD_W + SIDE) for (const du of [-driveW / 2, 0, driveW / 2]) { const q = P(cu + du, front + len); if (blocked(q[0], q[1], 0.15)) { ok = false; break; } }
      if (!ok) break;
    }
    if (!ok || !reached || walk < 1.5) continue;
    const g = { decals: [], house: H, side, x0, x1, y0: gy0, y1: front, h: GARAGE.h, cars, cu, driveW, len, walk, doorW: cars > 1 ? 4.9 : 2.55, doorH: 2.2, own: new Set() };
    const corners = [[x0, gy0], [x1, gy0], [x1, front], [x0, front]].map(c => P(...c));
    g.bb = [Math.min(...corners.map(p => p[0])), Math.min(...corners.map(p => p[1])), Math.max(...corners.map(p => p[0])), Math.max(...corners.map(p => p[1]))];
    g.corners = corners; g.door = P(cu, front); g.n = ey; g.t = ex;
    // paredes de colisão (jogador e carro) e o portão: passa quando abre
    const seg = (a, b, nrm, extra = {}) => { const s = Object.assign({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], nx: nrm[0], ny: nrm[1], h: g.h, ext: true, kind: 'garage', garageOf: H }, extra); world.segs.push(s); g.own.add(s); return s; };
    const neg = v => [-v[0], -v[1]], dl = cu - g.doorW / 2, dr = cu + g.doorW / 2;
    seg(P(x0, gy0), P(x1, gy0), neg(ey)); seg(P(x0, gy0), P(x0, front), neg(ex)); seg(P(x1, gy0), P(x1, front), ex);
    seg(P(x0, front), P(dl, front), ey); seg(P(dr, front), P(x1, front), ey);
    g.seg = seg(P(dl, front), P(dr, front), ey, { door: true, doorAnim: { open: 0, target: 0, manual: true } });
    // piso: concreto da garagem e entrada até a calçada (a calçada segue por cima, como na vida real), mais o rebaixo
    const quad = (u0, v0, u1, v1) => [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
    const deco = (q, kind, extra) => { const xs = q.map(p => p[0]), ys = q.map(p => p[1]); const d = Object.assign({ kind, q, seed: (H.seed * 31 + kind.length) >>> 0, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], paint: paintDecal, ax: ey, origin: P(cu, front) }, extra); g.decals.push(d); g.own.add(d); if (!opt.deferDecals) world.decals.push(d); return d; };
    deco(quad(x0 + 0.09, gy0 + 0.09, x1 - 0.09, front), 'garagefloor', { w: gw - 0.18, len: gd - 0.09 });
    deco(quad(cu - driveW / 2, front, cu + driveW / 2, front + walk + 0.05), opt.pavers ? 'drivepavers' : 'drive', { w: driveW, len: walk });
    const edge = P(cu, front + len);
    (world.curbCuts || (world.curbCuts = [])).push({ x: edge[0], y: edge[1], r: driveW / 2 + 0.5, g });
    H.garage = g; (world.garages || (world.garages = [])).push(g);
    return g;
  }
  return null;
}
// pisos da garagem e da entrada depois do gramado do lote (senão a grama cobre o concreto)
function garagePaint(g) { if (g) for (const d of g.decals) if (!world.decals.includes(d)) world.decals.push(d); }
// tira do caminho o que a casa criou depois de 'snap' (plantas, caixas, cercas, carros, lixo) dentro da garagem
// ou da entrada de carro; os próprios pisos, paredes e portão da garagem ficam
function garageClear(g, snap) {
  if (!g || !snap || typeof OW_TRACK !== 'function') return;
  const pos = o => o && (Number.isFinite(o.x) ? [o.x, o.y] : Number.isFinite(o.x1) ? [(o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2] : null);
  OW_TRACK().forEach(([name, a], i) => {
    if (!['boxes', 'props', 'circles', 'fences', 'segs', 'flowers', 'litter', 'bins'].includes(name)) return;
    let j = snap[i];
    for (let k = snap[i]; k < a.length; k++) {
      const o = a[k], p = pos(o);
      const keep = !p || g.own.has(o) || o.house || (o.kind === 'vehicle') || !inGarageZone(g, p[0], p[1], name === 'boxes' ? 0.5 + Math.max(o.w || 0, o.d || 0) * 0.3 : 0.35);
      if (keep) a[j++] = o;
    }
    a.length = j;
  });
}
// carro guardado (2D; aparece pelo portão aberto) ou estacionado na entrada
function garageCar(g, where, col) {
  const A = g.house.architecture, P = A.toWorld, v = where === 'inside' ? (g.y0 + g.y1) / 2 + 0.2 : g.y1 + Math.min(g.walk - 2.4, 3.2);
  if (where !== 'inside' && g.walk < 5) return null;
  const p = P(g.cu, v), rot = Math.atan2(g.n[1], g.n[0]);
  return addBox({ x: p[0], y: p[1], w: 4.4, d: 1.85, h: 1.5, rot, top: col, side: col, kind: 'parkedcar', col, suv: (g.house.seed % 3) === 0, draw: drawParkedCar, garage: g });
}
