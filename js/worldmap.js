// worldmap.js — minimapa e mapa completo (tecla M).
// Mundo grande: base do atlas (worldgen/atlas-paint.js, 4 m/px) pintada em fatias depois da carga, com vias vetoriais
// nítidas por cima; o mapa completo cacheia a imagem e só a refaz ao mudar zoom/posição (roda = zoom, arrastar = mover).
// Mapa local de teste (?seed=N): usa a textura do chão (world.ground).
'use strict';

const wmap = { open: false, mini: null, base: null, scale: 0, ox: 0, oy: 0, cache: null, key: '', drag: null, clickStart: null };

// um pedaço de base por quadro (~3 ms): primeiro a do minimapa (sem telhados sugeridos), depois a do mapa completo;
// com o mapa aberto a do mapa termina de uma vez
function wmapTick() {
  if (!world.open || typeof OW === 'undefined' || !OW.cw) return;
  if (!wmap.mini) { wmap.mini = COG.atlasBase(OW.cw, COG.WORLD_SEED, 4, { roofs: false }); wmap.base = COG.atlasBase(OW.cw, COG.WORLD_SEED, 4); }
  if (wmap.open) wmap.base.step(Infinity);
  else if (!wmap.mini.done) wmap.mini.step(3);
  else if (!wmap.base.done) wmap.base.step(3);
}

function wmapToggle() {
  wmap.open = !wmap.open; wmap.drag = null;
  document.body.classList.toggle('map-open', wmap.open);   // esconde chat e lista de teclas por cima do mapa
  if (wmap.open) wmap.scale = 0;   // reabre enquadrado no mundo inteiro
}

// ---------- minimapa (girado com a câmera) ----------
function drawMiniMap(h, mx, my, ms, p, st) {
  h.fillStyle = '#29331f'; h.fillRect(mx, my, ms, ms);
  const k = world.open ? 1.5 : 2.6;   // px por metro no mini
  const c = Math.cos(cam.ang), s = Math.sin(cam.ang), ex = mx + ms / 2 - (c * p.x - s * p.y) * k, ey = my + ms / 2 - (s * p.x + c * p.y) * k;
  const T = sc => h.setTransform(c * k * sc, s * k * sc, -s * k * sc, c * k * sc, ex, ey);
  h.imageSmoothingEnabled = true;
  if (!world.open) {
    T(1 / world.groundPPM); h.drawImage(world.ground, 0, 0);
    T(1);
    for (const H of houses) { h.fillStyle = H.style ? H.style.roofCol : H.roof; h.strokeStyle = '#000'; h.lineWidth = 0.2; h.fillRect(H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0); h.strokeRect(H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0); }
  } else {
    const B = wmap.mini && wmap.mini.done ? wmap.mini : null;
    if (B) { T(B.BP); h.drawImage(B.canvas, 0, 0); } else { T(1 / world.groundPPM); h.drawImage(world.ground, 0, 0); }
    // vias: só os trechos indexados em volta do jogador, contorno escuro + miolo por categoria
    T(1); h.lineCap = 'round'; h.lineJoin = 'round';
    const R = ms / k * 0.75, segs = [];
    OW.cw.roadIndex.query([p.x - R, p.y - R, p.x + R, p.y + R], e => { if (e.rd.cls !== 'rail') segs.push(e); });
    segs.sort((a, b) => (a.rd.cls === 'highway') - (b.rd.cls === 'highway'));
    for (const pass of [0, 1]) for (const { rd, k: i0 } of segs) {
      h.strokeStyle = pass ? (rd.cls === 'highway' ? '#f2c25a' : rd.cls === 'avenue' ? '#f4efe4' : '#e4dfd4') : 'rgba(28,24,20,0.85)';
      h.lineWidth = Math.max(rd.w, 4 / k) + (pass ? 0 : 2.4 / k);
      h.beginPath(); for (let i = i0; i < Math.min(rd.pts.length, i0 + 9); i++) { const [x, y] = rd.pts[i]; i === i0 ? h.moveTo(x, y) : h.lineTo(x, y); } h.stroke();
    }
    // prédios carregados por perto: telhado claro com contorno, torres um pouco mais escuras
    h.lineWidth = 1 / k; h.strokeStyle = 'rgba(30,26,22,0.9)';
    for (const H of houses) {
      if (H.x1 < p.x - R || H.x0 > p.x + R || H.y1 < p.y - R || H.y0 > p.y + R) continue;
      h.fillStyle = H.tall ? '#bdb8b0' : H.miaKind === 'poor' ? '#b49a7e' : '#e6ddcc';
      h.fillRect(H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0); h.strokeRect(H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0);
    }
  }
  T(1);
  for (const n of st.npcs) { h.fillStyle = '#f2c94c'; h.beginPath(); h.arc(n.x, n.y, 0.8 * 2.6 / k, 0, TAU); h.fill(); }
}

// ---------- mapa completo ----------
function wmapWorldSize() { return world.open ? [OW.geo.W, OW.geo.H] : [world.ground.width / world.groundPPM, world.ground.height / world.groundPPM]; }
function wmapFit(W, H) {
  const [ww, wh] = wmapWorldSize(), top = 64, bot = 40;
  wmap.scale = Math.min((W - 40) / ww, (H - top - bot) / wh);
  wmap.ox = (W - ww * wmap.scale) / 2; wmap.oy = top + (H - top - bot - wh * wmap.scale) / 2;
}
function wmapZoomAt(sx, sy, f) {
  if (!wmap.scale) return;
  const [ww, wh] = wmapWorldSize(), W = hudC.width, H = hudC.height, min = Math.min((W - 40) / ww, (H - 104) / wh) * 0.8;
  const ns = clamp(wmap.scale * f, min, 4);
  wmap.ox = sx - (sx - wmap.ox) * ns / wmap.scale; wmap.oy = sy - (sy - wmap.oy) * ns / wmap.scale; wmap.scale = ns;
}
function drawWorldMap(h, W, H, st) {
  const p = st.player;
  if (!wmap.scale) wmapFit(W, H);
  const sc = wmap.scale, S = (x, y) => [wmap.ox + x * sc, wmap.oy + y * sc];
  const key = [W, H, sc.toFixed(5), wmap.ox | 0, wmap.oy | 0, !!(wmap.base && wmap.base.done)].join('|');
  if (wmap.key !== key) {   // refaz a imagem só quando o enquadramento muda
    const cv = wmap.cache && wmap.cache.width === W && wmap.cache.height === H ? wmap.cache : makeCanvas(W, H), g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#163b5f'; g.fillRect(0, 0, W, H);
    const [ww, wh] = wmapWorldSize();
    if (world.open) {
      g.imageSmoothingEnabled = sc < 1 / wmap.base.BP; g.drawImage(wmap.base.canvas, wmap.ox, wmap.oy, ww * sc, wh * sc);
      COG.drawAtlasLayers(g, OW.cw, S, sc, 1);
    } else {
      g.imageSmoothingEnabled = true; g.drawImage(world.ground, wmap.ox, wmap.oy, ww * sc, wh * sc);
      g.setTransform(sc, 0, 0, sc, wmap.ox, wmap.oy);
      for (const Hs of houses) { g.fillStyle = '#e6ddcc'; g.strokeStyle = '#2a241e'; g.lineWidth = 1 / sc; g.fillRect(Hs.x0, Hs.y0, Hs.x1 - Hs.x0, Hs.y1 - Hs.y0); g.strokeRect(Hs.x0, Hs.y0, Hs.x1 - Hs.x0, Hs.y1 - Hs.y0); }
    }
    wmap.cache = cv; wmap.key = key;
  }
  h.save(); h.setTransform(1, 0, 0, 1, 0, 0);
  h.drawImage(wmap.cache, 0, 0);
  window.CityGPS?.drawFull(h,S,st);
  // jogador: halo pulsante + seta na direção em que olha
  const [px, py] = S(p.x, p.y), pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
  h.fillStyle = `rgba(255,77,61,${0.18 + pulse * 0.2})`; h.beginPath(); h.arc(px, py, 14 + pulse * 6, 0, TAU); h.fill();
  h.translate(px, py); h.rotate(p.face);
  h.fillStyle = '#ff4d3d'; h.strokeStyle = '#fff'; h.lineWidth = 2; h.beginPath(); h.moveTo(11, 0); h.lineTo(-7, -7); h.lineTo(-3, 0); h.lineTo(-7, 7); h.closePath(); h.fill(); h.stroke();
  h.setTransform(1, 0, 0, 1, 0, 0);
  // barra de título, norte e escala
  h.fillStyle = 'rgba(15,12,10,0.82)'; h.fillRect(0, 0, W, 52);
  h.fillStyle = '#fff6e0'; h.font = 'bold 20px "Segoe UI", sans-serif'; h.textAlign = 'left'; h.textBaseline = 'middle'; h.fillText('MAPA', 20, 26);
  h.fillStyle = '#cfc8be'; h.font = '13px "Segoe UI", sans-serif'; h.fillText('M/Esc fechar · roda zoom · arraste · clique no local para GPS', 92, 27);
  h.textAlign = 'right'; h.fillText(`você: ${Math.round(p.x)}, ${Math.round(p.y)}`, W - 20, 27);
  h.textAlign = 'center'; h.fillStyle = '#fff'; h.font = 'bold 14px sans-serif'; h.fillText('N ▲', W - 40, 76);
  const m = [2000, 1000, 500, 250, 100, 50, 20, 10].find(v => v * sc <= 180) || 10, bar = m * sc, bx = 20, by = H - 22;
  h.fillStyle = 'rgba(15,12,10,0.75)'; h.fillRect(bx - 8, by - 22, Math.max(bar, 40) + 16, 32);
  h.fillStyle = '#fff'; h.fillRect(bx, by, bar, 4); h.font = '600 12px system-ui'; h.textAlign = 'left'; h.fillText(m >= 1000 ? m / 1000 + ' km' : m + ' m', bx, by - 9);
  h.restore();
}
