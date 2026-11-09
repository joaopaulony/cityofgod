// jobs.mjs — empregos de verdade. Candidata-se no celular (app Carreiras), vai ao local, bate o ponto (F) e trabalha:
//  · Entregador: pega a van no pátio da Central Logística, dirige até cada casa, tira o pacote da traseira e entrega na
//    porta (5 entregas, bônus por rapidez), devolve a van e recebe.
//  · Taxista: pega o táxi, busca o passageiro na calçada (ele entra no carro), leva ao destino (ele desce); 4 corridas.
//  · Gari: pega o caminhão, para em 6 lixeiras, recolhe o saco e joga na caçamba; volta e descarrega.
//  · Mecânico (City Motors): carros com defeito chegam ao elevador; o conserto é uma sequência de teclas no tempo.
//  · Atendente (lanchonete do Hospital City of God): clientes pedem, você prepara e serve; gorjeta pela rapidez.
// Marcador 3D (feixe, anel e losango) + rota no GPS em cada etapa; painel de objetivo na tela; pagamento no fim do turno.
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const money = n => typeof CityLife !== 'undefined' ? CityLife.money(n) : 'R$ ' + n;
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const JOB_DEFS = {
  courier:  { title: 'Entregador de encomendas', icon: '📦', place: 'Central Logística City', site: 'depot', vehicle: ['minivan', '#f4f4f2'], base: 140, pay: 'R$ 350 a R$ 550 por turno', detail: 'Leve 5 encomendas de van até a porta dos clientes. Rapidez rende bônus.' },
  taxi:     { title: 'Taxista', icon: '🚕', place: 'Central Logística City', site: 'depot', vehicle: ['sedan', '#f1c40f'], base: 100, pay: 'R$ 300 a R$ 600 por turno', detail: 'Busque 4 passageiros na calçada e leve cada um ao destino. Tarifa por distância e tempo.' },
  garbage:  { title: 'Gari da coleta', icon: '🗑️', place: 'Central Logística City', site: 'depot', vehicle: ['pickup', '#2e7d32'], base: 180, pay: 'R$ 380 a R$ 420 por turno', detail: 'Pare o caminhão em 6 lixeiras, recolha o lixo e jogue na caçamba. Depois descarregue na central.' },
  mechanic: { title: 'Mecânico', icon: '🔧', place: 'Oficina City Motors', site: 'dealer', base: 120, pay: 'R$ 400 a R$ 650 por turno', detail: 'Conserte 4 carros no elevador da oficina. Quanto mais preciso o serviço, maior o pagamento.' },
  barista:  { title: 'Atendente da lanchonete', icon: '☕', place: 'Lanchonete do Hospital City of God', site: 'hospital', base: 100, pay: 'R$ 250 a R$ 400 por turno', detail: 'Atenda 6 clientes: prepare o pedido certo e sirva na mesa. Gorjeta pela rapidez.' }
};
const MENU = [['coffee', '☕', 'Café'], ['sandwich', '🥪', 'Sanduíche'], ['juice', '🧃', 'Suco'], ['cake', '🍰', 'Bolo']];

export function installJobs(THREE, scene, bridge) {
  const P = () => bridge.player, V = () => window.cityVehicles, sim = () => (typeof CitySim !== 'undefined' ? CitySim : null), chars = () => window.cityCharacters;
  let shift = null, hud = null, qte = null, menu = null;
  const hired = () => sim()?.data?.job && JOB_DEFS[sim().data.job] ? sim().data.job : null;
  const notify = (t, ok = true) => { window.CityUI?.notify?.(t); window.CityAudio?.ui(ok ? 'confirm' : 'back'); };
  const sites = () => (typeof world !== 'undefined' ? world.civicSites || [] : []);
  const building = kind => (bridge.houses || []).filter(H => H.civic && H.miaKind === kind && H.architecture).sort((a, b) => d2(cen(a), P()) - d2(cen(b), P()))[0] || null;
  const cen = H => ({ x: (H.x0 + H.x1) / 2, y: (H.y0 + H.y1) / 2 });
  const siteOf = kind => sites().filter(s => s.kind === kind).sort((a, b) => d2(a, P()) - d2(b, P()))[0] || null;
  // cômodo (térreo) de um prédio que contém o jogador
  const inRoom = (H, use, p = P()) => { if (!H?.inside || (p.floor || 0)) return null; const A = H.architecture, q = A.toLocal(p.x, p.y); return A.levels[0].rooms.find(r => r.use === use && q[0] > r.x0 && q[0] < r.x1 && q[1] > r.y0 && q[1] < r.y1) || null; };
  const furn = (H, kind, use) => { const A = H.architecture, L = A.levels[0]; return L.furniture.filter(f => f.kind === kind && (!use || L.rooms.find(r => r.id === f.room)?.use === use)).map(f => { const w = A.toWorld(f.x, f.y); return { x: w[0], y: w[1], f }; }); };

  // ---------- marcador 3D ----------
  const marker = new THREE.Group(); marker.visible = false; marker.userData.noSnow = true; scene.add(marker);
  const mMat = new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: .32, depthWrite: false }), mSolid = new THREE.MeshBasicMaterial({ color: 0xffd54a });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, 7, 20, 1, true), mMat); beam.position.y = 3.5; marker.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.9, .07, 8, 36), mSolid); ring.rotation.x = Math.PI / 2; ring.position.y = .06; marker.add(ring);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.35), mSolid); gem.position.y = 2.6; marker.add(gem);
  function setMarker(pt, color = 0xffd54a, label) {
    if (!pt) { marker.visible = false; return; }
    marker.visible = true; marker.position.set(pt.x, pt.z || 0, pt.y); mMat.color.setHex(color); mSolid.color.setHex(color);
    if (label && (!shift?.gpsFor || d2(shift.gpsFor, pt) > 3)) { shift && (shift.gpsFor = { x: pt.x, y: pt.y }); window.CityGPS?.set?.({ x: pt.x, y: pt.y, name: label }); }
  }

  // ---------- painel de objetivo ----------
  function ensureHud() {
    if (hud) return hud;
    const css = document.createElement('style'); css.textContent = `
#city-job-hud{position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:41;min-width:300px;max-width:min(560px,90vw);pointer-events:none;
 font-family:var(--hud-font,"Bahnschrift SemiCondensed","Arial Narrow",system-ui,sans-serif);color:#f2f5f2;background:rgba(11,17,21,.8);border:1px solid rgba(255,255,255,.15);border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.45);padding:10px 14px}
#city-job-hud[hidden]{display:none}#city-job-hud .jh-top{display:flex;gap:10px;align-items:center;font-size:13px;color:#b7c3bf;letter-spacing:.05em}
#city-job-hud .jh-top b{color:#ffd54a}#city-job-hud .jh-top span:last-child{margin-left:auto;color:#7fd6bd;font-weight:700;font-size:15px}
#city-job-hud .jh-task{font-size:18px;font-weight:700;margin-top:3px}#city-job-hud .jh-bar{height:5px;background:#26303b;border-radius:3px;margin-top:7px;overflow:hidden}
#city-job-hud .jh-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffd54a,#7fd6bd);transition:width .3s}
#city-job-qte,#city-job-menu{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:62;font-family:var(--hud-font,"Bahnschrift SemiCondensed",system-ui,sans-serif);color:#f2f5f2;
 background:rgba(11,17,21,.92);border:1px solid rgba(255,255,255,.18);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.6);padding:18px 22px;text-align:center;min-width:360px}
#city-job-qte h3,#city-job-menu h3{margin:0 0 4px;font-size:22px}#city-job-qte p,#city-job-menu p{margin:0 0 12px;color:#b7c3bf;font-size:14px}
#city-job-qte .q-keys{display:flex;gap:8px;justify-content:center;margin-bottom:12px}#city-job-qte .q-keys kbd{width:46px;height:46px;display:grid;place-items:center;font:800 22px var(--hud-font,system-ui);border-radius:10px;background:#26303b;color:#cfd8dc;border:2px solid transparent}
#city-job-qte .q-keys kbd.now{border-color:#ffd54a;color:#fff;transform:scale(1.12)}#city-job-qte .q-keys kbd.ok{background:#2e7d32;color:#fff}#city-job-qte .q-keys kbd.bad{background:#c62828;color:#fff}
#city-job-qte .q-time{height:6px;background:#26303b;border-radius:3px;overflow:hidden}#city-job-qte .q-time i{display:block;height:100%;background:#ffd54a}
#city-job-menu .m-items{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}#city-job-menu button{font:700 15px var(--hud-font,system-ui);color:#f2f5f2;background:#1f2731;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 6px;cursor:pointer;display:grid;gap:4px}
#city-job-menu button span{font-size:30px}#city-job-menu button kbd{font:700 11px system-ui;color:#0d1a1c;background:#7fd6bd;border-radius:5px;padding:1px 5px;justify-self:center}#city-job-menu button:hover{border-color:#ffd54a}`;
    document.head.appendChild(css);
    hud = document.createElement('div'); hud.id = 'city-job-hud'; hud.hidden = true; hud.innerHTML = '<div class="jh-top"><span></span><b></b><span></span></div><div class="jh-task"></div><div class="jh-bar"><i></i></div>'; document.body.appendChild(hud);
    return hud;
  }
  function paintHud() {
    const h = ensureHud(); if (!shift) { h.hidden = true; return; }
    const def = JOB_DEFS[shift.job], s = h.querySelectorAll('.jh-top span');
    h.hidden = false; s[0].textContent = def.icon + ' ' + def.title.toUpperCase(); h.querySelector('.jh-top b').textContent = shift.total ? (shift.done + '/' + shift.total) : '';
    s[1].textContent = money(shift.earned); h.querySelector('.jh-task').textContent = shift.task || '';
    h.querySelector('.jh-bar i').style.width = (shift.total ? Math.min(100, shift.done / shift.total * 100) : 0) + '%';
  }
  const task = (t, pt, color, label) => { shift.task = t; setMarker(pt, color, label); paintHud(); };

  // ---------- veículo da empresa ----------
  const vKey = () => 'job:' + shift.job;
  function vPos() {
    const v = V(), key = vKey();
    if (v?.driver && v.activeKey === key) return { x: v.car.x, y: v.car.y, a: v.car.angle, speed: Math.abs(v.car.speed || 0), driving: true, len: v.carLength || 4.8 };
    const b = v?.parkedOf?.(key); return b && !b.fleetHidden ? { x: b.x, y: b.y, a: b.rot || 0, speed: 0, driving: false, len: b.w || 4.8 } : null;
  }
  const rear = vp => ({ x: vp.x - Math.cos(vp.a) * (vp.len / 2 + .75), y: vp.y - Math.sin(vp.a) * (vp.len / 2 + .75) });
  async function giveVehicle() {
    const def = JOB_DEFS[shift.job], s = shift.site;
    const ok = await V()?.deliverVehicle?.(def.vehicle[0], { x: s.delivery.x, y: s.delivery.y, angle: s.delivery.angle, col: def.vehicle[1], key: vKey() });
    if (!ok) { notify('Não há vaga livre p/ o veículo — tente de novo em instantes', false); return false; }
    return true;
  }
  // casas de clientes (entregas e corridas): residências com porta voltada p/ a rua, a min..max m do ponto
  function houseNear(from, min, max, used = []) {
    const ok = (bridge.houses || []).filter(H => H.doorPt && H.front && !H.civic && H.architecture && !['office', 'condo', 'warehouse', 'shop', 'airport', 'projects', 'deco'].includes(H.architecture.kind) && !used.includes(H)
      && typeof roadDist === 'function' && roadDist(H.front[0], H.front[1]) < (typeof ROAD_W !== 'undefined' ? ROAD_W : 3.5) + 9);
    const c = ok.filter(H => { const d = Math.hypot(H.doorPt[0] - from.x, H.doorPt[1] - from.y); return d > min && d < max; });
    return pick(c.length ? c : ok.filter(H => Math.hypot(H.doorPt[0] - from.x, H.doorPt[1] - from.y) > 30)) || null;
  }
  // lixeiras (caçambas, lixeiras de rua) a min..max m
  function binNear(from, min, max, used) {
    const all = [...(bridge.boxes || []).filter(b => ['dumpster', 'trashcan', 'bin'].includes(b.kind) && !b.house), ...(bridge.urbanBins || [])].filter(b => !used.some(u => d2(u, b) < 3)
      && (typeof roadDist !== 'function' || roadDist(b.x, b.y) < (typeof ROAD_W !== 'undefined' ? ROAD_W : 3.5) + 6));   // só as que o caminhão alcança pela rua
    const c = all.filter(b => { const d = d2(b, from); return d > min && d < max; });
    return pick(c.length ? c : all.filter(b => d2(b, from) > 25)) || null;
  }

  // ======================= os 5 empregos =======================
  // fluxos com veículo: 'getVehicle' → (tarefas) → 'return' (estaciona na vaga de saída, desce e devolve com F)
  const FLOWS = {
    courier: { total: 5, start(s) { s.used = []; s.step = 'getVehicle'; },
      tick(s, p) {
        const vp = vPos(); if (!vp) return;
        if (s.step === 'getVehicle') { if (vp.driving) { s.step = 'drive'; next(s); } else task('Pegue a van de entregas no pátio', vp, 0xffd54a, 'Van de entregas'); return; }
        if (s.step === 'drive') { if (!s.house) next(s); if (!s.house) { task('Aguardando o endereço da próxima entrega…', null); return; } const h = s.house; task('Dirija até o cliente · ' + (s.done + 1) + 'ª entrega', { x: h.front[0], y: h.front[1] }, 0x4fc3f7, 'Entrega: cliente');
          if (d2(vp, { x: h.front[0], y: h.front[1] }) < 16 && vp.speed < 1.2) { s.step = 'unload'; s.t0 = performance.now(); } return; }
        if (s.step === 'unload') { if (p.carry === 'package') { s.step = 'door'; return; } task(vp.driving ? 'Estacione e desça da van' : 'Pegue o pacote na traseira da van', { ...rear(vp) }, 0xffd54a); return; }
        if (s.step === 'door') { const h = s.house; task('Leve o pacote até a porta do cliente', { x: h.doorPt[0], y: h.doorPt[1] }, 0x7fd6bd); return; }
        if (s.step === 'return') returnTask(s, vp, 'Devolva a van no pátio da Central');
      },
      prompt(s, p) {
        const vp = vPos(); if (!vp || vp.driving) return returnPrompt(s, vp, 'a van');
        if (s.step === 'unload' && !p.carry && d2(p, rear(vp)) < 1.8) return 'F · Pegar o pacote na traseira';
        if (s.step === 'door' && d2(p, { x: s.house.doorPt[0], y: s.house.doorPt[1] }) < 2) return 'F · Entregar o pacote';
        return returnPrompt(s, vp, 'a van');
      },
      interact(s, p) {
        const vp = vPos();
        if (s.step === 'unload' && vp && !vp.driving && !p.carry && d2(p, rear(vp)) < 1.8) { p.carry = 'package'; window.CityAudio?.ui('click'); return 'Pacote em mãos'; }
        if (s.step === 'door' && p.carry === 'package' && d2(p, { x: s.house.doorPt[0], y: s.house.doorPt[1] }) < 2) {
          p.carry = null; s.house_done = s.house; const fast = (performance.now() - s.t0) / 1000 < 50, pay = 45 + (fast ? 35 : 10); s.earned += pay; s.done++;
          notify('📦 Entregue! +' + money(pay) + (fast ? ' (bônus de rapidez)' : '')); if (s.done >= s.total) s.step = 'return'; else { s.step = 'drive'; s.house = null; next(s); } return 'Encomenda entregue';
        }
        return doReturn(s, vp);
      },
      next(s) { const from = s.last || vPos(); s.house = houseNear(from, 90, 360, s.used); if (s.house) { s.used.push(s.house); s.last = { x: s.house.doorPt[0], y: s.house.doorPt[1] }; } }
    },
    taxi: { total: 4, start(s) { s.used = []; s.step = 'getVehicle'; },
      tick(s, p) {
        const vp = vPos(); if (!vp) return;
        if (s.step === 'getVehicle') { if (vp.driving) { s.step = 'pickup'; next(s); } else task('Pegue o táxi no pátio', vp, 0xffd54a, 'Táxi'); return; }
        if (s.step === 'pickup') { if (!s.pick) next(s); if (!s.pick) { task('Aguardando a próxima corrida…', null); return; } const q = s.pick; task('Busque o passageiro · corrida ' + (s.done + 1), q, 0x4fc3f7, 'Passageiro');
          if (!s.npc && !s.spawning && d2(P(), q) < 140) { s.spawning = true; chars()?.spawnExtra?.(q.x, q.y, { face: q.face }).then(n => { s.npc = n; s.spawning = false; }); }
          if (s.npc && d2(vp, s.npc) < 11 && vp.speed < 1) { s.step = 'boarding'; s.bt = 0; chars()?.releaseExtra?.(s.npc, { x: vp.x, y: vp.y }); chars()?.say?.(s.npc, pick(['Boa tarde! Obrigado por vir.', 'Oi! Pode me levar?', 'Até que enfim, tô atrasado!']), '🚕'); } return; }
        if (s.step === 'boarding') { s.bt += 1 / 30; const n = s.npc; if (!n || d2(n, vp) < 2.2 || s.bt > 7) { chars()?.removeExtra?.(n); s.npc = null; s.step = 'ride'; s.t0 = performance.now(); s.from = { x: vp.x, y: vp.y }; s.dest = destOf(s, vp); } return; }
        if (s.step === 'ride') { task('Leve o passageiro ao destino', s.dest, 0x7fd6bd, 'Destino da corrida');
          if (d2(vp, s.dest) < 14 && vp.speed < 1) { const dist = d2(s.from, s.dest), secs = (performance.now() - s.t0) / 1000, fast = secs < dist / 8 + 25, fare = Math.round(30 + dist * .2 + (fast ? 30 : 0));
            s.earned += fare; s.done++; notify('🚕 Corrida concluída · ' + money(fare) + (fast ? ' (passageiro adorou a rapidez ⭐⭐⭐⭐⭐)' : ' ⭐⭐⭐⭐'));
            const side = { x: vp.x - Math.sin(vp.a) * 1.8, y: vp.y + Math.cos(vp.a) * 1.8 }; chars()?.spawnExtra?.(side.x, side.y).then(n => { if (n) chars()?.releaseExtra?.(n, { x: s.dest.door.x, y: s.dest.door.y, leave: true }); });
            if (s.done >= s.total) s.step = 'return'; else { s.step = 'pickup'; s.pick = null; next(s); } } return; }
        if (s.step === 'return') returnTask(s, vp, 'Devolva o táxi no pátio da Central');
      },
      prompt(s, p) { return returnPrompt(s, vPos(), 'o táxi'); }, interact(s, p) { return doReturn(s, vPos()); },
      next(s) { const H = houseNear(vPos(), 120, 380, s.used); if (H) { s.used.push(H); s.pick = { x: H.front[0], y: H.front[1], face: Math.atan2(-H.doorN[1], -H.doorN[0]) }; } }
    },
    garbage: { total: 6, start(s) { s.used = []; s.step = 'getVehicle'; },
      tick(s, p) {
        const vp = vPos(); if (!vp) return;
        if (s.step === 'getVehicle') { if (vp.driving) { s.step = 'drive'; next(s); } else task('Pegue o caminhão de coleta no pátio', vp, 0xffd54a, 'Caminhão de coleta'); return; }
        if (s.step === 'drive') { if (!s.bin) next(s); if (!s.bin) return; task('Vá até a lixeira · ' + (s.done + 1) + 'ª coleta', s.bin, 0x4fc3f7, 'Coleta de lixo'); if (d2(vp, s.bin) < 15 && vp.speed < 1.2) s.step = 'collect'; return; }
        if (s.step === 'collect') { if (s.hold) { s.hold += 1 / 30; if (d2(p, s.bin) > 2.4) s.hold = 0; else if (s.hold > 1.6) { s.hold = 0; p.carry = 'bag'; s.step = 'dump'; window.CityAudio?.thump(p.x, p.y, 'fall'); } }
          task(vp.driving ? 'Estacione e desça do caminhão' : s.hold ? 'Recolhendo o lixo…' : 'Recolha o lixo da lixeira', s.bin, 0xffd54a); return; }
        if (s.step === 'dump') { task('Jogue o saco na caçamba do caminhão', rear(vp), 0x7fd6bd); return; }
        if (s.step === 'return') returnTask(s, vp, 'Volte à Central e descarregue');
      },
      prompt(s, p) {
        const vp = vPos(); if (!vp) return null;
        if (s.step === 'collect' && !vp.driving && !s.hold && d2(p, s.bin) < 2.2) return 'F · Recolher o lixo';
        if (s.step === 'dump' && d2(p, rear(vp)) < 2) return 'F · Jogar na caçamba';
        return returnPrompt(s, vp, 'o caminhão');
      },
      interact(s, p) {
        const vp = vPos();
        if (s.step === 'collect' && vp && !vp.driving && d2(p, s.bin) < 2.2) { s.hold = .01; return 'Recolhendo…'; }
        if (s.step === 'dump' && vp && d2(p, rear(vp)) < 2) { p.carry = null; s.used.push(s.bin); s.done++; s.earned += 35; window.CityAudio?.thump(vp.x, vp.y, 'bat'); notify('🗑️ Lixo na caçamba · +' + money(35));
          if (s.done >= s.total) s.step = 'return'; else { s.step = 'drive'; s.bin = null; next(s); } return 'Coleta feita'; }
        return doReturn(s, vp);
      },
      next(s) { s.bin = binNear(s.lastBin || vPos(), 50, 320, s.used); if (s.bin) s.lastBin = s.bin; }
    },
    mechanic: { total: 4, start(s) { s.step = 'wait'; s.wt = 1; },
      tick(s, p) {
        const H = s.H; if (!H) return;
        if (s.step === 'wait') { s.wt -= 1 / 30; task('Aguarde o próximo carro chegar ao elevador', null); if (s.wt <= 0) arrive(s); return; }
        if (s.step === 'repair') task('Conserte o ' + s.car.title + ' · defeito: ' + s.car.fault, { x: s.car.box.x, y: s.car.box.y, z: 1.6 }, 0x4fc3f7);
      },
      prompt(s, p) { return s.step === 'repair' && !qte && d2(p, s.car.box) < 3.4 ? 'F · Consertar (' + s.car.fault + ')' : null; },
      interact(s, p) { if (s.step === 'repair' && !qte && d2(p, s.car.box) < 3.4) { startQte(s); return 'Mãos à obra!'; } return null; }
    },
    barista: { total: 6, start(s) { s.queue = []; s.served = 0; s.spawnT = 1; s.lost = 0; },
      tick(s, p) {
        const H = s.H; if (!H) return;
        s.spawnT -= 1 / 30;
        if (s.spawnT <= 0 && s.queue.length < 2 && s.done + s.lost + s.queue.length < s.total) { s.spawnT = rnd(6, 11); customer(s); }
        for (const c of [...s.queue]) { if (!c.n) continue; c.wait += 1 / 30; if (c.wait > 75) { chars()?.say?.(c.n, 'Demorou demais, vou embora!', '😠'); chars()?.releaseExtra?.(c.n, { ...s.exit, leave: true }); s.queue.splice(s.queue.indexOf(c), 1); s.lost++; s.done++; notify('Um cliente foi embora sem ser atendido', false); } }
        if (s.done >= s.total) return finish(s);
        const c = s.queue.find(c => c.n);
        if (p.carry === 'tray') task('Sirva o pedido: ' + s.item[1] + ' ' + s.item[2], c ? c.n : null, 0x7fd6bd);
        else if (c) task('Pedido: ' + c.item[1] + ' ' + c.item[2] + ' · prepare no balcão (F)', s.counter, 0xffd54a);
        else task('Aguarde os clientes chegarem', s.counter, 0x9e9e9e);
      },
      prompt(s, p) {
        if (!p.carry && !menu && d2(p, s.counter) < 2.6) return 'F · Preparar um pedido';
        if (p.carry === 'tray') { const c = s.queue.find(c => c.n && d2(p, c.n) < 2); if (c) return 'F · Servir ' + s.item[2]; }
        return null;
      },
      interact(s, p) {
        if (!p.carry && !menu && d2(p, s.counter) < 2.6) { openMenu(s); return 'Escolha o pedido'; }
        if (p.carry === 'tray') { const c = s.queue.find(c => c.n && d2(p, c.n) < 2); if (!c) return null; p.carry = null;
          if (c.item[0] !== s.item[0]) { chars()?.say?.(c.n, 'Não foi isso que eu pedi! Eu queria ' + c.item[2].toLowerCase() + '.', '😠'); notify('Pedido errado — prepare de novo', false); return 'Pedido errado'; }
          const tip = Math.max(0, Math.round(22 - c.wait * .3)), pay = 18 + tip; s.earned += pay; s.done++; s.queue.splice(s.queue.indexOf(c), 1);
          chars()?.say?.(c.n, pick(['Obrigado! Tá ótimo!', 'Perfeito, valeu!', 'Hmm, delícia!']), '😄'); setTimeout(() => chars()?.releaseExtra?.(c.n, { ...s.exit, leave: true }), 2500);
          notify('☕ Pedido servido · +' + money(pay) + (tip ? ' (gorjeta ' + money(tip) + ')' : '')); return 'Cliente atendido'; }
        return null;
      }
    }
  };
  const next = s => FLOWS[s.job].next?.(s);
  function destOf(s, vp) { const H = houseNear(vp, 200, 520, s.used); if (!H) return { x: vp.x + 150, y: vp.y, door: { x: vp.x + 150, y: vp.y } }; s.used.push(H); return { x: H.front[0], y: H.front[1], door: { x: H.doorPt[0], y: H.doorPt[1] } }; }
  // devolução do veículo na vaga de saída do pátio
  function returnTask(s, vp, text) { task(vp.driving ? text : 'Devolva o veículo: F perto dele na vaga', s.site.delivery, 0xff7043, 'Devolver veículo'); }
  const atReturn = (s, vp) => vp && d2(vp, s.site.delivery) < 9;
  function returnPrompt(s, vp, what) { return s.step === 'return' && vp && !vp.driving && atReturn(s, vp) && d2(P(), vp) < 4 ? 'F · Devolver ' + what + ' e receber' : null; }
  function doReturn(s, vp) { if (s.step === 'return' && vp && !vp.driving && atReturn(s, vp) && d2(P(), vp) < 4) { V()?.removeKey?.(vKey()); finish(s); return 'Turno encerrado'; } return null; }

  // ---------- mecânico: carro no elevador e minijogo ----------
  const FAULTS = ['freios gastos', 'motor falhando', 'suspensão batendo', 'troca de óleo', 'pneu furado', 'embreagem patinando'];
  function arrive(s) {
    const lifts = furn(s.H, 'carlift', 'workshop'); if (!lifts.length) { notify('Oficina sem elevador disponível', false); return endShift(false); }
    const L = pick(lifts), model = pick(['sedan', 'hatchback', 'suv', 'compact', 'wagon', 'pickup']), col = pick(['#7f8c8d', '#c0392b', '#2c3e50', '#f4f4f2', '#27ae60']);
    const A = s.H.architecture, ey = A.toWorld(L.f.x, L.f.y + 1).map((v, i) => v - [L.x, L.y][i]);
    const box = bridge.addBox({ x: L.x, y: L.y, w: 4.6, d: 1.9, h: 1.5, z: 0, rot: Math.atan2(ey[1], ey[0]), kind: 'parkedcar', modelId: model, col, top: col, side: col, display: true, solid: true, house: s.H, floor: 0, draw: typeof drawParkedCar === 'function' ? drawParkedCar : undefined, vehicleKey: 'repair:' + performance.now() });
    s.car = { box, fault: pick(FAULTS), title: sim()?.CARS?.[model]?.title || model };
    s.step = 'repair'; window.CityAudio?.horn(L.x, L.y, .2);
  }
  function startQte(s) {
    const keys = Array.from({ length: 6 }, () => pick(['W', 'A', 'S', 'D', 'Q', 'E']));
    qte = { keys, i: 0, ok: 0, t: 0, lim: 1.7 };
    const el = document.createElement('div'); el.id = 'city-job-qte';
    el.innerHTML = `<h3>🔧 ${s.car.title} · ${s.car.fault}</h3><p>Aperte as teclas na ordem, antes do tempo acabar</p><div class="q-keys">${keys.map(k => `<kbd>${k}</kbd>`).join('')}</div><div class="q-time"><i></i></div>`;
    document.body.appendChild(el); qte.el = el; paintQte();
  }
  function paintQte() { const ks = qte.el.querySelectorAll('kbd'); ks.forEach((k, i) => k.classList.toggle('now', i === qte.i)); }
  function qteKey(k) {
    if (!qte) return false; const want = qte.keys[qte.i], kb = qte.el.querySelectorAll('kbd')[qte.i];
    const good = k.toUpperCase() === want; kb.classList.add(good ? 'ok' : 'bad'); if (good) { qte.ok++; window.CityAudio?.reload('in', P().x, P().y); } else window.CityAudio?.dryFire(P().x, P().y);
    qte.i++; qte.t = 0; if (qte.i >= qte.keys.length) endQte(); else paintQte(); return true;
  }
  function endQte() {
    const s = shift, q = qte; qte = null; setTimeout(() => q.el.remove(), 600);
    const quality = q.ok / q.keys.length, pay = Math.round(60 + 70 * quality); s.earned += pay; s.done++;
    notify(`🔧 ${s.car.title} consertado · qualidade ${Math.round(quality * 100)}% · +${money(pay)}`, quality >= .5);
    const b = s.car.box; setTimeout(() => { b.fleetHidden = true; b.solid = false; }, 1500); s.car = null;
    if (s.done >= s.total) finish(s); else { s.step = 'wait'; s.wt = 4; }
  }
  // ---------- atendente: clientes e cardápio ----------
  async function customer(s) {
    const tables = furn(s.H, 'cafetable', 'cafe'); const T = pick(tables) || s.counter; const c = { item: pick(MENU), wait: 0, n: null }; s.queue.push(c);
    const a = Math.random() * TAU, x = T.x + Math.cos(a) * .95, y = T.y + Math.sin(a) * .95;
    c.n = await chars()?.spawnExtra?.(x, y, { face: Math.atan2(T.y - y, T.x - x) });
    if (!c.n) { s.queue.splice(s.queue.indexOf(c), 1); return; }
    setTimeout(() => chars()?.say?.(c.n, pick(['Por favor, um ', 'Me vê um ', 'Quero um ']) + c.item[2].toLowerCase() + '! ' + c.item[1], c.item[1]), 900);
  }
  function openMenu(s) {
    menu = document.createElement('div'); menu.id = 'city-job-menu';
    menu.innerHTML = '<h3>☕ Balcão da lanchonete</h3><p>O que você vai preparar?</p><div class="m-items">' + MENU.map((m, i) => `<button data-i="${i}"><span>${m[1]}</span>${m[2]}<kbd>${i + 1}</kbd></button>`).join('') + '</div>';
    menu.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) choose(s, +b.dataset.i); });
    document.body.appendChild(menu); bridge.releaseControls?.();
  }
  function choose(s, i) {
    if (!menu) return; menu.remove(); menu = null; s.item = MENU[i]; s.prep = 1.2; shift.task = 'Preparando ' + MENU[i][2].toLowerCase() + '…'; paintHud();
    window.CityAudio?.ui('click'); setTimeout(() => { if (shift === s) { P().carry = 'tray'; window.CityAudio?.ui('confirm'); } }, 1200);
  }

  // ---------- turno ----------
  async function startShift(job) {
    const def = JOB_DEFS[job], site = siteOf(def.site);
    shift = { job, def, site, step: '', done: 0, total: FLOWS[job].total, earned: 0, task: '', t: performance.now() };
    if (def.site === 'dealer' || def.site === 'hospital') shift.H = building(def.site);
    if (job === 'barista') { const C = furn(shift.H, 'coffeestation', 'cafe')[0]; shift.counter = C || { x: P().x, y: P().y }; const A = shift.H.architecture, room = A.levels[0].rooms.find(r => r.use === 'cafe'); const ex = A.toWorld((room.x0 + room.x1) / 2, room.y1 + 6); shift.exit = { x: ex[0], y: ex[1] }; }
    FLOWS[job].start(shift);
    if (def.vehicle && !(await giveVehicle())) { shift = null; paintHud(); return; }
    notify(def.icon + ' Ponto batido · ' + def.title + '. Bom trabalho!'); paintHud();
  }
  function finish(s) {
    if (shift !== s) return; const pay = s.def.base + s.earned;
    if (typeof CityLife !== 'undefined') CityLife.credit(pay, 'Salário · ' + s.def.title);
    notify(`${s.def.icon} Turno encerrado · você recebeu ${money(pay)} (diária ${money(s.def.base)} + produção ${money(s.earned)})`);
    window.CityAdventures?.signal?.('job');
    endShift(true);
  }
  function endShift(paid) {
    const s = shift; if (!s) return; shift = null; setMarker(null); window.CityGPS?.clear?.();
    if (P().carry) P().carry = null; if (qte) { qte.el.remove(); qte = null; } if (menu) { menu.remove(); menu = null; }
    if (s.def.vehicle && !paid) V()?.removeKey?.('job:' + s.job);
    for (const c of s.queue || []) if (c.n) chars()?.releaseExtra?.(c.n, { ...(s.exit || c.n), leave: true });
    if (s.npc) chars()?.removeExtra?.(s.npc); if (s.car) { s.car.box.fleetHidden = true; s.car.box.solid = false; }
    paintHud();
  }
  // onde bater o ponto: dentro do prédio do emprego (oficina na City Motors, lanchonete no hospital)
  function atWork(job, p) {
    const def = JOB_DEFS[job];
    if (def.site === 'depot') { const H = building('depot'); return !!(H?.inside && !(p.floor || 0)); }
    if (def.site === 'dealer') return !!inRoom(building('dealer'), 'workshop', p);
    if (def.site === 'hospital') return !!inRoom(building('hospital'), 'cafe', p);
    return false;
  }

  addEventListener('keydown', e => {
    if (qte && /^[wasdqe]$/i.test(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); qteKey(e.key); }
    else if (menu && /^[1-4]$/.test(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); choose(shift, +e.key - 1); }
    else if (menu && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); menu.remove(); menu = null; }
  }, true);
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop); const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (marker.visible) { gem.rotation.y += dt * 2; gem.position.y = 2.6 + Math.sin(now / 400) * .2; ring.scale.setScalar(1 + Math.sin(now / 300) * .08); }
    if (qte) { qte.t += dt; const bar = qte.el.querySelector('.q-time i'); if (bar) bar.style.width = Math.max(0, 100 - qte.t / qte.lim * 100) + '%'; if (qte.t > qte.lim) qteKey('-'); }
  }
  requestAnimationFrame(loop);
  const api = {
    defs: JOB_DEFS,
    get shift() { return shift && { job: shift.job, step: shift.step, done: shift.done, total: shift.total, earned: shift.earned, task: shift.task }; },
    get busy() { return !!(qte || menu); },
    // chamado pelo laço do jogo (game.js)
    tick(dt) { if (!shift || P().dead) return; const f = FLOWS[shift.job]; for (let i = 0, n = Math.max(1, Math.round(dt * 30)); i < n; i++) if (shift) f.tick(shift, P()); },
    prompt(p) { if (!p || p.dead) return null; if (shift) return FLOWS[shift.job].prompt(shift, p); const job = hired(); return job && atWork(job, p) ? 'F · Bater o ponto: ' + JOB_DEFS[job].title : null; },
    interact(p) { if (!p || p.dead) return false; if (shift) return FLOWS[shift.job].interact(shift, p) || false; const job = hired(); if (job && atWork(job, p)) { void startShift(job); return 'Ponto batido!'; } return false; },
    route() { const job = hired(); if (!job) return { ok: false, text: 'Você ainda não tem emprego' }; const def = JOB_DEFS[job], s = siteOf(def.site); if (!s) return { ok: false, text: 'Local indisponível' }; window.CityGPS?.set?.({ x: s.x, y: s.y + 2, name: def.place }); return { ok: true, text: 'Rota traçada até ' + def.place }; },
    abandon() { if (!shift) return { ok: false, text: 'Você não está em turno' }; endShift(false); notify('Turno abandonado — sem pagamento', false); return { ok: true, text: 'Turno abandonado' }; },
    _debug: () => shift
  };
  window.CityJobs = api;
  return api;
}
