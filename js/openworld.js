// openworld.js — liga o mundo grande (js/worldgen) ao jogo.
// • Campos contínuos p/ o terreno e a física: distância até a via, mar/rio, floresta, distrito, talhões.
// • Setores de 256 m gerados sob demanda em volta do jogador, em passos curtos (sem travar o quadro),
//   cada um com semente própria: o mesmo setor sai idêntico em qualquer ordem de carregamento.
// • Os geradores existentes (casas, móveis, cercas, árvores, postes...) são reaproveitados: tudo o que
//   eles empurram nas listas globais durante a geração do setor fica marcado e sai ao descarregar.
'use strict';

const OW = {
  SP: COG.SECTOR, R: 230, HYST: 130, SPPM: 4, PAD: 8,   // raio de carga (m), folga, px/m e margem das sombras
  MINI_PPM: 0.25,
  sectors: new Map(), job: null, cw: null, geo: null,
  roadHash: new Map(), riverHash: new Map(), RC: 16,
  blk: null, place: null, viewBuf: [], stats: { loaded: 0, genMs: 0, last: '' },
};
const D_ = COG.D;
const BUILT = new Set([D_.TOWN, D_.URBAN, D_.DOWNTOWN, D_.FAVELA, D_.GHETTO]);

// ---------- grade hash leve (consultas podem repetir objetos; os testes são booleanos) ----------
class HashGrid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  key(i, j) { return j * 65536 + i; }
  add(o, x0, y0, x1, y1) {
    const c = this.cell;
    for (let j = Math.floor(y0 / c); j <= Math.floor(y1 / c); j++) for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) {
      const k = this.key(i, j); let a = this.map.get(k); if (!a) this.map.set(k, a = []); a.push(o);
    }
  }
  any(x0, y0, x1, y1, test) {
    const c = this.cell;
    for (let j = Math.floor(y0 / c); j <= Math.floor(y1 / c); j++) for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) {
      const a = this.map.get(this.key(i, j)); if (a) for (const o of a) if (test(o)) return true;
    }
    return false;
  }
  clear() { this.map.clear(); }
}

function segDist(px, py, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1, u = clamp(((px - ax) * ex + (py - ay) * ey) / l2, 0, 1);
  return Math.hypot(px - ax - ex * u, py - ay - ey * u);
}
function hashSegs(map, pts, pad, extra) {
  const C = OW.RC;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], s = Object.assign({ ax, ay, bx, by }, extra);
    for (let j = Math.floor((Math.min(ay, by) - pad) / C); j <= Math.floor((Math.max(ay, by) + pad) / C); j++)
      for (let k = Math.floor((Math.min(ax, bx) - pad) / C); k <= Math.floor((Math.max(ax, bx) + pad) / C); k++) {
        const key = j * 65536 + k; let a = map.get(key); if (!a) map.set(key, a = []); a.push(s);
      }
  }
}

// ---------- campos do mundo grande ----------
function owInstallFields() {
  const geo = OW.geo, { N1, N2 } = geo.noise, C = OW.RC;
  // distrito com fronteira orgânica (mesmo deslocamento usado pelo atlas)
  world.districtFn = (x, y) => geo.districtAt(x + (N1(x * 0.03, y * 0.03) - 0.5) * 34, y + (N2(x * 0.03 + 7, y * 0.03) - 0.5) * 34);
  // distância até a borda do asfalto normalizada: o terreno vê ROAD_W na borda de qualquer via
  world.roadDistFn = (x, y) => {
    const a = OW.roadHash.get(Math.floor(y / C) * 65536 + Math.floor(x / C)); if (!a) return 99;
    let best = 99;
    for (const s of a) { const d = segDist(x, y, s.ax, s.ay, s.bx, s.by) - s.off; if (d < best) best = d; }
    return best;
  };
  // água: mar pela forma da costa e rios pela distância ao leito; < 1 é água, 1–1,26 é areia
  world.pondFn = (x, y) => {
    if (x < 0 || y < 0 || x > geo.W || y > geo.H) return 0;
    let pv = 1 + geo.landField(x, y) / 130;
    const a = OW.riverHash.get(Math.floor(y / C) * 65536 + Math.floor(x / C));
    if (a) for (const s of a) { const v = 1 + (segDist(x, y, s.ax, s.ay, s.bx, s.by) - s.hw) / 45; if (v < pv) pv = v; }
    return pv;
  };
  // floresta: alvo por distrito, suavizado por 4 amostras vizinhas + variação local
  const target = d => d === D_.FOREST ? 0.8 : d === D_.RURAL ? 0.52 : d === D_.FARM ? 0.3 : (d === D_.TOWN || d === D_.URBAN) ? 0.47
    : d === D_.GHETTO ? 0.36 : d === D_.FAVELA ? 0.28 : d === D_.RIVER ? 0.5 : d === D_.SEA ? 0 : 0.18;
  world.forestFn = (x, y) => {
    const dd = world.districtFn;
    const t = (target(dd(x, y)) * 2 + target(dd(x + 14, y)) + target(dd(x - 14, y)) + target(dd(x, y + 14)) + target(dd(x, y - 14))) / 6;
    return t + (fbm(x * 0.05 + 31.7, y * 0.05 + 7.3) - 0.5) * 0.3;
  };
  // talhões de fazenda: Voronoi irregular de ~70 m; cada talhão tem direção de plantio e cultura
  const hash = (i, j, k) => { let h = (i * 374761393 + j * 668265263 + k * 2147483647) ^ COG.WORLD_SEED; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const out = [0, 0];
  world.fieldFn = (x, y) => {
    const S = 70, gi = Math.floor(x / S), gj = Math.floor(y / S); let best = 1e18, bi = 0, bj = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ci = gi + di, cj = gj + dj, cx = (ci + hash(ci, cj, 1)) * S, cy = (cj + hash(ci, cj, 2)) * S, d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < best) { best = d; bi = ci; bj = cj; }
    }
    out[0] = hash(bi, bj, 3) * Math.PI; out[1] = (hash(bi, bj, 4) * terrain.crops.length) | 0;
    return out;
  };
}

// ---------- minimapa / fundo enquanto um bloco pinta (0,25 px/m) ----------
function owPaintMini() {
  const geo = OW.geo, k = OW.MINI_PPM, c = makeCanvas(geo.W * k, geo.H * k), g2 = c.getContext('2d');
  const COLS = { [D_.SEA]: '#2c5f74', [D_.BEACH]: '#cdbb8c', [D_.DOWNTOWN]: '#8f8c86', [D_.URBAN]: '#6f8248', [D_.FAVELA]: '#8a6a4c', [D_.GHETTO]: '#77785e',
    [D_.INDUSTRIAL]: '#7d8086', [D_.PORT]: '#7a7c80', [D_.FARM]: '#8c8a46', [D_.FOREST]: '#2f4a28', [D_.TOWN]: '#6a8344', [D_.AIRPORT]: '#83955a', [D_.RURAL]: '#6c8a3a', [D_.RIVER]: '#3d6c78' };
  const cs = geo.C * k;
  for (let j = 0; j < geo.NY; j++) for (let i = 0; i < geo.NX; i++) { g2.fillStyle = COLS[geo.dist[j * geo.NX + i]]; g2.fillRect(i * cs, j * cs, cs + 0.5, cs + 0.5); }
  g2.lineCap = 'round'; g2.lineJoin = 'round';
  for (const rd of OW.cw.roads) {
    if (rd.cls === 'rail') continue;
    g2.strokeStyle = rd.cls === 'highway' ? '#55565b' : '#4a4b50'; g2.lineWidth = Math.max(1, rd.w * k);
    g2.beginPath(); rd.pts.forEach(([x, y], i) => i ? g2.lineTo(x * k, y * k) : g2.moveTo(x * k, y * k)); g2.stroke();
  }
  terrain.mini = c; terrain.miniCtx = g2; terrain.miniPPM = k;
  world.ground = c; world.groundPPM = k;
}

// ---------- vias de um setor: recorte exato + reamostragem a 0,5 m com normais ----------
function owSectorRoads(S) {
  const [x0, y0, x1, y1] = S.bounds, out = [], seen = new Set();
  OW.cw.roadIndex.query([x0 - 20, y0 - 20, x1 + 20, y1 + 20], ({ rd }) => {
    if (seen.has(rd.id) || rd.cls === 'rail') return; seen.add(rd.id);
    for (const part of COG.clipPolyline(rd.pts, x0, y0, x1, y1)) {
      const raw = part.map(p => [p.x, p.y]), pts = [];
      for (let i = 0; i < raw.length - 1; i++) {
        const [ax, ay] = raw[i], [bx, by] = raw[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.5));
        for (let t = 0; t < n; t++) pts.push([ax + (bx - ax) * t / n, ay + (by - ay) * t / n]);
      }
      pts.push(raw[raw.length - 1]);
      if (pts.length < 4) continue;
      out.push({ pts: withNormals(pts), cls: rd.cls, w: rd.w, off: rd.w / 2 - ROAD_W, branch: rd.cls !== 'highway', bigId: rd.id });
    }
  });
  return out;
}

// ---------- listas globais marcadas por setor ----------
const OW_TRACK = () => [['houses', houses], ['boxes', boxes], ['fences', fences], ['props', world.props], ['circles', world.circles], ['segs', world.segs],
  ['upperSegs', world.upperSegs], ['lamps', world.lamps], ['yards', world.yards], ['litter', urbanLife.litter], ['bins', urbanLife.bins],
  ['flowers', ecosystem.flowers], ['butterflies', ecosystem.butterflies]];
function owSnap() { return OW_TRACK().map(([, a]) => a.length); }
function owCollect(S, snap) {
  OW_TRACK().forEach(([name, a], i) => {
    for (let k = snap[i]; k < a.length; k++) { const o = a[k]; if (o && o.kind === 'vehicle') continue; (S.own[name] || (S.own[name] = [])).push(o); }
    snap[i] = a.length;
  });
}

// índices de ocupação (casas, quintais, caixas) e de espaçamento (árvores, pedras, postes)
function owIndexOwned(S, from) {
  const F = from || {};
  for (const H of (S.own.houses || []).slice(F.houses || 0)) OW.blk.add({ t: 'h', o: H }, H.x0 - 1.5, H.y0 - 1.5, H.x1 + 1.5, H.y1 + 1.5);
  for (const Y of (S.own.yards || []).slice(F.yards || 0)) OW.blk.add({ t: 'y', o: Y }, Y[0], Y[1], Y[2], Y[3]);
  for (const b of (S.own.boxes || []).slice(F.boxes || 0)) { const r = Math.max(b.w, b.d) / 2 + 0.6; OW.blk.add({ t: 'b', o: b }, b.x - r, b.y - r, b.x + r, b.y + r); }
}
function owRebuildIndices() {
  OW.blk.clear(); OW.place.clear();
  for (const S of OW.sectors.values()) { owIndexOwned(S); for (const c of S.own.circles || []) OW.place.add(c, c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r); }
}
function owBlocked(x, y, r) {
  return OW.blk.any(x - r, y - r, x + r, y + r, e => {
    if (e.t === 'h') { const H = e.o; return x > H.x0 - r - 1.5 && x < H.x1 + r + 1.5 && y > H.y0 - r - 1.5 && y < H.y1 + r + 1.5; }
    if (e.t === 'y') { const Y = e.o; return x > Y[0] - r && x < Y[2] + r && y > Y[1] - r && y < Y[3] + r; }
    const b = e.o; return Math.hypot(b.x - x, b.y - y) < Math.max(b.w, b.d) / 2 + r + 0.6;
  });
}
function owFree(S, x, y, r, inset = 1.5) {
  const [x0, y0, x1, y1] = S.bounds;
  if (x < x0 + inset || y < y0 + inset || x > x1 - inset || y > y1 - inset) return false;
  if (onRoad(x, y) || pondVal(x, y) < 1.12 + r * 0.25 || world.blocked(x, y, r)) return false;
  return !OW.place.any(x - r - 2, y - r - 2, x + r + 2, y + r + 2, c => Math.hypot(c.x - x, c.y - y) < c.r + r + 0.4);
}
function owAddCircle(c) { world.circles.push(c); OW.place.add(c, c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r); return c; }

// ---------- geração de um setor (gerador: cada yield devolve o controle ao quadro) ----------
function* owGenSector(S) {
  const [x0, y0, x1, y1] = S.bounds, P = OW.pools, dd = world.districtFn;
  // composição do setor (amostra de 16 m)
  const hist = new Array(14).fill(0);
  for (let y = y0 + 8; y < y1; y += 16) for (let x = x0 + 8; x < x1; x += 16) hist[dd(x, y)]++;
  const frac = d => hist[d] / 256, built = [...BUILT].reduce((a, d) => a + frac(d), 0);
  S.mix = hist; S.dominant = hist.indexOf(Math.max(...hist));
  if (frac(D_.SEA) > 0.999) { yield* owPaintBase(S); return; }   // mar aberto: só a base
  yield;

  // --- casas ao longo das vias, de frente p/ a rua (modelo depende do distrito do lote)
  const rects = [];
  if (built > 0.02) {
    const cands = [];
    for (const rd of S.roads) { if (rd.cls === 'highway') continue; for (let i = 8; i < rd.pts.length - 8; i += 5) for (const s of [1, -1]) cands.push({ p: rd.pts[i], s, off: rd.off, r: rng() }); }
    cands.sort((a, b) => a.r - b.r);
    const MIX = { [D_.TOWN]: ['A', 'C', 'B', 'D', 'A', 'B', 'SHOP'], [D_.URBAN]: ['D', 'C', 'B', 'A', 'D', 'B', 'SHOP'], [D_.DOWNTOWN]: ['SHOP', 'D', 'SHOP', 'D', 'C'],
      [D_.FAVELA]: ['B', 'D', 'B', 'B'], [D_.GHETTO]: ['D', 'B', 'D'] };
    const CAP = { [D_.TOWN]: 30, [D_.URBAN]: 34, [D_.DOWNTOWN]: 26, [D_.FAVELA]: 30, [D_.GHETTO]: 24 };
    const cap = Math.round([...BUILT].reduce((a, d) => a + frac(d) * CAP[d], 0)) + 2;
    let placed = 0, tries = 0;
    for (const c of cands) {
      if (placed >= cap || tries > 900) break;
      const ox = c.p.x + c.p.nx * c.s * (ROAD_W + c.off + SIDE + 7), oy = c.p.y + c.p.ny * c.s * (ROAD_W + c.off + SIDE + 7), d = dd(ox, oy);
      if (!BUILT.has(d)) continue;
      tries++;
      const mix = MIX[d], key = mix[(rng() * mix.length) | 0];
      const H = owTryHouse(S, key, c, rects);
      if (H) { placed++; yield; }
    }
    // caminho de concreto da porta até a calçada
    for (const H of S.own.houses || []) if (!H.walk) owWalk(H);
  }
  // --- sítios e chácaras no campo (longe da via, com acesso de terra)
  if (frac(D_.FARM) + frac(D_.RURAL) > 0.25) {
    for (let i = 0, n = 0; i < 120 && n < 2; i++) {
      const key = i % 2 ? 'COTTAGE' : 'FARM', T = TPL[key], k = (rng() * 4) | 0, W = k % 2 ? T.d : T.w, Dp = k % 2 ? T.w : T.d;
      const hx = Math.floor(x0 + 8 + rng() * (S.SP - W - 16)), hy = Math.floor(y0 + 8 + rng() * (S.SP - Dp - 16)), m = 3.2, box = [hx - m, hy - m, hx + W + m, hy + Dp + m];
      const dc = dd(hx + W / 2, hy + Dp / 2); if (dc !== D_.FARM && dc !== D_.RURAL) continue;
      if (rects.some(b => box[0] < b[2] + 3 && box[2] > b[0] - 3 && box[1] < b[3] + 3 && box[3] > b[1] - 3)) continue;
      let ok = true, near = 99;
      for (let y = box[1]; y <= box[3] && ok; y += 2) for (let x = box[0]; x <= box[2]; x += 2) { const r2 = roadDist(x, y); near = Math.min(near, r2); if (r2 < ROAD_W + SIDE + 2 || pondVal(x, y) < 1.26) { ok = false; break; } }
      if (!ok || near > 28) continue;   // perto o bastante de uma via p/ ter acesso
      const H = withSeed(S, n, () => placeTemplate(T, hx, hy, k, { roofKind: n % 2 ? 'hip' : 'gable', ext: '#a38c6d', roof: '#685a47', seed: owSeed(S, 'farm' + n) }));
      H.country = true; rects.push(box); owWalk(H); n++;
      owIndexOwnedLive(S);
      yield;
    }
  }
  owIndexOwnedLive(S);

  // --- contêineres no porto e pilhas de material na indústria
  if (frac(D_.PORT) > 0.05 || frac(D_.INDUSTRIAL) > 0.08) {
    const COLS = [['#b0402f', '#8a3226'], ['#2f5f8f', '#244a70'], ['#c9a13a', '#9c7c2c'], ['#3f7a4c', '#30603b'], ['#d9d6cf', '#aaa69e'], ['#6b4b8a', '#523a6b']];
    let n = 0;
    for (let y = y0 + 10; y < y1 - 10; y += 4.2) for (let x = x0 + 10; x < x1 - 10; x += 7.4) {
      if (n > 180) break;
      const d = dd(x, y); if (d !== D_.PORT && !(d === D_.INDUSTRIAL && rng() < 0.18)) continue;
      if (rng() < 0.25 || roadDist(x, y) < ROAD_W + SIDE + 3 || pondVal(x, y) < 1.3 || world.blocked(x, y, 3.2)) continue;
      const stack = 1 + ((rng() * 3) | 0), col = COLS[(rng() * COLS.length) | 0];
      for (let z = 0; z < stack; z++) addBox({ x, y, z: z * 2.6, w: 6.06, d: 2.44, h: 2.59, top: col[0], side: col[1], kind: 'container', solid: z === 0 });
      n++;
    }
    owIndexOwnedLive(S);
    yield;
  }

  // --- vegetação: densidade pelo campo de floresta (pinheiros no miolo, folhosas na borda)
  const A = S.SP * S.SP / 25600;   // área relativa ao mapa local antigo (160×160 m)
  let n = 0;
  // floresta fechada: até 3× a densidade do mapa local; pátios, cais, pistas e praia ficam sem árvores
  for (let i = 0, cap = Math.round(270 * A * (1 + 2 * frac(D_.FOREST))); i < 18000 * A * (1 + 2 * frac(D_.FOREST)) && n < cap; i++) {
    const x = x0 + rng() * S.SP, y = y0 + rng() * S.SP, f = forest(x, y), di = dd(x, y);
    if (OW_BARE.has(di) || owAirfield(x, y)) continue;
    if (rng() > smooth(clamp((f - 0.46) / 0.24, 0, 1)) * 0.85 + (di === D_.FARM ? 0.0006 : di === D_.RURAL ? 0.003 : BUILT.has(di) ? 0.002 : 0.004)) continue;
    if (!owFree(S, x, y, 1.2)) continue;
    const sp = f > 0.64 && rng() < 0.65 ? P.pines[(rng() * P.pines.length) | 0] : P.oaks[(rng() * P.oaks.length) | 0];
    const t = { type: 'tree', x, y, sp, hit: 0, phase: rng() * 6 };
    world.props.push(t); owAddCircle({ x, y, r: 0.28, kind: 'tree', ref: t, h: 6 });
    owTreeShadow(x, y, sp); n++;
    if (n % 30 === 0) yield;
  }
  yield;
  n = 0;
  for (let i = 0, cap = Math.round(210 * A); i < 12000 * A && n < cap; i++) {
    const x = x0 + rng() * S.SP, y = y0 + rng() * S.SP, f = forest(x, y), edge = 1 - Math.abs(f - 0.5) * 6;
    if (rng() > Math.max(0.03, edge * 0.5)) continue;
    const db = dd(x, y); if (OW_BARE.has(db) || owAirfield(x, y) || (db === D_.FARM && rng() > 0.12)) continue;
    if (!owFree(S, x, y, 0.7)) continue;
    const s = P.bushes[(rng() * P.bushes.length) | 0]; world.props.push({ type: 'bush', x, y, sp: s, phase: rng() * 6 });
    owAddCircle({ x, y, r: s.r * 0.6, kind: 'bush', soft: true });
    bakeShadow(x, y, s.r, s.r * 0.6, 1); n++;
    if (n % 60 === 0) yield;
  }
  n = 0;
  for (let i = 0, cap = Math.round(48 * A); i < 2400 * A && n < cap; i++) {
    const x = x0 + rng() * S.SP, y = y0 + rng() * S.SP; if (OW_BARE.has(dd(x, y)) || owAirfield(x, y) || !owFree(S, x, y, 0.6)) continue;
    const s = P.rocks[(rng() * P.rocks.length) | 0]; world.props.push({ type: 'rock', x, y, sp: s });
    owAddCircle({ x, y, r: s.r * 0.9, kind: 'rock', h: s.r * 1.4 }); bakeShadow(x, y, s.r, s.r * 0.7, 0.6); n++;
  }
  yield;
  // tufos de capim (fora de vias, água e lotes) e juncos nas margens
  for (let i = 0, N = S.SP * S.SP * 0.045; i < N; i++) {
    if (i % 400 === 399) yield;
    const x = x0 + 0.5 + rng() * (S.SP - 1), y = y0 + 0.5 + rng() * (S.SP - 1), pv = pondVal(x, y);
    if (pv < 1.05) continue;
    if (pv < 1.1) { if (rng() < 0.5) world.props.push({ type: 'tuft', x, y, sp: P.reeds[i % 2], phase: rng() * 6, flat: true }); continue; }
    if (onRoad(x, y) || world.blocked(x, y, 0.2)) continue;
    const d = dd(x, y); if (OW_BARE.has(d) || owAirfield(x, y)) continue;
    world.props.push({ type: 'tuft', x, y, sp: P.tufts[i % P.tufts.length], phase: rng() * 6, flat: true });
  }
  yield;

  // --- postes nas vias de áreas habitadas, alternando os lados (braço p/ o asfalto)
  const lamps = [];
  for (const rd of S.roads) for (let i = 10, s = 1; i < rd.pts.length; i += 24, s = -s) {
    const p = rd.pts[i], x = p.x + p.nx * s * (ROAD_W + rd.off + 0.6), y = p.y + p.ny * s * (ROAD_W + rd.off + 0.6);
    if (!BUILT.has(dd(x, y)) && !(rd.cls === 'highway' && built > 0.3)) continue;
    if (x < x0 + 3 || y < y0 + 3 || x > x1 - 3 || y > y1 - 3 || world.blocked(x, y, 0.3) || pondVal(x, y) < 1.1 || lamps.some(l => Math.hypot(l.x - x, l.y - y) < 6)) continue;
    const l = { x, y, ax: -p.nx * s, ay: -p.ny * s }; lamps.push(l); world.lamps.push(l);
    owAddCircle({ x, y, r: 0.12, kind: 'lamp', h: 4 });
  }
  // --- lixo junto ao meio-fio e lixeiras em frente às casas
  if (built > 0.05) {
    const R2 = mulberry(owSeed(S, 'litter'));
    for (let t = 0, cnt = 0; t < 5000 && cnt < Math.round(110 * built + 10); t++) {
      const x = x0 + 2 + R2() * (S.SP - 4), y = y0 + 2 + R2() * (S.SP - 4), dr = roadDist(x, y);
      if (!(dr >= ROAD_W - 0.6 && dr <= ROAD_W + SIDE + 0.12) || pondVal(x, y) < 1.2 || world.blocked(x, y, 0.12)) continue;
      if (R2() < (dr < ROAD_W + 0.3 ? 0.94 : 0.82)) continue;
      const u = R2(), kind = u < 0.25 ? 'paper' : u < 0.42 ? 'can' : u < 0.57 ? 'bottle' : u < 0.73 ? 'wrapper' : u < 0.84 ? 'newspaper' : u < 0.94 ? 'butt' : 'cup';
      urbanLife.litter.push({ kind, x, y, variant: (R2() * 3) | 0, a: R2() * TAU, s: 0.78 + R2() * 0.35 }); cnt++;
    }
    for (const H of (S.own.houses || []).filter(H => !H.rural).slice(0, 6)) {
      const nx = H.doorN[0], ny = H.doorN[1], curb = H.walk?.[1] || H.front, x = curb[0] - ny * (0.65 + (H.seed % 3) * 0.23), y = curb[1] + nx * (0.65 + (H.seed % 3) * 0.23);
      if (!onRoad(x, y) || world.blocked(x, y, 0.35) || urbanLife.bins.some(p => Math.hypot(p.x - x, p.y - y) < 8)) continue;
      urbanLife.bins.push({ x, y, kind: H.brick ? 'metal' : 'plastic', seed: H.seed });
    }
  }
  // --- flores silvestres e borboletas nos campos
  if (world.ecoReady) {
    const R3 = mulberry(owSeed(S, 'eco')), fl = [];
    for (let i = 0; i < 2400 && fl.length < 220; i++) {
      const x = x0 + 1 + R3() * (S.SP - 2), y = y0 + 1 + R3() * (S.SP - 2), f = forest(x, y);
      if (f < 0.36 || f > 0.79 || !ecoFree(x, y)) continue;
      const type = (R3() * ecosystem.sprites.length) | 0;
      const o = { x, y, sp: ecosystem.sprites[type], phase: R3() * TAU, density: 0.65 + R3() * 0.35, kind: type }; ecosystem.flowers.push(o); fl.push(o);
    }
    for (let i = 0; i < 14 && fl.length; i++) {
      const plant = fl[(R3() * fl.length) | 0], a = R3() * TAU;
      ecosystem.butterflies.push({ x: plant.x + Math.cos(a) * R3() * 0.7, y: plant.y + Math.sin(a) * R3() * 0.7, homeX: plant.x, homeY: plant.y,
        z: 0.4 + R3() * 0.5, phase: R3() * TAU, heading: R3() * TAU, kind: (R3() * 5) | 0, speed: 0.18 + R3() * 0.2, flight: R3() * TAU });
    }
  }
  yield* owPaintBase(S);
}
// ---------- base intermediária do setor (2 px/m): aparece enquanto os blocos detalhados pintam ----------
const OW_BPPM = 2, OW_BS = 2;   // px/m da base e passo de amostragem (m)
function* owPaintBase(S) {
  const [x0, y0] = S.bounds, n = S.SP / OW_BS, img = new ImageData(n, n), d = img.data, C2 = COL;
  for (let band = 0; band < 8; band++) {
    for (let j = band * n / 8; j < (band + 1) * n / 8; j++) for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * OW_BS, y = y0 + (j + 0.5) * OW_BS, pv = pondVal(x, y), o = (j * n + i) * 4;
      let c;
      if (pv < 1) { const t = clamp((1 - pv) / 0.6, 0, 1); c = [lerp(C2.shallow[0], C2.deep[0], t), lerp(C2.shallow[1], C2.deep[1], t), lerp(C2.shallow[2], C2.deep[2], t)]; }
      else if (pv < 1.26) c = pv < 1.075 ? C2.wsand : C2.sand;
      else {
        const di = world.districtFn(x, y), gt = fbm(x * 0.09, y * 0.09, 3), tone = 0.82 + (gt - 0.5) * 0.55, dk = sstep(0.42, 0.72, fbm(x * 0.045 + 11.3, y * 0.045 + 90.1, 2));
        c = [lerp(C2.lush[0], C2.dry[0], dk) * tone, lerp(C2.lush[1], C2.dry[1], dk) * tone, lerp(C2.lush[2], C2.dry[2], dk) * tone];
        if (di === D_.BEACH) c = C2.sand;
        else if (di === D_.FARM) { const f = world.fieldFn(x, y), cr = terrain.crops[f[1]], k = cr[3] * 0.6; c = [lerp(C2.dirt[0], cr[0], k), lerp(C2.dirt[1], cr[1], k), lerp(C2.dirt[2], cr[2], k)]; }
        else if (di === D_.DOWNTOWN) c = C2.walk; else if (di === D_.INDUSTRIAL || di === D_.PORT) c = C2.curbF;
        else if (di === D_.FAVELA) c = C2.dirt; else if (di === D_.GHETTO) c = [lerp(c[0], C2.dirt[0], 0.4), lerp(c[1], C2.dirt[1], 0.4), lerp(c[2], C2.dirt[2], 0.4)];
        else { const fw = sstep(0.55, 0.69, forest(x, y)) * 0.85; if (fw > 0) c = [lerp(c[0], C2.moss[0], fw), lerp(c[1], C2.moss[1], fw), lerp(c[2], C2.moss[2], fw)]; }
      }
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    yield;
  }
  const small = makeCanvas(n, n); small.getContext('2d').putImageData(img, 0, 0);
  const cv = makeCanvas(S.SP * OW_BPPM, S.SP * OW_BPPM), g2 = cv.getContext('2d');
  g2.imageSmoothingEnabled = true; g2.drawImage(small, 0, 0, cv.width, cv.height);
  // vias nítidas: calçada, asfalto e faixa central
  g2.setTransform(OW_BPPM, 0, 0, OW_BPPM, -x0 * OW_BPPM, -y0 * OW_BPPM); g2.lineCap = 'butt'; g2.lineJoin = 'round';
  const line = (rd, w, col) => { g2.strokeStyle = col; g2.lineWidth = w; g2.beginPath(); rd.pts.forEach((p, i) => i ? g2.lineTo(p.x, p.y) : g2.moveTo(p.x, p.y)); g2.stroke(); };
  for (const rd of S.roads) line(rd, (ROAD_W + rd.off + SIDE) * 2, `rgb(${C2.walk.join(',')})`);
  for (const rd of S.roads) line(rd, (ROAD_W + rd.off) * 2 + 0.3, `rgb(${C2.curbF.join(',')})`);
  for (const rd of S.roads) line(rd, (ROAD_W + rd.off) * 2, `rgb(${C2.asph.join(',')})`);
  for (const rd of S.roads) line(rd, 0.3, 'rgba(214,176,62,0.8)');
  for (const H of S.own.houses || []) { g2.fillStyle = 'rgba(150,140,124,0.9)'; g2.fillRect(H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0); }
  // sombras já assadas do setor
  g2.setTransform(1, 0, 0, 1, 0, 0);
  g2.drawImage(S.shadow.canvas, -OW.PAD * OW_BPPM, -OW.PAD * OW_BPPM, S.shadow.canvas.width * OW_BPPM / OW.SPPM, S.shadow.canvas.height * OW_BPPM / OW.SPPM);
  S.base = cv;
}
function owDrawBases(affine, g) {
  const W = g.canvas.width, H = g.canvas.height, cs = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => unproj(x, y, 0));
  const vx0 = Math.min(...cs.map(p => p[0])) - 12, vx1 = Math.max(...cs.map(p => p[0])) + 12, vy0 = Math.min(...cs.map(p => p[1])) - 12, vy1 = Math.max(...cs.map(p => p[1])) + 12;
  const vis = S => !(S.bounds[0] > vx1 || S.bounds[2] < vx0 || S.bounds[1] > vy1 || S.bounds[3] < vy0);
  for (const S of OW.sectors.values()) if (S.base && vis(S)) { affine(OW_BPPM, S.bounds[0], S.bounds[1]); g.drawImage(S.base, 0, 0); }
  // vias vetoriais nítidas por baixo dos blocos (só se vê onde o detalhe ainda está pintando)
  affine(1, 0, 0); g.lineCap = 'butt'; g.lineJoin = 'round';
  const pieces = [];
  for (const S of OW.sectors.values()) if (S.state === 'done' && vis(S)) for (const rd of S.roads) {
    const b = rd.bb || (rd.bb = rd.pts.reduce((a, p) => [Math.min(a[0], p.x), Math.min(a[1], p.y), Math.max(a[2], p.x), Math.max(a[3], p.y)], [1e9, 1e9, -1e9, -1e9]));
    if (!(b[0] > vx1 || b[2] < vx0 || b[1] > vy1 || b[3] < vy0)) pieces.push(rd);
  }
  const C2 = COL, path = rd => { g.beginPath(); for (let i = 0; i < rd.pts.length; i += 2) { const p = rd.pts[i]; i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); } const q = rd.pts[rd.pts.length - 1]; g.lineTo(q.x, q.y); };
  for (const [wk, col] of [[r => (ROAD_W + r.off + SIDE) * 2, `rgb(${C2.walk.join(',')})`], [r => (ROAD_W + r.off) * 2 + 0.4, `rgb(${C2.curbF.join(',')})`], [r => (ROAD_W + r.off) * 2, `rgb(${C2.asph.join(',')})`]])
    for (const rd of pieces) { g.strokeStyle = col; g.lineWidth = wk(rd); path(rd); g.stroke(); }
  g.strokeStyle = 'rgba(214,176,62,0.85)'; g.lineWidth = 0.1;
  for (const rd of pieces) for (const o of [-0.12, 0.12]) { g.beginPath(); rd.pts.forEach((p, i) => i % 2 && i !== rd.pts.length - 1 ? 0 : (i ? g.lineTo(p.x + p.nx * o, p.y + p.ny * o) : g.moveTo(p.x + p.nx * o, p.y + p.ny * o))); g.stroke(); }
  g.setLineDash([3, 3]); g.strokeStyle = 'rgba(232,230,222,0.8)'; g.lineWidth = 0.12;
  for (const rd of pieces) if (rd.off > 0.5) for (const sgn of [-1, 1]) { const o = sgn * (rd.off + ROAD_W) * 0.5; g.beginPath(); rd.pts.forEach((p, i) => i ? g.lineTo(p.x + p.nx * o, p.y + p.ny * o) : g.moveTo(p.x + p.nx * o, p.y + p.ny * o)); g.stroke(); }
  g.setLineDash([]);
}

// distritos sem vegetação plantada (pavimento, cais, pista, areia)
const OW_BARE = new Set([D_.DOWNTOWN, D_.PORT, D_.INDUSTRIAL, D_.AIRPORT, D_.BEACH, D_.SEA]);
// pavimento do aeroporto (pista, taxiamento e pátio), no quadro local de cada pista
function owAirfield(x, y) {
  for (const ap of world.airports || []) {
    const dx = x - ap.x, dy = y - ap.y, u = dx * Math.cos(ap.ang) + dy * Math.sin(ap.ang), v = -dx * Math.sin(ap.ang) + dy * Math.cos(ap.ang);
    if (Math.abs(u) < ap.len / 2 + 20 && v > -ap.width / 2 - 20 && v < ap.width / 2 + ap.apron) return true;
  }
  return false;
}

const owCounts = S => ({ houses: (S.own.houses || []).length, yards: (S.own.yards || []).length, boxes: (S.own.boxes || []).length });
const owSeed = (S, tag) => { let h = (S.sx * 73856093) ^ (S.sy * 19349663) ^ COG.WORLD_SEED; for (const ch of tag) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
function withSeed(S, n, fn) { return fn(); }

function owTryHouse(S, key, c, rects) {
  const T = TPL[key]; if (!T) return null;
  const p = c.p, o = [p.nx * c.s, p.ny * c.s], [sx0, sy0, sx1, sy1] = S.bounds;
  let k = 0, best = -9;
  for (let q = 0; q < 4; q++) { const dn = [-Math.round(Math.sin(q * Math.PI / 2)), Math.round(Math.cos(q * Math.PI / 2))], d = -(dn[0] * o[0] + dn[1] * o[1]); if (d > best) { best = d; k = q; } }
  const W = k % 2 ? T.d : T.w, Dp = k % 2 ? T.w : T.d, depth = k % 2 ? W : Dp;
  const dist = ROAD_W + c.off + SIDE + T.setback + depth / 2;
  const x0 = Math.round(p.x + o[0] * dist - W / 2), y0 = Math.round(p.y + o[1] * dist - Dp / 2);
  const m = T.yard ? 3.2 : 1, box = [x0 - m, y0 - m, x0 + W + m, y0 + Dp + m];
  // o lote inteiro cabe no setor: casas nunca cruzam a fronteira (setores independentes)
  if (box[0] < sx0 + 1 || box[1] < sy0 + 1 || box[2] > sx1 - 1 || box[3] > sy1 - 1) return null;
  if (rects.some(b => box[0] < b[2] + 2 && box[2] > b[0] - 2 && box[1] < b[3] + 2 && box[3] > b[1] - 2)) return null;
  for (let y = box[1]; y <= box[3]; y += 1) for (let x = box[0]; x <= box[2]; x += 1) {
    const inHouse = x >= x0 - 0.5 && x <= x0 + W + 0.5 && y >= y0 - 0.5 && y <= y0 + Dp + 0.5;
    if (roadDist(x, y) < ROAD_W + SIDE + (inHouse ? 0.6 : 0.1) || pondVal(x, y) < 1.4) return null;
  }
  rects.push(box);
  const pal = SIDINGS[(rng() * SIDINGS.length) | 0], rr = rng();
  const roofKind = key === 'SHOP' ? 'flat' : key === 'C' ? (rr < 0.55 ? 'hip' : 'gable') : key === 'D' ? (rr < 0.62 ? 'gable' : 'flat') : key === 'A' ? (rr < 0.5 ? 'gable' : 'hip') : (rr < 0.3 ? 'flat' : rr < 0.65 ? 'hip' : 'gable');
  const H = placeTemplate(T, x0, y0, k, Object.assign(key === 'SHOP' ? {} : { ext: pal[0], roof: pal[1], roofKind }, { seed: owSeed(S, 'h' + x0 + ',' + y0) }));
  owIndexOwnedLive(S);
  return H;
}
// indexa na hora o que a última casa criou (o próximo lote já enxerga casa, quintal e móveis)
function owIndexOwnedLive(S) { owCollect(S, S.snap); owIndexOwned(S, S._idxFrom); S._idxFrom = owCounts(S); }
function owWalk(H) {
  let t = 0.2; while (t < 12 && roadDist(H.doorPt[0] + H.doorN[0] * t, H.doorPt[1] + H.doorN[1] * t) > ROAD_W + SIDE - 0.2) t += 0.25;
  if (H.rural) t = Math.min(t, 9.5 + (H.seed % 7) * 0.29);
  H.walk = [H.doorPt, [H.doorPt[0] + H.doorN[0] * t, H.doorPt[1] + H.doorN[1] * t]];
}

// sombra da copa pintada uma vez por modelo de árvore e carimbada em cada árvore (1 drawImage em vez de ~200
// manchas). Os carimbos são feitos na montagem do mundo, na mesma ordem sempre (sorteio determinístico).
function owTreeStamp(sp) {
  if (sp._shStamp) return sp._shStamp;
  const R = sp.r * 2 + sp.trunkH + 2, size = Math.ceil(2 * R * OW.SPPM), c = makeCanvas(size, size), ctx = c.getContext('2d');
  ctx.setTransform(OW.SPPM / PPM, 0, 0, OW.SPPM / PPM, -(100 - R) * OW.SPPM, -(100 - R) * OW.SPPM);
  const prev = world.groundCtx; world.groundCtx = ctx;
  try { bakeTreeShadow(100, 100, sp); } finally { world.groundCtx = prev; }
  return (sp._shStamp = { c, R });
}
function owTreeShadow(x, y, sp) {
  const st = owTreeStamp(sp);
  world.groundCtx.drawImage(st.c, (x - st.R) * PPM, (y - st.R) * PPM, 2 * st.R * PPM, 2 * st.R * PPM);
}

// ---------- ciclo de vida dos setores ----------
function owStartSector(sx, sy) {
  const SP = OW.SP, key = sx + ',' + sy, bounds = [sx * SP, sy * SP, sx * SP + SP, sy * SP + SP];
  const S = { sx, sy, key, bounds, SP, state: 'gen', own: {}, rng: mulberry(owSeed({ sx, sy }, 'sector')), t0: performance.now(), ms: 0 };
  S.roads = owSectorRoads(S);
  // camada de sombras assadas do setor (4 px/m, com margem p/ sombras que passam da borda)
  const pad = OW.PAD, cv = makeCanvas((SP + pad * 2) * OW.SPPM, (SP + pad * 2) * OW.SPPM), ctx = cv.getContext('2d');
  ctx.setTransform(OW.SPPM / PPM, 0, 0, OW.SPPM / PPM, -(bounds[0] - pad) * OW.SPPM, -(bounds[1] - pad) * OW.SPPM);
  S.shadow = { canvas: cv, ctx, x0: bounds[0] - pad, y0: bounds[1] - pad, x1: bounds[2] + pad, y1: bounds[3] + pad, ppm: OW.SPPM };
  world.shadowLayers.set(key, S.shadow);
  S.snap = owSnap(); S._idxFrom = {};
  S.it = owGenSector(S);
  OW.sectors.set(key, S);
  return S;
}
// roda passos do gerador até gastar o orçamento (ms); true quando o setor terminou
function owStep(S, budget) {
  const t0 = performance.now(), prevCtx = world.groundCtx;
  world.groundCtx = S.shadow.ctx;
  try {
    while (performance.now() - t0 < budget) {
      const r = withRng(S.rng, () => S.it.next());
      owCollect(S, S.snap);
      if (r.done) { owFinish(S); return true; }
    }
  } finally { world.groundCtx = prevCtx; S.ms += performance.now() - t0; }
  return false;
}
function owFinish(S) {
  S.state = 'done'; S.props = S.own.props || [];
  for (const c of S.own.circles || []) if (c.kind !== 'tree' && c.kind !== 'bush' && c.kind !== 'rock' && c.kind !== 'lamp') OW.place.add(c, c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r);
  owRebuildRoads(); world.version++;
  OW.stats.genMs = S.ms; OW.stats.last = S.key;
  delete S.it; delete S.snap;
}
function owRebuildRoads() {
  world.roads.length = 0;
  for (const S of OW.sectors.values()) if (S.state === 'done') for (const r of S.roads) world.roads.push(r);
}
function owUnload(S) {
  for (const [name, arr] of OW_TRACK()) {
    const own = S.own[name]; if (!own || !own.length) continue;
    const kill = new Set(own); let j = 0;
    for (let i = 0; i < arr.length; i++) if (!kill.has(arr[i])) arr[j++] = arr[i];
    arr.length = j;
  }
  world.shadowLayers.delete(S.key); OW.sectors.delete(S.key);
  owRebuildIndices(); owRebuildRoads(); world.version++;
}
const owWanted = (px, py) => {
  const SP = OW.SP, out = [], R = Math.ceil(OW.R / SP) + 1, ci = Math.floor(px / SP), cj = Math.floor(py / SP);
  for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) {
    if (i < 0 || j < 0 || i * SP >= COG.WORLD_W || j * SP >= COG.WORLD_H) continue;
    // distância do jogador ao retângulo do setor (não ao centro): carrega antes de chegar à borda
    const dx = Math.max(i * SP - px, 0, px - (i + 1) * SP), dy = Math.max(j * SP - py, 0, py - (j + 1) * SP), d = Math.hypot(dx, dy);
    if (d <= OW.R) out.push([d, i, j]);
  }
  return out.sort((a, b) => a[0] - b[0]);
};
function owStreamTick(px, py, budget) {
  if (OW.job) { if (owStep(OW.job, budget)) OW.job = null; return; }
  for (const [, i, j] of owWanted(px, py)) if (!OW.sectors.has(i + ',' + j)) { OW.job = owStartSector(i, j); owStep(OW.job, budget); if (OW.job.state === 'done') OW.job = null; return; }
  // nada a gerar: descarrega um setor distante por quadro
  const SP = OW.SP;
  for (const S of OW.sectors.values()) {
    const dx = Math.max(S.bounds[0] - px, 0, px - S.bounds[2]), dy = Math.max(S.bounds[1] - py, 0, py - S.bounds[3]);
    if (S.state === 'done' && Math.hypot(dx, dy) > OW.R + OW.HYST) { owUnload(S); return; }
  }
}
// bloco do terreno só pinta quando os setores que o tocam (com a margem das sombras) estão prontos
function owChunkReady(ci, cj) {
  const SP = OW.SP, x0 = ci * CH - OW.PAD, y0 = cj * CH - OW.PAD, x1 = ci * CH + CH + OW.PAD, y1 = cj * CH + CH + OW.PAD;
  for (let j = Math.floor(y0 / SP); j <= Math.floor(y1 / SP); j++) for (let i = Math.floor(x0 / SP); i <= Math.floor(x1 / SP); i++) {
    if (i < 0 || j < 0 || i * SP >= COG.WORLD_W || j * SP >= COG.WORLD_H) continue;
    const S = OW.sectors.get(i + ',' + j); if (!S || S.state !== 'done') return false;
  }
  return true;
}
// props só dos setores que a câmera enxerga
function owPropsInView(W, H) {
  const cs = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => unproj(x, y, 0)), m = 12;
  const x0 = Math.min(...cs.map(p => p[0])) - m, x1 = Math.max(...cs.map(p => p[0])) + m, y0 = Math.min(...cs.map(p => p[1])) - m, y1 = Math.max(...cs.map(p => p[1])) + m;
  const out = OW.viewBuf; out.length = 0;
  for (const S of OW.sectors.values()) {
    if (S.state !== 'done' || S.bounds[0] > x1 || S.bounds[2] < x0 || S.bounds[1] > y1 || S.bounds[3] < y0) continue;
    for (const p of S.props) out.push(p);
  }
  return out;
}

// ---------- montagem ----------
function buildOpenWorld() {
  const t0 = performance.now();
  world.open = true; world.version = 0; world.seed = COG.WORLD_SEED; world.upperSegs = world.upperSegs || [];
  // mundo fixo: o ruído e os sprites não dependem da semente aleatória da sessão
  rngCur = mulberry(COG.WORLD_SEED ^ 0x5bd1e995);
  { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
  OW.cw = COG.buildWorld(COG.WORLD_SEED); OW.geo = OW.cw.geo; COG.indexRoads(OW.cw);
  for (const rd of OW.cw.roads) if (rd.cls !== 'rail') hashSegs(OW.roadHash, rd.pts, rd.w / 2 + SIDE + 14, { off: rd.w / 2 - ROAD_W });
  for (const rv of OW.geo.rivers) hashSegs(OW.riverHash, rv.pts, rv.w / 2 + 14, { hw: rv.w / 2 });
  owInstallFields();
  world.roads = []; world.junction = null; world.pond = null; world.pondPoly = null; world.trails = []; world.trafficSignals = [];
  world.shadowLayers = new Map(); world.groundCtx = makeCanvas(1, 1).getContext('2d');
  world.airports = OW.geo.anchors.airports.map((a, i) => ({ x: a.x, y: a.y, ang: a.ang, len: a.len, width: i ? 30 : 45, apron: a.apron, name: a.name }));
  OW.blk = new HashGrid(16); OW.place = new HashGrid(8);
  world.blocked = owBlocked;
  world.bareFn = (x, y, di) => (di === D_.DOWNTOWN || di === D_.PORT || di === D_.INDUSTRIAL || owAirfield(x, y)) ? 1 : 0;
  world.groundBase = owDrawBases; world.chunkReady = owChunkReady; world.propsInView = owPropsInView; world.streamTick = owStreamTick;
  // culturas: [r, g, b, cobertura das fileiras]
  terrain.crops = [[196, 170, 92, 0.92], [88, 128, 50, 0.95], [112, 142, 60, 0.86], [128, 96, 64, 0.12], [118, 150, 66, 1], [150, 156, 84, 0.7]];
  terrainInit(); owPaintMini();
  // sprites reaproveitados por todos os setores (iguais ao mapa local)
  const pool = (n, f) => Array.from({ length: n }, f);
  OW.pools = {
    oaks: [makeTree('oak', 'common'), makeTree('yard', 'common'), makeTree('oak', 'flowering'), makeTree('street', 'common'), makeTree('yard', 'fruiting'),
      makeTree('oak', 'common'), makeTree('street', 'flowering'), makeTree('oak', 'fruiting'), makeTree('yard', 'common'), makeTree('oak', 'mixed')],
    pines: pool(5, () => makeTree('pine')), bushes: pool(8, makeBush), rocks: pool(14, makeRock),
    tufts: [makeTuft(), makeTuft(), makeTuft(), makeTuft('#456f30', '#8daa50'), makeTuft('#526c37', '#b4b46b')],
    reeds: [makeTuft('#3d6b3a', '#5a8a46', 24), makeTuft('#4a7a3c', '#6f9a4e', 28)],
  };
  for (const sp of [...OW.pools.oaks, ...OW.pools.pines]) owTreeStamp(sp);
  urbanLife.litter = []; urbanLife.bins = []; urbanLife.sprites = URBAN_KINDS.map(kind => Array.from({ length: 3 }, (_, v) => urbanSprite(kind, v)));
  ecosystemInit();   // sprites das flores antes dos setores (o game.js chama de novo e ignora)

  // nascimento: calçada da via mais próxima do centro de uma cidade do interior
  const town = OW.geo.anchors.towns[0]; world.spawnName = town.name;
  let best = null, bd = 1e9;
  for (const rd of OW.cw.roads) if (rd.cls === 'street') for (const [x, y] of rd.pts) { const d = Math.hypot(x - town.x, y - town.y); if (d < bd) { bd = d; best = [x, y]; } }
  const sp0 = best || [town.x, town.y];
  // carrega já tudo num raio de 150 m (síncrono): o jogo começa com o bairro pronto
  for (const [d, i, j] of owWanted(sp0[0], sp0[1])) { if (d > 150) continue; const S = owStartSector(i, j); while (!owStep(S, 1e9)); }
  // ponto livre na calçada, de costas p/ a rua
  let spawn = sp0, aim = 0;
  for (let r = 0; r < 30 && spawn === sp0; r += 0.5) for (let a = 0; a < TAU; a += 0.4) {
    const x = sp0[0] + Math.cos(a) * r, y = sp0[1] + Math.sin(a) * r, d = roadDist(x, y);
    if (d > ROAD_W + 0.4 && d < ROAD_W + SIDE - 0.3 && !world.blocked(x, y, 0.4) && pondVal(x, y) > 1.3) { spawn = [x, y]; aim = a; break; }
  }
  world.spawn = spawn; world.aimDir = aim; world.targets = []; world.clear = [];
  OW.stats.startMs = performance.now() - t0;
  window.openWorld = OW;
}

// depuração: teleporta e carrega na hora os setores em volta (ex.: owTeleport(4540, 1880) = aeroporto)
function owTeleport(x, y, r = 140) {
  player.x = x; player.y = y; cam.x = cam.tx = x; cam.y = cam.ty = y;
  if (OW.job) { while (!owStep(OW.job, 1e9)); OW.job = null; }
  for (const [d, i, j] of owWanted(x, y)) { if (d > r || OW.sectors.has(i + ',' + j)) continue; const S = owStartSector(i, j); while (!owStep(S, 1e9)); }
  return [...OW.sectors.keys()].length;
}
