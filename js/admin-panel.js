// City of God — developer / administrator console for the local single-player world.
// The production panel opens ONLY after a valid server-signed HttpOnly session.
// No menu action implies access to other players' accounts or authoritative servers.
(function(){
 'use strict';
 const API='/api/admin-auth',local=['localhost','127.0.0.1','::1'].includes(location.hostname);
 const LIMIT=1000000,MAXLOG=70,LOGKEY='cityofgod.admin.audit.v1';
 let root=null,tab='overview',granted=false,open=false,busy=false,search='',message='',undo=null,log=[];
 let lastTab='overview',searchTimer=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
 const money=v=>'R$ '+Number(v||0).toLocaleString('pt-BR');
 const n=v=>Number.isFinite(Number(v))?Number(v):NaN;
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const get=()=>window.__game||null;
 const life=()=>window.CityLife;
 const rl=()=>window.CityRealty;
 const vehicles=()=>window.cityVehicles;
 const world=()=>get()?.world;
 const player=()=>get()?.player;
 const fmt=v=>Number.isFinite(v)?Number(v).toFixed(1):'—';
 const mapSize=()=>window.cityVehicleBridge?.mapSize||12800;
 const buttons=(id,label,extra='')=>'<button type="button" data-admin-action="'+esc(id)+'" '+extra+'>'+esc(label)+'</button>';
 function record(action,detail){
  const row={time:new Date().toISOString(),action:String(action).slice(0,60),detail:String(detail).slice(0,180)};
  log.unshift(row);log=log.slice(0,MAXLOG);
  try{localStorage.setItem(LOGKEY,JSON.stringify(log));}catch{}
 }
 function toast(text,success=true){message=(success?'✓ ':'⚠ ')+text;const e=root?.querySelector('#city-admin-toast');if(e)e.textContent=message;window.CityUI?.notify?.(text);}
 async function auth(password){
  if(local)return true; // Only local machine (not a public URL): single-player developer build.
  try{
   const init=password?{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})}:{method:'GET',credentials:'same-origin'};
   const r=await fetch(API,{...init,cache:'no-store'});
   return r.ok&&!!(await r.json()).ok;
  }catch{return false;}
 }
 async function ensure(){
  if(local)return true;
  const ok=await auth();
  if(!ok){granted=false;render();toast('Sessão expirada. Faça login novamente.',false);}
  return ok;
 }
 const input=(id,label,type='text',value='',min='',max='')=>
  '<label class="ca-field">'+esc(label)+'<input id="ca-'+esc(id)+'" type="'+type+'" value="'+esc(value)+'" '+
    (type==='number'?'step="any" min="'+esc(min)+'" max="'+esc(max)+'"':'')+' autocomplete="off" spellcheck="false"></label>';
 const val=id=>root?.querySelector('#ca-'+id)?.value??'';
 function state(){
  const p=player(),g=get(),w=world(),fleet=vehicles();
  const houses=window.cityVehicleBridge?.houses||g?.houses||[];
  const boxes=window.cityVehicleBridge?.boxes||[];
  return {p,g,w,fleet,houses,boxes};
 }
 function summary(){
  const {p,w,fleet,houses,boxes}=state(),s=get()?.st;
  const stats=fleet?.getPerformanceMetrics?.()||{};
  return {coords:[p?.x,p?.y],funds:life()?.funds||0,
   health:s?.hp??0,energy:s?.needs?.energy??0,food:s?.food??0,water:s?.water??0,
   houses:houses.length,owned:Object.keys(rl()?.owned||{}).length,
   parked:boxes.filter(b=>b.kind==='parkedcar'&&!b.fleetHidden).length,
   actors:get()?.st?.npcs?.length||0,weather:w?.weather??null,
   sectors:w?.open?window.cityAdminHooks?.sectorStats?.()||null:null,
   vehicles:fleet?.catalog?.length||0,garage:fleet?.parked3d?.cars||0,
   graphics:stats.gpu||stats.renderer||null};
 }
 function overview(){
  const a=summary(),p=player();
  const metrics=[
   ['Saldo',money(a.funds)],['Posição',fmt(p?.x)+' / '+fmt(p?.y)],
   ['Vida',Math.round(a.health*100)+'%'],['Energia',Math.round(a.energy*100)+'%'],
   ['Casas carregadas',a.houses],['Imóveis próprios',a.owned],['Carros próximos',a.parked],
   ['Modelos GLB',a.vehicles],['NPCs',a.actors],['Veículos 3D ativos',a.garage]
  ];
  return '<div class="ca-tiles">'+metrics.map(([k,v])=>'<div class="ca-tile"><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>').join('')+
    '</div><div class="ca-panel"><h3>Atalhos de operação</h3><p>Comandos afetam somente esta partida local. A identidade administrativa é verificada no servidor.</p>'+
    buttons('heal','❤️ Restaurar personagem')+buttons('go-spawn','📍 Teleportar ao spawn')+
    buttons('backup','📄 Exportar diagnóstico')+buttons('reload','↻ Atualizar dados')+'</div>';
 }
 function playerPanel(){
  const g=get(),s=g?.st,p=g?.player,needs=s?.needs||{};
  const stats=[['Vida',s?.hp],['Fome / saciedade',s?.food],['Água',s?.water],
   ['Energia',needs.energy],['Higiene',needs.hygiene],['Resistência',needs.stamina]];
  return '<div class="ca-panel"><h3>Estado do personagem</h3><div class="ca-statrows">'+stats.map(([label,v])=>
   '<div><span>'+esc(label)+'</span><progress max="1" value="'+clamp(n(v)||0,0,1)+'"></progress><b>'+Math.round((Number(v)||0)*100)+'%</b></div>').join('')+
   '</div><p>Posição: X '+fmt(p?.x)+' · Y '+fmt(p?.y)+' · andar '+(p?.floor||0)+'</p>'+
   buttons('heal','Restaurar necessidades')+buttons('go-spawn','Ir ao spawn')+'</div>';
 }
 function economy(){
  const balance=life()?.funds||0;
  return '<div class="ca-panel"><h3>Economia local</h3><div class="ca-hero">'+money(balance)+'</div>'+
   '<p>Máximo atual do jogo: R$ 1.000.000. O valor é salvo no navegador, não em contas multiplayer.</p>'+
   '<div class="ca-form">'+input('funds','Valor (R$)','number',balance,0,LIMIT)+'</div>'+
   buttons('money-set','Definir saldo')+buttons('money-add','Adicionar')+buttons('money-take','Retirar')+
   '</div><div class="ca-panel"><h3>Últimas transações</h3>'+
    (life()?.history||[]).slice(0,15).map(x=>'<div class="ca-listrow"><span>'+esc(x.text)+'</span><b>'+money(x.delta||0)+'</b></div>').join('')+'</div>';
 }
 function destinations(){
  return window.CityGPS?.pois?.()||[];
 }
 function teleport(){
  const p=player(),places=destinations(),featured=places.filter(x=>['police','hospital','cityhall','school','airport','town','port','military','home','gas'].includes(x.type)).slice(0,65);
  return '<div class="ca-panel"><h3>Teleporte para coordenadas</h3>'+
    '<p>O destino é carregado e validado contra água, paredes e colisões antes de mover o personagem. Saia do carro antes de teleportar.</p>'+
    '<div class="ca-form">'+input('x','Coordenada X','number',Math.round(p?.x||0),0,mapSize())+
    input('y','Coordenada Y','number',Math.round(p?.y||0),0,mapSize())+'</div>'+
    buttons('teleport-coords','Teleportar')+buttons('go-spawn','Voltar ao spawn')+'</div>'+
    '<div class="ca-panel"><h3>Locais reais do mapa <small>('+featured.length+')</small></h3>'+
    '<div class="ca-search">'+input('filter-place','Filtrar locais','search',search)+'</div>'+
    '<div class="ca-scroll">'+featured.filter(x=>(x.name+' '+x.type).toLowerCase().includes(search.toLowerCase())).slice(0,45)
     .map(x=>'<div class="ca-listrow"><span><b>'+esc(x.name)+'</b><small>'+esc(x.type)+' · '+fmt(x.x)+', '+fmt(x.y)+'</small></span>'+
      buttons('go-poi','Ir','data-id="'+esc(x.id)+'"')+'</div>').join('')+'</div></div>';
 }
 function housesPanel(){
  const {houses}=state(),realty=rl(),rows=houses.filter(h=>realty?.residential(h))
   .sort((a,b)=>Math.hypot(a.doorPt[0]-player().x,a.doorPt[1]-player().y)-
              Math.hypot(b.doorPt[0]-player().x,b.doorPt[1]-player().y));
  const filtered=rows.filter(h=>{
   const label=realty.name(h)+' '+realty.id(h)+' '+Math.round(h.doorPt[0])+','+Math.round(h.doorPt[1]);
   return label.toLowerCase().includes(search.toLowerCase());
  });
  return '<div class="ca-panel"><h3>Inspetor de imóveis</h3><p>Casas do setor carregado: '+rows.length+
   '. Casas fora dos setores ativos aparecem ao aproximar-se ou depois de teleportar. Conceder posse é uma operação de teste local.</p>'+
   '<div class="ca-search">'+input('filter-house','Pesquisar casa, ID ou coordenadas','search',search)+'</div>'+
   '<div class="ca-scroll">'+filtered.slice(0,60).map(h=>{
    const id=realty.id(h),mine=realty.isOwned(h);
    return '<div class="ca-house"><div><b>'+esc(realty.name(h))+'</b><small>#'+esc(id)+' · '+fmt(h.doorPt[0])+', '+fmt(h.doorPt[1])+
      ' · '+Math.round((h.x1-h.x0)*(h.y1-h.y0))+' m²</small>'+
      '<small>'+(mine?'✓ Propriedade sua':'À venda · '+money(realty.price(h)))+'</small></div>'+
      '<div class="ca-row">'+buttons('go-house','Localizar','data-id="'+esc(id)+'"')+
      buttons('own-house',mine?'Revogar posse':'Conceder posse','data-id="'+esc(id)+'"')+'</div></div>';
   }).join('')+'</div></div>';
 }
 function vehiclePanel(){
  const fleet=vehicles(),w=world(),boxes=state().boxes;
  const groups=fleet?.fleetDirectory?.groups||[];
  const cars=boxes.filter(b=>b.kind==='parkedcar'&&!b.fleetHidden);
  return '<div class="ca-panel"><h3>Catálogo de veículos</h3><p>Modelos disponíveis: '+(fleet?.catalog?.length||0)+
   ' · carros estacionados nos setores: '+cars.length+'. Os veículos em espera de GLB não podem ser instanciados.</p>'+
   '<div class="ca-form"><label class="ca-field">Modelo 3D instalado<select id="ca-vehicle">'+(fleet?.catalog||[])
     .map(v=>'<option value="'+esc(v.id)+'">'+esc(v.name)+' ('+esc(v.id)+')</option>').join('')+'</select></label></div>'+
    buttons('deliver-vehicle','Entregar carro perto do jogador')+
   '<p>Integridade do carro atual: '+(fleet?.getDamageStatus?.()?Math.round(fleet.getDamageStatus().integrity*100)+'%':'Indisponível')+'</p>'+
   buttons('repair-vehicle','Reparar carro atual (teste admin)')+'</div>'+
   '<div class="ca-panel"><h3>Departamentos</h3>'+
   groups.map(g=>'<details class="ca-dept"><summary>'+esc(g.icon)+' '+esc(g.title)+' — '+g.vehicles.length+'</summary>'+
    g.vehicles.map(v=>'<div class="ca-listrow"><span>'+esc(v.name)+'</span><small>'+(v.ready?'GLB ativo':'Aguardando arquivo')+'</small></div>').join('')+
    '</details>').join('')+'</div>';
 }
 function worldPanel(){
  const w=world(),s=summary(),c=window.CityDistrictsLocation?.()||{};
  return '<div class="ca-panel"><h3>Diagnóstico do mundo</h3>'+
   [['Modo',w?.open?'Mundo aberto':'Mapa local'],['Semente',w?.seed??'—'],
   ['Bairro',c.district||c.name||'—'],['Coordenadas',fmt(player()?.x)+' / '+fmt(player()?.y)],
   ['Casas carregadas',s.houses],['Carros próximos',s.parked],
   ['Setores',s.sectors?JSON.stringify(s.sectors):'—'],['Render 3D',s.graphics?JSON.stringify(s.graphics).slice(0,150):'—']]
   .map(([l,v])=>'<div class="ca-listrow"><span>'+esc(l)+'</span><strong>'+esc(v)+'</strong></div>').join('')+
   '</div><div class="ca-panel"><h3>Ferramentas de inspeção</h3>'+
   buttons('copy-pos','Copiar coordenadas')+buttons('backup','Exportar diagnóstico JSON')+
   buttons('reload','Atualizar painel')+'</div>';
 }
 function logPanel(){
  return '<div class="ca-panel"><h3>Auditoria local</h3><p>Registro apenas deste navegador. Não é log de servidor nem registro de outros jogadores.</p>'+
   buttons('backup','Exportar diagnóstico')+buttons('clear-log','Limpar histórico local')+
   '<div class="ca-scroll">'+log.map(x=>'<div class="ca-listrow"><span><b>'+esc(x.action)+'</b><small>'+
      esc(new Date(x.time).toLocaleString('pt-BR'))+' · '+esc(x.detail)+'</small></span></div>').join('')+
   '</div></div>';
 }
 const tabs=[['overview','Visão geral'],['player','Jogador'],['economy','Economia'],['teleport','Teleporte'],
   ['houses','Casas'],['vehicles','Veículos'],['world','Mundo'],['log','Auditoria']];
 function render(){
  if(!root)return;
  root.hidden=!open;
  root.classList.toggle('ca-locked',!granted);
  const body=!granted?
   '<div class="ca-login"><span class="ca-icon">🔐</span><h2>Acesso administrativo</h2>'+
   '<p>Entre com sua credencial de administrador. A autenticação ocorre no servidor; sem ela nenhum comando é liberado.</p>'+
   '<form id="ca-auth-form"><label class="ca-field">Senha de administrador<input id="ca-password" type="password" required minlength="16" autocomplete="current-password" placeholder="Senha definida no servidor"></label><button type="submit">Desbloquear painel</button></form></div>':
   '<nav class="ca-nav">'+tabs.map(([id,label])=>'<button type="button" data-admin-tab="'+id+'" aria-current="'+(tab===id)+'">'+esc(label)+'</button>').join('')+'</nav>'+
   '<main class="ca-main">'+({overview,player:playerPanel,economy,teleport,houses:housesPanel,vehicles:vehiclePanel,world:worldPanel,log:logPanel}[tab]||overview)()+'</main>';
  root.innerHTML='<div class="ca-shell" role="dialog" aria-modal="true" aria-label="Painel administrativo do City of God">'+
   '<header><div><small>CODEX / CITY OF GOD · FERRAMENTAS DE DESENVOLVIMENTO</small>'+
   '<h1>Centro de Comando <span>ADMIN</span></h1></div><div class="ca-head-actions">'+
   (granted?buttons('logout','Sair da sessão'):'')+buttons('close','✕ Fechar')+'</div></header>'+
   body+'<footer><span id="city-admin-toast" aria-live="polite">'+esc(message)+'</span><small>F10 · somente a partida local</small></footer></div>';
  root.querySelector('#ca-auth-form')?.addEventListener('submit',login);
 }
 async function login(e){
  e.preventDefault();if(busy)return;busy=true;
  const pw=root.querySelector('#ca-password')?.value||'';
  const ok=await auth(pw);busy=false;
  if(ok){granted=true;tab='overview';record('login','Sessão administrativa iniciada');message='Acesso autorizado';render();}
  else{message='Credenciais inválidas ou autenticação indisponível';render();root.querySelector('#ca-password')?.focus();}
 }
 function close(){
  open=false;root.hidden=true;document.body.classList.remove('city-admin-open');
  window.cityVehicleBridge?.releaseControls?.();
 }
 async function toggle(){
  if(open){close();return;}
  if(document.body.classList.contains('front-open')||window.CityFront?.blocked)return;
  open=true;document.body.classList.add('city-admin-open');
  granted=await auth();render();
  window.cityVehicleBridge?.releaseControls?.();
  (granted?root.querySelector('[data-admin-tab]'):root.querySelector('#ca-password'))?.focus();
 }
 function houseById(id){return state().houses.find(h=>rl()?.residential(h)&&rl().id(h)===id);}
 async function safeTeleport(targetX,targetY,label){
  const p=player(),g=get(),w=world(),bridge=window.cityVehicleBridge;
  if(!p||!g||!bridge)return 'Jogo não inicializado';
  if(vehicles()?.driver)return 'Saia do veículo para teleportar';
  const x=n(targetX),y=n(targetY);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<1||y<1||x>mapSize()-1||y>mapSize()-1)
   return 'Coordenadas fora do mapa';
  // Streaming creates relevant collision geometry before moving the player.
  try{await w?.prepareResume?.(x,y);}catch{return 'Não foi possível carregar este destino';}
  let found=null;
  for(const r of [0,2,4,6,9,12]){if(found)break;
   for(let k=0;k<(r?12:1);k++){
    const a=k*Math.PI/6,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;
    if(px<1||py<1||px>mapSize()-1||py>mapSize()-1)continue;
    if(bridge.pondVal?.(px,py)<=1.04)continue;
    const pt=bridge.collide?.(px,py,.35,0)||[px,py];
    if(Math.hypot(pt[0]-px,pt[1]-py)>.15)continue;
    if(w?.blocked?.(px,py,.34))continue;
    found=[px,py];break;
   }
  }
  if(!found)return 'Sem área segura para teleportar perto do destino';
  const old=[p.x,p.y];
  Object.assign(p,{x:found[0],y:found[1],floor:0,floorZ:0,stairTravel:null,jump:null,traversal:null,actionZ:0,speed:0});
  const cam=g.cam;cam.x=cam.tx=p.x;cam.y=cam.ty=p.y;w.version=(w.version||0)+1;
  undo={type:'teleport',x:old[0],y:old[1]};
  record('teleporte',label+' → '+fmt(p.x)+', '+fmt(p.y));return null;
 }
 async function apply(action,element){
  const id=element?.dataset?.id;
  if(!await ensure())return;
  const g=get(),s=g?.st,p=g?.player;
  if(!g||!s||!p)return toast('Partida indisponível',false);
  if(action==='reload'){render();return;}
  if(action==='backup'){const data={at:new Date().toISOString(),summary:summary(),
     position:{x:p.x,y:p.y},catalog:vehicles()?.fleetDirectory?.groups||[],audit:log,
     buildings:state().houses.slice(0,150).map(h=>({x:h.x0,y:h.y0,kind:h.miaKind,owner:rl()?.isOwned(h)||false}))};
   const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cityofgod-admin-diagnostic.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
   record('diagnóstico','Arquivo JSON exportado');return toast('Diagnóstico exportado');}
  if(action==='copy-pos'){try{await navigator.clipboard.writeText(fmt(p.x)+', '+fmt(p.y));return toast('Coordenadas copiadas');}catch{return toast('Falha ao copiar',false);}}
  if(action==='clear-log'){if(!confirm('Limpar o histórico administrativo local?'))return;log=[];localStorage.removeItem(LOGKEY);render();return;}
  if(action==='heal'){
   Object.assign(s,{hp:1,food:1,water:1});for(const key of Object.keys(s.needs||{}))s.needs[key]=key==='bladder'?0:1;
   life()?.save();record('jogador','Vida e necessidades restauradas');render();return toast('Personagem restaurado');
  }
  if(['money-set','money-add','money-take'].includes(action)){
   const amount=n(val('funds')),previous=life()?.funds;
   if(!Number.isSafeInteger(amount)||amount<0||amount>LIMIT)return toast('Digite um valor inteiro de 0 a 1.000.000',false);
   const desired=action==='money-set'?amount:action==='money-add'?previous+amount:previous-amount;
   if(desired<0||desired>LIMIT)return toast('Saldo fora dos limites',false);
   if(!confirm('Aplicar alteração de saldo? '+money(previous)+' → '+money(desired)))return;
   const delta=desired-previous;
   if(delta>0&&!life()?.credit(delta,'Admin · ajuste de saldo'))return toast('Não foi possível creditar',false);
   if(delta<0&&!life()?.debit(-delta,'Admin · ajuste de saldo'))return toast('Não foi possível debitar',false);
   undo={type:'money',previous};
   record('saldo',money(previous)+' → '+money(desired));render();return toast('Saldo atualizado');
  }
  if(action==='go-spawn'||action==='teleport-coords'||action==='go-poi'||action==='go-house'){
   let x,y,label='';
   if(action==='go-spawn'){[x,y]=g.world.spawn;label='Spawn inicial';}
   else if(action==='teleport-coords'){x=val('x');y=val('y');label='Coordenadas';}
   else if(action==='go-poi'){const destination=destinations().find(t=>t.id===id);if(!destination)return toast('Local não encontrado',false);
    x=destination.x;y=destination.y;label=destination.name;}
   else{const H=houseById(id);if(!H)return toast('Casa não carregada',false);x=H.doorPt?.[0]??H.x0;y=H.doorPt?.[1]??H.y0;label='Imóvel '+id;}
   toast('Carregando destino…');const err=await safeTeleport(x,y,label);
   if(err)return toast(err,false);render();return toast('Teleporte concluído: '+label);
  }
  if(action==='own-house'){
   const H=houseById(id);
   if(!H)return toast('Imóvel indisponível',false);
   const change=!rl().isOwned(H);
   if(!confirm((change?'Conceder':'Revogar')+' posse de teste deste imóvel?'))return;
   const result=rl().adminSetOwned(H,change);
   if(!result.ok)return toast(result.text,false);
   record('imóvel',(change?'Concedida':'Revogada')+' posse de '+id);
   render();return toast(result.text);
  }
  if(action==='repair-vehicle'){
   if(!vehicles()?.driver)return toast('Entre no veículo que deseja reparar',false);
   if(!confirm('Reparar carro atual e remover danos visuais da carroceria?'))return;
   if(!vehicles().repairVehicle?.())return toast('Reparo indisponível',false);
   record('reparo','Veículo restaurado para 100%');render();return toast('Veículo restaurado');
  }
  if(action==='deliver-vehicle'){
   const model=val('vehicle');
   if(!vehicles()?.catalog?.some(v=>v.id===model))return toast('Modelo não está instalado',false);
   if(vehicles().driver)return toast('Saia do veículo antes de entregar outro',false);
   toast('Procurando local seguro para entrega…');
   const ok=await vehicles().deliverVehicle(model);
   if(!ok)return toast('Sem estacionamento seguro disponível',false);
   record('veículo','Entregue modelo '+model);render();return toast('Veículo entregue perto do personagem');
  }
 }
 function mount(){
  if(root)return;
  try{log=JSON.parse(localStorage.getItem(LOGKEY)||'[]');if(!Array.isArray(log))log=[];log=log.slice(0,MAXLOG);}catch{log=[];}
  root=document.createElement('section');root.id='city-admin';root.hidden=true;document.body.appendChild(root);
  root.addEventListener('click',async e=>{
   const tabTarget=e.target.closest('[data-admin-tab]');
   if(tabTarget){tab=tabTarget.dataset.adminTab;search='';message='';render();return;}
   const action=e.target.closest('[data-admin-action]');if(!action)return;
   const key=action.dataset.adminAction;
   if(key==='close')return close();
   if(key==='logout'){if(!local)try{await fetch(API,{method:'DELETE',credentials:'same-origin'});}catch{}
    granted=false;message='Sessão encerrada';record('logout','Sessão encerrada');render();return;}
   if(busy||!granted)return;
   busy=true;try{await apply(key,action);}catch(err){console.error('[Admin]',err);toast('Falha no comando: '+err.message,false);}finally{busy=false;}
  });
  root.addEventListener('input',e=>{
   if(e.target.matches('#ca-filter-house,#ca-filter-place')){
    const v=e.target.value;search=v;
    const sel=e.target.selectionStart;
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>{render();const input=root.querySelector(e.target.id?'#'+e.target.id:'#ca-filter-house');input?.focus();input?.setSelectionRange(sel,sel);},150);
   }
  });
  window.addEventListener('keydown',e=>{
   if(e.key==='F10'||e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='a'){
    e.preventDefault();e.stopImmediatePropagation();toggle();return;
   }
   if(open&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
   if(open&&e.target.closest('#city-admin'))e.stopImmediatePropagation();
  },true);
  window.addEventListener('keyup',e=>{if(open){e.preventDefault();e.stopImmediatePropagation();}},true);
 }
 window.CityAdmin=Object.freeze({mount,toggle,close,get active(){return open;},get authorized(){return granted;}});
 window.addEventListener('DOMContentLoaded',mount,{once:true});
 if(document.readyState!=='loading')mount();
})();
