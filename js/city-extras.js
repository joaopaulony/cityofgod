// CityOS — banco, social, selfies, encontros e calculadora.
// Serviços econômicos e sociais locais; sem fingir transações financeiras reais.
'use strict';
const CityExtras=(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const money=n=>CityLife.money(n);
 const btn=(action,label,disabled=false)=>'<button class="city-action" type="button" data-action="'+esc(action)+'" '+(disabled?'disabled':'')+'>'+label+'</button>';
 const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch(_){return d}};
 const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
 const BANK_KEY='cityofgod.nova-bank.v1';
 const STORIES_KEY='cityofgod.stories.v1', COMMENTS_KEY='cityofgod.comments.v1', DATING_KEY='cityofgod.matches.v1';
 let bank={balance:0,savings:0,lastYield:0,ledger:[]},stories=[],comments={},dating={index:0,matches:[]},loaded=false,calcExpression='',calcResult='',cameraMode='selfie';
 const bankName='NexoBank';
 const profiles=[
  {name:'Luna',age:27,bio:'Café, fotografia e passeios à beira-mar ☀️',emoji:'🧑🏽‍🎨'},
  {name:'Camila',age:29,bio:'Sou veterinária e apaixonada por animais 🐕',emoji:'👩🏻‍⚕️'},
  {name:'Rafa',age:30,bio:'Gosto de carros antigos e música ao vivo 🎸',emoji:'🧑🏾'},
  {name:'Bianca',age:26,bio:'Buscando alguém para explorar a cidade 📸',emoji:'👩🏽'},
  {name:'Alex',age:28,bio:'Designer, cozinheiro amador e divertido 👋',emoji:'🧑🏻‍🍳'}
 ];
 function boot(){
  if(loaded)return;loaded=true;
  const saved=get(BANK_KEY,{});
  if(saved && typeof saved==='object'){
   for(const k of ['balance','savings','lastYield'])if(Number.isFinite(saved[k]))bank[k]=Math.max(0,Math.min(100000000,saved[k]));
   if(Array.isArray(saved.ledger))bank.ledger=saved.ledger.filter(x=>x&&typeof x.note==='string').slice(0,50);
  }
  stories=get(STORIES_KEY,[]);if(!Array.isArray(stories))stories=[];
  comments=get(COMMENTS_KEY,{});if(!comments||typeof comments!=='object'||Array.isArray(comments))comments={};
  dating=get(DATING_KEY,{index:0,matches:[]});if(!Number.isInteger(dating.index)||!Array.isArray(dating.matches))dating={index:0,matches:[]};
  CityApps.names.bank='NexoBank';CityApps.icons.bank='💳';
  CityApps.names.dating='CityMatch';CityApps.icons.dating='❤️';
  CityApps.names.calculator='Calculadora';CityApps.icons.calculator='🧮';
  CityApps.names.graphics='Gráficos';CityApps.icons.graphics='⚙️';
  CityApps.names.gps='GPS';CityApps.icons.gps='📍';
 }
 function bankSave(){put(BANK_KEY,bank);}
 function bankLedger(note,delta){
  bank.ledger.unshift({note,delta,when:Date.now()});bank.ledger=bank.ledger.slice(0,50);bankSave();
 }
 function amount(v){return Math.round(Number(v)*100)/100;}
 function bankMove(operation,value) {
  let val=amount(value);
  if(!Number.isFinite(val)||val<=0||val>1000000)return {ok:false,text:'Informe um valor válido de até R$ 1 milhão'};
  val=Math.round(val);
  if(val<1)return {ok:false,text:'Valor mínimo de R$ 1'};
  if(operation==='deposit'){
   if(!CityLife.debit(val,'Depósito '+bankName))return {ok:false,text:'Saldo insuficiente na carteira'};
   bank.balance+=val;bankLedger('Depósito da carteira',val);
  }else if(operation==='withdraw'){
   if(bank.balance<val)return {ok:false,text:'Saldo bancário insuficiente'};
   bank.balance-=val;CityLife.credit(val,'Saque '+bankName);bankLedger('Saque para carteira',-val);
  }else if(operation==='invest'){
   if(bank.balance<val)return {ok:false,text:'Saldo bancário insuficiente'};
   bank.balance-=val;bank.savings+=val;bankLedger('Aplicação · Nexo Reserva',-val);
  }else if(operation==='redeem'){
   if(bank.savings<val)return {ok:false,text:'Investimento insuficiente'};
   bank.savings-=val;bank.balance+=val;bankLedger('Resgate de investimento',val);
  }else return {ok:false,text:'Operação indisponível'};
  bankSave();return {ok:true,text:'Transação concluída · '+money(val)};
 }
 function yieldSavings(){
  if(bank.savings<=0)return {ok:false,text:'Faça uma aplicação primeiro'};
  const gap=Date.now()-(bank.lastYield||0);
  if(bank.lastYield && gap<86400000)return {ok:false,text:'Próximo rendimento disponível em '+Math.ceil((86400000-gap)/3600000)+'h'};
  const gain=Math.max(1,Math.floor(bank.savings*.002));
  bank.savings+=gain;bank.lastYield=Date.now();bankLedger('Rendimento Nexo Reserva (simulado)',gain);
  return {ok:true,text:'Rendimento de '+money(gain)+' aplicado'};
 }
 function bankView(){
  const total=bank.balance+bank.savings,expenses=CityLife.history.filter(x=>x.delta<0).slice(0,30).reduce((s,x)=>s-Math.min(0,x.delta),0);
  const income=CityLife.history.filter(x=>x.delta>0).slice(0,30).reduce((s,x)=>s+Math.max(0,x.delta),0);
  return '<div class="city-bank"><div class="city-bank-hero"><span class="city-bank-brand">◈ '+bankName.toUpperCase()+'</span><small>Banco digital da cidade · conta simulada</small><strong>'+money(bank.balance)+'</strong><span>Saldo em conta</span><div class="city-bank-cards"><div>Investimentos<b>'+money(bank.savings)+'</b></div><div>Patrimônio financeiro<b>'+money(total)+'</b></div></div></div>'+
   '<div class="city-panel"><h3>Movimente seu dinheiro</h3><label for="nexo-amount">Valor em R$</label><input id="nexo-amount" inputmode="numeric" type="number" min="1" max="1000000" step="1" value="1000"><div class="city-bank-buttons">'+
   btn('extra:bank:deposit','↓ Depositar')+btn('extra:bank:withdraw','↑ Sacar')+
   btn('extra:bank:invest','↗ Investir')+btn('extra:bank:redeem','↙ Resgatar')+'</div>'+
   btn('extra:bank:yield','◇ Resgatar rendimento diário')+
   '<p class="city-help">Simulação: rendimento de 0,2% por operação diária, disponível após 24h reais. Não representa investimentos reais.</p></div>'+
   '<div class="city-panel"><h3>Visão financeira</h3><div class="city-finance-grid"><div>Entradas recentes<strong>'+money(income)+'</strong></div><div>Despesas recentes<strong>'+money(expenses)+'</strong></div><div>Carteira<strong>'+money(CityLife.funds)+'</strong></div><div>Contas da casa<strong>'+money(CitySim.data.bills)+'</strong></div></div>'+
   btn('extra:bank:paybills','Pagar contas pelo banco',!CitySim.data.bills)+'</div>'+
   '<div class="city-panel"><h3>Extrato da conta</h3>'+(bank.ledger.length?bank.ledger.slice(0,18).map(x=>'<div class="city-statement"><span>'+esc(x.note)+'<small>'+new Date(x.when).toLocaleDateString('pt-BR')+'</small></span><b class="'+(x.delta>=0?'good':'bad')+'">'+(x.delta>0?'+':'')+money(x.delta)+'</b></div>').join(''):'<p>Sem movimentações bancárias.</p>')+'</div></div>';
 }
 function dynamicComments(post){
   const key=String(post.id);if(!Array.isArray(comments[key]))comments[key]=[];
   const list=comments[key];if(list.length)return list;
   const msgs=[
     ['Lucas','Esse rolê aí está rendendo histórias! 😂'],
     ['Ana','Quero ver mais atualizações! ✨'],
     ['Lucas','Me chama para a próxima aventura! 🚗'],
     ['Ana','Ficou muito bom, adorei! 💕'],
     ['Lucas','Temos que marcar alguma coisa na cidade 😎'],
     ['Ana','A vida nessa cidade nunca fica parada! 🌆']
   ];
   const seed=[...key].reduce((n,c)=>n+c.charCodeAt(0),0);
   list.push({name:msgs[seed%msgs.length][0],text:msgs[seed%msgs.length][1]});
   if(seed%3===0)list.push({name:msgs[(seed+3)%msgs.length][0],text:msgs[(seed+3)%msgs.length][1]});
   put(COMMENTS_KEY,comments);return list;
 }
 function socialView(){
   const now=Date.now();
   stories=stories.filter(s=>Number.isFinite(s.time)&&now-s.time<86400000).slice(-15);
   put(STORIES_KEY,stories);
   const data=CitySim.data;
   return '<div class="city-social-white"><header class="city-ig-top"><strong>CitySocial</strong><span>♡　✉</span></header>'+
    '<div class="city-stories"><button data-action="extra:story:new" class="city-story"><span>＋</span><small>Seu story</small></button>'+
    [{name:'Lucas',emoji:'🧑🏾'},{name:'Ana',emoji:'👩🏻'}].map(x=>'<div class="city-story"><span>'+x.emoji+'</span><small>'+x.name+'</small></div>').join('')+
    stories.slice().reverse().map((x,i)=>'<button data-action="extra:story:view:'+i+'" class="city-story"><span>📸</span><small>Você · '+(i+1)+'</small></button>').join('')+'</div>'+
    '<form id="city-social-form" class="city-ig-composer"><label for="city-social-text">Compartilhe um momento</label><textarea id="city-social-text" maxlength="180" placeholder="O que aconteceu hoje?"></textarea><div><span>📷 '+(CityCamera.photo?'Foto disponível':'Use CityCam para adicionar imagem')+'</span><button type="submit">Publicar</button></div></form>'+
    (data.posts.length?data.posts.slice().reverse().map(post=>{
     const id=String(post.id),com=dynamicComments(post);
     return '<article class="city-ig-post"><div class="city-ig-author"><span>👤</span><div><b>Você</b><small>City of God · '+new Date(post.time||0).toLocaleDateString('pt-BR')+'</small></div><strong>···</strong></div>'+
       (typeof post.photo==='string'&&post.photo.startsWith('data:image/jpeg;base64,')?'<img class="city-ig-photo" alt="Foto do post" src="'+post.photo+'">':
       '<div class="city-ig-placeholder">🌆<small>Um momento em City of God</small></div>')+
       '<div class="city-ig-actions">'+btn('sim:like:'+post.id,(post.likes?'❤️':'♡'))+'　💬　➤</div>'+
       '<p><strong>'+(post.likes||0)+' curtida(s)</strong></p><p><b>Você:</b> '+esc(post.text)+'</p>'+
       '<div class="city-comments">'+com.slice(-12).map(x=>'<p><b>'+esc(x.name)+'</b> '+esc(x.text)+'</p>').join('')+'</div>'+
       '<form class="city-comment-form" data-post="'+esc(id)+'"><input maxlength="90" placeholder="Adicionar comentário…" required><button type="submit">Enviar</button></form></article>';
    }).join(''):'<div class="city-ig-empty">✨ Compartilhe seu primeiro momento!</div>')+
    '<footer class="city-ig-bottom">⌂　⌕　⊕　♡　◉</footer></div>';
 }
 function storyView(i){
   const x=stories.slice().reverse()[i];if(!x)return null;
   const el=document.createElement('div');el.id='city-story-overlay';
   el.innerHTML='<div class="city-story-view" role="dialog"><button type="button" data-story-close aria-label="Fechar">✕</button><h3>Seu story · '+new Date(x.time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'</h3>'+
     (x.photo?'<img alt="Story publicado" src="'+x.photo+'">':'<span>📸</span>')+'<p>'+esc(x.text||'Minha história na cidade')+'</p></div>';
   document.body.appendChild(el);
   el.addEventListener('click',e=>{if(e.target===el||e.target.closest('[data-story-close]'))el.remove();});
 }
 const parseCalculation=(input)=>{
   // Parser de aritmética pura, sem eval ou execução dinâmica.
   const src=String(input||'').replace(/,/g,'.').replace(/\s+/g,'');
   if(src.length>100||!/^[0-9.()+*\/-]+$/.test(src))throw Error('Expressão inválida');
   const tokens=src.match(/\d*\.?\d+|[()+*\/-]/g)||[];
   if(tokens.join('')!==src)throw Error('Expressão inválida');
   let i=0;
   function atom(){
     const t=tokens[i++];
     if(t==='('){const n=expr();if(tokens[i++]!==')')throw Error('Parênteses incompletos');return n;}
     if(t==='-')return -atom();
     if(t==='+')return atom();
     const n=Number(t);if(!Number.isFinite(n))throw Error('Número inválido');return n;
   }
   function term(){let v=atom();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],b=atom();v=op==='*'?v*b:v/b;}return v;}
   function expr(){let v=term();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],b=term();v=op==='+'?v+b:v-b;}return v;}
   const r=expr();if(i!==tokens.length||!Number.isFinite(r)||Math.abs(r)>1e13)throw Error('Resultado inválido');
   return Number(r.toFixed(8));
 };
 function calculatorView(){
   return '<div class="city-calculator"><div class="city-calc-result"><small>CALCULADORA</small><span>'+esc(calcExpression||'0')+'</span><strong>'+esc(calcResult||'0')+'</strong></div><div class="city-calc-keys">'+
     ['AC','(',')','÷','7','8','9','×','4','5','6','−','1','2','3','+','±','0','.','='].map(c=>
     '<button data-action="extra:calc:'+encodeURIComponent(c)+'" class="'+('÷×−+=' .includes(c)?'operation':'')+'">'+esc(c)+'</button>').join('')+'</div></div>';
 }
 function datingView(){
   const p=profiles[dating.index%profiles.length];
   return '<div class="city-dating"><header>♥ CityMatch <small>Encontros fictícios com NPCs adultos</small></header>'+
     '<div class="city-match-card"><div class="city-match-avatar">'+p.emoji+'</div><h2>'+esc(p.name)+', '+p.age+'</h2><p>'+esc(p.bio)+'</p></div>'+
     '<div class="city-match-actions">'+btn('extra:date:pass','✕ Pular')+btn('extra:date:like','♥ Curtir')+'</div>'+
     '<div class="city-panel"><h3>Suas conexões</h3>'+(dating.matches.length?dating.matches.map(n=>'<p>💕 '+esc(n)+' · contato virtual</p>').join(''):'<p>Nenhum match ainda. Encontre moradores da cidade!</p>')+'</div></div>';
 }
 function gpsView(){
   const entries=CityGPS.quickPanel();
   return '<div class="city-panel"><h3>📍 CityGPS</h3><p>Selecione um local para destacar no mapa e receber orientação. A linha-guia indica direção, não um caminho viário validado.</p>'+
     (CityGPS.target?'<p>Destino: <strong>'+esc(CityGPS.target.name)+'</strong></p>'+btn('extra:gps:clear','Cancelar rota'):'')+'</div>'+
     entries.map((p,i)=>'<div class="city-panel city-row"><span>'+esc(p.type==='gas'?'⛽ ':p.type==='home'?'🏡 ':'📍 ')+esc(p.name)+'</span>'+btn('extra:gps:'+i,'Marcar')+'</div>').join('');
 }
 function cameraView(){
   const st=CityCamera.state();
   return '<div class="city-camera-live"><div class="city-page-banner"><strong>CityCam Pro</strong><small>Foto + selfie com personagem 3D e enquadramento</small></div>'+
     '<div class="city-cam-modes">'+btn('extra:cam:mode:selfie','🤳 Selfie')+btn('extra:cam:mode:world','📷 Paisagem')+'</div>'+
     '<div class="city-cam-preview">'+(st.preview?'<img src="'+st.preview+'" alt="Prévia da fotografia 3D composta">':'<div class="city-cam-empty">◎<small>Toque em Enquadrar para visualizar a cena</small></div>')+'</div>'+
     '<div class="city-panel"><label for="city-cam-zoom">Zoom: '+st.zoom.toFixed(1)+'×</label><input data-cam-setting="zoom" id="city-cam-zoom" type="range" min="1" max="4" step=".1" value="'+st.zoom+'">'+
     '<label for="city-cam-panx">Enquadramento horizontal</label><input data-cam-setting="panX" id="city-cam-panx" type="range" min="-100" max="100" value="'+st.panX+'">'+
     '<label for="city-cam-pany">Enquadramento vertical</label><input data-cam-setting="panY" id="city-cam-pany" type="range" min="-100" max="100" value="'+st.panY+'"></div>'+
     '<div class="city-cam-buttons">'+btn('extra:cam:capture','◉ Enquadrar / Fotografar')+
     btn('extra:cam:download','↓ Salvar PNG')+btn('extra:cam:post','➤ Postar no CitySocial')+'</div>'+
     '<p class="city-help">Inclui o modelo 3D no momento do render. Faça o enquadramento e capture novamente após ajustar os controles.</p></div>';
 }
 function render(app){
  boot();
  if(app==='bank')return bankView();
  if(app==='graphics')return '<div class="city-panel"><h3>⚙️ Ajustes gráficos</h3><p>Reduza a carga da GPU nos bairros com muitos prédios, sombras e carros 3D.</p><p>Perfil atual: <b>'+esc(CityDriving.quality)+'</b></p>'+['high','balanced','economy'].map(x=>btn('extra:graphics:'+x,({high:'Ultra · melhor nitidez',balanced:'Equilibrado · recomendado',economy:'Econômico · mais FPS'})[x])).join(' ')+'<p class="city-help">O modo Equilibrado reduz a resolução das sombras de 4096 para 2048 pixels, diminuindo o custo de memória das sombras. Não muda o mapa nem o número de NPCs.</p></div>'; 
  if(app==='social')return socialView();
  if(app==='dating')return datingView();
  if(app==='calculator')return calculatorView();
  if(app==='gps')return gpsView();
  if(app==='camera')return cameraView();
  return null;
 }
 function afterRender(app){
   if(app==='social'){
     document.getElementById('city-social-form')?.addEventListener('submit',e=>{
       e.preventDefault();
       const text=e.target.querySelector('textarea')?.value;
       const r=CitySim.post(text,CityCamera.thumbnail());
       window.CityUI.notify(r.text);
       if(r.ok)window.CityUI.refreshPhone();
     });
     document.querySelectorAll('.city-comment-form').forEach(form=>form.addEventListener('submit',e=>{
       e.preventDefault();const value=form.querySelector('input').value.trim();if(!value)return;
       const id=form.dataset.post;
       if(!comments[id])comments[id]=[];
       comments[id].push({name:'Você',text:value.slice(0,90)});
       comments[id]=comments[id].slice(-12);put(COMMENTS_KEY,comments);window.CityUI.refreshPhone();
     }));
   }
   if(app==='camera')document.querySelectorAll('[data-cam-setting]').forEach(el=>el.addEventListener('input',()=>{
     const key=el.dataset.camSetting;CityCamera.configure({[key]:Number(el.value)});
   }));
 }
 async function action(code){
   boot();if(!code.startsWith('extra:'))return null;
   const [_,kind,op,arg]=code.split(':');
   if(kind==='graphics'){return CityDriving.setQuality(op)?{ok:true,text:'Perfil gráfico: '+op}:{ok:false,text:'Perfil inválido'};}
   if(kind==='bank'){
     if(op==='yield')return yieldSavings();
     if(op==='paybills'){
       const due=CitySim.data.bills;
       if(!due)return {ok:false,text:'Nenhuma conta pendente'};
       if(bank.balance<due)return {ok:false,text:'Saldo no banco insuficiente'};
       bank.balance-=due;bankLedger('Pagamento de contas',-due);
       CitySim.data.bills=0;CitySim.save();
       return {ok:true,text:'Contas pagas pelo NexoBank'};
     }
     return bankMove(op,document.getElementById('nexo-amount')?.value);
   }
   if(kind==='story'){
     if(op==='new'){
       const text=prompt('Legenda do story (até 120 caracteres):');
       if(text===null)return {ok:false,text:'Story cancelado'};
       stories.push({time:Date.now(),text:text.slice(0,120),photo:CityCamera.thumbnail()});
       stories=stories.slice(-15);put(STORIES_KEY,stories);return {ok:true,text:'Story publicado por 24 horas'};
     }
     if(op==='view'){storyView(Number(arg));return {ok:true,text:'Story aberto'};}
   }
   if(kind==='date'){
     const profile=profiles[dating.index%profiles.length],match=op==='like'&&dating.index%3!==1;
     dating.index++;
     if(match&&!dating.matches.includes(profile.name))dating.matches.push(profile.name);
     put(DATING_KEY,dating);
     return {ok:true,text:match?'💕 Match fictício com '+profile.name+'!':'Próximo perfil'};
   }
   if(kind==='calc'){
     const key=decodeURIComponent(op);
     if(key==='AC'){calcExpression='';calcResult='';}
     else if(key==='='){
       try{calcResult=String(parseCalculation(calcExpression));}catch(e){calcResult='Erro';}
     }else if(key==='±'){calcExpression=calcExpression.startsWith('-')?calcExpression.slice(1):'-'+calcExpression;}
     else if(calcExpression.length<70)calcExpression+=(key==='×'?'*':key==='÷'?'/':key==='−'?'-':key);
     return {ok:true,text:''};
   }
   if(kind==='gps'){
     if(op==='clear'){CityGPS.clear();return {ok:true,text:'Destino removido'};}
     const p=CityGPS.quickPanel()[Number(op)];return p&&CityGPS.set(p)?{ok:true,text:'Destino marcado: '+p.name}:{ok:false,text:'Local indisponível'};
   }
   if(kind==='cam'){
     if(op==='mode'){
       cameraMode=arg;CityCamera.configure({mode:arg,zoom:arg==='selfie'?2.5:1.1,panX:0,panY:0});
       return CityCamera.request();
     }
     if(op==='capture')return CityCamera.request();
     if(op==='download')return CityCamera.download();
     if(op==='post'){window.CityUI.goApp('social');return {ok:true,text:'Escreva uma legenda para a sua foto'};}
   }
   return {ok:false,text:'Opção indisponível'};
 }
 function install(){
   boot();
   const priorRender=CityApps.render,priorAfter=CityApps.afterRender,priorAction=CityApps.action;
   CityApps.render=(app)=>render(app)??priorRender(app);
   CityApps.afterRender=(app)=>{if(['social','camera'].includes(app))afterRender(app);else priorAfter(app);};
   CityApps.action=async(code)=>code.startsWith('extra:')?action(code):priorAction(code);
 }
 function bonus(){
   const key='cityofgod.test-budget-20261025.v1';
   try{if(localStorage.getItem(key))return;CityLife.credit(250000,'Saldo de teste para compra de imóveis');localStorage.setItem(key,'1');}catch(_){}
 }
 return {install,bonus,parseCalculation,bankMove,get bank(){return bank}};
})();
CityExtras.install();
window.CityExtras=CityExtras;