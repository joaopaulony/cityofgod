// city-commerce.js — Loja online (CitySeller) e Marketplace: estoque físico nas estantes, pedidos NPC, embalagem na mesa,
// postagem na Central Logística City e compras do jogador em lojas NPC. Regras em js/city-commerce-core.js (puras, testadas).
'use strict';
const CityCommerce=(()=>{
 const K=window.CityCommerceCore,KEY='cityofgod.commerce.v1';
 let S=K.newState(),panel=null,panelOpen=false,ui={tab:'shop',cart:{},shopView:null,mode:'standard',brand:{name:'',slogan:'',colors:['#21313a','#e2af6c'],emblem:'rounded',font:'sans',logoArt:''}},lastTick=-1e9;
 try{S=K.sanitize(JSON.parse(localStorage.getItem(KEY)||'null'));}catch{S=K.newState();}
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S));}catch{}};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>window.CityLife?CityLife.money(n):'R$ '+n;
 const clock=()=>window.__game?.st?.clock||0;
 const player=()=>window.__game?.player;
 const notify=t=>window.CityUI?.notify?.(t);
 const debit=(v,r)=>CityLife.debit(v,r),credit=(v,r)=>CityLife.credit(v,r);
 const life={canAdd:id=>CityLife.canAdd(id),addItem:(id,q)=>CityLife.addItem(id,q)};
 const PALETTE=['#21313a','#e2af6c','#2d8a66','#f2c14e','#1c6e8c','#c0392b','#8e44ad','#5b3a29','#f5f1e8','#111111','#ffffff','#e67e22'];
 const BUYERS=['Ana','Bruno','Carla','Diego','Elisa','Fábio','Gabi','Hugo','Iara','Júlio','Kátia','Leo','Marta','Nando','Olga','Pedro'].map((n,i)=>({id:'npc-'+i,name:n+' (NPC)'}));
 const dayTime=c=>window.CityDesk?CityDesk.dayTime(c):String(c);
 const STATUS={paid_reserved:'Pago · separar na estante',picking:'Separado · embalar na mesa',packed:'Embalado',labeled:'Etiquetado · levar à Central',accepted_at_hub:'Postado',in_transit:'Em trânsito',delivered:'Entregue',payout_released:'Entregue · pago',canceled_refunded:'Cancelado e estornado',
  in_transit_buy:'A caminho',out_for_delivery:'Saiu para entrega',pickup_ready:'Aguardando retirada na Central',delivered_buy:'Entregue na mochila',arrived:'Chegou · conferir no endereço',received:'Conferida'};

 // ---------- lugares: endereço da loja, estantes e Central Logística ----------
 function addressOf(p){
  const H=p&&window.CityHome?.houseAt?.(p);if(!H||!window.CityRealty)return null;const f=p.floor||0;
  if(CityRealty.multi(H)&&f>0){const u=CityRealty.unitAt(H,p.x,p.y,f);if(u==null||!CityRealty.canUse(H,f,u))return null;return {H,key:CityRealty.unitKey(H,f,u)};}
  return CityRealty.isOwned(H)?{H,key:CityRealty.id(H)}:null;
 }
 const atShop=p=>!!S.shop&&addressOf(p)?.key===S.shop.addressKey;
 // a Central Logística pode não estar carregada (streaming): usa o prédio quando existe, senão o ponto do mapa cívico
 const depotSite=()=>{const p=player()||{x:0,y:0};return (window.__game?.world?.civicSites||[]).filter(s=>s.kind==='depot').sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]||null;};
 const depot=()=>(typeof houses!=='undefined'?houses:[]).find(H=>H.civic&&H.miaKind==='depot')||null;
 const depotPoint=()=>{const H=depot();if(H)return {x:H.doorPt?.[0]??(H.x0+H.x1)/2,y:H.doorPt?.[1]??(H.y0+H.y1)/2};const s=depotSite();return s&&{x:s.x,y:s.y,far:true};};
 function atHub(p){if(!p||(p.floor||0))return false;const H=depot();if(H&&H.contains?.(p.x,p.y,0))return true;const d=depotPoint();return !!d&&Math.hypot(d.x-p.x,d.y-p.y)<(d.far?26:5);}
 function shelfNear(p){
  const a=addressOf(p);if(!a||!S.shop||a.key!==S.shop.addressKey)return null;const f=p.floor||0;let best=null,bd=1.9;
  for(const r of CityHome.placed(a.H))if((r.floor||0)===f&&K.shelfCap(r.kind)){const d=Math.hypot(r.x-p.x,r.y-p.y);if(d<bd){bd=d;best=r;}}
  return best&&{id:a.key+':'+best.id,sid:a.key+':'+best.id,kind:best.kind,x:best.x,y:best.y,floor:f,name:CityHome.catalog?.[best.kind]?.name||'Estante'};
 }
 const homeDistance=()=>{const d=depotPoint(),p=player();return d&&p?Math.hypot(d.x-p.x,d.y-p.y):800;};
 const gps=()=>{const d=depotPoint();if(!d)return {ok:false,text:'Central Logística indisponível'};window.CityGPS?.set?.({x:d.x,y:d.y,name:'Central Logística City'});return {ok:true,text:'GPS: Central Logística City'};};

 // ---------- marca (logo SVG gerado pelo núcleo do CityDesk — sanitizado) ----------
 function logo(brand,size=96){
  const D=window.CityDeskCore;if(!D||!brand)return '';
  if(brand.logoArt){const a=window.CityDesk?.state.artifacts.find(x=>x.id===brand.logoArt);if(a)return D.renderSVG(a.design,{width:size,title:brand.name});}
  const [c1,c2]=[brand.colors?.[0]||'#21313a',brand.colors?.[1]||'#e2af6c'];
  return D.renderSVG({ratio:'square',bg:c2,elements:[{type:'shape',shape:D.SHAPES.includes(brand.emblem)?brand.emblem:'rounded',size:330,x:256,y:256,fill:c1},{type:'text',text:brand.mono||'LJ',size:150,x:256,y:300,fill:c2,font:brand.font||'sans',weight:'bold'}]},{width:size,title:brand.name});
 }

 // ---------- painel físico (estante e Central) ----------
 function ensurePanel(){
  if(panel)return panel;panel=document.createElement('section');panel.id='city-commerce-panel';panel.className='cd-float';panel.hidden=true;panel.setAttribute('role','dialog');
  document.body.appendChild(panel);
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-do]');if(!b||b.disabled)return;window.CityAudio?.ui?.('click');floatAction(b.dataset.do);});
  window.addEventListener('keydown',e=>{if(!panelOpen)return;if(e.key==='Escape'||e.key.toLowerCase()==='f'&&!e.repeat){e.preventDefault();e.stopImmediatePropagation();closePanel();}else e.stopImmediatePropagation();},true);
  return panel;
 }
 let floatKind=null,floatShelf=null;
 function openPanel(kind,shelf){ensurePanel();floatKind=kind;floatShelf=shelf;panelOpen=true;panel.hidden=false;document.body.classList.add('city-desk-open');window.__game?.input?.keys?.clear?.();renderPanel();}
 function closePanel(){if(!panelOpen)return;panelOpen=false;panel.hidden=true;document.body.classList.remove('city-desk-open');save();}
 function renderPanel(){
  if(!panelOpen)return;let h='';
  if(floatKind==='shelf'){
   const sh=floatShelf,cap=K.shelfCap(sh.kind),used=K.shelfUsed(S,sh.id);
   const loose=S.lots.filter(l=>!l.shelf),here=S.lots.filter(l=>l.shelf===sh.id),pickable=S.orders.filter(o=>o.status==='paid_reserved');
   h='<header><b>📦 '+esc(sh.name)+' · estoque da loja</b><span>'+used+'/'+cap+' UVE</span>'+btnF('close','✕')+'</header>'+
    '<h4>Nesta estante</h4>'+(here.length?here.map(l=>'<div class="cd-row"><span>'+esc(K.CATALOG[l.sku].name)+'</span><small>'+l.qty+' un.'+(l.reserved?' · '+l.reserved+' reservadas':'')+'</small></div>').join(''):'<p class="cd-muted">Vazia.</p>')+
    '<h4>Mercadoria recebida (fora da estante)</h4>'+(loose.length?loose.map(l=>'<div class="cd-row"><span>'+esc(K.CATALOG[l.sku].name)+' · '+l.qty+' un.</span>'+btnF('deposit:'+l.id,'Guardar aqui',used>=cap)+'</div>').join(''):'<p class="cd-muted">Nada para guardar. Confira as remessas que chegaram no CitySeller (no computador).</p>')+
    '<h4>Pedidos para separar</h4>'+(pickable.length?pickable.map(o=>'<div class="cd-row"><span>'+o.id.toUpperCase()+' · '+o.lines.map(l=>l.qty+'× '+K.CATALOG[l.sku].name).join(', ')+'</span><small>prazo '+esc(dayTime(o.dueClock))+'</small>'+btnF('pick:'+o.id,'Separar')+'</div>').join('')+btnF('autofill','📦 Separar e embalar tudo (automático)'):'<p class="cd-muted">Nenhum pedido aguardando.</p>');
  }else{
   const labeled=S.packages.filter(p=>p.status==='labeled'),ready=S.purchases.filter(p=>p.status==='pickup_ready');
   h='<header><b>🏤 Central Logística City · guichê</b>'+btnF('close','✕')+'</header>'+
    '<h4>Postar pacotes da sua loja</h4>'+(labeled.length?labeled.map(p=>'<div class="cd-row"><span>'+esc(p.tracking)+'</span><small>'+p.volumes.join(' + ')+' · '+({hands:'nas mãos',car:'no porta-malas',pile:'na pilha de casa'}[p.loc||'pile'])+'</small></div>').join('')+btnF('post','Postar '+labeled.length+' pacote(s)',labeled.some(p=>(p.loc||'pile')!=='hands')):'<p class="cd-muted">Nenhum pacote etiquetado. Separe na estante e embale na mesa do computador.</p>')+
    '<h4>Retirar encomendas</h4>'+(ready.length?ready.map(p=>'<div class="cd-row"><span>'+esc(p.shopName)+' · '+p.lines.map(l=>l.qty+'× '+K.CATALOG[l.sku].name).join(', ')+'</span></div>').join('')+btnF('claim','Retirar tudo'):'<p class="cd-muted">Nada aguardando retirada.</p>');
  }
  panel.innerHTML='<div class="cd-float-in">'+h+'<p class="cd-muted">Esc ou F fecha.</p></div>';
 }
 const btnF=(a,l,dis=false)=>'<button type="button" data-do="'+a+'"'+(dis?' disabled':'')+'>'+l+'</button>';
 function floatAction(a){
  const [cmd,arg]=a.split(':');let r=null;const p=player();
  if(cmd==='close')return closePanel();
  if(cmd==='deposit'){const lot=S.lots.find(l=>l.id===arg);r=K.deposit(S,arg,lot?.qty||0,floatShelf);}
  else if(cmd==='pick'){closePanel();pickOrder(arg,floatShelf);return;}
  else if(cmd==='autofill')return autoFulfill();
  else if(cmd==='post'){if(pkgs('pile').length||pkgs('car').length)r={ok:false,text:'Traga todos os pacotes nas mãos: ainda há pacotes '+(pkgs('car').length?'no porta-malas':'na pilha de envio')+'.'};else{r=K.post(S,atHub(p),clock());if(r.ok)p.carry=null;}}
  else if(cmd==='claim')r=K.claim(S,atHub(p),life);
  if(r){notify(r.text);if(r.ok)window.CityAudio?.ui?.('confirm');}
  save();renderPanel();
 }


 // ---------- mundo físico: caixa nas mãos, embalagem animada, pilha de envio, porta-malas e separação automática ----------
 let job=null,auto=null;
 const DESKS=['desk','studentdesk'];
 function keyAt(H,x,y,f){if(CityRealty.multi(H)&&f>0){const u=CityRealty.unitAt(H,x,y,f);return u==null?null:CityRealty.unitKey(H,f,u);}return CityRealty.id(H);}
 function shopRows(){if(!S.shop||typeof houses==='undefined'||!window.CityRealty)return null;const H=houses.find(h=>h.architecture&&S.shop.addressKey.startsWith(CityRealty.id(h)));return H?{H,rows:CityHome.placed(H).filter(r=>keyAt(H,r.x,r.y,r.floor||0)===S.shop.addressKey)}:null;}
 function shopDesk(){const s=shopRows();if(!s)return null;const ds=s.rows.filter(r=>DESKS.includes(r.kind));return ds.find(r=>s.rows.some(q=>q.kind==='screen'&&(q.floor||0)===(r.floor||0)&&Math.hypot(q.x-r.x,q.y-r.y)<=2.6))||ds[0]||null;}
 function shelfRows(){const s=shopRows();return s?s.rows.filter(r=>K.shelfCap(r.kind)).map(r=>({...r,sid:S.shop.addressKey+':'+r.id})):[];}
 const near=(p,r,d)=>!!(p&&r&&(p.floor||0)===(r.floor||0)&&Math.hypot(p.x-r.x,p.y-r.y)<d);
 function standPoint(r,toward){let dx=(toward?.x??r.x+1)-r.x,dy=(toward?.y??r.y)-r.y,n=Math.hypot(dx,dy)||1;return {x:r.x+dx/n*.85,y:r.y+dy/n*.85};}
 const pkgs=loc=>S.packages.filter(p=>p.status==='labeled'&&(p.loc||'pile')===loc);
 function trunk(){const v=window.cityVehicles,c=v?.car;if(!v?.ready||!c||!Number.isFinite(c.x)||Math.abs(c.x)+Math.abs(c.y)<1)return null;   // sem carro no mundo, o estado fica em (0,0)
 const a=c.a??c.angle??0,len=v.carLength||4.6;return {x:c.x-Math.cos(a)*(len/2+.7),y:c.y-Math.sin(a)*(len/2+.7)};}
 function nearTrunk(p){const t=trunk();return !!t&&!window.cityVehicles?.driver&&!(p.floor||0)&&Math.hypot(t.x-p.x,t.y-p.y)<2.2;}
 const faceTo=(p,q)=>q?Math.atan2(q.y-p.y,q.x-p.x):null;
 function animate(kind,secs,face,done){const p=player();job={kind,until:performance.now()+secs*1000,face,x:p.x,y:p.y,done};if(p.armed)CityLife.equip?.('unarmed',false);p.homeAction={kind,t:0,duration:1e9,shopWork:true};if(face!=null)p.face=face;p.speed=0;}
 function tickJob(){const p=player();if(!job||!p)return;p.x=job.x;p.y=job.y;if(job.face!=null)p.face=job.face;p.speed=0;
  if(performance.now()>=job.until){const j=job;job=null;if(p.homeAction?.shopWork)p.homeAction=null;j.done?.();}}
 function carrying(){const p=player();return p?.carryOrder&&S.orders.find(o=>o.id===p.carryOrder&&o.status==='picking');}
 function pickOrder(id,shelf,then){
  const p=player();if(carrying()){notify('Embale primeiro a caixa que está nas suas mãos.');then?.(false);return;}
  const r=K.pick(S,id,shelf.sid,clock());if(!r.ok){notify(r.text);then?.(false);return;}
  save();animate('shelf',1.6,faceTo(p,shelf),()=>{p.carry='package';p.carryOrder=id;notify('📦 Caixa do pedido '+id.toUpperCase()+' nas mãos · leve até a mesa da loja e aperte F para embalar');then?.(true);});
 }
 function packOrder(id,then){
  const p=player(),d=shopDesk();
  animate('pack',2.4,faceTo(p,d),()=>{
   const r=K.pack(S,id,debit,clock());
   if(r.ok){if(p.carryOrder===id){p.carry=null;p.carryOrder=null;}const pk=S.packages.find(x=>x.orderId===id);if(pk)pk.loc='pile';
    const a=(d?.rot||0),side={x:Math.cos(a),y:Math.sin(a)};S.pileAt=d?null:{x:p.x+side.x*.75,y:p.y+side.y*.75,z:0,floor:p.floor||0};   // com mesa: pilha fixa ao lado dela (pilePos)
    notify('🏷️ '+r.text.replace('Leve à Central Logística City.','Ficou na pilha de envio ao lado da mesa.'));window.CityAudio?.ui?.('confirm');}
   else notify(r.text);
   save();then?.(r.ok);});
 }
 // separar e embalar tudo no automático: o personagem anda até a estante certa, pega, leva até a mesa e embala
 function autoFulfill(){
  if(!S.shop)return;const queue=S.orders.filter(o=>o.status==='paid_reserved'||o.status==='picking').map(o=>o.id);
  if(!queue.length)return notify('Nenhum pedido para separar agora.');
  if(!window.CityAutopilot)return notify('Piloto automático indisponível.');
  if(!shopRows())return notify('Vá até a loja (seu endereço) para separar os pedidos.');
  window.CityDesk?.close?.();closePanel();auto={queue,waiting:false};notify('📦 Separando '+queue.length+' pedido(s) no automático · ande para assumir o controle.');nextAuto();
 }
 function walkTo(pt,arrive){auto.waiting=true;const r=window.CityAutopilot.walk([pt],'trabalho na loja',()=>{if(!auto)return;auto.waiting=false;setTimeout(arrive,200);});if(!r?.ok){auto=null;notify(r?.text||'Sem caminho até lá.');}}
 function nextAuto(){
  if(!auto)return;const p=player(),id=auto.queue[0];
  if(!id){auto=null;notify('✅ Pedidos embalados. '+pkgs('pile').length+' pacote(s) na pilha de envio: pegue (F) e leve à Central Logística City.');gps();return;}
  const o=S.orders.find(x=>x.id===id);
  if(o?.status==='picking'){const d=shopDesk();if(!d){auto=null;return notify('Coloque uma mesa na loja para embalar.');}
   return walkTo(standPoint(d,p),()=>packOrder(id,()=>{auto?.queue.shift();nextAuto();}));}
  if(o?.status!=='paid_reserved'){auto.queue.shift();return nextAuto();}
  const sh=shelfRows().find(r=>o.lines.every(l=>S.lots.some(x=>x.shelf===r.sid&&x.sku===l.sku&&x.reserved>=1)));
  if(!sh){auto=null;return notify('Não achei a estante com os itens do pedido '+id.toUpperCase()+'.');}
  walkTo(standPoint(sh,shopDesk()||p),()=>pickOrder(id,sh,ok=>{if(!ok){auto=null;return;}nextAuto();}));
 }
 // a cada quadro: ação animada, automático interrompido, caixa reaparece nas mãos depois de recarregar, carro
 function tickFrame(){
  const p=player();if(!p)return;tickJob();
  if(auto&&auto.waiting&&!window.CityAutopilot?.active){auto=null;notify('Separação automática interrompida.');}
  if(!p.carry&&!job){const o=S.orders.find(x=>x.status==='picking');if(o&&!p.carryOrder){p.carry='package';p.carryOrder=o.id;}else if(pkgs('hands').length)p.carry='package';}
  if(window.cityVehicles?.driver&&pkgs('hands').length){for(const k of pkgs('hands'))k.loc='car';if(p.carry==='package'&&!carrying())p.carry=null;save();notify('📦 Pacotes guardados no porta-malas.');}
 }
 // pilha de envio: onde o último pacote foi deixado, ou ao lado da mesa da loja
 function pilePos(){const d=shopDesk();if(!d)return S.pileAt||null;const r=d.rot||0;return {x:d.x+Math.cos(r)*.95-Math.sin(r)*.5,y:d.y+Math.sin(r)*.95+Math.cos(r)*.5,z:d.z||0,floor:d.floor||0};}
 const claimsDesk=p=>!!(p&&physicalPrompt(p));   // embalar/pegar a pilha vêm antes de abrir o computador
 function visuals(){
  if(!S.shop)return null;const out={shelves:[],pile:null};
  for(const r of shelfRows()){const units=S.lots.filter(l=>l.shelf===r.sid).reduce((t,l)=>t+l.qty,0);if(units)out.shelves.push({x:r.x,y:r.y,z:r.z||0,floor:r.floor||0,rot:r.rot||0,w:r.w,h:r.h,count:Math.ceil(units/2)});}
  const n=pkgs('pile').length;if(n&&pilePos())out.pile={...pilePos(),count:n};
  return out;
 }
 function physicalPrompt(p){
  if(job||auto)return null;const o=carrying();
  if(o&&near(p,shopDesk(),2.2))return 'F · Embalar e etiquetar o pedido '+o.id.toUpperCase();
  if(pilePos()&&pkgs('pile').length&&near(p,pilePos(),1.6))return 'F · Pegar '+pkgs('pile').length+' pacote(s) da pilha de envio';
  if(nearTrunk(p)&&pkgs('hands').length)return 'F · Guardar '+pkgs('hands').length+' pacote(s) no porta-malas';
  if(nearTrunk(p)&&pkgs('car').length)return 'F · Tirar '+pkgs('car').length+' pacote(s) do porta-malas';
  return null;
 }
 function physicalInteract(p){
  if(job||auto)return null;const o=carrying();
  if(o&&near(p,shopDesk(),2.2)){packOrder(o.id);return 'Embalando…';}
  if(pilePos()&&pkgs('pile').length&&near(p,pilePos(),1.6)){const list=pkgs('pile');animate('shelf',1.3,faceTo(p,pilePos()),()=>{for(const k of list)k.loc='hands';p.carry='package';save();notify('📦 '+list.length+' pacote(s) nas mãos · leve ao carro (porta-malas) ou a pé até a Central Logística City');gps();});return 'Pegando os pacotes…';}
  if(nearTrunk(p)&&pkgs('hands').length){const list=pkgs('hands');animate('shelf',1.1,faceTo(p,trunk()),()=>{for(const k of list)k.loc='car';p.carry=null;save();notify('🚗 Pacotes no porta-malas. Dirija até a Central Logística City.');});return 'Guardando…';}
  if(nearTrunk(p)&&pkgs('car').length){const list=pkgs('car');animate('shelf',1.1,faceTo(p,trunk()),()=>{for(const k of list)k.loc='hands';p.carry='package';save();notify('📦 Pacotes nas mãos · entregue no guichê da Central (F)');});return 'Pegando…';}
  return null;
 }

 // ---------- F e dica na tela ----------
 const blocked=()=>!!(window.CityFront?.blocked||window.CityUI?.blocksGameInput?.()||window.CityHomeUI?.active||window.cityVehicles?.driver||window.CityDesk?.open);
 function prompt(p){
  if(panelOpen||blocked())return null;
  const ph=physicalPrompt(p);if(ph)return ph;if(job||auto)return null;
  const sh=shelfNear(p);if(sh)return 'F · Estoque da loja ('+esc(sh.name)+': '+K.shelfUsed(S,sh.id)+'/'+K.shelfCap(sh.kind)+' UVE)';
  if(atHub(p)&&(S.packages.some(x=>x.status==='labeled')||S.purchases.some(x=>x.status==='pickup_ready')))return 'F · Guichê da Central Logística (postar pacotes / retirar encomendas)';
  return null;
 }
 function interact(p){
  if(panelOpen||blocked())return null;
  const ph=physicalInteract(p);if(ph)return ph;if(job||auto)return null;
  const sh=shelfNear(p);if(sh){openPanel('shelf',sh);return 'Estoque aberto';}
  if(atHub(p)&&(S.packages.some(x=>x.status==='labeled')||S.purchases.some(x=>x.status==='pickup_ready'))){openPanel('hub');return 'Guichê aberto';}
  return null;
 }

 // ---------- tempo ----------
 function tick(){
  if(!window.CityFront?.blocked)tickFrame();
  const now=clock();if(window.CityFront?.blocked||now-lastTick<10)return;lastTick=now;let changed=false;
  for(const sh of K.tickShipments(S,now)){notify('🚚 Remessa '+sh.id.toUpperCase()+' chegou no endereço da loja. Confira no CitySeller.');changed=true;}
  if(S.shop&&S.shop.status==='open'){const o=K.npcDemand(S,now,BUYERS);if(o.length){notify('🛒 '+o.length+' novo(s) pedido(s) na sua loja '+S.shop.brand.name+'. Separe na estante.');changed=true;}}
  else if(S.lastDemandDay<K.day(now))S.lastDemandDay=K.day(now)-1;
  for(const x of S.shop?K.tickDeliveries(S,now,credit):[]){notify(x.canceled?'↩️ Pedido '+x.order.id.toUpperCase()+' cancelado e estornado: não foi separado no prazo.':'💰 Pedido '+x.order.id.toUpperCase()+' entregue: +'+money(x.net));changed=true;}
  const home=Object.keys(window.CityRealty?.owned||{}).length>0;   // tem endereço (casa ou apartamento), mesmo fora do streaming
  for(const p of K.tickPurchases(S,now,{...life,home})){notify('📬 Encomenda de '+p.shopName+' entregue: itens na mochila.');changed=true;}
  if(changed){save();window.CityDesk?.open&&CityDesk.render();if(panelOpen)renderPanel();}
 }

 // ---------- CitySeller (no computador) ----------
 const TABS=[['shop','Minha loja'],['stock','Estoque'],['ads','Anúncios'],['orders','Pedidos']];
 function seller(D){
  const tabs='<div class="cd-tabs">'+TABS.map(([id,l])=>'<button type="button" data-do="ctab:'+id+'" class="'+(ui.tab===id?'on':'')+'">'+l+'</button>').join('')+'</div>';
  if(!S.shop)return '<h2>CitySeller</h2>'+brandEditor(D,true);
  const lv=K.levelOf(S.shop),here=D.station?.addressKey===S.shop.addressKey;
  const head='<div class="cd-shophead"><div class="cd-logo">'+logo(S.shop.brand,72)+'</div><div><b>'+esc(S.shop.brand.name)+'</b><small>cityweb/loja/'+esc(S.shop.brand.slug)+' · nível '+lv+' · reputação '+Math.round(S.shop.reputation)+' · '+S.shop.delivered+' entregas</small>'+(S.shop.brand.slogan?'<small>“'+esc(S.shop.brand.slogan)+'”</small>':'')+'</div>'+
   btnD('pause',S.shop.status==='open'?'Pausar vendas':'Reabrir vendas')+'</div>';
  let body='';
  if(ui.tab==='shop')body=brandEditor(D,false);
  else if(ui.tab==='stock'){
   body='<h4>Comprar no atacado (fornecedores NPC)</h4>'+K.SUPPLIERS.map(sp=>'<div class="cd-card"><b>'+esc(sp.name)+'</b><small> · mínimo '+sp.minQty+' por produto · chega em '+sp.days+' dia(s)</small><div class="cd-buy">'+
     sp.skus.map(sku=>'<label>'+esc(K.CATALOG[sku].name)+' <small>'+money(Math.round(K.CATALOG[sku].retail*K.CONFIG.wholesale))+'/un</small><input type="number" min="0" max="60" step="1" data-in="ws:'+sp.id+':'+sku+'" value="'+(ui['ws:'+sp.id+':'+sku]||0)+'"></label>').join('')+'</div>'+btnD('buy:'+sp.id,'Encomendar')+'</div>').join('')+
    '<h4>Remessas</h4>'+(S.shipments.length?S.shipments.slice().reverse().slice(0,12).map(sh=>'<div class="cd-row"><span>'+sh.id.toUpperCase()+' · '+sh.lines.map(l=>l.qty+'× '+K.CATALOG[l.sku].name).join(', ')+'</span><small>'+(sh.status==='in_transit'?'chega '+esc(dayTime(sh.arriveClock)):esc(STATUS[sh.status]||sh.status))+'</small>'+(sh.status==='arrived'?btnD('receive:'+sh.id,'Conferir',!here):'')+'</div>').join('')+(here?'':'<p class="cd-muted">Para conferir, use o computador no endereço da loja.</p>'):'<p class="cd-muted">Nenhuma remessa.</p>')+
    '<h4>Estoque</h4>'+Object.keys(K.CATALOG).map(sku=>{const st=S.lots.filter(l=>l.sku===sku),loose=st.filter(l=>!l.shelf).reduce((t,l)=>t+l.qty,0),av=K.available(S,sku);return st.length?'<div class="cd-row"><span>'+esc(K.CATALOG[sku].name)+'</span><small>'+av+' disponível · '+st.filter(l=>l.shelf).reduce((t,l)=>t+l.reserved,0)+' reservado · '+loose+' fora da estante</small></div>':'';}).join('')+
    '<p class="cd-muted">Só é vendável o que está guardado numa estante da loja (vá até a estante e aperte F). Capacidade: estante pequena 4 · prateleira 6 · estante dupla 12 · estante 14 · estante grande 24 UVE.</p>';
  }else if(ui.tab==='ads'){
   body='<h4>Anúncios ('+S.listings.filter(l=>l.status!=='hidden').length+'/'+K.CONFIG.maxListings[lv]+')</h4>'+Object.entries(K.CATALOG).map(([sku,c])=>{const l=S.listings.find(x=>x.sku===sku),av=K.available(S,sku)+(l?0:0);if(!av&&!l)return '';
    return '<div class="cd-ad"><b>'+esc(c.name)+'</b><small>faixa sugerida '+money(c.band[0])+'–'+money(c.band[1])+' · disponível '+K.available(S,sku)+'</small><label>Qtde <input type="number" min="0" max="'+K.available(S,sku)+'" data-in="aq:'+sku+'" value="'+(ui['aq:'+sku]??l?.qty??K.available(S,sku))+'"></label><label>Preço <input type="number" min="1" data-in="ap:'+sku+'" value="'+(ui['ap:'+sku]??l?.price??c.band[0])+'"></label>'+btnD('list:'+sku,l?'Atualizar':'Publicar')+(l?'<small>'+esc(l.status==='active'?'ativo · '+l.qty+' à venda':'sem estoque')+'</small>':'')+'</div>';}).join('')||'<p class="cd-muted">Guarde mercadoria nas estantes para anunciar.</p>';
  }else{
   const orders=S.orders.slice().reverse().slice(0,20);
   body=(S.orders.some(o=>['paid_reserved','picking'].includes(o.status))?'<div class="cd-actions">'+btnD('autofill','📦 Separar e embalar tudo (automático)')+'</div>':'')+'<h4>Pedidos de clientes NPC</h4><p class="cd-muted">Fluxo: separar na estante (F) → embalar aqui na mesa → postar no guichê da Central Logística City. O dinheiro fica retido e é liberado na entrega (comissão '+Math.round(K.CONFIG.commission*100)+'%).</p>'+
    (orders.length?orders.map(o=>'<div class="cd-order"><div><b>'+o.id.toUpperCase()+'</b> · '+esc(o.buyer?.name)+'<small>'+o.lines.map(l=>l.qty+'× '+K.CATALOG[l.sku].name+' a '+money(l.unit)).join(', ')+' · '+money(o.escrow)+(o.tracking?' · rastreio '+esc(o.tracking):'')+'</small></div><span class="cd-pill">'+esc(STATUS[o.status]||o.status)+'</span>'+
     (o.status==='picking'?btnD('pack:'+o.id,'Embalar e etiquetar',!here):'')+(o.status==='paid_reserved'?'<small>separar na estante</small>':'')+(o.status==='labeled'?btnD('gps','GPS → Central'):'')+'</div>').join(''):'<p class="cd-muted">Sem pedidos ainda. Publique anúncios com preço dentro da faixa.</p>')+
    '<p class="cd-muted">Material: caixas P '+S.supplies.P+' · M '+S.supplies.M+' · G '+S.supplies.G+' · fita '+S.supplies.tape+' · etiquetas '+S.supplies.label+' (o que faltar é comprado na hora).</p>';
  }
  return '<h2>CitySeller</h2>'+head+tabs+body;
 }
 const btnD=(a,l,dis=false)=>'<button type="button" data-do="c:'+a+'"'+(dis?' disabled':'')+'>'+l+'</button>';
 function brandEditor(D,creating){
  const b=creating?ui.brand:{...S.shop.brand,...(ui.brandEdit||{})},arts=(window.CityDesk?.state.artifacts||[]).filter(a=>a.kind==='design');
  const pal=k=>PALETTE.map(c=>'<button type="button" class="cd-swatch'+(b.colors[k]===c?' on':'')+'" style="background:'+c+'" data-do="c:bcolor:'+k+':'+c.slice(1)+'" aria-label="'+c+'"></button>').join('');
  return '<div class="cd-two"><div>'+(creating?'<p>Abra sua loja online. Ela fica registrada neste endereço ('+esc(D.station?.addressKey?'seu imóvel':'')+'); o estoque físico fica nas estantes daqui. Taxa de registro da marca: <b>'+money(K.CONFIG.brandFee)+'</b> (uma vez).</p>':'<h4>Identidade da marca</h4>')+
   '<label class="cd-field">Nome (3–30) <input data-in="bname" maxlength="30" value="'+esc(b.name)+'" '+(creating?'':'disabled')+'></label>'+
   '<label class="cd-field">Slogan <input data-in="bslogan" maxlength="100" value="'+esc(b.slogan||'')+'"></label>'+
   '<div class="cd-sw">Cor principal '+pal(0)+'</div><div class="cd-sw">Cor de fundo '+pal(1)+'</div>'+
   '<label class="cd-field">Emblema <select data-in="bemblem">'+['rounded','circle','shield','hexagon','diamond','star','leaf','heart','badge','house','cup','bolt'].map(x=>'<option '+(b.emblem===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
   '<label class="cd-field">Fonte <select data-in="bfont">'+['sans','serif','display','mono'].map(x=>'<option '+(b.font===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
   (arts.length?'<label class="cd-field">Logo do portfólio (Brand Studio) <select data-in="blogo"><option value="">Emblema automático</option>'+arts.map(a=>'<option value="'+a.id+'" '+(b.logoArt===a.id?'selected':'')+'>'+esc(a.title)+'</option>').join('')+'</select></label>':'<p class="cd-muted">Dica: crie um logo no Brand Studio (arte livre) e use aqui.</p>')+
   (creating?btnD('create','Abrir loja · '+money(K.CONFIG.brandFee)):btnD('savebrand','Salvar identidade'))+'</div>'+
   '<div class="cd-preview"><small>Prévia da vitrine</small><div class="cd-storefront" style="--b1:'+b.colors[0]+';--b2:'+b.colors[1]+'"><div class="cd-logo">'+logo({...b,mono:(b.name||'LJ').split(/\s+/).map(w=>w[0]).join('').slice(0,3).toUpperCase()},88)+'</div><b>'+esc(b.name||'Sua loja')+'</b><small>'+esc(b.slogan||'')+'</small></div></div></div>';
 }
 function sellerAction(D,a){
  const [_,cmd,...rest]=a.split(':'),arg=rest.join(':');let r=null;
  if(cmd==="ctab"){ui.tab=arg;return;}
  if(cmd==='bcolor'){const [k,hex]=arg.split(':'),tgt=S.shop?(ui.brandEdit=ui.brandEdit||{colors:[...S.shop.brand.colors]}):ui.brand;tgt.colors=tgt.colors||[...S.shop.brand.colors];tgt.colors[+k]='#'+hex;return;}
  if(cmd==='create'){const st=D.station;r=K.createShop(S,ui.brand,st?.addressKey,debit,clock());if(r.ok&&ui.brand.logoArt)S.shop.brand.logoArt=ui.brand.logoArt;}
  else if(cmd==='savebrand'){const v=K.validateBrand({...S.shop.brand,...ui.brandEdit,name:S.shop.brand.name});if(v.ok){S.shop.brand={...S.shop.brand,...v.data,slug:S.shop.brand.slug,logoArt:(ui.brandEdit?.logoArt??S.shop.brand.logoArt)||''};ui.brandEdit=null;r={ok:true,text:'Identidade da marca salva.'};}else r=v;}
  else if(cmd==='pause'){S.shop.status=S.shop.status==='open'?'paused':'open';r={ok:true,text:S.shop.status==='open'?'Vendas reabertas.':'Vendas pausadas: nenhum pedido novo chega.'};}
  else if(cmd==='buy'){const sp=K.SUPPLIERS.find(x=>x.id===arg);const lines=sp.skus.map(sku=>({sku,qty:+(ui['ws:'+sp.id+':'+sku]||0)|0})).filter(l=>l.qty>0);r=K.buyWholesale(S,arg,lines,debit,clock());if(r.ok)for(const sku of sp.skus)delete ui['ws:'+sp.id+':'+sku];}
  else if(cmd==='receive')r=K.receiveShipment(S,arg,D.station?.addressKey===S.shop.addressKey);
  else if(cmd==='list'){r=K.upsertListing(S,arg,+(ui['aq:'+arg]??K.available(S,arg)),+(ui['ap:'+arg]??K.CATALOG[arg].band[0]));delete ui['aq:'+arg];delete ui['ap:'+arg];}
  else if(cmd==='pack'){if(D.station?.addressKey!==S.shop.addressKey)r={ok:false,text:'Embale na mesa do endereço da loja.'};else{D.close();packOrder(arg);return;}}
  else if(cmd==='autofill'){autoFulfill();return;}
  else if(cmd==='gps')r=gps();
  if(r)D.notify(r.text,r.ok);save();
 }
 function sellerInput(D,k,v){
  if(k==='bname')ui.brand.name=v;else if(k==='bslogan'){if(S.shop)(ui.brandEdit=ui.brandEdit||{}).slogan=v;else ui.brand.slogan=v;}
  else if(k==='bemblem'||k==='bfont'||k==='blogo'){const f={bemblem:'emblem',bfont:'font',blogo:'logoArt'}[k];if(S.shop)(ui.brandEdit=ui.brandEdit||{})[f]=v;else ui.brand[f]=v;D.render();}
  else ui[k]=v;
 }
 function sellerFinance(){
  if(!S.shop)return '';const L=S.ledger,sum=k=>L.filter(t=>t.kind===k).reduce((t,x)=>t+x.amount,0);
  return '<h3>CitySeller · '+esc(S.shop.brand.name)+'</h3><table class="cd-table"><tr><td>Vendas recebidas (líquido)</td><td>'+money(sum('payout'))+'</td></tr><tr><td>Compras no atacado</td><td>'+money(sum('wholesale'))+'</td></tr><tr><td>Embalagens</td><td>'+money(sum('packaging'))+'</td></tr><tr><td>Taxa da marca</td><td>'+money(sum('brand_fee'))+'</td></tr><tr><th>Resultado</th><th>'+money(L.reduce((t,x)=>t+x.amount,0))+'</th></tr></table>';
 }

 // ---------- Marketplace (comprador) ----------
 function market(){
  const shops=K.NPC_SHOPS,v=ui.shopView&&shops.find(s=>s.id===ui.shopView);
  const purchases=S.purchases.slice().reverse().slice(0,8).map(p=>'<div class="cd-row"><span>'+p.id.toUpperCase()+' · '+esc(p.shopName)+' · '+money(p.total)+'</span><span class="cd-pill">'+esc(STATUS[p.status==='delivered'?'delivered_buy':p.status==='in_transit'?'in_transit_buy':p.status]||p.status)+'</span></div>').join('');
  if(!v)return '<h2>Marketplace</h2><p class="cd-muted">Lojas da cidade (NPC). Compras chegam na mochila em casa ou ficam para retirada na Central Logística City.</p><div class="cd-shops">'+
   shops.map(s=>'<button type="button" class="cd-shopcard" data-do="m:view:'+s.id+'" style="--b1:'+s.colors[0]+';--b2:'+s.colors[1]+'"><span class="cd-logo">'+logo({name:s.name,mono:s.mono,colors:s.colors,emblem:s.emblem},56)+'</span><b>'+esc(s.name)+'</b><small>★ '+s.rating+' · loja NPC</small></button>').join('')+
   (S.shop?'<div class="cd-shopcard own" style="--b1:'+S.shop.brand.colors[0]+';--b2:'+(S.shop.brand.colors[1]||'#fff')+'"><span class="cd-logo">'+logo(S.shop.brand,56)+'</span><b>'+esc(S.shop.brand.name)+'</b><small>sua loja · '+S.listings.filter(l=>l.status==='active').length+' anúncios</small></div>':'')+'</div>'+
   '<h4>Minhas compras</h4>'+(purchases||'<p class="cd-muted">Nenhuma compra.</p>');
  const cart=ui.cart[v.id]||{},sub=Object.entries(cart).reduce((t,[sku,q])=>t+v.skus[sku]*q,0),ship=K.freight(ui.mode,homeDistance());
  return '<h2>Marketplace</h2>'+btnM('back','← Lojas')+'<div class="cd-shophead" style="--b1:'+v.colors[0]+'"><div class="cd-logo">'+logo({name:v.name,mono:v.mono,colors:v.colors,emblem:v.emblem},64)+'</div><div><b>'+esc(v.name)+'</b><small>★ '+v.rating+' · loja NPC</small></div></div>'+
   Object.entries(v.skus).map(([sku,price])=>'<div class="cd-row"><span>'+(CityLife.items[K.CATALOG[sku].source]?.icon||'')+' '+esc(K.CATALOG[sku].name)+'</span><small>'+money(price)+'</small>'+btnM('dec:'+sku,'−')+'<b>'+(cart[sku]||0)+'</b>'+btnM('inc:'+sku,'+')+'</div>').join('')+
   '<div class="cd-checkout"><label>Entrega <select data-in="mode">'+Object.entries(K.CONFIG.freight).map(([k,f])=>'<option value="'+k+'" '+(ui.mode===k?'selected':'')+'>'+f.name+' · '+money(K.freight(k,homeDistance()))+'</option>').join('')+'</select></label><b>Total '+money(sub+ship)+'</b>'+btnM('checkout:'+v.id,'Finalizar compra',!sub)+'</div><p class="cd-muted">O frete é calculado no checkout e não muda depois.</p>';
 }
 const btnM=(a,l,dis=false)=>'<button type="button" data-do="m:'+a+'"'+(dis?' disabled':'')+'>'+l+'</button>';
 function marketAction(D,a){
  const [_,cmd,arg]=a.split(':');
  if(cmd==='view'){ui.shopView=arg;return;}if(cmd==='back'){ui.shopView=null;return;}
  if(cmd==='inc'||cmd==='dec'){const c=ui.cart[ui.shopView]=ui.cart[ui.shopView]||{};c[arg]=Math.max(0,Math.min(20,(c[arg]||0)+(cmd==='inc'?1:-1)));if(!c[arg])delete c[arg];return;}
  if(cmd==='checkout'){const cart=Object.entries(ui.cart[arg]||{}).map(([sku,qty])=>({sku,qty}));const r=K.checkout(S,arg,cart,ui.mode,homeDistance(),debit,clock());D.notify(r.text,r.ok);if(r.ok){ui.cart[arg]={};window.CityAudio?.ui?.('confirm');}save();}
 }

 // registro no CityDesk
 function register(){
  if(!window.CityDesk)return;
  CityDesk.register('seller',{label:'CitySeller',icon:'🏪',render:seller,action:(D,a)=>a.startsWith('m:')?marketAction(D,a):sellerAction(D,a.startsWith('ctab:')?'c:'+a:a),input:(D,k,v)=>sellerInput(D,k,v),finance:sellerFinance,tick:()=>{}});
  CityDesk.register('market',{label:'Marketplace',icon:'🛍️',render:market,action:marketAction,input:(D,k,v)=>{if(k==='mode'){ui.mode=v;D.render();}}});
 }
 // celular: app Marketplace (comprar e acompanhar) — vender exige o computador
 function renderPhone({card,banner,btn}){
  let h=banner('<strong>Marketplace</strong><small>Lojas da cidade (NPC). Para vender, use o CitySeller no computador de casa.</small>');
  if(S.shop){const pend=S.orders.filter(o=>['paid_reserved','picking','labeled'].includes(o.status)).length;h+=card('Sua loja · '+S.shop.brand.name,pend+' pedido(s) aguardando ação · reputação '+Math.round(S.shop.reputation),pend&&S.packages.some(p=>p.status==='labeled')?btn('shopping:gps','GPS → Central'):'','🏪');}
  for(const s of K.NPC_SHOPS)h+=card(s.name+' ★'+s.rating,Object.entries(s.skus).map(([sku,p])=>K.CATALOG[sku].name+' '+money(p)).join(' · '),Object.keys(s.skus).slice(0,3).map(sku=>btn('shopping:buy:'+s.id+'|'+sku,'+1 '+K.CATALOG[sku].name.split(' ')[0])).join(''),'🛍️');
  const open=S.purchases.filter(p=>p.status!=='delivered');if(open.length)h+='<div class="city-phone-label">Rastreio</div>'+open.map(p=>card(p.shopName+' · '+money(p.total),STATUS[p.status==='in_transit'?'in_transit_buy':p.status]||p.status,p.status==='pickup_ready'?btn('shopping:gps','GPS → Central'):'','📦')).join('');
  return h;
 }
 function phoneAction(cmd,arg){
  if(cmd==='gps')return gps();
  if(cmd==='buy'){const [shop,sku]=String(arg).split('|');const r=K.checkout(S,shop,[{sku,qty:1}],'standard',homeDistance(),debit,clock());save();return r;}
  return {ok:false,text:'Ação indisponível'};
 }
 function reset(){S=K.newState();save();}

 const api={visuals,claimsDesk,autoFulfill,get busy(){return !!(job||auto);},get state(){return S;},get open(){return panelOpen;},prompt,interact,tick,register,renderPhone,phoneAction,reset,logo,close:closePanel};
 register();
 return api;
})();
window.CityCommerce=CityCommerce;
