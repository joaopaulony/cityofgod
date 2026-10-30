// Scripted NPC visits to owned homes. Local-only demonstration, not multiplayer access.
'use strict';
const CityHomeVisitors=(()=>{
 const active=new Map(),outcomes=new WeakMap();const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const notify=t=>window.CityUI?.notify?.(t);
 function invite(H,name,options={}){
   if(!window.CityHome?.owned(H)||!window.CityHomeNav||!window.CityHomePlus)return {ok:false,text:'Imóvel ou navegação indisponível'};
   if(!options.invitedByOwner&&!window.CityHomePlus.data(H).guests.includes(name)&&window.CityHomePlus.data(H).guestMode!=='friends')
     return {ok:false,text:'Adicione o nome à lista de convidados primeiro'};
   const actors=window.cityVehicleBridge?.actors||[];
   const npc=options.npc||actors.find(n=>n.name===name&&n!==window.cityVehicleBridge.player);
   if(!npc)return {ok:false,text:'Convidado não está disponível na cidade'};
   if(active.has(npc))return {ok:false,text:'Convidado já está a caminho'};
   const level=H.architecture?.levels?.[0];
   if(!level||!H.architecture?.toWorld)return {ok:false,text:'Casa sem interior navegável'};
   const [sx,sy]=H.architecture.toWorld(...level.entry);
   const start={x:sx,y:sy};
   const kinds=options.kind==='overnight'?['bed','doublebed','singlebed','bunkbed']:['sofa','couch','sectional','chair'];
   const reserved=new Set([...active.values()].map(v=>v.seatId));
   const playerItem=window.cityVehicleBridge?.player?.homeAction?.itemId;if(playerItem)reserved.add(playerItem);
   const seat=CityHome.placed(H).find(r=>(r.floor||0)===0&&kinds.includes(r.kind)&&!reserved.has(r.id));
   if(!seat)return {ok:false,text:options.kind==='overnight'?'Prepare uma cama livre no térreo':'Coloque um sofá ou cadeira livre para receber o convidado'};
   const path=CityHomeNav.approach(H,start,seat);
   if(!path)return {ok:false,text:'Não há passagem livre para a visita'};
   outcomes.delete(npc);active.set(npc,{H,seatId:seat.id,original:{x:npc.x,y:npc.y,face:npc.face,
     floor:npc.floor||0,floorZ:npc.floorZ||0,armed:npc.armed},
     start,path:path.points,index:0,elapsed:0,phase:'arriving',stuck:0,kind:options.kind||'visit',duration:clamp(options.duration||18,18,300)});
   return {ok:true,text:'🔔 '+name+' aceitou o convite e chegará à casa'};
 }
 function stop(npc,status='interrupted'){
   const state=active.get(npc);if(!state)return;
   Object.assign(npc,state.original);
   npc.homeAction=null;npc.speed=0;
   active.delete(npc);outcomes.set(npc,status);
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
     if(!target){
       if(v.kind==='dinner'){const served=window.CityHomeKitchen?.serveGuest(v.H);if(!served?.ok){notify(served?.text||'Não foi possível servir o jantar.');stop(npc);return true;}notify('🍽 '+npc.name+' recebeu uma porção do jantar.');}
       const item=CityHome.placed(v.H).find(r=>r.id===v.seatId);if(!item){stop(npc);return true;}
       v.phase='seated';v.elapsed=0;npc.homeAction={kind:v.kind==='overnight'?'rest':'sit',t:0,duration:v.duration,item,house:v.H};return true;
     }
     const dx=target.x-npc.x,dy=target.y-npc.y,d=Math.hypot(dx,dy);
     if(d<.36){v.index++;return true;}
     const speed=Math.min(d,1.3*dt),coords=move(npc.x,npc.y,npc.x+dx/d*speed,npc.y+dy/d*speed);
     if(!coords){stop(npc);return false;}
     const moved=Math.hypot(coords[0]-npc.x,coords[1]-npc.y);
     npc.x=coords[0];npc.y=coords[1];npc.speed=moved/Math.max(dt,.00001);
     npc.moveA=Math.atan2(dy,dx);
     npc.face+=Math.atan2(Math.sin(npc.moveA-npc.face),Math.cos(npc.moveA-npc.face))*clamp(dt*8,0,1);
     npc.phase=(npc.phase||0)+moved/1.5;npc.running=false;
     v.stuck=moved<.005?v.stuck+dt:0;
     if(v.stuck>2){stop(npc);notify(npc.name+' não conseguiu passar. Ajuste os móveis.');return false;}
     return true;
   }
   if(v.phase==='seated'){
     npc.speed=0;
     if(!CityHome.placed(v.H).some(r=>r.id===v.seatId)){stop(npc);return true;}
     if(v.elapsed>v.duration){
       notify('👋 '+npc.name+' se despediu e voltou para sua rotina');
       stop(npc,'completed');return true;
     }
     return true;
   }
   return false;
 }
 function leave(name){
   const npc=[...active.keys()].find(n=>n.name===name);
   if(!npc)return {ok:false,text:'Nenhuma visita ativa'};
   stop(npc,'cancelled');return {ok:true,text:name+' encerrou a visita'};
 }
 return {invite,tick,leave,has:npc=>active.has(npc),outcome:npc=>outcomes.get(npc),get active(){return [...active.keys()].map(n=>n.name)}};
})();
window.CityHomeVisitors=CityHomeVisitors;
