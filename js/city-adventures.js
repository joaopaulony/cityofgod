// City of God — campanhas, lazer e acontecimentos do mundo aberto.
// O progresso é local e utiliza a economia, o GPS e os NPCs existentes.
'use strict';
const CityAdventures=(()=>{
 const KEY='cityofgod.adventures.v1',MAX_STEP=8;
 const MISSIONS=[
  {title:'Um novo começo',desc:'Explore a saída do aeroporto e caminhe 20 metros.',reward:40,hint:'Use WASD para caminhar pela região.'},
  {title:'Seu primeiro contato',desc:'Abra o celular e conheça os aplicativos da cidade.',reward:30,hint:'Pressione P para abrir o celular.'},
  {title:'Hora de trabalhar',desc:'Candidate-se a um emprego pelo aplicativo Carreiras.',reward:75,hint:'Celular → Carreiras → Candidatar-se.'},
  {title:'Primeiro salário',desc:'Vá ao emprego e conclua um turno de trabalho.',reward:100,hint:'Use o GPS no app Carreiras, vá ao local e pressione F.'},
  {title:'Um teto para chamar de seu',desc:'Alugue uma casa real ou compre sua primeira residência.',reward:100,hint:'Na cidade, aproxime-se da porta de uma casa e pressione F. Aluguel inicial: R$ 160.'},
  {title:'Conhecendo os vizinhos',desc:'Converse com um morador da cidade.',reward:80,hint:'Guarde a arma, pare próximo de alguém e clique no personagem 3D.'},
  {title:'Cuide de você',desc:'Use um alimento ou bebida da mochila para cuidar das necessidades.',reward:60,hint:'Abra a mochila com I e utilize um alimento ou uma bebida que você já possui.'},
  {title:'A cidade precisa de você',desc:'Resolva um acontecimento espontâneo da vizinhança.',reward:150,hint:'Siga o alerta da rua, aproxime-se e pressione F.'}
 ];
 // Eventos autorais com diferentes resultados. Desfechos mudam reputação e carteira.
 const EVENTS=[
  {id:'motor',title:'Carro parado na rua',desc:'Um motorista está com o carro avariado e pede ajuda.',line:'Você entende de mecânica? Estou atrasado!',choices:[['Ajudar a encontrar uma solução',55,3],['Indicar uma oficina',15,1],['Seguir seu caminho',0,-1]]},
  {id:'dog',title:'Cachorro desaparecido',desc:'Uma moradora procura seu companheiro perdido.',line:'Você viu meu cachorro por aqui?',choices:[['Ajudar a encontrar o animal',40,4],['Compartilhar a informação',10,1],['Não se envolver',0,0]]},
  {id:'tourist',title:'Turista perdido',desc:'Uma pessoa não consegue encontrar o centro da cidade.',line:'Você pode me explicar como chegar ao centro?',choices:[['Acompanhar e orientar',30,3],['Explicar o caminho',10,1],['Não tenho tempo',0,-1]]},
  {id:'wallet',title:'Carteira encontrada',desc:'Uma carteira está caída perto da calçada.',line:'Ei! Acho que deixei cair minha carteira.',choices:[['Devolver ao dono',35,5],['Devolver sem aceitar recompensa',0,7],['Ignorar',0,-1]]},
  {id:'delivery',title:'Entregas atrasadas',desc:'Um entregador precisa de ajuda para terminar o expediente.',line:'Tenho mais encomendas do que consigo levar.',choices:[['Ajudar nas entregas',65,3],['Indicar uma rota',20,1],['Recusar educadamente',0,0]]},
  {id:'accident',title:'Pedestre precisa de ajuda',desc:'Um pedestre tropeçou e precisa de assistência.',line:'Minha perna! Alguém pode chamar ajuda?',service:'medical',choices:[['Chamar socorro',15,5],['Acompanhar até a ajuda chegar',25,5],['Não intervir',0,-3]]},
  {id:'argument',title:'Discussão entre vizinhos',desc:'Dois moradores discutem por causa do barulho.',line:'Já não aguento essa confusão na rua!',choices:[['Ajudar a fazer as pazes',20,4],['Pedir calma',5,1],['Tomar partido sem ouvir',0,-3]]},
  {id:'festival',title:'Festa do bairro',desc:'Os organizadores precisam de voluntários.',line:'A festa vai acontecer, mas falta gente para ajudar.',choices:[['Ajudar na organização',45,4],['Divulgar o evento',10,2],['Não participar',0,0]]},
  {id:'music',title:'Música na praça',desc:'Um artista de rua está se apresentando.',line:'Uma música pode mudar o nosso dia!',choices:[['Apoiar o artista com R$ 10',-10,3],['Aplaudir a apresentação',0,1],['Continuar andando',0,0]]},
  {id:'box',title:'Mudança de apartamento',desc:'Um vizinho precisa carregar caixas até a entrada.',line:'Será que você pode dar uma mão?',choices:[['Ajudar com a mudança',45,4],['Dar uma dica',5,1],['Não ajudar',0,0]]},
  {id:'market',title:'Feirante sem troco',desc:'O vendedor está com dificuldades para atender a fila.',line:'Hoje o movimento está grande!',choices:[['Ajudar com os pedidos',35,3],['Comprar um lanche por R$ 12',-12,1],['Seguir pela feira',0,0]]},
  {id:'neighborhood',title:'Mutirão de limpeza',desc:'Moradores estão organizando a limpeza de uma praça.',line:'Essa praça vai ficar bonita de novo!',choices:[['Participar do mutirão',50,5],['Divulgar no CitySocial',10,2],['Não participar',0,0]]}
 ];
 const fresh=()=>({version:1,step:0,walk:0,flags:{},reputation:0,history:[],eventCount:{},lastEventId:null,totalRewards:0});
 let state=fresh(),active=false,tab='missions',event=null,eventNpc=null,eventId=0,eventClock=0,nextEvent=55,el=null,hud=null,lastPos=null,ready=false,notifyT=0,socialCheckT=0;
 const money=n=>window.CityLife?.money?.(n)||('R$ '+n);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function read(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v?.version===1&&Number.isInteger(v.step)){state={...fresh(),...v,flags:v.flags||{},eventCount:v.eventCount||{}};state.step=Math.max(0,Math.min(MAX_STEP,state.step));}}catch(_){}}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){}}
 const player=()=>window.__game?.player;
 const playing=()=>ready&&!window.CityFront?.blocked&&!window.CityHomeUI?.active&&!window.cityVehicles?.driver&&!window.CityRealty?.dialogOpen;
 function message(text){window.CityUI?.notify?.(text);}
 function signal(kind){state.flags[kind]=true;save();check();}
 function current(){return MISSIONS[state.step]||null;}
 function done(){
  const p=player(),j=state.step;
  if(j===0)return state.walk>=20;
  if(j===1)return !!state.flags.phone;
  if(j===2)return !!window.CitySim?.data?.job;
  if(j===3)return !!state.flags.job;
  if(j===4)return !!window.CitySim?.data?.home;
  if(j===5)return !!state.flags.social;
  if(j===6)return !!state.flags.needs;
  if(j===7)return !!state.flags.event;
  return false;
 }
 function check(){
  if(!ready)return;
  let changed=false;
  for(let n=0;n<MAX_STEP&&state.step<MAX_STEP&&done();n++){
   const m=current();
   window.CityLife?.credit?.(m.reward,'Campanha de chegada · '+m.title);
   state.totalRewards+=m.reward;state.step++;changed=true;
   message('🎯 Objetivo concluído: '+m.title+' · +'+money(m.reward));
  }
  if(changed){save();updateHud();if(active)render();}
 }
 function updateHud(){
  if(!hud)return;
  const m=current();
  hud.querySelector('.cga-step').textContent=m?'CAPÍTULO 1 · '+(state.step+1)+'/8':'CAPÍTULO 1 CONCLUÍDO';
  hud.querySelector('.cga-title').textContent=m?m.title:'Sua vida, suas escolhas';
  hud.querySelector('.cga-desc').textContent=m?m.desc:'Explore empregos, encontros, eventos e conquistas.';
  const alert=hud.querySelector('.cga-alert');
  if(alert){alert.hidden=!event;alert.textContent=event?'📍 Acontecimento próximo: '+event.type.title+' · '+Math.round(Math.hypot((player()?.x||0)-event.x,(player()?.y||0)-event.y))+' m':'';}
 }
 function mount(){
  if(ready)return;ready=true;read();
  hud=document.createElement('aside');hud.id='city-adventure-hud';
  hud.innerHTML='<span class="cga-step"></span><strong class="cga-title"></strong><small class="cga-desc"></small><button type="button" data-cga-open>J · Vida na Cidade</button><button type="button" class="cga-alert" data-cga-route hidden></button>';
  document.body.append(hud);
  el=document.createElement('div');el.id='city-adventure-shade';el.hidden=true;el.innerHTML='<section class="cga-panel" role="dialog" aria-modal="true" aria-label="Vida na Cidade"></section>';document.body.append(el);
  hud.addEventListener('click',e=>{if(e.target.closest('[data-cga-open]'))open('missions');if(e.target.closest('[data-cga-route]'))route();});
  el.addEventListener('click',e=>{
   if(e.target===el||e.target.closest('[data-cga-close]')){close();return;}
   const t=e.target.closest('[data-cga-tab]');if(t){tab=t.dataset.cgaTab;render();return;}
   const choose=e.target.closest('[data-cga-choice]');if(choose){resolveEvent(Number(choose.dataset.cgaChoice));return;}
   if(e.target.closest('[data-cga-route]'))route();
   if(e.target.closest('[data-cga-gps]'))guideJob();
  });
  document.addEventListener('keydown',e=>{
   if(e.key.toLowerCase()==='j'&&!e.repeat&&document.activeElement?.tagName!=='INPUT'&&document.activeElement?.tagName!=='TEXTAREA'&&!window.CityFront?.blocked){e.preventDefault();e.stopImmediatePropagation();active?close():open('missions');}
   else if(active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}
  },true);
  updateHud();check();
 }
 function open(next='missions'){
  if(!ready||window.CityFront?.blocked||window.CityHomeUI?.active)return;
  active=true;tab=next;el.hidden=false;document.body.classList.add('city-adventure-open');render();
  window.__game?.input?.keys?.clear?.();
  window.__game?.input?.pressed?.clear?.();
  el.querySelector('[data-cga-close]')?.focus();
 }
 function close(){if(!el)return;active=false;el.hidden=true;document.body.classList.remove('city-adventure-open');window.__game?.input?.keys?.clear?.();}
 function guideJob(){const r=window.CityJobs?.route?.();message(r?.text||'Candidate-se pelo celular para receber uma rota de trabalho.');}
 function route(){if(!event)return;const ok=window.CityGPS?.set?.({id:'event:'+event.type.id,x:event.x,y:event.y,name:event.type.title});if(!ok)message('O acontecimento está perto: use o alerta de distância para encontrá-lo.');}
 function render(){
  if(!active||!el)return;
  const m=current(),panel=el.querySelector('.cga-panel');
  const tabs=[['missions','🎯 Objetivos'],['events','🌆 Acontecimentos']];
  const nav='<nav class="cga-tabs">'+tabs.map(x=>'<button type="button" data-cga-tab="'+x[0]+'" class="'+(tab===x[0]?'on':'')+'">'+x[1]+'</button>').join('')+'</nav>';
  let body='';
  if(tab==='missions'){
   body='<div class="cga-info"><b>'+(m?escape(m.title):'Capítulo de chegada concluído')+'</b><p>'+(m?escape(m.desc):'Você já sabe como começar sua vida nesta cidade. Agora escolha seus próprios objetivos.')+'</p>'+(m?'<small>'+escape(m.hint)+'</small><p>Recompensa: '+money(m.reward)+'</p>':'<p>Recompensas acumuladas: '+money(state.totalRewards)+'</p>')+'</div>';
   body+='<div class="cga-list">'+MISSIONS.map((it,i)=>'<div class="cga-row '+(i<state.step?'done':'')+'"><span>'+(i<state.step?'✓':(i===state.step?'●':'○'))+'</span><div><b>'+escape(it.title)+'</b><small>'+escape(it.desc)+'</small></div><em>+'+money(it.reward)+'</em></div>').join('')+'</div>';
   if(m&&state.step===3)body+='<button class="cga-main" data-cga-gps>Traçar rota para meu emprego</button>';
  }else{
   body='<div class="cga-info"><b>Reputação comunitária: '+state.reputation+'</b><p>A cidade oferece 12 tipos de pequenos encontros. Suas escolhas geram consequências e alteram a carteira e a reputação.</p></div>';
   if(event)body+='<div class="cga-info"><b>📍 '+escape(event.type.title)+'</b><p>'+escape(event.type.desc)+'</p><small>Distância: '+Math.round(Math.hypot((player()?.x||0)-event.x,(player()?.y||0)-event.y))+' m</small><p><button data-cga-route>Traçar GPS</button></p></div>';
   else body+='<div class="cga-info">Nenhuma ocorrência próxima neste momento. Explore a cidade a pé para encontrar novas histórias.</div>';
   body+='<div class="cga-list">'+state.history.slice(0,12).map(x=>'<div class="cga-row"><span>📘</span><div><b>'+escape(x.title)+'</b><small>'+escape(x.result)+'</small></div><em>'+money(x.cash)+'</em></div>').join('')+'</div>';
  }
  panel.innerHTML='<header><div><small>City of God · Sua jornada</small><h2>Vida na Cidade</h2></div><button data-cga-close aria-label="Fechar">✕</button></header>'+nav+'<div class="cga-content">'+body+'</div>';
 }
 function chooseSpot(p){
  const w=window.__game?.world,angle=Math.random()*Math.PI*2;
  for(let i=0;i<16;i++){
   const a=angle+i*.62,d=5+(i%4)*2,x=p.x+Math.cos(a)*d,y=p.y+Math.sin(a)*d;
   try{if(w?.blocked?.(x,y,.35))continue;}catch(_){}
   return {x,y};
  }
  return {x:p.x+2,y:p.y+2};
 }
 function spawnEvent(p){
  if(!p||event)return;
  const options=EVENTS.filter(x=>x.id!==state.lastEventId),type=options[(Math.random()*options.length)|0];
  const pos=chooseSpot(p),nonce=++eventId;
  event={type,x:pos.x,y:pos.y,ttl:180};eventClock=0;eventNpc=null;state.lastEventId=type.id;save();updateHud();
  Promise.resolve(window.cityCharacters?.spawnExtra?.(pos.x,pos.y,{face:0,floor:0})).then(n=>{if(event&&eventId===nonce)eventNpc=n;else if(n)window.cityCharacters?.removeExtra?.(n);}).catch(()=>{});
  message('📍 Vida na cidade: '+type.title+' · '+Math.round(Math.hypot(p.x-pos.x,p.y-pos.y))+' m');
 }
 function removeEvent(){
  eventId++;if(eventNpc)window.cityCharacters?.removeExtra?.(eventNpc);
  eventNpc=null;event=null;updateHud();
 }
 function prompt(p){if(!event||!p||window.cityVehicles?.driver)return null;return Math.hypot(p.x-event.x,p.y-event.y)<3.5?'F · '+event.type.title:null;}
 function interact(p){if(!prompt(p))return false;open('events');tab='events';renderEventChoices();return 'Vida na Cidade: '+event.type.title;}
 function renderEventChoices(){
  if(!active||!event)return;
  const e=event.type,area=el.querySelector('.cga-content');if(!area)return;
  area.innerHTML='<div class="cga-info"><b>🌆 '+escape(e.title)+'</b><p>'+escape(e.desc)+'</p><blockquote>“'+escape(e.line)+'”</blockquote><p>O que você deseja fazer?</p></div><div class="cga-list">'+e.choices.map((c,i)=>'<button class="cga-choice" data-cga-choice="'+i+'"><b>'+escape(c[0])+'</b><small>'+((c[1]>=0?'+':'')+money(c[1]))+' · Reputação '+(c[2]>=0?'+':'')+c[2]+'</small></button>').join('')+'</div>';
 }
 function resolveEvent(index){
  if(!event||!event.type.choices[index])return;
  const e=event.type,c=e.choices[index],cash=c[1],rep=c[2];
  if(cash<0&&!window.CityLife?.debit?.(-cash,'Acontecimento · '+e.title)){message('Você não tem saldo para essa escolha.');return;}
  if(cash>0)window.CityLife?.credit?.(cash,'Acontecimento · '+e.title);
  state.reputation=Math.max(-100,Math.min(100,state.reputation+rep));
  state.eventCount[e.id]=(state.eventCount[e.id]||0)+1;
  state.history.unshift({title:e.title,result:c[0],cash,at:Date.now()});state.history=state.history.slice(0,30);
  if(e.service&&rep>0)window.cityCharacters?.occurrence?.(e.service,event.x,event.y,{duration:45});
  signal('event');save();removeEvent();nextEvent=120;close();message('🌆 '+e.title+' resolvido · reputação '+state.reputation);
 }
 function tick(dt){
  if(!ready||!player()||window.CityFront?.blocked)return;
  const p=player();
  if(lastPos&&!window.cityVehicles?.driver){
   const d=Math.hypot(p.x-lastPos.x,p.y-lastPos.y);
   if(d<3&&!(p.floor||0))state.walk+=d;
  }
  lastPos={x:p.x,y:p.y};
  socialCheckT+=dt;
  if(!state.flags.social&&socialCheckT>=1){
   socialCheckT=0;
   const rel=window.cityCharacters?.social?.relations;
   if(rel&&[...rel].some(([key,r])=>key.split('|').includes('player')&&r.memories?.some(m=>m.actor==='player'&&m.channel==='local')))signal('social');
  }
  if(!active)check();
  if(event){
   eventClock+=dt;
   if(eventClock>=event.ttl){removeEvent();nextEvent=60;}
  }else if(playing()&&!(p.floor||0)){
   nextEvent-=dt;
   if(state.step===7)nextEvent=Math.min(nextEvent,15);
   if(nextEvent<=0){spawnEvent(p);nextEvent=150;}
  }
  notifyT+=dt;if(notifyT>1){notifyT=0;updateHud();}
 }
 const api={mount,tick,open,close,signal,interact,prompt,route,get active(){return active;},
  get progress(){return {step:state.step,missions:MISSIONS.length,reputation:state.reputation,events:state.history.length};},
  MISSIONS,EVENTS};
 return api;
})();
window.CityAdventures=CityAdventures;
