// drive-pilot.mjs — piloto automático do carro do jogador até o destino do GPS, obedecendo às regras de trânsito:
// · rota sem meia-volta a partir da direção do carro (routeDirected), sempre na faixa da direita do sentido;
// · limite de velocidade da via (rua 32, avenida 45, rodovia 65 km/h) e freia antes das curvas;
// · para no sinal vermelho (e no amarelo quando dá), um veículo por vez nos cruzamentos sem semáforo (preferência de
//   quem chegou antes), distância do carro da frente, para para pedestre na frente e não avança sobre a faixa;
// · chega devagar e estaciona no destino; qualquer tecla de dirigir (WASD/espaço) devolve o controle.
// Mesmas regras do trânsito de IA e dos ônibus (ai-traffic.mjs).
import { LIMIT, DEC, JUNCTION_R, laneOffset, stopSpeed, leadAhead, signalStop, junctionStop } from './ai-traffic.mjs';
import { steerLimit } from './vehicle-physics.mjs';

const gv = n => { try { return (0, eval)(n); } catch (_) { return undefined; } };
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// ---------- planejamento (puro, testável) ----------
// rota (eixo das ruas) → faixa da direita, ponto a ponto, com o limite da via; laneOf(x,y) → { off, cls }
export function planLane(points, laneOf, step = 2) {
  const axis = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < .01) continue;
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) axis.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  const out = [];
  for (let i = 0; i < axis.length; i++) {
    const p = axis[Math.max(0, i - 2)], q = axis[Math.min(axis.length - 1, i + 2)], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const tx = (q[0] - p[0]) / l, ty = (q[1] - p[1]) / l, L = laneOf(axis[i][0], axis[i][1]);
    // direita do sentido (y para baixo): (−ty, tx)
    out.push({ x: axis[i][0] - ty * L.off, y: axis[i][1] + tx * L.off, cls: L.cls, s: 0 });
  }
  for (let i = 1; i < out.length; i++) out[i].s = out[i - 1].s + Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
  return out;
}
// velocidade alvo pela curvatura: em cada ponto dos próximos ~45 m, a velocidade segura na curva (aceleração lateral
// ~2,6 m/s²) e o quanto dá para frear até lá (3 m/s²) — reduz só o necessário, perto da curva, e não 20 m antes
export function curveSpeed(path, i, ahead = 45, aLat = 2.6, dec = 3) {
  let best = Infinity;
  const head = k => { const a = path[Math.max(0, k - 2)], b = path[Math.min(path.length - 1, k + 2)]; return Math.atan2(b.y - a.y, b.x - a.x); };
  for (let j = i + 1; j < path.length - 3 && path[j].s - path[i].s < ahead; j++) {
    const ds = path[Math.min(path.length - 1, j + 2)].s - path[Math.max(0, j - 2)].s; if (ds < .5) continue;
    const k = Math.abs(angDiff(head(j - 1), head(j + 1))) / Math.max(.5, path[j + 1].s - path[j - 1].s);   // curvatura (1/m)
    if (k < .012) continue;
    const vc = Math.max(3.6, Math.sqrt(aLat / k)), v = Math.sqrt(vc * vc + 2 * dec * (path[j].s - path[i].s));
    if (v < best) best = v;
  }
  return best;
}

// ---------- condução ----------
let job = null, hud = null, graph = null, graphSrc = null;
const owners = new Map();
function network() {
  const OW = gv('OW'), src = OW?.cw?.roads; if (!src || !window.CityRoadRouting) return null;
  if (graph && graphSrc === src) return graph; graphSrc = src; graph = window.CityRoadRouting.build(src, gv('world')?.seed); return graph;
}
function laneOf(net, roads) {
  return (x, y) => {
    const n = net.nearest(x, y), rd = roads[n?.seg?.roadId] || {};
    const off = laneOffset({ off: (rd.w || 7) / 2 - 3.5, park: rd.park || 0, lanes: rd.lanes || 1 });
    return { off, cls: rd.cls || n?.seg?.cls || 'street' };
  };
}
let jpts = null, jsrc = null;
function junctions() {
  const OW = gv('OW'), src = OW?.cw?.junctions || [], sig = gv('world')?.trafficSignals || [];
  if (src !== jsrc) { jsrc = src; jpts = src.map((j, i) => ({ x: j.x, y: j.y, key: 'pj' + i, signal: sig.some(s => Math.hypot(s.x - j.x, s.y - j.y) < 24) })); }
  return jpts;
}
function obstacles(car) {
  const list = [], world = gv('world'), me = window.cityVehicles?.car;
  for (const o of world?.aiCars || []) list.push({ x: o.x, y: o.y, half: o.hw, len: o.hl, speed: o.unit?.speed || 0 });
  for (const n of window.cityCharacters?.npcList?.() || []) if (!n.dead && Math.hypot(n.x - car.x, n.y - car.y) < 40) list.push({ x: n.x, y: n.y, half: .35, len: .3, person: true });
  for (const u of window.cityAIVehicles?.units || []) list.push({ x: u.x, y: u.y, half: (u.width || 2) / 2, len: (u.length || 5) / 2, speed: u.speed || 0 });
  return list.filter(o => o.x !== me?.x || o.y !== me?.y);
}
function plan(car, target) {
  const net = network(); if (!net) return null;
  const OW = gv('OW'), roads = OW.cw.roads;
  const r = net.routeDirected({ x: car.x, y: car.y }, target, [Math.cos(car.angle), Math.sin(car.angle)]) || net.route({ x: car.x, y: car.y }, target);
  if (!r || r.points.length < 2) return null;
  const path = planLane(r.points, laneOf(net, roads));
  return path.length > 2 ? path : null;
}
export function go(target) {
  const V = window.cityVehicles;
  if (!V?.driver || !V.car) return { ok: false, text: 'Entre num carro para usar o piloto automático.' };
  if (!V.engineOn) return { ok: false, text: 'Ligue o motor (X) para o piloto automático dirigir.' };
  const path = plan(V.car, target);
  if (!path) return { ok: false, text: 'Não encontrei um caminho pelas ruas até ' + (target.name || 'o destino') + '.' };
  job = { target, path, i: 0, why: '', stuck: 0, start: performance.now() };
  showHud(); return { ok: true, text: 'Piloto automático: dirigindo até ' + (target.name || 'o destino') + ' respeitando o trânsito.' };
}
export function cancel(reason = 'Você assumiu o volante.') {
  if (!job) return; job = null; hideHud();
  for (const [k, v] of owners) if (v?.pilot) owners.delete(k);
  if (reason) window.CityUI?.notify?.('Piloto automático desligado. ' + reason);
}
// chamado por moveCar (vehicle-webgl.mjs) a cada quadro: devolve os comandos analógicos (ou null)
export function controls(car, spec, dt) {
  if (!job) return null;
  const V = window.cityVehicles;
  if (!V?.driver) { cancel(''); return null; }
  const path = job.path;
  // avança o índice pelo ponto mais próximo à frente (janela curta: não pula para outro trecho que passa perto)
  let bi = job.i, bd = Infinity;
  for (let k = job.i; k < Math.min(path.length, job.i + 40); k++) { const d = Math.hypot(path[k].x - car.x, path[k].y - car.y); if (d < bd) { bd = d; bi = k; } }
  job.i = bi;
  // longe da faixa (manobra de retorno numa rua sem saída, empurrado, batida): recalcula no máximo a cada 2 s e,
  // enquanto isso, volta devagar para a rota
  const rejoin = bd > 9;
  if (rejoin && performance.now() - (job.replanAt || 0) > 2000) { job.replanAt = performance.now(); const np = plan(car, job.target); if (np) { job.path = np; job.i = 0; return { throttle: 0, brakePedal: .2, steerAxis: 0 }; } }
  const v = Math.max(0, car.speed), rem = path[path.length - 1].s - path[bi].s;
  // perseguição pura: ponto à frente na faixa
  const look = Math.max(5.5, Math.min(20, 4.5 + v * .85));
  let ti = bi; while (ti < path.length - 1 && path[ti].s - path[bi].s < look) ti++;
  const tp = path[ti], alpha = angDiff(car.angle, Math.atan2(tp.y - car.y, tp.x - car.x)), Ld = Math.max(2, Math.hypot(tp.x - car.x, tp.y - car.y));
  const steerAng = Math.atan(2 * (spec.wheelbase || 2.52) * Math.sin(alpha) / Ld), steerAxis = steerAng / Math.max(.05, steerLimit(car.speed, spec));
  // velocidade alvo: limite da via, curva, semáforo, cruzamento, carro/pedestre na frente, chegada
  let target = rejoin ? 3 : LIMIT[path[bi].cls] || LIMIT.street, why = rejoin ? 'manobra' : '';
  const cs = curveSpeed(path, bi); if (cs < target) { target = cs; why = 'curva'; }
  // o mesmo objeto a viagem toda: é ele que fica com a vez nos cruzamentos sem semáforo
  const me = job.me || (job.me = { pilot: true });
  Object.assign(me, { x: car.x, y: car.y, a: car.angle, speed: v, length: spec.length || 4.5, width: spec.width || 1.9, wait: job.stuck });
  const br = window.cityVehicleBridge, phase = typeof br?.trafficPhase === 'function' ? br.trafficPhase(br.gameTime || 0) : {};
  const sg = signalStop(me, gv('world')?.trafficSignals, phase); if (sg !== null && stopSpeed(sg - .5) < target) { target = stopSpeed(sg - .5); why = 'sinal vermelho'; }
  const obs = obstacles(car);
  const lead = leadAhead(me, obs, 12 + v * 1.6);
  if (lead.gap !== null) { const sv = stopSpeed(lead.gap - (lead.o?.person ? 3 : 2.5)); if (sv < target) { target = sv; why = lead.o?.person ? 'pedestre' : 'carro à frente'; } }
  for (const J of junctions()) {
    const dx = J.x - car.x, dy = J.y - car.y, dj = Math.hypot(dx, dy); if (dj > 34) continue;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle), lat = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along < -2) { if (owners.get(J.key) === me && dj > JUNCTION_R + 3) owners.delete(J.key); continue; }
    if (lat > 10 || J.signal) continue;
    const st = junctionStop(me, J, owners, obs.filter(o => !o.person)); if (st !== null && stopSpeed(st) < target) { target = stopSpeed(st); why = 'preferencial'; }
    break;
  }
  const arrive = stopSpeed(Math.max(0, rem - 1.5)); if (arrive < target) { target = arrive; if (rem < 25) why = 'chegando'; }
  // chegou: para e entrega o controle
  if ((rem < 2.5 || why === 'carro à frente' && rem < 15) && v < .6) { const t = job.target; cancel(''); window.CityUI?.notify?.('Você chegou: ' + (t.name || 'destino') + '.'); window.CityGPS?.clear?.(true); return { throttle: 0, brakePedal: 1, steerAxis: 0 }; }
  // manobra de ré (balão de três pontos): dá ré com o volante para o outro lado e tenta de novo
  if (job.back > 0) { job.back -= dt; return { throttle: 0, brakePedal: 0, reverse: true, steerAxis: job.backSteer }; }
  // acelerando e o carro não sai do lugar (meio-fio, muro, retorno numa rua sem saída): ré
  job.stuck = v < .3 && target > 2 ? job.stuck + dt : 0;
  if (job.stuck > 1.4) {
    job.backs = (job.backs || 0) + 1; job.stuck = 0;
    if (job.backs > 8) { cancel('Caminho bloqueado — tire o carro dali e chame de novo.'); return null; }
    job.back = 1.4; job.backSteer = -Math.sign(steerAxis || 1); why = 'manobra';
  }
  job.why = target < 1 ? why : (v > target + .8 ? why : '');
  const err = target - v;
  const out = err > 0 ? { throttle: Math.min(1, err * .45 + .08), brakePedal: 0 } : { throttle: 0, brakePedal: Math.min(1, -err * .35 + (target < .3 ? .5 : 0)) };
  out.steerAxis = Math.max(-1, Math.min(1, steerAxis));
  if (performance.now() - (job.hudAt || 0) > 400) updateHud(rem, v);
  return out;
}

// ---------- aviso na tela ----------
function showHud() {
  if (!hud) {
    const css = document.createElement('style'); css.textContent = `#city-drivepilot{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:42;display:flex;gap:10px;align-items:center;
 padding:8px 10px 8px 14px;border-radius:999px;background:rgba(255,255,255,.94);color:#1d2125;font:600 13px "Segoe UI",system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)}
#city-drivepilot[hidden]{display:none}#city-drivepilot small{color:#6b737a;font-weight:500}#city-drivepilot button{border:0;border-radius:999px;background:#1d2125;color:#fff;padding:6px 11px;font:inherit;cursor:pointer}`;
    document.head.append(css); hud = document.createElement('div'); hud.id = 'city-drivepilot'; hud.setAttribute('role', 'status');
    hud.innerHTML = '<span>🚗</span><span class="dp-text"></span><button type="button">Assumir</button>';
    hud.querySelector('button').addEventListener('click', () => cancel('')); document.body.append(hud);
  }
  hud.hidden = false; updateHud(job?.path?.at(-1)?.s || 0, 0);
}
function hideHud() { if (hud) hud.hidden = true; }
function updateHud(rem, v) {
  if (!hud || !job) return; job.hudAt = performance.now();
  const why = job.why ? ' · ' + ({ 'sinal vermelho': 'parado no sinal', pedestre: 'esperando o pedestre', 'carro à frente': 'atrás de outro carro', preferencial: 'aguardando a vez no cruzamento', curva: 'reduzindo para a curva', chegando: 'chegando', manobra: 'manobrando para voltar à rota' }[job.why] || job.why) : '';
  hud.querySelector('.dp-text').innerHTML = 'Piloto automático → <b>' + (job.target.name || 'destino') + '</b> <small>' + Math.round(rem) + ' m · ' + Math.round(v * 3.6) + ' km/h' + why + ' · WASD assume</small>';
}

const api = { go, cancel, controls, get active() { return !!job; }, get job() { return job; } };
window.CityDrivePilot = api;
export default api;
