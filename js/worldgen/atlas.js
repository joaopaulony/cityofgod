// worldgen/atlas.js — atlas do mundo grande: base pintada por pixel + vias e marcos vetoriais, com zoom e arraste.
'use strict';
(function () {
  const COG = window.COG, D = COG.D;
  const qs = new URLSearchParams(location.search), seed = Number(qs.get('wseed')) || COG.WORLD_SEED;
  const t0 = performance.now(), world = COG.buildWorld(seed), genMs = performance.now() - t0;
  const { geo, roads, landmarks } = world, W = geo.W, H = geo.H;
  const view = document.getElementById('atlas'), g = view.getContext('2d');

  // ---------- base raster (4 m/px), pintada uma vez ----------
  const BP = 6, BW = W / BP, BH = H / BP, base = document.createElement('canvas'); base.width = BW; base.height = BH;
  const bg = base.getContext('2d'), img = bg.createImageData(BW, BH), d = img.data;
  const { N1, N2, N3 } = geo.noise, hash = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ seed; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const CROPS = [[196, 172, 92], [122, 150, 62], [140, 108, 72], [96, 134, 58], [170, 160, 80], [112, 92, 60]];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const tP = performance.now();
  for (let py = 0; py < BH; py++) for (let px = 0; px < BW; px++) {
    const x = px * BP, y = py * BP, n = N3(x * 0.02, y * 0.02), h = hash(px, py);
    // amostra deslocada por ruído: fronteiras orgânicas em vez dos degraus da grade de 20 m
    const jx = (N1(x * 0.03, y * 0.03) - 0.5) * 34, jy = (N2(x * 0.03 + 7, y * 0.03) - 0.5) * 34;
    const dist = geo.districtAt(x + jx, y + jy), cd = geo.coastDist(x, y);
    let c;
    if (dist === D.SEA) {
      // profundidade pela distância ao litoral: turquesa na beira -> azul fundo
      const lf = -geo.landField(x, y), t = Math.min(1, Math.max(0, lf / 900));
      c = mix([86, 170, 176], [22, 62, 104], Math.pow(t, 0.6));
      c = mix(c, [255, 255, 255], (N1(x * 0.01, y * 0.03) > 0.7 ? 0.05 : 0) + (lf < 25 ? 0.45 * (1 - lf / 25) : 0));
    } else if (dist === D.RIVER) c = mix([58, 112, 128], [76, 136, 140], n);
    else if (dist === D.BEACH) c = cd < 22 ? mix([164, 150, 112], [186, 172, 132], n) : mix([222, 206, 160], [236, 224, 184], n);
    else if (dist === D.FOREST) { const k = N2(x * 0.06, y * 0.06); c = mix([30, 58, 32], [58, 94, 44], k); if (h > 0.9) c = mix(c, [16, 30, 18], 0.5); }
    else if (dist === D.FARM) {
      // talhões: célula de Voronoi numa grade irregular; cada talhão tem cultura e direção de plantio
      const S = 150, gi = Math.floor(x / S), gj = Math.floor(y / S); let best = 1e9, id = 0, ang = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ci = gi + di, cj = gj + dj, cx = (ci + hash(ci, cj * 7 + 1)) * S, cy = (cj + hash(ci * 3, cj + 2)) * S, dd = (x - cx) ** 2 + (y - cy) ** 2; if (dd < best) { best = dd; id = ci * 131 + cj * 7; ang = hash(ci + 9, cj) * Math.PI; } }
      const crop = CROPS[(hash(id, 5) * CROPS.length) | 0], rows = Math.sin((x * Math.cos(ang) + y * Math.sin(ang)) * 0.9) > 0.3 ? 0.9 : 1.02;
      c = crop.map(v => v * rows * (0.92 + n * 0.14));
    }
    else if (dist === D.RURAL) c = mix([118, 142, 70], [146, 152, 84], N2(x * 0.004, y * 0.004));
    else if (dist === D.AIRPORT) c = mix([128, 148, 78], [138, 156, 88], n);
    else if (dist === D.DOWNTOWN) c = h > 0.55 ? mix([128, 126, 124], [168, 164, 158], hash(px >> 2, py >> 2)) : [98, 98, 102];
    else if (dist === D.URBAN || dist === D.TOWN) { const roof = hash(px >> 1, py >> 1); c = roof > 0.5 ? (roof > 0.8 ? [176, 98, 72] : [150, 146, 136]) : mix([110, 132, 72], [134, 140, 96], n); }
    else if (dist === D.FAVELA) { const roof = hash(px, py); c = roof > 0.2 ? mix([150, 96, 70], [182, 130, 98], roof) : [104, 96, 88]; }
    else if (dist === D.GHETTO) c = hash(px >> 3, py >> 3) > 0.45 ? [148, 142, 134] : [104, 108, 96];
    else if (dist === D.INDUSTRIAL) c = hash(px >> 3, py >> 2) > 0.4 ? mix([132, 142, 150], [168, 172, 176], hash(px >> 3, py >> 3)) : [96, 96, 92];
    else if (dist === D.PORT) { const k = hash(px >> 1, py); c = k > 0.6 ? [[178, 64, 52], [58, 98, 150], [200, 160, 60], [80, 132, 88]][(k * 13 | 0) % 4] : [128, 126, 120]; }
    else c = [120, 140, 70];
    const o = (py * BW + px) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  bg.putImageData(img, 0, 0);
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
    g.lineCap = 'round'; g.lineJoin = 'round';
    const px = m => Math.max(m * scale, 0);
    // pistas dos aeroportos (asfalto, faixa central tracejada, cabeceiras)
    for (const ap of geo.anchors.airports) {
      g.save(); const [cx, cy] = S(ap.x, ap.y); g.translate(cx, cy); g.rotate(ap.ang); g.scale(scale, scale);
      g.fillStyle = '#4a4c50'; g.fillRect(-ap.len / 2, -30, ap.len, 60);
      g.fillStyle = '#5b5d61'; g.fillRect(-ap.len / 2 + 200, 60, ap.len - 400, 26); g.fillRect(-ap.len * 0.22, 86, ap.len * 0.44, ap.apron - 120);
      g.fillStyle = '#c9c7bd'; g.fillRect(-ap.len * 0.18, ap.apron - 60, ap.len * 0.36, 70);
      g.fillStyle = '#eeeeea'; for (let x = -ap.len / 2 + 120; x < ap.len / 2 - 120; x += 90) g.fillRect(x, -1.5, 45, 3);
      for (const e of [-1, 1]) for (let k = -4; k <= 4; k++) g.fillRect(e * (ap.len / 2 - 40) - 15, k * 6 - 1.5, 30, 3);
      g.restore();
    }
    // vias: contorno + miolo por categoria
    const order = ['street', 'avenue', 'highway'];
    for (const pass of [0, 1]) for (const cls of order) for (const rd of roads) {
      if (rd.cls !== cls) continue;
      const w = px(rd.w), col = pass ? (cls === 'highway' ? '#f2c25a' : cls === 'avenue' ? '#f4efe4' : '#dcd6ca') : 'rgba(30,26,22,0.75)';
      if (cls === 'street' && !pass && scale < 0.25) continue;   // sem contorno escuro nas ruas com o mapa afastado
      strokePoly(rd.pts, pass ? Math.max(w, cls === 'street' ? 0.7 * dpr : 1.4 * dpr) : Math.max(w + 2 * dpr, (cls === 'street' ? 1.2 : 2.6) * dpr), cls === 'street' && pass && scale < 0.25 ? 'rgba(236,230,218,0.55)' : col);
    }
    for (const rd of roads) if (rd.cls === 'rail') { strokePoly(rd.pts, Math.max(px(5), 2 * dpr), '#3c3a38'); g.setLineDash([6 * dpr, 6 * dpr]); strokePoly(rd.pts, Math.max(px(2), 1 * dpr), '#d9d4c8'); g.setLineDash([]); }
    // pontes
    for (const rd of roads) for (const [a, b] of rd.bridges) { const seg = rd.pts.slice(a, b + 1); strokePoly(seg, Math.max(px(rd.w + 6), 4 * dpr), '#2a2826'); strokePoly(seg, Math.max(px(rd.w), 2 * dpr), '#b9b4aa'); }
    // marcos
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const l of landmarks) {
      const [sx, sy] = S(l.x, l.y), r = Math.min(9 * dpr, Math.max(3.5 * dpr, l.r * scale * (l.kind === 'airport' ? 0.04 : 0.25)));
      g.fillStyle = { cityhall: '#e8c35a', church: '#f2efe6', hospital: '#e25b52', police: '#4a78c0', stadium: '#7cc46a', mall: '#c48ae0', university: '#5fb3c9', bus: '#e09a4a', port: '#9aa8b4', lighthouse: '#ffffff', market: '#e0b070', airport: '#ffffff' }[l.kind] || '#fff';
      g.strokeStyle = '#1b1712'; g.lineWidth = 1.5 * dpr; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill(); g.stroke();
      if (scale > 0.16 || ['cityhall', 'airport', 'lighthouse', 'stadium'].includes(l.kind)) {
        g.font = `600 ${11 * dpr}px system-ui`; g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(15,12,10,0.8)'; g.strokeText(l.name, sx, sy - r - 8 * dpr); g.fillStyle = '#fff6e0'; g.fillText(l.name, sx, sy - r - 8 * dpr);
      }
    }
    // nomes dos distritos
    const A = geo.anchors, label = (t, x, y, sz) => { const [sx, sy] = S(x, y); g.font = `700 ${sz * dpr}px system-ui`; g.lineWidth = 4 * dpr; g.strokeStyle = 'rgba(15,12,10,0.7)'; g.strokeText(t, sx, sy); g.fillStyle = '#ffffff'; g.fillText(t, sx, sy); };
    label('CENTRO', A.downtown.x, A.downtown.y + 260, 15); label('PORTO', A.port.x, A.port.y, 13);
    A.towns.forEach(t => label(t.name.toUpperCase(), t.x, t.y + 60, 13)); A.favelas.forEach((f, i) => label('FAVELA ' + ['DO MORRO', 'DA PEDREIRA', 'DO SOSSEGO', 'DA LINHA'][i], f.x, f.y, 11));
    A.ghettos.forEach((f, i) => label('CONJUNTO ' + ['ESPERANÇA', 'NOVA VIDA'][i], f.x, f.y, 11)); A.industrial.forEach((f, i) => label('DISTRITO INDUSTRIAL ' + (i + 1), f.x, f.y, 11));
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
