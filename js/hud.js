// hud.js — retrato pixelado, barras, relógio, minimapa, hotbar e mira (canvas em resolução cheia).
'use strict';

const hud = { portrait: null, msg: '', msgT: 0 };

function roundRect(g, x, y, w, h, r, fill, stroke) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); }
}

function drawHUD(h, W, H, st) {
  h.clearRect(0, 0, W, H);
  h.imageSmoothingEnabled = false;
  const p = st.player;
  // retrato + barras (vida / fome / sede)
  if (!hud.portrait) hud.portrait = paintPortrait(48);
  h.save();
  h.beginPath(); h.arc(58, 58, 46, 0, TAU); h.fillStyle = '#000'; h.fill();
  h.beginPath(); h.arc(58, 58, 43, 0, TAU); h.clip();
  h.drawImage(hud.portrait, 12, 12, 96, 96);
  h.restore();
  h.beginPath(); h.arc(58, 58, 44, 0, TAU); h.strokeStyle = '#2a2420'; h.lineWidth = 3; h.stroke();
  const bars = [['#d8433a', st.hp, '♥'], ['#e39a35', st.food, '●'], ['#3f8fd8', st.water, '●']];
  bars.forEach(([col, v, ic], i) => {
    const y = 22 + i * 26;
    roundRect(h, 108, y, 168, 18, 9, 'rgba(15,13,12,.85)', '#000');
    roundRect(h, 128, y + 4, 140 * v, 10, 5, col);
    h.fillStyle = 'rgba(255,255,255,.25)'; h.fillRect(132, y + 5, 140 * v - 8, 2);
    h.fillStyle = col; h.font = 'bold 13px sans-serif'; h.textAlign = 'center'; h.textBaseline = 'middle'; h.fillText(ic, 118, y + 9.5);
  });
  // botões laterais (só visuais, como nas referências)
  for (let i = 0; i < 4; i++) {
    roundRect(h, 18, 124 + i * 52, 44, 44, 8, 'rgba(18,16,15,.85)', '#000');
    h.strokeStyle = '#d9d2c7'; h.lineWidth = 2.5; h.lineCap = 'round';
    const cx = 40, cy = 146 + i * 52;
    h.beginPath();
    if (i === 0) { h.moveTo(cx - 9, cy - 9); h.lineTo(cx + 9, cy + 9); h.moveTo(cx + 9, cy - 9); h.lineTo(cx - 9, cy + 9); }
    if (i === 1) { h.roundRect(cx - 8, cy - 7, 16, 16, 3); h.moveTo(cx - 4, cy - 7); h.lineTo(cx - 4, cy - 11); h.lineTo(cx + 4, cy - 11); h.lineTo(cx + 4, cy - 7); }
    if (i === 2) { h.roundRect(cx - 6, cy - 10, 12, 20, 2); }
    if (i === 3) { h.arc(cx, cy, 6, 0, TAU); for (let k = 0; k < 8; k++) { const a = k * TAU / 8; h.moveTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8); h.lineTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11); } }
    h.stroke();
  }
  // relógio
  const mins = Math.floor(st.clock) % 1440, hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(mins % 60).padStart(2, '0');
  roundRect(h, W - 360, 14, 160, 58, 8, 'rgba(18,16,15,.85)', '#000');
  h.fillStyle = '#fff'; h.font = 'bold 28px "Segoe UI", sans-serif'; h.textAlign = 'center'; h.textBaseline = 'alphabetic';
  h.fillText(`${hh}:${mm}`, W - 280, 46); h.font = '12px "Segoe UI", sans-serif'; h.fillStyle = '#cfc8be'; h.fillText('Qua, 21 Out 2026', W - 280, 63);
  // clima atual (env.js) logo abaixo do relógio
  const wl = envWeather().name + (ENV.snowCover > 0.05 ? ' · neve no chão' : '');
  h.font = '11px "Segoe UI", sans-serif'; const ww = h.measureText(wl).width + 16;
  roundRect(h, W - 280 - ww / 2, 76, ww, 18, 9, 'rgba(18,16,15,.7)', null); h.fillStyle = '#e8e2d8'; h.fillText(wl, W - 280, 89);
  // minimapa girado com a câmera (worldmap.js)
  const mx = W - 186, my = 14, ms = 172;
  wmapTick();
  roundRect(h, mx - 3, my - 3, ms + 6, ms + 6, 8, '#000');
  h.save(); h.beginPath(); h.roundRect(mx, my, ms, ms, 6); h.clip();
  drawMiniMap(h, mx, my, ms, p, st);
  h.restore();
  // seta do jogador + norte
  h.save(); h.translate(mx + ms / 2, my + ms / 2); h.rotate(p.face + cam.ang);
  h.fillStyle = '#fff'; h.strokeStyle = '#000'; h.lineWidth = 1.5; h.beginPath(); h.moveTo(8, 0); h.lineTo(-5, -5); h.lineTo(-2, 0); h.lineTo(-5, 5); h.closePath(); h.fill(); h.stroke(); h.restore();
  const north = screenDirOf(0, -1);
  h.fillStyle = '#fff'; h.font = 'bold 12px sans-serif'; h.textAlign = 'center';
  h.fillText('N', mx + ms / 2 + north[0] * (ms / 2 - 10), my + ms / 2 + north[1] * (ms / 2 - 10) + 4);
  h.fillStyle = '#e8e2d8'; h.font = 'bold 12px sans-serif'; h.fillText('Q / E  gira  ·  M  mapa', mx + ms / 2, my + ms + 18);

  // hotbar
  const slots = 7, sw = 54, hx = W / 2 - slots * sw / 2, hy = H - 80;
  roundRect(h, hx - 8, hy - 8, slots * sw + 16, 74, 8, 'rgba(18,16,15,.85)', '#000');
  for (let i = 0; i < slots; i++) {
    const x = hx + i * sw;
    roundRect(h, x + 2, hy, sw - 4, 58, 6, i === 0 ? '#2e2823' : '#1c1916', i === 0 ? '#c9a45c' : '#000');
    h.fillStyle = '#9a928a'; h.font = '11px sans-serif'; h.textAlign = 'left'; h.fillText(String(i + 1), x + 7, hy + 13);
    drawIcon(h, i, x + sw / 2, hy + 30);
  }
  h.fillStyle = '#fff'; h.font = 'bold 12px sans-serif'; h.textAlign = 'right';
  h.fillText(`${p.ammo}/${p.reserve}`, hx + sw - 6, hy + 53);

  // mira
  const cx = input.mx, cy = input.my;
  h.strokeStyle = '#000'; h.lineWidth = 4; crosshair(h, cx, cy, p);
  h.strokeStyle = p.ammo === 0 ? '#ff6b5a' : '#ffffff'; h.lineWidth = 2; crosshair(h, cx, cy, p);
  if (p.reloadT >= 0) {
    h.strokeStyle = '#f2c94c'; h.lineWidth = 3; h.beginPath(); h.arc(cx, cy, 20, -Math.PI / 2, -Math.PI / 2 + TAU * p.reloadT / RELOAD.dur); h.stroke();
  }
  // aviso central
  if (hud.msgT > 0) {
    h.globalAlpha = clamp(hud.msgT, 0, 1);
    h.font = 'bold 16px "Segoe UI", sans-serif'; h.textAlign = 'center';
    h.fillStyle = '#000'; h.fillText(hud.msg, W / 2 + 1, H - 104 + 1); h.fillStyle = '#ffe6a8'; h.fillText(hud.msg, W / 2, H - 104);
    h.globalAlpha = 1;
  }
}
function screenDirOf(wx, wy) { const r = [cam.cos * wx - cam.sin * wy, (cam.sin * wx + cam.cos * wy)]; const l = Math.hypot(r[0], r[1]); return [r[0] / l, r[1] / l]; }

function crosshair(h, x, y, p) {
  const sp = 6 + (1 - p.aimV) * 10 + Math.max(0, 0.2 - p.recoilT) * 40;
  h.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { h.moveTo(x + dx * sp, y + dy * sp); h.lineTo(x + dx * (sp + 7), y + dy * (sp + 7)); }
  h.moveTo(x + 1, y); h.arc(x, y, 1, 0, TAU);
  h.stroke();
}

function drawIcon(h, i, x, y) {
  h.save(); h.translate(x, y); h.lineJoin = 'round'; h.lineCap = 'round';
  const P = (pts, f) => { h.beginPath(); pts.forEach(([a, b], k) => k ? h.lineTo(a, b) : h.moveTo(a, b)); h.closePath(); h.fillStyle = f; h.fill(); h.strokeStyle = '#000'; h.lineWidth = 1.5; h.stroke(); };
  if (i === 0) {   // fuzil
    P([[-24, -2], [-12, -6], [8, -6], [8, -4], [24, -4], [24, -2], [8, -2], [6, 1], [-6, 1], [-8, 7], [-12, 7], [-11, 1], [-24, 4]], '#3a3a40');
    P([[-2, 1], [2, 1], [4, 10], [0, 10]], '#2a2a2e');
    P([[6, -6], [18, -6], [18, -2], [6, -2]], '#4a5644');
  } else if (i === 1) { P([[-8, 10], [-10, -4], [-6, -10], [6, -10], [10, -4], [8, 10]], '#e0a070'); }
  else if (i === 2) { P([[-7, -12], [7, -12], [7, 12], [-7, 12]], '#2a2d33'); h.fillStyle = '#5f86a6'; h.fillRect(-5, -9, 10, 16); }
  else if (i === 3) { P([[-11, 0], [-9, -8], [9, -8], [11, 0]], '#d99a3a'); P([[-12, 1], [12, 1], [12, 4], [-12, 4]], '#6b3a1e'); P([[-11, 5], [11, 5], [9, 10], [-9, 10]], '#d99a3a'); }
  else if (i === 4) { P([[-5, -6], [-3, -12], [3, -12], [5, -6], [5, 12], [-5, 12]], '#9cc8e6'); }
  else if (i === 5) { P([[-12, -8], [12, -8], [12, 10], [-12, 10]], '#d33b2c'); h.fillStyle = '#fff'; h.fillRect(-2, -5, 4, 12); h.fillRect(-6, -1, 12, 4); }
  else { P([[-3, -12], [3, -12], [3, 6], [6, 12], [-6, 12], [-3, 6]], '#9a9aa2'); }
  h.restore();
}
