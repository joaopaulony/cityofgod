// world.js — mapa, chão pintado uma vez fora da tela, sprites de vegetação/pedras e colisão.
'use strict';

// Mapa 4× maior em ÁREA: 80×80 m -> 160×160 m (2× em cada eixo).
// Limite a textura a <=3840px por lado; 4480px pode estourar o limite do
// Canvas 2D em dispositivos móveis. Sprites mantêm SPR=40 independente do chão.
const ORIGINAL_MAP = 80;
const WORLD_AREA_MULTIPLIER = 4;
// Mundo grande (padrão): mapa fixo do js/worldgen, carregado em setores (js/openworld.js).
// ?seed=N ou ?scene=... abrem o mapa local de teste (160 m) — é o que a tecla G e os testes usam.
const OPEN_WORLD = typeof COG !== 'undefined' && typeof location !== 'undefined' && !/[?&](seed|scene)=/.test(location.search);
const MAP = OPEN_WORLD ? COG.WORLD_W : ORIGINAL_MAP * Math.sqrt(WORLD_AREA_MULTIPLIER);
const PPM = (typeof RS !== 'undefined' && RS === 2) ? 20 : 24; // safe for standalone sprite lab
const SPR = 40;      // pixels por metro dos sprites pré-pintados
// semente: ?seed=123 na URL reproduz o mesmo mapa; sem ela, cada visita gera um mapa novo
const SEED = Number(new URLSearchParams(location.search).get('seed')) || ((Math.random() * 1e6) | 0);
// rng global trocável: cada setor do mundo grande sorteia com a própria semente (mesmo resultado em
// qualquer ordem de carregamento); fora disso, a sequência é a da semente do mapa.
let rngCur = mulberry(SEED);
const rng = () => rngCur();
function withRng(r, fn) { const prev = rngCur; rngCur = r; try { return fn(); } finally { rngCur = prev; } }
const R = (a, b) => a + rng() * (b - a);

const world = {
  ground: null, props: [], circles: [], segs: [], boxes: [], lamps: [], trafficSignals: [], roads: [], yards: [], trails: [], seed: SEED,
};

// ---------- ruído de valor (fbm) p/ terreno orgânico ----------
const PERM = new Uint8Array(512);
{ const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a, b) => PERM[(PERM[a & 255] + b) & 511] / 255;
  const u = smooth(xf), v = smooth(yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
function fbm(x, y, oct = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += vnoise(x * f, y * f) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; }
const forest = (x, y) => world.forestFn ? world.forestFn(x, y) : fbm(x * 0.05 + 31.7, y * 0.05 + 7.3);

// ---------- ruas curvas (Catmull-Rom) e campo de distância ----------
const ROAD_W = 3.5, SIDE = 2;   // meia largura do asfalto e largura da calçada
function catmull(ctrl, step = 0.5) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(ctrl[ctrl.length - 1].slice());
  return out;
}
function withNormals(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return { x: p[0], y: p[1], tx: dx / l, ty: dy / l, nx: -dy / l, ny: dx / l };
  });
}
function genRoads() {
  // avenida principal atravessando o mapa de oeste a leste, serpenteando
  const y0 = R(MAP * 0.5, MAP * 0.68), main = [[-6, y0]];
  for (let x = 10; x < MAP; x += R(14, 20)) main.push([x, clamp(main[main.length - 1][1] + R(-7, 7), MAP * 0.42, MAP * 0.8)]);
  main.push([MAP + 6, main[main.length - 1][1] + R(-3, 3)]);
  const M = withNormals(catmull(main));
  world.roads.push({ pts: M });
  // rua secundária saindo da avenida p/ o norte (e às vezes p/ o sul)
  const j = M[Math.floor(M.length * R(0.45, 0.72))];
  world.junction = j;
  const branch = dir => {
    const c = [[j.x, j.y], [j.x + R(-2, 2), j.y + dir * 10]];
    while (dir < 0 ? c[c.length - 1][1] > -6 : c[c.length - 1][1] < MAP + 6) {
      const l = c[c.length - 1]; c.push([clamp(l[0] + R(-8, 8), 10, MAP - 10), l[1] + dir * R(13, 18)]);
    }
    world.roads.push({ pts: withNormals(catmull(c)), branch: true });
  };
  branch(-1);
  if (rng() < 0.55) branch(1);
  // campo de distância até a rua mais próxima (grade de 0,5 m)
  const N = MAP * 2, D = new Float32Array(N * N).fill(99);
  for (const r of world.roads) for (const p of r.pts) {
    const ci = Math.round(p.x * 2), cj = Math.round(p.y * 2);
    for (let j2 = cj - 26; j2 <= cj + 26; j2++) for (let i2 = ci - 26; i2 <= ci + 26; i2++) {
      if (i2 < 0 || j2 < 0 || i2 >= N || j2 >= N) continue;
      const d = Math.hypot(i2 / 2 - p.x, j2 / 2 - p.y), k = j2 * N + i2;
      if (d < D[k]) D[k] = d;
    }
  }
  world.roadD = D;
}
function roadDist(x, y) {
  if (world.roadDistFn) return world.roadDistFn(x, y);
  const N = MAP * 2, i = clamp(Math.round(x * 2), 0, N - 1), j = clamp(Math.round(y * 2), 0, N - 1);
  return world.roadD[j * N + i];
}
function onRoad(x, y) { return roadDist(x, y) < ROAD_W + SIDE + 0.3; }

// ---------- lago com margem irregular ----------
function genPond() {
  let best = null;
  for (let i = 0; i < 300; i++) {
    const x = R(10, MAP - 10), y = R(10, MAP - 10), d = roadDist(x, y);
    if (d < 15) continue;
    const s = d + rng() * 4;
    if (!best || s > best.s) best = { x, y, s };
  }
  if (best) world.pond = { x: best.x, y: best.y, rx: R(4, 6.5), ry: R(3, 5) };
}
function pondVal(x, y) {
  if (world.pondFn) return world.pondFn(x, y);
  const p = world.pond; if (!p) return 9;
  return Math.hypot((x - p.x) / p.rx, (y - p.y) / p.ry) + (fbm(x * 0.35, y * 0.35, 3) - 0.5) * 0.7;
}
const isWater = (x, y) => pondVal(x, y) < 1;

// ---------- chão ----------
// O chão detalhado é pintado por blocos em terrain.js. Aqui fica a camada de sombras assadas
// (world.groundCtx, PPM px/m, transparente) e o minimapa (world.ground, world.groundPPM px/m).
function paintGround() {
  const sc = makeCanvas(MAP * PPM, MAP * PPM);
  world.groundCtx = sc.getContext('2d');
  terrainInit();
  world.ground = terrain.mini; world.groundPPM = MINI;
}

// sombras assadas no chão (giram junto com o mapa porque a luz é do mundo)
function bakeShadow(x, y, rx, ry, h) {
  const g = world.groundCtx, k = h * 0.28;
  g.fillStyle = 'rgba(20,28,10,0.32)';
  g.beginPath();
  g.ellipse((x - SUN[0] * k) * PPM, (y - SUN[1] * k) * PPM, rx * PPM, ry * PPM, 0.6, 0, TAU);
  g.fill();
}

// Sombra orgânica pré-pintada: contato no tronco + luz filtrada entre folhas.
// Não cria gradientes pesados por quadro, apenas durante a geração do mapa.
function bakeTreeShadow(x,y,sp) {
  const g=world.groundCtx;
  const h=sp.trunkH+sp.r*.55,sx=x-SUN[0]*h*.32,sy=y-SUN[1]*h*.32;
  const cx=sx*PPM,cy=sy*PPM,rx=sp.r*PPM*.98,ry=sp.r*PPM*.65;
  g.save();
  // Faixa de penumbra mais natural, várias massas sobrepostas.
  for(let layer=4;layer>=1;layer--){
    const fade=[.07,.065,.04,.028][layer-1];
    g.fillStyle='rgba(15,27,9,'+fade+')';
    g.beginPath();g.ellipse(cx,cy,rx*(layer*.24),ry*(layer*.25),-.25,0,TAU);g.fill();
  }
  // Centenas de pequenos vazios de luz filtrada na sombra da copa.
  for(let i=0;i<190;i++){
    const a=rng()*TAU,d=Math.sqrt(rng()),px=cx+Math.cos(a)*rx*d,py=cy+Math.sin(a)*ry*d;
    const sz=R(2,8);
    g.fillStyle=i%4===0?'rgba(35,48,15,.13)':'rgba(14,24,9,.10)';
    g.beginPath();g.ellipse(px,py,sz,sz*R(.35,.85),a,0,TAU);g.fill();
  }
  // Occlusão ambiente junto à raiz em vez de tronco flutuando.
  for(let i=3;i>=1;i--){
    g.fillStyle='rgba(10,22,8,'+(i===1?.22:.10)+')';
    g.beginPath();g.ellipse(x*PPM,y*PPM,PPM*(.12+i*.10),PPM*(.08+i*.058),0,0,TAU);g.fill();
  }
  g.restore();
}

// ---------- sprites pintados uma vez ----------
// ---- Vegetação orgânica: copas com ramificações, folhagem em camadas e folhas reais.
// Tudo é pré-renderizado em sprites Canvas 2D, sem imagens externas.
// Cada variante consome somente o RNG do gerador durante a criação do mundo.
// Seis tons por espécie: sombra > meio-tom > borda iluminada.
// Nunca use tons ciano/cinza nas coníferas; o contraste vem de verdes naturais.
// Mesmo desenho de cada folha e agulha, com a gama de 6 tons
// da imagem aprovada: verdes profundos, medios vivos e luz dourada.
const LEAF_PALETTES = VISUAL_REFERENCE.canopy;
const NEEDLE_PALETTES = VISUAL_REFERENCE.needles;

// Folha lanceolada, desenhada como forma e não como pixel aleatório.
// As copas são formadas exclusivamente por folhas/agulhas individuais. NÃO
// preenchê-las com círculos ou elipses: o espaço negativo entre as folhas é
// parte importante da silhueta. As formas são calculadas só no pré-render.
// Único contorno de folha compartilhado pela copa, arbustos e partículas.
function traceLeaf(g,x,y,len,angle) {
  const c=Math.cos(angle),sn=Math.sin(angle),h=len*.5,w=len*.235;
  const ex=c*h,ey=sn*h,nx=-sn*w,ny=c*w;
  g.moveTo(x-ex,y-ey);
  g.quadraticCurveTo(x-c*len*.12+nx,y-sn*len*.12+ny,x+ex,y+ey);
  g.quadraticCurveTo(x+c*len*.05-nx,y+sn*len*.05-ny,x-ex,y-ey);
}
function paintLeaf(g,x,y,len,angle,color,vein=false) {
  g.fillStyle=color;g.beginPath();traceLeaf(g,x,y,len,angle);g.fill();
  if(vein&&len>3.1){
    const c=Math.cos(angle),sn=Math.sin(angle);
    g.strokeStyle='rgba(230,232,177,.32)';g.lineWidth=.58;g.beginPath();
    g.moveTo(x-c*len*.28,y-sn*len*.28);
    g.lineTo(x+c*len*.31,y+sn*len*.31);g.stroke();
  }
}
// Agrupa milhares de folhas de mesma cor em UM preenchimento por camada.
// Evita 100 mil fill() isolados durante o pré-render de cada sprite.
// NUNCA enviar 100 mil curvas para o mesmo fill(): os backends de Canvas
// podem descartar caminhos gigantes por limites de tesselação/rasterização.
// Quebra em blocos seguros de até 256 folhas sem perder a densidade.
const LEAF_BATCH_SIZE = 256;
function leafBatch(g, buckets, palette) {
  for(let tone=0;tone<palette.length;tone++){
    const entries=buckets[tone];
    if(!entries.length)continue;
    g.fillStyle=palette[tone];
    const step=LEAF_BATCH_SIZE*4;
    for(let begin=0;begin<entries.length;begin+=step){
      const end=Math.min(entries.length,begin+step);
      g.beginPath();
      for(let i=begin;i<end;i+=4)
        traceLeaf(g,entries[i],entries[i+1],entries[i+2],entries[i+3]);
      g.fill();
    }
  }
}
function woodyBranch(g, x0,y0,x1,y1,width) {
  const mx=(x0+x1)*.52, my=(y0+y1)*.52-3;
  g.lineCap='round';g.strokeStyle='#493927';g.lineWidth=width;
  g.beginPath();g.moveTo(x0,y0);g.quadraticCurveTo(mx,my,x1,y1);g.stroke();
  if(width>2) {
    g.strokeStyle='rgba(160,122,73,.45)';g.lineWidth=Math.max(.7,width*.24);
    g.beginPath();g.moveTo(x0-1,y0);g.quadraticCurveTo(mx-1,my,x1-1,y1);g.stroke();
  }
}
// Tronco das árvores largas: diâmetro quase constante (topo = 89% da base),
// bordas levemente sinuosas e casca em veios contínuos. Pinheiros preservados.
function paintBroadleafTrunk(g,cx,by,height,width) {
  const base=width*.50, mid=base*.955, tip=base*.89, top=by-height;
  // Curvatura contida para manter a aparência de tronco cilíndrico.
  const lean=R(-width*.035,width*.035);
  const outline=()=>{
    g.beginPath();
    g.moveTo(cx-base,by);
    g.bezierCurveTo(cx-base-.15,by-height*.23,
      cx-mid+lean*.38,by-height*.54,cx-tip+lean,top);
    g.lineTo(cx+tip+lean,top);
    g.bezierCurveTo(cx+mid+lean*.38,by-height*.54,
      cx+base+.15,by-height*.23,cx+base,by);
    g.closePath();
  };
  outline();g.fillStyle='#49382a';g.fill();
  g.save();outline();g.clip();
  const bark=g.createLinearGradient(cx-base,by,cx+base,by);
  bark.addColorStop(0,'#4d392b');
  bark.addColorStop(.18,'#76573c');
  bark.addColorStop(.38,'#9c7955');
  bark.addColorStop(.60,'#92714e');
  bark.addColorStop(.79,'#654a33');
  bark.addColorStop(1,'#3d2f27');
  g.fillStyle=bark;g.fillRect(cx-base-1,top-2,2*base+2,height+4);
  // Fissuras alinhadas com o sentido do crescimento; poucas, finas e longas.
  const grainCount=Math.max(30,Math.round(height*.72));
  for(let i=0;i<grainCount;i++){
    const py=by-R(3,height-2),x=cx+R(-mid*.9,mid*.9),
      len=R(4,16),curve=R(-1.0,1.0);
    g.strokeStyle=i%5===0?'rgba(231,194,143,.26)'
      :i%3===0?'rgba(46,31,24,.44)':'rgba(82,51,31,.37)';
    g.lineWidth=R(.40,.95);
    g.beginPath();g.moveTo(x,py);
    g.quadraticCurveTo(x+curve,py-len*.5,x+curve*.3,py-len);g.stroke();
  }
  // Rachaduras raras, sem "rabiscos" ou nós grandes e escuros.
  for(let i=0;i<6;i++){
    const x=cx+R(-mid*.65,mid*.65),py=by-R(8,height*.86),
      len=R(5,12);
    g.strokeStyle='rgba(39,28,23,.48)';g.lineWidth=R(.65,.95);
    g.beginPath();g.moveTo(x,py);g.lineTo(x+R(-.75,.75),py-len*.45);
    g.lineTo(x+R(-1,1),py-len);g.stroke();
  }
  for(let i=0;i<3;i++){
    const x=cx+R(-mid*.56,mid*.56),py=by-R(11,height*.78);
    g.strokeStyle='rgba(58,37,27,.48)';g.lineWidth=.70;
    g.beginPath();g.ellipse(x,py,R(.75,1.45),R(1.4,2.9),
      R(-.23,.23),0,TAU);g.stroke();
  }
  g.restore();
  // Contato leve no solo. Não ampliar a base com raízes triangulares.
  g.strokeStyle='rgba(47,33,22,.46)';g.lineWidth=.7;
  g.beginPath();g.moveTo(cx-base,by-1);g.lineTo(cx-base+.2,by-height*.27);
  g.moveTo(cx+base,by-1);g.lineTo(cx+base-.2,by-height*.27);g.stroke();
  return {baseWidth:base*2,midWidth:mid*2,topWidth:tip*2};
}
function paintTrunk(g,cx,by,height,width,pine=false) {
  if(!pine) return paintBroadleafTrunk(g,cx,by,height,width);
  // Madeira com volume, raiz aberta, casca irregular e sombra na face oposta.
  const top=by-height,foot=width*.65,tip=width*.42;
  const outline=()=>{
    g.beginPath();g.moveTo(cx-foot-3,by);
    g.bezierCurveTo(cx-foot*.75,by-height*.22,cx-tip*1.05,top+height*.16,cx-tip,top);
    g.lineTo(cx+tip,top);
    g.bezierCurveTo(cx+tip*.95,top+height*.28,cx+foot*.82,by-height*.15,cx+foot+3,by);
    g.closePath();
  };
  outline();g.fillStyle='#35291f';g.fill();
  g.save();outline();g.clip();
  const bark=g.createLinearGradient(cx-foot,0,cx+foot,0);
  bark.addColorStop(0,'#3a2b20');bark.addColorStop(.22,pine?'#64503a':'#654b34');
  bark.addColorStop(.48,pine?'#95745b':'#96704a');
  bark.addColorStop(.68,'#75543a');bark.addColorStop(1,'#2d241e');
  g.fillStyle=bark;g.fillRect(cx-foot-4,top-2,foot*2+8,height+5);
  // Veios longos de casca em tons alternados; curvas acompanham o tronco.
  for(let i=0;i<95;i++){
    const x=cx+R(-foot*.92,foot*.92),y=by-R(2,height-3),
      len=R(3,19),bend=R(-2.6,2.6);
    g.strokeStyle=i%4===0?'rgba(214,176,120,.31)':i%3===0?'rgba(28,21,19,.46)':'rgba(70,45,28,.35)';
    g.lineWidth=R(.48,1.48);g.beginPath();g.moveTo(x,y);
    g.quadraticCurveTo(x+bend,y-len*.53,x+bend*.5,y-len);g.stroke();
  }
  // Sulcos/bifurcações finas e nós na parte inferior.
  for(let i=0;i<8;i++){
    const x=cx+R(-foot*.65,foot*.65),y=by-R(8,height*.72);
    g.strokeStyle='rgba(31,23,16,.68)';g.lineWidth=R(.8,1.35);
    g.beginPath();g.ellipse(x,y,R(1.0,2.4),R(1.9,4.4),R(-.2,.2),0,TAU);g.stroke();
    g.fillStyle='rgba(190,153,105,.23)';g.fillRect(x-1.5,y-3,1,3.5);
  }
  g.restore();
  g.strokeStyle='rgba(24,19,16,.6)';g.lineWidth=1;
  g.beginPath();g.moveTo(cx-foot-2,by);g.lineTo(cx-tip,top);g.stroke();
  // Raízes discretas saindo do pé do tronco, integrando árvore ao solo.
  for(const side of [-1,1]){
    g.fillStyle=side<0?'#473324':'#5c422d';
    g.beginPath();g.moveTo(cx+side*foot*.4,by-7);
    g.quadraticCurveTo(cx+side*(foot+1),by-3,cx+side*(foot+R(4,8)),by);
    g.lineTo(cx+side*foot*.22,by);g.fill();
  }
}
function crownAnchors(cx,cy,r,family) {
  const street=family==='street',yard=family==='yard';
  const total=street?24:yard?27:33,anchors=[];
  for(let i=0;i<total;i++){
    const a=i*2.39996+R(-.36,.36);
    // Puxa folhas e galhos para o centro/tronco, sem achatar o contorno.
    const d=Math.sqrt((i+.35)/total)*R(.28,.87);
    const stretch=1+.16*Math.sin(a*3.1+i*.4);
    const x=cx+Math.cos(a)*r*d*stretch*(street?.91:1);
    const y=cy+Math.sin(a)*r*d*(street?.71:.73);
    anchors.push({x,y,rx:r*R(.15,.31),ry:r*R(.15,.25),
      phase:R(0,TAU),lit:Math.max(.08,Math.min(.96,.49+(cx-x)/r*.25+(cy-y)/r*.34))});
  }
  // Adiciona folhas junto à bifurcação do tronco, deixando a copa apoiada
  // sobre os galhos e não parecendo um pompom elevado.
  for(let i=0;i<8;i++){
    const a=i*2.39996+R(-.4,.4);
    anchors.push({x:cx+Math.cos(a)*r*R(.04,.30),
      y:cy+r*.23+Math.sin(a)*r*R(.05,.25),
      rx:r*R(.17,.27),ry:r*R(.14,.22),phase:R(0,TAU),lit:R(.24,.54)});
  }
  return anchors.sort((a,b)=>a.y-b.y);
}
// Folhagem opaca de contorno orgânico, nunca um círculo: cada ramo forma
// uma massa irregular que impede o topo de desaparecer a distância normal.
// As milhares de folhas individuais são colocadas em cima desta estrutura.
function branchFoliage(g,n,p,layer) {
  const steps=22, pts=[],seed=n.phase;
  const cx=n.x,cy=n.y,rx=n.rx*(layer===0?.99:.88),
    ry=n.ry*(layer===0?1.03:.90);
  for(let i=0;i<steps;i++) {
    const a=i*TAU/steps;
    const irregular=1+.15*Math.sin(a*3+seed)+.12*Math.sin(a*7-seed*1.3)
      +R(-.085,.085);
    const rr=irregular*(1+.07*Math.cos(a*2));
    pts.push([cx+Math.cos(a)*rx*rr,cy+Math.sin(a)*ry*rr]);
  }
  // Base natural, com recortes e sombras variáveis. Sem outlines pretos.
  g.fillStyle=layer===0?p.deep:(n.lit>.55?p.body:p.shade);
  g.beginPath();g.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);
  g.closePath();g.fill();
  if(layer===0) {
    // Variação de tom dentro do mesmo ramo, ligeiramente para a luz.
    g.fillStyle=p.shade;g.beginPath();
    g.moveTo(cx-rx*.64,cy-ry*.1);
    g.quadraticCurveTo(cx-rx*.50,cy-ry*.76,cx-rx*.05,cy-ry*.72);
    g.quadraticCurveTo(cx+rx*.23,cy-ry*.38,cx+rx*.32,cy-ry*.06);
    g.quadraticCurveTo(cx-rx*.14,cy-ry*.30,cx-rx*.64,cy-ry*.1);
    g.fill();
  }
}
function leafTone(p,light,deepLayer) {
  const q=rng();
  if(deepLayer) return q<.25?p.deep:q<.68?p.shade:p.body;
  if(q<.10) return p.deep;
  if(q<.30) return p.shade;
  if(q<.58) return p.body;
  if(q<.82) return p.mid;
  return light>.42?(q<.95?p.sun:p.glint):p.mid;
}
// Ramos folhosos gerados a partir de uma estrutura coerente: seis eixos
// principais com bifurcações assimétricas, incluindo horizontais e quase
// verticais. Cada extremidade vira um ponto real de crescimento de folhas.
function taperedBroadleafBranch(g,a,b,width) {
  const dx=b.x-a.x,dy=b.y-a.y;
  // Suave curvatura e espessura contínua; sub-ramos nascem sem quinas duras.
  const bend=Math.max(-2.5,Math.min(2.5,(dx+dy)*.04));
  const mx=(a.x+b.x)*.50-dy*.045+bend*.18;
  const my=(a.y+b.y)*.50+dx*.035-bend*.12;
  g.lineCap='round';g.lineJoin='round';
  const draw=()=>{g.beginPath();g.moveTo(a.x,a.y);
    g.quadraticCurveTo(mx,my,b.x,b.y);g.stroke();};
  g.strokeStyle='#423126';g.lineWidth=width+.32;draw();
  g.strokeStyle='#876448';g.lineWidth=Math.max(.52,width*.66);draw();
  if(width>1.35){
    g.strokeStyle='rgba(205,168,119,.24)';
    g.lineWidth=Math.max(.38,width*.17);
    g.beginPath();g.moveTo(a.x-.28,a.y-.32);
    g.quadraticCurveTo(mx-.28,my-.32,b.x-.28,b.y-.32);g.stroke();
  }
}
function makeBroadleafBranches(g,cx,cy,r) {
  const root={x:cx,y:cy+r*.64},tips=[],major=[];
  // 0 e 5: quase horizontais; 2 e 3: quase verticais.
  const directions=[-2.99,-2.60,-1.88,-1.37,-.65,-.12];
  for(let i=0;i<directions.length;i++){
    const theta=directions[i]+R(-.11,.11);
    const length=r*R(.59,.90);
    const start={x:cx+R(-r*.052,r*.052),y:root.y-i*r*.026};
    const fork={x:start.x+Math.cos(theta)*length*.33,
      y:start.y+Math.sin(theta)*length*.27};
    const end={x:start.x+Math.cos(theta)*length,
      y:start.y+Math.sin(theta)*length*.82};
    // O eixo central cresce antes da bifurcação; não explode em estrela.
    taperedBroadleafBranch(g,start,fork,R(1.9,2.65));
    taperedBroadleafBranch(g,fork,end,R(1.30,1.95));
    major.push({start,fork,end,angle:theta});
    tips.push(end);
    const forks=2+(rng()<.56?1:0);
    for(let j=0;j<forks;j++){
      const along=R(.55,.88),a={x:fork.x+(end.x-fork.x)*along,
        y:fork.y+(end.y-fork.y)*along};
      const side=j%2===0?-1:1;
      const fa=theta+side*R(.26,.63);
      const dist=r*R(.14,.29);
      const b={x:a.x+Math.cos(fa)*dist,y:a.y+Math.sin(fa)*dist*.8};
      taperedBroadleafBranch(g,a,b,R(.55,1.0));
      tips.push(b);
    }
  }
  const anchors=tips.map(t=>({x:t.x,y:t.y,
    rx:r*R(.12,.20),ry:r*R(.105,.185),
    phase:R(0,TAU),
    lit:Math.max(.15,Math.min(.95,.48+(cx-t.x)/r*.22+(cy-t.y)/r*.31))}));
  return {major,anchors,branchCount:major.length,
    twigCount:tips.length-major.length};
}
// Flores com pétalas delicadas e frutos com pedúnculo/volume, ancorados aos
// ramos da própria copa. Todas as variações são pré-renderizadas uma vez.
function paintBroadleafDetails(g,anchors,variant) {
  if(variant==='common'||!anchors.length)return {flowers:0,fruits:0};
  const flower=variant==='flowering'||variant==='mixed';
  const fruit=variant==='fruiting'||variant==='mixed';
  const petals=['#f0dfd0','#e3c2ca','#ddd0dc','#e8dda8'];
  const drupes=['#a83e36','#ad6638','#ac873d','#6b4057'];
  let flowers=0,fruits=0;
  const bloom=flower?(variant==='mixed'?21:51):0;
  const crop=fruit?(variant==='mixed'?13:34):0;
  const blossomColor=petals[(rng()*petals.length)|0];
  const fruitColor=drupes[(rng()*drupes.length)|0];
  for(let k=0;k<bloom;k++){
    const n=anchors[(rng()*anchors.length)|0],angle=R(0,TAU);
    const x=n.x+Math.cos(angle)*n.rx*R(.2,.79);
    const y=n.y+Math.sin(angle)*n.ry*R(.2,.80);
    const rad=R(1.05,1.75);
    // Quatro pétalas e miolo discreto; a sombra fica por baixo.
    g.fillStyle='rgba(49,57,31,.44)';
    g.beginPath();g.ellipse(x+.6,y+.8,rad*1.85,rad*1.6,0,0,TAU);g.fill();
    g.fillStyle=blossomColor;
    for(let q=0;q<4;q++){
      const a=q*Math.PI/2+angle*.14;
      g.beginPath();g.ellipse(x+Math.cos(a)*rad*.9,
        y+Math.sin(a)*rad*.9,rad*.77,rad*.62,a,0,TAU);g.fill();
    }
    g.fillStyle='#b5a153';g.fillRect(x-.6,y-.6,1.2,1.2);flowers++;
  }
  for(let k=0;k<crop;k++){
    const n=anchors[(rng()*anchors.length)|0],a=R(0,TAU),
      x=n.x+Math.cos(a)*n.rx*R(.08,.61),
      y=n.y+Math.sin(a)*n.ry*R(.08,.63);
    const size=R(1.55,2.55);
    g.strokeStyle='#4d542f';g.lineWidth=.85;g.beginPath();
    g.moveTo(x,y-size*.55);g.lineTo(x+R(-.7,.7),y-size*1.65);g.stroke();
    g.fillStyle='rgba(31,33,24,.43)';g.beginPath();
    g.ellipse(x+.65,y+.8,size,size*.83,0,0,TAU);g.fill();
    g.fillStyle=fruitColor;g.beginPath();
    g.ellipse(x,y,size*.91,size*.78,R(-.2,.2),0,TAU);g.fill();
    g.fillStyle='rgba(255,227,170,.34)';g.beginPath();
    g.ellipse(x-size*.32,y-size*.3,size*.22,size*.17,0,0,TAU);g.fill();
    fruits++;
  }
  return {flowers,fruits};
}
function leafCanopy(g,cx,cy,r,family,p,variant='common') {
  const scaffold=makeBroadleafBranches(g,cx,cy,r);
  const anchors=crownAnchors(cx,cy,r,family);
  // Parte das âncoras nasce nas pontas reais dos galhos estruturais.
  // Mantemos quantidade e densidade aproximadas para evitar custo extra.
  const tips=scaffold.anchors;
  for(let i=0;i<tips.length;i++){
    const idx=Math.floor(i*anchors.length/tips.length);
    anchors[idx]=tips[i];
  }
  anchors.sort((a,b)=>a.y-b.y);
  // Primeiro estrutura de sombra entrelaçada. Depois cada folha é desenhada.
  // Essa base preenche as clareiras excessivas que faziam a copa sumir.
  for(const n of anchors) branchFoliage(g,n,p,0);
  const colors=[p.deep,p.shade,p.body,p.mid,p.sun,p.glint];
  const buckets=()=>Array.from({length:6},()=>[]);
  const chooseTone=(n,layer)=>{
    const q=rng();
    if(layer===0)return q<.32?0:q<.70?1:2;
    if(layer===1)return q<.10?0:q<.29?1:q<.62?2:q<.88?3:4;
    return q<.12?1:q<.40?2:q<.70?3:n.lit>.45?(q<.95?4:5):3;
  };
  let count=0;
  // Aproximadamente 10× a geração anterior; folhas menores e com veios de cor.
  // Camadas batidas por tonalidade e pré-renderizadas UMA vez no Canvas.
  for(let layer=0;layer<3;layer++){
    const paint=buckets(),amount=layer===0?1170:layer===1?1260:940;
    for(const n of anchors){
      for(let j=0;j<amount;j++){
        const theta=R(0,TAU),d=Math.sqrt(rng());
        const xx=n.x+Math.cos(theta)*n.rx*d;
        const yy=n.y+Math.sin(theta)*n.ry*d;
        // Pequenas clareiras microscópicas, mas não buracos enormes.
        const gap=Math.sin((xx+n.phase*8)*.18)*Math.cos((yy-n.phase*9)*.18);
        if(gap>.976&&layer!==2)continue;
        // Até em zoom normal cada folha precisa ocupar pixels reconhecíveis.
        // As menores continuam visíveis porque a estrutura já é opaca.
        const size=layer===0?R(1.9,3.2):layer===1?R(2.0,3.6):R(1.85,3.25);
        const a=theta*.35+R(-1.2,1.2)-.2;
        const tone=chooseTone(n,layer);
        paint[tone].push(xx-(layer===2?1:0),yy-(layer===2?1.6:0),size,a);
        count++;
      }
    }
    leafBatch(g,paint,colors);
  }
  const rim=buckets();
  for(const n of anchors)for(let j=0;j<85;j++){
    const a=j*2.39996+R(-.14,.14),d=R(.79,1.22);
    const x=n.x+Math.cos(a)*n.rx*d,y=n.y+Math.sin(a)*n.ry*d;
    const tone=n.lit>.58&&rng()>.48?4:rng()>.5?3:2;
    rim[tone].push(x,y,R(2.0,4.2),a+R(-.9,.9));count++;
  }
  leafBatch(g,rim,colors);
  // Realces esparsos são folhas de verdade, não ruído/pixels genéricos.
  for(let i=0;i<42;i++){
    const n=anchors[(rng()*anchors.length)|0];
    paintLeaf(g,n.x+R(-n.rx,n.rx),n.y+R(-n.ry,n.ry),
      R(2,3.4),R(-1.6,1.6),p.sun,rng()<.34);
  }
  const details=paintBroadleafDetails(g,scaffold.anchors,variant);
  return {leafCount:count+42,branchCount:scaffold.branchCount,
    twigCount:scaffold.twigCount,branchAngles:scaffold.major.map(b=>b.angle),
    flowers:details.flowers,fruits:details.fruits};
}
function spruceNeedles(g,cx,by,r,p) {
  // Pinheiro composto de ramos finos com milhares de agulhas, sem triângulos
  // preenchidos nem camadas horizontais perfeitamente simétricas.
  const height=r*2.15, top=by-height;
  woodyBranch(g,cx,by+4,cx+R(-3,3),top,4.4);
  let needles=0;
  const needleLines=Array.from({length:5},()=>[]);
  const tiers=17;
  for(let level=0;level<tiers;level++){
    const t=level/(tiers-1),y=by-8-t*height*.90,
      reach=r*(1-t*.91)*R(.80,1.15);
    for(const side of [-1,1])for(let branch=0;branch<2;branch++){
      const originX=cx+R(-2,2);
      const x1=originX+side*reach*R(.58,.97),
        y1=y+R(-7,9)+(1-t)*7;
      // Leque de ramos com sombra sólida natural. Os contornos serrilhados
      // deixam o pinheiro legível sem transformá-lo em triângulos empilhados.
      const branchY=y-8,tipX=x1,tipY=y1;
      const needleFan=Math.max(5,reach*(.25+.18*(1-t)));
      g.fillStyle=side<0?p[1]:p[0];
      g.beginPath();g.moveTo(originX,branchY-needleFan*.58);
      for(let k=1;k<=13;k++){
        const f=k/13,px=originX+(tipX-originX)*f;
        const edge=Math.sin(f*21+t*11)*2+R(-2.6,2.6);
        g.lineTo(px,branchY+(tipY-branchY)*f-needleFan*(1-f)*.44+edge);
      }
      for(let k=13;k>=0;k--){
        const f=k/13,px=originX+(tipX-originX)*f;
        const edge=Math.sin(f*16+t*7)*2+R(-2.6,2.6);
        g.lineTo(px,branchY+(tipY-branchY)*f+needleFan*(1-f)*.42+edge);
      }
      g.closePath();g.fill();
      // Face verde-médio acompanha a orientação da luz com borda quebrada.
      g.fillStyle=side<0?p[2]:p[1];
      g.beginPath();g.moveTo(originX,branchY-needleFan*.30);
      g.lineTo(originX+(tipX-originX)*.90,tipY-needleFan*.10);
      g.lineTo(originX+(tipX-originX)*.55,branchY+(tipY-branchY)*.55);
      g.closePath();g.fill();
      woodyBranch(g,originX,y-8,x1,y1,Math.max(.8,2.1-t*.8));
      const segments=Math.max(12,Math.ceil(Math.abs(x1-originX)/2.1));
      for(let k=0;k<segments;k++){
        const f=(k+.5)/segments,xx=originX+(x1-originX)*f,
          yy=y-8+(y1-y+8)*f;
        // Cada pequeno conjunto é um leque de agulhas individuais.
        const fan=R(6,11)*(1-f*.38);
        for(let m=0;m<80;m++){
          const angle=R(-2.6,-.55),len=R(1.0,fan*.48),
            x2=xx+R(-2.1,2.1),y2=yy+R(-1.5,1.5);
          // Majoritariamente sombra e verde florestal; highlights < 3%,
          // sem cobrir toda a árvore com o último tom (lavado/ciano).
          const tone=m%53===0?4:m%13===0?3:m%5===0?0:m%3===0?1:2;
          needleLines[tone].push(x2,y2,x2+Math.cos(angle)*len*side,y2+Math.sin(angle)*len);
          needles++;
        }
      }
    }
  }
  // Broto apical e ramos desconexos suavizam a forma de cone.
  for(let i=0;i<70;i++){
    const f=rng(),x=cx+R(-1,1)*(5+f*13),y=top+R(-4,20);
    needleLines[i%4+1].push(x,y+R(2,5),x+R(-3,3),y-R(3,6));needles++;
  }
  for(let tone=0;tone<5;tone++){
    const lines=needleLines[tone];g.strokeStyle=p[tone];g.lineWidth=tone<=1?1.12:tone===2?.96:.72;g.beginPath();
    for(let i=0;i<lines.length;i+=4){g.moveTo(lines[i],lines[i+1]);g.lineTo(lines[i+2],lines[i+3]);}
    g.stroke();
  }
  return needles;
}
function makeTree(kind='oak',decoration=null) {
  const pine=kind==='pine',street=kind==='street',yard=kind==='yard';
  // Comparado com a geração V1: troncos encurtados em ~30%-45%.
  const trunkH=pine?R(.95,1.30):street?R(1.38,1.75):yard?R(.98,1.32):R(1.20,1.55);
  const r=pine?R(.99,1.37):street?R(1.24,1.62):yard?R(1.30,1.67):R(1.58,2.02);
  const S=SPR,pad=18,width=(pine?.27:.30)*S,th=trunkH*S;
  const tc=makeCanvas(width+pad*2+16,th+pad+12),tg=tc.getContext('2d');
  const tx=tc.width/2,ty=tc.height-pad/2;
  const trunkProfile=paintTrunk(tg,tx,ty,th,width,pine);
  const w=(r*(pine?2.45:2.9)+.45)*S,h=(pine?r*2.55:r*2.15)*S+pad*2;
  const cc=makeCanvas(w,h),cg=cc.getContext('2d'),cx=cc.width/2,by=cc.height-pad;
  let leafCount=0,needleCount=0,branchCount=0,twigCount=0,flowers=0,fruits=0,branchAngles=[];
  const appearance=pine?'none':(decoration||(()=>{
    const v=rng();
    return v<.55?'common':v<.75?'flowering':v<.95?'fruiting':'mixed';
  })());
  let leafColors;
  if(pine){
    const p=NEEDLE_PALETTES[(rng()*NEEDLE_PALETTES.length)|0];
    needleCount=spruceNeedles(cg,cx,by,r*S,p);
    leafColors=[p[1],p[2],p[3],p[4]];
  } else {
    const pal=LEAF_PALETTES[(rng()*LEAF_PALETTES.length)|0];
    // Copa mais perto do topo real do tronco.
    const crown=leafCanopy(cg,cx,by-r*S*.66,r*S,kind,pal,appearance);
    ({leafCount,branchCount,twigCount,branchAngles,flowers,fruits}=crown);
    leafColors=[pal.shade,pal.body,pal.mid,pal.sun,pal.glint];
  }
  return {trunk:tc,tax:tx,tay:ty,crown:cc,cax:cx,cay:by,trunkH,r,kind,
    leafCount,needleCount,leafColors,decoration:appearance,
    branchCount,twigCount,branchAngles,flowers,fruits,trunkProfile};
}
function makeBush() {
  // Arbustos folhosos mesmo com a camera afastada: o antigo sprite usava
  // apenas folhas de 0.72–1.6px, que desapareciam ao reduzir a escala.
  // Massa vegetal opaca e irregular sob as folhas individuais, como nas arvores.
  const r=R(.45,.85),S=SPR,pad=13,
    c=makeCanvas(r*2.65*S+pad*2,r*2.05*S+pad*2),g=c.getContext('2d'),
    cx=c.width/2,by=c.height-pad,p=LEAF_PALETTES[(rng()*LEAF_PALETTES.length)|0];
  const shoots=[],colors=[p.deep,p.shade,p.body,p.mid,p.sun,p.glint],
    paths=Array.from({length:6},()=>[]);
  for(let i=0;i<19;i++){
    const angle=R(-Math.PI,0),dist=R(.12,.92),
      x=cx+Math.cos(angle)*r*S*dist,
      y=by+Math.sin(angle)*r*S*.76*dist;
    shoots.push({x,y,rad:R(8,14),phase:R(0,TAU),
      lit:Math.max(.14,Math.min(.94,.54+(cx-x)/(r*S)*.23+(by-y)/(r*S)*.11))});
  }
  // Os galhos continuam existindo, mas agora sustentam uma moita cheia.
  for(const n of shoots)woodyBranch(g,cx,by,n.x,n.y,1.1);
  branchFoliage(g,{x:cx,y:by-r*S*.36,rx:r*S*.60,ry:r*S*.39,
    phase:R(0,TAU),lit:.34},p,0);
  for(const n of shoots){
    const lobe={x:n.x,y:n.y,rx:n.rad*R(.89,1.12),
      ry:n.rad*R(.75,.96),phase:n.phase,lit:n.lit};
    branchFoliage(g,lobe,p,0);
    branchFoliage(g,lobe,p,1);
  }
  // Folhas pequenas para textura, maiores para ficarem visiveis em zoom normal.
  // Paths quebrados em blocos pelo leafBatch: sem caminhos gigantes no Canvas.
  for(const n of shoots){
    for(let i=0;i<750;i++){
      const a=R(0,TAU),d=Math.sqrt(rng()),
        x=n.x+Math.cos(a)*n.rad*d,
        y=n.y+Math.sin(a)*n.rad*.83*d;
      const q=rng();
      const tone=i<200?(q<.30?1:2):
        q<.075?0:q<.23?1:q<.48?2:q<.78?3:
        (n.lit>.45?(q<.96?4:5):3);
      paths[tone].push(x,y,R(1.8,3.3),a*.35+R(-1.05,1.05));
    }
  }
  leafBatch(g,paths,colors);
  // Borda recortada com folhas mais claras: evita uma bolha lisa/chapada.
  const rim=Array.from({length:6},()=>[]);
  for(const n of shoots)for(let j=0;j<46;j++){
    const a=j*2.39996+R(-.22,.22),d=R(.76,1.12);
    const tone=n.lit>.50&&rng()>.38?4:rng()>.42?3:2;
    rim[tone].push(n.x+Math.cos(a)*n.rad*d,
      n.y+Math.sin(a)*n.rad*.84*d,R(2.4,4.0),a+R(-.8,.8));
  }
  leafBatch(g,rim,colors);
  for(let i=0;i<95;i++){
    const n=shoots[(rng()*shoots.length)|0];
    paintLeaf(g,n.x+R(-n.rad,n.rad),n.y+R(-n.rad*.67,n.rad*.67),
      R(2.2,3.7),R(-1.4,1.4),rng()>.5?p.sun:p.mid);
  }
  if(rng()<.4){
    const flower=['#efe5cb','#d79597','#e9cd73'][(rng()*3)|0];
    for(let i=0;i<20;i++){
      const n=shoots[(rng()*shoots.length)|0],x=n.x+R(-n.rad,n.rad),
        y=n.y+R(-n.rad*.6,n.rad*.6);
      g.fillStyle=flower;g.fillRect(x-1.2,y-2.5,2.4,5);g.fillRect(x-2.5,y-1.2,5,2.4);
    }
  }
  return {img:c,ax:cx,ay:by,r,leafCount:19*(750+46)+95,
    foliageClusters:shoots.length+1};
}

// ---- Pedras: cada sprite é "renderizado" em 3D por código (raio por pixel contra uma superfície
// implícita), com normal, luz, oclusão, textura mineral e musgo/líquen. 7 tipos, vários tamanhos.
const ROCK_PPM = 64;
const ROCK_KINDS = ['granite', 'granite', 'basalt', 'basalt', 'sandstone', 'mossy', 'mossy', 'slab', 'limestone', 'cluster', 'cluster'];
function rockNoise3(seed) {
  const P = new Uint8Array(512), r = mulberry(seed);
  const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const h = (x, y, z) => P[(P[(P[x & 255] + y) & 255] + z) & 255] / 255;
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = smooth(x - xi), v = smooth(y - yi), w = smooth(z - zi);
    const a = lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v);
    const b = lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v);
    return lerp(a, b, w);
  };
}
function makeRock() {
  const kind = ROCK_KINDS[(rng() * ROCK_KINDS.length) | 0], seed = (rng() * 1e9) | 0, rr = mulberry(seed), N3 = rockNoise3(seed);
  const big = rr() < 0.22, r = kind === 'cluster' ? R(0.35, 0.55) : big ? R(0.75, 1.15) : R(0.28, 0.6);
  // ---- forma: função implícita F(p) < 0 dentro da pedra (metros, z p/ cima, chão em z = 0)
  let F, top;
  if (kind === 'basalt') {   // poliedro de faces quebradas
    const planes = [];
    for (let i = 0; i < 15; i++) {
      const a = rr() * TAU, e = Math.asin(rr() * 1.6 - 0.6), n = [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)];
      planes.push([n, r * (0.72 + rr() * 0.28)]);
    }
    const sz = 0.78 + rr() * 0.3, cz = r * 0.5 * sz;
    F = (x, y, z) => { let m = -1e9; const q = [x, y, (z - cz) / sz]; for (const [n, d] of planes) m = Math.max(m, n[0] * q[0] + n[1] * q[1] + n[2] * q[2] - d); return m + (N3(x * 9, y * 9, z * 9) - 0.5) * 0.015; };
    top = cz + r * sz + 0.05;
  } else if (kind === 'slab') {   // laje baixa de lados retos (superelipse)
    const a = r * 1.3, b = r * (0.8 + rr() * 0.3), c = r * 0.32;
    F = (x, y, z) => Math.pow(Math.abs(x / a), 6) + Math.pow(Math.abs(y / b), 6) + Math.pow(Math.abs((z - c * 0.4) / c), 5) - 1 + (N3(x * 2.2, y * 2.2, z * 2.2) - 0.5) * 0.5 + (N3(x * 9, y * 9, z * 9) - 0.5) * 0.08;
    top = c * 1.6;
  } else if (kind === 'cluster') {   // grupo de 3–4 pedras menores
    const blobs = [];
    for (let i = 0, n = 3 + ((rr() * 2) | 0); i < n; i++) {
      const s = r * (0.35 + rr() * 0.3), a = rr() * TAU, d = i ? r * (0.35 + rr() * 0.35) : 0;
      blobs.push([Math.cos(a) * d, Math.sin(a) * d * 0.8, s, s * (0.75 + rr() * 0.25), s * (0.55 + rr() * 0.3)]);
    }
    F = (x, y, z) => { let m = 1e9; for (const [bx, by, a, b, c] of blobs) m = Math.min(m, ((x - bx) / a) ** 2 + ((y - by) / b) ** 2 + ((z - c * 0.45) / c) ** 2 - 1); return m + (N3(x * 4, y * 4, z * 4) - 0.5) * 0.3; };
    top = r;
  } else {   // matacões arredondados (granito, arenito, musgo, calcário)
    const a = r, b = r * (0.72 + rr() * 0.28), c = r * (kind === 'sandstone' ? 0.48 : 0.58 + rr() * 0.22), k = kind === 'limestone' ? 0.55 : 0.62;
    // lascas planas cortando o volume (pedra quebrada, não ovo)
    const chips = [];
    for (let i = 0; i < 6; i++) { const t = rr() * TAU, e = rr() * 1.1 - 0.1; chips.push([Math.cos(e) * Math.cos(t), Math.cos(e) * Math.sin(t), Math.sin(e), 0.78 + rr() * 0.18]); }
    F = (x, y, z) => {
      const q = [x / a, y / b, (z - c * 0.45) / c];
      let f = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] - 1 + (N3(x * 1.4 + 5, y * 1.4, z * 1.4) - 0.5) * k + (N3(x * 4, y * 4, z * 4) - 0.5) * 0.16 + (N3(x * 10, y * 10, z * 10) - 0.5) * 0.05;
      for (const [nx, ny, nz, d] of chips) f = Math.max(f, (nx * q[0] + ny * q[1] + nz * q[2] - d) * 2.2);
      if (kind === 'sandstone') f += Math.abs(((z * 11 + N3(x * 2, y * 2, 3) * 0.6) % 1) - 0.5) * 0.12;   // degraus das camadas
      return f;
    };
    top = c * 1.65;
  }
  // ---- cores/minerais por tipo
  const base = { granite: [132, 125, 120], basalt: [82, 82, 86], sandstone: [172, 138, 98], mossy: [116, 114, 106], slab: [150, 146, 138], limestone: [184, 180, 170], cluster: rr() < 0.5 ? [124, 120, 114] : [96, 94, 92] }[kind];
  const tint = 0.9 + rr() * 0.2;
  const P = ROCK_PPM, ext = kind === 'slab' ? r * 1.4 : r * 1.25;
  const W = Math.ceil(ext * 2 * P) + 8, Hh = Math.ceil((top * HZ + ext * TILT) * P) + 10;
  const c = makeCanvas(W, Hh), g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
  const cx = W / 2, by = Hh - Math.ceil(ext * TILT * P) - 4;
  const L = V.norm([-0.55, 0.45, 0.75]);   // luz de cima/esquerda, levemente de frente
  const steps = 40, dz = top / steps;
  for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) {
    const X = (px + 0.5 - cx) / P, Y = (py + 0.5 - by) / P;
    // raio de visão: tela (X,Y) <-> mundo (X, y, z) com Y = 0,5·y − 0,86·z; marcha do alto p/ o chão
    let zHit = -1;
    const yExt = ext * 1.1;
    if (Math.abs(X) > yExt) continue;
    const kA = Math.max(0, Math.floor((top - (yExt * TILT - Y) / HZ) / dz)), kB = Math.min(steps, Math.ceil((top - (-yExt * TILT - Y) / HZ) / dz));
    for (let k = kA; k <= kB; k++) {
      const z = top - k * dz, y = (Y + HZ * z) / TILT;
      if (F(X, y, z) < 0) {
        let lo = z, hi = z + dz;   // refina a borda
        for (let it = 0; it < 4; it++) { const m = (lo + hi) / 2; F(X, (Y + HZ * m) / TILT, m) < 0 ? lo = m : hi = m; }
        zHit = lo; break;
      }
    }
    if (zHit < 0) continue;
    const z = zHit, y = (Y + HZ * z) / TILT, e = 0.01;
    const n = V.norm([F(X + e, y, z) - F(X - e, y, z), F(X, y + e, z) - F(X, y - e, z), F(X, y, z + e) - F(X, y, z - e)]);
    const dif = Math.max(0, V.dot(n, L)), sky = 0.5 + 0.5 * n[2];
    const ao = clamp(0.45 + z / (top * 0.55), 0.45, 1) * (0.75 + 0.25 * N3(X * 5, y * 5, z * 5));
    let lum = (0.22 * sky + 0.88 * dif) * ao;
    // textura mineral
    let col = base.map(v => v * tint), hn = N3(X * 38, y * 38, z * 38), mn = N3(X * 11 + 7, y * 11, z * 11);
    lum *= 0.88 + mn * 0.24;
    if (kind === 'granite' || kind === 'cluster') { if (hn > 0.8) col = col.map(v => v * 0.45); else if (hn < 0.16) col = col.map(v => v * 1.35 + 20); }
    else if (kind === 'basalt') { lum *= 0.92 + hn * 0.16; }
    else if (kind === 'sandstone') { const band = Math.sin(z * 26 + N3(X * 2, y * 2, 0) * 6); col = col.map((v, i) => v * (0.9 + band * 0.08) + (i === 0 ? band * 6 : 0)); }
    else if (kind === 'limestone') { if (hn > 0.86) lum *= 0.55; }
    else if (kind === 'slab') { lum *= 0.93 + hn * 0.12; }
    // trincas (ruído "ridged")
    const cr = Math.abs(N3(X * 6 + 3, y * 6, z * 6) - 0.5);
    if (cr < 0.006 && N3(X * 2 + 9, y * 2, z * 2) > 0.58 && kind !== 'sandstone') lum *= 0.55;
    // musgo no topo / líquen claro
    const up = n[2], mos = N3(X * 3.5 + 11, y * 3.5, z * 3.5);
    if (kind === 'mossy' && up > 0.35 && mos > 0.38) { const t = clamp((up - 0.35) * 2.2, 0, 1) * clamp((mos - 0.38) * 5, 0, 1); col = col.map((v, i) => lerp(v, [74, 98, 44][i] * (0.85 + hn * 0.35), t)); }
    else if (kind !== 'basalt' && mos > 0.72 && up > 0.2) { const t = clamp((mos - 0.72) * 6, 0, 0.7); col = col.map((v, i) => lerp(v, [176, 178, 132][i], t)); }
    // brilho especular leve
    const hv = V.norm([L[0], L[1] + 0.866, L[2] + 0.5]), spec = Math.pow(Math.max(0, V.dot(n, hv)), 24) * (kind === 'basalt' ? 0.35 : 0.15);
    const o = (py * W + px) * 4;
    d[o] = clamp(col[0] * lum + spec * 255, 0, 255); d[o + 1] = clamp(col[1] * lum + spec * 255, 0, 255); d[o + 2] = clamp(col[2] * lum + spec * 255, 0, 255); d[o + 3] = 255;
  }
  // sombra de contato no chão (por baixo do corpo) + composição
  const sh = makeCanvas(W, Hh), sg = sh.getContext('2d');
  const gr = sg.createRadialGradient(cx + ext * 0.15 * P, by, 0, cx + ext * 0.15 * P, by, ext * 1.1 * P);
  gr.addColorStop(0, 'rgba(18,20,10,0.55)'); gr.addColorStop(0.6, 'rgba(18,20,10,0.25)'); gr.addColorStop(1, 'rgba(18,20,10,0)');
  sg.fillStyle = gr; sg.save(); sg.translate(cx + ext * 0.15 * P, by); sg.scale(1, TILT); sg.translate(-cx - ext * 0.15 * P, -by);
  sg.beginPath(); sg.arc(cx + ext * 0.15 * P, by, ext * 1.1 * P, 0, TAU); sg.fill(); sg.restore();
  const body = makeCanvas(W, Hh); body.getContext('2d').putImageData(img, 0, 0);
  g.drawImage(sh, 0, 0); g.drawImage(body, 0, 0);
  // tufos de grama encostados na base (integra a pedra ao chão)
  g.lineCap = 'round';
  for (let i = 0; i < 10 + r * 20; i++) {
    const a = rr() * TAU, x = cx + Math.cos(a) * ext * P * (0.75 + rr() * 0.3), y = by + Math.sin(a) * ext * TILT * P * 0.9;
    if (Math.sin(a) < -0.2) continue;
    g.strokeStyle = ['#4f7a2c', '#6a8f38', '#3e6324'][(rr() * 3) | 0]; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (rr() - 0.5) * 4, y - 5, x + (rr() - 0.5) * 8, y - 6 - rr() * 8); g.stroke();
  }
  return { img: c, ax: cx, ay: by, r: kind === 'slab' ? r * 1.15 : r, ppm: P, kind };
}

function makeTuft(c1='#5f8a34',c2='#86ab4a',hmax=17) {
  // Cada tufo agora possui dezenas de lâminas finas em profundidade,
  // em vez de sete triângulos grandes e contornados.
  const H=hmax+9,W=39,c=makeCanvas(W,H),g=c.getContext('2d'),
    colors=[c1,c2,'#395a2d','#a5b96c','#829850','#9a904d'];
  const blade=(x,h,lean,color,w)=>{
    const base=H-2;
    g.strokeStyle=color;g.lineCap='round';g.lineWidth=w;
    g.beginPath();g.moveTo(x,base);
    g.quadraticCurveTo(x+lean*.25,base-h*.48,x+lean,base-h);
    g.stroke();
  };
  // Sombras finas na base para densidade, mas sem retângulos artificiais.
  g.fillStyle='rgba(28,47,18,.18)';
  g.beginPath();g.ellipse(W*.5,H-2,W*.33,2.2,0,0,TAU);g.fill();
  for(let layer=0;layer<3;layer++){
    for(let i=0;i<40;i++){
      const x=R(6,W-6),h=R(hmax*.20,hmax*(layer===2?1.12:.82)),
        lean=R(-8,8),col=colors[(rng()*colors.length)|0];
      blade(x,h,lean,col,R(.55,1.35));
    }
  }
  for(let i=0;i<9;i++)blade(R(8,W-8),R(hmax*.65,hmax*1.07),
    R(-5,5),rng()>.5?'#b9c67f':c2,.72);
  return {img:c,ax:W/2,ay:H-2};
}

function makeTarget() {
  const c = makeCanvas(46, 74), g = c.getContext('2d');
  poly(g, [[20, 73], [20, 30], [26, 30], [26, 73]], '#6b4a30', INK, 2);
  poly(g, [[8, 66], [22, 46], [25, 48], [12, 68]], '#5a3c26', INK, 2);
  const rings = ['#f1ede2', '#2a2a2e', '#3c7ac0', '#d0473b', '#f2c94c'];
  g.fillStyle = INK; g.beginPath(); g.arc(23, 24, 22, 0, TAU); g.fill();
  rings.forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(23, 24, 20 - i * 4, 0, TAU); g.fill(); });
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(27, 28, 20, -0.4, 2.2); g.fill();
  return { img: c, ax: 23, ay: 73 };
}

// ---------- vento ----------
function wind(t, x, y) {
  // Rajadas se deslocam pelo terreno: grama, arbustos, copas e polen
  // respondem a mesma onda sem alterar a geometria ou criar draw calls.
  const gust=.80+.25*Math.sin(t*.30-x*.09+y*.055);
  return gust*(Math.sin(t*1.6+x*.35+y*.21)*.6+
    Math.sin(t*.55+x*.12)*.4+Math.sin(t*4.1+y)*.08)+
    Math.sin(t*.82-(x+y)*.14)*.16;
}
function drawSway(g, img, ax, ay, p, sc, shear, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  g.setTransform(sc, 0, -shear * sc, sc, p.x, p.y);
  g.drawImage(img, -ax, -ay);
  g.restore();
}

// ---------- montagem procedural ----------
function inClear(x, y, r) {
  for (const z of world.clear || []) {
    if (z.ax !== undefined) {   // corredor (segmento) entre o jogador e os alvos
      const ex = z.bx - z.ax, ey = z.by - z.ay, u = clamp(((x - z.ax) * ex + (y - z.ay) * ey) / (ex * ex + ey * ey), 0, 1);
      if (Math.hypot(x - z.ax - ex * u, y - z.ay - ey * u) < z.r + r) return true;
    } else if (Math.hypot(x - z.x, y - z.y) < z.r + r) return true;
  }
  return false;
}
function freeSpot(x, y, r) {
  if (x < 1 || y < 1 || x > MAP - 1 || y > MAP - 1 || onRoad(x, y)) return false;
  if (pondVal(x, y) < 1.12 + r * 0.25) return false;
  if (world.blocked && world.blocked(x, y, r)) return false;
  if (inClear(x, y, r)) return false;
  for (const c of world.circles) if (Math.hypot(c.x - x, c.y - y) < c.r + r + 0.4) return false;
  return true;
}
// trilha sinuosa de A até B
function trail(a, b) {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6)), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  const c = [a];
  for (let i = 1; i < n; i++) { const t = i / n, o = R(-2.2, 2.2); c.push([a[0] + dx * t - dy / l * o, a[1] + dy * t + dx / l * o]); }
  c.push(b);
  world.trails.push(catmull(c, 0.6));
}
function pickSpawn() {
  let best = null;
  for (let i = 0; i < 500; i++) {
    const x = R(8, MAP - 8), y = R(8, MAP - 8), d = roadDist(x, y);
    if (d < 9 || pondVal(x, y) < 2 || (world.blocked && world.blocked(x, y, 3))) continue;
    const s = -forest(x, y) * 12 - Math.abs(d - 15) * 0.15 + rng();
    if (!best || s > best.s) best = { x, y, s };
  }
  return best || { x: MAP / 2, y: MAP / 4 };
}

function buildWorld() {
  if (OPEN_WORLD) return buildOpenWorld();
  genRoads();
  genPond();
  world.buildHouses && world.buildHouses();
  // nascimento numa clareira + alvos na direção mais aberta
  const sp = pickSpawn(); world.spawn = [sp.x, sp.y];
  let bestA = 0, bestS = -1e9;
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * TAU, tx = sp.x + Math.cos(a) * 9, ty = sp.y + Math.sin(a) * 9;
    if (tx < 3 || ty < 3 || tx > MAP - 3 || ty > MAP - 3 || onRoad(tx, ty) || pondVal(tx, ty) < 1.5 || world.blocked(tx, ty, 1)) continue;
    const s = -forest(tx, ty) * 10 + rng();
    if (s > bestS) { bestS = s; bestA = a; }
  }
  world.targets = [-0.35, 0, 0.35].map((o, i) => [sp.x + Math.cos(bestA + o) * (7 + i * 1.5), sp.y + Math.sin(bestA + o) * (7 + i * 1.5)]);
  world.aimDir = bestA;
  world.clear = [{ x: sp.x, y: sp.y, r: 4.5 }, ...world.targets.map(([x, y]) => ({ ax: sp.x, ay: sp.y, bx: x, by: y, r: 1.4 }))];
  // trilhas: clareira -> casa mais próxima, clareira -> lago
  const fronts = houses.map(H => H.front).sort((a, b) => Math.hypot(a[0] - sp.x, a[1] - sp.y) - Math.hypot(b[0] - sp.x, b[1] - sp.y));
  if (fronts[0]) trail([sp.x, sp.y], fronts[0]);
  if (world.pond) { const p = world.pond, a = Math.atan2(sp.y - p.y, sp.x - p.x); trail([sp.x, sp.y], [p.x + Math.cos(a) * p.rx * 1.2, p.y + Math.sin(a) * p.ry * 1.2]); }
  paintGround();

  // vegetação: densidade vem do ruído "floresta"; pinheiros no miolo, carvalhos na borda
  const pool = (n, f) => Array.from({ length: n }, f);
  // Dez sprites com variantes asseguradas por mundo: 5 comuns,
  // 2 floridos, 2 frutíferos e 1 raro misto (apenas broadleaf).
  const oaks = [
    makeTree('oak','common'),makeTree('yard','common'),
    makeTree('oak','flowering'),makeTree('street','common'),
    makeTree('yard','fruiting'),makeTree('oak','common'),
    makeTree('street','flowering'),makeTree('oak','fruiting'),
    makeTree('yard','common'),makeTree('oak','mixed')
  ], pines = pool(5, () => makeTree('pine'));
  const bushes = pool(8, makeBush), rocks = pool(14, makeRock);
  const addTree = (x, y, sp2) => {
    const t = { type: 'tree', x, y, sp: sp2, hit: 0, phase: rng() * 6 };
    world.props.push(t);
    world.circles.push({ x, y, r: 0.28, kind: 'tree', ref: t, h: 6 });
    bakeTreeShadow(x, y, sp2);
  };
  for (let i = 0, n = 0; i < 18000 && n < 270; i++) {
    const x = R(1, MAP - 1), y = R(1, MAP - 1), f = forest(x, y);
    if (rng() > smooth(clamp((f - 0.46) / 0.24, 0, 1)) * 0.85 + 0.012) continue;
    if (!freeSpot(x, y, 1.2)) continue;
    addTree(x, y, f > 0.64 && rng() < 0.65 ? pines[(rng() * pines.length) | 0] : oaks[(rng() * oaks.length) | 0]); n++;
  }
  for (let i = 0, n = 0; i < 12000 && n < 210; i++) {
    const x = R(1, MAP - 1), y = R(1, MAP - 1), f = forest(x, y);
    const edge = 1 - Math.abs(f - 0.5) * 6, nearYard = world.yards.some(r => x > r[0] - 2 && x < r[2] + 2 && y > r[1] - 2 && y < r[3] + 2);
    if (rng() > Math.max(0.03, edge * 0.5, nearYard ? 0.3 : 0)) continue;
    if (!freeSpot(x, y, 0.7)) continue;
    const s = bushes[(rng() * bushes.length) | 0]; world.props.push({ type: 'bush', x, y, sp: s, phase: rng() * 6 });
    world.circles.push({ x, y, r: s.r * 0.6, kind: 'bush', soft: true });
    bakeShadow(x, y, s.r, s.r * 0.6, 1); n++;
  }
  const addRock = (x, y) => {
    const s = rocks[(rng() * rocks.length) | 0]; world.props.push({ type: 'rock', x, y, sp: s });
    world.circles.push({ x, y, r: s.r * 0.9, kind: 'rock', h: s.r * 1.4 });
    bakeShadow(x, y, s.r, s.r * 0.7, 0.6);
  };
  for (let i = 0, n = 0; i < 2400 && n < 48; i++) { const x = R(1, MAP - 1), y = R(1, MAP - 1); if (freeSpot(x, y, 0.6)) { addRock(x, y); n++; } }
  if (world.pond) for (let i = 0, n = 0; i < 600 && n < 14; i++) {   // pedras na margem do lago
    const p = world.pond, a = R(0, TAU), x = p.x + Math.cos(a) * p.rx * R(1.2, 1.5), y = p.y + Math.sin(a) * p.ry * R(1.2, 1.5);
    if (freeSpot(x, y, 0.4)) { addRock(x, y); n++; }
  }
  const tufts = [makeTuft(), makeTuft(), makeTuft(), makeTuft('#456f30','#8daa50'), makeTuft('#526c37','#b4b46b')],
    reeds = [makeTuft('#3d6b3a', '#5a8a46', 24), makeTuft('#4a7a3c', '#6f9a4e', 28)];
  for (let i = 0; i < MAP * MAP * 0.095; i++) {
    const x = R(0.5, MAP - 0.5), y = R(0.5, MAP - 0.5);
    if (onRoad(x, y) || pondVal(x, y) < 1.05 || world.blocked(x, y, 0.2)) continue;
    world.props.push({ type: 'tuft', x, y, sp: tufts[i % tufts.length], phase: rng() * 6, flat: true });
  }
  if (world.pond) for (let i = 0; i < 900; i++) {   // juncos na beira d'água
    const p = world.pond, x = p.x + R(-p.rx - 2, p.rx + 2), y = p.y + R(-p.ry - 2, p.ry + 2), v = pondVal(x, y);
    if (v > 0.93 && v < 1.08 && rng() < 0.5) world.props.push({ type: 'tuft', x, y, sp: reeds[i % 2], phase: rng() * 6, flat: true });
  }
  // alvos de tiro
  const tg = makeTarget();
  for (const [x, y] of world.targets) {
    const t = { type: 'target', x, y, sp: tg, hit: 0, wob: 0 };
    world.props.push(t);
    world.circles.push({ x, y, r: 0.3, kind: 'target', ref: t, h: 1.8 });
    bakeShadow(x, y, 0.5, 0.3, 1.2);
  }
  // postes ao longo das ruas, alternando os lados, braço virado p/ o asfalto
  for (const r of world.roads) for (let i = 10, s = 1; i < r.pts.length; i += 24, s = -s) {
    const p = r.pts[i], x = p.x + p.nx * s * (ROAD_W + SIDE + .55), y = p.y + p.ny * s * (ROAD_W + SIDE + .55);
    if (x < 1 || y < 1 || x > MAP - 1 || y > MAP - 1 || Math.hypot(p.x - world.junction.x, p.y - world.junction.y) < 9) continue;
    if (!CityStreetLayout.verge(x, y, .2, roadDist, ROAD_W, SIDE) || world.blocked(x, y, 0.3) || world.lamps.some(l => Math.hypot(l.x - x, l.y - y) < 6)) continue;
    world.lamps.push({ x, y, ax: -p.nx * s, ay: -p.ny * s });
  }
  for (const l of world.lamps) world.circles.push({ x: l.x, y: l.y, r: 0.12, kind: 'lamp', h: 4 });
  urbanGenerate();
  generateTrafficSignals();
}

// movimento com colisão + água (desliza nos eixos se bater na margem)
function moveTo(ox, oy, nx, ny, r, floor=0) {
  for (const [x, y] of [[nx, ny], [nx, oy], [ox, ny]]) {
    const q = collide(x, y, r, floor);
    // água bloqueia, exceto sobre pontes (via sobre rio/mar no mundo grande)
    if (pondVal(q[0], q[1]) > 1.02 || (OPEN_WORLD && roadDist(q[0], q[1]) < ROAD_W + SIDE)) return q;
  }
  return [ox, oy];
}

// desenho de um prop já ordenado por profundidade
function drawProp(g, p, t, player) {
  if (p.draw) return p.draw(g, p, t);
  const sc = cam.zoom / SPR * (p.scale || 1), base = proj(p.x, p.y, 0);
  if (p.type === 'tree') {
    const sp = p.sp;
    g.save(); g.setTransform(sc, 0, 0, sc, base.x, base.y); g.drawImage(sp.trunk, -sp.tax, -sp.tay); g.restore();
    const top = proj(p.x, p.y, sp.trunkH * (p.scale || 1));
    const w = wind(t, p.x, p.y) * 0.05 + Math.sin(p.hit * 30) * p.hit * 0.15;
    // copa fica translúcida quando o jogador está atrás dela (como no Zomboid)
    let a = 1;
    if (player) {
      const pp = proj(player.x, player.y, 1);
      const dx = (pp.x - top.x) / (sp.r * cam.zoom), dy = (pp.y - (top.y - sp.r * cam.zoom * 0.8)) / (sp.r * cam.zoom);
      if (dx * dx + dy * dy < 1.05 &&
          depthOf(player.x,player.y)<depthOf(p.x,p.y)-0.25) a=0.68;
    }
    drawSway(g, sp.crown, sp.cax, sp.cay, { x: top.x + ((sp.topDx || 0) + w * 8) * sc, y: top.y }, sc, w, a);
  } else if (p.type === 'bush') {
    drawSway(g, p.sp.img, p.sp.ax, p.sp.ay, base, sc, wind(t, p.x, p.y) * 0.06);
  } else if (p.type === 'tuft') {
    drawSway(g, p.sp.img, p.sp.ax, p.sp.ay, base, sc, wind(t, p.x, p.y) * 0.22);
  } else if (p.type === 'rock') {
    const rs = cam.zoom / (p.sp.ppm || SPR); g.save(); g.imageSmoothingEnabled = true; g.setTransform(rs, 0, 0, rs, base.x, base.y); g.drawImage(p.sp.img, -p.sp.ax, -p.sp.ay); g.restore();
  } else if (p.type === 'target') {
    const w = Math.sin(p.wob * 40) * p.wob * 0.5;
    drawSway(g, p.sp.img, p.sp.ax, p.sp.ay, base, sc * 0.72, w);
    if (p.hit > 0) { g.fillStyle = `rgba(255,240,180,${p.hit * 2})`; const c = proj(p.x, p.y, 0.95); g.beginPath(); g.arc(c.x, c.y, 0.36 * cam.zoom, 0, TAU); g.fill(); }
  }
}

function drawLamp(g,l,night){
  // Poste de rua contemporaneo: base de concreto, haste galvanizada com
  // gradiente metalico, braço curvo e luminária LED com lente realista.
  const base=proj(l.x,l.y,0),p0=proj(l.x,l.y,.18),
    shaft=proj(l.x,l.y,3.95),bend=proj(l.x+l.ax*.20,l.y+l.ay*.20,4.15),
    arm=proj(l.x+l.ax*.88,l.y+l.ay*.88,4.13),
    lamp=proj(l.x+l.ax*1.10,l.y+l.ay*1.10,4.03),
    w=Math.max(2,cam.zoom*.075);
  g.save();g.lineCap='round';g.lineJoin='round';
  g.fillStyle='rgba(14,17,19,.24)';
  g.beginPath();g.ellipse(base.x+2,base.y+1,w*1.5,w*.55,-.25,0,TAU);g.fill();
  // Concreto e parafusos de ancoragem.
  poly(g,[[base.x-w*.85,base.y],[base.x+w*.85,base.y],
    [p0.x+w*.60,p0.y],[p0.x-w*.60,p0.y]],'#858681','#252729',1.2);
  g.fillStyle='#4f5557';g.fillRect(p0.x-w*.7,p0.y,w*1.4,w*.17);
  for(const dx of [-.48,.48]){g.fillStyle='#272c2e';g.beginPath();
    g.arc(base.x+dx*w,base.y-w*.07,Math.max(.6,w*.12),0,TAU);g.fill();}
  const stroke=(col,size,offset=0)=>{
    g.strokeStyle=col;g.lineWidth=size;g.beginPath();
    g.moveTo(p0.x+offset,p0.y);
    g.quadraticCurveTo(shaft.x+offset,shaft.y+w*.1,shaft.x+offset,shaft.y);
    g.quadraticCurveTo(bend.x+offset,bend.y,bend.x+offset,bend.y);
    g.lineTo(arm.x+offset,arm.y);g.stroke();
  };
  stroke('#161d20',w+2.7);stroke('#465159',w);
  stroke('#89949a',w*.27,-w*.21);
  stroke('rgba(215,227,227,.30)',Math.max(.7,w*.10),-w*.32);
  // Joint, armature, bolted LED enclosure with downward diffuser.
  g.strokeStyle='#222b2f';g.lineWidth=Math.max(1,w*.43);
  g.beginPath();g.moveTo(arm.x,arm.y);g.lineTo(lamp.x,lamp.y);g.stroke();
  const r=Math.max(3,cam.zoom*.15);
  g.fillStyle='#171f23';g.strokeStyle='#10181b';g.lineWidth=1.2;
  g.beginPath();g.moveTo(lamp.x-r*1.6,lamp.y-r*.43);
  g.lineTo(lamp.x+r*.85,lamp.y-r*.50);g.lineTo(lamp.x+r*1.12,lamp.y+r*.3);
  g.lineTo(lamp.x-r*1.2,lamp.y+r*.40);g.closePath();g.fill();g.stroke();
  g.fillStyle='#748087';g.fillRect(lamp.x-r*1.1,lamp.y-r*.28,r*1.6,r*.12);
  g.fillStyle=night?'#fff2c5':'#b8c7cb';
  g.beginPath();g.moveTo(lamp.x-r*1.07,lamp.y+r*.35);
  g.lineTo(lamp.x+r*.81,lamp.y+r*.29);
  g.lineTo(lamp.x+r*.52,lamp.y+r*.54);
  g.lineTo(lamp.x-r*.90,lamp.y+r*.59);g.closePath();g.fill();
  // Caixa de inspeção fundida no poste, rebites e pequenas uniões.
  const panel=proj(l.x,l.y,1.22),pw=Math.max(2.4,cam.zoom*.095);
  g.fillStyle='#29373d';g.strokeStyle='#afb8b7';g.lineWidth=.85;
  g.beginPath();g.roundRect(panel.x-pw*.4,panel.y-pw*.65,
    pw*.8,pw*1.3,Math.max(1,pw*.12));g.fill();g.stroke();
  g.fillStyle='#161f22';g.fillRect(panel.x-pw*.18,panel.y-pw*.17,
    pw*.36,Math.max(1,pw*.055));
  for(const z of [.27,.92,1.61,3.15]){
    const q=proj(l.x,l.y,z),rr=Math.max(1,w*.13);
    g.fillStyle='#94a3a6';g.beginPath();g.arc(q.x-w*.12,q.y,rr,0,TAU);g.fill();
    g.fillStyle='#202a2f';g.beginPath();g.arc(q.x-w*.12,q.y,rr*.43,0,TAU);g.fill();
  }
  // Refletor LED fisicamente separado em chips discretos sobre uma lente.
  for(let j=0;j<4;j++){
    const px=lamp.x-r*.76+j*r*.43,py=lamp.y+r*.43-j*r*.018;
    g.fillStyle=night?'rgba(255,247,210,.94)':'rgba(210,229,225,.54)';
    g.fillRect(px,py,Math.max(1,r*.23),Math.max(.65,r*.08));
  }
  // Marca d'agua, poeira e desgaste delicado junto a sapata.
  g.strokeStyle='rgba(72,78,71,.32)';g.lineWidth=Math.max(.6,w*.16);
  g.beginPath();g.moveTo(p0.x+w*.24,p0.y-w*.15);
  g.lineTo(p0.x+w*.25,p0.y-w*1.6);g.stroke();
  if(night){
    g.globalCompositeOperation='screen';
    g.fillStyle='rgba(255,232,169,.3)';g.beginPath();
    g.ellipse(lamp.x,lamp.y+r*.46,r*2.1,r*.85,0,0,TAU);g.fill();
  }
  g.restore();
}

// ---------- colisão e tiro ----------
// Carro ativo como caixa orientada (o colisor publicado é só um círculo central de 0,55 m).
function vehicleBox(c) {
  const Vs = typeof window !== 'undefined' ? window.cityVehicles : null;
  if (!Vs || c !== Vs.collider || !Vs.car) return null;
  return { x: Vs.car.x, y: Vs.car.y, a: Vs.car.angle, hl: (Vs.carLength || 4.4) / 2, hw: (Vs.bodyWidth || 1.85) / 2, driving: !!Vs.driver };
}
function pushOutBox(b, x, y, r) {
  if (b.driving && Math.hypot(x - b.x, y - b.y) < 0.05) return null;   // o motorista está no centro do carro
  const ca = Math.cos(b.a), sa = Math.sin(b.a), rx = x - b.x, ry = y - b.y;
  let lx = rx * ca + ry * sa, ly = -rx * sa + ry * ca;
  const hl = b.hl + r, hw = b.hw + r;
  if (Math.abs(lx) >= hl || Math.abs(ly) >= hw) return null;
  if (hl - Math.abs(lx) < hw - Math.abs(ly)) lx = (lx < 0 ? -1 : 1) * hl; else ly = (ly < 0 ? -1 : 1) * hw;
  return [b.x + lx * ca - ly * sa, b.y + lx * sa + ly * ca];
}
function rayBox(b, ox, oy, dx, dy) {   // teste de lajes no espaço local da caixa
  const ca = Math.cos(b.a), sa = Math.sin(b.a), rx = ox - b.x, ry = oy - b.y;
  const lo = [rx * ca + ry * sa, -rx * sa + ry * ca], ld = [dx * ca + dy * sa, -dx * sa + dy * ca], h = [b.hl, b.hw];
  let t0 = -Infinity, t1 = Infinity, axis = 0;
  for (let k = 0; k < 2; k++) {
    if (Math.abs(ld[k]) < 1e-9) { if (Math.abs(lo[k]) > h[k]) return null; continue; }
    let a = (-h[k] - lo[k]) / ld[k], c2 = (h[k] - lo[k]) / ld[k]; if (a > c2) [a, c2] = [c2, a];
    if (a > t0) { t0 = a; axis = k; }
    t1 = Math.min(t1, c2);
  }
  if (t0 > t1 || t0 < 0.05) return null;
  const ln = axis === 0 ? [-Math.sign(ld[0]), 0] : [0, -Math.sign(ld[1])];
  return { t: t0, nx: ln[0] * ca - ln[1] * sa, ny: ln[0] * sa + ln[1] * ca };
}
function raycast(ox, oy, dx, dy, maxD) {
  let best = { t: maxD, kind: 'none' };
  for (const c of world.circles) {
    if (c.soft) continue;
    const vb = vehicleBox(c);
    if (vb) { const q = rayBox(vb, ox, oy, dx, dy); if (q && q.t < best.t) best = { t: q.t, kind: 'vehicle', ref: c, nx: q.nx, ny: q.ny }; continue; }
    const fx = ox - c.x, fy = oy - c.y, b = fx * dx + fy * dy, cc = fx * fx + fy * fy - c.r * c.r;
    const disc = b * b - cc;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t > 0.05 && t < best.t) best = { t, kind: c.kind, ref: c.ref, nx: (fx + dx * t) / c.r, ny: (fy + dy * t) / c.r };
  }
  for (const s of world.segs) {
    if (s.door && s.doorAnim?.open >= .72) continue;
    if (s.h < 1.2) continue;
    const ex = s.x2 - s.x1, ey = s.y2 - s.y1, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((s.x1 - ox) * ey - (s.y1 - oy) * ex) / den, u = ((s.x1 - ox) * dy - (s.y1 - oy) * dx) / den;
    if (t > 0.05 && t < best.t && u >= 0 && u <= 1) {
      const l = Math.hypot(ex, ey);
      let nx = -ey / l, ny = ex / l; if (nx * dx + ny * dy > 0) { nx = -nx; ny = -ny; }
      best = { t, kind: s.kind || 'wall', ref: s, nx, ny, glass: s.window };
    }
  }
  best.x = ox + dx * best.t; best.y = oy + dy * best.t;
  return best;
}

// Grade espacial p/ colisão: objetos fixos são indexados por célula de 4 m (reindexa quando as
// listas mudam de tamanho); colisores que se movem (veículos) são checados à parte.
const COLL_CELL = 4;
const collGrid = { key: '', n: 0, circ: null, segs: null, up: null, dyn: [], stamp: 0 };
const NO_CELL = [];
function collIndex() {
  // mundo grande: reindexa só quando um setor termina ou sai (world.version); objetos de um setor
  // ainda em geração ficam longe do jogador e entram juntos no fim
  const key = world.open ? 'v' + world.version : world.circles.length + ':' + world.segs.length + ':' + ((world.upperSegs || []).length);
  if (collGrid.key === key) return collGrid;
  const n = Math.ceil(MAP / COLL_CELL) + 2;
  const G = { key, n, circ: new Map(), segs: new Map(), up: new Map(), dyn: [], stamp: collGrid.stamp };
  const put = (map, x0, y0, x1, y1, o) => {
    const i0 = clamp(Math.floor(x0 / COLL_CELL), 0, n - 1), i1 = clamp(Math.floor(x1 / COLL_CELL), 0, n - 1);
    const j0 = clamp(Math.floor(y0 / COLL_CELL), 0, n - 1), j1 = clamp(Math.floor(y1 / COLL_CELL), 0, n - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * n + i; let a = map.get(k); if (!a) map.set(k, a = []); a.push(o); }
  };
  const M = 0.8;   // folga: raio máximo de quem colide
  for (const c of world.circles) {
    if (c.kind === 'vehicle') { G.dyn.push(c); continue; }
    put(G.circ, c.x - c.r - M, c.y - c.r - M, c.x + c.r + M, c.y + c.r + M, c);
  }
  const segBox = (map, s) => put(map, Math.min(s.x1, s.x2) - M, Math.min(s.y1, s.y2) - M, Math.max(s.x1, s.x2) + M, Math.max(s.y1, s.y2) + M, s);
  for (const s of world.segs) segBox(G.segs, s);
  for (const s of world.upperSegs || []) segBox(G.up, s);
  Object.assign(collGrid, G);
  return collGrid;
}
function pushOutCircle(c, x, y, r) {
  const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy), m = c.r + r * (c.soft ? 0.5 : 1);
  return d < m && d > 1e-6 ? [c.x + dx / d * m, c.y + dy / d * m] : null;
}
function pushOutSeg(s, x, y, r) {
  if (s.door && s.doorAnim?.open >= .72) return null;
  const ex = s.x2 - s.x1, ey = s.y2 - s.y1, l2 = ex * ex + ey * ey;
  const u = clamp(((x - s.x1) * ex + (y - s.y1) * ey) / l2, 0, 1);
  const px = s.x1 + ex * u, py = s.y1 + ey * u, dx = x - px, dy = y - py, d = Math.hypot(dx, dy), m = r + 0.08;
  return d < m && d > 1e-6 ? [px + dx / d * m, py + dy / d * m] : null;
}
function collide(x, y, r, floor=0) {
  const G = collIndex(), n = G.n;
  for (let it = 0; it < 3; it++) {
    const cell = clamp(Math.floor(y / COLL_CELL), 0, n - 1) * n + clamp(Math.floor(x / COLL_CELL), 0, n - 1);
    const Cc = G.circ.get(cell) || NO_CELL, Cs = G.segs.get(cell) || NO_CELL, Cu = G.up.get(cell) || NO_CELL;
    if (floor !== 1) {
      for (const c of Cc) { const q = pushOutCircle(c, x, y, r); if (q) { x = q[0]; y = q[1]; } }
      for (const c of G.dyn) { const vb = vehicleBox(c), q = vb ? pushOutBox(vb, x, y, r) : pushOutCircle(c, x, y, r); if (q) { x = q[0]; y = q[1]; } }
      for (const s of Cs) { const q = pushOutSeg(s, x, y, r); if (q) { x = q[0]; y = q[1]; } }
    } else {
      // andar de cima: paredes externas, cercas soltas e as paredes do pavimento superior
      for (const s of Cs) { if (!(s.ext || (!s.house && s.kind === 'fence'))) continue; const q = pushOutSeg(s, x, y, r); if (q) { x = q[0]; y = q[1]; } }
      for (const s of Cu) { const q = pushOutSeg(s, x, y, r); if (q) { x = q[0]; y = q[1]; } }
    }
  }
  return [clamp(x, 0.5, MAP - 0.5), clamp(y, 0.5, MAP - 0.5)];
}
