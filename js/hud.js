// hud.js — retrato pixelado, barras, relógio, minimapa, hotbar e mira (canvas em resolução cheia).
'use strict';

const hud = { portrait: null, msg: '', msgT: 0 };
// mesmas fontes da interface (css/ui-theme.css): texto em Segoe UI, números e títulos na fonte do menu principal
const HUD_FONT = '"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif';
const HUD_DISPLAY = 'Impact,Haettenschweiler,"Arial Narrow Bold","Arial Narrow",sans-serif';
const hudStart = performance.now();
// cores do tema claro/escuro lidas do CSS (uma vez por troca de tema)
let hudThemeKey = '', hudT = null;
function hudTheme() {
  const key = (document.documentElement.dataset.uiTheme || 'light') + (document.documentElement.dataset.hud || '');
  if (key !== hudThemeKey || !hudT) {
    hudThemeKey = key; const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    hudT = { glass: v('--ui-glass') || 'rgba(251,249,245,.76)', strong: v('--ui-glass-strong') || '#fff', text: v('--ui-text') || '#1d2427', muted: v('--ui-muted') || '#5c676a',
      line: v('--ui-line') || 'rgba(24,34,38,.11)', accent: v('--ui-accent') || '#d8973a', ink: v('--ui-accent-ink') || '#241603', dark: document.documentElement.dataset.uiTheme === 'dark',
      full: document.documentElement.dataset.hud === 'full' };
  }
  return hudT;
}
// texto sobre o mundo: branco com sombra suave (sem contorno grosso), legível em qualquer chão
function hudText(g, text, x, y, font, color = '#fff', align = 'left', maxWidth) {
  g.save(); g.font = font; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillStyle = color;
  g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 8; g.shadowOffsetY = 1; g.fillText(text, x, y, maxWidth); g.restore();
}
// pílula de vidro com tecla (ex.: "F · Abrir porta" → [F] Abrir porta)
function drawHudPrompt(g, text, cx, y, compact) {
  const T = hudTheme(), m = /^([^·]{1,12}?)\s*·\s*(.+)$/.exec(text), key = m ? m[1].trim() : '', label = m ? m[2] : text;
  g.save(); g.font = (compact ? '600 13px ' : '600 14px ') + HUD_FONT;
  const kw = key ? Math.max(24, g.measureText(key).width + 14) : 0, lw = Math.min(g.measureText(label).width, 520), w = kw + lw + (key ? 30 : 24), h = compact ? 32 : 36, x = cx - w / 2;
  g.shadowColor = 'rgba(0,0,0,.22)'; g.shadowBlur = 16; g.shadowOffsetY = 4;
  g.beginPath(); g.roundRect(x, y - h / 2, w, h, h / 2); g.fillStyle = T.strong; g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = T.line; g.lineWidth = 1; g.stroke();
  let tx = x + 12;
  if (key) { g.beginPath(); g.roundRect(tx - 4, y - 11, kw, 22, 11); g.fillStyle = T.accent; g.fill(); g.fillStyle = T.ink; g.font = '700 12px ' + HUD_FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(key, tx - 4 + kw / 2, y + 1); tx += kw + 6; }
  g.fillStyle = T.text; g.font = (compact ? '600 13px ' : '600 14px ') + HUD_FONT; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(label, tx, y + 1, 520);
  g.restore();
}
// ícones das armas p/ o HUD (carregados uma vez)
const hudIcons = new Map();
function hudIcon(id) {
  if (!hudIcons.has(id)) { const img = new Image(); img.src = 'assets/weapons/icons/' + id + '.webp'; hudIcons.set(id, img); }
  return hudIcons.get(id);
}

function hudMapLayout(W,H) {
  const compact=W<740,ms=compact?Math.min(104,Math.max(84,W*.26)):148;
  return {compact,ms,mx:compact?12:22,my:Math.max(102,H-ms-(compact?14:22))};
}

function roundRect(g, x, y, w, h, r, fill, stroke) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); }
}

// manchete sobre o mundo (avisos): fonte do menu, caixa alta espaçada, branca com sombra suave
function drawHudHeadline(g, text, x, y, size, maxWidth, align='left') {
  g.save();
  g.font=`400 ${Math.round(size*1.05)}px ${HUD_DISPLAY}`;
  g.textAlign=align;g.textBaseline='alphabetic';
  if('letterSpacing' in g)g.letterSpacing=Math.max(1,size*.06)+'px';
  g.fillStyle='#fff';g.shadowColor='rgba(0,0,0,.6)';g.shadowBlur=Math.max(8,size*.5);g.shadowOffsetY=2;
  g.fillText(String(text).toUpperCase(),x,y,maxWidth);
  g.restore();
}

function drawHUD(h, W, H, st) {
  h.clearRect(0, 0, W, H);
  // HUD de mundo aberto: informação útil, sem os botões decorativos antigos.
  if (wmap.open) return;
  h.save(); h.imageSmoothingEnabled = true;
  const p = st.player, needs = st.needs || {};
  const {compact,ms,mx,my}=hudMapLayout(W,H);

  // dano: borda vermelha ao levar tiro; vida baixa pulsa; caído escurece a tela
  const hurtA=Math.max((p.hurtT||0)/.55*.55,st.hp<.25?(.18+.12*Math.sin(performance.now()/260))*(1-st.hp*4):0);
  if(hurtA>0.01){
    const vg=h.createRadialGradient(W/2,H/2,Math.min(W,H)*.3,W/2,H/2,Math.max(W,H)*.72);
    vg.addColorStop(0,'rgba(150,0,0,0)');vg.addColorStop(1,`rgba(150,0,0,${Math.min(.75,hurtA)})`);
    h.fillStyle=vg;h.fillRect(0,0,W,H);
  }
  // procurado pela polícia: estrelas e aviso piscando (vermelho/azul) no alto da tela
  const wl=window.cityCharacters?.wanted?.level||0;
  if(wl&&!p.dead&&!p.busted){
    h.save();h.textAlign='center';h.textBaseline='alphabetic';h.lineJoin='round';
    h.font=(compact?'900 18px':'900 24px')+' '+HUD_FONT;
    const txt='★'.repeat(wl)+'☆'.repeat(3-wl)+'  PROCURADO';
    h.lineWidth=5;h.strokeStyle='#080c0e';h.strokeText(txt,W/2,compact?58:44);
    h.fillStyle=Math.floor(performance.now()/350)%2?'#ff5a4f':'#5d95ff';h.fillText(txt,W/2,compact?58:44);
    h.restore();
  }
  const round = (x,y,w,hh,r,fill,stroke) => roundRect(h,x,y,w,hh,r,fill,stroke);

  // Radar inferior esquerdo. Mantém os dados reais do worldmap.js, com NPCs e direção atual.
  wmapTick();
  const T=hudTheme(),R=ms/2,mcx=mx+R,mcy=my+R;
  h.save();h.shadowColor='rgba(0,0,0,.28)';h.shadowBlur=18;h.shadowOffsetY=4;h.beginPath();h.arc(mcx,mcy,R+4,0,TAU);h.fillStyle=T.glass;h.fill();h.restore();
  h.save();
  h.beginPath(); h.arc(mcx,mcy,R,0,TAU); h.clip();
  drawMiniMap(h,mx,my,ms,p,st);
  window.CityGPS?.drawMini(h,mx,my,ms,p);
  h.restore();
  h.beginPath();h.arc(mcx,mcy,R+.5,0,TAU);h.strokeStyle=T.strong;h.lineWidth=3;h.stroke();
  h.beginPath();h.arc(mcx,mcy,R+4,0,TAU);h.strokeStyle=T.line;h.lineWidth=1;h.stroke();
  h.save(); h.translate(mx+ms/2,my+ms/2); h.rotate(p.face+cam.ang);
  h.fillStyle='#fff';h.strokeStyle='#091119';h.lineWidth=2;
  h.beginPath();h.moveTo(11,0);h.lineTo(-7,-6);h.lineTo(-3,0);h.lineTo(-7,6);h.closePath();h.fill();h.stroke();h.restore();
  const north=screenDirOf(0,-1);
  // norte: pastilha na borda do radar
  const nmx=mcx+north[0]*(R+4), nmy=mcy+north[1]*(R+4);
  h.beginPath();h.arc(nmx,nmy,9,0,TAU);h.fillStyle=T.strong;h.fill();h.strokeStyle=T.line;h.lineWidth=1;h.stroke();
  h.fillStyle=T.text;h.textAlign='center';h.textBaseline='middle';h.font='700 10px '+HUD_FONT;h.fillText('N',nmx,nmy+.5);h.textBaseline='alphabetic';
  drawMiniExtras(h,mcx,mcy,R,mx,my,ms,p,compact,W);

  // Vida, fôlego e necessidades vão cair/subir no loop real e são atualizadas aqui.
  const conditions=[
    ['heart',st.hp,'#3bb9ee'],
    ['shield',needs.stamina??1,'#65d59b'],
    ['person',st.food,'#d6e0ec'],
    ['bolt',needs.energy??1,'#52c9e9'],
    ['food',st.water,'#e96b67'],
    ['mood',needs.hygiene??1,'#8cce8c'],
    ['group',1-(needs.bladder??0),'#c5d3e1']
  ];
  const shown=conditions.filter(([icon,value])=>T.full||clamp(value,0,1)<(icon==='heart'?.98:.55));
  const nx=mx+ms+16, barX=nx+22;
  const barW=compact?Math.max(34,Math.min(96,W-barX-9)):112;
  const lineH=compact?18:22, barH=4;
  const ny=my+ms-shown.length*lineH-2;
  if(shown.length){
    // cartão de vidro atrás das barras
    h.save();h.shadowColor='rgba(0,0,0,.2)';h.shadowBlur=14;h.shadowOffsetY=3;
    round(nx-10,ny-9,barW+44,shown.length*lineH+8,14,T.glass,null);h.restore();
    round(nx-10,ny-9,barW+44,shown.length*lineH+8,14,null,T.line);
  }
  for(let i=0;i<shown.length;i++){
    const [icon,value,color]=shown[i], v=clamp(value,0,1), y=ny+i*lineH;
    drawNeedIcon(h,icon,nx+6,y+3,compact?.62:.7);
    round(barX,y+1,barW,barH,barH/2,T.dark?'rgba(255,255,255,.16)':'rgba(24,34,38,.12)',null);
    if(v>.005)round(barX,y+1,Math.max(barH,barW*v),barH,barH/2,v<.2?'#e0655c':color,null);
  }

  // Identidade, horário dinâmico e dinheiro do jogador.
  const minute = ((Math.floor(st.clock)%1440)+1440)%1440;
  const clock = String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
  const tx=W-(compact?14:26), ty=compact?16:22;
  if('letterSpacing' in h)h.letterSpacing='1.5px';
  hudText(h,clock,tx,ty+(compact?26:36),'400 '+(compact?28:40)+'px '+HUD_DISPLAY,'#fff','right');
  if('letterSpacing' in h)h.letterSpacing='0px';
  hudText(h,CityLife.money(CityLife.funds),tx,ty+(compact?46:62),'600 '+(compact?13:15)+'px '+HUD_FONT,'#fff','right');
  const loc=window.CityDistrictsLocation?.();
  const district=typeof OW!=='undefined' && OW.geo && typeof COG!=='undefined' && COG.D_NAMES ? COG.D_NAMES[OW.geo.districtAt(p.x,p.y)] : 'Cidade';
  if(!compact){
    if('letterSpacing' in h)h.letterSpacing='2px';
    hudText(h,String(loc?.neighborhood||district).toUpperCase(),tx,ty+82,'700 10px '+HUD_FONT,'rgba(255,255,255,.85)','right');
    if('letterSpacing' in h)h.letterSpacing='0px';
    if(loc?.gang)hudText(h,'● '+loc.gang.name,tx,ty+98,'600 11px '+HUD_FONT,loc.gang.color,'right');
  }
  const driving=!!window.cityVehicles?.driver;
  // arma: só aparece com ela em mãos (canto inferior direito, ao lado do dock)
  if(!driving&&p.armed){
    const label=(p.weapon?.name||'Fuzil')+'  ·  '+p.ammo+' / '+p.reserve, by=H-(compact?18:26);
    hudText(h,label,W-(compact?66:84),by,'600 '+(compact?12:14)+'px '+HUD_FONT,'#fff','right');
    const icon=p.weaponId?hudIcon(p.weaponId):null;
    if(icon?.complete&&icon.naturalWidth){const w=compact?50:64,hh=w*icon.naturalHeight/icon.naturalWidth;h.drawImage(icon,W-(compact?66:84)-h.measureText(label).width-w-8,by-hh*.8,w,hh);}
  }
  // dicas de teclado só no começo da sessão (depois somem: a tela fica do mundo)
  const since=(performance.now()-hudStart)/1000;
  if(since<75&&!window.CityUI?.blocksGameInput()){
    h.save();h.globalAlpha=Math.min(1,(75-since)/6);
    hudText(h,(compact?'I Mochila · U Armas · P Celular':'I Mochila  ·  TAB Armas  ·  P Celular  ·  M Mapa'),mx,my-16,'600 12px '+HUD_FONT,'rgba(255,255,255,.92)','left');
    h.restore();
  }

  // Mira só aparece armado e fora das interfaces.
  if(p.armed && !driving && !window.CityUI?.blocksGameInput()){
    const cx=input.mx,cy=input.my;
    h.strokeStyle='#031017';h.lineWidth=4;crosshair(h,cx,cy,p);
    h.strokeStyle=p.ammo===0?'#ff7668':'#ffffff';h.lineWidth=2;crosshair(h,cx,cy,p);
    if(p.reloadT>=0){
      h.strokeStyle='#f4cd67';h.lineWidth=3;h.beginPath();
      h.arc(cx,cy,20,-Math.PI/2,-Math.PI/2+TAU*p.reloadT/RELOAD.dur);h.stroke();
    }
  }

  // Avisos do mundo: tipografia branca grande, sem cartão opaco.
  if(hud.msgT>0){
    const alpha=clamp(hud.msgT,0,1);
    h.globalAlpha=alpha;
    const msgY=compact?170:135,msgW=Math.min(W-24,850);
    drawHudHeadline(h,hud.msg,W/2,msgY,compact?18:27,msgW,'center');h.globalAlpha=1;
  }
  h.restore();
}
function drawNeedIcon(h, icon, x, y, scale=1) {
  h.save();h.translate(x,y);h.scale(scale,scale);
  h.fillStyle='#f8fcff';h.strokeStyle='#f8fcff';h.lineWidth=1.6;
  h.lineCap='round';h.lineJoin='round';
  if(icon==='heart'||icon==='mood'){
    h.beginPath();h.moveTo(0,6);h.bezierCurveTo(-12,-1,-7,-8,0,-3);h.bezierCurveTo(7,-8,12,-1,0,6);h.fill();
    if(icon==='mood'){h.strokeStyle='#4a5d59';h.lineWidth=1;h.beginPath();h.arc(-2,-1,.4,0,TAU);h.arc(2,-1,.4,0,TAU);h.moveTo(-2,2);h.quadraticCurveTo(0,4,2,2);h.stroke();}
  }else if(icon==='shield'){
    h.beginPath();h.moveTo(0,-7);h.lineTo(6,-5);h.lineTo(5,1);h.quadraticCurveTo(4,5,0,7);h.quadraticCurveTo(-4,5,-5,1);h.lineTo(-6,-5);h.closePath();h.fill();
  }else if(icon==='person'){
    h.beginPath();h.arc(0,-4,3,0,TAU);h.fill();h.beginPath();h.moveTo(-6,6);h.quadraticCurveTo(-5,0,0,0);h.quadraticCurveTo(5,0,6,6);h.closePath();h.fill();
  }else if(icon==='bolt'){
    h.beginPath();h.moveTo(1,-8);h.lineTo(-5,1);h.lineTo(-1,1);h.lineTo(-3,8);h.lineTo(6,-2);h.lineTo(1,-2);h.closePath();h.fill();
  }else if(icon==='food'){
    h.beginPath();h.arc(-2,1,4.5,0,TAU);h.arc(3,1,4.5,0,TAU);h.fill();h.beginPath();h.moveTo(0,-4);h.quadraticCurveTo(2,-8,5,-7);h.quadraticCurveTo(4,-4,0,-4);h.fill();
  }else{
    for(const [dx,dy,r] of [[-4,-4,2],[4,-4,2],[0,1,2]]){h.beginPath();h.arc(dx,dy,r,0,TAU);h.fill();}
    h.beginPath();h.moveTo(-8,6);h.quadraticCurveTo(-8,2,-4,2);h.quadraticCurveTo(-1,2,0,5);h.quadraticCurveTo(1,2,4,2);h.quadraticCurveTo(8,2,8,6);h.closePath();h.fill();
  }
  h.restore();
}
function screenDirOf(wx, wy) { const r = [cam.cos * wx - cam.sin * wy, (cam.sin * wx + cam.cos * wy)]; const l = Math.hypot(r[0], r[1]); return [r[0] / l, r[1] / l]; }

function crosshair(h, x, y, p) {
  const sp = 6 + (1 - p.aimV) * 10 + Math.max(0, 0.2 - p.recoilT) * 40;
  h.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { h.moveTo(x + dx * sp, y + dy * sp); h.lineTo(x + dx * (sp + 7), y + dy * (sp + 7)); }
  h.moveTo(x + 1, y); h.arc(x, y, 1, 0, TAU);
  h.stroke();
}

function drawIcon(h, i, x, y) {
  h.save(); h.translate(x, y); h.lineJoin = 'round'; h.lineCap = 'round';
  const P = (pts, f) => { h.beginPath(); pts.forEach(([a, b], k) => k ? h.lineTo(a, b) : h.moveTo(a, b)); h.closePath(); h.fillStyle = f; h.fill(); h.strokeStyle = '#000'; h.lineWidth = 1.5; h.stroke(); };
  if (i === 0) {   // fuzil
    P([[-24, -2], [-12, -6], [8, -6], [8, -4], [24, -4], [24, -2], [8, -2], [6, 1], [-6, 1], [-8, 7], [-12, 7], [-11, 1], [-24, 4]], '#3a3a40');
    P([[-2, 1], [2, 1], [4, 10], [0, 10]], '#2a2a2e');
    P([[6, -6], [18, -6], [18, -2], [6, -2]], '#4a5644');
  } else if (i === 1) { P([[-8, 10], [-10, -4], [-6, -10], [6, -10], [10, -4], [8, 10]], '#e0a070'); }
  else if (i === 2) { P([[-7, -12], [7, -12], [7, 12], [-7, 12]], '#2a2d33'); h.fillStyle = '#5f86a6'; h.fillRect(-5, -9, 10, 16); }
  else if (i === 3) { P([[-11, 0], [-9, -8], [9, -8], [11, 0]], '#d99a3a'); P([[-12, 1], [12, 1], [12, 4], [-12, 4]], '#6b3a1e'); P([[-11, 5], [11, 5], [9, 10], [-9, 10]], '#d99a3a'); }
  else if (i === 4) { P([[-5, -6], [-3, -12], [3, -12], [5, -6], [5, 12], [-5, 12]], '#9cc8e6'); }
  else if (i === 5) { P([[-12, -8], [12, -8], [12, 10], [-12, 10]], '#d33b2c'); h.fillStyle = '#fff'; h.fillRect(-2, -5, 4, 12); h.fillRect(-6, -1, 12, 4); }
  else { P([[-3, -12], [3, -12], [3, 6], [6, 12], [-6, 12], [-3, 6]], '#9a9aa2'); }
  h.restore();
}

// ---------- extras do minimapa: pontos cardeais no aro, nome da rua e cartão do GPS (próxima curva) ----------
function drawMiniExtras(h,cx,cy,R,mx,my,ms,p,compact,W){
  h.save();h.textAlign='center';h.textBaseline='middle';h.font='700 8px '+HUD_FONT;
  for(const [lab,dx,dy] of [['L',1,0],['S',0,1],['O',-1,0]]){const d=screenDirOf(dx,dy);h.fillStyle='rgba(255,255,255,.75)';h.fillText(lab,cx+d[0]*(R-8),cy+d[1]*(R-8));}
  for(let i=0;i<24;i++){const a=i/24*TAU+(Math.atan2(screenDirOf(0,-1)[1],screenDirOf(0,-1)[0])),r1=R-1.5,r2=R-(i%6===0?6:3.5);h.beginPath();h.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);h.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);h.strokeStyle='rgba(255,255,255,.35)';h.lineWidth=1;h.stroke();}
  // nome da rua (pastilha na base do radar)
  const name=typeof miniStreetName==='function'?miniStreetName(p):'';
  if(name){h.font='700 '+(compact?9:11)+'px '+HUD_FONT;const w=Math.min(ms+40,h.measureText(name).width+22),y=cy+R+(compact?2:4);
    h.fillStyle='rgba(9,17,25,.86)';h.beginPath();h.roundRect(cx-w/2,y-9,w,18,9);h.fill();h.strokeStyle='rgba(255,255,255,.18)';h.stroke();
    h.fillStyle='#f3f7fa';h.fillText(name,cx,y+.5,w-12);}
  // GPS: seta da próxima manobra, distância e rua
  const gps=window.CityGPS,t=gps?.target&&gps.nextTurn?.(p);
  if(t){
    const x=mx+ms+16,y=my-(compact?6:2),w=compact?150:206,hh=compact?40:48;
    h.fillStyle='rgba(9,17,25,.9)';h.beginPath();h.roundRect(x,y,w,hh,10);h.fill();h.strokeStyle='rgba(70,188,250,.55)';h.lineWidth=1.4;h.stroke();
    // seta
    const ax=x+(compact?20:25),ay=y+hh/2;h.save();h.translate(ax,ay);h.strokeStyle='#46bcfa';h.fillStyle='#46bcfa';h.lineWidth=3;h.lineCap='round';h.lineJoin='round';
    h.beginPath();
    if(t.dir==='arrive'){h.arc(0,-2,6,0,TAU);h.stroke();h.beginPath();h.moveTo(0,4);h.lineTo(0,10);h.stroke();}
    else if(t.dir==='uturn'){h.moveTo(5,10);h.lineTo(5,-3);h.arc(0,-3,5,0,Math.PI,true);h.lineTo(-5,4);h.stroke();h.beginPath();h.moveTo(-9,1);h.lineTo(-5,7);h.lineTo(-1,1);h.stroke();}
    else{const s=t.dir==='right'?1:-1;h.moveTo(-s*4,11);h.lineTo(-s*4,0);h.quadraticCurveTo(-s*4,-6,s*3,-6);h.lineTo(s*8,-6);h.stroke();h.beginPath();h.moveTo(s*4,-11);h.lineTo(s*10,-6);h.lineTo(s*4,-1);h.stroke();}
    h.restore();
    const dm=t.dist<1000?Math.max(10,Math.round(t.dist/10)*10)+' m':(t.dist/1000).toFixed(1)+' km';
    const verb=t.dir==='arrive'?'Destino':t.dir==='uturn'?'Retorne':t.dir==='right'?'Vire à direita':'Vire à esquerda';
    h.textAlign='left';h.textBaseline='alphabetic';h.fillStyle='#ffffff';h.font='800 '+(compact?13:16)+'px '+HUD_FONT;h.fillText(dm,x+(compact?40:50),y+(compact?17:21));
    h.font='600 '+(compact?9:11)+'px '+HUD_FONT;h.fillStyle='#b9d7ea';h.fillText(verb+(t.street&&t.dir!=='arrive'?' · '+t.street:t.dir==='arrive'?' · '+t.street:''),x+(compact?40:50),y+(compact?31:37),w-(compact?46:58));
    // dica do piloto a pé
    if(!window.cityVehicles?.driver&&!window.CityAutopilot?.active){h.font='600 '+(compact?8:10)+'px '+HUD_FONT;h.fillStyle='rgba(185,215,234,.8)';h.textAlign='right';h.fillText('G 🚶',x+w-8,y+(compact?13:15));}
  }
  h.restore();
}
