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
     const b=e.target.closest('[data-property-buy]');
     if(b){const H=houses.find(h=>residential(h)&&id(h)===b.dataset.propertyBuy);if(H) buy(H);close();}
     const toggle=e.target.closest('[data-garage-toggle]');
     if(toggle){
       const H=houses.find(h=>residential(h)&&id(h)===toggle.dataset.garageToggle);
       const msg=H?.garage?window.CityGarage?.toggle(H.garage,window.__game?.player,15):'Garagem indisponível';
       window.CityUI?.notify(msg||'Garagem indisponível');close();
     }
     if(e.target.closest('[data-property-close]'))close();
   });
   window.addEventListener('keydown',e=>{
     if(e.key==='Escape'&&document.getElementById('city-property-dialog')?.hidden===false){e.preventDefault();close();}
   });
 }
 const isOwned=H=>residential(H)&&!!owned[id(H)];
 const canFurnish=H=>!residential(H)||isOwned(H);
 const price=H=>{
   const area=Math.max(28,(H.x1-H.x0)*(H.y1-H.y0));
   const tier=H.miaKind==='mansion'?620:H.miaKind==='poor'?160:H.tall?530:275;
   return Math.round(area*tier/1000)*1000;
 };
 const name=H=>H.miaKind==='mansion'?'Mansão':H.tall?'Apartamento':H.miaKind==='poor'?'Casa popular':'Residência';
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
   const mine=isOwned(H),cost=price(H);
   el.innerHTML='<div class="city-property-card" role="dialog" aria-label="Informações do imóvel">'+
     '<button data-property-close class="city-property-close" aria-label="Fechar">✕</button>'+
     '<span class="city-property-eyebrow">CASACERTA · IMÓVEL</span>'+
     '<h2>🏠 '+name(H)+'</h2><p>Localização: '+Math.round(H.doorPt[0])+', '+Math.round(H.doorPt[1])+'</p>'+
     '<p>Área construída: '+Math.round((H.x1-H.x0)*(H.y1-H.y0))+' m²</p>'+
     '<div class="city-property-value">'+(mine?'Sua propriedade':CityLife.money(cost))+'</div>'+
     (mine?'<p>Este imóvel já pertence ao personagem e aparece no mapa. Entre na casa e use F7 para decorar e comprar móveis.</p>'+(H.garage?'<button class="city-property-confirm" data-garage-toggle="'+id(H)+'">🚘 '+(H.garage.seg.doorAnim.target>.5?'Fechar':'Abrir')+' garagem</button>':''):
       '<p>Confirme a compra para usar este imóvel e decorar seu interior.</p><button data-property-buy="'+id(H)+'" '+(CityLife.funds<cost?'disabled':'')+' class="city-property-confirm">Comprar imóvel</button>')+
     '<button data-property-close class="city-property-secondary">Voltar ao jogo</button></div>';
   el.hidden=false;
   document.body.classList.add('city-property-open');
   el.querySelector('[data-property-close]')?.focus();
   return true;
 }
 function close(clear=true){const el=document.getElementById('city-property-dialog');if(el)el.hidden=true;document.body.classList.remove('city-property-open');if(clear)selected=null;}
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
 function prompt(p){const H=nearby(p);return H?'F · '+(isOwned(H)?'Ver minha propriedade':'Consultar '+name(H)+' à venda · '+CityLife.money(price(H))):'';}
 return {init,residential,isOwned,canFurnish,nearby,onInteract,prompt,buy,adminSetOwned,id,price,name,close,
  get dialogOpen(){return document.getElementById('city-property-dialog')?.hidden===false;},
  get owned(){return owned;}};
})();
window.CityRealty=CityRealty;
