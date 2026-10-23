// archi.js — estilos de casa e texturas procedurais de arquitetura (fachadas, portas, telhados).
// Tudo é pintado uma vez em canvas fora da tela, em metros * TEX px, e depois mapeado nas paredes
// e telhados com transformação afim (a projeção isométrica preserva paralelogramos).
'use strict';

const TEX = 40;    // px por metro nas texturas de parede/porta
const RTEX = 36;   // px por metro nas texturas de telhado

// ---------- utilidades de cor ----------
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function rgb(r, g, b, a = 1) { return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function jitter(hex, amt, rnd) { const [r, g, b] = hexToRgb(hex), k = 1 + (rnd() - 0.5) * amt; return rgb(r * k, g * k, b * k); }
function shadeHex(hex, k) { const [r, g, b] = hexToRgb(hex), h2 = v => Math.round(clamp(v * k, 0, 255)).toString(16).padStart(2, '0'); return '#' + h2(r) + h2(g) + h2(b); }

// ---------- estilos: variedade coerente entre casas ----------
// Arquitetura: paredes com luz quente e telhados ceramicos mais ricos,
// mantendo as texturas rachadas, manchas e alvenaria originais.
const PLASTERS = VISUAL_REFERENCE.architecture.plasters;
const TRIMS = VISUAL_REFERENCE.architecture.trims;
const DOORS = [['panel', '#765038'], ['panel', '#51392c'], ['metal', '#586268'], ['flush', '#96694d'], ['panel', '#34543f'], ['metal', '#3f505b']];
const CURTAINS = ['#cdb993', '#b76a58', '#72879b', '#e2d6c5', '#849962'];
const ROOF_MATS = VISUAL_REFERENCE.architecture.roofs;
function houseStyle(H, rnd) {
  const pick = a => a[(rnd() * a.length) | 0];
  const S = {
    plaster: H.brick ? '#9c4a3b' :
      H.rural?pick(['#9e8362','#a48e70','#99846c','#ac9470']):pick(PLASTERS), trim: pick(TRIMS), found: pick(['#7a756b', '#6e6a62', '#857f73']),
    door: H.brick ? ['glass', '#8d9399'] : pick(DOORS), curtains: rnd() < 0.6, curtain: pick(CURTAINS),
    aging: 0.25 + rnd() * 0.6, spout: rnd() < 0.5 ? 0 : 1, glassTint: pick(['#6f8ea6', '#5f7f96', '#7a93a3']),
    roofMat: H.roofKind === 'flat' ? 'concrete' :
      H.rural?pick(['shingle','metal','ceramic']):pick(['ceramic','ceramic','shingle','metal']),
    interior: pick(['#d8d2c4', '#cfd6d0', '#e0d4c0', '#c9cdd6', '#d6c8b8']),
  };
  S.roofCol = S.roofMat === 'concrete' ? VISUAL_REFERENCE.architecture.concrete : pick(ROOF_MATS[S.roofMat]);
  return S;
}

// ---------- reboco / tijolo ----------
function paintPlaster(g, x, y, w, h, col, rnd, aging) {
  g.fillStyle = col; g.fillRect(x, y, w, h);
  // variação tonal da pintura (manchas suaves grandes)
  for (let i = 0; i < w * h / 900; i++) {
    const cx = x + rnd() * w, cy = y + rnd() * h, r = 20 + rnd() * 60;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    const dark = rnd() < 0.5;
    gr.addColorStop(0, dark ? `rgba(60,50,40,${0.05 + aging * 0.05})` : 'rgba(255,250,235,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // grão do reboco
  for (let i = 0; i < w * h / 7; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)';
    g.fillRect(x + rnd() * w, y + rnd() * h, 1, 1);
  }
}
function paintBrick(g, x, y, w, h, col, rnd) {
  g.fillStyle = '#b9ad9c'; g.fillRect(x, y, w, h);   // argamassa
  const bh = 0.075 * TEX, bw = 0.22 * TEX;
  for (let r = 0, yy = y + h - bh; yy > y - bh; yy -= bh, r++) for (let xx = x - (r % 2) * bw / 2; xx < x + w; xx += bw) {
    g.fillStyle = jitter(col, 0.28, rnd); g.fillRect(xx + 1, yy + 1, bw - 1.5, bh - 1.5);
    g.fillStyle = 'rgba(255,230,210,0.12)'; g.fillRect(xx + 1, yy + 1, bw - 1.5, 1);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(xx + 1, yy + bh - 1.5, bw - 1.5, 1);
  }
}

// ---------- janela (em coordenadas de textura) ----------
function paintWindow(g, x0, x1, ytop, ybot, S, rnd, exterior, wide) {
  const fw = 0.07 * TEX, w = x1 - x0, h = ybot - ytop;
  // sombra projetada pela moldura na parede
  g.fillStyle = 'rgba(30,22,15,0.22)'; g.fillRect(x0 + 3, ytop + 3, w, h);
  // moldura com espessura (luz vem de cima/esquerda)
  g.fillStyle = S.trim; g.fillRect(x0, ytop, w, h);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x0, ytop, w, 1.5); g.fillRect(x0, ytop, 1.5, h);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0, ybot - 1.5, w, 1.5); g.fillRect(x1 - 1.5, ytop, 1.5, h);
  // vão recuado: faixa escura em cima e à esquerda (profundidade da parede)
  const gx0 = x0 + fw, gx1 = x1 - fw, gy0 = ytop + fw, gy1 = ybot - fw;
  g.fillStyle = 'rgba(25,20,18,0.55)'; g.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
  const ix0 = gx0 + 3, iy0 = gy0 + 3;
  // vidro
  const gr = g.createLinearGradient(0, iy0, 0, gy1);
  if (exterior) { gr.addColorStop(0, shadeHex(S.glassTint, 1.25)); gr.addColorStop(0.6, S.glassTint); gr.addColorStop(1, shadeHex(S.glassTint, 0.7)); }
  else { gr.addColorStop(0, '#cfe0ea'); gr.addColorStop(1, '#9fbccd'); }
  g.fillStyle = gr; g.fillRect(ix0, iy0, gx1 - ix0, gy1 - iy0);
  // cortinas vistas através do vidro
  if (S.curtains) {
    const cw = (gx1 - ix0) * (wide ? 0.18 : 0.26);
    for (const [cx, dir] of [[ix0, 1], [gx1 - cw, -1]]) {
      g.fillStyle = exterior ? shadeHex(S.curtain, 0.78) : S.curtain; g.fillRect(cx, iy0, cw, gy1 - iy0);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let k = 1; k < 4; k++) g.fillRect(cx + cw * k / 4, iy0, 1, gy1 - iy0);
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(cx + (dir > 0 ? cw - 2 : 0), iy0, 2, gy1 - iy0);
    }
  }
  // reflexos diagonais
  if (exterior) {
    g.save(); g.beginPath(); g.rect(ix0, iy0, gx1 - ix0, gy1 - iy0); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.16)';
    for (const o of [0.15, 0.55]) { const bx = ix0 + (gx1 - ix0) * o; g.beginPath(); g.moveTo(bx, iy0); g.lineTo(bx + 9, iy0); g.lineTo(bx - 14, gy1); g.lineTo(bx - 23, gy1); g.fill(); }
    g.restore();
  }
  // caixilhos
  g.fillStyle = S.trim;
  const mx = (gx0 + gx1) / 2, my = gy0 + (gy1 - gy0) * 0.45;
  g.fillRect(mx - 1.5, gy0, 3, gy1 - gy0); g.fillRect(gx0, my - 1.5, gx1 - gx0, 3);
  if (wide) { g.fillRect(gx0 + (gx1 - gx0) * 0.25 - 1, gy0, 2, gy1 - gy0); g.fillRect(gx0 + (gx1 - gx0) * 0.75 - 1, gy0, 2, gy1 - gy0); }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(mx + 1.5, gy0, 1, gy1 - gy0); g.fillRect(gx0, my + 1.5, gx1 - gx0, 1);
  // peitoril saliente + sombra embaixo + escorrido de sujeira
  const sx0 = x0 - 0.05 * TEX, sx1 = x1 + 0.05 * TEX, sy = ybot, sh = 0.07 * TEX;
  g.fillStyle = shadeHex(S.trim, 1.02); g.fillRect(sx0, sy, sx1 - sx0, sh * 0.45);
  g.fillStyle = shadeHex(S.trim, 0.78); g.fillRect(sx0, sy + sh * 0.45, sx1 - sx0, sh * 0.55);
  const sg = g.createLinearGradient(0, sy + sh, 0, sy + sh + 0.14 * TEX);
  sg.addColorStop(0, 'rgba(30,22,15,0.35)'); sg.addColorStop(1, 'rgba(30,22,15,0)');
  g.fillStyle = sg; g.fillRect(sx0 + 2, sy + sh, sx1 - sx0 - 2, 0.14 * TEX);
  if (exterior && S.shutters) {   // venezianas abertas ao lado do vão
    const sw = Math.max(5, w * 0.32);
    for (const sx of [x0 - sw - 2, x1 + 2]) {
      g.fillStyle = 'rgba(30,22,15,0.25)'; g.fillRect(sx + 2, ytop + 2, sw, h);
      g.fillStyle = S.shutters; g.fillRect(sx, ytop, sw, h);
      g.fillStyle = 'rgba(0,0,0,0.22)'; for (let yy = ytop + 3; yy < ybot - 1; yy += 4) g.fillRect(sx + 1, yy, sw - 2, 1);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.strokeRect(sx + 0.5, ytop + 0.5, sw - 1, h - 1);
    }
  }
  if (exterior && S.boarded && rnd() < 0.3) {   // compensado pregado no vão (casa abandonada)
    g.fillStyle = '#b08d5c'; g.fillRect(x0 + 2, ytop + 2, w - 4, h - 4);
    g.fillStyle = 'rgba(80,55,30,0.35)'; for (let yy = ytop + 6; yy < ybot - 4; yy += 7) g.fillRect(x0 + 2, yy, w - 4, 1);
    g.fillStyle = 'rgba(60,40,20,0.5)'; g.fillRect(x0 + 2, ytop + h * 0.5, w - 4, 2);
    g.fillStyle = '#3a3a3a'; for (const px of [x0 + 5, x1 - 7]) for (const py of [ytop + 5, ybot - 7]) g.fillRect(px, py, 2, 2);
    return;
  }
  if (exterior && S.bars) {   // grade de ferro (bairros pobres de Miami)
    g.fillStyle = '#2a2a2c'; for (let bx = x0 + 4; bx < x1 - 2; bx += 0.11 * TEX) g.fillRect(bx, ytop + 2, 2, h - 4);
    g.fillRect(x0 + 2, ytop + h * 0.33, w - 4, 2); g.fillRect(x0 + 2, ytop + h * 0.66, w - 4, 2);
    g.fillStyle = 'rgba(255,255,255,0.15)'; for (let bx = x0 + 4; bx < x1 - 2; bx += 0.11 * TEX) g.fillRect(bx, ytop + 2, 0.7, h - 4);
  }
  if (exterior && S.aging > 0.45) for (const ex of [sx0 + 4, sx1 - 6]) {
    const dg = g.createLinearGradient(0, sy + sh, 0, sy + sh + 0.5 * TEX);
    dg.addColorStop(0, `rgba(70,58,40,${S.aging * 0.25})`); dg.addColorStop(1, 'rgba(70,58,40,0)');
    g.fillStyle = dg; g.fillRect(ex, sy + sh, 3, 0.5 * TEX);
  }
}

// ---------- fachada de um lado inteiro da casa ----------
// segs: pedaços desse lado (com idx); Hc: altura total da textura (inclui empena/platibanda)
function paintFacade(H, side, exterior, rnd) {
  if (H.facadeFn) { const fc = H.facadeFn(H, side, exterior, rnd, false); if (fc) return fc; }
  const S = H.style, sd = H.sides[side], L = sd.len, Hc = sd.Hc, W = L * TEX, Hp = Math.ceil(Hc * TEX);
  const c = makeCanvas(W, Hp), g = c.getContext('2d');
  const Y = z => (Hc - z) * TEX, X = u => u * TEX;
  const segs = H.segs.filter(s => s.side === side).sort((a, b) => a.idx - b.idx);
  if (exterior) {
    if (H.brick) paintBrick(g, 0, 0, W, Hp, S.plaster, rnd);
    else paintPlaster(g, 0, 0, W, Hp, S.plaster, rnd, S.aging);
    if(H.rural){
      // Tábuas envelhecidas com juntas, fibras, pregos e irregularidades.
      for(let y=0;y<Hp;y+=.27*TEX){
        g.fillStyle='rgba(33,24,17,.32)';
        g.fillRect(0,y,W,Math.max(1,.020*TEX));
        g.fillStyle='rgba(242,218,182,.12)';g.fillRect(0,y+1,W,1.2);
        const shift=Math.round(rnd()*TEX*1.2);
        for(let x=shift;x<W;x+=2.2*TEX){
          g.fillStyle='rgba(38,28,20,.20)';g.fillRect(x,y+2,1,.27*TEX-3);
          g.fillStyle='#5e5549';g.fillRect(x+3,y+3,1.5,1.5);
        }
        for(let j=0;j<Math.max(2,Math.floor(L));j++){
          const x=rnd()*W;
          g.fillStyle='rgba(58,40,24,.16)';
          g.fillRect(x,y+3,.9,.08*TEX);
        }
      }
      g.fillStyle='rgba(35,26,18,.24)';
      g.fillRect(0,Hp-9,W,9);
    }
    // quinas com acabamento (pilares) e sombra interna
    for (const ux of [0, L - 0.14]) {
      g.fillStyle = H.brick ? '#b4a99a' : shadeHex(S.plaster, 1.07); g.fillRect(X(ux), 0, 0.14 * TEX, Hp);
      g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(ux === 0 ? X(0.14) : X(ux) - 2, 0, 2, Hp);
    }
    // faixa de acabamento (cornija) logo abaixo do beiral/platibanda
    const zc = H.h - 0.26;
    g.fillStyle = S.trim; g.fillRect(0, Y(zc + 0.12), W, 0.12 * TEX);
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, Y(zc + 0.12), W, 1.5);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, Y(zc), W, 2);
    if (H.roofKind === 'flat') {   // pingadeira no topo da platibanda
      g.fillStyle = '#bdb8ad'; g.fillRect(0, 0, W, 0.06 * TEX);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0.06 * TEX, W, 2);
    } else {   // sombra de contato do beiral sobre a parede
      const sg = g.createLinearGradient(0, Y(H.h), 0, Y(H.h - 0.7));
      sg.addColorStop(0, 'rgba(20,15,10,0.5)'); sg.addColorStop(1, 'rgba(20,15,10,0)');
      g.fillStyle = sg; g.fillRect(0, Y(H.h), W, 0.7 * TEX);
    }
    // fundação de concreto + rodapé
    g.fillStyle = S.found; g.fillRect(0, Y(0.3), W, 0.3 * TEX);
    for (let i = 0; i < W * 2; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'; g.fillRect(rnd() * W, Y(0.3) + rnd() * 0.3 * TEX, 1, 1); }
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, Y(0.3), W, 2);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, Y(0.3) + 2, W, 1.5);
    // sujeira subindo do chão
    const dg = g.createLinearGradient(0, Y(0.3), 0, Y(1.1));
    dg.addColorStop(0, `rgba(80,62,40,${0.18 + S.aging * 0.22})`); dg.addColorStop(1, 'rgba(80,62,40,0)');
    g.fillStyle = dg; g.fillRect(0, Y(1.1), W, 0.8 * TEX);
    for (let i = 0; i < L * 3 * S.aging; i++) { g.fillStyle = `rgba(70,55,35,${0.1 + rnd() * 0.15})`; g.fillRect(rnd() * W, Y(0.3 + rnd() * 0.35), 1 + rnd() * 2, 2 + rnd() * 6); }
    // trincas finas
    g.strokeStyle = 'rgba(40,32,26,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < L * S.aging * 0.6; i++) {
      let x = rnd() * W, y = Y(0.4 + rnd() * (H.h - 0.8)); g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 8; y += 3 + rnd() * 5; g.lineTo(x, y); } g.stroke();
    }
  } else {
    paintPlaster(g, 0, 0, W, Hp, S.interior, rnd, 0.1);
    g.fillStyle = '#6b4a32'; g.fillRect(0, Y(0.12), W, 0.12 * TEX);   // rodapé de madeira
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, Y(0.12), W, 1);
    const sg = g.createLinearGradient(0, Y(H.h), 0, Y(H.h - 0.4)); sg.addColorStop(0, 'rgba(0,0,0,0.22)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg; g.fillRect(0, Y(H.h), W, 0.4 * TEX);
  }
  // aberturas
  for (const s of segs) {
    const u = s.idx;
    if (s.window) {
      const big = H.brick && exterior && side === H.frontSide;
      if (big) paintWindow(g, X(u + 0.06), X(u + 0.94), Y(2.35), Y(0.55), S, rnd, exterior, false);
      else paintWindow(g, X(u + 0.15), X(u + 0.85), Y(2.05), Y(0.95), S, rnd, exterior, false);
    }
    // Janelas do andar superior: mesmo acabamento realista, mas alinhadas
    // acima das vergas terreas. A porta permanece exclusivamente no piso 0.
    if (H.storeys === 2 && s.idx % 3 !== 0) {
      paintWindow(g,X(s.idx+.17),X(s.idx+.83),
        Y(H.floorHeight+2.12),Y(H.floorHeight+.95),
        S,rnd,exterior,false);
    }
    if (s.door) {   // batente em volta do vão (o vão em si não é desenhado)
      const x0 = X(u + 0.1), x1 = X(u + 0.9), yt = Y(2.12), fw = 0.08 * TEX;
      g.fillStyle = 'rgba(30,22,15,0.25)'; g.fillRect(x0 - fw + 3, yt - fw + 3, x1 - x0 + fw * 2, Y(0) - yt);
      g.fillStyle = S.trim; g.fillRect(x0 - fw, yt - fw, fw, Y(0) - yt + fw); g.fillRect(x1, yt - fw, fw, Y(0) - yt + fw); g.fillRect(x0 - fw, yt - fw, x1 - x0 + fw * 2, fw);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x0 - fw, yt - fw, x1 - x0 + fw * 2, 1.5);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x1 + fw - 1.5, yt - fw, 1.5, Y(0) - yt + fw);
      if (exterior && side === H.frontSide) {
        // arandela ao lado da porta
        const lx = X(u + (u + 1.3 < L ? 1.2 : -0.2)), ly = Y(1.95);
        g.fillStyle = '#2a2826'; g.fillRect(lx - 3, ly - 2, 6, 14);
        g.fillStyle = '#f2e6c4'; g.fillRect(lx - 4, ly - 10, 8, 9);
        g.fillStyle = '#2a2826'; g.fillRect(lx - 5, ly - 12, 10, 3);
        H.wallLamp = [u + (u + 1.3 < L ? 1.2 : -0.2), 1.95];
        // caixa de entrada de energia + eletroduto
        if (u > 1.2 && !H.brick) {
          const mx = X(u - 0.75), my = Y(1.65);
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(mx + 2, my + 2, 0.32 * TEX, 0.42 * TEX);
          g.fillStyle = '#8d9196'; g.fillRect(mx, my, 0.32 * TEX, 0.42 * TEX);
          g.fillStyle = '#a9adb2'; g.fillRect(mx, my, 0.32 * TEX, 2);
          g.fillStyle = '#3b4248'; g.fillRect(mx + 3, my + 5, 0.32 * TEX - 6, 5);
          g.fillStyle = '#6f7378'; g.fillRect(mx + 0.13 * TEX, 0, 3, my);
        }
      }
    }
  }
  // tubulação de descida da calha (lados com beiral)
  if (exterior && !H.brick && sd.eave) {
    const px = X(S.spout ? L - 0.32 : 0.24), pw = 0.08 * TEX;
    const pg = g.createLinearGradient(px, 0, px + pw, 0);
    pg.addColorStop(0, '#d9dbdc'); pg.addColorStop(0.4, '#f2f3f3'); pg.addColorStop(1, '#8e9396');
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(px + 3, Y(H.h - 0.05), pw, Y(0.12) - Y(H.h - 0.05));
    g.fillStyle = pg; g.fillRect(px, Y(H.h - 0.05), pw, Y(0.12) - Y(H.h - 0.05));
    g.fillRect(px - 3, Y(0.16), pw + 8, 0.1 * TEX);   // cotovelo
    g.fillStyle = '#7a7f82'; for (let z = 0.6; z < H.h - 0.3; z += 0.8) g.fillRect(px - 2, Y(z), pw + 4, 3);   // abraçadeiras
  }
  // luz do sol assada na textura (a normal de cada lado é fixa no mundo)
  const n = LOCAL_SIDES[side].n;
  bakeLight(g, W, Hp, exterior ? [n[0], n[1], 0] : [-n[0], -n[1], 0], H.miaKind ? 0.45 : 0.75);   // Miami: muita luz rebatida no reboco claro
  return c;
}
function bakeLight(g, W, Hh, n, k = 1) {
  const lit = V.dot(V.norm(n), SUN);
  g.fillStyle = lit < 0.55 ? `rgba(16,14,34,${clamp((0.55 - lit) * 0.55 * k, 0, 0.6)})` : `rgba(255,236,196,${clamp((lit - 0.55) * 0.35 * k, 0, 0.2)})`;
  g.fillRect(0, 0, W, Hh);
}

// ---------- folha da porta ----------
function paintDoor(style, col, rnd) {
  const W = 0.82 * TEX, Hd = 2.05 * TEX, c = makeCanvas(W, Hd), g = c.getContext('2d');
  if (style === 'glass') {
    g.fillStyle = '#8d9399'; g.fillRect(0, 0, W, Hd);
    const gr = g.createLinearGradient(0, 0, 0, Hd); gr.addColorStop(0, '#9fbfd0'); gr.addColorStop(1, '#5f7f92');
    g.fillStyle = gr; g.fillRect(4, 4, W - 8, Hd - 8);
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.moveTo(10, 4); g.lineTo(20, 4); g.lineTo(6, 40); g.lineTo(4, 30); g.fill();
    g.fillStyle = '#c0c4c8'; g.fillRect(W - 10, Hd * 0.45, 4, 26);
    return c;
  }
  g.fillStyle = col; g.fillRect(0, 0, W, Hd);
  if (style === 'metal') {
    for (let y = 6; y < Hd; y += 9) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(3, y, W - 6, 1.5); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(3, y + 1.5, W - 6, 1); }
    g.fillStyle = '#2a3036'; g.fillRect(W * 0.25, Hd * 0.12, W * 0.5, Hd * 0.18);
    g.fillStyle = '#7f9bb0'; g.fillRect(W * 0.25 + 2, Hd * 0.12 + 2, W * 0.5 - 4, Hd * 0.18 - 4);
    g.fillStyle = '#c8cbcf'; g.fillRect(W - 11, Hd * 0.5, 8, 3);
  } else {
    // veio da madeira
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,230,200'},0.07)`; g.fillRect(rnd() * W, 0, 1, Hd); }
    if (style === 'panel') {
      const pw = (W - 0.18 * TEX) / 2, ph = (Hd - 0.3 * TEX) / 3;
      for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) {
        const x = 0.06 * TEX + k * (pw + 0.06 * TEX), y = 0.08 * TEX + r * (ph + 0.07 * TEX);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y, pw, ph);
        g.fillStyle = shadeHex(col, 1.08); g.fillRect(x + 2, y + 2, pw - 3, ph - 3);
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x + 2, y + 2, pw - 3, 1);
      }
    }
    g.fillStyle = '#c9a54a'; g.beginPath(); g.arc(W - 9, Hd * 0.52, 3, 0, TAU); g.fill();
    g.fillStyle = '#7a6020'; g.fillRect(W - 10, Hd * 0.52 + 4, 2, 4);
  }
  g.fillStyle = '#3a3836'; for (const y of [0.15, 0.5, 0.85]) g.fillRect(0, Hd * y, 3, 8);   // dobradiças
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(W - 2, 0, 2, Hd); g.fillRect(0, Hd - 2, W, 2);
  return c;
}

// ---------- texturas de telhado (a = ao longo do beiral, b = subindo a água) ----------
function paintRoofTex(mat, col, A, B, rnd, aging) {
  const W = Math.ceil(A * RTEX), Hh = Math.ceil(B * RTEX), c = makeCanvas(W, Hh), g = c.getContext('2d');
  if (mat === 'ceramic') {
    // fileiras de telha colonial: das de baixo p/ as de cima (a de cima sobrepõe a de baixo)
    const rowH = 0.3 * RTEX, tw = 0.22 * RTEX;
    g.fillStyle = shadeHex(col, 0.55); g.fillRect(0, 0, W, Hh);
    for (let r = 0, y = Hh - rowH; y > -rowH; y -= rowH, r++) {
      for (let x = -(r % 2) * tw / 2; x < W; x += tw) {
        const k = 0.86 + rnd() * 0.26, base = hexToRgb(col).map(v => clamp(v * k, 0, 255));
        const gr = g.createLinearGradient(x, 0, x + tw, 0);
        gr.addColorStop(0, rgb(...base.map(v => v * 0.82))); gr.addColorStop(0.35, rgb(...base.map(v => v * 1.12)));
        gr.addColorStop(0.7, rgb(...base)); gr.addColorStop(1, rgb(...base.map(v => v * 0.62)));
        g.fillStyle = gr; g.beginPath(); g.roundRect(x + 0.5, y, tw - 1, rowH + 3, [2, 2, 5, 5]); g.fill();
      }
      // sombra que a fileira de cima projeta nesta + lábio claro da borda
      g.fillStyle = 'rgba(30,12,6,0.45)'; g.fillRect(0, y + rowH, W, 3);
      g.fillStyle = 'rgba(255,220,190,0.18)'; g.fillRect(0, y + rowH - 1, W, 1);
    }
  } else if (mat === 'shingle') {
    const rowH = 0.24 * RTEX, tab = 0.34 * RTEX;
    g.fillStyle = shadeHex(col, 0.7); g.fillRect(0, 0, W, Hh);
    for (let r = 0, y = Hh - rowH; y > -rowH; y -= rowH, r++) {
      for (let x = -(r % 2) * tab / 2; x < W; x += tab) { g.fillStyle = jitter(col, 0.18, rnd); g.fillRect(x + 0.5, y, tab - 1, rowH + 2); }
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, y + rowH, W, 2);
    }
    for (let i = 0; i < W * Hh / 6; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'; g.fillRect(rnd() * W, rnd() * Hh, 1, 1); }
  } else if (mat === 'metal') {
    // telha ondulada: frisos descendo a água, juntas horizontais e parafusos
    const p = 0.12 * RTEX;
    for (let x = 0; x < W; x += p) {
      const gr = g.createLinearGradient(x, 0, x + p, 0);
      gr.addColorStop(0, shadeHex(col, 0.72)); gr.addColorStop(0.3, shadeHex(col, 1.18)); gr.addColorStop(0.55, shadeHex(col, 1.0)); gr.addColorStop(1, shadeHex(col, 0.72));
      g.fillStyle = gr; g.fillRect(x, 0, p + 0.5, Hh);
    }
    for (let y = Hh - 2.2 * RTEX; y > 0; y -= 2.2 * RTEX) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, W, 2); g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, y + 2, W, 1); }
    g.fillStyle = 'rgba(40,40,40,0.6)';
    for (let y = Hh - 0.15 * RTEX; y > 0; y -= 1.1 * RTEX) for (let x = p * 0.45; x < W; x += p * 2) g.fillRect(x, y, 1.5, 1.5);
    for (let i = 0; i < A * aging * 1.5; i++) {   // escorridos de ferrugem
      const x = rnd() * W, y = rnd() * Hh * 0.6, l = (0.3 + rnd() * 0.8) * RTEX;
      const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(130,70,30,0.35)'); gr.addColorStop(1, 'rgba(130,70,30,0)');
      g.fillStyle = gr; g.fillRect(x, y, 2 + rnd() * 3, l);
    }
  } else {   // laje de concreto
    g.fillStyle = col; g.fillRect(0, 0, W, Hh);
    for (let i = 0; i < W * Hh / 4; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'; g.fillRect(rnd() * W, rnd() * Hh, 1 + rnd(), 1 + rnd()); }
    for (let i = 0; i < A * B / 6; i++) {   // manchas de umidade
      const x = rnd() * W, y = rnd() * Hh, r = (0.4 + rnd() * 1.2) * RTEX;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(50,48,40,${0.12 + aging * 0.12})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.strokeStyle = 'rgba(40,38,34,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < A * B / 10; i++) { let x = rnd() * W, y = rnd() * Hh; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 14; y += (rnd() - 0.5) * 14; g.lineTo(x, y); } g.stroke(); }
  }
  // desgaste geral: musgo/sujeira concentrado perto do beiral
  if (mat !== 'concrete') for (let i = 0; i < A * B * aging * 0.8; i++) {
    const x = rnd() * W, y = Hh - Math.pow(rnd(), 1.8) * Hh, r = (0.15 + rnd() * 0.45) * RTEX;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, mat === 'ceramic' && rnd() < 0.5 ? 'rgba(70,80,40,0.22)' : 'rgba(30,25,20,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

// ---------- cilindro (caixa d'água, tubos de ventilação) ----------
function drawCyl(g, x, y, z, r, h, col, lid) {
  const s = cam.zoom, b = proj(x, y, z), t = proj(x, y, z + h), rx = r * s, ry = r * s * TILT;
  const gr = g.createLinearGradient(b.x - rx, 0, b.x + rx, 0);
  gr.addColorStop(0, shadeHex(col, 1.15)); gr.addColorStop(0.35, shadeHex(col, 1.05)); gr.addColorStop(1, shadeHex(col, 0.55));
  g.fillStyle = gr;
  g.beginPath(); g.ellipse(b.x, b.y, rx, ry, 0, 0, Math.PI); g.lineTo(t.x - rx, t.y); g.ellipse(t.x, t.y, rx, ry, 0, Math.PI, 0, true); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(20,16,14,0.7)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = lid || shadeHex(col, 1.2); g.beginPath(); g.ellipse(t.x, t.y, rx, ry, 0, 0, TAU); g.fill(); g.stroke();
}
