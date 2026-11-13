// CityRealty: propriedades baseadas nas portas reais, sem índices globais de setor.
'use strict';
const CityRealty=(()=>{
 const KEY='cityofgod.owned-homes.v1',RENT_DAYS=7,MAX_ARREARS=3;
 let owned={};let started=false,selected=null,selectedLot=null;
 const id=H=>Math.round(H.doorPt?.[0]??H.x0)+'_'+Math.round(H.doorPt?.[1]??H.y0)+'_'+Math.round(H.x1-H.x0)+'x'+Math.round(H.y1-H.y0);
 const residential=H=>!!H?.doorPt&&!H.civic&&!H.terminal&&!H.brick&&!['cafe','shop','store','hospital','office','hotel','commercial','public'].includes(H.miaKind);
 function init(){
   if(started)return;started=true;
   try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');if(x&&typeof x==='object'&&!Array.isArray(x)) owned=x;}catch(_){}
   // Contratos de casas anteriores continuam acessíveis. Novos contratos usam apartamentos por andar.
   for(const v of Object.values(owned))if(v&&v.rental===true)v.rental={rate:160,nextDueDay:null,arrears:0,autoPay:true,interval:RENT_DAYS,legacy:true};
   document.addEventListener('click',e=>{
     const rent=e.target.closest('[data-unit-rent]');
     if(rent){const [hid,f,u]=rent.dataset.unitRent.split('|'),H=houses.find(h=>multi(h)&&id(h)===hid);const result=rentUnit(H,Number(f),Number(u||0));window.CityUI?.notify?.(result.text);if(H)panel(H);return;}
     const purchaseLot=e.target.closest('[data-lot-buy]');
     if(purchaseLot){
       if(!selectedLot||purchaseLot.dataset.lotBuy!==selectedLot.id)return;
       const result=window.CitySim?.buyLot?.(selectedLot.id)||{ok:false,text:'Imobiliária indisponível'};
       window.CityUI?.notify?.(result.text);
       if(result.ok)close();else lotPanel(selectedLot);
       return;
     }
     const b=e.target.closest('[data-property-buy]');
     if(b){const H=houses.find(h=>residential(h)&&id(h)===b.dataset.propertyBuy);const result=H?buy(H):{text:'Imóvel indisponível'};window.CityUI?.notify?.(result.text);close();return;}
     const toggle=e.target.closest('[data-garage-toggle]');
     if(toggle){
       const H=houses.find(h=>residential(h)&&id(h)===toggle.dataset.garageToggle);
       const msg=H?.garage?window.CityGarage?.toggle(H.garage,window.__game?.player,15):'Garagem indisponível';
       window.CityUI?.notify(msg||'Garagem indisponível');close();
     }
     const u=e.target.closest('[data-unit-buy]');
     if(u){const [hid,f,n]=u.dataset.unitBuy.split('|'),H=houses.find(h=>multi(h)&&id(h)===hid);if(H){const r=buyUnit(H,+f,+(n||0));window.CityUI?.notify(r.text);panel(H);}return;}
     const leaseAction=e.target.closest('[data-lease-action]');if(leaseAction){const r=leaseAction.dataset.leaseAction==='pay'?payRent():leaseAction.dataset.leaseAction==='auto'?toggleAutoPay():terminateLease();window.CityUI?.notify?.(r.text);const H=selected;if(H)panel(H);return;}
     if(e.target.closest('[data-property-close]'))close();
   });
   window.addEventListener('keydown',e=>{
     if(e.key==='Escape'&&document.getElementById('city-property-dialog')?.hidden===false){e.preventDefault();close();}
   });
 }
 // prédios de apartamentos e hotéis: cada andar acima do térreo tem 2 (ou 4) apartamentos com porta própria no corredor
 // (architecture-organic.js · level.units); o térreo é a portaria (livre). Quem compra/aluga só abre as portas e usa as
 // coisas do próprio apartamento; os outros ficam vazios e trancados. Andar sem divisão = um apartamento só (unidade 0).
 // A unidade 0 mantém a chave antiga (id#andar): contratos e compras salvos antes continuam valendo.
 const MULTI=new Set(['condo','projects','deco']);
 const multi=H=>residential(H)&&!!H?.architecture&&MULTI.has(H.architecture.kind)&&H.architecture.levels.length>1;
 const unitsOn=(H,f)=>{const l=H?.architecture?.levels?.[f];return l?.units?.length?l.units.map(u=>u.id):[0];};
 const unitKey=(H,f,u=0)=>id(H)+'#'+f+(u>0?'-'+u:'');
 const unitLabel=(f,u=0)=>f+String(u+1).padStart(2,'0');
 // u indefinido = qualquer apartamento do andar
 const ownsUnit=(H,f,u)=>!!owned[id(H)]||(u==null?unitsOn(H,f).some(x=>!!owned[unitKey(H,f,x)]):!!owned[unitKey(H,f,u)]);
 const unitRooms=(H,f,u)=>{const l=H?.architecture?.levels?.[f];return l?.units?.find(x=>x.id===u)?.rooms||null;};
 // em que apartamento está um ponto do mundo (null = corredor/área comum)
 function unitAt(H,x,y,f){const l=H?.architecture?.levels?.[f];if(!l?.units)return undefined;const p=H.architecture.toLocal(x,y),r=l.rooms.find(r=>p[0]>r.x0&&p[0]<r.x1&&p[1]>r.y0&&p[1]<r.y1);return r?l.units.find(u=>u.rooms.includes(r.id))?.id??null:null;}
 const ownsAnyUnit=H=>!!owned[id(H)]||Object.keys(owned).some(k=>k.startsWith(id(H)+'#'));
 const gameDay=()=>Math.max(0,Math.floor((window.__game?.st?.clock||window.CitySim?.game?.clock||0)/1440));
 const saveOwned=()=>{try{localStorage.setItem(KEY,JSON.stringify(owned));return true;}catch(_){return false;}};
 function lease(){for(const [key,item] of Object.entries(owned))if(item?.rental&&typeof item.rental==='object'&&Number.isFinite(item.rental.rate))return {key,property:item,...item.rental};return null;}
 const unitRent=(H,f)=>multi(H)?(H.architecture.kind==='projects'?160: H.architecture.kind==='deco'?270:200)+Math.max(0,Math.floor(f)-1)*(H.architecture.kind==='projects'?10:15):0;
 const unitPrice=H=>Math.max(30000,Math.round(price(H)*.85/1000)*1000);
 const units=H=>multi(H)?H.architecture.levels.slice(1).flatMap(l=>unitsOn(H,l.floor).map(u=>{const ids=unitRooms(H,l.floor,u);
   return {floor:l.floor,unit:u,label:unitLabel(l.floor,u),key:unitKey(H,l.floor,u),mine:ownsUnit(H,l.floor,u),rented:!!owned[unitKey(H,l.floor,u)]?.rental,
    rooms:l.rooms.filter(r=>(ids?ids.includes(r.id):r.id!=='hall')&&r.use!=='circulation').length,price:unitPrice(H),rent:unitRent(H,l.floor)};})):[];
 const isOwned=H=>residential(H)&&(multi(H)?ownsAnyUnit(H):!!owned[id(H)]);
 const canFurnish=H=>!residential(H)||isOwned(H)||multi(H);   // prédio: portaria aberta a todos
 // mobília por andar: no prédio, a portaria e as unidades do jogador; na casa, a casa toda se for dele
 const canFurnishLevel=(H,f)=>!residential(H)||(multi(H)?(f===0||ownsUnit(H,f)):isOwned(H))&&!bare(H);
 // andar dividido: mobília de cada apartamento só aparece p/ o dono; corredor (u=null) sempre
 const canFurnishUnit=(H,f,u)=>!residential(H)||(multi(H)?(f===0||u===null||ownsUnit(H,f,u)):isOwned(H))&&!bare(H);
 // usar porta/objeto: imóvel comum só o dono; prédio, a portaria, o corredor (u=null) e o apartamento que é seu
 const canUse=(H,f=0,u)=>!residential(H)||(multi(H)?(f===0||u===null||ownsUnit(H,f,u)):!!owned[id(H)]);
 // casa construída "sem móveis" num terreno (city-lots.js): é do jogador, mas o mobiliário padrão não entra
 const bare=H=>residential(H)&&!!owned[id(H)]?.bare;
 function claim(H,info={}){
   if(!residential(H))return;
   const k=id(H);
   if(!owned[k]){
     owned[k]={id:k,name:info.name||name(H),x:H.doorPt[0],y:H.doorPt[1],price:info.price||0,at:Date.now(),lot:info.lot,bare:!!info.bare};
     try{localStorage.setItem(KEY,JSON.stringify(owned));}catch(_){}
   }
   H.furnishOnPurchase?.();
   window.CityHome?.sync(H);
   window.dispatchEvent(new Event('city-property-change'));
 }
 // sítio (casa de campo): a casa + terreno de 52 × 46 m para lavoura, animais e construções (farm.mjs)
 const isFarm=H=>!!H?.country;
 const price=H=>{
   const area=Math.max(28,(H.x1-H.x0)*(H.y1-H.y0));
   const tier=H.miaKind==='mansion'?620:H.miaKind==='poor'?160:H.tall?530:275;
   return Math.round(area*tier/1000)*1000+(isFarm(H)?85000:0);
 };
 // Novos aluguéis usam exclusivamente apartamentos já existentes nos prédios.
 const rentable=H=>multi(H);
 const name=H=>multi(H)?(H.architecture.kind==='deco'?'Hotel '+(H.hotelName||''):'Edifício residencial').trim():isFarm(H)?'Sítio':H.miaKind==='mansion'?'Mansão':H.tall?'Apartamento':H.miaKind==='poor'?'Casa popular':'Residência';
 function nearby(p,max=2.7){
   if(!p||typeof houses==='undefined')return null;
   let found=null,dist=max;
   for(const H of houses){
     if(!residential(H))continue;
     // The exterior property card must never steal F from an interior door or stair.
     if(H.contains?.(p.x,p.y,p.floor||0))continue;
     const d=Math.hypot(p.x-H.doorPt[0],p.y-H.doorPt[1]);
     if(d<dist){found=H;dist=d;}
   }
   return found;
 }
 // A placa física determina exatamente qual lote está sendo negociado.
 const lotKey=L=>Math.round(L.sign[0])+'-'+Math.round(L.sign[1]);
 const ownedLot=L=>!!window.CitySim?.data?.ownedLots?.some(o=>o.id===L.id||o.key===lotKey(L));
 const lotsNearby=(p,limit=4.5)=>{
   if(!p||p.floor>0||window.cityVehicles?.driver)return [];
   return (world.lotsForSale||[]).filter(L=>L?.sign&&L.q?.length===4&&Number.isFinite(L.price)&&
     Math.hypot(L.sign[0]-p.x,L.sign[1]-p.y)<=limit&&!window.CityLots?.buildOf(L.id))
     .sort((a,b)=>Math.hypot(a.sign[0]-p.x,a.sign[1]-p.y)-Math.hypot(b.sign[0]-p.x,b.sign[1]-p.y));
 };
 const nearbyLot=(p,limit=4.5)=>lotsNearby(p,limit)[0]||null;
 function lotPanel(L){
   if(!L||!(world.lotsForSale||[]).some(l=>l.id===L.id))return false;
   selectedLot=L;selected=null;
   window.CityUI?.togglePhone?.(false);
   const size={w:Math.hypot(L.q[1][0]-L.q[0][0],L.q[1][1]-L.q[0][1]),
     d:Math.hypot(L.q[3][0]-L.q[0][0],L.q[3][1]-L.q[0][1])};
   const mine=ownedLot(L),money=CityLife.money,coords=Math.round(L.sign[0])+', '+Math.round(L.sign[1]);
   let el=document.getElementById('city-property-dialog');
   if(!el){el=document.createElement('div');el.id='city-property-dialog';document.body.appendChild(el);}
   el.innerHTML='<div class="city-property-card" role="dialog" aria-label="Comprar terreno selecionado">'+
     '<button data-property-close class="city-property-close" aria-label="Fechar">✕</button>'+
     '<span class="city-property-eyebrow">CASACERTA · VENDA PRESENCIAL</span>'+
     '<h2>🏡 TERRENO À VENDA</h2>'+
     '<p style="color:#f0c761">📍 Esta é a propriedade da placa em que você está, destacada em amarelo no chão.</p>'+
     '<p><strong>Identificação:</strong> '+lotKey(L)+'</p>'+
     '<p><strong>Localização:</strong> '+coords+'</p>'+
     '<p><strong>Medidas:</strong> '+Math.round(size.w)+' × '+Math.round(size.d)+' metros</p>'+
     '<p><strong>Área:</strong> '+Math.round(L.area)+' m² · <strong>Zona:</strong> '+(L.zone||'Residencial')+'</p>'+
     '<div class="city-property-value">'+money(L.price)+'</div>'+
     (mine?'<p style="color:#8ee2af">✓ Você já é proprietário deste terreno. Abra CasaCerta para construir.</p>':
       '<p>A compra será registrada para este terreno específico, não para outro lote próximo.</p>'+
       '<button class="city-property-confirm" data-lot-buy="'+L.id+'" '+(CityLife.funds<L.price?'disabled':'')+'>Comprar este terreno · '+money(L.price)+'</button>')+
     '<button data-property-close class="city-property-secondary">Voltar ao jogo</button></div>';
   el.hidden=false;document.body.classList.add('city-property-open');return true;
 }
 function lotAtScreen(px,py,project,p){
   if(!p||p.floor>0||typeof project!=='function')return null;
   const nearby=lotsNearby(p,4.5);
   let best=null,dist=Infinity;
   for(const lot of nearby){
     const a=project(lot.sign[0],lot.sign[1],1.5);
     const d=Math.hypot(px-a.x,py-a.y);
     if(d<Math.max(18,(typeof cam!=='undefined'?cam.zoom:30)*1.25)&&d<dist){dist=d;best=lot;}
   }
   return best;
 }
 function clickLot(px,py,project,p){
   const L=lotAtScreen(px,py,project,p);
   return L?lotPanel(L):false;
 }
 function drawLotSelection(ctx,project,p){
   const L=selectedLot||nearbyLot(p,4.5);
   if(!L||!L.q||!ctx||typeof project!=='function')return;
   const pts=L.q.map(q=>project(q[0],q[1],.045));
   ctx.save();
   ctx.beginPath();pts.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y));ctx.closePath();
   ctx.fillStyle='rgba(250,190,58,0.13)';ctx.fill();
   ctx.strokeStyle='#ffcf40';ctx.lineWidth=3;
   ctx.setLineDash([11,6]);ctx.stroke();ctx.setLineDash([]);
   const label=project(L.sign[0],L.sign[1],2.9);
   ctx.font='bold 14px Arial';ctx.textAlign='center';
   ctx.lineWidth=3;ctx.strokeStyle='#101820';
   const message=ownedLot(L)?'✓ MEU TERRENO':'🏷 TERRENO À VENDA';
   ctx.strokeText(message,label.x,label.y-7);ctx.fillStyle='#ffdb6b';ctx.fillText(message,label.x,label.y-7);
   ctx.restore();
 }
 function panel(H){
   window.CityUI?.togglePhone?.(false);
   selected=H;selectedLot=null;close(false);
   let el=document.getElementById('city-property-dialog');
   if(!el){el=document.createElement('div');el.id='city-property-dialog';document.body.appendChild(el);}
   if(multi(H))return unitsPanel(H,el);
   const mine=isOwned(H),cost=price(H);
   el.innerHTML='<div class="city-property-card" role="dialog" aria-label="Informações do imóvel">'+
     '<button data-property-close class="city-property-close" aria-label="Fechar">✕</button>'+
     '<span class="city-property-eyebrow">CASACERTA · IMÓVEL</span>'+
     '<h2>🏠 '+name(H)+'</h2><p>Localização: '+Math.round(H.doorPt[0])+', '+Math.round(H.doorPt[1])+'</p>'+
     '<p>Área construída: '+Math.round((H.x1-H.x0)*(H.y1-H.y0))+' m²</p>'+(isFarm(H)?'<p>🚜 Terreno de 52 × 46 m: lavoura, galinheiro, curral, silo, galpão e caixa da cooperativa. Use o app Fazenda.</p>':'')+
     '<div class="city-property-value">'+(mine?(owned[id(H)]?.rental?'Seu imóvel alugado':'Sua propriedade'):CityLife.money(cost))+'</div>'+
     (mine?'<p>Este imóvel está disponível para você e aparece no mapa. Entre na casa e use F7 para decorar e comprar móveis.</p>'+(H.garage?'<button class="city-property-confirm" data-garage-toggle="'+id(H)+'">🚘 '+(H.garage.seg.doorAnim.target>.5?'Fechar':'Abrir')+' garagem</button>':''):
       '<p>Confirme a compra para usar este imóvel e decorar seu interior. Para alugar, visite a portaria de um prédio residencial.</p><button data-property-buy="'+id(H)+'" '+(CityLife.funds<cost?'disabled':'')+' class="city-property-confirm">Comprar imóvel</button>')+
     '<button data-property-close class="city-property-secondary">Voltar ao jogo</button></div>';
   el.hidden=false;
   document.body.classList.add('city-property-open');
   el.querySelector('[data-property-close]')?.focus();
   return true;
 }
 // painel do prédio: lista as unidades (uma por andar), quem é dono e o preço de cada
 function unitsPanel(H,el){
   const list=units(H),hotel=H.architecture.kind==='deco',currentLease=lease();
   const money=n=>CityLife.money(n);
   el.innerHTML='<div class="city-property-card" style="max-width:540px;width:min(100%,540px);max-height:86vh;overflow:auto" role="dialog" aria-label="Apartamentos do prédio">'+
    '<button data-property-close class="city-property-close" aria-label="Fechar">✕</button>'+
    '<span class="city-property-eyebrow">CASACERTA · '+(hotel?'HOTEL':'PRÉDIO RESIDENCIAL')+'</span><h2>🏢 '+name(H)+'</h2>'+
    '<p>'+list.length+' apartamentos · portaria e corredores públicos · cada apartamento tem porta própria e só o morador entra. Aluguel cobrado a cada '+RENT_DAYS+' dias de jogo.</p>'+
    list.map(u=>'<div style="margin:9px 0;padding:12px;border:1px solid #ffffff26;border-radius:12px;background:#ffffff0a">'+
      '<strong>'+(hotel?'Suíte ':'Apto ')+u.label+' · '+u.floor+'º andar</strong> · '+u.rooms+' cômodos'+
      '<p style="margin:5px 0 8px;color:#b9c8d0">Venda '+money(u.price)+' · Aluguel '+money(u.rent)+' / '+RENT_DAYS+' dias de jogo</p>'+
      (u.mine?'<p style="color:#80e5b0">'+(u.rented?'🔑 Seu apartamento alugado':'✓ Seu apartamento comprado')+'</p>':
       '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="city-property-confirm" style="width:auto;margin:0;padding:9px 12px" data-unit-rent="'+id(H)+'|'+u.floor+'|'+u.unit+'" '+(currentLease||CityLife.funds<u.rent?'disabled':'')+'>Alugar · '+money(u.rent)+'</button>'+
       '<button class="city-property-confirm" style="width:auto;margin:0;padding:9px 12px" data-unit-buy="'+id(H)+'|'+u.floor+'|'+u.unit+'" '+(CityLife.funds<u.price?'disabled':'')+'>Comprar · '+money(u.price)+'</button></div>')+
      (u.rented?'<button class="city-property-secondary" style="margin-top:6px" data-unit-buy="'+id(H)+'|'+u.floor+'|'+u.unit+'" '+(CityLife.funds<u.price?'disabled':'')+'>Comprar este apartamento alugado</button>':'')+
      '</div>').join('')+
    (currentLease&&list.some(u=>u.key===currentLease.key)?leasePanel(currentLease):'')+
    '<button data-property-close class="city-property-secondary">Voltar ao jogo</button></div>';
   el.hidden=false;document.body.classList.add('city-property-open');return true;
 }
 function leasePanel(contract){
   const c=contract,late=c.arrears||0,rate=c.rate,days=Math.max(0,c.nextDueDay-gameDay()),money=n=>CityLife.money(n);
   return '<div style="border:1px solid #8bd4ae77;padding:12px;border-radius:12px;margin-top:14px"><h3>🔑 Meu contrato de aluguel</h3>'+
    '<p>Aluguel '+money(rate)+' / '+RENT_DAYS+' dias de jogo · Próximo vencimento em '+days+' dia(s)</p>'+
    (late?'<p style="color:#ffc68e">Pendência: '+money(late)+' · regularize antes do vencimento de mais parcelas.</p>':'<p>Contrato em dia · sem pendências.</p>')+
    '<p>Pagamento automático: '+(c.autoPay?'Ativado':'Desativado')+'</p>'+
    '<button class="city-property-confirm" data-lease-action="pay">'+(late?'Quitar pendências':'Adiantar próximo aluguel')+'</button>'+
    '<button class="city-property-secondary" data-lease-action="auto">Alternar pagamento automático</button>'+
    '<button class="city-property-secondary" data-lease-action="end">Encerrar contrato</button></div>';
 }
 function setPrimary(H,f,pricePaid,rental=false,u=0){
   const itemKey=f>0?unitKey(H,f,u):id(H);
   if(window.CitySim?.data){
     window.CitySim.data.home={name:(rental?'Aluguel · ':'')+(f>0?'Apto '+unitLabel(f,u)+' · ':'')+name(H),x:H.doorPt[0],y:H.doorPt[1],price:pricePaid,propertyKey:itemKey,floor:f,unit:u,rental:!!rental};
     window.CitySim.save();
   }
   window.dispatchEvent(new Event('city-property-change'));
 }
 function buyUnit(H,f,u=0){
   if(!multi(H)||!units(H).some(x=>x.floor===f&&x.unit===u))return {ok:false,text:'Apartamento indisponível'};
   const k=unitKey(H,f,u),existing=owned[k],buyingLease=!!existing?.rental;
   if(ownsUnit(H,f,u)&&!buyingLease)return {ok:false,text:'Este apartamento já é seu'};
   if(buyingLease&&existing.rental.arrears>0)return {ok:false,text:'Quite os aluguéis atrasados antes de comprar a unidade'};
   const cost=unitPrice(H),label='Apto '+unitLabel(f,u)+' · '+name(H);
   if(!CityLife.debit(cost,'Compra · '+label))return {ok:false,text:'Saldo insuficiente'};
   const old=existing;
   owned[k]={id:k,name:label,x:H.doorPt[0],y:H.doorPt[1],price:cost,at:Date.now(),floor:f,unit:u,building:id(H)};
   if(!saveOwned()){if(old)owned[k]=old;else delete owned[k];CityLife.credit(cost,'Estorno · '+label);return {ok:false,text:'Falha ao salvar compra; valor devolvido'};}
   H.furnishOnPurchase?.();window.CityHome?.sync(H);setPrimary(H,f,cost,false,u);
   return {ok:true,text:'🔑 '+label+' comprado! Seu contrato de aluguel foi encerrado, se existia.'};
 }
 function rentUnit(H,f,u=0){
   const p=window.__game?.player;
   if(!multi(H)||!units(H).some(x=>x.floor===f&&x.unit===u)||!p||Math.hypot(p.x-H.doorPt[0],p.y-H.doorPt[1])>4)
     return {ok:false,text:'Vá até a portaria de um prédio residencial e selecione um apartamento disponível'};
   const k=unitKey(H,f,u),rate=unitRent(H,f),label=unitLabel(f,u);
   if(ownsUnit(H,f,u))return {ok:false,text:'Apartamento indisponível ou já registrado para você'};
   if(lease())return {ok:false,text:'Você já possui um aluguel ativo. Encerre-o antes de alugar outro apartamento'};
   if(!CityLife.debit(rate,'Primeiro aluguel · Apto '+label))return {ok:false,text:'Saldo insuficiente para a primeira parcela do aluguel'};
   owned[k]={id:k,name:'Apto '+label+' · '+name(H),x:H.doorPt[0],y:H.doorPt[1],price:rate,at:Date.now(),floor:f,unit:u,building:id(H),
     rental:{rate,interval:RENT_DAYS,nextDueDay:gameDay()+RENT_DAYS,arrears:0,autoPay:true}};
   if(!saveOwned()){delete owned[k];CityLife.credit(rate,'Estorno · primeiro aluguel');return {ok:false,text:'Falha ao salvar contrato; valor devolvido'};}
   H.furnishOnPurchase?.();window.CityHome?.sync(H);setPrimary(H,f,rate,true,u);
   window.CityAdventures?.signal?.('home');
   return {ok:true,text:'🔑 Apto '+label+' alugado por '+CityLife.money(rate)+'! Suba pela escada ao '+f+'º andar. Próxima cobrança em '+RENT_DAYS+' dias de jogo'};
 }
 function rentNearbyApartment(){
   const p=window.__game?.player,H=nearby(p,4);
   if(!multi(H))return {ok:false,text:'Aproxime-se da portaria de um prédio residencial e pressione F para escolher um apartamento'};
   panel(H);
   return {ok:true,text:'Escolha o apartamento e o andar no painel da portaria de '+name(H)};
 }
 function payRent(){
   const c=lease();if(!c)return {ok:false,text:'Você não possui um contrato de aluguel ativo'};
   const amount=c.arrears>0?c.arrears:c.rate;
   if(!CityLife.debit(amount,'Aluguel · '+c.property.name))return {ok:false,text:'Saldo insuficiente para pagar '+CityLife.money(amount)};
   const old={...c.property.rental};
   if(c.arrears>0)c.property.rental.arrears=0;
   else c.property.rental.nextDueDay+=RENT_DAYS;
   if(!saveOwned()){c.property.rental=old;CityLife.credit(amount,'Estorno de aluguel');return {ok:false,text:'Não foi possível salvar o pagamento'};}
   window.dispatchEvent(new Event('city-property-change'));
   return {ok:true,text:c.arrears>0?'Pendência de aluguel quitada':'Próximo período de aluguel pago antecipadamente'};
 }
 function toggleAutoPay(){
   const c=lease();if(!c)return {ok:false,text:'Sem contrato de aluguel'};
   c.property.rental.autoPay=!c.autoPay;
   if(!saveOwned()){c.property.rental.autoPay=c.autoPay;return {ok:false,text:'Não foi possível salvar a opção de pagamento'};}
   return {ok:true,text:'Pagamento automático '+(c.property.rental.autoPay?'ativado':'desativado')};
 }
 function clearLease(c){
   const old=owned[c.key];delete owned[c.key];
   if(!saveOwned()){owned[c.key]=old;return false;}
   const home=window.CitySim?.data?.home;
   if(home&&(home.propertyKey===c.key||(!home.propertyKey&&home.rental&&Math.hypot(home.x-old.x,home.y-old.y)<2))){
     window.CitySim.data.home=null;window.CitySim.save();
   }
   window.dispatchEvent(new Event('city-property-change'));
   return true;
 }
 function terminateLease(){
   const c=lease();if(!c)return {ok:false,text:'Não há contrato para encerrar'};
   if(c.arrears>0)return {ok:false,text:'Quite os pagamentos atrasados antes de entregar as chaves'};
   if(insideRentedUnit(c))return {ok:false,text:'Saia do apartamento antes de encerrar o contrato'};
   if(!clearLease(c))return {ok:false,text:'Não foi possível registrar o encerramento do contrato'};
   return {ok:true,text:'Contrato encerrado. As chaves foram devolvidas e o apartamento voltou a ficar disponível'};
 }
 function insideRentedUnit(c){
   const p=window.__game?.player;
   if(!p||!(p.floor>0)||p.floor!==c.property.floor)return false;
   const H=window.__game?.houses?.find(h=>multi(h)&&id(h)===c.property.building);
   if(H&&H.architecture?.levels?.[p.floor]?.units&&c.property.unit!=null)return unitAt(H,p.x,p.y,p.floor)===c.property.unit;   // andar dividido: dentro do próprio apto
   return !H||H.contains?.(p.x,p.y,p.floor)!==false;
 }
 let lastRentalClock=-1;
 function tick(clock){
   const day=Math.floor(Number(clock)/1440);
   if(!Number.isInteger(day)||day<0)return;
   if(day!==lastRentalClock){
     lastRentalClock=day;
     for(const v of Object.values(owned)){
       const c=v?.rental;if(!c||typeof c!=='object'||!Number.isFinite(c.rate))continue;
       if(!Number.isFinite(c.nextDueDay)){c.nextDueDay=day+RENT_DAYS;saveOwned();continue;}
       if(day<c.nextDueDay)continue;
       const old={...c},cycles=Math.floor((day-c.nextDueDay)/RENT_DAYS)+1,amount=cycles*c.rate;
       c.nextDueDay+=cycles*RENT_DAYS;
       const paid=!!(c.autoPay&&c.arrears===0&&CityLife.debit(amount,'Aluguel automático · '+v.name));
       if(!paid)c.arrears=(c.arrears||0)+amount;
       if(!saveOwned()){
         Object.assign(c,old);
         if(paid)CityLife.credit(amount,'Estorno · aluguel não salvo');
         continue;
       }
       window.CityUI?.notify?.(paid?'🏠 Aluguel de '+v.name+' pago: '+CityLife.money(amount):
         '⚠️ Aluguel pendente: '+CityLife.money(c.arrears)+' · CasaCerta');
     }
   }
   const c=lease();
   if(c&&c.arrears>=MAX_ARREARS*c.rate&&!insideRentedUnit(c)){
     if(clearLease(c))window.CityUI?.notify?.('⚠️ Contrato encerrado após três parcelas de aluguel em atraso. Você perdeu o acesso ao apartamento.');
   }
 }
 function close(clear=true){const el=document.getElementById('city-property-dialog');if(el)el.hidden=true;document.body.classList.remove('city-property-open');if(clear){selected=null;selectedLot=null;}}
 function rentStarter(){return rentNearbyApartment();}
 function buy(H){
   if(!residential(H)||isOwned(H))return {ok:false,text:'Imóvel indisponível'};
   const cost=price(H);
   if(!CityLife.debit(cost,'Compra de imóvel · '+name(H)))return {ok:false,text:'Saldo insuficiente'};
   owned[id(H)]={id:id(H),name:name(H),x:H.doorPt[0],y:H.doorPt[1],price:cost,at:Date.now()};
   try{localStorage.setItem(KEY,JSON.stringify(owned));}catch(_){}
   if(typeof H.furnishOnPurchase==='function')H.furnishOnPurchase();
   window.CityHome?.sync(H);
   if(typeof CitySim!=='undefined'&&CitySim.data){
     CitySim.data.home={name:name(H),x:H.front?.[0]??H.doorPt[0],y:H.front?.[1]??H.doorPt[1],price:cost};
     CitySim.save();
   }
   window.dispatchEvent(new Event('city-property-change'));
   window.CityUI?.notify('🏠 Imóvel adquirido! Marcado no mapa.');
   return {ok:true,text:'Imóvel adquirido'};
 }
 // Only the authorized admin panel calls this local testing helper.
 // The browser's localStorage remains non-authoritative for future multiplayer.
 function adminSetOwned(H,shouldOwn){
   if(!window.CityAdmin?.authorized)return {ok:false,text:'Acesso administrativo necessário'};
   if(!residential(H))return {ok:false,text:'Somente imóveis residenciais'};
   const key=id(H),was=!!owned[key],next=!!shouldOwn;
   if(was===next)return {ok:true,text:next?'Já pertence ao jogador':'Imóvel já está livre'};
   if(next){
     owned[key]={id:key,name:name(H),x:H.doorPt[0],y:H.doorPt[1],price:0,at:Date.now(),adminGranted:true};
     H.furnishOnPurchase?.();
     window.CityHome?.sync(H);
   }else delete owned[key];
   try{localStorage.setItem(KEY,JSON.stringify(owned));}
   catch{return {ok:false,text:'Falha ao salvar alteração local'};}
   if(typeof CitySim!=='undefined'&&CitySim.data){
     if(next)CitySim.data.home={name:name(H),x:H.doorPt[0],y:H.doorPt[1],price:0};
     else if(CitySim.data.home&&Math.hypot(CitySim.data.home.x-H.doorPt[0],CitySim.data.home.y-H.doorPt[1])<2)CitySim.data.home=null;
     CitySim.save();
   }
   window.dispatchEvent(new Event('city-property-change'));
   return {ok:true,text:next?'Posse de teste concedida':'Posse de teste removida'};
 }
 function onInteract(p){
   const H=nearby(p),L=nearbyLot(p);
   const dh=H?Math.hypot(H.doorPt[0]-p.x,H.doorPt[1]-p.y):Infinity;
   const dl=L?Math.hypot(L.sign[0]-p.x,L.sign[1]-p.y):Infinity;
   if(L&&dl<dh+.15)return lotPanel(L);
   if(!H)return false;
   return panel(H);
 }
 function prompt(p){
   const H=nearby(p),L=nearbyLot(p);
   const dh=H?Math.hypot(H.doorPt[0]-p.x,H.doorPt[1]-p.y):Infinity;
   const dl=L?Math.hypot(L.sign[0]-p.x,L.sign[1]-p.y):Infinity;
   if(L&&dl<dh+.15)return 'F ou clique na placa · '+(ownedLot(L)?'Meu terreno':'Comprar terreno '+Math.round(L.area)+' m² · '+CityLife.money(L.price));
   if(H&&multi(H))return 'F · '+name(H)+' · apartamentos para alugar ou comprar';
   return H?'F · '+(isOwned(H)?'Ver minha residência':'Consultar '+name(H)+' à venda · '+CityLife.money(price(H))):'';
 }
 return {init,residential,isOwned,canFurnish,canFurnishLevel,canFurnishUnit,canUse,unitAt,unitKey,multi,units,ownsUnit,buyUnit,unitPrice,bare,claim,nearby,nearbyLot,lotPanel,clickLot,drawLotSelection,onInteract,prompt,buy,rentStarter,rentUnit,rentNearbyApartment,unitRent,lease,payRent,toggleAutoPay,terminateLease,tick,adminSetOwned,id,price,name,close,
  get dialogOpen(){return document.getElementById('city-property-dialog')?.hidden===false;},
  get owned(){return owned;}};
})();
window.CityRealty=CityRealty;
