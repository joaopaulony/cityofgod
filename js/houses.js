// houses.js — casas, mercado, móveis, cercas e carros como geometria 3D chapada.
// Paredes são fatiadas em pedaços de 1 m p/ ordenar por profundidade junto com o personagem.
// Quando o jogador entra, as paredes viradas p/ a câmera são cortadas e o telhado some (como no Zomboid).
'use strict';

const houses = [];
const boxes = [];      // móveis/carros: {x,y,z,w,d,h,rot,top,side,kind}

function addHouse(def) {
  const H = Object.assign({ h: 2.7, segs: [], inside: false, roofKind: 'gable' }, def);
  H.seed = (houses.length + 1) * 977 + (world.seed % 100003);
  const wallTop = H.roofKind === 'flat' ? H.h + PARAPET : H.h;
  const W = H.x1 - H.x0, D = H.y1 - H.y0, alongX = W >= D;
  const gableEnds = H.roofKind === 'gable' ? (alongX ? ['W', 'E'] : ['N', 'S']) : [];
  // Mesma altura de cumeeira usada em roofs.js: sem folgas acima da empena.
  const rise = (alongX ? D : W) / 2 * PITCH;
  const sides = {
    S: { a: [H.x0, H.y1], dir: [1, 0], n: [0, 1], len: W },
    N: { a: [H.x0, H.y0], dir: [1, 0], n: [0, -1], len: W },
    W: { a: [H.x0, H.y0], dir: [0, 1], n: [-1, 0], len: D },
    E: { a: [H.x1, H.y0], dir: [0, 1], n: [1, 0], len: D },
  };
  H.sides = sides;
  for (const k in sides) {
    const sd = sides[k], o = H.open[k] || {};
    sd.Hc = gableEnds.includes(k) ? H.h + rise + 0.06 : wallTop;
    sd.eave = H.roofKind === 'hip' || (H.roofKind === 'gable' && !gableEnds.includes(k));
    if ((o.door || []).length) H.frontSide = k;
    for (let i = 0; i < sd.len; i++) {
      const s = {
        x1: sd.a[0] + sd.dir[0] * i, y1: sd.a[1] + sd.dir[1] * i,
        x2: sd.a[0] + sd.dir[0] * (i + 1), y2: sd.a[1] + sd.dir[1] * (i + 1),
        nx: sd.n[0], ny: sd.n[1], h: wallTop, house: H, ext: true, side: k, idx: i,
        door: (o.door || []).includes(i), window: (o.win || []).includes(i),
        c0: i === 0, c1: i === sd.len - 1, sign: o.sign && o.sign.includes(i),
        doorAnim: (o.door || []).includes(i) ? { open: 0, target: 0 } : null,
        windowAnim: (o.win || []).includes(i) ? { open: 0, target: 0, timer: 3 + ((H.seed + i * 13 + k.charCodeAt(0)) % 12),
          rand: mulberry(H.seed * 23 + i * 97 + k.charCodeAt(0) * 293) } : null,
      };
      H.segs.push(s);
      if (!s.door) world.segs.push(s);
    }
  }
  for (const w of H.inner || []) {
    const len = Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1)), dx = (w.x2 - w.x1) / len, dy = (w.y2 - w.y1) / len;
    for (let i = 0; i < len; i++) {
      const s = { x1: w.x1 + dx * i, y1: w.y1 + dy * i, x2: w.x1 + dx * (i + 1), y2: w.y1 + dy * (i + 1), nx: -dy, ny: dx, h: H.storeys ? H.floorHeight : H.h, house: H, ext: false, floor:0, door: w.door === i,
        doorAnim: w.door === i ? { open: 0, target: 0 } : null };
      H.segs.push(s);
      if (!s.door) world.segs.push(s);
    }
  }
  H.style = houseStyle(H, mulberry(H.seed));
  houses.push(H);
  return H;
}

// texturas da casa, pintadas uma vez na primeira vez que aparecem
function houseTex(H) {
  if (H.tex) return H.tex;
  const rnd = mulberry(H.seed + 5), S = H.style, T = { ext: {}, int: {} };
  for (const k in H.sides) { T.ext[k] = paintFacade(H, k, true, rnd); T.int[k] = paintFacade(H, k, false, rnd); }
  // divisória interna: 1 m com rodapé
  const pc = makeCanvas(TEX, (H.storeys ? H.floorHeight : H.h) * TEX), pg = pc.getContext('2d');
  paintPlaster(pg, 0, 0, TEX, (H.storeys ? H.floorHeight : H.h) * TEX, S.interior, rnd, 0.1);
  pg.fillStyle = '#6b4a32'; pg.fillRect(0, ((H.storeys ? H.floorHeight : H.h) - 0.12) * TEX, TEX, 0.12 * TEX);
  T.part = pc;
  T.door = paintDoor(S.door[0], S.door[1], rnd);
  T.innerDoor = paintDoor('flush', '#a07850', rnd);
  return (H.tex = T);
}

function addBox(b) {
  b = Object.assign({ z: 0, rot: 0, kind: 'box' }, b);
  boxes.push(b);
  if (b.solid !== false) {
    const c = boxCorners(b), hh = b.z + b.h;
    for (let i = 0; i < 4; i++) (b.floor===1?(world.upperSegs=world.upperSegs||[]):world.segs).push({
      x1:c[i][0],y1:c[i][1],x2:c[(i+1)%4][0],
      y2:c[(i+1)%4][1],h:hh,kind:b.kind,house:b.house,floor:b.floor||0
    });
  }
  return b;
}
function boxCorners(b) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), hw = b.w / 2, hd = b.d / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [b.x + u * c - v * s, b.y + u * s + v * c]);
}

// ---------- modelos de construção (coordenadas locais, porta no lado sul) ----------
const TPL = {
  A: {
    w: 10, d: 8, setback: 3.6, yard: true,
    def: { ext: '#d6c7a4', int: '#cbb894', roof: '#4d5366', trim: '#f1ece0',
      open: { S: { door: [4], win: [1, 2, 7, 8] }, N: { win: [2, 3, 6, 7] }, W: { win: [3, 4] }, E: { win: [2, 5] } },
      inner: [{ x1: 5, y1: 0, x2: 5, y2: 8, door: 3 }],
      floors: [{ x0: 0, y0: 0, x1: 5, y1: 8, kind: 'wood' }, { x0: 5, y0: 0, x1: 10, y1: 8, kind: 'carpet', col: '#6d7f94' }] },
    furn: [
      { x: 1.6, y: 0.5, w: 3, d: 0.6, h: 0.9, top: '#cfc6b4', side: '#7e5a3a', kind: 'counter' },
      { x: 3.6, y: 0.45, w: 0.8, d: 0.7, h: 1.85, top: '#e9e7e2', side: '#d8d6d0', kind: 'fridge' },
      { x: 2, y: 3.4, w: 1.6, d: 1, h: 0.75, top: '#8b5a35', side: '#6a4127', kind: 'table' },
      { x: 1.1, y: 6.7, w: 0.8, d: 2.2, h: 0.45, top: '#7d4a3a', side: '#5e3529', kind: 'sofa' },
      { x: 0.75, y: 6.7, w: 0.3, d: 2.2, h: 0.9, top: '#8d5544', side: '#5e3529', kind: 'sofa', solid: false },
      { x: 4.6, y: 6.2, w: 0.5, d: 1.4, h: 0.55, top: '#3b3433', side: '#2a2524', kind: 'tv' },
      { x: 4.6, y: 6.2, w: 0.12, d: 1.2, h: 0.7, z: 0.55, top: '#222', side: '#15171c', kind: 'screen', solid: false },
      { x: 8.4, y: 1.4, w: 2.2, d: 2.6, h: 0.5, top: '#e8e3d8', side: '#6b4a32', kind: 'bed' },
      { x: 8.4, y: 2.1, w: 2.0, d: 1.6, h: 0.08, z: 0.5, top: '#4f6f9c', side: '#3b5378', kind: 'blanket', solid: false },
      { x: 9.55, y: 5.5, w: 0.6, d: 1.6, h: 2.0, top: '#7a5434', side: '#5d3f26', kind: 'wardrobe' },
      { x: 6.2, y: 7.4, w: 1.4, d: 0.6, h: 0.75, top: '#9a7048', side: '#6e4c2e', kind: 'desk' },
    ],
  },
  B: {
    w: 8, d: 8, setback: 3,
    def: { ext: '#9fb4c2', int: '#d9cfbd', roof: '#7a3b2c', trim: '#f4f1ea',
      open: { S: { door: [2], win: [5, 6] }, N: { win: [2, 5] }, E: { win: [3, 4] }, W: { win: [2, 5] } },
      floors: [{ x0: 0, y0: 0, x1: 8, y1: 8, kind: 'wood', col: '#8a5a34' }] },
    furn: [
      { x: 4, y: 4, w: 1.4, d: 1.4, h: 0.75, top: '#a57a4c', side: '#6e4c2e', kind: 'table' },
      { x: 1, y: 6.5, w: 0.8, d: 2.4, h: 0.45, top: '#4b6b5a', side: '#334a3e', kind: 'sofa' },
      { x: 7.5, y: 1.5, w: 0.5, d: 2.5, h: 1.9, top: '#6b4a30', side: '#53391f', kind: 'shelf' },
    ],
  },
  SHOP: {
    w: 8, d: 8, setback: 0.8,
    def: { h: 3.2, ext: '#9c4a3b', int: '#e1ddd2', roof: '#5c5b60', trim: '#e9e3d6', roofKind: 'flat', brick: true,
      open: { S: { door: [3], win: [1, 2, 5, 6], sign: [2, 3, 4, 5] }, W: { win: [2, 3, 4, 5] } },
      floors: [{ x0: 0, y0: 0, x1: 8, y1: 8, kind: 'tile', col: '#d8d4c8' }] },
    furn: [
      ...[0, 1, 2].map(i => ({ x: 4.6, y: 1.8 + i * 1.8, w: 4.4, d: 0.7, h: 1.5, top: ['#d0473b', '#e2b23c', '#3c7ac0'][i], side: '#7a7d84', kind: 'shelf' })),
      { x: 1.5, y: 6.6, w: 1.8, d: 0.7, h: 1.0, top: '#c9c3b5', side: '#6f5136', kind: 'counter' },
      { x: 7.3, y: 4, w: 0.8, d: 3, h: 1.0, top: '#cfe6ef', side: '#e4e4e0', kind: 'freezer' },
    ],
  },
};
// variações de cor p/ as casas não ficarem repetidas
const SIDINGS = [['#d6c7a4', '#4d5366'], ['#9fb4c2', '#7a3b2c'], ['#c9b48a', '#5b4a42'], ['#b8c4a4', '#4a5a6a'], ['#e0d6c4', '#6b3a2e'], ['#a9b8c8', '#3f4550']];

const LOCAL_SIDES = { S: { n: [0, 1], dir: [1, 0] }, N: { n: [0, -1], dir: [1, 0] }, W: { n: [-1, 0], dir: [0, 1] }, E: { n: [1, 0], dir: [0, 1] } };
const sideOf = n => n[1] > 0.5 ? 'S' : n[1] < -0.5 ? 'N' : n[0] < -0.5 ? 'W' : 'E';

// Mantém os móveis dentro da área habitável, respeitando o centro, a rotação
// e a espessura tanto das paredes externas quanto das divisórias internas.
// Aplicado nas coordenadas locais ANTES da rotação da casa.
const FURNITURE_WALL_GAP = 0.30;
function furnitureBounds(items) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of items) {
    const a = f.rot || 0, cs = Math.cos(a), sn = Math.sin(a);
    const rx = (Math.abs(cs) * f.w + Math.abs(sn) * f.d) / 2;
    const ry = (Math.abs(sn) * f.w + Math.abs(cs) * f.d) / 2;
    x0 = Math.min(x0, f.x - rx); x1 = Math.max(x1, f.x + rx);
    y0 = Math.min(y0, f.y - ry); y1 = Math.max(y1, f.y + ry);
  }
  return { x0, y0, x1, y1 };
}
function furnitureRoomRect(T, items) {
  const gap = FURNITURE_WALL_GAP, r = {
    x0: gap, y0: gap, x1: T.w - gap, y1: T.d - gap,
  };
  const b = furnitureBounds(items), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  for (const wall of T.def.inner || []) {
    // Só particiona salas com parede inteira de ponta a ponta; aberturas
    // continuam disponíveis para o jogador e seus móveis não atravessam o vão.
    if (Math.abs(wall.x1 - wall.x2) < 0.01 && Math.abs(wall.y1 - wall.y2) >= T.d - 0.1) {
      if (cx < wall.x1) r.x1 = Math.min(r.x1, wall.x1 - gap);
      else r.x0 = Math.max(r.x0, wall.x1 + gap);
    } else if (Math.abs(wall.y1 - wall.y2) < 0.01 && Math.abs(wall.x1 - wall.x2) >= T.w - 0.1) {
      if (cy < wall.y1) r.y1 = Math.min(r.y1, wall.y1 - gap);
      else r.y0 = Math.max(r.y0, wall.y1 + gap);
    }
  }
  return r;
}
function layoutFurniture(T) {
  const groups = new Map();
  for (const f of T.furn) {
    // Cama+cobertor, televisão+tela e assento+encosto movem juntos:
    // não separam quando o móvel principal é afastado da parede.
    const key = ['bed', 'blanket'].includes(f.kind) ? 'bed'
      : ['tv', 'screen'].includes(f.kind) ? 'tv'
      : f.kind === 'sofa' ? 'sofa'
      : Symbol(f.kind);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(Object.assign({}, f));
  }
  const out = [];
  for (const items of groups.values()) {
    const b = furnitureBounds(items), r = furnitureRoomRect(T, items);
    // Grupos maiores que uma sala são preservados e sinalizados para revisão;
    // não os comprime nem altera as dimensões reais dos objetos.
    const dx = b.x1 - b.x0 <= r.x1 - r.x0
      ? Math.max(r.x0 - b.x0, Math.min(0, r.x1 - b.x1)) : 0;
    const dy = b.y1 - b.y0 <= r.y1 - r.y0
      ? Math.max(r.y0 - b.y0, Math.min(0, r.y1 - b.y1)) : 0;
    for (const item of items) { item.x += dx; item.y += dy; out.push(item); }
  }
  return out;
}

// instancia um modelo girado k*90° com o canto superior-esquerdo em (x0,y0)
function placeTemplate(T, x0, y0, k, extra = {}) {
  const c = Math.round(Math.cos(k * Math.PI / 2)), s = Math.round(Math.sin(k * Math.PI / 2));
  const W = k % 2 ? T.d : T.w, D = k % 2 ? T.w : T.d, cx = x0 + W / 2, cy = y0 + D / 2;
  const L = (u, v) => [cx + c * (u - T.w / 2) - s * (v - T.d / 2), cy + s * (u - T.w / 2) + c * (v - T.d / 2)];
  const rv = v => [c * v[0] - s * v[1], s * v[0] + c * v[1]];
  const def = Object.assign({}, T.def, extra, { x0, y0, x1: x0 + W, y1: y0 + D, open: {} });
  for (const key in T.def.open) {
    const ls = LOCAL_SIDES[key], wn = rv(ls.n), wd = rv(ls.dir), rev = wd[0] + wd[1] < 0;
    const len = key === 'S' || key === 'N' ? T.w : T.d, o = T.def.open[key], m = {};
    for (const f in o) m[f] = o[f].map(i => rev ? len - 1 - i : i);
    def.open[sideOf(wn)] = m;
  }
  def.inner = (T.def.inner || []).map(w => { const a = L(w.x1, w.y1), b = L(w.x2, w.y2); return { x1: a[0], y1: a[1], x2: b[0], y2: b[1], door: w.door }; });
  def.floors = T.def.floors.map(f => { const a = L(f.x0, f.y0), b = L(f.x1, f.y1); return Object.assign({}, f, { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) }); });
  const H = addHouse(def);
  if(T.upper)initUpperFloor(H,T,L,k);
  const du = T.def.open.S.door[0] + 0.5;
  H.doorPt = L(du, T.d); H.front = L(du, T.d + 2); H.doorN = rv([0, 1]);
  // entrada: varanda com pilares (algumas casas grandes) ou marquise + degrau de concreto
  const rot = k * Math.PI / 2, er = mulberry(H.seed + 11);
  if (T.yard && er() < 0.55) {
    const dk = L(du, T.d + 0.95);
    addBox({ x: dk[0], y: dk[1], w: 3.6, d: 1.9, h: 0.07, rot, top: '#8a6a4a', side: '#5e4632', kind: 'deck', solid: false });
    for (const sx of [-1.65, 1.65]) { const pp = L(du + sx, T.d + 1.75); addBox({ x: pp[0], y: pp[1], w: 0.14, d: 0.14, h: 2.42, rot, top: '#ece6da', side: '#d9d2c4', kind: 'post', house: H, exteriorFixture: true }); }
    const rf = L(du, T.d + 0.95);
    addBox({ x: rf[0], y: rf[1], w: 3.8, d: 2.0, h: 0.12, z: 2.42, rot, top: H.style.roofMat === 'metal' ? '#9aa0a4' : shadeHex(H.style.roofCol, 0.95), side: H.style.trim, kind: 'porchroof', solid: false, house: H, exteriorFixture: true });
    const st = L(du, T.d + 2.1); addBox({ x: st[0], y: st[1], w: 1.3, d: 0.4, h: 0.12, rot, top: '#b9b4aa', side: '#958f84', kind: 'step', solid: false });
  } else if (!H.brick) {
    const st = L(du, T.d + 0.35); addBox({ x: st[0], y: st[1], w: 1.4, d: 0.6, h: 0.14, rot, top: '#bcb7ad', side: '#958f84', kind: 'step', solid: false });
    if (er() < 0.7) { const cp = L(du, T.d + 0.45); addBox({ x: cp[0], y: cp[1], w: 1.7, d: 0.9, h: 0.08, z: 2.34, rot, top: '#cfcac0', side: '#a19b90', kind: 'canopy', solid: false, house: H, exteriorFixture: true }); }
  }
  for (const f of layoutFurniture(T)) { const p = L(f.x, f.y); addBox(Object.assign({}, f, { x: p[0], y: p[1], rot: (f.rot || 0) + k * Math.PI / 2, house: H })); }
  if (T.yard) {   // quintal cercado com portão na frente e passagem nos fundos
    const a = L(-2, -2.5), b = L(T.w + 2, T.d + 3);
    const r = [Math.round(Math.min(a[0], b[0])), Math.round(Math.min(a[1], b[1])), Math.round(Math.max(a[0], b[0])), Math.round(Math.max(a[1], b[1]))];
    world.yards.push(r);
    const gate = L(du, T.d + 3), back = L(T.w / 2, -2.5);
    const gap = (x, y) => Math.hypot(x - gate[0], y - gate[1]) < 1.3 || Math.hypot(x - back[0], y - back[1]) < 1.6;
    fenceLine(r[0], r[1], r[2], r[1], gap); fenceLine(r[0], r[3], r[2], r[3], gap);
    fenceLine(r[0], r[1], r[0], r[3], gap); fenceLine(r[2], r[1], r[2], r[3], gap);
    const mb = L(du - 1.6, T.d + 3.5), bin = L(du + 1.8, T.d + 2.4);
    addBox({ x: mb[0], y: mb[1], w: 0.25, d: 0.25, h: 1.1, top: '#5a3c26', side: '#5a3c26', kind: 'post' });
    addBox({ x: mb[0], y: mb[1], w: 0.5, d: 0.3, h: 0.3, z: 1.1, rot: k * Math.PI / 2, top: '#3a5b8c', side: '#2e4a73', kind: 'mailbox', solid: false });
    addBox({ x: bin[0], y: bin[1], w: 0.6, d: 0.6, h: 1.0, top: '#2f5a37', side: '#244a2c', kind: 'bin' });
  }
  return H;
}

// carros
function addCar(x, y, rot, col) {
  addBox({ x, y, rot, w: 4.3, d: 1.85, h: 0.65, z: 0.3, top: col, side: col, kind: 'car' });
  const c = Math.cos(rot), s = Math.sin(rot);
  addBox({ x: x - c * 0.25, y: y - s * 0.25, rot, w: 2.1, d: 1.6, h: 0.5, z: 0.95, top: col, side: '#2b3a4a', kind: 'cabin', solid: false });
  for (const [u, v] of [[-1.35, -0.85], [1.35, -0.85], [-1.35, 0.85], [1.35, 0.85]])
    addBox({ x: x + u * c - v * s, y: y + u * s + v * c, rot, w: 0.7, d: 0.25, h: 0.62, top: '#1d1d20', side: '#1d1d20', kind: 'wheel', solid: false });
}

// cerca de madeira em pedaços de 1 m; gap(x,y) abre portões
const fences = [];
function fenceLine(x1, y1, x2, y2, gap = () => false) {
  const len = Math.round(Math.hypot(x2 - x1, y2 - y1)), dx = (x2 - x1) / len, dy = (y2 - y1) / len;
  for (let i = 0; i < len; i++) {
    const s = { x1: x1 + dx * i, y1: y1 + dy * i, x2: x1 + dx * (i + 1), y2: y1 + dy * (i + 1), nx: -dy, ny: dx, h: 0.95, kind: 'fence' };
    if (gap((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2) || onRoad((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2)) continue;
    fences.push(s); world.segs.push(s);
  }
}

// ---------- loteamento: casas de frente p/ a rua, ao longo das curvas ----------
function buildHouses() {
  const J = world.junction, cands = [];
  for (const r of world.roads) for (let i = 16; i < r.pts.length - 16; i += 5) for (const s of [1, -1]) cands.push({ p: r.pts[i], s, r: rng() });
  cands.sort((a, b) => a.r - b.r);
  const rects = [];
  const tryPlace = (key, c) => {
    const T = TPL[key], p = c.p, o = [p.nx * c.s, p.ny * c.s];
    // porta virada p/ a rua: escolhe a rotação cujo "sul" aponta contra o vetor de afastamento
    let k = 0, best = -9;
    for (let q = 0; q < 4; q++) { const dn = [-Math.round(Math.sin(q * Math.PI / 2)), Math.round(Math.cos(q * Math.PI / 2))], d = -(dn[0] * o[0] + dn[1] * o[1]); if (d > best) { best = d; k = q; } }
    const W = k % 2 ? T.d : T.w, D = k % 2 ? T.w : T.d, depth = k % 2 ? W : D;
    const dist = ROAD_W + SIDE + T.setback + depth / 2;
    const x0 = Math.round(p.x + o[0] * dist - W / 2), y0 = Math.round(p.y + o[1] * dist - D / 2);
    const m = T.yard ? 3.2 : 1;
    const box = [x0 - m, y0 - m, x0 + W + m, y0 + D + m];
    if (box[0] < 1 || box[1] < 1 || box[2] > MAP - 1 || box[3] > MAP - 1) return null;
    for (let y = box[1]; y <= box[3]; y += 1) for (let x = box[0]; x <= box[2]; x += 1) {
      const inHouse = x >= x0 - 0.5 && x <= x0 + W + 0.5 && y >= y0 - 0.5 && y <= y0 + D + 0.5;
      if (roadDist(x, y) < ROAD_W + SIDE + (inHouse ? 0.6 : 0.1) || pondVal(x, y) < 1.4) return null;
    }
    if (rects.some(b => box[0] < b[2] + 2 && box[2] > b[0] - 2 && box[1] < b[3] + 2 && box[3] > b[1] - 2)) return null;
    if (Math.hypot(x0 + W / 2 - J.x, y0 + D / 2 - J.y) < 8) return null;
    rects.push(box);
    const pal = SIDINGS[(rng() * SIDINGS.length) | 0];
    const rr = rng(), roofKind = key === 'SHOP' ? 'flat' :
      key === 'C' ? (rr<.55?'hip':'gable') :
      key === 'D' ? (rr<.62?'gable':'flat') :
      key === 'A' ? (rr < 0.5 ? 'gable' : 'hip') :
      (rr < 0.3 ? 'flat' : rr < 0.65 ? 'hip' : 'gable');
    return placeTemplate(T, x0, y0, k, key === 'SHOP' ? {} : { ext: pal[0], roof: pal[1], roofKind });
  };
  // mercado perto do cruzamento, depois as casas
  const nearJ = cands.filter(c => { const d = Math.hypot(c.p.x - J.x, c.p.y - J.y); return d > 9 && d < 26; });
  for (const c of nearJ) if (tryPlace('SHOP', c)) break;
  if (!houses.length) for (const c of cands) if (tryPlace('SHOP', c)) break;
  // Em 160×160, distribuir pontos de comércio também longe do cruzamento.
  // Não concentrar todos os mercados em uma região do mundo aumentado.
  const commercial = [MAP*.24, MAP*.78];
  for (const targetX of commercial) {
    const sorted = cands.filter(c => Math.abs(c.p.x-targetX)<MAP*.18)
      .sort((a,b)=>Math.abs(a.p.x-targetX)-Math.abs(b.p.x-targetX));
    for(const c of sorted)if(tryPlace('SHOP',c))break;
  }
  // Expandir também os bairros: 21 casas + até 3 mercados (antes 7 + 1).
  // Dois modelos de sobrado, intercalados aos terreiros existentes.
  // Mantemos o total de 21 lotes e os mercados da versao anterior.
  const want = Array.from({length:3},()=>
    ['A','C','B','D','B','C','A']).flat();
  for (const key of want) for (const c of cands) if (tryPlace(key, c)) break;
  // caminhos de concreto da porta até a calçada
  for (const H of houses) {
    let t = 0.2; while (t < 12 && roadDist(H.doorPt[0] + H.doorN[0] * t, H.doorPt[1] + H.doorN[1] * t) > ROAD_W + SIDE - 0.2) t += 0.25;
    H.walk = [H.doorPt, [H.doorPt[0] + H.doorN[0] * t, H.doorPt[1] + H.doorN[1] * t]];
  }
  // carros estacionados junto ao meio-fio
  const cols = ['#b03a32', '#dedbd3', '#2f5d7c', '#3d3f45', '#c9a13a', '#4d6b3a'], cars = [];
  for (let i = 0; i < 900 && cars.length < 12; i++) {
    const r = world.roads[(rng() * world.roads.length) | 0], j = 8 + ((rng() * (r.pts.length - 16)) | 0), p = r.pts[j], s = rng() < 0.5 ? 1 : -1;
    const x = p.x + p.nx * s * (ROAD_W - 1.3), y = p.y + p.ny * s * (ROAD_W - 1.3);
    if (x < 3 || y < 3 || x > MAP - 3 || y > MAP - 3 || Math.hypot(x - J.x, y - J.y) < 12 || cars.some(c => Math.hypot(c[0] - x, c[1] - y) < 8)) continue;
    cars.push([x, y]); addCar(x, y, Math.atan2(p.ty, p.tx) + (s > 0 ? 0 : Math.PI), cols[cars.length % cols.length]);
  }
}
world.buildHouses = buildHouses;

world.blocked = (x, y, r) => {
  for (const H of houses) if (x > H.x0 - r - 1.5 && x < H.x1 + r + 1.5 && y > H.y0 - r - 1.5 && y < H.y1 + r + 1.5) return true;
  for (const Y of world.yards) if (x > Y[0] - r && x < Y[2] + r && y > Y[1] - r && y < Y[3] + r) return true;
  for (const b of boxes) if (Math.hypot(b.x - x, b.y - y) < Math.max(b.w, b.d) / 2 + r + 0.6) return true;
  return false;
};

// pisos + caminhos + sombras das casas, pintados uma vez no chão
world.paintFloors = (g, M, rect) => {
  g.lineCap = 'butt';
  for (const H of houses) if (H.walk) {
    g.strokeStyle = '#b6b0a2'; g.lineWidth = M(1.1); g.beginPath(); g.moveTo(M(H.walk[0][0]), M(H.walk[0][1])); g.lineTo(M(H.walk[1][0]), M(H.walk[1][1])); g.stroke();
    g.strokeStyle = '#9d978a'; g.lineWidth = 1;
    const n = Math.hypot(H.walk[1][0] - H.walk[0][0], H.walk[1][1] - H.walk[0][1]);
    for (let t = 0.6; t < n; t += 0.6) { const x = H.walk[0][0] + H.doorN[0] * t, y = H.walk[0][1] + H.doorN[1] * t; g.beginPath(); g.moveTo(M(x - H.doorN[1] * 0.55), M(y + H.doorN[0] * 0.55)); g.lineTo(M(x + H.doorN[1] * 0.55), M(y - H.doorN[0] * 0.55)); g.stroke(); }
  }
  for (const H of houses) {
    // sombra projetada (na direção oposta ao sol)
    const k = (H.h + (H.roofKind === 'gable' ? 1.2 : 0)) * 0.55, ox = -SUN[0] * k, oy = -SUN[1] * k;
    g.fillStyle = 'rgba(20,26,12,0.34)';
    g.beginPath(); g.moveTo(M(H.x0), M(H.y0)); g.lineTo(M(H.x1), M(H.y0)); g.lineTo(M(H.x1 + ox), M(H.y0 + oy));
    g.lineTo(M(H.x1 + ox), M(H.y1 + oy)); g.lineTo(M(H.x0 + ox), M(H.y1 + oy)); g.lineTo(M(H.x0), M(H.y1)); g.fill();
    for (const f of H.floors) {
      if (f.kind === 'wood') {
        const base = f.col || '#9b6a3d';
        rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0, base);
        for (let y = f.y0; y < f.y1; y += 0.25) {
          g.fillStyle = mix(base, '#000000', 0.25); g.fillRect(M(f.x0), M(y), M(f.x1 - f.x0), 1);
          for (let x = f.x0 + ((y * 4) % 2) * 0.6; x < f.x1; x += 1.2) g.fillRect(M(x), M(y), 1, M(0.25));
          g.fillStyle = mix(base, '#ffffff', 0.1); g.fillRect(M(f.x0), M(y) + 2, M(f.x1 - f.x0), 1);
        }
      } else if (f.kind === 'tile') {
        rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0, f.col);
        for (let x = f.x0; x < f.x1; x += 0.5) for (let y = f.y0; y < f.y1; y += 0.5)
          if (Math.round((x + y) * 2) % 2 === 0) rect(x, y, 0.5, 0.5, mix(f.col, '#7d8a96', 0.25));
      } else {
        rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0, f.col);
        for (let i = 0; i < 900; i++) { g.fillStyle = mix(f.col, i % 2 ? '#000000' : '#ffffff', 0.12); g.fillRect(M(R(f.x0, f.x1)), M(R(f.y0, f.y1)), 2, 2); }
      }
    }
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.fillRect(M(H.x0), M(H.y0), M(H.x1 - H.x0), 4); g.fillRect(M(H.x0), M(H.y0), 4, M(H.y1 - H.y0));
  }
  for (const b of boxes) if (b.kind === 'car') {
    g.save(); g.translate(M(b.x - SUN[0] * 0.5), M(b.y - SUN[1] * 0.5)); g.rotate(b.rot);
    g.fillStyle = 'rgba(20,20,20,.35)'; g.beginPath(); g.ellipse(0, 0, M(b.w * 0.55), M(b.d * 0.6), 0, 0, TAU); g.fill(); g.restore();
  }
  for (const s of fences) {
    g.fillStyle = 'rgba(20,26,12,0.25)';
    g.fillRect(M(Math.min(s.x1, s.x2) - SUN[0] * 0.4) - 2, M(Math.min(s.y1, s.y2) - SUN[1] * 0.4) - 2, M(Math.abs(s.x2 - s.x1)) + 4, M(Math.abs(s.y2 - s.y1)) + 4);
  }
};

// ---------- desenho ----------
function wallQuad(s, z0, z1, u0 = 0, u1 = 1) {
  const ax = lerp(s.x1, s.x2, u0), ay = lerp(s.y1, s.y2, u0), bx = lerp(s.x1, s.x2, u1), by = lerp(s.y1, s.y2, u1);
  return [proj(ax, ay, z0), proj(bx, by, z0), proj(bx, by, z1), proj(ax, ay, z1)];
}

// mapeamento de um pedaço de parede na textura do seu lado da casa
function wallMap(s) {
  const H = s.house;
  if (s.ext) { const sd = H.sides[s.side]; return { a: sd.a, dir: sd.dir, Hc: sd.Hc, idx: s.idx }; }
  const l = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  return { a: [s.x1, s.y1], dir: [(s.x2 - s.x1) / l, (s.y2 - s.y1) / l], Hc: H.storeys ? H.floorHeight : H.h, idx: 0 };
}
function drawWallSlice(g, s, z0, z1, u0, u1, forceExt) {
  if (z1 <= z0) return;
  const H = s.house, T = houseTex(H), f = facingCam(s.nx, s.ny);
  const outside = forceExt || (s.ext && f > 0);
  const tex = s.ext ? (outside ? T.ext[s.side] : T.int[s.side]) : T.part;
  const m = wallMap(s), O = proj(m.a[0], m.a[1], 0), A = proj(m.a[0] + m.dir[0], m.a[1] + m.dir[1], 0), Zp = proj(m.a[0], m.a[1], 1);
  const zx = Zp.x - O.x, zy = Zp.y - O.y;
  let sx = (m.idx + u0) * TEX - 0.7, sw = (u1 - u0) * TEX + 1.4;
  if (sx < 0) { sw += sx; sx = 0; }
  if (sx + sw > tex.width) sw = tex.width - sx;
  const sy = (m.Hc - z1) * TEX, sh = (z1 - z0) * TEX;
  g.save(); g.imageSmoothingEnabled = true;
  g.transform((A.x - O.x) / TEX, (A.y - O.y) / TEX, -zx / TEX, -zy / TEX, O.x + zx * m.Hc, O.y + zy * m.Hc);
  g.drawImage(tex, sx, sy, sw, sh, sx, sy, sw, sh);
  g.restore();
}

// porta aberta: soleira, espessura do vão (reboco) e folha girada p/ dentro, em 3D
function drawDoorway(g, s, zt) {
  const H = s.house, T = houseTex(H), t = 0.15, l = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  const dx = (s.x2 - s.x1) / l, dy = (s.y2 - s.y1) / l, ix = -s.nx, iy = -s.ny;
  const pt = (u, d, z) => proj(s.x1 + dx * u + ix * d, s.y1 + dy * u + iy * d, z);
  poly(g, [pt(0.1, -0.08, 0.02), pt(0.9, -0.08, 0.02), pt(0.9, t, 0.02), pt(0.1, t, 0.02)], '#b9b3a6', 'rgba(30,24,20,0.5)', 1);
  for (const u of [0.1, 0.9]) poly(g, [pt(u, 0, 0), pt(u, t, 0), pt(u, t, zt), pt(u, 0, zt)], tone(H.style.plaster, -0.2), null);
  if (zt > 0.2) {
    // A folha passa de fechada (0 rad) a aberta para dentro (~75 graus).
    const a = 1.30 * (s.doorAnim ? s.doorAnim.open : 1);
    const ox = dx * Math.cos(a) + ix * Math.sin(a), oy = dy * Math.cos(a) + iy * Math.sin(a);
    const hx = s.x1 + dx * 0.1 + ix * t, hy = s.y1 + dy * 0.1 + iy * t, zz = Math.min(2.05, zt);
    const q = [proj(hx, hy, 0), proj(hx + ox * 0.82, hy + oy * 0.82, 0), proj(hx + ox * 0.82, hy + oy * 0.82, zz), proj(hx, hy, zz)];
    texPlane(g, s.ext ? T.door : T.innerDoor, [hx, hy, 2.05], [ox, oy, 0], [0, 0, -1], TEX, q);
    const nn = [-oy, ox, 0];
    shadeOverlay(g, q, facingCam(nn[0], nn[1]) > 0 ? nn : V.mul(nn, -1), 0.8);
    g.strokeStyle = 'rgba(25,18,14,0.7)'; g.lineWidth = 1;
    g.beginPath(); q.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.stroke();
  }
}

// Venezianas de vidro: abertura de duas folhas em eixo 3D, sem sprites externos.
// A moldura fechada permanece na textura cacheada; a abertura animada é
// desenhada por cima somente nas janelas cujo angulo mudou.
function drawWindowLeaves(g, s, exterior) {
  const t = s.windowAnim ? s.windowAnim.open : 0;
  if (t < 0.015) return;
  const big = s.house.brick && s.ext && s.side === s.house.frontSide;
  const u0 = big ? 0.06 : 0.15, u1 = big ? 0.94 : 0.85;
  const z0 = big ? 0.55 : 0.95, z1 = big ? 2.35 : 2.05;
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const nx = exterior ? s.nx : -s.nx, ny = exterior ? s.ny : -s.ny;
  const point = (u, z, d = 0) => proj(s.x1 + dx * u + nx * d, s.y1 + dy * u + ny * d, z);
  // Caixa escura no vão: evita que o vidro fechado cacheado continue aparente.
  const left = u0 + 0.055, right = u1 - 0.055;
  const low = z0 + 0.055, high = z1 - 0.055;
  const hole = [point(left, low, 0.022), point(right, low, 0.022),
    point(right, high, 0.022), point(left, high, 0.022)];
  poly(g, hole, 'rgba(24,36,43,0.93)', null);
  // Cada folha gira a partir do respectivo batente, sempre para fora.
  const a = t * 1.15, half = (right - left) / 2, outward = half * Math.sin(a);
  for (const side of [-1, 1]) {
    const hinge = side < 0 ? left : right, dir = -side;
    const end = hinge + dir * half * Math.cos(a);
    const corners = [point(hinge, low, 0.045), point(end, low, 0.045 + outward),
      point(end, high, 0.045 + outward), point(hinge, high, 0.045)];
    poly(g, corners, 'rgba(121,165,187,0.80)', '#d8d2c4', Math.max(1.2, cam.zoom * 0.026));
    const m0 = point(hinge + dir * half * 0.52 * Math.cos(a), low, 0.045 + outward * 0.52);
    const m1 = point(hinge + dir * half * 0.52 * Math.cos(a), high, 0.045 + outward * 0.52);
    g.strokeStyle = 'rgba(244,242,231,0.52)'; g.lineWidth = Math.max(1, cam.zoom * 0.012);
    g.beginPath(); g.moveTo(m0.x, m0.y); g.lineTo(m1.x, m1.y); g.stroke();
  }
}

// Porta abre ao aproximar-se o jogador ou um NPC; janelas mudam devagar,
// de forma deterministica para cada casa, e fecham preferencialmente a noite.
function updateHouseOpenings(dt, residents, night) {
  for (const H of houses) for (const s of H.segs) {
    if (s.doorAnim) {
      const mx = (s.x1 + s.x2) * 0.5, my = (s.y1 + s.y2) * 0.5;
      s.doorAnim.target = residents.some(a => Math.hypot(a.x - mx, a.y - my) < 1.55) ? 1 : 0;
      s.doorAnim.open += (s.doorAnim.target - s.doorAnim.open) * (1 - Math.exp(-dt * 5));
      if (Math.abs(s.doorAnim.target - s.doorAnim.open) < 0.005) s.doorAnim.open = s.doorAnim.target;
    }
    if (s.windowAnim) {
      const w = s.windowAnim;
      w.timer -= dt;
      if (w.timer <= 0) {
        w.timer = 18 + w.rand() * 35;
        w.target = night ? 0 : (w.rand() < 0.36 ? 0.35 + w.rand() * 0.65 : 0);
      }
      if (night) w.target = 0;
      w.open += (w.target - w.open) * (1 - Math.exp(-dt * 1.65));
      if (Math.abs(w.target - w.open) < 0.004) w.open = w.target;
    }
  }
}

function drawWall(g, s) {
  const H = s.house, f = facingCam(s.nx, s.ny);
  const outside = s.ext && f > 0;
  const cut = (H.inside || H.fade) && (f > 0 || !s.ext);
  const h = cut ? 0.5 : s.h;
  if (s.door) {
    drawWallSlice(g, s, 0, h, 0, 0.1); drawWallSlice(g, s, 0, h, 0.9, 1);
    if (h > 2.12) drawWallSlice(g, s, 2.12, h, 0.1, 0.9);
    // No corte interno, a folha não deve reaparecer como um bloco de 50 cm de altura.
    if (!cut) drawDoorway(g, s, Math.min(h, 2.12));
  } else {
    drawWallSlice(g, s, 0, h, 0, 1);
    if (s.window && h > 1.6 && world.night) {
      const big = H.brick && s.ext && s.side === H.frontSide;
      const q = wallQuad(s, big ? 0.66 : 1.04, big ? 2.24 : 1.97, big ? 0.13 : 0.23, big ? 0.87 : 0.77);
      poly(g, q, outside ? 'rgba(255,196,110,0.82)' : 'rgba(14,20,42,0.6)', null);
    }
    if (s.window) drawWindowLeaves(g, s, outside);
  }
  // espessura da parede vista de cima + arestas discretas
  const t = 0.14, a = proj(s.x1, s.y1, h), b = proj(s.x2, s.y2, h);
  const a2 = proj(s.x1 - s.nx * t, s.y1 - s.ny * t, h), b2 = proj(s.x2 - s.nx * t, s.y2 - s.ny * t, h);
  poly(g, [a, b, b2, a2], cut ? '#2f2a27' : '#45403b', null);
  g.strokeStyle = 'rgba(22,16,12,0.75)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  const q = wallQuad(s, 0, h);
  if (!s.door) { g.strokeStyle = 'rgba(22,16,12,0.45)'; g.beginPath(); g.moveTo(q[0].x, q[0].y); g.lineTo(q[1].x, q[1].y); g.stroke(); }
  g.strokeStyle = 'rgba(22,16,12,0.8)';
  if (s.c0) { g.beginPath(); g.moveTo(q[0].x, q[0].y); g.lineTo(q[3].x, q[3].y); g.stroke(); }
  if (s.c1) { g.beginPath(); g.moveTo(q[1].x, q[1].y); g.lineTo(q[2].x, q[2].y); g.stroke(); }
}
const lerp2 = (p, q, t) => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });

function drawSign(g, segs) {
  // texto sempre lido da esquerda p/ direita de quem olha a fachada
  const s = segs[0], dx = s.ny, dy = -s.nx, along = (s.x2 - s.x1) * dx + (s.y2 - s.y1) * dy > 0;
  const e = segs[segs.length - 1], sx = along ? s.x1 : e.x2, sy = along ? s.y1 : e.y2, len = segs.length;
  const o = proj(sx, sy, 3.05), ux = proj(sx + dx, sy + dy, 3.05), vz = proj(sx, sy, 2.05);
  g.save(); g.transform(ux.x - o.x, ux.y - o.y, vz.x - o.x, vz.y - o.y, o.x, o.y);
  g.scale(0.01, 0.01);   // fontes < 1px não renderizam: desenha em centésimos de metro
  g.fillStyle = INK; g.fillRect(-5, -5, len * 100 + 10, 75);
  g.fillStyle = '#c23a2e'; g.fillRect(0, 0, len * 100, 65);
  g.fillStyle = '#9a2a20'; g.fillRect(0, 50, len * 100, 15);
  g.fillStyle = '#fff3d6'; g.font = 'bold 50px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('MERCADO', len * 50, 32);
  g.restore();
}

function behindHouse(H, px, py) {
  const cs = [[H.x0, H.y0], [H.x1, H.y0], [H.x1, H.y1], [H.x0, H.y1]], pd = depthOf(px, py);
  if (pd > Math.max(...cs.map(c => depthOf(c[0], c[1])))) return false;
  const pp = proj(px, py, 1), sp = cs.flatMap(c => [proj(c[0], c[1], 0), proj(c[0], c[1], H.h + 1.8)]);
  const xs = sp.map(q => q.x), ys = sp.map(q => q.y);
  return pp.x > Math.min(...xs) - 6 && pp.x < Math.max(...xs) + 6 && pp.y > Math.min(...ys) && pp.y < Math.max(...ys);
}
function drawBox(g, b) {
  const c = boxCorners(b), z0 = b.z, z1 = b.z + b.h;
  const faces = [];
  for (let i = 0; i < 4; i++) {
    const p = c[i], q = c[(i + 1) % 4];
    const nx = q[1] - p[1], ny = -(q[0] - p[0]);
    if (facingCam(nx, ny) <= 0) continue;
    faces.push({ pts: [proj(p[0], p[1], z0), proj(q[0], q[1], z0), proj(q[0], q[1], z1), proj(p[0], p[1], z1)], lit: shadeOf(nx, ny), d: depthOf((p[0] + q[0]) / 2, (p[1] + q[1]) / 2), i });
  }
  faces.sort((a, b) => a.d - b.d);
  for (const f of faces) {
    poly(g, f.pts, tone(b.side, f.lit), 'rgba(24,18,14,0.75)', 1);
    if (b.kind === 'car') {   // faróis e lanternas nas pontas
      const end = (f.i === 1 || f.i === 3);
      if (end) { const L = lerp2(lerp2(f.pts[0], f.pts[3], 0.6), lerp2(f.pts[1], f.pts[2], 0.6), 0.15), Rr = lerp2(lerp2(f.pts[0], f.pts[3], 0.6), lerp2(f.pts[1], f.pts[2], 0.6), 0.85); g.fillStyle = f.i === 1 ? '#f4eecb' : '#d33b2c'; for (const p of [L, Rr]) g.fillRect(p.x - 2, p.y - 1, 4, 3); }
    }
    if (b.kind === 'fridge') {   // portas e puxador
      const m0 = lerp2(f.pts[0], f.pts[3], 0.62), m1 = lerp2(f.pts[1], f.pts[2], 0.62);
      g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(m0.x, m0.y); g.lineTo(m1.x, m1.y); g.stroke();
      const h0 = lerp2(lerp2(f.pts[0], f.pts[3], 0.5), lerp2(f.pts[1], f.pts[2], 0.5), 0.85), h1 = lerp2(lerp2(f.pts[0], f.pts[3], 0.75), lerp2(f.pts[1], f.pts[2], 0.75), 0.85);
      g.strokeStyle = '#8c8c94'; g.lineWidth = 2; g.beginPath(); g.moveTo(h0.x, h0.y); g.lineTo(h1.x, h1.y); g.stroke();
    }
    if (b.kind === 'screen') { g.fillStyle = 'rgba(140,170,210,.35)'; poly(g, [lerp2(f.pts[0], f.pts[3], 0.3), lerp2(f.pts[0], f.pts[3], 0.9), lerp2(f.pts[1], f.pts[2], 0.5)], 'rgba(140,170,210,.3)', null); }
    if (b.kind === 'sofa' && b.h < 0.6) for (const u of [0.33, 0.66]) { const a = lerp2(f.pts[0], f.pts[1], u), c = lerp2(f.pts[3], f.pts[2], u); g.strokeStyle = mix(b.side, '#000000', 0.35); g.lineWidth = 1; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.stroke(); }
    if (b.kind === 'shelf' && b.top !== '#6b4a30') {   // produtos na prateleira
      for (let k = 0; k < 3; k++) for (let j = 0; j < 6; j++) {
        const p = lerp2(lerp2(f.pts[0], f.pts[3], 0.2 + k * 0.28), lerp2(f.pts[1], f.pts[2], 0.2 + k * 0.28), 0.08 + j * 0.15);
        g.fillStyle = ['#d0473b', '#f2c94c', '#4f8fd1', '#6cbf6a', '#f1ede2'][(j + k * 2) % 5]; g.fillRect(p.x, p.y - 3, 3, 4);
      }
    }
  }
  poly(g, [proj(c[0][0], c[0][1], z1), proj(c[1][0], c[1][1], z1), proj(c[2][0], c[2][1], z1), proj(c[3][0], c[3][1], z1)], tone(b.top, 0.6), 'rgba(24,18,14,0.75)', 1);
  if (b.kind === 'bed') {
    // Travesseiro deslocado no eixo LOCAL da cama (não no eixo Y global).
    const dy = -b.d * 0.36, a = b.rot || 0;
    const q = { x: b.x - Math.sin(a) * dy, y: b.y + Math.cos(a) * dy,
      z: z1, w: b.w * 0.75, d: b.d * 0.16, h: 0.1, rot: a,
      top: '#fbf8f0', side: '#d9d3c6' };
    drawBox(g, q);
  }
}

function drawFence(g, s) {
  const lit = shadeOf(facingCam(s.nx, s.ny) > 0 ? s.nx : -s.nx, facingCam(s.nx, s.ny) > 0 ? s.ny : -s.ny);
  const col = tone('#e9e3d3', lit), w = Math.max(1.5, cam.zoom * 0.07);
  for (const z of [0.3, 0.7]) { const q = wallQuad(s, z, z); g.strokeStyle = INK; g.lineWidth = w; g.beginPath(); g.moveTo(q[0].x, q[0].y); g.lineTo(q[1].x, q[1].y); g.stroke(); g.strokeStyle = mix(col, '#000000', 0.15); g.lineWidth = w - 1; g.stroke(); }
  for (let k = 0; k < 4; k++) {
    const u = (k + 0.5) / 4, a = proj(lerp(s.x1, s.x2, u), lerp(s.y1, s.y2, u), 0), b = proj(lerp(s.x1, s.x2, u), lerp(s.y1, s.y2, u), s.h);
    poly(g, [[a.x - w, a.y], [a.x + w, a.y], [b.x + w, b.y + w], [b.x, b.y - w * 0.6], [b.x - w, b.y + w]], col, INK, 1);
  }
}

// ---------- coleta de desenháveis p/ o quadro ----------
function houseDrawables(list, px, py) {
  // Culling das casas fora da câmera: sem isso, triplicar as construções
  // aumenta drasticamente os draw calls em todos os quadros.
  const visibleHouse = H => {
    const center = proj((H.x0+H.x1)*.5,(H.y0+H.y1)*.5,0);
    const margin = (Math.hypot(H.x1-H.x0,H.y1-H.y0)*.85+4)*cam.zoom;
    return center.x >= -margin && center.x <= cam.W+margin &&
      center.y >= -margin && center.y <= cam.H+margin;
  };
  for (const H of houses) {
    if (!visibleHouse(H)) {
      H.inside = false; H.fade = false;
      continue;
    }
    H.inside = px > H.x0 && px < H.x1 && py > H.y0 && py < H.y1;
    H.fade = !H.inside && behindHouse(H, px, py);
    let maxD = -1e9;
    const showIn = H.inside || H.fade;
    const upstairs = H.upper && H.inside &&
      typeof player!=='undefined' && (player.floor===1||player.stairTravel&&player.stairTravel.to===1);
    for (const s of H.segs) {
      if (!s.ext && !showIn) continue;   // divisória escondida pelas paredes externas
      const d = depthOf((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2);
      maxD = Math.max(maxD, d);
      list.push({ d: d + (s.ext ? 0 : -0.02), draw: g => drawWall(g, s) });
    }
    const sg = H.segs.filter(s => s.sign);
    if (sg.length) list.push({ d: Math.max(...sg.map(s => depthOf((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2))) + 0.01,
      draw: g => { if (!H.inside && facingCam(sg[0].nx, sg[0].ny) > 0) drawSign(g, sg); } });
    // Cobertura em fade entra DEPOIS dos móveis e divisórias da casa,
    // inclusive os próximos às quinas, sem promover o telhado de outras casas.
    const roofDepth = H.fade
      ? Math.max(...[[H.x0, H.y0], [H.x1, H.y0], [H.x0, H.y1], [H.x1, H.y1]]
        .map(p => depthOf(p[0], p[1]))) + 0.75
      : maxD + 0.5;
    list.push({ d: roofDepth, draw: g => drawRoof(g, H), roof: H });
    if(H.upper&&H.inside&&!upstairs)list.push({
      d:roofDepth+.14,draw:g=>drawHouseStaircase(g,H)
    });
    if(upstairs)list.push({
      d:roofDepth+.25,draw:g=>drawHouseUpper(g,H),upper:H
    });
  }
  for (const b of boxes) {
    const at=proj(b.x,b.y,0),extra=cam.zoom*(Math.max(b.w,b.d,b.h||0)+3);
    if(at.x < -extra || at.x > cam.W+extra ||
       at.y < -extra || at.y > cam.H+extra) continue;
    if (b.exteriorFixture && b.house && (b.house.inside || b.house.fade)) continue;
    if (b.floor===1)continue; // renders with the upper-floor layer only
    if (b.house && !b.exteriorFixture && !(b.house.inside || b.house.fade)) continue;
    const bias = ['cabin', 'blanket', 'screen', 'mailbox'].includes(b.kind) ? 0.01 : ['canopy', 'porchroof'].includes(b.kind) ? 0.6 : 0;
    list.push({ d: depthOf(b.x, b.y) + bias, draw: g => drawBox(g, b) });
  }
  for (const s of fences) list.push({ d: depthOf((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2), draw: g => drawFence(g, s) });
}
