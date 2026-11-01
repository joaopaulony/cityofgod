// debug.js — só p/ inspeção. Com ?scene=nome monta uma cena e congela o tempo p/ screenshot.
'use strict';
window.snap = (wx = player.x, wy = player.y, w = 80, hh = 100, sc = 3, slot = 0, z = 0.95) => {
  const p = proj(wx, wy, z);
  const c = document.createElement('canvas');
  c.width = w * sc; c.height = hh * sc;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(view, p.x - w / 2, p.y - hh / 2, w, hh, 0, 0, w * sc, hh * sc);
  let im = document.getElementById('dbg' + slot);
  if (!im) { im = document.body.appendChild(document.createElement('img')); im.id = 'dbg' + slot; }
  im.src = c.toDataURL();
  im.style.cssText = `position:fixed;left:${slot * (w * sc + 4)}px;top:0;z-index:99;outline:2px solid red`;
};
window.unsnap = () => document.querySelectorAll('[id^=dbg]').forEach(c => c.remove());
window.wait = ms => new Promise(r => setTimeout(r, ms));

const SCENE = new URLSearchParams(location.search).get('scene');
world.terrainSync = true;
const aimAt = (x, y, z = 1) => { const t = proj(x, y, z); input.mx = t.x * RS; input.my = t.y * RS; };
const place = (x, y, face) => { player.x = x; player.y = y; if (face !== undefined) player.face = face; cam.x = cam.tx = x; cam.y = cam.ty = y; };
const freeze = () => { window.__timeScale = 0; document.title = 'READY'; };
// renderiza poses de forma síncrona (headless não garante quadros entre timeouts)
function step(dt) { for (const a of actors) { a.clock = (a.clock || 0) + dt; a.pose = animate(a, dt); a.J = solveSkeleton(a, a.pose); } render(); }
async function turnaround(aim, mode) {
  window.__timeScale = 0; place(world.spawn[0], world.spawn[1]); zi = 5; cam.tzoom = cam.zoom = 64 * RENDER_SCALE; cam.update(1);
  for (let i = 0; i < 8; i++) {
    player.face = i * Math.PI / 4; player.moveA = player.face;
    if (aim) { player.aiming = true; player.aimV = 1; }
    if (mode === 'walk') { player.speed = 1.7; player.walkW = 1; player.phase = i / 8; player.face = Math.PI / 4; player.moveA = player.face; }
    if (mode === 'reload') { player.face = 0.5; player.reloadT = i * 0.3; player.events.length = 0; player.magState = i >= 2 && i < 5 ? 'hand' : 'in'; if (i === 2) player.magState = 'none'; }
    step(0.0001); snap(player.x, player.y, 58, 120, 2.6, i, 1.0);
  }
  document.title = 'READY';
}
const SCENES = {
  async shoot() {
    const [x, y] = world.spawn, [tx, ty] = world.targets[1]; place(x, y); zi = 3; cam.tzoom = cam.zoom = 42 * RENDER_SCALE;
    for (let i = 0; i < 40; i++) { aimAt(tx, ty); input.rmb = true; await wait(25); }
    fire(player.J); await wait(30); fire(player.J); window.__timeScale = 0.15; await wait(120); freeze();
  },
  async houses() { const H = houses[1] || houses[0]; place(H.front[0], H.front[1], 2.2); zi = 2; cam.tzoom = cam.zoom = 34 * RENDER_SCALE; await wait(500); freeze(); },
  async rotated() { const H = houses[1] || houses[0]; place(H.front[0], H.front[1], 2.2); zi = 2; cam.tzoom = cam.zoom = 34 * RENDER_SCALE; cam.ang = cam.tang = Math.PI / 4 + Math.PI; await wait(500); freeze(); },
  async inside() { const H = houses.find(h => h.inner && h.inner.length) || houses[0]; place((H.x0 + H.x1) / 2 - 1.5, (H.y0 + H.y1) / 2 + 0.5, 0.6); zi = 3; cam.tzoom = cam.zoom = 42 * RENDER_SCALE; await wait(500); freeze(); },
  async reload() {
    place(world.spawn[0], world.spawn[1], 0.9); zi = 5; cam.tzoom = cam.zoom = 64 * RENDER_SCALE; player.ammo = 3; await wait(300);
    player.reloadT = 0; await wait(Number(new URLSearchParams(location.search).get('t') || 650)); freeze();
  },
  async night() { const H = houses.find(h => h.brick) || houses[0]; place(H.front[0] + H.doorN[0] * 2, H.front[1] + H.doorN[1] * 2, 3.5); zi = 2; cam.tzoom = cam.zoom = 34 * RENDER_SCALE; st.night = world.night = true; st.clock = 21 * 60 + 5; await wait(600); freeze(); },
  async run() { place(world.spawn[0], world.spawn[1], 0); zi = 4; cam.tzoom = cam.zoom = 52 * RENDER_SCALE; input.keys.add('d'); input.keys.add('shift'); await wait(900); freeze(); },
  async overview() { place(MAP / 2, MAP / 2); player.x = world.spawn[0]; player.y = world.spawn[1]; zi = 0; cam.tzoom = cam.zoom = 9 * RENDER_SCALE; cam.x = cam.tx = MAP / 2; cam.y = cam.ty = MAP / 2; ZOOMS[0] = 9 * RENDER_SCALE; await wait(400); freeze(); },
  async facade() {   // close numa fachada: câmera de frente p/ a porta, jogador fora do caminho
    const H = houses[Number(new URLSearchParams(location.search).get('h') || 1)] || houses[0];
    const sd = H.sides[H.frontSide];
    place(H.front[0] + sd.n[0] * 6, H.front[1] + sd.n[1] * 6);
    const want = Math.atan2(-sd.n[0], sd.n[1]) + Math.PI / 4;   // gira p/ a fachada ficar de frente (3/4)
    cam.ang = cam.tang = Math.round((want - Math.PI / 4) / (Math.PI / 2)) * Math.PI / 2 + Math.PI / 4;
    zi = 5; cam.tzoom = cam.zoom = 64 * RENDER_SCALE; await wait(300);
    window.__timeScale = 0; cam.x = cam.tx = H.front[0] - sd.n[0] * 2; cam.y = cam.ty = H.front[1] - sd.n[1] * 2; cam.update(0); await wait(200); freeze();
  },
  async rocks() {   // galeria: todas as variações de pedra sobre um fundo de grama
    const t0 = performance.now(), list = []; for (let i = 0; i < 24; i++) list.push(makeRock());
    const ms = performance.now() - t0, c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    const g2 = c.getContext('2d'); g2.fillStyle = '#5d7a34'; g2.fillRect(0, 0, 1280, 720);
    list.forEach((sp, i) => { const x = 110 + (i % 8) * 152, y = 200 + Math.floor(i / 8) * 220, k = 84 / sp.ppm; g2.drawImage(sp.img, x - sp.ax * k, y - sp.ay * k, sp.img.width * k, sp.img.height * k); g2.fillStyle = '#fff'; g2.font = '12px sans-serif'; g2.fillText(sp.kind + ' ' + sp.r.toFixed(2) + 'm', x - 40, y + 40); });
    g2.fillStyle = '#fff'; g2.fillText(`24 pedras em ${ms | 0} ms`, 10, 20);
    const im = new Image(); im.src = c.toDataURL(); im.style.cssText = 'position:fixed;inset:0;z-index:99'; document.body.append(im); freeze();
  },
  async pond() { const p = world.pond; if (!p) return freeze(); place(p.x + p.rx + 1.5, p.y + 0.5); zi = 2; cam.tzoom = cam.zoom = 34 * RENDER_SCALE; await wait(500); freeze(); },
  async turn() { await turnaround(false); },
  async aimturn() { await turnaround(true); },
  async walk() { await turnaround(false, 'walk'); },
  async reloadseq() { await turnaround(false, 'reload'); },
};

// ---------- gravação roteirizada (gameplay p/ GIF) ----------
// cada demoStep() avança 1/FPS s do roteiro e desenha um quadro
const DEMO_FPS = 12;
let demoT = 0;
function aimWorld(x, y, z = 1.2) { const t = proj(x, y, z); input.mx = t.x * RS; input.my = t.y * RS; }
function walkToward(x, y, run) {
  // converte a direção no mundo p/ teclas WASD relativas à tela
  const r = rot(x, y), l = Math.hypot(r[0], r[1]);
  for (const k of ['w', 'a', 's', 'd', 'shift']) input.keys.delete(k);
  if (l < 0.4) return;
  const sx = r[0] / l, sy = r[1] / l;
  if (sx > 0.38) input.keys.add('d'); if (sx < -0.38) input.keys.add('a');
  if (sy > 0.38) input.keys.add('s'); if (sy < -0.38) input.keys.add('w');
  if (run) input.keys.add('shift');
}
const between = (t, a, b) => t >= a && t < b;
window.demoStep = () => {
  const t = demoT, [sx, sy] = world.spawn, T3 = world.targets, a = world.aimDir;
  const side = [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)];
  const P1 = [sx + side[0] * 2.5 - Math.cos(a) * 0.5, sy + side[1] * 2.5 - Math.sin(a) * 0.5];
  const tgt = t < 3.5 ? T3[0] : t < 4.4 ? T3[1] : T3[2];
  // 0–1.6s anda de lado; depois para
  if (between(t, 0, 1.6)) { walkToward(P1[0], P1[1]); aimWorld(T3[1][0], T3[1][1]); }
  else walkToward(player.x, player.y);
  // mira e atira (cliques curtos e depois rajada)
  input.rmb = between(t, 1.7, 5.5) || between(t, 9.0, 10.2);
  if (input.rmb) aimWorld(tgt[0], tgt[1]);
  for (const c of [2.4, 2.8, 3.2, 3.8, 4.15, 9.5, 9.8]) if (Math.abs(t - c) < 0.5 / DEMO_FPS) player.wantShot = true;
  input.lmb = between(t, 4.6, 5.3);
  // recarga
  if (Math.abs(t - 5.7) < 0.5 / DEMO_FPS) input.pressed.add('r');
  // gira a câmera com Q e E
  for (const [c, k] of [[8.4, 1], [9.2, 1], [10.6, -1], [12.9, -1]]) if (Math.abs(t - c) < 0.5 / DEMO_FPS) cam.tang += k * Math.PI / 2;
  // corre em direção à casa mais próxima
  if (between(t, 10.4, 12.8)) {
    const H = houses.slice().sort((p, q) => Math.hypot(p.front[0] - sx, p.front[1] - sy) - Math.hypot(q.front[0] - sx, q.front[1] - sy))[0];
    walkToward(H ? H.front[0] : sx + 8, H ? H.front[1] : sy, true);
    aimWorld(player.x + Math.cos(player.face) * 4, player.y + Math.sin(player.face) * 4);
  }
  const sub = 3;
  for (let i = 0; i < sub; i++) tick(1 / DEMO_FPS / sub);
  demoT += 1 / DEMO_FPS;
  return demoT;
};
SCENES.demo = async () => {
  window.__manual = true; zi = 2; cam.tzoom = cam.zoom = 34 * RENDER_SCALE;
  player.face = world.aimDir; cam.x = cam.tx = player.x; cam.y = cam.ty = player.y;
  document.title = 'READY';
};
if (SCENE && SCENES[SCENE]) addEventListener('load', () => setTimeout(() => SCENES[SCENE](), 200));
