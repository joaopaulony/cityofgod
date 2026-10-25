// airport-3d.mjs — o aeroporto internacional em 3D (inspirado no de Los Angeles):
// • aviões de passageiros detalhados (fuselagem torneada com janelas, cabine, asas enflechadas com winglets,
//   motores com entrada escura, empenagem com a pintura da companhia, trem de pouso, luzes de navegação)
//   estacionados nos portões com pontes de embarque; um avião decola e outro pousa de tempos em tempos
// • torre de controle e o prédio-símbolo de arcos parabólicos com o restaurante em disco, no estilo do de LAX
// • luzes de borda e de cabeceira da pista (acendem à noite), tratores de bagagem
// • cerca de grade de ferro com arame farpado em volta de todo o lado das pistas (colisão: openworld.js)
import {makeKit} from './kit-3d.mjs';

const TAU = Math.PI * 2;
const LIVERIES = [
  { name: 'Pacific Air', tail: '#c8102e', belly: '#c8102e', stripe: '#1f2f5a' },
  { name: 'Sunset Lines', tail: '#1f3c88', belly: '#2b5fb8', stripe: '#f2a51a' },
  { name: 'Palm Jet', tail: '#1e8a5a', belly: '#d8dcd8', stripe: '#1e8a5a' },
  { name: 'Golden Coast', tail: '#d4a017', belly: '#2b2f36', stripe: '#d4a017' },
];

// espelha em x sem inverter a face (troca a ordem dos vértices de cada triângulo)
function mirrorX(g) { g = g.index ? g.toNonIndexed() : g; g.scale(-1, 1, 1); for (const at of Object.values(g.attributes)) { const n = at.itemSize, a = at.array; for (let i = 0; i < at.count; i += 3) for (let c = 0; c < n; c++) { const t = a[(i + 1) * n + c]; a[(i + 1) * n + c] = a[(i + 2) * n + c]; a[(i + 2) * n + c] = t; } } g.computeVertexNormals(); return g; }

export function createAirport3D(THREE, scene, bridge) {
  const Kit = makeKit(THREE), col = h => new THREE.Color().setStyle(h, THREE.SRGBColorSpace);
  const state = { ready: false, planes: 0, fence: 0, flight: '' };
  const matBody = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x555555, side: THREE.DoubleSide });
  const matMetal = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const matGlass = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 100, specular: 0x999999, transparent: true, opacity: 0.75 });
  const matGlow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const glowMats = [];   // luzes que acendem à noite

  // ======================= avião (nariz +z, cima +y, asa ao longo de x) =======================
  function planeGeo(lv, L = 38, R = 1.95) {
    const k = Kit(), Yc = 3.3;
    // fuselagem torneada: cone do nariz arredondado, cilindro, cone da cauda levantado
    const prof = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, y = t * L;
      let r = R;
      if (t > 0.86) { const u = (t - 0.86) / 0.14; r = R * Math.sqrt(Math.max(0, 1 - u * u * 0.96)); }
      if (t < 0.26) { const u = (0.26 - t) / 0.26; r = R * (1 - u * u * 0.82); }
      prof.push(new THREE.Vector2(Math.max(0.05, r), y));
    }
    const fus = new THREE.LatheGeometry(prof, 28).toNonIndexed(); fus.rotateX(Math.PI / 2); fus.translate(0, Yc, -L / 2);
    // cauda sobe (upsweep) e pintura por altura: dorso branco, faixa, barriga na cor da companhia
    const p = fus.attributes.position, cl = new Float32Array(p.count * 3), white = col('#f4f5f6'), belly = col(lv.belly), stripe = col(lv.stripe), grey = col('#c9cdd2');
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i), t = (z + L / 2) / L; let y = p.getY(i);
      if (t < 0.3) { const u = (0.3 - t) / 0.3; y += (y - Yc < 0 ? 1 : 0.35) * u * u * 1.4; p.setY(i, y); }
      const h = (y - Yc) / R, c = h > -0.18 ? white : h > -0.32 ? stripe : t > 0.25 && t < 0.86 ? (lv.belly === '#d8dcd8' ? grey : belly) : grey;
      cl.set([c.r, c.g, c.b], i * 3);
    }
    fus.setAttribute('color', new THREE.BufferAttribute(cl, 3)); fus.computeVertexNormals(); k.colored(fus);
    // janelas (fileira de cada lado) e portas
    for (const s of [1, -1]) {
      for (let z = -L / 2 + 9; z < L / 2 - 7; z += 0.95) k.box(s * (R - 0.04) - 0.03, Yc + 0.34, z, s * (R - 0.04) + 0.03, Yc + 0.64, z + 0.32, '#1c2630', 0.04, 'glass');
      for (const z of [L / 2 - 6.2, -L / 2 + 8]) k.box(s * R - 0.04, Yc - 0.6, z, s * R + 0.04, Yc + 1.2, z + 0.85, '#d6d9dc');
    }
    // cabine (para-brisas escuro em V)
    for (const s of [1, -1]) { const g = new THREE.BoxGeometry(1.15, 0.6, 0.08); g.rotateY(s * 0.55); g.rotateX(-0.5); g.translate(s * 0.66, Yc + 0.98, L / 2 - 3.0); k.raw(g, '#18202a', 'glass'); }
    // asas enflechadas com diedro e winglet
    const wing = (span, cr, ct, sweep, th) => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(span, -sweep); sh.lineTo(span, -sweep - ct); sh.lineTo(0, -cr); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); g.rotateX(Math.PI / 2); return g; };
    for (const s of [1, -1]) {
      let w = wing(15.6, 6.4, 1.7, 7.5, 0.32); w.rotateZ(0.085); if (s < 0) w = mirrorX(w); w.translate(s * (R - 0.3), Yc - 1.1, 3.6); k.raw(w, '#dfe2e5');
      const wl = new THREE.BoxGeometry(0.12, 2.0, 1.3); wl.rotateX(-0.35); wl.translate(s * (R + 15.1), Yc + 0.65, -4.6); k.raw(wl, lv.tail);
      // motor: nacele, entrada escura, cone de escape e pilone
      const ex = s * 5.9, ez = 2.2, ey = Yc - 2.2;
      const nac = new THREE.CylinderGeometry(1.05, 0.9, 3.8, 20); nac.rotateX(Math.PI / 2); nac.translate(ex, ey, ez); k.raw(nac, '#e8eaec');
      const lip = new THREE.TorusGeometry(1.0, 0.09, 8, 20); lip.translate(ex, ey, ez + 1.9); k.raw(lip, '#b9bec3');
      const fan = new THREE.CircleGeometry(0.95, 20); fan.translate(ex, ey, ez + 1.85); k.raw(fan, '#23272b');
      const cone = new THREE.ConeGeometry(0.55, 1.2, 14); cone.rotateX(-Math.PI / 2); cone.translate(ex, ey, ez - 2.4); k.raw(cone, '#8d9297');
      k.box(ex - 0.15, ey + 0.8, ez - 1.6, ex + 0.15, Yc - 1.0, ez + 1.2, '#dfe2e5');
      // luzes de navegação (vermelha à esquerda, verde à direita) na ponta da asa
      k.box(s * (R + 15.2) - 0.1, Yc - 0.2, -4.3, s * (R + 15.2) + 0.1, Yc + 0.05, -4.0, s > 0 ? '#ff3a2a' : '#2aff6a', 0, 'glow');
    }
    // estabilizadores horizontais e deriva com a cor da companhia e um disco de logotipo
    for (const s of [1, -1]) { let st = wing(6.2, 3.2, 1.1, 3.2, 0.2); if (s < 0) st = mirrorX(st); st.translate(s * 0.4, Yc + 0.9, -L / 2 + 4.6); k.raw(st, '#dfe2e5'); }
    { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(6.4, 0); sh.lineTo(3.9, 7.0); sh.lineTo(1.6, 7.0); sh.closePath(); const fin = new THREE.ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: false }); fin.rotateY(-Math.PI / 2); fin.translate(0.18, Yc + 1.4, -L / 2 + 0.6); k.raw(fin, lv.tail);
      const logo = new THREE.CircleGeometry(0.95, 20); for (const s of [1, -1]) { const g = logo.clone(); g.rotateY(s * Math.PI / 2); g.translate(s * 0.2, Yc + 5.0, -L / 2 + 4.3); k.raw(g, '#f4f5f6'); } }
    // trem de pouso
    k.cyl(0, 0, L / 2 - 5, 0.09, Yc - 1.4, '#a7acb1', 8); k.cylX(-0.3, 0.3, 0.42, L / 2 - 5, 0.42, '#1b1c1e', 14);
    for (const s of [1, -1]) { k.cyl(s * 2.6, 0, 0.4, 0.14, Yc - 1.2, '#a7acb1', 8); for (const dz of [-0.55, 0.55]) k.cylX(s * 2.6 - 0.45, s * 2.6 + 0.45, 0.55, 0.4 + dz, 0.55, '#1b1c1e', 16); }
    k.box(-0.15, Yc + R - 0.05, -2, 0.15, Yc + R + 0.15, -1.6, '#ff2a2a', 0, 'glow');   // farol anticolisão
    return k.done();
  }
  function planeMesh(lv) {
    const g = new THREE.Group();
    for (const [set, geo] of Object.entries(planeGeo(lv))) { const m = new THREE.Mesh(geo, set === 'glass' ? matGlass : set === 'glow' ? matGlow : matBody); m.castShadow = set !== 'glow'; m.receiveShadow = true; g.add(m); }
    return g;
  }

  // ======================= cenário =======================
  let built = false, flyer = null, fenceMesh = null;
  const fenceSync = { x: 1e9, y: 1e9, n: -1 };
  function build(L) {
    const { ap, x0, y0, w, d, gates } = L, k = Kit(), glow = Kit();
    // aviões nos portões + pontes de embarque (túnel envidraçado, rotunda e rodado)
    gates.forEach((gt, i) => {
      const pl = planeMesh(LIVERIES[i % LIVERIES.length]); pl.position.set(gt.x, 0, gt.y); scene.add(pl);
      const doorX = gt.x + 2.05, doorY = gt.y + gt.len / 2 - 6.2 + 0.4, fx = gt.x + 4.5, fy = y0 - 0.2;
      k.box(fx - 2.2, 0, fy - 4.2, fx + 2.2, 5.2, fy - 0.2, '#c9ccd0', 0.05);   // rotunda junto ao terminal
      const dx = doorX + 1.6 - fx, dy = doorY - (fy - 4.2), len = Math.hypot(dx, dy), ang = Math.atan2(dx, dy);
      const tube = new THREE.BoxGeometry(2.6, 2.7, len); tube.translate(0, 4.2, len / 2); tube.rotateY(ang); tube.translate(fx, 0, fy - 4.2); k.raw(tube, '#d4d7da');
      const win = new THREE.BoxGeometry(2.66, 0.7, len - 1); win.translate(0, 4.5, len / 2); win.rotateY(ang); win.translate(fx, 0, fy - 4.2); k.raw(win, '#2a3b4a', 'glass');
      const mx = fx + dx * 0.72, my = fy - 4.2 + dy * 0.72; k.box(mx - 0.25, 0, my - 0.25, mx + 0.25, 2.85, my + 0.25, '#7b8085'); for (const s of [-0.7, 0.7]) k.cylX(mx + s - 0.25, mx + s + 0.25, 0.45, my, 0.45, '#1b1c1e', 12);
      // trator e carrinhos de bagagem, cone e calço
      const bx = gt.x - 5.5, by = gt.y + 6;
      k.box(bx - 0.8, 0.3, by - 1.3, bx + 0.8, 1.3, by + 1.3, '#f2b632', 0.08); k.box(bx - 0.6, 1.3, by - 1.3, bx + 0.6, 2.0, by - 0.2, '#1f2a33', 0.04, 'glass');
      for (let c = 0; c < 3; c++) { const cy = by + 2.4 + c * 2.6; k.box(bx - 0.75, 0.35, cy, bx + 0.75, 1.2, cy + 2.1, '#5d6670', 0.03); for (const s of [-0.6, 0.6]) for (const dz of [0.3, 1.8]) k.cylX(bx + s - 0.12, bx + s + 0.12, 0.25, cy + dz, 0.25, '#1b1c1e', 10); }
      for (const s of [-1, 1]) k.cyl(gt.x + s * 6, 0, gt.y + 1, 0.22, 0.75, '#ff6a1a', 10, 0.04);
    });
    // terminal (inspirado no de Los Angeles): cobertura ondulada em abóbadas de metal claro sobre o terminal, que
    // avança 6 m sobre a calçada apoiada em pilares, cortina de vidro do saguão e letreiro na testeira
    const TH = (bridge.houses || []).find(H => H.terminal), th = TH ? TH.h : 6.6, front = y0 + d, bays = 8, bw = w / bays;
    for (let i = 0; i < bays; i++) {
      const cxb = x0 + bw * (i + 0.5), vault = new THREE.CylinderGeometry(bw / 2, bw / 2, d + 7, 20, 1, true, -Math.PI / 2, Math.PI);
      vault.rotateX(Math.PI / 2); vault.scale(1, 0.75, 1); vault.translate(cxb, th + 0.55, y0 + (d + 7) / 2 - 0.5); k.raw(vault, '#e9ecee');
      const sky = new THREE.BoxGeometry(0.9, 0.08, d + 6); sky.translate(cxb, th + 0.55 + bw / 2 * 0.75 + 0.02, y0 + (d + 7) / 2 - 0.5); k.raw(sky, '#7fa2b6', 'glass');
      k.box(x0 + bw * i - 0.25, th + 0.2, y0 - 0.5, x0 + bw * i + 0.25, th + 0.65, front + 6.5, '#c9ced2');
    }
    k.box(x0 + w - 0.25, th + 0.2, y0 - 0.5, x0 + w + 0.25, th + 0.65, front + 6.5, '#c9ced2');
    for (let i = 0; i <= bays; i++) k.cyl(x0 + bw * i, 0, front + 5.6, 0.32, th + 0.4, '#dfe3e6', 14);   // pilares da marquise
    k.box(x0 - 0.3, th + 0.1, front + 5.9, x0 + w + 0.3, th + 1.0, front + 6.6, '#2a4a66');   // testeira azul
    const gw = w * 0.62, gx0 = x0 + (w - gw) / 2;
    // Vão alinhado à porta funcional: a cortina decorativa não deve fechar a saída.
    const entryX = TH?.doorPt?.[0] ?? x0 + w / 2, gap = 1.6;
    k.box(gx0, 0.05, front + 0.25, entryX - gap, th - 0.1, front + 0.4, '#5f86a0', 0, 'glass');
    k.box(entryX + gap, 0.05, front + 0.25, gx0 + gw, th - 0.1, front + 0.4, '#5f86a0', 0, 'glass');
    k.box(entryX - gap, 2.7, front + 0.25, entryX + gap, th - 0.1, front + 0.4, '#5f86a0', 0, 'glass');
    for (let x = gx0; x <= gx0 + gw + 0.01; x += 2.2) if(Math.abs(x-entryX)>gap+.1) k.box(x - 0.06, 0, front + 0.2, x + 0.06, th - 0.05, front + 0.48, '#d9dde0');
    for (const y of [3.3, th - 0.15]) k.box(gx0, y - 0.08, front + 0.2, gx0 + gw, y + 0.08, front + 0.5, '#d9dde0');
    k.box(x0 + 2, 0, front + 0.6, x0 + w - 2, 0.12, front + 6.2, '#c4c0b6');   // calçada coberta (meio-fio de embarque)
    {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#2a4a66'; g.fillRect(0, 0, 1024, 64); g.fillStyle = '#ffffff'; g.font = '700 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CITY OF GOD INTERNATIONAL  ·  CGI', 512, 34);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.7, 46), 0.82), new THREE.MeshBasicMaterial({ map: tex })); sign.position.set(x0 + w / 2, th + 0.55, front + 6.62); scene.add(sign);
    }
    // torre de controle no lado das pistas, além da ponta leste do terminal
    const tx = x0 + w + 28, ty = y0 - 18;
    k.box(tx - 4, 0, ty - 4, tx + 4, 3.2, ty + 4, '#d3d6d9', 0.05);
    k.cyl(tx, 3.2, ty, 2.2, 30, '#e6e8ea', 16, 1.8);
    k.cyl(tx, 30, ty, 3.6, 30.6, '#c4c8cc', 8);
    const cab = new THREE.CylinderGeometry(3.9, 3.1, 4.2, 8, 1, true); cab.translate(tx, 32.7, ty); k.raw(cab, '#3b5566', 'glass');
    k.cyl(tx, 34.8, ty, 4.4, 35.6, '#d9dcdf', 8); k.cyl(tx, 35.6, ty, 0.08, 40, '#9aa0a6', 6);
    glow.box(tx - 0.2, 40, ty - 0.2, tx + 0.2, 40.4, ty + 0.2, '#ff2a2a');
    // prédio-símbolo (estilo LAX): dois arcos parabólicos brancos se cruzando e o restaurante em disco no meio
    const RW = bridge.ROAD_W || 3.5, rd = (x, y) => bridge.roadDist ? bridge.roadDist(x, y) : 99;
    const freeAt = (x, y) => rd(x, y) > RW + 12 && [0, 1, 2, 3, 4, 5].every(i => rd(x + Math.cos(i) * 17, y + Math.sin(i) * 17) > RW + 3) && !(bridge.houses || []).some(H => x > H.x0 - 20 && x < H.x1 + 20 && y > H.y0 - 20 && y < H.y1 + 20);
    const spot = [[x0 + w / 2, y0 + d + 30], [x0 - 32, y0 + d * 0.6], [x0 + w + 32, y0 + d * 0.6], [x0 - 34, y0 + d + 22], [x0 + w + 34, y0 + d + 22], [x0 + w / 2, y0 + d + 56], [x0 - 60, y0 + d * 0.6], [x0 + w + 60, y0 + d * 0.6]].find(([x, y]) => freeAt(x, y));
    const [sx, sy] = spot || [0, 0]; state.theme = !!spot;
    if (spot) {
      (window.cityLandmarkHoles || (window.cityLandmarkHoles = [])).push([sx - 27, sy - 27, sx + 27, sy + 27]);   // praça livre de plantas
      for (const a of [0.55, -0.55]) {
        const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24 * 2 - 1; pts.push(new THREE.Vector3(t * 17, 30 * (1 - t * t), 0)); }
        for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i], p1 = pts[i + 1], len = p0.distanceTo(p1), t = Math.abs((i + 0.5) / (pts.length - 1) * 2 - 1), th = 0.5 + 1.3 * t * t; const seg = new THREE.BoxGeometry(th, len + 0.05, th * 0.8); seg.rotateZ(-Math.atan2(p1.x - p0.x, p1.y - p0.y)); seg.translate((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, 0); seg.rotateY(a); seg.translate(sx, 0, sy); k.raw(seg, '#f6f6f2'); }
      }
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; k.cyl(sx + Math.cos(a) * 2.6, 0, sy + Math.sin(a) * 2.6, 0.3, 17.5, '#f0f0ec', 10); }
      const disc = new THREE.CylinderGeometry(6.8, 5.0, 2.6, 40); disc.translate(sx, 19.2, sy); k.raw(disc, '#f4f4f0');
      const band = new THREE.CylinderGeometry(6.4, 5.7, 1.2, 40, 1, true); band.translate(sx, 19.1, sy); k.raw(band, '#2c4a5c', 'glass');
      k.cyl(sx, 17.5, sy, 3.2, 17.9, '#d9dad5', 24); k.cyl(sx, 0, sy, 1.9, 17.5, '#e9e9e4', 20);
      // praça: anel de piso de pedra, gramado no meio e canteiros com palmeiras-anãs
      k.cyl(sx, 0, sy, 21, 0.1, '#cfc8b8', 48); k.cyl(sx, 0.1, sy, 13, 0.14, '#6f8f46', 40); k.cyl(sx, 0.14, sy, 4.2, 0.18, '#d8d2c4', 24);
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; k.box(sx + Math.cos(a) * 17 - 0.9, 0, sy + Math.sin(a) * 17 - 0.9, sx + Math.cos(a) * 17 + 0.9, 0.45, sy + Math.sin(a) * 17 + 0.9, '#bdb5a3'); k.sph(sx + Math.cos(a) * 17, 0.9, sy + Math.sin(a) * 17, 0.75, '#4f7a34', 0.8); }
    }
    // luzes da pista: bordas brancas a cada 60 m, cabeceiras verde/vermelha
    const ca = Math.cos(ap.ang), sa = Math.sin(ap.ang), P = (u, v) => [ap.x + u * ca - v * sa, ap.y + u * sa + v * ca];
    for (let u = -ap.len / 2; u <= ap.len / 2 + 0.1; u += 60) for (const v of [-ap.width / 2 - 1.5, ap.width / 2 + 1.5]) { const [x, y] = P(u, v); k.cyl(x, 0, y, 0.12, 0.35, '#5a5f64', 6); glow.box(x - 0.14, 0.35, y - 0.14, x + 0.14, 0.5, y + 0.14, '#fff2c8'); }
    for (const [u, c] of [[-ap.len / 2 - 2, '#30ff70'], [ap.len / 2 + 2, '#ff3030']]) for (let v = -ap.width / 2; v <= ap.width / 2; v += 3) { const [x, y] = P(u, v); glow.box(x - 0.18, 0.05, y - 0.18, x + 0.18, 0.3, y + 0.18, c); }
    const add = (geos, extraGlow) => { for (const [set, geo] of Object.entries(geos)) { const m = new THREE.Mesh(geo, set === 'glass' ? matGlass : set === 'glow' ? matGlow : matMetal); m.castShadow = set !== 'glow'; m.receiveShadow = true; scene.add(m); } };
    add(k.done()); add(glow.done());
    // avião que decola e pousa
    flyer = { mesh: planeMesh(LIVERIES[(gates.length) % LIVERIES.length]), t: 0, phase: 'wait', ap };
    flyer.mesh.visible = false; scene.add(flyer.mesh);
    state.planes = gates.length + 1; state.ready = true;
  }

  // cerca de ferro: barras com ponta de lança, travessas, montantes e três fios de arame farpado inclinados
  const fenceGeo = (() => {
    const k = Kit(), L = 3;
    for (const y of [0.18, 2.25]) k.box(0, y, -0.03, L, y + 0.06, 0.03, '#2d3236');
    for (let x = 0.12; x < L; x += 0.14) { k.cyl(x, 0, 0, 0.014, 2.4, '#2d3236', 5); const sp = new THREE.ConeGeometry(0.03, 0.12, 5); sp.translate(x, 2.46, 0); k.raw(sp, '#2d3236'); }
    k.box(-0.06, 0, -0.06, 0.06, 2.75, 0.06, '#23272a');
    const arm = new THREE.BoxGeometry(0.04, 0.6, 0.04); arm.rotateX(-0.6); arm.translate(0, 2.95, -0.17); k.raw(arm, '#23272a');
    for (let i = 0; i < 3; i++) k.cylX(0, L, 2.78 + i * 0.16, -0.08 - i * 0.1, 0.008, '#6f7377', 4);
    return k.done().body;
  })();
  function syncFence(cx, cy) {
    const segs = (bridge.world.segs || []).filter(s => s.kind === 'ironfence' && Math.abs(s.x1 - cx) < 170 && Math.abs(s.y1 - cy) < 170);
    if (!fenceMesh || fenceMesh.instanceMatrix.count < segs.length) {
      if (fenceMesh) { scene.remove(fenceMesh); fenceMesh.dispose(); }
      fenceMesh = new THREE.InstancedMesh(fenceGeo, matMetal, Math.max(256, segs.length * 2)); fenceMesh.castShadow = true; fenceMesh.receiveShadow = true; fenceMesh.frustumCulled = false; scene.add(fenceMesh);
    }
    const M = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3();
    segs.forEach((s, i) => { const dx = s.x2 - s.x1, dy = s.y2 - s.y1, l = Math.hypot(dx, dy) || 1; X.set(dx / 3, 0, dy / 3); Z.set(-dy / l, 0, dx / l); M.makeBasis(X, Y, Z); M.setPosition(s.x1, 0, s.y1); fenceMesh.setMatrixAt(i, M); });
    fenceMesh.count = segs.length; fenceMesh.instanceMatrix.needsUpdate = true; state.fence = segs.length;
  }

  // decolagem (oeste -> leste) e pouso (leste -> oeste) alternados
  function fly(dt) {
    const f = flyer, ap = f.ap, m = f.mesh, half = ap.len / 2; f.t += dt;
    const ca = Math.cos(ap.ang), sa = Math.sin(ap.ang), put = (u, h, dir, pitch) => { m.position.set(ap.x + u * ca, h, ap.y + u * sa); m.rotation.set(0, ap.ang + (dir > 0 ? Math.PI / 2 : -Math.PI / 2), 0); m.rotateX(-pitch); };
    if (f.phase === 'wait') { m.visible = false; if (f.t > 35) { f.t = 0; f.phase = f.next === 'land' ? 'land' : 'takeoff'; } }
    else if (f.phase === 'takeoff') {
      m.visible = true; const a = 2.4, s = 0.5 * a * f.t * f.t, u = -half + 50 + s, v = a * f.t, lift = Math.max(0, u - (-half + 50 + 900));
      put(u, lift * 0.14, 1, lift > 0 ? Math.min(0.2, lift * 0.004) : 0); state.flight = 'decolando ' + (v * 3.6 | 0) + ' km/h';
      if (lift > 1800) { f.phase = 'wait'; f.t = 0; f.next = 'land'; }
    } else if (f.phase === 'land') {
      m.visible = true; const v0 = 70, x = 2200 - v0 * f.t, h = Math.max(0, x * 0.055);
      if (x > 0) { put(half - 60 + x, h, -1, 0.05); state.flight = 'pousando'; }
      else { const tt = (-x) / v0, s = v0 * tt - 0.5 * 2.2 * tt * tt, vv = v0 - 2.2 * tt; put(half - 60 - Math.min(s, 1000), 0, -1, 0); if (vv <= 0) { f.phase = 'wait'; f.t = 0; f.next = 'takeoff'; } }
    }
  }

  let last = performance.now() / 1000;
  return {
    state,
    update() {
      const now = performance.now() / 1000, dt = Math.min(0.1, now - last); last = now;
      const L = bridge.world.airportLayout; if (!L) return;
      if (!built) { built = true; try { build(L); } catch (e) { console.error('Aeroporto 3D', e); } }
      const c = bridge.cam, n = (bridge.world.segs || []).length;
      if (Math.hypot(c.x - fenceSync.x, c.y - fenceSync.y) > 25 || n !== fenceSync.n) { fenceSync.x = c.x; fenceSync.y = c.y; fenceSync.n = n; syncFence(c.x, c.y); }
      if (flyer) fly(dt);
      const E = globalThis.ENV, night = E ? E.dark : (bridge.world.night ? 1 : 0);
      matGlow.color.setScalar(0.35 + 1.6 * night);
    },
  };
}
