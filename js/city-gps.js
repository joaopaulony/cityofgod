// CityGPS 2.0: real route on the procedural road network (A*), markers, arrival and rerouting.
'use strict';
const CityGPS=(()=>{
 let waypoint=null,route=null,graph=null,graphSource=null,selection=null;
 let remaining=0,lastRepath=0,lastArrival=0,visibleTypes=null;
 const colors={gas:'#3fa4f5',home:'#49c98d',airport:'#53b6eb',town:'#a7b5ca',port:'#49bdd5',district:'#b3a5ec',lot:'#d9ae4e',
  police:'#61a8ef',hospital:'#f27a73',cityhall:'#a6cce9',church:'#dddce9',mall:'#dc94db',stadium:'#82bf6b',
  market:'#e5bb7b',bus:'#e5a66c',university:'#58b7c9',lighthouse:'#d5dbe6'};
 const glyph={gas:'⛽',home:'⌂',airport:'✈',town:'◆',port:'⚓',district:'◈',lot:'▣',
  police:'★',hospital:'✚',cityhall:'▥',church:'✝',mall:'▣',stadium:'◉',market:'▰',bus:'▤',university:'▦',lighthouse:'✦'};
 const labels={gas:'Postos de combustível',home:'Minhas casas',airport:'Aeroportos',police:'Delegacias',
 hospital:'Hospitais',mall:'Comércio',market:'Mercados',cityhall:'Prefeitura',stadium:'Estádios',university:'Universidades',
 port:'Porto',town:'Bairros',bus:'Rodoviárias',church:'Igrejas',lighthouse:'Faróis',district:'Centro'};
 const player=()=>window.cityVehicleBridge?.player||window.__game?.player||(typeof st!=='undefined'?st.player:null);
 const targetDist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function roads(){
   return (typeof OW!=='undefined'&&world.open&&OW.cw?.roads?.length)?OW.cw.roads:(world.roads||[]);
 }
 function network(){
   const source=roads();
   if(graph&&source===graphSource)return graph;
   if(!window.CityRoadRouting)return null;
   graphSource=source;graph=window.CityRoadRouting.build(source,world.seed);
   return graph;
 }
 function pois(){
   if(typeof world==='undefined')return [];
   const list=[];
   for(const [i,site] of (world.gasStations||[]).entries()){
     const p=site.pumps?.[0];
     if(p)list.push({id:'gas:'+i,x:p.x,y:p.y,type:'gas',name:'Posto '+(site.brand?.name||'de combustível')});
   }
   if(typeof CityRealty!=='undefined')for(const p of Object.values(CityRealty.owned)){
     if(Number.isFinite(p.x)&&Number.isFinite(p.y))list.push({id:'home:'+p.id,x:p.x,y:p.y,name:p.name+' · minha',type:'home'});
   }
   if(typeof CitySim!=='undefined'&&CitySim.data.home){
     const p=CitySim.data.home;
     if(!list.some(q=>q.type==='home'&&targetDist(q,p)<5))list.push({id:'currenthome',x:p.x,y:p.y,name:'Minha residência',type:'home'});
   }
   if(world.open&&typeof OW!=='undefined'&&OW.geo){
     for(const [i,l] of (OW.cw?.landmarks||[]).entries()){
       if(['airport'].includes(l.kind))continue;
       list.push({id:'landmark:'+i,x:l.x,y:l.y,name:l.name,type:l.kind==='port'?'port':l.kind});
     }
     for(const [i,t] of (OW.geo.anchors.towns||[]).entries())
       list.push({id:'town:'+i,x:t.x,y:t.y,name:t.name||'Bairro',type:'town'});
     if(world.spawn)list.push({id:'airport',x:world.spawn[0],y:world.spawn[1],name:'Aeroporto Internacional',type:'airport'});
   }
   return list;
 }
 function choose(point,quiet=false){
   if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;
   const p=player();if(!p)return false;
   const net=network();
   const candidate=net?.route(p,point);
   if(!candidate||candidate.points.length<2){
     if(!quiet)window.CityUI?.notify('Sem rota viária conectada até esse destino');
     return false;
   }
   waypoint={id:point.id||'manual',x:point.x,y:point.y,name:point.name||'Destino selecionado',
     snapped:{x:candidate.to[0],y:candidate.to[1]}};
   route=candidate;selection=point;remaining=candidate.length;lastRepath=performance.now();
   if(!quiet)window.CityUI?.notify('🧭 Rota calculada pelas ruas: '+Math.round(candidate.length)+' m');
   updateMapUI();
   return true;
 }
 function set(point){return choose(point);}
 function clear(notify=false){
   waypoint=null;route=null;selection=null;remaining=0;
   if(notify)window.CityUI?.notify('Destino alcançado — GPS encerrado');
   updateMapUI();
 }
 function click(x,y){
   if(typeof wmap==='undefined'||!wmap.open||!wmap.scale)return false;
   if(x<14||x>hudC.width-14||y<64||y>hudC.height-55)return false;
   let best=null,radius=17;
   for(const poi of pois()){
     if(visibleTypes&&!visibleTypes.has(poi.type))continue;
     const dx=wmap.ox+poi.x*wmap.scale-x,dy=wmap.oy+poi.y*wmap.scale-y;
     const d=Math.hypot(dx,dy);
     if(d<radius){best=poi;radius=d;}
   }
   if(best)return choose(best);
   const wx=(x-wmap.ox)/wmap.scale,wy=(y-wmap.oy)/wmap.scale;
   if(world.open&&typeof OW!=='undefined'&&!OW.geo.isLand(wx,wy))return false;
   const net=network(),near=net?.nearest(wx,wy);
   if(!near||near.d>85){
     window.CityUI?.notify('Clique numa rua para marcar a rota');
     return false;
   }
   return choose({id:'manual',x:near.x,y:near.y,name:'Ponto marcado na via'});
 }
 function nearRoute(p){
   if(!route)return Infinity;
   let best=Infinity,progress=0,nearestProgress=0;
   for(let i=1;i<route.points.length;i++){
     const a=route.points[i-1],b=route.points[i],point=CityRoadRouting.project(p.x,p.y,a,b);
     if(point.d<best){best=point.d;nearestProgress=progress+Math.hypot(b[0]-a[0],b[1]-a[1])*point.t;}
     progress+=Math.hypot(b[0]-a[0],b[1]-a[1]);
   }
   remaining=Math.max(0,progress-nearestProgress);
   return best;
 }
 function tick(p){
   if(!waypoint||!route||!p)return;
   const arrival={x:route.to[0],y:route.to[1]};
   if(targetDist(arrival,p)<15||targetDist(waypoint,p)<15){
     clear(true);return;
   }
   const now=performance.now();
   if(now-lastRepath<3000)return;
   const d=nearRoute(p);
   updateMapUI();
   if(d>37){
     lastRepath=now;
     const updated=network()?.route(p,waypoint);
     if(updated){route=updated;remaining=updated.length;updateMapUI();}
   }
 }
 function updateMapUI(){
   const el=document.getElementById('city-gps-readout');
   if(el)el.textContent=waypoint&&route?
     'Rota ativa · '+waypoint.name+' · '+Math.round(remaining)+' m':'Clique em uma rua ou ícone para traçar uma rota';
   const btn=document.getElementById('city-gps-clear');
   if(btn)btn.hidden=!waypoint;
 }
 function status(){return waypoint&&route?waypoint.name+' · '+Math.round(remaining)+' m':'Selecione uma via ou ponto de interesse';}
 function paintRoute(h,S,lineWidth=5){
   if(!route?.points?.length)return;
   const points=route.points;
   h.save();h.lineCap='round';h.lineJoin='round';h.beginPath();
   for(let i=0;i<points.length;i++){
     const [x,y]=S(points[i][0],points[i][1]);
     if(i===0)h.moveTo(x,y);else h.lineTo(x,y);
   }
   h.strokeStyle='#06162eb9';h.lineWidth=lineWidth+4;h.stroke();
   h.strokeStyle='#46bcfa';h.lineWidth=lineWidth;h.shadowColor='#28a5fb';h.shadowBlur=10;h.stroke();
   h.shadowBlur=0;h.strokeStyle='#c8eeffb8';h.lineWidth=Math.max(1,lineWidth*.2);h.stroke();
   h.restore();
 }
 function paintIcon(h,p,x,y,chosen){
   const color=colors[p.type]||'#83b5dc';
   h.save();h.translate(x,y);
   h.shadowColor='#0009';h.shadowBlur=4;
   h.fillStyle=chosen?'#1ec1fa':'#0f202f';h.strokeStyle=chosen?'#fff':color;
   h.lineWidth=2;h.beginPath();h.arc(0,0,chosen?11:9,0,Math.PI*2);h.fill();h.stroke();
   h.shadowBlur=0;h.font='bold 11px "Segoe UI Symbol",system-ui';h.textAlign='center';
   h.textBaseline='middle';h.fillStyle='#fff';h.fillText(glyph[p.type]||'◆',0,0);
   h.restore();
 }
 function drawFull(h,S,st){
   h.save();paintRoute(h,S,Math.max(4,Math.min(8,wmap.scale*5)));
   const shown=[];const xLimit=h.canvas.width-285;
   const zoomed=wmap.scale>.45;
   for(const p of pois()){
     if(visibleTypes&&!visibleTypes.has(p.type))continue;
     const [x,y]=S(p.x,p.y);
     if(x<12||x>xLimit||y<67||y>h.canvas.height-58)continue;
     const chosen=waypoint&&waypoint.id===p.id;
     if(!chosen&&shown.some(q=>Math.hypot(q[0]-x,q[1]-y)<(zoomed?19:25)))continue;
     shown.push([x,y]);paintIcon(h,p,x,y,chosen);
     if(chosen||zoomed&&['home','gas','hospital','police'].includes(p.type)){
       h.save();h.font='600 11px system-ui';h.textAlign='center';
       h.lineWidth=3;h.strokeStyle='#04101ee8';h.strokeText(p.name,x,y-17);
       h.fillStyle='#fff';h.fillText(p.name,x,y-17);h.restore();
     }
   }
   if(waypoint&&route){
     const [x,y]=S(route.to[0],route.to[1]);
     if(x>=0&&x<=h.canvas.width&&y>=50&&y<=h.canvas.height){
       h.beginPath();h.arc(x,y,14,0,Math.PI*2);
       h.fillStyle='#1b9fe9';h.strokeStyle='#fff';h.lineWidth=3;h.fill();h.stroke();
       h.textAlign='center';h.textBaseline='middle';h.fillStyle='#fff';h.font='bold 15px system-ui';h.fillText('⌖',x,y);
     }
   }
   h.restore();
 }
 function drawMini(h,mx,my,ms,p){
   if(!route)return;
   const k=world.open?1.5:2.6,c=Math.cos(cam.ang),s=Math.sin(cam.ang);
   const convert=(x,y)=>[mx+ms/2+(c*(x-p.x)-s*(y-p.y))*k,my+ms/2+(s*(x-p.x)+c*(y-p.y))*k];
   h.save();h.beginPath();h.rect(mx,my,ms,ms);h.clip();
   paintRoute(h,(x,y)=>convert(x,y),3.5);
   const dest=convert(route.to[0],route.to[1]);h.fillStyle='#71dfff';h.strokeStyle='#fff';
   h.lineWidth=2;h.beginPath();h.arc(dest[0],dest[1],5,0,Math.PI*2);h.fill();h.stroke();
   h.restore();
 }
 function filter(type){
   if(!visibleTypes)visibleTypes=new Set(Object.keys(labels));
   if(visibleTypes.has(type))visibleTypes.delete(type);else visibleTypes.add(type);
   updateMapUI();
   return visibleTypes.has(type);
 }
 function enabled(type){return !visibleTypes||visibleTypes.has(type);}
 function roadAt(x,y){
   const near=network()?.nearest(x,y);
   if(!near||near.d>26)return '';
   return roads()[near.seg.roadId]?.streetName||'Via urbana';
 }
 function quickPanel(){return pois().slice(0,60).map(p=>({...p})).sort((a,b)=>a.name.localeCompare(b.name));}
 return {pois,labels,colors,set,click,drawFull,drawMini,quickPanel,filter,enabled,clear,tick,status,roadAt,
   get target(){return waypoint;},get route(){return route;},get networkStats(){const g=network();return g?{nodes:g.nodeCount,edges:g.edgeCount}:null;}};
})();
window.CityGPS=CityGPS;