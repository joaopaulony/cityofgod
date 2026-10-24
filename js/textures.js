// textures.js — texturas pintadas (geradas pelo Nano Banana em tools/gemini e aprovadas pelo juiz).
//   chão: terrain.js lê a textura por pixel (texAt), reamostrada uma vez na resolução do chão (TP px/m), com volta
//   paredes e telhados: archi.js / roofs.js / miami-facades.js preenchem com wallTexFill na escala de cada imagem
// Só carrega o que está em assets/textures/manifest.json (as aprovadas, instaladas por tools/gemini/install.mjs),
// com a largura real em metros gravada lá. Enquanto não carregam, tudo continua procedural; quando ficam prontas, os
// blocos de chão e as fachadas/telhados já pintados são descartados e repintados com elas.
'use strict';

// material do chão -> asset do catálogo (tools/gemini/catalog.mjs)
const TEX_FILES = {
  lawn: 'ground-lawn', weeds: 'ground-weeds', sand: 'ground-sand', dirt: 'ground-dirt',
  asphalt: 'ground-asphalt', walk: 'ground-sidewalk', walkPink: 'ground-sidewalk-pink', concrete: 'ground-concrete-worn',
};
// material de parede/telhado -> [asset, modo]: 'detail' = só a luz e sombra da textura por cima da cor da casa
// (mistura overlay, a cor vem da paleta), 'direct' = a imagem como está
const WALL_FILES = {
  stucco: ['wall-stucco', 'detail'], stuccoWorn: ['wall-stucco-worn', 'detail'], block: ['wall-block', 'detail'], brick: ['wall-brick', 'direct'],
  roofFlat: ['roof-flat', 'direct'], roofClean: ['roof-flat-clean', 'direct'], shingle: ['roof-shingle', 'detail'], metal: ['roof-metal', 'direct'],
};
const GTEX = { ready: false, t: {} }, WTEX = { t: {} };

const loadImg = src => new Promise(res => { const img = new Image(); img.onload = () => res(img); img.onerror = () => { console.warn('textura ausente:', src); res(null); }; img.src = src; });

// mapa de detalhe: brilho em volta de 128 (cinza médio = não muda a cor na mistura overlay), contraste suavizado
function detailMap(img) {
  const c = makeCanvas(img.width, img.height), g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height), d = id.data, n = d.length / 4;
  let mean = 0; for (let o = 0; o < d.length; o += 4) mean += (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / n;
  for (let o = 0; o < d.length; o += 4) { const v = clamp(128 + (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2] - mean) * 0.9, 0, 255); d[o] = d[o + 1] = d[o + 2] = v; }
  g.putImageData(id, 0, 0);
  return c;
}

async function texLoad() {
  let man = {};
  try { man = await (await fetch('assets/textures/manifest.json', { cache: 'no-cache' })).json(); } catch { return; }
  const ground = Object.entries(TEX_FILES).filter(([, id]) => man[id]), walls = Object.entries(WALL_FILES).filter(([, [id]]) => man[id]);
  await Promise.all([
    ...ground.map(async ([key, file]) => {
      const img = await loadImg('assets/textures/' + file + '.webp'); if (!img) return;
      const n = Math.round(man[file].meters * TP), c = makeCanvas(n, n), g = c.getContext('2d');
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, n, n);
      GTEX.t[key] = { n, data: g.getImageData(0, 0, n, n).data };
    }),
    ...walls.map(async ([key, [file, mode]]) => {
      const img = await loadImg('assets/textures/' + file + '.webp'); if (!img) return;
      let c = img;
      if (mode === 'detail') c = detailMap(img);
      else { c = makeCanvas(img.width, img.height); c.getContext('2d').drawImage(img, 0, 0); }
      WTEX.t[key] = { c, meters: man[file].meters, mode };
    }),
  ]);
  GTEX.ready = Object.keys(GTEX.t).length > 0;
  if (GTEX.ready && typeof terrain !== 'undefined') terrain.chunks.clear();   // repinta o chão com as texturas
  if (Object.keys(WTEX.t).length && typeof houses !== 'undefined') for (const H of houses) {   // repinta fachadas e telhados
    H.tex = null; H._texBuild = null; H.slabTex = null; H._warm = false;
    if (H.roofGeom && H.roofGeom.faces) for (const f of H.roofGeom.faces) f.tex = null;
  }
}

// cor da textura no ponto (px do chão, TP px/m) -> out[0..2]; devolve false se a textura não existe
function texAt(key, gx, gy, out) {
  const T = GTEX.t[key]; if (!T) return false;
  const n = T.n, x = ((gx % n) + n) % n, y = ((gy % n) + n) % n, o = (y * n + x) * 4, d = T.data;
  out[0] = d[o]; out[1] = d[o + 1]; out[2] = d[o + 2];
  return true;
}

// preenche o retângulo com a textura de parede/telhado repetida na escala ppm (px por metro da imagem de destino).
// col: cor da casa (pintada antes; a textura 'detail' só põe luz e sombra por cima). Devolve false se não há textura.
function wallTexFill(g, x, y, w, h, key, ppm, col) {
  const T = WTEX.t[key]; if (!T) return false;
  g.save();
  if (col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  const pat = g.createPattern(T.c, 'repeat'), s = ppm * T.meters / T.c.width;
  pat.setTransform(new DOMMatrix([s, 0, 0, s, x, y]));
  g.globalCompositeOperation = T.mode === 'detail' && col ? 'overlay' : 'source-over';
  g.fillStyle = pat; g.fillRect(x, y, w, h);
  g.restore();
  return true;
}

texLoad();
