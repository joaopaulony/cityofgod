// birds-3d.mjs — pássaros 3D: pombos nas calçadas e praças, gaivotas na areia. No chão ciscam (cabeça
// balançando), andam aos pulinhos e espiam; quando o jogador ou o carro chega perto levantam voo batendo as asas,
// circulam por um tempo (a gaivota plana) e pousam em outro ponto. Bandos passam voando alto. Fazem sombra.
// De noite dormem (somem), com vento forte voam menos e com neve ficam encolhidos.
import {makeKit} from './kit-3d.mjs';

export function createBirds(THREE, scene, bridge, opts = {}) {
  const Kit = makeKit(THREE), TAU = Math.PI * 2;
  const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(777);
  // ---------- modelos (frente +z, cima +y; a asa direita sai do ombro p/ +x) ----------
  const SP = {
    pigeon: { len: 1, body: '#8f949d', back: '#7c828c', head: '#5a616d', neck: '#4f8a78', tip: '#33363d', beak: '#2b2b2b', feet: '#c8655a', span: 0.3, flap: 13, glide: 0.15, speed: 6.5 },
    gull: { len: 1.45, body: '#f3f3f1', back: '#b7bec6', head: '#fbfbfa', neck: '#f3f3f1', tip: '#26272b', beak: '#e6b22a', feet: '#e09a5c', span: 0.62, flap: 6.5, glide: 0.6, speed: 7.5 },
  };
  const mats = { body: new THREE.MeshLambertMaterial({ vertexColors: true }), wing: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }) };
  const CAP = 70, kinds = {};
  for (const [name, s] of Object.entries(SP)) {
    const b = Kit();
    b.sph(0, 0.11, 0, 0.075, s.body, 0.75, undefined, 0.8, 1.35);            // corpo
    b.sph(0, 0.145, -0.01, 0.06, s.back, 0.45, undefined, 0.85, 1.25);        // dorso
    b.sph(0, 0.16, 0.085, 0.04, s.neck, 1.1);                                  // pescoço
    b.sph(0, 0.2, 0.105, 0.036, s.head);                                       // cabeça
    const beak = new THREE.ConeGeometry(0.012, 0.04, 6); beak.rotateX(Math.PI / 2); beak.translate(0, 0.195, 0.152); b.raw(beak, s.beak);
    for (const x of [-0.02, 0.02]) b.sph(x, 0.207, 0.12, 0.007, '#151515');     // olhos
    b.box(-0.035, 0.1, -0.16, 0.035, 0.115, -0.07, s.tip, 0.005);              // cauda
    for (const x of [-0.022, 0.022]) b.cyl(x, 0, 0.01, 0.005, 0.06, s.feet, 5); // pernas
    const w = Kit(), half = s.span / 0.3 * 0.15;
    // asa: plana, larga no ombro, afinando até a ponta escura
    const shape = new THREE.Shape(); shape.moveTo(0, 0.045); shape.lineTo(half * 0.55, 0.05); shape.lineTo(half, 0.0); shape.lineTo(half * 0.55, -0.05); shape.lineTo(0, -0.055); shape.closePath();
    const wg = new THREE.ShapeGeometry(shape); wg.rotateX(-Math.PI / 2); w.raw(wg, s.back);
    const tip = new THREE.ShapeGeometry((() => { const t = new THREE.Shape(); t.moveTo(half * 0.62, 0.047); t.lineTo(half, 0); t.lineTo(half * 0.62, -0.035); t.closePath(); return t; })()); tip.rotateX(-Math.PI / 2); tip.translate(0, 0.002, 0); w.raw(tip, s.tip);
    const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, CAP); m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m; };
    kinds[name] = { s, body: mk(b.done().body, mats.body), wingR: mk(w.done().body, mats.wing), wingL: mk(w.done().body, mats.wing) };
  }

  // ---------- onde pousam ----------
  const RW = bridge.ROAD_W || 3.5;
  function spotFor(name, x, y) {
    if (name === 'gull') { const pv = bridge.pondVal ? bridge.pondVal(x, y) : 2; return pv > 1.03 && pv < 1.6; }
    const rd = bridge.roadDist ? bridge.roadDist(x, y) : 99;
    if (rd > RW + 0.35 && rd < RW + 1.8) return true;                      // calçada
    const pv = bridge.pondVal ? bridge.pondVal(x, y) : 2; return rd > RW + 4 && pv > 1.7 && R() < 0.15; // gramado/praça (pouco)
  }
  const inside = (x, y) => (bridge.houses || []).some(H => x > H.x0 - 0.3 && x < H.x1 + 0.3 && y > H.y0 - 0.3 && y < H.y1 + 0.3);
  function findSpot(name, cx, cy, rMin, rMax) {
    for (let i = 0; i < 24; i++) { const a = R() * TAU, d = rMin + R() * (rMax - rMin), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (spotFor(name, x, y) && !inside(x, y)) return [x, y]; }
    return null;
  }

  // ---------- população ----------
  const birds = [];
  const newBird = (name, x, y, mode) => ({ name, x, y, z: mode === 'fly' ? 6 + R() * 6 : 0, vx: 0, vy: 0, vz: 0, h: R() * TAU, mode, t: R() * 3, ph: R() * TAU, peck: 0, hop: 0, land: null, life: 8 + R() * 14 });
  let flockT = 0;
  function populate(cx, cy, rad, night, E) {
    const want = night ? 0 : Math.round((E.windNow > 0.9 ? 14 : 26) * (E.snow > 0.5 ? 0.5 : 1));
    // retira os que ficaram longe (ou todos à noite)
    for (let i = birds.length - 1; i >= 0; i--) { const b = birds[i]; if (night || Math.hypot(b.x - cx, b.y - cy) > rad + 35) birds.splice(i, 1); }
    let tries = 6;
    while (birds.length < want && tries-- > 0) {
      const name = R() < 0.55 ? 'pigeon' : 'gull', p = findSpot(name, cx, cy, rad * 0.25, rad + 12);
      if (!p) continue;
      const n = 2 + ((R() * 5) | 0);
      for (let k = 0; k < n && birds.length < want + 4; k++) { const q = [p[0] + (R() - 0.5) * 2.2, p[1] + (R() - 0.5) * 2.2]; if (spotFor(name, q[0], q[1])) birds.push(newBird(name, q[0], q[1], 'ground')); }
    }
    // de vez em quando um bando passa voando alto
    if (!night && (flockT -= 1) <= 0) {
      flockT = 25 + R() * 30;
      const name = R() < 0.6 ? 'gull' : 'pigeon', a = R() * TAU, n = 4 + ((R() * 6) | 0), h = a + Math.PI + (R() - 0.5) * 0.8;
      for (let k = 0; k < n; k++) { const b = newBird(name, cx + Math.cos(a) * (rad + 8) + (R() - 0.5) * 6, cy + Math.sin(a) * (rad + 8) + (R() - 0.5) * 6, 'fly'); b.h = h; b.z = 9 + R() * 5; b.pass = true; b.life = 40; birds.push(b); }
    }
  }

  // ---------- comportamento ----------
  function threat(b) {
    let d = 1e9; const p = bridge.player;
    if (p) d = Math.hypot(p.x - b.x, p.y - b.y);
    const car = opts.car && opts.car();   // carro dirigido (x, y, speed)
    if (car) d = Math.min(d, Math.hypot(car.x - b.x, car.y - b.y) - Math.min(6, Math.abs(car.speed || 0) * 0.4));
    return d;
  }
  function takeOff(b, fromX, fromY) {
    const a = Math.atan2(b.y - fromY, b.x - fromX) + (R() - 0.5) * 1.2;
    b.mode = 'fly'; b.h = a; b.vz = 2.6 + R() * 1.2; b.life = 7 + R() * 12; b.land = null; b.z = Math.max(b.z, 0.05);
  }
  function step(b, dt, cx, cy, rad, E) {
    const s = SP[b.name];
    b.t += dt;
    if (b.mode === 'ground') {
      const d = threat(b);
      if (d < (b.name === 'gull' ? 5 : 3.8)) { const p = bridge.player; takeOff(b, p ? p.x : b.x - 1, p ? p.y : b.y); return; }
      // cisca, olha em volta, dá pulinhos
      b.peck = Math.max(0, Math.sin(b.t * 7 + b.ph)) * (Math.sin(b.t * 0.7 + b.ph) > 0.2 ? 1 : 0);
      if (b.hop > 0) { b.hop -= dt; b.x += Math.sin(b.h) * dt * 0.6; b.y += Math.cos(b.h) * dt * 0.6; b.z = Math.abs(Math.sin(b.hop * 15)) * 0.03; if (!spotFor(b.name, b.x, b.y)) { b.h += Math.PI; } }
      else { b.z = 0; if (R() < dt * 0.5) { b.hop = 0.35 + R() * 0.5; b.h += (R() - 0.5) * 2.2; } }
      return;
    }
    // voo
    b.life -= dt;
    const sp = s.speed * (b.pass ? 1.1 : 1) + E.windNow * 2;
    if (!b.pass) {
      // circula pela área e, com o tempo esgotado, escolhe um pouso
      if (b.life <= 0 && !b.land) b.land = findSpot(b.name, cx, cy, 4, rad * 0.8);
      let tx, ty;
      if (b.land) { [tx, ty] = b.land; } else { tx = cx + Math.cos(b.t * 0.25 + b.ph) * rad * 0.6; ty = cy + Math.sin(b.t * 0.25 + b.ph) * rad * 0.6; }
      let da = Math.atan2(tx - b.x, ty - b.y) - b.h; da = Math.atan2(Math.sin(da), Math.cos(da)); b.h += Math.max(-1.6, Math.min(1.6, da)) * dt * 1.5;
      const dist = Math.hypot(tx - b.x, ty - b.y), wantZ = b.land ? Math.min(8, dist * 0.35) : 7 + Math.sin(b.ph) * 3;
      b.vz += ((wantZ - b.z) * 0.9 - b.vz) * dt * 2;
      if (b.land && dist < 0.5 && b.z < 0.25) { b.mode = 'ground'; b.x = tx; b.y = ty; b.z = 0; b.vz = 0; b.land = null; return; }
      const slow = b.land ? Math.min(1, 0.35 + dist * 0.12) : 1;
      b.x += Math.sin(b.h) * sp * slow * dt; b.y += Math.cos(b.h) * sp * slow * dt;
    } else { b.x += Math.sin(b.h) * sp * dt; b.y += Math.cos(b.h) * sp * dt; b.vz = (9 - b.z) * 0.5; }
    // o vento empurra um pouco
    b.x += E.windDir[0] * E.windNow * 1.2 * dt; b.y += E.windDir[1] * E.windNow * 1.2 * dt;
    b.z = Math.max(0, b.z + b.vz * dt);
  }

  // ---------- matrizes ----------
  const M = new THREE.Matrix4(), W = new THREE.Matrix4(), T = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  function draw() {
    const n = { pigeon: 0, gull: 0 };
    for (const b of birds) {
      const K = kinds[b.name], s = K.s, i = n[b.name]++; if (i >= CAP) continue;
      const fly = b.mode === 'fly', climb = fly ? Math.max(-0.5, Math.min(0.6, b.vz * 0.12)) : 0;
      const pitch = fly ? -climb : b.peck * 0.55, bank = fly && !b.pass ? Math.sin(b.t * 0.8 + b.ph) * 0.25 : 0;
      e.set(pitch, b.h, bank); q.setFromEuler(e); p3.set(b.x, b.z, b.y); s3.setScalar(s.len); M.compose(p3, q, s3);
      K.body.setMatrixAt(i, M);
      // asas: batendo (gaivota alterna batida e planeio), dobradas no chão
      let a, sx = 1;
      if (fly) { const gl = s.glide > 0.3 && Math.sin(b.t * 0.9 + b.ph) > 0 && b.vz < 1.5; a = gl ? 0.08 + Math.sin(b.t * 2) * 0.05 : Math.sin(b.t * s.flap + b.ph) * 0.95 + 0.15; }
      else { a = -0.35; sx = 0.42; }
      for (const side of [1, -1]) {
        T.makeTranslation(side * 0.035, 0.14, 0.01);
        W.makeRotationZ(side * a); T.multiply(W); W.makeScale(side * sx, 1, fly ? 1 : 0.8); T.multiply(W);
        if (!fly) { W.makeRotationY(side * 0.25); T.premultiply(W); }
        W.multiplyMatrices(M, T); (side > 0 ? K.wingR : K.wingL).setMatrixAt(i, W);
      }
    }
    for (const [name, K] of Object.entries(kinds)) { const c = Math.min(CAP, n[name]); for (const m of [K.body, K.wingR, K.wingL]) { m.count = c; m.instanceMatrix.needsUpdate = true; } }
  }

  const state = { birds: 0, flying: 0 };
  let last = performance.now() / 1000, popT = 0;
  return {
    state,
    update() {
      const E = globalThis.ENV; if (!E) return;
      const now = performance.now() / 1000, dt = Math.min(0.1, now - last); last = now;
      const c = bridge.cam, hw = c.W / (2 * c.zoom), hh = c.H / (2 * c.zoom) / (c.tilt || 0.5), rad = Math.hypot(hw, hh) * 0.9;
      const night = E.dark > 0.6;
      if ((popT -= dt) <= 0) { popT = 1; populate(c.x, c.y, rad, night, E); }
      for (const b of birds) step(b, dt, c.x, c.y, rad, E);
      for (let i = birds.length - 1; i >= 0; i--) if (birds[i].pass && birds[i].life < 0) birds.splice(i, 1);
      draw();
      state.birds = birds.length; state.flying = birds.filter(b => b.mode === 'fly').length;
    },
  };
}
