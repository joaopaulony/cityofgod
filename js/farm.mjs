// farm.mjs — a fazenda do jogador (docs/FAZENDA-PLANO.md): sítio com terreno cercado, lavoura (arar, plantar, regar,
// colher), animais (galinhas, vacas, alpacas) com produção diária, silo, galpão de beneficiamento, caixa d'água com
// irrigação e a caixa da Cooperativa Agro City, cujo coletor passa às 19h e paga o preço justo.
// Tudo no relógio do jogo (1 dia = 1440 min de st.clock). Salvo em localStorage (cityofgod.farm.v1), por sítio.
// O 3D é procedural (texturas de canvas) e instanciado; vacas e alpacas são os modelos animados dos pets.
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {loadAnimalAsset} from './pet-animated.mjs';

// ======================= regras =======================
export const CROPS = {
  alface:  { name: 'Alface',  icon: '🥬', days: 3, yield: 1, regrow: 0, seed: 4,  col: '#79b84a' },
  cenoura: { name: 'Cenoura', icon: '🥕', days: 4, yield: 2, regrow: 0, seed: 5,  col: '#e8792b' },
  milho:   { name: 'Milho',   icon: '🌽', days: 6, yield: 2, regrow: 0, seed: 6,  col: '#e9c44a' },
  tomate:  { name: 'Tomate',  icon: '🍅', days: 6, yield: 3, regrow: 3, seed: 9,  col: '#d8392b' },
  morango: { name: 'Morango', icon: '🍓', days: 5, yield: 3, regrow: 2, seed: 12, col: '#d62b45' },
  abobora: { name: 'Abóbora', icon: '🎃', days: 8, yield: 1, regrow: 0, seed: 10, col: '#e08a2a' },
};
export const ANIMALS = {
  galinha: { name: 'Galinha', icon: '🐔', home: 'galinheiro', cap: 8, price: 60,   feed: 1, product: 'ovo',   every: 1 },
  vaca:    { name: 'Vaca',    icon: '🐄', home: 'curral',     cap: 4, price: 1400, feed: 3, product: 'leite', every: 1, model: 'Cow',    height: 1.45 },
  alpaca:  { name: 'Alpaca',  icon: '🦙', home: 'aprisco',    cap: 4, price: 1800, feed: 2, product: 'la',    every: 3, model: 'Alpaca', height: 1.6 },
};
export const BUILDINGS = {
  galinheiro: { name: 'Galinheiro', icon: '🐔', price: 4500,  detail: 'Casa elevada com rampa, ninhos e terreiro telado. Até 8 galinhas.' },
  curral:     { name: 'Curral',     icon: '🐄', price: 9000,  detail: 'Cercado de tábuas com abrigo coberto e cocho. Até 4 vacas.' },
  aprisco:    { name: 'Aprisco',    icon: '🦙', price: 8000,  detail: 'Abrigo de madeira com piquete. Até 4 alpacas.' },
  silo:       { name: 'Silo',       icon: '🛢️', price: 6500,  detail: 'Guarda até 300 de ração e abastece os comedouros sozinho toda manhã.' },
  galpao:     { name: 'Galpão',     icon: '🏚️', price: 12000, detail: 'Queijaria, conservas, moinho e tear: transforma a produção (pronto no dia seguinte).' },
  caixadagua: { name: "Caixa d'água", icon: '💧', price: 5000, detail: 'Torre com irrigação: rega a lavoura inteira toda manhã.' },
};
export const ITEMS = {
  alface: { name: 'Alface', icon: '🥬', price: 14 }, cenoura: { name: 'Cenoura', icon: '🥕', price: 9 }, milho: { name: 'Milho', icon: '🌽', price: 11 },
  tomate: { name: 'Tomate', icon: '🍅', price: 8 }, morango: { name: 'Morango', icon: '🍓', price: 9 }, abobora: { name: 'Abóbora', icon: '🎃', price: 58 },
  ovo: { name: 'Ovo caipira', icon: '🥚', price: 6 }, leite: { name: 'Leite', icon: '🥛', price: 38 }, la: { name: 'Lã de alpaca', icon: '🧶', price: 85 },
  queijo: { name: 'Queijo minas', icon: '🧀', price: 95 }, conserva: { name: 'Conserva/Geleia', icon: '🫙', price: 52 }, fuba: { name: 'Fubá', icon: '🌾', price: 34 },
  novelo: { name: 'Novelo de lã', icon: '🧶', price: 140 }, ovoscaixa: { name: 'Caixa de ovos (6)', icon: '📦', price: 46 },
};
// galpão: entrada → saída (feito na hora de pôr; fica pronto no dia seguinte)
export const RECIPES = [
  { id: 'queijo', name: 'Queijo minas', in: { leite: 1 }, out: { queijo: 1 } },
  { id: 'conserva-t', name: 'Conserva de tomate', in: { tomate: 3 }, out: { conserva: 1 } },
  { id: 'conserva-m', name: 'Geleia de morango', in: { morango: 3 }, out: { conserva: 1 } },
  { id: 'novelo', name: 'Novelo de lã', in: { la: 1 }, out: { novelo: 1 } },
  { id: 'ovos', name: 'Caixa de ovos', in: { ovo: 6 }, out: { ovoscaixa: 1 } },
  { id: 'fuba', name: 'Fubá', in: { milho: 2 }, out: { fuba: 1 } },
];
const FEED_PRICE = 3, SILO_CAP = 300, COLLECT_AT = 19 * 60, LAND_PRICE = 85000;
const Q_MULT = [1, 1.25, 1.5];
const KEY = 'cityofgod.farm.v1';
// terreno no referencial da casa: u = de lado (eixo t), v = p/ trás da porta (eixo b); a frente (porteira) é v = V0
const U0 = -26, U1 = 26, V0 = -8, V1 = 38, FIELD = { u0: -23, u1: -9, v0: -4, v1: 10 }, BOX = { u: 3.2, v: -6.2 };
const PADS = [{ u: 15.5, v: -1 }, { u: 15.5, v: 11 }, { u: 15.5, v: 24 }, { u: 0, v: 27.5 }, { u: -16, v: 25 }];
const PAD_W = 11, PAD_D = 9;

export function farmPrice(H) { return LAND_PRICE; }
const hash = (s, n) => { let h = 2166136261; for (const c of s + ':' + n) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };
export const marketFactor = (item, day) => 0.9 + hash(item, day) * 0.2;   // mercado do dia: ±10%
export const fairPrice = (item, star, day) => Math.round(ITEMS[item].price * Q_MULT[star] * marketFactor(item, day));

export function installFarm(THREE, scene, bridge) {
  const P = () => bridge.player, st = () => window.__game?.st, day = () => Math.floor((st()?.clock || 0) / 1440), minute = () => ((Math.floor(st()?.clock || 0) % 1440) + 1440) % 1440;
  const notify = (t, ok = true) => window.CityUI?.notify?.(t, ok);
  const money = n => window.CityLife?.money?.(n) || 'R$ ' + n;
  const Realty = () => window.CityRealty;
  let save = load();
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) return s; } catch (_) {} return { v: 1, farms: {}, seeds: {}, sel: 'alface', feed: 0 }; }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (_) {} }

  // ---------- geometria do terreno ----------
  const frame = F => { const n = F.n, t = [-n[1], n[0]], b = [-n[0], -n[1]]; return { t, b, o: F.o }; };
  const toWorld = (F, u, v) => { const f = frame(F); return [f.o[0] + f.t[0] * u + f.b[0] * v, f.o[1] + f.t[1] * u + f.b[1] * v]; };
  const toLocal = (F, x, y) => { const f = frame(F), dx = x - f.o[0], dy = y - f.o[1]; return [dx * f.t[0] + dy * f.t[1], dx * f.b[0] + dy * f.b[1]]; };
  const yawOf = F => { const t = frame(F).t; return Math.atan2(t[1], t[0]); };
  function lotRect(F) { const c = [[U0, V0], [U1, V0], [U1, V1], [U0, V1]].map(([u, v]) => toWorld(F, u, v)); return [Math.min(...c.map(p => p[0])), Math.min(...c.map(p => p[1])), Math.max(...c.map(p => p[0])), Math.max(...c.map(p => p[1]))]; }
  // ponto utilizável: fora da rua, da água e de outras casas
  function usable(F, x, y) {
    if (typeof roadDist === 'function' && roadDist(x, y) < (typeof ROAD_W !== 'undefined' ? ROAD_W : 3.5) + (typeof SIDE !== 'undefined' ? SIDE : 2) + 0.6) return false;
    if (typeof pondVal === 'function' && pondVal(x, y) < 1.26) return false;
    for (const H of bridge.houses || []) { if (Realty()?.id?.(H) === F.id) continue; const b = H.drawBounds || [H.x0, H.y0, H.x1, H.y1]; if (x > b[0] - 1 && x < b[2] + 1 && y > b[1] - 1 && y < b[3] + 1) return false; }
    return true;
  }
  function padOk(F, i) { const p = PADS[i]; for (let a = -1; a <= 1; a += 0.5) for (let c = -1; c <= 1; c += 0.5) { const w = toWorld(F, p.u + a * PAD_W / 2, p.v + c * PAD_D / 2); if (!usable(F, w[0], w[1])) return false; } return true; }
  const tileKey = (i, j) => i + ',' + j;
  function tileOk(F, i, j) { if (F._ok?.has(tileKey(i, j))) return F._ok.get(tileKey(i, j)); const w = toWorld(F, FIELD.u0 + i + 0.5, FIELD.v0 + j + 0.5), ok = usable(F, w[0], w[1]); (F._ok || (F._ok = new Map())).set(tileKey(i, j), ok); return ok; }

  // ---------- sítios: criar o terreno quando a casa é comprada ----------
  const isFarmHouse = H => !!H?.country && !!H.doorPt && !!H.doorN;
  function ensureFarms() {
    for (const H of bridge.houses || []) {
      if (!isFarmHouse(H) || !Realty()?.isOwned?.(H)) continue;
      const id = Realty().id(H); if (save.farms[id]) continue;
      // origem: o ponto da porta; a casa fica p/ trás (v > 0)
      save.farms[id] = { id, o: [H.doorPt[0], H.doorPt[1]], n: [Math.round(H.doorN[0]), Math.round(H.doorN[1])], created: day(), lastDay: day(),
        tiles: {}, pads: [null, null, null, null, null], animals: [], out: {}, stock: {}, box: {}, silo: 0, proc: null, ledger: [], lastCollect: day() - (minute() >= COLLECT_AT ? 0 : 1) };
      persist(); clearLot(save.farms[id]); registerLots(); repaintGround(lotRect(save.farms[id]));
      notify('🚜 Seu sítio tem terreno de 52 × 46 m! Abra o app Fazenda no celular para começar.');
    }
  }
  // limpa a mata de dentro do terreno (e diz à geração do mapa p/ não replantar: world.farmLots, openworld.js)
  function clearLot(F) {
    const r = lotRect(F), w = bridge.world, inR = o => o && o.x > r[0] && o.x < r[2] && o.y > r[1] && o.y < r[3];
    (w.farmLots || (w.farmLots = [])).push(r);
    const keepNearHouse = o => { const l = toLocal(F, o.x, o.y); return l[0] > -7 && l[0] < 7 && l[1] > -1.5 && l[1] < 12; };
    const killProp = o => inR(o) && !keepNearHouse(o) && ['tree', 'bush', 'rock', 'tuft', 'flower'].includes(o.type || o.kind);
    let n = 0;
    for (const arr of [w.props, w.circles]) { if (!arr) continue; let j = 0; for (let i = 0; i < arr.length; i++) { const o = arr[i]; if (killProp(o)) { n++; continue; } arr[j++] = o; } arr.length = j; }
    if (n) w.version = (w.version || 0) + 1;
  }
  function registerLots() {
    const w = bridge.world; w.farmLots = Object.values(save.farms).map(lotRect);
    // dentro do terreno o chão vira pasto (rural), sem as fileiras das roças do mapa: a lavoura do jogador se destaca
    if (w.districtFn && !w.districtFn.farmWrapped) { const base = w.districtFn, f = (x, y) => { for (const r of w.farmLots || []) if (x > r[0] && x < r[2] && y > r[1] && y < r[3]) return COG.D.RURAL; return base(x, y); }; f.farmWrapped = true; w.districtFn = f; }
  }
  // repinta o chão (blocos da CPU e janela da GPU) que cruza o terreno
  function repaintGround(r) {
    if (typeof terrain !== 'undefined') for (const [k, ch] of terrain.chunks) { const x = ch.ci * 16, y = ch.cj * 16; if (x + 16 > r[0] && x < r[2] && y + 16 > r[1] && y < r[3]) terrain.chunks.delete(k); }
    window.GroundGPU?.invalidate?.();
  }

  // ======================= 3D =======================
  const tex = {};
  function canvasTex(key, w, h, paint, rep = [1, 1]) {
    if (tex[key]) return tex[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); paint(g, w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return tex[key] = t;
  }
  const rng = s => () => (s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0, (s >>> 0) / 4294967296);
  // tábuas verticais (madeira pintada ou crua), chapa corrugada, telha, terra arada, palha
  const planks = (base, dark, seed) => (g, w, h) => { const r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, w, h); const n = 8;
    for (let i = 0; i < n; i++) { const x = i * w / n; g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.08})`; g.fillRect(x, 0, w / n, h); g.fillStyle = dark; g.fillRect(x, 0, 2, h);
      for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(${r() < .5 ? '255,240,220' : '40,25,15'},${0.05 + r() * 0.07})`; g.fillRect(x + 3 + r() * (w / n - 6), r() * h, 1 + r() * 1.5, 10 + r() * 40); }
      if (r() < .5) { g.fillStyle = 'rgba(40,28,18,.5)'; g.beginPath(); g.ellipse(x + w / n * (.3 + r() * .4), r() * h, 2.5, 4, 0, 0, 6.3); g.fill(); } } };
  const corrugated = (base) => (g, w, h) => { const grad = g.createLinearGradient(0, 0, w, 0); for (let i = 0; i <= 16; i++) { const k = i / 16; grad.addColorStop(k, i % 2 ? base : '#ffffff'); } g.fillStyle = base; g.fillRect(0, 0, w, h); g.globalAlpha = .35; g.fillStyle = grad; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
    for (let y = 0; y < h; y += h / 6) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, w, 2); } const r = rng(7); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,70,40,${r() * .12})`; g.fillRect(r() * w, r() * h, 2 + r() * 8, 6 + r() * 30); } };
  const shingles = (base, seed) => (g, w, h) => { const r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -12 : 0; x < w; x += 24) { g.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},${r() * .1})`; g.fillRect(x + 1, y + 1, 22, 14); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y + 14, 24, 2); } };
  const soil = (wet) => (g, w, h) => { const r = rng(wet ? 3 : 9); g.fillStyle = wet ? '#4a3424' : '#6e5038'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { const y = (i + .5) * h / 4; const grd = g.createLinearGradient(0, y - h / 8, 0, y + h / 8); grd.addColorStop(0, 'rgba(0,0,0,.28)'); grd.addColorStop(.5, wet ? 'rgba(110,84,62,.35)' : 'rgba(160,126,92,.4)'); grd.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = grd; g.fillRect(0, y - h / 8, w, h / 4); }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < .5 ? '30,20,12' : wet ? '120,96,72' : '170,140,104'},${.2 + r() * .3})`; g.beginPath(); g.ellipse(r() * w, r() * h, .8 + r() * 2.2, .6 + r() * 1.5, r() * 3, 0, 6.3); g.fill(); } };
  const packedEarth = (g, w, h) => { const r = rng(21); g.fillStyle = '#8b7154'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < .5 ? '60,44,30' : '190,165,130'},${r() * .22})`; g.beginPath(); g.ellipse(r() * w, r() * h, 1 + r() * 5, 1 + r() * 3, r() * 3, 0, 6.3); g.fill(); }
    for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(90,120,50,${.3 + r() * .4})`; g.lineWidth = 1; const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 4, y - 4 - r() * 6); g.stroke(); } };
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, o));
  const M = {};   // materiais compartilhados
  function mats() {
    if (M.red) return M;
    M.red = std({ map: canvasTex('red', 256, 256, planks('#9b3328', '#5e1d17', 3), [1, 1]) });
    M.white = std({ color: '#efe9dc', roughness: .7 });
    M.wood = std({ map: canvasTex('wood', 256, 256, planks('#8f6a45', '#4e3622', 5)) });
    M.woodGrey = std({ map: canvasTex('woodg', 256, 256, planks('#9a8f7e', '#5b5246', 11)) });
    M.post = std({ color: '#6b4f33', roughness: .9 });
    M.metal = std({ map: canvasTex('metal', 256, 256, corrugated('#b8bcbf')), metalness: .55, roughness: .45 });
    M.roofMetal = std({ map: canvasTex('roofm', 256, 256, corrugated('#7f8b8f')), metalness: .5, roughness: .5 });
    M.roofRed = std({ map: canvasTex('roofr', 256, 256, shingles('#7c2f25', 4)) });
    M.roofDark = std({ map: canvasTex('roofd', 256, 256, shingles('#4b4744', 6)) });
    M.earth = std({ map: canvasTex('earth', 512, 512, packedEarth, [3, 3]), roughness: 1 });
    M.mesh = new THREE.MeshStandardMaterial({ color: '#c9ccc8', transparent: true, opacity: .32, metalness: .6, roughness: .4, side: THREE.DoubleSide, depthWrite: false });
    M.water = std({ color: '#5f8a96', metalness: .1, roughness: .15 });
    M.hay = std({ color: '#d9bf6a', roughness: 1 });
    M.dark = std({ color: '#2b2622' });
    return M;
  }
  const box = (w, h, d, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; return o; };
  const cyl = (r1, r2, h, m, x, y, z, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };
  // telhado de duas águas: largura w (eixo x), profundidade d (eixo z), cumeeira em x
  function gable(w, d, rise, m, y, over = .35) {
    const g = new THREE.Group(), half = d / 2 + over, slope = Math.hypot(half, rise);
    for (const s of [-1, 1]) { const p = box(w + over * 2, .1, slope, m, 0, y + rise / 2, s * half / 2, 0); p.rotation.x = s * Math.atan2(rise, half); g.add(p); }
    return g;
  }
  function pad(F, i) { const g = new THREE.Group(); const e = new THREE.Mesh(new THREE.PlaneGeometry(PAD_W, PAD_D), mats().earth); e.rotation.x = -Math.PI / 2; e.position.y = .015; e.receiveShadow = true; g.add(e); return g; }
  // ---------- construções ----------
  const BUILD = {
    galpao() { const m = mats(), g = new THREE.Group(), W = 9, D = 7, H = 3.4;
      g.add(box(W, H, D, m.red, 0, H / 2, 0));
      for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) g.add(box(.18, H + .05, .18, m.white, x, H / 2, z));
      // telhado em "gambrel" (dois caimentos de cada lado)
      const r1 = gable(W, D, 1.0, m.roofRed, H, .4); g.add(r1); const top = gable(W, D * .55, .9, m.roofRed, H + .62, .2); g.add(top);
      for (const s of [-1, 1]) { const tri = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(D * .27, 1.0), new THREE.Vector2(0, 1.85), new THREE.Vector2(-D * .27, 1.0)]);
        const gm = new THREE.Mesh(new THREE.ShapeGeometry(tri), m.red); gm.rotation.y = Math.PI / 2; gm.position.set(s * W / 2, H, 0); g.add(gm); const gb = gm.clone(); gb.rotation.y = -Math.PI / 2; gb.position.x = s * W / 2 + (s * -0.001); g.add(gb); }
      // portão de correr com o "X" branco, janelinha do feno
      g.add(box(.08, 2.6, 3.0, m.red, W / 2 + .05, 1.3, 0)); for (const r of [.84, -.84]) { const b = box(.06, .14, 3.7, m.white, W / 2 + .1, 1.3, 0); b.rotation.x = r; g.add(b); }
      g.add(box(.06, .14, 3.1, m.white, W / 2 + .1, 2.6, 0)); g.add(box(.06, .14, 3.1, m.white, W / 2 + .1, .05, 0));
      g.add(box(.06, .9, 1.0, m.dark, W / 2 + .06, H + .7, 0)); g.add(box(.08, 1.05, 1.15, m.white, W / 2 + .04, H + .7, 0));
      return { g, footprint: [W, D], use: [W / 2 + 1.2, 0] };
    },
    silo() { const m = mats(), g = new THREE.Group(), R = 1.7, H = 7.5;
      g.add(cyl(R, R, H, m.metal, 0, H / 2, 0, 32)); const dome = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.metal); dome.position.y = H; dome.castShadow = true; g.add(dome);
      g.add(cyl(.18, .25, .5, m.metal, 0, H + R * .95, 0)); g.add(cyl(R + .06, R + .06, .1, m.dark, 0, .05, 0, 32));
      for (const y of [1.5, 3, 4.5, 6]) g.add(cyl(R + .03, R + .03, .07, m.dark, 0, y, 0, 32));
      // escada com gaiola
      for (const s of [-.22, .22]) g.add(box(.05, H, .05, m.dark, R + .12, H / 2, s)); for (let y = .3; y < H; y += .35) g.add(box(.04, .04, .5, m.dark, R + .12, y, 0));
      g.add(box(1.2, 1.4, .6, m.metal, R + .2, .7, -1.1));   // bica de descarga
      return { g, footprint: [R * 2 + .6, R * 2 + .6], use: [R + 1.1, 0] };
    },
    galinheiro() { const m = mats(), g = new THREE.Group();
      const house = new THREE.Group(); house.position.set(-2.6, 0, 0); g.add(house);
      for (const x of [-1.3, 1.3]) for (const z of [-1.1, 1.1]) house.add(box(.14, .8, .14, m.post, x, .4, z));
      house.add(box(2.8, 1.6, 2.4, m.woodGrey, 0, 1.6, 0)); house.add(gable(2.8, 2.4, .7, m.roofDark, 2.4, .25));
      house.add(box(.05, .45, .4, m.dark, 1.41, 1.2, .5));   // portinhola
      const ramp = box(.5, .05, 1.6, m.wood, 1.85, .45, .5); ramp.rotation.z = -.5; ramp.rotation.y = Math.PI / 2; house.add(ramp);
      house.add(box(.6, .5, 2.4, m.wood, -1.7, 1.25, 0));   // caixa dos ninhos
      // terreiro telado
      const run = new THREE.Group(); g.add(run); const RW = 6.2, RD = 6.4;
      for (const [x, z] of [[-1, -RD / 2], [RW - 1, -RD / 2], [RW - 1, RD / 2], [-1, RD / 2], [2.1, -RD / 2], [2.1, RD / 2]]) run.add(box(.1, 1.5, .1, m.post, x, .75, z));
      for (const [w, d, x, z] of [[RW, .02, RW / 2 - 1, -RD / 2], [RW, .02, RW / 2 - 1, RD / 2], [.02, RD, RW - 1, 0]]) { const p = box(w, 1.4, d, m.mesh, x, .72, z); p.castShadow = false; run.add(p); }
      run.add(box(.6, .12, .3, m.wood, 3.6, .1, 2.2)); run.add(box(.5, .08, .25, m.water, 3.6, .17, 2.2));   // bebedouro
      return { g, footprint: [8.8, 6.6], use: [-1.0, 1.5], pen: { x0: -.8, x1: 4.9, z0: -3.0, z1: 3.0 } };
    },
    curral() { const m = mats(), g = new THREE.Group(), W = 10, D = 8;
      // cerca de tábuas em volta
      const rail = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0); for (const y of [.45, .85, 1.25]) g.add(box(L, .14, .05, m.wood, (x0 + x1) / 2, y, (z0 + z1) / 2, -a)); for (let k = 0; k <= Math.round(L / 2); k++) { const t = k / Math.max(1, Math.round(L / 2)); g.add(box(.14, 1.5, .14, m.post, x0 + (x1 - x0) * t, .75, z0 + (z1 - z0) * t)); } };
      rail(-W / 2, -D / 2, W / 2, -D / 2); rail(W / 2, -D / 2, W / 2, D / 2); rail(-W / 2, D / 2, W / 2, D / 2); rail(-W / 2, -D / 2, -W / 2, -1.5); rail(-W / 2, 1.5, -W / 2, D / 2);
      // abrigo coberto no fundo
      for (const x of [W / 2 - 3.6, W / 2 - .2]) for (const z of [-D / 2 + .2, D / 2 - .2]) g.add(box(.18, 2.6, .18, m.post, x, 1.3, z));
      const roof = box(4.2, .1, D + .4, m.roofMetal, W / 2 - 1.9, 2.75, 0); roof.rotation.z = .12; g.add(roof);
      g.add(box(.5, .4, 2.6, m.wood, W / 2 - 1.2, .2, 0)); g.add(box(.42, .1, 2.5, m.hay, W / 2 - 1.2, .42, 0));   // cocho com feno
      g.add(box(1.3, .5, .6, m.metal, -W / 2 + 1.2, .25, D / 2 - .8)); g.add(box(1.2, .06, .5, m.water, -W / 2 + 1.2, .5, D / 2 - .8));   // bebedouro
      return { g, footprint: [W, D], use: [-W / 2 - .8, 0], pen: { x0: -W / 2 + .8, x1: W / 2 - .8, z0: -D / 2 + .8, z1: D / 2 - .8 } };
    },
    aprisco() { const m = mats(), g = new THREE.Group(), W = 10, D = 8;
      const hut = new THREE.Group(); hut.position.set(2.6, 0, 0); g.add(hut);
      hut.add(box(4, 2.3, 5, m.wood, 0, 1.15, 0)); hut.add(gable(4.0, 5, 1.0, m.roofDark, 2.3, .35)); hut.add(box(.06, 1.8, 1.4, m.dark, -2.03, .9, 0));
      for (const s of [-1, 1]) { const tri = new THREE.Shape([new THREE.Vector2(-2.5, 0), new THREE.Vector2(2.5, 0), new THREE.Vector2(0, 1.0)]); const gm = new THREE.Mesh(new THREE.ShapeGeometry(tri), m.wood); gm.position.set(0, 2.3, 0); gm.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; gm.position.x = s * 2; hut.add(gm); }
      const rail = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0); for (const y of [.5, 1.0]) g.add(box(L, .12, .05, m.woodGrey, (x0 + x1) / 2, y, (z0 + z1) / 2, -a)); for (let k = 0; k <= Math.round(L / 2); k++) { const t = k / Math.max(1, Math.round(L / 2)); g.add(box(.12, 1.25, .12, m.post, x0 + (x1 - x0) * t, .62, z0 + (z1 - z0) * t)); } };
      rail(-W / 2, -D / 2, .6, -D / 2); rail(-W / 2, D / 2, .6, D / 2); rail(-W / 2, -D / 2, -W / 2, -1.2); rail(-W / 2, 1.2, -W / 2, D / 2);
      g.add(box(1.4, .45, .5, m.wood, -1, .22, -D / 2 + .7)); g.add(box(1.3, .1, .4, m.hay, -1, .45, -D / 2 + .7));
      return { g, footprint: [W, D], use: [-W / 2 - .8, 0], pen: { x0: -W / 2 + .8, x1: .2, z0: -D / 2 + .8, z1: D / 2 - .8 } };
    },
    caixadagua() { const m = mats(), g = new THREE.Group(), H = 6;
      for (const x of [-1.2, 1.2]) for (const z of [-1.2, 1.2]) { const leg = box(.16, H, .16, m.post, x, H / 2, z); g.add(leg); }
      for (const y of [1.8, 3.6]) for (const [w, d, x, z] of [[2.5, .08, 0, -1.2], [2.5, .08, 0, 1.2], [.08, 2.5, -1.2, 0], [.08, 2.5, 1.2, 0]]) g.add(box(w, .1, d, m.post, x, y, z));
      g.add(box(3, .15, 3, m.wood, 0, H, 0)); g.add(cyl(1.35, 1.35, 1.9, m.wood, 0, H + 1.05, 0, 24)); g.add(cyl(1.42, 1.42, .1, m.dark, 0, H + .4, 0, 24)); g.add(cyl(1.42, 1.42, .1, m.dark, 0, H + 1.6, 0, 24));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, .7, 24), m.roofMetal); cone.position.y = H + 2.35; cone.castShadow = true; g.add(cone);
      g.add(cyl(.07, .07, H + 1, m.metal, 1.45, (H + 1) / 2, 0, 8));
      return { g, footprint: [3.2, 3.2], use: [2.2, 0] };
    },
  };
  // caixa da cooperativa: caixote de madeira com tampa e placa
  function shipBox() { const m = mats(), g = new THREE.Group();
    g.add(box(1.3, .75, .9, m.wood, 0, .42, 0)); g.add(box(1.4, .08, 1.0, m.wood, 0, .84, 0)); for (const x of [-.6, .6]) g.add(box(.08, .85, .08, m.post, x, .42, .42));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .45), new THREE.MeshStandardMaterial({ map: canvasTex('sign', 256, 96, (gg, w, h) => { gg.fillStyle = '#f2ead6'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#2f5d2c'; gg.font = 'bold 34px system-ui'; gg.textAlign = 'center'; gg.fillText('COOPERATIVA', w / 2, 40); gg.font = 'bold 26px system-ui'; gg.fillText('AGRO CITY · 19h', w / 2, 78); }) }));
    sign.position.set(0, 1.3, .47); g.add(sign); g.add(box(.08, 1.3, .08, m.post, 0, .65, .5)); return g; }
  // cerca do terreno
  function fence(F, root) {
    const m = mats(), posts = [], rails = [], boxes = [], gate = [-2.6, 2.6];
    const seg = (u0, v0, u1, v1) => { const L = Math.hypot(u1 - u0, v1 - v0), n = Math.max(1, Math.round(L / 2.5));
      for (let k = 0; k < n; k++) { const a = k / n, b = (k + 1) / n, ua = u0 + (u1 - u0) * a, va = v0 + (v1 - v0) * a, ub = u0 + (u1 - u0) * b, vb = v0 + (v1 - v0) * b, um = (ua + ub) / 2, vm = (va + vb) / 2;
        if (Math.abs(v0 - V0) < .01 && Math.abs(v1 - V0) < .01 && um > gate[0] && um < gate[1]) continue;   // porteira
        const w = toWorld(F, um, vm); if (!usable(F, w[0], w[1])) continue;
        posts.push([ua, va]); posts.push([ub, vb]); rails.push([um, vm, Math.hypot(ub - ua, vb - va), Math.atan2(vb - va, ub - ua)]);
        const wa = toWorld(F, ua, va), wb = toWorld(F, ub, vb);
        boxes.push(bridge.addBox({ x: (wa[0] + wb[0]) / 2, y: (wa[1] + wb[1]) / 2, w: Math.hypot(wb[0] - wa[0], wb[1] - wa[1]), d: .14, h: 1.2, rot: Math.atan2(wb[1] - wa[1], wb[0] - wa[0]), kind: 'farmfence', farm: true, solid: true, top: '#6b4f33', side: '#6b4f33' }));
      } };
    seg(U0, V0, U1, V0); seg(U1, V0, U1, V1); seg(U1, V1, U0, V1); seg(U0, V1, U0, V0);
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(.14, 1.35, .14), m.post, posts.length), rm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .12, .05), m.wood, rails.length * 2), d = new THREE.Object3D();
    posts.forEach(([u, v], i) => { d.position.set(u, .67, v); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); pm.setMatrixAt(i, d.matrix); });
    rails.forEach(([u, v, L, a], i) => { for (const [k, y] of [[0, .55], [1, 1.05]]) { d.position.set(u, y, v); d.rotation.set(0, -a, 0); d.scale.set(L, 1, 1); d.updateMatrix(); rm.setMatrixAt(i * 2 + k, d.matrix); } });
    for (const o of [pm, rm]) { o.castShadow = o.receiveShadow = true; root.add(o); }
    return boxes;
  }
  // ---------- plantas (instanciadas por cultura e estágio) ----------
  const cropGeo = {};
  function merge(parts) {   // [geometry, color hex] → uma geometria com cor por vértice
    const geos = parts.map(([geo, col]) => { const g = geo.toNonIndexed(), c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; });
    let total = 0; for (const g of geos) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3); let o = 0;
    for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3)); return out;
  }
  const leaf = (len, wid, tilt, rot, y, col) => { const g = new THREE.PlaneGeometry(wid, len, 1, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i) + len / 2; p.setY(i, yy); p.setZ(i, -Math.pow(yy / len, 2) * len * .35); } g.computeVertexNormals(); g.rotateX(-tilt); g.rotateY(rot); g.translate(0, y, 0); return [g, col]; };
  const ball = (r, x, y, z, col, seg = 8) => { const g = new THREE.SphereGeometry(r, seg, seg * .75); g.translate(x, y, z); return [g, col]; };
  const stem = (r, h, x, z, col, y = 0) => { const g = new THREE.CylinderGeometry(r * .7, r, h, 5); g.translate(x, y + h / 2, z); return [g, col]; };
  function plantGeo(crop, stage) {
    const key = crop + stage; if (cropGeo[key]) return cropGeo[key];
    const G = '#4f8a2e', G2 = '#6aa63a', parts = [], s = [0.25, 0.55, 0.85, 1][stage];
    const ring = (n, len, wid, tilt, y, col) => { for (let i = 0; i < n; i++) parts.push(leaf(len, wid, tilt, i / n * Math.PI * 2 + (y * 3), y, col)); };
    if (stage === 0) { ring(2, .12, .06, .6, 0, G2); }
    else if (crop === 'alface') { ring(6, .2 * s, .16 * s, 1.0, .02, '#8cc35a'); ring(5, .16 * s, .13 * s, .55, .04, '#a9d36c'); if (stage >= 2) parts.push(ball(.1 * s, 0, .1 * s, 0, '#b9dc7c')); }
    else if (crop === 'cenoura') { for (let i = 0; i < 7; i++) parts.push(leaf(.32 * s, .05, .25 + (i % 3) * .1, i * .9, .02, i % 2 ? G : G2)); if (stage === 3) parts.push(ball(.05, 0, .02, 0, '#e8792b')); }
    else if (crop === 'milho') { const h = 1.9 * s; parts.push(stem(.035, h, 0, 0, '#7da443')); for (let i = 0; i < 6; i++) parts.push(leaf(.55 * s, .07, .9, i * 1.9, h * (.2 + i * .12), i % 2 ? G : G2)); if (stage === 3) { parts.push(stem(.05, .26, .07, 0, '#e9c44a', h * .5)); parts.push(stem(.012, .14, .07, 0, '#c9a36a', h * .5 + .26)); } }
    else if (crop === 'tomate') { const h = .9 * s; parts.push(stem(.012, h + .15, .14, 0, '#c7a46b')); parts.push(stem(.02, h, 0, 0, '#557b2c')); for (let i = 0; i < 7; i++) parts.push(leaf(.22 * s, .14 * s, 1.1, i * 1.6, h * (.2 + i * .1), i % 2 ? G : '#3f7426')); if (stage === 3) for (let i = 0; i < 5; i++) parts.push(ball(.045, Math.cos(i * 2.4) * .12, h * (.35 + i * .1), Math.sin(i * 2.4) * .12, i % 3 ? '#d8392b' : '#e85a2c')); }
    else if (crop === 'morango') { ring(7, .16 * s, .11 * s, 1.15, .02, '#3f8a2f'); if (stage === 3) for (let i = 0; i < 6; i++) parts.push(ball(.03, Math.cos(i) * .14, .03, Math.sin(i) * .14, '#d62b45', 6)); else if (stage === 2) for (let i = 0; i < 4; i++) parts.push(ball(.018, Math.cos(i * 1.5) * .1, .05, Math.sin(i * 1.5) * .1, '#f4f1e6', 6)); }
    else if (crop === 'abobora') { for (let i = 0; i < 6; i++) parts.push(leaf(.35 * s, .3 * s, 1.25, i * 1.05, .03, i % 2 ? G : '#5c9a35')); if (stage >= 2) { const r = stage === 3 ? .2 : .1; const g = new THREE.SphereGeometry(r, 12, 9); g.scale(1.2, .82, 1.2); g.translate(.18, r * .8, .1); parts.push([g, stage === 3 ? '#e08a2a' : '#8cae4a']); parts.push(stem(.015, .06, .18, .1, '#6b5a30', r * 1.6)); } }
    return cropGeo[key] = merge(parts);
  }
  // ---------- frango procedural ----------
  function chickenGeo() {
    if (cropGeo.chicken) return cropGeo.chicken;
    const body = new THREE.SphereGeometry(.13, 10, 8); body.scale(1.25, 1, .95); body.translate(0, .2, 0);
    const tail = new THREE.ConeGeometry(.07, .14, 6); tail.rotateZ(1.1); tail.translate(-.17, .27, 0);
    const head = new THREE.SphereGeometry(.065, 8, 6); head.translate(.13, .33, 0);
    const comb = new THREE.BoxGeometry(.06, .05, .02); comb.translate(.13, .4, 0);
    const beak = new THREE.ConeGeometry(.018, .05, 5); beak.rotateZ(-Math.PI / 2); beak.translate(.2, .33, 0);
    const legs = [-.04, .04].map(z => { const l = new THREE.CylinderGeometry(.008, .008, .12, 4); l.translate(0, .06, z); return l; });
    return cropGeo.chicken = merge([[body, '#f1ede4'], [tail, '#e6dfd0'], [head, '#f1ede4'], [comb, '#d22a24'], [beak, '#e3a33a'], [legs[0], '#e3a33a'], [legs[1], '#e3a33a']]);
  }

  // ---------- cena por sítio ----------
  const scenes = new Map();   // id → {root, inst, buildings, animals, boxes, built}
  const plantMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide });
  const soilMats = [0, 1].map(w => new THREE.MeshStandardMaterial({ map: canvasTex('soil' + w, 128, 128, soil(!!w)), roughness: 1 }));
  function buildScene(F) {
    const root = new THREE.Group(), o = F.o; root.position.set(o[0], 0, o[1]); root.rotation.y = -yawOf(F); scene.add(root);
    const S = { root, boxes: fence(F, root), pads: [], animals: [], inst: null, dirty: true };
    const bx = shipBox(); bx.position.set(BOX.u, 0, BOX.v); bx.rotation.y = Math.PI; root.add(bx);
    const wb = toWorld(F, BOX.u, BOX.v); S.boxes.push(bridge.addBox({ x: wb[0], y: wb[1], w: 1.3, d: .9, h: .8, rot: yawOf(F), kind: 'farmbox', farm: true, solid: true, top: '#8f6a45', side: '#8f6a45' }));
    scenes.set(F.id, S); syncPads(F, S); return S;
  }
  // construções nos lotes (refaz só o lote que mudou)
  function syncPads(F, S) {
    for (let i = 0; i < PADS.length; i++) {
      const kind = F.pads[i], cur = S.pads[i];
      if (cur && cur.kind === kind) continue;
      if (cur) { S.root.remove(cur.g); for (const b of cur.boxes) { b.fleetHidden = true; b.solid = false; } for (const a of S.animals.filter(a => a.pad === i)) S.root.remove(a.obj); S.animals = S.animals.filter(a => a.pad !== i); }
      if (!padOk(F, i)) { S.pads[i] = { kind: null, g: new THREE.Group(), boxes: [] }; continue; }
      const g = new THREE.Group(); g.position.set(PADS[i].u, 0, PADS[i].v); g.add(pad(F, i));
      const boxes = []; let info = null;
      if (kind && BUILD[kind]) { info = BUILD[kind](); g.add(info.g);
        // colisão: só o corpo das construções fechadas (cercados ficam abertos p/ o jogador entrar)
        const solid = { galpao: [[0, 0, 9, 7]], silo: [[0, 0, 3.5, 3.5]], galinheiro: [[-2.6, 0, 2.8, 2.4]], caixadagua: [[0, 0, 2.6, 2.6]], aprisco: [[2.6, 0, 4, 5]], curral: [] }[kind] || [];
        for (const [x, z, w, d] of solid) { const wp = toWorld(F, PADS[i].u + x, PADS[i].v + z); boxes.push(bridge.addBox({ x: wp[0], y: wp[1], w, d, h: 3, rot: yawOf(F), kind: 'farmbuilding', farm: true, solid: true, top: '#8f6a45', side: '#8f6a45' })); } }
      S.root.add(g); S.pads[i] = { kind, g, boxes, info };
    }
    syncAnimals(F, S);
  }
  // ---------- animais 3D ----------
  const tmpls = {};
  async function animalTemplate(model, height) {
    if (!tmpls[model]) tmpls[model] = loadAnimalAsset(model).then(gltf => { const b = new THREE.Box3().setFromObject(gltf.scene), s = height / Math.max(.01, b.max.y - b.min.y); return { gltf, s }; });
    return tmpls[model];
  }
  function syncAnimals(F, S) {
    for (const [type, A] of Object.entries(ANIMALS)) {
      const i = F.pads.indexOf(A.home), padInfo = i >= 0 ? S.pads[i]?.info : null;
      const want = padInfo?.pen ? F.animals.filter(a => a.type === type).slice(0, A.cap) : [];
      const have = S.animals.filter(a => a.type === type);
      for (const a of have) if (!want.some(w => w.id === a.id)) { S.root.remove(a.obj); S.animals.splice(S.animals.indexOf(a), 1); }
      for (const w of want) if (!have.some(a => a.id === w.id)) spawnAnimal(F, S, type, w.id, i, padInfo.pen);
    }
  }
  function spawnAnimal(F, S, type, id, padIdx, pen) {
    const A = ANIMALS[type], a = { type, id, pad: padIdx, pen, x: 0, z: 0, tx: 0, tz: 0, wait: Math.random() * 3, obj: new THREE.Group(), mixer: null, act: {} };
    a.x = a.tx = pen.x0 + Math.random() * (pen.x1 - pen.x0); a.z = a.tz = pen.z0 + Math.random() * (pen.z1 - pen.z0);
    a.obj.position.set(PADS[padIdx].u + a.x, 0, PADS[padIdx].v + a.z); S.root.add(a.obj); S.animals.push(a);
    if (A.model) animalTemplate(A.model, A.height).then(({ gltf, s }) => {
      if (!S.animals.includes(a)) return;
      const m = cloneSkinned(gltf.scene); m.scale.setScalar(s); m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); a.obj.add(m);
      a.mixer = new THREE.AnimationMixer(m); for (const c of gltf.animations) a.act[c.name] = a.mixer.clipAction(c);
      a.play = n => { const next = a.act[n] || a.act.Idle; if (a.cur === next) return; next.reset().fadeIn(.3).play(); a.cur?.fadeOut(.3); a.cur = next; }; a.play('Idle');
    }).catch(() => {});
    else { const c = new THREE.Mesh(chickenGeo(), plantMat); c.castShadow = true; if (Math.random() < .4) c.scale.set(1, 1, 1).multiplyScalar(.95); a.chick = c; a.obj.add(c); }
  }
  function animateAnimals(S, dt, t) {
    for (const a of S.animals) {
      const pen = a.pen, dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz), speed = a.chick ? .45 : .55;
      if (d < .1) { a.wait -= dt; a.play?.(a.grazing ? 'Eating' : 'Idle'); if (a.wait <= 0) { a.grazing = Math.random() < .45; a.wait = 2 + Math.random() * 6; a.tx = pen.x0 + Math.random() * (pen.x1 - pen.x0); a.tz = pen.z0 + Math.random() * (pen.z1 - pen.z0); } }
      else { const k = Math.min(1, speed * dt / d); a.x += dx * k; a.z += dz * k; a.face = Math.atan2(dx, dz); a.play?.('Walk'); }
      a.obj.position.set(PADS[a.pad].u + a.x, 0, PADS[a.pad].v + a.z);
      if (a.face !== undefined) a.obj.rotation.y = a.chick ? a.face - Math.PI / 2 : a.face;
      a.mixer?.update(dt);
      if (a.chick) { const peck = d < .1 ? Math.max(0, Math.sin(t * 6 + a.id)) : 0; a.chick.rotation.z = -peck * .5; a.chick.position.y = d >= .1 ? Math.abs(Math.sin(t * 12 + a.id)) * .02 : 0; }
    }
  }
  // ---------- lavoura 3D (refeita quando algo muda) ----------
  function rebuildField(F, S) {
    if (S.inst) { for (const m of S.inst) { S.root.remove(m); m.dispose?.(); } }
    S.inst = [];
    const tiles = Object.entries(F.tiles), d = new THREE.Object3D(), today = day();
    const soilBy = [[], []], plants = {};
    for (const [k, t] of tiles) { const [i, j] = k.split(',').map(Number), u = FIELD.u0 + i + .5, v = FIELD.v0 + j + .5;
      const wet = t.lw === today ? 1 : 0; soilBy[wet].push([u, v]);
      if (t.crop) { const c = CROPS[t.crop], st = t.ready ? 3 : Math.min(2, Math.floor((t.g / c.days) * 3)); (plants[t.crop + st] || (plants[t.crop + st] = { crop: t.crop, st, list: [] })).list.push([u, v, (i * 7 + j * 13) % 6]); } }
    soilBy.forEach((list, w) => { if (!list.length) return; const m = new THREE.InstancedMesh(new THREE.BoxGeometry(.94, .07, .94), soilMats[w], list.length); list.forEach(([u, v], n) => { d.position.set(u, .035, v); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); m.setMatrixAt(n, d.matrix); }); m.receiveShadow = true; S.root.add(m); S.inst.push(m); });
    for (const p of Object.values(plants)) { const m = new THREE.InstancedMesh(plantGeo(p.crop, p.st), plantMat, p.list.length);
      p.list.forEach(([u, v, r], n) => { d.position.set(u, .07, v); d.rotation.set(0, r, 0); d.scale.setScalar(.9 + (r % 3) * .06); d.updateMatrix(); m.setMatrixAt(n, d.matrix); }); m.castShadow = true; m.receiveShadow = true; S.root.add(m); S.inst.push(m); }
    S.dirty = false;
  }

  // ======================= estoque =======================
  const addStock = (F, item, n, star = 0) => { const s = F.stock[item] || (F.stock[item] = [0, 0, 0]); s[star] += n; };
  const count = (F, item) => (F.stock[item] || [0, 0, 0]).reduce((a, b) => a + b, 0);
  function takeStock(F, item, n) { const s = F.stock[item]; if (!s || count(F, item) < n) return false; for (let q = 0; q < 3 && n > 0; q++) { const k = Math.min(n, s[q]); s[q] -= k; n -= k; } return true; }

  // ======================= o dia na fazenda =======================
  function dailyUpdate(F, d) {
    const irr = F.pads.includes('caixadagua');
    // lavoura: regada ontem (ou irrigada) cresce um dia; qualidade = dias regados seguidos
    for (const t of Object.values(F.tiles)) {
      if (!t.crop || t.ready) continue;
      const watered = irr || t.lw === d - 1;
      if (watered) { t.g++; t.wd = (t.wd || 0) + 1; }
      const c = CROPS[t.crop];
      if (t.g >= c.days) t.ready = true;
    }
    // animais: o silo abastece de manhã; alimentado ontem → produz hoje
    const silo = F.pads.includes('silo');
    for (const a of F.animals) {
      const A = ANIMALS[a.type];
      if (a.fed === d - 1) { a.age = (a.age || 0) + 1; if (a.age % A.every === 0) { const o = F.out[A.home] || (F.out[A.home] = {}); o[A.product] = (o[A.product] || 0) + 1; } }
      if (silo && F.silo >= A.feed) { F.silo -= A.feed; a.fed = d; }
    }
    if (F.proc && F.proc.day <= d) { for (const [it, n] of Object.entries(F.proc.out)) addStock(F, it, n); F.procReady = (F.procReady || 0) + 1; F.proc = null; }
    // irrigação: deixa a terra molhada hoje
    if (irr) for (const t of Object.values(F.tiles)) if (t.crop && !t.ready) t.lw = d;
  }
  function catchUp() {
    const d = day(); let changed = false;
    for (const F of Object.values(save.farms)) {
      for (let k = 0; k < 10 && F.lastDay < d; k++) { F.lastDay++; dailyUpdate(F, F.lastDay); changed = true; }
      if (F.lastDay < d) F.lastDay = d;
      if (changed) { const S = scenes.get(F.id); if (S) S.dirty = true; }
      // coletor da cooperativa às 19h
      if (minute() >= COLLECT_AT && F.lastCollect < d) { F.lastCollect = d; collect(F, d); changed = true; }
    }
    if (changed) persist();
  }
  // ---------- venda ----------
  function boxValue(F, d = day()) { let v = 0; for (const [it, q] of Object.entries(F.box)) q.forEach((n, s) => v += n * fairPrice(it, s, d)); return v; }
  function deposit(F) { let n = 0; for (const [it, q] of Object.entries(F.stock)) { if (!ITEMS[it]) continue; const b = F.box[it] || (F.box[it] = [0, 0, 0]); q.forEach((k, s) => { b[s] += k; n += k; }); F.stock[it] = [0, 0, 0]; } persist(); return n; }
  function collect(F, d) {
    const items = Object.entries(F.box).filter(([, q]) => q.some(n => n > 0)); if (!items.length) return;
    const total = boxValue(F, d), detail = items.map(([it, q]) => (ITEMS[it].icon || '') + ' ' + q.reduce((a, b) => a + b, 0) + ' ' + ITEMS[it].name).join(', ');
    F.box = {}; F.ledger.unshift({ day: d, total, detail }); F.ledger.length = Math.min(F.ledger.length, 12);
    const pay = () => { window.CityLife?.credit?.(total, 'Cooperativa Agro City · sítio'); notify('🚚 O coletor da Cooperativa Agro City buscou sua produção: ' + money(total)); persist(); };
    const p = P(), w = toWorld(F, BOX.u, BOX.v);
    if (p && Math.hypot(p.x - w[0], p.y - w[1]) < 90) collectorVisit(F, pay); else pay();
  }
  // picape da cooperativa na porteira; o coletor vai até a caixa, carrega e volta
  async function collectorVisit(F, pay) {
    const H = (bridge.houses || []).find(h => Realty()?.id?.(h) === F.id), road = H?.walk?.[1] || toWorld(F, 0, V0 - 4), gate = toWorld(F, 0, V0 + .5), bx = toWorld(F, BOX.u, BOX.v - 1.1);
    const truck = bridge.addBox({ x: road[0], y: road[1], w: 4.9, d: 1.95, h: 1.7, z: 0, rot: yawOf(F) + Math.PI / 2, kind: 'parkedcar', modelId: 'pickup', col: '#2e6b3a', top: '#2e6b3a', side: '#2e6b3a', display: true, solid: true, farm: true, draw: typeof drawParkedCar === 'function' ? drawParkedCar : undefined, vehicleKey: 'coop:' + F.id });
    const chars = window.cityCharacters; let n = null;
    try { n = await chars?.spawnExtra?.(road[0] + 1.5, road[1] + 1.5, {}); } catch (_) {}
    if (n) { chars.say?.(n, 'Boa tarde! Vim buscar a produção.', '🚚'); chars.releaseExtra?.(n, { x: gate[0], y: gate[1] }); }
    setTimeout(() => { if (n) chars.releaseExtra?.(n, { x: bx[0], y: bx[1] }); }, 6000);
    setTimeout(() => { pay(); if (n) { chars.say?.(n, 'Tudo carregado. Pagamento feito!', '💵'); chars.releaseExtra?.(n, { x: road[0], y: road[1], leave: true }); } }, 13000);
    setTimeout(() => { if (n) chars.removeExtra?.(n); truck.fleetHidden = true; truck.solid = false; }, 24000);
  }

  // ======================= interação (F) =======================
  function farmAt(p) { for (const F of Object.values(save.farms)) { const [u, v] = toLocal(F, p.x, p.y); if (u > U0 - 1 && u < U1 + 1 && v > V0 - 2 && v < V1 + 1) return { F, u, v }; } return null; }
  function tileFor(F, p) {
    const f = frame(F), fx = Math.cos(p.face || 0), fy = Math.sin(p.face || 0), x = p.x + fx * .55, y = p.y + fy * .55, [u, v] = toLocal(F, x, y);
    const i = Math.floor(u - FIELD.u0), j = Math.floor(v - FIELD.v0);
    if (i < 0 || j < 0 || i >= FIELD.u1 - FIELD.u0 || j >= FIELD.v1 - FIELD.v0 || !tileOk(F, i, j)) return null; return [i, j];
  }
  function tileAction(F, i, j, doIt) {
    const k = tileKey(i, j), t = F.tiles[k], d = day(), sel = save.sel, c = CROPS[sel];
    if (!t) return doIt ? (F.tiles[k] = { s: 'tilled' }, 'arou') : 'Arar a terra';
    if (!t.crop) { if ((save.seeds[sel] || 0) <= 0) return doIt ? null : 'Plantar ' + c.name + ' · sem sementes (app Fazenda)';
      return doIt ? (save.seeds[sel]--, Object.assign(t, { crop: sel, g: 0, wd: 0, pd: d, ready: false }), 'plantou') : 'Plantar ' + c.icon + ' ' + c.name + ' (' + save.seeds[sel] + ')'; }
    const C = CROPS[t.crop];
    if (t.ready) { if (!doIt) return 'Colher ' + C.icon + ' ' + C.name;
      const star = t.wd >= C.days * 1.6 ? 2 : t.wd >= C.days ? 1 : 0; addStock(F, t.crop, C.yield, star);
      if (C.regrow) Object.assign(t, { g: Math.max(0, C.days - C.regrow), ready: false }); else F.tiles[k] = { s: 'tilled' };
      return 'colheu'; }
    if (t.lw === d) return doIt ? null : C.name + ' regado · faltam ' + Math.max(1, C.days - t.g) + ' dia(s)';
    return doIt ? (t.lw = d, 'regou') : 'Regar ' + C.icon + ' ' + C.name;
  }
  function useSpot(F, u, v) {   // construção perto: o ponto de uso de cada uma
    for (let i = 0; i < PADS.length; i++) { const kind = F.pads[i], info = scenes.get(F.id)?.pads[i]?.info; if (!kind || !info) continue;
      if (Math.hypot(u - (PADS[i].u + info.use[0]), v - (PADS[i].v + info.use[1])) < 2.2) return { i, kind }; }
    return null;
  }
  function spotAction(F, s, doIt) {
    const out = F.out[s.kind] || {};
    if (['galinheiro', 'curral', 'aprisco'].includes(s.kind)) {
      const A = Object.values(ANIMALS).find(a => a.home === s.kind), pid = A.product, have = out[pid] || 0, pets = F.animals.filter(a => a.type === Object.keys(ANIMALS).find(k => ANIMALS[k].home === s.kind));
      if (have > 0) return doIt ? (addStock(F, pid, have, pets.length >= 3 ? 1 : 0), out[pid] = 0, 'coletou ' + have + ' ' + ITEMS[pid].name) : 'Coletar ' + have + ' ' + ITEMS[pid].icon + ' ' + ITEMS[pid].name;
      const hungry = pets.filter(a => a.fed !== day()); if (!pets.length) return doIt ? null : BUILDINGS[s.kind].name + ' vazio · compre animais no app';
      if (!hungry.length) return doIt ? null : 'Animais alimentados hoje';
      // ração do estoque e, se houver, a do silo
      const need = hungry.length * A.feed, inSilo = F.pads.includes('silo') ? F.silo : 0, have2 = save.feed + inSilo;
      if (have2 < need) return doIt ? null : 'Alimentar · falta ração (' + have2 + '/' + need + ') · compre no app';
      if (doIt) { const k = Math.min(save.feed, need); save.feed -= k; F.silo -= need - k; hungry.forEach(a => a.fed = day()); return 'alimentou'; }
      return 'Alimentar ' + hungry.length + ' ' + A.name.toLowerCase() + '(s) · ' + need + ' de ração';
    }
    if (s.kind === 'silo') { if (save.feed > 0 && F.silo < SILO_CAP) { const k = Math.min(save.feed, SILO_CAP - F.silo); return doIt ? (save.feed -= k, F.silo += k, 'abasteceu o silo') : 'Abastecer o silo com ' + k + ' de ração (' + F.silo + '/' + SILO_CAP + ')'; } return doIt ? null : 'Silo: ' + F.silo + '/' + SILO_CAP + ' de ração'; }
    if (s.kind === 'galpao') { if (F.proc) return doIt ? null : 'Galpão trabalhando · pronto amanhã'; const can = RECIPES.filter(r => Object.entries(r.in).every(([it, n]) => count(F, it) >= n));
      if (!can.length) return doIt ? null : 'Galpão: nada para beneficiar (leite, tomate, morango, lã, ovos, milho)';
      if (!doIt) return 'Beneficiar a produção (' + can.map(r => r.name).join(', ') + ')';
      const out = {}; for (const r of can) { let n = 0; while (Object.entries(r.in).every(([it, k]) => count(F, it) >= k)) { for (const [it, k] of Object.entries(r.in)) takeStock(F, it, k); n++; } for (const [it, k] of Object.entries(r.out)) out[it] = (out[it] || 0) + k * n; }
      F.proc = { day: day() + 1, out }; return 'beneficiou'; }
    if (s.kind === 'caixadagua') return doIt ? null : 'Irrigação automática: rega a lavoura toda manhã';
    return null;
  }
  function prompt(p) {
    if (!p || window.cityVehicles?.driver) return null; const at = farmAt(p); if (!at) return null; const { F, u, v } = at;
    if (Math.hypot(u - BOX.u, v - BOX.v) < 1.7) { const n = Object.values(F.stock).reduce((a, q) => a + q.reduce((x, y) => x + y, 0), 0); return n ? 'F · Pôr ' + n + ' produto(s) na caixa da cooperativa (coleta 19h)' : 'Caixa da cooperativa · ' + money(boxValue(F)) + ' à espera da coleta das 19h'; }
    const s = useSpot(F, u, v); if (s) { const t = spotAction(F, s, false); return t ? 'F · ' + t : null; }
    const tl = tileFor(F, p); if (tl) return 'F · ' + tileAction(F, tl[0], tl[1], false) + (typeof input !== 'undefined' ? ' · Shift+F: 3×3' : '');
    return null;
  }
  function interact(p) {
    if (!p || window.cityVehicles?.driver) return false; const at = farmAt(p); if (!at) return false; const { F, u, v } = at;
    if (Math.hypot(u - BOX.u, v - BOX.v) < 1.7) { const n = deposit(F); return n ? '📦 ' + n + ' produto(s) na caixa · valor hoje ' + money(boxValue(F)) : 'A caixa espera o coletor às 19h'; }
    const s = useSpot(F, u, v); if (s) { const r = spotAction(F, s, true); if (r) { persist(); const S = scenes.get(F.id); if (S) S.dirty = true; return '🚜 Você ' + r; } return false; }
    const tl = tileFor(F, p); if (!tl) return false;
    const area = typeof input !== 'undefined' && input.down('shift'); let done = 0, last = null;
    for (let di = area ? -1 : 0; di <= (area ? 1 : 0); di++) for (let dj = area ? -1 : 0; dj <= (area ? 1 : 0); dj++) { const i = tl[0] + di, j = tl[1] + dj;
      if (i < 0 || j < 0 || i >= FIELD.u1 - FIELD.u0 || j >= FIELD.v1 - FIELD.v0 || !tileOk(F, i, j)) continue; const r = tileAction(F, i, j, true); if (r) { done++; last = r; } }
    if (!done) return 'Nada a fazer aqui agora';
    persist(); const S = scenes.get(F.id); if (S) S.dirty = true; window.CityAudio?.thump?.(p.x, p.y, 'fall');
    return '🌱 Você ' + last + (done > 1 ? ' ' + done + ' canteiros' : '');
  }

  // ======================= app Fazenda =======================
  const myFarms = () => Object.values(save.farms);
  function action(type, a, b) {
    const F = myFarms()[0];
    if (type === 'route') { if (!F) return { ok: false, text: 'Você ainda não tem um sítio' }; const w = toWorld(F, 0, V0 - 3); window.CityGPS?.set?.({ x: w[0], y: w[1], name: 'Meu sítio' }); return { ok: true, text: 'Rota traçada até o sítio' }; }
    if (type === 'sel') { if (!CROPS[a]) return { ok: false, text: 'Semente inválida' }; save.sel = a; persist(); return { ok: true, text: 'Na mão: sementes de ' + CROPS[a].name }; }
    if (type === 'seed') { const c = CROPS[a], n = +b || 10, cost = c.seed * n; if (!window.CityLife?.debit?.(cost, 'Sementes · ' + c.name)) return { ok: false, text: 'Saldo insuficiente' }; save.seeds[a] = (save.seeds[a] || 0) + n; save.sel = a; persist(); return { ok: true, text: n + ' sementes de ' + c.name + ' compradas' }; }
    if (type === 'feed') { const n = +a || 50, cost = n * FEED_PRICE; if (!window.CityLife?.debit?.(cost, 'Ração')) return { ok: false, text: 'Saldo insuficiente' }; save.feed += n; persist(); return { ok: true, text: n + ' de ração no estoque' }; }
    if (!F) return { ok: false, text: 'Compre um sítio no CasaCerta primeiro' };
    if (type === 'build') { const i = +a, B = BUILDINGS[b]; if (!B || !(i >= 0 && i < PADS.length)) return { ok: false, text: 'Construção inválida' }; if (F.pads[i]) return { ok: false, text: 'Lote ocupado' }; if (F.pads.includes(b) && b !== 'silo') return { ok: false, text: 'Você já tem ' + B.name };
      if (!padOk(F, i)) return { ok: false, text: 'Este lote não tem espaço (rua, água ou casa)' }; if (!window.CityLife?.debit?.(B.price, 'Construção · ' + B.name)) return { ok: false, text: 'Saldo insuficiente' };
      F.pads[i] = b; persist(); const S = scenes.get(F.id); if (S) syncPads(F, S); return { ok: true, text: B.icon + ' ' + B.name + ' construído no lote ' + (i + 1) }; }
    if (type === 'animal') { const A = ANIMALS[a]; if (!A) return { ok: false, text: 'Animal inválido' }; if (!F.pads.includes(A.home)) return { ok: false, text: 'Construa um ' + BUILDINGS[A.home].name + ' primeiro' };
      if (F.animals.filter(x => x.type === a).length >= A.cap) return { ok: false, text: BUILDINGS[A.home].name + ' cheio' }; if (!window.CityLife?.debit?.(A.price, 'Animal · ' + A.name)) return { ok: false, text: 'Saldo insuficiente' };
      F.animals.push({ type: a, id: Date.now() % 1e9 + Math.floor(Math.random() * 1000), fed: -99, age: 0 }); persist(); const S = scenes.get(F.id); if (S) syncAnimals(F, S); return { ok: true, text: A.icon + ' ' + A.name + ' chegou ao sítio' }; }
    if (type === 'mill') { const n = Math.floor(count(F, 'milho') / 2); if (!n) return { ok: false, text: 'Precisa de 2 milhos por moagem' }; takeStock(F, 'milho', n * 2); save.feed += n * 5; persist(); return { ok: true, text: n * 5 + ' de ração feita com milho' }; }
    return { ok: false, text: 'Ação indisponível' };
  }
  function renderApp(h) {   // h: helpers {card, btn, banner, price}
    const F = myFarms()[0], d = day();
    if (!F) return h.banner('<strong>Fazenda</strong><small>Plante, crie, beneficie e venda</small>') +
      h.card('Compre um sítio', 'Os sítios ficam nos bairros rurais e de fazenda (procure casas de campo no mapa). No CasaCerta eles vêm com terreno de 52 × 46 m para lavoura, animais e construções.', '', '🏡');
    const tiles = Object.values(F.tiles), crops = tiles.filter(t => t.crop), ready = crops.filter(t => t.ready).length, dry = crops.filter(t => !t.ready && t.lw !== d).length;
    const stockList = Object.entries(F.stock).filter(([, q]) => q.some(n => n)).map(([it, q]) => ITEMS[it].icon + ' ' + q.reduce((a, b) => a + b, 0) + ' ' + ITEMS[it].name + (q[2] ? ' ★★★' + q[2] : q[1] ? ' ★★' + q[1] : '')).join(' · ') || 'vazio';
    let html = h.banner('<strong>Fazenda · Dia ' + (d - F.created + 1) + '</strong><small>Ração: ' + save.feed + ' · Silo ' + F.silo + '/' + SILO_CAP + ' · coleta 19h</small>');
    html += h.card('Lavoura', crops.length + ' canteiros plantados · ' + ready + ' prontos para colher · ' + dry + ' precisam de água hoje' + (F.pads.includes('caixadagua') ? ' (irrigação ligada)' : ''), h.btn('farm:route', 'GPS até o sítio'), '🌱');
    html += h.card('Estoque', stockList, (F.box && Object.keys(F.box).length ? '' : '') + h.btn('farm:mill', 'Moer milho em ração', count(F, 'milho') < 2), '📦');
    html += h.card('Caixa da cooperativa', 'Na caixa: ' + money(boxValue(F)) + ' (coleta 19h)' + (F.ledger[0] ? ' · última: ' + money(F.ledger[0].total) + ' — ' + F.ledger[0].detail : ''), '', '🚚');
    html += '<h3 class="city-section-title">Semente na mão</h3>' + Object.entries(CROPS).map(([id, c]) => h.card(c.icon + ' ' + c.name + (save.sel === id ? ' · na mão' : ''),
      c.days + ' dias · rende ' + c.yield + (c.regrow ? ' · rebrota a cada ' + c.regrow + ' dias' : '') + ' · você tem ' + (save.seeds[id] || 0) + ' · venda hoje ' + money(fairPrice(id, 0, d)),
      h.btn('farm:sel:' + id, 'Usar', save.sel === id) + ' ' + h.btn('farm:seed:' + id + ':10', '10 por ' + money(c.seed * 10)), '')).join('');
    html += '<h3 class="city-section-title">Construções</h3>' + PADS.map((p, i) => { const k = F.pads[i]; if (k) return h.card('Lote ' + (i + 1) + ' · ' + BUILDINGS[k].icon + ' ' + BUILDINGS[k].name, BUILDINGS[k].detail, '', '');
      if (!padOk(F, i)) return h.card('Lote ' + (i + 1), 'Sem espaço (rua, água ou casa).', '', '');
      return h.card('Lote ' + (i + 1) + ' livre', 'Escolha o que construir:', Object.entries(BUILDINGS).filter(([b]) => !F.pads.includes(b)).map(([b, B]) => h.btn('farm:build:' + i + ':' + b, B.icon + ' ' + B.name + ' ' + money(B.price), (window.CityLife?.funds || 0) < B.price)).join(' '), ''); }).join('');
    html += '<h3 class="city-section-title">Animais e ração</h3>' + Object.entries(ANIMALS).map(([id, A]) => { const n = F.animals.filter(a => a.type === id).length;
      return h.card(A.icon + ' ' + A.name + ' · ' + n + '/' + A.cap, 'Produz ' + ITEMS[A.product].name.toLowerCase() + (A.every > 1 ? ' a cada ' + A.every + ' dias' : ' todo dia') + ' se alimentado · ' + A.feed + ' de ração/dia · mora no ' + BUILDINGS[A.home].name,
        h.btn('farm:animal:' + id, 'Comprar ' + money(A.price), !F.pads.includes(A.home) || n >= A.cap), ''); }).join('') +
      h.card('🌾 Ração', 'Você tem ' + save.feed + '. O silo abastece os comedouros sozinho de manhã.', h.btn('farm:feed:50', '50 por ' + money(50 * FEED_PRICE)) + ' ' + h.btn('farm:feed:200', '200 por ' + money(200 * FEED_PRICE)), '');
    html += '<h3 class="city-section-title">Mercado de hoje</h3>' + h.card('Preço justo da cooperativa', Object.keys(ITEMS).map(it => ITEMS[it].icon + ' ' + money(fairPrice(it, 0, d))).join(' · ') + ' · ★★ +25% · ★★★ +50%', '', '💰');
    return html;
  }

  // ======================= laço =======================
  let lastT = performance.now(), slow = 0;
  function tick() {
    const now = performance.now(), dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
    slow -= dt; if (slow <= 0) { slow = 1.5; ensureFarms(); catchUp(); }
    const c = bridge.cam;
    for (const F of Object.values(save.farms)) {
      const o = F.o, near = c && Math.hypot(o[0] - c.x, o[1] - c.y) < 220;
      let S = scenes.get(F.id);
      if (!S && near) S = buildScene(F);
      if (!S) continue;
      S.root.visible = near;
      if (!near) continue;
      if (S.dirty) rebuildField(F, S);
      if (c && Math.hypot(o[0] - c.x, o[1] - c.y) < 90) animateAnimals(S, dt, now / 1000);
    }
  }
  registerLots();
  for (const F of Object.values(save.farms)) repaintGround(lotRect(F));
  const api = { tick, prompt, interact, action, renderApp, CROPS, ANIMALS, BUILDINGS, ITEMS, get save() { return save; }, _debug: { toWorld, toLocal, scenes, catchUp, dailyUpdate, farmAt, tileFor, PADS, FIELD, BOX } };
  window.CityFarm = api;
  return api;
}
