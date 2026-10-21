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
  // Micrograma pintada lâmina por lâmina uma vez no solo do mapa,
  // substituindo pontinhos retangulares repetitivos.
  const gc = ['#58752f', '#80a046', '#91ad52', '#4f6a2a', '#738f3d', '#a7b65d'];
  for (let i = 0; i < MAP * MAP * 10; i++) {
    const bx = rng() * MAP * PPM, by = rng() * MAP * PPM,
      length = R(1.6,4.7),lean=R(-2,2);
    g.strokeStyle=gc[(rng()*gc.length)|0];g.lineWidth=R(.55,1.1);
    g.beginPath();g.moveTo(bx,by);
    g.quadraticCurveTo(bx+lean*.32,by-length*.58,bx+lean,by-length);
    g.stroke();
    if (i%7===0) {
      g.beginPath();g.moveTo(bx+R(-1.7,1.7),by);
      g.quadraticCurveTo(bx-lean*.15,by-length*.5,bx-lean*.62,by-length*.81);
      g.stroke();
    }
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
function bakeTreeShadow(x,y,sp) {
  const g=world.groundCtx;
  const h=sp.trunkH+sp.r*.55,sx=x-SUN[0]*h*.32,sy=y-SUN[1]*h*.32;
  const cx=sx*PPM,cy=sy*PPM,rx=sp.r*PPM*.98,ry=sp.r*PPM*.65;
  g.save();
  // Faixa de penumbra mais natural, várias massas sobrepostas.
  for(let layer=4;layer>=1;layer--){
    const fade=[.07,.065,.04,.028][layer-1];
    g.fillStyle='rgba(15,27,9,'+fade+')';
    g.beginPath();g.ellipse(cx,cy,rx*(layer*.24),ry*(layer*.25),-.25,0,TAU);g.fill();
  }
  // Centenas de pequenos vazios de luz filtrada na sombra da copa.
  for(let i=0;i<190;i++){
    const a=rng()*TAU,d=Math.sqrt(rng()),px=cx+Math.cos(a)*rx*d,py=cy+Math.sin(a)*ry*d;
    const sz=R(2,8);
    g.fillStyle=i%4===0?'rgba(35,48,15,.13)':'rgba(14,24,9,.10)';
    g.beginPath();g.ellipse(px,py,sz,sz*R(.35,.85),a,0,TAU);g.fill();
  }
  // Occlusão ambiente junto à raiz em vez de tronco flutuando.
  for(let i=3;i>=1;i--){
    g.fillStyle='rgba(10,22,8,'+(i===1?.22:.10)+')';
    g.beginPath();g.ellipse(x*PPM,y*PPM,PPM*(.12+i*.10),PPM*(.08+i*.058),0,0,TAU);g.fill();
  }
  g.restore();
}

// ---------- sprites pintados uma vez ----------
// ---- Vegetação orgânica: copas com ramificações, folhagem em camadas e folhas reais.
// Tudo é pré-renderizado em sprites Canvas 2D, sem imagens externas.
// Cada variante consome somente o RNG do gerador durante a criação do mundo.
// Seis tons por espécie: sombra > meio-tom > borda iluminada.
// Nunca use tons ciano/cinza nas coníferas; o contraste vem de verdes naturais.
const LEAF_PALETTES = [
  { deep:'#1b321c', shade:'#284b27', body:'#3e6c31', mid:'#598340', sun:'#809e50', glint:'#a2b76c' },
  { deep:'#23341a', shade:'#39522a', body:'#56703a', mid:'#708b44', sun:'#96a65c', glint:'#adbb76' },
  { deep:'#1c3726', shade:'#2a5535', body:'#3f7746', mid:'#579252', sun:'#80ae69', glint:'#a4c386' },
  { deep:'#28351b', shade:'#425429', body:'#5d7635', mid:'#789044', sun:'#9eac55', glint:'#b7bd6a' },
];
const NEEDLE_PALETTES = [
  ['#141e12','#20351e','#2f4c29','#3c6434','#637845'],
  ['#182315','#293a22','#38512b','#516b3b','#72804b'],
  ['#18251a','#29412a','#385a32','#4c703e','#748652'],
  ['#12251a','#213d28','#2d5632','#41703c','#64834d']
];

// Folha lanceolada, desenhada como forma e não como pixel aleatório.
// As copas são formadas exclusivamente por folhas/agulhas individuais. NÃO
// preenchê-las com círculos ou elipses: o espaço negativo entre as folhas é
// parte importante da silhueta. As formas são calculadas só no pré-render.
// Único contorno de folha compartilhado pela copa, arbustos e partículas.
function traceLeaf(g,x,y,len,angle) {
  const c=Math.cos(angle),sn=Math.sin(angle),h=len*.5,w=len*.235;
  const ex=c*h,ey=sn*h,nx=-sn*w,ny=c*w;
  g.moveTo(x-ex,y-ey);
  g.quadraticCurveTo(x-c*len*.12+nx,y-sn*len*.12+ny,x+ex,y+ey);
  g.quadraticCurveTo(x+c*len*.05-nx,y+sn*len*.05-ny,x-ex,y-ey);
}
function paintLeaf(g,x,y,len,angle,color,vein=false) {
  g.fillStyle=color;g.beginPath();traceLeaf(g,x,y,len,angle);g.fill();
  if(vein&&len>3.1){
    const c=Math.cos(angle),sn=Math.sin(angle);
    g.strokeStyle='rgba(230,232,177,.32)';g.lineWidth=.58;g.beginPath();
    g.moveTo(x-c*len*.28,y-sn*len*.28);
    g.lineTo(x+c*len*.31,y+sn*len*.31);g.stroke();
  }
}
// Agrupa milhares de folhas de mesma cor em UM preenchimento por camada.
// Evita 100 mil fill() isolados durante o pré-render de cada sprite.
// NUNCA enviar 100 mil curvas para o mesmo fill(): os backends de Canvas
// podem descartar caminhos gigantes por limites de tesselação/rasterização.
// Quebra em blocos seguros de até 256 folhas sem perder a densidade.
const LEAF_BATCH_SIZE = 256;
function leafBatch(g, buckets, palette) {
  for(let tone=0;tone<palette.length;tone++){
    const entries=buckets[tone];
    if(!entries.length)continue;
    g.fillStyle=palette[tone];
    const step=LEAF_BATCH_SIZE*4;
    for(let begin=0;begin<entries.length;begin+=step){
      const end=Math.min(entries.length,begin+step);
      g.beginPath();
      for(let i=begin;i<end;i+=4)
        traceLeaf(g,entries[i],entries[i+1],entries[i+2],entries[i+3]);
      g.fill();
    }
  }
}
function woodyBranch(g, x0,y0,x1,y1,width) {
  const mx=(x0+x1)*.52, my=(y0+y1)*.52-3;
  g.lineCap='round';g.strokeStyle='#493927';g.lineWidth=width;
  g.beginPath();g.moveTo(x0,y0);g.quadraticCurveTo(mx,my,x1,y1);g.stroke();
  if(width>2) {
    g.strokeStyle='rgba(160,122,73,.45)';g.lineWidth=Math.max(.7,width*.24);
    g.beginPath();g.moveTo(x0-1,y0);g.quadraticCurveTo(mx-1,my,x1-1,y1);g.stroke();
  }
}
// Tronco das árvores largas: diâmetro quase constante (topo = 89% da base),
// bordas levemente sinuosas e casca em veios contínuos. Pinheiros preservados.
function paintBroadleafTrunk(g,cx,by,height,width) {
  const base=width*.50, mid=base*.955, tip=base*.89, top=by-height;
  // Curvatura contida para manter a aparência de tronco cilíndrico.
  const lean=R(-width*.035,width*.035);
  const outline=()=>{
    g.beginPath();
    g.moveTo(cx-base,by);
    g.bezierCurveTo(cx-base-.15,by-height*.23,
      cx-mid+lean*.38,by-height*.54,cx-tip+lean,top);
    g.lineTo(cx+tip+lean,top);
    g.bezierCurveTo(cx+mid+lean*.38,by-height*.54,
      cx+base+.15,by-height*.23,cx+base,by);
    g.closePath();
  };
  outline();g.fillStyle='#49382a';g.fill();
  g.save();outline();g.clip();
  const bark=g.createLinearGradient(cx-base,by,cx+base,by);
  bark.addColorStop(0,'#4d392b');
  bark.addColorStop(.18,'#76573c');
  bark.addColorStop(.38,'#9c7955');
  bark.addColorStop(.60,'#92714e');
  bark.addColorStop(.79,'#654a33');
  bark.addColorStop(1,'#3d2f27');
  g.fillStyle=bark;g.fillRect(cx-base-1,top-2,2*base+2,height+4);
  // Fissuras alinhadas com o sentido do crescimento; poucas, finas e longas.
  const grainCount=Math.max(30,Math.round(height*.72));
  for(let i=0;i<grainCount;i++){
    const py=by-R(3,height-2),x=cx+R(-mid*.9,mid*.9),
      len=R(4,16),curve=R(-1.0,1.0);
    g.strokeStyle=i%5===0?'rgba(231,194,143,.26)'
      :i%3===0?'rgba(46,31,24,.44)':'rgba(82,51,31,.37)';
    g.lineWidth=R(.40,.95);
    g.beginPath();g.moveTo(x,py);
    g.quadraticCurveTo(x+curve,py-len*.5,x+curve*.3,py-len);g.stroke();
  }
  // Rachaduras raras, sem "rabiscos" ou nós grandes e escuros.
  for(let i=0;i<6;i++){
    const x=cx+R(-mid*.65,mid*.65),py=by-R(8,height*.86),
      len=R(5,12);
    g.strokeStyle='rgba(39,28,23,.48)';g.lineWidth=R(.65,.95);
    g.beginPath();g.moveTo(x,py);g.lineTo(x+R(-.75,.75),py-len*.45);
    g.lineTo(x+R(-1,1),py-len);g.stroke();
  }
  for(let i=0;i<3;i++){
    const x=cx+R(-mid*.56,mid*.56),py=by-R(11,height*.78);
    g.strokeStyle='rgba(58,37,27,.48)';g.lineWidth=.70;
    g.beginPath();g.ellipse(x,py,R(.75,1.45),R(1.4,2.9),
      R(-.23,.23),0,TAU);g.stroke();
  }
  g.restore();
  // Contato leve no solo. Não ampliar a base com raízes triangulares.
  g.strokeStyle='rgba(47,33,22,.46)';g.lineWidth=.7;
  g.beginPath();g.moveTo(cx-base,by-1);g.lineTo(cx-base+.2,by-height*.27);
  g.moveTo(cx+base,by-1);g.lineTo(cx+base-.2,by-height*.27);g.stroke();
  return {baseWidth:base*2,midWidth:mid*2,topWidth:tip*2};
}
function paintTrunk(g,cx,by,height,width,pine=false) {
  if(!pine) return paintBroadleafTrunk(g,cx,by,height,width);
  // Madeira com volume, raiz aberta, casca irregular e sombra na face oposta.
  const top=by-height,foot=width*.65,tip=width*.42;
  const outline=()=>{
    g.beginPath();g.moveTo(cx-foot-3,by);
    g.bezierCurveTo(cx-foot*.75,by-height*.22,cx-tip*1.05,top+height*.16,cx-tip,top);
    g.lineTo(cx+tip,top);
    g.bezierCurveTo(cx+tip*.95,top+height*.28,cx+foot*.82,by-height*.15,cx+foot+3,by);
    g.closePath();
  };
  outline();g.fillStyle='#35291f';g.fill();
  g.save();outline();g.clip();
  const bark=g.createLinearGradient(cx-foot,0,cx+foot,0);
  bark.addColorStop(0,'#3a2b20');bark.addColorStop(.22,pine?'#64503a':'#654b34');
  bark.addColorStop(.48,pine?'#95745b':'#96704a');
  bark.addColorStop(.68,'#75543a');bark.addColorStop(1,'#2d241e');
  g.fillStyle=bark;g.fillRect(cx-foot-4,top-2,foot*2+8,height+5);
  // Veios longos de casca em tons alternados; curvas acompanham o tronco.
  for(let i=0;i<95;i++){
    const x=cx+R(-foot*.92,foot*.92),y=by-R(2,height-3),
      len=R(3,19),bend=R(-2.6,2.6);
    g.strokeStyle=i%4===0?'rgba(214,176,120,.31)':i%3===0?'rgba(28,21,19,.46)':'rgba(70,45,28,.35)';
    g.lineWidth=R(.48,1.48);g.beginPath();g.moveTo(x,y);
    g.quadraticCurveTo(x+bend,y-len*.53,x+bend*.5,y-len);g.stroke();
  }
  // Sulcos/bifurcações finas e nós na parte inferior.
  for(let i=0;i<8;i++){
    const x=cx+R(-foot*.65,foot*.65),y=by-R(8,height*.72);
    g.strokeStyle='rgba(31,23,16,.68)';g.lineWidth=R(.8,1.35);
    g.beginPath();g.ellipse(x,y,R(1.0,2.4),R(1.9,4.4),R(-.2,.2),0,TAU);g.stroke();
    g.fillStyle='rgba(190,153,105,.23)';g.fillRect(x-1.5,y-3,1,3.5);
  }
  g.restore();
  g.strokeStyle='rgba(24,19,16,.6)';g.lineWidth=1;
  g.beginPath();g.moveTo(cx-foot-2,by);g.lineTo(cx-tip,top);g.stroke();
  // Raízes discretas saindo do pé do tronco, integrando árvore ao solo.
  for(const side of [-1,1]){
    g.fillStyle=side<0?'#473324':'#5c422d';
    g.beginPath();g.moveTo(cx+side*foot*.4,by-7);
    g.quadraticCurveTo(cx+side*(foot+1),by-3,cx+side*(foot+R(4,8)),by);
    g.lineTo(cx+side*foot*.22,by);g.fill();
  }
}
function crownAnchors(cx,cy,r,family) {
  const street=family==='street',yard=family==='yard';
  const total=street?24:yard?27:33,anchors=[];
  for(let i=0;i<total;i++){
    const a=i*2.39996+R(-.36,.36);
    // Puxa folhas e galhos para o centro/tronco, sem achatar o contorno.
    const d=Math.sqrt((i+.35)/total)*R(.28,.87);
    const stretch=1+.16*Math.sin(a*3.1+i*.4);
    const x=cx+Math.cos(a)*r*d*stretch*(street?.91:1);
    const y=cy+Math.sin(a)*r*d*(street?.71:.73);
    anchors.push({x,y,rx:r*R(.15,.31),ry:r*R(.15,.25),
      phase:R(0,TAU),lit:Math.max(.08,Math.min(.96,.49+(cx-x)/r*.25+(cy-y)/r*.34))});
  }
  // Adiciona folhas junto à bifurcação do tronco, deixando a copa apoiada
  // sobre os galhos e não parecendo um pompom elevado.
  for(let i=0;i<8;i++){
    const a=i*2.39996+R(-.4,.4);
    anchors.push({x:cx+Math.cos(a)*r*R(.04,.30),
      y:cy+r*.23+Math.sin(a)*r*R(.05,.25),
      rx:r*R(.17,.27),ry:r*R(.14,.22),phase:R(0,TAU),lit:R(.24,.54)});
  }
  return anchors.sort((a,b)=>a.y-b.y);
}
// Folhagem opaca de contorno orgânico, nunca um círculo: cada ramo forma
// uma massa irregular que impede o topo de desaparecer a distância normal.
// As milhares de folhas individuais são colocadas em cima desta estrutura.
function branchFoliage(g,n,p,layer) {
  const steps=22, pts=[],seed=n.phase;
  const cx=n.x,cy=n.y,rx=n.rx*(layer===0?.99:.88),
    ry=n.ry*(layer===0?1.03:.90);
  for(let i=0;i<steps;i++) {
    const a=i*TAU/steps;
    const irregular=1+.15*Math.sin(a*3+seed)+.12*Math.sin(a*7-seed*1.3)
      +R(-.085,.085);
    const rr=irregular*(1+.07*Math.cos(a*2));
    pts.push([cx+Math.cos(a)*rx*rr,cy+Math.sin(a)*ry*rr]);
  }
  // Base natural, com recortes e sombras variáveis. Sem outlines pretos.
  g.fillStyle=layer===0?p.deep:(n.lit>.55?p.body:p.shade);
  g.beginPath();g.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);
  g.closePath();g.fill();
  if(layer===0) {
    // Variação de tom dentro do mesmo ramo, ligeiramente para a luz.
    g.fillStyle=p.shade;g.beginPath();
    g.moveTo(cx-rx*.64,cy-ry*.1);
    g.quadraticCurveTo(cx-rx*.50,cy-ry*.76,cx-rx*.05,cy-ry*.72);
    g.quadraticCurveTo(cx+rx*.23,cy-ry*.38,cx+rx*.32,cy-ry*.06);
    g.quadraticCurveTo(cx-rx*.14,cy-ry*.30,cx-rx*.64,cy-ry*.1);
    g.fill();
  }
}
function leafTone(p,light,deepLayer) {
  const q=rng();
  if(deepLayer) return q<.25?p.deep:q<.68?p.shade:p.body;
  if(q<.10) return p.deep;
  if(q<.30) return p.shade;
  if(q<.58) return p.body;
  if(q<.82) return p.mid;
  return light>.42?(q<.95?p.sun:p.glint):p.mid;
}
// Ramos folhosos gerados a partir de uma estrutura coerente: seis eixos
// principais com bifurcações assimétricas, incluindo horizontais e quase
// verticais. Cada extremidade vira um ponto real de crescimento de folhas.
function taperedBroadleafBranch(g,a,b,width) {
  const dx=b.x-a.x,dy=b.y-a.y;
  // Suave curvatura e espessura contínua; sub-ramos nascem sem quinas duras.
  const bend=Math.max(-2.5,Math.min(2.5,(dx+dy)*.04));
  const mx=(a.x+b.x)*.50-dy*.045+bend*.18;
  const my=(a.y+b.y)*.50+dx*.035-bend*.12;
  g.lineCap='round';g.lineJoin='round';
  const draw=()=>{g.beginPath();g.moveTo(a.x,a.y);
    g.quadraticCurveTo(mx,my,b.x,b.y);g.stroke();};
  g.strokeStyle='#423126';g.lineWidth=width+.32;draw();
  g.strokeStyle='#876448';g.lineWidth=Math.max(.52,width*.66);draw();
  if(width>1.35){
    g.strokeStyle='rgba(205,168,119,.24)';
    g.lineWidth=Math.max(.38,width*.17);
    g.beginPath();g.moveTo(a.x-.28,a.y-.32);
    g.quadraticCurveTo(mx-.28,my-.32,b.x-.28,b.y-.32);g.stroke();
  }
}
function makeBroadleafBranches(g,cx,cy,r) {
  const root={x:cx,y:cy+r*.64},tips=[],major=[];
  // 0 e 5: quase horizontais; 2 e 3: quase verticais.
  const directions=[-2.99,-2.60,-1.88,-1.37,-.65,-.12];
  for(let i=0;i<directions.length;i++){
    const theta=directions[i]+R(-.11,.11);
    const length=r*R(.59,.90);
    const start={x:cx+R(-r*.052,r*.052),y:root.y-i*r*.026};
    const fork={x:start.x+Math.cos(theta)*length*.33,
      y:start.y+Math.sin(theta)*length*.27};
    const end={x:start.x+Math.cos(theta)*length,
      y:start.y+Math.sin(theta)*length*.82};
    // O eixo central cresce antes da bifurcação; não explode em estrela.
    taperedBroadleafBranch(g,start,fork,R(1.9,2.65));
    taperedBroadleafBranch(g,fork,end,R(1.30,1.95));
    major.push({start,fork,end,angle:theta});
    tips.push(end);
    const forks=2+(rng()<.56?1:0);
    for(let j=0;j<forks;j++){
      const along=R(.55,.88),a={x:fork.x+(end.x-fork.x)*along,
        y:fork.y+(end.y-fork.y)*along};
      const side=j%2===0?-1:1;
      const fa=theta+side*R(.26,.63);
      const dist=r*R(.14,.29);
      const b={x:a.x+Math.cos(fa)*dist,y:a.y+Math.sin(fa)*dist*.8};
      taperedBroadleafBranch(g,a,b,R(.55,1.0));
      tips.push(b);
    }
  }
  const anchors=tips.map(t=>({x:t.x,y:t.y,
    rx:r*R(.12,.20),ry:r*R(.105,.185),
    phase:R(0,TAU),
    lit:Math.max(.15,Math.min(.95,.48+(cx-t.x)/r*.22+(cy-t.y)/r*.31))}));
  return {major,anchors,branchCount:major.length,
    twigCount:tips.length-major.length};
}
// Flores com pétalas delicadas e frutos com pedúnculo/volume, ancorados aos
// ramos da própria copa. Todas as variações são pré-renderizadas uma vez.
function paintBroadleafDetails(g,anchors,variant) {
  if(variant==='common'||!anchors.length)return {flowers:0,fruits:0};
  const flower=variant==='flowering'||variant==='mixed';
  const fruit=variant==='fruiting'||variant==='mixed';
  const petals=['#f0dfd0','#e3c2ca','#ddd0dc','#e8dda8'];
  const drupes=['#a83e36','#ad6638','#ac873d','#6b4057'];
  let flowers=0,fruits=0;
  const bloom=flower?(variant==='mixed'?21:51):0;
  const crop=fruit?(variant==='mixed'?13:34):0;
  const blossomColor=petals[(rng()*petals.length)|0];
  const fruitColor=drupes[(rng()*drupes.length)|0];
  for(let k=0;k<bloom;k++){
    const n=anchors[(rng()*anchors.length)|0],angle=R(0,TAU);
    const x=n.x+Math.cos(angle)*n.rx*R(.2,.79);
    const y=n.y+Math.sin(angle)*n.ry*R(.2,.80);
    const rad=R(1.05,1.75);
    // Quatro pétalas e miolo discreto; a sombra fica por baixo.
    g.fillStyle='rgba(49,57,31,.44)';
    g.beginPath();g.ellipse(x+.6,y+.8,rad*1.85,rad*1.6,0,0,TAU);g.fill();
    g.fillStyle=blossomColor;
    for(let q=0;q<4;q++){
      const a=q*Math.PI/2+angle*.14;
      g.beginPath();g.ellipse(x+Math.cos(a)*rad*.9,
        y+Math.sin(a)*rad*.9,rad*.77,rad*.62,a,0,TAU);g.fill();
    }
    g.fillStyle='#b5a153';g.fillRect(x-.6,y-.6,1.2,1.2);flowers++;
  }
  for(let k=0;k<crop;k++){
    const n=anchors[(rng()*anchors.length)|0],a=R(0,TAU),
      x=n.x+Math.cos(a)*n.rx*R(.08,.61),
      y=n.y+Math.sin(a)*n.ry*R(.08,.63);
    const size=R(1.55,2.55);
    g.strokeStyle='#4d542f';g.lineWidth=.85;g.beginPath();
    g.moveTo(x,y-size*.55);g.lineTo(x+R(-.7,.7),y-size*1.65);g.stroke();
    g.fillStyle='rgba(31,33,24,.43)';g.beginPath();
    g.ellipse(x+.65,y+.8,size,size*.83,0,0,TAU);g.fill();
    g.fillStyle=fruitColor;g.beginPath();
    g.ellipse(x,y,size*.91,size*.78,R(-.2,.2),0,TAU);g.fill();
    g.fillStyle='rgba(255,227,170,.34)';g.beginPath();
    g.ellipse(x-size*.32,y-size*.3,size*.22,size*.17,0,0,TAU);g.fill();
    fruits++;
  }
  return {flowers,fruits};
}
function leafCanopy(g,cx,cy,r,family,p,variant='common') {
  const scaffold=makeBroadleafBranches(g,cx,cy,r);
  const anchors=crownAnchors(cx,cy,r,family);
  // Parte das âncoras nasce nas pontas reais dos galhos estruturais.
  // Mantemos quantidade e densidade aproximadas para evitar custo extra.
  const tips=scaffold.anchors;
  for(let i=0;i<tips.length;i++){
    const idx=Math.floor(i*anchors.length/tips.length);
    anchors[idx]=tips[i];
  }
  anchors.sort((a,b)=>a.y-b.y);
  // Primeiro estrutura de sombra entrelaçada. Depois cada folha é desenhada.
  // Essa base preenche as clareiras excessivas que faziam a copa sumir.
  for(const n of anchors) branchFoliage(g,n,p,0);
  const colors=[p.deep,p.shade,p.body,p.mid,p.sun,p.glint];
  const buckets=()=>Array.from({length:6},()=>[]);
  const chooseTone=(n,layer)=>{
    const q=rng();
    if(layer===0)return q<.32?0:q<.70?1:2;
    if(layer===1)return q<.10?0:q<.29?1:q<.62?2:q<.88?3:4;
    return q<.12?1:q<.40?2:q<.70?3:n.lit>.45?(q<.95?4:5):3;
  };
  let count=0;
  // Aproximadamente 10× a geração anterior; folhas menores e com veios de cor.
  // Camadas batidas por tonalidade e pré-renderizadas UMA vez no Canvas.
  for(let layer=0;layer<3;layer++){
    const paint=buckets(),amount=layer===0?1170:layer===1?1260:940;
    for(const n of anchors){
      for(let j=0;j<amount;j++){
        const theta=R(0,TAU),d=Math.sqrt(rng());
        const xx=n.x+Math.cos(theta)*n.rx*d;
        const yy=n.y+Math.sin(theta)*n.ry*d;
        // Pequenas clareiras microscópicas, mas não buracos enormes.
        const gap=Math.sin((xx+n.phase*8)*.18)*Math.cos((yy-n.phase*9)*.18);
        if(gap>.976&&layer!==2)continue;
        // Até em zoom normal cada folha precisa ocupar pixels reconhecíveis.
        // As menores continuam visíveis porque a estrutura já é opaca.
        const size=layer===0?R(1.9,3.2):layer===1?R(2.0,3.6):R(1.85,3.25);
        const a=theta*.35+R(-1.2,1.2)-.2;
        const tone=chooseTone(n,layer);
        paint[tone].push(xx-(layer===2?1:0),yy-(layer===2?1.6:0),size,a);
        count++;
      }
    }
    leafBatch(g,paint,colors);
  }
  const rim=buckets();
  for(const n of anchors)for(let j=0;j<85;j++){
    const a=j*2.39996+R(-.14,.14),d=R(.79,1.22);
    const x=n.x+Math.cos(a)*n.rx*d,y=n.y+Math.sin(a)*n.ry*d;
    const tone=n.lit>.58&&rng()>.48?4:rng()>.5?3:2;
    rim[tone].push(x,y,R(2.0,4.2),a+R(-.9,.9));count++;
  }
  leafBatch(g,rim,colors);
  // Realces esparsos são folhas de verdade, não ruído/pixels genéricos.
  for(let i=0;i<42;i++){
    const n=anchors[(rng()*anchors.length)|0];
    paintLeaf(g,n.x+R(-n.rx,n.rx),n.y+R(-n.ry,n.ry),
      R(2,3.4),R(-1.6,1.6),p.sun,rng()<.34);
  }
  const details=paintBroadleafDetails(g,scaffold.anchors,variant);
  return {leafCount:count+42,branchCount:scaffold.branchCount,
    twigCount:scaffold.twigCount,branchAngles:scaffold.major.map(b=>b.angle),
    flowers:details.flowers,fruits:details.fruits};
}
function spruceNeedles(g,cx,by,r,p) {
  // Pinheiro composto de ramos finos com milhares de agulhas, sem triângulos
  // preenchidos nem camadas horizontais perfeitamente simétricas.
  const height=r*2.15, top=by-height;
  woodyBranch(g,cx,by+4,cx+R(-3,3),top,4.4);
  let needles=0;
  const needleLines=Array.from({length:5},()=>[]);
  const tiers=17;
  for(let level=0;level<tiers;level++){
    const t=level/(tiers-1),y=by-8-t*height*.90,
      reach=r*(1-t*.91)*R(.80,1.15);
    for(const side of [-1,1])for(let branch=0;branch<2;branch++){
      const originX=cx+R(-2,2);
      const x1=originX+side*reach*R(.58,.97),
        y1=y+R(-7,9)+(1-t)*7;
      // Leque de ramos com sombra sólida natural. Os contornos serrilhados
      // deixam o pinheiro legível sem transformá-lo em triângulos empilhados.
      const branchY=y-8,tipX=x1,tipY=y1;
      const needleFan=Math.max(5,reach*(.25+.18*(1-t)));
      g.fillStyle=side<0?p[1]:p[0];
      g.beginPath();g.moveTo(originX,branchY-needleFan*.58);
      for(let k=1;k<=13;k++){
        const f=k/13,px=originX+(tipX-originX)*f;
        const edge=Math.sin(f*21+t*11)*2+R(-2.6,2.6);
        g.lineTo(px,branchY+(tipY-branchY)*f-needleFan*(1-f)*.44+edge);
      }
      for(let k=13;k>=0;k--){
        const f=k/13,px=originX+(tipX-originX)*f;
        const edge=Math.sin(f*16+t*7)*2+R(-2.6,2.6);
        g.lineTo(px,branchY+(tipY-branchY)*f+needleFan*(1-f)*.42+edge);
      }
      g.closePath();g.fill();
      // Face verde-médio acompanha a orientação da luz com borda quebrada.
      g.fillStyle=side<0?p[2]:p[1];
      g.beginPath();g.moveTo(originX,branchY-needleFan*.30);
      g.lineTo(originX+(tipX-originX)*.90,tipY-needleFan*.10);
      g.lineTo(originX+(tipX-originX)*.55,branchY+(tipY-branchY)*.55);
      g.closePath();g.fill();
      woodyBranch(g,originX,y-8,x1,y1,Math.max(.8,2.1-t*.8));
      const segments=Math.max(12,Math.ceil(Math.abs(x1-originX)/2.1));
      for(let k=0;k<segments;k++){
        const f=(k+.5)/segments,xx=originX+(x1-originX)*f,
          yy=y-8+(y1-y+8)*f;
        // Cada pequeno conjunto é um leque de agulhas individuais.
        const fan=R(6,11)*(1-f*.38);
        for(let m=0;m<80;m++){
          const angle=R(-2.6,-.55),len=R(1.0,fan*.48),
            x2=xx+R(-2.1,2.1),y2=yy+R(-1.5,1.5);
          // Majoritariamente sombra e verde florestal; highlights < 3%,
          // sem cobrir toda a árvore com o último tom (lavado/ciano).
          const tone=m%53===0?4:m%13===0?3:m%5===0?0:m%3===0?1:2;
          needleLines[tone].push(x2,y2,x2+Math.cos(angle)*len*side,y2+Math.sin(angle)*len);
          needles++;
        }
      }
    }
  }
  // Broto apical e ramos desconexos suavizam a forma de cone.
  for(let i=0;i<70;i++){
    const f=rng(),x=cx+R(-1,1)*(5+f*13),y=top+R(-4,20);
    needleLines[i%4+1].push(x,y+R(2,5),x+R(-3,3),y-R(3,6));needles++;
  }
  for(let tone=0;tone<5;tone++){
    const lines=needleLines[tone];g.strokeStyle=p[tone];g.lineWidth=tone<=1?1.12:tone===2?.96:.72;g.beginPath();
    for(let i=0;i<lines.length;i+=4){g.moveTo(lines[i],lines[i+1]);g.lineTo(lines[i+2],lines[i+3]);}
    g.stroke();
  }
  return needles;
}
function makeTree(kind='oak',decoration=null) {
  const pine=kind==='pine',street=kind==='street',yard=kind==='yard';
  // Comparado com a geração V1: troncos encurtados em ~30%-45%.
  const trunkH=pine?R(.95,1.30):street?R(1.38,1.75):yard?R(.98,1.32):R(1.20,1.55);
  const r=pine?R(.99,1.37):street?R(1.24,1.62):yard?R(1.30,1.67):R(1.58,2.02);
  const S=SPR,pad=18,width=(pine?.27:.30)*S,th=trunkH*S;
  const tc=makeCanvas(width+pad*2+16,th+pad+12),tg=tc.getContext('2d');
  const tx=tc.width/2,ty=tc.height-pad/2;
  const trunkProfile=paintTrunk(tg,tx,ty,th,width,pine);
  const w=(r*(pine?2.45:2.9)+.45)*S,h=(pine?r*2.55:r*2.15)*S+pad*2;
  const cc=makeCanvas(w,h),cg=cc.getContext('2d'),cx=cc.width/2,by=cc.height-pad;
  let leafCount=0,needleCount=0,branchCount=0,twigCount=0,flowers=0,fruits=0,branchAngles=[];
  const appearance=pine?'none':(decoration||(()=>{
    const v=rng();
    return v<.55?'common':v<.75?'flowering':v<.95?'fruiting':'mixed';
  })());
  let leafColors;
  if(pine){
    const p=NEEDLE_PALETTES[(rng()*NEEDLE_PALETTES.length)|0];
    needleCount=spruceNeedles(cg,cx,by,r*S,p);
    leafColors=[p[1],p[2],p[3],p[4]];
  } else {
    const pal=LEAF_PALETTES[(rng()*LEAF_PALETTES.length)|0];
    // Copa mais perto do topo real do tronco.
    const crown=leafCanopy(cg,cx,by-r*S*.66,r*S,kind,pal,appearance);
    ({leafCount,branchCount,twigCount,branchAngles,flowers,fruits}=crown);
    leafColors=[pal.shade,pal.body,pal.mid,pal.sun,pal.glint];
  }
  return {trunk:tc,tax:tx,tay:ty,crown:cc,cax:cx,cay:by,trunkH,r,kind,
    leafCount,needleCount,leafColors,decoration:appearance,
    branchCount,twigCount,branchAngles,flowers,fruits,trunkProfile};
}
function makeBush() {
  // Arbusto 10× mais folhado, com folhas individuais em pequenos ramos.
  const r=R(.45,.85),S=SPR,pad=13,
    c=makeCanvas(r*2.65*S+pad*2,r*1.88*S+pad*2),g=c.getContext('2d'),
    cx=c.width/2,by=c.height-pad,p=LEAF_PALETTES[(rng()*LEAF_PALETTES.length)|0];
  const shoots=[],colors=[p.deep,p.shade,p.body,p.mid,p.sun,p.glint],
    paths=Array.from({length:6},()=>[]);
  for(let i=0;i<19;i++){
    const angle=R(-Math.PI,0),dist=R(.12,.92),
      x=cx+Math.cos(angle)*r*S*dist,y=by+Math.sin(angle)*r*S*.76*dist;
    shoots.push({x,y,rad:R(7,15)});
  }
  for(let k=0;k<shoots.length;k++){
    const n=shoots[k];woodyBranch(g,cx,by,n.x,n.y,1.15);
    for(let i=0;i<750;i++){
      const a=R(0,TAU),d=Math.sqrt(rng()),x=n.x+Math.cos(a)*n.rad*d,
        y=n.y+Math.sin(a)*n.rad*.83*d;
      const tone=i%11===0?0:i%6===0?1:i%4===0?4:i%3===0?3:2;
      paths[tone].push(x,y,R(.72,1.6),a);
    }
  }
  leafBatch(g,paths,colors);
  for(let i=0;i<95;i++){
    const n=shoots[(rng()*shoots.length)|0];
    paintLeaf(g,n.x+R(-n.rad,n.rad),n.y+R(-n.rad*.67,n.rad*.67),
      R(1.5,2.4),R(-1.4,1.4),rng()>.5?p.sun:p.mid);
  }
  if(rng()<.4){
    const flower=['#efe5cb','#d79597','#e9cd73'][(rng()*3)|0];
    for(let i=0;i<20;i++){
      const n=shoots[(rng()*shoots.length)|0],x=n.x+R(-n.rad,n.rad),
        y=n.y+R(-n.rad*.6,n.rad*.6);
      g.fillStyle=flower;g.fillRect(x-1.2,y-2.5,2.4,5);g.fillRect(x-2.5,y-1.2,5,2.4);
    }
  }
  return {img:c,ax:cx,ay:by,r,leafCount:19*750+95};
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

function makeTuft(c1='#5f8a34',c2='#86ab4a',hmax=17) {
  // Cada tufo agora possui dezenas de lâminas finas em profundidade,
  // em vez de sete triângulos grandes e contornados.
  const H=hmax+9,W=39,c=makeCanvas(W,H),g=c.getContext('2d'),
    colors=[c1,c2,'#395a2d','#a5b96c','#829850','#9a904d'];
  const blade=(x,h,lean,color,w)=>{
    const base=H-2;
    g.strokeStyle=color;g.lineCap='round';g.lineWidth=w;
    g.beginPath();g.moveTo(x,base);
    g.quadraticCurveTo(x+lean*.25,base-h*.48,x+lean,base-h);
    g.stroke();
  };
  // Sombras finas na base para densidade, mas sem retângulos artificiais.
  g.fillStyle='rgba(28,47,18,.18)';
  g.beginPath();g.ellipse(W*.5,H-2,W*.33,2.2,0,0,TAU);g.fill();
  for(let layer=0;layer<3;layer++){
    for(let i=0;i<40;i++){
      const x=R(6,W-6),h=R(hmax*.20,hmax*(layer===2?1.12:.82)),
        lean=R(-8,8),col=colors[(rng()*colors.length)|0];
      blade(x,h,lean,col,R(.55,1.35));
    }
  }
  for(let i=0;i<9;i++)blade(R(8,W-8),R(hmax*.65,hmax*1.07),
    R(-5,5),rng()>.5?'#b9c67f':c2,.72);
  return {img:c,ax:W/2,ay:H-2};
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
  // Dez sprites com variantes asseguradas por mundo: 5 comuns,
  // 2 floridos, 2 frutíferos e 1 raro misto (apenas broadleaf).
  const oaks = [
    makeTree('oak','common'),makeTree('yard','common'),
    makeTree('oak','flowering'),makeTree('street','common'),
    makeTree('yard','fruiting'),makeTree('oak','common'),
    makeTree('street','flowering'),makeTree('oak','fruiting'),
    makeTree('yard','common'),makeTree('oak','mixed')
  ], pines = pool(5, () => makeTree('pine'));
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
  const tufts = [makeTuft(), makeTuft(), makeTuft(), makeTuft('#456f30','#8daa50'), makeTuft('#526c37','#b4b46b')],
    reeds = [makeTuft('#3d6b3a', '#5a8a46', 24), makeTuft('#4a7a3c', '#6f9a4e', 28)];
  for (let i = 0; i < MAP * MAP * 0.115; i++) {
    const x = R(0.5, MAP - 0.5), y = R(0.5, MAP - 0.5);
    if (onRoad(x, y) || pondVal(x, y) < 1.05 || world.blocked(x, y, 0.2)) continue;
    world.props.push({ type: 'tuft', x, y, sp: tufts[i % tufts.length], phase: rng() * 6, flat: true });
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
      if (dx * dx + dy * dy < 1.05 &&
          depthOf(player.x,player.y)<depthOf(p.x,p.y)-0.25) a=0.68;
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
