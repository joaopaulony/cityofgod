// worldgen/roads.js — malha viária (nível 1) e marcos da cidade.
// Cidade: grade reta estilo Los Angeles (quadras de 150×90 m, avenidas de 4 faixas a cada 4–5 quadras, ruas
// locais de 2 faixas) mais a avenida beira-mar curva. Rodovias e ferrovia: menor custo (A*) sobre um mapa de
// custos (evita mar, floresta, favela e a própria cidade; cruza rio com ponte) + suavização Catmull-Rom.
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

  // larguras totais do asfalto (m). Rua local: 1 faixa de 3,3 m por sentido. Rua comercial do centro: a mesma
  // pista + faixa de estacionamento paralelo pintada dos dois lados (park). Avenida: 2 faixas por sentido.
  COG.ROAD = { highway: { w: 14, lanes: 2, name: 'rodovia' }, avenue: { w: 13, lanes: 2, name: 'avenida' }, street: { w: 6.6, lanes: 1, name: 'rua' }, rail: { w: 5, name: 'ferrovia' } };
  COG.ROAD_PARK = 2.2;

  COG.buildRoads = function (geo) {
    const { W, H } = geo, A = geo.anchors, Dd = D(), r = COG.rng(geo.seed + 101), N = COG.makeNoise(geo.seed + 102);
    const CS = 40, nx = W / CS, ny = H / CS, roads = [], junctions = [];
    const sample = (i, j) => geo.districtAt(i * CS + CS / 2, j * CS + CS / 2);
    const baseCost = (mode) => {
      const grid = new Float32Array(nx * ny);
      const tbl = mode === 'rail'
        ? { [Dd.SEA]: Infinity, [Dd.RIVER]: 40, [Dd.AIRPORT]: Infinity, [Dd.DOWNTOWN]: 25, [Dd.FAVELA]: 30, [Dd.URBAN]: 6, [Dd.TOWN]: 8, [Dd.FOREST]: 2.2, [Dd.BEACH]: 20, [Dd.GHETTO]: 8 }
        // rodovia contorna a malha urbana (a cidade já tem a grade de avenidas) e entra só pelo portão
        : { [Dd.SEA]: Infinity, [Dd.RIVER]: 28, [Dd.AIRPORT]: Infinity, [Dd.FOREST]: 3.2, [Dd.FAVELA]: 9, [Dd.GHETTO]: 7, [Dd.BEACH]: 5, [Dd.DOWNTOWN]: 9, [Dd.URBAN]: 6, [Dd.TOWN]: 6, [Dd.INDUSTRIAL]: 5, [Dd.PORT]: 2 };
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const d = sample(i, j), c = tbl[d] ?? 1.1;
        // ruído suave: rodovias fazem curvas largas pela serra e pelo campo, sem zigue-zague
        grid[j * nx + i] = c * (0.85 + N(i * 0.04, j * 0.04) * 0.4);
      }
      return grid;
    };
    const toCell = (x, y) => [COG.clamp(Math.floor(x / CS), 0, nx - 1), COG.clamp(Math.floor(y / CS), 0, ny - 1)];
    // libera a área de chegada (ex.: terminal do aeroporto dentro de zona proibida)
    const openAround = (grid, x, y, rad, val) => { const [ci, cj] = toCell(x, y), R = Math.ceil(rad / CS); for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) if (i >= 0 && j >= 0 && i < nx && j < ny && (!isFinite(grid[j * nx + i]) || grid[j * nx + i] > val) && geo.isLand(i * CS, j * CS)) grid[j * nx + i] = val; };

    // ---------- avenida beira-mar (a única via curva da cidade): acompanha a baía ----------
    const orla = [];
    for (let k = 0; k <= 90; k++) {
      const a = Math.PI * (0.92 + k / 90 * 1.16), bx = geo.bay.x, by = geo.bay.y;
      let lo = 0, hi = 2400;
      for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2, x = bx + Math.cos(a) * m, y = by + Math.sin(a) * m; geo.landField(x, y) > 110 ? hi = m : lo = m; }
      // só o contorno da própria baía: um raio que escapa p/ outra costa distante viraria uma reta falsa
      orla.push(hi < geo.bay.r * 1.75 ? [bx + Math.cos(a) * hi, by + Math.sin(a) * hi] : null);
    }
    const orlaSegs = [], orlaRuns = [[]];
    for (const p of orla) { if (p) orlaRuns[orlaRuns.length - 1].push(p); else if (orlaRuns[orlaRuns.length - 1].length) orlaRuns.push([]); }
    const longest = orlaRuns.reduce((a, b) => b.length > a.length ? b : a, []);
    for (const seg of longest.length > 6 ? clipPoly(catmull(longest.filter((_, i) => i % 3 === 0 || i === longest.length - 1), 12), (x, y) => geo.isLand(x, y) && geo.districtAt(x, y) !== Dd.PORT, 8) : []) { roads.push({ cls: 'avenue', pts: seg, orla: 1 }); orlaSegs.push(seg); }
    const orlaDist = (x, y) => {
      let best = 1e9;
      for (const seg of orlaSegs) for (let i = 0; i < seg.length - 1; i++) {
        const [ax, ay] = seg[i], [bx, by] = seg[i + 1]; if (Math.abs(ax - x) > 300 && Math.abs(bx - x) > 300) continue;
        const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1, u = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2));
        const d = Math.hypot(x - ax - ex * u, y - ay - ey * u); if (d < best) best = d;
      }
      return best;
    };

    // ---------- grade urbana (Los Angeles): ruas retas, quadras de 150×90 m, avenida a cada 4 / 5 quadras ----------
    // A grade é ancorada no centro (o cruzamento de duas avenidas cai na praça central). Cada trecho entre dois
    // cruzamentos só existe se o chão inteiro dele for urbano; avenidas também atravessam favela e rio (ponte).
    const GX = 150, GY = 90, AX = 4, AY = 5, dc = A.downtown, ox = dc.x, oy = dc.y;
    const i0 = Math.floor(-ox / GX), i1 = Math.ceil((W - ox) / GX), j0 = Math.floor(-oy / GY), j1 = Math.ceil((H - oy) / GY);
    const mod = (a, m) => ((a % m) + m) % m;
    const URB = new Set([Dd.URBAN, Dd.DOWNTOWN, Dd.GHETTO, Dd.INDUSTRIAL, Dd.TOWN]);
    const shore = (x, y) => { const od = orlaSegs.length ? orlaDist(x, y) : 1e9; return od < 260 ? geo.landField(x, y) > 110 && od > 15 : geo.coastDist(x, y) > 50; };
    // terminal do aeroporto e o meio-fio dele ficam livres (o acesso é ligado à parte, logo abaixo)
    const nearTerminal = (x, y) => A.airports.some(ap => { const dx = x - ap.x, dy = y - ap.y, u = dx * Math.cos(ap.ang) + dy * Math.sin(ap.ang), v = -dx * Math.sin(ap.ang) + dy * Math.cos(ap.ang); return Math.abs(u) < ap.len / 2 + 60 && v > -ap.apron - 80 && v < ap.apron + 64; });
    const okStreet = (x, y) => !nearTerminal(x, y) && geo.isLand(x, y) && URB.has(geo.districtAt(x, y)) && shore(x, y);
    const URB_AV = new Set([...URB, Dd.PORT, Dd.FAVELA]), nearUrb = (x, y) => [[0, 0], [70, 0], [-70, 0], [0, 70], [0, -70]].some(([dx, dy]) => URB_AV.has(geo.districtAt(x + dx, y + dy)));
    const okAvenue = (x, y) => { const d = geo.districtAt(x, y); return d !== Dd.AIRPORT && d !== Dd.SEA && !nearTerminal(x, y) && (d === Dd.RIVER || geo.isLand(x, y)) && shore(x, y) && nearUrb(x, y); };
    const edgeOk = (ax, ay, bx, by, ok) => { const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 15); for (let k = 0; k <= n; k++) if (!ok(ax + (bx - ax) * k / n, ay + (by - ay) * k / n)) return false; return true; };
    const NI = i1 - i0 + 1, NJ = j1 - j0 + 1, nodeX = i => ox + i * GX, nodeY = j => oy + j * GY, nid = (i, j) => (j - j0) * NI + (i - i0);
    const hE = new Uint8Array(NI * NJ), vE = new Uint8Array(NI * NJ);   // 0 sem via, 1 rua, 2 avenida
    for (let j = j0; j <= j1; j++) for (let i = i0; i < i1; i++) {
      const av = mod(j, AY) === 0, ok = edgeOk(nodeX(i), nodeY(j), nodeX(i + 1), nodeY(j), av ? okAvenue : okStreet);
      if (ok) hE[nid(i, j)] = av ? 2 : 1;
    }
    for (let i = i0; i <= i1; i++) for (let j = j0; j < j1; j++) {
      const av = mod(i, AX) === 0, ok = edgeOk(nodeX(i), nodeY(j), nodeX(i), nodeY(j + 1), av ? okAvenue : okStreet);
      if (ok) vE[nid(i, j)] = av ? 2 : 1;
    }
    // trecho de rua isolado no meio do nada (ilha de 1–2 quadras) sai; vilas inteiras ficam e ganham rodovia
    const par = new Int32Array(NI * NJ).map((_, k) => k), find = k => { while (par[k] !== k) k = par[k] = par[par[k]]; return k; };
    const each = fn => { for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { if (i < i1 && hE[nid(i, j)]) fn(nid(i, j), nid(i + 1, j), hE, nid(i, j)); if (j < j1 && vE[nid(i, j)]) fn(nid(i, j), nid(i, j + 1), vE, nid(i, j)); } };
    each((a, b) => { par[find(a)] = find(b); });
    const compEdges = new Map(); each(a => { const c = find(a); compEdges.set(c, (compEdges.get(c) || 0) + 1); });
    each((a, b, arr, k) => { if (compEdges.get(find(a)) < 10) arr[k] = 0; });
    // rua local sem saída (pedaço que só encosta na grade por uma ponta) sai: a quadra fecha no cruzamento anterior
    for (let pass = 0; pass < 4; pass++) {
      const deg = new Uint8Array(NI * NJ); each((a, b) => { deg[a]++; deg[b]++; });
      // avenida sem saída também sai, salvo quando a ponta encosta na costa (vira mirante/beira-mar)
      const xy = n => [nodeX(i0 + n % NI), nodeY(j0 + Math.floor(n / NI))], inland = n => { const [x, y] = xy(n); return geo.districtAt(x, y) !== Dd.PORT && [[60, 0], [-60, 0], [0, 60], [0, -60]].every(([dx, dy]) => geo.districtAt(x + dx, y + dy) !== Dd.PORT); };   // avenida só termina se chega ao porto
      each((a, b, arr, k) => { if ((deg[a] === 1 && (arr[k] === 1 || inland(a))) || (deg[b] === 1 && (arr[k] === 1 || inland(b)))) arr[k] = 0; });
    }
    // ruas sem saída que morrem antes da orla: estica até encostar na avenida beira-mar (cruzamento em T)
    const stubs = [];
    const degree = (i, j) => (i < i1 && hE[nid(i, j)] ? 1 : 0) + (i > i0 && hE[nid(i - 1, j)] ? 1 : 0) + (j < j1 && vE[nid(i, j)] ? 1 : 0) + (j > j0 && vE[nid(i, j - 1)] ? 1 : 0);
    for (let j = j0 + 1; j < j1; j++) for (let i = i0 + 1; i < i1; i++) {
      if (degree(i, j) === 0) continue;
      const x = nodeX(i), y = nodeY(j);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const has = di ? hE[nid(di > 0 ? i : i - 1, j)] : vE[nid(i, dj > 0 ? j : j - 1)];
        const back = di ? hE[nid(di > 0 ? i - 1 : i, j)] : vE[nid(i, dj > 0 ? j - 1 : j)];
        if (has || !back) continue;   // só prolonga a reta que já vinha (sem dobrar)
        const len = di ? GX : GY;
        for (let s = 4; s <= len; s += 2) {
          const px = x + di * s, py = y + dj * s;
          if (!geo.isLand(px, py) || geo.districtAt(px, py) === Dd.RIVER) break;
          if (orlaDist(px, py) < 1.5) { stubs.push({ i, j, di, dj, x: px, y: py, cls: back }); break; }
        }
      }
    }
    // vira polilinhas: cada fileira/coluna contínua da grade é uma via reta (pontos a cada 15 m)
    const line = (ax, ay, bx, by, out) => { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 15)); for (let k = out.length ? 1 : 0; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); return out; };
    const stubAt = (i, j, di, dj) => stubs.find(s => s.i === i && s.j === j && s.di === di && s.dj === dj);
    const runs = (horiz) => {
      const outer = horiz ? [j0, j1] : [i0, i1], inner = horiz ? [i0, i1] : [j0, j1];
      for (let a = outer[0]; a <= outer[1]; a++) {
        let start = null;
        for (let b = inner[0]; b <= inner[1]; b++) {
          const k = horiz ? (b < i1 ? nid(b, a) : -1) : (b < j1 ? nid(a, b) : -1), c = k >= 0 ? (horiz ? hE : vE)[k] : 0;
          if (c && start === null) start = b;
          if (!c && start !== null) {
            const cls = (horiz ? hE[nid(start, a)] : vE[nid(a, start)]) === 2 ? 'avenue' : 'street';
            const P = (t) => horiz ? [nodeX(t), nodeY(a)] : [nodeX(a), nodeY(t)];
            let pa = P(start), pb = P(b);
            const sa = horiz ? stubAt(start, a, -1, 0) : stubAt(a, start, 0, -1), sb = horiz ? stubAt(b, a, 1, 0) : stubAt(a, b, 0, 1);
            if (sa) pa = [sa.x, sa.y]; if (sb) pb = [sb.x, sb.y];
            const rd = { cls, pts: line(pa[0], pa[1], pb[0], pb[1], []), grid: 1 };
            // centro: ruas comerciais com vaga paralela pintada nos dois lados
            if (cls === 'street') { const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2; if ([pa, pb, [mx, my]].some(([x, y]) => geo.districtAt(x, y) === Dd.DOWNTOWN)) { rd.park = COG.ROAD_PARK; rd.w = COG.ROAD.street.w + COG.ROAD_PARK * 2; } }
            roads.push(rd);
            if (sa) junctions.push({ x: sa.x, y: sa.y, t: 1, orla: 1 }); if (sb) junctions.push({ x: sb.x, y: sb.y, t: 1, orla: 1 });
            start = null;
          }
        }
      }
    };
    runs(true); runs(false);
    // cruzamentos da grade (T, X e esquinas em L): faixas de pedestre e linhas de retenção no jogo
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const arms = [];
      if (i < i1 && hE[nid(i, j)]) arms.push([1, 0, hE[nid(i, j)]]); if (i > i0 && hE[nid(i - 1, j)]) arms.push([-1, 0, hE[nid(i - 1, j)]]);
      if (j < j1 && vE[nid(i, j)]) arms.push([0, 1, vE[nid(i, j)]]); if (j > j0 && vE[nid(i, j - 1)]) arms.push([0, -1, vE[nid(i, j - 1)]]);
      if (arms.length < 2 || (arms.length === 2 && arms[0][0] === -arms[1][0] && arms[0][1] === -arms[1][1])) continue;
      junctions.push({ x: nodeX(i), y: nodeY(j), n: arms.length, big: arms.filter(a => a[2] === 2).length });
    }

    // ---------- acesso ao aeroporto: via do meio-fio do terminal + avenida reta até a grade ----------
    const onGrid = (x, y) => {
      const j = Math.round((y - oy) / GY), i = Math.floor((x - ox) / GX);
      if (Math.abs(y - nodeY(j)) < 1.5 && j >= j0 && j <= j1 && i >= i0 && i < i1 && hE[nid(i, j)]) return true;
      const ii = Math.round((x - ox) / GX), jj = Math.floor((y - oy) / GY);
      return Math.abs(x - nodeX(ii)) < 1.5 && ii >= i0 && ii <= i1 && jj >= j0 && jj < j1 && vE[nid(ii, jj)] > 0;
    };
    const apLinked = new Set();
    const apGate = ap => ({ x: ap.x - Math.sin(ap.ang) * (ap.apron + 52), y: ap.y + Math.cos(ap.ang) * (ap.apron + 52) });   // meio-fio do terminal
    for (const ap of A.airports) {
      const g = apGate(ap), ux = Math.cos(ap.ang), uy = Math.sin(ap.ang), sx = -Math.sin(ap.ang), sy = Math.cos(ap.ang);
      for (let s = 4; s < 260; s += 1) {
        const x = g.x + sx * s, y = g.y + sy * s;
        if (!geo.isLand(x, y) || geo.districtAt(x, y) === Dd.RIVER) break;
        if (!onGrid(x, y)) continue;
        const hit = [Math.round((x - ox) / GX) * GX + ox, y]; if (Math.abs(hit[0] - x) > 1.5) { hit[0] = x; hit[1] = nodeY(Math.round((y - oy) / GY)); }
        roads.push({ cls: 'avenue', pts: line(g.x - ux * 70, g.y - uy * 70, g.x + ux * 70, g.y + uy * 70, []), airport: 1 });
        roads.push({ cls: 'avenue', pts: line(g.x, g.y, hit[0], hit[1], []), airport: 1 });
        junctions.push({ x: g.x, y: g.y, n: 3, big: 2, ap: 1 }, { x: hit[0], y: hit[1], n: 3, big: 1, ap: 1 });
        apLinked.add(ap); break;
      }
    }

    // ---------- rodovias: ligam os núcleos que a grade não liga (vilas, aeroporto, porto) ----------
    const gridNodes = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (degree(i, j)) gridNodes.push({ x: nodeX(i), y: nodeY(j), c: find(nid(i, j)), av: mod(i, AX) === 0 || mod(j, AY) === 0 });
    const compOf = (x, y) => { let best = null, bd = 260; for (const g of gridNodes) { const d = Math.hypot(g.x - x, g.y - y); if (d < bd) { bd = d; best = g.c; } } return best; };
    const raw = [
      { ...A.downtown, k: 'centro' }, { ...A.port, k: 'porto' }, ...A.industrial.map((a, i) => ({ ...a, k: 'industrial' + i })),
      ...A.towns.map(a => ({ ...a, k: a.name })), ...A.airports.filter(a => !apLinked.has(a)).map(a => ({ ...apGate(a), k: a.name, ap: 1 })), ...A.ghettos.map((a, i) => ({ ...a, k: 'conjunto' + i })),
    ].filter(n => geo.isLand(n.x, n.y));
    // núcleos dentro do mesmo pedaço de grade viram um só nó (a grade já os liga)
    const nodes = [];
    for (const n of raw) { const c = n.ap ? null : compOf(n.x, n.y), same = c !== null && nodes.find(m => m.c === c); if (same) continue; nodes.push({ ...n, c }); }
    // ponto de chegada: avenida da borda daquele pedaço de grade voltada p/ o outro núcleo
    const gate = (n, toward) => {
      if (n.c === null) return [n.x, n.y];
      let best = null, bd = 1e18;
      for (const g of gridNodes) if (g.c === n.c && g.av) { const d = Math.hypot(g.x - toward.x, g.y - toward.y); if (d < bd) { bd = d; best = [g.x, g.y]; } }
      return best || [n.x, n.y];
    };
    const inT = [0], edges = [], used = new Set([0]);
    while (inT.length < nodes.length) {
      let best = null;
      for (const a of inT) for (let b = 0; b < nodes.length; b++) if (!used.has(b)) { const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y); if (!best || d < best[2]) best = [a, b, d]; }
      edges.push(best); used.add(best[1]); inT.push(best[1]);
    }
    const hwGrid = baseCost('road'), minCost = 0.85 * 1.1 * 0.6;
    for (const [a, b] of edges) {
      const na = nodes[a], nb = nodes[b], ga = gate(na, nb), gb = gate(nb, na);
      const g2 = hwGrid.slice(); openAround(g2, ga[0], ga[1], 90, 1.2); openAround(g2, gb[0], gb[1], 90, 1.2);
      const [sx, sy] = toCell(ga[0], ga[1]), [tx, ty] = toCell(gb[0], gb[1]);
      const path = astar(g2, nx, ny, sx, sy, tx, ty, minCost);
      if (!path || path.length < 3) continue;
      for (const c of path) hwGrid[c] = Math.min(hwGrid[c], 0.6);
      const pts = smoothPath(path, nx, CS, 5, 12);
      pts[0] = [ga[0], ga[1]]; pts[pts.length - 1] = [gb[0], gb[1]];
      roads.push({ cls: 'highway', pts, from: na.k, to: nb.k });
      for (const p of [ga, gb]) if (!(nodes.find(n => n.ap && n.x === p[0] && n.y === p[1]))) junctions.push({ x: p[0], y: p[1], n: 3, big: 2, hw: 1 });
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
      rd.w = rd.w || COG.ROAD[rd.cls].w; rd.lanes = COG.ROAD[rd.cls].lanes || 0;
    }
    roads.junctions = junctions;
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
    const t0 = Date.now(), geo = COG.buildGeo(seed), t1 = Date.now(), roads = COG.buildRoads(geo), junctions = roads.junctions, t2 = Date.now(), landmarks = COG.buildLandmarks(geo, roads);
    const t3 = Date.now();
    return { seed, geo, roads, junctions, landmarks, timing: { geo: t1 - t0, roads: t2 - t1, landmarks: t3 - t2, total: t3 - t0 } };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = COG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
