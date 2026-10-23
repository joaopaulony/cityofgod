// worldgen/geo.js — geografia do mundo grande (nível 1): costa, mar, rios e distritos.
// Determinístico a partir da semente; sem DOM (roda no navegador, em Web Worker e no Node).
'use strict';
(function (G) {
  const COG = G.COG = G.COG || {};

  // ---------- semente oficial e dimensões ----------
  COG.WORLD_SEED = 20261024;                 // mundo fixo: todos os jogadores no mesmo mapa
  COG.WORLD_W = 7200; COG.WORLD_H = 6200;    // metros: ~30 km² de terra firme + mar
  COG.CELL = 20;                             // grade de distritos (m)

  // ---------- utilidades determinísticas ----------
  COG.rng = seed => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const smooth = t => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  COG.clamp = clamp; COG.lerp = lerp;
  COG.makeNoise = seed => {
    const r = COG.rng(seed), P = new Uint8Array(512), p = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) P[i] = p[i & 255];
    const h = (x, y) => P[(P[x & 255] + y) & 255] / 255;
    const v = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), w = smooth(y - yi);
      return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), w);
    };
    return (x, y, oct = 4) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += v(x * f + i * 17.3, y * f - i * 9.1) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; };
  };

  // ---------- tipos de distrito ----------
  COG.D = { SEA: 0, BEACH: 1, DOWNTOWN: 2, URBAN: 3, FAVELA: 4, GHETTO: 5, INDUSTRIAL: 6, PORT: 7, FARM: 8, FOREST: 9, TOWN: 10, AIRPORT: 11, RURAL: 12, RIVER: 13 };
  COG.D_NAMES = ['mar', 'praia', 'centro', 'bairro', 'favela', 'conjunto', 'industrial', 'porto', 'fazenda', 'floresta', 'cidade do interior', 'aeroporto', 'campo', 'rio'];

  // distância de ponto a polilinha (array de [x,y])
  function distPoly(px, py, pts) {
    let best = 1e18;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1;
      const u = clamp(((px - ax) * ex + (py - ay) * ey) / l2, 0, 1), dx = px - ax - ex * u, dy = py - ay - ey * u;
      const d = dx * dx + dy * dy; if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  COG.distPoly = distPoly;

  // ---------- geração ----------
  COG.buildGeo = function (seed = COG.WORLD_SEED) {
    const W = COG.WORLD_W, H = COG.WORLD_H, C = COG.CELL, NX = W / C, NY = H / C;
    const r = COG.rng(seed), N1 = COG.makeNoise(seed + 1), N2 = COG.makeNoise(seed + 2), N3 = COG.makeNoise(seed + 3);
    const geo = { seed, W, H, C, NX, NY, anchors: {} };

    // costa: mar ao sul e a leste, com baía da cidade e enseadas
    const bay = { x: W * 0.55, y: H * 0.83, r: 620 };
    geo.bay = bay;
    const landField = (x, y) => {
      const south = H * 0.825 + (N1(x * 0.0007, 3.1) - 0.5) * 900 + (N1(x * 0.003, 7.7) - 0.5) * 160 - y;
      const east = W * 0.905 + (N1(y * 0.0008, 11.3) - 0.5) * 800 + (N1(y * 0.004, 2.2) - 0.5) * 140 - x;
      // oeste: costa recortada (a cidade é uma península, sem borda reta de mapa)
      const west = x - (W * 0.045 + (N1(y * 0.0009, 21.7) - 0.5) * 600 + (N1(y * 0.004, 5.5) - 0.5) * 120);
      let f = Math.min(south, east, west);
      const db = Math.hypot((x - bay.x) / 1.35, y - bay.y) - bay.r - (N2(x * 0.004, y * 0.004) - 0.5) * 140;
      f = Math.min(f, db);
      return f;
    };
    geo.landField = landField;
    const land = new Uint8Array(NX * NY);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) land[j * NX + i] = landField(i * C + C / 2, j * C + C / 2) > 0 ? 1 : 0;
    // ilha pequena ao largo (marco visual do horizonte)
    const isle = { x: W * 0.66, y: H * 0.95, r: 140 };
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const x = i * C, y = j * C; if (Math.hypot(x - isle.x, (y - isle.y) * 1.6) < isle.r + (N3(x * 0.01, y * 0.01) - 0.5) * 60) land[j * NX + i] = 1; }
    geo.land = land;

    // distância até o mar (transformada de chanfro, em metros)
    const coastD = new Float32Array(NX * NY).fill(1e9);
    for (let k = 0; k < NX * NY; k++) if (!land[k]) coastD[k] = 0;
    const pass = (i, j, di, dj, w) => { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= NX || jj >= NY) return; const v = coastD[jj * NX + ii] + w; if (v < coastD[j * NX + i]) coastD[j * NX + i] = v; };
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { pass(i, j, -1, 0, C); pass(i, j, 0, -1, C); pass(i, j, -1, -1, C * 1.414); pass(i, j, 1, -1, C * 1.414); }
    for (let j = NY - 1; j >= 0; j--) for (let i = NX - 1; i >= 0; i--) { pass(i, j, 1, 0, C); pass(i, j, 0, 1, C); pass(i, j, 1, 1, C * 1.414); pass(i, j, -1, 1, C * 1.414); }
    geo.coastD = coastD;
    const cell = (x, y) => clamp(Math.floor(y / C), 0, NY - 1) * NX + clamp(Math.floor(x / C), 0, NX - 1);
    geo.cell = cell;
    geo.isLand = (x, y) => land[cell(x, y)] === 1;
    geo.coastDist = (x, y) => coastD[cell(x, y)];

    // âncoras dos distritos (regras de layout, estilo GTA: centro na baía, porto a leste, interior ao norte/oeste)
    const A = geo.anchors;
    A.downtown = { x: bay.x - 40, y: bay.y - bay.r - 520, r: 620 };
    A.port = { x: W * 0.80, y: H * 0.70, r: 420 };
    // porto: no ponto de costa mais próximo do desejado (leste do centro), recuado 180 m terra adentro
    {
      const want = [W * 0.80, H * 0.70]; let best = null, bd = 1e18;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i; if (!land[k] || coastD[k] > C * 1.5) continue;
        const x = i * C + C / 2, y = j * C + C / 2, dd = Math.hypot(x - want[0], y - want[1]);
        if (x > A.downtown.x + 900 && dd < bd) { bd = dd; best = [x, y]; }
      }
      if (best) {   // recua na direção oposta ao mar (gradiente da distância à costa)
        let [x, y] = best;
        for (let s = 0; s < 9; s++) { const gx = geo.coastDist(x + C, y) - geo.coastDist(x - C, y), gy = geo.coastDist(x, y + C) - geo.coastDist(x, y - C), l = Math.hypot(gx, gy) || 1; x += gx / l * 20; y += gy / l * 20; }
        A.port.x = x; A.port.y = y;
      }
    }
    A.industrial = [{ x: W * 0.72, y: H * 0.58, r: 430 }, { x: W * 0.34, y: H * 0.56, r: 380 }];
    A.favelas = [0.8, 2.0, 3.3, 4.3].map((a, k) => { const d = 1050 + r() * 380; return { x: A.downtown.x + Math.cos(a + Math.PI) * d, y: A.downtown.y - Math.abs(Math.sin(a)) * d * 0.9, r: 230 + r() * 120 }; });
    A.ghettos = [{ x: W * 0.64, y: H * 0.47, r: 260 }, { x: W * 0.43, y: H * 0.66, r: 240 }];
    A.urban = { x: A.downtown.x, y: A.downtown.y - 150, r: 1750 };
    A.towns = [{ x: W * 0.16, y: H * 0.26, r: 380, name: 'Vila Serrana' }, { x: W * 0.42, y: H * 0.16, r: 330, name: 'Santa Aurora' },
      { x: W * 0.60, y: H * 0.11, r: 350, name: 'Pedra Alta' }, { x: W * 0.12, y: H * 0.62, r: 340, name: 'Porto Velho' }];
    // aeroportos: pista longa no plano a nordeste; regional a oeste
    A.airports = [
      { name: 'Aeroporto Internacional', x: W * 0.74, y: H * 0.32, len: 2400, ang: -0.35 + r() * 0.15, apron: 420, region: [0.58, 0.18, 0.86, 0.48] },
      { name: 'Aeroporto Regional', x: W * 0.17, y: H * 0.44, len: 1100, ang: 0.55 + r() * 0.2, apron: 220, region: [0.06, 0.34, 0.30, 0.56] },
    ];
    // regra: pista inteira em terra, a 300 m+ da costa e longe da cidade/vilas; busca o ponto mais
    // próximo do desejado dentro da região permitida
    const keepOff = [A.downtown, ...A.towns, ...A.favelas, ...A.ghettos, A.port, ...A.industrial];
    const fits = (ap, x, y) => [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].every(t => {
      const px = x + Math.cos(ap.ang) * ap.len * t, py = y + Math.sin(ap.ang) * ap.len * t;
      return geo.isLand(px, py) && geo.coastDist(px, py) > 300 && keepOff.every(a => Math.hypot(px - a.x, py - a.y) > a.r + 450);
    });
    for (const ap of A.airports) {
      let best = null, bd = 1e18;
      const [rx0, ry0, rx1, ry1] = ap.region, a0 = ap.ang;
      for (const da of [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8]) {   // prefere a orientação sorteada
        ap.ang = a0 + da;
        for (let y = ry0 * H; y <= ry1 * H; y += 80) for (let x = rx0 * W; x <= rx1 * W; x += 80) {
          if (!fits(ap, x, y)) continue;
          const d = Math.hypot(x - ap.x, y - ap.y) + Math.abs(da) * 900; if (d < bd) { bd = d; best = [x, y, ap.ang]; }
        }
      }
      ap.ang = a0;
      if (best) { ap.x = best[0]; ap.y = best[1]; ap.ang = best[2]; ap.ok = true; }
    }

    // rios: nascem ao norte e serpenteiam até o mar
    geo.rivers = [];
    for (const sx of [W * 0.30, W * 0.62]) {
      let x = sx, y = 0, a = Math.PI / 2; const pts = [[x, y]];
      for (let k = 0; k < 400; k++) {
        a += (N2(k * 0.08, sx) - 0.5) * 0.5;
        // atraído para o sul, desviando do centro da cidade
        const toSea = Math.PI / 2, dd = Math.hypot(x - A.downtown.x, y - A.downtown.y);
        a = lerp(a, toSea, 0.08) + (dd < 900 ? Math.sign(x - A.downtown.x || 1) * 0.15 : 0);
        x += Math.cos(a) * 30; y += Math.sin(a) * 30; pts.push([x, y]);
        if (!geo.isLand(x, y) || y > H) break;
      }
      geo.rivers.push({ pts, w: sx < W / 2 ? 34 : 26 });
    }

    // leito dos rios marcado na grade uma vez (evita medir distância a cada célula)
    const riverMask = new Uint8Array(NX * NY);
    for (const rv of geo.rivers) for (let k = 0; k < rv.pts.length - 1; k++) {
      const [ax, ay] = rv.pts[k], [bx, by] = rv.pts[k + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) / 8), rr = rv.w / 2 + 2;
      for (let t = 0; t <= n; t++) {
        const x = lerp(ax, bx, t / n), y = lerp(ay, by, t / n);
        for (let j = Math.floor((y - rr) / C); j <= Math.floor((y + rr) / C); j++) for (let i = Math.floor((x - rr) / C); i <= Math.floor((x + rr) / C); i++) {
          if (i < 0 || j < 0 || i >= NX || j >= NY) continue;
          if (Math.hypot(i * C + C / 2 - x, j * C + C / 2 - y) < rr) riverMask[j * NX + i] = 1;
        }
      }
    }
    geo.riverMask = riverMask;
    // campo de distritos
    const dist = new Uint8Array(NX * NY), D = COG.D;
    const runwayRect = (ap, x, y, pad) => { const dx = x - ap.x, dy = y - ap.y, u = dx * Math.cos(ap.ang) + dy * Math.sin(ap.ang), v = -dx * Math.sin(ap.ang) + dy * Math.cos(ap.ang); return Math.abs(u) < ap.len / 2 + 120 + pad && v > -160 - pad && v < ap.apron + pad; };
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i, x = i * C + C / 2, y = j * C + C / 2;
      if (!land[k]) { dist[k] = D.SEA; continue; }
      const n = N3(x * 0.003, y * 0.003) - 0.5, wob = 1 + n * 0.5;
      let d = -1;
      if (riverMask[k]) d = D.RIVER;
      else if (A.airports.some(ap => runwayRect(ap, x, y, n * 60))) d = D.AIRPORT;
      else if (Math.hypot(x - A.port.x, y - A.port.y) < A.port.r * wob && coastD[k] < 500) d = D.PORT;
      else if (A.industrial.some(a => Math.hypot(x - a.x, y - a.y) < a.r * wob)) d = D.INDUSTRIAL;
      else if (Math.hypot(x - A.downtown.x, y - A.downtown.y) < A.downtown.r * wob) d = D.DOWNTOWN;
      else if (A.favelas.some(a => Math.hypot(x - a.x, y - a.y) < a.r * (1 + n * 0.8))) d = D.FAVELA;
      else if (A.ghettos.some(a => Math.hypot(x - a.x, y - a.y) < a.r * wob)) d = D.GHETTO;
      else if (coastD[k] < 70 + n * 60) d = D.BEACH;
      else if (Math.hypot(x - A.urban.x, (y - A.urban.y) * 1.25) < A.urban.r * (1 + n * 0.35)) d = D.URBAN;
      else if (A.towns.some(a => Math.hypot(x - a.x, y - a.y) < a.r * wob)) d = D.TOWN;
      else if (y < 330 + N2(x * 0.0015, 4.4) * 380) d = D.FOREST;   // serra ao norte: floresta fechada como limite natural
      else {
        const fo = N1(x * 0.0012 + 40, y * 0.0012 + 40) + (y < H * 0.35 && x < W * 0.5 ? 0.12 : 0);
        d = fo > 0.6 ? D.FOREST : (N2(x * 0.001 + 9, y * 0.001) > 0.42 ? D.FARM : D.RURAL);
      }
      dist[k] = d;
    }
    geo.dist = dist;
    geo.districtAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? D.SEA : dist[cell(x, y)];
    geo.noise = { N1, N2, N3 };
    return geo;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = COG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
