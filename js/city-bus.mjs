// city-bus.mjs — transporte público: linhas de ônibus numeradas e coloridas que rodam o mapa o tempo todo, pontos de
// ônibus (abrigo de vidro com banco, painel e placa das linhas) e o jogador pegando o ônibus que está passando.
//  · As linhas são montadas a partir dos lugares públicos de verdade (prefeitura, hospital, delegacia, universidade,
//    escola, rodoviária, shopping, estádio, mercado…): cada linha pública faz um circuito por uma região e todas passam
//    pelo terminal do Centro (dá p/ baldear). A linha escolar (ônibus amarelo) liga escolas e universidade.
//  · O percurso usa a malha das avenidas/ruas principais (OW.cw.roads, sempre asfalto de verdade), na faixa da direita
//    junto ao meio-fio; pontos intermediários a cada ~350 m. Longe do jogador o ônibus é só um número (posição na linha);
//    perto, ganha o modelo 3D, colide e freia p/ carro e pedestre na frente.
//  · No ponto (F): escolhe o destino, espera o ônibus da linha (previsão de chegada), sobe sozinho quando ele para,
//    a câmera acompanha a viagem (dá p/ acelerar) e desce no ponto escolhido. Tarifa R$ 4,50; escolar é grátis p/ quem
//    está matriculado na universidade.
// Regras puras (montagem das linhas, posição/tempo na linha) exportadas p/ os testes.
import {loadVehicleGLB} from './vehicle-asset-cache.mjs';
import {VEHICLE_MODELS} from './vehicle-catalog.mjs';
import {leadAhead, stopSpeed, signalStop, junctionStop, JUNCTION_R} from './ai-traffic.mjs';

const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const FARE = 4.5, DWELL = 7, CRUISE = { street: 9.5, avenue: 12.5, highway: 15 };
export const LINE_STYLE = [
  { num: '101', color: '#1f6fd1', name: 'Centro · Norte' },
  { num: '202', color: '#1e9e5a', name: 'Centro · Leste' },
  { num: '303', color: '#e8761c', name: 'Centro · Sul' },
  { num: '404', color: '#8a3fc6', name: 'Centro · Oeste' }
];
export const SCHOOL_STYLE = { num: 'E1', color: '#f2b705', name: 'Escolar · Universidade', school: true };
const PUBLIC_SITE = new Set(['hospital', 'police', 'cityhall', 'dealer', 'university', 'school', 'medclinic', 'vetclinic', 'lawoffice', 'autoshop', 'restaurant', 'barbershop']);
const LANDMARK_SKIP = new Set(['cityhall', 'police', 'hospital', 'university', 'military']);   // já vêm dos prédios reais (civicSites); quartel não

// ---------------- montagem das linhas (puro) ----------------
// ordem de "fama" p/ dar nome à linha (o último é o mais famoso)
const FAME = ['stop', 'barbershop', 'autoshop', 'vetclinic', 'lawoffice', 'medclinic', 'restaurant', 'dealer', 'depot', 'church', 'market', 'police', 'hospital', 'university', 'port', 'lighthouse', 'mall', 'stadium', 'bus', 'airport'];
// faixa do ônibus: a da direita, ~1,6 m do meio-fio (rua com vagas: antes das vagas)
export const busLane = road => { const half = (road?.w || 7) / 2, park = road?.cls === 'street' && road.w >= 10 ? 2.2 : 0; return Math.max(1.4, half - park - 1.6); };
export function cumulative(P) { const c = [0]; for (let i = 1; i < P.length; i++) c.push(c[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return c; }
// posição e direção na linha (circular) a s metros do início
export function posAt(line, s) {
  const L = line.len, P = line.path, C = line.cum; s = ((s % L) + L) % L;
  let lo = 0, hi = C.length - 1; while (lo < hi - 1) { const m = (lo + hi) >> 1; if (C[m] <= s) lo = m; else hi = m; }
  const a = P[lo], b = P[hi] || P[0], seg = (C[hi] - C[lo]) || 1, t = (s - C[lo]) / seg;
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, a: Math.atan2(b[1] - a[1], b[0] - a[0]), i: lo };
}
// metros até o ponto (sempre p/ frente na linha circular)
export const ahead = (line, from, to) => ((to - from) % line.len + line.len) % line.len;
// destinos públicos: prédios reais + marcos do mapa (sem repetir o que já existe)
export function destinations(sites = [], landmarks = []) {
  const out = sites.filter(s => PUBLIC_SITE.has(s.kind)).map(s => ({ name: s.name, kind: s.kind, x: s.x, y: s.y }));
  for (const l of landmarks) {
    if (!l?.name || LANDMARK_SKIP.has(l.kind)) continue;
    if (out.some(o => Math.hypot(o.x - l.x, o.y - l.y) < 120)) continue;
    out.push({ name: l.name, kind: l.kind, x: l.x, y: l.y });
  }
  return out;
}
// tira do percurso os trechos de "vai e volta": quando a rota entra numa rua e volta por ela (ponto no fim de um trecho,
// rua sem saída, ligação de um ponto ao seguinte que começa no sentido contrário) o ônibus faria meia-volta no meio da
// via. Acha a ponta da meia-volta, anda p/ os dois lados enquanto ida e volta passam pelos mesmos pontos e corta tudo,
// emendando no último ponto em comum (o cruzamento), sem cortar esquina. Percurso circular (índices em volta)
export function removeRetraces(raw, tol = 6) {
  let P = raw.slice();
  for (let guard = 0; guard < 80 && P.length > 4; guard++) {
    const n = P.length; let cut = null;
    for (let r = 0; r < n && !cut; r++) {
      const a = P[(r - 1 + n) % n], b = P[r], c = P[(r + 1) % n];
      const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1], lu = Math.hypot(ux, uy) || 1, lv = Math.hypot(vx, vy) || 1;
      if ((ux * vx + uy * vy) / (lu * lv) > -.85) continue;                     // não é meia-volta
      let k = 1; while (k < n / 2 - 1 && Math.hypot(P[(r - k + n) % n][0] - P[(r + k) % n][0], P[(r - k + n) % n][1] - P[(r + k) % n][1]) < tol) k++;
      if (k < 2) continue;                                                      // curva fechada de verdade, não ida e volta
      cut = new Set(); for (let t = -(k - 2); t <= k - 1; t++) cut.add((r + t + n) % n);   // fica o último ponto comum (r−k+1)
    }
    if (!cut) break;
    P = P.filter((_, i) => !cut.has(i));
  }
  return P;
}
// percurso circular passando pelos pontos na ordem dada; devolve a linha pronta (faixa, distâncias, pontos com s)
export function makeLine(style, stops, net, roads, extraEvery = 350) {
  if (stops.length < 2) return null;
  // cada trecho sai do ponto no MESMO sentido em que o ônibus chegou (routeDirected: sem meia-volta, nem no cruzamento);
  // duas passadas p/ o circuito fechar no terminal também sem meia-volta. Sem caminho assim (rua sem saída), a rota comum
  let raw = [], arrive = null;
  const dirOf = P => { for (let i = P.length - 1; i > 0; i--) { const dx = P[i][0] - P[i - 1][0], dy = P[i][1] - P[i - 1][1]; if (Math.hypot(dx, dy) > .5) return [dx, dy]; } return null; };
  for (let pass = 0; pass < 2; pass++) {
    raw = []; let heading = arrive;
    for (let k = 0; k < stops.length; k++) {
      const a = stops[k], b = stops[(k + 1) % stops.length], A = { x: a.cx, y: a.cy }, B = { x: b.cx, y: b.cy };
      const r = (net.routeDirected && net.routeDirected(A, B, heading)) || net.route(A, B);
      if (!r || r.points.length < 2) return null;
      for (const p of r.points) if (!raw.length || Math.hypot(p[0] - raw[raw.length - 1][0], p[1] - raw[raw.length - 1][1]) > .3) raw.push([p[0], p[1]]);
      heading = dirOf(r.points) || heading;
    }
    arrive = heading;
  }
  // sem vai-e-volta; reamostra a cada ~2 m e desloca p/ a faixa da direita (largura da via no ponto)
  const flow = removeRetraces(raw), dense = [];
  for (let i = 0; i < flow.length; i++) { const a = flow[i], b = flow[(i + 1) % flow.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 2)); for (let s = 0; s < n; s++) dense.push([a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n]); }
  const path = dense.map((p, i) => {
    const a = dense[(i - 2 + dense.length) % dense.length], b = dense[(i + 2) % dense.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const fx = (b[0] - a[0]) / l, fy = (b[1] - a[1]) / l, seg = net.nearest(p[0], p[1])?.seg, lane = busLane(roads[seg?.roadId]);
    return [p[0] - fy * lane, p[1] + fx * lane];
  });
  // suaviza as quinas (média móvel) p/ o ônibus longo fazer a curva aberta
  const smooth = path.map((p, i) => { let x = 0, y = 0; for (let k = -2; k <= 2; k++) { const q = path[(i + k + path.length) % path.length]; x += q[0]; y += q[1]; } return [x / 5, y / 5]; });
  const line = { ...style, id: style.num, path: smooth, cum: null, len: 0, stops: [] };
  line.cum = cumulative(smooth); line.len = line.cum[line.cum.length - 1] + Math.hypot(smooth[0][0] - smooth[smooth.length - 1][0], smooth[0][1] - smooth[smooth.length - 1][1]);
  const sOf = (x, y) => { let best = 0, bd = Infinity; for (let i = 0; i < smooth.length; i += 1) { const d = Math.hypot(smooth[i][0] - x, smooth[i][1] - y); if (d < bd) { bd = d; best = i; } } return line.cum[best]; };
  // cada destino para no ponto do percurso mais perto dele; se o percurso (sem o vai-e-volta) passa longe demais, a
  // linha não atende aquele destino (o terminal sempre fica)
  const near = (x, y) => { let bd = Infinity; for (let i = 0; i < smooth.length; i += 2) bd = Math.min(bd, Math.hypot(smooth[i][0] - x, smooth[i][1] - y)); return bd; };
  for (const st of stops) if (st.kind === 'hub' || near(st.cx, st.cy) < 160) line.stops.push({ ...st, s: sOf(st.cx, st.cy) });
  line.stops.sort((a, b) => a.s - b.s);
  // pontos intermediários onde o trecho entre dois pontos passa de ~420 m
  const extra = [];
  for (let k = 0; k < line.stops.length; k++) {
    const a = line.stops[k], b = line.stops[(k + 1) % line.stops.length], gap = ahead(line, a.s, b.s);
    for (let n = Math.floor(gap / extraEvery), j = 1; j <= n && gap > extraEvery * 1.2; j++) { const s = (a.s + gap * j / (n + 1)) % line.len, p = posAt(line, s); extra.push({ name: null, kind: 'stop', s, cx: p.x, cy: p.y }); }
  }
  line.stops.push(...extra); line.stops.sort((a, b) => a.s - b.s);
  // abrigo na calçada, do lado direito do sentido; nome = destino ou a rua
  for (const st of line.stops) {
    const p = posAt(line, st.s), q = net.nearest(p.x, p.y), road = roads[q?.seg?.roadId], half = (road?.w || 7) / 2;
    const rx = -Math.sin(p.a), ry = Math.cos(p.a), c = q ? [q.x, q.y] : [p.x, p.y];
    Object.assign(st, { x: p.x, y: p.y, a: p.a, sx: c[0] + rx * (half + 1.7), sy: c[1] + ry * (half + 1.7), street: road?.streetName || 'Avenida' });
    if (!st.name) st.name = st.street;
  }
  return line;
}
// divide os destinos em regiões em volta do centro e monta as linhas (puro: net, roads, sites e landmarks entram)
// ponto de parada p/ um destino: a rua mais perto DE ONDE O ÔNIBUS SAI NOS DOIS SENTIDOS (não fim de rua sem saída,
// onde ele teria de fazer meia-volta). Procura em anéis em volta do destino; sem rota com sentido, a mais perto
export function viableSnap(net, d, hub) {
  const near0 = net.nearest(d.x, d.y); if (!near0) return null;
  if (!net.routeDirected || !hub) return near0.d < 140 ? near0 : null;
  const cands = [near0];
  for (let r = 25; r <= 175; r += 25) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, q = net.nearest(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r); if (q) cands.push(q); }
  const seen = new Set(), list = cands.map(q => ({ q, dd: Math.hypot(q.x - d.x, q.y - d.y) })).filter(o => o.dd < 200).sort((a, b) => a.dd - b.dd);
  for (const { q } of list) {
    const key = Math.round(q.x) + ',' + Math.round(q.y); if (seen.has(key)) continue; seen.add(key);
    const sx = q.seg.b[0] - q.seg.a[0], sy = q.seg.b[1] - q.seg.a[1], P = { x: q.x, y: q.y };
    if (net.routeDirected(P, hub, [sx, sy]) && net.routeDirected(P, hub, [-sx, -sy])) return q;
    if (seen.size > 40) break;
  }
  return near0.d < 140 ? near0 : null;
}
export function buildLines({ net, roads, sites = [], landmarks = [], hub }) {
  const hub0 = hub ? net.nearest(hub.x, hub.y) : null, hubP = hub0 ? { x: hub0.x, y: hub0.y } : null;
  const all = destinations(sites, landmarks).map(d => { const q = viableSnap(net, d, hubP); return q ? { ...d, cx: q.x, cy: q.y } : null; }).filter(Boolean);
  if (all.length < 3) return [];
  const c = hub ? { x: hub.x, y: hub.y } : { x: all.reduce((s, d) => s + d.x, 0) / all.length, y: all.reduce((s, d) => s + d.y, 0) / all.length };
  const hq = net.nearest(c.x, c.y), H = { name: 'Terminal Centro', kind: 'hub', x: c.x, y: c.y, cx: hq.x, cy: hq.y };
  const school = all.filter(d => d.kind === 'school' || d.kind === 'university');
  const pub = all.filter(d => d.kind !== 'school' && Math.hypot(d.cx - H.cx, d.cy - H.cy) > 80);
  const groups = LINE_STYLE.map(() => []);
  for (const d of pub) { const ang = (Math.atan2(d.y - c.y, d.x - c.x) + TAU + Math.PI / 4) % TAU; groups[Math.min(3, Math.floor(ang / (TAU / 4)))].push(d); }
  const lines = [];
  LINE_STYLE.forEach((style, k) => {
    const g = groups[k]; if (!g.length) return;
    // circuito: terminal, depois os destinos em ordem de ângulo em volta do centro do grupo
    const gc = { x: g.reduce((s, d) => s + d.x, 0) / g.length, y: g.reduce((s, d) => s + d.y, 0) / g.length };
    const ord = g.slice().sort((a, b) => Math.atan2(a.y - gc.y, a.x - gc.x) - Math.atan2(b.y - gc.y, b.x - gc.x)).slice(0, 7);
    // nome da linha = o destino mais conhecido dela (Centro ⇄ Estádio), não um ponto cardeal
    const star = ord.slice().sort((a, b) => FAME.indexOf(b.kind) - FAME.indexOf(a.kind))[0];
    const ln = makeLine({ ...style, name: 'Centro ⇄ ' + (star?.name || style.name).replace(/^City Motors · /, 'City Motors ') }, [H, ...ord], net, roads); if (ln) lines.push(ln);
  });
  if (school.length) { const ln = makeLine(SCHOOL_STYLE, [H, ...school], net, roads); if (ln) lines.push(ln); }
  return lines;
}

// ---------------- no mundo ----------------
export function createBuses(THREE, scene, bridge, { people = () => [] } = {}) {
  const world = bridge.world; world.aiCars = world.aiCars || [];
  const state = { lines: 0, buses: 0, shown: 0, rides: 0, ready: false };
  let lines = [], buses = [], stops = [], graph = null, built = false, plan = null, ride = null, ui = null, banner = null, fast = false;
  const P = () => bridge.player;
  const net = () => { const src = (typeof OW !== 'undefined' && OW.cw?.roads) || []; if (!graph && src.length && window.CityRoadRouting) graph = window.CityRoadRouting.build(src, 1); return graph; };
  function build() {
    if (built) return; const g = net(); if (!g) return;
    const sites = world.civicSites || [], lm = (typeof OW !== 'undefined' && OW.cw?.landmarks) || [];
    const hubL = lm.find(l => l.kind === 'cityhall') || sites.find(s => s.kind === 'cityhall');
    lines = buildLines({ net: g, roads: OW.cw.roads, sites, landmarks: lm, hub: hubL }); built = true;
    // um mesmo ponto físico pode servir várias linhas (terminal): agrupa por proximidade
    stops = [];
    for (const ln of lines) for (const st of ln.stops) {
      let s = stops.find(o => Math.hypot(o.sx - st.sx, o.sy - st.sy) < 14);
      if (!s) { s = { id: 'p' + stops.length, name: st.name, kind: st.kind, sx: st.sx, sy: st.sy, a: st.a, lines: [] }; stops.push(s); }
      if (st.kind !== 'stop' && s.kind === 'stop') { s.name = st.name; s.kind = st.kind; }
      s.lines.push({ line: ln, stop: st }); st.shared = s;
    }
    // frota: ônibus espalhados pela linha (1 a cada ~1,6 km, mín. 2; escolar 2)
    // saídas defasadas por linha (senão todos começam juntos no terminal, um em cima do outro)
    lines.forEach((ln, li) => { const n = ln.school ? 2 : Math.max(2, Math.min(4, Math.round(ln.len / 1600))); for (let k = 0; k < n; k++) buses.push({ line: ln, s: (ln.len * k / n + 140 + li * 173) % ln.len, speed: 0, dwell: 0, lastStop: -1, id: ln.num + '-' + (k + 1), x: 0, y: 0, a: 0, mesh: null, box: null }); });
    state.lines = lines.length; state.buses = buses.length; state.ready = true;
  }

  // ---------- modelos ----------
  const civil = { 'city-bus': null, 'school-bus': null };
  // modelos do pacote civil só quando instalados (entram em VEHICLE_MODELS pelo npm run import:civil); senão, procedurais
  for (const id of Object.keys(civil)) { const cfg = VEHICLE_MODELS.find(m => m.id === id); if (cfg) loadVehicleGLB(cfg).then(g => { civil[id] = { g, cfg }; }).catch(() => { civil[id] = false; }); }
  const MAT = {}; const mat = (c, o = {}) => MAT[c + JSON.stringify(o)] || (MAT[c + JSON.stringify(o)] = new THREE.MeshStandardMaterial({ color: c, roughness: .55, metalness: .1, ...o }));
  const box = (g, w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  function signTex(text, bg, fg = '#ffcf3a', w = 512, h = 96) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = 'bold ' + (h * .62) + 'px "Arial Narrow",Arial,sans-serif'; g.textBaseline = 'middle'; g.fillText(text, 14, h / 2 + 2, w - 28);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  // ônibus urbano (12 m, piso baixo) e escolar (9 m, amarelo), procedurais; frente p/ +X
  function busModel(line) {
    const g = new THREE.Group(), school = !!line.school, L = school ? 9 : 12, W = 2.55, Hh = school ? 2.9 : 3.05;
    const body = school ? '#f2b705' : '#f2f4f5', stripe = school ? '#141414' : line.color;
    box(g, L, Hh - .55, W, 0, .35 + (Hh - .55) / 2, 0, mat(body, { roughness: .4 }));
    box(g, L - .1, .12, W + .02, 0, 1.0, 0, mat(stripe));                                                   // faixa da linha
    box(g, L - .4, .9, W + .03, -.1, 1.95, 0, mat('#1d2a33', { roughness: .15, metalness: .5 }));            // janelas
    for (let i = 0; i < (school ? 7 : 9); i++) box(g, .08, .9, W + .05, -L / 2 + 1.2 + i * (L - 2) / (school ? 6 : 8), 1.95, 0, mat(body));   // colunas
    box(g, .1, 1.6, W - .3, L / 2 + .02, 1.55, 0, mat('#1d2a33', { roughness: .1, metalness: .5 }));           // para-brisa
    box(g, L, .14, W, 0, Hh - .15, 0, mat(school ? '#f2b705' : '#d9dde0'));                                 // teto
    if (!school) { box(g, 2.2, .35, 1.4, -L / 4, Hh + .12, 0, mat('#cfd3d6')); box(g, 1.2, .3, 1.2, L / 4, Hh + .1, 0, mat('#cfd3d6')); }   // ar-condicionado
    // portas (lado direito = −z local… o lado da calçada é +z no mundo após o giro): duas portas de vidro
    for (const dx of school ? [L / 2 - 1.1] : [L / 2 - 1.2, -.6]) box(g, 1.1, 2.1, .04, dx, 1.4, W / 2 + .02, mat('#2a3b45', { roughness: .1, metalness: .4 }));
    // letreiro de LED com número e nome
    const tex = signTex(line.num + '  ' + (school ? 'ESCOLAR' : line.name.toUpperCase()), '#111', school ? '#ffd23a' : '#ffb02e');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, .34), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    sign.rotation.y = Math.PI / 2; sign.position.set(L / 2 + .06, Hh - .45, 0); g.add(sign);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .32), new THREE.MeshBasicMaterial({ map: signTex(line.num, line.color, '#fff', 256, 96), toneMapped: false }));
    side.position.set(L / 2 - 2.6, 2.75, W / 2 + .03); g.add(side); const side2 = side.clone(); side2.rotation.y = Math.PI; side2.position.z = -W / 2 - .03; g.add(side2);
    if (school) for (const z of [-1, 1]) box(g, L - .3, .06, .02, 0, .7, z * (W / 2 + .02), mat('#141414'));   // frisos pretos
    // rodas e faróis
    for (const x of school ? [L / 2 - 1.6, -L / 2 + 1.9] : [L / 2 - 2.2, -L / 2 + 2.6]) for (const z of [-1, 1]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .32, 18), mat('#151617', { roughness: .9 })); wh.rotation.x = Math.PI / 2; wh.position.set(x, .5, z * (W / 2 - .12)); g.add(wh);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .34, 12), mat('#9aa0a4', { metalness: .6 })); hub.rotation.x = Math.PI / 2; hub.position.copy(wh.position); g.add(hub);
    }
    for (const z of [-.9, .9]) { box(g, .06, .2, .4, L / 2 + .03, .75, z, mat('#fff8de', { emissive: '#fff4c8', emissiveIntensity: .6 })); box(g, .06, .25, .3, -L / 2 - .03, .9, z, mat('#c0171b', { emissive: '#7a0a0c', emissiveIntensity: .4 })); }
    g.userData.L = L; g.userData.W = W; return g;
  }
  function civilModel(line) {
    const c = civil[line.school ? 'school-bus' : 'city-bus']; if (!c) return null;
    const root = c.g.scene.clone(true); root.updateMatrixWorld(true);
    const bx = new THREE.Box3().setFromObject(root), dim = bx.getSize(new THREE.Vector3()), ctr = bx.getCenter(new THREE.Vector3());
    const pos = new THREE.Group(); pos.position.set(-ctr.x, -bx.min.y, -ctr.z); pos.add(root);
    const s = c.cfg.length / Math.max(dim.x, dim.z), sc = new THREE.Group(); sc.scale.setScalar(s); sc.add(pos);
    const al = new THREE.Group(); al.rotation.y = Math.PI / 2; al.add(sc); al.userData.L = c.cfg.length; al.userData.W = c.cfg.width; return al;
  }
  // abrigo do ponto: estrutura de aço, teto curvo, vidro nas costas e lateral, banco, painel de anúncio iluminado e placa
  // com as linhas que param ali (cores e números)
  function shelterModel(st) {
    const g = new THREE.Group(), steel = mat('#4a5157', { metalness: .6, roughness: .35 }), glass = new THREE.MeshStandardMaterial({ color: '#bcd6df', roughness: .05, metalness: .3, transparent: true, opacity: .35 });
    for (const x of [-1.7, 1.7]) for (const z of [-.55, .55]) box(g, .08, 2.5, .08, x, 1.25, z, steel);
    // local +z = lado das casas (o ônibus para do lado −z): vidro e banco no fundo, placa no meio-fio
    const roof = box(g, 3.9, .07, 1.7, 0, 2.55, .05, mat('#e3e9ec', { roughness: .3 })); roof.rotation.x = -.06; box(g, 3.9, .14, .06, 0, 2.5, -.8, mat('#c9d1d6'));
    box(g, 3.5, 1.9, .03, 0, 1.4, .58, glass); box(g, .03, 1.9, 1.1, -1.72, 1.4, 0, glass); box(g, 3.5, .06, .05, 0, .45, .58, steel); box(g, 3.5, .06, .05, 0, 2.35, .58, steel);
    box(g, 2.6, .07, .42, .2, .48, .3, mat('#8a5a36')); box(g, 2.6, .04, .04, .2, .44, .12, steel); for (const x of [-.9, 1.3]) box(g, .05, .45, .4, x, .23, .3, steel);
    const ad = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.7), new THREE.MeshBasicMaterial({ map: signTex('CITY OF GOD · TRANSPORTE', '#0e3a5a', '#fff', 256, 96), toneMapped: false }));
    ad.position.set(1.69, 1.35, 0); ad.rotation.y = -Math.PI / 2; g.add(ad); box(g, .06, 1.8, 1.2, 1.72, 1.35, 0, steel);
    // placa de ponto com as linhas
    box(g, .07, 3.0, .07, 2.15, 1.5, -.55, steel);
    const nums = st.lines.map(l => l.line.num), tex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64 + nums.length * 56; const x = c.getContext('2d');
      x.fillStyle = '#0d2b45'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; x.font = 'bold 40px Arial'; x.fillText('🚌 PONTO', 18, 46);
      st.lines.forEach((l, i) => { x.fillStyle = l.line.color; x.fillRect(16, 64 + i * 56, 224, 46); x.fillStyle = l.line.school ? '#111' : '#fff'; x.font = 'bold 34px Arial'; x.fillText(l.line.num, 28, 99 + i * 56); });
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { t, h: c.height / 256 * .7 }; })();
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(.7, tex.h), new THREE.MeshBasicMaterial({ map: tex.t, toneMapped: false, side: THREE.DoubleSide }));
    plate.position.set(2.15, 2.75 - tex.h / 2, -.5); g.add(plate);
    return g;
  }

  // ---------- simulação ----------
  const stopIdx = (b) => { const L = b.line; let best = null, bd = Infinity; for (let i = 0; i < L.stops.length; i++) { const d = ahead(L, b.s, L.stops[i].s); if (d < bd) { bd = d; best = i; } } return { i: best, d: bd }; };
  // segundos até o ônibus chegar a um ponto (aproximação com a velocidade de cruzeiro + paradas no caminho)
  function eta(b, stop) { const d = ahead(b.line, b.s, stop.s), n = b.line.stops.filter(s => ahead(b.line, b.s, s.s) < d).length; return d / 10 + n * DWELL + (b.dwell > 0 ? b.dwell : 0); }
  function obstacles() {
    const list = []; const V = window.cityVehicles;
    for (const o of world.aiCars) if (!o.bus) list.push({ x: o.x, y: o.y, half: o.hw, len: o.hl, speed: o.unit?.speed || 0 });
    if (V?.car) list.push({ x: V.car.x, y: V.car.y, half: 1, len: 2.3, speed: V.driver ? V.car.speed || 0 : 0, player: true });
    for (const h of people()) if (h && !h.dead && h !== P()) list.push({ x: h.x, y: h.y, half: .35, len: .3, person: true });
    if (!ride && P()) list.push({ x: P().x, y: P().y, half: .35, len: .3, person: true });
    return list;
  }
  function step(b, dt, obs) {
    const L = b.line, p = P(), near = p && Math.hypot(b.x - p.x, b.y - p.y) < 170;
    if (b.dwell > 0) { b.dwell -= dt; b.speed = 0; return; }
    const { i, d } = stopIdx(b), st = L.stops[i];
    // limite da via (avenida, rua) — consultado 1×/s
    if ((b.clsT = (b.clsT || 0) - dt) <= 0) { b.clsT = 1; b.cls = net()?.nearest(b.x, b.y)?.seg?.cls || 'street'; }
    let v = CRUISE[b.cls] || 10;
    // curva à frente: reduz conforme o quanto a direção muda nos próximos 18 m
    const here = posAt(L, b.s), fwd = posAt(L, b.s + 18), turn = Math.abs(angDiff(here.a, fwd.a)); if (turn > .25) v = Math.min(v, Math.max(4, 11 - turn * 6));
    // parada no ponto
    // (o ponto é guardado pelo objeto, não pelo índice: os pontos são reordenados quando o abrigo é ajustado)
    if (d < 70 && st !== b.lastStop) { v = Math.min(v, stopSpeed(d - .5) + .3); if (d < .8) { b.dwell = DWELL; b.lastStop = st; b.atStop = st; b.speed = 0; return; } }
    if (d > 3 && b.lastStop === st) b.lastStop = null;
    if (st !== b.lastStop || d > 3) b.atStop = null;
    // perto do jogador: freia p/ carro/pessoa na frente
    // perto do jogador: freia p/ carro, pessoa ou outro ônibus na frente (fila no ponto/terminal)
    if (near) { const others = buses.filter(o => o !== b && o.mesh).map(o => ({ x: o.x, y: o.y, half: 1.3, len: (o.L || 11) / 2, speed: o.speed }));
      b.length = b.L || 11; b.width = 2.6;
      const lead = leadAhead(b, obs.concat(others), 10 + b.speed * 1.5); if (lead.gap !== null) v = Math.min(v, stopSpeed(lead.gap - 2.5));
      // semáforo e cruzamento sem sinal: mesmas regras dos carros (um veículo por vez no cruzamento)
      const phase = typeof bridge.trafficPhase === 'function' ? bridge.trafficPhase(bridge.gameTime || 0) : {};
      const sig = signalStop(b, world.trafficSignals, phase); if (sig !== null) v = Math.min(v, stopSpeed(sig));
      for (const J of junctionPts()) {
        const dx = J.x - b.x, dy = J.y - b.y, dj = Math.hypot(dx, dy); if (dj > 32) continue;
        const along = dx * Math.cos(b.a) + dy * Math.sin(b.a), lat = Math.abs(-dx * Math.sin(b.a) + dy * Math.cos(b.a));
        if (along < -2) { if (owners.get(J.key) === b && dj > JUNCTION_R + 3) owners.delete(J.key); continue; }
        if (lat > 10 || J.signal) continue;
        const stp = junctionStop(b, J, owners, obs.filter(o => !o.person)); if (stp !== null) v = Math.min(v, stopSpeed(stp));
        break;
      } }
    b.wait = b.speed < .3 ? (b.wait || 0) + dt : 0;
    b.speed += Math.max(-6 * dt, Math.min(1.6 * dt, v - b.speed)); if (b.speed < 0) b.speed = 0;
    b.s = (b.s + b.speed * dt) % L.len;
  }
  function place(b) {
    const L = b.line, half = (b.L || 11) / 2, f = posAt(L, b.s + half * .7), r = posAt(L, b.s - half * .7);   // eixos dianteiro e traseiro na faixa
    b.x = (f.x + r.x) / 2; b.y = (f.y + r.y) / 2; b.a = Math.atan2(f.y - r.y, f.x - r.x);
    if (b.mesh) { b.mesh.position.set(b.x, 0, b.y); b.mesh.rotation.y = -b.a; }
    if (b.box) Object.assign(b.box, { x: b.x, y: b.y, a: b.a });
  }
  function show(b, on) {
    if (on && !b.mesh) {
      b.mesh = new THREE.Group(); const m = civilModel(b.line) || busModel(b.line); b.mesh.add(m); b.L = m.userData.L; scene.add(b.mesh);
      b.box = { x: b.x, y: b.y, a: b.a, hl: b.L / 2, hw: 1.3, unit: b, bus: true }; world.aiCars.push(b.box); state.shown++;
    } else if (!on && b.mesh) {
      scene.remove(b.mesh); b.mesh.traverse(o => { if (o.isMesh && o.material?.map) o.material.map.dispose(); }); b.mesh = null;
      const j = world.aiCars.indexOf(b.box); if (j >= 0) world.aiCars.splice(j, 1); b.box = null; state.shown--;
    }
  }
  const shelters = new Map(), owners = new Map();
  let jpts = null, jsrc = null;
  const junctionPts = () => { const src = (typeof OW !== 'undefined' && OW.cw?.junctions) || []; if (src !== jsrc) { jsrc = src; jpts = src.map((j, i) => ({ x: j.x, y: j.y, key: 'bj' + i, signal: (world.trafficSignals || []).some(s => Math.hypot(s.x - j.x, s.y - j.y) < 24) })); } return jpts; };
  // abrigo na calçada de verdade: pela RUA CONSTRUÍDA do setor (não pela malha macro), com os postes da frente a ~0,5 m
  // do meio-fio, o vidro do fundo dentro da calçada e alinhado com a rua; desliza ao longo da calçada até um trecho
  // sem árvore, poste, hidrante, banco ou carro. Depois a parada do ônibus é acertada p/ a porta da frente ficar
  // em frente ao abrigo. Roda uma vez, quando o setor do ponto carrega
  const sNear = (line, x, y, around) => { let best = around, bd = Infinity; for (let ds = -80; ds <= 80; ds += 1) { const s = (around + ds + line.len) % line.len, p = posAt(line, s), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = s; } } return best; };
  function settle(st) {
    const W = bridge.ROAD_W || 3.5, SIDE = 2, rd = bridge.roadDist, ent = st.lines[0];
    if (!ent || typeof rd !== 'function') { st.fixed = true; return; }
    const bus = posAt(ent.line, ent.stop.s), roadsNow = bridge.roads || world.roads || [];
    let best = null;
    for (const r of roadsNow) for (let i = 0; i < (r.pts?.length || 0); i += 2) { const p = r.pts[i], d = Math.hypot(p.x - bus.x, p.y - bus.y); if (d < 14 && (!best || d < best.d)) best = { r, i, d }; }
    if (!best) return;   // rua do ponto ainda não carregou: tenta de novo daqui a pouco
    st.fixed = true;
    const r = best.r, half = W + (r.off || 0);
    const place = idx => { const p = r.pts[Math.max(0, Math.min(r.pts.length - 1, idx))], sg = p.tx * Math.cos(bus.a) + p.ty * Math.sin(bus.a) >= 0 ? 1 : -1, tx = p.tx * sg, ty = p.ty * sg, rx = -ty, ry = tx;
      return { x: p.x + rx * (half + 1.1), y: p.y + ry * (half + 1.1), a: Math.atan2(ty, tx), tx, ty }; };
    const bx = bridge.boxes || [], circ = world.circles || [];
    const clear = c => {
      const d = rd(c.x, c.y); if (d < W + .5 || d > W + SIDE + .6) return false;   // centro na calçada
      for (let u = -2.1; u <= 2.1; u += .7) { const x = c.x + c.tx * u, y = c.y + c.ty * u;
        for (const b of bx) if (b.solid !== false && !b.floor && Math.abs(b.x - x) < 3 && Math.abs(b.y - y) < 3 && Math.hypot(b.x - x, b.y - y) < .8 + Math.max(b.w || 0, b.d || 0) / 2) return false;
        for (const o of circ) if (!o.soft && Math.abs(o.x - x) < 2.5 && Math.abs(o.y - y) < 2.5 && Math.hypot(o.x - x, o.y - y) < .75 + (o.r || 0)) return false; }
      return true;
    };
    let pick = null;
    for (const step of [0, 6, -6, 12, -12, 18, -18, 24, -24, 32, -32]) { const c = place(best.i + step); if (clear(c)) { pick = c; break; } }   // passos de 0,5 m
    pick = pick || place(best.i);
    st.sx = pick.x; st.sy = pick.y; st.a = pick.a;
    // porta da frente do ônibus (a ~1,2 m do para-choque) em frente ao abrigo
    for (const { line, stop } of st.lines) { const L = line.school ? 9 : 12, s0 = sNear(line, pick.x, pick.y, stop.s); stop.s = (s0 - (L / 2 - 1.2) + line.len) % line.len; }
    for (const ln of new Set(st.lines.map(e => e.line))) ln.stops.sort((a, b) => a.s - b.s);
  }
  function update(dt) {
    if (!built) { build(); if (!built) return; }
    const p = P(); if (!p) return;
    const obs = obstacles();
    for (const b of buses) { step(b, dt, obs); place(b); show(b, Math.hypot(b.x - p.x, b.y - p.y) < 180 || ride?.bus === b); }
    for (const st of stops) { const near = Math.hypot(st.sx - p.x, st.sy - p.y) < 150; if (near && !st.fixed && (st.tryT = (st.tryT || 0) - dt) <= 0) { st.tryT = 1; settle(st); const g0 = shelters.get(st); if (st.fixed && g0) { g0.position.set(st.sx, 0, st.sy); g0.rotation.y = -st.a; } }
      if (near && !shelters.has(st)) { const g = shelterModel(st); g.position.set(st.sx, 0, st.sy); g.rotation.y = -st.a; scene.add(g); shelters.set(st, g); } else if (!near && shelters.has(st)) { scene.remove(shelters.get(st)); shelters.delete(st); } }
    tickRide(dt);
  }

  // ---------- jogador ----------
  const stopNear = (p, r = 4.5) => { let best = null, bd = r; for (const s of stops) { const d = Math.hypot(s.sx - p.x, s.sy - p.y); if (d < bd) { bd = d; best = s; } } return best; };
  const student = () => !!window.CityCareers?.state?.course;
  const fare = line => line.school && student() ? 0 : FARE;
  function tickRide(dt) {
    const p = P();
    if (plan && !ride) {
      if (Math.hypot(plan.from.sx - p.x, plan.from.sy - p.y) > 16) { plan = null; note('Você saiu do ponto: espera cancelada.'); updateBanner(); return; }
      const b = buses.find(b => b.line === plan.line && b.atStop === plan.stop && b.dwell > .5);
      if (b) board(b, plan.to);
      else updateBanner();
    }
    if (ride) {
      const b = ride.bus; p.x = b.x; p.y = b.y; p.face = b.a; p.speed = 0;
      if (b.atStop && b.dwell > 0 && b.atStop !== ride.boardedAt && (b.atStop === ride.to || ride.leaveNext)) alight(b.atStop);
      else updateBanner();
    }
  }
  function board(b, to) {
    const f = fare(b.line);
    if (f && !window.CityLife?.debit(f, 'Ônibus ' + b.line.num)) { note('Sem dinheiro p/ a passagem (' + money(f) + ').'); plan = null; updateBanner(); return; }
    ride = { bus: b, to, boardedAt: b.atStop, leaveNext: false }; plan = null; state.rides++;
    b.dwell = Math.max(b.dwell, 2.5); window.CityAudio?.ui?.('confirm');
    note('🚌 Embarcou no ' + b.line.num + (f ? ' · ' + money(f) : ' · passe escolar') + '. Destino: ' + to.name); updateBanner();
  }
  function alight(st) {
    const p = P(), sh = st.shared || st; p.x = sh.sx; p.y = sh.sy; p.face = (st.a || 0) + Math.PI / 2;
    const name = st.name; ride = null; setFast(false); updateBanner(); note('Desceu no ponto ' + name + '.');
  }
  function setFast(on) { fast = on; window.__timeScale = on ? 3 : 1; }
  const money = n => window.CityLife ? CityLife.money(n) : 'R$ ' + n.toFixed(2);
  const note = t => window.CityUI?.notify?.(t);
  const fmtS = s => s < 60 ? Math.max(1, Math.round(s)) + ' s' : Math.round(s / 60) + ' min';
  function nextBus(line, stop) { let best = null, bt = Infinity; for (const b of buses) if (b.line === line) { const t = eta(b, stop); if (t < bt) { bt = t; best = b; } } return { b: best, t: bt }; }

  // ---------- UI ----------
  function dialog() {
    if (!ui) { ui = document.createElement('div'); ui.id = 'city-kiosk-dialog'; ui.hidden = true; document.body.appendChild(ui);
      ui.addEventListener('click', e => { const go = e.target.closest('[data-bus-go]'); if (go) choose(go.dataset.line, +go.dataset.to); if (e.target.closest('[data-kiosk-close]') || e.target === ui) closeUI(); }); }
    return ui;
  }
  let uiStop = null;
  function openUI(st) {
    uiStop = st; const d = dialog(), rows = st.lines.map(({ line, stop }) => {
      const nb = nextBus(line, stop), dest = line.stops.filter(s => s !== stop && (s.kind !== 'stop' || s.shared?.lines.length > 1));
      return '<div style="margin:12px 0;padding:10px 12px;border-radius:14px;background:#ffffff10;border-left:6px solid ' + line.color + '">' +
        '<div style="display:flex;justify-content:space-between;gap:8px"><strong style="font-size:17px"><span style="background:' + line.color + ';color:' + (line.school ? '#111' : '#fff') + ';border-radius:8px;padding:2px 8px;margin-right:6px">' + line.num + '</span>' + line.name + '</strong>' +
        '<small style="color:#9fe7c6">próximo em ' + (nb.b ? fmtS(nb.t) : '—') + '</small></div>' +
        '<small style="color:#9fb4c4">' + (fare(line) ? 'Tarifa ' + money(fare(line)) : 'Grátis c/ matrícula') + ' · ' + line.stops.length + ' pontos · ' + (line.len / 1000).toFixed(1) + ' km</small>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' + dest.map(s => '<button class="city-property-secondary" style="width:auto;margin:0;padding:6px 10px" data-bus-go data-line="' + line.num + '" data-to="' + line.stops.indexOf(s) + '">' + s.name + '</button>').join('') + '</div></div>';
    }).join('');
    d.innerHTML = '<div class="city-property-card" style="max-width:560px;width:min(100%,560px);max-height:86vh;overflow:auto" role="dialog" aria-label="Ponto de ônibus"><button data-kiosk-close class="city-property-close" aria-label="Fechar">✕</button>' +
      '<span class="city-property-eyebrow">PONTO DE ÔNIBUS · CITY TRANSPORTE</span><h2>🚏 ' + st.name + '</h2><p>Escolha o destino: você espera aqui e sobe sozinho quando o ônibus da linha parar.</p>' + rows +
      '<button data-kiosk-close class="city-property-secondary">Voltar ao jogo</button></div>';
    d.hidden = false; document.body.classList.add('city-property-open');
  }
  function closeUI() { uiStop = null; if (ui) ui.hidden = true; document.body.classList.remove('city-property-open'); }
  function choose(num, toIdx) {
    const st = uiStop; if (!st) return; const ent = st.lines.find(l => l.line.num === num); if (!ent) return;
    const to = ent.line.stops[toIdx]; plan = { line: ent.line, stop: ent.stop, from: st, to }; closeUI();
    const nb = nextBus(ent.line, ent.stop); note('Aguardando o ' + num + ' p/ ' + to.name + ' · chega em ' + fmtS(nb.t)); updateBanner();
  }
  function updateBanner() {
    if (!banner) { banner = document.createElement('div'); banner.id = 'city-bus-banner'; banner.style.cssText = 'position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:40;background:#0b1a2bdd;color:#fff;border-radius:14px;padding:10px 14px;font:14px system-ui;display:flex;gap:10px;align-items:center;box-shadow:0 6px 20px #0006';
      banner.addEventListener('click', e => { const a = e.target.closest('[data-bus]')?.dataset.bus; if (a === 'next' && ride) { ride.leaveNext = true; note('Você desce no próximo ponto.'); } if (a === 'fast') setFast(!fast); if (a === 'cancel') { plan = null; updateBanner(); } }); document.body.appendChild(banner); }
    if (!plan && !ride) { banner.style.display = 'none'; return; } banner.style.display = 'flex';   // display:flex do estilo ganharia do atributo hidden
    const btn = (k, t) => '<button data-bus="' + k + '" style="background:#ffffff22;color:#fff;border:1px solid #ffffff44;border-radius:9px;padding:5px 9px;cursor:pointer">' + t + '</button>';
    const badge = l => '<b style="background:' + l.color + ';color:' + (l.school ? '#111' : '#fff') + ';border-radius:7px;padding:2px 7px">' + l.num + '</b>';
    if (plan) { const nb = nextBus(plan.line, plan.stop); banner.innerHTML = '🚏 ' + badge(plan.line) + ' p/ <b>' + plan.to.name + '</b> · chega em ' + fmtS(nb.t) + btn('cancel', 'Cancelar'); return; }
    const b = ride.bus, nx = b.line.stops[stopIdx(b).i];
    banner.innerHTML = '🚌 ' + badge(b.line) + ' rumo a <b>' + ride.to.name + '</b> · próximo ponto: ' + nx.name + (ride.leaveNext ? ' (descendo)' : '') + btn('next', 'Descer no próximo') + btn('fast', fast ? '▶ Normal' : '⏩ Acelerar');
  }
  // F no ponto: abre o painel; com um ônibus parado ali, já mostra as linhas
  function interact(p) { if (ride) return false; const st = stopNear(p); if (!st) return false; build(); openUI(st); return 'Ponto de ônibus'; }
  function prompt(p) { if (ride) return ''; const st = stopNear(p); return st ? 'F · Ponto de ônibus · linhas ' + st.lines.map(l => l.line.num).join(', ') : ''; }
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && uiStop) { e.preventDefault(); closeUI(); } });
  // celular: linhas e o ponto mais perto (GPS)
  function nearestStop(p) { let best = null, bd = Infinity; for (const s of stops) { const d = Math.hypot(s.sx - p.x, s.sy - p.y); if (d < bd) { bd = d; best = s; } } return best && { stop: best, d: bd }; }
  return { state, update, interact, prompt, nearestStop, eta, nextBus, closeUI,
    get lines() { return lines; }, get stops() { return stops; }, get buses() { return buses; }, get riding() { return !!ride; }, get uiOpen() { return !!uiStop; }, get plan() { return plan; },
    debug: { board, alight, build } };
}
