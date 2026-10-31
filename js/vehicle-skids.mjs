// vehicle-skids.mjs — marcas de pneu no asfalto e fumaça das rodas traseiras no drift e na freada forte.
// Marcas: faixas escuras de 20 cm atrás de cada roda traseira, num buffer circular (as mais antigas somem quando
// enche). Fumaça: partículas que sobem, crescem e esmaecem. Coordenadas do jogo (x, y) → cena 3D (x, 0, y).
const SEGMENTS = 1600, SMOKE = 90, MARK_W = .2, MIN_STEP = .14;

export function createSkidFX(scene, THREE) {
  // ---------- marcas ----------
  const pos = new Float32Array(SEGMENTS * 4 * 3), alpha = new Float32Array(SEGMENTS * 4), index = new Uint32Array(SEGMENTS * 6);
  for (let i = 0; i < SEGMENTS; i++) index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const markMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.05, 0.05, 0.055, vA); }'
  });
  const marks = new THREE.Mesh(geo, markMat); marks.frustumCulled = false; marks.renderOrder = 2; scene.add(marks);
  let next = 0, dirty = false;
  const last = [null, null];
  function addMark(k, x, y, strength) {
    const p = last[k];
    if (!p) { last[k] = { x, y }; return; }
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d < MIN_STEP) return;
    if (d > 2) { last[k] = { x, y }; return; }   // teleporte/corte: não liga os pontos
    const nx = -dy / d * MARK_W / 2, ny = dx / d * MARK_W / 2, i = next, o = i * 12, h = .025;
    pos.set([p.x + nx, h, p.y + ny, p.x - nx, h, p.y - ny, x + nx, h, y + ny, x - nx, h, y - ny], o);
    alpha.fill(Math.min(.62, .25 + strength * .5), i * 4, i * 4 + 4);
    next = (next + 1) % SEGMENTS; dirty = true; last[k] = { x, y };
  }

  // ---------- fumaça ----------
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(235,235,232,.95)'); grad.addColorStop(.55, 'rgba(220,220,216,.45)'); grad.addColorStop(1, 'rgba(210,210,205,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const puffs = [];
  for (let i = 0; i < SMOKE; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; s.renderOrder = 3; scene.add(s);
    puffs.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 });
  }
  let cursor = 0, spawnAcc = 0;
  function puff(x, y, vx, vz, strength) {
    const p = puffs[cursor]; cursor = (cursor + 1) % SMOKE;
    p.life = p.max = 1.1 + Math.random() * .9; p.size = .55 + strength * .5;
    p.vx = vx * .25 + (Math.random() - .5) * .6; p.vz = vz * .25 + (Math.random() - .5) * .6; p.vy = .45 + Math.random() * .45;
    p.s.position.set(x, .25, y); p.s.visible = true;
  }

  return {
    // car: estado da física (x, y, angle, slip, speed); spec: wheelbase/width; braking: freio forte
    update(dt, car, { wheelbase = 2.6, width = 1.8, braking = false, active = true } = {}) {
      const slip = Math.abs(car.slip || 0), speed = Math.abs(car.speed || 0);
      const skidding = active && ((car.drifting && speed > 3) || (braking && speed > 8));
      const strength = Math.min(1, car.drifting ? slip * 1.6 + speed / 40 : speed / 30);
      const ca = Math.cos(car.angle), sa = Math.sin(car.angle), back = wheelbase / 2, side = width * .42;
      for (const [k, s] of [[0, 1], [1, -1]]) {
        const x = car.x - ca * back - sa * side * s, y = car.y - sa * back + ca * side * s;
        if (skidding) addMark(k, x, y, strength); else last[k] = null;
      }
      if (dirty) { geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true; dirty = false; }
      if (skidding) {
        spawnAcc += dt * (18 + 42 * strength);
        const vx = Math.cos(car.angle + (car.slip || 0)) * car.speed, vz = Math.sin(car.angle + (car.slip || 0)) * car.speed;
        while (spawnAcc >= 1) {
          spawnAcc--;
          const s = Math.random() < .5 ? 1 : -1;
          puff(car.x - ca * back - sa * side * s, car.y - sa * back + ca * side * s, vx, vz, strength);
        }
      } else spawnAcc = 0;
      for (const p of puffs) {
        if (!p.s.visible) continue;
        p.life -= dt;
        if (p.life <= 0) { p.s.visible = false; continue; }
        const t = 1 - p.life / p.max;
        p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
        p.vx *= .96; p.vz *= .96;
        const size = p.size * (1 + t * 2.6); p.s.scale.set(size, size, 1);
        p.s.material.opacity = .42 * (1 - t) * Math.min(1, t * 6);
      }
    },
    dispose() { scene.remove(marks); geo.dispose(); markMat.dispose(); tex.dispose(); for (const p of puffs) { scene.remove(p.s); p.s.material.dispose(); } }
  };
}
