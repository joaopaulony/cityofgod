// work-3d.mjs — o home office aparece no mundo: o monitor liga e mostra o trabalho (código rolando, terminal do
// suporte, arte em edição, transmissão com chat) e o estoque da loja vira caixas de papelão nas estantes e na pilha
// de envio ao lado da mesa. Lê só o estado público de CityDesk.screenInfo() e CityCommerce.visuals(); nada aqui decide regra.
// Coordenadas: mundo (x, y, altura) → three (x, altura, y).
export function installWork3D(THREE, scene, bridge) {
  const P = () => bridge.player;
  // ---------- monitor ----------
  const W = 512, H = 300, canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d'), tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace || tex.colorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.06, .62), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.visible = false; screen.renderOrder = 3; screen.userData.noSnow = true; scene.add(screen);
  const glow = new THREE.PointLight(0x9fc7ff, 0, 2.6, 2); scene.add(glow);
  let t = 0, drawT = 0;
  const CODE = ['function validar(pedido) {', '  if (!pedido.itens.length)', '    return erro("vazio");', '  const total = somar(pedido);', '  cobrar(total);', '  return ok(pedido.id);', '}', '', 'teste("pedido vazio", () => {', '  esperar(validar({itens:[]}))', '    .igual("vazio");', '});', 'const regras = [', '  { qtd: "<= 5", então: "alertar" },', '];', '// TODO: revisar cupom'];
  const KW = /\b(function|return|const|if|teste|esperar)\b/g;
  function drawCode(info) {
    g.fillStyle = '#14191f'; g.fillRect(0, 0, W, H); g.fillStyle = '#1d242c'; g.fillRect(0, 0, W, 22);
    g.font = '12px Consolas,monospace'; g.fillStyle = '#9fb0c0'; g.fillText('CodeLab · ' + (info.title || ''), 10, 15);
    const shift = Math.floor(t * 2.2), rows = 15;
    g.font = '14px Consolas,monospace';
    for (let i = 0; i < rows; i++) {
      const line = CODE[(shift + i) % CODE.length], y = 42 + i * 17;
      g.fillStyle = '#4b5865'; g.fillText(String((shift + i) % 99 + 1).padStart(2, ' '), 8, y);
      let x = 36; for (const part of line.split(KW)) { if (!part) continue; g.fillStyle = KW.test(part) ? '#f5bf60' : /".*"/.test(part) ? '#7ed3a7' : '#dfe6ec'; KW.lastIndex = 0; g.fillText(part, x, y); x += g.measureText(part).width; }
    }
    if (Math.floor(t * 2) % 2) { g.fillStyle = '#f5bf60'; g.fillRect(36 + ((t * 40) % 220), 42 + 14 * 17 - 12, 8, 14); }
    bar(info.progress, '#f5bf60');
  }
  function drawHelp(info) {
    g.fillStyle = '#0c1210'; g.fillRect(0, 0, W, H); g.font = '13px Consolas,monospace';
    const lines = info.lines?.length ? info.lines : ['> ping 8.8.8.8', 'Resposta em 20 ms', '> nslookup cityweb', 'Servidor: 10.0.0.1'];
    const n = Math.min(lines.length, 1 + Math.floor(t * 1.5) % (lines.length + 4));
    g.fillStyle = '#7ed3a7'; g.fillText('HelpDesk City · chamado ' + (info.title || ''), 10, 20);
    lines.slice(0, n).forEach((l, i) => { g.fillStyle = l.startsWith('>') ? '#f0c35a' : '#cfe8da'; g.fillText(String(l).slice(0, 58), 10, 46 + i * 18); });
    bar(info.progress, '#7ed3a7');
  }
  function drawDesign(info) {
    g.fillStyle = '#e9e6df'; g.fillRect(0, 0, W, H); g.fillStyle = '#2b2f33'; g.fillRect(0, 0, 70, H); g.fillRect(W - 90, 0, 90, H);
    const c = info.colors || ['#5b3a29', '#e8c39e'], k = info.progress || 0;
    g.fillStyle = c[1] || '#fff'; g.fillRect(110, 40, 270, 220);
    g.fillStyle = c[0]; g.globalAlpha = Math.min(1, k * 2); g.beginPath(); g.arc(245, 130, 30 + 30 * Math.min(1, k * 1.6), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    if (k > .45) { g.fillStyle = c[0]; g.font = 'bold 22px Georgia,serif'; g.textAlign = 'center'; g.fillText(String(info.text || '').slice(0, 18 * Math.min(1, (k - .45) * 3) | 0), 245, 222); g.textAlign = 'left'; }
    // cursor do mouse passeando
    const mx = 160 + Math.sin(t * 1.3) * 90, my = 140 + Math.cos(t * 1.7) * 70;
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + 10, my + 14); g.lineTo(mx + 4, my + 13); g.lineTo(mx, my + 19); g.fill();
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#454b52' : '#5d646c'; g.fillRect(14, 20 + i * 40, 42, 30); }
    bar(k, c[0]);
  }
  function drawStream(info) {
    // "jogo" na tela: pista com carrinhos e um placar
    g.fillStyle = '#1e5a35'; g.fillRect(0, 0, W - 140, H); g.fillStyle = '#3a3f46'; g.fillRect(0, 110, W - 140, 80);
    g.fillStyle = '#f2f2f2'; for (let x = -40 + (t * 160) % 60; x < W - 140; x += 60) g.fillRect(x, 148, 30, 4);
    g.fillStyle = '#e74c3c'; g.fillRect(120 + Math.sin(t * 2) * 30, 125, 46, 22); g.fillStyle = '#3498db'; g.fillRect(230 + Math.cos(t * 1.4) * 40, 158, 46, 22);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(8, 8, 120, 24); g.fillStyle = '#ff5a4f'; g.font = 'bold 13px Segoe UI,sans-serif'; g.fillText('● AO VIVO', 16, 25);
    g.fillStyle = '#fff'; g.font = '12px Segoe UI,sans-serif'; g.fillText((info.viewers || 0) + ' NPC', 92, 25);
    // webcam simulada (silhueta) + chat
    g.fillStyle = '#20262d'; g.fillRect(W - 140, 0, 140, H); g.fillStyle = '#39424c'; g.fillRect(8, H - 78, 90, 70);
    g.fillStyle = '#c99a72'; g.beginPath(); g.arc(53, H - 50, 15, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5b3fa0'; g.fillRect(33, H - 34, 40, 26);
    g.font = '11px Segoe UI,sans-serif'; const chat = info.chat?.length ? info.chat : ['Lia: boa!', 'Tico: kkk', 'Bia: 🔥'];
    chat.slice(-12).forEach((m, i) => { g.fillStyle = i % 2 ? '#f5bf60' : '#cfd8df'; g.fillText(String(m).slice(0, 22), W - 132, 20 + i * 22); });
    bar(info.progress, '#ff5a4f');
  }
  function bar(k, col) { g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, H - 5, W, 5); g.fillStyle = col; g.fillRect(0, H - 5, W * Math.max(0, Math.min(1, k || 0)), 5); }
  const DRAW = { code: drawCode, help: drawHelp, design: drawDesign, stream: drawStream };

  // ---------- caixas de estoque ----------
  const boxGeo = new THREE.BoxGeometry(.26, .18, .22), boxMat = new THREE.MeshStandardMaterial({ color: 0xb98a52, roughness: .85 }), tapeMat = new THREE.MeshStandardMaterial({ color: 0xd9c79a, roughness: .7 });
  const tapeGeo = new THREE.BoxGeometry(.27, .012, .05);
  const boxes = new THREE.Group(); boxes.userData.noSnow = true; scene.add(boxes);
  let sig = '', checkT = 0;
  function box(x, h, y, rot) { const m = new THREE.Mesh(boxGeo, boxMat); m.position.set(x, h + .09, y); m.rotation.y = -rot; m.castShadow = true; const s = new THREE.Mesh(tapeGeo, tapeMat); s.position.y = .096; m.add(s); boxes.add(m); }
  function rebuild(v, floor) {
    boxes.clear();
    for (const s of v.shelves || []) {
      if ((s.floor || 0) !== floor) continue;
      const per = Math.max(1, Math.floor((s.w || 1) / .3)), levels = [.12, .5, .9, 1.3].filter(h => h < (s.h || 1.6) - .15), n = Math.min(s.count, per * levels.length);   // uma caixa por vão, sem sobrepor
      const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
      for (let i = 0; i < n; i++) {
        const lv = levels[Math.floor(i / per) % levels.length], col = i % per, off = (col - (per - 1) / 2) * .3;
        box(s.x + c * off, (s.z || 0) + lv, s.y + sn * off, s.rot || 0);
      }
    }
    const p = v.pile; if (p && (p.floor || 0) === floor) for (let i = 0; i < Math.min(p.count, 12); i++) box(p.x + (i % 2) * .3 - .15, (p.z || 0) + Math.floor(i / 2) * .19, p.y + (Math.floor(i / 4) % 2) * .26, .2 * (i % 3));
  }

  function update(dt) {
    t += dt; const p = P(); if (!p) return;
    // monitor do home office
    const info = window.CityDesk?.screenInfo?.();
    if (info && info.screen && (info.screen.floor || 0) === (p.floor || 0)) {
      const s = info.screen, cy = (s.z || 0) + .37;
      screen.position.set(s.x, cy, s.y);
      // monitor embutido da escrivaninha: normal conhecida e tela pequena; monitor avulso: vira para o jogador
      const hx = s.nx ?? (p.x - s.x), hy = s.ny ?? (p.y - s.y), d = Math.hypot(hx, hy) || 1, off = s.nx != null ? .004 : .075;
      screen.position.x += hx / d * off; screen.position.z += hy / d * off;
      screen.scale.set((s.w || 1.06) / 1.06, (s.h || .62) / .62, 1);
      screen.lookAt(screen.position.x + hx / d, cy, screen.position.z + hy / d); screen.visible = true;
      glow.position.set(screen.position.x + hx / d * .3, cy, screen.position.z + hy / d * .3); glow.intensity = .55;
      drawT -= dt; if (drawT <= 0) { drawT = 1 / 12; (DRAW[info.kind] || drawCode)(info); tex.needsUpdate = true; }
    } else { screen.visible = false; glow.intensity = 0; }
    // caixas
    checkT -= dt; if (checkT <= 0) {
      checkT = .5; const v = window.CityCommerce?.visuals?.();
      const nsig = v ? JSON.stringify(v) + '|' + (p.floor || 0) : '';
      if (nsig !== sig) { sig = nsig; if (v) rebuild(v, p.floor || 0); else boxes.clear(); }
    }
  }
  window.CityWork3D = { update, get debug() { return { boxes: boxes.children.length, screen: screen.visible }; } };
  return { update };
}
