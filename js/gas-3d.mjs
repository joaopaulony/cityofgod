// gas-3d.mjs — postos de gasolina na camada WebGL (o chão pintado, as colisões e o registro vêm de parking.js).
// Cada posto: cobertura com faixa da bandeira e luzes embutidas, colunas, ilhas de concreto com frades amarelos,
// bombas com visor, bicos e mangueiras, loja de conveniência com vitrine de vidro (prateleiras e geladeiras
// visíveis por dentro, acesas à noite), letreiro e totem de preços em LED. Montado perto da câmera, desfeito longe.
import {makeKit} from './kit-3d.mjs';

export function createGas3D(THREE, scene, bridge) {
  const Kit = makeKit(THREE), state = { built: 0 };
  const matBody = new THREE.MeshLambertMaterial({ vertexColors: true });
  const matGlow = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
  const matGlass = new THREE.MeshPhongMaterial({ color: 0x8fb3c4, specular: 0xffffff, shininess: 90, transparent: true, opacity: 0.38, depthWrite: false });
  const matInside = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
  const built = new Map(), texCache = [];
  const sRGB = c => { c.colorSpace = THREE.SRGBColorSpace; c.anisotropy = 4; return c; };

  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = sRGB(new THREE.CanvasTexture(c)); texCache.push(t); return t; }
  // painel plano com textura nas duas faces (ângulo = direção da normal no chão)
  function panel(grp, tex, w, h, x, y, z, nx, nz, emissive) {
    const m = new THREE.MeshLambertMaterial({ map: tex, emissive: emissive ? 0xffffff : 0x000000, emissiveMap: emissive ? tex : null, emissiveIntensity: 0 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.y = Math.atan2(nx, nz); grp.add(p);
    if (emissive) (grp.userData.lit || (grp.userData.lit = [])).push(m);
    return p;
  }
  function brandTex(b, w, h, text) {
    return canvasTex(w, h, (g, W, H) => {
      g.fillStyle = b.a; g.fillRect(0, 0, W, H); g.fillStyle = b.b; g.fillRect(0, H * 0.78, W, H * 0.1);
      g.fillStyle = b.text; g.font = `900 ${H * 0.52}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, H * 0.42);
    });
  }
  function priceTex(st) {
    return canvasTex(256, 384, (g, W, H) => {
      g.fillStyle = st.brand.a; g.fillRect(0, 0, W, 120);
      g.beginPath(); g.arc(W / 2, 54, 40, 0, Math.PI * 2); g.fillStyle = st.brand.b; g.fill();
      g.fillStyle = st.brand.a; g.font = '900 34px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(st.brand.name[0], W / 2, 56);
      g.fillStyle = st.brand.text; g.font = '800 20px Arial'; g.fillText(st.brand.name, W / 2, 107);
      g.fillStyle = '#111316'; g.fillRect(0, 120, W, H - 120);
      st.prices.forEach(([name, p], i) => {
        const y = 150 + i * 58; g.fillStyle = '#f0ede4'; g.font = '700 19px Arial'; g.textAlign = 'left'; g.fillText(name, 14, y + 10);
        const [a, b] = p.toFixed(2).split('.'); g.fillStyle = i === 3 ? '#4cff7a' : '#ff3d2e'; g.font = '700 38px "Courier New", monospace'; g.textAlign = 'right';
        g.fillText(a + '.' + b, W - 34, y + 12); g.font = '700 18px "Courier New", monospace'; g.fillText('9', W - 14, y);
      });
      g.fillStyle = '#f0ede4'; g.font = '600 15px Arial'; g.textAlign = 'center'; g.fillText('US$ / GALÃO  ·  ABERTO 24H', W / 2, H - 14);
    });
  }

  function build(st) {
    const grp = new THREE.Group(), body = Kit(), glow = Kit(), inside = Kit(), b = st.brand;
    const U = (u, v) => [st.ox + st.qx * u, st.oy + st.qy * v];
    // caixa nas coordenadas do lote (u,v) com altura y0..y1
    const box = (k, u0, v0, u1, v1, y0, y1, c, r = 0, set) => { const a = U(u0, v0), q = U(u1, v1); return k.box(Math.min(a[0], q[0]), y0, Math.min(a[1], q[1]), Math.max(a[0], q[0]), y1, Math.max(a[1], q[1]), c, r, set); };
    const cyl = (k, u, v, r, y0, y1, c, seg = 12) => { const p = U(u, v); return k.cyl(p[0], y0, p[1], r, y1, c, seg); };
    const C = st.canopy, H = C.h;
    // cobertura: laje branca, faixa da bandeira em volta, rufo e luminárias embutidas no forro
    box(body, C.u0, C.v0, C.u1, C.v1, H, H + 0.18, '#f1f1ef');
    box(body, C.u0 - 0.06, C.v0 - 0.06, C.u1 + 0.06, C.v1 + 0.06, H + 0.18, H + 0.92, b.a);
    box(body, C.u0 - 0.08, C.v0 - 0.08, C.u1 + 0.08, C.v1 + 0.08, H + 0.74, H + 0.82, b.b);
    box(body, C.u0 - 0.1, C.v0 - 0.1, C.u1 + 0.1, C.v1 + 0.1, H + 0.92, H + 0.98, '#d9d9d6');
    // cobertura vista de cima: manta cinza rebaixada dentro da platibanda, rufos e alçapões de manutenção
    box(body, C.u0 + 0.25, C.v0 + 0.25, C.u1 - 0.25, C.v1 - 0.25, H + 0.98, H + 1.0, '#b9bbbd');
    for (const [a0, a1, b0, b1] of [[C.u0 - 0.1, C.u1 + 0.1, C.v0 - 0.1, C.v0 + 0.25], [C.u0 - 0.1, C.u1 + 0.1, C.v1 - 0.25, C.v1 + 0.1], [C.u0 - 0.1, C.u0 + 0.25, C.v0, C.v1], [C.u1 - 0.25, C.u1 + 0.1, C.v0, C.v1]]) box(body, a0, b0, a1, b1, H + 0.98, H + 1.12, '#eeeeec');
    for (let u = C.u0 + 3; u < C.u1 - 2; u += 6) box(body, u, (C.v0 + C.v1) / 2 - 0.6, u + 1.2, (C.v0 + C.v1) / 2 + 0.6, H + 1.0, H + 1.16, '#a3a6a8');
    for (let u = C.u0 + 2; u < C.u1 - 1; u += 3) for (let v = C.v0 + 2; v < C.v1 - 1; v += 3.2) box(glow, u - 0.45, v - 0.45, u + 0.45, v + 0.45, H - 0.03, H, '#fffbe8');
    // ilhas, colunas, bombas, frades e lixeiras
    for (const is of st.islands) {
      box(body, is.u - 0.65, is.v0, is.u + 0.65, is.v1, 0, 0.22, '#c9c6bf', 0.05);
      box(body, is.u - 0.6, is.v0 + 0.05, is.u + 0.6, is.v1 - 0.05, 0.22, 0.24, '#8d8a84');
      for (const v of [is.v0 + 0.5, is.v1 - 0.5]) {
        box(body, is.u - 0.18, v - 0.15, is.u + 0.18, v + 0.15, 0.24, H, '#e9e9e6');
        box(body, is.u - 0.24, v - 0.21, is.u + 0.24, v + 0.21, 0.24, 1.25, b.a);
      }
      for (const v of [is.v0 - 0.35, is.v1 + 0.35]) { cyl(body, is.u, v, 0.11, 0, 0.95, '#f2c230'); cyl(body, is.u, v, 0.115, 0.55, 0.7, '#202020'); }
      for (const v of [8.2, 10.3]) pump(body, glow, is.u, v);
    }
    function pump(k, gk, u, v) {
      box(k, u - 0.32, v - 0.45, u + 0.32, v + 0.45, 0.24, 0.42, '#3b3d40');
      box(k, u - 0.28, v - 0.42, u + 0.28, v + 0.42, 0.42, 1.62, '#eceae6', 0.03);
      box(k, u - 0.3, v - 0.44, u + 0.3, v + 0.44, 1.62, 2.0, b.a, 0.03);
      box(gk, u - 0.31, v - 0.3, u + 0.31, v + 0.3, 1.72, 1.9, b.b);
      for (const s of [-1, 1]) {
        box(k, u + s * 0.281, v - 0.24, u + s * 0.29, v + 0.24, 1.18, 1.5, '#15181b');     // visor
        box(gk, u + s * 0.292, v - 0.2, u + s * 0.296, v + 0.04, 1.3, 1.44, '#7dffb0');
        for (const [dv, c] of [[-0.3, '#2b2b2b'], [0.3, '#2b2b2b']]) {
          box(k, u + s * 0.29, v + dv - 0.06, u + s * 0.38, v + dv + 0.06, 0.95, 1.12, c);     // bico no coldre
          const p0 = U(u + s * 0.33, v + dv), hose = new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6); hose.translate(p0[0], 1.5, p0[1]); k.raw(hose, '#151515');
        }
        for (let i = 0; i < 3; i++) box(k, u + s * 0.285, v - 0.33 + i * 0.12, u + s * 0.3, v - 0.25 + i * 0.12, 0.82, 0.9, ['#e2c13a', '#d23b2f', '#2f6fd2'][i]);
      }
    }
    // loja de conveniência: vitrine na frente (lado do pátio), letreiro, platibanda, máquinas no telhado
    const S = st.store, h = S.h;
    box(body, S.u0, S.v0 + 0.25, S.u1, S.v1, 0, h, '#e6dccb');
    box(body, S.u0 - 0.15, S.v0, S.u1 + 0.15, S.v1 + 0.15, h, h + 0.55, '#d4c8b2');
    box(body, S.u0 - 0.2, S.v0 - 0.05, S.u1 + 0.2, S.v1 + 0.2, h + 0.55, h + 0.62, '#9c958a');
    box(body, S.u0, S.v0, S.u1, S.v0 + 0.25, 0, 0.5, '#b8ab96');
    box(body, S.u0, S.v0, S.u1, S.v0 + 0.25, 3.15, h, b.a);
    // faixa da bandeira contornando a loja e janelas altas nas laterais (a loja se lê de qualquer lado)
    box(body, S.u0 - 0.02, S.v0 + 0.25, S.u0, S.v1, 3.15, h, b.a); box(body, S.u1, S.v0 + 0.25, S.u1 + 0.02, S.v1, 3.15, h, b.a); box(body, S.u0, S.v1, S.u1, S.v1 + 0.02, 3.15, h, b.a);
    box(body, S.u0 - 0.02, S.v0 + 0.25, S.u0, S.v1, 3.02, 3.15, b.b); box(body, S.u1, S.v0 + 0.25, S.u1 + 0.02, S.v1, 3.02, 3.15, b.b); box(body, S.u0, S.v1, S.u1, S.v1 + 0.02, 3.02, 3.15, b.b);
    for (const [su, sgn] of [[S.u0, -1], [S.u1, 1]]) for (let v = S.v0 + 1.2; v < S.v1 - 1.5; v += 2.2) { box(body, su + sgn * 0.03 - 0.02, v, su + sgn * 0.03 + 0.02, v + 1.6, 1.0, 2.6, '#4a4f55'); box(glow, su + sgn * 0.05 - 0.01, v + 0.08, su + sgn * 0.05 + 0.01, v + 1.52, 1.08, 2.52, '#9fc3d6'); }
    box(body, S.u0, S.v0 - 0.02, S.u1, S.v0 + 0.25, 3.05, 3.15, b.b);
    const gl0 = S.u0 + 1.2, gl1 = S.u1 - 1.2;
    for (let u = gl0; u <= gl1 + 0.01; u += (gl1 - gl0) / 12) box(body, u - 0.05, S.v0 - 0.02, u + 0.05, S.v0 + 0.06, 0.5, 3.05, '#4a4f55');
    box(body, gl0, S.v0 - 0.02, gl1, S.v0 + 0.06, 0.5, 0.6, '#4a4f55'); box(body, gl0, S.v0 - 0.02, gl1, S.v0 + 0.06, 2.95, 3.05, '#4a4f55');
    { const a = U(gl0, S.v0 + 0.02), q = U(gl1, S.v0 + 0.02); const gw = Math.abs(q[0] - a[0]), gm = new THREE.Mesh(new THREE.PlaneGeometry(gw, 2.4), matGlass);
      gm.position.set((a[0] + q[0]) / 2, 1.8, a[1]); gm.rotation.y = st.qy > 0 ? Math.PI : 0; grp.add(gm); }
    // por dentro: piso claro, forro iluminado, gôndolas, geladeiras no fundo e o caixa
    box(inside, S.u0 + 0.3, S.v0 + 0.3, S.u1 - 0.3, S.v1 - 0.3, 0.01, 0.03, '#ece9e2');
    box(inside, S.u0 + 0.3, S.v0 + 0.3, S.u1 - 0.3, S.v1 - 0.3, 3.0, 3.05, '#fbf8ee');
    for (let k = 0; k < 4; k++) { const u = S.u0 + 5 + k * 3.6; box(inside, u - 0.45, S.v0 + 2.6, u + 0.45, S.v1 - 2.4, 0.03, 1.6, ['#c8463c', '#e9b23a', '#3f7fbf', '#5fa35a'][k]); }
    box(inside, S.u0 + 0.4, S.v1 - 1.2, S.u1 - 0.4, S.v1 - 0.4, 0.03, 2.2, '#dfe8ee');
    box(inside, S.u1 - 4.8, S.v0 + 1.0, S.u1 - 1.4, S.v0 + 1.8, 0.03, 1.05, '#6b5a48');
    for (let u = S.u0 + 6; u < S.u1 - 4; u += 6) box(glow, u - 0.6, S.v1 - 1.25, u + 0.6, S.v1 - 1.2, 0.3, 2.1, '#d9f2ff');
    // telhado: condensadoras e exaustor; porta de serviço e lixeira no fundo
    for (const u of [S.u0 + 4, S.u0 + 7.5]) box(body, u, S.v0 + 3, u + 2, S.v0 + 4.4, h + 0.0, h + 1.0, '#b9bcbd', 0.04);
    box(body, S.u1 - 3, S.v1 - 3, S.u1 - 2, S.v1 - 2, h, h + 0.7, '#8f9294');
    box(body, S.u0 + 2, S.v1 - 0.02, S.u0 + 3.1, S.v1 + 0.05, 0, 2.2, '#5f6a70');
    // bombas de ar/água, freezer de gelo e gaiola de gás
    { const a = 31.7, v = 19.55; box(body, a - 0.5, v - 0.35, a + 0.5, v + 0.35, 0, 1.45, '#c8302a', 0.04); box(glow, a - 0.3, v - 0.36, a + 0.3, v - 0.35, 1.0, 1.25, '#f6f1d0'); }
    box(body, 30.3, 21.6, 31.5, 22.6, 0, 1.3, '#f4f6f8', 0.04); box(body, 30.3, 21.58, 31.5, 21.6, 0.8, 1.15, '#2f6fd2');
    box(body, 5.0, 22, 5.8, 23.6, 0, 0.08, '#9ea2a5');
    for (let k = 0; k < 4; k++) cyl(body, 5.2 + (k % 2) * 0.4, 22.3 + ((k / 2) | 0) * 0.7, 0.16, 0.08, 1.0, '#e8eef4');
    for (const [u0, v0, u1, v1] of [[5.0, 22, 5.8, 22.04], [5.0, 23.56, 5.8, 23.6], [5.0, 22, 5.04, 23.6], [5.76, 22, 5.8, 23.6]]) box(body, u0, v0, u1, v1, 0.08, 1.6, '#7c8185');
    // frades amarelos protegendo a vitrine
    for (let u = S.u0 + 1; u < S.u1; u += 2.7) cyl(body, u, S.v0 - 1.3, 0.1, 0, 0.9, '#f2c230');
    // totem: base de concreto, pilar na cor da bandeira, logo e preços em LED
    const T = st.sign, tp = U(T.u, T.v);
    box(body, T.u - 0.55, T.v - 1.4, T.u + 0.55, T.v + 1.4, 0, 0.55, '#b9b4aa');
    box(body, T.u - 0.25, T.v - 1.2, T.u + 0.25, T.v + 1.2, 0.55, 7.2, b.a);
    box(body, T.u - 0.27, T.v - 1.25, T.u + 0.27, T.v + 1.25, 7.2, 7.32, '#e3e3e0');
    const mk = (geos, mat, shadow = true) => { for (const g of Object.values(geos)) { const m = new THREE.Mesh(g, mat); m.castShadow = shadow; m.receiveShadow = true; grp.add(m); } };
    mk(body.done(), matBody); mk(glow.done(), matGlow, false); mk(inside.done(), matInside, false);
    const pt = priceTex(st);
    for (const s of [-1, 1]) panel(grp, pt, 2.2, 3.3, tp[0] + st.qx * s * 0.26, 4.6, tp[1], st.qx * s, 0, true);
    // nome da bandeira nas faces da cobertura e "CONVENIÊNCIA 24H" na loja
    const ft = brandTex(b, 1024, 64, b.name), cu = (C.u0 + C.u1) / 2, cv = (C.v0 + C.v1) / 2, cp = U(cu, cv);
    for (const s of [-1, 1]) {
      const pv = U(cu, s < 0 ? C.v0 - 0.08 : C.v1 + 0.08); panel(grp, ft, (C.u1 - C.u0) * 0.8, 0.66, pv[0], H + 0.5, pv[1], 0, st.qy * s, true);
      const pu = U(s < 0 ? C.u0 - 0.08 : C.u1 + 0.08, cv); panel(grp, ft, (C.v1 - C.v0) * 0.8, 0.5, pu[0], H + 0.46, pu[1], st.qx * s, 0, true);
    }
    const stt = brandTex(b, 1024, 96, 'CONVENIÊNCIA  ·  24H'), sp = U((S.u0 + S.u1) / 2, S.v0 - 0.01);
    panel(grp, stt, (S.u1 - S.u0) * 0.7, 0.85, sp[0], 3.7, sp[1], 0, -st.qy, true);
    // luz de verdade sob a cobertura (pátio claro à noite) e na vitrine da loja
    grp.userData.lights = [];
    for (const is of st.islands) { const p = U(is.u, (is.v0 + is.v1) / 2), l = new THREE.PointLight(0xfff3dc, 0, 17, 1.4); l.position.set(p[0], H - 0.35, p[1]); grp.add(l); grp.userData.lights.push([l, 38]); }
    { const p = U((S.u0 + S.u1) / 2, S.v0 - 1.5), l = new THREE.PointLight(0xe8f4ff, 0, 12, 1.6); l.position.set(p[0], 2.6, p[1]); grp.add(l); grp.userData.lights.push([l, 14]); }
    scene.add(grp);
    return grp;
  }
  function dispose(grp) {
    scene.remove(grp);
    grp.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== matBody && o.material !== matGlow && o.material !== matGlass && o.material !== matInside) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } } });
  }
  let tick = 0;
  return {
    state,
    update() {
      const c = bridge.cam, list = bridge.world.gasStations || [];
      if ((tick = (tick + 1) % 20) === 0) {
        const seen = new Set();
        for (const st of list) { const cx = st.ox + st.qx * st.w / 2, cy = st.oy + st.qy * st.d / 2; if (Math.hypot(cx - c.x, cy - c.y) > 170) continue; seen.add(st); if (!built.has(st)) built.set(st, build(st)); }
        for (const [st, g] of built) if (!seen.has(st)) { dispose(g); built.delete(st); }
        state.built = built.size;
      }
      // à noite: forro da cobertura, letreiros e o interior da loja acendem
      const E = globalThis.ENV, night = E ? E.dark : (bridge.world.night ? 1 : 0), dusk = Math.min(1, night * 1.6);
      matGlow.emissive.setRGB(0.15 + 1.1 * dusk, 0.15 + 1.08 * dusk, 0.14 + 0.95 * dusk);
      matInside.emissive.setRGB(0.25 * dusk, 0.25 * dusk, 0.22 * dusk);
      matGlass.opacity = 0.38 - 0.12 * dusk;
      for (const g of built.values()) { for (const m of g.userData.lit || []) m.emissiveIntensity = 0.25 + 1.5 * dusk; for (const [l, k] of g.userData.lights || []) l.intensity = k * dusk; }
    },
  };
}
