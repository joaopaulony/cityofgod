// miami.js — arte "Miami" do mundo grande: palmeiras, vegetação tropical, cercas de arame, prédios
// (hotéis art déco, condomínios, torres de escritório, conjuntos, galpões, lojas), mansões, casas pobres,
// marcas no chão (piscinas, quadras, estacionamentos, gramados listrados) e mobiliário de praia/rua.
// Tudo desenhado por código em Canvas 2D; sprites e fachadas são pintados uma vez e reaproveitados.
'use strict';

const MIA = { pools: null, chainTex: null, chainRust: null, hedgePat: null };

// ======================================================================
// PALMEIRAS
// ======================================================================
// sprite no mesmo formato de makeTree: tronco (curvo) + copa; topDx = deslocamento do topo do tronco (px)
function makePalm(kind, rnd) {
  const S = SPR, R = (a, b) => a + rnd() * (b - a);
  const royal = kind === 'royal';
  const trunkH = royal ? R(8, 11) : R(6.5, 9.5), lean = royal ? R(-0.25, 0.25) : R(-1.6, 1.6) * (rnd() < 0.5 ? 1 : 0.55);
  const pad = 30, tw = (royal ? 0.5 : 0.42) * S;
  const tc = makeCanvas(Math.abs(lean) * S + tw * 2 + pad * 2, trunkH * S + pad), tg = tc.getContext('2d');
  const bx = pad + tw + (lean < 0 ? -lean * S : 0), by = trunkH * S + pad * 0.5;
  // eixo do tronco: curva quadrática base -> topo
  const P = t => { const x = bx + lean * S * (royal ? t : t * t * 0.85 + t * 0.15), y = by - trunkH * S * HZ * t; return [x, y]; };
  const wAt = t => royal ? tw * (0.82 + 0.18 * Math.sin(t * Math.PI) - (t > 0.82 ? (t - 0.82) * 0.4 : 0)) : tw * (1.08 - t * 0.32 + (t < 0.06 ? (0.06 - t) * 4 : 0));
  // silhueta com sombreado (luz da esquerda)
  const N = 60, L = [], Rr = [];
  for (let i = 0; i <= N; i++) { const t = i / N, [x, y] = P(t), w = wAt(t) / 2; L.push([x - w, y]); Rr.push([x + w, y]); }
  const outline = [...L, ...Rr.reverse()];
  const grad = tg.createLinearGradient(bx - tw, 0, bx + tw, 0);
  if (royal) { grad.addColorStop(0, '#d8d4c8'); grad.addColorStop(0.4, '#c4bfb2'); grad.addColorStop(1, '#7f7a70'); }
  else { grad.addColorStop(0, '#a99a7c'); grad.addColorStop(0.45, '#8d7c5e'); grad.addColorStop(1, '#4e4232'); }
  tg.beginPath(); outline.forEach(([x, y], i) => i ? tg.lineTo(x, y) : tg.moveTo(x, y)); tg.closePath();
  tg.save(); tg.translate(lean * S * 0.5, 0); tg.fillStyle = grad; tg.restore();
  // gradiente acompanha a inclinação: pinta faixa a faixa
  for (let i = 0; i < N; i++) {
    const t = i / N, [x, y] = P(t), [x2, y2] = P((i + 1) / N), w = wAt(t);
    const g2 = tg.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    if (royal) { g2.addColorStop(0, '#e2ddd1'); g2.addColorStop(0.35, '#cbc6b9'); g2.addColorStop(1, '#827d73'); }
    else { g2.addColorStop(0, '#b5a684'); g2.addColorStop(0.4, '#94835f'); g2.addColorStop(1, '#4a3f2f'); }
    tg.fillStyle = g2; tg.beginPath(); tg.moveTo(x - w / 2, y + 1); tg.lineTo(x + w / 2, y + 1); tg.lineTo(x2 + wAt((i + 1) / N) / 2, y2 - 1); tg.lineTo(x2 - wAt((i + 1) / N) / 2, y2 - 1); tg.fill();
  }
  // anéis/cicatrizes das folhas caídas (coqueiro) ou anéis finos (imperial)
  for (let yy = 0.04; yy < (royal ? 0.84 : 0.97); yy += royal ? 0.035 : R(0.016, 0.024)) {
    const [x, y] = P(yy), w = wAt(yy) / 2;
    tg.strokeStyle = royal ? 'rgba(90,86,78,0.35)' : 'rgba(40,30,20,0.55)'; tg.lineWidth = royal ? 1 : 1.6;
    tg.beginPath(); tg.ellipse(x, y, w, w * 0.22, 0, 0.1, Math.PI - 0.1); tg.stroke();
    if (!royal) { tg.strokeStyle = 'rgba(210,195,160,0.25)'; tg.lineWidth = 1; tg.beginPath(); tg.ellipse(x - 1, y - 2, w * 0.8, w * 0.18, 0, 0.2, Math.PI - 0.6); tg.stroke(); }
  }
  // líquen e manchas
  for (let i = 0; i < 40; i++) { const t = rnd() * 0.9, [x, y] = P(t), w = wAt(t); tg.fillStyle = `rgba(${rnd() < 0.5 ? '70,80,50' : '40,35,28'},${0.12 + rnd() * 0.15})`; tg.fillRect(x - w / 2 + rnd() * w, y, 2 + rnd() * 3, 2 + rnd() * 5); }
  if (royal) {   // palmito verde brilhante no topo
    for (let i = 0; i < 18; i++) {
      const t = 0.84 + i / 18 * 0.16, [x, y] = P(t), w = tw * 0.62;
      const g3 = tg.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g3.addColorStop(0, '#7fae5a'); g3.addColorStop(0.4, '#5d8f3e'); g3.addColorStop(1, '#2f5222');
      tg.fillStyle = g3; tg.fillRect(x - w / 2, y - trunkH * S / 18 * 0.16 - 1, w, trunkH * S * 0.16 / 18 + 2);
    }
  }
  // base: raízes superficiais
  tg.fillStyle = 'rgba(60,48,34,0.9)'; tg.beginPath(); tg.ellipse(bx, by, tw * 0.9, tw * 0.28, 0, 0, TAU); tg.fill();
  const [topX, topY] = P(1);

  // ---- copa: folhas pinadas em leque 3D (as de trás primeiro, as da frente caem p/ o observador)
  const fr = royal ? R(3.6, 4.4) : R(3.2, 4.2), CW = Math.ceil(fr * 2.6 * S), CHh = Math.ceil(fr * 2.2 * S), cc = makeCanvas(CW, CHh), cg = cc.getContext('2d');
  const cx = CW / 2, cy = CHh * 0.42;
  const nF = royal ? 16 : 19, fronds = [], tint = [R(0.9, 1.12), R(0.92, 1.05), R(0.85, 1.1)];
  for (let i = 0; i < nF; i++) {
    const a = i / nF * TAU + R(-0.15, 0.15), len = fr * S * R(0.82, 1.08), elev = Math.sin(a);   // elev>0: aponta p/ a frente (baixo na tela)
    fronds.push({ a, len, droop: R(0.3, 0.55) + (elev > 0 ? 0.15 : 0), rise: royal ? R(0.45, 0.7) : R(0.3, 0.5), dead: false });
  }
  for (let i = 0, nd = royal ? (rnd() < 0.5 ? 1 : 0) : 2 + ((rnd() * 4) | 0); i < nd; i++) fronds.push({ a: R(0, TAU), len: fr * S * R(0.55, 0.8), droop: 1.5, dead: true });
  fronds.sort((p, q) => (p.dead ? -2 : Math.sin(p.a)) - (q.dead ? -2 : Math.sin(q.a)));
  const frond = f => {
    // ponto no mundo da folha projetado: x = cos(a)*s, profundidade sin(a)*s*0.5 (tela y), queda = droop*s²
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16, s2 = f.len * t * (1 - 0.18 * t * t), arch = f.dead ? 0 : -(f.rise || 0.4) * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.62);
      const x = cx + Math.cos(f.a) * s2, y = cy + Math.sin(f.a) * s2 * 0.5 + (f.droop * t * t * t + arch) * f.len * 0.62;
      pts.push([x, y]);
    }
    const front = Math.sin(f.a) > 0, b0 = f.dead ? [128, 98, 56] : front ? [84, 116, 56] : [52, 80, 40], base = [b0[0] * tint[0], b0[1] * tint[1], b0[2] * tint[2]];
    // folíolos: pares de traços inclinados ao longo da raque
    for (let k = 1; k < 16; k++) {
      const [x, y] = pts[k], [x2, y2] = pts[k + 1] || pts[k], dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      const t = k / 16, ll = S * (royal ? 0.62 : 0.56) * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95))) * (f.dead ? 0.7 : 1);
      for (const sd of [1, -1]) for (let q = 0; q < 3; q++) {
        const ox = x + dx * q / 3, oy = y + dy * q / 3, droopL = (f.dead ? 0.9 : royal ? 0.32 + q * 0.1 : 0.22) * ll;
        const ex = ox + nx * sd * ll * 0.75 + dx / l * ll * 0.35, ey = oy + ny * sd * ll * 0.75 + dy / l * ll * 0.35 + droopL;
        const sh = 0.82 + rnd() * 0.3 + (sd > 0 ? 0.08 : -0.06) + (f.dead ? 0 : (1 - t) * 0.12);
        cg.strokeStyle = `rgb(${base[0] * sh | 0},${base[1] * sh | 0},${base[2] * sh | 0})`; cg.lineWidth = Math.max(1.2, S * 0.07 * (1 - t * 0.45));
        cg.beginPath(); cg.moveTo(ox, oy); cg.quadraticCurveTo((ox + ex) / 2 + nx * sd * 2, (oy + ey) / 2 - 2, ex, ey); cg.stroke();
      }
    }
    // raque
    cg.strokeStyle = f.dead ? '#7d6034' : '#9aa266'; cg.lineWidth = Math.max(1.2, S * 0.04);
    cg.beginPath(); pts.forEach(([x, y], k) => k ? cg.lineTo(x, y) : cg.moveTo(x, y)); cg.stroke();
    // pontas amareladas e luz no topo
    if (!f.dead) { const [x, y] = pts[16]; cg.fillStyle = 'rgba(190,190,90,0.5)'; cg.beginPath(); cg.arc(x, y, 2, 0, TAU); cg.fill(); }
  };
  for (const f of fronds) if (!(Math.sin(f.a) > 0) || f.dead) frond(f);
  // cocos e base das folhas
  if (!royal) for (let i = 0; i < 6; i++) { const a = rnd() * TAU, r2 = S * 0.18; cg.fillStyle = rnd() < 0.6 ? '#5f7a2a' : '#8a6a2c'; cg.beginPath(); cg.arc(cx + Math.cos(a) * r2, cy + 6 + Math.sin(a) * r2 * 0.5, S * 0.11, 0, TAU); cg.fill(); cg.fillStyle = 'rgba(255,255,220,0.25)'; cg.beginPath(); cg.arc(cx + Math.cos(a) * r2 - 2, cy + 4 + Math.sin(a) * r2 * 0.5, S * 0.04, 0, TAU); cg.fill(); }
  cg.fillStyle = royal ? '#5e8d3f' : '#7a6440'; cg.beginPath(); cg.ellipse(cx, cy, S * 0.22, S * 0.14, 0, 0, TAU); cg.fill();
  for (const f of fronds) if (Math.sin(f.a) > 0 && !f.dead) frond(f);
  const sp = { trunk: tc, tax: bx, tay: by, crown: cc, cax: cx, cay: cy, trunkH, r: fr * 0.75, kind: 'palm', palm: royal ? 'royal' : 'coconut', topDx: topX - bx, leafColors: ['#4f7f34', '#6a9440', '#7d8a3c', '#9a8a4a'] };
  return sp;
}

// sombra da palmeira: estrela de folhas com recortes (assada uma vez por sprite)
function palmShadowStamp(sp) {
  if (sp._shStamp) return sp._shStamp;
  const R = sp.r * 2.4 + sp.trunkH * 0.4 + 2, ppm = OW.SPPM, size = Math.ceil(2 * R * ppm), c = makeCanvas(size, size), g = c.getContext('2d');
  const k = sp.trunkH * 0.32, cx = (R - SUN[0] * k) * ppm, cy = (R - SUN[1] * k) * ppm, rr = mulberry(sp.trunkH * 1000 | 0);
  g.fillStyle = 'rgba(16,26,10,0.30)';
  for (let i = 0; i < 15; i++) {
    const a = i / 15 * TAU + rr() * 0.3, L = sp.r * 1.3 * ppm * (0.8 + rr() * 0.3);
    g.beginPath(); g.moveTo(cx, cy);
    for (let t = 0; t <= 1; t += 0.1) { const w = Math.sin(t * Math.PI) * ppm * 0.45; g.lineTo(cx + Math.cos(a) * L * t - Math.sin(a) * w, cy + Math.sin(a) * L * t * 0.75 + Math.cos(a) * w); }
    for (let t = 1; t >= 0; t -= 0.1) { const w = Math.sin(t * Math.PI) * ppm * 0.45; g.lineTo(cx + Math.cos(a) * L * t + Math.sin(a) * w, cy + Math.sin(a) * L * t * 0.75 - Math.cos(a) * w); }
    g.fill();
  }
  // sombra fina do tronco + contato
  g.strokeStyle = 'rgba(16,26,10,0.28)'; g.lineWidth = ppm * 0.35; g.beginPath(); g.moveTo(R * ppm, R * ppm); g.lineTo(cx, cy); g.stroke();
  g.fillStyle = 'rgba(10,20,6,0.3)'; g.beginPath(); g.ellipse(R * ppm, R * ppm, ppm * 0.45, ppm * 0.3, 0, 0, TAU); g.fill();
  return (sp._shStamp = { c, R });
}

// ======================================================================
// ARBUSTOS TROPICAIS (formato de makeBush)
// ======================================================================
function makeTropicalBush(kind, rnd) {
  const S = SPR, R = (a, b) => a + rnd() * (b - a);
  const r = kind === 'seagrape' ? R(0.9, 1.3) : kind === 'croton' ? R(0.45, 0.65) : R(0.6, 1.0);
  const W = Math.ceil(r * 2.8 * S), Hh = Math.ceil(r * 2.4 * S), c = makeCanvas(W, Hh), g = c.getContext('2d');
  const cx = W / 2, by = Hh - 4;
  // massa escura de fundo (sombra interna)
  g.fillStyle = kind === 'croton' ? '#3e3a1c' : '#203d1c';
  for (let i = 0; i < 14; i++) { const a = R(Math.PI, TAU), d = rnd() * r * S * 0.7; g.beginPath(); g.ellipse(cx + Math.cos(a) * d * 1.1, by - r * S * 0.55 + Math.sin(a) * d * 0.6, r * S * 0.42, r * S * 0.36, 0, 0, TAU); g.fill(); }
  const leaves = kind === 'seagrape' ? 120 : kind === 'croton' ? 160 : 520;
  for (let i = 0; i < leaves; i++) {
    const a = R(Math.PI * 0.95, TAU + 0.05), d = Math.sqrt(rnd()) * r * S * 0.95;
    const x = cx + Math.cos(a) * d * 1.15, y = by - r * S * 0.5 + Math.sin(a) * d * 0.68, top = (y < by - r * S * 0.6);
    const lit = 0.75 + (top ? 0.3 : 0) + (x < cx ? 0.1 : -0.05) + rnd() * 0.15;
    if (kind === 'seagrape') {   // folhas grandes e redondas, veias avermelhadas
      const s = S * R(0.16, 0.24); g.fillStyle = `rgb(${92 * lit | 0},${128 * lit | 0},${62 * lit | 0})`;
      g.beginPath(); g.ellipse(x, y, s, s * 0.85, rnd() * TAU, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(150,50,40,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - s * 0.6, y); g.lineTo(x + s * 0.6, y); g.stroke();
    } else if (kind === 'croton') {   // folhas variegadas amarelo/vermelho/verde
      const cols = [[196, 160, 40], [176, 64, 40], [70, 110, 40], [210, 120, 40]], col = cols[(rnd() * 4) | 0], s = S * R(0.07, 0.12);
      g.fillStyle = `rgb(${col[0] * lit | 0},${col[1] * lit | 0},${col[2] * lit | 0})`; g.beginPath(); g.ellipse(x, y, s * 1.8, s * 0.6, rnd() * TAU, 0, TAU); g.fill();
    } else {   // hibisco / buganvília: folhas pequenas brilhantes
      const s = S * R(0.045, 0.075), dark = kind === 'hibiscus';
      g.fillStyle = `rgb(${(dark ? 46 : 70) * lit | 0},${(dark ? 96 : 120) * lit | 0},${(dark ? 38 : 44) * lit | 0})`;
      g.beginPath(); g.ellipse(x, y, s * 1.5, s * 0.8, rnd() * TAU, 0, TAU); g.fill();
      if (top && rnd() < 0.25) { g.fillStyle = 'rgba(255,255,230,0.35)'; g.fillRect(x - 1, y - 1, 2, 1); }
    }
  }
  // flores
  if (kind === 'hibiscus') for (let i = 0; i < 14; i++) {
    const a = R(Math.PI * 1.05, TAU - 0.05), d = Math.sqrt(rnd()) * r * S * 0.85, x = cx + Math.cos(a) * d * 1.1, y = by - r * S * 0.55 + Math.sin(a) * d * 0.62;
    const col = rnd() < 0.6 ? '#d8283a' : rnd() < 0.5 ? '#f06a8c' : '#f4b23a', s = S * 0.12;
    for (let k = 0; k < 5; k++) { const pa = k / 5 * TAU; g.fillStyle = col; g.beginPath(); g.ellipse(x + Math.cos(pa) * s * 0.55, y + Math.sin(pa) * s * 0.4, s * 0.55, s * 0.38, pa, 0, TAU); g.fill(); }
    g.fillStyle = '#f6e27a'; g.fillRect(x - 1, y - 2, 2, 4);
  }
  if (kind === 'bougainvillea') for (let i = 0; i < 260; i++) {   // brácteas magenta em cascata
    const a = R(Math.PI, TAU), d = Math.sqrt(rnd()) * r * S, x = cx + Math.cos(a) * d * 1.15, y = by - r * S * 0.45 + Math.sin(a) * d * 0.7 + rnd() * 6;
    const col = rnd() < 0.8 ? [214, 40, 132] : [236, 90, 170], k2 = 0.8 + rnd() * 0.35;
    g.fillStyle = `rgb(${col[0] * k2 | 0},${col[1] * k2 | 0},${col[2] * k2 | 0})`; g.beginPath(); g.ellipse(x, y, S * 0.05, S * 0.04, rnd() * 3, 0, TAU); g.fill();
  }
  return { img: c, ax: cx, ay: by, r, vegKind: kind };   // vegKind: espécie p/ a vegetação 3D
}

// ======================================================================
// CERCA DE ARAME (alambrado): textura de malha losangular com transparência
// ======================================================================
function chainLinkTex(rust) {
  const ppm = 64, c = makeCanvas(ppm, ppm * 2), g = c.getContext('2d');
  const step = ppm / 8;
  g.lineWidth = 1.1;
  for (let k = -16; k < 32; k++) {
    for (const d of [1, -1]) {
      g.strokeStyle = rust ? `rgba(${120 + (k % 3) * 12},${92 + (k % 2) * 8},${70},0.75)` : 'rgba(176,182,186,0.78)';
      g.beginPath(); g.moveTo(k * step, 0); g.lineTo(k * step + d * ppm * 2, ppm * 2); g.stroke();
    }
  }
  g.fillStyle = rust ? 'rgba(90,60,40,0.25)' : 'rgba(255,255,255,0.18)';
  for (let y = 0; y < ppm * 2; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < ppm; x += step) g.fillRect(x, y, 1, 1);
  c.ppm = ppm;
  return c;
}
// linha de alambrado em pedaços de 1 m (postes galvanizados, travessa superior, malha)
function chainLine(x1, y1, x2, y2, gap = () => false, opts = {}) {
  const len = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1))), dx = (x2 - x1) / len, dy = (y2 - y1) / len;
  for (let i = 0; i < len; i++) {
    const s = { x1: x1 + dx * i, y1: y1 + dy * i, x2: x1 + dx * (i + 1), y2: y1 + dy * (i + 1), nx: -dy, ny: dx, h: opts.h || 1.8, kind: 'fence', chain: true, rust: !!opts.rust, post: i % 3 === 0, woodSeed: i };
    const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
    if (gap(mx, my) || onRoad(mx, my)) continue;
    fences.push(s); world.segs.push(s);
  }
}
function drawChainFence(g, s) {
  if (!MIA.chainTex) { MIA.chainTex = chainLinkTex(false); MIA.chainRust = chainLinkTex(true); }
  const tex = s.rust ? MIA.chainRust : MIA.chainTex, h = s.h;
  const O = proj(s.x1, s.y1, h), A = proj(s.x2, s.y2, h), B = proj(s.x1, s.y1, 0);
  g.save(); g.imageSmoothingEnabled = true;
  g.transform((A.x - O.x) / tex.ppm, (A.y - O.y) / tex.ppm, (B.x - O.x) / (tex.ppm * 2), (B.y - O.y) / (tex.ppm * 2), O.x, O.y);
  g.drawImage(tex, 0, 0); g.restore();
  // postes e travessa
  const Z = cam.zoom, col = s.rust ? '#7a6656' : '#9ea4a8', hi = s.rust ? '#a58a72' : '#d8dcde';
  g.lineCap = 'round';
  const top0 = proj(s.x1, s.y1, h), top1 = proj(s.x2, s.y2, h);
  g.strokeStyle = 'rgba(30,30,32,0.6)'; g.lineWidth = Math.max(1.5, Z * 0.05) + 1; g.beginPath(); g.moveTo(top0.x, top0.y); g.lineTo(top1.x, top1.y); g.stroke();
  g.strokeStyle = col; g.lineWidth = Math.max(1.2, Z * 0.05); g.stroke();
  if (s.post) for (const p of [[s.x1, s.y1]]) {
    const a = proj(p[0], p[1], 0), b = proj(p[0], p[1], h + 0.08);
    g.strokeStyle = 'rgba(30,30,32,0.7)'; g.lineWidth = Math.max(2, Z * 0.07) + 1.2; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    g.strokeStyle = col; g.lineWidth = Math.max(1.6, Z * 0.07); g.stroke();
    g.strokeStyle = hi; g.lineWidth = Math.max(0.6, Z * 0.02); g.beginPath(); g.moveTo(a.x - Z * 0.015, a.y); g.lineTo(b.x - Z * 0.015, b.y); g.stroke();
    g.fillStyle = col; g.beginPath(); g.ellipse(b.x, b.y, Z * 0.06, Z * 0.035, 0, 0, TAU); g.fill();
  }
}
