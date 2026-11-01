// worldgen/stream.js — streaming do mundo grande (nível 2): setores de 256 m gerados sob demanda,
// índice espacial genérico e gerenciador que carrega/descarrega setores em volta do jogador.
'use strict';
(function (G) {
  const COG = G.COG = G.COG || {};
  COG.SECTOR = 256;

  // ---------- índice espacial (grade hash) ----------
  // insert/update/remove por caixa [x0,y0,x1,y1]; query(caixa, fn) visita cada objeto uma vez
  class SpatialIndex {
    constructor(cell = 32) { this.cell = cell; this.map = new Map(); this.boxes = new Map(); this.stamp = 0; }
    _keys(b, fn) { const c = this.cell; for (let j = Math.floor(b[1] / c); j <= Math.floor(b[3] / c); j++) for (let i = Math.floor(b[0] / c); i <= Math.floor(b[2] / c); i++) fn(i + ',' + j); }
    insert(o, b) { this.remove(o); this.boxes.set(o, b); this._keys(b, k => { let s = this.map.get(k); if (!s) this.map.set(k, s = new Set()); s.add(o); }); }
    update(o, b) { this.insert(o, b); }
    remove(o) { const b = this.boxes.get(o); if (!b) return; this._keys(b, k => { const s = this.map.get(k); if (s) { s.delete(o); if (!s.size) this.map.delete(k); } }); this.boxes.delete(o); }
    query(b, fn) {
      const seen = new Set();
      this._keys(b, k => { const s = this.map.get(k); if (!s) return; for (const o of s) { if (seen.has(o)) continue; seen.add(o); const ob = this.boxes.get(o); if (ob[0] <= b[2] && ob[2] >= b[0] && ob[1] <= b[3] && ob[3] >= b[1]) fn(o); } });
    }
    get size() { return this.boxes.size; }
  }
  COG.SpatialIndex = SpatialIndex;

  // ---------- recorte de polilinha numa caixa (Liang–Barsky por segmento) ----------
  function clipSeg(ax, ay, bx, by, x0, y0, x1, y1) {
    let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
    for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]]) {
      if (p === 0) { if (q < 0) return null; continue; }
      const t = q / p; if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [ax + dx * t0, ay + dy * t0, ax + dx * t1, ay + dy * t1];
  }
  COG.clipPolyline = function (pts, x0, y0, x1, y1) {
    const out = []; let cur = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const c = clipSeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], x0, y0, x1, y1);
      if (!c) { if (cur) { out.push(cur); cur = null; } continue; }
      if (!cur) cur = [{ x: c[0], y: c[1], i }];
      cur.push({ x: c[2], y: c[3], i: i + 1 });
      if (c[2] !== pts[i + 1][0] || c[3] !== pts[i + 1][1]) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out;
  };

  // índice das vias por setor (feito uma vez sobre o mundo)
  COG.indexRoads = function (world) {
    const idx = new SpatialIndex(COG.SECTOR);
    world.roads.forEach((rd, id) => {
      rd.id = id;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of rd.pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
      // vias longas: indexa por trecho p/ não aparecerem em setores que só a caixa delas cobre
      for (let k = 0; k < rd.pts.length - 1; k += 8) {
        const seg = rd.pts.slice(k, Math.min(rd.pts.length, k + 9)); let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
        for (const [x, y] of seg) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
        idx.insert({ rd, k }, [a - rd.w, b - rd.w, c + rd.w, d + rd.w]);
      }
    });
    world.roadIndex = idx;
    return idx;
  };

  // ---------- ficha de um setor (o que o nível 3 precisa para gerar o detalhe) ----------
  COG.sectorInfo = function (world, sx, sy) {
    const S = COG.SECTOR, x0 = sx * S, y0 = sy * S, x1 = x0 + S, y1 = y0 + S, geo = world.geo;
    if (!world.roadIndex) COG.indexRoads(world);
    // composição de distritos (amostragem de 16 m)
    const hist = new Array(COG.D_NAMES.length).fill(0);
    for (let y = y0 + 8; y < y1; y += 16) for (let x = x0 + 8; x < x1; x += 16) hist[geo.districtAt(x, y)]++;
    const total = hist.reduce((a, b) => a + b, 0), dominant = hist.indexOf(Math.max(...hist));
    // vias recortadas na caixa do setor (com margem p/ largura), marcando trechos de ponte
    const roads = [], seen = new Set(), m = 24;
    world.roadIndex.query([x0 - m, y0 - m, x1 + m, y1 + m], ({ rd }) => {
      if (seen.has(rd.id)) return; seen.add(rd.id);
      for (const part of COG.clipPolyline(rd.pts, x0 - m, y0 - m, x1 + m, y1 + m)) {
        const onBridge = part.map(p => rd.bridges.some(([a, b]) => p.i >= a && p.i <= b));
        roads.push({ id: rd.id, cls: rd.cls, w: rd.w, pts: part.map(p => [p.x, p.y]), bridge: onBridge });
      }
    });
    const landmarks = world.landmarks.filter(l => l.x + l.r > x0 && l.x - l.r < x1 && l.y + l.r > y0 && l.y - l.r < y1);
    return {
      sx, sy, bounds: [x0, y0, x1, y1], seed: (world.seed * 73856093) ^ (sx * 19349663) ^ (sy * 83492791),
      dominant, districtName: COG.D_NAMES[dominant], mix: hist.map(v => v / total), seaFrac: hist[COG.D.SEA] / total,
      roads, landmarks,
    };
  };

  // ---------- gerenciador de setores ----------
  // radius (m): carrega setores cujo centro está a até radius; descarrega além de radius + hysteresis.
  // gen(sx, sy) devolve a ficha (síncrono) ou uma Promise (ex.: Web Worker).
  class SectorStreamer {
    constructor({ world, radius = 420, hysteresis = 200, gen, onLoad, onUnload, maxPerUpdate = 2 }) {
      Object.assign(this, { world, radius, hysteresis, gen, onLoad, onUnload, maxPerUpdate });
      this.loaded = new Map(); this.pending = new Set();
      this.nx = Math.ceil(world.geo.W / COG.SECTOR); this.ny = Math.ceil(world.geo.H / COG.SECTOR);
    }
    key(sx, sy) { return sx + ',' + sy; }
    update(px, py) {
      const S = COG.SECTOR, want = [];
      const R = Math.ceil((this.radius + S) / S), ci = Math.floor(px / S), cj = Math.floor(py / S);
      for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) {
        if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) continue;
        const d = Math.hypot((i + 0.5) * S - px, (j + 0.5) * S - py), k = this.key(i, j);
        if (d <= this.radius && !this.loaded.has(k) && !this.pending.has(k)) want.push([d, i, j, k]);
      }
      want.sort((a, b) => a[0] - b[0]);   // mais perto primeiro
      for (const [, i, j, k] of want.slice(0, this.maxPerUpdate)) {
        this.pending.add(k);
        const done = info => { this.pending.delete(k); if (this.loaded.has(k)) return; this.loaded.set(k, info); this.onLoad && this.onLoad(info); };
        const r = this.gen(i, j);
        if (r && typeof r.then === 'function') r.then(done); else done(r);
      }
      for (const [k, info] of this.loaded) {
        const d = Math.hypot((info.sx + 0.5) * S - px, (info.sy + 0.5) * S - py);
        if (d > this.radius + this.hysteresis) { this.loaded.delete(k); this.onUnload && this.onUnload(info); }
      }
      return { loaded: this.loaded.size, pending: this.pending.size, requested: Math.min(want.length, this.maxPerUpdate) };
    }
  }
  COG.SectorStreamer = SectorStreamer;

  // ---------- gerador em Web Worker (sem travar a thread principal) ----------
  COG.createWorkerGen = function (url, seed) {
    const w = new Worker(url); let id = 0; const wait = new Map();
    const ready = new Promise(res => { w.onmessage = e => { const m = e.data; if (m.type === 'ready') return res(m); const p = wait.get(m.id); if (p) { wait.delete(m.id); p(m.info); } }; });
    w.postMessage({ type: 'init', seed });
    const gen = (sx, sy) => ready.then(() => new Promise(res => { const k = ++id; wait.set(k, res); w.postMessage({ type: 'sector', id: k, sx, sy }); }));
    gen.ready = ready; gen.worker = w;
    return gen;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = COG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
