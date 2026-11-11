// tools/urban-ink-capture.js — cena de referência, capturas e medição do URBAN INK (cole no console ou carregue
// com <script src>, com o jogo já rodando; servidor "shots": `node tools/quaternius/shot-server.mjs`, porta 4323).
//   await inkScene('house')          → câmera/hora fixas na cena de referência (casa, rua, calçada, árvores, carro)
//   await inkSet({ink:false})        → estilo original (true = Urban Ink); demais chaves: inkOutline, inkToon, ...
//   await inkShot('nome')            → compõe as telas do jogo (chão GPU + 2D + 3D, com os filtros CSS) e grava .shots/nome.jpg
//   await inkBench(240)              → mede quadro (ms), passe 3D, draw calls, triângulos, programas e geometrias
(() => {
  'use strict';
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // cenas fixas: mesmo ponto, zoom, ângulo e hora em todas as comparações
  const SCENES = {
    house: { x: 1942, y: 1176, zoom: 48, clock: 17 * 60 + 44 },
    houseClose: { x: 1944, y: 1168, zoom: 76, clock: 17 * 60 + 44 },
    dusk: { x: 1942, y: 1176, zoom: 48, clock: 19 * 60 + 5 },
    night: { x: 1942, y: 1176, zoom: 48, clock: 22 * 60 + 30 },
    noon: { x: 1942, y: 1176, zoom: 48, clock: 12 * 60 },
    // interior da referência 1: sala da casa 1923_1169_6x13 (guarda-roupa à esquerda, cozinha ao fundo); a casa
    // precisa ser do jogador p/ o corte do telhado (CityRealty.buy no save de teste)
    interior: { x: 1924.2, y: 1167.2, camX: 1924.5, camY: 1165.5, zoom: 105, clock: 11 * 60 },
    interiorNight: { x: 1924.2, y: 1167.2, camX: 1924.5, camY: 1165.5, zoom: 105, clock: 22 * 60 + 30 },
  };
  async function inkScene(name = 'house', extra = {}) {
    const s = { ...(SCENES[name] || SCENES.house), ...extra }, g = window.__game, p = g.player, w = g.world;
    await w.prepareResume?.(s.x, s.y);
    Object.assign(p, { x: s.x, y: s.y, floor: 0, floorZ: 0 });
    g.cam.x = g.cam.tx = s.camX ?? p.x; g.cam.y = g.cam.ty = s.camY ?? p.y; g.cam.ang = g.cam.tang = s.ang ?? Math.PI / 4;
    g.cam.tzoom = g.cam.zoom = s.zoom; g.st.clock = Math.floor(g.st.clock / 1440) * 1440 + s.clock; w.version++;
    window.__timeScale = 1; await wait(s.settle ?? 4000); await groundReady(); window.__timeScale = 0;
    g.cam.zoom = g.cam.tzoom = s.zoom; g.cam.x = g.cam.tx = s.camX ?? p.x; g.cam.y = g.cam.ty = s.camY ?? p.y;   // entrar em casa mexe na câmera
    return s;
  }
  // espera o chão 2D (terrain.js) terminar de repintar os blocos da vista
  async function groundReady(max = 25000) {
    const t0 = performance.now();
    while (performance.now() - t0 < max) {
      const ch = typeof terrain !== 'undefined' ? [...terrain.chunks.values()].filter(c => c.used >= terrain.frame - 2) : [];
      if (ch.length && ch.every(c => c.done)) return true;
      await wait(250);
    }
    return false;
  }
  async function inkSet(o = {}) {
    const s = { ...window.CityFront.settings, ...o };
    window.__timeScale = 1; window.cityVehicles.applyInk(s);
    await wait(1500); await groundReady(); await wait(800);
    window.__timeScale = 0;   // congela carros/pessoas p/ as duas capturas serem do mesmo instante
    return s;
  }
  const filterOf = el => getComputedStyle(el).filter.replace(/brightness\(var[^)]*\)\)?/, '');
  async function inkShot(name) {
    const v = document.getElementById('view'), W = v.width, H = v.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.fillStyle = '#14110f'; g.fillRect(0, 0, W, H);
    const gg = document.getElementById('ground-gpu');
    if (gg && window.GroundGPU?.draw(gg.width, gg.height)) { g.filter = filterOf(gg); g.drawImage(gg, 0, 0, W, H); }
    g.filter = filterOf(v); g.drawImage(v, 0, 0, W, H);
    // a tela WebGL é lida no mesmo quadro em que foi desenhada
    const v3 = document.getElementById('vehicle3d'); window.cityVehicles.render();
    g.filter = filterOf(v3); g.drawImage(v3, 0, 0, W, H); g.filter = 'none';
    await fetch('/__shot?name=' + encodeURIComponent(name), { method: 'POST', body: c.toDataURL('image/jpeg', 0.92) });
    return { name, W, H };
  }
  async function inkBench(frames = 240) {
    const sys = window.cityVehicles, r = sys.renderer, times = [], draw = [];
    let calls = 0, tris = 0, last = performance.now();
    for (let i = 0; i < frames; i++) {
      await new Promise(requestAnimationFrame);
      const now = performance.now(); times.push(now - last); last = now;
      draw.push(sys.layerMs?.draw || 0); calls += r.info.render.calls; tris += r.info.render.triangles;
    }
    times.sort((a, b) => a - b); const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
    // custo real do quadro 3D (CPU + GPU): desenha e espera a placa terminar lendo 1 pixel
    const gl = r.getContext(), px = new Uint8Array(4), sync = [];
    for (let i = 0; i < 40; i++) { const t0 = performance.now(); sys.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); sync.push(performance.now() - t0); }
    sync.sort((a, b) => a - b);
    return {
      gpuSyncMs: +sync[Math.floor(sync.length / 2)].toFixed(2), gpuSyncP90Ms: +sync[Math.floor(sync.length * 0.9)].toFixed(2),
      ink: !!sys.urbanInk?.enabled, quality: sys.urbanInk?.quality, frames,
      frameMs: +avg(times).toFixed(2), p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(2), fps: +(1000 / avg(times)).toFixed(1),
      drawPassMs: +avg(draw).toFixed(2), drawCalls: Math.round(calls / frames), triangles: Math.round(tris / frames),
      programs: r.info.programs?.length || 0, geometries: r.info.memory.geometries, textures: r.info.memory.textures,
      pixelRatio: r.getPixelRatio(),
    };
  }
  Object.assign(window, { inkScene, inkSet, inkShot, inkBench, groundReady, INK_SCENES: SCENES });
})();
