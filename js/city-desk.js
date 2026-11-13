// city-desk.js — CityDesk: o computador de casa vira estação de trabalho (mesa + monitor na unidade do jogador).
// Apps: Início, Contratos, CodeLab (programador), HelpDesk City (suporte), Brand Studio (designer), CityLive (streamer),
// Portfólio e Finanças; a loja online (js/city-commerce.js) se registra aqui como CitySeller e Marketplace.
// Regras em js/city-desk-core.js (puras, testadas); conteúdo em js/city-desk-content.js. Sem eval, sem rede, sem mídia real.
'use strict';
const CityDesk=(()=>{
 const C=window.CityDeskCore,T=window.CityDeskContent,KEY='cityofgod.remote-work.v1';
 let S=C.newState(),root=null,app='home',sel=null,openFlag=false,stationNow=null,ui={tab:'programmer'},lastTick=0;
 const apps=new Map();
 try{S=C.sanitizeState(JSON.parse(localStorage.getItem(KEY)||'null'));}catch{S=C.newState();}
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S));return true;}catch{return false;}};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>window.CityLife?CityLife.money(n):'R$ '+n;
 const clock=()=>window.__game?.st?.clock||0;
 const player=()=>window.__game?.player;
 const notify=(t,ok=true)=>window.CityUI?.notify?.(t,ok);
 const dayTime=c=>{const d=Math.floor(c/1440),m=Math.floor(c%1440);return 'dia '+(d+1)+' · '+String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
 const tpl=(career,id)=>({programmer:T.PROGRAMMER,support:T.SUPPORT,designer:T.DESIGNER}[career]||[]).find(t=>t.id===id);
 const R=(seed)=>C.rng(seed);
 const shuffle=(arr,seed)=>{const r=R(seed);return arr.map(v=>[r(),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);};
 const msg=(text,from='CityDesk')=>{S.messages.push({from,text,clock:clock()});if(S.messages.length>60)S.messages.shift();};

 // ---------- estação de trabalho: mesa/escrivaninha + monitor perto, na unidade do jogador ----------
 const DESKS=['desk','studentdesk'];
 function stationAt(p){
  if(!p||typeof houses==='undefined'||!window.CityHome||!window.CityRealty)return null;
  const f=p.floor||0;
  for(const H of houses){
   if(!H.architecture||!(H.contains?.(p.x,p.y,f))||!(CityRealty.isOwned(H)||CityRealty.multi?.(H)&&CityRealty.ownsUnit?.(H,f)))continue;
   const rows=CityHome.placed(H).filter(r=>(r.floor||0)===f),desks=rows.filter(r=>DESKS.includes(r.kind)),screens=rows.filter(r=>r.kind==='screen');
   for(const d of desks){
    if(Math.hypot(d.x-p.x,d.y-p.y)>2.2)continue;
    // apartamento dividido: a mesa precisa estar no apartamento do jogador (nunca no do vizinho ou no corredor)
    const u=CityRealty.unitAt?.(H,d.x,d.y,f);
    if(CityRealty.multi?.(H)&&(u===null||!CityRealty.canUse(H,f,u)))continue;
    // a escrivaninha já tem monitor e cadeira no modelo (props-3d.mjs); a mesa de estudo precisa de um Monitor perto
    const screen=d.kind==='desk'?{...d,builtin:true}:screens.find(s=>Math.hypot(s.x-d.x,s.y-d.y)<=2.6);
    const addressKey=CityRealty.multi?.(H)&&f>0?CityRealty.unitKey(H,f,u??0):CityRealty.id(H);
    return {H,desk:d,screen,addressKey,floor:f,id:addressKey+':'+d.id};
   }
  }
  return null;
 }
 const blocked=()=>!!(window.CityFront?.blocked||window.CityUI?.blocksGameInput?.()||window.CityHomeUI?.active||window.cityVehicles?.driver);
 function prompt(p){
  if(openFlag||W||blocked()||window.CityCommerce?.claimsDesk?.(p)||window.CityCommerce?.busy)return null;const st=stationAt(p);if(!st)return null;
  return st.screen?'F · Abrir o computador (CityDesk) · Shift+F rotina':'Mesa sem monitor · coloque um Monitor perto (F7 › Decorar) para trabalhar de casa';
 }
 function interact(p){
  if(openFlag||W||blocked()||window.__game?.input?.down?.('shift')||window.CityCommerce?.claimsDesk?.(p)||window.CityCommerce?.busy)return null;
  const st=stationAt(p);if(!st?.screen)return null;
  open('home');return 'CityDesk aberto';
 }

 // ---------- janela ----------
 function ensure(){
  if(root)return root;
  root=document.createElement('section');root.id='city-desk';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','CityDesk');
  document.body.appendChild(root);
  root.addEventListener('click',onClick);root.addEventListener('input',onInput);root.addEventListener('change',onInput);
  window.addEventListener('keydown',e=>{if(!openFlag)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(document.activeElement?.tagName==='INPUT'){document.activeElement.blur();return;}close();}
   else if(!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))e.stopImmediatePropagation();},true);
  return root;
 }
 function open(a='home'){
  stationNow=stationAt(player());if(!stationNow?.screen){notify('Use o computador em casa: mesa com monitor, no seu imóvel.',false);return false;}
  // Do not open the computer or teleport outside if the built-in chair faces
  // a wall. Players can rotate the desk using F7 to make the seat accessible.
  if(!sitDown('desk_code',stationNow))return false;
  ensure();openFlag=true;app=a;root.hidden=false;document.body.classList.add('city-desk-open');
  window.__game?.input?.keys?.clear?.();refreshOffersAll();render();root.querySelector('[data-app="'+a+'"]')?.focus();return true;
 }
 function close(){if(!openFlag)return;openFlag=false;root.hidden=true;document.body.classList.remove('city-desk-open');if(!W)standUp();save();document.getElementById('view')?.focus();}
 function refreshOffersAll(){const c=clock();for(const k of ['programmer','support','designer'])C.refreshOffers(S,k,{programmer:T.PROGRAMMER,support:T.SUPPORT,designer:T.DESIGNER}[k],c,T.CLIENTS);save();}

 const NAV=[['home','Início','🏠'],['contracts','Contratos','📋'],['code','CodeLab','💻'],['help','HelpDesk','🛠️'],['brand','Brand Studio','🎨'],['live','CityLive','🎙️'],['folio','Portfólio','🗂️'],['money','Finanças','💳']];
 function render(){
  if(!root||!openFlag)return;
  const ha=player()?.homeAction;if(ha?.deskWork)ha.kind={brand:'desk_design',live:'desk_stream',help:'desk_help'}[app]||'desk_code';
  const extra=[...apps.entries()].map(([id,d])=>[id,d.label,d.icon]);
  const nav=[...NAV,...extra].map(([id,l,i])=>'<button type="button" data-app="'+id+'" class="'+(app===id?'on':'')+'"><span>'+i+'</span>'+l+'</button>').join('');
  const body=app==='home'?home():app==='contracts'?contracts():app==='code'?codelab():app==='help'?helpdesk():app==='brand'?brand():app==='live'?live():app==='folio'?folio():app==='money'?finance():apps.get(app)?.render(api)||'';
  root.innerHTML='<div class="cd-window"><header class="cd-top"><strong>CityDesk</strong><span class="cd-sub">Meu escritório · '+esc(dayTime(clock()))+'</span><span class="cd-funds">'+money(CityLife.funds)+'</span>'+
   '<button type="button" class="cd-close" data-do="close" aria-label="Fechar">✕</button></header><nav class="cd-nav">'+nav+'</nav><main class="cd-main">'+body+'</main></div>';
  afterRender();
 }
 const card=(title,body,cls='')=>'<article class="cd-card '+cls+'"><h3>'+title+'</h3>'+body+'</article>';
 const bar=(v,max=100)=>'<span class="cd-bar"><i style="width:'+Math.round(C.clamp(v/max,0,1)*100)+'%"></i></span>';
 const btn=(act,label,extra='',dis=false)=>'<button type="button" data-do="'+act+'" '+extra+(dis?' disabled':'')+'>'+label+'</button>';

 // ---------- Início ----------
 function careerCard(k){
  const c=S.careers[k],def=C.CONFIG.careers[k],nx=C.nextLevel(k,c.level);
  return '<div class="cd-career"><b>'+def.icon+' '+def.name+'</b><small>Nível '+c.level+' · '+esc(C.levelName(k,c.level))+'</small>'+bar(c.reputation)+
   '<small>Reputação '+Math.round(c.reputation)+'/100 · '+c.done+' entregas'+(nx?' · próximo nível: '+nx.done+' entregas e reputação '+nx.reputation:'')+'</small></div>';
 }
 function home(){
  const active=S.contracts.filter(c=>['ACCEPTED','IN_PROGRESS','REVISION_REQUIRED'].includes(c.state));
  return '<h2>Home office</h2><p class="cd-muted">Clientes, prazos e pagamentos são simulados por moradores e empresas NPC da cidade. Estação: '+esc(stationNow?.desk?.kind==='desk'?'Escrivaninha':'Mesa de estudo')+' + Monitor.</p>'+
   '<div class="cd-grid">'+['programmer','support','designer','streamer'].map(careerCard).join('')+'</div>'+
   card('Em andamento ('+active.length+')',active.length?active.map(c=>'<div class="cd-row"><span>'+C.CONFIG.careers[c.career].icon+' '+esc(tpl(c.career,c.templateId)?.title||'Sessão')+' · '+esc(c.client?.name)+'</span><small>'+(c.state==='REVISION_REQUIRED'?'revisão pedida · ':'')+'prazo '+esc(dayTime(c.dueClock))+'</small>'+btn('work:'+c.id,'Continuar')+btn('auto:'+c.id,'⚙ Automático')+'</div>').join(''):'<p class="cd-muted">Nenhum trabalho aberto. Veja as propostas em Contratos.</p>')+
   card('Mensagens',S.messages.slice(-6).reverse().map(m=>'<div class="cd-msg"><b>'+esc(m.from)+'</b> '+esc(m.text)+'<small>'+esc(dayTime(m.clock))+'</small></div>').join('')||'<p class="cd-muted">Sem mensagens.</p>');
 }
 // ---------- Contratos ----------
 function contracts(){
  const tabs=['programmer','support','designer'].map(k=>'<button type="button" data-do="tab:'+k+'" class="'+(ui.tab===k?'on':'')+'">'+C.CONFIG.careers[k].icon+' '+C.CONFIG.careers[k].name+'</button>').join('');
  const k=ui.tab,offers=S.offers[k]||[],c=S.careers[k],cap=C.CONFIG.activeMax[c.level],act=C.activeCount(S,k);
  return '<h2>Bolsa de contratos</h2><div class="cd-tabs">'+tabs+'</div><p class="cd-muted">Em andamento '+act+'/'+cap+' · as propostas mudam a cada dia de jogo. Valor bruto; a plataforma retém '+Math.round(C.CONFIG.fee*100)+'%.</p>'+
   (offers.length?offers.map(o=>{const t=tpl(k,o.templateId);return '<div class="cd-offer"><span class="cd-mono">'+esc(o.client.mono)+'</span><div><b>'+esc(t.title)+'</b><small>'+esc(o.client.name)+' · '+esc(o.client.sector)+' · prazo '+o.dueDays+' dia(s) · nível '+(t.minLevel||1)+'</small></div><strong>'+money(o.gross)+'</strong>'+btn('accept:'+o.id,'Aceitar','',act>=cap)+'</div>';}).join(''):'<p class="cd-muted">Sem propostas hoje para o seu nível. Volte amanhã (dia de jogo).</p>');
 }
 // ---------- CodeLab ----------
 function work(c){c.work=c.work||{};return c.work;}
 function pickActive(career){const list=S.contracts.filter(x=>x.career===career&&['ACCEPTED','IN_PROGRESS','REVISION_REQUIRED'].includes(x.state));if(!list.some(x=>x.id===sel))sel=list[0]?.id||null;return list;}
 const activeList=(list,career)=>list.length>1?'<div class="cd-tabs">'+list.map(c=>'<button type="button" data-do="sel:'+c.id+'" class="'+(c.id===sel?'on':'')+'">'+esc(tpl(career,c.templateId)?.title||'')+'</button>').join('')+'</div>':'';
 const testsHtml=tests=>'<ul class="cd-tests">'+tests.map(t=>'<li class="'+(t.pass?'ok':'no')+'">'+(t.pass?'✓':'✗')+' '+esc(t.name)+(t.pass||t.got===undefined?'':' — esperado '+esc(JSON.stringify(t.expect))+', obtido '+esc(JSON.stringify(t.got)))+'</li>').join('')+'</ul>';
 function codeTests(c,t){
  const w=work(c);
  if(t.mech==='sequence')return C.testSequence(w.order||[],t.constraints,t.steps);
  if(t.mech==='rules')return C.testRules(ruleOf(w,t),t.cases);
  if(t.mech==='debug')return w.fix==null?[]:C.testFix(t.options[w.fix].fn,t.cases);
  if(t.mech==='ui')return C.testUI({components:w.components||[],bind:w.bind||{}},t.spec);
  return [];
 }
 const condLabel=p=>p.field+' '+p.op+' '+(typeof p.value==='string'?'“'+p.value+'”':p.value);
 const ruleOf=(w,t)=>({when:(w.conds||[]).filter(i=>i!==''&&i!=null).map(i=>t.palette[+i]).filter(Boolean),combine:w.combine||'and',then:w.then||t.actions[0],else:w.else||t.actions[1]});
 function codelab(){
  const list=pickActive('programmer');if(!list.length)return '<h2>CodeLab</h2><p class="cd-muted">Aceite um contrato de programação em Contratos.</p>'+btn('go:contracts','Ver contratos');
  const c=list.find(x=>x.id===sel),t=tpl('programmer',c.templateId),w=work(c);
  let ed='';
  if(t.mech==='sequence'){
   const pool=shuffle([...t.steps,...(t.decoys||[])],c.seed).filter(s=>!(w.order||[]).includes(s));
   ed='<div class="cd-two"><div><h4>Etapas disponíveis</h4>'+pool.map(s=>btn('seqadd:'+encodeURIComponent(s),'+ '+esc(s),'class="cd-chip"')).join('')+'</div><div><h4>Seu fluxo</h4><ol class="cd-flow">'+
    (w.order||[]).map((s,i)=>'<li>'+esc(s)+' '+btn('sequp:'+i,'↑','class="cd-mini"')+btn('seqdel:'+i,'✕','class="cd-mini"')+'</li>').join('')+'</ol></div></div>';
  }else if(t.mech==='rules'){
   const conds=w.conds||['','',''];
   ed='<div class="cd-rule"><b>SE</b>'+conds.map((v,i)=>'<select data-in="cond:'+i+'"><option value="">— condição —</option>'+t.palette.map((p,j)=>'<option value="'+j+'" '+(String(v)===String(j)?'selected':'')+'>'+esc(condLabel(p))+'</option>').join('')+'</select>'+(i<conds.length-1?'<select data-in="combine" '+(i?'disabled':'')+'><option value="and" '+(w.combine!=='or'?'selected':'')+'>E</option><option value="or" '+(w.combine==='or'?'selected':'')+'>OU</option></select>':'')).join('')+
    '<b>ENTÃO</b><select data-in="then">'+t.actions.map(a=>'<option '+((w.then||t.actions[0])===a?'selected':'')+'>'+a+'</option>').join('')+'</select><b>SENÃO</b><select data-in="else">'+t.actions.map(a=>'<option '+((w.else||t.actions[1])===a?'selected':'')+'>'+a+'</option>').join('')+'</select>'+
    (conds.length<4?btn('addcond','+ condição','class="cd-mini"'):'')+'</div><p class="cd-muted">Campos: '+Object.entries(t.fields).map(([k,v])=>'<code>'+k+'</code> = '+esc(v)).join(' · ')+'</p>';
  }else if(t.mech==='debug'){
   ed='<pre class="cd-code">'+t.code.map(esc).join('\n')+'</pre>'+t.options.map((o,i)=>'<label class="cd-opt"><input type="radio" name="fix" data-in="fix" value="'+i+'" '+(w.fix===i?'checked':'')+'> <b>'+esc(o.label)+'</b>'+(w.tried?.includes(i)?'<small>'+esc(o.why)+'</small>':'')+'</label>').join('');
  }else if(t.mech==='ui'){
   ed='<div class="cd-two"><div><h4>Componentes autorizados</h4>'+t.components.map(([id,l])=>'<label class="cd-opt"><input type="checkbox" data-in="comp:'+id+'" '+((w.components||[]).includes(id)?'checked':'')+'> '+esc(l)+'</label>').join('')+'</div><div><h4>Ligação com os dados</h4>'+
    (w.components||[]).map(id=>'<label class="cd-bind">'+esc(t.components.find(x=>x[0]===id)?.[1])+' <select data-in="bind:'+id+'"><option value="">—</option>'+t.data.map(([d,l])=>'<option value="'+d+'" '+((w.bind||{})[id]===d?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>').join('')+'</div></div>';
  }
  const tests=w.ran?codeTests(c,t):null,rate=tests?C.passRate(tests):0;
  return '<h2>CodeLab</h2>'+activeList(list,'programmer')+'<div class="cd-brief"><span class="cd-mono">'+esc(c.client.mono)+'</span><div><b>'+esc(t.title)+'</b><p>'+esc(t.brief)+'</p><small>'+esc(c.client.name)+' · '+money(c.gross)+' · prazo '+esc(dayTime(c.dueClock))+(c.state==='REVISION_REQUIRED'?' · <b>o cliente pediu revisão: corrija os testes que falharam</b>':'')+'</small></div></div>'+
   '<div class="cd-editor">'+ed+'</div><div class="cd-actions">'+btn('auto:'+c.id,'⚙ Trabalhar no automático')+btn('runtests','▶ Testar')+btn('submitcode','Entregar','',!(w.ran&&rate>=.6))+btn('cancel:'+c.id,'Desistir','class="cd-ghost"')+'</div>'+
   (tests?'<div class="cd-result"><b>'+tests.filter(x=>x.pass).length+'/'+tests.length+' testes passaram</b>'+testsHtml(tests)+'</div>':'<p class="cd-muted">Monte a solução e clique em Testar. A entrega só libera com pelo menos 60% dos testes passando.</p>');
 }
 // ---------- HelpDesk ----------
 // saída de cada teste no momento em que roda (depois do reparo, o teste de verificação mostra o resultado novo)
 const toolOut=(t,w,id)=>w.actions.includes(t.action)&&id===t.verify?(t.action==='escalate'?'Diagnóstico registrado para a visita técnica':'OK após o reparo · '+T.NORMAL[id]):(t.out[id]||T.NORMAL[id]);
 const runTool=(t,w,id)=>{if(!w.tools.includes(id))w.tools.push(id);(w.log=w.log||[]).push([id,toolOut(t,w,id)]);if(w.log.length>30)w.log.shift();w.minutes+=3;};
 function helpdesk(){
  const list=pickActive('support');if(!list.length)return '<h2>HelpDesk City</h2><p class="cd-muted">Aceite um chamado em Contratos.</p>'+btn('go:contracts','Ver chamados');
  const c=list.find(x=>x.id===sel),t=tpl('support',c.templateId),w=work(c);w.tools=w.tools||[];w.actions=w.actions||[];w.minutes=w.minutes||0;
  const acts=shuffle([t.action,...shuffle(Object.keys(T.ACTIONS).filter(a=>a!==t.action&&!T.HARM.includes(a)),c.seed).slice(0,2),T.HARM[c.seed%T.HARM.length],'escalate'].filter((v,i,a)=>a.indexOf(v)===i),c.seed+1);
  const preventions=shuffle([t.prevention,'Reiniciar o computador todos os dias','Desativar o antivírus'],c.seed+2);
  return '<h2>HelpDesk City</h2>'+activeList(list,'support')+'<div class="cd-brief"><span class="cd-mono">'+esc(c.client.mono)+'</span><div><b>'+esc(t.id+' · '+t.title)+'</b><p>'+esc(t.symptom)+'</p><small>'+esc(c.client.name)+' · prioridade '+t.priority+' · SLA '+t.sla+' min · tempo gasto '+w.minutes+' min · '+money(c.gross)+'</small></div></div>'+
   '<div class="cd-two"><div><h4>Diagnóstico (computador simulado do cliente)</h4>'+Object.entries(T.TOOLS).map(([id,l])=>btn('tool:'+id,l,'class="cd-chip'+(w.tools.includes(id)?' used':'')+'"')).join('')+
   '<div class="cd-log">'+(w.log||[]).map(([id,txt])=>'<div><b>'+esc(T.TOOLS[id])+'</b> → '+esc(txt)+'</div>').join('')+'</div></div>'+
   '<div><h4>Causa raiz</h4><select data-in="cause"><option value="">— escolha —</option>'+t.causes.map(x=>'<option '+(w.cause===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select>'+
   '<h4>Ação</h4>'+acts.map(a=>btn('act:'+a,esc(T.ACTIONS[a]),'class="cd-chip'+(w.actions.includes(a)?' used':'')+'"')).join('')+
   '<h4>Verificação</h4>'+btn('verify','Testar de novo ('+esc(T.TOOLS[t.verify])+')','',!w.actions.length)+(w.verified?'<small> ✓ teste executado</small>':'')+
   '<h4>Relatório · prevenção</h4><select data-in="prev"><option value="">— escolha —</option>'+preventions.map(x=>'<option '+(w.prev===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></div></div>'+
   '<div class="cd-actions">'+btn('closeticket','Fechar chamado','',!(w.cause&&w.actions.length&&w.verified))+btn('auto:'+c.id,'⚙ Atender no automático')+btn('cancel:'+c.id,'Desistir','class="cd-ghost"')+'</div><p class="cd-muted">Cada teste consome 3 minutos do SLA. Ações sem diagnóstico ou destrutivas derrubam a nota; escalar é o certo quando o problema é físico.</p>';
 }
 // ---------- Brand Studio ----------
 const NEUTRAL=['#ffffff','#f5f1e8','#111111'];
 function brandDraft(c,t){const w=work(c);if(!w.design){w.design={ratio:t.ratio,bg:'#ffffff',elements:[]};w.undo=[];w.redo=[];}return w;}
 function brand(){
  const list=pickActive('designer');
  const free=ui.freeDesign;
  if(!list.length&&!free)return '<h2>Brand Studio</h2><p class="cd-muted">Aceite um briefing em Contratos ou crie uma arte livre (para o seu canal ou a sua loja).</p>'+btn('go:contracts','Ver briefings')+btn('freedesign','Nova arte livre');
  let c,t,w;
  if(free){c={id:'free',seed:7,client:{name:'Projeto próprio',mono:'EU'},gross:0,dueClock:Infinity};t={title:'Arte livre',product:'Logo/avatar',ratio:ui.freeDesign.ratio,texts:[],shapes:[],colors:[]};w=ui.freeDesign.w;}
  else{c=list.find(x=>x.id===sel);t=tpl('designer',c.templateId);w=brandDraft(c,t);}
  const d=w.design,[W,H]=C.RATIOS[d.ratio],e=d.elements[w.sel??-1];
  const palette=[...(t.colors||[]),...NEUTRAL].filter((v,i,a)=>a.indexOf(v)===i);
  const sw=(key)=>palette.map(col=>'<button type="button" class="cd-swatch'+((e?e[key]:d.bg)===col?' on':'')+'" style="background:'+col+'" data-do="color:'+key+':'+col.slice(1)+'" aria-label="'+col+'"></button>').join('')+'<input type="color" data-in="colorpick:'+key+'" value="'+((e?e[key]:d.bg)||'#000000')+'" aria-label="Outra cor">';
  const check=w.checked?C.designCheck(d,t,{late:clock()>c.dueClock}):null;
  const props=e?'<div class="cd-props"><h4>'+(e.type==='text'?'Texto':'Forma · '+esc(e.shape))+'</h4>'+(e.type==='text'?'<input data-in="text" maxlength="40" value="'+esc(e.text)+'"><select data-in="font">'+Object.keys(C.FONTS).map(f=>'<option '+(e.font===f?'selected':'')+'>'+f+'</option>').join('')+'</select><label><input type="checkbox" data-in="bold" '+(e.weight==='bold'?'checked':'')+'> negrito</label>':'')+
   ['x:0:'+W,'y:0:'+H,'size:8:'+(e.type==='text'?240:Math.round(Math.max(W,H)*1.2)),'rot:-180:180'].map(s=>{const [k,a,b]=s.split(':');return '<label class="cd-slider">'+k+'<input type="range" data-in="num:'+k+'" min="'+a+'" max="'+b+'" value="'+Math.round(e[k])+'"></label>';}).join('')+
   '<div class="cd-sw">Cor '+sw('fill')+'</div>'+btn('layer:up','Trazer p/ frente','class="cd-mini"')+btn('layer:dup','Duplicar','class="cd-mini"')+btn('layer:del','Excluir','class="cd-mini"')+'</div>':'<div class="cd-props"><h4>Fundo</h4><div class="cd-sw">'+sw('bg')+'</div><p class="cd-muted">Escolha uma camada para editar.</p></div>';
  return '<h2>Brand Studio</h2>'+(free?'':activeList(list,'designer'))+'<div class="cd-brief"><span class="cd-mono">'+esc(c.client.mono)+'</span><div><b>'+esc(t.title)+' · '+esc(t.product)+'</b>'+
   (free?'<p>Arte para uso próprio (canal do CityLive ou loja). Não vale pagamento.</p>':'<p>Texto: '+t.texts.map(x=>'“'+esc(x)+'”').join(', ')+(t.shapes.length?' · forma: '+t.shapes.join(', '):'')+' · cores: '+t.colors.map(x=>'<i class="cd-dot" style="background:'+x+'"></i>').join('')+' · formato '+esc(t.ratio)+'</p><small>'+esc(c.client.name)+' · '+money(c.gross)+' · prazo '+esc(dayTime(c.dueClock))+(c.state==='REVISION_REQUIRED'?' · <b>revisão pedida</b>':'')+'</small>')+'</div></div>'+
   '<div class="cd-studio"><div class="cd-canvas" style="aspect-ratio:'+W+'/'+H+'">'+C.renderSVG(d,{title:t.title})+(w.guides!==false?'<i class="cd-guide v"></i><i class="cd-guide h"></i>':'')+'</div>'+
   '<div class="cd-tools"><div><select data-in="addshape"><option value="">+ Forma…</option>'+C.SHAPES.map(s=>'<option>'+s+'</option>').join('')+'</select>'+btn('addtext','+ Texto','class="cd-mini"')+btn('undo','↶','class="cd-mini"',!w.undo?.length)+btn('redo','↷','class="cd-mini"',!w.redo?.length)+btn('guides','Guias','class="cd-mini"')+'</div>'+
   '<ol class="cd-layers">'+d.elements.map((x,i)=>'<li class="'+(i===w.sel?'on':'')+'">'+btn('selel:'+i,(x.type==='text'?'T · '+esc(x.text||'texto'):'◆ '+esc(x.shape)),'class="cd-layer"')+'</li>').join('')+'<li class="'+(w.sel==null?'on':'')+'">'+btn('selel:-1','▭ Fundo','class="cd-layer"')+'</li></ol>'+props+'</div></div>'+
   (check?'<div class="cd-result"><b>Checklist do cliente · nota '+Math.round(check.score*100)+'</b><ul class="cd-tests">'+check.checks.map(x=>'<li class="'+(x.pass?'ok':'no')+'">'+(x.pass?'✓':'✗')+' '+esc(x.name)+'</li>').join('')+'</ul></div>':'')+
   '<div class="cd-actions">'+btn('checkdesign','Conferir requisitos')+(free?btn('savefree','Salvar no portfólio','',!d.elements.length)+btn('freeexit','Sair','class="cd-ghost"'):btn('submitdesign','Entregar ao cliente','',!w.checked)+btn('auto:'+c.id,'⚙ Criar no automático')+btn('cancel:'+c.id,'Desistir','class="cd-ghost"'))+'</div>';
 }
 // ---------- CityLive ----------
 function live(){
  const ch=S.channel,k=S.careers.streamer;
  if(!ch)return '<h2>CityLive Studio</h2><p class="cd-muted">Crie seu canal. O público, o chat e os patrocinadores são simulados por NPCs da cidade — nada de câmera, microfone ou transmissão real.</p>'+
   '<label class="cd-field">Nome do canal (3–24) <input data-in="chname" maxlength="24" value="'+esc(ui.chname||'')+'"></label><label class="cd-field">Categoria <select data-in="chcat">'+T.FORMATS.slice(0,4).map(f=>'<option value="'+f.id+'" '+(ui.chcat===f.id?'selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></label>'+btn('mkchannel','Criar canal');
  const st=ui.stream;
  const avatar=ch.avatar&&S.artifacts.find(a=>a.id===ch.avatar)?C.renderSVG(S.artifacts.find(a=>a.id===ch.avatar).design):'<span class="cd-mono">'+esc(ch.name.slice(0,2).toUpperCase())+'</span>';
  const head='<div class="cd-channel"><div class="cd-avatar">'+avatar+'</div><div><b>'+esc(ch.name)+'</b><small>'+ch.followers+' seguidores (NPC) · '+k.done+' transmissões · nível '+k.level+' · '+esc(C.levelName('streamer',k.level))+'</small></div>'+
   '<select data-in="chavatar"><option value="">Avatar: monograma</option>'+S.artifacts.filter(a=>a.kind==='design').map(a=>'<option value="'+a.id+'" '+(ch.avatar===a.id?'selected':'')+'>'+esc(a.title)+'</option>').join('')+'</select></div>';
  if(!st)return '<h2>CityLive Studio</h2>'+head+'<h4>Nova transmissão</h4><div class="cd-actions">'+btn('autolive','🎙️ Transmitir no automático')+'</div><p class="cd-muted">No automático o personagem joga e conversa com o chat sozinho; de vez em quando o chat pede uma decisão sua. Ou escolha o formato e conduza cada momento:</p><div class="cd-formats">'+T.FORMATS.map(f=>btn('golive:'+f.id,esc(f.name)+(f.minLevel>k.level?' · nível '+f.minLevel:''),'class="cd-chip"',f.minLevel>k.level)).join('')+'</div><p class="cd-muted">Cada sessão tem 5 momentos de decisão. O pagamento vem da retenção, da confiança e de patrocínios alinhados, com teto por nível e por dia.</p>';
  if(st.ended)return '<h2>CityLive Studio</h2>'+head+'<div class="cd-result"><b>Relatório da transmissão</b><p>Bruto '+money(st.report.gross)+' = base '+st.report.parts.base+' + retenção '+st.report.parts.retention+' + confiança '+st.report.parts.trust+' + patrocínio '+st.report.parts.sponsor+' − desgaste '+st.report.parts.cost+(st.report.interrupted?' · <b>interrompida: paga 30%</b>':'')+'</p><p>Novos seguidores: '+st.report.followers+' · nota '+Math.round(st.report.score*100)+'</p></div>'+btn('endlive','Concluir');
  const sit=T.STREAM[st.order[st.s.round]];
  const chat=st.chat.slice(-6).map(m=>'<div><b>'+esc(m.n)+'</b> '+esc(m.t)+'</div>').join('');
  return '<h2>CityLive Studio</h2>'+head+'<div class="cd-live"><div class="cd-stage"><span class="cd-onair">● AO VIVO (simulado)</span><b>'+esc(T.FORMATS.find(f=>f.id===st.s.format).name)+'</b><small>'+st.s.audience+' espectadores NPC · momento '+(st.s.round+1)+'/5</small>'+
   ['retention:Retenção','trust:Confiança','hype:Empolgação','fatigue:Desgaste'].map(x=>{const [k2,l]=x.split(':');return '<div class="cd-metric">'+l+bar(st.s[k2])+'</div>';}).join('')+'</div>'+
   '<div class="cd-chat"><small>Público simulado (NPC)</small>'+chat+'</div></div><div class="cd-situation"><b>'+esc(sit.text)+'</b>'+sit.options.map((o,i)=>btn('choose:'+i,esc(o.label),'class="cd-choice"')).join('')+'</div>'+btn('cutlive','Encerrar agora (paga parcial)','class="cd-ghost"');
 }
 // ---------- Portfólio e Finanças ----------
 function folio(){
  const arts=S.artifacts.slice().reverse();
  return '<h2>Portfólio</h2>'+(arts.length?'<div class="cd-folio">'+arts.map(a=>'<figure>'+(a.kind==='design'?C.renderSVG(a.design,{title:a.title}):'<div class="cd-doc">'+esc(a.summary||'')+'</div>')+'<figcaption><b>'+esc(a.title)+'</b><small>'+esc(a.client||'')+' · '+esc(dayTime(a.clock))+'</small></figcaption></figure>').join('')+'</div>':'<p class="cd-muted">Suas entregas aparecem aqui: artes, configurações de sistemas, relatórios técnicos e transmissões.</p>');
 }
 function finance(){
  const tx=S.ledger.slice().reverse().slice(0,40),sum=S.ledger.reduce((t,x)=>t+x.net,0);
  return '<h2>Finanças</h2><p class="cd-muted">Cada pagamento é único por contrato e entra na sua carteira (CityLife / NexoBank). Total líquido recebido: <b>'+money(Math.round(sum))+'</b>.</p>'+
   (tx.length?'<table class="cd-table"><tr><th>Quando</th><th>Serviço</th><th>Cliente</th><th>Bruto</th><th>Taxa</th><th>Líquido</th></tr>'+tx.map(x=>'<tr><td>'+esc(dayTime(x.clock))+'</td><td>'+esc(C.CONFIG.careers[x.career].app)+'</td><td>'+esc(x.client)+'</td><td>'+money(x.gross)+'</td><td>'+money(x.fee)+'</td><td><b>'+money(x.net)+'</b></td></tr>').join('')+'</table>':'<p class="cd-muted">Nenhum pagamento ainda.</p>')+
   (apps.get('seller')?.finance?.(api)||'');
 }

 // ---------- ações ----------
 function finish(c,score,{partial=1,artifact}={}){
  const ev=C.evaluate(S,c,score,clock(),{revisable:c.career!=='streamer'});
  if(ev.code==='REVISION'){msg(c.client.name+': “Quase lá — preciso de um ajuste antes de aprovar.” Revise e entregue de novo.',c.client.name);notify('O cliente pediu uma revisão.',false);save();render();return;}
  if(ev.code==='REJECTED'){msg(c.client.name+': “Não atende ao que pedimos.” Contrato recusado.',c.client.name);notify('Entrega recusada pelo cliente.',false);save();render();return;}
  const p=C.payout(S,c,clock(),(v,r)=>CityLife.credit(v,r),{partial});
  if(p.ok){
   window.CityCareer?.addXP?.('remote:'+c.career,Math.round(25+60*score));
   if(artifact)S.artifacts.push({...artifact,id:'art-'+c.id,contractId:c.id,clock:clock(),client:c.client.name});
   const st=CityLife.state;if(st?.needs)st.needs.energy=Math.max(.05,(st.needs.energy??1)-C.CONFIG.careers[c.career].energy);
   msg(c.client.name+': “Aprovado! Obrigado.” Pagamento de '+money(p.data.net)+' (líquido) enviado.',c.client.name);
   notify('✅ '+C.CONFIG.careers[c.career].app+': +'+money(p.data.net)+(p.data.capped?' (teto diário atingido: valor reduzido)':'')+(p.data.levelUp?' · subiu para o nível '+p.data.levelUp+'!':''));
   window.CityAudio?.ui?.('confirm');
  }else notify(p.text,false);
  sel=null;save();render();
 }
 function act(a,el){
  const [cmd,...rest]=a.split(':'),arg=rest.join(':');const c=S.contracts.find(x=>x.id===sel);
  if(cmd==='close')return close();
  if(cmd==='auto'){const x=S.contracts.find(y=>y.id===arg);if(x)startAuto(x);return;}
  if(cmd==='autolive'){app='live';startAuto(null);return;}
  if(cmd==='go'){app=arg;sel=null;return render();}
  if(cmd==='tab'){ui.tab=arg;return render();}
  if(cmd==='sel'){sel=arg;return render();}
  if(cmd==='accept'){const off=Object.values(S.offers).flat().find(o=>o.id===arg),CC=window.CityCareer;
   if(off&&CC){const sl=CC.activate('remote:'+(off.career||Object.keys(S.offers).find(k=>(S.offers[k]||[]).includes(off))),{quiet:true});if(!sl.ok){notify(sl.text,false);return render();}}
   const r=C.accept(S,arg,clock());notify(r.text,r.ok);if(r.ok){sel=r.data.id;app={programmer:'code',support:'help',designer:'brand'}[r.data.career];msg('Contrato aceito: '+(tpl(r.data.career,r.data.templateId)?.title)+'. Prazo '+dayTime(r.data.dueClock)+'.',r.data.client.name);}save();return render();}
  if(cmd==='work'){const x=S.contracts.find(y=>y.id===arg);if(x){sel=x.id;app={programmer:'code',support:'help',designer:'brand'}[x.career];}return render();}
  if(cmd==='cancel'){const x=S.contracts.find(y=>y.id===arg);if(x){const r=C.cancel(S,x,clock());notify(r.text,r.ok);}sel=null;save();return render();}
  // CodeLab
  if(c&&c.career==='programmer'){
   const t=tpl('programmer',c.templateId),w=work(c);if(c.state==='ACCEPTED')C.transition(c,'IN_PROGRESS',clock());
   if(cmd==='seqadd'){w.order=[...(w.order||[]),decodeURIComponent(arg)];w.ran=false;}
   else if(cmd==='sequp'){const i=+arg;if(i>0){const o=w.order;[o[i-1],o[i]]=[o[i],o[i-1]];}w.ran=false;}
   else if(cmd==='seqdel'){w.order.splice(+arg,1);w.ran=false;}
   else if(cmd==='addcond'){w.conds=[...(w.conds||['','','']),''];}
   else if(cmd==='runtests'){w.ran=true;if(t.mech==='debug'&&w.fix!=null)w.tried=[...new Set([...(w.tried||[]),w.fix])];}
   else if(cmd==='submitcode'){const tests=codeTests(c,t),steps=t.mech==='sequence'?(w.order||[]).length:t.mech==='rules'?ruleOf(w,t).when.length:0;
    const score=C.codeScore(tests,{steps,idealSteps:t.mech==='sequence'?t.steps.length:t.ideal||0,late:clock()>c.dueClock,ranTests:w.ran});
    return finish(c,score,{artifact:{kind:'code',title:t.title,summary:'Configuração validada: '+tests.filter(x=>x.pass).length+'/'+tests.length+' testes · '+t.mech}});}
   save();return render();
  }
  if(c&&c.career==='support'){
   const t=tpl('support',c.templateId),w=work(c);if(c.state==='ACCEPTED')C.transition(c,'IN_PROGRESS',clock());
   if(cmd==='tool'){runTool(t,w,arg);if(w.actions.length&&arg===t.verify)w.verified=true;}
   else if(cmd==='act'){if(!w.actions.includes(arg))w.actions.push(arg);w.minutes+=4;w.verified=false;}
   else if(cmd==='verify'){runTool(t,w,t.verify);w.verified=true;}
   else if(cmd==='closeticket'){const r=C.supportScore(t,{cause:w.cause,tools:w.tools,actions:w.actions,verified:w.verified,report:{prevention:w.prev},minutes:w.minutes});
    return finish(c,r.score,{partial:t.action==='escalate'&&w.actions.includes('escalate')?.7:1,artifact:{kind:'report',title:t.id+' · '+t.title,summary:'Causa: '+(w.cause||'—')+' · Ação: '+w.actions.map(x=>T.ACTIONS[x]).join(', ')+' · Prevenção: '+(w.prev||'—')}});}
   save();return render();
  }
  // Brand Studio (contrato ou arte livre)
  if(app==='brand'){
   if(cmd==='freedesign'){ui.freeDesign={ratio:'square',w:{design:{ratio:'square',bg:'#ffffff',elements:[]},undo:[],redo:[]}};return render();}
   if(cmd==='freeexit'){ui.freeDesign=null;return render();}
   const free=ui.freeDesign,t=free?{title:'Arte livre',colors:[]}:tpl('designer',c?.templateId),w=free?free.w:c&&brandDraft(c,t);if(!w)return;
   if(!free&&c.state==='ACCEPTED')C.transition(c,'IN_PROGRESS',clock());
   const d=w.design,[W,H]=C.RATIOS[d.ratio],snap=()=>{w.undo.push(JSON.stringify(d));if(w.undo.length>40)w.undo.shift();w.redo=[];w.checked=false;};
   if(cmd==='addtext'){snap();d.elements.push({id:'t'+d.elements.length,type:'text',text:(t.texts?.[0]||'Texto'),size:Math.round(Math.min(W,H)*.12),font:'sans',fill:t.colors?.[0]||'#111111',x:W/2,y:H/2,rot:0});w.sel=d.elements.length-1;}
   else if(cmd==='selel'){w.sel=+arg<0?null:+arg;}
   else if(cmd==='undo'&&w.undo.length){w.redo.push(JSON.stringify(d));w.design=JSON.parse(w.undo.pop());w.sel=null;}
   else if(cmd==='redo'&&w.redo.length){w.undo.push(JSON.stringify(d));w.design=JSON.parse(w.redo.pop());w.sel=null;}
   else if(cmd==='guides'){w.guides=w.guides===false;}
   else if(cmd==='color'){const [key,hex]=arg.split(':');snap();if(key==='bg'||w.sel==null)d.bg='#'+hex;else d.elements[w.sel][key]='#'+hex;}
   else if(cmd==='layer'&&w.sel!=null){snap();const i=w.sel;if(arg==='del'){d.elements.splice(i,1);w.sel=null;}else if(arg==='dup'){d.elements.push({...d.elements[i],id:'c'+Date.now()%1e5,x:d.elements[i].x+20,y:d.elements[i].y+20});w.sel=d.elements.length-1;}else if(arg==='up'&&i<d.elements.length-1){[d.elements[i],d.elements[i+1]]=[d.elements[i+1],d.elements[i]];w.sel=i+1;}}
   else if(cmd==='checkdesign'){w.checked=true;}
   else if(cmd==='submitdesign'&&c){const r=C.designCheck(d,t,{late:clock()>c.dueClock});return finish(c,r.score,{artifact:{kind:'design',title:t.title,design:C.sanitizeDesign(d)}});}
   else if(cmd==='savefree'){S.artifacts.push({id:'art-free-'+(++S.seq),kind:'design',title:'Arte própria '+S.seq,design:C.sanitizeDesign(d),client:'Projeto próprio',clock:clock()});ui.freeDesign=null;notify('Arte salva no portfólio. Use-a como avatar do canal ou marca da loja.');}
   save();return render();
  }
  // CityLive
  if(app==='live'){
   if(cmd==='mkchannel'){const name=String(ui.chname||'').replace(/[<>&"'`]/g,'').trim();if(name.length<3)return notify('O nome do canal precisa de 3 a 24 caracteres.',false);
    S.channel={name,category:ui.chcat||'chat',followers:0,avatar:null};msg('Canal “'+name+'” criado no CityLive.');save();return render();}
   if(cmd==='golive'){const k=S.careers.streamer,f=T.FORMATS.find(x=>x.id===arg);if(!f||f.minLevel>k.level)return;
    const sl=window.CityCareer?.activate?.('remote:streamer',{quiet:true});if(sl&&!sl.ok){notify(sl.text,false);return render();}
    const seed=C.hash('live',C.day(clock()),k.done,S.seq++),s=C.streamStart(S.channel,f.id,k.level);for(const [m,v] of Object.entries(f.base))s[m]=C.clamp(s[m]+v,0,100);
    ui.stream={s,order:shuffle(T.STREAM.map((_,i)=>i),seed).slice(0,5),chat:[{n:'CityLive',t:'Transmissão iniciada. Público simulado (NPC).'}],seed};save();return render();}
   const st=ui.stream;
   if(cmd==='choose'&&st&&!st.ended){const sit=T.STREAM[st.order[st.s.round]],o=sit.options[+arg];if(o.fx.wrap)st.s.round=4;C.streamApply(st.s,o.fx,sit.id);
    const names=['Lia','Tico','Mano','Bia','Duda','Rafa','Nina','Caio'],r=R(st.seed+st.s.round);
    st.chat.push({n:names[(r()*names.length)|0]+' (NPC)',t:o.fx.trust>4?'Curti a sinceridade 👏':o.fx.trust<-4?'Hmm, sei não…':o.fx.hype>4?'KKKKK que isso 🔥':'Seguimos!'});
    if(st.s.round>=5)endStream(false);return render();}
   if(cmd==='cutlive'&&st&&!st.ended){endStream(true);return render();}
   if(cmd==='endlive'){ui.stream=null;return render();}
  }
  const ext=apps.get(app);if(ext?.action){ext.action(api,a,el);save();render();}
 }
 function endStream(interrupted){
  const st=ui.stream,k=S.careers.streamer,rep=C.streamReport(st.s,k.level,{interrupted});st.ended=true;st.report=rep;
  const id='live-'+C.day(clock())+'-'+(k.done+k.failed+S.seq);
  const c={id,career:'streamer',templateId:st.s.format,client:{name:'CityLive · '+S.channel.name,mono:'CL'},gross:rep.gross,state:'IN_PROGRESS',dueClock:clock()+60,revisions:0,attempts:0,history:[]};
  S.contracts.push(c);S.channel.followers+=rep.followers;
  finish(c,interrupted?Math.min(.6,Math.max(.6,rep.score)):Math.max(.6,rep.score),{artifact:{kind:'stream',title:'Transmissão · '+T.FORMATS.find(f=>f.id===st.s.format).name,summary:'Audiência '+st.s.audience+' · retenção '+Math.round(st.s.retention)+' · confiança '+Math.round(st.s.trust)+(interrupted?' · interrompida':'')}});
  // nota da sessão (patrocínio desalinhado e falta de confiança pesam na reputação)
  k.reputation=C.clamp(k.reputation+(rep.score-.55)*10,0,100);save();
 }
 function onClick(e){
  const n=e.target.closest('[data-app]');if(n){app=n.dataset.app;sel=null;ui.freeDesign=ui.freeDesign&&app==='brand'?ui.freeDesign:null;render();return;}
  const b=e.target.closest('[data-do]');if(b&&!b.disabled){window.CityAudio?.ui?.('click');act(b.dataset.do,b);}
 }
 function onInput(e){
  const k=e.target.dataset.in;if(!k)return;const v=e.target.type==='checkbox'?e.target.checked:e.target.value;
  const c=S.contracts.find(x=>x.id===sel);
  if(app==='live'){if(k==='chname')ui.chname=v;else if(k==='chcat')ui.chcat=v;else if(k==='chavatar'&&S.channel){S.channel.avatar=v||null;save();render();}return;}
  if(app==='code'&&c){const w=work(c),t=tpl('programmer',c.templateId);w.ran=false;
   if(k.startsWith('cond:')){w.conds=w.conds||['','',''];w.conds[+k.slice(5)]=v;}else if(k==='combine')w.combine=v;else if(k==='then')w.then=v;else if(k==='else')w.else=v;
   else if(k==='fix')w.fix=+v;else if(k.startsWith('comp:')){const id=k.slice(5);w.components=(w.components||[]).filter(x=>x!==id);if(v)w.components.push(id);if(e.type==='change')render();}
   else if(k.startsWith('bind:')){w.bind=w.bind||{};w.bind[k.slice(5)]=v;}
   void t;save();if(e.type==='change'&&!k.startsWith('comp:'))render();return;}
  if(app==='help'&&c){const w=work(c);if(k==='cause')w.cause=v;else if(k==='prev')w.prev=v;save();return;}
  if(app==='brand'){
   const free=ui.freeDesign,t=free?{}:tpl('designer',c?.templateId),w=free?free.w:c&&brandDraft(c,t);if(!w)return;
   const d=w.design,el=d.elements[w.sel??-1],[W,H]=C.RATIOS[d.ratio];
   const snapOnce=()=>{if(e.type==='change'||k==='addshape'){w.undo.push(JSON.stringify(d));if(w.undo.length>40)w.undo.shift();w.redo=[];}w.checked=false;};
   if(k==='addshape'&&v){snapOnce();d.elements.push({id:'s'+d.elements.length,type:'shape',shape:v,size:Math.round(Math.min(W,H)*.4),fill:(t.colors||[])[0]||'#d8973a',x:W/2,y:H/2,rot:0});w.sel=d.elements.length-1;save();return render();}
   if(k.startsWith('colorpick:')){snapOnce();if(w.sel==null)d.bg=v;else el.fill=v;save();return render();}
   if(!el)return;
   if(k==='text')el.text=String(v).slice(0,40);else if(k==='font')el.font=v;else if(k==='bold')el.weight=v?'bold':'normal';
   else if(k.startsWith('num:')){const p=k.slice(4);let n=+v;
    // guias: encaixa no centro e nos terços quando chega perto
    if(p==='x')for(const g of [W/2,W/3,2*W/3])if(Math.abs(n-g)<W*.02)n=g;if(p==='y')for(const g of [H/2,H/3,2*H/3])if(Math.abs(n-g)<H*.02)n=g;el[p]=n;}
   if(e.type==='change')snapOnce();
   const cv=root.querySelector('.cd-canvas');if(cv)cv.innerHTML=C.renderSVG(d)+(w.guides!==false?'<i class="cd-guide v"></i><i class="cd-guide h"></i>':'');
   save();if(e.type==='change'&&['font','bold','text'].includes(k))render();return;
  }
  const ext=apps.get(app);ext?.input?.(api,k,v,e);
 }
 function afterRender(){}

 // ---------- trabalho no automático: o personagem senta, trabalha animado e, de vez em quando, um minigame ----------
 const DUR={programmer:150,support:90,designer:120,streamer:120};   // minutos de jogo (acelerado 10×)
 const KINDS={programmer:'desk_code',support:'desk_help',designer:'desk_design',streamer:'desk_stream'};
 const GAMES={programmer:['quiz','keys','quiz'],support:['quiz','meter','quiz'],designer:['quiz','meter','quiz'],streamer:['chat','meter','chat']};
 const WORDS=['commit','deploy','teste','array','loop','fetch','merge','debug','cache','query'];
 const NPCN=['Lia','Tico','Bia','Duda','Rafa','Nina','Caio','Mano'],NPCM=['kkkk','boa!!','🔥🔥','que jogada','salve!','primeira vez aqui','GG','👏'];
 let W=null,wui=null,wkey='',wLast=0;
 // props-3d.mjs uses faceW for procedurally oriented desks and -rot otherwise.
 // The built-in chair is +Z of that model (0.60 m from the desk center).
 const deskFront=d=>window.CityHomeNav?.facing?.(d)||{x:-Math.sin(d.rot||0),y:Math.cos(d.rot||0)};
 const deskScale=d=>({sx:(d.faceW?(d.along||d.w):d.w||1.1)/1.1,
   sz:(d.faceW?(d.depth||d.d):d.d||.62)/.62,
   sy:Math.min(1.5,Math.max(.6,(d.h||.74)/.74))});
 const deskLocal=(d,lx,lz)=>{
   const k=deskScale(d),f=deskFront(d),side={x:f.y,y:-f.x};
   return {x:d.x+side.x*lx*k.sx+f.x*lz*k.sz,
     y:d.y+side.y*lx*k.sx+f.y*lz*k.sz};
 };
 function seatAt(st){
   const p=player(),d=st.desk,f=deskFront(d);
   // The built-in chair is +Z, at 0.60 m in the exact procedural mesh.
   // Never put a player in the wall-side of a desk or another apartment.
   const seat=deskLocal(d,0,d.kind==='desk'?.60:.72);
   const nav=window.CityHomeNav;
   if(!nav?.safeSpot?.(st.H,d,seat.x,seat.y,d.id))return null;
   if(!p||!nav.safeSpot(st.H,d,p.x,p.y,d.id))return null;
   // A short walkable indoor route excludes teleporting through a partition.
   const path=nav.route(st.H,{x:p.x,y:p.y},seat,st.floor,d.id);
   if(!path||path.distance>7.5)return null;
   const leave=nav.exitSpot(st.H,d,{x:p.x,y:p.y});
   if(!leave)return null;
   return {seat,face:Math.atan2(-f.y,-f.x),leave};
 }
 function sitDown(kind,st,extra={}){
   const p=player();if(!p||!st)return null;
   const s=seatAt(st);
   if(!s){notify('A cadeira da escrivaninha está encostada na parede ou bloqueada. Vire a mesa com R no F7.',false);return null;}
   // Persist the safe approach point in transient pose data. A seated actor
   // must never walk out of a wall when the UI closes.
   const standOrigin={x:s.leave.x,y:s.leave.y,floor:p.floor||0};
   p.x=s.seat.x;p.y=s.seat.y;p.face=s.face;p.speed=0;
   if(p.armed&&window.CityLife)CityLife.equip?.('unarmed',false);
   p.homeAction={kind,t:0,duration:1e9,deskWork:true,standOrigin,deskId:st.desk.id,
     deskHouse:st.H,...extra};
   return s;
 }
 function standUp(){
   const p=player(),action=p?.homeAction;
   if(!action?.deskWork)return;
   const H=action.deskHouse,desk=H&&CityHome.find(H,action.deskId);
   const origin=action.standOrigin;
   const safe=desk&&window.CityHomeNav?.exitSpot?.(H,desk,origin);
   if(safe){p.x=safe.x;p.y=safe.y;}
   else if(desk&&window.CityHomeNav?.safeSpot?.(H,desk,p.x,p.y,desk.id)){
     // If furniture moved while working, remain at the safe seat rather than
     // making up a point outside the house or past an apartment boundary.
   }
   if(origin){p.floor=origin.floor;p.floorZ=H?.architecture?.levels?.[origin.floor]?.z||0;}
   p.homeAction=null;p.speed=0;
 }
 function startAuto(c,format){
  const st=stationNow||stationAt(player());if(!st?.screen)return notify('Sente na mesa com monitor para trabalhar.',false);
  if(window.CityTimeScale>1&&!W)return notify('Termine a atividade acelerada antes.',false);
  const career=c?.career||'streamer';
  if(career==='streamer'){if(!S.channel)return notify('Crie seu canal no CityLive primeiro.',false);act('golive:'+(format||T.FORMATS.find(f=>f.minLevel<=S.careers.streamer.level).id));}
  else if(c.state==='ACCEPTED')C.transition(c,'IN_PROGRESS',clock());
  close();
  const s=sitDown(KINDS[career],st);
  if(!s)return;
  const w=c?work(c):{},done=c?(w.autoMin||0):0;
  W={id:c?.id||null,career,st,seat:s.seat,face:s.face,dur:DUR[career],minutes:done,last:clock(),games:GAMES[career].slice(),at:[.25,.55,.85].filter(f=>f>done/DUR[career]),asked:w.autoAsked||0,correct:w.autoCorrect||0,game:null,fast:true,seed:(c?.seed||C.hash('live',clock()))+1,chat:[],talkT:0};
  W.games=W.games.slice(3-W.at.length);
  window.CityTimeScale=10;showWork();notify('Trabalhando no automático · ande (WASD) para parar a qualquer momento.');
 }
 function stopAuto(reason,keep=true){
  if(!W)return;const w=W;W=null;window.CityTimeScale=1;standUp();hideWork();
  const c=S.contracts.find(x=>x.id===w.id);
  if(c&&keep){const k=work(c);k.autoMin=w.minutes;k.autoAsked=w.asked;k.autoCorrect=w.correct;save();}
  if(w.career==='streamer'&&ui.stream&&!ui.stream.ended){endStream(true);ui.stream=null;}
  if(reason)notify(reason);
 }
 function finishAuto(){
  const w=W;W=null;window.CityTimeScale=1;standUp();hideWork();
  const acc=w.asked?w.correct/w.asked:.5,score=Math.min(.95,.5+.45*acc);
  if(w.career==='streamer'){const st=ui.stream;if(st&&!st.ended){while(st.s.round<5){const sit=T.STREAM[st.order[st.s.round]],o=sit.options.slice().sort((a,b)=>(b.fx.trust+b.fx.retention)-(a.fx.trust+a.fx.retention))[acc>=.5?0:1];C.streamApply(st.s,o.fx,sit.id);}endStream(false);}ui.stream=null;return;}
  const c=S.contracts.find(x=>x.id===w.id);if(!c||!['IN_PROGRESS','REVISION_REQUIRED','ACCEPTED'].includes(c.state))return;
  const t=tpl(c.career,c.templateId);
  if(c.career==='designer'){const d=C.autoDesign(t),r=C.designCheck(d,t,{late:clock()>c.dueClock});return finish(c,Math.min(score,r.score),{artifact:{kind:'design',title:t.title,design:d}});}
  if(c.career==='support')return finish(c,score,{partial:t.action==='escalate'?.7:1,artifact:{kind:'report',title:t.id+' · '+t.title,summary:'Atendimento remoto · causa: '+t.cause+' · ação: '+T.ACTIONS[t.action]+' · prevenção: '+t.prevention}});
  return finish(c,score,{artifact:{kind:'code',title:t.title,summary:'Entrega no automático · '+w.correct+'/'+w.asked+' decisões certas'}});
 }
 function askGame(){
  const w=W,type=w.games.shift()||'quiz',c=S.contracts.find(x=>x.id===w.id),t=c&&tpl(c.career,c.templateId);window.CityTimeScale=1;
  if(type==='quiz'&&t){const q=C.autoQuiz(w.career,t,w.seed,w.asked,{actions:T.ACTIONS,tools:T.TOOLS});w.game={type,...q,time:20};}
  else if(type==='keys'){const word=WORDS[(w.seed+w.asked)%WORDS.length];w.game={type,q:'Digite rápido o comando:',word,typed:0,time:8};}
  else if(type==='chat'&&ui.stream){const st=ui.stream,sit=T.STREAM[st.order[st.s.round]];w.game={type,q:'Chat: '+sit.text,options:sit.options.map(o=>o.label),sit,time:15};}
  else{const z=.2+((w.seed>>3)%50)/100;w.game={type:'meter',q:{support:'Teste o cabo: pare a agulha na zona verde (Espaço)',designer:'Alinhe ao centro: pare a agulha na zona verde (Espaço)',streamer:'Jogada ao vivo: acerte o tempo (Espaço)'}[w.career]||'Pare na zona verde (Espaço)',zone:[z,z+.22],x:0,v:.9,time:9};}
  window.CityAudio?.ui?.('confirm');renderWork(true);
 }
 function answer(i){
  const w=W,g=w?.game;if(!g)return;let ok=false;
  if(g.type==='quiz')ok=i===g.answer;
  else if(g.type==='keys')ok=i===1;
  else if(g.type==='meter')ok=i===0&&g.x>=g.zone[0]&&g.x<=g.zone[1];
  else if(g.type==='chat'){const o=g.sit.options[i>=0?i:2]||g.sit.options[0];C.streamApply(ui.stream.s,o.fx,g.sit.id);ok=i>=0&&o.fx.trust+o.fx.retention>0;w.chat.push(ok?'Chat (NPC): mandou bem 👏':'Chat (NPC): hmm…');}
  w.asked++;if(ok)w.correct++;
  const right=g.type==='quiz'&&!ok?' Era: '+g.options[g.answer]:'';
  w.feedback={ok,text:ok?'✓ Mandou bem!':'✗ Não foi dessa vez.'+right,t:3};
  w.game=null;window.CityTimeScale=w.fast?10:1;window.CityAudio?.ui?.(ok?'confirm':'back');
  const p=player();if(w.career==='streamer'&&p?.homeAction){p.homeAction.talk=true;w.talkT=4;}
  renderWork(true);
 }
 function tickWork(){
  const w=W;if(!w)return;const p=player(),now=clock(),real=performance.now(),dt=Math.min(.1,(real-(wLast||real))/1000);wLast=real;
  const inp=window.__game?.input;
  if(!w.game&&inp&&['w','a','s','d'].some(k=>inp.down(k)))return stopAuto('Você parou de trabalhar; o progresso fica salvo no contrato.');
  if(!p||p.dead||!p.homeAction?.deskWork)return stopAuto('Trabalho interrompido.');
  const c=w.id&&S.contracts.find(x=>x.id===w.id);if(w.id&&(!c||!['IN_PROGRESS','REVISION_REQUIRED','ACCEPTED'].includes(c.state)))return stopAuto('O contrato não está mais em andamento.',false);
  p.x=w.seat.x;p.y=w.seat.y;p.face=w.face;p.speed=0;
  if(!w.game){const step=Math.max(0,now-w.last);w.minutes=Math.min(w.dur,w.minutes+step);
   const need=CityLife.state?.needs;if(need)need.energy=Math.max(.04,(need.energy??1)-step*.00012);}
  w.last=now;
  if(w.career==='streamer'){
   if(w.talkT>0){w.talkT-=dt;if(w.talkT<=0&&p.homeAction)p.homeAction.talk=false;}else if(Math.random()<dt*.15&&p.homeAction){p.homeAction.talk=true;w.talkT=2+Math.random()*2;}
   if(Math.random()<dt*.6){w.chat.push(NPCN[(Math.random()*NPCN.length)|0]+': '+NPCM[(Math.random()*NPCM.length)|0]);if(w.chat.length>14)w.chat.shift();}
  }
  const frac=w.minutes/w.dur;
  if(!w.game&&w.at.length&&frac>=w.at[0]){w.at.shift();askGame();}
  const g=w.game;if(g){g.time-=dt;if(g.type==='meter'){g.x+=g.v*dt;if(g.x>1||g.x<0){g.v*=-1;g.x=C.clamp(g.x,0,1);}}if(g.time<=0)answer(-1);}
  if(w.feedback){w.feedback.t-=dt;if(w.feedback.t<=0)w.feedback=null;}
  if(!w.game&&frac>=1)return finishAuto();
  renderWork();
 }
 function showWork(){
  if(!wui){wui=document.createElement('section');wui.id='cd-work';wui.className='cd-workpanel';document.body.appendChild(wui);
   wui.addEventListener('click',e=>{const b=e.target.closest('[data-w]');if(!b||!W)return;const a=b.dataset.w;
    if(a==='fast'){W.fast=!W.fast;if(!W.game)window.CityTimeScale=W.fast?10:1;renderWork(true);}
    else if(a==='stop')stopAuto('Você parou de trabalhar; o progresso fica salvo no contrato.');
    else if(a==='manual'){const app0={programmer:'code',support:'help',designer:'brand'}[W.career],id=W.id;stopAuto('');sel=id;open(app0);}
    else if(a==='meter')answer(0);else if(a.startsWith('ans:'))answer(+a.slice(4));});
   window.addEventListener('keydown',e=>{const g=W?.game;if(!g)return;
    if(g.type==='keys'&&e.key.length===1){e.preventDefault();e.stopImmediatePropagation();if(e.key.toLowerCase()===g.word[g.typed]){g.typed++;if(g.typed>=g.word.length)answer(1);else renderWork(true);}else window.CityAudio?.ui?.('back');}
    else if(g.type==='meter'&&(e.code==='Space'||e.key===' ')){e.preventDefault();e.stopImmediatePropagation();answer(0);}
    else if(['w','a','s','d'].includes(e.key.toLowerCase()))e.stopImmediatePropagation();},true);}
  wui.hidden=false;renderWork(true);
 }
 function hideWork(){if(wui)wui.hidden=true;}
 function renderWork(force=false){
  const w=W;if(!w||!wui)return;const c=S.contracts.find(x=>x.id===w.id),t=c&&tpl(c.career,c.templateId),g=w.game,frac=Math.min(1,w.minutes/w.dur);
  const key=(g?g.type+g.q+(g.typed||0):'-')+'|'+w.fast+'|'+w.asked+'|'+!!w.feedback;
  if(force||key!==wkey){wkey=key;
   let game='';
   if(g){
    if(g.type==='quiz'||g.type==='chat')game='<div class="cdw-q"><b>'+(g.swatch?'<i class="cd-dot" style="background:'+g.swatch+'"></i> ':'')+esc(g.q)+' <small class="cdw-t"></small></b><div class="cdw-opts">'+g.options.map((o,i)=>'<button type="button" data-w="ans:'+i+'">'+(/^#[0-9a-f]{6}$/i.test(o)?'<i class="cd-dot" style="background:'+o+'"></i> ':'')+esc(o)+'</button>').join('')+'</div></div>';
    else if(g.type==='keys')game='<div class="cdw-q"><b>'+esc(g.q)+' <small class="cdw-t"></small></b><div class="cdw-keys">'+[...g.word].map((ch,i)=>'<span class="'+(i<g.typed?'ok':i===g.typed?'cur':'')+'">'+esc(ch)+'</span>').join('')+'</div></div>';
    else if(g.type==='meter')game='<div class="cdw-q"><b>'+esc(g.q)+' <small class="cdw-t"></small></b><div class="cdw-meter"><i class="cdw-zone" style="left:'+g.zone[0]*100+'%;width:'+(g.zone[1]-g.zone[0])*100+'%"></i><i class="cdw-needle"></i></div><button type="button" data-w="meter">Parar agora</button></div>';
   }
   const title=t?.title||(ui.stream?'Transmissão ao vivo · '+(T.FORMATS.find(f=>f.id===ui.stream.s.format)?.name||''):'Trabalho');
   wui.innerHTML='<small>'+C.CONFIG.careers[w.career].icon+' '+esc(C.CONFIG.careers[w.career].app)+' · no automático · <span class="cdw-clock"></span></small><h3>'+esc(title)+'</h3>'+
    '<div class="cd-bar"><i class="cdw-bar"></i></div><small class="cdw-prog"></small>'+(w.feedback?'<div class="cdw-fb '+(w.feedback.ok?'ok':'no')+'">'+esc(w.feedback.text)+'</div>':'')+game+
    '<div class="cdw-row"><button type="button" data-w="fast">'+(w.fast?'▶ Tempo real':'⏩ Acelerar')+'</button>'+(w.career!=='streamer'?'<button type="button" data-w="manual">Fazer manualmente</button>':'')+'<button type="button" data-w="stop">Parar</button></div>';
  }
  wui.querySelector('.cdw-clock').textContent=dayTime(clock());
  wui.querySelector('.cdw-bar').style.width=Math.round(frac*100)+'%';
  wui.querySelector('.cdw-prog').textContent=Math.round(w.minutes)+' de '+w.dur+' min · decisões certas '+w.correct+'/'+w.asked+(c?' · '+money(c.gross):'');
  const tt=wui.querySelector('.cdw-t');if(tt&&g)tt.textContent=Math.ceil(g.time)+'s';
  const nd=wui.querySelector('.cdw-needle');if(nd&&g)nd.style.left=(g.x*100)+'%';
 }
 // o que o monitor mostra (work-3d.mjs): o trabalho automático, ou o app aberto quando o jogador usa o computador
 function screenInfo(){
  const st=W?.st||(openFlag?stationNow:null);if(!st?.screen)return null;
  const career=W?.career||{code:'programmer',help:'support',brand:'designer',live:'streamer'}[app]||'programmer';
  const c=S.contracts.find(x=>x.id===(W?W.id:sel)),t=c&&tpl(c.career,c.templateId);
  let screen={x:st.screen.x,y:st.screen.y,z:st.screen.z||0,floor:st.floor||0};
  if(st.screen.builtin){const d=st.desk,f=deskFront(d),k=deskScale(d),c=deskLocal(d,-.1,-.04);screen={x:c.x,y:c.y,z:(d.z||0)+.875*k.sy-.37,floor:st.floor||0,w:.36*k.sx,h:.21*k.sy,nx:f.x,ny:f.y};}
  const info={auto:!!W,kind:{programmer:'code',support:'help',designer:'design',streamer:'stream'}[career],screen,progress:W?W.minutes/W.dur:0,title:t?.title||''};
  if(career==='support'&&t)info.lines=Object.entries(t.out).flatMap(([k,v])=>['> '+T.TOOLS[k],v]);
  if(career==='designer'&&t){info.colors=t.colors;info.text=t.texts?.[0];}
  if(career==='streamer'){info.chat=W?.chat||ui.stream?.chat?.map(m=>m.n+': '+m.t)||[];info.viewers=ui.stream?.s?.audience||0;}
  return info;
 }

 // ---------- tempo: prazos pelo relógio do jogo (título/pausa não contam) ----------
 function tick(){
  if(window.CityFront?.blocked)return;tickWork();const now=clock();if(now-lastTick<5)return;lastTick=now;
  const ex=C.expire(S,now);for(const c of ex){msg('Prazo perdido: '+(tpl(c.career,c.templateId)?.title||'contrato')+'. A reputação caiu.',c.client?.name||'CityDesk');notify('⏰ Prazo de um contrato do CityDesk venceu.',false);}
  if(ex.length){save();if(openFlag)render();}
  for(const a of apps.values())a.tick?.(api,now);
 }

 // ---------- celular (app Home Office) e CityWeb ----------
 function renderPhone({card:pc,banner,btn:pb}){
  refreshOffersAll();
  const active=S.contracts.filter(c=>['ACCEPTED','IN_PROGRESS','REVISION_REQUIRED'].includes(c.state));
  let h=banner('<strong>Home Office</strong><small>Propostas e prazos. O trabalho em si é feito no computador de casa (mesa + monitor).</small>');
  h+=['programmer','support','designer','streamer'].map(k=>{const c=S.careers[k];return pc(C.CONFIG.careers[k].name,'Nível '+c.level+' · '+C.levelName(k,c.level)+' · reputação '+Math.round(c.reputation)+' · '+c.done+' entregas','',C.CONFIG.careers[k].icon);}).join('');
  if(active.length)h+='<div class="city-phone-label">Em andamento</div>'+active.map(c=>pc(tpl(c.career,c.templateId)?.title||'Trabalho',c.client.name+' · prazo '+dayTime(c.dueClock),'',C.CONFIG.careers[c.career].icon)).join('');
  h+='<div class="city-phone-label">Propostas de hoje</div>';
  for(const k of ['programmer','support','designer'])for(const o of (S.offers[k]||[]).slice(0,2)){const t=tpl(k,o.templateId);h+=pc(t.title,o.client.name+' · '+money(o.gross)+' · prazo '+o.dueDays+' dia(s)',pb('desk:accept:'+o.id,'Aceitar',C.activeCount(S,k)>=C.CONFIG.activeMax[S.careers[k].level]),C.CONFIG.careers[k].icon);}
  return h;
 }
 function phoneAction(cmd,arg){if(cmd==='accept'){const r=C.accept(S,arg,clock());if(r.ok)msg('Contrato aceito pelo celular: '+(tpl(r.data.career,r.data.templateId)?.title)+'. Vá ao computador para trabalhar.',r.data.client.name);save();return r;}return {ok:false,text:'Ação indisponível'};}
 // CityWeb: as empresas mostram as marcas aprovadas que o jogador criou
 function renderWeb({card:pc}){
  const arts=S.artifacts.filter(a=>a.kind==='design'&&a.contractId);if(!arts.length)return '';
  return '<div class="city-phone-label">Empresas da cidade · marcas feitas por você</div>'+arts.slice(-6).reverse().map(a=>'<article class="city-panel cd-webcard"><div class="cd-webart">'+C.renderSVG(a.design,{title:a.title})+'</div><div><h3>'+esc(a.client)+'</h3><p>'+esc(a.title)+' · em uso no site da empresa</p></div></article>').join('');
 }

 const api={get state(){return S;},get open(){return openFlag;},show:open,close,interact,prompt,tick,stationAt,register:(id,def)=>{apps.set(id,def);},render,save,
  renderPhone,phoneAction,renderWeb,screenInfo,startAuto,stopAuto,sitDown,standUp,get working(){return !!W;},esc,money,clock,notify,dayTime,card,btn,bar,get station(){return stationNow;},core:C};
 return api;
})();
window.CityDesk=CityDesk;
