// ai-traffic.mjs — trânsito leve de carros civis com IA (poucos carros, só perto do jogador). Cada carro SEGUE A RUA em
// que está, na faixa da direita, e no fim dela pega a continuação (reto, ou vira à direita/esquerda) — sem rota
// definida, sem meia-volta, sem contramão e sem ultrapassar. Regras: limite por tipo de via e redução nas curvas;
// semáforo (vermelho; amarelo só se der p/ parar); cruzamento sem sinal um carro por vez; distância do carro da frente;
// para p/ pedestre. Cinemático (sem física): se algo o bloqueia, ele só para. Fica em world.aiCars (o jogador bate nele).
// As regras puras (sem engine) estão exportadas p/ os testes.
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

// ---------------- seguir a rua ----------------
// ruas do setor (world.roads): pontos a cada ~0,5 m com direção (tx,ty). A faixa da direita fica no meio da metade da
// pista do sentido (na avenida, a faixa de dentro): ROAD_W + off é a meia-largura do asfalto, menos a faixa de
// estacionamento junto ao meio-fio (road.park, em m) quando a rua tem vagas
export const laneOffset = (road, ROAD_W = 3.5) => (ROAD_W + (road.off || 0) - (road.park || 0)) / (2 * Math.max(1, road.lanes || 1));
export function lanePoint(road, i, dir, ROAD_W = 3.5) {
  const p = road.pts[i], L = laneOffset(road, ROAD_W), tx = p.tx * dir, ty = p.ty * dir;
  return [p.x - ty * L, p.y + tx * L];
}
// fim da rua: a continuação (mesma rua cortada no setor, ou a rua do T/cruzamento). Nunca meia-volta: só direções a
// menos de ~100° da atual; reto é o mais provável, virar é possível. rnd: sorteio (testável)
export function continuation(roads, road, i, dir, rnd = Math.random) {
  const e = road.pts[i], hx = e.tx * dir, hy = e.ty * dir, opts = [];
  for (const r2 of roads) {
    if (r2 === road || !r2.pts?.length || (r2.cls === 'highway') !== (road.cls === 'highway')) continue;
    let best = -1, bd = 12;
    for (let j = 0; j < r2.pts.length; j += 2) { const p = r2.pts[j], d = Math.hypot(p.x - e.x, p.y - e.y); if (d < bd) { bd = d; best = j; } }
    if (best < 0) continue;
    for (const d2 of [1, -1]) {
      const k = best + d2 * 8; if (k < 0 || k >= r2.pts.length) continue;   // precisa de rua p/ frente nesse sentido
      const p = r2.pts[best], c = hx * p.tx * d2 + hy * p.ty * d2;
      if (c < -.17) continue;                                                // seria meia-volta
      opts.push({ road: r2, i: best, dir: d2, w: c > .85 ? 3 : 1 });
    }
  }
  if (!opts.length) return null;
  let t = rnd() * opts.reduce((s, o) => s + o.w, 0);
  for (const o of opts) if ((t -= o.w) <= 0) return o;
  return opts[opts.length - 1];
}

// ---------------- trânsito no mundo ----------------
export function createTraffic(THREE, scene, bridge, { people = () => [], max = () => 5 } = {}) {
  const world = bridge.world; world.aiCars = world.aiCars || [];
  const W = () => bridge.ROAD_W || 3.5, roads = () => bridge.roads || world.roads || [];
  const cars = [], owners = new Map(), models = new Map(), state = { cars: 0, spawned: 0, despawned: 0, waits: 0, deadEnds: 0 };
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

  // ---------- percurso: rua atual (+ a próxima já escolhida perto do fim) ----------
  const alive = r => roads().includes(r);
  // pontos da faixa à frente do índice atual, emendando na próxima rua quando chega no fim
  function* ahead(u) {
    let r = u.road, i = u.i, dir = u.dir;
    for (let n = 0; n < 400; n++) {
      yield lanePoint(r, i, dir, W());
      const ni = i + dir;
      if (ni < 0 || ni >= r.pts.length) { const nx = u.next; if (!nx || r !== u.road) return; r = nx.road; i = nx.i; dir = nx.dir; continue; }
      i = ni;
    }
  }
  function target(u, look) {
    let px = u.x, py = u.y, last = null;
    for (const q of ahead(u)) { last = q; if (Math.hypot(q[0] - px, q[1] - py) >= look && ((q[0] - u.x) * Math.cos(u.a) + (q[1] - u.y) * Math.sin(u.a)) > 0) return q; }
    return last;
  }
  // avança o índice na rua conforme o carro anda; no fim, passa p/ a próxima
  function advance(u) {
    const r = u.road;
    for (let n = 0; n < 40; n++) {
      const ni = u.i + u.dir;
      if (ni < 0 || ni >= r.pts.length) break;
      const a = lanePoint(r, u.i, u.dir, W()), b = lanePoint(r, ni, u.dir, W());
      if ((u.x - a[0]) * (b[0] - a[0]) + (u.y - a[1]) * (b[1] - a[1]) < 0) break;   // ainda antes do próximo ponto
      u.i = ni;
    }
    const left = u.dir > 0 ? r.pts.length - 1 - u.i : u.i;
    if (left < 40 && !u.next) { u.next = continuation(roads(), r, u.dir > 0 ? r.pts.length - 1 : 0, u.dir); if (!u.next) u.deadEnd = true; }   // ~20 m antes: escolhe
    // troca de rua ao chegar perto do fim desta OU da entrada da próxima (na curva o carro não passa do último ponto)
    if (u.next) {
      const nx = u.next, e = lanePoint(r, u.dir > 0 ? r.pts.length - 1 : 0, u.dir, W()), s = lanePoint(nx.road, nx.i, nx.dir, W());
      if (left <= 1 || Math.hypot(e[0] - u.x, e[1] - u.y) < 3.5 || Math.hypot(s[0] - u.x, s[1] - u.y) < 3.5) { u.road = nx.road; u.i = nx.i; u.dir = nx.dir; u.next = null; u.deadEnd = false; u.cls = nx.road.cls; }
    }
  }

  // ---------- nasce / some ----------
  const collisionOpts = u => ({ houses: bridge.houses, boxes: bridge.boxes, query: bridge.collQuery, mapSize: bridge.mapSize, ignoreAI: u.box });
  function make(m, road, i, dir) {
    const [x, y] = lanePoint(road, i, dir, W()), p = road.pts[i];
    const u = { id: ++uid, x, y, a: Math.atan2(p.ty * dir, p.tx * dir), speed: 0, length: m?.cfg.length || 4.5, width: Math.max(1.7, Math.min(2.1, m?.width || 1.9)), road, i, dir, next: null, wait: 0, t: 0, dead: false, cls: road.cls, why: '' };
    u.root = new THREE.Group(); if (m) u.root.add(m.tpl.clone(true)); scene.add(u.root);
    u.box = { x, y, a: u.a, hl: u.length / 2, hw: u.width / 2, unit: u, traffic: true }; world.aiCars.push(u.box);
    cars.push(u); place(u); return u;
  }
  function spawn() {
    const p = bridge.player, tpl = readyModels(); if (!tpl.length) { MODELS.forEach(model); return; }
    const list = roads().filter(r => r.pts?.length > 60 && r.cls !== 'highway');
    for (let k = 0; k < 10 && list.length; k++) {
      const road = list[(Math.random() * list.length) | 0], i = 20 + ((Math.random() * (road.pts.length - 40)) | 0), dir = Math.random() < .5 ? 1 : -1;
      const [x, y] = lanePoint(road, i, dir, W()), d = Math.hypot(x - p.x, y - p.y);
      if (d < 60 || d > 130) continue;   // fora da vista, mas perto o bastante p/ passar por ele
      if (cars.some(c => Math.hypot(c.x - x, c.y - y) < 22) || world.aiCars.some(b => Math.hypot(b.x - x, b.y - y) < 15)) continue;
      if (bridge.roadDist?.(x, y) > W()) continue;
      const m = tpl[(Math.random() * tpl.length) | 0], a = Math.atan2(road.pts[i].ty * dir, road.pts[i].tx * dir);
      if (carCollision(world, { x, y, angle: a, length: m.cfg.length, width: 1.9 }, collisionOpts({ box: null }))) continue;
      const u = make(m, road, i, dir); u.speed = Math.min(7, LIMIT[road.cls] || 9); state.spawned++; return u;
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
    if ((parkedT -= 1 / 30) <= 0) { parkedT = 1; const p = bridge.player; parked = (bridge.boxes || []).filter(b => (b.kind === 'parkedcar' || b.kind === 'vehicle') && b.solid !== false && Math.abs(b.x - p.x) < 200 && Math.abs(b.y - p.y) < 200).map(b => ({ x: b.x, y: b.y, rot: b.rot || 0, half: b.d / 2, len: b.w / 2, speed: 0, parked: true })); }
    return list;
  }
  // carro estacionado encostando na faixa: o para-choque anda pela faixa e vê se entra nele
  function parkedOnPath(u, reach) {
    const near = parked.filter(b => Math.abs(b.x - u.x) < reach + 8 && Math.abs(b.y - u.y) < reach + 8); if (!near.length) return null;
    let s = 0, px = u.x, py = u.y;
    for (const q of ahead(u)) {
      s += Math.hypot(q[0] - px, q[1] - py); px = q[0]; py = q[1];
      if (s < u.length / 2) continue; if (s > u.length / 2 + reach) break;
      for (const b of near) { const c = Math.cos(b.rot), sn = Math.sin(b.rot), dx = px - b.x, dy = py - b.y;
        if (Math.abs(dx * c + dy * sn) < b.len + .25 && Math.abs(-dx * sn + dy * c) < b.half + u.width / 2 + .05) return { gap: s - u.length / 2, o: b }; }
    }
    return null;
  }
  function drive(u, dt, obs, phase) {
    u.t += dt; u.why = '';
    if (!alive(u.road)) { u.lost = true; return; }   // setor da rua descarregou
    advance(u);
    const [tx, ty] = target(u, 3 + u.speed * .45) || [u.x + Math.cos(u.a), u.y + Math.sin(u.a)];
    const da = angDiff(u.a, Math.atan2(ty - u.y, tx - u.x));
    let v = LIMIT[u.road.cls] || 9;
    // curva à frente (a próxima rua sai em outro ângulo): reduz antes
    if (u.next) { const p = u.next.road.pts[u.next.i], turn = Math.abs(angDiff(u.a, Math.atan2(p.ty * u.next.dir, p.tx * u.next.dir)));
      if (turn > .35) { const left = u.dir > 0 ? u.road.pts.length - 1 - u.i : u.i; v = Math.min(v, Math.max(4, 8 - turn * 3) + left * .5 * .35); } }
    if (Math.abs(da) > .5) v = Math.min(v, 4.5);
    // fim de rua sem continuação: para antes (some quando sair da vista)
    if (u.deadEnd) { const left = u.dir > 0 ? u.road.pts.length - 1 - u.i : u.i; v = Math.min(v, stopSpeed(left * .5 - 3)); if (v < .3) u.why = 'sem saida'; }
    // carro da frente / pedestre / estacionado encostando
    const reach = 8 + u.speed * 1.6;
    let { gap, o: lead } = leadAhead(u, obs, reach);
    const pb = parkedOnPath(u, reach); if (pb && (gap === null || pb.gap < gap)) { gap = pb.gap; lead = pb.o; }
    if (gap !== null) { v = Math.min(v, stopSpeed(gap - GAP)); if (v < .3) u.why = lead.person ? 'pedestre' : lead.parked ? 'estacionado' : lead.player ? 'jogador' : 'carro'; }
    // semáforo
    const sig = signalStop(u, world.trafficSignals, phase); if (sig !== null) { v = Math.min(v, stopSpeed(sig)); if (v < .3 && !u.why) u.why = 'semaforo'; }
    // cruzamento sem semáforo à frente: um por vez
    for (const J of junctionList()) {
      if (J.signal) continue;
      const dx = J.x - u.x, dy = J.y - u.y, d = Math.hypot(dx, dy); if (d > 28) continue;
      const along = dx * Math.cos(u.a) + dy * Math.sin(u.a), lat = Math.abs(-dx * Math.sin(u.a) + dy * Math.cos(u.a));
      if (along < -2) { if (owners.get(J.key) === u && d > JUNCTION_R + 2) owners.delete(J.key); continue; }
      if (lat > 9) continue;
      const stop = junctionStop(u, J, owners, obs.filter(o => !o.person && o.ref !== u));
      if (stop !== null) { v = Math.min(v, stopSpeed(stop)); state.waits++; if (v < .3 && !u.why) u.why = 'cruzamento'; }
      break;
    }
    u.speed += Math.max(-DEC * 1.6 * dt, Math.min(ACC * dt, v - u.speed));
    if (u.speed < .02 && v < .05) u.speed = 0;
    const yaw = Math.max(-1.4, Math.min(1.4, da * 2.6)) * Math.min(1, u.speed / 2.5);
    const na = u.a + yaw * dt, nx = u.x + Math.cos(na) * u.speed * dt, ny = u.y + Math.sin(na) * u.speed * dt;
    if (u.speed > .01 && carCollision(world, { x: nx, y: ny, angle: na, length: u.length, width: u.width }, collisionOpts(u))) { u.speed = 0; u.wait += dt; u.why = 'colisao'; }
    else { u.x = nx; u.y = ny; u.a = na; if (u.speed > .3) u.wait = 0; else u.wait += dt; }
  }
  function update(dt) {
    const p = bridge.player, phase = typeof bridge.trafficPhase === 'function' ? bridge.trafficPhase(bridge.gameTime || 0) : {};
    const want = Math.round(max() * (world.night ? .6 : 1));
    spawnT -= dt; if (spawnT <= 0 && cars.length < want) { spawnT = 1.5; spawn(); }
    const obs = obstacles();
    for (const u of [...cars]) {
      const d = Math.hypot(u.x - p.x, u.y - p.y);
      // longe demais, sobrando, rua descarregada, ou parado sem motivo de trânsito fora da vista: some (outro nasce)
      if (u.lost || d > 190 || cars.length > want && d > 110 || (u.wait > 12 && /sem saida|colisao|estacionado/.test(u.why) || u.wait > 45) && d > 40) { remove(u); continue; }
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
  // carro numa rua dada (testes e depuração): sem modelo, só a lógica
  const add = ({ road, i, dir = 1 }) => make(null, road, i, dir);
  return { cars, state, update, remove, carNear, spawn, add };
}
