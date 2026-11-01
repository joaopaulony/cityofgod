// Bridge between persistent invitations and the existing physical NPC/home systems.
export function createSocialActivities({sim,actors,player,homes,home,visitors,kitchen=()=>null,notify=()=>{}}){
 const active=new Map();
 function residence(){const p=player();return homes().filter(H=>home()?.owned(H)&&H.architecture?.levels?.[0]).sort((a,b)=>Math.hypot((a.front?.[0]??a.x0)-p.x,(a.front?.[1]??a.y0)-p.y)-Math.hypot((b.front?.[0]??b.x0)-p.x,(b.front?.[1]??b.y0)-p.y))[0]||null;}
 function context(id){const H=residence(),items=H?(home()?.placed(H)||[]):[],npc=actors().find(n=>n.lookId===id);return {hasHome:!!H,hasBed:items.some(i=>(i.floor||0)===0&&['bed','doublebed','singlebed','bunkbed'].includes(i.kind)),hasDining:items.some(i=>(i.floor||0)===0&&['sofa','couch','sectional','chair'].includes(i.kind)),hasMeal:!!H&&(kitchen()?.pantry(H)?.portions||0)>0,homeKey:H?home().key(H):null,busy:npc?.kind==='service'};}
 function start(event,npc){
  if(!event||!npc)return {ok:false,text:'A pessoa não está disponível para sair agora.'};
  const house=['dinner','visit','overnight','party'].includes(event.kind);
  if(house){const H=residence();if(!H)return {ok:false,text:'Sua residência não está disponível nesta região.'};const result=visitors()?.invite(H,npc.name,{npc,kind:event.kind,duration:event.kind==='overnight'?180:event.kind==='party'?120:90,invitedByOwner:true});if(!result?.ok)return result||{ok:false,text:'A navegação da casa não está disponível.'};}
  active.set(npc,{event,house,elapsed:0,together:0,stuck:0,last:{x:npc.x,y:npc.y},originalTarget:npc.target,originalRun:npc.run,originalWalk:npc.walk});npc.socialActivity=event.kind;if(!house)npc.walk=Math.max(1.8,npc.walk||1.3);sim().beginEvent(event.id);return {ok:true,text:house?'Combinado! Vou chegar pela entrada da sua casa.':'Vou acompanhar você a pé. Vamos escolher o caminho juntos.'};
 }
 function stop(npc,status){const state=active.get(npc);if(!state)return;if(state.house)visitors()?.leave(npc.name);npc.target=state.originalTarget;npc.run=state.originalRun;npc.walk=state.originalWalk;npc.socialActivity=null;active.delete(npc);sim().finishEvent(state.event.id,status);}
 function tick(npc,dt){const state=active.get(npc);if(!state)return false;
  if(!['planned','active'].includes(state.event.status)){stop(npc,state.event.status);return false;}
  state.elapsed+=dt;const p=player();
  if(state.house){if(!visitors()?.has(npc)){const outcome=visitors()?.outcome?.(npc)||'interrupted';stop(npc,outcome);notify(npc.name+(outcome==='completed'?' se despediu depois da visita.':' teve a visita interrompida.'));return false;}return false;}
  if(npc.socialUntil>sim().time){npc.speed=0;return true;}
  if((npc.floor||0)!==(p.floor||0)||state.elapsed>300){stop(npc,'interrupted');notify(npc.name+' não conseguiu continuar o passeio.');return false;}
  const d=Math.hypot(npc.x-p.x,npc.y-p.y);if(d>35){stop(npc,'interrupted');return false;}
  if(d<5)state.together+=dt;
  if(state.together>90){stop(npc,'completed');notify('Uma boa lembrança do passeio com '+npc.name+'.');return false;}
  npc.run=false;
  if(d<2.3){npc.speed=0;npc.target=null;return true;}
  const moved=Math.hypot(npc.x-state.last.x,npc.y-state.last.y);state.stuck=moved<.002?state.stuck+dt:0;state.last={x:npc.x,y:npc.y};
  if(state.stuck>5){stop(npc,'interrupted');notify(npc.name+' encontrou uma passagem bloqueada. O passeio foi interrompido.');return false;}
  npc.target={x:p.x,y:p.y};return false;
 }
 return {context,start,tick,has:npc=>active.has(npc),stop,get count(){return active.size;}};
}
