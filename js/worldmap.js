// worldmap.js — minimapa e mapa completo (tecla M).
// Mundo grande: base do atlas (worldgen/atlas-paint.js, 4 m/px) pintada em fatias depois da carga, com vias vetoriais
// nítidas por cima; o mapa completo cacheia a imagem e só a refaz ao mudar zoom/posição (roda = zoom, arrastar = mover).
// Mapa local de teste (?seed=N): usa a textura do chão (world.ground).
'use strict';

const wmap = { open:false, mini:null, base:null, scale:0, ox:0, oy:0, cache:null,key:'',drag:null,clickStart:null,
  palette:'city',hover:null,dragDistance:0 };
function wmapWorldSize() { return world.open ? [OW.geo.W, OW.geo.H] : [world.ground.width / world.groundPPM, world.ground.height / world.groundPPM]; }
function wmapBounds(W=hudC.width,H=hudC.height){
  const [ww,wh]=wmapWorldSize(),margin=26,top=62,bottom=44;
  // When zoomed out the map is centered. At high zoom keep some land visible.
  if(ww*wmap.scale<W-300)wmap.ox=(W-ww*wmap.scale)/2;
  else wmap.ox=Math.max(W-ww*wmap.scale-margin,Math.min(margin,wmap.ox));
  if(wh*wmap.scale<H-top-bottom)wmap.oy=top+(H-top-bottom-wh*wmap.scale)/2;
  else wmap.oy=Math.max(H-wh*wmap.scale-bottom,Math.min(top,wmap.oy));
}
function wmapTick() {
  if (!world.open || typeof OW === 'undefined' || !OW.cw) return;
  if (!wmap.mini) { wmap.mini=COG.atlasBase(OW.cw,COG.WORLD_SEED,4,{roofs:false});wmap.base=COG.atlasBase(OW.cw,COG.WORLD_SEED,4); }
  if(wmap.open && !wmap.base.done)wmap.base.step(9); 
  else if(!wmap.mini.done)wmap.mini.step(3);
  else if(!wmap.base.done)wmap.base.step(3);
}
function wmapFit(W,H,followPlayer=true){
  const [ww,wh]=wmapWorldSize();
  const fit=Math.min((W-315)/ww,(H-108)/wh);
  wmap.scale=Math.max(.025,fit*(followPlayer?1.62:1));
  const p=typeof player!=='undefined'?player:{x:ww/2,y:wh/2};
  wmap.ox=W/2-(followPlayer?p.x:ww/2)*wmap.scale-90;
  wmap.oy=(H+60)/2-(followPlayer?p.y:wh/2)*wmap.scale;
  wmapBounds(W,H);
}
function wmapZoomAt(sx,sy,f){
  if(!wmap.scale)return;
  const [ww,wh]=wmapWorldSize(),W=hudC.width,H=hudC.height;
  const min=Math.min((W-315)/ww,(H-108)/wh)*.9;
  const next=clamp(wmap.scale*f,min,5),ratio=next/wmap.scale;
  wmap.ox=sx-(sx-wmap.ox)*ratio;wmap.oy=sy-(sy-wmap.oy)*ratio;
  wmap.scale=next;wmapBounds(W,H);
}
function wmapDrag(dx,dy){wmap.ox+=dx;wmap.oy+=dy;wmap.dragDistance+=Math.hypot(dx,dy);wmapBounds();}
function wmapPointer(x,y){
  wmap.hover=[x,y];
  const out=document.getElementById('city-map-hover');
  if(out&&wmap.scale){
    const xx=(x-wmap.ox)/wmap.scale,yy=(y-wmap.oy)/wmap.scale;
    let street='';
    if(world.open&&typeof OW!=='undefined'&&window.CityGPS?.roadAt){
      street=window.CityGPS.roadAt(xx,yy);
    }
    out.textContent=(street?street+' · ':'')+'X '+Math.round(xx)+' · Y '+Math.round(yy);
  }
}
function wmapShell(){
  let root=document.getElementById('city-map-ui');
  if(root)return root;
  root=document.createElement('div');root.id='city-map-ui';
  root.innerHTML=`<header class="map-header">
    <div class="map-brand"><small>MAPA TÁTICO · BELLAVISTA</small><strong>Mapa da cidade</strong></div>
    <div class="map-header-info">Explore as ruas · selecione um destino · siga a rota azul</div>
    <button type="button" id="city-map-close" title="Fechar mapa (Esc)">✕ <span>Fechar</span></button>
  </header>
  <aside class="map-sidebar">
   <div class="map-sidebar-title">LOCALIZAÇÕES <small>FILTROS</small></div>
   <div id="city-map-filters" class="map-filters"></div>
   <div class="map-side-group">
    <span>TERRITÓRIOS</span><div id="city-map-gangs"></div>
   </div>
   <div class="map-side-group map-palette">
    <span>VISUAL</span>
    <button type="button" data-map-palette="city">Cartográfico</button>
    <button type="button" data-map-palette="terrain">Terreno</button>
   </div>
  </aside>
  <footer class="map-footer">
   <div class="map-controls"><kbd>Scroll</kbd> Zoom no cursor <kbd>Arrastar</kbd> Mover <kbd>Clique</kbd> Definir GPS <kbd>Esc</kbd> Sair</div>
   <div id="city-map-hover" class="map-hover">Passe o cursor por uma rua</div>
  </footer>
  <div class="map-route-status"><span class="map-route-icon">⌖</span><span id="city-gps-readout">Clique em uma rua ou ícone para traçar uma rota</span>
   <button type="button" id="city-gps-clear" hidden>Limpar rota</button></div>`;
  document.body.appendChild(root);
  root.querySelector('#city-map-close').addEventListener('click',()=>{if(wmap.open)wmapToggle();});
  root.querySelector('#city-gps-clear').addEventListener('click',()=>window.CityGPS?.clear());
  root.querySelectorAll('[data-map-palette]').forEach(button=>button.addEventListener('click',()=>{
    wmap.palette=button.dataset.mapPalette;wmap.key='';wmapPaletteButtons();
  }));
  root.querySelector('#city-map-filters').addEventListener('click',e=>{
    const button=e.target.closest('[data-map-filter]');
    if(!button)return;
    const type=button.dataset.mapFilter,on=window.CityGPS?.filter(type);
    button.classList.toggle('off',!on);button.setAttribute('aria-pressed',String(!!on));
  });
  return root;
}
function wmapPaletteButtons(){
  document.querySelectorAll('#city-map-ui [data-map-palette]').forEach(b=>b.classList.toggle('active',wmap.palette===b.dataset.mapPalette));
}
function wmapToggle(){
  wmap.open=!wmap.open;wmap.drag=null;wmap.clickStart=null;
  wmapShell().classList.toggle('active',wmap.open);
  document.body.classList.toggle('map-open',wmap.open);
  if(wmap.open){
    if(!wmap.scale)wmapFit(hudC.width,hudC.height,true);
    const filters=document.getElementById('city-map-filters'),gps=window.CityGPS;
    if(gps)filters.innerHTML=Object.entries(gps.labels).map(([type,title])=>
      '<button type="button" data-map-filter="'+type+'" aria-pressed="'+gps.enabled(type)+'" class="'+(gps.enabled(type)?'':'off')+'"><i style="background:'+(gps.colors[type]||'#9bc3e7')+'"></i>'+title+'</button>').join('');
    const gangs=world.open&&typeof OW!=='undefined'?OW.geo?.gangs||[]:[];
    document.getElementById('city-map-gangs').innerHTML=gangs.map(g=>
      '<div class="map-gang"><i style="background:'+g.color+'"></i>'+g.name+'</div>').join('');
    gps?.status&&document.getElementById('city-gps-readout')&&(document.getElementById('city-gps-readout').textContent=gps.status());
    wmapPaletteButtons();
  }
}
// ---------- minimapa (girado com a câmera) ----------
function drawMiniMap(h, mx, my, ms, p, st) {
  h.fillStyle = '#29331f'; h.fillRect(mx, my, ms, ms);
  const k = world.open ? 1.5 : 2.6;   // px por metro no mini
  const c = Math.cos(cam.ang), s = Math.sin(cam.ang), ex = mx + ms / 2 - (c * p.x - s * p.y) * k, ey = my + ms / 2 - (s * p.x + c * p.y) * k;
  const T = sc => h.setTransform(c * k * sc, s * k * sc, -s * k * sc, c * k * sc, ex, ey);
  h.imageSmoothingEnabled = true;
  if (!world.open) {
    T(1 / world.groundPPM); h.drawImage(world.ground, 0, 0);
    T(1);
    for (const H of houses) { h.fillStyle = H.style ? H.style.roofCol : H.roof; h.strokeStyle = '#000'; h.lineWidth = 0.2; h.fillRect(H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0); h.strokeRect(H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0); }
  } else {
    const B = wmap.mini && wmap.mini.done ? wmap.mini : null;
    if (B) { T(B.BP); h.drawImage(B.canvas, 0, 0); } else { T(1 / world.groundPPM); h.drawImage(world.ground, 0, 0); }
    // vias: só os trechos indexados em volta do jogador, contorno escuro + miolo por categoria
    T(1); h.lineCap = 'round'; h.lineJoin = 'round';
    const R = ms / k * 0.75, segs = [];
    OW.cw.roadIndex.query([p.x - R, p.y - R, p.x + R, p.y + R], e => { if (e.rd.cls !== 'rail') segs.push(e); });
    segs.sort((a, b) => (a.rd.cls === 'highway') - (b.rd.cls === 'highway'));
    for (const pass of [0, 1]) for (const { rd, k: i0 } of segs) {
      h.strokeStyle = pass ? (rd.cls === 'highway' ? '#f2c25a' : rd.cls === 'avenue' ? '#f4efe4' : '#e4dfd4') : 'rgba(28,24,20,0.85)';
      h.lineWidth = Math.max(rd.w, 4 / k) + (pass ? 0 : 2.4 / k);
      h.beginPath(); for (let i = i0; i < Math.min(rd.pts.length, i0 + 9); i++) { const [x, y] = rd.pts[i]; i === i0 ? h.moveTo(x, y) : h.lineTo(x, y); } h.stroke();
    }
    // prédios carregados por perto: telhado claro com contorno, torres um pouco mais escuras
    h.lineWidth = 1 / k; h.strokeStyle = 'rgba(30,26,22,0.9)';
    for (const H of houses) {
      if (H.x1 < p.x - R || H.x0 > p.x + R || H.y1 < p.y - R || H.y0 > p.y + R) continue;
      h.fillStyle = H.tall ? '#bdb8b0' : H.miaKind === 'poor' ? '#b49a7e' : '#e6ddcc';
      h.fillRect(H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0); h.strokeRect(H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0);
    }
  }
  T(1);
  for (const n of st.npcs) { h.fillStyle = '#f2c94c'; h.beginPath(); h.arc(n.x, n.y, 0.8 * 2.6 / k, 0, TAU); h.fill(); }
}

// ---------- mapa completo: camadas separadas e rótulos sem colisões ----------
function drawWorldMap(h,W,H,st){
  if(!wmap.scale)wmapFit(W,H);
  wmapTick();
  const sc=wmap.scale,S=(x,y)=>[wmap.ox+x*sc,wmap.oy+y*sc];
  const key=[W,H,sc.toFixed(5),wmap.ox|0,wmap.oy|0,wmap.palette,!!wmap.base?.done].join('|');
  if(wmap.key!==key){
    const cv=wmap.cache&&wmap.cache.width===W&&wmap.cache.height===H?wmap.cache:makeCanvas(W,H),g=cv.getContext('2d');
    g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H);
    g.fillStyle='#132231';g.fillRect(0,0,W,H);
    const [ww,wh]=wmapWorldSize();
    if(world.open&&wmap.base){
      g.save();
      if(wmap.palette==='city')g.filter='saturate(.55) brightness(.82)';
      g.imageSmoothingEnabled=sc<1/wmap.base.BP;
      g.drawImage(wmap.base.canvas,wmap.ox,wmap.oy,ww*sc,wh*sc);
      g.restore();
      COG.drawAtlasLayers(g,OW.cw,S,sc,1,{labels:false});
      // Labels rendered in their own pass after roads. No overlapping site labels.
      COG.drawLocationLabels?.(g,OW.cw,S,sc,1);
    }else if(world.ground){
      g.imageSmoothingEnabled=true;g.drawImage(world.ground,wmap.ox,wmap.oy,ww*sc,wh*sc);
      g.setTransform(sc,0,0,sc,wmap.ox,wmap.oy);
      for(const Hs of houses){g.fillStyle='#c7cbd0';g.fillRect(Hs.x0,Hs.y0,Hs.x1-Hs.x0,Hs.y1-Hs.y0);}
    }
    g.setTransform(1,0,0,1,0,0);
    wmap.cache=cv;wmap.key=key;
  }
  h.save();h.setTransform(1,0,0,1,0,0);
  h.drawImage(wmap.cache,0,0);
  window.CityGPS?.drawFull(h,S,st);
  // Tracked player: white chevron with blue halo.
  const [px,py]=S(st.player.x,st.player.y);
  h.beginPath();h.arc(px,py,13,0,TAU);h.fillStyle='#36b9f344';h.fill();
  h.save();h.translate(px,py);h.rotate(st.player.face);
  h.fillStyle='#ffffff';h.strokeStyle='#12253c';h.lineWidth=2.6;
  h.beginPath();h.moveTo(12,0);h.lineTo(-8,-8);h.lineTo(-3,0);h.lineTo(-8,8);h.closePath();h.fill();h.stroke();h.restore();
  // Scale, kept in the footer margin and away from controls.
  const m=[2000,1000,500,250,100,50,20,10].find(v=>v*sc<=135)||10,bar=m*sc;
  const bx=20,by=H-66;
  h.fillStyle='#091725d8';h.beginPath();h.roundRect(bx-10,by-26,Math.max(bar+21,87),40,8);h.fill();
  h.fillStyle='#eaf4ff';h.fillRect(bx,by,bar,3);
  h.font='600 11px system-ui';h.fillStyle='#fff';h.textAlign='left';h.textBaseline='alphabetic';
  h.fillText(m>=1000?(m/1000)+' km':m+' m',bx,by-7);
  h.restore();
}
