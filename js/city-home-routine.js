// Autonomous indoor interaction lifecycle, backed by CityHomeNav.
'use strict';
const CityHomeRoutine=(()=>{
 let task=null,epoch=0;const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const ANG=(to,from)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
 function cancel(message='',silent=false){
   if(task?.player){task.player.homeAction=null;task.player.speed=0;task.player.running=false;task.player.armed=task.wasArmed;}
   task=null;epoch++;
   if(message&&!silent)window.CityUI?.notify?.(message);
 }
 function start(H,item,kind,options={}){
   if(!window.CityHomeNav||!H||!item||!window.CityHome?.owned(H))return {ok:false,text:'Acesso à casa negado'};
   const player=window.__game?.player;
   if(!player||window.cityVehicles?.driver)return {ok:false,text:'Saia do veículo antes de interagir'};
   if((player.floor||0)!==(item.floor||0))return {ok:false,text:'Suba ou desça ao andar do móvel'};
   const planned=window.CityHomePerformance?CityHomePerformance.approach(H,player,item,kind):CityHomeNav.approach(H,player,item);
   if(!planned)return {ok:false,text:'Sem caminho livre até este móvel. Reposicione os obstáculos'};
   cancel('',true);
   task={id:++epoch,H,itemId:item.id,kind,options,player,
     points:planned.points,step:0,stand:planned.stand,face:planned.face,socket:planned.socket||null,stage:'walk',
     elapsed:0,stuck:0,lastX:player.x,lastY:player.y,replans:0,
     houseVersion:typeof world!=='undefined'?world.version:0,wasArmed:!!player.armed};
   player.homeAction=null;player.wantShot=false;player.aiming=false;player.armed=false;
   return {ok:true,text:'Indo até '+(window.CityHome?.catalog[item.kind]?.name||'móvel')+' · siga o percurso'};
 }
 function tick(dt,player,move,manual=false){
   if(!task)return false;
   const t=task;
   if(manual||window.cityVehicles?.driver||!window.CityHome?.owned(t.H)||
      (player.floor||0)!==(t.H&&CityHome.find(t.H,t.itemId)?.floor||0)){
     cancel('Interação interrompida',true);return false;
   }
   const furniture=CityHome.find(t.H,t.itemId);
   if(!furniture||furniture.status!=='placed'){cancel('O móvel não está mais disponível');return false;}
   if(t.stage==='align'){
     t.elapsed+=dt;player.speed=0;player.aiming=false;player.wantShot=false;
     const dx=t.stand.x-player.x,dy=t.stand.y-player.y,d=Math.hypot(dx,dy);
     if(d>.065){
       const rate=Math.min(d,1.16*dt),p=move(player.x+dx/d*rate,player.y+dy/d*rate);
       if(!p||!Number.isFinite(p[0])||!Number.isFinite(p[1])){cancel('Falha ao alinhar personagem');return false;}
       const moved=Math.hypot(p[0]-player.x,p[1]-player.y);
       player.x=p[0];player.y=p[1];player.speed=moved/Math.max(dt,.001);
     }
     const angle=ANG(t.face,player.face);
     player.face+=angle*clamp(dt*11,0,1);
     if(d<=.08&&Math.abs(angle)<=.045){
       t.stage='pose';t.elapsed=0;
       player.homeAction={kind:t.kind,t:0,duration:t.duration,item:{...furniture},socket:t.socket};
     }
     if(t.elapsed>3){cancel('Não foi possível alinhar ao móvel');return false;}
     return true;
   }
   if(t.stage==='pose'){
     t.elapsed+=dt;if(player.homeAction)player.homeAction.t=t.elapsed;
     player.speed=0;player.aiming=false;player.wantShot=false;
     player.face+=ANG(t.face,player.face)*clamp(dt*8,0,1);
     if(t.elapsed>=t.duration){
       const result=window.CityHomePlus?.completeActivity?.(t.H,t.itemId,t.kind,t.options);
       cancel('',true);
       window.CityUI?.notify?.(result?.text||'Atividade concluída');
     }
     return true;
   }
   // One bounded replan after a furniture move or interrupted collision.
   if(typeof world!=='undefined'&&world.version!==t.houseVersion&&t.replans<2){
     const next=(window.CityHomePerformance?CityHomePerformance.approach(t.H,player,furniture,t.kind):CityHomeNav.approach(t.H,player,furniture));
     if(!next){cancel('O caminho até o móvel foi bloqueado');return false;}
     t.points=next.points;t.step=0;t.stand=next.stand;t.face=next.face;t.socket=next.socket||null;
     t.replans++;t.houseVersion=world.version;
   }
   const point=t.points[t.step];
   if(!point){t.stage='align';t.elapsed=0;t.duration=window.CityHomePerformance?.duration(t.kind)||(t.kind==='sleep'?6:t.kind==='cook'?5:3.3);return true;}
   const dx=point.x-player.x,dy=point.y-player.y,d=Math.hypot(dx,dy);
   if(d<.37){t.step++;return true;}
   const rate=Math.min(d,1.42*dt),p=move(player.x+dx/d*rate,player.y+dy/d*rate);
   if(!p||!Number.isFinite(p[0])||!Number.isFinite(p[1])){cancel('Movimentação indisponível');return false;}
   const moved=Math.hypot(p[0]-player.x,p[1]-player.y);
   player.x=p[0];player.y=p[1];
   player.moveA=Math.atan2(dy,dx);
   player.face+=ANG(player.moveA,player.face)*clamp(dt*10,0,1);
   player.speed=moved/Math.max(dt,.00001);
   player.phase+=moved/1.5;
   player.running=false;player.aiming=false;player.wantShot=false;
   if(moved<.006)t.stuck+=dt;else t.stuck=Math.max(0,t.stuck-dt*3);
   if(t.stuck>1.4){
     if(t.replans>=2){cancel('Não foi possível contornar os obstáculos');return false;}
     const next=(window.CityHomePerformance?CityHomePerformance.approach(t.H,player,furniture,t.kind):CityHomeNav.approach(t.H,player,furniture));
     if(!next){cancel('Caminho bloqueado');return false;}
     t.points=next.points;t.step=0;t.stand=next.stand;t.face=next.face;t.socket=next.socket||null;
     t.replans++;t.stuck=0;
   }
   return true;
 }
 function draw(h,W,H){
   if(!task)return;
   const t=task,w=286,x=W/2-w/2,y=74;
   const progress=t.stage==='pose'?clamp(t.elapsed/t.duration,0,1):t.stage==='align'?.95:clamp(t.step/Math.max(1,t.points.length),0,1);
   h.save();h.fillStyle='#0c1b29e9';h.strokeStyle='#66c4c675';h.lineWidth=1.2;
   h.beginPath();h.roundRect(x,y,w,57,12);h.fill();h.stroke();
   h.font='700 12px system-ui';h.textAlign='left';h.fillStyle='#e9faf8';
   const label=({sit:'Sentar',sleep:'Dormir',cook:'Cozinhar',eat:'Comer',watch:'Assistir',
     work:'Trabalhar',wash:'Higiene',toilet:'Banheiro'})[t.kind]||'Atividade';
   h.fillText((t.stage==='walk'?'↳ Indo até o móvel':t.stage==='align'?'↻ Alinhando ao móvel':'✓ '+label+' em andamento'),x+13,y+21);
   h.font='10px system-ui';h.fillStyle='#9bc9d1';
   h.fillText('WASD para cancelar · '+(t.stage==='walk'?'Caminhando':'Interagindo'),x+13,y+48);
   h.fillStyle='#183942';h.fillRect(x+13,y+29,w-26,5);
   h.fillStyle='#72e3c7';h.fillRect(x+13,y+29,(w-26)*progress,5);
   h.restore();
 }
 return {start,tick,cancel,draw,get active(){return !!task},get stage(){return task?.stage||null},
   get task(){return task&&{kind:task.kind,stage:task.stage,points:task.points.length,step:task.step}}};
})();
window.CityHomeRoutine=CityHomeRoutine;