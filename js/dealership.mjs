// dealership.mjs — concessionária City Motors: dentro do showroom, F abre o atendimento. Vitrine 3D de cada modelo
// (o GLB do jogo num estúdio: plataforma girando, luz de estúdio com sombra, arrastar gira, roda aproxima), cores,
// ficha técnica e descrição; comprar (entrega no pátio da loja) e vender os seus carros usados (60% da tabela).
import {loadVehicleGLB} from './vehicle-asset-cache.mjs';
import {VEHICLE_MODELS} from './vehicle-catalog.mjs';

// ficha técnica da loja: velocidade máxima (km/h), 0–100 (s), frenagem, dirigibilidade e conforto (0–10)
const SPECS = {
  compact: [150, 13.5, 6, 7, 5], hatchback: [165, 11.8, 6, 7, 6], sedan: [185, 10.2, 7, 7, 8], wagon: [180, 10.8, 7, 6, 8],
  minivan: [170, 12.5, 6, 5, 9], pickup: [175, 10.9, 6, 5, 6], suv: [190, 9.4, 7, 6, 8], offroad: [170, 10.1, 6, 6, 6],
  coupe: [230, 6.9, 8, 8, 6], silvia: [220, 7.4, 8, 9, 5], sport: [290, 4.1, 9, 9, 5]
};
const COLORS = ['#c0392b', '#f4f4f2', '#1c1f24', '#7f8c8d', '#1f3a5f', '#2e86de', '#2c6e49', '#f39c12', '#8e44ad', '#d4ac0d', '#6e2c00', '#b3b6b7'];
const PAINT = /paint|body|carpaint|car_paint|exterior|chassis|main/i;
const money = n => typeof CityLife !== 'undefined' ? CityLife.money(n) : 'R$ ' + n;

export function installDealership(THREE, bridge) {
  let dlg = null, site = null, tab = 'buy', sel = null, color = COLORS[0], view = null, msgT = 0;
  const sim = () => (typeof CitySim !== 'undefined' ? CitySim : null);
  const catalog = () => { const C = sim()?.CARS || {}; return VEHICLE_MODELS.filter(m => C[m.id]).map(m => ({ ...m, ...C[m.id], spec: SPECS[m.id] || [170, 11, 6, 6, 6] })).sort((a, b) => a.price - b.price); };
  const dealerHouse = () => (bridge.houses || []).find(H => H.civic && H.miaKind === 'dealer' && H.inside);
  const siteOf = H => (typeof world !== 'undefined' ? world.civicSites || [] : []).find(s => s.kind === 'dealer' && Math.hypot(s.x - (H.x0 + H.x1) / 2, s.y - 44 - (H.y0 + H.y1) / 2) < 30) || null;

  // ---------- vitrine 3D (estúdio) ----------
  function makeViewer(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, .1, 100);
    // fundo de estúdio: degradê escuro com piso claro refletindo a luz
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256; const g = bg.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#0e1318'); gr.addColorStop(.55, '#1d2630'); gr.addColorStop(1, '#2b3540'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const bgTex = new THREE.CanvasTexture(bg); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
    scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a2f36, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(4, 7, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd3ff, 1.4); rim.position.set(-5, 3, -6); scene.add(rim);
    const fill = new THREE.PointLight(0xfff1dc, 18, 14, 2); fill.position.set(-3, 2.2, 4); scene.add(fill);
    // plataforma giratória com anel de LED
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, .14, 64), new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: .25, metalness: .2 })); deck.position.y = -.07; deck.receiveShadow = true; scene.add(deck);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, .035, 8, 96), new THREE.MeshBasicMaterial({ color: 0x8fdcff })); ring.rotation.x = Math.PI / 2; ring.position.y = .0; scene.add(ring);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: .6 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.14; floor.receiveShadow = true; scene.add(floor);
    const turn = new THREE.Group(); scene.add(turn);
    let yaw = .7, pitch = .32, dist = 9.5, auto = true, drag = null, car = null, paint = null, loading = 0, raf = 0, last = performance.now();
    function size() { const r = canvas.getBoundingClientRect(); renderer.setSize(Math.max(50, r.width), Math.max(50, r.height), false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); }
    function neutral(tex) {   // pintura de fábrica vira cinza p/ a cor escolhida tingir (como nos estacionados)
      const im = tex.image; if (!im) return tex; const N = Math.min(1024, im.width || 1024), c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); x.drawImage(im, 0, 0, N, N);
      const d = x.getImageData(0, 0, N, N), a = d.data; for (let i = 0; i < a.length; i += 4) { const mx = Math.max(a[i], a[i + 1], a[i + 2]), mn = Math.min(a[i], a[i + 1], a[i + 2]); if (mx - mn < 24) continue; const v = Math.min(255, (.3 * a[i] + .59 * a[i + 1] + .11 * a[i + 2]) * 1.5 + 30); a[i] = a[i + 1] = a[i + 2] = v; }
      x.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; return t;
    }
    async function show(id, col) {
      const cfg = VEHICLE_MODELS.find(m => m.id === id); if (!cfg) return; const ticket = ++loading;
      const gltf = await loadVehicleGLB(cfg).catch(() => null); if (!gltf || ticket !== loading) return;
      if (car) { turn.remove(car); car.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) m.dispose?.(); }); }
      const root = gltf.scene.clone(true), copies = new Map();
      root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material = [].concat(o.material).map(m => { if (!copies.has(m)) { const c = m.clone(); if ('metalness' in c) { c.metalness = Math.min(c.metalness, .35); c.roughness = Math.min(Math.max(c.roughness, .25), .55); } copies.set(m, c); } return copies.get(m); }); if (o.material.length === 1) o.material = o.material[0]; } });
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root), dim = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const pos = new THREE.Group(); pos.position.set(-c.x, -box.min.y, -c.z); pos.add(root);
      const sc = new THREE.Group(); sc.scale.setScalar(cfg.length / Math.max(dim.x, dim.z)); sc.add(pos);
      const al = new THREE.Group(); al.rotation.y = cfg.front === '+Z' ? 0 : Math.PI; al.add(sc);
      // pintura: pelo nome, senão o maior material claro
      let best = 0; paint = null;
      root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (!m.color || m.transparent) continue; if (PAINT.test(m.name || '')) { paint = paint && PAINT.test(paint.name || '') ? paint : m; continue; } if (paint && PAINT.test(paint.name || '')) continue;
        o.geometry.computeBoundingBox(); const s = o.geometry.boundingBox.getSize(new THREE.Vector3()), hsl = {}; m.color.getHSL(hsl); const area = (s.x * s.y + s.y * s.z + s.x * s.z) * (hsl.l > .12 ? 1 : .1); if (area > best) { best = area; paint = m; } } });
      if (paint?.map && !['suv', 'police-suv'].includes(id)) paint.map = neutral(paint.map);
      car = al; turn.add(car); setColor(col);
    }
    function setColor(col) { if (paint) { paint.color.set(col); paint.needsUpdate = true; } }
    function frame(now) {
      raf = requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (auto && !drag) yaw += dt * .35;
      turn.rotation.y = yaw; const r = dist; cam.position.set(Math.sin(.6) * r * Math.cos(pitch), .9 + r * Math.sin(pitch), Math.cos(.6) * r * Math.cos(pitch)); cam.lookAt(0, .7, 0);
      ring.material.color.setHSL(.55, .8, .55 + .12 * Math.sin(now / 500));
      renderer.render(scene, cam);
    }
    canvas.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; auto = false; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!drag) return; yaw += (e.clientX - drag[0]) * .01; pitch = Math.max(.05, Math.min(.9, pitch + (e.clientY - drag[1]) * .006)); drag = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', () => { drag = null; setTimeout(() => { auto = true; }, 2500); });
    canvas.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(5.5, Math.min(15, dist * (e.deltaY > 0 ? 1.08 : .93))); }, { passive: false });
    size(); raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(size); ro.observe(canvas);
    return { show, setColor, dispose() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); } };
  }

  // ---------- janela ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bar = (label, v, txt) => `<div class="cm-stat"><span>${label}</span><i><b style="width:${Math.round(Math.max(.05, Math.min(1, v)) * 100)}%"></b></i><em>${txt}</em></div>`;
  function render() {
    if (!dlg) return;
    const S = sim(), list = catalog(), owned = new Set(S?.cars || []), funds = typeof CityLife !== 'undefined' ? CityLife.funds : 0;
    if (!sel || !list.some(m => m.id === sel)) sel = (tab === 'sell' ? [...owned][0] : null) || list[0]?.id;
    const m = list.find(x => x.id === sel), sp = m?.spec || [0, 0, 0, 0, 0];
    const left = tab === 'buy'
      ? list.map(c => `<button class="cm-card ${c.id === sel ? 'on' : ''}" data-cm="pick" data-id="${c.id}"><strong>${esc(c.title)}</strong><span>${esc(c.cat)} · ${c.seats} lugares</span><b>${money(c.price)}</b>${owned.has(c.id) ? '<em>Na sua garagem</em>' : ''}</button>`).join('')
      : (owned.size ? list.filter(c => owned.has(c.id)).map(c => `<button class="cm-card ${c.id === sel ? 'on' : ''}" data-cm="pick" data-id="${c.id}"><strong>${esc(c.title)}</strong><span>Avaliação do usado</span><b>${money(S.usedPrice(c.id))}</b></button>`).join('') : '<p class="cm-empty">Você ainda não tem carros. Compre um na aba Comprar.</p>');
    const action = !m ? '' : tab === 'buy'
      ? (owned.has(m.id) ? `<button class="cm-buy" data-cm="deliver">Trazer meu ${esc(m.title)} p/ o pátio</button><small>Você já tem este modelo.</small>`
        : `<button class="cm-buy" data-cm="buy" ${funds < m.price ? 'disabled' : ''}>Comprar por ${money(m.price)}</button><small>${funds < m.price ? 'Saldo insuficiente · faltam ' + money(m.price - funds) : 'Entrega na hora, no pátio da loja.'}</small>`)
      : owned.has(m.id) ? `<button class="cm-buy cm-sell" data-cm="sell">Vender por ${money(S.usedPrice(m.id))}</button><small>A loja paga 60% da tabela (${money(m.price)}).</small>` : '';
    dlg.querySelector('.cm-body').innerHTML = `
      <aside class="cm-list">${left}</aside>
      <section class="cm-stage"><canvas class="cm-view" aria-label="Vitrine 3D do modelo"></canvas>
        <div class="cm-hint">Arraste p/ girar · roda do mouse p/ aproximar</div>
        ${tab === 'buy' ? `<div class="cm-colors">${COLORS.map(c => `<button data-cm="color" data-c="${c}" class="${c === color ? 'on' : ''}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}</div>` : ''}</section>
      <aside class="cm-info">${m ? `<h3>${esc(m.title)}</h3><p class="cm-cat">${esc(m.cat)} · ${m.seats} lugares · ${esc(m.name)}</p><p>${esc(m.text)}</p>
        ${bar('Velocidade máx.', sp[0] / 300, sp[0] + ' km/h')}${bar('Aceleração', (16 - sp[1]) / 12, '0–100 em ' + sp[1].toFixed(1) + ' s')}${bar('Frenagem', sp[2] / 10, sp[2] + '/10')}${bar('Dirigibilidade', sp[3] / 10, sp[3] + '/10')}${bar('Conforto', sp[4] / 10, sp[4] + '/10')}
        <div class="cm-price">${tab === 'buy' ? money(m.price) : money(S?.usedPrice(m.id) || 0)}</div>${action}` : ''}<div class="cm-msg" role="status"></div></aside>`;
    dlg.querySelector('.cm-tabs').innerHTML = `<button data-cm="tab" data-t="buy" class="${tab === 'buy' ? 'on' : ''}">Comprar</button><button data-cm="tab" data-t="sell" class="${tab === 'sell' ? 'on' : ''}">Vender meus carros${owned.size ? ' (' + owned.size + ')' : ''}</button>`;
    dlg.querySelector('.cm-funds').textContent = money(funds);
    view?.dispose(); view = makeViewer(dlg.querySelector('.cm-view')); if (m) view.show(m.id, tab === 'buy' ? color : (S?.carColors?.[m.id] || '#c3c6c9'));
  }
  const say = (t, ok = true) => { const el = dlg?.querySelector('.cm-msg'); if (el) { el.textContent = t; el.dataset.ok = ok ? '1' : '0'; } window.CityAudio?.ui(ok ? 'confirm' : 'back'); };
  function ensure() {
    if (dlg) return dlg;
    const css = document.createElement('style'); css.textContent = `
#city-dealer{width:min(1180px,96vw);height:min(700px,92vh);padding:0;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:#0f1419;color:#eef2f4;font-family:"Bahnschrift SemiCondensed","Arial Narrow","Segoe UI",system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:hidden}
#city-dealer::backdrop{background:rgba(5,8,12,.62);backdrop-filter:blur(4px)}
#city-dealer .cm-wrap{display:grid;grid-template-rows:auto 1fr;height:100%}
#city-dealer header{display:flex;align-items:center;gap:16px;padding:14px 20px;background:linear-gradient(90deg,#1b2129,#12171d);border-bottom:1px solid rgba(255,255,255,.08)}
#city-dealer header h2{margin:0;font-size:24px;letter-spacing:.06em}#city-dealer header h2 b{color:#e53935}
#city-dealer header small{color:#9fb0bc;font-size:14px}.cm-tabs{display:flex;gap:6px;margin-left:auto}.cm-tabs button{font-size:15px;font-weight:600;font-family:inherit;color:#cfd8dc;background:#1f2731;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 14px;cursor:pointer}
.cm-tabs button.on{background:#e53935;color:#fff;border-color:#e53935}.cm-funds{font-size:18px;color:#7fd6bd;font-weight:700;min-width:120px;text-align:right}
.cm-close{font-size:20px;background:none;border:0;color:#cfd8dc;cursor:pointer;padding:4px 8px}
#city-dealer .cm-body{display:grid;grid-template-columns:250px 1fr 300px;min-height:0}
.cm-list{overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;border-right:1px solid rgba(255,255,255,.07)}
.cm-card{position:relative;text-align:left;font-family:inherit;color:#eef2f4;background:#18202a;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 12px;cursor:pointer;display:grid;gap:2px}
.cm-card strong{font-size:17px}.cm-card span{font-size:13px;color:#9fb0bc}.cm-card b{font-size:15px;color:#7fd6bd}.cm-card em{position:absolute;top:8px;right:10px;font-style:normal;font-size:11px;background:#2e7d32;color:#fff;border-radius:6px;padding:2px 6px}
.cm-card.on{border-color:#e53935;background:#221a1d}.cm-card:hover{border-color:#7fd6bd}.cm-empty{color:#9fb0bc;padding:8px}
.cm-stage{position:relative;min-width:0}.cm-view{width:100%;height:100%;display:block;cursor:grab}.cm-view:active{cursor:grabbing}
.cm-hint{position:absolute;top:12px;left:50%;transform:translateX(-50%);font-size:13px;color:#9fb0bc;background:rgba(10,14,18,.6);padding:4px 10px;border-radius:8px}
.cm-colors{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:7px;background:rgba(10,14,18,.7);padding:8px 10px;border-radius:12px}
.cm-colors button{width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,255,255,.35);cursor:pointer}.cm-colors button.on{border-color:#fff;box-shadow:0 0 0 2px #e53935}
.cm-info{padding:18px;overflow:auto;border-left:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;gap:8px}
.cm-info h3{margin:0;font-size:28px}.cm-cat{color:#9fb0bc;margin:0;font-size:14px}.cm-info p{margin:0;font:400 15px/1.4 system-ui,sans-serif;color:#cfd8dc}
.cm-stat{display:grid;grid-template-columns:110px 1fr;gap:2px 8px;align-items:center;font-size:14px}.cm-stat i{height:7px;background:#26303b;border-radius:4px;overflow:hidden}.cm-stat b{display:block;height:100%;background:linear-gradient(90deg,#7fd6bd,#2e86de)}
.cm-stat em{grid-column:2;font-style:normal;font-size:12px;color:#9fb0bc}.cm-price{font-size:30px;font-weight:800;color:#fff;margin-top:auto}
.cm-buy{font-size:17px;font-weight:700;font-family:inherit;color:#fff;background:#e53935;border:0;border-radius:12px;padding:12px;cursor:pointer}.cm-buy:disabled{background:#4a3436;color:#aaa;cursor:not-allowed}.cm-sell{background:#2e7d32}
.cm-info small{color:#9fb0bc;font-size:13px}.cm-msg{min-height:20px;font-size:14px}.cm-msg[data-ok="1"]{color:#7fd6bd}.cm-msg[data-ok="0"]{color:#ef9a9a}
@media(max-width:900px){#city-dealer .cm-body{grid-template-columns:1fr;grid-template-rows:120px 300px auto;overflow:auto}.cm-list{flex-direction:row;overflow-x:auto}.cm-card{min-width:170px}}`;
    document.head.appendChild(css);
    dlg = document.createElement('dialog'); dlg.id = 'city-dealer';
    dlg.innerHTML = '<div class="cm-wrap"><header><div><h2>CITY <b>MOTORS</b></h2><small class="cm-site"></small></div><nav class="cm-tabs"></nav><div class="cm-funds"></div><button class="cm-close" data-cm="close" aria-label="Fechar">✕</button></header><div class="cm-body"></div></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', async e => {
      const b = e.target.closest('[data-cm]'); if (!b) return; const S = sim(), a = b.dataset.cm;
      if (a === 'close') return close();
      if (a === 'tab') { tab = b.dataset.t; sel = null; render(); window.CityAudio?.ui('click'); return; }
      if (a === 'pick') { sel = b.dataset.id; render(); window.CityAudio?.ui('click'); return; }
      if (a === 'color') { color = b.dataset.c; view?.setColor(color); dlg.querySelectorAll('.cm-colors button').forEach(x => x.classList.toggle('on', x === b)); return; }
      if (!S || !sel) return;
      if (a === 'buy') { const r = S.buyCar(sel, color); if (!r.ok) return say(r.text, false); const d = await S.deliverCar(sel, site?.delivery); render(); say(r.text.replace(' Use Entregar veículo.', '') + ' · ' + (d?.text || ''), true); return; }
      if (a === 'deliver') { const d = await S.deliverCar(sel, site?.delivery); say(d?.text || '', !!d?.ok); return; }
      if (a === 'sell') { const r = S.sellCar(sel); sel = null; render(); say(r.text, r.ok); return; }
    });
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
    dlg.addEventListener('keydown', e => e.stopPropagation());
    return dlg;
  }
  function open(H) {
    ensure(); site = H ? siteOf(H) : null; tab = 'buy'; sel = null;
    dlg.querySelector('.cm-site').textContent = (site?.name || 'City Motors') + ' · Atendimento';
    bridge.releaseControls?.(); dlg.showModal(); render(); window.CityAudio?.ui('confirm');
  }
  function close() { view?.dispose(); view = null; dlg?.close(); bridge.releaseControls?.(); }
  const api = {
    prompt(p) { if (!p || bridge.driving() || dlg?.open) return null; const H = dealerHouse(); return H && (p.floor || 0) === 0 ? 'F · Falar com o vendedor da ' + (H.bName || 'City Motors') : null; },
    interact(p) { if (!api.prompt(p)) return false; open(dealerHouse()); return 'Bem-vindo à City Motors!'; },
    open, close, get active() { return !!dlg?.open; }
  };
  window.CityDealer = api;
  return api;
}
