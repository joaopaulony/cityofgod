// destructibles.mjs — mobiliário de rua que o carro derruba: poste de luz e semáforo caem p/ o lado do empurrão,
// hidrante quebra e solta um jato de água. O carro passa (perde velocidade, dano leve) em vez de parar seco.
// Objeto caído não colide (marca .broken: world.js e vehicle-collision.mjs a respeitam). Volta ao normal depois de
// RESTORE_S com o jogador longe (> 40 m) ou na hora se ele se afastar mais de 120 m.
// Quem desenha lê as marcas: props-3d.mjs (postes/semáforos tombados, hidrante escondido).
const RESTORE_S = 90, FAR = 120, NEAR = 40, FALL_S = 0.9, MIN_SPEED = 2.5;

export function createDestructibles(THREE, scene, bridge) {
  const broken = new Set();   // registros: { kind, obj, t, dir:[x,y], jet? }
  const state = { broken: 0, version: 0 };
  // ---------- jato de água do hidrante ----------
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
  gr.addColorStop(0, 'rgba(235,246,255,.95)'); gr.addColorStop(1, 'rgba(200,225,245,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c), drops = [];
  for (let i = 0; i < 160; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: .8 }));
    s.visible = false; s.renderOrder = 3; scene.add(s); drops.push({ s, life: 0, vx: 0, vy: 0, vz: 0 });
  }
  let di = 0;
  const lampOf = circle => circle.lampRef || (circle.lampRef = (bridge.world.lamps || []).find(l => Math.hypot(l.x - circle.x, l.y - circle.y) < .35) || null);

  // o impacto é de algo quebrável? (kind/objeto do vehicle-collision.mjs)
  function breakable(impact) {
    const o = impact?.object;
    if (!o || o.broken) return false;
    if (impact.kind === 'lamp' || impact.kind === 'trafficSignal') return true;
    return impact.kind === 'object' && o.kind === 'hydrant';
  }
  function hit(impact, car) {
    if (!breakable(impact) || Math.abs(car.speed) < MIN_SPEED) return false;
    const o = impact.object, dir = [Math.cos(car.angle) * Math.sign(car.speed || 1), Math.sin(car.angle) * Math.sign(car.speed || 1)];
    const rec = { kind: impact.kind === 'object' ? 'hydrant' : impact.kind, obj: o, t: 0, dir };
    o.broken = true;
    if (rec.kind === 'lamp') { const l = lampOf(o); if (l) { l.fallen = { t: 0, dir }; rec.lamp = l; } }
    if (rec.kind === 'trafficSignal' && o.ref) { o.ref.fallen = { t: 0, dir }; rec.signal = o.ref; }
    if (rec.kind === 'hydrant') { o.solidBefore = o.solid; o.solid = false; rec.jet = { x: o.x, y: o.y }; }
    broken.add(rec); state.broken = broken.size; state.version++; bridge.world.breakVersion = (bridge.world.breakVersion || 0) + 1;
    return true;
  }
  function restore(rec) {
    const o = rec.obj; o.broken = false;
    if (rec.lamp) delete rec.lamp.fallen;
    if (rec.signal) delete rec.signal.fallen;
    if (rec.kind === 'hydrant') o.solid = o.solidBefore ?? true;
    broken.delete(rec); state.broken = broken.size; state.version++; bridge.world.breakVersion = (bridge.world.breakVersion || 0) + 1;
  }
  function update(dt) {
    const p = bridge.player, car = globalThis.cityVehicles?.driver ? globalThis.cityVehicles.car : p;
    for (const rec of [...broken]) {
      rec.t += dt;
      const fall = rec.lamp?.fallen || rec.signal?.fallen;
      if (fall) fall.t = rec.t;
      const d = Math.hypot(rec.obj.x - car.x, rec.obj.y - car.y);
      if (d > FAR || (rec.t > RESTORE_S && d > NEAR)) { restore(rec); continue; }
      // jato do hidrante: forte nos primeiros 20 s, depois vai enfraquecendo
      if (rec.jet && rec.t < 60) {
        const k = rec.t < 20 ? 1 : Math.max(0, 1 - (rec.t - 20) / 40);
        rec.acc = (rec.acc || 0) + dt * 90 * k;
        while (rec.acc >= 1) {
          rec.acc--;
          const q = drops[di]; di = (di + 1) % drops.length;
          const a = Math.random() * Math.PI * 2, sp = .25 + Math.random() * .6;
          q.life = 1 + Math.random() * .5; q.vx = Math.cos(a) * sp; q.vz = Math.sin(a) * sp; q.vy = 5.5 + Math.random() * 2.2;
          q.s.position.set(rec.jet.x, .55, rec.jet.y); q.s.scale.setScalar(.22); q.s.visible = true;
        }
      }
    }
    for (const q of drops) {
      if (!q.s.visible) continue;
      q.life -= dt; if (q.life <= 0 || q.s.position.y < 0) { q.s.visible = false; continue; }
      q.vy -= 9.8 * dt; q.s.position.x += q.vx * dt; q.s.position.y += q.vy * dt; q.s.position.z += q.vz * dt;
      q.s.scale.setScalar(.22 + (1.5 - q.life) * .35); q.s.material.opacity = Math.min(.8, q.life);
    }
  }
  return { state, breakable, hit, update, MIN_SPEED };
}

// ângulo de queda (0 em pé → π/2 deitado) com um quique no fim, p/ o desenho 3D
export function fallAngle(t) {
  const u = Math.min(1, t / FALL_S), base = Math.PI / 2 * u * u;
  return u < 1 ? base : Math.PI / 2 - .06 * Math.abs(Math.sin(Math.min(1, (t - FALL_S) / .35) * Math.PI)) * Math.exp(-(t - FALL_S) * 4);
}
