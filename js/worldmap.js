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
  if(wmap3d()){CityMap3D.zoomAt(sx,sy,f);return;}
  if(!wmap.scale)return;
  const [ww,wh]=wmapWorldSize(),W=hudC.width,H=hudC.height;
  const min=Math.min((W-315)/ww,(H-108)/wh)*.9;
  const next=clamp(wmap.scale*f,min,5),ratio=next/wmap.scale;
  wmap.ox=sx-(sx-wmap.ox)*ratio;wmap.oy=sy-(sy-wmap.oy)*ratio;
  wmap.scale=next;wmapBounds(W,H);
}
function wmapDrag(dx,dy){if(wmap3d()){CityMap3D.pan(dx,dy);wmap.dragDistance+=Math.hypot(dx,dy);return;}wmap.ox+=dx;wmap.oy+=dy;wmap.dragDistance+=Math.hypot(dx,dy);wmapBounds();}
function wmapPointer(x,y){
  wmap.hover=[x,y];
  const out=document.getElementById('city-map-hover');
  const w=wmapW(x,y);
  if(out&&w){
    const xx=w.x,yy=w.y;
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
    <button type="button" data-map-palette="city" title="Maquete 3D inclinada">3D</button>
    <button type="button" data-map-palette="top" title="Mapa 3D visto de cima">De cima</button>
    <button type="button" data-map-palette="classic" title="Mapa plano antigo">Clássico</button>
   </div>
   <div class="map-side-group map-palette">
    <span>CÂMERA</span>
    <button type="button" data-map-cam="me" title="Centralizar em mim">⌖ Eu</button>
    <button type="button" data-map-cam="north" title="Norte para cima">N ↑</button>
    <button type="button" data-map-cam="dest" title="Ver o destino">⚑ Destino</button>
   </div>
  </aside>
  <footer class="map-footer">
   <div class="map-controls"><kbd>Scroll</kbd> Zoom <kbd>Arrastar</kbd> Mover <kbd>Botão direito</kbd> Girar/inclinar <kbd>Q E</kbd> Girar <kbd>Clique</kbd> GPS <kbd>Esc</kbd> Sair</div>
   <div id="city-map-hover" class="map-hover">Passe o cursor por uma rua</div>
  </footer>
  <div class="map-route-status"><span class="map-route-icon">⌖</span><span id="city-gps-readout">Clique em uma rua ou ícone para traçar uma rota</span>
   <button type="button" id="city-gps-walk" hidden title="O personagem vai sozinho pela calçada (G)">🚶 Ir a pé</button>
   <button type="button" id="city-gps-clear" hidden>Limpar rota</button></div>`;
  document.body.appendChild(root);
  root.querySelector('#city-map-close').addEventListener('click',()=>{if(wmap.open)wmapToggle();});
  root.querySelector('#city-gps-clear').addEventListener('click',()=>window.CityGPS?.clear());
  root.querySelector('#city-gps-walk').addEventListener('click',()=>{if(wmap.open)wmapToggle();window.gpsWalkToggle?.();});
  root.querySelectorAll('[data-map-palette]').forEach(button=>button.addEventListener('click',()=>{
    wmap.palette=button.dataset.mapPalette;wmap.key='';wmapPaletteButtons();
    if(window.CityMap3D?.ready&&wmap.palette!=='classic')CityMap3D.setMode(wmap.palette==='top'?'2d':'3d');
  }));
  root.querySelectorAll('[data-map-cam]').forEach(button=>button.addEventListener('click',()=>{
    const M3=window.CityMap3D;if(!M3?.ready)return;const k=button.dataset.mapCam,t=window.CityGPS?.target;
    if(k==='me')M3.center(player.x,player.y);else if(k==='north')M3.north();else if(k==='dest'&&t)M3.center(t.x,t.y);
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
  if(wmap.open)window.CityMap3D?.close();
  wmap.open=!wmap.open;wmap.drag=null;wmap.clickStart=null;
  wmapShell().classList.toggle('active',wmap.open);
  document.body.classList.toggle('map-open',wmap.open);
  if(wmap.open){
    if(!wmap.scale)wmapFit(hudC.width,hudC.height,true);
    if(world.open)window.CityMap3D?.open(player);
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
// ---------- minimapa (girado com a câmera): chão pintado, calçadas, ruas, prédios com sombra, ícones, viaturas ----------
const MINIMAP_STATE = { k: 1.7, groundAt: 0, harvestAt: 0 };
const MINI_ROOF = { condo: '#e9e4da', office: '#a9bccb', deco: '#f2d6cb', poor: '#c49a72', bungalow: '#d98f6a', warehouse: '#b9bcbe', shop: '#e8cf9f', school: '#e8c95a', mansion: '#f0ece2' };
function drawMiniMap(h, mx, my, ms, p, st) {
  h.fillStyle = '#5f7148'; h.fillRect(mx, my, ms, ms);
  // zoom: mais perto a pé, mais longe dirigindo rápido
  const V = window.cityVehicles, sp = V?.driver ? Math.abs(V.car?.speed || 0) : 0;
  const want = !world.open ? 2.6 : V?.driver ? Math.max(.75, 1.35 - sp / 45) : 1.7;
  MINIMAP_STATE.k += (want - MINIMAP_STATE.k) * .05; const k = MINIMAP_STATE.k;
  const c = Math.cos(cam.ang), s = Math.sin(cam.ang), ex = mx + ms / 2 - (c * p.x - s * p.y) * k, ey = my + ms / 2 - (s * p.x + c * p.y) * k;
  const T = sc => h.setTransform(c * k * sc, s * k * sc, -s * k * sc, c * k * sc, ex, ey);
  const toScr = (x, y) => [mx + ms / 2 + (c * (x - p.x) - s * (y - p.y)) * k, my + ms / 2 + (s * (x - p.x) + c * (y - p.y)) * k];
  h.imageSmoothingEnabled = true;
  if (!world.open) {
    T(1 / world.groundPPM); h.drawImage(world.ground, 0, 0);
    T(1);
    for (const H of houses) { h.fillStyle = H.style ? H.style.roofCol : H.roof; h.strokeStyle = '#000'; h.lineWidth = 0.2; h.fillRect(H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0); h.strokeRect(H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0); }
    T(1);
    for (const n of st.npcs) { h.fillStyle = '#f2c94c'; h.beginPath(); h.arc(n.x, n.y, 0.8, 0, TAU); h.fill(); }
    return;
  }
  // chão pintado do mapa 3D (pintado uma vez, logo depois da carga) ou o atlas enquanto não fica pronto
  const M3 = window.CityMap3D, now = performance.now();
  if (M3 && !M3.ground && now - MINIMAP_STATE.groundAt > 2500) { MINIMAP_STATE.groundAt = now; M3.ensureGround?.(); }
  if (M3 && now - MINIMAP_STATE.harvestAt > 15000) { MINIMAP_STATE.harvestAt = now; M3.harvest?.(); }
  const G = M3?.ground, B = wmap.mini && wmap.mini.done ? wmap.mini : null;
  if (G) { T(1 / M3.groundPPM); h.drawImage(G, 0, 0); }
  else if (B) { T(B.BP); h.drawImage(B.canvas, 0, 0); } else { T(1 / world.groundPPM); h.drawImage(world.ground, 0, 0); }
  T(1); h.lineCap = 'round'; h.lineJoin = 'round';
  const R = ms / k * 0.75, segs = [];
  OW.cw.roadIndex.query([p.x - R, p.y - R, p.x + R, p.y + R], e => segs.push(e));
  segs.sort((a, b) => (a.rd.cls === 'highway') - (b.rd.cls === 'highway'));
  const run = (rd, i0, fn) => { h.beginPath(); for (let i = i0; i < Math.min(rd.pts.length, i0 + 9); i++) { const [x, y] = rd.pts[i]; i === i0 ? h.moveTo(x, y) : h.lineTo(x, y); } fn(); };
  // trilhos, calçada, asfalto e faixa central
  for (const { rd, k: i0 } of segs) if (rd.cls === 'rail') run(rd, i0, () => { h.strokeStyle = '#6d5f52'; h.lineWidth = 2.4; h.stroke(); });
  for (const { rd, k: i0 } of segs) if (rd.cls !== 'rail') run(rd, i0, () => { h.strokeStyle = '#ddd7c9'; h.lineWidth = rd.w + SIDE * 2; h.stroke(); });
  for (const { rd, k: i0 } of segs) if (rd.cls !== 'rail') run(rd, i0, () => { h.strokeStyle = rd.cls === 'highway' ? '#43464c' : '#55585e'; h.lineWidth = Math.max(rd.w, 3 / k); h.stroke(); });
  for (const { rd, k: i0 } of segs) if (rd.cls === 'avenue' || rd.cls === 'highway') run(rd, i0, () => { h.strokeStyle = '#e8c25a'; h.lineWidth = Math.max(.35, .9 / k); h.stroke(); });
  // prédios por perto: sombra para o lado oposto ao sol + telhado com a cor real
  const near = houses.filter(H => !(H.x1 < p.x - R || H.x0 > p.x + R || H.y1 < p.y - R || H.y0 > p.y + R));
  h.fillStyle = 'rgba(20,24,28,.32)';
  for (const H of near) { const o = Math.min(6, 1.2 + (H.nFloors || 1) * .9); h.fillRect(H.x0 + o * .55, H.y0 + o * .8, H.x1 - H.x0, H.y1 - H.y0); }
  h.lineWidth = .9 / k; h.strokeStyle = 'rgba(40,34,28,.8)';
  for (const H of near) {
    h.fillStyle = H.style?.roofCol || MINI_ROOF[H.miaKind] || H.roof || '#e6ddcc';
    h.fillRect(H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0); h.strokeRect(H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0);
  }
  // pessoas por perto (pontos discretos)
  h.fillStyle = 'rgba(255,240,190,.85)';
  for (const n of st.npcs) { if (Math.abs(n.x - p.x) > R || Math.abs(n.y - p.y) > R) continue; h.beginPath(); h.arc(n.x, n.y, 1.4 / k * 1.6, 0, TAU); h.fill(); }
  h.setTransform(1, 0, 0, 1, 0, 0);
  // viaturas: piscam vermelho/azul
  const blink = Math.floor(now / 260) % 2;
  for (const u of window.cityAIVehicles?.units || []) {
    const [x, y] = toScr(u.x, u.y); if (Math.hypot(x - mx - ms / 2, y - my - ms / 2) > ms / 2 - 4) continue;
    h.beginPath(); h.arc(x, y, 4, 0, TAU); h.fillStyle = u.kind === 'police' ? (blink ? '#ff4d42' : '#4d8dff') : '#ffffff'; h.fill(); h.strokeStyle = '#0b1219'; h.lineWidth = 1.2; h.stroke();
  }
  // lugares de interesse por perto (em pé, não giram com o mapa)
  const gps = window.CityGPS;
  if (gps) {
    h.font = 'bold 9px "Segoe UI Symbol",system-ui'; h.textAlign = 'center'; h.textBaseline = 'middle';
    for (const poi of gps.pois()) {
      if (poi.type === 'town' || poi.type === 'district' || !gps.enabled(poi.type)) continue;
      const [x, y] = toScr(poi.x, poi.y); if (Math.hypot(x - mx - ms / 2, y - my - ms / 2) > ms / 2 - 8) continue;
      h.beginPath(); h.arc(x, y, 7, 0, TAU); h.fillStyle = '#0f202f'; h.fill(); h.strokeStyle = gps.colors[poi.type] || '#9bc3e7'; h.lineWidth = 1.8; h.stroke();
      h.fillStyle = '#fff'; h.fillText(gps.glyph?.[poi.type] || '◆', x, y + .5);
    }
  }
}
// nome da rua onde o jogador está (consultado 3×/s)
const MINI_STREET = { t: 0, name: '' };
function miniStreetName(p) {
  const now = performance.now();
  if (now - MINI_STREET.t > 330) { MINI_STREET.t = now; MINI_STREET.name = (world.open && window.CityGPS?.roadAt?.(p.x, p.y)) || OW?.geo?.neighborhoodAt?.(p.x, p.y)?.name || ''; }
  return MINI_STREET.name;
}

// ---------- mapa completo: camadas separadas e rótulos sem colisões ----------
function drawWorldMap(h,W,H,st){
  if(wmap3d()&&drawWorldMap3D(h,W,H,st))return;
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

// ---------- mapa 3D (map3d.mjs): maquete da ilha com ícones, rótulos, rota e jogador desenhados por cima ----------
const wmap3d=()=>world.open&&!!window.CityMap3D&&wmap.palette!=='classic'&&(window.CityMap3D.ready||window.CityMap3D.build?.());
// mundo → tela e tela → mundo, nos dois modos (3D e o mapa plano antigo)
function wmapS(x,y,z=0){if(wmap3d()){const p=CityMap3D.project(x,y,z);return [p[0],p[1],p[2]];}return [wmap.ox+x*wmap.scale,wmap.oy+y*wmap.scale,true];}
function wmapW(sx,sy){if(wmap3d())return CityMap3D.pick(sx,sy);return wmap.scale?{x:(sx-wmap.ox)/wmap.scale,y:(sy-wmap.oy)/wmap.scale}:null;}
// pixels por metro no centro da tela (tamanho de ícones, rótulos e da barra de escala)
function wmapPPM(){return wmap3d()?1/Math.max(.01,CityMap3D.mpp()):wmap.scale;}
function wmapLabels3D(h,W,H){
  const geo=OW.geo,ppm=wmapPPM(),boxes=[];
  const clear=(x,y,w,hh)=>{if(x<20||x>W-300||y<70||y>H-60)return false;const a=[x-w/2,y-hh/2,x+w/2,y+hh/2];if(boxes.some(b=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1]))return false;boxes.push(a);return true;};
  h.save();h.textAlign='center';h.textBaseline='middle';h.lineJoin='round';
  // bairros (com a gangue que manda)
  const areas=[...(geo.neighborhoods||[]),...(geo.anchors?.towns||[]).map(t=>({...t,type:'town'}))].sort((a,b)=>(b.gang?3:b.type==='downtown'?2:1)-(a.gang?3:a.type==='downtown'?2:1));
  const seen=new Set();
  for(const a of areas){
    if(!a.name||seen.has(a.name))continue;seen.add(a.name);
    let [x,y,vis]=wmapS(a.x,a.y,4);if(!vis)continue;y-=24;   // acima do ícone do bairro
    const font=ppm<.35?12:15,w=a.name.length*font*.68+18;if(!clear(x,y,w,28))continue;
    h.font='800 '+font+'px system-ui';h.lineWidth=4;h.strokeStyle='rgba(4,18,30,.82)';h.strokeText(a.name.toUpperCase(),x,y);
    h.fillStyle='#fbfdff';h.fillText(a.name.toUpperCase(),x,y);
    if(a.gang&&ppm>=.3){h.font='700 10px system-ui';h.fillStyle=a.gang.color;h.strokeText('● '+a.gang.name,x,y+15);h.fillText('● '+a.gang.name,x,y+15);}
  }
  // nomes das ruas: no meio de cada via, alinhados com ela na tela
  if(ppm>=.55){
    let shown=0;h.font='600 11px system-ui';
    for(const rd of OW.cw.roads){
      if(!rd.streetName||rd.cls==='rail'||rd.pts.length<2)continue;
      for(let k=1;k<4;k++){
        const i=Math.floor(rd.pts.length*k/4),a=rd.pts[Math.max(0,i-2)],b=rd.pts[Math.min(rd.pts.length-1,i+2)],m=rd.pts[i];
        const pa=wmapS(a[0],a[1]),pb=wmapS(b[0],b[1]),pm=wmapS(m[0],m[1],.5);if(!pm[2])continue;
        let ang=Math.atan2(pb[1]-pa[1],pb[0]-pa[0]);if(Math.cos(ang)<0)ang+=Math.PI;
        const w=rd.streetName.length*6.4+10;if(!clear(pm[0],pm[1],Math.abs(Math.cos(ang))*w+14,Math.abs(Math.sin(ang))*w+14))continue;
        h.save();h.translate(pm[0],pm[1]);h.rotate(ang);h.lineWidth=3;h.strokeStyle='rgba(30,32,36,.85)';h.strokeText(rd.streetName,0,0);h.fillStyle='#fff7e2';h.fillText(rd.streetName,0,0);h.restore();
        if(++shown>60)break;
      }
      if(shown>60)break;
    }
  }
  h.restore();
}
function wmapPlayer3D(h,p){
  const [px,py,vis]=wmapS(p.x,p.y,1);if(!vis)return;
  const [ax,ay]=wmapS(p.x+Math.cos(p.face)*6,p.y+Math.sin(p.face)*6,1),a=Math.atan2(ay-py,ax-px);
  const t=performance.now()/1000,pulse=(t%1.6)/1.6;
  h.save();
  h.beginPath();h.arc(px,py,14+pulse*22,0,TAU);h.strokeStyle='rgba(54,185,243,'+(0.55*(1-pulse))+')';h.lineWidth=3;h.stroke();
  h.beginPath();h.arc(px,py,15,0,TAU);h.fillStyle='rgba(54,185,243,.28)';h.fill();
  h.translate(px,py);h.rotate(a);h.shadowColor='rgba(0,0,0,.5)';h.shadowBlur=6;
  h.fillStyle='#ffffff';h.strokeStyle='#0f2a44';h.lineWidth=2.6;
  h.beginPath();h.moveTo(13,0);h.lineTo(-9,-9);h.lineTo(-3,0);h.lineTo(-9,9);h.closePath();h.fill();h.stroke();
  h.restore();
}
// rosa dos ventos (gira junto com o mapa 3D) e barra de escala
function wmapCompass(h,W,H){
  const yaw=CityMap3D.view.yaw,cx=W-326,cy=104;
  h.save();h.translate(cx,cy);
  h.beginPath();h.arc(0,0,24,0,TAU);h.fillStyle='rgba(9,23,37,.86)';h.fill();h.strokeStyle='rgba(255,255,255,.25)';h.lineWidth=1.5;h.stroke();
  h.rotate(yaw);
  h.beginPath();h.moveTo(0,-18);h.lineTo(5,0);h.lineTo(-5,0);h.closePath();h.fillStyle='#ff5a4f';h.fill();
  h.beginPath();h.moveTo(0,18);h.lineTo(5,0);h.lineTo(-5,0);h.closePath();h.fillStyle='#e9eef3';h.fill();
  h.font='800 10px system-ui';h.textAlign='center';h.textBaseline='middle';h.fillStyle='#fff';h.fillText('N',0,-29+(yaw?0:0));
  h.restore();
  const mpp=CityMap3D.mpp(),m=[2000,1000,500,250,100,50,20,10].find(v=>v/mpp<=135)||10,bar=m/mpp,bx=20,by=H-66;
  h.save();h.fillStyle='#091725d8';h.beginPath();h.roundRect(bx-10,by-26,Math.max(bar+21,87),40,8);h.fill();
  h.fillStyle='#eaf4ff';h.fillRect(bx,by,bar,3);h.font='600 11px system-ui';h.fillStyle='#fff';h.textAlign='left';h.textBaseline='alphabetic';
  h.fillText(m>=1000?(m/1000)+' km':m+' m',bx,by-7);h.restore();
}
function drawWorldMap3D(h,W,H,st){
  wmapTick();
  const cv=CityMap3D.frame(W,H);if(!cv)return false;
  h.save();h.setTransform(1,0,0,1,0,0);h.drawImage(cv,0,0);
  // sombra suave nas bordas (o painel lateral e o rodapé ficam legíveis)
  const gr=h.createLinearGradient(W-360,0,W,0);gr.addColorStop(0,'rgba(8,18,28,0)');gr.addColorStop(1,'rgba(8,18,28,.55)');h.fillStyle=gr;h.fillRect(W-360,0,360,H);
  wmapLabels3D(h,W,H);
  window.CityGPS?.drawFull(h,(x,y)=>wmapS(x,y,2),st);
  wmapPlayer3D(h,st.player);
  wmapCompass(h,W,H);
  h.restore();
  return true;
}
