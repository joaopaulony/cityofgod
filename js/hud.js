// hud.js — retrato pixelado, barras, relógio, minimapa, hotbar e mira (canvas em resolução cheia).
'use strict';

const hud = { portrait: null, msg: '', msgT: 0 };

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
  const p = st.player, needs = st.needs || {}, compact = W < 740;
  const ms = compact ? Math.min(118, Math.max(90, W * .29)) : 164;
  const mx = compact ? 10 : 20, my = Math.max(102, H - ms - (compact ? 16 : 24));
  const panel = 'rgba(7,14,24,.82)', border = 'rgba(164,222,251,.34)';
  const glow = 'rgba(105,198,252,.48)';
  const round = (x,y,w,hh,r,fill,stroke) => roundRect(h,x,y,w,hh,r,fill,stroke);

  // Radar inferior esquerdo. Mantém os dados reais do worldmap.js, com NPCs e direção atual.
  wmapTick();
  h.save();
  h.shadowColor='#020815';h.shadowBlur=25;h.shadowOffsetY=5;
  round(mx-5,my-5,ms+10,ms+10,14,panel,border);h.restore();
  // Linha de borda azul, relevo e texto discreto — radar com identidade própria.
  h.save();h.strokeStyle=glow;h.lineWidth=2;h.beginPath();
  h.moveTo(mx+10,my-5);h.lineTo(mx+ms*.45,my-5);h.stroke();h.restore();
  h.save();
  h.beginPath(); h.roundRect(mx,my,ms,ms,5); h.clip();
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
    ['VIDA',st.hp,'#ee675f'],
    ['FÔLEGO',needs.stamina??1,'#f4d47f'],
    ['FOME',st.food,'#efb96e'],
    ['SEDE',st.water,'#67c8e5'],
    ['ENERGIA',needs.energy??1,'#a99beb'],
    ['HIGIENE',needs.hygiene??1,'#8dddac'],
    ['BANHEIRO',1-(needs.bladder??0),'#c6d2e1']
  ];
  const visible = compact ? conditions.slice(0,4) : conditions;
  const nx = mx + ms + 14, nw = compact ? Math.min(132,W-nx-12) : 190;
  const lineH=compact?24:25, ny=compact?Math.max(10,my-25-lineH*visible.length):my-3;
  h.save();h.shadowColor='#010815';h.shadowBlur=19;
  round(nx-9,ny-13,nw+18,visible.length*lineH+25,14,panel,border);h.restore();
  h.save();h.fillStyle='#76c9f0';h.beginPath();h.roundRect(nx-9,ny-9,3,visible.length*lineH+17,2);h.fill();h.restore();
  for(let i=0;i<visible.length;i++){
    const [label,value,color]=visible[i], v=clamp(value,0,1), y=ny+i*lineH;
    h.textBaseline='alphabetic';h.font=(compact?'600 9px':'600 10px')+' system-ui';
    h.textAlign='left';h.fillStyle='#e5edf0';h.fillText(label,nx,y+10);
    h.textAlign='right';h.fillStyle=v<.2?'#ff9691':'#c4d4d8';h.fillText(Math.round(v*100)+'%',nx+nw,y+10);
    round(nx,y+14,nw,5,2,'#01090d');
    if(v>.005) {
      round(nx,y+14,nw*v,5,2,v<.18?'#f45555':color);
      h.save();h.globalAlpha=.2;h.fillStyle='#fff';h.fillRect(nx+Math.min(nw*v,4),y+14,Math.max(0,nw*v-8),1);h.restore();
    }
  }
  if(compact){
    h.font='600 10px system-ui';h.textAlign='left';h.textBaseline='alphabetic';
    h.fillStyle='#e8f6f1';
    h.fillText('⚡ '+Math.round((needs.energy??1)*100)+'%  🧼 '+Math.round((needs.hygiene??1)*100)+'%  🚻 '+Math.round((1-(needs.bladder??0))*100)+'%',mx,35);
  }

  // Identidade, horário dinâmico e dinheiro do jogador.
  const minute = ((Math.floor(st.clock)%1440)+1440)%1440;
  const clock = String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
  const topW=compact?151:216, tx=W-topW-17, ty=14;
  h.save();h.shadowColor='#07101b';h.shadowBlur=19;
  round(tx,ty,topW,compact?77:101,15,panel,border);h.restore();
  h.save();h.fillStyle='#65c7ee';h.beginPath();h.roundRect(tx+11,ty+10,3,compact?56:81,2);h.fill();h.restore();
  h.textAlign='left';h.textBaseline='alphabetic';h.font='700 10px system-ui';h.fillStyle='#74d2f5';
  h.fillText('CITY OF GOD  ·  LIVE',tx+21,ty+17);
  h.textAlign='right';h.textBaseline='alphabetic';
  h.fillStyle='#f7f9fa';h.font=(compact?'700 21px':'700 27px')+' system-ui';
  h.fillText(clock,tx+topW-13,ty+42);
  h.fillStyle='#7de3b4';h.font=(compact?'700 13px':'700 17px')+' system-ui';
  h.fillText(CityLife.money(CityLife.funds),tx+topW-13,ty+65);
  if(!compact) {
    h.fillStyle='#a7c2ce';h.font='11px system-ui';
    const weather=typeof envWeather==='function' ? envWeather().name : 'Tempo';
    const district=typeof OW!=='undefined' && OW.geo && typeof COG!=='undefined' && COG.D_NAMES
     ? COG.D_NAMES[OW.geo.districtAt(p.x,p.y)] : 'Cidade';
    h.fillText(district+' · '+weather,tx+topW-13,ty+87);
  }

  // Arma selecionada e balas do sistema existente. Mãos vazias não disparam.
  const driving=!!window.cityVehicles?.driver;
  if(!driving) {
    const weapon = p.armed ? 'FUZIL' : 'MÃOS LIVRES', ammo=p.armed?p.ammo+'/'+p.reserve:'SEM ARMA';
    const barW=compact?144:206, bx=W/2-barW/2, by=H-(compact?104:53);
    if(bx>mx+ms+6) {
      h.save();h.shadowColor='#000a';h.shadowBlur=16;round(bx,by,barW,37,11,panel,border);h.restore();
      h.save();h.fillStyle='#82d1f7';h.beginPath();h.roundRect(bx,by+8,3,21,2);h.fill();h.restore();
      h.textAlign='left';h.fillStyle='#e6eff5';h.font='700 11px system-ui';h.fillText(weapon,bx+11,by+14);
      h.fillStyle='#e8c97e';h.font='700 13px system-ui';h.fillText(ammo,bx+11,by+29);
      if(!compact){h.textAlign='right';h.fillStyle='#96afbd';h.font='11px system-ui';h.fillText('TAB/U · ARMAS',bx+barW-10,by+23);}
    }
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

  // Avisos legíveis sem esconder o painel de veículos nem o minimapa.
  if(hud.msgT>0){
    const alpha=clamp(hud.msgT,0,1);
    h.globalAlpha=alpha;h.font='700 14px system-ui';h.textAlign='center';
    const msgW=Math.min(W-24,Math.max(175,h.measureText(hud.msg).width+30)),msgY=Math.max(114,H*.25);
    round((W-msgW)/2,msgY-24,msgW,34,7,panel,border);
    h.fillStyle='#fce7ac';h.fillText(hud.msg,W/2,msgY-3);h.globalAlpha=1;
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
