// worldgen/atlas-paint.js — pintura do mapa do mundo grande, usada pelo atlas.html e pelo mapa do jogo (minimapa e tecla M).
// atlasBase: base raster (BP m/px) pintada por pixel em fatias de tempo (opt.roofs=false: bairros sem telhados
// sugeridos, p/ o minimapa desenhar os prédios de verdade por cima); drawAtlasLayers: pistas, vias, pontes, marcos e nomes.
'use strict';
(function () {
  const COG = window.COG, D = COG.D;

  COG.atlasBase = function (world, seed, BP = 4, opt = {}) {
    const { geo } = world, W = geo.W, H = geo.H, BW = Math.ceil(W / BP), BH = Math.ceil(H / BP);
    const canvas = document.createElement('canvas'); canvas.width = BW; canvas.height = BH;
    const bg = canvas.getContext('2d'), img = bg.createImageData(BW, BH), d = img.data;
    const { N1, N2, N3 } = geo.noise, hash = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ seed; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const CROPS = [[196, 172, 92], [122, 150, 62], [140, 108, 72], [96, 134, 58], [170, 160, 80], [112, 92, 60]];
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const pixel = (px, py) => {
      const x = px * BP, y = py * BP, n = N3(x * 0.02, y * 0.02), h = hash(px, py);
      // amostra deslocada por ruído: fronteiras orgânicas em vez dos degraus da grade de 20 m
      const jx = (N1(x * 0.03, y * 0.03) - 0.5) * 34, jy = (N2(x * 0.03 + 7, y * 0.03) - 0.5) * 34;
      const dist = geo.districtAt(x + jx, y + jy), cd = geo.coastDist(x, y);
      let c;
      if (dist === D.SEA) {
        // profundidade pela distância ao litoral: turquesa na beira -> azul fundo
        const lf = -geo.landField(x, y), t = Math.min(1, Math.max(0, lf / 900));
        c = mix([58, 133, 163], [12, 42, 82], Math.pow(t, 0.6));
        c = mix(c, [255, 255, 255], (N1(x * 0.01, y * 0.03) > 0.7 ? 0.05 : 0) + (lf < 25 ? 0.45 * (1 - lf / 25) : 0));
      } else if (dist === D.RIVER) c = mix([58, 112, 128], [76, 136, 140], n);
      else if (dist === D.BEACH) c = cd < 22 ? mix([164, 150, 112], [186, 172, 132], n) : mix([222, 206, 160], [236, 224, 184], n);
      else if (dist === D.FOREST) { const k = N2(x * 0.06, y * 0.06); c = mix([43, 82, 66], [84, 122, 87], k); if (h > 0.9) c = mix(c, [16, 30, 18], 0.5); }
      else if (dist === D.FARM) {
        // talhões: célula de Voronoi numa grade irregular; cada talhão tem cultura e direção de plantio
        const S = 150, gi = Math.floor(x / S), gj = Math.floor(y / S); let best = 1e9, id = 0, ang = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ci = gi + di, cj = gj + dj, cx = (ci + hash(ci, cj * 7 + 1)) * S, cy = (cj + hash(ci * 3, cj + 2)) * S, dd = (x - cx) ** 2 + (y - cy) ** 2; if (dd < best) { best = dd; id = ci * 131 + cj * 7; ang = hash(ci + 9, cj) * Math.PI; } }
        const crop = CROPS[(hash(id, 5) * CROPS.length) | 0], rows = Math.sin((x * Math.cos(ang) + y * Math.sin(ang)) * 0.9) > 0.3 ? 0.9 : 1.02;
        c = crop.map(v => v * rows * (0.92 + n * 0.14));
      }
      else if (dist === D.RURAL) c = mix([118, 142, 70], [146, 152, 84], N2(x * 0.004, y * 0.004));
      else if (dist === D.AIRPORT) c = mix([128, 148, 78], [138, 156, 88], n);
      else if (opt.roofs === false && (dist === D.DOWNTOWN || dist === D.URBAN || dist === D.TOWN || dist === D.FAVELA || dist === D.GHETTO || dist === D.INDUSTRIAL))
        c = dist === D.URBAN || dist === D.TOWN ? mix([138, 166, 130], [157, 181, 144], n) : dist === D.FAVELA ? mix([154, 142, 126], [173, 153, 139], n) : dist === D.DOWNTOWN ? mix([170, 182, 190], [186, 196, 200], n) : mix([155, 165, 166], [170, 176, 171], n);
      else if (dist === D.DOWNTOWN) c = h > 0.55 ? mix([153, 163, 174], [178, 185, 187], hash(px >> 2, py >> 2)) : [139, 153, 169];
      else if (dist === D.URBAN || dist === D.TOWN) { const roof = hash(px >> 1, py >> 1); c = roof > 0.5 ? (roof > 0.8 ? [173, 166, 153] : [171, 181, 176]) : mix([133, 168, 136], [159, 181, 151], n); }
      else if (dist === D.FAVELA) { const roof = hash(px, py); c = roof > 0.2 ? mix([157, 129, 112], [187, 157, 132], roof) : [143, 128, 119]; }
      else if (dist === D.GHETTO) c = hash(px >> 3, py >> 3) > 0.45 ? [167, 165, 162] : [141, 145, 150];
      else if (dist === D.INDUSTRIAL) c = hash(px >> 3, py >> 2) > 0.4 ? mix([132, 142, 150], [168, 172, 176], hash(px >> 3, py >> 3)) : [96, 96, 92];
      else if (dist === D.PORT) { const k = hash(px >> 1, py); c = k > 0.6 ? [[178, 64, 52], [58, 98, 150], [200, 160, 60], [80, 132, 88]][(k * 13 | 0) % 4] : [128, 126, 120]; }
      else c = [120, 140, 70];
      const o = (py * BW + px) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    };
    let row = 0;
    const base = {
      canvas, BP, done: false,
      // pinta linhas até estourar o orçamento (ms); Infinity termina de uma vez
      step(ms) {
        const t0 = performance.now();
        while (row < BH && performance.now() - t0 < ms) { for (let px = 0; px < BW; px++) pixel(px, row); row++; }
        if (row >= BH && !base.done) { bg.putImageData(img, 0, 0); base.done = true; }
        return base.done;
      },
    };
    return base;
  };

  // camadas vetoriais por cima da base. S(x, y) -> [sx, sy] em px da tela; scale em px/m; dpr multiplica traços e letras
  COG.drawAtlasLayers = function (g, world, S, scale, dpr, opt = {}) {
    const { geo, roads, landmarks } = world;
    const strokePoly = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => { const [sx, sy] = S(p[0], p[1]); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); }); g.stroke(); };
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
    COG.drawTerritoryOverlay?.(g,world,S,scale);
    // vias: contorno + miolo por categoria
    const order = ['street', 'avenue', 'highway'];
    for (const pass of [0, 1]) for (const cls of order) for (const rd of roads) {
      if (rd.cls !== cls) continue;
      const w = px(rd.w), col = pass ? (cls === 'highway' ? '#e3c474' : cls === 'avenue' ? '#f6f4eb' : '#e4eaf0') : 'rgba(29,48,65,0.82)';
      if (cls === 'street' && !pass && scale < 0.25) continue;   // sem contorno escuro nas ruas com o mapa afastado
      strokePoly(rd.pts, pass ? Math.max(w, cls === 'street' ? 0.7 * dpr : 1.4 * dpr) : Math.max(w + 2 * dpr, (cls === 'street' ? 1.2 : 2.6) * dpr), cls === 'street' && pass && scale < 0.25 ? 'rgba(236,230,218,0.55)' : col);
    }
    for (const rd of roads) if (rd.cls === 'rail') { strokePoly(rd.pts, Math.max(px(5), 2 * dpr), '#3c3a38'); g.setLineDash([6 * dpr, 6 * dpr]); strokePoly(rd.pts, Math.max(px(2), 1 * dpr), '#d9d4c8'); g.setLineDash([]); }
    // pontes
    for (const rd of roads) for (const [a, b] of rd.bridges) { const seg = rd.pts.slice(a, b + 1); strokePoly(seg, Math.max(px(rd.w + 6), 4 * dpr), '#2a2826'); strokePoly(seg, Math.max(px(rd.w), 2 * dpr), '#b9b4aa'); }
    if (opt.labels === false) return;
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
    COG.drawLocationLabels?.(g,world,S,scale,dpr);
  };
})();
