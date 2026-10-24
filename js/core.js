// core.js — matemática, câmera isométrica giratória, entrada e pincéis com contorno de tinta.
'use strict';

// ?quality=performance mantém a renderização antiga em meia resolução.
const RS = new URLSearchParams(location.search).get('quality') === 'performance' ? 2 : 1;
const RENDER_SCALE = 2 / RS; // mantém o tamanho visual dos objetos ao mudar a resolução
let TILT = 0.5; // inclinação vertical ajustável
let HZ = Math.sqrt(1 - TILT * TILT); // sincronizada com câmera 3D
const INK = VISUAL_REFERENCE.anchors.outline;   // contorno de tinta
const TAU = Math.PI * 2;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeIn = t => t * t;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// RNG determinístico p/ o mundo ficar sempre igual
function mulberry(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---- vetores 3D mínimos ----
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};

// ---- câmera: segue o jogador, gira em torno dele e dá zoom ----
const cam = {
  x: 20, y: 10, ang: Math.PI / 4, zoom: 34,
  tx: 20, ty: 10, tang: Math.PI / 4, tzoom: 34,
  W: 0, H: 0, cos: 1, sin: 0,
  tilt: .5, ttilt: .5,
  update(dt) {
    const k = 1 - Math.exp(-dt * 6);
    this.x = lerp(this.x, this.tx, k);
    this.y = lerp(this.y, this.ty, k);
    this.ang += angDiff(this.ang, this.tang) * (1 - Math.exp(-dt * 9));
    this.zoom = lerp(this.zoom, this.tzoom, 1 - Math.exp(-dt * 10));
    this.tilt = lerp(this.tilt, this.ttilt, 1 - Math.exp(-dt * 8));
    TILT = this.tilt; HZ = Math.sqrt(1 - TILT * TILT);
    this.cos = Math.cos(this.ang); this.sin = Math.sin(this.ang);
  },
  get rotating() { return Math.abs(angDiff(this.ang, this.tang)) > 0.002; },
};

// mundo -> tela. d = profundidade (maior = mais perto da câmera, pinta depois)
function rot(x, y) {
  const dx = x - cam.x, dy = y - cam.y;
  return [cam.cos * dx - cam.sin * dy, cam.sin * dx + cam.cos * dy];
}
function proj(x, y, z = 0) {
  const r = rot(x, y), s = cam.zoom;
  return { x: cam.W / 2 + r[0] * s, y: cam.H / 2 + r[1] * s * TILT - z * s * HZ, d: r[1] };
}
function depthOf(x, y) { return cam.sin * (x - cam.x) + cam.cos * (y - cam.y); }
// tela -> chão num plano de altura z
function unproj(sx, sy, z = 0) {
  const s = cam.zoom;
  const rx = (sx - cam.W / 2) / s;
  const ry = (sy - cam.H / 2 + z * s * HZ) / (s * TILT);
  return [cam.x + cam.cos * rx + cam.sin * ry, cam.y - cam.sin * rx + cam.cos * ry];
}
// direção na tela (dx,dy) -> direção no chão
function screenDirToWorld(dx, dy) {
  return [cam.cos * dx + cam.sin * dy, -cam.sin * dx + cam.cos * dy];
}
// normal do chão virada p/ câmera? (componente de profundidade)
function facingCam(nx, ny) { return cam.sin * nx + cam.cos * ny; }

// ---- luz do sol (fixa no mundo: gira junto com o mapa) ----
const SUN = V.norm([-0.55, -0.75, 0.9]);
window.SUN_DIR = SUN;   // a camada 3D (vehicle-webgl.mjs) usa a mesma direção do sol
function shadeOf(nx, ny, nz = 0) { return clamp(V.dot(V.norm([nx, ny, nz]), SUN), -1, 1); }

// ---- entrada ----
const input = {
  keys: new Set(), mx: 0, my: 0, lmb: false, rmb: false, wheel: 0, pressed: new Set(),
  down(k) { return this.keys.has(k); },
  hit(k) { return this.pressed.has(k); },
  endFrame() { this.pressed.clear(); this.wheel = 0; },
};
addEventListener('keydown', e => {
  if(window.cityCharacterEditorOpen)return;
  if (document.activeElement && document.activeElement.id === 'say') return;
  const k = e.key.toLowerCase();
  if (!input.keys.has(k)) input.pressed.add(k);
  input.keys.add(k);
  if (['tab', ' ', 'pageup', 'pagedown'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => input.keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { input.keys.clear(); input.lmb = input.rmb = false; });
addEventListener('contextmenu', e => e.preventDefault());

// ---- pincéis (estilo chapado + contorno escuro) ----
function poly(g, pts, fill, ink = INK, lw = 1) {
  g.beginPath();
  g.moveTo(pts[0].x ?? pts[0][0], pts[0].y ?? pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x ?? pts[i][0], pts[i].y ?? pts[i][1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (ink) { g.strokeStyle = ink; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); }
}
// membro em cápsula: contorno -> tom de sombra -> tom base deslocado p/ a luz
function limb(g, a, b, r, base, dark, light) {
  g.lineCap = 'round';
  g.strokeStyle = INK; g.lineWidth = r * 2 + 2;
  g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  g.strokeStyle = dark; g.lineWidth = r * 2;
  g.stroke();
  const o = r * 0.3;
  g.strokeStyle = base; g.lineWidth = r * 1.3;
  g.beginPath(); g.moveTo(a.x - o, a.y - o * 0.6); g.lineTo(b.x - o, b.y - o * 0.6); g.stroke();
  if (light && r > 3) {
    g.strokeStyle = light; g.lineWidth = Math.max(1, r * 0.45);
    g.beginPath(); g.moveTo(a.x - o * 1.8, a.y - o); g.lineTo(lerp(a.x, b.x, 0.7) - o * 1.8, lerp(a.y, b.y, 0.7) - o); g.stroke();
  }
}
function dot(g, p, r, fill, ink = INK) {
  if (ink) { g.fillStyle = ink; g.beginPath(); g.arc(p.x, p.y, r + 1, 0, TAU); g.fill(); }
  g.fillStyle = fill; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill();
}
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
// mistura de cores hex
function mix(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const r = Math.round(lerp(a >> 16, b >> 16, t)), gg = Math.round(lerp(a >> 8 & 255, b >> 8 & 255, t)), bb = Math.round(lerp(a & 255, b & 255, t));
  return '#' + ((1 << 24) | (r << 16) | (gg << 8) | bb).toString(16).slice(1);
}
// 3 tons a partir da luz: escuro / base / claro
function tone(base, lit) {
  if (lit > 0.45) return mix(base, VISUAL_REFERENCE.anchors.sunlight, 0.16);
  if (lit > -0.05) return base;
  return mix(base, '#242026', 0.34);
}
