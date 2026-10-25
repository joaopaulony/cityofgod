// parking.js — vagas e postos do mundo aberto. Três peças, todas presas à grade de ruas (worldgen/roads.js):
//  · vagas paralelas pintadas nas ruas comerciais do centro (rd.park), com carros parados no sentido do tráfego;
//  · estacionamentos de lote (corredor central e vagas a 90° dos dois lados, vaga PcD, batentes, poste);
//  · postos de gasolina nas esquinas de avenida: pátio, cobertura, ilhas com bombas, loja de conveniência e totem
//    de preços. O 3D sai de gas-3d.mjs (world.gasStations); aqui ficam o chão pintado, as colisões e o registro.
// Abastecer: parar o carro ao lado de uma bomba e segurar B (vehicle-webgl.mjs pergunta gasPumpNear()).
'use strict';

const PARK_BAY = 6.2;                       // comprimento da vaga paralela (m), igual às marcas em T do terreno
const GAS_BRANDS = [
  { name: 'SOL', a: '#e5342b', b: '#ffd23f', text: '#ffffff' },
  { name: 'PACIFIC FUEL', a: '#1e5aa8', b: '#f2f2f2', text: '#ffffff' },
  { name: 'GOLDEN GAS', a: '#1d6b3a', b: '#f3c443', text: '#ffffff' },
];

// ---------- vagas paralelas nas ruas comerciais ----------
function parkStreetCars(S, zoneAt) {
  const occ = { brickell: 0.62, southbeach: 0.55, bungalow: 0.4, town: 0.4, poor: 0.5, projects: 0.45, works: 0.3, mansion: 0.2 };
  for (const rd of S.roads) {
    if (!rd.park) continue;
    const lane = ROAD_W + rd.off - rd.park, xing = p => CityStreetLayout.nearOtherRoad(p.x, p.y, rd.bigId, { map: OW.roadHash, cell: OW.RC }, ROAD_W + SIDE + 6.5);
    for (let i = 1; i < rd.pts.length; i++) {
      const p = rd.pts[i], q = rd.pts[i - 1], bay = v => Math.floor((Math.abs(v.x * p.tx + v.y * p.ty) - PARK_BAY / 2 - 0.25) / PARK_BAY);
      if (bay(p) === bay(q) || xing(p)) continue;   // centro de cada vaga (o tracejado em T é contínuo entre setores)
      for (const s of [1, -1]) {
        const x = p.x + p.nx * s * (lane + rd.park / 2), y = p.y + p.ny * s * (lane + rd.park / 2);
        if (x < S.bounds[0] + 2 || y < S.bounds[1] + 2 || x > S.bounds[2] - 2 || y > S.bounds[3] - 2) continue;
        const z = zoneAt(x + p.nx * s * 8, y + p.ny * s * 8); if (!z || rng() > (occ[z] || 0.3)) continue;
        if (world.curbCuts && world.curbCuts.some(c => Math.hypot(c.x - x, c.y - y) < c.r + 2.6)) continue;   // não tapa entrada de garagem
        // mão direita: do lado direito da via o carro aponta no sentido da tangente
        const right = p.nx * s * -p.ty + p.ny * s * p.tx > 0, rot = Math.atan2(p.ty, p.tx) + (right ? 0 : Math.PI) + (rng() - 0.5) * 0.03;
        const car = miaCar(x, y, rot); if (car) car.street = true;   // vaga pintada: a limpeza do setor não tira do asfalto
      }
    }
  }
}

// ---------- estacionamento de lote ----------
function parkingLot(S, c, rects) {
  const W = 18, D = 24, L = miaLot(S, c, rects, W, D, 0.7, 0.8, 0.3, false);
  if (!L) return null;
  rects.push(L.box);
  const n = L.n, t = [-n[1], n[0]], cx = (L.x0 + L.x1) / 2, cy = (L.y0 + L.y1) / 2;
  const ox = cx + n[0] * D / 2, oy = cy + n[1] * D / 2;            // meio da frente (encosta na calçada)
  const P = (u, v) => [ox + t[0] * u - n[0] * v, oy + t[1] * u - n[1] * v];
  const seed = owSeed(S, 'lot' + L.x0 + ',' + L.y0), r = mulberry(seed);
  const stalls = [];
  for (const side of [-1, 1]) for (let k = 0; k < 8; k++) stalls.push({ side, k, pcd: side < 0 && k === 0 });
  const d = { kind: 'parkinglot', ox, oy, tx: t[0], ty: t[1], nx: n[0], ny: n[1], w: W, d: D, stalls, seed, sidewalk: Math.max(SIDE, roadDist(ox, oy) - ROAD_W + 0.05), paint: paintParkingLot };
  const cs = [P(-W / 2, -d.sidewalk - 0.2), P(W / 2, -d.sidewalk - 0.2), P(W / 2, D), P(-W / 2, D)];
  d.bb = [Math.min(...cs.map(p => p[0])), Math.min(...cs.map(p => p[1])), Math.max(...cs.map(p => p[0])), Math.max(...cs.map(p => p[1]))];
  world.decals.push(d);
  (world.paved || (world.paved = [])).push(d.bb);   // sem árvore, arbusto ou flor no asfalto do pátio
  const cut = P(0, -d.sidewalk);
  (world.curbCuts || (world.curbCuts = [])).push({ x: cut[0], y: cut[1], r: 3.6 });
  // carros nas vagas (de frente p/ o muro), poste no fundo e cerca viva nas laterais
  for (const st of stalls) {
    if (st.pcd ? r() > 0.25 : r() > 0.66) continue;
    const [x, y] = P(st.side * 6.1, 2.6 + st.k * 2.6), rot = Math.atan2(t[1] * st.side, t[0] * st.side) + (r() - 0.5) * 0.05;
    miaCar(x + t[0] * st.side * (r() - 0.5) * 0.25, y + t[1] * st.side * (r() - 0.5) * 0.25, rot);
  }
  const lp = P(0, D - 0.6);
  if (!world.blocked(lp[0], lp[1], 0.3)) { world.lamps.push({ x: lp[0], y: lp[1], ax: n[0], ay: n[1] }); owAddCircle({ x: lp[0], y: lp[1], r: 0.12, kind: 'lamp', h: 4 }); }
  const a = P(-W / 2 + 0.3, 1), b = P(-W / 2 + 0.3, D - 0.4), e = P(W / 2 - 0.3, 1), f = P(W / 2 - 0.3, D - 0.4);
  const free = (x, y) => world.blocked(x, y, 0.3); miaHedgeRun(a[0], a[1], b[0], b[1], free, 0.9); miaHedgeRun(e[0], e[1], f[0], f[1], free, 0.9);
  return d;
}
function paintParkingLot(g, d) {
  const r = mulberry(d.seed), W = d.w, D = d.d;
  g.save(); g.transform(d.tx, d.ty, -d.nx, -d.ny, d.ox, d.oy);   // u ao longo da frente, v p/ dentro do lote
  // rampa de concreto cruzando a calçada até o meio-fio rebaixado
  g.fillStyle = '#b9b4aa'; g.fillRect(-3.4, -d.sidewalk, 6.8, d.sidewalk + 0.2);
  g.fillStyle = 'rgba(90,86,80,0.5)'; g.fillRect(-3.4, -d.sidewalk, 0.06, d.sidewalk); g.fillRect(3.34, -d.sidewalk, 0.06, d.sidewalk);
  // asfalto mais novo que o da rua, meio-fio de concreto em volta
  g.fillStyle = '#4f5054'; g.fillRect(-W / 2, 0, W, D);
  for (let k = 0; k < 260; k++) { g.fillStyle = r() < 0.5 ? 'rgba(30,30,32,0.18)' : 'rgba(120,120,120,0.12)'; g.fillRect(-W / 2 + r() * W, r() * D, 0.05 + r() * 0.2, 0.05 + r() * 0.2); }
  g.fillStyle = '#c9c4b8'; g.fillRect(-W / 2, D - 0.3, W, 0.3); g.fillRect(-W / 2, 0, 0.3, D); g.fillRect(W / 2 - 0.3, 0, 0.3, D);
  for (const st of d.stalls) {
    const u0 = st.side < 0 ? -W / 2 + 0.3 : 3.2, u1 = st.side < 0 ? -3.2 : W / 2 - 0.3, v0 = 1.3 + st.k * 2.6;
    if (st.pcd) {
      g.fillStyle = 'rgba(38,98,170,0.85)'; g.fillRect(u0, v0, u1 - u0, 2.6);
      g.save(); g.translate((u0 + u1) / 2, v0 + 1.3); g.rotate(Math.PI / 2 * -st.side); g.fillStyle = 'rgba(245,245,245,0.92)';
      g.beginPath(); g.arc(0, -0.52, 0.13, 0, TAU); g.fill(); g.fillRect(-0.06, -0.36, 0.12, 0.48); g.fillRect(-0.06, 0.06, 0.42, 0.1);
      g.lineWidth = 0.1; g.strokeStyle = 'rgba(245,245,245,0.92)'; g.beginPath(); g.arc(-0.02, 0.3, 0.32, 0.4, TAU - 0.9); g.stroke(); g.restore();
    }
    // linhas brancas de separação e o batente de concreto no fundo da vaga
    g.fillStyle = 'rgba(246,244,236,0.97)';
    g.fillRect(u0, v0 - 0.08, u1 - u0, 0.16); if (st.k === 7) g.fillRect(u0, v0 + 2.52, u1 - u0, 0.16);
    const stop = st.side < 0 ? u0 + 0.55 : u1 - 0.75;
    g.fillStyle = '#bdb8ad'; g.fillRect(stop, v0 + 0.55, 0.2, 1.5); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(stop + 0.2, v0 + 0.55, 0.05, 1.5);
    // mancha de óleo onde o motor fica
    const ou = st.side < 0 ? u0 + 1.5 : u1 - 1.5; g.fillStyle = `rgba(16,15,14,${0.12 + r() * 0.18})`; g.beginPath(); g.ellipse(ou, v0 + 1.3, 0.45 + r() * 0.3, 0.32 + r() * 0.2, r() * 3, 0, TAU); g.fill();
  }
  // setas no corredor (entra e sai), faixa de pedestre até a calçada
  g.fillStyle = 'rgba(238,236,228,0.85)';
  for (const [u, dir] of [[-1.3, 1], [1.3, -1]]) { const v = 9; g.fillRect(u - 0.08, v - 1.6, 0.16, 3.2); g.beginPath(); g.moveTo(u, v + dir * 2.4); g.lineTo(u - 0.38, v + dir * 1.4); g.lineTo(u + 0.38, v + dir * 1.4); g.fill(); }
  g.restore();
}

// ---------- postos de gasolina ----------
// Esquinas escolhidas uma vez para o mapa todo (independe da ordem em que os setores carregam), bem espaçadas.
function gasSites() {
  if (MIA.gasSites) return MIA.gasSites;
  const h = (x, y) => { let k = Math.imul(Math.round(x) * 73856093 ^ Math.round(y) * 19349663, 2654435761) ^ COG.WORLD_SEED; k = Math.imul(k ^ (k >>> 15), 2246822507); return ((k ^ (k >>> 13)) >>> 0) / 4294967296; };
  const cand = (OW.cw.junctions || []).filter(j => j.big >= 1 && (j.n || 0) >= 3 && !j.hw && !j.orla && !j.ap && Math.hypot(j.x - OW.geo.anchors.downtown.x, j.y - OW.geo.anchors.downtown.y) > 260)   // praça central fica livre.map(j => ({ ...j, r: h(j.x, j.y) })).sort((a, b) => a.r - b.r);
  const out = [];
  for (const j of cand) if (!out.some(o => Math.hypot(o.x - j.x, o.y - j.y) < 480)) out.push(j);
  return MIA.gasSites = out;
}
// meia largura da via que passa pelo cruzamento na direção (dx,dy)
function roadHalfAt(x, y, dx, dy) {
  const C = OW.RC, a = OW.roadHash.get(Math.floor(y / C) * 65536 + Math.floor(x / C)) || [];
  for (const s of a) { const L = Math.hypot(s.bx - s.ax, s.by - s.ay) || 1; if (Math.abs(((s.bx - s.ax) * dx + (s.by - s.ay) * dy) / L) > 0.95 && segDist(x, y, s.ax, s.ay, s.bx, s.by) < 1) return ROAD_W + s.off; }
  return 0;
}
function gasStations(S, zoneAt, rects) {
  const [sx0, sy0, sx1, sy1] = S.bounds;
  for (const J of gasSites()) {
    if (J.x < sx0 || J.x >= sx1 || J.y < sy0 || J.y >= sy1) continue;
    const hwH = roadHalfAt(J.x, J.y, 1, 0), hwV = roadHalfAt(J.x, J.y, 0, 1); if (!hwH || !hwV) continue;
    const quads = [[1, 1], [-1, 1], [1, -1], [-1, -1]], k0 = Math.floor(((J.x * 7 + J.y * 3) % 4 + 4) % 4);
    for (let q = 0; q < 4; q++) {
      const [qx, qy] = quads[(k0 + q) % 4], W = 36, D = 30;
      const ox = J.x + qx * (hwV + SIDE + 0.4), oy = J.y + qy * (hwH + SIDE + 0.4);
      const x0 = Math.min(ox, ox + qx * W), x1 = Math.max(ox, ox + qx * W), y0 = Math.min(oy, oy + qy * D), y1 = Math.max(oy, oy + qy * D);
      if (x0 < sx0 + 1 || y0 < sy0 + 1 || x1 > sx1 - 1 || y1 > sy1 - 1) continue;
      if (rects.some(b => x0 < b[2] + 1 && x1 > b[0] - 1 && y0 < b[3] + 1 && y1 > b[1] - 1)) continue;
      const z = zoneAt((x0 + x1) / 2, (y0 + y1) / 2); if (!z || z === 'mansion') continue;
      let ok = true;
      for (let y = y0 + 0.5; y < y1 && ok; y += 1.5) for (let x = x0 + 0.5; x < x1 && ok; x += 1.5) if (roadDist(x, y) < ROAD_W + SIDE + 0.1 || pondVal(x, y) < 1.4) ok = false;
      if (!ok) continue;
      rects.push([x0 - 1, y0 - 1, x1 + 1, y1 + 1]);
      buildGasStation(S, J, ox, oy, qx, qy, W, D, hwH, hwV);
      break;
    }
  }
}
function buildGasStation(S, J, ox, oy, qx, qy, W, D, hwH, hwV) {
  // u: ao longo da avenida horizontal (afastando do cruzamento); v: p/ dentro, afastando da via horizontal
  const P = (u, v) => [ox + qx * u, oy + qy * v], seed = owSeed(S, 'gas' + Math.round(ox) + ',' + Math.round(oy)), r = mulberry(seed);
  const brand = GAS_BRANDS[seed % GAS_BRANDS.length];
  const base = 4.59 + (seed % 37) / 100, prices = [['REGULAR', base], ['PLUS', base + 0.4], ['PREMIUM', base + 0.8], ['DIESEL', base + 0.25]];
  const st = { brand, prices, ox, oy, qx, qy, w: W, d: D, seed, canopy: { u0: 2, u1: 26, v0: 3.5, v1: 15, h: 5.2 }, store: { u0: 6, u1: 30, v0: 21, v1: 29.5, h: 4.4 },
    islands: [5.5, 11.5, 17.5, 23.5].map(u => ({ u, v0: 6.5, v1: 12 })), pumps: [], sign: { u: 1.4, v: 1.4 } };
  const box = (u0, v0, u1, v1, h, kind, extra) => { const a = P(u0, v0), b = P(u1, v1); return addBox(Object.assign({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, w: Math.abs(b[0] - a[0]), d: Math.abs(b[1] - a[1]), h, kind, gas: st, top: '#d8d4cc', side: '#b0aca4' }, extra)); };
  box(st.store.u0, st.store.v0, st.store.u1, st.store.v1, st.store.h, 'gasstore');
  for (const is of st.islands) {
    box(is.u - 0.65, is.v0, is.u + 0.65, is.v1, 0.22, 'gasisland', { solid: true });
    for (const v of [is.v0 + 0.35, is.v1 - 0.65]) box(is.u - 0.18, v, is.u + 0.18, v + 0.3, 5.2, 'gascol');   // colunas da cobertura nas pontas da ilha
    for (const v of [8.2, 10.3]) { box(is.u - 0.3, v - 0.42, is.u + 0.3, v + 0.42, 1.95, 'gaspump'); const p = P(is.u, v); st.pumps.push({ x: p[0], y: p[1], u: is.u, v, n: st.pumps.length + 1 }); }
  }
  const sg = P(st.sign.u, st.sign.v); box(st.sign.u - 0.35, st.sign.v - 1.2, st.sign.u + 0.35, st.sign.v + 1.2, 7.2, 'gassign');
  // calibrador/água e lixeiras junto das ilhas, gelo e gás de cozinha na frente da loja
  box(31.2, 19.2, 32.2, 19.9, 1.5, 'gasair'); box(30.3, 21.6, 31.5, 22.6, 1.3, 'gasice'); box(5.0, 22, 5.8, 23.6, 1.6, 'gaspropane');
  for (const is of st.islands) { const p = P(is.u + 0.95, is.v1 - 0.4); addBox({ x: p[0], y: p[1], w: 0.5, d: 0.5, h: 0.9, kind: 'trashcan', top: '#2d3a2f', side: '#3e4c40' }); }
  // entradas: uma em cada via (meio-fio rebaixado + rampa pintada no chão)
  const eh = P(31, -(SIDE + 0.4)), ev = P(-(SIDE + 0.4), 18);
  st.entries = [{ x: eh[0], y: eh[1], along: [qx, 0] }, { x: ev[0], y: ev[1], along: [0, qy] }];
  (world.curbCuts || (world.curbCuts = [])).push({ x: eh[0], y: eh[1], r: 3.8 }, { x: ev[0], y: ev[1], r: 3.8 });
  // carros abastecendo e um na vaga da loja
  for (const is of st.islands) for (const side of [-1, 1]) if (r() < 0.45) { const p = P(is.u + side * 1.75, 9.25); miaCar(p[0], p[1], Math.atan2(qy, 0) + (r() < 0.5 ? Math.PI : 0)); }
  for (let k = 1; k < 6; k++) if (r() < 0.4) { const p = P(10.85 + k * 2.7, 17.9); miaCar(p[0], p[1], Math.atan2(qy, 0)); }
  const d = { kind: 'gaspad', st, seed, paint: paintGasPad };
  const cs = [P(-SIDE - 1, -SIDE - 1), P(W, D)]; d.bb = [Math.min(cs[0][0], cs[1][0]), Math.min(cs[0][1], cs[1][1]), Math.max(cs[0][0], cs[1][0]), Math.max(cs[0][1], cs[1][1])];
  world.decals.push(d);
  (world.paved || (world.paved = [])).push(d.bb);
  (world.gasStations || (world.gasStations = [])).push(st);
  return st;
}
function paintGasPad(g, d) {
  const st = d.st, r = mulberry(d.seed), W = st.w, D = st.d;
  g.save(); g.transform(st.qx, 0, 0, st.qy, st.ox, st.oy);
  // asfalto do pátio e placa de concreto sob a cobertura (juntas a cada 4 m, manchas de combustível)
  g.fillStyle = '#4c4d51'; g.fillRect(0, 0, W, D);
  for (let k = 0; k < 420; k++) { g.fillStyle = r() < 0.5 ? 'rgba(28,28,30,0.18)' : 'rgba(125,125,125,0.12)'; g.fillRect(r() * W, r() * D, 0.05 + r() * 0.22, 0.05 + r() * 0.22); }
  const C = st.canopy; g.fillStyle = '#b3afa6'; g.fillRect(C.u0 - 1.5, C.v0 - 1, C.u1 - C.u0 + 3, C.v1 - C.v0 + 2);
  g.strokeStyle = 'rgba(80,76,70,0.55)'; g.lineWidth = 0.04;
  for (let u = C.u0 - 1.5; u <= C.u1 + 1.5; u += 4) { g.beginPath(); g.moveTo(u, C.v0 - 1); g.lineTo(u, C.v1 + 1); g.stroke(); }
  for (let v = C.v0 - 1; v <= C.v1 + 1; v += 4) { g.beginPath(); g.moveTo(C.u0 - 1.5, v); g.lineTo(C.u1 + 1.5, v); g.stroke(); }
  for (const is of st.islands) for (const side of [-1, 1]) for (let k = 0; k < 3; k++) { g.fillStyle = `rgba(30,26,20,${0.1 + r() * 0.16})`; g.beginPath(); g.ellipse(is.u + side * (1.4 + r() * 1.2), 7 + r() * 4.5, 0.3 + r() * 0.6, 0.2 + r() * 0.4, r() * 3, 0, TAU); g.fill(); }
  // calçada de concreto da loja, vagas de frente para a loja (com PcD)
  const S2 = st.store; g.fillStyle = '#c4bfb4'; g.fillRect(S2.u0 - 1, S2.v0 - 1.6, S2.u1 - S2.u0 + 2, 1.6);
  g.fillStyle = 'rgba(238,236,228,0.88)';
  for (let k = 0; k <= 6; k++) g.fillRect(9.5 + k * 2.7 - 0.08, 16.2, 0.16, 3.2);
  g.fillStyle = 'rgba(38,98,170,0.85)'; g.fillRect(9.55, 16.2, 2.6, 3.2);
  // tampas dos tanques subterrâneos (enchimento) perto da esquina, setas de circulação e "ENTRADA"
  for (let k = 0; k < 4; k++) { const u = 28 + (k % 2) * 1.4, v = 4 + ((k / 2) | 0) * 1.4; g.fillStyle = ['#e2c13a', '#d23b2f', '#2f6fd2', '#2a9a52'][k]; g.beginPath(); g.arc(u, v, 0.42, 0, TAU); g.fill(); g.fillStyle = '#6a6b6e'; g.beginPath(); g.arc(u, v, 0.3, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(238,236,228,0.85)';
  const arrow = (u, v, du, dv) => { g.save(); g.translate(u, v); g.rotate(Math.atan2(dv, du) + Math.PI / 2); g.fillRect(-0.09, -1.2, 0.18, 2.6); g.beginPath(); g.moveTo(0, -2.1); g.lineTo(-0.42, -1.1); g.lineTo(0.42, -1.1); g.fill(); g.restore(); };
  arrow(31, 9, 0, 1); arrow(31, 17, -1, 0); arrow(3, 18, 1, 0);
  // rampas cruzando a calçada até a rua
  g.fillStyle = '#bab5ab'; g.fillRect(27.6, -SIDE - 0.5, 6.8, SIDE + 0.5); g.fillRect(-SIDE - 0.5, 14.6, SIDE + 0.5, 6.8);
  g.fillStyle = '#c9c4b8'; g.fillRect(0, D - 0.3, W, 0.3); g.fillRect(W - 0.3, 0, 0.3, D);
  g.restore();
}
// bomba mais próxima de (x,y) a até `r` m (o carro para ao lado da ilha)
function gasPumpNear(x, y, r = 3.4) {
  let best = null, bd = r;
  for (const st of world.gasStations || []) for (const p of st.pumps) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = { st, pump: p, d }; } }
  return best;
}
