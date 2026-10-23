// roofs.js — telhados procedurais: duas águas, quatro águas e laje com platibanda.
// A geometria é calculada uma vez por casa; cada água recebe uma textura própria (telha cerâmica,
// shingle, chapa metálica ou concreto) mapeada no plano inclinado com transformação afim.
'use strict';

const ROOF_O = 0.30;      // beiral das aguas (m)
const ROOF_RAKE = 0.22;   // avancos das empenas (m)
const PITCH = 0.37;       // inclinacao (~20 graus), constante no mundo
const PARAPET = 0.45, PAR_T = 0.15;

function buildRoofGeom(H) {
  if (H.roofKind === 'flat') return { flat: true };
  const z = H.h, o = ROOF_O, rake = ROOF_RAKE;
  // A agua toca a parede exatamente em z=H.h, mesmo com o avancamento do beiral.
  const zm = z - o * PITCH;
  const alongX = (H.x1 - H.x0) >= (H.y1 - H.y0);
  // quadro local: u = ao longo da cumeeira, v = atravessado
  const u0 = (alongX ? H.x0 : H.y0) - rake, u1 = (alongX ? H.x1 : H.y1) + rake;
  const v0 = (alongX ? H.y0 : H.x0) - o, v1 = (alongX ? H.y1 : H.x1) + o, vm = (v0 + v1) / 2;
  const half = (v1 - v0) / 2, top = zm + half * PITCH;
  const P = (u, v, zz) => alongX ? [u, v, zz] : [v, u, zz];
  const faces = [], ridges = [], rakes = [];
  if (H.roofKind === 'hip') {
    const ra = Math.min(u0 + half, (u0 + u1) / 2), rb = Math.max(u1 - half, (u0 + u1) / 2);
    faces.push({ p: [P(u0, v0, zm), P(u1, v0, zm), P(rb, vm, top), P(ra, vm, top)], slope: 1 });
    faces.push({ p: [P(u1, v1, zm), P(u0, v1, zm), P(ra, vm, top), P(rb, vm, top)], slope: 1 });
    faces.push({ p: [P(u0, v1, zm), P(u0, v0, zm), P(ra, vm, top)], slope: 1 });
    faces.push({ p: [P(u1, v0, zm), P(u1, v1, zm), P(rb, vm, top)], slope: 1 });
    if (rb - ra > 0.01) ridges.push([P(ra, vm, top), P(rb, vm, top)]);
    for (const [c, r] of [[P(u0, v0, zm), P(ra, vm, top)], [P(u0, v1, zm), P(ra, vm, top)], [P(u1, v0, zm), P(rb, vm, top)], [P(u1, v1, zm), P(rb, vm, top)]]) ridges.push([c, r]);
  } else {
    faces.push({ p: [P(u0, v0, zm), P(u1, v0, zm), P(u1, vm, top), P(u0, vm, top)], slope: 1 });
    faces.push({ p: [P(u1, v1, zm), P(u0, v1, zm), P(u0, vm, top), P(u1, vm, top)], slope: 1 });
    ridges.push([P(u0, vm, top), P(u1, vm, top)]);
    // Empenas triangulares sob a mesma geometria das aguas. A altura do
    // encontro com a cumeeira nao pode ser reduzida (antes sobrava uma fresta).
    const w0 = alongX ? H.y0 : H.x0, w1 = alongX ? H.y1 : H.x1;
    for (const uu of [alongX ? H.x0 : H.y0, alongX ? H.x1 : H.y1])
      faces.push({ p: [P(uu, w0, z - 0.015), P(uu, w1, z - 0.015), P(uu, vm, top - 0.025)], gable: 1 });
    for (const uu of [u0, u1]) { rakes.push([P(uu, v0, zm), P(uu, vm, top)]); rakes.push([P(uu, v1, zm), P(uu, vm, top)]); }
  }
  const cx = (H.x0 + H.x1) / 2, cy = (H.y0 + H.y1) / 2;
  for (const f of faces) {
    let n = V.norm(V.cross(V.sub(f.p[1], f.p[0]), V.sub(f.p[2], f.p[0])));
    if (f.slope && n[2] < 0) n = V.mul(n, -1);
    if (f.gable) { const c = f.p.reduce((s, q) => V.add(s, q), [0, 0, 0]).map(v => v / f.p.length); if ((c[0] - cx) * n[0] + (c[1] - cy) * n[1] < 0) n = V.mul(n, -1); }
    f.n = n;
    if (f.slope) {   // base do plano p/ textura: a ao longo do beiral, b subindo
      f.e1 = V.norm(V.sub(f.p[1], f.p[0]));
      let e2 = V.cross(n, f.e1); if (e2[2] < 0) e2 = V.mul(e2, -1); f.e2 = e2;
      const ab = f.p.map(q => { const d = V.sub(q, f.p[0]); return [V.dot(d, f.e1), V.dot(d, f.e2)]; });
      f.amin = Math.min(...ab.map(q => q[0])); f.amax = Math.max(...ab.map(q => q[0]));
      f.bmin = Math.min(...ab.map(q => q[1])); f.bmax = Math.max(...ab.map(q => q[1]));
      const hn = Math.hypot(n[0], n[1]) || 1; f.hn = [n[0] / hn, n[1] / hn];
    }
  }
  return { faces, ridges, rakes, top };
}

// sombreamento por normal 3D (luz do sol fixa no mundo)
function shadeOverlay(g, pts, n, k = 1) {
  const lit = V.dot(n, SUN);
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath();
  if (lit < 0.55) { g.fillStyle = `rgba(16,14,34,${clamp((0.55 - lit) * 0.55 * k, 0, 0.6)})`; g.fill(); }
  else { g.fillStyle = `rgba(255,236,196,${clamp((lit - 0.55) * 0.35 * k, 0, 0.2)})`; g.fill(); }
}
// desenha uma textura num plano 3D: origem o, eixos e1 (x da textura) e e2 (y da textura, p/ baixo)
function texPlane(g, img, o, e1, e2, px, clipPts) {
  const O = proj(...o), A = proj(...V.add(o, e1)), B = proj(...V.add(o, e2));
  g.save();
  if (clipPts) { g.beginPath(); clipPts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.clip(); }
  g.imageSmoothingEnabled = true;
  g.transform((A.x - O.x) / px, (A.y - O.y) / px, (B.x - O.x) / px, (B.y - O.y) / px, O.x, O.y);
  g.drawImage(img, 0, 0);
  g.restore();
}

function roofRnd(H, k) { return mulberry(H.seed * 31 + k * 7919); }

// texturas de telhado criadas sob demanda (o desenho e a pré-pintura usam as mesmas funções)
function ensureFaceTex(H, f) {
  if (!f.tex) { const S = H.style; f.tex = paintRoofTex(S.roofMat, S.roofCol, f.amax - f.amin, f.bmax - f.bmin, roofRnd(H, H.roofGeom.faces.indexOf(f)), S.aging); bakeLight(f.tex.getContext('2d'), f.tex.width, f.tex.height, f.n); }
  return f.tex;
}
function ensureSlabTex(H) {
  if (!H.slabTex) { const S = H.style; H.slabTex = paintRoofTex('concrete', S.roofCol, H.x1 - H.x0, H.y1 - H.y0, roofRnd(H, 9), S.aging); bakeLight(H.slabTex.getContext('2d'), H.slabTex.width, H.slabTex.height, [0, 0, 1], 0.6); }
  return H.slabTex;
}
// pré-pintura: cria UMA textura de telhado por chamada; devolve true quando não falta nenhuma
function warmRoofStep(H) {
  if (!H.roofGeom) { H.roofGeom = buildRoofGeom(H); return false; }
  if (H.roofGeom.flat) { if (!H.slabTex) { ensureSlabTex(H); return false; } return true; }
  const f = H.roofGeom.faces.find(f => f.slope && !f.tex);
  if (f) { ensureFaceTex(H, f); return false; }
  return true;
}
function drawPitched(g, H) {
  const R = H.roofGeom, S = H.style;
  const fs = R.faces.map(f => ({ f, d: f.p.reduce((s, q) => s + depthOf(q[0], q[1]) + q[2] * 0.02, 0) / f.p.length }));
  // A empena e parede, portanto deve ficar SEMPRE sob as aguas inclinadas;
  // ordenar tudo pelo centro podia desenhar a parede em cima das telhas.
  fs.sort((a, b) => a.f.gable !== b.f.gable
    ? (a.f.gable ? -1 : 1) : a.d - b.d);
  for (const { f } of fs) {
    const pts = f.p.map(q => proj(...q));
    if (f.gable) {
      if (facingCam(f.n[0], f.n[1]) <= 0) continue;
      const side = sideOf([f.n[0], f.n[1]]), sd = H.sides[side], tex = houseTex(H).ext[side];
      texPlane(g, tex, [sd.a[0], sd.a[1], sd.Hc], [sd.dir[0], sd.dir[1], 0], [0, 0, -1], TEX, pts);
      continue;
    }
    ensureFaceTex(H, f);
    // origem da textura = canto (amin, bmax): x cresce ao longo do beiral, y desce a água
    const o = V.add(V.add(f.p[0], V.mul(f.e1, f.amin)), V.mul(f.e2, f.bmax));
    texPlane(g, f.tex, o, f.e1, V.mul(f.e2, -1), RTEX, pts);
    g.strokeStyle = 'rgba(25,18,14,0.7)'; g.lineWidth = 1;
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.stroke();
  }
  const Z = cam.zoom;
  // testeiras de borda (rake) nas empenas
  for (const [a, b] of R.rakes) {
    const A = proj(...a), B = proj(...b);
    g.lineCap = 'butt'; g.strokeStyle = 'rgba(25,18,14,0.75)'; g.lineWidth = Math.max(2, Z * 0.055) + 1.5; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke();
    g.strokeStyle = S.trim; g.lineWidth = Math.max(1.5, Z * 0.055); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(A.x, A.y + Z * 0.018); g.lineTo(B.x, B.y + Z * 0.018); g.stroke();
  }
  // beiral com espessura + calha nas bordas viradas p/ a câmera
  for (const f of R.faces) {
    if (!f.slope || facingCam(f.hn[0], f.hn[1]) <= 0.02) continue;
    const a = f.p[0], b = f.p[1], dz = 0.095, out = 0.035;
    const fas = [proj(...a), proj(...b), proj(b[0], b[1], b[2] - dz), proj(a[0], a[1], a[2] - dz)];
    poly(g, fas, tone(S.trim, V.dot([f.hn[0], f.hn[1], 0], SUN)), 'rgba(25,18,14,0.8)', 1);
    if (S.roofMat !== 'concrete') {
      const ga = proj(a[0] + f.hn[0] * out, a[1] + f.hn[1] * out, a[2] - 0.1), gb = proj(b[0] + f.hn[0] * out, b[1] + f.hn[1] * out, b[2] - 0.1);
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(25,20,18,0.75)'; g.lineWidth = Math.max(2, Z * 0.055) + 1.5; g.beginPath(); g.moveTo(ga.x, ga.y); g.lineTo(gb.x, gb.y); g.stroke();
      g.strokeStyle = '#9aa0a4'; g.lineWidth = Math.max(1.5, Z * 0.055); g.stroke();
      g.strokeStyle = '#d4d8da'; g.lineWidth = Math.max(1, Z * 0.016); g.beginPath(); g.moveTo(ga.x, ga.y - Z * 0.015); g.lineTo(gb.x, gb.y - Z * 0.015); g.stroke();
    }
  }
  // cumeeira / espigões com peças próprias
  const capCol = S.roofMat === 'ceramic' ? shadeHex(S.roofCol, 0.92) : S.roofMat === 'metal' ? '#b9bec2' : shadeHex(S.roofCol, 0.8);
  for (const [a, b] of R.ridges) {
    const hip = Math.abs(a[2] - b[2]) > 0.1, A = proj(...a), B = proj(...b), w = Math.max(2, Z * (hip ? 0.055 : 0.07));
    g.lineCap = 'butt';
    g.strokeStyle = 'rgba(25,14,10,0.85)'; g.lineWidth = w + 2; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke();
    g.strokeStyle = capCol; g.lineWidth = w; g.stroke();
    g.strokeStyle = 'rgba(255,235,210,0.3)'; g.lineWidth = Math.max(1, w * 0.3); g.beginPath(); g.moveTo(A.x, A.y - w * 0.25); g.lineTo(B.x, B.y - w * 0.25); g.stroke();
    if (S.roofMat === 'ceramic') {   // emendas das peças de cumeeira
      const L = V.len(V.sub(b, a)), n = Math.floor(L / 0.36);
      g.fillStyle = 'rgba(30,12,6,0.55)';
      for (let k = 1; k < n; k++) { const p = proj(...V.lerp(a, b, k / n)); g.fillRect(p.x - 0.5, p.y - w * 0.45, 1.5, w * 0.9); }
    }
  }
}

function drawFlatRoof(g, H) {
  const S = H.style, z = H.h, t = PAR_T, P = PARAPET;
  ensureSlabTex(H);
  const slab = [[H.x0 + t, H.y1 - t, z], [H.x1 - t, H.y1 - t, z], [H.x1 - t, H.y0 + t, z], [H.x0 + t, H.y0 + t, z]];
  const sp = slab.map(q => proj(...q));
  texPlane(g, H.slabTex, [H.x0, H.y0, z], [1, 0, 0], [0, 1, 0], RTEX, sp);
  // faces internas da platibanda (as do fundo, viradas p/ a câmera)
  for (const k of ['N', 'S', 'W', 'E']) {
    const sd = H.sides[k], n = LOCAL_SIDES[k].n;
    if (facingCam(n[0], n[1]) >= 0) continue;
    const a = [sd.a[0] - n[0] * t, sd.a[1] - n[1] * t], b = [a[0] + sd.dir[0] * sd.len, a[1] + sd.dir[1] * sd.len];
    const q = [proj(a[0], a[1], z), proj(b[0], b[1], z), proj(b[0], b[1], z + P), proj(a[0], a[1], z + P)];
    poly(g, q, tone(S.plaster === '#9c4a3b' ? '#9a948a' : S.plaster, -0.1), null);
    const sg = g.createLinearGradient(0, q[0].y, 0, q[3].y); sg.addColorStop(0, 'rgba(0,0,0,0.25)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    poly(g, q, sg, null);
  }
  // equipamentos: caixa d'água, ar-condicionado, tubos de ventilação e ralos
  const items = [], rnd = roofRnd(H, 3);
  if (!H.roofItems) {
    const W = H.x1 - H.x0, D = H.y1 - H.y0;
    H.roofItems = [
      { k: 'tank', x: H.x0 + 1.2 + rnd() * (W - 2.4) * 0.3, y: H.y0 + 1.2 },
      { k: 'ac', x: H.x1 - 1.4, y: H.y0 + D * (0.4 + rnd() * 0.3) },
      { k: 'vent', x: H.x0 + W * 0.6, y: H.y1 - 1.3 }, { k: 'vent', x: H.x0 + W * 0.68, y: H.y1 - 1.6 },
    ];
  }
  for (const d of [[H.x0 + t + 0.25, H.y1 - t - 0.25], [H.x1 - t - 0.25, H.y0 + t + 0.25]]) {
    const p = proj(d[0], d[1], z); g.fillStyle = '#2b2a28'; g.fillRect(p.x - 3, p.y - 1.5, 6, 3); g.fillStyle = '#6b6a66'; g.fillRect(p.x - 2, p.y - 1, 4, 1);
  }
  const its = H.roofItems.slice().sort((a, b) => (a.flat ? -1e9 : depthOf(a.x, a.y)) - (b.flat ? -1e9 : depthOf(b.x, b.y)));
  for (const it of its) {
    if (it.draw) it.draw(g, H, z, it);
    else if (it.k === 'tank') {
      drawBox(g, { x: it.x, y: it.y, z, w: 1.5, d: 1.5, h: 0.25, rot: 0, top: '#a9a59c', side: '#8a867e' });
      drawCyl(g, it.x, it.y, z + 0.25, 0.68, 0.95, '#3c74ad', '#4f88c0');
      const l = proj(it.x, it.y, z + 1.2); g.fillStyle = '#2f5f90'; g.beginPath(); g.ellipse(l.x, l.y, cam.zoom * 0.35, cam.zoom * 0.35 * TILT, 0, 0, TAU); g.fill();
    } else if (it.k === 'ac') {
      drawBox(g, { x: it.x, y: it.y, z, w: 0.9, d: 0.7, h: 0.65, rot: 0, top: '#c9cbcd', side: '#a7aaad', kind: 'ac' });
      const c = proj(it.x, it.y, z + 0.65); g.strokeStyle = '#55595c'; g.lineWidth = 1; g.beginPath(); g.ellipse(c.x, c.y, cam.zoom * 0.26, cam.zoom * 0.26 * TILT, 0, 0, TAU); g.stroke();
    } else drawCyl(g, it.x, it.y, z, 0.07, 0.5, '#7d8286', '#3a3d40');
  }
  // platibandas da frente: redesenha a faixa de cima das paredes por cima da laje
  for (const s of H.segs) if (s.ext && facingCam(s.nx, s.ny) > 0) drawWallSlice(g, s, z, z + P, 0, 1, true);
  // capas de concreto no topo
  for (const k of ['N', 'S', 'W', 'E']) {
    const sd = H.sides[k], n = LOCAL_SIDES[k].n, a = sd.a, b = [a[0] + sd.dir[0] * sd.len, a[1] + sd.dir[1] * sd.len];
    const q = [proj(a[0], a[1], z + P), proj(b[0], b[1], z + P), proj(b[0] - n[0] * t, b[1] - n[1] * t, z + P), proj(a[0] - n[0] * t, a[1] - n[1] * t, z + P)];
    poly(g, q, '#c4bfb3', 'rgba(30,24,20,0.6)', 1);
  }
}

// Telhado translúcido: pré-composição numa região recortada para que as faces
// sobrepostas não somem alphas e o jogo não redesenhe um canvas de tela inteira.
const roofScratch = makeCanvas(1, 1), rsg = roofScratch.getContext('2d');
function roofScreenBounds(H, W, Hh) {
  const border = Math.max(ROOF_O, ROOF_RAKE) + 0.45, padding = Math.max(14, cam.zoom * 0.55);
  const x0 = H.x0 - border, x1 = H.x1 + border;
  const y0 = H.y0 - border, y1 = H.y1 + border;
  const z0 = H.h - 0.5;
  const z1 = H.roofKind === 'flat'
    ? H.h + 1.85
    : H.h + (Math.max(H.x1 - H.x0, H.y1 - H.y0) / 2 + border) * PITCH + 0.65;
  let lx = Infinity, rx = -Infinity, ty = Infinity, by = -Infinity;
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) {
    const p = proj(x, y, z);
    lx = Math.min(lx, p.x); rx = Math.max(rx, p.x);
    ty = Math.min(ty, p.y); by = Math.max(by, p.y);
  }
  const left = Math.max(0, Math.floor(lx - padding));
  const top = Math.max(0, Math.floor(ty - padding));
  return { x: left, y: top,
    w: Math.min(W, Math.ceil(rx + padding)) - left,
    h: Math.min(Hh, Math.ceil(by + padding)) - top };
}
function drawRoof(g, H) {
  if (H.inside) return;
  if (!H.fade) { drawRoofInner(g, H); return; }
  const b = roofScreenBounds(H, g.canvas.width, g.canvas.height);
  if (b.w <= 0 || b.h <= 0) return;
  if (roofScratch.width !== b.w || roofScratch.height !== b.h) {
    roofScratch.width = b.w; roofScratch.height = b.h;
  }
  rsg.setTransform(1, 0, 0, 1, 0, 0);
  rsg.clearRect(0, 0, b.w, b.h);
  rsg.setTransform(1, 0, 0, 1, -b.x, -b.y);
  drawRoofInner(rsg, H);
  g.save();
  g.globalAlpha *= 0.33;
  g.drawImage(roofScratch, b.x, b.y);
  g.restore();
}
function drawRoofInner(g, H) {
  if (!H.roofGeom) H.roofGeom = buildRoofGeom(H);
  if (H.roofGeom.flat) drawFlatRoof(g, H); else drawPitched(g, H);
  urbanDrawRooftopDetails(g,H,typeof T==='number'?T:0);
}
