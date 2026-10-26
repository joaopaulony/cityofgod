// Scripted NPC visits to owned homes. Local-only demonstration, not multiplayer access.
'use strict';
const CityHomeVisitors=(()=>{
 const active=new Map();const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const notify=t=>window.CityUI?.notify?.(t);
 function invite(H,name){
   if(!window.CityHome?.owned(H)||!window.CityHomeNav||!window.CityHomePlus)return {ok:false,text:'Imóvel ou navegação indisponível'};
   if(!window.CityHomePlus.data(H).guests.includes(name)&&window.CityHomePlus.data(H).guestMode!=='friends')
     return {ok:false,text:'Adicione o nome à lista de convidados primeiro'};
   const actors=window.cityVehicleBridge?.actors||[];
   const npc=actors.find(n=>n.name===name&&n!==window.cityVehicleBridge.player);
   if(!npc)return {ok:false,text:'Convidado não está disponível na cidade'};
   if(active.has(npc))return {ok:false,text:'Convidado já está a caminho'};
   const level=H.architecture?.levels?.[0];
   if(!level||!H.architecture?.toWorld)return {ok:false,text:'Casa sem interior navegável'};
   const [sx,sy]=H.architecture.toWorld(...level.entry);
   const start={x:sx,y:sy};
   const seat=CityHome.placed(H).find(r=>r.floor===0&&['sofa','couch','sectional','chair'].includes(r.kind));
   if(!seat)return {ok:false,text:'Coloque um sofá ou cadeira para receber o convidado'};
   const path=CityHomeNav.approach(H,start,seat);
   if(!path)return {ok:false,text:'Não há passagem livre para a visita'};
   active.set(npc,{H,seatId:seat.id,original:{x:npc.x,y:npc.y,face:npc.face,
     floor:npc.floor||0,floorZ:npc.floorZ||0,armed:npc.armed},
     start,path:path.points,index:0,elapsed:0,phase:'arriving',stuck:0});
   return {ok:true,text:'🔔 '+name+' aceitou o convite e chegará à casa'};
 }
 function stop(npc){
   const state=active.get(npc);if(!state)return;
   Object.assign(npc,state.original);
   npc.homeAction=null;npc.speed=0;
   active.delete(npc);
 }
 function tick(dt,npc,move){
   const v=active.get(npc);if(!v)return false;
   if(!window.CityHome?.owned(v.H)){stop(npc);return false;}
   v.elapsed+=dt;
   if(v.phase==='arriving'){
     npc.speed=0;
     if(v.elapsed<2)return true;
     npc.x=v.start.x;npc.y=v.start.y;npc.floor=0;npc.floorZ=0;npc.armed=false;
     v.phase='walk';v.elapsed=0;notify('🔔 '+npc.name+' chegou à sua residência');
     return true;
   }
   if(v.phase==='walk'){
     const target=v.path[v.index];
     if(!target){v.phase='seated';v.elapsed=0;npc.homeAction={kind:'sit',t:0,duration:18};return true;}
     const dx=target.x-npc.x,dy=target.y-npc.y,d=Math.hypot(dx,dy);
     if(d<.36){v.index++;return true;}
     const speed=Math.min(d,1.3*dt),coords=move(npc.x,npc.y,npc.x+dx/d*speed,npc.y+dy/d*speed);
     if(!coords){stop(npc);return false;}
     const moved=Math.hypot(coords[0]-npc.x,coords[1]-npc.y);
     npc.x=coords[0];npc.y=coords[1];npc.speed=moved/Math.max(dt,.00001);
     npc.moveA=Math.atan2(dy,dx);
     npc.face+=Math.atan2(Math.sin(npc.moveA-npc.face),Math.cos(npc.moveA-npc.face))*clamp(dt*8,0,1);
     npc.phase+=moved/1.5;npc.running=false;
     v.stuck=moved<.005?v.stuck+dt:0;
     if(v.stuck>2){stop(npc);notify(npc.name+' não conseguiu passar. Ajuste os móveis.');return false;}
     return true;
   }
   if(v.phase==='seated'){
     npc.speed=0;
     if(v.elapsed>18){
       notify('👋 '+npc.name+' se despediu e voltou para sua rotina');
       stop(npc);return true;
     }
     return true;
   }
   return false;
 }
 function leave(name){
   const npc=[...active.keys()].find(n=>n.name===name);
   if(!npc)return {ok:false,text:'Nenhuma visita ativa'};
   stop(npc);return {ok:true,text:name+' encerrou a visita'};
 }
 return {invite,tick,leave,get active(){return [...active.keys()].map(n=>n.name)}};
})();
window.CityHomeVisitors=CityHomeVisitors;