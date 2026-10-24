// miami-city.js — ocupação "Miami" dos setores do mundo grande.
// Cada bairro tem seu tipo de construção e seus detalhes:
//   centro (Brickell): torres de escritório, condomínios de vidro e hotéis; palmeiras imperiais nas avenidas
//   orla leste (South Beach): hotéis art déco pastel e condomínios; praia com postos de salva-vidas e guarda-sóis
//   orla oeste: mansões brancas de telhado de barro, gramado listrado, piscina, cerca viva, entrada de carro
//   bairros: bangalôs pastel e lojinhas de esquina; favelas: casas pobres, grades, alambrado enferrujado, terra
//   conjunto: blocos habitacionais e quadra de basquete com alambrado; indústria/porto: galpões
// Marcas no chão (piscinas, faixas de pedestre, gramados, estacionamentos...) são "decalques" pintados
// nos blocos do terreno; prédios usam as fachadas de miami-facades.js.
'use strict';

const MIA_W = { brickell: ['office', 'office', 'office', 'condo', 'condo', 'condo', 'deco'], southbeach: ['deco', 'deco', 'deco', 'deco', 'condo', 'condo', 'shop'],
  mansion: ['mansion'], bungalow: ['bungalow', 'bungalow', 'bungalow', 'bungalow', 'bungalow', 'bungalow', 'shop'], town: ['bungalow', 'bungalow', 'bungalow', 'bungalow', 'shop'],
  poor: ['poor'], projects: ['projects', 'projects', 'poor'], works: ['warehouse'] };
const MIA_SPEC = {   // frente, fundo (m, pares), andares, recuo, px/m da fachada
  deco: r => ({ w: 14 + 2 * ((r() * 4) | 0), d: 12 + 2 * ((r() * 2) | 0), n: 3 + ((r() * 2) | 0), set: 2, ppm: 30 }),
  condo: r => ({ w: 18 + 2 * ((r() * 3) | 0), d: 14 + 2 * ((r() * 2) | 0), n: 7 + ((r() * 4) | 0), set: 3, ppm: 22 }),
  office: r => ({ w: 18 + 2 * ((r() * 4) | 0), d: 18 + 2 * ((r() * 3) | 0), n: 8 + ((r() * 4) | 0), set: 3, ppm: 22 }),
  projects: r => ({ w: 22 + 2 * ((r() * 3) | 0), d: 10, n: 3, set: 5, ppm: 28 }),
  warehouse: r => ({ w: 22 + 2 * ((r() * 4) | 0), d: 16 + 2 * ((r() * 3) | 0), n: 1, set: 6, ppm: 24, h: 7 }),
  shop: r => ({ w: 10 + 2 * ((r() * 3) | 0), d: 10, n: 1 + ((r() * 2) | 0), set: 0.6, ppm: 32 }),
};
const MIA_BUNGALOW = [['#f6d49a', '#c66b45'], ['#bfe8d4', '#6b6e72'], ['#fbf4e4', '#b5573c'], ['#f3bcd6', '#8a8f94'], ['#aee0f0', '#d9d6cf'], ['#fae29a', '#a65a3e'],
  ['#c9ecc0', '#c4683f'], ['#f9c2a8', '#7d8186'], ['#d9c8f0', '#b5573c']];
const MIA_POOR = [['#a89c78', '#7b7f80'], ['#8fa092', '#80786c'], ['#b0916e', '#6d7174'], ['#8a9aa2', '#8a6a52'], ['#b8a882', '#6f6f6a'], ['#a0827a', '#6a6a66']];

// ocupado? (casas e objetos; ao contrário de world.blocked, o próprio lote/quintal não conta — o recheio do lote cabe nele)
function miaBlocked(x, y, r) {
  return OW.blk.any(x - r, y - r, x + r, y + r, e => {
    if (e.t === 'y') return false;
    if (e.t === 'h') { const H = e.o; return x > H.x0 - r - 0.3 && x < H.x1 + r + 0.3 && y > H.y0 - r - 0.3 && y < H.y1 + r + 0.3; }
    const b = e.o; return Math.hypot(b.x - x, b.y - y) < Math.max(b.w, b.d) / 2 + r + 0.2;
  }) || OW.place.any(x - r - 1, y - r - 1, x + r + 1, y + r + 1, c => Math.hypot(c.x - x, c.y - y) < c.r + r);
}
// ---------- zona Miami de um ponto ----------
function miaZone(x, y, d) {
  const geo = OW.geo;
  if (d === D_.DOWNTOWN) return 'brickell';
  if (d === D_.FAVELA) return 'poor';
  if (d === D_.GHETTO) return 'projects';
  if (d === D_.INDUSTRIAL || d === D_.PORT) return 'works';
  if (d === D_.TOWN) return 'town';
  if (d === D_.URBAN) {
    if (geo.coastDist(x, y) < 420) return x > geo.bay.x ? 'southbeach' : 'mansion';
    return 'bungalow';
  }
  return null;
}

// ---------- sprites compartilhados ----------
function miaInit() {
  const R = mulberry(COG.WORLD_SEED ^ 0x7a11);
  MIA.palms = { royal: Array.from({ length: 9 }, () => makePalm('royal', R)), coconut: Array.from({ length: 12 }, () => makePalm('coconut', R)) };
  MIA.bush = {};
  for (const k of ['hibiscus', 'bougainvillea', 'seagrape', 'croton']) MIA.bush[k] = Array.from({ length: 3 }, () => makeTropicalBush(k, R));
  for (const sp of [...MIA.palms.royal, ...MIA.palms.coconut]) palmShadowStamp(sp);
  // mar do Caribe: raso turquesa, fundo azul; areia clara de coral
  const set = (k, v) => { COL[k][0] = v[0]; COL[k][1] = v[1]; COL[k][2] = v[2]; };
  set('shallow', [96, 178, 170]); set('deep', [28, 82, 112]); set('foam', [246, 248, 242]); set('sand', [232, 218, 182]); set('wsand', [196, 178, 140]); set('dirt', [138, 118, 96]);
  world.decals = [];
}

// ---------- lote genérico de frente p/ a via ----------
// devolve {x0,y0,x1,y1,fk,n} com a fachada `fk` virada p/ a rua, ou null se não couber
function miaLot(S, c, rects, front, depth, set, margin, keepRoad = 0.3) {
  const p = c.p, o = [p.nx * c.s, p.ny * c.s], [sx0, sy0, sx1, sy1] = S.bounds;
  const fk = Math.abs(o[0]) > Math.abs(o[1]) ? (o[0] > 0 ? 'W' : 'E') : (o[1] > 0 ? 'N' : 'S');
  const n = { S: [0, 1], N: [0, -1], W: [-1, 0], E: [1, 0] }[fk];
  const ax = fk === 'S' || fk === 'N', W = ax ? front : depth, D = ax ? depth : front;
  // via em diagonal: recua pelo canto mais próximo (meias-medidas projetadas na normal real da via)
  const dist = ROAD_W + c.off + SIDE + set + Math.abs(o[0]) * W / 2 + Math.abs(o[1]) * D / 2;
  const x0 = Math.round(p.x + o[0] * dist - W / 2), y0 = Math.round(p.y + o[1] * dist - D / 2), x1 = x0 + W, y1 = y0 + D;
  const m = margin, box = [x0 - m, y0 - m, x1 + m, y1 + m];
  const F = MIA.fail || (MIA.fail = {}), no = k => { F[k] = (F[k] || 0) + 1; return null; };
  if (box[0] < sx0 + 1 || box[1] < sy0 + 1 || box[2] > sx1 - 1 || box[3] > sy1 - 1) return no('sector');
  if (rects.some(b => box[0] < b[2] + 2 && box[2] > b[0] - 2 && box[1] < b[3] + 2 && box[3] > b[1] - 2)) return no('rect');
  for (let y = box[1]; y <= box[3]; y += 1) for (let x = box[0]; x <= box[2]; x += 1) {
    const inB = x >= x0 && x <= x1 && y >= y0 && y <= y1;
    // construção fora da calçada; a margem do lote só não pode cair no asfalto
    if (roadDist(x, y) < (inB ? ROAD_W + SIDE + 0.15 : ROAD_W + keepRoad)) return no(inB ? 'roadB' : 'roadM');
    if (pondVal(x, y) < 1.4) return no('water');
  }
  return { x0, y0, x1, y1, fk, n, box };
}

// ---------- prédio (fachada pintada por andar) ----------
function miaBuilding(S, c, rects, kind) {
  const r = rng, sp = MIA_SPEC[kind](r);
  const L = miaLot(S, c, rects, sp.w, sp.d, Math.min(sp.set, kind === 'warehouse' ? 1.3 : kind === 'projects' ? .85 : .55), kind === 'warehouse' ? 2 : kind === 'shop' ? .6 : 1.2);
  if (!L) return null;
  rects.push(L.box);
  const { x0, y0, x1, y1, fk, n } = L, len = fk === 'S' || fk === 'N' ? x1 - x0 : y1 - y0, mid = len >> 1;
  const h = sp.h || FLOOR0 + (sp.n - 1) * FLOORH;
  const doors = kind === 'warehouse' ? [mid] : [mid - 1, mid];
  const floorCol = { deco: '#e9e1d2', condo: '#e4e2dc', office: '#d9d8d2', projects: '#b5aea0', warehouse: '#9a9890', shop: '#d8d0c0' }[kind];
  const H = addHouse({ x0, y0, x1, y1, h, roofKind: 'flat', open: { [fk]: { door: doors } }, floors: [{ x0, y0, x1, y1, kind: kind === 'warehouse' ? 'conc' : 'tile', col: floorCol }],
    seed: owSeed(S, kind + x0 + ',' + y0), tall: sp.n > 2, texPPM: sp.ppm, facadeFn: FACADES[kind] });
  const R2 = mulberry(H.seed + 3), pick = a => a[(R2() * a.length) | 0];
  H.miaKind = kind; H.nFloors = sp.n; H.accent = pick(DECO_ACCENT);
  H.hotelName = pick(HOTEL_NAMES); H.bName = kind === 'warehouse' ? pick(['DADE FREIGHT', 'BISCAYNE COLD STORAGE', 'PORT SUPPLY CO.', 'GULF IMPORTS', 'SUNSHINE MOVERS', 'TROPIC PRODUCE'])
    : kind === 'office' ? pick(OFFICE_NAMES) : pick(['THE AVANTI', 'ONE BAYSIDE', 'PALM COURT', 'MARINA BLUE', 'VIZCAYA', 'LA PLAYA', 'AQUA', 'CORAL GABLES']);
  H.shopSign = pick(SHOP_SIGNS); H.poor = kind === 'projects' || (kind === 'shop' && (c.zone === 'poor' || c.zone === 'projects'));
  const S2 = H.style;
  S2.plaster = kind === 'deco' ? pick(DECO_PASTELS) : kind === 'projects' ? pick(['#d9c9a3', '#c9b48e', '#d2c2b0', '#bfae93', '#c7b9a0'])
    : kind === 'warehouse' ? pick(['#c9ccc8', '#b4b9b6', '#d8d2c0', '#9fb2b8', '#c2b49a']) : kind === 'shop' ? pick(['#f2d7a7', '#e9b9a0', '#cfe3d6', '#f4efe2', '#e8c7d8', '#f6e3b4', '#bfe0ea'])
    : '#ecebe6';
  if (c.zone === 'poor' || c.zone === 'projects') { S2.plaster = pick(MIA_POOR)[0]; }
  S2.trim = H.poor || c.zone === 'poor' ? '#d6cfbf' : '#f7f5ef'; S2.glassTint = kind === 'office' ? '#4d7896' : kind === 'condo' ? '#5d93a8' : '#6f97ad';
  S2.aging = H.poor || c.zone === 'poor' ? 0.95 : kind === 'warehouse' ? 0.7 : 0.3; S2.interior = '#e6e1d6'; S2.roofCol = kind === 'warehouse' ? '#a8aaa6' : '#d9d6ce';
  const sd = H.sides[fk];
  H.doorPt = [sd.a[0] + sd.dir[0] * (doors.length > 1 ? mid : mid + 0.5), sd.a[1] + sd.dir[1] * (doors.length > 1 ? mid : mid + 0.5)];
  H.doorN = n; H.front = [H.doorPt[0] + n[0] * 2, H.doorPt[1] + n[1] * 2]; H.frontSide = fk;
  H.roofItems = miaRoofItems(H, kind, R2);
  miaBuildingSurround(S, H, kind, L, R2);
  owIndexOwnedLive(S);
  return H;
}

// equipamentos de cobertura: piscina e deck (hotéis/condomínios), heliponto (escritório), casas de máquinas e condensadoras
function miaRoofItems(H, kind, r) {
  const W = H.x1 - H.x0, D = H.y1 - H.y0, it = [];
  const cx = (H.x0 + H.x1) / 2, cy = (H.y0 + H.y1) / 2;
  const roll = r();
  if ((kind === 'condo' || kind === 'deco') && W >= 14 && D >= 12 && roll < 0.7) {
    const pw = Math.min(W - 6, 5 + ((r() * 6) | 0)), pd = Math.min(D - 6, 3 + ((r() * 3) | 0));
    it.push({ k: 'pool', flat: true, x: cx + (r() - 0.5) * (W - pw - 6), y: cy + (r() - 0.5) * (D - pd - 6), w: pw, d: pd, n: 1 + ((r() * 4) | 0), cab: r() < 0.5, deck: ['#c9a77c', '#d9d2c4', '#b48a62'][(r() * 3) | 0], draw: drawRoofPool });
  } else if (kind === 'condo' || kind === 'deco') it.push({ k: 'garden', flat: true, x: cx, y: cy, w: W - 5, d: D - 5, seed: (r() * 1e6) | 0, draw: drawRoofGarden });
  if (kind === 'office' && roll < 0.2) it.push({ k: 'heli', flat: true, x: cx, y: cy, r: Math.min(W, D) / 2 - 2.5, draw: drawHelipad });
  else if (kind === 'office') {   // casa de máquinas grande + coroa (platibanda alta) e torres de resfriamento
    it.push({ x: cx, y: cy, draw: (g, H2, z) => drawBox(g, { x: cx, y: cy, z, w: W * 0.45, d: D * 0.4, h: 3.2, rot: 0, top: '#bdb9b0', side: '#9fa7ad' }) });
    for (let i = 0; i < 2; i++) { const tx = H.x0 + 2.5 + i * 3, ty = H.y1 - 2.5; it.push({ x: tx, y: ty, draw: (g, H2, z) => drawCyl(g, tx, ty, z, 1.1, 1.6, '#8e959a', '#6d7378') }); }
  }
  const mech = { x: H.x0 + 2.4, y: H.y0 + 2.2, draw: (g, H2, z) => drawBox(g, { x: H.x0 + 2.4, y: H.y0 + 2.2, z, w: 3.2, d: 2.6, h: 2.4, rot: 0, top: '#cfcbc2', side: '#b3aea4' }) };
  if (kind !== 'shop') it.push(mech);
  for (let i = 0, n = kind === 'warehouse' ? 6 : 3 + ((r() * 4) | 0); i < n; i++) it.push({ k: 'ac', x: H.x1 - 1.4 - (i % 3) * 1.3, y: H.y1 - 1.6 - ((i / 3) | 0) * 1.2 });
  it.push({ k: 'vent', x: H.x0 + W * 0.3, y: H.y1 - 1.1 }, { k: 'tank', x: H.x1 - 1.6, y: H.y0 + 1.6 });
  return it;
}
function drawRoofPool(g, H, z, it) {
  const P = (x, y) => proj(x, y, z + 0.02), x0 = it.x - it.w / 2, y0 = it.y - it.d / 2, x1 = x0 + it.w, y1 = y0 + it.d;
  poly(g, [P(x0 - 1.4, y0 - 1.4), P(x1 + 1.4, y0 - 1.4), P(x1 + 1.4, y1 + 1.4), P(x0 - 1.4, y1 + 1.4)], it.deck || '#c9a77c', null);   // deck
  poly(g, [P(x0 - 0.3, y0 - 0.3), P(x1 + 0.3, y0 - 0.3), P(x1 + 0.3, y1 + 0.3), P(x0 - 0.3, y1 + 0.3)], '#f1eee6', null);
  const q = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], gr = g.createLinearGradient(q[0].x, q[0].y, q[2].x, q[2].y);
  gr.addColorStop(0, '#2aa8c8'); gr.addColorStop(0.5, '#4fd0e0'); gr.addColorStop(1, '#1f8fb4'); poly(g, q, gr, null);
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1;
  for (let k = 1; k < 5; k++) { const a = P(x0 + it.w * k / 5, y0 + 0.2), b = P(x0 + it.w * k / 5 - 0.6, y1 - 0.2); g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo((a.x + b.x) / 2 + 3, (a.y + b.y) / 2, b.x, b.y); g.stroke(); }
  for (let k = 0; k < (it.n || 4); k++) drawBox(g, { x: x0 + 1 + k * 2.2, y: y1 + 0.9, z, w: 0.7, d: 1.8, h: 0.35, rot: 0, top: '#f4f2ec', side: '#cfcac0' });
  if (it.cab) { drawBox(g, { x: x1 + 0.4, y: y0 - 0.2, z, w: 2, d: 2, h: 2.3, rot: 0, top: '#f4f2ec', side: '#dcd6c8' }); }
}
function drawRoofGarden(g, H, z, it) {
  const P = (x, y) => proj(x, y, z + 0.03), r = mulberry(it.seed), x0 = it.x - it.w / 2, y0 = it.y - it.d / 2;
  poly(g, [P(x0, y0), P(x0 + it.w, y0), P(x0 + it.w, y0 + it.d), P(x0, y0 + it.d)], '#b8b0a0', null);
  for (let i = 0; i < 6; i++) { const x = x0 + 1 + r() * (it.w - 2), y = y0 + 1 + r() * (it.d - 2); drawBox(g, { x, y, z, w: 1.2, d: 1.2, h: 0.5, rot: 0, top: '#4f7a3a', side: '#9a9488' }); }
  for (let i = 0; i < 2; i++) drawBox(g, { x: x0 + 2 + i * 3, y: y0 + it.d - 1.5, z, w: 1.6, d: 0.6, h: 0.45, rot: 0, top: '#7a5638', side: '#5a3e28' });
}
function drawHelipad(g, H, z, it) {
  const c = proj(it.x, it.y, z + 0.02), r = it.r * cam.zoom;
  g.save(); g.translate(c.x, c.y); g.scale(1, TILT);
  g.fillStyle = '#5b5f63'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = '#f2c230'; g.lineWidth = Math.max(1.5, cam.zoom * 0.25); g.beginPath(); g.arc(0, 0, r * 0.82, 0, TAU); g.stroke();
  g.fillStyle = '#ffffff'; g.font = `bold ${r * 0.9}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('H', 0, 0); g.restore();
}
// marquise da portaria: laje com testeira escura e o nome do prédio em letras brancas na face da rua
function drawMarquee(g, b) {
  drawBox(g, Object.assign({}, b, { draw: null }));
  if (!b.label || facingCam(b.nx, b.ny) <= 0) return;
  const ax = Math.abs(b.nx) > 0.5, half = (ax ? b.d : b.w) / 2, ex = b.x + b.nx * (ax ? b.w : b.d) / 2, ey = b.y + b.ny * (ax ? b.w : b.d) / 2;
  const tx = -b.ny, ty = b.nx, zm = b.z + b.h / 2, a = proj(ex - tx * half, ey - ty * half, zm), c = proj(ex + tx * half, ey + ty * half, zm), Z = cam.zoom;
  g.save(); g.translate((a.x + c.x) / 2, (a.y + c.y) / 2); g.transform(1, (c.y - a.y) / (c.x - a.x || 1), 0, 1, 0, 0);
  g.fillStyle = b.side === '#2f3a44' ? '#f4f2ec' : '#3a4650'; g.font = `bold ${Math.max(6, Z * 0.26)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(b.label, 0, 0); g.restore();
}

// arredores de cada prédio: calçadão/praça, palmeiras em canteiro, docas, estacionamento, quadra
function miaBuildingSurround(S, H, kind, L, r) {
  const n = H.doorN, t = [-n[1], n[0]], cx = (H.x0 + H.x1) / 2, cy = (H.y0 + H.y1) / 2, half = (Math.abs(t[0]) ? H.x1 - H.x0 : H.y1 - H.y0) / 2;
  const fx = H.doorPt[0], fy = H.doorPt[1];
  if (kind === 'condo' || kind === 'office' || kind === 'deco') {
    // praça de pedra portuguesa entre o prédio e a calçada + palmeiras imperiais em canteiros
    let ext = 0.5; while (ext < 8 && roadDist(fx + n[0] * ext, fy + n[1] * ext) > ROAD_W + SIDE) ext += 0.5;
    miaDecal(miaQuad(fx, fy, n, t, half, ext), kind === 'deco' ? 'terrazzo' : 'plaza', r);
    for (const sgn of [-1, 1]) {
      const px = fx + t[0] * sgn * (half - 1.4) + n[0] * ext * 0.5, py = fy + t[1] * sgn * (half - 1.4) + n[1] * ext * 0.5;
      if (ext > 2.4) miaPalm(px, py, 'royal', true);
    }
    if (kind !== 'deco') {   // marquise da portaria + bancos, floreiras e frades na praça
      const ax = Math.abs(n[0]) > 0.5, cx2 = fx + n[0] * 1.4, cy2 = fy + n[1] * 1.4;
      addBox({ x: cx2, y: cy2, z: 3.4, w: ax ? 2.8 : 6, d: ax ? 6 : 2.8, h: 0.42, top: '#ecebe6', side: kind === 'office' ? '#2f3a44' : '#d9d6ce', kind: 'canopy', solid: false, nx: n[0], ny: n[1], label: H.bName, draw: drawMarquee });
      for (const sg of [-1, 1]) addBox({ x: fx + n[0] * 2.6 + t[0] * sg * 2.7, y: fy + n[1] * 2.6 + t[1] * sg * 2.7, w: 0.26, d: 0.26, h: 3.4, top: '#c9c6bf', side: kind === 'office' ? '#3a4650' : '#e4e1da', kind: 'column' });
      for (const sg of [-1, 1]) {
        if (ext > 3) { miaBench(fx + t[0] * sg * 4.5 + n[0] * (ext - 1.6), fy + t[1] * sg * 4.5 + n[1] * (ext - 1.6), Math.atan2(t[1], t[0])); miaPlanter(fx + t[0] * sg * 2.6 + n[0] * (ext - 1.3), fy + t[1] * sg * 2.6 + n[1] * (ext - 1.3)); }
        for (let k = 0; k < 3; k++) miaBollard(fx + t[0] * sg * (1.2 + k * 1.3) + n[0] * (ext - 0.3), fy + t[1] * sg * (1.2 + k * 1.3) + n[1] * (ext - 0.3));
      }
      miaCan(fx + t[0] * (half - 0.8) + n[0] * (ext - 0.6), fy + t[1] * (half - 0.8) + n[1] * (ext - 0.6));
    }
    if (kind === 'deco') {   // mesas de café na calçada
      for (let k = -2; k <= 2; k++) if (k) { const px = fx + t[0] * k * 2.2 + n[0] * Math.min(ext - 0.8, 1.3), py = fy + t[1] * k * 2.2 + n[1] * Math.min(ext - 0.8, 1.3); if (ext > 1.6) miaCafeTable(px, py, H.accent); }
    }
  } else if (kind === 'warehouse') {
    let ext = 0.5; while (ext < 10 && roadDist(fx + n[0] * ext, fy + n[1] * ext) > ROAD_W + SIDE) ext += 0.5;
    miaDecal(miaQuad(fx, fy, n, t, half, ext), 'apron', r);
    for (let k = 0; k < 4; k++) { const u = (r() - 0.5) * half * 1.6, px = fx + t[0] * u + n[0] * (1 + r() * (ext - 2)), py = fy + t[1] * u + n[1] * (1 + r() * (ext - 2)); if (ext > 3 && !miaBlocked(px, py, 0.8)) addBox({ x: px, y: py, w: 1.2, d: 1.0, h: 0.15 + ((r() * 4) | 0) * 0.15, rot: r() * 0.4, top: '#b08a5a', side: '#7d6040', kind: 'pallet' }); }
    const dpx = H.x0 - 1.4, dpy = cy; if (!miaBlocked(dpx, dpy, 1)) miaDumpster(dpx, dpy, 0);
  } else if (kind === 'projects') {
    // pátio de terra batida com grama falhada na frente + quadra de basquete cercada atrás
    let ext = 0.5; while (ext < 8 && roadDist(fx + n[0] * ext, fy + n[1] * ext) > ROAD_W + SIDE) ext += 0.5;
    miaDecal(miaQuad(fx, fy, n, t, half, ext), 'dirtyard', r);
    const bx = cx - n[0] * ((Math.abs(n[0]) ? H.x1 - H.x0 : H.y1 - H.y0) / 2 + 9), by = cy - n[1] * ((Math.abs(n[0]) ? H.x1 - H.x0 : H.y1 - H.y0) / 2 + 9);
    miaCourt(S, bx, by, Math.abs(n[0]) > 0 ? 'y' : 'x');
  } else if (kind === 'shop') {
    let ext = 0.5; while (ext < 6 && roadDist(fx + n[0] * ext, fy + n[1] * ext) > ROAD_W + SIDE) ext += 0.5;
    miaDecal(miaQuad(fx, fy, n, t, half, ext), 'walk', r);
    const sx = fx + t[0] * (half + 0.8) + n[0] * 0.8, sy = fy + t[1] * (half + 0.8) + n[1] * 0.8;
    if (!miaBlocked(sx, sy, 0.5)) addBox({ x: sx, y: sy, w: 0.5, d: 0.45, h: 1.05, top: '#2b5fa8', side: '#214a85', kind: 'newsbox' });
    const bx2 = cx - n[0] * ((Math.abs(n[0]) ? H.x1 - H.x0 : H.y1 - H.y0) / 2 + 1.6), by2 = cy - n[1] * ((Math.abs(n[0]) ? H.x1 - H.x0 : H.y1 - H.y0) / 2 + 1.6);
    if (!miaBlocked(bx2, by2, 1)) miaDumpster(bx2, by2, Math.abs(n[0]) ? Math.PI / 2 : 0);
  }
}
const miaQuad = (fx, fy, n, t, half, ext) => [[fx - t[0] * half, fy - t[1] * half], [fx + t[0] * half, fy + t[1] * half], [fx + t[0] * half + n[0] * ext, fy + t[1] * half + n[1] * ext], [fx - t[0] * half + n[0] * ext, fy - t[1] * half + n[1] * ext]];

// ---------- mansão (bairro nobre da orla): sobrado grande de reboco branco, telhado de barro,
// pórtico de colunas, entrada circular com chafariz, piscina com deque e palmeiras imperiais ----------
function miaMansion(S, c, rects) {
  let L = null, HW = 0, HD = 0;
  for (const [hw, hd, lw, ld] of [[20, 14, 34, 33], [18, 12, 30, 29], [16, 11, 27, 26]]) if ((L = miaLot(S, c, rects, lw, ld, 0.4, 0.3))) { HW = hw; HD = hd; break; }
  if (!L) return null;
  rects.push(L.box);
  const { fk, n } = L, t = [-n[1], n[0]], ax = Math.abs(n[0]) > 0.5;
  const W = ax ? HD : HW, D = ax ? HW : HD, lcx = (L.x0 + L.x1) / 2, lcy = (L.y0 + L.y1) / 2, depthLot = ax ? L.x1 - L.x0 : L.y1 - L.y0, widthLot = ax ? L.y1 - L.y0 : L.x1 - L.x0;
  const fy = 10, hcx = lcx + n[0] * (depthLot / 2 - fy - HD / 2), hcy = lcy + n[1] * (depthLot / 2 - fy - HD / 2);
  const x0 = Math.round(hcx - W / 2), y0 = Math.round(hcy - D / 2), mid = HW >> 1;
  const opp = { S: 'N', N: 'S', W: 'E', E: 'W' }[fk], lat = ax ? ['S', 'N'] : ['W', 'E'];
  const win = (len, skip) => [...Array(len).keys()].filter(i => i > 0 && i < len - 1 && i % 3 !== 0 && !skip.includes(i));
  const H = addHouse({ x0, y0, x1: x0 + W, y1: y0 + D, h: 6.2, storeys: 2, floorHeight: 3.1, roofKind: 'hip',
    open: { [fk]: { door: [mid], win: win(HW, [mid - 1, mid, mid + 1]) }, [opp]: { win: win(HW, [mid]), door: [] }, [lat[0]]: { win: win(HD, []) }, [lat[1]]: { win: win(HD, []) } },
    floors: [{ x0, y0, x1: x0 + W, y1: y0 + D, kind: 'tile', col: '#e8e2d4' }], seed: owSeed(S, 'm' + x0 + ',' + y0) });
  H.frontSide = fk;
  const r = mulberry(H.seed + 9), St = H.style;
  St.plaster = ['#fbf8f1', '#f8f0e2', '#f6efe3', '#fdfaf4'][(r() * 4) | 0]; St.trim = '#fbfaf6'; St.aging = 0.1; St.roofMat = 'ceramic'; St.roofCol = ['#c4683f', '#b65a40', '#c97a4e'][(r() * 3) | 0];
  St.glassTint = '#5f8fa8'; St.curtains = true; St.shutters = ['#3f5f4a', '#f4f1ea', '#5a7f96'][(r() * 3) | 0];
  H.miaKind = 'mansion';
  const sd = H.sides[fk]; H.doorPt = [sd.a[0] + sd.dir[0] * (mid + 0.5), sd.a[1] + sd.dir[1] * (mid + 0.5)]; H.doorN = n; H.front = [H.doorPt[0] + n[0] * 2, H.doorPt[1] + n[1] * 2];
  // móveis do térreo
  const fur = (u, v, w, d, h, top, side, kind) => addBox({ x: hcx + t[0] * u - n[0] * v, y: hcy + t[1] * u - n[1] * v, w: ax ? d : w, d: ax ? w : d, h, top, side, kind, house: H });
  fur(-HW / 4, 0, 2.6, 0.9, 0.45, '#efe9dc', '#cfc6b4', 'sofa'); fur(-HW / 4, 1.6, 1.4, 0.8, 0.42, '#7a5a3c', '#5a4028', 'table');
  fur(HW / 4, 0, 2.2, 1.1, 0.76, '#6b4a32', '#4f3624', 'table'); fur(HW / 4, -HD / 2 + 0.6, 3, 0.6, 0.9, '#e6e0d2', '#9c8a70', 'counter');
  world.yards.push([L.x0, L.y0, L.x1, L.y1]);
  // gramado listrado em todo o lote
  miaDecal([[L.x0, L.y0], [L.x1, L.y0], [L.x1, L.y1], [L.x0, L.y1]], 'lawn', r, { dir: ax ? 1 : 0 });
  // entrada circular com chafariz no meio do jardim da frente + 2 acessos à rua
  const fc = [H.doorPt[0] + n[0] * (fy * 0.5), H.doorPt[1] + n[1] * (fy * 0.5)];
  let ext = fy; while (ext < fy + 6 && roadDist(H.doorPt[0] + n[0] * ext, H.doorPt[1] + n[1] * ext) > ROAD_W + SIDE - 0.1) ext += 0.5;
  for (const sg of [-1, 1]) miaDecal(miaQuad(fc[0] + t[0] * sg * 3.4, fc[1] + t[1] * sg * 3.4, n, t, 1.4, ext - fy * 0.5 + 0.2), 'pavers', r);
  world.decals.push({ kind: 'ring', x: fc[0], y: fc[1], r0: 2.2, r1: 4.6, bb: [fc[0] - 5, fc[1] - 5, fc[0] + 5, fc[1] + 5], paint: paintRing });
  addBox({ x: fc[0], y: fc[1], w: 3.2, d: 3.2, h: 1.8, kind: 'fountain', draw: drawFountain });
  // pórtico com colunas em pé-direito duplo
  for (const u of [-2.8, -1.2, 1.2, 2.8]) addBox({ x: H.doorPt[0] + n[0] * 2.6 + t[0] * u, y: H.doorPt[1] + n[1] * 2.6 + t[1] * u, w: 0.42, d: 0.42, h: H.h - 0.3, top: '#fbfaf6', side: '#ebe7de', kind: 'column' });
  addBox({ x: H.doorPt[0] + n[0] * 1.45, y: H.doorPt[1] + n[1] * 1.45, z: H.h - 0.3, w: ax ? 3.2 : 7, d: ax ? 7 : 3.2, h: 0.4, top: '#f1ede4', side: '#fbfaf6', kind: 'portico', solid: false });
  miaDecal(miaQuad(H.doorPt[0], H.doorPt[1], n, t, 3.6, 3.2), 'terrazzo', r);
  for (const sg of [-1, 1]) miaPlanter(H.doorPt[0] + n[0] * 3.6 + t[0] * sg * 4.2, H.doorPt[1] + n[1] * 3.6 + t[1] * sg * 4.2);
  // loggia dos fundos: colunata em pé-direito duplo e varanda com guarda-corpo no andar de cima
  const bw = [hcx - n[0] * (HD / 2), hcy - n[1] * (HD / 2)];
  for (let u = -HW / 2 + 2; u <= HW / 2 - 2; u += (HW - 4) / 4) addBox({ x: bw[0] - n[0] * 2.4 + t[0] * u, y: bw[1] - n[1] * 2.4 + t[1] * u, w: 0.4, d: 0.4, h: H.h - 0.3, top: '#fbfaf6', side: '#ebe7de', kind: 'column' });
  addBox({ x: bw[0] - n[0] * 1.3, y: bw[1] - n[1] * 1.3, z: 3.0, w: ax ? 2.7 : HW - 2.6, d: ax ? HW - 2.6 : 2.7, h: 0.22, top: '#efe9dc', side: '#fbfaf6', kind: 'balcony', solid: false, rail: true, draw: drawBalcony, nx: -n[0], ny: -n[1] });
  addBox({ x: bw[0] - n[0] * 1.3, y: bw[1] - n[1] * 1.3, z: H.h - 0.3, w: ax ? 2.9 : HW - 2.4, d: ax ? HW - 2.4 : 2.9, h: 0.35, top: '#f1ede4', side: '#fbfaf6', kind: 'portico', solid: false });
  miaDecal(miaQuad(bw[0], bw[1], [-n[0], -n[1]], t, HW / 2 - 1, 3), 'terrazzo', r);
  // piscina com deque nos fundos + espreguiçadeiras e guarda-sol
  const bk = [hcx - n[0] * (HD / 2 + 5.2), hcy - n[1] * (HD / 2 + 5.2)];
  miaDecal(miaQuad(bk[0] - n[0] * 4, bk[1] - n[1] * 4, n, t, 8, 8), 'deck', r);
  miaDecal(miaQuad(bk[0] - n[0] * 2.6, bk[1] - n[1] * 2.6, n, t, 5.2, 5), 'pool', r);
  for (let i = -1; i <= 1; i++) addBox({ x: bk[0] + n[0] * 3.1 + t[0] * (i * 1.6 - 3), y: bk[1] + n[1] * 3.1 + t[1] * (i * 1.6 - 3), w: ax ? 1.95 : 0.68, d: ax ? 0.68 : 1.95, h: 0.8, rot: Math.atan2(-n[1], -n[0]) + (ax ? 0 : 0), top: '#f6f4ee', side: '#d9d3c6', kind: 'lounger', solid: false, pad: '#f4f2ec', draw: drawLounger });
  addBox({ x: bk[0] + n[0] * 3 + t[0] * 4, y: bk[1] + n[1] * 3 + t[1] * 4, w: 0.3, d: 0.3, h: 2.2, kind: 'umbrella', solid: false, col: '#f4f2ec', col2: '#2b6fb8', draw: drawBeachUmbrella });
  // cerca viva alta com portões nos acessos
  // vão na cerca da frente onde cada acesso a cruza; pilares do portão na própria linha da cerca
  const frontLon = (lcx - fc[0]) * n[0] + (lcy - fc[1]) * n[1] + depthLot / 2;
  const gate = (x, y) => [-1, 1].some(sg => { const dx = x - fc[0] - t[0] * sg * 3.4, dy = y - fc[1] - t[1] * sg * 3.4; return Math.abs(dx * t[0] + dy * t[1]) < 1.9 && dx * n[0] + dy * n[1] > 0; });
  miaHedgeRect([L.x0, L.y0, L.x1, L.y1], gate);
  for (const sg of [-1, 1]) for (const sg2 of [-1, 1]) addBox({ x: fc[0] + t[0] * (sg * 3.4 + sg2 * 1.9) + n[0] * frontLon, y: fc[1] + t[1] * (sg * 3.4 + sg2 * 1.9) + n[1] * frontLon, w: 0.6, d: 0.6, h: 2, top: '#f1ede4', side: '#e3ddd0', kind: 'gatepost' });
  // palmeiras imperiais em alas ao longo da frente; coqueiros perto da piscina; canteiros junto às paredes
  for (const sg of [-1, 1]) for (let k = 0; k < 2; k++) { const px = fc[0] + t[0] * sg * (widthLot / 2 - 2) + n[0] * (k * 4.5 - 2), py = fc[1] + t[1] * sg * (widthLot / 2 - 2) + n[1] * (k * 4.5 - 2); if (!miaBlocked(px, py, 0.8)) miaPalm(px, py, 'royal'); }
  for (const sg of [-1, 1]) { const px = bk[0] + t[0] * sg * 9.5, py = bk[1] + t[1] * sg * 9.5; if (!miaBlocked(px, py, 0.8)) miaPalm(px, py, 'coconut'); }
  miaShrubs(H, ['hibiscus', 'bougainvillea', 'croton'], 9, r);
  if (r() < 0.85) miaCar(fc[0] + t[0] * 3.4, fc[1] + t[1] * 3.4, Math.atan2(t[1], t[0]), { col: ['#1d1f22', '#ecebe7', '#c3c6c9', '#35507a'][(r() * 4) | 0] });
  owIndexOwnedLive(S);
  return H;
}
function drawBalcony(g, b) {
  drawBox(g, { x: b.x, y: b.y, z: b.z, w: b.w, d: b.d, h: b.h, rot: 0, top: b.top, side: b.side });
  // guarda-corpo de balaústres na borda externa
  const ax = Math.abs(b.nx) > 0.5, hl = (ax ? b.d : b.w) / 2, ex = b.x + b.nx * (ax ? b.w : b.d) / 2, ey = b.y + b.ny * (ax ? b.w : b.d) / 2;
  const tx = ax ? 0 : 1, ty = ax ? 1 : 0, zt = b.z + b.h + 0.95, Z = cam.zoom;
  const a = proj(ex - tx * hl, ey - ty * hl, zt), c = proj(ex + tx * hl, ey + ty * hl, zt);
  g.strokeStyle = '#fbfaf6'; g.lineWidth = Math.max(1, Z * 0.05);
  for (let u = -hl; u <= hl; u += 0.35) { const p0 = proj(ex + tx * u, ey + ty * u, b.z + b.h), p1 = proj(ex + tx * u, ey + ty * u, zt); g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke(); }
  g.lineWidth = Math.max(1.5, Z * 0.09); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.stroke();
}
function paintRing(g, d) {
  g.save(); g.beginPath(); g.arc(d.x, d.y, d.r1, 0, TAU); g.arc(d.x, d.y, d.r0, 0, TAU, true); g.clip('evenodd');
  g.fillStyle = '#c9b79a'; g.fillRect(d.x - d.r1, d.y - d.r1, d.r1 * 2, d.r1 * 2);
  g.strokeStyle = 'rgba(90,70,50,0.35)'; g.lineWidth = 0.03;
  for (let rr = d.r0; rr < d.r1; rr += 0.3) { g.beginPath(); g.arc(d.x, d.y, rr, 0, TAU); g.stroke(); }
  for (let a = 0; a < TAU; a += 0.09) { g.beginPath(); g.moveTo(d.x + Math.cos(a) * d.r0, d.y + Math.sin(a) * d.r0); g.lineTo(d.x + Math.cos(a) * d.r1, d.y + Math.sin(a) * d.r1); g.stroke(); }
  g.restore();
  g.strokeStyle = '#e9e3d6'; g.lineWidth = 0.15; g.beginPath(); g.arc(d.x, d.y, d.r1, 0, TAU); g.stroke(); g.beginPath(); g.arc(d.x, d.y, d.r0, 0, TAU); g.stroke();
}
function drawFountain(g, b) {
  const Z = cam.zoom, c0 = proj(b.x, b.y, 0), c1 = proj(b.x, b.y, 0.55), r = 1.55 * Z;
  g.fillStyle = '#d8d2c4'; g.beginPath(); g.ellipse(c0.x, c0.y, r, r * TILT, 0, 0, Math.PI); g.lineTo(c1.x - r, c1.y); g.ellipse(c1.x, c1.y, r, r * TILT, 0, Math.PI, 0, true); g.fill();
  g.fillStyle = '#ece7dc'; g.beginPath(); g.ellipse(c1.x, c1.y, r, r * TILT, 0, 0, TAU); g.fill();
  g.fillStyle = '#3fa9c4'; g.beginPath(); g.ellipse(c1.x, c1.y, r * 0.85, r * 0.85 * TILT, 0, 0, TAU); g.fill();
  const p = proj(b.x, b.y, 1.7); g.fillStyle = '#ece7dc'; g.fillRect(p.x - Z * 0.08, p.y, Z * 0.16, c1.y - p.y);
  g.fillStyle = 'rgba(230,245,250,0.8)'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(p.x + Math.cos(a) * r * 0.5, p.y - Z * 0.2, p.x + Math.cos(a) * r * 0.7, c1.y + Math.sin(a) * r * 0.7 * TILT); g.lineTo(p.x + Math.cos(a) * r * 0.66, c1.y + Math.sin(a) * r * 0.66 * TILT); g.quadraticCurveTo(p.x + Math.cos(a) * r * 0.45, p.y - Z * 0.15, p.x, p.y + 1); g.fill(); }
}
// ---------- bangalô pastel (bairro) e casa pobre (favela) ----------
function miaHouse(S, c, rects, poor) {
  const key = poor ? (rng() < 0.6 ? 'B' : 'D') : ['A', 'B', 'D', 'C'][(rng() * 4) | 0];
  const T = TPL[key]; if (!T) return null;
  const was = T.yard; T.yard = false;   // a cerca é nossa (alambrado/mureta), não a de madeira
  let H; try { H = owTryHouse(S, key, c, rects); } finally { T.yard = was; }
  if (!H) return null;
  const r = mulberry(H.seed + 21), St = H.style, pal = (poor ? MIA_POOR : MIA_BUNGALOW)[(r() * (poor ? MIA_POOR : MIA_BUNGALOW).length) | 0];
  St.plaster = pal[0]; St.trim = poor ? '#d9d2c2' : '#fbf8f0'; St.aging = poor ? 0.8 + r() * 0.2 : 0.25 + r() * 0.2;
  if (H.roofKind !== 'flat') { St.roofMat = poor ? 'metal' : r() < 0.6 ? 'ceramic' : 'shingle'; St.roofCol = pal[1]; }
  St.bars = poor || r() < 0.25; if (!poor && r() < 0.45) St.shutters = ['#3f6a8a', '#f4f1ea', '#4f7a5a', '#c66b45'][(r() * 4) | 0];
  H.miaKind = poor ? 'poor' : 'bungalow';
  // lote: quintal da frente até a calçada
  const n = H.doorN, t = [-n[1], n[0]], hw = (Math.abs(n[0]) ? H.y1 - H.y0 : H.x1 - H.x0) / 2 + 1.5;
  let ext = 0; while (ext < 8 && roadDist(H.doorPt[0] + n[0] * ext, H.doorPt[1] + n[1] * ext) > ROAD_W + SIDE - 0.1) ext += 0.5;
  const back = (Math.abs(n[0]) ? H.x1 - H.x0 : H.y1 - H.y0) + 2.5;
  const q = miaQuad(H.doorPt[0] - n[0] * back, H.doorPt[1] - n[1] * back, n, t, hw, back + ext - 0.3);
  const lot = [Math.min(...q.map(p => p[0])), Math.min(...q.map(p => p[1])), Math.max(...q.map(p => p[0])), Math.max(...q.map(p => p[1]))];
  world.yards.push(lot); rects.push(lot);
  miaDecal(q, poor ? 'dirtyard' : 'lawn', r, { dir: Math.abs(n[0]) ? 1 : 0, ragged: !poor && r() < 0.3 });
  const gx = H.doorPt[0] + n[0] * (ext - 0.3), gy = H.doorPt[1] + n[1] * (ext - 0.3);
  const gate = (x, y) => Math.hypot(x - gx, y - gy) < 1.4 || (poor && r() < 0.06);
  if (poor) {
    for (const [a, b] of [[q[0], q[1]], [q[1], q[2]], [q[2], q[3]], [q[3], q[0]]]) chainLine(a[0], a[1], b[0], b[1], gate, { rust: true, h: 1.5 });
    miaJunk(H, lot, r);
    St.boarded = r() < 0.75; St.aging = 1;
    if (r() < 0.35) { const jx = lot[0] + 2.5 + r() * (lot[2] - lot[0] - 5), jy = lot[1] + 2.5 + r() * (lot[3] - lot[1] - 5); if (!(jx > H.x0 - 3 && jx < H.x1 + 3 && jy > H.y0 - 3 && jy < H.y1 + 3)) miaCar(jx, jy, r() * 3, { junk: true, col: ['#8a6a4a', '#6f7a7e', '#9a8a6a', '#7a4a3a'][(r() * 4) | 0] }); }
    for (let i = 0; i < 14; i++) { const lx = lot[0] + r() * (lot[2] - lot[0]), ly = lot[1] + r() * (lot[3] - lot[1]); if (lx > H.x0 && lx < H.x1 && ly > H.y0 && ly < H.y1) continue; const u = r(); urbanLife.litter.push({ kind: u < 0.3 ? 'can' : u < 0.55 ? 'bottle' : u < 0.8 ? 'paper' : 'wrapper', x: lx, y: ly, variant: (r() * 3) | 0, a: r() * TAU, s: 1.3 + r() * 0.5 }); }
  } else {
    // entrada de carro em concreto ao lado da casa + carro de dono nenhum: só a mancha de óleo
    const dx = H.doorPt[0] + t[0] * (hw - 1.4), dy = H.doorPt[1] + t[1] * (hw - 1.4);
    miaDecal(miaQuad(dx - n[0] * 3, dy - n[1] * 3, n, t, 1.3, ext + 3), 'driveway', r);
    const dgap = (x, y) => gate(x, y) || Math.hypot(x - dx - n[0] * ext, y - dy - n[1] * ext) < 1.8, fc = r();
    if (fc < 0.4) for (const [a, b] of [[q[0], q[1]], [q[1], q[2]], [q[2], q[3]], [q[3], q[0]]]) chainLine(a[0], a[1], b[0], b[1], dgap, { h: 1.1 });
    else if (fc < 0.7) miaHedgeRun(q[2][0], q[2][1], q[3][0], q[3][1], dgap, 0.8);
    if (ext > 4 && r() < 0.8) miaCar(dx + n[0] * (ext * 0.5 - 0.6), dy + n[1] * (ext * 0.5 - 0.6), Math.atan2(n[1], n[0]));
    { const mx = H.doorPt[0] + n[0] * (ext - 0.5) - t[0] * 1.6, my = H.doorPt[1] + n[1] * (ext - 0.5) - t[1] * 1.6; if (!miaBlocked(mx, my, 0.3)) { addBox({ x: mx, y: my, w: 0.12, d: 0.12, h: 1.05, top: '#e9e5dc', side: '#d6d1c6', kind: 'post' }); addBox({ x: mx, y: my, z: 1.05, w: 0.48, d: 0.24, h: 0.26, rot: Math.atan2(n[1], n[0]), top: ['#2b4f7a', '#1f1f1f', '#e9e5dc'][(r() * 3) | 0], side: '#3a3a3a', kind: 'mailbox', solid: false }); } }
    miaShrubs(H, ['hibiscus', 'croton', 'bougainvillea'], 3 + ((r() * 3) | 0), r);
    if (r() < 0.6) { const px = H.doorPt[0] - t[0] * (hw - 1.2) + n[0] * (ext - 1.5), py = H.doorPt[1] - t[1] * (hw - 1.2) + n[1] * (ext - 1.5); if (!miaBlocked(px, py, 0.6)) miaPalm(px, py, 'coconut'); }
  }
  owWalk(H);
  owIndexOwnedLive(S);
  return H;
}

// quintal da favela: pneus, colchão velho, carrinho de mercado, sacos de lixo, tanque de lavar
function miaJunk(H, lot, r) {
  for (let i = 0, n = 6 + ((r() * 4) | 0); i < n; i++) {
    const x = lot[0] + 0.8 + r() * (lot[2] - lot[0] - 1.6), y = lot[1] + 0.8 + r() * (lot[3] - lot[1] - 1.6);
    if (x > H.x0 - 0.8 && x < H.x1 + 0.8 && y > H.y0 - 0.8 && y < H.y1 + 0.8) continue;
    if (miaBlocked(x, y, 0.5)) continue;
    const u = r();
    if (u < 0.3) addBox({ x, y, w: 0.7, d: 0.7, h: 0.22, top: '#1f1f21', side: '#2a2a2c', kind: 'tire', solid: false, draw: drawTire });
    else if (u < 0.5) addBox({ x, y, w: 1.9, d: 1.4, h: 0.2, rot: r() * 3, top: '#c9b9a0', side: '#a08a6c', kind: 'mattress', solid: false });
    else if (u < 0.75) addBox({ x, y, w: 0.6, d: 0.6, h: 0.55, rot: r() * 3, top: '#1e1f22', side: '#2b2c30', kind: 'trashbag', solid: false, draw: drawTrashBag });
    else addBox({ x, y, w: 0.9, d: 0.6, h: 0.9, rot: r() * 3, top: '#c8ccd0', side: '#9aa0a6', kind: 'tank' });
  }
}

// ---------- pequenos objetos com desenho próprio ----------
function drawTire(g, b) {
  const c = proj(b.x, b.y, 0.12), rx = b.w / 2 * cam.zoom, ry = rx * TILT;
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(c.x + 2, c.y + 3, rx, ry, 0, 0, TAU); g.fill();
  g.fillStyle = '#1c1c1e'; g.beginPath(); g.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); g.fill();
  g.fillStyle = '#3a3a3d'; g.beginPath(); g.ellipse(c.x, c.y - 1, rx * 0.95, ry * 0.9, 0, Math.PI, TAU); g.fill();
  g.fillStyle = '#5a4a36'; g.beginPath(); g.ellipse(c.x, c.y, rx * 0.5, ry * 0.5, 0, 0, TAU); g.fill();
}
function drawTrashBag(g, b) {
  const c = proj(b.x, b.y, 0), Z = cam.zoom;
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(c.x + 2, c.y + 1, Z * 0.34, Z * 0.15, 0, 0, TAU); g.fill();
  const gr = g.createRadialGradient(c.x - Z * 0.1, c.y - Z * 0.35, 1, c.x, c.y - Z * 0.2, Z * 0.4); gr.addColorStop(0, '#55585e'); gr.addColorStop(1, '#141518');
  g.fillStyle = gr; g.beginPath(); g.ellipse(c.x, c.y - Z * 0.2, Z * 0.32, Z * 0.26, 0, 0, TAU); g.fill();
  g.fillStyle = '#141518'; g.beginPath(); g.moveTo(c.x - Z * 0.06, c.y - Z * 0.42); g.lineTo(c.x + Z * 0.06, c.y - Z * 0.42); g.lineTo(c.x, c.y - Z * 0.55); g.fill();
}
function miaDumpster(x, y, rot) {
  addBox({ x, y, w: 1.9, d: 1.2, h: 1.2, rot, top: '#2f5a3a', side: '#244a2e', kind: 'dumpster', draw: drawDumpster });
}
function drawDumpster(g, b) {
  const o = Object.assign({}, b, { draw: null }); drawBox(g, o);
  const P = (u, v, z) => { const c = Math.cos(b.rot), s = Math.sin(b.rot); return proj(b.x + u * c - v * s, b.y + u * s + v * c, z); };
  poly(g, [P(-0.95, -0.6, 1.2), P(0.95, -0.6, 1.2), P(0.95, -0.6, 1.5), P(-0.95, -0.6, 1.32)], '#3a6b46', 'rgba(20,20,20,0.6)', 1);   // tampa aberta
  g.fillStyle = 'rgba(240,240,230,0.7)'; const a = P(0, 0.61, 0.8); g.fillRect(a.x - 6, a.y - 2, 12, 3);
}
function miaCafeTable(x, y, col) {
  if (miaBlocked(x, y, 0.5)) return;
  addBox({ x, y, w: 0.7, d: 0.7, h: 0.74, top: '#f2f0ea', side: '#9aa0a6', kind: 'cafe', solid: false, accent: col, draw: drawCafeTable });
}
function drawCafeTable(g, b) {
  const base = proj(b.x, b.y, 0), top = proj(b.x, b.y, 0.74), Z = cam.zoom;
  for (const [dx, dy] of [[0.55, 0], [-0.55, 0]]) { const c = proj(b.x + dx, b.y + dy, 0.45); g.fillStyle = '#5a5f66'; g.fillRect(c.x - Z * 0.16, c.y - Z * 0.05, Z * 0.32, Z * 0.1); g.fillRect(c.x - 1, c.y, 2, Z * 0.38); }
  g.strokeStyle = '#6b7076'; g.lineWidth = Math.max(1, Z * 0.04); g.beginPath(); g.moveTo(base.x, base.y); g.lineTo(top.x, top.y); g.stroke();
  g.fillStyle = '#f2f0ea'; g.beginPath(); g.ellipse(top.x, top.y, Z * 0.36, Z * 0.36 * TILT, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.stroke();
  // guarda-sol
  const pole = proj(b.x, b.y, 2.3), r = Z * 1.1;
  g.strokeStyle = '#d8d8d2'; g.beginPath(); g.moveTo(top.x, top.y); g.lineTo(pole.x, pole.y); g.stroke();
  for (let i = 0; i < 8; i++) { const a0 = i / 8 * TAU, a1 = (i + 1) / 8 * TAU; g.fillStyle = i % 2 ? b.accent : '#f7f5ef'; g.beginPath(); g.moveTo(pole.x, pole.y - Z * 0.15); g.lineTo(pole.x + Math.cos(a0) * r, pole.y + Math.sin(a0) * r * TILT + Z * 0.25); g.lineTo(pole.x + Math.cos(a1) * r, pole.y + Math.sin(a1) * r * TILT + Z * 0.25); g.fill(); }
}

// cerca viva (fícus aparado): caixas verdes com folhagem salpicada
function miaHedgeRect(lot, gap, low) {
  const [x0, y0, x1, y1] = lot, h = low ? 0.9 : 1.7, run = (ax, ay, bx, by) => miaHedgeRun(ax, ay, bx, by, gap, h);
  run(x0, y0, x1, y0); run(x0, y1, x1, y1); run(x0, y0, x0, y1); run(x1, y0, x1, y1);
}
function miaHedgeRun(ax, ay, bx, by, gap, h) {
  {
    const len = Math.round(Math.hypot(bx - ax, by - ay)), dx = (bx - ax) / len, dy = (by - ay) / len;
    let s0 = null;
    const flush = i => { if (s0 === null) return; const l = i - s0; if (l > 0) addBox({ x: ax + dx * (s0 + l / 2), y: ay + dy * (s0 + l / 2), w: l, d: 0.8, rot: Math.atan2(dy, dx), h, top: '#3f6f2e', side: '#2d5522', kind: 'hedge', seed: (ax * 7 + ay * 13 + s0) | 0, draw: drawHedge }); s0 = null; };
    for (let i = 0; i < len; i++) { const mx = ax + dx * (i + 0.5), my = ay + dy * (i + 0.5), bad = gap(mx, my) || onRoad(mx, my); if (bad) flush(i); else if (s0 === null) s0 = i; }
    flush(len);
  }
}
// desenho em cache: refeito só quando a câmera gira ou muda o zoom (mover a câmera só translada a imagem)
function miaCached(g, b, paint) {
  const key = cam.ang.toFixed(4) + '|' + cam.zoom.toFixed(3), base = proj(b.x, b.y, 0);
  if (b._ck !== key) {
    const c = boxCorners(b), pts = [];
    for (const q of c) for (const z of [0, b.h + 0.3]) pts.push(proj(q[0], q[1], z));
    const m = cam.zoom * 0.3, x0 = Math.floor(Math.min(...pts.map(p => p.x)) - m), y0 = Math.floor(Math.min(...pts.map(p => p.y)) - m);
    const w = Math.ceil(Math.max(...pts.map(p => p.x)) + m) - x0, h = Math.ceil(Math.max(...pts.map(p => p.y)) + m) - y0;
    const cv = b._cv && b._cv.width >= w && b._cv.height >= h ? b._cv : makeCanvas(w, h), cg = cv.getContext('2d');
    cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, cv.width, cv.height); cg.translate(-x0, -y0); paint(cg);
    b._cv = cv; b._ck = key; b._off = [x0 - base.x, y0 - base.y];
  }
  g.drawImage(b._cv, base.x + b._off[0], base.y + b._off[1]);
}
function drawHedge(g, b) { miaCached(g, b, cg => paintHedge(cg, b)); }
function paintHedge(g, b) {
  const o = b._plain || (b._plain = Object.assign({}, b, { draw: null, top: '#4a7a34', side: '#2f5a24' })); drawBox(g, o);
  if (!b.h) b = o;
  // folhagem: tufos arredondados no topo e nas faces visíveis, sombreados de baixo p/ cima
  const r = mulberry(b.seed >>> 0), Z = cam.zoom, cnt = Math.min(220, (b.w + b.d) * (b.h + 0.6) * 14);
  const c = boxCorners(b);
  for (let i = 0; i < cnt; i++) {
    const onTop = r() < 0.4, u = r(), v = r(), k = (r() * 4) | 0;
    let x, y, z;
    if (onTop) { x = lerp(lerp(c[0][0], c[1][0], u), lerp(c[3][0], c[2][0], u), v); y = lerp(lerp(c[0][1], c[1][1], u), lerp(c[3][1], c[2][1], u), v); z = b.h; }
    else { const p = c[k], q = c[(k + 1) % 4], nx = q[1] - p[1], ny = -(q[0] - p[0]); if (facingCam(nx, ny) <= 0) continue; x = lerp(p[0], q[0], u); y = lerp(p[1], q[1], u); z = b.h * (0.08 + v * 0.92); }
    const p = proj(x, y, z + (b.z || 0)), lit = onTop ? 0.75 + r() * 0.35 : 0.35 + z / b.h * 0.5 + r() * 0.15, s = Z * (0.07 + r() * 0.07);
    g.fillStyle = `rgb(${(58 * lit + 10) | 0},${(104 * lit + 14) | 0},${(40 * lit + 6) | 0})`;
    g.beginPath(); g.ellipse(p.x, p.y, s, s * 0.7, 0, 0, TAU); g.fill();
  }
  // sombra de contato na base
  const a0 = proj(c[0][0], c[0][1], 0.05), a1 = proj(c[1][0], c[1][1], 0.05), a2 = proj(c[2][0], c[2][1], 0.05), a3 = proj(c[3][0], c[3][1], 0.05);
  g.strokeStyle = 'rgba(15,30,10,0.45)'; g.lineWidth = Math.max(1, Z * 0.05); g.beginPath(); g.moveTo(a0.x, a0.y); g.lineTo(a1.x, a1.y); g.lineTo(a2.x, a2.y); g.lineTo(a3.x, a3.y); g.closePath(); g.stroke();
}

// ---------- carros estacionados (caixas em perspectiva: carroceria, cabine de vidro, rodas, sombra) ----------
const MIA_CARS = ['#ecebe7', '#c3c6c9', '#1f2124', '#35507a', '#9c2a24', '#d9cfb4', '#2f7f86', '#7c8288', '#ecebe7', '#c3c6c9', '#b5832e', '#55606b'];
function miaCar(x, y, rot, opt = {}) {
  if (miaBlocked(x, y, 1.3)) return null;
  const col = opt.col || MIA_CARS[(rng() * MIA_CARS.length) | 0];
  return addBox({ x, y, w: 4.4, d: 1.85, h: 1.5, rot, top: col, side: col, kind: 'parkedcar', col, junk: !!opt.junk, suv: rng() < 0.35, draw: drawParkedCar });
}
function drawParkedCar(g, b) { miaCached(g, b, cg => paintCar(cg, b)); }
function paintCar(g, b) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), Z = cam.zoom, P = (u, v, z) => proj(b.x + u * c - v * s, b.y + u * s + v * c, z);
  const L = 2.2, W = 0.9, hb = b.suv ? 0.7 : 0.48, zc = 0.3 + hb, hc = b.suv ? 0.6 : 0.42;
  poly(g, [P(-L, -W, 0), P(L, -W, 0), P(L + 0.4, W + 0.3, 0), P(-L + 0.4, W + 0.3, 0)], 'rgba(10,12,14,0.32)', null);
  if (!b.junk) for (const [u, v] of [[-1.35, -W], [1.35, -W], [-1.35, W], [1.35, W]]) { const p = P(u, v, 0.33); g.fillStyle = '#141414'; g.beginPath(); g.ellipse(p.x, p.y, Z * 0.33, Z * 0.3, 0, 0, TAU); g.fill(); g.fillStyle = '#8d9196'; g.beginPath(); g.ellipse(p.x, p.y, Z * 0.13, Z * 0.12, 0, 0, TAU); g.fill(); }
  const body = b.junk ? shadeHex(b.col, 0.8) : b.col;
  drawBox(g, { x: b.x, y: b.y, z: b.junk ? 0.05 : 0.3, w: 2 * L, d: 2 * W, h: hb, rot: b.rot, top: body, side: shadeHex(body, 0.86) });
  const cx = b.x - c * 0.25, cy = b.y - s * 0.25, z0 = b.junk ? zc - 0.25 : zc;
  // cabine em tronco de pirâmide: teto menor que a base (para-brisa e vigia inclinados)
  const cl = b.suv ? 1.45 : 1.15, tl = b.suv ? 1.25 : 0.75, cw = W - 0.1, tw = W - 0.22, zt = z0 + hc;
  const cq = [[-cl, -cw, z0], [cl, -cw, z0], [cl, cw, z0], [-cl, cw, z0]], tq = [[-tl - 0.15, -tw, zt], [tl - 0.15, -tw, zt], [tl - 0.15, tw, zt], [-tl - 0.15, tw, zt]];
  const C = (q) => P(q[0] - 0.25, q[1], q[2]);
  for (let i = 0; i < 4; i++) { const a = cq[i], bb = cq[(i + 1) % 4], nx = (bb[1] - a[1]) * c + (bb[0] - a[0]) * -s, ny = 0; const mid = [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2];
    const wx = mid[0] * c - mid[1] * s, wy = mid[0] * s + mid[1] * c; if (facingCam(wx, wy) <= 0) continue;
    poly(g, [C(a), C(bb), C(tq[(i + 1) % 4]), C(tq[i])], b.junk ? '#3a3a36' : (i % 2 ? '#2f3d48' : '#3b4b58'), 'rgba(15,15,15,0.7)', 1); }
  poly(g, tq.map(C), body, 'rgba(15,15,15,0.7)', 1);
  // reflexo no para-brisa, faróis e lanternas
  const ws0 = P(0.9, -W + 0.1, z0 + hc * 0.85), ws1 = P(0.9, W - 0.1, z0 + hc * 0.85);
  g.strokeStyle = 'rgba(220,235,245,0.45)'; g.lineWidth = Math.max(1, Z * 0.04); g.beginPath(); g.moveTo(ws0.x, ws0.y); g.lineTo(ws1.x, ws1.y); g.stroke();
  for (const v of [-0.6, 0.6]) { const f = P(L, v, 0.75), r = P(-L, v, 0.75); g.fillStyle = '#f3efd8'; g.fillRect(f.x - 1.5, f.y - 1, 3, 2); g.fillStyle = '#b3201c'; g.fillRect(r.x - 1.5, r.y - 1, 3, 2); }
  if (b.junk) { g.fillStyle = 'rgba(120,70,30,0.45)'; for (let i = 0; i < 6; i++) { const p = P(-L + (i * 0.73) % (2 * L), -W + ((i * 0.37) % 1) * 2 * W, 0.35 + hb); g.fillRect(p.x, p.y, Z * 0.25, Z * 0.12); } }
}
// banco de praça, lixeira, frade (balizador) e floreira
function miaBench(x, y, rot) { if (CityStreetLayout.verge(x, y, .85, roadDist, ROAD_W, SIDE) && !miaBlocked(x, y, 0.8)) addBox({ x, y, w: 1.8, d: 0.6, h: 0.85, rot, top: '#6b4a32', side: '#3a3f44', kind: 'bench', draw: drawBench }); }
function drawBench(g, b) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), P = (u, v, z) => proj(b.x + u * c - v * s, b.y + u * s + v * c, z), Z = cam.zoom;
  g.strokeStyle = '#2c3034'; g.lineWidth = Math.max(1.2, Z * 0.05);
  for (const u of [-0.75, 0.75]) { const a = P(u, 0.2, 0), t = P(u, 0.2, 0.45), bk = P(u, -0.25, 0.85); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(t.x, t.y); g.lineTo(bk.x, bk.y); g.stroke(); }
  for (let k = 0; k < 3; k++) poly(g, [P(-0.9, -0.25 + k * 0.17, 0.45), P(0.9, -0.25 + k * 0.17, 0.45), P(0.9, -0.12 + k * 0.17, 0.45), P(-0.9, -0.12 + k * 0.17, 0.45)], k % 2 ? '#7a5638' : '#8a6444', 'rgba(30,20,10,0.5)', 0.8);
  for (let k = 0; k < 2; k++) poly(g, [P(-0.9, -0.28, 0.58 + k * 0.15), P(0.9, -0.28, 0.58 + k * 0.15), P(0.9, -0.28, 0.69 + k * 0.15), P(-0.9, -0.28, 0.69 + k * 0.15)], '#7a5638', 'rgba(30,20,10,0.5)', 0.8);
}
function miaPlanter(x, y) {
  if (!CityStreetLayout.verge(x, y, .9, roadDist, ROAD_W, SIDE) || miaBlocked(x, y, 0.9)) return;
  addBox({ x, y, w: 1.4, d: 1.4, h: 0.55, top: '#cfc9bd', side: '#b1aa9c', kind: 'planter', seed: (x * 31 + y * 17) | 0, draw: (g, b) => miaCached(g, Object.assign(b, { h: 1.3 }), cg => { drawBox(cg, { x: b.x, y: b.y, z: 0, w: 1.4, d: 1.4, h: 0.55, rot: 0, top: '#5c4632', side: '#b9b2a4' }); paintHedge(cg, { x: b.x, y: b.y, z: 0.55, w: 1.1, d: 1.1, h: 0.0, rot: 0, seed: b.seed, top: '#4a7a34', side: '#2f5a24', _plain: { x: b.x, y: b.y, z: 0.55, w: 1.1, d: 1.1, h: 0.45, rot: 0, top: '#4a7a34', side: '#2f5a24' } }); }) });
}
function miaBollard(x, y) { if (CityStreetLayout.edgeFixture(x, y, .3, roadDist, ROAD_W) && !miaBlocked(x, y, 0.3)) addBox({ x, y, w: 0.22, d: 0.22, h: 0.9, top: '#9a9b97', side: '#6f706c', kind: 'bollard' }); }
function miaCan(x, y) { if (CityStreetLayout.verge(x, y, .4, roadDist, ROAD_W, SIDE) && !miaBlocked(x, y, 0.4)) addBox({ x, y, w: 0.6, d: 0.6, h: 0.95, top: '#2d3a2f', side: '#3e4c40', kind: 'trashcan' }); }

// ---------- palmeiras e arbustos ----------
function miaPalm(x, y, kind, pit) {
  if (!CityStreetLayout.verge(x, y, .36, roadDist, ROAD_W, SIDE) || miaBlocked(x, y, .45)) return null;
  const pool = MIA.palms[kind], sp = pool[(rng() * pool.length) | 0];
  const t = { type: 'tree', x, y, sp, hit: 0, phase: rng() * 6, scale: 0.78 + rng() * 0.42 };
  world.props.push(t); owAddCircle({ x, y, r: 0.25, kind: 'tree', ref: t, h: 8 });
  owTreeShadow(x, y, sp);
  if (pit) miaDecal([[x - 0.7, y - 0.7], [x + 0.7, y - 0.7], [x + 0.7, y + 0.7], [x - 0.7, y + 0.7]], 'pit', null);
  return t;
}
function miaBush(x, y, kind) {
  if (!CityStreetLayout.verge(x, y, .3, roadDist, ROAD_W, SIDE)) return null;
  const pool = MIA.bush[kind], s = pool[(rng() * pool.length) | 0];
  world.props.push({ type: 'bush', x, y, sp: s, phase: rng() * 6 });
  owAddCircle({ x, y, r: s.r * 0.6, kind: 'bush', soft: true }); bakeShadow(x, y, s.r, s.r * 0.6, 1);
}
// canteiros junto às paredes da casa (menos na frente da porta)
function miaShrubs(H, kinds, n, r) {
  for (let i = 0, tries = 0; i < n && tries < 40; tries++) {
    const k = ['N', 'S', 'W', 'E'][(r() * 4) | 0], sd = H.sides[k], u = 0.8 + r() * (sd.len - 1.6);
    const x = sd.a[0] + sd.dir[0] * u + sd.n[0] * 1.0, y = sd.a[1] + sd.dir[1] * u + sd.n[1] * 1.0;
    if (Math.hypot(x - H.doorPt[0], y - H.doorPt[1]) < 2 || onRoad(x, y) || miaBlocked(x, y, 0.5)) continue;
    miaBush(x, y, kinds[(r() * kinds.length) | 0]); i++;
  }
}

// ---------- quadra de basquete com alambrado ----------
function miaCourt(S, cx, cy, along) {
  const L = 26, Wd = 15, w = along === 'x' ? L : Wd, d = along === 'x' ? Wd : L, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - d / 2), x1 = x0 + w, y1 = y0 + d;
  const [sx0, sy0, sx1, sy1] = S.bounds;
  if (x0 < sx0 + 2 || y0 < sy0 + 2 || x1 > sx1 - 2 || y1 > sy1 - 2) return false;
  for (let y = y0 - 1; y <= y1 + 1; y += 2) for (let x = x0 - 1; x <= x1 + 1; x += 2) if (onRoad(x, y) || pondVal(x, y) < 1.3 || miaBlocked(x, y, 0.3)) return false;
  world.yards.push([x0, y0, x1, y1]);
  miaDecal([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 'court', null, { along });
  const gate = (x, y) => Math.hypot(x - (along === 'x' ? cx : x0), y - (along === 'x' ? y1 : cy)) < 1.2;
  chainLine(x0, y0, x1, y0, gate, { h: 3.2 }); chainLine(x0, y1, x1, y1, gate, { h: 3.2 }); chainLine(x0, y0, x0, y1, gate, { h: 3.2 }); chainLine(x1, y0, x1, y1, gate, { h: 3.2 });
  for (const s of [-1, 1]) { const hx = along === 'x' ? cx + s * (L / 2 - 1.2) : cx, hy = along === 'x' ? cy : cy + s * (L / 2 - 1.2); addBox({ x: hx, y: hy, w: 0.3, d: 0.3, h: 3.05, top: '#56595c', side: '#3e4144', kind: 'hoop', draw: drawHoop, face: along === 'x' ? [-s, 0] : [0, -s] }); }
  return true;
}
function drawHoop(g, b) {
  const a = proj(b.x, b.y, 0), t = proj(b.x, b.y, 3.05), Z = cam.zoom;
  g.strokeStyle = '#3e4144'; g.lineWidth = Math.max(2, Z * 0.1); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(t.x, t.y); g.stroke();
  const f = b.face, bb = [-f[1], f[0]], P = (u, z) => proj(b.x + f[0] * 0.5 + bb[0] * u, b.y + f[1] * 0.5 + bb[1] * u, z);
  poly(g, [P(-0.9, 2.9), P(0.9, 2.9), P(0.9, 3.95), P(-0.9, 3.95)], 'rgba(240,240,236,0.92)', '#2a2a2a', 1);
  poly(g, [P(-0.3, 3.0), P(0.3, 3.0), P(0.3, 3.45), P(-0.3, 3.45)], null, '#c0392b', 1.5);
  const rim = proj(b.x + f[0] * 0.75, b.y + f[1] * 0.75, 3.05); g.strokeStyle = '#e0672b'; g.lineWidth = 2; g.beginPath(); g.ellipse(rim.x, rim.y, Z * 0.23, Z * 0.23 * TILT, 0, 0, TAU); g.stroke();
}

// ---------- praia: postos de salva-vidas, guarda-sóis, espreguiçadeiras, toalhas, coqueiros ----------
function miaBeach(S) {
  const [x0, y0] = S.bounds, R = mulberry(owSeed(S, 'beach')), taken = [];
  const free = (x, y, r) => !onRoad(x, y) && !miaBlocked(x, y, r) && taken.every(t => Math.hypot(t[0] - x, t[1] - y) > t[2] + r);
  const pts = [];   // faixa de areia amostrada a cada 3 m
  for (let y = y0 + 3; y < y0 + S.SP - 3; y += 3) for (let x = x0 + 3; x < x0 + S.SP - 3; x += 3) { const pv = pondVal(x, y); if (pv > 1.0 && pv < 1.75) pts.push([x, y, pv]); }
  if (pts.length < 20) return;
  const pick = (a, b) => { for (let i = 0; i < 40; i++) { const q = pts[(R() * pts.length) | 0]; if (q[2] >= a && q[2] <= b) return q; } return null; };
  // 1. postos de salva-vidas (~1 a cada 120 m), virados p/ o mar
  for (let i = 0; i < 3; i++) {
    const q = pick(1.16, 1.26); if (!q || !free(q[0], q[1], 6) || taken.some(t => t[3] && Math.hypot(t[0] - q[0], t[1] - q[1]) < 110)) continue;
    addBox({ x: q[0], y: q[1], w: 4.4, d: 4.4, h: 6, top: '#f2f0ea', side: '#e8c33a', kind: 'lifeguard', col: ['#f2a7c3', '#7fd3c8', '#f4d35e', '#9bc1f0', '#f7a072', '#c3a6e8'][(R() * 6) | 0], col2: '#fbfaf6', draw: drawLifeguard, face: miaSeaDir(q[0], q[1]) });
    taken.push([q[0], q[1], 6, true]);
  }
  // 2. grupos de guarda-sóis perto da água (2–6 conjuntos em fila irregular)
  const groups = [];
  for (let gi = 0; gi < 50 && groups.length < 16; gi++) {
    const q = pick(1.09, 1.4); if (!q || world.districtFn(q[0], q[1]) !== D_.BEACH || groups.some(g2 => Math.hypot(g2[0] - q[0], g2[1] - q[1]) < 17)) continue;
    groups.push(q);
    const f = miaSeaDir(q[0], q[1]), t = [-f[1], f[0]], n = 5 + ((R() * 6) | 0);
    for (let k = 0; k < n; k++) {
      const u = (k % 4 - 1.5) * (2.9 + R() * 0.6), v = ((k / 4) | 0) * 3.4 + (R() - 0.5) * 0.8, x = q[0] + t[0] * u + f[0] * v, y = q[1] + t[1] * u + f[1] * v;
      if (pondVal(x, y) < 1.07 || world.districtFn(x, y) !== D_.BEACH || !free(x, y, 1.7)) continue;
      miaUmbrellaSet(x, y, f, R); taken.push([x, y, 1.7]);
    }
    // gente em pé na água rasa em frente ao grupo (e às vezes alguém nadando mais longe)
    if (R() < 0.75) {
      let wx = q[0], wy = q[1], s2 = 0; while (s2++ < 60 && pondVal(wx, wy) > 0.94) { wx += f[0] * 0.5; wy += f[1] * 0.5; }
      for (let k = 0, m = 1 + ((R() * 3) | 0); k < m; k++) {
        const u = (R() - 0.5) * 7, v = R() * 2.5, x = wx + t[0] * u + f[0] * v, y = wy + t[1] * u + f[1] * v, pv = pondVal(x, y);
        if (pv > 0.97 || pv < 0.8 || x < x0 + 1 || y < y0 + 1 || x > x0 + S.SP - 1 || y > y0 + S.SP - 1) continue;
        addBox({ x, y, w: 0.5, d: 0.5, h: 1.2, kind: 'wader', solid: false, swim: R() < 0.25, face: R() * TAU, skin: ['#e9c3a0', '#c68e63', '#8d5a3b', '#f1d2b6'][(R() * 4) | 0], suit: ['#e8364f', '#1f2a44', '#f5c518', '#2b8be6', '#2ec46b', '#ff8fb1'][(R() * 6) | 0], hair: ['#3a2a1e', '#1a1410', '#8a5a2a', '#d9b46a'][(R() * 4) | 0], draw: drawWader });
      }
    }
  }
  // 3. linha de sargaço na marca da maré e trilhas de pegadas até a água
  for (const [x, y, pv] of pts) if (pv > 1.03 && pv < 1.06 && R() < 0.4) {
    const f = miaSeaDir(x, y), t = [-f[1], f[0]], l = 0.8 + R() * 1.6;
    world.decals.push({ kind: 'wrack', x, y, t, l, seed: (x * 7 + y * 13) | 0, bb: [x - l, y - l, x + l, y + l], paint: paintWrack });
  }
  for (let i = 0; i < 5; i++) {
    const q = pick(1.35, 1.7); if (!q) continue;
    const trail = []; let x = q[0], y = q[1], a = 0;
    for (let k = 0; k < 40 && pondVal(x, y) > 1.01; k++) { const f = miaSeaDir(x, y); a += (R() - 0.5) * 0.5; const ca = Math.cos(a), sa = Math.sin(a); const dx = f[0] * ca - f[1] * sa, dy = f[0] * sa + f[1] * ca; trail.push([x, y, Math.atan2(dy, dx)]); x += dx * 0.75; y += dy * 0.75; }
    if (trail.length > 6) { const xs = trail.map(p => p[0]), ys = trail.map(p => p[1]); world.decals.push({ kind: 'steps', trail, bb: [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1], paint: paintSteps }); }
  }
  // 4. rede de vôlei
  for (let vi = 0; vi < 2; vi++) { const q = pick(1.25, 1.45); if (q && world.districtFn(q[0], q[1]) === D_.BEACH && free(q[0], q[1], 7)) { const f = miaSeaDir(q[0], q[1]); addBox({ x: q[0], y: q[1], w: 0.2, d: 0.2, h: 2.5, kind: 'volley', face: f, solid: false, draw: drawVolley }); miaDecal(miaQuad(q[0] - f[0] * 8, q[1] - f[1] * 8, f, [-f[1], f[0]], 4.5, 16), 'vbcourt', null); taken.push([q[0], q[1], 9]); } }
  // 5. restinga: cerca de ripas na duna com passagens, capim-da-praia, coqueiros, uva-da-praia e lixeiras
  let fi = 0;
  for (const [x, y, pv] of pts) {
    if (Math.abs(pv - 1.5) < 0.025 && !onRoad(x, y) && world.districtFn(x, y) === D_.BEACH) {
      fi++; if (fi % 5 === 0) continue;   // passagem p/ a areia
      const f = miaSeaDir(x, y), t = [-f[1], f[0]];
      const sg = { x1: x - t[0] * 1.3, y1: y - t[1] * 1.3, x2: x + t[0] * 1.3, y2: y + t[1] * 1.3, nx: f[0], ny: f[1], h: 1.0, kind: 'fence', rural: true, woodSeed: fi * 37 };
      fences.push(sg); world.segs.push(sg);
      for (let k = 0; k < 3; k++) world.props.push({ type: 'tuft', x: x - f[0] * (0.6 + R() * 2) + t[0] * (R() - 0.5) * 3, y: y - f[1] * (0.6 + R() * 2) + t[1] * (R() - 0.5) * 3, sp: OW.pools.tufts[(R() * OW.pools.tufts.length) | 0], phase: R() * 6, flat: true });
      if (fi % 13 === 3) miaCan(x - f[0] * 1.6, y - f[1] * 1.6);
    } else if (pv > 1.36 && R() < 0.035 && free(x, y, 1.5)) { miaPalm(x, y, 'coconut'); taken.push([x, y, 1.5]); }
    else if (pv > 1.45 && R() < 0.03 && free(x, y, 1.2)) miaBush(x, y, 'seagrape');
  }
}
function miaUmbrellaSet(x, y, f, R) {
  const col = ['#e8364f', '#2b8be6', '#f5c518', '#2ec46b', '#ff7f50', '#1abc9c', '#f39c12'][(R() * 7) | 0], t = [-f[1], f[0]], rot = Math.atan2(f[1], f[0]);
  addBox({ x, y, w: 0.3, d: 0.3, h: 2.2, top: col, side: col, kind: 'umbrella', solid: false, col, col2: R() < 0.5 ? '#ffffff' : col, draw: drawBeachUmbrella });
  for (const sg of [-1, 1]) if (R() < 0.85) addBox({ x: x + t[0] * sg * 0.75, y: y + t[1] * sg * 0.75, w: 1.95, d: 0.68, h: 0.8, rot, top: '#f4f2ec', side: '#cfcac0', kind: 'lounger', solid: false, pad: ['#2b8be6', '#f4f2ec', '#e8364f', '#1abc9c'][(R() * 4) | 0], draw: drawLounger });
  const tc = ['#e8364f', '#2b8be6', '#f5c518', '#ffffff', '#ff8fb1', '#1abc9c'][(R() * 6) | 0];
  miaDecal(miaQuad(x + f[0] * 1.3 + t[0] * 0.5, y + f[1] * 1.3 + t[1] * 0.5, f, t, 0.5, 1.8), 'towel', R, { col: tc });
  if (R() < 0.55) addBox({ x: x + f[0] * 2.2 + t[0] * 0.5, y: y + f[1] * 2.2 + t[1] * 0.5, w: 1.75, d: 0.5, h: 0.25, rot: Math.atan2(f[1], f[0]), kind: 'bather', solid: false, skin: ['#e9c3a0', '#c68e63', '#8d5a3b', '#f1d2b6'][(R() * 4) | 0], suit: ['#e8364f', '#1f2a44', '#f5c518', '#2b8be6', '#2ec46b'][(R() * 5) | 0], draw: drawBather });
  if (R() < 0.6) addBox({ x: x - t[0] * 0.9, y: y - t[1] * 0.9, w: 0.45, d: 0.3, h: 0.35, top: '#e9e5dc', side: ['#2b6fb8', '#c0392b', '#f5c518'][(R() * 3) | 0], kind: 'beachbag', solid: false });
  if (R() < 0.45) { const cs = 0.7 + R() * 0.6; addBox({ x: x - f[0] * 1.2 + t[0] * 1.6, y: y - f[1] * 1.2 + t[1] * 1.6, w: 0.6 * cs, d: 0.4 * cs, h: 0.4 * cs, rot: rot + (R() - 0.5), top: ['#f4f2ec', '#2b6fb8', '#e8e2d0'][(R() * 3) | 0], side: ['#2b6fb8', '#c0392b', '#2ec46b', '#f39c12', '#7f8c8d', '#f4f2ec'][(R() * 6) | 0], kind: 'cooler', solid: false }); }
  if (R() < 0.5) { const fx = x + f[0] * 0.4 - t[0] * 0.3, fy = y + f[1] * 0.4 - t[1] * 0.3, fc = ['#e8364f', '#2b8be6', '#f5c518', '#1f1f1f'][(R() * 4) | 0]; world.decals.push({ kind: 'flops', x: fx, y: fy, a: R() * TAU, col: fc, bb: [fx - 0.5, fy - 0.5, fx + 0.5, fy + 0.5], paint: (g, d) => { g.fillStyle = d.col; for (const o of [-0.09, 0.09]) { g.save(); g.translate(d.x + o, d.y); g.rotate(d.a); g.beginPath(); g.ellipse(0, 0, 0.13, 0.05, 0, 0, TAU); g.fill(); g.restore(); } } }); }
}
function drawBather(g, b) {   // banhista deitado de bruços na toalha
  const c = Math.cos(b.rot), s = Math.sin(b.rot), P = (u, z) => proj(b.x + u * c, b.y + u * s, z), Z = cam.zoom;
  const leg0 = P(0.85, 0.08), hip = P(0.1, 0.13), sh = P(-0.45, 0.15), head = P(-0.75, 0.16);
  g.lineCap = 'round'; g.strokeStyle = b.skin; g.lineWidth = Z * 0.16; g.beginPath(); g.moveTo(hip.x, hip.y); g.lineTo(leg0.x, leg0.y); g.stroke();
  g.strokeStyle = b.skin; g.lineWidth = Z * 0.3; g.beginPath(); g.moveTo(hip.x, hip.y); g.lineTo(sh.x, sh.y); g.stroke();
  g.strokeStyle = b.suit; g.lineWidth = Z * 0.31; const h0 = P(0.18, 0.14), h1 = P(-0.05, 0.14); g.beginPath(); g.moveTo(h0.x, h0.y); g.lineTo(h1.x, h1.y); g.stroke();
  g.fillStyle = b.skin; g.beginPath(); g.ellipse(head.x, head.y, Z * 0.12, Z * 0.11, 0, 0, TAU); g.fill();
  g.fillStyle = '#3a2a1e'; g.beginPath(); g.ellipse(head.x, head.y - Z * 0.03, Z * 0.11, Z * 0.07, 0, 0, TAU); g.fill();
}
function drawWader(g, b) {   // banhista com água pela cintura (ou nadando: só cabeça e um braço), com marola em volta
  const Z = cam.zoom, base = proj(b.x, b.y, 0), ca = Math.cos(b.face), sa = Math.sin(b.face);
  g.strokeStyle = 'rgba(245,250,248,0.75)'; g.lineWidth = Math.max(1, Z * 0.035);
  for (const k of [1, 1.7]) { g.beginPath(); g.ellipse(base.x, base.y, Z * 0.32 * k, Z * 0.32 * k * TILT, 0, 0, TAU); g.stroke(); }
  g.lineCap = 'round';
  if (b.swim) {
    const hd = proj(b.x, b.y, 0.1), arm = proj(b.x + ca * 0.5, b.y + sa * 0.5, 0.35);
    g.strokeStyle = b.skin; g.lineWidth = Z * 0.09; g.beginPath(); g.moveTo(hd.x, hd.y); g.lineTo(arm.x, arm.y); g.stroke();
    g.fillStyle = b.skin; g.beginPath(); g.ellipse(hd.x, hd.y, Z * 0.12, Z * 0.1, 0, 0, TAU); g.fill();
    g.fillStyle = b.hair; g.beginPath(); g.ellipse(hd.x, hd.y - Z * 0.03, Z * 0.12, Z * 0.07, 0, 0, TAU); g.fill();
    return;
  }
  const hip = proj(b.x, b.y, -0.05), sh = proj(b.x, b.y, 0.5), head = proj(b.x, b.y, 0.7);
  const shl = proj(b.x - sa * 0.2, b.y + ca * 0.2, 0.48), shr = proj(b.x + sa * 0.2, b.y - ca * 0.2, 0.48);
  const hl = proj(b.x - sa * 0.3 + ca * 0.1, b.y + ca * 0.3 + sa * 0.1, 0.12), hr = proj(b.x + sa * 0.32, b.y - ca * 0.32, 0.2);
  g.strokeStyle = b.skin; g.lineWidth = Z * 0.08;
  for (const [a, e] of [[shl, hl], [shr, hr]]) { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(e.x, e.y); g.stroke(); }
  g.lineWidth = Z * 0.3; g.beginPath(); g.moveTo(hip.x, hip.y); g.lineTo(sh.x, sh.y); g.stroke();
  if (b.seed === undefined) b.seed = (b.x * 7 + b.y * 3) | 0;
  if (b.seed & 1) { g.strokeStyle = b.suit; g.lineWidth = Z * 0.31; const t0 = proj(b.x, b.y, 0.36), t1 = proj(b.x, b.y, 0.44); g.beginPath(); g.moveTo(t0.x, t0.y); g.lineTo(t1.x, t1.y); g.stroke(); }
  g.fillStyle = b.skin; g.beginPath(); g.ellipse(head.x, head.y, Z * 0.12, Z * 0.11, 0, 0, TAU); g.fill();
  g.fillStyle = b.hair; g.beginPath(); g.ellipse(head.x, head.y - Z * 0.04, Z * 0.12, Z * 0.07, 0, 0, TAU); g.fill();
  // linha d'água por cima do quadril
  g.fillStyle = 'rgba(96,178,170,0.7)'; g.beginPath(); g.ellipse(base.x, base.y, Z * 0.26, Z * 0.26 * TILT, 0, 0, TAU); g.fill();
}
function paintWrack(g, d) {   // faixa contínua e irregular de sargaço que engrossa e afina, com conchas e gravetos
  const r = mulberry(d.seed >>> 0), N = 14, pts = [];
  for (let k = 0; k <= N; k++) { const u = (k / N - 0.5) * 2 * d.l; pts.push([d.x + d.t[0] * u + (r() - 0.5) * 0.25, d.y + d.t[1] * u + (r() - 0.5) * 0.25, 0.08 + Math.sin(k / N * Math.PI) * (0.18 + r() * 0.22)]); }
  for (const [col, k2] of [['rgba(70,66,34,0.55)', 1], ['rgba(96,84,46,0.5)', 0.6]]) {
    g.fillStyle = col; g.beginPath();
    pts.forEach(([x, y, w], i) => { const nx = -d.t[1], ny = d.t[0]; i ? g.lineTo(x + nx * w * k2, y + ny * w * k2) : g.moveTo(x + nx * w * k2, y + ny * w * k2); });
    for (let i = pts.length - 1; i >= 0; i--) { const [x, y, w] = pts[i], nx = -d.t[1], ny = d.t[0]; g.lineTo(x - nx * w * k2 * 0.7, y - ny * w * k2 * 0.7); }
    g.closePath(); g.fill();
  }
  for (let i = 0; i < 10; i++) { const [x, y] = pts[(r() * pts.length) | 0]; g.fillStyle = 'rgba(52,56,28,0.6)'; g.beginPath(); g.ellipse(x + (r() - 0.5) * 0.4, y + (r() - 0.5) * 0.3, 0.12 + r() * 0.15, 0.08 + r() * 0.08, r() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 6; i++) { const [x, y] = pts[(r() * pts.length) | 0]; g.fillStyle = r() < 0.5 ? '#f1e9da' : '#e2bf96'; g.beginPath(); g.ellipse(x + (r() - 0.5) * 0.8, y + 0.2 + r() * 0.4, 0.1, 0.07, r() * 3, 0, TAU); g.fill(); }
  if (r() < 0.6) { const [x, y] = pts[(r() * pts.length) | 0]; g.save(); g.translate(x, y); g.rotate(r() * TAU); g.fillStyle = '#9a7a56'; g.fillRect(-0.7, -0.07, 1.4, 0.14); g.fillStyle = '#7a5e40'; g.fillRect(0.2, -0.07, 0.5, 0.06); g.restore(); }
}
function paintSteps(g, d) {
  g.fillStyle = 'rgba(150,120,80,0.45)';
  d.trail.forEach(([x, y, a], i) => { const sd = i % 2 ? 1 : -1, ox = -Math.sin(a) * 0.16 * sd, oy = Math.cos(a) * 0.16 * sd; g.beginPath(); g.ellipse(x + ox, y + oy, 0.17, 0.08, a, 0, TAU); g.fill(); });
}
function drawVolley(g, b) {
  const t = [-b.face[1], b.face[0]], Z = cam.zoom, A = (u, z) => proj(b.x + t[0] * u, b.y + t[1] * u, z);
  for (const u of [-4.6, 4.6]) { const a = A(u, 0), c = A(u, 2.45); g.strokeStyle = '#d8d4cc'; g.lineWidth = Math.max(1.5, Z * 0.07); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.stroke(); }
  g.strokeStyle = 'rgba(30,30,30,0.55)'; g.lineWidth = 1;
  for (let z = 1.55; z <= 2.45; z += 0.15) { const a = A(-4.6, z), c = A(4.6, z); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.stroke(); }
  for (let u = -4.6; u <= 4.6; u += 0.3) { const a = A(u, 1.55), c = A(u, 2.45); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.stroke(); }
  const top0 = A(-4.6, 2.45), top1 = A(4.6, 2.45); g.strokeStyle = '#f4f2ec'; g.lineWidth = Math.max(1.5, Z * 0.06); g.beginPath(); g.moveTo(top0.x, top0.y); g.lineTo(top1.x, top1.y); g.stroke();
}
// direção do mar (gradiente da costa)
function miaSeaDir(x, y) { const gx = pondVal(x + 3, y) - pondVal(x - 3, y), gy = pondVal(x, y + 3) - pondVal(x, y - 3), l = Math.hypot(gx, gy) || 1; return [-gx / l, -gy / l]; }
function drawLounger(g, b) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), P = (u, v, z) => proj(b.x + u * c - v * s, b.y + u * s + v * c, z), Z = cam.zoom;
  g.strokeStyle = '#d9d6cf'; g.lineWidth = Math.max(1, Z * 0.035);
  for (const [u, v] of [[-0.85, -0.3], [-0.85, 0.3], [0.85, -0.3], [0.85, 0.3]]) { const a = P(u, v, 0), t = P(u, v, 0.3); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(t.x, t.y); g.stroke(); }
  poly(g, [P(-0.2, -0.32, 0.32), P(0.95, -0.32, 0.32), P(0.95, 0.32, 0.32), P(-0.2, 0.32, 0.32)], b.pad, 'rgba(60,60,60,0.5)', 0.8);   // assento (pés p/ o mar)
  poly(g, [P(-0.95, -0.32, 0.8), P(-0.2, -0.32, 0.32), P(-0.2, 0.32, 0.32), P(-0.95, 0.32, 0.8)], shadeHex(b.pad, 0.9), 'rgba(60,60,60,0.5)', 0.8);   // encosto levantado
  g.strokeStyle = 'rgba(255,255,255,0.35)'; for (let k = 1; k < 4; k++) { const a = P(-0.2 + k * 0.29, -0.3, 0.33), e = P(-0.2 + k * 0.29, 0.3, 0.33); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(e.x, e.y); g.stroke(); }
}
function drawLifeguard(g, b) { miaCached(g, Object.assign(b, { h: 11 }), cg => paintLifeguard(cg, b)); }
function paintLifeguard(g, b) {
  // posto estilo Miami Beach: palafitas, deque com guarda-corpo, cabine listrada pastel, telhado de quatro águas, rampa p/ a areia
  const Z = cam.zoom, f = b.face, t = [-f[1], f[0]], K = 1.6, P = (u, v, z) => proj(b.x + (t[0] * u + f[0] * v) * K, b.y + (t[1] * u + f[1] * v) * K, z * K);
  const rot = Math.atan2(f[1], f[0]) - Math.PI / 2, box0 = (z, w, d, h, top, side) => drawBox(g, { x: b.x, y: b.y, z: z * K, w: w * K, d: d * K, h: h * K, rot, top, side });
  const line = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); };
  const sh = proj(b.x - SUN[0] * 4, b.y - SUN[1] * 4, 0); g.fillStyle = 'rgba(60,50,30,0.22)'; g.beginPath(); g.ellipse(sh.x, sh.y, Z * 2.8, Z * 1.3, 0, 0, TAU); g.fill();
  for (const [u, v] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) line([P(u, v, 0), P(u, v, 1.8)], '#cfc8b8', Math.max(2, Z * 0.12));
  line([P(-1.3, -1.3, 0.3), P(1.3, 1.3, 1.6)], '#bdb5a3', Math.max(1, Z * 0.05)); line([P(1.3, -1.3, 0.3), P(-1.3, 1.3, 1.6)], '#bdb5a3', Math.max(1, Z * 0.05));
  // rampa p/ terra (de costas p/ o mar) com corrimão
  poly(g, [P(-0.55, -1.5, 1.8), P(0.55, -1.5, 1.8), P(0.55, -5.4, 0), P(-0.55, -5.4, 0)], '#c9b48a', 'rgba(60,40,20,0.6)', 1);
  for (let k = 1; k < 9; k++) line([P(-0.55, -1.5 - k * 0.43, 1.8 - k * 0.2), P(0.55, -1.5 - k * 0.43, 1.8 - k * 0.2)], 'rgba(90,70,40,0.45)', 1);
  for (const u of [-0.6, 0.6]) line([P(u, -1.5, 2.7), P(u, -5.4, 0.9)], '#f4f2ec', Math.max(1, Z * 0.04));
  box0(1.8, 3.4, 3.4, 0.14, '#d9cfbb', '#b9ad94');
  // cabine com faixas horizontais
  box0(1.94, 2.3, 2.1, 1.6, b.col, b.col);
  for (const [v, sgn] of [[1.06, 1], [-1.06, -1]]) for (const [u, s2] of [[1.16, 1], [-1.16, -1]]) {}
  const faces = [[[-1.15, 1.05], [1.15, 1.05]], [[1.15, 1.05], [1.15, -1.05]], [[1.15, -1.05], [-1.15, -1.05]], [[-1.15, -1.05], [-1.15, 1.05]]];
  for (const [a, c] of faces) {
    const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, wx = t[0] * mx + f[0] * my, wy = t[1] * mx + f[1] * my; if (facingCam(wx, wy) <= 0) continue;
    for (let k = 0; k < 3; k++) poly(g, [P(a[0], a[1], 2.2 + k * 0.42), P(c[0], c[1], 2.2 + k * 0.42), P(c[0], c[1], 2.36 + k * 0.42), P(a[0], a[1], 2.36 + k * 0.42)], b.col2, null);
  }
  poly(g, [P(-0.85, 1.07, 2.5), P(0.85, 1.07, 2.5), P(0.85, 1.07, 3.25), P(-0.85, 1.07, 3.25)], 'rgba(40,60,70,0.9)', '#ffffff', 1.5);   // janela p/ o mar
  // guarda-corpo do deque
  for (const [a, c] of [[[-1.7, 1.7], [1.7, 1.7]], [[1.7, 1.7], [1.7, -1.7]], [[-1.7, -1.7], [-1.7, 1.7]]]) { line([P(a[0], a[1], 2.75), P(c[0], c[1], 2.75)], '#f4f2ec', Math.max(1, Z * 0.05)); for (let k = 0; k <= 6; k++) { const u = a[0] + (c[0] - a[0]) * k / 6, v = a[1] + (c[1] - a[1]) * k / 6; line([P(u, v, 1.94), P(u, v, 2.75)], '#f4f2ec', 1); } }
  // telhado de quatro águas com beiral
  const e = [[-1.6, -1.5], [1.6, -1.5], [1.6, 1.5], [-1.6, 1.5]], ap = P(0, 0, 4.4), ez = 3.55;
  const roofCols = ['#e8e4da', '#cfc9bc', '#f6f3ec', '#ddd8cc'];
  const order = [0, 1, 2, 3].map(i => { const a = e[i], c = e[(i + 1) % 4], mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2; return { i, d: depthOf(b.x + (t[0] * mx + f[0] * my) * K, b.y + (t[1] * mx + f[1] * my) * K) }; }).sort((p, q) => p.d - q.d);
  for (const { i } of order) poly(g, [P(e[i][0], e[i][1], ez), P(e[(i + 1) % 4][0], e[(i + 1) % 4][1], ez), ap], roofCols[i], 'rgba(30,30,30,0.5)', 1);
  const fl = P(1.4, 1.3, 3.6), ft = P(1.4, 1.3, 5.2); line([fl, ft], '#555', 1.4);
  g.fillStyle = '#e74c3c'; g.fillRect(ft.x, ft.y, Z * 0.6, Z * 0.3); g.fillStyle = '#f1c40f'; g.fillRect(ft.x, ft.y + Z * 0.15, Z * 0.6, Z * 0.15);
}
function drawBeachUmbrella(g, b) {
  const Z = cam.zoom, base = proj(b.x, b.y, 0), top = proj(b.x, b.y, 2.2), r = Z * 1.25;
  const sh = proj(b.x - SUN[0] * 1.6, b.y - SUN[1] * 1.6, 0); g.fillStyle = 'rgba(70,55,30,0.22)'; g.beginPath(); g.ellipse(sh.x, sh.y, r, r * TILT, 0, 0, TAU); g.fill();
  g.strokeStyle = '#e8e4da'; g.lineWidth = Math.max(1.2, Z * 0.05); g.beginPath(); g.moveTo(base.x, base.y); g.lineTo(top.x, top.y); g.stroke();
  for (let i = 0; i < 10; i++) {
    const a0 = i / 10 * TAU, a1 = (i + 1) / 10 * TAU, lit = 0.8 + 0.25 * Math.cos((a0 + a1) / 2 + 2.3);
    g.fillStyle = shadeHex(i % 2 ? b.col : b.col2, lit);
    g.beginPath(); g.moveTo(top.x, top.y - Z * 0.3); g.lineTo(top.x + Math.cos(a0) * r, top.y + Math.sin(a0) * r * TILT + Z * 0.15); g.lineTo(top.x + Math.cos(a1) * r, top.y + Math.sin(a1) * r * TILT + Z * 0.15); g.fill();
  }
}

// ---------- palmeiras imperiais nas avenidas, hidrantes e pontos de ônibus ----------
function miaStreets(S, zoneAt) {
  for (const rd of S.roads) {
    if (rd.cls === 'highway') continue;
    const step = rd.cls === 'avenue' ? 26 : 40;
    for (let i = 14, s = 1; i < rd.pts.length - 6; i += step, s = -s) {
      const p = rd.pts[i];
      for (const sg of rd.cls === 'avenue' ? [1, -1] : [s]) {
        const x = p.x + p.nx * sg * (ROAD_W + rd.off + SIDE + 1.05), y = p.y + p.ny * sg * (ROAD_W + rd.off + SIDE + 1.05), z = zoneAt(x, y);
        if (!z || z === 'works' || z === 'poor' || z === 'projects') continue;
        if (!CityStreetLayout.verge(x, y, .45, roadDist, ROAD_W, SIDE) || pondVal(x, y) < 1.2 || miaBlocked(x, y, 0.6)) continue;
        if (OW.place.any(x - 3, y - 3, x + 3, y + 3, c => Math.hypot(c.x - x, c.y - y) < 3)) continue;
        miaPalm(x, y, z === 'town' || z === 'bungalow' ? (rng() < 0.5 ? 'royal' : 'coconut') : 'royal', true);
      }
    }
    // hidrantes amarelos junto ao meio-fio
    for (let i = 30; i < rd.pts.length - 4; i += 90) {
      const p = rd.pts[i], x = p.x + p.nx * (ROAD_W + rd.off + SIDE - .3), y = p.y + p.ny * (ROAD_W + rd.off + SIDE - .3), z = zoneAt(x, y);
      if (!z || !CityStreetLayout.edgeFixture(x, y, .28, roadDist, ROAD_W) || miaBlocked(x, y, 0.4) || pondVal(x, y) < 1.2) continue;
      addBox({ x, y, w: 0.3, d: 0.3, h: 0.75, top: '#e7c21e', side: '#d1a90f', kind: 'hydrant', draw: drawHydrant });
    }
    // abrigos de ônibus junto ao meio-fio (de costas p/ os prédios) e bicicletários no centro e na orla
    for (let i = 48, sg = 1; i < rd.pts.length - 8; i += rd.cls === 'avenue' ? 110 : 170, sg = -sg) {
      const p = rd.pts[i], q = rd.pts[i + 1], off = ROAD_W + rd.off + SIDE + 1.05, x = p.x + p.nx * sg * off, y = p.y + p.ny * sg * off, z = zoneAt(x, y);
      if (z !== 'brickell' && z !== 'southbeach' && z !== 'bungalow' && z !== 'town') continue;
      if (!CityStreetLayout.verge(x, y, 1, roadDist, ROAD_W, SIDE) || pondVal(x, y) < 1.2 || miaBlocked(x, y, 2)) continue;
      addBox({ x, y, w: 3.6, d: 1.3, h: 2.6, rot: Math.atan2(q.y - p.y, q.x - p.x), kind: 'busstop', nx: -p.nx * sg, ny: -p.ny * sg, solid: false, seed: i * 7 + rd.pts.length, draw: drawBusStop });
    }
    for (let i = 36, sg = -1; i < rd.pts.length - 8; i += 64, sg = -sg) {
      const p = rd.pts[i], q = rd.pts[i + 1], off = ROAD_W + rd.off + SIDE - 0.6, x = p.x + p.nx * sg * off, y = p.y + p.ny * sg * off, z = zoneAt(x, y);
      if (z !== 'brickell' && z !== 'southbeach') continue;
      if (!CityStreetLayout.verge(x, y, .4, roadDist, ROAD_W, SIDE) || pondVal(x, y) < 1.2 || miaBlocked(x, y, 1.6)) continue;
      addBox({ x, y, w: 3.4, d: 0.5, h: 0.85, rot: Math.atan2(q.y - p.y, q.x - p.x), kind: 'bikerack', solid: false, seed: (x * 13 + y * 7) | 0, draw: drawBikeRack });
    }
  }
}
function drawBusStop(g, b) { miaCached(g, b, cg => paintBusStop(cg, b)); }
function paintBusStop(g, b) {
  // abrigo de vidro: postes de alumínio, painel do fundo, banco, laje fina, painel de anúncio iluminado e placa azul
  const c = Math.cos(b.rot), s = Math.sin(b.rot), Z = cam.zoom, r = mulberry(b.seed >>> 0);
  const sv = -Math.sign(b.nx * -s + b.ny * c) || 1;   // v local cresce p/ o lado do prédio (fundo do abrigo); (nx,ny) aponta p/ a rua
  const P = (u, v, z) => proj(b.x + u * c - v * sv * s, b.y + u * s + v * sv * c, z);
  const line = (a, e, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(e.x, e.y); g.stroke(); };
  poly(g, [P(-1.9, -0.5, 0), P(1.9, -0.5, 0), P(2.2, 0.9, 0), P(-1.6, 0.9, 0)], 'rgba(20,24,28,0.22)', null);
  const back = facingCam(b.nx, b.ny) < 0;   // fundo voltado p/ a câmera: o vidro vem por último
  const glass = () => { poly(g, [P(-1.7, 0.55, 0.15), P(1.7, 0.55, 0.15), P(1.7, 0.55, 2.3), P(-1.7, 0.55, 2.3)], 'rgba(170,205,220,0.28)', 'rgba(200,210,215,0.9)', 1);
    line(P(-1.7, 0.55, 1.1), P(1.7, 0.55, 1.1), 'rgba(220,228,232,0.7)', 1); };
  if (!back) glass();
  // painel lateral de anúncio (aceso)
  const ad = ['#e8364f', '#2b8be6', '#f5c518', '#1abc9c'][(r() * 4) | 0];
  poly(g, [P(1.75, -0.45, 0.25), P(1.75, 0.5, 0.25), P(1.75, 0.5, 2.1), P(1.75, -0.45, 2.1)], '#f4f2ec', 'rgba(40,46,52,0.9)', 1);
  poly(g, [P(1.75, -0.35, 0.45), P(1.75, 0.4, 0.45), P(1.75, 0.4, 1.95), P(1.75, -0.35, 1.95)], ad, null);
  poly(g, [P(1.75, -0.2, 1.2), P(1.75, 0.25, 1.2), P(1.75, 0.25, 1.75), P(1.75, -0.2, 1.75)], 'rgba(255,255,255,0.7)', null);
  drawBox(g, { x: b.x + 0.2 * sv * -s * 1, y: b.y + 0.2 * sv * c, z: 0.42, w: 2.8, d: 0.42, h: 0.06, rot: b.rot, top: '#8b939a', side: '#5f666c' });   // banco
  for (const [u, v] of [[-1.75, 0.55], [1.75, 0.55], [-1.75, -0.45], [1.75, -0.45]]) line(P(u, v, 0), P(u, v, 2.45), '#9aa3aa', Math.max(1.2, Z * 0.06));
  if (back) glass();
  drawBox(g, { x: b.x + 0.05 * sv * -s, y: b.y + 0.05 * sv * c, z: 2.45, w: 3.9, d: 1.5, h: 0.12, rot: b.rot, top: '#d9dde0', side: '#7f878d' });   // laje
  // placa de parada no poste, do lado da rua
  const pb = P(-2.2, -0.55, 0), pt = P(-2.2, -0.55, 2.9); line(pb, pt, '#6d757b', Math.max(1.2, Z * 0.05));
  const sgn = P(-2.2, -0.55, 2.55); g.fillStyle = '#1f5fae'; g.fillRect(sgn.x - Z * 0.24, sgn.y - Z * 0.34, Z * 0.48, Z * 0.36);
  g.fillStyle = '#ffffff'; g.font = `bold ${Math.max(5, Z * 0.15)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BUS', sgn.x, sgn.y - Z * 0.16);
}
function drawBikeRack(g, b) {
  // paraciclos em "U" invertido perpendiculares à calçada; algumas bicicletas presas
  const c = Math.cos(b.rot), s = Math.sin(b.rot), Z = cam.zoom, r = mulberry(b.seed >>> 0), P = (u, v, z) => proj(b.x + u * c - v * s, b.y + u * s + v * c, z);
  const line = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); };
  g.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const u = -1.6 + k * 0.8;
    if (r() < 0.55) {   // bicicleta: duas rodas no plano (v,z), quadro em triângulo, guidão e selim
      const col = ['#c0392b', '#2b6fb8', '#1f1f1f', '#f5c518', '#2ec46b', '#ecebe7'][(r() * 6) | 0], uu = u + 0.12;
      const wheel = v0 => { const pts = []; for (let a = 0; a <= 12; a++) { const t = a / 12 * TAU; pts.push(P(uu, v0 + Math.cos(t) * 0.33, 0.34 + Math.sin(t) * 0.33)); } line(pts, '#1c1c1e', Math.max(1, Z * 0.04)); };
      wheel(-0.55); wheel(0.55);
      line([P(uu, -0.55, 0.34), P(uu, -0.05, 0.36), P(uu, 0.15, 0.78), P(uu, -0.4, 0.75), P(uu, -0.55, 0.34)], col, Math.max(1, Z * 0.05));
      line([P(uu, -0.05, 0.36), P(uu, 0.45, 0.8), P(uu, 0.55, 0.34)], col, Math.max(1, Z * 0.05));
      line([P(uu - 0.22, 0.45, 0.95), P(uu + 0.22, 0.45, 0.95)], '#2a2a2a', Math.max(1, Z * 0.04));
      line([P(uu, -0.42, 0.88), P(uu, -0.3, 0.88)], '#2a2a2a', Math.max(1.5, Z * 0.07));
    }
    const pts = []; for (let a = 0; a <= 8; a++) { const t = a / 8 * Math.PI; pts.push(P(u, -Math.cos(t) * 0.3, a === 0 || a === 8 ? 0 : 0.55 + Math.sin(t) * 0.25)); }
    pts[0] = P(u, -0.3, 0); pts[8] = P(u, 0.3, 0); line(pts, '#9aa3aa', Math.max(1.2, Z * 0.05));
  }
}
function drawHydrant(g, b) {
  const Z = cam.zoom, a = proj(b.x, b.y, 0), t = proj(b.x, b.y, 0.62), w = Z * 0.13;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(a.x + 2, a.y + 1, w * 1.4, w * 0.6, 0, 0, TAU); g.fill();
  const gr = g.createLinearGradient(a.x - w, 0, a.x + w, 0); gr.addColorStop(0, '#f8e06a'); gr.addColorStop(0.5, '#e7c21e'); gr.addColorStop(1, '#9e7f0c');
  g.fillStyle = gr; g.fillRect(t.x - w, t.y, w * 2, a.y - t.y);
  g.fillStyle = '#d1a90f'; g.beginPath(); g.ellipse(t.x, t.y, w * 1.05, w * 0.6, 0, Math.PI, TAU); g.fill();
  g.fillStyle = '#c9c9c4'; const n2 = proj(b.x, b.y, 0.38); g.fillRect(n2.x - w * 1.6, n2.y - w * 0.4, w * 3.2, w * 0.8);
  g.fillStyle = '#e7c21e'; g.fillRect(a.x - w * 1.3, a.y - w * 0.4, w * 2.6, w * 0.5);
}

// ---------- vagas junto ao meio-fio, bancos e lixeiras nas calçadas ----------
function miaParking(S, zoneAt) {
  const P = { brickell: 0.55, southbeach: 0.4, bungalow: 0.18, town: 0.15, poor: 0.22, projects: 0.25, works: 0.15, mansion: 0.06 };
  const zeb = world.decals.filter(d => d.kind === 'zebra');
  for (const rd of S.roads) {
    if (rd.cls === 'highway') continue;
    for (let i = 14; i < rd.pts.length - 14; i += 13) for (const sg of [1, -1]) {
      const p = rd.pts[i], off = ROAD_W + rd.off - 1.15, x = p.x + p.nx * sg * off, y = p.y + p.ny * sg * off;
      const z = zoneAt(p.x + p.nx * sg * (ROAD_W + rd.off + SIDE + 3), p.y + p.ny * sg * (ROAD_W + rd.off + SIDE + 3));
      if (!z || rng() > (P[z] || 0) || zeb.some(d => Math.hypot(d.x - x, d.y - y) < 11) || pondVal(x, y) < 1.2) continue;
      if (Math.abs(roadDist(x, y) - (ROAD_W - 1.15)) > 0.4) continue;   // perto de outra via (cruzamento)
      const q = rd.pts[i + 1], rot = Math.atan2(q.y - p.y, q.x - p.x) + (sg > 0 ? 0 : Math.PI);
      miaCar(x, y, rot);
    }
    for (let i = 20; i < rd.pts.length - 10; i += 60) {
      const p = rd.pts[i], sg = i % 120 ? 1 : -1, off = ROAD_W + rd.off + SIDE + 1, x = p.x + p.nx * sg * off, y = p.y + p.ny * sg * off, z = zoneAt(x, y);
      if (z !== 'brickell' && z !== 'southbeach' && z !== 'bungalow' && z !== 'town') continue;
      const q = rd.pts[i + 1];
      miaBench(x, y, Math.atan2(q.y - p.y, q.x - p.x) + (sg > 0 ? Math.PI : 0));
      miaCan(x + (q.x - p.x) * 3, y + (q.y - p.y) * 3);
    }
  }
}

// ---------- desordem por zona em terreno livre (aglomerada, não uniforme) ----------
function miaClutter(S, zoneAt, rects) {
  const [x0, y0] = S.bounds, R = mulberry(owSeed(S, 'clutter'));
  const inRect = (x, y) => rects.some(b => x > b[0] && x < b[2] && y > b[1] && y < b[3]);
  for (let gi = 0; gi < 220; gi++) {
    const cx = x0 + 6 + R() * (S.SP - 12), cy = y0 + 6 + R() * (S.SP - 12), z = zoneAt(cx, cy);
    if (!z || onRoad(cx, cy) || inRect(cx, cy) || pondVal(cx, cy) < 1.3) continue;
    if ((z === 'mansion' && R() < 0.3) || (z === 'bungalow' && R() < 0.68)) continue;
    if (z === 'brickell') {   // canteiro de praça: árvore em floreira, bancos em volta, quiosque ou carrinho de café
      if (miaBlocked(cx, cy, 4)) continue;
      miaPlanter(cx, cy); if (!miaBlocked(cx, cy, 0.3)) miaPalm(cx, cy, 'royal');
      for (const [dx, dy, a] of [[2, 0, Math.PI / 2], [-2, 0, -Math.PI / 2], [0, 2, 0]]) if (R() < 0.7) miaBench(cx + dx, cy + dy, a);
      if (R() < 0.3) addBox({ x: cx + 4, y: cy + 3, w: 1.6, d: 1.0, h: 1.1, top: '#d63a2f', side: '#e9e5dc', kind: 'cart', draw: drawCart });
      miaDecal([[cx - 3, cy - 3], [cx + 3, cy - 3], [cx + 3, cy + 3], [cx - 3, cy + 3]], 'stains', R);
    } else if (z === 'poor' || z === 'projects') {   // monte de lixo, sofá velho, pneus, carrinho, varal, trilha de terra
      const k = R();
      if (k < 0.35) { for (let i = 0; i < 4 + ((R() * 4) | 0); i++) { const x = cx + (R() - 0.5) * 3, y = cy + (R() - 0.5) * 3; if (!miaBlocked(x, y, 0.4)) addBox({ x, y, w: 0.6, d: 0.6, h: 0.55, rot: R() * 3, kind: 'trashbag', solid: false, draw: drawTrashBag }); } for (let i = 0; i < 10; i++) urbanLife.litter.push({ kind: ['can', 'bottle', 'paper', 'wrapper', 'newspaper', 'cup'][(R() * 6) | 0], x: cx + (R() - 0.5) * 5, y: cy + (R() - 0.5) * 5, variant: (R() * 3) | 0, a: R() * TAU, s: 1.3 + R() * 0.5 }); }
      else if (k < 0.5) { if (!miaBlocked(cx, cy, 1.2)) addBox({ x: cx, y: cy, w: 2, d: 0.9, h: 0.75, rot: R() * 3, top: ['#7a5a48', '#5e6b4a', '#8a7a5a'][(R() * 3) | 0], side: '#4a3a2e', kind: 'couch', draw: drawCouch }); }
      else if (k < 0.65) { for (let i = 0; i < 3; i++) { const x = cx + (R() - 0.5) * 2, y = cy + (R() - 0.5) * 2; if (!miaBlocked(x, y, 0.4)) addBox({ x, y, w: 0.7, d: 0.7, h: 0.22, kind: 'tire', solid: false, draw: drawTire }); } }
      else if (k < 0.78 && z === 'projects') { const a = R() * Math.PI; addBox({ x: cx, y: cy, w: 0.1, d: 0.1, h: 1.9, kind: 'clothesline', solid: false, ang: a, seed: (R() * 1e6) | 0, draw: drawClothesline }); }
      else if (k < 0.9) { if (!miaBlocked(cx, cy, 1.4)) miaCar(cx, cy, R() * 3, { junk: true, col: ['#8a6a4a', '#6f7a7e', '#9a8a6a', '#7a4a3a'][(R() * 4) | 0] }); }
      if (R() < 0.5) world.decals.push({ kind: 'path', x: cx, y: cy, a: R() * Math.PI, l: 8 + R() * 14, seed: (R() * 1e6) | 0, bb: [cx - 12, cy - 12, cx + 12, cy + 12], paint: paintPath });
      if (R() < 0.4) miaDecal([[cx - 2.5, cy - 2.5], [cx + 2.5, cy - 2.5], [cx + 2.5, cy + 2.5], [cx - 2.5, cy + 2.5]], 'stains', R);
    } else if (z === 'mansion' || z === 'bungalow') {   // terreno baldio ajardinado: grupo de palmeiras com canteiro
      if (R() < (z === 'mansion' ? 0.25 : 0.6) || miaBlocked(cx, cy, 3)) continue;
      for (let i = 0; i < 3; i++) { const x = cx + (R() - 0.5) * 4, y = cy + (R() - 0.5) * 4; if (!miaBlocked(x, y, 0.8)) miaPalm(x, y, R() < 0.5 ? 'coconut' : 'royal'); }
      world.decals.push({ kind: 'mulch', x: cx, y: cy, r: 3.2, seed: (R() * 1e6) | 0, bb: [cx - 4, cy - 4, cx + 4, cy + 4], paint: paintMulch });
      if (z === 'mansion') {   // bairro nobre: maciços de cróton, hibisco e buganvília em volta e cerca viva baixa num dos lados
        for (let i = 0; i < 5; i++) { const a = R() * TAU, x = cx + Math.cos(a) * (3 + R()), y = cy + Math.sin(a) * (3 + R()); if (!miaBlocked(x, y, 0.6) && !onRoad(x, y)) miaBush(x, y, ['croton', 'hibiscus', 'bougainvillea'][(R() * 3) | 0]); }
        if (R() < 0.5) { const a = R() * Math.PI, dx = Math.cos(a) * 5, dy = Math.sin(a) * 5, ox = -dy * 1.2, oy = dx * 1.2; miaHedgeRun(cx + ox - dx, cy + oy - dy, cx + ox + dx, cy + oy + dy, (x, y) => miaBlocked(x, y, 0.5), 0.9); }
      }
    }
  }
  // tampas de bueiro e marcas de óleo no centro
  for (const rd of S.roads) for (let i = 10; i < rd.pts.length - 6; i += 26) {
    const p = rd.pts[i], z = zoneAt(p.x + p.nx * 9, p.y + p.ny * 9); if (z !== 'brickell' && z !== 'southbeach') continue;
    const o = (R() - 0.5) * 2 * (ROAD_W + rd.off - 1.2), x = p.x + p.nx * o, y = p.y + p.ny * o;
    world.decals.push({ kind: 'manhole', x, y, seed: (R() * 1e6) | 0, bb: [x - 1.5, y - 1.5, x + 1.5, y + 1.5], paint: (g, d) => { g.fillStyle = '#2a2a2c'; g.beginPath(); g.arc(d.x, d.y, 0.38, 0, TAU); g.fill(); g.strokeStyle = 'rgba(120,120,118,0.6)'; g.lineWidth = 0.05; g.beginPath(); g.arc(d.x, d.y, 0.32, 0, TAU); g.stroke(); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(d.x - 0.28, d.y + k * 0.1); g.lineTo(d.x + 0.28, d.y + k * 0.1); g.stroke(); } const gr = g.createRadialGradient(d.x + 0.8, d.y, 0, d.x + 0.8, d.y, 1); gr.addColorStop(0, 'rgba(10,10,12,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(d.x - 0.5, d.y - 1, 2.4, 2); } });
  }
  // asfalto gasto nas ruas pobres: manchas de óleo e remendos
  for (const rd of S.roads) for (let i = 6; i < rd.pts.length - 6; i += 9) {
    const p = rd.pts[i], z = zoneAt(p.x + p.nx * 9, p.y + p.ny * 9); if (z !== 'poor' && z !== 'projects' && z !== 'works') continue;
    if (R() < 0.45) { const o = (R() - 0.5) * 2 * (ROAD_W + rd.off - 0.5), x = p.x + p.nx * o, y = p.y + p.ny * o; world.decals.push({ kind: 'roadwear', x, y, a: Math.atan2(p.ny, p.nx), seed: (R() * 1e6) | 0, bb: [x - 2, y - 2, x + 2, y + 2], paint: paintRoadWear }); }
  }
}
function paintRoadWear(g, d) {
  const r = mulberry(d.seed);
  if (r() < 0.5) { g.save(); g.translate(d.x, d.y); g.rotate(d.a + (r() - 0.5) * 0.4); g.fillStyle = 'rgba(28,27,29,0.75)'; g.fillRect(-0.9 - r(), -0.6 - r() * 0.5, 1.8 + r() * 1.5, 1.2 + r()); g.strokeStyle = 'rgba(15,15,15,0.6)'; g.lineWidth = 0.05; g.strokeRect(-0.9, -0.6, 1.8, 1.2); g.restore(); }
  else { const gr = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, 0.8 + r()); gr.addColorStop(0, 'rgba(10,10,12,0.5)'); gr.addColorStop(1, 'rgba(10,10,12,0)'); g.fillStyle = gr; g.fillRect(d.x - 2, d.y - 2, 4, 4); }
  g.strokeStyle = 'rgba(20,20,20,0.55)'; g.lineWidth = 0.04; let x = d.x + (r() - 0.5) * 2, y = d.y + (r() - 0.5) * 2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 0.9; y += (r() - 0.5) * 0.9; g.lineTo(x, y); } g.stroke();
}
function paintPath(g, d) {   // trilha de terra pisada (atalho dos moradores)
  const r = mulberry(d.seed), dx = Math.cos(d.a), dy = Math.sin(d.a);
  g.strokeStyle = 'rgba(120,96,70,0.45)'; g.lineCap = 'round'; g.lineWidth = 0.9;
  g.beginPath(); let x = d.x - dx * d.l / 2, y = d.y - dy * d.l / 2; g.moveTo(x, y);
  for (let k = 0; k < 8; k++) { x += dx * d.l / 8 + (r() - 0.5) * 0.8; y += dy * d.l / 8 + (r() - 0.5) * 0.8; g.lineTo(x, y); } g.stroke();
}
function paintMulch(g, d) {
  const r = mulberry(d.seed); g.fillStyle = '#6a4a32'; g.beginPath();
  for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, q = d.r * (0.8 + r() * 0.3); k ? g.lineTo(d.x + Math.cos(a) * q, d.y + Math.sin(a) * q) : g.moveTo(d.x + Math.cos(a) * q, d.y + Math.sin(a) * q); } g.closePath(); g.fill();
  g.strokeStyle = '#bdb6a6'; g.lineWidth = 0.12; g.stroke();
  for (let i = 0; i < 120; i++) { g.fillStyle = r() < 0.5 ? '#4f3624' : '#86603e'; g.fillRect(d.x + (r() - 0.5) * d.r * 1.6, d.y + (r() - 0.5) * d.r * 1.6, 0.08, 0.05); }
}
function drawCouch(g, b) {
  drawBox(g, { x: b.x, y: b.y, z: 0, w: b.w, d: b.d, h: 0.42, rot: b.rot, top: b.top, side: b.side });
  const c = Math.cos(b.rot), s = Math.sin(b.rot), off = (u, v) => [b.x + u * c - v * s, b.y + u * s + v * c];
  const bk = off(0, -b.d / 2 + 0.15); drawBox(g, { x: bk[0], y: bk[1], z: 0.42, w: b.w, d: 0.3, h: 0.38, rot: b.rot, top: shadeHex(b.top, 0.9), side: b.side });
  for (const u of [-1, 1]) { const a = off(u * (b.w / 2 - 0.12), 0.1); drawBox(g, { x: a[0], y: a[1], z: 0.42, w: 0.24, d: b.d - 0.2, h: 0.2, rot: b.rot, top: shadeHex(b.top, 0.95), side: b.side }); }
}
function drawCart(g, b) {
  drawBox(g, { x: b.x, y: b.y, z: 0.3, w: 1.6, d: 1.0, h: 0.8, rot: 0, top: '#cfcac0', side: '#e9e5dc' });
  const u = proj(b.x, b.y, 2.3), Z = cam.zoom; g.strokeStyle = '#555'; g.lineWidth = 1.2; const base = proj(b.x, b.y, 1.1); g.beginPath(); g.moveTo(base.x, base.y); g.lineTo(u.x, u.y); g.stroke();
  for (let i = 0; i < 8; i++) { const a0 = i / 8 * TAU, a1 = (i + 1) / 8 * TAU; g.fillStyle = i % 2 ? '#d63a2f' : '#f7f5ef'; g.beginPath(); g.moveTo(u.x, u.y - Z * 0.1); g.lineTo(u.x + Math.cos(a0) * Z, u.y + Math.sin(a0) * Z * TILT + Z * 0.2); g.lineTo(u.x + Math.cos(a1) * Z, u.y + Math.sin(a1) * Z * TILT + Z * 0.2); g.fill(); }
  for (const dx of [-0.6, 0.6]) { const w = proj(b.x + dx, b.y + 0.5, 0.25); g.fillStyle = '#222'; g.beginPath(); g.ellipse(w.x, w.y, Z * 0.2, Z * 0.2, 0, 0, TAU); g.fill(); }
}
function drawClothesline(g, b) {
  const dx = Math.cos(b.ang) * 2.5, dy = Math.sin(b.ang) * 2.5, A = proj(b.x - dx, b.y - dy, 1.8), B = proj(b.x + dx, b.y + dy, 1.8), Z = cam.zoom, r = mulberry(b.seed);
  for (const [x, y] of [[b.x - dx, b.y - dy], [b.x + dx, b.y + dy]]) { const p0 = proj(x, y, 0), p1 = proj(x, y, 1.9); g.strokeStyle = '#7a7470'; g.lineWidth = Math.max(1, Z * 0.05); g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke(); }
  g.strokeStyle = '#d8d4cc'; g.lineWidth = 1; g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo((A.x + B.x) / 2, (A.y + B.y) / 2 + Z * 0.15, B.x, B.y); g.stroke();
  for (let i = 1; i < 6; i++) { const t = i / 6, x = lerp(A.x, B.x, t), y = lerp(A.y, B.y, t) + Z * 0.15 * 4 * t * (1 - t); g.fillStyle = ['#e8364f', '#f4f2ec', '#2b8be6', '#f5c518', '#7a9a60'][(r() * 5) | 0]; g.fillRect(x - Z * 0.18, y, Z * 0.36, Z * (0.4 + r() * 0.3)); }
}

// ---------- faixas de pedestre nos cruzamentos ----------
function miaCrosswalks(S) {
  const C = OW.RC;
  for (const rd of S.roads) {
    if (rd.cls === 'highway') continue;
    for (const end of [0, rd.pts.length - 1]) {
      const p = rd.pts[end], a = OW.roadHash.get(Math.floor(p.y / C) * 65536 + Math.floor(p.x / C)); if (!a) continue;
      let other = null;
      for (const s of a) if (s.id !== rd.bigId && segDist(p.x, p.y, s.ax, s.ay, s.bx, s.by) < s.off + ROAD_W + 1.5) { other = s; break; }
      if (!other) continue;
      // anda pela via até sair do asfalto da outra + calçada
      const dir = end ? -1 : 1; let i = end;
      while (i >= 0 && i < rd.pts.length && segDist(rd.pts[i].x, rd.pts[i].y, other.ax, other.ay, other.bx, other.by) < other.off + ROAD_W + SIDE + 1.2) i += dir;
      if (i < 0 || i >= rd.pts.length) continue;
      const q = rd.pts[i], tx = rd.pts[Math.min(rd.pts.length - 1, i + 1)].x - rd.pts[Math.max(0, i - 1)].x, ty = rd.pts[Math.min(rd.pts.length - 1, i + 1)].y - rd.pts[Math.max(0, i - 1)].y, tl = Math.hypot(tx, ty) || 1;
      if (world.decals.some(d => d.kind === 'zebra' && Math.hypot(d.x - q.x, d.y - q.y) < 12)) continue;
      world.decals.push({ kind: 'zebra', x: q.x, y: q.y, tx: tx / tl * dir, ty: ty / tl * dir, hw: ROAD_W + rd.off, bb: [q.x - 9, q.y - 9, q.x + 9, q.y + 9], paint: paintZebra });
    }
  }
}
function paintZebra(g, d) {
  const nx = -d.ty, ny = d.tx;
  g.fillStyle = 'rgba(244,242,234,0.9)';
  for (let v = -d.hw + 0.3; v < d.hw - 0.3; v += 0.9) {
    g.beginPath();
    const ax = d.x + nx * v, ay = d.y + ny * v;
    g.moveTo(ax, ay); g.lineTo(ax + nx * 0.5, ay + ny * 0.5); g.lineTo(ax + nx * 0.5 + d.tx * 3, ay + ny * 0.5 + d.ty * 3); g.lineTo(ax + d.tx * 3, ay + d.ty * 3); g.fill();
  }
  // linha de retenção
  g.fillStyle = 'rgba(244,242,234,0.85)'; const bx = d.x + d.tx * 4.2, by = d.y + d.ty * 4.2;
  g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + nx * d.hw, by + ny * d.hw); g.lineTo(bx + nx * d.hw + d.tx * 0.4, by + ny * d.hw + d.ty * 0.4); g.lineTo(bx + d.tx * 0.4, by + d.ty * 0.4); g.fill();
}

// ---------- decalques no chão (pintados nos blocos do terreno, em metros) ----------
function miaDecal(q, kind, r, opt = {}) {
  const xs = q.map(p => p[0]), ys = q.map(p => p[1]);
  world.decals.push(Object.assign({ kind, q, seed: ((xs[0] * 131 + ys[0] * 71) | 0) >>> 0, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], paint: paintDecal }, opt));
}
function paintDecal(g, d) {
  const q = d.q, r = mulberry(d.seed), path = () => { g.beginPath(); q.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
  const [x0, y0, x1, y1] = d.bb;
  g.save(); path(); g.clip();
  if (d.kind === 'lawn') {   // grama de São Agostinho cortada em faixas claras/escuras
    g.fillStyle = 'rgba(96,126,60,0.9)'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let k = 0, v = d.dir ? x0 : y0; v < (d.dir ? x1 : y1); v += 1.2, k++) { g.fillStyle = k % 2 ? 'rgba(170,190,110,0.16)' : 'rgba(30,50,20,0.12)'; if (d.dir) g.fillRect(v, y0, 1.2, y1 - y0); else g.fillRect(x0, v, x1 - x0, 1.2); }
    for (let i = 0; i < (x1 - x0) * (y1 - y0) * 4; i++) { g.fillStyle = r() < 0.5 ? 'rgba(40,80,25,0.35)' : 'rgba(170,210,110,0.3)'; g.fillRect(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 0.05, 0.12); }
    if (d.ragged) for (let i = 0; i < 6; i++) { const cx = x0 + r() * (x1 - x0), cy = y0 + r() * (y1 - y0), rr = 0.6 + r() * 1.2, gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, 'rgba(150,130,80,0.6)'); gr.addColorStop(1, 'rgba(150,130,80,0)'); g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
  } else if (d.kind === 'dirtyard') {   // terra batida, grama falhada, poças secas
    g.fillStyle = 'rgba(138,112,82,0.92)'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let i = 0; i < 14; i++) { const cx = x0 + r() * (x1 - x0), cy = y0 + r() * (y1 - y0), rr = 0.5 + r() * 1.8, gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); const grass = r() < 0.6; gr.addColorStop(0, grass ? 'rgba(96,120,52,0.75)' : 'rgba(90,70,50,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
    for (let i = 0; i < (x1 - x0) * (y1 - y0) * 3; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,45,30' : '200,180,140'},${0.2 + r() * 0.3})`; g.fillRect(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 0.06, 0.06); }
  } else if (d.kind === 'pavers' || d.kind === 'driveway' || d.kind === 'plaza' || d.kind === 'terrazzo' || d.kind === 'walk' || d.kind === 'apron' || d.kind === 'deck') {
    const base = { pavers: '#c9b79a', driveway: '#bdb8ad', plaza: '#d9d4c8', terrazzo: '#e9e2d4', walk: '#c4bcae', apron: '#a9a69e', deck: '#e4dccb' }[d.kind];
    g.fillStyle = base; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const step = d.kind === 'pavers' ? 0.3 : d.kind === 'plaza' ? 0.6 : d.kind === 'deck' ? 0.5 : d.kind === 'terrazzo' ? 0.5 : 1.5;
    g.strokeStyle = d.kind === 'pavers' ? 'rgba(90,70,50,0.35)' : 'rgba(60,55,50,0.25)'; g.lineWidth = 0.03;
    g.beginPath();
    for (let x = Math.floor(x0); x < x1; x += step) { g.moveTo(x, y0); g.lineTo(x, y1); }
    for (let y = Math.floor(y0); y < y1; y += d.kind === 'pavers' ? 0.15 : step) { g.moveTo(x0, y); g.lineTo(x1, y); }
    g.stroke();
    if (d.kind === 'pavers') for (let i = 0; i < (x1 - x0) * (y1 - y0) * 6; i++) { g.fillStyle = r() < 0.5 ? 'rgba(150,90,60,0.18)' : 'rgba(240,230,210,0.2)'; g.fillRect(Math.floor((x0 + r() * (x1 - x0)) / 0.3) * 0.3, Math.floor((y0 + r() * (y1 - y0)) / 0.15) * 0.15, 0.3, 0.15); }
    if (d.kind === 'terrazzo') for (let i = 0; i < (x1 - x0) * (y1 - y0) * 30; i++) { g.fillStyle = ['rgba(240,160,170,0.5)', 'rgba(120,200,190,0.5)', 'rgba(255,255,255,0.6)', 'rgba(90,90,90,0.3)'][(r() * 4) | 0]; g.fillRect(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 0.04, 0.04); }
    if (d.kind === 'driveway' || d.kind === 'apron') for (let i = 0; i < 3; i++) { const cx = x0 + r() * (x1 - x0), cy = y0 + r() * (y1 - y0), rr = 0.4 + r() * 0.8, gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, 'rgba(30,28,26,0.4)'); gr.addColorStop(1, 'rgba(30,28,26,0)'); g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
    if (d.kind === 'deck' || d.kind === 'plaza') { g.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 20; i++) g.fillRect(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 0.5, 0.5); }
  } else if (d.kind === 'pool') {   // piscina: borda de pedra, água turquesa, faixas de luz e raia escura do fundo
    g.fillStyle = '#efeae0'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.restore(); g.save();
    const inset = 0.35, qi = q.map(p => [p[0] + Math.sign((x0 + x1) / 2 - p[0]) * inset, p[1] + Math.sign((y0 + y1) / 2 - p[1]) * inset]);
    g.beginPath(); qi.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip();
    const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, '#62d6e6'); gr.addColorStop(0.5, '#2fb2d0'); gr.addColorStop(1, '#1d8db8');
    g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = 'rgba(10,60,90,0.18)'; g.fillRect(x0 + inset + 0.6, y0 + inset + 0.6, x1 - x0 - 2 * inset - 1.2, y1 - y0 - 2 * inset - 1.2);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.05;
    for (let i = 0; i < 40; i++) { const cx = x0 + r() * (x1 - x0), cy = y0 + r() * (y1 - y0), s = 0.3 + r() * 0.5; g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + s * 0.5, cy - s * 0.3, cx + s, cy + s * 0.1); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0, y0, x1 - x0, 0.25);
  } else if (d.kind === 'court') {   // quadra: asfalto pintado de verde/azul com linhas
    g.fillStyle = '#5d7064'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = '#5c7891'; g.fillRect(x0 + 1.2, y0 + 1.2, x1 - x0 - 2.4, y1 - y0 - 2.4);
    g.strokeStyle = 'rgba(250,250,245,0.9)'; g.lineWidth = 0.08; g.strokeRect(x0 + 1.2, y0 + 1.2, x1 - x0 - 2.4, y1 - y0 - 2.4);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ax = d.along === 'x';
    g.beginPath(); if (ax) { g.moveTo(cx, y0 + 1.2); g.lineTo(cx, y1 - 1.2); } else { g.moveTo(x0 + 1.2, cy); g.lineTo(x1 - 1.2, cy); } g.stroke();
    g.beginPath(); g.arc(cx, cy, 1.8, 0, TAU); g.stroke();
    for (const s of [-1, 1]) {
      const hx = ax ? cx + s * ((x1 - x0) / 2 - 1.2) : cx, hy = ax ? cy : cy + s * ((y1 - y0) / 2 - 1.2);
      g.fillStyle = 'rgba(200,80,50,0.55)'; if (ax) g.fillRect(hx - (s > 0 ? 5.8 : 0), hy - 2.45, 5.8, 4.9); else g.fillRect(hx - 2.45, hy - (s > 0 ? 5.8 : 0), 4.9, 5.8);
      g.beginPath(); g.arc(hx, hy, 6.75, ax ? (s > 0 ? Math.PI / 2 : -Math.PI / 2) : (s > 0 ? Math.PI : 0), ax ? (s > 0 ? Math.PI * 1.5 : Math.PI / 2) : (s > 0 ? TAU : Math.PI)); g.stroke();
    }
    g.strokeStyle = 'rgba(25,25,25,0.35)'; g.lineWidth = 0.04;   // trincas e manchas de chuva
    for (let i = 0; i < 18; i++) { let x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 1.6; y += (r() - 0.5) * 1.6; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 10; i++) { const cx = x0 + r() * (x1 - x0), cy = y0 + r() * (y1 - y0), rr = 0.8 + r() * 1.8, gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, 'rgba(40,40,40,0.18)'); gr.addColorStop(1, 'rgba(40,40,40,0)'); g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
  } else if (d.kind === 'pit') {   // canteiro de palmeira na calçada
    g.fillStyle = '#5c4632'; g.fillRect(x0, y0, x1 - x0, y1 - y0); g.strokeStyle = '#9d978a'; g.lineWidth = 0.1; g.strokeRect(x0 + 0.05, y0 + 0.05, x1 - x0 - 0.1, y1 - y0 - 0.1);
    for (let i = 0; i < 30; i++) { g.fillStyle = r() < 0.5 ? '#3f2f22' : '#7a5f44'; g.fillRect(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 0.07, 0.07); }
  } else if (d.kind === 'stains') {
    for (let i = 0; i < 14; i++) { const cx = x0 + r() * (x1 - x0), cy = y0 + r() * (y1 - y0), rr = 0.15 + r() * 0.6, gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, `rgba(${r() < 0.5 ? '40,34,28' : '70,60,45'},${0.25 + r() * 0.2})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(30,30,30,0.45)'; g.beginPath(); g.ellipse(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 0.04, 0.03, 0, 0, TAU); g.fill(); }
  } else if (d.kind === 'vbcourt') {
    g.strokeStyle = 'rgba(40,90,170,0.75)'; g.lineWidth = 0.06; g.beginPath(); q.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.stroke();
  } else if (d.kind === 'towel') {
    g.fillStyle = d.col; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = 'rgba(255,255,255,0.55)'; for (let x = x0 + 0.2; x < x1; x += 0.4) g.fillRect(x, y0, 0.15, y1 - y0);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0, y1 - 0.08, x1 - x0, 0.08);
  }
  g.restore();
}

// ---------- ocupação do setor (substitui as casas genéricas do mundo grande) ----------
function* miaGenSector(S, rects) {
  const dd = world.districtFn, zoneAt = (x, y) => miaZone(x, y, dd(x, y));
  const cands = [];
  for (const rd of S.roads) { if (rd.cls === 'highway') continue; for (let i = 8; i < rd.pts.length - 8; i += 4) for (const s of [1, -1]) cands.push({ p: rd.pts[i], s, off: rd.off, cls: rd.cls, r: rng() }); }
  cands.sort((a, b) => a.r - b.r);
  let placed = 0, tries = 0;
  const cap = 46;
  for (const c of cands) {
    if (placed >= cap || tries > 1600) break;
    const ox = c.p.x + c.p.nx * c.s * (ROAD_W + c.off + SIDE + 7), oy = c.p.y + c.p.ny * c.s * (ROAD_W + c.off + SIDE + 7), z = zoneAt(ox, oy);
    if (!z) continue;
    tries++; c.zone = z; (MIA.zt || (MIA.zt = {}))[z] = (MIA.zt[z] || 0) + 1;
    const mix = MIA_W[z]; let kind = mix[(rng() * mix.length) | 0];
    if ((z === 'bungalow' || z === 'town' || z === 'poor') && c.cls === 'avenue' && rng() < 0.2) kind = 'shop';
    let H = null;
    if (kind === 'mansion') H = miaMansion(S, c, rects);
    else if (kind === 'bungalow') H = miaHouse(S, c, rects, false);
    else if (kind === 'poor') H = miaHouse(S, c, rects, true);
    else H = miaBuilding(S, c, rects, kind);
    if (H) { placed++; yield; }
  }
  miaCrosswalks(S);
  miaStreets(S, zoneAt); yield;
  miaClutter(S, zoneAt, rects); yield;
  miaParking(S, zoneAt); yield;
  if (S.mix[D_.BEACH] > 4) { miaBeach(S); yield; }
}
