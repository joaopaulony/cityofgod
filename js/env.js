// env.js — ambiente do jogo: sol e lua andando pelo céu conforme o relógio, luz contínua (dia → entardecer
// dourado → noite de luar → amanhecer), vento (calmo, brisa, ventania com rajadas) e neve que cai e acumula.
// game.js chama envTick() a cada quadro; o 2D lê ENV (escurecimento gradual, sombras pela direção do sol em
// SUN, neve no chão e nos telhados) e a camada 3D também (luzes, sombras, vento das plantas, partículas, pássaros).
'use strict';

const WEATHERS = [
  { id: 'calm', name: 'Calmo', wind: 0.1, snow: 0, cloud: 0, weight: 35 },
  { id: 'breeze', name: 'Brisa', wind: 0.4, snow: 0, cloud: 0.08, weight: 40 },
  { id: 'windy', name: 'Ventania', wind: 0.9, snow: 0, cloud: 0.35, weight: 20 },
  { id: 'snow', name: 'Neve', wind: 0.32, snow: 1, cloud: 0.55, weight: 5 },
];
const SUNRISE = 6.5 * 60, SUNSET = 19 * 60, SUN_MAX_EL = 62, MOON_MAX_EL = 48;
const ENV = {
  min: 0, sunEl: 0, moonEl: 0,
  sun: [0, 0, 1], moon: [0, 0, 1],            // direção p/ o astro (x leste, y sul, z cima)
  key: [0, 0, 1], keyEl: 45, keyColor: [1, 0.95, 0.85], keyI: 1, moonLit: false,
  day: 1, dark: 0, golden: 0, twilight: 0, night: false,
  weather: 1, wind: 0.4, windNow: 0.4, gust: 0, windAng: 0.35, windDir: [0.94, 0.34],
  snow: 0, snowCover: 0, cloud: 0, change: 180, t: 0,
};
window.ENV = ENV;   // a camada 3D (módulos) lê por window
const envS = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const envDir = (azDeg, elDeg) => {   // azimute a partir do norte, no sentido horário
  const A = azDeg * Math.PI / 180, E = elDeg * Math.PI / 180;
  return [Math.sin(A) * Math.cos(E), -Math.cos(A) * Math.cos(E), Math.sin(E)];
};
function envWeather() { return WEATHERS[ENV.weather]; }
function envSetWeather(i) { ENV.weather = ((i % WEATHERS.length) + WEATHERS.length) % WEATHERS.length; ENV.change = 150 + Math.random() * 150; }
// sorteia o próximo clima (neve rara)
function envPickWeather() {
  let r = Math.random() * WEATHERS.reduce((s, w) => s + w.weight, 0);
  for (let i = 0; i < WEATHERS.length; i++) { r -= WEATHERS[i].weight; if (r <= 0) return envSetWeather(i); }
  envSetWeather(1);
}

// dt: segundos reais; minutes: relógio do jogo (minutos desde a meia-noite, 1 min de jogo por segundo)
function envTick(dt, minutes) {
  const m = ((minutes % 1440) + 1440) % 1440, E = ENV, W = envWeather();
  E.min = m; E.t += dt;
  // sol: nasce a leste, passa ao sul ao meio-dia (Miami fica no hemisfério norte), se põe a oeste
  const f = (m - SUNRISE) / (SUNSET - SUNRISE);
  E.sunEl = f >= 0 && f <= 1 ? SUN_MAX_EL * Math.sin(f * Math.PI) : -18 * Math.sin(Math.min(1, Math.abs(f < 0 ? f : f - 1) * 3) * Math.PI / 2);
  const sunAz = 90 + clamp(f, -0.15, 1.15) * 180;
  E.sun = envDir(sunAz, Math.max(E.sunEl, 0));
  // lua: sobe a leste no fim da tarde e cruza o céu durante a noite
  const nightLen = 1440 - (SUNSET - SUNRISE), g = (((m - SUNSET + 30) % 1440) + 1440) % 1440 / nightLen;
  E.moonEl = g <= 1 ? MOON_MAX_EL * Math.sin(g * Math.PI) : -10;
  E.moon = envDir(110 + clamp(g, 0, 1) * 150, Math.max(E.moonEl, 0));
  // claridade: crepúsculo civil (sol de -6° a 8°), hora dourada com o sol baixo
  E.day = envS(-6, 8, E.sunEl);
  E.dark = 1 - E.day;
  E.golden = (1 - envS(3, 24, E.sunEl)) * envS(-4, 3, E.sunEl);
  E.twilight = (1 - envS(-1, 6, E.sunEl)) * envS(-9, -1, E.sunEl);
  E.night = E.dark > 0.55;
  // luz principal (a que faz sombra): sol de dia, luar à noite; a sombra nunca fica deitada demais
  E.moonLit = E.sunEl < -3 && E.moonEl > 4;
  if (!E.moonLit) {
    E.keyEl = Math.max(E.sunEl, 13); E.key = envDir(sunAz, E.keyEl);
    const warm = E.golden;
    E.keyColor = [1, lerp(0.96, 0.66, warm), lerp(0.88, 0.42, warm)];
    E.keyI = envS(-3, 9, E.sunEl) * (1 - W.cloud * 0.5);
  } else {
    E.keyEl = Math.max(E.moonEl, 18); E.key = envDir(110 + clamp(g, 0, 1) * 150, E.keyEl);
    E.keyColor = [0.72, 0.8, 1];
    E.keyI = 0.34 * envS(4, 20, E.moonEl) * (1 - W.cloud * 0.6);
  }
  // 2D: SUN (core.js) gira com o astro; o comprimento no chão fica perto do original p/ as sombras pintadas
  const kx = E.key[0], ky = E.key[1], kl = Math.hypot(kx, ky) || 1, L = lerp(0.85, 0.5, envS(13, 62, E.keyEl));
  SUN[0] = kx / kl * L; SUN[1] = ky / kl * L; SUN[2] = Math.sqrt(Math.max(0.05, 1 - L * L));
  // clima: troca sozinho a cada 2,5–5 h de jogo (a tecla K escolhe o próximo)
  E.change -= dt; if (E.change <= 0) envPickWeather();
  const kk = 1 - Math.exp(-dt * 0.35);
  E.wind += (W.wind - E.wind) * kk; E.cloud += (W.cloud - E.cloud) * kk; E.snow += (W.snow - E.snow) * (1 - Math.exp(-dt * 0.5));
  // rajadas: ondas lentas sobrepostas, mais fortes na ventania; a direção do vento passeia devagar
  const t = E.t;
  E.gust = Math.max(0, Math.sin(t * 0.43) * 0.5 + Math.sin(t * 1.13 + 1.7) * 0.3 + Math.sin(t * 2.71 + 0.4) * 0.2) * (0.35 + E.wind);
  E.windNow = E.wind * (0.75 + E.gust * 0.9);
  E.windAng = 0.35 + Math.sin(t * 0.021) * 0.6 + Math.sin(t * 0.0071 + 2) * 0.4;
  E.windDir = [Math.cos(E.windAng), Math.sin(E.windAng)];
  // neve acumula em ~1 min de nevasca e derrete em ~3 min sem neve
  E.snowCover = clamp(E.snowCover + (E.snow > 0.3 ? dt * 0.018 * E.snow : -dt * 0.006), 0, 1);
}

// ---------- 2D ----------
// neve no chão: pontilhado branco ancorado no mundo, sobre o chão e antes de casas, plantas e personagens
let envSnowPat = null;
function envSnowPattern() {
  if (envSnowPat) return envSnowPat;
  const c = makeCanvas(256, 256), g = c.getContext('2d'), r = mulberry(4242);
  g.fillStyle = 'rgba(246,249,252,0.9)'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) { const x = r() * 256, y = r() * 256, s = 3 + r() * 16; g.fillStyle = `rgba(${r() < 0.5 ? '205,215,228' : '255,255,255'},${0.25 + r() * 0.5})`; g.beginPath(); g.ellipse(x, y, s, s * (0.4 + r() * 0.5), r() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`; g.fillRect(r() * 256, r() * 256, 1, 1); }
  return (envSnowPat = c);
}
function drawSnowGround(g, W, H) {
  const k = ENV.snowCover; if (k < 0.01) return;
  const s = cam.zoom, c = cam.cos, sn = cam.sin, ppm = 32;
  const cs = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => unproj(x, y, 0)), xs = cs.map(p => p[0]), ys = cs.map(p => p[1]);
  const x0 = Math.floor(Math.min(...xs) / 8) * 8 - 8, y0 = Math.floor(Math.min(...ys) / 8) * 8 - 8, x1 = Math.max(...xs) + 8, y1 = Math.max(...ys) + 8;
  g.save();
  g.setTransform(s * c / ppm, s * TILT * sn / ppm, -s * sn / ppm, s * TILT * c / ppm, W / 2 + s * (c * (x0 - cam.x) - sn * (y0 - cam.y)), H / 2 + s * TILT * (sn * (x0 - cam.x) + c * (y0 - cam.y)));
  g.globalAlpha = Math.min(0.92, k * 0.95); g.fillStyle = g.createPattern(envSnowPattern(), 'repeat');
  g.fillRect(0, 0, (x1 - x0) * ppm, (y1 - y0) * ppm);
  g.restore();
}
// cor do céu sobre a cena: dourado no fim da tarde, lilás no crepúsculo, cinza com nuvens
function drawSkyTint(g, W, H) {
  const E = ENV;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (E.golden > 0.01) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = `rgba(255,150,60,${(E.golden * 0.36).toFixed(3)})`; g.fillRect(0, 0, W, H); }
  g.globalCompositeOperation = 'source-over';
  if (E.twilight > 0.01) { g.fillStyle = `rgba(110,70,150,${(E.twilight * 0.16).toFixed(3)})`; g.fillRect(0, 0, W, H); }
  if (E.cloud > 0.02) { g.fillStyle = `rgba(118,128,140,${(E.cloud * 0.16 * E.day).toFixed(3)})`; g.fillRect(0, 0, W, H); }
  g.restore();
}
// neve sobre um polígono de tela (água do telhado, laje)
function envSnowPoly(g, pts, up = 1) {
  const k = ENV.snowCover * up; if (k < 0.02) return;
  g.save(); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath();
  g.globalAlpha = Math.min(0.9, k); g.fillStyle = '#f3f6fa'; g.fill(); g.restore();
}
