// Pós-processamento local (grátis): deixa cada imagem do Gemini pronta para o jogo.
//   texturas/paredes/telhados: tira manchas grandes de luz + emenda as bordas (repete sem costura)
//   fachadas: só emenda as bordas; murais: ficam como vieram (só reduz)
//   sprites: recorta o fundo magenta, limpa o halo rosado e corta a sobra
// As funções puras trabalham em RGBA cru (Uint8Array), testáveis sem o sharp.

const clamp8 = v => v < 0 ? 0 : v > 255 ? 255 : v;
const smooth = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

// iluminação uniforme: divide cada pixel pela média local (grade 12×12 suavizada, amostrada com interpolação bilinear)
export function flattenLighting(px, w, h, strength = 0.8) {
  const G = 12, cell = [];
  const mean = [0, 0, 0];
  for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
    const x0 = (gx * w / G) | 0, x1 = ((gx + 1) * w / G) | 0, y0 = (gy * h / G) | 0, y1 = ((gy + 1) * h / G) | 0, s = [0, 0, 0];
    let n = 0;
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const i = (y * w + x) * 4; s[0] += px[i]; s[1] += px[i + 1]; s[2] += px[i + 2]; n++; }
    cell.push(s.map(v => v / n));
  }
  // suaviza a grade (vizinhos com volta nas bordas, porque a textura repete)
  const sm = cell.map((_, k) => { const gx = k % G, gy = (k / G) | 0, o = [0, 0, 0];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = cell[((gy + dy + G) % G) * G + (gx + dx + G) % G]; for (let j = 0; j < 3; j++) o[j] += c[j] / 9; }
    return o; });
  for (const c of sm) for (let j = 0; j < 3; j++) mean[j] += c[j] / sm.length;
  const out = new Uint8Array(px);
  for (let y = 0; y < h; y++) {
    const fy = y / h * G - 0.5, gy0 = Math.floor(fy), ty = fy - gy0;
    for (let x = 0; x < w; x++) {
      const fx = x / w * G - 0.5, gx0 = Math.floor(fx), tx = fx - gx0, i = (y * w + x) * 4;
      const at = (gx, gy) => sm[((gy + G) % G) * G + (gx + G) % G];
      const a = at(gx0, gy0), b = at(gx0 + 1, gy0), c = at(gx0, gy0 + 1), d = at(gx0 + 1, gy0 + 1);
      for (let j = 0; j < 3; j++) {
        const local = (a[j] * (1 - tx) + b[j] * tx) * (1 - ty) + (c[j] * (1 - tx) + d[j] * tx) * ty;
        const k = local > 1 ? mean[j] / local : 1;
        out[i + j] = clamp8(px[i + j] * (1 + (k - 1) * strength));
      }
    }
  }
  return out;
}

// casa o brilho médio das bordas opostas: em cada linha compara as faixas de 8% da esquerda e da direita
// (diferença suavizada entre linhas vizinhas, só a parte de baixa frequência) e espalha uma rampa suave
// pela largura; depois o mesmo nas colunas. Sem isso o corte da costura expõe o degradê do original.
export function matchEdges(px, w, h) {
  const out = new Float32Array(px), band = Math.max(4, Math.round(Math.min(w, h) * 0.08));
  const pass = (n, m, at) => {   // n linhas de m pixels; at(linha, pos) -> índice do pixel
    const d = new Float32Array(n * 3);
    for (let r = 0; r < n; r++) for (let c = 0; c < 3; c++) {
      let a = 0, b = 0; for (let k = 0; k < band; k++) { a += out[at(r, k) + c]; b += out[at(r, m - 1 - k) + c]; }
      d[r * 3 + c] = (b - a) / band;
    }
    const win = Math.max(4, Math.round(n * 0.06)), sm = new Float32Array(n * 3);
    for (let r = 0; r < n; r++) for (let c = 0; c < 3; c++) { let s = 0, q = 0; for (let k = -win; k <= win; k++) { const rr = r + k; if (rr < 0 || rr >= n) continue; s += d[rr * 3 + c]; q++; } sm[r * 3 + c] = s / q; }
    for (let r = 0; r < n; r++) for (let p = 0; p < m; p++) { const t = p / (m - 1) - 0.5, i = at(r, p); for (let c = 0; c < 3; c++) out[i + c] -= sm[r * 3 + c] * t; }
  };
  pass(h, w, (r, p) => (r * w + p) * 4);
  pass(w, h, (r, p) => (p * w + r) * 4);
  const o = new Uint8Array(px.length); for (let i = 0; i < o.length; i++) o[i] = clamp8(Math.round(out[i])); return o;
}

// retoque local (para defeitos que o juiz aponta e o automático não pega: gravetos, "olhos", manchas):
// cada retângulo [x0,y0,x1,y1] em fração da imagem é coberto por um pedaço da própria textura vindo de perto
// (com volta, a textura repete), escolhido entre 8 vizinhos pelo brilho mais parecido com o entorno, com borda
// suave de `feather` px.
export function retouch(px, w, h, rects, feather = 20) {
  const out = new Uint8Array(px), lum = o => 0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2];
  const at = (x, y) => ((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4;
  // retângulo: [x0,y0,x1,y1] escolhe a origem sozinho; [x0,y0,x1,y1, sx0,sy0,sx1,sy1] copia de uma área limpa indicada
  // (se ela for menor que o defeito, é repetida para cobrir)
  let LB = null, LM = 0;   // luminância desfocada (raio ~3% da imagem) e média, p/ os nivelamentos locais
  for (const [fx0, fy0, fx1, fy1, ...src] of rects) {
    const x0 = Math.round(fx0 * w), y0 = Math.round(fy0 * h), x1 = Math.round(fx1 * w), y1 = Math.round(fy1 * h), rw = x1 - x0, rh = y1 - y0;
    const stat = (ax, ay, bw, bh) => { let s = 0, n = 0; const v = []; for (let y = ay; y < ay + bh; y += 3) for (let x = ax; x < ax + bw; x += 3) { const l = lum(at(x, y)); v.push(l); s += l; n++; } return { mean: s / n, v }; };
    const mask = (x, y) => { const ex = Math.max(x0 - x, x - (x1 - 1), 0), ey = Math.max(y0 - y, y - (y1 - 1), 0), t = 1 - Math.min(1, Math.hypot(ex, ey) / feather); return t <= 0 ? 0 : t * t * (3 - 2 * t); };
    if (src[0] === 'level') {   // [x0,y0,x1,y1,'level',força]: nivela só esta região (faixa/mancha do original), borda suave
      if (!LB) { const B = boxBlur(px, w, h, Math.max(6, Math.round(w * 0.03))); LB = new Float32Array(w * h); for (let i = 0; i < w * h; i++) { LB[i] = 0.299 * B[i * 3] + 0.587 * B[i * 3 + 1] + 0.114 * B[i * 3 + 2]; LM += LB[i] / (w * h); } }
      for (let y = y0 - feather; y < y1 + feather; y++) for (let x = x0 - feather; x < x1 + feather; x++) { const k = mask(x, y); if (!k) continue; const d = at(x, y), dl = (LB[d / 4] - LM) * (src[1] || 0.4) * k; for (let c = 0; c < 3; c++) out[d + c] = clamp8(out[d + c] - dl); }
      continue;
    }
    let from;   // (x, y) do defeito -> pixel de origem
    if (src[0] === 'clean') {
      // varre a imagem inteira atrás da janela do mesmo tamanho SEM pontos muito escuros (tufos, gravetos), mas com o
      // mesmo "grão" do entorno (desvio padrão parecido): copiar chão liso demais vira um quadrado vazio que se nota
      const sdOf = st => Math.sqrt(st.v.reduce((a, l) => a + (l - st.mean) ** 2, 0) / st.v.length);
      const ringSd = (sdOf(stat(x0 - feather, y0 - feather, rw + 2 * feather, feather)) + sdOf(stat(x0 - feather, y1, rw + 2 * feather, feather))) / 2;
      let best = null, bd = Infinity;
      const stepX = Math.max(8, rw >> 1), stepY = Math.max(8, rh >> 1);
      for (let sy = 0; sy < h; sy += stepY) for (let sx = 0; sx < w; sx += stepX) {
        if (Math.abs(sx - x0) < rw + feather && Math.abs(sy - y0) < rh + feather) continue;
        const st = stat(sx, sy, rw, rh), sd = sdOf(st);
        const dark = st.v.filter(l => l < st.mean - 45).length / st.v.length, d = dark * 400 + Math.abs(sd / ringSd - 1) * 60;
        if (d < bd) { bd = d; best = [sx - x0, sy - y0]; }
      }
      from = (x, y) => at(x + best[0], y + best[1]);
    } else if (src.length === 4) {
      const sx0 = Math.round(src[0] * w), sy0 = Math.round(src[1] * h), sw = Math.max(4, Math.round(src[2] * w) - sx0), sh = Math.max(4, Math.round(src[3] * h) - sy0);
      from = (x, y) => at(sx0 + ((((x - x0 + feather) % sw) + sw) % sw), sy0 + ((((y - y0 + feather) % sh) + sh) % sh));
    } else {
      // brilho do anel em volta do defeito; entre 8 vizinhos, a origem com brilho parecido e SEM pontos bem mais escuros
      const ring = (stat(x0 - feather, y0 - feather, rw + 2 * feather, feather).mean + stat(x0 - feather, y1, rw + 2 * feather, feather).mean) / 2;
      let best = null, bd = Infinity;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const sx = x0 + dx * (rw + 2 * feather + 8), sy = y0 + dy * (rh + 2 * feather + 8), st = stat(sx, sy, rw, rh);
        const dark = st.v.filter(l => l < ring - 40).length / st.v.length, d = Math.abs(st.mean - ring) + dark * 400;
        if (d < bd) { bd = d; best = [sx - x0, sy - y0]; }
      }
      from = (x, y) => at(x + best[0], y + best[1]);
    }
    // brilho médio do pedaço copiado igualado ao do anel em volta do defeito (senão o retoque fica mais claro/escuro)
    let sm = 0, sn = 0; for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) { sm += lum(from(x, y)); sn++; }
    const ringMean = (stat(x0 - feather, y0 - feather, rw + 2 * feather, feather).mean + stat(x0 - feather, y1, rw + 2 * feather, feather).mean + stat(x0 - feather, y0, feather, rh).mean + stat(x1, y0, feather, rh).mean) / 4;
    const off = ringMean - sm / sn;
    for (let y = y0 - feather; y < y1 + feather; y++) for (let x = x0 - feather; x < x1 + feather; x++) {
      const k = mask(x, y); if (!k) continue;
      const d = at(x, y), s = from(x, y);
      for (let c = 0; c < 3; c++) out[d + c] = clamp8(Math.round(out[d + c] + (px[s + c] + off - out[d + c]) * k));
    }
  }
  return out;
}

// recolore mantendo só a luz e sombra: cada pixel vira a cor âncora × (brilho dele / brilho médio). Serve para
// derivar variações do mesmo material (calçada rosa a partir da cinza aprovada)
export function tintLuma(px, anchor) {
  const lum = (o) => 0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2];
  let mean = 0; for (let o = 0; o < px.length; o += 4) mean += lum(o) / (px.length / 4);
  const out = new Uint8Array(px);
  for (let o = 0; o < px.length; o += 4) { const k = lum(o) / mean; for (let c = 0; c < 3; c++) out[o + c] = clamp8(anchor[c] * k); }
  return out;
}

// cor média puxada p/ a âncora da paleta (o Gemini erra o tom: asfalto marrom, calçada rosa alaranjada);
// escala cada canal, preservando todo o detalhe de luz e sombra
export function colorMatch(px, anchor, strength = 0.75) {
  const n = px.length / 4, mean = [0, 0, 0];
  for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) mean[c] += px[i + c] / n;
  const k = mean.map((m, c) => 1 + (anchor[c] / Math.max(1, m) - 1) * strength), out = new Uint8Array(px);
  for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) out[i + c] = clamp8(px[i + c] * k[c]);
  return out;
}
export const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

// repete sem costura por CORTE (como "image quilting"): as últimas `band` colunas da imagem sobrepõem as primeiras e,
// em cada linha, um caminho de menor diferença entre as duas camadas decide onde uma termina e a outra começa
// (2 px de transição, sem mistura por transparência e sem fantasmas). Depois o mesmo nas linhas. A imagem perde
// `band` px por eixo; fora da faixa ela é a original.
function cutX(px, w, h, b) {
  const W = w - b, out = new Uint8Array(W * h * 4), cost = new Float32Array(b * h), from = new Int8Array(b * h);
  const diff = (i, j) => { const a = (j * w + i) * 4, c = (j * w + W + i) * 4; let s = 0; for (let k = 0; k < 3; k++) { const d = px[a + k] - px[c + k]; s += d * d; } return s; };
  // programação dinâmica de cima p/ baixo: o corte anda no máximo 1 px por linha; perto das pontas da faixa custa caro
  // (assim a coluna 0 é sempre a cópia da direita e a coluna b-1 é sempre a original)
  for (let j = 0; j < h; j++) for (let i = 0; i < b; i++) {
    const edge = i < 2 || i > b - 3 ? 1e9 : 0;
    let best = 0, bi = 0;
    if (j) { best = Infinity; for (let d = -1; d <= 1; d++) { const q = i + d; if (q >= 0 && q < b && cost[(j - 1) * b + q] < best) { best = cost[(j - 1) * b + q]; bi = d; } } }
    cost[j * b + i] = best + diff(i, j) + edge; from[j * b + i] = bi;
  }
  const cut = new Int32Array(h);
  let ci = 0; for (let i = 1; i < b; i++) if (cost[(h - 1) * b + i] < cost[(h - 1) * b + ci]) ci = i;
  for (let j = h - 1; j >= 0; j--) { cut[j] = ci; ci += from[j * b + ci]; }
  for (let j = 0; j < h; j++) for (let i = 0; i < W; i++) {
    const a = (j * w + i) * 4, o = (j * W + i) * 4;
    if (i >= b) { for (let k = 0; k < 4; k++) out[o + k] = px[a + k]; continue; }
    const t = Math.min(1, Math.max(0, (i - cut[j] + 1) / 2)), c = (j * w + W + i) * 4;   // 0 = cópia da direita, 1 = original
    for (let k = 0; k < 4; k++) out[o + k] = Math.round(px[c + k] + (px[a + k] - px[c + k]) * t);
  }
  return out;
}
function transpose(px, w, h) { const out = new Uint8Array(px.length); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const a = (j * w + i) * 4, o = (i * h + j) * 4; for (let k = 0; k < 4; k++) out[o + k] = px[a + k]; } return out; }
export function makeSeamless(px, w, h, { x = true, y = true, band = 0.08 } = {}) {
  if (x) { const b = Math.max(6, Math.round(w * band)); px = cutX(px, w, h, b); w -= b; }
  if (y) { const b = Math.max(6, Math.round(h * band)); px = transpose(cutX(transpose(px, w, h), h, w, b), h - b, w); h -= b; }
  return { px, w, h };
}

// recorte do fundo de cor-chave (magenta #FF00FF ou azul #0000FF) com borda suave e sem halo; devolve também a caixa do conteúdo
const KEYF = { magenta: (r, g, b) => Math.min(r, b) - g, blue: (r, g, b) => b - Math.max(r, g) };   // >0: puxa p/ a cor-chave
export function magentaCutout(px, w, h, keyName = 'magenta') {
  const out = new Uint8Array(px), key = KEYF[keyName];
  let edge = 0, n = 0;
  for (let i = 0; i < w; i += 4) for (const j of [0, h - 1]) { const k = (j * w + i) * 4; edge += key(px[k], px[k + 1], px[k + 2]) > 90 ? 1 : 0; n++; }
  for (let j = 0; j < h; j += 4) for (const i of [0, w - 1]) { const k = (j * w + i) * 4; edge += key(px[k], px[k + 1], px[k + 2]) > 90 ? 1 : 0; n++; }
  if (edge / n < 0.6) throw Error(`Recorte cancelado: as bordas não são ${keyName} uniforme; a imagem precisa ser refeita`);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = (j * w + i) * 4, r = px[k], g = px[k + 1], b = px[k + 2], m = key(r, g, b);
    const alpha = 1 - smooth(40, 120, m);
    if (alpha < 1 && alpha > 0) {   // borda: tira a cor-chave que vazou
      if (keyName === 'blue') out[k + 2] = Math.min(b, Math.max(r, g) + (b - Math.max(r, g)) * alpha);
      else { const lim = g + (Math.max(r, b) - g) * alpha; out[k] = Math.min(r, lim); out[k + 2] = Math.min(b, lim); }
    }
    out[k + 3] = Math.round(px[k + 3] * alpha);
    // reflexo da cor-chave em toda a planta (folhas com franja roxa): puxa o excesso de magenta p/ o verde
    if (keyName === 'magenta' && out[k + 3] && m > 0) { out[k] = Math.max(0, out[k] - m * 0.85); out[k + 2] = Math.max(0, out[k + 2] - m * 0.85); }
    if (out[k + 3] === 0) { out[k] = out[k + 1] = out[k + 2] = 0; }
  }
  // pedaços soltos (folhagem cortada na beirada da imagem, respingos): fica só o que está ligado à planta principal
  // (só pixels bem opacos ligam pedaços: franjas quase transparentes não contam como ponte)
  const OP = 64, lab = new Int32Array(w * h), sizes = [0], atEdge = [false], stack = [];
  for (let s = 0; s < w * h; s++) {
    if (lab[s] || out[s * 4 + 3] <= OP) continue;
    const id = sizes.length; let n = 0, onEdge = false; lab[s] = id; stack.push(s);
    while (stack.length) { const q = stack.pop(); n++; const qx = q % w, qy = (q / w) | 0; if (qx < 2 || qy < 2 || qx > w - 3 || qy > h - 3) onEdge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = qx + dx, ny = qy + dy, t = ny * w + nx; if (nx < 0 || ny < 0 || nx >= w || ny >= h || lab[t] || out[t * 4 + 3] <= OP) continue; lab[t] = id; stack.push(t); } }
    sizes.push(n); atEdge.push(onEdge);
  }
  // fica a planta principal e pedaços grandes dela; some o que é pequeno ou encosta na beirada (veio cortado)
  const big = Math.max(0, ...sizes), keep = sizes.map((n, i) => n === big || (n >= big * 0.12 && !atEdge[i]));
  // franja semitransparente só fica se estiver colada num pedaço mantido
  const nearKept = (i, j) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = i + dx, y = j + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue; const l = lab[y * w + x]; if (l && keep[l]) return true; } return false; };
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const s = j * w + i, k = s * 4;
    if ((lab[s] && !keep[lab[s]]) || (!lab[s] && out[k + 3] && !nearKept(i, j))) { out[k] = out[k + 1] = out[k + 2] = out[k + 3] = 0; continue; }
    if (out[k + 3] > 16) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  }
  if (x1 < 0) throw Error('Recorte cancelado: nada sobrou depois de tirar o fundo');
  return { px: out, box: [x0, y0, x1, y1] };
}

// tira a saturação (keep = fração do croma que fica): some com manchas marrons/avermelhadas do asfalto
export function desaturate(px, keep) {
  const out = new Uint8Array(px);
  for (let i = 0; i < px.length; i += 4) { const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; for (let c = 0; c < 3; c++) out[i + c] = clamp8(l + (px[i + c] - l) * keep); }
  return out;
}

// caixa-média com volta (a textura repete), raio r, nos 3 canais
function boxBlur(px, w, h, r) {
  const tmp = new Float32Array(w * h * 3), out = new Float32Array(w * h * 3), n = 2 * r + 1;
  for (let j = 0; j < h; j++) for (let c = 0; c < 3; c++) {
    let s = 0; for (let k = -r; k <= r; k++) s += px[(j * w + ((k + w) % w)) * 4 + c];
    for (let i = 0; i < w; i++) { tmp[(j * w + i) * 3 + c] = s / n; s += px[(j * w + (i + r + 1) % w) * 4 + c] - px[(j * w + (i - r + w) % w) * 4 + c]; }
  }
  for (let i = 0; i < w; i++) for (let c = 0; c < 3; c++) {
    let s = 0; for (let k = -r; k <= r; k++) s += tmp[(((k + h) % h) * w + i) * 3 + c];
    for (let j = 0; j < h; j++) { out[(j * w + i) * 3 + c] = s / n; s += tmp[(((j + r + 1) % h) * w + i) * 3 + c] - tmp[(((j - r + h) % h) * w + i) * 3 + c]; }
  }
  return out;
}
// apaga pontinhos escuros isolados (chicletes, furos) que viram grade quando a textura repete: o que fica bem mais
// escuro que a média da vizinhança é trocado por ela, com 2 px de folga e borda suave. Devolve também quantos px.
export function removeSpots(px, w, h, { thr = 38, radius = 0.012, strength = 1 } = {}) {
  const r = Math.max(3, Math.round(w * radius)), B = boxBlur(px, w, h, r), lum = (a, o) => 0.299 * a[o] + 0.587 * a[o + 1] + 0.114 * a[o + 2];
  const mask = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) if (lum(B, k * 3) - lum(px, k * 4) > thr) mask[k] = 1;
  const soft = new Float32Array(w * h); let count = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let m = 0; for (let dy = -3; dy <= 3 && m < 1; dy++) for (let dx = -3; dx <= 3; dx++) { if (!mask[((j + dy + h) % h) * w + (i + dx + w) % w]) continue; const d = Math.hypot(dx, dy); m = Math.max(m, d <= 2 ? 1 : 1 - (d - 2) / 2.3); }
    soft[j * w + i] = m * strength; if (mask[j * w + i]) count++;
  }
  const out = new Uint8Array(px);
  for (let k = 0; k < w * h; k++) if (soft[k] > 0) for (let c = 0; c < 3; c++) out[k * 4 + c] = clamp8(px[k * 4 + c] + (B[k * 3 + c] - px[k * 4 + c]) * soft[k]);
  return { px: out, count };
}

// o Gemini às vezes desenha a textura JÁ repetida (duas metades ou quatro quadrantes iguais). Mede a correlação do
// detalhe fino (passa-alta numa cópia 256×256) com ele mesmo deslocado meia largura / meia altura; > 0,4 = repetida.
export function halfRepeat(px, w, h) {
  const N = 256, g = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {   // média de bloco, só luminância
    const x0 = (i * w / N) | 0, x1 = Math.max(x0 + 1, ((i + 1) * w / N) | 0), y0 = (j * h / N) | 0, y1 = Math.max(y0 + 1, ((j + 1) * h / N) | 0);
    let s = 0, n = 0; for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const o = (y * w + x) * 4; s += 0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2]; n++; }
    g[j * N + i] = s / n;
  }
  const r = 6, hp = new Float32Array(N * N);   // passa-alta: tira a média 13×13 (só o detalhe fino conta)
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let s = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) s += g[((j + dy + N) % N) * N + (i + dx + N) % N]; hp[j * N + i] = g[j * N + i] - s / ((2 * r + 1) ** 2); }
  const corr = (sx, sy) => { let a = 0, b = 0, c = 0; for (let k = 0; k < N * N; k++) { const i = k % N, j = (k / N) | 0, v = hp[k], u = hp[((j + sy) % N) * N + (i + sx) % N]; a += v * u; b += v * v; c += u * u; } return a / Math.sqrt(b * c); };
  return { x: corr(N / 2, 0), y: corr(0, N / 2) };
}

// quando só um eixo repete, a janela de meio original pode deslizar no outro: escolhe a posição com menos "defeitos"
// (variação grande de brilho = manchas, e células bem mais escuras que a vizinhança = pontos/rachaduras),
// medidos numa grade 128×128 do original. axis 'y' = desliza na vertical. Devolve o deslocamento em px.
export function cleanestOffset(px, w, h, axis, size, margin) {
  const N = 128, g = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = ((i + 0.5) * w / N) | 0, y = ((j + 0.5) * h / N) | 0, o = (y * w + x) * 4; let s = 0; for (let d = 0; d < 3; d++) s += px[o + d]; g[j * N + i] = s / 3; }
  const loc = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let s = 0, n = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const y = j + dy, x = i + dx; if (x < 0 || y < 0 || x >= N || y >= N) continue; s += g[y * N + x]; n++; } loc[j * N + i] = s / n; }
  const len = axis === 'y' ? h : w, cells = Math.round(size / len * N), lo = Math.ceil(margin / len * N), hi = Math.floor((len - margin) / len * N) - cells;
  let best = lo, bestScore = Infinity;
  for (let o = lo; o <= Math.max(lo, hi); o++) {
    let mean = 0, n = 0; const inW = (i, j) => axis === 'y' ? j >= o && j < o + cells : i >= o && i < o + cells;
    for (let k = 0; k < N * N; k++) if (inW(k % N, (k / N) | 0)) { mean += loc[k]; n++; }
    mean /= n; let score = 0;
    for (let k = 0; k < N * N; k++) if (inW(k % N, (k / N) | 0)) score += Math.abs(loc[k] - mean) + Math.max(0, loc[k] - g[k] - 8) * 3;
    if (score < bestScore) { bestScore = score; best = o; }
  }
  return Math.round(best / N * len);
}

// reforça o detalhe fino (passa-alta de raio r multiplicado por k): reboco liso que viria quase em branco
export function boostDetail(px, w, h, r, k) {
  const B = boxBlur(px, w, h, r), out = new Uint8Array(px);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) out[i * 4 + c] = clamp8(B[i * 3 + c] + (px[i * 4 + c] - B[i * 3 + c]) * k);
  return out;
}

// nivela as formas grandes (manchas de 30 cm para cima) sem mexer no detalhe fino: tira `strength` da diferença
// entre a luminância desfocada (raio r) e a média geral
export function levelLarge(px, w, h, r, strength = 0.5) {
  const B = boxBlur(px, w, h, r), lum = (a, o) => 0.299 * a[o] + 0.587 * a[o + 1] + 0.114 * a[o + 2];
  let mean = 0; for (let k = 0; k < w * h; k++) mean += lum(B, k * 3) / (w * h);
  const out = new Uint8Array(px);
  for (let k = 0; k < w * h; k++) { const d = (lum(B, k * 3) - mean) * strength; for (let c = 0; c < 3; c++) out[k * 4 + c] = clamp8(px[k * 4 + c] - d); }
  return out;
}

// original (PNG/JPEG/WebP) -> { full: PNG processado, game: WebP no tamanho do jogo, info }
export async function processAsset(bytes, asset, opts = {}) {
  const { default: sharp } = await import('sharp');
  const meta = await sharp(bytes).metadata();
  if (!meta.width || !meta.height || meta.width < 256 || meta.height < 256 || meta.width > 8192 || meta.height > 8192) throw Error('Imagem gerada com dimensões inválidas');
  const tex = asset.kind === 'texture' || asset.kind === 'wall' || asset.kind === 'roof', steps = [];
  // texturas: corta 2% de cada borda (o modelo às vezes desenha um filete claro na beirada). Se a textura veio
  // repetida dentro da imagem (medido no original inteiro, em fase), fica só um período: metade exata do original,
  // a partir da margem, e as bordas desse período já casam. A escala acompanha (coverage usa a largura final).
  let src = sharp(bytes);
  if (tex) {
    const full = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const hr = halfRepeat(new Uint8Array(full.data.buffer, full.data.byteOffset, full.data.length), full.info.width, full.info.height), cx = hr.x > 0.4, cy = hr.y > 0.4;
    const m = Math.round(Math.min(meta.width, meta.height) * 0.02);
    // o jogo usa textura quadrada: se um eixo repete, os dois ficam com meio original (o corte da costura cuida do outro)
    const half = cx || cy, cw = half ? Math.round(meta.width / 2) : meta.width - 2 * m, chh = half ? Math.round(meta.height / 2) : meta.height - 2 * m;
    // só um eixo repete: no outro a janela desliza até a posição mais limpa
    const fpx = new Uint8Array(full.data.buffer, full.data.byteOffset, full.data.length);
    const left = half && !cx ? cleanestOffset(fpx, meta.width, meta.height, 'x', cw, m) : m, top = half && !cy ? cleanestOffset(fpx, meta.width, meta.height, 'y', chh, m) : m;
    src = sharp(await src.extract({ left, top, width: cw, height: chh }).toBuffer());
    if (cx || cy) steps.push(`period ${cx ? 'x' : ''}${cy ? 'y' : ''} (${hr.x.toFixed(2)}, ${hr.y.toFixed(2)})`);
  }
  const { data, info } = await src.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let w = info.width, h = info.height;
  let px = new Uint8Array(data.buffer, data.byteOffset, data.length), crop = null;
  if (tex) {
    px = flattenLighting(px, w, h, 0.8); steps.push('flatten');
    if (asset.desat != null) { px = desaturate(px, asset.desat); steps.push('desat'); }
    if (asset.anchor) { px = colorMatch(px, hexRgb(asset.anchor)); steps.push('color ' + asset.anchor); }
    if (asset.boost) { px = boostDetail(px, w, h, asset.boostR || 8, asset.boost); steps.push('boost ' + asset.boost); }
    if (asset.level) { px = levelLarge(px, w, h, Math.max(4, Math.round(w * 0.3 / asset.meters)), asset.level); steps.push('level ' + asset.level); }
    if (asset.despot) { const s = removeSpots(px, w, h, asset.despot === true ? {} : asset.despot); px = s.px; steps.push(`spots ${s.count}px`); }
    px = matchEdges(px, w, h); steps.push('edges');
    ({ px, w, h } = makeSeamless(px, w, h)); steps.push('seamless');
    // retouch.json: [retângulos] ou { feather, rects }
    const rt = opts.retouch && (Array.isArray(opts.retouch) ? { rects: opts.retouch } : opts.retouch);
    if (rt?.rects?.length) { px = retouch(px, w, h, rt.rects, rt.feather || 20); steps.push(`retouch ${rt.rects.length}`); }
  } else if (asset.kind === 'facade') {
    ({ px, w, h } = makeSeamless(px, w, h)); steps.push('seamless');
  } else if (asset.kind === 'sprite') {
    const r = magentaCutout(px, w, h, asset.key || 'magenta'); px = r.px; steps.push('cutout-' + (asset.key || 'magenta'));
    const pad = 6, [x0, y0, x1, y1] = r.box;
    crop = { left: Math.max(0, x0 - pad), top: Math.max(0, y0 - pad) }; crop.width = Math.min(w, x1 + pad + 1) - crop.left; crop.height = Math.min(h, y1 + pad + 1) - crop.top;
  }
  let img = sharp(Buffer.from(px.buffer, px.byteOffset, px.length), { raw: { width: w, height: h, channels: 4 } });
  if (crop) img = img.extract(crop);
  const full = await img.png().toBuffer();
  const game = await sharp(full).resize({ width: asset.game, height: asset.game, fit: 'inside', kernel: 'lanczos3' }).webp({ quality: 90, alphaQuality: 95 }).toBuffer();
  const gm = await sharp(game).metadata();
  // largura real coberta pela imagem final (o recorte da beirada e o corte da costura tiram pixels)
  const coverage = +(asset.meters * w / meta.width).toFixed(3);   // meta.width = original inteiro
  return { full, game, info: { width: w, height: h, format: meta.format, steps, coverage, gameWidth: gm.width, gameHeight: gm.height, gameBytes: game.length } };
}
