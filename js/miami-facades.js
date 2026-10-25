// miami-facades.js — fachadas dos prédios do mundo grande, pintadas por código andar por andar
// (versão de dia e de noite): hotel art déco, residencial moderno, torre de escritórios, conjunto
// habitacional, galpão e comércio de rua.
'use strict';

const FLOOR0 = 4.2, FLOORH = 3.2;   // térreo alto (lojas/saguão) e andares-tipo
const DECO_PASTELS = ['#f3b9c8', '#a9e2d2', '#f5e6a2', '#cbb8e6', '#a6dbe6', '#f7d2b0', '#f4f1ea', '#b9e4c0'];
const DECO_ACCENT = ['#2bb3c0', '#e8508a', '#f2b632', '#5b8fd6', '#36a87a', '#f07d4a'];
const HOTEL_NAMES = ['FLAMINGO', 'OCEAN PALMS', 'CORAL', 'SUNSET', 'TIDES', 'BREEZE', 'PELICAN', 'MARLIN', 'SEAGULL', 'TROPICANA', 'ATLANTIC', 'PARADISE'];
const SHOP_SIGNS = [['CAFETERÍA', '#c0392b'], ['BODEGA', '#2e7d4f'], ['FARMACIA', '#1f6fb2'], ['LAVANDERÍA', '#3a8fb7'], ['BOTÁNICA', '#7b3fa0'], ['PAWN SHOP', '#c9a227'],
  ['LIQUOR', '#a8322d'], ['BARBERÍA', '#2c3e50'], ['CUBAN SANDWICH', '#d35400'], ['CELL REPAIR', '#16a085'], ['NAILS & SPA', '#e84393'], ['TACOS', '#e67e22'], ['SURF SHOP', '#0e8fa8'], ['MINI MART', '#27ae60']];
const OFFICE_NAMES = ['BISCAYNE FINANCIAL', 'BRICKELL PLAZA', 'MERIDIAN TOWER', 'BAYFRONT CENTER', 'CORAL WAY BANK', 'MIAMI TRADE'];

function bInit(H, side) {
  const sd = H.sides[side], K = H.texPPM || 30, W = Math.ceil(sd.len * K), Hp = Math.ceil(sd.Hc * K), c = makeCanvas(W, Hp), g = c.getContext('2d');
  c.ppm = K;
  return { c, g, W, Hp, K, L: sd.len, Hc: sd.Hc, Y: z => (sd.Hc - z) * K, X: u => u * K, front: side === H.frontSide, side };
}
const floorZ = i => i === 0 ? 0 : FLOOR0 + (i - 1) * FLOORH;
function stucco(g, W, Hp, col, rnd, aging) {
  paintPlaster(g, 0, 0, W, Hp, col, rnd, aging);
  for (let i = 0; i < W / 40 * aging; i++) {   // escorridos de chuva
    const x = rnd() * W, y = rnd() * Hp * 0.8, l = 20 + rnd() * 70, gr = g.createLinearGradient(0, y, 0, y + l);
    gr.addColorStop(0, 'rgba(60,55,45,0.18)'); gr.addColorStop(1, 'rgba(60,55,45,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + rnd() * 3, l);
  }
}
function groundGrime(F, aging) {
  const { g, W, Y, K } = F, gr = g.createLinearGradient(0, Y(0), 0, Y(1.2));
  gr.addColorStop(0, `rgba(70,58,40,${0.25 + aging * 0.25})`); gr.addColorStop(1, 'rgba(70,58,40,0)'); g.fillStyle = gr; g.fillRect(0, Y(1.2), W, 1.2 * K);
  g.fillStyle = 'rgba(60,58,54,0.85)'; g.fillRect(0, Y(0.25), W, 0.25 * K); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, Y(0.25), W, 1);
}
// vidro: reflexo do céu (dia) ou luz interna (noite), com caixilho
function glass(g, x, y, w, h, tint, night, rnd, opts = {}) {
  if (night) {
    const on = rnd() < (opts.lit ?? 0.55), warm = rnd() < 0.7;
    if (on) { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, warm ? '#ffd890' : '#d8ecff'); gr.addColorStop(1, warm ? '#e8a850' : '#9cc4e8'); g.fillStyle = gr; }
    else g.fillStyle = '#1a2230';
    g.fillRect(x, y, w, h);
    if (on && rnd() < 0.5) { g.fillStyle = 'rgba(40,30,20,0.35)'; g.fillRect(x + w * rnd() * 0.6, y + h * 0.4, w * 0.25, h * 0.6); }
  } else {
    const gr = g.createLinearGradient(x, y, x + w * 0.6, y + h);
    gr.addColorStop(0, shadeHex(tint, 1.45)); gr.addColorStop(0.45, tint); gr.addColorStop(1, shadeHex(tint, 0.62));
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x + w * 0.15, y); g.lineTo(x + w * 0.35, y); g.lineTo(x + w * 0.05, y + h); g.lineTo(x, y + h); g.lineTo(x, y + h * 0.6); g.fill();
    if (opts.blinds && rnd() < 0.5) { g.fillStyle = 'rgba(230,226,214,0.55)'; g.fillRect(x, y, w, h * (0.2 + rnd() * 0.5)); }
  }
  if (opts.frame !== false) { g.strokeStyle = opts.frame || 'rgba(235,235,232,0.95)'; g.lineWidth = Math.max(1, opts.fw || 2); g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
}
function acUnit(g, x, y, K) {
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 2, y + 2, 0.7 * K, 0.42 * K);
  g.fillStyle = '#c9cac6'; g.fillRect(x, y, 0.7 * K, 0.42 * K); g.fillStyle = '#9a9b97';
  for (let i = 1; i < 6; i++) g.fillRect(x + i * 0.7 * K / 6, y + 2, 1, 0.42 * K - 4);
  g.fillStyle = 'rgba(80,60,40,0.4)'; g.fillRect(x + 0.3 * K, y + 0.42 * K, 2, 0.4 * K);   // escorrido de água
}
function winBars(g, x, y, w, h, col = '#2c2c2e') { g.fillStyle = col; for (let bx = x + 3; bx < x + w - 1; bx += 6) g.fillRect(bx, y, 1.5, h); g.fillRect(x, y + h * 0.33, w, 1.5); g.fillRect(x, y + h * 0.66, w, 1.5); }
function signText(g, text, x, y, w, h, bg, fg, night, neon) {
  g.save();
  if (bg) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 3, y + 3, w, h); g.fillStyle = bg; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x, y, w, h * 0.2); }
  let fs = h * 0.72; g.font = `bold ${fs}px "Arial Narrow", "Segoe UI", sans-serif`;
  while (g.measureText(text).width > w * 0.9 && fs > 6) { fs *= 0.9; g.font = `bold ${fs}px "Arial Narrow", "Segoe UI", sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (night && neon) { g.shadowColor = neon; g.shadowBlur = h * 0.6; g.fillStyle = shadeHex(neon, 1.3); } else g.fillStyle = fg;
  g.fillText(text, x + w / 2, y + h / 2 + 1);
  g.restore();
}
function awning(g, x, y, w, h, c1, c2) {
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y + h, w, h * 0.9);
  const n = Math.max(2, Math.round(w / 10));
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(x + i * w / n, y, w / n + 0.5, h); }
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + h * 0.7, w, h * 0.3);
  for (let i = 0; i < n * 2; i++) { g.fillStyle = i % 2 ? c1 : c2; g.beginPath(); g.arc(x + (i + 0.5) * w / (n * 2), y + h, w / (n * 4), 0, Math.PI); g.fill(); }
}
function interiorTex(H, F, rnd) {
  const { g, W, Hp, K, Y } = F; paintPlaster(g, 0, 0, W, Hp, H.style.interior, rnd, 0.1);
  g.fillStyle = '#5f4a36'; g.fillRect(0, Y(0.12), W, 0.12 * K);
  return F.c;
}

// ---- hotel art déco (Ocean Drive)
function facadeDeco(H, side, ext, rnd, night) {
  const F = bInit(H, side), { g, W, Hp, K, L, Y, X } = F, S = H.style, n = H.nFloors, acc = H.accent;
  if (!ext) return interiorTex(H, F, rnd);
  stucco(g, W, Hp, S.plaster, rnd, 0.35);
  for (const u of [0, L - 0.5]) { g.fillStyle = shadeHex(S.plaster, 1.06); g.fillRect(X(u), 0, 0.5 * K, Hp); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(X(u) + (u ? 0 : 0.5 * K - 2), 0, 2, Hp); }
  const bay = 2.6, nb = Math.max(1, Math.floor((L - 1) / bay)), off = (L - nb * bay) / 2;
  for (let f = 1; f < n; f++) {
    const z0 = floorZ(f), wz0 = z0 + 0.9, wz1 = z0 + 2.4;
    for (let b = 0; b < nb; b++) {
      const u0 = off + b * bay + 0.45, u1 = u0 + bay - 0.9, mid = F.front && Math.abs(b - (nb - 1) / 2) < 0.6;
      if (mid) continue;   // eixo: letreiro vertical
      if (rnd() < 0.12) {   // escotilha redonda
        const cx = X((u0 + u1) / 2), cy = Y((wz0 + wz1) / 2), r = 0.55 * K;
        g.fillStyle = S.trim; g.beginPath(); g.arc(cx, cy, r + 3, 0, TAU); g.fill(); g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip(); glass(g, cx - r, cy - r, r * 2, r * 2, S.glassTint, night, rnd, { frame: false }); g.restore();
      } else {
        glass(g, X(u0), Y(wz1), X(u1) - X(u0), (wz1 - wz0) * K, S.glassTint, night, rnd, { blinds: true });
        g.fillStyle = S.trim; g.fillRect((X(u0) + X(u1)) / 2 - 1, Y(wz1), 2, (wz1 - wz0) * K);
        if (!night && rnd() < 0.28) acUnit(g, X(u0) + 3, Y(wz0 + 0.42), K);
      }
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(X(u0 - 0.15), Y(wz1 + 0.12), X(u1) - X(u0) + 0.3 * K, 0.35 * K);   // sombra da sobrancelha
      g.fillStyle = '#f7f5ef'; g.fillRect(X(u0 - 0.15), Y(wz1 + 0.24), X(u1) - X(u0) + 0.3 * K, 0.13 * K);
    }
    g.fillStyle = acc; g.fillRect(X(0.5), Y(z0 + 0.12), W - K, 0.08 * K); g.fillRect(X(0.5), Y(z0 + 0.3), W - K, 0.05 * K);   // linhas de velocidade
  }
  g.fillStyle = shadeHex(S.plaster, 1.08); g.fillRect(0, 0, W, 0.5 * K);
  g.fillStyle = acc; for (let x = 0; x < W; x += 0.6 * K) { g.beginPath(); g.moveTo(x, 0.5 * K); g.lineTo(x + 0.3 * K, 0.2 * K); g.lineTo(x + 0.6 * K, 0.5 * K); g.fill(); }
  g.fillStyle = 'rgba(30,26,22,0.35)'; g.fillRect(X(0.5), Y(FLOOR0 - 0.2), W - K, (FLOOR0 - 0.45) * K);
  for (let u = 0.8; u < L - 1.2; u += 2.4) glass(g, X(u), Y(3.2), 1.9 * K, 2.6 * K, '#6f97ad', night, rnd, { lit: 0.9 });
  if (F.front) {
    awning(g, X(0.6), Y(3.75), W - 1.2 * K, 0.5 * K, acc, '#f7f5ef');
    signText(g, 'HOTEL ' + H.hotelName, X(L / 2 - 4), Y(4.15), 8 * K, 0.42 * K, null, '#f7f5ef', night, acc);
    const fx = X(L / 2 - 0.55), top = Y(H.h - 0.3), bot = Y(FLOOR0 + 0.6), fw = 1.1 * K;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(fx + 4, top + 4, fw, bot - top);
    g.fillStyle = shadeHex(S.plaster, 1.1); g.fillRect(fx, top, fw, bot - top);
    g.fillStyle = acc; g.fillRect(fx + 3, top + 3, fw - 6, bot - top - 6);
    const name = H.hotelName.replace(/ /g, ''), lh = (bot - top - 10) / name.length;
    g.save(); g.font = `bold ${Math.min(lh * 0.9, fw * 0.8)}px "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (night) { g.shadowColor = '#fff6c0'; g.shadowBlur = 10; }
    g.fillStyle = night ? '#fffbe0' : '#f7f5ef';
    [...name].forEach((ch, i) => g.fillText(ch, fx + fw / 2, top + 6 + lh * (i + 0.5)));
    g.restore();
  }
  groundGrime(F, 0.3);
  return F.c;
}

// ---- residencial moderno (lajes brancas, sacadas com guarda-corpo de vidro)
function facadeCondo(H, side, ext, rnd, night) {
  const F = bInit(H, side), { g, W, Hp, K, L, Y, X } = F, S = H.style, n = H.nFloors;
  if (!ext) return interiorTex(H, F, rnd);
  g.fillStyle = '#e9e8e3'; g.fillRect(0, 0, W, Hp);
  for (let f = 1; f < n; f++) {
    const z0 = floorZ(f), z1 = z0 + FLOORH;
    for (let u = 0.6; u < L - 0.6; u += 1.5) glass(g, X(u), Y(z1 - 0.35), 1.45 * K, (FLOORH - 0.35) * K, S.glassTint, night, rnd, { frame: '#9aa0a4', fw: 2, lit: 0.45 });
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, Y(z1 - 0.35), W, 0.4 * K);
    g.fillStyle = '#f6f5f1'; g.fillRect(0, Y(z1), W, 0.35 * K); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, Y(z1) + 0.32 * K, W, 2);
    g.fillStyle = 'rgba(150,205,200,0.45)'; g.fillRect(X(0.3), Y(z0 + 1.1), W - 0.6 * K, 1.0 * K);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(X(0.3), Y(z0 + 1.1), W - 0.6 * K, 2);
    g.fillStyle = 'rgba(255,255,255,0.18)'; for (let x = X(0.3); x < W; x += 1.5 * K) g.fillRect(x, Y(z0 + 1.1), 2, 1.0 * K);
    if (!night) for (let u = 1; u < L - 1; u += 3 + rnd() * 3) if (rnd() < 0.3) {   // mobília de sacada vista pelo vidro: cadeira e vaso
      g.fillStyle = 'rgba(40,40,44,0.55)'; g.fillRect(X(u), Y(z0 + 0.9), 0.45 * K, 0.5 * K); g.fillRect(X(u + 0.5), Y(z0 + 0.7), 0.6 * K, 0.08 * K);
      g.fillStyle = 'rgba(150,90,60,0.6)'; g.fillRect(X(u + 1.4), Y(z0 + 0.45), 0.3 * K, 0.35 * K);
    }
  }
  glass(g, X(0.8), Y(3.6), W - 1.6 * K, 3.4 * K, '#7fa3b6', night, rnd, { lit: 0.95, frame: '#cfd3d6' });
  for (let u = 1.6; u < L - 0.8; u += 1.6) { g.fillStyle = '#cfd3d6'; g.fillRect(X(u), Y(3.6), 2, 3.4 * K); }
  if (F.front) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(X(L / 2 - 3), Y(3.9), 6 * K, 0.6 * K); g.fillStyle = '#f6f5f1'; g.fillRect(X(L / 2 - 3), Y(4.0), 6 * K, 0.3 * K); signText(g, H.bName, X(L / 2 - 3), Y(4.0), 6 * K, 0.3 * K, null, '#3a4048', night, '#bfe8ff'); }
  g.fillStyle = '#f6f5f1'; g.fillRect(0, 0, W, 0.45 * K);
  groundGrime(F, 0.15);
  return F.c;
}

// ---- torre de escritórios (pele de vidro, montantes, peitoris)
function facadeOffice(H, side, ext, rnd, night) {
  const F = bInit(H, side), { g, W, Hp, K, L, Y, X } = F, S = H.style, n = H.nFloors;
  if (!ext) return interiorTex(H, F, rnd);
  const sky = g.createLinearGradient(0, 0, W * 0.3, Hp); sky.addColorStop(0, '#9fc4d8'); sky.addColorStop(0.5, '#4f7f9c'); sky.addColorStop(1, '#2d4c62');
  g.fillStyle = night ? '#16202c' : sky; g.fillRect(0, 0, W, Hp);
  if (!night) for (let i = 0; i < 6; i++) { const x = rnd() * W, y = rnd() * Hp * 0.7, r = (2 + rnd() * 4) * K, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const col = 1.5;
  for (let f = 1; f < n; f++) {
    const z0 = floorZ(f);
    if (night) for (let u = 0; u < L; u += col) glass(g, X(u), Y(z0 + FLOORH - 0.1), col * K, (FLOORH - 0.9) * K, S.glassTint, true, rnd, { frame: false, lit: 0.4 });
    if (!night) {   // reflexo varia por andar; persianas baixadas em alguns vãos
      g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '10,30,50'},${0.04 + rnd() * 0.1})`; g.fillRect(0, Y(z0 + FLOORH), W, (FLOORH - 0.8) * K);
      for (let u = 0; u < L; u += col) if (rnd() < 0.18) { g.fillStyle = 'rgba(225,222,210,0.55)'; g.fillRect(X(u) + 2, Y(z0 + FLOORH - 0.1), col * K - 4, (0.4 + rnd() * 1.4) * K); }
    }
    g.fillStyle = night ? '#1e2a36' : 'rgba(40,60,74,0.55)'; g.fillRect(0, Y(z0 + 0.8), W, 0.8 * K);
    g.fillStyle = '#3a4650'; g.fillRect(0, Y(z0 + 0.82), W, 2);
  }
  g.fillStyle = '#3a4650'; for (let u = 0; u <= L; u += col) g.fillRect(X(u) - 1, 0, 2.5, Hp);
  g.fillStyle = 'rgba(255,255,255,0.22)'; for (let u = 0; u <= L; u += col) g.fillRect(X(u) + 1.5, 0, 1, Hp);
  g.fillStyle = '#2e3a44'; g.fillRect(0, Y(FLOOR0), W, 0.4 * K);
  glass(g, X(0.4), Y(FLOOR0 - 0.4), W - 0.8 * K, (FLOOR0 - 0.6) * K, '#6d8ea3', night, rnd, { lit: 0.95, frame: '#2e3a44' });
  if (F.front) signText(g, H.bName, X(L / 2 - 5), Y(FLOOR0 + 0.05), 10 * K, 0.36 * K, null, '#f4f4f0', night, '#e8f4ff');
  g.fillStyle = '#2e3a44'; g.fillRect(0, 0, W, 0.45 * K);
  return F.c;
}

// ---- conjunto habitacional (blocos de concreto, passarela externa, grades, grafite)
function facadeProjects(H, side, ext, rnd, night) {
  const F = bInit(H, side), { g, W, Hp, K, L, Y, X } = F, S = H.style, n = H.nFloors;
  if (!ext) return interiorTex(H, F, rnd);
  stucco(g, W, Hp, S.plaster, rnd, 0.95);
  g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < Hp; y += 0.2 * K) g.fillRect(0, y, W, 1);
  for (let f = 0; f < n; f++) {
    const z0 = floorZ(f);
    for (let u = 1; u < L - 1; u += 3.2) {
      if (F.front && f > 0 && (Math.round(u / 3.2) % 2 === 0)) {
        g.fillStyle = ['#5d4a3a', '#3f5a6b', '#6b3a3a', '#4a5a3a'][(rnd() * 4) | 0]; g.fillRect(X(u), Y(z0 + 2.1), 0.9 * K, 2.1 * K);
        g.fillStyle = '#c9b25a'; g.fillRect(X(u + 0.75), Y(z0 + 1.05), 3, 3);
      } else {
        glass(g, X(u), Y(z0 + 2.1), 1.1 * K, 1.0 * K, '#5f7480', night, rnd, { frame: '#d9d5cc', lit: 0.5, blinds: true });
        winBars(g, X(u), Y(z0 + 2.1), 1.1 * K, 1.0 * K);
        if (!night && rnd() < 0.45) acUnit(g, X(u + 0.2), Y(z0 + 1.1), K);
      }
    }
    if (F.front && f > 0) {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, Y(z0), W, 0.5 * K);
      g.fillStyle = '#b8b3a8'; g.fillRect(0, Y(z0 + 0.05), W, 0.22 * K);
      g.fillStyle = '#5a5f63'; g.fillRect(0, Y(z0 + 1.05), W, 3); g.fillRect(0, Y(z0 + 0.6), W, 2);
      for (let u = 0; u < L; u += 1.2) g.fillRect(X(u), Y(z0 + 1.05), 2, 1.0 * K);
    }
  }
  // Versão Canvas 2D (sem WebGL): grafites da gangue deste território.
  // Pinta SOMENTE abaixo das janelas e entre os módulos de 3,2m, sem recobrir as aberturas.
  const gang=typeof OW!=='undefined'&&OW.geo?.gangAt?.((H.x0+H.x1)/2,(H.y0+H.y1)/2);
  if(gang&&!globalThis.cityArchitecture3D?.ready){
    for(let i=0;i<Math.min(5,Math.floor((L-2)/3.2));i++){
      const text=gang.art[(H.seed+i)%5],fs=.30*K,x=X(2.22+i*3.2),y=Y(.68);
      g.save();g.translate(x,y);g.rotate((rnd()-.5)*.10);
      g.font='900 '+fs+'px Impact,"Arial Black",sans-serif';g.lineJoin='round';
      const width=g.measureText(text).width;
      g.scale(Math.min(1,1.45*K/Math.max(1,width)),1);
      g.lineWidth=.11*K;g.strokeStyle='#12151b';g.strokeText(text,0,0);
      g.lineWidth=.04*K;g.strokeStyle='#e4f6ee';g.strokeText(text,0,0);
      g.fillStyle=gang.color;g.fillText(text,0,0);
      g.restore();
    }
  }
  groundGrime(F, 0.95);
  return F.c;
}

// ---- galpão (chapa ondulada, portas de enrolar, letreiro)
function facadeWarehouse(H, side, ext, rnd, night) {
  const F = bInit(H, side), { g, W, Hp, K, L, Y, X } = F, S = H.style;
  if (!ext) return interiorTex(H, F, rnd);
  const base = S.plaster;
  for (let x = 0; x < W; x += 0.18 * K) { const gr = g.createLinearGradient(x, 0, x + 0.18 * K, 0); gr.addColorStop(0, shadeHex(base, 0.82)); gr.addColorStop(0.4, shadeHex(base, 1.12)); gr.addColorStop(1, shadeHex(base, 0.86)); g.fillStyle = gr; g.fillRect(x, 0, 0.18 * K + 1, Hp); }
  for (let i = 0; i < W / 30; i++) { const x = rnd() * W, l = (1 + rnd() * 3) * K, gr = g.createLinearGradient(0, 0.4 * K, 0, l); gr.addColorStop(0, 'rgba(130,70,30,0.4)'); gr.addColorStop(1, 'rgba(130,70,30,0)'); g.fillStyle = gr; g.fillRect(x, 0.4 * K, 2 + rnd() * 3, l); }
  for (let u = 1; u < L - 1; u += 2.5) glass(g, X(u), Y(H.h - 0.8), 1.8 * K, 0.6 * K, '#8aa0aa', night, rnd, { frame: '#5d6266', lit: 0.3 });
  if (F.front) {
    for (let u = 2; u < L - 4; u += 6) {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(X(u) + 3, Y(4.2) + 3, 3.6 * K, 4.2 * K);
      g.fillStyle = '#b7b9b6'; g.fillRect(X(u), Y(4.2), 3.6 * K, 4.2 * K);
      g.fillStyle = 'rgba(0,0,0,0.18)'; for (let z = 0.2; z < 4.2; z += 0.12) g.fillRect(X(u), Y(z), 3.6 * K, 1);
      g.fillStyle = '#e2b42a'; for (let k = 0; k < 6; k++) g.fillRect(X(u) + k * 0.6 * K, Y(0.25), 0.3 * K, 0.25 * K);
    }
    signText(g, H.bName, X(L / 2 - 5), Y(H.h - 0.1) + 2, 10 * K, 0.7 * K, '#1f3d6b', '#ffffff', night, '#ffffff');
  }
  groundGrime(F, 0.8);
  return F.c;
}

// ---- comércio de rua (vitrines, toldo e letreiro; apartamentos em cima)
function facadeShop(H, side, ext, rnd, night) {
  const F = bInit(H, side), { g, W, Hp, K, L, Y, X } = F, S = H.style, n = H.nFloors;
  if (!ext) return interiorTex(H, F, rnd);
  stucco(g, W, Hp, S.plaster, rnd, S.aging);
  if (F.front) {
    const [txt, col] = H.shopSign;
    g.fillStyle = 'rgba(25,22,20,0.85)'; g.fillRect(X(0.4), Y(3.2), W - 0.8 * K, 3.2 * K);
    for (let u = 0.6; u < L - 0.6; u += 2.2) {
      glass(g, X(u), Y(3.0), 2.0 * K, 2.8 * K, '#6c90a6', night, rnd, { lit: 0.95, frame: '#3a3f44' });
      if (!night) { const pc = ['#e8364f', '#f5c518', '#2b8be6', '#ffffff']; g.fillStyle = pc[(rnd() * 4) | 0]; g.fillRect(X(u + 0.3), Y(2.2), 0.5 * K, 0.7 * K); }
    }
    awning(g, X(0.3), Y(3.55), W - 0.6 * K, 0.45 * K, col, '#f4f1ea');
    signText(g, txt, X(0.6), Y(4.15), W - 1.2 * K, 0.5 * K, col, '#ffffff', night, shadeHex(col, 1.5));
  } else for (let u = 1; u < L - 1; u += 2.6) { glass(g, X(u), Y(2.6), 1.2 * K, 1.2 * K, S.glassTint, night, rnd, { blinds: true }); if (H.poor) winBars(g, X(u), Y(2.6), 1.2 * K, 1.2 * K); }
  for (let f = 1; f < n; f++) { const z0 = floorZ(f); for (let u = 1; u < L - 1; u += 2.4) { glass(g, X(u), Y(z0 + 2.3), 1.2 * K, 1.3 * K, S.glassTint, night, rnd, { blinds: true }); if (H.poor) winBars(g, X(u), Y(z0 + 2.3), 1.2 * K, 1.3 * K); else if (!night && rnd() < 0.3) acUnit(g, X(u + 0.25), Y(z0 + 0.95), K); } }
  g.fillStyle = shadeHex(S.plaster, 1.08); g.fillRect(0, 0, W, 0.45 * K);
  groundGrime(F, S.aging);
  return F.c;
}
// lados N e E têm a textura correndo da direita p/ a esquerda de quem olha: espelha p/ letreiros legíveis
function facadeMirror(fn) {
  return (H, side, ext, rnd, night) => {
    const c = fn(H, side, ext, rnd, night);
    if (!ext || (side !== 'N' && side !== 'E')) return c;
    const m = makeCanvas(c.width, c.height), g = m.getContext('2d');
    g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); m.ppm = c.ppm;
    return m;
  };
}
const FACADES = Object.fromEntries(Object.entries({ deco: facadeDeco, condo: facadeCondo, office: facadeOffice, projects: facadeProjects, warehouse: facadeWarehouse, shop: facadeShop }).map(([k, f]) => [k, facadeMirror(f)]));
