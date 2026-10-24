// worldgen/atlas.js — atlas do mundo grande: base pintada por pixel + vias e marcos vetoriais, com zoom e arraste.
'use strict';
(function () {
  const COG = window.COG, D = COG.D;
  const qs = new URLSearchParams(location.search), seed = Number(qs.get('wseed')) || COG.WORLD_SEED;
  const t0 = performance.now(), world = COG.buildWorld(seed), genMs = performance.now() - t0;
  const { geo, roads, landmarks } = world, W = geo.W, H = geo.H;
  const view = document.getElementById('atlas'), g = view.getContext('2d');

  // ---------- base raster (4 m/px), pintada uma vez (worldgen/atlas-paint.js) ----------
  const tP = performance.now(), BP = 4, ab = COG.atlasBase(world, seed, BP); ab.step(Infinity);
  const base = ab.canvas;
  const paintMs = performance.now() - tP;

  // ---------- câmera do atlas ----------
  let scale = 0, ox = 0, oy = 0;
  const fit = () => { view.width = innerWidth * devicePixelRatio; view.height = innerHeight * devicePixelRatio; scale = Math.min(view.width / W, view.height / H) * 0.96; ox = (view.width - W * scale) / 2; oy = (view.height - H * scale) / 2; };
  addEventListener('resize', () => { fit(); draw(); }); fit();
  const S = (x, y) => [ox + x * scale, oy + y * scale];

  function strokePoly(pts, w, col) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => { const [sx, sy] = S(p[0], p[1]); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); }); g.stroke(); }
  let draw = function () {
    const dpr = devicePixelRatio;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#163b5f'; g.fillRect(0, 0, view.width, view.height);
    g.imageSmoothingEnabled = scale < 1 / BP; g.drawImage(base, ox, oy, W * scale, H * scale);
    COG.drawAtlasLayers(g, world, S, scale, dpr);
    // escala e legenda
    g.setTransform(1, 0, 0, 1, 0, 0);
    const bar = 1000 * scale, bx = 20 * dpr, by = view.height - 30 * dpr;
    g.fillStyle = 'rgba(15,12,10,0.75)'; g.fillRect(bx - 8 * dpr, by - 22 * dpr, bar + 16 * dpr, 34 * dpr);
    g.fillStyle = '#fff'; g.fillRect(bx, by, bar, 4 * dpr); g.font = `600 ${12 * dpr}px system-ui`; g.textAlign = 'left'; g.fillText('1 km', bx, by - 9 * dpr);
    info.textContent = `Mundo ${W / 1000}×${H / 1000} km · terra ${(geo.land.reduce((a, b) => a + b, 0) * geo.C * geo.C / 1e6).toFixed(1)} km² · semente ${seed} · gerado em ${genMs | 0} ms (base ${paintMs | 0} ms)`;
  }
  const info = document.getElementById('info');

  // ---------- zoom (roda/pinça) e arraste ----------
  const zoomAt = (mx, my, k) => { const ns = Math.min(4, Math.max(0.04, scale * k)); ox = mx - (mx - ox) * ns / scale; oy = my - (my - oy) * ns / scale; scale = ns; draw(); };
  view.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.offsetX * devicePixelRatio, e.offsetY * devicePixelRatio, e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });
  const ptrs = new Map(); let pinch = 0;
  view.addEventListener('pointerdown', e => { view.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); });
  view.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const [px0, py0] = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoomAt((a[0] + b[0]) / 2 * devicePixelRatio, (a[1] + b[1]) / 2 * devicePixelRatio, dd / pinch); pinch = dd; return; }
    ox += (e.clientX - px0) * devicePixelRatio; oy += (e.clientY - py0) * devicePixelRatio; draw();
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; };
  view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
  window.atlas = { world, zoomAt, focus(x, y, s) { scale = s; ox = view.width / 2 - x * s; oy = view.height / 2 - y * s; draw(); } };

  // ---------- demonstração do streaming (?demo=stream): setores gerados num Web Worker em volta do jogador ----------
  const SECT = COG.SECTOR, demo = { on: false, loaded: new Map(), p: null, route: [], k: 0, stats: '' };
  const DCOL = ['#2f6fa8', '#e8d6a0', '#8a8a90', '#c2b8a8', '#c07a5a', '#9a948a', '#8fa0ac', '#7f8e9a', '#c9b060', '#3d6b3a', '#c8b898', '#ffffff', '#9ab060', '#4a90a8'];
  const drawDemo = () => {
    if (!demo.on) return;
    for (const info of demo.loaded.values()) {
      const [x0, y0] = S(info.bounds[0], info.bounds[1]), w = SECT * scale;
      g.fillStyle = DCOL[info.dominant] + '55'; g.fillRect(x0, y0, w, w);
      g.strokeStyle = '#ffffffcc'; g.lineWidth = 1.5 * devicePixelRatio; g.strokeRect(x0 + 1, y0 + 1, w - 2, w - 2);
      for (const rd of info.roads) strokePoly(rd.pts, Math.max(rd.w * scale, 2 * devicePixelRatio), rd.cls === 'highway' ? '#ffcf5a' : '#ffffff');
    }
    const [px, py] = S(demo.p[0], demo.p[1]);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5 * devicePixelRatio; g.setLineDash([5, 5]); g.beginPath(); g.arc(px, py, 420 * scale, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ff4d3d'; g.strokeStyle = '#fff'; g.lineWidth = 2 * devicePixelRatio; g.beginPath(); g.arc(px, py, 6 * devicePixelRatio, 0, Math.PI * 2); g.fill(); g.stroke();
    g.setTransform(1, 0, 0, 1, 0, 0); g.font = `600 ${13 * devicePixelRatio}px system-ui`; g.textAlign = 'left';
    g.fillStyle = 'rgba(15,12,10,0.8)'; g.fillRect(12 * devicePixelRatio, view.height - 80 * devicePixelRatio, 470 * devicePixelRatio, 30 * devicePixelRatio);
    g.fillStyle = '#ffe9b8'; g.fillText(demo.stats, 22 * devicePixelRatio, view.height - 60 * devicePixelRatio);
  };
  const drawBase = draw;
  draw = () => { drawBase(); drawDemo(); };
  if (qs.get('demo') === 'stream') {
    demo.on = true;
    // rota: rodovias encadeadas pelo mapa
    for (const rd of roads.filter(r => r.cls === 'highway').slice(0, 8)) demo.route.push(...rd.pts);
    demo.p = demo.route[0].slice();
    const gen = COG.createWorkerGen('js/worldgen/worker.js', seed);
    let genT = 0, genN = 0, unloads = 0;
    const timed = (sx, sy) => { const t = performance.now(); return gen(sx, sy).then(i => { genT += performance.now() - t; genN++; return i; }); };
    const st = new COG.SectorStreamer({ world, radius: 420, hysteresis: 200, maxPerUpdate: 3, gen: timed,
      onLoad: i => demo.loaded.set(i.sx + ',' + i.sy, i), onUnload: i => { demo.loaded.delete(i.sx + ',' + i.sy); unloads++; } });
    gen.ready.then(r => {
      demo.workerMs = r.ms;
      const tick = () => {
        demo.k = (demo.k + 2) % demo.route.length; demo.p = demo.route[demo.k];
        const u = st.update(demo.p[0], demo.p[1]);
        demo.stats = `streaming: ${u.loaded} setores carregados · ${unloads} descarregados · worker pronto em ${demo.workerMs} ms · ficha média ${(genT / Math.max(1, genN)).toFixed(1)} ms`;
        if (qs.get('follow') !== '0') { ox = view.width / 2 - demo.p[0] * scale; oy = view.height / 2 - demo.p[1] * scale; }
        draw(); requestAnimationFrame(tick);
      };
      if (scale < 0.25) { const s0 = 0.3; scale = s0; }
      tick();
    });
  }
  draw(); document.title = 'READY';
})();
