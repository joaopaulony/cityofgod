// CityGPS: mapa com POIs e guia de rota. Rotas são indicativas (não navegação viária curva a curva).
'use strict';
const CityGPS=(()=>{
 let waypoint=null,selection=null;
 const icon={gas:'⛽',home:'⌂',airport:'✈',town:'◆',port:'⚓',district:'◉',lot:'▣',hospital:'✚',police:'★',military:'◆',cityhall:'⌂',school:'▤'};
 function pois(){
   const result=[];
   if(typeof world==='undefined')return result;
   for(const s of world.civicSites||[])result.push({id:s.id,x:s.x,y:s.y+2,name:s.name,type:s.kind});
   for(const [i,st] of (world.gasStations||[]).entries()){
     const p=st.pumps?.[0];if(p)result.push({id:'gas:'+i,x:p.x,y:p.y,name:'Posto '+(st.brand?.name||'de combustível'),type:'gas'});
   }
   if(typeof CityRealty!=='undefined')for(const item of Object.values(CityRealty.owned))
     if(Number.isFinite(item.x)&&Number.isFinite(item.y))result.push({id:'home:'+item.id,x:item.x,y:item.y,name:item.name+' (minha)',type:'home'});
   if(typeof CitySim!=='undefined'&&CitySim.data.home){
     const d=CitySim.data.home;if(!result.some(p=>p.type==='home'&&Math.hypot(p.x-d.x,p.y-d.y)<5))
       result.push({id:'currenthome',x:d.x,y:d.y,name:'Minha residência',type:'home'});
   }
   if(world.open && typeof OW!=='undefined'&&OW.geo){
     const a=OW.geo.anchors;
     if(world.spawn)result.push({id:'airport',x:world.spawn[0],y:world.spawn[1],type:'airport',name:'Aeroporto'});
     if(a.downtown)result.push({id:'downtown',x:a.downtown.x,y:a.downtown.y,type:'district',name:'Centro'});
     for(const [i,t] of (a.towns||[]).entries())result.push({id:'town:'+i,x:t.x,y:t.y,type:'town',name:t.name||'Bairro'});
     if(a.port)result.push({id:'port',x:a.port.x,y:a.port.y,type:'port',name:'Porto'});
   }
   return result;
 }
 function set(point){
   if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;
   waypoint={id:point.id||'manual',x:point.x,y:point.y,name:point.name||'Destino marcado'};
   window.CityUI?.notify('📍 GPS: '+waypoint.name);
   return true;
 }
 function select(x,y){
   if(typeof wmap==='undefined'||!wmap.open||!wmap.scale)return false;
   let pick=null,dist=23;
   for(const p of pois()){
     const dx=wmap.ox+p.x*wmap.scale-x,dy=wmap.oy+p.y*wmap.scale-y,d=Math.hypot(dx,dy);
     if(d<dist){dist=d;pick=p;}
   }
   if(pick){selection=pick;return set(pick);}
   const wx=(x-wmap.ox)/wmap.scale,wy=(y-wmap.oy)/wmap.scale;
   if(world.open&&typeof OW!=='undefined'&&!OW.geo.isLand(wx,wy))return false;
   return set({x:wx,y:wy,name:'Marcador personalizado'});
 }
 function drawFull(h,S,st){
   const size=typeof hudC!=='undefined'?hudC.width:innerWidth;
   h.save();h.textAlign='center';h.textBaseline='middle';
   for(const p of pois()){
     const [x,y]=S(p.x,p.y);
     if(x<-25||y<-25||x>size+25||y>h.canvas.height+25)continue;
     const chosen=waypoint && Math.hypot(waypoint.x-p.x,waypoint.y-p.y)<2;
     h.beginPath();h.arc(x,y,chosen?14:11,0,Math.PI*2);
     h.fillStyle=chosen?'#20bfe4':'#09172be8';h.fill();
     h.strokeStyle=chosen?'#effcff':'#f0ca67';h.lineWidth=2;h.stroke();
     h.font='bold 15px system-ui';h.fillStyle='#fff';h.fillText(icon[p.type]||'◆',x,y+1);
     if(chosen || (p.type==='home')){
       h.font='700 11px system-ui';h.fillStyle='#fff';h.strokeStyle='#08101c';h.lineWidth=3;
       h.strokeText(p.name,x,y-22);h.fillText(p.name,x,y-22);
     }
   }
   if(waypoint){
     const [px,py]=S(st.player.x,st.player.y),[tx,ty]=S(waypoint.x,waypoint.y);
     h.beginPath();h.moveTo(px,py);h.lineTo(tx,ty);h.setLineDash([8,6]);
     h.strokeStyle='#61e2ff';h.lineWidth=3;h.shadowColor='#39bfff';h.shadowBlur=9;h.stroke();
     h.setLineDash([]);h.shadowBlur=0;
     h.fillStyle='#edfcff';h.font='bold 13px system-ui';h.textAlign='left';
     const d=Math.round(Math.hypot(waypoint.x-st.player.x,waypoint.y-st.player.y));
     h.fillText('GPS: '+waypoint.name+' · '+d+' m (linha-guia)',22,82);
   }
   h.restore();
 }
 function drawMini(h,mx,my,ms,p){
   if(!waypoint)return;
   const dx=waypoint.x-p.x,dy=waypoint.y-p.y,c=Math.cos(cam.ang),s=Math.sin(cam.ang),k=world.open?1.5:2.6;
   const vx=(c*dx-s*dy)*k,vy=(s*dx+c*dy)*k,mag=Math.hypot(vx,vy),len=Math.min(ms*.43,mag);
   h.save();h.translate(mx+ms/2,my+ms/2);h.rotate(Math.atan2(vy,vx));
   h.strokeStyle='#35d5ff';h.lineWidth=3;h.beginPath();h.moveTo(0,0);h.lineTo(len,0);h.stroke();
   h.fillStyle='#fff';h.beginPath();h.moveTo(len+3,0);h.lineTo(len-6,-5);h.lineTo(len-6,5);h.closePath();h.fill();
   h.restore();
 }
 function quickPanel(){
   const ps=pois();return ps.slice(0,36).map(p=>({id:p.id,name:p.name,type:p.type,x:p.x,y:p.y})).sort((a,b)=>a.name.localeCompare(b.name));
 }
 return {pois,set,click:select,drawFull,drawMini,quickPanel,clear(){waypoint=null;},get target(){return waypoint;}};
})();
window.CityGPS=CityGPS;
