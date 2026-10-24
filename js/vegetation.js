// vegetation.js — árvores, palmeiras e arbustos pintados (Nano Banana, tools/gemini), aprovados pelo juiz e instalados
// em assets/textures (manifest: { height, files }). Troca o CONTEÚDO dos sprites dos pools do mundo grande
// (OW.pools.oaks/pines/bushes, MIA.palms, MIA.bush) no lugar: toda árvore do mapa aponta para um desses objetos, então
// muda na hora, sem refazer setores. Cada imagem vira tronco (fixo) + copa (balança com o vento), no formato de makeTree.
'use strict';

const VEG_RES = 2;   // sprites guardados a SPR × 2 px/m: nítidos no zoom máximo (drawProp divide pela resolução)
// pool -> assets em rodízio (cada entrada do pool recebe o próximo arquivo da lista)
const VEG_POOLS = {
  coconut: ['tree-coconut'], royal: ['tree-royal'],
  oaks: ['tree-live-oak', 'tree-poinciana', 'tree-mahogany', 'tree-black-olive'], pines: ['tree-slash-pine'],
  bushes: ['bush-shrub', 'bush-seagrape', 'bush-hibiscus'],
  hibiscus: ['bush-hibiscus'], bougainvillea: ['bush-bougainvillea'], croton: ['bush-croton'], seagrape: ['bush-seagrape'],
};

// imagem recortada -> sprite. height: altura real (m). tree=false: arbusto (uma imagem só, ancorada na base)
function vegSprite(img, height, tree, kind) {
  const ppm = SPR * VEG_RES, k = height * HZ * ppm / img.height, W = Math.ceil(img.width * k), H = Math.ceil(img.height * k);
  const c = makeCanvas(W, H), g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, W, H);
  const a = g.getImageData(0, 0, W, H).data, row = [], cen = [];
  for (let y = 0; y < H; y++) { let n = 0, sx = 0; for (let x = 0; x < W; x++) if (a[(y * W + x) * 4 + 3] > 96) { n++; sx += x; } row.push(n); cen.push(n ? sx / n : -1); }
  let bot = H - 1; while (bot > 0 && !row[bot]) bot--;
  const baseX = cen[bot] >= 0 ? cen[bot] : W / 2, maxW = Math.max(...row);
  // cores das folhas p/ as partículas: média do terço de cima, em 4 tons
  const leaf = [0, 0, 0]; let ln = 0;
  for (let y = 0; y < H / 3; y += 2) for (let x = 0; x < W; x += 2) { const o = (y * W + x) * 4; if (a[o + 3] > 200) { leaf[0] += a[o]; leaf[1] += a[o + 1]; leaf[2] += a[o + 2]; ln++; } }
  const lc = ln ? leaf.map(v => v / ln) : [80, 120, 50], hex = m => '#' + lc.map(v => Math.round(clamp(v * m, 0, 255)).toString(16).padStart(2, '0')).join('');
  const leafColors = [hex(0.7), hex(0.9), hex(1.05), hex(1.2)];
  if (!tree) return { img: c, ax: baseX, ay: bot + 1, r: maxW / ppm / 2, res: VEG_RES, leafColors };
  // base da copa: subindo do pé, a primeira linha bem mais larga que o tronco
  const trunkW = Math.max(2, row.slice(Math.round(bot - H * 0.08), bot + 1).sort((p, q) => p - q)[Math.round(H * 0.04)] || 4);
  let cr = bot; while (cr > H * 0.08 && !(row[cr] > Math.max(trunkW * 3, maxW * 0.22))) cr--;
  cr = Math.min(bot - 2, cr + Math.round(H * 0.02));   // a copa desce um pouco sobre o topo do tronco (sem fresta ao balançar)
  const tc = makeCanvas(W, bot + 1 - cr), cc = makeCanvas(W, cr + 1);
  tc.getContext('2d').drawImage(c, 0, cr, W, bot + 1 - cr, 0, 0, W, bot + 1 - cr);
  cc.getContext('2d').drawImage(c, 0, 0, W, cr + 1, 0, 0, W, cr + 1);
  const topX = cen[cr] >= 0 ? cen[cr] : baseX;
  return { trunk: tc, tax: baseX, tay: tc.height, crown: cc, cax: topX, cay: cr + 1, topDx: topX - baseX,
    trunkH: (bot + 1 - cr) / (ppm * HZ), r: maxW / ppm / 2, res: VEG_RES, kind, leafColors, painted: true };
}

async function vegLoad() {
  let man = {};
  try { man = await (await fetch('assets/textures/manifest.json', { cache: 'no-cache' })).json(); } catch { return; }
  const ids = new Set(Object.values(VEG_POOLS).flat().filter(id => man[id] && man[id].files));
  if (!ids.size) return;
  const imgs = {};
  await Promise.all([...ids].map(async id => {
    imgs[id] = (await Promise.all(man[id].files.map(f => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'assets/textures/' + f; })))).filter(Boolean);
  }));
  // os pools nascem na montagem do mundo grande; espera por eles
  const apply = () => {
    if (typeof OW === 'undefined' || !OW.pools || typeof MIA === 'undefined' || !MIA.palms) return setTimeout(apply, 120);
    const pools = { coconut: MIA.palms.coconut, royal: MIA.palms.royal, oaks: OW.pools.oaks, pines: OW.pools.pines, bushes: OW.pools.bushes,
      hibiscus: MIA.bush.hibiscus, bougainvillea: MIA.bush.bougainvillea, croton: MIA.bush.croton, seagrape: MIA.bush.seagrape };
    for (const [name, list] of Object.entries(VEG_POOLS)) {
      const pool = pools[name], files = list.flatMap(id => (imgs[id] || []).map(im => [id, im]));
      if (!pool || !files.length) continue;
      const tree = !['bushes', 'hibiscus', 'bougainvillea', 'croton', 'seagrape'].includes(name);
      pool.forEach((sp, i) => {
        const [id, im] = files[i % files.length], kind = name === 'coconut' || name === 'royal' ? 'palm' : name === 'pines' ? 'pine' : 'oak';
        for (const key of Object.keys(sp)) delete sp[key];   // inclusive a sombra em cache (_shStamp)
        Object.assign(sp, vegSprite(im, man[id].height, tree, kind), name === 'coconut' || name === 'royal' ? { palm: name } : {});
      });
    }
  };
  apply();
}

vegLoad();
