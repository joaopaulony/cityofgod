// character.js — pinta o esqueleto em 2D: cápsulas chapadas com 2-3 tons e contorno de tinta.
'use strict';

BODY.headR = 0.16;   // cabeça um pouco maior, leitura melhor em tela (como nos sprites de referência)
Object.assign(BODY, { hipZ: 0.85, thigh: 0.42, shin: 0.42, shZ: 1.39, neckZ: 1.5, headZ: 1.66, headR: 0.17 });

const PAL = {
  hero: {   // roupa civil: camiseta branca, jeans, tênis escuro — rosto da referência
    skin: ['#d99a68', '#b5744a', '#efb98a'], hair: ['#4a2618', '#2b140c', '#70402a'],
    top: ['#e9e5dc', '#b8b1a4', '#ffffff'], legs: ['#3f5f8c', '#2c4467', '#5a7eae'],
    shoe: ['#2a2a2f', '#18181b'], sole: '#d8d4cc', belt: '#3a2a1e', sleeve: 0.5, brows: '#2a140c', eyes: '#5a3018',
  },
  red: {
    skin: ['#c98a5c', '#a06640', '#e0a878'], hair: ['#1e1612', '#0f0b09', '#3a2a22'],
    top: ['#b8382f', '#86251f', '#d65a4c'], legs: ['#30343c', '#202329', '#4a4f5a'],
    shoe: ['#f0eee8', '#b9b6ae'], sole: '#7d7a74', belt: '#1b1b1b', sleeve: 0.95, cap: '#c23a2e', brows: '#140d0a', eyes: '#2a1a10',
  },
  girl: {
    skin: ['#e2a77a', '#bd8058', '#f2c49c'], hair: ['#3a2216', '#1f110a', '#5c3826'],
    top: ['#2e2e33', '#1c1c20', '#45454c'], legs: ['#5577a6', '#3d5a85', '#7395c4'],
    shoe: ['#e9e4dc', '#b8b2a8'], sole: '#8a857c', belt: '#2a2a2a', sleeve: 0.3, pony: true, brows: '#2a160e', eyes: '#4a2a18',
  },
};

const pr = p => proj(p[0], p[1], p[2]);
const dW = p => depthOf(p[0], p[1]);

function drawActor(g, a, J, pal) {
  const z = cam.zoom, px = m => Math.max(1, m * z);
  const parts = [];
  // sombra de contato no chão
  const sp = proj(a.x, a.y, 0);
  g.fillStyle = 'rgba(15,20,8,0.35)';
  g.beginPath(); g.ellipse(sp.x + 2, sp.y + 1, 0.42 * z, 0.2 * z, 0, 0, TAU); g.fill();

  for (const s of ['L', 'R']) {
    const hip = J['hip' + s], knee = J['knee' + s], ank = J['ank' + s], toe = J['toe' + s];
    parts.push({ d: dW(V.lerp(hip, ank, 0.5)), f: () => {
      limb(g, pr(hip), pr(knee), px(0.085), pal.legs[0], pal.legs[1], pal.legs[2]);
      limb(g, pr(knee), pr(ank), px(0.072), pal.legs[0], pal.legs[1], pal.legs[2]);
      const A = pr(V.add(ank, [0, 0, -0.03])), T = pr(toe);
      limb(g, A, T, px(0.058), pal.shoe[0], pal.shoe[1]);
      g.strokeStyle = pal.sole; g.lineWidth = Math.max(1, z * 0.025); g.lineCap = 'butt';
      g.beginPath(); g.moveTo(A.x - 1, A.y + px(0.05)); g.lineTo(T.x, T.y + px(0.045)); g.stroke();
    } });
  }
  // pelve (jeans) + tronco (camiseta)
  const torsoD = dW(J.chest);
  parts.push({ d: torsoD - 0.01, f: () => {
    const up = v => V.add(v, [0, 0, 0.09]);
    const crotch = V.add(J.pelvis, [0, 0, -0.12]);
    capsulePoly(g, [pr(up(J.hipL)), pr(up(J.hipR)), pr(J.hipR), pr(crotch), pr(J.hipL)], px(0.075), pal.legs);
  } });
  parts.push({ d: torsoD, f: () => {
    const wL = V.add(J.hipL, [0, 0, 0.13]), wR = V.add(J.hipR, [0, 0, 0.13]);
    const sL = V.lerp(J.shL, J.chest, 0.15), sR = V.lerp(J.shR, J.chest, 0.15);
    capsulePoly(g, [pr(sL), pr(sR), pr(wR), pr(wL)], px(0.115), [pal.top[0], pal.top[1]]);
    const f0 = pr(V.lerp(wL, sL, 0.45)), f1 = pr(V.lerp(wR, sR, 0.45));
    g.strokeStyle = pal.top[1]; g.lineWidth = 1; g.beginPath(); g.moveTo(f0.x, f0.y); g.quadraticCurveTo((f0.x + f1.x) / 2, (f0.y + f1.y) / 2 + 2, f1.x, f1.y); g.stroke();
    // cinto
    const bL = pr(V.add(J.hipL, [0, 0, 0.1])), bR = pr(V.add(J.hipR, [0, 0, 0.1]));
    g.strokeStyle = pal.belt; g.lineWidth = Math.max(1, z * 0.04); g.lineCap = 'round';
    g.beginPath(); g.moveTo(bL.x, bL.y); g.lineTo(bR.x, bR.y); g.stroke();
    // bolsa de carregadores na cintura (esquerda), só o herói armado
    if (a.armed) { const pp = pr(V.add(J.hipL, V.add(V.mul(J.bodyFwd, 0.07), [0, 0, 0.04]))); poly(g, [[pp.x - px(0.05), pp.y - px(0.06)], [pp.x + px(0.05), pp.y - px(0.06)], [pp.x + px(0.05), pp.y + px(0.06)], [pp.x - px(0.05), pp.y + px(0.06)]], '#4d5a3a', INK, 1); }
    // gola quando de frente
    const n = pr(J.neck), facing = facingCam(J.bodyFwd[0], J.bodyFwd[1]);
    if (facing > 0.1) { g.fillStyle = pal.top[1]; g.beginPath(); g.ellipse(n.x, n.y + px(0.04), px(0.07), px(0.035), 0, 0, Math.PI); g.fill(); }
  } });
  // braços (manga + pele) e mãos separadas p/ ficarem por cima do fuzil
  for (const s of ['L', 'R']) {
    const sh = J['sh' + s], el = J['elb' + s], hd = J['hand' + s];
    parts.push({ d: dW(V.lerp(sh, el, 0.5)) + 0.005, f: () => {
      const m = V.lerp(sh, el, pal.sleeve);
      limb(g, pr(el), pr(hd), px(0.055), pal.skin[0], pal.skin[1], pal.skin[2]);
      limb(g, pr(m), pr(el), px(0.058), pal.skin[0], pal.skin[1], pal.skin[2]);
      limb(g, pr(sh), pr(m), px(0.072), pal.top[0], pal.top[1], pal.top[2]);
    } });
    parts.push({ d: dW(hd) + 0.03, f: () => {
      const h = pr(hd);
      dot(g, h, px(0.048), pal.skin[1]); dot(g, { x: h.x - 1, y: h.y - 1 }, Math.max(1, px(0.03)), pal.skin[0], null);
      if (s === 'L' && a.magState === 'hand') limb(g, h, pr(V.add(hd, [0, 0, -0.17])), px(0.03), '#2b2b2e', '#1a1a1c');
    } });
  }
  if (a.armed) parts.push({ d: dW(J.rifle.grip) + 0.01, f: () => drawRifle(g, J.rifle, a, px) });
  parts.push({ d: torsoD + 0.02, f: () => drawHead(g, J, pal, px) });

  parts.sort((p, q) => p.d - q.d);
  for (const p of parts) p.f();
}

// polígono "inchado": contorno grosso arredondado + 2 tons
function capsulePoly(g, pts, r, tones) {
  const path = () => { g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (const p of pts.slice(1)) g.lineTo(p.x, p.y); g.closePath(); };
  g.lineJoin = 'round';
  path(); g.strokeStyle = INK; g.lineWidth = r * 2 + 2; g.stroke();
  g.fillStyle = tones[1]; g.strokeStyle = tones[1]; g.lineWidth = r * 2; g.fill(); g.stroke();
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const o = r * 0.35;
  g.beginPath();
  pts.forEach((p, i) => { const x = lerp(cx, p.x, 0.8) - o, y = lerp(cy, p.y, 0.85) - o * 0.6; i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.closePath(); g.fillStyle = tones[0]; g.strokeStyle = tones[0]; g.lineWidth = r * 1.3; g.fill(); g.stroke();
  if (tones[2] && r > 2) {
    g.strokeStyle = tones[2]; g.lineWidth = Math.max(1, r * 0.4);
    g.beginPath(); g.moveTo(lerp(cx, pts[0].x, 0.75) - o * 1.6, lerp(cy, pts[0].y, 0.75) - o); g.lineTo(lerp(cx, pts[pts.length - 1].x, 0.6) - o * 1.6, lerp(cy, pts[pts.length - 1].y, 0.6) - o); g.stroke();
  }
}

function drawRifle(g, R, a, px) {
  const c = ['#34343a', '#1c1c20', '#55555d'];
  limb(g, pr(R.buttLow), pr(R.butt), px(0.03), c[0], c[1]);
  limb(g, pr(R.butt), pr(R.recv0), px(0.034), c[0], c[1], c[2]);
  if (a.magState === 'in') limb(g, pr(R.magTop), pr(R.magBot), px(0.032), c[0], c[1]);
  limb(g, pr(R.gripTop), pr(R.grip), px(0.022), c[0], c[1]);
  limb(g, pr(R.recv0), pr(R.recv1), px(0.042), c[0], c[1], c[2]);
  limb(g, pr(R.hg0), pr(R.hg1), px(0.034), '#3f4a3a', '#2a3226', '#56634e');
  limb(g, pr(R.hg1), pr(R.muzzle), px(0.014), c[1], c[1]);
  limb(g, pr(R.sightB), pr(R.sight), px(0.02), c[0], c[1]);
}

function drawHead(g, J, pal, px) {
  const r = px(BODY.headR), H = pr(J.head), N = pr(J.neck);
  const hf = J.headFwd, left = V.norm([-hf[1], hf[0], 0]);
  const fx = cam.cos * hf[0] - cam.sin * hf[1], fy = cam.sin * hf[0] + cam.cos * hf[1];   // frente em espaço de tela
  limb(g, N, { x: H.x, y: H.y + r * 0.6 }, px(0.055), pal.skin[0], pal.skin[1]);
  // rabo de cavalo atrás (quando a cabeça está de frente p/ câmera, fica escondido)
  const back = V.add(J.head, V.mul(hf, -BODY.headR * 1.1));
  if (pal.pony) limb(g, pr(V.add(back, [0, 0, 0.02])), pr(V.add(back, [hf[0] * -0.06, hf[1] * -0.06, -0.24])), px(0.06), pal.hair[0], pal.hair[1], pal.hair[2]);

  // cabeça (pele) com contorno
  dot(g, H, r, pal.skin[1]);
  const vis = fy;   // >0 rosto visível
  const fc = { x: H.x + fx * r * 0.45, y: H.y + r * 0.1 + Math.max(0, fy) * r * 0.1 };
  g.fillStyle = pal.skin[0]; g.beginPath(); g.ellipse(fc.x - r * 0.08, fc.y - r * 0.05, r * 0.8, r * 0.85, 0, 0, TAU);
  g.save(); g.beginPath(); g.arc(H.x, H.y, r, 0, TAU); g.clip();
  g.beginPath(); g.ellipse(fc.x - r * 0.08, fc.y - r * 0.05, r * 0.8, r * 0.85, 0, 0, TAU); g.fill();
  g.restore();

  // orelhas
  for (const s of [1, -1]) {
    const e = V.add(V.add(J.head, V.mul(left, s * BODY.headR * 0.95)), V.mul(hf, -0.01));
    if (dW(e) > dW(J.head) - 0.02) { const E = pr(e); dot(g, { x: E.x, y: E.y + r * 0.1 }, Math.max(1, r * 0.22), pal.skin[0]); }
  }
  // cabelo: massa espetada que cobre topo e nuca, deslocada p/ trás do rosto
  const backV = clamp(0.35 - fy * 1.2, 0, 1);   // 0 = rosto p/ câmera, 1 = nuca p/ câmera
  const hc = { x: H.x - fx * r * 0.3, y: H.y - r * 0.38 };
  const spikes = [];
  const n = 13;
  for (let i = 0; i <= n; i++) {
    const t = Math.PI * (0.95 + i / n * 1.1);
    const rr = r * (i % 2 ? 1.32 : 0.92) * (1 + [0, 0, 0.1, 0, 0.22, 0, 0.05, 0, 0.18, 0.3, 0, 0.12, 0, 0][i]);
    spikes.push([hc.x + Math.cos(t) * rr * 1.08, hc.y + Math.sin(t) * rr * 0.95]);
  }
  // borda inferior: na testa fica alta (mostra o rosto); na nuca desce até o pescoço
  const sideB = s => clamp(backV + (s * fx > 0 ? 0 : 0.35 * Math.abs(fx)), 0, 1);
  spikes.push([H.x + r * 1.02, H.y - r * 0.05 + sideB(1) * r * 0.55]);
  spikes.push([H.x + r * 0.5 + fx * r * 0.3, H.y - r * 0.3 + backV * r * 1.05]);
  spikes.push([H.x + fx * r * 0.3, H.y - r * 0.12 + backV * r * 0.95]);
  spikes.push([H.x - r * 0.5 + fx * r * 0.3, H.y - r * 0.3 + backV * r * 1.05]);
  spikes.push([H.x - r * 1.02, H.y - r * 0.05 + sideB(-1) * r * 0.55]);
  poly(g, spikes, pal.hair[0], INK, 1.2);
  // mechas mais claras e franja espetada na testa
  g.fillStyle = pal.hair[2];
  for (let i = 0; i < 3; i++) { const x = hc.x - r * 0.5 + i * r * 0.35, y = hc.y - r * 0.55 + (i % 2) * r * 0.2; g.fillRect(x | 0, y | 0, Math.max(1, r * 0.3), Math.max(1, r * 0.12)); }
  if (vis > -0.1) {
    const fb = { x: H.x + fx * r * 0.4, y: H.y - r * 0.6 };
    poly(g, [[fb.x - r * 0.55, fb.y - r * 0.2], [fb.x - r * 0.32, fb.y + r * 0.3], [fb.x - r * 0.1, fb.y + r * 0.02], [fb.x + r * 0.1, fb.y + r * 0.36], [fb.x + r * 0.3, fb.y], [fb.x + r * 0.55, fb.y + r * 0.18], [fb.x + r * 0.6, fb.y - r * 0.3]], pal.hair[0], null);
    g.strokeStyle = pal.hair[1]; g.lineWidth = 1; g.beginPath(); g.moveTo(fb.x - r * 0.1, fb.y + r * 0.05); g.lineTo(fb.x - r * 0.05, fb.y - r * 0.25); g.stroke();
  }
  if (pal.cap) {
    poly(g, [[H.x - r * 1.05, H.y - r * 0.15], [H.x - r * 0.9, H.y - r * 0.85], [H.x, H.y - r * 1.15], [H.x + r * 0.9, H.y - r * 0.85], [H.x + r * 1.05, H.y - r * 0.15]], pal.cap, INK, 1);
    const b = { x: H.x + fx * r * 1.1, y: H.y - r * 0.25 + fy * r * 0.35 };
    g.fillStyle = INK; g.beginPath(); g.ellipse(b.x, b.y, r * (0.45 + Math.abs(fx) * 0.35), r * 0.24, Math.atan2(fy * 0.5, fx), 0, TAU); g.fill();
    g.fillStyle = mix(pal.cap, '#000000', 0.25); g.beginPath(); g.ellipse(b.x, b.y - 0.5, r * (0.4 + Math.abs(fx) * 0.32), r * 0.18, Math.atan2(fy * 0.5, fx), 0, TAU); g.fill();
  }
  // rosto: sobrancelhas grossas, olhos castanhos, nariz e boca — posicionados em 3D na cabeça
  if (vis > -0.15) {
    const P = (fw, side, up) => pr(V.add(V.add(V.add(J.head, V.mul(hf, BODY.headR * fw)), V.mul(left, side)), [0, 0, up]));
    const eye = Math.max(1, Math.round(r * 0.2));
    for (const s of [1, -1]) {
      const ep = V.add(V.add(J.head, V.mul(hf, BODY.headR * 0.85)), V.mul(left, s * 0.055));
      if (dW(ep) < dW(J.head) - 0.035) continue;
      const E = pr(V.add(ep, [0, 0, -0.005])), B0 = P(0.9, s * 0.085, 0.052), B1 = P(0.95, s * 0.02, 0.04);
      g.strokeStyle = pal.brows; g.lineWidth = Math.max(1.2, r * 0.2); g.lineCap = 'butt';
      g.beginPath(); g.moveTo(B0.x, B0.y); g.lineTo(B1.x, B1.y); g.stroke();
      g.fillStyle = '#f4ede2'; g.fillRect(Math.round(E.x - eye), Math.round(E.y - eye * 0.5), eye * 2, eye + 1);
      g.fillStyle = pal.eyes; g.fillRect(Math.round(E.x - eye * 0.5 + fx * eye * 0.6), Math.round(E.y - eye * 0.5), eye, eye + 1);
      g.fillStyle = INK; g.fillRect(Math.round(E.x - eye), Math.round(E.y - eye * 0.5) - 1, eye * 2, 1);
    }
    const no = P(1.02, 0, -0.03), mo = P(0.9, 0, -0.075);
    g.fillStyle = pal.skin[1]; g.fillRect(Math.round(no.x), Math.round(no.y), Math.max(1, r * 0.18), Math.max(1, r * 0.25));
    if (fy > 0.3) { g.fillStyle = mix(pal.skin[1], '#3a1a10', 0.45); g.fillRect(Math.round(mo.x - r * 0.18), Math.round(mo.y), Math.max(1, r * 0.36), 1); }
  }
}

// ---------- retrato do HUD: pixel art desenhada por código (inspirado na referência) ----------
function paintPortrait(size = 48) {
  const c = makeCanvas(size, size), g = c.getContext('2d'), S = size / 48;
  const P = PAL.hero;
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x * S), Math.round(y * S), Math.ceil(w * S), Math.ceil(h * S)); };
  const pg = (pts, col, ink) => poly(g, pts.map(([x, y]) => [x * S, y * S]), col, ink ? INK : null, S);
  g.fillStyle = '#3d4a3a'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#4b5a46'; for (let i = 0; i < 40; i++) g.fillRect((i * 37 % 48) * S, (i * 23 % 48) * S, 2 * S, 2 * S);
  // pescoço e ombros (camiseta)
  pg([[6, 48], [10, 41], [18, 38], [30, 38], [38, 41], [42, 48]], P.top[0], true);
  pg([[18, 38], [24, 43], [30, 38]], P.skin[1], false);
  px(19, 31, 10, 9, P.skin[1]); px(20, 31, 7, 7, P.skin[0]);
  // cabeça
  pg([[13, 16], [14, 28], [18, 34], [24, 37], [30, 34], [34, 28], [35, 16], [24, 10]], P.skin[0], true);
  pg([[30, 20], [34, 17], [34, 28], [30, 34], [27, 36]], P.skin[1], false);
  px(11, 20, 3, 6, P.skin[1]); px(34, 20, 3, 6, P.skin[1]);   // orelhas
  // cabelo espetado
  pg([[8, 22], [9, 14], [6, 12], [11, 10], [10, 5], [16, 7], [18, 2], [22, 6], [27, 1], [29, 6], [35, 3], [35, 8], [41, 8], [38, 13], [42, 17], [39, 22], [36, 18], [33, 14],
      [32, 19], [29, 14], [26, 21], [24, 15], [21, 20], [20, 14], [16, 19], [14, 16], [12, 23]], P.hair[0], true);
  px(16, 6, 4, 2, P.hair[2]); px(24, 5, 4, 2, P.hair[2]); px(31, 8, 3, 2, P.hair[2]); px(12, 12, 3, 2, P.hair[2]);
  // sobrancelhas, olhos, nariz, boca
  pg([[15, 21], [22, 22], [22, 23.5], [15, 22.6]], P.brows, false);
  pg([[26, 22], [33, 21], [33, 22.6], [26, 23.5]], P.brows, false);
  px(16, 24, 5, 3, '#f1e6d8'); px(27, 24, 5, 3, '#f1e6d8');
  px(18, 24, 2, 3, P.eyes); px(28, 24, 2, 3, P.eyes);
  px(18, 24, 1, 1, '#fff'); px(28, 24, 1, 1, '#fff');
  px(16, 23, 5, 1, INK); px(27, 23, 5, 1, INK);
  px(23, 26, 2, 5, P.skin[1]); px(23, 30, 3, 1, mix(P.skin[1], '#000000', 0.2));
  px(21, 33, 6, 1, '#7a3c2a');
  return c;
}
