// props-3d.mjs — objetos da rua e móveis das casas em 3D (estilo The Sims 4) na camada WebGL, no lugar dos desenhos 2D:
// hidrante, lixeiras, caixa de correio, poste de madeira, banca de jornal, caçamba, carrinho de cachorro-quente,
// postes de luz, semáforos (carros e pedestres, com as luzes trocando), meio-fio com sarjeta, e os móveis
// (cozinha, banheiro, sala e quarto completos). Cada modelo é montado com caixas arredondadas, cilindros e esferas
// com cor por vértice, gerado uma vez e desenhado com InstancedMesh. Móveis aparecem só com o jogador dentro da casa
// (e no andar em que ele está), virados p/ o centro do cômodo.
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const hash2 = (x, y, k = 0) => { let h = Math.imul((x * 73856093) ^ (y * 19349663) ^ (k * 83492791), 0x45d9f3b); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

export function createProps(THREE, scene, bridge) {
  const col = hex => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);

  // ======================= modelagem =======================
  // um "Kit" junta peças coloridas e devolve as geometrias mescladas (corpo, brilho, vidro)
  function Kit() {
    const sets = { body: [], glow: [], glass: [] };
    const add = (g, c, set = 'body') => {
      g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = typeof c === 'string' ? col(c) : c;
      for (let i = 0; i < n; i++) a.set([cc.r, cc.g, cc.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(a, 3)); sets[set].push(g); return g;
    };
    const k = {
      // caixa de (x0,y0,z0) a (x1,y1,z1); r = raio do arredondamento
      box(x0, y0, z0, x1, y1, z1, c, r = 0, set) {
        const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0), rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
        const g = rr > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d);
        g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return add(g, c, set);
      },
      // cilindro vertical de y0 a y1 (rTop opcional: cone)
      cyl(x, y0, z, r, y1, c, seg = 14, rTop = r, set) { const g = new THREE.CylinderGeometry(rTop, r, y1 - y0, seg); g.translate(x, (y0 + y1) / 2, z); return add(g, c, set); },
      // cilindro deitado ao longo de x ou z
      cylX(x0, x1, y, z, r, c, seg = 12, set) { const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg); g.rotateZ(Math.PI / 2); g.translate((x0 + x1) / 2, y, z); return add(g, c, set); },
      cylZ(x, y, z0, z1, r, c, seg = 12, set) { const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg); g.rotateX(Math.PI / 2); g.translate(x, y, (z0 + z1) / 2); return add(g, c, set); },
      sph(x, y, z, r, c, sy = 1, set, sx = 1, sz = 1) { const g = new THREE.SphereGeometry(r, 14, 10); g.scale(sx, sy, sz); g.translate(x, y, z); return add(g, c, set); },
      // guarda-sol listrado: cone com gomos alternados
      umbrella(x, y, z, r, h, c1, c2) {
        const g = new THREE.ConeGeometry(r, h, 12, 1, true).toNonIndexed(); g.translate(x, y + h / 2, z);
        const n = g.attributes.position.count, a = new Float32Array(n * 3), A = col(c1), B = col(c2), p = g.attributes.position;
        for (let i = 0; i < n; i += 3) { let ax = 0, az = 0; for (let j = 0; j < 3; j++) { ax += p.getX(i + j) - x; az += p.getZ(i + j) - z; } const s = Math.floor((Math.atan2(az, ax) + Math.PI) / TAU * 12) % 2 ? A : B; for (let j = 0; j < 3; j++) a.set([s.r, s.g, s.b], (i + j) * 3); }
        g.setAttribute('color', new THREE.BufferAttribute(a, 3)); sets.body.push(g);
      },
      raw(g, c, set) { return add(g, c, set); },
      done() { const out = {}; for (const [s, list] of Object.entries(sets)) if (list.length) out[s] = mergeGeometries(list); return out; },
    };
    return k;
  }

  // ======================= modelos (frente = +z, centro na base, medidas nominais) =======================
  const CHROME = '#c9ced2', DARK = '#2b2d30', WHITE = '#ecebe6', WOOD = '#8a6446', WOODL = '#b08a62';
  const M = {};
  // ---------- rua ----------
  M.hydrant = { dims: [0.3, 0.75, 0.3], make(k) {
    k.cyl(0, 0, 0, 0.16, 0.07, '#cfc9b8'); k.cyl(0, 0.07, 0, 0.115, 0.52, '#e7c21e', 16); k.cyl(0, 0.52, 0, 0.15, 0.58, '#d9b01a', 16);
    k.sph(0, 0.6, 0, 0.12, '#e7c21e', 0.75); k.cyl(0, 0.66, 0, 0.035, 0.74, '#cfc9b8', 6);
    for (const s of [-1, 1]) { k.cylX(s * 0.11, s * 0.2, 0.42, 0, 0.045, '#e7c21e'); k.cylX(s * 0.2, s * 0.215, 0.42, 0, 0.052, '#cfc9b8', 6); }
    k.cylZ(0, 0.36, 0.1, 0.2, 0.065, '#e7c21e'); k.cylZ(0, 0.36, 0.2, 0.22, 0.07, '#cfc9b8', 6);
  } };
  M.trashcan = { dims: [0.6, 0.95, 0.6], make(k) {
    k.cyl(0, 0, 0, 0.27, 0.06, '#2a3a2e', 16); k.cyl(0, 0.06, 0, 0.25, 0.86, '#1f2a22', 16);
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, x = Math.cos(a) * 0.27, z = Math.sin(a) * 0.27; const g = k.box(x - 0.025, 0.08, z - 0.012, x + 0.025, 0.84, z + 0.012, '#35503d'); }
    k.cyl(0, 0.82, 0, 0.29, 0.88, '#2d4434', 16); k.sph(0, 0.88, 0, 0.27, '#2d4434', 0.3);
  } };
  M.bin = { dims: [0.6, 1, 0.65], tinted: true, make(k, c) {
    const body = c || '#3b6554', lid = new THREE.Color(col(body)).multiplyScalar(0.75);
    k.box(-0.27, 0.1, -0.28, 0.27, 0.92, 0.28, body, 0.04); k.box(-0.3, 0.92, -0.32, 0.3, 0.99, 0.3, lid, 0.03);
    k.cylX(-0.29, 0.29, 0.1, -0.24, 0.1, DARK); k.cylX(-0.24, 0.24, 0.96, -0.33, 0.022, lid);
    for (const s of [-1, 1]) k.box(s * 0.22, 0.4, 0.28, s * 0.12, 0.7, 0.3, lid);
  } };
  M.post = { dims: [0.14, 1.1, 0.14], make(k) { k.box(-0.06, 0, -0.06, 0.06, 1.1, 0.06, '#e9e5dc', 0.01); k.box(-0.075, 0, -0.075, 0.075, 0.08, 0.075, '#8f8a80'); } };
  M.mailbox = { dims: [0.48, 0.3, 0.26], tinted: true, make(k, c) {
    const body = c || '#2b4f7a';
    k.box(-0.24, 0, -0.12, 0.24, 0.17, 0.12, body, 0.01); k.cylX(-0.24, 0.24, 0.17, 0, 0.12, body, 16);
    k.box(0.235, 0.02, -0.11, 0.25, 0.27, 0.11, new THREE.Color(col(body)).multiplyScalar(0.8)); k.box(-0.02, 0.15, 0.12, 0.02, 0.36, 0.14, '#d0342c'); k.box(-0.02, 0.3, 0.12, 0.12, 0.36, 0.14, '#d0342c');
  } };
  M.newsbox = { dims: [0.5, 1.05, 0.45], make(k) {
    for (const [x, z] of [[-0.18, -0.15], [0.18, -0.15], [-0.18, 0.15], [0.18, 0.15]]) k.cyl(x, 0, z, 0.02, 0.42, '#606870', 6);
    k.box(-0.25, 0.42, -0.22, 0.25, 1.0, 0.22, '#2b5fa8', 0.02); k.box(-0.26, 1.0, -0.23, 0.26, 1.05, 0.23, '#234f8e', 0.01);
    k.box(-0.18, 0.62, 0.215, 0.18, 0.9, 0.23, '#b8d0e0'); k.box(-0.06, 0.94, 0.22, 0.06, 0.98, 0.235, CHROME);
  } };
  M.dumpster = { dims: [1.9, 1.2, 1.2], make(k) {
    k.box(-0.92, 0.12, -0.55, 0.92, 1.12, 0.58, '#2f5a3a', 0.04); k.box(-0.95, 0.95, -0.6, 0.95, 1.02, 0.62, '#264a30');
    k.box(-0.92, 1.12, -0.55, 0, 1.17, 0.58, '#3a6b46', 0.02);
    k.box(0.02, 1.12, -0.55, 0.92, 1.17, 0.58, '#3a6b46', 0.02);
    for (const x of [-0.75, 0.75]) for (const z of [-0.45, 0.45]) k.cyl(x, 0, z, 0.08, 0.14, DARK, 8);
    k.box(-0.3, 0.55, 0.58, 0.3, 0.7, 0.6, '#e9e5dc');
  } };
  M.cart = { dims: [1.6, 1.1, 1.0], make(k) {
    k.box(-0.72, 0.32, -0.42, 0.72, 0.95, 0.42, '#cfd3d6', 0.04); k.box(-0.74, 0.95, -0.44, 0.74, 1.0, 0.44, '#e9ecee', 0.02);
    k.box(-0.72, 0.4, 0.42, 0.72, 0.62, 0.44, '#d63a2f'); for (const s of [-1, 1]) k.cylZ(s * 0.5, 0.25, -0.5, 0.5, 0.025, DARK, 6);
    for (const s of [-1, 1]) { k.cylZ(s * 0.55, 0.22, -0.48, -0.42, 0.22, DARK, 16); k.cylZ(s * 0.55, 0.22, 0.42, 0.48, 0.22, DARK, 16); }
    k.cylX(0.74, 1.0, 0.85, -0.3, 0.025, CHROME); k.cylX(0.74, 1.0, 0.85, 0.3, 0.025, CHROME); k.cylZ(1.0, 0.85, -0.3, 0.3, 0.025, CHROME);
    k.cyl(-0.2, 1.0, 0.1, 0.035, 1.18, '#d63a2f', 8); k.cyl(-0.1, 1.0, 0.1, 0.035, 1.18, '#e7c21e', 8); k.box(0.15, 1.0, -0.25, 0.55, 1.12, 0.1, '#b8bcc0');
    k.cyl(0, 1.0, 0, 0.025, 2.2, '#e9e5dc', 6); k.umbrella(0, 2.0, 0, 1.15, 0.45, '#d63a2f', '#f7f5ef');
  } };
  M.couch = { dims: [2.0, 0.75, 0.9], tinted: true, make(k, c) { sofaModel(k, c || '#7a5a48', 2.0, 0.9, true); } };
  // ---------- móveis ----------
  M.fridge = { dims: [0.72, 1.8, 0.7], face: 'any', make(k) {
    k.box(-0.36, 0.04, -0.35, 0.36, 1.8, 0.35, '#e8e6e0', 0.035); k.box(-0.34, 0, -0.32, 0.34, 0.06, 0.3, DARK);
    k.box(-0.35, 1.18, 0.33, 0.35, 1.2, 0.36, '#9c9a94');
    k.box(0.25, 0.5, 0.35, 0.28, 1.08, 0.39, CHROME, 0.01); k.box(0.25, 1.28, 0.35, 0.28, 1.6, 0.39, CHROME, 0.01);
  } };
  M.stove = { dims: [0.75, 0.9, 0.62], face: 'any', make(k) {
    k.box(-0.375, 0, -0.31, 0.375, 0.87, 0.31, '#e9e6df', 0.02); k.box(-0.37, 0.87, -0.3, 0.37, 0.9, 0.3, '#1d1e20');
    for (const [x, z] of [[-0.17, -0.13], [0.17, -0.13], [-0.17, 0.13], [0.17, 0.13]]) { k.cyl(x, 0.9, z, 0.09, 0.91, '#4a4c50', 18); k.cyl(x, 0.91, z, 0.04, 0.915, '#2a2b2e', 12); }
    k.box(-0.3, 0.12, 0.31, 0.3, 0.6, 0.32, '#2a2d32'); k.cylX(-0.26, 0.26, 0.66, 0.335, 0.015, CHROME);
    for (let i = 0; i < 4; i++) k.cylZ(-0.24 + i * 0.16, 0.78, 0.31, 0.34, 0.025, '#3a3c40', 10);
    k.box(-0.375, 0.9, -0.31, 0.375, 1.0, -0.27, '#e9e6df', 0.01);
  } };
  M.sink = { dims: [0.8, 0.86, 0.58], face: 'any', make(k) {
    k.box(-0.4, 0.06, -0.29, 0.4, 0.82, 0.27, WHITE, 0.01); k.box(-0.38, 0, -0.27, 0.38, 0.06, 0.24, DARK);
    k.box(-0.005, 0.1, 0.27, 0.005, 0.78, 0.28, '#b8b4aa'); for (const s of [-1, 1]) k.box(s * 0.05 - 0.008, 0.6, 0.27, s * 0.05 + 0.008, 0.72, 0.3, CHROME);
    k.box(-0.42, 0.82, -0.3, 0.42, 0.86, 0.3, '#d8d4cc'); k.box(-0.24, 0.84, -0.17, 0.24, 0.865, 0.17, '#9ca2a6');
    k.cyl(0, 0.86, -0.22, 0.02, 1.08, CHROME, 8); k.cylZ(0, 1.07, -0.22, -0.08, 0.016, CHROME, 8);
  } };
  M.counter = { dims: [2.8, 0.9, 0.6], face: 'short', make(k) {
    const W = 1.4; k.box(-W, 0.08, -0.3, W, 0.86, 0.28, WHITE, 0.01); k.box(-W + 0.02, 0, -0.27, W - 0.02, 0.08, 0.24, DARK);
    for (let x = -W + 0.6; x < W; x += 0.6) k.box(x - 0.005, 0.1, 0.28, x + 0.005, 0.84, 0.29, '#b8b4aa');
    for (let x = -W + 0.3; x < W; x += 0.6) { k.box(x - 0.08, 0.72, 0.28, x + 0.08, 0.735, 0.31, CHROME); }
    k.box(-W - 0.02, 0.86, -0.31, W + 0.02, 0.9, 0.31, '#4a4642');
    k.box(-W + 0.1, 0.9, -0.25, -W + 0.6, 1.18, 0.12, '#2e3034', 0.02); k.box(-W + 0.14, 0.95, 0.12, -W + 0.46, 1.13, 0.13, '#15181c');   // micro-ondas
    k.box(-0.2, 0.9, -0.08, 0.25, 0.915, 0.18, '#c49a6c'); k.cyl(0.65, 0.9, -0.12, 0.08, 1.08, '#c03a30', 14); k.cyl(0.65, 1.08, -0.12, 0.02, 1.11, DARK, 8);
    k.cyl(-0.65, 0.9, -0.05, 0.12, 0.96, '#e4ddd0', 16); for (let i = 0; i < 4; i++) k.sph(-0.65 + (i % 2 - 0.5) * 0.08, 0.99, -0.05 + ((i / 2) | 0) * 0.07 - 0.03, 0.045, i % 2 ? '#e88a2a' : '#c8302a');
  } };
  M.cabinet = { dims: [1.05, 1.6, 0.48], face: 'short', tinted: true, make(k, c) {
    const w = c || '#9a7a56', dk = new THREE.Color(col(w)).multiplyScalar(0.7);
    k.box(-0.525, 0, -0.24, 0.525, 1.6, 0.22, w, 0.01); k.box(-0.54, 1.56, -0.25, 0.54, 1.62, 0.24, dk);
    k.box(-0.005, 0.05, 0.22, 0.005, 1.55, 0.23, dk); for (const s of [-1, 1]) k.box(s * 0.06 - 0.01, 0.75, 0.22, s * 0.06 + 0.01, 0.95, 0.25, CHROME);
  } };
  M.wardrobe = { dims: [1.43, 1.9, 0.62], face: 'short', tinted: true, make(k, c) {
    const w = c || '#7a5a3e', dk = new THREE.Color(col(w)).multiplyScalar(0.68);
    k.box(-0.715, 0.06, -0.31, 0.715, 1.85, 0.29, w, 0.01); k.box(-0.7, 0, -0.29, 0.7, 0.06, 0.27, dk); k.box(-0.74, 1.85, -0.32, 0.74, 1.92, 0.31, dk);
    k.box(-0.006, 0.1, 0.29, 0.006, 1.82, 0.3, dk); for (const s of [-1, 1]) { k.box(s * 0.07 - 0.012, 0.8, 0.29, s * 0.07 + 0.012, 1.15, 0.32, CHROME); k.box(s * 0.36 - 0.28, 0.15, 0.29, s * 0.36 + 0.28, 1.75, 0.295, new THREE.Color(col(w)).multiplyScalar(1.08)); }
  } };
  M.shelf = { dims: [2.5, 1.9, 0.45], face: 'short', make(k) {
    const W = 1.25, r = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(7), BOOK = ['#9a2f2a', '#2f5a8a', '#3d7a4a', '#c8a03a', '#6a4a8a', '#e8e0d0', '#2a2a2a', '#b85a2a'];
    k.box(-W, 0, -0.22, -W + 0.04, 1.9, 0.22, WOOD); k.box(W - 0.04, 0, -0.22, W, 1.9, 0.22, WOOD); k.box(-W, 0, -0.22, W, 1.9, -0.2, '#6e4e36');
    for (let y = 0; y <= 1.86; y += 0.465) { k.box(-W, y, -0.22, W, y + 0.035, 0.22, WOOD); if (y > 1.8) break;
      for (let x = -W + 0.08; x < W - 0.12;) { const bw = 0.03 + r() * 0.04, bh = 0.24 + r() * 0.14; if (r() < 0.12) { x += 0.15; continue; } k.box(x, y + 0.035, -0.17, x + bw, y + 0.035 + bh, 0.13, BOOK[(r() * BOOK.length) | 0]); x += bw + 0.004; } }
  } };
  M.desk = { dims: [1.1, 0.74, 0.62], face: 'short', make(k) {
    k.box(-0.55, 0.7, -0.31, 0.55, 0.74, 0.31, WOODL, 0.01); for (const s of [-1, 1]) k.box(s * 0.53 - 0.02, 0, -0.29, s * 0.53 + 0.02, 0.7, 0.29, WOODL);
    k.box(0.15, 0.45, -0.29, 0.51, 0.7, 0.29, WOOD); k.box(0.2, 0.55, 0.29, 0.46, 0.65, 0.3, '#5a3e2a');
    k.box(-0.3, 0.74, -0.05, 0.1, 0.755, 0.22, '#3a3d42'); k.box(-0.3, 0.755, -0.06, 0.1, 1.0, -0.05, '#1c1f24'); k.box(-0.28, 0.77, -0.049, 0.08, 0.98, -0.045, '#3c6a8a');
    // cadeira de escritório na frente
    k.cyl(0, 0, 0.6, 0.05, 0.05, DARK, 5); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; k.box(Math.cos(a) * 0.22 - 0.02, 0.02, 0.6 + Math.sin(a) * 0.22 - 0.02, Math.cos(a) * 0.22 + 0.02, 0.05, 0.6 + Math.sin(a) * 0.22 + 0.02, DARK); }
    k.cyl(0, 0.05, 0.6, 0.025, 0.42, '#6a6e72', 8); k.box(-0.23, 0.42, 0.38, 0.23, 0.5, 0.82, '#2f3540', 0.04); k.box(-0.21, 0.5, 0.78, 0.21, 0.98, 0.84, '#2f3540', 0.04);
  } };
  M.table = { dims: [1.5, 0.75, 1.1], face: 'any', make(k) {
    k.box(-0.75, 0.71, -0.55, 0.75, 0.75, 0.55, '#a07650', 0.015); for (const x of [-0.66, 0.66]) for (const z of [-0.46, 0.46]) k.box(x - 0.035, 0, z - 0.035, x + 0.035, 0.71, z + 0.035, '#7a5638');
    for (const x of [-0.35, 0.35]) for (const s of [-1, 1]) chair(k, x, s * 0.78, s < 0 ? 0 : Math.PI);
    k.cyl(0, 0.75, 0, 0.06, 0.93, '#e8e2d4', 12); for (let i = 0; i < 3; i++) k.sph((i - 1) * 0.04, 0.97, (i % 2) * 0.03, 0.04, '#d84a5a');
    for (const x of [-0.35, 0.35]) for (const s of [-1, 1]) k.cyl(x, 0.75, s * 0.32, 0.12, 0.76, '#f4f2ec', 18);
  } };
  M.sofa = { dims: [2.1, 0.56, 0.85], face: 'short', tinted: true, make(k, c) { sofaModel(k, c || '#5d6e82', 2.1, 0.85, false); } };
  M.tv = { dims: [1.1, 0.55, 0.45], face: 'any', make(k) {
    k.box(-0.55, 0.05, -0.22, 0.55, 0.5, 0.22, '#3a2e26', 0.01); k.box(-0.53, 0, -0.2, 0.53, 0.05, 0.2, DARK);
    for (const s of [-1, 1]) k.box(s * 0.27 - 0.25, 0.1, 0.22, s * 0.27 + 0.25, 0.45, 0.225, '#4a3c32');
    k.box(-0.06, 0.5, -0.12, 0.06, 0.55, -0.02, DARK); k.box(-0.015, 0.55, -0.08, 0.015, 0.62, -0.06, DARK);
    k.box(-0.52, 0.6, -0.1, 0.52, 1.2, -0.06, '#151618', 0.01); k.box(-0.5, 0.62, -0.06, 0.5, 1.18, -0.055, '#1d2b3a');
    k.box(-0.3, 0.5, 0.05, 0.3, 0.56, 0.12, '#202226', 0.01);
  } };
  M.bed = { dims: [1.6, 0.55, 2.1], face: 'long', tinted: true, make(k, c) {
    const blanket = c || '#5a7aa8', fold = new THREE.Color(col(blanket)).lerp(new THREE.Color(1, 1, 1), 0.35);
    k.box(-0.8, 0.1, -1.05, 0.8, 0.32, 1.05, WOOD, 0.02); for (const x of [-0.74, 0.74]) for (const z of [-0.98, 0.98]) k.box(x - 0.04, 0, z - 0.04, x + 0.04, 0.1, z + 0.04, '#5a3e2a');
    k.box(-0.77, 0.32, -1.0, 0.77, 0.52, 1.02, '#f2f0ea', 0.06);
    k.box(-0.82, 0.3, -0.32, 0.82, 0.57, 1.07, blanket, 0.05); k.box(-0.8, 0.5, -0.4, 0.8, 0.6, -0.22, fold, 0.05);
    for (const s of [-1, 1]) k.box(s * 0.38 - 0.32, 0.52, -0.98, s * 0.38 + 0.32, 0.66, -0.6, '#f8f6f0', 0.06);
    k.box(-0.86, 0.1, -1.12, 0.86, 1.15, -1.03, '#6e4e36', 0.02); k.box(-0.78, 0.4, -1.04, 0.78, 1.05, -1.0, new THREE.Color(col(blanket)).multiplyScalar(0.6), 0.03);
  } };
  M.toilet = { dims: [0.45, 0.45, 0.7], face: 'long', make(k) {
    k.box(-0.2, 0.4, -0.35, 0.2, 0.8, -0.17, '#f4f2ec', 0.04); k.box(-0.21, 0.79, -0.36, 0.21, 0.82, -0.16, '#e8e6e0', 0.01); k.cyl(0, 0.82, -0.26, 0.025, 0.835, CHROME, 8);
    k.cyl(0, 0, -0.04, 0.12, 0.3, '#eceae4', 16, 0.15); k.sph(0, 0.33, 0.02, 0.19, '#f4f2ec', 0.45, undefined, 1, 1.35);
    k.box(-0.19, 0.4, -0.17, 0.19, 0.43, 0.28, '#f8f6f2', 0.06);
  } };
  M.shower = { dims: [0.85, 1.9, 0.85], face: 'any', make(k) {
    k.box(-0.425, 0, -0.425, 0.425, 0.08, 0.425, '#f4f2ec', 0.02); k.cyl(0, 0.08, 0, 0.04, 0.085, '#9ca0a4', 10);
    k.box(-0.425, 0, -0.425, 0.425, 1.95, -0.4, '#dfe8ea'); k.box(-0.425, 0, -0.425, -0.4, 1.95, 0.425, '#dfe8ea');
    for (let y = 0.3; y < 1.95; y += 0.3) { k.box(-0.42, y, -0.401, 0.42, y + 0.006, -0.398, '#b8c4c8'); k.box(-0.401, y, -0.42, -0.398, y + 0.006, 0.42, '#b8c4c8'); }
    k.cyl(0.1, 0.9, -0.39, 0.012, 1.95, CHROME, 8); k.cylZ(0.1, 1.95, -0.39, -0.25, 0.012, CHROME, 8); k.cyl(0.1, 1.9, -0.25, 0.07, 1.93, CHROME, 14);
    k.box(-0.425, 0.08, 0.41, 0.425, 1.95, 0.425, '#bfe0ea', 0, 'glass'); k.box(0.41, 0.08, -0.425, 0.425, 1.95, 0.425, '#bfe0ea', 0, 'glass');
    k.box(0.405, 0.08, 0.405, 0.43, 1.95, 0.43, CHROME); k.box(-0.43, 1.93, 0.405, 0.43, 1.96, 0.43, CHROME);
  } };
  M.mirror = { dims: [0.85, 1.6, 0.1], face: 'short', make(k) { k.box(-0.38, 0.85, -0.05, 0.38, 1.55, 0.0, '#f0ece2', 0.02); k.box(-0.34, 0.89, 0.0, 0.34, 1.51, 0.01, '#b8ccd6'); } };
  M.rug = { dims: [1.5, 0.02, 1.05], face: 'any', tinted: true, make(k, c) {
    const base = c || '#8c7665', dk = new THREE.Color(col(base)).multiplyScalar(0.65), lt = new THREE.Color(col(base)).lerp(new THREE.Color(1, 0.95, 0.85), 0.4);
    k.box(-0.75, 0, -0.525, 0.75, 0.012, 0.525, dk); k.box(-0.66, 0.012, -0.44, 0.66, 0.016, 0.44, base);
    for (let i = -2; i <= 2; i++) k.box(i * 0.24 - 0.04, 0.016, -0.36, i * 0.24 + 0.04, 0.018, 0.36, lt);
  } };
  M.screen = { dims: [1.2, 0.7, 0.1], face: 'short', make(k) { k.box(-0.6, 0, -0.05, 0.6, 0.7, 0.0, '#151618', 0.01); k.box(-0.57, 0.03, 0.0, 0.57, 0.67, 0.006, '#1d2b3a'); } };
  // cadeira de jantar virada p/ rot
  function chair(k, x, z, rot) {
    const c = Math.cos(rot), s = Math.sin(rot), P = (u, v) => [x + u * c + v * s, z - u * s + v * c];
    const parts = [];
    const bx = (u0, y0, v0, u1, y1, v1, cl, r = 0) => { const [ax, az] = P((u0 + u1) / 2, (v0 + v1) / 2), g = k.box(-Math.abs(u1 - u0) / 2, y0, -Math.abs(v1 - v0) / 2, Math.abs(u1 - u0) / 2, y1, Math.abs(v1 - v0) / 2, cl, r); g.rotateY(rot); g.translate(ax, 0, az); };
    bx(-0.21, 0.43, -0.21, 0.21, 0.47, 0.21, '#7a5638', 0.01); for (const u of [-0.18, 0.18]) for (const v of [-0.18, 0.18]) bx(u - 0.02, 0, v - 0.02, u + 0.02, 0.43, v + 0.02, '#6a4a30');
    bx(-0.2, 0.47, 0.18, 0.2, 0.92, 0.22, '#7a5638', 0.01); bx(-0.19, 0.47, -0.19, 0.19, 0.5, 0.19, '#c8b89a', 0.02);
  }
  function sofaModel(k, fabric, W, D, worn) {
    const f = col(fabric), dk = f.clone().multiplyScalar(0.78), hw = W / 2, hd = D / 2;
    for (const x of [-hw + 0.08, hw - 0.08]) for (const z of [-hd + 0.08, hd - 0.08]) k.cyl(x, 0, z, 0.03, 0.08, '#2a2420', 6);
    k.box(-hw, 0.08, -hd, hw, 0.24, hd, dk, 0.03);
    const n = W > 1.6 ? 3 : 2, cw = (W - 0.36) / n; for (let i = 0; i < n; i++) k.box(-hw + 0.18 + i * cw + 0.01, 0.24, -hd + 0.22, -hw + 0.18 + (i + 1) * cw - 0.01, 0.44, hd - 0.02, f, 0.05);
    k.box(-hw, 0.24, -hd, hw, 0.9, -hd + 0.22, f, 0.06); for (const s of [-1, 1]) k.box(s * hw - (s > 0 ? 0.18 : 0), 0.24, -hd, s * hw + (s < 0 ? 0.18 : 0), 0.62, hd, f, 0.06);
    if (!worn) for (const s of [-1, 1]) { const p = k.box(-0.18, 0, -0.06, 0.18, 0.36, 0.06, s > 0 ? '#e8d8b8' : '#c87a4a', 0.06); p.rotateY(s * 0.25); p.rotateX(-0.2); p.translate(s * (hw - 0.42), 0.46, -hd + 0.3); }
  }

  // ======================= materiais e malhas instanciadas =======================
  const matBody = new THREE.MeshLambertMaterial({ vertexColors: true });
  const matGlass = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false });
  const kinds = new Map();   // chave (tipo|cor) -> { def, meshes, list }
  const CAP = { hydrant: 1500, trashcan: 900, bin: 400, post: 800, mailbox: 400, newsbox: 400, dumpster: 200, cart: 120, couch: 200 };
  function kindOf(name, color) {
    const def = M[name], key = def.tinted && color ? name + '|' + color : name;
    if (kinds.has(key)) return kinds.get(key);
    if (def.tinted && color && [...kinds.keys()].filter(k => k.startsWith(name + '|')).length >= 8) return kindOf(name, null);
    const kit = Kit(); def.make(kit, def.tinted ? color : undefined); const geos = kit.done(), cap = CAP[name] || 300, meshes = [];
    for (const [set, geo] of Object.entries(geos)) {
      const m = new THREE.InstancedMesh(geo, set === 'glass' ? matGlass : matBody, cap);
      m.castShadow = set !== 'glass'; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m); meshes.push(m);
    }
    const k = { def, meshes, list: [], cap }; kinds.set(key, k); return k;
  }

  // poste de luz: modelo próprio em metros (braço ao longo de +x), lente que acende à noite
  const lampKit = Kit();
  lampKit.cyl(0, 0, 0, 0.2, 0.22, '#8f8b84', 12); lampKit.cyl(0, 0.22, 0, 0.075, 4.0, '#8a9296', 10, 0.055);
  lampKit.raw(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 3.95, 0), new THREE.Vector3(0, 4.15, 0), new THREE.Vector3(0.3, 4.15, 0)), 8, 0.05, 8), '#8a9296');
  lampKit.cylX(0.25, 1.05, 4.15, 0, 0.045, '#8a9296', 8); lampKit.box(0.8, 4.06, -0.13, 1.35, 4.18, 0.13, '#3c4044', 0.03); lampKit.box(0.85, 4.04, -0.1, 1.3, 4.06, 0.1, '#fff4d8', 0, 'glow');
  const lampGeo = lampKit.done(), matGlow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const lampMeshes = Object.entries(lampGeo).map(([set, geo]) => { const m = new THREE.InstancedMesh(geo, set === 'glow' ? matGlow : matBody, 2500); m.castShadow = set !== 'glow'; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); return m; });

  // ======================= semáforos (poucos: um Group por semáforo) =======================
  const LIGHT = { red: '#ff3a2a', yellow: '#ffc21a', green: '#2aff7a', walk: '#e8fff2', stop: '#ff6a2a' };
  const lightMat = {};   // grupo|cor -> material (liga/desliga trocando a cor)
  const lm = key => lightMat[key] || (lightMat[key] = new THREE.MeshBasicMaterial({ color: 0x222222, toneMapped: false }));
  const signals = new Map();
  function buildSignal(s) {
    const g = new THREE.Group(), body = new THREE.MeshLambertMaterial({ color: col('#3a3e42') }), yellow = new THREE.MeshLambertMaterial({ color: col('#2a2c2e') });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    add(new THREE.CylinderGeometry(0.075, 0.09, s.poleHeight, 12), body, s.x, s.poleHeight / 2, s.y);
    const tipX = s.x + s.ix * s.armSpan, tipZ = s.y + s.iy * s.armSpan, arm = add(new THREE.CylinderGeometry(0.055, 0.065, s.armSpan, 10), body, (s.x + tipX) / 2, s.armHeight, (s.y + tipZ) / 2);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(s.ix, 0, s.iy));
    const faceRot = Math.atan2(-s.ax, -s.ay);
    for (const f of [0.53, 1]) {
      const hx = s.x + s.ix * s.armSpan * f, hz = s.y + s.iy * s.armSpan * f;
      add(new THREE.CylinderGeometry(0.025, 0.025, s.armHeight - s.headHeight - 0.5, 6), body, hx, (s.armHeight + s.headHeight + 0.5) / 2, hz);
      const head = new THREE.Group(); head.position.set(hx, s.headHeight, hz); head.rotation.y = faceRot; g.add(head);
      const box = new THREE.Mesh(new RoundedBoxGeometry(0.36, 1.0, 0.26, 2, 0.04), yellow); box.castShadow = true; head.add(box);
      ['red', 'yellow', 'green'].forEach((c, i) => {
        const y = 0.3 - i * 0.3, lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), lm(s.group + '|' + c)); lamp.rotation.x = Math.PI / 2; lamp.position.set(0, y, 0.135); head.add(lamp);
        const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 16, 1, true, -Math.PI / 2, Math.PI), yellow); visor.rotation.x = Math.PI / 2; visor.position.set(0, y + 0.02, 0.2); head.add(visor);
      });
    }
    const ped = new THREE.Group(); ped.position.set(s.x, 2.4, s.y); ped.rotation.y = Math.atan2(-s.ix, -s.iy); g.add(ped);
    ped.add(new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.55, 0.22, 2, 0.03), yellow));
    for (const [y, c] of [[0.12, 'stop'], [-0.12, 'walk']]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.2), lm('ped|' + c)); p.position.set(0, y, 0.115); ped.add(p); }
    scene.add(g); return g;
  }
  function updateSignals(T, night) {
    const list = bridge.world.trafficSignals || [], seen = new Set();
    for (const s of list) { seen.add(s); if (!signals.has(s)) signals.set(s, buildSignal(s)); }
    for (const [s, g] of signals) if (!seen.has(s)) { scene.remove(g); signals.delete(s); }
    if (!list.length || typeof bridge.trafficPhase !== 'function') return;
    const ph = bridge.trafficPhase(T), off = 0x26221e;
    for (const grp of ['main', 'branch']) for (const c of ['red', 'yellow', 'green']) lm(grp + '|' + c).color.set(ph[grp] === c ? col(LIGHT[c]) : new THREE.Color(off));
    lm('ped|walk').color.set(ph.pedestrian === 'walk' ? col(LIGHT.walk) : new THREE.Color(off));
    lm('ped|stop').color.set(ph.pedestrian !== 'walk' && (ph.pedestrian === 'stop' || Math.floor(T * 2) % 2) ? col(LIGHT.stop) : new THREE.Color(off));
  }

  // ======================= meio-fio + sarjeta ao longo das vias =======================
  const matCurb = new THREE.MeshLambertMaterial({ vertexColors: true });
  let curbMesh = null; const curbSync = { x: 1e9, y: 1e9, n: -1, roads: null };
  function buildCurbs(cx, cy, R) {
    const pos = [], nor = [], cl = [], idx = [], roads = bridge.roads || [], RW = bridge.ROAD_W || 3.5;
    const C = { gut: col('#8e8a82'), face: col('#a39d92'), top: col('#cdc6b8'), back: col('#b7b0a2') };
    for (const rd of roads) {
      if (rd.cls === 'highway' || !rd.pts || rd.pts.length < 3) continue;
      const o = RW + (rd.off || 0);
      for (const side of [1, -1]) {
        let prev = null;
        for (let i = 0; i < rd.pts.length; i += 2) {
          const p = rd.pts[i], nx = p.nx * side, ny = p.ny * side, ex = p.x + nx * o, ey = p.y + ny * o;
          const far = (ex - cx) ** 2 + (ey - cy) ** 2 > R * R, gap = far || bridge.curbBreak(ex + nx * 0.15, ey + ny * 0.15, rd.bigId);
          if (gap) { prev = null; continue; }
          // perfil (offsets na normal, altura): sarjeta 0,4 m no asfalto, face, topo, encosto até a calçada
          const prof = [[-0.42, 0.006], [0, 0.006], [0, 0.006], [0, 0.15], [0, 0.15], [0.17, 0.15], [0.17, 0.15], [0.3, 0.02]];
          const nrm = [[0, 1, 0], [0, 1, 0], [-nx, 0, -ny], [-nx, 0, -ny], [0, 1, 0], [0, 1, 0], [nx * 0.6, 0.8, ny * 0.6], [nx * 0.6, 0.8, ny * 0.6]];
          const cc = [C.gut, C.gut, C.face, C.face, C.top, C.top, C.back, C.back];
          const base = pos.length / 3;
          prof.forEach(([d, h], j) => { pos.push(ex + nx * d, h, ey + ny * d); nor.push(...nrm[j]); cl.push(cc[j].r, cc[j].g, cc[j].b); });
          if (prev !== null) for (let j = 0; j < 8; j += 2) { const a = prev + j, b = base + j; side > 0 ? idx.push(a, b, a + 1, a + 1, b, b + 1) : idx.push(a, a + 1, b, a + 1, b + 1, b); }
          prev = base;
        }
      }
    }
    if (curbMesh) { scene.remove(curbMesh); curbMesh.geometry.dispose(); curbMesh = null; }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx);
    curbMesh = new THREE.Mesh(g, matCurb); curbMesh.castShadow = true; curbMesh.receiveShadow = true; curbMesh.frustumCulled = false; scene.add(curbMesh);
  }

  // ======================= distribuição =======================
  const handles = b => (bridge.props3d ? bridge.props3d(b) : false) && M[b.kind] && b.kind !== 'blanket';
  const upstairsIn = H => H.upper && H.inside && (bridge.player.floor === 1 || (bridge.player.stairTravel && bridge.player.stairTravel.to === 1));
  const state = { objects: 0, furniture: 0, lamps: 0, signals: 0, curbs: 0, ms: 0 };
  const sync = { x: 1e9, y: 1e9, n: -1, v: -1, inside: '' }, mat = new THREE.Matrix4(), q = new THREE.Quaternion(), ps = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function place(k, i, x, y, z, rot, sx, sy, sz) { ps.set(x, z, y); q.setFromAxisAngle(up, rot); sc.set(sx, sy, sz); mat.compose(ps, q, sc); for (const m of k.meshes) m.setMatrixAt(i, mat); }
  function rebuild(cx, cy, R) {
    const t0 = performance.now();
    for (const k of kinds.values()) k.list.length = 0;
    let furniture = 0, objects = 0;
    for (const b of bridge.boxes || []) {
      if (!handles(b)) continue;
      const dx = b.x - cx, dy = b.y - cy; if (dx * dx + dy * dy > R * R) continue;
      const H = b.house;
      if (H && !b.exteriorFixture) { if (!H.inside || ((b.floor === 1) !== !!upstairsIn(H))) continue; furniture++; } else objects++;
      const color = M[b.kind].tinted ? b.top : null, k = kindOf(b.kind, color);
      if (k.list.length < k.cap) k.list.push(b);
    }
    for (const bin of bridge.urbanBins || []) { const dx = bin.x - cx, dy = bin.y - cy; if (dx * dx + dy * dy > R * R) continue; const k = kindOf('bin', bin.kind === 'metal' ? '#697c82' : '#3b6554'); if (k.list.length < k.cap) k.list.push({ x: bin.x, y: bin.y, z: 0, w: 0.6, d: 0.65, h: 1, rot: (bin.seed || 0) % 6.28, kind: 'bin' }); objects++; }
    for (const k of kinds.values()) {
      const [W, Hn, D] = k.def.dims;
      k.list.forEach((b, i) => {
        let rot = -(b.rot || 0), sx = b.w / W, sz = b.d / D;
        const H = b.house, face = k.def.face;
        if (H && face) {   // vira a frente (+z) p/ o centro do cômodo
          const hx = (H.x0 + H.x1) / 2 - b.x, hy = (H.y0 + H.y1) / 2 - b.y, c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0);
          const cand = [[0, -s, c], [1, -c, -s], [2, s, -c], [3, c, s]].filter(([qq]) => face === 'any' ? true : face === 'short' ? (b.w >= b.d ? qq % 2 === 0 : qq % 2 === 1) : (b.w >= b.d ? qq % 2 === 1 : qq % 2 === 0));
          let best = cand[0], bd = -Infinity; for (const cd of cand) { const d = cd[1] * hx + cd[2] * hy; if (d > bd) { bd = d; best = cd; } }
          rot -= best[0] * Math.PI / 2; if (best[0] % 2) { sx = b.d / W; sz = b.w / D; }
        }
        // só ajuste leve de proporção (as caixas antigas às vezes reservam espaço a mais em volta do objeto)
        const lim = H ? [0.65, 1.5] : [0.7, 1.4]; sx = Math.min(lim[1], Math.max(lim[0], sx)); sz = Math.min(lim[1], Math.max(lim[0], sz));
        place(k, i, b.x, b.y, b.z || 0, rot, sx, Math.min(1.5, Math.max(0.6, (b.h || Hn) / Hn)), sz);
      });
      for (const m of k.meshes) { m.count = k.list.length; m.instanceMatrix.needsUpdate = true; }
    }
    // postes de luz
    const lamps = (bridge.world.lamps || []).filter(l => (l.x - cx) ** 2 + (l.y - cy) ** 2 < R * R);
    lamps.forEach((l, i) => { ps.set(l.x, 0, l.y); q.setFromAxisAngle(up, -Math.atan2(l.ay || 0, l.ax || 1)); sc.set(1, 1, 1); mat.compose(ps, q, sc); for (const m of lampMeshes) m.setMatrixAt(i, mat); });
    for (const m of lampMeshes) { m.count = lamps.length; m.instanceMatrix.needsUpdate = true; }
    Object.assign(state, { objects, furniture, lamps: lamps.length, ms: +(performance.now() - t0).toFixed(1) });
  }

  return {
    state,
    update(now, T) {
      const c = bridge.cam, w = bridge.world, night = !!w.night;
      const halfW = c.W / (2 * c.zoom), halfH = c.H / (2 * c.zoom) / (c.tilt || 0.5), R = Math.min(140, Math.hypot(halfW, halfH) + 12);
      const inside = (bridge.houses || []).filter(H => H.inside).map(H => (H.seed || 0) + (upstairsIn(H) ? 'u' : '')).join(',');
      const n = (bridge.boxes || []).length;
      if (Math.hypot(c.x - sync.x, c.y - sync.y) > 6 || n !== sync.n || w.version !== sync.v || inside !== sync.inside) { Object.assign(sync, { x: c.x, y: c.y, n, v: w.version, inside }); rebuild(c.x, c.y, R); }
      const roads = bridge.roads;
      if (Math.hypot(c.x - curbSync.x, c.y - curbSync.y) > 40 || roads !== curbSync.roads || (roads || []).length !== curbSync.n) { Object.assign(curbSync, { x: c.x, y: c.y, roads, n: (roads || []).length }); buildCurbs(c.x, c.y, 130); state.curbs = curbMesh ? curbMesh.geometry.index.count / 3 : 0; }
      matGlow.color.setScalar(night ? 1.6 : 0.55);
      updateSignals(T, night); state.signals = signals.size;
    },
  };
}
