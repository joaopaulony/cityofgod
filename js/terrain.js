// terrain.js — chão em alta resolução, pintado por blocos de 16 m sob demanda.
// 1) "shader" por pixel mistura materiais (grama, mata, terra, lama, poças, trilha, areia seca/molhada,
//    água, asfalto, sarjeta, meio-fio, calçada) a partir de campos de ruído e distâncias;
// 2) detalhes vetoriais por cima (lâminas de grama, folhas, gravetos, pedrinhas, conchas, vitórias-régias,
//    faixas gastas, remendos, juntas); 3) pisos das casas e sombras assadas.
// Ruído de detalhe é ancorado no mundo, então os blocos se encaixam sem emenda.
'use strict';

const CH = 16, TP = 56, CPX = CH * TP, PAD = 2, CSZ = CPX + PAD * 2;
const GSTEP = 0.25, GN = CH / GSTEP + 3;          // grade de campos com 1 nó de margem
const MINI = 6;                                    // px/m do minimapa / fallback
const terrain = { chunks: new Map(), maxChunks: 20, noise: null, frame: 0 };

// ---------- ruído tileável 256² (ancorado no mundo) ----------
function tileNoise(rnd, octaves) {
  const N = 256, out = new Float32Array(N * N);
  let total = 0;
  for (const [cells, amp] of octaves) {
    const lat = new Float32Array(cells * cells); for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    const step = N / cells;
    for (let y = 0; y < N; y++) {
      const gy = y / step, j0 = Math.floor(gy), fy = smooth(gy - j0), j1 = (j0 + 1) % cells;
      for (let x = 0; x < N; x++) {
        const gx = x / step, i0 = Math.floor(gx), fx = smooth(gx - i0), i1 = (i0 + 1) % cells;
        const a = lerp(lat[j0 * cells + i0], lat[j0 * cells + i1], fx), b = lerp(lat[j1 * cells + i0], lat[j1 * cells + i1], fx);
        out[y * N + x] += lerp(a, b, fy) * amp;
      }
    }
    total += amp;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// ---------- campos amostrados ----------
function bil(grid, N, x, y) {   // grade de 0,5 m
  const fx = clamp(x * 2, 0, N - 1.001), fy = clamp(y * 2, 0, N - 1.001), i = fx | 0, j = fy | 0, u = fx - i, v = fy - j;
  const a = grid[j * N + i], b = grid[j * N + i + 1], c = grid[(j + 1) * N + i], d = grid[(j + 1) * N + i + 1];
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fieldsAt(x, y, o = {}) {
  const N = MAP * 2;
  o.rd = bil(world.roadD, N, x, y); o.tr = bil(terrain.trailD, N, x, y); o.pv = pondVal(x, y);
  o.gt = fbm(x * 0.09, y * 0.09, 4); o.dry = fbm(x * 0.045 + 11.3, y * 0.045 + 90.1, 3);
  o.dirt = fbm(x * 0.13 + 50, y * 0.13 + 50, 3); o.wet = fbm(x * 0.11 + 200, y * 0.11 + 7, 3); o.fo = forest(x, y);
  return o;
}
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// pesos de material (mesma regra do shader por pixel, usada p/ espalhar detalhes)
function weightsAt(f, d1 = 0.5) {
  const w = {};
  w.forest = sstep(0.55, 0.69, f.fo) * 0.85;
  w.dirt = sstep(0.66, 0.72, f.dirt + (d1 - 0.5) * 0.08);
  w.mud = Math.max(sstep(1.65, 1.15, f.pv) * sstep(0.45, 0.65, f.wet), w.dirt * sstep(0.62, 0.7, f.wet));
  w.trail = 1 - sstep(0.55, 1.05, f.tr + (d1 - 0.5) * 0.35);
  w.sand = 1 - sstep(1.12, 1.26, f.pv);
  w.water = f.pv < 1 ? 1 : 0;
  w.paved = f.rd < ROAD_W + SIDE + 0.05 ? 1 : 0;
  w.grass = Math.max(0, 1 - Math.max(w.dirt, w.mud, w.trail, w.sand, w.water, w.paved)) * (1 - w.forest * 0.7);
  return w;
}

// ---------- inicialização (chamada por paintGround) ----------
function terrainInit() {
  const rnd = mulberry(world.seed * 7 + 3);
  terrain.n1 = tileNoise(rnd, [[64, 0.5], [32, 1], [16, 0.7]]);     // tufos/manchas ~0,1–0,3 m
  terrain.n2 = new Float32Array(65536); for (let i = 0; i < 65536; i++) terrain.n2[i] = rnd();   // grão
  terrain.n3 = tileNoise(rnd, [[8, 1], [4, 0.6]]);                 // variação larga ~1–2 m
  // distância até as trilhas (grade de 0,5 m)
  const N = MAP * 2, D = new Float32Array(N * N).fill(99);
  for (const t of world.trails) for (const p of t) {
    const ci = Math.round(p[0] * 2), cj = Math.round(p[1] * 2);
    for (let j = cj - 8; j <= cj + 8; j++) for (let i = ci - 8; i <= ci + 8; i++) {
      if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const d = Math.hypot(i / 2 - p[0], j / 2 - p[1]); if (d < D[j * N + i]) D[j * N + i] = d;
    }
  }
  terrain.trailD = D;
  // contorno do lago (p/ a animação da água)
  if (world.pond) {
    const p = world.pond, poly = [];
    for (let k = 0; k < 72; k++) {
      const a = k / 72 * TAU; let lo = 0, hi = 3;
      for (let it = 0; it < 18; it++) { const m = (lo + hi) / 2; pondVal(p.x + Math.cos(a) * p.rx * m, p.y + Math.sin(a) * p.ry * m) < 1 ? lo = m : hi = m; }
      poly.push([p.x + Math.cos(a) * p.rx * lo, p.y + Math.sin(a) * p.ry * lo]);
    }
    world.pondPoly = poly;
  }
  // minimapa / fallback: versão rápida vetorial, refinada quando cada bloco fica pronto
  const mc = makeCanvas(MAP * MINI, MAP * MINI), mg = mc.getContext('2d');
  mg.fillStyle = '#5d7a34'; mg.fillRect(0, 0, mc.width, mc.height);
  for (let y = 0; y < MAP; y += 1) for (let x = 0; x < MAP; x += 1) {
    const f = forest(x + 0.5, y + 0.5);
    if (f > 0.58) { mg.fillStyle = 'rgba(40,52,24,0.55)'; mg.fillRect(x * MINI, y * MINI, MINI, MINI); }
  }
  mg.lineCap = 'round'; mg.lineJoin = 'round';
  const st = (pts, w, col) => { mg.strokeStyle = col; mg.lineWidth = w * MINI; mg.beginPath(); pts.forEach((p, i) => i ? mg.lineTo(p.x * MINI, p.y * MINI) : mg.moveTo(p.x * MINI, p.y * MINI)); mg.stroke(); };
  for (const r of world.roads) st(r.pts, (ROAD_W + SIDE) * 2, '#a6a196');
  for (const r of world.roads) st(r.pts, ROAD_W * 2, '#3c3d41');
  if (world.pondPoly) { mg.fillStyle = '#35585f'; mg.beginPath(); world.pondPoly.forEach(([x, y], i) => i ? mg.lineTo(x * MINI, y * MINI) : mg.moveTo(x * MINI, y * MINI)); mg.fill(); }
  terrain.mini = mc; terrain.miniCtx = mg;
}

// ---------- itens de detalhe (determinísticos por bloco) ----------
function chunkItems(ci, cj) {
  while (!chunkItemsStep(ci, cj, 1e9));
  return terrain.items.get(ci + ',' + cj);
}
// Gera os detalhes de um bloco em partes (maxIter candidatos por chamada), retomando de onde parou:
// a sequência do sorteio é a mesma de uma geração única. Devolve true quando terminou.
function chunkItemsStep(ci, cj, maxIter) {
  const key = ci + ',' + cj;
  terrain.items = terrain.items || new Map();
  terrain.itemGen = terrain.itemGen || new Map();
  if (terrain.items.has(key)) return true;
  let G = terrain.itemGen.get(key);
  if (!G) { G = { r: mulberry(world.seed * 131 + ci * 7919 + cj * 104729), items: [], f: {}, i: 0 }; terrain.itemGen.set(key, G); }
  const r = G.r, items = G.items, f = G.f;
  const x0 = ci * CH, y0 = cj * CH, n = CH * CH * 26;
  const LUSH = ['#416a28', '#527b32', '#65923e', '#7fa14b', '#a1bc65'], DRY = ['#77703a', '#92874b', '#afa361', '#777044'];
  const LITTER = ['#6b4a2a', '#8a5a2c', '#9a6e34', '#5e5a2c', '#7a6a3a', '#a2552a'];
  const iEnd = Math.min(n, G.i + maxIter);
  for (let i = G.i; i < iEnd; i++) {
    const x = x0 + r() * CH, y = y0 + r() * CH;
    fieldsAt(x, y, f); const w = weightsAt(f), pick = r();
    if (w.paved) {
      const sw = f.rd > ROAD_W + 0.2;
      if (sw) { if (pick < 0.02) items.push({ t: 'gum', x, y, s: 0.015 + r() * 0.02 }); else if (pick < 0.035 && f.rd > ROAD_W + SIDE - 0.25) items.push({ t: 'blade', x, y, l: 0.05 + r() * 0.06, a: r() * 0.8 - 0.4, c: LUSH[(r() * 3) | 0] }); }
      else if (f.rd > ROAD_W - 0.45 && pick < 0.05) items.push(r() < 0.6 ? { t: 'leaf', x, y, s: 0.05 + r() * 0.03, a: r() * TAU, c: LITTER[(r() * LITTER.length) | 0] } : { t: 'paper', x, y, a: r() * TAU, s: 0.04 + r() * 0.04 });
      else if (f.rd < ROAD_W - 0.5 && pick < 0.004) items.push({ t: 'grit', x, y, s: 0.02 + r() * 0.03 });
      continue;
    }
    if (w.water) {
      if (f.pv > 0.72 && f.pv < 0.95 && pick < 0.03) items.push({ t: 'lily', x, y, s: 0.12 + r() * 0.14, a: r() * TAU, fl: r() < 0.12 });
      else if (f.pv > 0.95 && pick < 0.25) items.push({ t: 'foam', x, y, s: 0.04 + r() * 0.08 });
      continue;
    }
    if (pick < w.grass * 0.82) {
      const dryk = sstep(0.45, 0.68, f.dry), pal = r() < dryk ? DRY : LUSH;
      items.push({ t: 'blade', x, y, l: 0.06 + r() * 0.1 * (1 - w.trail), a: r() * 0.9 - 0.45, c: pal[(r() * pal.length) | 0] });
      if (r() < 0.0132 * (1 - dryk)) items.push({ t: 'flower', x, y, c: ['#f2efe2', '#f4d34a', '#c9a2d8', '#f0a0b0', '#d3a66f', '#a7b6d8', '#f0dca4'][(r() * 7) | 0], k: 3 + ((r() * 4) | 0) });
      else if (r() < 0.02) items.push({ t: 'clover', x, y, s: 0.03 + r() * 0.02 });
    } else if (pick < w.grass * 0.82 + w.forest * 0.5) {
      if (r() < 0.82) items.push({ t: 'leaf', x, y, s: 0.04 + r() * 0.04, a: r() * TAU, c: LITTER[(r() * LITTER.length) | 0] });
      else if (r() < 0.6) items.push({ t: 'twig', x, y, s: 0.15 + r() * 0.3, a: r() * TAU });
      else items.push({ t: 'blade', x, y, l: 0.05 + r() * 0.07, a: r() * 0.9 - 0.45, c: LUSH[(r() * 2) | 0] });
    } else if (pick < 0.97 && (w.dirt > 0.4 || w.trail > 0.4) && w.mud < 0.5) {
      if (r() < 0.16) items.push({ t: 'pebble', x, y, s: 0.02 + r() * 0.05, a: r() * TAU });
      else if (r() < 0.012 && f.dry > 0.55) items.push({ t: 'crack', x, y, s: 0.25 + r() * 0.35, a: r() * TAU });
    } else if (w.sand > 0.4 && f.pv > 1.05) {
      if (r() < 0.06) items.push({ t: 'shell', x, y, s: 0.015 + r() * 0.02, a: r() * TAU });
      else if (r() < 0.05 && f.pv > 1.12) items.push({ t: 'ripple', x, y, s: 0.15 + r() * 0.2, a: Math.atan2(y - world.pond.y, x - world.pond.x) + Math.PI / 2 });
    } else if (w.mud > 0.5 && r() < 0.05) items.push({ t: 'pebble', x, y, s: 0.02 + r() * 0.03, a: r() * TAU, wet: 1 });
  }
  G.i = iEnd;
  if (G.i < n) return false;
  // remendos, rachaduras e manchas no asfalto deste bloco
  for (let i = 0; i < 40; i++) {
    const x = x0 + r() * CH, y = y0 + r() * CH, rd = bil(world.roadD, MAP * 2, x, y);
    if (rd > ROAD_W - 0.5) continue;
    // direção da rua no ponto = perpendicular ao gradiente da distância
    const N2 = MAP * 2, gx = bil(world.roadD, N2, x + 0.25, y) - bil(world.roadD, N2, x - 0.25, y), gy = bil(world.roadD, N2, x, y + 0.25) - bil(world.roadD, N2, x, y - 0.25);
    const along = Math.atan2(gy, gx) + Math.PI / 2, pick = r();
    if (pick < 0.4) items.push({ t: 'acrack', x, y, s: 0.5 + r() * 1.2, a: along + (r() - 0.5) * 1.2, seed: (r() * 1e9) | 0 });
    else if (pick < 0.62 && Math.abs(rd - 1.75) < 0.6) items.push({ t: 'oil', x, y, s: 0.2 + r() * 0.35, a: along });
    else if (pick < 0.7) items.push({ t: 'patch', x, y, s: 0.7 + r() * 1.1, a: along, k: 0.4 + r() * 0.4 });
  }
  // Manchas silvestres em pequenos grupos, com cores que seguem o mesmo bioma.
  // Detalhe assado no bloco: nenhum custo de animacao adicional por quadro.
  const blooms=['#eee6ce','#ead064','#ccacd1','#db9ca9',
    '#9eaad0','#e6a274','#ca7778','#ede0a8'];
  for(let i=0;i<17;i++){
    const x=x0+r()*CH,y=y0+r()*CH;
    fieldsAt(x,y,f);
    const w=weightsAt(f);
    if(w.paved||w.water||w.grass<.30||w.forest>.67||
       w.mud>.32||w.sand>.38||f.rd<ROAD_W+SIDE+1.0||
       f.pv<1.20)continue;
    items.push({t:'wildflower',x,y,c:blooms[(r()*blooms.length)|0],
      k:5+((r()*6)|0),radius:.16+r()*.19,phase:r()*TAU});
  }
  terrain.items.set(key, items); terrain.itemGen.delete(key);
  return true;
}

// ---------- pintura de um bloco (em etapas p/ não travar o jogo) ----------
function startChunk(ci, cj) {
  const c = makeCanvas(CSZ, CSZ), g = c.getContext('2d');
  const ch = { ci, cj, c, g, stage: 0, row: 0, done: false, used: terrain.frame };
  terrain.chunks.set(ci + ',' + cj, ch);
  return ch;
}
function chunkFields(ch) {
  const x0 = ch.ci * CH - GSTEP, y0 = ch.cj * CH - GSTEP, F = {};
  for (const k of ['rd', 'tr', 'pv', 'gt', 'dry', 'dirt', 'wet', 'fo']) F[k] = new Float32Array(GN * GN);
  const o = {};
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
    fieldsAt(x0 + i * GSTEP, y0 + j * GSTEP, o); const k = j * GN + i;
    for (const key in F) F[key][k] = o[key];
  }
  ch.F = F; ch.img = ch.g.createImageData(CSZ, CSZ);
}
const TC = h => hexToRgb(h);
// Cada pixel do solo continua procedural; apenas as cores de mistura
// refletem o padrão oficial sem trocar bitmaps, rachaduras ou formas.
const COL = Object.fromEntries(Object.entries(VISUAL_REFERENCE.terrain)
  .map(([name,hex])=>[name,TC(hex)]));
function paintRows(ch, rows) {
  const { F, img } = ch, data = img.data, n1 = terrain.n1, n2 = terrain.n2, n3 = terrain.n3;
  const Frd = F.rd, Fpv = F.pv, Ftr = F.tr, Fgt = F.gt, Fdry = F.dry, Fdirt = F.dirt, Fwet = F.wet, Ffo = F.fo;
  const gx0 = ch.ci * CPX - PAD, gy0 = ch.cj * CPX - PAD, inv = 1 / (TP * GSTEP);
  const s0 = ROAD_W + 0.2, s1 = ROAD_W + SIDE;
  const end = Math.min(CSZ, ch.row + rows);
  for (let py = ch.row; py < end; py++) {
    const gyf = (py - PAD) * inv + 1, j = Math.min(GN - 2, gyf | 0), v = gyf - j, ny = ((gy0 + py) & 255) << 8;
    for (let px = 0; px < CSZ; px++) {
      const gxf = (px - PAD) * inv + 1, i = Math.min(GN - 2, gxf | 0), u = gxf - i, k = j * GN + i, k2 = k + GN;
      const w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
      const rd = Frd[k] * w00 + Frd[k + 1] * w10 + Frd[k2] * w01 + Frd[k2 + 1] * w11;
      const pv = Fpv[k] * w00 + Fpv[k + 1] * w10 + Fpv[k2] * w01 + Fpv[k2 + 1] * w11;
      const tr = Ftr[k] * w00 + Ftr[k + 1] * w10 + Ftr[k2] * w01 + Ftr[k2 + 1] * w11;
      const gt = Fgt[k] * w00 + Fgt[k + 1] * w10 + Fgt[k2] * w01 + Fgt[k2 + 1] * w11;
      const dry = Fdry[k] * w00 + Fdry[k + 1] * w10 + Fdry[k2] * w01 + Fdry[k2 + 1] * w11;
      const dirt = Fdirt[k] * w00 + Fdirt[k + 1] * w10 + Fdirt[k2] * w01 + Fdirt[k2 + 1] * w11;
      const wet = Fwet[k] * w00 + Fwet[k + 1] * w10 + Fwet[k2] * w01 + Fwet[k2 + 1] * w11;
      const fo = Ffo[k] * w00 + Ffo[k + 1] * w10 + Ffo[k2] * w01 + Ffo[k2 + 1] * w11;
      const ni = ny | ((gx0 + px) & 255), d1 = n1[ni], d2 = n2[ni], d3 = n3[ni];
      let r, gg, b;
      // --- grama: tom por ruído + tufos + grão com pontas claras/escuras
      const dk = sstep(0.42, 0.72, dry), tone = 0.82 + (gt - 0.5) * 0.55 + (d1 - 0.5) * 0.3;
      const grain = d2 > 0.86 ? 1.2 : d2 < 0.14 ? 0.78 : 0.95 + d2 * 0.1;
      r = lerp(COL.lush[0], COL.dry[0], dk) * tone * grain; gg = lerp(COL.lush[1], COL.dry[1], dk) * tone * grain; b = lerp(COL.lush[2], COL.dry[2], dk) * tone * grain;
      // --- chão de mata: musgo + serrapilheira
      const fw = sstep(0.55, 0.69, fo) * 0.85;
      if (fw > 0) { const t = d3, m = 0.8 + d1 * 0.35; r = lerp(r, lerp(COL.moss[0], COL.litter[0], t) * m, fw); gg = lerp(gg, lerp(COL.moss[1], COL.litter[1], t) * m, fw); b = lerp(b, lerp(COL.moss[2], COL.litter[2], t) * m, fw); }
      // --- terra batida
      const dw = sstep(0.66, 0.72, dirt + (d1 - 0.5) * 0.08);
      if (dw > 0) { const m = (0.84 + d1 * 0.26) * (d2 > 0.92 ? 1.18 : 1); r = lerp(r, COL.dirt[0] * m, dw); gg = lerp(gg, COL.dirt[1] * m, dw); b = lerp(b, COL.dirt[2] * m, dw); }
      // --- lama (perto do lago e na terra úmida) com brilho molhado e poças
      const mw = Math.max(sstep(1.65, 1.15, pv) * sstep(0.45, 0.65, wet), dw * sstep(0.62, 0.7, wet));
      if (mw > 0) {
        const gl = d2 > 0.95 ? 38 : 0, m = 0.78 + d1 * 0.32;
        r = lerp(r, COL.mud[0] * m + gl, mw); gg = lerp(gg, COL.mud[1] * m + gl, mw); b = lerp(b, COL.mud[2] * m + gl, mw);
        const pw = mw * sstep(0.69, 0.72, wet + (d1 - 0.5) * 0.12);
        if (pw > 0) { const m2 = 0.85 + d3 * 0.3 + (d1 - 0.5) * 0.1; r = lerp(r, COL.puddle[0] * m2, pw); gg = lerp(gg, COL.puddle[1] * m2, pw); b = lerp(b, COL.puddle[2] * m2, pw); }
      }
      // --- trilha de terra pisada (centro mais claro e gasto)
      const tw = 1 - sstep(0.55, 1.05, tr + (d1 - 0.5) * 0.35);
      if (tw > 0) { const m = (0.88 + d1 * 0.2 + (1 - sstep(0, 0.45, tr)) * 0.08) * (d2 > 0.9 ? 1.15 : 1); r = lerp(r, COL.trail[0] * m, tw); gg = lerp(gg, COL.trail[1] * m, tw); b = lerp(b, COL.trail[2] * m, tw); }
      // --- areia seca -> areia molhada na beira
      const sw = 1 - sstep(1.12, 1.26, pv + (d1 - 0.5) * 0.04);
      if (sw > 0) {
        const ws = 1 - sstep(1.0, 1.075, pv + (d3 - 0.5) * 0.03), m = (0.9 + d1 * 0.16) * (0.94 + d2 * 0.12);
        r = lerp(r, lerp(COL.sand[0], COL.wsand[0], ws) * m, sw); gg = lerp(gg, lerp(COL.sand[1], COL.wsand[1], ws) * m, sw); b = lerp(b, lerp(COL.sand[2], COL.wsand[2], ws) * m, sw);
      }
      // --- água: rasa esverdeada -> funda, com ondulação e espuma na margem
      if (pv < 1.02) {
        const ww = sstep(1.02, 0.985, pv), dp = sstep(0, 0.6, 1 - pv), rip = 1 + (d3 - 0.5) * 0.14 + (d1 - 0.5) * 0.08;
        let wr = lerp(COL.shallow[0], COL.deep[0], dp) * rip, wg = lerp(COL.shallow[1], COL.deep[1], dp) * rip, wb = lerp(COL.shallow[2], COL.deep[2], dp) * rip;
        const fe = 1 - sstep(0, 0.045, 1 - pv);
        wr = lerp(wr, COL.foam[0], fe * 0.55 * (0.6 + d1 * 0.4)); wg = lerp(wg, COL.foam[1], fe * 0.55 * (0.6 + d1 * 0.4)); wb = lerp(wb, COL.foam[2], fe * 0.55 * (0.6 + d1 * 0.4));
        r = lerp(r, wr, ww); gg = lerp(gg, wg, ww); b = lerp(b, wb, ww);
      }
      // --- calçada / meio-fio / sarjeta / asfalto
      if (rd < s1 + 0.06) {
        const swk = 1 - sstep(s1 - 0.02, s1 + 0.04, rd);
        const m = (0.92 + d3 * 0.13) * (0.93 + d2 * 0.12) * (d1 < 0.22 ? 0.9 : 1), edge = sstep(s1 - 0.25, s1, rd) * 0.35;
        const cr = lerp(COL.walk[0] * m, COL.dirt[0], edge), cg = lerp(COL.walk[1] * m, COL.dirt[1], edge), cb = lerp(COL.walk[2] * m, COL.dirt[2], edge);
        r = lerp(r, cr, swk); gg = lerp(gg, cg, swk); b = lerp(b, cb, swk);
        if (rd < s0 + 0.01) {   // meio-fio: face escura + topo claro chanfrado
          const t = (rd - ROAD_W) / 0.2, top = t > 0.3, m2 = 0.92 + d2 * 0.12;
          const kr = (top ? COL.curbT[0] * (1.06 - t * 0.12) : COL.curbF[0]) * m2, kg = (top ? COL.curbT[1] * (1.06 - t * 0.12) : COL.curbF[1]) * m2, kb = (top ? COL.curbT[2] * (1.06 - t * 0.12) : COL.curbF[2]) * m2;
          r = kr; gg = kg; b = kb;
        }
        if (rd < ROAD_W + 0.015) {
          // asfalto: agregado, trilhas de pneu polidas, faixa de óleo, remendos, sarjeta suja
          const tracks = Math.exp(-((rd - 0.95) ** 2) / 0.09) + Math.exp(-((rd - 2.55) ** 2) / 0.09);
          const oil = Math.exp(-((rd - 1.75) ** 2) / 0.05);
          const agg = d2 > 0.93 ? 1.4 : 0.8 + d2 * 0.36;
          let m3 = lerp(agg, 0.97, tracks * 0.5) * (1 - tracks * 0.07) * (1 - oil * 0.1) * (0.95 + d3 * 0.1);
          let ar = COL.asph[0] * m3 + oil * 4, ag = COL.asph[1] * m3, ab = COL.asph[2] * m3 - oil * 2;
          if (d3 > 0.8 && rd < ROAD_W - 0.6) { const q = 0.93 + d2 * 0.1; ar = COL.patch[0] * q; ag = COL.patch[1] * q; ab = COL.patch[2] * q; }
          const gut = sstep(ROAD_W - 0.4, ROAD_W - 0.05, rd);
          ar = lerp(ar, COL.gutter[0] * (0.85 + d1 * 0.3), gut); ag = lerp(ag, COL.gutter[1] * (0.85 + d1 * 0.3), gut); ab = lerp(ab, COL.gutter[2] * (0.85 + d1 * 0.3), gut);
          const aw = 1 - sstep(ROAD_W - 0.01, ROAD_W + 0.015, rd);
          r = lerp(r, ar, aw); gg = lerp(gg, ag, aw); b = lerp(b, ab, aw);
        }
      }
      const o = (py * CSZ + px) * 4;
      data[o] = r; data[o + 1] = gg; data[o + 2] = b; data[o + 3] = 255;
    }
  }
  ch.row = end;
  if (ch.row >= CSZ) ch.g.putImageData(img, 0, 0);
}

// marcas de rua (em metros, com transformação do bloco)
function paintRoadVectors(ch, g) {
  const r2 = mulberry(world.seed + ch.ci * 31 + ch.cj * 977), J = world.junction, nearJ = p => Math.hypot(p.x - J.x, p.y - J.y) < ROAD_W + 3;
  const bx0 = ch.ci * CH - 2, by0 = ch.cj * CH - 2, bx1 = bx0 + CH + 4, by1 = by0 + CH + 4, inB = p => p.x > bx0 - 4 && p.x < bx1 + 4 && p.y > by0 - 4 && p.y < by1 + 4;
  // faixa dupla amarela gasta: segmentos curtos com opacidade variando
  for (const rd of world.roads) for (const o of [-0.12, 0.12]) for (let i = 0; i < rd.pts.length - 1; i++) {
    const p = rd.pts[i], q = rd.pts[i + 1]; if (!inB(p) || nearJ(p)) continue;
    const wear = terrain.n3[((Math.floor(p.y * TP) & 255) << 8) | (Math.floor(p.x * TP) & 255)];
    g.strokeStyle = `rgba(214,176,62,${0.45 + wear * 0.45})`; g.lineWidth = 0.1;
    g.beginPath(); g.moveTo(p.x + p.nx * o, p.y + p.ny * o); g.lineTo(q.x + q.nx * o, q.y + q.ny * o); g.stroke();
  }
  // faixas de pedestre gastas
  for (const rd of world.roads) {
    let ci = 0, cd = 1e9; rd.pts.forEach((p, i) => { const d = Math.hypot(p.x - J.x, p.y - J.y); if (d < cd) { cd = d; ci = i; } });
    for (const dir of [-1, 1]) {
      const p = rd.pts[ci + dir * Math.round((ROAD_W + 3.2) * 2)]; if (!p || !inB(p)) continue;
      g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.ty, p.tx));
      for (let k = -3; k < 3; k++) {
        g.fillStyle = 'rgba(222,220,210,0.82)'; g.fillRect(-0.85, k * 1.12 + 0.28, 1.7, 0.6);
        g.fillStyle = 'rgba(58,59,63,0.55)';
        for (let s = 0; s < 70; s++) g.fillRect(-0.85 + r2() * 1.7, k * 1.12 + 0.28 + r2() * 0.6, 0.02 + r2() * 0.05, 0.02 + r2() * 0.04);
      }
      g.restore();
    }
  }
  // bueiros junto ao meio-fio
  for (const rd of world.roads) for (let i = 30; i < rd.pts.length; i += 55) {
    const p = rd.pts[i], s = i % 2 ? 1 : -1; if (!inB(p) || nearJ(p)) continue;
    g.save(); g.translate(p.x + p.nx * s * (ROAD_W - 0.4), p.y + p.ny * s * (ROAD_W - 0.4)); g.rotate(Math.atan2(p.ty, p.tx));
    g.fillStyle = '#7d7a72'; g.fillRect(-0.48, -0.3, 0.96, 0.6);
    g.fillStyle = '#1c1d20'; g.fillRect(-0.4, -0.22, 0.8, 0.44);
    g.fillStyle = '#5a5b5f'; for (let k = 0; k < 7; k++) g.fillRect(-0.37 + k * 0.11, -0.2, 0.05, 0.4);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(-0.48, -0.3, 0.96, 0.03);
    g.restore();
  }
  // juntas das placas de calçada (perpendiculares) + junta longitudinal
  g.strokeStyle = 'rgba(70,66,58,0.55)'; g.lineWidth = 0.022;
  for (const rd of world.roads) for (let i = 0; i < rd.pts.length; i += 3) {
    const p = rd.pts[i]; if (!inB(p)) continue;
    for (const s of [1, -1]) {
      const ax = p.x + p.nx * s * (ROAD_W + 0.2), ay = p.y + p.ny * s * (ROAD_W + 0.2);
      if (bil(world.roadD, MAP * 2, ax, ay) < ROAD_W + 0.1) continue;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(p.x + p.nx * s * (ROAD_W + SIDE), p.y + p.ny * s * (ROAD_W + SIDE)); g.stroke();
    }
  }
  // brilho no canto do meio-fio
  g.strokeStyle = 'rgba(235,230,220,0.35)'; g.lineWidth = 0.025;
  for (const rd of world.roads) for (const s of [1, -1]) {
    g.beginPath(); let on = false;
    for (const p of rd.pts) {
      const x = p.x + p.nx * s * (ROAD_W + 0.08), y = p.y + p.ny * s * (ROAD_W + 0.08);
      if (!inB(p) || bil(world.roadD, MAP * 2, x, y) < ROAD_W + 0.04) { on = false; continue; }
      on ? g.lineTo(x, y) : g.moveTo(x, y); on = true;
    }
    g.stroke();
  }
}

// itens agrupados por cor (um path por cor = rápido)
function paintItems(ch, g, from = 0, to = Infinity) {
  if (!ch._keys) {
    const x0 = ch.ci * CH - 0.4, y0 = ch.cj * CH - 0.4, x1 = x0 + CH + 0.8, y1 = y0 + CH + 0.8;
    const all = [];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ci = ch.ci + di, cj = ch.cj + dj; if (ci < 0 || cj < 0 || ci * CH >= MAP || cj * CH >= MAP) continue;
      for (const it of chunkItems(ci, cj)) if (it.x > x0 && it.x < x1 && it.y > y0 && it.y < y1) all.push(it);
    }
    const bk = new Map(), bucket = (k, f) => { if (!bk.has(k)) bk.set(k, []); bk.get(k).push(f); };
    for (const it of all) bucket(it.t + '|' + (it.c || ''), it);
    const order = ['oil', 'patch', 'acrack', 'grit', 'paper', 'gum', 'crack', 'pebble', 'shell', 'ripple', 'twig', 'leaf', 'clover', 'blade', 'flower', 'wildflower', 'foam', 'lily'];
    ch._buckets = bk;
    ch._keys = [...bk.keys()].sort((a, b) => order.indexOf(a.split('|')[0]) - order.indexOf(b.split('|')[0]));
  }
  const buckets = ch._buckets, keys = ch._keys.slice(from, to);
  g.lineCap = 'round';
  for (const key of keys) {
    const its = buckets.get(key), t = key.split('|')[0], col = key.split('|')[1];
    if (t === 'blade') {
      // sombra da base + lâmina curva
      g.strokeStyle = 'rgba(20,32,10,0.35)'; g.lineWidth = 0.022; g.beginPath();
      for (const b of its) { g.moveTo(b.x + 0.012, b.y + 0.004); g.lineTo(b.x + b.a * b.l * 0.4 + 0.012, b.y - b.l * 0.3 + 0.004); }
      g.stroke();
      g.strokeStyle = col; g.lineWidth = 0.02; g.beginPath();
      for (const b of its) { g.moveTo(b.x, b.y); g.quadraticCurveTo(b.x + b.a * b.l * 0.3, b.y - b.l * 0.6, b.x + b.a * b.l, b.y - b.l); }
      g.stroke();
    } else if (t === 'leaf') {
      g.fillStyle = 'rgba(20,16,8,0.25)'; g.beginPath();
      for (const l of its) { g.moveTo(l.x + l.s + 0.012, l.y + 0.012); g.ellipse(l.x + 0.012, l.y + 0.012, l.s, l.s * 0.5, l.a, 0, TAU); }
      g.fill();
      g.fillStyle = col; g.beginPath();
      for (const l of its) { g.moveTo(l.x + l.s, l.y); g.ellipse(l.x, l.y, l.s, l.s * 0.5, l.a, 0, TAU); }
      g.fill();
      g.strokeStyle = 'rgba(40,24,10,0.45)'; g.lineWidth = 0.008; g.beginPath();
      for (const l of its) { g.moveTo(l.x - Math.cos(l.a) * l.s, l.y - Math.sin(l.a) * l.s); g.lineTo(l.x + Math.cos(l.a) * l.s, l.y + Math.sin(l.a) * l.s); }
      g.stroke();
    } else if (t === 'twig') {
      g.strokeStyle = '#4a3a26'; g.lineWidth = 0.018; g.beginPath();
      for (const w of its) { const ex = w.x + Math.cos(w.a) * w.s, ey = w.y + Math.sin(w.a) * w.s; g.moveTo(w.x, w.y); g.lineTo(ex, ey); g.moveTo(lerp(w.x, ex, 0.55), lerp(w.y, ey, 0.55)); g.lineTo(lerp(w.x, ex, 0.55) + Math.cos(w.a + 0.6) * w.s * 0.3, lerp(w.y, ey, 0.55) + Math.sin(w.a + 0.6) * w.s * 0.3); }
      g.stroke();
    } else if (t === 'pebble') {
      for (const p of its) {
        const base = p.wet ? '#5a5248' : ['#8a8276', '#9c9384', '#7a7166', '#a89f8d'][(p.x * 97 + p.y * 31 | 0) & 3];
        g.fillStyle = 'rgba(25,18,10,0.35)'; g.beginPath(); g.ellipse(p.x + p.s * 0.35, p.y + p.s * 0.3, p.s, p.s * 0.7, p.a, 0, TAU); g.fill();
        g.fillStyle = base; g.beginPath(); g.ellipse(p.x, p.y, p.s, p.s * 0.7, p.a, 0, TAU); g.fill();
        g.fillStyle = p.wet ? 'rgba(255,255,255,0.35)' : 'rgba(255,250,235,0.3)'; g.beginPath(); g.ellipse(p.x - p.s * 0.3, p.y - p.s * 0.25, p.s * 0.4, p.s * 0.25, p.a, 0, TAU); g.fill();
      }
    } else if (t === 'flower') {
      for (const f of its) for (let k = 0; k < f.k; k++) {
        const a = k * 2.4 + f.x * 13, d = 0.03 + (k % 3) * 0.02;
        g.fillStyle = col; g.beginPath(); g.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 0.018, 0, TAU); g.fill();
        g.fillStyle = 'rgba(60,40,10,0.6)'; g.beginPath(); g.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 0.006, 0, TAU); g.fill();
      }
    } else if (t === 'wildflower') {
      // Cada miolo tem 5 petalas com leve variacao; folhas e caule por baixo.
      // Todos os pontos estao em coordenadas do mundo, sem imagem importada.
      for(const f of its){
        for(let k=0;k<f.k;k++){
          const a=f.phase+k*2.39996,
            d=f.radius*Math.sqrt((k+.55)/f.k),
            x=f.x+Math.cos(a)*d,y=f.y+Math.sin(a)*d;
          g.strokeStyle='#52783b';g.lineWidth=.014;g.beginPath();
          g.moveTo(x+.016,y+.035);g.lineTo(x,y);g.stroke();
          g.fillStyle=col;
          for(let j=0;j<5;j++){
            const pet=j*TAU/5+a,r=.027+(k%3)*.002;
            g.beginPath();g.ellipse(x+Math.cos(pet)*.028,
              y+Math.sin(pet)*.028,r,.017,pet,0,TAU);g.fill();
          }
          g.fillStyle='#a68a44';g.beginPath();g.arc(x,y,.012,0,TAU);g.fill();
        }
      }
    } else if (t === 'clover') {
      g.fillStyle = '#3d6a28'; g.beginPath();
      for (const c of its) for (let k = 0; k < 3; k++) { const a = k * 2.09; g.moveTo(c.x + Math.cos(a) * c.s * 0.6 + c.s * 0.5, c.y + Math.sin(a) * c.s * 0.6); g.arc(c.x + Math.cos(a) * c.s * 0.6, c.y + Math.sin(a) * c.s * 0.6, c.s * 0.5, 0, TAU); }
      g.fill();
    } else if (t === 'crack') {
      g.strokeStyle = 'rgba(55,40,24,0.55)'; g.lineWidth = 0.012; g.beginPath();
      for (const c of its) { let x = c.x, y = c.y, a = c.a; g.moveTo(x, y); for (let k = 0; k < 5; k++) { a += Math.sin(k * 7 + c.x) * 0.7; x += Math.cos(a) * c.s / 5; y += Math.sin(a) * c.s / 5; g.lineTo(x, y); } }
      g.stroke();
    } else if (t === 'shell') {
      g.fillStyle = '#e8e2d2'; g.beginPath(); for (const s of its) { g.moveTo(s.x + s.s, s.y); g.ellipse(s.x, s.y, s.s, s.s * 0.6, s.a, 0, TAU); } g.fill();
    } else if (t === 'ripple') {
      g.strokeStyle = 'rgba(220,205,165,0.45)'; g.lineWidth = 0.014; g.beginPath();
      for (const r of its) { g.moveTo(r.x - Math.cos(r.a) * r.s, r.y - Math.sin(r.a) * r.s); g.quadraticCurveTo(r.x + Math.sin(r.a) * 0.03, r.y - Math.cos(r.a) * 0.03, r.x + Math.cos(r.a) * r.s, r.y + Math.sin(r.a) * r.s); }
      g.stroke();
    } else if (t === 'foam') {
      g.fillStyle = 'rgba(225,230,215,0.28)'; g.beginPath(); for (const f of its) { g.moveTo(f.x + f.s, f.y); g.ellipse(f.x, f.y, f.s, f.s * 0.5, 0, 0, TAU); } g.fill();
    } else if (t === 'lily') {
      for (const l of its) {
        g.fillStyle = 'rgba(15,30,30,0.35)'; g.beginPath(); g.arc(l.x + 0.02, l.y + 0.02, l.s, 0, TAU); g.fill();
        g.fillStyle = '#4f7a36'; g.beginPath(); g.moveTo(l.x, l.y); g.arc(l.x, l.y, l.s, l.a + 0.35, l.a + TAU - 0.05); g.closePath(); g.fill();
        g.fillStyle = 'rgba(160,200,110,0.35)'; g.beginPath(); g.moveTo(l.x, l.y); g.arc(l.x, l.y, l.s * 0.8, l.a + 2.2, l.a + 3.6); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(30,55,20,0.6)'; g.lineWidth = 0.01; g.stroke();
        if (l.fl) { g.fillStyle = '#f2d6e2'; for (let k = 0; k < 6; k++) { const a = k * 1.05; g.beginPath(); g.ellipse(l.x + Math.cos(a) * 0.04, l.y + Math.sin(a) * 0.04, 0.045, 0.02, a, 0, TAU); g.fill(); } g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(l.x, l.y, 0.02, 0, TAU); g.fill(); }
      }
    } else if (t === 'gum') {
      g.fillStyle = 'rgba(40,38,36,0.45)'; g.beginPath(); for (const c of its) { g.moveTo(c.x + c.s, c.y); g.arc(c.x, c.y, c.s, 0, TAU); } g.fill();
    } else if (t === 'paper') {
      for (const p of its) { g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = '#d8d4c8'; g.fillRect(-p.s, -p.s * 0.6, p.s * 2, p.s * 1.2); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(-p.s, p.s * 0.4, p.s * 2, p.s * 0.2); g.restore(); }
    } else if (t === 'grit') {
      g.fillStyle = 'rgba(150,145,135,0.6)'; g.beginPath(); for (const c of its) { g.moveTo(c.x + c.s, c.y); g.arc(c.x, c.y, c.s, 0, TAU); } g.fill();
    } else if (t === 'oil') {
      for (const o of its) { const gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.s); gr.addColorStop(0, 'rgba(18,18,22,0.26)'); gr.addColorStop(0.6, 'rgba(25,22,28,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(o.x, o.y, o.s, o.s * 0.6, o.a, 0, TAU); g.fill(); }
    } else if (t === 'patch') {
      for (const p of its) { g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = 'rgba(40,41,45,0.45)'; g.fillRect(-p.s / 2, -p.s * p.k / 2, p.s, p.s * p.k); g.strokeStyle = 'rgba(25,25,28,0.4)'; g.lineWidth = 0.02; g.strokeRect(-p.s / 2, -p.s * p.k / 2, p.s, p.s * p.k); g.restore(); }
    } else if (t === 'acrack') {
      g.strokeStyle = 'rgba(24,24,27,0.7)'; g.lineWidth = 0.016; g.beginPath();
      for (const c of its) {
        const r3 = mulberry(c.seed); let x = c.x, y = c.y, a = c.a;
        g.moveTo(x, y);
        for (let k = 0; k < 8; k++) { a += (r3() - 0.5) * 1.1; x += Math.cos(a) * c.s / 8; y += Math.sin(a) * c.s / 8; g.lineTo(x, y); if (r3() < 0.3) { g.lineTo(x + Math.cos(a + 1.3) * 0.12, y + Math.sin(a + 1.3) * 0.12); g.moveTo(x, y); } }
      }
      g.stroke();
    }
  }
}

// Etapa final em passos curtos (antes era um bloco único de 50–80 ms que travava o jogo):
// vias -> itens (2 grupos por passo) -> pisos das casas -> sombras e minimapa.
function finishChunk(ch) {
  const g = ch.g, ox = ch.ci * CH * TP - PAD, oy = ch.cj * CH * TP - PAD, stp = ch.fin || 0;
  if (stp === 0) { g.save(); g.setTransform(TP, 0, 0, TP, -ox, -oy); paintRoadVectors(ch, g); g.restore(); ch.fin = 1; return; }
  if (stp === 1) {
    if (!ch._keys && (ch.nb || 0) < 9) {   // detalhes dos 8 vizinhos + o próprio: um bloco por passo
      const k = ch.nb || 0, ci = ch.ci + (k % 3) - 1, cj = ch.cj + ((k / 3) | 0) - 1;
      if (ci >= 0 && cj >= 0 && ci * CH < MAP && cj * CH < MAP && !chunkItemsStep(ci, cj, 1500)) return;
      ch.nb = k + 1; return;
    }
    if (!ch._keys) { paintItems(ch, g, 0, 0); return; }   // só agrupa (passo de cálculo)
    const from = ch.itemPos || 0;
    g.save(); g.setTransform(TP, 0, 0, TP, -ox, -oy); paintItems(ch, g, from, from + 1); g.restore();
    ch.itemPos = from + 1; if (ch.itemPos >= ch._keys.length) ch.fin = 2;
    return;
  }
  if (stp === 2) {   // pisos e caminhos das casas (houses.js), em pixels do bloco — uma casa por passo
    // mesma ordem do desenho único: todos os caminhos, depois pisos/sombras, por fim as cercas
    if (!ch.floorList) ch.floorList = [...houses.map(H => ['walk', H]), ...houses.map(H => ['floor', H]), ['fences', null]];
    const [mode, H] = ch.floorList.shift(), last = !ch.floorList.length;
    g.save(); g.setTransform(1, 0, 0, 1, -ox, -oy);
    const M = v => v * TP, rect = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(M(x), M(y), M(w), M(h)); };
    world.floorClip = [ch.ci * CH - 1, ch.cj * CH - 1, ch.ci * CH + CH + 1, ch.cj * CH + CH + 1];
    world.floorSet = new Set(H ? [H] : []); world.floorNoFences = mode !== 'fences'; world.floorMode = mode === 'fences' ? 'walk' : mode;
    try { world.paintFloors && world.paintFloors(g, M, rect); } finally { world.floorClip = null; world.floorSet = null; world.floorNoFences = false; world.floorMode = undefined; }
    g.restore(); if (last) { ch.fin = 3; ch.floorList = null; } return;
  }
  // sombras assadas (árvores, arbustos, pedras) — camada suave em baixa resolução
  const sc = world.groundCtx.canvas, k = PPM / TP, sx = ox * k, sy = oy * k;
  g.save(); g.imageSmoothingEnabled = true; g.drawImage(sc, sx, sy, CSZ * k, CSZ * k, 0, 0, CSZ, CSZ); g.restore();
  // refina o minimapa com a versão detalhada
  terrain.miniCtx.imageSmoothingEnabled = true;
  terrain.miniCtx.drawImage(ch.c, PAD, PAD, CPX, CPX, ch.ci * CH * MINI, ch.cj * CH * MINI, CH * MINI, CH * MINI);
  ch.done = true; ch.F = null; ch.img = null; ch._buckets = null; ch._keys = null;
}

// avança a pintura de um bloco dentro do orçamento de tempo
function workChunk(ch, budgetMs) {
  const t0 = performance.now();
  try { workChunkLoop(ch, budgetMs, t0); } finally { terrain.workMs = (terrain.workMs || 0) + performance.now() - t0; }
}
function workChunkLoop(ch, budgetMs, t0) {
  while (!ch.done && performance.now() - t0 < budgetMs) {
    if (ch.stage === 0) { chunkFields(ch); ch.stage = 1; }
    else if (ch.stage === 1) { paintRows(ch, 16); if (ch.row >= CSZ) ch.stage = 2; }   // ~1,5 ms por fatia
    else { finishChunk(ch); }
  }
}

// ---------- desenho por quadro ----------
function drawGround(g, W, H) {
  terrain.frame++;
  const s = cam.zoom, c = cam.cos, sn = cam.sin;
  const affine = (ppm, x0, y0) => g.setTransform(s * c / ppm, s * TILT * sn / ppm, -s * sn / ppm, s * TILT * c / ppm,
    W / 2 + s * (c * (x0 - cam.x) - sn * (y0 - cam.y)), H / 2 + s * TILT * (sn * (x0 - cam.x) + c * (y0 - cam.y)));
  // fundo: minimapa ampliado (só aparece enquanto um bloco ainda está sendo pintado)
  affine(MINI, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(terrain.mini, 0, 0);
  // blocos visíveis
  const cs = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => unproj(x, y, 0));
  const xs = cs.map(p => p[0]), ys = cs.map(p => p[1]);
  const ci0 = clamp(Math.floor((Math.min(...xs) - 1) / CH), 0, MAP / CH - 1), ci1 = clamp(Math.floor((Math.max(...xs) + 1) / CH), 0, MAP / CH - 1);
  const cj0 = clamp(Math.floor((Math.min(...ys) - 1) / CH), 0, MAP / CH - 1), cj1 = clamp(Math.floor((Math.max(...ys) + 1) / CH), 0, MAP / CH - 1);
  const pending = [], need = (ci1 - ci0 + 3) * (cj1 - cj0 + 3);
  terrain.maxChunks = Math.max(24, need + 2);
  for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) {
    const ch = terrain.chunks.get(ci + ',' + cj) || startChunk(ci, cj);
    ch.used = terrain.frame;
    if (!ch.done) pending.push(ch);
  }
  if (world.terrainSync) for (const ch of pending) workChunk(ch, 1e9);
  else if (pending.length) {
    pending.sort((a, b) => Math.hypot(a.ci * CH + 8 - cam.x, a.cj * CH + 8 - cam.y) - Math.hypot(b.ci * CH + 8 - cam.x, b.cj * CH + 8 - cam.y));
    workChunk(pending[0], terrain.budget || 7);
  }
  // anel ao redor da vista: TODO ele conta como em uso (senão o cache o descarta e repinta sem fim);
  // quando nada visível está pendente, pré-pinta o primeiro bloco do anel que faltar
  let ringTarget = null;
  for (let cj = cj0 - 1; cj <= cj1 + 1; cj++) for (let ci = ci0 - 1; ci <= ci1 + 1; ci++) {
    if (ci < 0 || cj < 0 || ci >= MAP / CH || cj >= MAP / CH) continue;
    const ch = terrain.chunks.get(ci + ',' + cj);
    if (ch) ch.used = terrain.frame;
    if (!ringTarget && (!ch || !ch.done)) ringTarget = ch || [ci, cj];
  }
  if (!world.terrainSync && !pending.length && ringTarget)
    workChunk(Array.isArray(ringTarget) ? startChunk(...ringTarget) : ringTarget, Math.min(4, terrain.budget || 4));
  for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) {
    const ch = terrain.chunks.get(ci + ',' + cj);
    if (!ch || !ch.done) continue;
    affine(TP, ci * CH - PAD / TP, cj * CH - PAD / TP);
    g.drawImage(ch.c, PAD - 1, PAD - 1, CPX + 2, CPX + 2, PAD - 1, PAD - 1, CPX + 2, CPX + 2);
  }
  g.imageSmoothingEnabled = false;
  g.setTransform(1, 0, 0, 1, 0, 0);
  drawWaterLife(g);
  // libera blocos antigos fora de vista
  if (terrain.chunks.size > terrain.maxChunks) {
    const old = [...terrain.chunks.values()].filter(ch => ch.done && terrain.frame - ch.used > 30).sort((a, b) => a.used - b.used);
    for (const ch of old.slice(0, terrain.chunks.size - terrain.maxChunks)) terrain.chunks.delete(ch.ci + ',' + ch.cj);
  }
}

// brilhos e ondulações que se movem na superfície do lago (único elemento animado do chão)
function drawWaterLife(g) {
  const P = world.pondPoly; if (!P) return;
  const t = performance.now() / 1000, p = world.pond;
  const sp = P.map(([x, y]) => proj(x, y, 0));
  g.save(); g.beginPath(); sp.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.closePath(); g.clip();
  const r = mulberry(world.seed + 77);
  for (let i = 0; i < 55; i++) {
    const bx = p.x + (r() - 0.5) * p.rx * 2, by = p.y + (r() - 0.5) * p.ry * 2, ph = r() * TAU, sp2 = 0.3 + r() * 0.5;
    const x = bx + Math.sin(t * 0.25 * sp2 + ph) * 0.6, y = by + Math.cos(t * 0.2 * sp2 + ph) * 0.3;
    const a = Math.max(0, Math.sin(t * 1.3 * sp2 + ph)) * 0.32;
    if (a < 0.02) continue;
    const q = proj(x, y, 0), L = (0.15 + r() * 0.3) * cam.zoom;
    g.strokeStyle = `rgba(220,235,235,${a})`; g.lineWidth = Math.max(1, cam.zoom * 0.015);
    g.beginPath(); g.moveTo(q.x - L, q.y); g.quadraticCurveTo(q.x, q.y - L * 0.08, q.x + L, q.y); g.stroke();
  }
  g.restore();
}
