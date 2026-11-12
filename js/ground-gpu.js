// ground-gpu.js — chão desenhado pela placa de vídeo (Fase 3 do docs/PLANO-DE-OTIMIZACAO.md).
// Uma tela WebGL2 própria fica POR BAIXO da tela 2D (#view). A cada quadro um shader pinta o chão inteiro da vista
// na hora — água, areia, gramado/mato, terra, calçadão, concreto, asfalto, meio-fio e calçada — com as texturas do
// jogo (assets/textures) e a mesma paleta da CPU (owBaseColor em openworld.js). O detalhe pintado pela CPU
// (terrain.js: faixas, rachaduras, pisos) continua na tela 2D por cima, entrando com um fade quando fica pronto;
// onde ainda não ficou, aparece este chão — nunca mais cinza, minimapa esticado ou base borrada.
//
// Dados que o shader lê, preenchidos aos poucos pela CPU em volta da câmera (janela toroidal de 512 m, folga p/ a câmera rasante, por blocos
// de 16 m, só os que faltam — custa ~0,35 ms por bloco):
//   fino (1 m/texel, RGBA8): distância até a borda do asfalto (roadDist, normalizada: ROAD_W na borda de qualquer via),
//                            o bairro (districtFn) e, na roça, a direção das fileiras e a cultura do talhão (fieldFn)
//   grosso (2 m/texel, RGBA8): cor base (owBaseColor) e água/areia (pondVal)
'use strict';

const GroundGPU = (() => {
  const WIN = 512, TILE = 16, SLOTS = WIN / TILE, FINE = 1, COARSE = 2;
  const TEXS = { lawn: 'ground-lawn', weeds: 'ground-weeds', sand: 'ground-sand', dirt: 'ground-dirt', walk: 'ground-sidewalk', conc: 'ground-concrete-worn' };
  let gl = null, canvas = null, prog = null, uni = {}, fineTex = null, coarseTex = null, ready = false, failed = false;
  const slot = new Array(SLOTS * SLOTS).fill(null);   // bloco do mundo que ocupa cada posição da janela
  const tex = {}, avg = {}, meters = {};
  const stats = { tiles: 0, ms: 0, frames: 0 };
  const fineBuf = new Uint8Array(TILE * TILE * 4), coarseBuf = new Uint8Array((TILE / COARSE) * (TILE / COARSE) * 4);

  const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
  const FS = `#version 300 es
precision highp float;
uniform vec2 uRes, uCam, uRot; uniform float uZoom, uTilt, uRoadW, uSide, uInk;
uniform sampler2D uFine, uCoarse, uLawn, uWeeds, uSand, uDirt, uWalk, uConc;
uniform vec3 aLawn, aWeeds, aSand, aDirt, aWalk, aConc;   // cor média de cada textura (a textura só dá o detalhe)
uniform vec4 mA, mB;                                      // metros de cada textura: lawn weeds sand dirt | walk conc
uniform vec3 cAsph, cPatch, cGutter, cCurbF, cCurbT, cWalk, cDirt;
uniform ivec4 dA, dB;
uniform vec4 uCrop[6];   // culturas da roça: cor + densidade (terrain.crops)   // bairros: DOWNTOWN INDUSTRIAL PORT FAVELA | GHETTO BEACH FARM -
out vec4 o;
float h21(vec2 q){ q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }
float vnoise(vec2 q){ vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
// URBAN INK: sem o detalhe fotográfico das texturas (cor chapada)
vec3 det(sampler2D t, vec2 w, float m, vec3 a){ vec3 sampled=texture(t, w / m).rgb / max(a, vec3(0.04)); return mix(clamp(sampled,vec3(0.65),vec3(1.45)),vec3(1.0),uInk>0.0?0.22:0.0); }
// juntas das placas do piso (calçada e calçadão), como no detalhe da CPU: linha escura a cada 1,2 m
float joints(vec2 w){ vec2 g = abs(fract(w / 1.2) - 0.5) * 1.2, fw = max(fwidth(w), vec2(0.004)); vec2 l = 1.0 - smoothstep(vec2(0.0), fw * 1.5 + 0.02, 0.6 - g); return 1.0 - 0.1 * max(l.x, l.y); }
void main(){
  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float a = (sp.x - uRes.x * 0.5) / uZoom, b = (sp.y - uRes.y * 0.5) / (uZoom * uTilt);
  vec2 w = uCam + vec2(uRot.x * a + uRot.y * b, -uRot.y * a + uRot.x * b);
  vec2 uv = w / ${WIN.toFixed(1)};
  float d = texture(uFine, uv).r * 25.5;
  vec4 fi = texelFetch(uFine, ivec2(mod(floor(w), ${WIN.toFixed(1)})), 0);
  int di = int(fi.g * 255.0 + 0.5);
  vec4 cs = texture(uCoarse, uv); vec3 base = cs.rgb; float pv = cs.a * 2.55;
  vec3 col;
  if (pv < 1.0) {                                   // água: a cor base já é rasa→funda; leve ondulação
    col = base * (0.96 + 0.08 * vnoise(w * 0.7 + uRot * 3.0));
  } else if (pv < 1.26 || di == dB.y) {             // areia (molhada perto da água vem na cor base)
    col = base * det(uSand, w, mA.z, aSand);
  } else if (di == dA.x) {                          // centro: calçadão
    col = base * det(uWalk, w, mB.x, aWalk) * 0.94 * joints(w);
  } else if (di == dA.y || di == dA.z) {            // indústria e porto: concreto gasto
    col = base * det(uConc, w, mB.y, aConc);
  } else if (di == dA.w) {                          // favela: terra batida
    col = base * det(uDirt, w, mA.w, aDirt);
  } else {                                          // gramado/mato (bairro pobre puxa p/ a terra, roça mistura)
    float m = smoothstep(0.35, 0.75, vnoise(w * 0.07));
    vec3 g = mix(det(uLawn, w, mA.x, aLawn), det(uWeeds, w, mA.y, aWeeds), m);
    if (di == dB.x) g = mix(g, det(uDirt, w, mA.w, aDirt), 0.45);
    col = base * g;
    if (di == dB.z) {                               // roça: fileiras de plantio na direção do talhão, sulcos de terra entre elas
      float ang = fi.b * 3.14159265; vec4 cr = uCrop[int(fi.a * 255.0 + 0.5)];
      float n1 = vnoise(w * 1.7), t = dot(w, vec2(cos(ang), sin(ang)));
      float plant = smoothstep(0.35, 0.7, 0.5 + 0.5 * sin(t * 7.3 + (n1 - 0.5) * 0.9)) * cr.a;
      vec3 dirt = cDirt * 0.95 * det(uDirt, w, mA.w, aDirt);
      col = mix(dirt, cr.rgb, plant) * (0.88 + n1 * 0.2);
    }
  }
  // vias por cima (fora da água): calçada, meio-fio, sarjeta e asfalto, com bordas suavizadas pelo tamanho do pixel
  if (pv >= 1.0 && d < uRoadW + uSide + 1.0) {
    float aa = max(fwidth(d), 0.02);
    vec3 walk = cWalk * det(uWalk, w, mB.x, aWalk) * 0.94 * joints(w);
    float n = vnoise(w * 6.0), n2 = vnoise(w * 0.9);
    vec3 asph = mix(cAsph, cPatch, smoothstep(0.66, 0.82, n2) * 0.35) * (0.9 + 0.08 * n);
    asph = mix(cGutter, asph, smoothstep(uRoadW - 0.45, uRoadW - 0.75, d));   // sarjeta junto ao meio-fio
    vec3 curb = mix(cCurbT, cCurbF, smoothstep(uRoadW + 0.08, uRoadW + 0.16, d));
    vec3 r = mix(asph, curb, smoothstep(uRoadW - aa, uRoadW + aa, d));
    r = mix(r, walk, smoothstep(uRoadW + 0.2 - aa, uRoadW + 0.2 + aa, d));
    col = mix(r, col, smoothstep(uRoadW + uSide - aa, uRoadW + uSide + aa, d));
  }
  // URBAN INK: o mesmo traço do chão 2D (meio-fio, borda da calçada, margem da água)
  if (uInk > 0.0) {
    float aw = max(fwidth(d), 0.02), ap = max(fwidth(pv), 0.002);
    float il = max(1.0 - smoothstep(0.02, 0.02 + aw * 1.5, abs(d - uRoadW - 0.02)), d < uRoadW + uSide + 0.2 ? 1.0 - smoothstep(0.02, 0.02 + aw * 1.5, abs(d - uRoadW - uSide)) : 0.0);
    il = max(il, (1.0 - smoothstep(0.003, 0.003 + ap * 1.5, abs(pv - 1.0))) * step(pv, 1.3));
    col = mix(col, col * 0.3 + vec3(0.063, 0.07, 0.086), il * 0.55 * uInk);
  }
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; }
  function dataTexture(internal, format, size) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internal, size, size);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  }
  const rgb = c => [c[0] / 255, c[1] / 255, c[2] / 255];

  function init() {
    if (gl || failed) return !!gl;
    try {
      const view = document.getElementById('view'); if (!view) { failed = true; return false; }
      canvas = document.createElement('canvas'); canvas.id = 'ground-gpu'; canvas.setAttribute('aria-hidden', 'true');
      view.parentNode.insertBefore(canvas, view);
      gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) { canvas.remove(); failed = true; return false; }
      prog = gl.createProgram(); gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const n of ['uRes', 'uCam', 'uRot', 'uZoom', 'uTilt', 'uRoadW', 'uSide', 'uInk', 'uFine', 'uCoarse', 'uLawn', 'uWeeds', 'uSand', 'uDirt', 'uWalk', 'uConc', 'aLawn', 'aWeeds', 'aSand', 'aDirt', 'aWalk', 'aConc', 'mA', 'mB', 'cAsph', 'cPatch', 'cGutter', 'cCurbF', 'cCurbT', 'cWalk', 'cDirt', 'dA', 'dB', 'uCrop'])
        uni[n] = gl.getUniformLocation(prog, n);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      fineTex = dataTexture(gl.RGBA8, gl.RGBA, WIN / FINE);
      coarseTex = dataTexture(gl.RGBA8, gl.RGBA, WIN / COARSE);
      const D = COG.D;
      gl.uniform4i(uni.dA, D.DOWNTOWN, D.INDUSTRIAL, D.PORT, D.FAVELA); gl.uniform4i(uni.dB, D.GHETTO, D.BEACH, D.FARM, -1);
      gl.uniform3fv(uni.cAsph, rgb(COL.asph)); gl.uniform3fv(uni.cPatch, rgb(COL.patch)); gl.uniform3fv(uni.cGutter, rgb(COL.gutter));
      gl.uniform3fv(uni.cCurbF, rgb(COL.curbF)); gl.uniform3fv(uni.cCurbT, rgb(COL.curbT)); gl.uniform3fv(uni.cWalk, rgb(COL.walk)); gl.uniform3fv(uni.cDirt, rgb(COL.dirt));
      const crops = (terrain.crops || []).slice(0, 6); while (crops.length < 6) crops.push([128, 128, 128, 0]);
      gl.uniform4fv(uni.uCrop, crops.flatMap(c => [c[0] / 255, c[1] / 255, c[2] / 255, c[3]]));
      gl.uniform1f(uni.uRoadW, ROAD_W); gl.uniform1f(uni.uSide, SIDE);
      // texturas: enquanto não carregam, uma cor média neutra (1×1) faz o detalhe valer 1
      let unit = 2;
      for (const k of Object.keys(TEXS)) { tex[k] = { unit: unit++, t: gl.createTexture() }; avg[k] = [0.5, 0.5, 0.5]; meters[k] = 3.5; solid(k); }
      gl.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); ready = false; failed = true; });
      // Surface-richness uses the original GPU textures in both art presets.
      wantTextures();
      ready = true;
      return true;
    } catch (e) { console.warn('Chão na GPU indisponível:', e); failed = true; try { canvas?.remove(); } catch (_) {} gl = null; return false; }
  }
  function solid(k) { gl.activeTexture(gl.TEXTURE0 + tex[k].unit); gl.bindTexture(gl.TEXTURE_2D, tex[k].t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255])); }
  let texWanted = false;
  function wantTextures() { if (texWanted || !gl) return; texWanted = true; void loadTextures(); }
  async function loadTextures() {
    let man = {}; try { man = await (await fetch('assets/textures/manifest.json')).json(); } catch (_) {}
    await Promise.all(Object.entries(TEXS).map(async ([k, file]) => {
      if (!man[file]) return;
      const img = new Image(); img.src = 'assets/textures/' + file + '.webp';
      try { await img.decode(); } catch (_) { return; }
      if (!gl) return;
      gl.activeTexture(gl.TEXTURE0 + tex[k].unit); gl.bindTexture(gl.TEXTURE_2D, tex[k].t);
      const enriched=window.CitySurfaceDetails?.enrich(img,file)||img;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, enriched); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
      // cor média (a textura entra como detalhe sobre a cor base da paleta, sem mudar o tom)
      const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, 1, 1); const p = g.getImageData(0, 0, 1, 1).data; avg[k] = [p[0] / 255, p[1] / 255, p[2] / 255];
      meters[k] = man[file].meters;
    }));
  }

  // ---------- preenchimento da janela de dados ----------
  function fillTile(tx, ty) {
    const x0 = tx * TILE, y0 = ty * TILE;
    let o = 0;
    for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
      const x = x0 + i + 0.5, y = y0 + j + 0.5;
      fineBuf[o++] = Math.round(clamp(roadDist(x, y), 0, 25.5) * 10);
      const di = world.districtFn ? world.districtFn(x, y) : 3;
      fineBuf[o++] = di;
      // talhão da roça: direção das fileiras e a cultura (as mesmas de fieldFn que a CPU usa)
      if (di === COG.D.FARM && world.fieldFn) { const fl = world.fieldFn(x, y); fineBuf[o++] = Math.round(fl[0] / Math.PI * 255); fineBuf[o++] = fl[1]; } else { fineBuf[o++] = 0; fineBuf[o++] = 0; }
    }
    o = 0;
    for (let j = 0; j < TILE / COARSE; j++) for (let i = 0; i < TILE / COARSE; i++) {
      const x = x0 + (i + 0.5) * COARSE, y = y0 + (j + 0.5) * COARSE, pv = pondVal(x, y), c = owBaseColor(x, y, pv);
      coarseBuf[o++] = c[0]; coarseBuf[o++] = c[1]; coarseBuf[o++] = c[2]; coarseBuf[o++] = Math.round(clamp(pv, 0, 2.55) * 100);
    }
    const sx = ((tx % SLOTS) + SLOTS) % SLOTS, sy = ((ty % SLOTS) + SLOTS) % SLOTS;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fineTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, sx * TILE, sy * TILE, TILE, TILE, gl.RGBA, gl.UNSIGNED_BYTE, fineBuf);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, coarseTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, sx * TILE / COARSE, sy * TILE / COARSE, TILE / COARSE, TILE / COARSE, gl.RGBA, gl.UNSIGNED_BYTE, coarseBuf);
    slot[sy * SLOTS + sx] = tx + ',' + ty; stats.tiles++;
  }
  const filled = (tx, ty) => slot[(((ty % SLOTS) + SLOTS) % SLOTS) * SLOTS + ((tx % SLOTS) + SLOTS) % SLOTS] === tx + ',' + ty;
  // blocos da vista (sempre, mesmo estourando o orçamento: o shader não pode ler dado velho) e, com folga, os da frente
  function update(x0, y0, x1, y1) {
    const t0 = performance.now();
    const tx0 = Math.floor(x0 / TILE) - 1, tx1 = Math.floor(x1 / TILE) + 1, ty0 = Math.floor(y0 / TILE) - 1, ty1 = Math.floor(y1 / TILE) + 1;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (!filled(tx, ty)) fillTile(tx, ty);
    const v = typeof terrain !== 'undefined' && terrain.vel || [0, 0], ax = v[0] * 2.5, ay = v[1] * 2.5;
    if (Math.abs(ax) + Math.abs(ay) > 4) {
      const bx0 = Math.floor((x0 + Math.min(0, ax)) / TILE) - 1, bx1 = Math.floor((x1 + Math.max(0, ax)) / TILE) + 1;
      const by0 = Math.floor((y0 + Math.min(0, ay)) / TILE) - 1, by1 = Math.floor((y1 + Math.max(0, ay)) / TILE) + 1;
      for (let ty = by0; ty <= by1; ty++) for (let tx = bx0; tx <= bx1; tx++) { if (performance.now() - t0 > 1.5) break; if (!filled(tx, ty)) fillTile(tx, ty); }
    }
    stats.ms = performance.now() - t0;
  }

  // ---------- quadro ----------
  // desenha o chão da vista; devolve false se não dá (sem WebGL2 / mundo fechado) e o 2D continua como antes
  function draw(W, H) {
    if (!world.open || typeof owBaseColor !== 'function') return false;
    if (!ready && !init()) return false;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    // a vista inteira já está coberta pelos blocos pintados da tela 2D: nada a desenhar aqui
    else if (typeof terrainCovered === 'function' && terrainCovered(W, H)) { stats.skipped = (stats.skipped || 0) + 1; return true; }
    const cs = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => unproj(x, y, 0)), xs = cs.map(p => p[0]), ys = cs.map(p => p[1]);
    update(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    gl.viewport(0, 0, W, H); gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fineTex); gl.uniform1i(uni.uFine, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, coarseTex); gl.uniform1i(uni.uCoarse, 1);
    const U = { lawn: 'uLawn', weeds: 'uWeeds', sand: 'uSand', dirt: 'uDirt', walk: 'uWalk', conc: 'uConc' }, A = { lawn: 'aLawn', weeds: 'aWeeds', sand: 'aSand', dirt: 'aDirt', walk: 'aWalk', conc: 'aConc' };
    for (const k in tex) { gl.activeTexture(gl.TEXTURE0 + tex[k].unit); gl.bindTexture(gl.TEXTURE_2D, tex[k].t); gl.uniform1i(uni[U[k]], tex[k].unit); gl.uniform3fv(uni[A[k]], avg[k]); }
    gl.uniform4f(uni.mA, meters.lawn, meters.weeds, meters.sand, meters.dirt); gl.uniform4f(uni.mB, meters.walk, meters.conc, 0, 0);
    gl.uniform2f(uni.uRes, W, H); gl.uniform2f(uni.uCam, cam.x, cam.y); gl.uniform2f(uni.uRot, cam.cos, cam.sin);
    gl.uniform1f(uni.uZoom, cam.zoom); gl.uniform1f(uni.uTilt, TILT); gl.uniform1f(uni.uInk, ink ? ink.outline : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    stats.frames++;
    return true;
  }
  // dados do mundo mudaram (ex.: terreno de sítio virou pasto): a janela é refeita nos próximos quadros
  function invalidate() { slot.fill(null); }
  // URBAN INK (urban-ink.mjs): parâmetros do traço ou null p/ o estilo original; o chão 2D (terrain.js) acompanha
  let ink = null;
  // já nasce no estilo salvo (antes de a camada 3D aplicar as configurações): não baixa fotos à toa
  try { const S = window.CityFrontState, v = S && S.settings(S.read(localStorage, S.SETTINGS)); if (v && v.ink) ink = { enabled: true, outline: v.inkOutline }; } catch (_) {}
  function setInk(p) { ink = p && p.enabled ? p : null; window.CityTerrainInk?.(!!ink); if (!ink) wantTextures(); }
  return { draw, invalidate, setInk, get active() { return ready && !failed; }, stats };
})();
window.GroundGPU = GroundGPU;
