// house-3d.mjs — partes das casas em 3D na camada WebGL (estilo The Sims 4), no lugar dos desenhos 2D:
// janelas de guilhotina (a folha de baixo sobe e desce com a animação da casa), portas que giram na dobradiça,
// cercas de madeira (de quintal e rurais), sebes das mansões, toldos e coberturas de varanda, deque, pilares,
// colunas e pórticos das mansões, pilares de portão e degraus de entrada.
// Paredes e telhados continuam no 2D: as janelas ficam rentes à fachada, na frente do oclusor de profundidade
// da parede, então somem sozinhas quando a parede está de costas p/ a câmera. Com o jogador dentro de uma casa,
// as aberturas dela voltam a ser desenhadas pelo 2D (as paredes são cortadas).
import {makeKit} from './kit-3d.mjs';
import {architecturalTexture} from './architecture-materials.mjs';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const hash = (a, b = 0, c = 0) => { let h = Math.imul((a * 73856093) ^ (b * 19349663) ^ (c * 83492791), 0x45d9f3b); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

export function createHouse3D(THREE, scene, bridge, opts = {}) {
  const Kit = makeKit(THREE), col = hex => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
  const see = m => (opts.seeThrough ? opts.seeThrough(m) : m);

  // ======================= texturas pintadas em canvas =======================
  const canvas = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(91);
  // vidro: céu refletido (claro em cima), dois reflexos diagonais
  const glassTex = canvas(64, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e4f0f6'); gr.addColorStop(0.45, '#9fbccd'); gr.addColorStop(1, '#58758a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.35)'; for (const [x, k] of [[10, 14], [38, 7]]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + k, 0); g.lineTo(x + k - 40, h); g.lineTo(x - 40, h); g.fill(); }
  });
  glassTex.wrapS = glassTex.wrapT = THREE.ClampToEdgeWrapping;
  // madeira: veios verticais, nós e sujeira na base (tingida pela cor da cerca)
  const woodTex = canvas(128, 256, (g, w, h) => {
    g.fillStyle = '#d9d2c6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { const x = rnd() * w, a = 0.05 + rnd() * 0.12; g.fillStyle = rnd() < 0.6 ? `rgba(70,50,30,${a})` : `rgba(255,248,235,${a})`; g.fillRect(x, 0, 0.6 + rnd() * 1.8, h); }
    for (let i = 0; i < 7; i++) { const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * 3; const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.2); gr.addColorStop(0, 'rgba(60,38,20,0.55)'); gr.addColorStop(0.5, 'rgba(90,60,35,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 2.2, 0, 0, TAU); g.fill(); }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(40,30,20,${0.04 + rnd() * 0.06})`; g.fillRect(rnd() * w, rnd() * h, 1, 2 + rnd() * 6); }
  });
  // folhagem de sebe: milhares de folhinhas sobrepostas com luz no alto (repete sem emenda)
  const leafPaint = (g, w, h) => {
    g.fillStyle = '#24461c'; g.fillRect(0, 0, w, h);
    const C = ['#2f5a24', '#376a2a', '#3f7530', '#4a8236', '#2a4f20', '#55903c', '#467a2e'];
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * w, y = rnd() * h, a = rnd() * TAU, s = 3 + rnd() * 5, c = C[(rnd() * C.length) | 0];
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        const X = x + ox, Y = y + oy; if (X < -10 || X > w + 10 || Y < -10 || Y > h + 10) continue;
        g.save(); g.translate(X, Y); g.rotate(a); g.fillStyle = 'rgba(10,25,8,0.45)'; g.beginPath(); g.ellipse(0.8, 1.2, s, s * 0.5, 0, 0, TAU); g.fill();
        g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, s, s * 0.5, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(220,255,180,0.18)'; g.beginPath(); g.ellipse(-s * 0.25, -s * 0.12, s * 0.5, s * 0.18, 0, 0, TAU); g.fill(); g.restore();
      }
    }
  };
  const leafTex = canvas(256, 256, leafPaint);

  // ======================= materiais =======================
  const matBody = see(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const matPortico=see(new THREE.MeshStandardMaterial({vertexColors:true,map:architecturalTexture(THREE,'concrete','color'),normalMap:architecturalTexture(THREE,'concrete','normal'),normalScale:new THREE.Vector2(.25,.25),roughnessMap:architecturalTexture(THREE,'concrete','roughness'),roughness:1}));
  const matFlat = new THREE.MeshLambertMaterial({ vertexColors: true });   // rente à parede: sem vazado
  const matGlass = new THREE.MeshPhongMaterial({ map: glassTex, vertexColors: true, transparent: true, opacity: 0.62, shininess: 90, specular: 0x777777, depthWrite: false });
  const matCloth = see(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const matHole = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const matWood = see(new THREE.MeshLambertMaterial({ vertexColors: true, map: woodTex }));
  const matHedge = see(new THREE.MeshLambertMaterial({ vertexColors: true, map: leafTex, bumpMap: leafTex, bumpScale: 2.5 }));

  // ======================= instâncias por tipo =======================
  const pool = new Map();
  function kind(key, build, cap, mats, o = {}) {
    if (pool.has(key)) return pool.get(key);
    const kit = Kit(); build(kit); const meshes = [];
    for (const [set, geo] of Object.entries(kit.done())) {
      const m = new THREE.InstancedMesh(geo, mats[set] || mats.body, cap);
      m.castShadow = o.shadow !== false && set !== 'glass' && set !== 'hole'; m.receiveShadow = set !== 'hole'; m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if ((o.tint || []).includes(set)) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      scene.add(m); meshes.push(m);
    }
    const k = { meshes, n: 0, cap }; pool.set(key, k); return k;
  }
  function put(k, m4, color) {
    if (k.n >= k.cap) return -1; const i = k.n++;
    for (const m of k.meshes) { m.setMatrixAt(i, m4); if (color && m.instanceColor) m.setColorAt(i, color); }
    return i;
  }
  const M4 = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(), S3 = new THREE.Vector3();
  // matriz com eixo x local = (ax,ay) no chão, y = cima, z = x × y (nunca espelha); escala opcional
  function frame(px, pz, py, ax, ay, sx = 1, sy = 1, sz = 1) {
    const l = Math.hypot(ax, ay) || 1; X.set(ax / l, 0, ay / l); Z.set(-ay / l, 0, ax / l);
    M4.makeBasis(X.multiplyScalar(sx), Y.set(0, sy, 0), Z.multiplyScalar(sz)); M4.setPosition(px, pz, py); return M4;
  }

  // ======================= janelas de guilhotina =======================
  // três tamanhos (iguais aos pintados na fachada por archi.js): normal, grande (tijolo, frente) e andar de cima
  const WV = { n: [0.7, 1.1], b: [0.88, 1.8], u: [0.66, 1.17] }, FW = 0.07;
  const winGeo = {};
  function winKinds(v) {
    if (winGeo[v]) return winGeo[v];
    const [w, h] = WV[v], iw = w - FW * 2, ih = h - FW * 2, mid = FW + ih / 2, W2 = w / 2, I2 = iw / 2;
    const out = {};
    // moldura fixa + folha de cima + vidro de cima
    out.frame = kind('win-frame-' + v, k => {
      k.box(-W2, 0, 0, -I2, h, 0.035, '#ffffff', 0.006); k.box(I2, 0, 0, W2, h, 0.035, '#ffffff', 0.006);
      k.box(-I2, h - FW, 0, I2, h, 0.035, '#ffffff', 0.006); k.box(-I2, 0, 0, I2, FW, 0.035, '#ffffff', 0.006);
      k.box(-W2 - 0.05, -0.035, 0, W2 + 0.05, 0.012, 0.08, '#f4f2ee', 0.008);   // peitoril
      k.box(-W2 - 0.03, h, 0, W2 + 0.03, h + 0.045, 0.05, '#f4f2ee', 0.006);    // verga
      const t = 0.035;   // folha de cima (fixa), mais recuada
      k.box(-I2, mid - 0.01, 0.01, -I2 + t, h - FW, 0.028, '#ffffff'); k.box(I2 - t, mid - 0.01, 0.01, I2, h - FW, 0.028, '#ffffff');
      k.box(-I2, h - FW - t, 0.01, I2, h - FW, 0.028, '#ffffff'); k.box(-0.012, mid, 0.012, 0.012, h - FW, 0.026, '#ffffff');
      const gl = new THREE.PlaneGeometry(iw - t * 2, ih / 2 - t); gl.translate(0, mid + (ih / 2 - t) / 2 - 0.005, 0.019); k.raw(gl, '#ffffff', 'glass');
    }, 900, { body: matFlat, glass: matGlass }, { tint: ['body'], shadow: false });
    // folha de baixo (sobe): moldura com travessa de encontro mais grossa + vidro
    out.sash = kind('win-sash-' + v, k => {
      const t = 0.035, top = mid + 0.012;
      k.box(-I2, FW, 0.03, -I2 + t, top, 0.048, '#ffffff'); k.box(I2 - t, FW, 0.03, I2, top, 0.048, '#ffffff');
      k.box(-I2, FW, 0.03, I2, FW + t, 0.048, '#ffffff'); k.box(-I2, top - 0.045, 0.03, I2, top, 0.05, '#ffffff');
      k.box(-0.012, FW, 0.032, 0.012, top, 0.046, '#ffffff'); k.box(-0.05, top - 0.03, 0.05, 0.05, top - 0.015, 0.06, '#c9b27a');   // trinco
      const gl = new THREE.PlaneGeometry(iw - t * 2, top - FW - t - 0.045); gl.translate(0, FW + t + (top - FW - t - 0.045) / 2, 0.039); k.raw(gl, '#ffffff', 'glass');
    }, 900, { body: matFlat, glass: matGlass }, { tint: ['body'], shadow: false });
    // fundo do vão (interior): escuro de dia, luz quente à noite
    out.hole = kind('win-hole-' + v, k => { const g = new THREE.PlaneGeometry(iw, ih); g.translate(0, FW + ih / 2, 0.003); k.raw(g, '#ffffff', 'hole'); }, 900, { hole: matHole }, { tint: ['hole'], shadow: false });
    // cortinas presas nas laterais, com pregas
    out.curt = kind('win-curt-' + v, k => {
      const cw = iw * 0.24, n = 5;
      for (const s of [-1, 1]) for (let j = 0; j < n; j++) { const x0 = s * (I2 - cw * j / n), x1 = s * (I2 - cw * (j + 1) / n); k.box(Math.min(x0, x1), FW + 0.02, 0.005, Math.max(x0, x1), h - FW - 0.01, 0.008 + (j % 2) * 0.004, j % 2 ? '#ffffff' : '#d8d4cc'); }
    }, 900, { body: matFlat }, { tint: ['body'], shadow: false });
    // venezianas abertas ao lado (só casas que têm)
    out.shut = kind('win-shut-' + v, k => {
      const sw = Math.max(0.12, w * 0.32);
      for (const s of [-1, 1]) {
        const x0 = s > 0 ? W2 + 0.03 : -W2 - 0.03 - sw, x1 = x0 + sw;
        k.box(x0, 0, 0, x0 + 0.03, h, 0.03, '#ffffff'); k.box(x1 - 0.03, 0, 0, x1, h, 0.03, '#ffffff'); k.box(x0, 0, 0, x1, 0.04, 0.03, '#ffffff'); k.box(x0, h - 0.04, 0, x1, h, 0.03, '#ffffff');
        k.box(x0 + 0.03, 0.04, 0.004, x1 - 0.03, h - 0.04, 0.008, '#8c8c8c');
        for (let y = 0.07; y < h - 0.05; y += 0.055) { const g = k.box(x0 + 0.03, -0.016, -0.004, x1 - 0.03, 0.016, 0.004, '#ffffff'); g.rotateX(-0.6); g.translate(0, y, 0.018); }
      }
    }, 900, { body: matFlat }, { tint: ['body'], shadow: false });
    // grade de ferro (bairros pobres)
    out.bars = kind('win-bars-' + v, k => {
      for (let x = -I2 + 0.05; x < I2 - 0.02; x += 0.11) k.cyl(x, FW - 0.02, 0.075, 0.009, h - FW + 0.02, '#2a2a2c', 6);
      for (const y of [0.33, 0.66]) k.box(-I2, FW + ih * y - 0.012, 0.068, I2, FW + ih * y + 0.012, 0.082, '#2a2a2c');
      for (const s of [-1, 1]) k.box(s * I2 - 0.02, FW - 0.03, 0.04, s * I2 + 0.02, h - FW + 0.03, 0.085, '#2a2a2c');
    }, 900, { body: matFlat }, { shadow: false });
    out.rise = ih / 2 - 0.035;
    return (winGeo[v] = out);
  }

  // ======================= portas =======================
  // folha com a dobradiça na origem, abrindo ao longo de +x; quatro estilos (como paintDoor em archi.js)
  const DW = 0.8, DH = 2.05, DT = 0.045;
  function doorKinds(style) {
    const key = ['panel', 'flush', 'metal', 'glass'].includes(style) ? style : 'panel';
    return {
      leaf: kind('door-leaf-' + key, k => {
        if (key === 'glass') {
          for (const [x0, y0, x1, y1] of [[0, 0, 0.07, DH], [DW - 0.07, 0, DW, DH], [0, 0, DW, 0.12], [0, DH - 0.07, DW, DH]]) k.box(x0, y0, -DT / 2, x1, y1, DT / 2, '#ffffff', 0.005);
          const gl = new THREE.PlaneGeometry(DW - 0.14, DH - 0.19); gl.translate(DW / 2, 0.12 + (DH - 0.19) / 2, 0); k.raw(gl, '#ffffff', 'glass');
          return;
        }
        k.box(0, 0, -DT / 2, DW, DH, DT / 2, key === 'panel' ? '#e0e0e0' : '#ffffff', 0.006);
        if (key === 'panel') for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) for (const s of [-1, 1]) {
          const x0 = 0.07 + c * 0.36, y0 = 0.1 + r * 0.64, z = s * DT / 2;
          k.box(x0, y0, Math.min(z, z + s * 0.012), x0 + 0.3, y0 + (r === 2 ? 0.55 : 0.56), Math.max(z, z + s * 0.012), '#ffffff', 0.01);
        }
        if (key === 'metal') {
          for (let y = 0.12; y < DH - 0.1; y += 0.16) for (const s of [-1, 1]) k.box(0.04, y, s * DT / 2 - 0.002, DW - 0.04, y + 0.012, s * DT / 2 + 0.002, '#9a9a9a');
          for (const s of [-1, 1]) k.box(0.2, 1.45, s * (DT / 2 + 0.004) - 0.004, 0.6, 1.8, s * (DT / 2 + 0.004) + 0.004, '#5a6a78');
        }
      }, 300, { body: matBody, glass: matGlass }, { tint: ['body'] }),
      hw: kind('door-hw', k => {
        for (const s of [-1, 1]) { k.cylZ(DW - 0.08, 1.0, s * DT / 2, s * (DT / 2 + 0.05), 0.012, '#c9a54a', 8); k.sph(DW - 0.08, 1.0, s * (DT / 2 + 0.055), 0.03, '#d8b45a'); k.box(DW - 0.105, 0.9, s * DT / 2 - 0.003, DW - 0.055, 1.12, s * DT / 2 + 0.003, '#b8943e'); }
        for (const y of [0.25, 1.0, 1.8]) k.box(-0.012, y, -0.02, 0.012, y + 0.1, 0.02, '#3a3836');
      }, 300, { body: matBody }),
    };
  }
  const doorCase = kind('door-case', k => {
    const o = 0.4, f = 0.08, H = 2.12;
    k.box(-o - f, 0, 0, -o, H + f, 0.035, '#ffffff', 0.006); k.box(o, 0, 0, o + f, H + f, 0.035, '#ffffff', 0.006); k.box(-o - f, H, 0, o + f, H + f, 0.04, '#ffffff', 0.006);
    k.box(-o - f - 0.03, H + f, 0, o + f + 0.03, H + f + 0.05, 0.06, '#ffffff', 0.006);
  }, 300, { body: matFlat }, { tint: ['body'] });
  const doorSill = kind('door-sill', k => {
    k.box(-0.42, 0, -0.14, 0.42, 0.035, 0.07, '#b9b3a6', 0.008);
    k.box(-0.38, 0, 0.12, 0.38, 0.018, 0.62, '#6a4e36', 0.006); k.box(-0.34, 0.018, 0.16, 0.34, 0.02, 0.58, '#7f6044');   // capacho
  }, 300, { body: matBody }, { shadow: false });

  // ======================= cercas de madeira =======================
  const fenceYard = kind('fence-yard', k => {
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.5) / 4, half = 0.095, zHi = 1.235 + (i % 3) * 0.028, sh = new THREE.Shape();
      sh.moveTo(-half, 0.08); sh.lineTo(half, 0.08); sh.lineTo(half, zHi - 0.09); sh.lineTo(0, zHi); sh.lineTo(-half, zHi - 0.09); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: false }); g.translate(t, 0, 0.012);
      const uv = g.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) * 1.6 + i * 0.27, uv.getY(j) * 0.8);
      k.raw(g, i % 3 ? '#ffffff' : '#e8e4dc');
    }
    for (const z of [0.43, 0.94]) k.box(0, z - 0.065, -0.05, 1, z, -0.012, '#d8d0c4');
  }, 2000, { body: matWood }, { tint: ['body'] });
  const fenceRural = kind('fence-rural', k => {
    for (const z of [0.39, 0.89]) { const g = k.box(0, z - 0.08, -0.04, 1, z, 0.04, '#ffffff', 0.012); }
  }, 2000, { body: matWood }, { tint: ['body'] });
  const postYard = kind('fence-post-yard', k => { k.box(-0.075, -0.05, -0.075, 0.075, 1.25, 0.075, '#e0d8cc', 0.01); const cap = new THREE.ConeGeometry(0.1, 0.06, 4); cap.rotateY(Math.PI / 4); cap.translate(0, 1.28, 0); k.raw(cap, '#ece6da'); }, 2000, { body: matWood }, { tint: ['body'] });
  const postRural = kind('fence-post-rural', k => { k.cyl(0, -0.05, 0, 0.1, 1.17, '#ffffff', 9, 0.085); }, 2000, { body: matWood }, { tint: ['body'] });

  // ======================= toldos, varandas, colunas, pórticos, degraus =======================
  const AWN = [['#2f6b4f', '#f2efe6'], ['#b8352c', '#f2efe6'], ['#20406a', '#f2efe6'], ['#c8742f', '#f6e9cf'], ['#3d8fa6', '#ffffff'], ['#5a4a6e', '#efe9df']];
  // toldo de lona listrada (1,7 × 0,9 m): desce da parede p/ a frente, abas laterais e babado recortado
  function awningKind(p) {
    return kind('awning-' + p, k => {
      const [c1, c2] = AWN[p], W = 0.85, D = 0.9, top = 0.3, n = 8;
      for (let i = 0; i < n; i++) {
        const x0 = -W + (2 * W) * i / n, x1 = -W + (2 * W) * (i + 1) / n, g = new THREE.PlaneGeometry(x1 - x0, Math.hypot(D, top));
        g.rotateX(-Math.PI / 2 + Math.atan2(top, D)); g.translate((x0 + x1) / 2, top / 2, 0); k.raw(g, i % 2 ? c2 : c1);
        for (let s = 0; s < 2; s++) {   // babado: dois dentes por gomo
          const xa = x0 + (x1 - x0) * s / 2, xb = xa + (x1 - x0) / 2, tri = new THREE.BufferGeometry();
          tri.setAttribute('position', new THREE.Float32BufferAttribute([xa, 0, D / 2, xb, 0, D / 2, (xa + xb) / 2, -0.17, D / 2, xa, 0, D / 2, (xa + xb) / 2, -0.17, D / 2, xb, 0, D / 2], 3)); tri.computeVertexNormals();
          const sq = new THREE.PlaneGeometry(xb - xa, 0.07); sq.translate((xa + xb) / 2, -0.035, D / 2 + 0.001); k.raw(sq, i % 2 ? c2 : c1); k.raw(tri, i % 2 ? c2 : c1);
        }
      }
      for (const s of [-1, 1]) {   // abas laterais triangulares
        const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([s * W, top, -D / 2, s * W, 0, D / 2, s * W, -0.07, D / 2, s * W, top, -D / 2, s * W, -0.07, D / 2, s * W, 0, D / 2], 3)); tri.computeVertexNormals(); k.raw(tri, c1);
        const bar = new THREE.CylinderGeometry(0.012, 0.012, Math.hypot(D, top), 6); bar.rotateX(Math.PI / 2); bar.rotateX(Math.atan2(top, D)); bar.translate(s * W, top / 2, 0); k.raw(bar, '#5a5d60');
      }
      k.cylX(-W, W, 0, D / 2 - 0.01, 0.014, '#5a5d60', 6);
    }, 300, { body: matCloth });
  }
  // cobertura da varanda: laje inclinada com telhas da cor do telhado, testeira na cor do acabamento, forro claro
  const porchKey = b => 'porchroof|' + b.top + '|' + b.side;
  function porchRoofKind(b) {
    return kind(porchKey(b), k => {
      const W = 1.9, D = 1.0, top = 0.28, roof = k.col(b.top || '#8a8a8a'), trim = b.side || '#f1ece0';
      const g = new THREE.BoxGeometry(2 * W + 0.1, 0.05, Math.hypot(2 * D, top) + 0.08, 1, 1, 1); g.rotateX(Math.atan2(top, 2 * D)); g.translate(0, top / 2 + 0.07, 0.02); k.raw(g, roof);
      for (let i = 1; i < 10; i++) { const r = new THREE.BoxGeometry(2 * W + 0.1, 0.012, 0.02); r.rotateX(Math.atan2(top, 2 * D)); const zz = -D + 2 * D * i / 10; r.translate(0, 0.1 + top * (1 - i / 10) - 0.0, zz + 0.02); k.raw(r, roof.clone().multiplyScalar(0.8)); }
      k.box(-W - 0.05, -0.08, D - 0.04, W + 0.05, 0.1, D + 0.05, trim, 0.01);       // testeira na frente
      k.box(-W, -0.04, -D, W, -0.02, D, '#efebe2');                                   // forro
      for (const s of [-1, 1]) k.box(s * W - 0.03, -0.08, -D, s * W + 0.03, 0.12, D, trim);
    }, 200, { body: matBody });
  }
  const deckKind = c => kind('deck|' + c, k => {
    const W = 1.8, D = 0.95, wood = k.col(c || '#8a6a4a');
    k.box(-W, 0, -D, W, 0.03, D, wood.clone().multiplyScalar(0.55));
    for (let i = 0; i < 13; i++) { const z0 = -D + 2 * D * i / 13 + 0.006, z1 = -D + 2 * D * (i + 1) / 13 - 0.006; k.box(-W, 0.03, z0, W, 0.07, z1, wood.clone().multiplyScalar(0.9 + 0.2 * hash(i, 3)), 0.005); }
    k.box(-W - 0.03, 0, D - 0.04, W + 0.03, 0.075, D + 0.02, wood.clone().multiplyScalar(0.75));
  }, 200, { body: matBody });
  const porchPost = kind('porchpost', k => {
    k.box(-0.11, 0, -0.11, 0.11, 0.3, 0.11, '#ffffff', 0.01); k.cyl(0, 0.3, 0, 0.065, 2.2, '#ffffff', 14, 0.058);
    for (const y of [0.32, 2.15]) k.cyl(0, y, 0, 0.085, y + 0.05, '#f2efe8', 14); k.box(-0.1, 2.2, -0.1, 0.1, 2.42, 0.1, '#ffffff', 0.01);
  }, 400, { body: matBody }, { tint: ['body'] });
  // coluna clássica (pórticos das mansões): plinto, fuste canelado e capitel; altura nominal 3,4 m
  const columnKind = kind('column', k => {
    k.box(-0.24, 0, -0.24, 0.24, 0.14, 0.24, '#ffffff', 0.01); k.cyl(0, 0.14, 0, 0.19, 0.24, '#f6f4ee', 20);
    const f = new THREE.CylinderGeometry(0.15, 0.17, 2.94, 20, 1); const p = f.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), r = 1 - 0.035 * Math.max(0, Math.cos(a * 10)); p.setX(i, p.getX(i) * r); p.setZ(i, p.getZ(i) * r); } f.computeVertexNormals(); f.translate(0, 0.24 + 1.47, 0); k.raw(f, '#ffffff');
    k.cyl(0, 3.18, 0, 0.17, 3.24, '#f6f4ee', 20, 0.22); k.box(-0.25, 3.24, -0.25, 0.25, 3.4, 0.25, '#ffffff', 0.012);
  }, 300, { body: matBody }, { tint: ['body'] });
  // pórtico: entablamento com cornija em três degraus (nominal 1 × 0,4 × 1, escalado ao tamanho)
  const porticoKind = kind('portico', k => {
    k.box(-0.5, 0, -0.5, 0.5, 0.25, 0.5, '#ffffff'); k.box(-0.51, 0.25, -0.51, 0.51, 0.31, 0.51, '#f4f2ec'); k.box(-0.52, 0.31, -0.52, 0.52, 0.4, 0.52, '#ffffff');
    k.box(-0.5, -0.03, -0.5, 0.5, 0, 0.5, '#e8e4da');
    k.box(-.47,.401,-.47,.47,.415,.47,'#c9c9bd');
    for(const p of [-.25,0,.25])k.box(p-.001,.416,-.46,p+.001,.418,.46,'#a7aaa0');
  }, 200, { body: matPortico }, { tint: ['body'] });
  const gatepostKind = kind('gatepost', k => {
    k.box(-0.3, 0, -0.3, 0.3, 0.15, 0.3, '#e8e4da', 0.01); k.box(-0.26, 0.15, -0.26, 0.26, 1.85, 0.26, '#ffffff', 0.01);
    for (let y = 0.45; y < 1.8; y += 0.35) k.box(-0.265, y, -0.265, 0.265, y + 0.02, 0.265, '#e2ddd2');
    k.box(-0.32, 1.85, -0.32, 0.32, 1.95, 0.32, '#f4f2ec', 0.015); k.cyl(0, 1.95, 0, 0.09, 2.02, '#f4f2ec', 12); k.sph(0, 2.12, 0, 0.12, '#ffffff');
  }, 200, { body: matBody }, { tint: ['body'] });
  // degraus de entrada: espelho e piso com quina gasta, o de baixo avança p/ a calçada (nominal 1,4 × 0,14 × 0,6)
  const stepKind = kind('step', k => {
    k.box(-0.7, 0, -0.3, 0.7, 0.14, 0.05, '#c2bdb3', 0.012); k.box(-0.72, 0, 0.05, 0.72, 0.07, 0.32, '#b5b0a6', 0.012);
    k.box(-0.7, 0.135, -0.3, 0.7, 0.142, -0.25, '#a8a399');
  }, 400, { body: matBody });

  // ======================= sebe (mansões) =======================
  let hedgeMesh = null;
  function buildHedges(list) {
    if (hedgeMesh) { scene.remove(hedgeMesh); hedgeMesh.geometry.dispose(); hedgeMesh = null; }
    const geos = [];
    for (const b of list) {
      const L = Math.max(0.6, b.w), D = Math.max(0.5, b.d || 0.8), H = Math.max(0.6, b.h || 1.4), r = Math.min(0.32, D / 2 - 0.02, H / 2 - 0.02);
      let g = new THREE.BoxGeometry(L, H, D, Math.max(2, Math.ceil(L / 0.18)), Math.max(2, Math.ceil(H / 0.18)), Math.max(2, Math.ceil(D / 0.18)));
      g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4);
      const p = g.attributes.position, c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0), ex = L / 2 - r, ey = H / 2 - r, ez = D / 2 - r, sd = (b.seed || 0) * 0.37;
      const cl = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const cx = Math.max(-ex, Math.min(ex, x)), cy = Math.max(-ey, Math.min(ey, y)), cz = Math.max(-ez, Math.min(ez, z));
        let dx = x - cx, dy = y - cy, dz = z - cz; const dl = Math.hypot(dx, dy, dz) || 1;
        const wx0 = b.x + x * c - z * s, wy0 = b.y + x * s + z * c;
        const nz = 1 + 0.16 * Math.sin(wx0 * 5.1 + y * 3.7 + sd) * Math.cos(wy0 * 4.3 - y * 2.9) + 0.09 * Math.sin(wx0 * 13 + wy0 * 11 + y * 9);
        dx = dx / dl * r * nz; dy = dy / dl * r * nz; dz = dz / dl * r * nz;
        let X0 = cx + dx, Y0 = cy + dy + H / 2, Z0 = cz + dz; Y0 = Math.max(0.01, Y0);
        const wx = b.x + X0 * c - Z0 * s, wy = b.y + X0 * s + Z0 * c;
        p.setXYZ(i, wx, Y0, wy);
        const ao = 0.5 + 0.5 * Math.min(1, Y0 / H) ** 0.7; cl.set([ao, ao, ao], i * 3);
        uv[i * 2] = (wx + wy) * 0.55; uv[i * 2 + 1] = Y0 * 0.55 + (wx - wy) * 0.2;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cl, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals();
      geos.push(g.toNonIndexed());
    }
    if (!geos.length) return 0;
    const merged = mergeGeometriesSafe(geos);
    hedgeMesh = new THREE.Mesh(merged, matHedge); hedgeMesh.castShadow = hedgeMesh.receiveShadow = true; hedgeMesh.frustumCulled = false; scene.add(hedgeMesh);
    return list.length;
  }
  function mergeGeometriesSafe(list) {
    let n = 0; for (const g of list) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
    for (const g of list) { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); U.set(g.attributes.uv.array, o * 2); o += c; g.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); return g;
  }

  // ======================= distribuição =======================
  const state = { windows: 0, doors: 0, fences: 0, hedges: 0, fixtures: 0, ms: 0 };
  const sync = { x: 1e9, y: 1e9, n: -1, nh: -1, v: -1, inside: '', night: null };
  let anims = [], doors = [], holes = [];
  const upperAnim = new WeakMap();
  const tmpC = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1);
  const handled = H => !H.architecture && !H.facadeFn && !(H.style && H.style.boarded);
  // eixo "para fora" de uma caixa: o lado curto/largo que aponta p/ longe da casa (centro de referência)
  function outward(b, cx, cy) {
    const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0), bx = -s, by = c;
    return (b.x - cx) * bx + (b.y - cy) * by >= 0 ? [c, s] : [-c, -s];
  }
  function holeColor(H, night) { return night ? (H.lightOn ? tmpC.setRGB(1.0, 0.72, 0.38) : tmpC.setRGB(0.05, 0.06, 0.08)) : tmpC.setRGB(0.16, 0.19, 0.22); }

  function rebuild(cx, cy, R, night) {
    const t0 = performance.now();
    for (const k of pool.values()) k.n = 0;
    anims = []; doors = []; holes = [];
    const near = (bridge.houses || []).filter(H => H.x1 > cx - R && H.x0 < cx + R && H.y1 > cy - R && H.y0 < cy + R);
    let nw = 0, nd = 0;
    for (const H of near) {
      if (H.inside || !handled(H)) continue;
      const S = H.style || {}, trim = col(S.trim || '#f1ece0'), shut = S.shutters ? col(S.shutters) : null, curt = S.curtains ? col(S.curtain || '#cdb993') : null;
      const addWin = (s, v, u0, u1, z0, anim) => {
        const K = winKinds(v), dx = s.x2 - s.x1, dy = s.y2 - s.y1, uc = (u0 + u1) / 2, px = s.x1 + dx * uc, py = s.y1 + dy * uc;
        // eixo x local = (ny, -nx): o z local fica apontando p/ fora da parede
        frame(px, z0, py, s.ny, -s.nx);
        put(K.frame, M4, trim); const hi = put(K.hole, M4, holeColor(H, night)); if (curt) put(K.curt, M4, curt); if (shut) put(K.shut, M4, shut); if (S.bars) put(K.bars, M4);
        if (hi >= 0) holes.push({ k: K.hole, i: hi, H });
        const base = M4.clone(), i = put(K.sash, M4, trim);
        if (i >= 0) anims.push({ k: K.sash, i, base, rise: K.rise, anim, last: -1 });
        nw++;
      };
      for (const s of H.segs || []) {
        if (!s.ext) continue;
        if (s.window) {
          const big = H.brick && s.side === H.frontSide;
          big ? addWin(s, 'b', 0.06, 0.94, 0.55, s.windowAnim) : addWin(s, 'n', 0.15, 0.85, 0.95, s.windowAnim);
        }
        if (H.storeys === 2 && s.idx % 3 !== 0) {
          let a = upperAnim.get(s); if (!a) upperAnim.set(s, a = { own: true, open: 0, target: 0, timer: 4 + hash(H.seed | 0, s.idx, 7) * 30, rand: (q => () => (q = (q * 16807) % 2147483647) / 2147483647)(((H.seed | 0) * 31 + s.idx * 7 + 1) % 2147483647 || 1) });
          addWin(s, 'u', 0.17, 0.83, (H.floorHeight || 3) + 0.95, a);
        }
        if (s.door) {
          const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1, dx = (s.x2 - s.x1) / len, dy = (s.y2 - s.y1) / len, mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
          frame(mx, 0, my, s.ny, -s.nx); put(doorCase, M4, trim); put(doorSill, M4);
          const K = doorKinds((S.door || [])[0]), dc = col((S.door || [])[1] || '#765038');
          const hx = s.x1 + dx * 0.1 - s.nx * 0.08, hy = s.y1 + dy * 0.1 - s.ny * 0.08;
          const i = put(K.leaf, M4, dc); put(K.hw, M4);
          if (i >= 0) doors.push({ K, i, s, hx, hy, dx, dy, last: -1 });
          nd++;
        }
      }
    }
    // cercas de madeira (as de tela continuam no 2D); pilares sem duplicar nas emendas
    let nf = 0; const posts = new Set(), R2 = R * R;
    for (const s of bridge.world.segs || []) {
      if (s.kind !== 'fence' || s.chain) continue;
      const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2; if ((mx - cx) ** 2 + (my - cy) ** 2 > R2) continue;
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy); if (len < 0.05) continue;
      const v = 0.86 + 0.22 * hash(s.woodSeed | 0, 1), base = s.rural ? [0.6, 0.45, 0.3] : [0.71, 0.61, 0.47];
      tmpC.setRGB(base[0] * v, base[1] * v, base[2] * v);
      frame(s.x1, 0, s.y1, dx, dy, len, (s.h || 1.28) / (s.rural ? 1.12 : 1.28), 1); put(s.rural ? fenceRural : fenceYard, M4, tmpC);
      for (const [px, py] of [[s.x1, s.y1], [s.x2, s.y2]]) {
        const key = Math.round(px * 20) + ',' + Math.round(py * 20); if (posts.has(key)) continue; posts.add(key);
        frame(px, 0, py, dx, dy, 1, (s.h || 1.2) / (s.rural ? 1.12 : 1.28), 1); put(s.rural ? postRural : postYard, M4, tmpC);
      }
      nf++;
    }
    // caixas: toldos, varandas, deque, pilares, colunas, pórticos, portões, degraus e sebes
    const hedges = []; let nx = 0;
    for (const b of bridge.boxes || []) {
      const k = b.kind; if (!FIX.has(k)) continue;
      if ((b.x - cx) ** 2 + (b.y - cy) ** 2 > R2 || !(bridge.props3d && bridge.props3d(b))) continue;
      const H = b.house, hc = H ? [(H.x0 + H.x1) / 2, (H.y0 + H.y1) / 2] : null, z = b.z || 0;
      if (H && H.inside && (k === 'canopy' || k === 'porchroof')) continue;   // por dentro da casa o toldo só atrapalha a vista
      if (k === 'hedge') { hedges.push(b); continue; }
      if (k === 'post') { frame(b.x, z, b.y, 1, 0, Math.min(1.4, b.w / 0.14), (b.h || 2.42) / 2.42, Math.min(1.4, b.d / 0.14)); put(porchPost, M4, col(b.side || '#ece6da')); nx++; continue; }
      if (k === 'column') { frame(b.x, z, b.y, 1, 0, b.w / 0.44, (b.h || 3.4) / 3.4, b.d / 0.44); put(columnKind, M4, col(b.side || '#f4f2ec')); nx++; continue; }
      if (k === 'gatepost') { frame(b.x, z, b.y, 1, 0, b.w / 0.6, (b.h || 2) / 2.02, b.d / 0.6); put(gatepostKind, M4, col(b.top || '#f1ede4')); nx++; continue; }
      if (k === 'portico') { const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0); frame(b.x, z, b.y, c, s, b.w, (b.h || 0.4) / 0.4, b.d); put(porticoKind, M4, col(b.side || '#fbfaf6')); nx++; continue; }
      // peças com frente: acha o centro da casa (as de degrau não guardam a casa)
      let ref = hc;
      if (!ref) { let bd = 400; for (const Hh of near) { const qx = (Hh.x0 + Hh.x1) / 2, qy = (Hh.y0 + Hh.y1) / 2, d = (qx - b.x) ** 2 + (qy - b.y) ** 2; if (d < bd) { bd = d; ref = [qx, qy]; } } }
      if (!ref) ref = [b.x, b.y - 1];
      const [ax, ay] = outward(b, ref[0], ref[1]);
      if (k === 'canopy') { frame(b.x, z, b.y, ax, ay, b.w / 1.7, 1, b.d / 0.9); put(awningKind((hash((H && H.seed) | 0, 3) * AWN.length) | 0), M4); }
      else if (k === 'porchroof') { frame(b.x, z, b.y, ax, ay, b.w / 3.8, 1, b.d / 2.0); put(porchRoofKind(b), M4); }
      else if (k === 'deck') { frame(b.x, z, b.y, ax, ay, b.w / 3.6, (b.h || 0.07) / 0.075, b.d / 1.9); put(deckKind(b.top), M4); }
      else if (k === 'step') { frame(b.x, z, b.y, ax, ay, b.w / 1.4, (b.h || 0.14) / 0.14, b.d / 0.6); put(stepKind, M4); }
      nx++;
    }
    const sig = hedges.length + ':' + (hedges[0] ? hedges[0].x.toFixed(1) : '') + ':' + (hedges.length ? hedges[hedges.length - 1].y.toFixed(1) : '');
    if (sig !== sync.hedgeSig) { sync.hedgeSig = sig; buildHedges(hedges); }
    for (const k of pool.values()) for (const m of k.meshes) { m.count = k.n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    Object.assign(state, { windows: nw, doors: nd, fences: nf, hedges: hedges.length, fixtures: nx, ms: +(performance.now() - t0).toFixed(1) });
  }
  const FIX = new Set(['canopy', 'porchroof', 'deck', 'post', 'column', 'portico', 'gatepost', 'step', 'hedge']);

  // folha de baixo das janelas e folhas das portas: só reescreve a matriz de quem mexeu
  const T4 = new THREE.Matrix4();
  function animate(dt, night) {
    const touched = new Set();
    for (const a of anims) {
      const w = a.anim; if (!w) continue;
      if (w.own) stepUpper(w, dt, night);
      if (Math.abs(w.open - a.last) < 0.002) continue;
      a.last = w.open; T4.makeTranslation(0, w.open * a.rise, 0); M4.multiplyMatrices(a.base, T4);
      for (const m of a.k.meshes) m.setMatrixAt(a.i, M4); touched.add(a.k);
    }
    for (const d of doors) {
      const o = d.s.doorAnim ? d.s.doorAnim.open : 0; if (Math.abs(o - d.last) < 0.002) continue; d.last = o;
      const a = 1.3 * o, vx = d.dx * Math.cos(a) - d.s.nx * Math.sin(a), vy = d.dy * Math.cos(a) - d.s.ny * Math.sin(a);
      frame(d.hx, 0, d.hy, vx, vy); for (const m of d.K.leaf.meshes) m.setMatrixAt(d.i, M4); for (const m of d.K.hw.meshes) m.setMatrixAt(d.i, M4);
      touched.add(d.K.leaf); touched.add(d.K.hw);
    }
    for (const k of touched) for (const m of k.meshes) m.instanceMatrix.needsUpdate = true;
  }
  // janelas do andar de cima não têm animação no jogo: mesma regra das de baixo (abrem de dia, fecham à noite)
  function stepUpper(w, dt, night) {
    w.timer -= dt;
    if (w.timer <= 0) { w.timer = 18 + w.rand() * 35; w.target = night ? 0 : (w.rand() < 0.36 ? 0.35 + w.rand() * 0.65 : 0); }
    if (night) w.target = 0;
    w.open += (w.target - w.open) * (1 - Math.exp(-dt * 1.65)); if (Math.abs(w.target - w.open) < 0.004) w.open = w.target;
  }

  let lastT = performance.now() / 1000, lightTick = 0;
  return {
    state,
    update(now) {
      const c = bridge.cam, w = bridge.world, night = !!w.night, dt = Math.min(0.1, Math.max(0, now - lastT)); lastT = now;
      const halfW = c.W / (2 * c.zoom), halfH = c.H / (2 * c.zoom) / (c.tilt || 0.5), R = Math.min(140, Math.hypot(halfW, halfH) + 24);
      const inside = (bridge.houses || []).filter(H => H.inside).map(H => H.seed | 0).join(',');
      const n = (bridge.boxes || []).length, nh = (bridge.houses || []).length;
      if (Math.hypot(c.x - sync.x, c.y - sync.y) > 16 || n !== sync.n || nh !== sync.nh || w.version !== sync.v || inside !== sync.inside || night !== sync.night) {
        Object.assign(sync, { x: c.x, y: c.y, n, nh, v: w.version, inside, night }); rebuild(c.x, c.y, R, night);
      }
      // luzes das casas acendem/apagam ao longo da noite
      if ((lightTick += dt) > 1) { lightTick = 0; let ch = false; for (const h of holes) { h.k.meshes[0].getColorAt(h.i, tmpC); const r = tmpC.r; holeColor(h.H, night); if (Math.abs(tmpC.r - r) > 0.01) { h.k.meshes[0].setColorAt(h.i, tmpC); ch = true; } } if (ch) for (const h of holes) h.k.meshes[0].instanceColor.needsUpdate = true; }
      animate(dt, night);
    },
  };
}
