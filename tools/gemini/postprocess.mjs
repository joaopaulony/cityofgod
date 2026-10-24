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
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = (j * w + i) * 4, r = px[k], g = px[k + 1], b = px[k + 2], m = key(r, g, b);
    const alpha = 1 - smooth(40, 120, m);
    if (alpha < 1 && alpha > 0) {   // borda: tira a cor-chave que vazou
      if (keyName === 'blue') out[k + 2] = Math.min(b, Math.max(r, g) + (b - Math.max(r, g)) * alpha);
      else { const lim = g + (Math.max(r, b) - g) * alpha; out[k] = Math.min(r, lim); out[k + 2] = Math.min(b, lim); }
    }
    out[k + 3] = Math.round(px[k + 3] * alpha);
    if (out[k + 3] === 0) { out[k] = out[k + 1] = out[k + 2] = 0; }
    else if (out[k + 3] > 16) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  }
  if (x1 < 0) throw Error('Recorte cancelado: nada sobrou depois de tirar o fundo');
  return { px: out, box: [x0, y0, x1, y1] };
}

// original (PNG/JPEG/WebP) -> { full: PNG processado, game: WebP no tamanho do jogo, info }
export async function processAsset(bytes, asset) {
  const { default: sharp } = await import('sharp');
  const meta = await sharp(bytes).metadata();
  if (!meta.width || !meta.height || meta.width < 256 || meta.height < 256 || meta.width > 8192 || meta.height > 8192) throw Error('Imagem gerada com dimensões inválidas');
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let w = info.width, h = info.height;
  let px = new Uint8Array(data.buffer, data.byteOffset, data.length), crop = null;
  const steps = [];
  if (asset.kind === 'texture' || asset.kind === 'wall' || asset.kind === 'roof') {
    px = flattenLighting(px, w, h, 0.8); steps.push('flatten');
    if (asset.anchor) { px = colorMatch(px, hexRgb(asset.anchor)); steps.push('color ' + asset.anchor); }
    ({ px, w, h } = makeSeamless(px, w, h)); steps.push('seamless');
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
  return { full, game, info: { width: w, height: h, format: meta.format, steps, gameWidth: gm.width, gameHeight: gm.height, gameBytes: game.length } };
}
