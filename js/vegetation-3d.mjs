// vegetation-3d.mjs — árvores, palmeiras e arbustos em 3D de verdade (estilo The Sims 4) na camada WebGL dos carros.
// Copa = centenas de "cartões" de folhas com textura pintada no canvas e normais esferizadas (a copa acende como um
// volume macio, cheio de qualquer ângulo); tronco e galhos = tubos afunilados; palmeira = folhas arqueadas em fita.
// Cada espécie é gerada uma vez e desenhada com InstancedMesh em todas as árvores perto da câmera (world.props).
// A copa balança com o vento (shader), faz sombra real no chão e fica vazada (pontilhado) quando o jogador está atrás,
// como no Project Zomboid. Coordenadas: x do mundo = x do Three, y do mundo = z do Three, altura = y do Three.
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hash2 = (x, y, k = 0) => { let h = Math.imul((x * 73856093) ^ (y * 19349663) ^ (k * 83492791), 0x45d9f3b); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

export function createVegetation(THREE, scene, bridge) {
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // ======================= texturas pintadas no canvas =======================
  const canvasTex = (w, h, paint, repeat) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  // folha pontuda (forma de lágrima) centrada em (0,0), apontando p/ +x
  const leafPath = (g, len, wid) => { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.45, -wid, len, 0); g.quadraticCurveTo(len * 0.45, wid, 0, 0); };
  // atlas 2×2 de cachos de folhas; cada célula é um cacho com outra distribuição
  const atlas = (draw, seed) => canvasTex(512, 512, (g) => {
    const r = mulberry(seed);
    for (let k = 0; k < 4; k++) { g.save(); g.translate((k % 2) * 256 + 128, ((k / 2) | 0) * 256 + 128); draw(g, r); g.restore(); }
  });
  const grey = v => `rgb(${v | 0},${v | 0},${v | 0})`;
  const TEX = {
    // folhas largas (carvalho, mogno, arbustos): ~80 folhas irradiando do centro, as escuras atrás
    broad: atlas((g, r) => {
      const L = [];
      for (let i = 0; i < 84; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 96; L.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, a: a + (r() - 0.5) * 1.4, len: 24 + r() * 18, wid: 9 + r() * 6, v: 130 + r() * 125 }); }
      L.sort((p, q) => p.v - q.v);
      for (const l of L) { g.save(); g.translate(l.x, l.y); g.rotate(l.a); leafPath(g, l.len, l.wid); g.fillStyle = grey(l.v); g.fill(); g.strokeStyle = grey(l.v * 0.62); g.lineWidth = 1.4; g.stroke(); g.beginPath(); g.moveTo(1, 0); g.lineTo(l.len * 0.85, 0); g.strokeStyle = grey(l.v * 0.78); g.lineWidth = 1; g.stroke(); g.restore(); }
    }, 11),
    // folhagem fina e plumosa (flamboyant): raminhos com folíolos pequenos
    fine: atlas((g, r) => {
      for (let i = 0; i < 26; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * 70, x = Math.cos(a) * d, y = Math.sin(a) * d, dir = a + (r() - 0.5), len = 40 + r() * 30, v = 140 + r() * 115;
        g.strokeStyle = grey(v * 0.6); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(dir) * len, y + Math.sin(dir) * len); g.stroke();
        for (let s = 4; s < len; s += 3.2) for (const sd of [-1, 1]) {
          const px = x + Math.cos(dir) * s, py = y + Math.sin(dir) * s; g.save(); g.translate(px, py); g.rotate(dir + sd * 1.2); leafPath(g, 9 - s / len * 4, 2.6); g.fillStyle = grey(v * (0.85 + r() * 0.3)); g.fill(); g.restore();
        }
      }
    }, 12),
    // folhas redondas grandes (uva-da-praia)
    round: atlas((g, r) => {
      for (let i = 0; i < 26; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 84, x = Math.cos(a) * d, y = Math.sin(a) * d, s = 18 + r() * 14, v = 140 + r() * 115; g.beginPath(); g.ellipse(x, y, s, s * 0.9, r() * 3, 0, TAU); g.fillStyle = grey(v); g.fill(); g.strokeStyle = grey(v * 0.6); g.lineWidth = 1.5; g.stroke(); g.strokeStyle = grey(v * 0.75); g.lineWidth = 1; for (let k = 0; k < 4; k++) { const b = k / 4 * TAU + 0.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(b) * s * 0.85, y + Math.sin(b) * s * 0.85); g.stroke(); } }
    }, 13),
    // tufo de agulhas (pinheiro)
    needle: atlas((g, r) => {
      for (let t = 0; t < 7; t++) { const cx = (r() - 0.5) * 120, cy = (r() - 0.5) * 120; for (let i = 0; i < 46; i++) { const a = r() * TAU, len = 30 + r() * 46, v = 120 + r() * 135; g.strokeStyle = grey(v); g.lineWidth = 1.2 + r() * 1.3; g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(a + 0.2) * len * 0.5, cy + Math.sin(a + 0.2) * len * 0.5, cx + Math.cos(a) * len, cy + Math.sin(a) * len); g.stroke(); } }
    }, 14),
    // cróton: folhas compridas variegadas (TEXTURA COLORIDA)
    croton: atlas((g, r) => {
      const P = [['#d9b02c', '#7a5a12'], ['#c8462c', '#5e1d12'], ['#4f7e2e', '#22401a'], ['#e07a28', '#6a3410'], ['#9a2f3a', '#40121a']];
      for (let i = 0; i < 34; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 80, x = Math.cos(a) * d, y = Math.sin(a) * d, p = P[(r() * P.length) | 0]; g.save(); g.translate(x, y); g.rotate(a + (r() - 0.5)); leafPath(g, 50 + r() * 26, 13); g.fillStyle = p[0]; g.fill(); g.strokeStyle = p[1]; g.lineWidth = 1.6; g.stroke(); g.beginPath(); g.moveTo(2, 0); g.lineTo(60, 0); g.strokeStyle = '#e8d870'; g.lineWidth = 1.4; g.stroke(); g.restore(); }
    }, 15),
    // flores (TEXTURAS COLORIDAS, sobre fundo transparente)
    hibiscus: atlas((g, r) => {
      for (let i = 0; i < 5; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 70, x = Math.cos(a) * d, y = Math.sin(a) * d, s = 22 + r() * 8, col = r() < 0.75 ? ['#d8232f', '#8a1018'] : ['#ee7a2a', '#9a4010'];
        for (let k = 0; k < 5; k++) { const b = k / 5 * TAU + a; g.save(); g.translate(x, y); g.rotate(b); g.beginPath(); g.ellipse(s * 0.5, 0, s * 0.55, s * 0.42, 0, 0, TAU); g.fillStyle = col[0]; g.fill(); g.strokeStyle = col[1]; g.lineWidth = 1.5; g.stroke(); g.restore(); }
        g.fillStyle = '#f2d84a'; g.beginPath(); g.arc(x, y, 3.5, 0, TAU); g.fill(); }
    }, 16),
    bract: atlas((g, r) => {
      for (let i = 0; i < 70; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 96, x = Math.cos(a) * d, y = Math.sin(a) * d, col = r() < 0.8 ? '#d42a8a' : '#f05aa8';
        for (let k = 0; k < 3; k++) { const b = k / 3 * TAU + a; g.save(); g.translate(x, y); g.rotate(b); leafPath(g, 11, 6); g.fillStyle = col; g.fill(); g.restore(); } }
    }, 17),
    poinciana: atlas((g, r) => {
      for (let i = 0; i < 18; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 84, cx = Math.cos(a) * d, cy = Math.sin(a) * d;
        for (let k = 0; k < 9; k++) { const x = cx + (r() - 0.5) * 26, y = cy + (r() - 0.5) * 26; for (let p = 0; p < 5; p++) { const b = p / 5 * TAU; g.save(); g.translate(x, y); g.rotate(b); leafPath(g, 7, 4); g.fillStyle = r() < 0.7 ? '#e8401e' : '#f6862a'; g.fill(); g.restore(); } } }
    }, 18),
    // folha de palmeira: raque no meio (v = 0,5) indo da base (u = 0) à ponta (u = 1), folíolos inclinados p/ a ponta
    frond: canvasTex(512, 128, (g, w, h) => {
      const r = mulberry(19);
      for (let x = 10; x < w - 6; x += 4.6) {
        const t = x / w, L = 60 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + t * 1.02)), 0.5) * (1 - t * 0.2);
        for (const sd of [-1, 1]) { const v = 150 + r() * 105, ex = x + L * 0.5, ey = h / 2 + sd * L * 0.86; g.strokeStyle = grey(v); g.lineWidth = 6 - t * 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, h / 2); g.quadraticCurveTo(x + L * 0.12, h / 2 + sd * L * 0.5, ex, ey); g.stroke(); }
      }
      g.strokeStyle = grey(170); g.lineWidth = 4; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    }),
    // capim: lâminas finas saindo da base (u = largura, v = altura; base embaixo)
    grass: canvasTex(256, 256, (g, w, h) => { const r = mulberry(31); for (let i = 0; i < 70; i++) { const x = 20 + r() * (w - 40), hh = h * (0.35 + r() * 0.62), lean = (r() - 0.5) * 70, v = 120 + r() * 135; g.strokeStyle = grey(v); g.lineWidth = 2 + r() * 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + lean * 0.2, h - hh * 0.5, x + lean, h - hh); g.stroke(); } }),
    // flor silvestre: caules verdes e flores de 5 pétalas brancas (o jogo tinge só as pétalas: vertex color por parte)
    stems: canvasTex(256, 256, (g, w, h) => { const r = mulberry(32); for (let i = 0; i < 9; i++) { const x = 40 + r() * (w - 80), hh = h * (0.45 + r() * 0.45), lean = (r() - 0.5) * 40; g.strokeStyle = '#4f7a34'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x, h - hh * 0.5, x + lean, h - hh); g.stroke(); for (const sd of [-1, 1]) { g.save(); g.translate(x + lean * 0.3, h - hh * 0.35); g.rotate(sd * 0.9 - Math.PI / 2); leafPath(g, 26, 7); g.fillStyle = '#5e8a3c'; g.fill(); g.restore(); } } }),
    petals: canvasTex(128, 128, (g, w, h) => { g.translate(w / 2, h / 2); for (let k = 0; k < 5; k++) { g.save(); g.rotate(k / 5 * TAU); g.beginPath(); g.ellipse(0, -26, 17, 26, 0, 0, TAU); g.fillStyle = '#f4f2ea'; g.fill(); g.strokeStyle = '#b8b2a4'; g.lineWidth = 2; g.stroke(); g.restore(); } g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fillStyle = '#e8b830'; g.fill(); }),
    // cascas (repetem)
    barkOak: canvasTex(128, 256, (g, w, h) => { const r = mulberry(21); g.fillStyle = '#6a5848'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { const x = r() * w; g.strokeStyle = `rgba(${r() < 0.5 ? '30,24,18' : '150,132,110'},${0.25 + r() * 0.35})`; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += 16) g.lineTo(x + (r() - 0.5) * 6, y); g.stroke(); } }, true),
    barkPalm: canvasTex(128, 256, (g, w, h) => { const r = mulberry(22); g.fillStyle = '#9c8c70'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 13 + r() * 6) { g.fillStyle = `rgba(60,46,32,${0.35 + r() * 0.25})`; g.fillRect(0, y, w, 3 + r() * 2); g.fillStyle = 'rgba(210,196,166,0.35)'; g.fillRect(0, y + 4, w, 2); } for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(70,80,50,${0.12 + r() * 0.15})`; g.fillRect(r() * w, r() * h, 4 + r() * 8, 3 + r() * 6); } }, true),
    barkRoyal: canvasTex(128, 256, (g, w, h) => { const r = mulberry(23); g.fillStyle = '#cfcabf'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 26 + r() * 10) { g.fillStyle = 'rgba(110,104,94,0.28)'; g.fillRect(0, y, w, 2); } for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '120,114,104' : '235,232,224'},0.18)`; g.fillRect(r() * w, r() * h, 2 + r() * 10, 2 + r() * 4); } }, true),
    barkPine: canvasTex(128, 256, (g, w, h) => { const r = mulberry(24); g.fillStyle = '#5e3c2a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h, pw = 14 + r() * 22, ph = 20 + r() * 34; g.fillStyle = `rgba(${120 + r() * 30},${76 + r() * 22},${50 + r() * 16},0.5)`; g.fillRect(x, y, pw, ph); g.strokeStyle = 'rgba(40,22,12,0.7)'; g.lineWidth = 1.5; g.strokeRect(x, y, pw, ph); } }, true),
    barkRed: canvasTex(128, 256, (g, w, h) => { const r = mulberry(25); g.fillStyle = '#5e3a2c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '30,16,10' : '130,86,64'},${0.3 + r() * 0.3})`; g.fillRect(r() * w, r() * h, 6 + r() * 10, 3 + r() * 5); } }, true),
  };

  // ======================= materiais (vento + vazado + normais macias) =======================
  const time = { value: 0 }, windStr = { value: 1 }, seeP = { value: new THREE.Vector3(-1e4, -1e4, 0) }, seeR = { value: 0 };
  // vento: desloca proporcional à altura acima de windBase, em fase pela posição da árvore; folhas ainda tremem
  const windVert = `
    vec4 vegW = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float vegPh = vegW.x * 0.37 + vegW.z * 0.23;
    float vegH = clamp((position.y - vegBase) / vegSpan, 0.0, 1.0);
    vegH = vegH * vegH;
    transformed.x += sin(vegTime * 1.25 + vegPh) * vegAmp * vegWind * vegH;
    transformed.z += cos(vegTime * 0.97 + vegPh * 1.4) * vegAmp * 0.7 * vegWind * vegH;
    transformed += normal * sin(vegTime * 5.3 + position.x * 2.1 + position.z * 1.7 + vegPh) * vegFlutter * vegH;`;
  const decl = 'uniform float vegTime; uniform float vegWind; uniform float vegAmp; uniform float vegBase; uniform float vegSpan; uniform float vegFlutter;\n';
  const vegUniforms = (shader, w) => Object.assign(shader.uniforms, { vegTime: time, vegWind: windStr, vegAmp: { value: w.amp }, vegBase: { value: w.base }, vegSpan: { value: w.span }, vegFlutter: { value: w.flutter }, vegSeeP: seeP, vegSeeR: seeR });
  // pixel na frente do jogador e dentro do círculo: pontilhado (fica ~25% no miolo, some a borda suavemente)
  const seeThrough = `
    { vec2 vegD = gl_FragCoord.xy - vegSeeP.xy; float vegQ = length(vegD) / max( vegSeeR, 1.0 );
      if ( vegQ < 1.0 && gl_FragCoord.z < vegSeeP.z ) { float keep = mix( 0.22, 1.0, smoothstep( 0.55, 1.0, vegQ ) ); float n = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ); if ( n > keep ) discard; } }`;
  const makeMat = (map, wind, opts = {}) => {
    const m = new THREE.MeshLambertMaterial({ map, color: 0xffffff, vertexColors: true, side: opts.leaf ? THREE.DoubleSide : THREE.FrontSide, alphaTest: opts.leaf ? 0.42 : 0 });
    m.onBeforeCompile = shader => {
      vegUniforms(shader, wind);
      shader.vertexShader = decl + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + windVert);
      shader.fragmentShader = 'uniform vec3 vegSeeP; uniform float vegSeeR;\n' + shader.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>' + seeThrough);
      // normais esferizadas valem dos dois lados do cartão (sem o "lado escuro" do DoubleSide)
      if (opts.leaf) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize( vNormal );');
    };
    m.customProgramCacheKey = () => opts.leaf ? 'veg-leaf2' : 'veg-solid2';
    return m;
  };
  const makeDepth = (map, wind, leaf) => {
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leaf ? map : null, alphaTest: leaf ? 0.42 : 0, side: leaf ? THREE.DoubleSide : THREE.FrontSide });
    m.onBeforeCompile = shader => { vegUniforms(shader, wind); shader.vertexShader = decl + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + windVert); };
    m.customProgramCacheKey = () => leaf ? 'veg-depth-leaf' : 'veg-depth-solid';
    return m;
  };

  // ======================= geometria =======================
  const col = (hex) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
  // tubo afunilado ao longo de uma curva (tronco, galho, raque)
  function tube(pts, rf, radial = 8, vScale = 1) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => V3(...p))), len = curve.getLength(), n = Math.max(3, Math.ceil(len / 0.3));
    const fr = curve.computeFrenetFrames(n, false), pos = [], nor = [], uv = [], idx = [], cl = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, P = curve.getPointAt(t), N = fr.normals[i], B = fr.binormals[i], r = rf(t);
      for (let j = 0; j <= radial; j++) {
        const a = j / radial * TAU, c = Math.cos(a), s = Math.sin(a), nx = c * N.x + s * B.x, ny = c * N.y + s * B.y, nz = c * N.z + s * B.z;
        pos.push(P.x + nx * r, P.y + ny * r, P.z + nz * r); nor.push(nx, ny, nz); uv.push(j / radial, t * len * vScale / 2); cl.push(1, 1, 1);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    return build(pos, nor, uv, cl, idx);
  }
  function build(pos, nor, uv, cl, idx) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx);
    return g;
  }
  // esfera (coco, núcleo da copa)
  const ball = (x, y, z, r, c) => { const g = new THREE.IcosahedronGeometry(r, 1).toNonIndexed(); g.translate(x, y, z); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2)); return g; };

  // cartões de folhas: cada um é um quadrado orientado ao acaso com uma célula do atlas; normal = mistura da direção
  // a partir do centro da copa e do centro do cacho (volume macio); cor = tom escuro no miolo, claro na casca e no topo
  function cards(clusters, crown, look) {
    const pos = [], nor = [], uv = [], cl = [], idx = [], r = look.rnd, dark = col(look.dark), light = col(look.light), warm = col(look.warm || look.light);
    const tmp = new THREE.Color();
    for (const cu of clusters) for (let k = 0; k < cu.n; k++) {
      // ponto no cacho, mais denso perto da casca
      let d = V3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); if (d.lengthSq() > 1) d.normalize(); d.multiplyScalar(0.35 + 0.65 * Math.cbrt(r()));
      const p = V3(cu.c[0] + d.x * cu.R, cu.c[1] + d.y * cu.R * (cu.flat || 1), cu.c[2] + d.z * cu.R);
      const n = V3(r() * 2 - 1, (r() * 2 - 1) * 0.8 + (look.up || 0), r() * 2 - 1).normalize();
      const t = Math.abs(n.y) < 0.9 ? V3(0, 1, 0).cross(n).normalize() : V3(1, 0, 0).cross(n).normalize(), b = n.clone().cross(t);
      const s = cu.size * (0.75 + r() * 0.5) / 2, cell = (r() * 4) | 0, u0 = (cell % 2) * 0.5, v0 = ((cell / 2) | 0) * 0.5, base = pos.length / 3;
      for (const [su, sv, uu, vv] of [[-1, -1, 0, 0], [1, -1, 0.5, 0], [1, 1, 0.5, 0.5], [-1, 1, 0, 0.5]]) {
        const q = p.clone().addScaledVector(t, su * s).addScaledVector(b, sv * s);
        const dc = V3((q.x - crown.c[0]) / crown.r[0], (q.y - crown.c[1]) / crown.r[1], (q.z - crown.c[2]) / crown.r[2]);
        const dk = V3((q.x - cu.c[0]) / cu.R, (q.y - cu.c[1]) / cu.R, (q.z - cu.c[2]) / cu.R);
        const nn = dc.clone().multiplyScalar(0.75).addScaledVector(dk, 0.45).addScaledVector(n, 0.12).normalize();
        pos.push(q.x, q.y, q.z); nor.push(nn.x, nn.y, nn.z); uv.push(u0 + uu, v0 + vv);
        // luz embutida: miolo escuro (oclusão), casca clara; topo puxa p/ o dourado do fim de tarde
        const shell = Math.min(1, dc.length()), top = Math.min(1, Math.max(0, (q.y - (crown.c[1] - crown.r[1])) / (2 * crown.r[1])));
        const k2 = Math.pow(Math.max(0, (shell - 0.25) / 0.75), 0.8);
        tmp.copy(dark).lerp(light, k2 * (0.55 + 0.45 * top)).lerp(warm, Math.max(0, top - 0.55) * 0.6 * k2);
        const jit = 0.9 + r() * 0.2; cl.push(tmp.r * jit, tmp.g * jit, tmp.b * jit);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return build(pos, nor, uv, cl, idx);
  }
  // pontos espalhados num elipsoide (preferindo a metade de cima e a casca) p/ centros de cachos
  const shellPoints = (r, n, c, rad, minY = -0.35) => { const out = []; for (let i = 0; i < n * 4 && out.length < n; i++) { const d = V3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); if (d.lengthSq() > 1 || d.y < minY) continue; d.normalize().multiplyScalar(0.55 + 0.45 * Math.sqrt(r())); out.push([c[0] + d.x * rad[0], c[1] + d.y * rad[1], c[2] + d.z * rad[2]]); } return out; };

  // ---------- árvore folhosa genérica: tronco que se abre em galhos até os cachos ----------
  function broadleaf(seed, o) {
    const r = mulberry(seed), crown = { c: o.crownC, r: o.crownR };
    const top = [(r() - 0.5) * 0.4, o.trunkH, (r() - 0.5) * 0.4];
    const parts = [tube([[0, 0, 0], [top[0] * 0.3, o.trunkH * 0.5, top[2] * 0.3], top], t => o.trunkR * (1 + 0.45 * Math.pow(1 - t, 6)) * (1 - 0.25 * t), 9, 1.2)];
    const centers = o.clusters || shellPoints(r, o.nClusters, o.crownC, o.crownR, o.minY ?? -0.35);
    // galhos: do topo do tronco até os cachos mais baixos/externos (no máximo nLimbs)
    const limbs = centers.slice().sort((a, b) => a[1] - b[1]).slice(0, o.nLimbs);
    for (const L of limbs) {
      const mid = [top[0] + (L[0] - top[0]) * 0.45, top[1] + (L[1] - top[1]) * 0.25 + 0.4, top[2] + (L[2] - top[2]) * 0.45];
      parts.push(tube([[top[0], top[1] - 0.4, top[2]], mid, [L[0] * 0.92, L[1] - 0.2, L[2] * 0.92]], t => o.trunkR * 0.55 * (1 - 0.7 * t) + 0.03, 6, 1.2));
    }
    const clusters = centers.map(c => ({ c, R: o.clusterR * (0.8 + r() * 0.4), n: o.cards, size: o.cardSize, flat: o.flat }));
    const out = [{ geo: mergeGeometries(parts), tex: o.bark, wind: { amp: 0.05, base: o.trunkH * 0.6, span: o.crownC[1] + o.crownR[1], flutter: 0 } }];
    out.push({ geo: cards(clusters, crown, { rnd: r, dark: o.dark, light: o.light, warm: o.warm, up: o.up }), tex: o.leaf, leaf: true, wind: { amp: 0.16, base: o.trunkH * 0.6, span: o.crownC[1] + o.crownR[1], flutter: 0.03 } });
    if (o.flowers) {   // flores por cima da copa (textura colorida, vertex color só como luz)
      const fc = shellPoints(r, o.flowers.n, o.crownC, o.crownR.map(v => v * 1.02), 0.15).map(c => ({ c, R: o.clusterR * 0.7, n: o.flowers.cards, size: o.cardSize * 0.9, flat: o.flat }));
      out.push({ geo: cards(fc, crown, { rnd: r, dark: '#6e6e6e', light: '#ffffff', up: 0.4 }), tex: o.flowers.tex, leaf: true, wind: out[1].wind });
    }
    return out;
  }

  // ---------- palmeira: tronco curvo + folhas em fita arqueadas e caídas ----------
  function palm(seed, o) {
    const r = mulberry(seed), H = o.trunkH, lean = o.lean * (r() < 0.5 ? -1 : 1), la = r() * TAU;
    const P = t => [Math.cos(la) * lean * t * t, H * t, Math.sin(la) * lean * t * t];
    const pts = []; for (let i = 0; i <= 8; i++) pts.push(P(i / 8));
    const solid = [tube(pts, o.royal ? (t => o.r0 * (1 + 0.18 * Math.sin(t * Math.PI) - 0.15 * t + 0.25 * Math.pow(1 - t, 8))) : (t => o.r0 * (1.15 - 0.4 * t + 0.5 * Math.pow(1 - t, 10))), 10, 1.4)];
    const topP = P(1), tip = V3(...topP);
    const nuts = [];
    if (o.royal) solid.push(tube([topP, [topP[0], topP[1] + 1.6, topP[2]]], t => o.r0 * 0.78 * (1 - 0.15 * t), 10, 1));   // palmito
    else for (let i = 0; i < 7; i++) { const a = r() * TAU; nuts.push(ball(topP[0] + Math.cos(a) * 0.28, topP[1] - 0.15 - r() * 0.25, topP[2] + Math.sin(a) * 0.28, 0.14, col(r() < 0.6 ? '#5d7a2a' : '#8a6a2c'))); }
    const crownY = topP[1] + (o.royal ? 1.5 : 0.1);
    // folhas: cada uma é uma fita com 3 linhas de vértices (borda, raque, borda) dobrada em V p/ baixo
    const pos = [], nor = [], uv = [], cl = [], idx = [], green = col(o.green), tipC = col(o.tip), dead = col('#8a6a3c'), tmp = new THREE.Color();
    const fronds = [];
    for (let i = 0; i < o.n; i++) fronds.push({ a: i / o.n * TAU + (r() - 0.5) * 0.3, e0: o.rise + (r() - 0.5) * 0.35, droop: o.droop + r() * 0.5, L: o.len * (0.85 + r() * 0.3), dead: false });
    for (let i = 0; i < o.dead; i++) fronds.push({ a: r() * TAU, e0: -1.1, droop: 0.5, L: o.len * 0.7, dead: true });
    for (const f of fronds) {
      const S = 18, side = V3(-Math.sin(f.a), 0, Math.cos(f.a)); let p = V3(tip.x, crownY, tip.z);
      const base = pos.length / 3;
      for (let k = 0; k <= S; k++) {
        const s = k / S, th = f.e0 - f.droop * Math.pow(s, 1.6), dir = V3(Math.cos(f.a) * Math.cos(th), Math.sin(th), Math.sin(f.a) * Math.cos(th));
        const w = o.width * Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + s * 1.05)), 0.7) * (1 - 0.25 * s) * (f.dead ? 0.6 : 1);
        const down = V3(0, -1, 0).addScaledVector(dir, 0.3).normalize(), fold = f.dead ? 0.9 : 0.42;
        const up = side.clone().cross(dir).normalize(); if (up.y < 0) up.negate();
        for (const [sd, vv] of [[-1, 0], [0, 0.5], [1, 1]]) {
          const q = p.clone().addScaledVector(side, sd * w).addScaledVector(down, Math.abs(sd) * w * fold);
          const nn = up.clone().multiplyScalar(0.7).addScaledVector(q.clone().sub(tip).normalize(), 0.5).normalize();
          pos.push(q.x, q.y, q.z); nor.push(nn.x, nn.y, nn.z); uv.push(s, vv);
          tmp.copy(f.dead ? dead : green).lerp(f.dead ? dead : tipC, s * s * 0.8); const jit = 0.82 + 0.25 * (vv === 0.5 ? 1 : 0.85);
          cl.push(tmp.r * jit, tmp.g * jit, tmp.b * jit);
        }
        if (k < S) { const b0 = base + k * 3, b1 = b0 + 3; idx.push(b0, b1, b0 + 1, b1, b1 + 1, b0 + 1, b0 + 1, b1 + 1, b0 + 2, b1 + 1, b1 + 2, b0 + 2); }
        p = p.clone().addScaledVector(dir, f.L / S);
      }
    }
    const span = crownY + o.len * 0.6;
    const out = [{ geo: mergeGeometries(solid), tex: o.bark, wind: { amp: 0.08, base: H * 0.4, span, flutter: 0 } },
      { geo: build(pos, nor, uv, cl, idx), tex: 'frond', leaf: true, wind: { amp: 0.35, base: crownY - 0.5, span: o.len * 0.9, flutter: 0.04 } }];
    if (nuts.length) out.push({ geo: mergeGeometries(nuts), tex: null, wind: out[0].wind });
    return out;
  }

  // ---------- pinheiro: tronco alto, copa aberta de tufos no terço de cima ----------
  function pine(seed) {
    const r = mulberry(seed), H = 14 + r() * 2, lean = 0.4;
    const parts = [tube([[0, 0, 0], [lean * 0.2, H * 0.5, 0.1], [lean, H, 0.2]], t => 0.32 * (1 - 0.6 * t) + 0.04, 9, 1.4)];
    const clusters = [];
    for (let i = 0; i < 14; i++) {
      const y = H * (0.62 + 0.36 * (i / 14)) + (r() - 0.5), a = r() * TAU, L = (1 - (y / H - 0.6) * 1.6) * (1.6 + r() * 1.4) + 0.6;
      const end = [lean * y / H + Math.cos(a) * L, y + 0.3 + r() * 0.6, 0.2 * y / H + Math.sin(a) * L];
      parts.push(tube([[lean * y / H, y - 0.3, 0.2 * y / H], [end[0] * 0.6, y + 0.1, end[2] * 0.6], end], t => 0.07 * (1 - 0.7 * t) + 0.015, 5, 1.4));
      clusters.push({ c: end, R: 1.1 + r() * 0.5, n: 34, size: 1.6, flat: 0.6 });
    }
    clusters.push({ c: [lean, H + 0.6, 0.2], R: 1.1, n: 24, size: 1.4, flat: 0.8 });
    const crown = { c: [lean, H * 0.82, 0.2], r: [3.4, H * 0.22, 3.4] };
    const wind = { amp: 0.14, base: H * 0.5, span: H * 0.55, flutter: 0.02 };
    return [{ geo: mergeGeometries(parts), tex: 'barkPine', wind },
      { geo: cards(clusters, crown, { rnd: r, dark: '#1d3a24', light: '#5f8a4a', warm: '#8a9a50' }), tex: 'needle', leaf: true, wind }];
  }

  // ---------- arbusto: meia-esfera de cachos, com flores opcionais ----------
  function bush(seed, o) {
    const r = mulberry(seed), crown = { c: [0, o.h * 0.48, 0], r: [o.w, o.h * 0.55, o.w] };
    const centers = shellPoints(r, o.nClusters, crown.c, crown.r, -0.6).map(c => [c[0], Math.max(o.h * 0.25, c[1]), c[2]]);
    const clusters = centers.map(c => ({ c, R: o.clusterR, n: o.cards, size: o.cardSize, flat: 0.85 }));
    const wind = { amp: 0.05, base: 0, span: o.h, flutter: 0.02 };
    const out = [{ geo: cards(clusters, crown, { rnd: r, dark: o.dark, light: o.light, warm: o.warm, up: 0.2 }), tex: o.leaf, leaf: true, wind }];
    if (o.flowers) out.push({ geo: cards(shellPoints(r, o.flowers.n, crown.c, crown.r.map(v => v * 1.03), 0).map(c => ({ c, R: o.clusterR * 0.8, n: o.flowers.cards, size: o.cardSize * 0.8, flat: 0.85 })), crown, { rnd: r, dark: '#7a7a7a', light: '#ffffff', up: 0.3 }), tex: o.flowers.tex, leaf: true, wind });
    return out;
  }

  // ---------- touceira de capim: cartões cruzados em pé, lâminas da textura ----------
  function grassClump(seed, o) {
    const r = mulberry(seed), pos = [], nor = [], uv = [], cl = [], idx = [], base = col(o.base), tip = col(o.tip), tmp = new THREE.Color();
    for (let k = 0; k < o.cards; k++) {
      const a = k / o.cards * Math.PI + r() * 0.4, ox = (r() - 0.5) * 0.25, oz = (r() - 0.5) * 0.25, w = o.w * (0.8 + r() * 0.4), h = o.h * (0.75 + r() * 0.5), dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2, b = pos.length / 3;
      for (const [sx, sy] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
        pos.push(ox + sx * dx, sy * h, oz + sx * dz); nor.push(0, 1, 0); uv.push(sx < 0 ? 0 : 1, sy);
        tmp.copy(base).lerp(tip, sy); cl.push(tmp.r, tmp.g, tmp.b);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    return [{ geo: build(pos, nor, uv, cl, idx), tex: 'grass', leaf: true, wind: { amp: 0.1, base: 0, span: o.h, flutter: 0.02 } }];
  }
  // ---------- flores silvestres: caules em cartões cruzados + flores (cor por variante) ----------
  function flowerClump(seed, color) {
    const r = mulberry(seed), stems = grassClump(seed, { cards: 4, w: 0.6, h: 0.6, base: '#c8d8b8', tip: '#ffffff' })[0];
    stems.tex = 'stems';
    const pos = [], nor = [], uv = [], cl = [], idx = [], c = col(color);
    for (let k = 0; k < 9; k++) {
      const x = (r() - 0.5) * 0.45, z = (r() - 0.5) * 0.45, y = 0.32 + r() * 0.28, s = 0.09 + r() * 0.05, tilt = 0.5 + r() * 0.5, a = r() * TAU, b = pos.length / 3;
      const n = V3(Math.cos(a) * tilt, 1, Math.sin(a) * tilt).normalize(), t = V3(0, 1, 0).cross(n).normalize(), bb = n.clone().cross(t);
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = V3(x, y, z).addScaledVector(t, su * s).addScaledVector(bb, sv * s); pos.push(q.x, q.y, q.z); nor.push(n.x, n.y, n.z); uv.push((su + 1) / 2, (sv + 1) / 2); cl.push(c.r, c.g, c.b); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    return [stems, { geo: build(pos, nor, uv, cl, idx), tex: 'petals', leaf: true, wind: stems.wind }];
  }

  // ======================= espécies =======================
  const SPECIES = {
    liveoak: () => broadleaf(101, { trunkH: 2.6, trunkR: 0.5, crownC: [0, 6.2, 0], crownR: [6.4, 3.0, 6.4], nClusters: 26, nLimbs: 7, clusterR: 2.1, cards: 34, cardSize: 1.7, flat: 0.75, bark: 'barkOak', leaf: 'broad', dark: '#22401c', light: '#7da447', warm: '#a8b45a', minY: -0.2 }),
    mahogany: () => broadleaf(102, { trunkH: 3.6, trunkR: 0.3, crownC: [0, 7.2, 0], crownR: [3.3, 3.6, 3.3], nClusters: 18, nLimbs: 5, clusterR: 1.7, cards: 34, cardSize: 1.5, bark: 'barkRed', leaf: 'broad', dark: '#1d3a1a', light: '#6a9a3e', warm: '#9aae52' }),
    blackolive: () => { const r = mulberry(103), cl = []; [[3.6, 4.6], [4.9, 3.9], [6.1, 3.0], [7.1, 2.0], [7.9, 1.0]].forEach(([y, rad]) => { for (let i = 0; i < Math.max(2, Math.round(rad * 2.4)); i++) { const a = i / Math.round(rad * 2.4) * TAU + r(); cl.push([Math.cos(a) * rad * 0.75, y + (r() - 0.5) * 0.3, Math.sin(a) * rad * 0.75]); } });
      return broadleaf(103, { trunkH: 2.8, trunkR: 0.28, crownC: [0, 5.8, 0], crownR: [4.6, 2.6, 4.6], clusters: cl, nLimbs: 6, clusterR: 1.4, cards: 26, cardSize: 1.3, flat: 0.45, bark: 'barkOak', leaf: 'broad', dark: '#1f3a2c', light: '#6e9a66', warm: '#9aac6a' }); },
    yard: () => broadleaf(104, { trunkH: 2.8, trunkR: 0.26, crownC: [0, 5.4, 0], crownR: [3.2, 2.8, 3.2], nClusters: 16, nLimbs: 5, clusterR: 1.6, cards: 32, cardSize: 1.4, bark: 'barkOak', leaf: 'broad', dark: '#24451c', light: '#82aa48', warm: '#b0b65a' }),
    poinciana: () => broadleaf(105, { trunkH: 2.6, trunkR: 0.32, crownC: [0, 5.6, 0], crownR: [5.6, 1.7, 5.6], nClusters: 22, nLimbs: 7, clusterR: 1.9, cards: 26, cardSize: 1.7, flat: 0.5, minY: -0.1, bark: 'barkRoyal', leaf: 'fine', dark: '#2a4a1e', light: '#86b04a', warm: '#aabc56', flowers: { tex: 'poinciana', n: 18, cards: 14 } }),
    pine: () => pine(106),
    coconut: () => palm(107, { trunkH: 8.6, lean: 1.6, r0: 0.21, n: 20, dead: 3, len: 5.8, width: 1.05, rise: 0.7, droop: 1.65, green: '#4c7a2e', tip: '#a9a84a', bark: 'barkPalm' }),
    // Washingtonia (Los Angeles): tronco altíssimo e fino, copa pequena e redonda de leques curtos e saia de folhas secas
    washington: () => palm(109, { trunkH: 15, lean: 0.3, r0: 0.21, n: 38, dead: 30, len: 3.0, width: 1.45, rise: 1.15, droop: 0.75, green: '#5f7444', tip: '#8c9a62', bark: 'barkPalm' }),
    royal: () => palm(108, { trunkH: 11, lean: 0.25, r0: 0.3, royal: true, n: 18, dead: 1, len: 6.6, width: 1.15, rise: 0.85, droop: 1.55, green: '#3f6e2a', tip: '#8aa048', bark: 'barkRoyal' }),
    shrub: () => bush(201, { h: 1.4, w: 1.0, nClusters: 8, clusterR: 0.55, cards: 22, cardSize: 0.75, leaf: 'broad', dark: '#1e3c18', light: '#78a444', warm: '#a8b456' }),
    hibiscus: () => bush(202, { h: 1.6, w: 1.1, nClusters: 9, clusterR: 0.55, cards: 22, cardSize: 0.75, leaf: 'broad', dark: '#1a3816', light: '#5e9038', warm: '#84a648', flowers: { tex: 'hibiscus', n: 9, cards: 4 } }),
    bougainvillea: () => bush(203, { h: 2.0, w: 1.3, nClusters: 10, clusterR: 0.65, cards: 18, cardSize: 0.85, leaf: 'broad', dark: '#22401a', light: '#6a9a40', warm: '#8aac48', flowers: { tex: 'bract', n: 16, cards: 7 } }),
    croton: () => bush(204, { h: 1.2, w: 0.75, nClusters: 7, clusterR: 0.45, cards: 18, cardSize: 0.7, leaf: 'croton', dark: '#707070', light: '#ffffff', warm: '#ffffff' }),
    grass: () => grassClump(301, { cards: 5, w: 1.0, h: 0.7, base: '#4a6e30', tip: '#b4c86a' }),
    reeds: () => grassClump(302, { cards: 6, w: 1.0, h: 1.3, base: '#3e6230', tip: '#9cb862' }),
    flowerY: () => flowerClump(401, '#f2cc3a'), flowerW: () => flowerClump(402, '#f4f0e4'), flowerP: () => flowerClump(403, '#e6a0b4'),
    flowerL: () => flowerClump(404, '#b49ad8'), flowerO: () => flowerClump(405, '#ec9a5a'),
    seagrape: () => bush(205, { h: 1.8, w: 1.5, nClusters: 10, clusterR: 0.7, cards: 16, cardSize: 0.95, leaf: 'round', dark: '#3a4a1e', light: '#a2b04e', warm: '#c0b456' }),
  };

  // ======================= malhas instanciadas =======================
  const CAP = { grass: 9000, reeds: 3000, flowerY: 800, flowerW: 800, flowerP: 800, flowerL: 800, flowerO: 800, liveoak: 900, mahogany: 900, blackolive: 900, yard: 900, poinciana: 600, pine: 2500, coconut: 1500, royal: 1200, washington: 1500, shrub: 2500, hibiscus: 1200, bougainvillea: 1200, croton: 1200, seagrape: 1500 };
  const kinds = {};
  for (const [name, make] of Object.entries(SPECIES)) {
    const parts = make().map(part => {
      const map = part.tex ? TEX[part.tex] : null, cap = CAP[name];
      const mesh = new THREE.InstancedMesh(part.geo, makeMat(map, part.wind, { leaf: part.leaf }), cap);
      mesh.customDepthMaterial = makeDepth(map, part.wind, part.leaf);
      const tiny = /^(grass|reeds|flower)/.test(name);
      mesh.castShadow = !tiny; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, new THREE.Color(1, 1, 1));
      scene.add(mesh);
      return { mesh, leaf: !!part.leaf };
    });
    kinds[name] = { parts, list: [] };
  }
  // altura e raio da copa de cada espécie (p/ o vazado), medidos da própria geometria
  for (const [name, k] of Object.entries(kinds)) { const b = new THREE.Box3(); for (const p of k.parts) { p.mesh.geometry.computeBoundingBox(); b.union(p.mesh.geometry.boundingBox); } k.top = b.max.y; k.rad = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2; }

  // sombra no chão: um plano grande que acompanha a câmera e só mostra a sombra
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.3, transparent: true, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.01; ground.receiveShadow = true; scene.add(ground);

  // espécie de cada prop (sprites antigos do jogo dizem qual planta é)
  function speciesOf(p) {
    const sp = p.sp || {};
    if (p.type === 'tuft') return sp.reed ? 'reeds' : 'grass';
    if (p.type === 'flower') return p.kind;
    if (p.type === 'bush') return { hibiscus: 'hibiscus', bougainvillea: 'bougainvillea', croton: 'croton', seagrape: 'seagrape' }[sp.vegKind] || 'shrub';
    if (sp.kind === 'palm') return sp.palm === 'royal' ? 'royal' : sp.palm === 'washington' ? 'washington' : 'coconut';
    if (sp.kind === 'pine') return 'pine';
    if (sp.decoration === 'flowering') return 'poinciana';
    if (sp.kind === 'street') return 'mahogany';
    if (sp.kind === 'yard') return 'yard';
    return hash2(Math.round(p.x * 10), Math.round(p.y * 10), 3) < 0.6 ? 'liveoak' : 'blackolive';
  }

  const state = { trees: 0, bushes: 0, ms: 0 };
  const sync = { x: 1e9, y: 1e9, n: -1, v: -1, zoom: 0 }, mat = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
  let active = [];
  function rebuild(cx, cy, R) {
    const t0 = performance.now();
    for (const k of Object.values(kinds)) k.list.length = 0;
    const props = bridge.world.props || [];
    // flores e capim não nascem dentro das casas (o piso cobria isso no 2D)
    const near = (bridge.houses || []).filter(H => H.x1 > cx - R - 2 && H.x0 < cx + R + 2 && H.y1 > cy - R - 2 && H.y0 < cy + R + 2);
    // pátios asfaltados de postos e estacionamentos (parking.js)
    const pv = (bridge.world.paved || []).filter(b => b[2] > cx - R && b[0] < cx + R && b[3] > cy - R && b[1] < cy + R), paved = (x, y) => pv.some(b => x > b[0] && x < b[2] && y > b[1] && y < b[3]);
    const indoors = (x, y) => near.some(H => H.contains ? H.contains(x, y) : x > H.x0 - .2 && x < H.x1 + .2 && y > H.y0 - .2 && y < H.y1 + .2);
    for (const p of props) {
      if (p.type !== 'tree' && p.type !== 'bush' && p.type !== 'tuft') continue;
      const holes = window.cityLandmarkHoles;   // espaço aberto p/ marcos (letreiro da serra)
      if (holes && holes.some(h => p.x > h[0] && p.x < h[2] && p.y > h[1] && p.y < h[3])) continue;
      if (paved(p.x, p.y)) continue;
      const dx = p.x - cx, dy = p.y - cy; if (dx * dx + dy * dy > R * R) continue;
      if (p.type === 'tuft' && indoors(p.x, p.y)) continue;
      const k = kinds[speciesOf(p)]; if (k.list.length < k.parts[0].mesh.instanceMatrix.count) k.list.push(p);
    }
    const FL = { '#eee6ce': 'flowerW', '#ead064': 'flowerY', '#ccacd1': 'flowerL', '#db9ca9': 'flowerP', '#9eaad0': 'flowerL', '#e6a274': 'flowerO', '#ca7778': 'flowerP', '#ede0a8': 'flowerY' };
    if (bridge.terrainItems) for (const items of bridge.terrainItems.values()) for (const it of items) {
      if (it.t !== 'wildflower') continue;
      const dx = it.x - cx, dy = it.y - cy; if (dx * dx + dy * dy > R * R || indoors(it.x, it.y) || paved(it.x, it.y)) continue;
      const kind = FL[it.c] || 'flowerY', k = kinds[kind];
      for (let j = 0; j < Math.min(3, Math.ceil(it.k / 3)); j++) if (k.list.length < k.parts[0].mesh.instanceMatrix.count) { const a = it.phase + j * 2.4, d = it.radius * (j ? 0.8 : 0); k.list.push({ type: 'flower', kind, x: it.x + Math.cos(a) * d, y: it.y + Math.sin(a) * d }); }
    }
    active = [];
    let trees = 0, bushes = 0, small = 0;
    for (const [name, k] of Object.entries(kinds)) {
      k.list.forEach((p, i) => {
        const h1 = hash2(Math.round(p.x * 10), Math.round(p.y * 10), 1), h2 = hash2(Math.round(p.x * 10), Math.round(p.y * 10), 2);
        let s = (p.scale || 1) * (0.86 + 0.28 * h1);
        if (p.type === 'bush') s = Math.min(1.35, Math.max(0.7, (p.sp?.r || 0.8) / 0.8)) * (0.9 + 0.2 * h1);
        else if (p.type === 'tuft' || p.type === 'flower') s = 0.8 + 0.45 * h1;
        q.setFromAxisAngle(up, h2 * TAU); ps.set(p.x, 0, p.y); sc.set(s, s, s); mat.compose(ps, q, sc);
        tint.setRGB(0.92 + 0.16 * h1, 0.92 + 0.16 * h2, 0.92 + 0.12 * (1 - h1));
        for (const part of k.parts) { part.mesh.setMatrixAt(i, mat); part.mesh.setColorAt(i, tint); }
        active.push({ p, k, i, s });
      });
      for (const part of k.parts) { part.mesh.count = k.list.length; part.mesh.instanceMatrix.needsUpdate = true; if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true; }
      if (/^(grass|reeds|flower)/.test(name)) small += k.list.length; else if (name in { shrub: 1, hibiscus: 1, bougainvillea: 1, croton: 1, seagrape: 1 }) bushes += k.list.length; else trees += k.list.length;
    }
    Object.assign(state, { trees, bushes, small, ms: +(performance.now() - t0).toFixed(1) });
  }

  // vazado: posição na tela (px do buffer) e profundidade do alvo (jogador a pé, ou o carro) p/ o shader
  const pv = new THREE.Vector3(), buf = new THREE.Vector2();
  function updateSeeThrough(camera, renderer, target) {
    if (!target || !Number.isFinite(target.x)) { seeR.value = 0; return; }
    renderer.getDrawingBufferSize(buf);
    pv.set(target.x, target.z, target.y).project(camera);
    seeP.value.set((pv.x * 0.5 + 0.5) * buf.x, (pv.y * 0.5 + 0.5) * buf.y, pv.z * 0.5 + 0.5 - 0.0004);
    // Diameter occupies 85% of the shorter viewport dimension at every zoom/DPR.
    seeR.value = Math.min(buf.x, buf.y) * .85 / 2;
  }
  return {
    state, ground,
    // aplica o mesmo vazado em volta do jogador a outro material (toldos, sebes, cercas: house-3d.mjs)
    seeThrough(m) {
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (shader, r) => { prev && prev.call(m, shader, r); Object.assign(shader.uniforms, { vegSeeP: seeP, vegSeeR: seeR }); shader.fragmentShader = 'uniform vec3 vegSeeP; uniform float vegSeeR;\n' + shader.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>' + seeThrough); };
      m.customProgramCacheKey = () => 'see-' + m.type + (m.map ? 'm' : '') + (m.side === THREE.DoubleSide ? 'd' : '');
      return m;
    },
    update(now, camera, renderer, target) {
      const c = bridge.cam, w = bridge.world;
      // vento do clima (env.js): brisa leve, ventania com rajadas que dobram as palmeiras
      const E = globalThis.ENV;
      time.value = now; windStr.value = E ? Math.min(3.2, 0.25 + E.windNow * 2.3) : 1 + 0.35 * Math.sin(now * 0.21) + 0.2 * Math.sin(now * 0.53);
      const halfW = c.W / (2 * c.zoom), halfH = c.H / (2 * c.zoom) / (c.tilt || 0.5);
      const R = Math.min(150, Math.hypot(halfW, halfH) + 36);
      const n = (w.props || []).length;
      if (Math.hypot(c.x - sync.x, c.y - sync.y) > 14 || n !== sync.n || w.version !== sync.v || Math.abs(c.zoom - sync.zoom) / c.zoom > 0.25) {
        Object.assign(sync, { x: c.x, y: c.y, n, v: w.version, zoom: c.zoom }); rebuild(c.x, c.y, R);
      }
      updateSeeThrough(camera, renderer, target);
      const G = Math.min(160, R * 2.2); ground.scale.set(G, G, 1); ground.position.set(c.x, 0.01, c.y);
      return R;
    },
  };
}
