// blood-fx.mjs — sangue: respingo (gotas que voam na direção do golpe/tiro e caem) e poças no chão. As gotas que
// chegam ao chão deixam manchinhas; o corpo caído deixa uma poça que cresce devagar. Fila fixa (as mais velhas somem).
// Coordenadas do jogo: (x, y) no chão e z = altura → three: (x, z, y).
const DROPS = 140, STAINS = 48;

export function createBlood(THREE, scene) {
  const state = { drops: 0, stains: 0 };
  // gota: ponto vermelho escuro com borda suave
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
  gr.addColorStop(0, 'rgba(128,6,10,1)'); gr.addColorStop(.55, 'rgba(98,4,8,.9)'); gr.addColorStop(1, 'rgba(70,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const dropTex = new THREE.CanvasTexture(c), drops = [];
  for (let i = 0; i < DROPS; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dropTex, transparent: true, depthWrite: false }));
    s.visible = false; s.renderOrder = 4; scene.add(s); drops.push({ s, life: 0, vx: 0, vy: 0, vz: 0, floor: 0 });
  }
  // poça: mancha irregular (círculos sobrepostos) desenhada uma vez
  const pc = document.createElement('canvas'); pc.width = pc.height = 128;
  const pg = pc.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, d = i < 6 ? Math.random() * 12 : 14 + Math.random() * 30, r = i < 6 ? 30 + Math.random() * 10 : 5 + Math.random() * 13;
    const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, q = pg.createRadialGradient(x, y, r * .3, x, y, r);
    q.addColorStop(0, 'rgba(92,4,8,.95)'); q.addColorStop(.8, 'rgba(78,2,6,.9)'); q.addColorStop(1, 'rgba(60,0,0,0)');
    pg.fillStyle = q; pg.beginPath(); pg.arc(x, y, r, 0, Math.PI * 2); pg.fill();
  }
  const poolTex = new THREE.CanvasTexture(pc); poolTex.colorSpace = THREE.SRGBColorSpace;
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const plane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), stains = [];
  let di = 0;

  function stain(x, y, r, grow, floor) {
    let st = stains.length >= STAINS ? stains.shift() : null;
    if (!st) { const m = new THREE.Mesh(plane, poolMat); m.renderOrder = 1; scene.add(m); st = { m }; }
    st.m.position.set(x, floor + .015 + stains.length * .0002, y); st.m.rotation.y = Math.random() * Math.PI * 2;
    st.r = r; st.t = 0; st.grow = grow; st.m.scale.setScalar(grow > 0 ? .05 : r); st.m.visible = true;
    stains.push(st); state.stains = stains.length;
  }
  // n gotas saindo de (x,y,z) na direção (dx,dy) do golpe, com espalhamento
  function spray(x, y, z, dx, dy, n, floor = 0) {
    for (let i = 0; i < n; i++) {
      const q = drops[di]; di = (di + 1) % drops.length;
      const sp = 1.2 + Math.random() * 2.6, a = Math.atan2(dy, dx) + (Math.random() - .5) * 1.1;
      q.vx = Math.cos(a) * sp; q.vy = Math.sin(a) * sp; q.vz = .4 + Math.random() * 1.8; q.life = 1.4; q.floor = floor;
      q.s.position.set(x, z, y); q.s.scale.setScalar(.035 + Math.random() * .05); q.s.visible = true;
    }
  }
  function update(dt) {
    let live = 0;
    for (const q of drops) {
      if (!q.s.visible) continue;
      q.life -= dt; q.vz -= 9.8 * dt;
      const p = q.s.position; p.x += q.vx * dt; p.z += q.vy * dt; p.y += q.vz * dt;
      // no chão: vira manchinha (uma em cada três, p/ não lotar a fila)
      if (p.y <= q.floor + .02) { q.s.visible = false; if (Math.random() < .34) stain(p.x, p.z, .05 + Math.random() * .07, 0, q.floor); continue; }
      if (q.life <= 0) { q.s.visible = false; continue; }
      live++;
    }
    for (const st of stains) if (st.grow > 0 && st.t < st.grow) { st.t += dt; st.m.scale.setScalar(st.r * Math.min(1, .08 + Math.sqrt(st.t / st.grow))); }
    state.drops = live;
  }
  return { state, spray, pool: (x, y, r, grow, floor = 0) => stain(x, y, r, grow, floor), update };
}
