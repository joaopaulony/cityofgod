// CityRealty: propriedades baseadas nas portas reais, sem índices globais de setor.
'use strict';
const CityRealty=(()=>{
 const KEY='cityofgod.owned-homes.v1';
 let owned={};let started=false,selected=null;
 const id=H=>Math.round(H.doorPt?.[0]??H.x0)+'_'+Math.round(H.doorPt?.[1]??H.y0)+'_'+Math.round(H.x1-H.x0)+'x'+Math.round(H.y1-H.y0);
 const residential=H=>!!H?.doorPt&&!H.civic&&!H.terminal&&!H.brick&&!['cafe','shop','store','hospital','office','hotel','commercial','public'].includes(H.miaKind);
 function init(){
   if(started)return;started=true;
   try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');if(x&&typeof x==='object'&&!Array.isArray(x)) owned=x;}catch(_){}
   document.addEventListener('click',e=>{
     const r=e.target.closest('[data-property-rent]');
     if(r){const H=houses.find(h=>residential(h)&&id(h)===r.dataset.propertyRent);const result=rentStarter(H);window.CityUI?.notify?.(result.text);close();}
     const b=e.target.closest('[data-property-buy]');
     if(b){const H=houses.find(h=>residential(h)&&id(h)===b.dataset.propertyBuy);if(H) buy(H);close();}
     const toggle=e.target.closest('[data-garage-toggle]');
     if(toggle){
       const H=houses.find(h=>residential(h)&&id(h)===toggle.dataset.garageToggle);
       const msg=H?.garage?window.CityGarage?.toggle(H.garage,window.__game?.player,15):'Garagem indisponível';
       window.CityUI?.notify(msg||'Garagem indisponível');close();
     }
     const u=e.target.closest('[data-unit-buy]');
     if(u){const [hid,f]=u.dataset.unitBuy.split('|'),H=houses.find(h=>residential(h)&&id(h)===hid);if(H){const r=buyUnit(H,+f);window.CityUI?.notify(r.text);panel(H);}}
     if(e.target.closest('[data-property-close]'))close();
   });
   window.addEventListener('keydown',e=>{
     if(e.key==='Escape'&&document.getElementById('city-property-dialog')?.hidden===false){e.preventDefault();close();}
   });
 }
 // prédios de apartamentos e hotéis: cada andar acima do térreo é uma unidade à venda; o térreo é a portaria (livre).
 // Quem compra uma unidade só abre portas e usa coisas no próprio andar; as outras ficam vazias e trancadas
 const MULTI=new Set(['condo','projects','deco']);
 const multi=H=>residential(H)&&!!H?.architecture&&MULTI.has(H.architecture.kind)&&H.architecture.levels.length>1;
 const unitKey=(H,f)=>id(H)+'#'+f;
 const ownsUnit=(H,f)=>!!owned[id(H)]||!!owned[unitKey(H,f)];
 const ownsAnyUnit=H=>!!owned[id(H)]||Object.keys(owned).some(k=>k.startsWith(id(H)+'#'));
 const unitPrice=H=>Math.max(30000,Math.round(price(H)*.85/1000)*1000);
 const units=H=>multi(H)?H.architecture.levels.slice(1).map(l=>({floor:l.floor,key:unitKey(H,l.floor),mine:ownsUnit(H,l.floor),rooms:l.rooms.filter(r=>r.id!=='hall'&&r.use!=='circulation').length,price:unitPrice(H)})):[];
 const isOwned=H=>residential(H)&&(multi(H)?ownsAnyUnit(H):!!owned[id(H)]);
 const canFurnish=H=>!residential(H)||isOwned(H)||multi(H);   // prédio: portaria aberta a todos
 // mobília por andar: no prédio, a portaria e as unidades do jogador; na casa, a casa toda se for dele
 const canFurnishLevel=(H,f)=>!residential(H)||(multi(H)?(f===0||ownsUnit(H,f)):isOwned(H))&&!bare(H);
 // usar porta/objeto: imóvel comum só o dono; prédio, a portaria e o andar que é seu
 const canUse=(H,f=0)=>!residential(H)||(multi(H)?(f===0||ownsUnit(H,f)):!!owned[id(H)]);
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
 const rentable=H=>residential(H)&&!multi(H)&&!isFarm(H)&&H.miaKind!=='mansion'&&!H.tall&&price(H)<=120000;
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
 function panel(H){
   window.CityUI?.togglePhone?.(false);
   selected=H;close(false);
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
       '<p>Confirme a compra para usar este imóvel e decorar seu interior.</p><button data-property-buy="'+id(H)+'" '+(CityLife.funds<cost?'disabled':'')+' class="city-property-confirm">Comprar imóvel</button>'+(rentable(H)?'<button data-property-rent="'+id(H)+'" '+(CityLife.funds<160?'disabled':'')+' class="city-property-secondary">Alugar por R$ 160 (moradia física)</button>':''))+
     '<button data-property-close class="city-property-secondary">Voltar ao jogo</button></div>';
   el.hidden=false;
   document.body.classList.add('city-property-open');
   el.querySelector('[data-property-close]')?.focus();
   return true;
 }
 // painel do prédio: lista as unidades (uma por andar), quem é dono e o preço de cada
 function unitsPanel(H,el){
   const list=units(H),hotel=H.architecture.kind==='deco';
   el.innerHTML='<div class="city-property-card" style="max-width:520px;width:min(100%,520px);max-height:86vh;overflow:auto" role="dialog" aria-label="Unidades do prédio">'+
     '<button data-property-close class="city-property-close" aria-label="Fechar">✕</button>'+
     '<span class="city-property-eyebrow">CASACERTA · '+(hotel?'HOTEL':'EDIFÍCIO')+'</span><h2>🏢 '+name(H)+'</h2>'+
     '<p>'+list.length+' '+(hotel?'suítes':'apartamentos')+' · um por andar. A portaria é livre; cada unidade só abre para o dono — as outras ficam trancadas e você não entra nem vê os móveis de ninguém.</p>'+
     list.map(u=>'<div style="display:flex;align-items:center;gap:10px;margin:8px 0;padding:10px 12px;border-radius:13px;background:#ffffff10"><div style="flex:1"><strong>'+(hotel?'Suíte ':'Apto ')+u.floor+'01 · '+u.floor+'º andar</strong><br><small style="color:#9fb4c4">'+u.rooms+' cômodos · mobiliado na compra</small></div>'+
       (u.mine?'<b style="color:#6ff5c7">Sua unidade</b>':'<button class="city-property-confirm" style="width:auto;margin:0;padding:9px 12px" data-unit-buy="'+id(H)+'|'+u.floor+'" '+(CityLife.funds<u.price?'disabled':'')+'>Comprar '+CityLife.money(u.price)+'</button>')+'</div>').join('')+
     '<button data-property-close class="city-property-secondary">Voltar ao jogo</button></div>';
   el.hidden=false;document.body.classList.add('city-property-open');return true;
 }
 function buyUnit(H,f){
   if(!multi(H)||!(f>0)||f>=H.architecture.levels.length||ownsUnit(H,f))return {ok:false,text:'Unidade indisponível'};
   const cost=unitPrice(H),label=(H.architecture.kind==='deco'?'Suíte ':'Apto ')+f+'01 · '+name(H);
   if(!CityLife.debit(cost,'Compra · '+label))return {ok:false,text:'Saldo insuficiente'};
   const k=unitKey(H,f);owned[k]={id:k,name:label,x:H.doorPt[0],y:H.doorPt[1],price:cost,at:Date.now(),floor:f,building:id(H)};
   try{localStorage.setItem(KEY,JSON.stringify(owned));}catch(_){}
   H.furnishOnPurchase?.();window.CityHome?.sync(H);
   if(typeof CitySim!=='undefined'&&CitySim.data){CitySim.data.home={name:label,x:H.front?.[0]??H.doorPt[0],y:H.front?.[1]??H.doorPt[1],price:cost};CitySim.save();}
   window.dispatchEvent(new Event('city-property-change'));
   return {ok:true,text:'🔑 '+label+' é sua! Suba pela escada até o '+f+'º andar.'};
 }
 function close(clear=true){const el=document.getElementById('city-property-dialog');if(el)el.hidden=true;document.body.classList.remove('city-property-open');if(clear)selected=null;}
 function rentStarter(H=null){
   const p=window.__game?.player;
   if(!H)H=nearby(p,4);
   if(!H||!rentable(H)||isOwned(H)||!p||Math.hypot(p.x-H.doorPt[0],p.y-H.doorPt[1])>4)
     return {ok:false,text:'Aproxime-se da entrada de uma casa residencial disponível para alugar por R$ 160.'};
   if(window.CitySim?.data?.home)return {ok:false,text:'Você já tem uma residência cadastrada.'};
   if(!CityLife.debit(160,'Entrada de aluguel · '+name(H)))return {ok:false,text:'É preciso R$ 160 para alugar.'};
   const k=id(H);
   owned[k]={id:k,name:name(H),x:H.doorPt[0],y:H.doorPt[1],price:160,at:Date.now(),rental:true};
   try{localStorage.setItem(KEY,JSON.stringify(owned));}catch(_){}
   H.furnishOnPurchase?.();
   window.CityHome?.sync(H);
   if(window.CitySim?.data){window.CitySim.data.home={name:'Aluguel · '+name(H),x:H.doorPt[0],y:H.doorPt[1],price:160,rental:true};window.CitySim.save();}
   window.CityAdventures?.signal?.('home');
   window.dispatchEvent(new Event('city-property-change'));
   return {ok:true,text:'🔑 Casa alugada! Agora você pode entrar e usar os móveis e a decoração.'};
 }
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
   const H=nearby(p);
   if(!H)return false;
   panel(H);return true;
 }
 function prompt(p){const H=nearby(p);if(H&&multi(H))return 'F · '+name(H)+' · '+units(H).filter(u=>!u.mine).length+' unidades à venda';return H?'F · '+(isOwned(H)?'Ver minha residência':'Consultar '+name(H)+(rentable(H)?' · comprar ou alugar':' à venda')+' · '+CityLife.money(price(H))):'';}
 return {init,residential,isOwned,canFurnish,canFurnishLevel,canUse,multi,units,ownsUnit,buyUnit,unitPrice,bare,claim,nearby,onInteract,prompt,buy,rentStarter,adminSetOwned,id,price,name,close,
  get dialogOpen(){return document.getElementById('city-property-dialog')?.hidden===false;},
  get owned(){return owned;}};
})();
window.CityRealty=CityRealty;
