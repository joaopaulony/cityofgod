// ai-vehicles.mjs — viaturas (SUV de patrulha GLB) e ambulâncias (modelo procedural) dirigidas pela IA. Rota pelas
// ruas (A* do CityRoadRouting) na faixa da direita; reduz nas curvas, freia diante de gente/carro, dá ré quando
// enrosca e, na reta final, vai direto ao alvo (fora da rua, se preciso). Giroflex piscando e sirene (WebAudio) que
// some com a distância. Colide com o mundo como o carro do jogador (vehicle-collision.mjs) e entra em world.aiCars
// (o jogador a pé e o carro dele batem nela). Quem decide aonde ir e quem desembarca é character-webgl.mjs.
import {loadVehicleGLB} from './vehicle-asset-cache.mjs';
import {VEHICLE_MODELS} from './vehicle-catalog.mjs';
import {createVehicleLights} from './vehicle-lights.mjs';
import {carCollision} from './vehicle-collision.mjs';

const LANE = 1.7;
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const SPEC = { police: { length: 4.85, width: 2.1, maxSp: 19 }, ambulance: { length: 6.2, width: 2.3, maxSp: 18 } };

export function createAIVehicles(THREE, scene, bridge, { people = () => [] } = {}) {
  const units = [], state = { units: 0, police: 0, ambulance: 0, routes: 0, failed: 0 };
  const world = bridge.world; world.aiCars = world.aiCars || [];
  let graph = null, graphSrc = null, police = null, uid = 0, audio = null;

  // ---------- rede de ruas ----------
  const roadSource = () => (typeof OW !== 'undefined' && OW.cw?.roads?.length) ? OW.cw.roads : (bridge.roads || []);
  function network() {
    const s = roadSource(); if (graph && s === graphSrc) return graph;
    if (!window.CityRoadRouting || !s.length) return null;
    graphSrc = s; graph = window.CityRoadRouting.build(s, 1); return graph;
  }
  // ponto na rua mais perto de (x,y), com a direção da via
  function roadPoint(x, y, maxD = 60) {
    const q = network()?.nearest(x, y); if (!q || q.d > maxD) return null;
    return { x: q.x, y: q.y, a: Math.atan2(q.seg.b[1] - q.seg.a[1], q.seg.b[0] - q.seg.a[0]) };
  }
  // rota deslocada p/ a faixa da direita
  function plan(u, tx, ty) {
    const r = network()?.route({ x: u.x, y: u.y }, { x: tx, y: ty }); state.routes++;
    if (!r || r.points.length < 2) { u.path = null; return; }
    const P = r.points, out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const fx = (b[0] - a[0]) / l, fy = (b[1] - a[1]) / l, off = i === 0 || i === P.length - 1 ? 0 : LANE;
      out.push([P[i][0] - fy * off, P[i][1] + fx * off]);
    }
    u.path = out; u.wi = 1; u.planned = { x: tx, y: ty };
  }

  // ---------- modelos ----------
  function normalize(root, cfg) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), dim = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const pos = new THREE.Group(); pos.position.set(-c.x, -box.min.y, -c.z); pos.add(root);
    const s = cfg.length / Math.max(dim.x, dim.z), sc = new THREE.Group(); sc.scale.setScalar(s); sc.add(pos);
    const al = new THREE.Group(); al.rotation.y = cfg.front === '+Z' ? Math.PI / 2 : -Math.PI / 2; al.add(sc);   // frente → +X
    root.traverse(o => {
      if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
      for (const m of [].concat(o.material)) if (m && 'metalness' in m) { m.metalness = Math.min(m.metalness, .25); m.metalnessMap = null; m.roughness = Math.min(Math.max(m.roughness, .35), .6); }
    });
    return { tpl: al, cfg, width: Math.min(dim.x, dim.z) * s, height: dim.y * s };
  }
  function policeModel() {
    if (!police) {
      const cfg = VEHICLE_MODELS.find(m => m.id === 'police-suv');
      police = cfg ? loadVehicleGLB(cfg).then(g => normalize(g.scene, cfg)) : Promise.reject(Error('police-suv ausente'));
      police.catch(() => { state.failed++; police = null; });
    }
    return police;
  }
  // ambulância (furgão branco com faixa vermelha, "AMBULÂNCIA · SAMU 192", estrela da vida e giroflex)
  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .5, metalness: .08, ...o });
  const shared = { white: M(0xf3f3ef, { roughness: .4 }), red: M(0xc81e28), glass: M(0x1a2630, { roughness: .12, metalness: .35 }), dark: M(0x1b1c1e, { roughness: .85 }), chrome: M(0xc9cdd1, { metalness: .6, roughness: .3 }), orange: M(0xf08a1c) };
  function decal(flip) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
    if (flip) { g.translate(512, 0); g.scale(-1, 1); }
    g.fillStyle = '#c81e28'; g.font = '900 64px "Arial Black",Arial,sans-serif'; g.textBaseline = 'middle'; g.fillText('AMBULÂNCIA', 130, 58);
    g.fillStyle = '#1d4f9c'; g.font = '800 40px Arial,sans-serif'; g.fillText('SAMU 192', 132, 122);
    // estrela da vida
    g.save(); g.translate(62, 80); g.fillStyle = '#1d4f9c';
    for (let i = 0; i < 3; i++) { g.rotate(Math.PI / 3); g.fillRect(-15, -56, 30, 112); }
    g.fillStyle = '#fff'; g.fillRect(-3, -40, 6, 80); g.beginPath(); g.arc(0, -40, 7, 0, TAU); g.fill(); g.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const decals = { L: null, R: null };
  function buildAmbulance() {
    const g = new THREE.Group(), add = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
    add(6.0, .3, 2.1, shared.dark, 0, .5, 0);                                    // chassi
    add(4.0, 2.2, 2.3, shared.white, -1.0, 1.72, 0);                             // baú
    add(2.05, .95, 2.2, shared.white, 2.02, 1.12, 0);                             // capô/cabine baixa
    add(1.25, 1.0, 2.2, shared.white, 1.62, 2.07, 0);                             // cabine alta
    const ws = add(.06, 1.0, 2.0, shared.glass, 2.35, 2.0, 0); ws.rotation.z = -.42;   // para-brisa inclinado
    add(.9, .55, 2.22, shared.glass, 1.62, 2.1, 0);                               // janelas das portas
    add(4.02, .3, 2.32, shared.red, -1.0, 1.25, 0); add(2.07, .3, 2.22, shared.red, 2.02, 1.25, 0);   // faixa
    add(4.02, .1, 2.32, shared.red, -1.0, 2.62, 0);
    add(.04, .6, .8, shared.glass, -3.01, 2.05, -.5); add(.04, .6, .8, shared.glass, -3.01, 2.05, .5);  // traseira
    add(.05, 2.0, .04, shared.dark, -3.02, 1.72, 0);
    add(.08, .35, 1.6, shared.dark, 3.06, .9, 0);                                  // grade
    add(.2, .25, 2.2, shared.chrome, 3.1, .62, 0);                                 // para-choque
    for (const z of [-.8, .8]) add(.05, .18, .38, M(0xfff3cf, { emissive: 0xfff3cf, emissiveIntensity: .6 }), 3.06, 1.12, z);
    for (const z of [-1.0, 1.0]) add(.05, .28, .22, M(0x8e1414, { emissive: 0x6a0c0c, emissiveIntensity: .6 }), -3.03, 1.0, z);
    for (const [x, z] of [[2.0, -1.0], [2.0, 1.0], [-1.9, -1.0], [-1.9, 1.0]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .3, 18), shared.dark); w.rotation.x = Math.PI / 2; w.position.set(x, .42, z); w.castShadow = true; g.add(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .32, 12), shared.chrome); hub.rotation.x = Math.PI / 2; hub.position.copy(w.position); g.add(hub);
    }
    if (!decals.L) { decals.L = decal(false); decals.R = decal(true); }
    for (const [z, t] of [[1.156, decals.L], [-1.156, decals.R]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.06), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .5 }));
      p.position.set(-1.05, 1.95, z); if (z < 0) p.rotation.y = Math.PI; g.add(p);
    }
    // giroflex: barra vermelha/azul na frente do baú e luzes nos cantos de trás (material próprio p/ piscar)
    const beacon = [];
    for (const [x, y, z, col] of [[.95, 2.86, -.55, 0xff2020], [.95, 2.86, .55, 0x2a6dff], [-2.95, 2.75, -1.05, 0xff2020], [-2.95, 2.75, 1.05, 0xff2020]]) {
      const m = M(col, { emissive: col, emissiveIntensity: 0 }), b = add(x > 0 ? .3 : .12, .14, x > 0 ? .5 : .12, m, x, y, z); beacon.push({ m, col });
    }
    add(.36, .06, 1.7, shared.dark, .95, 2.78, 0);
    return { group: g, beacon, width: 2.3, height: 2.9 };
  }

  // ---------- sirene ----------
  function siren(u, on, dist) {
    const vol = window.CityFront?.effectsVolume ?? 1;
    if (!on || vol <= 0 || dist > 140) { if (u.snd) { u.snd.g.gain.value = 0; } return; }
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      if (!u.snd) {
        const o = audio.createOscillator(), g = audio.createGain(), lfo = audio.createOscillator(), depth = audio.createGain();
        o.type = 'square'; o.frequency.value = u.kind === 'police' ? 900 : 760; lfo.type = u.kind === 'police' ? 'triangle' : 'square';
        lfo.frequency.value = u.kind === 'police' ? .45 : 1.1; depth.gain.value = u.kind === 'police' ? 320 : 140;
        lfo.connect(depth); depth.connect(o.frequency); o.connect(g); g.connect(audio.destination); g.gain.value = 0; o.start(); lfo.start();
        u.snd = { o, g, lfo };
      }
      u.snd.g.gain.value = .022 * vol * Math.max(0, 1 - dist / 140) ** 2;
    } catch (_) { /* sem áudio: segue sem sirene */ }
  }

  // ---------- unidades ----------
  async function spawn(kind, x, y, a) {
    const S = SPEC[kind], u = { id: ++uid, kind, x, y, a, speed: 0, path: null, wi: 0, goal: null, arrive: 6, direct: false, stuck: 0, reverseT: 0, noProgress: 0,
      siren: true, length: S.length, width: S.width, maxSp: S.maxSp, crew: [], seats: kind === 'police' ? 2 : 2, t: 0, ready: false, dead: false };
    let body;
    if (kind === 'police') {
      try { const m = await policeModel(); body = m.tpl.clone(true); u.width = m.width || S.width; u.lights = createVehicleLights(THREE, body, m.cfg, { width: u.width, height: m.height, root: body, parked: true }); }
      catch (e) { state.failed++; return null; }
    } else { const m = buildAmbulance(); body = m.group; u.beacon = m.beacon; }
    if (u.dead) return null;
    u.root = new THREE.Group(); u.root.add(body); scene.add(u.root);
    u.box = { x, y, a, hl: u.length / 2, hw: u.width / 2, unit: u }; world.aiCars.push(u.box);
    u.ready = true; units.push(u); place(u); return u;
  }
  function remove(u) {
    u.dead = true; const i = units.indexOf(u); if (i >= 0) units.splice(i, 1);
    const j = world.aiCars.indexOf(u.box); if (j >= 0) world.aiCars.splice(j, 1);
    if (u.root) { scene.remove(u.root); u.root.traverse(o => { if (o.isMesh && o.geometry && u.kind === 'ambulance') o.geometry.dispose(); }); }
    if (u.snd) { try { u.snd.o.stop(); u.snd.lfo.stop(); u.snd.g.disconnect(); } catch (_) {} }
  }
  function place(u) {
    u.root.position.set(u.x, 0, u.y); u.root.rotation.y = -u.a;
    u.box.x = u.x; u.box.y = u.y; u.box.a = u.a;
  }
  const collisionOpts = u => ({ houses: bridge.houses, boxes: bridge.boxes, mapSize: bridge.mapSize, isWater: (x, y) => bridge.pondVal(x, y) < 1.03, ignoreAI: u.box });
  function free(u, x, y, a) {
    if (carCollision(world, { x, y, angle: a, length: u.length, width: u.width }, collisionOpts(u))) return false;
    const V = window.cityVehicles, c = V?.driver ? V.car : null;   // carro do jogador em movimento (parado vira caixa)
    if (c && Math.hypot(c.x - x, c.y - y) < (u.length + (V.carLength || 4.6)) / 2 - .3) {
      const ca = Math.cos(a), sa = Math.sin(a), lx = (c.x - x) * ca + (c.y - y) * sa, ly = -(c.x - x) * sa + (c.y - y) * ca;
      if (Math.abs(lx) < u.length / 2 + 1.6 && Math.abs(ly) < u.width / 2 + .95) return false;
    }
    return true;
  }
  // alguém (ou outra unidade) logo à frente: freia
  function blockedAhead(u, carsOnly = false) {
    const ca = Math.cos(u.a), sa = Math.sin(u.a), reach = 2.2 + Math.abs(u.speed) * .45, dir = Math.sign(u.speed || 1);
    const test = (x, y, w) => { const dx = x - u.x, dy = y - u.y, lx = (dx * ca + dy * sa) * dir, ly = Math.abs(-dx * sa + dy * ca); return lx > u.length / 2 - .2 && lx < u.length / 2 + reach && ly < u.width / 2 + w; };
    if (!carsOnly) for (const p of people()) if (test(p.x, p.y, .45)) return true;
    for (const o of units) if (o !== u && test(o.x, o.y, o.width / 2)) return true;
    return false;
  }
  function steer(u, dt, tx, ty, maxSp, arrive) {
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy), da = angDiff(u.a, Math.atan2(dy, dx));
    let v = d < arrive ? 0 : Math.min(maxSp, 2.5 + (d - arrive) * .9);
    if (Math.abs(da) > 1.1) v = Math.min(v, 4); else if (Math.abs(da) > .45) v = Math.min(v, 8);
    if (u.slowFor) v = Math.min(v, u.slowFor);
    // gente/carro na frente: espera; com sirene, depois de 1,2 s passa devagar (pedestre sai da frente)
    if (v > 0 && blockedAhead(u, u.siren && u.blockT > 1.2)) { u.blockT = (u.blockT || 0) + dt; v = u.siren && u.blockT > 1.2 ? Math.min(v, 2) : 0; } else u.blockT = 0;
    if (u.reverseT > 0) { u.reverseT -= dt; v = -3.2; }
    const acc = Math.abs(v) > Math.abs(u.speed) ? 6.5 : 13; u.speed += Math.max(-acc * dt, Math.min(acc * dt, v - u.speed));
    // carro não gira parado; de ré o volante inverte
    const yaw = Math.max(-1, Math.min(1, da * 1.9)) * Math.min(1.35, Math.abs(u.speed) / 3.2) * (u.speed < 0 ? -1 : 1) * (u.reverseT > 0 ? -1 : 1);
    const na = u.a + yaw * dt * 1.3, nx = u.x + Math.cos(na) * u.speed * dt, ny = u.y + Math.sin(na) * u.speed * dt;
    if (Math.abs(u.speed) < .01 || free(u, nx, ny, na)) { u.x = nx; u.y = ny; u.a = na; if (Math.abs(u.speed) > .5) u.stuck = Math.max(0, u.stuck - dt); }
    else { u.speed *= -.15; u.stuck += dt; if (u.stuck > .45 && u.reverseT <= 0) { u.reverseT = 1.1; u.stuck = 0; } }
    return d;
  }
  // segue a rota; na reta final (ou sem rota) vai direto ao alvo
  function drive(u, dt) {
    const g = u.goal; if (!g) { u.speed *= Math.exp(-dt * 3); return; }
    const d = Math.hypot(g.x - u.x, g.y - u.y);
    u.replan = (u.replan || 0) - dt;
    if (!u.direct && d > 30 && (!u.path || u.replan <= 0 && Math.hypot(g.x - (u.planned?.x ?? 1e9), g.y - (u.planned?.y ?? 1e9)) > 12)) { plan(u, g.x, g.y); u.replan = 2.5; }
    if (u.direct || !u.path || d < 30) { steer(u, dt, g.x, g.y, u.maxSp, u.arrive); return; }
    const P = u.path;
    while (u.wi < P.length - 1 && Math.hypot(P[u.wi][0] - u.x, P[u.wi][1] - u.y) < 5) u.wi++;
    const w = P[u.wi], last = u.wi >= P.length - 1;
    // curva à frente: reduz antes
    u.slowFor = 0;
    if (!last) { const n = P[u.wi + 1], a1 = Math.atan2(w[1] - u.y, w[0] - u.x), a2 = Math.atan2(n[1] - w[1], n[0] - w[0]), turn = Math.abs(angDiff(a1, a2)), dw = Math.hypot(w[0] - u.x, w[1] - u.y);
      if (turn > .6 && dw < 14) u.slowFor = Math.max(5, 14 - turn * 7); }
    steer(u, dt, w[0], w[1], u.maxSp, last ? u.arrive : 0);
    if (last) u.path = null;
  }
  function update(dt, time = performance.now() / 1000) {
    const p = bridge.player, night = !!world.night;
    for (const u of [...units]) {
      if (!u.ready) continue;
      u.t += dt;
      drive(u, dt);
      // enroscado (vai e volta sem chegar mais perto do destino) e longe da vista: pula p/ o próximo ponto da rota
      const gd = u.goal ? Math.hypot(u.goal.x - u.x, u.goal.y - u.y) : 0;
      if (!u.goal || gd <= u.arrive + 2 || gd < (u.bestGoal ?? 1e9) - 1 || u.goal !== u.lastGoal && Math.hypot(u.goal.x - (u.lastGoal?.x ?? 1e9), u.goal.y - (u.lastGoal?.y ?? 1e9)) > 8) { u.bestGoal = gd; u.noProgress = 0; u.lastGoal = u.goal; }
      else u.noProgress += dt;
      if (u.noProgress > 6 && Math.hypot(u.x - p.x, u.y - p.y) > 45) {
        const w = u.path?.[Math.min(u.wi + 1, u.path.length - 1)], q = w ? { x: w[0], y: w[1] } : roadPoint(u.goal.x, u.goal.y);
        if (q && free(u, q.x, q.y, u.a)) { u.x = q.x; u.y = q.y; if (w) u.wi = Math.min(u.wi + 1, u.path.length - 1); } u.noProgress = 0; u.bestGoal = 1e9;
      }
      place(u);
      const flash = Math.floor(time * 6 + u.id) % 2 === 0;
      if (u.lights) u.lights.apply({ emergencyLights: u.siren, headlights: night, braking: u.speed > .5 && u.slowFor }, time);
      if (u.beacon) for (const [i, b] of u.beacon.entries()) b.m.emissiveIntensity = u.siren && (i % 2 === 0) === flash ? 3 : 0;
      siren(u, u.siren && Math.abs(u.speed) > 1, Math.hypot(u.x - p.x, u.y - p.y));
    }
    state.units = units.length; state.police = units.filter(u => u.kind === 'police').length; state.ambulance = units.filter(u => u.kind === 'ambulance').length;
  }
  // porta (lado do motorista/passageiro) p/ quem desce: ao lado da cabine, fora da carroceria
  function door(u, i) {
    const side = i % 2 ? 1 : -1, back = u.kind === 'ambulance' ? (i < 2 ? -u.length / 2 - .9 : .4) : .35, ca = Math.cos(u.a), sa = Math.sin(u.a);
    if (u.kind === 'ambulance' && i < 2) return { x: u.x + ca * back - sa * side * .6, y: u.y + sa * back + ca * side * .6 };   // portas de trás
    const off = u.width / 2 + .7; return { x: u.x + ca * back - sa * side * off, y: u.y + sa * back + ca * side * off };
  }
  return { state, units, spawn, remove, update, roadPoint, network, door };
}
