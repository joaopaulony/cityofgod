// env.js — ambiente do jogo: sol e lua andando pelo céu conforme o relógio, luz contínua (dia → entardecer
// dourado → noite de luar → amanhecer), vento (calmo, brisa, ventania com rajadas) e neve que cai e acumula.
// game.js chama envTick() a cada quadro; o 2D lê ENV (escurecimento gradual, sombras pela direção do sol em
// SUN, neve no chão e nos telhados) e a camada 3D também (luzes, sombras, vento das plantas, partículas, pássaros).
'use strict';

const WEATHERS = [
  {id:'calm',name:'Céu limpo',wind:.1,snow:0,rain:0,cloud:0,weight:28},
  {id:'breeze',name:'Brisa',wind:.4,snow:0,rain:0,cloud:.08,weight:27},
  {id:'windy',name:'Ventania',wind:.9,snow:0,rain:0,cloud:.35,weight:9},
  {id:'drizzle',name:'Garoa',wind:.2,snow:0,rain:.32,cloud:.6,weight:10},
  {id:'rain',name:'Chuva',wind:.42,snow:0,rain:.78,cloud:.82,weight:15},
  {id:'storm',name:'Tempestade',wind:.85,snow:0,rain:1,cloud:1,weight:7},
  {id:'snow',name:'Neve',wind:.32,snow:.72,rain:0,cloud:.65,weight:3},
  {id:'blizzard',name:'Nevasca',wind:.9,snow:1,rain:0,cloud:.96,weight:1},
  {id:'fog',name:'Neblina',wind:.08,snow:0,rain:0,cloud:.58,weight:5},
];
const SEASONAL_WEIGHT={
 'inverno':{rain:1,drizzle:1.25,storm:.65,snow:2.1,blizzard:1.1,fog:1.3},
 'primavera':{rain:1.3,drizzle:1.2,storm:1,snow:0,blizzard:0},
 'verão':{rain:1.8,drizzle:1.3,storm:1.8,snow:0,blizzard:0,fog:.6},
 'outono':{rain:1.1,drizzle:1.5,storm:.8,snow:0,blizzard:0,fog:1.5}
};
const SUNRISE = 6.5 * 60, SUNSET = 19 * 60, SUN_MAX_EL = 62, MOON_MAX_EL = 48;
const ENV = {
  min: 0, sunEl: 0, moonEl: 0,
  sun: [0, 0, 1], moon: [0, 0, 1],            // direção p/ o astro (x leste, y sul, z cima)
  key: [0, 0, 1], keyEl: 45, keyColor: [1, 0.95, 0.85], keyI: 1, moonLit: false,
  day: 1, dark: 0, golden: 0, twilight: 0, night: false,
  weather:1,wind:.4,windNow:.4,gust:0,windAng:.35,windDir:[.94,.34],
  rain:0,snow:0,snowCover:0,wetness:0,cloud:0,temperature:20,
  season:'inverno',date:'',dayOfYear:1,change:180,t:0,
};
window.ENV = ENV;   // a camada 3D (módulos) lê por window
const envS = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const envDir = (azDeg, elDeg) => {   // azimute a partir do norte, no sentido horário
  const A = azDeg * Math.PI / 180, E = elDeg * Math.PI / 180;
  return [Math.sin(A) * Math.cos(E), -Math.cos(A) * Math.cos(E), Math.sin(E)];
};
function envWeather() { return WEATHERS[ENV.weather]; }
function envSetWeather(i){
  const n=typeof i==='string'?WEATHERS.findIndex(w=>w.id===i):i;
  if(!Number.isInteger(n)||n<0)return false;
  ENV.weather=((n%WEATHERS.length)+WEATHERS.length)%WEATHERS.length;
  ENV.change=150+Math.random()*150;return envWeather();
}
function envPickWeather(){
 const weights=SEASONAL_WEIGHT[ENV.season]||{};
 const values=WEATHERS.map(w=>Math.max(0,w.weight*(weights[w.id]??1)));
 let r=Math.random()*values.reduce((a,b)=>a+b,0);
 for(let i=0;i<values.length;i++){r-=values[i];if(r<=0)return envSetWeather(i);}
 return envSetWeather('breeze');
}

// dt: segundos reais; minutes: relógio do jogo (minutos desde a meia-noite, 1 min de jogo por segundo)
function envTick(dt, minutes) {
  const m=((minutes%1440)+1440)%1440,E=ENV,W=envWeather();
  const date=globalThis.CityCalendar?.get();
  E.min=m;E.t+=dt;E.season=date?.season||E.season;E.date=date?.iso||E.date;
  E.dayOfYear=date?.dayOfYear||E.dayOfYear;
  // Miami/northern hemisphere: solstice changes daylight by up to 150 min.
  const shift=75*Math.cos(2*Math.PI*(E.dayOfYear-172)/365.2425);
  const sunrise=SUNRISE-shift,sunset=SUNSET+shift;
  const f=(m-sunrise)/(sunset-sunrise);
  E.sunEl = f >= 0 && f <= 1 ? SUN_MAX_EL * Math.sin(f * Math.PI) : -18 * Math.sin(Math.min(1, Math.abs(f < 0 ? f : f - 1) * 3) * Math.PI / 2);
  const sunAz = 90 + clamp(f, -0.15, 1.15) * 180;
  E.sun = envDir(sunAz, Math.max(E.sunEl, 0));
  // lua: sobe a leste no fim da tarde e cruza o céu durante a noite
  const nightLen=1440-(sunset-sunrise),g=(((m-sunset+30)%1440)+1440)%1440/nightLen;
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
  E.wind+=(W.wind-E.wind)*kk;E.cloud+=(W.cloud-E.cloud)*kk;
  const change=1-Math.exp(-dt*.55);
  E.snow+=(W.snow-E.snow)*change;E.rain+=(W.rain-E.rain)*change;
  const baseTemp=({'inverno':9,'primavera':20,'verão':29,'outono':18})[E.season]||20;
  E.temperature=W.snow>0?Math.min(-2,baseTemp-11):
    +(baseTemp+3*Math.cos((m-14*60)/1440*2*Math.PI)-(W.rain?3:0)).toFixed(1);
  // rajadas: ondas lentas sobrepostas, mais fortes na ventania; a direção do vento passeia devagar
  const t = E.t;
  E.gust = Math.max(0, Math.sin(t * 0.43) * 0.5 + Math.sin(t * 1.13 + 1.7) * 0.3 + Math.sin(t * 2.71 + 0.4) * 0.2) * (0.35 + E.wind);
  E.windNow = E.wind * (0.75 + E.gust * 0.9);
  E.windAng = 0.35 + Math.sin(t * 0.021) * 0.6 + Math.sin(t * 0.0071 + 2) * 0.4;
  E.windDir = [Math.cos(E.windAng), Math.sin(E.windAng)];
  E.wetness=clamp(E.wetness+dt*(E.rain>.08?.011*E.rain:-.0025),0,1);
  E.snowCover=clamp(E.snowCover+dt*(E.snow>.3&&E.temperature<=1?.012*E.snow:
     -(E.temperature>3?.007:.0015)-(E.rain>.1?.014*E.rain:0)),0,1);
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
  const covered=globalThis.CityShelter?.regions(cam.x,cam.y,Math.max(x1-x0,y1-y0))||[];
  if(covered.length){
   g.beginPath();g.rect(0,0,(x1-x0)*ppm,(y1-y0)*ppm);
   for(const poly of covered){if(poly.length<3)continue;
    poly.forEach((p,i)=>i?g.lineTo((p[0]-x0)*ppm,(p[1]-y0)*ppm):
      g.moveTo((p[0]-x0)*ppm,(p[1]-y0)*ppm));g.closePath();
   }
   g.clip('evenodd');
  }
  g.globalAlpha = Math.min(0.92, k * 0.95); g.fillStyle = g.createPattern(envSnowPattern(), 'repeat');
  g.fillRect(0, 0, (x1 - x0) * ppm, (y1 - y0) * ppm);
  g.restore();
}
// Surface wetness uses the same roof cutout, so interior flooring stays dry.
function drawWetGround(g,W,H){
 const k=ENV.wetness;if(k<.04)return;
 const s=cam.zoom,c=cam.cos,sn=cam.sin;
 const corners=[[0,0],[W,0],[0,H],[W,H]].map(p=>unproj(p[0],p[1],0));
 const x0=Math.min(...corners.map(p=>p[0]))-2,y0=Math.min(...corners.map(p=>p[1]))-2;
 const x1=Math.max(...corners.map(p=>p[0]))+2,y1=Math.max(...corners.map(p=>p[1]))+2;
 g.save();g.setTransform(s*c,s*TILT*sn,-s*sn,s*TILT*c,
   W/2+s*(c*(x0-cam.x)-sn*(y0-cam.y)),H/2+s*TILT*(sn*(x0-cam.x)+c*(y0-cam.y)));
 const covered=globalThis.CityShelter?.regions(cam.x,cam.y,Math.max(x1-x0,y1-y0))||[];
 if(covered.length){g.beginPath();g.rect(0,0,x1-x0,y1-y0);
  for(const poly of covered){poly.forEach((p,i)=>i?g.lineTo(p[0]-x0,p[1]-y0):g.moveTo(p[0]-x0,p[1]-y0));g.closePath();}
  g.clip('evenodd');
 }
 g.fillStyle='rgba(33,57,80,'+(k*.17).toFixed(3)+')';
 g.fillRect(0,0,x1-x0,y1-y0);g.restore();
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
