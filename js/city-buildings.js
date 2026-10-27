// Each condominium floor exposes separately owned left and right homes;
// local persistence is not a multiplayer ownership or presence server.
(function(root){
'use strict';
const KEY='cityofgod.units.v1',DECOR='cityofgod.unit-decor.v1',owned={},decor={};
let ready=false,current=null,selectedUnit=null,paint='#c8b4a2';
const colors=['#c8b4a2','#708e9f','#a97964','#688e73','#d4d8dd','#9783a5'];
const all=H=>H?.architecture?.levels?.flatMap(l=>l.units||[])||[];
const managed=H=>all(H).length>0;
const id=H=>[H.seed,Math.round(H.x0*10),Math.round(H.y0*10),Math.round(H.x1*10),Math.round(H.y1*10)].join(':');
const key=(H,u)=>id(H)+'/'+(typeof u==='string'?u:u.id);
function init(){
 if(ready)return;ready=true;
 try{const d=JSON.parse(localStorage.getItem(KEY)||'{}');for(const [k,v] of Object.entries(d||{}))
  if(k.length<128&&v?.mine&&Number.isFinite(v.cost))owned[k]=v;}catch(_){}
 try{const d=JSON.parse(localStorage.getItem(DECOR)||'{}');
  for(const [k,rows] of Object.entries(d||{}))if(k.length<128&&Array.isArray(rows))
    decor[k]=rows.filter(r=>r&&typeof r.kind==='string'&&Number.isFinite(r.x)&&Number.isFinite(r.y)
      &&Number.isFinite(r.w)&&Number.isFinite(r.d)&&Number.isFinite(r.floor)).slice(0,60);
 }catch(_){}
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-unit-act]');if(!b)return;
  const op=b.dataset.unitAct;if(op==='close'){close();return;}
  const H=current,p=window.__game?.player;
  if(!H||!p||Math.hypot(p.x-(H.x0+H.x1)/2,p.y-(H.y0+H.y1)/2)>55)return;
  const floor=Number(b.dataset.floor),u=all(H).find(q=>q.id===b.dataset.unit&&q.floor===floor);
  let result;
  if(op==='buy'&&u)result=buy(H,u);
  if(op==='floor')result=go(H,p,floor);
  if(op==='door'&&u)result=toggleDoor(H,u);
  if(op==='manage'&&u&&has(H,u)){selectedUnit=u.id;panel(H,floor,u.id);return;}
  if(op==='back'){selectedUnit=null;panel(H,floor);return;}
  if(op==='paint'&&colors.includes(b.dataset.color)){paint=b.dataset.color;panel(H,floor,selectedUnit);return;}
  if(op==='furnbuy'&&selectedUnit){
    const item=all(H).find(q=>q.id===selectedUnit&&q.floor===floor);
    result=item?buyFurniture(H,item,b.dataset.kind,paint):{ok:false,text:'Unidade inválida'};
  }
  if(op==='furnsell'&&selectedUnit){
    const item=all(H).find(q=>q.id===selectedUnit&&q.floor===floor);
    result=item?sellFurniture(H,item,b.dataset.furniture):{ok:false,text:'Unidade inválida'};
  }
  if(op==='opening'&&u&&u.type==='shop'&&has(H,u)){
    owned[key(H,u)].open=!owned[key(H,u)].open;
    try{localStorage.setItem(KEY,JSON.stringify(owned));result={ok:true,text:owned[key(H,u)].open?'Estabelecimento aberto':'Estabelecimento fechado'};}
    catch(_){owned[key(H,u)].open=!owned[key(H,u)].open;result={ok:false,text:'Falha ao salvar'};}
  }
  if(result){window.CityUI?.notify?.(result.text);if(result.ok&&op==='floor')close();else panel(H,floor,selectedUnit);}
 });
}
function has(H,u){return !!owned[key(H,u)]?.mine;}
function price(H,u){return Math.max(8000,Math.round(u.area*(u.type==='shop'?230:u.type==='office'?170:H.miaKind==='projects'?90:240)/1000)*1000);}
function roomAt(H,x,y,floor){
 const l=H?.architecture?.levels?.[floor];if(!l)return null;
 const p=H.architecture.toLocal(x,y);
 return l.rooms.find(r=>p[0]>r.x0+.02&&p[0]<r.x1-.02&&p[1]>r.y0+.02&&p[1]<r.y1-.02)||null;
}
function unitAt(H,x,y,floor){
 const r=roomAt(H,x,y,floor);
 return r?.unitId?all(H).find(u=>u.id===r.unitId&&u.floor===floor)||null:null;
}
function canSeeRoom(H,r,floor,p){
 if(!managed(H)||!r.unitId)return true;
 if(!p||(p.floor||0)!==floor)return false;
 const u=unitAt(H,p.x,p.y,floor);
 return !!u&&u.id===r.unitId&&has(H,u);
}
function canSeeFurniture(H,b,p){
 if(!managed(H))return true;
 const floor=b.floor||0,u=all(H).find(t=>t.floor===floor&&t.id===(b.unitId||roomAt(H,b.x,b.y,floor)?.unitId));
 return !!u&&has(H,u)&&!!p&&(p.floor||0)===floor&&unitAt(H,p.x,p.y,floor)?.id===u.id;
}
function canOpenDoor(H,s){return !managed(H)||!s?.unitId||has(H,s.unitId);}
function furnish(H,u){
 if(!H?.architecture||typeof addBox!=='function')return;
 for(const l of H.architecture.levels)if(l.units?.some(v=>v.id===u.id))for(const f of l.furniture||[]){
  if(l.rooms.find(r=>r.id===f.room)?.unitId!==u.id)continue;
  if(typeof boxes!=='undefined'&&boxes.some(b=>b.house===H&&b.floor===l.floor&&b.unitId===u.id&&b.room===f.room&&b.kind===f.kind))continue;
  const q=H.architecture.toWorld(f.x,f.y);
  const b=addBox({...f,x:q[0],y:q[1],z:l.z,rot:H.architecture.angle,
   floor:l.floor,house:H,unitId:u.id,architecture:true,solid:!f.overlay});
  H.interactables?.push(b);
 }
 for(const l of H.architecture.levels)if(l.units?.some(v=>v.id===u.id))
  for(const item of decor[key(H,u)]||[])if(item.floor===l.floor)mount(H,u,item);
 if(typeof world!=='undefined')world.version=(world.version||0)+1;
}
function mount(H,u,r){
 if(typeof boxes!=='undefined'&&boxes.some(b=>b.house===H&&b.unitInventoryId===r.id))return;
 const b=addBox({...r,house:H,unitId:u.id,unitInventoryId:r.id,
   z:H.architecture.levels[r.floor].z,rot:H.architecture.angle,architecture:true,
   top:r.color,side:r.color,solid:true});
 H.interactables?.push(b);
}
function persistDecor(){try{localStorage.setItem(DECOR,JSON.stringify(decor));return true;}catch(_){return false;}}
function buyFurniture(H,u,kind,color){
 if(!has(H,u))return {ok:false,text:'Unidade privada'};
 const c=window.CityHome?.catalog?.[kind];
 if(!c||!Number.isFinite(c.price)||!Number.isFinite(c.w)||!Number.isFinite(c.d))
  return {ok:false,text:'Móvel não disponível'};
 const inventory=decor[key(H,u)]||(decor[key(H,u)]=[]);
 if(inventory.length>=40)return {ok:false,text:'Limite de mobília atingido'};
 const floor=u.floor,level=H.architecture.levels[floor];
 const suitable=level.rooms.filter(r=>r.unitId===u.id).sort((a,b)=>{
   const rank=r=>r.use===(['bed','wardrobe'].includes(kind)?'bedroom':
     ['stove','fridge','counter'].includes(kind)?'kitchen':
     ['sofa','tv','table'].includes(kind)?'living':'office')?0:1;
   return rank(a)-rank(b);
 });
 let spot=null,spotRoom=null;
 for(const room of suitable){
  for(let y=room.y0+c.d/2+.45;y<room.y1-c.d/2-.45&&!spot;y+=.5)
   for(let x=room.x0+c.w/2+.45;x<room.x1-c.w/2-.45;x+=.5){
    const q=H.architecture.toWorld(x,y);
    const taken=typeof boxes!=='undefined'&&boxes.some(b=>
      b.house===H&&(b.floor||0)===floor&&b.solid!==false&&
      Math.hypot(b.x-q[0],b.y-q[1])<(Math.max(b.w||0,b.d||0)+Math.max(c.w,c.d))*.65+.18);
    if(!taken){spot=q;spotRoom=room.id;break;}
   }
  if(spot)break;
 }
 if(!spot)return {ok:false,text:'Não há espaço livre nesta unidade'};
 if(!CityLife.debit(c.price,'Móvel · '+c.name))return {ok:false,text:'Saldo insuficiente'};
 const item={id:'unit-'+Date.now()+'-'+inventory.length,kind,x:spot[0],y:spot[1],
  floor,w:c.w,d:c.d,h:c.h,room:spotRoom,color:colors.includes(color)?color:colors[0],cost:c.price};
 inventory.push(item);
 if(!persistDecor()){inventory.pop();CityLife.credit(c.price,'Estorno de mobília');return {ok:false,text:'Falha ao salvar o móvel'};}
 mount(H,u,item);if(typeof world!=='undefined')world.version=(world.version||0)+1;
 return {ok:true,text:c.name+' colocado(a) em sua unidade'};
}
function sellFurniture(H,u,itemId){
 if(!has(H,u))return {ok:false,text:'Acesso negado'};
 const rows=decor[key(H,u)]||[],i=rows.findIndex(r=>r.id===itemId);if(i<0)return {ok:false,text:'Móvel não encontrado'};
 const old=rows.splice(i,1)[0];
 if(!persistDecor()){rows.splice(i,0,old);return {ok:false,text:'Falha ao salvar'};}
 if(typeof boxes!=='undefined'){
  const removed=boxes.filter(b=>b.house===H&&b.unitInventoryId===old.id);
  for(let j=boxes.length-1;j>=0;j--)if(removed.includes(boxes[j]))boxes.splice(j,1);
  if(typeof world!=='undefined')for(const set of [world.segs,world.upperSegs]){
   if(!set)continue;
   for(let j=set.length-1;j>=0;j--)if(removed.includes(set[j].sourceBox))set.splice(j,1);
  }
  if(typeof OW!=='undefined')for(const sector of OW.sectors?.values()||[])
   for(const kind of ['boxes','segs','upperSegs']){
    const list=sector.own?.[kind];if(!list)continue;
    for(let j=list.length-1;j>=0;j--)if(removed.includes(list[j])||removed.includes(list[j]?.sourceBox))list.splice(j,1);
   }
  if(typeof owRebuildIndices==='function'&&world?.open)owRebuildIndices();
 }
 H.interactables=H.interactables?.filter(b=>b.unitInventoryId!==old.id)||[];
 CityLife.credit(Math.round(old.cost*.5),'Venda de mobília');
 if(typeof world!=='undefined')world.version=(world.version||0)+1;
 return {ok:true,text:'Móvel vendido · 50% do valor'};
}
function onBuild(H){const seen=new Set;
 for(const u of all(H))if(has(H,u)&&!seen.has(u.id)){seen.add(u.id);furnish(H,u);}
}
function buy(H,u){
 if(!managed(H)||!all(H).some(q=>q.id===u.id&&q.floor===u.floor))return {ok:false,text:'Unidade inválida'};
 if(has(H,u))return {ok:false,text:'Você já comprou esta unidade'};
 const cost=price(H,u);
 if(!CityLife.debit(cost,'Compra da unidade '+u.id))return {ok:false,text:'Saldo insuficiente'};
 const k=key(H,u);owned[k]={mine:true,cost,date:Date.now()};
 try{localStorage.setItem(KEY,JSON.stringify(owned));}catch(_){
  delete owned[k];CityLife.credit(cost,'Estorno de imóvel');
  return {ok:false,text:'Falha ao salvar a compra'};
 }
 furnish(H,u);
 window.dispatchEvent(new Event('city-property-change'));
 return {ok:true,text:'Unidade '+u.id+' comprada neste save'};
}
function elevatorPoint(H,f){
 const l=H?.architecture?.levels?.[f];if(!l)return null;
 if(l.stair?.center)return l.stair.center;
 const r=l.rooms.find(r=>r.id==='hall');
 return r?H.architecture.toWorld((r.x0+r.x1)/2,(r.y0+r.y1)/2):null;
}
function nearLift(H,p){const q=elevatorPoint(H,p.floor||0);
 return !!q&&Math.hypot(p.x-q[0],p.y-q[1])<2.6;
}
function go(H,p,f){
 if(!managed(H)||!Number.isInteger(f)||f<0||f>=H.architecture.levels.length)return {ok:false,text:'Andar inválido'};
 if(p.elevatorTravel||p.stairTravel)return {ok:false,text:'Transporte em andamento'};
 if(!nearLift(H,p))return {ok:false,text:'Aproxime-se do elevador no corredor'};
 if((p.floor||0)===f)return {ok:false,text:'Você já está neste andar'};
 const t=elevatorPoint(H,f);
 p.elevatorTravel={floor:f,x:p.x,y:p.y,z:p.floorZ||0,tx:t[0],ty:t[1],tz:H.architecture.levels[f].z,
   progress:0,duration:1.5+Math.abs(f-(p.floor||0))*.65};
 return {ok:true,text:'Elevador chamado'};
}
function tick(dt,p){
 const e=p?.elevatorTravel;if(!e)return false;
 e.progress=Math.min(1,e.progress+Math.max(0,dt)/e.duration);
 const t=e.progress*e.progress*(3-2*e.progress);
 p.x=e.x+(e.tx-e.x)*t;p.y=e.y+(e.ty-e.y)*t;p.floorZ=e.z+(e.tz-e.z)*t;
 p.speed=0;p.running=false;
 if(e.progress>=1){p.floor=e.floor;p.floorZ=e.tz;p.elevatorTravel=null;window.CityUI?.notify?.('Andar '+(e.floor+1));}
 return true;
}
function toggleDoor(H,u){
 if(!has(H,u))return {ok:false,text:'Propriedade privada'};
 let done=false;
 for(const l of H.architecture.levels)for(const s of l.segments||[])
  if(s.unitEntry&&s.unitId===u.id&&s.doorAnim){s.doorAnim.manual=true;s.doorAnim.target=s.doorAnim.target>.5?0:1;done=true;}
 return {ok:done,text:done?'Porta acionada':'Porta indisponível'};
}
function locate(p){
 if(!p||typeof houses==='undefined')return null;
 for(const H of houses){
  if(!managed(H))continue;
  const floor=p.floor||0;
  if(floor===0&&H.doorPt&&Math.hypot(p.x-H.doorPt[0],p.y-H.doorPt[1])<2.8)return {H,floor};
  if(!H.contains?.(p.x,p.y,floor))continue;
  if(nearLift(H,p))return {H,floor};
  if(H.architecture.levels[floor]?.segments?.some(s=>s.unitEntry&&Math.hypot(p.x-(s.x1+s.x2)/2,p.y-(s.y1+s.y2)/2)<1.4))return {H,floor};
 }
 return null;
}
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function panel(H,floor=0,manageId=null){
 if(typeof document==='undefined'||!managed(H))return false;
 current=H;
 let el=document.getElementById('city-building-dialog');
 if(!el){el=document.createElement('div');el.id='city-building-dialog';document.body.appendChild(el);}
 const floors=H.architecture.levels;
 const links=floors.map(l=>'<button data-unit-act="floor" data-floor="'+l.floor+'">'+(l.floor?'Andar '+(l.floor+1):'Térreo')+
   ' · '+(l.units||[]).filter(u=>has(H,u)).length+'/'+(l.units||[]).length+' suas</button>').join('');
 const units=(floors[floor]?.units||[]).map(u=>'<article><b>'+(u.type==='shop'?'Loja':u.type==='office'?'Sala comercial':'Apartamento')+
  ' '+escape(u.id)+' · '+(u.side==='left'?'Esquerda':u.side==='right'?'Direita':'Comercial')+'</b><small>'+u.area+
  ' m² · '+(has(H,u)?'Sua unidade':'Sem proprietário neste save')+' · Online indisponível</small>'+
  (has(H,u)?'<button data-unit-act="door" data-unit="'+escape(u.id)+'" data-floor="'+u.floor+'">Abrir/fechar porta</button>'+
  '<button data-unit-act="manage" data-unit="'+escape(u.id)+'" data-floor="'+u.floor+'">Gerenciar / decorar</button>'+
  (u.type==='shop'?'<button data-unit-act="opening" data-unit="'+escape(u.id)+'" data-floor="'+u.floor+'">'+
  (owned[key(H,u)].open?'Fechar loja':'Abrir loja')+'</button>':''):
  '<button data-unit-act="buy" data-unit="'+escape(u.id)+'" data-floor="'+u.floor+'" '+
   (CityLife.funds<price(H,u)?'disabled':'')+'>Comprar por '+escape(CityLife.money(price(H,u)))+'</button>')+
  '</article>').join('')||'<p>Portaria / corredor comum</p>';
 const chosen=all(H).find(u=>u.id===manageId&&u.floor===floor&&has(H,u));
 const furniture=chosen?(decor[key(H,chosen)]||[]):[];
 const catalog=chosen?Object.values(window.CityHome?.catalog||{}).filter(c=>c.price>0&&c.w<4&&c.d<4).slice(0,18):[];
 const customize=chosen?'<h3>Mobília de '+escape(chosen.id)+'</h3>'+
   '<button data-unit-act="back">Voltar</button><p>Itens comprados ficam somente nesta unidade.</p>'+
   '<nav>'+colors.map(color=>'<button title="'+color+'" style="background:'+color+';min-height:34px" data-unit-act="paint" data-color="'+color+'">'+
    (paint===color?'✓':'')+'</button>').join('')+'</nav>'+
   '<section>'+catalog.map(c=>'<article><b>'+escape(c.name)+'</b><span>'+escape(CityLife.money(c.price))+'</span>'+
    '<button data-unit-act="furnbuy" data-floor="'+floor+'" data-kind="'+escape(c.kind)+'">Comprar / posicionar</button></article>').join('')+
   furniture.map(c=>'<article><small>'+escape(c.kind)+' · '+escape(c.color)+'</small>'+
    '<button data-unit-act="furnsell" data-floor="'+floor+'" data-furniture="'+escape(c.id)+'">Vender (50%)</button></article>').join('')+
   '</section>':'';
 el.innerHTML='<div class="city-building-panel"><header><h2>🏢 '+escape(H.bName||H.hotelName||'Imóveis do prédio')+
  '</h2><button data-unit-act="close">✕</button></header><p>'+floors.length+' andares · '+all(H).length+' unidades</p>'+
  '<p class="offline">Sem sincronização multiplayer: proprietários de outros jogadores e presença online não são verificáveis.</p>'+
  '<h3>Elevador · andares</h3><nav>'+links+'</nav><h3>Unidades do andar '+(floor+1)+'</h3><section>'+units+
  '</section>'+customize+'<footer>Somente sua unidade é visível por dentro.</footer></div>';
 el.hidden=false;return true;
}
function close(){const el=document.getElementById('city-building-dialog');if(el)el.hidden=true;current=null;}
function onInteract(p){const v=locate(p);if(!v)return false;panel(v.H,v.floor);return true;}
function prompt(p){return locate(p)?'F · Elevador / comprar apartamento ou loja':'';}
root.CityBuildings={init,all,managed,id,key,has,buy,price,roomAt,unitAt,canSeeRoom,canSeeFurniture,canOpenDoor,
 furnish,onBuild,elevatorPoint,nearLift,go,tick,toggleDoor,locate,panel,onInteract,prompt,buyFurniture,sellFurniture};
if(typeof module!=='undefined')module.exports=root.CityBuildings;
})(globalThis);
