// blood-fx.mjs — sangue: respingo (gotas que voam na direção do golpe/tiro e caem), pedaços (atropelamento forte),
// manchas no chão, rastro de quem sangra e poças que crescem embaixo do corpo. Fila fixa (as mais velhas somem).
// Coordenadas do jogo: (x, y) no chão e z = altura → three: (x, z, y).
const DROPS = 420, STAINS = 220;

export function createBlood(THREE, scene) {
  const state = { drops: 0, stains: 0 };
  // gota: ponto vermelho escuro com borda suave
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
  gr.addColorStop(0, 'rgba(140,4,8,1)'); gr.addColorStop(.55, 'rgba(104,2,6,.95)'); gr.addColorStop(1, 'rgba(70,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const dropTex = new THREE.CanvasTexture(c), drops = [];
  // pedaço: bolota irregular mais escura (carne/roupa encharcada)
  const cc = document.createElement('canvas'); cc.width = cc.height = 32;
  const cg = cc.getContext('2d');
  for (let i = 0; i < 5; i++) { cg.fillStyle = i < 2 ? '#4a0306' : '#6e0509'; cg.beginPath(); cg.arc(10 + Math.random() * 12, 10 + Math.random() * 12, 5 + Math.random() * 5, 0, Math.PI * 2); cg.fill(); }
  const chunkTex = new THREE.CanvasTexture(cc);
  for (let i = 0; i < DROPS; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dropTex, transparent: true, depthWrite: false }));
    s.visible = false; s.renderOrder = 4; scene.add(s); drops.push({ s, life: 0, vx: 0, vy: 0, vz: 0, floor: 0, chunk: false });
  }
  // poça: mancha irregular (círculos sobrepostos) — duas variações; o respingo no chão usa a de pingos espalhados
  const blotch = (spatter) => {
    const pc = document.createElement('canvas'); pc.width = pc.height = 128;
    const pg = pc.getContext('2d');
    for (let i = 0; i < (spatter ? 34 : 26); i++) {
      const core = !spatter && i < 6, a = Math.random() * Math.PI * 2, d = core ? Math.random() * 12 : (spatter ? 4 + Math.random() * 54 : 14 + Math.random() * 30);
      const r = core ? 30 + Math.random() * 10 : spatter ? 2 + Math.random() * (i < 8 ? 14 : 6) : 5 + Math.random() * 13;
      const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, q = pg.createRadialGradient(x, y, r * .3, x, y, r);
      q.addColorStop(0, 'rgba(100,3,8,.97)'); q.addColorStop(.8, 'rgba(80,1,5,.93)'); q.addColorStop(1, 'rgba(60,0,0,0)');
      pg.fillStyle = q; pg.beginPath(); pg.arc(x, y, r, 0, Math.PI * 2); pg.fill();
    }
    const t = new THREE.CanvasTexture(pc); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  };
  const poolMat = blotch(false), splatMat = blotch(true);
  const plane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), stains = [];
  let di = 0;

  function stain(x, y, r, grow, floor, mat = poolMat) {
    let st = stains.length >= STAINS ? stains.shift() : null;
    if (!st) { const m = new THREE.Mesh(plane, mat); m.renderOrder = 1; scene.add(m); st = { m }; }
    st.m.material = mat;
    st.m.position.set(x, floor + .015 + (stains.length % 60) * .0003, y); st.m.rotation.y = Math.random() * Math.PI * 2;
    st.r = r; st.t = 0; st.grow = grow; st.m.scale.setScalar(grow > 0 ? .05 : r); st.m.visible = true;
    stains.push(st); state.stains = stains.length;
  }
  // n gotas saindo de (x,y,z) na direção (dx,dy) do golpe, com espalhamento; power aumenta velocidade e tamanho
  function spray(x, y, z, dx, dy, n, floor = 0, { power = 1, chunks = 0, spread = 1.1 } = {}) {
    for (let i = 0; i < n + chunks; i++) {
      const q = drops[di]; di = (di + 1) % drops.length;
      const chunk = i >= n, sp = (1.2 + Math.random() * 2.6) * power * (chunk ? .7 : 1), a = Math.atan2(dy, dx) + (Math.random() - .5) * spread;
      q.vx = Math.cos(a) * sp; q.vy = Math.sin(a) * sp; q.vz = (.4 + Math.random() * 1.8) * Math.sqrt(power); q.life = 1.8; q.floor = floor; q.chunk = chunk;
      q.s.material.map = chunk ? chunkTex : dropTex;
      q.s.position.set(x, z, y); q.s.scale.setScalar(chunk ? .09 + Math.random() * .1 : (.04 + Math.random() * .06) * Math.min(1.6, power)); q.s.visible = true;
    }
  }
  function update(dt) {
    let live = 0;
    for (const q of drops) {
      if (!q.s.visible) continue;
      q.life -= dt; q.vz -= 9.8 * dt;
      const p = q.s.position; p.x += q.vx * dt; p.z += q.vy * dt; p.y += q.vz * dt;
      // no chão: vira mancha (pedaço sempre deixa; gota, uma em cada duas)
      if (p.y <= q.floor + .02) {
        q.s.visible = false;
        if (q.chunk) stain(p.x, p.z, .14 + Math.random() * .12, 0, q.floor);
        else if (Math.random() < .5) stain(p.x, p.z, .05 + Math.random() * .09, 0, q.floor, Math.random() < .3 ? splatMat : poolMat);
        continue;
      }
      if (q.life <= 0) { q.s.visible = false; continue; }
      live++;
    }
    for (const st of stains) if (st.grow > 0 && st.t < st.grow) { st.t += dt; st.m.scale.setScalar(st.r * Math.min(1, .08 + Math.sqrt(st.t / st.grow))); }
    state.drops = live;
  }
  return {
    state, spray, update,
    pool: (x, y, r, grow, floor = 0) => stain(x, y, r, grow, floor),
    // respingo grande no chão (onde o tiro/carro pegou)
    splat: (x, y, r, floor = 0) => stain(x, y, r, 0, floor, splatMat),
    // pingo de rastro (ferido andando, corpo arrastado, pneu sujo)
    drip: (x, y, r = .06, floor = 0) => stain(x, y, r, 0, floor, Math.random() < .5 ? splatMat : poolMat)
  };
}
