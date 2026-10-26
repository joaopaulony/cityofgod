// City Home Plus — interiors, lights, blueprints, home condition and guest preferences.
// Local-only prototype: guest lists are NOT a multiplayer authorization mechanism.
'use strict';
const CityHomePlus=(()=>{
 const STORAGE='cityofgod.home-plus.v1',PLANS='cityofgod.home-designs.v1';
 const finishes=[
 {id:'cream',name:'Creme acetinado',wall:'#eee4d3',floor:'#cbb18f',price:120,material:'wood'},
 {id:'white',name:'Loft branco',wall:'#f6f3ec',floor:'#c6c9c5',price:160,material:'tile'},
 {id:'concrete',name:'Cimento urbano',wall:'#b5bdc4',floor:'#777f86',price:180,material:'concrete'},
 {id:'sage',name:'Sálvia',wall:'#9dbea9',floor:'#b89975',price:190,material:'wood'},
 {id:'navy',name:'Azul profundo',wall:'#556a85',floor:'#d1b591',price:230,material:'wood'},
 {id:'rose',name:'Rosa queimado',wall:'#cf9a98',floor:'#dfcbbe',price:205,material:'wood'},
 {id:'marble',name:'Mármore claro',wall:'#f0e8de',floor:'#e3e2dd',price:380,material:'tile'},
 {id:'terra',name:'Terracota',wall:'#ba836e',floor:'#aa8664',price:185,material:'tile'}];
 const trim=['#f3f1eb','#d4c6b4','#353e49','#a37d5e'];
 const lightModes=['warm','neutral','daylight','purple','cyan'];
 const color={warm:'#ffd9a4',neutral:'#fff1df',daylight:'#dbeeff',purple:'#d6a9fc',cyan:'#9febff'};
 const supports=new Set(['counter','desk','studentdesk','table','shelf','cabinet']);
 const decor=new Set(['plant','bookstack','microwave','lampdesk']);
 const ready={},designs={};
 let initialized=false,changes=0,lastTick=-1;
 const safe=v=>JSON.parse(JSON.stringify(v));
 const own=H=>!!H&&window.CityHome?.owned(H);
 const storageKey=H=>CityHome.key(H);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function load(){
  if(initialized)return;initialized=true;
  try{const x=JSON.parse(localStorage.getItem(STORAGE)||'{}');
   if(x&&typeof x==='object')for(const [key,s] of Object.entries(x)){
    if(key.length>180||!s||typeof s!=='object')continue;
    ready[key]={finishes:s.finishes&&typeof s.finishes==='object'?s.finishes:{},
     lights:Array.isArray(s.lights)?s.lights.slice(0,24).filter(l=>Number.isFinite(l.x)&&Number.isFinite(l.y)&&Number.isInteger(l.floor)):[],
     condition:clamp(Number(s.condition)||100,0,100),lastDay:Math.max(0,Number(s.lastDay)||0),
     guestMode:['private','friends'].includes(s.guestMode)?s.guestMode:'private',
     guests:Array.isArray(s.guests)?s.guests.filter(x=>typeof x==='string'&&x.length<36).slice(0,10):[],
     power:s.power!==false,notes:Array.isArray(s.notes)?s.notes.slice(0,12):[]};
   }
  }catch(e){console.warn('CityHomePlus load',e);}
  try{const x=JSON.parse(localStorage.getItem(PLANS)||'{}');if(x&&typeof x==='object')
   for(const [key,v] of Object.entries(x))if(key.length<180&&Array.isArray(v))designs[key]=v.slice(0,6);
  }catch(_){}
 }
 function data(H){load();const key=storageKey(H);return ready[key]||(ready[key]={
  finishes:{},lights:[],condition:100,lastDay:0,guestMode:'private',guests:[],power:true,notes:[]});}
 function save(){
  try{localStorage.setItem(STORAGE,JSON.stringify(ready));changes++;
   window.dispatchEvent?.(new Event('city-home-plus-change'));return true;}catch(e){console.warn('Home plus save',e);return false;}
 }
 function rooms(H,floor){return H?.architecture?.levels?.[floor]?.rooms||[];}
 function roomAt(H,floor,x,y){
  const local=H?.architecture?.toLocal?.(x,y);
  if(!local)return null;
  return rooms(H,floor).find(r=>local[0]>=r.x0&&local[0]<=r.x1&&local[1]>=r.y0&&local[1]<=r.y1)||null;
 }
 function finish(H,floor,roomId){
  const selected=data(H).finishes[floor+':'+roomId]||'cream';
  return finishes.find(f=>f.id===selected)||finishes[0];
 }
 function decorate(H,floor,roomId,finishId,part='both'){
  if(!own(H))return {ok:false,text:'Apenas o proprietário pode reformar'};
  const room=rooms(H,floor).find(r=>r.id===roomId),f=finishes.find(f=>f.id===finishId);
  if(!room||!f||!['both','wall','floor'].includes(part))return {ok:false,text:'Cômodo ou material inválido'};
  const key=floor+':'+roomId,prev=data(H).finishes[key];
  const value=prev&&typeof prev==='object'?{...prev}: {wall:'cream',floor:'cream'};
  const current=part==='wall'?value.wall:part==='floor'?value.floor:null;
  if(part==='both'&&value.wall===finishId&&value.floor===finishId||
     part==='wall'&&current===finishId||part==='floor'&&current===finishId)
   return {ok:true,text:'Este acabamento já está instalado'};
  const area=Math.max(3,(room.x1-room.x0)*(room.y1-room.y0));
  const amount=Math.round(f.price*(part==='both'?1.5:part==='wall'?.8:1)*area/18);
  if(!CityLife.debit(amount,'Reforma · '+roomId+' · '+f.name))return {ok:false,text:'Saldo insuficiente'};
  if(part==='both'){value.wall=finishId;value.floor=finishId;}
  else value[part]=finishId;
  data(H).finishes[key]=value;
  if(!save()){if(prev===undefined)delete data(H).finishes[key];else data(H).finishes[key]=prev;
    CityLife.credit(amount,'Estorno reforma');return {ok:false,text:'Não foi possível salvar a reforma'};}
  H.homeFinishVersion=(H.homeFinishVersion||0)+1;
  return {ok:true,text:f.name+' aplicado · '+CityLife.money(amount)};
 }
 function surface(H,floor,id){
  const x=data(H).finishes[floor+':'+id];
  if(!x)return null;
  const wall=typeof x==='object'?x.wall:x||'cream',floorId=typeof x==='object'?x.floor:x||'cream';
  return {wall:(finishes.find(f=>f.id===wall)||finishes[0]).wall,
    floor:(finishes.find(f=>f.id===floorId)||finishes[0]).floor,
    material:(finishes.find(f=>f.id===floorId)||finishes[0]).material};
 }
 function installLight(H,floor,roomId,mode='warm'){
  if(!own(H))return {ok:false,text:'Acesso negado'};
  const room=rooms(H,floor).find(r=>r.id===roomId);
  if(!room||!lightModes.includes(mode))return {ok:false,text:'Cômodo ou luz inválida'};
  const state=data(H);
  if(state.lights.length>=12)return {ok:false,text:'Limite de 12 luminárias por residência'};
  if(!CityLife.debit(320,'Iluminação · '+roomId))return {ok:false,text:'Saldo insuficiente'};
  const p=H.architecture.toWorld((room.x0+room.x1)/2,(room.y0+room.y1)/2);
  const l={id:Math.random().toString(36).slice(2),roomId,x:p[0],y:p[1],floor,mode,intensity:1};
  state.lights.push(l);if(!save()){state.lights.pop();CityLife.credit(320,'Estorno luminária');return {ok:false,text:'Não foi possível salvar'};}
  H.homeFinishVersion=(H.homeFinishVersion||0)+1;
  return {ok:true,text:'Luminária instalada em '+roomId};
 }
 function light(H,id,action){
  if(!own(H))return {ok:false,text:'Acesso negado'};
  const d=data(H),l=d.lights.find(x=>x.id===id);
  if(!l)return {ok:false,text:'Luminária não encontrada'};
  if(action==='remove'){d.lights=d.lights.filter(x=>x!==l);CityLife.credit(80,'Revenda de luminária');}
  else if(lightModes.includes(action))l.mode=action;
  else if(action==='bright')l.intensity=clamp(l.intensity+.25,.25,2);
  else if(action==='dim')l.intensity=clamp(l.intensity-.25,.25,2);
  else return {ok:false,text:'Operação inválida'};
  save();H.homeFinishVersion=(H.homeFinishVersion||0)+1;
  return {ok:true,text:'Iluminação atualizada'};
 }
 function togglePower(H){
  if(!own(H))return {ok:false,text:'Acesso negado'};
  data(H).power=!data(H).power;save();return {ok:true,text:data(H).power?'Luzes ligadas':'Luzes desligadas'};
 }
 function setGuestMode(H,mode){
  if(!own(H)||!['private','friends'].includes(mode))return {ok:false,text:'Sem autorização'};
  data(H).guestMode=mode;save();
  return {ok:true,text:mode==='private'?'Casa marcada como particular':'Modo amigos local ativado'};
 }
 function invite(H,name){
  if(!own(H))return {ok:false,text:'Acesso negado'};
  const value=String(name||'').trim().replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,32);
  if(value.length<2)return {ok:false,text:'Digite um nome válido'};
  const guests=data(H).guests;
  if(!guests.includes(value)){if(guests.length>=10)return {ok:false,text:'Limite de convidados'};guests.push(value);save();}
  return {ok:true,text:value+' registrado na lista local'};
 }
 function removeGuest(H,name){if(!own(H))return {ok:false,text:'Acesso negado'};data(H).guests=data(H).guests.filter(g=>g!==name);save();return {ok:true,text:'Convidado retirado'};}
 function capture(H,name='Meu projeto'){
  if(!own(H))return {ok:false,text:'Acesso negado'};
  const rows=CityHome.placed(H);
  const title=String(name||'').trim().slice(0,36)||'Meu projeto',list=designs[storageKey(H)]||(designs[storageKey(H)]=[]);
  const snapshot=rows.map(r=>({id:r.id,kind:r.kind,x:r.x,y:r.y,z:r.z,rot:r.rot,floor:r.floor,top:r.top,side:r.side,supportId:r.supportId||null}));
  list.unshift({name:title,at:Date.now(),rows:snapshot,finishes:safe(data(H).finishes)});
  list.splice(6);
  try{localStorage.setItem(PLANS,JSON.stringify(designs));return {ok:true,text:'Projeto '+title+' salvo'};}
  catch(_){list.shift();return {ok:false,text:'Não foi possível salvar o projeto'};}
 }
 function projects(H){load();return designs[storageKey(H)]||[];}
 function apply(H,index){
  if(!own(H))return {ok:false,text:'Acesso negado'};
  const saved=projects(H)[index];
  if(!saved)return {ok:false,text:'Projeto inexistente'};
  // Restore only furniture that is actually owned and placed/stored at this property;
  // a blueprint is a layout, never a way to mint free items.
  const result=CityHome.restoreDesign(H,saved.rows);
  if(!result.ok)return result;
  data(H).finishes=safe(saved.finishes||{});save();
  H.homeFinishVersion=(H.homeFinishVersion||0)+1;
  return {ok:true,text:'Projeto restaurado com os seus móveis'};
 }
 function appraisal(H){
  const rows=CityHome.placed(H),deco=rows.reduce((v,r)=>v+(CityHome.catalog[r.kind]?.price||0),0);
  const renovations=Object.keys(data(H).finishes).length*900;
  return Math.round((typeof CityRealty!=='undefined'?CityRealty.price(H):20000)+deco*.38+renovations);
 }
 function upkeep(H,clock){
  if(!own(H))return;
  const d=data(H),day=Math.floor(Number(clock||0)/1440);
  if(!d.lastDay){d.lastDay=day;save();return;}
  if(day<=d.lastDay)return;
  const elapsed=Math.min(30,day-d.lastDay);
  d.condition=clamp(d.condition-elapsed*(.35+CityHome.placed(H).length*.012),0,100);
  d.lastDay=day;save();
 }
 function repair(H,service='clean'){
  if(!own(H))return {ok:false,text:'Acesso negado'};
  const d=data(H),amount=service==='repair'?250:90;
  if(!['repair','clean'].includes(service))return {ok:false,text:'Serviço inexistente'};
  if(!CityLife.debit(amount,service==='repair'?'Reparos residenciais':'Limpeza residencial'))return {ok:false,text:'Saldo insuficiente'};
  d.condition=clamp(d.condition+(service==='repair'?35:16),0,100);save();
  return {ok:true,text:(service==='repair'?'Reparo':'Limpeza')+' concluído · conservação '+Math.round(d.condition)+'%'};
 }
 function activity(H,id){
  if(!own(H))return {ok:false,text:'Acesso negado'};
  const item=CityHome.placed(H).find(r=>r.id===id);
  if(!item)return {ok:false,text:'O móvel não está instalado'};
  const kinds={bed:'sleep',mattress:'sleep',sofa:'sit',couch:'sit',sectional:'sit',
    chair:'sit',tv:'watch',desk:'work',stove:'cook',fridge:'eat',microwave:'eat',
    sink:'wash',shower:'wash',toilet:'toilet'};
  const action=kinds[item.kind];
  if(!action)return {ok:false,text:'Esse móvel não tem uma atividade'};
  const state=typeof CitySim!=='undefined'?CitySim.game:null;
  const player=state?.player||window.__game?.player;
  if(!player)return {ok:false,text:'Personagem indisponível'};
  if(!data(H).power&&['watch','cook','work','eat'].includes(action))
    return {ok:false,text:'Ligue a energia da casa primeiro'};
  if(Math.hypot(player.x-item.x,player.y-item.y)>12)
    return {ok:false,text:'Aproxime-se do móvel antes de usar'};
  // Existing needs logic stays authoritative. Pose is a short procedural
  // interaction state; actual foot IK/navigation will need a dedicated controller.
  if(typeof CityLife!=='undefined')CityLife.interior(item.kind);
  if(state){
    if(action==='cook'||action==='eat')state.food=Math.min(1,(state.food||0)+.13);
    if(action==='wash')state.water=Math.min(1,(state.water||0)+.04);
    if(action==='sit'||action==='sleep')state.hp=Math.min(1,(state.hp||0)+.04);
  }
  player.homeAction={kind:action,t:0,duration:action==='sleep'?5:3.5};
  if(typeof CityLife!=='undefined')CityLife.save();
  return {ok:true,text:({sit:'Sentando',sleep:'Descansando',watch:'Assistindo televisão',work:'Trabalhando',
    cook:'Preparando refeição',eat:'Fazendo lanche',wash:'Usando o banheiro',toilet:'Usando banheiro'})[action]};
 }
 function tick(p){
  if(!p||typeof houses==='undefined')return;
  const H=CityHome.houseAt(p);
  if(!H)return;
  const clk=typeof CitySim!=='undefined'?CitySim.game?.clock:0;
  const day=Math.floor((clk||0)/1440);
  if(lastTick===day)return;
  lastTick=day;upkeep(H,clk);
 }
 return {load,data,save,rooms,roomAt,finishes,trim,lightModes,color,decor,supports,finish,surface,decorate,
  installLight,light,togglePower,setGuestMode,invite,removeGuest,capture,projects,apply,appraisal,repair,upkeep,activity,tick,
  get changes(){return changes}};
})();
window.CityHomePlus=CityHomePlus;
