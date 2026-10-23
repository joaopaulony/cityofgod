// worldgen/roads.js — malha viária orgânica (nível 1) e marcos da cidade.
// Rodovias e ferrovia: menor custo (A*) sobre um mapa de custos (evita mar, floresta, favela; cruza rio
// com ponte; reaproveita troncos já traçados) + suavização Catmull-Rom. Centro: anéis e radiais tortas.
'use strict';
(function (G) {
  const COG = G.COG = G.COG || {};
  const D = () => COG.D;

  // ---------- fila de prioridade (heap binário) ----------
  function Heap() { this.k = []; this.v = []; }
  Heap.prototype.push = function (key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  };
  Heap.prototype.pop = function () {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < k.length && k[l] < k[m]) m = l; if (r < k.length && k[r] < k[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; }
    }
    return top;
  };
  Heap.prototype.size = function () { return this.k.length; };

  // ---------- A* numa grade de custos ----------
  function astar(grid, nx, ny, sx, sy, tx, ty, minCost) {
    const N = nx * ny, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const s = sy * nx + sx, t = ty * nx + tx, h = (i, j) => Math.hypot(i - tx, j - ty) * minCost;
    const open = new Heap(); g[s] = 0; open.push(h(sx, sy), s);
    const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (open.size()) {
      const c = open.pop(); if (c === t) break; if (closed[c]) continue; closed[c] = 1;
      const ci = c % nx, cj = (c / nx) | 0;
      for (const [di, dj, w] of NB) {
        const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const n = j * nx + i, cost = grid[n]; if (!isFinite(cost) || closed[n]) continue;
        const ng = g[c] + w * (cost + grid[c]) / 2;
        if (ng < g[n]) { g[n] = ng; from[n] = c; open.push(ng + h(i, j), n); }
      }
    }
    if (from[t] < 0 && s !== t) return null;
    const path = []; for (let c = t; c >= 0; c = from[c]) { path.push(c); if (c === s) break; }
    return path.reverse();
  }

  // ---------- suavização ----------
  function catmull(ctrl, step) {
    const out = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(ctrl[ctrl.length - 1].slice());
    return out;
  }
  COG.catmull = catmull;
  // reduz o caminho em grade a pontos de controle (um a cada `every` células) e suaviza
  function smoothPath(cells, nx, cs, every, step) {
    const pts = cells.map(c => [(c % nx) * cs + cs / 2, ((c / nx) | 0) * cs + cs / 2]);
    const ctrl = pts.filter((_, i) => i % every === 0 || i === pts.length - 1);
    return catmull(ctrl, step);
  }

  // corta uma polilinha onde ela entra no mar (ou falha no teste), devolvendo os trechos válidos
  function clipPoly(pts, ok, minLen = 3) {
    const out = []; let cur = [];
    for (const p of pts) { if (ok(p[0], p[1])) cur.push(p); else { if (cur.length >= minLen) out.push(cur); cur = []; } }
    if (cur.length >= minLen) out.push(cur);
    return out;
  }

  COG.ROAD = { highway: { w: 16, name: 'rodovia' }, avenue: { w: 11, name: 'avenida' }, street: { w: 7, name: 'rua' }, rail: { w: 5, name: 'ferrovia' } };

  COG.buildRoads = function (geo) {
    const { W, H } = geo, A = geo.anchors, Dd = D(), r = COG.rng(geo.seed + 101), N = COG.makeNoise(geo.seed + 102);
    const CS = 40, nx = W / CS, ny = H / CS, roads = [];
    const sample = (i, j) => geo.districtAt(i * CS + CS / 2, j * CS + CS / 2);
    const baseCost = (mode) => {
      const grid = new Float32Array(nx * ny);
      const tbl = mode === 'rail'
        ? { [Dd.SEA]: Infinity, [Dd.RIVER]: 40, [Dd.AIRPORT]: Infinity, [Dd.DOWNTOWN]: 25, [Dd.FAVELA]: 30, [Dd.URBAN]: 6, [Dd.TOWN]: 8, [Dd.FOREST]: 2.2, [Dd.BEACH]: 20, [Dd.GHETTO]: 8 }
        : { [Dd.SEA]: Infinity, [Dd.RIVER]: 28, [Dd.AIRPORT]: Infinity, [Dd.FOREST]: 3.6, [Dd.FAVELA]: 7, [Dd.GHETTO]: 3, [Dd.BEACH]: 5, [Dd.DOWNTOWN]: 1.6, [Dd.PORT]: 1.6 };
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const d = sample(i, j), c = tbl[d] ?? 1.1;
        // ruído de custo: as estradas serpenteiam de forma orgânica em vez de seguirem retas
        grid[j * nx + i] = c * (0.75 + N(i * 0.06, j * 0.06) * 0.8);
      }
      return grid;
    };
    const toCell = (x, y) => [COG.clamp(Math.floor(x / CS), 0, nx - 1), COG.clamp(Math.floor(y / CS), 0, ny - 1)];
    // libera a área de chegada (ex.: terminal do aeroporto dentro de zona proibida)
    const openAround = (grid, x, y, rad, val) => { const [ci, cj] = toCell(x, y), R = Math.ceil(rad / CS); for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) if (i >= 0 && j >= 0 && i < nx && j < ny && !isFinite(grid[j * nx + i]) && geo.isLand(i * CS, j * CS)) grid[j * nx + i] = val; };

    // ---------- rodovias: nós principais ligados por árvore geradora mínima + atalhos ----------
    const apGate = ap => ({ x: ap.x - Math.sin(ap.ang) * (ap.apron + 52), y: ap.y + Math.cos(ap.ang) * (ap.apron + 52) });   // meio-fio do terminal
    const nodes = [
      { ...A.downtown, k: 'centro' }, { ...A.port, k: 'porto' }, ...A.industrial.map((a, i) => ({ ...a, k: 'industrial' + i })),
      ...A.towns.map(a => ({ ...a, k: a.name })), ...A.airports.map(a => ({ ...apGate(a), k: a.name })), ...A.ghettos.map((a, i) => ({ ...a, k: 'conjunto' + i })),
    ].filter(n => geo.isLand(n.x, n.y));
    // árvore geradora mínima (Prim) por distância euclidiana
    const inT = [0], edges = [], used = new Set([0]);
    while (inT.length < nodes.length) {
      let best = null;
      for (const a of inT) for (let b = 0; b < nodes.length; b++) if (!used.has(b)) { const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y); if (!best || d < best[2]) best = [a, b, d]; }
      edges.push(best); used.add(best[1]); inT.push(best[1]);
    }
    // atalhos: cria anéis (mais de um caminho entre regiões, como numa cidade real)
    const extra = [];
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      if (edges.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) continue;
      const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y); if (d < 1500) extra.push([a, b, d]);
    }
    extra.sort((p, q) => p[2] - q[2]);
    edges.push(...extra.slice(0, 3));
    const hwGrid = baseCost('road'), minCost = 0.55 * 0.75;
    for (const [a, b] of edges) {
      const na = nodes[a], nb = nodes[b];
      openAround(hwGrid, na.x, na.y, 160, 1.5); openAround(hwGrid, nb.x, nb.y, 160, 1.5);
      const [sx, sy] = toCell(na.x, na.y), [tx, ty] = toCell(nb.x, nb.y);
      const path = astar(hwGrid, nx, ny, sx, sy, tx, ty, minCost);
      if (!path || path.length < 3) continue;
      for (const c of path) hwGrid[c] = Math.min(hwGrid[c], 0.55);   // troncos: a próxima rodovia tende a reaproveitar
      roads.push({ cls: 'highway', pts: smoothPath(path, nx, CS, 4, 12), from: na.k, to: nb.k });
    }

    // ---------- centro: anéis deformados + radiais tortas ----------
    const dc = A.downtown, okUrban = (x, y) => geo.isLand(x, y) && geo.districtAt(x, y) !== Dd.RIVER && geo.coastDist(x, y) > 40;
    for (const [rad, cls] of [[210, 'avenue'], [440, 'avenue'], [740, 'avenue']]) {
      const ring = [];
      for (let k = 0; k <= 64; k++) { const a = k / 64 * Math.PI * 2, rr = rad * (0.82 + N(Math.cos(a) * 1.3 + rad, Math.sin(a) * 1.3) * 0.36); ring.push([dc.x + Math.cos(a) * rr * 1.15, dc.y + Math.sin(a) * rr * 0.92]); }
      for (const seg of clipPoly(catmull(ring, 12), okUrban, 8)) roads.push({ cls, pts: seg, ring: rad });
    }
    const nRad = 9;
    for (let k = 0; k < nRad; k++) {
      let a = (k / nRad) * Math.PI * 2 + r() * 0.3, x = dc.x, y = dc.y; const pts = [[x, y]];
      for (let s = 0; s < 34; s++) { a += (N(k * 3.1, s * 0.12) - 0.5) * 0.18; x += Math.cos(a) * 30; y += Math.sin(a) * 30; pts.push([x, y]); }
      for (const seg of clipPoly(catmull(pts, 12), okUrban, 8)) roads.push({ cls: 'avenue', pts: seg, radial: k });
    }
    // avenida beira-mar seguindo a baía e a costa urbana
    const orla = [];
    for (let k = 0; k <= 90; k++) {
      const a = Math.PI * (0.92 + k / 90 * 1.16), bx = geo.bay.x, by = geo.bay.y;
      let lo = 0, hi = 2400;
      for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2, x = bx + Math.cos(a) * m, y = by + Math.sin(a) * m; geo.landField(x, y) > 110 ? hi = m : lo = m; }
      orla.push([bx + Math.cos(a) * hi, by + Math.sin(a) * hi]);
    }
    for (const seg of clipPoly(catmull(orla, 12), (x, y) => geo.isLand(x, y) && geo.districtAt(x, y) !== Dd.PORT, 8)) roads.push({ cls: 'avenue', pts: seg, orla: 1 });

    // ---------- bairros e vilas: ruas irregulares ligando nós espalhados (sem quadriculado) ----------
    const streetNodes = [];
    for (let y = 50; y < H; y += 190) for (let x = 50; x < W; x += 190) {
      const px = x + (r() - 0.5) * 170, py = y + (r() - 0.5) * 170, d = geo.districtAt(px, py);
      if ([Dd.URBAN, Dd.TOWN, Dd.GHETTO, Dd.INDUSTRIAL, Dd.DOWNTOWN].includes(d)) streetNodes.push([px, py, d]);
    }
    const linked = new Set();
    for (let a = 0; a < streetNodes.length; a++) {
      const near = streetNodes.map((p, b) => [b, Math.hypot(p[0] - streetNodes[a][0], p[1] - streetNodes[a][1])]).filter(([b, d]) => b !== a && d < 300).sort((p, q) => p[1] - q[1]).slice(0, 3);
      for (const [b] of near) {
        const key = a < b ? a + ',' + b : b + ',' + a; if (linked.has(key)) continue; linked.add(key);
        const [ax, ay] = streetNodes[a], [bx, by] = streetNodes[b], mx = (ax + bx) / 2, my = (ay + by) / 2, l = Math.hypot(bx - ax, by - ay);
        const bend = (N(mx * 0.01, my * 0.01) - 0.5) * l * 0.45;   // curva lateral orgânica
        const ctrl = [[ax, ay], [mx - (by - ay) / l * bend, my + (bx - ax) / l * bend], [bx, by]];
        for (const seg of clipPoly(catmull(ctrl, 10), okUrban, 4)) roads.push({ cls: 'street', pts: seg });
      }
    }

    // ---------- ferrovia: porto -> indústrias -> saída oeste ----------
    const rail = baseCost('rail'), railStops = [A.port, ...A.industrial.slice().sort((p, q) => q.x - p.x), { x: A.downtown.x - 500, y: A.downtown.y - 200 }];
    for (let k = 0; k < railStops.length - 1; k++) {
      const a = railStops[k], b = railStops[k + 1];
      openAround(rail, a.x, a.y, 200, 1.5); openAround(rail, b.x, b.y, 200, 1.5);
      const [sx, sy] = toCell(a.x, a.y), [tx, ty] = toCell(b.x, b.y), p = astar(rail, nx, ny, sx, sy, tx, ty, 0.75);
      if (p && p.length > 2) roads.push({ cls: 'rail', pts: smoothPath(p, nx, CS, 6, 15) });
    }

    // ---------- pontes: trechos de via sobre rio ou mar raso ----------
    // amostra cada trecho a cada 4 m: rios estreitos não escapam entre dois pontos da via
    const wetAt = (x, y) => !geo.isLand(x, y) || geo.districtAt(x, y) === Dd.RIVER;
    const wetSeg = (p, q) => { const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 4)); for (let k = 0; k <= n; k++) if (wetAt(p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n)) return true; return false; };
    for (const rd of roads) {
      rd.bridges = [];
      let start = -1;
      rd.pts.forEach((p, i) => {
        const wet = wetAt(p[0], p[1]) || (i > 0 && wetSeg(rd.pts[i - 1], p));
        if (wet && start < 0) start = i;
        if (!wet && start >= 0) { rd.bridges.push([Math.max(0, start - 1), i]); start = -1; }
      });
      rd.w = COG.ROAD[rd.cls].w;
    }
    return roads;
  };

  // ---------- marcos: posicionados por regra no distrito certo, perto do ponto preferido ----------
  COG.buildLandmarks = function (geo, roads) {
    const A = geo.anchors, Dd = D(), out = [];
    const place = (name, kind, px, py, okDist, r, minSep = 120) => {
      let best = null, bd = 1e18;
      for (let y = py - 900; y <= py + 900; y += 20) for (let x = px - 900; x <= px + 900; x += 20) {
        if (!okDist.includes(geo.districtAt(x, y))) continue;
        if (out.some(o => Math.hypot(o.x - x, o.y - y) < minSep + o.r + r)) continue;
        const d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = [x, y]; }
      }
      if (best) out.push({ name, kind, x: best[0], y: best[1], r });
    };
    const dc = A.downtown;
    place('Prefeitura e Praça Central', 'cityhall', dc.x, dc.y, [Dd.DOWNTOWN], 70, 0);
    place('Catedral', 'church', dc.x + 170, dc.y - 80, [Dd.DOWNTOWN], 45);
    place('Mercado Municipal', 'market', dc.x - 180, dc.y + 60, [Dd.DOWNTOWN], 50);
    place('Delegacia Central', 'police', dc.x + 120, dc.y + 170, [Dd.DOWNTOWN, Dd.URBAN], 35);
    place('Hospital Geral', 'hospital', dc.x - 440, dc.y - 240, [Dd.URBAN, Dd.DOWNTOWN], 80);
    place('Estádio Municipal', 'stadium', dc.x + 560, dc.y - 440, [Dd.URBAN], 150);
    place('Shopping', 'mall', dc.x - 680, dc.y - 120, [Dd.URBAN], 110);
    place('Universidade', 'university', dc.x - 200, dc.y - 740, [Dd.URBAN], 140);
    place('Rodoviária', 'bus', dc.x + 320, dc.y - 560, [Dd.URBAN], 70);
    place('Terminal Portuário', 'port', A.port.x, A.port.y, [Dd.PORT], 120);
    // farol na ponta mais ao mar da baía
    let tip = null; for (let a = 0; a < Math.PI * 2; a += 0.05) for (let m = geo.bay.r + 300; m > 0; m -= 20) { const x = geo.bay.x + Math.cos(a) * m * 1.35, y = geo.bay.y + Math.sin(a) * m; if (geo.isLand(x, y) && geo.coastDist(x, y) < 30 && y > geo.bay.y && (!tip || y > tip[1])) { tip = [x, y]; break; } }
    if (tip) out.push({ name: 'Farol da Baía', kind: 'lighthouse', x: tip[0], y: tip[1], r: 15 });
    for (const t of A.towns) place('Igreja de ' + t.name, 'church', t.x, t.y, [Dd.TOWN], 25, 40);
    for (const ap of A.airports) out.push({ name: ap.name, kind: 'airport', x: ap.x, y: ap.y, r: ap.len / 2 });
    return out;
  };

  // ---------- mundo completo (nível 1) ----------
  COG.buildWorld = function (seed = COG.WORLD_SEED) {
    const t0 = Date.now(), geo = COG.buildGeo(seed), t1 = Date.now(), roads = COG.buildRoads(geo), t2 = Date.now(), landmarks = COG.buildLandmarks(geo, roads);
    const t3 = Date.now();
    return { seed, geo, roads, landmarks, timing: { geo: t1 - t0, roads: t2 - t1, landmarks: t3 - t2, total: t3 - t0 } };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = COG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
