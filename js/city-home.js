// City Home — owned-house furniture inventory, placement and persistence.
// Stores furniture by deterministic property ID; resolves streaming-sector rebuilds.
'use strict';
const CityHome=(()=>{
 const catalog=[
 ['sofa','Sofá Comfort','Sala',1250,2.1,.85,.86,'#627d9b','#425b77'],
 ['couch','Sofá compacto','Sala',820,1.65,.8,.84,'#a57c6e','#72574e'],
 ['chair','Cadeira','Sala',180,.5,.55,.85,'#ad9274','#69523e'],
 ['table','Mesa de jantar','Sala',690,1.35,.9,.8,'#a88058','#77563b'],
 ['tv','Televisão','Sala',1390,1.2,.14,.8,'#1c252d','#11161b'],
 ['screen','Monitor','Escritório',790,1.1,.12,.7,'#252d33','#171e26'],
 ['rug','Tapete','Decoração',210,1.7,1.2,.025,'#657f97','#52677d'],
 ['shelf','Estante','Decoração',540,1.2,.38,1.8,'#a17c58','#6b503a'],
 ['cabinet','Armário','Cozinha',660,.85,.5,1.55,'#d3bd9f','#8e7557'],
 ['fridge','Geladeira','Cozinha',2800,.85,.82,1.75,'#e7e5e1','#9ba3ad'],
 ['stove','Fogão','Cozinha',1180,.76,.65,.94,'#c8cad0','#727880'],
 ['sink','Pia','Cozinha',520,.72,.6,.9,'#d3d9de','#8996a3'],
 ['counter','Balcão','Cozinha',670,1.4,.64,.9,'#d8c8ae','#796c5c'],
 ['bed','Cama de casal','Quarto',2100,1.65,2.1,.7,'#8eacc6','#765b57'],
 ['mattress','Colchão simples','Quarto',340,1.35,2.0,.28,'#d2cebf','#9f988a'],
 ['wardrobe','Guarda-roupa','Quarto',1690,1.5,.67,2.0,'#caa882','#76583e'],
 ['desk','Escrivaninha','Escritório',660,1.3,.7,.76,'#a8805e','#664a38'],
 ['studentdesk','Mesa de estudo','Escritório',420,1.2,.65,.75,'#bd9971','#687780'],
 ['mirror','Espelho','Decoração',270,.85,.13,1.58,'#a8c6d3','#506d7a'],
 ['toilet','Vaso sanitário','Banheiro',690,.5,.73,.81,'#f3f4f4','#bec4c7'],
 ['shower','Box de banho','Banheiro',1550,.9,.9,1.95,'#b7dee8','#789eaa'],
 ];
 const defs=Object.fromEntries(catalog.map(([kind,name,category,price,w,d,h,top,side])=>[kind,{kind,name,category,price,w,d,h,top,side}]));
 const KEY='cityofgod.home-furniture.v1',MAX=220;
 const copy=o=>JSON.parse(JSON.stringify(o));
 const safeId=()=>String(Date.now())+'-'+Math.random().toString(36).slice(2,10);
 const finite=(v,d=0)=>Number.isFinite(v)?v:d;
 const eligible=b=>b&&b.house&&!b.exteriorFixture&&defs[b.kind]&&!(b.z>50)&&b.kind!=='blanket';
 const label=kind=>defs[kind]?.name||kind;
 let saves={},loaded=false,seq=0,notify=()=>{},lastCheck=0;
 const synced=new WeakSet(),baselines=new WeakMap(),undoLog=new Map();
 const propId=H=>typeof CityRealty!=='undefined'?CityRealty.id(H):'';
 const owned=H=>!!H&&typeof CityRealty!=='undefined'&&CityRealty.isOwned(H);
 const key=H=>(typeof world!=='undefined'?world.seed:'city')+':'+propId(H);
 const sector=H=>{
   if(typeof OW==='undefined'||!OW.sectors)return null;
   for(const S of OW.sectors.values())if(S.own?.houses?.includes(H))return S;
   return null;
 };
 const isStored=r=>r.status==='stored';
 const numericRow=(r)=>{
   const base=defs[r.kind];
   return !!base&&typeof r.id==='string'&&r.id.length<110&&['placed','stored','sold'].includes(r.status)&&
    [r.x,r.y,r.rot,r.w,r.d,r.h,r.z].every(Number.isFinite)&&Number.isInteger(r.floor)&&r.floor>=0&&r.floor<20&&
    r.w>0&&r.d>0&&r.w<8&&r.d<8;
 };
 function init(){
  if(loaded)return;loaded=true;
  try{
   const raw=JSON.parse(localStorage.getItem(KEY)||'{}');
   if(raw&&typeof raw==='object'&&!Array.isArray(raw))
    for(const [k,v] of Object.entries(raw))if(k.length<140&&v&&Array.isArray(v.items))
      saves[k]={items:v.items.filter(numericRow).slice(0,MAX),at:finite(v.at),version:2};
  }catch(e){console.warn('CityHome load',e);}
 }
 function persist(){
   try{localStorage.setItem(KEY,JSON.stringify(saves));window.dispatchEvent(new Event('city-home-change'));return true;}
   catch(e){console.warn('CityHome save',e);return false;}
 }
 const get=H=>(init(),saves[key(H)]||null);
 function rowOf(b,id,status='placed'){
   return {id,kind:b.kind,status,x:finite(b.x),y:finite(b.y),z:finite(b.z),
    rot:finite(b.rot),w:finite(b.w,.8),d:finite(b.d,.8),h:finite(b.h,.8),
    floor:Math.max(0,Math.round(b.floor||0)),top:b.top||defs[b.kind].top,side:b.side||defs[b.kind].side,
    solid:b.solid!==false};
 }
 function normalize(H){
   const parts=boxes.filter(b=>b.house===H&&eligible(b)&&!b.homeManaged);
   parts.sort((a,b)=>(a.floor||0)-(b.floor||0)||a.kind.localeCompare(b.kind)||a.x-b.x||a.y-b.y||a.w-b.w);
   return parts.map((b,i)=>rowOf(b,'starter-'+i));
 }
 function removeBox(b){
   let index=boxes.indexOf(b);if(index>=0)boxes.splice(index,1);
   if(b.house?.interactables){index=b.house.interactables.indexOf(b);if(index>=0)b.house.interactables.splice(index,1);}
   if(b.house?.upper?.furniture){index=b.house.upper.furniture.indexOf(b);if(index>=0)b.house.upper.furniture.splice(index,1);}
   for(const arr of [world.segs,world.upperSegs]){
     if(!arr)continue;let n=0;for(const x of arr)if(x.sourceBox!==b)arr[n++]=x;arr.length=n;
   }
   const S=sector(b.house);
   if(S?.own)for(const kind of ['boxes','segs','upperSegs']){
     const arr=S.own[kind];if(!arr)continue;
     let n=0;for(const x of arr)if(x!==b&&x.sourceBox!==b)arr[n++]=x;arr.length=n;
   }
 }
 function refresh(H){
   // Rebuild from authoritative saved rows instead of mutating coordinates
   // with stale collision segments. No duplicates after a streamed sector reload.
   const data=get(H);if(!data)return;
   // Beds already include a blanket in their 3D mesh; remove legacy duplicate overlays
   // so an old loose blanket is not left hovering when the bed is moved.
   const original=boxes.filter(b=>b.house===H&&(eligible(b)||b.kind==='blanket'&&!b.exteriorFixture));
   for(const b of original)removeBox(b);
   const S=sector(H);
   for(const r of data.items)if(r.status==='placed'){
     const b=addBox({...r,house:H,homeManaged:true,homeId:r.id,
       architecture:!!H.architecture,roomCenter:undefined,solid:r.solid});
     if(H.interactables&&!H.interactables.includes(b))H.interactables.push(b);
     if(r.floor&&H.upper?.furniture)H.upper.furniture.push(b);
     if(S){(S.own.boxes||(S.own.boxes=[])).push(b);}
   }
   // Ensure stream ownership tracks freshly created colliders as well.
   if(S){
     const segSet=new Set((S.own.segs||[]));
     for(const s of world.segs||[])if(s.sourceBox?.house===H&&s.sourceBox?.homeManaged&&!segSet.has(s)){
       (S.own.segs||(S.own.segs=[])).push(s);segSet.add(s);
     }
     const upper=new Set(S.own.upperSegs||[]);
     for(const s of world.upperSegs||[])if(s.sourceBox?.house===H&&s.sourceBox?.homeManaged&&!upper.has(s)){
       (S.own.upperSegs||(S.own.upperSegs=[])).push(s);upper.add(s);
     }
   }
   if(typeof owRebuildIndices==='function'&&world.open)owRebuildIndices();
   world.version=(world.version||0)+1;
 }
 function sync(H){
   if(!owned(H)||synced.has(H)||!H._furnished&&!H._architectureFurnished)return false;
   init();const k=key(H);
   if(!saves[k]){
     saves[k]={version:2,at:Date.now(),items:normalize(H)};
     if(!persist()){delete saves[k];return false;}
   }
   // Existing row IDs take precedence over dynamically generated items.
   synced.add(H);refresh(H);return true;
 }
 function tick(p){
   if(!p||typeof houses==='undefined'||!loaded&&typeof localStorage==='undefined')return;
   const now=typeof performance!=='undefined'?performance.now():Date.now();
   if(now-lastCheck<900)return;lastCheck=now;
   for(const H of houses){
     if(!owned(H)||synced.has(H))continue;
     if(Math.abs((H.x0+H.x1)/2-p.x)>85||Math.abs((H.y0+H.y1)/2-p.y)>85)continue;
     sync(H);
   }
 }
 function houseAt(p){
   if(!p||typeof houses==='undefined')return null;
   const floor=p.floor||0;
   return houses.find(H=>owned(H)&&(
      H.architecture?H.contains?.(p.x,p.y,floor):
      H.contains?.(p.x,p.y,floor)||p.x>H.x0+.2&&p.x<H.x1-.2&&p.y>H.y0+.2&&p.y<H.y1-.2
   ))||null;
 }
 function find(H,id){return get(H)?.items.find(r=>r.id===id);}
 function corners(r){
  const c=Math.cos(r.rot),s=Math.sin(r.rot),w=r.w/2,d=r.d/2;
  return [[-w,-d],[w,-d],[w,d],[-w,d]].map(([x,y])=>[r.x+x*c-y*s,r.y+x*s+y*c]);
 }
 function overlap(a,b,margin=.04){
   const pa=corners(a),pb=corners(b),axes=[];
   for(const list of [pa,pb])for(let i=0;i<2;i++){
     const p=list[i],q=list[i+1],dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy)||1;
     axes.push([-dy/len,dx/len]);
   }
   for(const [nx,ny] of axes){
     const va=pa.map(([x,y])=>x*nx+y*ny),vb=pb.map(([x,y])=>x*nx+y*ny);
     if(Math.max(...va)+margin<=Math.min(...vb)||Math.max(...vb)+margin<=Math.min(...va))return false;
   }
   return true;
 }
 function check(H,proposed,ignoreId=null){
   if(!owned(H))return {ok:false,text:'Você não é dono deste imóvel'};
   if(!numericRow(proposed))return {ok:false,text:'Dimensões inválidas'};
   if(proposed.floor>=Math.max(1,H.architecture?.levels?.length||(H.upper?2:1)))return {ok:false,text:'Andar inválido'};
   const P=corners(proposed),pad=.12,level=H.architecture?.levels?.[proposed.floor];
   if(level){
     const local=H.architecture.toLocal;
     const inside=r=>P.every(([x,y])=>{const [u,v]=local(x,y);return u>r.x0+pad&&u<r.x1-pad&&v>r.y0+pad&&v<r.y1-pad;});
     if(!level.rooms.some(r=>r.use!=='circulation'&&inside(r)))
       return {ok:false,text:'Coloque dentro de um cômodo, sem atravessar paredes'};
     for(const wall of level.segments||[]){
       if(!wall.door)continue;
       const x=(wall.x1+wall.x2)/2,y=(wall.y1+wall.y2)/2;
       if(Math.hypot(x-proposed.x,y-proposed.y)<Math.max(proposed.w,proposed.d)*.5+.85)
         return {ok:false,text:'Mantenha a passagem da porta livre'};
     }
   }else{
     if(!P.every(([x,y])=>x>H.x0+pad&&x<H.x1-pad&&y>H.y0+pad&&y<H.y1-pad))
       return {ok:false,text:'O móvel deve ficar dentro da casa'};
     for(const wall of H.segs||[])if(wall.door){
       const mx=(wall.x1+wall.x2)/2,my=(wall.y1+wall.y2)/2;
       if(Math.hypot(mx-proposed.x,my-proposed.y)<Math.max(proposed.w,proposed.d)*.5+.75)
         return {ok:false,text:'Não bloqueie as portas'};
     }
   }
   const player=window.__game?.player;
   if(player&&(player.floor||0)===proposed.floor&&proposed.solid!==false){
     const actor={kind:'chair',x:player.x,y:player.y,rot:0,w:.65,d:.65};
     if(overlap(actor,proposed,.15))return {ok:false,text:'Libere espaço para o personagem'};
   }
   const data=get(H);
   for(const row of data?.items||[]){
     if(row.id===ignoreId||row.status!=='placed'||row.floor!==proposed.floor)continue;
     if(['rug','mirror','screen','tv'].includes(row.kind)||['rug','mirror','screen','tv'].includes(proposed.kind))continue;
     if(overlap(row,proposed))return {ok:false,text:'Há outro móvel ocupando esse espaço'};
   }
   return {ok:true,text:'Posição válida'};
 }
 const stashUndo=H=>{
   const k=key(H),log=undoLog.get(k)||[];
   log.push(copy(get(H).items));if(log.length>16)log.shift();undoLog.set(k,log);
 };
 function commit(H,change){
   const state=get(H);if(!state)return {ok:false,text:'Propriedade ainda não carregada'};
   const old=copy(state.items);
   change(state.items);state.at=Date.now();
   if(!persist()){state.items=old;return {ok:false,text:'Não foi possível salvar a casa'};}
   const k=key(H),log=undoLog.get(k)||[];log.push(old);if(log.length>16)log.shift();undoLog.set(k,log);
   refresh(H);return {ok:true,text:'Alterações salvas'};
 }
 function move(H,id,next){
   if(!owned(H))return {ok:false,text:'Acesso negado'};
   sync(H);const old=find(H,id);
   if(!old||old.status!=='placed')return {ok:false,text:'Móvel não encontrado'};
   const proposed={...old,x:Math.round(finite(next.x,NaN)*100)/100,y:Math.round(finite(next.y,NaN)*100)/100,
      rot:finite(next.rot,old.rot)};
   const validation=check(H,proposed,id);if(!validation.ok)return validation;
   return commit(H,items=>Object.assign(items.find(i=>i.id===id),{x:proposed.x,y:proposed.y,rot:proposed.rot}));
 }
 function store(H,id){
   if(!owned(H))return {ok:false,text:'Acesso negado'};
   sync(H);const item=find(H,id);
   if(!item||item.status!=='placed')return {ok:false,text:'Móvel não está no ambiente'};
   return commit(H,items=>{items.find(i=>i.id===id).status='stored';});
 }
 function buy(H,kind){
   if(!owned(H))return {ok:false,text:'Acesso negado'};
   sync(H);const d=defs[kind],data=get(H);
   if(!d||!data)return {ok:false,text:'Produto indisponível'};
   if(data.items.filter(r=>r.status!=='sold').length>=MAX)return {ok:false,text:'Inventário da casa cheio'};
   if(!CityLife.debit(d.price,'Bellavista Home · '+d.name))return {ok:false,text:'Saldo insuficiente'};
   const old=copy(data.items),floor=0;
   const homePoint=H.architecture?H.architecture.toWorld(H.architecture.width*.25,H.architecture.depth*.25):
     [(H.x0+H.x1)/2,(H.y0+H.y1)/2];
   data.items.push({...d,id:'purchased-'+safeId(),status:'stored',
     x:homePoint[0],y:homePoint[1],rot:0,z:0,floor,solid:!['rug','mirror','screen','tv'].includes(kind)});
   if(!persist()){
     data.items=old;CityLife.credit(d.price,'Estorno Bellavista Home');return {ok:false,text:'Erro ao salvar a compra; valor estornado'};
   }
   undoLog.delete(key(H)); // compras não são reversíveis com Ctrl+Z
   return {ok:true,text:d.name+' comprado! Disponível no estoque da casa'};
 }
 function place(H,id,next){
   if(!owned(H))return {ok:false,text:'Acesso negado'};
   sync(H);
   const item=find(H,id);if(!item||item.status!=='stored')return {ok:false,text:'Móvel não está guardado'};
   const floor=Math.max(0,Math.round(finite(next.floor,0)));
   const row={...item,status:'placed',x:Math.round(next.x*100)/100,y:Math.round(next.y*100)/100,
       rot:finite(next.rot,0),floor,z:H.architecture?.levels?.[floor]?.z||floor*(H.floorHeight||3)};
   const validation=check(H,row,id);if(!validation.ok)return validation;
   return commit(H,items=>Object.assign(items.find(i=>i.id===id),row));
 }
 function sell(H,id){
   if(!owned(H))return {ok:false,text:'Acesso negado'};
   sync(H);const row=find(H,id);if(!row||row.status==='sold')return {ok:false,text:'Móvel indisponível'};
   const value=Math.round((defs[row.kind]?.price||0)*.5);
   const result=commit(H,items=>{items.find(i=>i.id===id).status='sold';});
   if(result.ok){undoLog.delete(key(H));CityLife.credit(value,'Venda de móvel · '+label(row.kind));result.text='Vendido por '+CityLife.money(value);}
   return result;
 }
 function recolor(H,id,color){
   if(!owned(H))return {ok:false,text:'Acesso negado'};
   if(!/^#[a-f\d]{6}$/i.test(color))return {ok:false,text:'Cor inválida'};
   const row=find(H,id);if(!row||row.status!=='placed')return {ok:false,text:'Selecione um móvel'};
   return commit(H,items=>{const item=items.find(i=>i.id===id);item.top=color;item.side=color;});
 }
 function undo(H){
   if(!owned(H))return {ok:false,text:'Acesso negado'};
   const log=undoLog.get(key(H))||[],state=get(H),last=log.pop();
   if(!last||!state)return {ok:false,text:'Nada para desfazer'};
   const old=state.items;state.items=last;
   if(!persist()){state.items=old;log.push(last);return {ok:false,text:'Não foi possível salvar'};
   }
   refresh(H);return {ok:true,text:'Última mudança de decoração desfeita'};
 }
 function nearbyItems(H,floor){return boxes.filter(b=>b.house===H&&b.homeManaged&&(b.floor||0)===floor);}
 function inventory(H){return get(H)?.items.filter(i=>i.status==='stored')||[];}
 function placed(H){return get(H)?.items.filter(i=>i.status==='placed')||[];}
 return {catalog:defs,list:Object.values(defs),init,sync,tick,houseAt,owned,key,inventory,placed,nearbyItems,
   find,check,move,store,buy,place,sell,recolor,undo,refresh,
   get saved(){return saves;},get active(){return loaded;}};
})();
window.CityHome=CityHome;