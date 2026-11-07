// ai-traffic.mjs — trânsito leve de carros civis com IA (poucos carros, só perto do jogador). Cada carro segue uma rota
// pelas ruas (CityRoadRouting) na faixa da direita e obedece às regras:
//  · limite de velocidade por tipo de via e redução antes das curvas;
//  · semáforo: para antes da faixa no vermelho e no amarelo quando ainda dá p/ parar (fase de pedestres = todos vermelhos);
//  · cruzamento sem sinal: reduz, e só entra quem "pegou a vez" (um carro por vez no cruzamento; os outros esperam);
//  · distância segura do carro da frente (trânsito, viatura, carro do jogador) e para p/ pedestre na frente.
// O carro é cinemático (não tem física): se mesmo assim algo o bloqueia, ele só para. Fica em world.aiCars, então o
// jogador (a pé ou de carro) bate nele como nas viaturas. As regras puras (sem engine) estão exportadas p/ os testes.
import {loadVehicleGLB} from './vehicle-asset-cache.mjs';
import {VEHICLE_MODELS} from './vehicle-catalog.mjs';
import {carCollision} from './vehicle-collision.mjs';

export const LANE = 1.75;
export const LIMIT = { street: 9, avenue: 12.5, highway: 18 };   // m/s ≈ 32, 45 e 65 km/h
export const DEC = 4.5, ACC = 2.2, GAP = 2.2, JUNCTION_R = 9;
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const MODELS = ['sedan', 'hatchback', 'compact', 'suv', 'wagon', 'pickup', 'minivan'];

// ---------------- regras puras ----------------
// rota deslocada p/ a faixa da direita (mesma convenção das viaturas)
export function lanePath(points, lane = LANE) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const fx = (b[0] - a[0]) / l, fy = (b[1] - a[1]) / l;
    out.push([points[i][0] - fy * lane, points[i][1] + fx * lane]);
  }
  return out;
}
// distância até parar = v² / 2a; velocidade que ainda para em d metros
export const stopSpeed = d => Math.sqrt(2 * DEC * Math.max(0, d));
// obstáculo à frente no corredor da faixa: devolve a folga (m) até o para-choque, ou null (leadAhead diz também quem é)
export const gapAhead = (car, obstacles, reach) => leadAhead(car, obstacles, reach).gap;
export function leadAhead(car, obstacles, reach) {
  const ca = Math.cos(car.a), sa = Math.sin(car.a); let best = null, who = null;
  for (const o of obstacles) {
    if (o === car || o.ref === car) continue;
    // outro carro do trânsito cruzando ou na contramão (não é fila): só quem tem número maior cede — nunca os dois
    // esperam um pelo outro (o cruzamento e a colisão continuam valendo p/ todos)
    if (o.ref && car.id && Math.cos(o.ref.a - car.a) < .5 && o.ref.id > car.id) continue;
    const dx = o.x - car.x, dy = o.y - car.y, lx = dx * ca + dy * sa, ly = Math.abs(-dx * sa + dy * ca);
    if (lx <= 0 || lx > reach + car.length) continue;
    if (ly > car.width / 2 + (o.half ?? .4) + (o.parked ? .12 : .35)) continue;   // estacionado na vaga ao lado não é obstáculo
    const g = lx - car.length / 2 - (o.len ?? .4);
    if (best === null || g < best) { best = g; who = o; }
  }
  return { gap: best, o: who };
}
// semáforo: distância até a linha de parada quando é preciso parar (null = pode seguir)
export function signalStop(car, signals, phase) {
  const ca = Math.cos(car.a), sa = Math.sin(car.a); let stop = null;
  for (const s of signals || []) {
    if (ca * s.ax + sa * s.ay < .7) continue;                         // não é o sinal da nossa mão
    const dx = s.x - car.x, dy = s.y - car.y, along = dx * ca + dy * sa, lat = Math.abs(-dx * sa + dy * ca);
    if (along < 1 || along > 45 || lat > 9) continue;
    const st = phase[s.group], d = along - 1.5 - car.length / 2;
    const must = st === 'red' || st === 'yellow' && d > car.speed * car.speed / (2 * DEC) + 1;   // amarelo: para se der
    if (must && (stop === null || d < stop)) stop = d;
  }
  return stop;
}
// cruzamento sem semáforo: um carro por vez. owners: Map(chave → carro). Devolve a distância até onde parar (null = vai)
export function junctionStop(car, J, owners, others) {
  const key = J.key, d = Math.hypot(J.x - car.x, J.y - car.y), owner = owners.get(key);
  // quem tem a vez mas ficou preso (> 4 s parado) perde a vez: ninguém espera p/ sempre
  const ownerIn = owner && owner !== car && !owner.dead && !(owner.wait > 4) && Math.hypot(owner.x - J.x, owner.y - J.y) < JUNCTION_R + 4;
  if (owner === car) return null;                                   // tem a vez: passa
  if (d < JUNCTION_R - 1) return null;                              // já está dentro: termina de atravessar, não trava no meio
  if (owner && !ownerIn) owners.delete(key);
  if (ownerIn) return Math.max(0, d - JUNCTION_R - car.length / 2);
  // outro veículo (viatura, carro do jogador) andando dentro do cruzamento: espera ele sair
  for (const o of others) if (o !== car && Math.abs(o.speed || 0) > .5 && Math.hypot(o.x - J.x, o.y - J.y) < JUNCTION_R) return Math.max(0, d - JUNCTION_R - car.length / 2);
  // pega a vez com antecedência (distância de frenagem): quem vem depois já sabe que tem de esperar
  if (d < JUNCTION_R + car.length / 2 + 2 + (car.speed || 0) ** 2 / (2 * DEC)) owners.set(key, car);
  return null;
}

// ponto da rota 'look' metros à frente da projeção do carro no trecho atual (mira suave, também em retas longas)
export function lookPoint(P, wi, x, y, look) {
  const k = Math.max(1, Math.min(wi, P.length - 1)), a = P[k - 1], b = P[k], sx = b[0] - a[0], sy = b[1] - a[1], L = Math.hypot(sx, sy) || 1;
  let t = Math.max(0, Math.min(1, ((x - a[0]) * sx + (y - a[1]) * sy) / (L * L))), px = a[0] + sx * t, py = a[1] + sy * t, left = look;
  for (let i = k; i < P.length; i++) {
    const q = P[i], d = Math.hypot(q[0] - px, q[1] - py);
    if (d >= left) return [px + (q[0] - px) * left / d, py + (q[1] - py) * left / d];
    left -= d; px = q[0]; py = q[1];
  }
  return [px, py];
}

// ---------------- trânsito no mundo ----------------
export function createTraffic(THREE, scene, bridge, { network, roadPoint, people = () => [], max = () => 5 } = {}) {
  const world = bridge.world; world.aiCars = world.aiCars || [];
  const cars = [], owners = new Map(), models = new Map(), state = { cars: 0, spawned: 0, despawned: 0, waits: 0 };
  let uid = 0, spawnT = 0, junctions = null, junctionSrc = null, parked = [], parkedT = 0;
  const junctionList = () => {
    const src = (typeof OW !== 'undefined' && OW.cw?.junctions) || bridge.junctions || [];
    if (src !== junctionSrc) { junctionSrc = src; junctions = src.map((j, i) => ({ x: j.x, y: j.y, key: 'j' + i, signal: (world.trafficSignals || []).some(s => Math.hypot(s.x - j.x, s.y - j.y) < 24) })); }
    return junctions;
  };
  // ---------- modelos (carregados uma vez, clonados por carro) ----------
  function normalize(root, cfg) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), dim = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const pos = new THREE.Group(); pos.position.set(-c.x, -box.min.y, -c.z); pos.add(root);
    const s = cfg.length / Math.max(dim.x, dim.z), sc = new THREE.Group(); sc.scale.setScalar(s); sc.add(pos);
    const al = new THREE.Group(); al.rotation.y = cfg.front === '+Z' ? Math.PI / 2 : -Math.PI / 2; al.add(sc);
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    return { tpl: al, cfg, width: Math.min(dim.x, dim.z) * s };
  }
  function model(id) {
    if (!models.has(id)) {
      const cfg = VEHICLE_MODELS.find(m => m.id === id); if (!cfg) return null;
      const entry = { ready: null, failed: false };
      entry.promise = loadVehicleGLB(cfg).then(g => { entry.ready = normalize(g.scene, cfg); }).catch(() => { entry.failed = true; });
      models.set(id, entry);
    }
    return models.get(id);
  }
  const readyModels = () => MODELS.map(model).filter(m => m?.ready).map(m => m.ready);

  // ---------- rota ----------
  function plan(u) {
    const net = network?.(); if (!net) return false;
    // destino do outro lado do jogador: o carro passa pela região onde ele está (senão o trânsito só se afasta e some)
    const p = bridge.player;
    // 8 tentativas: as 5 primeiras exigem seguir em frente; depois aceita retorno (rua sem saída à frente)
    for (let k = 0; k < 8; k++) {
      // longe do jogador: vai até uma rua bem perto dele (até ~35 m); já passou por perto: segue p/ o outro lado e some
      const dp = Math.hypot(p.x - u.x, p.y - u.y), toward = dp > 45 && k < 4;
      const away = Math.atan2(p.y - u.y, p.x - u.x) + (Math.random() - .5) * 1.4;
      const bx = p.x, by = p.y, a = toward ? Math.random() * TAU : away, d = toward ? Math.random() * 35 : 70 + Math.random() * 110;
      const q = roadPoint?.(bx + Math.cos(a) * d, by + Math.sin(a) * d, 60); if (!q) continue;
      const r = net.route({ x: u.x, y: u.y }, { x: q.x, y: q.y }); if (!r || r.points.length < 3 || r.length < 60) continue;
      // começa pelo ponto da rota à frente do carro (sem dar meia-volta no meio da rua)
      const P = lanePath(r.points); let i = 1;
      while (i < P.length - 1 && Math.cos(Math.atan2(P[i][1] - u.y, P[i][0] - u.x) - u.a) < .2 && Math.hypot(P[i][0] - u.x, P[i][1] - u.y) < 15) i++;
      if (u.planned && k < 5 && Math.cos(Math.atan2(P[i][1] - u.y, P[i][0] - u.x) - u.a) < -.3) continue;
      // a malha de rotas é a macro (OW.cw.roads): alguns trechos dela não viram rua de verdade (terreno de prédio por cima).
      // Rota que sai do asfalto real é descartada — senão o carro atravessa a avenida rumo a uma rua que não existe
      if (!onAsphalt(P)) { state.badRoutes = (state.badRoutes || 0) + 1; continue; }
      u.path = P; u.wi = i; u.planned = true;
      const jl = junctionList(); u.jx = jl.filter(J => P.some(p => Math.hypot(p[0] - J.x, p[1] - J.y) < 7));
      return true;
    }
    return false;
  }
  // amostra a rota a cada ~3 m: todos os pontos têm de estar no asfalto (sem roadDist, ex.: testes, aceita)
  function onAsphalt(P) {
    const rd = bridge.roadDist; if (typeof rd !== 'function') return true;
    const lim = (bridge.ROAD_W || 3.5) + .4;
    for (let k = 1; k < P.length; k++) {
      const a = P[k - 1], b = P[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 3));
      for (let s = 0; s <= n; s++) { const t = s / n; if (rd(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) > lim) return false; }
    }
    return true;
  }
  const clsAt = (x, y) => network?.()?.nearest(x, y)?.seg?.cls || 'street';

  // ---------- nasce / some ----------
  const collisionOpts = u => ({ houses: bridge.houses, boxes: bridge.boxes, query: bridge.collQuery, mapSize: bridge.mapSize, ignoreAI: u.box });
  function spawn() {
    const p = bridge.player, tpl = readyModels(); if (!tpl.length) { MODELS.forEach(model); return; }
    for (let k = 0; k < 8; k++) {
      const a = Math.random() * TAU, d = 70 + Math.random() * 45, q = roadPoint?.(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 30); if (!q) continue;
      if (Math.hypot(q.x - p.x, q.y - p.y) < 60) continue;
      if (cars.some(c => Math.hypot(c.x - q.x, c.y - q.y) < 22) || world.aiCars.some(b => Math.hypot(b.x - q.x, b.y - q.y) < 15)) continue;
      const m = tpl[(Math.random() * tpl.length) | 0];
      const u = { id: ++uid, x: q.x, y: q.y, a: q.a, speed: 0, length: m.cfg.length, width: Math.max(1.7, Math.min(2.1, m.width || 1.9)), path: null, wi: 0, wait: 0, t: 0, dead: false };
      if (!plan(u)) continue;
      // nasce no começo da rota, já na faixa da direita e de frente p/ onde vai
      u.x = u.path[0][0]; u.y = u.path[0][1]; u.a = Math.atan2(u.path[1][1] - u.y, u.path[1][0] - u.x); u.wi = 1;
      if (Math.hypot(u.x - p.x, u.y - p.y) < 60) continue;
      if (carCollision(world, { x: u.x, y: u.y, angle: u.a, length: u.length, width: u.width }, collisionOpts({ box: null }))) continue;
      u.root = new THREE.Group(); u.root.add(m.tpl.clone(true)); scene.add(u.root);
      u.box = { x: u.x, y: u.y, a: u.a, hl: u.length / 2, hw: u.width / 2, unit: u, traffic: true }; world.aiCars.push(u.box);
      u.speed = Math.min(6, LIMIT[clsAt(u.x, u.y)] || 9);
      cars.push(u); state.spawned++; place(u); return;
    }
  }
  function remove(u) {
    u.dead = true; cars.splice(cars.indexOf(u), 1);
    const j = world.aiCars.indexOf(u.box); if (j >= 0) world.aiCars.splice(j, 1);
    for (const [k, o] of owners) if (o === u) owners.delete(k);
    if (u.root) scene.remove(u.root); state.despawned++;
  }
  function place(u) { u.root.position.set(u.x, 0, u.y); u.root.rotation.y = -u.a; u.box.x = u.x; u.box.y = u.y; u.box.a = u.a; }

  // ---------- quem está na frente ----------
  function obstacles() {
    const list = cars.map(c => ({ x: c.x, y: c.y, half: c.width / 2, len: c.length / 2, speed: c.speed, ref: c }));
    for (const b of world.aiCars) if (!b.traffic) list.push({ x: b.x, y: b.y, half: b.hw, len: b.hl, speed: b.unit?.speed || 0 });
    const V = window.cityVehicles; if (V?.car) list.push({ x: V.car.x, y: V.car.y, half: 1, len: (V.carLength || 4.5) / 2, speed: V.driver ? V.car.speed || 0 : 0, player: true });
    for (const h of people()) if (h && !h.dead) list.push({ x: h.x, y: h.y, half: .35, len: .3, person: true });
    // carros estacionados perto (alguns encostam na faixa nas esquinas): lista refeita 1×/s
    if ((parkedT -= 1 / 30) <= 0) { parkedT = 1; const p = bridge.player; parked = (bridge.boxes || []).filter(b => (b.kind === 'parkedcar' || b.kind === 'vehicle') && b.solid !== false && Math.abs(b.x - p.x) < 200 && Math.abs(b.y - p.y) < 200).map(b => ({ x: b.x, y: b.y, rot: b.rot || 0, half: b.d / 2, len: b.w / 2, speed: 0, parked: true })); }
    return list;
  }
  function drive(u, dt, obs, phase) {
    u.t += dt;
    // fim da rota (chegou no último ponto): planeja a próxima a partir daqui
    const end = u.path?.[u.path.length - 1];
    if (!u.path || u.wi >= u.path.length - 1 && Math.hypot(end[0] - u.x, end[1] - u.y) < 4) {
      // sem rota: freia, conta como espera (some fora da vista) e só tenta de novo em 1 s (rota custa caro p/ todo quadro)
      if ((u.replanT = (u.replanT || 0) - dt) > 0 || !plan(u)) { if (u.replanT <= 0) u.replanT = 1; u.speed = Math.max(0, u.speed - DEC * dt); u.wait += dt; u.why = 'sem rota'; return; }
    }
    const P = u.path;
    while (u.wi < P.length - 1 && Math.hypot(P[u.wi][0] - u.x, P[u.wi][1] - u.y) < 3.2) u.wi++;
    // ponto de mira (pure pursuit) uns metros adiante na rota
    // dando ré p/ sair de um encosto (poste, hidrante, outro carro): volta ~1 m reto e depois contorna
    if (u.backT > 0) {
      u.backT -= dt; u.speed = 0; const bx = u.x - Math.cos(u.a) * 1.4 * dt, by = u.y - Math.sin(u.a) * 1.4 * dt;
      if (!carCollision(world, { x: bx, y: by, angle: u.a, length: u.length, width: u.width }, collisionOpts(u))) { u.x = bx; u.y = by; } else u.backT = 0;
      u.why = 'manobra'; return;
    }
    // mira curta nas curvas: com a mira longa o carro cortava a esquina e raspava no meio-fio
    const turning = u.wi < P.length - 1 && Math.abs(angDiff(Math.atan2(P[u.wi][1] - u.y, P[u.wi][0] - u.x), Math.atan2(P[u.wi + 1][1] - P[u.wi][1], P[u.wi + 1][0] - P[u.wi][0]))) > .5 && Math.hypot(P[u.wi][0] - u.x, P[u.wi][1] - u.y) < 10;
    let [tx, ty] = lookPoint(P, u.wi, u.x, u.y, turning ? 2.6 : 4 + u.speed * .5);
    // ultrapassando um carro parado: mira deslocada p/ a esquerda até passar dele
    if (u.shift) { tx += Math.sin(u.a) * u.shift; ty -= Math.cos(u.a) * u.shift; u.shiftLeft -= u.speed * dt; if (u.shiftLeft <= 0) u.shift = 0; }
    const da = angDiff(u.a, Math.atan2(ty - u.y, tx - u.x));
    // limite da via e curva à frente
    u.cls = u.t % 1 < dt || !u.cls ? clsAt(u.x, u.y) : u.cls;
    let v = LIMIT[u.cls] || 9;
    if (u.wi < P.length - 2) { const a1 = Math.atan2(P[u.wi][1] - u.y, P[u.wi][0] - u.x), a2 = Math.atan2(P[u.wi + 1][1] - P[u.wi][1], P[u.wi + 1][0] - P[u.wi][0]), turn = Math.abs(angDiff(a1, a2)), dw = Math.hypot(P[u.wi][0] - u.x, P[u.wi][1] - u.y);
      if (turn > .35) v = Math.min(v, Math.max(3.5, 9 - turn * 4.5) + Math.max(0, dw - 6) * .5); }
    if (Math.abs(da) > .5) v = Math.min(v, 4);
    // carro da frente / pedestre
    let { gap, o: lead } = leadAhead(u, obs, 8 + u.speed * 1.6);
    const pb = parkedOnPath(u, 8 + u.speed * 1.6); if (pb && (gap === null || pb.gap < gap)) { gap = pb.gap; lead = pb.o; }
    // atrás de carro estacionado deixa espaço p/ sair; ultrapassando, passa devagar
    u.why = '';
    if (gap !== null) { v = u.shift && (lead?.parked || lead?.ref?.wait > 6 && /sem rota|colisao|estacionado|manobra/.test(lead.ref.why)) ? Math.min(v, 3.5) : Math.min(v, stopSpeed(gap - (lead?.parked ? 6.5 : GAP))); if (v < .3) u.why = lead.person ? 'pedestre' : lead.parked ? 'estacionado' : lead.player ? 'jogador' : 'carro'; }
    // parado atrás de carro estacionado (não de fila nem de sinal): ultrapassa pela esquerda se a outra mão está livre
    // atrás de carro estacionado, ou de outro carro travado há tempo: contorna pela esquerda se a outra mão está livre
    const stuck = o => o?.ref && o.ref.wait > 6 && /sem rota|colisao|estacionado|manobra/.test(o.ref.why);   // quebrado/sem saída, não fila nem sinal
    if ((lead?.parked || stuck(lead)) && gap < 9.5 && u.speed < .5) { u.blockT = (u.blockT || 0) + dt; if (u.blockT > 1.2) { u.blockT = 0; overtake(u, lead, obs); } } else u.blockT = 0;
    // semáforo
    const sig = signalStop(u, world.trafficSignals, phase); if (sig !== null) { v = Math.min(v, stopSpeed(sig)); if (v < .3 && !u.why) u.why = 'semaforo'; }
    // cruzamento sem semáforo: o próximo da rota que ainda está à frente
    for (const J of u.jx || []) {
      if (J.signal) continue;
      const dx = J.x - u.x, dy = J.y - u.y, d = Math.hypot(dx, dy), ahead = dx * Math.cos(u.a) + dy * Math.sin(u.a);
      if (d > 30) continue;
      if (ahead < -2) { if (owners.get(J.key) === u && d > JUNCTION_R + 2) owners.delete(J.key); continue; }
      const stop = junctionStop(u, J, owners, obs.filter(o => !o.person && o.ref !== u));
      if (stop !== null) { v = Math.min(v, stopSpeed(stop)); state.waits++; if (v < .3 && !u.why) u.why = 'cruzamento'; }
      else v = Math.min(v, Math.max(5.5, stopSpeed(d - 2) + 3));   // passa o cruzamento devagar
      break;
    }
    // acelera suave, freia firme
    u.speed += Math.max(-DEC * 1.6 * dt, Math.min(ACC * dt, v - u.speed));
    if (u.speed < .02 && v < .05) u.speed = 0;
    const yaw = Math.max(-1.2, Math.min(1.2, da * 2.4)) * Math.min(1, u.speed / 3);
    const na = u.a + yaw * dt, nx = u.x + Math.cos(na) * u.speed * dt, ny = u.y + Math.sin(na) * u.speed * dt;
    if (u.speed > .01 && carCollision(world, { x: nx, y: ny, angle: na, length: u.length, width: u.width }, collisionOpts(u))) {
      u.speed = 0; u.wait += dt; u.why = 'colisao'; u.hitT = (u.hitT || 0) + dt;
      // encostado há 1 s: ré curta e desvio p/ o lado oposto ao obstáculo nos próximos metros
      if (u.hitT > 1) {
        u.hitT = 0; u.backT = .8;
        const o = carCollision(world, { x: nx, y: ny, angle: na, length: u.length, width: u.width }, collisionOpts(u))?.object || {};
        const ox = o.x ?? (o.x0 + o.x1) / 2, oy = o.y ?? (o.y0 + o.y1) / 2;
        if (Number.isFinite(ox) && Number.isFinite(oy)) { const left = (ox - u.x) * Math.sin(u.a) - (oy - u.y) * Math.cos(u.a); u.shift = left > 0 ? -1.1 : 1.1; u.shiftLeft = 9; }
      }
    }
    else { u.x = nx; u.y = ny; u.a = na; u.hitT = 0; if (u.speed > .3) u.wait = 0; else u.wait += dt; }
  }
  // carro estacionado no caminho: anda o para-choque pela ROTA (não reto pelo capô — numa curva o capô aponta p/ as
  // vagas do meio-fio e dava falso bloqueio) e vê se ele entra no carro parado
  function parkedOnPath(u, reach) {
    const near = parked.filter(b => Math.abs(b.x - u.x) < reach + 8 && Math.abs(b.y - u.y) < reach + 8); if (!near.length || !u.path) return null;
    for (let s = u.length / 2; s <= u.length / 2 + reach; s += 1) {
      const [px, py] = u.shift ? [u.x + Math.cos(u.a) * s + Math.sin(u.a) * u.shift, u.y + Math.sin(u.a) * s - Math.cos(u.a) * u.shift] : lookPoint(u.path, u.wi, u.x, u.y, s);
      for (const b of near) { const c = Math.cos(b.rot), sn = Math.sin(b.rot), dx = px - b.x, dy = py - b.y;
        if (Math.abs(dx * c + dy * sn) < b.len + .25 && Math.abs(-dx * sn + dy * c) < b.half + u.width / 2 + .05) return { gap: s - u.length / 2, o: b }; }
    }
    return null;
  }
  function overtake(u, lead, obs) {
    const ca = Math.cos(u.a), sa = Math.sin(u.a), net = network?.();
    // sempre p/ o lado do centro da via (a outra mão), nunca p/ o meio-fio e as vagas
    const center = sg => net ? net.nearest(u.x + sa * sg * 2, u.y - ca * sg * 2)?.d ?? 99 : (sg > 0 ? 0 : 1);
    const sg = center(1) <= center(-1) ? 1 : -1;
    for (const s0 of [2.8, 3.6]) {
      const s = s0 * sg;
      // esquerda do sentido = (sen, −cos) · s
      const blocked = [4, 8, 12].some(d => { const x = u.x + ca * d + sa * s, y = u.y + sa * d - ca * s;
        return bridge.roadDist?.(x, y) > (bridge.ROAD_W || 3.5) || carCollision(world, { x, y, angle: u.a, length: u.length, width: u.width }, collisionOpts(u)); });   // nem fora do asfalto
      // ninguém vindo na outra mão nos próximos 40 m
      const oncoming = obs.some(o => !o.parked && !o.person && o.ref !== u && (() => { const dx = o.x - u.x, dy = o.y - u.y, f = dx * ca + dy * sa, l = dx * sa - dy * ca; return f > 0 && f < 40 && Math.abs(l - s) < 2.2; })());
      if (!blocked && !oncoming) { u.shift = s; u.shiftLeft = lead.len * 2 + 10; return true; }
    }
    return false;
  }
  function update(dt) {
    const p = bridge.player, phase = typeof bridge.trafficPhase === 'function' ? bridge.trafficPhase(bridge.gameTime || 0) : {};
    const want = Math.round(max() * (world.night ? .6 : 1));
    spawnT -= dt; if (spawnT <= 0 && cars.length < want) { spawnT = 1.5; spawn(); }
    const obs = obstacles();
    for (const u of [...cars]) {
      const d = Math.hypot(u.x - p.x, u.y - p.y);
      // longe demais, sobrando, ou preso há muito tempo fora da vista: some (outro nasce em outro lugar)
      if (d > 190 || cars.length > want && d > 110 || (u.wait > 15 && /sem rota|colisao|estacionado/.test(u.why) || u.wait > 45) && d > 40) { remove(u); continue; }   // esperando sinal/fila não some
      drive(u, dt, obs, phase); place(u);
    }
    state.cars = cars.length;
  }
  // há carro do trânsito (ou outro veículo) andando ou chegando perto deste ponto? (travessia de pedestre)
  function carNear(x, y, r = 22) {
    for (const b of world.aiCars) { const sp = Math.abs(b.unit?.speed || 0), d = Math.hypot(b.x - x, b.y - y); if (d < r && (sp > .5 || d < 6)) return true; }
    const V = window.cityVehicles; if (V?.driver && V.car && Math.abs(V.car.speed || 0) > .5 && Math.hypot(V.car.x - x, V.car.y - y) < r) return true;
    return false;
  }
  // carro numa rota dada (testes e depuração): sem modelo, só a lógica
  function add({ x, y, a, path, length = 4.5, width = 1.9 }) {
    const u = { id: ++uid, x, y, a, speed: 0, length, width, path, wi: 1, wait: 0, t: 0, dead: false, planned: true, root: new THREE.Group() };
    u.jx = junctionList().filter(J => path.some(p => Math.hypot(p[0] - J.x, p[1] - J.y) < 7));
    u.box = { x, y, a, hl: length / 2, hw: width / 2, unit: u, traffic: true }; world.aiCars.push(u.box); cars.push(u); place(u); return u;
  }
  return { cars, state, update, remove, carNear, spawn, add };
}
