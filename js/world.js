// world.js — mapa, chão pintado uma vez fora da tela, sprites de vegetação/pedras e colisão.
'use strict';

const MAP = 80;      // metros
const PPM = 28;      // pixels por metro na textura do chão
const SPR = 40;      // pixels por metro dos sprites pré-pintados
// semente: ?seed=123 na URL reproduz o mesmo mapa; sem ela, cada visita gera um mapa novo
const SEED = Number(new URLSearchParams(location.search).get('seed')) || ((Math.random() * 1e6) | 0);
const rng = mulberry(SEED);
const R = (a, b) => a + rng() * (b - a);

const world = {
  ground: null, props: [], circles: [], segs: [], boxes: [], lamps: [], roads: [], yards: [], trails: [], seed: SEED,
};

// ---------- ruído de valor (fbm) p/ terreno orgânico ----------
const PERM = new Uint8Array(512);
{ const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a, b) => PERM[(PERM[a & 255] + b) & 511] / 255;
  const u = smooth(xf), v = smooth(yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
function fbm(x, y, oct = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += vnoise(x * f, y * f) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; }
const forest = (x, y) => fbm(x * 0.05 + 31.7, y * 0.05 + 7.3);

// ---------- ruas curvas (Catmull-Rom) e campo de distância ----------
const ROAD_W = 3.5, SIDE = 2;   // meia largura do asfalto e largura da calçada
function catmull(ctrl, step = 0.5) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(ctrl[ctrl.length - 1].slice());
  return out;
}
function withNormals(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return { x: p[0], y: p[1], tx: dx / l, ty: dy / l, nx: -dy / l, ny: dx / l };
  });
}
function genRoads() {
  // avenida principal atravessando o mapa de oeste a leste, serpenteando
  const y0 = R(MAP * 0.5, MAP * 0.68), main = [[-6, y0]];
  for (let x = 10; x < MAP; x += R(14, 20)) main.push([x, clamp(main[main.length - 1][1] + R(-7, 7), MAP * 0.42, MAP * 0.8)]);
  main.push([MAP + 6, main[main.length - 1][1] + R(-3, 3)]);
  const M = withNormals(catmull(main));
  world.roads.push({ pts: M });
  // rua secundária saindo da avenida p/ o norte (e às vezes p/ o sul)
  const j = M[Math.floor(M.length * R(0.45, 0.72))];
  world.junction = j;
  const branch = dir => {
    const c = [[j.x, j.y], [j.x + R(-2, 2), j.y + dir * 10]];
    while (dir < 0 ? c[c.length - 1][1] > -6 : c[c.length - 1][1] < MAP + 6) {
      const l = c[c.length - 1]; c.push([clamp(l[0] + R(-8, 8), 10, MAP - 10), l[1] + dir * R(13, 18)]);
    }
    world.roads.push({ pts: withNormals(catmull(c)), branch: true });
  };
  branch(-1);
  if (rng() < 0.55) branch(1);
  // campo de distância até a rua mais próxima (grade de 0,5 m)
  const N = MAP * 2, D = new Float32Array(N * N).fill(99);
  for (const r of world.roads) for (const p of r.pts) {
    const ci = Math.round(p.x * 2), cj = Math.round(p.y * 2);
    for (let j2 = cj - 26; j2 <= cj + 26; j2++) for (let i2 = ci - 26; i2 <= ci + 26; i2++) {
      if (i2 < 0 || j2 < 0 || i2 >= N || j2 >= N) continue;
      const d = Math.hypot(i2 / 2 - p.x, j2 / 2 - p.y), k = j2 * N + i2;
      if (d < D[k]) D[k] = d;
    }
  }
  world.roadD = D;
}
function roadDist(x, y) {
  const N = MAP * 2, i = clamp(Math.round(x * 2), 0, N - 1), j = clamp(Math.round(y * 2), 0, N - 1);
  return world.roadD[j * N + i];
}
function onRoad(x, y) { return roadDist(x, y) < ROAD_W + SIDE + 0.3; }

// ---------- lago com margem irregular ----------
function genPond() {
  let best = null;
  for (let i = 0; i < 300; i++) {
    const x = R(10, MAP - 10), y = R(10, MAP - 10), d = roadDist(x, y);
    if (d < 15) continue;
    const s = d + rng() * 4;
    if (!best || s > best.s) best = { x, y, s };
  }
  if (best) world.pond = { x: best.x, y: best.y, rx: R(4, 6.5), ry: R(3, 5) };
}
function pondVal(x, y) {
  const p = world.pond; if (!p) return 9;
  return Math.hypot((x - p.x) / p.rx, (y - p.y) / p.ry) + (fbm(x * 0.35, y * 0.35, 3) - 0.5) * 0.7;
}
const isWater = (x, y) => pondVal(x, y) < 1;

// ---------- chão (uma vez) ----------
function paintGround() {
  const c = makeCanvas(MAP * PPM, MAP * PPM), g = c.getContext('2d');
  const M = v => v * PPM;
  const rect = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(M(x), M(y), M(w), M(h)); };
  const cell = 0.25, CP = Math.ceil(M(cell));

  // grama em blocos de "pixel" com tons dados pelo ruído (manchas orgânicas, bordas serrilhadas)
  const GR = ['#4f6a2a', '#5f7d33', '#6c8a3a', '#7a9642', '#8aa64a'];
  for (let y = 0; y < MAP; y += cell) for (let x = 0; x < MAP; x += cell) {
    const n = fbm(x * 0.09, y * 0.09, 4) + (rng() - 0.5) * 0.06;
    let k = clamp(Math.floor((n - 0.28) * 9.5), 0, 4);
    if (forest(x, y) > 0.58) k = Math.max(0, k - 1);           // chão de floresta mais escuro
    let col = GR[k];
    const dirt = fbm(x * 0.13 + 50, y * 0.13 + 50, 3);
    if (dirt > 0.7) col = dirt > 0.74 ? '#8a7048' : '#7d7a3e';  // clareiras de terra batida
    g.fillStyle = col; g.fillRect(M(x) | 0, M(y) | 0, CP, CP);
  }
  const gc = ['#58752f', '#80a046', '#91ad52', '#4f6a2a', '#738f3d'];
  for (let i = 0; i < MAP * MAP * 5; i++) {
    g.fillStyle = gc[(rng() * gc.length) | 0];
    g.fillRect((rng() * MAP * PPM) | 0, (rng() * MAP * PPM) | 0, 2, rng() < 0.4 ? 3 : 2);
  }
  // lago: areia -> água rasa -> funda, em blocos, com brilhos
  if (world.pond) {
    const p = world.pond;
    for (let y = p.y - p.ry - 3; y < p.y + p.ry + 3; y += cell) for (let x = p.x - p.rx - 3; x < p.x + p.rx + 3; x += cell) {
      const v = pondVal(x, y);
      if (v > 1.22) continue;
      g.fillStyle = v > 1.08 ? '#a99868' : v > 1 ? '#8a7f55' : v > 0.82 ? '#4a8098' : v > 0.5 ? '#3a6c86' : '#2f5d74';
      g.fillRect(M(x) | 0, M(y) | 0, CP, CP);
    }
    for (let i = 0; i < 160; i++) {
      const x = p.x + R(-p.rx, p.rx), y = p.y + R(-p.ry, p.ry);
      if (pondVal(x, y) < 0.8) { g.fillStyle = rng() < 0.5 ? '#7fb2c6' : '#5b93ab'; g.fillRect(M(x), M(y), R(4, 10), 2); }
    }
  }
  // trilhas de terra (geradas em buildWorld)
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const trail of world.trails) {
    for (const [w, col] of [[2.0, '#6f5a37'], [1.5, '#8a7048'], [0.9, '#9b8055']]) {
      g.strokeStyle = col; g.lineWidth = M(w); g.beginPath();
      trail.forEach(([x, y], i) => i ? g.lineTo(M(x), M(y)) : g.moveTo(M(x), M(y))); g.stroke();
    }
    for (let i = 0; i < trail.length * 14; i++) {
      const k = rng() * (trail.length - 1), a = trail[k | 0], b = trail[(k | 0) + 1], f = k % 1;
      g.fillStyle = rng() < 0.5 ? '#6a5534' : '#ad9467';
      g.fillRect(M(lerp(a[0], b[0], f) + R(-0.5, 0.5)), M(lerp(a[1], b[1], f) + R(-0.5, 0.5)), 2, 2);
    }
  }
  // ruas: todas as calçadas, depois meio-fio, depois asfalto (assim os cruzamentos se fundem)
  const stroke = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = M(w); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(M(p.x), M(p.y)) : g.moveTo(M(p.x), M(p.y))); g.stroke(); };
  for (const r of world.roads) stroke(r.pts, (ROAD_W + SIDE) * 2, '#a39e92');
  g.strokeStyle = '#8c877c'; g.lineWidth = 1;   // juntas das placas, perpendiculares à rua
  for (const r of world.roads) for (let i = 0; i < r.pts.length; i += 2) {
    const p = r.pts[i];
    for (const s of [1, -1]) {
      const ax = p.x + p.nx * s * (ROAD_W + 0.2), ay = p.y + p.ny * s * (ROAD_W + 0.2);
      if (roadDist(ax, ay) < ROAD_W - 0.1) continue;
      g.beginPath(); g.moveTo(M(ax), M(ay)); g.lineTo(M(p.x + p.nx * s * (ROAD_W + SIDE)), M(p.y + p.ny * s * (ROAD_W + SIDE))); g.stroke();
    }
  }
  for (let i = 0; i < MAP * MAP * 1.2; i++) {
    const x = R(0, MAP), y = R(0, MAP), d = roadDist(x, y);
    if (d > ROAD_W && d < ROAD_W + SIDE) { g.fillStyle = rng() < .5 ? '#b3aea2' : '#959084'; g.fillRect(M(x), M(y), 2, 2); }
  }
  for (const r of world.roads) stroke(r.pts, ROAD_W * 2 + 0.5, '#c9c4b8');
  for (const r of world.roads) stroke(r.pts, ROAD_W * 2 + 0.25, '#4f4c46');
  for (const r of world.roads) stroke(r.pts, ROAD_W * 2, '#45464c');
  for (let i = 0; i < MAP * MAP * 6; i++) {
    const x = R(0, MAP), y = R(0, MAP);
    if (roadDist(x, y) < ROAD_W - 0.1) { g.fillStyle = ['#3b3c41', '#505157', '#404146'][(rng() * 3) | 0]; g.fillRect(M(x), M(y), 2, 2); }
  }
  // rachaduras e manchas de óleo
  for (let i = 0; i < 160; i++) {
    let x = R(0, MAP), y = R(0, MAP); if (roadDist(x, y) > ROAD_W - 0.4) continue;
    let a = R(0, TAU); g.strokeStyle = '#323338'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(M(x), M(y));
    for (let k = 0; k < 6; k++) { a += R(-0.6, 0.6); x += Math.cos(a) * 0.22; y += Math.sin(a) * 0.22; g.lineTo(M(x), M(y)); }
    g.moveTo(M(x), M(y)); g.lineTo(M(x + Math.cos(a + 1.2) * 0.3), M(y + Math.sin(a + 1.2) * 0.3)); g.stroke();
  }
  for (let i = 0; i < 50; i++) {
    const x = R(0, MAP), y = R(0, MAP); if (roadDist(x, y) > ROAD_W - 1) continue;
    g.fillStyle = rng() < 0.5 ? 'rgba(20,20,26,.35)' : '#3f4045';
    g.beginPath(); g.ellipse(M(x), M(y), M(R(0.4, 1.2)), M(R(0.3, 0.8)), R(0, 3), 0, TAU); g.fill();
  }
  // faixa dupla amarela (some no cruzamento) + bueiros junto ao meio-fio
  const J = world.junction, nearJ = p => Math.hypot(p.x - J.x, p.y - J.y) < ROAD_W + 3;
  g.strokeStyle = '#d9b23a'; g.lineWidth = 3; g.lineCap = 'butt';
  for (const r of world.roads) for (const o of [-0.13, 0.13]) {
    g.beginPath(); let on = false;
    for (const p of r.pts) {
      if (nearJ(p)) { on = false; continue; }
      const qx = M(p.x + p.nx * o), qy = M(p.y + p.ny * o);
      on ? g.lineTo(qx, qy) : g.moveTo(qx, qy); on = true;
    }
    g.stroke();
  }
  for (const r of world.roads) for (let i = 30; i < r.pts.length; i += 55) {
    const p = r.pts[i], s = i % 2 ? 1 : -1;
    if (nearJ(p)) continue;
    g.save(); g.translate(M(p.x + p.nx * s * (ROAD_W - 0.45)), M(p.y + p.ny * s * (ROAD_W - 0.45))); g.rotate(Math.atan2(p.ty, p.tx));
    g.fillStyle = '#26272b'; g.fillRect(-M(0.4), -M(0.25), M(0.8), M(0.5));
    g.fillStyle = '#55565c'; for (let k = 0; k < 4; k++) g.fillRect(-M(0.35) + k * M(0.2), -M(0.2), 3, M(0.4));
    g.restore();
  }
  // faixas de pedestre em cada braço do cruzamento
  g.fillStyle = '#d8d6cf';
  for (const r of world.roads) {
    let ci = 0, cd = 1e9; r.pts.forEach((p, i) => { const d = Math.hypot(p.x - J.x, p.y - J.y); if (d < cd) { cd = d; ci = i; } });
    for (const dir of [-1, 1]) {
      const p = r.pts[ci + dir * Math.round((ROAD_W + 3.2) * 2)]; if (!p) continue;
      g.save(); g.translate(M(p.x), M(p.y)); g.rotate(Math.atan2(p.ty, p.tx));
      for (let k = -3; k < 3; k++) g.fillRect(-M(0.85), M(k * 1.12 + 0.28), M(1.7), M(0.6));
      g.restore();
    }
  }
  world.paintFloors && world.paintFloors(g, M, rect);   // pisos, caminhos e sombras das casas (houses.js)
  world.ground = c; world.groundCtx = g;
}

// sombras assadas no chão (giram junto com o mapa porque a luz é do mundo)
function bakeShadow(x, y, rx, ry, h) {
  const g = world.groundCtx, k = h * 0.28;
  g.fillStyle = 'rgba(20,28,10,0.32)';
  g.beginPath();
  g.ellipse((x - SUN[0] * k) * PPM, (y - SUN[1] * k) * PPM, rx * PPM, ry * PPM, 0.6, 0, TAU);
  g.fill();
}

// Sombra orgânica pré-pintada: contato no tronco + luz filtrada entre folhas.
// Não cria gradientes pesados por quadro, apenas durante a geração do mapa.
function bakeTreeShadow(x, y, sp) {
  const g=world.groundCtx;
  const projected=sp.trunkH+sp.r*.55, sx=x-SUN[0]*projected*.36, sy=y-SUN[1]*projected*.36;
  g.save();
  const cx=sx*PPM, cy=sy*PPM, rx=sp.r*PPM*1.0, ry=sp.r*PPM*.68;
  for(let i=0;i<34;i++){
    const a=rng()*TAU, d=Math.sqrt(rng())*.95;
    g.fillStyle=i%4===0?'rgba(19,30,12,0.075)':'rgba(16,28,12,0.12)';
    g.beginPath();
    g.ellipse(cx+Math.cos(a)*d*rx,cy+Math.sin(a)*d*ry,
      R(.10,.27)*rx,R(.10,.31)*ry,R(-1,1),0,TAU);
    g.fill();
  }
  // Difusão atmosférica no centro e contato real com o solo.
  for(let i=3;i>=1;i--){
    g.fillStyle='rgba(16,25,10,'+(i===3?.025:i===2?.035:.045)+')';
    g.beginPath();g.ellipse(cx,cy,rx*i*.30,ry*i*.31,0,0,TAU);g.fill();
  }
  g.fillStyle='rgba(15,23,10,0.35)';
  g.beginPath();g.ellipse(x*PPM,y*PPM,PPM*.25,PPM*.15,0,0,TAU);g.fill();
  g.restore();
}

// ---------- sprites pintados uma vez ----------
// ---- Vegetação orgânica: copas com ramificações, folhagem em camadas e folhas reais.
// Tudo é pré-renderizado em sprites Canvas 2D, sem imagens externas.
// Cada variante consome somente o RNG do gerador durante a criação do mundo.
const LEAF_PALETTES = [
  { deep:'#203923', shade:'#2e522c', body:'#45743a', mid:'#5d8e46', sun:'#91ae56', glint:'#b3c875' },
  { deep:'#253b24', shade:'#345a2b', body:'#53763a', mid:'#769648', sun:'#a7b85d', glint:'#c6cf83' },
  { deep:'#203c32', shade:'#2e5d3c', body:'#457f4d', mid:'#67a362', sun:'#9ac279', glint:'#c0d69b' },
  { deep:'#354027', shade:'#516235', body:'#6a8541', mid:'#849b4b', sun:'#b3b862', glint:'#d3cf83' },
];
const NEEDLE_PALETTES = [
  ['#132a23','#1f4334','#2c6043','#407757','#688b62'],
  ['#172e27','#234937','#36664a','#48795a','#80a077'],
  ['#1a3431','#244944','#34635a','#4d7b71','#86a299'],
];

// Folha lanceolada, desenhada como forma e não como pixel aleatório.
function paintLeaf(g, x, y, length, angle, color, vein = false) {
  g.save();
  g.translate(x, y); g.rotate(angle);
  const w = length * 0.34;
  g.fillStyle = color; g.beginPath();
  g.moveTo(-length * 0.5, 0);
  g.quadraticCurveTo(-length * 0.1, -w * 1.05, length * 0.52, 0);
  g.quadraticCurveTo(-length * 0.05, w * 1.12, -length * 0.5, 0);
  g.fill();
  if (vein) {
    g.strokeStyle = 'rgba(234,242,180,0.28)';
    g.lineWidth = 0.65; g.beginPath();
    g.moveTo(-length * 0.29, 0); g.lineTo(length * 0.34, 0); g.stroke();
  }
  g.restore();
}
function woodyBranch(g, a, b, width, darker = false) {
  const midx = (a[0] + b[0]) * 0.5 + (b[0] - a[0]) * 0.08;
  const midy = (a[1] + b[1]) * 0.5;
  g.lineCap = 'round';
  g.strokeStyle = darker ? '#332b20' : '#4b3729';
  g.lineWidth = width + 1.2; g.beginPath(); g.moveTo(a[0], a[1]);
  g.quadraticCurveTo(midx, midy, b[0], b[1]); g.stroke();
  g.strokeStyle = darker ? '#5d4830' : '#816447';
  g.lineWidth = Math.max(0.8, width * 0.55);
  g.stroke();
}
function paintTrunk(g, bx, bottom, height, r, leafKind = false) {
  const top = bottom - height;
  const taper = r * 0.40, foot = r * 0.75;
  g.fillStyle = '#33271e'; g.beginPath();
  g.moveTo(bx - foot - 4, bottom);
  g.quadraticCurveTo(bx - r * 0.55, bottom - height * 0.12, bx - taper, top);
  g.lineTo(bx + taper * 0.72, top);
  g.quadraticCurveTo(bx + r * 0.60, bottom - height * 0.24, bx + foot + 4, bottom);
  g.closePath(); g.fill();
  g.fillStyle = '#73553a'; g.beginPath();
  g.moveTo(bx - foot * 0.55, bottom - 1);
  g.quadraticCurveTo(bx - r * 0.35, bottom - height * 0.4, bx - taper * 0.6, top);
  g.lineTo(bx + taper * 0.12, top);
  g.quadraticCurveTo(bx + r * 0.08, bottom - height * 0.3, bx + foot * 0.02, bottom - 2);
  g.fill();
  g.strokeStyle = '#a18059'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(bx - r * 0.29, bottom - 3);
  g.quadraticCurveTo(bx - r * 0.16, bottom - height * 0.5, bx - r * 0.21, top + height * 0.1); g.stroke();
  const marks = Math.max(12, Math.floor(height / 6));
  for (let i = 0; i < marks; i++) {
    const py = bottom - R(7, height - 4), xx = bx + R(-r * 0.45, r * 0.45);
    g.strokeStyle = i % 3 ? 'rgba(34,26,21,0.32)' : 'rgba(215,176,122,0.25)';
    g.lineWidth = R(0.7, 1.5);
    g.beginPath(); g.moveTo(xx, py); g.lineTo(xx + R(-2,2), py + R(3,12)); g.stroke();
  }
  if (!leafKind) {
    // Ramificação principal aparente acima do tronco; a copa cobre parte dela.
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI + i * Math.PI / 4.0 + R(-0.13,0.13);
      const x = bx + Math.sin(a) * r * R(2.0,3.7);
      const y = top + Math.cos(a) * r * R(1.5,2.7);
      woodyBranch(g, [bx + R(-r*.2,r*.2), top + R(1,7)], [x,y], R(2.6,5.0));
    }
  }
}
function organicCrown(g, cx, cy, radius, family, palette) {
  const street = family === 'street', airy = family === 'yard' || street;
  const nodes = [];
  const count = street ? 24 : airy ? 29 : 36;
  // Irregular branch clusters, not a circular ring of identical blobs.
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU + R(-0.46,0.46);
    const outward = Math.sqrt(rng()) * R(0.22,0.88);
    const x = cx + Math.cos(angle) * radius * outward * (street ? 0.92 : 1.07);
    const y = cy + Math.sin(angle) * radius * outward * (street ? 0.8 : 0.70);
    const rx = radius * R(0.16,0.34), ry = rx * R(0.58,0.94);
    nodes.push({x,y,rx,ry,i});
  }
  nodes.sort((a,b)=>a.y-b.y);
  const rootY = cy + radius * 0.86;
  // Branches glimpsed through real canopy gaps.
  for (let i = 0; i < nodes.length; i += 2) {
    const n = nodes[i];
    woodyBranch(g,[cx + R(-6,6),rootY],[n.x,n.y],R(1.5,3.0),true);
  }
  // Lumpy irregular silhouetting with directional light and interior darkness.
  for (const n of nodes) {
    g.save(); g.translate(n.x,n.y); g.rotate(R(-0.45,0.45));
    g.fillStyle = palette.deep;
    g.beginPath();g.ellipse(2.5,4,n.rx+2,n.ry+2,0,0,TAU);g.fill();
    g.fillStyle = n.y>cy + radius*0.2 ? palette.shade : palette.body;
    g.beginPath();g.ellipse(0,0,n.rx,n.ry,0,0,TAU);g.fill();
    g.fillStyle = n.x<cx && n.y<cy ? palette.mid : palette.shade;
    g.beginPath();g.ellipse(-n.rx*.18,-n.ry*.22,n.rx*.67,n.ry*.64,0,0,TAU);g.fill();
    g.restore();
  }
  // Leaflets are painterly, with highlights in sunlit upper-left clusters.
  for (const n of nodes) {
    const lit = Math.max(0,Math.min(1,0.54 + (cx-n.x)/radius*.25 + (cy-n.y)/radius*.32));
    const count = Math.floor(n.rx*n.ry*(airy?0.26:0.30));
    for(let j=0;j<count;j++){
      const a=R(0,TAU),d=Math.sqrt(rng())*0.95;
      const x=n.x+Math.cos(a)*n.rx*d, y=n.y+Math.sin(a)*n.ry*d;
      const q=rng();
      const col=q<0.10 ? palette.deep : q<0.32 ? palette.shade
        : q<0.67 ? palette.body : q<0.90 ? palette.mid
        : lit>0.52 ? palette.glint : palette.sun;
      paintLeaf(g,x,y,R(2.1,5.0),a+R(-0.8,0.8),col,q>0.98&&lit>.55);
    }
    // Fringe twigs and leaves break the repetitive circular crown contour.
    for(let j=0;j<10;j++){
      const a=j/10*TAU+R(-0.4,0.4);
      const x=n.x+Math.cos(a)*n.rx*R(0.84,1.10), y=n.y+Math.sin(a)*n.ry*R(0.84,1.12);
      paintLeaf(g,x,y,R(3,6.4),a+R(-0.6,0.6),
        (n.y<cy&&n.x<cx&&rng()>.4)?palette.sun:palette.body);
    }
  }
}
function evergreenCrown(g, cx, baseY, radius, palette) {
  const height = radius * R(2.45,2.85);
  const top = baseY - height;
  // Thin trunk and long angled branches are visible between asymmetric whorls.
  woodyBranch(g,[cx,baseY+6],[cx+R(-4,4),top+6],5,true);
  const whorls=9;
  for(let i=0;i<whorls;i++){
    const t=i/(whorls-1), y=baseY-t*height*.90, x=cx+Math.sin(i*2.4)*3+R(-3,3);
    const width=radius*(1-t*.91)*R(0.81,1.13);
    for(const side of [-1,1]) woodyBranch(g,[cx,y-18],[x+side*width*.86,y+R(-1,7)],Math.max(1,3-t*1.6),true);
    // Organic taper with serrated tips rather than rigid stacked triangles.
    for (const layer of [0,1]) {
      const w=width*(layer?0.77:1), ybase=y-(layer?8:0);
      const pts=[[x+R(-3,3),ybase-w*R(.80,1.0)]];
      for(let k=8;k>=0;k--){
        const f=k/8;
        pts.push([x + f*w + R(-3.6,3.6), ybase + Math.sin(f*4)*2 + R(-4,3)]);
      }
      for(let k=0;k<=8;k++){
        const f=k/8;
        pts.push([x-f*w+R(-3.6,3.6), ybase+Math.sin(f*4)*2+R(-4,3)]);
      }
      poly(g,pts, palette[layer?2:0],null);
      // Directional branch faces, not uniformly flat.
      const hl=[[x-w*.63,ybase-5],[x-3,ybase-w*.77],[x+w*.08,ybase-3],[x-w*.38,ybase-4]];
      poly(g,hl,palette[layer?4:2],null);
    }
    // Needles individually define lighter twigs and the shadow side.
    const needles = Math.round(95 + width*1.8);
    for(let j=0;j<needles;j++){
      const f=R(-1,1), x2=x+f*width, frac=Math.abs(f);
      const y2=y - (1-frac)*width*R(.16,.80)+R(-4,3);
      g.strokeStyle= rng()<.28 ? palette[1] : (f<0&&rng()<.5?palette[4]:palette[2]);
      g.lineWidth=R(.65,1.45);
      g.beginPath();g.moveTo(x2,y2);g.lineTo(x2+R(-3,3),y2-R(2.3,6));g.stroke();
    }
  }
  // Fine tapered leading shoot softens the rigid apex.
  for(let k=0;k<15;k++){
    const x=cx+R(-8,8),y=top+R(-5,18);
    g.strokeStyle=palette[k%3+2]; g.lineWidth=1;
    g.beginPath();g.moveTo(x,y+6);g.lineTo(x+R(-2,2),y-4);g.stroke();
  }
}
function makeTree(kind='oak') {
  const pine = kind==='pine', street=kind==='street', yard=kind==='yard';
  const trunkH=pine?R(1.8,2.55):street?R(2.55,3.15):yard?R(1.75,2.30):R(2.0,2.7);
  const r=pine?R(1.15,1.65):street?R(1.30,1.72):yard?R(1.25,1.85):R(1.65,2.25);
  const S=SPR, pad=20, tw=(pine?0.20:0.32)*S;
  const th=trunkH*S;
  const tc=makeCanvas(tw+pad*2+24,th+pad+12),tg=tc.getContext('2d'),bx=tc.width/2;
  paintTrunk(tg,bx,tc.height-pad/2,th,tw*.47,pine);
  const w=(r*2.65+0.55)*S,h=(pine?r*3.6:r*2.6)*S+pad*2;
  const cc=makeCanvas(w,h),cg=cc.getContext('2d'),cx=cc.width/2,by=cc.height-pad;
  if(pine){
    const p=NEEDLE_PALETTES[(rng()*NEEDLE_PALETTES.length)|0];
    evergreenCrown(cg,cx,by-r*S*.15,r*S,p);
  }else{
    const pal=LEAF_PALETTES[(rng()*LEAF_PALETTES.length)|0];
    // Clusters create irregular silhouette; visible branching adds depth.
    organicCrown(cg,cx,by-r*S*.89,r*S,kind,pal);
  }
  return { trunk:tc, tax:bx, tay:tc.height-pad/2, crown:cc, cax:cx,
    cay:by, trunkH, r, kind, leafColors:pine?
      ['#436954','#63816b','#9caa77']:['#688e43','#93aa51','#b7b86a','#b6a071'] };
}
function makeBush() {
  const r=R(.43,.83),S=SPR,pad=10;
  const c=makeCanvas((r*2.7)*S+pad*2,(r*1.95)*S+pad*2),g=c.getContext('2d');
  const cx=c.width/2,by=c.height-pad,p=LEAF_PALETTES[(rng()*LEAF_PALETTES.length)|0];
  const nodes=[];
  for(let i=0;i<13;i++){
    const x=cx+R(-r*.78,r*.78)*S, y=by-r*S*R(.25,1.1);
    const rr=r*S*R(.17,.36);
    nodes.push({x,y,rr});
  }
  nodes.sort((a,b)=>a.y-b.y);
  g.strokeStyle='#413d27';g.lineWidth=1.7;
  for(let i=0;i<6;i++){const n=nodes[i];g.beginPath();g.moveTo(cx,by);g.lineTo(n.x,n.y);g.stroke();}
  for(const n of nodes){
    g.fillStyle=p.deep;g.beginPath();g.ellipse(n.x+2,n.y+2,n.rr*1.08,n.rr*.75,0,0,TAU);g.fill();
    g.fillStyle=n.y<by-r*S*.6?p.mid:p.body;
    g.beginPath();g.ellipse(n.x-1.5,n.y-2,n.rr,n.rr*.67,R(-.4,.4),0,TAU);g.fill();
    for(let j=0;j<Math.round(n.rr*3.6);j++){
      const a=R(0,TAU),d=Math.sqrt(rng()),x=n.x+Math.cos(a)*n.rr*d,y=n.y+Math.sin(a)*n.rr*.7*d;
      paintLeaf(g,x,y,R(2,4),a,rng()<.3?p.sun:rng()<.5?p.mid:p.shade);
    }
  }
  if(rng()<.48) {
    const fc=['#eee2da','#d77f8a','#d5c37e'][(rng()*3)|0];
    for(let i=0;i<22;i++){
      const n=nodes[(rng()*nodes.length)|0],x=n.x+R(-n.rr,n.rr),y=n.y+R(-n.rr*.6,n.rr*.6);
      g.fillStyle=fc;g.beginPath();g.arc(x,y,R(1,2),0,TAU);g.fill();
    }
  }
  return {img:c,ax:cx,ay:by,r};
}

function makeRock() {
  const r = R(0.3, 0.75), S = SPR, c = makeCanvas(r * 2.6 * S, r * 2.2 * S), g = c.getContext('2d');
  const cx = c.width / 2, by = c.height - 4, n = 8, pts = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const rr = r * S * R(0.75, 1.05);
    pts.push([cx + Math.cos(a) * rr * 1.15, by + Math.sin(a) * rr * R(0.7, 1.0)]);
  }
  pts.push([cx + r * S * 1.1, by], [cx - r * S * 1.1, by]);
  poly(g, pts, '#6d6a66', INK, 2);
  const top = pts.slice(1, n - 2).map(([x, y]) => [lerp(x, cx - 4, 0.25), lerp(y, by - r * S * 0.9, 0.2)]);
  top.push([cx - 2, by - r * S * 0.25]);
  poly(g, top, '#8f8b84', null);
  poly(g, [[cx - r * S * 0.55, by - r * S * 0.55], [cx - r * S * 0.1, by - r * S * 0.85], [cx, by - r * S * 0.45]], '#aeaaa1', null);
  g.fillStyle = '#5a6b34';
  for (let i = 0; i < 6; i++) g.fillRect(cx + R(-r, r) * S * 0.8, by - R(0, r) * S * 0.4, 3, 2);
  return { img: c, ax: cx, ay: by, r };
}

function makeTuft(c1 = '#5f8a34', c2 = '#86ab4a', hmax = 17) {
  const H = hmax + 3, c = makeCanvas(26, H), g = c.getContext('2d');
  for (let i = 0; i < 7; i++) {
    const x = 5 + rng() * 16, h = R(hmax * 0.5, hmax), lean = R(-5, 5);
    poly(g, [[x - 2, H - 1], [x + lean, H - 1 - h], [x + 2, H - 1]], i % 2 ? c1 : c2, i % 3 ? null : '#2c3f18');
  }
  return { img: c, ax: 13, ay: H - 1 };
}

function makeTarget() {
  const c = makeCanvas(46, 74), g = c.getContext('2d');
  poly(g, [[20, 73], [20, 30], [26, 30], [26, 73]], '#6b4a30', INK, 2);
  poly(g, [[8, 66], [22, 46], [25, 48], [12, 68]], '#5a3c26', INK, 2);
  const rings = ['#f1ede2', '#2a2a2e', '#3c7ac0', '#d0473b', '#f2c94c'];
  g.fillStyle = INK; g.beginPath(); g.arc(23, 24, 22, 0, TAU); g.fill();
  rings.forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(23, 24, 20 - i * 4, 0, TAU); g.fill(); });
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(27, 28, 20, -0.4, 2.2); g.fill();
  return { img: c, ax: 23, ay: 73 };
}

// ---------- vento ----------
function wind(t, x, y) {
  return Math.sin(t * 1.6 + x * 0.35 + y * 0.21) * 0.6 + Math.sin(t * 0.55 + x * 0.12) * 0.4 + Math.sin(t * 4.1 + y) * 0.08;
}
function drawSway(g, img, ax, ay, p, sc, shear, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  g.setTransform(sc, 0, -shear * sc, sc, p.x, p.y);
  g.drawImage(img, -ax, -ay);
  g.restore();
}

// ---------- montagem procedural ----------
function inClear(x, y, r) {
  for (const z of world.clear || []) {
    if (z.ax !== undefined) {   // corredor (segmento) entre o jogador e os alvos
      const ex = z.bx - z.ax, ey = z.by - z.ay, u = clamp(((x - z.ax) * ex + (y - z.ay) * ey) / (ex * ex + ey * ey), 0, 1);
      if (Math.hypot(x - z.ax - ex * u, y - z.ay - ey * u) < z.r + r) return true;
    } else if (Math.hypot(x - z.x, y - z.y) < z.r + r) return true;
  }
  return false;
}
function freeSpot(x, y, r) {
  if (x < 1 || y < 1 || x > MAP - 1 || y > MAP - 1 || onRoad(x, y)) return false;
  if (pondVal(x, y) < 1.12 + r * 0.25) return false;
  if (world.blocked && world.blocked(x, y, r)) return false;
  if (inClear(x, y, r)) return false;
  for (const c of world.circles) if (Math.hypot(c.x - x, c.y - y) < c.r + r + 0.4) return false;
  return true;
}
// trilha sinuosa de A até B
function trail(a, b) {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6)), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  const c = [a];
  for (let i = 1; i < n; i++) { const t = i / n, o = R(-2.2, 2.2); c.push([a[0] + dx * t - dy / l * o, a[1] + dy * t + dx / l * o]); }
  c.push(b);
  world.trails.push(catmull(c, 0.6));
}
function pickSpawn() {
  let best = null;
  for (let i = 0; i < 500; i++) {
    const x = R(8, MAP - 8), y = R(8, MAP - 8), d = roadDist(x, y);
    if (d < 9 || pondVal(x, y) < 2 || (world.blocked && world.blocked(x, y, 3))) continue;
    const s = -forest(x, y) * 12 - Math.abs(d - 15) * 0.15 + rng();
    if (!best || s > best.s) best = { x, y, s };
  }
  return best || { x: MAP / 2, y: MAP / 4 };
}

function buildWorld() {
  genRoads();
  genPond();
  world.buildHouses && world.buildHouses();
  // nascimento numa clareira + alvos na direção mais aberta
  const sp = pickSpawn(); world.spawn = [sp.x, sp.y];
  let bestA = 0, bestS = -1e9;
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * TAU, tx = sp.x + Math.cos(a) * 9, ty = sp.y + Math.sin(a) * 9;
    if (tx < 3 || ty < 3 || tx > MAP - 3 || ty > MAP - 3 || onRoad(tx, ty) || pondVal(tx, ty) < 1.5 || world.blocked(tx, ty, 1)) continue;
    const s = -forest(tx, ty) * 10 + rng();
    if (s > bestS) { bestS = s; bestA = a; }
  }
  world.targets = [-0.35, 0, 0.35].map((o, i) => [sp.x + Math.cos(bestA + o) * (7 + i * 1.5), sp.y + Math.sin(bestA + o) * (7 + i * 1.5)]);
  world.aimDir = bestA;
  world.clear = [{ x: sp.x, y: sp.y, r: 4.5 }, ...world.targets.map(([x, y]) => ({ ax: sp.x, ay: sp.y, bx: x, by: y, r: 1.4 }))];
  // trilhas: clareira -> casa mais próxima, clareira -> lago
  const fronts = houses.map(H => H.front).sort((a, b) => Math.hypot(a[0] - sp.x, a[1] - sp.y) - Math.hypot(b[0] - sp.x, b[1] - sp.y));
  if (fronts[0]) trail([sp.x, sp.y], fronts[0]);
  if (world.pond) { const p = world.pond, a = Math.atan2(sp.y - p.y, sp.x - p.x); trail([sp.x, sp.y], [p.x + Math.cos(a) * p.rx * 1.2, p.y + Math.sin(a) * p.ry * 1.2]); }
  paintGround();

  // vegetação: densidade vem do ruído "floresta"; pinheiros no miolo, carvalhos na borda
  const pool = (n, f) => Array.from({ length: n }, f);
  const oaks = [makeTree('oak'), makeTree('oak'), makeTree('oak'), makeTree('oak'),
    makeTree('yard'), makeTree('yard'), makeTree('street'), makeTree('street')],
    pines = pool(5, () => makeTree('pine'));
  const bushes = pool(8, makeBush), rocks = pool(6, makeRock);
  const addTree = (x, y, sp2) => {
    const t = { type: 'tree', x, y, sp: sp2, hit: 0, phase: rng() * 6 };
    world.props.push(t);
    world.circles.push({ x, y, r: 0.28, kind: 'tree', ref: t, h: 6 });
    bakeTreeShadow(x, y, sp2);
  };
  for (let i = 0, n = 0; i < 6000 && n < 90; i++) {
    const x = R(1, MAP - 1), y = R(1, MAP - 1), f = forest(x, y);
    if (rng() > smooth(clamp((f - 0.46) / 0.24, 0, 1)) * 0.85 + 0.012) continue;
    if (!freeSpot(x, y, 1.2)) continue;
    addTree(x, y, f > 0.64 && rng() < 0.65 ? pines[(rng() * pines.length) | 0] : oaks[(rng() * oaks.length) | 0]); n++;
  }
  for (let i = 0, n = 0; i < 4000 && n < 70; i++) {
    const x = R(1, MAP - 1), y = R(1, MAP - 1), f = forest(x, y);
    const edge = 1 - Math.abs(f - 0.5) * 6, nearYard = world.yards.some(r => x > r[0] - 2 && x < r[2] + 2 && y > r[1] - 2 && y < r[3] + 2);
    if (rng() > Math.max(0.03, edge * 0.5, nearYard ? 0.3 : 0)) continue;
    if (!freeSpot(x, y, 0.7)) continue;
    const s = bushes[(rng() * bushes.length) | 0]; world.props.push({ type: 'bush', x, y, sp: s, phase: rng() * 6 });
    world.circles.push({ x, y, r: s.r * 0.6, kind: 'bush', soft: true });
    bakeShadow(x, y, s.r, s.r * 0.6, 1); n++;
  }
  const addRock = (x, y) => {
    const s = rocks[(rng() * rocks.length) | 0]; world.props.push({ type: 'rock', x, y, sp: s });
    world.circles.push({ x, y, r: s.r * 0.9, kind: 'rock', h: s.r * 1.4 });
    bakeShadow(x, y, s.r, s.r * 0.7, 0.6);
  };
  for (let i = 0, n = 0; i < 800 && n < 16; i++) { const x = R(1, MAP - 1), y = R(1, MAP - 1); if (freeSpot(x, y, 0.6)) { addRock(x, y); n++; } }
  if (world.pond) for (let i = 0, n = 0; i < 300 && n < 7; i++) {   // pedras na margem do lago
    const p = world.pond, a = R(0, TAU), x = p.x + Math.cos(a) * p.rx * R(1.2, 1.5), y = p.y + Math.sin(a) * p.ry * R(1.2, 1.5);
    if (freeSpot(x, y, 0.4)) { addRock(x, y); n++; }
  }
  const tufts = [makeTuft(), makeTuft(), makeTuft()], reeds = [makeTuft('#3d6b3a', '#5a8a46', 24), makeTuft('#4a7a3c', '#6f9a4e', 28)];
  for (let i = 0; i < MAP * MAP * 0.075; i++) {
    const x = R(0.5, MAP - 0.5), y = R(0.5, MAP - 0.5);
    if (onRoad(x, y) || pondVal(x, y) < 1.05 || world.blocked(x, y, 0.2)) continue;
    world.props.push({ type: 'tuft', x, y, sp: tufts[i % 3], phase: rng() * 6, flat: true });
  }
  if (world.pond) for (let i = 0; i < 900; i++) {   // juncos na beira d'água
    const p = world.pond, x = p.x + R(-p.rx - 2, p.rx + 2), y = p.y + R(-p.ry - 2, p.ry + 2), v = pondVal(x, y);
    if (v > 0.93 && v < 1.08 && rng() < 0.5) world.props.push({ type: 'tuft', x, y, sp: reeds[i % 2], phase: rng() * 6, flat: true });
  }
  // alvos de tiro
  const tg = makeTarget();
  for (const [x, y] of world.targets) {
    const t = { type: 'target', x, y, sp: tg, hit: 0, wob: 0 };
    world.props.push(t);
    world.circles.push({ x, y, r: 0.3, kind: 'target', ref: t, h: 1.8 });
    bakeShadow(x, y, 0.5, 0.3, 1.2);
  }
  // postes ao longo das ruas, alternando os lados, braço virado p/ o asfalto
  for (const r of world.roads) for (let i = 10, s = 1; i < r.pts.length; i += 24, s = -s) {
    const p = r.pts[i], x = p.x + p.nx * s * (ROAD_W + 0.6), y = p.y + p.ny * s * (ROAD_W + 0.6);
    if (x < 1 || y < 1 || x > MAP - 1 || y > MAP - 1 || Math.hypot(p.x - world.junction.x, p.y - world.junction.y) < 9) continue;
    if (world.blocked(x, y, 0.3) || world.lamps.some(l => Math.hypot(l.x - x, l.y - y) < 6)) continue;
    world.lamps.push({ x, y, ax: -p.nx * s, ay: -p.ny * s });
  }
  for (const l of world.lamps) world.circles.push({ x: l.x, y: l.y, r: 0.12, kind: 'lamp', h: 4 });
}

// movimento com colisão + água (desliza nos eixos se bater na margem)
function moveTo(ox, oy, nx, ny, r) {
  for (const [x, y] of [[nx, ny], [nx, oy], [ox, ny]]) {
    const q = collide(x, y, r);
    if (pondVal(q[0], q[1]) > 1.02) return q;
  }
  return [ox, oy];
}

// desenho de um prop já ordenado por profundidade
function drawProp(g, p, t, player) {
  const sc = cam.zoom / SPR, base = proj(p.x, p.y, 0);
  if (p.type === 'tree') {
    const sp = p.sp;
    g.save(); g.setTransform(sc, 0, 0, sc, base.x, base.y); g.drawImage(sp.trunk, -sp.tax, -sp.tay); g.restore();
    const top = proj(p.x, p.y, sp.trunkH);
    const w = wind(t, p.x, p.y) * 0.05 + Math.sin(p.hit * 30) * p.hit * 0.15;
    // copa fica translúcida quando o jogador está atrás dela (como no Zomboid)
    let a = 1;
    if (player) {
      const pp = proj(player.x, player.y, 1);
      const dx = (pp.x - top.x) / (sp.r * cam.zoom), dy = (pp.y - (top.y - sp.r * cam.zoom * 0.8)) / (sp.r * cam.zoom);
      if (dx * dx + dy * dy < 1.3 && depthOf(player.x, player.y) < depthOf(p.x, p.y) + 0.4) a = 0.38;
    }
    drawSway(g, sp.crown, sp.cax, sp.cay, { x: top.x + w * 8 * sc, y: top.y }, sc, w, a);
  } else if (p.type === 'bush') {
    drawSway(g, p.sp.img, p.sp.ax, p.sp.ay, base, sc, wind(t, p.x, p.y) * 0.06);
  } else if (p.type === 'tuft') {
    drawSway(g, p.sp.img, p.sp.ax, p.sp.ay, base, sc, wind(t, p.x, p.y) * 0.22);
  } else if (p.type === 'rock') {
    g.save(); g.setTransform(sc, 0, 0, sc, base.x, base.y); g.drawImage(p.sp.img, -p.sp.ax, -p.sp.ay); g.restore();
  } else if (p.type === 'target') {
    const w = Math.sin(p.wob * 40) * p.wob * 0.5;
    drawSway(g, p.sp.img, p.sp.ax, p.sp.ay, base, sc * 0.72, w);
    if (p.hit > 0) { g.fillStyle = `rgba(255,240,180,${p.hit * 2})`; const c = proj(p.x, p.y, 0.95); g.beginPath(); g.arc(c.x, c.y, 0.36 * cam.zoom, 0, TAU); g.fill(); }
  }
}

function drawLamp(g, l, night) {
  const b = proj(l.x, l.y, 0), t = proj(l.x, l.y, 4.1), h = proj(l.x + l.ax * 1.1, l.y + l.ay * 1.1, 4.1);
  const w = Math.max(2, cam.zoom * 0.09);
  g.lineCap = 'round';
  g.strokeStyle = INK; g.lineWidth = w + 2; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(t.x, t.y); g.lineTo(h.x, h.y); g.stroke();
  g.strokeStyle = '#3d4248'; g.lineWidth = w; g.stroke();
  g.strokeStyle = '#59616a'; g.lineWidth = Math.max(1, w * 0.35); g.beginPath(); g.moveTo(b.x - w * 0.2, b.y); g.lineTo(t.x - w * 0.2, t.y); g.stroke();
  poly(g, [[h.x - w * 1.6, h.y], [h.x + w * 1.6, h.y], [h.x + w, h.y + w * 1.2], [h.x - w, h.y + w * 1.2]], '#2d3136', INK, 1);
  g.fillStyle = night ? '#fff1b8' : '#c9c4a8'; g.fillRect(h.x - w * 0.9, h.y + w * 0.9, w * 1.8, w * 0.5);
}

// ---------- colisão e tiro ----------
function raycast(ox, oy, dx, dy, maxD) {
  let best = { t: maxD, kind: 'none' };
  for (const c of world.circles) {
    if (c.soft) continue;
    const fx = ox - c.x, fy = oy - c.y, b = fx * dx + fy * dy, cc = fx * fx + fy * fy - c.r * c.r;
    const disc = b * b - cc;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t > 0.05 && t < best.t) best = { t, kind: c.kind, ref: c.ref, nx: (fx + dx * t) / c.r, ny: (fy + dy * t) / c.r };
  }
  for (const s of world.segs) {
    if (s.h < 1.2) continue;
    const ex = s.x2 - s.x1, ey = s.y2 - s.y1, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((s.x1 - ox) * ey - (s.y1 - oy) * ex) / den, u = ((s.x1 - ox) * dy - (s.y1 - oy) * dx) / den;
    if (t > 0.05 && t < best.t && u >= 0 && u <= 1) {
      const l = Math.hypot(ex, ey);
      let nx = -ey / l, ny = ex / l; if (nx * dx + ny * dy > 0) { nx = -nx; ny = -ny; }
      best = { t, kind: s.kind || 'wall', ref: s, nx, ny, glass: s.window };
    }
  }
  best.x = ox + dx * best.t; best.y = oy + dy * best.t;
  return best;
}

function collide(x, y, r) {
  for (let it = 0; it < 3; it++) {
    for (const c of world.circles) {
      const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy), m = c.r + r * (c.soft ? 0.5 : 1);
      if (d < m && d > 1e-6) { x = c.x + dx / d * m; y = c.y + dy / d * m; }
    }
    for (const s of world.segs) {
      const ex = s.x2 - s.x1, ey = s.y2 - s.y1, l2 = ex * ex + ey * ey;
      const u = clamp(((x - s.x1) * ex + (y - s.y1) * ey) / l2, 0, 1);
      const px = s.x1 + ex * u, py = s.y1 + ey * u, dx = x - px, dy = y - py, d = Math.hypot(dx, dy), m = r + 0.08;
      if (d < m && d > 1e-6) { x = px + dx / d * m; y = py + dy / d * m; }
    }
  }
  return [clamp(x, 0.5, MAP - 0.5), clamp(y, 0.5, MAP - 0.5)];
}
