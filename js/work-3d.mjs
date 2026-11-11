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
  // balão acima da cabeça (trabalho no automático): a mesma tela, sempre de frente para a câmera — a câmera gira e o monitor
  // de verdade muitas vezes fica de costas
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, toneMapped: false, transparent: true, depthTest: false }));
  bubble.scale.set(.95, .55, 1); bubble.renderOrder = 10; bubble.visible = false; scene.add(bubble);
  const frame = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: .92, depthTest: false }));
  frame.scale.set(1.03, .63, 1); frame.renderOrder = 9; frame.visible = false; scene.add(frame);
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
  // versão "de longe": poucas formas grandes, cores fortes e movimento contínuo — lê como animação mesmo com 15 px de tela
  const round = (x, y, w, h, r, c) => { g.fillStyle = c; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.fill(); };
  function drawSmall(info) {
    const k = info.kind, p = info.progress || 0;
    if (k === 'code' || k === 'help') {
      const term = k === 'help';
      g.fillStyle = term ? '#03130b' : '#0f1720'; g.fillRect(0, 0, W, H);
      const pal = term ? ['#3dff8f', '#b6ffcf', '#f5d76e'] : ['#ffcc4d', '#5ad1ff', '#ff6fa8', '#8dff9a', '#ffffff'];
      const rowH = 34, off = (t * 46) % rowH, first = Math.floor(t * 46 / rowH);
      for (let i = -1; i < 10; i++) {
        const n = first + i, y = i * rowH - off + 14, seed = (n * 9301 + 49297) % 233280 / 233280;
        const indent = term ? 20 : 20 + ((n % 4 === 1 || n % 4 === 2) ? 50 : 0) + (n % 7 === 3 ? 100 : 0);
        let x = indent; const parts = 1 + Math.floor(seed * 3);
        for (let j = 0; j < parts; j++) { const w = 50 + ((seed * 997 * (j + 1)) % 1) * 150; round(x, y, w, 20, 8, pal[(n + j) % pal.length]); x += w + 18; }
      }
      // cursor grande piscando na última linha
      if (Math.floor(t * 2.5) % 2) round(20 + (t * 70) % 280, H - 70, 26, 26, 4, term ? '#3dff8f' : '#ffffff');
    } else if (k === 'design') {
      const c = info.colors || ['#5b3a29', '#e8c39e'];
      g.fillStyle = '#2a2e33'; g.fillRect(0, 0, W, H); g.fillStyle = c[1]; g.fillRect(60, 20, W - 120, H - 50);
      const r = 60 + 20 * Math.sin(t * 2), a = t * .8;
      g.save(); g.translate(W / 2, H / 2 - 20); g.rotate(a); round(-r, -r, r * 2, r * 2, r * .5, c[0]); g.restore();
      round(W / 2 - 110 * Math.min(1, p * 2 + .3), H - 90, 220 * Math.min(1, p * 2 + .3), 26, 10, c[0]);
      const mx = W / 2 + Math.sin(t * 1.6) * 150, my = H / 2 + Math.cos(t * 2.1) * 80;
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + 30, my + 44); g.lineTo(mx + 12, my + 40); g.lineTo(mx, my + 58); g.fill();
    } else {
      g.fillStyle = '#2f9e57'; g.fillRect(0, 0, W, H); g.fillStyle = '#41464e'; g.fillRect(0, 95, W, 120);
      g.fillStyle = '#ffffff'; for (let x = -80 + (t * 320) % 100; x < W; x += 100) g.fillRect(x, 148, 55, 12);
      round(110 + Math.sin(t * 3) * 60, 108, 90, 40, 10, '#ff3b30'); round(280 + Math.cos(t * 2.2) * 70, 160, 90, 40, 10, '#2f80ff');
      if (Math.floor(t * 2) % 2) { g.fillStyle = '#ff2d2d'; g.beginPath(); g.arc(34, 34, 18, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(W - 120, 0, 120, H);
      for (let i = 0; i < 6; i++) round(W - 108, H - 40 - i * 44 - ((t * 40) % 44), 70 + (i * 37) % 30, 20, 8, i % 2 ? '#ffd65a' : '#ffffff');
    }
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, H - 14, W, 14); g.fillStyle = k === 'help' ? '#3dff8f' : '#ffcc4d'; g.fillRect(0, H - 14, W * Math.max(.04, Math.min(1, p)), 14);
  }

  // ---------- shower: procedural falling water and warm vapor ----------
  // Reuses existing home_wash/interact clip; no GLB, image or new animation asset.
  const dropCount=46,waterCoords=new Float32Array(dropCount*6),waterGeo=new THREE.BufferGeometry();
  waterGeo.setAttribute('position',new THREE.BufferAttribute(waterCoords,3));
  const showerWater=new THREE.LineSegments(waterGeo,
    new THREE.LineBasicMaterial({color:0x9fe4fb,transparent:true,opacity:.81,depthWrite:false}));
  showerWater.visible=false;showerWater.userData.noSnow=true;scene.add(showerWater);
  const steam=new THREE.Group();steam.userData.noSnow=true;scene.add(steam);
  const vaporGeo=new THREE.SphereGeometry(.15,7,5);
  const vaporMat=new THREE.MeshBasicMaterial({color:0xf0f7f6,transparent:true,opacity:.13,depthWrite:false,depthTest:true});
  for(let i=0;i<14;i++){const cloud=new THREE.Mesh(vaporGeo,vaporMat);cloud.frustumCulled=false;steam.add(cloud);}
  steam.visible=false;
  function updateShower(){
    const action=P()?.homeAction,item=action?.item,active=action?.kind==='wash'&&item?.kind==='shower';
    showerWater.visible=steam.visible=!!active;
    if(!active)return;
    // Water emerges just below the shower head (local +x 0.1, -z 0.25).
    // faceW uses the exact same orientation as the 3D furniture renderer.
    const f=window.CityHomeNav?.facing?.(item)||
      {x:-Math.sin(item.rot||0),y:Math.cos(item.rot||0)};
    const side={x:f.y,y:-f.x},head={
      x:item.x+side.x*.1-f.x*.25,y:item.y+side.y*.1-f.y*.25};
    const z=item.z||0;
    for(let i=0;i<dropCount;i++){
      const a=i*2.399963+t*.41,r=.07+(i%8)*.022;
      const phase=(t*2.5+i*.137)%1,top=z+1.87-phase*1.4;
      const x=head.x+Math.cos(a)*r,y=head.y+Math.sin(a)*r;
      waterCoords.set([x,top,y,x+Math.sin(a)*.025,top-.25-Math.cos(t*4+i)*.045,y+Math.cos(a)*.025],i*6);
    }
    waterGeo.attributes.position.needsUpdate=true;
    waterGeo.computeBoundingSphere();
    steam.children.forEach((p,i)=>{
      const phase=(t*.22+i*.139)%1,angle=i*2.31+t*.12,rad=.17+.20*phase;
      p.position.set(item.x+Math.cos(angle)*rad,z+.38+phase*1.43,item.y+Math.sin(angle)*rad);
      const scale=.75+phase*2.7;p.scale.set(scale*1.15,scale*.65,scale*1.15);
    });
  }

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
    updateShower();
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
      // monitor pequeno (embutido na escrivaninha) visto de longe: animação grossa e colorida; texto fino só no monitor grande
      drawT -= dt; if (drawT <= 0) { drawT = 1 / 20; if ((s.w || 1.06) < .6) drawSmall(info); else (DRAW[info.kind] || drawCode)(info); tex.needsUpdate = true; }
      const show = !!info.auto, bz = cy + 1.45 + Math.sin(t * 2.2) * .03;
      bubble.visible = frame.visible = show; if (show) { bubble.position.set(p.x, bz, p.y); frame.position.set(p.x, bz, p.y); }
    } else { screen.visible = false; glow.intensity = 0; bubble.visible = frame.visible = false; }
    // caixas
    checkT -= dt; if (checkT <= 0) {
      checkT = .5; const v = window.CityCommerce?.visuals?.();
      const nsig = v ? JSON.stringify(v) + '|' + (p.floor || 0) : '';
      if (nsig !== sig) { sig = nsig; if (v) rebuild(v, p.floor || 0); else boxes.clear(); }
    }
  }
  window.CityWork3D = { update, get debug() { return { boxes: boxes.children.length, screen: screen.visible,
    shower:showerWater.visible,steam:steam.visible,drops:showerWater.visible?dropCount:0 }; } };
  return { update };
}
