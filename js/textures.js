// textures.js — texturas pintadas (geradas pelo Nano Banana em tools/gemini e aprovadas pelo juiz) aplicadas no
// chão por terrain.js. Cada textura é reamostrada uma vez na resolução do chão (TP px/m) e lida por pixel, com
// volta (repete sem costura). Enquanto não carregam, o chão continua procedural; quando ficam prontas, os blocos
// já pintados são descartados e repintados com elas.
'use strict';

// material do chão -> asset do catálogo (tools/gemini/catalog.mjs). Só carrega o que está em assets/textures/manifest.json
// (as aprovadas, instaladas por tools/gemini/install.mjs), com a largura real em metros gravada lá.
const TEX_FILES = {
  lawn: 'ground-lawn', weeds: 'ground-weeds', sand: 'ground-sand', dirt: 'ground-dirt',
  asphalt: 'ground-asphalt', walk: 'ground-sidewalk', walkPink: 'ground-sidewalk-pink', concrete: 'ground-concrete-worn',
};
const GTEX = { ready: false, t: {} };

async function texLoad() {
  let man = {};
  try { man = await (await fetch('assets/textures/manifest.json', { cache: 'no-cache' })).json(); } catch { return; }
  const entries = Object.entries(TEX_FILES).filter(([, id]) => man[id]);
  let left = entries.length;
  if (!left) return;
  const done = () => {
    if (--left) return;
    GTEX.ready = Object.keys(GTEX.t).length > 0;
    if (GTEX.ready && typeof terrain !== 'undefined') terrain.chunks.clear();   // repinta o chão com as texturas
  };
  for (const [key, file] of entries) {
    const meters = man[file].meters;
    const img = new Image();
    img.onload = () => {
      const n = Math.round(meters * TP), c = makeCanvas(n, n), g = c.getContext('2d');
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, n, n);
      GTEX.t[key] = { n, data: g.getImageData(0, 0, n, n).data };
      done();
    };
    img.onerror = () => { console.warn('textura ausente:', file); done(); };
    img.src = 'assets/textures/' + file + '.webp';
  }
}

// cor da textura no ponto (px do chão, TP px/m) -> out[0..2]; devolve false se a textura não existe
function texAt(key, gx, gy, out) {
  const T = GTEX.t[key]; if (!T) return false;
  const n = T.n, x = ((gx % n) + n) % n, y = ((gy % n) + n) % n, o = (y * n + x) * 4, d = T.data;
  out[0] = d[o]; out[1] = d[o + 1]; out[2] = d[o + 2];
  return true;
}

texLoad();
