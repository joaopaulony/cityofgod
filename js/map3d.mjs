// map3d.mjs — mapa grande em 3D (tecla M): a ilha inteira como uma maquete.
// · chão: o atlas da ilha (mar, praia, rio, mata, fazendas) com os bairros repintados em cores limpas por zona;
// · ruas: faixas em 3D (calçada, asfalto, faixa central amarela nas avenidas e rodovias, trilho);
// · prédios: os que o jogo já gerou (cores e alturas reais, guardados no navegador conforme você explora) e, nos
//   setores ainda não visitados, volumes neutros ao longo das ruas (como um mapa 3D sem textura) para dar a forma da cidade;
// · marcos: hospital, delegacia, prefeitura, igreja, estádio, aeroporto (pista e terminal), árvores nas matas;
// · câmera de maquete: arrastar move, roda dá zoom no cursor, botão direito gira/inclina, vista 2D (de cima) ou 3D.
// O resto (ícones, rótulos, rota, jogador) é desenhado por cima pelo worldmap.js usando project()/pick().
// Também entrega o chão pintado (ground) para o minimapa (2 m por pixel).
import * as THREE from 'three';

// globais dos scripts clássicos (const/let/function no escopo global não ficam em window)
const gv = n => { try { return (0, eval)(n); } catch (_) { return undefined; } };
const PPM = .5;                    // px por metro do chão pintado (2 m/px)
const STORE = 'cityofgod.map3d.v1';
const ZONE = { 2: '#cdc9c0', 3: '#bfc3a8', 4: '#cbb293', 5: '#bdb59c', 6: '#b1b2ad', 7: '#a9adad', 10: '#c3cca8', 11: '#bcc79f' };
const KIND_COL = { condo: '#e9e4da', office: '#9fb2c2', deco: '#f0d3c8', poor: '#c8a079', bungalow: '#ece0c8', warehouse: '#b9bcbe', shop: '#e8cf9f',
  school: '#e8c95a', mansion: '#f3efe6', police: '#9fc0e2', hospital: '#f4f6f6', cityhall: '#e9e1c9', church: '#efe9df', market: '#e3b98a' };
const hash = (a, b, s = 0) => { let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const M = {
  ready: false, building: false, renderer: null, scene: null, camera: null, canvas: null, ground: null, groundPPM: PPM,
  target: new THREE.Vector3(1400, 0, 1300), dist: 900, yaw: 0, pitch: 1.0, mode: '3d', W: 0, H: 0,
  groups: {}, known: new Map(), sectors: new Set(), dirty: false, savedAt: 0
};

// ---------- memória do que já foi explorado (prédios reais por setor) ----------
function loadStore() {
  try { const s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (!s || s.seed !== (gv('COG')?.WORLD_SEED)) return;
    for (const k of s.sectors || []) M.sectors.add(k); for (const b of s.b || []) M.known.set(b[0] + ',' + b[1], b); } catch (_) {}
}
function saveStore() {
  try { localStorage.setItem(STORE, JSON.stringify({ seed: gv('COG')?.WORLD_SEED, sectors: [...M.sectors], b: [...M.known.values()] })); M.savedAt = performance.now(); } catch (_) {}
}
// recolhe os prédios carregados agora (chamado ao abrir o mapa e de tempos em tempos pelo minimapa)
function harvest() {
  const OW = gv('OW'), H = gv('houses');
  let added = 0;
  if (OW?.sectors) for (const S of OW.sectors.values()) if (S.state === 'done' && !M.sectors.has(S.key)) { M.sectors.add(S.key); added++; }
  for (const h of H || []) {
    if (!Number.isFinite(h.x0) || h.x1 - h.x0 < 2) continue;
    const key = Math.round(h.x0) + ',' + Math.round(h.y0);
    if (M.known.has(key)) continue;
    const ht = Math.max(h.h || 3, (h.nFloors || 1) * (h.floorHeight || 3)) + (h.roofKind && h.roofKind !== 'flat' ? 1.2 : 0);
    const col = KIND_COL[h.miaKind] || (h.style?.ext) || h.ext || '#e6ddcc';
    M.known.set(key, [Math.round(h.x0), Math.round(h.y0), +(h.x1 - h.x0).toFixed(1), +(h.y1 - h.y0).toFixed(1), +ht.toFixed(1), col, h.style?.roofCol || h.roof || null]); added++;
  }
  if (added) { M.dirty = true; if (performance.now() - M.savedAt > 20000) saveStore(); }
  return added;
}

// ---------- chão pintado ----------
function paintGround() {
  const OW = gv('OW'), geo = OW.geo, W = Math.round(geo.W * PPM), H = Math.round(geo.H * PPM);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const base = gv('wmap')?.base;
  if (base) { while (!base.done) base.step(200); g.imageSmoothingEnabled = true; g.drawImage(base.canvas, 0, 0, W, H); }
  else { g.fillStyle = '#2a8fa8'; g.fillRect(0, 0, W, H); }
  // bairros: uma camada lisa por zona (1 px por célula de 20 m, ampliada com suavização = bordas macias)
  const cells = document.createElement('canvas'); cells.width = geo.NX; cells.height = geo.NY; const c = cells.getContext('2d'), img = c.createImageData(geo.NX, geo.NY);
  for (let k = 0; k < geo.NX * geo.NY; k++) {
    const col = ZONE[geo.dist[k]]; if (!col) continue;
    const n = parseInt(col.slice(1), 16), j = hash(k, 7) * 10 - 5;
    img.data[k * 4] = ((n >> 16) & 255) + j; img.data[k * 4 + 1] = ((n >> 8) & 255) + j; img.data[k * 4 + 2] = (n & 255) + j; img.data[k * 4 + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  g.save(); g.imageSmoothingEnabled = true; g.filter = 'blur(3px)'; g.drawImage(cells, 0, 0, W, H); g.restore();
  // grão fino (gramados e calçadas não ficam chapados)
  const nz = document.createElement('canvas'); nz.width = nz.height = 128; const nc = nz.getContext('2d'), ni = nc.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const v = Math.random() * 255; ni.data[i * 4] = ni.data[i * 4 + 1] = ni.data[i * 4 + 2] = v; ni.data[i * 4 + 3] = 18; }
  nc.putImageData(ni, 0, 0); g.fillStyle = g.createPattern(nz, 'repeat'); g.globalCompositeOperation = 'overlay'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  return cv;
}

// ---------- faixas (ruas) a partir de uma polilinha ----------
function ribbon(pts, half, y, out) {
  const n = pts.length; if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    let nx = -ty, ny = tx, m = 1;
    if (i > 0 && i < n - 1) {   // emenda em ângulo (miter) limitada
      const p = pts[i - 1], q = pts[i], r = pts[i + 1];
      let ax = q[0] - p[0], ay = q[1] - p[1], la = Math.hypot(ax, ay) || 1, bx = r[0] - q[0], by = r[1] - q[1], lb = Math.hypot(bx, by) || 1;
      const n1x = -ay / la, n1y = ax / la, n2x = -by / lb, n2y = bx / lb; nx = n1x + n2x; ny = n1y + n2y; const ln = Math.hypot(nx, ny) || 1; nx /= ln; ny /= ln;
      m = Math.min(2.2, 1 / Math.max(.3, nx * n1x + ny * n1y));
    }
    const [x, z] = pts[i]; L.push(x + nx * half * m, z + ny * half * m); R.push(x - nx * half * m, z - ny * half * m);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = [L[i * 2], L[i * 2 + 1]], b = [R[i * 2], R[i * 2 + 1]], c = [L[i * 2 + 2], L[i * 2 + 3]], d = [R[i * 2 + 2], R[i * 2 + 3]];
    out.push(a[0], y, a[1], b[0], y, b[1], c[0], y, c[1], b[0], y, b[1], d[0], y, d[1], c[0], y, c[1]);
  }
}
function flatMesh(arr, color, order) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -order, polygonOffsetUnits: -order * 2 });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = order; return m;
}
function buildRoads(group) {
  const roads = gv('OW').cw.roads, SIDE = gv('SIDE') ?? 2, side = [], asph = [], hwy = [], line = [], rail = [];
  for (const rd of roads) {
    const pts = rd.pts.map(p => Array.isArray(p) ? p : [p.x, p.y]);
    if (rd.cls === 'rail') { ribbon(pts, 1.6, .2, rail); continue; }
    ribbon(pts, rd.w / 2 + SIDE, .1, side);
    ribbon(pts, rd.w / 2, .2, rd.cls === 'highway' ? hwy : asph);
    if (rd.cls !== 'street') ribbon(pts, .22, .3, line);
  }
  group.add(flatMesh(side, '#d9d4c7', 1), flatMesh(asph, '#55585e', 2), flatMesh(hwy, '#46494f', 2), flatMesh(line, '#e8c25a', 3), flatMesh(rail, '#6d5f52', 2));
}

// ---------- prédios ----------
const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, .5, 0);
function instanced(list, mat) {
  const mesh = new THREE.InstancedMesh(box, mat, Math.max(1, list.length)), m4 = new THREE.Matrix4(), col = new THREE.Color();
  list.forEach((b, i) => { m4.makeScale(b.w, b.h, b.d); m4.setPosition(b.x, b.y || 0, b.z); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, col.set(b.c)); });
  mesh.count = list.length; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; return mesh;
}
// volumes neutros ao longo das ruas nos setores ainda não explorados (forma da cidade, não os prédios reais)
function massing() {
  const OW = gv('OW'), geo = OW.geo, dd = (x, y) => geo.districtAt(x, y), rdist = gv('roadDist'), ROAD_W = gv('ROAD_W') ?? 3.5, SIDE = gv('SIDE') ?? 2;
  const out = [], occ = new Set(), SP = OW.SP || 256, CELL = 4;
  const free = (x0, z0, x1, z1) => { for (let z = Math.floor(z0 / CELL); z <= Math.floor(z1 / CELL); z++) for (let x = Math.floor(x0 / CELL); x <= Math.floor(x1 / CELL); x++) if (occ.has(x + ',' + z)) return false; return true; };
  const take = (x0, z0, x1, z1) => { for (let z = Math.floor(z0 / CELL); z <= Math.floor(z1 / CELL); z++) for (let x = Math.floor(x0 / CELL); x <= Math.floor(x1 / CELL); x++) occ.add(x + ',' + z); };
  const civ = (gv('world')?.civicSites || []).map(s => s.bb);
  for (const rd of OW.cw.roads) {
    if (rd.cls === 'rail' || rd.cls === 'highway') continue;
    const pts = rd.pts.map(p => Array.isArray(p) ? p : [p.x, p.y]);
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay); if (len < .01) continue;
      const tx = (bx - ax) / len, ty = (by - ay) / len;
      for (let s = (14 - acc % 14) % 14; s < len; s += 14) {
        const px = ax + tx * s, py = ay + ty * s;
        for (const sd of [1, -1]) {
          const r = hash(Math.round(px), Math.round(py), sd + 3), d0 = dd(px - ty * sd * 20, py + tx * sd * 20);
          if (![2, 3, 4, 5, 6, 7, 10].includes(d0)) continue;
          const key = Math.floor(px / SP) + ',' + Math.floor(py / SP); if (M.sectors.has(key)) continue;
          const big = d0 === 6 || d0 === 7, fav = d0 === 4, dt = d0 === 2;
          const w = big ? 18 + r * 14 : fav ? 6 + r * 3 : 9 + r * 7, dep = big ? 20 + r * 10 : fav ? 6 + r * 3 : 10 + r * 8;
          const off = rd.w / 2 + SIDE + (fav ? 1 : 3) + dep / 2, cx = px - ty * sd * off, cz = py + tx * sd * off;
          const hx = (Math.abs(tx) * w + Math.abs(ty) * dep) / 2, hz = (Math.abs(ty) * w + Math.abs(tx) * dep) / 2;
          let ok = true;
          for (const [qx, qz] of [[cx - hx, cz - hz], [cx + hx, cz - hz], [cx - hx, cz + hz], [cx + hx, cz + hz], [cx, cz]]) if (rdist && rdist(qx, qz) < ROAD_W + SIDE + .8) { ok = false; break; }
          if (!ok || civ.some(b => cx + hx > b[0] && cx - hx < b[2] && cz + hz > b[1] && cz - hz < b[3])) continue;
          if (geo.isLand && !geo.isLand(cx, cz)) continue;
          if (!free(cx - hx, cz - hz, cx + hx, cz + hz)) continue;
          take(cx - hx, cz - hz, cx + hx, cz + hz);
          const h = dt ? (r < .25 ? 40 + r * 120 : 12 + r * 30) : big ? 7 + r * 5 : fav ? 3 + r * 4 : d0 === 10 ? 4 + r * 3 : 5 + r * 9;
          const shade = fav ? ['#c9a27e', '#d7b08a', '#b98d6a', '#e0c49f'][(r * 4) | 0] : dt ? ['#d6d8da', '#c4ccd3', '#e1ddd5'][(r * 3) | 0] : ['#dcd8cf', '#e4e0d7', '#d2cec4'][(r * 3) | 0];
          out.push({ x: cx, z: cz, w: hx * 2, d: hz * 2, h, c: shade });
        }
      }
      acc += len;
    }
  }
  return out;
}
function buildBuildings() {
  const g = M.groups.buildings; if (g) { M.scene.remove(g); g.traverse(o => { if (o.isInstancedMesh) o.dispose?.(); }); }
  const group = new THREE.Group(), real = [], civic = [];
  for (const b of M.known.values()) real.push({ x: b[0] + b[2] / 2, z: b[1] + b[3] / 2, w: b[2], d: b[3], h: b[4], c: b[5] });
  for (const s of gv('world')?.civicSites || []) { const [x0, y0, x1, y1] = s.bb; civic.push({ x: (x0 + x1) / 2, z: (y0 + y1) / 2, w: (x1 - x0) * .8, d: (y1 - y0) * .8, h: (s.floors || 2) * 4.2, c: KIND_COL[s.kind] || s.color || '#e8e8e8' }); }
  const lay = gv('world')?.airportLayout; if (lay) civic.push({ x: lay.x0 + lay.w / 2, z: lay.y0 + lay.d / 2, w: lay.w, d: lay.d, h: 12, c: '#dfe4e8' });
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  group.add(instanced(real, mat), instanced(civic, mat), instanced(massing(), new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: .92 })));
  M.groups.buildings = group; M.scene.add(group); M.dirty = false;
}
function buildTrees(group) {
  const geo = gv('OW').geo, list = [];
  for (let j = 0; j < geo.NY; j++) for (let i = 0; i < geo.NX; i++) {
    const d = geo.dist[j * geo.NX + i], n = d === 9 ? 4 : d === 12 ? 1 : 0;
    for (let k = 0; k < n; k++) { const r = hash(i, j, k), r2 = hash(j, i, k + 9); if (d === 12 && r > .35) continue; list.push([(i + r) * geo.C, (j + r2) * geo.C, 6 + r * 7, r2]); }
  }
  const cone = new THREE.ConeGeometry(1, 1, 6); cone.translate(0, .5, 0);
  const mesh = new THREE.InstancedMesh(cone, new THREE.MeshLambertMaterial({ color: '#ffffff' }), list.length), m4 = new THREE.Matrix4(), col = new THREE.Color();
  list.forEach(([x, z, h, r], i) => { m4.makeScale(h * .38, h, h * .38); m4.setPosition(x, 0, z); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, col.setHSL(.28 + r * .06, .42, .22 + r * .08)); });
  group.add(mesh);
}
function buildAirport(group) {
  for (const ap of gv('world')?.airports || []) {
    const geo = new THREE.PlaneGeometry(ap.len, ap.width); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#3d4045', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    m.position.set(ap.x, .25, ap.y); m.rotation.y = -(ap.ang || 0); group.add(m);
    const st = new THREE.PlaneGeometry(ap.len * .92, 1.2); st.rotateX(-Math.PI / 2);
    const s = new THREE.Mesh(st, new THREE.MeshLambertMaterial({ color: '#f2f2f2', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 })); s.position.set(ap.x, .3, ap.y); s.rotation.y = -(ap.ang || 0); group.add(s);
  }
}

// ---------- montagem ----------
function build() {
  if (M.ready || M.building || !gv('OW')?.cw) return false;
  M.building = true;
  loadStore(); harvest();
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0d1b27'); scene.fog = new THREE.Fog('#0d1b27', 2500, 7000);
  const camera = new THREE.PerspectiveCamera(38, 1, 2, 12000);
  scene.add(new THREE.HemisphereLight('#f4f8ff', '#3d4a3a', 1.6));
  const sun = new THREE.DirectionalLight('#fff2dc', 1.9); sun.position.set(-.6, 1, -.45); scene.add(sun);
  if (!M.ground) M.ground = paintGround();
  const geo = gv('OW').geo, tex = new THREE.CanvasTexture(M.ground); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); tex.generateMipmaps = true;
  const plane = new THREE.PlaneGeometry(geo.W, geo.H); plane.rotateX(-Math.PI / 2); plane.translate(geo.W / 2, 0, geo.H / 2);
  scene.add(new THREE.Mesh(plane, new THREE.MeshLambertMaterial({ map: tex })));
  // mar além da ilha
  // mar de fora com a mesma cor do mar pintado na borda do chão (sem recorte quadrado aparecendo)
  const px = M.ground.getContext('2d').getImageData(3, 3, 1, 1).data, seaCol = new THREE.Color(px[0] / 255, px[1] / 255, px[2] / 255).convertSRGBToLinear();
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: seaCol }));
  sea.position.set(geo.W / 2, -.05, geo.H / 2); scene.add(sea);
  const statics = new THREE.Group(); buildRoads(statics); buildTrees(statics); buildAirport(statics); scene.add(statics);
  Object.assign(M, { canvas, renderer, scene, camera, ready: true, building: false });
  buildBuildings();
  return true;
}

// ---------- câmera ----------
function clampView() {
  const geo = gv('OW')?.geo; if (!geo) return;
  M.target.x = Math.max(-200, Math.min(geo.W + 200, M.target.x)); M.target.z = Math.max(-200, Math.min(geo.H + 200, M.target.z));
  M.dist = Math.max(60, Math.min(4200, M.dist)); M.pitch = Math.max(.5, Math.min(1.555, M.pitch));
}
function place() {
  clampView();
  const c = M.camera, h = Math.sin(M.pitch) * M.dist, r = Math.cos(M.pitch) * M.dist;
  c.position.set(M.target.x + Math.sin(M.yaw) * r, h, M.target.z + Math.cos(M.yaw) * r);
  c.up.set(0, 1, 0); if (M.pitch > 1.55) c.up.set(-Math.sin(M.yaw), 0, -Math.cos(M.yaw));
  c.lookAt(M.target); c.updateMatrixWorld(); c.updateProjectionMatrix();
}
const v3 = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function pick(sx, sy) {
  if (!M.ready || !M.W) return null;
  ndc.set(sx / M.W * 2 - 1, -(sy / M.H) * 2 + 1); ray.setFromCamera(ndc, M.camera);
  const hit = ray.ray.intersectPlane(ground0, v3); return hit ? { x: hit.x, y: hit.z } : null;
}
function project(x, y, z = 0) {
  if (!M.ready || !M.W) return [NaN, NaN, false];
  v3.set(x, z, y).project(M.camera);
  return [(v3.x + 1) / 2 * M.W, (1 - v3.y) / 2 * M.H, v3.z < 1 && v3.z > -1];
}

const api = {
  get ready() { return M.ready; }, get ground() { return M.ground; },
  // só o chão pintado (o minimapa usa sem precisar montar a cena 3D)
  ensureGround() { if (!M.ground && gv('OW')?.cw && gv('wmap')?.base) M.ground = paintGround(); return M.ground; }, get groundPPM() { return PPM; }, get mode() { return M.mode; },
  get view() { return { x: M.target.x, y: M.target.z, dist: M.dist, yaw: M.yaw, pitch: M.pitch }; },
  build, harvest, saveStore,
  open(p) {
    if (!M.ready && !build()) return false;
    if (harvest() || M.dirty) buildBuildings();
    if (p && !M.opened) { M.target.set(p.x, 0, p.y); M.dist = 900; M.pitch = M.mode === '2d' ? 1.555 : .9; M.opened = true; }
    return true;
  },
  close() { saveStore(); },
  frame(W, H) {
    if (!M.ready) return null;
    if (W !== M.W || H !== M.H) { M.W = W; M.H = H; M.renderer.setSize(W, H, false); M.camera.aspect = W / H; }
    place(); M.renderer.render(M.scene, M.camera); return M.canvas;
  },
  pick, project,
  pan(dx, dy) {   // arrastar: o ponto sob o cursor acompanha o mouse
    const a = pick(M.W / 2, M.H / 2), b = pick(M.W / 2 - dx, M.H / 2 - dy); if (!a || !b) return;
    M.target.x += b.x - a.x; M.target.z += b.y - a.y; place();
  },
  zoomAt(sx, sy, f) {
    const before = pick(sx, sy); M.dist /= f; place(); const after = pick(sx, sy);
    if (before && after) { M.target.x += before.x - after.x; M.target.z += before.y - after.y; place(); }
  },
  rotate(dyaw, dpitch) { M.yaw += dyaw; M.pitch += dpitch; if (M.pitch < 1.54) M.mode = '3d'; place(); },
  setMode(mode) { M.mode = mode; M.pitch = mode === '2d' ? 1.555 : .9; if (mode === '2d') M.yaw = 0; place(); },
  north() { M.yaw = 0; place(); },
  center(x, y) { M.target.x = x; M.target.z = y; place(); },
  // metros por pixel no centro da tela (escala da barra e tamanho dos rótulos)
  mpp() { const a = pick(M.W / 2, M.H / 2), b = pick(M.W / 2 + 100, M.H / 2); return a && b ? Math.hypot(b.x - a.x, b.y - a.y) / 100 : 1; },
  stats() { return { known: M.known.size, sectors: M.sectors.size, ready: M.ready }; }
};
window.CityMap3D = api;
export default api;
