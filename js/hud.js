// hud.js — retrato pixelado, barras, relógio, minimapa, hotbar e mira (canvas em resolução cheia).
'use strict';

const hud = { portrait: null, msg: '', msgT: 0 };

function hudMapLayout(W,H) {
  const compact=W<740,ms=compact?Math.min(118,Math.max(90,W*.29)):164;
  return {compact,ms,mx:compact?10:18,my:Math.max(102,H-ms-(compact?14:18))};
}

function roundRect(g, x, y, w, h, r, fill, stroke) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); }
}

function drawHUD(h, W, H, st) {
  h.clearRect(0, 0, W, H);
  // HUD de mundo aberto: informação útil, sem os botões decorativos antigos.
  if (wmap.open) return;
  h.save(); h.imageSmoothingEnabled = true;
  const p = st.player, needs = st.needs || {};
  const {compact,ms,mx,my}=hudMapLayout(W,H);
  const round = (x,y,w,hh,r,fill,stroke) => roundRect(h,x,y,w,hh,r,fill,stroke);

  // Radar inferior esquerdo. Mantém os dados reais do worldmap.js, com NPCs e direção atual.
  wmapTick();
  h.save();
  h.beginPath(); h.rect(mx,my,ms,ms); h.clip();
  drawMiniMap(h,mx,my,ms,p,st);
  h.restore();
  window.CityGPS?.drawMini(h,mx,my,ms,p);
  h.save(); h.translate(mx+ms/2,my+ms/2); h.rotate(p.face+cam.ang);
  h.fillStyle='#fff';h.strokeStyle='#091119';h.lineWidth=2;
  h.beginPath();h.moveTo(11,0);h.lineTo(-7,-6);h.lineTo(-3,0);h.lineTo(-7,6);h.closePath();h.fill();h.stroke();h.restore();
  const north=screenDirOf(0,-1);
  h.fillStyle='#f8fcff';h.strokeStyle='#0b1720';h.lineWidth=3;
  h.textAlign='center';h.font='bold 12px system-ui';
  const nmx=mx+ms/2+north[0]*(ms/2-13), nmy=my+ms/2+north[1]*(ms/2-13)+4;
  h.strokeText('N',nmx,nmy);h.fillText('N',nmx,nmy);

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
  const nx=mx+ms+11, barX=nx+26;
  const barW=compact?Math.max(34,Math.min(115,W-barX-9)):140;
  const lineH=compact?17:23, barH=compact?9:12;
  const ny=my+(ms-conditions.length*lineH)/2;
  for(let i=0;i<conditions.length;i++){
    const [icon,value,color]=conditions[i], v=clamp(value,0,1), y=ny+i*lineH;
    drawNeedIcon(h,icon,nx+10,y+barH/2+1,compact?.72:.88);
    round(barX,y,barW,barH,barH/2,'rgba(66,68,72,.43)','rgba(255,255,255,.39)');
    if(v>.005){
      h.save();h.shadowColor=color;h.shadowBlur=compact?3:5;
      round(barX+3,y+3,Math.max(1,(barW-6)*v),barH-6,(barH-6)/2,v<.16?'#f07069':color);
      h.restore();
    }
  }

  // Identidade, horário dinâmico e dinheiro do jogador.
  const minute = ((Math.floor(st.clock)%1440)+1440)%1440;
  const clock = String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
  const tx=W-(compact?13:24), ty=compact?17:23;
  h.textAlign='right';h.textBaseline='alphabetic';h.font='800 11px "Bahnschrift SemiCondensed","Arial Narrow",sans-serif';h.fillStyle='#f0f5ee';
  h.shadowColor='#06100f';h.shadowBlur=8;
  h.fillText('CITY OF GOD  ·  LIVE',tx,ty);
  h.textAlign='right';h.textBaseline='alphabetic';
  h.fillStyle='#f7f9f2';h.font=(compact?'800 25px':'800 34px')+' "Bahnschrift SemiCondensed","Arial Narrow",Impact,sans-serif';
  h.fillText(clock,tx,ty+32);
  h.fillStyle='#9de0ae';h.font=(compact?'800 15px':'800 19px')+' "Arial Narrow",sans-serif';
  h.fillText(CityLife.money(CityLife.funds),tx,ty+54);
  const driving=!!window.cityVehicles?.driver;
  if(!driving){
    h.fillStyle='#f5f7f5';h.font=(compact?'800 12px':'800 15px')+' "Bahnschrift SemiCondensed","Arial Narrow",sans-serif';
    h.fillText(p.armed?'FUZIL  ·  '+p.ammo+' / '+p.reserve+' BALAS':'MÃOS LIVRES  ·  SEM ARMA',tx,ty+75);
  }
  if(!compact) {
    h.fillStyle='#e0e9df';h.font='700 12px "Arial Narrow",sans-serif';
    const weather=typeof envWeather==='function' ? envWeather().name : 'Tempo';
    const district=typeof OW!=='undefined' && OW.geo && typeof COG!=='undefined' && COG.D_NAMES
     ? COG.D_NAMES[OW.geo.districtAt(p.x,p.y)] : 'Cidade';
    h.fillText((window.CityDistrictsLocation?.()?.neighborhood||district)+' · '+weather,tx,ty+94);
  }

  const loc=window.CityDistrictsLocation?.();
  if(loc && !compact){
    const subY=ty+112;
    h.textAlign='right';h.font='800 11px "Arial Narrow",sans-serif';h.fillStyle='#f7f6ed';
    h.fillText(loc.street||'Explorando a cidade',tx,subY);
    if(loc.gang){h.fillStyle=loc.gang.color;h.fillText('● TERRITÓRIO · '+loc.gang.name,tx,subY+16);}
  }
  // Atalhos ficam em uma única notificação discreta acima do radar.
  if(!window.CityUI?.blocksGameInput()){
    const keys=compact?'I Mochila  ·  U Armas  ·  P Celular':'I Mochila   ·   TAB/U Armas   ·   P Celular';
    const hintW=Math.min(W-mx-12,compact?Math.max(225,W-20):302),hintY=my-36;
    round(mx,hintY,hintW,26,8,'rgba(82,90,94,.58)','rgba(255,255,255,.41)');
    h.shadowBlur=0;h.fillStyle='#fff';h.textAlign='left';h.font='700 11px "Bahnschrift SemiCondensed","Arial Narrow",sans-serif';
    h.fillText(keys,mx+10,hintY+17,hintW-20);
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
    h.globalAlpha=alpha;h.font=(compact?'900 18px':'900 27px')+' "Bahnschrift SemiCondensed","Arial Narrow",Impact,sans-serif';
    h.textAlign='center';h.textBaseline='alphabetic';h.lineJoin='round';h.lineWidth=5;
    h.shadowColor='#000';h.shadowBlur=8;h.strokeStyle='#090c0e';h.fillStyle='#fff';
    const msgY=compact?150:115,msgW=Math.min(W-24,850);
    h.strokeText(hud.msg,W/2,msgY,msgW);h.fillText(hud.msg,W/2,msgY,msgW);h.globalAlpha=1;
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
